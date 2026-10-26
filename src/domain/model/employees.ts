import { sortStations } from "./stationOrder";
import { personOf, type ScenarioInput } from "./types";

const labelCollator = new Intl.Collator("de", { numeric: true });

/**
 * Linienweit eindeutige Mitarbeiterbezeichnungen (E40). Tragen verschiedene
 * Personen dieselbe Bezeichnung – typisch für Szenarien vor der
 * Durchnummerierung, in denen jede Station einen eigenen „Mitarbeiter 1“
 * hatte –, werden alle Personen neu nummeriert: nach Stammstation in
 * Flussreihenfolge, dann bisheriger Bezeichnung. Ohne Doppelung bleibt die
 * Eingabe unverändert (dasselbe Objekt).
 */
export function withUniqueEmployeeLabels(input: ScenarioInput): ScenarioInput {
  const personsByLabel = new Map<string, Set<string>>();
  for (const e of input.employees) {
    const persons = personsByLabel.get(e.label) ?? new Set();
    personsByLabel.set(e.label, persons.add(personOf(e)));
  }
  if (![...personsByLabel.values()].some((p) => p.size > 1)) return input;

  const rank = new Map(sortStations(input.stations).map((s, i) => [s.id, i]));
  // Stammstation: die ursprüngliche Spur (ID = Person), sonst die erste Einsatzstation.
  const laneIds = new Set(input.employees.map((e) => e.id));
  const home = new Map<string, { rank: number; label: string }>();
  for (const e of input.employees) {
    const person = personOf(e);
    const candidate = { rank: rank.get(e.stationId)!, label: e.label };
    const current = home.get(person);
    const better = laneIds.has(person)
      ? e.id === person
      : !current || candidate.rank < current.rank;
    if (better) home.set(person, candidate);
  }
  const order = [...home.entries()].sort(
    ([pa, a], [pb, b]) =>
      a.rank - b.rank ||
      labelCollator.compare(a.label, b.label) ||
      (pa < pb ? -1 : pa > pb ? 1 : 0),
  );
  const label = new Map(
    order.map(([person], i) => [person, `Mitarbeiter ${i + 1}`]),
  );
  return {
    ...input,
    employees: input.employees.map((e) => ({
      ...e,
      label: label.get(personOf(e))!,
    })),
  };
}
