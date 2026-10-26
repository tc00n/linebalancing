# NEONEX Line Balancing

Webanwendung für Line Balancing mit interaktivem Yamazumi-Diagramm. Erster Einsatz: Projekt Eura Mobil, Workshop Arbeitsvorbereitung.

**Status:** Rechenkern (Phase 1), Excel-Import (Phase 3), Yamazumi (Phase 4), Bearbeiten im Diagramm (Phase 5 ohne Szenariosperre), Szenarien und Ist/Ziel-Vergleich (Phase 7) sowie Suche, Filter und Vollbild (Phase 8) sind umgesetzt. Phase 2 ergänzt Supabase-Speicherung, Anmeldung und Projektberechtigungen. Browserdaten können ausdrücklich in ein Projekt übernommen werden; siehe [Phase-2-Übergabe](docs/PHASE2.md).

## Dokumentation

| Datei                                                          | Inhalt                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [docs/spezifikation/](docs/spezifikation/)                     | Verbindliche Spezifikation (Anforderungen, Datenmodell-Vorschlag, Abnahmecheckliste) |
| [docs/ENTWICKLUNGSPLAN.md](docs/ENTWICKLUNGSPLAN.md)           | Freigegebener Entwicklungsplan mit Phasen und Anforderungszuordnung                  |
| [docs/OFFENE_ENTSCHEIDUNGEN.md](docs/OFFENE_ENTSCHEIDUNGEN.md) | Fachliche und technische Fragen, die vor der Umsetzung zu klären sind                |

## Personalplanung

Die Referenzdatei wird projektbezogen auf der Seite Personalplanung eingebunden. Produktiver Stations-/Kostenstellenabgleich bei 70 Minuten, Brutto und Bestand separat. Details, Quellenhinweise und Rechenregeln: [docs/PERSONALPLANUNG.md](docs/PERSONALPLANUNG.md).

## Technik

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase (Auth, Postgres, RLS) · Vercel (Region `fra1`)

## Lokale Entwicklung

Voraussetzungen: Node.js 24, für die lokale Datenbank zusätzlich Docker.

```bash
npm install
cp .env.example .env.local   # vier Supabase-Werte eintragen (docs/CLOUD_SETUP.md)
npm run check:env            # API-/Datenbankverbindung prüfen
npm run dev                  # http://localhost:3000
```

Das Repo liegt bewusst nicht in OneDrive: Der Sync von `node_modules` und `.next` führt unter Windows zu Dateisperren.

## Prüfungen

| Befehl                 | Zweck                                                     |
| ---------------------- | --------------------------------------------------------- |
| `npm run lint`         | ESLint                                                    |
| `npm run typecheck`    | TypeScript                                                |
| `npm run format:check` | Prettier                                                  |
| `npm test`             | Unit-Tests (Vitest)                                       |
| `npm run e2e`          | UI-Regressionen mit isolierter lokaler Entwicklungsablage |
| `npm run db:test`      | Datenbank- und RLS-Tests mit Rollback (Node/pg)           |

Zusätzlich: `npm run e2e:auth` prüft nach einem Build den Produktionszugang; `npm run e2e:cloud` prüft die echte Cloud-Anbindung mit temporären Testdaten. `npm run db:test:remote` prüft Datenbank und RLS mit Rollback. CI führt Code-, UI-, Produktionszugangs- und Datenbankprüfungen gegen eine lokale Docker-Supabase aus. Details: [docs/PHASE2.md](docs/PHASE2.md).

## Zeitaufnahme in Importdatei umwandeln

Einmaliger Konverter für Zeitaufnahmen im Format „Übersicht Zeitaufnahmen“ (Entscheidung E24):

```bash
npx tsx scripts/zeitaufnahme/cli.ts "<Zeitaufnahme>.xlsx" "<Importdatei>.xlsx"
```

Gelesen wird das Diagrammblatt (∑t je Arbeitsablauf). Die Importdatei enthält zusätzlich ein Blatt „Konvertierungsprotokoll“ mit Festlegungen und Lücken. Excel-Dateien sind vertraulich und per `.gitignore` vom Repo ausgeschlossen.
