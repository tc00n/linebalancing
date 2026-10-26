import type { Workbook, Cell } from "exceljs";
import { parseGermanNumber } from "@/domain/import/cells";
import { roundHalfUp } from "@/domain/calc/rounding";
import {
  validateStaffingPlan,
  type StaffingPlan,
  type StaffingRow,
  type CostCenterActual,
} from "@/domain/staffing/model";
import { normalizeCell } from "@/features/import/workbook";
function number(cell: Cell): number | null {
  const raw = normalizeCell(cell.value);
  if (raw === null || raw === "") return null;
  const result = parseGermanNumber(raw);
  return result.ok && Number.isFinite(result.value) && result.value >= 0
    ? result.value
    : null;
}
const text = (cell: Cell) => String(normalizeCell(cell.value) ?? "").trim();
const normalize = (s: string) =>
  s.toLocaleLowerCase("de").replace(/\s+/g, " ").trim();
export function parseStaffingWorkbook(
  workbook: Workbook,
  filename: string,
): StaffingPlan {
  const sheet = workbook.worksheets.find((s) =>
    normalize(s.name).startsWith("personalplanung pro meister"),
  );
  const stock = workbook.worksheets.find(
    (s) => normalize(s.name) === "abgleich akt. personaldicke",
  );
  if (!sheet) throw Error("Das Blatt „Personalplanung pro Meisterbere“ fehlt.");
  const headers: Record<string, number> = {};
  let headerRow = 0;
  for (let n = 1; n <= Math.min(10, sheet.rowCount); n++) {
    if (text(sheet.getCell(n, 1)) === "Meister") {
      headerRow = n;
      sheet.getRow(n).eachCell((cell, col) => {
        headers[normalize(text(cell))] = col;
      });
      break;
    }
  }
  for (const key of [
    "bereich",
    "teamsprecher",
    "kostenstelle",
    "arbeitsplatz/ takt",
    "abschätzung 70/ min",
    "brutto 70 min",
  ])
    if (!headers[key]) throw Error("Erwartete Spalte fehlt: " + key);
  const factorSheet = workbook.worksheets.find(
    (s) => normalize(s.name) === "brutto-personalfaktor",
  );
  const grossFactor = factorSheet ? number(factorSheet.getCell("C9")) : null;
  const rows: StaffingRow[] = [],
    actuals: CostCenterActual[] = [],
    warnings: string[] = [];
  for (let n = headerRow + 1; n <= sheet.rowCount; n++) {
    const get = (key: string) => sheet.getCell(n, headers[key]);
    const area = text(get("bereich")),
      station = text(get("arbeitsplatz/ takt")) || null;
    const costCenter = text(get("kostenstelle")) || null;
    if (normalize(text(sheet.getCell(n, 1))) === "summe") break;
    if (!area && !station && !costCenter) continue;
    const productive = number(get("abschätzung 70/ min"));
    if (productive === null)
      throw Error(
        "Zeile " +
          n +
          ": produktive Besetzung für 70 Minuten fehlt oder ist ungültig.",
      );
    let gross = number(get("brutto 70 min"));
    const formula = get("brutto 70 min").formula?.replace(/\s/g, "");
    const expected = "ROUND(H" + n + "*'Brutto-Personalfaktor'!$C$9,1)";
    if (gross === null && formula === expected && grossFactor !== null) {
      gross = roundHalfUp(productive * grossFactor, 1);
      warnings.push(
        "Zeile " +
          n +
          ": fehlender Excel-Formelwert Brutto aus der hinterlegten Zeilenformel berechnet.",
      );
    }
    if (gross === null)
      warnings.push(
        "Zeile " + n + ": Bruttobedarf ohne gespeicherten Zahlenwert.",
      );
    if (!station)
      warnings.push(
        "Zeile " +
          n +
          ": keine einzelne Station angegeben; nur Kostenstellenplanung.",
      );
    rows.push({
      sourceRow: n,
      area,
      station,
      costCenter,
      teamSpeaker: text(get("teamsprecher")) || null,
      support:
        normalize(station ?? "") === "teamsprecher" ||
        normalize(area) === "teamsprecher",
      productive,
      gross,
    });
  }
  if (stock) {
    const seen = new Set<string>();
    for (let n = 2; n <= stock.rowCount; n++) {
      const costCenter = text(stock.getCell(n, 1));
      if (!/^\d+$/.test(costCenter)) continue;
      if (seen.has(costCenter))
        throw Error(
          "Kostenstelle " +
            costCenter +
            " ist in der Bestandsübersicht doppelt vorhanden.",
        );
      seen.add(costCenter);
      actuals.push({
        costCenter,
        actual: number(stock.getCell(n, 3)),
        sourceGross: number(stock.getCell(n, 2)),
      });
    }
  } else
    warnings.push(
      "Blatt mit vorhandenem Personal fehlt; Bestandsabgleich nicht verfügbar.",
    );
  const plan: StaffingPlan = {
    filename,
    taktMin: 70,
    grossFactor,
    rows,
    actuals,
    warnings,
  };
  validateStaffingPlan(plan);
  return plan;
}
export async function readStaffingWorkbook(
  data: ArrayBuffer,
  filename: string,
): Promise<StaffingPlan> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  return parseStaffingWorkbook(workbook, filename);
}
