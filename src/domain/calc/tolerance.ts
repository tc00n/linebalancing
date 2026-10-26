/**
 * Toleranz für Zeitvergleiche (docs/RECHENREGELN.md, Abschnitt 1): Summen
 * aus Minutenwerten mit zwei Nachkommastellen enthalten Gleitkommarauschen
 * (0,1 + 0,2 ≠ 0,3). Ohne Toleranz könnte das Rauschen einen Gleichstand
 * in der Listenplanung oder eine Taktüberschreitung kippen.
 */
export const TIME_EPSILON = 1e-9;

/** a liegt echt vor b. */
export function isBefore(a: number, b: number): boolean {
  return a < b - TIME_EPSILON;
}

/** a überschreitet b echt. */
export function exceeds(a: number, b: number): boolean {
  return a > b + TIME_EPSILON;
}

export function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= TIME_EPSILON;
}
