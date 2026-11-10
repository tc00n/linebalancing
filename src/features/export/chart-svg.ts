import { textColorFor } from "@/domain/model/categories";
import type { ScenarioView } from "@/features/workspace/scenario-view";
import {
  barsMaximum,
  type EmployeeBar,
} from "@/features/yamazumi/employee-layout";
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
  charsThatFit,
  employeeShortLabel,
  formatAxis,
  formatHeadcount,
  formatMinutes,
  formatPercent,
  segmentLabel,
} from "@/lib/format";

export interface ChartExportInput {
  readonly title: string;
  readonly subtitle: string;
  /** Hinweise wie „unvollständig“, „konfliktbehaftet“ oder „gefiltert“. */
  readonly notes: readonly string[];
  readonly footer: string;
  readonly view: ScenarioView;
  readonly columns: readonly StationColumn[];
  /** Mitarbeiteransicht (E45): Balken je Person statt Stationsspalten. */
  readonly bars?: readonly EmployeeBar[];
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
  // U8: dunklere Stufen für weiße Schrift auf Rot bzw. Warnzeichen.
  overLabel: "#c8372a",
  warningStrong: "#b45309",
};
const FONT = "Inter, Arial, Helvetica, sans-serif";

const PLOT_HEIGHT = 440;
const LANE_GAP = 3;
const COLUMN_GAP = 28;
const MIN_COLUMN_WIDTH = 64;
const AXIS_WIDTH = 56;
const PAD = 24;
// Mitarbeiteransicht (E45): Stationsleiste links am Balken.
const STRIP = 12;
const MIN_BAR_WIDTH = 56;
const BAR_GAP = 20;
// U9: Die Grafik wird mindestens so breit; Spuren und Balken verteilen sich auf die Breite.
const TARGET_WIDTH = 1400;
const MIN_LANE_WIDTH = 44;
const MAX_LANE_WIDTH = 400;

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
 * Taktlinie mit Wert, Achse, Stationshöhen und Legende. Zeigt dieselben Spalten bzw. in der
 * Mitarbeiteransicht dieselben Balken wie das Diagramm (E45).
 */
export function chartSvg(input: ChartExportInput) {
  const { view, columns } = input;
  const bars = input.mode === "employee" ? input.bars : undefined;
  const takt = view.input.taktMin;
  const plotLeft = PAD + AXIS_WIDTH;
  const available = TARGET_WIDTH - plotLeft - PAD - 16;
  const clampLane = (w: number) =>
    Math.max(MIN_LANE_WIDTH, Math.min(MAX_LANE_WIDTH, Math.floor(w)));
  // U9: Spurbreite so wählen, dass die Stationen die Bildbreite füllen.
  const laneUnits = columns.reduce(
    (t, c) =>
      t +
      c.lanes.length +
      (c.process.length ? 1 : 0) +
      (c.unassigned.length ? 0.8 : 0),
    0,
  );
  const fixedWidth =
    columns.reduce(
      (t, c) =>
        t +
        Math.max(0, c.lanes.length - 1) * LANE_GAP +
        (c.process.length ? LANE_GAP : 0) +
        (c.unassigned.length ? 2 * LANE_GAP : 0),
      0,
    ) +
    Math.max(0, columns.length - 1) * COLUMN_GAP;
  const laneWidth = clampLane(
    laneUnits ? (available - fixedWidth) / laneUnits : MIN_LANE_WIDTH,
  );
  const barWidth = bars?.length
    ? Math.max(
        MIN_BAR_WIDTH,
        Math.min(
          MAX_LANE_WIDTH,
          Math.floor(
            (available - (bars.length - 1) * BAR_GAP) / bars.length - STRIP - 2,
          ),
        ),
      )
    : MIN_BAR_WIDTH;
  const barColumn = STRIP + 2 + barWidth;
  // Beschriftung in den Balken wächst mit der Spurbreite.
  const segmentFont = (w: number) => Math.max(10, Math.min(14, w / 8));
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

  const maximum = bars ? barsMaximum(bars, takt) : axisMaximum(columns, takt);
  const scale = PLOT_HEIGHT / (maximum * 1.04);
  const headerHeight = 30 + 20 + input.notes.length * 18 + 12;
  const plotTop = PAD + headerHeight + 24;
  const plotBottom = plotTop + PLOT_HEIGHT;
  const y = (minutes: number) => plotBottom - minutes * scale;
  const plotWidth = bars
    ? bars.length * barColumn + Math.max(0, bars.length - 1) * BAR_GAP + 16
    : columns.reduce((t, c) => t + columnWidth(c), 0) +
      Math.max(0, columns.length - 1) * COLUMN_GAP +
      16;
  const width = Math.max(TARGET_WIDTH, plotLeft + plotWidth + PAD);
  // Stationsansicht: „MA N“ unter den Spuren (E45).
  const laneLabels = bars ? 0 : 16;
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
    const font = segmentFont(w);
    const shortId = chartStepId(
      step.id,
      view.stations.get(step.stationId)!.label,
    );
    const content = segmentLabel(
      {
        id: input.labels.id ? shortId : undefined,
        description: input.labels.description ? step.description : undefined,
        duration: input.labels.duration
          ? formatMinutes(step.timeMin)
          : undefined,
      },
      charsThatFit(w - 4, font),
    );
    const label =
      h >= font * 1.2 && content
        ? text(
            x + 2,
            top + Math.min(h - 3, font + 1),
            fit(content, w - 4, font),
            {
              "font-size": font,
              fill: color,
            },
          )
        : "";
    // U6: Warnecke für Arbeitsgänge mit Hinweis (außer „ohne Mitarbeiter“).
    const warned = (view.issuesByStep.get(step.id) ?? []).some(
      (issue) => issue.kind !== "step_unassigned",
    );
    const corner = warned
      ? `<path d="M${x + w - 10} ${top} H${x + w} V${top + 10} Z" fill="${C.warningStrong}"/>`
      : "";
    return `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${fill}" ${stroke}/>${label}${corner}`;
  };

  /** Balken einer Person bzw. „ohne MA“/„Prozess“ mit Stationsleiste und Fuß (E45). */
  function employeeBar(bar: EmployeeBar, x: number): string[] {
    const parts: string[] = [];
    const person = bar.kind === "person";
    const segX = x + STRIP + 2;
    for (const group of bar.groups) {
      const top = y(group.to);
      const h = Math.max(1, (group.to - group.from) * scale - 1);
      parts.push(
        `<rect x="${x}" y="${top}" width="${STRIP}" height="${h}" fill="${C.grid}"/>`,
        `<rect x="${x}" y="${top}" width="2" height="${h}" fill="${C.blue}"/>`,
      );
      const label = view.stations.get(group.stationId)!.label;
      if (h >= 24)
        parts.push(
          `<text transform="translate(${x + STRIP / 2 + 4} ${top + h / 2}) rotate(-90)" font-size="9" font-weight="600" fill="${C.blue}" text-anchor="middle">${escape(fit(label, h - 4, 9))}</text>`,
        );
    }
    bar.segments.forEach((s) => parts.push(segment(s, segX, barWidth)));
    for (const group of bar.groups.slice(1))
      parts.push(
        `<line x1="${segX}" x2="${segX + barWidth}" y1="${y(group.from)}" y2="${y(group.from)}" stroke="${C.blue}" stroke-width="2"/>`,
      );
    if (bar.overTakt && bar.top > takt)
      parts.push(
        `<rect x="${segX}" y="${y(bar.top)}" width="${barWidth}" height="${(bar.top - takt) * scale}" fill="${C.red}" fill-opacity="0.15" stroke="${C.red}" stroke-width="1.5"/>`,
      );
    if (bar.top > 0) {
      const value = formatMinutes(bar.occupancy);
      const highlight = person && !bar.filtered && bar.overTakt;
      parts.push(
        `<rect x="${segX}" y="${y(bar.top) - 18}" width="${value.length * 6.6 + 8}" height="15" rx="3" fill="${highlight ? C.overLabel : "#ffffff"}"/>`,
        text(segX + 4, y(bar.top) - 6.5, value, {
          "font-size": 11,
          "font-weight": 600,
          fill: highlight
            ? "#ffffff"
            : person && !bar.filtered
              ? C.blue
              : C.muted,
        }),
      );
    }
    const footerTop = plotBottom + 4;
    const center = x + barColumn / 2;
    const stations = bar.stationIds
      .map((id) => view.stations.get(id)!.label)
      .join(", ");
    parts.push(
      `<line x1="${x}" x2="${x + barColumn}" y1="${footerTop}" y2="${footerTop}" stroke="${bar.overTakt ? C.red : person ? C.blue : C.grid}" stroke-width="2"${person ? "" : ' stroke-dasharray="4 3"'}/>`,
      text(
        center,
        footerTop + 18,
        person
          ? employeeShortLabel(
              bar.label,
              charsThatFit(barColumn + BAR_GAP - 4, 13),
            )
          : fit(bar.label, barColumn + BAR_GAP - 4, 13),
        {
          "font-size": 13,
          "font-weight": 700,
          fill: bar.overTakt ? C.destructive : C.blue,
          "text-anchor": "middle",
        },
      ),
      text(
        center,
        footerTop + 33,
        fit(stations || "–", barColumn + BAR_GAP - 4, 11),
        {
          "font-size": 11,
          fill: C.muted,
          "text-anchor": "middle",
        },
      ),
    );
    if (!person || !bar.filtered)
      parts.push(
        text(
          center,
          footerTop + 47,
          person ? formatPercent(bar.occupancy / takt) : "nicht eingerechnet",
          {
            "font-size": 11,
            fill: bar.overTakt ? C.destructive : C.muted,
            "font-weight": bar.overTakt ? 600 : 400,
            "text-anchor": "middle",
          },
        ),
      );
    return parts;
  }

  let x = plotLeft + 8;
  for (const bar of bars ?? []) {
    out.push(...employeeBar(bar, x));
    x += barColumn + BAR_GAP;
  }
  for (const column of bars ? [] : columns) {
    const w = columnWidth(column);
    const lanes = lanesWidth(column) + processWidth(column);
    // Spuren je Mitarbeiter, zeitlich korrekt nebeneinander (E9).
    column.lanes.forEach((lane, i) => {
      const laneX = x + i * (laneWidth + LANE_GAP);
      lane.segments.forEach((s) => out.push(segment(s, laneX, laneWidth)));
      out.push(
        text(
          laneX + laneWidth / 2,
          plotBottom + 14,
          employeeShortLabel(lane.employee.label, charsThatFit(laneWidth, 11)),
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
        `<rect x="${x}" y="${y(column.height) - 18}" width="${labelWidth}" height="15" rx="3" fill="${column.overTakt && !column.filtered ? C.overLabel : "#ffffff"}"/>`,
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
    `<rect x="${PAD}" y="${y(takt) - 9}" width="${AXIS_WIDTH - 4}" height="18" rx="3" fill="${C.overLabel}"/>`,
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
