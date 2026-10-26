import { describe, it, expect, vi } from "vitest";
import { ScenarioSaveQueue } from "./scenario-save-queue";
import type { ScenarioRepository, StoredScenario } from "./scenarioRepository";
const stored = {
  id: "s",
  version: 1,
  name: "Ist",
  input: { taktMin: 4 },
} as StoredScenario;
function repo(save: ScenarioRepository["save"]): ScenarioRepository {
  return {
    save,
    list: async () => [],
    get: async () => undefined,
    remove: async () => {},
  };
}
describe("Cloud-Autosave", () => {
  it("speichert schnelle Aenderungen seriell mit bestaetigten Versionen", async () => {
    let finish: ((s: StoredScenario) => void) | undefined;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<StoredScenario>((resolve) => {
            finish = resolve;
          }),
      )
      .mockImplementationOnce(async (s: StoredScenario) => ({
        ...s,
        version: 3,
      }));
    const queue = new ScenarioSaveQueue(repo(save), stored);
    const first = queue.save({ ...stored, name: "A" }),
      second = queue.save({ ...stored, name: "B" });
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);
    finish!({ ...stored, name: "A", version: 2 });
    await first;
    await second;
    expect(save.mock.calls[1][0]).toMatchObject({ name: "B", version: 2 });
  });
  it("stoppt nach Versionskonflikt statt spaetere Aenderungen darueberzuschreiben", async () => {
    const save = vi.fn().mockRejectedValue(Error("Versionskonflikt"));
    const queue = new ScenarioSaveQueue(repo(save), stored);
    const a = queue.save(stored),
      b = queue.save(stored);
    await expect(a).rejects.toThrow("Versionskonflikt");
    await expect(b).rejects.toThrow("Versionskonflikt");
    expect(save).toHaveBeenCalledTimes(1);
  });
});
