import type { Offer } from "../types";

export const DEFAULT_ALLOWANCES = (basic: number) => [
  { name: "House rent", amount: Math.round(basic * 0.45) },
  { name: "Utilities", amount: Math.round(basic * 0.1) },
];

export const DEFAULT_BENEFITS = [
  "Provident fund",
  "Gratuity",
  "Health insurance (self, spouse, children)",
  "Annual bonus as per policy",
];

export function gross(basic: number, allowances: { amount: number }[]) {
  return basic + allowances.reduce((s, a) => s + (Number(a.amount) || 0), 0);
}

/** Read allowance rows posted as allowanceName[] / allowanceAmount[] */
export function readAllowances(form: FormData): Offer["allowances"] {
  const names = form.getAll("allowanceName").map(String);
  const amounts = form.getAll("allowanceAmount").map((v) => Number(v));
  return names
    .map((name, i) => ({ name: name.trim(), amount: Math.max(0, Math.round(amounts[i] ?? 0)) }))
    .filter((a) => a.name && a.amount > 0);
}
