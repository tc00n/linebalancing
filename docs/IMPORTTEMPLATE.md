# Excel-Importtemplate

**Stand:** 28.10.2026 · Freigegeben als E23, ergänzt um die Zeitart (E44). Grundlage: F30, F69, F72–F89, Entscheidungen E21–E23.

Eine Excel-Datei je Produktvariante (F14). Der Dateiname ohne Endung wird als Varianten- und Szenarioname vorgeschlagen (F88).

## Blätter

| Blatt              | Inhalt                                                                      |
| ------------------ | --------------------------------------------------------------------------- |
| `Arbeitsgänge`     | Eine Zeile je Arbeitsschritt (F72). Zeile 1 enthält die Spaltennamen.       |
| `Ausfüllanleitung` | Erklärung der Spalten mit Beispielen (F89). Wird beim Import nicht gelesen. |

## Spalten im Blatt `Arbeitsgänge`

Spaltennamen werden ohne Beachtung von Groß-/Kleinschreibung und überzähligen Leerzeichen erkannt. Die Reihenfolge der Spalten ist beliebig, zusätzliche Spalten werden ignoriert. Fehlt eine der folgenden Spalten, wird die Datei abgelehnt; ausgenommen sind die optionalen Spalten `Zeitart` und `Hält Station` (E44), deren Zellen dann als leer gelten.

| Spalte                     | Pflicht                 | Regel                                                                                                                                                                                   | Fehler/Warnung                                                                                                                       | Quelle                       |
| -------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| `Arbeitsgang-ID`           | ja                      | Text oder Zahl, eindeutig in der Datei                                                                                                                                                  | fehlend oder doppelt: Fehler                                                                                                         | F69                          |
| `Station`                  | ja                      | Text                                                                                                                                                                                    | fehlend: Fehler                                                                                                                      | F86                          |
| `Arbeitsgang/Beschreibung` | ja                      | Text                                                                                                                                                                                    | fehlend: Fehler                                                                                                                      | F30                          |
| `Zeit_min`                 | ja                      | Minuten > 0. Zahlzelle oder Text mit Dezimalkomma (`1,25`).                                                                                                                             | fehlend, kein gültiges deutsches Zahlformat, ≤ 0: Fehler. Mehr als zwei Nachkommastellen: kaufmännisch gerundet, Warnung.            | F73, F80, F81, F84, F85, E21 |
| `Mitarbeiter`              | nein                    | `Mitarbeiter 1`, `Mitarbeiter 2` … (Groß-/Kleinschreibung und Leerzeichen egal). Die Nummer läuft über die ganze Linie; dieselbe Bezeichnung an mehreren Stationen ist dieselbe Person. | leer: Warnung „nicht zugeordnet“. Anderer Text: Fehler. Dieselbe Bezeichnung an mehreren Stationen: Warnung (einmal je Mitarbeiter). | F68, F75, F78, E40           |
| `Reihenfolge`              | ja                      | Zahl ≥ 0, Dezimalkomma erlaubt (z. B. `2,5` zum Einschieben)                                                                                                                            | fehlend, keine Zahl oder negativ: Fehler                                                                                             | F30                          |
| `Vorgänger-IDs`            | Spalte ja, Zelle nein   | Arbeitsgang-IDs, mit `;` getrennt. Leer = keine Vorgänger.                                                                                                                              | unbekannte ID, Selbstverweis, doppelte ID, Kreis: Fehler                                                                             | F54, F74, F79, F87           |
| `Zeitart`                  | Spalte nein, Zelle nein | `Hand` oder `Prozess` (auch `Handzeit`, `Prozesszeit`; Groß-/Kleinschreibung egal). Leer = Hand. Prozess = Zeit ohne Mitarbeiter, z. B. Ablüften.                                       | anderer Text: Fehler. Prozess mit Mitarbeiter: Fehler in `Mitarbeiter`. Prozess ohne Mitarbeiter: keine Warnung.                     | E44, F135                    |
| `Hält Station`             | Spalte nein, Zelle nein | `ja` oder `nein`, leer = nein. Ja = das Produkt bleibt bis zum Ende der Prozesszeit an der Station, sie zählt in die Stationshöhe.                                                      | anderer Text: Fehler. `ja` bei Handzeit: Fehler.                                                                                     | E44, F135                    |

Leere Zeilen werden übersprungen.

## Ablauf in der App

1. Datei hochladen. Die App prüft alle Zeilen und zeigt eine Vorschau mit Zeilennummer, Spalte und Meldung (F31).
2. Fehler in allen Feldern außer `Zeit_min` können direkt in der Vorschau korrigiert werden; danach wird erneut geprüft (E22, F87). Zeitfehler werden in Excel korrigiert und die Datei neu hochgeladen.
3. Warnungen (gerundete Zeit, fehlender Mitarbeiter, Mitarbeiter an mehreren Stationen) blockieren nicht.
4. Übernahme erst, wenn keine Fehler mehr vorliegen. Danach sind die Zeiten unveränderlich (F17).
5. Jeder Import erzeugt ein neues Szenario (F22/F83). Die Mitarbeiterzahl je Station ergibt sich aus den verschiedenen Mitarbeiterbezeichnungen (F82); ein Mitarbeiter an mehreren Stationen zählt dort anteilig nach Belegung und wird nacheinander eingeplant (E40, F134).

Taktzeit und Zuschlag stehen nicht in der Datei. Sie werden beim Import eingegeben und sind je Szenario änderbar (F59/F60).
