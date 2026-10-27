import "server-only";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "../store";
import type { Db, Employee } from "../types";

/** Constant-time check of the x-api-key header against the configured outbound key. */
export function checkApiKey(req: Request): NextResponse | null {
  const expected = db().settings.employeeApi.outboundApiKey;
  const given = req.headers.get("x-api-key") ?? "";
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  if (!expected || !given || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "unauthorised", hint: "Send the portal API key in the x-api-key header." }, { status: 401 });
  }
  return null;
}

function ref(d: Db, id: string | undefined) {
  const m = id ? d.master.find((x) => x.id === id) : undefined;
  return m ? { code: m.code, name: m.name } : null;
}

export function employeeJson(d: Db, e: Employee) {
  const mgr = e.managerEmployeeId ? d.employees.find((x) => x.id === e.managerEmployeeId) : undefined;
  return {
    employeeNo: e.employeeNo,
    name: e.name,
    email: e.email,
    phone: e.phone ?? null,
    cnic: e.cnic ?? null,
    gender: e.gender ?? null,
    department: ref(d, e.departmentId),
    branch: ref(d, e.branchId),
    designation: ref(d, e.designationId),
    grade: ref(d, e.gradeId),
    employmentType: ref(d, e.employmentTypeId),
    managerEmployeeNo: mgr?.employeeNo ?? null,
    joiningDate: e.joiningDate.slice(0, 10),
    employmentStatus: e.employmentStatus,
    active: e.active,
    exitDate: e.exitDate?.slice(0, 10) ?? null,
    source: e.source,
    updatedAt: e.updatedAt,
  };
}

export function paging(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(500, Math.max(1, Number(url.searchParams.get("page_size") ?? 100) || 100));
  return { page, pageSize };
}
