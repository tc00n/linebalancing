import { findCycles } from "../checks/cycles";
import { isProcess, personOf, type ScenarioInput } from "./types";

/**
 * Verletzte Invarianten der Eingabe. Import (F79–F87) und Datenbank stellen
 * diese Invarianten sicher; tritt der Fehler trotzdem auf, ist das ein
 * Programm- oder Datenfehler, keine fachliche Warnung.
 */
export class InvalidScenarioError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Ungültige Szenariodaten:\n- ${problems.join("\n- ")}`);
    this.name = "InvalidScenarioError";
  }
}

export function assertValidScenario(input: ScenarioInput): void {
  const problems: string[] = [];

  if (!Number.isFinite(input.taktMin) || input.taktMin <= 0) {
    problems.push(`Taktzeit muss größer als 0 sein (ist ${input.taktMin}).`);
  }
  if (!Number.isFinite(input.allowancePct) || input.allowancePct < 0) {
    problems.push(
      `Zuschlag darf nicht negativ sein (ist ${input.allowancePct}).`,
    );
  }

  const stationIds = collectIds(input.stations, "Station", problems);
  const employeeIds = collectIds(input.employees, "Mitarbeiter", problems);
  const stepIds = collectIds(input.steps, "Arbeitsgang", problems);
  const employeeStation = new Map(
    input.employees.map((e) => [e.id, e.stationId]),
  );

  // E40: Spuren derselben Person tragen dieselbe Bezeichnung, höchstens eine je Station.
  const personLabel = new Map<string, string>();
  const personStations = new Set<string>();
  for (const employee of input.employees) {
    if (!stationIds.has(employee.stationId)) {
      problems.push(
        `Mitarbeiter ${employee.id}: unbekannte Station ${employee.stationId}.`,
      );
    }
    const person = personOf(employee);
    const label = personLabel.get(person);
    if (label !== undefined && label !== employee.label) {
      problems.push(
        `Mitarbeiter ${employee.id}: Bezeichnung „${employee.label}“ weicht von „${label}“ derselben Person ab.`,
      );
    }
    personLabel.set(person, label ?? employee.label);
    const key = `${person}\u0000${employee.stationId}`;
    if (personStations.has(key)) {
      problems.push(
        `Mitarbeiter ${employee.id}: Person hat an Station ${employee.stationId} bereits eine Spur.`,
      );
    }
    personStations.add(key);
  }

  for (const step of input.steps) {
    if (!stationIds.has(step.stationId)) {
      problems.push(
        `Arbeitsgang ${step.id}: unbekannte Station ${step.stationId}.`,
      );
    }
    if (!Number.isFinite(step.timeMin) || step.timeMin <= 0) {
      problems.push(
        `Arbeitsgang ${step.id}: Zeit muss größer als 0 sein (ist ${step.timeMin}).`,
      );
    }
    if (!Number.isFinite(step.sequence)) {
      problems.push(`Arbeitsgang ${step.id}: ungültige Reihenfolge.`);
    }
    if (isProcess(step) && step.employeeId !== null) {
      problems.push(
        `Arbeitsgang ${step.id}: Prozesszeit darf keinem Mitarbeiter zugeordnet sein.`,
      );
    } else if (step.employeeId !== null) {
      if (!employeeIds.has(step.employeeId)) {
        problems.push(
          `Arbeitsgang ${step.id}: unbekannter Mitarbeiter ${step.employeeId}.`,
        );
      } else if (employeeStation.get(step.employeeId) !== step.stationId) {
        problems.push(
          `Arbeitsgang ${step.id}: Mitarbeiter ${step.employeeId} gehört nicht zur Station ${step.stationId}.`,
        );
      }
    }
    for (const predecessorId of step.predecessorIds) {
      if (!stepIds.has(predecessorId)) {
        problems.push(
          `Arbeitsgang ${step.id}: unbekannter Vorgänger ${predecessorId}.`,
        );
      }
    }
  }

  for (const cycle of findCycles(input.steps)) {
    problems.push(`Vorgängerkreis: ${cycle.join(", ")}.`);
  }

  if (problems.length > 0) throw new InvalidScenarioError(problems);
}

function collectIds(
  items: readonly { id: string }[],
  kind: string,
  problems: string[],
): Set<string> {
  const ids = new Set<string>();
  for (const { id } of items) {
    if (ids.has(id)) problems.push(`${kind} ${id} ist doppelt vorhanden.`);
    ids.add(id);
  }
  return ids;
}
