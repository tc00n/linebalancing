import { Suspense as GateSuspense } from "react";
import { ProjectGate } from "@/features/projects/project-gate";
import { AppHeader } from "@/components/app-header";
import { ImportWizard } from "@/features/import/import-wizard";

export default function ImportPage() {
  return (
    <GateSuspense fallback={<p className="p-8">Zugang wird geprüft …</p>}>
      <ProjectGate>
        <AppHeader />
        <main className="flex flex-1 flex-col">
          <ImportWizard />
        </main>
      </ProjectGate>
    </GateSuspense>
  );
}
