import { expect, test, type Locator, type Page } from "@playwright/test";
import { importExample } from "./fixtures";

// E45: Mitarbeiteransicht als Bedienerbalkendiagramm. Beispiel (Takt 4):
// Mitarbeiter 1 A 0–2, wartet auf B, C 3–4,5 → 4,50; Mitarbeiter 2 B 0–3 → 3,00;
// D und E an T18 ohne Mitarbeiter.

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

const bar = (scope: Page | Locator, name: string) =>
  scope.getByRole("region", { name: `Balken ${name}`, exact: true });

test("Mitarbeiteransicht: Balken je Mitarbeiter, Umzuordnen per Ziehen, Sortierung", async ({
  page,
}, testInfo) => {
  await importExample(page);
  await page
    .getByRole("group", { name: "Ansicht" })
    .getByRole("button", { name: "Mitarbeiter" })
    .click();

  const ma1 = bar(page, "Mitarbeiter 1");
  const ma2 = bar(page, "Mitarbeiter 2");
  await expect(ma1).toContainText("4,50");
  await expect(ma1).toContainText("112,50 %");
  await expect(ma2).toContainText("3,00");
  const unassigned = bar(page, "ohne Mitarbeiter");
  await expect(unassigned).toContainText("nicht eingerechnet");
  await expect(
    unassigned.getByRole("button", { name: /^Arbeitsgang D,/ }),
  ).toBeVisible();

  // C auf Mitarbeiter 2 ziehen: Umzuordnung, die Station bleibt T17.
  // Mitarbeiter 2: B 0–3, C 3–4,5; Mitarbeiter 1: nur noch A.
  await drag(
    page,
    ma1.getByRole("button", { name: "Arbeitsgang C, 1,50 min" }),
    ma2,
  );
  await expect(
    ma2.getByRole("button", { name: "Arbeitsgang C, 1,50 min" }),
  ).toBeVisible();
  await expect(ma2).toContainText("4,50");
  await expect(ma2).toContainText("T17");
  await expect(ma1).toContainText("2,00");

  // D ohne Mitarbeiter auf Mitarbeiter 1 ziehen: er arbeitet zusätzlich an T18 (E40).
  await drag(
    page,
    unassigned.getByRole("button", { name: /^Arbeitsgang D,/ }),
    ma1,
  );
  await expect(
    ma1.getByRole("button", { name: /^Arbeitsgang D,/ }),
  ).toBeVisible();
  await expect(ma1).toContainText("T17, T18");
  await expect(ma1).toContainText("2,76");

  // Reihenfolge nach Belegung: Mitarbeiter 2 (4,50) vor Mitarbeiter 1 (2,76).
  const bars = page.getByRole("region", { name: /^Balken / });
  await expect(bars.first()).toHaveAccessibleName("Balken Mitarbeiter 1");
  await page
    .getByRole("group", { name: "Reihenfolge" })
    .getByRole("button", { name: "Belegung" })
    .click();
  await expect(bars.first()).toHaveAccessibleName("Balken Mitarbeiter 2");

  // Zeitlich korrekt: Arbeitsgänge an ihrer Startzeit, gleiche Belegung.
  await page
    .getByRole("group", { name: "Balkenaufbau" })
    .getByRole("button", { name: "Zeitlich" })
    .click();
  await expect(ma2).toContainText("4,50");
  // Einpassen hält die Balken lesbar schmal.
  await page.getByRole("button", { name: "An Fenster anpassen" }).click();
  await expect(
    page.getByRole("slider", { name: "Breite" }),
  ).toHaveAccessibleName(/140 px/);
  await page.screenshot({
    path: testInfo.outputPath("mitarbeiteransicht.png"),
    fullPage: true,
  });

  // Filter nach E8: nur T18; Mitarbeiter ohne Treffer entfallen, D lückenlos ab 0.
  const search = page.getByRole("search", { name: "Suche und Filter" });
  await search.getByRole("button", { name: "Station" }).click();
  await page.getByRole("checkbox", { name: "T18" }).click();
  await page.keyboard.press("Escape");
  await expect(ma2).toHaveCount(0);
  await expect(ma1).toContainText("0,76");
  await expect(ma1).not.toContainText("%");
  await expect(
    unassigned.getByRole("button", { name: /^Arbeitsgang E,/ }),
  ).toBeVisible();
});

test("Mitarbeiteransicht im Ist/Ziel-Vergleich mit Leerplatz für fehlende Mitarbeiter", async ({
  page,
}) => {
  await importExample(page);
  await page.getByRole("button", { name: "Duplizieren" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Beispiel XT – Kopie",
  );
  // Im Ziel einen dritten Mitarbeiter an T18 anlegen (Stationsansicht, E12).
  await page
    .getByRole("button", { name: "Mitarbeiter an T18 hinzufügen" })
    .click();
  await page
    .getByRole("group", { name: "Ansicht" })
    .getByRole("button", { name: "Mitarbeiter" })
    .click();
  await page.getByRole("button", { name: "Vergleich" }).click();

  const ist = page.getByRole("region", { name: "Ist", exact: true });
  const ziel = page.getByRole("region", { name: "Ziel", exact: true });
  await expect(bar(ziel, "Mitarbeiter 3")).toBeVisible();
  await expect(
    ist.getByRole("region", {
      name: "Balken Mitarbeiter 3 (nicht vorhanden)",
    }),
  ).toBeVisible();
  await expect(bar(ist, "Mitarbeiter 1")).toContainText("4,50");
  await expect(bar(ziel, "Mitarbeiter 1")).toContainText("4,50");
});
