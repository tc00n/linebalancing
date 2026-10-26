/** Kategorie eines Arbeitsgangs mit änderbarer Farbe (F27, F93, F97). */
export interface Category {
  readonly id: string;
  readonly label: string;
  /** Hexfarbe #rrggbb */
  readonly color: string;
}

export const VALUE_ADDING = "value_adding";
export const NON_VALUE_ADDING = "non_value_adding";
export const WAITING = "waiting";

/** Feste Standardkategorien (F93, F97); importierte Arbeitsgänge starten als wertschöpfend (E11). */
export function defaultCategories(): Category[] {
  return [
    { id: VALUE_ADDING, label: "Wertschöpfend", color: "#7fb3ae" },
    { id: NON_VALUE_ADDING, label: "Nicht wertschöpfend", color: "#bcccda" },
    { id: WAITING, label: "Wartezeit", color: "#c4b5fd" },
  ];
}

export const DEFAULT_CATEGORY_ID = VALUE_ADDING;

/** Lesbare Schriftfarbe (NEONEX Blau oder Weiß) für eine Hintergrundfarbe. */
export function textColorFor(background: string): "#003c73" | "#ffffff" {
  const hex = background.replace("#", "");
  const [r, g, b] = [0, 2, 4].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const linear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const luminance =
    0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return luminance > 0.3 ? "#003c73" : "#ffffff";
}
