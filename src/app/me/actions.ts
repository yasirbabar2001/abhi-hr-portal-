"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { saveUpload } from "@/lib/files";
import { csv } from "@/lib/format";
import { db, mutate, nowIso } from "@/lib/store";

export async function withdrawApplication(form: FormData) {
  const user = await requireUser(["candidate"]);
  const id = String(form.get("id"));
  const reason = String(form.get("reason") ?? "").trim();
  const cand = db().candidates.find((c) => c.userId === user.id);
  const app = db().applications.find((a) => a.id === id && a.candidateId === cand?.id);
  if (!app) redirect("/me?err=Application+not+found.");
  if (app.status !== "active" || app.stage === "hired") redirect(`/me/applications/${id}?err=This+application+can+no+longer+be+withdrawn.`);
  mutate((d) => {
    const a = d.applications.find((x) => x.id === id)!;
    a.status = "withdrawn";
    a.decisionNote = reason ? `Withdrawn by candidate: ${reason}` : "Withdrawn by candidate";
    a.rejectionReasonId = d.master.find((m) => m.type === "rejection_reason" && m.code === "WD")?.id;
    a.updatedAt = nowIso();
    const posting = d.postings.find((p) => p.id === a.postingId);
    audit(d, user, "application.withdraw", "application", a.id, `${user.name} withdrew ${a.code}${reason ? `: ${reason}` : ""}`);
    notify(d, { roles: ["hr"] }, "Application withdrawn", `${user.name} withdrew from ${posting?.title ?? "a job"}`, `/hr/applications/${a.id}`);
  });
  redirect(`/me/applications/${id}?msg=Your+application+has+been+withdrawn.`);
}

export async function saveProfile(form: FormData) {
  const user = await requireUser(["candidate"]);
  const f = (k: string) => String(form.get(k) ?? "").trim();
  if (f("cnic") && !/^\d{5}-?\d{7}-?\d$/.test(f("cnic"))) redirect("/me/profile?err=CNIC+should+look+like+12345-1234567-1.");
  if (!f("name")) redirect("/me/profile?err=Name+is+required.");
  const cv = form.get("cv");
  let cvFileId: string | undefined;
  if (cv && typeof cv !== "string" && cv.size > 0) {
    if (!/\.(pdf|docx?|rtf)$/i.test(cv.name)) redirect("/me/profile?err=CV+must+be+PDF+or+Word.");
    if (cv.size > 10 * 1024 * 1024) redirect("/me/profile?err=CV+must+be+smaller+than+10+MB.");
    cvFileId = (await saveUpload(cv, user.id, "private"))?.id;
  }
  mutate((d) => {
    const c = d.candidates.find((x) => x.userId === user.id);
    if (!c) return;
    Object.assign(c, {
      name: f("name"),
      phone: f("phone"),
      cnic: f("cnic").replace(/^(\d{5})-?(\d{7})-?(\d)$/, "$1-$2-$3"),
      city: f("city"),
      currentTitle: f("currentTitle"),
      currentEmployer: f("currentEmployer"),
      totalExperienceYears: Math.max(0, Number(f("experience")) || 0),
      qualificationId: f("qualificationId") || undefined,
      institution: f("institution") || undefined,
      skills: csv(form.get("skills")),
      linkedin: f("linkedin") || undefined,
      talentPool: !!form.get("talentPool"),
      updatedAt: nowIso(),
      ...(cvFileId ? { cvFileId } : {}),
    });
    const u = d.users.find((x) => x.id === user.id)!;
    u.name = c.name;
    u.phone = c.phone;
    audit(d, user, "candidate.profile_update", "candidate", c.id, `${c.name} updated their profile${cvFileId ? " and CV" : ""}`);
  });
  redirect("/me/profile?msg=Profile+saved.");
}

export async function requestDeletion() {
  const user = await requireUser(["candidate"]);
  mutate((d) => {
    notify(d, { roles: ["admin"] }, "Data deletion request", `${user.name} (${user.email}) asked for their account and data to be deleted.`, `/admin/users?q=${encodeURIComponent(user.email)}`);
    audit(d, user, "candidate.deletion_request", "user", user.id, `${user.name} requested deletion of their data`);
  });
  redirect("/me/profile?msg=Your+request+has+been+sent.+We+will+confirm+by+email+within+30+days.");
}

export async function markAllRead() {
  const user = await requireUser();
  mutate((d) => {
    for (const n of d.notifications) if (n.userId === user.id) n.read = true;
  });
  redirect("/me/notifications?msg=All+caught+up.");
}

export async function openNotification(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("id"));
  let href = "/me/notifications";
  mutate((d) => {
    const n = d.notifications.find((x) => x.id === id && x.userId === user.id);
    if (n) {
      n.read = true;
      if (n.href?.startsWith("/")) href = n.href;
    }
  });
  redirect(href);
}
