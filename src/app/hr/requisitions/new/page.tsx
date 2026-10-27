import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterList, masterName } from "@/lib/lookup";
import { todayInput } from "@/lib/format";
import { budgetRow, currentFiscalYear } from "@/lib/planning/headcount";
import { Card, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { createRequisition } from "../actions";
import { BudgetPicker } from "./BudgetPicker";

export const metadata = { title: "New requisition" };

export default async function NewRequisition({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSection("/hr/requisitions");
  const sp = await searchParams;
  const d = db();
  const jd = sp.jd ? d.jds.find((j) => j.id === sp.jd) : undefined;
  const budget = sp.budget ? d.budgets.find((b) => b.id === sp.budget) : undefined;
  const fy = currentFiscalYear();
  const options = d.budgets
    .filter((b) => b.fiscalYear >= fy)
    .map((b) => {
      const r = budgetRow(d, b);
      return {
        id: b.id,
        label: `FY ${b.fiscalYear} · ${masterName(d, b.designationId)} (${masterName(d, b.gradeId)}) · ${masterName(d, b.departmentId)}${b.branchId ? ` · ${masterName(d, b.branchId)}` : ""}`,
        available: r.available,
        departmentId: b.departmentId,
        designationId: b.designationId,
      };
    });
  const preBudget = budget?.id ?? (jd ? options.find((o) => o.departmentId === jd.departmentId && o.designationId === jd.designationId)?.id : undefined);
  const dept = jd?.departmentId ?? budget?.departmentId ?? user.departmentId ?? "";
  const desig = jd?.designationId ?? budget?.designationId ?? "";
  const grade = jd?.gradeId ?? budget?.gradeId ?? "";
  const internal = d.users.filter((u) => u.active && u.role !== "candidate");
  const sel = (name: string, type: Parameters<typeof masterList>[1], def: string, required = true) => (
    <select name={name} className="input" defaultValue={def} required={required}>
      <option value="">Select…</option>
      {masterList(d, type).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  );
  return (
    <div className="max-w-4xl">
      <PageHeader title="New requisition" subtitle={jd ? `Prefilled from ${jd.code} ${jd.title}` : "Describe the position you need to fill."} back={{ href: "/hr/requisitions", label: "Requisitions" }} />
      <Flash err={sp.err} />
      <form action={createRequisition} className="space-y-6">
        <input type="hidden" name="jdId" value={jd?.id ?? ""} />
        <Card title="Position">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="label">Job title *</span><input name="title" className="input" defaultValue={jd?.title ?? (budget ? masterName(d, budget.designationId) : "")} required /></label>
            <label className="block"><span className="label">Department *</span>{sel("departmentId", "department", dept)}</label>
            <label className="block"><span className="label">Branch / office *</span>{sel("branchId", "branch", budget?.branchId ?? "")}</label>
            <label className="block"><span className="label">Designation *</span>{sel("designationId", "designation", desig)}</label>
            <label className="block"><span className="label">Grade *</span>{sel("gradeId", "grade", grade)}</label>
            <label className="block"><span className="label">Employment type *</span>{sel("employmentTypeId", "employment_type", masterList(d, "employment_type")[0]?.id ?? "")}</label>
            <label className="block"><span className="label">Job description</span>
              <select name="jdIdView" className="input" defaultValue={jd?.id ?? ""} disabled>
                <option value="">{jd ? `${jd.code} v${jd.version}` : "None — pick one from the JD bank to prefill"}</option>
              </select>
            </label>
          </div>
        </Card>
        <Card title="Budget & headcount">
          <BudgetPicker options={options} defaultBudget={preBudget} defaultHeadcount={1} />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="block"><span className="label">Monthly salary from (PKR)</span><input type="number" name="salaryMin" min={0} step={1000} className="input" /></label>
            <label className="block"><span className="label">Monthly salary to (PKR)</span><input type="number" name="salaryMax" min={0} step={1000} className="input" /></label>
            <label className="block"><span className="label">Target start date *</span><input type="date" name="targetStartDate" className="input" defaultValue={todayInput(45)} required /></label>
          </div>
        </Card>
        <Card title="Reason & people">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="label">Type</span>
              <select name="kind" className="input" defaultValue="new"><option value="new">New position</option><option value="replacement">Replacement</option></select>
            </label>
            <label className="block"><span className="label">Replacing (if replacement)</span><input name="replacementFor" className="input" placeholder="Name or employee number" /></label>
            <label className="block"><span className="label">Priority</span>
              <select name="priority" className="input" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select>
            </label>
            <label className="block"><span className="label">Hiring manager</span>
              <select name="hiringManagerId" className="input" defaultValue={user.role === "hiring" ? user.id : ""}>
                <option value="">Select…</option>
                {internal.filter((u) => u.role === "hiring" || u.role === "admin").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">Recruiter</span>
              <select name="recruiterId" className="input" defaultValue="">
                <option value="">Assign later</option>
                {internal.filter((u) => u.role === "hr").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label className="block sm:col-span-2"><span className="label">Business justification *</span><textarea name="justification" className="input" required placeholder="Why is this position needed now? What happens if it stays open?" /></label>
          </div>
        </Card>
        <div className="flex flex-wrap gap-2">
          <SubmitButton name="intent" value="submit">Submit for approval</SubmitButton>
          <SubmitButton name="intent" value="draft" variant="secondary">Save as draft</SubmitButton>
        </div>
        <p className="hint">Approval chain: {d.settings.requisitionApprovalChain.join(" → ")}</p>
      </form>
    </div>
  );
}
