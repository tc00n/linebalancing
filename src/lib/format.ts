import { roundHalfUp, roundPercent } from "@/domain/calc/rounding";

// Ausgabe im deutschen Format, gerundet erst hier (P2, E34).

const twoDecimals = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Minuten mit zwei Nachkommastellen, z. B. „4,85“. */
export function formatMinutes(value: number): string {
  return twoDecimals.format(roundHalfUp(value));
}

/** Verhältnis als Prozent, z. B. 1.01875 → „101,88 %“. */
export function formatPercent(ratio: number | null): string {
  if (ratio === null) return "–";
  return `${twoDecimals.format(roundPercent(ratio))} %`;
}

const axis = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

/** Achsenbeschriftung ohne überflüssige Nullen, z. B. „0,5“, „2“. */
export function formatAxis(value: number): string {
  return axis.format(roundHalfUp(value));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
