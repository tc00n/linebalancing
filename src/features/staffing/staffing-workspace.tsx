"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createStaffingRepository,
  type StoredStaffingPlan,
} from "@/data/staffingRepository";
import type { StoredScenario } from "@/data/scenarioRepository";
import { compareStaffing } from "@/domain/staffing/compare";
import type { StaffingPlan } from "@/domain/staffing/model";
import { useProjectSession } from "@/features/projects/project-session";
import { useScenarioRepository } from "@/features/projects/use-scenario-repository";
import { formatMinutes, formatDateTime } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import { readStaffingWorkbook } from "./workbook";
const number = (value: number | null) =>
  value === null ? "–" : formatMinutes(value);
const delta = (value: number | null) =>
  value === null ? "–" : (value > 1e-9 ? "+" : "") + formatMinutes(value);
const cell = "px-3 py-2 text-right whitespace-nowrap tabular-nums";
const head = "px-3 py-3 text-left font-medium whitespace-nowrap";
const emptyInput = {
  taktMin: 70,
  allowancePct: 0,
  stations: [],
  employees: [],
  steps: [],
};
export function StaffingWorkspace() {
  const project = useProjectSession()!;
  const scenariosRepo = useScenarioRepository();
  const plansRepo = useMemo(
    () => createStaffingRepository(project.id, project.local),
    [project.id, project.local],
  );
  const search = useSearchParams();
  const hydrated = useHydrated();
  const [scenarios, setScenarios] = useState<StoredScenario[]>([]),
    [plans, setPlans] = useState<StoredStaffingPlan[]>([]);
  const [scenarioId, setScenarioId] = useState(search.get("szenario") ?? ""),
    [planId, setPlanId] = useState("");
  const [preview, setPreview] = useState<{
    document: StaffingPlan;
    hash: string;
  } | null>(null);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    Promise.all([scenariosRepo.list(), plansRepo.list()])
      .then(([scenarios, plans]) => {
        if (active) {
          setScenarios(scenarios);
          setPlans(plans);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Daten konnten nicht geladen werden.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [scenariosRepo, plansRepo]);
  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];
  const storedPlan = plans.find((p) => p.id === planId) ?? plans[0];
  const result = useMemo(
    () =>
      storedPlan
        ? compareStaffing(scenario?.input ?? emptyInput, storedPlan.document)
        : null,
    [scenario, storedPlan],
  );
  async function read(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    setPreview(null);
    try {
      const data = await file.arrayBuffer();
      const document = await readStaffingWorkbook(data, file.name);
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      setPreview({ document, hash });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Die Excel-Datei konnte nicht gelesen werden.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!preview) return;
    setBusy(true);
    setMessage("");
    try {
      const id = await plansRepo.import(preview.document, preview.hash);
      setPlans(await plansRepo.list());
      setPlanId(id);
      setPreview(null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Speichern fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }
  const matched = result?.stations.filter((s) => s.plan) ?? [];
  const reference = matched.reduce((n, s) => n + s.plan!.productive, 0);
  const workload = matched.reduce((n, s) => n + s.workloadFte, 0);
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Personalplanung</h1>
          <p className="mt-1 text-muted-foreground">
            Teamsprecher-Planung und Arbeitsinhalt bei 70 Minuten Takt
            abgleichen.
          </p>
        </div>
        <Link
          href={scenario ? "/szenario?ist=" + scenario.id : "/"}
          className={buttonVariants({ variant: "outline" })}
        >
          {scenario ? "Zum Szenario" : "Zu den Szenarien"}
        </Link>
      </div>
      {message && (
        <p
          role="alert"
          className="rounded-lg border border-destructive p-4 text-destructive"
        >
          {message}
        </p>
      )}
      <section
        className="grid gap-4 rounded-xl border bg-white p-5"
        aria-label="Personalplanung importieren"
      >
        <div>
          <h2 className="font-semibold">Referenzplanung</h2>
          <p className="text-sm text-muted-foreground">
            Excel-Datei im Format „Personalplanung 1.1“. Die Planung gilt im
            aktiven Projekt. Ein Import verändert keine Arbeitsgänge oder
            Zuordnungen.
          </p>
        </div>
        <label className="grid max-w-xl gap-2 text-sm">
          Personalplanung (.xlsx)
          <Input
            type="file"
            accept=".xlsx"
            disabled={!hydrated || busy}
            onChange={(e) => read(e.target.files?.[0])}
          />
        </label>
        {busy && <p role="status">Personalplanung wird verarbeitet …</p>}
        {preview && (
          <div className="grid gap-3 rounded-lg bg-secondary p-4">
            <p>
              <strong>{preview.document.filename}</strong>:{" "}
              {preview.document.rows.length} Planpositionen, Referenztakt 70
              Minuten. Produktive Besetzungen werden als Dezimalwerte
              übernommen; Brutto separat.
            </p>
            <PlanWarnings warnings={preview.document.warnings} />
            <Button onClick={save} disabled={busy}>
              Personalplanung im Projekt speichern
            </Button>
          </div>
        )}
        {plans.length > 0 && (
          <label className="grid max-w-xl gap-2 text-sm">
            Gespeicherte Planung
            <select
              className="h-9 rounded-md border bg-white px-2"
              value={storedPlan?.id ?? ""}
              onChange={(e) => setPlanId(e.target.value)}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.document.filename} · {formatDateTime(p.imported_at)}
                </option>
              ))}
            </select>
          </label>
        )}
        {storedPlan && (
          <p className="text-sm text-muted-foreground">
            Importiert am {formatDateTime(storedPlan.imported_at)}.
            Brutto-Personalfaktor laut Datei:{" "}
            {number(storedPlan.document.grossFactor)}. Der Faktor ist eine
            Personalreserve und wird nicht als Zeitzuschlag auf Arbeitsgänge
            angewendet.
          </p>
        )}
      </section>
      {loading ? (
        <p>Lade Personalplanung …</p>
      ) : !storedPlan ? (
        <p>
          Noch keine Personalplanung im Projekt vorhanden. Bitte die Excel-Datei
          importieren.
        </p>
      ) : (
        result && (
          <>
            <section className="grid gap-4 rounded-xl border bg-white p-5">
              <label className="grid max-w-xl gap-2 text-sm">
                Szenario für Personalabgleich
                <select
                  className="h-9 rounded-md border bg-white px-2"
                  value={scenario?.id ?? ""}
                  onChange={(e) => setScenarioId(e.target.value)}
                >
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.variantName} · {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {!scenario ? (
                <p>
                  Für den Tool-Abgleich zuerst ein Szenario importieren. Die
                  Referenz- und Bestandsplanung steht unten bereits zur
                  Verfügung.
                </p>
              ) : (
                <p className="text-sm">
                  Szenariotakt: {number(scenario.input.taktMin)} min ·
                  Referenztakt: 70,00 min · Szenariozuschlag:{" "}
                  {number(scenario.input.allowancePct)} %. Der Szenariotakt
                  bleibt unverändert.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric
                  label="Stationen mit eindeutiger Plan-Zuordnung"
                  value={
                    matched.length +
                    " / " +
                    (scenario?.input.stations.length ?? 0)
                  }
                />
                <Metric
                  label="Produktiver Plan in diesen Stationen"
                  value={number(reference) + " MA"}
                />
                <Metric
                  label="Arbeitsinhalt / 70 in diesen Stationen"
                  value={number(workload) + " MA"}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Arbeitsinhalt mit dem Szenariozuschlag / 70 ist eine
                theoretische Personaluntergrenze. Sie berücksichtigt nur
                zugeordnete Arbeitsgänge und keine Wartezeiten. Sie beweist
                nicht, dass der Ablauf den Takt schafft. Dafür zeigt die
                Stationshöhe die aktuelle Mitarbeiterzuordnung einschließlich
                Wartezeit und Zuschlag.
              </p>
              <p className="text-sm text-muted-foreground">
                Teilbesetzungen wie 0,50 MA sind Kapazitätsanteile. Die Planung
                erzeugt keine Mitarbeiterspuren. Bei importierten Sammelzeiten
                auf nur einem Mitarbeiter beschreibt die Stationshöhe diese
                Sammelzuordnung.
              </p>
              {result.incomplete && (
                <p role="alert" className="rounded-lg bg-warning/15 p-3">
                  Unvollständiger Abgleich: Nicht zugeordnete Arbeitsgänge
                  fehlen im berechneten Arbeitsinhalt.
                </p>
              )}
              <PlanWarnings warnings={storedPlan.document.warnings} />
            </section>
            {scenario && (
              <section className="grid gap-3">
                <h2 className="text-lg font-semibold">
                  Produktiver Abgleich je Station
                </h2>
                <div className="overflow-x-auto rounded-xl border bg-white">
                  <table
                    className="w-full text-sm"
                    aria-label="Produktiver Personalabgleich"
                  >
                    <thead className="bg-secondary">
                      <tr>
                        {[
                          "Station",
                          "Kostenstelle",
                          "Teamsprecher",
                          "Plan produktiv [MA]",
                          "Arbeitsinhalt inkl. Zuschlag [min]",
                          "Arbeitsinhalt / 70 [MA]",
                          "Differenz Tool − Plan [MA]",
                          "MA im Szenario",
                          "Stationshöhe [min]",
                          "Bewertung",
                        ].map((h) => (
                          <th key={h} className={head}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.stations.map((s) => (
                        <tr key={s.stationId} className="border-t">
                          <th className={head}>{s.label}</th>
                          <td className={cell}>{s.plan?.costCenter ?? "–"}</td>
                          <td className={cell}>{s.plan?.teamSpeaker ?? "–"}</td>
                          <td className={cell}>
                            {number(s.plan?.productive ?? null)}
                          </td>
                          <td className={cell}>
                            {number(s.workloadWithAllowance)}
                          </td>
                          <td className={cell}>{number(s.workloadFte)}</td>
                          <td className={cell}>{delta(s.deltaFte)}</td>
                          <td className={cell}>{s.employeeCount}</td>
                          <td
                            className={
                              cell +
                              " " +
                              (s.over70 ? "font-semibold text-destructive" : "")
                            }
                          >
                            {number(s.height)}
                            {s.over70 ? " · über 70" : ""}
                          </td>
                          <td className="min-w-48 px-3 py-2">
                            {s.ambiguous
                              ? "Zuordnung mehrdeutig"
                              : !s.plan
                                ? "Keine Planposition"
                                : s.unassignedCount
                                  ? "Unvollständig"
                                  : s.capacityExceeded
                                    ? "Arbeitsinhalt über Plankapazität"
                                    : "Arbeitsinhalt innerhalb Plankapazität"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            <section className="grid gap-3">
              <h2 className="text-lg font-semibold">
                Produktiver Abgleich je Kostenstelle
              </h2>
              <p className="text-sm text-muted-foreground">
                Tool und Plan werden nur für dieselben abgedeckten Stationen
                verglichen. Nicht enthaltene Stationen werden nicht mit null
                Mitarbeitern angesetzt.
              </p>
              <div className="overflow-x-auto rounded-xl border bg-white">
                <table
                  className="w-full text-sm"
                  aria-label="Produktiver Kostenstellenabgleich"
                >
                  <thead className="bg-secondary">
                    <tr>
                      {[
                        "Kostenstelle",
                        "Gesamter produktiver Plan [MA]",
                        "Abdeckung",
                        "Plan abgedeckt [MA]",
                        "Tool abgedeckt [MA]",
                        "Differenz abgedeckt [MA]",
                      ].map((h) => (
                        <th key={h} className={head}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.costs.map((c) => (
                      <tr key={c.costCenter} className="border-t">
                        <th className={head}>{c.costCenter}</th>
                        <td className={cell}>{number(c.plannedProductive)}</td>
                        <td className="px-3 py-2">
                          {c.matchedStationCount} / {c.plannedStationCount}
                          {c.completeCoverage
                            ? " · vollständig"
                            : " · teilweise / offen"}
                        </td>
                        <td className={cell}>
                          {c.matchedStationCount
                            ? number(c.coveredPlanFte)
                            : "–"}
                        </td>
                        <td className={cell}>
                          {c.matchedStationCount
                            ? number(c.coveredWorkloadFte)
                            : "–"}
                        </td>
                        <td className={cell}>{delta(c.coveredDeltaFte)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="grid gap-3">
              <h2 className="text-lg font-semibold">
                Bruttobedarf und Bestand laut Datei
              </h2>
              <p className="text-sm text-muted-foreground">
                Separater Personalbestandsabgleich. Brutto summiert die
                gespeicherten Einzelpositionen einschließlich dort zugeordneter
                Teamsprecher. Positive Fehlmenge bedeutet: Bruttobedarf liegt
                über dem Bestand laut Datei.
              </p>
              <div className="overflow-x-auto rounded-xl border bg-white">
                <table
                  className="w-full text-sm"
                  aria-label="Bruttopersonal und Bestand"
                >
                  <thead className="bg-secondary">
                    <tr>
                      {[
                        "Kostenstelle",
                        "Brutto aus Einzelpositionen [MA]",
                        "Bestand laut Datei [MA]",
                        "Fehlmenge [MA]",
                        "Excel-Summe [MA]",
                        "Hinweis",
                      ].map((h) => (
                        <th key={h} className={head}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.costs.map((c) => (
                      <tr key={c.costCenter} className="border-t">
                        <th className={head}>{c.costCenter}</th>
                        <td className={cell}>{number(c.plannedGross)}</td>
                        <td className={cell}>{number(c.actual)}</td>
                        <td className={cell}>{delta(c.grossGap)}</td>
                        <td className={cell}>{number(c.sourceGross)}</td>
                        <td className="px-3 py-2">
                          {c.sourceMismatch ? (
                            <span className="text-destructive">
                              Excel-Summe weicht von Einzelpositionen ab
                            </span>
                          ) : c.actual === null ? (
                            "Bestand fehlt"
                          ) : (
                            "–"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <details className="rounded-xl border bg-white p-5">
              <summary className="cursor-pointer font-semibold">
                Nicht im Szenario abgedeckte Planpositionen (
                {result.unmatchedPlan.length})
              </summary>
              <p className="my-3 text-sm">
                Diese Positionen sind nicht automatisch aufgeteilt oder
                zugeordnet. Auch Bereiche ohne einzelne Stationsbezeichnung
                bleiben hier sichtbar.
              </p>
              <ReferenceRows rows={result.unmatchedPlan} />
            </details>
            <details className="rounded-xl border bg-white p-5">
              <summary className="cursor-pointer font-semibold">
                Separat geplante Teamsprecher (
                {number(result.support.reduce((n, r) => n + r.productive, 0))}{" "}
                MA)
              </summary>
              <p className="my-3 text-sm">
                Diese Positionen werden nicht als produktive Stationsbesetzung
                gerechnet. Fehlende Kostenstellen werden nicht ergänzt.
              </p>
              <ReferenceRows rows={result.support} />
            </details>
          </>
        )
      )}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
function PlanWarnings({ warnings }: { warnings: readonly string[] }) {
  return warnings.length ? (
    <details className="text-sm">
      <summary className="cursor-pointer">
        {warnings.length} Hinweise zur Quelldatei
      </summary>
      <ul className="mt-2 list-disc pl-5">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </details>
  ) : null;
}
function ReferenceRows({ rows }: { rows: StaffingPlan["rows"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {[
              "Excel-Zeile",
              "Bereich",
              "Station",
              "Kostenstelle",
              "Teamsprecher",
              "Produktiv [MA]",
              "Brutto [MA]",
            ].map((h) => (
              <th key={h} className={head}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sourceRow} className="border-t">
              <td className={cell}>{r.sourceRow}</td>
              <td className="px-3 py-2">{r.area}</td>
              <td className={cell}>{r.station ?? "–"}</td>
              <td className={cell}>{r.costCenter ?? "–"}</td>
              <td className={cell}>{r.teamSpeaker ?? "–"}</td>
              <td className={cell}>{number(r.productive)}</td>
              <td className={cell}>{number(r.gross)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
