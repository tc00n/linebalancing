// Prüft die Zugangsdaten in .env.local, ohne Werte auszugeben.
// Aufruf: npm run check:env
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const run = promisify(execFile);

function readEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = readEnv(".env.local");
const results = [];
const ok = (text) => results.push(`  ✓ ${text}`);
const warn = (text) => results.push(`  ! ${text}`);
const fail = (text) => results.push(`  ✗ ${text}`);
const redact = (text) =>
  text
    .replace(/postgres(ql)?:\/\/[^\s"']+/g, "postgresql://…")
    .replace(/sb_[a-z]+_[A-Za-z0-9_-]+/g, "sb_…");

// 1) Vollständigkeit und Form, ohne Werte zu zeigen
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const ref = env.SUPABASE_PROJECT_REF ?? "";
const dbUrl = env.SUPABASE_DB_URL ?? "";

console.log("Supabase – App");
if (/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url))
  ok("Project URL hat das erwartete Format");
else
  fail(
    "NEXT_PUBLIC_SUPABASE_URL fehlt oder hat nicht die Form https://<ref>.supabase.co",
  );

if (
  key.startsWith("sb_secret_") ||
  /service_role/.test(Buffer.from(key.split(".")[1] ?? "", "base64").toString())
) {
  fail(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ist ein SECRET-/service_role-Key – sofort entfernen und den Publishable Key eintragen!",
  );
} else if (key.startsWith("sb_publishable_")) ok("Publishable Key gesetzt");
else if (key.startsWith("eyJ"))
  warn(
    "Älterer anon-Key gesetzt (funktioniert; der neue Publishable Key ist vorzuziehen)",
  );
else fail("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fehlt");

// 2) App-Verbindung: Auth-Einstellungen mit dem Publishable Key abrufen
if (url && key && !key.startsWith("sb_secret_")) {
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: key },
    });
    if (response.ok) {
      const settings = await response.json();
      ok("Verbindung zur Supabase-API mit dem Publishable Key funktioniert");
      if (settings.external?.email) ok("E-Mail-Login ist aktiviert");
      else
        warn(
          "E-Mail-Login ist in Supabase deaktiviert (Authentication → Sign In / Providers → Email)",
        );
    } else {
      fail(
        `Supabase-API antwortet mit Status ${response.status} – URL oder Key passen nicht zusammen`,
      );
    }
  } catch (error) {
    fail(
      `Supabase-API nicht erreichbar: ${redact(String(error.message ?? error))}`,
    );
  }
}

console.log(results.splice(0).join("\n"));
console.log("\nSupabase – Datenbank-Einrichtung");
if (/^[a-z0-9]{20}$/.test(ref)) ok("Projekt-Referenz gesetzt");
else
  fail(
    "SUPABASE_PROJECT_REF fehlt oder hat nicht das erwartete Format (20 Zeichen)",
  );
if (url && ref && !url.includes(ref))
  fail("Projekt-Referenz passt nicht zur Project URL");

if (!dbUrl) fail("SUPABASE_DB_URL fehlt");
else if (dbUrl.includes("[YOUR-PASSWORD]"))
  fail("In SUPABASE_DB_URL steht noch der Platzhalter [YOUR-PASSWORD]");
else {
  // Direkte Verbindung und Session-Pooler sind beide zulaessig.
  if (ref && !dbUrl.includes(ref))
    fail(
      "SUPABASE_DB_URL gehört zu einem anderen Projekt als SUPABASE_PROJECT_REF",
    );
  // Eine Direct-Connection-URL enthaelt keine Regionsangabe.
  const dbHost = (() => {
    try {
      return new URL(dbUrl).hostname;
    } catch {
      return "";
    }
  })();
  if (dbHost.includes("eu-central-1"))
    ok("Verbindungsadresse verweist auf Frankfurt (eu-central-1)");
  else if (dbHost.endsWith(".pooler.supabase.com"))
    warn(
      "Pooler-Adresse verweist nicht auf Frankfurt ? Region im Dashboard pruefen",
    );
  else
    warn(
      "Region aus direkter DB-URL nicht ablesbar ? Frankfurt im Dashboard bestaetigen",
    );
  try {
    await run(
      process.execPath,
      [
        require
          .resolve("supabase/package.json")
          .replace(/package\.json$/, "dist/supabase.js"),
        "migration",
        "list",
        "--db-url",
        dbUrl,
      ],
      {
        shell: false,
        windowsHide: true,
        timeout: 120_000,
      },
    );
    ok("Datenbankverbindung mit Passwort funktioniert");
  } catch (error) {
    fail(
      `Datenbankverbindung fehlgeschlagen (Exit ${error.code ?? "unbekannt"}). Zugangsdaten, URL-Kodierung und Erreichbarkeit pruefen; rohe CLI-Ausgabe wird zum Schutz der Zugangsdaten nicht angezeigt.`,
    );
  }
}
console.log(results.splice(0).join("\n"));
