import Link from "next/link";
import type { Metadata } from "next";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterList, masterName } from "@/lib/lookup";
import { fmtDate, humanize, pkr, todayInput } from "@/lib/format";
import { CHANGE_TYPES } from "@/lib/employees/status-change";
import { Avatar, Card, EmptyState, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { createStatusChange } from "../actions";
import { ChangeFields } from "./ChangeFields";

export const metadata: Metadata = { title: "Raise a status change" };

export default async function NewStatusChangePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSection("/hr/status-changes");
  const sp = await searchParams;
  const d = db();
  const pool = d.employees
    .filter((e) => e.active && (user.role !== "hiring" || (!!user.departmentId && e.departmentId === user.departmentId)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const emp = sp.employee ? pool.find((e) => e.id === sp.employee) : undefined;
  const q = sp.q?.toLowerCase().trim();
  const matches = q ? pool.filter((e) => e.name.toLowerCase().includes(q) || e.employeeNo.toLowerCase().includes(q)).slice(0, 20) : [];

  return (
    <div className="max-w-3xl">
      <PageHeader title="Raise a status change" subtitle={`Goes through: ${d.settings.statusChangeApprovalChain.join(" → ")}`} back={{ href: "/hr/status-changes", label: "Status changes" }} />
      <Flash err={sp.err} />

      {!emp ? (
        <Card title="1. Choose the employee">
          <form className="flex gap-2" action="/hr/status-changes/new">
            <input name="q" defaultValue={sp.q} placeholder="Name or employee number" className="input" autoFocus />
            <button className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white">Find</button>
          </form>
          {user.role === "hiring" && <p className="hint">You can raise changes for employees in your department.</p>}
          {q && matches.length === 0 && <div className="mt-4"><EmptyState title="No active employee found" /></div>}
          {matches.length > 0 && (
            <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
              {matches.map((e) => (
                <li key={e.id}>
                  <Link href={`/hr/status-changes/new?employee=${e.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-paper">
                    <Avatar name={e.name} size={28} />
                    <span className="flex-1 text-sm">
                      <span className="font-medium">{e.name}</span> <span className="font-mono text-xs text-muted">{e.employeeNo}</span>
                      <span className="block text-xs text-muted">{masterName(d, e.designationId)} · {masterName(d, e.departmentId)}</span>
                    </span>
                    <span className="text-sm text-brand">Select →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <form action={createStatusChange} className="space-y-6">
          <input type="hidden" name="employeeId" value={emp.id} />
          <Card title="Employee" actions={<Link href="/hr/status-changes/new" className="text-brand">Change</Link>}>
            <div className="flex items-center gap-3">
              <Avatar name={emp.name} size={44} />
              <div className="text-sm">
                <div className="font-medium">{emp.name} <span className="font-mono text-xs text-muted">{emp.employeeNo}</span></div>
                <div className="text-muted">
                  {masterName(d, emp.designationId)} · {d.master.find((m) => m.id === emp.gradeId)?.code ?? "—"} · {masterName(d, emp.departmentId)} · {masterName(d, emp.branchId)}
                </div>
                <div className="text-xs text-muted">{humanize(emp.employmentStatus)} · joined {fmtDate(emp.joiningDate)}</div>
              </div>
            </div>
          </Card>
          <Card title="2. The change">
            <ChangeFields
              types={Object.fromEntries(Object.entries(CHANGE_TYPES).map(([k, m]) => [k, { label: m.label, icon: m.icon, fields: m.fields, help: m.help }]))}
              initialType={sp.type}
              options={{
                departmentId: masterList(d, "department").map((m) => ({ id: m.id, label: m.name })),
                branchId: masterList(d, "branch").map((m) => ({ id: m.id, label: m.name })),
                designationId: masterList(d, "designation").map((m) => ({ id: m.id, label: m.name })),
                gradeId: masterList(d, "grade").map((m) => ({ id: m.id, label: `${m.code} · ${m.name}` })),
              }}
              current={{
                departmentId: { value: emp.departmentId, label: masterName(d, emp.departmentId) },
                branchId: { value: emp.branchId, label: masterName(d, emp.branchId) },
                designationId: { value: emp.designationId, label: masterName(d, emp.designationId) },
                gradeId: { value: emp.gradeId, label: masterName(d, emp.gradeId) },
                basicSalary: {
                  value: emp.basicSalary !== undefined ? String(emp.basicSalary) : undefined,
                  label: user.role === "hiring" ? "visible to HR" : pkr(emp.basicSalary),
                },
              }}
            />
          </Card>
          <Card title="3. When and why">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Effective date" hint="For exits, the last working day. Changes apply on this date once approved.">
                <input name="effectiveDate" type="date" required defaultValue={todayInput(1)} className="input" />
              </Field>
              <Field label="Supporting document (optional)" hint="Resignation letter, appraisal, approval memo… up to 50 MB">
                <input name="attachment" type="file" className="input" />
              </Field>
              <Field label="Reason" className="sm:col-span-2">
                <textarea name="reason" required minLength={5} className="input" placeholder="e.g. Exceeded targets in the 2026 appraisal cycle" />
              </Field>
            </div>
          </Card>
          <SubmitButton>Submit for approval</SubmitButton>
        </form>
      )}
    </div>
  );
}
