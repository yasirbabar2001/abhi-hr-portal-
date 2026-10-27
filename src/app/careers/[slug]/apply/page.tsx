import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterList } from "@/lib/lookup";
import { isPublic } from "@/lib/careers";
import { Card, Flash, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { apply } from "./actions";

export const metadata = { title: "Apply" };

export default async function ApplyPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const d = db();
  const p = d.postings.find((x) => x.slug === slug);
  if (!p || !isPublic(p)) notFound();
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/careers/${slug}/apply`)}&msg=${encodeURIComponent("Sign in or create an account to apply.")}`);
  if (user.role !== "candidate") {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-xl font-semibold">Staff accounts can&apos;t apply here</h1>
        <p className="mt-2 text-sm text-muted">You are signed in as staff. To apply as a candidate, sign out and use a candidate account.</p>
        <LinkButton href={`/careers/${slug}`} variant="secondary" className="mt-4">Back to the job</LinkButton>
      </div>
    );
  }
  const c = d.candidates.find((x) => x.userId === user.id);
  const existing = c ? d.applications.find((a) => a.postingId === p.id && a.candidateId === c.id && a.status !== "withdrawn") : undefined;
  if (existing) redirect(`/me/applications/${existing.id}?msg=You+have+already+applied+for+this+job.`);
  const cvName = c?.cvFileId ? d.files.find((f) => f.id === c.cvFileId)?.name : undefined;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/careers/${slug}`} className="text-sm text-muted hover:text-brand">← {p.title}</Link>
      <h1 className="mt-2 text-2xl font-semibold">Apply for {p.title}</h1>
      <p className="mt-1 text-sm text-muted">{p.city} · We&apos;ve filled in what we know from your profile. Changes here also update your profile.</p>
      <div className="mt-6"><Flash err={sp.err} /></div>
      <form action={apply} className="space-y-6">
        <input type="hidden" name="postingId" value={p.id} />
        <Card title="1. About you">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="label">Full name</span><input className="input bg-paper" value={user.name} readOnly /></label>
            <label className="block"><span className="label">Email</span><input className="input bg-paper" value={user.email} readOnly /></label>
            <label className="block"><span className="label">Mobile number *</span><input name="phone" className="input" defaultValue={c?.phone || user.phone} required /></label>
            <label className="block"><span className="label">CNIC *</span><input name="cnic" className="input" defaultValue={c?.cnic} placeholder="12345-1234567-1" required /></label>
            <label className="block"><span className="label">City you live in *</span><input name="city" className="input" defaultValue={c?.city} required /></label>
            <label className="block"><span className="label">LinkedIn (optional)</span><input name="linkedin" type="url" className="input" defaultValue={c?.linkedin} placeholder="https://linkedin.com/in/…" /></label>
          </div>
        </Card>
        <Card title="2. Experience & education">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="label">Current / last job title</span><input name="currentTitle" className="input" defaultValue={c?.currentTitle} placeholder="Or 'Fresh graduate'" /></label>
            <label className="block"><span className="label">Current / last employer</span><input name="currentEmployer" className="input" defaultValue={c?.currentEmployer} /></label>
            <label className="block"><span className="label">Total experience (years)</span><input name="experience" type="number" min={0} step={0.5} className="input" defaultValue={c?.totalExperienceYears ?? 0} /></label>
            <label className="block"><span className="label">Highest qualification</span>
              <select name="qualificationId" className="input" defaultValue={c?.qualificationId ?? ""}>
                <option value="">Select…</option>
                {masterList(d, "qualification").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">Institution</span><input name="institution" className="input" defaultValue={c?.institution} /></label>
            <label className="block"><span className="label">Key skills</span><input name="skills" className="input" defaultValue={c?.skills.join(", ")} placeholder="e.g. customer service, MS Excel, Urdu" /></label>
            <label className="block sm:col-span-2">
              <span className="label">CV (PDF or Word, max 10 MB){cvName ? "" : " *"}</span>
              <input name="cv" type="file" accept=".pdf,.doc,.docx,.rtf" className="input" required={!cvName} />
              {cvName && <span className="hint block">Using your saved CV <b>{cvName}</b>. Upload a new file to replace it.</span>}
            </label>
          </div>
        </Card>
        {p.knockoutQuestions.length > 0 && (
          <Card title="3. Screening questions">
            <div className="space-y-4">
              {p.knockoutQuestions.map((q) => (
                <fieldset key={q.id}>
                  <legend className="text-sm font-medium">{q.question} *</legend>
                  <div className="mt-1 flex gap-4 text-sm">
                    <label className="flex items-center gap-1.5"><input type="radio" name={`ko_${q.id}`} value="yes" required /> Yes</label>
                    <label className="flex items-center gap-1.5"><input type="radio" name={`ko_${q.id}`} value="no" /> No</label>
                  </div>
                </fieldset>
              ))}
            </div>
          </Card>
        )}
        <Card title={`${p.knockoutQuestions.length ? 4 : 3}. A little more`}>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block"><span className="label">Expected monthly salary (PKR)</span><input name="expectedSalary" type="number" min={0} step={1000} className="input" /></label>
            <label className="block"><span className="label">Notice period</span>
              <select name="noticePeriodDays" className="input" defaultValue="30">
                <option value="0">Immediately available</option><option value="15">15 days</option><option value="30">1 month</option><option value="60">2 months</option><option value="90">3 months</option>
              </select>
            </label>
            <label className="block"><span className="label">How did you hear about us?</span>
              <select name="sourceId" className="input" defaultValue="">
                <option value="">Select…</option>
                {masterList(d, "source").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label className="block sm:col-span-3"><span className="label">Why are you a good fit? (optional)</span><textarea name="coverNote" className="input" maxLength={2000} /></label>
          </div>
        </Card>
        <label className="flex items-start gap-2 rounded-xl border border-line bg-surface p-4 text-sm">
          <input type="checkbox" name="consent" required className="mt-1" />
          <span>I confirm the information is true and complete. I agree that {d.settings.shortName} may process my data for this and similar roles as described in the <Link href="/privacy" target="_blank" className="text-brand underline">privacy notice</Link>.</span>
        </label>
        <SubmitButton className="w-full sm:w-auto">Submit application</SubmitButton>
      </form>
    </div>
  );
}
