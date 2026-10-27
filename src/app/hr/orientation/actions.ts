"use server";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { saveUpload } from "@/lib/files";
import { db, mutate, nowIso, uid } from "@/lib/store";
import type { ModuleKind, OrientationModule } from "@/lib/types";
import { parseQuiz, parseSlides } from "@/lib/orientation/text-formats";
import { extractScorm } from "@/lib/orientation/scorm-package";

const KINDS: ModuleKind[] = ["pdf", "video", "presentation", "scorm", "quiz"];

export async function saveModule(form: FormData) {
  const user = await requireSection("/hr/orientation");
  const id = String(form.get("id") ?? "");
  const back = (err: string) => redirect(`${id ? `/hr/orientation/modules/${id}` : "/hr/orientation/modules/new"}?err=${encodeURIComponent(err)}`);
  const existing = id ? db().modules.find((m) => m.id === id) : undefined;
  if (id && !existing) back("Module not found.");

  const title = String(form.get("title") ?? "").trim();
  const kind = String(form.get("kind")) as ModuleKind;
  if (!title) back("Please give the module a title.");
  if (!KINDS.includes(kind)) back("Please choose a module type.");

  const patch: Partial<OrientationModule> = {
    title,
    kind,
    description: String(form.get("description") ?? "").trim(),
    points: Math.max(0, Math.round(Number(form.get("points") || 0))),
    durationMin: Math.max(1, Math.round(Number(form.get("durationMin") || 5))),
    required: form.get("required") === "on",
    active: form.get("active") === "on",
  };

  try {
    if (kind === "pdf" || kind === "presentation" || kind === "video") {
      const file = await saveUpload(form.get("file"), user.id, "public");
      if (file) {
        if (kind === "video" && !file.mime.startsWith("video/")) back("Please upload a video file (MP4 or WebM).");
        if (kind !== "video" && file.mime !== "application/pdf") back("Please upload a PDF file.");
        patch.fileId = file.id;
      }
    }
    if (kind === "video") {
      patch.videoUrl = String(form.get("videoUrl") ?? "").trim() || undefined;
      if (!patch.videoUrl && !patch.fileId && !existing?.fileId) back("Add a video link or upload a video file.");
    }
    if (kind === "pdf" && !patch.fileId && !existing?.fileId && !existing) back("Please upload the PDF document.");
    if (kind === "presentation") {
      patch.slides = parseSlides(String(form.get("slides") ?? ""));
      if (!patch.slides.length && !patch.fileId && !existing?.fileId) back("Add at least one slide or upload a PDF of the presentation.");
    }
    if (kind === "quiz") {
      const { questions, errors } = parseQuiz(String(form.get("quiz") ?? ""));
      if (errors.length) back(errors[0]!);
      if (!questions.length) back("Add at least one question.");
      const passMark = Math.min(100, Math.max(1, Number(form.get("passMark") || db().settings.orientationPassMark)));
      patch.quiz = { passMark, questions };
    }
    if (kind === "scorm") {
      const zip = form.get("scormZip");
      if (zip && typeof zip !== "string" && zip.size > 0) {
        if (zip.size > 200 * 1024 * 1024) back("SCORM packages must be under 200 MB.");
        patch.scorm = extractScorm(new Uint8Array(await zip.arrayBuffer()));
      }
    }
  } catch (e) {
    if (e instanceof Error && !("digest" in e)) back(e.message);
    throw e;
  }

  const savedId = mutate((d) => {
    if (existing) {
      const m = d.modules.find((x) => x.id === id)!;
      const before = { ...m };
      Object.assign(m, patch);
      audit(d, user, "orientation.module_update", "orientation_module", m.id, `Updated orientation module “${m.title}”`, { before, after: m });
      return m.id;
    }
    const m: OrientationModule = {
      id: uid("om_"),
      order: Math.max(0, ...d.modules.map((x) => x.order)) + 1,
      createdAt: nowIso(),
      ...(patch as Omit<OrientationModule, "id" | "order" | "createdAt">),
    };
    d.modules.push(m);
    audit(d, user, "orientation.module_create", "orientation_module", m.id, `Added orientation module “${m.title}” (${m.kind})`, { after: m });
    return m.id;
  });
  redirect(`/hr/orientation/modules/${savedId}?msg=Module+saved.`);
}

export async function moveModule(form: FormData) {
  const user = await requireSection("/hr/orientation");
  const id = String(form.get("id"));
  const dir = form.get("dir") === "up" ? -1 : 1;
  mutate((d) => {
    const list = [...d.modules].sort((a, b) => a.order - b.order);
    list.forEach((m, i) => (m.order = i + 1));
    const i = list.findIndex((m) => m.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i]!.order, list[j]!.order] = [list[j]!.order, list[i]!.order];
    audit(d, user, "orientation.module_reorder", "orientation_module", id, `Moved “${list[i]!.title}” ${dir < 0 ? "up" : "down"}`);
  });
  redirect("/hr/orientation");
}

export async function toggleModule(form: FormData) {
  const user = await requireSection("/hr/orientation");
  const id = String(form.get("id"));
  mutate((d) => {
    const m = d.modules.find((x) => x.id === id);
    if (!m) return;
    m.active = !m.active;
    audit(d, user, m.active ? "orientation.module_activate" : "orientation.module_deactivate", "orientation_module", id, `${m.active ? "Activated" : "Deactivated"} “${m.title}”`);
  });
  redirect(`/hr/orientation?msg=${encodeURIComponent("Module updated.")}`);
}
