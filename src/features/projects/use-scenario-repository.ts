"use client";
import { useMemo } from "react";
import { createBrowserRepository } from "@/data/scenarioRepository";
import { createCloudRepository } from "@/data/cloudScenarioRepository";
import { useProjectSession } from "./project-session";
export function useScenarioRepository() {
  const project = useProjectSession();
  if (!project) throw Error("Projektzugang fehlt.");
  return useMemo(
    () =>
      project.local
        ? createBrowserRepository()
        : createCloudRepository(project.id),
    [project.id, project.local],
  );
}
