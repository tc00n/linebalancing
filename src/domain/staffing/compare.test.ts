import { describe, it, expect } from "vitest";
import { scenario } from "../testing/builders";
import { compareStaffing } from "./compare";
import { stationKey, type StaffingPlan } from "./model";
const plan = (
  rows: Partial<StaffingPlan["rows"][number]>[] = [],
): StaffingPlan => ({
  filename: "Plan.xlsx",
  taktMin: 70,
  grossFactor: 1.2,
  warnings: [],
  actuals: [{ costCenter: "353", actual: 12, sourceGross: 99 }],
  rows: rows.map((r, i) => ({
    sourceRow: i + 3,
    area: "Linie",
    teamSpeaker: "DE",
    costCenter: "353",
    station: "T17",
    support: false,
    productive: 0.5,
    gross: 0.6,
    ...r,
  })),
});
describe("Produktiver Personalabgleich", () => {
  it("erhaelt Teilbesetzungen und berechnet Arbeitsinhalt ohne Zwischenrundung", () => {
    const input = scenario([
      { id: "A", station: "T17", employee: "MA1", time: 35 },
    ]);
    const p = plan([{}]);
    const result = compareStaffing(input, p);
    expect(result.stations[0]).toMatchObject({
      workloadFte: 0.5,
      deltaFte: 0,
      plannedCapacity: 35,
      capacityExceeded: false,
    });
    expect(input.taktMin).not.toBe(70);
  });
  it("vergleicht immer gegen 70 und nimmt den Szenariozuschlag nur einmal auf", () => {
    const input = {
      ...scenario([{ id: "A", station: "T17", employee: "MA1", time: 70 }]),
      taktMin: 90,
      allowancePct: 10,
    };
    const result = compareStaffing(input, plan([{ productive: 1 }]))
      .stations[0];
    expect(result.workloadWithAllowance).toBe(77);
    expect(result.workloadFte).toBe(1.1);
    expect(result.over70).toBe(true);
  });
  it("weist unzugeordnete Schritte aus und nimmt sie nicht in den Arbeitsinhalt auf", () => {
    const input = scenario([
      { id: "A", station: "T17", employee: null, time: 140 },
    ]);
    const result = compareStaffing(input, plan([{}]));
    expect(result.incomplete).toBe(true);
    expect(result.stations[0]).toMatchObject({
      workloadFte: 0,
      unassignedCount: 1,
    });
  });
  it("stellt fehlende Stationen nicht als Nullbedarf oder vollstaendige Kostenstelle dar", () => {
    const input = scenario([
      { id: "A", station: "T17", employee: "MA1", time: 70 },
    ]);
    const result = compareStaffing(
      input,
      plan([{ productive: 1 }, { station: "T18", productive: 2 }]),
    );
    expect(result.costs[0]).toMatchObject({
      plannedProductive: 3,
      coveredPlanFte: 1,
      coveredWorkloadFte: 1,
      completeCoverage: false,
    });
    expect(result.unmatchedPlan).toHaveLength(1);
  });
  it("trennt Brutto vom produktiven Vergleich und erkennt fehlerhafte Excel-Summen", () => {
    const input = scenario([
      { id: "A", station: "T17", employee: "MA1", time: 70 },
    ]);
    const result = compareStaffing(
      input,
      plan([
        { productive: 1, gross: 1.3 },
        { station: "Teamsprecher", support: true, productive: 1, gross: 1.3 },
      ]),
    );
    expect(result.costs[0]).toMatchObject({
      plannedProductive: 1,
      plannedGross: 2.6,
      grossGap: -9.4,
      sourceMismatch: true,
    });
    expect(result.support).toHaveLength(1);
    expect(result.totalPlanRows).toBe(1);
  });
  it("behandelt Nullplanung als Null und unbekannte oder mehrdeutige Stationen als offen", () => {
    const input = scenario([
      { id: "A", station: "T17", employee: "MA1", time: 70 },
    ]);
    expect(
      compareStaffing(input, plan([{ productive: 0 }])).stations[0],
    ).toMatchObject({
      plannedCapacity: 0,
      capacityExceeded: true,
      deltaFte: 1,
    });
    expect(
      compareStaffing(input, plan([{ station: "T18" }])).stations[0].deltaFte,
    ).toBeNull();
    expect(compareStaffing(input, plan([{}, {}])).stations[0]).toMatchObject({
      ambiguous: true,
      plan: null,
    });
  });
  it("normalisiert nur Taktstationsnummern und teilt Sammelstationen nicht auf", () => {
    expect(stationKey(" t01 ")).toBe(stationKey("T1"));
    expect(stationKey("VA04/05")).not.toBe(stationKey("VA04"));
  });
});
