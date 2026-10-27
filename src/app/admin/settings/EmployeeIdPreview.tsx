"use client";
import { useState } from "react";
import { renderEmployeeNo } from "@/lib/employee-id";

/** Prefix + pattern inputs with a live preview of the next three employee numbers. */
export function EmployeeIdPreview({ prefix, pattern, nextSeq }: { prefix: string; pattern: string; nextSeq: number }) {
  const [p, setP] = useState(prefix);
  const [pat, setPat] = useState(pattern);
  const [seq, setSeq] = useState(nextSeq);
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <label>
        <span className="label">Prefix</span>
        <input name="employeeIdPrefix" value={p} onChange={(e) => setP(e.target.value)} required maxLength={10} className="input" />
      </label>
      <label>
        <span className="label">Pattern</span>
        <input name="employeeIdPattern" value={pat} onChange={(e) => setPat(e.target.value)} required className="input font-mono" />
        <span className="hint block">Tokens: {"{PREFIX} {YYYY} {YY} {DEPT} {SEQ:4}"}</span>
      </label>
      <label>
        <span className="label">Next sequence number</span>
        <input name="nextEmployeeSeq" type="number" min={1} value={seq} onChange={(e) => setSeq(Number(e.target.value) || 1)} className="input" />
      </label>
      <div className="rounded-lg bg-brand-soft px-4 py-3 text-sm sm:col-span-3" aria-live="polite">
        Next IDs:{" "}
        {[0, 1, 2].map((i) => (
          <code key={i} className="mr-2 rounded bg-white px-2 py-0.5 font-semibold">{renderEmployeeNo(pat, p, seq + i, "IT")}</code>
        ))}
        <span className="text-xs text-muted">(example department code “IT”)</span>
      </div>
    </div>
  );
}
