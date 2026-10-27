"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { saveUpload } from "@/lib/files";
import { db, mutate, nowIso } from "@/lib/store";
import { hireForUser } from "@/lib/orientation/journey";

async function ownTask(taskId: string) {
  const user = await requireUser(["candidate"]);
  const hire = hireForUser(db(), user.id);
  const task = hire?.tasks.find((t) => t.id === taskId);
  if (!hire || !task) redirect("/me/onboarding?err=Task+not+found.");
  if (task.owner !== "new_hire") redirect("/me/onboarding?err=This+task+is+handled+by+the+bank.");
  return { user, hire, task };
}

export async function completeOwnTask(form: FormData) {
  const { user, hire, task } = await ownTask(String(form.get("taskId")));
  if (task.documentTypeId) redirect("/me/onboarding?err=Please+upload+the+document+to+complete+this+task.");
  if (/orientation/i.test(task.title) && !hire.employeeNo) redirect("/me/orientation?err=Finish+your+orientation+modules+to+complete+this+task.");
  mutate((d) => {
    const t = d.hires.find((h) => h.id === hire.id)!.tasks.find((x) => x.id === task.id)!;
    t.done = true;
    t.doneAt = nowIso();
    t.doneBy = user.id;
    audit(d, user, "onboarding.task_done", "hire", hire.id, `${hire.name} completed “${t.title}”`);
  });
  redirect("/me/onboarding?msg=Done!+Nice+work.");
}

export async function uploadDocument(form: FormData) {
  const { user, hire, task } = await ownTask(String(form.get("taskId")));
  let fileId: string | undefined;
  try {
    const file = await saveUpload(form.get("file"), user.id, "private");
    fileId = file?.id;
  } catch (e) {
    redirect(`/me/onboarding?err=${encodeURIComponent(e instanceof Error ? e.message : "Upload failed.")}`);
  }
  if (!fileId) redirect("/me/onboarding?err=Please+choose+a+file+to+upload.");
  mutate((d) => {
    const t = d.hires.find((h) => h.id === hire.id)!.tasks.find((x) => x.id === task.id)!;
    t.fileId = fileId;
    t.done = true;
    t.doneAt = nowIso();
    t.doneBy = user.id;
    audit(d, user, "onboarding.document_upload", "hire", hire.id, `${hire.name} uploaded a document for “${t.title}”`);
    notify(d, { roles: ["hr"] }, "Onboarding document received", `${hire.name} uploaded: ${t.title}`, `/hr/onboarding/${hire.id}`);
  });
  redirect("/me/onboarding?msg=Document+uploaded.+Thank+you!");
}
