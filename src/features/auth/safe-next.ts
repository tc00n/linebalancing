/** Verhindert externe Weiterleitungen und das Wiedereinfuegen von Geheimnissen. */
export function safeNext(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n#]/.test(value)
  )
    return "/projects";
  try {
    const parsed = new URL(value, "https://local.invalid");
    if (parsed.origin !== "https://local.invalid") return "/projects";
    return parsed.pathname + parsed.search;
  } catch {
    return "/projects";
  }
}
