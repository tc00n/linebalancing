# Übergabe von Codex an Claude

Stand: 26.10.2026. Diese Übergabe gehört zum Abschlusscommit der folgenden Änderungen.

## Abgeschlossen

- F133/E38: Personalplanung aus Personalplanung 1.1.xlsx, produktiver Vergleich je Station und Kostenstelle bei 70 Minuten, Bruttobedarf/Dateibestand separat. Quelle, Grenzen und Summenfehler unter [PERSONALPLANUNG.md](PERSONALPLANUNG.md).
- Originalplanung mit 74 Positionen im bestehenden Projekt EURA Mobil gespeichert. Migration 202610260003_staffing_plans.sql ist live angewendet. RLS, Importvalidierung und idempotente Referenzimporte geprüft.
- Zuschlagsfeld im Excel-Import markiert beim Fokussieren den Wert zum direkten Ersetzen.
- Diagramm passt sich beim ersten sichtbaren Laden automatisch an die Fenstergröße an. Danach bleiben manuelle Eingriffe erhalten. Mindesthöhe für lesbare Balken; Vergleich berücksichtigt die Bildschirmaufteilung.
- Tabellenansicht mit Stationsabschnitten, blauem Stationskopf und Anzahl sichtbarer Arbeitsgänge. Andere Spaltensortierungen bleiben global.

## Prüfung

Personalplanung: 118 Unit-Tests, 34 Datenbanktests und 15 Browserprüfungen waren bei Abschluss grün. Für die anschließenden UI-Nachbesserungen wurden Lint, TypeScript, Produktionsbuild, Formatierung und alle sieben lokalen Browserabläufe geprüft. Der Bearbeitungstest schließt das rechte Detailpanel vor einem überdeckten Stationsknopf regulär. Dateiuploadtests warten auf die Freigabe nach Hydrierung.

Vor dem Abschlusscommit erneut erfolgreich geprüft: Lint, TypeScript, Formatcheck und alle 118 Unit-Tests in 19 Dateien. Keine offenen Testdaten oder temporären Testprojekte in der Cloud aus den Integrationsprüfungen.

## Anschluss

- E39: Modellabhängige Referenzbesetzung ausdrücklich auf später verschoben; jetzt nicht implementieren. Tool-Berechnung ist szenariobezogen, Referenzplanung aktuell projektbezogen.
- E40/F134: Die neuen Springer-Regeln stehen bereits in docs/RECHENREGELN.md, Abschnitt 6a. Dieser Commit implementiert sie nicht und verändert Claudes bereits eingecheckte Mitarbeiter-Durchnummerierung nicht.
- Szenariosperre, persistente Offline-Outbox, Export und übrige offene Entscheidungen bleiben außerhalb dieses Abschlusses.
- Details und Nutzerentscheidungen vor der nächsten Aufgabe aus den jeweils verbindlichen Dokumenten lesen.

Dieser Abschluss erstellt einen lokalen Git-Commit. Ein Push oder Vercel-Deployment wurde damit nicht beauftragt.
