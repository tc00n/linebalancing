# Cloud-Einrichtung und gemeinsame Uebergabe

Stand: 26.10.2026. Gemeinsamer Arbeitsstand fuer Codex und Claude; verbindliche Projektregeln stehen in `AGENTS.md`, von `CLAUDE.md` eingebunden.

## Aktueller Stand: Phase 2

Migration 202610260001_phase2.sql ist auf dem Frankfurt-Projekt angewendet. Anmeldung, Projektzugang und Cloud-Speicherung sind implementiert. Maßgebliche Übergabe mit Prüfungen und offenen Einstellungen: [PHASE2.md](PHASE2.md). Die folgenden Verbindungsnotizen sind historisch.

## Aktueller Status: Shared Pooler funktioniert (26.10.2026)

Massgeblich ist dieser neueste Pruefstand; die weiter unten dokumentierten Direct-Connection-/IPv6-Probleme sind historisch und blockieren die aktuelle Konfiguration nicht mehr.

- Erneutes Lesen der gespeicherten `C:\dev\linebalancing\.env.local` bestaetigt: `SUPABASE_DB_URL` verwendet jetzt den Shared Pooler in `eu-central-1` auf Port 5432 (Session-Modus). Keine doppelte URL-Zeile festgestellt.
- `npm.cmd run check:env` erfolgreich: API-Zugang, E-Mail-Login, Projekt-Referenz, Frankfurt-Pooler und Datenbankverbindung mit Passwort geprueft.
- Vorherige Aussagen ueber eine direkte Verbindung beziehen sich auf den zuvor gelesenen Dateistand. Kein weiterer URL-Wechsel erforderlich.
- Naechster Schritt: Phase 2 mit Datenmodell/Migrationen und serverseitigen Berechtigungen fortsetzen. Die Verbindungspruefung hat keine Anwendungstabellen angelegt oder Migrationen angewendet.

## Lokale Konfiguration

Aktives Repository: `C:\dev\linebalancing` (bewusst ausserhalb von OneDrive).
Die echte `.env.local` ist durch Git ignoriert. `.env.example` enthaelt nur eine Vorlage ohne Zugangsdaten.

Benoetigt werden aktuell genau diese vier Variablen:

| Variable                               | Zweck                                                          |
| -------------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase-API fuer die App                                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Oeffentlicher App-Schluessel; Rechte spaeter durch RLS         |
| `SUPABASE_PROJECT_REF`                 | Projektzuordnung fuer die Einrichtung                          |
| `SUPABASE_DB_URL`                      | PostgreSQL-Verbindung fuer CLI/Migrationen, niemals im Browser |

DB-URL im Supabase-Projekt unter Connect kopieren (Direct connection oder Session pooler). Passwort-Platzhalter ersetzen, reservierte Zeichen im Passwort URL-kodieren und die gesamte URL in Anfuehrungszeichen setzen. Zugangsdaten nie in Dokumentation, Commits oder Chat uebernehmen.

Unbenoetigte Eintraege fuer separates Datenbankpasswort, Supabase Access Token und Vercel-CLI wurden aus der lokalen Datei und Vorlage entfernt. Deployment ueber eine bestehende GitHub-Verknuepfung benoetigt lokal keine Vercel-Tokens. Secret-/Service-Role-Keys bleiben ausgeschlossen.

## Verifikation und Aenderungen

- `npm.cmd run check:env`: API-Zugang erfolgreich, E-Mail-Login aktiviert, Projekt-Referenz vorhanden, Datenbankverbindung mit Passwort erfolgreich.
- Der DB-Test fuehrt nur `supabase migration list --db-url ...` aus; keine Migration angewendet und keine Tabellen angelegt.
- CLI wird ueber ihren installierten Node-Einstieg ohne Shell gestartet. Der vorherige Windows-Shell-Aufruf interpretierte Sonderzeichen im Passwort als Befehle und schlug fehl.
- Rohe CLI-Fehler werden nicht ausgegeben, da sie Zugangsdaten enthalten koennen.
- `node --check scripts/check-env.mjs` erfolgreich. Vor der Env-Arbeit bestanden 96 Unit-Tests in 15 Dateien; seitdem keine fachliche Rechenlogik geaendert.

## Offene Punkte und naechster Schritt

- Urspruenglich war ein Pooler in `eu-west-1` konfiguriert. Nach dem vom Nutzer gemeldeten Wechsel ist eine direkte Verbindung konfiguriert; diese enthaelt keine Region. Frankfurt muss im Dashboard bestaetigt werden. Siehe erneute Pruefung unten.
- Erfolgreiche Verbindung bedeutet noch keine App-Anbindung: Phase 2 (Migrationen, Auth, RLS, Repository-Anbindung) steht weiterhin aus.
- Vorhandene Aenderungen bei Beginn: `package.json` mit `check:env` und das neue `scripts/check-env.mjs`. Nicht verwerfen.
- Bei jeder weiteren Arbeit diesen Stand und relevante Fach-/Planungsdokumente aktualisieren, Pruefungen mit Ergebnis und verbleibende Entscheidungen festhalten. Keine offenen fachlichen Entscheidungen eigenmaechtig umsetzen.

## Vorgehen fuer Frankfurt (26.10.2026)

Die Region eines bestehenden Supabase-Projekts laesst sich nicht direkt umstellen. Ein neues Projekt mit der spezifischen Region Central EU (Frankfurt), `eu-central-1`, anlegen. Nicht nur die allgemeine Auswahl Europe verwenden. Danach alle vier Eintraege in `.env.local` auf das neue Projekt aktualisieren und `npm.cmd run check:env` ausfuehren. Gegebenenfalls entsprechende App-Variablen in Vercel aktualisieren und neu deployen.

Im Rahmen dieser Arbeit wurden keine Anwendungstabellen oder Migrationen auf das alte Cloud-Projekt angewendet. Fremde Tabellen, Auth-Nutzer oder Storage-Inhalte wurden nicht inventarisiert; falls vorhanden, vor einem Wechsel separat migrieren. Szenarien der aktuellen App liegen weiterhin im Browser. Das alte Projekt erst nach erfolgreicher Umstellung und Pruefung entfernen. Zum Zeitpunkt dieser Anleitung war noch kein Wechsel erfolgt; der Nutzer hat die Einrichtung danach als fertig gemeldet. Aktueller Pruefstand siehe unten.

Quellen: [Supabase: Regionswechsel](https://supabase.com/kb/troubleshooting/change-project-region-eWJo5Z), [verfuegbare Regionen](https://supabase.com/docs/guides/platform/regions).

## Erneute Pruefung nach gemeldetem Regionswechsel (26.10.2026)

- Nutzer meldet neues Projekt und aktualisierte Konfiguration als fertig. API-Zugang und E-Mail-Login erfolgreich; API-URL, Projekt-Referenz und direkter Datenbank-Hostname passen zusammen. Keine Zugangsdaten ausgegeben.
- Datenbankverbindung aktuell nicht erfolgreich: Der direkte Datenbank-Hostname kann laut CLI-Diagnose nicht aufgeloest werden (auch ausserhalb der Sandbox geprueft). Keine Passwort-Fehlermeldung festgestellt; Passwort damit nicht verifiziert.
- Direct-Connection-Adressen enthalten keine Region. Der fruehere automatische Frankfurt-Warntext wurde korrigiert; Region im Dashboard bestaetigen.
- Naechster Schritt: DNS/Erreichbarkeit des direkten Endpunkts pruefen, gegebenenfalls eine Session-Pooler-URL aus dem neuen Projekt verwenden. Anschliessend Verbindung erneut testen. Keine Cloud-Migrationen ausgefuehrt.

## Diagnose des direkten Endpunkts (26.10.2026, erneuter Test)

API-Verbindung weiterhin erfolgreich; DB-CLI weiterhin fehlgeschlagen. DNS gezielt geprueft: kein IPv4-A-Eintrag (ENODATA), ein IPv6-AAAA-Eintrag vorhanden. TCP-Test direkt gegen die aufgeloeste IPv6-Adresse auf Port 5432 ergibt ENETUNREACH. Damit ist die Ursache genauer eingegrenzt: Der Endpunkt existiert, aber IPv6 ist von diesem Rechner/Netz aus nicht erreichbar. Die vorherige pauschale DNS-Diagnose ist entsprechend zu praezisieren. Passwort weiterhin nicht verifiziert.

Naechster Schritt: Im neuen Projekt eine Session-Pooler-Verbindung (IPv4, Port 5432) aus dem Connect-Dialog verwenden, falls verfuegbar; alternativ IPv6-Zugang im Netzwerk herstellen oder die IPv4-Option des direkten Endpunkts pruefen. Keinen Pooler-Host raten und keine Region manuell in der URL ersetzen. Andere drei Env-Werte bleiben bei unveraendertem Projekt erhalten. Es wurden keine Datenbankmigrationen ausgefuehrt.

## Beide URLs erneut abgeglichen (26.10.2026)

Auf Nutzerwunsch `NEXT_PUBLIC_SUPABASE_URL` und `SUPABASE_DB_URL` in der aktiven `.env.local` geprueft. Beide haben gueltiges URL-Format und gehoeren zur eingetragenen `SUPABASE_PROJECT_REF`; es liegt kein erkennbarer Projekt-Mix vor. Die HTTPS-API funktioniert mit dem Publishable Key. Die DB-URL ist weiterhin eine Direct connection ueber PostgreSQL auf Port 5432 mit gesetztem Passwort; der CLI-Verbindungstest scheitert weiterhin. Die zuletzt eingegrenzte IPv6-Erreichbarkeit bleibt der offene Punkt. Die Region ist in beiden Hostnamen nicht enthalten. Keine Env-Werte veraendert, keine Migrationen ausgefuehrt.
