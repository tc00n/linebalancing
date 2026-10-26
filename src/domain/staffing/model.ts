export interface StaffingRow {
  readonly sourceRow: number;
  readonly area: string;
  readonly teamSpeaker: string | null;
  readonly costCenter: string | null;
  readonly station: string | null;
  readonly support: boolean;
  readonly productive: number;
  /** Separater, in Excel bereits gerundeter Bruttobedarf. */
  readonly gross: number | null;
}
export interface CostCenterActual {
  readonly costCenter: string;
  readonly actual: number | null;
  readonly sourceGross: number | null;
}
export interface StaffingPlan {
  readonly filename: string;
  readonly taktMin: 70;
  readonly grossFactor: number | null;
  readonly rows: readonly StaffingRow[];
  readonly actuals: readonly CostCenterActual[];
  readonly warnings: readonly string[];
}
export function validateStaffingPlan(
  value: unknown,
): asserts value is StaffingPlan {
  if (!value || typeof value !== "object")
    throw Error("Personalplanung fehlt.");
  const p = value as StaffingPlan;
  const number = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0;
  const text = (s: unknown) => typeof s === "string" && s.length <= 500;
  const nullableText = (s: unknown) => s === null || text(s);
  if (
    !text(p.filename) ||
    p.taktMin !== 70 ||
    !(p.grossFactor === null || number(p.grossFactor)) ||
    !Array.isArray(p.rows) ||
    !p.rows.length ||
    p.rows.length > 2000 ||
    !Array.isArray(p.actuals) ||
    p.actuals.length > 1000 ||
    !Array.isArray(p.warnings) ||
    p.warnings.length > 500 ||
    !p.warnings.every(text)
  )
    throw Error("Ungültige Personalplanung.");
  const seen = new Set<number>();
  for (const r of p.rows) {
    if (
      !Number.isInteger(r.sourceRow) ||
      r.sourceRow < 1 ||
      seen.has(r.sourceRow) ||
      !text(r.area) ||
      !nullableText(r.teamSpeaker) ||
      !nullableText(r.costCenter) ||
      !nullableText(r.station) ||
      typeof r.support !== "boolean" ||
      !number(r.productive) ||
      !(r.gross === null || number(r.gross))
    )
      throw Error("Ungültige Planposition.");
    seen.add(r.sourceRow);
  }
  const costs = new Set<string>();
  for (const r of p.actuals) {
    if (
      !text(r.costCenter) ||
      !r.costCenter.trim() ||
      costs.has(r.costCenter) ||
      !(r.actual === null || number(r.actual)) ||
      !(r.sourceGross === null || number(r.sourceGross))
    )
      throw Error("Ungültiger Kostenstellenbestand.");
    costs.add(r.costCenter);
  }
}
export function stationKey(label: string): string {
  const value = label.normalize("NFKC").trim().toLocaleUpperCase("de");
  return /^T0*\d+$/.test(value) ? "T" + Number(value.slice(1)) : value;
}
