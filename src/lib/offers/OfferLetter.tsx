import type { Db, Offer } from "../types";
import { candidateOf, masterName } from "../lookup";
import { fmtDate, pkr } from "../format";

/** Printable offer letter (original wording). Used by HR and the candidate. */
export function OfferLetter({ d, offer }: { d: Db; offer: Offer }) {
  const { cand } = candidateOf(d, offer.applicationId);
  const s = d.settings;
  const designation = masterName(d, offer.designationId);
  return (
    <article className="print-area mx-auto max-w-[210mm] rounded-xl border border-line bg-white p-8 text-[13.5px] leading-relaxed shadow-sm sm:p-12">
      <header className="mb-8 flex items-start justify-between border-b-2 border-brand pb-4">
        <div>
          <div className="text-lg font-bold text-brand">{s.companyName}</div>
          <div className="text-xs text-muted">Human Resources · {s.supportEmail}</div>
        </div>
        <div className="text-right text-xs text-muted">
          <div>Ref: {offer.code}</div>
          <div>Date: {fmtDate(offer.createdAt)}</div>
        </div>
      </header>
      <p>
        <strong>{cand?.name}</strong>
        <br />
        {cand?.email}
      </p>
      <p className="mt-4 font-semibold">Subject: Offer of employment — {designation}</p>
      <p className="mt-4">Dear {cand?.name?.split(" ")[0]},</p>
      <p className="mt-3">
        Thank you for the time you have given us during our selection process. We are delighted to offer you the position of <strong>{designation}</strong> ({masterName(d, offer.gradeId)}) in our {masterName(d, offer.departmentId)} department, based at {masterName(d, offer.branchId)}, on the terms below.
      </p>
      <table className="my-5 w-full text-sm">
        <tbody>
          <tr className="border-b border-line"><td className="py-1.5">Basic salary</td><td className="py-1.5 text-right tabular-nums">{pkr(offer.basicSalary)}</td></tr>
          {offer.allowances.map((a) => (
            <tr key={a.name} className="border-b border-line"><td className="py-1.5">{a.name}</td><td className="py-1.5 text-right tabular-nums">{pkr(a.amount)}</td></tr>
          ))}
          <tr className="font-semibold"><td className="py-2">Gross monthly salary</td><td className="py-2 text-right tabular-nums">{pkr(offer.grossMonthly)}</td></tr>
        </tbody>
      </table>
      <p><strong>Benefits:</strong> {offer.benefits.join("; ")}.</p>
      <p className="mt-3">
        <strong>Employment type:</strong> {masterName(d, offer.employmentTypeId, "Permanent")}. <strong>Probation:</strong> {offer.probationMonths} months.{" "}
        <strong>Proposed joining date:</strong> {fmtDate(offer.joiningDate)}.
      </p>
      <p className="mt-3">
        This offer is subject to satisfactory reference and credit-history checks, verification of your documents, and medical fitness. A formal appointment letter with the full terms of employment will follow once you accept.
      </p>
      <p className="mt-3">
        Please confirm your acceptance through the candidate portal by <strong>{fmtDate(offer.expiresAt)}</strong>, after which this offer will lapse.
      </p>
      <p className="mt-6">We look forward to welcoming you to the team.</p>
      <p className="mt-6">
        Yours sincerely,
        <br />
        <br />
        Head of Human Resources
        <br />
        {s.companyName}
      </p>
      {offer.candidateResponse?.signatureName && offer.status === "accepted" && (
        <div className="mt-8 rounded-lg border border-ok/40 bg-ok-bg p-3 text-xs">
          Accepted electronically by <span className="font-serif text-sm italic">{offer.candidateResponse.signatureName}</span> on {fmtDate(offer.candidateResponse.at)}.
        </div>
      )}
    </article>
  );
}

export function offerIsExpired(offer: Offer) {
  return offer.status === "expired" || (offer.status === "sent" && new Date(offer.expiresAt).getTime() < Date.now());
}

export function activeOfferFor(d: Db, applicationId: string) {
  return d.offers.find((o) => o.applicationId === applicationId && !["declined", "withdrawn", "expired"].includes(o.status));
}

export function expiresWithinDays(offer: Offer, days: number) {
  return offer.status === "sent" && !offerIsExpired(offer) && new Date(offer.expiresAt).getTime() - Date.now() < days * 86_400_000;
}
