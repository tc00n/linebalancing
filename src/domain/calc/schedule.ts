import { sortStations } from "../model/stationOrder";
import { compareSteps } from "../model/stepOrder";
import {
  isUnassigned,
  personOf,
  type Minutes,
  type ScenarioInput,
  type Step,
} from "../model/types";
import { exceeds, isBefore, nearlyEqual } from "./tolerance";

export interface ScheduledStep {
  readonly stepId: string;
  readonly stationId: string;
  /** null = Prozesszeit ohne Mitarbeiter (E44). */
  readonly employeeId: string | null;
  readonly start: Minutes;
  readonly end: Minutes;
  /** Wartezeit unmittelbar vor diesem Schritt (F63/F66, E5). */
  readonly waitBefore: Minutes;
}

/**
 * Ablaufplanung aller zugeordneten Schritte und Prozesszeiten (docs/RECHENREGELN.md,
 * Abschnitte 3, 6a, 6b und 6c).
 * Jede Station ist ein eigener Taktzyklus ab 0 (E1a); geplant wird gemeinsam über
 * alle Stationen, weil ein Springer (E40) linienweit nur eine Tätigkeit zugleich
 * ausführt. Ohne Springer ist das Ergebnis identisch mit der Planung je Station.
 * Erwartet eine gültige Eingabe (assertValidScenario), insbesondere ohne Vorgängerkreise.
 * Ergebnis in Planungsreihenfolge, d. h. je Mitarbeiter nach nicht fallendem Start.
 */
export function scheduleScenario(input: ScenarioInput): ScheduledStep[] {
  // F109: nicht zugeordnete Schritte werden nicht eingeplant, Prozesszeiten schon (E44).
  const steps = input.steps.filter((s) => !isUnassigned(s)).sort(compareSteps);
  const byId = new Map(steps.map((s) => [s.id, s]));
  // Zeitlich wirksam sind nur eingeplante Vorgänger derselben Station (E1a, E4, E44).
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
  // Prozesszeiten binden niemanden und warten nur auf ihre Vorgänger (E44).
  const freeAt = (step: Step) =>
    step.employeeId === null
      ? 0
      : (personFree.get(person.get(step.employeeId)!) ?? 0);
  const done = new Map<string, ScheduledStep>();

  // E42 (6c): Die zugeordneten Zeilen einer Gruppe sind eine Einheit mit gemeinsamem Start.
  const units: Step[][] = [];
  const groups = new Map<string, Step[]>();
  for (const step of steps) {
    if (step.groupId === undefined) {
      units.push([step]);
      continue;
    }
    const members = groups.get(step.groupId);
    if (members) members.push(step);
    else {
      const created = [step];
      groups.set(step.groupId, created);
      units.push(created);
    }
  }
  const lead = (unit: readonly Step[]) =>
    unit.reduce((a, b) => (tieBreak(b, a) < 0 ? b : a));
  const pending = new Set(units);
  const result: ScheduledStep[] = [];

  while (pending.size > 0) {
    let best: { unit: Step[]; lead: Step; start: Minutes } | undefined;

    for (const unit of pending) {
      const predecessors = unit.flatMap((s) => timingPredecessors.get(s.id)!);
      if (!predecessors.every((p) => done.has(p))) continue;
      const start = Math.max(
        ...unit.map(freeAt),
        ...predecessors.map((p) => done.get(p)!.end),
      );
      const first = lead(unit);
      if (
        !best ||
        isBefore(start, best.start) ||
        (nearlyEqual(start, best.start) && tieBreak(first, best.lead) < 0)
      ) {
        best = { unit, lead: first, start };
      }
    }

    if (!best) {
      throw new Error(
        "Ablaufplanung nicht möglich: Vorgängerkreis. Eingabe vorher mit assertValidScenario prüfen.",
      );
    }

    const { unit, start } = best;
    for (const step of unit) {
      const free = freeAt(step);
      const scheduled: ScheduledStep = {
        stepId: step.id,
        stationId: step.stationId,
        employeeId: step.employeeId,
        start,
        end: start + step.timeMin,
        // Vor einer Prozesszeit wartet niemand; in einer Gruppe wartet, wer früher frei ist.
        waitBefore:
          step.employeeId !== null && exceeds(start, free) ? start - free : 0,
      };
      if (step.employeeId !== null) {
        personFree.set(person.get(step.employeeId)!, scheduled.end);
      }
      done.set(step.id, scheduled);
      result.push(scheduled);
    }
    pending.delete(unit);
  }

  return result;
}
