"use client";

import { AlertTriangleIcon, LockIcon, PlusIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseGermanNumber } from "@/domain/import/cells";
import { sortStations } from "@/domain/model/stationOrder";
import type { Operation } from "@/domain/ops/operations";
import { formatMinutes } from "@/lib/format";
import { EmployeeOptions, employeeOperation } from "./employee-options";
import { describeIssue, type ScenarioView } from "./scenario-view";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-white px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Detailpanel als Overlay rechts über dem Diagramm (F33, F123, F126).
 * Nicht modal, damit Drag-and-drop bedienbar bleibt. Editierbar sind
 * Station, Mitarbeiter, Kategorie, Reihenfolge und Vorgänger (E13, F127);
 * importierte Zeit und Arbeitsgang-ID bleiben schreibgeschützt (F17, F69).
 */
export function DetailPanel(props: {
  view: ScenarioView;
  stepId: string;
  onClose: () => void;
  onSelectStep: (stepId: string) => void;
  /** Ohne Änderungsfunktion ist das Panel schreibgeschützt (Ist im Vergleich, F118). */
  onApply?: (op: Operation) => string | null;
  /** Kennzeichnung der Seite im Vergleich, z. B. „Ist“. */
  context?: string;
}) {
  const { view } = props;
  const step = view.steps.get(props.stepId);
  const ids = useId();
  const [predecessorError, setPredecessorError] = useState<string | null>(null);
  const [newPredecessor, setNewPredecessor] = useState("");
  if (!step) return null;

  const readOnly = !props.onApply;
  const apply = (op: Operation) => props.onApply?.(op) ?? null;

  const scheduled = view.scheduled.get(step.id);
  const issues = view.issuesByStep.get(step.id) ?? [];
  const successors = view.successors.get(step.id) ?? [];

  function setPredecessors(predecessorIds: string[]) {
    const error = apply({
      type: "setPredecessors",
      stepId: step!.id,
      predecessorIds,
    });
    setPredecessorError(error);
    if (!error) setNewPredecessor("");
  }

  return (
    <aside
      className="fixed top-14 right-0 bottom-0 z-40 flex w-full max-w-sm flex-col border-l bg-white shadow-nx"
      aria-label={`Details zu Arbeitsgang ${step.id}`}
    >
      <header className="flex items-start gap-2 border-b p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            Arbeitsgang
            {props.context && ` · ${props.context}`}
            {readOnly && " · schreibgeschützt"}
          </p>
          <h2 className="truncate text-lg font-semibold">{step.id}</h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={props.onClose}
          aria-label="Detailpanel schließen"
        >
          <XIcon />
        </Button>
      </header>

      <div className="flex flex-col gap-4 overflow-y-auto p-4 text-sm">
        <p>{step.description}</p>

        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5">
          <dt className="text-muted-foreground">Zeit</dt>
          <dd className="tabular-nums">
            {formatMinutes(step.timeMin)} min
            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <LockIcon className="size-3" aria-hidden />
              importiert, schreibgeschützt
            </span>
          </dd>

          <dt>
            <label htmlFor={`${ids}-station`} className="text-muted-foreground">
              Station
            </label>
          </dt>
          <dd>
            <select
              id={`${ids}-station`}
              className={selectClass}
              value={step.stationId}
              disabled={readOnly}
              onChange={(e) =>
                apply({
                  type: "moveStep",
                  stepId: step.id,
                  stationId: e.target.value,
                })
              }
            >
              {sortStations(view.input.stations).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </dd>

          <dt>
            <label
              htmlFor={`${ids}-employee`}
              className="text-muted-foreground"
            >
              Mitarbeiter
            </label>
          </dt>
          <dd>
            <select
              id={`${ids}-employee`}
              className={`${selectClass} ${step.employeeId ? "" : "border-warning text-warning"}`}
              value={step.employeeId ?? ""}
              disabled={readOnly}
              onChange={(e) =>
                apply(employeeOperation(step.id, e.target.value))
              }
            >
              <option value="">nicht zugeordnet</option>
              <EmployeeOptions
                employees={view.input.employees}
                stations={view.input.stations}
                stationId={step.stationId}
              />
            </select>
          </dd>

          <dt>
            <label
              htmlFor={`${ids}-category`}
              className="text-muted-foreground"
            >
              Kategorie
            </label>
          </dt>
          <dd className="flex items-center gap-2">
            <span
              className="size-4 shrink-0 rounded-sm border"
              style={{
                backgroundColor: view.categoryById.get(step.categoryId ?? "")
                  ?.color,
              }}
              aria-hidden
            />
            <select
              id={`${ids}-category`}
              className={selectClass}
              value={step.categoryId ?? ""}
              disabled={readOnly}
              onChange={(e) =>
                apply({
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
          </dd>

          <dt>
            <label
              htmlFor={`${ids}-sequence`}
              className="text-muted-foreground"
            >
              Reihenfolge
            </label>
          </dt>
          <dd>
            <Input
              id={`${ids}-sequence`}
              key={`${step.id}-${step.sequence}`}
              defaultValue={String(step.sequence).replace(".", ",")}
              inputMode="decimal"
              className="h-8"
              disabled={readOnly}
              onBlur={(e) => {
                const parsed = parseGermanNumber(e.target.value);
                const rejected =
                  !parsed.ok ||
                  (parsed.value !== step.sequence &&
                    apply({
                      type: "setSequence",
                      stepId: step.id,
                      sequence: parsed.value,
                    }) !== null);
                if (rejected) {
                  e.target.value = String(step.sequence).replace(".", ",");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          </dd>

          {scheduled && (
            <>
              <dt className="text-muted-foreground">Start – Ende</dt>
              <dd className="tabular-nums">
                {formatMinutes(scheduled.start)} –{" "}
                {formatMinutes(scheduled.end)} min
              </dd>
              <dt className="text-muted-foreground">Wartezeit davor</dt>
              <dd className="tabular-nums">
                {formatMinutes(scheduled.waitBefore)} min
              </dd>
            </>
          )}

          <dt className="self-start pt-1 text-muted-foreground">Vorgänger</dt>
          <dd className="flex flex-col gap-1.5">
            <span className="flex flex-wrap gap-1">
              {step.predecessorIds.length === 0 && (
                <span className="text-muted-foreground">keine</span>
              )}
              {step.predecessorIds.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center rounded-md bg-secondary text-xs font-medium"
                >
                  <button
                    type="button"
                    className="px-1.5 py-0.5 hover:underline"
                    onClick={() => props.onSelectStep(id)}
                  >
                    {id}
                  </button>
                  {!readOnly && (
                    <button
                      type="button"
                      className="rounded-r-md px-1 py-0.5 hover:bg-nx-steel"
                      aria-label={`Vorgänger ${id} entfernen`}
                      onClick={() =>
                        setPredecessors(
                          step.predecessorIds.filter((p) => p !== id),
                        )
                      }
                    >
                      <XIcon className="size-3" />
                    </button>
                  )}
                </span>
              ))}
            </span>
            {!readOnly && (
              <form
                className="flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const id = newPredecessor.trim();
                  if (id) setPredecessors([...step.predecessorIds, id]);
                }}
              >
                <Input
                  aria-label="Vorgänger hinzufügen"
                  placeholder="Arbeitsgang-ID"
                  list={`${ids}-steps`}
                  value={newPredecessor}
                  onChange={(e) => setNewPredecessor(e.target.value)}
                  className="h-7 text-xs"
                />
                <datalist id={`${ids}-steps`}>
                  {view.input.steps
                    .filter(
                      (s) =>
                        s.id !== step.id && !step.predecessorIds.includes(s.id),
                    )
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.description}
                      </option>
                    ))}
                </datalist>
                <Button
                  type="submit"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Vorgänger hinzufügen"
                >
                  <PlusIcon />
                </Button>
              </form>
            )}
            {predecessorError && (
              <p className="text-xs text-destructive" role="alert">
                {predecessorError}
              </p>
            )}
          </dd>

          <dt className="text-muted-foreground">Nachfolger</dt>
          <dd className="flex flex-wrap gap-1">
            {successors.length === 0 && (
              <span className="text-muted-foreground">keine</span>
            )}
            {successors.map((id) => (
              <button
                key={id}
                type="button"
                className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium hover:bg-nx-steel"
                onClick={() => props.onSelectStep(id)}
              >
                {id}
              </button>
            ))}
          </dd>
        </dl>

        <section>
          <h3 className="mb-1.5 text-xs font-semibold tracking-wide uppercase">
            Hinweise
          </h3>
          {issues.length === 0 ? (
            <p className="text-muted-foreground">Keine Warnungen.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {issues.map((issue, i) => (
                <li
                  key={i}
                  className={`flex gap-1.5 ${
                    issue.severity === "violation"
                      ? "text-destructive"
                      : "text-warning"
                  }`}
                >
                  <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                  {describeIssue(issue, view)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
