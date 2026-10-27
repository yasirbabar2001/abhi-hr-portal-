import type { Db, HeadcountBudget } from "../types";

export interface BudgetRow {
  budget: HeadcountBudget;
  filled: number;
  openReqs: number;
  available: number;
  variance: number; // approved - (filled + open); negative = over budget
  cost: number;
  actualCost: number;
}

/** Filled = active employees in the same department + designation (and branch when the line has one). */
export function budgetRow(d: Db, b: HeadcountBudget): BudgetRow {
  const filled = d.employees.filter(
    (e) => e.active && e.departmentId === b.departmentId && e.designationId === b.designationId && (!b.branchId || e.branchId === b.branchId),
  ).length;
  const openReqs = d.requisitions
    .filter((r) => r.budgetId === b.id && (r.status === "approved" || r.status === "pending"))
    .reduce((s, r) => s + Math.max(0, r.headcount - r.filled), 0);
  const variance = b.approvedHeadcount - filled - openReqs;
  return {
    budget: b,
    filled,
    openReqs,
    available: Math.max(0, variance),
    variance,
    cost: b.approvedHeadcount * b.annualCostPerHead,
    actualCost: (filled + openReqs) * b.annualCostPerHead,
  };
}

export function fiscalYears(d: Db): string[] {
  const set = new Set(d.budgets.map((b) => b.fiscalYear));
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  set.add(`${start}-${String(start + 1).slice(2)}`);
  set.add(`${start + 1}-${String(start + 2).slice(2)}`);
  return [...set].sort().reverse();
}

export function currentFiscalYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}
