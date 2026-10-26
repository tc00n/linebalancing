import { Suspense as GateSuspense } from "react";
import { ProjectGate } from "@/features/projects/project-gate";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { TableWorkspace } from "@/features/table/table-workspace";

export default function ScenarioTablePage() {
  return (
    <GateSuspense fallback={<p className="p-8">Zugang wird geprüft …</p>}>
      <ProjectGate>
        <AppHeader />
        <main className="flex flex-1 flex-col">
          {/* Die Szenario-ID steht in der URL und wird im Browser gelesen. */}
          <Suspense
            fallback={<p className="p-8 text-muted-foreground">Lade …</p>}
          >
            <TableWorkspace />
          </Suspense>
        </main>
      </ProjectGate>
    </GateSuspense>
  );
}
