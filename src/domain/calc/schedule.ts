import { sortStations } from "../model/stationOrder";
import { compareSteps } from "../model/stepOrder";
import {
  personOf,
  type Minutes,
  type ScenarioInput,
  type Step,
} from "../model/types";
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
 * Ablaufplanung aller zugeordneten Schritte (docs/RECHENREGELN.md, Abschnitte 3 und 6a).
 * Jede Station ist ein eigener Taktzyklus ab 0 (E1a); geplant wird gemeinsam über
 * alle Stationen, weil ein Springer (E40) linienweit nur eine Tätigkeit zugleich
 * ausführt. Ohne Springer ist das Ergebnis identisch mit der Planung je Station.
 * Erwartet eine gültige Eingabe (assertValidScenario), insbesondere ohne Vorgängerkreise.
 * Ergebnis in Planungsreihenfolge, d. h. je Mitarbeiter nach nicht fallendem Start.
 */
export function scheduleScenario(input: ScenarioInput): ScheduledStep[] {
  // F109: nicht zugeordnete Schritte werden nicht eingeplant.
  const steps = input.steps
    .filter((s) => s.employeeId !== null)
    .sort(compareSteps);
  const byId = new Map(steps.map((s) => [s.id, s]));
  // Zeitlich wirksam sind nur zugeordnete Vorgänger derselben Station (E1a, E4).
  const timingPredecessors = new Map(
    steps.map((s) => [
      s.id,
      s.predecessorIds.filter((p) => byId.get(p)?.stationId === s.stationId),
    ]),
  );
  const person = new Map(input.employees.map((e) => [e.id, personOf(e)]));
  const rank = new Map(sortStations(input.stations).map((s, i) => [s.id, i]));
  // E3, ergänzt um die Flussreihenfolge für Gleichstand zwischen Stationen (6a).
  const tieBreak = (a: Step, b: Step) =>
    a.sequence - b.sequence ||
    rank.get(a.stationId)! - rank.get(b.stationId)! ||
    compareSteps(a, b);

  const personFree = new Map<string, Minutes>();
  const done = new Map<string, ScheduledStep>();
  const pending = new Set(steps);
  const result: ScheduledStep[] = [];

  while (pending.size > 0) {
    let best: { step: Step; start: Minutes } | undefined;

    for (const step of pending) {
      const predecessors = timingPredecessors.get(step.id)!;
      if (!predecessors.every((p) => done.has(p))) continue;
      const start = Math.max(
        personFree.get(person.get(step.employeeId!)!) ?? 0,
        ...predecessors.map((p) => done.get(p)!.end),
      );
      if (
        !best ||
        isBefore(start, best.start) ||
        (nearlyEqual(start, best.start) && tieBreak(step, best.step) < 0)
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
    const who = person.get(step.employeeId!)!;
    const free = personFree.get(who) ?? 0;
    const scheduled: ScheduledStep = {
      stepId: step.id,
      stationId: step.stationId,
      employeeId: step.employeeId!,
      start,
      end: start + step.timeMin,
      waitBefore: exceeds(start, free) ? start - free : 0,
    };
    personFree.set(who, scheduled.end);
    done.set(step.id, scheduled);
    pending.delete(step);
    result.push(scheduled);
  }

  return result;
}
