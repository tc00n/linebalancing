import { buildEmployeeBars } from "@/features/yamazumi/employee-layout";
import { newWorkbook, styleHeader } from "@/features/import/workbook";
import {
  describeIssue,
  type ScenarioView,
} from "@/features/workspace/scenario-view";
import type { ExportMeta } from "./excel-export";

// Arbeitsfolge je Mitarbeiter (E49, F138): welcher Mitarbeiter in welcher
// Reihenfolge welche Arbeitsgänge an welcher Station ausführt.

export const SHEET_SEQUENCE = "Arbeitsfolge";

export const SEQUENCE_COLUMNS = [
  { key: "employee", header: "Mitarbeiter", width: 26 },
  { key: "position", header: "Nr.", width: 6 },
  { key: "station", header: "Station", width: 12 },
  { key: "id", header: "Arbeitsgang-ID", width: 18 },
  { key: "description", header: "Arbeitsgang/Beschreibung", width: 48 },
  { key: "time", header: "Zeit_min", width: 10 },
  { key: "start", header: "Start_min", width: 10 },
  { key: "end", header: "Ende_min", width: 10 },
  { key: "wait", header: "Wartezeit davor_min", width: 12 },
  { key: "note", header: "Hinweis", width: 60 },
] as const;

export const PROCESS_LABEL = "Prozesszeit (ohne Mitarbeiter)";
export const UNASSIGNED_LABEL = "ohne Mitarbeiter";
const PROCESS_NOTE = "Prozesszeit, bindet keinen Mitarbeiter.";

type Key = (typeof SEQUENCE_COLUMNS)[number]["key"];
export type SequenceRow = Record<Key, string | number | null>;

/**
 * Eine Zeile je Arbeitsgang. Mitarbeiter in Linienreihenfolge wie in der
 * Mitarbeiteransicht (E45), je Mitarbeiter in zeitlicher Reihenfolge über alle
 * Einsatzstationen (E40). Danach nicht zugeordnete Arbeitsgänge (nicht
 * eingeplant, F109) und Prozesszeiten (E44). Zeiten ungerundet (P2).
 */
export function workSequenceRows(view: ScenarioView): SequenceRow[] {
  const bars = buildEmployeeBars(view.input, view.result, {
    arrangement: "timed",
    order: "line",
  });
  const rows: SequenceRow[] = [];
  for (const bar of bars) {
    const label =
      bar.kind === "person"
        ? bar.label
        : bar.kind === "process"
          ? PROCESS_LABEL
          : UNASSIGNED_LABEL;
    let position = 0;
    for (const segment of bar.segments) {
      if (
        segment.kind !== "step" &&
        segment.kind !== "unassigned" &&
        segment.kind !== "process"
      ) {
        continue;
      }
      const step = view.steps.get(segment.stepId)!;
      const scheduled = view.scheduled.get(step.id);
      const notes = (view.issuesByStep.get(step.id) ?? []).map((issue) =>
        describeIssue(issue, view),
      );
      if (segment.kind === "process") notes.unshift(PROCESS_NOTE);
      rows.push({
        employee: label,
        position: segment.kind === "step" ? ++position : null,
        station: view.stations.get(step.stationId)!.label,
        id: step.id,
        description: step.description,
        time: step.timeMin,
        start: scheduled?.start ?? null,
        end: scheduled?.end ?? null,
        wait: segment.kind === "step" ? (scheduled?.waitBefore ?? 0) : null,
        note: notes.join(" "),
      });
    }
  }
  return rows;
}

const TITLE_ROWS = 2;

/** Excel-Datei mit der Arbeitsfolge je Mitarbeiter (E49). */
export async function createWorkSequenceExport(
  view: ScenarioView,
  meta: ExportMeta,
): Promise<ArrayBuffer> {
  const workbook = await newWorkbook();
  workbook.creator = "NEONEX Line Balancing";
  const sheet = workbook.addWorksheet(SHEET_SEQUENCE, {
    views: [{ state: "frozen", ySplit: TITLE_ROWS + 1 }],
  });
  sheet.columns = SEQUENCE_COLUMNS.map((c) => ({
    key: c.key,
    width: c.width,
  }));
  sheet.getCell("A1").value =
    `Arbeitsfolge je Mitarbeiter – ${meta.scenarioName}`;
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.getCell("A2").value = `Stand ${meta.stand}`;
  const headerRow = TITLE_ROWS + 1;
  sheet.getRow(headerRow).values = SEQUENCE_COLUMNS.map((c) => c.header);
  styleHeader(sheet, headerRow);
  for (const key of ["time", "start", "end", "wait"] as const) {
    sheet.getColumn(key).numFmt = "0.00";
  }
  sheet.addRows(workSequenceRows(view));
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: SEQUENCE_COLUMNS.length },
  };
  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
