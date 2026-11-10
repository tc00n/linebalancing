"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  LockIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { parseGermanNumber } from "@/domain/import/cells";
import type { Category } from "@/domain/model/categories";
import type { Operation } from "@/domain/ops/operations";
import { formatMinutes } from "@/lib/format";
import type { SaveStatus } from "./use-scenario-editor";

/** Speicherstatus neben dem Szenarionamen (F119). */
export function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <span
        className="flex items-center gap-1 text-xs font-normal text-muted-foreground"
        role="status"
      >
        <Loader2Icon className="size-4 animate-spin" /> speichert …
      </span>
    );
  }
  if (status === "locked") {
    return (
      <span
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground"
        role="status"
        title="Jemand anderes bearbeitet dieses Szenario. Änderungen sind erst möglich, wenn es frei ist oder übernommen wird."
      >
        <LockIcon className="size-4" /> schreibgeschützt
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className="flex items-center gap-1 text-xs font-medium text-destructive"
        role="alert"
      >
        <AlertTriangleIcon className="size-4" /> nicht gespeichert
      </span>
    );
  }
  return (
    <span
      className="flex items-center gap-1 text-xs font-normal text-muted-foreground"
      role="status"
      title="Alle Änderungen wurden erfolgreich gespeichert."
    >
      <CheckCircle2Icon className="size-4 text-chart-3" /> gespeichert
    </span>
  );
}

/** Zahleneingabe, die erst beim Verlassen bzw. Enter übernommen wird (F59, F60). */
export function NumberSetting(props: {
  label: string;
  value: number;
  onCommit: (value: number) => string | null;
  disabled?: boolean;
}) {
  const shown = formatMinutes(props.value);
  const [error, setError] = useState<string | null>(null);
  const messageId = useId();
  return (
    <label className="relative flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{props.label}</span>
      <Input
        key={shown}
        defaultValue={shown}
        inputMode="decimal"
        aria-invalid={error !== null}
        aria-describedby={error ? messageId : undefined}
        disabled={props.disabled}
        className="h-8 w-20 tabular-nums"
        onBlur={(e) => {
          const parsed = parseGermanNumber(e.target.value);
          // U7: Ungültiges nicht stillschweigend verwerfen, sondern sagen, was fehlt.
          // Die Eingabe bleibt zum Korrigieren stehen; gerechnet wird weiter mit dem alten Wert.
          const next = parsed.ok
            ? parsed.value === props.value
              ? null
              : props.onCommit(parsed.value)
            : invalidNumberMessage(e.target.value);
          setError(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = shown;
            setError(null);
          }
        }}
      />
      {error && (
        <span
          id={messageId}
          role="alert"
          className="absolute top-full right-0 z-30 mt-1 w-max max-w-64 rounded-md border border-destructive/30 bg-white px-2 py-1 text-xs text-destructive shadow-nx-sm"
        >
          Nicht übernommen, es gilt weiter {shown}. {error}
        </span>
      )}
    </label>
  );
}

/** Meldung für Eingaben, die keine Zahl im deutschen Format sind (F80). */
export function invalidNumberMessage(text: string): string {
  if (/^\s*-?\d+\.\d+\s*$/.test(text))
    return `Bitte mit Komma eingeben, z. B. ${text.trim().replace(".", ",")}.`;
  return "Bitte eine Zahl mit Komma eingeben, z. B. 1,50.";
}

const SLIDER_STEPS = 1000;

/**
 * Logarithmischer Regler: gleiche Bewegung = gleiche prozentuale Änderung.
 * Linear sprang die Zeitskala bei großen Zeiten (sinnvoll: 1–4 px/min von 1–300)
 * schon bei kleinster Bewegung um 50 % und mehr (Backlog, F98).
 */
export function ScaleSlider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Nachkommastellen des Werts; 0 = ganze Pixel. */
  decimals?: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  const ratio = Math.log(props.max / props.min);
  const clamped = Math.min(props.max, Math.max(props.min, props.value));
  const position = Math.round(
    (Math.log(clamped / props.min) / ratio) * SLIDER_STEPS,
  );
  const factor = 10 ** (props.decimals ?? 0);
  const fromPosition = (p: number) =>
    Math.round(props.min * Math.exp((p / SLIDER_STEPS) * ratio) * factor) /
    factor;

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{props.label}</span>
      {/* Feste Breite außen: der Slider selbst ist auf 100 % seines Containers gesetzt. */}
      <div className="w-32">
        <Slider
          min={0}
          max={SLIDER_STEPS}
          value={[position]}
          onValueChange={(value) =>
            props.onChange(
              fromPosition(Array.isArray(value) ? value[0] : value),
            )
          }
          aria-label={props.label}
          aria-valuetext={`${props.value} ${props.unit}`}
        />
      </div>
      <span className="w-24 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {props.value.toLocaleString("de-DE", {
          maximumFractionDigits: props.decimals ?? 0,
        })}{" "}
        {props.unit}
      </span>
    </label>
  );
}

const hatchUnassigned =
  "repeating-linear-gradient(135deg, color-mix(in srgb, var(--yz-unassigned) 35%, white) 0 3px, color-mix(in srgb, var(--yz-unassigned) 60%, white) 3px 5px)";

/** Legende mit änderbaren Kategoriefarben (F27, F93, F97). */
export function Legend(props: {
  categories: readonly Category[];
  onApply?: (op: Operation) => string | null;
  showMoved?: boolean;
}) {
  const swatch = "inline-block size-3 rounded-sm border border-white";
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
      {props.categories.map((c) =>
        props.onApply ? (
          <label
            key={c.id}
            className="flex cursor-pointer items-center gap-1.5"
            title="Farbe ändern"
          >
            <input
              type="color"
              value={c.color}
              onChange={(e) =>
                props.onApply!({
                  type: "setCategoryColor",
                  categoryId: c.id,
                  color: e.target.value,
                })
              }
              className="size-4 cursor-pointer rounded-sm border-0 bg-transparent p-0"
              aria-label={`Farbe der Kategorie ${c.label}`}
            />
            {c.label}
          </label>
        ) : (
          <span key={c.id} className="flex items-center gap-1.5">
            <span className={swatch} style={{ backgroundColor: c.color }} />
            {c.label}
          </span>
        ),
      )}
      <span className="flex items-center gap-1.5">
        <span
          className={swatch}
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, var(--yz-wait) 0 3px, var(--yz-wait-stripe) 3px 4px)",
          }}
        />
        Wartezeit (berechnet)
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className={`${swatch} border-dashed border-nx-steel-dark bg-(--yz-allowance)`}
        />
        Zuschlag
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-sm border border-dashed border-nx-blue bg-(--yz-process)" />
        Prozesszeit (bindet keinen Mitarbeiter)
      </span>
      <span className="flex items-center gap-1.5">
        <span className={swatch} style={{ backgroundImage: hatchUnassigned }} />
        ohne Mitarbeiter (nicht eingerechnet)
      </span>
      {props.showMoved && (
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-1 rounded-sm bg-(--yz-moved)" />
          gegenüber Ist verschoben
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0 w-5 border-t-2 border-dashed border-(--yz-takt)" />
        Taktzeit
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-3 border-2 border-(--yz-over) bg-(--yz-over)/15" />
        über Takt
      </span>
      {/* U6: Arbeitsgänge mit Hinweis (z. B. nicht qualifiziert, Vorgänger verletzt). */}
      <span className="flex items-center gap-1.5">
        <span className="relative inline-block size-3 rounded-sm bg-nx-steel">
          <span className="absolute top-0 right-0 size-0 border-t-[7px] border-l-[7px] border-t-(--warning-strong) border-l-transparent" />
        </span>
        mit Hinweis
      </span>
      {/* G7: Abkürzung unter den Stationen und in der Mitarbeiteransicht erklären. */}
      <span>MA = Mitarbeiter</span>
    </div>
  );
}
