import { expect, test, type Locator, type Page } from "@playwright/test";
import { importExample } from "./fixtures";

async function drag(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // dnd-kit startet erst nach 6 px Bewegung.
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

test("Arbeitsgänge im Diagramm bearbeiten, rückgängig machen und gespeichert wiederfinden", async ({
  page,
}, testInfo) => {
  await importExample(page);
  const taktKpi = page.getByRole("group", { name: "Taktzeit" });

  // Drag-and-drop A: T17 → T18; danach ohne Mitarbeiter (F61) und Detailpanel offen.
  await drag(
    page,
    page.getByRole("button", { name: "Arbeitsgang A, 2,00 min" }),
    page.getByLabel("Station T18"),
  );
  const panel = page.getByRole("complementary", {
    name: "Details zu Arbeitsgang A",
  });
  await expect(panel.getByLabel("Station")).toHaveValue("station:T18");
  await expect(panel.getByLabel("Mitarbeiter")).toHaveValue("");
  await page.screenshot({
    path: testInfo.outputPath("01-nach-verschieben.png"),
    fullPage: true,
  });

  // Nach dem Einpassen liegt T18 unter dem rechten Overlay: zuerst schliessen.
  await page.keyboard.press("Escape");
  // T18 hat keinen Mitarbeiter: anlegen (E12) und zuweisen (F100).
  // Die Nummer läuft über die Linie; T17 hat bereits Mitarbeiter 1 und 2.
  await page
    .getByRole("button", { name: "Mitarbeiter an T18 hinzufügen" })
    .click();
  await page.getByRole("button", { name: /^Arbeitsgang A,/ }).click();
  await panel
    .getByLabel("Mitarbeiter")
    .selectOption({ label: "Mitarbeiter 3 (T18)" });
  await expect(page.getByLabel("Station T18")).toContainText("2,00");

  // Takt ändern (F59) und rückgängig machen (F65).
  const takt = page.getByLabel("Takt [min]");
  await takt.fill("5");
  await takt.press("Enter");
  await expect(taktKpi).toContainText("5,00 min");
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(taktKpi).toContainText("4,00 min");
  await page.getByRole("button", { name: "Wiederholen" }).click();
  await expect(taktKpi).toContainText("5,00 min");

  // Vorgängerkreis wird abgelehnt (E3).
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Arbeitsgang B, 3,00 min" }).click();
  const panelB = page.getByRole("complementary", {
    name: "Details zu Arbeitsgang B",
  });
  await panelB
    .getByLabel("Vorgänger hinzufügen", { exact: true })
    .first()
    .fill("C");
  await panelB.getByRole("button", { name: "Vorgänger hinzufügen" }).click();
  await expect(panelB.getByRole("alert")).toHaveText(
    "Diese Vorgänger würden einen Kreis bilden: B, C.",
  );

  // Automatisch gespeichert (F25): nach Neuladen ist alles noch da.
  await expect(page.getByText("gespeichert", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByLabel("Station T18")
      .getByRole("button", { name: /^Arbeitsgang A,/ }),
  ).toBeVisible();
  await expect(taktKpi).toContainText("5,00 min");
  await page.screenshot({
    path: testInfo.outputPath("02-nach-neuladen.png"),
    fullPage: true,
  });
});
