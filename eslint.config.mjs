import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Rechenkern und Fachlogik bleiben rein: kein UI, kein Framework, kein Datenzugriff.
    files: ["src/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "next", "next/*", "@supabase/*"],
              message:
                "src/domain/ muss frei von UI, Framework und Datenbank bleiben.",
            },
            {
              group: ["@/*", "!@/domain/*"],
              message: "src/domain/ darf nur aus src/domain/ importieren.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
