import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import { ImportWizard } from "@/features/import/import-wizard";

export default function ImportPage() {
  return (
    <>
      <AppHeader>
        <Link href="/" className={buttonVariants({ variant: "ghost" })}>
          Zu den Szenarien
        </Link>
      </AppHeader>
      <main className="flex flex-1 flex-col">
        <ImportWizard />
      </main>
    </>
  );
}
