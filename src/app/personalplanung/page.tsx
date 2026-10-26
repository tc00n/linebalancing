import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { ProjectGate } from "@/features/projects/project-gate";
import { StaffingWorkspace } from "@/features/staffing/staffing-workspace";
export default function StaffingPage() {
  return (
    <Suspense fallback={<p className="p-8">Zugang wird geprüft …</p>}>
      <ProjectGate>
        <AppHeader />
        <main className="flex flex-1 flex-col">
          <Suspense fallback={<p className="p-8">Lade Personalplanung …</p>}>
            <StaffingWorkspace />
          </Suspense>
        </main>
      </ProjectGate>
    </Suspense>
  );
}
