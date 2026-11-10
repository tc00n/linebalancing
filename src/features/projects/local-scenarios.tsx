"use client";
import { useEffect, useState } from "react";
import {
  createBrowserRepository,
  type StoredScenario,
} from "@/data/scenarioRepository";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useScenarioRepository } from "./use-scenario-repository";
import { useProjectSession } from "./project-session";
export function LocalScenarios({
  onImported,
}: {
  onImported: () => Promise<unknown>;
}) {
  const project = useProjectSession()!;
  const repository = useScenarioRepository();
  const [local, setLocal] = useState<StoredScenario[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const confirm = useConfirm();
  useEffect(() => {
    if (!project.local)
      createBrowserRepository()
        .list()
        .then(setLocal)
        .catch(() =>
          setMessage("Lokale Szenarien konnten nicht gelesen werden."),
        );
  }, [project.local]);
  async function transfer() {
    if (
      !(await confirm({
        title: `Lokale Szenarien in das Projekt \u201e${project.name}\u201c kopieren?`,
        description: "Die Daten in diesem Browser bleiben erhalten.",
        confirmLabel: "Kopieren",
      }))
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const mapKey = "neonex-transfer:" + project.id;
      const mapping: Record<string, string> = JSON.parse(
        localStorage.getItem(mapKey) ?? "{}",
      );
      const existing = await repository.list();
      for (const stored of local) {
        if (!mapping["variant:" + stored.variantId])
          mapping["variant:" + stored.variantId] = crypto.randomUUID();
        if (!mapping["scenario:" + stored.id])
          mapping["scenario:" + stored.id] = crypto.randomUUID();
        localStorage.setItem(mapKey, JSON.stringify(mapping));
        const id = mapping["scenario:" + stored.id];
        if (existing.some((s) => s.id === id)) continue;
        await repository.save({
          ...stored,
          id,
          variantId: mapping["variant:" + stored.variantId],
          version: undefined,
          updatedBy: undefined,
        });
      }
      setMessage(
        "Lokale Szenarien wurden in das Projekt kopiert. Die Browserdaten bleiben erhalten.",
      );
      await onImported();
    } catch {
      setMessage(
        "Übernahme nicht vollständig abgeschlossen. Bitte Verbindung prüfen und erneut versuchen; bereits übernommene Szenarien werden übersprungen.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (project.local || (!local.length && !message)) return null;
  return (
    <section className="grid gap-2 rounded-xl border p-4">
      <p>
        {local.length} Szenarien aus der bisherigen Browserablage sind auf
        diesem Gerät vorhanden.
      </p>
      <Button
        variant="outline"
        disabled={busy || !local.length}
        onClick={transfer}
      >
        {busy
          ? "Übernahme läuft …"
          : "Browserdaten in dieses Projekt übernehmen"}
      </Button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
