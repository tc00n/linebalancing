"use client";

import { ColumnsIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoredScenario } from "@/data/scenarioRepository";

export type Side = "ist" | "ziel";

/**
 * Reiter Ist und Ziel mit je einer Szenarioauswahl (F103, F110, F114),
 * Vergleich-Schalter (F122) und Duplizieren (E20). Ist/Ziel sind Ansichtsrollen;
 * dasselbe Szenario darf auf beiden Seiten stehen (F115).
 */
export function ScenarioBar(props: {
  siblings: readonly StoredScenario[];
  istId: string;
  zielId: string;
  tab: Side;
  compare: boolean;
  onTab: (tab: Side) => void;
  onSelect: (side: Side, scenarioId: string) => void;
  onToggleCompare: () => void;
  onDuplicate: () => void;
}) {
  const tab = (side: Side, label: string, value: string) => {
    const active = props.compare || props.tab === side;
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${
          active
            ? "border-nx-blue bg-white shadow-nx-sm"
            : "border-transparent bg-secondary"
        }`}
      >
        <button
          type="button"
          role="tab"
          aria-selected={active}
          className={`text-sm font-semibold ${active ? "text-nx-blue" : "text-muted-foreground"}`}
          onClick={() => props.onTab(side)}
        >
          {label}
        </button>
        <select
          aria-label={`Szenario für ${label}`}
          className="h-7 max-w-56 rounded-md border border-input bg-white px-1.5 text-sm"
          value={value}
          onChange={(e) => props.onSelect(side, e.target.value)}
        >
          {props.siblings.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="tablist"
        aria-label="Ist und Ziel"
        className="flex flex-wrap gap-2"
      >
        {tab("ist", "Ist", props.istId)}
        {tab("ziel", "Ziel", props.zielId)}
      </div>
      <Button
        variant={props.compare ? "default" : "outline"}
        onClick={props.onToggleCompare}
        aria-pressed={props.compare}
      >
        <ColumnsIcon data-icon="inline-start" />
        Vergleich
      </Button>
      <Button
        variant="outline"
        onClick={props.onDuplicate}
        title="Kopie des Ziel-Szenarios anlegen und als Ziel öffnen"
      >
        <CopyIcon data-icon="inline-start" />
        Duplizieren
      </Button>
      {props.istId === props.zielId && (
        <span className="text-xs text-muted-foreground">
          Ist und Ziel zeigen dasselbe Szenario.
        </span>
      )}
    </div>
  );
}
