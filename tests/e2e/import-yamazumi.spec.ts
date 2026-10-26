import { expect, test } from "@playwright/test";
import { exampleWorkbook } from "./fixtures";

test("Excel importieren, korrigieren und als Yamazumi anzeigen", async ({
  page,
}, testInfo) => {
  await page.goto("/import");
  await page.getByLabel("Excel-Datei (.xlsx)").setInputFiles({
    name: "Beispiel XT.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await exampleWorkbook(),
  });

  await expect(page.getByText("1 Fehler verhindern den Import")).toBeVisible();
  await expect(page.getByText("Station fehlt.")).toBeVisible();
  await expect(page.getByText(/wird auf 0,76 gerundet/)).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("01-import-vorschau.png"),
    fullPage: true,
  });

  // Korrektur in der Vorschau (E22).
  const station = page.getByLabel("Zeile 6, Station");
  await station.fill("T18");
  await station.press("Enter");
  await expect(page.getByText("5 Arbeitsgänge ohne Fehler")).toBeVisible();

  await expect(page.getByLabel("Name (Variante und Szenario)")).toHaveValue(
    "Beispiel XT",
  );
  await page.getByLabel("Taktzeit [min]").fill("4,00");
  await page.getByLabel("Zuschlag [%]").fill("10");
  await page.getByRole("button", { name: "Szenario anlegen" }).click();

  await expect(page).toHaveURL(/\/szenario\?id=/);
  await expect(
    page.getByRole("heading", { name: "Beispiel XT" }),
  ).toBeVisible();
  // Golden-Werte E7 mit 10 % Zuschlag.
  await expect(page.getByText("101,88 %")).toBeVisible();
  await expect(page.getByText("6,50 min", { exact: true })).toBeVisible();
  await expect(page.getByText("Ergebnis unvollständig")).toBeVisible();
  await expect(page.getByLabel("Station T17")).toContainText("4,85");
  for (const name of ["Breite", "Zeitskala"]) {
    const box = await page.getByRole("slider", { name }).boundingBox();
    expect(box?.width, `Regler ${name} sichtbar`).toBeGreaterThan(0);
  }
  await page.screenshot({
    path: testInfo.outputPath("02-yamazumi-station.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Arbeitsgang C, 1,50 min" }).click();
  const panel = page.getByRole("complementary", {
    name: "Details zu Arbeitsgang C",
  });
  await expect(panel).toContainText("3,00 – 4,50 min");
  await expect(panel).toContainText("importiert, schreibgeschützt");
  await page.screenshot({
    path: testInfo.outputPath("03-detailpanel.png"),
    fullPage: true,
  });

  await page.keyboard.press("Escape");
  await page
    .getByRole("radio", { name: "Mitarbeiter" })
    .or(page.getByRole("button", { name: "Mitarbeiter", exact: true }))
    .click();
  await page.screenshot({
    path: testInfo.outputPath("04-yamazumi-mitarbeiter.png"),
    fullPage: true,
  });
});
