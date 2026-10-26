import { createStore, del, get, set, values } from "idb-keyval";
import {
  DEFAULT_CATEGORY_ID,
  defaultCategories,
  type Category,
} from "@/domain/model/categories";
import { withUniqueEmployeeLabels } from "@/domain/model/employees";
import type { ScenarioInput } from "@/domain/model/types";

/**
 * Gespeichertes Szenario. Bis zur Einführung der Datenbank (Phase 2) liegt es
 * nur im Browser dieses Geräts (IndexedDB), siehe docs/ENTWICKLUNGSPLAN.md.
 */
export interface StoredScenario {
  readonly id: string;
  /** Szenarien einer Variante teilen die ID; nur sie sind vergleichbar (E15, E20). */
  readonly variantId: string;
  /** Varianten- und Szenarioname starten mit dem Dateinamen (F88). */
  readonly variantName: string;
  readonly name: string;
  readonly sourceFilename: string;
  /** Anlagezeitpunkt (Import oder Duplizieren). */
  readonly importedAt: string;
  /** Name des Szenarios, aus dem dieses dupliziert wurde (E20). */
  readonly copiedFrom?: string;
  /** Letzte Änderung (F38), mit Serverversion und Bearbeiter bei Cloud-Szenarien. */
  readonly updatedAt: string;
  readonly version?: number;
  readonly updatedBy?: string;
  readonly updatedByLabel?: string;
  readonly input: ScenarioInput;
  /** Kategorien mit Farben je Szenario (E11). */
  readonly categories: readonly Category[];
}

/** Gemeinsame Schnittstelle fuer projektbezogene Cloud- und lokale Browserablage. */
export interface ScenarioRepository {
  list(): Promise<StoredScenario[]>;
  get(id: string): Promise<StoredScenario | undefined>;
  save(scenario: StoredScenario): Promise<StoredScenario | void>;
  remove(id: string): Promise<void>;
}

/**
 * Ergänzt Felder, die ältere gespeicherte Stände noch nicht hatten, und
 * macht Mitarbeiterbezeichnungen linienweit eindeutig (E40). Gespeichert
 * wird das mit der nächsten Änderung.
 */
export function withDefaults(stored: StoredScenario): StoredScenario {
  const input = withUniqueEmployeeLabels(stored.input);
  if (
    input === stored.input &&
    stored.variantId &&
    stored.categories?.length &&
    stored.input.steps.every((s) => s.categoryId)
  ) {
    return stored;
  }
  return {
    ...stored,
    variantId: stored.variantId ?? `variant:${stored.variantName}`,
    categories: stored.categories?.length
      ? stored.categories
      : defaultCategories(),
    input: {
      ...input,
      steps: input.steps.map((s) =>
        s.categoryId ? s : { ...s, categoryId: DEFAULT_CATEGORY_ID },
      ),
    },
  };
}

/** Name, der in der Liste noch nicht vorkommt: „X – Kopie“, „X – Kopie 2“ … */
export function uniqueName(base: string, taken: readonly string[]): string {
  const used = new Set(taken.map((n) => n.toLocaleLowerCase("de")));
  if (!used.has(base.toLocaleLowerCase("de"))) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!used.has(candidate.toLocaleLowerCase("de"))) return candidate;
  }
}

/** Kopie eines Szenarios in derselben Variante mit allen Zuordnungen (E20). */
export function duplicateScenario(
  source: StoredScenario,
  siblings: readonly StoredScenario[],
  now = new Date().toISOString(),
): StoredScenario {
  return {
    ...source,
    id: crypto.randomUUID(),
    version: undefined,
    updatedBy: undefined,
    updatedByLabel: undefined,
    name: uniqueName(
      `${source.name} – Kopie`,
      siblings.map((s) => s.name),
    ),
    importedAt: now,
    updatedAt: now,
    copiedFrom: source.name,
  };
}

export function createBrowserRepository(): ScenarioRepository {
  const store = createStore("neonex-linebalancing", "scenarios");
  return {
    async list() {
      const all = await values<StoredScenario>(store);
      return all
        .map(withDefaults)
        .sort((a, b) => b.importedAt.localeCompare(a.importedAt));
    },
    async get(id) {
      const stored = await get<StoredScenario>(id, store);
      return stored && withDefaults(stored);
    },
    save: (scenario) => set(scenario.id, scenario, store),
    remove: (id) => del(id, store),
  };
}

let repository: ScenarioRepository | undefined;

/** Repository des Browsers; nur in Client-Komponenten aufrufen. */
export function scenarioRepository(): ScenarioRepository {
  repository ??= createBrowserRepository();
  return repository;
}
