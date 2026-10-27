import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { fmtDateTime, humanize } from "@/lib/format";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { diffKeys, filterAudit } from "@/lib/admin/audit-filter";

const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/audit");
  const sp = await searchParams;
  const d = db();
  const filter = { actor: sp.actor || undefined, entity: sp.entity || undefined, action: sp.action || undefined, from: sp.from || undefined, to: sp.to || undefined, q: sp.q || undefined };
  const rows = filterAudit(d.audit, filter);
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const entities = [...new Set(d.audit.map((a) => a.entity))].sort();
  const actors = [...new Map(d.audit.map((a) => [a.actorId, a.actorName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const qs = (extra: Record<string, string>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filter, ...extra })) if (v) u.set(k, v);
    return `?${u.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Audit trail"
        subtitle="Every sign-in, change and decision, with who did it and when. Entries cannot be edited or deleted."
        actions={<LinkButton variant="secondary" href={`/hr/audit/export${qs({})}`}>⬇ Export CSV</LinkButton>}
      />
      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <label><span className="label">Search</span><input name="q" defaultValue={sp.q} className="input" placeholder="Name, summary, ID…" /></label>
          <label>
            <span className="label">Who</span>
            <select name="actor" defaultValue={sp.actor ?? ""} className="input">
              <option value="">Anyone</option>
              {actors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Record type</span>
            <select name="entity" defaultValue={sp.entity ?? ""} className="input">
              <option value="">All</option>
              {entities.map((e) => <option key={e} value={e}>{humanize(e)}</option>)}
            </select>
          </label>
          <label><span className="label">Action starts with</span><input name="action" defaultValue={sp.action} className="input" placeholder="e.g. offer." /></label>
          <label><span className="label">From</span><input type="date" name="from" defaultValue={sp.from} className="input" /></label>
          <label><span className="label">To</span><input type="date" name="to" defaultValue={sp.to} className="input" /></label>
          <div className="flex gap-2 sm:col-span-3 lg:col-span-6">
            <button className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-2">Apply filters</button>
            <Link href="/hr/audit" className="rounded-lg px-3.5 py-2 text-sm text-muted hover:text-ink">Clear</Link>
            <span className="ml-auto self-center text-sm text-muted">{rows.length.toLocaleString()} entries</span>
          </div>
        </form>
      </Card>
      {shown.length === 0 ? (
        <EmptyState title="No entries match these filters" />
      ) : (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>When</th><th>Who</th><th>Action</th><th>What happened</th><th>Details</th></tr>
              </thead>
              <tbody>
                {shown.map((e) => {
                  const diff = diffKeys(e.before, e.after);
                  return (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(e.at)}</td>
                      <td className="whitespace-nowrap">
                        <div className="text-sm">{e.actorName}</div>
                        <div className="text-xs text-muted">{e.actorRole}{e.ip ? ` · ${e.ip}` : ""}</div>
                      </td>
                      <td><Badge tone={e.action.includes("fail") || e.action.includes("reject") ? "bad" : "neutral"}>{e.action}</Badge></td>
                      <td className="min-w-64">
                        {e.summary}
                        <div className="text-xs text-muted">{humanize(e.entity)} · {e.entityId}</div>
                      </td>
                      <td className="min-w-40">
                        {e.before !== undefined || e.after !== undefined ? (
                          <details>
                            <summary className="cursor-pointer text-xs text-brand">{diff.length ? `${diff.length} field${diff.length > 1 ? "s" : ""} changed` : "View data"}</summary>
                            {diff.length > 0 && e.before !== undefined && e.after !== undefined ? (
                              <table className="mt-2 text-xs">
                                <tbody>
                                  {diff.map((x) => (
                                    <tr key={x.key} className="align-top">
                                      <td className="pr-2 font-medium">{x.key}</td>
                                      <td className="pr-2 text-bad line-through">{short(x.before)}</td>
                                      <td className="text-ok">{short(x.after)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <pre className="mt-2 max-h-64 max-w-md overflow-auto rounded bg-paper p-2 text-[11px]">{JSON.stringify(e.after ?? e.before, null, 2)}</pre>
                            )}
                          </details>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2 text-sm">
          {page > 1 && <Link href={qs({ page: String(page - 1) })} className="rounded-lg border border-line bg-surface px-3 py-1.5">← Newer</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={qs({ page: String(page + 1) })} className="rounded-lg border border-line bg-surface px-3 py-1.5">Older →</Link>}
        </nav>
      )}
    </div>
  );
}

function short(v: unknown) {
  if (v === undefined) return "∅";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
}
