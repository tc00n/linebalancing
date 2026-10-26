import { existsSync } from "node:fs";
import { basename } from "node:path";
import ExcelJS from "exceljs";
import { validateRows } from "@/domain/import/validateRows";
import { createTemplate, readWorkbook } from "@/features/import/workbook";
import { convertDiagramSheet, fillTemplate, findDiagramSheet } from "./convert";

// Aufruf: npx tsx scripts/zeitaufnahme/cli.ts <Zeitaufnahme.xlsx> <Importdatei.xlsx> [--force]
async function main() {
  const [input, output, flag] = process.argv.slice(2);
  if (!input || !output) {
    console.error(
      "Aufruf: npx tsx scripts/zeitaufnahme/cli.ts <Zeitaufnahme.xlsx> <Importdatei.xlsx> [--force]",
    );
    process.exit(2);
  }
  if (existsSync(output) && flag !== "--force") {
    console.error(`${output} existiert bereits. Mit --force überschreiben.`);
    process.exit(2);
  }

  const source = new ExcelJS.Workbook();
  await source.xlsx.readFile(input);
  const sheet = findDiagramSheet(source);
  if (!sheet) throw new Error("Kein Blatt mit „Diagramm“ im Namen gefunden.");
  const conversion = convertDiagramSheet(sheet);

  const target = new ExcelJS.Workbook();
  await target.xlsx.load(await createTemplate());
  fillTemplate(target, conversion, basename(input));
  const buffer = (await target.xlsx.writeBuffer()) as ArrayBuffer;
  await target.xlsx.writeFile(output);

  // Gegenprobe mit der Importprüfung der App.
  const read = await readWorkbook(buffer);
  if (!read.ok) throw new Error(read.message);
  const check = validateRows(read.rows);
  const errors = check.messages.filter((m) => m.severity === "error");
  const stations = new Set(conversion.rows.map((r) => r.values.station));

  console.log(
    `${conversion.rows.length} Arbeitsgänge an ${stations.size} Stationen → ${output}`,
  );
  console.log(
    `Importprüfung: ${errors.length} Fehler, ${check.messages.length - errors.length} Warnungen`,
  );
  for (const e of errors) console.log(`  Zeile ${e.rowNumber}: ${e.message}`);
  console.log(`Hinweise (${conversion.notes.length}):`);
  for (const note of conversion.notes) console.log(`  ${note}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
