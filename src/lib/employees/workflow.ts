import "server-only";
import { audit } from "../audit";
import { currentStep } from "../approvals";
import { db, mutate, nowIso } from "../store";
import type { Db, StatusChange, User } from "../types";
import { applyChange, CHANGE_TYPES, isDue } from "./status-change";

export const isManagerStep = (label?: string) => !!label && /manager|head of department|line/i.test(label);

/** Who may decide the current step: hiring managers of the employee's department take manager steps; HR/admin take the rest (and may stand in for managers). */
export function canDecide(d: Db, user: User, sc: StatusChange): boolean {
  const step = currentStep(sc.approvals);
  if (!step || sc.status !== "pending") return false;
  const emp = d.employees.find((e) => e.id === sc.employeeId);
  if (user.role === "admin") return true;
  if (user.role === "hr") return isManagerStep(step.label) || sc.requestedBy !== user.id; // no self-approval of HR steps
  if (user.role === "hiring") return isManagerStep(step.label) && !!user.departmentId && user.departmentId === emp?.departmentId;
  return false;
}

/** Apply every approved change whose effective date has arrived (called when the list opens). */
export function applyDueChanges(): number {
  if (!db().statusChanges.some((s) => s.status === "approved" && isDue(s))) return 0;
  return mutate((d) => {
    let n = 0;
    for (const s of d.statusChanges) {
      if (s.status !== "approved" || !isDue(s)) continue;
      const res = applyChange(d, s, nowIso());
      if (res) {
        n++;
        audit(d, { id: "system", name: "System", role: "system" }, "employee.status_change", "employee", s.employeeId, `${CHANGE_TYPES[s.type].label} applied on its effective date (${s.code})`, res);
      }
    }
    return n;
  });
}
