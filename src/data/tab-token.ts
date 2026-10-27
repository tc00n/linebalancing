"use client";
/**
 * Kennung dieses Browser-Tabs für die Szenariosperre (E27). Diagramm und Tabelle im selben Tab
 * teilen sie; ein zweiter Tab derselben Person erhält eine eigene und bleibt schreibgeschützt.
 */
export const TAB_TOKEN: string =
  typeof crypto === "undefined" ? "" : crypto.randomUUID();
