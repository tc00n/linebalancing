"use client";
import { browserClient } from "./supabase/browser";
import { assertValidScenario } from "@/domain/model/validate";
import {
  withDefaults,
  type LockState,
  type ScenarioRepository,
  type StoredScenario,
} from "./scenarioRepository";
import { TAB_TOKEN } from "./tab-token";
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
          // E27: Speichern nur mit der Sperre dieses Tabs.
          ...(scenario.version === undefined
            ? {}
            : {
                p_expected_version: scenario.version,
                p_lock_token: TAB_TOKEN,
              }),
        },
      );
      if (error) {
        if (error.code === "40001")
          throw Error(
            "Ein anderer Stand wurde gespeichert. Bitte neu laden; deine Änderung wurde nicht gespeichert.",
          );
        if (error.code === "55P03")
          throw Error(
            "Du bearbeitest das Szenario nicht mehr (übernommen oder Sperre abgelaufen). Deine Änderung wurde nicht gespeichert.",
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
        // Meldung der Datenbank nennt den Bearbeiter (E26 mit E27).
        if (error.code === "55P03") throw Error(error.message + ".");
        throw Error(
          "Löschen fehlgeschlagen. Bitte Verbindung und Projektzugriff prüfen.",
        );
      }
    },
    lock: {
      async acquire(scenarioId, takeover = false) {
        const { data, error } = await client().rpc("acquire_scenario_lock", {
          p_project_id: projectId,
          p_scenario_id: scenarioId,
          p_token: TAB_TOKEN,
          p_takeover: takeover,
        });
        if (error) {
          if (error.code === "40001")
            throw Error("Das Szenario wurde inzwischen gelöscht.");
          throw Error("Bearbeitungssperre nicht erreichbar.");
        }
        return data as LockState;
      },
      async release(scenarioId) {
        await client().rpc("release_scenario_lock", {
          p_project_id: projectId,
          p_scenario_id: scenarioId,
          p_token: TAB_TOKEN,
        });
      },
      // F64: beim Schließen des Tabs; die Anfrage überlebt das Entladen der Seite.
      releaseOnExit(scenarioId) {
        navigator.sendBeacon(
          "/api/scenario-lock/release",
          new Blob(
            [
              JSON.stringify({
                projectId,
                scenarioId,
                token: TAB_TOKEN,
              }),
            ],
            { type: "application/json" },
          ),
        );
      },
    },
  };
}
