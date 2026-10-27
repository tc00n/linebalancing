"use client";
import { LocalScenarios } from "@/features/projects/local-scenarios";
import { useProjectSession } from "@/features/projects/project-session";
import { useScenarioRepository } from "@/features/projects/use-scenario-repository";

import {
  CopyIcon,
  FileSpreadsheetIcon,
  PencilIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  duplicateScenario,
  uniqueName,
  type StoredScenario,
} from "@/data/scenarioRepository";
import { TemplateDownloadButton } from "@/features/import/template-download-button";
import { withScenarioLock } from "@/features/workspace/use-scenario-lock";
import { formatDateTime } from "@/lib/format";

export function ScenarioList() {
  const repository = useScenarioRepository();
  const project = useProjectSession()!;
  const [loadError, setLoadError] = useState("");
  const [scenarios, setScenarios] = useState<StoredScenario[] | null>(null);
  const reload = () => repository.list().then(setScenarios);

  useEffect(() => {
    repository
      .list()
      .then(setScenarios)
      .catch(() =>
        setLoadError(
          "Szenarien konnten nicht geladen werden. Bitte Projektzugang und Verbindung pr\u00fcfen.",
        ),
      );
  }, [repository]);

  async function remove(scenario: StoredScenario) {
    // E26: Mit dem letzten Szenario entfällt auch die Variante.
    const last = !(scenarios ?? []).some(
      (s) => s.variantId === scenario.variantId && s.id !== scenario.id,
    );
    const confirmed = window.confirm(
      [
        project.local
          ? `Szenario „${scenario.name}“ aus diesem Browser löschen?`
          : `Szenario „${scenario.name}“ für alle im Projekt endgültig löschen?`,
        last
          ? `Es ist das letzte Szenario der Variante „${scenario.variantName}“; die Variante entfällt damit.`
          : "",
        "Das lässt sich nicht rückgängig machen.",
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (!confirmed) return;
    await repository.remove(scenario.id);
    await reload();
  }

  async function duplicate(scenario: StoredScenario) {
    const siblings = (scenarios ?? []).filter(
      (s) => s.variantId === scenario.variantId,
    );
    await repository.save(duplicateScenario(scenario, siblings));
    await reload();
  }

  async function rename(scenario: StoredScenario, name: string) {
    const siblings = (scenarios ?? []).filter(
      (s) => s.variantId === scenario.variantId && s.id !== scenario.id,
    );
    const trimmed = name.trim();
    if (!trimmed || trimmed === scenario.name) return;
    // E27: Umbenennen ist eine Änderung und braucht die Bearbeitungssperre.
    await withScenarioLock(repository.lock, scenario.id, async () => {
      await repository.save({
        ...scenario,
        name: uniqueName(
          trimmed,
          siblings.map((s) => s.name),
        ),
        updatedAt: new Date().toISOString(),
      });
    });
    await reload();
  }

  async function action(work: () => Promise<void>) {
    try {
      await work();
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Aktion fehlgeschlagen.",
      );
    }
  }
  const variants = groupByVariant(scenarios ?? []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Szenarien</h1>
          <p className="text-muted-foreground">
            Je Produktvariante beliebig viele Szenarien.{" "}
            {project.local
              ? "Lokale Entwicklungsablage."
              : "Gespeichert im aktiven Projekt."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/personalplanung"
            className={buttonVariants({ variant: "outline" })}
          >
            Personalplanung
          </Link>
          <TemplateDownloadButton />
          <Link href="/import" className={buttonVariants()}>
            <UploadIcon data-icon="inline-start" />
            Excel importieren
          </Link>
        </div>
      </div>

      {loadError && (
        <p role="alert" className="text-destructive">
          {loadError}
        </p>
      )}
      <LocalScenarios onImported={reload} />
      {scenarios === null ? (
        <p className="text-muted-foreground">Lade …</p>
      ) : scenarios.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <FileSpreadsheetIcon className="size-10 text-nx-steel-dark" />
            <p className="font-medium">Noch kein Szenario vorhanden.</p>
            <p className="max-w-md text-muted-foreground">
              Lade das Importtemplate herunter, fülle es aus und importiere die
              Datei. Eine Datei entspricht einer Produktvariante.
            </p>
          </CardContent>
        </Card>
      ) : (
        variants.map(([variantId, members]) => (
          <section
            key={variantId}
            className="flex flex-col gap-3"
            aria-label={`Variante ${members[0].variantName}`}
          >
            <h2 className="text-lg font-semibold">
              Variante {members[0].variantName}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {members.length}{" "}
                {members.length === 1 ? "Szenario" : "Szenarien"}
              </span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {members.map((scenario) => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  onRemove={() => action(() => remove(scenario))}
                  onDuplicate={() => action(() => duplicate(scenario))}
                  onRename={(name) => action(() => rename(scenario, name))}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function ScenarioCard(props: {
  scenario: StoredScenario;
  onRemove: () => void;
  onDuplicate: () => void;
  onRename: (name: string) => void;
}) {
  const { scenario } = props;
  const [editing, setEditing] = useState(false);
  const unassigned = scenario.input.steps.filter(
    (s) => s.employeeId === null,
  ).length;

  return (
    <Card>
      <CardHeader>
        {editing ? (
          <Input
            autoFocus
            aria-label="Szenarioname"
            defaultValue={scenario.name}
            onBlur={(e) => {
              setEditing(false);
              props.onRename(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <CardTitle className="text-lg">{scenario.name}</CardTitle>
        )}
        <CardDescription>
          {scenario.copiedFrom
            ? `Kopie von ${scenario.copiedFrom}`
            : `aus ${scenario.sourceFilename}`}{" "}
          · zuletzt geändert {formatDateTime(scenario.updatedAt)}{" "}
          {scenario.updatedByLabel && `von ${scenario.updatedByLabel}`}
        </CardDescription>
        <CardAction className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Szenario ${scenario.name} umbenennen`}
            title="Umbenennen"
            onClick={() => setEditing(true)}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Szenario ${scenario.name} duplizieren`}
            title="Duplizieren"
            onClick={props.onDuplicate}
          >
            <CopyIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Szenario ${scenario.name} löschen`}
            title="Löschen"
            onClick={props.onRemove}
          >
            <Trash2Icon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {scenario.input.stations.length} Stationen
        </Badge>
        <Badge variant="secondary">
          {scenario.input.steps.length} Arbeitsgänge
        </Badge>
        {unassigned > 0 && (
          <Badge className="bg-warning text-warning-foreground">
            {unassigned} ohne Mitarbeiter
          </Badge>
        )}
        <Link
          href={`/szenario?ist=${scenario.id}`}
          className={buttonVariants({ className: "ml-auto" })}
        >
          Öffnen
        </Link>
      </CardContent>
    </Card>
  );
}

function groupByVariant(scenarios: readonly StoredScenario[]) {
  const groups = new Map<string, StoredScenario[]>();
  for (const s of scenarios) {
    groups.set(s.variantId, [...(groups.get(s.variantId) ?? []), s]);
  }
  return [...groups.entries()]
    .map(
      ([id, members]) =>
        [
          id,
          members.sort((a, b) => a.importedAt.localeCompare(b.importedAt)),
        ] as const,
    )
    .sort((a, b) =>
      a[1][0].variantName.localeCompare(b[1][0].variantName, "de"),
    );
}
