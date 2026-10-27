import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName } from "@/lib/lookup";
import { fmtDate, fmtDateTime, pkr } from "@/lib/format";
import { STAGES } from "@/lib/types";
import { Card, Flash, KeyValue, LinkButton, StatusBadge, Stepper } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { withdrawApplication } from "../../actions";

const STAGE_HELP: Record<string, string> = {
  applied: "We've received your application. Our team reviews every application.",
  screening: "Your CV is being reviewed against the role's requirements.",
  shortlisted: "Good news: you've been shortlisted! We'll contact you about an interview.",
  interview: "Interview stage. Check your interviews below for times and links.",
  verification: "We're checking references and completing background checks.",
  offer: "An offer is being prepared or has been sent to you.",
  hired: "Congratulations and welcome aboard!",
};

export default async function MyApplication({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(["candidate"]);
  const { id } = await params;
  const sp = await searchParams;
  const d = db();
  const cand = d.candidates.find((c) => c.userId === user.id);
  const a = d.applications.find((x) => x.id === id && x.candidateId === cand?.id);
  if (!a) notFound();
  const p = d.postings.find((x) => x.id === a.postingId);
  const idx = STAGES.findIndex((s) => s.key === a.stage);
  const closed = a.status === "rejected" || a.status === "withdrawn";
  const interviews = d.interviews.filter((i) => i.applicationId === a.id && i.status !== "cancelled");
  const offer = d.offers.find((o) => o.applicationId === a.id && ["sent", "accepted", "declined"].includes(o.status));
  const ecib = d.ecib.find((e) => e.applicationId === a.id);
  const letter = d.letters.find((l) => l.applicationId === a.id);
  const feedbackGiven = d.surveys.some((s) => s.applicationId === a.id && s.touchpoint === "application" && s.userId === user.id);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/me" className="text-sm text-muted hover:text-brand">← My applications</Link>
      <Flash msg={sp.msg} err={sp.err} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{p?.title}</h1>
          <p className="text-sm text-muted">{p?.city} · {masterName(d, p?.departmentId)} · Reference {a.code}</p>
        </div>
        {closed ? <StatusBadge status={a.status} label={a.status === "rejected" ? "Not progressed" : "Withdrawn"} /> : <StatusBadge status={a.status === "hired" ? "hired" : "in_progress"} label={a.status === "hired" ? "Hired" : "In progress"} />}
      </div>
      <Card>
        <Stepper steps={STAGES.map((s) => s.label)} current={a.status === "hired" ? STAGES.length : idx} failed={closed} />
        <p className="mt-5 rounded-lg bg-paper p-3 text-sm">
          {a.status === "rejected"
            ? "Thank you for your interest. We won't be moving forward with this application, but we'd love to see you apply for other roles. Your profile stays in our talent pool if you opted in."
            : a.status === "withdrawn"
              ? "You withdrew this application."
              : STAGE_HELP[a.stage]}
        </p>
      </Card>
      {(interviews.length > 0 || offer || ecib || letter) && (
        <Card title="Your next steps">
          <ul className="divide-y divide-line text-sm">
            {interviews.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{i.mode === "recorded_video" ? "🎬" : i.mode === "live_video" ? "🎥" : "🏢"} {i.title} · {i.mode === "recorded_video" ? `complete by ${fmtDateTime(i.start)}` : fmtDateTime(i.start)} <StatusBadge status={i.status} /></span>
                <LinkButton href={`/me/interviews/${i.id}`} size="sm" variant="secondary">Open</LinkButton>
              </li>
            ))}
            {ecib && (
              <li className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>🛡️ Background check <StatusBadge status={ecib.status} /></span>
                {ecib.status === "awaiting_consent" && <LinkButton href={`/me/verification/${a.id}`} size="sm">Give consent</LinkButton>}
              </li>
            )}
            {offer && (
              <li className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>🤝 Offer {offer.code} · {pkr(offer.grossMonthly)} / month <StatusBadge status={offer.status} /></span>
                <LinkButton href={`/me/offers/${offer.id}`} size="sm" variant={offer.status === "sent" ? "primary" : "secondary"}>{offer.status === "sent" ? "Respond" : "View"}</LinkButton>
              </li>
            )}
            {letter && (
              <li className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>✉️ Appointment letter {letter.ref} <StatusBadge status={letter.status} /></span>
                <LinkButton href={`/me/letters/${letter.id}`} size="sm" variant="secondary">Open</LinkButton>
              </li>
            )}
          </ul>
        </Card>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Timeline">
          <ol className="relative space-y-4 border-l border-line pl-5">
            <li className="relative"><span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-brand" /><div className="text-sm font-medium">Application submitted</div><div className="text-xs text-muted">{fmtDateTime(a.createdAt)}</div></li>
            {a.stageHistory.filter((h) => h.stage !== "applied").map((h, i) => (
              <li key={i} className="relative"><span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-brand" /><div className="text-sm font-medium">Moved to {STAGES.find((s) => s.key === h.stage)?.label}</div><div className="text-xs text-muted">{fmtDateTime(h.at)}</div></li>
            ))}
            {closed && (
              <li className="relative"><span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-bad" /><div className="text-sm font-medium">{a.status === "withdrawn" ? "Withdrawn" : "Closed"}</div><div className="text-xs text-muted">{fmtDateTime(a.updatedAt)}</div></li>
            )}
          </ol>
        </Card>
        <Card title="What you submitted">
          <KeyValue items={[["Applied on", fmtDate(a.createdAt)], ["Expected salary", a.expectedSalary ? pkr(a.expectedSalary) : "—"], ["Notice period", a.noticePeriodDays ? `${a.noticePeriodDays} days` : "Immediate"], ["Source", masterName(d, a.sourceId)]]} />
          {a.coverNote && <p className="mt-3 rounded bg-paper p-2 text-sm">“{a.coverNote}”</p>}
          {p && <Link href={`/careers/${p.slug}`} className="mt-3 inline-block text-sm text-brand">View job advert →</Link>}
        </Card>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-line bg-surface p-4">
        <div className="text-sm">
          <div className="font-medium">How was applying?</div>
          <p className="text-muted">{feedbackGiven ? "Thanks for your feedback!" : "Two quick questions help us improve the experience for everyone."}</p>
          {!feedbackGiven && <LinkButton href={`/me/feedback?touchpoint=application&application=${a.id}`} size="sm" variant="secondary" className="mt-2">Give feedback</LinkButton>}
        </div>
        {a.status === "active" && a.stage !== "hired" && (
          <form action={withdrawApplication} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={a.id} />
            <label className="block"><span className="label">Reason (optional)</span><input name="reason" className="input w-56" placeholder="e.g. accepted another offer" /></label>
            <SubmitButton variant="danger" size="sm" confirm="Withdraw this application? This cannot be undone.">Withdraw application</SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
