import { expect, test } from "@playwright/test";
import { importExample } from "./fixtures";

// T17 hat Mitarbeiter 1 und 2; die Nummer läuft über die Linie (E12, E40).

test("Neuen Mitarbeiter in der Tabelle aus der Auswahl anlegen", async ({
  page,
}) => {
  await importExample(page);
  await page.getByRole("link", { name: "Tabelle" }).click();
  const table = page.getByRole("table", { name: "Arbeitsgänge" });

  const employee = page.getByLabel("Mitarbeiter von D");
  await employee.selectOption({ label: "+ Mitarbeiter 3 hinzufügen" });
  await expect(employee).toHaveValue("station:T18/Mitarbeiter 3");
  await expect(employee.locator("option:checked")).toHaveText(
    "Mitarbeiter 3 (T18)",
  );
  // D ist jetzt eingeplant: Station T18 beginnt bei 0 (E1a).
  await expect(table.getByRole("row", { name: /^D / })).toContainText(
    "0,00 – 0,76",
  );
  // Die nächste Auswahl bietet bereits Mitarbeiter 4 an.
  await expect(page.getByLabel("Mitarbeiter von A")).toContainText(
    "+ Mitarbeiter 4 hinzufügen",
  );
});

test("Neuen Mitarbeiter im Detailpanel anlegen und mit einem Schritt rückgängig machen", async ({
  page,
}) => {
  await importExample(page);
  await page.getByRole("button", { name: "Arbeitsgang C, 1,50 min" }).click();
  const panel = page.getByRole("complementary", {
    name: "Details zu Arbeitsgang C",
  });
  await panel
    .getByLabel("Mitarbeiter")
    .selectOption({ label: "+ Mitarbeiter 3 hinzufügen" });
  await expect(panel.getByLabel("Mitarbeiter")).toHaveValue(
    "station:T17/Mitarbeiter 3",
  );
  await expect(page.getByLabel("Station T17")).toContainText("3 MA");

  // Anlegen und Zuweisen sind eine Änderung: ein Rückgängig nimmt beides zurück.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(page.getByLabel("Station T17")).toContainText("2 MA");
  await page.getByRole("button", { name: "Arbeitsgang C, 1,50 min" }).click();
  await expect(panel.getByLabel("Mitarbeiter")).toHaveValue(
    "station:T17/Mitarbeiter 1",
  );
});
