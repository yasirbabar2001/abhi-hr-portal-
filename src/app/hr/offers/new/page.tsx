import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { candidateOf, masterList, masterName } from "@/lib/lookup";
import { DEFAULT_ALLOWANCES, DEFAULT_BENEFITS } from "@/lib/offers/calc";
import { activeOfferFor } from "@/lib/offers/OfferLetter";
import { pkr, todayInput } from "@/lib/format";
import { Card, EmptyState, Flash, KeyValue, LinkButton, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { OfferFields } from "../OfferFields";
import { createOffer } from "./actions";
import type { MasterType } from "@/lib/types";

export const metadata = { title: "New offer" };

export default async function NewOffer({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/offers");
  const sp = await searchParams;
  const d = db();
  const appId = sp.application;
  const { app, cand, posting } = appId ? candidateOf(d, appId) : { app: undefined, cand: undefined, posting: undefined };

  if (!app || !cand) {
    const ready = d.applications.filter((a) => a.status === "active" && a.stage === "offer" && !activeOfferFor(d, a.id));
    return (
      <div className="max-w-3xl">
        <PageHeader back={{ href: "/hr/offers", label: "Offers" }} title="New offer" subtitle="Choose a candidate who has cleared verification." />
        {ready.length === 0 ? (
          <EmptyState title="No candidates are ready for an offer" body="Candidates appear here after they clear references and eCIB." action={<LinkButton href="/hr/verification" variant="secondary">Go to verification</LinkButton>} />
        ) : (
          <Card pad={false}>
            <ul className="divide-y divide-line">
              {ready.map((a) => {
                const c = candidateOf(d, a.id);
                return (
                  <li key={a.id} className="flex items-center justify-between p-4">
                    <div><div className="font-medium">{c.cand?.name}</div><div className="text-xs text-muted">{c.posting?.title}</div></div>
                    <LinkButton size="sm" href={`/hr/offers/new?application=${a.id}`}>Prepare offer</LinkButton>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  const existing = activeOfferFor(d, app.id);
  const req = d.requisitions.find((r) => r.id === posting?.requisitionId);
  const mid = req ? (req.salaryMin + req.salaryMax) / 2 : 100000;
  const basic = Math.round((mid / 1.55) / 500) * 500;
  const select = (name: string, type: MasterType, value?: string) => (
    <select name={name} defaultValue={value} className="input" required>
      {masterList(d, type).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader back={{ href: "/hr/offers", label: "Offers" }} title={`Offer for ${cand.name}`} subtitle={`${posting?.title} · ${app.code}`} />
      <Flash msg={sp.msg} err={sp.err} />
      {existing ? (
        <EmptyState title="An offer already exists" body={`${existing.code} is ${existing.status.replace(/_/g, " ")}.`} action={<LinkButton href={`/hr/offers/${existing.id}`}>Open offer</LinkButton>} />
      ) : (
        <form action={createOffer} className="space-y-4">
          <input type="hidden" name="applicationId" value={app.id} />
          <Card title="Candidate & requisition">
            <KeyValue
              items={[
                ["Candidate", `${cand.name} · ${cand.email}`],
                ["Current role", [cand.currentTitle, cand.currentEmployer].filter(Boolean).join(" at ") || "—"],
                ["Expected salary", pkr(app.expectedSalary)],
                ["Notice period", app.noticePeriodDays !== undefined ? `${app.noticePeriodDays} days` : "—"],
                ["Requisition", req ? `${req.code} · ${masterName(d, req.departmentId)}` : "—"],
                ["Approved range (gross)", req ? `${pkr(req.salaryMin)} – ${pkr(req.salaryMax)}` : "—"],
              ]}
            />
          </Card>
          <Card title="Position">
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="label">Designation</span>{select("designationId", "designation", req?.designationId)}</label>
              <label><span className="label">Grade</span>{select("gradeId", "grade", req?.gradeId)}</label>
              <label><span className="label">Department</span>{select("departmentId", "department", req?.departmentId)}</label>
              <label><span className="label">Branch / office</span>{select("branchId", "branch", req?.branchId)}</label>
              <label><span className="label">Employment type</span>{select("employmentTypeId", "employment_type", req?.employmentTypeId)}</label>
              <label><span className="label">Probation (months)</span><input name="probationMonths" type="number" min={0} max={12} defaultValue={6} className="input" /></label>
            </div>
          </Card>
          <Card title="Compensation">
            <OfferFields basic={basic} allowances={DEFAULT_ALLOWANCES(basic)} range={req ? { min: req.salaryMin, max: req.salaryMax } : undefined} />
            <label className="mt-4 block">
              <span className="label">Benefits (one per line)</span>
              <textarea name="benefits" className="input" rows={4} defaultValue={DEFAULT_BENEFITS.join("\n")} />
            </label>
          </Card>
          <Card title="Dates">
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="label">Proposed joining date</span><input type="date" name="joiningDate" required defaultValue={req?.targetStartDate && req.targetStartDate > todayInput() ? req.targetStartDate : todayInput(21)} className="input" /></label>
              <label><span className="label">Offer valid until</span><input type="date" name="expiresAt" required defaultValue={todayInput(d.settings.offerValidityDays)} className="input" /><span className="hint block">Default: {d.settings.offerValidityDays} days (Portal settings).</span></label>
            </div>
          </Card>
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="intent" value="submit">Submit for approval ({d.settings.offerApprovalChain.join(" → ")})</SubmitButton>
            <SubmitButton name="intent" value="draft" variant="secondary">Save as draft</SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
