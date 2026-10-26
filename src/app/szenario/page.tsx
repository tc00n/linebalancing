import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { Workspace } from "@/features/workspace/workspace";

export default function ScenarioPage() {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        {/* Die Szenario-ID steht in der URL und wird im Browser gelesen. */}
        <Suspense
          fallback={<p className="p-8 text-muted-foreground">Lade …</p>}
        >
          <Workspace />
        </Suspense>
      </main>
    </>
  );
}
