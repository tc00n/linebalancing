import type { Step } from "./types";

/**
 * Qualifikation je Arbeitsgang (E51): Welche Mitarbeiter („Mitarbeiter N“,
 * anonymisiert, linienweit eindeutig nach E40) ihn ausführen können.
 * Fehlt die Angabe, kann ihn jeder ausführen.
 */

const TOKEN = /^(?:mitarbeiter|ma)?\s*0*(\d+)$/i;
const LABEL = /^Mitarbeiter [1-9]\d*$/;

const byNumber = (a: string, b: string) => numberOf(a) - numberOf(b);
const numberOf = (label: string) => Number(/\d+$/.exec(label)![0]);

/** Gültige Bezeichnung im Modell, z. B. „Mitarbeiter 8“. */
export function isEmployeeLabel(value: string): boolean {
  return LABEL.test(value);
}

export type QualifiedParse =
  | { readonly ok: true; readonly labels: readonly string[] }
  | { readonly ok: false; readonly invalid: readonly string[] };

/**
 * Liest „1; 8; 12“ oder „Mitarbeiter 1; Mitarbeiter 8“ (auch „MA 8“, Komma
 * statt Semikolon). Leer = keine Einschränkung (leere Liste). Doppelte
 * Einträge werden zusammengefasst, das Ergebnis ist nach Nummer sortiert.
 */
export function parseQualified(text: string): QualifiedParse {
  const parts = text
    .split(/[;,]/)
    .map((p) => p.trim().replace(/\s+/g, " "))
    .filter((p) => p !== "");
  const invalid: string[] = [];
  const labels = new Set<string>();
  for (const part of parts) {
    const match = TOKEN.exec(part);
    if (!match || Number(match[1]) < 1) invalid.push(part);
    else labels.add(`Mitarbeiter ${Number(match[1])}`);
  }
  return invalid.length
    ? { ok: false, invalid }
    : { ok: true, labels: [...labels].sort(byNumber) };
}

/** Anzeige und Export: „1; 8; 12“; leer ohne Einschränkung. */
export function formatQualified(labels: readonly string[] | undefined): string {
  return (labels ?? []).map((l) => String(numberOf(l))).join("; ");
}

/** Kann der Mitarbeiter mit dieser Bezeichnung den Arbeitsgang ausführen? */
export function isQualified(
  step: Pick<Step, "qualifiedEmployees">,
  employeeLabel: string,
): boolean {
  return (
    step.qualifiedEmployees === undefined ||
    step.qualifiedEmployees.includes(employeeLabel)
  );
}

/** Normierte Liste; undefined = keine Einschränkung. */
export function normalizeQualified(
  labels: readonly string[],
): readonly string[] | undefined {
  const unique = [...new Set(labels)].sort(byNumber);
  return unique.length ? unique : undefined;
}
