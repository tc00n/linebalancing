import { describe, expect, it } from "vitest";
import { scenario } from "../testing/builders";
import {
  alignedStationLabels,
  movedStepIds,
  stepIdDifferences,
} from "./compare";

const ist = scenario(
  [
    { id: "A", station: "Station 2", employee: "MA1", time: 1 },
    { id: "B", station: "Station 2", employee: "MA1", time: 1 },
    { id: "C", station: "Station 10", employee: "MA1", time: 1 },
  ],
  { emptyStations: ["Station 1"] },
);
const ziel = scenario([
  { id: "A", station: "Station 2", employee: "MA1", time: 1 },
  { id: "B", station: "Station 10", employee: null, time: 1 },
  { id: "C", station: "Station 10", employee: "MA2", time: 1 },
  { id: "D", station: "Station 3", employee: "MA1", time: 1 },
]);

describe("Szenariovergleich", () => {
  it("gleicht Stationen über die Bezeichnung ab und sortiert natürlich (F111, E14)", () => {
    expect(alignedStationLabels(ist, ziel)).toEqual([
      "Station 1",
      "Station 2",
      "Station 3",
      "Station 10",
    ]);
  });

  it("markiert nur Arbeitsgänge mit anderer Station als im Ist (E15)", () => {
    // C wechselt nur den Mitarbeiter, D hat kein Gegenstück.
    expect([...movedStepIds(ist, ziel)]).toEqual(["B"]);
    expect(movedStepIds(ist, ist).size).toBe(0);
  });

  it("findet abweichende Arbeitsgang-IDs (E20)", () => {
    expect(stepIdDifferences(ist, ziel)).toEqual({
      onlyInA: [],
      onlyInB: ["D"],
    });
  });
});
