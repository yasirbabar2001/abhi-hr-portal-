import Link from "next/link";
import clsx from "clsx";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { STAGES } from "@/lib/types";
import { masterName } from "@/lib/lookup";
import { daysInStage, displayName, STAGE_LABEL, visibleApplications, visiblePostings } from "@/lib/hiring";
import { fmtDate } from "@/lib/format";
import { Avatar, Badge, EmptyState, Flash, PageHeader, StatusBadge } from "@/components/ui";
import { AutoSelect } from "@/components/forms";
import { ScoreBadge, StageControls } from "@/components/hiring/StageControls";

export const metadata = { title: "Candidate pipeline" };

type SP = Record<string, string | undefined>;

export default async function PipelinePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSection("/hr/pipeline");
  const sp = await searchParams;
  const d = db();
  const postings = visiblePostings(d, user);
  const view = sp.view === "list" ? "list" : "board";
  const status = sp.status ?? "active";
  let apps = visibleApplications(d, user);
  if (sp.posting) apps = apps.filter((a) => a.postingId === sp.posting);
  if (sp.dept) apps = apps.filter((a) => d.postings.find((p) => p.id === a.postingId)?.departmentId === sp.dept);
  if (sp.req) apps = apps.filter((a) => d.postings.find((p) => p.id === a.postingId)?.requisitionId === sp.req);
  if (status !== "all") apps = apps.filter((a) => (status === "active" ? a.status === "active" || a.status === "hired" : a.status === status));
  const q = (sp.q ?? "").trim().toLowerCase();
  if (q) {
    apps = apps.filter((a) => {
      const c = d.candidates.find((x) => x.id === a.candidateId);
      return a.code.toLowerCase().includes(q) || (!d.settings.blindScreening && c?.name.toLowerCase().includes(q));
    });
  }

  const qs = (patch: SP) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, msg: undefined, err: undefined, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return `/hr/pipeline${s ? `?${s}` : ""}`;
  };
  const back = qs({});
  const depts = [...new Set(postings.map((p) => p.departmentId))];
  const reqs = d.requisitions.filter((r) => postings.some((p) => p.requisitionId === r.id));

  return (
    <div>
      <PageHeader
        title="Candidate pipeline"
        subtitle={user.role === "hiring" ? "Candidates for the roles you manage or interview for." : "Every candidate, by hiring stage. Move people forward with one click."}
        actions={
          <div className="flex rounded-lg border border-line bg-surface p-0.5 text-sm">
            <Link href={qs({ view: "board" })} className={clsx("rounded-md px-3 py-1", view === "board" ? "bg-brand text-white" : "text-muted")}>Board</Link>
            <Link href={qs({ view: "list" })} className={clsx("rounded-md px-3 py-1", view === "list" ? "bg-brand text-white" : "text-muted")}>List</Link>
          </div>
        }
      />
      <Flash msg={sp.msg} err={sp.err} />
      <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" action="/hr/pipeline">
        <input type="hidden" name="view" value={view} />
        <input name="q" defaultValue={sp.q} placeholder="Search name or code…" className="input" aria-label="Search" />
        <AutoSelect name="posting" defaultValue={sp.posting ?? ""} aria-label="Job posting">
          <option value="">All job postings</option>
          {postings.map((p) => (
            <option key={p.id} value={p.id}>{p.title} · {p.city}</option>
          ))}
        </AutoSelect>
        <AutoSelect name="req" defaultValue={sp.req ?? ""} aria-label="Requisition">
          <option value="">All requisitions</option>
          {reqs.map((r) => (
            <option key={r.id} value={r.id}>{r.code} · {r.title}</option>
          ))}
        </AutoSelect>
        <AutoSelect name="dept" defaultValue={sp.dept ?? ""} aria-label="Department">
          <option value="">All departments</option>
          {depts.map((id) => (
            <option key={id} value={id}>{masterName(d, id)}</option>
          ))}
        </AutoSelect>
        <AutoSelect name="status" defaultValue={status} aria-label="Status">
          <option value="active">In progress & hired</option>
          <option value="rejected">Declined</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="all">All</option>
        </AutoSelect>
      </form>

      {apps.length === 0 ? (
        <EmptyState title="No candidates match" body="Try clearing the filters, or publish a job posting to start receiving applications." />
      ) : view === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-4">
          <div className="flex min-w-max gap-3">
            {STAGES.map((s) => {
              const col = apps.filter((a) => a.stage === s.key).sort((a, b) => (b.screening?.score ?? 0) - (a.screening?.score ?? 0));
              return (
                <section key={s.key} className="w-72 shrink-0 rounded-xl bg-slate-100/80 p-2" aria-label={s.label}>
                  <h2 className="flex items-center justify-between px-1.5 pb-2 text-sm font-semibold">
                    {s.label}
                    <span className="rounded-full bg-white px-2 text-xs text-muted">{col.length}</span>
                  </h2>
                  <ul className="space-y-2">
                    {col.map((a) => {
                      const c = d.candidates.find((x) => x.id === a.candidateId);
                      const p = d.postings.find((x) => x.id === a.postingId);
                      const name = displayName(d, c, a);
                      const days = daysInStage(a);
                      return (
                        <li key={a.id} className={clsx("rounded-lg border bg-surface p-3 shadow-sm", a.status === "rejected" ? "border-bad/30 opacity-70" : "border-line")}>
                          <Link href={`/hr/applications/${a.id}`} className="flex items-center gap-2 hover:text-brand">
                            <Avatar name={name} size={28} />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{name}</span>
                              <span className="block truncate text-xs text-muted">{p?.title} · {p?.city}</span>
                            </span>
                          </Link>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <ScoreBadge score={a.screening?.score} />
                            {a.status !== "active" && <StatusBadge status={a.status} />}
                            {a.tags.includes("manager-approved") && <Badge tone="ok">Manager ✓</Badge>}
                          </div>
                          <div className="mt-2 flex justify-between text-[11px] text-muted">
                            <span className={clsx(days > 7 && a.status === "active" && "font-medium text-warn")}>{days} d in stage</span>
                            <span>{masterName(d, a.sourceId)}</span>
                          </div>
                          <div className="mt-2 border-t border-line pt-2">
                            <StageControls d={d} app={a} back={back} compact />
                          </div>
                        </li>
                      );
                    })}
                    {col.length === 0 && <li className="px-2 py-6 text-center text-xs text-muted">No one here yet</li>}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Job</th>
                <th>Stage</th>
                <th>Match</th>
                <th>Days in stage</th>
                <th>Source</th>
                <th>Applied</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apps
                .slice()
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .map((a) => {
                  const c = d.candidates.find((x) => x.id === a.candidateId);
                  const p = d.postings.find((x) => x.id === a.postingId);
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/hr/applications/${a.id}`} className="font-medium hover:text-brand">{displayName(d, c, a)}</Link>
                        <div className="text-xs text-muted">{a.code}</div>
                      </td>
                      <td>{p?.title}<div className="text-xs text-muted">{p?.city}</div></td>
                      <td>{a.status === "active" ? <Badge tone="info">{STAGE_LABEL[a.stage]}</Badge> : <StatusBadge status={a.status} />}</td>
                      <td><ScoreBadge score={a.screening?.score} /></td>
                      <td className="tabular-nums">{daysInStage(a)}</td>
                      <td>{masterName(d, a.sourceId)}</td>
                      <td>{fmtDate(a.createdAt)}</td>
                      <td className="text-right"><div className="flex justify-end"><StageControls d={d} app={a} back={back} compact /></div></td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
