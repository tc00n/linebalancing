import { expect, test } from "@playwright/test";
import { importExample } from "./fixtures";

// E51: Beispiel T17 – C (1,5 min) liegt bei Mitarbeiter 1.

test("Qualifikation: Rückfrage bei nicht qualifiziertem Mitarbeiter", async ({
  page,
}) => {
  await importExample(page);
  await page.getByRole("link", { name: "Tabelle" }).click();
  const table = page.getByRole("table", { name: "Arbeitsgänge" });
  const qualified = page.getByLabel("Qualifiziert für C");
  const employee = page.getByLabel("Mitarbeiter von C");

  await qualified.fill("Mitarbeiter 1; 3");
  await qualified.press("Enter");
  await expect(qualified).toHaveValue("1; 3");
  // Nicht qualifizierte sind in der Auswahl gekennzeichnet.
  await expect(
    employee.locator("option", { hasText: "Mitarbeiter 2" }),
  ).toHaveText("Mitarbeiter 2 (T17) – nicht qualifiziert");

  // Abbrechen: C bleibt bei Mitarbeiter 1.
  const messages: string[] = [];
  page.once("dialog", (dialog) => {
    messages.push(dialog.message());
    void dialog.dismiss();
  });
  await employee.selectOption({ index: 2 });
  await expect(employee).toHaveValue("station:T17/Mitarbeiter 1");
  expect(messages).toEqual([
    "Mitarbeiter 2 ist für C nicht als qualifiziert eingetragen (qualifiziert: Mitarbeiter 1, Mitarbeiter 3).\n\nTrotzdem zuordnen?",
  ]);

  // Bestätigen: Zuordnung mit dauerhafter Warnung.
  page.once("dialog", (dialog) => void dialog.accept());
  await employee.selectOption({ index: 2 });
  await expect(employee).toHaveValue("station:T17/Mitarbeiter 2");
  await expect(table).toContainText(
    "Mitarbeiter 2 ist für diesen Arbeitsgang nicht als qualifiziert eingetragen",
  );

  // Ungültige Eingabe wird nicht übernommen.
  await qualified.fill("Meister");
  await qualified.press("Enter");
  await expect(
    page.getByRole("alert").filter({ hasText: "Meister" }),
  ).toBeVisible();
});
