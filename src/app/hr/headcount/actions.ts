"use server";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { mutate, nowIso, uid } from "@/lib/store";

const back = (fy: string, q: string) => redirect(`/hr/headcount?fy=${encodeURIComponent(fy)}&${q}`);

export async function saveBudget(form: FormData) {
  const user = await requireSection("/hr/headcount");
  const id = String(form.get("id") ?? "");
  const fy = String(form.get("fiscalYear") ?? "").trim();
  const departmentId = String(form.get("departmentId") ?? "");
  const designationId = String(form.get("designationId") ?? "");
  const gradeId = String(form.get("gradeId") ?? "");
  const branchId = String(form.get("branchId") ?? "") || undefined;
  const approvedHeadcount = Math.max(0, Math.round(Number(form.get("approvedHeadcount") ?? 0)));
  const annualCostPerHead = Math.max(0, Number(form.get("annualCostPerHead") ?? 0));
  const notes = String(form.get("notes") ?? "").trim() || undefined;
  if (!/^\d{4}-\d{2}$/.test(fy) || !departmentId || !designationId || !gradeId) back(fy, "err=Please+fill+in+fiscal+year,+department,+designation+and+grade.");
  mutate((d) => {
    if (id) {
      const b = d.budgets.find((x) => x.id === id);
      if (!b) return;
      const before = { ...b };
      Object.assign(b, { fiscalYear: fy, departmentId, designationId, gradeId, branchId, approvedHeadcount, annualCostPerHead, notes, updatedAt: nowIso() });
      audit(d, user, "headcount.update", "headcount_budget", b.id, `Updated budget line (${approvedHeadcount} heads)`, { before, after: b });
    } else {
      const b = { id: uid("b_"), fiscalYear: fy, departmentId, designationId, gradeId, branchId, approvedHeadcount, annualCostPerHead, notes, createdBy: user.id, createdAt: nowIso(), updatedAt: nowIso() };
      d.budgets.push(b);
      audit(d, user, "headcount.create", "headcount_budget", b.id, `Added budget line (${approvedHeadcount} heads) for FY ${fy}`, { after: b });
    }
  });
  back(fy, `msg=${id ? "Budget+line+updated." : "Budget+line+added."}`);
}

export async function deleteBudget(form: FormData) {
  const user = await requireSection("/hr/headcount");
  const id = String(form.get("id") ?? "");
  let fy = "";
  const blocked = mutate((d) => {
    const b = d.budgets.find((x) => x.id === id);
    if (!b) return false;
    fy = b.fiscalYear;
    if (d.requisitions.some((r) => r.budgetId === id && !["cancelled", "rejected"].includes(r.status))) return true;
    d.budgets = d.budgets.filter((x) => x.id !== id);
    audit(d, user, "headcount.delete", "headcount_budget", id, "Deleted budget line", { before: b });
    return false;
  });
  back(fy, blocked ? "err=This+line+is+used+by+active+requisitions+and+cannot+be+deleted." : "msg=Budget+line+deleted.");
}
