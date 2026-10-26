import { createStore, del, get, set, values } from "idb-keyval";
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
  readonly updatedAt: string;
  readonly input: ScenarioInput;
}

/** Schnittstelle, gegen die die Oberfläche arbeitet; die Supabase-Variante folgt in Phase 2. */
export interface ScenarioRepository {
  list(): Promise<StoredScenario[]>;
  get(id: string): Promise<StoredScenario | undefined>;
  save(scenario: StoredScenario): Promise<void>;
  remove(id: string): Promise<void>;
}

export function createBrowserRepository(): ScenarioRepository {
  const store = createStore("neonex-linebalancing", "scenarios");
  return {
    async list() {
      const all = await values<StoredScenario>(store);
      return all.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
    },
    get: (id) => get<StoredScenario>(id, store),
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
