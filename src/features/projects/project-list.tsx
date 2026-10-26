"use client";
import { navigateFresh } from "@/features/auth/navigate-fresh";
import { consumeInvitation } from "@/features/auth/invitation";
import { useEffect, useState } from "react";
import { browserClient } from "@/data/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
interface Project {
  id: string;
  name: string;
  owner_id: string;
}
interface Member {
  user_id: string;
  email: string;
  role: string;
}
export function ProjectList({
  initial,
  userId,
  isStaff,
  initialError,
}: {
  initial: Project[];
  userId: string;
  isStaff: boolean;
  initialError: string | null;
}) {
  const [projects, setProjects] = useState(initial),
    [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [message, setMessage] = useState(initialError ?? ""),
    [busy, setBusy] = useState(false);
  const [managed, setManaged] = useState<Project | null>(null),
    [shownCode, setShownCode] = useState(""),
    [members, setMembers] = useState<Member[]>([]),
    [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tablokalen Einladungsstatus nach SSR einmalig hydrieren
    setCode(consumeInvitation());
  }, []);
  const client = () => browserClient();
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Aktion fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    const response = await fetch("/api/projects/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok)
      throw Error(
        "Projekt kann nicht geöffnet werden. Bitte Projektcode erneut eingeben.",
      );
    navigateFresh("/");
  }
  async function reload() {
    const { data, error } = await client()
      .from("projects")
      .select("id,name,owner_id")
      .order("created_at");
    if (error) throw Error("Projekte konnten nicht geladen werden.");
    setProjects(data ?? []);
  }
  async function redeem(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => {
      const { data, error } = await client().rpc("redeem_project_code", {
        p_code: code.trim(),
      });
      if (error) throw Error("Code konnte nicht geprüft werden.");
      if (!data?.ok) throw Error(data?.message ?? "Projektcode ungültig.");
      sessionStorage.removeItem("neonex-pending-project-code");
      history.replaceState(null, "", location.pathname);
      await open(data.projectId);
    });
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => {
      const { data, error } = await client().rpc("create_project", {
        p_name: name.trim(),
      });
      if (error) throw Error("Projekt konnte nicht angelegt werden.");
      await open(data);
    });
  }
  async function manage(project: Project) {
    await run(async () => {
      const c = client();
      const [{ data: code, error: a }, { data: members, error: b }] =
        await Promise.all([
          c.rpc("get_project_code", { p_project_id: project.id }),
          c.rpc("list_project_members", { p_project_id: project.id }),
        ]);
      if (a || b) throw Error("Verwaltung konnte nicht geladen werden.");
      setManaged(project);
      setShownCode(code);
      setMembers(members ?? []);
      setConfirmation("");
    });
  }
  async function rotate() {
    if (
      !managed ||
      !window.confirm(
        "Neuen Projektcode erzeugen? Alle über den bisherigen Code beigetretenen Mitglieder verlieren ihren Zugriff.",
      )
    )
      return;
    await run(async () => {
      const { data, error } = await client().rpc("rotate_project_code", {
        p_project_id: managed.id,
      });
      if (error) throw Error("Code konnte nicht erneuert werden.");
      setShownCode(data);
      setMembers(members.filter((m) => m.role === "owner"));
    });
  }
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-semibold">Projekte</h1>
        <Button
          variant="ghost"
          onClick={() =>
            run(async () => {
              const r = await fetch("/api/auth/logout", { method: "POST" });
              if (!r.ok) throw Error("Abmeldung fehlgeschlagen.");
              sessionStorage.removeItem("neonex-pending-project-code");
              navigateFresh("/login");
            })
          }
        >
          Abmelden
        </Button>
      </div>
      {message && (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      )}
      <form
        onSubmit={redeem}
        className="flex flex-wrap items-end gap-3 rounded-xl border p-4"
      >
        <label className="grid gap-2">
          Projektcode
          <Input
            required
            autoComplete="off"
            placeholder="XXXXX-XXXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <Button type="submit" disabled={busy}>
          Projekt beitreten
        </Button>
        <p className="w-full text-sm text-muted-foreground">
          Mitglieder geben den Code bei jeder neuen Anmeldung erneut ein.
        </p>
      </form>
      {isStaff && (
        <form
          onSubmit={create}
          className="flex flex-wrap items-end gap-3 rounded-xl border p-4"
        >
          <label className="grid gap-2">
            Neues Projekt
            <Input
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={busy}>
            Projekt anlegen
          </Button>
        </form>
      )}
      {projects.length === 0 && (
        <p>
          Noch kein Projekt verfügbar. Mit einem gültigen Code kannst du einem
          Projekt beitreten.
        </p>
      )}
      {projects.map((p) => (
        <section
          key={p.id}
          className="flex flex-wrap items-center gap-3 rounded-xl border p-4"
        >
          <h2 className="mr-auto font-semibold">{p.name}</h2>
          <Button disabled={busy} onClick={() => run(() => open(p.id))}>
            Öffnen
          </Button>
          {p.owner_id === userId ? (
            <Button disabled={busy} variant="outline" onClick={() => manage(p)}>
              Verwalten
            </Button>
          ) : (
            <Button
              disabled={busy}
              variant="ghost"
              onClick={() =>
                run(async () => {
                  if (!window.confirm("Projekt verlassen?")) return;
                  const { error } = await client().rpc("leave_project", {
                    p_project_id: p.id,
                  });
                  if (error) throw Error("Austritt fehlgeschlagen.");
                  await reload();
                })
              }
            >
              Verlassen
            </Button>
          )}
        </section>
      ))}
      {managed && (
        <section className="grid gap-4 rounded-xl border p-5">
          <div className="flex justify-between">
            <h2 className="text-lg font-semibold">{managed.name} verwalten</h2>
            <Button
              variant="ghost"
              onClick={() => {
                setManaged(null);
                setShownCode("");
                setMembers([]);
              }}
            >
              Schließen
            </Button>
          </div>
          <p>
            Projektcode: <strong className="font-mono">{shownCode}</strong>
          </p>
          <Button variant="outline" disabled={busy} onClick={rotate}>
            Code erneuern und Mitgliederzugriff widerrufen
          </Button>
          <p className="text-sm">
            Einladungslink:{" "}
            {typeof window !== "undefined" ? location.origin : ""}/#/join/
            {shownCode}
          </p>
          <h3 className="font-semibold">Mitglieder</h3>
          {members.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center justify-between gap-2"
            >
              <span>
                {m.email} ({m.role === "owner" ? "Owner" : "Editor"})
              </span>
              {m.role !== "owner" && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const { error } = await client().rpc(
                        "remove_project_member",
                        { p_project_id: managed.id, p_user_id: m.user_id },
                      );
                      if (error) throw Error("Entfernen fehlgeschlagen.");
                      setMembers(
                        members.filter((x) => x.user_id !== m.user_id),
                      );
                    })
                  }
                >
                  Entfernen
                </Button>
              )}
            </div>
          ))}
          <label className="grid gap-2">
            Zum endgültigen Löschen den Projektnamen eingeben
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <Button
            variant="destructive"
            disabled={busy || confirmation !== managed.name}
            onClick={() =>
              run(async () => {
                const { error } = await client().rpc("delete_project", {
                  p_project_id: managed.id,
                  p_confirmation: confirmation,
                });
                if (error) throw Error("Löschen fehlgeschlagen.");
                setManaged(null);
                setShownCode("");
                setMembers([]);
                await reload();
              })
            }
          >
            Projekt mit allen Daten löschen
          </Button>
        </section>
      )}
    </div>
  );
}
