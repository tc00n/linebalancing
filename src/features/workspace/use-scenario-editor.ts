"use client";

import { useEffect, useRef, useState } from "react";
import {
  scenarioRepository,
  type StoredScenario,
} from "@/data/scenarioRepository";
import {
  applyOperation,
  type EditableScenario,
  type Operation,
} from "@/domain/ops/operations";

export type SaveStatus = "saved" | "saving" | "failed";

const HISTORY_LIMIT = 100;

interface History {
  readonly doc: EditableScenario;
  readonly past: readonly EditableScenario[];
  readonly future: readonly EditableScenario[];
}

/**
 * Bearbeitungszustand eines Szenarios: jede Änderung wird sofort gespeichert
 * (F25) und ist innerhalb der Sitzung rückgängig zu machen (F26, F65; E17 offen).
 * Erfolgreich gespeichert gilt erst nach Bestätigung des Speichers (F37).
 */
export function useScenarioEditor(initial: StoredScenario) {
  const [history, setHistory] = useState<History>({
    doc: { input: initial.input, categories: initial.categories },
    past: [],
    future: [],
  });
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt);
  const [saving, setSaving] = useState({ pending: 0, failed: false });
  const [error, setError] = useState<string | null>(null);

  function persist(doc: EditableScenario) {
    const now = new Date().toISOString();
    setSaving((s) => ({ ...s, pending: s.pending + 1 }));
    scenarioRepository()
      .save({
        ...initial,
        input: doc.input,
        categories: doc.categories,
        updatedAt: now,
      })
      .then(
        () => {
          setUpdatedAt(now);
          setSaving((s) => ({ pending: s.pending - 1, failed: false }));
        },
        () => setSaving((s) => ({ pending: s.pending - 1, failed: true })),
      );
  }

  /** Wendet eine Änderung an; liefert die Fehlermeldung oder null. */
  function apply(op: Operation): string | null {
    const result = applyOperation(history.doc, op);
    if (!result.ok) {
      setError(result.error);
      return result.error;
    }
    setError(null);
    if (result.scenario === history.doc) return null;
    setHistory({
      doc: result.scenario,
      past: [...history.past, history.doc].slice(-HISTORY_LIMIT),
      future: [],
    });
    persist(result.scenario);
    return null;
  }

  function undo() {
    const previous = history.past.at(-1);
    if (!previous) return;
    setHistory({
      doc: previous,
      past: history.past.slice(0, -1),
      future: [history.doc, ...history.future],
    });
    persist(previous);
  }

  function redo() {
    const next = history.future[0];
    if (!next) return;
    setHistory({
      doc: next,
      past: [...history.past, history.doc],
      future: history.future.slice(1),
    });
    persist(next);
  }

  const undoRef = useLatest(undo);
  const redoRef = useLatest(redo);

  // Strg+Z / Strg+Y bzw. Strg+Umschalt+Z, außer beim Tippen in Eingabefeldern.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoRef.current();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redoRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoRef, redoRef]);

  const saveStatus: SaveStatus =
    saving.pending > 0 ? "saving" : saving.failed ? "failed" : "saved";

  return {
    doc: history.doc,
    apply,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    saveStatus,
    updatedAt,
    error,
    clearError: () => setError(null),
  };
}

/** Ref auf die jeweils neueste Funktion, damit der Tastatur-Listener stabil bleiben kann. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
