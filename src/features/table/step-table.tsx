"use client";

import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  LockIcon,
  XCircleIcon,
} from "lucide-react";
import { Fragment, useState } from "react";
import { Input } from "@/components/ui/input";
import { parseGermanNumber, splitPredecessors } from "@/domain/import/cells";
import {
  compareStationLabels,
  sortStations,
} from "@/domain/model/stationOrder";
import { compareSteps } from "@/domain/model/stepOrder";
import type { Step } from "@/domain/model/types";
import type { Operation } from "@/domain/ops/operations";
import {
  describeIssue,
  type ScenarioView,
} from "@/features/workspace/scenario-view";
import { formatMinutes } from "@/lib/format";
import {
  EmployeeOptions,
  employeeOperation,
} from "@/features/workspace/employee-options";

type SortKey =
  | "id"
  | "description"
  | "time"
  | "station"
  | "employee"
  | "category"
  | "sequence"
  | "start";

const idCollator = new Intl.Collator("de", { numeric: true });
/** Spaltenzahl der Tabelle, für Stationsköpfe und Hinweiszeilen. */
const COLUMNS = 10;
const cellSelect =
  "h-7 rounded-md border border-input bg-white px-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60";

/**
 * Tabellenansicht mit Bearbeitung (F132): eine Zeile je Arbeitsgang, editierbar
 * wie das Detailpanel (E13). ID, Beschreibung und Zeit bleiben gesperrt (F17, F69).
 */
export function StepTable(props: {
  view: ScenarioView;
  steps: readonly Step[];
  onApply: (op: Operation) => string | null;
  /** Ohne Bearbeitungssperre (E27) sind alle Felder gesperrt. */
  readOnly?: boolean;
}) {
  const { view } = props;
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "station",
    dir: 1,
  });

  const stationLabel = (s: Step) => view.stations.get(s.stationId)!.label;
  const employeeLabel = (s: Step) =>
    s.employeeId ? view.employees.get(s.employeeId)!.label : "";
  const categoryLabel = (s: Step) =>
    view.categoryById.get(s.categoryId ?? "")?.label ?? "";
  const start = (s: Step) =>
    view.scheduled.get(s.id)?.start ?? Number.POSITIVE_INFINITY;

  const comparators: Record<SortKey, (a: Step, b: Step) => number> = {
    id: (a, b) => idCollator.compare(a.id, b.id),
    description: (a, b) => a.description.localeCompare(b.description, "de"),
    time: (a, b) => a.timeMin - b.timeMin,
    // Standard: Flussreihenfolge, darin Startzeit und Reihenfolge (E14, F70).
    station: (a, b) =>
      compareStationLabels(stationLabel(a), stationLabel(b)) ||
      start(a) - start(b) ||
      compareSteps(a, b),
    employee: (a, b) => idCollator.compare(employeeLabel(a), employeeLabel(b)),
    category: (a, b) => categoryLabel(a).localeCompare(categoryLabel(b), "de"),
    sequence: (a, b) => a.sequence - b.sequence,
    start: (a, b) => start(a) - start(b),
  };
  const rows = [...props.steps].sort(
    (a, b) => sort.dir * comparators[sort.key](a, b) || compareSteps(a, b),
  );

  const header = (key: SortKey, label: string, className = "") => (
    <th
      scope="col"
      className={`px-2 py-2 font-medium ${className}`}
      aria-sort={
        sort.key === key
          ? sort.dir === 1
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-nx-blue"
        onClick={() =>
          setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }))
        }
      >
        {label}
        {sort.key === key &&
          (sort.dir === 1 ? (
            <ArrowUpIcon className="size-3" />
          ) : (
            <ArrowDownIcon className="size-3" />
          ))}
      </button>
    </th>
  );

  const stations = sortStations(view.input.stations);
  const groups: { id: string; label: string | null; steps: Step[] }[] = [];
  for (const step of rows) {
    const id = sort.key === "station" ? step.stationId : "all";
    const previous = groups[groups.length - 1];
    if (previous?.id === id) previous.steps.push(step);
    else
      groups.push({
        id,
        label: sort.key === "station" ? stationLabel(step) : null,
        steps: [step],
      });
  }

  return (
    <div className="overflow-auto rounded-lg border bg-white shadow-nx-sm">
      <table className="w-full text-sm" aria-label="Arbeitsgänge">
        <thead className="sticky top-0 z-10 bg-secondary text-left text-xs text-muted-foreground">
          <tr>
            {header("id", "Arbeitsgang-ID")}
            {header("description", "Beschreibung")}
            {header("time", "Zeit [min]", "text-right")}
            {header("station", "Station")}
            {header("employee", "Mitarbeiter")}
            {header("category", "Kategorie")}
            {header("sequence", "Reihenfolge")}
            <th scope="col" className="px-2 py-2 font-medium">
              Vorgänger
            </th>
            {header("start", "Start – Ende", "text-right")}
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Wartezeit
            </th>
          </tr>
        </thead>
        {groups.map((group, groupIndex) => (
          <tbody
            key={group.id}
            aria-label={group.label ? "Station " + group.label : undefined}
            className={
              group.label && groupIndex % 2 === 0
                ? "bg-secondary/20"
                : undefined
            }
          >
            {group.label && (
              <tr className="border-y border-nx-blue/15 bg-nx-blue/5">
                <th
                  scope="rowgroup"
                  colSpan={COLUMNS}
                  className="px-3 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-nx-blue px-2.5 py-1 font-semibold text-white">
                      Station {group.label}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {group.steps.length}{" "}
                      {group.steps.length === 1
                        ? "Arbeitsgang"
                        : "Arbeitsgänge"}
                    </span>
                  </div>
                </th>
              </tr>
            )}
            {group.steps.map((step) => {
              const scheduled = view.scheduled.get(step.id);
              const issues = view.issuesByStep.get(step.id) ?? [];
              const marked = step.employeeId
                ? ""
                : "bg-warning/5 shadow-[inset_3px_0_0_var(--warning)]";
              return (
                <Fragment key={step.id}>
                  <tr className={`border-t align-middle ${marked}`}>
                    <th
                      scope="row"
                      rowSpan={issues.length > 0 ? 2 : undefined}
                      className={`px-2 py-1 text-left font-medium whitespace-nowrap ${
                        // Über zwei Zeilen: oben, auf Höhe der Beschreibung.
                        issues.length > 0 ? "pt-2 align-top" : ""
                      }`}
                    >
                      {step.id}
                    </th>
                    <td
                      className="max-w-80 min-w-48 px-2 py-1"
                      title={step.description}
                    >
                      <span className="line-clamp-2">{step.description}</span>
                    </td>
                    <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums">
                      <span
                        className="inline-flex items-center gap-1"
                        title="Importiert, schreibgeschützt"
                      >
                        {formatMinutes(step.timeMin)}
                        <LockIcon
                          className="size-3 text-muted-foreground"
                          aria-hidden
                        />
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <select
                        aria-label={`Station von ${step.id}`}
                        disabled={props.readOnly}
                        className={`${cellSelect} w-auto`}
                        value={step.stationId}
                        onChange={(e) =>
                          props.onApply({
                            type: "moveStep",
                            stepId: step.id,
                            stationId: e.target.value,
                          })
                        }
                      >
                        {stations.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <select
                        aria-label={`Mitarbeiter von ${step.id}`}
                        disabled={props.readOnly}
                        className={`${cellSelect} w-full min-w-40 ${step.employeeId ? "" : "border-warning text-warning"}`}
                        value={step.employeeId ?? ""}
                        onChange={(e) =>
                          props.onApply(
                            employeeOperation(step.id, e.target.value),
                          )
                        }
                      >
                        <option value="">nicht zugeordnet</option>
                        <EmployeeOptions
                          employees={view.input.employees}
                          stations={view.input.stations}
                          stationId={step.stationId}
                        />
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <select
                        aria-label={`Kategorie von ${step.id}`}
                        disabled={props.readOnly}
                        className={`${cellSelect} w-auto`}
                        value={step.categoryId ?? ""}
                        onChange={(e) =>
                          props.onApply({
                            type: "setCategory",
                            stepId: step.id,
                            categoryId: e.target.value,
                          })
                        }
                      >
                        {view.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <SequenceCell
                        step={step}
                        onApply={props.onApply}
                        disabled={props.readOnly}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <PredecessorCell
                        step={step}
                        onApply={props.onApply}
                        disabled={props.readOnly}
                      />
                    </td>
                    <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums">
                      {scheduled
                        ? `${formatMinutes(scheduled.start)} – ${formatMinutes(scheduled.end)}`
                        : "–"}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {scheduled && scheduled.waitBefore > 0
                        ? formatMinutes(scheduled.waitBefore)
                        : ""}
                    </td>
                  </tr>
                  {/* G4: Hinweise unter dem Arbeitsgang über die volle Breite statt in einer schmalen Spalte. */}
                  {issues.length > 0 && (
                    <tr className={marked}>
                      <td colSpan={COLUMNS - 1} className="px-2 pb-1.5">
                        <ul className="flex flex-col gap-0.5 text-xs">
                          {issues.map((issue, i) => (
                            <li
                              key={i}
                              className={`flex gap-1 ${
                                issue.severity === "violation"
                                  ? "text-destructive"
                                  : "text-warning"
                              }`}
                            >
                              {issue.severity === "violation" ? (
                                <XCircleIcon className="mt-0.5 size-3 shrink-0" />
                              ) : (
                                <AlertTriangleIcon className="mt-0.5 size-3 shrink-0" />
                              )}
                              {describeIssue(issue, view)}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        ))}
      </table>
      {rows.length === 0 && (
        <p className="p-4 text-sm text-muted-foreground">
          Keine Arbeitsgänge passen zu Suche und Filter.
        </p>
      )}
    </div>
  );
}

function SequenceCell(props: {
  step: Step;
  onApply: (op: Operation) => string | null;
  disabled?: boolean;
}) {
  const shown = String(props.step.sequence).replace(".", ",");
  return (
    <Input
      key={shown}
      defaultValue={shown}
      inputMode="decimal"
      aria-label={`Reihenfolge von ${props.step.id}`}
      disabled={props.disabled}
      className="h-7 w-20 tabular-nums"
      onBlur={(e) => {
        const parsed = parseGermanNumber(e.target.value);
        const rejected =
          !parsed.ok ||
          (parsed.value !== props.step.sequence &&
            props.onApply({
              type: "setSequence",
              stepId: props.step.id,
              sequence: parsed.value,
            }) !== null);
        if (rejected) e.target.value = shown;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

/** Vorgänger wie im Excel-Template mit „;“ getrennt (F74); Kreise werden abgelehnt (E3). */
function PredecessorCell(props: {
  step: Step;
  onApply: (op: Operation) => string | null;
  disabled?: boolean;
}) {
  const shown = props.step.predecessorIds.join("; ");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex min-w-36 flex-col gap-0.5">
      <Input
        key={shown}
        defaultValue={shown}
        aria-label={`Vorgänger von ${props.step.id}`}
        disabled={props.disabled}
        aria-invalid={error !== null}
        placeholder="keine"
        className="h-7"
        onBlur={(e) => {
          const ids = splitPredecessors(e.target.value);
          if (ids.join("; ") === shown) {
            setError(null);
            return;
          }
          const result = props.onApply({
            type: "setPredecessors",
            stepId: props.step.id,
            predecessorIds: ids,
          });
          setError(result);
          if (result) e.target.value = shown;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      {error && (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
