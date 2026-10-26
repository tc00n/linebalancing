import { sortStations } from "@/domain/model/stationOrder";
import { personOf, type Employee, type Station } from "@/domain/model/types";

const labelCollator = new Intl.Collator("de", { numeric: true });

/**
 * Optionen der Mitarbeiterauswahl eines Arbeitsgangs (F100, F134): alle
 * Mitarbeiter der Linie, je Person ein Eintrag mit ihren Stationen. Wer an
 * dieser Station noch keine Spur hat, bekommt sie mit der Zuweisung (E40).
 */
export function EmployeeOptions(props: {
  employees: readonly Employee[];
  stations: readonly Station[];
  stationId: string;
}) {
  const rank = new Map(sortStations(props.stations).map((s, i) => [s.id, i]));
  const stationLabel = new Map(props.stations.map((s) => [s.id, s.label]));
  const persons = new Map<string, Employee[]>();
  for (const e of [...props.employees].sort(
    (a, b) => rank.get(a.stationId)! - rank.get(b.stationId)!,
  )) {
    persons.set(personOf(e), [...(persons.get(personOf(e)) ?? []), e]);
  }
  const options = [...persons.values()]
    .map((lanes) => ({
      // Wert: die Spur an dieser Station, sonst eine beliebige Spur der Person.
      lane: lanes.find((e) => e.stationId === props.stationId) ?? lanes[0],
      stations: lanes.map((e) => stationLabel.get(e.stationId)).join(", "),
    }))
    .sort((a, b) => labelCollator.compare(a.lane.label, b.lane.label));

  return (
    <>
      {options.map(({ lane, stations }) => (
        <option key={lane.id} value={lane.id}>
          {lane.label} ({stations})
        </option>
      ))}
    </>
  );
}
