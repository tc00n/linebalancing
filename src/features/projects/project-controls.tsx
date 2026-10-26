"use client";
import { navigateFresh } from "@/features/auth/navigate-fresh";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { useProjectSession } from "./project-session";
export function ProjectControls() {
  const project = useProjectSession();
  if (!project || project.local) return null;
  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) navigateFresh("/login");
    else window.alert("Abmeldung fehlgeschlagen. Bitte erneut versuchen.");
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
