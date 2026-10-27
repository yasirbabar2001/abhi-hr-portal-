import type { Db, JobDescription, JobPosting, Requisition } from "@/lib/types";
import { masterList, masterName } from "@/lib/lookup";
import { todayInput } from "@/lib/format";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { CHANNELS } from "@/lib/careers";
import { savePosting } from "./actions";

const DEFAULT_BENEFITS = ["Provident fund and gratuity", "Health insurance for you and your family", "Subsidised staff loans", "Structured learning and certifications", "Annual performance bonus"];

export function PostingForm({ d, req, jd, posting }: { d: Db; req: Requisition; jd?: JobDescription; posting?: JobPosting }) {
  const p = posting;
  const branch = d.master.find((m) => m.id === (p?.branchId ?? req.branchId));
  return (
    <form action={savePosting} className="space-y-6">
      <input type="hidden" name="id" value={p?.id ?? ""} />
      <input type="hidden" name="requisitionId" value={req.id} />
      <Card title="Advert">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="label">Job title *</span><input name="title" className="input" defaultValue={p?.title ?? req.title} required /></label>
          <label className="block"><span className="label">Branch / office</span>
            <select name="branchId" className="input" defaultValue={p?.branchId ?? req.branchId}>
              {masterList(d, "branch").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="block"><span className="label">City *</span><input name="city" className="input" defaultValue={p?.city ?? branch?.meta?.city ?? ""} required /></label>
          <label className="block"><span className="label">Employment type</span>
            <select name="employmentTypeId" className="input" defaultValue={p?.employmentTypeId ?? req.employmentTypeId}>
              {masterList(d, "employment_type").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">Opens</span><input type="date" name="openDate" className="input" defaultValue={p?.openDate ?? todayInput()} required /></label>
            <label className="block"><span className="label">Closes</span><input type="date" name="closeDate" className="input" defaultValue={p?.closeDate ?? todayInput(21)} required /></label>
          </div>
          <label className="block sm:col-span-2"><span className="label">Summary *</span><textarea name="summary" className="input" defaultValue={p?.summary ?? jd?.summary} required /></label>
          <label className="block"><span className="label">What you will do</span><textarea name="responsibilities" rows={6} className="input" defaultValue={(p?.responsibilities ?? jd?.responsibilities ?? []).join("\n")} /><span className="hint block">One per line.</span></label>
          <label className="block"><span className="label">What you need</span><textarea name="requirements" rows={6} className="input" defaultValue={(p?.requirements ?? jd?.requirements ?? []).join("\n")} /><span className="hint block">One per line.</span></label>
          <label className="block sm:col-span-2"><span className="label">Benefits</span><textarea name="benefits" rows={4} className="input" defaultValue={(p?.benefits ?? DEFAULT_BENEFITS).join("\n")} /></label>
        </div>
      </Card>
      <Card title="Where to publish">
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="label">Channels</legend>
            <div className="grid grid-cols-2 gap-2">
              {CHANNELS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" name="channels" value={c} defaultChecked={p ? p.channels.includes(c) : c === "Careers website" || c === "LinkedIn"} /> {c}</label>
              ))}
            </div>
            <p className="hint">External job boards receive the advert through your usual account; the portal tracks which channels were used and where applicants came from.</p>
          </fieldset>
          <div className="space-y-3">
            <label className="block"><span className="label">Who can see it</span>
              <select name="visibility" className="input" defaultValue={p?.visibility ?? "both"}>
                <option value="both">Everyone (external & internal)</option>
                <option value="external">External candidates only</option>
                <option value="internal">Internal staff only</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="showSalary" defaultChecked={p?.showSalary ?? false} /> Show salary range on the advert</label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">Salary from</span><input type="number" name="salaryMin" className="input" defaultValue={p?.salaryMin ?? req.salaryMin} /></label>
              <label className="block"><span className="label">Salary to</span><input type="number" name="salaryMax" className="input" defaultValue={p?.salaryMax ?? req.salaryMax} /></label>
            </div>
          </div>
        </div>
      </Card>
      <Card title="Screening">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="label">Knock-out questions</span>
            <textarea name="knockouts" rows={3} className="input font-mono text-xs" defaultValue={(p?.knockoutQuestions ?? []).map((q) => `${q.question} | ${q.requiredAnswer}`).join("\n")} placeholder="Are you willing to work in the field? | yes" />
            <span className="hint block">One per line: <code>question | required answer (yes/no)</code>. Applicants who give a different answer are flagged.</span>
          </label>
          <label className="block"><span className="label">Minimum qualification</span>
            <select name="minQualificationId" className="input" defaultValue={p?.criteria.minQualificationId ?? jd?.minQualificationId ?? ""}>
              <option value="">Any</option>
              {masterList(d, "qualification").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="block"><span className="label">Minimum experience (years)</span><input type="number" step={0.5} min={0} name="minExperienceYears" className="input" defaultValue={p?.criteria.minExperienceYears ?? jd?.minExperienceYears ?? 0} /></label>
          <label className="block"><span className="label">Keywords</span><input name="keywords" className="input" defaultValue={(p?.criteria.keywords ?? jd?.keywords ?? []).join(", ")} /><span className="hint block">Comma-separated skills used for the match score.</span></label>
          <label className="block"><span className="label">Preferred cities</span><input name="preferredCities" className="input" defaultValue={(p?.criteria.preferredCities ?? [branch?.meta?.city ?? ""]).filter(Boolean).join(", ")} /></label>
        </div>
      </Card>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="intent" value="open">{p?.status === "open" ? "Save changes" : "Publish now"}</SubmitButton>
        {p?.status !== "open" && <SubmitButton name="intent" value="draft" variant="secondary">Save as draft</SubmitButton>}
      </div>
      <p className="hint">For requisition {req.code} · {masterName(d, req.departmentId)}</p>
    </form>
  );
}
