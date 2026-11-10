// @vitest-environment node
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { evaluateScenario } from "@/domain/calc/evaluate";
import { defaultCategories } from "@/domain/model/categories";
import { scenario } from "@/domain/testing/builders";
import { createScenarioView } from "@/features/workspace/scenario-view";
import {
  createWorkSequenceExport,
  PROCESS_LABEL,
  SEQUENCE_COLUMNS,
  SHEET_SEQUENCE,
  UNASSIGNED_LABEL,
  workSequenceRows,
} from "./work-sequence";

// MA1 ist Springer an S1 und S2 (E40); C wartet auf B von MA2, E ist eine Prozesszeit (E44).
function view() {
  const input = scenario(
    [
      { id: "A", station: "S1", employee: "MA1", time: 2 },
      { id: "B", station: "S1", employee: "MA2", time: 3 },
      {
        id: "C",
        station: "S1",
        employee: "MA1",
        time: 1.5,
        predecessors: ["B"],
      },
      { id: "E", station: "S1", time: 1, predecessors: ["C"], process: true },
      { id: "D", station: "S2", employee: "MA1", time: 0.25 },
      { id: "F", station: "S2", employee: "MA3", time: 1 },
      { id: "G", station: "S2", time: 0.5 },
    ],
    { takt: 10, springers: ["MA1"] },
  );
  return createScenarioView(
    input,
    evaluateScenario(input),
    defaultCategories(),
  );
}

const pick = (rows: ReturnType<typeof workSequenceRows>) =>
  rows.map((r) => [r.employee, r.position, r.station, r.id]);

describe("Arbeitsfolge je Mitarbeiter (E49)", () => {
  it("listet je Mitarbeiter die Arbeitsgänge in zeitlicher Reihenfolge über alle Stationen", () => {
    const rows = workSequenceRows(view());
    const ma1 = rows.filter((r) => r.employee === "MA1");
    // Zeitliche Folge, auch über Stationsgrenzen (Springer).
    expect(ma1.map((r) => r.position)).toEqual([1, 2, 3]);
    expect(new Set(ma1.map((r) => r.station))).toEqual(new Set(["S1", "S2"]));
    const starts = ma1.map((r) => r.start as number);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    // Linienreihenfolge: MA1, MA2, MA3, dann ohne Mitarbeiter, dann Prozesszeiten.
    expect([...new Set(rows.map((r) => r.employee))]).toEqual([
      "MA1",
      "MA2",
      "MA3",
      UNASSIGNED_LABEL,
      PROCESS_LABEL,
    ]);
  });

  it("zeigt Start, Ende und Wartezeit ungerundet aus der Berechnung", () => {
    const rows = workSequenceRows(view());
    // MA1 erledigt D an S2 in der Wartezeit auf B; danach wartet er vor C noch 0,75 min.
    expect(pick(rows.filter((r) => r.employee === "MA1"))).toEqual([
      ["MA1", 1, "S1", "A"],
      ["MA1", 2, "S2", "D"],
      ["MA1", 3, "S1", "C"],
    ]);
    const c = rows.find((r) => r.id === "C")!;
    expect(c).toMatchObject({ time: 1.5, start: 3, end: 4.5, wait: 0.75 });
    const a = rows.find((r) => r.id === "A")!;
    expect(a).toMatchObject({ position: 1, start: 0, end: 2, wait: 0 });
  });

  it("führt nicht zugeordnete Arbeitsgänge und Prozesszeiten mit Hinweis ohne Nummer auf", () => {
    const rows = workSequenceRows(view());
    expect(pick(rows.filter((r) => r.position === null))).toEqual([
      [UNASSIGNED_LABEL, null, "S2", "G"],
      [PROCESS_LABEL, null, "S1", "E"],
    ]);
    const g = rows.find((r) => r.id === "G")!;
    expect(g.start).toBeNull();
    expect(g.note).toContain("Kein Mitarbeiter zugeordnet");
    const e = rows.find((r) => r.id === "E")!;
    expect(e).toMatchObject({ start: 4.5, end: 5.5 });
    expect(e.note).toContain("Prozesszeit");
  });

  it("schreibt eine Excel-Datei mit Titel, Stand, Kopfzeile und allen Arbeitsgängen", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      await createWorkSequenceExport(view(), {
        scenarioName: "Ziel",
        stand: "10.11.2026, 09:00 von a@b.de",
      }),
    );
    const sheet = workbook.getWorksheet(SHEET_SEQUENCE)!;
    expect(sheet.getCell("A1").value).toBe(
      "Arbeitsfolge je Mitarbeiter – Ziel",
    );
    expect(sheet.getCell("A2").value).toBe(
      "Stand 10.11.2026, 09:00 von a@b.de",
    );
    expect((sheet.getRow(3).values as unknown[]).slice(1)).toEqual(
      SEQUENCE_COLUMNS.map((c) => c.header),
    );
    expect(sheet.getRow(4).getCell(1).value).toBe("MA1");
    expect(sheet.rowCount).toBe(3 + 7);
    expect(sheet.getColumn(6).numFmt).toBe("0.00");
  });
});
