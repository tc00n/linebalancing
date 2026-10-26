import { expect, test } from "@playwright/test";

test("Startseite wird ausgeliefert", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Line Balancing/);
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
});
