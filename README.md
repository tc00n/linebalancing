# NEONEX Line Balancing

Webanwendung für Line Balancing mit interaktivem Yamazumi-Diagramm. Erster Einsatz: Projekt Eura Mobil, Workshop Arbeitsvorbereitung.

**Status:** Rechenkern (Phase 1), Excel-Import (Phase 3) und Yamazumi lesend (Phase 4) sind umgesetzt. Szenarien werden vorerst nur im Browser gespeichert; Datenbank und Login (Phase 2) folgen. Noch keine Bearbeitung im Diagramm (Phase 5).

## Dokumentation

| Datei                                                          | Inhalt                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [docs/spezifikation/](docs/spezifikation/)                     | Verbindliche Spezifikation (Anforderungen, Datenmodell-Vorschlag, Abnahmecheckliste) |
| [docs/ENTWICKLUNGSPLAN.md](docs/ENTWICKLUNGSPLAN.md)           | Freigegebener Entwicklungsplan mit Phasen und Anforderungszuordnung                  |
| [docs/OFFENE_ENTSCHEIDUNGEN.md](docs/OFFENE_ENTSCHEIDUNGEN.md) | Fachliche und technische Fragen, die vor der Umsetzung zu klären sind                |

## Technik

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase (Auth, Postgres, RLS) · Vercel (Region `fra1`)

## Lokale Entwicklung

Voraussetzungen: Node.js 24, für die lokale Datenbank zusätzlich Docker.

```bash
npm install
cp .env.example .env.local   # Werte aus `npx supabase status` eintragen
npm run db:start             # lokale Supabase (Docker)
npm run dev                  # http://localhost:3000
```

Das Repo liegt bewusst nicht in OneDrive: Der Sync von `node_modules` und `.next` führt unter Windows zu Dateisperren.

## Prüfungen

| Befehl                 | Zweck                                                      |
| ---------------------- | ---------------------------------------------------------- |
| `npm run lint`         | ESLint                                                     |
| `npm run typecheck`    | TypeScript                                                 |
| `npm run format:check` | Prettier                                                   |
| `npm test`             | Unit-Tests (Vitest)                                        |
| `npm run e2e`          | End-to-End-Tests (Playwright, gegen den Produktions-Build) |
| `npm run db:test`      | Datenbank- und RLS-Tests (pgTAP, ab Phase 2)               |

Die CI unter `.github/workflows/ci.yml` führt alle Prüfungen außer `db:test` bei jedem Push aus.
