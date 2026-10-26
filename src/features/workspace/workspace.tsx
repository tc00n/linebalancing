"use client";

import { AlertTriangleIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  scenarioRepository,
  type StoredScenario,
} from "@/data/scenarioRepository";
import { evaluateScenario } from "@/domain/calc/evaluate";
import { axisMaximum, buildColumns } from "@/features/yamazumi/layout";
import {
  YamazumiChart,
  type ChartMode,
  type LabelFields,
} from "@/features/yamazumi/yamazumi-chart";
import { formatDateTime, formatMinutes } from "@/lib/format";
import { DetailPanel } from "./detail-panel";
import { IssuesList } from "./issues-list";
import { KpiBar } from "./kpi-bar";
import { createScenarioView } from "./scenario-view";

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
  const evaluation = useMemo(() => {
    try {
      const result = evaluateScenario(scenario.input);
      return {
        ok: true as const,
        view: createScenarioView(scenario.input, result),
        columns: buildColumns(scenario.input, result),
      };
    } catch (error) {
      return { ok: false as const, message: String(error) };
    }
  }, [scenario]);

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
          Math.round(
            440 / axisMaximum(evaluation.columns, scenario.input.taktMin),
          ),
          4,
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
          <h1 className="text-2xl font-semibold">{scenario.name}</h1>
          <p className="text-sm text-muted-foreground">
            Variante {scenario.variantName} · {scenario.sourceFilename} ·
            importiert {formatDateTime(scenario.importedAt)}
          </p>
        </div>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Szenarien
        </Link>
      </div>

      <KpiBar view={view} />

      {kpis.incomplete && (
        <Alert className="border-warning/40 bg-warning/5">
          <AlertTriangleIcon className="text-warning" />
          <AlertTitle>Ergebnis unvollständig</AlertTitle>
          <AlertDescription>
            {kpis.unassignedStepCount} Arbeitsgänge (
            {formatMinutes(kpis.unassignedWorkContent)} min) haben keinen
            Mitarbeiter. Sie sind schraffiert dargestellt und in keiner Zeit und
            Kennzahl enthalten.
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
          min={4}
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
      />

      <Legend />

      {selectedStepId && (
        <DetailPanel
          view={view}
          stepId={selectedStepId}
          onClose={() => setSelectedStepId(null)}
          onSelectStep={setSelectedStepId}
        />
      )}
    </div>
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

function Legend() {
  const swatch = "inline-block size-3 rounded-sm border border-white";
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className={`${swatch} bg-(--yz-step)`} /> Arbeitsgang
      </span>
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
