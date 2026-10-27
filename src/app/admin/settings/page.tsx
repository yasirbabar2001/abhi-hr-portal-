import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/store";
import { Card, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { EmployeeIdPreview } from "./EmployeeIdPreview";
import { saveSettings } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const s = db().settings;
  return (
    <div className="max-w-4xl">
      <PageHeader title="Portal settings" subtitle="Branding, numbering, approval chains and hiring rules. Every change is recorded in the audit trail." />
      <Flash msg={sp.msg} err={sp.err} />
      <form action={saveSettings} className="space-y-4">
        <Card title="Organisation & branding">
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="label">Legal name</span><input name="companyName" defaultValue={s.companyName} required className="input" /></label>
            <label><span className="label">Short name</span><input name="shortName" defaultValue={s.shortName} required className="input" /></label>
            <label>
              <span className="label">Brand colour</span>
              <div className="flex gap-2">
                <input type="color" defaultValue={s.primaryColor} name="primaryColor" className="h-9 w-14 cursor-pointer rounded border border-line" />
                <span className="hint self-center">Used on letters and the careers site</span>
              </div>
            </label>
            <label><span className="label">Careers contact email</span><input name="supportEmail" type="email" defaultValue={s.supportEmail} className="input" /></label>
            <label className="sm:col-span-2"><span className="label">Careers page introduction</span><textarea name="careersIntro" defaultValue={s.careersIntro} className="input" /></label>
          </div>
        </Card>

        <Card title="Employee ID generation">
          <p className="-mt-1 mb-3 text-sm text-muted">An employee ID is generated automatically when a new hire completes orientation.</p>
          <EmployeeIdPreview prefix={s.employeeIdPrefix} pattern={s.employeeIdPattern} nextSeq={s.nextEmployeeSeq} />
        </Card>

        <Card title="Approval chains">
          <p className="-mt-1 mb-3 text-sm text-muted">One step per line, in order. Changes apply to new requests; requests already in progress keep their steps.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <label><span className="label">Requisitions</span><textarea name="requisitionApprovalChain" defaultValue={s.requisitionApprovalChain.join("\n")} className="input min-h-28" /></label>
            <label><span className="label">Offers</span><textarea name="offerApprovalChain" defaultValue={s.offerApprovalChain.join("\n")} className="input min-h-28" /></label>
            <label><span className="label">Status changes</span><textarea name="statusChangeApprovalChain" defaultValue={s.statusChangeApprovalChain.join("\n")} className="input min-h-28" /></label>
          </div>
        </Card>

        <Card title="Screening & interviews">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="blindScreening" defaultChecked={s.blindScreening} className="mt-1" />
              <span><b>Blind screening.</b> Hide candidate names, photos and contact details during CV screening to reduce bias.</span>
            </label>
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="autoRejectKnockout" defaultChecked={s.autoRejectKnockout} className="mt-1" />
              <span><b>Auto-decline knock-out failures.</b> Applications that fail a mandatory question are declined automatically with a polite message.</span>
            </label>
            <label>
              <span className="label">Suggest shortlist at match score ≥</span>
              <input name="autoShortlistThreshold" type="number" min={0} max={100} defaultValue={s.autoShortlistThreshold} className="input" />
            </label>
            <label>
              <span className="label">Default interview length (minutes)</span>
              <input name="interviewDefaultMinutes" type="number" min={10} max={480} defaultValue={s.interviewDefaultMinutes} className="input" />
            </label>
          </div>
        </Card>

        <Card title="Offers, orientation & privacy">
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="label">Offer valid for (days)</span><input name="offerValidityDays" type="number" min={1} max={90} defaultValue={s.offerValidityDays} className="input" /></label>
            <label><span className="label">Orientation pass mark (%)</span><input name="orientationPassMark" type="number" min={0} max={100} defaultValue={s.orientationPassMark} className="input" /></label>
            <label>
              <span className="label">Keep unsuccessful candidates&apos; data for (months)</span>
              <input name="candidateDataRetentionMonths" type="number" min={1} max={120} defaultValue={s.candidateDataRetentionMonths} className="input" />
            </label>
            <label className="flex items-start gap-2 self-end text-sm">
              <input type="checkbox" name="surveysEnabled" defaultChecked={s.surveysEnabled} className="mt-1" />
              <span>Ask candidates and new hires for feedback after each step</span>
            </label>
          </div>
        </Card>

        <div className="sticky bottom-0 -mx-1 flex justify-end border-t border-line bg-paper/95 px-1 py-3">
          <SubmitButton>Save settings</SubmitButton>
        </div>
      </form>
    </div>
  );
}
