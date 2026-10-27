import Link from "next/link";
import clsx from "clsx";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterList, masterName } from "@/lib/lookup";
import { displayName, STAGE_LABEL } from "@/lib/hiring";
import { fmtDate, pkr } from "@/lib/format";
import { Badge, Card, EmptyState, Flash, PageHeader, Progress, Tabs } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { ScoreBadge } from "@/components/hiring/StageControls";
import { bulkDecision, rescreen } from "../applications/actions";

export const metadata = { title: "CV screening" };

export default async function ScreeningPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/screening");
  const sp = await searchParams;
  const d = db();
  const queue = d.applications.filter((a) => a.status === "active" && (a.stage === "applied" || a.stage === "screening"));
  const postings = d.postings.filter((p) => queue.some((a) => a.postingId === p.id) || p.status === "open");
  const postingId = sp.posting && postings.some((p) => p.id === sp.posting) ? sp.posting : postings[0]?.id;
  const posting = d.postings.find((p) => p.id === postingId);
  const forcedBlind = d.settings.blindScreening;
  const blind = forcedBlind || sp.blind === "1";
  const threshold = d.settings.autoShortlistThreshold;
  const rows = queue
    .filter((a) => a.postingId === postingId)
    .sort((a, b) => Number(b.screening?.knockoutPassed ?? 0) - Number(a.screening?.knockoutPassed ?? 0) || (b.screening?.score ?? -1) - (a.screening?.score ?? -1));
  const suggested = rows.filter((a) => a.screening?.knockoutPassed && (a.screening?.score ?? 0) >= threshold);
  const base = `/hr/screening?posting=${postingId ?? ""}${sp.blind === "1" ? "&blind=1" : ""}`;
  const reasons = masterList(d, "rejection_reason");

  return (
    <div>
      <PageHeader
        title="CV screening"
        subtitle="Explainable, rule-based scoring against each job's criteria. You make the decision; the score just puts the strongest CVs first."
        actions={
          posting && (
            <form action={rescreen}>
              <input type="hidden" name="postingId" value={posting.id} />
              <input type="hidden" name="back" value={base} />
              <SubmitButton variant="secondary">↻ Re-score all for this job</SubmitButton>
            </form>
          )
        }
      />
      <Flash msg={sp.msg} err={sp.err} />
      {postings.length === 0 ? (
        <EmptyState title="Nothing to screen" body="New applications appear here as soon as candidates apply." />
      ) : (
        <>
          <Tabs
            active={postingId ?? ""}
            tabs={postings.map((p) => ({
              key: p.id,
              href: `/hr/screening?posting=${p.id}${sp.blind === "1" ? "&blind=1" : ""}`,
              label: `${p.title} · ${p.city}`,
              count: queue.filter((a) => a.postingId === p.id).length,
            }))}
          />
          {posting && (
            <div className="mb-4 grid gap-4 lg:grid-cols-3">
              <Card title="Criteria for this job" className="lg:col-span-2">
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <span><span className="text-muted">Minimum qualification:</span> {masterName(d, posting.criteria.minQualificationId, "Any")}</span>
                  <span><span className="text-muted">Experience:</span> {posting.criteria.minExperienceYears}+ years</span>
                  <span><span className="text-muted">Cities:</span> {posting.criteria.preferredCities.join(", ") || "Any"}</span>
                  <span><span className="text-muted">Knock-out questions:</span> {posting.knockoutQuestions.length}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {posting.criteria.keywords.map((k) => <Badge key={k}>{k}</Badge>)}
                </div>
              </Card>
              <Card title="Fair screening">
                <p className="text-sm text-muted">
                  {forcedBlind ? "Blind screening is switched on for the whole portal." : "Hide names, employers and institutions to reduce bias."}
                </p>
                {!forcedBlind && (
                  <Link href={sp.blind === "1" ? `/hr/screening?posting=${postingId}` : `/hr/screening?posting=${postingId}&blind=1`} className="mt-2 inline-block text-sm font-medium text-brand">
                    {blind ? "👁 Show identities" : "🙈 Screen blind"}
                  </Link>
                )}
              </Card>
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState title="Queue is clear" body="Every application for this job has been screened. Shortlisted candidates are in Shortlisting." action={<Link href="/hr/shortlisting" className="text-brand">Go to shortlisting →</Link>} />
          ) : (
            <form action={bulkDecision}>
              <input type="hidden" name="back" value={base} />
              <div className="sticky top-14 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface/95 p-3 shadow-sm backdrop-blur">
                <span className="text-sm text-muted">With selected:</span>
                <SubmitButton name="decision" value="shortlist" size="sm">✓ Shortlist</SubmitButton>
                <SubmitButton name="decision" value="hold" size="sm" variant="secondary">⏸ Hold</SubmitButton>
                <select name="reasonId" className="input w-auto py-1 text-xs" aria-label="Rejection reason">
                  <option value="">Rejection reason…</option>
                  {reasons.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <SubmitButton name="decision" value="reject" size="sm" variant="danger" confirm="Decline the selected candidates? They will be notified politely.">✕ Decline</SubmitButton>
                {suggested.length > 0 && (
                  <span className="ml-auto text-xs text-ok">★ {suggested.length} suggested (score ≥ {threshold}% and knock-outs passed) are pre-selected</span>
                )}
              </div>
              <div className="overflow-x-auto rounded-xl border border-line bg-surface">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-8"><span className="sr-only">Select</span></th>
                      <th>Candidate</th>
                      <th>Match</th>
                      <th>Knock-outs</th>
                      <th>Matched keywords</th>
                      <th>Experience</th>
                      <th>Expected</th>
                      <th>Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => {
                      const c = d.candidates.find((x) => x.id === a.candidateId);
                      const isSuggested = suggested.includes(a);
                      const s = a.screening;
                      return (
                        <tr key={a.id} className={clsx(isSuggested && "bg-ok-bg/40")}>
                          <td><input type="checkbox" name="ids" value={a.id} defaultChecked={isSuggested} aria-label={`Select ${a.code}`} /></td>
                          <td className="min-w-56">
                            <Link href={`/hr/applications/${a.id}`} className="font-medium hover:text-brand">
                              {isSuggested && <span className="text-ok">★ </span>}
                              {displayName(d, c, a, blind)}
                            </Link>
                            <div className="text-xs text-muted">
                              {c?.currentTitle}
                              {!blind && c?.currentEmployer ? ` at ${c.currentEmployer}` : ""} · {masterName(d, c?.qualificationId)}
                              {!blind && c?.institution ? `, ${c.institution}` : ""} · {c?.city}
                            </div>
                            {s && (
                              <details className="mt-1">
                                <summary className="cursor-pointer text-xs text-brand">Why this score?</summary>
                                <ul className="mt-2 w-64 space-y-1.5">
                                  {s.breakdown.map((b) => (
                                    <li key={b.label} className="text-xs">
                                      <div className="flex justify-between"><span>{b.label}</span><span className="tabular-nums">{b.points}/{b.max}</span></div>
                                      <Progress value={(b.points / b.max) * 100} />
                                      <div className="text-muted">{b.note}</div>
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </td>
                          <td><ScoreBadge score={s?.score} /></td>
                          <td>{s ? (s.knockoutPassed ? <Badge tone="ok">Passed</Badge> : <Badge tone="bad">Failed</Badge>) : "—"}</td>
                          <td className="max-w-56">
                            <div className="flex flex-wrap gap-1">
                              {s?.matchedKeywords.map((k) => <Badge key={k} tone="brand">{k}</Badge>)}
                              {s && s.matchedKeywords.length === 0 && <span className="text-xs text-muted">None</span>}
                            </div>
                          </td>
                          <td className="tabular-nums">{c?.totalExperienceYears ?? 0} yrs</td>
                          <td className="whitespace-nowrap">
                            {pkr(a.expectedSalary)}
                            {posting?.salaryMax && a.expectedSalary && a.expectedSalary > posting.salaryMax && <div className="text-xs text-warn">Above range</div>}
                          </td>
                          <td>
                            <Badge tone={a.decision === "hold" ? "warn" : "info"}>{a.decision === "hold" ? "On hold" : STAGE_LABEL[a.stage]}</Badge>
                            <div className="text-xs text-muted">{fmtDate(a.createdAt)}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
