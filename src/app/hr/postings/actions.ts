"use server";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { csv, lines } from "@/lib/format";
import { db, mutate, nowIso, uid } from "@/lib/store";
import { uniqueSlug } from "@/lib/careers";
import type { JobPosting, KnockoutQuestion } from "@/lib/types";



function parseKnockouts(text: string, existing: KnockoutQuestion[]): KnockoutQuestion[] {
  return lines(text).map((line) => {
    const [q, a] = line.split("|").map((s) => s.trim());
    const question = q ?? line;
    const requiredAnswer = (a ?? "yes").toLowerCase().startsWith("n") ? "no" : "yes";
    return { id: existing.find((e) => e.question === question)?.id ?? uid("q_"), question, requiredAnswer };
  });
}

export async function savePosting(form: FormData) {
  const user = await requireSection("/hr/postings");
  if (user.role === "hiring") redirect("/hr/postings?err=Only+HR+can+publish+postings.");
  const id = String(form.get("id") ?? "");
  const f = (k: string) => String(form.get(k) ?? "").trim();
  const requisitionId = f("requisitionId");
  const errBack = (m: string) => redirect(`${id ? `/hr/postings/${id}?` : `/hr/postings/new?requisition=${requisitionId}&`}err=${encodeURIComponent(m)}`);
  const req = db().requisitions.find((r) => r.id === requisitionId);
  if (!req) errBack("Choose an approved requisition.");
  if (!id && req!.status !== "approved") errBack("The requisition must be approved before posting.");
  if (!f("title") || !f("summary") || !f("city")) errBack("Title, city and summary are required.");
  if (f("closeDate") < f("openDate")) errBack("Closing date must be after the opening date.");
  const intent = f("intent");
  const postingId = mutate((d) => {
    const existing = id ? d.postings.find((p) => p.id === id) : undefined;
    const fields: Omit<JobPosting, "id" | "views" | "createdBy" | "createdAt" | "slug" | "status"> = {
      requisitionId,
      title: f("title"),
      departmentId: req!.departmentId,
      branchId: f("branchId") || req!.branchId,
      city: f("city"),
      employmentTypeId: f("employmentTypeId") || req!.employmentTypeId,
      summary: f("summary"),
      responsibilities: lines(form.get("responsibilities")),
      requirements: lines(form.get("requirements")),
      benefits: lines(form.get("benefits")),
      channels: form.getAll("channels").map(String),
      visibility: (["external", "internal", "both"].includes(f("visibility")) ? f("visibility") : "both") as JobPosting["visibility"],
      showSalary: !!form.get("showSalary"),
      salaryMin: Number(f("salaryMin")) || undefined,
      salaryMax: Number(f("salaryMax")) || undefined,
      openDate: f("openDate"),
      closeDate: f("closeDate"),
      knockoutQuestions: parseKnockouts(f("knockouts"), existing?.knockoutQuestions ?? []),
      criteria: {
        minQualificationId: f("minQualificationId") || undefined,
        minExperienceYears: Math.max(0, Number(f("minExperienceYears")) || 0),
        keywords: csv(form.get("keywords")).map((k) => k.toLowerCase()),
        preferredCities: csv(form.get("preferredCities")),
      },
    };
    if (existing) {
      const before = structuredClone(existing);
      Object.assign(existing, fields);
      if (intent === "open") existing.status = "open";
      audit(d, user, "posting.update", "job_posting", existing.id, `Posting "${existing.title}" updated`, { before, after: existing });
      return existing.id;
    }
    const p: JobPosting = {
      ...fields,
      id: uid("p_"),
      slug: uniqueSlug(d, `${fields.title}-${fields.city}`),
      status: intent === "open" ? "open" : "draft",
      views: 0,
      createdBy: user.id,
      createdAt: nowIso(),
    };
    d.postings.push(p);
    audit(d, user, "posting.create", "job_posting", p.id, `Posting "${p.title}" created (${p.status}) on ${p.channels.join(", ") || "no channels"}`, { after: p });
    return p.id;
  });
  redirect(`/hr/postings/${postingId}?msg=${intent === "open" ? "Published.+It+is+live+on+the+selected+channels." : "Saved."}`);
}

export async function setPostingStatus(form: FormData) {
  const user = await requireSection("/hr/postings");
  if (user.role === "hiring") redirect("/hr/postings?err=Only+HR+can+change+postings.");
  const id = String(form.get("id"));
  const status = String(form.get("status")) as JobPosting["status"];
  if (!["draft", "open", "closed"].includes(status)) redirect(`/hr/postings/${id}?err=Bad+status.`);
  mutate((d) => {
    const p = d.postings.find((x) => x.id === id);
    if (!p) return;
    const before = p.status;
    p.status = status;
    if (status === "open" && p.closeDate < new Date().toISOString().slice(0, 10)) {
      p.closeDate = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);
    }
    audit(d, user, `posting.${status}`, "job_posting", p.id, `Posting "${p.title}" ${before} → ${status}`);
  });
  redirect(`/hr/postings/${id}?msg=${status === "open" ? "Posting+is+open." : status === "closed" ? "Posting+closed." : "Moved+to+draft."}`);
}
