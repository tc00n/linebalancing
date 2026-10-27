import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { importExample } from "./fixtures";

async function download(page: Page, item: string) {
  await page.getByRole("button", { name: "Export" }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: item }).click();
  const file = await pending;
  return {
    name: file.suggestedFilename(),
    data: await readFile((await file.path())!),
  };
}

test("Excel- und Diagrammexport (F35, F45, F52, E18, E19)", async ({
  page,
}, testInfo) => {
  await importExample(page, { allowance: "10" });
  // Umverteilung: B an Mitarbeiter 1, damit der Export die geänderte Zuordnung zeigt.
  await page.getByRole("button", { name: "Arbeitsgang B, 3,00 min" }).click();
  await page
    .getByRole("complementary", { name: "Details zu Arbeitsgang B" })
    .getByLabel("Mitarbeiter")
    .selectOption({ label: "Mitarbeiter 1 (T17)" });
  await expect(page.getByText("gespeichert", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  const excel = await download(page, "Excel (Importvorlage)");
  expect(excel.name).toBe("Beispiel XT.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(excel.data).buffer);
  const rows = workbook
    .getWorksheet("Arbeitsgänge")!
    .getRows(2, 5)!
    .map((r) => (r.values as unknown[]).slice(1, 8));
  // Zeiten unverändert, Zuordnung aktuell, D ohne Mitarbeiter (gerundet importiert, E21).
  expect(rows).toContainEqual([
    "B",
    "T17",
    "Dachhaube montieren",
    3,
    "Mitarbeiter 1",
    2,
    "",
  ]);
  expect(rows).toContainEqual(["D", "T18", "Prüfen", 0.76, "", 4, "C"]);

  const png = await download(page, "Diagramm als PNG");
  expect(png.name).toBe("Beispiel XT – Yamazumi.png");
  expect(
    [...png.data.subarray(1, 4)].map((b) => String.fromCharCode(b)).join(""),
  ).toBe("PNG");
  await testInfo.attach("yamazumi.png", {
    body: png.data,
    contentType: "image/png",
  });

  const pdf = await download(page, "Diagramm als PDF (A4 quer)");
  expect(pdf.name).toBe("Beispiel XT – Yamazumi.pdf");
  const text = pdf.data.toString("latin1");
  expect(text.startsWith("%PDF-1.4")).toBe(true);
  expect(text).toContain("/MediaBox [0 0 842 595]");
  await testInfo.attach("yamazumi.pdf", {
    body: pdf.data,
    contentType: "application/pdf",
  });
});
