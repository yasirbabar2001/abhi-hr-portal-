import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName } from "@/lib/lookup";
import { fmtDate } from "@/lib/format";
import { STAGES } from "@/lib/types";
import { BarList } from "@/components/charts";
import { Card, Flash, LinkButton, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { setPostingStatus } from "../actions";
import { CopyLink } from "../CopyLink";
import { PostingForm } from "../PostingForm";

export default async function PostingDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSection("/hr/postings");
  const { id } = await params;
  const sp = await searchParams;
  const d = db();
  const p = d.postings.find((x) => x.id === id);
  if (!p) notFound();
  const req = d.requisitions.find((r) => r.id === p.requisitionId)!;
  const jd = req?.jdId ? d.jds.find((j) => j.id === req.jdId) : undefined;
  const apps = d.applications.filter((a) => a.postingId === p.id);
  const isHr = user.role !== "hiring";
  const bySource = new Map<string, number>();
  for (const a of apps) bySource.set(masterName(d, a.sourceId, "Unknown"), (bySource.get(masterName(d, a.sourceId, "Unknown")) ?? 0) + 1);
  const avgScore = apps.length ? Math.round(apps.reduce((s, a) => s + (a.screening?.score ?? 0), 0) / apps.length) : 0;
  const statusBtn = (status: string, label: string, variant: "primary" | "secondary" | "danger" = "secondary") => (
    <form action={setPostingStatus}>
      <input type="hidden" name="id" value={p.id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant={variant}>{label}</SubmitButton>
    </form>
  );
  return (
    <div>
      <PageHeader
        title={p.title}
        subtitle={<span className="flex flex-wrap items-center gap-2">{p.city} · {masterName(d, p.departmentId)} · {fmtDate(p.openDate)} – {fmtDate(p.closeDate)} <StatusBadge status={p.status} /></span>}
        back={{ href: "/hr/postings", label: "Job postings" }}
        actions={
          <>
            <LinkButton href={`/careers/${p.slug}`} variant="secondary" target="_blank">👁 Preview</LinkButton>
            <CopyLink path={`/careers/${p.slug}`} />
            {isHr && p.status !== "open" && statusBtn("open", "Open posting", "primary")}
            {isHr && p.status === "open" && statusBtn("closed", "Close posting", "danger")}
          </>
        }
      />
      <Flash msg={sp.msg} err={sp.err} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Views" value={p.views.toLocaleString()} />
        <Stat label="Applicants" value={apps.length} href={`/hr/pipeline?posting=${p.id}`} tone="brand" />
        <Stat label="View → apply" value={p.views ? `${((apps.length / p.views) * 100).toFixed(1)}%` : "—"} />
        <Stat label="Average match score" value={apps.length ? `${avgScore}%` : "—"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isHr ? (
            <PostingForm d={d} req={req} jd={jd} posting={p} />
          ) : (
            <Card title="Advert"><p className="text-sm">{p.summary}</p></Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title="Applicants by stage">
            <BarList items={STAGES.map((s) => ({ label: s.label, value: apps.filter((a) => a.stage === s.key).length }))} />
          </Card>
          <Card title="Applicants by source">
            {bySource.size ? <BarList items={[...bySource].map(([label, value]) => ({ label, value }))} /> : <p className="text-sm text-muted">No applicants yet.</p>}
          </Card>
          <Card title="Requisition">
            <Link href={`/hr/requisitions/${req.id}`} className="text-sm text-brand hover:underline">{req.code} · {req.title}</Link>
            <p className="mt-1 text-xs text-muted">{req.filled} of {req.headcount} filled</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
