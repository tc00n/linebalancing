import { findCycles } from "../checks/cycles";
import type { Category } from "../model/categories";
import { isEmployeeLabel, normalizeQualified } from "../model/qualification";
import {
  groupMembersOf,
  normalizeGroupId,
  scenarioGroupProblems,
} from "../model/groups";
import {
  isProcess,
  personOf,
  type Employee,
  type ScenarioInput,
  type Step,
  type TimeKind,
} from "../model/types";

/** Bearbeitbarer Stand eines Szenarios. */
export interface EditableScenario {
  readonly input: ScenarioInput;
  readonly categories: readonly Category[];
}

/**
 * Änderungen im Workshop (Phase 5). Arbeitsgänge und Stationen werden nie
 * angelegt (F29), importierte Zeiten nie verändert (F17).
 */
export type Operation =
  | {
      readonly type: "moveStep";
      readonly stepId: string;
      readonly stationId: string;
    }
  | {
      readonly type: "assignEmployee";
      readonly stepId: string;
      readonly employeeId: string | null;
    }
  | {
      readonly type: "setCategory";
      readonly stepId: string;
      readonly categoryId: string;
    }
  | {
      readonly type: "setPredecessors";
      readonly stepId: string;
      readonly predecessorIds: readonly string[];
    }
  | {
      readonly type: "setSequence";
      readonly stepId: string;
      readonly sequence: number;
    }
  /** E44: Prozesszeit verliert ihren Mitarbeiter, Handzeit das Kennzeichen „hält Station“. */
  | {
      readonly type: "setTimeKind";
      readonly stepId: string;
      readonly timeKind: TimeKind;
      /** Nur Prozesszeit; fehlt = bisheriger Wert bleibt. */
      readonly holdsStation?: boolean;
    }
  /** E42: gemeinsamer Arbeitsgang; null bzw. leer = keine Gruppe. */
  | {
      readonly type: "setGroup";
      readonly stepId: string;
      readonly groupId: string | null;
    }
  /** E51: Mitarbeiter („Mitarbeiter N“), die den Arbeitsgang ausführen können; leer = jeder. */
  | {
      readonly type: "setQualified";
      readonly stepId: string;
      readonly employeeLabels: readonly string[];
    }
  | {
      readonly type: "setHoldsStation";
      readonly stepId: string;
      readonly holdsStation: boolean;
    }
  | { readonly type: "setTakt"; readonly taktMin: number }
  | { readonly type: "setAllowance"; readonly allowancePct: number }
  | { readonly type: "addEmployee"; readonly stationId: string }
  /** Neuer Mitarbeiter an der Station des Arbeitsgangs, direkt zugewiesen (E12, F100). */
  | { readonly type: "assignNewEmployee"; readonly stepId: string }
  | { readonly type: "removeEmployee"; readonly employeeId: string }
  | {
      readonly type: "setCategoryColor";
      readonly categoryId: string;
      readonly color: string;
    };

export type OperationResult =
  | { readonly ok: true; readonly scenario: EditableScenario }
  | { readonly ok: false; readonly error: string };

export function applyOperation(
  scenario: EditableScenario,
  op: Operation,
): OperationResult {
  const result = applyUnchecked(scenario, op);
  if (!result.ok || result.scenario === scenario) return result;
  // E42: Keine Änderung darf eine Gruppe widersprüchlich machen.
  const problem = scenarioGroupProblems(result.scenario.input)[0];
  return problem ? { ok: false, error: problem.message } : result;
}

function applyUnchecked(
  scenario: EditableScenario,
  op: Operation,
): OperationResult {
  const { input } = scenario;
  const fail = (error: string): OperationResult => ({ ok: false, error });
  const withInput = (next: Partial<ScenarioInput>): OperationResult => ({
    ok: true,
    scenario: { ...scenario, input: { ...input, ...next } },
  });
  const updateStep = (stepId: string, change: (step: Step) => Step) =>
    withInput({
      steps: input.steps.map((s) => (s.id === stepId ? change(s) : s)),
    });

  const needStep = (stepId: string) => input.steps.find((s) => s.id === stepId);
  const PROCESS_HAS_NO_EMPLOYEE =
    "Prozesszeiten binden keinen Mitarbeiter. Zum Zuordnen die Zeitart auf Handzeit stellen.";

  switch (op.type) {
    case "moveStep": {
      const step = needStep(op.stepId);
      if (!step) return fail(`Arbeitsgang ${op.stepId} existiert nicht.`);
      if (!input.stations.some((s) => s.id === op.stationId)) {
        return fail("Zielstation existiert nicht.");
      }
      if (step.stationId === op.stationId) return { ok: true, scenario };
      // E42: Die ganze Gruppe zieht mit; die übrigen Zeilen behalten ihren Mitarbeiter (Spur nach E40).
      const others = new Set(
        groupMembersOf(input.steps, step)
          .filter((s) => s.id !== step.id)
          .map((s) => s.id),
      );
      let employees = input.employees;
      const steps = input.steps.map((s) => {
        // F61: nach Stationswechsel zunächst keinem Mitarbeiter zugeordnet.
        if (s.id === step.id)
          return { ...s, stationId: op.stationId, employeeId: null };
        if (!others.has(s.id)) return s;
        if (s.employeeId === null) return { ...s, stationId: op.stationId };
        const lane = laneAt(employees, s.employeeId, op.stationId);
        employees = lane.employees;
        return { ...s, stationId: op.stationId, employeeId: lane.id };
      });
      return withInput({ steps, employees });
    }

    case "assignEmployee": {
      const step = needStep(op.stepId);
      if (!step) return fail(`Arbeitsgang ${op.stepId} existiert nicht.`);
      if (op.employeeId === null) {
        return updateStep(op.stepId, (s) => ({ ...s, employeeId: null }));
      }
      if (isProcess(step)) return fail(PROCESS_HAS_NO_EMPLOYEE);
      const employee = input.employees.find((e) => e.id === op.employeeId);
      if (!employee) return fail("Mitarbeiter existiert nicht.");
      if (employee.stationId === step.stationId) {
        return updateStep(op.stepId, (s) => ({
          ...s,
          employeeId: employee.id,
        }));
      }
      // E40: Mitarbeiter einer anderen Station arbeitet hier als Springer.
      const lane = laneAt(input.employees, employee.id, step.stationId);
      return withInput({
        employees: lane.employees,
        steps: input.steps.map((s) =>
          s.id === op.stepId ? { ...s, employeeId: lane.id } : s,
        ),
      });
    }

    case "setCategory": {
      if (!needStep(op.stepId))
        return fail(`Arbeitsgang ${op.stepId} existiert nicht.`);
      if (!scenario.categories.some((c) => c.id === op.categoryId)) {
        return fail("Kategorie existiert nicht.");
      }
      return updateStep(op.stepId, (s) => ({
        ...s,
        categoryId: op.categoryId,
      }));
    }

    case "setPredecessors": {
      const step = needStep(op.stepId);
      if (!step) return fail(`Arbeitsgang ${op.stepId} existiert nicht.`);
      const ids = new Set(input.steps.map((s) => s.id));
      const seen = new Set<string>();
      for (const id of op.predecessorIds) {
        if (id === op.stepId)
          return fail(
            "Ein Arbeitsgang kann nicht sein eigener Vorgänger sein.",
          );
        if (!ids.has(id)) return fail(`Vorgänger ${id} existiert nicht.`);
        if (seen.has(id)) return fail(`Vorgänger ${id} ist doppelt angegeben.`);
        seen.add(id);
      }
      const steps = input.steps.map((s) =>
        s.id === op.stepId
          ? { ...s, predecessorIds: [...op.predecessorIds] }
          : s,
      );
      // E3: Vorgängerkreise sind in der App nicht speicherbar.
      const cycle = findCycles(steps).find((c) => c.includes(op.stepId));
      if (cycle)
        return fail(
          `Diese Vorgänger würden einen Kreis bilden: ${cycle.join(", ")}.`,
        );
      return withInput({ steps });
    }

    case "setSequence": {
      if (!needStep(op.stepId))
        return fail(`Arbeitsgang ${op.stepId} existiert nicht.`);
      if (!Number.isFinite(op.sequence))
        return fail("Reihenfolge muss eine Zahl sein.");
      if (op.sequence < 0) return fail("Reihenfolge darf nicht negativ sein.");
      return updateStep(op.stepId, (s) => ({ ...s, sequence: op.sequence }));
    }

    case "setTimeKind": {
      const step = needStep(op.stepId);
      if (!step) return fail(`Arbeitsgang ${op.stepId} existiert nicht.`);
      if (op.timeKind !== "manual" && op.timeKind !== "process") {
        return fail("Unbekannte Zeitart.");
      }
      if (op.timeKind === "manual" && op.holdsStation) {
        return fail("Nur Prozesszeiten können die Station halten.");
      }
      return updateStep(op.stepId, (s) => {
        const holds = op.holdsStation ?? (isProcess(s) && !!s.holdsStation);
        return op.timeKind === "process"
          ? {
              ...withoutTimeKind(s),
              employeeId: null,
              timeKind: "process",
              ...(holds ? { holdsStation: true } : {}),
            }
          : withoutTimeKind(s);
      });
    }

    case "setGroup": {
      const step = needStep(op.stepId);
      if (!step) return fail(`Arbeitsgang ${op.stepId} existiert nicht.`);
      const groupId = normalizeGroupId(op.groupId);
      if (groupId === step.groupId) return { ok: true, scenario };
      return updateStep(op.stepId, (s) => {
        const copy: { -readonly [K in keyof Step]: Step[K] } = { ...s };
        if (groupId === undefined) delete copy.groupId;
        else copy.groupId = groupId;
        return copy;
      });
    }

    case "setQualified": {
      if (!needStep(op.stepId))
        return fail(`Arbeitsgang ${op.stepId} existiert nicht.`);
      const invalid = op.employeeLabels.filter((l) => !isEmployeeLabel(l));
      if (invalid.length)
        return fail(`Ungültige Mitarbeiterbezeichnung: ${invalid.join(", ")}.`);
      const labels = normalizeQualified(op.employeeLabels);
      return updateStep(op.stepId, (s) => {
        const copy: { -readonly [K in keyof Step]: Step[K] } = { ...s };
        if (labels === undefined) delete copy.qualifiedEmployees;
        else copy.qualifiedEmployees = labels;
        return copy;
      });
    }

    case "setHoldsStation": {
      const step = needStep(op.stepId);
      if (!step) return fail(`Arbeitsgang ${op.stepId} existiert nicht.`);
      if (!isProcess(step)) {
        return fail("Nur Prozesszeiten können die Station halten.");
      }
      return updateStep(op.stepId, (s) =>
        op.holdsStation
          ? { ...s, holdsStation: true }
          : { ...withoutTimeKind(s), timeKind: "process" },
      );
    }

    case "setTakt":
      if (!Number.isFinite(op.taktMin) || op.taktMin <= 0) {
        return fail("Taktzeit muss größer als 0 sein.");
      }
      return withInput({ taktMin: op.taktMin });

    case "setAllowance":
      if (!Number.isFinite(op.allowancePct) || op.allowancePct < 0) {
        return fail("Zuschlag darf nicht negativ sein.");
      }
      return withInput({ allowancePct: op.allowancePct });

    case "addEmployee": {
      if (!input.stations.some((s) => s.id === op.stationId)) {
        return fail("Station existiert nicht.");
      }
      const employee = nextEmployee(input.employees, op.stationId);
      return withInput({ employees: [...input.employees, employee] });
    }

    case "assignNewEmployee": {
      const step = needStep(op.stepId);
      if (!step) return fail(`Arbeitsgang ${op.stepId} existiert nicht.`);
      if (isProcess(step)) return fail(PROCESS_HAS_NO_EMPLOYEE);
      const employee = nextEmployee(input.employees, step.stationId);
      return withInput({
        employees: [...input.employees, employee],
        steps: input.steps.map((s) =>
          s.id === op.stepId ? { ...s, employeeId: employee.id } : s,
        ),
      });
    }

    case "removeEmployee": {
      if (!input.employees.some((e) => e.id === op.employeeId)) {
        return fail("Mitarbeiter existiert nicht.");
      }
      // E12: nur Mitarbeiter ohne zugeordneten Arbeitsgang.
      if (input.steps.some((s) => s.employeeId === op.employeeId)) {
        return fail(
          "Mitarbeiter mit zugeordneten Arbeitsgängen können nicht entfernt werden.",
        );
      }
      return withInput({
        employees: input.employees.filter((e) => e.id !== op.employeeId),
      });
    }

    case "setCategoryColor": {
      if (!/^#[0-9a-f]{6}$/i.test(op.color)) return fail("Ungültige Farbe.");
      if (!scenario.categories.some((c) => c.id === op.categoryId)) {
        return fail("Kategorie existiert nicht.");
      }
      return {
        ok: true,
        scenario: {
          ...scenario,
          categories: scenario.categories.map((c) =>
            c.id === op.categoryId
              ? { ...c, color: op.color.toLowerCase() }
              : c,
          ),
        },
      };
    }
  }
}

/** Handzeit ohne Zeitart-Felder wie vor E44, damit unveränderte Stände gleich bleiben. */
function withoutTimeKind(step: Step): Step {
  const copy: { -readonly [K in keyof Step]: Step[K] } = { ...step };
  delete copy.timeKind;
  delete copy.holdsStation;
  return copy;
}

/** Spur der Person hinter `employeeId` an einer Station; legt sie bei Bedarf an (E40). */
function laneAt(
  employees: readonly Employee[],
  employeeId: string,
  stationId: string,
): { id: string; employees: readonly Employee[] } {
  const employee = employees.find((e) => e.id === employeeId)!;
  if (employee.stationId === stationId) return { id: employee.id, employees };
  const person = personOf(employee);
  const existing = employees.find(
    (e) => personOf(e) === person && e.stationId === stationId,
  );
  if (existing) return { id: existing.id, employees };
  const lane = springerLane(employees, employee, stationId);
  return { id: lane.id, employees: [...employees, lane] };
}

/** Neue Spur einer Person an einer weiteren Station (E40). */
function springerLane(
  employees: readonly Employee[],
  source: Employee,
  stationId: string,
): Employee {
  const ids = new Set(employees.map((e) => e.id));
  const base = `${stationId}/${source.label}`;
  let id = base;
  for (let n = 2; ids.has(id); n++) id = `${base} (${n})`;
  return {
    id,
    stationId,
    label: source.label,
    personId: personOf(source),
  };
}

/**
 * Nächster „Mitarbeiter N“ an einer Station (F68, E12). Die Nummer läuft über
 * die ganze Linie, damit jede Person eindeutig benannt ist (26.10.2026).
 */
export function nextEmployee(
  employees: readonly Employee[],
  stationId: string,
): Employee {
  const numbers = employees.map((e) =>
    Number(/(\d+)\s*$/.exec(e.label)?.[1] ?? 0),
  );
  let n = Math.max(0, ...numbers) + 1;
  const ids = new Set(employees.map((e) => e.id));
  while (ids.has(`${stationId}/Mitarbeiter ${n}`)) n++;
  return {
    id: `${stationId}/Mitarbeiter ${n}`,
    stationId,
    label: `Mitarbeiter ${n}`,
  };
}
