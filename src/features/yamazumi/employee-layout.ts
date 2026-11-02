import type { EmployeeResult, ScenarioResult } from "@/domain/calc/evaluate";
import type { ScheduledStep } from "@/domain/calc/schedule";
import { compareStationLabels } from "@/domain/model/stationOrder";
import { compareSteps } from "@/domain/model/stepOrder";
import { isUnassigned, type ScenarioInput } from "@/domain/model/types";
import {
  isFilterActive,
  matchesFilter,
  PROCESS,
  type Segment,
  type StepFilter,
} from "./layout";

// Mitarbeiteransicht als Bedienerbalkendiagramm (E45): ein Balken je Person,
// gegliedert nach Stationen. Minuten-Koordinaten wie in layout.ts.

/** Gestapelte Summe (lückenlos, oben Warte- und Zuschlagszeit) oder zeitlich korrekt. */
export type BarArrangement = "stacked" | "timed";
/** Linienreihenfolge oder nach Belegung absteigend. */
export type BarOrder = "line" | "load";

export const UNASSIGNED_BAR = "__unassigned__";
export const PROCESS_BAR = "__process__";

/** Abschnitt eines Balkens, in dem die Person an einer Station arbeitet. */
export interface StationGroup {
  readonly stationId: string;
  readonly from: number;
  readonly to: number;
}

export interface EmployeeBar {
  /** Abgleich im Ist/Ziel-Vergleich über die Bezeichnung (E45). */
  readonly key: string;
  readonly kind: "person" | "unassigned" | "process";
  readonly label: string;
  /** Spuren der Person (E40); Ziel beim Umzuordnen per Ziehen. */
  readonly employeeIds: readonly string[];
  /** Einsatzstationen in Flussreihenfolge. */
  readonly stationIds: readonly string[];
  readonly segments: readonly Segment[];
  readonly groups: readonly StationGroup[];
  /** Person: Gesamtbelegung (6a); Sonderbalken: Summe der Zeiten; gefiltert: Summe der sichtbaren Zeiten. */
  readonly occupancy: number;
  readonly top: number;
  /** F106, an der Gesamtbelegung der Person; gefiltert keine Taktbewertung (E8). */
  readonly overTakt: boolean;
  readonly filtered: boolean;
  /** Erste Einsatzstation, für die Linienreihenfolge auch über zwei Szenarien. */
  readonly firstStationLabel: string;
}

export interface BarSlot {
  readonly key: string;
  readonly label: string;
}

const collator = new Intl.Collator("de", { numeric: true });
const keyOf = (label: string) => label.toLocaleLowerCase("de");
const SPECIAL_LABELS = { unassigned: "ohne MA", process: "Prozess" } as const;

interface Entry {
  readonly stepId: string;
  readonly stationId: string;
  readonly minutes: number;
}

/** Lückenlos ab `start` stapeln; aufeinanderfolgende Arbeitsgänge einer Station bilden eine Gruppe. */
function stack(
  entries: readonly Entry[],
  kind: "step" | "unassigned" | "process",
  start = 0,
) {
  const segments: Segment[] = [];
  const groups: StationGroup[] = [];
  let top = start;
  for (const entry of entries) {
    const from = top;
    top += entry.minutes;
    segments.push({ kind, stepId: entry.stepId, from, to: top });
    extendGroup(groups, entry.stationId, from, top);
  }
  return { segments, groups, top };
}

function extendGroup(
  groups: StationGroup[],
  stationId: string,
  from: number,
  to: number,
) {
  const last = groups.at(-1);
  if (last?.stationId === stationId) {
    groups[groups.length - 1] = { ...last, to };
  } else {
    groups.push({ stationId, from, to });
  }
}

/**
 * Balken je Person, danach „ohne Mitarbeiter“ und „Prozesszeiten“ (beide nicht
 * eingerechnet). Mit aktivem Filter gilt E8: nur passende Arbeitsgänge,
 * lückenlos gestapelt, ohne Warte- und Zuschlagszeit; Balken ohne Treffer entfallen.
 */
export function buildEmployeeBars(
  input: ScenarioInput,
  result: ScenarioResult,
  options: {
    readonly arrangement: BarArrangement;
    readonly order?: BarOrder;
    readonly filter?: StepFilter;
  },
): EmployeeBar[] {
  const filter = options.filter;
  const filtering = !!filter && isFilterActive(filter);
  const stations = new Map(input.stations.map((s) => [s.id, s]));
  const employees = new Map(input.employees.map((e) => [e.id, e]));
  const steps = new Map(input.steps.map((s) => [s.id, s]));
  const rank = new Map(result.stations.map((s, i) => [s.stationId, i]));
  const stationLabel = (id: string) => stations.get(id)!.label;
  const entry = (s: ScheduledStep): Entry => ({
    stepId: s.stepId,
    stationId: s.stationId,
    minutes: s.end - s.start,
  });
  const visible = (stepId: string, label: string | null) =>
    !filtering || matchesFilter(steps.get(stepId)!, label, filter);
  // Gestapelt: Stationen in Flussreihenfolge, darin nach Start.
  const byStation = (a: ScheduledStep, b: ScheduledStep) =>
    rank.get(a.stationId)! - rank.get(b.stationId)! || a.start - b.start;

  const persons = new Map<string, EmployeeResult[]>();
  for (const lane of result.employees) {
    persons.set(lane.personId, [...(persons.get(lane.personId) ?? []), lane]);
  }
  const rawLabel = (lanes: readonly EmployeeResult[]) =>
    employees.get(lanes[0].employeeId)!.label;
  const labelCount = new Map<string, number>();
  for (const lanes of persons.values()) {
    const key = keyOf(rawLabel(lanes));
    labelCount.set(key, (labelCount.get(key) ?? 0) + 1);
  }

  const bars: EmployeeBar[] = [];
  for (const lanes of persons.values()) {
    const raw = rawLabel(lanes);
    const stationIds = lanes.map((l) => l.stationId);
    // Vor E40 trägt jede Spur eine eigene Person; gleiche Bezeichnungen über die Stationen unterscheiden.
    const label =
      labelCount.get(keyOf(raw))! > 1
        ? `${raw} (${stationIds.map(stationLabel).join(", ")})`
        : raw;
    const scheduled = lanes
      .flatMap((l) => l.steps)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const common = {
      key: keyOf(label),
      kind: "person" as const,
      label,
      employeeIds: lanes.map((l) => l.employeeId),
      stationIds,
      firstStationLabel: stationLabel(stationIds[0]),
    };

    if (filtering) {
      const shown = [...scheduled]
        .sort(byStation)
        .filter((s) => visible(s.stepId, raw));
      if (shown.length === 0) continue;
      const { segments, groups, top } = stack(shown.map(entry), "step");
      bars.push({
        ...common,
        segments,
        groups,
        occupancy: top,
        top,
        overTakt: false,
        filtered: true,
      });
      continue;
    }

    const allowance = lanes.reduce((t, l) => t + l.allowance, 0);
    let segments: Segment[];
    let groups: StationGroup[];
    let top: number;
    if (options.arrangement === "timed") {
      // Je Person laufen die Arbeitsgänge nacheinander; Lücken davor sind Wartezeit (6a).
      segments = [];
      groups = [];
      top = 0;
      for (const s of scheduled) {
        const from = s.start - s.waitBefore;
        if (s.waitBefore > 0) {
          segments.push({
            kind: "wait",
            beforeStepId: s.stepId,
            from,
            to: s.start,
          });
        }
        segments.push({
          kind: "step",
          stepId: s.stepId,
          from: s.start,
          to: s.end,
        });
        extendGroup(groups, s.stationId, from, s.end);
        top = s.end;
      }
    } else {
      const stacked = stack([...scheduled].sort(byStation).map(entry), "step");
      segments = stacked.segments;
      groups = stacked.groups;
      top = stacked.top;
      for (const s of scheduled) {
        if (s.waitBefore <= 0) continue;
        segments.push({
          kind: "wait",
          beforeStepId: s.stepId,
          from: top,
          to: top + s.waitBefore,
        });
        top += s.waitBefore;
      }
    }
    if (allowance > 0) {
      segments.push({ kind: "allowance", from: top, to: top + allowance });
      top += allowance;
    }
    bars.push({
      ...common,
      segments,
      groups,
      occupancy: lanes[0].personOccupancy,
      top,
      overTakt: lanes[0].overTakt,
      filtered: false,
    });
  }

  // Nicht zugeordnete Arbeitsgänge und Prozesszeiten: immer gestapelt, weil sie
  // keiner Person folgen und sich Prozesszeiten mehrerer Stationen zeitlich überlappen.
  const special = (
    kind: "unassigned" | "process",
    entries: readonly Entry[],
  ) => {
    if (entries.length === 0) return;
    const { segments, groups, top } = stack(entries, kind);
    const ids = [...new Set(entries.map((e) => e.stationId))];
    bars.push({
      key: kind === "unassigned" ? UNASSIGNED_BAR : PROCESS_BAR,
      kind,
      label: SPECIAL_LABELS[kind],
      employeeIds: [],
      stationIds: ids,
      segments,
      groups,
      occupancy: top,
      top,
      overTakt: false,
      filtered: filtering,
      firstStationLabel: stationLabel(ids[0]),
    });
  };
  special(
    "unassigned",
    input.steps
      .filter((s) => isUnassigned(s) && visible(s.id, null))
      .sort(
        (a, b) =>
          rank.get(a.stationId)! - rank.get(b.stationId)! || compareSteps(a, b),
      )
      .map((s) => ({
        stepId: s.id,
        stationId: s.stationId,
        minutes: s.timeMin,
      })),
  );
  special(
    "process",
    result.stations
      .flatMap((s) => s.processSteps)
      .filter((s) => visible(s.stepId, PROCESS))
      .map(entry),
  );

  return bars.sort(compareBars(options.order ?? "line"));
}

const KIND_RANK = { person: 0, unassigned: 1, process: 2 } as const;

function compareBars(order: BarOrder) {
  return (
    a: Pick<EmployeeBar, "kind" | "occupancy" | "firstStationLabel" | "label">,
    b: Pick<EmployeeBar, "kind" | "occupancy" | "firstStationLabel" | "label">,
  ) =>
    KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
    (order === "load" ? b.occupancy - a.occupancy : 0) ||
    compareStationLabels(a.firstStationLabel, b.firstStationLabel) ||
    collator.compare(a.label, b.label);
}

/**
 * Gemeinsame Balkenfolge mehrerer Szenarien (Ist/Ziel, E45), abgeglichen über die
 * Bezeichnung. Bei „Belegung“ zählt die letzte Seite (das bearbeitete Ziel).
 */
export function alignBarSlots(
  sides: readonly (readonly EmployeeBar[])[],
  order: BarOrder,
): BarSlot[] {
  const byKey = new Map<string, EmployeeBar>();
  for (const bars of sides) for (const bar of bars) byKey.set(bar.key, bar);
  return [...byKey.values()]
    .sort(compareBars(order))
    .map((bar) => ({ key: bar.key, label: bar.label }));
}

/** Höchster darzustellender Wert der Mitarbeiteransicht. */
export function barsMaximum(
  bars: readonly EmployeeBar[],
  taktMin: number,
): number {
  return Math.max(taktMin, ...bars.map((b) => b.top));
}
