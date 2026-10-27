import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName } from "@/lib/lookup";
import { fmtDate, fmtDateTime, relative } from "@/lib/format";
import { nowMs, profileCompleteness, publicPostings } from "@/lib/careers";
import { STAGES } from "@/lib/types";
import { Badge, Card, EmptyState, Flash, LinkButton, Progress, StatusBadge, Stepper } from "@/components/ui";

export const metadata = { title: "My applications" };

interface Action { icon: string; title: string; body: string; href: string; cta: string; tone: "brand" | "warn" }

export default async function MyHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(["candidate"]);
  const sp = await searchParams;
  const d = db();
  const cand = d.candidates.find((c) => c.userId === user.id);
  const apps = cand ? d.applications.filter((a) => a.candidateId === cand.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  const ids = new Set(apps.map((a) => a.id));
  const completeness = cand ? profileCompleteness(cand) : { pct: 0, missing: [] };
  const now = nowMs();
  const actions: Action[] = [];
  for (const iv of d.interviews.filter((i) => ids.has(i.applicationId) && i.status === "scheduled")) {
    const job = d.postings.find((p) => p.id === d.applications.find((a) => a.id === iv.applicationId)?.postingId)?.title ?? "your application";
    if (iv.mode === "recorded_video") {
      const done = (iv.recordings?.length ?? 0) >= (iv.recordedQuestions?.length ?? 1);
      if (!done) actions.push({ icon: "🎬", title: "Record your video interview", body: `${job} · please complete by ${fmtDateTime(iv.start)}`, href: `/me/interviews/${iv.id}`, cta: "Start recording", tone: "warn" });
    } else if (new Date(iv.start).getTime() + iv.durationMin * 60_000 > now) {
      actions.push({
        icon: iv.mode === "live_video" ? "🎥" : "🏢",
        title: `${iv.mode === "live_video" ? "Video" : "In-person"} interview ${relative(iv.start)}`,
        body: `${job} · ${fmtDateTime(iv.start)}${iv.candidateConfirmed ? " · confirmed" : " · please confirm"}`,
        href: `/me/interviews/${iv.id}`,
        cta: iv.candidateConfirmed ? "View details" : "Confirm attendance",
        tone: iv.candidateConfirmed ? "brand" : "warn",
      });
    }
  }
  for (const e of d.ecib.filter((x) => ids.has(x.applicationId) && x.status === "awaiting_consent"))
    actions.push({ icon: "🛡️", title: "Background check consent needed", body: "We need your consent for a credit-history (eCIB) check before we can continue.", href: `/me/verification/${e.applicationId}`, cta: "Review & consent", tone: "warn" });
  for (const o of d.offers.filter((x) => ids.has(x.applicationId) && x.status === "sent"))
    actions.push({ icon: "🎉", title: "You have a job offer!", body: `Please respond by ${fmtDate(o.expiresAt)}.`, href: `/me/offers/${o.id}`, cta: "View offer", tone: "brand" });
  for (const l of d.letters.filter((x) => ids.has(x.applicationId) && x.status === "issued"))
    actions.push({ icon: "✉️", title: "Appointment letter issued", body: `Ref ${l.ref}. Please read and acknowledge.`, href: `/me/letters/${l.id}`, cta: "Open letter", tone: "warn" });
  const hire = d.hires.find((h) => h.userId === user.id);
  let orientationPct = 0;
  if (hire) {
    const required = d.modules.filter((m) => m.active && m.required);
    const done = required.filter((m) => d.progress.some((p) => p.hireId === hire.id && p.moduleId === m.id && p.status === "completed")).length;
    orientationPct = required.length ? Math.round((done / required.length) * 100) : 100;
  }
  const openTasks = hire ? hire.tasks.filter((t) => t.owner === "new_hire" && !t.done).length : 0;
  const suggestions = cand
    ? publicPostings(d)
        .filter((p) => !apps.some((a) => a.postingId === p.id))
        .map((p) => ({ p, hits: p.criteria.keywords.filter((k) => cand.skills.join(" ").toLowerCase().includes(k)).length + (p.city === cand.city ? 1 : 0) }))
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 3)
    : [];
  return (
    <div className="space-y-8">
      <Flash msg={sp.msg} err={sp.err} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hello, {user.name.split(" ")[0]} 👋</h1>
          <p className="text-sm text-muted">{hire ? (hire.employeeNo ? `Welcome to ${d.settings.shortName}! Employee ID ${hire.employeeNo}.` : "Welcome to the team! Let's get you ready for day one.") : "Track your applications and next steps here."}</p>
        </div>
        <LinkButton href="/careers" variant="secondary">Browse jobs</LinkButton>
      </div>

      {hire && (
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/me/orientation" className="rounded-xl border border-brand/30 bg-brand-soft p-5 hover:border-brand">
            <div className="flex items-center justify-between"><span className="text-lg font-semibold text-brand-2">🎓 Orientation</span><span className="text-sm font-semibold text-brand-2">{orientationPct}%</span></div>
            <p className="mt-1 text-sm text-muted">{orientationPct === 100 ? "All done — your employee ID is ready." : "Complete the modules to receive your employee ID."}</p>
            <div className="mt-3"><Progress value={orientationPct} /></div>
          </Link>
          <Link href="/me/onboarding" className="rounded-xl border border-line bg-surface p-5 hover:border-brand">
            <div className="flex items-center justify-between"><span className="text-lg font-semibold">🧭 Onboarding journey</span><Badge tone={openTasks ? "warn" : "ok"}>{openTasks ? `${openTasks} to do` : "Up to date"}</Badge></div>
            <p className="mt-1 text-sm text-muted">Joining {fmtDate(hire.joiningDate)}{hire.buddyName ? ` · Your buddy: ${hire.buddyName}` : ""}</p>
          </Link>
        </div>
      )}

      {actions.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Needs your attention</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {actions.map((a) => (
              <div key={a.href + a.title} className={`flex items-start gap-3 rounded-xl border bg-surface p-4 ${a.tone === "warn" ? "border-amber-300" : "border-brand/30"}`}>
                <span className="text-2xl" aria-hidden>{a.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{a.title}</div>
                  <p className="text-sm text-muted">{a.body}</p>
                  <LinkButton href={a.href} size="sm" className="mt-2">{a.cta}</LinkButton>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">My applications ({apps.length})</h2>
          {apps.length === 0 ? (
            <EmptyState title="You haven't applied yet" body="Find a role that suits you and apply in a few minutes." action={<LinkButton href="/careers">See open jobs</LinkButton>} />
          ) : (
            apps.map((a) => {
              const p = d.postings.find((x) => x.id === a.postingId);
              const idx = STAGES.findIndex((s) => s.key === a.stage);
              const closed = a.status === "rejected" || a.status === "withdrawn";
              return (
                <Link key={a.id} href={`/me/applications/${a.id}`} className="block rounded-xl border border-line bg-surface p-4 shadow-sm hover:border-brand/50">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{p?.title ?? "Job"}</div>
                      <div className="text-xs text-muted">{p?.city} · {masterName(d, p?.departmentId)} · applied {fmtDate(a.createdAt)} · {a.code}</div>
                    </div>
                    {closed ? <StatusBadge status={a.status} label={a.status === "rejected" ? "Not progressed" : "Withdrawn"} /> : <StatusBadge status={a.status === "hired" ? "hired" : "in_progress"} label={a.status === "hired" ? "Hired" : STAGES[idx]?.label} />}
                  </div>
                  <div className="mt-4"><Stepper steps={STAGES.map((s) => s.label)} current={a.status === "hired" ? STAGES.length : idx} failed={closed} /></div>
                </Link>
              );
            })
          )}
        </section>
        <aside className="space-y-4">
          <Card title="Profile strength">
            <div className="flex items-center justify-between text-sm"><span>{completeness.pct}% complete</span><Link href="/me/profile" className="text-brand">Edit →</Link></div>
            <div className="mt-2"><Progress value={completeness.pct} tone={completeness.pct === 100 ? "ok" : "brand"} /></div>
            {completeness.missing.length > 0 && <p className="mt-2 text-xs text-muted">Add: {completeness.missing.join(", ")}</p>}
          </Card>
          {suggestions.length > 0 && (
            <Card title="Jobs you may like">
              <ul className="space-y-2 text-sm">
                {suggestions.map(({ p }) => (
                  <li key={p.id}><Link href={`/careers/${p.slug}`} className="font-medium text-brand hover:underline">{p.title}</Link><div className="text-xs text-muted">{p.city} · closes {fmtDate(p.closeDate)}</div></li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Need help?">
            <p className="text-sm text-muted">Write to {d.settings.supportEmail}. We never charge a fee during recruitment.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
