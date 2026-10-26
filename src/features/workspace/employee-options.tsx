import { sortStations } from "@/domain/model/stationOrder";
import { personOf, type Employee, type Station } from "@/domain/model/types";

const labelCollator = new Intl.Collator("de", { numeric: true });

/**
 * Optionen der Mitarbeiterauswahl eines Arbeitsgangs (F100): zuerst die
 * Mitarbeiter der Station, darunter alle weiteren Personen der Linie. Wer
 * gewählt wird, arbeitet an dieser Station als Springer (E40).
 */
export function EmployeeOptions(props: {
  employees: readonly Employee[];
  stations: readonly Station[];
  stationId: string;
}) {
  const own = props.employees.filter((e) => e.stationId === props.stationId);
  const present = new Set(own.map(personOf));
  const rank = new Map(sortStations(props.stations).map((s, i) => [s.id, i]));
  const label = new Map(props.stations.map((s) => [s.id, s.label]));
  // Je Person eine Spur, bevorzugt an der in Flussreihenfolge ersten Station.
  const others = new Map<string, Employee>();
  for (const e of [...props.employees].sort(
    (a, b) => rank.get(a.stationId)! - rank.get(b.stationId)!,
  )) {
    const person = personOf(e);
    if (!present.has(person) && !others.has(person)) others.set(person, e);
  }
  const springers = [...others.values()].sort((a, b) =>
    labelCollator.compare(a.label, b.label),
  );

  return (
    <>
      {own.map((e) => (
        <option key={e.id} value={e.id}>
          {e.label}
        </option>
      ))}
      {springers.length > 0 && (
        <optgroup label="Als Springer von anderer Station">
          {springers.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label} ({label.get(e.stationId)})
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}
