"use client";

import { ChevronDownIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatQualified } from "@/domain/model/qualification";
import { sortStations } from "@/domain/model/stationOrder";
import {
  personOf,
  type Employee,
  type Station,
  type Step,
} from "@/domain/model/types";
import type { Operation } from "@/domain/ops/operations";

const labelCollator = new Intl.Collator("de", { numeric: true });

/**
 * Qualifikation eines Arbeitsgangs (E51) zum Ankreuzen: alle Mitarbeiter der
 * Linie, die der Station des Arbeitsgangs zuerst. Keine Auswahl = jeder.
 * Jede Änderung wird sofort gespeichert und ist rückgängig zu machen.
 */
export function QualifiedInput(props: {
  step: Step;
  employees: readonly Employee[];
  stations: readonly Station[];
  onApply: (op: Operation) => string | null;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const selected = props.step.qualifiedEmployees ?? [];
  const options = personOptions(props.employees, props.stations, props.step);
  const set = (labels: readonly string[]) =>
    props.onApply({
      type: "setQualified",
      stepId: props.step.id,
      employeeLabels: labels,
    });

  return (
    <Popover>
      <PopoverTrigger
        id={props.id}
        disabled={props.disabled}
        aria-label={`Qualifiziert für ${props.step.id}`}
        className={`flex h-8 w-full items-center justify-between gap-1 rounded-lg border border-input bg-white px-2 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 ${props.className ?? ""}`}
      >
        <span
          className={`truncate ${selected.length ? "" : "text-muted-foreground"}`}
        >
          {selected.length ? formatQualified(selected) : "jeder"}
        </span>
        <ChevronDownIcon
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <p className="text-xs text-muted-foreground">
          Wer kann {props.step.id} ausführen? Keine Auswahl = jeder.
        </p>
        <ul
          className="flex max-h-64 flex-col gap-1 overflow-y-auto"
          aria-label={`Qualifizierte Mitarbeiter für ${props.step.id}`}
        >
          {options.map((o) => {
            const checked = selected.includes(o.label);
            return (
              <li key={o.label}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 hover:bg-secondary">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) =>
                      set(
                        next
                          ? [...selected, o.label]
                          : selected.filter((l) => l !== o.label),
                      )
                    }
                  />
                  <span>{o.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {o.stations}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {selected.length > 0 && (
          <button
            type="button"
            className="self-start text-xs text-nx-blue hover:underline"
            onClick={() => set([])}
          >
            Auswahl aufheben (jeder)
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Personen der Linie (E40) mit ihren Stationen; zuerst die der Station des
 * Arbeitsgangs. Eingetragene Bezeichnungen ohne Mitarbeiter im Szenario
 * bleiben sichtbar, damit sie entfernt werden können.
 */
function personOptions(
  employees: readonly Employee[],
  stations: readonly Station[],
  step: Step,
) {
  const rank = new Map(sortStations(stations).map((s, i) => [s.id, i]));
  const label = new Map(stations.map((s) => [s.id, s.label]));
  const persons = new Map<string, { label: string; stationIds: string[] }>();
  for (const e of employees) {
    const p = personOf(e);
    const entry = persons.get(p) ?? { label: e.label, stationIds: [] };
    entry.stationIds.push(e.stationId);
    persons.set(p, entry);
  }
  const options = [...persons.values()].map((p) => ({
    label: p.label,
    here: p.stationIds.includes(step.stationId),
    stations: p.stationIds
      .sort((a, b) => rank.get(a)! - rank.get(b)!)
      .map((id) => label.get(id))
      .join(", "),
  }));
  for (const l of step.qualifiedEmployees ?? []) {
    if (!options.some((o) => o.label === l)) {
      options.push({ label: l, here: false, stations: "nicht im Szenario" });
    }
  }
  return options.sort(
    (a, b) =>
      Number(b.here) - Number(a.here) ||
      labelCollator.compare(a.label, b.label),
  );
}
