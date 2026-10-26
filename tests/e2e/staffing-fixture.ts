import ExcelJS from "exceljs";
export async function staffingWorkbook() {
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Personalplanung pro Meisterbere");
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
  sheet.addRow(["MM", "Linie", "DE", 353, "T17", null, null, 3, 3.8]);
  sheet.addRow(["MM", "Linie", "DE", 353, "T18", null, null, 1, 1.3]);
  sheet.addRow(["MM", "Linie", "DE", 353, "T19", null, null, 2, 2.5]);
  const stock = book.addWorksheet("Abgleich akt. Personaldicke");
  stock.addRow(["Kostenstelle", "Brutto", "Bestand", "Gap"]);
  stock.addRow([353, 1, 5, -4]);
  return Buffer.from(await book.xlsx.writeBuffer());
}
