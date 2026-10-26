# Prüfcheckliste je Bereich

Inhalt: 1 Architektur · 2 Rechenkern · 3 Datenbank und RLS · 4 Auth und Projektzugang · 5 Datenzugriff und Speichern · 6 Oberfläche · 7 Import und Konverter · 8 Tests und CI · 9 Sicherheit und Betrieb · 10 Dokumentation

Jeder Abschnitt nennt **wo** du suchst, **was** du prüfst und **bekannte Fehlerarten** aus der Geschichte dieses Projekts. Die bekannten Fehler sind behoben – sie zeigen, an welchen Stellen ähnliche Fehler wahrscheinlich sind.

---

## 1 · Architektur und Struktur

**Wo:** `src/domain/` (reine Fachlogik), `src/data/` (Ablage, Supabase-Clients), `src/features/` (UI je Funktion), `src/app/` (Routen, API, Proxy), `scripts/`, `supabase/migrations/`.

**Prüfen**

- `src/domain/` importiert weder React noch Supabase noch Next (`grep -rn "from \"react\|@supabase\|next/" src/domain`). Rechenlogik gehört nur dorthin (AGENTS.md).
- Keine Fachlogik in Komponenten, die der Rechenkern schon kennt (doppelte Berechnung = zwei Wahrheiten).
- Next.js 16 weicht von älterem Wissen ab: Vor Urteilen über Routing, Caching, `proxy.ts`, `cacheComponents`, `connection()` die Doku unter `node_modules/next/dist/docs/` lesen.
- Toter Code, verwaiste Dateien, Funktionen mit nur noch einer Hälfte (z. B. alte Browser-Ablage neben Cloud-Ablage).

## 2 · Rechenkern

**Wo:** `src/domain/calc/` (schedule, evaluate, rounding, tolerance), `src/domain/model/`, `src/domain/ops/`, `src/domain/checks/`. Maßstab: `docs/RECHENREGELN.md` inkl. Abschnitt 6a (Mitarbeiter an mehreren Stationen, E40) und Golden-Test E7 in `OFFENE_ENTSCHEIDUNGEN.md`.

**Prüfen**

- Jede Regel in RECHENREGELN hat Code **und** Test. Stichprobe: Regel lesen → Stelle im Code → Test suchen.
- Keine Zwischenrundung; gerundet wird nur in `src/lib/format.ts`/`rounding.ts` (P2, E34). Zeitvergleiche mit Toleranz (`tolerance.ts`).
- Importierte Zeiten werden nie verändert (F17), auch nicht in Operationen.
- Eine Person arbeitet nie zwei Arbeitsgänge gleichzeitig, auch nicht an zwei Stationen (gemeinsame Planung über `personOf`). Ohne Personen an mehreren Stationen muss das Ergebnis der früheren Planung je Station entsprechen (Eigenschaftstest in `evaluate.property.test.ts`).
- Kopfzahl je Station anteilig, im Szenario Personen; Überlast an der Gesamtbelegung.
- Bestandsdaten ohne `personId` rechnen wie früher (jede Spur eigene Person).
- Ergebnis unabhängig von der Reihenfolge der Eingabelisten.

**Bekannte Fehlerarten:** Algorithmen, die bei realistischer Datenmenge explodieren (siehe 3); Annahmen „ein Mitarbeiter gehört zu einer Station“ an Stellen, die vor E40 geschrieben wurden.

## 3 · Datenbank und RLS

**Wo:** `supabase/migrations/*.sql` (in Reihenfolge lesen; spätere `create or replace` überschreiben frühere), `scripts/phase2/db-test.mjs`.

**Prüfen**

- Jede öffentliche Tabelle: RLS an, `revoke all` für `anon`/`authenticated`, Lesen nur projektbezogen über `can_access_project`.
- Schreiben nur über `security definer`-Funktionen mit `set search_path=''`, Zugriffsprüfung am Anfang, `revoke`/`grant execute` gezielt. Neue Funktionen in `public` erhalten bei Supabase standardmäßig EXECUTE – fehlt das `revoke`, ist das ein Befund.
- Regeln der Spezifikation genau so in SQL? Beispiel: Ohne Code dürfen Firmenadressen nur **eigene** Projekte als Owner öffnen (01_ANFORDERUNGEN). Jede Ausnahme in `can_access_project` gegen die Spezifikation halten.
- Rekursive Abfragen (`with recursive`) auf Laufzeit prüfen: Pfadaufzählung mit `union all` und Pfad-Arrays wächst exponentiell. Mit erzeugten Daten **lesend** messen (`generate_series`, `begin read only`, `set local statement_timeout`). Supabase bricht Anfragen von `authenticated` nach rund 8 s ab.
- Unveränderlichkeit (F17) per Trigger **und** RPC; Versionsschutz beim Speichern (40001).
- Migrationsvorschau: Liegen Migrationen im Repo, die live fehlen? Hängt Code davon ab? Dann Befund mit Hinweis, dass der Nutzer `npm.cmd run db:migrate` ausführen muss.
- Datenbanktests decken neue Funktionen und Ausnahmen ab (Rollenmatrix Owner/Editor/Außenstehender/anonym).

**Bekannte Fehlerarten:** exponentielle Kreisprüfung (behoben in `…0002`); `is_staff()` gewährte Zugriff ohne Code auf fremde Projekte (behoben); neue Spalte, die `write_scenario` nicht speichert (Personen-ID, behoben in `…0004`).

## 4 · Auth und Projektzugang

**Wo:** `src/proxy.ts`, `src/data/supabase/`, `src/app/auth/callback`, `src/app/api/`, `src/features/auth/`, `src/features/projects/`, Einladungs-Skript in `src/app/layout.tsx`.

**Prüfen**

- Serverseitig nur `getUser()` als Identität, nie ungeprüfte Sitzungsdaten. Geschützte Seiten über `ProjectGate`.
- API-Routen prüfen Origin und Anmeldung; Weiterleitungsziele über `safeNext`.
- Abläufe über Tab- und Gerätegrenzen durchdenken: Magic-Links öffnen meist einen **neuen Tab**; `sessionStorage` gilt nur im Tab.
- Abmelden beendet auch die Code-Sitzung (`end_project_session`).

**Bekannte Fehlerarten:** Projektcode im Login-Formular ging im neuen Tab verloren (behoben).

## 5 · Datenzugriff und Speichern

**Wo:** `src/data/cloudScenarioRepository.ts`, `scenarioRepository.ts` (`withDefaults`), `scenario-save-queue.ts`, `src/features/workspace/use-scenario-editor.ts`, `src/data/staffingRepository.ts`.

**Prüfen**

- Was die Oberfläche speichert, kommt beim Laden identisch zurück (Rundreise): jedes Feld des Modells in `scenario_document` **und** `write_scenario`.
- Autosave seriell mit bestätigter Version; Konflikt stoppt ohne stilles Überschreiben. Was passiert bei Netzwerkfehler? (Bekannte Lücke bis Phase 6 – Hinweis, kein neuer Befund, solange dokumentiert.)
- `withDefaults` migriert Altbestände verlustfrei und idempotent.
- Keine Erfolgsmeldung vor Serverbestätigung (F37).

## 6 · Oberfläche

**Wo:** `src/features/**`, `src/app/**/page.tsx`, `src/components/`.

**Prüfen**

- Deutsche Texte, deutsches Zahlenformat (`src/lib/format.ts`), keine kaputten Sonderzeichen (z. B. „?“ statt „…“ – `grep -rn "?<\|?\"" src` als grober Suchansatz).
- Kennzahlen im UI aus dem Rechenkern, nicht neu gerechnet; anteilige Kopfzahlen mit `formatHeadcount`.
- Leere, fehlerhafte und unvollständige Zustände (keine Mitarbeiter, nicht zugeordnete Arbeitsgänge, Ladefehler) haben eine verständliche Anzeige.
- Bedienelemente mit `aria-label` dort, wo Tests und Screenreader sie brauchen.
- Bei Zweifeln an der Darstellung: Browsertest mit Screenshot (`testInfo.outputPath`) und Bild ansehen.

## 7 · Import und Konverter

**Wo:** `src/domain/import/`, `src/features/import/`, `scripts/zeitaufnahme/`, Vorlage/Ausfüllanleitung in `src/features/import/workbook.ts`, `docs/IMPORTTEMPLATE.md`.

**Prüfen**

- Validierung blockiert Fehler, warnt bei Unvollständigem (fehlender Mitarbeiter = Warnung).
- Mitarbeiterbezeichnungen linienweit; gleiche Bezeichnung an mehreren Stationen = dieselbe Person (`personId`).
- Ausfüllanleitung, IMPORTTEMPLATE.md und Code sagen dasselbe.
- Konverter-Protokoll beschreibt die tatsächliche Zuordnung.

## 8 · Tests und CI

**Wo:** `src/**/*.test.ts`, `tests/e2e/`, `scripts/phase2/db-test.mjs`, `.github/workflows/ci.yml`, Playwright-Konfigurationen.

**Prüfen**

- CI auf GitHub tatsächlich grün (`gh run list --limit 5`) – nicht nur lokal. Unterschiede lokal/CI (generierte Typen, `.env.local`, Docker-Supabase) erklären.
- Riskante Logik hat Eigenschafts- oder Grenzfalltests; Tests prüfen Verhalten, nicht nur „läuft ohne Fehler“.
- Browsertests decken die Hauptabläufe ab (Import, Bearbeiten, Tabelle, Vergleich, Personalabgleich, Auth).
- Datenbanktests spielen ausstehende Migrationen in der Rollback-Transaktion ein (so werden neue Migrationen vor dem Live-Anwenden geprüft).

**Bekannte Fehlerarten:** CI war seit Phase 0 rot, weil der Typecheck vor `next typegen` lief (behoben); Browsertests, die an alten Beschriftungen hängen.

## 9 · Sicherheit und Betrieb

**Prüfen**

- Kein Service-Role-/Secret-Key im Code, keine Zugangsdaten in Repo, Doku oder Logs (das Prüfskript sucht danach).
- `.env.local` ist ignoriert; `.env.example` ohne Werte.
- Abhängigkeiten: `npm audit --omit=dev` (nur berichten; Updates nur nach Freigabe).
- Offene Betriebsthemen laut Plan (SMTP/E29, Löschkonzept/E26, Szenariosperre/E27) als Hinweise, nicht als neue Befunde.

## 10 · Dokumentation

**Wo:** `README.md`, `AGENTS.md`, `docs/*.md`, `docs/spezifikation/`.

**Prüfen**

- Neue Funktionen haben Anforderung (F-Nummer) und ggf. Entscheidung (E-Nummer); Nummern eindeutig.
- `ENTWICKLUNGSPLAN.md` beschreibt den tatsächlichen Stand (auch: welche Migrationen live sind).
- README-Befehle funktionieren so wie beschrieben.
- Übergabedokumente für Codex (`PHASE2.md`, `PERSONALPLANUNG.md`, `UEBERGABE_CODEX.md`) widersprechen sich nicht.
