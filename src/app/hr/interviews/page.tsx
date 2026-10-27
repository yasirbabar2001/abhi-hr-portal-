import Link from "next/link";
import clsx from "clsx";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { userName } from "@/lib/lookup";
import { displayName, karachiDate, MODE_LABEL, MODE_STYLE, visibleApplications, nowMs } from "@/lib/hiring";
import { fmtDateTime, fmtTime, relative } from "@/lib/format";
import { Card, EmptyState, Flash, LinkButton, PageHeader, Stat, StatusBadge } from "@/components/ui";

export const metadata = { title: "Interviews" };

const DAY = 86_400_000;
const addDays = (ymd: string, n: number) => new Date(new Date(`${ymd}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);
const weekday = (ymd: string) => (new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
const label = (ymd: string, opts: Intl.DateTimeFormatOptions) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });

export default async function InterviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSection("/hr/interviews");
  const sp = await searchParams;
  const d = db();
  const view = sp.view === "week" ? "week" : "month";
  const today = karachiDate(new Date(nowMs()).toISOString());
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const mineOnly = sp.mine === "1" || user.role === "hiring";
  const visibleIds = new Set(visibleApplications(d, user).map((a) => a.id));
  let list = d.interviews.filter((i) => visibleIds.has(i.applicationId));
  if (mineOnly) list = list.filter((i) => i.panel.includes(user.id) || i.createdBy === user.id);
  if (sp.mode) list = list.filter((i) => i.mode === sp.mode);
  const showCancelled = sp.cancelled === "1";
  const calList = list.filter((i) => showCancelled || i.status !== "cancelled");

  let days: string[];
  let prev: string;
  let next: string;
  let title: string;
  if (view === "month") {
    const first = `${anchor.slice(0, 7)}-01`;
    const start = addDays(first, -weekday(first));
    days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    if (days[35]!.slice(0, 7) !== anchor.slice(0, 7)) days = days.slice(0, 35);
    const m = new Date(`${first}T00:00:00Z`);
    prev = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
    next = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
    title = label(first, { month: "long", year: "numeric" });
  } else {
    const start = addDays(anchor, -weekday(anchor));
    days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    prev = addDays(start, -7);
    next = addDays(start, 7);
    title = `${label(days[0]!, { day: "numeric", month: "short" })} – ${label(days[6]!, { day: "numeric", month: "short", year: "numeric" })}`;
  }
  const byDay = new Map<string, typeof list>();
  for (const i of calList) {
    const k = karachiDate(i.start);
    byDay.set(k, [...(byDay.get(k) ?? []), i]);
  }
  for (const v of byDay.values()) v.sort((a, b) => a.start.localeCompare(b.start));

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ view, date: anchor, mine: sp.mine, mode: sp.mode, cancelled: sp.cancelled, ...patch })) if (v) p.set(k, v);
    return `/hr/interviews?${p.toString()}`;
  };
  const who = (i: (typeof list)[number]) => {
    const app = d.applications.find((a) => a.id === i.applicationId);
    const c = app && d.candidates.find((x) => x.id === app.candidateId);
    return app ? displayName(d, c, app, false) : "Candidate";
  };
  const upcoming = list.filter((i) => i.status === "scheduled" && new Date(i.start).getTime() > nowMs() - 3600_000).sort((a, b) => a.start.localeCompare(b.start));
  const needScore = d.interviews.filter(
    (i) => i.panel.includes(user.id) && i.status !== "cancelled" && new Date(i.start).getTime() < nowMs() && !d.scorecards.some((s) => s.interviewId === i.id && s.interviewerId === user.id),
  );
  const weekEnd = nowMs() + 7 * DAY;

  return (
    <div>
      <PageHeader
        title="Interviews"
        subtitle="Calendar of live video, in-person and recorded interviews, with structured scorecards."
        actions={<LinkButton href="/hr/interviews/new">+ Schedule interview</LinkButton>}
      />
      <Flash msg={sp.msg} err={sp.err} />
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Next 7 days" value={upcoming.filter((i) => new Date(i.start).getTime() < weekEnd).length} tone="brand" />
        <Stat label="Awaiting candidate confirmation" value={upcoming.filter((i) => !i.candidateConfirmed && i.mode !== "recorded_video").length} tone="warn" />
        <Stat label="Video answers to review" value={list.filter((i) => i.mode === "recorded_video" && (i.recordings?.length ?? 0) > 0 && !d.scorecards.some((s) => s.interviewId === i.id)).length} />
        <Stat label="My scorecards due" value={needScore.length} tone={needScore.length ? "bad" : "ok"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Card
          pad={false}
          title={
            <span className="flex items-center gap-2">
              <Link href={qs({ date: prev })} className="rounded px-2 hover:bg-paper" aria-label="Previous">‹</Link>
              <span className="min-w-40 text-center">{title}</span>
              <Link href={qs({ date: next })} className="rounded px-2 hover:bg-paper" aria-label="Next">›</Link>
              <Link href={qs({ date: today })} className="rounded border border-line px-2 py-0.5 text-xs font-normal hover:border-brand">Today</Link>
            </span>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {user.role !== "hiring" && (
                <Link href={qs({ mine: sp.mine === "1" ? undefined : "1" })} className={clsx("rounded-full border px-2 py-0.5", sp.mine === "1" ? "border-brand bg-brand text-white" : "border-line")}>
                  My interviews
                </Link>
              )}
              {(["live_video", "in_person", "recorded_video"] as const).map((m) => (
                <Link key={m} href={qs({ mode: sp.mode === m ? undefined : m })} className={clsx("rounded-full border px-2 py-0.5", MODE_STYLE[m], sp.mode && sp.mode !== m && "opacity-40")}>
                  {MODE_LABEL[m]}
                </Link>
              ))}
              <div className="flex rounded-lg border border-line p-0.5">
                <Link href={qs({ view: "month" })} className={clsx("rounded px-2 py-0.5", view === "month" && "bg-brand text-white")}>Month</Link>
                <Link href={qs({ view: "week" })} className={clsx("rounded px-2 py-0.5", view === "week" && "bg-brand text-white")}>Week</Link>
              </div>
            </div>
          }
        >
          {view === "month" ? (
            <div className="overflow-x-auto">
              <div className="grid min-w-[700px] grid-cols-7 border-b border-line bg-paper text-center text-xs font-medium text-muted">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => <div key={w} className="py-1.5">{w}</div>)}
              </div>
              <div className="grid min-w-[700px] grid-cols-7">
                {days.map((day) => {
                  const items = byDay.get(day) ?? [];
                  const inMonth = day.slice(0, 7) === anchor.slice(0, 7);
                  return (
                    <div key={day} className={clsx("min-h-28 border-b border-r border-line p-1.5", !inMonth && "bg-slate-50/70")}>
                      <Link href={qs({ view: "week", date: day })} className={clsx("mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", day === today ? "bg-brand font-semibold text-white" : inMonth ? "text-ink" : "text-slate-400")}>
                        {Number(day.slice(8))}
                      </Link>
                      <ul className="space-y-1">
                        {items.slice(0, 3).map((i) => (
                          <li key={i.id}>
                            <Link href={`/hr/interviews/${i.id}`} className={clsx("block truncate rounded border px-1.5 py-0.5 text-[11px]", MODE_STYLE[i.mode], i.status === "cancelled" && "line-through opacity-60")}>
                              {i.mode === "recorded_video" ? "⏺ due" : fmtTime(i.start)} {who(i)}
                            </Link>
                          </li>
                        ))}
                        {items.length > 3 && (
                          <li><Link href={qs({ view: "week", date: day })} className="text-[11px] text-brand">+{items.length - 3} more</Link></li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {days.map((day) => {
                const items = byDay.get(day) ?? [];
                return (
                  <div key={day} className="flex gap-4 px-4 py-3">
                    <div className={clsx("w-16 shrink-0 text-center", day === today && "text-brand")}>
                      <div className="text-xs uppercase text-muted">{label(day, { weekday: "short" })}</div>
                      <div className="text-xl font-semibold">{Number(day.slice(8))}</div>
                    </div>
                    <ul className="flex-1 space-y-2">
                      {items.length === 0 && <li className="py-2 text-sm text-muted">No interviews</li>}
                      {items.map((i) => (
                        <li key={i.id}>
                          <Link href={`/hr/interviews/${i.id}`} className={clsx("flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm", MODE_STYLE[i.mode], i.status === "cancelled" && "opacity-60")}>
                            <span>
                              <span className="font-medium">{i.mode === "recorded_video" ? "Deadline" : `${fmtTime(i.start)}–${fmtTime(new Date(new Date(i.start).getTime() + i.durationMin * 60_000).toISOString())}`}</span>{" "}
                              · {who(i)} · {d.postings.find((p) => p.id === d.applications.find((a) => a.id === i.applicationId)?.postingId)?.title}
                              <span className="block text-xs opacity-80">{MODE_LABEL[i.mode]}{i.location ? ` · ${i.location}` : ""} · Panel: {i.panel.map((p) => userName(d, p)).join(", ")}</span>
                            </span>
                            <StatusBadge status={i.status} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
          <div className="border-t border-line px-4 py-2 text-xs">
            <Link href={qs({ cancelled: showCancelled ? undefined : "1" })} className="text-muted hover:text-brand">
              {showCancelled ? "Hide cancelled" : "Show cancelled"}
            </Link>
          </div>
        </Card>

        <div className="space-y-6">
          {needScore.length > 0 && (
            <Card title="Your scorecards are due">
              <ul className="space-y-2 text-sm">
                {needScore.map((i) => (
                  <li key={i.id}>
                    <Link href={`/hr/interviews/${i.id}`} className="font-medium text-bad hover:underline">{who(i)}</Link>
                    <div className="text-xs text-muted">{fmtDateTime(i.start)}</div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Coming up">
            {upcoming.length === 0 ? (
              <EmptyState title="Nothing scheduled" />
            ) : (
              <ul className="space-y-3">
                {upcoming.slice(0, 10).map((i) => (
                  <li key={i.id} className="text-sm">
                    <Link href={`/hr/interviews/${i.id}`} className="font-medium hover:text-brand">{who(i)}</Link>
                    <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
                      <span className={clsx("rounded border px-1", MODE_STYLE[i.mode])}>{MODE_LABEL[i.mode]}</span>
                      {fmtDateTime(i.start)} · {relative(i.start)}
                    </div>
                    {i.mode === "live_video" && i.meetingUrl && (
                      <a href={i.meetingUrl} target="_blank" rel="noreferrer" className="text-xs text-brand underline">Join</a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
