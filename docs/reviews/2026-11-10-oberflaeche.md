# Oberflächenprüfung 2026-11-10

**Stand:** Commit `21e8140`; nicht committet sind nur die eigenen Dateien des neuen Skills `ui-review` und eine Zeile in `AGENTS.md` (Claude) · **Maßstab:** Spezifikation (bis F142), NEONEX Corporate Design (E30), F125, Skill `frontend-design` mit Projekthinweis, Checkliste `ui-review` einschließlich Abschnitt 12 Gestaltungsqualität · **Umfang:** alle Seiten und Ansichten; Schwerpunkt auf den Funktionen seit der Gestaltungsprüfung vom 26.10. (Löschen, Sperre, Export, Prozesszeiten, Mitarbeiteransicht, F137–F142)

**Vorgehen:**

- **Automatischer Lauf** (`ui-review`) mit 128 Bildschirmfotos und Messungen. Lokaler Modus, je drei Auflösungen: 1366 × 768 (Laptop), 1920 × 1080 (Desktop), 2560 × 1440 (Workshop-Bildschirm). Zwei Datensätze:
  - das Beispiel E7 mit Personalplanung;
  - eine realistische Linie mit 20 Stationen, 60 Mitarbeitern und 160 Arbeitsgängen. Die IDs folgen dem Konverterformat (`T17-AA010`), Takt 70 min, 10 % Zuschlag; die meisten Stationen liegen unter Takt, T22 deutlich darüber.
- **Abläufe zusätzlich durchgespielt** mit einem temporären Skript und 31 Bildern:
  - Leerzustand, falsche Datei, ungültige Eingaben, Suche ohne Treffer;
  - Ziehen mit Rückfrage (F139), Verschieben, Rückgängig, Detailpanel auf dem Laptop, Hinweise;
  - Export als PNG und Arbeitsfolge (beide Dateien geöffnet);
  - Qualifikation (F141), Verteilungsvorschlag (F142) und Vergleich;
  - Sonderfälle Prozesszeit (F135) und gemeinsame Arbeitsgänge (F140).
- **Von Hand:** Kontraste aus `globals.css` nachgerechnet, Code-Stellen nachgesehen.
- Bildschirmfotos liegen nur lokal unter `%TEMP%\linebalancing-ui-review\`.

## Zusammenfassung

Die App ist stabil und sprachlich sauber:

- keine Konsolenfehler, nirgends seitlicher Überlauf;
- der Tastaturfokus ist überall sichtbar;
- Ladezeiten liegen unter 2 s (Tabelle mit 160 Arbeitsgängen: 1–2 s);
- Leer- und Fehlerzustände sind gut erklärt.

Die neuen Funktionen sind verständlich beschriftet:

- Gruppe und Qualifikation sind im Detailpanel und Tooltip gut erklärt;
- das Vorschlags-Panel sagt klar, dass ein neues Szenario entsteht.

Die größten Hürden liegen dort, wo die App ihren Hauptzweck hat, dem Diagramm im Workshop:

- Auf dem großen Bildschirm wachsen Balken und Fläche, aber alle Beschriftungen bleiben bei 10–11 px.
- Bei einer realistischen Linie sind in der Mitarbeiteransicht die Namen nicht lesbar.
- Bestätigte Regelverstöße (nicht qualifiziert, Vorgänger) sieht man im Diagramm nicht.

Bei der Gestaltungsqualität wirkt die App noch nicht aus einem Guss. Die Ursachen:

- Browser-Dialoge für Rückfragen;
- Browser-Auswahllisten neben gestalteten Bausteinen;
- drei verschiedene Navigationsmuster;
- uneinheitliche Seitenbreiten.

**Empfehlung:** U1 und U2 vor dem nächsten Workshop beheben. Danach U5, U6 und U11 als Paket „einheitliche Bausteine und Rückfragen“ angehen.

## Automatischer Lauf

| Ansicht                                         | Auflösung | Auffälligkeiten                                                                                                          | Bewertung                    |
| ----------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| alle                                            | alle      | keine Konsolenfehler, kein Überlauf, keine Bedienelemente ohne Namen außer zwei unsichtbaren Fokusfängern im Seitenpanel | gut                          |
| Stationen, Mitarbeiter                          | alle      | 24–30 Texte unter 12 px (Beispiel), 300–480 (Linie); Diagramm beginnt bei 376 px (Laptop/Desktop), 336 px (Workshop)     | U1, U2, U3                   |
| Vergleich                                       | Laptop    | Diagramme beginnen bei 588–628 px                                                                                        | U4                           |
| Tabelle                                         | Laptop    | Spalten ab „Vorgänger“ außerhalb des sichtbaren Bereichs                                                                 | U10                          |
| Import, Personalplanung, Vorschlag, Detailpanel | alle      | 2–6 Browser-Standardelemente je Ansicht                                                                                  | U11                          |
| Import / Personalplanung                        | Desktop   | „Datei auswählen“ in zwei Stilen (gefüllt dunkelblau / hellgrau)                                                         | U11                          |
| Vorschlag                                       | alle      | Screenreader-Text „Close“                                                                                                | U14                          |
| Import-Korrektur                                | alle      | „0.5“ mit Dezimalpunkt                                                                                                   | U14                          |
| Personalplanung                                 | alle      | „1.1“ und „null“ gemeldet – Formatname „Personalplanung 1.1“ bzw. deutsches Wort „null“                                  | kein Befund                  |
| alle                                            | alle      | 3–7 Schriftgrößen je Seite außerhalb des Diagramms, nur Inter und Albert Sans, 1–8 Eckenradien                           | gut (Richtwerte eingehalten) |

## Befunde

### U1 · Diagrammbeschriftungen am Workshop-Bildschirm nicht lesbar (Hoch)

- **Wo:** Stations- und Mitarbeiteransicht, Vergleich, Vollbild; 1920 × 1080 und 2560 × 1440. `src/features/yamazumi/yamazumi-chart.tsx`, z. B. `text-[10px]`.
- **Beobachtung:** Balken und Diagrammfläche wachsen mit dem Bildschirm und mit „An Fenster anpassen“, die Schrift wächst nicht mit. Feste Größen bei 2560 × 1440:
  - Arbeitsgang-Beschriftung („A · 2,00“) 10 px;
  - Überlastwert („4,85“) und Takt-Marke 10–11 px;
  - Stationsbelegung („121,25 %“), „2 MA“, Spurnamen („MA 1“) und Achsenwerte 11 px.

  Im Beispiel stehen auf 850 px breiten Balken 10-px-Beschriftungen.

- **Folge:** Am Beamer oder großen Bildschirm kann aus 3–4 m Abstand niemand Takt, Überlastwert oder Arbeitsgang ablesen. Dabei ist genau das der Zweck der Workshop-Darstellung (F125, F91/F92/F94).
- **Beleg:** `beispiel-stationen-2560x1440.png`, `linie-stationen-2560x1440.png`, `beispiel-vollbild-1920x1080.png`. Messung „Schrift < 12 px“: 24 Texte im Beispiel, bis 352 bei der Linie, unabhängig von der Auflösung.
- **Vorschlag:** Schriftgröße im Diagramm an die Zeitskala bzw. Spurbreite koppeln, mit einer Untergrenze von 10 px und einer Obergrenze von etwa 18 px. Mindestens im Vollbild eine Stufe „große Schrift“ anbieten. Aufwand: mittel.
- **Status: behoben (10.11.2026).** Schriftgrößen im Diagramm wachsen mit der Zeichenfläche (Werte, Achse, Takt-Marke, Namen bis Faktor 1,6) und in den Balken mit der Spurbreite (10–18 px), `chartFonts` in `yamazumi-chart.tsx`. Bei 2560 × 1440 jetzt z. B. Stationsname 22 px, Werte 18 px, Balkenbeschriftung 18 px.

### U2 · Mitarbeiteransicht: Namen bei realistischer Linie nicht lesbar (Hoch)

- **Wo:** Mitarbeiteransicht mit der Linie (60 Mitarbeiter), 1920 × 1080 und 1366 × 768.
- **Beobachtung:**
  - Unter fast allen Balken steht nur „M…“, ausgeschrieben sind lediglich „MA 1“ und „MA 7“.
  - Die Belegungswerte darunter laufen ineinander („158,25 % 157,14 % 104,89 %“).
  - Erkennbar ist nur die senkrechte Stationsbeschriftung am Balken.
- **Folge:** Die Mitarbeiteransicht (F136) soll zeigen, welcher Mitarbeiter wie belegt ist. Im Workshop kann man nicht sagen, wessen Balken über Takt liegt, ohne jeden einzeln anzufahren.
- **Beleg:** `linie-mitarbeiter-1920x1080.png`, `linie-mitarbeiter-1366x768.png`.
- **Vorschlag:**
  - Nur die Nummer zeigen („1“, „17“; Legende erklärt „MA“) oder die Beschriftung drehen.
  - Belegung nur zeigen, wenn Platz ist, sonst im Tooltip.
  - Beim Einpassen eine Mindestbreite je Balken einhalten, damit die Nummer passt.
  - Aufwand: klein bis mittel.
- **Status: behoben (10.11.2026).** Namen unter den Mitarbeiterbalken passend gekürzt („MA 17“, bei Platzmangel „17“), Belegungswerte nur in passender Größe, sonst im Tooltip (`employeeShortLabel`, `FittingText`). Linie bei 1920 × 1080: „MA 1“ bis „MA 32“ lesbar, keine Überlappung.

### U3 · Stationsansicht bei realistischer Linie: Spurnamen überlappen, IDs nur „AA…“ (Mittel)

- **Wo:** Stationsansicht mit der Linie, alle Auflösungen.
- **Beobachtung:**
  - Die Spurnamen unter den Balken schieben sich ineinander: „MA 25MA 26“ bei 2560 px, „A1A1A1“ auf dem Laptop.
  - Die Balkenbeschriftung „ID“ kürzt `T17-AA010` zu „AA…“. Gerade der unterscheidende Teil (010, 020 …) fehlt, alle Balken heißen gleich.
  - G3 wurde für breite Spuren behoben, bei drei Mitarbeitern je Station tritt das Problem wieder auf.
- **Folge:** Man erkennt weder, welche Spur welcher Mitarbeiter ist, noch welcher Arbeitsgang welcher ist. Mit „Text“ oder „Dauer“ wird es nicht besser.
- **Beleg:** `linie-stationen-2560x1440.png`, `linie-stationen-1366x768.png`.
- **Vorschlag:**
  - Spurnamen auf die Nummer kürzen und bei Platzmangel ausblenden.
  - Bei IDs mit gleichem Vorsatz das Ende zeigen („…010“ statt „AA…“); `chartStepId` in `src/lib/format.ts` entsprechend erweitern.
  - Aufwand: klein.
- **Status: behoben (10.11.2026).** Spurnamen ohne Überlappung (Nummer bei schmalen Spuren); Beschriftung mit Vorrang für das unterscheidende Ende der ID („…010“), passt gar nichts, bleibt der Balken leer statt „A…“ (`segmentLabel`, `fitStepId`, Unit-Tests). Gilt auch für den Export.

### U4 · Vergleich auf dem Laptop: Diagramme erst ab der Mitte (Mittel)

- **Wo:** Vergleich, 1366 × 768. Kennzahlentabelle und Werkzeugleiste stehen über den Diagrammen.
- **Beobachtung:** Die Diagramme beginnen bei 588 px (Linie: 628 px). Sichtbar sind 140–180 px, also nur Takt-Marke und Balkenspitzen.
- **Folge:** Für den eigentlichen Vergleich muss man scrollen, dabei verschwinden die Kennzahlen. Im Workshop am Laptop ist das der häufigste Fall.
- **Beleg:** `beispiel-vergleich-1366x768.png`, `linie-vergleich-1366x768.png`.
- **Vorschlag:**
  - Kennzahlenvergleich einklappbar machen oder als schmale Leiste wie im Einzelszenario zeigen (Kennzahl · Ist → Ziel · Veränderung, 2–3 Zeilen).
  - Die übrigen Zeilen unter „Weitere Kennzahlen“.
  - Aufwand: mittel.
- **Status: behoben (10.11.2026).** Kennzahlenvergleich gedreht (Kennzahlen als Spalten, Ist/Ziel/Veränderung als Zeilen). Diagramme beginnen bei 1366 × 768 bei 440 px statt 588 px (Linie: 480 statt 628 px). Browsertest `compare.spec.ts` angepasst.

### U5 · Rückfragen und Meldungen als Browser-Dialoge (Mittel)

- **Wo:** zehn Stellen mit `window.confirm`/`window.alert`. Die wichtigsten:
  - Rückfrage beim Verschieben (F139) und bei nicht qualifizierten Mitarbeitern (F141), `use-scenario-editor.ts:88, 97`;
  - Szenario löschen, `scenario-list.tsx:59`;
  - Projekt löschen oder verlassen, `project-list.tsx:118, 220`;
  - Sperre, `lock-notice.tsx:55`;
  - Export- und Speicherfehler, `export-menu.tsx:51`, `workspace.tsx:388, 419`;
  - Abmeldung, `project-controls.tsx:12`.
- **Beobachtung:**
  - Die Dialoge kommen vom Browser: grau, mit „localhost:3000 meldet“ bzw. später der Domain als Überschrift und Knöpfen „OK/Abbrechen“.
  - Die Rückfrage F139 steht als Fließtext mit Pfeilen und Leerzeilen: „Wenn B an Station T18 verschoben wird, … B → C … Trotzdem verschieben?“.
  - Lassen sich nicht im NEONEX-Design gestalten.
- **Folge:**
  - Mitten im Ziehen springt ein Fenster im Browserstil auf, das nicht zur App gehört.
  - „OK“ sagt nicht, was passiert („Verschieben“ wäre eindeutig).
  - Beim Löschen ist das gefährlich. Browser bieten zudem „weitere Dialoge unterdrücken“ an; danach fragt die App gar nicht mehr nach.
- **Beleg:** Protokoll des Ablaufs (`ablauf.md`), Code-Stellen oben.
- **Vorschlag:**
  - Ein gestalteter Bestätigungsdialog (shadcn `AlertDialog`) mit klarer Aktion („Trotzdem verschieben“ / „Abbrechen“).
  - Verletzte Beziehungen als Liste, Löschen mit rotem Knopf.
  - Fehler als Hinweis im Seitenkopf statt `alert`.
  - Aufwand: mittel; Browsertests, die `dialog`-Ereignisse abfangen, anpassen.
- **Status: behoben (10.11.2026).** Gestalteter Bestätigungsdialog (`src/components/confirm-dialog.tsx`, Base UI AlertDialog) mit klarer Aktion („Trotzdem verschieben“, „Trotzdem zuordnen“, „Endgültig löschen“ rot), verletzte Beziehungen als Liste. Alle zehn `window.confirm`/`window.alert`-Stellen ersetzt; die fachlichen Texte bleiben im Rechenkern. Browsertests (`table`, `qualification`, `cloud`) klicken jetzt die Dialogknöpfe.

### U6 · Bestätigte Regelverstöße sind im Diagramm nicht zu sehen (Mittel)

- **Wo:** Stations- und Mitarbeiteransicht. Nach „Trotzdem zuordnen“ (F141) bzw. „Trotzdem verschieben“ (F139).
- **Beobachtung:**
  - Der Balken des nicht qualifizierten bzw. regelwidrig verschobenen Arbeitsgangs sieht aus wie jeder andere.
  - Nur der Zähler „Hinweise (3)“ ändert sich.
  - In Tabelle und Detailpanel steht die Warnung.
  - Im Diagramm gibt es nur die Kennzeichnung „ohne Mitarbeiter“, keine für Warnungen am Arbeitsgang.
- **Folge:** F141 verlangt, dass die Zuordnung „als Warnung sichtbar bleibt“. Im Workshop arbeitet man im Diagramm. Wer später auf das Szenario schaut, sieht dort nicht, dass C von jemandem ohne Qualifikation gemacht wird.
- **Beleg:** `ablauf-qualifikation-warnung-diagramm.png` (C bei Mitarbeiter 2 ohne Markierung), `ablauf-qualifikation-warnung-tabelle.png`.
- **Vorschlag:** Kleines Warnsymbol bzw. eine Warnecke am Balken für Arbeitsgänge mit Hinweisen, erklärt in der Legende. Aufwand: klein bis mittel.
- **Status: behoben (10.11.2026).** Arbeitsgänge mit Hinweis (nicht qualifiziert, Vorgänger verletzt) tragen eine Warnecke in Warnfarbe, auch über der Überlast-Fläche; Legende „mit Hinweis“; ebenso im Export.

### U7 · Ungültige Eingabe bei Takt und Zuschlag wird kommentarlos verworfen (Mittel)

- **Wo:** Felder „Takt [min]“ und „Zuschlag [%]“ im Arbeitsbereich, `src/features/workspace/workspace-controls.tsx:70–81`.
- **Beobachtung:**
  - Eingabe „1.5“ oder „abc“ und Verlassen des Felds: Das Feld zeigt wieder den alten Wert (4,00), der Rand ist kurz rot.
  - Eine Erklärung erscheint nicht. „1.5“ (Punkt statt Komma, häufig bei Excel-Gewohnheit) wird nicht als 1,5 gelesen und auch nicht beanstandet.
- **Folge:** Man glaubt, den Takt auf 1,5 gesetzt zu haben, und wundert sich, dass sich nichts ändert. Im Workshop fällt das unter Zeitdruck nicht auf.
- **Beleg:** `ablauf-takt-ungueltig.png`, `ablauf-takt-punkt.png`; Protokoll „Takt nach Eingabe ‚1.5‘: 4,00“.
- **Vorschlag:**
  - Kurze Meldung unter bzw. neben dem Feld („Bitte Zahl mit Komma eingeben, z. B. 1,50“), Wert bis zur Korrektur stehen lassen.
  - Ob „1.5“ als 1,5 gelesen werden darf, entscheidet F80 (deutsches Format); dann bitte festlegen.
  - Aufwand: klein.
- **Status: behoben (10.11.2026).** Ungültige Eingabe bleibt zum Korrigieren stehen, darunter die Meldung „Nicht übernommen, es gilt weiter 4,00. Bitte mit Komma eingeben, z. B. 1,5.“; Esc stellt den alten Wert her. „1.5“ wird weiterhin nicht als 1,5 gelesen (F80, nicht entschieden).

### U8 · Zu geringer Kontrast bei Warn- und Überlastfarben (Mittel)

- **Wo:** `--warning` (#d97706) als Textfarbe, an vier Stellen:
  - „unvollständig“ in der Kennzahlenleiste;
  - Hinweise in Tabelle, Detailpanel und Vorschlag;
  - „nicht zugeordnet“;
  - Vergleichshinweis.

  Weiße Schrift auf `--nx-red` (#ff5f50): Überlastwerte und Takt-Marke im Diagramm.

- **Beobachtung:** Kontrast 3,2 : 1 (Orange auf Weiß, auf der hellen Hinweisfläche etwa 2,8 : 1) bzw. 3,0 : 1 (Weiß auf Rot). Die Schrift ist dabei 10–14 px. Für normalen Text werden 4,5 : 1 verlangt.
- **Folge:** Gerade die wichtigsten Signale (über Takt, unvollständig) sind am Beamer mit blassem Bild am schlechtesten lesbar.
- **Beleg:** Berechnung aus `src/app/globals.css`; sichtbar u. a. in `beispiel-vergleich-1366x768.png` (Hinweiszeile unter der Kennzahlentabelle).
- **Vorschlag:**
  - Für Text eine dunklere Warnstufe (z. B. #b45309, 5,0 : 1).
  - Für Schrift auf Rot dunkelblaue Schrift oder ein dunkleres Rot nur für Wertmarken (z. B. `--destructive` #c8372a, 5,2 : 1).
  - Flächen, Linien und Rahmen bleiben NEONEX-Rot.
  - Aufwand: klein; NEONEX-Farben unverändert, nur zusätzliche Textstufen.
- **Status: behoben (10.11.2026).** Neue Textstufe `--warning-strong` (#b45309, 5,0 : 1) für alle Warntexte; Wertmarken mit weißer Schrift (Takt, Überlast) auf `--yz-over-label` (= `--destructive`, 5,2 : 1). Flächen, Linien und Rahmen bleiben NEONEX-Rot.

### U9 · Diagrammexport: Beschriftungen abgeschnitten, Bild zu zwei Dritteln leer (Mittel)

- **Wo:** Export „Diagramm als PNG“ (vermutlich auch PDF, nicht geöffnet), Beispiel.
- **Beobachtung:**
  - Die Stationen stehen schmal im linken Drittel, rechts ist das Bild leer.
  - Die Beschriftungen sind abgekürzt („C · 1,…“, „A · 2,…“, „E · …“), obwohl im Bild viel Platz wäre.
  - Kopf, Hinweis „unvollständig“ und Legende sind dagegen gut gelöst.
- **Folge:** Das Bild für Bericht oder Protokoll zeigt die Werte nicht, die man dokumentieren will (F52).
- **Beleg:** exportierte Datei `export-Beispiel XT – Yamazumi.png` im Ergebnisordner.
- **Vorschlag:** Für den Export Spurbreite auf die Bildbreite verteilen (wie „An Fenster anpassen“) und erst danach abkürzen. Aufwand: klein bis mittel.
- **Status: behoben (10.11.2026).** Export verteilt Spuren auf mindestens 1.400 px Bildbreite (Spur 44–400 px), Beschriftung wächst mit (10–14 px) und wird wie im Diagramm gekürzt. Unit-Test in `chart-svg.test.ts`.

### U10 · Tabelle auf dem Laptop: rechte Spalten nur mit seitlichem Scrollen (Mittel)

- **Wo:** Tabellenansicht, 1366 × 768.
- **Beobachtung:**
  - Mit den neuen Spalten Zeitart, Gruppe und Qualifiziert passen „Vorgänger“, „Start – Ende“ und „Wartezeit“ nicht mehr in die Breite; „Vorgänger“ ist angeschnitten.
  - Laut G4 passte die Tabelle bei 1280 px ohne Scrollen, das Problem ist also wieder da.
  - Jede Zeile besteht aus acht Eingabefeldern, die Tabelle wirkt wie ein Formular (siehe U11).
- **Folge:** Zeitliche Lage und Vorgänger, die man beim Umplanen am häufigsten prüft, sind auf dem Laptop nicht im Blick.
- **Beleg:** `beispiel-tabelle-1366x768-ganz.png`.
- **Vorschlag:**
  - „Gruppe“ und „Qualifiziert“ schmaler (Inhalt ist kurz) oder als einblendbare Spalten.
  - „Zeitart“ als kurzes Kürzel (Hand/Prozess) in einem schmalen Feld.
  - Aufwand: klein.
- **Status: behoben (10.11.2026).** Spalten verschmälert (Zellabstand, Zeitart „Prozess (hält)“, Gruppe, Qualifiziert, Kategorie, Vorgänger; Spaltenköpfe umbrechend). Bei 1366 × 768 passt die Tabelle ohne seitliches Scrollen.

### U11 · Gestaltung: Bausteine uneinheitlich, Browser-Standards neben gestalteten Elementen (Mittel)

- **Wo:** Import, Personalplanung, Panel „Verteilung vorschlagen“, Detailpanel, Tabelle.
- **Beobachtung:**
  - **Browser-Auswahllisten:**
    - Import: „Bestehende Variante“;
    - Personalplanung: „Gespeicherte Planung“, „Szenario für Personalabgleich“;
    - Vorschlag: „Station“;
    - Detailpanel und Tabelle: Station, Zeitart, Mitarbeiter, Kategorie.

    Daneben ist „Qualifiziert“ ein eigener, gestalteter Baustein mit anderem Pfeil und Klappverhalten.

  - **Ungestaltete Optionsfelder:** Import („Neue Variante / Bestehende Variante“), Vorschlag („Ziel“).
  - **Aufklapper mit Browser-Dreieck:** auf der Personalplanung.
  - **„Datei auswählen“** ist beim Import ein gefüllter dunkelblauer Knopf, auf der Personalplanung hellgrau (Messung „Gleicher Knopf, verschiedene Stile“). G5 hatte beide angeglichen.
- **Folge:** Die App wirkt stellenweise wie ein Formular aus dem Browser. Gleiche Bedienung sieht verschieden aus, gerade die neueren Seiten fallen ab.
- **Beleg:** `ergebnis.md` (Abschnitte „Browser-Standardelemente“, „Gleicher Knopf, verschiedene Stile“), `beispiel-import-korrektur-1920x1080.png`, `beispiel-personalplanung-1366x768-ganz.png`, `linie-vorschlag-1366x768.png`.
- **Vorschlag:**
  - Bausteine `Select`, `RadioGroup` und `Collapsible` aus shadcn/ui ergänzen und überall einsetzen.
  - „Datei auswählen“ in einer gemeinsamen Komponente, Stil „primär“ nur dort, wo es die Hauptaktion ist.
  - Aufwand: mittel; Browsertests sprechen Auswahllisten teils mit `selectOption` an und müssen angepasst werden.
- **Status: behoben (10.11.2026).** Native Bedienelemente einheitlich gestaltet (`globals.css`): Auswahllisten mit NEONEX-Pfeil und einheitlicher Höhe/Rahmen, Optionsfelder als gestaltete Kreise, Aufklapper mit Pfeil statt Browser-Dreieck; „Datei auswählen“ auf Personalplanung wie beim Import. Messung: keine Knopfstile mehr, die sich zwischen Seiten unterscheiden. Die Elemente bleiben nativ (Tastatur, Screenreader und Browsertests unverändert).

### U12 · Gestaltung: Navigation und Seitenaufbau folgen drei Mustern (Mittel)

- **Wo:** Kopfzeile und Seitenköpfe aller Seiten.
- **Beobachtung:**
  - **Kopfzeile:** zeigt nur das Logo.
  - **Rückweg:** steht beim Import oben rechts in der Kopfzeile („Zu den Szenarien“), auf der Personalplanung im Seitenkopf („Zum Szenario“), im Arbeitsbereich als Textlink in einer Leiste („Szenarien“).
  - **Benennung:** Dieselbe Seite heißt auf der Startseite „Personalplanung“, im Arbeitsbereich „Personalabgleich“.
  - **Seitenbreiten:** etwa 960 px (Szenarien), 1216 px (Import), 1536 px (Personalplanung), volle Breite (Arbeitsbereich, Tabelle).
  - **Kennzahlen:** Die Personalplanung zeigt große Kacheln mit einer Zahl, das Szenario eine schmale Leiste.
- **Folge:** Neue Nutzer müssen auf jeder Seite den Rückweg suchen; die Seiten wirken wie verschiedene Werkzeuge.
- **Beleg:** `beispiel-start-1366x768.png`, `beispiel-import-leer-1366x768.png`, `beispiel-personalplanung-1366x768-ganz.png`, `beispiel-stationen-1366x768.png`.
- **Vorschlag:**
  - Eine Navigation in der Kopfzeile (Szenarien · Personalplanung · aktuelles Szenario) für alle Seiten, ein Name je Seite.
  - Zwei Seitenbreiten: Formulare schmal, Arbeitsflächen voll.
  - Kennzahlen der Personalplanung als Leiste.
  - Aufwand: mittel.
- **Status: behoben (10.11.2026).** Hauptnavigation in der Kopfzeile („Szenarien“, „Personalplanung“, aktive Seite markiert, `src/components/app-nav.tsx`) auf allen Seiten außer der Anmeldung; doppelte Rückwege entfernt; „Personalabgleich“ heißt jetzt „Personalplanung“; Inhaltsseiten einheitlich `max-w-7xl`; Kennzahlen der Personalplanung als schmale Leiste.

### U13 · Verteilungsvorschlag: nicht erkennbar, was sich ändert (Mittel)

- **Wo:** Panel „Verteilung vorschlagen“ (Ergebnis) und anschließender Vergleich.
- **Beobachtung:**
  - **Ergebnis im Panel:** nennt nur „1 Arbeitsgang neu zugeordnet, 0 mit geänderter Reihenfolge“, nicht welcher, von wem zu wem.
  - **Weichzeichner:** Das Diagramm dahinter ist weichgezeichnet; vorher/nachher sieht man nur als Tabelle mit vier Zahlen.
  - **Vergleich:** Im anschließenden Vergleich steht „Verschobene Arbeitsgänge 0“, die Ziel-Seite markiert nichts. Als „verschoben“ zählen nur Stationswechsel (E15); Mitarbeiterwechsel innerhalb der Station werden nicht gekennzeichnet.
  - **Farbe:** Der Vorschlagswert „4,85 min“ ist rot, obwohl er besser ist als vorher (rot heißt hier „über Takt“).
- **Folge:** Im Workshop muss man Ist und Ziel Balken für Balken vergleichen, um den Vorschlag zu verstehen und erklären zu können. Die rote Zahl wirkt wie eine Verschlechterung.
- **Beleg:** `ablauf-vorschlag-ergebnis.png`, `ablauf-vorschlag-vergleich.png`.
- **Vorschlag:**
  - Im Ergebnis eine kurze Liste der Änderungen (z. B. „C: Mitarbeiter 2 → Mitarbeiter 1“).
  - Rot nur mit Hinweis „über Takt“.
  - **Frage:** Sollen Mitarbeiterwechsel im Vergleich wie Verschiebungen markiert werden? Das berührt E15/F113/F116 und ist zu entscheiden.
  - Aufwand: klein bis mittel.
- **Status: behoben (10.11.2026).** Ergebnis listet die Änderungen je Arbeitsgang („C: Mitarbeiter 2 → Mitarbeiter 1“, `describeChanges` mit Unit-Test); der Vorschlagswert ist nicht mehr kommentarlos rot, sondern trägt „über Takt“. **Offen:** Markierung von Mitarbeiterwechseln im Vergleich (berührt E15/F113/F116, Entscheidung nötig).

### U14 · Texte: Einzahl, Dezimalpunkt, englischer Screenreader-Text (Niedrig)

- **„1 Arbeitsgänge (…) ohne Mitarbeiter“:** Bei einem Arbeitsgang muss es Einzahl sein. `src/features/workspace/workspace.tsx:509, 824`; sichtbar in `linie-stationen-1920x1080.png`.
- **„0.5“ in der Import-Korrekturvorschau:** Gesperrte Zeit in fehlerhafter Zeile mit Punkt statt „0,50“. Der Rohwert wird ungerundet und ohne deutsches Format ausgegeben, `src/features/import/import-wizard.tsx` (Zelle mit Schloss-Symbol); sichtbar in `beispiel-import-korrektur-1920x1080.png`.
- **„Close“:** Screenreader-Text des Schließen-Knopfs aller Seitenpanels, `src/components/ui/sheet.tsx:74`.

### U15 · Vollbild auf dem Laptop: schwebende Leiste verdeckt Knöpfe (Niedrig)

- **Wo:** Vollbild, 1366 × 768.
- **Beobachtung:** Die Leiste „Kennzahlen · Bedienelemente · Anpassen · Vollbild beenden“ liegt oben rechts über „Duplizieren“ und „Verteilung vorschlagen“.
- **Folge:** Beide Knöpfe sind im Vollbild auf dem Laptop nicht erreichbar.
- **Beleg:** `beispiel-vollbild-1366x768.png`.
- **Vorschlag:** Im Vollbild den Szenariokopf rechts um die Breite der Leiste einrücken oder die Leiste in den Kopf einreihen. Aufwand: klein.

### U16 · Kleine Klickflächen (Niedrig)

- **Wo:** Regler „Breite“ und „Zeitskala“ (Griff 10 × 10 px), „+“ für Mitarbeiter hinzufügen (16 × 16 px), Farbfelder der Kategorien in der Legende (16 × 16 px).
- **Folge:** Am Workshop-Laptop mit Touchpad oder Touchscreen schwer zu treffen. Empfohlen sind mindestens 24 × 24 px.
- **Beleg:** Messung „Kleine Klickflächen“ in `ergebnis.md`.
- **Vorschlag:** Griffe und „+“ auf 20–24 px; die Klickfläche kann größer sein als das Symbol. Aufwand: klein.

### U17 · Kleinigkeiten beim Bedienen (Niedrig)

- **Tooltip:** Nach dem Klick auf einen Balken bleibt der Tooltip neben dem geöffneten Detailpanel stehen und verdeckt Werkzeugleiste bzw. Diagramm (`ablauf-details-laptop-ganz.png`).
- **Ziehvorschau:** Beim Ziehen eines breiten Balkens ist die Vorschau so breit wie der Balken und ragt über den Fensterrand (`ablauf-ziehen-unterwegs.png`).
- **Weichzeichner:** Hinter Seitenpanels liegt ein Weichzeichner (`sheet.tsx:31`). Beim Vorschlag verhindert er den Blick auf das Diagramm, siehe U13. Für ein Werkzeug reicht eine leichte Abdunklung.

## Hinweise ohne Handlungsbedarf

**Gut gelöst:**

- Leerzustand der Szenarienliste (Symbol, Erklärung, nächster Schritt).
- Klare Meldung bei falscher Datei („Die Datei ist keine lesbare Excel-Datei“).
- „0 Treffer“ bei der Suche.
- Ziehziel mit Konflikt orange gestrichelt (F129).
- Rückgängig/Wiederholen sichtbar aktiv bzw. inaktiv.
- Gemeinsame Arbeitsgänge im Detailpanel („startet gemeinsam mit E · Mitarbeiter 2“) und im Tooltip.
- Prozesszeiten deutlich gestrichelt, in der Mitarbeiteransicht als eigener Balken „Prozess“.
- Legende vollständig.
- Exportkopf mit Takt, Zuschlag, Stand und Hinweis „unvollständig“.
- Excel „Arbeitsfolge“ korrekt aufgebaut (Mitarbeiter in Reihenfolge, „ohne Mitarbeiter“ am Ende mit Hinweis).

**Gestaltung insgesamt im Rahmen:**

- nur Inter und Albert Sans;
- 3–7 Schriftgrößen je Seite außerhalb des Diagramms, 1–8 Eckenradien;
- NEONEX-Farben sparsam;
- keine Effektanimationen.

**Bewusst nicht als Befund gewertet:**

- Gruppen sind im Diagramm nicht eigens markiert (gemeinsamer Start ist sichtbar, Tooltip erklärt).
- Prozesszeiten „hält Station“ und „hält nicht“ unterscheiden sich nur über die Stationslinie.

Die Spezifikation verlangt dafür keine eigene Kennzeichnung. Bei Bedarf als Wunsch aufnehmen.

**Nicht geprüft:**

- Szenariosperre und Rollen (nur mit Cloud-Anmeldung);
- Löschen (Browser-Dialog, siehe U5);
- Fortschritt und Abbrechen des Verteilungsvorschlags mit großer Linie (im Beispiel rechnet er sofort);
- PDF- und Excel-Export im Importformat;
- echte Beamer-Abnahme (F125).

Der Knopf „N“ unten links ist das Entwicklungswerkzeug von Next.js und erscheint im Betrieb nicht.

## Status früherer Befunde (Gestaltungsprüfung 2026-10-26)

| Befund                             | Status                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| G1 Diagramm auf dem Laptop zu tief | weiterhin behoben (376 px); im Vergleich besteht das Problem (U4)              |
| G2 Workshop-Bildschirm             | weiterhin erledigt für die Fläche; die Beschriftungen wachsen nicht mit (U1)   |
| G3 Balkenbeschriftung „T…“         | bei breiten Spuren behoben; bei drei Mitarbeitern je Station erneut „AA…“ (U3) |
| G4 Tabelle auf dem Laptop          | durch neue Spalten wieder offen (U10)                                          |
| G5 Personalplanung Datei-Auswahl   | Spalten passen; „Datei auswählen“ weicht wieder vom Import ab (U11)            |
| G6 Fokus auf Balken                | behoben, Tastaturdurchlauf ohne unsichtbaren Fokus                             |
| G7 Wortwahl                        | behoben                                                                        |
