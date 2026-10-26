import { describe, expect, it } from "vitest";
import { findCycles } from "./cycles";

const step = (id: string, ...predecessorIds: string[]) => ({
  id,
  predecessorIds,
});

describe("findCycles (F87)", () => {
  it("findet keinen Kreis in einer Kette mit Verzweigung", () => {
    expect(
      findCycles([step("A"), step("B", "A"), step("C", "A", "B")]),
    ).toEqual([]);
  });

  it("findet einen Selbstverweis", () => {
    expect(findCycles([step("A", "A"), step("B")])).toEqual([["A"]]);
  });

  it("findet mehrere getrennte Kreise", () => {
    const cycles = findCycles([
      step("A", "C"),
      step("B", "A"),
      step("C", "B"),
      step("D"),
      step("E", "F"),
      step("F", "E", "D"),
    ]);
    expect(cycles).toEqual([
      ["A", "B", "C"],
      ["E", "F"],
    ]);
  });

  it("ignoriert Verweise auf unbekannte IDs", () => {
    expect(findCycles([step("A", "X")])).toEqual([]);
  });

  it("verkraftet lange Ketten ohne Stack-Überlauf", () => {
    const chain = Array.from({ length: 20_000 }, (_, i) =>
      i === 0 ? step("S0") : step(`S${i}`, `S${i - 1}`),
    );
    expect(findCycles(chain)).toEqual([]);
  });
});
