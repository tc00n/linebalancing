import { expect, test } from "@playwright/test";
import { importExample } from "./fixtures";

// E42: Beispiel T17 – A (MA1, 2 min), B (MA2, 3 min), C (MA1, 1,5 min, Vorgänger B).

test("Gemeinsamer Arbeitsgang: gemeinsamer Start und Widersprüche abgelehnt", async ({
  page,
}) => {
  await importExample(page);
  await page.getByRole("link", { name: "Tabelle" }).click();
  const table = page.getByRole("table", { name: "Arbeitsgänge" });
  const group = (id: string) => page.getByLabel(`Gruppe von ${id}`);
  const row = (id: string) =>
    table.getByRole("row", { name: new RegExp(`^${id} `) });

  await group("C").fill("SWD");
  await group("C").press("Enter");
  await expect(group("C")).toHaveValue("SWD");

  // A und C haben beide Mitarbeiter 1: gleichzeitig unmöglich.
  await group("A").fill("SWD");
  await group("A").press("Enter");
  await expect(row("A").getByRole("alert")).toContainText(
    "Mitarbeiter 1 ist mehrfach eingetragen (A, C)",
  );
  await expect(group("A")).toHaveValue("");

  // B ist Vorgänger von C: kein gemeinsamer Start möglich.
  await group("B").fill("SWD");
  await group("B").press("Enter");
  await expect(row("B").getByRole("alert")).toContainText("gemeinsam starten");

  // Ohne Vorgänger: B startet mit C, sobald Mitarbeiter 1 nach A frei ist.
  await page.getByLabel("Vorgänger von C").fill("");
  await page.getByLabel("Vorgänger von C").press("Enter");
  await group("B").fill("SWD");
  await group("B").press("Enter");
  await expect(row("B")).toContainText("2,00 – 5,00");
  await expect(row("C")).toContainText("2,00 – 3,50");

  // Hauptarbeit an den Helfer geben geht nicht.
  await page
    .getByLabel("Mitarbeiter von C")
    .selectOption({ label: "Mitarbeiter 2 (T17)" });
  await expect(page.getByRole("alert").first()).toContainText(
    "Mitarbeiter 2 ist mehrfach eingetragen",
  );
  await expect(page.getByLabel("Mitarbeiter von C")).toHaveValue(
    "station:T17/Mitarbeiter 1",
  );

  // Detailpanel nennt die Partnerzeile.
  await page.getByRole("link", { name: "Diagramm" }).click();
  await page.getByRole("button", { name: "Arbeitsgang B, 3,00 min" }).click();
  const panel = page.getByRole("complementary", {
    name: "Details zu Arbeitsgang B",
  });
  await expect(panel).toContainText("startet gemeinsam mit");
  await expect(
    panel.getByRole("button", { name: "C · Mitarbeiter 1" }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("gemeinsam.png"),
    fullPage: true,
  });
});
