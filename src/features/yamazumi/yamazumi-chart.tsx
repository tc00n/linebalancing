"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ArrowLeftRightIcon, PlusIcon, XIcon } from "lucide-react";
import {
  memo,
  useCallback,
  useMemo,
  useState,
  type Ref,
  type UIEvent,
} from "react";
import { textColorFor } from "@/domain/model/categories";
import { violationsAfterMove } from "@/domain/ops/movePreview";
import type { ScenarioView } from "@/features/workspace/scenario-view";
import {
  chartStepId,
  formatAxis,
  formatHeadcount,
  formatMinutes,
  formatPercent,
} from "@/lib/format";
import { barsMaximum, type BarSlot, type EmployeeBar } from "./employee-layout";
import {
  axisMaximum,
  axisTicks,
  type Lane,
  type Segment,
  type StationColumn,
} from "./layout";
import { StepTooltip } from "./step-tooltip";

/** Stationsansicht mit Spuren je Mitarbeiter (E9) oder Mitarbeiteransicht mit einem Balken je Person (E45). */
export type ChartMode = "station" | "employee";

export interface LabelFields {
  readonly id: boolean;
  readonly description: boolean;
  readonly duration: boolean;
}

/** Änderungen aus dem Diagramm heraus (F28, F95, E12). */
export interface ChartActions {
  readonly onMoveStep: (stepId: string, stationId: string) => void;
  readonly onAssignEmployee: (stepId: string, employeeId: string) => void;
  readonly onAddEmployee: (stationId: string) => void;
  readonly onRemoveEmployee: (employeeId: string) => void;
}

interface YamazumiChartProps {
  readonly view: ScenarioView;
  readonly columns: readonly StationColumn[];
  readonly mode: ChartMode;
  /** Mitarbeiteransicht (E45): Balken je Person; ohne Angabe gilt die Stationsansicht. */
  readonly bars?: readonly EmployeeBar[];
  /** Vergleich: gemeinsame Balkenfolge der Mitarbeiteransicht. */
  readonly barSlots?: readonly BarSlot[];
  /** Breite einer Mitarbeiterspur bzw. eines Mitarbeiterbalkens (F98). */
  readonly laneWidth: number;
  /** Zeitskala in Pixel je Minute (F98). */
  readonly pxPerMinute: number;
  readonly labels: LabelFields;
  readonly selectedStepId: string | null;
  readonly onSelectStep: (stepId: string) => void;
  /** Ohne Aktionen ist das Diagramm schreibgeschützt (F118). */
  readonly actions?: ChartActions;
  /** Vergleich: gemeinsame Stationsfolge (F111) mit Mindestbreiten je Station. */
  readonly stationLabels?: readonly string[];
  readonly slotWidths?: ReadonlyMap<string, number>;
  /** Vergleich: gemeinsame vertikale Skala (F112). */
  readonly axisMaximum?: number;
  /** Vergleich: gekoppeltes horizontales Scrollen (F104). */
  readonly scrollRef?: Ref<HTMLDivElement>;
  readonly onScroll?: (event: UIEvent<HTMLDivElement>) => void;
  /** Vergleich: gegenüber dem Ist verschobene Arbeitsgänge (F113, F116). */
  readonly movedStepIds?: ReadonlySet<string>;
  /** Suchtreffer hervorheben, Rest abschwächen (E37); null = keine Suche aktiv. */
  readonly highlightStepIds?: ReadonlySet<string> | null;
}

const AXIS_WIDTH = 64;
const HEADROOM_PX = 28;
const LANE_GAP = 3;
const MIN_COLUMN_WIDTH = 64;

interface Hover {
  readonly stepId: string;
  readonly x: number;
  readonly y: number;
}

/** Ziel beim Ablegen: Station bzw. Spur, in der Mitarbeiteransicht der Balken einer Person. */
interface DropData {
  readonly stationId?: string;
  readonly employeeId?: string;
  /** Mitarbeiterbalken (E45): Umzuordnung, die Station bleibt. */
  readonly employeeIds?: readonly string[];
}

/** Stationsleiste links am Mitarbeiterbalken (E45). */
const STRIP_WIDTH = 14;
const BAR_GAP = 20;

/** Breite eines Mitarbeiterbalkens samt Stationsleiste. */
export function barColumnWidth(laneWidth: number): number {
  return STRIP_WIDTH + 2 + laneWidth;
}

/** Gesamtbreite der Mitarbeiteransicht für „An Fenster anpassen“. */
export function employeeBarsWidth(count: number, laneWidth: number): number {
  return count * barColumnWidth(laneWidth) + Math.max(0, count - 1) * BAR_GAP;
}

/** Breite einer Stationsspalte; im Vergleich gilt das Maximum beider Seiten. */
export function stationColumnWidth(
  column: StationColumn,
  laneWidth: number,
): number {
  const lanes =
    column.lanes.length * laneWidth +
    Math.max(0, column.lanes.length - 1) * LANE_GAP;
  const unassigned = column.unassigned.length
    ? LANE_GAP * 2 + Math.max(14, Math.round(laneWidth * 0.8))
    : 0;
  return Math.max(
    MIN_COLUMN_WIDTH,
    lanes + processLaneWidth(column, laneWidth) + unassigned,
  );
}

/** Prozessspur (E44) samt Abstand; 0 ohne Prozesszeiten. */
function processLaneWidth(column: StationColumn, laneWidth: number): number {
  return column.process.length ? LANE_GAP + laneWidth : 0;
}

const labelKey = (label: string) => label.toLocaleLowerCase("de");

/** Eine Mitarbeiterspur hat Vorrang vor der Station, in der sie liegt. */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const lane = hits.find((h) => /^(lane|bar):/.test(String(h.id)));
  return lane
    ? [lane]
    : hits.filter((h) => String(h.id).startsWith("station:"));
};

/**
 * Yamazumi mit horizontal scrollbaren Stationen (F91), Taktlinie (F94),
 * Mitarbeiterspuren (E9), Wartezeit- und Zuschlagssegmenten (F63, F66, E2),
 * separater Warnspur für nicht zugeordnete Schritte (F67, E10) und
 * Drag-and-drop zwischen Stationen ohne Dialog (F28, F95); nur bei
 * verletzten Vorgängerbeziehungen fragt der Editor vorher nach (E50, F139).
 */
export function YamazumiChart({
  scrollRef,
  onScroll,
  ...props
}: YamazumiChartProps) {
  const [hover, setHover] = useState<Hover | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const onHover = useCallback((next: Hover | null) => setHover(next), []);
  const sensors = useSensors(
    // Ab 6 px Bewegung beginnt das Ziehen; ein Klick wählt weiterhin aus.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // F129: alle Ziele markieren, problematische gesondert.
  const dropWarnings = useMemo(() => {
    if (!draggingId || props.mode === "employee") return null;
    return new Map(
      props.view.input.stations.map((s) => [
        s.id,
        violationsAfterMove(props.view.input, draggingId, s.id),
      ]),
    );
  }, [draggingId, props.mode, props.view.input]);

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const stepId = String(event.active.id);
    const target = event.over?.data.current as DropData | undefined;
    const step = props.view.steps.get(stepId);
    if (!target || !step || !props.actions) return;
    if (target.employeeIds) {
      // E45: auf einen anderen Mitarbeiterbalken gezogen; die Station bleibt (Springer nach E40).
      if (
        target.employeeIds.length > 0 &&
        !(step.employeeId && target.employeeIds.includes(step.employeeId))
      ) {
        props.actions.onAssignEmployee(stepId, target.employeeIds[0]);
      }
      return;
    }
    if (target.stationId && target.stationId !== step.stationId) {
      // F61: Stationswechsel, Mitarbeiter wird bewusst danach zugewiesen.
      props.actions.onMoveStep(stepId, target.stationId);
    } else if (target.employeeId && target.employeeId !== step.employeeId) {
      props.actions.onAssignEmployee(stepId, target.employeeId);
    }
  }

  const takt = props.view.input.taktMin;
  const maximum =
    props.axisMaximum ??
    (props.mode === "employee" && props.bars
      ? barsMaximum(props.bars, takt)
      : axisMaximum(props.columns, takt));
  const ticks = axisTicks(maximum * 1.04);
  const top = Math.max(ticks.at(-1)!, maximum);
  const plotHeight = top * props.pxPerMinute + HEADROOM_PX;
  const y = (minutes: number) => minutes * props.pxPerMinute;
  const dragged = draggingId ? props.view.steps.get(draggingId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={(e) => {
        setHover(null);
        setDraggingId(String(e.active.id));
      }}
      onDragCancel={() => setDraggingId(null)}
      onDragEnd={onDragEnd}
    >
      <div className="relative flex overflow-hidden rounded-xl border bg-white shadow-nx-sm">
        {/* Zeitachse bleibt beim horizontalen Scrollen stehen (F91). */}
        <div
          className="relative shrink-0 border-r bg-white"
          style={{ width: AXIS_WIDTH }}
        >
          <div className="relative" style={{ height: plotHeight }}>
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute right-2 translate-y-1/2 text-[11px] text-muted-foreground tabular-nums"
                style={{ bottom: y(t) }}
              >
                {formatAxis(t)}
              </span>
            ))}
            <span
              className="absolute right-1 z-10 translate-y-1/2 rounded-md bg-nx-red px-1.5 py-0.5 text-[11px] leading-tight font-semibold text-white tabular-nums"
              style={{ bottom: y(takt) }}
            >
              Takt
              <br />
              {formatMinutes(takt)}
            </span>
          </div>
          <div className="px-2 pt-2 text-right text-[11px] text-muted-foreground">
            min
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="relative min-w-0 flex-1 overflow-x-auto"
        >
          <div className="relative w-max min-w-full px-4">
            <div
              className="pointer-events-none absolute inset-x-0 top-0"
              style={{ height: plotHeight }}
              aria-hidden
            >
              {ticks.map((t) => (
                <div
                  key={t}
                  className="absolute inset-x-0 border-t border-(--yz-grid)"
                  style={{ bottom: y(t) }}
                />
              ))}
              <div
                className="absolute inset-x-0 z-20 border-t-2 border-dashed border-(--yz-takt)"
                style={{ bottom: y(takt) }}
              />
            </div>

            <ChartBody
              {...props}
              plotHeight={plotHeight}
              onHover={onHover}
              draggedStep={
                dragged
                  ? { id: dragged.id, stationId: dragged.stationId }
                  : null
              }
              dropWarnings={dropWarnings}
            />
          </div>
        </div>

        {hover && !draggingId && <StepTooltip view={props.view} {...hover} />}
      </div>

      <DragOverlay dropAnimation={null}>
        {dragged && (
          <div className="rounded-md bg-nx-blue px-2 py-1 text-xs font-medium text-white shadow-nx">
            {dragged.id} · {formatMinutes(dragged.timeMin)} min
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface ChartBodyProps extends Omit<
  YamazumiChartProps,
  "scrollRef" | "onScroll"
> {
  readonly plotHeight: number;
  readonly onHover: (hover: Hover | null) => void;
  readonly draggedStep: { id: string; stationId: string } | null;
  readonly dropWarnings: ReadonlyMap<string, string[]> | null;
}

const ChartBody = memo(function ChartBody(props: ChartBodyProps) {
  if (props.mode === "employee" && props.bars) {
    return <EmployeeBarsBody {...props} bars={props.bars} />;
  }
  const laneWidth = props.laneWidth;
  const byLabel = new Map(
    props.columns.map((c) => [labelKey(c.station.label), c]),
  );
  const slots =
    props.stationLabels ?? props.columns.map((c) => c.station.label);

  return (
    <div className="relative flex gap-6">
      {slots.map((label) => {
        const column = byLabel.get(labelKey(label));
        const minWidth = props.slotWidths?.get(labelKey(label)) ?? 0;
        return column ? (
          <StationColumnView
            key={column.station.id}
            {...props}
            column={column}
            laneWidth={laneWidth}
            minWidth={minWidth}
            warnings={props.dropWarnings?.get(column.station.id) ?? null}
          />
        ) : (
          <MissingStation
            key={`missing:${label}`}
            label={label}
            width={Math.max(MIN_COLUMN_WIDTH, minWidth)}
            plotHeight={props.plotHeight}
          />
        );
      })}
    </div>
  );
});

/** Station bzw. Mitarbeiter, den es nur im anderen Szenario gibt (F111, E45). */
function MissingStation(props: {
  label: string;
  width: number;
  plotHeight: number;
  kind?: string;
}) {
  return (
    <section
      className="flex flex-col"
      style={{ width: props.width }}
      aria-label={`${props.kind ?? "Station"} ${props.label} (nicht vorhanden)`}
    >
      <div
        className="rounded-md border border-dashed border-border bg-secondary/40"
        style={{ height: props.plotHeight }}
      />
      <footer className="mt-1 flex flex-col items-center border-t-2 border-dashed border-border pt-1.5 pb-2 text-center">
        <span className="max-w-full truncate text-sm text-muted-foreground">
          {props.label}
        </span>
        <span className="text-[11px] text-muted-foreground">
          nicht vorhanden
        </span>
      </footer>
    </section>
  );
}

function StationColumnView(
  props: Omit<ChartBodyProps, "columns"> & {
    column: StationColumn;
    minWidth: number;
    warnings: string[] | null;
  },
) {
  const { column, laneWidth, pxPerMinute, warnings } = props;
  const { setNodeRef, isOver } = useDroppable({
    id: `station:${column.station.id}`,
    data: { stationId: column.station.id } satisfies DropData,
    disabled: !props.actions,
  });
  const y = (minutes: number) => minutes * pxPerMinute;
  const unassignedWidth = Math.max(14, Math.round(laneWidth * 0.8));
  const hasUnassigned = column.unassigned.length > 0;
  const lanesWidth =
    column.lanes.length * laneWidth +
    Math.max(0, column.lanes.length - 1) * LANE_GAP;
  // Stationshöhe über Mitarbeiter- und Prozessspur (E44: Prozesszeit kann die Station halten).
  const heightLineWidth = lanesWidth + processLaneWidth(column, laneWidth);
  const width = Math.max(props.minWidth, stationColumnWidth(column, laneWidth));
  const dragging = props.draggedStep !== null;
  const isOrigin = props.draggedStep?.stationId === column.station.id;
  const warn =
    dragging && !isOrigin && warnings !== null && warnings.length > 0;

  return (
    <section
      ref={setNodeRef}
      className={`flex flex-col rounded-md outline-offset-4 transition-colors ${
        dragging
          ? warn
            ? `outline-2 outline-warning outline-dashed ${isOver ? "bg-warning/10" : ""}`
            : `outline-2 outline-nx-blue/40 outline-dashed ${isOver ? "bg-nx-blue/5" : ""}`
          : ""
      }`}
      style={{ width }}
      aria-label={`Station ${column.station.label}`}
      title={
        warn
          ? `Würde Vorgängerbeziehungen verletzen: ${warnings!.join(", ")}`
          : undefined
      }
    >
      <div className="relative" style={{ height: props.plotHeight }}>
        <div className="absolute inset-0 flex items-stretch gap-[3px]">
          {column.lanes.map((lane) => (
            <LaneView
              key={lane.employee.id}
              {...props}
              lane={lane}
              laneWidth={laneWidth}
              highlight={isOrigin}
            />
          ))}
          {column.process.length > 0 && (
            <div
              className="relative h-full"
              style={{ width: laneWidth }}
              aria-label="Prozesszeiten ohne Mitarbeiter"
              title="Prozesszeiten ohne Mitarbeiter"
            >
              {column.process.map((segment, i) => (
                <SegmentView
                  key={i}
                  segment={segment}
                  view={props.view}
                  pxPerMinute={pxPerMinute}
                  labels={props.labels}
                  selected={
                    "stepId" in segment &&
                    segment.stepId === props.selectedStepId
                  }
                  moved={
                    "stepId" in segment &&
                    !!props.movedStepIds?.has(segment.stepId)
                  }
                  highlight={highlightOf(segment, props.highlightStepIds)}
                  draggable={!!props.actions}
                  onSelectStep={props.onSelectStep}
                  onHover={props.onHover}
                />
              ))}
            </div>
          )}
          {hasUnassigned && (
            <div
              className="relative ml-[3px] h-full pl-[3px]"
              style={{ width: unassignedWidth + LANE_GAP }}
              aria-label="Nicht zugeordnete Arbeitsgänge"
            >
              <div className="relative h-full">
                {column.unassigned.map((segment, i) => (
                  <SegmentView
                    key={i}
                    segment={segment}
                    view={props.view}
                    pxPerMinute={pxPerMinute}
                    labels={props.labels}
                    selected={
                      "stepId" in segment &&
                      segment.stepId === props.selectedStepId
                    }
                    moved={
                      "stepId" in segment &&
                      !!props.movedStepIds?.has(segment.stepId)
                    }
                    highlight={highlightOf(segment, props.highlightStepIds)}
                    draggable={!!props.actions}
                    onSelectStep={props.onSelectStep}
                    onHover={props.onHover}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {heightLineWidth > 0 && (
          <div
            className="pointer-events-none absolute left-0 z-10 border-t-2 border-nx-blue"
            style={{ bottom: y(column.height), width: heightLineWidth }}
            aria-hidden
          >
            <span
              className={`absolute -top-5 left-0 rounded px-1 text-[11px] font-semibold tabular-nums ${
                column.filtered
                  ? "bg-secondary text-muted-foreground"
                  : column.overTakt
                    ? "bg-nx-red text-white"
                    : "bg-white text-nx-blue"
              }`}
              title={
                column.filtered
                  ? "Summe der sichtbaren Arbeitsgänge"
                  : "Stationshöhe"
              }
            >
              {formatMinutes(column.height)}
            </span>
          </div>
        )}
      </div>

      {/* E45: Die Stationsansicht beschriftet die Spuren mit „MA N“. */}
      {column.lanes.length > 0 && (
        <div className="flex gap-[3px] pt-1">
          {column.lanes.map((lane) => {
            const empty = !lane.segments.some((s) => s.kind === "step");
            const elsewhere = lane.otherStations.map((s) => s.label).join(", ");
            return (
              <span
                key={lane.employee.id}
                className={`flex items-center justify-center gap-0.5 truncate text-[11px] ${
                  lane.overTakt
                    ? "font-semibold text-destructive"
                    : "text-muted-foreground"
                }`}
                style={{ width: laneWidth }}
                title={`${lane.employee.label}: ${formatMinutes(lane.occupancy)} min${
                  elsewhere ? ` (auch an ${elsewhere})` : ""
                }`}
              >
                {lane.employee.label.replace("Mitarbeiter ", "MA ")}
                {empty && props.actions && (
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-secondary"
                    aria-label={`${lane.employee.label} an ${column.station.label} entfernen`}
                    title="Mitarbeiter ohne Arbeitsgänge entfernen"
                    onClick={() =>
                      props.actions!.onRemoveEmployee(lane.employee.id)
                    }
                  >
                    <XIcon className="size-3" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      <footer
        className={`mt-1 flex flex-col items-center border-t-2 pt-1.5 pb-2 text-center ${
          column.overTakt ? "border-nx-red" : "border-nx-blue"
        }`}
      >
        <span
          className="max-w-full truncate text-sm font-semibold"
          title={column.station.label}
        >
          {column.station.label}
        </span>
        {/* Zwei Zeilen, damit schmale Stationen nicht in die Nachbarspalte laufen. */}
        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
          {formatHeadcount(column.employeeCount)} MA
          {props.actions && (
            <button
              type="button"
              className="rounded p-0.5 hover:bg-secondary hover:text-nx-blue"
              aria-label={`Mitarbeiter an ${column.station.label} hinzufügen`}
              title="Mitarbeiter hinzufügen"
              onClick={() => props.actions!.onAddEmployee(column.station.id)}
            >
              <PlusIcon className="size-3" />
            </button>
          )}
        </span>
        {column.lanes.length > 0 && !column.filtered && (
          <span
            className={`text-[11px] whitespace-nowrap tabular-nums ${
              column.overTakt
                ? "font-semibold text-destructive"
                : "text-muted-foreground"
            }`}
            title="Stationsbelegung: Stationshöhe / Takt"
          >
            {formatPercent(column.stationUtilization)}
          </span>
        )}
      </footer>
    </section>
  );
}

/** Mitarbeiteransicht (E45): Balken je Person nebeneinander, im Vergleich nach gemeinsamer Folge. */
function EmployeeBarsBody(
  props: ChartBodyProps & { bars: readonly EmployeeBar[] },
) {
  const byKey = new Map(props.bars.map((b) => [b.key, b]));
  const slots = props.barSlots ?? props.bars;
  return (
    <div className="relative flex" style={{ gap: BAR_GAP }}>
      {slots.map((slot) => {
        const bar = byKey.get(slot.key);
        return bar ? (
          <EmployeeBarView key={bar.key} {...props} bar={bar} />
        ) : (
          <MissingStation
            key={`missing:${slot.key}`}
            kind="Balken"
            label={slot.label}
            width={barColumnWidth(props.laneWidth)}
            plotHeight={props.plotHeight}
          />
        );
      })}
    </div>
  );
}

function EmployeeBarView(
  props: Omit<ChartBodyProps, "columns"> & { bar: EmployeeBar },
) {
  const { bar, pxPerMinute, laneWidth } = props;
  const person = bar.kind === "person";
  const { setNodeRef, isOver } = useDroppable({
    id: `bar:${bar.key}`,
    data: { employeeIds: bar.employeeIds } satisfies DropData,
    disabled: !props.actions || !person,
  });
  const y = (minutes: number) => minutes * pxPerMinute;
  const takt = props.view.input.taktMin;
  const stationLabel = (id: string) => props.view.stations.get(id)!.label;
  const stations = bar.stationIds.map(stationLabel).join(", ");
  const dragging = props.draggedStep !== null;
  const name =
    bar.kind === "unassigned"
      ? "ohne Mitarbeiter"
      : bar.kind === "process"
        ? "Prozesszeiten"
        : bar.label;

  return (
    <section
      className="flex flex-col"
      style={{ width: barColumnWidth(laneWidth) }}
      aria-label={`Balken ${name}`}
    >
      <div
        className="relative flex gap-0.5"
        style={{ height: props.plotHeight }}
      >
        {/* Stationsleiste: welcher Abschnitt des Balkens zu welcher Station gehört. */}
        <div className="relative h-full" style={{ width: STRIP_WIDTH }}>
          {bar.groups.map((group, i) => {
            const height = y(group.to - group.from);
            const label = stationLabel(group.stationId);
            return (
              <div
                key={i}
                className="absolute inset-x-0 flex items-center justify-center overflow-hidden rounded-sm border-l-2 border-nx-blue bg-secondary text-[10px] font-medium text-nx-blue"
                style={{
                  bottom: y(group.from),
                  height: Math.max(1, height - 1),
                }}
                title={`Station ${label}`}
              >
                {height >= 24 && (
                  <span
                    className="whitespace-nowrap"
                    style={{ writingMode: "vertical-rl", rotate: "180deg" }}
                  >
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div
          ref={setNodeRef}
          className={`relative h-full rounded-sm outline-offset-2 transition-colors ${
            person && dragging
              ? "outline-2 outline-nx-blue/40 outline-dashed"
              : ""
          } ${person && isOver ? "bg-nx-blue/10" : ""}`}
          style={{ width: laneWidth }}
          title={
            person
              ? `${bar.label}: ${formatMinutes(bar.occupancy)} min (${stations || "ohne Station"})`
              : `${name}: ${formatMinutes(bar.occupancy)} min, nicht eingerechnet`
          }
        >
          {bar.segments.map((segment, i) => (
            <SegmentView
              key={i}
              segment={segment}
              view={props.view}
              pxPerMinute={pxPerMinute}
              labels={props.labels}
              selected={
                "stepId" in segment && segment.stepId === props.selectedStepId
              }
              moved={
                "stepId" in segment && !!props.movedStepIds?.has(segment.stepId)
              }
              highlight={highlightOf(segment, props.highlightStepIds)}
              // Prozesszeiten lassen sich keinem Mitarbeiter zuordnen (E44).
              draggable={!!props.actions && segment.kind !== "process"}
              onSelectStep={props.onSelectStep}
              onHover={props.onHover}
            />
          ))}
          {bar.groups.slice(1).map((group, i) => (
            <div
              key={i}
              className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-nx-blue"
              style={{ bottom: y(group.from) }}
              aria-hidden
            />
          ))}
          {bar.overTakt && bar.top > takt && (
            // Teil oberhalb des Takts rot markieren (F106).
            <div
              className="pointer-events-none absolute inset-x-0 z-10 border-x-2 border-t-2 border-(--yz-over) bg-(--yz-over)/15"
              style={{ bottom: y(takt), height: y(bar.top - takt) }}
              aria-hidden
            />
          )}
        </div>
        {bar.top > 0 && (
          <span
            className={`pointer-events-none absolute z-10 rounded px-1 text-[11px] font-semibold tabular-nums ${
              !person || bar.filtered
                ? "bg-secondary text-muted-foreground"
                : bar.overTakt
                  ? "bg-nx-red text-white"
                  : "bg-white text-nx-blue"
            }`}
            style={{ bottom: y(bar.top) + 2, left: STRIP_WIDTH + 2 }}
            title={
              bar.filtered
                ? "Summe der sichtbaren Arbeitsgänge"
                : person
                  ? "Belegung"
                  : "Summe, nicht eingerechnet"
            }
          >
            {formatMinutes(bar.occupancy)}
          </span>
        )}
      </div>

      <footer
        className={`mt-1 flex flex-col items-center border-t-2 pt-1.5 pb-2 text-center ${
          !person
            ? "border-dashed border-border"
            : bar.overTakt
              ? "border-nx-red"
              : "border-nx-blue"
        }`}
      >
        <span
          className={`max-w-full truncate text-sm font-semibold ${
            bar.overTakt ? "text-destructive" : ""
          }`}
          title={bar.label}
        >
          {bar.label.replace("Mitarbeiter ", "MA ")}
        </span>
        <span
          className="max-w-full truncate text-[11px] text-muted-foreground"
          title={stations}
        >
          {stations || "–"}
        </span>
        {person && !bar.filtered && (
          <span
            className={`text-[11px] whitespace-nowrap tabular-nums ${
              bar.overTakt
                ? "font-semibold text-destructive"
                : "text-muted-foreground"
            }`}
            title="Belegung / Takt"
          >
            {formatPercent(bar.occupancy / takt)}
          </span>
        )}
        {!person && (
          <span className="text-[11px] text-muted-foreground">
            nicht eingerechnet
          </span>
        )}
      </footer>
    </section>
  );
}

function LaneView(
  props: Omit<ChartBodyProps, "columns"> & {
    lane: Lane;
    laneWidth: number;
    highlight: boolean;
  },
) {
  const { lane } = props;
  const { setNodeRef, isOver } = useDroppable({
    id: `lane:${lane.employee.id}`,
    data: {
      stationId: lane.employee.stationId,
      employeeId: lane.employee.id,
    } satisfies DropData,
    disabled: !props.actions,
  });
  const takt = props.view.input.taktMin;

  return (
    <div
      ref={setNodeRef}
      className={`relative h-full ${props.highlight && isOver ? "bg-nx-blue/10" : ""}`}
      style={{ width: props.laneWidth }}
      aria-label={`${lane.employee.label}: ${formatMinutes(lane.occupancy)} min`}
    >
      {lane.segments.map((segment, i) => (
        <SegmentView
          key={i}
          segment={segment}
          view={props.view}
          pxPerMinute={props.pxPerMinute}
          labels={props.labels}
          selected={
            "stepId" in segment && segment.stepId === props.selectedStepId
          }
          moved={
            "stepId" in segment && !!props.movedStepIds?.has(segment.stepId)
          }
          highlight={highlightOf(segment, props.highlightStepIds)}
          draggable={!!props.actions}
          onSelectStep={props.onSelectStep}
          onHover={props.onHover}
        />
      ))}
      {lane.overTakt && lane.top > takt && (
        // Teil oberhalb des Takts rot markieren (F106).
        <div
          className="pointer-events-none absolute inset-x-0 z-10 border-x-2 border-t-2 border-(--yz-over) bg-(--yz-over)/15"
          style={{
            bottom: takt * props.pxPerMinute,
            height: (lane.top - takt) * props.pxPerMinute,
          }}
          aria-hidden
        />
      )}
    </div>
  );
}

interface SegmentProps {
  segment: Segment;
  view: ScenarioView;
  pxPerMinute: number;
  labels: LabelFields;
  selected: boolean;
  moved: boolean;
  highlight: "match" | "dim" | null;
  draggable: boolean;
  onSelectStep: (stepId: string) => void;
  onHover: (hover: Hover | null) => void;
}

function highlightOf(
  segment: Segment,
  matches: ReadonlySet<string> | null | undefined,
): "match" | "dim" | null {
  if (!matches) return null;
  return "stepId" in segment && matches.has(segment.stepId) ? "match" : "dim";
}

const SegmentView = memo(function SegmentView(props: SegmentProps) {
  const { segment, pxPerMinute } = props;
  const style = {
    bottom: segment.from * pxPerMinute,
    height: Math.max(1, (segment.to - segment.from) * pxPerMinute),
    ...(props.highlight === "dim" ? { opacity: 0.25 } : {}),
  };
  const minutes = segment.to - segment.from;

  if (segment.kind === "wait") {
    return (
      <div
        className="absolute inset-x-0 border-t border-white"
        style={{
          ...style,
          backgroundImage:
            "repeating-linear-gradient(135deg, var(--yz-wait) 0 4px, var(--yz-wait-stripe) 4px 5px)",
        }}
        title={`Wartezeit ${formatMinutes(minutes)} min vor ${segment.beforeStepId}`}
      />
    );
  }
  if (segment.kind === "absence") {
    return (
      <div
        className="absolute inset-x-1 border-x border-dashed border-nx-steel"
        style={style}
        title={`An anderer Station: ${formatMinutes(minutes)} min (keine Wartezeit)`}
      />
    );
  }
  if (segment.kind === "allowance") {
    return (
      <div
        className="absolute inset-x-0 flex items-center justify-center overflow-hidden border border-dashed border-nx-steel-dark bg-(--yz-allowance) text-[10px] text-muted-foreground"
        style={style}
        title={`Zuschlag ${formatMinutes(minutes)} min`}
      >
        {style.height >= 12 && "Z"}
      </div>
    );
  }
  return <StepSegment {...props} segment={segment} style={style} />;
});

/**
 * G6: deutlicher Fokus auf den Balken, weiß mit dunkelblauem Rand. Als Umriss und Pseudoelement,
 * weil Verschoben-Markierung und Suchtreffer box-shadow bzw. outline per Inline-Style setzen.
 */
const FOCUS_RING =
  "focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-nx-blue focus-visible:after:pointer-events-none focus-visible:after:absolute focus-visible:after:inset-0.5 focus-visible:after:border-2 focus-visible:after:border-white focus-visible:after:content-['']";

function StepSegment(
  props: Omit<SegmentProps, "segment"> & {
    segment: Extract<Segment, { kind: "step" | "unassigned" | "process" }>;
    style: { bottom: number; height: number; opacity?: number };
  },
) {
  const { segment, style } = props;
  const step = props.view.steps.get(segment.stepId)!;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: step.id,
    disabled: !props.draggable,
  });
  const unassigned = segment.kind === "unassigned";
  const process = segment.kind === "process";
  const category = step.categoryId
    ? props.view.categoryById.get(step.categoryId)
    : undefined;
  const parts = [
    props.labels.id &&
      chartStepId(step.id, props.view.stations.get(step.stationId)!.label),
    props.labels.description && step.description,
    props.labels.duration && formatMinutes(step.timeMin),
  ].filter(Boolean);

  const colors = props.selected
    ? { backgroundColor: "var(--yz-step-selected)", color: "#ffffff" }
    : unassigned
      ? {
          backgroundImage:
            "repeating-linear-gradient(135deg, color-mix(in srgb, var(--yz-unassigned) 35%, white) 0 5px, color-mix(in srgb, var(--yz-unassigned) 60%, white) 5px 7px)",
          color: "#003c73",
        }
      : process
        ? {
            backgroundColor: "var(--yz-process)",
            border: "1.5px dashed var(--nx-blue)",
            color: "#003c73",
          }
        : {
            backgroundColor: category?.color ?? "var(--yz-step)",
            color: category ? textColorFor(category.color) : "#003c73",
          };
  // F113/F116: verschobene Arbeitsgänge mit eigener Randfarbe und Symbol.
  const movedStyle = props.moved
    ? { boxShadow: "inset 4px 0 0 var(--yz-moved)" }
    : {};
  // E37: Suchtreffer mit kräftigem Rahmen, alles andere abgeschwächt (opacity in style).
  const matchStyle =
    props.highlight === "match"
      ? {
          outline: "2px solid var(--nx-red)",
          outlineOffset: "-2px",
          zIndex: 15,
        }
      : {};

  return (
    <button
      ref={setNodeRef}
      type="button"
      // Ohne Ziehen keine dnd-kit-Attribute: sonst meldet aria-disabled den Arbeitsgang als gesperrt,
      // obwohl er per Klick (Details) bedienbar bleibt.
      {...(props.draggable ? attributes : {})}
      {...listeners}
      className={`absolute inset-x-0 touch-none overflow-hidden border-t border-white px-0.5 text-left text-[10px] leading-[1.15] outline-none hover:brightness-95 ${FOCUS_RING} ${
        props.draggable
          ? "cursor-grab active:cursor-grabbing"
          : "cursor-pointer"
      } ${props.selected ? "z-10" : ""} ${isDragging ? "opacity-40" : ""} ${
        props.moved ? "pl-1.5" : ""
      }`}
      style={{ ...style, ...colors, ...movedStyle, ...matchStyle }}
      aria-label={`Arbeitsgang ${step.id}, ${formatMinutes(step.timeMin)} min${
        unassigned ? ", nicht zugeordnet" : process ? ", Prozesszeit" : ""
      }${props.moved ? ", verschoben" : ""}`}
      onClick={() => props.onSelectStep(step.id)}
      onPointerEnter={(e) =>
        props.onHover({ stepId: step.id, x: e.clientX, y: e.clientY })
      }
      onPointerMove={(e) =>
        props.onHover({ stepId: step.id, x: e.clientX, y: e.clientY })
      }
      onPointerLeave={() => props.onHover(null)}
    >
      {style.height >= 12 && (parts.length > 0 || props.moved) && (
        <span className="flex items-center gap-0.5 truncate">
          {props.moved && (
            <ArrowLeftRightIcon className="size-2.5 shrink-0" aria-hidden />
          )}
          <span className="truncate">{parts.join(" · ")}</span>
        </span>
      )}
    </button>
  );
}
