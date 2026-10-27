import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { db, mutate } from "@/lib/store";
import { masterName } from "@/lib/lookup";
import { fmtDate, pkr } from "@/lib/format";
import { isPublic } from "@/lib/careers";
import { Badge, LinkButton } from "@/components/ui";
import { ShareButtons } from "./ShareButtons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = db().postings.find((x) => x.slug === slug);
  return { title: p ? `${p.title} – ${p.city}` : "Job", description: p?.summary };
}

export default async function JobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await currentUser();
  const d = db();
  const p = d.postings.find((x) => x.slug === slug);
  const internal = user && user.role !== "candidate";
  if (!p || (!isPublic(p) && !internal)) notFound();
  if (!internal) mutate((dd) => { const x = dd.postings.find((y) => y.id === p.id); if (x) x.views += 1; });
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost"}`;
  const cand = user ? d.candidates.find((c) => c.userId === user.id) : undefined;
  const applied = cand ? d.applications.find((a) => a.postingId === p.id && a.candidateId === cand.id) : undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: p.title,
    description: p.summary,
    datePosted: p.openDate,
    validThrough: p.closeDate,
    hiringOrganization: { "@type": "Organization", name: d.settings.companyName },
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: p.city, addressCountry: "PK" } },
  };
  const cta = applied ? (
    <LinkButton href={`/me/applications/${applied.id}`} variant="secondary">✓ Applied — view status</LinkButton>
  ) : (
    <LinkButton href={`/careers/${p.slug}/apply`}>Apply now</LinkButton>
  );
  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="lg:col-span-2">
        <Link href="/careers" className="text-sm text-muted hover:text-brand">← All jobs</Link>
        {!isPublic(p) && <div className="mt-2"><Badge tone="warn">Preview: not visible to the public ({p.status})</Badge></div>}
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{p.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted">
          <span>📍 {p.city}</span><span>·</span><span>{masterName(d, p.departmentId)}</span><span>·</span><span>{masterName(d, p.employmentTypeId)}</span>
        </div>
        <p className="mt-5 text-base leading-relaxed">{p.summary}</p>
        {p.responsibilities.length > 0 && (<><h2 className="mt-8 text-lg font-semibold">What you&apos;ll do</h2><ul className="mt-2 list-disc space-y-1.5 pl-5">{p.responsibilities.map((x) => <li key={x}>{x}</li>)}</ul></>)}
        {p.requirements.length > 0 && (<><h2 className="mt-8 text-lg font-semibold">What you&apos;ll need</h2><ul className="mt-2 list-disc space-y-1.5 pl-5">{p.requirements.map((x) => <li key={x}>{x}</li>)}</ul></>)}
        {p.benefits.length > 0 && (<><h2 className="mt-8 text-lg font-semibold">What we offer</h2><ul className="mt-2 grid gap-2 sm:grid-cols-2">{p.benefits.map((x) => <li key={x} className="rounded-lg bg-brand-soft px-3 py-2 text-sm">✓ {x}</li>)}</ul></>)}
        <div className="mt-8 lg:hidden">{cta}</div>
      </article>
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <dl className="space-y-3 text-sm">
            {p.showSalary && p.salaryMin ? <div><dt className="text-xs text-muted">Salary</dt><dd className="font-medium">{pkr(p.salaryMin)} – {pkr(p.salaryMax)} / month</dd></div> : null}
            <div><dt className="text-xs text-muted">Apply by</dt><dd className="font-medium">{fmtDate(p.closeDate)}</dd></div>
            <div><dt className="text-xs text-muted">Experience</dt><dd className="font-medium">{p.criteria.minExperienceYears ? `${p.criteria.minExperienceYears}+ years` : "Fresh graduates welcome"}</dd></div>
            <div><dt className="text-xs text-muted">Education</dt><dd className="font-medium">{masterName(d, p.criteria.minQualificationId, "Any")}</dd></div>
          </dl>
          <div className="mt-5">{cta}</div>
          <p className="mt-3 text-xs text-muted">Takes about 5 minutes. You&apos;ll be able to track your application online.</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="mb-2 text-sm font-semibold">Share this job</div>
          <ShareButtons title={p.title} url={`${origin}/careers/${p.slug}`} />
        </div>
      </aside>
    </div>
  );
}
