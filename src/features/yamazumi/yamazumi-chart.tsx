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
import { PlusIcon, XIcon } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { textColorFor } from "@/domain/model/categories";
import { violationsAfterMove } from "@/domain/ops/movePreview";
import type { ScenarioView } from "@/features/workspace/scenario-view";
import { formatAxis, formatMinutes, formatPercent } from "@/lib/format";
import {
  axisMaximum,
  axisTicks,
  type Lane,
  type Segment,
  type StationColumn,
} from "./layout";
import { StepTooltip } from "./step-tooltip";

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
  /** Breite einer Mitarbeiterspur in der Stationsansicht (F98). */
  readonly laneWidth: number;
  /** Zeitskala in Pixel je Minute (F98). */
  readonly pxPerMinute: number;
  readonly labels: LabelFields;
  readonly selectedStepId: string | null;
  readonly onSelectStep: (stepId: string) => void;
  readonly actions: ChartActions;
}

const AXIS_WIDTH = 64;
const HEADROOM_PX = 28;
const LANE_GAP = 3;

interface Hover {
  readonly stepId: string;
  readonly x: number;
  readonly y: number;
}

interface DropData {
  readonly stationId: string;
  readonly employeeId?: string;
}

/** Eine Mitarbeiterspur hat Vorrang vor der Station, in der sie liegt. */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const lane = hits.find((h) => String(h.id).startsWith("lane:"));
  return lane
    ? [lane]
    : hits.filter((h) => String(h.id).startsWith("station:"));
};

/**
 * Yamazumi mit horizontal scrollbaren Stationen (F91), Taktlinie (F94),
 * Mitarbeiterspuren (E9), Wartezeit- und Zuschlagssegmenten (F63, F66, E2),
 * separater Warnspur für nicht zugeordnete Schritte (F67, E10) und
 * Drag-and-drop zwischen Stationen ohne Dialog (F28, F95).
 */
export function YamazumiChart(props: YamazumiChartProps) {
  const [hover, setHover] = useState<Hover | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const onHover = useCallback((next: Hover | null) => setHover(next), []);
  const sensors = useSensors(
    // Ab 6 px Bewegung beginnt das Ziehen; ein Klick wählt weiterhin aus.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // F129: alle Ziele markieren, problematische gesondert.
  const dropWarnings = useMemo(() => {
    if (!draggingId) return null;
    return new Map(
      props.view.input.stations.map((s) => [
        s.id,
        violationsAfterMove(props.view.input, draggingId, s.id),
      ]),
    );
  }, [draggingId, props.view.input]);

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const stepId = String(event.active.id);
    const target = event.over?.data.current as DropData | undefined;
    const step = props.view.steps.get(stepId);
    if (!target || !step) return;
    if (target.stationId !== step.stationId) {
      // F61: Stationswechsel, Mitarbeiter wird bewusst danach zugewiesen.
      props.actions.onMoveStep(stepId, target.stationId);
    } else if (target.employeeId && target.employeeId !== step.employeeId) {
      props.actions.onAssignEmployee(stepId, target.employeeId);
    }
  }

  const takt = props.view.input.taktMin;
  const ticks = axisTicks(axisMaximum(props.columns, takt) * 1.04);
  const top = Math.max(ticks.at(-1)!, axisMaximum(props.columns, takt));
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

        <div className="relative min-w-0 flex-1 overflow-x-auto">
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
              view={props.view}
              columns={props.columns}
              mode={props.mode}
              laneWidth={props.laneWidth}
              pxPerMinute={props.pxPerMinute}
              plotHeight={plotHeight}
              labels={props.labels}
              selectedStepId={props.selectedStepId}
              onSelectStep={props.onSelectStep}
              actions={props.actions}
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

interface ChartBodyProps extends YamazumiChartProps {
  readonly plotHeight: number;
  readonly onHover: (hover: Hover | null) => void;
  readonly draggedStep: { id: string; stationId: string } | null;
  readonly dropWarnings: ReadonlyMap<string, string[]> | null;
}

const ChartBody = memo(function ChartBody(props: ChartBodyProps) {
  const laneWidth =
    props.mode === "employee"
      ? Math.round(props.laneWidth * 2.2)
      : props.laneWidth;

  return (
    <div className="relative flex gap-6">
      {props.columns.map((column) => (
        <StationColumnView
          key={column.station.id}
          {...props}
          column={column}
          laneWidth={laneWidth}
          warnings={props.dropWarnings?.get(column.station.id) ?? null}
        />
      ))}
    </div>
  );
});

function StationColumnView(
  props: Omit<ChartBodyProps, "columns"> & {
    column: StationColumn;
    warnings: string[] | null;
  },
) {
  const { column, laneWidth, pxPerMinute, mode, warnings } = props;
  const { setNodeRef, isOver } = useDroppable({
    id: `station:${column.station.id}`,
    data: { stationId: column.station.id } satisfies DropData,
  });
  const y = (minutes: number) => minutes * pxPerMinute;
  const unassignedWidth = Math.max(14, Math.round(laneWidth * 0.8));
  const hasUnassigned = column.unassigned.length > 0;
  const lanesWidth =
    column.lanes.length * laneWidth +
    Math.max(0, column.lanes.length - 1) * LANE_GAP;
  const width = Math.max(
    64,
    lanesWidth + (hasUnassigned ? LANE_GAP * 2 + unassignedWidth : 0),
  );
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
                    onSelectStep={props.onSelectStep}
                    onHover={props.onHover}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {column.lanes.length > 0 && (
          <div
            className="pointer-events-none absolute left-0 z-10 border-t-2 border-nx-blue"
            style={{ bottom: y(column.height), width: lanesWidth }}
            aria-hidden
          >
            <span
              className={`absolute -top-5 left-0 rounded px-1 text-[11px] font-semibold tabular-nums ${
                column.overTakt
                  ? "bg-nx-red text-white"
                  : "bg-white text-nx-blue"
              }`}
            >
              {formatMinutes(column.height)}
            </span>
          </div>
        )}
      </div>

      {mode === "employee" && column.lanes.length > 0 && (
        <div className="flex gap-[3px] pt-1">
          {column.lanes.map((lane) => {
            const empty = !lane.segments.some((s) => s.kind === "step");
            return (
              <span
                key={lane.employee.id}
                className={`flex items-center justify-center gap-0.5 truncate text-[11px] ${
                  lane.overTakt
                    ? "font-semibold text-destructive"
                    : "text-muted-foreground"
                }`}
                style={{ width: laneWidth }}
                title={`${lane.employee.label}: ${formatMinutes(lane.occupancy)} min`}
              >
                {lane.employee.label.replace("Mitarbeiter ", "MA ")}
                {empty && (
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-secondary"
                    aria-label={`${lane.employee.label} an ${column.station.label} entfernen`}
                    title="Mitarbeiter ohne Arbeitsgänge entfernen"
                    onClick={() =>
                      props.actions.onRemoveEmployee(lane.employee.id)
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
          {column.lanes.length} MA
          <button
            type="button"
            className="rounded p-0.5 hover:bg-secondary hover:text-nx-blue"
            aria-label={`Mitarbeiter an ${column.station.label} hinzufügen`}
            title="Mitarbeiter hinzufügen"
            onClick={() => props.actions.onAddEmployee(column.station.id)}
          >
            <PlusIcon className="size-3" />
          </button>
        </span>
        {column.lanes.length > 0 && (
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
          onSelectStep={props.onSelectStep}
          onHover={props.onHover}
        />
      ))}
      {lane.overTakt && (
        // Teil oberhalb des Takts rot markieren (F106).
        <div
          className="pointer-events-none absolute inset-x-0 z-10 border-x-2 border-t-2 border-(--yz-over) bg-(--yz-over)/15"
          style={{
            bottom: takt * props.pxPerMinute,
            height: (lane.occupancy - takt) * props.pxPerMinute,
          }}
          aria-hidden
        />
      )}
    </div>
  );
}

const SegmentView = memo(function SegmentView(props: {
  segment: Segment;
  view: ScenarioView;
  pxPerMinute: number;
  labels: LabelFields;
  selected: boolean;
  onSelectStep: (stepId: string) => void;
  onHover: (hover: Hover | null) => void;
}) {
  const { segment, pxPerMinute } = props;
  const style = {
    bottom: segment.from * pxPerMinute,
    height: Math.max(1, (segment.to - segment.from) * pxPerMinute),
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

function StepSegment(props: {
  segment: Extract<Segment, { kind: "step" | "unassigned" }>;
  style: { bottom: number; height: number };
  view: ScenarioView;
  labels: LabelFields;
  selected: boolean;
  onSelectStep: (stepId: string) => void;
  onHover: (hover: Hover | null) => void;
}) {
  const { segment, style } = props;
  const step = props.view.steps.get(segment.stepId)!;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: step.id,
  });
  const unassigned = segment.kind === "unassigned";
  const category = step.categoryId
    ? props.view.categoryById.get(step.categoryId)
    : undefined;
  const parts = [
    props.labels.id && step.id,
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
      : {
          backgroundColor: category?.color ?? "var(--yz-step)",
          color: category ? textColorFor(category.color) : "#003c73",
        };

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      className={`absolute inset-x-0 cursor-grab touch-none overflow-hidden border-t border-white px-0.5 text-left text-[10px] leading-[1.15] outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing ${
        props.selected ? "z-10" : ""
      } ${isDragging ? "opacity-40" : ""}`}
      style={{ ...style, ...colors }}
      aria-label={`Arbeitsgang ${step.id}, ${formatMinutes(step.timeMin)} min${
        unassigned ? ", nicht zugeordnet" : ""
      }`}
      onClick={() => props.onSelectStep(step.id)}
      onPointerEnter={(e) =>
        props.onHover({ stepId: step.id, x: e.clientX, y: e.clientY })
      }
      onPointerMove={(e) =>
        props.onHover({ stepId: step.id, x: e.clientX, y: e.clientY })
      }
      onPointerLeave={() => props.onHover(null)}
    >
      {style.height >= 12 && parts.length > 0 && (
        <span className="block truncate">{parts.join(" · ")}</span>
      )}
    </button>
  );
}
