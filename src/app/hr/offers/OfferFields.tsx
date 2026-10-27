"use client";
import { useState } from "react";
import { pkr } from "@/lib/format";

interface Props {
  basic: number;
  allowances: { name: string; amount: number }[];
  range?: { min: number; max: number };
}

/** Salary editor with live gross total and a warning when outside the requisition range. */
export function OfferFields({ basic: basic0, allowances: allow0, range }: Props) {
  const [basic, setBasic] = useState(basic0);
  const [rows, setRows] = useState(allow0.length ? allow0 : [{ name: "", amount: 0 }]);
  const gross = basic + rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const out = range && (gross < range.min || gross > range.max);
  const update = (i: number, patch: Partial<{ name: string; amount: number }>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-3">
      <label className="block max-w-xs">
        <span className="label">Basic salary (PKR / month) *</span>
        <input
          name="basicSalary"
          type="number"
          min={0}
          step={500}
          required
          value={basic || ""}
          onChange={(e) => setBasic(Number(e.target.value))}
          className="input"
        />
      </label>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="label">Monthly allowances</span>
          <button
            type="button"
            className="text-xs font-medium text-brand hover:underline"
            onClick={() =>
              setRows([
                { name: "House rent", amount: Math.round(basic * 0.45) },
                { name: "Utilities", amount: Math.round(basic * 0.1) },
                ...rows.filter((r) => r.name && !["House rent", "Utilities"].includes(r.name)),
              ])
            }
          >
            Recalculate standard allowances
          </button>
        </div>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2">
              <input name="allowanceName" value={r.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="e.g. Fuel" className="input" aria-label="Allowance name" />
              <input
                name="allowanceAmount"
                type="number"
                min={0}
                value={r.amount || ""}
                onChange={(e) => update(i, { amount: Number(e.target.value) })}
                className="input max-w-36"
                aria-label="Amount"
              />
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="px-2 text-muted hover:text-bad" aria-label="Remove allowance">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setRows([...rows, { name: "", amount: 0 }])} className="mt-2 text-xs font-medium text-brand hover:underline">
          + Add allowance
        </button>
      </div>
      <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${out ? "bg-warn-bg" : "bg-brand-soft"}`}>
        <span className="text-sm font-medium">Gross monthly</span>
        <span className="text-lg font-semibold tabular-nums">{pkr(gross)}</span>
      </div>
      {range && (
        <p className={`text-xs ${out ? "text-warn" : "text-muted"}`}>
          {out ? "⚠ Outside the approved requisition range " : "Approved requisition range "}
          {pkr(range.min)} – {pkr(range.max)} (gross per month).{out && " This will be flagged to approvers."}
        </p>
      )}
    </div>
  );
}
