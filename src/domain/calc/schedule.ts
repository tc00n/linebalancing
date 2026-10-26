import { compareSteps } from "../model/stepOrder";
import type { Minutes, ScenarioInput, Step } from "../model/types";
import { exceeds, isBefore, nearlyEqual } from "./tolerance";

export interface ScheduledStep {
  readonly stepId: string;
  readonly stationId: string;
  readonly employeeId: string;
  readonly start: Minutes;
  readonly end: Minutes;
  /** Wartezeit unmittelbar vor diesem Schritt (F63/F66, E5). */
  readonly waitBefore: Minutes;
}

/**
 * Ablaufplanung aller zugeordneten Schritte (docs/RECHENREGELN.md, Abschnitt 3).
 * Erwartet eine gültige Eingabe (assertValidScenario), insbesondere ohne Vorgängerkreise.
 * Ergebnis je Station in Planungsreihenfolge, d. h. nach nicht fallendem Start.
 */
export function scheduleScenario(input: ScenarioInput): ScheduledStep[] {
  const byStation = new Map<string, Step[]>();
  for (const step of [...input.steps].sort(compareSteps)) {
    if (step.employeeId === null) continue; // F109: nicht zugeordnet → nicht eingeplant
    const group = byStation.get(step.stationId) ?? [];
    group.push(step);
    byStation.set(step.stationId, group);
  }
  return [...byStation.values()].flatMap(scheduleStation);
}

/** Listenplanung einer Station als eigener Taktzyklus ab 0 (E1a, E3, E5). */
function scheduleStation(steps: readonly Step[]): ScheduledStep[] {
  // Zeitlich wirksam sind nur zugeordnete Vorgänger derselben Station (E1a, E4).
  const inStation = new Set(steps.map((s) => s.id));
  const timingPredecessors = new Map(
    steps.map((s) => [s.id, s.predecessorIds.filter((p) => inStation.has(p))]),
  );

  const employeeFree = new Map<string, Minutes>();
  const done = new Map<string, ScheduledStep>();
  const pending = new Set(steps);
  const result: ScheduledStep[] = [];

  while (pending.size > 0) {
    let best: { step: Step; start: Minutes } | undefined;

    for (const step of pending) {
      const predecessors = timingPredecessors.get(step.id)!;
      if (!predecessors.every((p) => done.has(p))) continue;
      const start = Math.max(
        employeeFree.get(step.employeeId!) ?? 0,
        ...predecessors.map((p) => done.get(p)!.end),
      );
      if (
        !best ||
        isBefore(start, best.start) ||
        (nearlyEqual(start, best.start) && compareSteps(step, best.step) < 0) // E3
      ) {
        best = { step, start };
      }
    }

    if (!best) {
      throw new Error(
        "Ablaufplanung nicht möglich: Vorgängerkreis. Eingabe vorher mit assertValidScenario prüfen.",
      );
    }

    const { step, start } = best;
    const free = employeeFree.get(step.employeeId!) ?? 0;
    const scheduled: ScheduledStep = {
      stepId: step.id,
      stationId: step.stationId,
      employeeId: step.employeeId!,
      start,
      end: start + step.timeMin,
      waitBefore: exceeds(start, free) ? start - free : 0,
    };
    employeeFree.set(step.employeeId!, scheduled.end);
    done.set(step.id, scheduled);
    pending.delete(step);
    result.push(scheduled);
  }

  return result;
}
