import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireInternal } from "@/lib/auth";
import { db } from "@/lib/store";
import { STAGES } from "@/lib/types";
import { masterName, userName } from "@/lib/lookup";
import { canSeeApplication, displayName, isBlind, MODE_LABEL, RECOMMENDATION_LABEL, stageIndex, STAGE_LABEL } from "@/lib/hiring";
import { fmtDate, fmtDateTime, pkr, relative } from "@/lib/format";
import { Avatar, Badge, Card, EmptyState, Flash, KeyValue, LinkButton, PageHeader, Progress, Stars, StatusBadge, Stepper } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { ScoreBadge, StageControls } from "@/components/hiring/StageControls";
import { addNote, reopenApplication, rescreen, setTags } from "../actions";

export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireInternal();
  const { id } = await params;
  const sp = await searchParams;
  const d = db();
  const app = d.applications.find((a) => a.id === id);
  if (!app) notFound();
  if (!canSeeApplication(d, user, id)) redirect("/hr/pipeline?err=You+do+not+have+access+to+that+application.");
  const cand = d.candidates.find((c) => c.id === app.candidateId);
  const posting = d.postings.find((p) => p.id === app.postingId);
  const req = posting ? d.requisitions.find((r) => r.id === posting.requisitionId) : undefined;
  const blind = isBlind(d, app);
  const name = displayName(d, cand, app);
  const back = `/hr/applications/${app.id}`;
  const isHr = user.role !== "hiring";

  const interviews = d.interviews.filter((i) => i.applicationId === app.id).sort((a, b) => a.start.localeCompare(b.start));
  const cards = d.scorecards.filter((s) => s.applicationId === app.id);
  const compAvg = new Map<string, { sum: number; n: number }>();
  for (const s of cards)
    for (const r of s.ratings) {
      const x = compAvg.get(r.competency) ?? { sum: 0, n: 0 };
      compAvg.set(r.competency, { sum: x.sum + r.score, n: x.n + 1 });
    }
  const overallAvg = cards.length ? cards.reduce((s, c) => s + c.overall, 0) / cards.length : 0;
  const refs = d.references.filter((r) => r.applicationId === app.id);
  const ecib = d.ecib.filter((e) => e.applicationId === app.id);
  const offers = d.offers.filter((o) => o.applicationId === app.id);
  const otherApps = cand ? d.applications.filter((a) => a.candidateId === cand.id && a.id !== app.id) : [];
  const stageIdx = stageIndex(app.stage);

  return (
    <div>
      <PageHeader
        back={{ href: "/hr/pipeline", label: "Pipeline" }}
        title={name}
        subtitle={
          <>
            {posting?.title} · {posting?.city} · <span className="font-mono">{app.code}</span> · applied {fmtDate(app.createdAt)}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {app.status === "active" && (
              <>
                <LinkButton href={`/hr/interviews/new?application=${app.id}`} variant="secondary">📅 Schedule interview</LinkButton>
                {isHr && <LinkButton href={`/hr/verification/${app.id}`} variant="secondary">🛡️ Verification</LinkButton>}
                {isHr && stageIdx >= stageIndex("interview") && <LinkButton href={`/hr/offers/new?application=${app.id}`} variant="secondary">🤝 Create offer</LinkButton>}
              </>
            )}
            {app.status === "rejected" && isHr && (
              <form action={reopenApplication}>
                <input type="hidden" name="id" value={app.id} />
                <SubmitButton variant="secondary">Reopen application</SubmitButton>
              </form>
            )}
          </div>
        }
      />
      <Flash msg={sp.msg} err={sp.err} />

      <div className="mb-6 rounded-xl border border-line bg-surface p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            Status: {app.status === "active" ? <Badge tone="info">{STAGE_LABEL[app.stage]}</Badge> : <StatusBadge status={app.status} />}
            {app.status === "rejected" && <span className="text-muted">· {masterName(d, app.rejectionReasonId, "no reason recorded")}</span>}
            {app.tags.map((t) => <Badge key={t} tone="brand">#{t}</Badge>)}
          </div>
          <StageControls d={d} app={app} back={back} />
        </div>
        <Stepper steps={STAGES.map((s) => s.label)} current={stageIdx} failed={app.status === "rejected"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Candidate profile" actions={blind && <Badge tone="warn">Blind screening: identity hidden until interview</Badge>}>
            <div className="flex items-start gap-4">
              <Avatar name={name} size={48} />
              <div className="flex-1">
                <KeyValue
                  items={[
                    ["Current role", cand?.currentTitle || "—"],
                    ["Employer", blind ? "Hidden" : cand?.currentEmployer || "—"],
                    ["Experience", `${cand?.totalExperienceYears ?? 0} years`],
                    ["Qualification", masterName(d, cand?.qualificationId)],
                    ["Institution", blind ? "Hidden" : cand?.institution || "—"],
                    ["City", cand?.city || "—"],
                    ["Email", blind ? "Hidden" : cand?.email],
                    ["Mobile", blind ? "Hidden" : cand?.phone],
                    ["CNIC", blind ? "Hidden" : cand?.cnic || "—"],
                    ["Expected salary", pkr(app.expectedSalary)],
                    ["Notice period", app.noticePeriodDays !== undefined ? `${app.noticePeriodDays} days` : "—"],
                    ["Source", masterName(d, app.sourceId)],
                  ]}
                />
                {cand && cand.skills.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1">
                    {cand.skills.map((s) => (
                      <Badge key={s} tone={app.screening?.matchedKeywords.some((k) => s.toLowerCase().includes(k.toLowerCase())) ? "ok" : "neutral"}>{s}</Badge>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  {cand?.cvFileId ? (
                    <a href={`/api/files/${cand.cvFileId}`} className="text-brand underline" target="_blank">📄 Download CV</a>
                  ) : (
                    <span className="text-muted">No CV uploaded</span>
                  )}
                  {cand?.linkedin && !blind && (
                    <a href={cand.linkedin} className="text-brand underline" target="_blank" rel="noreferrer">LinkedIn profile ↗</a>
                  )}
                </div>
                {app.coverNote && (
                  <blockquote className="mt-4 rounded-lg bg-paper p-3 text-sm italic text-ink">“{app.coverNote}”</blockquote>
                )}
              </div>
            </div>
          </Card>

          <Card
            title="CV screening"
            actions={
              isHr && (
                <form action={rescreen}>
                  <input type="hidden" name="id" value={app.id} />
                  <input type="hidden" name="back" value={back} />
                  <SubmitButton size="sm" variant="ghost">↻ Re-run</SubmitButton>
                </form>
              )
            }
          >
            {app.screening ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-3xl font-semibold tabular-nums">{app.screening.score}%</span>
                  <ScoreBadge score={app.screening.score} />
                  <Badge tone={app.screening.knockoutPassed ? "ok" : "bad"}>
                    Knock-out questions {app.screening.knockoutPassed ? "passed" : "failed"}
                  </Badge>
                </div>
                <ul className="space-y-2">
                  {app.screening.breakdown.map((b) => (
                    <li key={b.label}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{b.label} <span className="text-xs text-muted">· {b.note}</span></span>
                        <span className="tabular-nums text-muted">{b.points}/{b.max}</span>
                      </div>
                      <Progress value={(b.points / b.max) * 100} tone={b.points / b.max >= 0.7 ? "ok" : b.points / b.max >= 0.4 ? "warn" : "bad"} />
                    </li>
                  ))}
                </ul>
                {posting && posting.knockoutQuestions.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase text-muted">Knock-out answers</div>
                    <ul className="space-y-1 text-sm">
                      {posting.knockoutQuestions.map((q) => {
                        const ans = app.knockoutAnswers[q.id];
                        return (
                          <li key={q.id} className="flex items-start gap-2">
                            <span>{ans === q.requiredAnswer ? "✅" : "❌"}</span>
                            <span>{q.question} <span className="text-muted">— answered “{ans ?? "no answer"}”</span></span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted">Screened {fmtDateTime(app.screening.at)}. Scores are rule-based and explainable; final decisions are always made by a person.</p>
              </div>
            ) : (
              <p className="text-sm text-muted">Not screened yet.</p>
            )}
          </Card>

          <Card title={`Interviews & scorecards (${interviews.length})`} actions={app.status === "active" && <Link href={`/hr/interviews/new?application=${app.id}`} className="text-brand">+ Schedule</Link>}>
            {interviews.length === 0 ? (
              <p className="text-sm text-muted">No interviews yet.</p>
            ) : (
              <div className="space-y-4">
                <ul className="divide-y divide-line">
                  {interviews.map((i) => {
                    const sc = cards.filter((c) => c.interviewId === i.id);
                    return (
                      <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <div>
                          <Link href={`/hr/interviews/${i.id}`} className="font-medium hover:text-brand">Round {i.round}: {i.title}</Link>
                          <div className="text-xs text-muted">{MODE_LABEL[i.mode]} · {fmtDateTime(i.start)} · panel: {i.panel.map((p) => userName(d, p)).join(", ")}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={i.status} />
                          <span className="text-xs text-muted">{sc.length}/{i.panel.length} scorecards</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {cards.length > 0 && (
                  <div className="rounded-lg bg-paper p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium">Average across {cards.length} scorecard{cards.length > 1 ? "s" : ""}</span>
                      <span><Stars value={overallAvg} /> <span className="tabular-nums text-muted">{overallAvg.toFixed(1)}</span></span>
                    </div>
                    <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                      {[...compAvg.entries()].map(([k, v]) => (
                        <li key={k} className="flex justify-between">
                          <span>{k}</span>
                          <span className="tabular-nums text-muted">{(v.sum / v.n).toFixed(1)} / 5</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {cards.map((c) => (
                        <Badge key={c.id} tone={c.recommendation.includes("yes") ? "ok" : "bad"}>
                          {userName(d, c.interviewerId)}: {RECOMMENDATION_LABEL[c.recommendation]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {isHr && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card title="References & eCIB" actions={<Link href={`/hr/verification/${app.id}`} className="text-brand">Open →</Link>}>
                {refs.length === 0 && ecib.length === 0 ? (
                  <p className="text-sm text-muted">Not started.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {refs.map((r) => (
                      <li key={r.id} className="flex justify-between gap-2">
                        <span>Reference: {r.refereeName} <span className="text-xs text-muted">({r.company})</span></span>
                        <StatusBadge status={r.status} />
                      </li>
                    ))}
                    {ecib.map((e) => (
                      <li key={e.id} className="flex justify-between gap-2">
                        <span>eCIB credit check</span>
                        <StatusBadge status={e.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Offer" actions={<Link href="/hr/offers" className="text-brand">Offers →</Link>}>
                {offers.length === 0 ? (
                  <p className="text-sm text-muted">No offer yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {offers.map((o) => (
                      <li key={o.id} className="flex justify-between gap-2">
                        <Link href={`/hr/offers/${o.id}`} className="hover:text-brand">{o.code} · {pkr(o.grossMonthly)}/month</Link>
                        <StatusBadge status={o.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Timeline">
            <ol className="relative space-y-4 border-l border-line pl-4">
              {[...app.stageHistory].reverse().map((h, i) => (
                <li key={i} className="text-sm">
                  <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white bg-brand" />
                  <div className="font-medium">{STAGE_LABEL[h.stage]}</div>
                  <div className="text-xs text-muted">{fmtDateTime(h.at)} · {h.by === cand?.userId ? "Candidate" : userName(d, h.by, "System")}</div>
                  {h.note && <div className="text-xs text-ink">{h.note}</div>}
                </li>
              ))}
            </ol>
          </Card>

          <Card title={`Notes (${app.notes.length})`}>
            <form action={addNote} className="space-y-2">
              <input type="hidden" name="id" value={app.id} />
              <textarea name="text" required placeholder="Share an observation with the hiring team…" className="input" />
              <SubmitButton size="sm">Add note</SubmitButton>
            </form>
            {app.notes.length > 0 && (
              <ul className="mt-4 space-y-3">
                {[...app.notes].reverse().map((n, i) => (
                  <li key={i} className="rounded-lg bg-paper p-2.5 text-sm">
                    <div className="whitespace-pre-wrap">{n.text}</div>
                    <div className="mt-1 text-[11px] text-muted">{n.byName} · {relative(n.at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Tags">
            <form action={setTags} className="flex gap-2">
              <input type="hidden" name="id" value={app.id} />
              <input name="tags" defaultValue={app.tags.join(", ")} placeholder="e.g. bilingual, relocate" className="input" />
              <SubmitButton size="sm" variant="secondary">Save</SubmitButton>
            </form>
          </Card>

          {otherApps.length > 0 && (
            <Card title="Other applications">
              <ul className="space-y-2 text-sm">
                {otherApps.map((o) => (
                  <li key={o.id} className="flex justify-between gap-2">
                    <Link href={`/hr/applications/${o.id}`} className="hover:text-brand">{d.postings.find((p) => p.id === o.postingId)?.title}</Link>
                    <StatusBadge status={o.status === "active" ? "applied" : o.status} label={o.status === "active" ? STAGE_LABEL[o.stage] : undefined} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {req && (
            <Card title="Requisition">
              <KeyValue items={[["Code", req.code], ["Hiring manager", userName(d, req.hiringManagerId)], ["Recruiter", userName(d, req.recruiterId)], ["Salary range", `${pkr(req.salaryMin)} – ${pkr(req.salaryMax)}`]]} />
            </Card>
          )}
          {!cand && <EmptyState title="Candidate profile missing" />}
        </div>
      </div>
    </div>
  );
}
