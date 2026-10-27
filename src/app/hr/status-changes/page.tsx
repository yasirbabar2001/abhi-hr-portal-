import Link from "next/link";
import type { Metadata } from "next";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { currentStep } from "@/lib/approvals";
import { masterName, userName } from "@/lib/lookup";
import { fmtDate } from "@/lib/format";
import { CHANGE_TYPES, FIELD_LABEL } from "@/lib/employees/status-change";
import { applyDueChanges, canDecide } from "@/lib/employees/workflow";
import type { StatusChange, StatusChangeType } from "@/lib/types";
import { Avatar, Badge, Card, EmptyState, Flash, LinkButton, PageHeader, Stat, StatusBadge, Tabs } from "@/components/ui";
import { AutoSelect } from "@/components/forms";

export const metadata: Metadata = { title: "Status changes" };

const TABS = [
  { key: "pending", label: "Awaiting approval" },
  { key: "approved", label: "Approved, not yet effective" },
  { key: "applied", label: "Applied" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
] as const;

export default async function StatusChangesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSection("/hr/status-changes");
  const appliedNow = applyDueChanges();
  const sp = await searchParams;
  const d = db();
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "pending";
  const type = sp.type && sp.type in CHANGE_TYPES ? (sp.type as StatusChangeType) : undefined;

  // Hiring managers see their department's requests and anything they raised.
  const visible = d.statusChanges.filter((s) => {
    if (user.role !== "hiring") return true;
    const emp = d.employees.find((e) => e.id === s.employeeId);
    return s.requestedBy === user.id || (!!user.departmentId && emp?.departmentId === user.departmentId);
  });
  const rows = visible
    .filter((s) => (tab === "all" || s.status === tab) && (!type || s.type === type))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const mine = visible.filter((s) => canDecide(d, user, s));
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const appliedThisYear = visible.filter((s) => s.status === "applied" && (s.appliedAt ?? "") >= yearStart);

  const summary = (s: StatusChange) => {
    const parts = Object.entries(s.to).map(([k, v]) => {
      const from = (s.from as Record<string, unknown>)[k];
      const fmt = (x: unknown) => (k === "basicSalary" ? `PKR ${Number(x ?? 0).toLocaleString()}` : masterName(d, x as string | undefined));
      return `${FIELD_LABEL[k as keyof typeof FIELD_LABEL]}: ${fmt(from)} → ${fmt(v)}`;
    });
    return parts.join(" · ") || CHANGE_TYPES[s.type].help;
  };

  return (
    <div>
      <PageHeader
        title="Status changes"
        subtitle="Confirmations, promotions, transfers, salary revisions and exits, approved before they change the employee master."
        actions={<LinkButton href="/hr/status-changes/new">+ Raise a change</LinkButton>}
      />
      <Flash msg={appliedNow ? `${appliedNow} approved change(s) reached their effective date and were applied.` : sp.msg} err={sp.err} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Waiting for you" value={mine.length} tone={mine.length ? "warn" : "default"} href="/hr/status-changes?tab=pending" />
        <Stat label="Awaiting approval" value={visible.filter((s) => s.status === "pending").length} />
        <Stat label="Approved, effective later" value={visible.filter((s) => s.status === "approved").length} />
        <Stat label="Applied this year" value={appliedThisYear.length} hint={`${appliedThisYear.filter((s) => s.type === "promotion").length} promotions`} />
      </div>

      <Tabs
        active={tab}
        tabs={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          href: `/hr/status-changes?tab=${t.key}${type ? `&type=${type}` : ""}`,
          count: t.key === "all" ? visible.length : visible.filter((s) => s.status === t.key).length,
        }))}
      />
      <form className="mb-4 flex max-w-xs" action="/hr/status-changes">
        <input type="hidden" name="tab" value={tab} />
        <AutoSelect name="type" defaultValue={type ?? ""} aria-label="Type of change">
          <option value="">All types</option>
          {Object.entries(CHANGE_TYPES).map(([k, m]) => (
            <option key={k} value={k}>
              {m.label}
            </option>
          ))}
        </AutoSelect>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Nothing here" body="No requests match this view." action={<LinkButton href="/hr/status-changes/new" variant="secondary">Raise a change</LinkButton>} />
      ) : (
        <Card pad={false}>
          <ul className="divide-y divide-line">
            {rows.map((s) => {
              const emp = d.employees.find((e) => e.id === s.employeeId);
              const step = currentStep(s.approvals);
              const actionable = canDecide(d, user, s);
              return (
                <li key={s.id}>
                  <Link href={`/hr/status-changes/${s.id}`} className="flex flex-col gap-2 px-4 py-3 hover:bg-paper sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={emp?.name ?? "?"} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {CHANGE_TYPES[s.type].icon} {CHANGE_TYPES[s.type].label} · {emp?.name ?? "Unknown employee"}
                          <span className="ml-2 font-mono text-xs text-muted">{s.code}</span>
                        </div>
                        <div className="truncate text-xs text-muted">{summary(s)}</div>
                        <div className="text-xs text-muted">
                          Effective {fmtDate(s.effectiveDate)} · raised by {userName(d, s.requestedBy)} on {fmtDate(s.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                      <StatusBadge status={s.status} />
                      {s.status === "pending" && step && <span className="text-xs text-muted">At: {step.label}</span>}
                      {actionable && <Badge tone="warn">Your action</Badge>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
