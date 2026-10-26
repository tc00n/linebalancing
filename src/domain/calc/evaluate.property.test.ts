import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compareSteps } from "../model/stepOrder";
import type { Minutes, ScenarioInput, Step } from "../model/types";
import {
  deepFreeze,
  scenarioArbitrary,
  springerScenarioArbitrary,
} from "../testing/arbitraries";
import { evaluateScenario, type ScenarioResult } from "./evaluate";
import { scheduleScenario, type ScheduledStep } from "./schedule";
import { exceeds, isBefore, nearlyEqual, TIME_EPSILON } from "./tolerance";

// Invarianten aus docs/RECHENREGELN.md über zufällige Szenarien, teils mit Springern (6a).
const RUNS = { numRuns: 300 };
const close = (a: number, b: number) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-6);

function scheduledById(result: ScenarioResult) {
  return new Map(
    result.employees.flatMap((e) => e.steps).map((s) => [s.stepId, s]),
  );
}

/** Eingeplante Schritte je Person in zeitlicher Reihenfolge, über alle Spuren (E40). */
function stepsByPerson(result: ScenarioResult) {
  const byPerson = new Map<string, ScheduledStep[]>();
  for (const lane of result.employees) {
    byPerson.set(lane.personId, [
      ...(byPerson.get(lane.personId) ?? []),
      ...lane.steps,
    ]);
  }
  for (const steps of byPerson.values())
    steps.sort((a, b) => a.start - b.start || a.end - b.end);
  return byPerson;
}

/** Zeitlich wirksame Vorgänger: zugeordnet und an derselben Station (E1a, E4). */
function timingPredecessors(input: ScenarioInput, stepId: string) {
  const steps = new Map(input.steps.map((s) => [s.id, s]));
  const step = steps.get(stepId)!;
  return step.predecessorIds
    .map((id) => steps.get(id)!)
    .filter((p) => p.stationId === step.stationId && p.employeeId !== null);
}

/** Planung vor E40, je Station unabhängig: Referenz für Szenarien ohne Springer. */
function legacySchedule(input: ScenarioInput): ScheduledStep[] {
  const byStation = new Map<string, Step[]>();
  for (const step of [...input.steps].sort(compareSteps)) {
    if (step.employeeId === null) continue;
    byStation.set(step.stationId, [
      ...(byStation.get(step.stationId) ?? []),
      step,
    ]);
  }
  return [...byStation.values()].flatMap((steps) => {
    const inStation = new Set(steps.map((s) => s.id));
    const free = new Map<string, Minutes>();
    const done = new Map<string, ScheduledStep>();
    const pending = new Set(steps);
    const result: ScheduledStep[] = [];
    while (pending.size > 0) {
      let best: { step: Step; start: Minutes } | undefined;
      for (const step of pending) {
        const preds = step.predecessorIds.filter((p) => inStation.has(p));
        if (!preds.every((p) => done.has(p))) continue;
        const start = Math.max(
          free.get(step.employeeId!) ?? 0,
          ...preds.map((p) => done.get(p)!.end),
        );
        if (
          !best ||
          isBefore(start, best.start) ||
          (nearlyEqual(start, best.start) && compareSteps(step, best.step) < 0)
        )
          best = { step, start };
      }
      const { step, start } = best!;
      const was = free.get(step.employeeId!) ?? 0;
      const s: ScheduledStep = {
        stepId: step.id,
        stationId: step.stationId,
        employeeId: step.employeeId!,
        start,
        end: start + step.timeMin,
        waitBefore: exceeds(start, was) ? start - was : 0,
      };
      free.set(step.employeeId!, s.end);
      done.set(step.id, s);
      pending.delete(step);
      result.push(s);
    }
    return result;
  });
}

describe("Rechenkern-Invarianten", () => {
  it("plant ohne Springer exakt wie die Planung je Station (6a)", () => {
    fc.assert(
      fc.property(scenarioArbitrary, (input) => {
        const byStep = (list: ScheduledStep[]) =>
          [...list].sort((a, b) => (a.stepId < b.stepId ? -1 : 1));
        expect(byStep(scheduleScenario(input))).toEqual(
          byStep(legacySchedule(input)),
        );
      }),
      RUNS,
    );
  });

  it("verändert die Eingabe nicht und übernimmt die importierten Zeiten unverändert (F17)", () => {
    fc.assert(
      fc.property(springerScenarioArbitrary, (input) => {
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
      fc.property(springerScenarioArbitrary, (input) => {
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

  it("lässt keine Person zwei Tätigkeiten gleichzeitig ausführen, auch nicht an zwei Stationen (F55, E40)", () => {
    fc.assert(
      fc.property(springerScenarioArbitrary, (input) => {
        for (const steps of stepsByPerson(evaluateScenario(input)).values()) {
          let free = 0;
          for (const s of steps) {
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
      fc.property(springerScenarioArbitrary, (input) => {
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

  it("lässt eine Person nur warten, wenn keine ihrer Tätigkeiten ausführbar ist (E3)", () => {
    fc.assert(
      fc.property(springerScenarioArbitrary, (input) => {
        const result = evaluateScenario(input);
        const scheduled = scheduledById(result);
        const readyAt = (id: string) =>
          Math.max(
            0,
            ...timingPredecessors(input, id).map(
              (p) => scheduled.get(p.id)!.end,
            ),
          );
        for (const steps of stepsByPerson(result).values()) {
          steps.forEach((s, i) => {
            if (s.waitBefore === 0) return;
            for (const later of steps.slice(i + 1)) {
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

  it("bildet Belegung, Stationshöhe und Kennzahlen konsistent (E2, F90, F108, E6, 6a)", () => {
    fc.assert(
      fc.property(springerScenarioArbitrary, (input) => {
        const result = evaluateScenario(input);
        const factor = 1 + input.allowancePct / 100;

        for (const e of result.employees) {
          close(e.occupancy, e.productive * factor + e.wait);
          expect(e.wait).toBeGreaterThanOrEqual(0);
          expect(e.share).toBeGreaterThanOrEqual(0);
        }
        for (const [personId, steps] of stepsByPerson(result)) {
          const lanes = result.employees.filter((e) => e.personId === personId);
          const productive = lanes.reduce((t, e) => t + e.productive, 0);
          const wait = lanes.reduce((t, e) => t + e.wait, 0);
          close(steps.at(-1)?.end ?? 0, productive + wait); // keine Lücke außer Wartezeit
          close(
            lanes.reduce((t, e) => t + e.share, 0),
            1,
          );
          for (const lane of lanes) {
            close(
              lane.personOccupancy,
              lanes.reduce((t, e) => t + e.occupancy, 0),
            );
          }
        }
        for (const st of result.stations) {
          const own = result.employees.filter(
            (e) => e.stationId === st.stationId,
          );
          close(st.height, Math.max(0, ...own.map((e) => e.occupancy)));
          close(
            st.employeeCount,
            own.reduce((t, e) => t + e.share, 0),
          );
        }
        close(
          result.stations.reduce((t, s) => t + s.employeeCount, 0),
          result.kpis.employeeCount,
        );

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
      fc.property(springerScenarioArbitrary, (input) => {
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
      fc.property(springerScenarioArbitrary, (input) => {
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
      fc.property(springerScenarioArbitrary, (input) => {
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
