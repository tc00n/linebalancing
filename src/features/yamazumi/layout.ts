import type { ScenarioResult } from "@/domain/calc/evaluate";
import { compareSteps } from "@/domain/model/stepOrder";
import type {
  Employee,
  ScenarioInput,
  Station,
  Step,
} from "@/domain/model/types";

// Übersetzt das Rechenergebnis in Diagrammsegmente (Minuten-Koordinaten).
// Die Zeitachse beginnt unten bei 0; Segmente liegen bei [from, to).

export type Segment =
  | {
      readonly kind: "step";
      readonly stepId: string;
      readonly from: number;
      readonly to: number;
    }
  | {
      readonly kind: "wait";
      readonly beforeStepId: string;
      readonly from: number;
      readonly to: number;
    }
  | { readonly kind: "allowance"; readonly from: number; readonly to: number }
  | {
      readonly kind: "unassigned";
      readonly stepId: string;
      readonly from: number;
      readonly to: number;
    };

export interface Lane {
  readonly employee: Employee;
  /** Zeitlich korrekt: parallele Tätigkeiten anderer Lanes liegen auf gleicher Höhe (F70). */
  readonly segments: readonly Segment[];
  readonly occupancy: number;
  readonly overTakt: boolean;
}

export interface StationColumn {
  readonly station: Station;
  readonly lanes: readonly Lane[];
  /** Nicht zugeordnete Schritte, gestapelt; nicht Teil der Stationshöhe (F67, E10). */
  readonly unassigned: readonly Segment[];
  readonly height: number;
  readonly stationUtilization: number;
  readonly overTakt: boolean;
}

export function buildColumns(
  input: ScenarioInput,
  result: ScenarioResult,
): StationColumn[] {
  const stations = new Map(input.stations.map((s) => [s.id, s]));
  const employees = new Map(input.employees.map((e) => [e.id, e]));
  const stepsByStation = new Map<string, Step[]>();
  for (const step of [...input.steps].sort(compareSteps)) {
    if (step.employeeId !== null) continue;
    stepsByStation.set(step.stationId, [
      ...(stepsByStation.get(step.stationId) ?? []),
      step,
    ]);
  }

  return result.stations.map((stationResult) => {
    const lanes: Lane[] = result.employees
      .filter((e) => e.stationId === stationResult.stationId)
      .map((employeeResult) => {
        const segments: Segment[] = [];
        for (const s of employeeResult.steps) {
          if (s.waitBefore > 0) {
            segments.push({
              kind: "wait",
              beforeStepId: s.stepId,
              from: s.start - s.waitBefore,
              to: s.start,
            });
          }
          segments.push({
            kind: "step",
            stepId: s.stepId,
            from: s.start,
            to: s.end,
          });
        }
        if (employeeResult.allowance > 0) {
          const top = employeeResult.productive + employeeResult.wait;
          segments.push({
            kind: "allowance",
            from: top,
            to: top + employeeResult.allowance,
          });
        }
        return {
          employee: employees.get(employeeResult.employeeId)!,
          segments,
          occupancy: employeeResult.occupancy,
          overTakt: employeeResult.overTakt,
        };
      });

    let stacked = 0;
    const unassigned: Segment[] = (
      stepsByStation.get(stationResult.stationId) ?? []
    ).map((step) => {
      const segment: Segment = {
        kind: "unassigned",
        stepId: step.id,
        from: stacked,
        to: stacked + step.timeMin,
      };
      stacked += step.timeMin;
      return segment;
    });

    return {
      station: stations.get(stationResult.stationId)!,
      lanes,
      unassigned,
      height: stationResult.height,
      stationUtilization: stationResult.stationUtilization,
      overTakt: stationResult.overTakt,
    };
  });
}

/** Höchster darzustellender Wert: Takt, Stationshöhen und Stapel nicht zugeordneter Schritte. */
export function axisMaximum(
  columns: readonly StationColumn[],
  taktMin: number,
): number {
  const tops = columns.flatMap((c) => [c.height, c.unassigned.at(-1)?.to ?? 0]);
  return Math.max(taktMin, ...tops);
}

/** Gut lesbare Achsenteilung (1, 2, 5 × 10ⁿ) mit etwa `targetCount` Teilstrichen. */
export function axisTicks(maximum: number, targetCount = 8): number[] {
  if (maximum <= 0) return [0];
  const rough = maximum / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 5, 10].map((f) => f * magnitude).find((s) => s >= rough) ??
    10 * magnitude;
  const ticks: number[] = [];
  for (let i = 0; i * step <= maximum + step * 1e-9; i++) {
    ticks.push(Number((i * step).toPrecision(12)));
  }
  return ticks;
}
