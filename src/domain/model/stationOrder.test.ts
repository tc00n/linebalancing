import { describe, expect, it } from "vitest";
import { compareStationLabels, sortStations } from "./stationOrder";

describe("Stationsreihenfolge (E14)", () => {
  it("sortiert Zahlen numerisch", () => {
    const labels = ["Station 10", "Station 2", "Station 1"].sort(
      compareStationLabels,
    );
    expect(labels).toEqual(["Station 1", "Station 2", "Station 10"]);
  });

  it("ignoriert Groß-/Kleinschreibung und sortiert Umlaute deutsch", () => {
    expect(compareStationLabels("station a", "Station A")).toBe(0);
    expect(compareStationLabels("Ä-Montage", "B-Montage")).toBeLessThan(0);
  });

  it("sortiert gleichrangige Bezeichnungen stabil nach ID", () => {
    const sorted = sortStations([
      { id: "s2", label: "T17" },
      { id: "s1", label: "t17" },
      { id: "s0", label: "T9" },
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["s0", "s1", "s2"]);
  });
});
