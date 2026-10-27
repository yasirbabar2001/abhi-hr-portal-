import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterList, masterName, userName } from "@/lib/lookup";
import { fmtDate, humanize } from "@/lib/format";
import { currentStep } from "@/lib/approvals";
import type { RequisitionStatus } from "@/lib/types";
import { Badge, Card, EmptyState, Flash, LinkButton, PageHeader, StatusBadge, Tabs } from "@/components/ui";
import { AutoSelect } from "@/components/forms";

export const metadata = { title: "Requisitions" };

const TABS: { key: string; label: string; match: RequisitionStatus[] }[] = [
  { key: "all", label: "All", match: [] },
  { key: "pending", label: "Awaiting approval", match: ["pending"] },
  { key: "approved", label: "Approved", match: ["approved"] },
  { key: "draft", label: "Drafts", match: ["draft"] },
  { key: "closed", label: "Closed", match: ["filled", "cancelled", "rejected", "on_hold"] },
];
const PRIORITY_TONE = { low: "neutral", normal: "info", high: "warn", urgent: "bad" } as const;

export default async function RequisitionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/requisitions");
  const sp = await searchParams;
  const d = db();
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0]!;
  const q = (sp.q ?? "").toLowerCase();
  const base = d.requisitions.filter(
    (r) =>
      (!sp.dept || r.departmentId === sp.dept) &&
      (!sp.branch || r.branchId === sp.branch) &&
      (!q || `${r.code} ${r.title}`.toLowerCase().includes(q)),
  );
  const list = base.filter((r) => !tab.match.length || tab.match.includes(r.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const qs = (k: string) => `/hr/requisitions?tab=${k}${sp.dept ? `&dept=${sp.dept}` : ""}${sp.branch ? `&branch=${sp.branch}` : ""}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`;
  return (
    <div>
      <PageHeader
        title="Requisitions"
        subtitle="Requests to hire, with budget check and an approval chain."
        actions={<LinkButton href="/hr/requisitions/new">+ New requisition</LinkButton>}
      />
      <Flash msg={sp.msg} err={sp.err} />
      <Tabs active={tab.key} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: qs(t.key), count: base.filter((r) => !t.match.length || t.match.includes(r.status)).length }))} />
      <form className="mb-4 flex flex-wrap gap-3" action="/hr/requisitions">
        <input type="hidden" name="tab" value={tab.key} />
        <input name="q" defaultValue={sp.q} placeholder="Search code or title" className="input max-w-xs" />
        <AutoSelect name="dept" defaultValue={sp.dept ?? ""} className="max-w-xs">
          <option value="">All departments</option>
          {masterList(d, "department").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </AutoSelect>
        <AutoSelect name="branch" defaultValue={sp.branch ?? ""} className="max-w-xs">
          <option value="">All branches</option>
          {masterList(d, "branch").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </AutoSelect>
      </form>
      {list.length === 0 ? (
        <EmptyState title="No requisitions here" body="Raise a requisition to start hiring for an approved position." action={<LinkButton href="/hr/requisitions/new">New requisition</LinkButton>} />
      ) : (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Requisition</th><th>Department / branch</th><th>Heads</th><th>Priority</th><th>Status</th><th>Next step</th><th>Target start</th></tr></thead>
              <tbody>
                {list.map((r) => {
                  const step = r.status === "pending" ? currentStep(r.approvals) : undefined;
                  const apps = d.applications.filter((a) => d.postings.some((p) => p.id === a.postingId && p.requisitionId === r.id)).length;
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/hr/requisitions/${r.id}`} className="font-medium text-brand hover:underline">{r.title}</Link>
                        <div className="text-xs text-muted">{r.code} · {humanize(r.kind)} · {apps} applicants · HM {userName(d, r.hiringManagerId)}</div>
                      </td>
                      <td className="text-sm">{masterName(d, r.departmentId)}<div className="text-xs text-muted">{masterName(d, r.branchId)}</div></td>
                      <td className="tabular-nums">{r.filled}/{r.headcount}</td>
                      <td><Badge tone={PRIORITY_TONE[r.priority]}>{humanize(r.priority)}</Badge></td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="text-xs text-muted">{step ? `Waiting: ${step.label}` : "—"}</td>
                      <td className="text-sm">{fmtDate(r.targetStartDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
