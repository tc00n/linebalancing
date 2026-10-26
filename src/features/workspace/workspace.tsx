"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  Redo2Icon,
  Undo2Icon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  scenarioRepository,
  type StoredScenario,
} from "@/data/scenarioRepository";
import { evaluateScenario } from "@/domain/calc/evaluate";
import { parseGermanNumber } from "@/domain/import/cells";
import type { Category } from "@/domain/model/categories";
import type { Operation } from "@/domain/ops/operations";
import { axisMaximum, buildColumns } from "@/features/yamazumi/layout";
import {
  YamazumiChart,
  type ChartActions,
  type ChartMode,
  type LabelFields,
} from "@/features/yamazumi/yamazumi-chart";
import { formatDateTime, formatMinutes } from "@/lib/format";
import { DetailPanel } from "./detail-panel";
import { IssuesList } from "./issues-list";
import { KpiBar } from "./kpi-bar";
import { createScenarioView } from "./scenario-view";
import { useScenarioEditor, type SaveStatus } from "./use-scenario-editor";

export function Workspace() {
  const id = useSearchParams().get("id");
  const [loaded, setLoaded] = useState<{
    id: string;
    scenario: StoredScenario | null;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    scenarioRepository()
      .get(id)
      .then((scenario) => {
        if (active) setLoaded({ id, scenario: scenario ?? null });
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (id && (!loaded || loaded.id !== id)) {
    return <p className="p-8 text-muted-foreground">Lade Szenario …</p>;
  }
  if (!id || !loaded?.scenario) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <XCircleIcon />
          <AlertTitle>Szenario nicht gefunden</AlertTitle>
          <AlertDescription>
            Es ist in diesem Browser nicht gespeichert.{" "}
            <Link href="/">Zur Szenarioliste</Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  return (
    <ScenarioWorkspace key={loaded.scenario.id} scenario={loaded.scenario} />
  );
}

const LABEL_KEYS = ["id", "description", "duration"] as const;

function ScenarioWorkspace({ scenario }: { scenario: StoredScenario }) {
  const editor = useScenarioEditor(scenario);
  const { doc } = editor;

  const evaluation = useMemo(() => {
    try {
      const result = evaluateScenario(doc.input);
      return {
        ok: true as const,
        view: createScenarioView(doc.input, result, doc.categories),
        columns: buildColumns(doc.input, result),
      };
    } catch (error) {
      return { ok: false as const, message: String(error) };
    }
  }, [doc]);

  const [mode, setMode] = useState<ChartMode>("station");
  const [labels, setLabels] = useState<LabelFields>({
    id: true,
    description: false,
    duration: true,
  });
  const [laneWidth, setLaneWidth] = useState(36);
  const [pxPerMinute, setPxPerMinute] = useState(() =>
    evaluation.ok
      ? clamp(
          Math.round(440 / axisMaximum(evaluation.columns, doc.input.taktMin)),
          1,
          300,
        )
      : 40,
  );
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [showIssues, setShowIssues] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedStepId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const apply = editor.apply;
  const actions: ChartActions = {
    onMoveStep: (stepId, stationId) => {
      // F61/F95: nach dem Ablegen ohne Mitarbeiter; Panel öffnen, damit direkt zugewiesen werden kann (F100).
      if (!apply({ type: "moveStep", stepId, stationId }))
        setSelectedStepId(stepId);
    },
    onAssignEmployee: (stepId, employeeId) =>
      apply({ type: "assignEmployee", stepId, employeeId }),
    onAddEmployee: (stationId) => apply({ type: "addEmployee", stationId }),
    onRemoveEmployee: (employeeId) =>
      apply({ type: "removeEmployee", employeeId }),
  };

  if (!evaluation.ok) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <XCircleIcon />
          <AlertTitle>Szenario kann nicht berechnet werden</AlertTitle>
          <AlertDescription className="whitespace-pre-line">
            {evaluation.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { view, columns } = evaluation;
  const kpis = view.result.kpis;
  const violations = view.result.issues.filter(
    (i) => i.severity === "violation",
  );

  return (
    <div className="flex flex-col gap-4 p-4 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          {/* Links, damit das Detailpanel rechts Rückgängig/Wiederholen nicht verdeckt. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold">{scenario.name}</h1>
            <SaveIndicator status={editor.saveStatus} />
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={editor.undo}
                disabled={!editor.canUndo}
                aria-label="Rückgängig"
                title="Rückgängig (Strg+Z)"
              >
                <Undo2Icon />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={editor.redo}
                disabled={!editor.canRedo}
                aria-label="Wiederholen"
                title="Wiederholen (Strg+Y)"
              >
                <Redo2Icon />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Variante {scenario.variantName} · {scenario.sourceFilename} ·
            zuletzt geändert {formatDateTime(editor.updatedAt)}
          </p>
        </div>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Szenarien
        </Link>
      </div>

      <KpiBar view={view} />

      {editor.error && (
        <Alert variant="destructive">
          <XCircleIcon />
          <AlertTitle>Änderung nicht möglich</AlertTitle>
          <AlertDescription>{editor.error}</AlertDescription>
          <button
            type="button"
            className="absolute top-2 right-2 rounded p-1 hover:bg-secondary"
            onClick={editor.clearError}
            aria-label="Meldung schließen"
          >
            <XIcon className="size-4" />
          </button>
        </Alert>
      )}
      {kpis.incomplete && (
        <Alert className="border-warning/40 bg-warning/5">
          <AlertTriangleIcon className="text-warning" />
          <AlertTitle>Ergebnis unvollständig</AlertTitle>
          <AlertDescription>
            {kpis.unassignedStepCount} Arbeitsgänge (
            {formatMinutes(kpis.unassignedWorkContent)} min) haben keinen
            Mitarbeiter. Sie sind schraffiert dargestellt und in keiner Zeit und
            Kennzahl enthalten. Zuordnen per Klick auf den Arbeitsgang.
          </AlertDescription>
        </Alert>
      )}
      {violations.length > 0 && (
        <Alert variant="destructive">
          <XCircleIcon />
          <AlertTitle>Szenario ist konfliktbehaftet</AlertTitle>
          <AlertDescription>
            {violations.length} Vorgängerbeziehungen sind verletzt. Details
            unter „Hinweise“.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-white px-3 py-2">
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[mode]}
          onValueChange={(value) => value[0] && setMode(value[0] as ChartMode)}
          aria-label="Ansicht"
        >
          <ToggleGroupItem value="station">Stationen</ToggleGroupItem>
          <ToggleGroupItem value="employee">Mitarbeiter</ToggleGroupItem>
        </ToggleGroup>

        <NumberSetting
          label="Takt [min]"
          value={doc.input.taktMin}
          onCommit={(taktMin) => apply({ type: "setTakt", taktMin })}
        />
        <NumberSetting
          label="Zuschlag [%]"
          value={doc.input.allowancePct}
          onCommit={(allowancePct) =>
            apply({ type: "setAllowance", allowancePct })
          }
        />

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Beschriftung</span>
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            multiple
            value={LABEL_KEYS.filter((key) => labels[key])}
            onValueChange={(value) =>
              setLabels({
                id: value.includes("id"),
                description: value.includes("description"),
                duration: value.includes("duration"),
              })
            }
            aria-label="Segmentbeschriftung"
          >
            <ToggleGroupItem value="id">ID</ToggleGroupItem>
            <ToggleGroupItem value="description">Text</ToggleGroupItem>
            <ToggleGroupItem value="duration">Dauer</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <ScaleSlider
          label="Breite"
          value={laneWidth}
          min={14}
          max={96}
          onChange={setLaneWidth}
        />
        <ScaleSlider
          label="Zeitskala"
          value={pxPerMinute}
          min={1}
          max={300}
          onChange={setPxPerMinute}
        />

        <Button
          variant={showIssues ? "secondary" : "outline"}
          className="ml-auto"
          onClick={() => setShowIssues((v) => !v)}
          aria-expanded={showIssues}
        >
          Hinweise ({view.result.issues.length})
        </Button>
      </div>

      {showIssues && (
        <div className="rounded-lg border bg-white p-2">
          <IssuesList view={view} onSelectStep={setSelectedStepId} />
        </div>
      )}

      <YamazumiChart
        view={view}
        columns={columns}
        mode={mode}
        laneWidth={laneWidth}
        pxPerMinute={pxPerMinute}
        labels={labels}
        selectedStepId={selectedStepId}
        onSelectStep={setSelectedStepId}
        actions={actions}
      />

      <Legend categories={doc.categories} onApply={apply} />

      {selectedStepId && (
        <DetailPanel
          key={selectedStepId}
          view={view}
          stepId={selectedStepId}
          onClose={() => setSelectedStepId(null)}
          onSelectStep={setSelectedStepId}
          onApply={apply}
        />
      )}
    </div>
  );
}

/** Speicherstatus neben dem Szenarionamen (F119). */
function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <span
        className="flex items-center gap-1 text-xs font-normal text-muted-foreground"
        role="status"
      >
        <Loader2Icon className="size-4 animate-spin" /> speichert …
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className="flex items-center gap-1 text-xs font-medium text-destructive"
        role="alert"
      >
        <AlertTriangleIcon className="size-4" /> nicht gespeichert
      </span>
    );
  }
  return (
    <span
      className="flex items-center gap-1 text-xs font-normal text-muted-foreground"
      role="status"
      title="Alle Änderungen sind in diesem Browser gespeichert."
    >
      <CheckCircle2Icon className="size-4 text-chart-3" /> gespeichert
    </span>
  );
}

/** Zahleneingabe, die erst beim Verlassen bzw. Enter übernommen wird (F59, F60). */
function NumberSetting(props: {
  label: string;
  value: number;
  onCommit: (value: number) => string | null;
}) {
  const shown = formatMinutes(props.value);
  const [invalid, setInvalid] = useState(false);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{props.label}</span>
      <Input
        key={shown}
        defaultValue={shown}
        inputMode="decimal"
        aria-invalid={invalid}
        className="h-8 w-20 tabular-nums"
        onBlur={(e) => {
          const parsed = parseGermanNumber(e.target.value);
          const error = parsed.ok
            ? parsed.value === props.value
              ? null
              : props.onCommit(parsed.value)
            : "ungültig";
          setInvalid(error !== null);
          if (error) e.target.value = shown;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}

function ScaleSlider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{props.label}</span>
      {/* Feste Breite außen: der Slider selbst ist auf 100 % seines Containers gesetzt. */}
      <div className="w-28">
        <Slider
          min={props.min}
          max={props.max}
          value={[props.value]}
          onValueChange={(value) =>
            props.onChange(Array.isArray(value) ? value[0] : value)
          }
          aria-label={props.label}
        />
      </div>
    </label>
  );
}

/** Legende mit änderbaren Kategoriefarben (F27, F93, F97). */
function Legend(props: {
  categories: readonly Category[];
  onApply: (op: Operation) => string | null;
}) {
  const swatch = "inline-block size-3 rounded-sm border border-white";
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
      {props.categories.map((c) => (
        <label
          key={c.id}
          className="flex cursor-pointer items-center gap-1.5"
          title="Farbe ändern"
        >
          <input
            type="color"
            value={c.color}
            onChange={(e) =>
              props.onApply({
                type: "setCategoryColor",
                categoryId: c.id,
                color: e.target.value,
              })
            }
            className="size-4 cursor-pointer rounded-sm border-0 bg-transparent p-0"
            aria-label={`Farbe der Kategorie ${c.label}`}
          />
          {c.label}
        </label>
      ))}
      <span className="flex items-center gap-1.5">
        <span
          className={swatch}
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, var(--yz-wait) 0 3px, var(--yz-wait-stripe) 3px 4px)",
          }}
        />
        Wartezeit (berechnet)
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className={`${swatch} border-dashed border-nx-steel-dark bg-(--yz-allowance)`}
        />
        Zuschlag
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className={swatch}
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, color-mix(in srgb, var(--yz-unassigned) 35%, white) 0 3px, color-mix(in srgb, var(--yz-unassigned) 60%, white) 3px 5px)",
          }}
        />
        ohne Mitarbeiter (nicht eingerechnet)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0 w-5 border-t-2 border-dashed border-(--yz-takt)" />
        Taktzeit
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-3 border-2 border-(--yz-over) bg-(--yz-over)/15" />
        über Takt
      </span>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
