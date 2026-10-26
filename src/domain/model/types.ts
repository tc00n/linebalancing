// Fachliches Modell eines Szenarios, wie es der Rechenkern sieht.
// Bewusst unabhängig von Datenbank und UI (siehe docs/RECHENREGELN.md).

/** Zeitangaben in Minuten (F73). */
export type Minutes = number;

export interface Station {
  readonly id: string;
  readonly label: string;
}

/** Mitarbeiter gehören zu genau einer Station („Mitarbeiter 1“ …, F68). */
export interface Employee {
  readonly id: string;
  readonly stationId: string;
  readonly label: string;
}

export interface Step {
  /** Arbeitsgang-ID, eindeutig innerhalb der Variante (F69). */
  readonly id: string;
  readonly description: string;
  /** Importierte Zeit, unveränderlich (F17). */
  readonly timeMin: Minutes;
  /** Spalte „Reihenfolge“; entscheidet nur bei Gleichstand (E3). */
  readonly sequence: number;
  readonly stationId: string;
  /** null = nicht zugeordnet (F61/F109). */
  readonly employeeId: string | null;
  /** Arbeitsgang-IDs der Vorgänger (F54). */
  readonly predecessorIds: readonly string[];
}

export interface ScenarioInput {
  readonly taktMin: Minutes;
  /** Zuschlag in Prozent, z. B. 10 für 10 % (F60). */
  readonly allowancePct: number;
  readonly stations: readonly Station[];
  readonly employees: readonly Employee[];
  readonly steps: readonly Step[];
}
