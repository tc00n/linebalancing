"use client";

import { AlertTriangleIcon, XCircleIcon } from "lucide-react";
import { describeIssue, type ScenarioView } from "./scenario-view";

/** Konfliktübersicht (F15): Verletzungen zuerst, dann Warnungen. */
export function IssuesList(props: {
  view: ScenarioView;
  onSelectStep: (stepId: string) => void;
}) {
  const issues = [...props.view.result.issues].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "violation" ? -1 : 1,
  );
  if (issues.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Hinweise.</p>;
  }
  return (
    <ul className="flex max-h-64 flex-col divide-y overflow-y-auto text-sm">
      {issues.map((issue, i) => (
        <li key={i}>
          <button
            type="button"
            className="flex w-full items-start gap-2 px-1 py-1.5 text-left hover:bg-secondary"
            onClick={() => props.onSelectStep(issue.stepId)}
          >
            {issue.severity === "violation" ? (
              <XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            ) : (
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-warning" />
            )}
            <span className="w-20 shrink-0 font-medium">{issue.stepId}</span>
            <span>{describeIssue(issue, props.view)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
