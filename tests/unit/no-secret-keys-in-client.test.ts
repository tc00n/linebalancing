import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Sicherheitsvorgabe (01_ANFORDERUNGEN, Abschnitt 7): Der Supabase
// Service-Role-/Secret-Key darf niemals im Frontend landen. Alles unter src/
// kann in das Client-Bundle gelangen, daher darf dort kein Verweis darauf stehen.
const FORBIDDEN = [/service[_-]?role/i, /SUPABASE_SECRET_KEY/, /sb_secret_/];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name) ? [path] : [];
  });
}

describe("Client-Code", () => {
  it("enthält keine Verweise auf Supabase-Secret-Keys", () => {
    const offenders = sourceFiles("src").filter((file) => {
      const content = readFileSync(file, "utf8");
      return FORBIDDEN.some((pattern) => pattern.test(content));
    });
    expect(offenders).toEqual([]);
  });
});
