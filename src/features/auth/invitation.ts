/** Nur clientseitig aufrufen: Einladungsgeheimnis nie als Query an den Server senden. */
export function consumeInvitation(): string {
  const match = /^#(?:\/join\/)?([A-Za-z0-9]{5}-[A-Za-z0-9]{5})$/.exec(
    location.hash,
  );
  if (match) {
    sessionStorage.setItem(
      "neonex-pending-project-code",
      match[1].toUpperCase(),
    );
    history.replaceState(null, "", location.pathname + location.search);
  }
  return sessionStorage.getItem("neonex-pending-project-code") ?? "";
}
