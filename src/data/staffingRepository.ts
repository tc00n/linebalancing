"use client";
import { createStore, get, set, values } from "idb-keyval";
import { browserClient } from "./supabase/browser";
import {
  validateStaffingPlan,
  type StaffingPlan,
} from "@/domain/staffing/model";
export interface StoredStaffingPlan {
  id: string;
  document: StaffingPlan;
  imported_at: string;
}
export interface StaffingRepository {
  list(): Promise<StoredStaffingPlan[]>;
  import(document: StaffingPlan, sha256: string): Promise<string>;
}
export function createStaffingRepository(
  projectId: string,
  local: boolean,
): StaffingRepository {
  if (local) {
    const store = createStore("neonex-staffing", "plans");
    return {
      async list() {
        return (await values<StoredStaffingPlan>(store)).sort((a, b) =>
          b.imported_at.localeCompare(a.imported_at),
        );
      },
      async import(document, sha256) {
        validateStaffingPlan(document);
        if (!(await get(sha256, store)))
          await set(
            sha256,
            { id: sha256, document, imported_at: new Date().toISOString() },
            store,
          );
        return sha256;
      },
    };
  }
  return {
    async list() {
      const { data, error } = await browserClient()
        .from("staffing_plans")
        .select("id,document,imported_at")
        .eq("project_id", projectId)
        .order("imported_at", { ascending: false });
      if (error)
        throw Error(
          "Personalplanung konnte nicht geladen werden. Bitte Projektzugang und Verbindung prüfen.",
        );
      const plans = data as StoredStaffingPlan[];
      plans.forEach((p) => validateStaffingPlan(p.document));
      return plans;
    },
    async import(document, sha256) {
      validateStaffingPlan(document);
      const { data, error } = await browserClient().rpc(
        "import_staffing_plan",
        { p_project_id: projectId, p_document: document, p_sha256: sha256 },
      );
      if (error)
        throw Error(
          "Personalplanung konnte nicht gespeichert werden. Bitte Projektzugang und Verbindung prüfen.",
        );
      return data as string;
    },
  };
}
