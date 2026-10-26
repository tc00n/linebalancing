import { findIssues, type Issue } from "../checks/issues";
import { sortStations } from "../model/stationOrder";
import { compareSteps } from "../model/stepOrder";
import { personOf, type Minutes, type ScenarioInput } from "../model/types";
import { assertValidScenario } from "../model/validate";
import { scheduleScenario, type ScheduledStep } from "./schedule";
import { exceeds } from "./tolerance";

// Alle Kennzahlen sind ungerundet (P2); gerundet wird erst bei der Ausgabe (rounding.ts).
// Verhältnisse sind Faktoren (1.0 = 100 %).

const labelCollator = new Intl.Collator("de", { numeric: true });

/** Ergebnis einer Spur, d. h. eines Mitarbeiters an einer Station (E40). */
export interface EmployeeResult {
  readonly employeeId: string;
  readonly stationId: string;
  /** Person hinter der Spur; mehrere Spuren derselben Person = Springer. */
  readonly personId: string;
  /** Eingeplante Schritte in zeitlicher Reihenfolge (F70). */
  readonly steps: readonly ScheduledStep[];
  /** Summe der importierten Zeiten (Abschnitt 4). */
  readonly productive: Minutes;
  /** Zuschlag nur auf die produktive Zeit (E2/P1). */
  readonly allowance: Minutes;
  readonly wait: Minutes;
  /** Spurbelegung: produktiv + Zuschlag + Wartezeit. */
  readonly occupancy: Minutes;
  /** Gesamtbelegung der Person über alle ihre Spuren (6a). */
  readonly personOccupancy: Minutes;
  /** Anteil der Person an dieser Station für die Mitarbeiterzahl (6a). */
  readonly share: number;
  /** F106, bezogen auf die Gesamtbelegung der Person. */
  readonly overTakt: boolean;
}

export interface StationResult {
  readonly stationId: string;
  /**
   * Alle Mitarbeiter der Station, auch ohne Tätigkeit (E6a); Springer anteilig
   * nach Belegung (6a), daher nicht immer ganzzahlig.
   */
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
  /** Zahl der Personen; ein Springer zählt einmal (6a). */
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

  const lanes = orderedEmployees.map((employee) => {
    const steps = scheduled.filter((s) => s.employeeId === employee.id);
    const productive = sum(steps.map((s) => stepTime.get(s.stepId)!));
    const wait = sum(steps.map((s) => s.waitBefore));
    const allowance = productive * allowanceFactor;
    return {
      employeeId: employee.id,
      stationId: employee.stationId,
      personId: personOf(employee),
      steps,
      productive,
      allowance,
      wait,
      occupancy: productive + allowance + wait,
    };
  });
  const personTotal = new Map<string, { occupancy: Minutes; lanes: number }>();
  for (const lane of lanes) {
    const total = personTotal.get(lane.personId) ?? { occupancy: 0, lanes: 0 };
    personTotal.set(lane.personId, {
      occupancy: total.occupancy + lane.occupancy,
      lanes: total.lanes + 1,
    });
  }
  const employees: EmployeeResult[] = lanes.map((lane) => {
    const total = personTotal.get(lane.personId)!;
    return {
      ...lane,
      personOccupancy: total.occupancy,
      // Ohne jede Belegung verteilt sich die Person gleichmäßig auf ihre Spuren.
      share:
        total.occupancy > 0
          ? lane.occupancy / total.occupancy
          : 1 / total.lanes,
      overTakt: exceeds(total.occupancy, input.taktMin),
    };
  });

  const stations: StationResult[] = stationsInFlow.map((station) => {
    const own = employees.filter((e) => e.stationId === station.id);
    const height = Math.max(0, ...own.map((e) => e.occupancy));
    const unassigned = orderedSteps.filter(
      (s) => s.stationId === station.id && s.employeeId === null,
    );
    const headcount = sum(own.map((e) => e.share));
    return {
      stationId: station.id,
      employeeCount: headcount,
      height,
      stationUtilization: height / input.taktMin,
      personnelUtilization: utilization(own, headcount, input.taktMin),
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
      employeeCount: personTotal.size,
      personnelUtilization: utilization(
        employees,
        personTotal.size,
        input.taktMin,
      ),
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
  headcount: number,
  taktMin: Minutes,
): number | null {
  if (employees.length === 0) return null;
  return sum(employees.map((e) => e.occupancy)) / (headcount * taktMin);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
