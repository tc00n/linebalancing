import { expect, test, type Locator, type Page } from "@playwright/test";
import { importExample } from "./fixtures";

async function drag(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    from.x + from.width / 2 + 12,
    from.y + from.height / 2,
    { steps: 4 },
  );
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
}

test("Ziel duplizieren, umverteilen und mit dem Ist vergleichen", async ({
  page,
}, testInfo) => {
  await importExample(page);

  // E20: Kopie wird als Ziel geöffnet und bearbeitet.
  await page.getByRole("button", { name: "Duplizieren" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Beispiel XT – Kopie",
  );
  await expect(page.getByLabel("Szenario für Ziel")).toHaveValue(/.+/);
  await drag(
    page,
    page.getByRole("button", { name: "Arbeitsgang A, 2,00 min" }),
    page.getByLabel("Station T18"),
  );
  await expect(
    page.getByRole("complementary", { name: "Details zu Arbeitsgang A" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // F122: Vergleich mit zwei Diagrammen, Ist schreibgeschützt (F118).
  await page.getByRole("button", { name: "Vergleich" }).click();
  const ist = page.getByRole("region", { name: "Ist", exact: true });
  const ziel = page.getByRole("region", { name: "Ziel", exact: true });
  await expect(ist).toContainText("schreibgeschützt");

  // F113/F116: A ist im Ziel als verschoben markiert, im Ist nicht.
  await expect(
    ziel.getByRole("button", {
      name: "Arbeitsgang A, 2,00 min, nicht zugeordnet, verschoben",
    }),
  ).toBeVisible();
  await expect(
    ist.getByRole("button", { name: "Arbeitsgang A, 2,00 min" }),
  ).toBeVisible();
  const table = page.getByRole("table", { name: "Kennzahlen Ist und Ziel" });
  await expect(
    table.getByRole("row", { name: /Verschobene Arbeitsgänge/ }),
  ).toContainText("1");

  // Gleiche Stationsfolge auf beiden Seiten (F111) und kein Bearbeiten im Ist.
  await expect(
    ist.getByRole("button", { name: "Mitarbeiter an T17 hinzufügen" }),
  ).toHaveCount(0);
  await expect(
    ziel.getByRole("button", { name: "Mitarbeiter an T17 hinzufügen" }),
  ).toBeVisible();
  await ist.getByRole("button", { name: "Arbeitsgang A, 2,00 min" }).click();
  const panel = page.getByRole("complementary", {
    name: "Details zu Arbeitsgang A",
  });
  await expect(panel).toContainText("Ist · schreibgeschützt");
  await expect(panel.getByLabel("Station")).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath("01-vergleich.png"),
    fullPage: true,
  });

  // Nach Neuladen bleiben Ist, Ziel und Vergleich über die URL erhalten.
  await page.reload();
  await expect(
    page.getByRole("table", { name: "Kennzahlen Ist und Ziel" }),
  ).toBeVisible();
});
