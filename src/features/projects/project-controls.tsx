"use client";
import { useConfirm } from "@/components/confirm-dialog";
import { navigateFresh } from "@/features/auth/navigate-fresh";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { useProjectSession } from "./project-session";
export function ProjectControls() {
  const project = useProjectSession();
  const confirm = useConfirm();
  if (!project || project.local) return null;
  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) navigateFresh("/login");
    else
      void confirm({
        title: "Abmeldung fehlgeschlagen",
        description: "Bitte erneut versuchen.",
        confirmLabel: "Schließen",
        notice: true,
      });
  }
  return (
    <>
      <span className="hidden text-sm sm:inline">{project.name}</span>
      <Link href="/projects" className={buttonVariants({ variant: "ghost" })}>
        Projekte
      </Link>
      <Button variant="ghost" onClick={logout}>
        Abmelden
      </Button>
    </>
  );
}
