"use server";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { csv, lines } from "@/lib/format";
import { db, mutate, nowIso, uid } from "@/lib/store";
import type { JobDescription } from "@/lib/types";

export async function saveJd(form: FormData) {
  const user = await requireSection("/hr/job-descriptions");
  const id = String(form.get("id") ?? "");
  const f = (k: string) => String(form.get(k) ?? "").trim();
  const back = id ? `/hr/job-descriptions/${id}?edit=1&` : "/hr/job-descriptions/new?";
  if (!f("title") || !f("departmentId") || !f("designationId") || !f("gradeId") || !f("summary"))
    redirect(`${back}err=${encodeURIComponent("Title, department, designation, grade and summary are required.")}`);
  const fields = {
    title: f("title"),
    departmentId: f("departmentId"),
    designationId: f("designationId"),
    gradeId: f("gradeId"),
    reportsTo: f("reportsTo"),
    summary: f("summary"),
    responsibilities: lines(form.get("responsibilities")),
    requirements: lines(form.get("requirements")),
    competencies: form.getAll("competencies").map(String),
    minQualificationId: f("minQualificationId") || undefined,
    minExperienceYears: Math.max(0, Number(f("minExperienceYears")) || 0),
    keywords: csv(form.get("keywords")).map((k) => k.toLowerCase()),
  };
  const jdId = mutate((d) => {
    const at = nowIso();
    if (id) {
      const j = d.jds.find((x) => x.id === id)!;
      const before = structuredClone(j);
      const note = f("changeNote") || "Edited";
      Object.assign(j, fields, { version: j.version + 1, status: "draft", updatedAt: at, updatedBy: user.id });
      j.history.push({ version: j.version, at, by: user.name, note });
      audit(d, user, "jd.update", "job_description", j.id, `${j.code} updated to v${j.version}: ${note}`, { before, after: j });
      return j.id;
    }
    const desig = d.master.find((m) => m.id === fields.designationId);
    const j: JobDescription = {
      id: uid("jd_"),
      code: `JD-${desig?.code ?? "GEN"}-${String(d.jds.length + 1).padStart(3, "0")}`,
      ...fields,
      version: 1,
      status: "draft",
      history: [{ version: 1, at, by: user.name, note: "Created" }],
      createdAt: at,
      updatedAt: at,
      updatedBy: user.id,
    };
    d.jds.push(j);
    audit(d, user, "jd.create", "job_description", j.id, `${j.code} ${j.title} created`, { after: j });
    return j.id;
  });
  redirect(`/hr/job-descriptions/${jdId}?msg=${id ? "Saved+as+a+new+version+(draft)." : "Job+description+created+as+draft."}`);
}

export async function jdAction(form: FormData) {
  const user = await requireSection("/hr/job-descriptions");
  const id = String(form.get("id"));
  const op = String(form.get("op"));
  const isHr = user.role === "admin" || user.role === "hr";
  if (!isHr && op !== "duplicate") redirect(`/hr/job-descriptions/${id}?err=Only+HR+can+change+the+status.`);
  if (!db().jds.some((j) => j.id === id)) redirect("/hr/job-descriptions?err=Not+found.");
  const target = mutate((d) => {
    const j = d.jds.find((x) => x.id === id)!;
    const at = nowIso();
    if (op === "duplicate") {
      const copy: JobDescription = {
        ...structuredClone(j),
        id: uid("jd_"),
        code: `${j.code}-C${d.jds.filter((x) => x.code.startsWith(j.code)).length}`,
        title: `${j.title} (copy)`,
        version: 1,
        status: "draft",
        history: [{ version: 1, at, by: user.name, note: `Duplicated from ${j.code} v${j.version}` }],
        createdAt: at,
        updatedAt: at,
        updatedBy: user.id,
      };
      d.jds.push(copy);
      audit(d, user, "jd.duplicate", "job_description", copy.id, `${copy.code} duplicated from ${j.code}`);
      return { id: copy.id, msg: "Copy created." };
    }
    const status = op === "approve" ? "approved" : op === "archive" ? "archived" : "draft";
    const before = j.status;
    j.status = status;
    j.updatedAt = at;
    j.history.push({ version: j.version, at, by: user.name, note: `Status: ${status}` });
    audit(d, user, `jd.${op}`, "job_description", j.id, `${j.code} ${before} → ${status}`);
    return { id: j.id, msg: `Marked ${status}.` };
  });
  redirect(`/hr/job-descriptions/${target.id}?msg=${encodeURIComponent(target.msg)}`);
}
