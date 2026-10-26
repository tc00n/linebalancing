import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { roundHalfUp, roundPercent } from "./rounding";

describe("roundHalfUp (E34)", () => {
  it("rundet ab 5 auf, auch wenn die Gleitkommadarstellung knapp darunter liegt", () => {
    expect(1.005 * 100).toBeLessThan(100.5); // naives Math.round ergäbe 1,00
    expect(roundHalfUp(1.005)).toBe(1.01);
    expect(roundHalfUp(2.675)).toBe(2.68);
    expect(roundHalfUp(1.004)).toBe(1);
  });

  it("rundet negative Werte vom Betrag her", () => {
    expect(roundHalfUp(-1.005)).toBe(-1.01);
    expect(roundHalfUp(-0.001)).toBe(0);
    expect(Object.is(roundHalfUp(-0.001), -0)).toBe(false);
  });

  it("liefert 101,88 % für die Personalauslastung des Rechenbeispiels", () => {
    const ratio = (3.5 * 1.1 + 1 + 3 * 1.1) / (2 * 4);
    expect(roundPercent(ratio)).toBe(101.88);
  });

  it("lässt Werte mit höchstens zwei Nachkommastellen unverändert", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10_000_000, max: 10_000_000 }),
        (cents) => {
          expect(roundHalfUp(cents / 100)).toBe(cents / 100);
        },
      ),
    );
  });

  it("lehnt nicht endliche Werte ab", () => {
    expect(() => roundHalfUp(Number.NaN)).toThrow(RangeError);
    expect(() => roundHalfUp(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
