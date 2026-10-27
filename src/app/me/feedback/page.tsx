import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { Card, Flash, LinkButton, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { TOUCHPOINTS } from "@/lib/analytics/metrics";
import { submitFeedback } from "./actions";

export const metadata = { title: "Share your feedback" };

const FACES = ["😞", "🙁", "😐", "🙂", "😄"];

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(["candidate"]);
  const sp = await searchParams;
  const d = db();
  const tp = TOUCHPOINTS.find((t) => t.key === sp.touchpoint) ?? TOUCHPOINTS[0]!;
  const cand = d.candidates.find((c) => c.userId === user.id);
  const app = sp.application ? d.applications.find((a) => a.id === sp.application && a.candidateId === cand?.id) : undefined;
  const posting = app ? d.postings.find((p) => p.id === app.postingId) : undefined;
  const already = d.surveys.find((s) => s.userId === user.id && s.touchpoint === tp.key && (s.applicationId ?? "") === (app?.id ?? ""));

  if (sp.done || already) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <div className="text-5xl">💚</div>
        <h1 className="mt-3 text-2xl font-semibold">Thank you for your feedback</h1>
        <p className="mt-2 text-sm text-muted">Your answers go straight to our talent team and help us make hiring better for everyone. Responses are reviewed in aggregate.</p>
        <div className="mt-6"><LinkButton href="/me">Back to my applications</LinkButton></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={`How was the ${tp.label.toLowerCase()} step?`}
        subtitle={posting ? `About your application for ${posting.title}. Takes under a minute.` : "Takes under a minute. Your honest view helps us improve."}
        back={{ href: "/me", label: "My applications" }}
      />
      <Flash err={sp.err} />
      <Card>
        <form action={submitFeedback} className="space-y-7">
          <input type="hidden" name="touchpoint" value={tp.key} />
          {app && <input type="hidden" name="application" value={app.id} />}
          <fieldset>
            <legend className="label">How likely are you to recommend ABHI as an employer to a friend?</legend>
            <div className="mt-2 grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, i) => (
                <label key={i} className="cursor-pointer">
                  <input type="radio" name="nps" value={i} required className="peer sr-only" />
                  <span className="flex h-10 items-center justify-center rounded-lg border border-line text-sm font-medium peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand hover:border-brand">
                    {i}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted"><span>Not at all likely</span><span>Extremely likely</span></div>
          </fieldset>
          <Scale name="csat" legend="Overall, how satisfied are you with this step?" />
          <Scale name="ease" legend="How easy was it?" lowLabel="Very difficult" highLabel="Very easy" />
          <label className="block">
            <span className="label">Anything we could do better? (optional)</span>
            <textarea name="comments" maxLength={2000} className="input" placeholder="Tell us what worked and what didn't." />
          </label>
          <div className="flex items-center gap-3">
            <SubmitButton>Send feedback</SubmitButton>
            <Link href="/me" className="text-sm text-muted hover:text-ink">Skip</Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Scale({ name, legend, lowLabel = "Very unhappy", highLabel = "Very happy" }: { name: string; legend: string; lowLabel?: string; highLabel?: string }) {
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      <div className="mt-2 flex gap-2">
        {FACES.map((f, i) => (
          <label key={i} className="cursor-pointer">
            <input type="radio" name={name} value={i + 1} required className="peer sr-only" />
            <span
              aria-label={`${i + 1} of 5`}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-line text-2xl grayscale peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:grayscale-0 peer-focus-visible:ring-2 peer-focus-visible:ring-brand hover:grayscale-0"
            >
              {f}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-1 flex w-[17rem] justify-between text-xs text-muted"><span>{lowLabel}</span><span>{highLabel}</span></div>
    </fieldset>
  );
}
