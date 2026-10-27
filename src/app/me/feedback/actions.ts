"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db, mutate, nowIso, uid } from "@/lib/store";
import { TOUCHPOINTS } from "@/lib/analytics/metrics";
import type { Touchpoint } from "@/lib/types";

export async function submitFeedback(form: FormData) {
  const user = await requireUser(["candidate"]);
  const touchpoint = String(form.get("touchpoint") ?? "") as Touchpoint;
  const applicationId = String(form.get("application") ?? "") || undefined;
  const back = `/me/feedback?touchpoint=${touchpoint}${applicationId ? `&application=${applicationId}` : ""}`;
  if (!TOUCHPOINTS.some((t) => t.key === touchpoint)) redirect("/me");
  const d = db();
  const cand = d.candidates.find((c) => c.userId === user.id);
  // Only the candidate's own application may be referenced.
  if (applicationId && !d.applications.some((a) => a.id === applicationId && a.candidateId === cand?.id)) redirect("/me");
  const npsVal = Number(form.get("nps"));
  const csat = Number(form.get("csat"));
  const ease = Number(form.get("ease"));
  if (!(npsVal >= 0 && npsVal <= 10) || !(csat >= 1 && csat <= 5) || !(ease >= 1 && ease <= 5) || form.get("nps") === null || form.get("csat") === null || form.get("ease") === null)
    redirect(`${back}&err=${encodeURIComponent("Please answer all three questions.")}`);
  const hire = d.hires.find((h) => h.userId === user.id);
  mutate((db2) => {
    const existing = db2.surveys.find((s) => s.userId === user.id && s.touchpoint === touchpoint && (s.applicationId ?? "") === (applicationId ?? ""));
    if (existing) return;
    const id = uid("sv_");
    db2.surveys.push({
      id,
      touchpoint,
      applicationId,
      hireId: touchpoint === "orientation" || touchpoint === "onboarding" ? hire?.id : undefined,
      userId: user.id,
      nps: npsVal,
      csat,
      ease,
      comments: String(form.get("comments") ?? "").trim().slice(0, 2000) || undefined,
      at: nowIso(),
    });
    audit(db2, user, "survey.submit", "survey", id, `${user.name} shared ${touchpoint} feedback`);
  });
  redirect(`${back}&done=1`);
}
