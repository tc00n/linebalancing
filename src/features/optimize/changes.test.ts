import { describe, expect, it } from "vitest";
import { scenario } from "@/domain/testing/builders";
import { describeChanges } from "./changes";

describe("Änderungen des Verteilungsvorschlags (U13)", () => {
  const before = scenario(
    [
      { id: "A", station: "T17", employee: "Mitarbeiter 1", time: 2 },
      { id: "B", station: "T17", employee: "Mitarbeiter 2", time: 3 },
      { id: "C", station: "T17", employee: "Mitarbeiter 2", time: 1.5 },
      { id: "D", station: "T18", employee: null, time: 1 },
    ],
    { takt: 4, allowancePct: 0 },
  );

  it("nennt Mitarbeiterwechsel und geänderte Reihenfolge je Arbeitsgang", () => {
    const ma1 = before.employees.find((e) => e.label === "Mitarbeiter 1")!;
    const after = {
      ...before,
      steps: before.steps.map((s) =>
        s.id === "C" ? { ...s, employeeId: ma1.id, sequence: 1.5 } : s,
      ),
    };
    expect(describeChanges(before, after, "T17")).toEqual([
      "C: Mitarbeiter 2 → Mitarbeiter 1, Reihenfolge 3 → 1,5",
    ]);
  });

  it("meldet nichts, wenn sich an der Station nichts ändert", () => {
    expect(describeChanges(before, before, "T17")).toEqual([]);
  });
});
