import { describe, expect, it } from "vitest";
import { evaluateScenario } from "@/domain/calc/evaluate";
import { scenario } from "@/domain/testing/builders";
import { axisMaximum, axisTicks, buildColumns } from "./layout";

describe("buildColumns", () => {
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
      { id: "U2", station: "S1", employee: null, time: 0.5, sequence: 9 },
      { id: "U1", station: "S1", employee: null, time: 1, sequence: 8 },
    ],
    { takt: 4, allowancePct: 10 },
  );
  const [column] = buildColumns(input, evaluateScenario(input));

  it("legt Wartezeit, Schritte und Zuschlag zeitlich korrekt in die Spur (F63, F70, E2)", () => {
    expect(column.lanes[0].employee.id).toBe("S1/MA1");
    expect(column.lanes[0].segments).toEqual([
      { kind: "step", stepId: "A", from: 0, to: 2 },
      { kind: "wait", beforeStepId: "C", from: 2, to: 3 },
      { kind: "step", stepId: "C", from: 3, to: 4.5 },
      { kind: "allowance", from: 4.5, to: 4.5 + 3.5 * 0.1 },
    ]);
  });

  it("stapelt nicht zugeordnete Schritte separat in fester Reihenfolge (E10)", () => {
    expect(column.unassigned).toEqual([
      { kind: "unassigned", stepId: "U1", from: 0, to: 1 },
      { kind: "unassigned", stepId: "U2", from: 1, to: 1.5 },
    ]);
  });

  it("übernimmt Stationshöhe und Überlast aus dem Rechenkern", () => {
    expect(column.height).toBeCloseTo(4.85);
    expect(column.overTakt).toBe(true);
    expect(axisMaximum([column], 4)).toBeCloseTo(4.85);
  });
});

describe("axisTicks", () => {
  it("teilt in 1-2-5-Schritten", () => {
    expect(axisTicks(4.85)).toEqual([0, 1, 2, 3, 4]);
    expect(axisTicks(1.2)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1, 1.2]);
    expect(axisTicks(30)).toEqual([0, 5, 10, 15, 20, 25, 30]);
    expect(axisTicks(0)).toEqual([0]);
  });
});

describe("Prozessspur (E44)", () => {
  const input = scenario(
    [
      { id: "P", station: "S1", employee: "MA1", time: 2 },
      {
        id: "L",
        station: "S1",
        time: 5,
        predecessors: ["P"],
        process: true,
      },
      { id: "U", station: "S1", employee: null, time: 1 },
    ],
    { takt: 4 },
  );
  const [column] = buildColumns(input, evaluateScenario(input));

  it("legt Prozesszeiten zeitlich korrekt in eine eigene Spur, nicht zu den nicht zugeordneten", () => {
    expect(column.process).toEqual([
      { kind: "process", stepId: "L", from: 2, to: 7 },
    ]);
    expect(column.unassigned.map((s) => "stepId" in s && s.stepId)).toEqual([
      "U",
    ]);
    // Hält nicht die Station: Höhe aus dem Mitarbeiter, Achse bis zum Prozessende.
    expect(column.height).toBe(2);
    expect(axisMaximum([column], 4)).toBe(7);
  });
});
