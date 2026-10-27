import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName, userName } from "@/lib/lookup";
import { daysBetween, fmtDate, fmtDateTime, humanize, pkr } from "@/lib/format";
import { CHANGE_TYPES } from "@/lib/employees/status-change";
import { Avatar, Badge, Card, EmptyState, Flash, KeyValue, LinkButton, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { addNote } from "../actions";

export const metadata: Metadata = { title: "Employee" };

function tenure(joining: string, until?: string) {
  const days = daysBetween(joining, until ?? new Date());
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  return y > 0 ? `${y} yr ${m} mo` : `${m} mo`;
}

export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireSection("/hr/employees");
  const { id } = await params;
  const sp = await searchParams;
  const d = db();
  const e = d.employees.find((x) => x.id === id);
  if (!e) notFound();

  const isHr = user.role === "admin" || user.role === "hr";
  const canEdit = user.role === "admin" || (user.role === "hr" && e.source !== "api");
  const canRaise = isHr || (user.role === "hiring" && !!user.departmentId && user.departmentId === e.departmentId);
  const manager = e.managerEmployeeId ? d.employees.find((x) => x.id === e.managerEmployeeId) : undefined;
  const reports = d.employees.filter((x) => x.managerEmployeeId === e.id && x.active);
  const changes = d.statusChanges.filter((s) => s.employeeId === e.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const hire = e.hireId ? d.hires.find((h) => h.id === e.hireId) : d.hires.find((h) => h.employeeRecordId === e.id);
  const activity = d.audit.filter((a) => a.entity === "employee" && a.entityId === e.id).slice(-30).reverse();
  const notes = activity.filter((a) => a.action === "employee.note");
  const history = activity.filter((a) => a.action !== "employee.note");
  const mask = (v?: string) => (!v ? "—" : isHr ? v : v.replace(/\d(?=[\d-]{4})/g, "•"));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/hr/employees" className="text-sm text-muted hover:text-brand">
          ← Employee master
        </Link>
        <div className="flex flex-wrap gap-2">
          {canRaise && e.active && <LinkButton href={`/hr/status-changes/new?employee=${e.id}`} variant="secondary">🔁 Raise status change</LinkButton>}
          {canEdit && <LinkButton href={`/hr/employees/${e.id}/edit`}>Edit</LinkButton>}
        </div>
      </div>
      <Flash msg={sp.msg} err={sp.err} />

      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm sm:flex-row sm:items-center">
        <Avatar name={e.name} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">{e.name}</h1>
          <div className="mt-0.5 text-sm text-muted">
            {masterName(d, e.designationId)} · {masterName(d, e.departmentId)} · {masterName(d, e.branchId)}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="neutral">
              <span className="font-mono">{e.employeeNo}</span>
            </Badge>
            <StatusBadge status={e.employmentStatus} />
            {!e.active && <Badge tone="bad">Left {fmtDate(e.exitDate)}</Badge>}
            <Badge tone={e.source === "api" ? "info" : "brand"}>{e.source === "api" ? "Core HR system" : e.source === "portal" ? "Hired through portal" : "Added manually"}</Badge>
          </div>
        </div>
        <div className="text-sm sm:text-right">
          <div className="text-muted">Service</div>
          <div className="text-lg font-semibold">{tenure(e.joiningDate, e.active ? undefined : e.exitDate)}</div>
          <div className="text-xs text-muted">since {fmtDate(e.joiningDate)}</div>
        </div>
      </div>

      {e.source === "api" && (
        <div className="mb-4 rounded-lg border border-info/20 bg-info-bg px-4 py-2.5 text-sm text-info">
          ℹ This record is managed by the core HR system and refreshed by the employee API (last sync {fmtDateTime(e.lastSyncedAt)}).
          {user.role === "admin" ? " Administrators can still edit it here." : " Ask HRIS to change it there, or add a note below."}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Job">
            <KeyValue
              items={[
                ["Department", masterName(d, e.departmentId)],
                ["Designation", masterName(d, e.designationId)],
                ["Grade", d.master.find((m) => m.id === e.gradeId) ? `${d.master.find((m) => m.id === e.gradeId)!.code} · ${masterName(d, e.gradeId)}` : "—"],
                ["Branch / office", masterName(d, e.branchId)],
                ["Employment type", masterName(d, e.employmentTypeId)],
                ["Employment status", humanize(e.employmentStatus)],
                ["Joining date", fmtDate(e.joiningDate)],
                ["Basic salary", isHr ? pkr(e.basicSalary) : "Visible to HR only"],
              ]}
            />
          </Card>

          <Card title="Status change history" actions={canRaise && e.active ? <Link href={`/hr/status-changes/new?employee=${e.id}`} className="text-brand">+ New</Link> : undefined} pad={false}>
            {changes.length === 0 ? (
              <p className="p-4 text-sm text-muted">No promotions, transfers or other changes recorded in the portal yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {changes.map((s) => (
                  <li key={s.id}>
                    <Link href={`/hr/status-changes/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
                      <span aria-hidden className="text-xl">{CHANGE_TYPES[s.type].icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{CHANGE_TYPES[s.type].label}</span>
                        <span className="block truncate text-xs text-muted">
                          {s.code} · effective {fmtDate(s.effectiveDate)} · {s.reason}
                        </span>
                      </span>
                      <StatusBadge status={s.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Notes">
            {isHr && (
              <form action={addNote.bind(null, e.id)} className="mb-4 space-y-2">
                <textarea name="note" required className="input" placeholder="Add a note for HR (visible to HR and administrators)…" />
                <SubmitButton size="sm">Add note</SubmitButton>
              </form>
            )}
            {notes.length === 0 ? (
              <p className="text-sm text-muted">No notes yet.</p>
            ) : (
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-paper px-3 py-2 text-sm">
                    <div className="whitespace-pre-wrap">{n.summary}</div>
                    <div className="mt-1 text-xs text-muted">
                      {n.actorName} · {fmtDateTime(n.at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Contact & identity">
            <KeyValue
              items={[
                ["Email", e.email ? <a href={`mailto:${e.email}`} className="break-all text-brand">{e.email}</a> : "—"],
                ["Mobile", e.phone ?? "—"],
                ["CNIC", mask(e.cnic)],
                ["Gender", e.gender ? humanize(e.gender) : "—"],
                ["Date of birth", isHr ? fmtDate(e.dateOfBirth) : "—"],
              ]}
            />
          </Card>
          <Card title="Reporting line">
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted">Reports to</div>
                {manager ? (
                  <Link href={`/hr/employees/${manager.id}`} className="mt-1 flex items-center gap-2 hover:text-brand">
                    <Avatar name={manager.name} size={26} /> {manager.name}
                  </Link>
                ) : (
                  <div>—</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted">Direct reports ({reports.length})</div>
                {reports.length === 0 ? (
                  <div>—</div>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {reports.map((r) => (
                      <li key={r.id}>
                        <Link href={`/hr/employees/${r.id}`} className="flex items-center gap-2 hover:text-brand">
                          <Avatar name={r.name} size={22} /> {r.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
          {hire && (
            <Card title="Onboarding">
              <p className="text-sm text-muted">Hired through the portal; orientation completed {fmtDate(hire.orientationCompletedAt)}.</p>
              <div className="mt-2 flex items-center justify-between">
                <StatusBadge status={hire.status} />
                <Link href={`/hr/onboarding/${hire.id}`} className="text-sm text-brand">Open journey →</Link>
              </div>
            </Card>
          )}
          <Card title="Record history" pad={false}>
            {history.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No changes logged" body="Edits, syncs and status changes made in the portal appear here." />
              </div>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {history.map((a) => (
                  <li key={a.id} className="px-4 py-2.5">
                    <div>{a.summary}</div>
                    <div className="text-xs text-muted">
                      {a.actorName} · {fmtDateTime(a.at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {e.source === "api" && <p className="border-t border-line px-4 py-2 text-xs text-muted">Created {fmtDate(e.createdAt)} · by {userName(d, undefined, "core HR sync")}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
