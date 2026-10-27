import { requireUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterList } from "@/lib/lookup";
import { fmtDate } from "@/lib/format";
import { profileCompleteness } from "@/lib/careers";
import { Card, Flash, LinkButton, Progress } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { requestDeletion, saveProfile } from "../actions";

export const metadata = { title: "My profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(["candidate"]);
  const sp = await searchParams;
  const d = db();
  const c = d.candidates.find((x) => x.userId === user.id);
  if (!c) return <p>Profile not found.</p>;
  const cv = c.cvFileId ? d.files.find((f) => f.id === c.cvFileId) : undefined;
  const comp = profileCompleteness(c);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My profile</h1>
        <p className="text-sm text-muted">A complete profile makes applying faster and helps us match you to the right roles.</p>
      </div>
      <Flash msg={sp.msg} err={sp.err} />
      <Card>
        <div className="flex items-center justify-between text-sm"><span className="font-medium">Profile {comp.pct}% complete</span>{comp.missing.length > 0 && <span className="text-xs text-muted">Missing: {comp.missing.join(", ")}</span>}</div>
        <div className="mt-2"><Progress value={comp.pct} tone={comp.pct === 100 ? "ok" : "brand"} /></div>
      </Card>
      <form action={saveProfile} className="space-y-6">
        <Card title="Personal details">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="label">Full name</span><input name="name" className="input" defaultValue={c.name} required /></label>
            <label className="block"><span className="label">Email</span><input className="input bg-paper" value={c.email} readOnly /></label>
            <label className="block"><span className="label">Mobile</span><input name="phone" className="input" defaultValue={c.phone} /></label>
            <label className="block"><span className="label">CNIC</span><input name="cnic" className="input" defaultValue={c.cnic} placeholder="12345-1234567-1" /></label>
            <label className="block"><span className="label">City</span><input name="city" className="input" defaultValue={c.city} /></label>
            <label className="block"><span className="label">LinkedIn</span><input name="linkedin" type="url" className="input" defaultValue={c.linkedin} /></label>
          </div>
        </Card>
        <Card title="Career">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="label">Current / last title</span><input name="currentTitle" className="input" defaultValue={c.currentTitle} /></label>
            <label className="block"><span className="label">Current / last employer</span><input name="currentEmployer" className="input" defaultValue={c.currentEmployer} /></label>
            <label className="block"><span className="label">Total experience (years)</span><input name="experience" type="number" min={0} step={0.5} className="input" defaultValue={c.totalExperienceYears} /></label>
            <label className="block"><span className="label">Highest qualification</span>
              <select name="qualificationId" className="input" defaultValue={c.qualificationId ?? ""}>
                <option value="">Select…</option>
                {masterList(d, "qualification").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">Institution</span><input name="institution" className="input" defaultValue={c.institution} /></label>
            <label className="block"><span className="label">Skills</span><input name="skills" className="input" defaultValue={c.skills.join(", ")} /><span className="hint block">Comma-separated.</span></label>
            <label className="block sm:col-span-2">
              <span className="label">CV</span>
              <input name="cv" type="file" accept=".pdf,.doc,.docx,.rtf" className="input" />
              {cv ? <span className="hint block">Current: <a href={`/api/files/${cv.id}`} className="text-brand underline">{cv.name}</a> · uploaded {fmtDate(cv.at)}</span> : <span className="hint block">PDF or Word, up to 10 MB.</span>}
            </label>
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="talentPool" defaultChecked={c.talentPool} className="mt-1" />
              <span>Keep me in the talent pool and contact me about suitable future roles.</span>
            </label>
          </div>
        </Card>
        <SubmitButton>Save profile</SubmitButton>
      </form>
      <Card title="Your data">
        <p className="text-sm text-muted">You can download everything we hold about you, or ask us to delete your account and data.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <LinkButton href="/me/profile/data" variant="secondary">⬇ Download my data</LinkButton>
          <form action={requestDeletion}><SubmitButton variant="danger" confirm="Send a request to delete your account and data?">Request account deletion</SubmitButton></form>
        </div>
      </Card>
    </div>
  );
}
