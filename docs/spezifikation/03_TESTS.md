# Line Balancing – MVP-Abnahmecheckliste

**Stand:** 26.10.2026 · **Format:** kurze Checklisten nach P5. Jede Position ist ein zu prüfendes Kriterium, kein bereits bestandener Test. Fachliche Abnahme durch Arbeitsvorbereitung (F53).

## Excel-Import

- [ ] Standardtemplate enthält `Arbeitsgänge` und `Ausfüllanleitung`.
- [ ] Varianten-/Szenarionamen werden aus dem Dateinamen abgeleitet.
- [ ] Deutsche Dezimalwerte werden korrekt eingelesen, Berechnungsergebnisse mit zwei Nachkommastellen angezeigt.
- [ ] Zeitwerte `0`, fehlende Zeiten oder fehlende Stationen blockieren den Import.
- [ ] Nicht vorhandene/zyklische Vorgänger werden in der Vorschau angezeigt und vor Import korrigiert.
- [ ] Fehlender Mitarbeiter verhindert Import nicht, sondern erzeugt eine Warnmarkierung.
- [ ] Erneuter Import erzeugt ein separates Szenario.

## Berechnung

- [ ] Explizite Vorgänger und Mitarbeiterverfügbarkeit steuern Startzeiten und Wartezeitsegmente.
- [ ] Sequenzielle und einfache parallele Schritte werden korrekt verarbeitet.
- [ ] Stationshöhe entspricht der längsten Mitarbeiterbelegungsdauer einschließlich Wartezeit.
- [ ] Zuschlag ist pro Szenario einstellbar und wird nur auf Mitarbeiter-Gesamtzeiten angewendet (P1; Basis offen).
- [ ] Zwischenwerte werden nicht vorzeitig gerundet; Ergebnisse mit zwei Nachkommastellen (P2).
- [ ] Unzugeordnete Schritte bleiben sichtbar, fließen nicht in Berechnungen ein, KPIs erhalten auffällige Unvollständigkeitswarnung.
- [ ] Stationsbelegung und Personalauslastung werden als unterschiedliche Kennzahlen angezeigt.

## Yamazumi und Workshop-Bedienung

- [ ] Zwischen Stations- und Mitarbeiteransicht umschalten; Mitarbeiter haben eigene Balken.
- [ ] Taktlinie mit Wert, Warnmarkierung bei Überschreitung.
- [ ] Arbeitsschritte direkt per Drag-and-drop verschieben; mögliche Ziele beim Ziehen markieren.
- [ ] Ein verschobener Schritt ist zunächst keinem Mitarbeiter zugeordnet und kann im Detailpanel neu zugewiesen werden.
- [ ] Suchfunktion und kombinierte Filter wirken auf sichtbare Balken; gefilterte Werte sind erkennbar.
- [ ] Ein Klick öffnet ein rechtes Overlay-Detailpanel; Originalzeiten bleiben schreibgeschützt.
- [ ] Diagramm ist auf Laptop, Desktop und Workshop-Bildschirm bedienbar.

## Szenarien und Vergleich

- [ ] Mehrere Szenarien sind anlegbar und bleiben getrennt; Ist/Ziel-Dropdowns erlauben auch gleiche Auswahl.
- [ ] Vergleich zeigt zwei Diagramme nebeneinander mit synchronisiertem Scrollen und gleicher Zeitskala.
- [ ] In der Vergleichsansicht lässt sich nur die Zielseite bearbeiten.
- [ ] Verschobene Arbeitsschritte sind mit Symbol markiert; fehlende Stationen bleiben leer.
- [ ] Auto-Speichern funktioniert und Undo/Redo umfasst Szenarioänderungen inklusive Kategorie und Taktzeit.
- [ ] Bei Verbindungsproblemen werden ausstehende Änderungen angezeigt und später erneut übertragen.

## Benutzer, Sicherheit und Datenintegrität

- [ ] Magic-Link und Projekt-Code gemäß Referenzimplementierung; kein öffentlicher Projektzugang.
- [ ] Projektzugriffe und Berechtigungen werden in Supabase DB/RLS geprüft, nicht nur im Frontend.
- [ ] Editor kann bearbeiten, Owner hat Verwaltungsrechte; Editor kann keine Projektdaten löschen.
- [ ] Nur ein Bearbeiter kann ein aktives Szenario gleichzeitig ändern; zweiter Nutzer wird gewarnt und blockiert.
- [ ] Sperre wird beim Verlassen aufgehoben; Sonderfall Browserabsturz wird gesondert geprüft.
- [ ] Owner kann ein Projekt nur mit zusätzlicher Bestätigung löschen.
- [ ] Letzte Änderung mit Bearbeiter wird angezeigt.

## Export und Pilot-Freigabe

- [ ] Excel-Export enthält Arbeitsgänge samt aktualisierter Zuordnung, ohne Änderung der importierten Zeitwerte.
- [ ] Diagrammexport enthält Stationsbezeichnungen und numerische Taktlinie.
- [ ] Umfangreicher PDF-Bericht und Optimierungsvorschläge gehören **nicht** zum MVP.
- [ ] Praxistest mit der Arbeitsvorbereitung und validierten Produktionsdaten durchgeführt.
- [ ] Arbeitsvorbereitung hat MVP-Funktionen geprüft und freigegeben.

## Vor Abnahme explizit entscheiden

- [ ] Zuschlagsbasis (Wartezeit eingeschlossen oder ausgeschlossen) freigeben.
- [ ] Erwartete Zahlenwerte für mindestens einen Ablauf mit zwei Mitarbeitern und einer Vorgängerabhängigkeit festlegen.
- [ ] Wiederherstellung einer Szenariosperre nach Browserabsturz klären.
