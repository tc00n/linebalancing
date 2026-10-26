import { describe, expect, it } from "vitest";
import { scenario } from "../testing/builders";
import { withUniqueEmployeeLabels } from "./employees";
import { assertValidScenario } from "./validate";

describe("Eindeutige Mitarbeiterbezeichnungen (E40)", () => {
  it("nummeriert Szenarien mit „Mitarbeiter 1“ je Station linienweit neu", () => {
    // Bestand vor der Durchnummerierung: jede Station hat einen eigenen „MA1“;
    // die Person von S3 arbeitet zusätzlich als Springer an S1.
    const legacy = scenario(
      [
        { id: "A", station: "S1", employee: "MA1", time: 1 },
        { id: "B", station: "S1", employee: "MA2", time: 1 },
        { id: "C", station: "S2", employee: "MA1", time: 1 },
        { id: "D", station: "S3", employee: "MA1", time: 1 },
      ],
      {},
    );
    const input = {
      ...legacy,
      employees: [
        ...legacy.employees,
        { id: "S1/MA1 (2)", stationId: "S1", label: "MA1", personId: "S3/MA1" },
      ],
    };
    const unique = withUniqueEmployeeLabels(input);
    expect(unique.employees.map((e) => [e.id, e.label])).toEqual([
      ["S1/MA1", "Mitarbeiter 1"],
      ["S1/MA2", "Mitarbeiter 2"],
      ["S2/MA1", "Mitarbeiter 3"],
      ["S3/MA1", "Mitarbeiter 4"],
      ["S1/MA1 (2)", "Mitarbeiter 4"],
    ]);
    expect(() => assertValidScenario(unique)).not.toThrow();
  });

  it("lässt eindeutige Bezeichnungen und Springer unverändert", () => {
    const input = scenario(
      [
        { id: "A", station: "S1", employee: "MA1", time: 1 },
        { id: "B", station: "S2", employee: "MA1", time: 1 },
        { id: "C", station: "S2", employee: "MA2", time: 1 },
      ],
      { springers: ["MA1"] },
    );
    expect(withUniqueEmployeeLabels(input)).toBe(input);
  });
});
