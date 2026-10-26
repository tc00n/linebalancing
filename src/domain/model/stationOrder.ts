import type { Station } from "./types";

const collator = new Intl.Collator("de", {
  numeric: true,
  sensitivity: "base",
});

/**
 * Natürliche Stationsreihenfolge (E14): „Station 2“ vor „Station 10“,
 * Groß-/Kleinschreibung ohne Einfluss. Gilt für die Anzeige (F32) und als
 * Flussreihenfolge der Verletzungsprüfung (E1b).
 */
export function compareStationLabels(a: string, b: string): number {
  return collator.compare(a, b);
}

/** Stationen in Flussreihenfolge; bei gleichem Rang entscheidet die ID, damit die Sortierung stabil bleibt. */
export function sortStations<T extends Station>(stations: readonly T[]): T[] {
  return [...stations].sort(
    (a, b) =>
      compareStationLabels(a.label, b.label) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
