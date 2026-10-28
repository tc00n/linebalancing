import type { Workbook, Worksheet } from "exceljs";
import {
  COLUMNS,
  type ColumnKey,
  type RequiredColumnKey,
} from "@/domain/import/template";
import { normalizeCell } from "@/features/import/workbook";

/**
 * Einmaliger Konverter für Zeitaufnahmen im Format „Übersicht Zeitaufnahmen“
 * (E24, F131). Quelle ist das Diagrammblatt mit einer Zeile je Arbeitsablauf
 * und ∑t = Summe über alle Mitarbeiter der Station. Festlegungen vom 26.10.2026:
 * - Zeit = ∑t, alle Schritte einer Station auf einen Mitarbeiter; die Nummer läuft
 *   über die Linie (erste Station „Mitarbeiter 1“, zweite „Mitarbeiter 2“ …).
 * - Zeilen ohne ∑t werden mit leerer Zeit übernommen (Import blockiert bis zur Nachpflege).
 * - Reihenfolge = Zeilenreihenfolge je Station; Vorgänger bleiben leer (keine erfundenen Abhängigkeiten).
 */

export interface ConvertedRow {
  /** Optionale Spalten (z. B. Zeitart, E44) bleiben leer. */
  readonly values: Record<RequiredColumnKey, string | number | null> &
    Partial<Record<ColumnKey, string | number | null>>;
  /** Zusatzspalten zur Nachverfolgung; der Import ignoriert sie. */
  readonly source: {
    readonly row: number;
    readonly za: string;
    readonly aa: string;
    readonly label: string;
  };
}

export interface Conversion {
  readonly sheetName: string;
  readonly rows: ConvertedRow[];
  readonly notes: string[];
}

const HEADERS = {
  za: "ZA",
  label: "Takt-Benennung",
  station: "WC",
  aa: "AA",
  description: "Arbeitsinhalt",
  time: "∑t",
} as const;

export function findDiagramSheet(workbook: Workbook): Worksheet | undefined {
  return workbook.worksheets.find((ws) => /diagramm/i.test(ws.name));
}

export function convertDiagramSheet(sheet: Worksheet): Conversion {
  const notes: string[] = [];
  const { headerRow, column } = locateHeader(sheet);
  const text = (row: number, key: keyof typeof HEADERS) => {
    const value = normalizeCell(sheet.getRow(row).getCell(column[key]).value);
    return value === null ? "" : String(value).replace(/\s+/g, " ").trim();
  };
  const timeAt = (row: number) => {
    const value = normalizeCell(sheet.getRow(row).getCell(column.time).value);
    return typeof value === "number" && value > 0 ? value : null;
  };

  const rows: ConvertedRow[] = [];
  const usedIds = new Set<string>();
  const sequence = new Map<string, number>();
  const employeeOf = new Map<string, string>();
  let blockSum = 0;
  let blockStation = "";

  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const station = text(r, "station");
    const description = text(r, "description");

    if (!station) {
      // Summenzeile („Summe T17“) prüft die vorangehende Station über ihre Position.
      const total = timeAt(r);
      if (/^summe/i.test(description) && total !== null && blockStation) {
        if (Math.abs(total - blockSum) > 0.005) {
          notes.push(
            `Zeile ${r}: Summe ${total.toFixed(2)} weicht von der Summe der Zeilen für ${blockStation} (${blockSum.toFixed(2)}) ab.`,
          );
        }
        if (!description.includes(blockStation)) {
          notes.push(
            `Zeile ${r}: Summenzeile ist mit „${description}“ beschriftet, gehört aber zu ${blockStation} (Fehler in der Quelldatei, ohne Auswirkung).`,
          );
        }
        blockSum = 0;
        blockStation = "";
      }
      continue;
    }
    if (!description) {
      notes.push(`Zeile ${r}: ohne Arbeitsinhalt, nicht übernommen.`);
      continue;
    }

    if (station !== blockStation) {
      blockStation = station;
      blockSum = 0;
    }
    const time = timeAt(r);
    blockSum += time ?? 0;
    const aa = text(r, "aa");
    const id = uniqueId(stepId(station, aa, r), usedIds);
    const position = (sequence.get(station) ?? 0) + 10;
    sequence.set(station, position);
    if (!employeeOf.has(station))
      employeeOf.set(station, `Mitarbeiter ${employeeOf.size + 1}`);

    if (time === null) {
      notes.push(
        `Zeile ${r} (${id}): kein ∑t vorhanden. Zeit in der Importdatei leer – bitte nachtragen oder Zeile löschen.`,
      );
    }
    if (!aa) {
      notes.push(
        `Zeile ${r} (${id}): keine AA-Nummer, ID aus der Zeilennummer gebildet.`,
      );
    }

    rows.push({
      values: {
        id,
        station,
        description,
        time,
        employee: employeeOf.get(station)!,
        sequence: position,
        predecessors: null,
      },
      source: { row: r, za: text(r, "za"), aa, label: text(r, "label") },
    });
  }

  return { sheetName: sheet.name, rows, notes };
}

function locateHeader(sheet: Worksheet) {
  for (let r = 1; r <= Math.min(sheet.rowCount, 20); r++) {
    const column: Partial<Record<keyof typeof HEADERS, number>> = {};
    sheet.getRow(r).eachCell((cell, col) => {
      const value = normalizeCell(cell.value);
      for (const [key, header] of Object.entries(HEADERS)) {
        if (typeof value === "string" && value.trim() === header) {
          column[key as keyof typeof HEADERS] ??= col;
        }
      }
    });
    if (Object.keys(HEADERS).every((key) => key in column)) {
      return {
        headerRow: r,
        column: column as Record<keyof typeof HEADERS, number>,
      };
    }
  }
  throw new Error(
    `Kopfzeile mit den Spalten ${Object.values(HEADERS).join(", ")} nicht gefunden (Blatt „${sheet.name}“).`,
  );
}

/** „T19“ + „10 (A)“ → „T19-AA010A“; ohne AA: „T19-Z56“. */
export function stepId(station: string, aa: string, row: number): string {
  if (!aa) return `${station}-Z${row}`;
  const match = /^(\d+)\s*(?:\(\s*([A-Za-z])\s*\))?$/.exec(aa);
  if (!match) return `${station}-AA${aa.replace(/\s+/g, "")}`;
  return `${station}-AA${match[1].padStart(3, "0")}${(match[2] ?? "").toUpperCase()}`;
}

function uniqueId(id: string, used: Set<string>): string {
  let candidate = id;
  for (let n = 2; used.has(candidate); n++) candidate = `${id}-${n}`;
  used.add(candidate);
  return candidate;
}

export const SOURCE_HEADERS = [
  "Quelle Zeile",
  "ZA",
  "AA",
  "Takt-Benennung",
] as const;

/** Schreibt Zeilen und Protokoll in ein frisch erzeugtes Importtemplate. */
export function fillTemplate(
  template: Workbook,
  conversion: Conversion,
  sourceName: string,
) {
  const sheet = template.getWorksheet("Arbeitsgänge")!;
  SOURCE_HEADERS.forEach((header, i) => {
    const cell = sheet.getRow(1).getCell(COLUMNS.length + 1 + i);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FF003C73" } };
    sheet.getColumn(COLUMNS.length + 1 + i).width = i === 3 ? 30 : 14;
  });
  for (const row of conversion.rows) {
    sheet.addRow([
      ...COLUMNS.map((c) => row.values[c.key] ?? null),
      `${conversion.sheetName}!${row.source.row}`,
      row.source.za || null,
      row.source.aa || null,
      row.source.label || null,
    ]);
  }

  const protocol = template.addWorksheet("Konvertierungsprotokoll");
  protocol.getColumn(1).width = 140;
  [
    `Quelle: ${sourceName}, Blatt „${conversion.sheetName}“`,
    `Erstellt: ${new Date().toLocaleString("de-DE")}`,
    "",
    "Festlegungen:",
    "- Zeit_min = ∑t des Diagrammblatts = Summe der Ø-Zeiten aller Mitarbeiter je Arbeitsablauf, inkl. Verteilzeit (mit Vt). Zuschlag beim Import 0 %.",
    "- Alle Arbeitsgänge einer Station sind einem Mitarbeiter zugeordnet, durchnummeriert über die Linie (erste Station „Mitarbeiter 1“, zweite „Mitarbeiter 2“ …). Stationshöhe = Summe ∑t; die Aufteilung auf mehrere Mitarbeiter je Station erfolgt in der App.",
    "- Reihenfolge = Zeilenreihenfolge je Station. Vorgänger-IDs leer: die Quelle enthält keine Abhängigkeiten, es werden keine erfunden.",
    "- Arbeitsgang-ID = Station + AA-Nummer (z. B. T19-AA010A).",
    "",
    `Hinweise (${conversion.notes.length}):`,
    ...conversion.notes.map((n) => `- ${n}`),
  ].forEach((line) => protocol.addRow([line]));
}
