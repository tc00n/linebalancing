import type { ScenarioResult } from "@/domain/calc/evaluate";
import type { ScheduledStep } from "@/domain/calc/schedule";
import type { Issue } from "@/domain/checks/issues";
import type { Category } from "@/domain/model/categories";
import type {
  Employee,
  ScenarioInput,
  Station,
  Step,
} from "@/domain/model/types";

/** Nachschlagetabellen für Diagramm, Tooltip und Detailpanel. */
export interface ScenarioView {
  readonly input: ScenarioInput;
  readonly result: ScenarioResult;
  readonly steps: ReadonlyMap<string, Step>;
  readonly stations: ReadonlyMap<string, Station>;
  readonly employees: ReadonlyMap<string, Employee>;
  readonly scheduled: ReadonlyMap<string, ScheduledStep>;
  readonly successors: ReadonlyMap<string, readonly string[]>;
  readonly issuesByStep: ReadonlyMap<string, readonly Issue[]>;
  readonly categories: readonly Category[];
  readonly categoryById: ReadonlyMap<string, Category>;
}

export function createScenarioView(
  input: ScenarioInput,
  result: ScenarioResult,
  categories: readonly Category[],
): ScenarioView {
  const successors = new Map<string, string[]>();
  for (const step of input.steps) {
    for (const p of step.predecessorIds) {
      successors.set(p, [...(successors.get(p) ?? []), step.id]);
    }
  }
  const issuesByStep = new Map<string, Issue[]>();
  for (const issue of result.issues) {
    issuesByStep.set(issue.stepId, [
      ...(issuesByStep.get(issue.stepId) ?? []),
      issue,
    ]);
  }
  return {
    input,
    result,
    steps: new Map(input.steps.map((s) => [s.id, s])),
    stations: new Map(input.stations.map((s) => [s.id, s])),
    employees: new Map(input.employees.map((e) => [e.id, e])),
    scheduled: new Map(
      result.employees.flatMap((e) => e.steps).map((s) => [s.stepId, s]),
    ),
    successors,
    issuesByStep,
    categories,
    categoryById: new Map(categories.map((c) => [c.id, c])),
  };
}

export function describeIssue(issue: Issue, view: ScenarioView): string {
  switch (issue.kind) {
    case "step_unassigned":
      return "Kein Mitarbeiter zugeordnet. Der Arbeitsgang ist in keiner Zeit und Kennzahl enthalten.";
    case "predecessor_unassigned":
      return `Startzeit unsicher: Vorgänger ${issue.predecessorId} ist keinem Mitarbeiter zugeordnet.`;
    case "predecessor_downstream": {
      const station = (id: string) =>
        view.stations.get(view.steps.get(id)!.stationId)!.label;
      return `Vorgänger ${issue.predecessorId} liegt an Station ${station(issue.predecessorId)}, die im Fluss nach ${station(issue.stepId)} kommt.`;
    }
  }
}
