"use server";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { currentStep, decide, makeApprovals } from "@/lib/approvals";
import { saveUpload } from "@/lib/files";
import { db, mutate, nextCode, nowIso, uid } from "@/lib/store";
import type { Db, StatusChange, StatusChangeType, User } from "@/lib/types";
import { applyChange, CHANGE_TYPES, isDue, snapshotFrom, type ChangeField } from "@/lib/employees/status-change";
import { canDecide, isManagerStep } from "@/lib/employees/workflow";

function notifyStep(d: Db, sc: StatusChange) {
  const step = currentStep(sc.approvals);
  if (!step) return;
  const emp = d.employees.find((e) => e.id === sc.employeeId);
  const title = `Approval needed: ${CHANGE_TYPES[sc.type].label}`;
  const body = `${sc.code} for ${emp?.name ?? "an employee"} is waiting for the ${step.label} step.`;
  const href = `/hr/status-changes/${sc.id}`;
  if (isManagerStep(step.label)) {
    const managers = d.users.filter((u) => u.active && u.role === "hiring" && u.departmentId && u.departmentId === emp?.departmentId);
    if (managers.length) {
      for (const m of managers) notify(d, { userId: m.id }, title, body, href);
      return;
    }
  }
  notify(d, { roles: ["hr", "admin"] }, title, body, href);
}

export async function createStatusChange(form: FormData) {
  const user = await requireSection("/hr/status-changes");
  const employeeId = String(form.get("employeeId") ?? "");
  const type = String(form.get("type") ?? "") as StatusChangeType;
  const effectiveDate = String(form.get("effectiveDate") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  const back = (err: string) => redirect(`/hr/status-changes/new?employee=${employeeId}&type=${type}&err=${encodeURIComponent(err)}`);
  const d0 = db();
  const emp = d0.employees.find((e) => e.id === employeeId);
  if (!emp) back("Please choose an employee.");
  if (!emp!.active) back("This employee has already left the bank.");
  if (user.role === "hiring" && (!user.departmentId || user.departmentId !== emp!.departmentId)) back("You can raise changes only for employees in your department.");
  const meta = CHANGE_TYPES[type];
  if (!meta) back("Please choose the type of change.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) back("Please choose the effective date.");
  if (reason.length < 5) back("Please explain the reason in a sentence.");
  if (d0.statusChanges.some((s) => s.employeeId === employeeId && s.type === type && (s.status === "pending" || s.status === "approved")))
    back(`There is already an open ${meta.label.toLowerCase()} request for ${emp!.name}.`);

  const to: StatusChange["to"] = {};
  for (const f of meta.fields) {
    const raw = String(form.get(f) ?? "").trim();
    if (!raw) continue;
    if (f === "basicSalary") {
      const n = Number(raw);
      if (Number.isNaN(n) || n <= 0) back("Please enter a valid salary.");
      to.basicSalary = n;
    } else to[f as Exclude<ChangeField, "basicSalary">] = raw;
  }
  const from = snapshotFrom(emp!, type);
  const changed = meta.fields.filter((f) => to[f] !== undefined && to[f] !== emp![f]);
  if (meta.fields.length && type !== "contract_renewal" && changed.length === 0) back("Nothing changes: set at least one new value that differs from the current one.");
  if (type === "confirmation" && emp!.employmentStatus === "confirmed") back(`${emp!.name} is already confirmed.`);
  for (const f of meta.fields) if (to[f] === emp![f]) delete to[f];

  let fileId: string | undefined;
  try {
    fileId = (await saveUpload(form.get("attachment"), user.id))?.id;
  } catch (e) {
    back(e instanceof Error ? e.message : "Upload failed.");
  }

  const id = mutate((d) => {
    const sc: StatusChange = {
      id: uid("sc_"),
      code: nextCode(d, "STC"),
      employeeId,
      type,
      from,
      to,
      effectiveDate,
      reason,
      status: "pending",
      approvals: makeApprovals(d.settings.statusChangeApprovalChain),
      requestedBy: user.id,
      createdAt: nowIso(),
    };
    // A request raised by the employee's own line manager counts as the manager's approval.
    const first = sc.approvals[0];
    if (first && user.role === "hiring" && isManagerStep(first.label)) decide(sc.approvals, user, "approved", "Raised by line manager");
    if (sc.approvals.length === 0) sc.status = "approved";
    d.statusChanges.push(sc);
    audit(d, user, "statuschange.create", "status_change", sc.id, `Raised ${sc.code}: ${meta.label} for ${emp!.name}, effective ${effectiveDate}`, { after: sc });
    if (fileId) audit(d, user, "statuschange.attachment", "status_change", sc.id, "Attached a supporting document", { after: { fileId } });
    if (sc.status === "pending") notifyStep(d, sc);
    else maybeApply(d, sc, user);
    return sc.id;
  });
  redirect(`/hr/status-changes/${id}?msg=${encodeURIComponent("Request raised and sent for approval.")}`);
}

function maybeApply(d: Db, sc: StatusChange, user: Pick<User, "id" | "name" | "role">) {
  if (sc.status !== "approved" || !isDue(sc)) return;
  const res = applyChange(d, sc, nowIso());
  if (res) audit(d, user, "employee.status_change", "employee", sc.employeeId, `${CHANGE_TYPES[sc.type].label} applied (${sc.code})`, res);
}

export async function decideStatusChange(id: string, form: FormData) {
  const user = await requireSection("/hr/status-changes");
  const decision = form.get("decision") === "approve" ? "approved" : "rejected";
  const comment = String(form.get("comment") ?? "").trim();
  const d0 = db();
  const sc0 = d0.statusChanges.find((s) => s.id === id);
  if (!sc0) redirect("/hr/status-changes?err=Request+not+found.");
  if (!canDecide(d0, user, sc0!)) redirect(`/hr/status-changes/${id}?err=${encodeURIComponent("You cannot decide this step.")}`);
  if (decision === "rejected" && !comment) redirect(`/hr/status-changes/${id}?err=${encodeURIComponent("Please give a reason when rejecting.")}`);
  let msg = "";
  mutate((d) => {
    const sc = d.statusChanges.find((s) => s.id === id)!;
    const stepLabel = currentStep(sc.approvals)?.label;
    const outcome = decide(sc.approvals, user, decision, comment);
    const emp = d.employees.find((e) => e.id === sc.employeeId);
    const label = CHANGE_TYPES[sc.type].label;
    audit(d, user, `statuschange.${decision === "approved" ? "approve" : "reject"}`, "status_change", sc.id, `${decision === "approved" ? "Approved" : "Rejected"} ${sc.code} at the ${stepLabel} step${comment ? `: ${comment}` : ""}`);
    if (outcome === "pending") {
      notifyStep(d, sc);
      msg = "Approved. Sent to the next approver.";
    } else if (outcome === "rejected") {
      sc.status = "rejected";
      notify(d, { userId: sc.requestedBy }, `${label} rejected`, `${sc.code} for ${emp?.name} was rejected: ${comment}`, `/hr/status-changes/${sc.id}`);
      msg = "Request rejected.";
    } else {
      sc.status = "approved";
      maybeApply(d, sc, user);
      const applied = (sc.status as StatusChange["status"]) === "applied";
      notify(d, { userId: sc.requestedBy }, `${label} approved`, `${sc.code} for ${emp?.name} is fully approved${applied ? " and applied" : `; it applies on ${sc.effectiveDate}`}.`, `/hr/status-changes/${sc.id}`);
      msg = applied ? "Fully approved and applied to the employee master." : `Fully approved. It will apply on ${sc.effectiveDate}.`;
    }
  });
  redirect(`/hr/status-changes/${id}?msg=${encodeURIComponent(msg)}`);
}

export async function applyNow(id: string) {
  const user = await requireSection("/hr/status-changes");
  if (user.role === "hiring") redirect(`/hr/status-changes/${id}?err=Only+HR+can+apply+changes+early.`);
  mutate((d) => {
    const sc = d.statusChanges.find((s) => s.id === id);
    if (!sc || sc.status !== "approved") return;
    const res = applyChange(d, sc, nowIso());
    if (res) audit(d, user, "employee.status_change", "employee", sc.employeeId, `${CHANGE_TYPES[sc.type].label} applied early by ${user.name} (${sc.code}, effective ${sc.effectiveDate})`, res);
  });
  redirect(`/hr/status-changes/${id}?msg=Applied+to+the+employee+master.`);
}
