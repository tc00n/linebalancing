import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "cloud.spec.ts",
  workers: 1,
  use: { baseURL: "http://localhost:3101" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start -- --port 3101",
    url: "http://localhost:3101/login",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
