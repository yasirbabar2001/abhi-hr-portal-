"use client";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/forms";
import type { SyncResult } from "@/lib/integrations/sync";
import { syncAction, testAction } from "./actions";

export function TestPanel({ disabled }: { disabled: boolean }) {
  const [res, action] = useActionState(testAction, null);
  return (
    <div>
      <form action={action}>
        <SubmitButton variant="secondary" className={disabled ? "pointer-events-none opacity-50" : ""}>
          Test connection
        </SubmitButton>
      </form>
      {res && (
        <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${res.ok ? "border-ok/30 bg-ok-bg text-ok" : "border-bad/30 bg-bad-bg text-bad"}`}>
          <div className="font-medium">{res.ok ? "✓ " : "✕ "}{res.message}</div>
          {res.ok && <div className="text-xs">HTTP {res.status} · {res.ms} ms</div>}
        </div>
      )}
      {res?.ok && res.sampleRaw !== undefined && (
        <div className="mt-3 grid gap-3">
          <div>
            <div className="mb-1 text-xs font-medium text-muted">First record as received</div>
            <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(res.sampleRaw, null, 2)}</pre>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted">After your field mapping</div>
            <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-200">{JSON.stringify(res.sampleMapped, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function SyncPanel({ disabled }: { disabled: boolean }) {
  const [res, action] = useActionState(syncAction, null as SyncResult | null);
  return (
    <div>
      <form action={action} className="flex flex-wrap items-center gap-3">
        <SubmitButton className={disabled ? "pointer-events-none opacity-50" : ""}>Sync now</SubmitButton>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="deactivateMissing" />
          Mark API employees missing from the feed as inactive
        </label>
      </form>
      {res && (
        <div className="mt-3 space-y-3">
          <div className={`rounded-lg border px-3 py-2 text-sm ${res.ok ? "border-ok/30 bg-ok-bg text-ok" : "border-bad/30 bg-bad-bg text-bad"}`}>
            {res.ok ? "✓ " : "✕ "}
            {res.message}
          </div>
          {res.ok && (
            <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-5">
              {[
                ["Fetched", res.fetched],
                ["New", res.created],
                ["Updated", res.updated],
                ["Unchanged", res.unchanged],
                ["Inactive", res.deactivated],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-line p-2">
                  <div className="text-lg font-semibold tabular-nums">{v}</div>
                  <div className="text-xs text-muted">{l}</div>
                </div>
              ))}
            </div>
          )}
          {res.createdMaster.length > 0 && (
            <div className="rounded-lg border border-warn/30 bg-warn-bg px-3 py-2 text-sm text-warn">
              New codes added to master data (please give them proper names in Master data): {res.createdMaster.join(", ")}
            </div>
          )}
          {res.errors.length > 0 && <RowErrors errors={res.errors} />}
        </div>
      )}
    </div>
  );
}

export function RowErrors({ errors }: { errors: SyncResult["errors"] }) {
  return (
    <details className="rounded-lg border border-line" open={errors.length <= 10}>
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Row problems ({errors.length})</summary>
      <table className="table">
        <thead>
          <tr>
            <th>Row</th>
            <th>Employee no.</th>
            <th>Problem</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((e, i) => (
            <tr key={i}>
              <td>{e.row}</td>
              <td>{e.employeeNo ?? "—"}</td>
              <td>{e.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function KeyReveal({ value, masked }: { value: string; masked: string }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded bg-paper px-2 py-1 text-sm">{show ? value : masked}</code>
      <button type="button" onClick={() => setShow((s) => !s)} className="text-sm text-brand hover:underline">
        {show ? "Hide" : "Reveal"}
      </button>
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true))}
        className="text-sm text-brand hover:underline"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
