import { compareStationLabels } from "../model/stationOrder";
import { isUnassigned, type ScenarioInput } from "../model/types";

/**
 * Hinweise für Konfliktübersicht und Warnungen (docs/RECHENREGELN.md, Abschnitt 6).
 * Keine dieser Prüfungen blockiert eine Änderung (F8/F15).
 * `violation` kennzeichnet das Szenario als konfliktbehaftet.
 */
export type Issue =
  | {
      readonly kind: "step_unassigned";
      readonly severity: "warning";
      readonly stepId: string;
    }
  | {
      readonly kind: "predecessor_unassigned";
      readonly severity: "warning";
      readonly stepId: string;
      readonly predecessorId: string;
    }
  | {
      readonly kind: "predecessor_downstream";
      readonly severity: "violation";
      readonly stepId: string;
      readonly predecessorId: string;
    };

export function findIssues(input: ScenarioInput): Issue[] {
  const steps = new Map(input.steps.map((s) => [s.id, s]));
  const stationLabel = new Map(input.stations.map((s) => [s.id, s.label]));
  const issues: Issue[] = [];

  for (const step of input.steps) {
    if (isUnassigned(step)) {
      issues.push({
        kind: "step_unassigned",
        severity: "warning",
        stepId: step.id,
      });
    }

    for (const predecessorId of step.predecessorIds) {
      const predecessor = steps.get(predecessorId)!;

      if (predecessor.stationId === step.stationId) {
        // E4: nur ein Vorgänger derselben Station beeinflusst den Start (E1a).
        if (!isUnassigned(step) && isUnassigned(predecessor)) {
          issues.push({
            kind: "predecessor_unassigned",
            severity: "warning",
            stepId: step.id,
            predecessorId,
          });
        }
        continue;
      }

      // E1b/E14: Vorgänger an einer in der Flussreihenfolge späteren Station.
      const order = compareStationLabels(
        stationLabel.get(predecessor.stationId)!,
        stationLabel.get(step.stationId)!,
      );
      if (order > 0) {
        issues.push({
          kind: "predecessor_downstream",
          severity: "violation",
          stepId: step.id,
          predecessorId,
        });
      }
    }
  }

  return issues;
}
