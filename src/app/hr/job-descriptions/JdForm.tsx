import type { Db, JobDescription } from "@/lib/types";
import { masterList } from "@/lib/lookup";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { saveJd } from "./actions";

export function JdForm({ d, jd }: { d: Db; jd?: JobDescription }) {
  const sel = (name: string, type: Parameters<typeof masterList>[1], def?: string, required = true) => (
    <select name={name} className="input" defaultValue={def ?? ""} required={required}>
      <option value="">{required ? "Select…" : "None"}</option>
      {masterList(d, type).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  );
  return (
    <form action={saveJd} className="space-y-6">
      <input type="hidden" name="id" value={jd?.id ?? ""} />
      <Card title="Role">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="label">Title *</span><input name="title" className="input" defaultValue={jd?.title} required /></label>
          <label className="block"><span className="label">Department *</span>{sel("departmentId", "department", jd?.departmentId)}</label>
          <label className="block"><span className="label">Designation *</span>{sel("designationId", "designation", jd?.designationId)}</label>
          <label className="block"><span className="label">Grade *</span>{sel("gradeId", "grade", jd?.gradeId)}</label>
          <label className="block"><span className="label">Reports to</span><input name="reportsTo" className="input" defaultValue={jd?.reportsTo} /></label>
          <label className="block sm:col-span-2"><span className="label">Purpose of the role *</span><textarea name="summary" className="input" defaultValue={jd?.summary} required /></label>
        </div>
      </Card>
      <Card title="Duties & requirements">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="label">Key responsibilities</span><textarea name="responsibilities" rows={7} className="input" defaultValue={jd?.responsibilities.join("\n")} /><span className="hint block">One per line.</span></label>
          <label className="block"><span className="label">Requirements</span><textarea name="requirements" rows={7} className="input" defaultValue={jd?.requirements.join("\n")} /><span className="hint block">One per line.</span></label>
          <label className="block"><span className="label">Minimum qualification</span>{sel("minQualificationId", "qualification", jd?.minQualificationId, false)}</label>
          <label className="block"><span className="label">Minimum experience (years)</span><input type="number" min={0} step={0.5} name="minExperienceYears" className="input" defaultValue={jd?.minExperienceYears ?? 0} /></label>
          <label className="block sm:col-span-2"><span className="label">Screening keywords</span><input name="keywords" className="input" defaultValue={jd?.keywords.join(", ")} placeholder="e.g. microfinance, recovery, kyc" /><span className="hint block">Comma-separated. Used to score CVs when this JD is posted.</span></label>
        </div>
        <fieldset className="mt-4">
          <legend className="label">Competencies assessed at interview</legend>
          <div className="flex flex-wrap gap-3">
            {masterList(d, "competency").map((c) => (
              <label key={c.id} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="competencies" value={c.name} defaultChecked={jd ? jd.competencies.includes(c.name) : true} /> {c.name}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>
      {jd && (
        <label className="block max-w-xl"><span className="label">What changed? (version note)</span><input name="changeNote" className="input" placeholder="e.g. Updated experience requirement" /></label>
      )}
      <SubmitButton>{jd ? `Save as version ${jd.version + 1}` : "Create job description"}</SubmitButton>
    </form>
  );
}
