import { expect, test } from "@playwright/test";
import { importExample } from "./fixtures";

// E44: B (3 min, Vorgänger von C) wird zur Prozesszeit, etwa Ablüften.

test("Prozesszeit im Detailpanel umstellen, eigene Spur, Station halten", async ({
  page,
}) => {
  await importExample(page);
  await page.getByRole("button", { name: "Arbeitsgang B, 3,00 min" }).click();
  const panel = page.getByRole("complementary", {
    name: "Details zu Arbeitsgang B",
  });
  await panel.getByLabel("Zeitart").selectOption("process");
  // Ohne Mitarbeiter, dafür mit „Hält Station“ (Vorgabe nein).
  await expect(panel.getByLabel("Mitarbeiter")).toHaveCount(0);
  await expect(panel.getByLabel("Hält Station")).toHaveValue("no");

  const lane = page.getByLabel("Prozesszeiten ohne Mitarbeiter");
  await expect(
    lane.getByRole("button", { name: "Arbeitsgang B, 3,00 min, Prozesszeit" }),
  ).toBeVisible();
  // C wartet weiter auf das Ende von B: Start 3,00.
  await expect(page.getByLabel("Station T17")).toContainText("4,50");

  await panel.getByLabel("Hält Station").selectOption("yes");
  await expect(panel.getByLabel("Hält Station")).toHaveValue("yes");
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: test.info().outputPath("prozesszeit.png"),
    fullPage: true,
  });

  // Tabelle: Zeitart je Zeile, Prozesszeit ohne Mitarbeiterauswahl.
  await page.getByRole("link", { name: "Tabelle" }).click();
  await expect(page.getByLabel("Zeitart von B")).toHaveValue("process-held");
  await expect(page.getByLabel("Mitarbeiter von B")).toHaveCount(0);
  await page.getByLabel("Zeitart von B").selectOption("manual");
  await expect(page.getByLabel("Mitarbeiter von B")).toHaveValue("");
});
