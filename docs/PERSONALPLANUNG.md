# Personalplanung und 70-Minuten-Abgleich

Stand: 26.10.2026. Gemeinsame Übergabe für Codex und Claude. Neue Anforderung F133; Nutzerentscheidung E38: produktive Mitarbeiterzahlen vergleichen, Bruttobedarf und vorhandenes Personal getrennt zeigen.

## Quelle und bestätigte Bedeutung

Quelle ist die lokale Datei „Personalplanung 1.1.xlsx“ im OneDrive-Projektordner. Die Datei bleibt vertraulich und wird nicht ins Repository oder in öffentliche Assets kopiert.

- „Personalplanung pro Meisterbere“: 74 Positionen, davon 68 produktive Positionen und 6 separate Teamsprecherpositionen mit zusammen 17 MA. Produktive Summe ohne diese Teamsprecherpositionen: 172 MA.
- Vergleichsbasis ist „Abschätzung 70/ Min“, nicht die 90-Minuten-Spalte. Dezimalwerte wie 0,50 oder 0,75 bleiben erhalten.
- „Brutto 70 Min“ und Faktor aus „Brutto-Personalfaktor“ werden separat ausgewiesen. Der Faktor (in dieser Datei rund 1,26818) wird nicht als Arbeitszeitzuschlag verwendet.
- „Abgleich akt. Personaldicke“ liefert den Personalbestand je Kostenstelle. Es handelt sich um den Stand der Quelldatei, nicht um einen laufend synchronisierten Istbestand.
- Kostenstelle 353 umfasst T17–T23: produktiv 13 MA, Brutto aus Einzelpositionen 16,4 MA, Bestand laut Datei 12 MA. Daraus folgt im separaten Bruttoabgleich eine Fehlmenge von 4,4 MA.

## Erkannter Quellenfehler

Die Kostenstellenübersicht verwendet fortlaufend verschobene SUMIFS-Bereiche. Bei Kostenstelle 337 werden dadurch frühe Zeilen ausgeschlossen: Die gespeicherte Excel-Summe beträgt 3,1 MA brutto, die Einzelpositionen ergeben 9,6 MA. Das Tool summiert die ursprünglichen Einzelpositionen und zeigt die abweichende Quellsumme zusätzlich mit Warnung. Die Originaldatei wird nicht verändert.

Excel-Formeln werden grundsätzlich über gespeicherte Ergebnisse gelesen. Ausnahme: Fehlt das Ergebnis der bekannten Zeilenformel ROUND(Hn * Bruttofaktor, 1), wird genau diese Formel nachgebildet und ein Hinweis mit Excel-Zeile erzeugt. Das betrifft in der Originaldatei insbesondere Nullbesetzungen. Unbekannte Formeln ohne Zahlenwert bleiben unbekannt; keine erfundenen Nullwerte.

## Rechen- und Zuordnungsregeln

- Je Station: zugeordneter Arbeitsinhalt mit dem bereits eingestellten Szenariozuschlag, geteilt durch 70. Keine Zwischenrundung.
- Dies ist eine theoretische Personaluntergrenze, kein Nachweis eines ausführbaren 70-Minuten-Ablaufs. Wartezeiten bleiben aus dem Arbeitsinhalt heraus; die Stationshöhe wird mit der vorhandenen Mitarbeiterzuordnung inklusive Wartezeit/Zuschlag separat gegen 70 angezeigt.
- Der Szenariotakt wird nicht verändert. Planbesetzungen erzeugen keine Mitarbeiterspuren und ändern keine importierten Zeiten oder Zuordnungen.
- Nicht zugeordnete Schritte fehlen gemäß F109 im berechneten Arbeitsinhalt. Der Vergleich wird dann deutlich als unvollständig markiert.
- Stationsnamen werden getrimmt und ohne Groß-/Kleinschreibung verglichen. T01 und T1 gelten als dieselbe Taktstation. Andere Sammelbezeichnungen wie VA04/05 werden nicht automatisch aufgeteilt. Mehrdeutige Zuordnungen bleiben offen.
- Pro Kostenstelle wird für den Toolvergleich nur der identische abgedeckte Stationsumfang summiert. Die vollständige Planbesetzung steht daneben. Fehlende Stationen werden nicht als Nullbedarf angesetzt.
- Kostenstellen-Brutto summiert die bereits in Excel gerundeten Einzelwerte einschließlich explizit dort zugeordneter Teamsprecher. Fehlende Kostenstellen werden nicht ergänzt. Teamsprecherpositionen erscheinen zusätzlich separat.
- Positive Differenz „Tool − Plan“ bedeutet mehr Arbeitsinhalt je 70 Minuten als geplante produktive Kapazität; positive Bruttofehlmenge bedeutet Bruttobedarf über dem Bestand laut Datei. Diese beiden Werte werden nicht vermischt.

## Oberfläche und Speicherung

Eigene geschützte Seite: /personalplanung. Erreichbar über Navigation, Szenarioliste und „Personalabgleich“ aus dem Diagramm. Szenarioauswahl, Planungsauswahl, Excel-Vorschau und ausdrückliches Speichern neuer Referenzstände. Identische Dateien werden je Projekt über den SHA-256-Dateihash nicht doppelt gespeichert.

Personalplanung wird projektbezogen in staffing_plans gespeichert, mit RLS und kontrollierter Importfunktion. Bestätigte Owner und Editoren mit aktueller Projektfreigabe können importieren und lesen. Direkte INSERT/UPDATE/DELETE-Rechte sind entzogen; bestehende Referenzstände werden nicht überschrieben. Auch bei Ausfall der Verbindung darf kein Speichern als erfolgreich erscheinen.

Migration: supabase/migrations/202610260003_staffing_plans.sql. Claudes vorbereitete Review-Migration …0002 bleibt erhalten. Der tatsächliche Stand von …0002 und …0003 wurde in der Cloud-Migrationshistorie und anhand der vorhandenen Tabelle geprüft.

Der Einmalimport scripts/staffing/import.ts liest die Datei zunächst nur. Mit zusätzlicher Projekt-UUID speichert er eine Referenz für das ausdrücklich gewählte Projekt. Bei diesem lokalen Einrichtungsimport bleibt uploaded_by leer; es wird kein Auth-Nutzer imitiert. Die Originaldatei wird weder verändert noch als Ganzes hochgeladen; gespeichert werden die normalisierten Planwerte.

## Prüfungen und Abschluss

- 118 Unit-Tests bestanden, einschließlich produktiver/brutto Trennung, Teilbesetzung, Null versus fehlend, Szenariozuschlag, unvollständiger Zuordnung, partieller Abdeckung und fehlerhaften Quellsummen.
- 34 Datenbanktests bestanden; neue Prüfungen für Importvalidierung, Idempotenz, RLS, neue Sitzung und verbotene Direktänderungen.
- Lint, TypeScript und Produktionsbuild bestanden. Sieben lokale Browser-Regressionen einschließlich Personalabgleich bestanden.
- Alle 15 Browserprüfungen bestanden: sieben lokale Regressionen, drei echte Cloud-Abläufe und fünf Produktionszugangstests. Die Personalplanung wurde über die Cloud-Oberfläche gespeichert und nach Neuladen wiedergefunden.
- Szenariosperren, Offline-Outbox und andere offene Entscheidungen bleiben unverändert. Keine automatische Personaloptimierung.

## Abschluss

Die Originaldatei Personalplanung 1.1.xlsx ist als Referenz im vorhandenen Projekt EURA Mobil gespeichert. Rein lesende Kontrolle bestätigt Dateiname und 74 Positionen im richtigen Projekt. Kein temporäres Cloud-Testprojekt blieb zurück. Der lokale Einrichtungsimport hat uploaded_by bewusst leer gelassen. Originaldatei, Szenariotakte, Zeiten und Mitarbeiterzuordnungen blieben unverändert.

34 Datenbanktests und 118 Unit-Tests sind grün; alle 15 Browserprüfungen, Produktionsbuild, Lint, TypeScript und Formatcheck bestanden. Dateiuploadtests warten ausdrücklich auf die freigegebene Eingabe nach Hydrierung, weil Playwright setInputFiles auch auf deaktivierten Eingaben ausführen kann.

Navigation: Personalplanung in der Projektleiste/Szenarioliste oder Personalabgleich im Diagramm. Die Umsetzung wird auf Nutzerauftrag mit der Codex-Übergabe in Git gesichert. Kein Push und kein Vercel-Deployment beauftragt. Weitere offene Phasen und fachliche Entscheidungen wurden nicht vorweggenommen.

## Modellabhängige Planung – später (26.10.2026)

Nutzer stellt klar: Unterschiedliche Fahrzeugmodelle können unterschiedliche Sollbesetzungen je Station und Kostenstelle benötigen. Diese Erweiterung ist vorgesehen, wird auf ausdrücklichen Wunsch jetzt aber nicht implementiert (E39).

Aktueller Stand: Die Tool-Berechnung verwendet bereits das jeweils ausgewählte Szenario und dessen Arbeitsinhalte. Die importierte Personalreferenz ist dagegen projektbezogen und besitzt noch keine Modellzuordnung. Die Spalte „Tool abgedeckt [MA]“ zeigt die Summe des zugeordneten Arbeitsinhalts einschließlich Szenariozuschlag / 70 für die eindeutig zugeordneten Stationen der Kostenstelle. Dies ist eine theoretische produktive Personaluntergrenze, keine automatisch ermittelte ausführbare Ganzzahlbesetzung. Abdeckung, nicht zugeordnete Arbeitsgänge und aktuelle Stationshöhe müssen bei der Interpretation berücksichtigt werden.
