import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName } from "@/lib/lookup";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { STAGES } from "@/lib/types";

interface Hit {
  href: string;
  title: string;
  sub: string;
  status?: string;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSection("/hr");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const d = db();
  const hiring = user.role === "hiring";
  const needle = q.toLowerCase();
  const has = (...vals: (string | undefined)[]) => vals.some((v) => v && v.toLowerCase().includes(needle));
  const digits = needle.replace(/\D/g, "");
  const groups: { label: string; hits: Hit[] }[] = [];

  if (q.length >= 2) {
    // Hiring team: only candidates on their own requisitions.
    const myReqIds = new Set(d.requisitions.filter((r) => !hiring || r.hiringManagerId === user.id).map((r) => r.id));
    const myPostings = d.postings.filter((p) => myReqIds.has(p.requisitionId));
    const myPostingIds = new Set(myPostings.map((p) => p.id));
    const visibleApps = d.applications.filter((a) => myPostingIds.has(a.postingId));

    const candHits: Hit[] = [];
    for (const c of d.candidates) {
      const apps = visibleApps.filter((a) => a.candidateId === c.id);
      if (hiring && apps.length === 0) continue;
      const cnicMatch = !hiring && digits.length >= 5 && c.cnic.replace(/\D/g, "").includes(digits);
      if (has(c.name, c.email, c.phone, c.currentTitle, c.skills.join(" ")) || cnicMatch) {
        const app = apps[0];
        candHits.push({
          href: app ? `/hr/applications/${app.id}` : `/hr/candidates?q=${encodeURIComponent(c.email)}`,
          title: c.name,
          sub: [c.currentTitle, c.city, apps.length ? `${apps.length} application${apps.length > 1 ? "s" : ""}` : "Talent pool"].filter(Boolean).join(" · "),
        });
      }
    }
    groups.push({ label: "Candidates", hits: candHits });

    groups.push({
      label: "Applications",
      hits: visibleApps
        .filter((a) => has(a.code))
        .map((a) => {
          const c = d.candidates.find((x) => x.id === a.candidateId);
          const p = d.postings.find((x) => x.id === a.postingId);
          return { href: `/hr/applications/${a.id}`, title: `${a.code} · ${c?.name ?? ""}`, sub: `${p?.title ?? ""} · ${STAGES.find((s) => s.key === a.stage)?.label}`, status: a.status };
        }),
    });

    groups.push({
      label: "Employees",
      hits: d.employees
        .filter((e) => has(e.name, e.employeeNo, e.email) || (!hiring && digits.length >= 5 && (e.cnic ?? "").replace(/\D/g, "").includes(digits)))
        .map((e) => ({ href: `/hr/employees/${e.id}`, title: `${e.name} · ${e.employeeNo}`, sub: `${masterName(d, e.designationId)} · ${masterName(d, e.departmentId)}`, status: e.employmentStatus })),
    });

    groups.push({
      label: "Requisitions",
      hits: d.requisitions
        .filter((r) => myReqIds.has(r.id) && has(r.code, r.title))
        .map((r) => ({ href: `/hr/requisitions/${r.id}`, title: `${r.code} · ${r.title}`, sub: `${masterName(d, r.departmentId)} · ${masterName(d, r.branchId)}`, status: r.status })),
    });

    groups.push({
      label: "Job postings",
      hits: myPostings.filter((p) => has(p.title, p.city, p.slug)).map((p) => ({ href: `/hr/postings/${p.id}`, title: p.title, sub: p.city, status: p.status })),
    });

    groups.push({
      label: "Job descriptions",
      hits: d.jds.filter((j) => has(j.code, j.title, j.keywords.join(" "))).map((j) => ({ href: `/hr/job-descriptions/${j.id}`, title: `${j.code} · ${j.title}`, sub: masterName(d, j.departmentId), status: j.status })),
    });

    if (!hiring)
      groups.push({
        label: "Offers",
        hits: d.offers
          .filter((o) => has(o.code))
          .map((o) => {
            const app = d.applications.find((a) => a.id === o.applicationId);
            const c = d.candidates.find((x) => x.id === app?.candidateId);
            return { href: `/hr/offers/${o.id}`, title: `${o.code} · ${c?.name ?? ""}`, sub: masterName(d, o.designationId), status: o.status };
          }),
      });
  }
  const total = groups.reduce((s, g) => s + g.hits.length, 0);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Search" subtitle={q ? `${total} result${total === 1 ? "" : "s"} for “${q}”` : "Find candidates, employees, requisitions, offers and more."} />
      <form className="mb-5 flex gap-2">
        <input name="q" type="search" defaultValue={q} autoFocus className="input" placeholder="Name, email, CNIC, employee no., code (REQ-, APP-, OFR-)…" />
        <button className="rounded-lg bg-brand px-4 text-sm font-medium text-white">Search</button>
      </form>
      {q.length > 0 && q.length < 2 && <p className="text-sm text-muted">Type at least 2 characters.</p>}
      {q.length >= 2 && total === 0 && <EmptyState title="Nothing found" body="Try a different spelling, a code such as APP-2026-00012, or part of a CNIC." />}
      <div className="space-y-4">
        {groups
          .filter((g) => g.hits.length)
          .map((g) => (
            <Card key={g.label} title={`${g.label} (${g.hits.length})`} pad={false}>
              <ul className="divide-y divide-line">
                {g.hits.slice(0, 20).map((h) => (
                  <li key={h.href + h.title}>
                    <Link href={h.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{h.title}</span>
                        <span className="block truncate text-xs text-muted">{h.sub}</span>
                      </span>
                      {h.status && <StatusBadge status={h.status} />}
                    </Link>
                  </li>
                ))}
                {g.hits.length > 20 && <li className="px-4 py-2 text-xs text-muted">Showing the first 20. Refine your search to see more.</li>}
              </ul>
            </Card>
          ))}
      </div>
    </div>
  );
}
