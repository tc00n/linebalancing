import { describe, expect, it } from "vitest";
import { chartStepId, formatMinutes, formatPercent } from "./format";

describe("Formatierung (P2, E34)", () => {
  it("zeigt Minuten mit Dezimalkomma und zwei Stellen", () => {
    expect(formatMinutes(4.85)).toBe("4,85");
    expect(formatMinutes(3)).toBe("3,00");
    expect(formatMinutes(1.005)).toBe("1,01");
    expect(formatMinutes(1234.5)).toBe("1.234,50");
  });

  it("zeigt Prozent kaufmännisch gerundet", () => {
    expect(formatPercent((3.5 * 1.1 + 1 + 3 * 1.1) / 8)).toBe("101,88 %");
    expect(formatPercent(0.9375)).toBe("93,75 %");
    expect(formatPercent(null)).toBe("–");
  });
});

describe("Kurz-ID im Diagramm (G3)", () => {
  it("lässt den Stationsvorsatz weg", () => {
    expect(chartStepId("T19-AA010A", "T19")).toBe("AA010A");
    expect(chartStepId("Station 2_A1", "Station 2")).toBe("A1");
  });

  it("behält die volle ID, wenn sie nicht mit der Station beginnt", () => {
    expect(chartStepId("T19-AA010A", "T20")).toBe("T19-AA010A");
    expect(chartStepId("T10-AA010", "T1")).toBe("T10-AA010");
    expect(chartStepId("A", "S1")).toBe("A");
    expect(chartStepId("T19-", "T19")).toBe("T19-");
  });
});
