"use client";
import { useScenarioRepository } from "@/features/projects/use-scenario-repository";

import { useEffect, useRef, useState } from "react";
import { confirmFromMessage, useConfirm } from "@/components/confirm-dialog";
import { ScenarioSaveQueue } from "@/data/scenario-save-queue";
import { type StoredScenario } from "@/data/scenarioRepository";
import { assignmentWarning, moveWarning } from "@/domain/ops/movePreview";
import { nextEmployee } from "@/domain/ops/operations";
import {
  applyOperation,
  type EditableScenario,
  type Operation,
} from "@/domain/ops/operations";

/** F119; „locked“: schreibgeschützt, weil jemand anderes bearbeitet (E27). */
export type SaveStatus = "saved" | "saving" | "failed" | "locked";

const READ_ONLY =
  "Schreibgeschützt: Das Szenario wird gerade an anderer Stelle bearbeitet.";

/**
 * Rückgabe von `apply`, solange eine Rückfrage offen ist (E50, E51). Die Änderung gilt dann
 * noch nicht; nach „Trotzdem …“ im Dialog wird sie übernommen (U5).
 */
const CONFIRM_PENDING = "Rückfrage offen.";

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
 * Ohne Bearbeitungssperre (`readOnly`, E27) werden keine Änderungen angenommen.
 */
export function useScenarioEditor(initial: StoredScenario, readOnly = false) {
  const repository = useScenarioRepository();
  const [saveQueue] = useState(
    () => new ScenarioSaveQueue(repository, initial),
  );
  const [history, setHistory] = useState<History>({
    doc: { input: initial.input, categories: initial.categories },
    past: [],
    future: [],
  });
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt);
  const [updatedByLabel, setUpdatedByLabel] = useState(initial.updatedByLabel);
  const [saving, setSaving] = useState({ pending: 0, failed: false });
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  // Nach der Rückfrage auf den dann aktuellen Stand anwenden, nicht auf den beim Öffnen.
  const applyRef = useRef<(op: Operation, confirmed: boolean) => string | null>(
    () => null,
  );

  function persist(doc: EditableScenario) {
    const now = new Date().toISOString();
    setSaving((s) => ({ ...s, pending: s.pending + 1 }));
    saveQueue
      .save({
        ...initial,
        input: doc.input,
        categories: doc.categories,
        updatedAt: now,
      })
      .then(
        (saved) => {
          setUpdatedAt(saved.updatedAt);
          setUpdatedByLabel(saved.updatedByLabel);
          setSaving((s) => ({ pending: s.pending - 1, failed: false }));
        },
        (cause) => {
          setSaving((s) => ({ pending: s.pending - 1, failed: true }));
          setError(
            cause instanceof Error
              ? cause.message
              : "Speichern fehlgeschlagen.",
          );
        },
      );
  }

  /** Wendet eine Änderung an; liefert die Fehlermeldung oder null. */
  function apply(op: Operation, confirmed = false): string | null {
    if (readOnly) return READ_ONLY;
    if (!confirmed) {
      // E50: Verschieben mit Restriktionsverletzung nur nach Bestätigung.
      const moveText =
        op.type === "moveStep"
          ? moveWarning(history.doc.input, op.stepId, op.stationId)
          : null;
      // E51: Zuordnung eines nicht qualifizierten Mitarbeiters nur nach Bestätigung.
      const label = assignedLabel(history.doc.input, op);
      const assignText =
        label &&
        (op.type === "assignEmployee" || op.type === "assignNewEmployee")
          ? assignmentWarning(history.doc.input, op.stepId, label)
          : null;
      const question = moveText
        ? confirmFromMessage("Vorgängerbeziehungen verletzt", moveText)
        : assignText
          ? confirmFromMessage("Nicht als qualifiziert eingetragen", assignText)
          : null;
      if (question) {
        void confirm(question).then((ok) => {
          if (ok) applyRef.current(op, true);
        });
        return CONFIRM_PENDING;
      }
    }
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

  useEffect(() => {
    applyRef.current = apply;
  });

  function undo() {
    const previous = history.past.at(-1);
    if (!previous || readOnly) return;
    setHistory({
      doc: previous,
      past: history.past.slice(0, -1),
      future: [history.doc, ...history.future],
    });
    persist(previous);
  }

  function redo() {
    const next = history.future[0];
    if (!next || readOnly) return;
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
    saving.pending > 0
      ? "saving"
      : saving.failed
        ? "failed"
        : readOnly
          ? "locked"
          : "saved";

  return {
    doc: history.doc,
    apply,
    undo,
    redo,
    canUndo: !readOnly && history.past.length > 0,
    canRedo: !readOnly && history.future.length > 0,
    saveStatus,
    updatedAt,
    updatedByLabel,
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

/** Bezeichnung des Mitarbeiters, den eine Operation zuordnet, sonst null. */
function assignedLabel(
  input: StoredScenario["input"],
  op: Operation,
): string | null {
  if (op.type === "assignEmployee" && op.employeeId !== null) {
    return input.employees.find((e) => e.id === op.employeeId)?.label ?? null;
  }
  if (op.type === "assignNewEmployee") {
    const step = input.steps.find((s) => s.id === op.stepId);
    return step ? nextEmployee(input.employees, step.stationId).label : null;
  }
  return null;
}
