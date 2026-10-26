# Rechenregeln

**Stand:** 26.10.2026 · Verbindliche Grundlage für den Rechenkern (`src/domain/calc/`). Quellen: 01_ANFORDERUNGEN (F/P-Nummern) und die Entscheidungen E1–E7, E14 und E34 in [`OFFENE_ENTSCHEIDUNGEN.md`](OFFENE_ENTSCHEIDUNGEN.md). Springer (E40, F134) siehe Abschnitt 6a. Noch offen und hier nicht geregelt: E8 (Filter).

## 1 · Einheiten und Genauigkeit

- Alle Zeiten in Minuten (F73).
- Importierte Zeiten sind unveränderlich (F17). Der Rechenkern liest sie nur.
- Zwischenwerte werden nicht gerundet. Erst die Ausgabe wird auf zwei Nachkommastellen gerundet (P2), und zwar kaufmännisch: ab 5 vom Betrag her aufrunden (E34). Gleitkommafehler dürfen das Ergebnis nicht verfälschen (101,875 % ergibt 101,88 %).
- Vergleiche von Zeitpunkten (z. B. Gleichstand bei der Listenplanung, Überschreitung des Takts) erfolgen mit einer Toleranz von 10⁻⁹ min, damit Gleitkommafehler keine Reihenfolge oder Warnung verändern.

## 1a · Stationsreihenfolge

Stationen werden natürlich sortiert (E14): deutsche Collation, Zahlen numerisch, Groß-/Kleinschreibung ohne Einfluss („Station 2“ vor „Station 10“). Diese Reihenfolge gilt für die Anzeige (F32) und als Flussreihenfolge für die Verletzungsprüfung (E1b).

## 2 · Berechnungsmenge

- Berechnet wird je Szenario mit eigenem Takt und Zuschlag (F59/F60).
- Nur **zugeordnete** Schritte (mit Mitarbeiter) werden eingeplant und fließen in Zeiten und KPIs ein. Nicht zugeordnete Schritte bleiben sichtbar und werden gesondert ausgewiesen (F67/F109/P4).
- Sobald mindestens ein Schritt nicht zugeordnet ist, tragen alle Kennzahlen den Hinweis „unvollständig“ (P4/F117).

## 3 · Ablaufplanung je Station

Jede Station wird unabhängig als eigener Taktzyklus geplant, beginnend bei 0 (E1a).

**Zeitlich wirksame Vorgänger** eines Schritts sind nur Vorgänger, die

1. an **derselben Station** liegen (E1a) und
2. **zugeordnet** sind (E4).

Andere Vorgänger werden zeitlich ignoriert, aber geprüft (Abschnitt 6).

**Listenplanung (E3, E5):**

1. Ein Schritt ist _bereit_, wenn alle zeitlich wirksamen Vorgänger eingeplant sind.
2. Frühester Start eines bereiten Schritts = max(Zeitpunkt, an dem sein Mitarbeiter frei ist; Ende aller zeitlich wirksamen Vorgänger).
3. Unter allen bereiten Schritten der Station wird der mit dem frühesten möglichen Start eingeplant. Bei Gleichstand entscheidet die kleinere `Reihenfolge`, danach die Arbeitsgang-ID.
4. Ende = Start + importierte Zeit. Danach wiederholen, bis alle Schritte eingeplant sind.

Folgen:

- Ein Mitarbeiter führt nie zwei Tätigkeiten gleichzeitig aus (F55).
- Ein Mitarbeiter wartet nur, wenn keine seiner Tätigkeiten ausführbar ist.
- Die Darstellungsreihenfolge der Schritte folgt den berechneten Startzeiten; parallele Tätigkeiten verschiedener Mitarbeiter liegen zeitgleich (F70).
- Die Planung setzt einen kreisfreien Vorgängergraphen voraus. Kreise werden beim Import blockiert (F87) und bei der Bearbeitung in der App verhindert (E3).

## 4 · Wartezeit, Belegung, Zuschlag

- **Wartezeit** eines Schritts = Start − Zeitpunkt, an dem sein Mitarbeiter frei wurde (bzw. 0 beim ersten Schritt). Sie wird als eigenes Segment vor dem Schritt dargestellt (F63/F66).
- **Leerlauf** nach der letzten Tätigkeit eines Mitarbeiters bis zum Takt ist **keine** Wartezeit (E5).
- **Produktive Zeit** eines Mitarbeiters = Summe der importierten Zeiten seiner Schritte.
- **Zuschlag** (E2/P1) = produktive Zeit × Zuschlagssatz des Szenarios. Er wird nur auf die Summe je Mitarbeiter angewendet, nicht auf einzelne Schritte, und verschiebt keine Startzeiten.
- **Belegung** eines Mitarbeiters = produktive Zeit + Zuschlag + Summe seiner Wartezeiten.

## 5 · Kennzahlen

| Kennzahl                         | Formel                                                                           | Quelle         |
| -------------------------------- | -------------------------------------------------------------------------------- | -------------- |
| Stationshöhe                     | größte Belegung aller Mitarbeiter der Station                                    | F90            |
| Stationsbelegung                 | Stationshöhe / Takt                                                              | F107           |
| Mitarbeiterzahl                  | alle Mitarbeiter, auch ohne zugeordnete Tätigkeit                                | F105, E6a      |
| Personalauslastung (Station)     | Summe Belegung der Mitarbeiter / (Mitarbeiterzahl der Station × Takt)            | F108, E6a      |
| Personalauslastung (Szenario)    | Summe Belegung aller Mitarbeiter / (Mitarbeiterzahl des Szenarios × Takt)        | F108           |
| Gesamtarbeitsinhalt              | Summe der importierten Zeiten aller zugeordneten Schritte, ohne Zuschlag         | F101/F130, E6b |
| Nicht zugeordneter Arbeitsinhalt | Summe der importierten Zeiten nicht zugeordneter Schritte, gesondert ausgewiesen | F109, P4       |

Überlastung: Stationshöhe > Takt (F3) bzw. Belegung eines Mitarbeiters > Takt (F106) wird markiert.

Die Personalauslastung enthält Wartezeit und Zuschlag; im UI ist sie als belegungsbezogene Auslastung zu benennen (F108).

## 6 · Prüfungen und Warnungen

Keine Prüfung blockiert eine Änderung in der App (F8/F15). Jede Verletzung erscheint in der Konfliktübersicht, und das Szenario gilt als konfliktbehaftet.

| Prüfung                                                                                                                                                                                       | Ergebnis                                                                | Quelle       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------ |
| Vorgänger liegt an einer Station, die in der Flussreihenfolge (Abschnitt 1a) **nach** der Station des Nachfolgers kommt.                                                                      | Verletzung                                                              | F62, E1b     |
| Zugeordneter Schritt hat einen nicht zugeordneten Vorgänger **derselben Station**. Vorgänger anderer Stationen beeinflussen den Start nach E1a nicht und lösen diese Warnung daher nicht aus. | Warnung „Startzeit unsicher – Vorgänger nicht zugeordnet“ am Nachfolger | E4, E1a      |
| Schritt ist nicht zugeordnet                                                                                                                                                                  | Warnzustand, Ausschluss aus der Berechnung                              | F61/F67/F109 |
| Vorgängerkreis                                                                                                                                                                                | beim Import blockierend; in der App nicht speicherbar                   | F87, E3      |

Vorgänger an derselben Station werden durch die Ablaufplanung immer eingehalten.

## 6a · Springer (E40, F134)

Entscheidung des Nutzers vom 26.10.2026: Ein Mitarbeiter kann an mehreren Stationen arbeiten. Diese Regeln ändern die Abschnitte 3–5 und F61, F68, F75, F100, F105 und F108 wie folgt. Ohne Springer müssen alle Ergebnisse unverändert bleiben.

**Modell**

- Ein Mitarbeiter gehört zur Linie und hat eine oder mehrere **Einsatzstationen**. Je Einsatzstation hat er im Diagramm eine eigene **Spur** mit seinen Arbeitsgängen dieser Station.
- Bezeichnungen „Mitarbeiter N“ sind linienweit eindeutig (Durchnummerierung vom 26.10.2026). Im Import bedeutet dieselbe Bezeichnung an mehreren Stationen dieselbe Person.
- Ein Arbeitsgang kann jedem Mitarbeiter der Linie zugewiesen werden. Ist dessen Station noch keine Einsatzstation, entsteht dort eine Spur.
- Eine Spur lässt sich nur entfernen, wenn an dieser Station keine Arbeitsgänge des Mitarbeiters liegen (analog E12).
- Verschieben auf eine andere Station entfernt den Mitarbeiter weiterhin (F61 unverändert).

**Ablaufplanung (ersetzt die Einschränkung „je Station unabhängig“ in Abschnitt 3)**

- Jede Station bleibt ein Taktzyklus ab 0 (E1a), zeitlich wirksame Vorgänger bleiben auf dieselbe Station beschränkt.
- Die Listenplanung läuft gemeinsam über alle Stationen. Ein Mitarbeiter ist **linienweit** belegt: Frühester Start = max(Zeitpunkt, an dem der Mitarbeiter an irgendeiner Station frei ist; Ende der zeitlich wirksamen Vorgänger). Er führt nie zwei Tätigkeiten gleichzeitig aus, auch nicht an verschiedenen Stationen.
- Auswahl unter allen bereiten Schritten aller Stationen: frühester möglicher Start, dann kleinere `Reihenfolge`, dann Station in Flussreihenfolge (Abschnitt 1a), dann Arbeitsgang-ID.
- Keine Wegezeit zwischen Stationen. Wege lassen sich als eigener Arbeitsgang abbilden.

**Wartezeit, Belegung, Kennzahlen**

- Wartezeit eines Schritts = Start − Zeitpunkt, an dem sein Mitarbeiter frei wurde, gleich an welcher Station. Die Zeit, in der ein Springer an einer anderen Station arbeitet, ist an dieser Station keine Wartezeit; das Diagramm zeigt sie als Abwesenheit.
- **Spurbelegung** = produktive Zeit der Spur + Zuschlag darauf + Wartezeiten vor den Schritten der Spur. **Gesamtbelegung** eines Mitarbeiters = Summe seiner Spurbelegungen. Überlastung (F106) gilt für die Gesamtbelegung > Takt.
- Stationshöhe (F90) = größte Spurbelegung der Station.
- Mitarbeiterzahl einer Station (F105) = Summe der **Anteile**: Anteil einer Spur = Spurbelegung / Gesamtbelegung. Ohne jede Belegung verteilt sich ein Mitarbeiter gleichmäßig auf seine Einsatzstationen. Mitarbeiterzahl des Szenarios = Zahl der Personen.
- Personalauslastung der Station (F108) = Summe der Spurbelegungen / (Mitarbeiterzahl der Station × Takt). Szenariowert unverändert.

## 7 · Verbindlicher Testfall

Das Rechenbeispiel in [`OFFENE_ENTSCHEIDUNGEN.md`](OFFENE_ENTSCHEIDUNGEN.md#verbindliches-rechenbeispiel-e7) ist der Golden-Test für die Abnahme (E7).
