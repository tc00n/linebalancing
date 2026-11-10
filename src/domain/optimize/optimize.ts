import { compileSchedule } from "../calc/schedule";
import { evaluateScenario } from "../calc/evaluate";
import { isQualified } from "../model/qualification";
import {
  isProcess,
  personOf,
  type Employee,
  type ScenarioInput,
  type Step,
} from "../model/types";

/**
 * Verteilungsvorschlag für eine Station (E43, docs/RECHENREGELN.md 6d).
 *
 * Lokale Suche (Simulated Annealing): Arbeitsgänge der Station werden auf die
 * Mitarbeiter der Station umverteilt und ihre Reihenfolge getauscht; jede
 * Variante wird mit der normalen Ablaufplanung bewertet. Randbedingungen:
 * Qualifikation (E51) und gemeinsame Arbeitsgänge (E42, jede Person höchstens
 * einmal je Gruppe). Prozesszeiten, Zeiten, Vorgänger und andere Stationen
 * bleiben unverändert. Zufall mit festem Startwert: gleiche Eingabe, gleiches Ergebnis.
 */

/** „height“: kleinste Stationshöhe; „headcount“: wenigste Mitarbeiter unter Takt. */
export type OptimizeGoal = "height" | "headcount";

export interface OptimizeOptions {
  readonly stationId: string;
  readonly goal: OptimizeGoal;
  /** Anzahl Suchschritte; Vorgabe abhängig von der Größe der Station. */
  readonly iterations?: number;
  readonly seed?: number;
  /** Fortschritt, etwa alle 1 % der Schritte. */
  readonly onProgress?: (done: number, total: number) => void;
}

export interface StationSummary {
  /** Stationshöhe (F90). */
  readonly height: number;
  /** Personen mit mindestens einem Arbeitsgang an der Station. */
  readonly persons: number;
  /** Arbeitsgänge der Station ohne Mitarbeiter. */
  readonly unassigned: number;
  /** Arbeitsgänge mit einem Mitarbeiter, der nicht als qualifiziert eingetragen ist (E51). */
  readonly unqualified: number;
}

export interface OptimizeResult {
  /** Gesamtes Szenario mit der neuen Verteilung der Station. */
  readonly input: ScenarioInput;
  readonly before: StationSummary;
  readonly after: StationSummary;
  /** Arbeitsgänge mit anderem Mitarbeiter bzw. anderer Reihenfolge. */
  readonly reassigned: number;
  readonly resequenced: number;
  /** Entfernte Spuren ohne Arbeitsgang (nur Ziel „headcount“). */
  readonly removedEmployees: number;
}

export function optimizeStation(
  input: ScenarioInput,
  options: OptimizeOptions,
): OptimizeResult {
  const { stationId, goal } = options;
  if (!input.stations.some((s) => s.id === stationId)) {
    throw new Error(`Station ${stationId} existiert nicht.`);
  }
  const lanes = input.employees.filter((e) => e.stationId === stationId);
  const person = new Map(input.employees.map((e) => [e.id, personOf(e)]));

  // Nur der Teil der Linie, der über Springer (E40) mit der Station verbunden ist, beeinflusst sie.
  const sub = connectedPart(input, stationId);
  const free = sub.steps.filter(
    (s) => s.stationId === stationId && !isProcess(s),
  );
  const stationSteps = sub.steps.filter((s) => s.stationId === stationId);
  const groupOf = new Map<string, number[]>();
  free.forEach((s, i) => {
    if (s.groupId === undefined) return;
    groupOf.set(s.groupId, [...(groupOf.get(s.groupId) ?? []), i]);
  });

  // Zustand: Mitarbeiter je freiem Arbeitsgang und Reihenfolge je Arbeitsgang der Station.
  const employees: (string | null)[] = free.map((s) => s.employeeId);
  const sequences = new Map(stationSteps.map((s) => [s.id, s.sequence]));
  const allowed = free.map((s) =>
    lanes.filter((l) => isQualified(s, l.label)).map((l) => l.id),
  );

  const groupAllows = (i: number, employeeId: string, except = -1) => {
    const g = free[i].groupId;
    if (g === undefined) return true;
    const p = person.get(employeeId);
    return groupOf
      .get(g)!
      .every(
        (j) =>
          j === i ||
          j === except ||
          employees[j] === null ||
          person.get(employees[j]!) !== p,
      );
  };
  const canTake = (i: number, employeeId: string, except = -1) =>
    allowed[i].includes(employeeId) && groupAllows(i, employeeId, except);

  const rng = mulberry32(options.seed ?? 1);
  const pick = <T>(items: readonly T[]) =>
    items[Math.floor(rng() * items.length)];

  // Zuerst unzulässige Zuordnungen bereinigen (z. B. nachträglich eingetragene
  // Qualifikation) und nicht zugeordnete Arbeitsgänge einem zulässigen Mitarbeiter geben.
  // Ist an der Station niemand zulässig, bleibt die Zuordnung und wird als Rest gemeldet.
  free.forEach((_, i) => {
    const current = employees[i];
    if (current !== null && canTake(i, current)) return;
    employees[i] = null;
    const choices = allowed[i].filter((e) => canTake(i, e));
    employees[i] = choices.length ? pick(choices) : current;
  });

  const allowance = 1 + input.allowancePct / 100;
  // Vorbereitete Ablaufplanung: je Suchschritt nur Zuordnung und Reihenfolge einsetzen.
  const compiled = compileSchedule(sub);
  const subIndex = new Map(sub.steps.map((s, i) => [s.id, i]));
  const laneIndex = new Map(sub.employees.map((e, i) => [e.id, i]));
  const freeSub = free.map((s) => subIndex.get(s.id)!);
  const stationSub = stationSteps.map((s) => subIndex.get(s.id)!);
  const atStation = Uint8Array.from(sub.steps, (s) =>
    s.stationId === stationId ? 1 : 0,
  );
  const holding = Uint8Array.from(sub.steps, (s) => (s.holdsStation ? 1 : 0));
  const employeeArray = compiled.employeeIndices();
  const sequenceArray = compiled.sequences();
  const occupancy = new Float64Array(sub.employees.length);
  const measure = () => {
    free.forEach((_, i) => {
      employeeArray[freeSub[i]] =
        employees[i] === null ? -1 : laneIndex.get(employees[i]!)!;
    });
    stationSteps.forEach((s, k) => {
      sequenceArray[stationSub[k]] = sequences.get(s.id)!;
    });
    const plan = compiled.run(employeeArray, sequenceArray);
    occupancy.fill(0);
    let height = 0;
    let wait = 0;
    for (let k = 0; k < plan.count; k++) {
      const i = plan.order[k];
      if (!atStation[i]) continue;
      const lane = employeeArray[i];
      if (lane < 0) {
        if (holding[i]) height = Math.max(height, plan.end[i]);
        continue;
      }
      occupancy[lane] +=
        (plan.end[i] - plan.start[i]) * allowance + plan.wait[i];
      wait += plan.wait[i];
    }
    let squares = 0;
    let persons = 0;
    for (const o of occupancy) {
      if (o <= 0) continue;
      // Je Person höchstens eine Spur an der Station (E40).
      persons++;
      height = Math.max(height, o);
      squares += o * o;
    }
    // Änderungen gegenüber dem Ausgangsstand, damit gleichwertige Vorschläge möglichst wenig umstellen.
    let changes = 0;
    free.forEach((s, i) => {
      if (employees[i] !== s.employeeId) changes++;
    });
    stationSteps.forEach((s) => {
      if (sequences.get(s.id) !== s.sequence) changes++;
    });
    return { height, persons, wait, squares, changes };
  };
  const cost = (m: ReturnType<typeof measure>) => {
    // Feinere Ziele mit kleinem Gewicht: weniger Wartezeit, ausgeglichenere Belegung.
    const fine = m.height + 1e-3 * m.wait + 1e-6 * m.squares + 1e-5 * m.changes;
    return goal === "height"
      ? fine
      : Math.max(0, m.height - input.taktMin) * 1e4 + m.persons * 1e2 + fine;
  };

  const startMeasure = measure();
  let current = cost(startMeasure);
  let best = current;
  let bestEmployees = [...employees];
  let bestSequences = new Map(sequences);

  const total =
    options.iterations ?? Math.min(30000, 3000 + stationSteps.length * 500);
  const t0 = Math.max(0.5, 0.05 * startMeasure.height);
  const t1 = t0 * 1e-3;
  const report = Math.max(1, Math.floor(total / 100));
  const usedLanes = () => [...new Set(employees.filter((e) => e !== null))];

  for (let n = 0; n < total && free.length > 0; n++) {
    if (n % report === 0) options.onProgress?.(n, total);
    const temperature = t0 * Math.pow(t1 / t0, n / total);
    const undo = proposeMove();
    if (!undo) continue;
    const next = cost(measure());
    if (next <= current || rng() < Math.exp((current - next) / temperature)) {
      current = next;
      if (next < best - 1e-12) {
        best = next;
        bestEmployees = [...employees];
        bestSequences = new Map(sequences);
      }
    } else {
      undo();
    }
  }
  options.onProgress?.(total, total);

  /** Führt eine zufällige zulässige Änderung aus; liefert ihre Rücknahme. */
  function proposeMove(): (() => void) | null {
    const r = rng();
    if (r < 0.45) {
      // Einen Arbeitsgang einem anderen Mitarbeiter geben.
      const i = Math.floor(rng() * free.length);
      const choices = allowed[i].filter(
        (e) => e !== employees[i] && canTake(i, e),
      );
      if (!choices.length) return null;
      const old = employees[i];
      employees[i] = pick(choices);
      return () => (employees[i] = old);
    }
    if (r < 0.75) {
      // Mitarbeiter zweier Arbeitsgänge tauschen.
      const i = Math.floor(rng() * free.length);
      const j = Math.floor(rng() * free.length);
      const a = employees[i];
      const b = employees[j];
      if (i === j || a === null || b === null || a === b) return null;
      employees[i] = null;
      employees[j] = null;
      const ok = canTake(i, b, j) && canTake(j, a, i);
      employees[i] = ok ? b : a;
      employees[j] = ok ? a : b;
      return ok
        ? () => {
            employees[i] = a;
            employees[j] = b;
          }
        : null;
    }
    if (r < 0.9 || goal === "height") {
      // Reihenfolge zweier Arbeitsgänge der Station tauschen.
      if (stationSteps.length < 2) return null;
      const a = pick(stationSteps).id;
      const b = pick(stationSteps).id;
      const sa = sequences.get(a)!;
      const sb = sequences.get(b)!;
      if (a === b || sa === sb) return null;
      sequences.set(a, sb);
      sequences.set(b, sa);
      return () => {
        sequences.set(a, sa);
        sequences.set(b, sb);
      };
    }
    // Ziel „headcount“: einen Mitarbeiter ganz entlasten.
    const used = usedLanes();
    if (used.length < 2) return null;
    const lane = pick(used);
    const old = [...employees];
    for (let i = 0; i < free.length; i++) {
      if (employees[i] !== lane) continue;
      const choices = allowed[i].filter(
        (e) => e !== lane && used.includes(e) && canTake(i, e),
      );
      if (!choices.length) {
        employees.splice(0, employees.length, ...old);
        return null;
      }
      employees[i] = pick(choices);
    }
    return () => employees.splice(0, employees.length, ...old);
  }

  // Ergebnis in das ganze Szenario übernehmen.
  const changedEmployee = new Map(free.map((s, i) => [s.id, bestEmployees[i]]));
  const steps = input.steps.map((s) => {
    const employeeId = changedEmployee.has(s.id)
      ? changedEmployee.get(s.id)!
      : s.employeeId;
    const sequence = bestSequences.get(s.id) ?? s.sequence;
    return employeeId === s.employeeId && sequence === s.sequence
      ? s
      : { ...s, employeeId, sequence };
  });
  let employeesOut: readonly Employee[] = input.employees;
  let removedEmployees = 0;
  if (goal === "headcount") {
    // Nicht mehr benötigte Spuren der Station entfernen, damit die Mitarbeiterzahl sinkt (E6a, E12).
    const busy = new Set(steps.map((s) => s.employeeId));
    employeesOut = input.employees.filter(
      (e) => e.stationId !== stationId || busy.has(e.id),
    );
    removedEmployees = input.employees.length - employeesOut.length;
  }
  const result: ScenarioInput = { ...input, employees: employeesOut, steps };

  const summary = (candidate: ScenarioInput): StationSummary => {
    const station = evaluateScenario(candidate).stations.find(
      (s) => s.stationId === stationId,
    )!;
    const own = candidate.steps.filter(
      (s) => s.stationId === stationId && !isProcess(s),
    );
    return {
      height: station.height,
      persons: new Set(
        own.filter((s) => s.employeeId).map((s) => person.get(s.employeeId!)),
      ).size,
      unassigned: own.filter((s) => s.employeeId === null).length,
      unqualified: own.filter((s) => {
        const employee = candidate.employees.find((e) => e.id === s.employeeId);
        return employee !== undefined && !isQualified(s, employee.label);
      }).length,
    };
  };

  const original = new Map(input.steps.map((s) => [s.id, s]));
  return {
    input: result,
    before: summary(input),
    after: summary(result),
    reassigned: steps.filter(
      (s) => s.employeeId !== original.get(s.id)!.employeeId,
    ).length,
    resequenced: steps.filter(
      (s) => s.sequence !== original.get(s.id)!.sequence,
    ).length,
    removedEmployees,
  };
}

/** Stationen, die über Personen mit Spuren an mehreren Stationen verbunden sind. */
function connectedPart(input: ScenarioInput, stationId: string): ScenarioInput {
  const stationsOf = new Map<string, Set<string>>();
  for (const e of input.employees) {
    const p = personOf(e);
    stationsOf.set(p, (stationsOf.get(p) ?? new Set()).add(e.stationId));
  }
  const reached = new Set([stationId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const stations of stationsOf.values()) {
      if (![...stations].some((s) => reached.has(s))) continue;
      for (const s of stations) {
        if (!reached.has(s)) {
          reached.add(s);
          grew = true;
        }
      }
    }
  }
  const steps: Step[] = input.steps.filter((s) => reached.has(s.stationId));
  const ids = new Set(steps.map((s) => s.id));
  return {
    ...input,
    stations: input.stations.filter((s) => reached.has(s.id)),
    employees: input.employees.filter((e) => reached.has(e.stationId)),
    // Vorgänger anderer Stationen wirken zeitlich nicht (E1a).
    steps: steps.map((s) => ({
      ...s,
      predecessorIds: s.predecessorIds.filter((p) => ids.has(p)),
    })),
  };
}

/** Kleiner, reproduzierbarer Zufallsgenerator. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
