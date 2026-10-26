"use client";

import { ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { sortStations } from "@/domain/model/stationOrder";
import {
  EMPTY_FILTER,
  isFilterActive,
  UNASSIGNED,
  type StepFilter,
} from "@/features/yamazumi/layout";
import type { ScenarioView } from "./scenario-view";

interface Option {
  readonly value: string;
  readonly label: string;
}

const employeeCollator = new Intl.Collator("de", { numeric: true });

/**
 * Suche und kombinierbare Filter dauerhaft oberhalb des Diagramms (F96, F121).
 * Aktive Kriterien sind als Chips sichtbar und einzeln oder gesamt zurücksetzbar.
 */
export function FilterBar(props: {
  view: ScenarioView;
  filter: StepFilter;
  onFilter: (filter: StepFilter) => void;
  search: string;
  onSearch: (search: string) => void;
  matchCount: number | null;
}) {
  const { view, filter } = props;
  const stations: Option[] = sortStations(view.input.stations).map((s) => ({
    value: s.id,
    label: s.label,
  }));
  const employees: Option[] = [
    ...[...new Set(view.input.employees.map((e) => e.label))]
      .sort(employeeCollator.compare)
      .map((label) => ({ value: label, label })),
    { value: UNASSIGNED, label: "nicht zugeordnet" },
  ];
  const categories: Option[] = view.categories.map((c) => ({
    value: c.id,
    label: c.label,
  }));

  const criteria = [
    { key: "stationIds", label: "Station", options: stations },
    { key: "employeeLabels", label: "Mitarbeiter", options: employees },
    { key: "categoryIds", label: "Kategorie", options: categories },
  ] as const;

  const setCriterion = (key: keyof StepFilter, values: ReadonlySet<string>) =>
    props.onFilter({ ...filter, [key]: values });

  const chips = criteria.flatMap((c) =>
    [...filter[c.key]].map((value) => ({
      key: c.key,
      value,
      text: `${c.label}: ${c.options.find((o) => o.value === value)?.label ?? value}`,
    })),
  );

  return (
    <div
      role="search"
      aria-label="Suche und Filter"
      className="flex flex-col gap-2 rounded-lg border bg-white px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex items-center">
          <SearchIcon className="pointer-events-none absolute left-2 size-4 text-muted-foreground" />
          <Input
            type="search"
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
            placeholder="ID oder Text suchen"
            aria-label="Arbeitsgang suchen"
            className="h-8 w-64 pl-8"
          />
        </label>
        {props.matchCount !== null && (
          <span className="text-xs text-muted-foreground" role="status">
            {props.matchCount === 1
              ? "1 Treffer"
              : `${props.matchCount} Treffer`}
          </span>
        )}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        {criteria.map((c) => (
          <MultiSelect
            key={c.key}
            label={c.label}
            options={c.options}
            selected={filter[c.key]}
            onChange={(values) => setCriterion(c.key, values)}
          />
        ))}
        {isFilterActive(filter) && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => props.onFilter(EMPTY_FILTER)}
          >
            Filter zurücksetzen
          </button>
        )}
      </div>
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Aktive Filter">
          {chips.map((chip) => (
            <li
              key={`${chip.key}:${chip.value}`}
              className="flex items-center gap-1 rounded-md bg-secondary py-0.5 pr-0.5 pl-2 text-xs"
            >
              {chip.text}
              <button
                type="button"
                className="rounded p-0.5 hover:bg-nx-steel"
                aria-label={`Filter ${chip.text} entfernen`}
                onClick={() => {
                  const next = new Set(filter[chip.key]);
                  next.delete(chip.value);
                  setCriterion(chip.key, next);
                }}
              >
                <XIcon className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MultiSelect(props: {
  label: string;
  options: readonly Option[];
  selected: ReadonlySet<string>;
  onChange: (values: ReadonlySet<string>) => void;
}) {
  const toggle = (value: string, checked: boolean) => {
    const next = new Set(props.selected);
    if (checked) next.add(value);
    else next.delete(value);
    props.onChange(next);
  };
  return (
    <Popover>
      <PopoverTrigger
        className={buttonVariants({
          variant: props.selected.size ? "secondary" : "outline",
          size: "sm",
        })}
      >
        {props.label}
        {props.selected.size > 0 && ` (${props.selected.size})`}
        <ChevronDownIcon data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-80 w-60 overflow-y-auto">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="sr-only">{props.label} filtern</legend>
          {props.options.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                checked={props.selected.has(o.value)}
                onCheckedChange={(checked) => toggle(o.value, checked === true)}
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
