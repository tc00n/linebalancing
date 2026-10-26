import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // Rechen- und Importlogik braucht kein DOM; Komponententests setzen
    // bei Bedarf `// @vitest-environment jsdom` im Kopf der Datei.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.{ts,tsx}"],
  },
});
