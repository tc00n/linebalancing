import { sortStations } from "../model/stationOrder";
import { compareSteps } from "../model/stepOrder";
import {
  isProcess,
  personOf,
  type Minutes,
  type ScenarioInput,
} from "../model/types";
import { exceeds, isBefore, nearlyEqual } from "./tolerance";

export interface ScheduledStep {
  readonly stepId: string;
  readonly stationId: string;
  /** null = Prozesszeit ohne Mitarbeiter (E44). */
  readonly employeeId: string | null;
  readonly start: Minutes;
  readonly end: Minutes;
  /** Wartezeit unmittelbar vor diesem Schritt (F63/F66, E5). */
  readonly waitBefore: Minutes;
}

/**
 * Ablaufplanung aller zugeordneten Schritte und Prozesszeiten (docs/RECHENREGELN.md,
 * Abschnitte 3, 6a, 6b und 6c).
 * Jede Station ist ein eigener Taktzyklus ab 0 (E1a); geplant wird gemeinsam über
 * alle Stationen, weil ein Springer (E40) linienweit nur eine Tätigkeit zugleich
 * ausführt. Ohne Springer ist das Ergebnis identisch mit der Planung je Station.
 * Erwartet eine gültige Eingabe (assertValidScenario), insbesondere ohne Vorgängerkreise.
 * Ergebnis in Planungsreihenfolge, d. h. je Mitarbeiter nach nicht fallendem Start.
 */
export function scheduleScenario(input: ScenarioInput): ScheduledStep[] {
  const compiled = compileSchedule(input);
  const plan = compiled.run(compiled.employeeIndices(), compiled.sequences());
  const result: ScheduledStep[] = [];
  for (let k = 0; k < plan.count; k++) {
    const i = plan.order[k];
    const step = input.steps[i];
    result.push({
      stepId: step.id,
      stationId: step.stationId,
      employeeId: step.employeeId,
      start: plan.start[i],
      end: plan.end[i],
      waitBefore: plan.wait[i],
    });
  }
  return result;
}

/** Ergebnis einer Planung; Felder je Arbeitsgang-Index der Eingabe. */
export interface Plan {
  /** Eingeplante Arbeitsgänge (Indizes) in Planungsreihenfolge. */
  readonly order: Int32Array;
  readonly count: number;
  readonly start: Float64Array;
  readonly end: Float64Array;
  readonly wait: Float64Array;
}

/**
 * Vorbereitete Ablaufplanung für wiederholtes Rechnen mit anderer Zuordnung
 * und Reihenfolge (Verteilungsvorschlag, E43). Stationen, Zeiten, Vorgänger,
 * Gruppen und Mitarbeiterliste sind fest; je Lauf wechseln nur Mitarbeiter
 * (Index in `input.employees`, -1 = keiner) und Reihenfolge je Arbeitsgang.
 */
export function compileSchedule(input: ScenarioInput) {
  const steps = input.steps;
  const n = steps.length;
  const index = new Map(steps.map((s, i) => [s.id, i]));
  const employeeIndex = new Map(input.employees.map((e, i) => [e.id, i]));
  const persons = new Map<string, number>();
  const personOfEmployee = Int32Array.from(input.employees, (e) => {
    const p = personOf(e);
    if (!persons.has(p)) persons.set(p, persons.size);
    return persons.get(p)!;
  });
  const rank = new Map(sortStations(input.stations).map((s, i) => [s.id, i]));
  const stationRank = Int32Array.from(steps, (s) => rank.get(s.stationId)!);
  const time = Float64Array.from(steps, (s) => s.timeMin);
  const process = Uint8Array.from(steps, (s) => (isProcess(s) ? 1 : 0));
  // Natürliche ID-Ordnung wie compareSteps bei gleicher Reihenfolge.
  const idRank = new Int32Array(n);
  [...steps.keys()]
    .sort((a, b) =>
      compareSteps(
        { id: steps[a].id, sequence: 0 },
        { id: steps[b].id, sequence: 0 },
      ),
    )
    .forEach((i, r) => (idRank[i] = r));
  // Vorgänger derselben Station; zeitlich wirksam, sofern eingeplant (E1a, E4, E44).
  const samePredecessors = steps.map((s) =>
    s.predecessorIds
      .map((p) => index.get(p))
      .filter(
        (p): p is number =>
          p !== undefined && steps[p].stationId === s.stationId,
      ),
  );
  const groupIds = new Map<string, number>();
  const group = Int32Array.from(steps, (s) => {
    if (s.groupId === undefined) return -1;
    if (!groupIds.has(s.groupId)) groupIds.set(s.groupId, groupIds.size);
    return groupIds.get(s.groupId)!;
  });

  function run(employee: ArrayLike<number>, sequence: ArrayLike<number>): Plan {
    // F109: nicht zugeordnete Handzeiten werden nicht eingeplant, Prozesszeiten schon (E44).
    const planned = new Uint8Array(n);
    const list: number[] = [];
    for (let i = 0; i < n; i++) {
      if (process[i] || employee[i] >= 0) {
        planned[i] = 1;
        list.push(i);
      }
    }
    // Feste Ordnung (compareSteps): Reihenfolge, dann ID.
    list.sort((a, b) => sequence[a] - sequence[b] || idRank[a] - idRank[b]);
    // E3, ergänzt um die Flussreihenfolge für Gleichstand zwischen Stationen (6a).
    const tieBreak = (a: number, b: number) =>
      sequence[a] - sequence[b] ||
      stationRank[a] - stationRank[b] ||
      idRank[a] - idRank[b];

    // E42 (6c): Die eingeplanten Zeilen einer Gruppe sind eine Einheit mit gemeinsamem Start.
    const units: number[][] = [];
    const unitOfGroup = new Map<number, number[]>();
    for (const i of list) {
      if (group[i] < 0) {
        units.push([i]);
        continue;
      }
      const members = unitOfGroup.get(group[i]);
      if (members) members.push(i);
      else {
        const created = [i];
        unitOfGroup.set(group[i], created);
        units.push(created);
      }
    }
    const lead = units.map((unit) =>
      unit.reduce((a, b) => (tieBreak(b, a) < 0 ? b : a)),
    );
    const predecessors = units.map((unit) =>
      unit.flatMap((i) => samePredecessors[i].filter((p) => planned[p])),
    );

    const personFree = new Float64Array(persons.size);
    const freeAt = (i: number) =>
      employee[i] < 0 ? 0 : personFree[personOfEmployee[employee[i]]];
    const done = new Uint8Array(n);
    const start = new Float64Array(n);
    const end = new Float64Array(n);
    const wait = new Float64Array(n);
    const order = new Int32Array(list.length);
    const pending = new Uint8Array(units.length).fill(1);
    let count = 0;

    for (let left = units.length; left > 0; left--) {
      let best = -1;
      let bestStart = 0;
      for (let u = 0; u < units.length; u++) {
        if (!pending[u]) continue;
        let ready = true;
        let at = 0;
        for (const p of predecessors[u]) {
          if (!done[p]) {
            ready = false;
            break;
          }
          if (end[p] > at) at = end[p];
        }
        if (!ready) continue;
        for (const i of units[u]) at = Math.max(at, freeAt(i));
        if (
          best < 0 ||
          isBefore(at, bestStart) ||
          (nearlyEqual(at, bestStart) && tieBreak(lead[u], lead[best]) < 0)
        ) {
          best = u;
          bestStart = at;
        }
      }

      if (best < 0) {
        throw new Error(
          "Ablaufplanung nicht möglich: Vorgängerkreis. Eingabe vorher mit assertValidScenario prüfen.",
        );
      }

      for (const i of units[best]) {
        const free = freeAt(i);
        start[i] = bestStart;
        end[i] = bestStart + time[i];
        // Vor einer Prozesszeit wartet niemand; in einer Gruppe wartet, wer früher frei ist.
        wait[i] =
          employee[i] >= 0 && exceeds(bestStart, free) ? bestStart - free : 0;
        if (employee[i] >= 0)
          personFree[personOfEmployee[employee[i]]] = end[i];
        done[i] = 1;
        order[count++] = i;
      }
      pending[best] = 0;
    }

    return { order, count, start, end, wait };
  }

  return {
    run,
    /** Mitarbeiter-Indizes der Eingabe. */
    employeeIndices: () =>
      Int32Array.from(steps, (s) =>
        s.employeeId === null ? -1 : (employeeIndex.get(s.employeeId) ?? -1),
      ),
    /** Reihenfolge der Eingabe. */
    sequences: () => Float64Array.from(steps, (s) => s.sequence),
  };
}
