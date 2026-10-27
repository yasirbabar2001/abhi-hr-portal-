import { db } from "@/lib/store";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { submitReference } from "./actions";

export const metadata = { title: "Reference request", robots: { index: false } };

function Rating({ name, label }: { name: string; label: string }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
            <input type="radio" name={name} value={n} required className="accent-[var(--color-brand)]" />
            {n}
          </label>
        ))}
      </div>
      <span className="hint block">1 = well below expectations · 5 = outstanding</span>
    </fieldset>
  );
}

export default async function ReferencePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const d = db();
  const ref = d.references.find((r) => r.token === token);
  const app = ref ? d.applications.find((a) => a.id === ref.applicationId) : undefined;
  const cand = app ? d.candidates.find((c) => c.id === app.candidateId) : undefined;
  const post = app ? d.postings.find((p) => p.id === app.postingId) : undefined;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-bold text-white">A</span>
          <span className="text-sm font-semibold">{d.settings.companyName}</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        {!ref || !cand ? (
          <div className="rounded-xl border border-line bg-surface p-8 text-center">
            <h1 className="text-xl font-semibold">Link not found</h1>
            <p className="mt-2 text-sm text-muted">This reference link is not valid. Please check the link or contact {d.settings.supportEmail}.</p>
          </div>
        ) : sp.done || ref.status !== "requested" ? (
          <div className="rounded-xl border border-ok/30 bg-ok-bg p-8 text-center">
            <div className="text-4xl">🙏</div>
            <h1 className="mt-2 text-xl font-semibold">Thank you, {ref.refereeName.split(" ")[0]}</h1>
            <p className="mt-2 text-sm text-muted">Your reference has been received. It is confidential and is used only to support our hiring decision. You can close this page.</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Reference for {cand.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {cand.name} has applied for the role of <strong>{post?.title}</strong> and named you as a referee ({ref.relationship.toLowerCase()}). This takes about three minutes. Your answers are confidential and are not shared with the candidate.
            </p>
            <div className="mt-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
              <Flash err={sp.err} />
              <form action={submitReference} className="space-y-5">
                <input type="hidden" name="token" value={token} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label><span className="label">In what capacity did you know them?</span><input name="capacity" className="input" defaultValue={ref.relationship} /></label>
                  <label><span className="label">For how long?</span><input name="period" className="input" placeholder="e.g. 2 years (2023–2025)" /></label>
                </div>
                <Rating name="performance" label="Quality of work and results" />
                <Rating name="integrity" label="Honesty and integrity" />
                <Rating name="teamwork" label="Teamwork and attitude" />
                <fieldset>
                  <legend className="label">Would you work with or re-hire this person again?</legend>
                  <div className="flex gap-3 text-sm">
                    <label className="flex items-center gap-1.5"><input type="radio" name="rehire" value="yes" required /> Yes</label>
                    <label className="flex items-center gap-1.5"><input type="radio" name="rehire" value="no" /> No</label>
                  </div>
                </fieldset>
                <label className="block"><span className="label">Anything else we should know?</span><textarea name="comments" className="input" maxLength={3000} placeholder="Strengths, areas to develop, reason for leaving…" /></label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="declaration" required className="mt-1" />
                  <span>I confirm that the information I have given is true to the best of my knowledge, and that I am {ref.refereeName}.</span>
                </label>
                <SubmitButton>Submit reference</SubmitButton>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
