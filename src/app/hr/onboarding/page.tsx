import Link from "next/link";
import clsx from "clsx";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { Avatar, EmptyState, Flash, PageHeader, Progress, Stat, StatusBadge, Tabs } from "@/components/ui";
import { onboardingSummary } from "@/lib/onboarding/journey";
import { buildJourney } from "@/lib/orientation/journey";
import { masterName, userName } from "@/lib/lookup";
import { fmtDate, todayInput } from "@/lib/format";
import type { Hire } from "@/lib/types";

export const metadata = { title: "Onboarding journeys" };

const FILTERS: { key: string; label: string; match: (h: Hire) => boolean }[] = [
  { key: "active", label: "In progress", match: (h) => h.status !== "completed" },
  { key: "preboarding", label: "Pre-boarding", match: (h) => h.status === "preboarding" },
  { key: "orientation", label: "Orientation", match: (h) => h.status === "orientation" },
  { key: "onboarding", label: "Onboarding", match: (h) => h.status === "onboarding" },
  { key: "completed", label: "Completed", match: (h) => h.status === "completed" },
  { key: "all", label: "All", match: () => true },
];

export default async function OnboardingList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSection("/hr/onboarding");
  const sp = await searchParams;
  const d = db();
  const today = todayInput();
  const visible = d.hires.filter((h) => user.role !== "hiring" || h.managerId === user.id);
  const filter = FILTERS.find((f) => f.key === sp.status) ?? FILTERS[0]!;
  const list = visible.filter(filter.match).sort((a, b) => a.joiningDate.localeCompare(b.joiningDate));
  const summaries = new Map(visible.map((h) => [h.id, onboardingSummary(h, today)]));
  const overdueTotal = visible.filter((h) => h.status !== "completed").reduce((s, h) => s + summaries.get(h.id)!.overdue.length, 0);
  const joiningSoon = visible.filter((h) => h.status !== "completed" && h.joiningDate >= today && h.joiningDate <= todayInput(14)).length;

  return (
    <div>
      <PageHeader
        title="Onboarding journeys"
        subtitle={user.role === "hiring" ? "New joiners in your team, from pre-boarding to their 90-day review." : "Every new joiner from offer acceptance to their 90-day review."}
      />
      <Flash msg={sp.msg} err={sp.err} />
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="In progress" value={visible.filter((h) => h.status !== "completed").length} />
        <Stat label="Joining in 14 days" value={joiningSoon} tone="brand" />
        <Stat label="Overdue tasks" value={overdueTotal} tone={overdueTotal ? "bad" : "ok"} />
        <Stat label="Completed" value={visible.filter((h) => h.status === "completed").length} tone="ok" />
      </div>
      <Tabs
        active={filter.key}
        tabs={FILTERS.map((f) => ({ key: f.key, label: f.label, href: `/hr/onboarding?status=${f.key}`, count: visible.filter(f.match).length }))}
      />
      {list.length === 0 ? (
        <EmptyState title="No journeys here" body="Journeys start automatically when a candidate accepts an offer." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.map((h) => {
            const s = summaries.get(h.id)!;
            const o = buildJourney(d, h);
            const offer = d.offers.find((x) => x.id === h.offerId);
            return (
              <li key={h.id}>
                <Link href={`/hr/onboarding/${h.id}`} className="block rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:border-brand/50">
                  <div className="flex items-start gap-3">
                    <Avatar name={h.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{h.name}</span>
                        <StatusBadge status={h.status} />
                        {h.employeeNo && <code className="rounded bg-brand-soft px-1.5 text-xs text-brand-2">{h.employeeNo}</code>}
                      </div>
                      <div className="text-sm text-muted">
                        {masterName(d, offer?.designationId)} · {masterName(d, offer?.branchId)}
                      </div>
                      <div className="text-xs text-muted">Joining {fmtDate(h.joiningDate)} · Manager {userName(d, h.managerId)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-1" aria-label="Phases">
                    {s.phases.map((p) => (
                      <div key={p.key} className="flex-1" title={`${p.label}: ${p.done}/${p.total}`}>
                        <div className={clsx("h-1.5 rounded-full", p.complete ? "bg-ok" : p.key === s.current ? "bg-brand" : p.done ? "bg-brand/40" : "bg-line")} />
                        <div className="mt-1 truncate text-[10px] text-muted">{p.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="mb-1 text-muted">Checklist {s.done}/{s.total}</div>
                      <Progress value={s.percent} tone={s.percent === 100 ? "ok" : "brand"} />
                    </div>
                    <div>
                      <div className="mb-1 text-muted">Orientation {o.requiredDone}/{o.requiredTotal}</div>
                      <Progress value={o.requiredTotal ? (o.requiredDone / o.requiredTotal) * 100 : 0} tone={o.allDone ? "ok" : "brand"} />
                    </div>
                  </div>
                  {s.overdue.length > 0 && h.status !== "completed" && (
                    <div className="mt-3 rounded-lg bg-bad-bg px-2.5 py-1.5 text-xs text-bad">⚠ {s.overdue.length} overdue: {s.overdue.slice(0, 2).map((t) => t.title).join(", ")}{s.overdue.length > 2 ? "…" : ""}</div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
