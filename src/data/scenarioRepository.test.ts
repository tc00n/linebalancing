import { describe, expect, it } from "vitest";
import { scenario } from "@/domain/testing/builders";
import {
  duplicateScenario,
  uniqueName,
  withDefaults,
  type StoredScenario,
} from "./scenarioRepository";

const stored = (
  name: string,
  extra: Partial<StoredScenario> = {},
): StoredScenario => ({
  id: name,
  variantId: "v1",
  variantName: "XT",
  name,
  sourceFilename: "XT.xlsx",
  importedAt: "2026-10-26T10:00:00.000Z",
  updatedAt: "2026-10-26T10:00:00.000Z",
  input: scenario([{ id: "A", station: "S1", employee: "MA1", time: 1 }]),
  categories: [],
  ...extra,
});

describe("Szenarioverwaltung", () => {
  it("vergibt eindeutige Namen ohne Rücksicht auf Groß-/Kleinschreibung", () => {
    expect(uniqueName("Ist – Kopie", ["Ist"])).toBe("Ist – Kopie");
    expect(uniqueName("Ist – Kopie", ["ist – kopie", "Ist – Kopie 2"])).toBe(
      "Ist – Kopie 3",
    );
  });

  it("dupliziert mit allen Zuordnungen in dieselbe Variante (E20)", () => {
    const source = stored("Ist");
    const copy = duplicateScenario(
      source,
      [source],
      "2026-10-27T08:00:00.000Z",
    );
    expect(copy).toMatchObject({
      variantId: "v1",
      name: "Ist – Kopie",
      copiedFrom: "Ist",
      importedAt: "2026-10-27T08:00:00.000Z",
      input: source.input,
    });
    expect(copy.id).not.toBe(source.id);
  });

  it("ergänzt Variante und Kategorien bei älteren Ständen", () => {
    const old = {
      ...stored("Alt"),
      variantId: undefined,
      categories: undefined,
    } as unknown as StoredScenario;
    const migrated = withDefaults(old);
    expect(migrated.variantId).toBe("variant:XT");
    expect(migrated.categories).toHaveLength(3);
    expect(migrated.input.steps[0].categoryId).toBe("value_adding");
  });
});
