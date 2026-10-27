import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName } from "@/lib/lookup";
import { daysBetween, fmtDate } from "@/lib/format";
import { Badge, Card, EmptyState, Flash, LinkButton, PageHeader, StatusBadge, Tabs } from "@/components/ui";

export const metadata = { title: "Job postings" };

export default async function PostingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSection("/hr/postings");
  const sp = await searchParams;
  const d = db();
  const tab = sp.tab ?? "open";
  const list = d.postings.filter((p) => tab === "all" || p.status === tab).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <PageHeader title="Job postings" subtitle="Live and past adverts, with reach and applicant numbers." actions={user.role !== "hiring" ? <LinkButton href="/hr/postings/new">+ New posting</LinkButton> : undefined} />
      <Flash msg={sp.msg} err={sp.err} />
      <Tabs active={tab} tabs={["open", "draft", "closed", "all"].map((k) => ({ key: k, label: k[0]!.toUpperCase() + k.slice(1), href: `/hr/postings?tab=${k}`, count: d.postings.filter((p) => k === "all" || p.status === k).length }))} />
      {list.length === 0 ? (
        <EmptyState title="No postings" body="Create a posting from an approved requisition." />
      ) : (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Posting</th><th>Channels</th><th className="text-right">Views</th><th className="text-right">Applicants</th><th className="text-right">Conversion</th><th>Open for</th><th>Status</th></tr></thead>
              <tbody>
                {list.map((p) => {
                  const apps = d.applications.filter((a) => a.postingId === p.id);
                  const expired = p.status === "open" && p.closeDate < today;
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/hr/postings/${p.id}`} className="font-medium text-brand hover:underline">{p.title}</Link>
                        <div className="text-xs text-muted">{p.city} · {masterName(d, p.departmentId)} · closes {fmtDate(p.closeDate)}</div>
                      </td>
                      <td><div className="flex max-w-56 flex-wrap gap-1">{p.channels.map((c) => <Badge key={c}>{c}</Badge>)}</div></td>
                      <td className="text-right tabular-nums">{p.views.toLocaleString()}</td>
                      <td className="text-right tabular-nums">
                        <Link href={`/hr/pipeline?posting=${p.id}`} className="text-brand hover:underline">{apps.length}</Link>
                        <div className="text-xs text-muted">{apps.filter((a) => a.stage === "applied" && a.status === "active").length} new</div>
                      </td>
                      <td className="text-right tabular-nums text-sm">{p.views ? `${((apps.length / p.views) * 100).toFixed(1)}%` : "—"}</td>
                      <td className="text-sm">{daysBetween(p.openDate, p.status === "closed" ? p.closeDate : today)} days</td>
                      <td>{expired ? <Badge tone="warn">Past closing date</Badge> : <StatusBadge status={p.status} />}</td>
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
