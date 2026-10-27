import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName } from "@/lib/lookup";
import { summarize } from "@/lib/verification/status";
import { fmtDate } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, StatusBadge, Stat, Tabs } from "@/components/ui";

export const metadata = { title: "References & eCIB" };

type Filter = "all" | "open" | "overdue" | "ready";

export default async function VerificationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/verification");
  const sp = await searchParams;
  const filter = (["all", "open", "overdue", "ready"].includes(sp.f ?? "") ? sp.f : "all") as Filter;
  const q = (sp.q ?? "").toLowerCase();
  const d = db();

  // Applications in verification, plus later-stage applications that still have open checks.
  const rows = d.applications
    .filter((a) => a.status === "active" || a.status === "hired")
    .map((a) => ({ a, s: summarize(d, a), cand: d.candidates.find((c) => c.id === a.candidateId), post: d.postings.find((p) => p.id === a.postingId) }))
    .filter(({ a, s }) => {
      if (a.stage === "verification") return true;
      if (!["offer", "hired"].includes(a.stage)) return false;
      const openRef = s.refs.some((r) => r.status === "requested" || r.status === "received");
      const openEcib = s.ecib && !["clear", "adverse", "exception"].includes(s.ecib.status);
      return openRef || !!openEcib;
    })
    .filter(({ cand, post }) => !q || `${cand?.name} ${post?.title} ${cand?.cnic}`.toLowerCase().includes(q));

  const counts = {
    all: rows.length,
    open: rows.filter((r) => !r.s.ready).length,
    overdue: rows.filter((r) => r.s.overdue).length,
    ready: rows.filter((r) => r.s.ready && r.a.stage === "verification").length,
  };
  const shown = rows.filter(({ a, s }) =>
    filter === "open" ? !s.ready : filter === "overdue" ? s.overdue : filter === "ready" ? s.ready && a.stage === "verification" : true,
  );
  const tab = (k: Filter, label: string) => ({ key: k, label, count: counts[k], href: `/hr/verification?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}` });

  return (
    <div>
      <PageHeader
        title="References & eCIB verification"
        subtitle="Background checks for shortlisted candidates. A candidate moves to Offer once every reference is verified and the eCIB check is clear."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="In verification" value={d.applications.filter((a) => a.stage === "verification" && a.status === "active").length} />
        <Stat label="Checks outstanding" value={counts.open} tone="warn" />
        <Stat label="Overdue (> 5 days)" value={counts.overdue} tone={counts.overdue ? "bad" : "default"} />
        <Stat label="Ready for offer" value={counts.ready} tone="ok" />
      </div>
      <Tabs active={filter} tabs={[tab("all", "All"), tab("open", "Outstanding"), tab("overdue", "Overdue"), tab("ready", "Ready for offer")]} />
      <form className="mb-4 flex max-w-md gap-2">
        <input type="hidden" name="f" value={filter} />
        <input name="q" defaultValue={sp.q} placeholder="Search name, role or CNIC" className="input" type="search" />
      </form>
      {shown.length === 0 ? (
        <EmptyState title="Nothing here" body="No candidates match this view. Candidates appear here when they reach the Verification stage." />
      ) : (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Role</th>
                  <th>Stage</th>
                  <th>References</th>
                  <th>eCIB</th>
                  <th>Next step</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map(({ a, s, cand, post }) => (
                  <tr key={a.id} className={s.overdue ? "bg-bad-bg/40" : undefined}>
                    <td>
                      <div className="font-medium">{cand?.name}</div>
                      <div className="text-xs text-muted">{a.code}</div>
                    </td>
                    <td>
                      <div>{post?.title}</div>
                      <div className="text-xs text-muted">{masterName(d, post?.branchId)}</div>
                    </td>
                    <td><StatusBadge status={a.stage} /></td>
                    <td>
                      {s.refs.length === 0 ? (
                        <Badge tone="warn">None yet</Badge>
                      ) : (
                        <span className="text-sm">
                          {s.refsReceived}/{s.refs.length} received · {s.refsVerified} verified
                        </span>
                      )}
                    </td>
                    <td>
                      {s.ecib ? (
                        <div>
                          <StatusBadge status={s.ecib.status} />
                          <div className="text-xs text-muted">since {fmtDate(s.ecib.requestedAt)}</div>
                        </div>
                      ) : (
                        <Badge tone="warn">Not started</Badge>
                      )}
                    </td>
                    <td className="text-xs">
                      {s.overdue && <Badge tone="bad">Overdue</Badge>}{" "}
                      {s.ready ? <span className="text-ok">All checks complete</span> : <span className="text-muted">{s.blockers[0]}</span>}
                    </td>
                    <td>
                      <Link href={`/hr/verification/${a.id}`} className="text-sm font-medium text-brand hover:underline">Open →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
