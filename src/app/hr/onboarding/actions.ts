"use server";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { db, mutate, nowIso, uid } from "@/lib/store";
import type { Hire, OnboardingPhase, OnboardingTask, User } from "@/lib/types";
import { ONBOARDING_PHASES } from "@/lib/types";

async function load(hireId: string) {
  const user = await requireSection("/hr/onboarding");
  const hire = db().hires.find((h) => h.id === hireId);
  if (!hire) redirect("/hr/onboarding?err=Journey+not+found.");
  if (user.role === "hiring" && hire.managerId !== user.id) redirect("/hr/onboarding?err=You+can+only+update+your+own+team's+journeys.");
  return { user, hire };
}

const back = (hireId: string, msg: string, key = "msg") => redirect(`/hr/onboarding/${hireId}?${key}=${encodeURIComponent(msg)}`);

function canTick(user: User, t: OnboardingTask) {
  return user.role !== "hiring" || t.owner === "manager";
}

export async function toggleTask(form: FormData) {
  const hireId = String(form.get("hireId"));
  const { user, hire } = await load(hireId);
  const taskId = String(form.get("taskId"));
  const t = hire.tasks.find((x) => x.id === taskId);
  if (!t) back(hireId, "Task not found.", "err");
  if (!canTick(user, t!)) back(hireId, "Only HR can update this task.", "err");
  mutate((d) => {
    const task = d.hires.find((h) => h.id === hireId)!.tasks.find((x) => x.id === taskId)!;
    task.done = !task.done;
    task.doneAt = task.done ? nowIso() : undefined;
    task.doneBy = task.done ? user.id : undefined;
    audit(d, user, task.done ? "onboarding.task_done" : "onboarding.task_reopen", "hire", hireId, `${task.done ? "Completed" : "Reopened"} “${task.title}” for ${hire.name}`);
  });
  back(hireId, "Task updated.");
}

export async function updateDue(form: FormData) {
  const hireId = String(form.get("hireId"));
  const { user, hire } = await load(hireId);
  const taskId = String(form.get("taskId"));
  const due = String(form.get("dueDate") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) back(hireId, "Please choose a valid date.", "err");
  mutate((d) => {
    const task = d.hires.find((h) => h.id === hireId)!.tasks.find((x) => x.id === taskId);
    if (!task) return;
    const before = task.dueDate;
    task.dueDate = due;
    audit(d, user, "onboarding.task_reschedule", "hire", hireId, `Moved “${task.title}” for ${hire.name} from ${before} to ${due}`);
  });
  back(hireId, "Due date updated.");
}

export async function addTask(form: FormData) {
  const hireId = String(form.get("hireId"));
  const { user, hire } = await load(hireId);
  const title = String(form.get("title") ?? "").trim();
  const phase = String(form.get("phase")) as OnboardingPhase;
  const owner = String(form.get("owner")) as OnboardingTask["owner"];
  const dueDate = String(form.get("dueDate") ?? "");
  const documentTypeId = String(form.get("documentTypeId") ?? "") || undefined;
  if (!title) back(hireId, "Please describe the task.", "err");
  if (!ONBOARDING_PHASES.some((p) => p.key === phase)) back(hireId, "Please choose a phase.", "err");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) back(hireId, "Please choose a due date.", "err");
  mutate((d) => {
    const h = d.hires.find((x) => x.id === hireId)!;
    h.tasks.push({ id: uid("t_"), title, phase, owner, dueDate, done: false, documentTypeId: owner === "new_hire" ? documentTypeId : undefined });
    audit(d, user, "onboarding.task_add", "hire", hireId, `Added task “${title}” to ${hire.name}'s journey`);
    if (owner === "new_hire") notify(d, { userId: h.userId }, "New onboarding task", title, "/me/onboarding");
  });
  back(hireId, "Task added.");
}

export async function assignPeople(form: FormData) {
  const hireId = String(form.get("hireId"));
  const { user, hire } = await load(hireId);
  if (user.role === "hiring") back(hireId, "Only HR can change the manager.", "err");
  const managerId = String(form.get("managerId") ?? "") || undefined;
  const buddyName = String(form.get("buddyName") ?? "").trim() || undefined;
  mutate((d) => {
    const h = d.hires.find((x) => x.id === hireId)!;
    const before: Partial<Hire> = { managerId: h.managerId, buddyName: h.buddyName };
    h.managerId = managerId;
    h.buddyName = buddyName;
    audit(d, user, "onboarding.assign", "hire", hireId, `Updated manager and buddy for ${hire.name}`, { before, after: { managerId, buddyName } });
    if (managerId && managerId !== before.managerId) notify(d, { userId: managerId }, "New joiner in your team", `${h.name} has been assigned to you.`, `/hr/onboarding/${hireId}`);
    notify(d, { userId: h.userId }, "Your onboarding team", `${buddyName ? `${buddyName} is your onboarding buddy. ` : ""}Your manager details were updated.`, "/me/onboarding");
  });
  back(hireId, "Saved.");
}

export async function completeJourney(form: FormData) {
  const hireId = String(form.get("hireId"));
  const { user, hire } = await load(hireId);
  if (user.role === "hiring") back(hireId, "Only HR can close a journey.", "err");
  if (!hire.employeeNo) back(hireId, "The new hire must finish orientation (employee ID) first.", "err");
  mutate((d) => {
    const h = d.hires.find((x) => x.id === hireId)!;
    h.status = "completed";
    h.completedAt = nowIso();
    if (!h.badges.includes("Onboarding complete")) h.badges.push("Onboarding complete");
    audit(d, user, "onboarding.complete", "hire", hireId, `Closed the onboarding journey for ${h.name}`);
    notify(d, { userId: h.userId }, "Onboarding complete 🎉", "You have completed onboarding. Tell us how it went!", "/me/feedback?touchpoint=onboarding");
  });
  back(hireId, "Onboarding journey completed.");
}

export async function reopenJourney(form: FormData) {
  const hireId = String(form.get("hireId"));
  const { user, hire } = await load(hireId);
  if (user.role === "hiring") back(hireId, "Only HR can reopen a journey.", "err");
  mutate((d) => {
    const h = d.hires.find((x) => x.id === hireId)!;
    h.status = h.employeeNo ? "onboarding" : "orientation";
    h.completedAt = undefined;
    audit(d, user, "onboarding.reopen", "hire", hireId, `Reopened the onboarding journey for ${hire.name}`);
  });
  back(hireId, "Journey reopened.");
}
