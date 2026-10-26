/**
 * Kaufmännische Rundung für Ergebnisse (P2, E34): ab 5 vom Betrag her
 * aufrunden. Zwischenwerte werden nie gerundet, nur die Ausgabe.
 *
 * Das Verschieben um `decimals` Stellen erzeugt Gleitkommarauschen
 * (z. B. 101,875 % → 10187,499999999998). `toPrecision(15)` entfernt dieses
 * Rauschen, bevor gerundet wird; 15 signifikante Stellen liegen sicher
 * innerhalb der Genauigkeit von double.
 */
export function roundHalfUp(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Nicht rundbarer Wert: ${value}`);
  }
  const factor = 10 ** decimals;
  const shifted = Number((Math.abs(value) * factor).toPrecision(15));
  const result = (Math.sign(value) * Math.round(shifted)) / factor;
  return result === 0 ? 0 : result;
}

/** Verhältnis (z. B. 1.01875) als gerundeter Prozentwert (101.88). */
export function roundPercent(ratio: number, decimals = 2): number {
  return roundHalfUp(ratio * 100, decimals);
}
