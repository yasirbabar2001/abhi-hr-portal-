import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName } from "@/lib/lookup";
import { EmptyState, Flash, PageHeader } from "@/components/ui";
import { PostingForm } from "../PostingForm";

export const metadata = { title: "New job posting" };

export default async function NewPosting({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/postings");
  const sp = await searchParams;
  const d = db();
  const req = sp.requisition ? d.requisitions.find((r) => r.id === sp.requisition) : undefined;
  if (!req || req.status !== "approved") {
    const approved = d.requisitions.filter((r) => r.status === "approved");
    return (
      <div className="max-w-3xl">
        <PageHeader title="New job posting" subtitle="Postings are created from an approved requisition." back={{ href: "/hr/postings", label: "Job postings" }} />
        <Flash err={sp.err} />
        {approved.length === 0 ? (
          <EmptyState title="No approved requisitions" body="A requisition must be approved before it can be advertised." />
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {approved.map((r) => (
              <li key={r.id}>
                <Link href={`/hr/postings/new?requisition=${r.id}`} className="flex justify-between gap-3 px-4 py-3 hover:bg-paper">
                  <span><span className="font-medium">{r.title}</span><span className="block text-xs text-muted">{r.code} · {masterName(d, r.branchId)}</span></span>
                  <span className="text-xs text-muted">{d.postings.filter((p) => p.requisitionId === r.id).length} posting(s) →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  const jd = req.jdId ? d.jds.find((j) => j.id === req.jdId) : undefined;
  return (
    <div className="max-w-4xl">
      <PageHeader title="New job posting" subtitle={`From ${req.code} ${req.title}${jd ? ` · JD ${jd.code}` : ""}`} back={{ href: `/hr/requisitions/${req.id}`, label: "Requisition" }} />
      <Flash err={sp.err} />
      <PostingForm d={d} req={req} jd={jd} />
    </div>
  );
}
