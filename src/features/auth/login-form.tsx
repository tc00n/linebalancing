"use client";
import { consumeInvitation } from "@/features/auth/invitation";
import { useEffect, useState } from "react";
import { browserClient } from "@/data/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeNext } from "./safe-next";
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [invited, setInvited] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Der Code bleibt im Tab; der Magic-Link oeffnet meist einen neuen Tab, daher erst nach der Anmeldung abfragen.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tablokalen Einladungsstatus nach SSR einmalig hydrieren
    setInvited(consumeInvitation() !== "");
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
        Du erhältst einen Anmeldelink per E-Mail. Mitglieder geben nach der
        Anmeldung den Projektcode ein. NEONEX-Firmenadressen können eigene
        Projekte ohne Code öffnen.
      </p>
      {invited && (
        <p className="rounded-lg border p-3 text-sm">
          Einladung erkannt. Melde dich an und öffne danach den Einladungslink
          erneut oder gib den Projektcode auf der Projektseite ein.
        </p>
      )}
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
      <Button disabled={busy} type="submit">
        {busy ? "Wird verschickt …" : "Anmeldelink anfordern"}
      </Button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
