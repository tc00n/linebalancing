import { roundHalfUp } from "../calc/rounding";

/** Zellwert nach dem Einlesen: Text, Zahl oder leer. */
export type CellValue = string | number | null;

export function isBlank(value: CellValue): boolean {
  return value === null || (typeof value === "string" && value.trim() === "");
}

export function cellText(value: CellValue): string {
  if (value === null) return "";
  return typeof value === "number" ? String(value) : value.trim();
}

const GERMAN_DECIMAL = /^-?\d+(,\d+)?$/;

/**
 * Zahl aus Zahlzelle oder Text im deutschen Format mit Dezimalkomma (F80).
 * Punkte (Tausender- oder englischer Dezimalpunkt) werden bewusst abgelehnt,
 * damit „1.250“ nicht stillschweigend falsch gelesen wird.
 */
export function parseGermanNumber(
  value: CellValue,
): { ok: true; value: number } | { ok: false; reason: "missing" | "format" } {
  if (isBlank(value)) return { ok: false, reason: "missing" };
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { ok: true, value }
      : { ok: false, reason: "format" };
  }
  const text = value!.trim();
  if (!GERMAN_DECIMAL.test(text)) return { ok: false, reason: "format" };
  return { ok: true, value: Number(text.replace(",", ".")) };
}

export type ParsedTime =
  | { ok: true; value: number; original: number; rounded: boolean }
  | { ok: false; reason: "missing" | "format" | "not_positive" };

/**
 * Arbeitszeit in Minuten (F73, F80, F81, F84, F85). Mehr als zwei
 * Nachkommastellen werden kaufmännisch gerundet und als gerundet gemeldet (E21).
 */
export function parseTime(value: CellValue): ParsedTime {
  const parsed = parseGermanNumber(value);
  if (!parsed.ok) return parsed;
  const rounded = roundHalfUp(parsed.value, 2);
  if (rounded <= 0) return { ok: false, reason: "not_positive" };
  return {
    ok: true,
    value: rounded,
    original: parsed.value,
    rounded: rounded !== parsed.value,
  };
}

const EMPLOYEE = /^mitarbeiter\s*0*(\d+)$/i;

/** „Mitarbeiter 1“ … in normierter Schreibweise (F68, F75); null bei anderem Text. */
export function normalizeEmployee(value: CellValue): string | null {
  const match = EMPLOYEE.exec(cellText(value).replace(/\s+/g, " "));
  if (!match || Number(match[1]) < 1) return null;
  return `Mitarbeiter ${Number(match[1])}`;
}

/** Vorgänger-IDs mit `;` getrennt; leer = keine (F74). */
export function splitPredecessors(value: CellValue): string[] {
  return cellText(value)
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}
