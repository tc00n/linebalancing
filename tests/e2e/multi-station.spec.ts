import { expect, test } from "@playwright/test";
import { importExample } from "./fixtures";

test("Mitarbeiter übernimmt Arbeitsgänge an einer weiteren Station (E40)", async ({
  page,
}, testInfo) => {
  await importExample(page);
  await page.getByRole("link", { name: "Tabelle" }).click();
  const table = page.getByRole("table", { name: "Arbeitsgänge" });

  // Die Auswahl enthält alle Mitarbeiter der Linie mit ihren Stationen.
  const employee = page.getByLabel("Mitarbeiter von D");
  await expect(employee.locator("option")).toHaveText([
    "nicht zugeordnet",
    "Mitarbeiter 1 (T17)",
    "Mitarbeiter 2 (T17)",
    "+ Mitarbeiter 3 hinzufügen",
  ]);
  // D an T18 übernimmt Mitarbeiter 2. Er ist an T17 bis 3,00 beschäftigt,
  // daher beginnt D erst danach, ohne dass das als Wartezeit zählt.
  await employee.selectOption({ label: "Mitarbeiter 2 (T17)" });
  await expect(employee.locator("option:checked")).toHaveText(
    "Mitarbeiter 2 (T17, T18)",
  );
  await expect(table.getByRole("row", { name: /^D / })).toContainText(
    "3,00 – 3,76",
  );

  await page.getByRole("link", { name: "Zum Diagramm" }).click();
  // Spurbeschriftungen gibt es nur in der Mitarbeiteransicht.
  await page
    .getByRole("group", { name: "Ansicht" })
    .getByRole("button", { name: "Mitarbeiter" })
    .click();
  const t18 = page.getByLabel("Station T18");
  await expect(
    t18.getByTitle(/^Mitarbeiter 2: .* \(auch an T17\)$/),
  ).toBeVisible();
  // Anteilig nach Belegung: 0,76 von 3,76 min an T18.
  await expect(t18).toContainText("0,2 MA");
  await expect(page.getByLabel("Station T17")).toContainText("1,8 MA");
  await page.screenshot({
    path: testInfo.outputPath("mehrere-stationen.png"),
    fullPage: true,
  });
});
