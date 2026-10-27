import type { Db, Employee, StatusChange, StatusChangeType } from "../types";
import { todayInput } from "../format";

export type ChangeField = "departmentId" | "branchId" | "designationId" | "gradeId" | "basicSalary";

export const CHANGE_TYPES: Record<
  StatusChangeType,
  { label: string; icon: string; fields: ChangeField[]; help: string; result?: Employee["employmentStatus"]; exit?: boolean }
> = {
  confirmation: { label: "Confirmation", icon: "✅", fields: [], result: "confirmed", help: "Confirm the employee after a successful probation." },
  promotion: { label: "Promotion", icon: "⬆️", fields: ["designationId", "gradeId", "basicSalary"], help: "New designation and/or grade, usually with a salary increase." },
  transfer: { label: "Transfer", icon: "🔀", fields: ["departmentId", "branchId"], help: "Move to another department or branch." },
  redesignation: { label: "Re-designation", icon: "🏷️", fields: ["designationId"], help: "Change of job title at the same grade." },
  salary_revision: { label: "Salary revision", icon: "💰", fields: ["basicSalary"], help: "Change of basic salary (annual increment, market adjustment)." },
  contract_renewal: { label: "Contract renewal", icon: "📄", fields: ["basicSalary"], result: "contract", help: "Renew a fixed-term contract; salary change is optional." },
  resignation: { label: "Resignation", icon: "👋", fields: [], result: "resigned", exit: true, help: "The employee has resigned. The effective date is the last working day." },
  termination: { label: "Termination", icon: "⛔", fields: [], result: "terminated", exit: true, help: "Employment ended by the bank. The effective date is the last working day." },
  retirement: { label: "Retirement", icon: "🌅", fields: [], result: "retired", exit: true, help: "Retirement on reaching superannuation age." },
};

export const FIELD_LABEL: Record<ChangeField | "employmentStatus", string> = {
  departmentId: "Department",
  branchId: "Branch",
  designationId: "Designation",
  gradeId: "Grade",
  basicSalary: "Basic salary",
  employmentStatus: "Employment status",
};

/** Values captured as "from" when the request is raised. */
export function snapshotFrom(e: Employee, type: StatusChangeType): StatusChange["from"] {
  const from: StatusChange["from"] = { employmentStatus: e.employmentStatus };
  for (const f of CHANGE_TYPES[type].fields) (from as Record<string, unknown>)[f] = e[f];
  return from;
}

/** Apply an approved change to the employee record (call inside mutate). Returns before/after for the audit. */
export function applyChange(d: Db, sc: StatusChange, at: string) {
  const e = d.employees.find((x) => x.id === sc.employeeId);
  if (!e) return null;
  const before = { ...e };
  const meta = CHANGE_TYPES[sc.type];
  for (const [k, v] of Object.entries(sc.to)) if (v !== undefined && v !== "") (e as unknown as Record<string, unknown>)[k] = v;
  if (meta.result) e.employmentStatus = meta.result;
  if (meta.exit) {
    e.active = false;
    e.exitDate = sc.effectiveDate;
  }
  e.updatedAt = at;
  sc.status = "applied";
  sc.appliedAt = at;
  return { before, after: { ...e } };
}

export function isDue(sc: StatusChange, today = todayInput()) {
  return sc.effectiveDate.slice(0, 10) <= today;
}
