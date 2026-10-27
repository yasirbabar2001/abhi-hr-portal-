"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { requisitionOf } from "@/lib/hiring";
import { mutate } from "@/lib/store";
import type { Db, Interview, User } from "@/lib/types";

function ownInterview(d: Db, user: User, id: string): Interview | undefined {
  const iv = d.interviews.find((i) => i.id === id);
  const app = iv && d.applications.find((a) => a.id === iv.applicationId);
  const cand = app && d.candidates.find((c) => c.id === app.candidateId);
  return cand?.userId === user.id ? iv : undefined;
}

function hrRecipients(d: Db, iv: Interview) {
  const app = d.applications.find((a) => a.id === iv.applicationId)!;
  const req = requisitionOf(d, app);
  return [...new Set([req?.recruiterId, iv.createdBy].filter(Boolean) as string[])];
}

export async function confirmAttendance(form: FormData) {
  const user = await requireUser(["candidate"]);
  const id = String(form.get("id"));
  mutate((d) => {
    const iv = ownInterview(d, user, id);
    if (!iv || iv.status !== "scheduled") return;
    iv.candidateConfirmed = true;
    for (const u of hrRecipients(d, iv)) notify(d, { userId: u }, "Candidate confirmed interview", `${user.name} confirmed attendance.`, `/hr/interviews/${iv.id}`);
    audit(d, user, "interview.confirm", "interview", iv.id, `${user.name} confirmed attendance`);
  });
  redirect(`/me/interviews/${id}?msg=Thank+you!+Your+attendance+is+confirmed.`);
}

export async function requestReschedule(form: FormData) {
  const user = await requireUser(["candidate"]);
  const id = String(form.get("id"));
  const reason = String(form.get("reason") ?? "").trim();
  const times = String(form.get("times") ?? "").trim();
  if (!reason) redirect(`/me/interviews/${id}?err=Please+tell+us+briefly+why.`);
  mutate((d) => {
    const iv = ownInterview(d, user, id);
    if (!iv || iv.status !== "scheduled") return;
    iv.candidateConfirmed = false;
    const app = d.applications.find((a) => a.id === iv.applicationId)!;
    app.notes.push({ at: new Date().toISOString(), by: user.id, byName: user.name, text: `📅 Reschedule requested: ${reason}${times ? ` · Suggested times: ${times}` : ""}` });
    for (const u of hrRecipients(d, iv)) notify(d, { userId: u }, "Reschedule requested", `${user.name}: ${reason}`, `/hr/interviews/${iv.id}`);
    audit(d, user, "interview.reschedule_request", "interview", iv.id, `${user.name} asked to reschedule`);
  });
  redirect(`/me/interviews/${id}?msg=Request+sent.+The+recruitment+team+will+contact+you+with+a+new+time.`);
}
