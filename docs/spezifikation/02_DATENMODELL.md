# Line Balancing – Datenmodell für VS Code

**Stand:** 26.10.2026 · **Status:** Technischer Strukturvorschlag, keine zusätzlich bestätigte fachliche Entscheidung. Verbindliche Entscheidungen stehen in `01_ANFORDERUNGEN.md`.

## 1. Beziehungen

```text
Kundenprojekt (Owner, Mitglieder, Zugangscode)
  └── Produktvariante (eine Excel-Datei je Variante)
        └── Szenario (individueller Takt, Zuschlag, Sperre)
              ├── Station (Bezeichnung, Reihenfolge der Anzeige)
              │    └── Mitarbeiter (Mitarbeiter 1, 2, ... je Station)
              └── Arbeitsschritt (ID innerhalb Variante, importierte Zeit)
                    ├── Vorgängerbeziehungen (0..n)
                    ├── Mitarbeiterzuordnung (optional)
                    └── Kategorie (aus App)
```

## 2. Datensatzfelder (Vorschlag)

| Entität | Felder | Begründung / Status |
|---|---|---|
| Projekt | `id`, `name`, `owner_email`, `created_at` | Auth-Konzept Referenz; Schema-Namen vorgeschlagen |
| Projektmitglied | `project_id`, `email`, `role`, `joined_via` | Owner/Editor nach Referenz; RLS zwingend |
| Variante | `id`, `project_id`, `name`, `source_filename` | F14/F88 |
| Szenario | `id`, `variant_id`, `name`, `takt_min`, `zuschlag_prozent`, `updated_at`, `updated_by`, `version` | F24/F38/F59/F60/F51 |
| Szenariosperre | `scenario_id`, `holder_user_id`, `acquired_at`, `expires_at` | F58/F64; genaue Recovery/Timeout-Regel noch offen |
| Station | `id`, `scenario_id`, `label` | F72/F86/F111; numerische Reihenfolge nicht festgelegt, Anzeige alphabetisch F32 |
| Mitarbeiter | `id`, `station_id`, `label` | F68/F75/F82: Mitarbeiter 1, 2, 3 ... pro Station |
| Arbeitsschritt | `id`, `variant_id`, `scenario_id`, `station_id`, `employee_id` (nullable), `external_step_id`, `description`, `time_min`, `category_id` | F17/F18/F61/F69/F72/F127; importierte Zeit unveränderlich |
| Vorgänger | `scenario_id`, `step_id`, `predecessor_step_id` | F54/F74/F87; innerhalb Variante validieren |
| Kategorie | `project_id`, `key`, `label`, `color` | F93/F97; Standardkategorien wertschöpfend, nicht wertschöpfend, Wartezeit |
| Undo/Redo | `scenario_id`, `sequence`, `operation`, `payload`, `actor` | F26/F65; konkrete Speicherung technisch offen |

**Wichtig:** Die Behandlung von Varianten-IDs und szenariolokalen Arbeitsschritten muss sicherstellen, dass derselbe Excel-Arbeitsgang in unterschiedlichen Szenarien eigene Zuordnungen, aber dieselbe importierte Zeit besitzt. Eine ID muss gemäß F69 innerhalb einer Variante eindeutig sein; technische Datenbankschlüssel können separat vergeben werden.

## 3. Excel-Importvertrag

**Arbeitsblatt:** `Arbeitsgänge` · **zweites Blatt:** `Ausfüllanleitung` (F89). Eine Zeile pro Arbeitsschritt. Variante und Szenario werden aus dem Dateinamen abgeleitet (F88).

| Feld | Pflicht | Verarbeitung |
|---|---|---|
| `Arbeitsgang-ID` | Ja | Eindeutig innerhalb der Variante (F69) |
| `Station` | Ja | Fehlend: Import ablehnen (F86) |
| `Arbeitsgang/Beschreibung` | Ja | Beschreibung der Tätigkeit (Basisentscheidung; konkrete Spaltenbezeichnung Vorschlag) |
| `Zeit_min` | Ja | Berechneter Zeitwert; **größer als 0**, deutsches Komma, zwei Nachkommastellen in Anzeige (F18/F73/F80/F81/F84/F85) |
| `Mitarbeiter` | Nein | `Mitarbeiter 1`, `Mitarbeiter 2` usw.; fehlende Zuordnung markieren (F75/F78) |
| `Reihenfolge` | Ja | F30; tatsächliche Ausführungsreihenfolge folgt Vorgängerlogik (F70) |
| `Vorgänger-IDs` | Bedingt | Mehrere IDs in einer Zelle mit `;` getrennt (F54/F74); leer bei Starttätigkeit, wenn fachlich bestätigt |

**Nicht als Excel-Pflichtfelder:** Kategorien/Farben werden in der App gepflegt (F76). Räumliche Restriktionen werden durch Anwenderwissen beurteilt (F77).

**Validierung:** Fehlerhafte/unbekannte Vorgänger und Zyklen in der Vorschau berichtigen (F79/F87), ohne stille Korrekturen. Fehlende oder ungültige Zeiten sowie fehlende Stationen blockieren die Übernahme. Wiederholter Import erzeugt ein separates Szenario (F22/F83), keine automatische Überschreibung.

## 4. Rechenkern: bestätigte Regeln und Grenzen

- Alle Zeiten in **Minuten**, Berechnungen mit ungerundeten Zwischenwerten, Ausgabe gerundet auf **zwei Dezimalstellen** (P2).
- Takt und Zuschlag sind **szenariobezogen** (F59/F60).
- Tätigkeiten werden einem Mitarbeiter zugeordnet; parallele Ausführung verschiedener Mitarbeiter ist erlaubt (F55). Vorgänger-IDs und Mitarbeiterverfügbarkeit bestimmen frühestmögliche Beginnzeiten und Wartezeiten (P3).
- Die Stationshöhe entspricht der **längsten Mitarbeiterbelegungsdauer inklusive Wartezeit** (F90). Wartezeiten sind eigene Yamazumi-Segmente (F63/F66).
- Der **Zuschlag wird auf die Gesamtzeit je Mitarbeiter** angewendet (P1), nicht auf jeden Arbeitsschritt; die genaue Behandlung der Wartezeit in der Zuschlagsbasis bleibt fachlich offen.
- Personalauslastung gemäß F108 berücksichtigt produktive Zeit **inklusive Wartezeiten** relativ zur verfügbaren Mitarbeiterzeit; Stationsbelegung wird separat angezeigt (F107).
- Arbeitsschritte ohne Mitarbeiterzuordnung werden sichtbar und mit Warnfarbe gekennzeichnet, aber **nicht** in KPIs/Zeiten eingerechnet (F67/F109/P4).
- Beim Verschieben wird eine Mitarbeiterzuordnung zunächst entfernt (F61); Einschränkungen aus Vorgängern werden geprüft, bei Verletzungen wird gewarnt statt die Verschiebung grundsätzlich zu blockieren (F8/F15/F62).

### Offene technische/fachliche Punkte (nicht eigenmächtig spezifizieren)

1. Ob Zuschlag für P1 auch Wartezeiten im Gesamtwert erhöht oder ausschließlich produktive Zeiten.
2. Exakte Wartezeitdefinition und Zeitachsenmodell bei stationsübergreifenden Vorgängern.
3. Auslastungsformeln bei unzugeordneten Schritten und bei aktivem Filter – Bezugsmenge kennzeichnen.
4. Sperrenfreigabe bei Tab-Absturz oder unterbrochener Verbindung trotz F64.
5. Datenbankseitiges Verhalten, wenn das **gleiche Szenario** in Ist und Ziel gewählt ist (F115/F118).

## 5. Datensicherheit und Betrieb

Vercel (App) und Supabase (Auth, Postgres, RLS); Referenzimplementierung des NEONEX Workshop Hubs für Magic-Link/Projekt-Code und Owner/Editor. Jede Datenabfrage und Mutation muss durch RLS bzw. geprüfte DB-Funktionen autorisiert werden; `service_role` nie im Frontend. Daten verbleiben dauerhaft in Supabase (LB-001). Kundeneinsatz mit IT-/Datenschutzfreigabe, EU-Datenflüsse prüfen. Das Locking darf nicht ausschließlich in der Browseroberfläche erzwungen werden. NEONEX betreibt anfangs, spätere Übergabe an Kunden geplant (F41).
