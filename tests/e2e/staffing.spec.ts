import { staffingWorkbook } from "./staffing-fixture";
import { test, expect } from "@playwright/test";
import { importExample, XLSX_MIME } from "./fixtures";

test("Personalplanung importieren und gleichen Stationsumfang vergleichen", async ({
  page,
}) => {
  await importExample(page);
  await page
    .getByRole("link", { name: "Personalabgleich", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Personalplanung", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Personalplanung (.xlsx)")).toBeEnabled();
  await page.getByLabel("Personalplanung (.xlsx)").setInputFiles({
    name: "Personalplanung Test.xlsx",
    mimeType: XLSX_MIME,
    buffer: await staffingWorkbook(),
  });
  await page
    .getByRole("button", { name: "Personalplanung im Projekt speichern" })
    .click();
  const station = page.getByRole("table", {
    name: "Produktiver Personalabgleich",
  });
  await expect(
    station.getByRole("row").filter({ hasText: "T17" }),
  ).toContainText("353");
  await expect(
    station.getByRole("row").filter({ hasText: "T17" }),
  ).toContainText("3,00");
  await expect(
    page.getByRole("table", { name: "Produktiver Kostenstellenabgleich" }),
  ).toContainText("2 / 3");
  await expect(
    page.getByRole("table", { name: "Bruttopersonal und Bestand" }),
  ).toContainText("Excel-Summe weicht");
  await expect(
    page.getByRole("alert").filter({ hasText: "Unvollständiger Abgleich" }),
  ).toBeVisible();
  await page.reload();
  await expect(station).toContainText("T17");
  await page.getByRole("link", { name: "Zum Szenario", exact: true }).click();
  await expect(page.getByLabel("Takt [min]")).toHaveValue("4,00");
});
