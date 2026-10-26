import fc from "fast-check";
import type { ScenarioInput, Step } from "../model/types";

/**
 * Zufällige, gültige Szenarien für Eigenschaftstests: bis 3 Stationen mit je
 * bis 3 Mitarbeitern, bis 15 Schritte mit Zeiten auf zwei Nachkommastellen
 * (F84), teils nicht zugeordnet, Vorgänger stations­übergreifend. Vorgänger
 * verweisen nur auf früher erzeugte Schritte, daher ist der Graph kreisfrei.
 * Wenige Reihenfolgewerte erzwingen häufige Gleichstände.
 */
export const scenarioArbitrary: fc.Arbitrary<ScenarioInput> = fc
  .record({
    stationCount: fc.integer({ min: 1, max: 3 }),
    employeesPerStation: fc.array(fc.integer({ min: 0, max: 3 }), {
      minLength: 3,
      maxLength: 3,
    }),
    steps: fc.array(
      fc.record({
        station: fc.nat(),
        employee: fc.option(fc.nat(), { nil: null, freq: 4 }),
        cents: fc.integer({ min: 1, max: 600 }),
        sequence: fc.integer({ min: 1, max: 4 }),
        predecessors: fc.array(fc.nat(), { maxLength: 3 }),
      }),
      { maxLength: 15 },
    ),
    taktCents: fc.integer({ min: 1, max: 1500 }),
    allowancePct: fc.integer({ min: 0, max: 30 }),
  })
  .map(
    ({ stationCount, employeesPerStation, steps, taktCents, allowancePct }) => {
      const stations = Array.from({ length: stationCount }, (_, i) => ({
        id: `S${i + 1}`,
        label: `Station ${i + 1}`,
      }));
      const employees = stations.flatMap((station, i) =>
        Array.from({ length: employeesPerStation[i] }, (_, j) => ({
          id: `${station.id}/MA${j + 1}`,
          stationId: station.id,
          label: `Mitarbeiter ${j + 1}`,
        })),
      );

      const built: Step[] = steps.map((spec, index) => {
        const stationIndex = spec.station % stationCount;
        const count = employeesPerStation[stationIndex];
        return {
          id: `AG${index + 1}`,
          description: `Arbeitsgang ${index + 1}`,
          timeMin: spec.cents / 100,
          sequence: spec.sequence,
          stationId: stations[stationIndex].id,
          employeeId:
            spec.employee === null || count === 0
              ? null
              : `${stations[stationIndex].id}/MA${(spec.employee % count) + 1}`,
          predecessorIds:
            index === 0
              ? []
              : [
                  ...new Set(
                    spec.predecessors.map((p) => `AG${(p % index) + 1}`),
                  ),
                ],
        };
      });

      return {
        taktMin: taktCents / 100,
        allowancePct,
        stations,
        employees,
        steps: built,
      };
    },
  );

/** Friert ein Objekt rekursiv ein, damit jede Veränderung im Strict Mode wirft. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
