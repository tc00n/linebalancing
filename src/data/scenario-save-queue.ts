import type { ScenarioRepository, StoredScenario } from "./scenarioRepository";
/** Serialisiert Autosaves und gibt die bestaetigte Version an den naechsten Schreibvorgang weiter. */
export class ScenarioSaveQueue {
  private tail: Promise<StoredScenario>;
  constructor(
    private readonly repository: ScenarioRepository,
    initial: StoredScenario,
  ) {
    this.tail = Promise.resolve(initial);
  }
  save(next: StoredScenario): Promise<StoredScenario> {
    // Ein Fehler stoppt die Kette. Ohne Reload darf ein Versionskonflikt nicht ueberschrieben werden.
    this.tail = this.tail.then(async (previous) => {
      const payload = { ...next, version: previous.version };
      return (await this.repository.save(payload)) ?? payload;
    });
    return this.tail;
  }
}
