"use client";
import { useScenarioRepository } from "@/features/projects/use-scenario-repository";

import {
  BarChart3Icon,
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
import { type StoredScenario } from "@/data/scenarioRepository";
import { evaluateScenario } from "@/domain/calc/evaluate";
import {
  EMPTY_FILTER,
  matchesFilter,
  type StepFilter,
} from "@/features/yamazumi/layout";
import { ExportMenu } from "@/features/export/export-menu";
import { FilterBar } from "@/features/workspace/filter-bar";
import { KpiBar } from "@/features/workspace/kpi-bar";
import { createScenarioView } from "@/features/workspace/scenario-view";
import { useScenarioEditor } from "@/features/workspace/use-scenario-editor";
import { LockNotice, useLockFollowUp } from "@/features/workspace/lock-notice";
import { useScenarioLock } from "@/features/workspace/use-scenario-lock";
import { SaveIndicator } from "@/features/workspace/workspace-controls";
import { formatDateTime } from "@/lib/format";
import { StepTable } from "./step-table";

/** Eigene Seite der Tabellenansicht je Szenario (F132). */
export function TableWorkspace() {
  const repository = useScenarioRepository();
  const [loadError, setLoadError] = useState("");
  const search = useSearchParams();
  const id = search.get("id");
  // Rückweg zur vorherigen Diagrammansicht (Ist/Ziel/Vergleich).
  const back = search.get("von") ?? (id ? `ist=${id}` : "");
  const [loaded, setLoaded] = useState<{
    id: string;
    scenario: StoredScenario | null;
  } | null>(null);
  // E27: nach dem Erwerb einer zuvor fremden Sperre den aktuellen Stand laden.
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    repository
      .get(id)
      .then((scenario) => {
        if (active) setLoaded({ id, scenario: scenario ?? null });
      })
      .catch(() =>
        setLoadError(
          "Szenario konnte nicht geladen werden. Bitte Projektzugang und Verbindung pr\u00fcfen.",
        ),
      );
    return () => {
      active = false;
    };
  }, [id, repository, reloads]);

  if (loadError)
    return (
      <p role="alert" className="p-8 text-destructive">
        {loadError}
      </p>
    );
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
            Es ist im aktiven Projekt nicht verfügbar.{" "}
            <Link href="/">Zur Szenarioliste</Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  return (
    <ScenarioTable
      // Neuer gespeicherter Stand (z. B. aus dem Diagramm) baut den Bearbeitungszustand neu auf.
      key={`${loaded.scenario.id}:${loaded.scenario.updatedAt}`}
      scenario={loaded.scenario}
      back={back}
      reload={() => setReloads((n) => n + 1)}
    />
  );
}

function ScenarioTable(props: {
  scenario: StoredScenario;
  back: string;
  reload: () => void;
}) {
  // E27: dieselbe Sperre wie im Diagramm dieses Tabs; ohne Sperre schreibgeschützt (F51).
  const lock = useScenarioLock(props.scenario.id);
  const readOnly = lock.status !== "held";
  const editor = useScenarioEditor(props.scenario, readOnly);
  useLockFollowUp(lock, editor.saveStatus, props.reload);
  const [filter, setFilter] = useState<StepFilter>(EMPTY_FILTER);
  const [query, setQuery] = useState("");

  const view = useMemo(() => {
    try {
      const { input, categories } = editor.doc;
      return createScenarioView(input, evaluateScenario(input), categories);
    } catch {
      return null;
    }
  }, [editor.doc]);

  if (!view) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <XCircleIcon />
          <AlertTitle>Szenario kann nicht berechnet werden</AlertTitle>
        </Alert>
      </div>
    );
  }

  // In der Tabelle blendet die Suche nicht passende Zeilen aus.
  const needle = query.trim().toLocaleLowerCase("de");
  const steps = view.input.steps.filter(
    (s) =>
      matchesFilter(
        s,
        s.employeeId ? view.employees.get(s.employeeId)!.label : null,
        filter,
      ) &&
      (!needle ||
        s.id.toLocaleLowerCase("de").includes(needle) ||
        s.description.toLocaleLowerCase("de").includes(needle)),
  );

  return (
    <div className="flex flex-col gap-4 p-4 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold">{props.scenario.name}</h1>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
              Tabelle
            </span>
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
            Variante {props.scenario.variantName} · zuletzt geändert{" "}
            {formatDateTime(editor.updatedAt)}{" "}
            {editor.updatedByLabel && `von ${editor.updatedByLabel}`}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            view={view}
            scenarioName={props.scenario.name}
            stand={`${formatDateTime(editor.updatedAt)}${
              editor.updatedByLabel ? ` von ${editor.updatedByLabel}` : ""
            }`}
          />
          <Link
            href={`/szenario?${props.back}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <BarChart3Icon data-icon="inline-start" />
            Zum Diagramm
          </Link>
        </div>
      </div>

      <KpiBar view={view} />

      <LockNotice lock={lock} onReload={props.reload} />

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

      <FilterBar
        view={view}
        filter={filter}
        onFilter={setFilter}
        search={query}
        onSearch={setQuery}
        matchCount={null}
      />
      <p className="text-xs text-muted-foreground" role="status">
        {steps.length} von {view.input.steps.length} Arbeitsgängen
      </p>

      <StepTable
        view={view}
        steps={steps}
        onApply={editor.apply}
        readOnly={readOnly}
      />
    </div>
  );
}
