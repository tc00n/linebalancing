import { findIssues, type Issue } from "../checks/issues";
import { sortStations } from "../model/stationOrder";
import { compareSteps } from "../model/stepOrder";
import type { Minutes, ScenarioInput } from "../model/types";
import { assertValidScenario } from "../model/validate";
import { scheduleScenario, type ScheduledStep } from "./schedule";
import { exceeds } from "./tolerance";

// Alle Kennzahlen sind ungerundet (P2); gerundet wird erst bei der Ausgabe (rounding.ts).
// Verhältnisse sind Faktoren (1.0 = 100 %).

const labelCollator = new Intl.Collator("de", { numeric: true });

export interface EmployeeResult {
  readonly employeeId: string;
  readonly stationId: string;
  /** Eingeplante Schritte in zeitlicher Reihenfolge (F70). */
  readonly steps: readonly ScheduledStep[];
  /** Summe der importierten Zeiten (Abschnitt 4). */
  readonly productive: Minutes;
  /** Zuschlag nur auf die produktive Zeit (E2/P1). */
  readonly allowance: Minutes;
  readonly wait: Minutes;
  /** produktiv + Zuschlag + Wartezeit. */
  readonly occupancy: Minutes;
  /** F106 */
  readonly overTakt: boolean;
}

export interface StationResult {
  readonly stationId: string;
  /** Alle Mitarbeiter der Station, auch ohne Tätigkeit (E6a). */
  readonly employeeCount: number;
  /** Größte Belegung eines Mitarbeiters (F90). */
  readonly height: Minutes;
  /** Stationsbelegung = Höhe / Takt (F107). */
  readonly stationUtilization: number;
  /** Belegungsbezogene Personalauslastung (F108); null ohne Mitarbeiter. */
  readonly personnelUtilization: number | null;
  /** F3 */
  readonly overTakt: boolean;
  readonly unassignedStepIds: readonly string[];
  readonly unassignedWorkContent: Minutes;
}

export interface ScenarioKpis {
  readonly taktMin: Minutes;
  readonly employeeCount: number;
  /** F108 über alle Mitarbeiter des Szenarios; null ohne Mitarbeiter. */
  readonly personnelUtilization: number | null;
  /** Summe der zugeordneten Zeiten ohne Zuschlag (E6b). */
  readonly totalWorkContent: Minutes;
  readonly unassignedWorkContent: Minutes;
  readonly unassignedStepCount: number;
  /** P4/F117: Kennzahlen sind unvollständig, solange Schritte nicht zugeordnet sind. */
  readonly incomplete: boolean;
  /** F15: Szenario ist konfliktbehaftet. */
  readonly hasViolations: boolean;
}

export interface ScenarioResult {
  /** In Flussreihenfolge (E14). */
  readonly stations: readonly StationResult[];
  readonly employees: readonly EmployeeResult[];
  readonly issues: readonly Issue[];
  readonly kpis: ScenarioKpis;
}

/** Berechnet ein Szenario vollständig (docs/RECHENREGELN.md). Die Eingabe wird nicht verändert. */
export function evaluateScenario(input: ScenarioInput): ScenarioResult {
  assertValidScenario(input);

  // Feste Ordnung für alle Listen und Summen: Ergebnis unabhängig von der Eingabereihenfolge.
  const stationsInFlow = sortStations(input.stations);
  const stationRank = new Map(stationsInFlow.map((s, i) => [s.id, i]));
  const orderedSteps = [...input.steps].sort(compareSteps);
  const orderedEmployees = [...input.employees].sort(
    (a, b) =>
      stationRank.get(a.stationId)! - stationRank.get(b.stationId)! ||
      labelCollator.compare(a.label, b.label) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  const scheduled = scheduleScenario(input);
  const stepTime = new Map(input.steps.map((s) => [s.id, s.timeMin]));
  const allowanceFactor = input.allowancePct / 100;

  const employees: EmployeeResult[] = orderedEmployees.map((employee) => {
    const steps = scheduled.filter((s) => s.employeeId === employee.id);
    const productive = sum(steps.map((s) => stepTime.get(s.stepId)!));
    const wait = sum(steps.map((s) => s.waitBefore));
    const allowance = productive * allowanceFactor;
    const occupancy = productive + allowance + wait;
    return {
      employeeId: employee.id,
      stationId: employee.stationId,
      steps,
      productive,
      allowance,
      wait,
      occupancy,
      overTakt: exceeds(occupancy, input.taktMin),
    };
  });

  const stations: StationResult[] = stationsInFlow.map((station) => {
    const own = employees.filter((e) => e.stationId === station.id);
    const height = Math.max(0, ...own.map((e) => e.occupancy));
    const unassigned = orderedSteps.filter(
      (s) => s.stationId === station.id && s.employeeId === null,
    );
    return {
      stationId: station.id,
      employeeCount: own.length,
      height,
      stationUtilization: height / input.taktMin,
      personnelUtilization: utilization(own, input.taktMin),
      overTakt: exceeds(height, input.taktMin),
      unassignedStepIds: unassigned.map((s) => s.id),
      unassignedWorkContent: sum(unassigned.map((s) => s.timeMin)),
    };
  });

  const issues = findIssues({ ...input, steps: orderedSteps });
  const unassignedSteps = orderedSteps.filter((s) => s.employeeId === null);

  return {
    stations,
    employees,
    issues,
    kpis: {
      taktMin: input.taktMin,
      employeeCount: employees.length,
      personnelUtilization: utilization(employees, input.taktMin),
      totalWorkContent: sum(
        orderedSteps.filter((s) => s.employeeId !== null).map((s) => s.timeMin),
      ),
      unassignedWorkContent: sum(unassignedSteps.map((s) => s.timeMin)),
      unassignedStepCount: unassignedSteps.length,
      incomplete: unassignedSteps.length > 0,
      hasViolations: issues.some((i) => i.severity === "violation"),
    },
  };
}

/** F108: Summe Belegung / (Mitarbeiterzahl × Takt). */
function utilization(
  employees: readonly EmployeeResult[],
  taktMin: Minutes,
): number | null {
  if (employees.length === 0) return null;
  return sum(employees.map((e) => e.occupancy)) / (employees.length * taktMin);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
