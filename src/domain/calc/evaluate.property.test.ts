import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { ScenarioInput } from "../model/types";
import { deepFreeze, scenarioArbitrary } from "../testing/arbitraries";
import { evaluateScenario, type ScenarioResult } from "./evaluate";
import { TIME_EPSILON } from "./tolerance";

// Invarianten aus docs/RECHENREGELN.md über zufällige Szenarien.
const RUNS = { numRuns: 300 };
const close = (a: number, b: number) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-6);

function scheduledById(result: ScenarioResult) {
  return new Map(
    result.employees.flatMap((e) => e.steps).map((s) => [s.stepId, s]),
  );
}

/** Zeitlich wirksame Vorgänger: zugeordnet und an derselben Station (E1a, E4). */
function timingPredecessors(input: ScenarioInput, stepId: string) {
  const steps = new Map(input.steps.map((s) => [s.id, s]));
  const step = steps.get(stepId)!;
  return step.predecessorIds
    .map((id) => steps.get(id)!)
    .filter((p) => p.stationId === step.stationId && p.employeeId !== null);
}

describe("Rechenkern-Invarianten", () => {
  it("verändert die Eingabe nicht und übernimmt die importierten Zeiten unverändert (F17)", () => {
    fc.assert(
      fc.property(scenarioArbitrary, (input) => {
        const snapshot = structuredClone(input);
        const result = evaluateScenario(deepFreeze(input));
        expect(input).toEqual(snapshot);
        const time = new Map(input.steps.map((s) => [s.id, s.timeMin]));
        for (const s of scheduledById(result).values()) {
          close(s.end - s.start, time.get(s.stepId)!);
        }
      }),
      RUNS,
    );
  });

  it("plant genau die zugeordneten Schritte ein (F109)", () => {
    fc.assert(
      fc.property(scenarioArbitrary, (input) => {
        const planned = [
          ...scheduledById(evaluateScenario(input)).keys(),
        ].sort();
        const assigned = input.steps
          .filter((s) => s.employeeId !== null)
          .map((s) => s.id)
          .sort();
        expect(planned).toEqual(assigned);
      }),
      RUNS,
    );
  });

  it("lässt keinen Mitarbeiter zwei Tätigkeiten gleichzeitig ausführen (F55)", () => {
    fc.assert(
      fc.property(scenarioArbitrary, (input) => {
        for (const employee of evaluateScenario(input).employees) {
          let free = 0;
          for (const s of employee.steps) {
            expect(s.start).toBeGreaterThanOrEqual(free - TIME_EPSILON);
            close(s.waitBefore, Math.max(0, s.start - free));
            free = s.end;
          }
        }
      }),
      RUNS,
    );
  });

  it("startet keinen Schritt vor dem Ende seiner wirksamen Vorgänger (E5)", () => {
    fc.assert(
      fc.property(scenarioArbitrary, (input) => {
        const scheduled = scheduledById(evaluateScenario(input));
        for (const [id, s] of scheduled) {
          for (const p of timingPredecessors(input, id)) {
            expect(s.start).toBeGreaterThanOrEqual(
              scheduled.get(p.id)!.end - TIME_EPSILON,
            );
          }
        }
      }),
      RUNS,
    );
  });

  it("lässt einen Mitarbeiter nur warten, wenn keine seiner Tätigkeiten ausführbar ist (E3)", () => {
    fc.assert(
      fc.property(scenarioArbitrary, (input) => {
        const result = evaluateScenario(input);
        const scheduled = scheduledById(result);
        const readyAt = (id: string) =>
          Math.max(
            0,
            ...timingPredecessors(input, id).map(
              (p) => scheduled.get(p.id)!.end,
            ),
          );
        for (const employee of result.employees) {
          employee.steps.forEach((s, i) => {
            if (s.waitBefore === 0) return;
            for (const later of employee.steps.slice(i + 1)) {
              expect(readyAt(later.stepId)).toBeGreaterThanOrEqual(
                s.start - TIME_EPSILON,
              );
            }
          });
        }
      }),
      RUNS,
    );
  });

  it("bildet Belegung, Stationshöhe und Kennzahlen konsistent (E2, F90, F108, E6)", () => {
    fc.assert(
      fc.property(scenarioArbitrary, (input) => {
        const result = evaluateScenario(input);
        const factor = 1 + input.allowancePct / 100;

        for (const e of result.employees) {
          const lastEnd = e.steps.at(-1)?.end ?? 0;
          close(lastEnd, e.productive + e.wait); // keine Lücke außer Wartezeit
          close(e.occupancy, e.productive * factor + e.wait);
          expect(e.wait).toBeGreaterThanOrEqual(0);
        }
        for (const st of result.stations) {
          const own = result.employees.filter(
            (e) => e.stationId === st.stationId,
          );
          close(st.height, Math.max(0, ...own.map((e) => e.occupancy)));
          expect(st.employeeCount).toBe(own.length);
        }

        const assigned = input.steps.filter((s) => s.employeeId !== null);
        close(
          result.kpis.totalWorkContent,
          assigned.reduce((t, s) => t + s.timeMin, 0),
        );
        expect(result.kpis.incomplete).toBe(
          assigned.length < input.steps.length,
        );
        if (result.kpis.employeeCount > 0) {
          const occupancy = result.employees.reduce(
            (t, e) => t + e.occupancy,
            0,
          );
          close(
            result.kpis.personnelUtilization!,
            occupancy / (result.kpis.employeeCount * input.taktMin),
          );
        }
      }),
      RUNS,
    );
  });

  it("ändert die Planung nicht, wenn nicht zugeordnete Schritte entfernt werden (F109, E4)", () => {
    fc.assert(
      fc.property(scenarioArbitrary, (input) => {
        const assignedIds = new Set(
          input.steps.filter((s) => s.employeeId !== null).map((s) => s.id),
        );
        const reduced: ScenarioInput = {
          ...input,
          steps: input.steps
            .filter((s) => assignedIds.has(s.id))
            .map((s) => ({
              ...s,
              predecessorIds: s.predecessorIds.filter((p) =>
                assignedIds.has(p),
              ),
            })),
        };
        const full = evaluateScenario(input);
        const without = evaluateScenario(reduced);
        expect(without.employees).toEqual(full.employees);
        expect(without.kpis.personnelUtilization).toEqual(
          full.kpis.personnelUtilization,
        );
        expect(without.kpis.totalWorkContent).toEqual(
          full.kpis.totalWorkContent,
        );
      }),
      RUNS,
    );
  });

  it("ändert die Planung nicht durch stationsübergreifende Vorgänger (E1a)", () => {
    fc.assert(
      fc.property(scenarioArbitrary, (input) => {
        const station = new Map(input.steps.map((s) => [s.id, s.stationId]));
        const local: ScenarioInput = {
          ...input,
          steps: input.steps.map((s) => ({
            ...s,
            predecessorIds: s.predecessorIds.filter(
              (p) => station.get(p) === s.stationId,
            ),
          })),
        };
        expect(evaluateScenario(local).employees).toEqual(
          evaluateScenario(input).employees,
        );
      }),
      RUNS,
    );
  });

  it("ist unabhängig von der Reihenfolge der Eingabelisten", () => {
    fc.assert(
      fc.property(scenarioArbitrary, (input) => {
        const reversed: ScenarioInput = {
          ...input,
          stations: [...input.stations].reverse(),
          employees: [...input.employees].reverse(),
          steps: [...input.steps].reverse(),
        };
        expect(evaluateScenario(reversed)).toEqual(evaluateScenario(input));
      }),
      RUNS,
    );
  });
});
