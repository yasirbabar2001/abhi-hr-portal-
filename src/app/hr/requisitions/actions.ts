"use server";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { currentStep, decide, makeApprovals } from "@/lib/approvals";
import { db, mutate, nextCode, nowIso, uid } from "@/lib/store";
import type { Requisition } from "@/lib/types";

const num = (v: FormDataEntryValue | null) => Number(v ?? 0) || 0;

export async function createRequisition(form: FormData) {
  const user = await requireSection("/hr/requisitions");
  const submit = form.get("intent") === "submit";
  const f = (k: string) => String(form.get(k) ?? "").trim();
  const required = ["title", "departmentId", "branchId", "designationId", "gradeId", "employmentTypeId", "justification", "targetStartDate"];
  if (required.some((k) => !f(k))) redirect(`/hr/requisitions/new?err=${encodeURIComponent("Please complete all required fields.")}`);
  const salaryMin = num(form.get("salaryMin"));
  const salaryMax = num(form.get("salaryMax"));
  if (salaryMax && salaryMin > salaryMax) redirect(`/hr/requisitions/new?err=${encodeURIComponent("Minimum salary cannot be above the maximum.")}`);
  const id = mutate((d) => {
    const at = nowIso();
    const r: Requisition = {
      id: uid("r_"),
      code: nextCode(d, "REQ"),
      jdId: f("jdId") || undefined,
      title: f("title"),
      departmentId: f("departmentId"),
      branchId: f("branchId"),
      designationId: f("designationId"),
      gradeId: f("gradeId"),
      employmentTypeId: f("employmentTypeId"),
      headcount: Math.max(1, Math.round(num(form.get("headcount")))),
      filled: 0,
      kind: f("kind") === "replacement" ? "replacement" : "new",
      replacementFor: f("replacementFor") || undefined,
      budgetId: f("budgetId") || undefined,
      salaryMin,
      salaryMax,
      justification: f("justification"),
      targetStartDate: f("targetStartDate"),
      priority: (["low", "normal", "high", "urgent"].includes(f("priority")) ? f("priority") : "normal") as Requisition["priority"],
      status: submit ? "pending" : "draft",
      approvals: makeApprovals(d.settings.requisitionApprovalChain),
      hiringManagerId: f("hiringManagerId") || (user.role === "hiring" ? user.id : undefined),
      recruiterId: f("recruiterId") || undefined,
      createdBy: user.id,
      createdAt: at,
      updatedAt: at,
    };
    d.requisitions.push(r);
    audit(d, user, submit ? "requisition.submit" : "requisition.create", "requisition", r.id, `${r.code} ${r.title} ${submit ? "submitted for approval" : "saved as draft"}`, { after: r });
    if (submit) notify(d, { roles: ["hr", "admin"] }, `Requisition ${r.code} needs approval`, `${r.title} (${r.headcount}) raised by ${user.name}`, `/hr/requisitions/${r.id}`);
    return r.id;
  });
  redirect(`/hr/requisitions/${id}?msg=${submit ? "Submitted+for+approval." : "Saved+as+draft."}`);
}

export async function requisitionAction(form: FormData) {
  const user = await requireSection("/hr/requisitions");
  const id = String(form.get("id"));
  const op = String(form.get("op"));
  const comment = String(form.get("comment") ?? "").trim();
  const r0 = db().requisitions.find((r) => r.id === id);
  if (!r0) redirect("/hr/requisitions?err=Requisition+not+found.");
  const isHr = user.role === "admin" || user.role === "hr";
  let msg = "Updated.";
  let err = "";
  mutate((d) => {
    const r = d.requisitions.find((x) => x.id === id)!;
    const before = { status: r.status, approvals: structuredClone(r.approvals) };
    const owner = r.createdBy === user.id || r.hiringManagerId === user.id;
    switch (op) {
      case "submit":
        if (r.status !== "draft" && r.status !== "rejected") { err = "Only drafts can be submitted."; return; }
        if (!isHr && !owner) { err = "Only the requester or HR can submit."; return; }
        r.approvals = makeApprovals(d.settings.requisitionApprovalChain);
        r.status = "pending";
        msg = "Submitted for approval.";
        notify(d, { roles: ["hr", "admin"] }, `Requisition ${r.code} needs approval`, r.title, `/hr/requisitions/${r.id}`);
        break;
      case "approve":
      case "reject": {
        const step = currentStep(r.approvals);
        if (r.status !== "pending" || !step) { err = "Nothing is waiting for approval."; return; }
        const allowed = isHr || (user.role === "hiring" && step.label === "Department Head");
        if (!allowed) { err = `You cannot decide the "${step.label}" step.`; return; }
        if (op === "reject" && !comment) { err = "Please give a reason when rejecting."; return; }
        const outcome = decide(r.approvals, user, op === "approve" ? "approved" : "rejected", comment);
        if (outcome === "approved") r.status = "approved";
        if (outcome === "rejected") r.status = "rejected";
        msg = outcome === "pending" ? `Step "${step.label}" approved.` : outcome === "approved" ? "Requisition fully approved." : "Requisition rejected.";
        const target = r.hiringManagerId ?? r.createdBy;
        if (outcome !== "pending") notify(d, { userId: target }, `${r.code} ${outcome}`, `${r.title} was ${outcome}${comment ? `: ${comment}` : ""}`, `/hr/requisitions/${r.id}`);
        break;
      }
      case "hold":
        if (!isHr) { err = "Only HR can put on hold."; return; }
        r.status = "on_hold";
        msg = "Put on hold.";
        break;
      case "resume":
        if (!isHr) { err = "Only HR can resume."; return; }
        r.status = r.approvals.every((a) => a.status === "approved") ? "approved" : "pending";
        msg = "Resumed.";
        break;
      case "cancel":
        if (!isHr && !owner) { err = "Only the requester or HR can cancel."; return; }
        r.status = "cancelled";
        msg = "Requisition cancelled.";
        for (const p of d.postings) if (p.requisitionId === r.id && p.status === "open") p.status = "closed";
        break;
      default:
        err = "Unknown action.";
        return;
    }
    r.updatedAt = nowIso();
    audit(d, user, `requisition.${op}`, "requisition", r.id, `${r.code}: ${msg}${comment ? ` (${comment})` : ""}`, { before, after: { status: r.status, approvals: r.approvals } });
  });
  redirect(`/hr/requisitions/${id}?${err ? `err=${encodeURIComponent(err)}` : `msg=${encodeURIComponent(msg)}`}`);
}
