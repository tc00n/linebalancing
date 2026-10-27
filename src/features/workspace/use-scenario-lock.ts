"use client";
import { useCallback, useEffect, useState } from "react";
import type { ScenarioLockApi } from "@/data/scenarioRepository";
import { useScenarioRepository } from "@/features/projects/use-scenario-repository";

/**
 * Zustand der Bearbeitungssperre (E27):
 * - pending: erster Sperrversuch läuft
 * - held: dieser Tab bearbeitet
 * - blocked: jemand anderes (oder ein anderer eigener Tab) bearbeitet
 * - lost: dieser Tab hat bearbeitet, jemand hat übernommen
 * - gone: Szenario wurde gelöscht
 */
export type LockStatus = "pending" | "held" | "blocked" | "lost" | "gone";

export interface ScenarioLock {
  readonly status: LockStatus;
  readonly holder?: string;
  readonly sameUser?: boolean;
  /** Zählt jeden Wechsel zu „held“ nach einer Phase ohne Sperre; dann neu laden. */
  readonly regained: number;
}

const HEARTBEAT_MS = 30_000;
// Kurz warten, damit ein Wechsel zwischen Diagramm und Tabelle die Sperre nicht freigibt.
const RELEASE_DELAY_MS = 300;

interface Entry {
  api: ScenarioLockApi;
  state: ScenarioLock;
  users: number;
  listeners: Set<(state: ScenarioLock) => void>;
  heartbeat: ReturnType<typeof setInterval>;
  releaseTimer?: ReturnType<typeof setTimeout>;
}

/** Eine Sperre je Szenario und Tab, gemeinsam für alle Komponenten, die es anzeigen. */
const entries = new Map<string, Entry>();

function update(id: string, next: Partial<ScenarioLock>) {
  const entry = entries.get(id);
  if (!entry) return;
  entry.state = { ...entry.state, ...next };
  entry.listeners.forEach((listener) => listener(entry.state));
}

async function tick(id: string, takeover = false) {
  const entry = entries.get(id);
  if (!entry) return;
  try {
    const result = await entry.api.acquire(id, takeover);
    const before = entry.state.status;
    if (result.held) {
      update(id, {
        status: "held",
        holder: undefined,
        sameUser: undefined,
        regained:
          before === "blocked" || before === "lost"
            ? entry.state.regained + 1
            : entry.state.regained,
      });
    } else {
      update(id, {
        status: before === "held" || before === "lost" ? "lost" : "blocked",
        holder: result.holder,
        sameUser: result.sameUser,
      });
    }
  } catch (error) {
    // Netzfehler: Zustand behalten; die Sperre läuft serverseitig erst nach 2 Minuten ab.
    if (error instanceof Error && /gelöscht/.test(error.message))
      update(id, { status: "gone" });
  }
}

let exitListener = false;
function listenForExit() {
  if (exitListener) return;
  exitListener = true;
  // F64: beim Schließen oder Neuladen freigeben; aus dem Zurück-Cache wieder erwerben.
  window.addEventListener("pagehide", () => {
    entries.forEach((entry, id) => {
      if (entry.state.status === "held") entry.api.releaseOnExit(id);
    });
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) entries.forEach((_, id) => void tick(id));
  });
}

/** Exportiert für Tests; Komponenten nutzen useScenarioLock. */
export function subscribeScenarioLock(
  api: ScenarioLockApi,
  id: string,
  listener: (state: ScenarioLock) => void,
) {
  let entry = entries.get(id);
  if (!entry) {
    listenForExit();
    entry = {
      api,
      state: { status: "pending", regained: 0 },
      users: 0,
      listeners: new Set(),
      heartbeat: setInterval(() => void tick(id), HEARTBEAT_MS),
    };
    entries.set(id, entry);
    void tick(id);
  }
  clearTimeout(entry.releaseTimer);
  entry.users++;
  entry.listeners.add(listener);
  listener(entry.state);
  return () => {
    const current = entries.get(id)!;
    current.users--;
    current.listeners.delete(listener);
    if (current.users > 0) return;
    current.releaseTimer = setTimeout(() => {
      clearInterval(current.heartbeat);
      entries.delete(id);
      if (current.state.status === "held") void current.api.release(id);
    }, RELEASE_DELAY_MS);
  };
}

export const takeoverScenarioLock = (id: string) => tick(id, true);

const ALWAYS_HELD: ScenarioLock = { status: "held", regained: 0 };

/**
 * Sperrt das Szenario beim Öffnen und erneuert die Sperre alle 30 s (F58, F64).
 * Ohne Cloud (Browserablage) gilt das Szenario immer als gesperrt für diesen Tab.
 */
export function useScenarioLock(scenarioId: string) {
  const api = useScenarioRepository().lock;
  const [state, setState] = useState<ScenarioLock>(
    api
      ? (entries.get(scenarioId)?.state ?? { status: "pending", regained: 0 })
      : ALWAYS_HELD,
  );
  useEffect(() => {
    if (!api) return;
    return subscribeScenarioLock(api, scenarioId, setState);
  }, [api, scenarioId]);
  // Stabil, damit Effekte, die davon abhängen, nicht bei jedem Rendern erneut laufen.
  const takeover = useCallback(
    () => takeoverScenarioLock(scenarioId),
    [scenarioId],
  );
  const refresh = useCallback(() => tick(scenarioId), [scenarioId]);
  return {
    ...(api ? state : ALWAYS_HELD),
    /** F51/E27: fremde Sperre nach Rückfrage übernehmen. */
    takeover,
    /** Sofort neu prüfen, z. B. nachdem ein Speichern abgelehnt wurde. */
    refresh,
  };
}

/**
 * Kurze Änderung außerhalb des Arbeitsbereichs (z. B. Umbenennen in der Liste) unter der Sperre
 * dieses Tabs. Bearbeitet jemand anderes das Szenario, wird die Änderung abgelehnt (F51).
 */
export async function withScenarioLock(
  api: ScenarioLockApi | undefined,
  scenarioId: string,
  work: () => Promise<void>,
) {
  if (!api || entries.get(scenarioId)?.state.status === "held") return work();
  const result = await api.acquire(scenarioId);
  if (!result.held)
    throw Error(
      `Das Szenario wird gerade von ${result.sameUser ? "dir in einem anderen Fenster" : (result.holder ?? "jemand anderem")} bearbeitet.`,
    );
  try {
    await work();
  } finally {
    await api.release(scenarioId);
  }
}
