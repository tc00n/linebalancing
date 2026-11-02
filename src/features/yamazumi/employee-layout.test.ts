import { describe, expect, it } from "vitest";
import { evaluateScenario } from "@/domain/calc/evaluate";
import { scenario } from "@/domain/testing/builders";
import {
  alignBarSlots,
  barsMaximum,
  buildEmployeeBars,
  PROCESS_BAR,
  UNASSIGNED_BAR,
} from "./employee-layout";
import { EMPTY_FILTER } from "./layout";

// MA1 (Springer): A an S1 0–2, D an S2 2–2,5, wartet auf B bis 3, C an S1 3–4,5.
// MA2 an S1: B 0–3. Prozesszeit P an S1 2–6. Takt 4,5, Zuschlag 10 %.
const input = scenario(
  [
    { id: "A", station: "S1", employee: "MA1", time: 2 },
    { id: "B", station: "S1", employee: "MA2", time: 3 },
    { id: "C", station: "S1", employee: "MA1", time: 1.5, predecessors: ["B"] },
    { id: "D", station: "S2", employee: "MA1", time: 0.5 },
    { id: "U", station: "S2", employee: null, time: 0.5 },
    { id: "P", station: "S1", time: 4, process: true, predecessors: ["A"] },
  ],
  {
    takt: 4.5,
    allowancePct: 10,
    springers: ["MA1"],
    idleEmployees: ["S2/MA3"],
  },
);
const result = evaluateScenario(input);
const stacked = buildEmployeeBars(input, result, { arrangement: "stacked" });
const timed = buildEmployeeBars(input, result, { arrangement: "timed" });
const bar = (bars: typeof stacked, key: string) =>
  bars.find((b) => b.key === key)!;

describe("buildEmployeeBars (E45)", () => {
  it("bildet je Person einen Balken in Linienreihenfolge, danach ohne Mitarbeiter und Prozesszeiten", () => {
    expect(stacked.map((b) => b.key)).toEqual([
      "ma1",
      "ma2",
      "ma3",
      UNASSIGNED_BAR,
      PROCESS_BAR,
    ]);
    expect(bar(stacked, "ma1")).toMatchObject({
      kind: "person",
      label: "MA1",
      employeeIds: ["S1/MA1", "S2/MA1"],
      stationIds: ["S1", "S2"],
    });
  });

  it("stapelt Arbeitsgänge lückenlos je Station, oben Wartezeit und Zuschlag", () => {
    const ma1 = bar(stacked, "ma1");
    expect(ma1.segments).toEqual([
      { kind: "step", stepId: "A", from: 0, to: 2 },
      { kind: "step", stepId: "C", from: 2, to: 3.5 },
      { kind: "step", stepId: "D", from: 3.5, to: 4 },
      { kind: "wait", beforeStepId: "C", from: 4, to: 4.5 },
      { kind: "allowance", from: 4.5, to: expect.closeTo(4.9, 9) },
    ]);
    expect(ma1.groups).toEqual([
      { stationId: "S1", from: 0, to: 3.5 },
      { stationId: "S2", from: 3.5, to: 4 },
    ]);
  });

  it("legt Arbeitsgänge zeitlich korrekt an ihre Startzeit, Wartezeit davor", () => {
    const ma1 = bar(timed, "ma1");
    expect(ma1.segments).toEqual([
      { kind: "step", stepId: "A", from: 0, to: 2 },
      { kind: "step", stepId: "D", from: 2, to: 2.5 },
      { kind: "wait", beforeStepId: "C", from: 2.5, to: 3 },
      { kind: "step", stepId: "C", from: 3, to: 4.5 },
      { kind: "allowance", from: 4.5, to: expect.closeTo(4.9, 9) },
    ]);
    // Wechselt die Person zwischen Stationen, entsteht je Abschnitt eine Gruppe.
    expect(ma1.groups).toEqual([
      { stationId: "S1", from: 0, to: 2 },
      { stationId: "S2", from: 2, to: 2.5 },
      { stationId: "S1", from: 2.5, to: 4.5 },
    ]);
  });

  it("Höhe ist die Gesamtbelegung der Person, rot über Takt in beiden Varianten (F106)", () => {
    for (const bars of [stacked, timed]) {
      const ma1 = bar(bars, "ma1");
      expect(ma1.occupancy).toBeCloseTo(4.9, 9);
      expect(ma1.top).toBeCloseTo(4.9, 9);
      expect(ma1.overTakt).toBe(true);
      expect(bar(bars, "ma2").overTakt).toBe(false);
    }
  });

  it("zeigt Mitarbeiter ohne Arbeitsgang als leeren Balken", () => {
    expect(bar(stacked, "ma3")).toMatchObject({
      segments: [],
      occupancy: 0,
      stationIds: ["S2"],
    });
  });

  it("stapelt nicht zugeordnete Arbeitsgänge und Prozesszeiten in eigenen Balken, nicht eingerechnet", () => {
    expect(bar(stacked, UNASSIGNED_BAR)).toMatchObject({
      kind: "unassigned",
      segments: [{ kind: "unassigned", stepId: "U", from: 0, to: 0.5 }],
      groups: [{ stationId: "S2", from: 0, to: 0.5 }],
      overTakt: false,
    });
    // Auch zeitlich korrekt gestapelt, weil sich Prozesszeiten mehrerer Stationen überlappen.
    expect(bar(timed, PROCESS_BAR)).toMatchObject({
      kind: "process",
      segments: [{ kind: "process", stepId: "P", from: 0, to: 4 }],
      groups: [{ stationId: "S1", from: 0, to: 4 }],
      occupancy: 4,
      overTakt: false,
    });
  });

  it("unterscheidet gleich benannte Personen über ihre Stationen", () => {
    const old = scenario([
      { id: "A", station: "S1", employee: "MA1", time: 1 },
      { id: "B", station: "S2", employee: "MA1", time: 2 },
    ]);
    const bars = buildEmployeeBars(old, evaluateScenario(old), {
      arrangement: "stacked",
    });
    expect(bars.map((b) => b.label)).toEqual(["MA1 (S1)", "MA1 (S2)"]);
    expect(new Set(bars.map((b) => b.key)).size).toBe(2);
  });

  it("sortiert nach Belegung absteigend, Sonderbalken bleiben am Ende", () => {
    const bars = buildEmployeeBars(input, result, {
      arrangement: "stacked",
      order: "load",
    });
    expect(bars.map((b) => b.key)).toEqual([
      "ma1",
      "ma2",
      "ma3",
      UNASSIGNED_BAR,
      PROCESS_BAR,
    ]);
    const swapped = scenario(
      [
        { id: "A", station: "S1", employee: "MA1", time: 1 },
        { id: "B", station: "S1", employee: "MA2", time: 3 },
      ],
      { takt: 5 },
    );
    expect(
      buildEmployeeBars(swapped, evaluateScenario(swapped), {
        arrangement: "stacked",
        order: "load",
      }).map((b) => b.key),
    ).toEqual(["ma2", "ma1"]);
  });

  it("Höchstwert der Achse berücksichtigt Takt und alle Balken", () => {
    expect(barsMaximum(stacked, 4.5)).toBeCloseTo(4.9, 9);
    expect(barsMaximum([], 5)).toBe(5);
  });
});

describe("Filter in der Mitarbeiteransicht (E8, E45)", () => {
  it("zeigt je Mitarbeiter nur passende Arbeitsgänge lückenlos, ohne Warte- und Zuschlagszeit", () => {
    const bars = buildEmployeeBars(input, result, {
      arrangement: "timed",
      filter: { ...EMPTY_FILTER, stationIds: new Set(["S1"]) },
    });
    expect(bars.map((b) => b.key)).toEqual(["ma1", "ma2", PROCESS_BAR]);
    expect(bar(bars, "ma1")).toMatchObject({
      segments: [
        { kind: "step", stepId: "A", from: 0, to: 2 },
        { kind: "step", stepId: "C", from: 2, to: 3.5 },
      ],
      occupancy: 3.5,
      top: 3.5,
      overTakt: false,
      filtered: true,
    });
  });

  it("blendet beim Mitarbeiterfilter andere Mitarbeiter und die Prozesszeiten aus", () => {
    const bars = buildEmployeeBars(input, result, {
      arrangement: "stacked",
      filter: { ...EMPTY_FILTER, employeeLabels: new Set(["MA2"]) },
    });
    expect(bars.map((b) => b.key)).toEqual(["ma2"]);
  });
});

describe("alignBarSlots (Ist/Ziel, E45)", () => {
  it("gleicht Mitarbeiter über die Bezeichnung ab, fehlende bleiben als Platz", () => {
    const ziel = scenario(
      [
        { id: "A", station: "S1", employee: "MA1", time: 1 },
        { id: "B", station: "S2", employee: "MA4", time: 2 },
      ],
      { takt: 5 },
    );
    const zielBars = buildEmployeeBars(ziel, evaluateScenario(ziel), {
      arrangement: "stacked",
    });
    expect(alignBarSlots([stacked, zielBars], "line")).toEqual([
      { key: "ma1", label: "MA1" },
      { key: "ma2", label: "MA2" },
      { key: "ma3", label: "MA3" },
      { key: "ma4", label: "MA4" },
      { key: UNASSIGNED_BAR, label: "ohne MA" },
      { key: PROCESS_BAR, label: "Prozess" },
    ]);
  });
});
