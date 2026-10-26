import { Suspense as GateSuspense } from "react";
import { ProjectGate } from "@/features/projects/project-gate";
import { AppHeader } from "@/components/app-header";
import { ScenarioList } from "@/features/scenarios/scenario-list";

export default function Home() {
  return (
    <GateSuspense fallback={<p className="p-8">Zugang wird geprüft …</p>}>
      <ProjectGate>
        <AppHeader />
        <main className="flex flex-1 flex-col">
          <ScenarioList />
        </main>
      </ProjectGate>
    </GateSuspense>
  );
}
