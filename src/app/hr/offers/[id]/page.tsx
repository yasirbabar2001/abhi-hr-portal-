import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { candidateOf, masterName, userName } from "@/lib/lookup";
import { currentStep } from "@/lib/approvals";
import { OfferLetter, offerIsExpired } from "@/lib/offers/OfferLetter";
import { fmtDate, fmtDateTime, pkr, relative } from "@/lib/format";
import { ApprovalTrail, Card, Flash, KeyValue, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { PrintButton, SubmitButton } from "@/components/forms";
import { OfferFields } from "../OfferFields";
import { closeOffer, decideOffer, reviseOffer, sendOffer, submitForApproval } from "./actions";

export const metadata = { title: "Offer" };

export default async function OfferDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/offers");
  const { id } = await params;
  const sp = await searchParams;
  const d = db();
  const offer = d.offers.find((o) => o.id === id);
  if (!offer) notFound();
  const { app, cand, posting } = candidateOf(d, offer.applicationId);
  const req = d.requisitions.find((r) => r.id === posting?.requisitionId);
  const step = currentStep(offer.approvals);
  const expired = offerIsExpired(offer);
  const closed = ["accepted", "declined", "withdrawn", "expired"].includes(offer.status);
  const letter = d.letters.find((l) => l.offerId === offer.id);
  const hidden = <input type="hidden" name="offerId" value={offer.id} />;
  const outOfRange = req && (offer.grossMonthly < req.salaryMin || offer.grossMonthly > req.salaryMax);

  if (sp.view === "letter") {
    return (
      <div>
        <div className="no-print mb-4 flex items-center justify-between">
          <Link href={`/hr/offers/${offer.id}`} className="text-sm text-muted hover:text-brand">← Back to offer</Link>
          <PrintButton />
        </div>
        <OfferLetter d={d} offer={offer} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        back={{ href: "/hr/offers", label: "Offers" }}
        title={`${offer.code} · ${cand?.name ?? ""}`}
        subtitle={<>{masterName(d, offer.designationId)} · {masterName(d, offer.branchId)} · <StatusBadge status={expired ? "expired" : offer.status} /></>}
        actions={
          <>
            <LinkButton href={`/hr/offers/${offer.id}?view=letter`} variant="secondary">View / print letter</LinkButton>
            {app && <LinkButton href={`/hr/applications/${app.id}`} variant="secondary">Candidate profile</LinkButton>}
          </>
        }
      />
      <Flash msg={sp.msg} err={sp.err} />

      {offer.status === "accepted" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ok/30 bg-ok-bg p-4">
          <div className="text-sm">
            <strong>Accepted</strong> by {offer.candidateResponse?.signatureName} on {fmtDateTime(offer.candidateResponse?.at)}.
            {letter ? " Appointment letter issued." : " Next step: issue the appointment letter."}
          </div>
          {letter ? <LinkButton size="sm" variant="secondary" href={`/hr/letters/${letter.id}`}>Open letter</LinkButton> : <LinkButton size="sm" href="/hr/letters">Issue appointment letter</LinkButton>}
        </div>
      )}
      {offer.status === "declined" && (
        <div className="mb-4 rounded-xl border border-bad/30 bg-bad-bg p-4 text-sm">
          Declined on {fmtDateTime(offer.candidateResponse?.at)}. Reason: {offer.candidateResponse?.reason || "not given"}.
        </div>
      )}
      {offer.counterOffer && offer.status === "sent" && (
        <div className="mb-4 rounded-xl border border-warn/30 bg-warn-bg p-4 text-sm">
          <div className="font-medium text-warn">Counter-offer requested {relative(offer.counterOffer.at)}</div>
          <p className="mt-1">The candidate asked for a gross monthly salary of <strong>{pkr(offer.counterOffer.requested)}</strong> (currently {pkr(offer.grossMonthly)}).</p>
          {offer.counterOffer.note && <p className="mt-1 italic">“{offer.counterOffer.note}”</p>}
          <p className="mt-2 text-xs">Use “Revise offer” below to change the package; the revision goes through approval again before you re-send it.</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Package">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-line"><td className="py-1.5">Basic salary</td><td className="text-right tabular-nums">{pkr(offer.basicSalary)}</td></tr>
                {offer.allowances.map((a) => (
                  <tr key={a.name} className="border-b border-line"><td className="py-1.5">{a.name}</td><td className="text-right tabular-nums">{pkr(a.amount)}</td></tr>
                ))}
                <tr className="font-semibold"><td className="py-2">Gross monthly</td><td className="text-right tabular-nums">{pkr(offer.grossMonthly)}</td></tr>
              </tbody>
            </table>
            {req && (
              <p className={`mt-2 text-xs ${outOfRange ? "text-warn" : "text-muted"}`}>
                {outOfRange ? "⚠ Outside" : "Within"} the approved requisition range {pkr(req.salaryMin)} – {pkr(req.salaryMax)} ({req.code}).
              </p>
            )}
            <div className="mt-4">
              <KeyValue
                items={[
                  ["Grade", masterName(d, offer.gradeId)],
                  ["Department", masterName(d, offer.departmentId)],
                  ["Employment type", masterName(d, offer.employmentTypeId)],
                  ["Probation", `${offer.probationMonths} months`],
                  ["Joining date", fmtDate(offer.joiningDate)],
                  ["Valid until", `${fmtDate(offer.expiresAt)}${offer.status === "sent" ? ` (${relative(offer.expiresAt)})` : ""}`],
                  ["Expected by candidate", pkr(app?.expectedSalary)],
                  ["Prepared by", `${userName(d, offer.createdBy)} · ${fmtDate(offer.createdAt)}`],
                ]}
              />
            </div>
            <div className="mt-4 text-sm"><span className="text-xs text-muted">Benefits</span><ul className="mt-1 list-inside list-disc">{offer.benefits.map((b) => <li key={b}>{b}</li>)}</ul></div>
          </Card>

          {!closed && (
            <Card title="Revise offer">
              <details>
                <summary className="cursor-pointer text-sm text-brand">Change salary, allowances or joining date (restarts approval)</summary>
                <form action={reviseOffer} className="mt-4 space-y-3">
                  {hidden}
                  <OfferFields basic={offer.basicSalary} allowances={offer.allowances} range={req ? { min: req.salaryMin, max: req.salaryMax } : undefined} />
                  <label className="block max-w-xs"><span className="label">Joining date</span><input type="date" name="joiningDate" defaultValue={offer.joiningDate.slice(0, 10)} className="input" /></label>
                  <label className="block"><span className="label">Reason for revision</span><input name="note" className="input" placeholder="e.g. Counter-offer agreed by HR Head" /></label>
                  <SubmitButton variant="secondary">Save revision & request approval</SubmitButton>
                </form>
              </details>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card title="Approval">
            <ApprovalTrail steps={offer.approvals} />
            {offer.status === "pending_approval" && step && (
              <form action={decideOffer} className="mt-4 space-y-2 border-t border-line pt-4">
                {hidden}
                <div className="text-sm font-medium">Your decision as {step.label}</div>
                <textarea name="comment" className="input" placeholder="Comment (required to reject)" />
                <div className="flex gap-2">
                  <SubmitButton name="decision" value="approved">Approve</SubmitButton>
                  <SubmitButton name="decision" value="rejected" variant="danger">Return</SubmitButton>
                </div>
              </form>
            )}
            {offer.status === "draft" && (
              <form action={submitForApproval} className="mt-4">
                {hidden}
                <SubmitButton>Submit for approval</SubmitButton>
              </form>
            )}
          </Card>
          <Card title="Actions">
            <div className="space-y-3">
              {offer.status === "approved" && (
                <form action={sendOffer}>
                  {hidden}
                  <SubmitButton className="w-full">Send to candidate</SubmitButton>
                  <p className="hint">The candidate is notified and can accept, decline or request a change in their portal.</p>
                </form>
              )}
              {offer.status === "sent" && (
                <p className="text-sm text-muted">Waiting for {cand?.name?.split(" ")[0]} to respond{expired ? " — the offer has passed its expiry date." : "."}</p>
              )}
              {!closed && (
                <form action={closeOffer} className="space-y-2 border-t border-line pt-3">
                  {hidden}
                  <input name="reason" className="input" placeholder="Reason (optional)" />
                  <div className="flex gap-2">
                    <SubmitButton size="sm" variant="secondary" name="to" value="withdrawn" confirm="Withdraw this offer?">Withdraw</SubmitButton>
                    {offer.status === "sent" && <SubmitButton size="sm" variant="secondary" name="to" value="expired">Mark expired</SubmitButton>}
                  </div>
                </form>
              )}
              {closed && <p className="text-sm text-muted">This offer is closed.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
