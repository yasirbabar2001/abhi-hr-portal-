import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName, userName } from "@/lib/lookup";
import { summarize, isOverdue } from "@/lib/verification/status";
import { fmtDate, fmtDateTime, pkr } from "@/lib/format";
import { Badge, Card, EmptyState, Flash, KeyValue, LinkButton, PageHeader, Stars, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { CopyLink } from "./CopyLink";
import { addReference, completeVerification, decideReference, recordEcibResult, resendReference, startEcib, submitEcib } from "./actions";

export const metadata = { title: "Verification" };

export default async function VerificationDetail({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSection("/hr/verification");
  const { applicationId } = await params;
  const sp = await searchParams;
  const d = db();
  const app = d.applications.find((a) => a.id === applicationId);
  if (!app) notFound();
  const cand = d.candidates.find((c) => c.id === app.candidateId);
  const post = d.postings.find((p) => p.id === app.postingId);
  const s = summarize(d, app);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3100"}`;
  const hidden = <input type="hidden" name="applicationId" value={app.id} />;

  return (
    <div>
      <PageHeader
        back={{ href: "/hr/verification", label: "All verifications" }}
        title={cand?.name ?? "Candidate"}
        subtitle={
          <>
            {post?.title} · {masterName(d, post?.branchId)} · {app.code} · <StatusBadge status={app.stage} />
          </>
        }
        actions={<LinkButton href={`/hr/applications/${app.id}`} variant="secondary">Full candidate profile</LinkButton>}
      />
      <Flash msg={sp.msg} err={sp.err} />

      <div className={`mb-6 rounded-xl border p-4 ${s.ready ? "border-ok/30 bg-ok-bg" : "border-line bg-surface"}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">{s.ready ? "All checks complete" : "Checks outstanding"}</div>
            {s.ready ? (
              <p className="text-sm text-muted">References are verified and eCIB is cleared. You can move this candidate to the offer stage.</p>
            ) : (
              <ul className="mt-1 list-inside list-disc text-sm text-muted">
                {s.blockers.map((b) => <li key={b}>{b}</li>)}
              </ul>
            )}
          </div>
          {app.stage === "verification" ? (
            <form action={completeVerification}>
              {hidden}
              <SubmitButton>{s.ready ? "Verification complete → move to Offer" : "Move to Offer"}</SubmitButton>
            </form>
          ) : (
            app.stage === "offer" && <LinkButton href={`/hr/offers/new?application=${app.id}`} variant="secondary">Prepare offer</LinkButton>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card title={`References (${s.refs.length})`}>
            {s.refs.length === 0 ? (
              <EmptyState title="No references yet" body="Add at least one professional referee, ideally a former line manager." />
            ) : (
              <ul className="space-y-4">
                {s.refs.map((r) => (
                  <li key={r.id} className="rounded-lg border border-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{r.refereeName}</div>
                        <div className="text-xs text-muted">
                          {r.relationship}
                          {r.company && ` · ${r.company}`} · {r.refereeEmail}
                          {r.refereePhone && ` · ${r.refereePhone}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOverdue(r.requestedAt, r.status !== "requested") && <Badge tone="bad">Overdue</Badge>}
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                    {r.status === "requested" && (
                      <div className="mt-3 space-y-2">
                        <div className="text-xs text-muted">Requested {fmtDateTime(r.requestedAt)}. Send this secure link to the referee:</div>
                        <CopyLink url={`${origin}/reference/${r.token}`} />
                        <form action={resendReference}>
                          {hidden}
                          <input type="hidden" name="referenceId" value={r.id} />
                          <SubmitButton variant="ghost" size="sm">Record reminder sent</SubmitButton>
                        </form>
                      </div>
                    )}
                    {r.response && (
                      <div className="mt-3 rounded-lg bg-paper p-3 text-sm">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div>Performance <Stars value={r.response.performance} /></div>
                          <div>Integrity <Stars value={r.response.integrity} /></div>
                          <div>Teamwork <Stars value={r.response.teamwork} /></div>
                        </div>
                        <div className="mt-2 text-xs text-muted">
                          Knew the candidate as {r.response.capacity} for {r.response.period} · Would re-hire:{" "}
                          <strong className={r.response.rehire ? "text-ok" : "text-bad"}>{r.response.rehire ? "Yes" : "No"}</strong>
                        </div>
                        {r.response.comments && <p className="mt-2">“{r.response.comments}”</p>}
                        <div className="mt-1 text-xs text-muted">Received {fmtDateTime(r.completedAt)}</div>
                      </div>
                    )}
                    {r.verifierNote && <p className="mt-2 text-xs text-muted">HR note: {r.verifierNote}</p>}
                    {(r.status === "received" || r.status === "requested") && (
                      <form action={decideReference} className="mt-3 flex flex-col gap-2 sm:flex-row">
                        {hidden}
                        <input type="hidden" name="referenceId" value={r.id} />
                        <input name="note" placeholder={r.status === "requested" ? "Note (e.g. verified by phone call)" : "Note (optional for verified)"} className="input" />
                        <div className="flex gap-2">
                          <SubmitButton size="sm" name="decision" value="verified">Mark verified</SubmitButton>
                          <SubmitButton size="sm" variant="danger" name="decision" value="failed" confirm="Mark this reference as failed?">Failed</SubmitButton>
                        </div>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Add a referee">
            <form action={addReference} className="grid gap-3 sm:grid-cols-2">
              {hidden}
              <label><span className="label">Full name *</span><input name="refereeName" required className="input" /></label>
              <label><span className="label">Email *</span><input name="refereeEmail" type="email" required className="input" /></label>
              <label><span className="label">Phone</span><input name="refereePhone" className="input" placeholder="03XX XXXXXXX" /></label>
              <label><span className="label">Company</span><input name="company" className="input" defaultValue={cand?.currentEmployer} /></label>
              <label className="sm:col-span-2">
                <span className="label">Relationship</span>
                <select name="relationship" className="input">
                  <option>Former line manager</option>
                  <option>Current line manager</option>
                  <option>Senior colleague</option>
                  <option>HR department</option>
                  <option>Academic supervisor</option>
                </select>
              </label>
              <div className="sm:col-span-2"><SubmitButton>Add referee & create link</SubmitButton></div>
            </form>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card title="eCIB credit check">
            <p className="mb-3 text-xs text-muted">
              The State Bank of Pakistan&apos;s electronic Credit Information Bureau shows the candidate&apos;s borrowing and repayment record. The candidate must give written consent first.
            </p>
            {!s.ecib || ["clear", "adverse", "exception"].includes(s.ecib.status) ? (
              <>
                {s.ecib && <EcibResult e={s.ecib} decidedBy={userName(d, s.ecib.decidedBy)} />}
                {(!s.ecib || s.ecib.status === "adverse") && (
                  <form action={startEcib} className="mt-3 space-y-2">
                    {hidden}
                    <label><span className="label">CNIC</span><input name="cnic" defaultValue={cand?.cnic} required className="input" placeholder="42101-1234567-1" /></label>
                    <SubmitButton variant={s.ecib ? "secondary" : "primary"}>{s.ecib ? "Run a new check" : "Start eCIB check"}</SubmitButton>
                  </form>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <KeyValue
                  items={[
                    ["Status", <StatusBadge key="s" status={s.ecib.status} />],
                    ["CNIC", s.ecib.cnic],
                    ["Requested", fmtDate(s.ecib.requestedAt)],
                    ["Consent", s.ecib.consentAt ? fmtDateTime(s.ecib.consentAt) : "Waiting for candidate"],
                  ]}
                />
                {s.ecib.status === "awaiting_consent" && (
                  <p className="rounded-lg bg-warn-bg px-3 py-2 text-xs text-warn">The candidate has been asked to give consent in their portal.</p>
                )}
                {s.ecib.consentAt && s.ecib.status !== "submitted" && (
                  <form action={submitEcib}>
                    {hidden}
                    <input type="hidden" name="ecibId" value={s.ecib.id} />
                    <SubmitButton variant="secondary">Mark submitted to eCIB</SubmitButton>
                  </form>
                )}
                {s.ecib.consentAt && (
                  <form action={recordEcibResult} className="space-y-2 border-t border-line pt-3">
                    {hidden}
                    <input type="hidden" name="ecibId" value={s.ecib.id} />
                    <div className="text-sm font-medium">Record result</div>
                    <select name="result" className="input" defaultValue="clear">
                      <option value="clear">Clear — no adverse history</option>
                      <option value="exception">Exception — minor issue, approved with remark</option>
                      <option value="adverse">Adverse — not cleared</option>
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <label><span className="label">Outstanding (PKR)</span><input name="outstanding" type="number" min={0} defaultValue={0} className="input" /></label>
                      <label><span className="label">Max overdue days</span><input name="overdueDays" type="number" min={0} defaultValue={0} className="input" /></label>
                    </div>
                    <label><span className="label">Remarks</span><textarea name="remarks" className="input" placeholder="Required for an exception or adverse result" /></label>
                    <label><span className="label">eCIB report (PDF, optional)</span><input name="report" type="file" accept=".pdf,image/*" className="input" /></label>
                    <SubmitButton>Save result</SubmitButton>
                  </form>
                )}
              </div>
            )}
          </Card>
          <Card title="Candidate">
            <KeyValue
              items={[
                ["Email", cand?.email],
                ["Phone", cand?.phone],
                ["CNIC", cand?.cnic || "—"],
                ["Current employer", cand?.currentEmployer || "—"],
              ]}
            />
            <div className="mt-3 text-xs">
              <Link href={`/hr/applications/${app.id}`} className="text-brand hover:underline">Open application →</Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EcibResult({ e, decidedBy }: { e: NonNullable<ReturnType<typeof summarize>["ecib"]>; decidedBy: string }) {
  return (
    <div className="space-y-2">
      <KeyValue
        items={[
          ["Result", <StatusBadge key="s" status={e.status} />],
          ["CNIC", e.cnic],
          ["Outstanding", pkr(e.outstanding ?? 0)],
          ["Max overdue days", String(e.overdueDays ?? 0)],
          ["Decided", `${fmtDate(e.resultAt)} by ${decidedBy}`],
          ["Consent given", fmtDateTime(e.consentAt)],
        ]}
      />
      {e.remarks && <p className="rounded bg-paper px-3 py-2 text-sm">{e.remarks}</p>}
      {e.reportFileId && (
        <a href={`/api/files/${e.reportFileId}`} className="text-sm text-brand hover:underline" target="_blank">Download eCIB report</a>
      )}
    </div>
  );
}
