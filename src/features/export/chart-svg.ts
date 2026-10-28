import { textColorFor } from "@/domain/model/categories";
import type { ScenarioView } from "@/features/workspace/scenario-view";
import {
  axisMaximum,
  axisTicks,
  type Segment,
  type StationColumn,
} from "@/features/yamazumi/layout";
import type {
  ChartMode,
  LabelFields,
} from "@/features/yamazumi/yamazumi-chart";
import {
  chartStepId,
  formatAxis,
  formatHeadcount,
  formatMinutes,
  formatPercent,
} from "@/lib/format";

export interface ChartExportInput {
  readonly title: string;
  readonly subtitle: string;
  /** Hinweise wie „unvollständig“, „konfliktbehaftet“ oder „gefiltert“. */
  readonly notes: readonly string[];
  readonly footer: string;
  readonly view: ScenarioView;
  readonly columns: readonly StationColumn[];
  readonly mode: ChartMode;
  readonly labels: LabelFields;
}

// Farben wie im Diagramm (globals.css), hier fest, weil die Grafik ohne Stylesheet gerendert wird.
const C = {
  blue: "#003c73",
  red: "#ff5f50",
  muted: "#4d6f93",
  destructive: "#c8372a",
  step: "#bcccda",
  grid: "#e3e8ee",
  wait: "#e6e6e6",
  waitStripe: "#9fb1c5",
  allowance: "#dce6f0",
  unassigned: "#f0d0aa",
  unassignedStripe: "#e8ad69",
  process: "#e3ecf5",
};
const FONT = "Inter, Arial, Helvetica, sans-serif";

const PLOT_HEIGHT = 440;
const LANE_GAP = 3;
const COLUMN_GAP = 28;
const MIN_COLUMN_WIDTH = 64;
const AXIS_WIDTH = 56;
const PAD = 24;

const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Kürzt Text auf die verfügbare Breite (Näherung über die mittlere Zeichenbreite). */
function fit(text: string, width: number, fontSize: number): string {
  const max = Math.floor(width / (fontSize * 0.56));
  if (text.length <= max) return text;
  return max <= 1 ? "" : text.slice(0, max - 1) + "…";
}

function text(
  x: number,
  y: number,
  content: string,
  attrs: Record<string, string | number> = {},
) {
  const extra = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  return `<text x="${x}" y="${y}" ${extra}>${escape(content)}</text>`;
}

/**
 * Yamazumi als eigenständige SVG-Grafik für PNG und PDF (F45, F52, E18): Stationsbezeichnungen,
 * Taktlinie mit Wert, Achse, Stationshöhen und Legende. Zeigt dieselben Spalten wie das Diagramm.
 */
export function chartSvg(input: ChartExportInput) {
  const { view, columns, mode } = input;
  const takt = view.input.taktMin;
  const laneWidth = mode === "employee" ? 72 : 44;
  const unassignedWidth = Math.round(laneWidth * 0.8);
  const lanesWidth = (c: StationColumn) =>
    c.lanes.length * laneWidth + Math.max(0, c.lanes.length - 1) * LANE_GAP;
  // Prozessspur (E44) rechts neben den Mitarbeitern.
  const processWidth = (c: StationColumn) =>
    c.process.length ? LANE_GAP + laneWidth : 0;
  const columnWidth = (c: StationColumn) =>
    Math.max(
      MIN_COLUMN_WIDTH,
      lanesWidth(c) +
        processWidth(c) +
        (c.unassigned.length ? 2 * LANE_GAP + unassignedWidth : 0),
    );

  const maximum = axisMaximum(columns, takt);
  const scale = PLOT_HEIGHT / (maximum * 1.04);
  const headerHeight = 30 + 20 + input.notes.length * 18 + 12;
  const plotTop = PAD + headerHeight + 24;
  const plotBottom = plotTop + PLOT_HEIGHT;
  const y = (minutes: number) => plotBottom - minutes * scale;
  const plotLeft = PAD + AXIS_WIDTH;
  const plotWidth =
    columns.reduce((t, c) => t + columnWidth(c), 0) +
    Math.max(0, columns.length - 1) * COLUMN_GAP +
    16;
  const width = Math.max(900, plotLeft + plotWidth + PAD);
  const laneLabels = mode === "employee" ? 16 : 0;
  const legendTop = plotBottom + 8 + laneLabels + 58;
  const legend = legendLayout(view, legendTop, width);
  const height = legend.bottom + 28 + PAD;

  const out: string[] = [];
  out.push(
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    `<defs>
<pattern id="wait" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="${C.wait}"/><rect width="1" height="4" fill="${C.waitStripe}"/></pattern>
<pattern id="unassigned" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="${C.unassigned}"/><rect width="2" height="7" fill="${C.unassignedStripe}"/></pattern>
</defs>`,
  );

  // Kopf: Szenario, Kenndaten und Hinweise.
  out.push(
    text(PAD, PAD + 22, input.title, {
      "font-size": 22,
      "font-weight": 700,
      fill: C.blue,
    }),
    text(PAD, PAD + 46, input.subtitle, { "font-size": 13, fill: C.muted }),
  );
  input.notes.forEach((note, i) =>
    out.push(
      text(PAD, PAD + 68 + i * 18, note, {
        "font-size": 13,
        "font-weight": 600,
        fill: C.destructive,
      }),
    ),
  );

  // Achse und Raster.
  for (const tick of axisTicks(maximum)) {
    out.push(
      `<line x1="${plotLeft}" x2="${width - PAD}" y1="${y(tick)}" y2="${y(tick)}" stroke="${C.grid}"/>`,
      text(plotLeft - 8, y(tick) + 4, formatAxis(tick), {
        "font-size": 11,
        fill: C.muted,
        "text-anchor": "end",
      }),
    );
  }
  out.push(
    text(plotLeft - 8, plotBottom + 18, "min", {
      "font-size": 11,
      fill: C.muted,
      "text-anchor": "end",
    }),
    `<line x1="${plotLeft}" x2="${plotLeft}" y1="${plotTop - 16}" y2="${plotBottom}" stroke="${C.grid}"/>`,
  );

  const segment = (s: Segment, x: number, w: number) => {
    const top = y(s.to);
    const h = Math.max(1, (s.to - s.from) * scale);
    if (s.kind === "wait")
      return `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="url(#wait)"/>`;
    if (s.kind === "absence")
      return `<rect x="${x + 2}" y="${top}" width="${w - 4}" height="${h}" fill="none" stroke="${C.step}" stroke-dasharray="3 3"/>`;
    if (s.kind === "allowance")
      return (
        `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${C.allowance}" stroke="${C.waitStripe}" stroke-dasharray="3 2"/>` +
        (h >= 12
          ? text(x + w / 2, top + h / 2 + 3.5, "Z", {
              "font-size": 10,
              fill: C.muted,
              "text-anchor": "middle",
            })
          : "")
      );
    const step = view.steps.get(s.stepId)!;
    const category = step.categoryId
      ? view.categoryById.get(step.categoryId)
      : undefined;
    const fill =
      s.kind === "unassigned"
        ? "url(#unassigned)"
        : s.kind === "process"
          ? C.process
          : (category?.color ?? C.step);
    const stroke =
      s.kind === "process"
        ? `stroke="${C.blue}" stroke-width="1.5" stroke-dasharray="4 2"`
        : 'stroke="#ffffff" stroke-width="1"';
    const color =
      s.kind === "step" && category ? textColorFor(category.color) : C.blue;
    const parts = [
      input.labels.id &&
        chartStepId(step.id, view.stations.get(step.stationId)!.label),
      input.labels.description && step.description,
      input.labels.duration && formatMinutes(step.timeMin),
    ].filter(Boolean) as string[];
    const label =
      h >= 12 && parts.length
        ? text(
            x + 2,
            top + Math.min(h - 3, 11),
            fit(parts.join(" · "), w - 4, 10),
            {
              "font-size": 10,
              fill: color,
            },
          )
        : "";
    return `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${fill}" ${stroke}/>${label}`;
  };

  let x = plotLeft + 8;
  for (const column of columns) {
    const w = columnWidth(column);
    const lanes = lanesWidth(column) + processWidth(column);
    // Spuren je Mitarbeiter, zeitlich korrekt nebeneinander (E9).
    column.lanes.forEach((lane, i) => {
      const laneX = x + i * (laneWidth + LANE_GAP);
      lane.segments.forEach((s) => out.push(segment(s, laneX, laneWidth)));
      if (mode === "employee")
        out.push(
          text(
            laneX + laneWidth / 2,
            plotBottom + 14,
            lane.employee.label.replace("Mitarbeiter ", "MA "),
            {
              "font-size": 11,
              fill: lane.overTakt ? C.destructive : C.muted,
              "font-weight": lane.overTakt ? 600 : 400,
              "text-anchor": "middle",
            },
          ),
        );
    });
    const processX = x + lanesWidth(column) + LANE_GAP;
    column.process.forEach((s) => out.push(segment(s, processX, laneWidth)));
    // Nicht zugeordnete Arbeitsgänge daneben, nicht Teil der Stationshöhe (E10).
    const unassignedX = x + lanes + 2 * LANE_GAP;
    column.unassigned.forEach((s) =>
      out.push(segment(s, unassignedX, unassignedWidth)),
    );
    if (lanes > 0) {
      if (column.overTakt && !column.filtered && column.height > takt)
        out.push(
          `<rect x="${x}" y="${y(column.height)}" width="${lanes}" height="${(column.height - takt) * scale}" fill="${C.red}" fill-opacity="0.15" stroke="${C.red}" stroke-width="1.5"/>`,
        );
      const heightLabel = formatMinutes(column.height);
      const labelWidth = heightLabel.length * 6.6 + 8;
      out.push(
        `<line x1="${x}" x2="${x + lanes}" y1="${y(column.height)}" y2="${y(column.height)}" stroke="${C.blue}" stroke-width="2"/>`,
        `<rect x="${x}" y="${y(column.height) - 18}" width="${labelWidth}" height="15" rx="3" fill="${column.overTakt && !column.filtered ? C.red : "#ffffff"}"/>`,
        text(x + 4, y(column.height) - 6.5, heightLabel, {
          "font-size": 11,
          "font-weight": 600,
          fill: column.overTakt && !column.filtered ? "#ffffff" : C.blue,
        }),
      );
    }
    // Fuß: Station, Mitarbeiterzahl, Stationsbelegung (F52, F105).
    const footerTop = plotBottom + 4 + laneLabels;
    const over = column.overTakt && !column.filtered;
    out.push(
      `<line x1="${x}" x2="${x + w}" y1="${footerTop}" y2="${footerTop}" stroke="${over ? C.red : C.blue}" stroke-width="2"/>`,
      text(x + w / 2, footerTop + 18, fit(column.station.label, w, 13), {
        "font-size": 13,
        "font-weight": 700,
        fill: C.blue,
        "text-anchor": "middle",
      }),
      text(
        x + w / 2,
        footerTop + 33,
        `${formatHeadcount(column.employeeCount)} MA`,
        { "font-size": 11, fill: C.muted, "text-anchor": "middle" },
      ),
    );
    if (column.lanes.length > 0 && !column.filtered)
      out.push(
        text(
          x + w / 2,
          footerTop + 47,
          formatPercent(column.stationUtilization),
          {
            "font-size": 11,
            fill: over ? C.destructive : C.muted,
            "font-weight": over ? 600 : 400,
            "text-anchor": "middle",
          },
        ),
      );
    x += w + COLUMN_GAP;
  }

  // Taktlinie mit Wert (F52), über allen Balken.
  const taktLabel = `Takt ${formatMinutes(takt)}`;
  out.push(
    `<line x1="${plotLeft}" x2="${width - PAD}" y1="${y(takt)}" y2="${y(takt)}" stroke="${C.red}" stroke-width="2" stroke-dasharray="6 4"/>`,
    `<rect x="${PAD}" y="${y(takt) - 9}" width="${AXIS_WIDTH - 4}" height="18" rx="3" fill="${C.red}"/>`,
    text(PAD + (AXIS_WIDTH - 4) / 2, y(takt) + 4, taktLabel, {
      "font-size": 10,
      "font-weight": 700,
      fill: "#ffffff",
      "text-anchor": "middle",
    }),
  );

  // Legende, umbrechend; dahinter die Fußzeile.
  out.push(
    ...legend.items.map(
      ({ item, x: lx, y: ly }) =>
        item.swatch(lx, ly) +
        text(lx + item.swatchWidth + 5, ly + 10, item.label, {
          "font-size": 12,
          fill: C.muted,
        }),
    ),
    text(PAD, height - PAD, input.footer, { "font-size": 11, fill: C.muted }),
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">${out.join("")}</svg>`;
  return { svg, width, height };
}

interface LegendItem {
  readonly swatch: (x: number, y: number) => string;
  readonly swatchWidth: number;
  readonly label: string;
}

/** Legende wie im Diagramm, zeilenweise umbrochen auf die Bildbreite. */
function legendLayout(view: ScenarioView, top: number, width: number) {
  const box =
    (fill: string, extra = 'stroke="#ffffff"'): LegendItem["swatch"] =>
    (x, y) =>
      `<rect x="${x}" y="${y}" width="12" height="12" fill="${fill}" ${extra}/>`;
  const entries: LegendItem[] = [
    ...view.categories.map((c) => ({
      swatch: box(c.color),
      swatchWidth: 12,
      label: c.label,
    })),
    {
      swatch: box("url(#wait)"),
      swatchWidth: 12,
      label: "Wartezeit (berechnet)",
    },
    {
      swatch: box(
        C.allowance,
        `stroke="${C.waitStripe}" stroke-dasharray="3 2"`,
      ),
      swatchWidth: 12,
      label: "Zuschlag",
    },
    {
      swatch: box(
        C.process,
        `stroke="${C.blue}" stroke-width="1.5" stroke-dasharray="3 2"`,
      ),
      swatchWidth: 12,
      label: "Prozesszeit (bindet keinen Mitarbeiter)",
    },
    {
      swatch: box("url(#unassigned)"),
      swatchWidth: 12,
      label: "ohne Mitarbeiter (nicht eingerechnet)",
    },
    {
      swatch: (x, y) =>
        `<line x1="${x}" x2="${x + 20}" y1="${y + 6}" y2="${y + 6}" stroke="${C.red}" stroke-width="2" stroke-dasharray="4 3"/>`,
      swatchWidth: 20,
      label: "Taktzeit",
    },
    {
      swatch: box(
        C.red,
        `fill-opacity="0.15" stroke="${C.red}" stroke-width="1.5"`,
      ),
      swatchWidth: 12,
      label: "über Takt",
    },
    { swatch: () => "", swatchWidth: -5, label: "MA = Mitarbeiter" },
  ];
  const items: { item: LegendItem; x: number; y: number }[] = [];
  let x = PAD;
  let y = top;
  for (const item of entries) {
    const itemWidth = item.swatchWidth + 5 + item.label.length * 6.6 + 20;
    if (x > PAD && x + itemWidth > width - PAD) {
      x = PAD;
      y += 22;
    }
    items.push({ item, x, y });
    x += itemWidth;
  }
  return { items, bottom: y + 22 };
}
