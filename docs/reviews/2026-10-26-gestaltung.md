# Gestaltungsprüfung 2026-10-26

**Stand:** Commit `161ce44` · **Maßstab:** Skill `frontend-design` mit Projekthinweis (NEONEX Corporate Design E30 verbindlich, Werkzeug statt Werbeseite, F125 Laptop/Desktop/Workshop-Bildschirm) · **Umfang:** Diagramm (Stationen, Mitarbeiter), Detailpanel, Tabelle, Vergleich, Import, Personalplanung, Szenarienliste

**Vorgehen:**

- Screenshots im lokalen Modus bei 1366 × 768 (Laptop), 1920 × 1080 (Desktop) und 2560 × 1440 (Workshop-Bildschirm).
- Testdaten:
  - das Testbeispiel mit 2 Stationen;
  - eine realistische Linie mit 20 Stationen, 60 Mitarbeitern und 160 Arbeitsgängen. Ihre IDs folgen dem Format des Konverters (`T17-AA010`), Takt 70 min, 10 % Zuschlag.
- Den Tastaturfokus habe ich zusätzlich gemessen. Die Screenshots liegen nur lokal und sind nicht im Repository.

## Zusammenfassung

Die App wirkt geschlossen und markengerecht:

- NEONEX-Blau, Petrol und Koralle sind sparsam und sinnvoll eingesetzt.
- Überlast, Unvollständigkeit und „ohne Mitarbeiter“ sind klar unterscheidbar.
- Texte sind deutsch und sachlich, Zahlen im deutschen Format.

Die Schwächen liegen fast nur in der Platzaufteilung, beim Laptop und beim großen Workshop-Bildschirm:

- Auf dem Laptop verdecken Bedienelemente das Diagramm.
- Auf dem großen Schirm nutzt das Diagramm den Platz nicht.
- Bei echten Arbeitsgang-IDs sagen die Balkenbeschriftungen nichts aus.

Keiner der Befunde betrifft Rechenwerte.

## Befunde

### G1 · Auf dem Laptop ist vom Diagramm kaum etwas zu sehen (Hoch)

- **Wo:** Kopf des Arbeitsbereichs, `src/features/workspace/workspace.tsx`, `kpi-bar.tsx`, `workspace-controls.tsx`, `filter-bar.tsx`
- **Beobachtung:** Bei 1366 × 768 beginnt das Diagramm erst bei etwa 600 px. Darüber liegen untereinander:
  - Titel, Ist/Ziel, vier Kennzahlkarten
  - „Weitere Kennzahlen“, der Hinweis „Ergebnis unvollständig“
  - die zweizeilige Werkzeugleiste und die Filterleiste
  - Sichtbar bleiben rund 170 px Diagramm, bei der großen Linie nur die Spitze von T22.
- **Folge:** Im Workshop am Laptop muss man für jede Änderung scrollen, und die Kennzahlen verschwinden dabei aus dem Blick. Der Hauptzweck der Seite, das Yamazumi, ist im ersten Bild nicht zu sehen. „Vollbild“ hilft, ist aber ein zusätzlicher Schritt.
- **Vorschlag:** Den Kopf auf etwa die Hälfte verdichten, ohne Inhalte zu entfernen:
  - Kennzahlen als eine schmale Zeile statt Karten.
  - Der Hinweis „unvollständig“ als einzeiliger Hinweis; die Kennzahlen tragen die Markierung bereits.
  - Filter in dieselbe Zeile wie die Werkzeugleiste.
  - Ist/Ziel in die Titelzeile.
  - Ziel: Das Diagramm beginnt bei 768 px Höhe spätestens bei etwa 300 px.
  - Aufwand: mittel (½–1 Tag), Browsertests anpassen.
- **Status: behoben (27.10.2026).** Kennzahlen als eine Leiste mit „Weitere Kennzahlen“ darin, „Ergebnis unvollständig“ und „konfliktbehaftet“ einzeilig, Ist/Ziel in der Titelzeile, Navigation in der Untertitelzeile, Filter und Werkzeuge in einem Kasten, Regler schmaler. Gemessen mit dem Testbeispiel und 10 % Zuschlag: Das Diagramm beginnt bei 1366 × 768 und bei 1920 × 1080 bei 376 px statt 600 px; bei 1366 × 768 sind Diagramm und Legende ohne Scrollen sichtbar. Das Ziel von etwa 300 px ist damit nicht ganz erreicht; mehr ginge nur, wenn Bedienelemente in ein Aufklappmenü wandern. Die Kennzahlenleiste gilt auch in der Tabellenansicht. Alle Bedienelemente behalten ihre Namen, die Browsertests liefen unverändert durch.

### G2 · Auf dem großen Workshop-Bildschirm bleibt das Diagramm klein (Mittel)

- **Wo:** Zeitskala und Breite, `src/features/workspace/use-view-settings.ts`
- **Beobachtung:**
  - Bei 2560 × 1440 nimmt das Diagramm mit 20 Stationen etwa 70 % der Breite und nur 330 px Höhe ein. Darunter bleiben rund 600 px leer.
  - Erst „An Fenster anpassen“ nutzt den Platz. Die Einstellung wird je Gerät gespeichert (E16), passt sich aber nicht an, wenn sich Fenster oder Bildschirm ändern.
- **Folge:** Am Workshop-Bildschirm muss erst jemand „An Fenster anpassen“ klicken. Sonst sind Balken und Beschriftungen für den Raum zu klein (F125).
- **Vorschlag:** Ohne gespeicherte Einstellung beim Öffnen automatisch einpassen. „An Fenster anpassen“ als Modus führen, der aktiv bleibt, bis jemand Breite oder Zeitskala von Hand ändert. Das berührt E16 nur in der Voreinstellung. Aufwand: klein bis mittel.
- **Status: erledigt (27.10.2026).** Das Einpassen beim ersten Öffnen gibt es bereits (Codex, Commit `69cda16`, Backlog). Nachgemessen bei 2560 × 1440 mit dem Testbeispiel: Die Stationen füllen Breite und Höhe. **Entscheidung des Nutzers:** Ändert sich das Fenster nach dem Öffnen, wird nicht automatisch nachgeführt; dafür gibt es „An Fenster anpassen“.

### G3 · Balkenbeschriftung „ID“ zeigt bei echten Daten nur „T…“ (Mittel)

- **Wo:** Segmentbeschriftung in `src/features/yamazumi/yamazumi-chart.tsx` (Kürzung mit `truncate`)
- **Beobachtung:**
  - Echte IDs aus dem Konverter haben die Form `T19-AA010A` (E24).
  - In schmalen Balken wird von rechts gekürzt. Übrig bleibt bei **jedem** Arbeitsgang „T…“, bei der großen Linie in allen 160 Balken.
  - Die Station steht aber ohnehin unter der Spalte.
- **Folge:** Die Beschriftung „ID“ ist mit echten Daten nutzlos. Man muss jeden Balken einzeln anfahren, um ihn zu erkennen.
- **Vorschlag:** Im Diagramm den Stationsvorsatz weglassen, wenn die ID mit der Stationsbezeichnung beginnt (`AA010A`). Tooltip, Panel und Tabelle zeigen weiter die volle ID. Aufwand: klein, mit Unit-Test.
- **Status: behoben (27.10.2026).** `chartStepId` in `src/lib/format.ts` lässt den Vorsatz weg, wenn die ID mit der Bezeichnung der aktuellen Station plus Trennzeichen beginnt (`T19-AA010A` an T19 → `AA010A`). Ein an eine andere Station verschobener Arbeitsgang behält die volle ID. Unit-Test in `format.test.ts`.

### G4 · Tabelle auf dem Laptop: Spalte „Hinweise“ abgeschnitten, Warnzeilen sehr hoch (Mittel)

- **Wo:** `src/features/table/step-table.tsx`
- **Beobachtung:**
  - Bei 1366 px Breite endet die Tabelle mit „Hi…“, ohne erkennbaren Hinweis auf seitliches Scrollen.
  - Der Warntext wird in die verbleibende Restbreite gepresst. Zeilen ohne Mitarbeiter werden dadurch rund 150 px hoch statt 37 px, und vom Text ist nur das Warnsymbol zu sehen.
  - Bei 1920 px ist alles in Ordnung.
- **Folge:** Gerade die Zeilen, die Aufmerksamkeit brauchen, sind auf dem Laptop am schwersten zu lesen.
- **Vorschlag:**
  - Auswahlfelder schmaler setzen: Station und Kategorie haben Platz übrig.
  - Den Hinweistext unter der Zeile über die volle Breite zeigen statt in einer eigenen Spalte.
  - Aufwand: klein.
- **Status: behoben (27.10.2026).** Spalte „Hinweise“ entfällt; Hinweise stehen in einer eigenen Zeile direkt unter dem Arbeitsgang über die Breite ab „Beschreibung“, mit derselben Warnmarkierung. Station und Kategorie sind so breit wie ihr Inhalt. Bei 1280 px passt die Tabelle ohne seitliches Scrollen. Browsertest `table.spec.ts` zählt die Hinweiszeilen mit.

### G5 · Personalplanung: Datei-Auswahl im Browserstil, Spalten bei 1366 px abgeschnitten (Niedrig)

- **Wo:** `src/features/staffing/staffing-workspace.tsx`
- **Beobachtung:**
  - Der Dateiwähler ist das ungestaltete Browserfeld. Im Test erschien „Choose File“; in einem deutschen Browser steht „Datei auswählen“.
  - Der Import auf der Szenarioseite nutzt dagegen einen gestalteten Knopf.
  - Die Tabelle „Produktiver Abgleich je Station“ endet bei 1366 px mit „Stationshö…“.
  - „Kostenstelle“ und „Teamsprecher“ sind als Text rechtsbündig unter linksbündigen Überschriften.
- **Folge:** Uneinheitlicher Eindruck. Inhaltlich ist nichts falsch.
- **Vorschlag:** Denselben Datei-Knopf wie beim Import verwenden, Textspalten linksbündig setzen und die Tabelle seitlich scrollbar mit sichtbarem Rand gestalten. Aufwand: klein.
- **Status: behoben (27.10.2026).** Datei-Knopf „Datei auswählen“ wie beim Szenarioimport, daneben der gewählte Dateiname. Kostenstelle, Teamsprecher und Station sind linksbündig. Spaltenköpfe dürfen umbrechen; bei 1366 px passt die Tabelle „Produktiver Abgleich je Station“ ohne seitliches Scrollen (gemessen: Inhalt so breit wie der Kasten).

### G6 · Tastaturfokus auf Diagrammbalken kaum sichtbar (Niedrig)

- **Wo:** Fokusring der Segmente (`yamazumi-chart.tsx`), allgemein `--ring` in `src/app/globals.css`
- **Beobachtung:**
  - Mit der Tab-Taste erreicht man alle Bedienelemente in sinnvoller Reihenfolge.
  - Der Fokusring ist auf Knöpfen ein blasser hellblauer Rand. Auf den petrolfarbenen Balken ist er kaum zu erkennen: dunkelblau mit geringer Deckkraft.
- **Folge:** Wer per Tastatur arbeitet, verliert auf dem Diagramm den Überblick. Im Workshop ist das selten, weil dort meist mit der Maus gearbeitet wird.
- **Vorschlag:** Auf Segmenten einen deutlichen Fokusring in Weiß mit dunkelblauem Außenrand. Aufwand: klein.
- **Status: behoben (27.10.2026).** Fokus auf Balken mit dunkelblauem Umriss und weißem Innenrand (Pseudoelement), damit er auch auf verschobenen Arbeitsgängen und Suchtreffern sichtbar bleibt. Per Tastatur geprüft. Der allgemeine `--ring` bleibt unverändert.

### G7 · Kleinigkeiten in Wortwahl und Schreibweise (Niedrig)

- Im Detailpanel steht „HINWEISE“ in Großbuchstaben. Alle anderen Beschriftungen sind normal geschrieben.
- Die Mitarbeiteransicht beschriftet Spuren mit „MA 1“, überall sonst steht „Mitarbeiter 1“. Unter der Station steht „3 MA“. Das ist als Abkürzung in Ordnung, sollte aber an einer Stelle erklärt sein, z. B. in der Legende.
- **Status: behoben (27.10.2026).** „Hinweise“ im Detailpanel normal geschrieben. Die Legende erklärt „MA = Mitarbeiter“; die Abkürzung bleibt unter den Stationen und in der Mitarbeiteransicht.

## Hinweise ohne Handlungsbedarf

- **Gut gelöst:**
  - Markenfarben werden zurückhaltend eingesetzt.
  - „Ohne Mitarbeiter“ (orange schraffiert) und berechnete Wartezeit (grau schraffiert) sind klar getrennt.
  - Die Taktlinie hat einen Wert; Überlast ist rot markiert, und die Markierung „unvollständig“ steht direkt an den betroffenen Kennzahlen.
  - Die schreibgeschützte Ist-Seite im Vergleich ist klar benannt.
  - Leerzustände und Hinweise sind verständlich formuliert und sagen, was zu tun ist („Zuordnen per Klick auf den Arbeitsgang“).
- **Einmalige Anzeige ohne Befund:** Im Entwicklungsmodus zeigte Next.js einmal „1 Issue“ auf der Personalplanung. In einem gezielten Nachlauf mit demselben Ablauf gab es keinen einzigen Konsolenfehler. Das ist kein Befund, solange es nicht wieder auftritt.
- Der runde Knopf „N“ unten links in den Screenshots ist das Entwicklungswerkzeug von Next.js und erscheint im Produktivbetrieb nicht.
