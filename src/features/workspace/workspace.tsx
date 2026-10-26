"use client";
import { useScenarioRepository } from "@/features/projects/use-scenario-repository";

import {
  AlertTriangleIcon,
  ExpandIcon,
  FilterIcon,
  InfoIcon,
  Maximize2Icon,
  Minimize2Icon,
  Redo2Icon,
  TableIcon,
  Undo2Icon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type UIEvent,
} from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  duplicateScenario,
  type StoredScenario,
} from "@/data/scenarioRepository";
import { evaluateScenario } from "@/domain/calc/evaluate";
import { alignedStationLabels, movedStepIds } from "@/domain/compare/compare";
import type { EditableScenario } from "@/domain/ops/operations";
import {
  applyFilter,
  axisMaximum,
  buildColumns,
  EMPTY_FILTER,
  isFilterActive,
  matchesFilter,
  type StationColumn,
  type StepFilter,
} from "@/features/yamazumi/layout";
import {
  effectiveLaneWidth,
  stationColumnWidth,
  YamazumiChart,
  type ChartActions,
  type ChartMode,
} from "@/features/yamazumi/yamazumi-chart";
import { formatDateTime, formatMinutes } from "@/lib/format";
import { DetailPanel } from "./detail-panel";
import { IssuesList } from "./issues-list";
import { KpiBar } from "./kpi-bar";
import { FilterBar } from "./filter-bar";
import { KpiComparison } from "./kpi-comparison";
import { useViewSettings } from "./use-view-settings";
import { ScenarioBar, type Side } from "./scenario-bar";
import { createScenarioView, type ScenarioView } from "./scenario-view";
import { useScenarioEditor } from "./use-scenario-editor";
import {
  Legend,
  NumberSetting,
  SaveIndicator,
  ScaleSlider,
} from "./workspace-controls";

interface Params {
  readonly ist: string | null;
  readonly ziel: string | null;
  readonly tab: Side;
  readonly compare: boolean;
}

function readParams(search: URLSearchParams): Params {
  return {
    ist: search.get("ist") ?? search.get("id"),
    ziel: search.get("ziel"),
    tab: search.get("tab") === "ziel" ? "ziel" : "ist",
    compare: search.get("vergleich") === "1",
  };
}

function toQuery(p: Params): string {
  const q = new URLSearchParams();
  if (p.ist) q.set("ist", p.ist);
  if (p.ziel) q.set("ziel", p.ziel);
  if (p.tab === "ziel") q.set("tab", "ziel");
  if (p.compare) q.set("vergleich", "1");
  return q.toString();
}

/**
 * Lädt die Szenarien einer Variante und löst Ist/Ziel aus der URL auf.
 * Während eines Wechsels bleibt der bisherige Stand sichtbar, damit der
 * Bearbeitungszustand des gleichen Szenarios erhalten bleibt.
 */
export function Workspace() {
  const repository = useScenarioRepository();
  const [loadError, setLoadError] = useState("");
  const search = useSearchParams();
  const router = useRouter();
  const query = search.toString();
  const params = readParams(search);
  const [loaded, setLoaded] = useState<{
    query: string;
    scenarios: StoredScenario[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    repository
      .list()
      .then((scenarios) => {
        if (active) setLoaded({ query, scenarios });
      })
      .catch(() =>
        setLoadError(
          "Szenario konnte nicht geladen werden. Bitte Projektzugang und Verbindung pr\u00fcfen.",
        ),
      );
    return () => {
      active = false;
    };
  }, [query, repository]);

  if (loadError)
    return (
      <p role="alert" className="p-8 text-destructive">
        {loadError}
      </p>
    );
  if (!loaded)
    return <p className="p-8 text-muted-foreground">Lade Szenario …</p>;

  const byId = (id: string | null) => loaded.scenarios.find((s) => s.id === id);
  const ist = byId(params.ist);
  const requestedZiel = byId(params.ziel);
  if (!ist || (params.ziel && !requestedZiel)) {
    if (loaded.query !== query) {
      return <p className="p-8 text-muted-foreground">Lade Szenario …</p>;
    }
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

  // E15: nur Szenarien derselben Variante; Ziel standardmäßig das nächste andere Szenario.
  const siblings = loaded.scenarios
    .filter((s) => s.variantId === ist.variantId)
    .sort((a, b) => a.importedAt.localeCompare(b.importedAt));
  const ziel =
    requestedZiel?.variantId === ist.variantId
      ? requestedZiel
      : (siblings.find((s) => s.id !== ist.id) ?? ist);
  const current: Params = { ...params, ist: ist.id, ziel: ziel.id };
  const navigate = (next: Partial<Params>) =>
    router.replace(`/szenario?${toQuery({ ...current, ...next })}`, {
      scroll: false,
    });

  // F48: genau ein Szenario wird bearbeitet; im Vergleich ist das das Ziel (F118).
  const editable = current.compare || current.tab === "ziel" ? ziel : ist;

  return (
    <ScenarioWorkspace
      // Next.js hält verlassene Seiten versteckt im Speicher. Ist der gespeicherte Stand neuer
      // (z. B. nach Änderungen in der Tabelle), wird der Bearbeitungszustand neu aufgebaut,
      // damit kein veralteter Stand angezeigt oder gespeichert wird.
      key={`${editable.id}:${editable.updatedAt}`}
      editable={editable}
      ist={ist}
      ziel={ziel}
      siblings={siblings}
      params={current}
      navigate={navigate}
    />
  );
}

const LABEL_KEYS = ["id", "description", "duration"] as const;

// Reglergrenzen (F98): Breite reicht für wenige Stationen auf großen Bildschirmen,
// Zeitskala auch für Stationen mit mehreren hundert Minuten.
const MIN_LANE_WIDTH = 14;
const MAX_LANE_WIDTH = 1200;
const MIN_SCALE = 0.5;
const MAX_SCALE = 300;

type Evaluation =
  | { ok: true; view: ScenarioView; columns: StationColumn[] }
  | { ok: false; message: string };

function evaluate(doc: EditableScenario): Evaluation {
  try {
    const result = evaluateScenario(doc.input);
    return {
      ok: true,
      view: createScenarioView(doc.input, result, doc.categories),
      columns: buildColumns(doc.input, result),
    };
  } catch (error) {
    return { ok: false, message: String(error) };
  }
}

function ScenarioWorkspace(props: {
  editable: StoredScenario;
  ist: StoredScenario;
  ziel: StoredScenario;
  siblings: readonly StoredScenario[];
  params: Params;
  navigate: (next: Partial<Params>) => void;
}) {
  const { editable, params } = props;
  const editor = useScenarioEditor(editable);
  const repository = useScenarioRepository();
  const compare = params.compare;
  const sameScenario = props.ist.id === props.ziel.id;

  const main = useMemo(() => evaluate(editor.doc), [editor.doc]);
  // Ist im Vergleich: eigenes, schreibgeschütztes Szenario oder derselbe Datensatz wie das Ziel (F115).
  const istDoc = useMemo<EditableScenario | null>(
    () =>
      compare && !sameScenario
        ? { input: props.ist.input, categories: props.ist.categories }
        : null,
    [compare, sameScenario, props.ist],
  );
  const istEvaluation = useMemo(
    () => (istDoc ? evaluate(istDoc) : compare ? main : null),
    [istDoc, compare, main],
  );

  const {
    mode,
    setMode,
    labels,
    setLabels,
    laneWidth,
    setLaneWidth,
    pxPerMinute,
    setPxPerMinute,
  } = useViewSettings(editable.id, () =>
    main.ok
      ? clamp(
          Math.round(
            (440 / axisMaximum(main.columns, editor.doc.input.taktMin)) * 100,
          ) / 100,
          MIN_SCALE,
          MAX_SCALE,
        )
      : 40,
  );
  // F96/F128, E8, E37: Filter und Suche sind Sitzungszustand und starten leer.
  const [filter, setFilter] = useState<StepFilter>(EMPTY_FILTER);
  const [search, setSearch] = useState("");
  // F34: Vollbild mit ausblendbaren Bedienelementen und Kennzahlen.
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [hideControls, setHideControls] = useState(false);
  const [hideKpis, setHideKpis] = useState(false);
  const [selected, setSelected] = useState<{
    side: Side;
    stepId: string;
  } | null>(null);
  const [showIssues, setShowIssues] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [repository]);

  useEffect(() => {
    const onChange = () => {
      const active = document.fullscreenElement === fullscreenRef.current;
      setFullscreen(active);
      if (!active) {
        setHideControls(false);
        setHideKpis(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void fullscreenRef.current?.requestFullscreen();
  }

  // F104: horizontales Scrollen beider Diagramme koppeln.
  const istScroll = useRef<HTMLDivElement>(null);
  const zielScroll = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  function syncScroll(
    target: RefObject<HTMLDivElement | null>,
    e: UIEvent<HTMLDivElement>,
  ) {
    if (syncing.current) {
      syncing.current = false;
      return;
    }
    const other = target.current;
    if (other && other.scrollLeft !== e.currentTarget.scrollLeft) {
      syncing.current = true;
      other.scrollLeft = e.currentTarget.scrollLeft;
    }
  }

  const apply = editor.apply;
  const editSide: Side = compare || params.tab === "ziel" ? "ziel" : "ist";
  const actions: ChartActions = {
    onMoveStep: (stepId, stationId) => {
      // F61/F95: nach dem Ablegen ohne Mitarbeiter; Panel öffnen, damit direkt zugewiesen werden kann (F100).
      if (!apply({ type: "moveStep", stepId, stationId }))
        setSelected({ side: editSide, stepId });
    },
    onAssignEmployee: (stepId, employeeId) =>
      apply({ type: "assignEmployee", stepId, employeeId }),
    onAddEmployee: (stationId) => apply({ type: "addEmployee", stationId }),
    onRemoveEmployee: (employeeId) =>
      apply({ type: "removeEmployee", employeeId }),
  };

  async function duplicate() {
    const copy = duplicateScenario(
      {
        ...editable,
        input: editor.doc.input,
        categories: editor.doc.categories,
      },
      props.siblings,
    );
    try {
      await repository.save(copy);
      props.navigate({ ziel: copy.id, tab: "ziel" });
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Duplizieren fehlgeschlagen.",
      );
    }
  }

  if (!main.ok || (istEvaluation && !istEvaluation.ok)) {
    const message = !main.ok
      ? main.message
      : istEvaluation && !istEvaluation.ok
        ? istEvaluation.message
        : "";
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <XCircleIcon />
          <AlertTitle>Szenario kann nicht berechnet werden</AlertTitle>
          <AlertDescription className="whitespace-pre-line">
            {message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const view = main.view;
  const kpis = view.result.kpis;
  const violations = view.result.issues.filter(
    (i) => i.severity === "violation",
  );
  const effectiveLane = effectiveLaneWidth(laneWidth, mode);
  const filtering = isFilterActive(filter);
  const mainColumns = applyFilter(main.columns, view.input, filter);
  const istColumns = istEvaluation?.ok
    ? applyFilter(istEvaluation.columns, istEvaluation.view.input, filter)
    : [];

  // E37: Suche hebt Treffer hervor, ändert aber keine Balken.
  const query = search.trim().toLocaleLowerCase("de");
  const matches = query
    ? new Set(
        view.input.steps
          .filter(
            (s) =>
              s.id.toLocaleLowerCase("de").includes(query) ||
              s.description.toLocaleLowerCase("de").includes(query),
          )
          .map((s) => s.id),
      )
    : null;

  // F128: gefilterte Ansicht deutlich kennzeichnen und sichtbare Summe ausweisen.
  const visibleSteps = filtering
    ? view.input.steps.filter((s) =>
        matchesFilter(
          s,
          s.employeeId ? view.employees.get(s.employeeId)!.label : null,
          filter,
        ),
      )
    : view.input.steps;
  const visibleMinutes = visibleSteps.reduce((t, s) => t + s.timeMin, 0);

  /** Backlog/F98/F125: Spurbreite und Zeitskala so wählen, dass das Diagramm das Fenster füllt. */
  function fitToWindow() {
    const area = chartAreaRef.current;
    if (!area) return;
    const charts = compare ? 2 : 1;
    const gap = compare && area.clientWidth >= 1280 ? 16 : 0;
    const perChart =
      compare && area.clientWidth >= 1280
        ? (area.clientWidth - gap) / charts
        : area.clientWidth;
    // Achse 64 px, Innenabstand 32 px, Rahmen 2 px.
    const available = perChart - 64 - 32 - 2;
    const columnsForWidth = compare
      ? [...istColumns, ...mainColumns]
      : mainColumns;
    const slotCount = comparison
      ? comparison.labels.length
      : mainColumns.length;
    const needed = (w: number) => {
      const lane = effectiveLaneWidth(w, mode);
      const widths = new Map<string, number>();
      for (const c of columnsForWidth) {
        const key = c.station.label.toLocaleLowerCase("de");
        widths.set(
          key,
          Math.max(widths.get(key) ?? 0, stationColumnWidth(c, lane)),
        );
      }
      const total = [...widths.values()].reduce((t, v) => t + v, 0);
      const missing = Math.max(0, slotCount - widths.size) * 64;
      return total + missing + 24 * Math.max(0, slotCount - 1);
    };
    let low = 14;
    let high = MAX_LANE_WIDTH;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (needed(mid) <= available) low = mid;
      else high = mid - 1;
    }
    setLaneWidth(low);

    const maximum = comparison
      ? comparison.axis
      : axisMaximum(mainColumns, view.input.taktMin);
    const top = area.getBoundingClientRect().top;
    // Platz für Fußzeile, Legende und Abstand unterhalb des Diagramms.
    const availableHeight =
      window.innerHeight - top - (mode === "employee" ? 140 : 120);
    setPxPerMinute(
      clamp(
        Math.floor(((availableHeight - 28) / (maximum * 1.04)) * 100) / 100,
        MIN_SCALE,
        MAX_SCALE,
      ),
    );
  }

  // Vergleich: gemeinsame Stationsfolge, Spaltenbreiten und Skala (F111, F112).
  const comparison =
    compare && istEvaluation?.ok
      ? (() => {
          const istInput = istEvaluation.view.input;
          const zielInput = view.input;
          const widths = new Map<string, number>();
          for (const column of [...istColumns, ...mainColumns]) {
            const key = column.station.label.toLocaleLowerCase("de");
            widths.set(
              key,
              Math.max(
                widths.get(key) ?? 0,
                stationColumnWidth(column, effectiveLane),
              ),
            );
          }
          return {
            ist: istEvaluation,
            // Stationsfilter gilt auch für die gemeinsame Stationsfolge.
            labels: alignedStationLabels(istInput, zielInput).filter(
              (label) =>
                filter.stationIds.size === 0 ||
                [...filter.stationIds].some(
                  (id) =>
                    view.stations.get(id)?.label.toLocaleLowerCase("de") ===
                    label.toLocaleLowerCase("de"),
                ),
            ),
            widths,
            axis: Math.max(
              axisMaximum(istColumns, istInput.taktMin),
              axisMaximum(mainColumns, zielInput.taktMin),
            ),
            moved: sameScenario
              ? new Set<string>()
              : movedStepIds(istInput, zielInput),
          };
        })()
      : null;

  const chartProps = {
    mode,
    laneWidth,
    pxPerMinute,
    labels,
    highlightStepIds: matches,
  };
  const panelView =
    selected?.side === "ist" && comparison && !sameScenario
      ? comparison.ist.view
      : view;
  const panelReadOnly = selected?.side === "ist" && compare && !sameScenario;

  return (
    <div
      ref={fullscreenRef}
      className={`flex flex-col gap-4 p-4 sm:px-6 ${
        fullscreen ? "h-screen overflow-auto bg-background" : ""
      }`}
    >
      {fullscreen && (
        <div className="fixed top-3 right-3 z-50 flex gap-1 rounded-lg border bg-white p-1 shadow-nx">
          <Button
            variant={hideKpis ? "outline" : "secondary"}
            size="sm"
            onClick={() => setHideKpis((v) => !v)}
            aria-pressed={!hideKpis}
          >
            Kennzahlen
          </Button>
          <Button
            variant={hideControls ? "outline" : "secondary"}
            size="sm"
            onClick={() => setHideControls((v) => !v)}
            aria-pressed={!hideControls}
          >
            Bedienelemente
          </Button>
          <Button variant="outline" size="sm" onClick={fitToWindow}>
            <Maximize2Icon data-icon="inline-start" />
            Anpassen
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            <Minimize2Icon data-icon="inline-start" />
            Vollbild beenden
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          {/* Links, damit das Detailpanel rechts Rückgängig/Wiederholen nicht verdeckt. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold">{editable.name}</h1>
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
            Variante {editable.variantName} ·{" "}
            {editable.copiedFrom
              ? `Kopie von ${editable.copiedFrom}`
              : editable.sourceFilename}{" "}
            · zuletzt geändert {formatDateTime(editor.updatedAt)}{" "}
            {editor.updatedByLabel && `von ${editor.updatedByLabel}`}
          </p>
        </div>
        {!fullscreen && (
          <div className="flex gap-2">
            {/* F132: Tabellenansicht des bearbeiteten Szenarios; Rückweg zur aktuellen Ansicht. */}
            <Link
              href={`/szenario/tabelle?id=${editable.id}&von=${encodeURIComponent(toQuery(params))}`}
              className={buttonVariants({ variant: "outline" })}
            >
              <TableIcon data-icon="inline-start" />
              Tabelle
            </Link>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Szenarien
            </Link>
          </div>
        )}
      </div>

      {!hideControls && (
        <ScenarioBar
          siblings={props.siblings}
          istId={props.ist.id}
          zielId={props.ziel.id}
          tab={params.tab}
          compare={compare}
          onTab={(tab) => props.navigate({ tab })}
          onSelect={(side, id) =>
            props.navigate(side === "ist" ? { ist: id } : { ziel: id })
          }
          onToggleCompare={() => props.navigate({ compare: !compare })}
          onDuplicate={duplicate}
        />
      )}

      {!hideKpis &&
        (comparison ? (
          <KpiComparison
            ist={comparison.ist.view}
            ziel={view}
            movedCount={comparison.moved.size}
          />
        ) : (
          <KpiBar view={view} />
        ))}

      {compare && sameScenario && (
        <Alert>
          <InfoIcon />
          <AlertTitle>Ist und Ziel sind dasselbe Szenario</AlertTitle>
          <AlertDescription>
            Änderungen am Ziel wirken auf denselben Datensatz und erscheinen
            deshalb auch im Ist. Für einen echten Vorher-Nachher-Vergleich
            zuerst „Duplizieren“.
          </AlertDescription>
        </Alert>
      )}
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
      {!compare && kpis.incomplete && (
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
          <AlertTitle>
            {compare
              ? "Ziel-Szenario ist konfliktbehaftet"
              : "Szenario ist konfliktbehaftet"}
          </AlertTitle>
          <AlertDescription>
            {violations.length} Vorgängerbeziehungen sind verletzt. Details
            unter „Hinweise“.
          </AlertDescription>
        </Alert>
      )}

      {!hideControls && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-white px-3 py-2">
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[mode]}
            onValueChange={(value) =>
              value[0] && setMode(value[0] as ChartMode)
            }
            aria-label="Ansicht"
          >
            <ToggleGroupItem value="station">Stationen</ToggleGroupItem>
            <ToggleGroupItem value="employee">Mitarbeiter</ToggleGroupItem>
          </ToggleGroup>

          <NumberSetting
            label={compare ? "Takt Ziel [min]" : "Takt [min]"}
            value={editor.doc.input.taktMin}
            onCommit={(taktMin) => apply({ type: "setTakt", taktMin })}
          />
          <NumberSetting
            label={compare ? "Zuschlag Ziel [%]" : "Zuschlag [%]"}
            value={editor.doc.input.allowancePct}
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
            min={MIN_LANE_WIDTH}
            max={MAX_LANE_WIDTH}
            unit="px"
            onChange={setLaneWidth}
          />
          <ScaleSlider
            label="Zeitskala"
            value={pxPerMinute}
            min={MIN_SCALE}
            max={MAX_SCALE}
            decimals={2}
            unit="px/min"
            onChange={setPxPerMinute}
          />

          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={fitToWindow}
              title="Spurbreite und Zeitskala so wählen, dass das Diagramm das Fenster füllt"
            >
              <Maximize2Icon data-icon="inline-start" />
              An Fenster anpassen
            </Button>
            {!fullscreen && (
              <Button variant="outline" onClick={toggleFullscreen}>
                <ExpandIcon data-icon="inline-start" />
                Vollbild
              </Button>
            )}
            <Button
              variant={showIssues ? "secondary" : "outline"}
              onClick={() => setShowIssues((v) => !v)}
              aria-expanded={showIssues}
            >
              Hinweise ({view.result.issues.length})
            </Button>
          </div>
        </div>
      )}

      {showIssues && !hideControls && (
        <div className="rounded-lg border bg-white p-2">
          <IssuesList
            view={view}
            onSelectStep={(stepId) => setSelected({ side: editSide, stepId })}
          />
        </div>
      )}

      {!hideControls && (
        <FilterBar
          view={view}
          filter={filter}
          onFilter={setFilter}
          search={search}
          onSearch={setSearch}
          matchCount={matches ? matches.size : null}
        />
      )}
      {filtering && (
        <Alert className="border-nx-blue/30 bg-nx-blue/5">
          <FilterIcon />
          <AlertTitle>
            Gefilterte Ansicht: {visibleSteps.length} von{" "}
            {view.input.steps.length} Arbeitsgängen (
            {formatMinutes(visibleMinutes)} min)
          </AlertTitle>
          <AlertDescription>
            Balken zeigen nur die gefilterten Arbeitsgänge, lückenlos gestapelt
            und ohne Wartezeiten. Alle Kennzahlen beziehen sich weiterhin auf
            das gesamte Szenario.
          </AlertDescription>
        </Alert>
      )}

      <div ref={chartAreaRef} className="flex flex-col gap-4">
        {comparison ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <section aria-label="Ist" className="flex min-w-0 flex-col gap-1.5">
              <h2 className="text-sm font-semibold">
                Ist: {props.ist.name}
                <span className="ml-2 font-normal text-muted-foreground">
                  schreibgeschützt
                </span>
              </h2>
              <YamazumiChart
                {...chartProps}
                view={comparison.ist.view}
                columns={istColumns}
                stationLabels={comparison.labels}
                slotWidths={comparison.widths}
                axisMaximum={comparison.axis}
                scrollRef={istScroll}
                onScroll={(e) => syncScroll(zielScroll, e)}
                selectedStepId={selected?.stepId ?? null}
                onSelectStep={(stepId) => setSelected({ side: "ist", stepId })}
              />
            </section>
            <section
              aria-label="Ziel"
              className="flex min-w-0 flex-col gap-1.5"
            >
              <h2 className="text-sm font-semibold">Ziel: {props.ziel.name}</h2>
              <YamazumiChart
                {...chartProps}
                view={view}
                columns={mainColumns}
                stationLabels={comparison.labels}
                slotWidths={comparison.widths}
                axisMaximum={comparison.axis}
                scrollRef={zielScroll}
                onScroll={(e) => syncScroll(istScroll, e)}
                movedStepIds={comparison.moved}
                selectedStepId={selected?.stepId ?? null}
                onSelectStep={(stepId) => setSelected({ side: "ziel", stepId })}
                actions={actions}
              />
            </section>
          </div>
        ) : (
          <YamazumiChart
            {...chartProps}
            view={view}
            columns={mainColumns}
            selectedStepId={selected?.stepId ?? null}
            onSelectStep={(stepId) => setSelected({ side: editSide, stepId })}
            actions={actions}
          />
        )}
      </div>

      <Legend
        categories={editor.doc.categories}
        onApply={apply}
        showMoved={!!comparison}
      />

      {selected && panelView.steps.has(selected.stepId) && (
        <DetailPanel
          key={`${selected.side}:${selected.stepId}`}
          view={panelView}
          stepId={selected.stepId}
          context={
            compare ? (selected.side === "ist" ? "Ist" : "Ziel") : undefined
          }
          onClose={() => setSelected(null)}
          onSelectStep={(stepId) =>
            setSelected({ side: selected.side, stepId })
          }
          onApply={panelReadOnly ? undefined : apply}
        />
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
