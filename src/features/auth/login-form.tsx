"use client";
import { consumeInvitation } from "@/features/auth/invitation";
import { useEffect, useState } from "react";
import { browserClient } from "@/data/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeNext } from "./safe-next";
const CODE_KEY = "neonex-pending-project-code";
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tablokalen Einladungsstatus nach SSR einmalig hydrieren
    setCode(consumeInvitation());
    if (new URLSearchParams(location.search).has("fehler"))
      setMessage(
        "Der Link ist abgelaufen oder wurde in einem anderen Browser geöffnet. Bitte einen neuen Link anfordern.",
      );
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (code.trim())
        sessionStorage.setItem(CODE_KEY, code.trim().toUpperCase());
      else sessionStorage.removeItem(CODE_KEY);
      const next = safeNext(new URLSearchParams(location.search).get("next"));
      const callback = new URL("/auth/callback", location.origin);
      callback.searchParams.set("next", next);
      const { error } = await browserClient().auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: callback.toString() },
      });
      if (error) throw error;
      setMessage(
        "Anmeldelink verschickt. Öffne ihn in diesem Browser. Bitte prüfe auch den Spam-Ordner.",
      );
    } catch {
      setMessage(
        "Der Anmeldelink konnte nicht verschickt werden. Bitte E-Mail-Adresse prüfen und später erneut versuchen.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="mx-auto flex w-full max-w-md flex-col gap-5 p-6"
    >
      <h1 className="text-2xl font-semibold">Anmelden</h1>
      <p>
        Du erhältst einen Anmeldelink per E-Mail. Mitglieder benötigen
        zusätzlich den Projektcode. NEONEX-Firmenadressen können eigene Projekte
        ohne Code öffnen.
      </p>
      <label className="grid gap-2">
        E-Mail-Adresse
        <Input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="grid gap-2">
        Projektcode (für Mitglieder)
        <Input
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="XXXXX-XXXXX"
        />
      </label>
      <Button disabled={busy} type="submit">
        {busy ? "Wird verschickt …" : "Anmeldelink anfordern"}
      </Button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
