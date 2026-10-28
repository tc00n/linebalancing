import { DEFAULT_CATEGORY_ID } from "../model/categories";
import type { Employee, ScenarioInput, Station, Step } from "../model/types";
import { assertValidScenario } from "../model/validate";
import type { ParsedRow } from "./validateRows";

/**
 * Überführt fehlerfrei geprüfte Importzeilen in ein Szenario (F83).
 * Stationen und Mitarbeiter werden aus den Bezeichnungen abgeleitet (F82).
 */
export function buildScenario(
  rows: readonly ParsedRow[],
  settings: { taktMin: number; allowancePct: number },
): ScenarioInput {
  const stations = new Map<string, Station>();
  const employees = new Map<string, Employee>();

  const steps: Step[] = rows.map((row) => {
    if (row.timeMin === null || row.sequence === null) {
      throw new Error(
        `Zeile ${row.rowNumber} ist nicht fehlerfrei; Import vorher mit validateRows prüfen.`,
      );
    }
    const stationId = `station:${row.station}`;
    stations.set(stationId, { id: stationId, label: row.station });

    // E40: Dieselbe Bezeichnung an mehreren Stationen ist dieselbe Person (Springer).
    let employeeId: string | null = null;
    if (row.employee && !row.process) {
      employeeId = `${stationId}/${row.employee}`;
      employees.set(employeeId, {
        id: employeeId,
        stationId,
        label: row.employee,
        personId: `person:${row.employee}`,
      });
    }

    return {
      id: row.id,
      description: row.description,
      timeMin: row.timeMin,
      sequence: row.sequence,
      stationId,
      employeeId,
      predecessorIds: [...row.predecessorIds],
      categoryId: DEFAULT_CATEGORY_ID, // E11
      ...(row.process ? { timeKind: "process" as const } : {}),
      ...(row.holdsStation ? { holdsStation: true } : {}),
    };
  });

  const scenario: ScenarioInput = {
    taktMin: settings.taktMin,
    allowancePct: settings.allowancePct,
    stations: [...stations.values()],
    employees: [...employees.values()],
    steps,
  };
  assertValidScenario(scenario);
  return scenario;
}

/** Varianten- und Szenarioname aus dem Dateinamen (F88). */
export function nameFromFilename(filename: string): string {
  const base = filename.replace(/^.*[\\/]/, "");
  return base.replace(/\.(xlsx|xlsm|xls)$/i, "").trim() || base;
}
