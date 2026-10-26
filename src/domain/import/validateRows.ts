import { findCycles } from "../checks/cycles";
import { compareStationLabels } from "../model/stationOrder";
import {
  cellText,
  isBlank,
  normalizeEmployee,
  parseGermanNumber,
  parseTime,
  splitPredecessors,
  type CellValue,
} from "./cells";
import { COLUMNS, COLUMN_HEADER, type ColumnKey } from "./template";

export interface RawRow {
  /** Zeilennummer in Excel (1 = Kopfzeile). */
  readonly rowNumber: number;
  readonly values: Readonly<Record<ColumnKey, CellValue>>;
}

export interface ImportMessage {
  readonly severity: "error" | "warning";
  readonly rowNumber: number;
  readonly column: ColumnKey;
  readonly message: string;
}

export interface ParsedRow {
  readonly rowNumber: number;
  readonly id: string;
  readonly station: string;
  readonly description: string;
  /** Gerundet auf zwei Nachkommastellen (E21); null bei Fehler. */
  readonly timeMin: number | null;
  /** Normiert „Mitarbeiter N“; null = nicht zugeordnet. */
  readonly employee: string | null;
  readonly sequence: number | null;
  readonly predecessorIds: readonly string[];
}

export interface ValidationResult {
  readonly rows: readonly ParsedRow[];
  readonly messages: readonly ImportMessage[];
  readonly hasErrors: boolean;
}

/** Prüft alle Zeilen des Blatts „Arbeitsgänge“ (F31, F69, F78–F87, E21). */
export function validateRows(rawRows: readonly RawRow[]): ValidationResult {
  const messages: ImportMessage[] = [];
  const error = (rowNumber: number, column: ColumnKey, message: string) =>
    messages.push({ severity: "error", rowNumber, column, message });
  const warning = (rowNumber: number, column: ColumnKey, message: string) =>
    messages.push({ severity: "warning", rowNumber, column, message });

  const rows = rawRows
    .filter((raw) => !COLUMNS.every((c) => isBlank(raw.values[c.key])))
    .map((raw): ParsedRow => {
      const { rowNumber, values } = raw;
      const required = (key: ColumnKey) => {
        if (isBlank(values[key])) {
          error(rowNumber, key, `${COLUMN_HEADER[key]} fehlt.`);
        }
        return cellText(values[key]);
      };

      const id = required("id");
      const station = required("station");
      const description = required("description");

      const time = parseTime(values.time);
      if (!time.ok) {
        error(rowNumber, "time", TIME_ERRORS[time.reason]);
      } else if (time.rounded) {
        warning(
          rowNumber,
          "time",
          `Zeit ${formatPlain(time.original)} hat mehr als zwei Nachkommastellen und wird auf ${formatPlain(time.value)} gerundet.`,
        );
      }

      let employee: string | null = null;
      if (isBlank(values.employee)) {
        warning(rowNumber, "employee", "Kein Mitarbeiter zugeordnet.");
      } else {
        employee = normalizeEmployee(values.employee);
        if (!employee) {
          error(
            rowNumber,
            "employee",
            `„${cellText(values.employee)}“ ist keine gültige Mitarbeiterbezeichnung. Erwartet: „Mitarbeiter 1“, „Mitarbeiter 2“ …`,
          );
        }
      }

      const sequence = parseGermanNumber(values.sequence);
      const negative = sequence.ok && sequence.value < 0;
      if (!sequence.ok) {
        error(
          rowNumber,
          "sequence",
          sequence.reason === "missing"
            ? "Reihenfolge fehlt."
            : `Reihenfolge „${cellText(values.sequence)}“ ist keine Zahl.`,
        );
      } else if (negative) {
        error(rowNumber, "sequence", "Reihenfolge darf nicht negativ sein.");
      }

      return {
        rowNumber,
        id,
        station,
        description,
        timeMin: time.ok ? time.value : null,
        employee,
        sequence: sequence.ok && !negative ? sequence.value : null,
        predecessorIds: splitPredecessors(values.predecessors),
      };
    });

  checkIds(rows, error);
  checkPredecessors(rows, error);
  checkSharedEmployees(rows, warning);

  return {
    rows,
    messages: messages.sort(
      (a, b) =>
        a.rowNumber - b.rowNumber ||
        COLUMN_ORDER[a.column] - COLUMN_ORDER[b.column],
    ),
    hasErrors: messages.some((m) => m.severity === "error"),
  };
}

const TIME_ERRORS = {
  missing: "Zeit fehlt.",
  format:
    "Zeit ist keine gültige Zahl. Erwartet: Minuten mit Dezimalkomma, z. B. 1,25.",
  not_positive: "Zeit muss größer als 0 sein.",
} as const;

const COLUMN_ORDER = Object.fromEntries(
  COLUMNS.map((c, i) => [c.key, i]),
) as Record<ColumnKey, number>;

function formatPlain(value: number): string {
  return String(value).replace(".", ",");
}

type Report = (rowNumber: number, column: ColumnKey, message: string) => void;

/** Arbeitsgang-IDs eindeutig (F69). */
function checkIds(rows: readonly ParsedRow[], error: Report) {
  const byId = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    if (row.id) byId.set(row.id, [...(byId.get(row.id) ?? []), row]);
  }
  for (const [id, group] of byId) {
    if (group.length < 2) continue;
    const lines = group.map((r) => r.rowNumber).join(", ");
    for (const row of group) {
      error(
        row.rowNumber,
        "id",
        `Arbeitsgang-ID „${id}“ kommt mehrfach vor (Zeilen ${lines}).`,
      );
    }
  }
}

/**
 * Dieselbe Bezeichnung an mehreren Stationen ist dieselbe Person (E40). Das ist
 * erlaubt, bei Dateien mit Nummerierung je Station aber meist ein Versehen;
 * deshalb ein Hinweis je Mitarbeiter an seiner ersten Zeile.
 */
function checkSharedEmployees(rows: readonly ParsedRow[], warning: Report) {
  const byEmployee = new Map<
    string,
    { first: number; stations: Set<string> }
  >();
  for (const row of rows) {
    if (!row.employee || !row.station) continue;
    const entry = byEmployee.get(row.employee) ?? {
      first: row.rowNumber,
      stations: new Set<string>(),
    };
    entry.stations.add(row.station);
    byEmployee.set(row.employee, entry);
  }
  for (const [employee, { first, stations }] of byEmployee) {
    if (stations.size < 2) continue;
    const labels = [...stations].sort(compareStationLabels).join(", ");
    warning(
      first,
      "employee",
      `„${employee}“ hat Arbeitsgänge an ${stations.size} Stationen (${labels}) und wird als eine Person nacheinander eingeplant. Ist das nicht gewollt, je Person eine eigene Nummer vergeben.`,
    );
  }
}

/** Unbekannte, doppelte, selbstbezogene und zyklische Vorgänger (F79, F87). */
function checkPredecessors(rows: readonly ParsedRow[], error: Report) {
  const ids = new Set(rows.map((r) => r.id).filter(Boolean));

  for (const row of rows) {
    const seen = new Set<string>();
    for (const predecessor of row.predecessorIds) {
      if (seen.has(predecessor)) {
        error(
          row.rowNumber,
          "predecessors",
          `Vorgänger „${predecessor}“ ist doppelt angegeben.`,
        );
      } else if (predecessor === row.id) {
        error(
          row.rowNumber,
          "predecessors",
          "Ein Arbeitsgang kann nicht sein eigener Vorgänger sein.",
        );
      } else if (!ids.has(predecessor)) {
        error(
          row.rowNumber,
          "predecessors",
          `Vorgänger „${predecessor}“ existiert nicht.`,
        );
      }
      seen.add(predecessor);
    }
  }

  // Kreise nur über gültige, nicht selbstbezogene Verweise, damit jeder Fehler genau einmal gemeldet wird.
  const graph = rows
    .filter((r) => r.id)
    .map((r) => ({
      id: r.id,
      predecessorIds: r.predecessorIds.filter((p) => p !== r.id && ids.has(p)),
    }));
  const rowById = new Map(rows.map((r) => [r.id, r]));
  for (const cycle of findCycles(graph)) {
    for (const id of cycle) {
      error(
        rowById.get(id)!.rowNumber,
        "predecessors",
        `Vorgängerkreis zwischen ${cycle.join(", ")}.`,
      );
    }
  }
}
