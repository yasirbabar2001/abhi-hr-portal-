import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterList, masterName } from "@/lib/lookup";
import { fmtDate } from "@/lib/format";
import { Badge, EmptyState, Flash, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { AutoSelect } from "@/components/forms";

export const metadata = { title: "Job description bank" };

export default async function JdBank({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/job-descriptions");
  const sp = await searchParams;
  const d = db();
  const q = (sp.q ?? "").toLowerCase();
  const status = sp.status ?? "active";
  const list = d.jds
    .filter((j) => (status === "all" ? true : status === "active" ? j.status !== "archived" : j.status === status))
    .filter((j) => !sp.dept || j.departmentId === sp.dept)
    .filter((j) => !q || [j.title, j.code, j.summary, ...j.keywords, ...j.responsibilities].join(" ").toLowerCase().includes(q))
    .sort((a, b) => a.title.localeCompare(b.title));
  return (
    <div>
      <PageHeader title="Job description bank" subtitle="Approved, versioned job descriptions to reuse across requisitions and postings." actions={<LinkButton href="/hr/job-descriptions/new">+ New job description</LinkButton>} />
      <Flash msg={sp.msg} err={sp.err} />
      <form className="mb-4 flex flex-wrap gap-3" action="/hr/job-descriptions">
        <input name="q" type="search" defaultValue={sp.q} placeholder="Search titles, duties, keywords…" className="input max-w-sm" />
        <AutoSelect name="dept" defaultValue={sp.dept ?? ""} className="max-w-xs">
          <option value="">All departments</option>
          {masterList(d, "department").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </AutoSelect>
        <AutoSelect name="status" defaultValue={status} className="max-w-[12rem]">
          <option value="active">Draft & approved</option>
          <option value="approved">Approved</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </AutoSelect>
      </form>
      {list.length === 0 ? (
        <EmptyState title="No job descriptions found" body="Try another search, or create a new one." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((j) => {
            const uses = d.requisitions.filter((r) => r.jdId === j.id).length;
            return (
              <Link key={j.id} href={`/hr/job-descriptions/${j.id}`} className="flex flex-col rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:border-brand/50">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-ink">{j.title}</h3>
                  <StatusBadge status={j.status} />
                </div>
                <div className="mt-0.5 text-xs text-muted">{j.code} · v{j.version} · {masterName(d, j.departmentId)} · {masterName(d, j.gradeId)}</div>
                <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{j.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {j.keywords.slice(0, 5).map((k) => <Badge key={k} tone="brand">{k}</Badge>)}
                </div>
                <div className="mt-3 text-xs text-muted">Used in {uses} requisition(s) · updated {fmtDate(j.updatedAt)}</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
