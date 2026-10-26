import "server-only";
/** Ausschliesslich fuer lokale Entwicklung und UI-Tests; in Produktion immer false. */
export function localDevelopment() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.LINEBALANCING_LOCAL_DEV === "1"
  );
}
