"use client";

import { LoaderIcon, WandSparklesIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { evaluateScenario } from "@/domain/calc/evaluate";
import { sortStations } from "@/domain/model/stationOrder";
import type { ScenarioInput } from "@/domain/model/types";
import type {
  OptimizeGoal,
  OptimizeResult,
  StationSummary,
} from "@/domain/optimize/optimize";
import { formatMinutes } from "@/lib/format";
import type { OptimizeMessage, OptimizeRequest } from "./optimize.worker";

type Stage =
  | { readonly kind: "idle" }
  | { readonly kind: "running"; readonly percent: number }
  | { readonly kind: "done"; readonly result: OptimizeResult }
  | { readonly kind: "failed"; readonly message: string };

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-white px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Verteilungsvorschlag für eine Station (E43): Ziel wählen, im Hintergrund
 * rechnen, Ergebnis vorher/nachher zeigen und als neues Szenario anlegen.
 * Das bearbeitete Szenario bleibt unverändert.
 */
export function OptimizeSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input: ScenarioInput;
  /** Legt das Ergebnis als neues Szenario an und öffnet den Vergleich. */
  onCreate: (input: ScenarioInput, stationLabel: string) => Promise<void>;
}) {
  const stations = sortStations(props.input.stations);
  const [stationId, setStationId] = useState(() => tallestStation(props.input));
  const [goal, setGoal] = useState<OptimizeGoal>("height");
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [creating, setCreating] = useState(false);
  const worker = useRef<Worker | null>(null);

  const stop = () => {
    worker.current?.terminate();
    worker.current = null;
  };
  useEffect(() => stop, []);

  function start() {
    stop();
    setStage({ kind: "running", percent: 0 });
    const w = new Worker(new URL("./optimize.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    w.onmessage = (event: MessageEvent<OptimizeMessage>) => {
      const message = event.data;
      if (message.type === "progress") {
        setStage({
          kind: "running",
          percent: Math.round((100 * message.done) / message.total),
        });
      } else {
        stop();
        setStage(
          message.type === "done"
            ? { kind: "done", result: message.result }
            : { kind: "failed", message: message.message },
        );
      }
    };
    w.onerror = () => {
      stop();
      setStage({ kind: "failed", message: "Berechnung fehlgeschlagen." });
    };
    w.postMessage({
      input: props.input,
      stationId,
      goal,
    } satisfies OptimizeRequest);
  }

  const stationLabel =
    stations.find((s) => s.id === stationId)?.label ?? stationId;
  const result = stage.kind === "done" ? stage.result : null;
  const improved = result !== null && isBetter(result, goal, props.input);

  return (
    <Sheet
      open={props.open}
      onOpenChange={(open) => {
        if (!open) stop();
        if (!open && stage.kind === "running") setStage({ kind: "idle" });
        props.onOpenChange(open);
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Verteilung vorschlagen</SheetTitle>
          <SheetDescription>
            Verteilt die Arbeitsgänge einer Station auf ihre Mitarbeiter und
            passt die Reihenfolge an. Qualifikation, Vorgänger und gemeinsame
            Arbeitsgänge bleiben gewahrt. Das Ergebnis wird als neues Szenario
            angelegt; dieses Szenario bleibt unverändert.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Station</span>
            <select
              className={selectClass}
              value={stationId}
              disabled={stage.kind === "running"}
              onChange={(e) => {
                setStationId(e.target.value);
                setStage({ kind: "idle" });
              }}
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-muted-foreground">Ziel</legend>
            {(
              [
                [
                  "height",
                  "Kleinste Stationshöhe mit dem vorhandenen Personal",
                ],
                ["headcount", "Möglichst wenige Mitarbeiter unter Takt"],
              ] as const
            ).map(([value, text]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="optimize-goal"
                  value={value}
                  checked={goal === value}
                  disabled={stage.kind === "running"}
                  onChange={() => {
                    setGoal(value);
                    setStage({ kind: "idle" });
                  }}
                />
                {text}
              </label>
            ))}
          </fieldset>

          {stage.kind === "running" ? (
            <div className="flex flex-col gap-2">
              <div
                role="progressbar"
                aria-label="Fortschritt der Berechnung"
                aria-valuenow={stage.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 overflow-hidden rounded-full bg-secondary"
              >
                <div
                  className="h-full bg-nx-blue transition-[width]"
                  style={{ width: `${stage.percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <LoaderIcon className="size-3.5 animate-spin" aria-hidden />
                  Berechne … {stage.percent} %
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    stop();
                    setStage({ kind: "idle" });
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={start} className="self-start">
              <WandSparklesIcon data-icon="inline-start" />
              {stage.kind === "done" ? "Erneut berechnen" : "Berechnen"}
            </Button>
          )}

          {stage.kind === "failed" && (
            <p role="alert" className="text-destructive">
              {stage.message}
            </p>
          )}

          {result && (
            <section aria-label="Ergebnis" className="flex flex-col gap-2">
              <ResultTable
                before={result.before}
                after={result.after}
                taktMin={props.input.taktMin}
              />
              <p className="text-muted-foreground">
                {result.reassigned === 1
                  ? "1 Arbeitsgang"
                  : `${result.reassigned} Arbeitsgänge`}{" "}
                neu zugeordnet, {result.resequenced} mit geänderter Reihenfolge
                {result.removedEmployees > 0 &&
                  `, ${result.removedEmployees} Mitarbeiter frei`}
                .
              </p>
              {!improved && (
                <p className="text-muted-foreground">
                  Keine bessere Verteilung gefunden.
                </p>
              )}
            </section>
          )}
        </div>

        {result && improved && (
          <SheetFooter>
            <Button
              disabled={creating}
              onClick={async () => {
                setCreating(true);
                try {
                  await props.onCreate(result.input, stationLabel);
                } finally {
                  setCreating(false);
                }
              }}
            >
              Als neues Szenario anlegen und vergleichen
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ResultTable(props: {
  before: StationSummary;
  after: StationSummary;
  taktMin: number;
}) {
  const rows: [string, (s: StationSummary) => string][] = [
    ["Stationshöhe", (s) => `${formatMinutes(s.height)} min`],
    ["Mitarbeiter", (s) => String(s.persons)],
    ["ohne Mitarbeiter", (s) => String(s.unassigned)],
  ];
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-muted-foreground">
        <tr>
          <th className="py-1 font-medium" />
          <th className="py-1 text-right font-medium">vorher</th>
          <th className="py-1 text-right font-medium">Vorschlag</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-t">
            <th scope="row" className="py-1 text-left font-normal">
              {label}
            </th>
            <td className="py-1 text-right tabular-nums">
              {value(props.before)}
            </td>
            <td
              className={`py-1 text-right font-semibold tabular-nums ${
                label === "Stationshöhe" && props.after.height > props.taktMin
                  ? "text-destructive"
                  : ""
              }`}
            >
              {value(props.after)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Station mit der größten Höhe als Vorauswahl. */
function tallestStation(input: ScenarioInput): string {
  try {
    const stations = evaluateScenario(input).stations;
    return stations.reduce((a, b) => (b.height > a.height ? b : a)).stationId;
  } catch {
    return sortStations(input.stations)[0]?.id ?? "";
  }
}

/** Lohnt sich das Anlegen? Kleiner Vorsprung durch Gleitkomma zählt nicht. */
function isBetter(
  result: OptimizeResult,
  goal: OptimizeGoal,
  input: ScenarioInput,
): boolean {
  const { before, after } = result;
  if (after.unassigned < before.unassigned) return true;
  if (goal === "headcount") {
    const fits = (s: StationSummary) => s.height <= input.taktMin + 1e-9;
    if (fits(after) && !fits(before)) return true;
    if (fits(after) && after.persons < before.persons) return true;
  }
  return after.height < before.height - 0.005;
}
