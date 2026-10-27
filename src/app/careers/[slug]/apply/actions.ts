"use server";
import { redirect } from "next/navigation";
import { clientIp, requireUser } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { saveUpload } from "@/lib/files";
import { csv } from "@/lib/format";
import { isPublic } from "@/lib/careers";
import { screen } from "@/lib/screening";
import { db, mutate, nextCode, nowIso, uid } from "@/lib/store";
import type { Application } from "@/lib/types";

const CV_TYPES = /\.(pdf|docx?|rtf)$/i;

export async function apply(form: FormData) {
  const user = await requireUser(["candidate"]);
  const postingId = String(form.get("postingId"));
  const d0 = db();
  const posting = d0.postings.find((p) => p.id === postingId);
  if (!posting || !isPublic(posting)) redirect("/careers?err=This+job+is+no+longer+open.");
  const back = (m: string) => redirect(`/careers/${posting.slug}/apply?err=${encodeURIComponent(m)}`);
  const cand0 = d0.candidates.find((c) => c.userId === user.id);
  if (!cand0) back("Your candidate profile is missing. Please contact us.");
  const dup = d0.applications.find((a) => a.postingId === postingId && a.candidateId === cand0!.id && a.status !== "withdrawn");
  if (dup) redirect(`/me/applications/${dup.id}?msg=You+have+already+applied+for+this+job.`);
  if (!form.get("consent")) back("Please confirm the declaration and consent.");
  const f = (k: string) => String(form.get(k) ?? "").trim();
  if (!f("phone") || !f("city") || !f("cnic")) back("Mobile number, CNIC and city are required.");
  if (!/^\d{5}-?\d{7}-?\d$/.test(f("cnic"))) back("CNIC should look like 12345-1234567-1.");
  const answers: Record<string, "yes" | "no"> = {};
  for (const q of posting.knockoutQuestions) {
    const a = f(`ko_${q.id}`);
    if (a !== "yes" && a !== "no") back("Please answer every screening question.");
    answers[q.id] = a as "yes" | "no";
  }
  const cvInput = form.get("cv");
  let cvFileId = cand0!.cvFileId;
  if (cvInput && typeof cvInput !== "string" && cvInput.size > 0) {
    if (!CV_TYPES.test(cvInput.name)) back("Please upload your CV as PDF or Word (.doc, .docx).");
    if (cvInput.size > 10 * 1024 * 1024) back("CV must be smaller than 10 MB.");
    cvFileId = (await saveUpload(cvInput, user.id, "private"))!.id;
  }
  if (!cvFileId) back("Please upload your CV.");
  const ip = await clientIp();
  const appId = mutate((d) => {
    const cand = d.candidates.find((c) => c.id === cand0!.id)!;
    const cnic = f("cnic").replace(/^(\d{5})-?(\d{7})-?(\d)$/, "$1-$2-$3");
    Object.assign(cand, {
      phone: f("phone"),
      cnic,
      city: f("city"),
      currentTitle: f("currentTitle"),
      currentEmployer: f("currentEmployer"),
      totalExperienceYears: Math.max(0, Number(f("experience")) || 0),
      qualificationId: f("qualificationId") || cand.qualificationId,
      institution: f("institution") || cand.institution,
      skills: csv(form.get("skills")),
      linkedin: f("linkedin") || cand.linkedin,
      cvFileId,
      updatedAt: nowIso(),
    });
    const at = nowIso();
    const app: Application = {
      id: uid("a_"),
      code: nextCode(d, "APP", 5),
      postingId,
      candidateId: cand.id,
      stage: "applied",
      status: "active",
      sourceId: f("sourceId") || undefined,
      knockoutAnswers: answers,
      coverNote: f("coverNote") || undefined,
      expectedSalary: Number(f("expectedSalary")) || undefined,
      noticePeriodDays: Number(f("noticePeriodDays")) || 0,
      stageHistory: [{ stage: "applied", at, by: user.id }],
      tags: [],
      notes: [],
      consentAt: at,
      createdAt: at,
      updatedAt: at,
    };
    app.screening = screen(d, app, cand, posting);
    if (!app.screening.knockoutPassed && d.settings.autoRejectKnockout) {
      app.status = "rejected";
      app.decision = "reject";
      app.decisionNote = "Automatically declined: a required screening answer was not met.";
      app.rejectionReasonId = d.master.find((m) => m.type === "rejection_reason" && m.code === "KO")?.id;
    }
    d.applications.push(app);
    audit(d, user, "application.create", "application", app.id, `${user.name} applied for ${posting.title} (${app.code}), match ${app.screening.score}%`, { ip });
    notify(d, { roles: ["hr"] }, `New application: ${posting.title}`, `${cand.name} · match ${app.screening.score}%${app.screening.knockoutPassed ? "" : " · knock-out not met"}`, `/hr/applications/${app.id}`);
    notify(d, { userId: user.id }, "Application received", `Thank you for applying for ${posting.title}. Reference ${app.code}.`, `/me/applications/${app.id}`);
    return app.id;
  });
  redirect(`/me/applications/${appId}?msg=${encodeURIComponent("Thank you! Your application has been received. We'll keep you updated here and by email.")}`);
}
