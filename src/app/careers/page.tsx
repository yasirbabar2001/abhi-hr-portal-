import Link from "next/link";
import { db } from "@/lib/store";
import { masterList, masterName } from "@/lib/lookup";
import { fmtDate, pkr } from "@/lib/format";
import { isoDaysFromNow, publicPostings } from "@/lib/careers";
import { Badge, EmptyState } from "@/components/ui";

export const metadata = { title: "Careers at ABHI" };
export const dynamic = "force-dynamic";

const WHY = [
  ["🌱", "Work that matters", "Every loan and account you handle helps a family or small business move forward."],
  ["📈", "Grow fast", "Structured learning paths, certifications and internal moves across branches and head office."],
  ["🛡️", "Care & security", "Provident fund, gratuity, family health cover and subsidised staff loans."],
  ["🤝", "Fair & inclusive", "Transparent, structured hiring. We welcome applicants of every background."],
];

export default async function CareersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const d = db();
  const all = publicPostings(d);
  const q = (sp.q ?? "").toLowerCase();
  const list = all
    .filter((p) => !sp.city || p.city === sp.city)
    .filter((p) => !sp.dept || p.departmentId === sp.dept)
    .filter((p) => !sp.type || p.employmentTypeId === sp.type)
    .filter((p) => !q || [p.title, p.summary, p.city, ...p.requirements].join(" ").toLowerCase().includes(q))
    .sort((a, b) => b.openDate.localeCompare(a.openDate));
  const cities = [...new Set(all.map((p) => p.city))].sort();
  const depts = masterList(d, "department").filter((m) => all.some((p) => p.departmentId === m.id));
  const newCutoff = isoDaysFromNow(-7);
  return (
    <div>
      <section className="-mx-4 -mt-8 mb-8 bg-gradient-to-br from-side to-brand-2 px-4 py-14 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Careers at {d.settings.shortName}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-on-side">{d.settings.careersIntro}</p>
          <form className="mx-auto mt-6 flex max-w-2xl flex-col gap-2 rounded-xl bg-white p-2 shadow-lg sm:flex-row" action="/careers">
            <input name="q" type="search" defaultValue={sp.q} placeholder="Job title, skill or keyword" className="input flex-1 border-0 text-ink" aria-label="Search jobs" />
            <select name="city" defaultValue={sp.city ?? ""} className="input text-ink sm:w-40" aria-label="City">
              <option value="">All cities</option>
              {cities.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-2">Search</button>
          </form>
          <p className="mt-3 text-sm text-on-side-muted">{all.length} open positions</p>
        </div>
      </section>
      <div className="grid gap-8 lg:grid-cols-4">
        <aside className="space-y-4">
          <form action="/careers" className="space-y-3 rounded-xl border border-line bg-surface p-4">
            {sp.q && <input type="hidden" name="q" value={sp.q} />}
            {sp.city && <input type="hidden" name="city" value={sp.city} />}
            <div className="text-sm font-semibold">Filter</div>
            <label className="block"><span className="label">Department</span>
              <select name="dept" defaultValue={sp.dept ?? ""} className="input">
                <option value="">All</option>
                {depts.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">Employment type</span>
              <select name="type" defaultValue={sp.type ?? ""} className="input">
                <option value="">All</option>
                {masterList(d, "employment_type").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <button className="w-full rounded-lg border border-line px-3 py-1.5 text-sm hover:border-brand">Apply filters</button>
            {(sp.q || sp.city || sp.dept || sp.type) && <Link href="/careers" className="block text-center text-xs text-brand">Clear all</Link>}
          </form>
          <div className="rounded-xl border border-line bg-brand-soft p-4 text-sm">
            <div className="font-semibold text-brand-2">No suitable role yet?</div>
            <p className="mt-1 text-muted">Create an account and join our talent pool. We&apos;ll contact you when a matching role opens.</p>
            <Link href="/register" className="mt-2 inline-block font-medium text-brand">Join the talent pool →</Link>
          </div>
        </aside>
        <div className="lg:col-span-3">
          {list.length === 0 ? (
            <EmptyState title="No jobs match your search" body="Try different keywords or clear the filters." />
          ) : (
            <ul className="space-y-3">
              {list.map((p) => (
                <li key={p.id}>
                  <Link href={`/careers/${p.slug}`} className="block rounded-xl border border-line bg-surface p-5 shadow-sm transition hover:border-brand/50 hover:shadow">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-semibold text-ink">{p.title}</h2>
                        <div className="mt-0.5 text-sm text-muted">📍 {p.city} · {masterName(d, p.departmentId)} · {masterName(d, p.employmentTypeId)}</div>
                      </div>
                      <div className="flex gap-1.5">
                        {p.openDate >= newCutoff && <Badge tone="ok">New</Badge>}
                        {p.visibility === "both" && <Badge tone="info">Internal staff welcome</Badge>}
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted">{p.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 text-xs text-muted">
                      {p.showSalary && p.salaryMin ? <span>💰 {pkr(p.salaryMin)} – {pkr(p.salaryMax)} / month</span> : null}
                      <span>⏳ Apply by {fmtDate(p.closeDate)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <section className="mt-14">
        <h2 className="mb-4 text-center text-xl font-semibold">Why {d.settings.shortName}?</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map(([icon, title, body]) => (
            <div key={title} className="rounded-xl border border-line bg-surface p-5">
              <div className="text-2xl" aria-hidden>{icon}</div>
              <div className="mt-2 font-semibold">{title}</div>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-xl border border-line bg-surface p-5 text-sm">
          <div className="font-semibold">How our hiring works</div>
          <ol className="mt-3 grid gap-3 sm:grid-cols-5">
            {["Apply online in 5 minutes", "We review every CV fairly", "Interview in person or by video", "References & background checks", "Offer, orientation & welcome"].map((s, i) => (
              <li key={s} className="flex gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">{i + 1}</span><span>{s}</span></li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted">You can track every step from your candidate dashboard. {d.settings.shortName} never asks for a fee at any stage of recruitment.</p>
        </div>
      </section>
    </div>
  );
}
