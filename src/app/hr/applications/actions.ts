"use server";
import { redirect } from "next/navigation";
import { requireHr, requireInternal } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { csv } from "@/lib/format";
import { canSeeApplication, moveStage, rejectApplication, requisitionOf, STAGE_LABEL } from "@/lib/hiring";
import { screen } from "@/lib/screening";
import { mutate, nowIso } from "@/lib/store";
import type { Stage } from "@/lib/types";
import { STAGES } from "@/lib/types";

function backTo(form: FormData, fallback: string) {
  const b = String(form.get("back") ?? "");
  return b.startsWith("/") && !b.startsWith("//") ? b : fallback;
}

function withMsg(url: string, key: "msg" | "err", text: string) {
  const clean = url.replace(/([?&])(msg|err)=[^&]*/g, "$1").replace(/[?&]+$/, "").replace(/\?&/, "?");
  return `${clean}${clean.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(text)}`;
}

export async function moveApplication(form: FormData) {
  const user = await requireInternal();
  const id = String(form.get("id"));
  const stage = String(form.get("stage")) as Stage;
  const back = backTo(form, `/hr/applications/${id}`);
  if (!STAGES.some((s) => s.key === stage)) redirect(withMsg(back, "err", "Unknown stage."));
  if (stage === "hired") redirect(withMsg(back, "err", "Candidates become 'Hired' automatically when they accept an offer."));
  const result = mutate((d) => {
    if (!canSeeApplication(d, user, id)) return "You do not have access to this application.";
    const app = d.applications.find((a) => a.id === id);
    if (!app) return "Application not found.";
    if (app.status === "hired") return "This candidate is already hired.";
    moveStage(d, app, stage, user, String(form.get("note") ?? "") || undefined);
    return null;
  });
  redirect(withMsg(back, result ? "err" : "msg", result ?? `Moved to ${STAGE_LABEL[stage]}.`));
}

export async function rejectApplicationAction(form: FormData) {
  const user = await requireInternal();
  const id = String(form.get("id"));
  const back = backTo(form, `/hr/applications/${id}`);
  const err = mutate((d) => {
    if (!canSeeApplication(d, user, id)) return "You do not have access to this application.";
    const app = d.applications.find((a) => a.id === id);
    if (!app) return "Application not found.";
    rejectApplication(d, app, user, String(form.get("reasonId") ?? ""), String(form.get("note") ?? ""));
    return null;
  });
  redirect(withMsg(back, err ? "err" : "msg", err ?? "Application declined. The candidate has been informed politely."));
}

export async function reopenApplication(form: FormData) {
  const user = await requireHr();
  const id = String(form.get("id"));
  const back = backTo(form, `/hr/applications/${id}`);
  mutate((d) => {
    const app = d.applications.find((a) => a.id === id);
    if (!app) return;
    app.status = "active";
    app.decision = undefined;
    app.rejectionReasonId = undefined;
    app.updatedAt = nowIso();
    audit(d, user, "application.reopen", "application", app.id, `${app.code} reopened`);
  });
  redirect(withMsg(back, "msg", "Application reopened."));
}

export async function addNote(form: FormData) {
  const user = await requireInternal();
  const id = String(form.get("id"));
  const text = String(form.get("text") ?? "").trim();
  const back = backTo(form, `/hr/applications/${id}`);
  if (!text) redirect(withMsg(back, "err", "Write a note first."));
  mutate((d) => {
    if (!canSeeApplication(d, user, id)) return;
    const app = d.applications.find((a) => a.id === id);
    if (!app) return;
    app.notes.push({ at: nowIso(), by: user.id, byName: user.name, text });
    audit(d, user, "application.note", "application", app.id, `Note added to ${app.code}`);
  });
  redirect(withMsg(back, "msg", "Note added."));
}

export async function setTags(form: FormData) {
  const user = await requireInternal();
  const id = String(form.get("id"));
  const back = backTo(form, `/hr/applications/${id}`);
  mutate((d) => {
    if (!canSeeApplication(d, user, id)) return;
    const app = d.applications.find((a) => a.id === id);
    if (!app) return;
    const before = app.tags;
    app.tags = [...new Set(csv(form.get("tags")).map((t) => t.toLowerCase()))].slice(0, 12);
    audit(d, user, "application.tags", "application", app.id, `Tags updated on ${app.code}`, { before, after: app.tags });
  });
  redirect(withMsg(back, "msg", "Tags saved."));
}

/** Bulk screening decision from the screening queue. */
export async function bulkDecision(form: FormData) {
  const user = await requireHr();
  const ids = form.getAll("ids").map(String);
  const decision = String(form.get("decision"));
  const back = backTo(form, "/hr/screening");
  if (ids.length === 0) redirect(withMsg(back, "err", "Select at least one candidate."));
  const reasonId = String(form.get("reasonId") ?? "");
  if (decision === "reject" && !reasonId) redirect(withMsg(back, "err", "Choose a rejection reason first."));
  const n = mutate((d) => {
    let count = 0;
    for (const id of ids) {
      const app = d.applications.find((a) => a.id === id);
      if (!app || app.status !== "active") continue;
      if (decision === "shortlist") {
        app.decision = "shortlist";
        app.decisionBy = user.id;
        moveStage(d, app, "shortlisted", user, "Shortlisted at CV screening");
      } else if (decision === "hold") {
        app.decision = "hold";
        app.decisionBy = user.id;
        if (app.stage === "applied") moveStage(d, app, "screening", user, "On hold at CV screening");
        else audit(d, user, "application.hold", "application", app.id, `${app.code} put on hold`);
      } else if (decision === "reject") {
        rejectApplication(d, app, user, reasonId, "Declined at CV screening");
      } else continue;
      count++;
    }
    return count;
  });
  const label = decision === "shortlist" ? "shortlisted" : decision === "hold" ? "put on hold" : "declined";
  redirect(withMsg(back, "msg", `${n} candidate${n === 1 ? "" : "s"} ${label}.`));
}

/** Re-run the rule-based screening for all applications of a posting (or one application). */
export async function rescreen(form: FormData) {
  const user = await requireHr();
  const postingId = String(form.get("postingId") ?? "");
  const appId = String(form.get("id") ?? "");
  const back = backTo(form, "/hr/screening");
  const n = mutate((d) => {
    let count = 0;
    for (const app of d.applications) {
      if (appId ? app.id !== appId : app.postingId !== postingId) continue;
      if (!appId && app.status !== "active") continue;
      const cand = d.candidates.find((c) => c.id === app.candidateId);
      const posting = d.postings.find((p) => p.id === app.postingId);
      if (!cand || !posting) continue;
      app.screening = screen(d, app, cand, posting);
      if (app.stage === "applied") moveStage(d, app, "screening", user, "Screened");
      count++;
    }
    audit(d, user, "screening.run", appId ? "application" : "posting", appId || postingId, `Screening re-run for ${count} application(s)`);
    return count;
  });
  redirect(withMsg(back, "msg", `Screening scores refreshed for ${n} application${n === 1 ? "" : "s"}.`));
}

/** Hiring manager review of a shortlisted candidate. */
export async function managerReview(form: FormData) {
  const user = await requireInternal();
  const id = String(form.get("id"));
  const verdict = String(form.get("verdict"));
  const comment = String(form.get("comment") ?? "").trim();
  const back = backTo(form, "/hr/shortlisting");
  const err = mutate((d) => {
    if (!canSeeApplication(d, user, id)) return "You do not have access to this application.";
    const app = d.applications.find((a) => a.id === id);
    if (!app) return "Application not found.";
    const text = `${verdict === "approve" ? "✅ Approved for interview" : "⛔ Not suitable"} by ${user.name}${comment ? `: ${comment}` : ""}`;
    app.notes.push({ at: nowIso(), by: user.id, byName: user.name, text });
    app.decisionNote = text;
    app.updatedAt = nowIso();
    if (verdict === "approve") {
      app.decision = "shortlist";
      app.tags = [...new Set([...app.tags, "manager-approved"])].filter((t) => t !== "manager-declined");
    } else {
      app.decision = "hold";
      app.tags = [...new Set([...app.tags, "manager-declined"])].filter((t) => t !== "manager-approved");
    }
    audit(d, user, "application.manager_review", "application", app.id, `${app.code}: ${text}`);
    const req = requisitionOf(d, app);
    if (req?.recruiterId && req.recruiterId !== user.id) {
      notify(d, { userId: req.recruiterId }, `Hiring manager review: ${app.code}`, text, `/hr/applications/${app.id}`);
    }
    return null;
  });
  redirect(withMsg(back, err ? "err" : "msg", err ?? "Review recorded. The recruiter has been notified."));
}
