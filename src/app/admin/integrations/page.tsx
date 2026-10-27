import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/store";
import { fmtDateTime, relative } from "@/lib/format";
import { fieldMapToText, MAPPABLE_FIELDS, maskSecret } from "@/lib/integrations/employee-api";
import type { SyncResult } from "@/lib/integrations/sync";
import { Badge, Card, Field, Flash, PageHeader, Stat } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { applyDemoEndpoint, rotateKey, saveApiSettings } from "./actions";
import { KeyReveal, RowErrors, SyncPanel, TestPanel } from "./panels";

export const metadata: Metadata = { title: "Employee API" };

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const d = db();
  const api = d.settings.employeeApi;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3100";
  const base = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  const history = d.audit.filter((a) => a.action === "employee.sync").slice(-10).reverse();
  const fromApi = d.employees.filter((e) => e.source === "api");
  const configured = !!api.url;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee data API"
        subtitle="Connect the bank's core HR system so the employee master stays up to date, and let other bank systems read employee data from this portal."
      />
      <Flash msg={sp.msg} err={sp.err} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Connection" value={configured ? "Configured" : "Not set"} tone={configured ? "ok" : "warn"} hint={configured ? new URL(api.url).host : "Add the API address below"} />
        <Stat label="Last sync" value={api.lastSyncAt ? relative(api.lastSyncAt) : "Never"} hint={fmtDateTime(api.lastSyncAt)} />
        <Stat label="Employees from API" value={fromApi.length} hint={`${fromApi.filter((e) => e.active).length} active`} />
        <Stat label="Automatic sync" value={api.autoSyncHours ? `Every ${api.autoSyncHours} h` : "Manual"} hint="Runs when the employee list is opened" />
      </div>
      {api.lastSyncStatus && <p className="text-sm text-muted">Last result: {api.lastSyncStatus}</p>}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="1. Connection" className="lg:col-span-3">
          <form action={saveApiSettings} className="space-y-4">
            <Field label="API address (URL)" hint="The endpoint that returns the list of employees as JSON.">
              <input name="url" defaultValue={api.url} className="input" placeholder="https://hris.abhi.internal/api/employees" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Authentication header" hint="Usually Authorization or x-api-key">
                <input name="authHeader" defaultValue={api.authHeader} className="input" />
              </Field>
              <Field label="Header value" hint={api.authValue ? `Saved: ${maskSecret(api.authValue)}. Leave empty to keep it.` : "e.g. Bearer <token>"}>
                <input name="authValue" type="password" autoComplete="off" className="input" placeholder={api.authValue ? "•••••• (unchanged)" : ""} />
              </Field>
            </div>
            {api.authValue && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="clearAuth" /> Remove the saved header value
              </label>
            )}
            <Field
              label="2. Field mapping"
              hint={`One per line: ourField = source_field. Dotted paths work (org.department.code). Fields: ${MAPPABLE_FIELDS.join(", ")}.`}
            >
              <textarea name="fieldMap" rows={11} defaultValue={fieldMapToText(api.fieldMap)} className="input font-mono text-xs" />
            </Field>
            <Field label="Automatic sync every (hours)" hint="0 = manual only. Department, branch, designation and grade are matched to master data by code.">
              <input name="autoSyncHours" type="number" min={0} max={168} defaultValue={api.autoSyncHours} className="input w-32" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <SubmitButton>Save settings</SubmitButton>
            </div>
          </form>
          <form action={applyDemoEndpoint} className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-sm text-muted">No HR system to connect yet? Try it with the built-in demo HRIS (42 sample employees, 3 pages).</p>
            <SubmitButton variant="secondary">Use demo HRIS endpoint</SubmitButton>
          </form>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card title="3. Test">
            <p className="mb-3 text-sm text-muted">Reads the first page with the saved settings and shows the first record before and after mapping. Nothing is changed.</p>
            <TestPanel disabled={!configured} />
          </Card>
          <Card title="4. Sync">
            <p className="mb-3 text-sm text-muted">
              Employees are matched by employee number: new numbers are added, existing ones updated. Records added by hand or by onboarding are never removed.
            </p>
            <SyncPanel disabled={!configured} />
          </Card>
        </div>
      </div>

      <Card title="Sync history" pad={false}>
        {history.length === 0 ? (
          <p className="p-4 text-sm text-muted">No sync has run yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>By</th>
                  <th>Result</th>
                  <th className="text-right">New</th>
                  <th className="text-right">Updated</th>
                  <th className="text-right">Problems</th>
                </tr>
              </thead>
              <tbody>
                {history.map((a) => {
                  const r = a.after as Partial<SyncResult> | undefined;
                  return (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap">{fmtDateTime(a.at)}</td>
                      <td>{a.actorName}</td>
                      <td>
                        <Badge tone={r?.ok ? "ok" : "bad"}>{r?.ok ? "Completed" : "Failed"}</Badge>
                        <div className="mt-1 text-xs text-muted">{a.summary}</div>
                        {r?.errors && r.errors.length > 0 && (
                          <div className="mt-2">
                            <RowErrors errors={r.errors} />
                          </div>
                        )}
                      </td>
                      <td className="text-right tabular-nums">{r?.created ?? 0}</td>
                      <td className="text-right tabular-nums">{r?.updated ?? 0}</td>
                      <td className="text-right tabular-nums">{r?.errors?.length ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Portal API for other bank systems">
        <div className="space-y-4 text-sm">
          <p className="text-muted">
            Payroll, core banking or the data warehouse can read employees and new hires from this portal. Every call must send the API key in the{" "}
            <code>x-api-key</code> header. Keep the key secret; rotate it if it may have leaked.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <KeyReveal value={api.outboundApiKey} masked={maskSecret(api.outboundApiKey)} />
            <form action={rotateKey}>
              <SubmitButton variant="danger" size="sm" confirm="Create a new key? The current key stops working immediately.">
                Rotate key
              </SubmitButton>
            </form>
          </div>
          <div className="space-y-2">
            {[
              ["All active employees (paged, 100 per page)", `/api/v1/employees?active=true&page=1&page_size=100`],
              ["Filter by status, department code and change date", `/api/v1/employees?status=probation&department=IT&updated_since=2026-01-01`],
              ["One employee", `/api/v1/employees/ABHI-2026-1001`],
              ["New hires with generated employee numbers", `/api/v1/new-hires`],
            ].map(([label, path]) => (
              <div key={path}>
                <div className="text-xs font-medium text-muted">{label}</div>
                <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{`curl -H "x-api-key: <your key>" "${base}${path}"`}</pre>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
