import { expect, test } from "@playwright/test";
import { importExample } from "./fixtures";

// E51: Beispiel T17 – C (1,5 min) liegt bei Mitarbeiter 1.

test("Qualifikation ankreuzen, Rückfrage und Korrektur durch den Verteilungsvorschlag", async ({
  page,
}) => {
  await importExample(page);
  await page.getByRole("link", { name: "Tabelle" }).click();
  const table = page.getByRole("table", { name: "Arbeitsgänge" });
  const employee = page.getByLabel("Mitarbeiter von C");

  // Ankreuzen statt Freitext: nur Mitarbeiter 1 darf C.
  const picker = page.getByRole("button", { name: "Qualifiziert für C" });
  await expect(picker).toHaveText("jeder");
  await picker.click();
  const list = page.getByRole("list", {
    name: "Qualifizierte Mitarbeiter für C",
  });
  await list.getByRole("checkbox").first().click();
  await expect(picker).toHaveText("1");
  await page.keyboard.press("Escape");

  // Nicht qualifizierte sind in der Auswahl gekennzeichnet.
  await expect(
    employee.locator("option", { hasText: "Mitarbeiter 2" }),
  ).toHaveText("Mitarbeiter 2 (T17) – nicht qualifiziert");

  // Abbrechen: C bleibt bei Mitarbeiter 1 (U5: Rückfrage im App-Dialog).
  await employee.selectOption({ index: 2 });
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Nicht als qualifiziert eingetragen");
  await expect(dialog).toContainText(
    "Mitarbeiter 2 ist für C nicht als qualifiziert eingetragen (qualifiziert: Mitarbeiter 1).",
  );
  await dialog.getByRole("button", { name: "Abbrechen" }).click();
  await expect(dialog).toBeHidden();
  await expect(employee).toHaveValue("station:T17/Mitarbeiter 1");

  // Bestätigen: Zuordnung mit dauerhafter Warnung.
  await employee.selectOption({ index: 2 });
  await dialog.getByRole("button", { name: "Trotzdem zuordnen" }).click();
  await expect(employee).toHaveValue("station:T17/Mitarbeiter 2");
  await expect(table).toContainText(
    "Mitarbeiter 2 ist für diesen Arbeitsgang nicht als qualifiziert eingetragen",
  );

  // Verteilungsvorschlag korrigiert die Zuordnung (E43).
  await page.getByRole("link", { name: "Diagramm" }).click();
  await page.getByRole("button", { name: "Verteilung vorschlagen" }).click();
  const sheet = page.getByRole("dialog", { name: "Verteilung vorschlagen" });
  await sheet.getByRole("button", { name: "Berechnen" }).click();
  const result = sheet.getByRole("region", { name: "Ergebnis" });
  await expect(
    result.getByRole("row", { name: /nicht qualifiziert/ }),
  ).toHaveText(/zugeordnet\s*1\s*0/, { timeout: 20000 });
  await expect(
    sheet.getByRole("button", {
      name: "Als neues Szenario anlegen und vergleichen",
    }),
  ).toBeVisible();
});
