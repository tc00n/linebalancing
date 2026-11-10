import { expect, test } from "@playwright/test";
import { importExample } from "./fixtures";

// E43: Beispiel T17 – A (2 min) wird zusätzlich Mitarbeiter 2 gegeben, der schon B (3 min) hat.
// C wartet auf B; die Station wird dadurch 6,50 min hoch, der Vorschlag bringt sie auf 4,50 min.

test("Verteilung vorschlagen und als neues Szenario vergleichen", async ({
  page,
}) => {
  await importExample(page);
  await page.getByRole("button", { name: "Arbeitsgang A, 2,00 min" }).click();
  const panel = page.getByRole("complementary", {
    name: "Details zu Arbeitsgang A",
  });
  await panel
    .getByLabel("Mitarbeiter")
    .selectOption({ label: "Mitarbeiter 2 (T17)" });
  await panel.getByRole("button", { name: "Detailpanel schließen" }).click();
  await expect(page.getByLabel("Station T17")).toContainText("6,50");

  await page.getByRole("button", { name: "Verteilung vorschlagen" }).click();
  const sheet = page.getByRole("dialog", { name: "Verteilung vorschlagen" });
  await expect(sheet.getByRole("combobox", { name: "Station" })).toHaveValue(
    "station:T17",
  );
  await expect(
    sheet.getByLabel("Kleinste Stationshöhe mit dem vorhandenen Personal"),
  ).toBeChecked();
  await sheet.getByRole("button", { name: "Berechnen" }).click();

  const result = sheet.getByRole("region", { name: "Ergebnis" });
  await expect(result).toBeVisible({ timeout: 20000 });
  await expect(result.getByRole("row", { name: /Stationshöhe/ })).toHaveText(
    /6,50 min.*4,50 min/,
  );
  await page.screenshot({
    path: test.info().outputPath("vorschlag.png"),
    fullPage: true,
  });

  await sheet
    .getByRole("button", { name: "Als neues Szenario anlegen und vergleichen" })
    .click();
  await expect(page).toHaveURL(/vergleich=1/);
  const selected = (side: string) =>
    page.getByLabel(`Szenario für ${side}`).locator("option:checked");
  await expect(selected("Ziel")).toHaveText("Beispiel XT – Vorschlag T17");
  // Ist bleibt der Ausgangsstand.
  await expect(selected("Ist")).toHaveText("Beispiel XT");
});
