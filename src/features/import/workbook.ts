import type { Workbook, Worksheet } from "exceljs";
import type { CellValue } from "@/domain/import/cells";
import {
  COLUMNS,
  mapHeaders,
  normalizeHeader,
  SHEET_GUIDE,
  SHEET_STEPS,
} from "@/domain/import/template";
import type { RawRow } from "@/domain/import/validateRows";

// exceljs ist groß (~1 MB) und wird erst beim Import bzw. Template-Download geladen.
export async function newWorkbook(): Promise<Workbook> {
  const { default: ExcelJS } = await import("exceljs");
  return new ExcelJS.Workbook();
}

export type ReadResult =
  { ok: true; rows: RawRow[] } | { ok: false; message: string };

/** Liest das Blatt „Arbeitsgänge“ (docs/IMPORTTEMPLATE.md). */
export async function readWorkbook(data: ArrayBuffer): Promise<ReadResult> {
  const workbook = await newWorkbook();
  try {
    await workbook.xlsx.load(data);
  } catch {
    return {
      ok: false,
      message: "Die Datei ist keine lesbare Excel-Datei (.xlsx).",
    };
  }

  const sheet = workbook.worksheets.find(
    (ws) => normalizeHeader(ws.name) === normalizeHeader(SHEET_STEPS),
  );
  if (!sheet) {
    return {
      ok: false,
      message: `Das Blatt „${SHEET_STEPS}“ fehlt. Bitte das Importtemplate verwenden.`,
    };
  }

  const headerRow = sheet.getRow(1);
  const headers = Array.from({ length: headerRow.cellCount }, (_, i) => {
    const value = normalizeCell(headerRow.getCell(i + 1).value);
    return value === null ? null : String(value);
  });
  const mapping = mapHeaders(headers);
  if (!mapping.ok) {
    const parts = [
      mapping.missing.length &&
        `Es fehlen die Spalten ${mapping.missing.map((h) => `„${h}“`).join(", ")}.`,
      mapping.duplicate.length &&
        `Doppelt vorhanden: ${mapping.duplicate.map((h) => `„${h}“`).join(", ")}.`,
    ].filter(Boolean);
    return { ok: false, message: parts.join(" ") };
  }

  const rows: RawRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const values = Object.fromEntries(
      COLUMNS.map((c) => [
        c.key,
        normalizeCell(row.getCell(mapping.indexByKey[c.key] + 1).value),
      ]),
    ) as RawRow["values"];
    rows.push({ rowNumber, values });
  }
  return { ok: true, rows };
}

/** Vereinheitlicht exceljs-Zellwerte zu Text, Zahl oder leer. */
export function normalizeCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("result" in v) return normalizeCell(v.result); // Formel: berechnetes Ergebnis
    if ("formula" in v || "sharedFormula" in v) return null; // Formel ohne gespeichertes Ergebnis
    if (Array.isArray(v.richText)) {
      return v.richText
        .map((part: { text?: string }) => part.text ?? "")
        .join("");
    }
    if (typeof v.text === "string") return v.text; // Hyperlink
    if (typeof v.error === "string") return v.error; // z. B. #DIV/0!
  }
  return String(value);
}

const GUIDE_ROWS: [string, string, string, string][] = [
  [
    "Arbeitsgang-ID",
    "ja",
    "Eindeutige Kennung je Arbeitsschritt innerhalb der Datei.",
    "AG-010",
  ],
  [
    "Station",
    "ja",
    "Bezeichnung der Station. Stationen werden natürlich sortiert („Station 2“ vor „Station 10“).",
    "T17",
  ],
  [
    "Arbeitsgang/Beschreibung",
    "ja",
    "Beschreibung der Tätigkeit.",
    "Kabelbaum verlegen",
  ],
  [
    "Zeit_min",
    "ja",
    "Zeit in Minuten, größer als 0, höchstens zwei Nachkommastellen. Zahlzelle oder Text mit Komma. Mehr Nachkommastellen werden kaufmännisch gerundet.",
    "1,25",
  ],
  [
    "Mitarbeiter",
    "nein",
    "„Mitarbeiter 1“, „Mitarbeiter 2“ … Die Zuordnung gilt je Arbeitsgang; die Nummer läuft über die ganze Linie (z. B. T17 → Mitarbeiter 1, T18 → Mitarbeiter 2). Dieselbe Bezeichnung an mehreren Stationen ist dieselbe Person; ihre Arbeitsgänge werden nacheinander eingeplant. Leer = noch nicht zugeordnet (Warnung).",
    "Mitarbeiter 1",
  ],
  [
    "Reihenfolge",
    "ja",
    "Zahl ab 0, auch mit Komma (z. B. 2,5 zum Einschieben). Entscheidet bei gleichem frühestem Start über die Abarbeitung.",
    "10",
  ],
  [
    "Vorgänger-IDs",
    "Spalte ja, Zelle nein",
    "Arbeitsgang-IDs, die vorher abgeschlossen sein müssen, mit Semikolon getrennt. Leer = keine Vorgänger.",
    "AG-005; AG-008",
  ],
];

/** Leeres Importtemplate mit Ausfüllanleitung (F89). */
export async function createTemplate(): Promise<ArrayBuffer> {
  const workbook = await newWorkbook();
  workbook.creator = "NEONEX Line Balancing";

  const steps = workbook.addWorksheet(SHEET_STEPS, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  steps.columns = COLUMNS.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.key === "description" ? 48 : c.key === "predecessors" ? 22 : 18,
  }));
  steps.getColumn("time").numFmt = "0.00";
  styleHeader(steps);

  const guide = workbook.addWorksheet(SHEET_GUIDE);
  guide.columns = [
    { header: "Spalte", width: 26 },
    { header: "Pflicht", width: 20 },
    { header: "Regel", width: 90 },
    { header: "Beispiel", width: 22 },
  ];
  styleHeader(guide);
  GUIDE_ROWS.forEach((row) => guide.addRow(row));
  guide.addRow([]);
  [
    `Eine Zeile je Arbeitsschritt im Blatt „${SHEET_STEPS}“, Spaltennamen in Zeile 1 nicht ändern.`,
    "Eine Datei je Produktvariante. Der Dateiname wird als Varianten- und Szenarioname vorgeschlagen.",
    "Taktzeit und Zuschlag werden beim Import in der App eingegeben.",
    "Arbeitet ein Arbeitsschritt mit mehreren Mitarbeitern, wird er in eine Zeile je Mitarbeiter aufgeteilt.",
  ].forEach((hint) => guide.addRow([hint]));
  guide.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export function styleHeader(sheet: Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF003C73" },
  };
}
