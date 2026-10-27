"use client";

import { AlertTriangleIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import type { ScenarioView } from "./scenario-view";
import { formatMinutes, formatPercent } from "@/lib/format";

/**
 * Haupt-KPIs (F130) als schmale Leiste, weitere aufklappbar (F124). Bei nicht
 * zugeordneten Schritten tragen alle Werte einen Unvollständigkeitshinweis (P4).
 * G1: eine Zeile statt Karten, damit das Diagramm auf dem Laptop sichtbar bleibt.
 */
export function KpiBar({ view }: { view: ScenarioView }) {
  const [more, setMore] = useState(false);
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
    <div className="rounded-lg border bg-white px-4 py-2 shadow-nx-sm">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
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
        <button
          type="button"
          className="ml-auto flex items-center gap-1 text-sm text-muted-foreground hover:text-nx-blue"
          aria-expanded={more}
          onClick={() => setMore((v) => !v)}
        >
          Weitere Kennzahlen
          <ChevronDownIcon
            className={`size-4 transition-transform ${more ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {more && (
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 border-t pt-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
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
      )}
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
    <div role="group" aria-label={props.label}>
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
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-xl font-semibold tabular-nums">
          {props.value}
        </span>
        {props.hint && (
          <span className="text-[11px] text-muted-foreground">
            {props.hint}
          </span>
        )}
      </div>
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
