"use client";
import { useState } from "react";

type Opt = { id: string; label: string };
type Meta = { label: string; icon: string; fields: string[]; help: string };

/** Type picker that shows only the fields a given change needs, with the current value beside each. */
export function ChangeFields({
  types,
  initialType,
  options,
  current,
}: {
  types: Record<string, Meta>;
  initialType?: string;
  options: Record<string, Opt[]>;
  current: Record<string, { value?: string; label: string }>;
}) {
  const [type, setType] = useState(initialType && types[initialType] ? initialType : "");
  const meta = type ? types[type] : undefined;
  const fieldLabel: Record<string, string> = {
    departmentId: "New department",
    branchId: "New branch",
    designationId: "New designation",
    gradeId: "New grade",
    basicSalary: "New basic salary (PKR / month)",
  };
  return (
    <div className="space-y-4">
      <div>
        <span className="label">What is changing?</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(types).map(([k, m]) => (
            <label
              key={k}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${type === k ? "border-brand bg-brand-soft font-medium" : "border-line hover:border-brand/50"}`}
            >
              <input type="radio" name="type" value={k} checked={type === k} onChange={() => setType(k)} className="sr-only" required />
              <span aria-hidden>{m.icon}</span> {m.label}
            </label>
          ))}
        </div>
        {meta && <p className="hint">{meta.help}</p>}
      </div>
      {meta && meta.fields.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {meta.fields.map((f) => (
            <label key={f} className="block">
              <span className="label">{fieldLabel[f]}</span>
              {f === "basicSalary" ? (
                <input name={f} type="number" min={1} step={1} defaultValue={current[f]?.value} className="input" required={type === "salary_revision"} />
              ) : (
                <select name={f} defaultValue={current[f]?.value ?? ""} className="input">
                  <option value="">—</option>
                  {(options[f] ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
              <span className="hint block">Now: {current[f]?.label ?? "—"}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
