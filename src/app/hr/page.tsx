import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName } from "@/lib/lookup";
import { fmtDateTime, relative } from "@/lib/format";
import { Badge, Card, EmptyState, Flash, LinkButton, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { BarList, Columns, Funnel } from "@/components/charts";
import { attentionFor } from "@/lib/analytics/attention";
import { avg, funnel, nowMs, offerAcceptance, sourceEffectiveness, timeToHireDays } from "@/lib/analytics/metrics";

const RANGES = [
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
  { key: "365", label: "12 months" },
];
const MODE_LABEL = { in_person: "In person", live_video: "Live video", recorded_video: "Recorded video" } as const;

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSection("/hr");
  const sp = await searchParams;
  const range = RANGES.some((r) => r.key === sp.range) ? sp.range! : "90";
  const d = db();
  const now = nowMs();
  const since = now - Number(range) * 86_400_000;
  const hiring = user.role === "hiring";

  // Scope: the hiring team only sees their own requisitions and interviews.
  const reqs = hiring ? d.requisitions.filter((r) => r.hiringManagerId === user.id) : d.requisitions;
  const reqIds = new Set(reqs.map((r) => r.id));
  const postings = d.postings.filter((p) => reqIds.has(p.requisitionId));
  const postingIds = new Set(postings.map((p) => p.id));
  const allApps = d.applications.filter((a) => postingIds.has(a.postingId));
  const apps = allApps.filter((a) => new Date(a.createdAt).getTime() >= since);
  const appIds = new Set(allApps.map((a) => a.id));
  const interviews = d.interviews.filter((i) => (hiring ? i.panel.includes(user.id) || appIds.has(i.applicationId) : true));
  const offers = d.offers.filter((o) => appIds.has(o.applicationId));

  const openReqs = reqs.filter((r) => r.status === "approved");
  const openPositions = openReqs.reduce((s, r) => s + Math.max(0, r.headcount - r.filled), 0);
  const fy = d.budgets.map((b) => b.fiscalYear).sort().at(-1);
  const budgets = d.budgets.filter((b) => b.fiscalYear === fy);
  const budgeted = budgets.reduce((s, b) => s + b.approvedHeadcount, 0);
  const activeCandidates = allApps.filter((a) => a.status === "active").length;
  const weekEnd = now + 7 * 86_400_000;
  const upcoming = interviews
    .filter((i) => i.status === "scheduled" && new Date(i.start).getTime() >= now - 3600_000 && new Date(i.start).getTime() <= weekEnd)
    .sort((a, b) => a.start.localeCompare(b.start));
  const pendingOffers = offers.filter((o) => ["pending_approval", "approved", "sent"].includes(o.status)).length;
  const acceptance = offerAcceptance(offers);
  const hiredApps = allApps.filter((a) => a.stageHistory.some((h) => h.stage === "hired" && new Date(h.at).getTime() >= since));
  const tth = Math.round(avg(timeToHireDays(hiredApps)));
  const ttf = Math.round(
    avg(
      hiredApps.map((a) => {
        const req = d.requisitions.find((r) => r.id === d.postings.find((p) => p.id === a.postingId)?.requisitionId);
        const hired = a.stageHistory.find((h) => h.stage === "hired")!;
        return req ? Math.max(0, (new Date(hired.at).getTime() - new Date(req.createdAt).getTime()) / 86_400_000) : 0;
      }),
    ),
  );
  const inOrientation = d.hires.filter((h) => h.status === "orientation" || h.status === "preboarding").length;

  const deptRows = [...new Set(budgets.map((b) => b.departmentId))].map((deptId) => {
    const lines = budgets.filter((b) => b.departmentId === deptId);
    const desigs = new Set(lines.map((b) => b.designationId));
    const actual = d.employees.filter((e) => e.active && e.departmentId === deptId && e.designationId && desigs.has(e.designationId)).length;
    const code = d.master.find((m) => m.id === deptId)?.code ?? "—";
    return { label: code, value: actual, target: lines.reduce((s, b) => s + b.approvedHeadcount, 0) };
  });

  const sources = sourceEffectiveness(d, apps);
  const attention = attentionFor(d, user, now);
  const activity = (hiring ? d.audit.filter((a) => a.actorId === user.id) : d.audit).slice(-8).reverse();

  return (
    <div>
      <PageHeader
        title={`Good ${greeting()}, ${user.name.split(" ")[0]}`}
        subtitle={hiring ? "Your requisitions, candidates and interviews at a glance." : "Hiring, onboarding and headcount at a glance."}
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1 text-sm">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/hr?range=${r.key}`}
                className={`rounded-md px-2.5 py-1 ${r.key === range ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />
      {sp.denied && <Flash err="You do not have access to that page." />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open requisitions" value={openReqs.length} hint={`${reqs.filter((r) => r.status === "pending").length} awaiting approval`} href="/hr/requisitions" />
        <Stat
          label="Open positions"
          value={openPositions}
          hint={hiring ? "on your approved requisitions" : `of ${budgeted} budgeted (FY ${fy ?? "—"})`}
          tone="brand"
          href={hiring ? "/hr/requisitions" : "/hr/headcount"}
        />
        <Stat label="Active candidates" value={activeCandidates} hint={`${apps.length} applied in ${RANGES.find((r) => r.key === range)!.label}`} href="/hr/pipeline" />
        <Stat label="Interviews this week" value={upcoming.length} hint={`${upcoming.filter((i) => i.panel.includes(user.id)).length} with you on the panel`} href="/hr/interviews" />
        <Stat label="Offers in progress" value={pendingOffers} hint={acceptance.decided ? `${acceptance.rate}% acceptance rate` : "No decisions yet"} tone={acceptance.rate >= 80 ? "ok" : "default"} href={hiring ? undefined : "/hr/offers"} />
        <Stat label="Avg. time to hire" value={hiredApps.length ? `${tth} d` : "—"} hint="application → hired" />
        <Stat label="Avg. time to fill" value={hiredApps.length ? `${ttf} d` : "—"} hint="requisition → hired" />
        <Stat label="New hires onboarding" value={inOrientation} hint="in pre-boarding or orientation" href="/hr/onboarding" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="Needs your attention" className="lg:col-span-2" actions={<Badge tone={attention.length ? "warn" : "ok"}>{attention.length}</Badge>}>
          {attention.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">You are all caught up. 🎉</p>
          ) : (
            <ul className="-my-2 divide-y divide-line">
              {attention.slice(0, 8).map((a, i) => (
                <li key={i}>
                  <Link href={a.href} className="flex items-center gap-3 py-2.5 hover:text-brand">
                    <Badge tone={a.urgent ? "bad" : "info"}>{a.kind}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.title}</span>
                      <span className="block truncate text-xs text-muted">{a.detail}</span>
                    </span>
                    <span aria-hidden className="text-muted">→</span>
                  </Link>
                </li>
              ))}
              {attention.length > 8 && <li className="pt-2 text-xs text-muted">+ {attention.length - 8} more</li>}
            </ul>
          )}
        </Card>
        <Card title="Upcoming interviews" actions={<Link href="/hr/interviews" className="text-brand">Calendar</Link>}>
          {upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No interviews in the next 7 days.</p>
          ) : (
            <ul className="-my-2 divide-y divide-line">
              {upcoming.slice(0, 6).map((iv) => {
                const app = d.applications.find((a) => a.id === iv.applicationId);
                const cand = d.candidates.find((c) => c.id === app?.candidateId);
                return (
                  <li key={iv.id}>
                    <Link href={`/hr/interviews/${iv.id}`} className="block py-2.5 hover:text-brand">
                      <span className="block text-sm font-medium">{cand?.name ?? "Candidate"}</span>
                      <span className="block text-xs text-muted">
                        {fmtDateTime(iv.start)} · {MODE_LABEL[iv.mode]} · {relative(iv.start)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Recruitment funnel" actions={<span className="text-xs text-muted">% = conversion from previous step</span>}>
          {apps.length ? <Funnel steps={funnel(apps)} /> : <p className="py-6 text-center text-sm text-muted">No applications in this period.</p>}
        </Card>
        <Card title="Applications by source">
          {sources.length ? (
            <BarList items={sources.map((s) => ({ label: s.label, value: s.applied, hint: `· ${s.shortlistRate}% shortlisted · ${s.hired} hired` }))} />
          ) : (
            <p className="py-6 text-center text-sm text-muted">No applications in this period.</p>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {!hiring && (
          <Card title={`Headcount: actual vs budget (FY ${fy ?? "—"})`} className="lg:col-span-2" actions={<Link href="/hr/headcount" className="text-brand">Details</Link>}>
            {deptRows.length ? (
              <>
                <Columns items={deptRows} />
                <p className="mt-2 text-xs text-muted">Solid bar: active employees in budgeted roles. Dashed outline: approved headcount.</p>
              </>
            ) : (
              <EmptyState title="No headcount budget yet" action={<LinkButton href="/hr/headcount">Set up budget</LinkButton>} />
            )}
          </Card>
        )}
        {hiring && (
          <Card title="Your requisitions" className="lg:col-span-2">
            {reqs.length === 0 ? (
              <EmptyState title="No requisitions yet" action={<LinkButton href="/hr/requisitions/new">Raise a requisition</LinkButton>} />
            ) : (
              <ul className="divide-y divide-line">
                {reqs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/hr/requisitions/${r.id}`} className="text-sm hover:text-brand">
                      <span className="font-medium">{r.code}</span> · {r.title} · {masterName(d, r.branchId)}
                    </Link>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        <Card title="Recent activity" actions={!hiring && <Link href="/hr/audit" className="text-brand">Audit trail</Link>}>
          <ul className="-my-1 space-y-2.5">
            {activity.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="font-medium">{a.actorName}</span> <span className="text-muted">{a.summary.replace(a.actorName, "").trim() || a.action}</span>
                <span className="block text-xs text-muted">{relative(a.at)}</span>
              </li>
            ))}
            {activity.length === 0 && <li className="text-sm text-muted">Nothing yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function greeting() {
  const h = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Karachi" }));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}
