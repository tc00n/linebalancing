// Automatischer Lauf des Skills ui-review: Bildschirmfotos und Messungen im lokalen Modus.
// Aufruf aus dem Repository:
//   npx.cmd playwright test --config .claude/skills/ui-review/scripts/ui-review.config.ts
// Ergebnis: %TEMP%\linebalancing-ui-review\ (außerhalb des Repos; npm run e2e leert test-results/).
// Anderer Ort über UI_REVIEW_OUT. Keine Cloud, keine Anmeldung.
import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../../..");
const port = 3210;

export default defineConfig({
  testDir: __dirname,
  testMatch: "capture.spec.ts",
  outputDir: resolve(
    process.env.UI_REVIEW_OUT ?? resolve(tmpdir(), "linebalancing-ui-review"),
    "playwright",
  ),
  workers: 1,
  timeout: 15 * 60_000,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    cwd: root,
    env: { LINEBALANCING_LOCAL_DEV: "1", LINEBALANCING_E2E: "1" },
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
