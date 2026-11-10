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

/** Arbeitsgänge eines Balkens der Mitarbeiteransicht (Person, ohne Mitarbeiter, Prozesszeiten). */
type SequenceGroup = { label: string; person: boolean; rows: SequenceRow[] };

/**
 * Eine Zeile je Arbeitsgang. Mitarbeiter in Linienreihenfolge wie in der
 * Mitarbeiteransicht (E45), je Mitarbeiter in zeitlicher Reihenfolge über alle
 * Einsatzstationen (E40). Danach nicht zugeordnete Arbeitsgänge (nicht
 * eingeplant, F109) und Prozesszeiten (E44). Zeiten ungerundet (P2).
 */
export function workSequenceRows(view: ScenarioView): SequenceRow[] {
  return workSequenceGroups(view).flatMap((g) => g.rows);
}

function workSequenceGroups(view: ScenarioView): SequenceGroup[] {
  const bars = buildEmployeeBars(view.input, view.result, {
    arrangement: "timed",
    order: "line",
  });
  const groups: SequenceGroup[] = [];
  for (const bar of bars) {
    const label =
      bar.kind === "person"
        ? bar.label
        : bar.kind === "process"
          ? PROCESS_LABEL
          : UNASSIGNED_LABEL;
    const rows: SequenceRow[] = [];
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
    groups.push({ label, person: bar.kind === "person", rows });
  }
  return groups;
}

const TITLE_ROWS = 2;
const HEADER_ROW = TITLE_ROWS + 1;
const NUMBER_KEYS = ["time", "start", "end", "wait"] as const;

/** Spalten des Blatts je Mitarbeiter: ohne Mitarbeiterspalte, sonst wie die Gesamtliste. */
export const EMPLOYEE_SHEET_COLUMNS = SEQUENCE_COLUMNS.filter(
  (c) => c.key !== "employee",
).map((c) =>
  c.key === "description"
    ? { ...c, width: 44 }
    : c.key === "note"
      ? { ...c, width: 40 }
      : c,
);

/**
 * Gültiger, eindeutiger Excel-Blattname: höchstens 31 Zeichen, ohne
 * \ / ? * [ ] :, Groß-/Kleinschreibung zählt nicht. `used` enthält
 * die vergebenen Namen in Kleinbuchstaben und wird ergänzt.
 */
export function sheetName(label: string, used: Set<string>): string {
  const base =
    label
      .replace(/[\\/?*[\]:]/g, "_")
      .trim()
      .slice(0, 31) || "Blatt";
  let name = base;
  for (let n = 2; used.has(name.toLowerCase()); n++) {
    const suffix = ` (${n})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name.toLowerCase());
  return name;
}

type Column = { key: string; header: string; width: number };

function writeSheet(
  workbook: Awaited<ReturnType<typeof newWorkbook>>,
  name: string,
  columns: readonly Column[],
  title: string,
  subtitle: string,
  rows: readonly SequenceRow[],
  footer: string,
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: HEADER_ROW }],
    // A4 quer, auf Seitenbreite, Kopfzeile auf jeder Seite.
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}`,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.6,
        bottom: 0.6,
        header: 0.3,
        footer: 0.3,
      },
    },
    headerFooter: { oddFooter: footer, evenFooter: footer },
  });
  sheet.columns = columns.map((c) => ({ key: c.key, width: c.width }));
  sheet.getCell("A1").value = title;
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.getCell("A2").value = subtitle;
  sheet.getRow(HEADER_ROW).values = columns.map((c) => c.header);
  styleHeader(sheet, HEADER_ROW);
  for (const key of NUMBER_KEYS) sheet.getColumn(key).numFmt = "0.00";
  sheet.addRows(rows as SequenceRow[]);
  sheet.eachRow((row, n) => {
    if (n > HEADER_ROW) row.alignment = { vertical: "top", wrapText: true };
  });
  sheet.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: HEADER_ROW, column: columns.length },
  };
  return sheet;
}

/**
 * Excel-Datei mit der Arbeitsfolge je Mitarbeiter (E49): zuerst die
 * Gesamtliste, dann ein Blatt je Mitarbeiter zum Ausdrucken auf A4.
 */
export async function createWorkSequenceExport(
  view: ScenarioView,
  meta: ExportMeta,
): Promise<ArrayBuffer> {
  const workbook = await newWorkbook();
  workbook.creator = "NEONEX Line Balancing";
  const groups = workSequenceGroups(view);
  const footer = (who: string) =>
    `&L${escapeFooter(`${who} – ${meta.scenarioName}`)}&RSeite &P von &N`;
  writeSheet(
    workbook,
    SHEET_SEQUENCE,
    SEQUENCE_COLUMNS,
    `Arbeitsfolge je Mitarbeiter – ${meta.scenarioName}`,
    `Stand ${meta.stand}`,
    groups.flatMap((g) => g.rows),
    footer("Arbeitsfolge"),
  );
  const used = new Set([SHEET_SEQUENCE.toLowerCase()]);
  for (const group of groups) {
    if (!group.person || group.rows.length === 0) continue;
    const stations = [...new Set(group.rows.map((r) => String(r.station)))];
    writeSheet(
      workbook,
      sheetName(group.label, used),
      EMPLOYEE_SHEET_COLUMNS,
      `Arbeitsfolge ${group.label} – ${meta.scenarioName}`,
      `${stations.length > 1 ? "Stationen" : "Station"} ${stations.join(", ")} · Stand ${meta.stand}`,
      group.rows,
      footer(group.label),
    );
  }
  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

/** & leitet in Excel-Kopf-/Fußzeilen Steuercodes ein. */
function escapeFooter(text: string) {
  return text.replace(/&/g, "&&");
}
