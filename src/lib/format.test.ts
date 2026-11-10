import { describe, expect, it } from "vitest";
import {
  chartStepId,
  employeeShortLabel,
  fitStepId,
  formatMinutes,
  formatPercent,
  segmentLabel,
} from "./format";

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

describe("Beschriftung schmaler Balken (U3)", () => {
  it("lässt die ID stehen, wenn sie passt", () => {
    expect(fitStepId("AA010", 5)).toBe("AA010");
    expect(fitStepId("A", 1)).toBe("A");
  });

  it("zeigt das unterscheidende Ende statt des gleichen Anfangs", () => {
    expect(fitStepId("AA010", 4)).toBe("…010");
    expect(fitStepId("AA010", 3)).toBe("…10");
    expect(fitStepId("AA010", 2)).toBe("10");
  });

  it("lässt die Beschriftung weg, wenn kein Platz ist", () => {
    expect(fitStepId("AA010", 1)).toBe("");
    expect(fitStepId("AA010", 0)).toBe("");
  });
});

describe("Beschriftung aus mehreren Feldern (U3)", () => {
  it("zeigt alles, wenn es passt", () => {
    expect(segmentLabel({ id: "AA010", duration: "17,00" }, 20)).toBe(
      "AA010 · 17,00",
    );
  });

  it("bevorzugt die ID, wenn ID und Dauer nicht passen", () => {
    expect(segmentLabel({ id: "AA010", duration: "17,00" }, 6)).toBe("AA010");
    expect(segmentLabel({ id: "AA010", duration: "17,00" }, 3)).toBe("…10");
  });

  it("schneidet Text hinten ab, solange die ID ganz sichtbar bleibt", () => {
    expect(
      segmentLabel({ id: "AA010", description: "Kabelbaum verlegen" }, 12),
    ).toBe("AA010 · Kabelbaum verlegen");
  });

  it("zeigt nur Dauer oder Text ohne ID unverändert (Kürzen per CSS)", () => {
    expect(segmentLabel({ duration: "17,00" }, 2)).toBe("17,00");
  });
});

describe("Mitarbeiterbeschriftung unter Spuren und Balken (U2, U3)", () => {
  it("kürzt „Mitarbeiter N“ nach Platz", () => {
    expect(employeeShortLabel("Mitarbeiter 17", 5)).toBe("MA 17");
    expect(employeeShortLabel("Mitarbeiter 17", 4)).toBe("17");
    expect(employeeShortLabel("Mitarbeiter 17", 2)).toBe("17");
    expect(employeeShortLabel("Mitarbeiter 17", 1)).toBe("");
  });

  it("lässt andere Namen unverändert oder kürzt mit Auslassung", () => {
    expect(employeeShortLabel("Springer", 8)).toBe("Springer");
    expect(employeeShortLabel("Springer", 4)).toBe("Spr…");
  });
});
