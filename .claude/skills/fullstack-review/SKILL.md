---
name: fullstack-review
description: Gründliche Prüfung des gesamten Line-Balancing-Projekts aus Sicht eines Senior Full Stack Developers – Struktur, Next.js-16-App, Supabase (RLS, Migrationen, RPCs), Rechenkern gegen RECHENREGELN, Tests, CI, Sicherheit, Performance und Dokumentation gegen die Spezifikation. Ergebnis ist ein priorisierter Prüfbericht unter docs/reviews/; behoben wird erst nach Freigabe. Verwende diesen Skill immer, wenn der Nutzer das Projekt, einen Phasenstand, Codex' Arbeit oder „alles“ prüfen, reviewen, checken, auditieren oder abnehmen lassen will, nach einem Qualitäts- oder Gesundheitscheck fragt („passt alles?“, „ist das sauber?“, „vor der Abnahme durchsehen“) – auch wenn das Wort „Review“ nicht fällt.
---

# Senior-Full-Stack-Review für NEONEX Line Balancing

Du prüfst dieses Projekt so, wie es ein erfahrener Full-Stack-Entwickler vor einer Abnahme tun würde: Du suchst echte Fehler mit konkreten Folgen, nicht Stilfragen. Ein Befund zählt nur, wenn du ihn belegen kannst – mit Datei und Zeile, einem nachvollziehbaren Fehlerfall und möglichst einer Messung, einem Test oder einer Gegenprobe. Unbelegte Vermutungen kennzeichnest du als solche.

Der Nutzer ist fachlich (Arbeitsvorbereitung/Projektleitung), kein Entwickler. Bericht und Antworten auf Deutsch, Fachbegriffe kurz erklären, Folgen in Werkstattsprache beschreiben („Szenario lässt sich nicht speichern“ statt „RPC timeout“).

## Grundregeln

- **Erst prüfen, dann fragen, dann ändern.** Ohne Freigabe des Nutzers keinen Code, keine Doku und keine Daten ändern – außer dem Prüfbericht selbst.
- **Nichts Unumkehrbares.** Keine Migration live anwenden (`db:migrate`), nicht pushen, kein Deployment, kein `e2e:cloud` (legt echte Testkonten an), keine Schreibzugriffe auf die Cloud-Datenbank. Lesende Abfragen in einer `begin read only`-Transaktion sind erlaubt; `db:test:remote` ist erlaubt, weil es vollständig zurückrollt.
- **Fremde Arbeit schützen.** Codex arbeitet parallel. Nicht committete Änderungen anderer werden nicht angefasst, nicht formatiert, nicht mitcommittet. Prettier/Lint mit `--write` nur auf eigene Dateien.
- **Zugangsdaten nie ausgeben**, auch nicht in Fehlermeldungen oder im Bericht (`.env.local`, DB-URL, Keys).
- **Spezifikation ist verbindlich** (`docs/spezifikation/`, `docs/RECHENREGELN.md`, Entscheidungen in `docs/OFFENE_ENTSCHEIDUNGEN.md`). Abweichungen vom Code sind Befunde; offene Entscheidungen sind keine Fehler, sondern Hinweise.

## Ablauf

### 1. Stand erfassen

Repository: `C:\dev\linebalancing` (nicht der OneDrive-Ordner).

- `git status`, `git log --oneline -15`, `git fetch` und Abstand zu `origin/main`. Nicht committete Dateien notieren und Urheber einschätzen (eigene vs. Codex).
- Lies `AGENTS.md`, das Ende von `docs/ENTWICKLUNGSPLAN.md`, `docs/OFFENE_ENTSCHEIDUNGEN.md` und `docs/RECHENREGELN.md`. Gibt es frühere Berichte in `docs/reviews/`, lies den neuesten: Offene Befunde von dort werden wieder geprüft (behoben / weiterhin offen).
- Hat der Nutzer einen Schwerpunkt genannt (z. B. „nur Codex' Personalplanung“, „nur Datenbank“), prüfe diesen gründlich und den Rest nur mit den automatischen Prüfungen.

### 2. Automatische Prüfungen

```bash
node .claude/skills/fullstack-review/scripts/run-checks.mjs
```

Das Skript führt Format, Lint, Typecheck, Unit-Tests, Build, UI- und Auth-Browsertests, Datenbanktests (Rollback), Migrationsvorschau, CI-Status auf GitHub und eine Geheimnis-Suche aus und gibt je Prüfung Ergebnis und Fehlerauszug aus. Mit `--quick` entfallen Build und Browsertests. Laufzeit voll: mehrere Minuten – im Hintergrund starten und währenddessen mit Schritt 3 beginnen.

Jede rote Prüfung ist mindestens ein Befund. Erkläre die Ursache, nicht nur das Symptom (Beispiel aus diesem Projekt: CI war rot, weil `tsc` vor dem Build lief und die generierten Next.js-Typen fehlten).

### 3. Durchsicht nach Bereichen

Arbeite die Bereiche in [references/checkliste.md](references/checkliste.md) ab. Lies dort den Abschnitt eines Bereichs, bevor du ihn prüfst. Die Checkliste nennt je Bereich, wo du suchst und welche Fehlerarten in diesem Projekt schon vorkamen – genau dort lohnt sich der zweite Blick.

Vorgehen je Verdacht:

1. Code lesen, bis du den Ablauf verstehst – nicht beim ersten verdächtigen Muster stehen bleiben.
2. Konkreten Fehlerfall formulieren: Eingabe/Zustand → falsches Ergebnis.
3. Wenn möglich belegen: kleinen Test schreiben und ausführen (im Scratchpad, nicht im Repo), lesend messen, Gegenprobe machen. Ein belegter Befund ist mehr wert als drei Vermutungen.
4. Schwere einstufen (siehe unten).

### 4. Bericht schreiben

Datei: `docs/reviews/JJJJ-MM-TT-review.md` (bei mehreren am Tag `-2`, `-3`). Vorlage:

```markdown
# Prüfbericht JJJJ-MM-TT

**Stand:** Commit <hash>, <n> nicht committete Dateien (<von wem>) · **Umfang:** <gesamt | Schwerpunkt>

## Zusammenfassung

<3–5 Sätze: Gesamtzustand, wichtigste Risiken, Empfehlung>

## Automatische Prüfungen

| Prüfung | Ergebnis | Bemerkung |

## Befunde

### K1 · <Kurztitel> (Kritisch)

- **Wo:** `pfad/datei.ts:123`
- **Problem:** <ein Satz>
- **Folge:** <konkreter Fehlerfall in Werkstattsprache>
- **Beleg:** <Messung, Test, Gegenprobe – oder „nicht belegt, Vermutung“>
- **Vorschlag:** <Behebung, Aufwand grob>

(weitere Befunde H1, M1, N1 … nach Schwere sortiert)

## Hinweise ohne Handlungsbedarf

<offene Entscheidungen, bekannte Lücken laut Plan, Beobachtungen>

## Status früherer Befunde

<nur wenn es einen früheren Bericht gibt: behoben / offen>
```

**Schweregrade**

- **Kritisch (K):** Datenverlust, falsche Berechnung, Sicherheitslücke, App/Speichern funktioniert nicht.
- **Hoch (H):** Fachliche Abweichung von der Spezifikation, Funktion versagt in realistischem Fall, CI dauerhaft rot.
- **Mittel (M):** Fehlerfall selten oder mit Umweg lösbar, fehlende Tests für riskante Logik, Wartbarkeit mit absehbaren Folgen.
- **Niedrig (N):** Kleinigkeiten mit sichtbarer Wirkung (Tippfehler im UI, unklare Meldung).

Stilfragen ohne Folgen gehören nicht in den Bericht.

### 5. Ergebnis vorstellen und Freigabe einholen

Im Chat: kurze Zusammenfassung, Befunde als nummerierte Liste (Kennung, Titel, Folge in einem Satz), Link auf den Bericht. Dann fragen, welche Befunde behoben werden sollen (z. B. „alle K und H“, einzelne Kennungen). Den Bericht committen erst, wenn der Nutzer zustimmt oder mit den Behebungen.

### 6. Beheben (nur freigegebene Befunde)

- Je Befund: zuerst ein Test, der den Fehler zeigt, dann die Korrektur, dann Gegenprobe (Test schlägt ohne Korrektur fehl).
- Datenbank: neue Migration (nie eine angewendete ändern), Funktionsrümpfe aus der geltenden Fassung per Skript übernehmen und nur die betroffenen Zeilen ändern, Datenbanktest ergänzen, `db:test:remote` (Rollback) ausführen. Live anwenden muss der Nutzer selbst (`npm.cmd run db:migrate`) – das sagen.
- Danach die betroffenen Prüfungen erneut ausführen, Befund im Bericht als behoben markieren, Doku nachziehen (`ENTWICKLUNGSPLAN.md`, ggf. `OFFENE_ENTSCHEIDUNGEN.md`).
- Commits klein und thematisch, nur eigene Dateien. Push und CI-Kontrolle (`gh run list`, `gh run watch`) nur, wenn der Nutzer Commits/Push in dieser Sitzung freigegeben hat.
