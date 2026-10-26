import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { serverClient } from "@/data/supabase/server";
import { ProjectList } from "@/features/projects/project-list";
async function Projects() {
  const client = await serverClient();
  const { data } = await client.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: projects, error } = await client
    .from("projects")
    .select("id,name,owner_id")
    .order("created_at");
  const { data: staff } = await client.rpc("is_staff");
  return (
    <ProjectList
      initial={projects ?? []}
      userId={data.user.id}
      isStaff={staff === true}
      initialError={error ? "Projekte konnten nicht geladen werden." : null}
    />
  );
}
export default function ProjectsPage() {
  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <Suspense fallback={<p className="p-8">Lade Projekte ?</p>}>
          <Projects />
        </Suspense>
      </main>
    </>
  );
}
