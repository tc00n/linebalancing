// @vitest-environment node
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { validateRows } from "@/domain/import/validateRows";
import { createTemplate, normalizeCell, readWorkbook } from "./workbook";

async function fillTemplate(rows: unknown[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await createTemplate());
  const sheet = workbook.getWorksheet("Arbeitsgänge")!;
  rows.forEach((row) => sheet.addRow(row));
  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

describe("Excel-Template", () => {
  it("enthält die Blätter Arbeitsgänge und Ausfüllanleitung (F89)", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createTemplate());
    expect(workbook.worksheets.map((ws) => ws.name)).toEqual([
      "Arbeitsgänge",
      "Ausfüllanleitung",
    ]);
  });

  it("lässt sich ausgefüllt wieder einlesen und prüfen", async () => {
    const data = await fillTemplate([
      ["A", "T17", "Montage", 1.25, "Mitarbeiter 1", 1, null],
      ["B", "T17", "Prüfen", "0,75", "Mitarbeiter 2", 2, "A"],
      [],
      [10, "T18", "Verpacken", { formula: "1+1", result: 2 }, null, 3, "A;B"],
    ]);
    const read = await readWorkbook(data);
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    const result = validateRows(read.rows);
    expect(result.hasErrors).toBe(false);
    expect(
      result.rows.map((r) => [r.rowNumber, r.id, r.timeMin, r.employee]),
    ).toEqual([
      [2, "A", 1.25, "Mitarbeiter 1"],
      [3, "B", 0.75, "Mitarbeiter 2"],
      [5, "10", 2, null],
    ]);
  });
});

describe("readWorkbook", () => {
  it("lehnt Dateien ohne Blatt Arbeitsgänge ab", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Tabelle1");
    const read = await readWorkbook(
      (await workbook.xlsx.writeBuffer()) as ArrayBuffer,
    );
    expect(read).toEqual({
      ok: false,
      message:
        "Das Blatt „Arbeitsgänge“ fehlt. Bitte das Importtemplate verwenden.",
    });
  });

  it("lehnt fehlende Spalten ab", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Arbeitsgänge").addRow(["Arbeitsgang-ID", "Station"]);
    const read = await readWorkbook(
      (await workbook.xlsx.writeBuffer()) as ArrayBuffer,
    );
    expect(read.ok).toBe(false);
    expect(!read.ok && read.message).toMatch(
      /Es fehlen die Spalten „Arbeitsgang\/Beschreibung“/,
    );
  });

  it("lehnt Nicht-Excel-Dateien ab", async () => {
    const read = await readWorkbook(
      new TextEncoder().encode("kein excel").buffer,
    );
    expect(read).toEqual({
      ok: false,
      message: "Die Datei ist keine lesbare Excel-Datei (.xlsx).",
    });
  });
});

describe("normalizeCell", () => {
  it("vereinheitlicht exceljs-Zelltypen", () => {
    expect(
      normalizeCell({ richText: [{ text: "Sta" }, { text: "tion" }] }),
    ).toBe("Station");
    expect(normalizeCell({ text: "Link", hyperlink: "https://x" })).toBe(
      "Link",
    );
    expect(normalizeCell({ formula: "A1*2", result: 4.5 })).toBe(4.5);
    expect(normalizeCell({ formula: "A1*2" })).toBeNull();
    expect(normalizeCell({ error: "#DIV/0!" })).toBe("#DIV/0!");
    expect(normalizeCell(undefined)).toBeNull();
  });
});
