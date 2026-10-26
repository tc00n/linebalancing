import { describe, it, expect } from "vitest";
import { safeNext } from "./safe-next";
describe("Auth-Weiterleitung", () => {
  it.each([
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example/",
    "/projects#secret",
    "/\r\nLocation:evil",
    null,
    undefined,
  ])("verwirft externe oder unsichere Ziele %s", (value) =>
    expect(safeNext(value)).toBe("/projects"),
  );
  it("erhaelt interne Szenarioziele", () =>
    expect(safeNext("/szenario?ist=123")).toBe("/szenario?ist=123"));
});
