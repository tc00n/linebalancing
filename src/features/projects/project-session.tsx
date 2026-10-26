"use client";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
export interface ProjectSession {
  id: string;
  name: string;
  owner: boolean;
  local: boolean;
}
const Context = createContext<ProjectSession | null>(null);
export function ProjectSessionProvider({
  value,
  children,
}: {
  value: ProjectSession;
  children: ReactNode;
}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useProjectSession() {
  return useContext(Context);
}
