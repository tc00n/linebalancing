import { findIssues } from "../checks/issues";
import { groupMembersOf } from "../model/groups";
import type { ScenarioInput } from "../model/types";
import { applyOperation } from "./operations";

/**
 * Verletzungen von Vorgängerbeziehungen, die das Verschieben eines
 * Arbeitsgangs an eine Station auslösen würde (F129: fachlich problematische
 * Ziele beim Ziehen gesondert kennzeichnen). Blockiert nichts (F8).
 * Die übrigen Zeilen seiner Gruppe ziehen mit (E42) und zählen mit.
 */
export function violationsAfterMove(
  input: ScenarioInput,
  stepId: string,
  stationId: string,
): string[] {
  const step = input.steps.find((s) => s.id === stepId);
  if (!step) return [];
  const result = applyOperation(
    { input, categories: [] },
    { type: "moveStep", stepId, stationId },
  );
  if (!result.ok) return [];
  const moved = new Set([
    stepId,
    ...groupMembersOf(input.steps, step).map((s) => s.id),
  ]);
  return findIssues(result.scenario.input).flatMap((i) =>
    i.kind === "predecessor_downstream" &&
    (moved.has(i.stepId) || moved.has(i.predecessorId))
      ? [`${i.predecessorId} → ${i.stepId}`]
      : [],
  );
}

/**
 * Rückfrage vor dem Verschieben (E50): Text für die Bestätigung, wenn der
 * Stationswechsel Vorgängerbeziehungen verletzen würde, sonst null.
 */
export function moveWarning(
  input: ScenarioInput,
  stepId: string,
  stationId: string,
): string | null {
  const step = input.steps.find((s) => s.id === stepId);
  const station = input.stations.find((s) => s.id === stationId);
  if (!step || !station || step.stationId === stationId) return null;
  const violations = violationsAfterMove(input, stepId, stationId);
  if (violations.length === 0) return null;
  const others = groupMembersOf(input.steps, step)
    .filter((s) => s.id !== stepId)
    .map((s) => s.id);
  const subject = others.length
    ? `${stepId} mit ${others.join(", ")} (Gruppe „${step.groupId}“)`
    : stepId;
  return (
    `Wenn ${subject} an Station ${station.label} verschoben wird, ` +
    `sind diese Vorgängerbeziehungen verletzt:\n${violations.join("\n")}` +
    "\n\nTrotzdem verschieben?"
  );
}
