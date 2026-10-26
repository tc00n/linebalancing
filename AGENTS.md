<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Projektregeln

- Verbindlich ist `docs/spezifikation/`. Plan: `docs/ENTWICKLUNGSPLAN.md`. Offene Punkte: `docs/OFFENE_ENTSCHEIDUNGEN.md`.
- Keine fachlichen Anforderungen erfinden. Offene Entscheidungen (E1–E33) nicht eigenmächtig umsetzen, sondern nachfragen.
- Importierte Arbeitszeiten sind unveränderlich (F17). Durchsetzung in der Datenbank, nicht nur im UI.
- Rechenlogik lebt rein in `src/domain/` (kein React, kein Supabase) und wird testgetrieben entwickelt.
- Berechnungen ohne Zwischenrundung; erst die Ausgabe auf zwei Nachkommastellen runden (P2).
- Autorisierung immer serverseitig über RLS und geprüfte Datenbankfunktionen. Der Supabase-Secret-/Service-Role-Key kommt nie in diese App.
- UI-Sprache Deutsch, Zahlen im deutschen Format.
