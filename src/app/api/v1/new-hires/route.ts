import { NextResponse } from "next/server";
import { db } from "@/lib/store";
import { checkApiKey, employeeJson, paging } from "@/lib/integrations/outbound";

// New hires who completed orientation and received an employee number, newest first.
// Core banking / payroll can poll this to open accounts and payroll records.
export function GET(req: Request) {
  const denied = checkApiKey(req);
  if (denied) return denied;
  const d = db();
  const url = new URL(req.url);
  const rows = d.hires
    .filter((h) => h.employeeNo)
    .sort((a, b) => (b.orientationCompletedAt ?? b.createdAt).localeCompare(a.orientationCompletedAt ?? a.createdAt));
  const { page, pageSize } = paging(url);
  const data = rows.slice((page - 1) * pageSize, page * pageSize).map((h) => {
    const emp = d.employees.find((e) => e.id === h.employeeRecordId || e.employeeNo === h.employeeNo);
    return {
      employeeNo: h.employeeNo,
      name: h.name,
      joiningDate: h.joiningDate.slice(0, 10),
      onboardingStatus: h.status,
      orientationCompletedAt: h.orientationCompletedAt ?? null,
      employee: emp ? employeeJson(d, emp) : null,
    };
  });
  return NextResponse.json({ data, page, pageSize, total: rows.length });
}
