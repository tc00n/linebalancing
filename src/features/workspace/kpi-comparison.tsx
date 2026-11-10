import { roundHalfUp, roundPercent } from "@/domain/calc/rounding";
import { formatMinutes, formatPercent } from "@/lib/format";
import type { ScenarioView } from "./scenario-view";

interface Row {
  label: string;
  ist: number | null;
  ziel: number | null;
  format: (value: number | null) => string;
  /** Differenz in derselben Einheit; Prozentwerte als Prozentpunkte. */
  delta: (ist: number, ziel: number) => string;
}

const minutes = (v: number | null) =>
  v === null ? "–" : `${formatMinutes(v)} min`;
const signed = (v: number, unit: string) =>
  `${v > 0 ? "+" : ""}${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} ${unit}`;

/** Kennzahlen von Ist und Ziel nebeneinander mit Differenz (F49, F101). */
export function KpiComparison(props: {
  ist: ScenarioView;
  ziel: ScenarioView;
  movedCount: number;
}) {
  const k = (v: ScenarioView) => v.result.kpis;
  const maxUtil = (v: ScenarioView) =>
    Math.max(0, ...v.result.stations.map((s) => s.stationUtilization));
  const overloaded = (v: ScenarioView) =>
    v.result.stations.filter((s) => s.overTakt).length;

  const rows: Row[] = [
    {
      label: "Taktzeit",
      ist: k(props.ist).taktMin,
      ziel: k(props.ziel).taktMin,
      format: minutes,
      delta: (a, b) => signed(roundHalfUp(b - a), "min"),
    },
    {
      label: "Mitarbeiter",
      ist: k(props.ist).employeeCount,
      ziel: k(props.ziel).employeeCount,
      format: (v) => String(v ?? "–"),
      delta: (a, b) => `${b - a > 0 ? "+" : ""}${b - a}`,
    },
    {
      label: "Personalauslastung",
      ist: k(props.ist).personnelUtilization,
      ziel: k(props.ziel).personnelUtilization,
      format: formatPercent,
      delta: (a, b) =>
        signed(roundHalfUp(roundPercent(b) - roundPercent(a)), "%-Pkt."),
    },
    {
      label: "Höchste Stationsbelegung",
      ist: maxUtil(props.ist),
      ziel: maxUtil(props.ziel),
      format: formatPercent,
      delta: (a, b) =>
        signed(roundHalfUp(roundPercent(b) - roundPercent(a)), "%-Pkt."),
    },
    {
      label: "Stationen über Takt",
      ist: overloaded(props.ist),
      ziel: overloaded(props.ziel),
      format: (v) => String(v ?? "–"),
      delta: (a, b) => `${b - a > 0 ? "+" : ""}${b - a}`,
    },
    {
      label: "Gesamtarbeitsinhalt",
      ist: k(props.ist).totalWorkContent,
      ziel: k(props.ziel).totalWorkContent,
      format: minutes,
      delta: (a, b) => signed(roundHalfUp(b - a), "min"),
    },
  ];

  const columns = [
    ...rows,
    {
      label: "Verschobene Arbeitsgänge",
      ist: null,
      ziel: props.movedCount,
      format: (v: number | null) => String(v ?? "–"),
      delta: () => "",
    } satisfies Row,
  ];
  const lines: {
    label: string;
    cell: (row: Row) => string;
    className: string;
  }[] = [
    { label: "Ist", cell: (r) => r.format(r.ist), className: "" },
    {
      label: "Ziel",
      cell: (r) => r.format(r.ziel),
      className: "font-semibold",
    },
    {
      label: "Veränderung",
      cell: (r) =>
        r.ist !== null && r.ziel !== null ? r.delta(r.ist, r.ziel) : "",
      className: "text-muted-foreground",
    },
  ];

  // U4: Kennzahlen als Spalten, Ist/Ziel/Veränderung als Zeilen – drei statt acht Zeilen,
  // damit die Diagramme auf dem Laptop im ersten Bild stehen.
  return (
    <div className="overflow-x-auto rounded-lg border bg-white shadow-nx-sm">
      <table className="w-full text-sm" aria-label="Kennzahlen Ist und Ziel">
        <thead className="bg-secondary text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium">
              <span className="sr-only">Stand</span>
            </th>
            {columns.map((c) => (
              <th
                key={c.label}
                scope="col"
                className="px-3 py-1.5 text-right font-medium"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.label} className="border-t">
              <th
                scope="row"
                className="px-3 py-1 text-left text-xs font-medium text-muted-foreground"
              >
                {line.label}
              </th>
              {columns.map((c) => (
                <td
                  key={c.label}
                  className={`px-3 py-1 text-right whitespace-nowrap tabular-nums ${line.className}`}
                >
                  {line.cell(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {(k(props.ist).incomplete || k(props.ziel).incomplete) && (
        <p className="border-t px-3 py-1.5 text-xs text-warning-strong">
          Unvollständig: Arbeitsgänge ohne Mitarbeiter sind in den Kennzahlen
          nicht enthalten
          {k(props.ist).incomplete &&
            ` (Ist: ${k(props.ist).unassignedStepCount})`}
          {k(props.ziel).incomplete &&
            ` (Ziel: ${k(props.ziel).unassignedStepCount})`}
          .
        </p>
      )}
    </div>
  );
}
