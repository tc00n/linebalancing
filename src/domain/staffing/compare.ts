import { evaluateScenario } from "../calc/evaluate";
import { exceeds } from "../calc/tolerance";
import type { ScenarioInput } from "../model/types";
import {
  stationKey,
  validateStaffingPlan,
  type StaffingPlan,
  type StaffingRow,
} from "./model";
export interface StationStaffingComparison {
  stationId: string;
  label: string;
  plan: StaffingRow | null;
  ambiguous: boolean;
  productiveMinutes: number;
  workloadWithAllowance: number;
  workloadFte: number;
  employeeCount: number;
  height: number;
  over70: boolean;
  unassignedCount: number;
  deltaFte: number | null;
  plannedCapacity: number | null;
  capacityExceeded: boolean | null;
}
export interface CostCenterComparison {
  costCenter: string;
  plannedProductive: number;
  plannedGross: number | null;
  actual: number | null;
  grossGap: number | null;
  sourceGross: number | null;
  sourceMismatch: boolean;
  matchedStationCount: number;
  plannedStationCount: number;
  completeCoverage: boolean;
  coveredPlanFte: number;
  coveredWorkloadFte: number;
  coveredDeltaFte: number | null;
}
export function compareStaffing(input: ScenarioInput, plan: StaffingPlan) {
  validateStaffingPlan(plan);
  const result = evaluateScenario({ ...input, taktMin: plan.taktMin });
  const planByStation = new Map<string, StaffingRow[]>();
  for (const row of plan.rows) {
    if (row.support || !row.station) continue;
    const key = stationKey(row.station);
    planByStation.set(key, [...(planByStation.get(key) ?? []), row]);
  }
  const scenarioKeys = new Map<string, number>();
  for (const station of input.stations) {
    const key = stationKey(station.label);
    scenarioKeys.set(key, (scenarioKeys.get(key) ?? 0) + 1);
  }
  const matched = new Set<number>();
  const stations: StationStaffingComparison[] = result.stations.map(
    (station) => {
      const label = input.stations.find(
        (s) => s.id === station.stationId,
      )!.label;
      const candidates = planByStation.get(stationKey(label)) ?? [];
      const ambiguous =
        candidates.length > 1 || (scenarioKeys.get(stationKey(label)) ?? 0) > 1;
      const row = candidates.length === 1 && !ambiguous ? candidates[0] : null;
      if (row) matched.add(row.sourceRow);
      const own = result.employees.filter(
        (e) => e.stationId === station.stationId,
      );
      const productiveMinutes = own.reduce((n, e) => n + e.productive, 0);
      const workloadWithAllowance = own.reduce(
        (n, e) => n + e.productive + e.allowance,
        0,
      );
      const workloadFte = workloadWithAllowance / plan.taktMin;
      return {
        stationId: station.stationId,
        label,
        plan: row,
        ambiguous,
        productiveMinutes,
        workloadWithAllowance,
        workloadFte,
        employeeCount: station.employeeCount,
        height: station.height,
        over70: station.overTakt,
        unassignedCount: station.unassignedStepIds.length,
        deltaFte: row ? workloadFte - row.productive : null,
        plannedCapacity: row ? row.productive * plan.taktMin : null,
        capacityExceeded: row
          ? exceeds(workloadWithAllowance, row.productive * plan.taktMin)
          : null,
      };
    },
  );
  const costIds = new Set([
    ...plan.rows.flatMap((r) => (r.costCenter ? [r.costCenter] : [])),
    ...plan.actuals.map((r) => r.costCenter),
  ]);
  const costs: CostCenterComparison[] = [...costIds]
    .sort((a, b) => a.localeCompare(b, "de", { numeric: true }))
    .map((costCenter) => {
      const rows = plan.rows.filter((r) => r.costCenter === costCenter);
      const productiveRows = rows.filter((r) => !r.support);
      const own = stations.filter((s) => s.plan?.costCenter === costCenter);
      const stock = plan.actuals.find((a) => a.costCenter === costCenter);
      const plannedGross =
        rows.length && rows.every((r) => r.gross !== null)
          ? rows.reduce((n, r) => n + r.gross!, 0)
          : null;
      const coveredPlanFte = own.reduce((n, s) => n + s.plan!.productive, 0);
      const coveredWorkloadFte = own.reduce((n, s) => n + s.workloadFte, 0);
      return {
        costCenter,
        plannedProductive: productiveRows.reduce((n, r) => n + r.productive, 0),
        plannedGross,
        actual: stock?.actual ?? null,
        grossGap:
          plannedGross !== null &&
          stock?.actual !== null &&
          stock?.actual !== undefined
            ? plannedGross - stock.actual
            : null,
        sourceGross: stock?.sourceGross ?? null,
        sourceMismatch:
          plannedGross !== null &&
          stock?.sourceGross !== null &&
          stock?.sourceGross !== undefined &&
          Math.abs(plannedGross - stock.sourceGross) > 1e-8,
        matchedStationCount: own.length,
        plannedStationCount: productiveRows.length,
        completeCoverage:
          productiveRows.length > 0 &&
          productiveRows.every((r) => matched.has(r.sourceRow)),
        coveredPlanFte,
        coveredWorkloadFte,
        coveredDeltaFte: own.length
          ? coveredWorkloadFte - coveredPlanFte
          : null,
      };
    });
  return {
    stations,
    costs,
    incomplete: result.kpis.incomplete,
    unmatchedPlan: plan.rows.filter(
      (r) => !r.support && !matched.has(r.sourceRow),
    ),
    support: plan.rows.filter((r) => r.support),
    matchedCount: matched.size,
    totalPlanRows: plan.rows.filter((r) => !r.support).length,
  };
}
