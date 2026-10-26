"use client";
import { useEffect } from "react";
/** Fragment wird sofort entfernt und ausschliesslich in der aktuellen Tab-Sitzung gehalten. */
export function JoinCode() {
  useEffect(() => {
    const hash = location.hash;
    const match = /^#(?:\/join\/)?([A-Za-z0-9]{5}-[A-Za-z0-9]{5})$/.exec(hash);
    if (match)
      sessionStorage.setItem(
        "neonex-pending-project-code",
        match[1].toUpperCase(),
      );
    history.replaceState(null, "", location.pathname);
    location.replace("/login");
  }, []);
  return <p className="p-8">Einladung wird geöffnet …</p>;
}
