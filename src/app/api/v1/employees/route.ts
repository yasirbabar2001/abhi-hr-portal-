import { NextResponse } from "next/server";
import { db } from "@/lib/store";
import { checkApiKey, employeeJson, paging } from "@/lib/integrations/outbound";

// GET /api/v1/employees?status=confirmed&department=IT&updated_since=2026-01-01&active=true&page=1&page_size=100
export function GET(req: Request) {
  const denied = checkApiKey(req);
  if (denied) return denied;
  const d = db();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const dept = url.searchParams.get("department")?.toLowerCase();
  const since = url.searchParams.get("updated_since");
  const active = url.searchParams.get("active");
  const sinceMs = since ? Date.parse(since) : NaN;
  if (since && Number.isNaN(sinceMs)) return NextResponse.json({ error: "updated_since must be a date, e.g. 2026-01-31" }, { status: 400 });
  const deptIds = dept ? new Set(d.master.filter((m) => m.type === "department" && (m.code.toLowerCase() === dept || m.name.toLowerCase() === dept)).map((m) => m.id)) : null;
  const rows = d.employees
    .filter((e) => (!status || e.employmentStatus === status) && (!deptIds || (e.departmentId && deptIds.has(e.departmentId))))
    .filter((e) => (active === null ? true : String(e.active) === active))
    .filter((e) => Number.isNaN(sinceMs) || Date.parse(e.updatedAt) >= sinceMs)
    .sort((a, b) => a.employeeNo.localeCompare(b.employeeNo));
  const { page, pageSize } = paging(url);
  const data = rows.slice((page - 1) * pageSize, page * pageSize).map((e) => employeeJson(d, e));
  let next: string | null = null;
  if (page * pageSize < rows.length) {
    const n = new URL(url);
    n.searchParams.set("page", String(page + 1));
    next = n.toString();
  }
  return NextResponse.json({ data, page, pageSize, total: rows.length, next });
}
