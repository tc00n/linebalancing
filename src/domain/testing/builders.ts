import type { Employee, ScenarioInput, Station, Step } from "../model/types";

// Kompakte Testdaten: Stationen und Mitarbeiter werden aus den Schritten abgeleitet.
// Mitarbeiter-ID = "<Station>/<Mitarbeiter>", z. B. "S1/MA1".

export interface StepSpec {
  id: string;
  station: string;
  employee?: string | null;
  time: number;
  sequence?: number;
  predecessors?: string[];
}

export function scenario(
  specs: StepSpec[],
  options: {
    takt?: number;
    allowancePct?: number;
    /** Zusätzliche Mitarbeiter ohne Tätigkeit, z. B. ["S1/MA3"]. */
    idleEmployees?: string[];
    /** Zusätzliche Stationen ohne Schritte. */
    emptyStations?: string[];
  } = {},
): ScenarioInput {
  const stations = new Map<string, Station>();
  const employees = new Map<string, Employee>();
  const addStation = (id: string) => stations.set(id, { id, label: id });
  const addEmployee = (id: string) => {
    const stationId = id.split("/")[0];
    addStation(stationId);
    employees.set(id, { id, stationId, label: id.split("/")[1] });
  };

  const steps: Step[] = specs.map((spec, index) => {
    addStation(spec.station);
    const employeeId =
      spec.employee == null ? null : `${spec.station}/${spec.employee}`;
    if (employeeId) addEmployee(employeeId);
    return {
      id: spec.id,
      description: `Arbeitsgang ${spec.id}`,
      timeMin: spec.time,
      sequence: spec.sequence ?? index + 1,
      stationId: spec.station,
      employeeId,
      predecessorIds: spec.predecessors ?? [],
    };
  });
  options.idleEmployees?.forEach(addEmployee);
  options.emptyStations?.forEach(addStation);

  return {
    taktMin: options.takt ?? 4,
    allowancePct: options.allowancePct ?? 0,
    stations: [...stations.values()],
    employees: [...employees.values()],
    steps,
  };
}
