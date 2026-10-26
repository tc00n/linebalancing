import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseStaffingWorkbook } from "./workbook";
function workbook() {
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Personalplanung pro Meisterbere");
  sheet.getRow(1).getCell(1).value = { error: "#VALUE!" };
  sheet.addRow([
    "Meister",
    "Bereich",
    "Teamsprecher",
    "Kostenstelle",
    "Arbeitsplatz/ Takt",
    "Abschätzung 90/ Min",
    "Brutto 90 Min",
    "Abschätzung 70/ Min",
    "Brutto 70 Min",
  ]);
  sheet.addRow(["MM", "Linie", "DE", 353, "T17", null, null, 0.5, 0.6]);
  const factor = book.addWorksheet("Brutto-Personalfaktor");
  factor.getCell("C9").value = 1.268181818181818;
  const stock = book.addWorksheet("Abgleich akt. Personaldicke");
  stock.addRow([
    "Kostenstelle",
    "Kostenstelle Summe Brutto-Bedarf",
    "Kostenstelle akt. Personal",
    "Gap",
  ]);
  stock.addRow([353, 99, 12, -87]);
  return book;
}
describe("Personalplanungsdatei", () => {
  it("liest Produktiv-, Brutto- und Bestandsdaten getrennt statt der 90-Minuten-Spalte", () => {
    const book = workbook();
    book.worksheets[0].getCell("F3").value = 7;
    const plan = parseStaffingWorkbook(book, "Personalplanung.xlsx");
    expect(plan.rows[0]).toMatchObject({
      productive: 0.5,
      gross: 0.6,
      costCenter: "353",
      station: "T17",
    });
    expect(plan.actuals[0]).toMatchObject({ actual: 12, sourceGross: 99 });
    expect(plan.rows).toHaveLength(1);
  });
  it("liest deutsches Komma und berechnet nur bekannte fehlende Brutto-Formelwerte", () => {
    const book = workbook();
    const s = book.worksheets[0];
    s.getCell("H3").value = "1,25";
    s.getCell("I3").value = {
      formula: "ROUND(H3*'Brutto-Personalfaktor'!$C$9,1)",
    };
    const p = parseStaffingWorkbook(book, "P.xlsx");
    expect(p.rows[0].productive).toBe(1.25);
    expect(p.rows[0].gross).toBe(1.6);
    expect(p.warnings).toHaveLength(1);
  });
  it("unterscheidet Nullbesetzung von fehlendem Pflichtwert", () => {
    const book = workbook();
    book.worksheets[0].getCell("H3").value = 0;
    expect(parseStaffingWorkbook(book, "P.xlsx").rows[0].productive).toBe(0);
    book.worksheets[0].getCell("H3").value = null;
    expect(() => parseStaffingWorkbook(book, "P.xlsx")).toThrow(
      "produktive Besetzung",
    );
  });
  it("nimmt Summenzeilen nicht als Personal auf und bewahrt Teamsprecher separat", () => {
    const book = workbook(),
      s = book.worksheets[0];
    s.addRow([
      "MM",
      "Teamsprecher",
      null,
      null,
      "Teamsprecher",
      null,
      null,
      4,
      5.1,
    ]);
    s.addRow(["Summe", null, null, null, null, null, null, 100, 120]);
    const plan = parseStaffingWorkbook(book, "P.xlsx");
    expect(plan.rows).toHaveLength(2);
    expect(plan.rows[1].support).toBe(true);
  });
  it("erfindet keine Zahlen bei unbekannten Formeln und lehnt falsche Dateien ab", () => {
    const book = workbook();
    book.worksheets[0].getCell("I3").value = { formula: "UNBEKANNT()" };
    expect(parseStaffingWorkbook(book, "P.xlsx").rows[0].gross).toBeNull();
    expect(() =>
      parseStaffingWorkbook(new ExcelJS.Workbook(), "Falsch.xlsx"),
    ).toThrow("fehlt");
  });
});
