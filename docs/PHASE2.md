# Phase 2 – Datenbank, Anmeldung und Projektzugang

Stand: 26.10.2026. Gemeinsame Übergabe für Codex und Claude. Verbindlich bleiben die Spezifikation und `AGENTS.md`.

## Umsetzung

- Supabase SSR-Clients mit Publishable Key, PKCE-Magic-Link, Callback und Next.js-Proxy zur Sitzungserneuerung. Server prüft die Identität mit `getUser()`; keine Autorisierung anhand ungeprüfter Sitzungsdaten. SDK-Zeitprüfungen erst bei der echten Anfrage (`connection()`), nicht im Next.js-Prefetch-Prerendering.
- Geschützte Szenario-, Import- und Tabellenseiten; Projektauswahl, aktives Projekt über HttpOnly-Cookie, Projektwechsel und Abmeldung. Vollständige Navigation nach Projekt-/Auth-Wechsel verwirft auch versteckte Seiten des bisherigen Projekts.
- Firmendomain `neonex.de` wurde vom Nutzer ausdrücklich freigegeben. Nur bestätigte Firmenadressen können Projekte erstellen. Staff kann eigene Projekte ohne Code öffnen; kein pauschaler Zugriff auf fremde Projekte.
- Genau ein Owner je Projekt. Owner verwaltet Code und Mitglieder und löscht das gesamte Projekt erst nach exakter Namensbestätigung. Mitglieder können beitreten, bearbeiten und austreten.
- Einladung `/#/join/CODE` und `/join#CODE`. Fragment wird vor einem gestreamten Login-Redirect aus der URL entfernt und nur im aktuellen Tab zwischengespeichert. Code wird nach Anmeldung ausdrücklich eingelöst und bei Erfolg aus dem Tab entfernt.
- Jede neue Editor-Anmeldesitzung muss den Code erneut einlösen. Datenbank vergleicht Nutzer-ID, Auth-Sitzungs-ID und aktuelle bestätigte E-Mail. E-Mail-Wechsel erfordert erneutes Einlösen.
- Fünf fehlgeschlagene Codeversuche pro Nutzer innerhalb von 15 Minuten sperren weitere Versuche. Fehlversuche werden gespeichert, parallele Versuche serialisiert. Code-Rotation entfernt alle über Code beigetretenen Mitgliedschaften samt Code-Sitzungen.
- Code-Tabellen nicht direkt lesbar. Hash plus verschlüsselte Owner-Abrufkopie; Schlüssel in privater, nicht zugänglicher Tabelle. Klartextabruf nur über Owner-Funktion.
- Normalisierte Tabellen für Projekte, Mitglieder, Sitzungen, Varianten, Szenarien, Stationen, Mitarbeiter, Kategorien, Schritte und Vorgänger. RLS für alle öffentlichen Tabellen; ausschließlich projektbezogene Leserechte. Direkte Schreibrechte entzogen.
- Schreiben über geprüfte Import-/Speicher-RPCs. Datenbank prüft Zuordnungen, positive Zeiten mit zwei Nachkommastellen, IDs, Vorgänger und Kreise. Trigger und RPC verhindern Änderungen importierter ID, Beschreibung und Zeit. Nach Import keine neuen Schritte/Stationen in bestehenden Szenarien.
- Cloud-Repository für die vorhandenen Ansichten. Autosaves laufen seriell mit bestätigter Version. Versionskonflikt stoppt weitere Saves bis zum Neuladen; kein stilles Überschreiben. Letzte Änderung mit Bearbeiteranzeige.
- Bisherige IndexedDB-Daten bleiben erhalten. Übernahme nur nach ausdrücklicher Bestätigung in das ausgewählte Projekt; Wiederholung überspringt bereits übernommene IDs. Keine automatische Übernahme.

## Dateien und Datenbankstand

Migration: `supabase/migrations/202610260001_phase2.sql`. Am 26.10.2026 mit `npm.cmd run db:migrate` erfolgreich auf das konfigurierte Frankfurt-Projekt angewendet. Keine bestehenden Anwendungstabellen gelöscht.

Auth-/Projektoberfläche unter `src/features/auth/` und `src/features/projects/`; Datenzugriff unter `src/data/`; Callback und geschützte APIs unter `src/app/`; Sitzungserneuerung in `src/proxy.ts`.

Die Datenbanktests verwenden Node/pg mit echten Rollen und SQL-Assertions anstelle des ursprünglich geplanten pgTAP. Sie laufen in einer vollständig zurückgerollten Transaktion; remote nur mit TLS samt CA- und Hostprüfung. Öffentliches CA-Zertifikat: `supabase/certs/prod-ca-2021.crt`, bezogen von `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`. Kein privater Schlüssel.

## Prüfbefunde

- 106 Unit-Tests in 17 Dateien bestanden; einschließlich sicherer Redirect-Ziele und serieller Autosaves bei Versionskonflikten.
- 28 Datenbanktests bestanden: Owner/Editor/Nichtmitglied/anonym, komplette Lese-/Schreibmatrix aller Projekttabellen, Sitzungserneuerung, E-Mail-Wechsel, unbestätigte Nutzer, Code-Rotation, Fehlversuche, Importvalidierung und Unveränderlichkeit.
- Sechs bestehende UI-Regressionen bestanden.
- Fünf Tests gegen den Produktionsbuild bestanden: kein Dev-Bypass, geschützte Seiten, Einladung, Callback, API-Ursprung/Anmeldung und abgefangene PKCE-Magic-Link-Anfrage.
- Zwei echte Cloud-Browsertests bestanden: Projektanlage durch Owner, Excel-Import, Duplizieren, Neuladen, Code-Beitritt, Editor-Änderung mit Bearbeiteranzeige, erneute Codepflicht nach frischer Anmeldung und Abmeldung. Temporäre Konten und Projekte im Cleanup entfernt.
- Lint, TypeScript, Formatcheck und Produktionsbuild bestanden. Insgesamt 13 Browserprüfungen bestanden.
- CI enthält zusätzlich eine lokale Docker-Supabase für Datenbanktests. Die CI selbst wurde noch nicht auf GitHub ausgeführt.

## Lokal entwickeln und prüfen

`npm run dev` nutzt standardmäßig die echte Anmeldung und Cloud-Ablage. Für reine UI-Entwicklung in PowerShell vor dem Start `$env:LINEBALANCING_LOCAL_DEV='1'` setzen. Dieser Modus funktioniert ausschließlich mit `NODE_ENV=development`; in Produktion ist das Flag wirkungslos. Die echte `.env.local` enthält weiterhin nur die vier benötigten Supabase-Werte.

`npm run e2e` startet die UI-Regressionen isoliert auf Port 3200 und mit eigenem Next-Verzeichnis `.next-e2e`. `npm run build` und danach `npm run e2e:auth` prüfen den echten Produktionszugang auf Port 3100. `npm run e2e:cloud` ist ein expliziter Integrationstest mit temporären Auth-Testkonten und eigenem Testprojekt auf dem konfigurierten Supabase-Projekt. Keine E-Mails werden verschickt; Testkonten und Testprojekt werden im Cleanup entfernt.

`npm run db:test:remote` prüft das Schema in einer Rollback-Transaktion. `npm run db:migrate:preview` zeigt ausstehende Migrationen; `npm run db:migrate` wendet sie an. Keine Datenbank-URL als manuell zusammengesetztes Shellargument verwenden.

## Dashboard-Konfiguration und offene Folgearbeiten

Für echte Magic-Links unter Authentication / URL Configuration die richtige Site URL und Callback-Freigabe prüfen: lokal `http://localhost:3000/auth/callback` sowie später die tatsächliche Deployment-URL mit `/auth/callback`. Diese Management-Einstellungen sind mit Publishable Key und DB-URL nicht änderbar. Kein echter Anmeldelink wurde ohne ausdrücklichen Auftrag verschickt; Zustellung und PKCE im Postfach sind noch manuell abzunehmen. SMTP für produktiven Versand gehört zur offenen Betriebsentscheidung E29.

Szenariosperre mit Lease/Heartbeat (Phase 5/E27) ist nicht vorweggenommen. Versionsschutz verhindert stille Überschreibungen, ersetzt aber keine Bearbeitungssperre. Persistente Offline-Outbox und Wiederanlauf (Phase 6/E17) bleiben offen. Löschen einzelner Cloud-Szenarien ist bis E26 nicht freigegeben; der Button wird im Cloud-Modus nicht angeboten. Projektlöschung durch Owner ist gemäß Phase 2 umgesetzt. Export und weitere Betriebs-/Abnahmefragen bleiben offen.

## Abschlussprüfung

- Live-Schema nochmals mit allen 28 Datenbanktests geprüft; Testtransaktion zurückgerollt.
- Migrationsvorschau meldet: Datenbank aktuell, keine ausstehenden Migrationen.
- Formatcheck und Git-Diff-Prüfung ohne Fehler.
- Rein lesende Cleanup-Kontrolle: 0 temporäre Cloud-Testkonten und 0 temporäre Cloud-Testprojekte verblieben.
- Änderungen liegen im Arbeitsverzeichnis; kein Commit, Push oder Vercel-Deployment ausgeführt. Ein echtes Postfach-/Magic-Link-Szenario und die Dashboard-Callback-Freigabe sind noch manuell abzunehmen.

## Rückmeldung aus dem ersten manuellen Test (26.10.2026)

Nutzer meldet nach der Einrichtung: „scheint zu funktionieren“. Erster manueller Funktionseindruck positiv. Welche Anmelde-, Postfach- und Projektabläufe dabei einzeln geprüft wurden, wurde nicht näher beschrieben; eine vollständige fachliche Abnahme ist damit nicht dokumentiert. Die oben genannten offenen Folgearbeiten bleiben bestehen.

## Review durch Claude (26.10.2026)

Phase 2 wurde als Commit `0aa5449` gesichert und gepusht. Befunde und Korrekturen:

- **Kreisprüfung exponentiell.** Die rekursive Pfadsuche in `write_scenario` brauchte bei 30 Schritten mit je zwei Vorgängern 14 s, bei 40 Schritten über 20 s (gemessen rein lesend auf Frankfurt). Supabase bricht Anfragen von `authenticated` nach rund 8 s ab; vernetzte Szenarien wären weder importier- noch speicherbar gewesen. Neu: Erreichbarkeit über `union` (höchstens n² Paare), 200 Schritte mit je zwei Vorgängern deutlich unter 1 s.
- **Firmenadressen ohne Code in fremden Projekten.** `can_access_project` ließ Staff jedes Projekt, dem sie einmal per Code beigetreten waren, ohne erneuten Code öffnen. Laut 01_ANFORDERUNGEN gilt das nur für eigene Projekte als Owner. `or public.is_staff()` entfernt; Owner sind über ihre Rolle abgedeckt.
- **Codefeld im Login wirkungslos.** Der Magic-Link öffnet meist einen neuen Tab; der tablokal gespeicherte Code fehlte dort. Das Feld wurde entfernt; bei erkannter Einladung erscheint ein Hinweis. Der Code wird nach der Anmeldung auf der Projektseite eingegeben (im selben Tab vorbelegt).
- Zeichenfehler „Lade Projekte ?“ behoben.

Beide Datenbankkorrekturen stehen in `supabase/migrations/202610260002_review_fixes.sql`. `db-test.mjs` spielt ausstehende Migrationen jetzt in der Testtransaktion ein, sodass sie vor `db:migrate` geprüft werden. Zwei neue Tests (vernetzte Vorgänger, Codepflicht für Staff-Editoren): 30 Datenbanktests bestanden; Gegenprobe ohne `…0002` scheitert erwartungsgemäß mit Zeitüberschreitung. Lint, TypeScript, Format, 106 Unit-Tests, Produktionsbuild und 5 Auth-Browsertests bestanden.

`…0002` wurde am 26.10.2026 vom Nutzer per `npm run db:migrate` auf Frankfurt angewendet; Migrationsvorschau meldet „up to date“, alle 30 Datenbanktests gegen das Live-Schema bestanden.

CI war seit Phase 0 rot: `tsc` lief vor dem Build ohne die generierten Next.js-Typen (`LayoutProps`). `typecheck` ruft jetzt zuerst `next typegen` auf. Erster vollständig grüner CI-Lauf (check, e2e, database) mit Commit `21d31e7`. GitHub-CLI ist installiert und angemeldet.

Zur Kenntnis ohne Korrektur: Nach jedem Speicherfehler (auch Netzwerkaussetzer) ruht das Autosave bis zum Neuladen, ungespeicherte Änderungen gehen dabei verloren (Phase 6). `scenarios.updated_by` und `projects.owner_id` verweisen ohne `on delete` auf `auth.users`; Nutzer mit Änderungen sind damit nicht löschbar (E26).

## Nachtrag Personalplanung (26.10.2026)

Die zuvor als ausstehend bezeichnete Review-Migration …0002 ist inzwischen in Frankfurt als angewendet verifiziert. Ebenso ist Migration …0003 (Personalplanung) angewendet. Die Referenz aus Personalplanung 1.1.xlsx wurde in das vorhandene Projekt EURA Mobil importiert; kein Nutzer wurde imitiert. Aktuelle Details und Prüfungen: [PERSONALPLANUNG.md](PERSONALPLANUNG.md).
