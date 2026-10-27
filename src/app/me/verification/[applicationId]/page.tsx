import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { fmtDateTime } from "@/lib/format";
import { Card, Flash, PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { giveConsent } from "./actions";

export const metadata = { title: "Background checks" };

const REF_LABEL: Record<string, string> = { requested: "Waiting for referee", received: "Received", verified: "Completed", failed: "Could not be completed" };

export default async function MyVerification({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser(["candidate"]);
  const { applicationId } = await params;
  const sp = await searchParams;
  const d = db();
  const app = d.applications.find((a) => a.id === applicationId);
  const cand = app ? d.candidates.find((c) => c.id === app.candidateId) : undefined;
  if (!app || !cand || cand.userId !== user.id) notFound();
  const post = d.postings.find((p) => p.id === app.postingId);
  const refs = d.references.filter((r) => r.applicationId === app.id);
  const ecibs = d.ecib.filter((e) => e.applicationId === app.id);
  const ecib = ecibs[ecibs.length - 1];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: `/me/applications/${app.id}`, label: "Back to my application" }} title="Background checks" subtitle={`${post?.title} · ${app.code}`} />
      <Flash msg={sp.msg} err={sp.err} />
      <div className="space-y-4">
        <Card title="Credit history check (eCIB)">
          {!ecib ? (
            <p className="text-sm text-muted">No credit check has been requested yet. We will let you know if one is needed.</p>
          ) : ecib.status === "awaiting_consent" ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg bg-info-bg p-4 text-info">
                <div className="font-medium">What is eCIB?</div>
                <p className="mt-1">
                  The electronic Credit Information Bureau (eCIB) is run by the State Bank of Pakistan. It records loans and credit cards held with banks and microfinance banks, and whether they have been repaid on time.
                </p>
                <div className="mt-3 font-medium">Why do we ask?</div>
                <p className="mt-1">
                  As a regulated bank, we check the credit history of people we hire into positions of trust. A past loan does not stop you being hired. We look only for serious unresolved defaults, and you will have the chance to explain anything we find.
                </p>
                <div className="mt-3 font-medium">What we will see</div>
                <p className="mt-1">Your outstanding loans, their status and any overdue amounts linked to your CNIC ({ecib.cnic}). We keep the report confidential and use it only for this hiring decision.</p>
              </div>
              <form action={giveConsent} className="space-y-3">
                <input type="hidden" name="applicationId" value={app.id} />
                <label className="flex items-start gap-2">
                  <input type="checkbox" name="agree" required className="mt-1" />
                  <span>
                    I, the undersigned, authorise {d.settings.companyName} to obtain my credit report from the State Bank of Pakistan&apos;s eCIB for the purpose of assessing my application for employment.
                  </span>
                </label>
                <label className="block max-w-sm">
                  <span className="label">Type your full name to sign</span>
                  <input name="signature" required className="input font-serif italic" placeholder={cand.name} autoComplete="off" />
                  <span className="hint block">Your typed name, the date and your IP address are recorded as your electronic signature.</span>
                </label>
                <SubmitButton>Give consent</SubmitButton>
              </form>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                Consent given on <strong>{fmtDateTime(ecib.consentAt)}</strong>.{" "}
                {["clear", "exception"].includes(ecib.status) ? "Your credit check is complete." : ecib.status === "adverse" ? "Our HR team will contact you about the result." : "The check is in progress."}
              </div>
              <StatusBadge status={["clear", "exception"].includes(ecib.status) ? "completed" : ecib.status === "adverse" ? "pending" : "in_progress"} label={["clear", "exception"].includes(ecib.status) ? "Completed" : ecib.status === "adverse" ? "Under review" : "In progress"} />
            </div>
          )}
        </Card>
        <Card title="References">
          {refs.length === 0 ? (
            <p className="text-sm text-muted">We have not contacted any referees yet. HR may ask you for referee details.</p>
          ) : (
            <ul className="divide-y divide-line">
              {refs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <div className="font-medium">{r.refereeName}</div>
                    <div className="text-xs text-muted">{r.relationship}{r.company && ` · ${r.company}`}</div>
                  </div>
                  <StatusBadge status={r.status === "verified" ? "completed" : r.status} label={REF_LABEL[r.status]} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">Reference answers are confidential, so we show only their progress here. Tip: let your referees know to expect our email.</p>
        </Card>
        <p className="text-center text-xs text-muted">Questions? Write to {d.settings.supportEmail} or <Link href="/me" className="text-brand underline">go to my applications</Link>.</p>
      </div>
    </div>
  );
}
