import { test, expect } from "@playwright/test";
test("Produktionsseiten verlangen Anmeldung, auch mit gesetztem Dev-Flag", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/import",
    "/szenario?ist=00000000-0000-4000-8000-000000000000",
    "/szenario/tabelle?id=00000000-0000-4000-8000-000000000000",
    "/projects",
    "/personalplanung",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
  }
});
test("Einladungsfragment wird im Tab gemerkt und aus URL entfernt", async ({
  page,
}) => {
  await page.goto("/#/join/ABCDE-12345");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Einladung erkannt")).toBeVisible();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("neonex-pending-project-code"),
    ),
  ).toBe("ABCDE-12345");
  expect(new URL(page.url()).hash).toBe("");
});
test("PKCE-Callback ohne Code und externe Ziele oeffnen keine fremde Seite", async ({
  page,
}) => {
  await page.goto("/auth/callback?next=https://example.org");
  await expect(page).toHaveURL(/\/login\?fehler=callback/);
  await expect(page.getByRole("status")).toContainText("abgelaufen");
});
test("Projektwechsel-API prueft Anmeldung und Ursprung", async ({
  request,
}) => {
  const r = await request.post("/api/projects/active", {
    headers: { Origin: "http://localhost:3100" },
    data: { id: "00000000-0000-4000-8000-000000000000" },
  });
  expect(r.status()).toBe(401);
  const cross = await request.post("/api/projects/active", {
    headers: { Origin: "https://example.org" },
    data: { id: "00000000-0000-4000-8000-000000000000" },
  });
  expect(cross.status()).toBe(403);
});

test("Magic-Link-Formular sendet PKCE-Anfrage mit Callback (Versand abgefangen)", async ({
  page,
}) => {
  await page.route("**/auth/v1/otp*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill("phase2@example.org");
  const requestPromise = page.waitForRequest((r) =>
    r.url().includes("/auth/v1/otp"),
  );
  await page.getByRole("button", { name: "Anmeldelink anfordern" }).click();
  const request = await requestPromise;
  expect(request.postDataJSON().email).toBe("phase2@example.org");
  expect(request.postDataJSON().code_challenge).toBeTruthy();
  expect(new URL(request.url()).searchParams.get("redirect_to")).toContain(
    "/auth/callback",
  );
  await expect(page.getByRole("status")).toContainText(
    "Anmeldelink verschickt",
  );
});
