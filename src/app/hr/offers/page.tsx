import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { candidateOf, masterName } from "@/lib/lookup";
import { activeOfferFor, expiresWithinDays, offerIsExpired } from "@/lib/offers/OfferLetter";
import { fmtDate, pkr, relative } from "@/lib/format";
import { Badge, Card, EmptyState, Flash, LinkButton, PageHeader, Stat, StatusBadge, Tabs } from "@/components/ui";
import type { OfferStatus } from "@/lib/types";

export const metadata = { title: "Offers & acceptance" };

const TABS: { key: string; label: string; match: (s: OfferStatus) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "approval", label: "Awaiting approval", match: (s) => s === "pending_approval" || s === "draft" },
  { key: "ready", label: "Approved, not sent", match: (s) => s === "approved" },
  { key: "sent", label: "With candidate", match: (s) => s === "sent" },
  { key: "accepted", label: "Accepted", match: (s) => s === "accepted" },
  { key: "closed", label: "Declined / withdrawn / expired", match: (s) => ["declined", "withdrawn", "expired"].includes(s) },
];

export default async function OffersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/offers");
  const sp = await searchParams;
  const d = db();
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0]!;
  const offers = [...d.offers].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const expiringSoon = offers.filter((o) => expiresWithinDays(o, 3));
  const waiting = d.applications.filter((a) => a.status === "active" && a.stage === "offer" && !activeOfferFor(d, a.id));
  const decided = offers.filter((o) => o.status === "accepted" || o.status === "declined");
  const acceptRate = decided.length ? Math.round((decided.filter((o) => o.status === "accepted").length / decided.length) * 100) : 0;
  const shown = offers.filter((o) => tab.match(o.status));

  return (
    <div>
      <PageHeader title="Offers & acceptance" subtitle="Prepare offers, route them for approval, send them to candidates and track their response." />
      <Flash msg={sp.msg} err={sp.err} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Awaiting approval" value={offers.filter((o) => o.status === "pending_approval").length} tone="warn" href="/hr/offers?tab=approval" />
        <Stat label="With candidates" value={offers.filter((o) => o.status === "sent").length} href="/hr/offers?tab=sent" />
        <Stat label="Expiring in 3 days" value={expiringSoon.length} tone={expiringSoon.length ? "bad" : "default"} />
        <Stat label="Acceptance rate" value={`${acceptRate}%`} tone="ok" hint={`${decided.length} decided`} />
      </div>

      {waiting.length > 0 && (
        <Card title={`Ready for an offer (${waiting.length})`} className="mb-6">
          <ul className="divide-y divide-line">
            {waiting.map((a) => {
              const { cand, posting } = candidateOf(d, a.id);
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <div className="font-medium">{cand?.name}</div>
                    <div className="text-xs text-muted">{posting?.title} · {masterName(d, posting?.branchId)}</div>
                  </div>
                  <LinkButton size="sm" href={`/hr/offers/new?application=${a.id}`}>Prepare offer</LinkButton>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Tabs
        active={tab.key}
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/hr/offers?tab=${t.key}`, count: offers.filter((o) => t.match(o.status)).length }))}
      />
      {shown.length === 0 ? (
        <EmptyState title="No offers in this view" />
      ) : (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Offer</th><th>Candidate</th><th>Position</th><th className="text-right">Gross / month</th><th>Joining</th><th>Status</th><th>Expires</th></tr>
              </thead>
              <tbody>
                {shown.map((o) => {
                  const { cand } = candidateOf(d, o.applicationId);
                  const expired = offerIsExpired(o);
                  return (
                    <tr key={o.id}>
                      <td><Link href={`/hr/offers/${o.id}`} className="font-medium text-brand hover:underline">{o.code}</Link></td>
                      <td>{cand?.name}</td>
                      <td>
                        <div>{masterName(d, o.designationId)}</div>
                        <div className="text-xs text-muted">{masterName(d, o.gradeId)} · {masterName(d, o.branchId)}</div>
                      </td>
                      <td className="text-right tabular-nums">{pkr(o.grossMonthly)}</td>
                      <td>{fmtDate(o.joiningDate)}</td>
                      <td>
                        <StatusBadge status={expired ? "expired" : o.status} />
                        {o.counterOffer && o.status === "sent" && <div className="mt-1"><Badge tone="warn">Counter-offer</Badge></div>}
                      </td>
                      <td className="text-xs text-muted">{o.status === "sent" ? relative(o.expiresAt) : "—"}</td>
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
