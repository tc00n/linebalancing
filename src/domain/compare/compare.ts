import { compareStationLabels } from "../model/stationOrder";
import type { ScenarioInput } from "../model/types";

/**
 * Gemeinsame Stationsfolge zweier Szenarien, abgeglichen über die
 * Bezeichnung (F111). Fehlt eine Station auf einer Seite, bleibt dort eine
 * leere Position. Reihenfolge wie in der Einzelansicht (E14).
 */
export function alignedStationLabels(
  ...scenarios: readonly ScenarioInput[]
): string[] {
  const labels = new Map<string, string>();
  for (const scenario of scenarios) {
    for (const station of scenario.stations) {
      const key = station.label.toLocaleLowerCase("de");
      if (!labels.has(key)) labels.set(key, station.label);
    }
  }
  return [...labels.values()].sort(
    (a, b) => compareStationLabels(a, b) || (a < b ? -1 : a > b ? 1 : 0),
  );
}

/**
 * Arbeitsgänge, die im Ziel an einer anderen Station liegen als im Ist
 * (F113, F116, E15). Abgleich über Arbeitsgang-ID und Stationsbezeichnung;
 * Arbeitsgänge ohne Gegenstück zählen nicht als verschoben.
 */
export function movedStepIds(
  ist: ScenarioInput,
  ziel: ScenarioInput,
): Set<string> {
  const stationLabel = (scenario: ScenarioInput) => {
    const labels = new Map(scenario.stations.map((s) => [s.id, s.label]));
    return new Map(
      scenario.steps.map((step) => [
        step.id,
        labels.get(step.stationId)!.toLocaleLowerCase("de"),
      ]),
    );
  };
  const before = stationLabel(ist);
  const after = stationLabel(ziel);
  const moved = new Set<string>();
  for (const [id, label] of after) {
    const original = before.get(id);
    if (original !== undefined && original !== label) moved.add(id);
  }
  return moved;
}

/** Arbeitsgang-IDs, die nur in einem der beiden Szenarien vorkommen (E20). */
export function stepIdDifferences(
  a: ScenarioInput,
  b: ScenarioInput,
): { onlyInA: string[]; onlyInB: string[] } {
  const idsA = new Set(a.steps.map((s) => s.id));
  const idsB = new Set(b.steps.map((s) => s.id));
  return {
    onlyInA: [...idsA].filter((id) => !idsB.has(id)).sort(),
    onlyInB: [...idsB].filter((id) => !idsA.has(id)).sort(),
  };
}
