import { AlertTriangleIcon } from "lucide-react";
import type { ScenarioView } from "./scenario-view";
import { formatMinutes, formatPercent } from "@/lib/format";

/**
 * Haupt-KPIs (F130) sichtbar, weitere aufklappbar (F124). Bei nicht
 * zugeordneten Schritten tragen alle Werte einen Unvollständigkeitshinweis (P4).
 */
export function KpiBar({ view }: { view: ScenarioView }) {
  const k = view.result.kpis;
  const overloaded = view.result.stations.filter((s) => s.overTakt).length;
  const maxStationUtilization = Math.max(
    0,
    ...view.result.stations.map((s) => s.stationUtilization),
  );
  const violations = view.result.issues.filter(
    (i) => i.severity === "violation",
  ).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label="Taktzeit" value={`${formatMinutes(k.taktMin)} min`} />
        <Kpi
          label="Mitarbeiter"
          value={String(k.employeeCount)}
          hint={`${view.input.stations.length} Stationen`}
        />
        <Kpi
          label="Personalauslastung"
          value={formatPercent(k.personnelUtilization)}
          hint="belegungsbezogen, inkl. Wartezeit und Zuschlag"
          incomplete={k.incomplete}
        />
        <Kpi
          label="Gesamtarbeitsinhalt"
          value={`${formatMinutes(k.totalWorkContent)} min`}
          hint="zugeordnete Arbeitsgänge, ohne Zuschlag"
          incomplete={k.incomplete}
        />
      </div>

      <details className="group rounded-lg border bg-white px-3 py-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground select-none marker:text-nx-steel-dark">
          Weitere Kennzahlen
        </summary>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-6">
          <Detail
            label="Zuschlag"
            value={`${formatMinutes(view.input.allowancePct)} %`}
          />
          <Detail label="Stationen über Takt" value={String(overloaded)} />
          <Detail
            label="Höchste Stationsbelegung"
            value={formatPercent(maxStationUtilization)}
          />
          <Detail
            label="Ohne Mitarbeiter"
            value={`${k.unassignedStepCount} Arbeitsgänge`}
          />
          <Detail
            label="… davon Arbeitsinhalt"
            value={`${formatMinutes(k.unassignedWorkContent)} min`}
          />
          <Detail label="Restriktionsverletzungen" value={String(violations)} />
        </dl>
      </details>
    </div>
  );
}

function Kpi(props: {
  label: string;
  value: string;
  hint?: string;
  incomplete?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3 shadow-nx-sm">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {props.label}
        {props.incomplete && (
          <span
            className="inline-flex items-center gap-0.5 font-medium text-warning"
            title="Unvollständig: Arbeitsgänge ohne Mitarbeiter sind nicht enthalten."
          >
            <AlertTriangleIcon className="size-3" />
            unvollständig
          </span>
        )}
      </div>
      <div className="font-heading text-2xl font-semibold tabular-nums">
        {props.value}
      </div>
      {props.hint && (
        <div className="text-[11px] text-muted-foreground">{props.hint}</div>
      )}
    </div>
  );
}

function Detail(props: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className="font-medium tabular-nums">{props.value}</dd>
    </div>
  );
}
