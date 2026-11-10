import { findCycles } from "../checks/cycles";
import { isProcess, personOf, type ScenarioInput, type Step } from "./types";

/**
 * Gemeinsame Arbeitsgänge (E42, docs/RECHENREGELN.md 6c): Zeilen mit derselben
 * Gruppe führen mehrere Mitarbeiter gleichzeitig aus. Diese Prüfungen gelten
 * für Import, Eingabeprüfung und Bearbeitung gleichermaßen.
 */
export interface GroupMember {
  readonly id: string;
  readonly groupId?: string;
  /** Station zur Anzeige in Meldungen. */
  readonly station: string;
  /** Person zur Anzeige und zum Vergleich; null = nicht zugeordnet. */
  readonly person: string | null;
  readonly process: boolean;
  readonly predecessorIds: readonly string[];
}

export interface GroupProblem {
  readonly groupId: string;
  /** Betroffene Arbeitsgänge, an denen die Meldung erscheint. */
  readonly stepIds: readonly string[];
  readonly message: string;
}

/** Leere Angabe = keine Gruppe; sonst ohne überzählige Leerzeichen. */
export function normalizeGroupId(value: string | null | undefined) {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  return text === "" ? undefined : text;
}

/** Alle Zeilen derselben Gruppe, einschließlich des Arbeitsgangs selbst. */
export function groupMembersOf<T extends Pick<Step, "id" | "groupId">>(
  steps: readonly T[],
  step: Pick<Step, "groupId">,
): T[] {
  return step.groupId === undefined
    ? []
    : steps.filter((s) => s.groupId === step.groupId);
}

/** Gruppenprüfung auf dem fachlichen Modell. */
export function scenarioGroupProblems(
  input: Pick<ScenarioInput, "steps" | "employees" | "stations">,
): GroupProblem[] {
  const stationLabel = new Map(input.stations.map((s) => [s.id, s.label]));
  const employees = new Map(input.employees.map((e) => [e.id, e]));
  return findGroupProblems(
    input.steps.map((s) => {
      const employee = s.employeeId ? employees.get(s.employeeId) : undefined;
      return {
        id: s.id,
        groupId: s.groupId,
        station: stationLabel.get(s.stationId) ?? s.stationId,
        person: employee ? personOf(employee) : null,
        process: isProcess(s),
        predecessorIds: s.predecessorIds,
      };
    }),
    (person) =>
      input.employees.find((e) => personOf(e) === person)?.label ?? person,
  );
}

/**
 * Widersprüche einer Gruppe: Prozesszeit in der Gruppe, verschiedene
 * Stationen, dieselbe Person mehrfach, Vorgänger innerhalb der Gruppe oder
 * ein Umweg über andere Arbeitsgänge, der den gemeinsamen Start unmöglich macht.
 */
export function findGroupProblems(
  members: readonly GroupMember[],
  personLabel: (person: string) => string = (p) => p,
): GroupProblem[] {
  const problems: GroupProblem[] = [];
  const groups = new Map<string, GroupMember[]>();
  for (const m of members) {
    if (m.groupId === undefined) continue;
    groups.set(m.groupId, [...(groups.get(m.groupId) ?? []), m]);
  }

  for (const [groupId, rows] of groups) {
    const ids = rows.map((r) => r.id);
    for (const row of rows.filter((r) => r.process)) {
      problems.push({
        groupId,
        stepIds: [row.id],
        message: `Gruppe „${groupId}“: ${row.id} ist eine Prozesszeit. Gemeinsame Arbeitsgänge sind Handzeiten.`,
      });
    }
    const stations = [...new Set(rows.map((r) => r.station))];
    if (stations.length > 1) {
      problems.push({
        groupId,
        stepIds: ids,
        message: `Gruppe „${groupId}“ liegt an mehreren Stationen (${stations.join(", ")}). Alle Zeilen einer Gruppe gehören an dieselbe Station.`,
      });
    }
    const byPerson = new Map<string, string[]>();
    for (const row of rows) {
      if (row.person === null) continue;
      byPerson.set(row.person, [...(byPerson.get(row.person) ?? []), row.id]);
    }
    for (const [person, stepIds] of byPerson) {
      if (stepIds.length < 2) continue;
      problems.push({
        groupId,
        stepIds,
        message: `Gruppe „${groupId}“: ${personLabel(person)} ist mehrfach eingetragen (${stepIds.join(", ")}). Gleichzeitig kann jeder nur eine Tätigkeit ausführen.`,
      });
    }
    for (const row of rows) {
      const inside = row.predecessorIds.filter((p) => ids.includes(p));
      if (inside.length === 0) continue;
      problems.push({
        groupId,
        stepIds: [row.id],
        message: `Gruppe „${groupId}“: ${inside.join(", ")} ist Vorgänger von ${row.id}, beide sollen aber gemeinsam starten.`,
      });
    }
  }

  // Umwege: Vorgängergraph mit je einem Knoten pro Gruppe. Gewöhnliche Kreise meldet die Kreisprüfung.
  if (groups.size > 0 && findCycles(members).length === 0) {
    const node = (m: GroupMember) =>
      m.groupId === undefined ? m.id : `\u0000${m.groupId}`;
    const nodeOf = new Map(members.map((m) => [m.id, node(m)]));
    const edges = new Map<string, Set<string>>();
    for (const m of members) {
      const set = edges.get(node(m)) ?? new Set<string>();
      for (const p of m.predecessorIds) {
        const target = nodeOf.get(p);
        // Vorgänger innerhalb der Gruppe sind oben schon gemeldet.
        if (target !== undefined && target !== node(m)) set.add(target);
      }
      edges.set(node(m), set);
    }
    const graph = [...edges].map(([id, preds]) => ({
      id,
      predecessorIds: [...preds],
    }));
    for (const cycle of findCycles(graph)) {
      const groupIds = cycle
        .filter((n) => n.startsWith("\u0000"))
        .map((n) => n.slice(1));
      const label = cycle
        .map((n) => (n.startsWith("\u0000") ? `Gruppe „${n.slice(1)}“` : n))
        .join(", ");
      for (const groupId of groupIds) {
        problems.push({
          groupId,
          stepIds: groups.get(groupId)!.map((r) => r.id),
          message: `Gruppe „${groupId}“ kann nicht gemeinsam starten: Die Vorgänger bilden über ${label} einen Kreis.`,
        });
      }
    }
  }

  return problems;
}
