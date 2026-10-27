import type { Db, Employee } from "../types";
import { masterName } from "../lookup";

export interface EmployeeFilters {
  q?: string;
  dept?: string;
  branch?: string;
  grade?: string;
  status?: string;
  source?: string;
  active?: string; // "yes" | "no" | "all"
  sort?: string;
  dir?: string;
  page?: string;
}

export const SORTS: Record<string, (d: Db, e: Employee) => string> = {
  name: (_d, e) => e.name.toLowerCase(),
  no: (_d, e) => e.employeeNo,
  dept: (d, e) => masterName(d, e.departmentId, "~"),
  designation: (d, e) => masterName(d, e.designationId, "~"),
  joined: (_d, e) => e.joiningDate,
  status: (_d, e) => e.employmentStatus,
};

export function filterEmployees(d: Db, f: EmployeeFilters): Employee[] {
  const q = f.q?.trim().toLowerCase();
  const digits = q?.replace(/\D/g, "");
  const active = f.active ?? "yes";
  const rows = d.employees.filter((e) => {
    if (active === "yes" && !e.active) return false;
    if (active === "no" && e.active) return false;
    if (f.dept && e.departmentId !== f.dept) return false;
    if (f.branch && e.branchId !== f.branch) return false;
    if (f.grade && e.gradeId !== f.grade) return false;
    if (f.status && e.employmentStatus !== f.status) return false;
    if (f.source && e.source !== f.source) return false;
    if (q) {
      const hit =
        e.name.toLowerCase().includes(q) ||
        e.employeeNo.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (!!digits && digits.length >= 4 && (e.cnic ?? "").replace(/\D/g, "").includes(digits)) ||
        (!!digits && digits.length >= 4 && (e.phone ?? "").replace(/\D/g, "").includes(digits));
      if (!hit) return false;
    }
    return true;
  });
  const key = SORTS[f.sort ?? "name"] ?? SORTS.name!;
  const dir = f.dir === "desc" ? -1 : 1;
  return rows.sort((a, b) => key(d, a).localeCompare(key(d, b)) * dir);
}

export function toCsv(d: Db, rows: Employee[]): string {
  const head = ["Employee no", "Name", "Email", "Phone", "CNIC", "Department", "Branch", "Designation", "Grade", "Employment type", "Joining date", "Status", "Active", "Source", "Exit date"];
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    // Neutralise spreadsheet formulas and quote every cell.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const body = rows.map((e) =>
    [
      e.employeeNo,
      e.name,
      e.email,
      e.phone,
      e.cnic,
      masterName(d, e.departmentId, ""),
      masterName(d, e.branchId, ""),
      masterName(d, e.designationId, ""),
      masterName(d, e.gradeId, ""),
      masterName(d, e.employmentTypeId, ""),
      e.joiningDate.slice(0, 10),
      e.employmentStatus,
      e.active ? "Yes" : "No",
      e.source,
      e.exitDate?.slice(0, 10),
    ]
      .map(esc)
      .join(","),
  );
  return "﻿" + [head.map(esc).join(","), ...body].join("\r\n");
}

export const EMPLOYMENT_STATUSES = ["probation", "confirmed", "contract", "resigned", "terminated", "retired"] as const;
