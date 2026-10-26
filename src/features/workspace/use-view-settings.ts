"use client";

import { useEffect, useState } from "react";
import type {
  ChartMode,
  LabelFields,
} from "@/features/yamazumi/yamazumi-chart";

// E16: Anzeigeeinstellungen je Gerät, nicht Teil des Szenarios und nicht in Rückgängig/Wiederholen.
const VIEW_KEY = "neonex-lb:view";
const scaleKey = (scenarioId: string) => `neonex-lb:scale:${scenarioId}`;

interface StoredView {
  mode: ChartMode;
  labels: LabelFields;
  laneWidth: number;
}

const DEFAULT_VIEW: StoredView = {
  mode: "station",
  labels: { id: true, description: false, duration: true },
  laneWidth: 36,
};

/** Speicher kann gesperrt oder voll sein; dann gelten einfach die Standardwerte. */
function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ohne Speicher keine Merkfunktion, die Ansicht funktioniert trotzdem
  }
}

/** Ansicht, Beschriftung, Spurbreite je Gerät; Zeitskala je Gerät und Szenario. */
export function useViewSettings(
  scenarioId: string,
  defaultPxPerMinute: () => number,
) {
  const [view, setView] = useState<StoredView>(() => ({
    ...DEFAULT_VIEW,
    ...read<Partial<StoredView>>(VIEW_KEY),
  }));
  const [pxPerMinute, setPxPerMinute] = useState<number>(
    () => read<number>(scaleKey(scenarioId)) ?? defaultPxPerMinute(),
  );

  useEffect(() => write(VIEW_KEY, view), [view]);
  useEffect(
    () => write(scaleKey(scenarioId), pxPerMinute),
    [scenarioId, pxPerMinute],
  );

  return {
    mode: view.mode,
    setMode: (mode: ChartMode) => setView((v) => ({ ...v, mode })),
    labels: view.labels,
    setLabels: (labels: LabelFields) => setView((v) => ({ ...v, labels })),
    laneWidth: view.laneWidth,
    setLaneWidth: (laneWidth: number) => setView((v) => ({ ...v, laneWidth })),
    pxPerMinute,
    setPxPerMinute,
  };
}
