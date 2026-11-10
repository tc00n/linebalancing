import type { ScenarioInput } from "@/domain/model/types";
import { formatAxis } from "@/lib/format";

/**
 * U13: Was der Verteilungsvorschlag an einer Station ändert, je Arbeitsgang in Werkstattsprache
 * („C: Mitarbeiter 2 → Mitarbeiter 1“), damit das Ergebnis im Workshop erklärt werden kann.
 */
export function describeChanges(
  before: ScenarioInput,
  after: ScenarioInput,
  stationId: string,
): string[] {
  const label = (input: ScenarioInput, id: string | null) =>
    id === null
      ? "ohne Mitarbeiter"
      : (input.employees.find((e) => e.id === id)?.label ?? id);
  const previous = new Map(before.steps.map((s) => [s.id, s]));
  const lines: string[] = [];
  for (const step of after.steps) {
    const old = previous.get(step.id);
    if (!old || step.stationId !== stationId) continue;
    const parts: string[] = [];
    const from = label(before, old.employeeId);
    const to = label(after, step.employeeId);
    if (from !== to) parts.push(`${from} → ${to}`);
    if (old.sequence !== step.sequence)
      parts.push(
        `Reihenfolge ${formatAxis(old.sequence)} → ${formatAxis(step.sequence)}`,
      );
    if (parts.length) lines.push(`${step.id}: ${parts.join(", ")}`);
  }
  return lines;
}
