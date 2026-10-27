import "server-only";
import type { Application, CandidateProfile, Db, Interview, Stage, User } from "@/lib/types";
import { STAGES } from "@/lib/types";
import { audit, notify } from "@/lib/audit";
import { nowIso } from "@/lib/store";

// Shared helpers for the hiring screens (pipeline, screening, shortlisting, interviews).

export const STAGE_LABEL: Record<Stage, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<Stage, string>;

export function stageIndex(stage: Stage) {
  return STAGES.findIndex((s) => s.key === stage);
}

/** Requisition behind an application (via its posting). */
export function requisitionOf(d: Db, app: Application) {
  const posting = d.postings.find((p) => p.id === app.postingId);
  return posting ? d.requisitions.find((r) => r.id === posting.requisitionId) : undefined;
}

/**
 * Applications a user may see. HR and admins see everything; the hiring team
 * sees applications for requisitions they manage or interviews they sit on.
 */
export function visibleApplications(d: Db, user: User): Application[] {
  if (user.role === "admin" || user.role === "hr") return d.applications;
  const myReqs = new Set(d.requisitions.filter((r) => r.hiringManagerId === user.id).map((r) => r.id));
  const myPostings = new Set(d.postings.filter((p) => myReqs.has(p.requisitionId)).map((p) => p.id));
  const panelApps = new Set(d.interviews.filter((i) => i.panel.includes(user.id)).map((i) => i.applicationId));
  return d.applications.filter((a) => myPostings.has(a.postingId) || panelApps.has(a.id));
}

export function canSeeApplication(d: Db, user: User, appId: string) {
  return visibleApplications(d, user).some((a) => a.id === appId);
}

/** Postings a user may filter by. */
export function visiblePostings(d: Db, user: User) {
  if (user.role === "admin" || user.role === "hr") return d.postings;
  const ids = new Set(visibleApplications(d, user).map((a) => a.postingId));
  const myReqs = new Set(d.requisitions.filter((r) => r.hiringManagerId === user.id).map((r) => r.id));
  return d.postings.filter((p) => ids.has(p.id) || myReqs.has(p.requisitionId));
}

/** Candidate name, or an anonymous label when blind screening is on (until interview). */
export function displayName(d: Db, cand: CandidateProfile | undefined, app: Application, forceBlind?: boolean) {
  const blind = forceBlind ?? (d.settings.blindScreening && stageIndex(app.stage) < stageIndex("interview"));
  if (blind || !cand) return `Candidate #${app.code.split("-").pop()}`;
  return cand.name;
}

export function isBlind(d: Db, app: Application) {
  return d.settings.blindScreening && stageIndex(app.stage) < stageIndex("interview");
}

export function daysInStage(app: Application) {
  const last = [...app.stageHistory].reverse().find((h) => h.stage === app.stage);
  const since = last?.at ?? app.updatedAt;
  return Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000));
}

const CANDIDATE_MESSAGE: Partial<Record<Stage, string>> = {
  screening: "Our recruitment team is reviewing your application.",
  shortlisted: "Good news: you have been shortlisted. We will be in touch about next steps.",
  interview: "You have been invited to an interview. Please check the details in your portal.",
  verification: "We are now completing reference and background checks.",
  offer: "We are preparing an offer for you.",
  hired: "Welcome to ABHI! Your onboarding journey is ready.",
};

/** Move an application to a stage (inside mutate). Records history, notifies, audits. */
export function moveStage(d: Db, app: Application, stage: Stage, actor: User, note?: string) {
  if (app.stage === stage && app.status === "active") return;
  const from = app.stage;
  app.stage = stage;
  if (app.status !== "active" && app.status !== "hired") app.status = "active";
  app.stageHistory.push({ stage, at: nowIso(), by: actor.id, note });
  app.updatedAt = nowIso();
  const cand = d.candidates.find((c) => c.id === app.candidateId);
  const posting = d.postings.find((p) => p.id === app.postingId);
  if (cand && CANDIDATE_MESSAGE[stage] && stageIndex(stage) > stageIndex(from)) {
    notify(d, { userId: cand.userId }, `Update on your application: ${posting?.title ?? ""}`, CANDIDATE_MESSAGE[stage]!, `/me/applications/${app.id}`);
  }
  audit(d, actor, "application.stage", "application", app.id, `${app.code} moved from ${STAGE_LABEL[from]} to ${STAGE_LABEL[stage]}`, {
    before: { stage: from },
    after: { stage, note },
  });
}

export function rejectApplication(d: Db, app: Application, actor: User, reasonId?: string, note?: string) {
  const before = { status: app.status, stage: app.stage };
  app.status = "rejected";
  app.decision = "reject";
  app.decisionBy = actor.id;
  app.decisionNote = note || undefined;
  app.rejectionReasonId = reasonId || undefined;
  app.updatedAt = nowIso();
  const cand = d.candidates.find((c) => c.id === app.candidateId);
  const posting = d.postings.find((p) => p.id === app.postingId);
  if (cand) {
    notify(
      d,
      { userId: cand.userId },
      `Update on your application: ${posting?.title ?? ""}`,
      "Thank you for your interest in ABHI. After careful review we will not be moving forward with your application this time. We encourage you to apply for future roles.",
      `/me/applications/${app.id}`,
    );
  }
  const reason = d.master.find((m) => m.id === reasonId)?.name;
  audit(d, actor, "application.reject", "application", app.id, `${app.code} rejected${reason ? `: ${reason}` : ""}`, {
    before,
    after: { status: "rejected", reason, note },
  });
}

export function overlaps(a: { start: string; durationMin: number }, b: { start: string; durationMin: number }) {
  const as = new Date(a.start).getTime();
  const ae = as + a.durationMin * 60_000;
  const bs = new Date(b.start).getTime();
  const be = bs + b.durationMin * 60_000;
  return as < be && bs < ae;
}

/** Interviews where any of the panel is already booked at that time. */
export function panelConflicts(d: Db, slot: { start: string; durationMin: number }, panel: string[], ignoreId?: string): Interview[] {
  return d.interviews.filter(
    (i) =>
      i.id !== ignoreId &&
      i.status === "scheduled" &&
      i.mode !== "recorded_video" &&
      i.panel.some((p) => panel.includes(p)) &&
      overlaps(i, slot),
  );
}

export const MODE_LABEL: Record<Interview["mode"], string> = {
  in_person: "In person",
  live_video: "Live video",
  recorded_video: "Recorded video",
};

export const MODE_STYLE: Record<Interview["mode"], string> = {
  in_person: "bg-amber-100 text-amber-900 border-amber-300",
  live_video: "bg-sky-100 text-sky-900 border-sky-300",
  recorded_video: "bg-violet-100 text-violet-900 border-violet-300",
};

export const RECOMMENDATION_LABEL = {
  strong_yes: "Strong hire",
  yes: "Hire",
  no: "No hire",
  strong_no: "Strong no hire",
} as const;

/** Parse a datetime-local value as Karachi time (UTC+5, no DST). */
export function karachiLocalToIso(value: string): string {
  if (!value) return "";
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return new Date(`${withSeconds}+05:00`).toISOString();
}

/** ISO -> "YYYY-MM-DDTHH:mm" in Karachi time, for datetime-local inputs. */
export function isoToKarachiLocal(iso: string): string {
  const t = new Date(new Date(iso).getTime() + 5 * 3600_000);
  return t.toISOString().slice(0, 16);
}

/** Karachi calendar date (YYYY-MM-DD) of an ISO timestamp. */
export function karachiDate(iso: string) {
  return isoToKarachiLocal(iso).slice(0, 10);
}

/** Current time in ms. Server components render once per request, so reading the clock is safe. */
export function nowMs() {
  return Date.now();
}
