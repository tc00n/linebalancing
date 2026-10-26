import type { Step } from "./types";

const idCollator = new Intl.Collator("de", { numeric: true });

/**
 * Feste Ordnung von Arbeitsgängen: kleinere `Reihenfolge` zuerst, dann
 * Arbeitsgang-ID natürlich sortiert. Dient als Gleichstandsregel der
 * Listenplanung (E3) und macht alle Ergebnislisten unabhängig von der
 * Eingabereihenfolge.
 */
export function compareSteps(
  a: Pick<Step, "id" | "sequence">,
  b: Pick<Step, "id" | "sequence">,
): number {
  if (a.sequence !== b.sequence) return a.sequence - b.sequence;
  // Rückfall auf Codepunkte, falls der Collator verschiedene IDs gleichsetzt („01“/„1“).
  return (
    idCollator.compare(a.id, b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
