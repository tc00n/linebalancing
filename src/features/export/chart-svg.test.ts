// @vitest-environment node
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { evaluateScenario } from "@/domain/calc/evaluate";
import { defaultCategories } from "@/domain/model/categories";
import { scenario } from "@/domain/testing/builders";
import { createScenarioView } from "@/features/workspace/scenario-view";
import { buildColumns } from "@/features/yamazumi/layout";
import { formatPercent } from "@/lib/format";
import { chartSvg } from "./chart-svg";
import { deflate, imagePdf } from "./pdf";

function input(mode: "station" | "employee" = "station") {
  const scenarioInput = scenario(
    [
      { id: "T17-AA010", station: "T17", employee: "Mitarbeiter 1", time: 2 },
      { id: "T17-AA020", station: "T17", employee: "Mitarbeiter 2", time: 3 },
      {
        id: "T17-AA030",
        station: "T17",
        employee: "Mitarbeiter 1",
        time: 1.5,
        predecessors: ["T17-AA020"],
      },
      { id: "T18-AA010", station: "T18", employee: null, time: 0.76 },
    ],
    { takt: 4, allowancePct: 10 },
  );
  const result = evaluateScenario(scenarioInput);
  return {
    title: "Ziel <Kopie> & Test",
    subtitle: "Variante XT · Takt 4,00 min",
    notes: ["Ergebnis unvollständig: 1 Arbeitsgang ohne Mitarbeiter"],
    footer: "Exportiert am 27.10.2026",
    view: createScenarioView(scenarioInput, result, defaultCategories()),
    columns: buildColumns(scenarioInput, result),
    mode,
    labels: { id: true, description: false, duration: false },
  };
}

describe("Diagrammexport (F52, E18)", () => {
  it("enthält Stationsbezeichnungen und die numerische Taktlinie", () => {
    const { svg } = chartSvg(input());
    expect(svg).toContain(">T17</text>");
    expect(svg).toContain(">T18</text>");
    expect(svg).toContain(">Takt 4,00</text>");
    // Stationshöhe mit 10 % Zuschlag (E7): 4,85, über Takt markiert.
    expect(svg).toContain(">4,85</text>");
    expect(svg).toContain(`>${formatPercent(1.2125)}</text>`);
  });

  it("beschriftet Balken wie das Diagramm und maskiert Sonderzeichen", () => {
    const { svg } = chartSvg(input());
    expect(svg).toContain(">AA010</text>");
    expect(svg).not.toContain(">T17-AA010</text>");
    expect(svg).toContain("Ziel &lt;Kopie&gt; &amp; Test");
    expect(svg).toContain("Ergebnis unvollständig");
    expect(svg).not.toContain("<Kopie>");
  });

  it("bricht die Legende um, statt sie aus dem Bild laufen zu lassen", () => {
    const { svg, width } = chartSvg(input());
    for (const label of ["Taktzeit", "über Takt", "MA = Mitarbeiter"])
      expect(svg).toContain(`>${label}</text>`);
    const xs = [...svg.matchAll(/<text x="([\d.]+)"/g)].map((m) =>
      Number(m[1]),
    );
    expect(Math.max(...xs)).toBeLessThan(width - 100);
  });

  it("beschriftet in der Mitarbeiteransicht die Spuren", () => {
    const { svg } = chartSvg(input("employee"));
    expect(svg).toContain(">MA 1</text>");
    expect(svg).toContain(">MA 2</text>");
  });
});

describe("PDF mit Diagrammbild (E18)", () => {
  it("baut ein gültiges einseitiges PDF in A4 quer mit verlustfreiem Bild", async () => {
    const rgb = new Uint8Array([255, 0, 0, 0, 0, 255]); // 2 × 1 Pixel
    const pdf = imagePdf({
      imageWidth: 2,
      imageHeight: 1,
      deflatedRgb: await deflate(rgb),
      title: "Ziel – Übersicht",
    });
    const text = new TextDecoder("latin1").decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/MediaBox [0 0 842 595]");
    expect(text).toContain("/Width 2 /Height 1");
    // Querverweise zeigen auf die Objekte, startxref auf die Tabelle.
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
    const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) =>
      Number(m[1]),
    );
    offsets.forEach((offset, i) =>
      expect(text.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true),
    );
    // Bilddaten entpacken sich wieder zu den Pixeln.
    const start = text.indexOf("stream\n") + 7;
    const length = Number(/\/Length (\d+) >>\nstream/.exec(text)![1]);
    expect([...inflateSync(pdf.slice(start, start + length))]).toEqual([
      ...rgb,
    ]);
  });
});
