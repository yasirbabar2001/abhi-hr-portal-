import type { Db, JobPosting } from "../types";

export function isPublic(p: JobPosting, today = new Date().toISOString().slice(0, 10)) {
  return p.status === "open" && (p.visibility === "external" || p.visibility === "both") && p.closeDate >= today;
}

export function publicPostings(d: Db) {
  return d.postings.filter((p) => isPublic(p));
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function uniqueSlug(d: Db, base: string, exceptId?: string) {
  let slug = slugify(base) || "job";
  let n = 2;
  const root = slug;
  while (d.postings.some((p) => p.slug === slug && p.id !== exceptId)) slug = `${root}-${n++}`;
  return slug;
}

/** Profile completeness 0-100 for the candidate dashboard. */
export function profileCompleteness(c: {
  phone: string;
  cnic: string;
  city: string;
  currentTitle: string;
  qualificationId?: string;
  skills: string[];
  cvFileId?: string;
  totalExperienceYears: number;
}) {
  const checks: [string, boolean][] = [
    ["Mobile number", !!c.phone],
    ["CNIC", !!c.cnic],
    ["City", !!c.city],
    ["Current title", !!c.currentTitle],
    ["Qualification", !!c.qualificationId],
    ["Skills", c.skills.length > 0],
    ["CV uploaded", !!c.cvFileId],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  return { pct: Math.round((done / checks.length) * 100), missing: checks.filter(([, ok]) => !ok).map(([k]) => k) };
}

export const CHANNELS = ["Careers website", "Internal job board", "LinkedIn", "Rozee.pk", "Indeed", "Mustakbil"];

/** Current time in ms (kept out of components so render code stays lint-clean). */
export function nowMs() {
  return Date.now();
}
export function isoDaysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
