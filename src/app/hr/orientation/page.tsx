import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { Badge, Card, EmptyState, Flash, LinkButton, PageHeader, Progress, StatusBadge, Tabs } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { buildJourney } from "@/lib/orientation/journey";
import { fmtDate } from "@/lib/format";
import { masterName } from "@/lib/lookup";
import { moveModule, toggleModule } from "./actions";

const KIND_ICON = { presentation: "🎞️", pdf: "📄", video: "🎬", quiz: "❓", scorm: "📦" } as const;

export const metadata = { title: "Orientation" };

export default async function OrientationAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/orientation");
  const sp = await searchParams;
  const tab = sp.tab === "progress" ? "progress" : "modules";
  const d = db();
  const modules = [...d.modules].sort((a, b) => a.order - b.order);
  const hires = d.hires.filter((h) => h.status !== "preboarding").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active = modules.filter((m) => m.active);

  return (
    <div>
      <PageHeader
        title="Orientation"
        subtitle="A guided, gamified first week. When a new hire completes every required module, their employee ID is generated automatically."
        actions={<LinkButton href="/hr/orientation/modules/new">+ Add module</LinkButton>}
      />
      <Flash msg={sp.msg} err={sp.err} />
      <Tabs
        active={tab}
        tabs={[
          { key: "modules", label: "Modules", href: "/hr/orientation", count: modules.length },
          { key: "progress", label: "New hire progress", href: "/hr/orientation?tab=progress", count: hires.length },
        ]}
      />

      {tab === "modules" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface p-4 text-sm"><div className="text-xs uppercase text-muted">Active modules</div><div className="text-2xl font-semibold">{active.length}</div></div>
            <div className="rounded-xl border border-line bg-surface p-4 text-sm"><div className="text-xs uppercase text-muted">Points available</div><div className="text-2xl font-semibold">{active.reduce((s, m) => s + m.points, 0)}</div></div>
            <div className="rounded-xl border border-line bg-surface p-4 text-sm"><div className="text-xs uppercase text-muted">Total time</div><div className="text-2xl font-semibold">{active.reduce((s, m) => s + m.durationMin, 0)} min</div></div>
          </div>
          {modules.length === 0 ? (
            <EmptyState title="No modules yet" body="Add a welcome presentation, policies, a video and a short quiz." action={<LinkButton href="/hr/orientation/modules/new">Add module</LinkButton>} />
          ) : (
            <Card pad={false}>
              <ol className="divide-y divide-line">
                {modules.map((m, i) => {
                  const completions = d.progress.filter((p) => p.moduleId === m.id && p.status === "completed").length;
                  return (
                    <li key={m.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${m.active ? "" : "opacity-60"}`}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg" aria-hidden>{KIND_ICON[m.kind]}</span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/hr/orientation/modules/${m.id}`} className="font-medium hover:text-brand">{i + 1}. {m.title}</Link>
                        <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-muted">
                          <Badge tone="info">{m.kind.toUpperCase()}</Badge>
                          {m.required ? <Badge tone="brand">Required</Badge> : <Badge>Optional</Badge>}
                          {!m.active && <Badge tone="warn">Inactive</Badge>}
                          <span>{m.points} pts · {m.durationMin} min · {completions} completed</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <form action={moveModule}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="dir" value="up" /><SubmitButton variant="ghost" size="sm">↑</SubmitButton></form>
                        <form action={moveModule}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="dir" value="down" /><SubmitButton variant="ghost" size="sm">↓</SubmitButton></form>
                        <form action={toggleModule}><input type="hidden" name="id" value={m.id} /><SubmitButton variant="secondary" size="sm">{m.active ? "Deactivate" : "Activate"}</SubmitButton></form>
                        <LinkButton href={`/hr/orientation/modules/${m.id}`} variant="secondary" size="sm">Edit</LinkButton>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}
        </div>
      ) : hires.length === 0 ? (
        <EmptyState title="No new hires in orientation" body="New hires appear here after accepting their offer." />
      ) : (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>New hire</th><th>Role</th><th>Joining</th><th>Progress</th><th>Points</th><th>Rank</th><th>Employee ID</th><th>Status</th></tr></thead>
              <tbody>
                {hires.map((h) => {
                  const j = buildJourney(d, h);
                  const offer = d.offers.find((o) => o.id === h.offerId);
                  return (
                    <tr key={h.id}>
                      <td><Link href={`/hr/onboarding/${h.id}`} className="font-medium hover:text-brand">{h.name}</Link></td>
                      <td className="text-muted">{masterName(d, offer?.designationId)}</td>
                      <td>{fmtDate(h.joiningDate)}</td>
                      <td className="min-w-40">
                        <div className="mb-1 text-xs text-muted">{j.requiredDone}/{j.requiredTotal} required</div>
                        <Progress value={j.requiredTotal ? (j.requiredDone / j.requiredTotal) * 100 : 0} tone={j.allDone ? "ok" : "brand"} />
                      </td>
                      <td className="tabular-nums">{j.points}/{j.maxPoints}</td>
                      <td>{j.rank.icon} {j.rank.name}</td>
                      <td>{h.employeeNo ? <code className="rounded bg-brand-soft px-1.5 py-0.5 text-xs text-brand-2">{h.employeeNo}</code> : <span className="text-xs text-muted">After completion</span>}</td>
                      <td><StatusBadge status={h.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
