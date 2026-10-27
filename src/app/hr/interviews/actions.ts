"use server";
import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { requireInternal } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { fmtDateTime } from "@/lib/format";
import { canSeeApplication, karachiLocalToIso, MODE_LABEL, moveStage, panelConflicts, stageIndex } from "@/lib/hiring";
import { mutate, nowIso, uid } from "@/lib/store";
import type { Interview, InterviewMode, Recommendation, RecordedQuestion } from "@/lib/types";

const err = (path: string, text: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(text)}`);

export async function createInterview(form: FormData) {
  const user = await requireInternal();
  const applicationId = String(form.get("applicationId") ?? "");
  const back = `/hr/interviews/new?application=${applicationId}`;
  const mode = String(form.get("mode")) as InterviewMode;
  if (!["in_person", "live_video", "recorded_video"].includes(mode)) err(back, "Choose how the interview will happen.");
  const start = karachiLocalToIso(String(form.get("start") ?? ""));
  if (!start || Number.isNaN(new Date(start).getTime())) err(back, mode === "recorded_video" ? "Set a deadline for the video interview." : "Choose a date and time.");
  if (new Date(start).getTime() < Date.now() - 5 * 60_000) err(back, "The date and time must be in the future.");
  const durationMin = Math.max(10, Math.min(480, Number(form.get("durationMin") ?? 45) || 45));
  const panel = [...new Set(form.getAll("panel").map(String))];
  if (panel.length === 0) err(back, "Add at least one interviewer to the panel.");
  const location = String(form.get("location") ?? "").trim();
  if (mode === "in_person" && !location) err(back, "Add the interview location.");
  let meetingUrl = String(form.get("meetingUrl") ?? "").trim();
  if (meetingUrl && !/^https:\/\//i.test(meetingUrl)) err(back, "Meeting links must start with https://");
  if (mode === "live_video" && !meetingUrl) meetingUrl = `https://meet.jit.si/abhi-${crypto.randomBytes(6).toString("hex")}`;

  let recordedQuestions: RecordedQuestion[] | undefined;
  if (mode === "recorded_video") {
    const qs = form.getAll("q_question").map(String);
    const thinks = form.getAll("q_think").map(Number);
    const maxes = form.getAll("q_max").map(Number);
    recordedQuestions = qs
      .map((q, i) => ({
        id: uid("rq_"),
        question: q.trim(),
        thinkSeconds: Math.max(0, Math.min(300, thinks[i] || 30)),
        maxSeconds: Math.max(15, Math.min(600, maxes[i] || 120)),
      }))
      .filter((q) => q.question);
    if (recordedQuestions.length === 0) err(back, "Add at least one question for the video interview.");
  }

  const result = mutate((d) => {
    if (!canSeeApplication(d, user, applicationId)) return { error: "You do not have access to this application." };
    const app = d.applications.find((a) => a.id === applicationId);
    if (!app || app.status !== "active") return { error: "This application is not active." };
    const validPanel = panel.filter((p) => d.users.some((u) => u.id === p && u.active && u.role !== "candidate"));
    if (mode !== "recorded_video" && !form.get("allowConflict")) {
      const clashes = panelConflicts(d, { start, durationMin }, validPanel);
      if (clashes.length) {
        return { error: `Panel clash: ${clashes.length} interviewer booking(s) overlap this time. Pick another slot or tick “Schedule anyway”.` };
      }
    }
    const round = d.interviews.filter((i) => i.applicationId === app.id && i.status !== "cancelled").length + 1;
    const iv: Interview = {
      id: uid("i_"),
      applicationId: app.id,
      round,
      title: String(form.get("title") ?? "").trim() || (mode === "recorded_video" ? "One-way video interview" : `Interview round ${round}`),
      mode,
      start,
      durationMin,
      location: mode === "in_person" ? location : undefined,
      meetingUrl: mode === "live_video" ? meetingUrl : undefined,
      panel: validPanel,
      status: "scheduled",
      candidateConfirmed: false,
      recordedQuestions,
      recordings: [],
      instructions: String(form.get("instructions") ?? "").trim() || undefined,
      createdBy: user.id,
      createdAt: nowIso(),
    };
    d.interviews.push(iv);
    if (stageIndex(app.stage) < stageIndex("interview")) moveStage(d, app, "interview", user, `${MODE_LABEL[mode]} scheduled`);
    const cand = d.candidates.find((c) => c.id === app.candidateId);
    const posting = d.postings.find((p) => p.id === app.postingId);
    if (cand) {
      notify(
        d,
        { userId: cand.userId },
        mode === "recorded_video" ? "Your video interview is ready" : "Interview invitation",
        mode === "recorded_video"
          ? `Please record your answers for ${posting?.title ?? "the role"} before ${fmtDateTime(start)}.`
          : `${MODE_LABEL[mode]} interview for ${posting?.title ?? "the role"} on ${fmtDateTime(start)}. Please confirm your attendance.`,
        `/me/interviews/${iv.id}`,
      );
    }
    for (const p of validPanel) {
      if (p === user.id) continue;
      notify(d, { userId: p }, "You are on an interview panel", `${posting?.title ?? ""}: ${MODE_LABEL[mode]} on ${fmtDateTime(start)}`, `/hr/interviews/${iv.id}`);
    }
    audit(d, user, "interview.create", "interview", iv.id, `${MODE_LABEL[mode]} interview scheduled for ${app.code} on ${fmtDateTime(start)}`, { after: iv });
    return { id: iv.id };
  });
  if ("error" in result) err(back, result.error!);
  redirect(`/hr/interviews/${result.id}?msg=${encodeURIComponent("Interview scheduled. The candidate and panel have been notified.")}`);
}

export async function rescheduleInterview(form: FormData) {
  const user = await requireInternal();
  const id = String(form.get("id"));
  const back = `/hr/interviews/${id}`;
  const start = karachiLocalToIso(String(form.get("start") ?? ""));
  if (!start) err(back, "Choose a new date and time.");
  const durationMin = Math.max(10, Number(form.get("durationMin") ?? 45) || 45);
  const res = mutate((d) => {
    const iv = d.interviews.find((i) => i.id === id);
    if (!iv || !canSeeApplication(d, user, iv.applicationId)) return "Interview not found.";
    if (iv.mode !== "recorded_video" && !form.get("allowConflict")) {
      const clashes = panelConflicts(d, { start, durationMin }, iv.panel, iv.id);
      if (clashes.length) return "That time clashes with another interview for the panel. Tick “Ignore clash” to keep it anyway.";
    }
    const before = { start: iv.start, durationMin: iv.durationMin };
    iv.start = start;
    iv.durationMin = durationMin;
    iv.status = "scheduled";
    iv.candidateConfirmed = false;
    const app = d.applications.find((a) => a.id === iv.applicationId);
    const cand = app && d.candidates.find((c) => c.id === app.candidateId);
    if (cand) notify(d, { userId: cand.userId }, "Interview rescheduled", `Your interview is now on ${fmtDateTime(start)}. Please confirm.`, `/me/interviews/${iv.id}`);
    for (const p of iv.panel) if (p !== user.id) notify(d, { userId: p }, "Interview rescheduled", `Now on ${fmtDateTime(start)}`, `/hr/interviews/${iv.id}`);
    audit(d, user, "interview.reschedule", "interview", iv.id, `Interview rescheduled to ${fmtDateTime(start)}`, { before, after: { start, durationMin } });
    return null;
  });
  if (res) err(back, res);
  redirect(`${back}?msg=Rescheduled.+Everyone+has+been+notified.`);
}

export async function setInterviewStatus(form: FormData) {
  const user = await requireInternal();
  const id = String(form.get("id"));
  const status = String(form.get("status")) as Interview["status"];
  if (!["completed", "cancelled", "no_show", "scheduled"].includes(status)) err(`/hr/interviews/${id}`, "Unknown status.");
  mutate((d) => {
    const iv = d.interviews.find((i) => i.id === id);
    if (!iv || !canSeeApplication(d, user, iv.applicationId)) return;
    const before = iv.status;
    iv.status = status;
    if (status === "cancelled") {
      const app = d.applications.find((a) => a.id === iv.applicationId);
      const cand = app && d.candidates.find((c) => c.id === app.candidateId);
      if (cand) notify(d, { userId: cand.userId }, "Interview cancelled", `Your interview on ${fmtDateTime(iv.start)} has been cancelled. We will contact you about next steps.`, `/me/interviews/${iv.id}`);
    }
    audit(d, user, "interview.status", "interview", iv.id, `Interview marked ${status.replace("_", " ")}`, { before: { status: before }, after: { status } });
  });
  redirect(`/hr/interviews/${id}?msg=Interview+updated.`);
}

export async function submitScorecard(form: FormData) {
  const user = await requireInternal();
  const id = String(form.get("interviewId"));
  const back = `/hr/interviews/${id}`;
  const competencies = form.getAll("competency").map(String);
  const ratings = competencies.map((c, i) => ({
    competency: c,
    score: Number(form.get(`score_${i}`) ?? 0),
    note: String(form.get(`note_${i}`) ?? "").trim() || undefined,
  }));
  if (ratings.some((r) => !(r.score >= 1 && r.score <= 5))) err(back, "Rate every competency from 1 to 5.");
  const overall = Number(form.get("overall"));
  if (!(overall >= 1 && overall <= 5)) err(back, "Give an overall rating.");
  const recommendation = String(form.get("recommendation")) as Recommendation;
  if (!["strong_yes", "yes", "no", "strong_no"].includes(recommendation)) err(back, "Choose a recommendation.");
  const res = mutate((d) => {
    const iv = d.interviews.find((i) => i.id === id);
    if (!iv) return "Interview not found.";
    if (!iv.panel.includes(user.id) && user.role === "hiring") return "Only panel members can submit a scorecard.";
    if (d.scorecards.some((s) => s.interviewId === id && s.interviewerId === user.id)) return "You have already submitted a scorecard for this interview.";
    d.scorecards.push({
      id: uid("s_"),
      interviewId: id,
      applicationId: iv.applicationId,
      interviewerId: user.id,
      ratings,
      overall,
      recommendation,
      strengths: String(form.get("strengths") ?? "").trim(),
      concerns: String(form.get("concerns") ?? "").trim(),
      submittedAt: nowIso(),
    });
    if (!iv.panel.includes(user.id)) iv.panel.push(user.id);
    if (iv.status === "scheduled" && new Date(iv.start).getTime() < Date.now()) iv.status = "completed";
    const app = d.applications.find((a) => a.id === iv.applicationId);
    audit(d, user, "scorecard.submit", "interview", id, `Scorecard submitted for ${app?.code ?? "application"} (${recommendation.replace("_", " ")})`);
    const others = iv.panel.filter((p) => p !== user.id);
    const allIn = others.every((p) => d.scorecards.some((s) => s.interviewId === id && s.interviewerId === p));
    if (allIn) {
      const posting = app && d.postings.find((p) => p.id === app.postingId);
      const req = posting && d.requisitions.find((r) => r.id === posting.requisitionId);
      if (req?.recruiterId) notify(d, { userId: req.recruiterId }, "All scorecards are in", `${app?.code}: the panel has finished scoring.`, `/hr/interviews/${id}`);
    }
    return null;
  });
  if (res) err(back, res);
  redirect(`${back}?msg=Scorecard+submitted.+You+can+now+see+the+rest+of+the+panel%27s+feedback.`);
}
