import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { defaultCategories } from "../model/categories";
import { assertValidScenario } from "../model/validate";
import { scenarioArbitrary } from "../testing/arbitraries";
import { scenario } from "../testing/builders";
import { moveWarning, violationsAfterMove } from "./movePreview";
import {
  applyOperation,
  type EditableScenario,
  type Operation,
} from "./operations";

const editable = (input = base()): EditableScenario => ({
  input,
  categories: defaultCategories(),
});
function base() {
  return scenario(
    [
      { id: "A", station: "S1", employee: "MA1", time: 2 },
      { id: "B", station: "S1", employee: "MA2", time: 3, predecessors: ["A"] },
      { id: "C", station: "S2", employee: "MA1", time: 1, predecessors: ["B"] },
    ],
    { takt: 4 },
  );
}
const apply = (op: Operation, s = editable()) => applyOperation(s, op);
const ok = (op: Operation, s = editable()) => {
  const result = apply(op, s);
  if (!result.ok) throw new Error(result.error);
  return result.scenario;
};
const step = (s: EditableScenario, id: string) =>
  s.input.steps.find((x) => x.id === id)!;

describe("Operationen (Phase 5)", () => {
  it("entfernt den Mitarbeiter beim Stationswechsel (F61)", () => {
    const moved = ok({ type: "moveStep", stepId: "A", stationId: "S2" });
    expect(step(moved, "A")).toMatchObject({
      stationId: "S2",
      employeeId: null,
      timeMin: 2,
    });
  });

  it("lässt den Mitarbeiter, wenn die Station gleich bleibt", () => {
    const s = editable();
    expect(
      apply({ type: "moveStep", stepId: "A", stationId: "S1" }, s),
    ).toEqual({ ok: true, scenario: s });
  });

  it("weist Mitarbeiter zu, auch von anderen Stationen als Springer (F100, E40)", () => {
    expect(
      step(
        ok({ type: "assignEmployee", stepId: "A", employeeId: "S1/MA2" }),
        "A",
      ).employeeId,
    ).toBe("S1/MA2");
    expect(
      step(ok({ type: "assignEmployee", stepId: "A", employeeId: null }), "A")
        .employeeId,
    ).toBeNull();

    // S2/MA1 übernimmt A an S1: neue Spur derselben Person. Die ID weicht aus,
    // weil S1 im Bestand vor E40 bereits einen eigenen „MA1“ hat.
    const springer = ok({
      type: "assignEmployee",
      stepId: "A",
      employeeId: "S2/MA1",
    });
    expect(step(springer, "A").employeeId).toBe("S1/MA1 (2)");
    expect(springer.input.employees.at(-1)).toEqual({
      id: "S1/MA1 (2)",
      stationId: "S1",
      label: "MA1",
      personId: "S2/MA1",
    });
    expect(() => assertValidScenario(springer.input)).not.toThrow();

    // Eine vorhandene Spur derselben Person wird wiederverwendet.
    const again = ok(
      { type: "assignEmployee", stepId: "B", employeeId: "S2/MA1" },
      springer,
    );
    expect(step(again, "B").employeeId).toBe("S1/MA1 (2)");
    expect(again.input.employees).toHaveLength(4);
  });

  it("verhindert Vorgängerkreise (E3) und ungültige Vorgänger", () => {
    expect(
      apply({ type: "setPredecessors", stepId: "A", predecessorIds: ["C"] }),
    ).toEqual({
      ok: false,
      error: "Diese Vorgänger würden einen Kreis bilden: A, B, C.",
    });
    expect(
      apply({ type: "setPredecessors", stepId: "A", predecessorIds: ["A"] }).ok,
    ).toBe(false);
    expect(
      apply({ type: "setPredecessors", stepId: "A", predecessorIds: ["X"] }).ok,
    ).toBe(false);
    expect(
      apply({
        type: "setPredecessors",
        stepId: "C",
        predecessorIds: ["A", "A"],
      }).ok,
    ).toBe(false);
    expect(
      step(
        ok({
          type: "setPredecessors",
          stepId: "C",
          predecessorIds: ["A", "B"],
        }),
        "C",
      ).predecessorIds,
    ).toEqual(["A", "B"]);
  });

  it("legt den nächsten Mitarbeiter an und entfernt nur leere (E12)", () => {
    const added = ok({ type: "addEmployee", stationId: "S1" });
    expect(added.input.employees.map((e) => e.label)).toContain(
      "Mitarbeiter 3",
    );
    expect(
      ok({ type: "removeEmployee", employeeId: "S1/Mitarbeiter 3" }, added)
        .input.employees,
    ).toHaveLength(3);
    // Nummer läuft über die Linie: S2 erhält nicht erneut „Mitarbeiter 2“.
    expect(
      ok({ type: "addEmployee", stationId: "S2" }).input.employees.at(-1),
    ).toEqual({
      id: "S2/Mitarbeiter 3",
      stationId: "S2",
      label: "Mitarbeiter 3",
    });
    expect(apply({ type: "removeEmployee", employeeId: "S1/MA1" })).toEqual({
      ok: false,
      error:
        "Mitarbeiter mit zugeordneten Arbeitsgängen können nicht entfernt werden.",
    });
  });

  it("legt aus der Mitarbeiterauswahl einen neuen Mitarbeiter an und weist ihn zu (E12, F100)", () => {
    const added = ok({ type: "assignNewEmployee", stepId: "C" });
    expect(added.input.employees.at(-1)).toEqual({
      id: "S2/Mitarbeiter 3",
      stationId: "S2",
      label: "Mitarbeiter 3",
    });
    expect(step(added, "C").employeeId).toBe("S2/Mitarbeiter 3");
    expect(() => assertValidScenario(added.input)).not.toThrow();
    expect(apply({ type: "assignNewEmployee", stepId: "X" })).toEqual({
      ok: false,
      error: "Arbeitsgang X existiert nicht.",
    });
  });

  it("prüft Takt, Zuschlag, Reihenfolge, Kategorie und Farbe", () => {
    expect(ok({ type: "setTakt", taktMin: 3.5 }).input.taktMin).toBe(3.5);
    expect(apply({ type: "setTakt", taktMin: 0 }).ok).toBe(false);
    expect(
      ok({ type: "setAllowance", allowancePct: 7 }).input.allowancePct,
    ).toBe(7);
    expect(apply({ type: "setAllowance", allowancePct: -1 }).ok).toBe(false);
    expect(
      step(ok({ type: "setSequence", stepId: "A", sequence: 99 }), "A")
        .sequence,
    ).toBe(99);
    expect(
      step(ok({ type: "setSequence", stepId: "A", sequence: 2.5 }), "A")
        .sequence,
    ).toBe(2.5);
    expect(apply({ type: "setSequence", stepId: "A", sequence: -1 })).toEqual({
      ok: false,
      error: "Reihenfolge darf nicht negativ sein.",
    });
    expect(
      step(ok({ type: "setCategory", stepId: "A", categoryId: "waiting" }), "A")
        .categoryId,
    ).toBe("waiting");
    expect(
      apply({ type: "setCategory", stepId: "A", categoryId: "x" }).ok,
    ).toBe(false);
    expect(
      ok({ type: "setCategoryColor", categoryId: "waiting", color: "#AABBCC" })
        .categories[2].color,
    ).toBe("#aabbcc");
    expect(
      apply({ type: "setCategoryColor", categoryId: "waiting", color: "rot" })
        .ok,
    ).toBe(false);
  });

  it("meldet Ziele, an denen eine Vorgängerbeziehung verletzt würde (F129)", () => {
    // B (Vorgänger von C an S2) nach „S3“ verschieben: S3 liegt nach S2.
    const input = scenario(
      [
        { id: "B", station: "S1", employee: "MA1", time: 1 },
        {
          id: "C",
          station: "S2",
          employee: "MA1",
          time: 1,
          predecessors: ["B"],
        },
      ],
      { emptyStations: ["S3"] },
    );
    expect(violationsAfterMove(input, "B", "S3")).toEqual(["B → C"]);
    expect(violationsAfterMove(input, "B", "S2")).toEqual([]);
  });

  it("verlangt vor problematischem Verschieben eine Bestätigung (E50)", () => {
    const input = scenario(
      [
        { id: "B", station: "S1", employee: "MA1", time: 1 },
        {
          id: "C",
          station: "S2",
          employee: "MA1",
          time: 1,
          predecessors: ["B"],
        },
      ],
      { emptyStations: ["S3"] },
    );
    const s3 = input.stations.find((s) => s.label === "S3")!.id;
    const s2 = input.stations.find((s) => s.label === "S2")!.id;
    const s1 = input.stations.find((s) => s.label === "S1")!.id;
    expect(moveWarning(input, "B", s3)).toBe(
      "Wenn B an Station S3 verschoben wird, sind diese Vorgängerbeziehungen verletzt:\n" +
        "B → C\n\nTrotzdem verschieben?",
    );
    expect(moveWarning(input, "B", s2)).toBeNull();
    // Gleiche Station oder unbekannter Arbeitsgang: keine Rückfrage.
    expect(moveWarning(input, "B", s1)).toBeNull();
    expect(moveWarning(input, "X", s3)).toBeNull();
  });
});

describe("Invarianten über beliebige Operationsfolgen", () => {
  const operationArbitrary = (s: EditableScenario): fc.Arbitrary<Operation> => {
    const steps = s.input.steps.map((x) => x.id);
    const stations = s.input.stations.map((x) => x.id);
    const employees = s.input.employees.map((x) => x.id);
    const pick = <T>(items: T[], fallback: T) =>
      items.length ? fc.constantFrom(...items) : fc.constant(fallback);
    return fc.oneof(
      fc.record({
        type: fc.constant("moveStep" as const),
        stepId: pick(steps, "-"),
        stationId: pick(stations, "-"),
      }),
      fc.record({
        type: fc.constant("assignEmployee" as const),
        stepId: pick(steps, "-"),
        employeeId: fc.option(pick(employees, "-"), { nil: null }),
      }),
      fc.record({
        type: fc.constant("setPredecessors" as const),
        stepId: pick(steps, "-"),
        predecessorIds: fc.subarray(steps),
      }),
      fc.record({
        type: fc.constant("addEmployee" as const),
        stationId: pick(stations, "-"),
      }),
      fc.record({
        type: fc.constant("assignNewEmployee" as const),
        stepId: pick(steps, "-"),
      }),
      fc.record({
        type: fc.constant("removeEmployee" as const),
        employeeId: pick(employees, "-"),
      }),
      fc.record({
        type: fc.constant("setSequence" as const),
        stepId: pick(steps, "-"),
        sequence: fc.integer({ min: 0, max: 9 }),
      }),
      fc.record({
        type: fc.constant("setGroup" as const),
        stepId: pick(steps, "-"),
        groupId: fc.option(fc.constantFrom("G", "H"), { nil: null }),
      }),
      fc.record({
        type: fc.constant("setTimeKind" as const),
        stepId: pick(steps, "-"),
        timeKind: fc.constantFrom("manual" as const, "process" as const),
      }),
    );
  };

  it("hält das Szenario gültig und lässt Zeiten und IDs unverändert (F17, F29)", () => {
    fc.assert(
      fc.property(
        scenarioArbitrary,
        fc.array(fc.nat(), { maxLength: 25 }),
        (input, seeds) => {
          let s = editable(input);
          for (const seed of seeds) {
            const op = fc.sample(operationArbitrary(s), {
              numRuns: 1,
              seed,
            })[0];
            const result = applyOperation(s, op);
            if (result.ok) s = result.scenario;
          }
          assertValidScenario(s.input);
          expect(s.input.steps.map((x) => [x.id, x.timeMin])).toEqual(
            input.steps.map((x) => [x.id, x.timeMin]),
          );
          expect(s.input.stations).toEqual(input.stations);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("Zeitart (E44)", () => {
  const process = () =>
    ok({ type: "setTimeKind", stepId: "A", timeKind: "process" });

  it("macht aus einer Handzeit eine Prozesszeit ohne Mitarbeiter", () => {
    const s = process();
    expect(step(s, "A")).toMatchObject({
      timeKind: "process",
      employeeId: null,
      timeMin: 2,
    });
    expect(() => assertValidScenario(s.input)).not.toThrow();
  });

  it("verweigert die Zuordnung eines Mitarbeiters zu einer Prozesszeit", () => {
    for (const op of [
      { type: "assignEmployee", stepId: "A", employeeId: "S1/MA1" },
      { type: "assignNewEmployee", stepId: "A" },
    ] as const) {
      const result = apply(op, process());
      expect(result.ok).toBe(false);
    }
  });

  it("setzt „hält Station“ nur bei Prozesszeiten und entfernt es mit der Rückkehr zur Handzeit", () => {
    expect(
      apply({ type: "setHoldsStation", stepId: "A", holdsStation: true }).ok,
    ).toBe(false);
    const held = ok(
      { type: "setHoldsStation", stepId: "A", holdsStation: true },
      process(),
    );
    expect(step(held, "A").holdsStation).toBe(true);
    // In einem Schritt umstellen (Tabellenansicht).
    expect(
      step(
        ok({
          type: "setTimeKind",
          stepId: "A",
          timeKind: "process",
          holdsStation: true,
        }),
        "A",
      ).holdsStation,
    ).toBe(true);
    const manual = ok(
      { type: "setTimeKind", stepId: "A", timeKind: "manual" },
      held,
    );
    // Ohne Zeitart-Felder wie vor E44, der Mitarbeiter muss neu zugeordnet werden.
    expect(step(manual, "A")).toEqual({
      ...step(editable(), "A"),
      employeeId: null,
    });
  });
});

describe("Gemeinsame Arbeitsgänge (E42)", () => {
  // T17-Beispiel verkleinert: G1 Hauptarbeit (MA1), G2 Unterstützung (MA2).
  const grouped = () =>
    editable(
      scenario(
        [
          { id: "G1", station: "S1", employee: "MA1", time: 3, group: "G" },
          { id: "G2", station: "S1", employee: "MA2", time: 1, group: "G" },
          { id: "X", station: "S1", employee: "MA3", time: 1 },
        ],
        { emptyStations: ["S2"] },
      ),
    );

  it("lehnt ab, die Hauptarbeit dem unterstützenden Mitarbeiter zu geben", () => {
    expect(
      apply(
        { type: "assignEmployee", stepId: "G1", employeeId: "S1/MA2" },
        grouped(),
      ),
    ).toEqual({
      ok: false,
      error:
        "Gruppe „G“: MA2 ist mehrfach eingetragen (G1, G2). Gleichzeitig kann jeder nur eine Tätigkeit ausführen.",
    });
  });

  it("Verschieben nimmt die ganze Gruppe mit; nur die gezogene Zeile verliert den Mitarbeiter", () => {
    const moved = ok(
      { type: "moveStep", stepId: "G1", stationId: "S2" },
      grouped(),
    );
    expect(step(moved, "G1")).toMatchObject({
      stationId: "S2",
      employeeId: null,
    });
    // MA2 bekommt an S2 eine Spur (E40) und behält seine Unterstützung.
    expect(step(moved, "G2")).toMatchObject({
      stationId: "S2",
      employeeId: "S2/MA2",
    });
    expect(moved.input.employees).toContainEqual(
      expect.objectContaining({
        id: "S2/MA2",
        stationId: "S2",
        personId: "S1/MA2",
      }),
    );
    expect(step(moved, "X").stationId).toBe("S1");
    assertValidScenario(moved.input);
  });

  it("setzt und entfernt die Gruppe; Leerzeichen zählen nicht", () => {
    const joined = ok(
      { type: "setGroup", stepId: "X", groupId: "  G " },
      grouped(),
    );
    expect(step(joined, "X").groupId).toBe("G");
    const left = ok({ type: "setGroup", stepId: "X", groupId: "" }, joined);
    expect("groupId" in step(left, "X")).toBe(false);
  });

  it("lehnt widersprüchliche Gruppen ab", () => {
    // Vorgänger innerhalb der Gruppe.
    expect(
      apply(
        { type: "setPredecessors", stepId: "G2", predecessorIds: ["G1"] },
        grouped(),
      ),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("gemeinsam starten"),
    });
    // Prozesszeit in der Gruppe.
    expect(
      apply(
        { type: "setTimeKind", stepId: "G2", timeKind: "process" },
        grouped(),
      ),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("Handzeiten"),
    });
    // Gruppe an einer anderen Station.
    const elsewhere = ok(
      { type: "moveStep", stepId: "X", stationId: "S2" },
      grouped(),
    );
    expect(
      apply({ type: "setGroup", stepId: "X", groupId: "G" }, elsewhere),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("mehreren Stationen"),
    });
  });

  it("Rückfrage nennt die mitziehenden Zeilen (E50)", () => {
    const input = scenario(
      [
        { id: "G1", station: "S1", employee: "MA1", time: 1, group: "G" },
        { id: "G2", station: "S1", employee: "MA2", time: 1, group: "G" },
        {
          id: "C",
          station: "S2",
          employee: "MA3",
          time: 1,
          predecessors: ["G2"],
        },
      ],
      { emptyStations: ["S3"] },
    );
    expect(moveWarning(input, "G1", "S3")).toBe(
      "Wenn G1 mit G2 (Gruppe „G“) an Station S3 verschoben wird, sind diese Vorgängerbeziehungen verletzt:\n" +
        "G2 → C\n\nTrotzdem verschieben?",
    );
  });
});
