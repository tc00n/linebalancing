"use client";
import { browserClient } from "./supabase/browser";
import { assertValidScenario } from "@/domain/model/validate";
import {
  withDefaults,
  type ScenarioRepository,
  type StoredScenario,
} from "./scenarioRepository";
/** Projektspezifisches Repository; jede RPC prueft Mitgliedschaft und Sitzung in Postgres. */
export function createCloudRepository(projectId: string): ScenarioRepository {
  const client = () => browserClient();
  async function list() {
    const { data, error } = await client().rpc("list_scenario_documents", {
      p_project_id: projectId,
    });
    if (error)
      throw Error(
        "Szenarien konnten nicht geladen werden. Bitte Projektzugang und Verbindung prüfen.",
      );
    return (data as StoredScenario[]).map(withDefaults);
  }
  return {
    list,
    async get(id) {
      return (await list()).find((s) => s.id === id);
    },
    async save(scenario) {
      assertValidScenario(scenario.input);
      const { data, error } = await client().rpc(
        scenario.version === undefined ? "import_scenario" : "save_scenario",
        {
          p_project_id: projectId,
          p_document: scenario,
          ...(scenario.version === undefined
            ? {}
            : { p_expected_version: scenario.version }),
        },
      );
      if (error) {
        if (error.code === "40001")
          throw Error(
            "Ein anderer Stand wurde gespeichert. Bitte neu laden; deine Änderung wurde nicht gespeichert.",
          );
        throw Error(
          "Speichern fehlgeschlagen. Bitte Verbindung und Projektzugriff prüfen. Nicht gespeicherte Änderungen bleiben bis zum Neuladen in dieser Ansicht.",
        );
      }
      return withDefaults(data as StoredScenario);
    },
    /** E26: endgültig für alle im Projekt; mit dem letzten Szenario entfällt die Variante. */
    async remove(id) {
      const { error } = await client().rpc("delete_scenario", {
        p_project_id: projectId,
        p_scenario_id: id,
      });
      if (error) {
        if (error.code === "40001")
          throw Error("Das Szenario wurde bereits gelöscht. Bitte neu laden.");
        throw Error(
          "Löschen fehlgeschlagen. Bitte Verbindung und Projektzugriff prüfen.",
        );
      }
    },
  };
}
