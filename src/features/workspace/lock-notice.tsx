"use client";
import { InfoIcon, LockIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SaveStatus } from "./use-scenario-editor";
import type { ScenarioLock } from "./use-scenario-lock";

/**
 * Lädt den aktuellen Stand, sobald dieser Tab eine zuvor fremde Sperre erhält (E27), und prüft
 * die Sperre sofort, wenn ein Speichern scheitert (z. B. weil jemand übernommen hat).
 */
export function useLockFollowUp(
  lock: { regained: number; refresh: () => Promise<void> },
  saveStatus: SaveStatus,
  reload: () => void,
) {
  const seen = useRef(lock.regained);
  useEffect(() => {
    if (lock.regained === seen.current) return;
    seen.current = lock.regained;
    reload();
  }, [lock.regained, reload]);
  const { refresh } = lock;
  useEffect(() => {
    if (saveStatus === "failed") void refresh();
  }, [saveStatus, refresh]);
}

/** Hinweis, wenn dieser Tab nicht bearbeiten darf (F51), mit Übernahme nach Rückfrage (E27). */
export function LockNotice(props: {
  lock: ScenarioLock & { takeover: () => Promise<void> };
  onReload: () => void;
}) {
  const { lock } = props;
  if (lock.status === "gone") {
    return (
      <Alert variant="destructive">
        <XCircleIcon />
        <AlertTitle>Szenario gelöscht</AlertTitle>
        <AlertDescription>
          Das Szenario wurde inzwischen gelöscht.{" "}
          <Link href="/">Zur Szenarioliste</Link>
        </AlertDescription>
      </Alert>
    );
  }
  if (lock.status !== "blocked" && lock.status !== "lost") return null;

  const holder = lock.holder ?? "jemand anderes";
  const takeover = () => {
    const confirmed =
      lock.sameUser ||
      window.confirm(
        `Bearbeitung von ${holder} übernehmen? ${holder} kann danach nicht mehr speichern; bereits gespeicherte Änderungen bleiben erhalten.`,
      );
    if (confirmed) void lock.takeover();
  };
  const text = lock.sameUser
    ? {
        title: "In einem anderen Fenster geöffnet",
        body: "Du bearbeitest dieses Szenario bereits in einem anderen Fenster oder Tab. Hier ist es schreibgeschützt.",
        action: "Hier bearbeiten",
      }
    : lock.status === "lost"
      ? {
          title: `${holder} hat die Bearbeitung übernommen`,
          body: "Deine bis dahin gespeicherten Änderungen bleiben erhalten. Hier ist das Szenario jetzt schreibgeschützt.",
          action: "Bearbeitung zurückholen",
        }
      : {
          title: `Wird gerade von ${holder} bearbeitet`,
          body: "Du siehst den Stand vom Öffnen schreibgeschützt. Sobald das Szenario frei ist, kannst du hier weiterarbeiten.",
          action: "Bearbeitung übernehmen",
        };

  return (
    <Alert className="border-nx-blue/30 bg-nx-blue/5">
      {lock.status === "lost" ? <InfoIcon /> : <LockIcon />}
      <AlertTitle>{text.title}</AlertTitle>
      <AlertDescription>
        <p>{text.body}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" onClick={takeover}>
            {text.action}
          </Button>
          <Button size="sm" variant="outline" onClick={props.onReload}>
            Neu laden
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
