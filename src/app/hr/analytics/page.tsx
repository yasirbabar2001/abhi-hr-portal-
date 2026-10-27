import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { fmtDate } from "@/lib/format";
import { Badge, Card, LinkButton, PageHeader, Stat } from "@/components/ui";
import { BarList, Columns, Gauge } from "@/components/charts";
import {
  TOUCHPOINTS,
  avg,
  dropOff,
  monthlyTrend,
  nowMs,
  nps,
  offerAcceptance,
  round1,
  sentiment,
  sourceEffectiveness,
  timeInStage,
} from "@/lib/analytics/metrics";
import type { Touchpoint } from "@/lib/types";

const PERIODS = [
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
  { key: "180", label: "6 months" },
  { key: "365", label: "12 months" },
];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/analytics");
  const sp = await searchParams;
  const period = PERIODS.some((p) => p.key === sp.period) ? sp.period! : "90";
  const tp = TOUCHPOINTS.some((t) => t.key === sp.touchpoint) ? (sp.touchpoint as Touchpoint) : undefined;
  const d = db();
  const since = nowMs() - Number(period) * 86_400_000;
  const inPeriod = d.surveys.filter((s) => new Date(s.at).getTime() >= since);
  const surveys = tp ? inPeriod.filter((s) => s.touchpoint === tp) : inPeriod;
  const overall = nps(surveys.map((s) => s.nps));
  const apps = d.applications.filter((a) => new Date(a.createdAt).getTime() >= since);
  const trend = monthlyTrend(tp ? d.surveys.filter((s) => s.touchpoint === tp) : d.surveys, 6);
  const comments = surveys
    .filter((s) => s.comments)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12)
    .map((s) => ({ ...s, mood: sentiment(s.comments!) }));
  const stageTimes = timeInStage(apps);
  const drops = dropOff(apps);
  const sources = sourceEffectiveness(d, apps);
  const offers = offerAcceptance(d.offers.filter((o) => new Date(o.createdAt).getTime() >= since));
  const qs = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { period, touchpoint: tp, ...p };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    return `?${u.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Experience analytics"
        subtitle="How candidates and new hires feel about each step, and where the process slows down."
        actions={<LinkButton variant="secondary" href={`/hr/analytics/export${qs({})}`}>⬇ Export surveys (CSV)</LinkButton>}
      />
      <div className="mb-5 flex flex-wrap gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-surface p-1">
          {PERIODS.map((p) => (
            <Link key={p.key} href={qs({ period: p.key })} className={`rounded-md px-2.5 py-1 ${p.key === period ? "bg-brand text-white" : "text-muted hover:text-ink"}`}>
              {p.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-surface p-1">
          <Link href={qs({ touchpoint: "" })} className={`rounded-md px-2.5 py-1 ${!tp ? "bg-brand text-white" : "text-muted hover:text-ink"}`}>All steps</Link>
          {TOUCHPOINTS.map((t) => (
            <Link key={t.key} href={qs({ touchpoint: t.key })} className={`rounded-md px-2.5 py-1 ${t.key === tp ? "bg-brand text-white" : "text-muted hover:text-ink"}`}>
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="md:col-span-2">
          <Gauge value={overall.score} label={`Net Promoter Score · ${overall.n} responses`} />
          <div className="mt-3 flex gap-4 text-xs text-muted">
            <span><b className="text-ok">{overall.promoters}</b> promoters (9–10)</span>
            <span><b>{overall.passives}</b> passives (7–8)</span>
            <span><b className="text-bad">{overall.detractors}</b> detractors (0–6)</span>
          </div>
        </Card>
        <Stat label="Satisfaction (CSAT)" value={surveys.length ? `${round1(avg(surveys.map((s) => s.csat)))} / 5` : "—"} hint="How satisfied were you?" />
        <Stat label="Ease" value={surveys.length ? `${round1(avg(surveys.map((s) => s.ease)))} / 5` : "—"} hint="How easy was it?" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Scores by step">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Step</th><th>Responses</th><th>NPS</th><th>CSAT</th><th>Ease</th></tr>
              </thead>
              <tbody>
                {TOUCHPOINTS.map((t) => {
                  const rows = inPeriod.filter((s) => s.touchpoint === t.key);
                  const n = nps(rows.map((s) => s.nps));
                  return (
                    <tr key={t.key}>
                      <td><Link href={qs({ touchpoint: t.key })} className="text-brand">{t.label}</Link></td>
                      <td className="tabular-nums">{rows.length}</td>
                      <td><Badge tone={!rows.length ? "neutral" : n.score >= 30 ? "ok" : n.score >= 0 ? "warn" : "bad"}>{rows.length ? n.score : "—"}</Badge></td>
                      <td className="tabular-nums">{rows.length ? round1(avg(rows.map((s) => s.csat))) : "—"}</td>
                      <td className="tabular-nums">{rows.length ? round1(avg(rows.map((s) => s.ease))) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Responses per month (last 6 months)">
          <Columns items={trend.map((t) => ({ label: t.label, value: t.n }))} height={130} />
          <p className="mt-1 text-xs text-muted">NPS by month: {trend.map((t) => `${t.label} ${t.n ? t.nps : "—"}`).join(" · ")}</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="What people said" className="lg:col-span-2">
          {comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No comments in this period.</p>
          ) : (
            <ul className="-my-2 divide-y divide-line">
              {comments.map((c) => (
                <li key={c.id} className="flex items-start gap-3 py-2.5">
                  <span aria-label={c.mood} className="text-lg">{c.mood === "positive" ? "😊" : c.mood === "negative" ? "😟" : "😐"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">“{c.comments}”</p>
                    <p className="text-xs text-muted">
                      {TOUCHPOINTS.find((t) => t.key === c.touchpoint)?.label} · NPS {c.nps} · {fmtDate(c.at)}
                    </p>
                  </div>
                  <Badge tone={c.mood === "positive" ? "ok" : c.mood === "negative" ? "bad" : "neutral"}>{c.mood}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Offer acceptance">
          <div className="text-3xl font-semibold tabular-nums text-brand">{offers.decided ? `${offers.rate}%` : "—"}</div>
          <p className="text-sm text-muted">{offers.accepted} accepted of {offers.decided} decided offers</p>
          <p className="mt-3 text-xs text-muted">Benchmark: leading employers aim for 85%+. Low rates usually point to pay gaps or slow offers.</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Average days in each stage">
          <BarList items={stageTimes.map((s) => ({ label: s.label, value: s.days, hint: `(${s.n})` }))} format={(n) => `${n} d`} />
          <p className="mt-2 text-xs text-muted">Long waits are where candidates drop out. Aim for under 5 days per stage.</p>
        </Card>
        <Card title="Where candidates leave">
          <table className="table">
            <thead><tr><th>Stage</th><th>Rejected</th><th>Withdrew</th></tr></thead>
            <tbody>
              {drops.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="tabular-nums">{r.rejected}</td>
                  <td className="tabular-nums">{r.withdrawn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Source effectiveness">
          <table className="table">
            <thead><tr><th>Source</th><th>Applied</th><th>Shortlist</th><th>Hired</th></tr></thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.label}>
                  <td>{s.label}</td>
                  <td className="tabular-nums">{s.applied}</td>
                  <td className="tabular-nums">{s.shortlistRate}%</td>
                  <td className="tabular-nums">{s.hired}</td>
                </tr>
              ))}
              {sources.length === 0 && <tr><td colSpan={4} className="text-muted">No applications in this period.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
