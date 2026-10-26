import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
process.loadEnvFile(".env.local");
const require = createRequire(import.meta.url);
const apply = process.argv.includes("--apply");
try {
  const cli = require
    .resolve("supabase/package.json")
    .replace(/package\.json$/, "dist/supabase.js");
  const args = [
    cli,
    "db",
    "push",
    "--db-url",
    process.env.SUPABASE_DB_URL,
    ...(apply ? ["--yes"] : ["--dry-run"]),
  ];
  const { stdout } = await promisify(execFile)(process.execPath, args, {
    shell: false,
    windowsHide: true,
    timeout: 60000,
  });
  // CLI-Ausgabe enthaelt im Normalfall nur Migrationen, vorsorglich DB-URL redigieren.
  console.log(
    stdout.replace(/postgres(?:ql)?:\/\/\S+/g, "[DB-URL ausgeblendet]"),
  );
  console.log(
    apply
      ? "Migrationen angewendet."
      : "Nur Vorschau, keine Migration angewendet.",
  );
} catch (e) {
  console.error(
    "Migration fehlgeschlagen (" +
      (e.code ?? "unbekannt") +
      "). Keine rohe CLI-Ausgabe zum Schutz der Zugangsdaten.",
  );
  process.exitCode = 1;
}
