# Prüfcheckliste Oberfläche

Inhalt: 1 Spezifikation · 2 Bildschirmklassen · 3 Corporate Design · 4 Sprache und Zahlen · 5 Zustände · 6 Bedienung und Rückmeldung · 7 Diagramm · 8 Tastatur und Barrierefreiheit · 9 Rollen und Sperre · 10 Exporte · 11 Tempo und Stabilität · 12 Gestaltungsqualität

Jeder Abschnitt nennt **wo** du suchst, **was** du prüfst und **bekannte Fehlerarten** aus früheren Berichten (`docs/reviews/2026-10-26-gestaltung.md`). Die bekannten Fehler sind behoben – sie zeigen, wo ähnliche wahrscheinlich sind.

---

## 1 · Spezifikation

**Wo:** `docs/spezifikation/01_ANFORDERUNGEN.md`, `docs/OFFENE_ENTSCHEIDUNGEN.md` (entschiedene E-Nummern), `docs/ENTWICKLUNGSPLAN.md`.

**Prüfen**

- Jede als umgesetzt geführte UI-Anforderung ist sichtbar und bedienbar. Stichprobe: Anforderung lesen → in der App suchen → Abweichung notieren. Besonders: F34 Vollbild, F48 ein aktives Szenario klar sichtbar, F49/F122 Vergleich mit schreibgeschütztem Ist, F52 Diagrammexport mit Taktlinie und Stationen, F95 direktes Ziehen ohne Fenster, F110 Reiter Ist/Ziel, F125 drei Bildschirmklassen, F132 Tabellenansicht, F136 Mitarbeiteransicht, F139 Rückfrage vor problematischem Verschieben, F140 gemeinsame Arbeitsgänge.
- Das Projekt ist über den MVP hinaus. Maßstab ist der aktuelle Stand in `ENTWICKLUNGSPLAN.md` (Einträge „Stand …“), nicht die MVP-Abgrenzung (F42–F47, Abschnitt „Später“). Neuere Funktionen sind ausdrücklich zu prüfen, z. B. F141 Qualifikation je Arbeitsgang (Rückfrage und Warnung), F142 Verteilungsvorschlag (Panel „Verteilung vorschlagen“, Ergebnis als neues Szenario im Vergleich; Anforderungen F4, F9, F16: erklärbar, Restriktionen beachtet, überlastete Stationen im Blick).
- Keine Funktion in der Oberfläche, die eine noch **offene** Entscheidung (E-Nummer ohne Beschluss) vorwegnimmt. Gibt es eine Funktion ohne Eintrag im Entwicklungsplan, als Frage notieren, nicht als Befund.

## 2 · Bildschirmklassen (F125)

**Wo:** Bilder des automatischen Laufs bei 1366 × 768, 1920 × 1080, 2560 × 1440.

**Prüfen**

- Laptop: Diagramm im ersten Bild sichtbar (Oberkante laut Messung; Richtwert ≤ 400 px), Kennzahlen und Werkzeugleiste ohne Scrollen erreichbar, nichts überdeckt das Diagramm.
- Workshop-Bildschirm: Diagramm nutzt Breite und Höhe; Beschriftungen, Taktlinie und Werte aus 3–4 m Abstand lesbar (Schrift im Bild auf 50 % verkleinert noch lesbar?).
- Tabellen: wichtige Spalten nicht abgeschnitten; waagerechtes Scrollen nur innerhalb der Tabelle, nie der ganzen Seite.
- Panels (Details, Hinweise) und Popover passen in den sichtbaren Bereich.

**Bekannte Fehlerarten:** Kopfbereich schob das Diagramm auf dem Laptop auf 600 px (G1); Diagramm auf 2560 px klein mit leerer Fläche darunter (G2); Spalte „Hinweise“ abgeschnitten (G4); Spalten der Personalplanung bei 1366 px abgeschnitten (G5).

## 3 · NEONEX Corporate Design (E30, F46)

**Wo:** `src/app/globals.css` (`--nx-*`, `--primary`, `--chart-*`), `src/app/layout.tsx` (Inter, Albert Sans), `public/brand/`, `src/components/ui/`.

**Prüfen**

- Nur Farben aus den Variablen; keine fest eingetragenen Farbwerte in Komponenten (`grep -rnE "#[0-9a-fA-F]{3,6}\b|rgb\(" src/features src/app --include=*.tsx`).
- Überschriften Albert Sans, Text Inter; einheitliche Größenstufen und Abstände zwischen gleichartigen Seiten.
- Gleiche Bedeutung, gleiche Farbe auf allen Seiten (Überlast, unvollständig, ohne Mitarbeiter, verschoben, Suchtreffer).
- Neue Seiten verwenden die vorhandenen Bausteine (Button, Card, Table, Alert …) statt eigener Nachbauten.
- Werkzeugcharakter: keine dekorativen Animationen, keine Werbeseiten-Elemente.

## 4 · Sprache und Zahlen

**Wo:** sichtbare Texte, `title`, `aria-label`, Platzhalter, Fehlermeldungen; `src/lib/format.ts`.

**Prüfen**

- Alles Deutsch, auch Meldungen aus Bibliotheken (Datei-Auswahl, Validierung des Browsers, Next.js-Fehlerseiten).
- Zahlen mit Komma und zwei Nachkommastellen (F80, F84, P2), Prozent mit Leerzeichen („112,50 %“), Einheiten benannt (min, %, MA).
- Gleiche Dinge heißen überall gleich (Arbeitsgang/Arbeitsschritt, Mitarbeiter/MA, Szenario/Variante). Abkürzungen an einer Stelle erklärt.
- Schreibweise: korrekte Umlaute und „…“, keine Großbuchstaben-Beschriftungen, Sätze statt Fachjargon.
- Meldungen sagen, was zu tun ist („Zuordnen per Klick auf den Arbeitsgang“).

**Bekannte Fehlerarten:** „HINWEISE“ in Großbuchstaben, „MA“ unerklärt (G7); Datei-Auswahl im Browserstil (G5).

## 5 · Zustände

**Prüfen** – jeweils mit einer Anzeige, die erklärt, was los ist und was zu tun ist:

- Leer: kein Projekt, kein Szenario, Station ohne Arbeitsgänge, keine Mitarbeiter, kein Suchtreffer im Filter.
- Fehlerhaft: Import mit Fehlern (Korrekturvorschau F31/F81/F85), ungültige Eingabe (Punkt statt Komma, 0 min, negative Werte), Ladefehler.
- Unvollständig: Arbeitsgänge ohne Mitarbeiter oder Station, „Ergebnis unvollständig“ direkt an den betroffenen Kennzahlen.
- Laden: kein Springen des Layouts, keine leeren Diagramme ohne Hinweis.
- Gesperrt / schreibgeschützt: Ist im Vergleich, Szenario von anderer Person geöffnet (Sperre), Konflikt beim Speichern.
- Speichern: Zustand sichtbar („gespeichert“ erst nach Serverbestätigung, F37), Fehler nicht verschluckt.

## 6 · Bedienung und Rückmeldung

**Wo:** `src/features/workspace/`, `src/features/yamazumi/`, `src/features/table/`.

**Prüfen**

- Ziehen (F95): Ablageziel sichtbar, nach dem Ablegen sofort neu berechnet; bei problematischem Verschieben Rückfrage (F139); Stationswechsel entfernt die Mitarbeiterzuordnung (F61) erkennbar.
- Rückgängig/Wiederholen (F26, F65) für Verschieben, Zuordnen, Takt, Zuschlag, Kategorien; Knöpfe zeigen, ob etwas rückgängig gemacht werden kann.
- Vollbild (F34): Bedienelemente und Kennzahlen ausblendbar, Rückweg klar („Vollbild beenden“, Esc).
- Ist/Ziel (F110): welches Szenario aktiv bearbeitet wird, ist jederzeit erkennbar (F48).
- Klickwege für häufige Aufgaben kurz; Schaltflächen dort, wo man sie erwartet; destruktive Aktionen (Löschen) mit Bestätigung.
- Filter und Suche: Wirkung sichtbar, Zurücksetzen möglich.

## 7 · Diagramm (Yamazumi)

**Prüfen**

- Taktlinie mit Wert, Überlast deutlich markiert, Balkenhöhe und Werte passen zusammen (Stichprobe Beispiel E7: Mitarbeiter 1 4,50 min, 112,50 % bei Takt 4).
- Beschriftungen bei echten IDs (`T17-AA010`) aussagekräftig, nicht nur „T…“; Tooltip/Details zeigen den vollen Inhalt.
- Wartezeit und „ohne Mitarbeiter“ klar unterscheidbar; Legende erklärt alle Muster und Farben.
- Kleine Arbeitsgänge (< 1 min) noch anklickbar und ziehbar.
- Stationsansicht und Mitarbeiteransicht konsistent (gleiche Farben, gleiche Werte).

**Bekannte Fehlerarten:** Beschriftung „ID“ zeigte bei echten Daten nur „T…“ (G3).

## 8 · Tastatur und Barrierefreiheit

**Prüfen**

- Alle Bedienelemente per Tab erreichbar, Reihenfolge folgt dem Bild; kein Fokus verschwindet hinter Panels.
- Fokus überall deutlich sichtbar, auch auf farbigen Balken.
- Esc schließt Panels und Popover; Enter/Leertaste lösen Knöpfe aus; es gibt eine Alternative zum Ziehen (z. B. Verschieben über Detailpanel).
- Jedes Bedienelement hat einen zugänglichen Namen (`aria-label`, Beschriftung); Regionen und Tabellen benannt.
- Kontrast: Text ≥ 4,5 : 1, große Schrift und Symbole ≥ 3 : 1 – besonders hellgraue Hinweise und Text auf Petrol/Koralle. Farben aus `globals.css` nachrechnen.
- Information nie nur über Farbe (Überlast zusätzlich mit Symbol oder Text).

**Bekannte Fehlerarten:** Fokusring auf petrolfarbenen Balken kaum sichtbar (G6).

## 9 · Rollen und Sperre

**Prüfen** (soweit im lokalen Modus darstellbar, sonst anhand des Codes in `src/features/projects/`, `src/features/workspace/`):

- Owner und Editor sehen nur, was sie dürfen; nicht erlaubte Aktionen sind ausgeblendet oder deaktiviert mit Erklärung – nicht erst beim Absenden abgelehnt.
- Szenariosperre: Wer ein gesperrtes Szenario öffnet, erfährt, wer es bearbeitet und was er tun kann.
- Login und Projektcode (`/login`, `/join`): verständliche Texte, Fehlermeldungen ohne technische Details; nur ansehen, nichts absenden.

## 10 · Exporte

**Prüfen**

- Excel-Export (F35, F45, F138) und Diagrammexport (F52): Datei lässt sich erzeugen; Diagrammbild enthält Taktlinie und Stationsbezeichnungen, ist ohne Bedienelemente und gut lesbar.
- Dateinamen sprechend und ohne Sonderzeichenprobleme.
- Inhalte stichprobenhaft öffnen (Excel mit `exceljs` im Scratchpad lesen, Bild mit dem Read-Werkzeug ansehen).

## 11 · Tempo und Stabilität

**Prüfen**

- Ladezeit bis zum fertigen Diagramm mit der großen Linie (Messung des automatischen Laufs); Richtwert: unter 2 s lokal. Die Spezifikation nennt bis zu 20 Stationen und 500 Arbeitsschritte (F42); der Verteilungsvorschlag (F142) sollte mit der großen Linie in vertretbarer Zeit ein Ergebnis liefern und währenddessen Fortschritt zeigen – bei Verdacht mit 500 Arbeitsgängen nachmessen.
- Ziehen und Filtern ohne spürbare Verzögerung.
- Keine Konsolenfehler, keine Hydrationsfehler, keine fehlgeschlagenen Anfragen. Das Next.js-Symbol „N“ unten links ist das Entwicklungswerkzeug – kein Befund. Eine einmalige Next.js-Meldung „Issue“ nachlaufen lassen, bevor sie Befund wird.

## 12 · Gestaltungsqualität

„Modern“ heißt hier: aufgeräumt, einheitlich und hochwertig **innerhalb** des NEONEX Corporate Design – kein neuer Look, keine neuen Farben oder Schriften, keine Effekte (Projekthinweis in `frontend-design`). Maßstab ist die beste Seite der App: Was dort gelöst ist, soll überall so aussehen.

**Wo:** alle Bilder, besonders Seiten nebeneinander bei Desktop; Abschnitte „Browser-Standardelemente“, „Knopfstile“ und „Gleicher Knopf, verschiedene Stile“ in `ergebnis.md`; `src/components/ui/`.

**Prüfen**

1. **Einheitliche Bausteine:** Auswahllisten, Knöpfe, Optionsfelder, Kästchen, Datei-Auswahl und Aufklapper verwenden die gestalteten Bausteine aus `src/components/ui/`, keine Browser-Standardelemente. Fehlt ein Baustein (z. B. Select, RadioGroup), ist das ein Befund mit Vorschlag, ihn über shadcn/ui zu ergänzen.
2. **Raster und Abstände:** gleiche Abstände zwischen gleichartigen Elementen, gleiche Innenabstände in Karten, Kanten sauber aneinander ausgerichtet (Kopf, Karten, Tabellen, Werkzeugleiste). Wenige Eckenradien und Schatten (Messung: mehr als etwa 4 Radien bzw. 3 Schatten je Seite genauer ansehen).
3. **Typografische Hierarchie:** klare Stufen Seitentitel → Abschnitt → Beschriftung → Wert → Hinweis; wenige Schriftgrößen (Richtwert ≤ 7 je Seite außerhalb des Diagramms) und Grautöne; Überschriften Albert Sans, Text Inter; Zahlen in Tabellen rechtsbündig mit gleichbreiten Ziffern.
4. **Visuelle Gewichtung:** je Bereich genau eine Hauptaktion hervorgehoben (gefüllter Knopf), Nebenaktionen zurückgenommen; Warnungen nur dort farbig, wo wirklich gewarnt wird.
5. **Informationsdichte:** passend für ein Arbeitswerkzeug – keine großen Kacheln mit einer Zahl und viel Leerraum, aber auch kein Gedränge. Gleiche Information (z. B. Kennzahlen) auf allen Seiten in gleicher Form.
6. **Rückmeldung bei Bedienung:** Hover, Drücken, Auswahl, Ziehen, Laden und Speichern sichtbar; Übergänge kurz (≈ 150–250 ms) und nur dort, wo sie zeigen, was sich geändert hat. Stichprobe im Browser mit `page.hover()` und Bild davor/danach.
7. **Symbole:** nur lucide, gleiche Größe und Strichstärke je Stufe, Symbol und Text gleichmäßig ausgerichtet; keine Symbole ohne Bedeutung.
8. **Diagramme und Tabellen:** gemessen am Skill `dataviz` – ruhige Achsen und Gitterlinien, Beschriftungsdichte passend zur Balkenbreite, Farbsystem konsistent und farbenblind unterscheidbar, Legende vollständig; Tabellen mit klarer Kopfzeile, dezenten Trennlinien und gleichen Zeilenhöhen.
9. **Gesamteindruck je Seite:** Seiten nebeneinander vergleichen. Wirkt alles wie eine App, oder wirken einzelne Seiten älter oder anders gebaut? Befund nur mit konkretem Unterschied (Element, Seite A vs. Seite B).

**Belegen:** Bildausschnitte zweier Seiten gegenüberstellen oder Messwert nennen. „Wirkt altmodisch“ allein ist kein Befund.

**Bekannte Fehlerarten (Probelauf 10.11.2026, noch nicht im Bericht):** Browser-Auswahllisten auf Personalplanung und Import (Ist/Ziel im Kopf sind technisch ebenfalls Browser-Listen, aber gerahmt – Messung zählt sie mit, im Bild entscheiden); „Datei auswählen“ beim Import gefüllt dunkelblau, auf der Personalplanung hellgrau; ungestaltete Optionsfelder „Neue Variante / Bestehende Variante“; große Kennzahlenkacheln auf der Personalplanung, im Szenario dagegen eine schmale Kennzahlenleiste; Aufklapper mit Browser-Dreieck auf der Personalplanung.
