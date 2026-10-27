import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { currentStep } from "@/lib/approvals";
import { masterName, userName } from "@/lib/lookup";
import { fmtDate, fmtDateTime, humanize, pkr } from "@/lib/format";
import { CHANGE_TYPES, FIELD_LABEL, isDue } from "@/lib/employees/status-change";
import { canDecide } from "@/lib/employees/workflow";
import { ApprovalTrail, Avatar, Card, Flash, KeyValue, PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { applyNow, decideStatusChange } from "../actions";

export const metadata: Metadata = { title: "Status change" };

export default async function StatusChangePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireSection("/hr/status-changes");
  const { id } = await params;
  const sp = await searchParams;
  const d = db();
  const sc = d.statusChanges.find((s) => s.id === id);
  if (!sc) notFound();
  const emp = d.employees.find((e) => e.id === sc.employeeId);
  if (user.role === "hiring" && sc.requestedBy !== user.id && (!user.departmentId || emp?.departmentId !== user.departmentId)) notFound();
  const meta = CHANGE_TYPES[sc.type];
  const isHr = user.role === "admin" || user.role === "hr";
  const step = currentStep(sc.approvals);
  const mayDecide = canDecide(d, user, sc);
  const attachment = d.audit.find((a) => a.action === "statuschange.attachment" && a.entityId === sc.id)?.after as { fileId?: string } | undefined;
  const file = attachment?.fileId ? d.files.find((f) => f.id === attachment.fileId) : undefined;

  const show = (k: string, v: unknown) => {
    if (v === undefined || v === null || v === "") return "—";
    if (k === "basicSalary") return isHr || sc.requestedBy === user.id ? pkr(Number(v)) : "Visible to HR";
    if (k === "employmentStatus") return humanize(String(v));
    return masterName(d, String(v));
  };
  const keys = Array.from(new Set([...Object.keys(sc.to), ...(meta.result ? ["employmentStatus"] : [])]));

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={`${meta.icon} ${meta.label}`}
        subtitle={
          <>
            <span className="font-mono">{sc.code}</span> · raised by {userName(d, sc.requestedBy)} on {fmtDateTime(sc.createdAt)}
          </>
        }
        back={{ href: "/hr/status-changes", label: "Status changes" }}
        actions={<StatusBadge status={sc.status} />}
      />
      <Flash msg={sp.msg} err={sp.err} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Employee">
            {emp ? (
              <Link href={`/hr/employees/${emp.id}`} className="flex items-center gap-3 hover:text-brand">
                <Avatar name={emp.name} size={40} />
                <div className="text-sm">
                  <div className="font-medium">{emp.name} <span className="font-mono text-xs text-muted">{emp.employeeNo}</span></div>
                  <div className="text-muted">{masterName(d, emp.designationId)} · {masterName(d, emp.departmentId)}</div>
                </div>
              </Link>
            ) : (
              <p className="text-sm text-muted">Employee record not found.</p>
            )}
          </Card>

          <Card title="What changes">
            {keys.length === 0 ? (
              <p className="text-sm text-muted">{meta.help}</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Now</th>
                    <th>After the change</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k}>
                      <td className="font-medium">{FIELD_LABEL[k as keyof typeof FIELD_LABEL]}</td>
                      <td className="text-muted">{show(k, (sc.from as Record<string, unknown>)[k])}</td>
                      <td className="font-medium text-brand-2">{show(k, k === "employmentStatus" && meta.result ? meta.result : (sc.to as Record<string, unknown>)[k])}</td>
                    </tr>
                  ))}
                  {meta.exit && (
                    <tr>
                      <td className="font-medium">Active</td>
                      <td className="text-muted">Yes</td>
                      <td className="font-medium text-bad">No, leaves on {fmtDate(sc.effectiveDate)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            <div className="mt-4">
              <KeyValue
                items={[
                  ["Effective date", fmtDate(sc.effectiveDate)],
                  ["Applied to employee master", sc.appliedAt ? fmtDateTime(sc.appliedAt) : sc.status === "approved" ? "On the effective date" : "Not yet"],
                  ["Reason", <span key="r" className="whitespace-pre-wrap">{sc.reason}</span>],
                  ["Supporting document", file ? <a key="f" href={`/api/files/${file.id}`} className="text-brand underline">{file.name}</a> : "None"],
                ]}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Approvals">
            <ApprovalTrail steps={sc.approvals} />
            {mayDecide && step && (
              <form action={decideStatusChange.bind(null, sc.id)} className="mt-5 space-y-3 border-t border-line pt-4">
                <div className="text-sm font-medium">Your decision as {step.label}</div>
                <textarea name="comment" className="input" placeholder="Comment (required when rejecting)" />
                <div className="flex gap-2">
                  <SubmitButton name="decision" value="approve">Approve</SubmitButton>
                  <SubmitButton name="decision" value="reject" variant="danger" confirm="Reject this request?">
                    Reject
                  </SubmitButton>
                </div>
              </form>
            )}
            {sc.status === "pending" && !mayDecide && step && <p className="mt-4 text-sm text-muted">Waiting for {step.label}.</p>}
          </Card>
          {sc.status === "approved" && (
            <Card title="Effective date">
              <p className="text-sm text-muted">
                Fully approved. The employee master will be updated automatically on {fmtDate(sc.effectiveDate)}
                {isDue(sc) ? " (today)" : ""}.
              </p>
              {isHr && (
                <form action={applyNow.bind(null, sc.id)} className="mt-3">
                  <SubmitButton variant="secondary" confirm="Apply this change to the employee master now?">Apply now</SubmitButton>
                </form>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
