import { createStore, del, get, set, values } from "idb-keyval";
import {
  DEFAULT_CATEGORY_ID,
  defaultCategories,
  type Category,
} from "@/domain/model/categories";
import type { ScenarioInput } from "@/domain/model/types";

/**
 * Gespeichertes Szenario. Bis zur Einführung der Datenbank (Phase 2) liegt es
 * nur im Browser dieses Geräts (IndexedDB), siehe docs/ENTWICKLUNGSPLAN.md.
 */
export interface StoredScenario {
  readonly id: string;
  /** Varianten- und Szenarioname starten mit dem Dateinamen (F88). */
  readonly variantName: string;
  readonly name: string;
  readonly sourceFilename: string;
  readonly importedAt: string;
  /** Letzte Änderung (F38); Bearbeiter folgt mit dem Login in Phase 2. */
  readonly updatedAt: string;
  readonly input: ScenarioInput;
  /** Kategorien mit Farben je Szenario (E11). */
  readonly categories: readonly Category[];
}

/** Schnittstelle, gegen die die Oberfläche arbeitet; die Supabase-Variante folgt in Phase 2. */
export interface ScenarioRepository {
  list(): Promise<StoredScenario[]>;
  get(id: string): Promise<StoredScenario | undefined>;
  save(scenario: StoredScenario): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Ergänzt Felder, die ältere gespeicherte Stände noch nicht hatten. */
export function withDefaults(stored: StoredScenario): StoredScenario {
  if (
    stored.categories?.length &&
    stored.input.steps.every((s) => s.categoryId)
  ) {
    return stored;
  }
  return {
    ...stored,
    categories: stored.categories?.length
      ? stored.categories
      : defaultCategories(),
    input: {
      ...stored.input,
      steps: stored.input.steps.map((s) =>
        s.categoryId ? s : { ...s, categoryId: DEFAULT_CATEGORY_ID },
      ),
    },
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
