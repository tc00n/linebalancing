"use client";

import { FileSpreadsheetIcon, Trash2Icon, UploadIcon } from "lucide-react";
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
import {
  scenarioRepository,
  type StoredScenario,
} from "@/data/scenarioRepository";
import { TemplateDownloadButton } from "@/features/import/template-download-button";
import { formatDateTime } from "@/lib/format";

export function ScenarioList() {
  const [scenarios, setScenarios] = useState<StoredScenario[] | null>(null);

  useEffect(() => {
    scenarioRepository().list().then(setScenarios);
  }, []);

  async function remove(scenario: StoredScenario) {
    const confirmed = window.confirm(
      `Szenario „${scenario.name}“ aus diesem Browser löschen? Das lässt sich nicht rückgängig machen.`,
    );
    if (!confirmed) return;
    await scenarioRepository().remove(scenario.id);
    setScenarios(await scenarioRepository().list());
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Szenarien</h1>
          <p className="text-muted-foreground">
            Jeder Excel-Import legt ein neues Szenario an. Gespeichert wird
            vorerst nur in diesem Browser.
          </p>
        </div>
        <div className="flex gap-2">
          <TemplateDownloadButton />
          <Link href="/import" className={buttonVariants()}>
            <UploadIcon data-icon="inline-start" />
            Excel importieren
          </Link>
        </div>
      </div>

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
        <div className="grid gap-4 sm:grid-cols-2">
          {scenarios.map((scenario) => {
            const unassigned = scenario.input.steps.filter(
              (s) => s.employeeId === null,
            ).length;
            return (
              <Card key={scenario.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{scenario.name}</CardTitle>
                  <CardDescription>
                    Variante {scenario.variantName} · importiert{" "}
                    {formatDateTime(scenario.importedAt)}
                  </CardDescription>
                  <CardAction>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Szenario ${scenario.name} löschen`}
                      onClick={() => remove(scenario)}
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
                    href={`/szenario?id=${scenario.id}`}
                    className={buttonVariants({ className: "ml-auto" })}
                  >
                    Öffnen
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
