import type { Db, User } from "../types";
import { currentStep } from "../approvals";

export interface AttentionItem {
  kind: string;
  title: string;
  detail: string;
  href: string;
  urgent?: boolean;
}

/** Steps a hiring-team member can act on; everything else is for HR/admin. */
const MANAGER_STEPS = /department head|line manager|hiring manager/i;

function canActOn(user: User, label: string, isOwnManager: boolean) {
  if (MANAGER_STEPS.test(label)) return user.role === "admin" || (user.role === "hiring" && isOwnManager) || user.role === "hr";
  return user.role === "admin" || user.role === "hr";
}

export function attentionFor(d: Db, user: User, now = Date.now()): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const r of d.requisitions.filter((x) => x.status === "pending")) {
    const step = currentStep(r.approvals);
    if (step && canActOn(user, step.label, r.hiringManagerId === user.id))
      items.push({ kind: "Requisition", title: `${r.code} · ${r.title}`, detail: `Waiting for ${step.label} approval`, href: `/hr/requisitions/${r.id}`, urgent: r.priority === "urgent" });
  }
  for (const o of d.offers.filter((x) => x.status === "pending_approval")) {
    const step = currentStep(o.approvals);
    if (step && canActOn(user, step.label, false))
      items.push({ kind: "Offer", title: o.code, detail: `Waiting for ${step.label} approval`, href: `/hr/offers/${o.id}` });
  }
  for (const s of d.statusChanges.filter((x) => x.status === "pending")) {
    const step = currentStep(s.approvals);
    const emp = d.employees.find((e) => e.id === s.employeeId);
    const isMgr = s.requestedBy === user.id || d.users.find((u) => u.id === user.id)?.departmentId === emp?.departmentId;
    if (step && canActOn(user, step.label, !!isMgr))
      items.push({ kind: "Status change", title: `${s.code} · ${emp?.name ?? "Employee"}`, detail: `${s.type.replace(/_/g, " ")} waiting for ${step.label}`, href: `/hr/status-changes/${s.id}` });
  }
  for (const iv of d.interviews.filter((x) => x.panel.includes(user.id) && (x.status === "completed" || (x.status === "scheduled" && new Date(x.start).getTime() + x.durationMin * 60_000 < now)))) {
    if (iv.mode === "recorded_video" && !(iv.recordings?.length)) continue;
    if (!d.scorecards.some((s) => s.interviewId === iv.id && s.interviewerId === user.id)) {
      const app = d.applications.find((a) => a.id === iv.applicationId);
      const cand = d.candidates.find((c) => c.id === app?.candidateId);
      items.push({ kind: "Scorecard", title: `${cand?.name ?? "Candidate"} · ${iv.title}`, detail: "Your scorecard is not submitted yet", href: `/hr/interviews/${iv.id}`, urgent: true });
    }
  }
  if (user.role !== "hiring") {
    for (const h of d.hires) {
      const overdue = h.tasks.filter((t) => !t.done && new Date(t.dueDate).getTime() < now - 86_400_000);
      if (overdue.length)
        items.push({ kind: "Onboarding", title: h.name, detail: `${overdue.length} overdue onboarding task${overdue.length > 1 ? "s" : ""}`, href: `/hr/onboarding/${h.id}`, urgent: true });
    }
    for (const r of d.references.filter((x) => x.status === "requested" && now - new Date(x.requestedAt).getTime() > 5 * 86_400_000)) {
      const app = d.applications.find((a) => a.id === r.applicationId);
      const cand = d.candidates.find((c) => c.id === app?.candidateId);
      items.push({ kind: "Reference", title: `${cand?.name ?? "Candidate"} · ${r.refereeName}`, detail: "Reference requested more than 5 days ago", href: `/hr/verification/${r.applicationId}` });
    }
    for (const e of d.ecib.filter((x) => x.status === "submitted" || x.status === "pending")) {
      const app = d.applications.find((a) => a.id === e.applicationId);
      const cand = d.candidates.find((c) => c.id === app?.candidateId);
      items.push({ kind: "eCIB", title: cand?.name ?? "Candidate", detail: "eCIB result to record", href: `/hr/verification/${e.applicationId}` });
    }
  } else {
    for (const h of d.hires.filter((x) => x.managerId === user.id)) {
      const overdue = h.tasks.filter((t) => !t.done && t.owner === "manager" && new Date(t.dueDate).getTime() < now);
      if (overdue.length) items.push({ kind: "Onboarding", title: h.name, detail: `${overdue.length} manager task(s) due`, href: `/hr/onboarding/${h.id}` });
    }
  }
  return items.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent));
}
