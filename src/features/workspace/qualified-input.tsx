"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatQualified, parseQualified } from "@/domain/model/qualification";
import type { Step } from "@/domain/model/types";
import type { Operation } from "@/domain/ops/operations";

/**
 * Qualifikation eines Arbeitsgangs (E51) als „1; 8; 12“ wie in der
 * Importspalte „Qualifiziert“; leer = jeder.
 */
export function QualifiedInput(props: {
  step: Step;
  onApply: (op: Operation) => string | null;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const shown = formatQualified(props.step.qualifiedEmployees);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-0.5">
      <Input
        id={props.id}
        key={shown}
        defaultValue={shown}
        aria-label={props.id ? undefined : `Qualifiziert für ${props.step.id}`}
        disabled={props.disabled}
        aria-invalid={error !== null}
        placeholder="jeder"
        inputMode="numeric"
        className={props.className}
        title="Nummern der Mitarbeiter, die den Arbeitsgang ausführen können, z. B. 1; 8; 12. Leer = jeder."
        onBlur={(e) => {
          const parsed = parseQualified(e.target.value);
          if (!parsed.ok) {
            setError(
              `„${parsed.invalid.join("“, „")}“ ist keine Mitarbeiternummer. Beispiel: 1; 8; 12`,
            );
            return;
          }
          if (formatQualified(parsed.labels) === shown) {
            setError(null);
            e.target.value = shown;
            return;
          }
          const result = props.onApply({
            type: "setQualified",
            stepId: props.step.id,
            employeeLabels: parsed.labels,
          });
          setError(result);
          if (result) e.target.value = shown;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      {error && (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
