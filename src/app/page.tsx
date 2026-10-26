import { AppHeader } from "@/components/app-header";
import { ScenarioList } from "@/features/scenarios/scenario-list";

export default function Home() {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <ScenarioList />
      </main>
    </>
  );
}
