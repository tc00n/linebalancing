import { describe, expect, it } from "vitest";
import { formatMinutes, formatPercent } from "./format";

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
