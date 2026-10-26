import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { validateRows } from "@/domain/import/validateRows";
import { createTemplate, readWorkbook } from "@/features/import/workbook";
import {
  convertDiagramSheet,
  fillTemplate,
  findDiagramSheet,
  stepId,
} from "./convert";

// Nachbau der Struktur „Übersicht Zeitaufnahmen … Diagramm“ mit erfundenen Werten.
function sampleWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Hauptblatt");
  const ws = workbook.addWorksheet("XY 100 - T1-T2 Diagramm");
  ws.addRow(["Übersicht Zeitaufnahmen XY 100"]);
  ws.addRow([]);
  ws.addRow(["ZA", null, "Takt-Benennung", "WC", "AA", "Arbeitsinhalt", "∑t"]);
  ws.addRow([
    "T1xxx01",
    "te1",
    "Montage (MA 1)",
    "T1",
    485,
    "FZ vortakten",
    { formula: "X1", result: 1.285 },
  ]);
  ws.addRow([
    null,
    null,
    "Montage (MA 1)",
    "T1",
    "10 (A)",
    "Teil   heben - aussen",
    6.2,
  ]);
  ws.addRow([
    null,
    null,
    "Montage (MA 1)",
    "T1",
    "10 (B)",
    "Teil heben - innen",
    13.6,
  ]);
  ws.addRow([
    null,
    null,
    "Montage (MA 1)",
    "T1",
    60,
    "Nie gemessen",
    { formula: "X2" },
  ]);
  ws.addRow([null, null, null, null, null, "Summe T1", 21.085]);
  ws.addRow([]);
  ws.addRow([null, null, "Prüfen", "T2", null, "Ohne AA", 2]);
  ws.addRow([null, null, "Prüfen", "T2", 475, "Begleitpapiere", 0.5]);
  ws.addRow([null, null, null, null, null, "Summe T1", 3]); // falsch beschriftet und falsche Summe
  return workbook;
}

describe("Zeitaufnahme-Konverter (E24)", () => {
  const sheet = findDiagramSheet(sampleWorkbook())!;
  const conversion = convertDiagramSheet(sheet);

  it("findet das Diagrammblatt", () => {
    expect(sheet.name).toBe("XY 100 - T1-T2 Diagramm");
  });

  it("übernimmt je Arbeitsablauf ∑t, Mitarbeiter 1 und die Zeilenreihenfolge", () => {
    expect(conversion.rows.map((r) => r.values)).toEqual([
      {
        id: "T1-AA485",
        station: "T1",
        description: "FZ vortakten",
        time: 1.285,
        employee: "Mitarbeiter 1",
        sequence: 10,
        predecessors: null,
      },
      {
        id: "T1-AA010A",
        station: "T1",
        description: "Teil heben - aussen",
        time: 6.2,
        employee: "Mitarbeiter 1",
        sequence: 20,
        predecessors: null,
      },
      {
        id: "T1-AA010B",
        station: "T1",
        description: "Teil heben - innen",
        time: 13.6,
        employee: "Mitarbeiter 1",
        sequence: 30,
        predecessors: null,
      },
      {
        id: "T1-AA060",
        station: "T1",
        description: "Nie gemessen",
        time: null,
        employee: "Mitarbeiter 1",
        sequence: 40,
        predecessors: null,
      },
      {
        id: "T2-Z10",
        station: "T2",
        description: "Ohne AA",
        time: 2,
        employee: "Mitarbeiter 1",
        sequence: 10,
        predecessors: null,
      },
      {
        id: "T2-AA475",
        station: "T2",
        description: "Begleitpapiere",
        time: 0.5,
        employee: "Mitarbeiter 1",
        sequence: 20,
        predecessors: null,
      },
    ]);
    expect(conversion.rows[0].source).toEqual({
      row: 4,
      za: "T1xxx01",
      aa: "485",
      label: "Montage (MA 1)",
    });
  });

  it("protokolliert fehlende Zeiten, fehlende AA und Fehler der Summenzeilen", () => {
    expect(conversion.notes).toEqual([
      "Zeile 7 (T1-AA060): kein ∑t vorhanden. Zeit in der Importdatei leer – bitte nachtragen oder Zeile löschen.",
      "Zeile 10 (T2-Z10): keine AA-Nummer, ID aus der Zeilennummer gebildet.",
      "Zeile 12: Summe 3.00 weicht von der Summe der Zeilen für T2 (2.50) ab.",
      "Zeile 12: Summenzeile ist mit „Summe T1“ beschriftet, gehört aber zu T2 (Fehler in der Quelldatei, ohne Auswirkung).",
    ]);
  });

  it("erzeugt eine Importdatei, die nur an den fehlenden Zeiten scheitert", async () => {
    const template = new ExcelJS.Workbook();
    await template.xlsx.load(await createTemplate());
    fillTemplate(template, conversion, "XY 100.xlsx");
    expect(template.worksheets.map((w) => w.name)).toEqual([
      "Arbeitsgänge",
      "Ausfüllanleitung",
      "Konvertierungsprotokoll",
    ]);

    const read = await readWorkbook(
      (await template.xlsx.writeBuffer()) as ArrayBuffer,
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const errors = validateRows(read.rows).messages.filter(
      (m) => m.severity === "error",
    );
    expect(errors.map((e) => [e.rowNumber, e.column, e.message])).toEqual([
      [5, "time", "Zeit fehlt."],
    ]);
  });
});

describe("stepId", () => {
  it("bildet IDs aus Station und AA", () => {
    expect(stepId("T17", "5", 6)).toBe("T17-AA005");
    expect(stepId("T19", "10 (b)", 9)).toBe("T19-AA010B");
    expect(stepId("T19", "", 56)).toBe("T19-Z56");
    expect(stepId("T9", "X 1", 3)).toBe("T9-AAX1");
  });
});
