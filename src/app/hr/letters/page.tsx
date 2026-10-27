import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { candidateOf, masterName, userName } from "@/lib/lookup";
import { fmtDate } from "@/lib/format";
import { Card, EmptyState, Flash, PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { issueLetter } from "./actions";

export const metadata = { title: "Appointment letters" };

export default async function LettersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/letters");
  const sp = await searchParams;
  const d = db();
  const pending = d.offers.filter((o) => o.status === "accepted" && !d.letters.some((l) => l.offerId === o.id));
  const letters = [...d.letters].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  return (
    <div>
      <PageHeader title="Appointment letters" subtitle="Issue the formal appointment letter once a candidate accepts an offer. Issuing marks the candidate as hired and starts their orientation." />
      <Flash msg={sp.msg} err={sp.err} />
      <Card title={`Waiting for a letter (${pending.length})`} className="mb-6">
        {pending.length === 0 ? (
          <p className="text-sm text-muted">Every accepted offer has an appointment letter. 👍</p>
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((o) => {
              const { cand } = candidateOf(d, o.applicationId);
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium">{cand?.name}</div>
                    <div className="text-xs text-muted">
                      {masterName(d, o.designationId)} · {masterName(d, o.branchId)} · accepted {fmtDate(o.candidateResponse?.at)} · joining {fmtDate(o.joiningDate)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/hr/offers/${o.id}`} className="text-sm text-muted hover:text-brand">{o.code}</Link>
                    <form action={issueLetter}>
                      <input type="hidden" name="offerId" value={o.id} />
                      <SubmitButton size="sm">Issue letter</SubmitButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {letters.length === 0 ? (
        <EmptyState title="No letters issued yet" />
      ) : (
        <Card title="Issued letters" pad={false}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Reference</th><th>Employee</th><th>Position</th><th>Issued</th><th>Status</th></tr></thead>
              <tbody>
                {letters.map((l) => {
                  const { cand } = candidateOf(d, l.applicationId);
                  const o = d.offers.find((x) => x.id === l.offerId);
                  return (
                    <tr key={l.id}>
                      <td><Link href={`/hr/letters/${l.id}`} className="font-medium text-brand hover:underline">{l.ref}</Link></td>
                      <td>{cand?.name}</td>
                      <td>{masterName(d, o?.designationId)}</td>
                      <td>{fmtDate(l.issuedAt)}<div className="text-xs text-muted">by {userName(d, l.issuedBy)}</div></td>
                      <td><StatusBadge status={l.status} /></td>
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
