import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { importExample, XLSX_MIME } from "./fixtures";
import { staffingWorkbook } from "./staffing-fixture";
process.loadEnvFile(".env.local");
test.describe.configure({ mode: "serial" });
const owner = randomUUID(),
  editor = randomUUID(),
  password = randomUUID() + "A1!";
const emails = {
  owner: "phase2-" + owner + "@neonex.de",
  editor: "phase2-" + editor + "@example.org",
};
let database: pg.Client, projectId: string, code: string;
let ownerAuth: Awaited<ReturnType<typeof login>>;
async function login(email: string) {
  const jar = new Map<
    string,
    { name: string; value: string; options: CookieOptions }
  >();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => [...jar.values()],
        setAll: (values) => values.forEach((v) => jar.set(v.name, v)),
      },
    },
  );
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw Error("Testanmeldung fehlgeschlagen: " + error.message);
  return { client, cookies: [...jar.values()] };
}
async function useLogin(
  context: BrowserContext,
  auth: Awaited<ReturnType<typeof login>>,
) {
  await context.addCookies(
    auth.cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: "localhost",
      path: "/",
      httpOnly: c.options.httpOnly ?? false,
      secure: false,
      sameSite: "Lax" as const,
    })),
  );
}
/** F64: Szenario über die Navigation verlassen und warten, bis die Sperre freigegeben ist. */
async function leaveScenario(page: Page) {
  const released = page.waitForResponse((r) =>
    r.url().includes("/rpc/release_scenario_lock"),
  );
  await page.getByRole("link", { name: "Szenarien", exact: true }).click();
  expect((await released).ok()).toBe(true);
}
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) =>
    console.log("Browserfehler: " + error.message),
  );
  page.on("response", (response) => {
    if (
      response.url().includes("/api/projects/active") ||
      response.url().includes("/rpc/redeem_project_code")
    )
      console.log("Projektzugang HTTP " + response.status());
  });
});
test.beforeAll(async () => {
  database = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: {
      rejectUnauthorized: true,
      ca: readFileSync("supabase/certs/prod-ca-2021.crt", "utf8"),
    },
  });
  await database.connect();
  for (const [id, email] of [
    [owner, emails.owner],
    [editor, emails.editor],
  ]) {
    await database.query(
      "insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,reauthentication_token,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,extensions.crypt($3,extensions.gen_salt('bf')),now(),'','','','','','','{\"provider\":\"email\",\"providers\":[\"email\"]}','{}',now(),now())",
      [id, email, password],
    );
  }
  ownerAuth = await login(emails.owner);
});
test.afterAll(async () => {
  if (database) {
    await database.query("delete from public.projects where owner_id=$1", [
      owner,
    ]);
    await database.query("delete from auth.users where id=any($1::uuid[])", [
      [owner, editor],
    ]);
    await database.end();
  }
});
test("Owner importiert, dupliziert und speichert ein Cloud-Szenario", async ({
  page,
  context,
}) => {
  await useLogin(context, ownerAuth);
  await page.goto("/projects");
  await expect(
    page.getByRole("heading", { name: "Projekte", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Neues Projekt", { exact: true })
    .fill("Phase 2 Browser-Test " + owner);
  await page
    .getByRole("button", { name: "Projekt anlegen", exact: true })
    .click();
  await expect(page).toHaveURL("http://localhost:3101/", { timeout: 15000 });
  await expect(
    page.getByRole("heading", { name: "Szenarien", exact: true }),
  ).toBeVisible();
  projectId = (await context.cookies()).find(
    (c) => c.name === "neonex-project",
  )!.value;
  const result = await ownerAuth.client.rpc("get_project_code", {
    p_project_id: projectId,
  });
  expect(result.error).toBeNull();
  code = result.data;
  await importExample(page);
  await expect(page.getByText(/zuletzt ge\u00e4ndert/)).toContainText(
    emails.owner,
  );
  await page.getByRole("button", { name: "Duplizieren", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Beispiel XT \u2013 Kopie",
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Beispiel XT \u2013 Kopie",
  );
  const { data, error } = await ownerAuth.client.rpc(
    "list_scenario_documents",
    { p_project_id: projectId },
  );
  expect(error).toBeNull();
  expect(data).toHaveLength(2);
  // Sonst blockiert die Sperre des Owners das Löschen der Kopie im nächsten Test (E26).
  await leaveScenario(page);
});
test("Editor muss Code einloesen und nach neuer Anmeldung erneut eingeben", async ({
  page,
  context,
}) => {
  const first = await login(emails.editor);
  await useLogin(context, first);
  await page.goto("/projects");
  await expect(
    page.getByText("Noch kein Projekt verf\u00fcgbar.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Projektcode", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Projekt beitreten" }).click();
  await expect(page).toHaveURL("http://localhost:3101/", { timeout: 15000 });
  await expect(page.getByText("Beispiel XT", { exact: true })).toBeVisible();
  // E26: Editoren d\u00fcrfen Szenarien endg\u00fcltig l\u00f6schen; die Variante bleibt mit dem Original bestehen.
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", {
      name: "Szenario Beispiel XT \u2013 Kopie l\u00f6schen",
    })
    .click();
  await expect(
    page.getByText("Beispiel XT \u2013 Kopie", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Beispiel XT", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Öffnen", exact: true }).first().click();
  const takt = page.getByLabel("Takt [min]");
  await takt.fill("5");
  await takt.press("Enter");
  await expect(page.getByText("gespeichert", { exact: true })).toBeVisible();
  await expect(
    page.locator("p:visible").filter({ hasText: /zuletzt geändert/ }),
  ).toContainText(emails.editor);
  await page.reload();
  await expect(page.getByLabel("Takt [min]")).toHaveValue("5,00");
  await leaveScenario(page);
  const second = await login(emails.editor);
  await context.clearCookies();
  await useLogin(context, second);
  await page.goto("/projects");
  await expect(
    page.getByText("Noch kein Projekt verf\u00fcgbar.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Projektcode", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Projekt beitreten" }).click();
  await expect(page).toHaveURL("http://localhost:3101/", { timeout: 15000 });
  await page.getByRole("button", { name: "Abmelden", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("Szenariosperre: zweiter Nutzer schreibgeschuetzt, Uebernahme und Freigabe (E27)", async ({
  page,
  context,
  browser,
}) => {
  await useLogin(context, ownerAuth);
  await page.goto("/projects");
  await page
    .locator("section")
    .filter({ hasText: "Phase 2 Browser-Test " + owner })
    .getByRole("button", { name: "Öffnen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Szenarien", exact: true }),
  ).toBeVisible();
  const { data } = await ownerAuth.client.rpc("list_scenario_documents", {
    p_project_id: projectId,
  });
  const scenarioId = data[0].id;
  await page.goto("/szenario?ist=" + scenarioId);
  await expect(page.getByLabel("Takt [min]")).toBeEnabled();

  // Zweiter Nutzer: gewarnt, schreibgeschützt (F51, F58).
  const editorContext = await browser.newContext();
  const editorPage = await editorContext.newPage();
  await useLogin(editorContext, await login(emails.editor));
  await editorPage.goto("/projects");
  await editorPage.getByLabel("Projektcode", { exact: true }).fill(code);
  await editorPage.getByRole("button", { name: "Projekt beitreten" }).click();
  await expect(editorPage).toHaveURL("http://localhost:3101/", {
    timeout: 15000,
  });
  await editorPage.goto("/szenario?ist=" + scenarioId);
  await expect(
    editorPage.getByText("Wird gerade von " + emails.owner + " bearbeitet"),
  ).toBeVisible();
  await expect(editorPage.getByLabel("Takt [min]")).toBeDisabled();
  await expect(editorPage.getByText("schreibgeschützt").first()).toBeVisible();

  // Übernahme nach Rückfrage; der Owner kann danach nicht mehr speichern.
  editorPage.once("dialog", (dialog) => dialog.accept());
  await editorPage
    .getByRole("button", { name: "Bearbeitung übernehmen" })
    .click();
  await expect(editorPage.getByLabel("Takt [min]")).toBeEnabled();
  const ownerTakt = page.getByLabel("Takt [min]");
  await ownerTakt.fill("6");
  await ownerTakt.press("Enter");
  await expect(
    page.getByText(emails.editor + " hat die Bearbeitung übernommen"),
  ).toBeVisible();
  await expect(page.getByLabel("Takt [min]")).toBeDisabled();
  const editorTakt = editorPage.getByLabel("Takt [min]");
  await editorTakt.fill("7");
  await editorTakt.press("Enter");
  await expect(
    editorPage.getByText("gespeichert", { exact: true }),
  ).toBeVisible();

  // Gelöscht wird ein gerade bearbeitetes Szenario nicht (E26).
  const deletion = await ownerAuth.client.rpc("delete_scenario", {
    p_project_id: projectId,
    p_scenario_id: scenarioId,
  });
  expect(deletion.error?.code).toBe("55P03");

  // F64: Schließen des Tabs gibt die Sperre frei.
  await editorPage.close({ runBeforeUnload: true });
  const probe = randomUUID();
  await expect
    .poll(
      async () =>
        (
          await ownerAuth.client.rpc("acquire_scenario_lock", {
            p_project_id: projectId,
            p_scenario_id: scenarioId,
            p_token: probe,
          })
        ).data?.held,
      { timeout: 10000 },
    )
    .toBe(true);
  await ownerAuth.client.rpc("release_scenario_lock", {
    p_project_id: projectId,
    p_scenario_id: scenarioId,
    p_token: probe,
  });
  await editorContext.close();
});

test("Personalplanung im Cloud-Projekt speichern und wiederfinden", async ({
  page,
  context,
}) => {
  await useLogin(context, ownerAuth);
  await page.goto("/projects");
  const project = page
    .locator("section")
    .filter({ hasText: "Phase 2 Browser-Test " + owner });
  await project.getByRole("button", { name: "Öffnen", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Szenarien", exact: true }),
  ).toBeVisible();
  const { data, error } = await ownerAuth.client.rpc(
    "list_scenario_documents",
    { p_project_id: projectId },
  );
  expect(error).toBeNull();
  await page.goto("/personalplanung?szenario=" + data[0].id);
  await expect(page.getByLabel("Personalplanung (.xlsx)")).toBeEnabled();
  await page.getByLabel("Personalplanung (.xlsx)").setInputFiles({
    name: "Personalplanung Test.xlsx",
    mimeType: XLSX_MIME,
    buffer: await staffingWorkbook(),
  });
  await page
    .getByRole("button", { name: "Personalplanung im Projekt speichern" })
    .click();
  const table = page.getByRole("table", {
    name: "Produktiver Personalabgleich",
  });
  await expect(table.getByRole("row").filter({ hasText: "T17" })).toContainText(
    "3,00",
  );
  await page.reload();
  await expect(table).toContainText("T17");
  await expect(
    page.getByRole("table", { name: "Bruttopersonal und Bestand" }),
  ).toContainText("Excel-Summe weicht");
});
