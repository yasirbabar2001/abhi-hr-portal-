import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName, userName } from "@/lib/lookup";
import { fmtDate, fmtDateTime, humanize, pkr } from "@/lib/format";
import { currentStep } from "@/lib/approvals";
import { budgetRow } from "@/lib/planning/headcount";
import { STAGES } from "@/lib/types";
import { ApprovalTrail, Badge, Card, Flash, KeyValue, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { requisitionAction } from "../actions";

export default async function RequisitionDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSection("/hr/requisitions");
  const { id } = await params;
  const sp = await searchParams;
  const d = db();
  const r = d.requisitions.find((x) => x.id === id);
  if (!r) notFound();
  const isHr = user.role === "admin" || user.role === "hr";
  const owner = r.createdBy === user.id || r.hiringManagerId === user.id;
  const step = r.status === "pending" ? currentStep(r.approvals) : undefined;
  const canDecide = !!step && (isHr || (user.role === "hiring" && step.label === "Department Head"));
  const budget = r.budgetId ? d.budgets.find((b) => b.id === r.budgetId) : undefined;
  const brow = budget ? budgetRow(d, budget) : undefined;
  const jd = r.jdId ? d.jds.find((j) => j.id === r.jdId) : undefined;
  const postings = d.postings.filter((p) => p.requisitionId === r.id);
  const apps = d.applications.filter((a) => postings.some((p) => p.id === a.postingId));
  const op = (name: string, label: string, variant: "primary" | "secondary" | "danger" = "secondary", confirm?: string) => (
    <form action={requisitionAction}>
      <input type="hidden" name="id" value={r.id} />
      <input type="hidden" name="op" value={name} />
      <SubmitButton variant={variant} confirm={confirm}>{label}</SubmitButton>
    </form>
  );
  return (
    <div>
      <PageHeader
        title={r.title}
        subtitle={<span className="flex flex-wrap items-center gap-2">{r.code} <StatusBadge status={r.status} /> <Badge tone={r.priority === "urgent" ? "bad" : r.priority === "high" ? "warn" : "neutral"}>{humanize(r.priority)} priority</Badge></span>}
        back={{ href: "/hr/requisitions", label: "Requisitions" }}
        actions={
          <>
            {r.status === "approved" && isHr && <LinkButton href={`/hr/postings/new?requisition=${r.id}`}>📣 Create job posting</LinkButton>}
            {(r.status === "draft" || r.status === "rejected") && (isHr || owner) && op("submit", "Submit for approval", "primary")}
            {isHr && (r.status === "approved" || r.status === "pending") && op("hold", "Put on hold")}
            {isHr && r.status === "on_hold" && op("resume", "Resume")}
            {(isHr || owner) && !["cancelled", "filled"].includes(r.status) && op("cancel", "Cancel", "danger", "Cancel this requisition? Open postings will close.")}
          </>
        }
      />
      <Flash msg={sp.msg} err={sp.err} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Position details">
            <KeyValue
              items={[
                ["Department", masterName(d, r.departmentId)],
                ["Branch / office", masterName(d, r.branchId)],
                ["Designation", masterName(d, r.designationId)],
                ["Grade", masterName(d, r.gradeId)],
                ["Employment type", masterName(d, r.employmentTypeId)],
                ["Positions", `${r.filled} filled of ${r.headcount}`],
                ["Salary range (monthly)", r.salaryMin || r.salaryMax ? `${pkr(r.salaryMin)} – ${pkr(r.salaryMax)}` : "—"],
                ["Target start", fmtDate(r.targetStartDate)],
                ["Type", r.kind === "replacement" ? `Replacement${r.replacementFor ? ` for ${r.replacementFor}` : ""}` : "New position"],
                ["Hiring manager", userName(d, r.hiringManagerId)],
                ["Recruiter", userName(d, r.recruiterId, "Not assigned")],
                ["Raised by", `${userName(d, r.createdBy)} · ${fmtDateTime(r.createdAt)}`],
                ["Job description", jd ? <Link key="jd" href={`/hr/job-descriptions/${jd.id}`} className="text-brand hover:underline">{jd.code} · v{jd.version}</Link> : "—"],
              ]}
            />
            <div className="mt-4 rounded-lg bg-paper p-3 text-sm"><div className="text-xs font-medium text-muted">Justification</div>{r.justification}</div>
          </Card>
          <Card title="Budget check">
            {brow && budget ? (
              <div className="text-sm">
                <p>FY {budget.fiscalYear} · {masterName(d, budget.designationId)} in {masterName(d, budget.departmentId)}</p>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                  {[["Approved", budget.approvedHeadcount], ["In post", brow.filled], ["Open reqs", brow.openReqs], ["Variance", brow.variance]].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-paper p-2"><div className={`text-lg font-semibold ${k === "Variance" && Number(v) < 0 ? "text-bad" : ""}`}>{v}</div><div className="text-xs text-muted">{k}</div></div>
                  ))}
                </div>
                {brow.variance < 0 && <p className="mt-2 text-bad">⚠ This budget line is over budget by {-brow.variance}.</p>}
              </div>
            ) : (
              <p className="text-sm text-warn">Not linked to a headcount budget line: approvers should confirm funding.</p>
            )}
          </Card>
          <Card title="Job postings" actions={r.status === "approved" && isHr ? <Link href={`/hr/postings/new?requisition=${r.id}`} className="text-brand">+ New posting</Link> : undefined}>
            {postings.length === 0 ? (
              <p className="text-sm text-muted">No postings yet{r.status !== "approved" ? " (available once approved)" : ""}.</p>
            ) : (
              <ul className="divide-y divide-line">
                {postings.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/hr/postings/${p.id}`} className="text-brand hover:underline">{p.title} · {p.city}</Link>
                    <span className="flex items-center gap-2"><span className="text-muted">{d.applications.filter((a) => a.postingId === p.id).length} applicants</span><StatusBadge status={p.status} /></span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={`Applicants (${apps.length})`} actions={<Link href={`/hr/pipeline?requisition=${r.id}`} className="text-brand">Open pipeline →</Link>}>
            <div className="flex flex-wrap gap-2">
              {STAGES.map((s) => (
                <div key={s.key} className="min-w-20 rounded-lg bg-paper px-3 py-2 text-center">
                  <div className="text-lg font-semibold">{apps.filter((a) => a.stage === s.key && a.status !== "rejected" && a.status !== "withdrawn").length}</div>
                  <div className="text-xs text-muted">{s.label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Approvals">
            <ApprovalTrail steps={r.approvals} />
            {canDecide && (
              <form action={requisitionAction} className="mt-4 space-y-2 border-t border-line pt-4">
                <input type="hidden" name="id" value={r.id} />
                <label className="block"><span className="label">Your decision as {step!.label}</span><textarea name="comment" className="input" placeholder="Comment (required when rejecting)" /></label>
                <div className="flex gap-2">
                  <SubmitButton name="op" value="approve">Approve</SubmitButton>
                  <SubmitButton name="op" value="reject" variant="danger">Reject</SubmitButton>
                </div>
              </form>
            )}
            {step && !canDecide && <p className="mt-3 text-xs text-muted">Waiting for {step.label}.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
