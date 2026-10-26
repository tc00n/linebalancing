import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { serverClient } from "@/data/supabase/server";
import { localDevelopment } from "@/data/local-mode";
import { ProjectSessionProvider } from "./project-session";
export async function ProjectGate({ children }: { children: ReactNode }) {
  if (localDevelopment())
    return (
      <ProjectSessionProvider
        value={{
          id: "local",
          name: "Lokale Entwicklung",
          owner: true,
          local: true,
        }}
      >
        {children}
      </ProjectSessionProvider>
    );
  const client = await serverClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  const id = (await cookies()).get("neonex-project")?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) redirect("/projects");
  const { data: project } = await client
    .from("projects")
    .select("id,name,owner_id")
    .eq("id", id)
    .maybeSingle();
  if (!project) redirect("/projects");
  return (
    <ProjectSessionProvider
      value={{
        id: project.id,
        name: project.name,
        owner: project.owner_id === data.user.id,
        local: false,
      }}
    >
      {children}
    </ProjectSessionProvider>
  );
}
