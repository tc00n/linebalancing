"use client";

import { AlertTriangleIcon, LockIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMinutes } from "@/lib/format";
import { describeIssue, type ScenarioView } from "./scenario-view";

/**
 * Detailpanel als Overlay rechts über dem Diagramm (F33, F123, F126).
 * Nicht modal, damit das Diagramm bedienbar bleibt. Vorerst nur lesend;
 * importierte Zeiten bleiben auch später schreibgeschützt (F17, F127).
 */
export function DetailPanel(props: {
  view: ScenarioView;
  stepId: string;
  onClose: () => void;
  onSelectStep: (stepId: string) => void;
}) {
  const { view } = props;
  const step = view.steps.get(props.stepId);
  if (!step) return null;
  const scheduled = view.scheduled.get(step.id);
  const employee = step.employeeId ? view.employees.get(step.employeeId) : null;
  const issues = view.issuesByStep.get(step.id) ?? [];
  const successors = view.successors.get(step.id) ?? [];

  return (
    <aside
      className="fixed top-14 right-0 bottom-0 z-40 flex w-full max-w-sm flex-col border-l bg-white shadow-nx"
      aria-label={`Details zu Arbeitsgang ${step.id}`}
    >
      <header className="flex items-start gap-2 border-b p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Arbeitsgang</p>
          <h2 className="truncate text-lg font-semibold">{step.id}</h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={props.onClose}
          aria-label="Detailpanel schließen"
        >
          <XIcon />
        </Button>
      </header>

      <div className="flex flex-col gap-4 overflow-y-auto p-4 text-sm">
        <p>{step.description}</p>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-muted-foreground">Zeit</dt>
          <dd className="tabular-nums">
            {formatMinutes(step.timeMin)} min
            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <LockIcon className="size-3" aria-hidden />
              importiert, schreibgeschützt
            </span>
          </dd>
          <dt className="text-muted-foreground">Station</dt>
          <dd>{view.stations.get(step.stationId)!.label}</dd>
          <dt className="text-muted-foreground">Mitarbeiter</dt>
          <dd>
            {employee ? (
              employee.label
            ) : (
              <span className="font-medium text-warning">nicht zugeordnet</span>
            )}
          </dd>
          <dt className="text-muted-foreground">Reihenfolge</dt>
          <dd className="tabular-nums">{step.sequence}</dd>
          {scheduled && (
            <>
              <dt className="text-muted-foreground">Start – Ende</dt>
              <dd className="tabular-nums">
                {formatMinutes(scheduled.start)} –{" "}
                {formatMinutes(scheduled.end)} min
              </dd>
              <dt className="text-muted-foreground">Wartezeit davor</dt>
              <dd className="tabular-nums">
                {formatMinutes(scheduled.waitBefore)} min
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">Vorgänger</dt>
          <dd>
            <StepLinks
              ids={step.predecessorIds}
              onSelect={props.onSelectStep}
            />
          </dd>
          <dt className="text-muted-foreground">Nachfolger</dt>
          <dd>
            <StepLinks ids={successors} onSelect={props.onSelectStep} />
          </dd>
        </dl>

        <section>
          <h3 className="mb-1.5 text-xs font-semibold tracking-wide uppercase">
            Hinweise
          </h3>
          {issues.length === 0 ? (
            <p className="text-muted-foreground">Keine Warnungen.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {issues.map((issue, i) => (
                <li
                  key={i}
                  className={`flex gap-1.5 ${
                    issue.severity === "violation"
                      ? "text-destructive"
                      : "text-warning"
                  }`}
                >
                  <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                  {describeIssue(issue, view)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}

function StepLinks(props: {
  ids: readonly string[];
  onSelect: (id: string) => void;
}) {
  if (props.ids.length === 0)
    return <span className="text-muted-foreground">keine</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {props.ids.map((id) => (
        <button
          key={id}
          type="button"
          className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium hover:bg-nx-steel"
          onClick={() => props.onSelect(id)}
        >
          {id}
        </button>
      ))}
    </span>
  );
}
