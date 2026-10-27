import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName } from "@/lib/lookup";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { Badge, Card, Flash, KeyValue, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { PrintButton, SubmitButton } from "@/components/forms";
import { jdAction } from "../actions";
import { JdForm } from "../JdForm";

export default async function JdDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSection("/hr/job-descriptions");
  const { id } = await params;
  const sp = await searchParams;
  const d = db();
  const j = d.jds.find((x) => x.id === id);
  if (!j) notFound();
  const isHr = user.role === "admin" || user.role === "hr";
  if (sp.edit && isHr) {
    return (
      <div className="max-w-4xl">
        <PageHeader title={`Edit ${j.title}`} subtitle={`${j.code} · currently v${j.version}. Saving creates v${j.version + 1} as a draft for re-approval.`} back={{ href: `/hr/job-descriptions/${j.id}`, label: "Back" }} />
        <Flash err={sp.err} />
        <JdForm d={d} jd={j} />
      </div>
    );
  }
  const op = (name: string, label: string, variant: "primary" | "secondary" | "danger" = "secondary") => (
    <form action={jdAction}>
      <input type="hidden" name="id" value={j.id} />
      <input type="hidden" name="op" value={name} />
      <SubmitButton variant={variant}>{label}</SubmitButton>
    </form>
  );
  const reqs = d.requisitions.filter((r) => r.jdId === j.id);
  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={j.title}
          subtitle={<span className="flex items-center gap-2">{j.code} · version {j.version} <StatusBadge status={j.status} /></span>}
          back={{ href: "/hr/job-descriptions", label: "Job description bank" }}
          actions={
            <>
              {j.status === "approved" && <LinkButton href={`/hr/requisitions/new?jd=${j.id}`}>Raise requisition</LinkButton>}
              {isHr && j.status === "draft" && op("approve", "Approve", "primary")}
              {isHr && <LinkButton href={`/hr/job-descriptions/${j.id}?edit=1`} variant="secondary">Edit</LinkButton>}
              {op("duplicate", "Duplicate")}
              {isHr && j.status !== "archived" && op("archive", "Archive", "danger")}
              {isHr && j.status === "archived" && op("restore", "Restore to draft")}
              <PrintButton label="Print" />
            </>
          }
        />
        <Flash msg={sp.msg} err={sp.err} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <article className="print-area space-y-5 rounded-xl border border-line bg-surface p-6 shadow-sm lg:col-span-2">
          <header className="border-b border-line pb-4">
            <div className="text-xs uppercase tracking-wide text-muted">{d.settings.companyName} · Job description</div>
            <h2 className="mt-1 text-xl font-semibold">{j.title}</h2>
            <div className="mt-3"><KeyValue items={[["Department", masterName(d, j.departmentId)], ["Designation", masterName(d, j.designationId)], ["Grade", masterName(d, j.gradeId)], ["Reports to", j.reportsTo || "—"], ["Minimum qualification", masterName(d, j.minQualificationId)], ["Minimum experience", `${j.minExperienceYears} year(s)`]]} /></div>
          </header>
          <section><h3 className="mb-1 font-semibold">Purpose</h3><p className="text-sm leading-relaxed">{j.summary}</p></section>
          <section><h3 className="mb-1 font-semibold">Key responsibilities</h3><ul className="list-disc space-y-1 pl-5 text-sm">{j.responsibilities.map((x) => <li key={x}>{x}</li>)}</ul></section>
          <section><h3 className="mb-1 font-semibold">Requirements</h3><ul className="list-disc space-y-1 pl-5 text-sm">{j.requirements.map((x) => <li key={x}>{x}</li>)}</ul></section>
          <section><h3 className="mb-1 font-semibold">Competencies</h3><div className="flex flex-wrap gap-1.5">{j.competencies.map((c) => <Badge key={c} tone="brand">{c}</Badge>)}</div></section>
          <footer className="border-t border-line pt-3 text-xs text-muted">{j.code} · v{j.version} · last updated {fmtDate(j.updatedAt)}</footer>
        </article>
        <div className="no-print space-y-6">
          <Card title="Screening keywords">
            <div className="flex flex-wrap gap-1.5">{j.keywords.length ? j.keywords.map((k) => <Badge key={k}>{k}</Badge>) : <span className="text-sm text-muted">None</span>}</div>
          </Card>
          <Card title="Version history">
            <ol className="space-y-2 text-sm">
              {[...j.history].reverse().map((h, i) => (
                <li key={i}><span className="font-medium">v{h.version}</span> · {h.note}<div className="text-xs text-muted">{h.by} · {fmtDateTime(h.at)}</div></li>
              ))}
            </ol>
          </Card>
          <Card title={`Requisitions using this JD (${reqs.length})`}>
            <ul className="space-y-1 text-sm">
              {reqs.map((r) => <li key={r.id}><Link href={`/hr/requisitions/${r.id}`} className="text-brand hover:underline">{r.code}</Link> · {masterName(d, r.branchId)} <StatusBadge status={r.status} /></li>)}
              {reqs.length === 0 && <li className="text-muted">None yet.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
