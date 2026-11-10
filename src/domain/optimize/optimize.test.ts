import { describe, expect, it } from "vitest";
import { evaluateScenario } from "../calc/evaluate";
import { assertValidScenario } from "../model/validate";
import { scenario } from "../testing/builders";
import { optimizeStation } from "./optimize";

const employeeOf = (
  result: ReturnType<typeof optimizeStation>,
  stepId: string,
) => result.input.steps.find((s) => s.id === stepId)!.employeeId;

// MA1 hat alles (12 min), MA2 fast nichts. Beste Aufteilung: 8 / 5.
const unbalanced = () =>
  scenario(
    [
      { id: "A", station: "S1", employee: "MA1", time: 4 },
      { id: "B", station: "S1", employee: "MA1", time: 4 },
      { id: "C", station: "S1", employee: "MA1", time: 4 },
      { id: "D", station: "S1", employee: "MA2", time: 1 },
      { id: "X", station: "S2", employee: "MA3", time: 9 },
    ],
    { takt: 10 },
  );

describe("Verteilungsvorschlag (E43)", () => {
  it("senkt die Stationshöhe auf das Optimum", () => {
    const result = optimizeStation(unbalanced(), {
      stationId: "S1",
      goal: "height",
    });
    expect(result.before).toEqual({ height: 12, persons: 2, unassigned: 0 });
    expect(result.after).toEqual({ height: 8, persons: 2, unassigned: 0 });
    expect(result.reassigned).toBeGreaterThan(0);
    assertValidScenario(result.input);
    // Zeiten, IDs und andere Stationen bleiben unverändert.
    expect(result.input.steps.map((s) => [s.id, s.timeMin])).toEqual(
      unbalanced().steps.map((s) => [s.id, s.timeMin]),
    );
    expect(result.input.steps.find((s) => s.id === "X")).toEqual(
      unbalanced().steps.find((s) => s.id === "X"),
    );
  });

  it("liefert bei gleichem Startwert dasselbe Ergebnis", () => {
    const run = () =>
      optimizeStation(unbalanced(), {
        stationId: "S1",
        goal: "height",
        seed: 7,
      }).input;
    expect(run()).toEqual(run());
  });

  it("hält die Qualifikation ein (E51)", () => {
    // Qualifikation nutzt die Bezeichnungen „Mitarbeiter N“.
    const only1 = ["Mitarbeiter 1"];
    const input = scenario(
      [
        { id: "A", station: "S1", employee: "Mitarbeiter 1", time: 4 },
        { id: "B", station: "S1", employee: "Mitarbeiter 1", time: 4 },
        { id: "C", station: "S1", employee: "Mitarbeiter 1", time: 4 },
        { id: "D", station: "S1", employee: "Mitarbeiter 2", time: 1 },
      ],
      { takt: 10 },
    );
    const restricted = {
      ...input,
      steps: input.steps.map((s) =>
        s.id === "D" ? s : { ...s, qualifiedEmployees: only1 },
      ),
    };
    const result = optimizeStation(restricted, {
      stationId: "S1",
      goal: "height",
    });
    expect(["A", "B", "C"].map((id) => employeeOf(result, id))).toEqual([
      "S1/Mitarbeiter 1",
      "S1/Mitarbeiter 1",
      "S1/Mitarbeiter 1",
    ]);
    // D darf jeder; zu Mitarbeiter 1 gelegt würde die Station nur höher.
    expect(result.after.height).toBe(12);
    assertValidScenario(result.input);
  });

  it("verteilt gemeinsame Arbeitsgänge nie zweimal auf dieselbe Person (E42)", () => {
    const input = scenario(
      [
        { id: "G1", station: "S1", employee: "MA1", time: 3, group: "G" },
        { id: "G2", station: "S1", employee: "MA2", time: 3, group: "G" },
        { id: "A", station: "S1", employee: "MA1", time: 5 },
        { id: "B", station: "S1", employee: "MA1", time: 5 },
      ],
      { takt: 20, idleEmployees: ["S1/MA3"] },
    );
    for (const seed of [1, 2, 3]) {
      const result = optimizeStation(input, {
        stationId: "S1",
        goal: "height",
        seed,
      });
      expect(employeeOf(result, "G1")).not.toBe(employeeOf(result, "G2"));
      assertValidScenario(result.input);
      expect(result.after.height).toBeLessThanOrEqual(8);
    }
  });

  it("ordnet nicht zugeordnete Arbeitsgänge zu", () => {
    const input = scenario(
      [
        { id: "A", station: "S1", employee: "MA1", time: 2 },
        { id: "B", station: "S1", employee: null, time: 2 },
      ],
      { takt: 10, idleEmployees: ["S1/MA2"] },
    );
    const result = optimizeStation(input, { stationId: "S1", goal: "height" });
    expect(result.before.unassigned).toBe(1);
    expect(result.after).toEqual({ height: 2, persons: 2, unassigned: 0 });
  });

  it("Ziel Mitarbeiterzahl: so wenige wie möglich unter Takt, freie Spuren entfallen", () => {
    const input = scenario(
      [
        { id: "A", station: "S1", employee: "MA1", time: 3 },
        { id: "B", station: "S1", employee: "MA2", time: 3 },
        { id: "C", station: "S1", employee: "MA3", time: 3 },
        { id: "D", station: "S1", employee: "MA4", time: 3 },
      ],
      { takt: 7 },
    );
    const result = optimizeStation(input, {
      stationId: "S1",
      goal: "headcount",
    });
    expect(result.after).toEqual({ height: 6, persons: 2, unassigned: 0 });
    expect(result.removedEmployees).toBe(2);
    const evaluated = evaluateScenario(result.input);
    expect(evaluated.stations[0].employeeCount).toBe(2);
    expect(evaluated.stations[0].overTakt).toBe(false);
  });

  it("berücksichtigt Vorgänger und Wartezeit", () => {
    // B wartet auf A. Liegen beide bei verschiedenen Mitarbeitern, entsteht Wartezeit.
    const input = scenario(
      [
        { id: "A", station: "S1", employee: "MA1", time: 3 },
        {
          id: "B",
          station: "S1",
          employee: "MA2",
          time: 3,
          predecessors: ["A"],
        },
        { id: "C", station: "S1", employee: "MA1", time: 3 },
        { id: "D", station: "S1", employee: "MA2", time: 3 },
      ],
      { takt: 20 },
    );
    const result = optimizeStation(input, { stationId: "S1", goal: "height" });
    // Optimum: B startet nach A (3), MA2 macht D davor – Höhe 6 ohne Wartezeit.
    expect(result.after.height).toBe(6);
  });
});
