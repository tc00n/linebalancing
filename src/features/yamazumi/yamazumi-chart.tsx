"use client";

import { memo, useCallback, useState } from "react";
import type { ScenarioView } from "@/features/workspace/scenario-view";
import { formatAxis, formatMinutes, formatPercent } from "@/lib/format";
import {
  axisMaximum,
  axisTicks,
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
}

const AXIS_WIDTH = 64;
const HEADROOM_PX = 28;
const LANE_GAP = 3;

interface Hover {
  readonly stepId: string;
  readonly x: number;
  readonly y: number;
}

/**
 * Yamazumi mit horizontal scrollbaren Stationen (F91), Taktlinie (F94),
 * Mitarbeiterspuren (E9), Wartezeit- und Zuschlagssegmenten (F63, F66, E2)
 * und separater Warnspur für nicht zugeordnete Schritte (F67, E10).
 */
export function YamazumiChart(props: YamazumiChartProps) {
  const [hover, setHover] = useState<Hover | null>(null);
  const onHover = useCallback((next: Hover | null) => setHover(next), []);

  const takt = props.view.input.taktMin;
  const ticks = axisTicks(axisMaximum(props.columns, takt) * 1.04);
  const top = Math.max(ticks.at(-1)!, axisMaximum(props.columns, takt));
  const plotHeight = top * props.pxPerMinute + HEADROOM_PX;
  const y = (minutes: number) => minutes * props.pxPerMinute;

  return (
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
            onHover={onHover}
          />
        </div>
      </div>

      {hover && <StepTooltip view={props.view} {...hover} />}
    </div>
  );
}

interface ChartBodyProps extends Omit<YamazumiChartProps, "columns"> {
  readonly columns: readonly StationColumn[];
  readonly plotHeight: number;
  readonly onHover: (hover: Hover | null) => void;
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
        />
      ))}
    </div>
  );
});

function StationColumnView(
  props: Omit<ChartBodyProps, "columns"> & { column: StationColumn },
) {
  const { column, laneWidth, pxPerMinute, mode } = props;
  const y = (minutes: number) => minutes * pxPerMinute;
  const unassignedWidth = Math.max(14, Math.round(laneWidth * 0.8));
  const hasUnassigned = column.unassigned.length > 0;
  const lanesWidth =
    column.lanes.length * laneWidth +
    Math.max(0, column.lanes.length - 1) * LANE_GAP;
  const width = Math.max(
    56,
    lanesWidth + (hasUnassigned ? LANE_GAP * 2 + unassignedWidth : 0),
  );

  return (
    <section
      className="flex flex-col"
      style={{ width }}
      aria-label={`Station ${column.station.label}`}
    >
      <div className="relative" style={{ height: props.plotHeight }}>
        <div className="absolute inset-0 flex items-stretch gap-[3px]">
          {column.lanes.map((lane) => (
            <div
              key={lane.employee.id}
              className="relative h-full"
              style={{ width: laneWidth }}
              aria-label={`${lane.employee.label}: ${formatMinutes(lane.occupancy)} min`}
            >
              {lane.segments.map((segment, i) => (
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
              {lane.overTakt && (
                // Teil oberhalb des Takts rot markieren (F106).
                <div
                  className="pointer-events-none absolute inset-x-0 z-10 border-x-2 border-t-2 border-(--yz-over) bg-(--yz-over)/15"
                  style={{
                    bottom: y(props.view.input.taktMin),
                    height: y(lane.occupancy - props.view.input.taktMin),
                  }}
                  aria-hidden
                />
              )}
            </div>
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
          {column.lanes.map((lane) => (
            <span
              key={lane.employee.id}
              className={`truncate text-center text-[11px] ${
                lane.overTakt
                  ? "font-semibold text-destructive"
                  : "text-muted-foreground"
              }`}
              style={{ width: laneWidth }}
              title={`${lane.employee.label}: ${formatMinutes(lane.occupancy)} min`}
            >
              {lane.employee.label.replace("Mitarbeiter ", "MA ")}
            </span>
          ))}
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
        <span className="text-[11px] text-muted-foreground">
          {column.lanes.length} MA
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

  const step = props.view.steps.get(segment.stepId)!;
  const parts = [
    props.labels.id && step.id,
    props.labels.description && step.description,
    props.labels.duration && formatMinutes(step.timeMin),
  ].filter(Boolean);
  const unassigned = segment.kind === "unassigned";

  return (
    <button
      type="button"
      className={`absolute inset-x-0 overflow-hidden border-t px-0.5 text-left text-[10px] leading-[1.15] outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        props.selected
          ? "z-10 border-white bg-(--yz-step-selected) text-white"
          : unassigned
            ? "border-white text-nx-blue"
            : "border-white bg-(--yz-step) text-nx-blue hover:brightness-95"
      }`}
      style={{
        ...style,
        ...(unassigned && !props.selected
          ? {
              backgroundImage:
                "repeating-linear-gradient(135deg, color-mix(in srgb, var(--yz-unassigned) 35%, white) 0 5px, color-mix(in srgb, var(--yz-unassigned) 60%, white) 5px 7px)",
            }
          : {}),
      }}
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
});
