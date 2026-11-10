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

/** Mitarbeiterzahl; Springer anteilig (E40), z. B. „2“ oder „1,4“. */
export function formatHeadcount(value: number): string {
  return axis.format(roundHalfUp(value));
}

/**
 * ID für die Balkenbeschriftung: „T19-AA010A“ an Station „T19“ → „AA010A“ (G3).
 * Die Station steht ohnehin unter der Spalte; Tooltip, Panel und Tabelle zeigen die volle ID.
 * Liegt der Arbeitsgang an einer anderen Station, bleibt die volle ID stehen.
 */
export function chartStepId(stepId: string, stationLabel: string): string {
  const rest = stepId.slice(stationLabel.length);
  if (!stepId.startsWith(stationLabel) || !/^[-_ .:/]./.test(rest)) {
    return stepId;
  }
  return rest.slice(1);
}

/**
 * ID in einen schmalen Balken einpassen (U3): Arbeitsgänge einer Linie unterscheiden sich am Ende
 * („AA010“, „AA020“), daher wird vorn gekürzt. Unter zwei Zeichen bleibt die Beschriftung leer.
 */
export function fitStepId(id: string, maxChars: number): string {
  if (id.length <= maxChars) return id;
  if (maxChars < 2) return "";
  if (maxChars === 2) return id.slice(-2);
  return `…${id.slice(-(maxChars - 1))}`;
}

/**
 * Beschriftung eines Arbeitsgangs aus den gewählten Feldern (ID, Text, Dauer), passend zur
 * Spurbreite (U3): Passt nicht alles, hat die unterscheidbare ID Vorrang. Mit Text wird hinten
 * abgeschnitten, solange die ID vollständig sichtbar bleibt.
 */
export function segmentLabel(
  parts: { id?: string; description?: string; duration?: string },
  maxChars: number,
): string {
  const full = [parts.id, parts.description, parts.duration]
    .filter(Boolean)
    .join(" · ");
  if (full.length <= maxChars || !parts.id) return full;
  if (parts.description && parts.id.length + 4 <= maxChars) return full;
  return fitStepId(parts.id, maxChars);
}

/** „Mitarbeiter 17“ je nach Platz als „MA 17“ oder „17“ (U2, U3); andere Namen mit Auslassung. */
export function employeeShortLabel(label: string, maxChars: number): string {
  const number = /^Mitarbeiter (\S+)$/.exec(label)?.[1];
  if (number) {
    const short = `MA ${number}`;
    if (short.length <= maxChars) return short;
    return number.length <= maxChars ? number : "";
  }
  if (label.length <= maxChars) return label;
  return maxChars >= 2 ? `${label.slice(0, maxChars - 1)}…` : "";
}

/** Zeichen, die bei gegebener Schriftgröße in eine Breite passen (Mittelwert für Inter, Ziffern). */
export function charsThatFit(widthPx: number, fontPx: number): number {
  return Math.max(0, Math.floor(widthPx / (fontPx * 0.6)));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
