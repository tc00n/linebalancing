import { findIssues } from "../checks/issues";
import type { ScenarioInput } from "../model/types";

/**
 * Verletzungen von Vorgängerbeziehungen, die das Verschieben eines
 * Arbeitsgangs an eine Station auslösen würde (F129: fachlich problematische
 * Ziele beim Ziehen gesondert kennzeichnen). Blockiert nichts (F8).
 */
export function violationsAfterMove(
  input: ScenarioInput,
  stepId: string,
  stationId: string,
): string[] {
  const moved: ScenarioInput = {
    ...input,
    steps: input.steps.map((s) =>
      s.id === stepId ? { ...s, stationId, employeeId: null } : s,
    ),
  };
  return findIssues(moved).flatMap((i) =>
    i.kind === "predecessor_downstream" &&
    (i.stepId === stepId || i.predecessorId === stepId)
      ? [`${i.predecessorId} → ${i.stepId}`]
      : [],
  );
}
