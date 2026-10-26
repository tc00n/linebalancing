# Backlog

Anmerkungen aus Tests, die bewusst zurückgestellt sind. Keine fachlichen Entscheidungen; die stehen in [`OFFENE_ENTSCHEIDUNGEN.md`](OFFENE_ENTSCHEIDUNGEN.md).

| Datum      | Bereich             | Anmerkung                                                                                                                                                                                                                                       | Quelle                            |
| ---------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 26.10.2026 | Yamazumi (Frontend) | ~~Bei wenigen Stationen (z. B. 7 bei XT 686 EF) reicht der Regler „Breite“ nicht, um das Diagramm auf die volle Bildschirmbreite zu verteilen.~~ **Erledigt in Phase 8:** Regler bis 400 px und Schaltfläche „An Fenster anpassen“ (F98, F125). | Test durch Anwender mit XT 686 EF |
| 26.10.2026 | Yamazumi (Frontend) | ~~Breite reicht auch mit 400 px nicht weit genug.~~ **Erledigt:** Breite bis 1200 px, auch für „An Fenster anpassen“.                                                                                                                           | Test durch Anwender               |
| 26.10.2026 | Yamazumi (Frontend) | ~~Zeitskala springt schon bei kleinster Reglerbewegung stark.~~ **Erledigt:** beide Regler logarithmisch, Zeitskala mit Zwischenwerten (0,5–300 px/min), Wertanzeige neben dem Regler.                                                          | Test durch Anwender               |
