// @vitest-environment node
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { evaluateScenario } from "@/domain/calc/evaluate";
import { defaultCategories } from "@/domain/model/categories";
import { applyOperation } from "@/domain/ops/operations";
import { buildScenario } from "@/domain/import/buildScenario";
import { validateRows } from "@/domain/import/validateRows";
import { scenario } from "@/domain/testing/builders";
import { readWorkbook } from "@/features/import/workbook";
import { createScenarioView } from "@/features/workspace/scenario-view";
import { createExcelExport, EXTRA_COLUMNS } from "./excel-export";

// Rechenbeispiel E7 mit Zuordnung, wie sie nach einer Umverteilung aussieht.
function editedView() {
  const input = scenario([
    { id: "A", station: "S1", employee: "Mitarbeiter 1", time: 2 },
    { id: "B", station: "S1", employee: "Mitarbeiter 2", time: 3 },
    {
      id: "C",
      station: "S1",
      employee: "Mitarbeiter 1",
      time: 1.5,
      predecessors: ["B"],
    },
    {
      id: "D",
      station: "S2",
      employee: "Mitarbeiter 3",
      time: 0.76,
      sequence: 2.5,
    },
  ]);
  const doc = { input, categories: defaultCategories() };
  // Umverteilung: D nach S1 (Mitarbeiter wird entfernt, F61), C an MA2.
  const moved = applyOperation(doc, {
    type: "moveStep",
    stepId: "D",
    stationId: "S1",
  });
  if (!moved.ok) throw Error(moved.error);
  const assigned = applyOperation(moved.scenario, {
    type: "assignEmployee",
    stepId: "C",
    employeeId: "S1/Mitarbeiter 2",
  });
  if (!assigned.ok) throw Error(assigned.error);
  const edited = assigned.scenario.input;
  return createScenarioView(
    edited,
    evaluateScenario(edited),
    assigned.scenario.categories,
  );
}

const meta = { scenarioName: "Ziel", stand: "27.10.2026, 08:30 von a@b.de" };

describe("Excel-Export (F35, E19)", () => {
  it("enthält die aktuelle Zuordnung, unveränderte Zeiten und die Zusatzspalten", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createExcelExport(editedView(), meta));
    const sheet = workbook.getWorksheet("Arbeitsgänge")!;
    expect(sheet.getRow(1).values).toEqual([
      undefined,
      "Arbeitsgang-ID",
      "Station",
      "Arbeitsgang/Beschreibung",
      "Zeit_min",
      "Mitarbeiter",
      "Reihenfolge",
      "Vorgänger-IDs",
      ...EXTRA_COLUMNS,
    ]);
    const rows = sheet
      .getRows(2, sheet.rowCount - 1)!
      .map((r) => (r.values as unknown[]).slice(1));
    expect(rows.map((r) => r.slice(0, 7))).toEqual([
      ["A", "S1", "Arbeitsgang A", 2, "Mitarbeiter 1", 1, ""],
      ["B", "S1", "Arbeitsgang B", 3, "Mitarbeiter 2", 2, ""],
      ["C", "S1", "Arbeitsgang C", 1.5, "Mitarbeiter 2", 3, "B"],
      ["D", "S1", "Arbeitsgang D", 0.76, "", 2.5, ""],
    ]);
    expect(rows[0].slice(7, 9)).toEqual([meta.scenarioName, meta.stand]);
    expect(rows[3][9]).toContain("Kein Mitarbeiter zugeordnet");
  });

  it("lässt sich über den normalen Import wieder einlesen", async () => {
    const view = editedView();
    const read = await readWorkbook(await createExcelExport(view, meta));
    if (!read.ok) throw Error(read.message);
    const validated = validateRows(read.rows);
    expect(validated.messages.filter((m) => m.severity === "error")).toEqual(
      [],
    );
    const reimported = buildScenario(validated.rows, {
      taktMin: 4,
      allowancePct: 0,
    });
    const label = (id: string | null) =>
      id === null ? null : reimported.employees.find((e) => e.id === id)!.label;
    expect(
      reimported.steps.map((s) => [
        s.id,
        s.timeMin,
        s.stationId,
        label(s.employeeId),
        s.sequence,
        s.predecessorIds,
      ]),
    ).toEqual([
      ["A", 2, "station:S1", "Mitarbeiter 1", 1, []],
      ["B", 3, "station:S1", "Mitarbeiter 2", 2, []],
      ["C", 1.5, "station:S1", "Mitarbeiter 2", 3, ["B"]],
      ["D", 0.76, "station:S1", null, 2.5, []],
    ]);
  });
});
