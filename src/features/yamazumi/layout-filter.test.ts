import { describe, expect, it } from "vitest";
import { evaluateScenario } from "@/domain/calc/evaluate";
import { scenario } from "@/domain/testing/builders";
import {
  applyFilter,
  buildColumns,
  EMPTY_FILTER,
  isFilterActive,
  UNASSIGNED,
  type StepFilter,
} from "./layout";

const base = scenario(
  [
    { id: "A", station: "S1", employee: "MA1", time: 2 },
    { id: "B", station: "S1", employee: "MA2", time: 3 },
    { id: "C", station: "S1", employee: "MA1", time: 1.5, predecessors: ["B"] },
    { id: "D", station: "S2", employee: "MA1", time: 1 },
    { id: "U", station: "S2", employee: null, time: 0.5 },
  ],
  { takt: 4, allowancePct: 10 },
);
const input = {
  ...base,
  steps: base.steps.map((s) => ({
    ...s,
    categoryId: s.id === "C" ? "nva" : "va",
  })),
};
const columns = buildColumns(input, evaluateScenario(input));
const filter = (
  f: Partial<{ [K in keyof StepFilter]: string[] }>,
): StepFilter => ({
  stationIds: new Set(f.stationIds ?? []),
  employeeLabels: new Set(f.employeeLabels ?? []),
  categoryIds: new Set(f.categoryIds ?? []),
});

describe("applyFilter (E8, F128)", () => {
  it("lässt die Darstellung ohne aktiven Filter unverändert", () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(applyFilter(columns, input, EMPTY_FILTER)).toEqual(columns);
  });

  it("stapelt passende Arbeitsgänge lückenlos ohne Warte- und Zuschlagssegmente", () => {
    const [s1] = applyFilter(columns, input, filter({ categoryIds: ["nva"] }));
    expect(s1.lanes[0].segments).toEqual([
      { kind: "step", stepId: "C", from: 0, to: 1.5 },
    ]);
    expect(s1.lanes[1].segments).toEqual([]);
    expect(s1).toMatchObject({ height: 1.5, overTakt: false, filtered: true });
  });

  it("blendet Stationen und Mitarbeiter außerhalb des Filters aus", () => {
    const result = applyFilter(
      columns,
      input,
      filter({ stationIds: ["S1"], employeeLabels: ["MA2"] }),
    );
    expect(result.map((c) => c.station.id)).toEqual(["S1"]);
    expect(result[0].lanes.map((l) => l.employee.label)).toEqual(["MA2"]);
    expect(result[0].height).toBe(3);
  });

  it("zeigt nicht zugeordnete Arbeitsgänge nur, wenn sie zum Mitarbeiterfilter passen", () => {
    const withUnassigned = applyFilter(
      columns,
      input,
      filter({ employeeLabels: [UNASSIGNED] }),
    );
    expect(
      withUnassigned[1].unassigned.map((s) => "stepId" in s && s.stepId),
    ).toEqual(["U"]);
    expect(withUnassigned[1].lanes).toEqual([]);
    const onlyMa1 = applyFilter(
      columns,
      input,
      filter({ employeeLabels: ["MA1"] }),
    );
    expect(onlyMa1[1].unassigned).toEqual([]);
  });
});
