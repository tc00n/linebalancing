// Fachliches Modell eines Szenarios, wie es der Rechenkern sieht.
// Bewusst unabhängig von Datenbank und UI (siehe docs/RECHENREGELN.md).

/** Zeitangaben in Minuten (F73). */
export type Minutes = number;

export interface Station {
  readonly id: string;
  readonly label: string;
}

/**
 * Spur eines Mitarbeiters an einer Station („Mitarbeiter 1“ …, F68). Ein
 * Springer hat an jeder Einsatzstation eine eigene Spur; alle Spuren derselben
 * Person tragen dieselbe `personId` (E40, docs/RECHENREGELN.md 6a).
 */
export interface Employee {
  readonly id: string;
  readonly stationId: string;
  readonly label: string;
  /** Fehlt bei Szenarien vor E40: Dann ist jede Spur eine eigene Person. */
  readonly personId?: string;
}

/** Person hinter einer Spur (E40). */
export function personOf(employee: Pick<Employee, "id" | "personId">): string {
  return employee.personId ?? employee.id;
}

/**
 * Zeitart (E44): Handzeit bindet einen Mitarbeiter, Prozesszeit (z. B. Ablüften)
 * läuft ohne Mitarbeiter ab.
 */
export type TimeKind = "manual" | "process";

export interface Step {
  /** Arbeitsgang-ID, eindeutig innerhalb der Variante (F69). */
  readonly id: string;
  readonly description: string;
  /** Importierte Zeit, unveränderlich (F17). */
  readonly timeMin: Minutes;
  /** Spalte „Reihenfolge“; entscheidet nur bei Gleichstand (E3). */
  readonly sequence: number;
  readonly stationId: string;
  /** null = nicht zugeordnet (F61/F109); bei Prozesszeit immer null (E44). */
  readonly employeeId: string | null;
  /** Arbeitsgang-IDs der Vorgänger (F54). */
  readonly predecessorIds: readonly string[];
  /** Kategorie (F27, F97); ohne Einfluss auf die Berechnung. */
  readonly categoryId?: string;
  /** Fehlt = Handzeit (Szenarien vor E44). */
  readonly timeKind?: TimeKind;
  /**
   * Nur Prozesszeit: Das Produkt bleibt bis zu ihrem Ende an der Station, sie
   * zählt also in die Stationshöhe (E44). Fehlt = nein, die Prozesszeit läuft
   * beim Weitertakten weiter.
   */
  readonly holdsStation?: boolean;
}

/** Prozesszeit ohne Mitarbeiter (E44). */
export function isProcess(step: Pick<Step, "timeKind">): boolean {
  return step.timeKind === "process";
}

/** Handzeit ohne Mitarbeiter: wird nicht eingeplant (F109). */
export function isUnassigned(
  step: Pick<Step, "timeKind" | "employeeId">,
): boolean {
  return step.employeeId === null && !isProcess(step);
}

export interface ScenarioInput {
  readonly taktMin: Minutes;
  /** Zuschlag in Prozent, z. B. 10 für 10 % (F60). */
  readonly allowancePct: number;
  readonly stations: readonly Station[];
  readonly employees: readonly Employee[];
  readonly steps: readonly Step[];
}
