import { COLUMNS, SHEET_STEPS } from "@/domain/import/template";
import { compareStationLabels } from "@/domain/model/stationOrder";
import { compareSteps } from "@/domain/model/stepOrder";
import { isProcess } from "@/domain/model/types";
import {
  columnWidth,
  newWorkbook,
  styleHeader,
} from "@/features/import/workbook";
import {
  describeIssue,
  type ScenarioView,
} from "@/features/workspace/scenario-view";

/** Zusatzspalten hinter den Spalten der Importvorlage; der Import ignoriert sie (E19). */
export const EXTRA_COLUMNS = ["Szenario", "Stand", "Warnungen"] as const;

export interface ExportMeta {
  readonly scenarioName: string;
  /** Stand des Szenarios, z. B. „27.10.2026, 08:30 von a@neonex.de“. */
  readonly stand: string;
}

/**
 * Zeilen im Format der Importvorlage mit aktueller Station und aktuellem Mitarbeiter (F35, E19).
 * Arbeitsgang-ID, Beschreibung und Zeit bleiben wie importiert (F17). Reihenfolge wie in der
 * Tabellenansicht: Flussreihenfolge der Stationen, darin Startzeit.
 */
export function exportRows(view: ScenarioView, meta: ExportMeta) {
  const station = (stationId: string) => view.stations.get(stationId)!.label;
  const start = (id: string) =>
    view.scheduled.get(id)?.start ?? Number.POSITIVE_INFINITY;
  const steps = [...view.input.steps].sort(
    (a, b) =>
      compareStationLabels(station(a.stationId), station(b.stationId)) ||
      start(a.id) - start(b.id) ||
      compareSteps(a, b),
  );
  return steps.map((step) => {
    const template: Record<(typeof COLUMNS)[number]["key"], string | number> = {
      id: step.id,
      station: station(step.stationId),
      description: step.description,
      time: step.timeMin,
      employee: step.employeeId
        ? view.employees.get(step.employeeId)!.label
        : "",
      sequence: step.sequence,
      predecessors: step.predecessorIds.join("; "),
      timeKind: isProcess(step) ? "Prozess" : "Hand",
      holdsStation: isProcess(step) ? (step.holdsStation ? "ja" : "nein") : "",
    };
    return [
      ...COLUMNS.map((c) => template[c.key]),
      meta.scenarioName,
      meta.stand,
      (view.issuesByStep.get(step.id) ?? [])
        .map((issue) => describeIssue(issue, view))
        .join(" "),
    ];
  });
}

/** Excel-Datei des Szenarios; wieder importierbar über die Importvorlage (E19). */
export async function createExcelExport(
  view: ScenarioView,
  meta: ExportMeta,
): Promise<ArrayBuffer> {
  const workbook = await newWorkbook();
  workbook.creator = "NEONEX Line Balancing";
  const sheet = workbook.addWorksheet(SHEET_STEPS, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [
    ...COLUMNS.map((c) => ({
      header: c.header,
      key: c.key,
      width: columnWidth(c.key),
    })),
    { header: EXTRA_COLUMNS[0], key: "scenario", width: 28 },
    { header: EXTRA_COLUMNS[1], key: "stand", width: 34 },
    { header: EXTRA_COLUMNS[2], key: "warnings", width: 70 },
  ];
  sheet.getColumn("time").numFmt = "0.00";
  styleHeader(sheet);
  sheet.addRows(exportRows(view, meta));
  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
