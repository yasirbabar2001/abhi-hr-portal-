import "server-only";
import type { Db, Hire, User } from "../types";
import { allocateEmployeeNo } from "../employee-id";
import { audit, notify, SYSTEM } from "../audit";
import { nowIso, uid } from "../store";
import { buildJourney } from "./journey";

type Actor = Pick<User, "id" | "name" | "role">;

/** Create or update a hire's progress on one module (call inside mutate). */
export function recordProgress(
  d: Db,
  hire: Hire,
  moduleId: string,
  change: { completed?: boolean; score?: number; scormData?: Record<string, string>; attempt?: boolean },
) {
  const mod = d.modules.find((m) => m.id === moduleId);
  if (!mod) throw new Error("Module not found");
  let p = d.progress.find((x) => x.hireId === hire.id && x.moduleId === moduleId);
  if (!p) {
    p = { id: uid("op_"), hireId: hire.id, moduleId, status: "not_started", points: 0, attempts: 0 };
    d.progress.push(p);
  }
  p.startedAt ??= nowIso();
  if (p.status === "not_started") p.status = "in_progress";
  if (change.attempt) p.attempts += 1;
  if (change.scormData) p.scormData = { ...(p.scormData ?? {}), ...change.scormData };
  if (change.score !== undefined && (p.score === undefined || change.score > p.score || p.status !== "completed")) {
    p.score = Math.max(p.score ?? 0, change.score);
  }
  if (change.completed && p.status !== "completed") {
    p.status = "completed";
    p.completedAt = nowIso();
    p.points = mod.points;
  }
  return p;
}

/**
 * When every active required mod is complete, generate the employee number and
 * create the employee master record. Safe to call repeatedly: it runs once per hire.
 */
export function completeOrientationIfDone(d: Db, hire: Hire, actor: Actor = SYSTEM as Actor): string | null {
  if (hire.employeeNo) return null;
  if (!buildJourney(d, hire).allDone) return null;

  const offer = d.offers.find((o) => o.id === hire.offerId);
  const cand = d.candidates.find((c) => c.id === hire.candidateId);
  const employeeNo = allocateEmployeeNo(d, offer?.departmentId);
  const at = nowIso();
  const employeeId = uid("e_");
  d.employees.push({
    id: employeeId,
    employeeNo,
    name: hire.name,
    email: cand?.email ?? d.users.find((u) => u.id === hire.userId)?.email ?? "",
    phone: cand?.phone,
    cnic: cand?.cnic,
    departmentId: offer?.departmentId,
    branchId: offer?.branchId,
    designationId: offer?.designationId,
    gradeId: offer?.gradeId,
    employmentTypeId: offer?.employmentTypeId,
    joiningDate: hire.joiningDate,
    employmentStatus: "probation",
    active: true,
    basicSalary: offer?.basicSalary,
    source: "portal",
    hireId: hire.id,
    createdAt: at,
    updatedAt: at,
  });
  hire.employeeNo = employeeNo;
  hire.employeeRecordId = employeeId;
  hire.orientationCompletedAt = at;
  if (hire.status === "orientation" || hire.status === "preboarding") hire.status = "onboarding";
  if (!hire.badges.includes("Employee ID earned")) hire.badges.push("Employee ID earned");
  const orientTask = hire.tasks.find((t) => /orientation/i.test(t.title) && !t.done);
  if (orientTask) Object.assign(orientTask, { done: true, doneAt: at, doneBy: hire.userId });

  notify(d, { userId: hire.userId }, "Your employee ID is ready 🎉", `Congratulations! Your employee ID is ${employeeNo}.`, "/me/orientation");
  notify(d, { roles: ["hr", "admin"] }, "Orientation completed", `${hire.name} completed orientation. Employee ID ${employeeNo} was generated.`, `/hr/onboarding/${hire.id}`);
  if (hire.managerId) notify(d, { userId: hire.managerId }, "New team member ready", `${hire.name} completed orientation (${employeeNo}).`, `/hr/onboarding/${hire.id}`);
  audit(d, actor, "employee.id_generated", "employee", employeeId, `Employee ID ${employeeNo} generated for ${hire.name} on completing orientation`, {
    after: { employeeNo, hireId: hire.id },
  });
  return employeeNo;
}
