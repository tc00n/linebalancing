# Line Balancing – Anforderungskatalog

**Projekt / Kunde:** Eura Mobil  
**Workshop / Bearbeiter:** Arbeitsvorbereitung  
**Datum:** 2026-10-27  

## Zielbild und Kontext

Ein Überblick des aktuellen Arbeitsverteilungsdiagramms und eines Zieldiagramms

## 1 · Ziel und Einsatzszenario

### 01 · Was ist das primäre Ziel der Anwendung?

**Entscheidung:** Kombination aus Transparenz, Simulation und Optimierung

### 02 · Wer nutzt das Tool voraussichtlich?

**Entscheidung:** Beratungsteam und ausgewählte Kundenmitarbeitende

### 03 · Wie ist der zeitliche Nutzungshorizont?

**Entscheidung:** Mehrere Workshops während eines Projekts

### 04 · Welche Art von Fertigung soll zuerst unterstützt werden?

**Entscheidung:** Vormontagen und Hauptlinie gemeinsam

## 2 · Excel-Import und Datenmodell

### 05 · Wie standardisiert ist die hochzuladende Excel-Datei?

**Entscheidung:** Ein fest definiertes Template mit Pflichtspalten

### 06 · Welche Informationen enthält bzw. benötigt ein Arbeitsschritt?

**Entscheidung:** Zusätzlich Varianten, Restriktionen und Abhängigkeiten

### 07 · In welcher Granularität liegen Zeiten vor?

**Entscheidung:** Arbeitsschritte je Produktvariante / Derivat

### 08 · Wie soll mit fehlerhaften oder unvollständigen Importdaten umgegangen werden?

**Entscheidung:** Fehler in einer Vorschau korrigieren

## 3 · Berechnungslogik und Restriktionen

### 09 · Wie wird die verfügbare Zeit je Station bestimmt?

**Entscheidung:** Eine einheitliche, manuell eingegebene Taktzeit

### 10 · Wie ist der Mitarbeitereinsatz abzubilden?

**Entscheidung:** Personal flexibel zwischen Stationen verschiebbar

### 11 · Welche Verschiebungsrestriktionen gelten für Arbeitsschritte?

**Entscheidung:** Vorgänger/Nachfolger sowie räumliche Grenzen

### 12 · Wie soll mit Produktvarianten umgegangen werden?

**Entscheidung:** Separates Balancing je Variante

### 13 · Wie viel Automatisierung wird benötigt?

**Entscheidung:** Manuell plus Vorschläge für Verschiebungen

## 4 · Workshop-Oberfläche und Ergebnisse

### 14 · Wie soll die aktuelle Linie visualisiert werden?

**Entscheidung:** Interaktives Yamazumi mit farbigen Arbeitsschritten

### 15 · Wie sollen Arbeitsschritte im Workshop verschoben werden?

**Entscheidung:** Drag-and-drop mit direkter Restriktionsprüfung

### 16 · Welche Kennzahlen sind besonders wichtig?

**Entscheidung:** Stationszeit und Soll-Takt

### 17 · Wie sollen Szenarien miteinander verglichen werden?

**Entscheidung:** Ausgangszustand und ein Zielszenario

### 18 · Welche Export- und Präsentationsfunktionen braucht es?

**Entscheidung:** Excel plus PDF / Diagrammexport

## 5 · Zusammenarbeit und Kundennutzung

### 19 · Wie soll die Bearbeitung organisiert sein?

**Entscheidung:** Ein Nutzer an einem Gerät

### 20 · Wie sollen Änderungen gespeichert werden?

**Entscheidung:** Zentrale Speicherung pro Projekt

### 21 · Welche Berechtigungsstufen werden benötigt?

**Entscheidung (aktualisiert):** Rollen wie in der Referenzimplementierung: ein Owner und Mitglieder mit Editor-Rechten; keine Viewer-Rolle.

### 22 · Welche Systemumgebung ist realistisch?

**Entscheidung:** Geschützte Cloud-Anwendung innerhalb der EU

## 6 · Informationssicherheit und Betrieb

### 23 · Wie sensibel sind die Produktionsdaten?

**Entscheidung:** Vertrauliche Prozess-, Zeit- und Personaldaten

### 24 · Welche Vorgaben gelten für die Datenverarbeitung?

**Entscheidung:** Freigegebener EU-Dienstleister / EU-Hosting

### 25 · Welche Anforderungen gelten für Anmeldung und Zugriff?

**Entscheidung (aktualisiert):** Supabase Magic-Link per E-Mail plus Projekt-Code; Firmendomains dürfen ohne Code eigene Projekte eröffnen/öffnen. RLS erzwingt die Rechte.

### 26 · Welche Anforderungen gelten für Datenhaltung und Löschung?

**Entscheidung:** Zentrale Speicherung mit definierten Löschfristen

### 27 · Wie soll die Anwendung nach dem Workshop betrieben werden?

**Entscheidung:** Kunde übernimmt Hosting, Support und Updates

## 7 · Technisches Konzept und Anmeldeverfahren (ergänzt am 22.10.2026)

### Architektur
- **Frontend / Hosting:** Vercel (geplant).
- **Datenbank / Authentifizierung / Berechtigungen:** Supabase Auth + Postgres + Row Level Security (RLS).
- **Persistenz:** Importierte Produktionsdaten und Line-Balancing-Szenarien werden dauerhaft in Supabase gespeichert; Löschfristen sind noch festzulegen.
- **Mandantentrennung:** Projektbezogene Trennung der Kundendaten durch serverseitig durchgesetzte Zugriffsrichtlinien.
- **Datenschutz / Compliance:** EU-Hosting ist Zielvorgabe; tatsächliche Datenflüsse, Auftragsverarbeitung, Dienstleister und IT-Freigabe vor Produktiveinsatz prüfen.

### Anmeldung – Referenz NEONEX Workshop Hub (Repo Prozesshaus)
- Passwortloser E-Mail-Magic-Link mit Supabase Auth (PKCE).
- Projektcode im Format `XXXXX-XXXXX`, bei Login einzugeben; Einladungslink `/#/join/CODE` kann Code vorbelegen.
- Link muss im anfordernden Browser geöffnet werden; nach Login wird Projekt-Code über geschützte Datenbankfunktion eingelöst.
- Zugriff auf Projektdaten erst nach bestätigter Mitgliedschaft; jede Abfrage wird per RLS abgesichert.
- Laufende Sitzung und aktives Projekt bleiben nach Neuladen erhalten; Projektwechsel und Abmeldung sind vorgesehen.
- Berechtigte NEONEX-Firmenadressen (Beispiel `neonex.de` aus `staff_domains`) können ohne Projekt-Code anmelden, neue Projekte erstellen und eigene Projekte als Owner öffnen.
- Ein Projekt besitzt genau einen Owner; Mitglieder kommen durch Code hinzu.
- Owner: Daten lesen/bearbeiten, Projekt ohne Code öffnen, Code verwalten, Mitglieder entfernen, Einträge löschen.
- Editor/Mitglied: Projektdaten lesen/bearbeiten, aber keinen Code verwalten, keine Mitglieder entfernen (außer Austritt) und keine Einträge löschen.
- Code in Referenz ohne Ablaufdatum. Widerruf/Rotation entzieht allen über Code beigetretenen Mitgliedern die Mitgliedschaft; Zugang erneut mit neuem Code.
- Code-Tabelle nicht direkt lesbar; Code-Operationen über berechtigungsprüfende Datenbankfunktionen.
- Supabase Service-Role-Key niemals im Frontend. SMTP-Versand für produktiven Einsatz einrichten.
- Lokaler Entwicklungsmodus aus Referenz nur für Entwicklung/Tests, niemals im produktiven Deployment.

### Sicherheits- und Umsetzungsprüfpunkte
1. **Code bei jeder Anmeldung:** Ein Code im UI reicht nicht als Schutz, solange eine alte Projektmitgliedschaft in der Datenbank fortbesteht. Regel technisch serverseitig präzisieren und erzwingen.
2. **Rollenmodell:** Referenz gilt: genau ein Owner je Projekt und Editor-Mitglieder über Code; keine zusätzliche Viewer-Rolle.
3. **Code-Schutz:** Fehlversuchbegrenzung/Rate Limiting, ausreichende Entropie und Monitoring der Einlöseversuche spezifizieren.
4. **RLS vollständig:** Rechte für SELECT/INSERT/UPDATE/DELETE und alle projektrelevanten Tabellen/Funktionen absichern und systematisch testen.
5. **Nutzeridentität:** Sichere Zuordnung zu verifizierten Auth-Nutzern; E-Mail-Änderungen und erneute Anmeldungen testen.
6. **Betrieb und Löschung:** Backup, Wiederherstellung, Audit, konkrete Löschfristen und Übergabe an Kunden definieren.
7. **EU-Verarbeitung:** Verarbeitungsregionen und Subprozessoren von Vercel/Supabase inklusive Logs, E-Mail-Dienst und Dateispeicher klären.
8. **Projekt-Code in URL:** Für Weitergabe bequem, aber durch Link-Leaks und Browserhistorie potenziell exponiert; nur als Geheimnis behandeln und nach Einlösung aus der URL entfernen.

### Referenzcode und interne Ansprechpartner
- Migration: `supabase/migrations/001_shared_workshops.sql`
- Frontend: `src/sync/AuthProvider.tsx`, `src/components/cloud/Gate.tsx`
- Dokumentation: `docs/CLOUD_SETUP.md`
- Ansprechpartnerin: Lena Neuner

## 8 · Offene Architekturentscheidungen
- **A1 Rollen – entschieden:** Owner/Editor wie in der Referenz.
- **A2 Projektauswahl:** Kann ein Nutzer mehreren Kundenprojekten angehören, und wie wird ausgewählt?
- **A3 Code-Prüfung – entschieden:** Wie in der Referenz beschrieben bei jeder neuen Anmeldung Code-Eingabe; die serverseitige Durchsetzung gegenüber noch bestehenden Mitgliedschaften ist technisch zu prüfen.
- **A4 Kundenbetrieb – offen:** In der Referenz nicht festgelegt; bisherige Anforderung nennt spätere Übernahme von Hosting/Support/Updates durch den Kunden.
- **A5 Löschung:** Wer darf Produktionsdaten, Szenarien und ganze Projekte löschen und wie lange werden sie aufbewahrt?
- **A6 Revision – offen:** Keine Änderungshistorie in der bereitgestellten Referenz beschrieben.

## Offene Fragen und nächste Schritte

_Keine Angaben_

---
**Zwischenstand bis F11:** 27 Basisfragen und 11 fachliche Detailfragen beantwortet.
**Hinweis:** Der Katalog dokumentiert Anforderungen; eine Freigabe durch IT-/Informationssicherheit und Datenschutz ersetzt er nicht.

## 9 · Festlegung vom 22.10.2026
**Vorgabe:** Authentifizierung, Codes, Rollen und Zugriffsrechte werden funktional analog zur bereitgestellten NEONEX-Workshop-Hub-Referenz umgesetzt. Aspekte, die die Referenz nicht definiert (Kundenhosting, Undo/Redo, Revisionshistorie), bleiben separate fachliche Entscheidungen.

## 10 · Fachliche Detailanforderungen F1–F5 (22.10.2026)

| ID | Entscheidung | Konkretisierung |
|---|---|---|
| F1 | Arbeitsschritte können flexibel Mitarbeitern zugewiesen werden | Mitarbeiterzuordnung unabhängig von Stationszuordnung modellieren; Regeln für Zeiten und Parallelität noch offen. |
| F2 | Einzelne gestapelte Arbeitsschritte pro Station | Yamazumi-Darstellung auf Arbeitsschrittebene, nicht nur aggregierte Stationsbalken. |
| F3 | Verschieben erlauben, aber Überlastung deutlich markieren | Überschreitungen des Soll-Takts sind Warnungen, keine hart blockierende Regel. |
| F4 | Einzelne passende Arbeitsschritte zur Umverteilung vorschlagen | Vorschläge unter Berücksichtigung der bereits definierten Vorgänger-/Nachfolger- und räumlichen Restriktionen. |
| F5 | Zwischen Ist- und Zielzustand umschalten | Zwischen Ist und Ziel wechseln; gemäß späterer Entscheidung F23 ist auch der Ist-Zustand manuell bearbeitbar. |

### Offene Folgefragen
- Zählweise von Arbeits- und Stationszeiten bei parallel tätigen Mitarbeitern
- Abbildung der Mitarbeiter im Diagramm
- Bedienung und Wirkung von Restriktionen bei Verschiebungen
- Vorschlagskriterien und gewünschte KPI-Anzeigen
- Zeiteinheiten, Pausen/Verteilzeit sowie Variantenbezug


## 11 · Fachliche Detailanforderungen F6–F11 (22.10.2026)

| ID | Festgelegte Anforderung | Konkretisierung |
|---|---|---|
| F6 | Parallele und sequenzielle Arbeitsschritte werden berücksichtigt | Zeitberechnung muss den zeitlichen Ablauf mehrerer Mitarbeiter an einer Station abbilden; genaue Eingabelogik noch definieren. |
| F7 | Zwischen Stationsansicht und Mitarbeiteransicht umschalten | Zwei auf denselben Daten basierende Visualisierungen mit eindeutiger Zuordnung. |
| F8 | Verschieben erlauben, aber bei Verstoß gegen Restriktionen deutlich warnen | Warnung bei Verletzung von Vorgänger-/Nachfolgerbeziehungen oder räumlichen Grenzen; keine automatische Sperre. |
| F9 | Auslastung möglichst gleichmäßig auf die Stationen verteilen | Primäres Ziel für Empfehlungen ist die möglichst ausgeglichene Stationsauslastung; weitere Prioritäten noch offen. |
| F10 | Alle Kennzahlen mit konfigurierbarer Anzeige | Verfügbare KPIs können nutzerseitig ein- und ausgeblendet werden; konkrete KPI-Liste noch zu spezifizieren. |
| F11 | Personal flexibel zuordnen und die Auslastung automatisch neu berechnen | Änderungen der Mitarbeiterzuordnung aktualisieren die zeitliche Stations- und Mitarbeiterauslastung unmittelbar. |

### Offene Fachfragen für den nächsten Block
- F12: Modellierung von Parallelität und Abhängigkeiten im Excel-Import
- F13: Interpretation der Stationszeit bei parallelen Arbeiten und mehreren Mitarbeitern
- F14: Umgang mit Varianten und gemeinsamen Arbeitsschritten
- F15: Reaktion auf Warnungen bei unzulässiger Verlagerung
- F16: Granularität und Ergebnisdarstellung der Vorschläge
- F17: Manuelle Änderungen von Arbeitszeiten im Zielszenario

**Hinweis:** F8 erlaubt bewusst die Verletzung von Restriktionen. Ein solches Szenario muss sichtbar als konfliktbehaftet gekennzeichnet bleiben und darf nicht stillschweigend als ausführbar gelten.


## 12 · Fachliche Detailanforderungen F12–F17 (22.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F12 | Abhängigkeiten und Parallelität aus Excel importieren und in der App nachträglich bearbeiten | Import und UI benötigen ein einheitliches Vorgänger-/Nachfolger-Datenmodell. |
| F13 | Tatsächliche Ablaufdauer aus Abhängigkeiten und parallel ausgeführten Tätigkeiten berechnen | Zeitliche Ablaufplanung statt bloßer Summen- oder Durchschnittsrechnung; Mehrpersonen-Arbeitsschritte beachten. |
| F14 | Pro Produktvariante eine eigene Excel-Datei importieren | Jede Variante besitzt einen separat ausbalancierbaren Datensatz. |
| F15 | Restriktionsverletzungen mit Warnung und vollständiger Konfliktübersicht anzeigen | Verstoß nicht blockieren, aber Zielszenario als konfliktbehaftet kennzeichnen. |
| F16 | Geeignete Arbeitsschritte in überlasteten Stationen hervorheben | Einfache, erklärbare Empfehlungen statt vollständiger Autooptimierung. |
| F17 | Arbeitszeiten im Zielszenario nicht verändern | Importierte Planzeiten unverändert halten; Zuordnung darf geändert werden. |

### Hinweise zur beigefügten Beispiel-Zeitaufnahme `KOPIE-Zeitaufnahmen XT 686 EF.xlsx`
- Arbeitsblatt `XT 686 EF - T17-T23` enthält unter anderem ZA, Takt-Benennung, WC, OPN, AA, Arbeitsinhalt sowie `Zeit te1` bis `Zeit te7 (mit Vt)`, einen Mittelwert und `Zeit T (mit Vt)`.
- Ein weiteres Arbeitsblatt `XT 686 EF - T17-T23 Diagramm` enthält einen für Diagramme vorbereiteten Ausschnitt.
- Mehrere Messwerte, Mittelwert und Zeit-T-Spalte erfordern die Festlegung, **welche Spalte die verbindliche Arbeitszeit** für das Balancing ist.
- Die Zeitaufnahme enthält Zeilen mit fehlenden Identifikationsfeldern, offenbar durch gruppierte Angaben. Für den Import müssen Station, Tätigkeit und Zuordnung anhand eines klaren Templates zuverlässig zugeordnet werden.
- Vorgänger-/Nachfolgerbeziehungen und zeitliche Parallelität sind in dem inspizierten Ausschnitt nicht als explizite Abhängigkeitsspalten erkennbar. Entsprechende Importfelder sind zu ergänzen oder im Tool nachzupflegen.
- Die Beispieldatei ist ein Ausgangsformat, **nicht** automatisch das bereits freigegebene finale Importtemplate.

### Nächste Entscheidungen
- F18: Verbindliche Zeitbasis aus mehreren Mess-/Auswertungsspalten
- F19: Umgang mit mehreren Mitarbeitern an einem Arbeitsschritt
- F20: Identität und Gruppierung der Arbeitsschritte beim Import
- F21: Modellierung von parallelen und sequenziellen Abläufen
- F22: Umgang mit neuen Excel-Uploads nach Workshop-Bearbeitung
- F23: Unveränderlichkeit und Nachvollziehbarkeit des Ist-Zustands

**Bearbeitungsstand:** 27 Basisfragen und 17 fachliche Detailfragen beantwortet.


## 13 · Fachliche Detailanforderungen F18–F23 (22.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F18 | Bereits berechneten Zeitwert pro Arbeitsschritt nutzen (`Zeit T` bzw. Diagrammwert) | Das standardisierte Importtemplate enthält eine verbindliche Zeitspalte; Zeitmessreihen müssen nicht importiert werden. Die exakte Auswahl/Definition dieses Zeitwerts ist anhand der Quelldatei festzulegen. |
| F19 | Arbeitsschritt für mehrere Mitarbeiter in separate Tätigkeiten pro Mitarbeiter aufteilen | Pro Tätigkeit eindeutige Mitarbeiterzuordnung und separate Dauer; Ablaufbeziehungen/Parallelität bleiben darstellbar. |
| F20 | Neues, standardisiertes Excel-Template mit Pflichtspalten verwenden | Vorlage und Validierung definieren; Beispiel-Zeitaufnahme dient als Quelle für die Felder. |
| F21 | Parallele Tätigkeiten über Reihenfolge und Kennzeichnung abbilden | Import- und Bearbeitungsmaske benötigen eindeutige Sequenz- und Parallelitätsinformationen; Details der Ablaufberechnung prüfen. |
| F22 | Jeden erneuten Excel-Import als separates Szenario speichern | Bereits vorhandene Szenarien nicht automatisch überschreiben; Varianten- und Szenariobezeichnung eindeutig führen. |
| F23 | Ist-Zustand darf jederzeit manuell bearbeitet werden | Frühere unveränderliche Ist-Referenz ist damit überholt. Bei gleichzeitig geforderter Vergleichbarkeit (F5) muss geklärt werden, ob Snapshot, Version oder separate Sicherung gewünscht ist. |

### Abgrenzungen und offene Detailfragen
- **F17 und F23:** Die freie Bearbeitung des Ist-Zustands bezieht sich zunächst auf Arbeitsgang-/Stations-/Mitarbeiterzuordnungen und Ablaufdetails; importierte Arbeitszeiten bleiben gemäß F17 unverändert. Ob die Zeit-Sperre auch im Ist-Zustand gilt, ist ausdrücklich zu bestätigen.
- **F14 und F22:** Eine Datei pro Produktvariante; weitere Importe erzeugen neue Szenarien. Es bleibt zu klären, wie Varianten- und Szenarienhierarchien zueinander stehen.
- **F13 und F21:** Tatsächliche Ablaufdauer benötigt genügend Information für eine eindeutige Abbildung von Parallelität und Reihenfolge, insbesondere bei Ressourcenüberschneidungen.

### Nächster Fragenblock F24–F29
1. Wie soll ein Szenario benannt und einer Variante zugeordnet werden?
2. Sollen Änderungen automatisch oder manuell gespeichert werden?
3. Welche Rückgängig-/Wiederherstellungsfunktion wird benötigt?
4. Wie sollen Farben und Gruppierungen der Arbeitsgänge festgelegt werden?
5. Wie detailliert sollen Drag-and-drop-Änderungen sichtbar und bearbeitbar sein?
6. Wie soll ein neuer leerer Datensatz ohne Excel-Import entstehen können?

**Bearbeitungsstand:** 27 Basisfragen und 23 fachliche Detailfragen beantwortet (insgesamt 50).


## 14 · Fachliche Detailanforderungen F24–F29 (22.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F24 | Mehrere frei benennbare Szenarien pro Variante | Szenarien einer Variante zuordnen und frei benennen; Ist-/Zielkennzeichnung mit bisherigem Vergleichskonzept abstimmen. |
| F25 | Jede Änderung automatisch speichern | Änderungen von Zuordnungen, Reihenfolgen, Farben und Einstellungen in Supabase persistieren; Fehler beim Speichern sichtbar machen. |
| F26 | Einzelne Änderungen mit Undo/Redo rückgängig machen bzw. wiederholen | Undo/Redo auch bei automatischer Speicherung berücksichtigen; Geltungsbereich pro Sitzung/Szenario noch definieren. |
| F27 | Farben und Kategorien individuell definierbar | Nutzerdefinierte Kategorien mit Farbe; Darstellung konsistent in Yamazumi- und Mitarbeiteransicht. |
| F28 | Drag-and-drop zwischen Stationen | Arbeitsgänge per Drag-and-drop umverteilen; weiterhin Warnungen und Konfliktübersicht bei Restriktionsverletzungen. |
| F29 | Neue Stationen und Arbeitsschritte ausschließlich über Excel-Import anlegen | Keine manuelle Neuanlage in der App; bestehende importierte Schritte können gemäß vorherigen Festlegungen umverteilt werden. |

### Zu klärende Abgrenzungen
- **F12/F21 gegenüber F29:** Nachträgliche Bearbeitung von Abhängigkeiten und Parallelitätskennzeichen ist möglich; das Anlegen neuer Arbeitsschritte oder Stationen bleibt dem Excel-Import vorbehalten.
- **F23/F25/F26:** Ist- und Zielstände sind bearbeitbar; automatische Speicherung und Undo/Redo müssen beim Szenarienwechsel konsistent funktionieren.
- **F17:** Importierte Zeitwerte sind nicht frei editierbar; F23 ist nicht als Freigabe für Zeitänderungen zu interpretieren.
- **F24/F22:** Wiederholte Imports erzeugen weitere Szenarien, die benannt und Varianten zugeordnet werden.

**Bearbeitungsstand:** 27 Basisfragen und 29 fachliche Detailfragen beantwortet (insgesamt 56).


## 15 · Fachliche Detailanforderungen F30–F35 (22.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F30 | Pflichtangaben: Station, Arbeitsgang, Beschreibung, Zeit sowie Mitarbeiter und Reihenfolge | Standardisiertes Importtemplate mit diesen Pflichtspalten; zusätzliche optionale Spalten für Kategorien, Abhängigkeiten und Parallelität gemäß F6/F12/F21. |
| F31 | Importfehler vor Übernahme in einer Übersicht anzeigen und korrigieren | Vorabvalidierung mit Zeilen- und Feldbezug; korrigierte Daten erst nach erneuter Prüfung importieren. |
| F32 | Stationen alphabetisch nach Stationsbezeichnung anordnen | Sortierung in der Diagrammansicht; mögliche Abweichung von der tatsächlichen Materialflussreihenfolge kenntlich machen. |
| F33 | Detailansicht: Beschreibung, Zeit, Station, Mitarbeiter, Kategorie und Reihenfolge sowie Abhängigkeiten, Restriktionen und Warnungen | Detailinformationen zum angewählten Arbeitsschritt; Bearbeitungsmöglichkeiten durch andere Anforderungen begrenzt, insbesondere keine Änderung der importierten Zeit (F17) und keine Neuanlage (F29). |
| F34 | Vollbildmodus mit ausblendbaren Bedienelementen und KPIs | Workshop-gerechte Präsentation; beim Ein-/Ausblenden Diagrammfläche optimal ausnutzen. |
| F35 | Alle genannten Exporte | Yamazumi als PNG/PDF, Excel mit aktualisierten Stations- und Mitarbeiterzuordnungen, PDF-Bericht mit Diagramm, KPIs und Restriktionswarnungen. |

### Zu klärende Abgrenzungen
- **F30/F21:** Sequenz ist Pflicht, aber die genaue Kodierung paralleler Tätigkeiten und der dazu nötigen zusätzlichen Spalten muss im Template spezifiziert werden.
- **F32:** Alphabetische Reihenfolge ist die gewählte UI-Sortierung und nicht zwangsläufig die physische Abfolge der Linie.
- **F17/F33:** Die Anzeige von Zeitwerten in Details erlaubt keine Zeitänderung.
- **F35:** Für PDF-Exporte sind Seitenformat, Darstellung großer Linien und Hinweis auf ungültige Restriktionen noch festzulegen.

**Bearbeitungsstand:** 27 Basisfragen und 35 fachliche Detailfragen beantwortet (insgesamt 62).

## 16 · Fachliche Detailanforderungen F36–F41 (22.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F36 | Bis zu 20 Stationen und 500 Arbeitsschritte flüssig verarbeiten | Größe als Ziel für Funktionstests und Reaktionszeitmessungen verwenden; genaue Performance-Schwellen noch festlegen. |
| F37 | Änderungen bei Verbindungsproblemen lokal zwischenspeichern und erneut übertragen | Speichervorgänge als ausstehend markieren; zuverlässige Wiederholung und Konfliktbehandlung bei erneutem Netzempfang; keine Behauptung erfolgreicher Speicherung vor Serverbestätigung. |
| F38 | Letzte Änderung und Bearbeiter anzeigen | Änderungszeitpunkt und Nutzer pro relevanter Entität speichern; kein vollständiges Audit-Log gefordert. |
| F39 | Authentifizierung und Supabase Row Level Security gemäß Referenz NEONEX Workshop Hub | Magic-Link plus Projekt-Code, Owner/Editor, projektbezogene Rechte in der Datenbank. Referenz vor Übernahme auf Zugriffsschutz einschließlich RLS, SQL-Funktionen und Code-Brute-Force-Schutz prüfen. |
| F40 | Projekt-Owner darf Projekt mit zusätzlicher Sicherheitsbestätigung löschen | Autorisierung serverseitig durchsetzen; Umfang der Löschung (Daten, Szenarien, Dateien, Backups) und Aufbewahrungsregeln noch definieren. |
| F41 | NEONEX betreibt die App zunächst; spätere Betriebsübernahme durch Kunden | Architektur, Geheimnisse, Datenexport, Migration und Übergabedokumentation so planen, dass Übergabe von Vercel/Supabase möglich ist. |

### Abgrenzungen und offene Punkte
- **F37/F25/F26:** Autosave, Offline-Warteschlange und Undo/Redo müssen bei Konflikten und nach Browser-Neustarts konsistent bleiben.
- **F38:** Eine Anzeige der letzten Bearbeitung ist keine lückenlose revisionssichere Historie.
- **F39:** Die Übernahme der Referenzimplementierung ist eine funktionale Anforderung und ersetzt weder Sicherheitstests noch Kundenfreigabe.
- **F40:** Löschumfang und Backup-Aufbewahrung sind vor dem produktiven Einsatz zu klären.
- **F41:** Betrieb durch NEONEX und spätere Übergabe an den Kunden ersetzt die noch nötige Vereinbarung über Datenverarbeitung und Hosting nicht.

**Bearbeitungsstand:** 27 Basisfragen und 41 fachliche Detailfragen beantwortet (insgesamt 68).



## 17 · MVP-Priorisierung F42–F47 (22.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F42 | MVP mit Excel-Import, Yamazumi, manueller Umverteilung, Mitarbeiterzuordnung, Taktzeitberechnung sowie Szenarien, Restriktionswarnungen und Exporten | Erste Workshop-Version beinhaltet die zuvor gewählten Kernfunktionen; zeitliche Detailberechnung gemäß F44 vereinfachen. |
| F43 | Automatische Verschiebungsvorschläge vorerst **nicht** umsetzen | F4/F9/F16 definieren eine spätere Ausbaustufe und gehören nicht zum MVP; manuelle Umverteilung bleibt Kernfunktion. |
| F44 | Einfache parallele und sequenzielle Abläufe korrekt berechnen | MVP unterstützt einfache Ablaufbeziehungen. Die vollständige Abbildung komplexer Ressourcenabhängigkeiten und umfassender Ablaufnetze bleibt offen bzw. ist später zu priorisieren. |
| F45 | Im MVP Excel-Export und Diagrammexport; PDF-Bericht später | F35 beschreibt das Gesamtziel, nicht den sofortigen MVP-Umfang. Diagrammexport als Bild und/oder PDF-Diagramm ist noch präzise festzulegen. |
| F46 | Hochwertige Benutzeroberfläche im NEONEX Corporate Design | CI-Farben, Typografie und Layout konsistent; Bedienung für Workshops und Vollbilddarstellung optimieren. |
| F47 | Interne Funktionstests und gemeinsamer Test mit der Arbeitsvorbereitung | Realistische Testdaten verwenden und mit Fachanwendern die wichtigsten Anwendungsfälle abnehmen. |

### MVP-Abgrenzung und Konsistenz
- **MVP:** Standard-Excel-Import mit Validierung; Yamazumi für bis zu 20 Stationen/500 Arbeitsschritte; Stations- und Mitarbeiteransicht; einfache sequenzielle/parallele Zeitlogik; Takt und Auslastung; Drag-and-drop; Restriktionswarnungen; mehrere Szenarien; Autosave und Undo/Redo; Excel- und Diagrammexport; Login und Projektrollen gemäß Referenz; NEONEX-Design.
- **Später:** automatische Vorschläge für Arbeitsschritt-Verschiebungen (F4/F9/F16) und umfassender PDF-Bericht (F35).
- **Weiter offen:** Konfliktverhalten bei parallelen Bearbeitungen/erneuter Verbindung, genaue Berechnungsregeln bei Mitarbeiterwechsel, präzise Importvorlage sowie Performance-Akzeptanzkriterien.

**Bearbeitungsstand:** 27 Basisfragen und 47 fachliche Detailfragen beantwortet (insgesamt 74).

## 18 · Szenariovergleich, Synchronisation und Abnahme F48–F53 (22.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F48 | Immer nur ein Szenario gleichzeitig bearbeiten | Genau ein aktives Szenario für Änderungen; Szenarioauswahl klar sichtbar. |
| F49 | Zwei Szenarien als Diagramme nebeneinander vergleichen | Vergleichsansicht ist von der Einzelbearbeitung abzugrenzen; keine gleichzeitige Bearbeitung zweier Szenarien erforderlich. |
| F50 | Nach einer Stations- oder Mitarbeiteränderung Zeiten/Auslastung automatisch neu berechnen und Ablaufreihenfolge sowie Parallelität prüfen | Verschiebungen lösen Rechen- und Konsistenzprüfung aus. Im Widerspruch zu F8/F15 keine harte Sperre für fachliche Restriktionsverletzungen; Warnungen und Konfliktübersicht zeigen. |
| F51 | Zweiten Nutzer bei konkurrierender Änderung warnen und seine Änderung blockieren | Konflikte serverseitig erkennen; keine stille Überschreibung. Geltungsbereich und Auflösung einer Bearbeitungssperre noch zu definieren. |
| F52 | Diagrammexport mit Taktlinie und Stationsbezeichnungen | Keine weiteren Pflichtbestandteile des Diagrammexports beschlossen; F45 legt Excel- und Diagrammexport für MVP fest, PDF-Bericht erst später. |
| F53 | Pilot ist erfolgreich, wenn alle MVP-Funktionen getestet und durch die Arbeitsvorbereitung freigegeben wurden | Abnahmeprotokoll und dokumentierte Testfälle als Nachweis vorsehen. |

### Wichtige Abgrenzungen
- **F48/F49:** Es darf eine read-only-Vergleichsansicht mit zwei Diagrammen geben, obwohl nur ein Szenario aktiv bearbeitet wird.
- **F51/F37:** Offline zwischengespeicherte Änderungen dürfen bei Bearbeitungskonflikten nicht automatisch bestehende Serverdaten überschreiben; Nutzer informieren und Änderung als ungesendet halten.
- **F50/F17:** Zuordnung und errechnete Auslastung ändern sich, importierte Arbeitszeiten jedoch nicht.
- **F53:** Die gemeinsame Abnahme mit der Arbeitsvorbereitung baut auf den Tests aus F47 auf; eine gesonderte Kunden-IT-Freigabe kann weiterhin nötig sein.

**Bearbeitungsstand:** 27 Basisfragen und 53 fachliche Detailfragen beantwortet (insgesamt 80).

## 19 · Zeitberechnung und Datenmodell F54–F59 (26.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F54 | Explizite Vorgänger-IDs je Arbeitsschritt | Standard-Excel-Template um Vorgänger-ID(s) ergänzen; IDs und Zyklen beim Import prüfen. Mehrere Vorgänger durch klar definiertes Format abbilden. |
| F55 | Aufgaben können Mitarbeitern zugeordnet und parallel ausgeführt werden | Je Mitarbeiter Aufgabenbelegung abbilden; ein Mitarbeiter darf im Modell nicht gleichzeitig zwei Tätigkeiten ausführen. Abhängigkeiten aus F54 beachten. |
| F56 | Stationsbalkenhöhe entspricht der Dauer des längsten Mitarbeitereinsatzes | Stationskennzahl aus der höchsten individuellen Mitarbeiterauslastung bilden; die tatsächliche Kalender-/Ablaufdauer bei Wartezeiten ist davon getrennt zu betrachten. Falls Abhängigkeiten Wartezeiten erzwingen, zusätzlich gesondert kennzeichnen. |
| F57 | Ein globaler prozentualer Zuschlag für alle Arbeitsschritte | Zuschlag bei der Berechnung konsistent anwenden. Offen: ob importierte Zeitwerte Zuschläge schon enthalten und ob der Zuschlag projekt- oder szenarioweit gilt. |
| F58 | Nur das aktive Szenario für andere Nutzer sperren | Exklusive Bearbeitungssperre pro Szenario; andere Szenarien weiterhin nutzbar. Ablauf/Timeout sowie Entsperren bei Browserabbruch sind noch festzulegen. |
| F59 | Individuelle Taktzeit pro Szenario | Taktlinie, Soll-/Ist-KPIs und Überlastungswarnungen aus dem Takt des jeweils betrachteten Szenarios ableiten. |

### Fachliche Abgrenzungen
- **F13/F44/F56:** Die gewählte Yamazumi-Balkenhöhe (längster Mitarbeitereinsatz) ist nicht zwangsläufig identisch mit der Ablaufdauer einer Station bei Abhängigkeiten und Wartezeiten. Es ist festzulegen, ob die Ablaufdauer als separate Kennzahl und Warnung ausgegeben wird.
- **F17/F57:** Importierte Basiszeiten bleiben unverändert; etwaige Zuschläge sind rechnerische Faktoren und ändern nicht den importierten Originalwert.
- **F51/F58:** Szenariosperren müssen atomar in Supabase durchgesetzt werden, nicht nur optisch im Frontend.

**Bearbeitungsstand:** 27 Basisfragen und 59 fachliche Detailfragen beantwortet (insgesamt 86).

## 20 · Zuschläge, Mitarbeiterzuordnung und Szenariosperren F60–F65 (26.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F60 | Globaler prozentualer Zeitzuschlag, individuell je Szenario einstellbar | Importierte Basiszeiten unverändert lassen (F17); angezeigte und berechnete Zeiten mit Szenario-Zuschlag ableiten; Eingabe validieren. |
| F61 | Bei Verschiebung eines Arbeitsschritts auf eine andere Station wird er zunächst keinem Mitarbeiter zugeordnet; manuelle Zuweisung notwendig | Aufgabe als „nicht zugeordnet“ markieren und klar anzeigen; bis zur Zuordnung keine scheinbar gültige Mitarbeiter-/Stationsauslastung ausgeben. |
| F62 | Stationsübergreifende Vorgängerbeziehungen zulassen und auf Verletzungen prüfen | Vorgänger-IDs über Stationsgrenzen auflösen; Konflikte markieren und in Restriktionsübersicht anzeigen (F8/F15), nicht automatisch blockieren. |
| F63 | Wartezeiten als eigene Segmente im Yamazumi darstellen | Wartezeiten optisch von Arbeitsinhalt unterscheiden; definieren, ob sie in Balkenhöhe und Auslastungs-KPI einfließen, damit F56 konsistent bleibt. |
| F64 | Szenariosperre automatisch aufheben, sobald der Nutzer das Szenario verlässt | Szenario gezielt freigeben. Bei geschlossenem Tab, Netzwerkverlust oder Absturz ist zusätzlich eine technische Wiederherstellungsstrategie (Lease/Timeout) notwendig; noch nicht entschieden. |
| F65 | Undo/Redo für alle Änderungen innerhalb eines Szenarios, einschließlich Kategorien und Taktzeit | Auch Zuordnungen, Reihenfolge, Zuschlag und einschlägige Szenario-Einstellungen als umkehrbare Aktionen behandeln; Konsistenz mit Autosave und Szenariosperre gewährleisten. |

### Abgrenzungen und offene Klärungen
- **F56/F63:** „Längster Mitarbeitereinsatz“ als Stationshöhe und „Wartezeiten als Yamazumi-Segmente“ können sich überschneiden. Bei der Visualisierung zwischen produktiver Tätigkeit, Wartezeit und gesamter Ablaufdauer unterscheiden; die exakte Rechenregel ist noch offen.
- **F60/F17:** Basiszeiten werden nicht verändert; Zuschläge gelten nur rechnerisch im ausgewählten Szenario.
- **F61/F50:** Fehlende Mitarbeiterzuordnung nach Stationswechsel ist ein eigener Warn-/Unvollständigkeitszustand.
- **F64/F51:** Eine bloße Freigabe beim bewussten Verlassen genügt nicht bei unerwartetem Browserabbruch. Die technische Sperre muss serverseitig sicher auslaufen können.

**Bearbeitungsstand:** 27 Basisfragen und 65 fachliche Detailfragen beantwortet (insgesamt 92).


## 21 · Yamazumi-Darstellung und Datenqualität F66–F71 (26.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F66 | Wartezeiten werden zusätzlich auf produktive Arbeitszeit gestapelt | Produktive Zeit und Wartezeit optisch separat segmentieren; klare Legende und Kennzahlen verwenden. Fachliche Rechenregel zur Überleitung auf die Stationshöhe gemäß F56 vor Implementierung definieren, um Doppelzählungen zu verhindern. |
| F67 | Arbeitsschritte ohne Mitarbeiterzuordnung im Stationsbalken mit auffälliger Warnfarbe markieren | Nicht zugeordnete Arbeitsschritte sichtbar halten; deren Zeiten gesondert ausweisen, da sie noch keinem Mitarbeiter zugerechnet werden können (F61). |
| F68 | Mitarbeiter nur als „Mitarbeiter 1“, „Mitarbeiter 2“, „Mitarbeiter 3“ usw. je Station bezeichnen | Keine Klarnamen als Pflichtfeld; Zuordnung im Template und nach Verschieben konsistent verwalten. |
| F69 | Arbeitsgang-IDs müssen innerhalb einer Produktvariante eindeutig sein | Eindeutigkeit pro Variante beim Import validieren; Vorgänger-IDs müssen auf den richtigen Arbeitsgang innerhalb derselben Variante verweisen. Szenarien referenzieren dieselben fachlichen IDs. |
| F70 | Arbeitsschritte nach tatsächlicher zeitlicher Ausführungsreihenfolge anordnen | Reihenfolge aus Vorgängerbeziehungen und Mitarbeiterbelegung ableiten; parallele Tätigkeiten als gleichzeitig kenntlich machen, statt künstlich nacheinander darzustellen. |
| F71 | Segmentbeschriftung konfigurierbar; zusätzliche Details beim Anklicken | Sichtbare Felder (z. B. Arbeitsgang-ID, Kurztext, Dauer) ein- und ausblendbar; Detailansicht gemäß F33. |

### Noch fachlich zu präzisieren
- **F56/F63/F66:** Die Höhe des Stationsbalkens wurde als längster Mitarbeitereinsatz definiert, Wartezeiten sollen nun zusätzlich als Segmente erscheinen. Zu klären ist, ob „Mitarbeitereinsatz“ ausschließlich produktive Zeit oder produktive Zeit plus Wartezeit meint. Die Anzeige darf weder Wartezeiten doppelt zählen noch eine irreführende Taktüberschreitung erzeugen.
- **F67/F61:** Nicht zugewiesene Aufgaben benötigen eine getrennte Kennzahl; die finale Stations-/Personalauslastung bleibt bis zur Zuordnung als unvollständig gekennzeichnet.
- **F69:** Vor dem Import Vorgänger-Verweise, fehlende IDs und zyklische Abhängigkeiten prüfen.
- **F70:** Eine gestapelte Segmentfolge ist bei parallel ausgeführten Tätigkeiten nicht automatisch eine maßstabsgetreue Zeitleiste. Die grafische Darstellungsregel muss bei der UI-Spezifikation festgelegt werden.

**Bearbeitungsstand:** 27 Basisfragen und 71 fachliche Detailfragen beantwortet (insgesamt 98).


## 22 · Excel-Importtemplate F72–F77 (26.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F72 | Eine Zeile je Arbeitsschritt mit Spalten für Station und Mitarbeiter | Zentrales Tabellenblatt mit je einer Datensatzzeile pro Arbeitsschritt; für gemeinsam ausgeführte Tätigkeiten gilt weiterhin F19 (separate Tätigkeiten pro Mitarbeiter). |
| F73 | Arbeitszeiten in **Minuten mit Dezimalstellen** | Numerische Eingaben mit definiertem Dezimaltrennzeichen prüfen und einheitlich in Minuten interpretieren; importierten Zeitwert gemäß F18 verwenden. |
| F74 | Mehrere Vorgänger-IDs in einer Zelle, durch Semikolon getrennt | Leere Zelle bedeutet keine Vorgänger; Referenzen gegen Arbeitsgang-IDs derselben Variante prüfen, Duplikate und Zyklen erkennen. |
| F75 | Mitarbeiter als Spaltenwert „Mitarbeiter 1“, „Mitarbeiter 2“, „Mitarbeiter 3“ usw. | Stationsbezogene Bezeichnungen gemäß F68; fehlende Zuordnungen als Warnzustand gemäß F61/F67 behandeln. |
| F76 | Kategorien und Farben ausschließlich in der App konfigurieren | Keine Pflichtspalten für Kategorie/Farbe im Excel-Template; Einstellungen je Szenario konsistent mit Undo/Redo und Autosave verwalten. |
| F77 | Räumliche Restriktionen erst nach dem Import in der App definieren; **durch Wissen des Anwenders behandeln** | Keine verpflichtende automatische Modellierung räumlicher Restriktionen und keine erforderlichen Excel-Spalten hierfür. Der Anwender beurteilt räumliche Machbarkeit bei Umverteilungen selbst. Automatisch überprüfbare Vorgängerabhängigkeiten aus F54/F62 bleiben davon unberührt. |

### Abgrenzungen und offene Fragen
- **F77 versus Basisanforderung 11/F8/F15:** Räumliche Restriktionen sind zunächst eine fachliche Entscheidung des Anwenders, keine automatisch erzwingbare Sperre. Das System kann automatisch erkennbare Abhängigkeitsverletzungen weiterhin warnend anzeigen. Optional manuell dokumentierte Hinweise sind gesondert zu entscheiden.
- **F72/F75:** Soll eine Mitarbeiterzuordnung im Import immer obligatorisch sein oder sind leere Werte für spätere Zuordnung zulässig?
- **F73:** Zulässige Dezimaldarstellung, Rundung und Behandlung negativer/fehlender Zeiten sind für die Template-Spezifikation festzulegen.
- **F74:** Für Vorgängerbeziehungen über Stationen gelten die bisherigen Prüfregeln.

**Bearbeitungsstand:** 27 Basisfragen und 77 fachliche Detailfragen beantwortet (insgesamt 104).

## 23 · Importvalidierung und Stammdaten F78–F83 (26.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F78 | Import erlauben und nicht zugeordnete Arbeitsschritte markieren | Leere Mitarbeiterzuordnung ist gültig, erzeugt jedoch einen sichtbaren Warnzustand; keine automatische Zuordnung. |
| F79 | Fehlerhafte Vorgänger-IDs in einer Importvorschau anzeigen und direkt korrigieren | Ungültige, fehlende, doppelte oder zyklische Referenzen vor der Übernahme prüfen; Import erst nach Behebung blockierender Fehler abschließen. |
| F80 | Deutsches Dezimalformat mit Komma | Arbeitszeiten in Minuten, z. B. `1,25`; numerische Excel-Zellen unterstützen; Textwerte kontrolliert auf gültiges deutsches Zahlenformat prüfen. |
| F81 | Import bei fehlender oder ungültiger Arbeitszeit ablehnen | Präzise Fehlermeldung mit Zeilennummer; alle blockierenden Zeitfehler müssen vor Übernahme korrigiert sein. Dies ergänzt die Korrekturvorschau gemäß F31. |
| F82 | Mitarbeiterzahl je Station automatisch aus den importierten Mitarbeiterbezeichnungen ableiten | Eindeutige stationsbezogene Mitarbeiterbezeichnungen zählen. Bei fehlenden Zuordnungen Auslastung als unvollständig markieren; spätere flexible Personalanpassung gemäß F11 bleibt möglich. |
| F83 | Stationen und Arbeitsschritte eines neuen Szenarios vollständig aus Excel übernehmen | Neuer Import erzeugt nach F22 ein eigenes Szenario mit vollständigem Datenbestand. Keine automatische Übernahme aus einem bestehenden Szenario. |

### Konsistenz und offene Implementierungsdetails
- **F78/F81:** Fehlende Mitarbeiter dürfen importiert werden, fehlende/ungültige Zeiten nicht.
- **F79/F81:** Die Importvorschau ermöglicht Korrekturen; die endgültige Übernahme ist bis zur Behebung blockierender Fehler gesperrt.
- **F82/F11:** Abgeleitete Mitarbeiterzahlen beschreiben den Importzustand; spätere Änderungen an der Personalausstattung erfolgen im Szenario.
- **F83/F24:** Frei benennbare Szenarien bleiben möglich, aber ihre initialen Arbeitsgänge werden aus Excel eingelesen; Varianten erhalten weiterhin getrennte Dateien.
- **Offen:** Definition zulässiger Nullzeiten und Nachkommastellen; Verhalten bei Teilkorrekturen und Import-Abbruch; automatische Erkennung bzw. Prüfung doppelt verwendeter Mitarbeiterbezeichnungen.

**Bearbeitungsstand:** 27 Basisfragen und 83 fachliche Detailfragen beantwortet (insgesamt 110).


## 24 · Abschließende Excel-Importregeln F84–F89 (26.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F84 | Arbeitszeiten mit **zwei Nachkommastellen** (z. B. `1,25 min`) | Importvalidierung auf zwei Dezimalstellen ausrichten; nicht stillschweigend runden, sofern die Rundungsregel nicht festgelegt ist. |
| F85 | Arbeitsschritte mit **0 Minuten** werden beim Import abgelehnt | Importvalidierung verlangt eine positive Zeit > 0 für jeden Arbeitsschritt; Fehlermeldung in der Korrekturvorschau. |
| F86 | Fehlende Stationsbezeichnung führt zur Ablehnung des Imports | Fehlende Station als blockierenden Fehler anzeigen; Korrektur in der Vorschau gemäß F31 anbieten. |
| F87 | Widersprüchliche oder zyklische Vorgängerbeziehungen in einer Importvorschau korrigieren, anschließend erneut prüfen | Graphvalidierung auf fehlende IDs, Selbstverweise und Zyklen; Übernahme erst nach erfolgreicher Prüfung. |
| F88 | Dateiname automatisch als **Varianten- und Szenarioname** übernehmen | Gleiche initiale Bezeichnung für beide Felder; Dateiendung vorzugsweise entfernen. Frei umbenennbare Szenarien gemäß F24 bleiben möglich. Namenskonflikte sind noch zu definieren. |
| F89 | Excel-Vorlage mit einem Blatt **Arbeitsgänge** und einem separaten Blatt **Ausfüllanleitung** | Pflichtfelder und Beispiele im Anleitungsblatt erläutern; keine weiteren Tabellenblätter für Kategorien oder Restriktionen erforderlich (F76/F77). |

### Konsequenzen und offene Präzisierungen
- **F84/F80:** Eingabe und Darstellung in Minuten, deutsches Dezimalkomma und zwei Nachkommastellen.
- **F85/F81/F86/F87:** Nullzeiten, fehlende Stationen, Zeitfehler und zyklische Vorgängerbeziehungen sind blockierende Importfehler; korrigierbare Importvorschau bereitstellen.
- **F88/F24:** Dateiname dient als Startwert, Szenarioname kann anschließend geändert werden.
- **F89/F72–F77:** Ein zentrales Arbeitsgangblatt genügt für die eigentlichen Importdaten.

**Bearbeitungsstand:** 27 Basisfragen und 89 fachliche Detailfragen beantwortet (insgesamt 116).


## 25 · Yamazumi-Dashboard und Berechnungsregeln F90–F95 (26.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F90 | Stationshöhe = **längster Mitarbeitereinsatz inklusive Wartezeit** | Für jeden Mitarbeiter produktive Arbeits- und zugehörige Wartezeiten zu einer Belegungsdauer kombinieren; die größte Dauer bestimmt die Stationshöhe. Wartezeiten gesondert segmentieren, ohne sie doppelt aufzuaddieren. Die Berechnung der Wartezeiten aus Vorgängerbeziehungen ist gesondert zu testen. |
| F91 | Alle Stationen horizontal nebeneinander, mit Scrollfunktion | Horizontal scrollbare Yamazumi-Fläche; Stationsköpfe und Taktlinie sollen beim Scrollen gut lesbar bleiben. |
| F92 | Umschalter zwischen Stations- und Mitarbeiteransicht oberhalb des Diagramms | Ein gemeinsamer, jederzeit erreichbarer Ansichtsumschalter; Auswahl bleibt im aktuellen Szenario erhalten. |
| F93 | Feste Standardkategorien mit veränderbaren Farben | Vordefinierte Kategorien; Farbkonfiguration innerhalb der App. Die konkreten Kategorien und Geltungsbereiche sind noch zu bestimmen. |
| F94 | Horizontale Taktlinie mit numerischer Beschriftung | Szenariospezifische Taktzeit (F59) wird als beschriftete Linie im Diagramm angezeigt. |
| F95 | Direkter Drag-and-drop eines Arbeitsschritts ohne zusätzliches Fenster | Nach dem Ablegen unmittelbar neu berechnen und erforderliche Warnungen anzeigen. Bei Stationswechsel zunächst Mitarbeiterzuordnung entfernen (F61); Autosave/Undo/Redo berücksichtigen. |

### Konsistenz- und offene Implementierungsfragen
- **F90/F56/F63/F66:** Die Stationshöhe ist die längste *Mitarbeiterbelegungsdauer inklusive Wartezeit*. Wartezeitsegmente sollen Bestandteil dieses Werts sein, nicht zusätzlich außerhalb dieser Dauer aufaddiert werden. Eine grafisch gestapelte Summendarstellung darf parallele Tätigkeiten nicht künstlich sequenzialisieren.
- **F95/F61:** Nach dem Verschieben auf eine andere Station bleibt der Schritt zunächst ohne Mitarbeiter. Dadurch ist die neue Stationshöhe bis zur Zuweisung unvollständig; ein Warnzustand ist anzuzeigen. Ein zusätzlicher Bearbeitungsdialog ist für den eigentlichen Drag-and-drop-Vorgang nicht vorgesehen.
- **F93:** Die Standardkategorien selbst, ihre Definition und die Gültigkeit der Farbeinstellungen (Projekt oder Szenario) sind noch festzulegen.
- **F91/F92/F94:** Die Umsetzung muss sowohl für Laptop als auch Workshop-Bildschirm gut lesbar bleiben und die Taktlinie passend zur Szenariozeit zeichnen.

**Bearbeitungsstand:** 27 Basisfragen und 95 fachliche Detailfragen beantwortet (insgesamt 122).


## 26 · Dashboard-Bedienung und Visualisierung F96–F101 (26.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F96 | **Suchfunktion und kombinierbare Filter** | Arbeitsgänge nach Nummer/Beschreibung suchen und beispielsweise nach Station, Mitarbeiter und Kategorie filtern; gleichzeitig aktive Kriterien anzeigen und zurücksetzen können. |
| F97 | **Standardkategorien: Wertschöpfend, nicht wertschöpfend, Wartezeit** | Diese drei Kategorien als Vorgaben anbieten. Farben gemäß F93 innerhalb der App veränderbar; systemisch berechnete Wartezeitsegmente von importierten Arbeitsschritten unterscheiden. |
| F98 | **Horizontale Stationsbreite und vertikale Zeitskala getrennt einstellen** | Zwei unabhängige Bedienelemente; Scrollverhalten aus F91 und Taktlinie aus F94 bleiben korrekt. |
| F99 | **Tooltip mit allen relevanten Arbeitsgangdetails** | Arbeitsgang-ID, Beschreibung, Zeit, Station, Mitarbeiter, Vorgänger, Kategorie und Restriktions-/Zuordnungswarnungen, soweit vorhanden; zusätzlich anklickbare Detailansicht gemäß F33/F71. |
| F100 | **Mitarbeiterzuordnung über eine Auswahl direkt am Arbeitsschritt** | Nach Stationswechsel zunächst unzugeordnet (F61); anschließend zu einem Mitarbeiter der Zielstation zuweisen und Zeiten/Abhängigkeiten neu berechnen (F50). |
| F101 | **Kennzahlen oberhalb des Yamazumi: Szenarioname, Taktzeit, Mitarbeiterzahl, Gesamtarbeitsinhalt und Auslastungsgrad** | Anzeige gemeinsam mit konfigurierbaren KPIs (F10). Die genaue Auslastungsformel, insbesondere bei parallelen Abläufen und Wartezeit, muss fachlich definiert werden. |

### Noch zu präzisierende Punkte
- Systemisch berechnete **Wartezeit** nicht mit einem importierten Arbeitsgang verwechseln (F97/F90).
- Filter sollen die Übersicht verändern, aber nicht stillschweigend die Gesamt-KPIs verfälschen (F96/F101).
- Für unzugeordnete Arbeitsschritte ist festzulegen, wie die Stationshöhe und der Auslastungsgrad bis zur Mitarbeiterzuordnung behandelt werden (F61/F67/F100).

**Bearbeitungsstand:** 27 Basisfragen und 101 fachliche Detailfragen beantwortet (insgesamt 128).


## 27 · Mitarbeiteransicht und Szenariovergleich F102–F107 (26.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F102 | Jeder Mitarbeiter erhält einen eigenen Balken nebeneinander | In der Mitarbeiteransicht Mitarbeiter je Station nebeneinander zeigen, konsistent mit stationsbezogenen Bezeichnungen aus F68. |
| F103 | Zwei gut sichtbare Reiter für Ist und Ziel | Reiter zum Wechsel des aktiven Szenarios; mehrere frei benennbare Szenarien (F24) bleiben bestehen. Zu klären ist, wie weitere Szenarien den Reitern zugeordnet werden. |
| F104 | Zwei Diagramme nebeneinander mit synchronisiertem Scrollen | In der Vergleichsansicht horizontale Scrollposition der Diagramme koppeln. Unterschiedliche Stationslisten und gleiche vertikale Zeitskala gesondert festlegen. |
| F105 | Mitarbeiterzahl direkt unter jeder Station anzeigen | Aus importierten Bezeichnungen initial ableiten (F82); spätere flexible Zuordnung gemäß F11 berücksichtigen. |
| F106 | Mitarbeiterbalken oberhalb der Taktzeit rot markieren | Gilt in Mitarbeiteransicht; szenariospezifische Taktzeit nach F59/F94. |
| F107 | Zwei Kennzahlen getrennt darstellen: Stationsbelegung und Personalauslastung | Stationsbelegung gemäß F90: längste Mitarbeiterbelegungsdauer inklusive Wartezeit im Verhältnis zum Takt; Personalauslastung soll auf produktiver Zeit und verfügbarer Mitarbeiterkapazität beruhen. Exakte Definition, Nenner und Umgang mit unzugeordneten Schritten noch festlegen. |

### Offene Punkte für die Umsetzung
- **F103/F24:** Reiter Ist/Ziel dürfen die Möglichkeit zusätzlicher frei benennbarer Szenarien nicht ausschließen.
- **F104/F91:** Synchronisiertes Scrollen bei abweichenden Stationsbeständen und einer alphabetischen Stationssortierung (F32) definieren.
- **F107/F90:** Wartezeiten bei der Stationsbelegung berücksichtigen, aber nicht als produktive Arbeitszeit in die Personalauslastung einrechnen.
- **F105/F61:** Bei unzugeordneten Arbeitsgängen Kennzahlen sichtbar als unvollständig ausweisen.

**Bearbeitungsstand:** 27 Basisfragen und 107 fachliche Detailfragen beantwortet (insgesamt 134).


## 28 · Kennzahlen und Vergleichslogik F108–F113 (26.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F108 | **Personalauslastung = produktive Arbeitszeit inklusive Wartezeiten / verfügbare Mitarbeiterzeit** | Verfügbare Mitarbeiterzeit grundsätzlich als Mitarbeiteranzahl × Szenariotaktzeit interpretieren; Zähler und Behandlung von Wartezeiten fachlich transparent kennzeichnen. Diese Auswahl ersetzt die frühere vorläufige Definition in den Umsetzungshinweisen zu F107. |
| F109 | **Nicht zugeordnete Arbeitsschritte bis zur Zuordnung aus allen Berechnungen ausschließen** | Nicht zugeordnete Schritte im Diagramm warnend anzeigen (F67), aber keine Berücksichtigung in berechneten Zeiten/KPIs. Hinweis, dass Werte bis zur vollständigen Zuordnung unvollständig sind. |
| F110 | **Zwei Reiter Ist und Ziel, denen beliebige Szenarien zugewiesen werden** | Pro Reiter Szenario auswählen; Ist/Ziel sind Ansichtsrollen, nicht zwingend feste Datensätze. Nur ein Szenario gleichzeitig bearbeiten (F48). |
| F111 | **Stationen anhand der Bezeichnung gegenüberstellen, fehlende Stationen leer anzeigen** | Bezeichnungsabgleich im Vergleich, auch wenn zwei Importe verschiedene Stationsbestände haben. |
| F112 | **Beide Vergleichsdiagramme verwenden automatisch dieselbe vertikale Skala** | Gemeinsame Skala berücksichtigt maximale Balkenhöhe und beide Taktlinien. Horizontales Scrollen synchronisiert (F104). |
| F113 | **Verschobene Arbeitsschritte im Vergleich zusätzlich farblich markieren** | Farbkennzeichnung muss sich von Kategorienfarben und Überlastungswarnungen unterscheiden; Zuordnung der Arbeitsschritte über stabile IDs. |

### Zu prüfende Konsistenzpunkte
- **F108 und F97/F107:** Die vom Anwender ausdrücklich gewählte Kennzahl **zählt Wartezeit in der Personalauslastung mit**. Damit ist sie eine belegungsbezogene Auslastung, nicht ausschließlich produktive Auslastung. UI-Name/Definition vor Abnahme festlegen; beide Begriffe nicht stillschweigend gleichsetzen.
- **F109 und F67:** Unzugeordnete Schritte sichtbar markieren, aber rechnerisch ausschließen. Ein deutlicher Vollständigkeitshinweis verhindert irreführende Gesamtauslastungswerte.
- **F110/F48/F58:** Ist und Ziel können beliebigen Szenarien zugewiesen werden, aber nur das aktiv bearbeitete Szenario wird gesperrt.
- **F111/F112:** Abweichende Stationen erzeugen leere Vergleichspositionen; gleiche Skala beibehalten.

**Bearbeitungsstand:** 27 Basisfragen und 113 fachliche Detailfragen beantwortet (insgesamt 140).


## 29 · Szenariovergleich und Bearbeitungslogik F114–F119 (26.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F114 | **Je Reiter ein Dropdown zur Auswahl eines bestehenden Szenarios** | Für Ist und Ziel separate Szenarioauswahl; Reiter sind Ansichtsrollen (F110). |
| F115 | **Dasselbe Szenario darf in beiden Ansichten ausgewählt werden** | Keine erzwungene Duplizierung oder Sperre allein durch doppelte Auswahl. Gleiche Datengrundlage deutlich erkennbar halten. |
| F116 | **Verschobene Arbeitsschritte mit kleinem Verschiebungssymbol markieren** | Symbol unterscheidbar von Kategorie-/Warnfarben; Vergleich anhand stabiler Arbeitsgang-IDs. Dies konkretisiert F113; die zuvor festgelegte farbliche Hervorhebung bleibt ergänzend bestehen. |
| F117 | **Nicht zugeordnete Arbeitsschritte ausschließen und deutlich auf unvollständige Berechnung hinweisen** | Erhält F109 bei und konkretisiert die UI-Warnung; Balkensegmente für nicht zugeordnete Schritte gemäß F67 sichtbar markieren, aber nicht in KPIs einrechnen. |
| F118 | **In der Vergleichsansicht ist nur das Zielszenario bearbeitbar** | Ist-Seite schreibgeschützt. Bei identischer Szenarioauswahl (F115) wirkt eine Bearbeitung im Ziel auf denselben Datensatz und kann dadurch auch im Ist-Diagramm erscheinen; dieses Verhalten bedarf sichtbarer Kennzeichnung. |
| F119 | **Kleine Statussymbole neben dem Szenarionamen** | Status für gespeichert/synchronisiert/nicht gespeichert/gesperrt im kompakten Format; Tooltip oder Legende erklärt Symbole, damit Fehlerzustände nicht übersehen werden. |

### Fachliche und technische Hinweise
- **F115 × F118:** Wird dasselbe Szenario in Ist und Ziel gewählt, ist die Ist-Ansicht zwar nicht direkt editierbar, zeigt aber den durch die Ziel-Ansicht veränderten gemeinsamen Datensatz. Diese Folge nicht mit einer unabhängigen, schreibgeschützten Momentaufnahme verwechseln.
- **F119 × F37:** Kleine Statussymbole müssen fehlgeschlagene Speicherung und ausstehende Synchronisation klar signalisieren.
- **F116 × F113:** Das Verschiebungssymbol ergänzt die bestehende farbliche Markierung; Symbole dürfen die relevanten Arbeitsganginformationen nicht verdecken.

**Bearbeitungsstand:** 27 Basisfragen und 119 fachliche Detailfragen beantwortet (insgesamt 146).


## 30 · Dashboard-Layout und Workshop-Bedienung F120–F125 (26.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F120 | **Oben Navigation, darunter Filter und Kennzahlen, anschließend Yamazumi** | Seitenstruktur für Einzel- und Vergleichsansicht beibehalten; horizontal scrollbare Diagrammfläche gemäß F91. |
| F121 | **Suche und Filter dauerhaft oberhalb des Diagramms** | Suchfeld und kombinierbare Filter (F96) immer sichtbar, auf schmalen Geräten kompakt anordnen. |
| F122 | **Vergleich über einen Vergleich-Button oberhalb des Diagramms öffnen** | Umschalten zwischen Einzel- und Zwei-Diagramm-Ansicht; Vergleich gemäß F104/F110–F118. |
| F123 | **Einfacher Klick auf einen Arbeitsgang öffnet ein seitliches Detailpanel** | Panel mit Arbeitsgangdetails einschließlich Vorgängern, Mitarbeiter, Restriktionen und Warnungen (F33/F99); Drag-and-drop bleibt direkt nutzbar. |
| F124 | **Drei bis vier Hauptkennzahlen sichtbar, weitere in aufklappbarem Bereich** | Haupt-KPIs im Kopfbereich, optionale Kennzahlen expandierbar; F10/F101/F107/F108 bei Definition berücksichtigen. |
| F125 | **Responsiv für Laptop, Desktop und Workshop-Bildschirm** | Diagramm, Filter, Panels und Vergleich in allen drei Bildschirmklassen nutzbar, ohne die Datenlesbarkeit durch zu kleine Balken zu verlieren. |

### Implementierungshinweise und offene Punkte
- **F120/F121/F124:** Bei geringer Fensterbreite Filter und KPI-Kacheln umbrechen lassen; die Yamazumi-Fläche soll möglichst viel Höhe erhalten.
- **F122/F104/F112:** In der Vergleichsansicht vertikale Skalierung und horizontales Scrollen synchronisieren.
- **F123/F95/F118:** Ist-Diagramm in der Vergleichsansicht nicht bearbeitbar; Ziel-Diagramm per Drag-and-drop editierbar. Detailpanel darf die Lesbarkeit des Diagramms nicht unnötig einschränken.
- **F124/F108:** Die als Personalauslastung bezeichnete Kennzahl umfasst gemäß Nutzerentscheidung auch Wartezeit, also belegungsbezogene Auslastung.

**Bearbeitungsstand:** 27 Basisfragen und 125 fachliche Detailfragen beantwortet (insgesamt 152).


## 31 · Detailpanel, Interaktion und Prototyp F126–F131 (26.10.2026)

| ID | Verbindliche Entscheidung | Umsetzungshinweis |
|---|---|---|
| F126 | Detailpanel rechts über das Diagramm einblenden | Overlay statt Verkleinern des Diagramms. |
| F127 | Alle bearbeitbaren Eigenschaften außer importierten Arbeitszeiten im Detailpanel ändern | Zeiten schreibgeschützt, übrige Felder nur soweit für Szenarioänderungen vorgesehen. |
| F128 | Filter reduzieren sichtbare Arbeitsschritte und die Balkenhöhen entsprechend | Filteransicht deutlich als gefiltert kennzeichnen; ungefilterte Kennzahlen gesondert erläutern. |
| F129 | Alle möglichen Zielstationen beim Ziehen markieren | Fachlich gesperrte Ziele gesondert warnen; räumliche Restriktionen beruhen auf Anwenderwissen. |
| F130 | Haupt-KPIs: Taktzeit, Mitarbeiterzahl, Personalauslastung, Gesamtarbeitsinhalt | Belegungsbezogene Personalauslastung gemäß F108 inklusive Wartezeit. |
| F131 | Dashboard-Prototyp direkt mit echter XT-686-EF-Zeitaufnahme testen | Ausgangsdatei enthält noch nicht alle Pflichtfelder des geplanten Templates; Zuordnungen/Lücken markieren, keine Vorgänger erfinden. |

### Hinweise zur Datenmigration der realen Zeitaufnahme
Die vorhandene Datei enthält mehrfach leere Arbeitsgang-IDs, wiederholt gruppierte Stations-/Mitarbeiterbezeichnungen und verschiedene Zeitspalten. Ein Prototyp kann vorhandene Zeilen als vorläufige Datengrundlage lesen; für einen produktiven validierten Import müssen eindeutige IDs, verbindliche Zeitspalten und Vorgängerbeziehungen separat geklärt werden. Aus einer fehlenden Vorgänger-ID ist keine fachliche Unabhängigkeit ableitbar.

**Bearbeitungsstand:** 27 Basisanforderungen und 131 fachliche Detailanforderungen (158 insgesamt).


## 32 · Umsetzungs- und Abnahmerahmen (Entwurf, 26.10.2026)

> **Status:** Dieser Abschnitt unterscheidet dokumentierte Entscheidungen von noch offenen Detailfestlegungen. Er ergänzt die Anforderungen F1–F131, ersetzt sie nicht.

### A · MVP und spätere Erweiterungen

**MVP gemäß bisherigen Entscheidungen:** Standardisierter Excel-Import mit Validierung; Yamazumi nach Station und Mitarbeiter; manuelles Drag-and-drop; einfache sequenzielle und parallele Vorgängerlogik; Szenarien und Vergleich; Warnungen; Auto-Speichern und Undo/Redo; Excel- und Diagrammexport; projektgebundener Login und RLS; responsives NEONEX-Design.

**Zurückgestellt:** Automatische Verschiebungsvorschläge (F43) und ausführlicher PDF-Bericht (F45). Der Umgang mit sehr komplexen Ressourcenabhängigkeiten erfordert gesonderte Freigabe (F44).

### B · Rechenregeln: bereits festgelegt

- Zeitbasis: importierter berechneter Zeitwert, in Minuten mit zwei Dezimalstellen, unveränderlich (F17/F18/F73/F84).
- Ein pro Szenario einstellbarer prozentualer Zuschlag (F57/F60); Zeitpunkt der Rundung noch offen.
- Explizite Vorgänger-IDs; parallele Ausführung möglich (F54/F55). Zyklen werden vor dem Import korrigiert (F87).
- Stationshöhe: längste Mitarbeiter-Belegungsdauer inklusive Wartezeit; Wartezeiten werden gesondert als Segmente sichtbar (F63/F66/F90).
- Belegungsbezogene Personalauslastung inklusive Wartezeit, verglichen mit verfügbarer Mitarbeiterzeit (F108); Stationsbelegung wird separat ausgewiesen (F107).
- Nicht zugeordnete Arbeitsgänge bleiben sichtbar, werden aber aus Berechnungen ausgeschlossen; Kennzahlen müssen vor Unvollständigkeit warnen (F109/F117).

**Offen für belastbare Implementierung:** Start-/Endzeitberechnung bei gemeinsamen Vorgängern, Regeln für Wartezeit und Leerlauf, Zuschlagsbehandlung bei Wartezeit, Rundungsstrategie und explizite Bezugsmenge des Auslastungsgrads. Keine stillschweigenden Annahmen zulassen.

### C · Vorläufige, aus Anforderungen abgeleitete Akzeptanztests

1. **Excel-Import:** Datei mit fehlender Station, ungültiger/Null-Zeit oder zyklischen Vorgängern wird nicht übernommen; korrigierbare Fehler sind in der Vorschau ausgewiesen (F79/F81/F85/F86/F87).
2. **Datenintegrität:** Importzeiten bleiben auch nach Verschiebungen unverändert (F17).
3. **Drag-and-drop:** Verschobener Arbeitsgang ist zunächst nicht einem Mitarbeiter zugeordnet; Balken und Kennzahlen werden entsprechend neu berechnet und Unvollständigkeit angezeigt (F50/F61/F109/F117).
4. **Zeitlogik:** Ein definierter Beispieldatensatz mit sequenziellen und parallelen Tätigkeiten liefert reproduzierbar die erwarteten Belegungs-, Warte- und Auslastungswerte (F44/F54–F56/F90/F108). **Die konkreten Testfälle/Erwartungswerte sind noch festzulegen.**
5. **Szenariovergleich:** Ist ist in der Vergleichsansicht schreibgeschützt, Ziel editierbar; gleiche Skala und synchrones Scrollen (F104/F112/F118).
6. **Schreibschutz:** Zweiter Nutzer wird beim Versuch, ein bereits gesperrtes Szenario zu bearbeiten, gewarnt und blockiert (F51/F58); Entsperrung beim Verlassen (F64).
7. **Datenzugriff:** Projektdaten sind nur für erlaubte Projektmitglieder über geprüfte Datenbankregeln abrufbar; Referenz-Login wird übernommen (F39 und Authentifizierungsentscheidung).
8. **Pilot-Abnahme:** MVP wird mit der Arbeitsvorbereitung gemeinsam getestet und von ihr freigegeben (F47/F53).

### D · Noch zu entscheidende Punkte – nächster Fragenblock

- P1: Reihenfolge und Umfang der MVP-Abnahme
- P2: Genaue Definition und Rundung des Zuschlags
- P3: Ermittlung der Wartezeit und Verwendung in Belegungszeiten
- P4: Behandlung von nicht zugeordneten Tätigkeiten in Ergebnissen
- P5: Freigabe der Tests und Zuständigkeit für fachliche Sollwerte
- P6: Übergabeformat der Entwicklungsspezifikation für VS Code


## 33 · Abschließende Spezifikationsentscheidungen P1–P6 (26.10.2026)

| ID | Entscheidung | Status |
|---|---|---|
| P1 | Prozentualer Zeitzuschlag **nur auf die Gesamtzeit je Mitarbeiter** anwenden, nicht auf einzelne Arbeitsgänge. | Verbindlich |
| P2 | **Erst die Berechnungsergebnisse auf zwei Dezimalstellen runden**, nicht die Zwischenwerte. | Verbindlich |
| P3 | **Wartezeiten aus Vorgängerabhängigkeiten und Mitarbeiterverfügbarkeit** ermitteln. | Verbindlich |
| P4 | **Kennzahlen trotz unzugeordneter Arbeitsgänge anzeigen**, aber mit deutlichem Hinweis auf unvollständige Ergebnisse. Nicht zugeordnete Aufgaben werden gemäß F109 nicht eingerechnet. | Verbindlich |
| P5 | **Kurze Abnahme-Checkliste je Hauptfunktion** statt ausführlicher Testfalldokumentation. | Verbindlich |
| P6 | Für VS Code **getrennte Markdown-Dateien für Anforderungen, Datenmodell und Tests** verwenden. | Verbindlich |

### Auslegungsgrenzen und offene technische Entscheidungen

- **P1 in Verbindung mit F90/F108:** Ein Zuschlag auf die Gesamtzeit je Mitarbeiter ist vereinbart. Ob er auf reine Tätigkeitsdauer oder auf bereits um Wartezeit ergänzte Mitarbeiterbelegungsdauer anzuwenden ist, ist **nicht ausdrücklich festgelegt**. Bis zur fachlichen Klärung darf er nicht gleichzeitig auf Einzelschritte und Summen aufgeschlagen werden.
- **P3:** Abhängigkeiten und Mitarbeiterverfügbarkeit steuern den Ablauf. Details wie mehrere gleichzeitige Vorgänger, Startzeit null, Wartezeitarten und stationsübergreifende Synchronisation benötigen definierte Algorithmus-Tests; hierzu ist keine zusätzliche fachliche Regel beschlossen.
- **P2:** Zwei Nachkommastellen sind eine Anzeige-/Ergebnisregel. Interne Zeitwerte und Zwischenrechnungen sind ohne vorzeitige Rundung zu führen.
- **F57/F60/P1:** Die ursprünglich global genannte Zuschlagsart wird für die Anwendung gemäß F60 **pro Szenario** konfiguriert und gemäß P1 auf Mitarbeiter-Gesamtzeiten angewendet.
- **F109/P4:** Ein sichtbarer Filter gemäß F128 reduziert die sichtbaren Balkenhöhen; die KPIs müssen transparent zwischen gefilterter Ansicht und gesamtem zugeordnetem Datensatz unterscheiden. Welche KPI standardmäßig welchen Umfang verwendet, ist noch nicht abschließend beschlossen.
- **F23/F118:** Die allgemeine Bearbeitbarkeit eines Ist-Datenstandes bleibt bestehen, aber **in der Vergleichsansicht** darf nur das Ziel bearbeitet werden.

**Bearbeitungsstand:** 27 Basisanforderungen, F1–F131 und sechs Ergänzungsentscheidungen P1–P6. Die 158 bisherigen Anforderungen bleiben unverändert; P1–P6 sind gesonderte Beschlüsse.

## 34 · Rechenregeln E1–E7 (26.10.2026)

Getroffen im Rahmen der Entwicklung. Präzisieren P1, P3 und die offenen Punkte zu F56/F62/F90/F101/F108. Vollständige Regeln: `docs/RECHENREGELN.md`.

| ID | Entscheidung | Status |
|---|---|---|
| E1a | Stationsübergreifende Vorgänger erzeugen **keine** Wartezeit. Jede Station wird als eigener Taktzyklus ab 0 eingeplant; nur Vorgänger in derselben Station erzeugen Wartezeit. | Verbindlich |
| E1b | Die alphabetische Stationsreihenfolge gilt als Flussreihenfolge für die Verletzungsprüfung nach F62. Ein Vorgänger an einer später einsortierten Station ist eine Verletzung. | Verbindlich |
| E2 | Der Zuschlag gemäß P1 wird **nur auf die produktive Zeit** je Mitarbeiter angewendet, nicht auf Wartezeit, und verschiebt keine Startzeiten. | Verbindlich |
| E3 | Ein Mitarbeiter arbeitet nach **automatischer Listenplanung**: jeweils die früheste ausführbare Tätigkeit, `Reihenfolge` nur bei Gleichstand. | Verbindlich |
| E4 | Ein nicht zugeordneter Vorgänger wird zeitlich ignoriert; der Nachfolger erhält die Warnung „Startzeit unsicher“. | Verbindlich |
| E5 | Start = max(Mitarbeiter frei, Ende aller zugeordneten Vorgänger derselben Station); Beginn bei 0; Wartezeit = Lücke vor einer Tätigkeit; Leerlauf nach der letzten Tätigkeit ist keine Wartezeit. | Verbindlich |
| E6a | Mitarbeiter ohne zugeordnete Tätigkeit zählen bei Mitarbeiterzahl und im Nenner der Personalauslastung (F108) mit. | Verbindlich |
| E6b | Gesamtarbeitsinhalt = Summe der importierten Zeiten aller zugeordneten Schritte, ohne Zuschlag. | Verbindlich |
| E7 | Das Rechenbeispiel in `docs/OFFENE_ENTSCHEIDUNGEN.md` ist der verbindliche Sollwert für die Abnahme der Berechnung. | Verbindlich |
