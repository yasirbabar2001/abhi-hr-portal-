"use server";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { allocateEmployeeNo } from "@/lib/employee-id";
import { db, mutate, nowIso, uid } from "@/lib/store";
import type { Employee, EmploymentStatus, User } from "@/lib/types";
import { EMPLOYMENT_STATUSES } from "@/lib/employees/query";

function canEditEmployee(user: User, e: Pick<Employee, "source">) {
  if (user.role === "admin") return true;
  return user.role === "hr" && e.source !== "api";
}

function readFields(form: FormData) {
  const s = (k: string) => String(form.get(k) ?? "").trim() || undefined;
  const status = s("employmentStatus") as EmploymentStatus | undefined;
  const salary = s("basicSalary");
  const gender = s("gender");
  return {
    name: s("name"),
    email: s("email")?.toLowerCase(),
    phone: s("phone"),
    cnic: s("cnic"),
    gender: (["male", "female", "other"].includes(gender ?? "") ? gender : undefined) as Employee["gender"],
    dateOfBirth: s("dateOfBirth"),
    departmentId: s("departmentId"),
    branchId: s("branchId"),
    designationId: s("designationId"),
    gradeId: s("gradeId"),
    employmentTypeId: s("employmentTypeId"),
    managerEmployeeId: s("managerEmployeeId"),
    joiningDate: s("joiningDate"),
    employmentStatus: status && (EMPLOYMENT_STATUSES as readonly string[]).includes(status) ? status : undefined,
    basicSalary: salary && !Number.isNaN(Number(salary)) ? Number(salary) : undefined,
  };
}

function problems(f: ReturnType<typeof readFields>): string | null {
  if (!f.name || f.name.length < 2) return "Please enter the employee's full name.";
  if (!f.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return "Please enter a valid email address.";
  if (f.cnic && !/^\d{5}-?\d{7}-?\d$/.test(f.cnic)) return "CNIC should look like 42101-1234567-1.";
  if (!f.joiningDate) return "Please enter the joining date.";
  if (!f.departmentId || !f.designationId) return "Please choose a department and designation.";
  return null;
}

export async function createEmployee(form: FormData) {
  const user = await requireSection("/hr/employees");
  if (user.role === "hiring") redirect("/hr/employees?err=Only+HR+can+add+employees.");
  const f = readFields(form);
  const manualNo = String(form.get("employeeNo") ?? "").trim();
  const err = problems(f);
  const back = (msg: string) => redirect(`/hr/employees/new?err=${encodeURIComponent(msg)}`);
  if (err) back(err);
  const d0 = db();
  if (manualNo && d0.employees.some((e) => e.employeeNo.toLowerCase() === manualNo.toLowerCase())) back(`Employee number ${manualNo} is already in use.`);
  if (d0.employees.some((e) => e.active && e.email === f.email)) back(`An active employee already uses ${f.email}.`);
  const id = mutate((d) => {
    const at = nowIso();
    const emp: Employee = {
      id: uid("e_"),
      employeeNo: manualNo || allocateEmployeeNo(d, f.departmentId),
      name: f.name!,
      email: f.email!,
      phone: f.phone,
      cnic: f.cnic,
      gender: f.gender,
      dateOfBirth: f.dateOfBirth,
      departmentId: f.departmentId,
      branchId: f.branchId,
      designationId: f.designationId,
      gradeId: f.gradeId,
      employmentTypeId: f.employmentTypeId,
      managerEmployeeId: f.managerEmployeeId,
      joiningDate: f.joiningDate!,
      employmentStatus: f.employmentStatus ?? "probation",
      active: true,
      basicSalary: f.basicSalary,
      source: "manual",
      createdAt: at,
      updatedAt: at,
    };
    d.employees.push(emp);
    audit(d, user, "employee.create", "employee", emp.id, `Added ${emp.name} (${emp.employeeNo}) to the employee master`, { after: emp });
    return emp.id;
  });
  redirect(`/hr/employees/${id}?msg=${encodeURIComponent("Employee added.")}`);
}

export async function updateEmployee(id: string, form: FormData) {
  const user = await requireSection("/hr/employees");
  const e0 = db().employees.find((e) => e.id === id);
  if (!e0) redirect("/hr/employees?err=Employee+not+found.");
  if (!canEditEmployee(user, e0)) redirect(`/hr/employees/${id}?err=${encodeURIComponent("You cannot edit this record.")}`);
  const f = readFields(form);
  const err = problems(f);
  if (err) redirect(`/hr/employees/${id}/edit?err=${encodeURIComponent(err)}`);
  if (f.managerEmployeeId === id) redirect(`/hr/employees/${id}/edit?err=${encodeURIComponent("An employee cannot be their own manager.")}`);
  mutate((d) => {
    const e = d.employees.find((x) => x.id === id)!;
    const before = { ...e };
    Object.assign(e, f, { updatedAt: nowIso() });
    const changed = (Object.keys(f) as (keyof typeof f)[]).filter((k) => before[k] !== e[k]);
    audit(d, user, "employee.update", "employee", id, `Edited ${e.name}: ${changed.join(", ") || "no changes"}${e.source === "api" ? " (record is managed by the core HR system)" : ""}`, {
      before,
      after: { ...e },
    });
  });
  redirect(`/hr/employees/${id}?msg=Changes+saved.`);
}

export async function addNote(id: string, form: FormData) {
  const user = await requireSection("/hr/employees");
  if (user.role === "hiring") redirect(`/hr/employees/${id}?err=Only+HR+can+add+notes.`);
  const text = String(form.get("note") ?? "").trim();
  if (!text) redirect(`/hr/employees/${id}?err=Please+write+a+note.`);
  mutate((d) => {
    const e = d.employees.find((x) => x.id === id);
    if (e) audit(d, user, "employee.note", "employee", id, text.slice(0, 2000));
  });
  redirect(`/hr/employees/${id}?msg=Note+added.`);
}
