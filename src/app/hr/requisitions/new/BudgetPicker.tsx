"use client";
import { useState } from "react";

export interface BudgetOption {
  id: string;
  label: string;
  available: number;
  departmentId: string;
  designationId: string;
}

/** Budget line + headcount fields with a live warning when the request exceeds what is available. */
export function BudgetPicker({ options, defaultBudget, defaultHeadcount }: { options: BudgetOption[]; defaultBudget?: string; defaultHeadcount: number }) {
  const [budget, setBudget] = useState(defaultBudget ?? "");
  const [heads, setHeads] = useState(defaultHeadcount);
  const sel = options.find((o) => o.id === budget);
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="block sm:col-span-2">
        <span className="label">Headcount budget line</span>
        <select name="budgetId" className="input" value={budget} onChange={(e) => setBudget(e.target.value)}>
          <option value="">Not linked to a budget line (needs Finance justification)</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} — {o.available} available
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Number of positions *</span>
        <input type="number" name="headcount" min={1} className="input" value={heads} onChange={(e) => setHeads(Number(e.target.value))} required />
      </label>
      {sel && heads > sel.available && (
        <p className="rounded-lg border border-bad/30 bg-bad-bg px-3 py-2 text-sm text-bad sm:col-span-3" role="alert">
          ⚠ This request ({heads}) exceeds the {sel.available} position(s) still available on this budget line. Finance will see it as over budget.
        </p>
      )}
      {sel && heads <= sel.available && (
        <p className="rounded-lg border border-ok/30 bg-ok-bg px-3 py-2 text-sm text-ok sm:col-span-3">✓ Within budget: {sel.available - heads} position(s) will remain.</p>
      )}
      {!budget && <p className="hint sm:col-span-3">Tip: linking a budget line lets approvers see the request is already funded.</p>}
    </div>
  );
}
