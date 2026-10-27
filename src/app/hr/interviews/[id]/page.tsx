import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireInternal } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterList, userName } from "@/lib/lookup";
import { canSeeApplication, displayName, isoToKarachiLocal, MODE_LABEL, RECOMMENDATION_LABEL, nowMs } from "@/lib/hiring";
import { fmtDateTime, fmtTime, relative } from "@/lib/format";
import { Avatar, Badge, Card, Flash, KeyValue, LinkButton, PageHeader, Stars, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { rescheduleInterview, setInterviewStatus, submitScorecard } from "../actions";

export default async function InterviewPage({
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
  const iv = d.interviews.find((i) => i.id === id);
  if (!iv) notFound();
  if (!canSeeApplication(d, user, iv.applicationId)) redirect("/hr/interviews?err=You+do+not+have+access+to+that+interview.");
  const app = d.applications.find((a) => a.id === iv.applicationId)!;
  const cand = d.candidates.find((c) => c.id === app.candidateId);
  const posting = d.postings.find((p) => p.id === app.postingId);
  const name = displayName(d, cand, app, false);
  const cards = d.scorecards.filter((s) => s.interviewId === iv.id);
  const mine = cards.find((s) => s.interviewerId === user.id);
  const onPanel = iv.panel.includes(user.id);
  // Independent scoring: panel members see others' feedback only after submitting their own.
  const canSeeAll = !!mine || (!onPanel && user.role !== "hiring");
  const canScore = !mine && (onPanel || user.role !== "hiring");
  const competencies = masterList(d, "competency").map((c) => c.name);
  const end = new Date(new Date(iv.start).getTime() + iv.durationMin * 60_000).toISOString();
  const isPast = new Date(iv.start).getTime() < nowMs();
  const avg = cards.length ? cards.reduce((s, c) => s + c.overall, 0) / cards.length : 0;

  return (
    <div>
      <PageHeader
        back={{ href: "/hr/interviews", label: "Interviews" }}
        title={`${iv.title} · ${name}`}
        subtitle={`${posting?.title} · ${posting?.city} · Round ${iv.round}`}
        actions={
          <>
            <LinkButton href={`/hr/applications/${app.id}`} variant="secondary">Application</LinkButton>
            <LinkButton href={`/api/interviews/${iv.id}/ics`} variant="secondary">📆 Add to calendar</LinkButton>
            {iv.mode === "live_video" && iv.meetingUrl && iv.status === "scheduled" && (
              <LinkButton href={iv.meetingUrl} target="_blank">🎥 Join meeting</LinkButton>
            )}
          </>
        }
      />
      <Flash msg={sp.msg} err={sp.err} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Details" actions={<StatusBadge status={iv.status} />}>
            <KeyValue
              items={[
                ["Format", MODE_LABEL[iv.mode]],
                [iv.mode === "recorded_video" ? "Deadline" : "When", iv.mode === "recorded_video" ? fmtDateTime(iv.start) : `${fmtDateTime(iv.start)} – ${fmtTime(end)} (${iv.durationMin} min)`],
                ...(iv.location ? [["Location", iv.location] as [string, string]] : []),
                ...(iv.meetingUrl ? [["Meeting link", <a key="l" href={iv.meetingUrl} target="_blank" rel="noreferrer" className="break-all text-brand underline">{iv.meetingUrl}</a>] as [string, React.ReactNode]] : []),
                ...(iv.mode !== "recorded_video"
                  ? [["Candidate confirmed", iv.candidateConfirmed ? <Badge key="c" tone="ok">Confirmed</Badge> : <Badge key="c" tone="warn">Not yet</Badge>] as [string, React.ReactNode]]
                  : []),
                ["Panel", iv.panel.map((p) => userName(d, p)).join(", ")],
                ["Scheduled by", `${userName(d, iv.createdBy)} · ${relative(iv.createdAt)}`],
              ]}
            />
            {iv.instructions && <p className="mt-4 rounded-lg bg-paper p-3 text-sm">{iv.instructions}</p>}
          </Card>

          {iv.mode === "recorded_video" && (
            <Card title={`Recorded answers (${new Set(iv.recordings?.map((r) => r.questionId)).size}/${iv.recordedQuestions?.length ?? 0})`}>
              <ol className="space-y-5">
                {iv.recordedQuestions?.map((q, i) => {
                  const takes = iv.recordings?.filter((r) => r.questionId === q.id) ?? [];
                  const rec = takes.at(-1);
                  return (
                    <li key={q.id}>
                      <div className="text-sm font-medium">Q{i + 1}. {q.question}</div>
                      <div className="text-xs text-muted">{q.thinkSeconds}s to think · up to {q.maxSeconds}s to answer</div>
                      {rec ? (
                        <>
                          <video controls preload="metadata" src={`/api/files/${rec.fileId}`} className="mt-2 aspect-video w-full max-w-xl rounded-lg bg-black" />
                          <div className="text-xs text-muted">Recorded {fmtDateTime(rec.at)}{takes.length > 1 ? " · re-recorded once" : ""}</div>
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-muted">Not answered yet.</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}

          {iv.mode === "live_video" && iv.meetingUrl?.startsWith("https://meet.jit.si/") && iv.status === "scheduled" && (
            <Card title="Meeting room">
              <details>
                <summary className="cursor-pointer text-sm text-brand">Open the video room here</summary>
                <iframe
                  src={iv.meetingUrl}
                  allow="camera; microphone; fullscreen; display-capture; autoplay"
                  className="mt-3 aspect-video w-full rounded-lg border border-line"
                  title="Interview video room"
                />
              </details>
            </Card>
          )}

          <Card title="Scorecards" actions={cards.length > 0 && canSeeAll && <span className="text-sm"><Stars value={avg} /> {avg.toFixed(1)} average</span>}>
            {canScore && (
              <form action={submitScorecard} className="mb-6 space-y-4 rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
                <input type="hidden" name="interviewId" value={iv.id} />
                <div className="text-sm font-semibold">Your scorecard</div>
                <p className="text-xs text-muted">Score on evidence from the interview. Other panel members&apos; scores stay hidden until you submit, so everyone&apos;s view is independent. 1 = well below, 3 = meets, 5 = exceptional.</p>
                <div className="space-y-3">
                  {competencies.map((c, i) => (
                    <div key={c} className="grid gap-2 sm:grid-cols-[180px_auto_1fr] sm:items-center">
                      <input type="hidden" name="competency" value={c} />
                      <span className="text-sm font-medium">{c}</span>
                      <div className="flex gap-1" role="radiogroup" aria-label={c}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <label key={n} className="cursor-pointer">
                            <input type="radio" name={`score_${i}`} value={n} required className="peer sr-only" />
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-sm peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
                              {n}
                            </span>
                          </label>
                        ))}
                      </div>
                      <input name={`note_${i}`} placeholder="Evidence (optional)" className="input py-1 text-xs" />
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="label">Overall rating</span>
                    <select name="overall" required className="input" defaultValue="">
                      <option value="" disabled>Choose…</option>
                      {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n})</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Recommendation</span>
                    <select name="recommendation" required className="input" defaultValue="">
                      <option value="" disabled>Choose…</option>
                      {Object.entries(RECOMMENDATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Strengths</span>
                    <textarea name="strengths" className="input" />
                  </label>
                  <label className="block">
                    <span className="label">Concerns</span>
                    <textarea name="concerns" className="input" />
                  </label>
                </div>
                <SubmitButton>Submit scorecard</SubmitButton>
              </form>
            )}
            {!canSeeAll ? (
              <p className="text-sm text-muted">🔒 {cards.length} scorecard{cards.length === 1 ? "" : "s"} submitted. Submit yours to see the panel&apos;s feedback.</p>
            ) : cards.length === 0 ? (
              <p className="text-sm text-muted">No scorecards submitted yet.</p>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Competency</th>
                        {cards.map((c) => <th key={c.id} className="normal-case">{userName(d, c.interviewerId)}</th>)}
                        <th>Average</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...new Set(cards.flatMap((c) => c.ratings.map((r) => r.competency)))].map((comp) => {
                        const vals = cards.map((c) => c.ratings.find((r) => r.competency === comp)?.score);
                        const nums = vals.filter((v): v is number => v !== undefined);
                        const spread = nums.length > 1 ? Math.max(...nums) - Math.min(...nums) : 0;
                        return (
                          <tr key={comp}>
                            <td>{comp}{spread >= 2 && <span className="ml-1 text-xs text-warn" title="Panel disagrees; discuss in the debrief">⚑ discuss</span>}</td>
                            {vals.map((v, i) => <td key={i} className="tabular-nums">{v ?? "—"}</td>)}
                            <td className="font-medium tabular-nums">{nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ul className="space-y-3">
                  {cards.map((c) => (
                    <li key={c.id} className="rounded-lg border border-line p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-medium"><Avatar name={userName(d, c.interviewerId)} size={24} /> {userName(d, c.interviewerId)}</span>
                        <span className="flex items-center gap-2">
                          <Stars value={c.overall} />
                          <Badge tone={c.recommendation.includes("yes") ? "ok" : "bad"}>{RECOMMENDATION_LABEL[c.recommendation]}</Badge>
                        </span>
                      </div>
                      {c.strengths && <p className="mt-2"><span className="text-muted">Strengths: </span>{c.strengths}</p>}
                      {c.concerns && <p className="mt-1"><span className="text-muted">Concerns: </span>{c.concerns}</p>}
                      <p className="mt-1 text-xs text-muted">Submitted {fmtDateTime(c.submittedAt)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Candidate">
            <Link href={`/hr/applications/${app.id}`} className="flex items-center gap-3 hover:text-brand">
              <Avatar name={name} size={40} />
              <span>
                <span className="block font-medium">{name}</span>
                <span className="block text-xs text-muted">{cand?.currentTitle} · {cand?.totalExperienceYears} yrs</span>
              </span>
            </Link>
          </Card>

          {iv.status === "scheduled" && (
            <Card title="Update status">
              <div className="flex flex-wrap gap-2">
                {isPast && (
                  <form action={setInterviewStatus}>
                    <input type="hidden" name="id" value={iv.id} />
                    <SubmitButton size="sm" name="status" value="completed">✓ Completed</SubmitButton>
                  </form>
                )}
                {isPast && iv.mode !== "recorded_video" && (
                  <form action={setInterviewStatus}>
                    <input type="hidden" name="id" value={iv.id} />
                    <SubmitButton size="sm" variant="secondary" name="status" value="no_show">No-show</SubmitButton>
                  </form>
                )}
                <form action={setInterviewStatus}>
                  <input type="hidden" name="id" value={iv.id} />
                  <SubmitButton size="sm" variant="danger" name="status" value="cancelled" confirm="Cancel this interview? The candidate will be told.">Cancel</SubmitButton>
                </form>
              </div>
            </Card>
          )}
          {iv.status !== "scheduled" && iv.status !== "completed" && (
            <Card title="Reopen">
              <form action={setInterviewStatus}>
                <input type="hidden" name="id" value={iv.id} />
                <SubmitButton size="sm" variant="secondary" name="status" value="scheduled">Mark as scheduled again</SubmitButton>
              </form>
            </Card>
          )}

          {iv.status !== "completed" && (
            <Card title={iv.mode === "recorded_video" ? "Change deadline" : "Reschedule"}>
              <form action={rescheduleInterview} className="space-y-3">
                <input type="hidden" name="id" value={iv.id} />
                <label className="block">
                  <span className="label">New date and time</span>
                  <input type="datetime-local" name="start" required defaultValue={isoToKarachiLocal(iv.start)} className="input" />
                </label>
                <label className="block">
                  <span className="label">Duration (minutes)</span>
                  <input type="number" name="durationMin" defaultValue={iv.durationMin} min={10} className="input" />
                </label>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" name="allowConflict" value="1" /> Ignore calendar clash
                </label>
                <SubmitButton size="sm" variant="secondary">Reschedule & notify</SubmitButton>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
