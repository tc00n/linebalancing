import { Suspense as GateSuspense } from "react";
import { ProjectGate } from "@/features/projects/project-gate";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import { ImportWizard } from "@/features/import/import-wizard";

export default function ImportPage() {
  return (
    <GateSuspense fallback={<p className="p-8">Zugang wird geprüft …</p>}>
      <ProjectGate>
        <AppHeader>
          <Link href="/" className={buttonVariants({ variant: "ghost" })}>
            Zu den Szenarien
          </Link>
        </AppHeader>
        <main className="flex flex-1 flex-col">
          <ImportWizard />
        </main>
      </ProjectGate>
    </GateSuspense>
  );
}
