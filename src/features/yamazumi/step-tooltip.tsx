"use client";

import { isProcess } from "@/domain/model/types";
import {
  describeIssue,
  type ScenarioView,
} from "@/features/workspace/scenario-view";
import { formatMinutes } from "@/lib/format";

/** Tooltip mit allen relevanten Arbeitsgangdetails (F99); folgt dem Mauszeiger. */
export function StepTooltip(props: {
  view: ScenarioView;
  stepId: string;
  x: number;
  y: number;
}) {
  const { view } = props;
  const step = view.steps.get(props.stepId);
  if (!step) return null;
  const scheduled = view.scheduled.get(step.id);
  const employee = step.employeeId ? view.employees.get(step.employeeId) : null;
  const issues = view.issuesByStep.get(step.id) ?? [];

  // Rechts unten vom Zeiger, am Fensterrand nach links/oben ausweichen.
  const flipX = props.x > window.innerWidth - 340;
  const flipY = props.y > window.innerHeight - 260;

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 w-80 rounded-lg border bg-white p-3 text-xs shadow-nx"
      style={{
        left: flipX ? props.x - 332 : props.x + 14,
        top: flipY ? props.y - 14 : props.y + 14,
        transform: flipY ? "translateY(-100%)" : undefined,
      }}
    >
      <p className="font-semibold">
        {step.id} · {step.description}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-muted-foreground">Zeit</dt>
        <dd className="tabular-nums">{formatMinutes(step.timeMin)} min</dd>
        <dt className="text-muted-foreground">Station</dt>
        <dd>{view.stations.get(step.stationId)!.label}</dd>
        {isProcess(step) ? (
          <>
            <dt className="text-muted-foreground">Zeitart</dt>
            <dd>
              Prozesszeit ohne Mitarbeiter,{" "}
              {step.holdsStation
                ? "hält die Station"
                : "läuft beim Weitertakten weiter"}
            </dd>
          </>
        ) : (
          <>
            <dt className="text-muted-foreground">Mitarbeiter</dt>
            <dd>{employee?.label ?? "nicht zugeordnet"}</dd>
          </>
        )}
        {scheduled && (
          <>
            <dt className="text-muted-foreground">Start – Ende</dt>
            <dd className="tabular-nums">
              {formatMinutes(scheduled.start)} – {formatMinutes(scheduled.end)}{" "}
              min
            </dd>
          </>
        )}
        {scheduled && scheduled.waitBefore > 0 && (
          <>
            <dt className="text-muted-foreground">Wartezeit davor</dt>
            <dd className="tabular-nums">
              {formatMinutes(scheduled.waitBefore)} min
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">Vorgänger</dt>
        <dd>{step.predecessorIds.join(", ") || "keine"}</dd>
        <dt className="text-muted-foreground">Reihenfolge</dt>
        <dd className="tabular-nums">{step.sequence}</dd>
        <dt className="text-muted-foreground">Kategorie</dt>
        <dd>{view.categoryById.get(step.categoryId ?? "")?.label ?? "–"}</dd>
      </dl>
      {issues.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 border-t pt-2">
          {issues.map((issue, i) => (
            <li
              key={i}
              className={
                issue.severity === "violation"
                  ? "text-destructive"
                  : "text-warning"
              }
            >
              {describeIssue(issue, view)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
