// Automatische Prüfungen für den Fullstack-Review (nur lesend bzw. mit Rollback).
// Aufruf aus dem Repository: node .claude/skills/fullstack-review/scripts/run-checks.mjs [--quick]
// --quick: ohne Build und Browsertests. Wendet keine Migration an, pusht nicht,
// legt keine Cloud-Testkonten an. Zugangsdaten werden in allen Ausgaben ausgeblendet.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const quick = process.argv.includes("--quick");
const hasEnv = existsSync(resolve(root, ".env.local"));

const SECRET_PATTERNS = [
  /postgres(?:ql)?:\/\/\S+/g,
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /gh[opsu]_[A-Za-z0-9]{20,}/g,
];
// Farbcodes entfernen, damit Ausgaben lesbar und durchsuchbar bleiben.
const ANSI = /\x1b\[[0-9;]*m/g;
const redact = (text) =>
  SECRET_PATTERNS.reduce(
    (t, p) => t.replace(p, "[ausgeblendet]"),
    text.replace(ANSI, ""),
  );

function run(command, timeoutMin) {
  const started = Date.now();
  const r = spawnSync(command, {
    cwd: root,
    shell: true,
    encoding: "utf8",
    timeout: timeoutMin * 60_000,
    env: { ...process.env, FORCE_COLOR: "0", CI: process.env.CI ?? "" },
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    ok: r.status === 0,
    timedOut: r.error?.code === "ETIMEDOUT",
    seconds: Math.round((Date.now() - started) / 1000),
    output: redact(`${r.stdout ?? ""}\n${r.stderr ?? ""}`).trim(),
  };
}

const tail = (text, lines = 25) => text.split(/\r?\n/).slice(-lines).join("\n");

const results = [];
function check(name, command, { timeoutMin = 10, skip, summary } = {}) {
  if (skip) {
    results.push({ name, status: "übersprungen", note: skip });
    console.log(`– ${name}: übersprungen (${skip})`);
    return;
  }
  process.stdout.write(`… ${name} `);
  const r = run(command, timeoutMin);
  const note = summary?.(r.output) ?? "";
  const status = r.timedOut ? "Zeitüberschreitung" : r.ok ? "OK" : "FEHLER";
  results.push({ name, status, note, seconds: r.seconds });
  console.log(`→ ${status} (${r.seconds} s)${note ? " · " + note : ""}`);
  if (!r.ok) console.log(indent(tail(r.output)));
}
const indent = (t) => t.replace(/^/gm, "    ");
const grab = (re) => (out) => out.match(re)?.[0] ?? "";

// 1. Arbeitsstand
const status = run("git status --short", 1).output;
const branch = run("git status -sb", 1).output.split(/\r?\n/)[0];
console.log(`Arbeitsstand: ${branch}`);
console.log(
  status ? `Nicht committet:\n${indent(status)}` : "Arbeitsverzeichnis sauber.",
);
console.log();

// 2. Code
check("Format", "npm run format:check", {
  summary: grab(/All matched files use Prettier code style!|\d+ files? .*/),
});
check("Lint", "npm run lint");
check("Typecheck", "npm run typecheck");
check("Unit-Tests", "npm test", {
  summary: grab(/Tests\s+\d+ (?:passed|failed)[^\n]*/),
});
check("Build", "npm run build", {
  timeoutMin: 15,
  skip: quick && "--quick",
});
check("Browsertests (UI)", "npx playwright test", {
  timeoutMin: 20,
  skip: quick && "--quick",
  summary: grab(/\d+ (?:passed|failed)[^\n]*/),
});
check("Browsertests (Anmeldung, Produktionsbuild)", "npm run e2e:auth", {
  timeoutMin: 10,
  skip: quick && "--quick",
  summary: grab(/\d+ (?:passed|failed)[^\n]*/),
});

// 3. Datenbank (Rollback bzw. nur Vorschau)
check("Datenbanktests (Rollback)", "npm run db:test:remote", {
  timeoutMin: 5,
  skip: !hasEnv && "keine .env.local",
  summary: grab(/\d+ Datenbanktests bestanden/),
});
check("Migrationsvorschau", "npm run db:migrate:preview", {
  timeoutMin: 3,
  skip: !hasEnv && "keine .env.local",
  summary: (out) => {
    const pending = out.match(/"migrations":\[([^\]]*)\]/)?.[1];
    if (pending === undefined) return "";
    return pending ? `AUSSTEHEND: ${pending}` : "Datenbank aktuell";
  },
});

// 4. CI auf GitHub
const gh = ["gh", '"C:\\Program Files\\GitHub CLI\\gh.exe"'].find(
  (cmd) => run(`${cmd} --version`, 1).ok,
);
check(
  "CI (letzte Läufe auf GitHub)",
  `${gh} run list --limit 5 --json headSha,status,conclusion,displayTitle --jq ".[] | \\"\\(.headSha[0:7]) \\(.status) \\(.conclusion) \\(.displayTitle)\\""`,
  {
    timeoutMin: 2,
    skip: !gh && "GitHub-CLI nicht installiert oder nicht angemeldet",
    summary: (out) => out.split(/\r?\n/)[0] ?? "",
  },
);

// 5. Geheimnisse in versionierten Dateien
{
  const files = run("git ls-files", 1)
    .output.split(/\r?\n/)
    .filter((f) => f && !/\.(png|jpe?g|ico|xlsx|woff2?|crt)$/i.test(f));
  const hits = [];
  const leak = [
    /sb_secret_[A-Za-z0-9_-]{8,}/,
    /SERVICE_ROLE_KEY\s*=/i,
    /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    // Verbindungs-URL mit Passwort, außer der lokalen Docker-Supabase der CI.
    /postgres(?:ql)?:\/\/(?!postgres:postgres@127\.0\.0\.1)[^\s:@/]+:[^\s@/]+@/,
  ];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(resolve(root, file), "utf8");
    } catch {
      continue;
    }
    text.split(/\r?\n/).forEach((line, i) => {
      if (leak.some((p) => p.test(line))) hits.push(`${file}:${i + 1}`);
    });
  }
  results.push({
    name: "Geheimnis-Suche",
    status: hits.length ? "FEHLER" : "OK",
    note: hits.length ? hits.join(", ") : `${files.length} Dateien geprüft`,
  });
  console.log(
    `${hits.length ? "→ FEHLER" : "→ OK"} Geheimnis-Suche: ${results.at(-1).note}`,
  );
}

// Zusammenfassung als Tabelle für den Bericht
console.log("\n| Prüfung | Ergebnis | Bemerkung |\n|---|---|---|");
for (const r of results)
  console.log(
    `| ${r.name} | ${r.status}${r.seconds !== undefined ? ` (${r.seconds} s)` : ""} | ${r.note || ""} |`,
  );
process.exitCode = results.some(
  (r) => r.status !== "OK" && r.status !== "übersprungen",
)
  ? 1
  : 0;
