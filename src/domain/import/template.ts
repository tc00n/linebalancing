// Importtemplate gemäß docs/IMPORTTEMPLATE.md (E23).

export const SHEET_STEPS = "Arbeitsgänge";
export const SHEET_GUIDE = "Ausfüllanleitung";

export const COLUMNS = [
  { key: "id", header: "Arbeitsgang-ID" },
  { key: "station", header: "Station" },
  { key: "description", header: "Arbeitsgang/Beschreibung" },
  { key: "time", header: "Zeit_min" },
  { key: "employee", header: "Mitarbeiter" },
  { key: "sequence", header: "Reihenfolge" },
  { key: "predecessors", header: "Vorgänger-IDs" },
  // E44: optional, damit Dateien von vor E44 weiter importierbar sind.
  { key: "timeKind", header: "Zeitart", optional: true },
  { key: "holdsStation", header: "Hält Station", optional: true },
] as const;

export type ColumnKey = (typeof COLUMNS)[number]["key"];
/** Spalten, ohne die eine Datei abgelehnt wird. */
export type RequiredColumnKey = Exclude<
  (typeof COLUMNS)[number],
  { optional: true }
>["key"];

export const COLUMN_HEADER: Record<ColumnKey, string> = Object.fromEntries(
  COLUMNS.map((c) => [c.key, c.header]),
) as Record<ColumnKey, string>;

/** Spaltennamen ohne Beachtung von Groß-/Kleinschreibung und überzähligen Leerzeichen. */
export function normalizeHeader(header: string): string {
  return header.trim().replace(/\s+/g, " ").toLocaleLowerCase("de");
}

export type HeaderMapping =
  /** Index null = optionale Spalte fehlt, Zellen gelten als leer. */
  | { ok: true; indexByKey: Record<ColumnKey, number | null> }
  | { ok: false; missing: string[]; duplicate: string[] };

/**
 * Ordnet die Spalten der Kopfzeile zu. Zusätzliche Spalten werden ignoriert,
 * optionale dürfen fehlen.
 */
export function mapHeaders(headers: readonly (string | null)[]): HeaderMapping {
  const positions = new Map<string, number[]>();
  headers.forEach((header, index) => {
    if (!header) return;
    const key = normalizeHeader(header);
    positions.set(key, [...(positions.get(key) ?? []), index]);
  });

  const missing: string[] = [];
  const duplicate: string[] = [];
  const indexByKey = {} as Record<ColumnKey, number | null>;
  for (const column of COLUMNS) {
    const found = positions.get(normalizeHeader(column.header)) ?? [];
    if (found.length === 0 && "optional" in column)
      indexByKey[column.key] = null;
    else if (found.length === 0) missing.push(column.header);
    else if (found.length > 1) duplicate.push(column.header);
    else indexByKey[column.key] = found[0];
  }

  return missing.length || duplicate.length
    ? { ok: false, missing, duplicate }
    : { ok: true, indexByKey };
}
