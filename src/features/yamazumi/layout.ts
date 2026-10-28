import type { ScenarioResult } from "@/domain/calc/evaluate";
import { exceeds } from "@/domain/calc/tolerance";
import { compareSteps } from "@/domain/model/stepOrder";
import {
  isUnassigned,
  type Employee,
  type ScenarioInput,
  type Station,
  type Step,
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
  /** Springer arbeitet in dieser Zeit an einer anderen Station; keine Wartezeit (E40). */
  | { readonly kind: "absence"; readonly from: number; readonly to: number }
  | {
      readonly kind: "unassigned";
      readonly stepId: string;
      readonly from: number;
      readonly to: number;
    }
  /** Prozesszeit ohne Mitarbeiter, zeitlich korrekt in der Prozessspur (E44). */
  | {
      readonly kind: "process";
      readonly stepId: string;
      readonly from: number;
      readonly to: number;
    };

export interface Lane {
  readonly employee: Employee;
  /** Zeitlich korrekt: parallele Tätigkeiten anderer Lanes liegen auf gleicher Höhe (F70). */
  readonly segments: readonly Segment[];
  readonly occupancy: number;
  /** Oberkante der Spur; bei Springern wegen Abwesenheit höher als die Belegung. */
  readonly top: number;
  readonly overTakt: boolean;
  /** Weitere Einsatzstationen derselben Person (Springer, E40). */
  readonly otherStations: readonly Station[];
}

export interface StationColumn {
  readonly station: Station;
  readonly lanes: readonly Lane[];
  /** Mitarbeiterzahl, Springer anteilig (E40). */
  readonly employeeCount: number;
  /** Nicht zugeordnete Schritte, gestapelt; nicht Teil der Stationshöhe (F67, E10). */
  readonly unassigned: readonly Segment[];
  /** Prozesszeiten der Station (E44); leer = keine Prozessspur. */
  readonly process: readonly Segment[];
  readonly height: number;
  readonly stationUtilization: number;
  readonly overTakt: boolean;
  /** Gefilterte Darstellung (E8): Höhe = Summe sichtbarer Arbeitsgänge, keine Taktbewertung. */
  readonly filtered?: boolean;
}

/** Filterkriterien (F96): innerhalb eines Kriteriums ODER, zwischen Kriterien UND. Leer = alle. */
export interface StepFilter {
  readonly stationIds: ReadonlySet<string>;
  /** Mitarbeiterbezeichnungen über alle Stationen, z. B. „Mitarbeiter 1“; UNASSIGNED für nicht zugeordnet. */
  readonly employeeLabels: ReadonlySet<string>;
  readonly categoryIds: ReadonlySet<string>;
}

export const UNASSIGNED = "__unassigned__";
/** Filterbezeichnung der Prozessspur; Prozesszeiten erscheinen nur ohne Mitarbeiterfilter. */
const PROCESS = "__process__";

export const EMPTY_FILTER: StepFilter = {
  stationIds: new Set(),
  employeeLabels: new Set(),
  categoryIds: new Set(),
};

export function isFilterActive(filter: StepFilter): boolean {
  return (
    filter.stationIds.size > 0 ||
    filter.employeeLabels.size > 0 ||
    filter.categoryIds.size > 0
  );
}

/** Passt ein Arbeitsgang zum Filter? */
export function matchesFilter(
  step: Step,
  employeeLabel: string | null,
  filter: StepFilter,
): boolean {
  const { stationIds, employeeLabels, categoryIds } = filter;
  return (
    (stationIds.size === 0 || stationIds.has(step.stationId)) &&
    (categoryIds.size === 0 || categoryIds.has(step.categoryId ?? "")) &&
    (employeeLabels.size === 0 ||
      employeeLabels.has(employeeLabel ?? UNASSIGNED))
  );
}

/**
 * Gefilterte Darstellung (E8, F128): Die Berechnung bleibt unverändert;
 * sichtbar sind nur passende Arbeitsgänge, lückenlos gestapelt in ihrer Spur.
 * Warte- und Zuschlagssegmente entfallen, die Höhe ist die Summe der sichtbaren Zeiten.
 */
export function applyFilter(
  columns: readonly StationColumn[],
  input: ScenarioInput,
  filter: StepFilter,
): StationColumn[] {
  if (!isFilterActive(filter)) return [...columns];
  const steps = new Map(input.steps.map((s) => [s.id, s]));
  const restack = (
    segments: readonly Segment[],
    label: string | null,
    kind: "step" | "unassigned" | "process",
  ) => {
    let top = 0;
    const out: Segment[] = [];
    for (const segment of segments) {
      if (segment.kind !== kind) continue;
      const step = steps.get(segment.stepId)!;
      if (!matchesFilter(step, label, filter)) continue;
      out.push({ kind, stepId: step.id, from: top, to: top + step.timeMin });
      top += step.timeMin;
    }
    return { segments: out, total: top };
  };

  return columns
    .filter(
      (c) =>
        filter.stationIds.size === 0 || filter.stationIds.has(c.station.id),
    )
    .map((column) => {
      const lanes = column.lanes
        .filter(
          (lane) =>
            filter.employeeLabels.size === 0 ||
            filter.employeeLabels.has(lane.employee.label),
        )
        .map((lane) => {
          const { segments, total } = restack(
            lane.segments,
            lane.employee.label,
            "step",
          );
          return {
            ...lane,
            segments,
            occupancy: total,
            top: total,
            overTakt: false,
          };
        });
      const unassigned = restack(
        column.unassigned,
        null,
        "unassigned",
      ).segments;
      const process = restack(column.process, PROCESS, "process").segments;
      return {
        ...column,
        lanes,
        unassigned,
        process,
        height: Math.max(0, ...lanes.map((l) => l.occupancy)),
        overTakt: false,
        filtered: true,
      };
    });
}

export function buildColumns(
  input: ScenarioInput,
  result: ScenarioResult,
): StationColumn[] {
  const stations = new Map(input.stations.map((s) => [s.id, s]));
  const employees = new Map(input.employees.map((e) => [e.id, e]));
  const stepsByStation = new Map<string, Step[]>();
  for (const step of [...input.steps].sort(compareSteps)) {
    if (!isUnassigned(step)) continue;
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
        // Ende der vorigen Tätigkeit dieser Spur; Lücken davor sind Abwesenheit (E40).
        let cursor = 0;
        let absent = false;
        for (const s of employeeResult.steps) {
          const waitFrom = s.start - s.waitBefore;
          if (exceeds(waitFrom, cursor)) {
            absent = true;
            segments.push({ kind: "absence", from: cursor, to: waitFrom });
          }
          if (s.waitBefore > 0) {
            segments.push({
              kind: "wait",
              beforeStepId: s.stepId,
              from: waitFrom,
              to: s.start,
            });
          }
          segments.push({
            kind: "step",
            stepId: s.stepId,
            from: s.start,
            to: s.end,
          });
          cursor = s.end;
        }
        // Ohne Abwesenheit liegt das Ende genau bei produktiv + Wartezeit.
        const end = absent
          ? cursor
          : employeeResult.productive + employeeResult.wait;
        if (employeeResult.allowance > 0) {
          segments.push({
            kind: "allowance",
            from: end,
            to: end + employeeResult.allowance,
          });
        }
        const employee = employees.get(employeeResult.employeeId)!;
        return {
          employee,
          segments,
          occupancy: employeeResult.occupancy,
          top: absent
            ? end + employeeResult.allowance
            : employeeResult.occupancy,
          overTakt: employeeResult.overTakt,
          otherStations: result.employees
            .filter(
              (e) =>
                e.personId === employeeResult.personId &&
                e.employeeId !== employeeResult.employeeId,
            )
            .map((e) => stations.get(e.stationId)!),
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
      employeeCount: stationResult.employeeCount,
      unassigned,
      process: stationResult.processSteps.map((s): Segment => ({
        kind: "process",
        stepId: s.stepId,
        from: s.start,
        to: s.end,
      })),
      height: stationResult.height,
      stationUtilization: stationResult.stationUtilization,
      overTakt: stationResult.overTakt,
    };
  });
}

/** Höchster darzustellender Wert: Takt, Stationshöhen, Spuren, Prozesszeiten und Stapel nicht zugeordneter Schritte. */
export function axisMaximum(
  columns: readonly StationColumn[],
  taktMin: number,
): number {
  const tops = columns.flatMap((c) => [
    c.height,
    c.unassigned.at(-1)?.to ?? 0,
    ...c.process.map((s) => s.to),
    ...c.lanes.map((l) => l.top),
  ]);
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
