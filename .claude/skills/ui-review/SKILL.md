---
name: ui-review
description: Prüfung der Benutzeroberfläche des Line-Balancing-Projekts im echten Browser – alle Seiten und Ansichten bei Laptop-, Desktop- und Workshop-Auflösung, mit kleinem Beispiel und realistischer Linie (20 Stationen). Prüft Spezifikation (F-Nummern, Entscheidungen), NEONEX Corporate Design, zeitgemäße Gestaltungsqualität (einheitliche Bausteine statt Browser-Standards, Raster, Typografie, Gewichtung, Dichte, Rückmeldung), deutsche Texte und Zahlen, Zustände (leer, Fehler, unvollständig, gesperrt, schreibgeschützt), Bedienung (Ziehen, Rückgängig, Vollbild, Export), Tastatur und Barrierefreiheit, Konsolenfehler und Darstellungstempo. Ergebnis ist ein priorisierter Bericht unter docs/reviews/; behoben wird erst nach Freigabe. Verwende diesen Skill immer, wenn der Nutzer die Oberfläche, das UI, die Bedienung, das Aussehen, die Darstellung, Screens, Seiten oder Ansichten prüfen, durchsehen, testen oder abnehmen lassen will („sieht das gut aus?“, „passt die Oberfläche?“, „vor dem Workshop durchklicken“, „auf dem Laptop/Beamer lesbar?“) – auch wenn das Wort „UI“ nicht fällt.
---

# Oberflächenprüfung für NEONEX Line Balancing

Du prüfst die Oberfläche so, wie es eine erfahrene UX-Prüferin mit Fachverständnis vor einem Workshop tun würde: im echten Browser, mit realistischen Daten, auf den drei Bildschirmklassen aus F125. Du suchst Stellen, an denen Anwender im Workshop scheitern, etwas falsch ablesen oder unnötig suchen – nicht Geschmacksfragen. Ein Befund zählt nur mit Beleg: Bildschirmfoto, Messwert oder nachvollziehbarer Klickweg.

Der Nutzer ist fachlich (Arbeitsvorbereitung/Projektleitung), kein Entwickler. Bericht und Antworten auf Deutsch, Folgen in Werkstattsprache („am Beamer ist die Taktlinie nicht lesbar“ statt „font-size 10px“).

## Abgrenzung

- **`fullstack-review`** prüft Code, Datenbank, Sicherheit und Rechenkern. Dieser Skill prüft, was Anwender sehen und bedienen. Rechenwerte vergleichst du nur stichprobenhaft gegen die Erwartung (Beispiel E7), die Rechenlogik selbst prüfst du nicht.
- **`frontend-design`** ist der Gestaltungsmaßstab (mit Projekthinweis: NEONEX Corporate Design E30 hat Vorrang). Lies dessen Projekthinweis, bevor du Gestaltung bewertest. Für Diagramme und Tabellen zusätzlich den Skill `dataviz` als Maßstab heranziehen.
- **Modern** heißt hier: aufgeräumt, einheitlich und hochwertig innerhalb des Corporate Design – kein neuer Look. Abschnitt 12 der Checkliste.

## Grundregeln

- **Erst prüfen, dann fragen, dann ändern.** Ohne Freigabe keinen Code und keine Doku ändern – außer dem Bericht selbst.
- **Nur lokaler Modus.** Geprüft wird mit `LINEBALANCING_LOCAL_DEV=1` und eigenen Testdaten. Keine Anmeldung an der Cloud, kein `e2e:cloud`, keine echten Kundendaten, keine Schreibzugriffe auf die Cloud-Datenbank. Anmeldeseiten (`/login`, `/join`) nur ansehen, nichts absenden.
- **Bildschirmfotos bleiben lokal** im Temp-Ordner unter `%TEMP%\linebalancing-ui-review\` (außerhalb des Repos, weil `npm run e2e` den Ordner `test-results/` bei jedem Lauf leert). Nie ins Repository, nie veröffentlichen.
- **Fremde Arbeit schützen.** Codex arbeitet parallel; nicht committete Änderungen anderer nicht anfassen. Wenn die App wegen fremder halbfertiger Änderungen nicht startet, das als Stand notieren, nicht reparieren.
- **Spezifikation ist verbindlich** (`docs/spezifikation/`, `docs/OFFENE_ENTSCHEIDUNGEN.md`). Offene Entscheidungen (E-Nummern) sind Hinweise, keine Befunde; Gestaltungsvorschläge, die eine offene Entscheidung berühren, als Frage formulieren.
- **Zugangsdaten nie ausgeben.**

## Ablauf

### 1. Stand erfassen

- `git status`, `git log --oneline -10`. Nicht committete Dateien notieren (eigene vs. Codex).
- Lies den Projekthinweis in `.claude/skills/frontend-design/SKILL.md`, die UI-Anforderungen in `docs/spezifikation/01_ANFORDERUNGEN.md` (Suche nach F34, F46, F48–F52, F80, F84, F91–F95, F110, F125 und allen neueren F-Nummern seit dem letzten Bericht) sowie das Ende von `docs/ENTWICKLUNGSPLAN.md`. Das Projekt ist über den MVP hinaus: Maßgeblich ist, was laut Entwicklungsplan umgesetzt ist (auch Funktionen, die früher unter „Später“ standen), nicht die MVP-Abgrenzung.
- Neuester Gestaltungsbericht in `docs/reviews/*-gestaltung.md` bzw. `*-oberflaeche.md`: Offene Befunde werden erneut geprüft, behobene stichprobenhaft gegengeprüft.
- Neue Funktionen seit dem letzten Bericht ermitteln (`git log` seit dessen Commit): Sie bekommen die gründlichste Prüfung.
- Hat der Nutzer einen Schwerpunkt genannt (eine Seite, eine Ansicht, nur Beamer), diesen gründlich, den Rest nur mit dem automatischen Lauf prüfen.

### 2. Automatischer Lauf

```bash
npx.cmd playwright test --config .claude/skills/ui-review/scripts/ui-review.config.ts
```

Das Skript startet die App im lokalen Modus (Port 3210), importiert das kleine Beispiel (E7) und eine realistische Linie (20 Stationen, 60 Mitarbeiter, 160 Arbeitsgänge, IDs im Konverterformat, Takt 70 min, 10 % Zuschlag) und besucht bei 1366 × 768, 1920 × 1080 und 2560 × 1440 jede Seite und Ansicht (Start, Import, Stationen, Mitarbeiter, Tabelle, Vergleich, Vollbild, Personalplanung, Login). Je Ansicht:

- Bildschirmfoto (sichtbarer Bereich und ganze Seite),
- Konsolen- und Seitenfehler, fehlgeschlagene Anfragen,
- waagerechtes Überlaufen der Seite,
- Bedienelemente ohne zugänglichen Namen, Bilder ohne Alternativtext,
- verdächtige Texte: Dezimalpunkt statt Komma, englische Standardtexte, kaputte Umlaute,
- Schriftgrößen unter 12 px, Klickflächen unter 24 × 24 px,
- Lage des Diagramms (Oberkante in px) und Ladezeit bis zum fertigen Diagramm,
- Tastaturdurchlauf: Anzahl erreichbarer Elemente und Elemente ohne sichtbaren Fokus,
- Gestaltung (außerhalb des Diagramms): Browser-Standardelemente (Auswahllisten, Optionsfelder, Datei-Auswahl, Aufklapper), Anzahl Schriftgrößen, Schriftfamilien, Textfarben, Eckenradien und Schatten, Knopfstile – und seitenübergreifend gleich beschriftete Knöpfe in verschiedenen Stilen.

Ergebnis: `ergebnis.md` (Übersicht) und `ergebnis.json` in `%TEMP%\linebalancing-ui-review\`, Bilder im Unterordner `bilder\`; der genaue Pfad steht oben in `ergebnis.md`. Anderer Ort über die Umgebungsvariable `UI_REVIEW_OUT`. Laufzeit einige Minuten – im Hintergrund starten und währenddessen mit Schritt 3 beginnen. Bricht eine Ansicht ab, steht das im Ergebnis; der Rest läuft weiter.

Die Messwerte sind **Hinweise, keine Befunde.** Jeden Auffälligen Wert im Bild nachsehen: Ein Dezimalpunkt in einer Arbeitsgang-ID ist kein Fehler, ein Überlauf in einer bewusst scrollbaren Tabelle auch nicht.

### 3. Bilder ansehen und durchklicken

Sieh dir **jedes** Bildschirmfoto mit dem Read-Werkzeug an – das ist der Kern der Prüfung, kein optionaler Schritt. Arbeite dabei die Bereiche in [references/checkliste.md](references/checkliste.md) ab; lies dort den jeweiligen Abschnitt, bevor du ihn prüfst.

Für Abläufe, die der automatische Lauf nicht abdeckt (Ziehen mit Rückfrage, Rückgängig/Wiederholen, Export-Dateien öffnen, Fehlerzustände, Sperre), schreibe kurze Playwright-Skripte im Scratchpad oder ergänze sie temporär im Skill-Ordner und nutze die Hilfen aus `tests/e2e/fixtures.ts` und `tests/e2e/staffing-fixture.ts`. Bedienelemente über Rolle und Namen ansprechen wie in den vorhandenen Browsertests.

Vorgehen je Verdacht:

1. Im Bild bzw. im Browser nachvollziehen, bei welcher Auflösung und mit welchen Daten es auftritt.
2. Konkreten Fall formulieren: Wer will was tun → was passiert → warum ist das im Workshop ein Problem.
3. Beleg sichern: Bildname, Messwert oder Klickweg.
4. Schwere einstufen (siehe unten).

### 4. Bericht schreiben

Datei: `docs/reviews/JJJJ-MM-TT-oberflaeche.md` (bei mehreren am Tag `-2`, `-3`). Kennungen mit `U` (U1, U2 …), damit sie nicht mit Befunden aus `fullstack-review` (K/H/M/N) oder dem alten Gestaltungsbericht (G) verwechselt werden. Vorlage:

```markdown
# Oberflächenprüfung JJJJ-MM-TT

**Stand:** Commit <hash>, <n> nicht committete Dateien (<von wem>) · **Maßstab:** Spezifikation, NEONEX Corporate Design (E30), F125 · **Umfang:** <Seiten/Ansichten>

**Vorgehen:** Auflösungen, Testdaten, was automatisch und was von Hand geprüft wurde. Bildschirmfotos nur lokal.

## Zusammenfassung

<3–5 Sätze: Gesamteindruck, größte Hürden im Workshop, Empfehlung>

## Automatischer Lauf

| Ansicht | Auflösung | Auffälligkeiten | Bewertung |

## Befunde

### U1 · <Kurztitel in Anwendersprache> (Hoch)

- **Wo:** Seite/Ansicht, Auflösung, Datei (`src/features/…`)
- **Beobachtung:** <was zu sehen ist, mit Messwert>
- **Folge:** <was im Workshop schiefgeht>
- **Beleg:** <Bildname, Messwert, Klickweg>
- **Vorschlag:** <Behebung, Aufwand grob; offene Entscheidung nennen, falls berührt>

## Hinweise ohne Handlungsbedarf

<Gut gelöstes, offene Entscheidungen, Beobachtungen ohne Folge>

## Status früherer Befunde

<G…/U… aus dem letzten Bericht: behoben / offen / neu bewertet>
```

**Schweregrade**

- **Kritisch:** Eine Kernaufgabe ist nicht ausführbar (Import, Verschieben, Speichern, Vergleich, Export), angezeigte Werte sind falsch oder irreführend, Bedienung führt unbemerkt zu Datenverlust.
- **Hoch:** Abweichung von der Spezifikation; Kernaufgabe auf einer der drei Bildschirmklassen nur mit Umweg möglich; Information im Workshop nicht ablesbar.
- **Mittel:** Spürbarer Mehraufwand oder Verwechslungsgefahr; fehlender oder unverständlicher Zustand (leer, Fehler, gesperrt); Tastaturbedienung lückenhaft.
- **Niedrig:** Wortwahl, Schreibweise, kleine Unstimmigkeiten im Erscheinungsbild.

Reine Geschmacksfragen gehören nicht in den Bericht.

### 5. Ergebnis vorstellen und Freigabe einholen

Im Chat: kurze Zusammenfassung, Befunde als nummerierte Liste (Kennung, Titel, Folge in einem Satz), Link auf den Bericht, Pfad zum Bilderordner (vollständig, absolut). Dann fragen, welche Befunde behoben werden sollen. Den Bericht erst committen, wenn der Nutzer zustimmt oder mit den Behebungen.

### 6. Beheben (nur freigegebene Befunde)

- Gestaltung nach `frontend-design` mit Projekthinweis; Bausteine aus `src/components/ui/`, Farben aus `src/app/globals.css`, Zahlen über `src/lib/format.ts`.
- Bedienelemente behalten Rolle und Namen, sonst brechen die Browsertests; wenn ein Name sich ändern muss, Tests anpassen.
- Je Befund: vorher/nachher-Bildschirmfoto bei der betroffenen Auflösung, Messwert erneut erheben. Wo sinnvoll einen Browsertest unter `tests/e2e/` ergänzen, der den Befund festhält.
- Danach `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run e2e` und den automatischen Lauf erneut; Befund im Bericht mit Datum als behoben markieren, `ENTWICKLUNGSPLAN.md` nachziehen.
- Commits klein und thematisch, nur eigene Dateien. Push nur mit Freigabe in dieser Sitzung.
