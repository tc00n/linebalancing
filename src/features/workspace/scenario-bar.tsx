"use client";

import { ColumnsIcon, CopyIcon, WandSparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoredScenario } from "@/data/scenarioRepository";

export type Side = "ist" | "ziel";

/**
 * Reiter Ist und Ziel mit je einer Szenarioauswahl (F103, F110, F114),
 * Vergleich-Schalter (F122), Duplizieren (E20) und Verteilungsvorschlag (E43). Ist/Ziel sind Ansichtsrollen;
 * dasselbe Szenario darf auf beiden Seiten stehen (F115). Szenarien aller Varianten
 * sind wählbar, bei mehreren Varianten nach Variante gruppiert (E48).
 */
export function ScenarioBar(props: {
  choices: readonly StoredScenario[];
  istId: string;
  zielId: string;
  tab: Side;
  compare: boolean;
  onTab: (tab: Side) => void;
  onSelect: (side: Side, scenarioId: string) => void;
  onToggleCompare: () => void;
  onDuplicate: () => void;
  /** E43: Verteilungsvorschlag für eine Station. */
  onOptimize: () => void;
}) {
  const groups = new Map<string, StoredScenario[]>();
  for (const s of props.choices)
    groups.set(s.variantId, [...(groups.get(s.variantId) ?? []), s]);
  const option = (s: StoredScenario) => (
    <option key={s.id} value={s.id}>
      {s.name}
    </option>
  );
  const variantOf = (id: string) =>
    props.choices.find((s) => s.id === id)?.variantId;
  const crossVariant = variantOf(props.istId) !== variantOf(props.zielId);

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
          {groups.size > 1
            ? [...groups.values()].map((members) => (
                <optgroup
                  key={members[0].variantId}
                  label={members[0].variantName}
                >
                  {members.map(option)}
                </optgroup>
              ))
            : props.choices.map(option)}
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
      <Button
        variant="outline"
        onClick={props.onOptimize}
        title="Arbeitsgänge einer Station automatisch verteilen; Ergebnis als neues Szenario"
      >
        <WandSparklesIcon data-icon="inline-start" />
        Verteilung vorschlagen
      </Button>
      {crossVariant && (
        <span className="text-xs text-muted-foreground">
          Ist und Ziel stammen aus verschiedenen Varianten.
        </span>
      )}
      {props.istId === props.zielId && (
        <span className="text-xs text-muted-foreground">
          Ist und Ziel zeigen dasselbe Szenario.
        </span>
      )}
    </div>
  );
}
