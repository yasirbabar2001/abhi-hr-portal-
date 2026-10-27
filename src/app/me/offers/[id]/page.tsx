import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName } from "@/lib/lookup";
import { OfferLetter, offerIsExpired } from "@/lib/offers/OfferLetter";
import { fmtDate, fmtDateTime, pkr, relative } from "@/lib/format";
import { Card, Flash, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { PrintButton, SubmitButton } from "@/components/forms";
import { acceptOffer, counterOffer, declineOffer } from "./actions";

export const metadata = { title: "My offer" };

export default async function MyOffer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(["candidate"]);
  const { id } = await params;
  const sp = await searchParams;
  const d = db();
  const offer = d.offers.find((o) => o.id === id);
  const app = offer ? d.applications.find((a) => a.id === offer.applicationId) : undefined;
  const cand = app ? d.candidates.find((c) => c.id === app.candidateId) : undefined;
  // Candidates only see offers that have been sent to them.
  if (!offer || !cand || cand.userId !== user.id || ["draft", "pending_approval", "approved"].includes(offer.status)) notFound();
  const expired = offerIsExpired(offer);
  const open = offer.status === "sent" && !expired;
  const letter = d.letters.find((l) => l.offerId === offer.id);
  const hidden = <input type="hidden" name="offerId" value={offer.id} />;

  if (sp.view === "letter") {
    return (
      <div>
        <div className="no-print mb-4 flex items-center justify-between">
          <Link href={`/me/offers/${offer.id}`} className="text-sm text-muted hover:text-brand">← Back to my offer</Link>
          <PrintButton />
        </div>
        <OfferLetter d={d} offer={offer} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={{ href: app ? `/me/applications/${app.id}` : "/me", label: "My application" }}
        title={open ? "Congratulations, you have an offer! 🎉" : "Your offer"}
        subtitle={<>{masterName(d, offer.designationId)} · {masterName(d, offer.branchId)} · <StatusBadge status={expired ? "expired" : offer.status} /></>}
        actions={<LinkButton href={`/me/offers/${offer.id}?view=letter`} variant="secondary">View / print offer letter</LinkButton>}
      />
      <Flash msg={sp.msg} err={sp.err} />

      {offer.status === "accepted" && (
        <div className="mb-6 rounded-xl border border-ok/30 bg-ok-bg p-5">
          <div className="font-medium">You accepted this offer on {fmtDateTime(offer.candidateResponse?.at)}.</div>
          <p className="mt-1 text-sm text-muted">
            {letter ? "Your appointment letter is ready." : "Our HR team will issue your appointment letter shortly."} Meanwhile, start your pre-joining checklist so day one goes smoothly.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {letter && <LinkButton href={`/me/letters/${letter.id}`}>Open appointment letter</LinkButton>}
            <LinkButton href="/me/onboarding" variant={letter ? "secondary" : "primary"}>Start onboarding</LinkButton>
            <LinkButton href={`/me/feedback?touchpoint=offer&application=${offer.applicationId}`} variant="ghost">Tell us how the process felt</LinkButton>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-5">
        <Card title="Your package" className="md:col-span-3">
          <div className="mb-4 rounded-lg bg-brand-soft p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-muted">Gross monthly salary</div>
            <div className="text-3xl font-semibold text-brand-2 tabular-nums">{pkr(offer.grossMonthly)}</div>
          </div>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-line"><td className="py-1.5">Basic salary</td><td className="text-right tabular-nums">{pkr(offer.basicSalary)}</td></tr>
              {offer.allowances.map((a) => (
                <tr key={a.name} className="border-b border-line"><td className="py-1.5">{a.name}</td><td className="text-right tabular-nums">{pkr(a.amount)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><div className="text-xs text-muted">Position</div>{masterName(d, offer.designationId)} ({masterName(d, offer.gradeId)})</div>
            <div><div className="text-xs text-muted">Department</div>{masterName(d, offer.departmentId)}</div>
            <div><div className="text-xs text-muted">Location</div>{masterName(d, offer.branchId)}</div>
            <div><div className="text-xs text-muted">Joining date</div>{fmtDate(offer.joiningDate)}</div>
            <div><div className="text-xs text-muted">Probation</div>{offer.probationMonths} months</div>
            <div><div className="text-xs text-muted">Respond by</div>{fmtDate(offer.expiresAt)}{open && ` (${relative(offer.expiresAt)})`}</div>
          </div>
          <div className="mt-4 text-sm"><div className="text-xs text-muted">Benefits</div><ul className="mt-1 space-y-1">{offer.benefits.map((b) => <li key={b}>✓ {b}</li>)}</ul></div>
        </Card>

        <div className="space-y-4 md:col-span-2">
          {open ? (
            <>
              <Card title="Accept the offer">
                <form action={acceptOffer} className="space-y-3 text-sm">
                  {hidden}
                  <label className="flex items-start gap-2">
                    <input type="checkbox" name="agree" required className="mt-1" />
                    <span>I have read the offer letter and accept this offer on the terms described.</span>
                  </label>
                  <label className="block">
                    <span className="label">Type your full name to sign</span>
                    <input name="signature" required className="input font-serif italic" placeholder={cand.name} autoComplete="off" />
                    <span className="hint block">Your typed name, the time and your IP address form your e-signature.</span>
                  </label>
                  <SubmitButton className="w-full">Accept offer</SubmitButton>
                </form>
              </Card>
              <Card title="Have a question about pay?">
                {offer.counterOffer ? (
                  <p className="text-sm text-muted">You asked for {pkr(offer.counterOffer.requested)} {relative(offer.counterOffer.at)}. HR is reviewing it; you can still accept the current offer.</p>
                ) : (
                  <details>
                    <summary className="cursor-pointer text-sm text-brand">Request a change</summary>
                    <form action={counterOffer} className="mt-3 space-y-2">
                      {hidden}
                      <label className="block"><span className="label">Gross monthly salary you are asking for (PKR)</span><input name="requested" type="number" min={offer.grossMonthly + 1} required className="input" /></label>
                      <textarea name="note" className="input" placeholder="Help us understand, e.g. current package, other offers" />
                      <SubmitButton variant="secondary">Send request</SubmitButton>
                    </form>
                  </details>
                )}
              </Card>
              <Card title="Decline">
                <details>
                  <summary className="cursor-pointer text-sm text-muted">I don&apos;t want to accept this offer</summary>
                  <form action={declineOffer} className="mt-3 space-y-2">
                    {hidden}
                    <select name="reason" className="input" required defaultValue="">
                      <option value="" disabled>Choose a reason</option>
                      <option>Accepted another offer</option>
                      <option>Salary or benefits</option>
                      <option>Location / commute</option>
                      <option>Staying with current employer</option>
                      <option>Personal reasons</option>
                    </select>
                    <SubmitButton variant="danger" confirm="Decline this offer? This cannot be undone.">Decline offer</SubmitButton>
                  </form>
                </details>
              </Card>
            </>
          ) : (
            <Card title="Status">
              <p className="text-sm text-muted">
                {offer.status === "accepted" && "Accepted. Welcome to the team!"}
                {offer.status === "declined" && `You declined this offer on ${fmtDate(offer.candidateResponse?.at)}.`}
                {offer.status === "withdrawn" && "This offer has been withdrawn."}
                {expired && `This offer expired on ${fmtDate(offer.expiresAt)}. Please contact ${d.settings.supportEmail} if you are still interested.`}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
