import { defineConfig, devices } from "@playwright/test";

const port = 3200;

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/auth.spec.ts", "**/cloud.spec.ts"],
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Lokale UI-Regressionen. Produktions-Auth wird separat ohne Dev-Modus getestet.
  webServer: {
    command: `npm run dev -- --port ${port}`,
    env: { LINEBALANCING_LOCAL_DEV: "1", LINEBALANCING_E2E: "1" },
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
