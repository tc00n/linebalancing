import { expect, test } from "@playwright/test";
import { importExample } from "./fixtures";

test("Suchen, filtern, an Fenster anpassen und Vollbild", async ({
  page,
}, testInfo) => {
  await importExample(page);
  const bar = page.getByRole("search", { name: "Suche und Filter" });

  // E37: Suche hebt hervor, Balken bleiben unverändert.
  await bar.getByLabel("Arbeitsgang suchen").fill("dachhaube");
  await expect(bar.getByRole("status")).toHaveText("2 Treffer");
  await expect(page.getByLabel("Station T17")).toContainText("4,50");
  await bar.getByLabel("Arbeitsgang suchen").fill("");

  // E8/F128: Filter Mitarbeiter 2 zeigt nur B, Kennzahlen bleiben gesamt.
  await bar.getByRole("button", { name: "Mitarbeiter" }).click();
  await page.getByRole("checkbox", { name: "Mitarbeiter 2" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByText("Gefilterte Ansicht: 1 von 5 Arbeitsgängen (3,00 min)"),
  ).toBeVisible();
  await expect(bar.getByRole("list", { name: "Aktive Filter" })).toContainText(
    "Mitarbeiter: Mitarbeiter 2",
  );
  await expect(
    page.getByRole("button", { name: /^Arbeitsgang A,/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Arbeitsgang B,/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Personalauslastung" }),
  ).toContainText("93,75");
  await page.screenshot({
    path: testInfo.outputPath("01-gefiltert.png"),
    fullPage: true,
  });
  await bar.getByRole("button", { name: "Filter zurücksetzen" }).click();
  await expect(page.getByText(/Gefilterte Ansicht/)).toHaveCount(0);

  // Backlog/F98: an Fenster anpassen verbreitert die Spuren; Einstellung bleibt je Gerät (E16).
  const width = page.getByRole("slider", { name: "Breite" });
  // Nach dem automatischen Einpassen bewusst schmaler stellen.
  await width.focus();
  await width.press("Home");
  const before = Number(await width.getAttribute("aria-valuenow"));
  await page.getByRole("button", { name: "An Fenster anpassen" }).click();
  await expect
    .poll(async () => Number(await width.getAttribute("aria-valuenow")))
    .toBeGreaterThan(before);
  const fitted = await width.getAttribute("aria-valuenow");
  await page.screenshot({
    path: testInfo.outputPath("02-angepasst.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByRole("slider", { name: "Breite" })).toHaveAttribute(
    "aria-valuenow",
    fitted!,
  );

  // F34: Vollbild mit ausblendbaren Kennzahlen.
  await page.getByRole("button", { name: "Vollbild" }).click();
  await expect(
    page.getByRole("button", { name: "Vollbild beenden" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kennzahlen", exact: true }).click();
  await expect(page.getByRole("group", { name: "Taktzeit" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("03-vollbild.png") });
  await page.getByRole("button", { name: "Vollbild beenden" }).click();
  await expect(page.getByRole("group", { name: "Taktzeit" })).toBeVisible();
});
