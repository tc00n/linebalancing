import type { Step } from "../model/types";

/**
 * Findet alle Vorgängerkreise (F87, E3) mit Tarjans Algorithmus.
 * Liefert je Kreis die beteiligten Arbeitsgang-IDs, sortiert.
 * Verweise auf unbekannte IDs werden hier ignoriert; die meldet die Eingabeprüfung.
 */
export function findCycles(
  steps: readonly Pick<Step, "id" | "predecessorIds">[],
): string[][] {
  const predecessors = new Map(steps.map((s) => [s.id, s.predecessorIds]));
  const index = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  let counter = 0;

  // Iterativ statt rekursiv, damit lange Ketten (bis 500 Schritte, F36) keinen Stack-Überlauf erzeugen.
  for (const root of predecessors.keys()) {
    if (index.has(root)) continue;
    const work: { id: string; next: number }[] = [{ id: root, next: 0 }];
    index.set(root, counter);
    lowLink.set(root, counter++);
    stack.push(root);
    onStack.add(root);

    while (work.length > 0) {
      const frame = work[work.length - 1];
      const edges = (predecessors.get(frame.id) ?? []).filter((p) =>
        predecessors.has(p),
      );
      if (frame.next < edges.length) {
        const target = edges[frame.next++];
        if (!index.has(target)) {
          index.set(target, counter);
          lowLink.set(target, counter++);
          stack.push(target);
          onStack.add(target);
          work.push({ id: target, next: 0 });
        } else if (onStack.has(target)) {
          lowLink.set(
            frame.id,
            Math.min(lowLink.get(frame.id)!, index.get(target)!),
          );
        }
        continue;
      }

      work.pop();
      if (work.length > 0) {
        const parent = work[work.length - 1].id;
        lowLink.set(
          parent,
          Math.min(lowLink.get(parent)!, lowLink.get(frame.id)!),
        );
      }
      if (lowLink.get(frame.id) === index.get(frame.id)) {
        const component: string[] = [];
        let member: string;
        do {
          member = stack.pop()!;
          onStack.delete(member);
          component.push(member);
        } while (member !== frame.id);
        const selfLoop = (predecessors.get(frame.id) ?? []).includes(frame.id);
        if (component.length > 1 || selfLoop) cycles.push(component.sort());
      }
    }
  }

  return cycles.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}
