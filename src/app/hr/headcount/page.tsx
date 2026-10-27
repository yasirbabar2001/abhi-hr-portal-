import Link from "next/link";
import clsx from "clsx";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterList, masterName } from "@/lib/lookup";
import { pkr, pkrShort } from "@/lib/format";
import { budgetRow, currentFiscalYear, fiscalYears } from "@/lib/planning/headcount";
import { Badge, Card, EmptyState, Flash, LinkButton, PageHeader, Progress, Stat } from "@/components/ui";
import { AutoSelect, SubmitButton } from "@/components/forms";
import { BarList } from "@/components/charts";
import { deleteBudget, saveBudget } from "./actions";

export const metadata = { title: "Headcount budget" };

export default async function HeadcountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/headcount");
  const sp = await searchParams;
  const d = db();
  const fy = sp.fy ?? currentFiscalYear();
  const dept = sp.dept ?? "";
  const rows = d.budgets
    .filter((b) => b.fiscalYear === fy && (!dept || b.departmentId === dept))
    .map((b) => budgetRow(d, b))
    .sort((a, b) => masterName(d, a.budget.departmentId).localeCompare(masterName(d, b.budget.departmentId)));
  const editing = sp.edit ? d.budgets.find((b) => b.id === sp.edit) : undefined;
  const tot = rows.reduce(
    (s, r) => ({ approved: s.approved + r.budget.approvedHeadcount, filled: s.filled + r.filled, open: s.open + r.openReqs, cost: s.cost + r.cost, committed: s.committed + r.actualCost }),
    { approved: 0, filled: 0, open: 0, cost: 0, committed: 0 },
  );
  const over = rows.filter((r) => r.variance < 0).length;
  const byDept = new Map<string, { approved: number; filled: number }>();
  for (const r of rows) {
    const k = masterName(d, r.budget.departmentId);
    const v = byDept.get(k) ?? { approved: 0, filled: 0 };
    byDept.set(k, { approved: v.approved + r.budget.approvedHeadcount, filled: v.filled + r.filled });
  }
  const departments = masterList(d, "department");
  return (
    <div>
      <PageHeader
        title="Headcount budget"
        subtitle="Approved positions per fiscal year, compared with people in post and open requisitions."
        actions={
          <>
            <LinkButton href={`/hr/headcount/export?fy=${fy}`} variant="secondary">⬇ Export CSV</LinkButton>
            <LinkButton href={`/hr/headcount?fy=${fy}#line-form`}>+ Add budget line</LinkButton>
          </>
        }
      />
      <Flash msg={sp.msg} err={sp.err} />
      <form className="mb-4 flex flex-wrap gap-3" action="/hr/headcount">
        <label className="w-40"><span className="label">Fiscal year</span>
          <AutoSelect name="fy" defaultValue={fy}>{fiscalYears(d).map((y) => <option key={y}>{y}</option>)}</AutoSelect>
        </label>
        <label className="w-64"><span className="label">Department</span>
          <AutoSelect name="dept" defaultValue={dept}>
            <option value="">All departments</option>
            {departments.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </AutoSelect>
        </label>
      </form>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Approved headcount" value={tot.approved} />
        <Stat label="In post" value={tot.filled} hint={`${tot.approved ? Math.round((tot.filled / tot.approved) * 100) : 0}% filled`} tone="brand" />
        <Stat label="Open requisitions" value={tot.open} />
        <Stat label="Available to hire" value={Math.max(0, tot.approved - tot.filled - tot.open)} tone="ok" />
        <Stat label="Lines over budget" value={over} tone={over ? "bad" : "ok"} hint={`Budget ${pkrShort(tot.cost)} · committed ${pkrShort(tot.committed)}`} />
      </div>
      <div className="space-y-6">
        <div>
          {rows.length === 0 ? (
            <EmptyState title={`No budget lines for FY ${fy}`} body="Add the positions approved in the business plan to track hiring against budget." />
          ) : (
            <Card pad={false} title={`Budget lines · FY ${fy}`}>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr><th>Position</th><th className="text-right">Approved</th><th className="text-right">In post</th><th className="text-right">Open reqs</th><th className="text-right">Variance</th><th>Utilisation</th><th className="text-right">Budget cost</th><th /></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const used = r.budget.approvedHeadcount ? ((r.filled + r.openReqs) / r.budget.approvedHeadcount) * 100 : 100;
                      return (
                        <tr key={r.budget.id} className={clsx(r.variance < 0 && "bg-bad-bg/40")}>
                          <td className="min-w-56">
                            <div className="font-medium">{masterName(d, r.budget.designationId)}</div>
                            <div className="text-xs text-muted">{masterName(d, r.budget.departmentId)} · {masterName(d, r.budget.gradeId)} · {masterName(d, r.budget.branchId, "All branches")}</div>
                            {r.budget.notes && <div className="text-xs text-muted italic">{r.budget.notes}</div>}
                          </td>
                          <td className="text-right tabular-nums">{r.budget.approvedHeadcount}</td>
                          <td className="text-right tabular-nums">{r.filled}</td>
                          <td className="text-right tabular-nums">{r.openReqs}</td>
                          <td className="text-right tabular-nums">
                            {r.variance < 0 ? <Badge tone="bad">{r.variance} over</Badge> : r.variance === 0 ? <Badge tone="neutral">0</Badge> : <Badge tone="ok">+{r.variance}</Badge>}
                          </td>
                          <td className="w-32"><Progress value={used} tone={used > 100 ? "bad" : used > 90 ? "warn" : "brand"} /><div className="mt-0.5 text-[11px] text-muted">{Math.round(used)}%</div></td>
                          <td className="whitespace-nowrap text-right text-xs tabular-nums">{pkr(r.cost)}<div className="text-muted">{pkr(r.budget.annualCostPerHead)}/head</div></td>
                          <td className="whitespace-nowrap text-right">
                            <Link href={`/hr/headcount?fy=${fy}&edit=${r.budget.id}#line-form`} className="text-sm text-brand hover:underline">Edit</Link>
                            {r.available > 0 && (
                              <Link href={`/hr/requisitions/new?budget=${r.budget.id}`} className="ml-3 text-sm text-brand hover:underline">Raise req</Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Filled vs approved by department">
            <BarList items={[...byDept].map(([label, v]) => ({ label, value: v.filled, hint: `/ ${v.approved}` }))} max={Math.max(1, ...[...byDept.values()].map((v) => Math.max(v.approved, v.filled)))} />
          </Card>
          <Card title={editing ? "Edit budget line" : "Add budget line"}>
            <form id="line-form" action={saveBudget} className="space-y-3">
              <input type="hidden" name="id" value={editing?.id ?? ""} />
              <label className="block"><span className="label">Fiscal year</span><input name="fiscalYear" className="input" defaultValue={editing?.fiscalYear ?? fy} placeholder="2026-27" pattern="\d{4}-\d{2}" required /></label>
              <label className="block"><span className="label">Department</span>
                <select name="departmentId" className="input" defaultValue={editing?.departmentId ?? dept} required>
                  <option value="">Select…</option>
                  {departments.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
              <label className="block"><span className="label">Branch (optional)</span>
                <select name="branchId" className="input" defaultValue={editing?.branchId ?? ""}>
                  <option value="">All branches</option>
                  {masterList(d, "branch").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="label">Designation</span>
                  <select name="designationId" className="input" defaultValue={editing?.designationId ?? ""} required>
                    <option value="">Select…</option>
                    {masterList(d, "designation").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </label>
                <label className="block"><span className="label">Grade</span>
                  <select name="gradeId" className="input" defaultValue={editing?.gradeId ?? ""} required>
                    <option value="">Select…</option>
                    {masterList(d, "grade").map((m) => <option key={m.id} value={m.id}>{m.code}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="label">Approved heads</span><input type="number" min={0} name="approvedHeadcount" className="input" defaultValue={editing?.approvedHeadcount ?? 1} required /></label>
                <label className="block"><span className="label">Annual cost / head (PKR)</span><input type="number" min={0} step={1000} name="annualCostPerHead" className="input" defaultValue={editing?.annualCostPerHead ?? 1200000} required /></label>
              </div>
              <label className="block"><span className="label">Notes</span><input name="notes" className="input" defaultValue={editing?.notes ?? ""} /></label>
              <div className="flex gap-2">
                <SubmitButton>{editing ? "Save changes" : "Add line"}</SubmitButton>
                {editing && <LinkButton href={`/hr/headcount?fy=${fy}`} variant="secondary">Cancel</LinkButton>}
              </div>
            </form>
            {editing && (
              <form action={deleteBudget} className="mt-3 border-t border-line pt-3">
                <input type="hidden" name="id" value={editing.id} />
                <SubmitButton variant="danger" size="sm" confirm="Delete this budget line?">Delete line</SubmitButton>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
