import { describe, expect, it } from "vitest";
import { InvalidScenarioError } from "../model/validate";
import { scenario } from "../testing/builders";
import { evaluateScenario } from "./evaluate";
import { roundHalfUp, roundPercent } from "./rounding";

const employee = (result: ReturnType<typeof evaluateScenario>, id: string) =>
  result.employees.find((e) => e.employeeId === id)!;
const station = (result: ReturnType<typeof evaluateScenario>, id: string) =>
  result.stations.find((s) => s.stationId === id)!;
const timeline = (result: ReturnType<typeof evaluateScenario>, id: string) =>
  employee(result, id).steps.map((s) => [
    s.stepId,
    s.start,
    s.end,
    s.waitBefore,
  ]);

// Verbindliches Rechenbeispiel E7 (docs/OFFENE_ENTSCHEIDUNGEN.md).
const goldenSteps = [
  { id: "A", station: "S1", employee: "MA1", time: 2 },
  { id: "B", station: "S1", employee: "MA2", time: 3 },
  { id: "C", station: "S1", employee: "MA1", time: 1.5, predecessors: ["B"] },
];

describe("Golden-Test E7", () => {
  it("ohne Zuschlag", () => {
    const result = evaluateScenario(scenario(goldenSteps, { takt: 4 }));

    expect(timeline(result, "S1/MA1")).toEqual([
      ["A", 0, 2, 0],
      ["C", 3, 4.5, 1],
    ]);
    expect(timeline(result, "S1/MA2")).toEqual([["B", 0, 3, 0]]);
    expect(roundHalfUp(employee(result, "S1/MA1").occupancy)).toBe(4.5);
    expect(roundHalfUp(employee(result, "S1/MA2").occupancy)).toBe(3);

    const s1 = station(result, "S1");
    expect(roundHalfUp(s1.height)).toBe(4.5);
    expect(s1.overTakt).toBe(true);
    expect(roundPercent(s1.stationUtilization)).toBe(112.5);
    expect(roundPercent(result.kpis.personnelUtilization!)).toBe(93.75);
    expect(roundHalfUp(result.kpis.totalWorkContent)).toBe(6.5);
  });

  it("mit 10 % Zuschlag", () => {
    const result = evaluateScenario(
      scenario(goldenSteps, { takt: 4, allowancePct: 10 }),
    );

    // Zuschlag verschiebt keine Startzeiten (E2).
    expect(timeline(result, "S1/MA1")).toEqual([
      ["A", 0, 2, 0],
      ["C", 3, 4.5, 1],
    ]);
    expect(roundHalfUp(employee(result, "S1/MA1").occupancy)).toBe(4.85);
    expect(roundHalfUp(employee(result, "S1/MA2").occupancy)).toBe(3.3);
    expect(roundHalfUp(station(result, "S1").height)).toBe(4.85);
    expect(roundPercent(station(result, "S1").stationUtilization)).toBe(121.25);
    expect(roundPercent(result.kpis.personnelUtilization!)).toBe(101.88);
    expect(roundHalfUp(result.kpis.totalWorkContent)).toBe(6.5); // E6b: ohne Zuschlag
  });
});

describe("Ablaufplanung (E3, E5)", () => {
  it("zieht eine ausführbare Tätigkeit vor, statt zu warten (Listenplanung)", () => {
    // C hat die kleinere Reihenfolge, wartet aber auf B; A ist sofort ausführbar.
    const result = evaluateScenario(
      scenario([
        {
          id: "C",
          station: "S1",
          employee: "MA1",
          time: 1.5,
          sequence: 1,
          predecessors: ["B"],
        },
        { id: "A", station: "S1", employee: "MA1", time: 2, sequence: 5 },
        { id: "B", station: "S1", employee: "MA2", time: 3, sequence: 2 },
      ]),
    );
    expect(timeline(result, "S1/MA1")).toEqual([
      ["A", 0, 2, 0],
      ["C", 3, 4.5, 1],
    ]);
  });

  it("entscheidet Gleichstand nach Reihenfolge, dann nach Arbeitsgang-ID", () => {
    const result = evaluateScenario(
      scenario([
        { id: "X2", station: "S1", employee: "MA1", time: 1, sequence: 2 },
        { id: "X10", station: "S1", employee: "MA1", time: 1, sequence: 1 },
        { id: "X1", station: "S1", employee: "MA1", time: 1, sequence: 1 },
      ]),
    );
    expect(employee(result, "S1/MA1").steps.map((s) => s.stepId)).toEqual([
      "X1",
      "X10",
      "X2",
    ]);
  });

  it("startet erst nach dem Ende aller Vorgänger", () => {
    const result = evaluateScenario(
      scenario([
        { id: "A", station: "S1", employee: "MA1", time: 1 },
        { id: "B", station: "S1", employee: "MA2", time: 2.5 },
        {
          id: "C",
          station: "S1",
          employee: "MA3",
          time: 1,
          predecessors: ["A", "B"],
        },
      ]),
    );
    expect(timeline(result, "S1/MA3")).toEqual([["C", 2.5, 3.5, 2.5]]);
  });

  it("zählt Leerlauf nach der letzten Tätigkeit nicht als Wartezeit", () => {
    const result = evaluateScenario(
      scenario([{ id: "A", station: "S1", employee: "MA1", time: 1 }], {
        takt: 4,
      }),
    );
    expect(employee(result, "S1/MA1").wait).toBe(0);
    expect(employee(result, "S1/MA1").occupancy).toBe(1);
  });

  it("plant jede Station ab 0, Vorgänger anderer Stationen erzeugen keine Wartezeit (E1a)", () => {
    const result = evaluateScenario(
      scenario([
        { id: "A", station: "S1", employee: "MA1", time: 3 },
        {
          id: "B",
          station: "S2",
          employee: "MA1",
          time: 1,
          predecessors: ["A"],
        },
      ]),
    );
    expect(timeline(result, "S2/MA1")).toEqual([["B", 0, 1, 0]]);
    expect(result.issues).toEqual([]);
  });
});

describe("Nicht zugeordnete Schritte (F109, P4, E4)", () => {
  const input = scenario(
    [
      { id: "A", station: "S1", employee: null, time: 2 },
      { id: "B", station: "S1", employee: "MA1", time: 1, predecessors: ["A"] },
    ],
    { takt: 4 },
  );

  it("schließt sie aus Zeiten und Kennzahlen aus und weist sie gesondert aus", () => {
    const result = evaluateScenario(input);
    expect(timeline(result, "S1/MA1")).toEqual([["B", 0, 1, 0]]);
    expect(result.kpis.totalWorkContent).toBe(1);
    expect(result.kpis.unassignedWorkContent).toBe(2);
    expect(result.kpis.unassignedStepCount).toBe(1);
    expect(result.kpis.incomplete).toBe(true);
    expect(station(result, "S1").unassignedStepIds).toEqual(["A"]);
  });

  it("warnt am Nachfolger, dass die Startzeit unsicher ist", () => {
    expect(evaluateScenario(input).issues).toEqual([
      { kind: "step_unassigned", severity: "warning", stepId: "A" },
      {
        kind: "predecessor_unassigned",
        severity: "warning",
        stepId: "B",
        predecessorId: "A",
      },
    ]);
  });

  it("warnt nicht bei nicht zugeordneten Vorgängern anderer Stationen", () => {
    const result = evaluateScenario(
      scenario([
        { id: "A", station: "S1", employee: null, time: 2 },
        {
          id: "B",
          station: "S2",
          employee: "MA1",
          time: 1,
          predecessors: ["A"],
        },
      ]),
    );
    expect(result.issues.map((i) => i.kind)).toEqual(["step_unassigned"]);
  });
});

describe("Flussreihenfolge und Verletzungen (E1b, E14)", () => {
  it("meldet einen Vorgänger an einer später einsortierten Station als Verletzung", () => {
    const result = evaluateScenario(
      scenario([
        { id: "A", station: "Station 10", employee: "MA1", time: 1 },
        {
          id: "B",
          station: "Station 2",
          employee: "MA1",
          time: 1,
          predecessors: ["A"],
        },
      ]),
    );
    expect(result.issues).toEqual([
      {
        kind: "predecessor_downstream",
        severity: "violation",
        stepId: "B",
        predecessorId: "A",
      },
    ]);
    expect(result.kpis.hasViolations).toBe(true);
  });

  it("akzeptiert Vorgänger an vorgelagerten Stationen (natürliche Sortierung)", () => {
    const result = evaluateScenario(
      scenario([
        { id: "A", station: "Station 2", employee: "MA1", time: 1 },
        {
          id: "B",
          station: "Station 10",
          employee: "MA1",
          time: 1,
          predecessors: ["A"],
        },
      ]),
    );
    expect(result.issues).toEqual([]);
    expect(result.stations.map((s) => s.stationId)).toEqual([
      "Station 2",
      "Station 10",
    ]);
  });
});

describe("Kennzahlen (E6a, F3, F106)", () => {
  it("zählt Mitarbeiter ohne Tätigkeit in Mitarbeiterzahl und Nenner mit", () => {
    const result = evaluateScenario(
      scenario([{ id: "A", station: "S1", employee: "MA1", time: 2 }], {
        takt: 4,
        idleEmployees: ["S1/MA2"],
      }),
    );
    expect(station(result, "S1").employeeCount).toBe(2);
    expect(result.kpis.employeeCount).toBe(2);
    expect(station(result, "S1").personnelUtilization).toBe(0.25);
  });

  it("liefert für Stationen ohne Mitarbeiter Höhe 0 und keine Personalauslastung", () => {
    const result = evaluateScenario(
      scenario([{ id: "A", station: "S1", employee: null, time: 2 }]),
    );
    expect(station(result, "S1")).toMatchObject({
      employeeCount: 0,
      height: 0,
      personnelUtilization: null,
      overTakt: false,
    });
    expect(result.kpis.personnelUtilization).toBeNull();
  });

  it("markiert Überlast erst bei echter Überschreitung des Takts", () => {
    const result = evaluateScenario(
      scenario(
        [
          { id: "A", station: "S1", employee: "MA1", time: 0.1 },
          { id: "B", station: "S1", employee: "MA1", time: 0.2 },
        ],
        { takt: 0.3 },
      ),
    );
    expect(employee(result, "S1/MA1").overTakt).toBe(false); // 0,1 + 0,2 = 0,30000000000000004
    expect(station(result, "S1").overTakt).toBe(false);
  });
});

describe("Eingabeprüfung", () => {
  it.each([
    ["Taktzeit 0", scenario([], { takt: 0 })],
    ["negativer Zuschlag", scenario([], { allowancePct: -5 })],
    [
      "Zeit 0",
      scenario([{ id: "A", station: "S1", employee: "MA1", time: 0 }]),
    ],
    [
      "unbekannter Vorgänger",
      scenario([
        {
          id: "A",
          station: "S1",
          employee: "MA1",
          time: 1,
          predecessors: ["X"],
        },
      ]),
    ],
    [
      "Vorgängerkreis",
      scenario([
        {
          id: "A",
          station: "S1",
          employee: "MA1",
          time: 1,
          predecessors: ["B"],
        },
        {
          id: "B",
          station: "S2",
          employee: "MA1",
          time: 1,
          predecessors: ["A"],
        },
      ]),
    ],
  ])("lehnt %s ab", (_, input) => {
    expect(() => evaluateScenario(input)).toThrow(InvalidScenarioError);
  });

  it("lehnt einen Mitarbeiter einer anderen Station ab", () => {
    const input = scenario([
      { id: "A", station: "S1", employee: "MA1", time: 1 },
      { id: "B", station: "S2", employee: "MA1", time: 1 },
    ]);
    const broken = {
      ...input,
      steps: input.steps.map((s) =>
        s.id === "B" ? { ...s, employeeId: "S1/MA1" } : s,
      ),
    };
    expect(() => evaluateScenario(broken)).toThrow(/gehört nicht zur Station/);
  });
});
