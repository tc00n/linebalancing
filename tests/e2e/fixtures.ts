import ExcelJS from "exceljs";
import { expect, type Page } from "@playwright/test";
import { createTemplate } from "@/features/import/workbook";

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Rechenbeispiel E7 an Station T17, dazu Fälle für Warnungen und einen korrigierbaren Fehler. */
export async function exampleWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await createTemplate());
  const sheet = workbook.getWorksheet("Arbeitsgänge")!;
  [
    ["A", "T17", "Kabelbaum verlegen", 2, "Mitarbeiter 1", 1, null],
    ["B", "T17", "Dachhaube montieren", 3, "Mitarbeiter 2", 2, null],
    ["C", "T17", "Dachhaube verschrauben", "1,5", "Mitarbeiter 1", 3, "B"],
    ["D", "T18", "Prüfen", "0,755", null, 4, "C"], // gerundet, ohne Mitarbeiter
    ["E", null, "Etikett kleben", 0.5, null, 5, null], // Station fehlt
  ].forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Importiert das Beispiel inkl. Korrektur und landet im Arbeitsbereich. */
export async function importExample(
  page: Page,
  options: { allowance?: string } = {},
) {
  await page.goto("/import");
  await expect(page.getByLabel("Excel-Datei (.xlsx)")).toBeEnabled();
  await page.getByLabel("Excel-Datei (.xlsx)").setInputFiles({
    name: "Beispiel XT.xlsx",
    mimeType: XLSX_MIME,
    buffer: await exampleWorkbook(),
  });
  const station = page.getByLabel("Zeile 6, Station");
  await station.fill("T18");
  await station.press("Enter");
  await expect(page.getByText("5 Arbeitsgänge ohne Fehler")).toBeVisible();
  await page.getByLabel("Taktzeit [min]").fill("4,00");
  await page.getByLabel("Zuschlag [%]").fill(options.allowance ?? "0");
  await page.getByRole("button", { name: "Szenario anlegen" }).click();
  await expect(page).toHaveURL(/\/szenario\?ist=/);
}
