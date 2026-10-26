import { expect, test } from "@playwright/test";
import { importExample } from "./fixtures";

test("Arbeitsgänge in der Tabellenansicht bearbeiten (F132)", async ({
  page,
}, testInfo) => {
  await importExample(page);
  await page.getByRole("link", { name: "Tabelle" }).click();
  await expect(page).toHaveURL(/\/szenario\/tabelle\?id=/);

  const table = page.getByRole("table", { name: "Arbeitsgänge" });
  await expect(table.getByRole("row")).toHaveCount(8); // Kopfzeile + 2 Stationszeilen + 5 Arbeitsgänge
  await page.screenshot({
    path: testInfo.outputPath("00-stationen.png"),
    fullPage: true,
  });
  // ID, Beschreibung und Zeit sind keine Eingabefelder (F17, F69).
  await expect(
    table.getByRole("row", { name: /^A / }).getByRole("textbox"),
  ).toHaveCount(2);

  // Mitarbeiter wechseln: C von Mitarbeiter 1 zu Mitarbeiter 2 → C hat keine Wartezeit mehr.
  await page
    .getByLabel("Mitarbeiter von C")
    .selectOption({ label: "Mitarbeiter 2" });
  await expect(table.getByRole("row", { name: /^C / })).toContainText(
    "3,00 – 4,50",
  );

  // Stationswechsel entfernt den Mitarbeiter (F61).
  await page.getByLabel("Station von A").selectOption({ label: "T18" });
  await expect(page.getByLabel("Mitarbeiter von A")).toHaveValue("");

  // Vorgängerkreis wird abgelehnt (E3).
  const predecessors = page.getByLabel("Vorgänger von B");
  await predecessors.fill("C");
  await predecessors.press("Enter");
  await expect(
    table.getByRole("row", { name: /^B / }).getByRole("alert"),
  ).toHaveText("Diese Vorgänger würden einen Kreis bilden: B, C.");
  await expect(predecessors).toHaveValue("");

  // Rückgängig macht den Stationswechsel ungeschehen (F26).
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(page.getByLabel("Station von A")).toHaveValue("station:T17");
  await expect(page.getByLabel("Mitarbeiter von A")).toHaveValue(
    "station:T17/Mitarbeiter 1",
  );

  // Suche blendet Zeilen aus.
  // Next.js hält die Diagrammseite versteckt vor; deshalb nur sichtbare Elemente.
  await page
    .getByLabel("Arbeitsgang suchen")
    .filter({ visible: true })
    .fill("dachhaube");
  await expect(table.getByRole("row")).toHaveCount(4); // Kopfzeile + Station + 2 Treffer
  await page.screenshot({
    path: testInfo.outputPath("01-tabelle.png"),
    fullPage: true,
  });

  // Diagramm zeigt denselben gespeicherten Stand.
  await page.getByRole("link", { name: "Zum Diagramm" }).click();
  await expect(page).toHaveURL(/\/szenario\?ist=/);
  const t17 = page.getByLabel("Station T17");
  await expect(t17.getByLabel(/^Mitarbeiter 2:/)).toHaveAttribute(
    "aria-label",
    "Mitarbeiter 2: 4,50 min",
  );
});
