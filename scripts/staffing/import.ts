import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";
import { readStaffingWorkbook } from "../../src/features/staffing/workbook";
import { compareStaffing } from "../../src/domain/staffing/compare";
async function main() {
  const [file, projectId] = process.argv.slice(2);
  if (!file) {
    console.error(
      "Aufruf: npx tsx scripts/staffing/import.ts <Datei.xlsx> [Projekt-UUID]",
    );
    process.exit(1);
  }
  const bytes = readFileSync(file);
  const document = await readStaffingWorkbook(
    Uint8Array.from(bytes).buffer,
    basename(file),
  );
  const comparison = compareStaffing(
    { taktMin: 70, allowancePct: 0, stations: [], employees: [], steps: [] },
    document,
  );
  console.log(
    JSON.stringify(
      {
        filename: document.filename,
        positions: document.rows.length,
        productivePositions: comparison.totalPlanRows,
        productiveTotal: document.rows
          .filter((r) => !r.support)
          .reduce((n, r) => n + r.productive, 0),
        supportTotal: document.rows
          .filter((r) => r.support)
          .reduce((n, r) => n + r.productive, 0),
        cost353: comparison.costs.find((c) => c.costCenter === "353"),
        sourceDiscrepancies: comparison.costs
          .filter((c) => c.sourceMismatch)
          .map((c) => ({
            costCenter: c.costCenter,
            source: c.sourceGross,
            fromRows: c.plannedGross,
          })),
      },
      null,
      2,
    ),
  );
  if (!projectId) process.exit(0);
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const database = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: {
      rejectUnauthorized: true,
      ca: readFileSync("supabase/certs/prod-ca-2021.crt", "utf8"),
    },
  });
  try {
    await database.connect();
    const project = await database.query(
      "select id,name from public.projects where id=$1",
      [projectId],
    );
    if (project.rowCount !== 1) throw Error("Projekt nicht gefunden.");
    const hash = createHash("sha256").update(bytes).digest("hex");
    const result = await database.query(
      "insert into public.staffing_plans(project_id,source_sha256,document,uploaded_by) values($1,$2,$3,null) on conflict(project_id,source_sha256) do nothing returning id",
      [projectId, hash, document],
    );
    console.log(
      result.rowCount === 1
        ? "Referenzplanung im benannten Projekt gespeichert (lokaler Einrichtungsimport, kein Nutzer imitiert)."
        : "Diese Datei ist im Projekt bereits vorhanden.",
    );
  } finally {
    await database.end();
  }
}
main().catch((error) => {
  console.error(
    "Import fehlgeschlagen: " +
      (error instanceof Error ? error.message : "unbekannt"),
  );
  process.exitCode = 1;
});
