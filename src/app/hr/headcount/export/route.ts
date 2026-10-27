import { currentUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName } from "@/lib/lookup";
import { budgetRow, currentFiscalYear } from "@/lib/planning/headcount";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || !["admin", "hr"].includes(user.role)) return new Response("Forbidden", { status: 403 });
  const d = db();
  const fy = new URL(req.url).searchParams.get("fy") ?? currentFiscalYear();
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Fiscal year", "Department", "Branch", "Designation", "Grade", "Approved", "Filled", "Open requisitions", "Available", "Variance", "Annual cost per head (PKR)", "Budget cost (PKR)", "Committed cost (PKR)"]];
  for (const b of d.budgets.filter((x) => x.fiscalYear === fy)) {
    const r = budgetRow(d, b);
    rows.push([fy, masterName(d, b.departmentId), masterName(d, b.branchId, "All"), masterName(d, b.designationId), masterName(d, b.gradeId), String(b.approvedHeadcount), String(r.filled), String(r.openReqs), String(r.available), String(r.variance), String(b.annualCostPerHead), String(r.cost), String(r.actualCost)]);
  }
  return new Response(rows.map((r) => r.map(esc).join(",")).join("\r\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="headcount-${fy}.csv"` },
  });
}
