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

  return (
    <div className="overflow-x-auto rounded-lg border bg-white shadow-nx-sm">
      <table className="w-full text-sm" aria-label="Kennzahlen Ist und Ziel">
        <thead className="bg-secondary text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Kennzahl</th>
            <th className="px-3 py-2 text-right font-medium">Ist</th>
            <th className="px-3 py-2 text-right font-medium">Ziel</th>
            <th className="px-3 py-2 text-right font-medium">Veränderung</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t">
              <th scope="row" className="px-3 py-1.5 text-left font-normal">
                {row.label}
              </th>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {row.format(row.ist)}
              </td>
              <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                {row.format(row.ziel)}
              </td>
              <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">
                {row.ist !== null && row.ziel !== null
                  ? row.delta(row.ist, row.ziel)
                  : "–"}
              </td>
            </tr>
          ))}
          <tr className="border-t">
            <th scope="row" className="px-3 py-1.5 text-left font-normal">
              Verschobene Arbeitsgänge
            </th>
            <td className="px-3 py-1.5 text-right text-muted-foreground">–</td>
            <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
              {props.movedCount}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
      {(k(props.ist).incomplete || k(props.ziel).incomplete) && (
        <p className="border-t px-3 py-1.5 text-xs text-warning">
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
