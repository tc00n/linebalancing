# Entwicklungsplan – NEONEX Line Balancing (MVP)

## Kontext

Für das Projekt Eura Mobil / Arbeitsvorbereitung entsteht eine Line-Balancing-Webanwendung mit Excel-Import, interaktivem Yamazumi, manueller Umverteilung, Szenarien, Vergleich und Export. Verbindlich ist die Spezifikation unter [`spezifikation/`](spezifikation/) (README, 01_ANFORDERUNGEN mit Basis 1–27, F1–F131 und P1–P6, 02_DATENMODELL als Vorschlag, 03_TESTS als Abnahmecheckliste). Eine lokale Kopie der Referenz „NEONEX Workshop Hub“ (Repo Prozesshaus) liegt noch nicht vor (E31).

Freigegeben am 26.10.2026. Fachliche Lücken stehen in [`OFFENE_ENTSCHEIDUNGEN.md`](OFFENE_ENTSCHEIDUNGEN.md) und werden nicht eigenmächtig gefüllt.

Leitlinien, die alle Phasen betreffen:

- **Importierte Zeiten sind unveränderlich (F17).** Das wird in der Datenbank durchgesetzt (Trigger und Spaltenrechte), nicht nur in der Oberfläche.
- **Rechenkern zuerst.** Parallelität, Wartezeiten, Stationshöhe und KPIs liegen in einem reinen TypeScript-Modul ohne UI und ohne Datenbank, testgetrieben entwickelt.
- **Sicherheit serverseitig.** RLS, geprüfte `security definer`-Funktionen und Szenariosperren in Postgres. Das Frontend ist nie die einzige Schutzschicht.

---

## 1 · Analyse: Widersprüche und Präzisierungen

### 1a · In der Spezifikation bereits aufgelöst (spätere Entscheidung gilt)

| Früher                                                | Später, gilt                                                          | Auswirkung                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- |
| Basis 09: eine einheitliche Taktzeit                  | F59: Takt pro Szenario                                                | `takt_min` am Szenario                                |
| Basis 13 und F4/F9/F16: Verschiebungsvorschläge       | F43: nicht im MVP                                                     | Phase „Später“                                        |
| Basis 17: Ausgangszustand plus ein Ziel               | F24/F110/F114: beliebig viele Szenarien, Ist/Ziel sind Ansichtsrollen | Reiter mit Dropdown                                   |
| Basis 21: Rollen allgemein                            | A1/F39: genau ein Owner plus Editoren, kein Viewer                    | zwei Rollen                                           |
| Basis 11 und F8: räumliche Grenzen                    | F77: werden vom Anwender beurteilt, nicht modelliert                  | nur Vorgängerprüfung wird automatisiert               |
| F21: Parallelität über Reihenfolge plus Kennzeichnung | F54/F55: explizite Vorgänger-IDs plus Mitarbeiterzuordnung            | keine eigene Parallelitätsspalte im Template          |
| F56: längster Mitarbeitereinsatz                      | F90: inklusive Wartezeit                                              | Höhe = max. Belegungsdauer                            |
| F57: globaler Zuschlag                                | F60/P1: pro Szenario, auf Mitarbeiter-Gesamtzeit                      | siehe offene Entscheidung E2                          |
| F107: Personalauslastung ohne Wartezeit               | F108: inklusive Wartezeit, Nenner = MA-Anzahl × Takt                  | „belegungsbezogene“ Auslastung, im UI so benennen     |
| F113: farbliche Markierung                            | F116: zusätzlich ein Symbol                                           | beides                                                |
| F35: PDF-Bericht                                      | F45: im MVP nur Excel und Diagramm                                    | PDF-Bericht später                                    |
| F23: Ist frei bearbeitbar, F5: Vergleichbarkeit       | F118: in der Vergleichsansicht nur Ziel editierbar                    | Ist bleibt außerhalb der Vergleichsansicht editierbar |

### 1b · Echte Widersprüche und Lücken, die eine Entscheidung brauchen

→ Diese stehen vollständig in [OFFENE_ENTSCHEIDUNGEN.md](OFFENE_ENTSCHEIDUNGEN.md). Die schwerwiegendsten sind:

1. **Zeitachse bei stationsübergreifenden Vorgängern (F62, P3).** In einer Fließlinie läuft eine vorgelagerte Station im vorherigen Takt. Ein Vorgänger an einer _vorgelagerten_ Station ist also erfüllt und darf keine Wartezeit erzeugen. Ein Vorgänger an einer _nachgelagerten_ Station ist dagegen eine Verletzung. Die physische Reihenfolge der Stationen ist aber **nirgends definiert**: F32 sortiert alphabetisch und sagt ausdrücklich „nicht die physische Abfolge“. Zusätzlich gibt es Vormontagen parallel zur Hauptlinie (Basis 04). Ohne Klärung ist weder die Wartezeit noch die Verletzungsprüfung bei stationsübergreifenden Vorgängern eindeutig berechenbar.
2. **Wie entsteht ein zweites Szenario derselben Variante?** F24 erlaubt mehrere Szenarien, F29 verbietet das Anlegen von Schritten in der App, F83 verbietet die „automatische Übernahme aus einem bestehenden Szenario“, und F88 nimmt den Dateinamen als Varianten- _und_ Szenarionamen. Unklar ist damit: (a) ob „Szenario duplizieren“ erlaubt ist (für Ist/Ziel praktisch nötig), (b) ob ein erneuter Import derselben Datei zur bestehenden Variante oder zu einer neuen Variante gehört, (c) was gilt, wenn ein Re-Import andere IDs oder Zeiten enthält. Das widerspricht dem Hinweis im Datenmodell „dieselbe importierte Zeit in allen Szenarien“.
3. **Station mit Mitarbeiter-Lanes oder gestapelter Balken.** F2/F14 verlangen gestapelte Schritte je Station, F90 eine Höhe gleich dem längsten Mitarbeiter, F70 „parallel nicht künstlich nacheinander“. Ein klassisch gestapelter Stationsbalken summiert die Arbeit aller Mitarbeiter und liefert damit die **falsche Höhe**. Korrekt wäre eine Stationsspalte mit nebeneinanderliegenden Mitarbeiter-Lanes. Dann muss aber geklärt werden, worin sich Stations- und Mitarbeiteransicht (F7/F102) unterscheiden.
4. **Bearbeitungsreihenfolge je Mitarbeiter.** `Reihenfolge` ist Pflicht (F30), laut F70 wird die Reihenfolge jedoch aus Vorgängern und Belegung _abgeleitet_. Das betrifft direkt die Berechnung der Wartezeiten.
5. **Strenge Validierung (F81/F84/F86) und Prototyp mit der echten XT-686-EF-Datei (F131).** Die echte Datei hat leere IDs und mehrere Zeitspalten, und Excel-Formelzellen liefern meist mehr als zwei Nachkommastellen. Außerdem ist die Datei nicht im ZIP enthalten.
6. **Hash-Route `/#/join/CODE` (Referenz-SPA) und Next.js App Router.** Technisch lösbar, siehe Phase 2. Das Fragment wird bewusst beibehalten, weil es nicht an Server oder Logs übertragen wird (Prüfpunkt 8).
7. **Datenmodell-Vorschlag mit `owner_email` und `email`.** Prüfpunkt 5 verlangt eine sichere Zuordnung zum verifizierten Auth-Nutzer. Deshalb wird `user_id` (auth.uid) der Schlüssel und die E-Mail nur Anzeige.
8. **Kategorien: Geltungsbereich.** Das Datenmodell sieht sie projektweit (`project_id`), F76/F65 sehen sie je Szenario (inklusive Undo).

---

## 2 · Offene Entscheidungen

Siehe [OFFENE_ENTSCHEIDUNGEN.md](OFFENE_ENTSCHEIDUNGEN.md) (E1–E33, inklusive Rechenbeispiel zur Freigabe). Dort wird der Entscheidungsstatus gepflegt.

---

## 3 · Architektur

### Technik

- **Next.js (App Router), TypeScript strict, Tailwind, shadcn/ui** im NEONEX-Theme.
- **Supabase** in der EU-Region Frankfurt: Auth (Magic-Link PKCE), Postgres, RLS. Anbindung über `@supabase/ssr`, mit Session-Refresh in Middleware bzw. Proxy.
- **Client-State:** Zustand-Store je aktivem Szenario mit Command-Pattern für Undo/Redo, dazu eine eigene Sync-Engine (Outbox).
- **Drag-and-drop:** `@dnd-kit`. **Diagramm:** eigene DOM/SVG-Komponenten, keine Chart-Bibliothek, weil segmentgenaues DnD, Wartesegmente und Lanes mit Recharts und ähnlichen Bibliotheken nicht sauber umsetzbar sind.
- **Excel:** `exceljs` für Lesen (im Browser) und Schreiben. Die SheetJS-Version auf npm ist veraltet.
- **Validierung:** `zod`. **Tests:** Vitest plus `fast-check` (Rechenkern), pgTAP über `supabase test db` (RLS), Playwright (E2E).
- **Datenfluss für EU und Minimierung:** Excel wird im Browser geparst und direkt über RPC an Supabase übertragen. Vercel liefert vor allem die App aus und verarbeitet möglichst keine Produktionsdaten.

### Projektstruktur

```
linebalancing/                     # Repo AUSSERHALB von OneDrive empfohlen (node_modules/Sync)
├─ docs/                           # Spezifikation (kopiert), OFFENE_ENTSCHEIDUNGEN.md, RECHENREGELN.md, BETRIEB.md
├─ supabase/
│  ├─ migrations/                  # 001_auth_projects, 002_scenario_data, 003_functions, 004_locks …
│  ├─ tests/                       # pgTAP: RLS-Matrix je Rolle × Tabelle × Operation
│  └─ seed.sql                     # nur lokal
├─ src/
│  ├─ app/
│  │  ├─ login/  auth/callback/    # Magic-Link, PKCE-Exchange
│  │  ├─ join/                     # liest #CODE client-seitig, entfernt ihn aus der URL
│  │  └─ (app)/projects/
│  │     ├─ page.tsx               # Projektauswahl (E25), Projekt anlegen (Staff)
│  │     └─ [projectId]/
│  │        ├─ layout.tsx          # Mitgliedschafts-Gate
│  │        ├─ page.tsx            # Varianten & Szenarien
│  │        ├─ import/             # Import-Wizard
│  │        ├─ workspace/          # Yamazumi, ?ist=&ziel=&compare=1
│  │        └─ settings/           # Code, Mitglieder, Projekt löschen (Owner)
│  ├─ domain/                      # REIN: kein React, kein Supabase
│  │  ├─ model/                    # Typen: Scenario, Station, Employee, Step, Predecessor, Category
│  │  ├─ calc/                     # schedule.ts, occupancy.ts, allowance.ts, kpis.ts, rounding.ts
│  │  ├─ checks/                   # cycles.ts, predecessorViolations.ts, completeness.ts
│  │  ├─ import/                   # parseWorkbook.ts, germanNumber.ts, validateRows.ts, filename.ts
│  │  ├─ export/                   # excelExport.ts, chartExport.ts
│  │  ├─ compare/                  # matchStations.ts (Label), diffSteps.ts (externe ID)
│  │  └─ ops/                      # Operationen + Inverse (Undo), apply.ts
│  ├─ data/                        # supabase client/server, repositories, sync/outbox.ts, sync/lock.ts
│  ├─ features/
│  │  ├─ auth/  projects/  import/
│  │  ├─ yamazumi/                 # Chart, StationColumn, EmployeeLane, StepSegment, WaitSegment, TaktLine, Axis, DnD
│  │  ├─ workspace/                # Toolbar, ScenarioTabs, KpiBar, FilterBar, DetailPanel, ConflictPanel, SyncStatus
│  │  └─ compare/
│  ├─ components/ui/               # shadcn
│  └─ lib/                         # de-DE-Formatierung, utils
└─ tests/e2e/
```

### Datenbank (Vorschlag; Feldnamen sind technisch)

- `staff_domains(domain)`, `projects(id, name, owner_id, …)`, `project_members(project_id, user_id, role owner|editor, joined_via)`
- `project_codes(project_id, code_hash, created_at)`: **kein SELECT-Grant**, nur über Funktionen erreichbar
- `member_sessions(project_id, user_id, auth_session_id, verified_at)`: setzt **„Code bei jeder Anmeldung“** serverseitig durch (Prüfpunkt 1/A3). RLS prüft `auth.jwt()->>'session_id'`. Nach dem Logout wird für die neue Sitzung wieder der Code verlangt. Owner und Staff sind ausgenommen.
- `code_attempts(user_id, at, success)`: Rate-Limit (E28)
- `variants`, `scenarios(takt_min, allowance_pct, version, updated_at, updated_by)`, `scenario_locks(scenario_id, holder_user_id, holder_session, expires_at)`
- `stations(scenario_id, label)`, `employees(station_id, label)`
- `steps(scenario_id, external_step_id, description, time_min, sequence, imported_station_label, imported_employee_label, station_id, employee_id NULL, category_id, updated_at, updated_by)`, mit `UNIQUE(scenario_id, external_step_id)`
- `step_predecessors(scenario_id, step_id, predecessor_step_id)`, `categories(...)` (Geltungsbereich nach E11)
- Jede Tabelle trägt `project_id` (denormalisiert), damit die RLS-Prüfung einfach und schnell bleibt.

**Unveränderlichkeit (F17):** `REVOKE UPDATE ON steps`, dann nur `GRANT UPDATE(station_id, employee_id, category_id, sequence)`. Zusätzlich ein `BEFORE UPDATE`-Trigger, der jede Änderung an `time_min`, `external_step_id` und `scenario_id` ablehnt. Das gilt auch für `security definer`-Funktionen. Ein pgTAP-Test beweist es.

**Schreibpfad:** Direktes INSERT, UPDATE und DELETE auf Szenariodaten ist für `authenticated` gesperrt. Alle Änderungen laufen über `apply_scenario_ops(scenario_id, expected_version, ops jsonb)`. Die Funktion prüft Mitgliedschaft und Sitzung, **gültige Sperre des Aufrufers** (F51/F58) und `version`. Sie wendet atomar an, erhöht `version` und setzt `updated_by` (F38). Der Import läuft über `import_scenario(...)`, das **serverseitig erneut validiert** (Zeit > 0, IDs eindeutig, Zyklen, Station vorhanden).

---

## 4 · Phasen (klein, aufeinander aufbauend)

Jede Phase endet mit grünen Tests und einem Demo-Stand.

### Phase 0 – Fundament

- Repo außerhalb von OneDrive anlegen, Git, Next.js, Tailwind, shadcn, ESLint/Prettier, Vitest, Playwright, CI (Lint, Typecheck, Test).
- Supabase-Projekt (EU) und lokale Supabase-CLI, Env-Handling (Service-Role-Key nie im Client und nie mit `NEXT_PUBLIC_`).
- `docs/OFFENE_ENTSCHEIDUNGEN.md` aus Abschnitt 2 erstellen, NEONEX-Theme-Tokens (E30).
- **Anforderungen:** Basis 22/24, F41 (Übergabefähigkeit von Anfang an), F46.

### Phase 1 – Rechenkern (rein, testgetrieben)

- Domain-Typen. `schedule()`: Planung je Mitarbeiter nach E1/E3/E5 mit Start- und Endzeiten, Wartesegmenten und Konflikten (Deadlock, Vorgängerverletzung). `occupancy()`, `allowance()` (parametrisiert nach E2), `kpis()` (Stationsbelegung, Personalauslastung nach F108, MA-Anzahl, Gesamtarbeitsinhalt, Unvollständigkeit), `checks/` (Zyklen, unbekannte IDs, Selbstverweise, stationsübergreifende Verletzungen), Rundung nur in der Ausgabe (P2).
- **Property-Tests (fast-check):** Importzeiten bleiben unverändert. Ein Mitarbeiter hat keine überlappenden Schritte (F55). Start ≥ Ende aller (zugeordneten) Vorgänger. Wartezeit ≥ 0. Belegung = produktiv + Wartezeit. Stationshöhe = max. Belegung, Wartezeit nicht doppelt gezählt (F90). Nicht zugeordnete Schritte beeinflussen keine KPI (F109). Das Ergebnis ist unabhängig von der Eingabereihenfolge der Arrays.
- **Golden-Tests:** Das Rechenbeispiel aus Abschnitt 2 plus die Sollwerte der Arbeitsvorbereitung (E7).
- **Anforderungen:** F6, F13, F44, F50 (Berechnung), F54, F55, F56/F90, F57/F60/P1, F62, F63/F66, F70 (Ablaufreihenfolge), F107/F108, F109/F117/P4, P2, P3.

### Phase 2 – Datenbank, Auth und RLS (analog Workshop Hub)

- Migrationen wie oben. Funktionen: `create_project` (nur Staff-Domains), `redeem_project_code` (Rate-Limit, ergibt Editor plus `member_sessions`), `rotate_code` (entzieht allen Code-Mitgliedern die Mitgliedschaft), `get_project_code` (nur Owner), `remove_member` (Owner), `leave_project`, `delete_project` (Owner, Bestätigung durch Eingabe des Projektnamens, F40).
- RLS für SELECT, INSERT, UPDATE und DELETE auf **allen** Tabellen. Die pgTAP-Matrix prüft Owner, Editor, Nicht-Mitglied, Editor ohne Code-Sitzung und anonym.
- Frontend: Login mit E-Mail und Code, `/auth/callback` (PKCE, gleicher Browser), `/join#CODE` mit Vorbelegung, wobei der Code nach Einlösung per `history.replaceState` entfernt wird. Gate, Projektliste und Projektwechsel, Logout, Erhalt von Sitzung und aktivem Projekt nach Reload. Der lokale Dev-Modus ist nur hinter einem Env-Flag aktiv und im Build für Produktion ausgeschlossen.
- **Anforderungen:** Basis 21/23/25, F39, F40 (Grundgerüst), A1/A3, Prüfpunkte 1–5 und 8, E25.

### Phase 3 – Excel-Import

- Template-Download mit den Blättern `Arbeitsgänge` und `Ausfüllanleitung` (F89). Den Template-Entwurf zur Freigabe vorlegen (E23).
- Parser: deutsches Komma sowie numerische Zellen (F80), Prüfung auf zwei Nachkommastellen (F84/E21), Zeit > 0 (F85), Station Pflicht (F86), IDs eindeutig je Variante (F69), Vorgänger mit `;` (F74), Zyklen, Selbstverweise und unbekannte IDs (F79/F87), MA optional mit Warnung (F78), MA-Anzahl je Station ableiten (F82), Dateiname als Name (F88).
- Vorschau-Tabelle mit Zeilen- und Feldbezug, Inline-Korrektur, erneute Prüfung und Übernahme erst ohne blockierende Fehler (F31/F79/F81/F87).
- `import_scenario`-RPC mit serverseitiger Neuvalidierung. Jeder Import erzeugt ein neues Szenario (F22/F83), Hierarchie nach E20.
- **Anforderungen:** Basis 05–08/12, F12 (Import), F14, F18–F20, F22, F29, F30, F31, F68, F69, F72–F89, F131 (nach E24).

### Phase 4 – Yamazumi lesend

- Horizontal scrollbare Fläche, Stationen sortiert (F32/E14), sticky Stationsköpfe, Zeitachse und Taktlinie mit Wert (F91/F94), MA-Anzahl unter der Station (F105).
- Stationsansicht und Mitarbeiteransicht (F7/F92/F102/E9), Wartesegmente optisch eigenständig (F63/F66/F97), nicht zugeordnete Schritte in Warnfarbe (F67/E10), Überlast rot (F3/F106).
- Separate Regler für Breite und Skala (F98), konfigurierbare Segmentlabels (F71), Tooltip (F99).
- KPI-Leiste mit Szenarioname plus 3–4 Haupt-KPIs, weitere aufklappbar und konfigurierbar (F10/F101/F124/F130), Unvollständigkeitshinweis (P4).
- Detailpanel als Overlay rechts, Zeit schreibgeschützt (F33/F123/F126). Layout: Navigation, dann Filter und KPIs, dann Diagramm (F120).
- **Anforderungen:** Basis 14/16, F2, F3, F7, F10, F32, F33 (lesend), F63, F66, F67, F70 (Darstellung), F71, F91, F92, F94, F97–F99, F101, F102, F105, F106, F120, F123, F124, F126, F130.

### Phase 5 – Bearbeiten, Sperre, Autosave

- Szenariosperre: Erwerb beim Öffnen zur Bearbeitung, Heartbeat-Lease, Freigabe beim Verlassen (`pagehide` plus explizit), Ablauf serverseitig (F58/F64/E27). Ein zweiter Nutzer wird gewarnt und schreibgeschützt (F51).
- Operationen: Station wechseln, wodurch der MA entfernt wird (F61/F95), MA zuweisen (F100), Vorgänger bearbeiten (F12), Reihenfolge (E3), Kategorie und Farbe (F27/F93/F97), Takt (F59), Zuschlag mit Validierung (F60).
- DnD zwischen Stationen ohne Dialog. Beim Ziehen werden alle Ziele markiert, Ziele mit Restriktionsproblemen gesondert (F28/F95/F129). Sofortige Neuberechnung (F11/F50).
- Konfliktübersicht und Kennzeichnung „Szenario konfliktbehaftet“ (F8/F15). Keine UI zum Anlegen von Stationen oder Schritten (F29).
- Autosave über `apply_scenario_ops` mit Versionsprüfung (F25). Statussymbole gespeichert, ausstehend, Fehler, gesperrt (F119). Letzte Änderung mit Bearbeiter (F38).
- **Anforderungen:** Basis 10/11/15/19/20, F1, F8, F11, F12, F15, F17 (UI), F23, F25, F27, F28, F48, F50, F51, F58, F59, F60, F61, F64, F93, F95, F97, F100, F119, F127, F129.

### Phase 6 – Undo/Redo und Offline-Robustheit

- Command-Stack je Szenario (F26/F65 inklusive Kategorie, Takt und Zuschlag; Geltung nach E17). Undo erzeugt Inverse-Operationen, die normal gespeichert werden.
- Outbox in IndexedDB: Änderungen als „ausstehend“ markieren, Retry mit Backoff. Erfolg wird erst nach Serverbestätigung angezeigt (F37). Bei Versions- oder Sperrkonflikt wird **nicht überschrieben**: Die Änderung bleibt ungesendet und der Nutzer wird informiert (F51/F37).
- **Anforderungen:** F26, F37, F65, F119.

### Phase 7 – Szenarien und Vergleich

- Szenarioliste je Variante, Umbenennen (F24), ggf. Duplizieren (E20). Ist- und Ziel-Reiter mit je einem Dropdown, gleiche Auswahl erlaubt und sichtbar gekennzeichnet (F103/F110/F114/F115).
- Vergleichsansicht über einen Button (F122): zwei Diagramme, gemeinsame Skala über max. Höhe und beide Taktlinien (F112), synchrones horizontales Scrollen (F104), Abgleich der Stationen über die Bezeichnung mit leeren Lücken (F111), Verschiebungsfarbe plus Symbol (F113/F116), Ist schreibgeschützt und Ziel editierbar (F118). Es wird nur das aktiv bearbeitete Szenario gesperrt.
- **Anforderungen:** Basis 17, F5, F24, F48, F49, F103, F104, F110–F118, F122.

### Phase 8 – Suche, Filter, Vollbild, Responsiv

- Suche nach ID und Beschreibung, kombinierte Filter (Station, MA, Kategorie), aktive Filter als Chips mit Zurücksetzen (F96/F121). Gefilterte Ansicht deutlich gekennzeichnet, KPI-Bezug nach E8 (F128).
- Vollbild mit ausblendbaren Bedienelementen und KPIs (F34). Layouts für Laptop, Desktop und Workshop-Bildschirm (F125).
- **Anforderungen:** F34, F96, F121, F125, F128.

### Phase 9 – Export

- Excel-Export mit aktualisierten Stations- und MA-Zuordnungen, Zeiten unverändert (F35/E19).
- Diagrammexport als PNG und/oder PDF mit Stationsbezeichnungen und numerischer Taktlinie (F45/F52/E18).
- **Anforderungen:** Basis 18, F35 (MVP-Teil), F45, F52.

### Phase 10 – Härtung, Betrieb, Abnahme

- Performance-Test mit 20 Stationen und 500 Schritten (F36/E32). Sicherheitsreview (RLS-Matrix, Code-Brute-Force, Sitzungen, E-Mail-Wechsel; Prüfpunkte 3–5). Produktiver SMTP-Versand.
- EU-Datenflüsse dokumentieren (E29), Lösch- und Backupkonzept (E26). `BETRIEB.md` mit Übergabe, Geheimnissen, Migration und Datenexport (F41).
- Praxistest und Freigabe durch die Arbeitsvorbereitung anhand von `03_TESTS.md` als Abnahmeprotokoll (F47/F53/P5).
- **Anforderungen:** Basis 26/27, F36, F40 (Endausbau), F41, F47, F53, P5, Sicherheitsprüfpunkte 1–8.

### Später (nicht MVP)

F4/F9/F16/F43 (Verschiebungsvorschläge), F35 PDF-Bericht, komplexe Ressourcenabhängigkeiten (F44), Revisionshistorie (A6).

---

## 5 · Zuordnung der Abnahmecheckliste (03_TESTS) zu den Phasen

| Block in 03_TESTS                     | Phase                                    |
| ------------------------------------- | ---------------------------------------- |
| Excel-Import                          | 3                                        |
| Berechnung                            | 1 (Logik), 4 (Anzeige)                   |
| Yamazumi und Workshop-Bedienung       | 4, 5, 8                                  |
| Szenarien und Vergleich               | 5, 6, 7                                  |
| Benutzer, Sicherheit, Datenintegrität | 2, 5, 10                                 |
| Export und Pilot-Freigabe             | 9, 10                                    |
| „Vor Abnahme explizit entscheiden“    | E2, E7, E27, vor Ende von Phase 1 bzw. 5 |

## 6 · Verifikation

- `npm run test`: Vitest (Rechenkern mit Golden- und Property-Tests, Import-Validierung, Ops/Undo).
- `supabase test db`: pgTAP-RLS-Matrix, Unveränderlichkeit von `time_min`, Sperr- und Versionsprüfung in `apply_scenario_ops`, Rate-Limit.
- `npx playwright test`: Login-Flow (lokal mit Inbucket/Mailpit), Import mit Fehlervorschau, DnD mit anschließender Neuberechnung, zweiter Browser-Kontext wird durch die Sperre blockiert, Offline-Simulation mit Outbox, Vergleichsansicht, Exporte.
- Manuelle Abnahme mit der Arbeitsvorbereitung anhand von `03_TESTS.md`.

## 7 · Nächster Schritt nach Freigabe

Phase 0 umsetzen und parallel die Rechenkern-Entscheidungen **E1–E7** sowie den Zugang zur Referenz (**E31**) klären, weil sie Phase 1 und 2 blockieren.
