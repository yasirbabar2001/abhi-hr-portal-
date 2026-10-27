import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { LetterView } from "@/lib/offers/LetterView";
import { Flash } from "@/components/ui";
import { PrintButton } from "@/components/forms";

export const metadata = { title: "Appointment letter" };

export default async function HrLetter({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/letters");
  const { id } = await params;
  const sp = await searchParams;
  const d = db();
  const letter = d.letters.find((l) => l.id === id);
  if (!letter) notFound();
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/hr/letters" className="text-sm text-muted hover:text-brand">← Appointment letters</Link>
        <div className="flex gap-2">
          <Link href={`/hr/offers/${letter.offerId}`} className="rounded-lg border border-line px-3.5 py-2 text-sm hover:border-brand hover:text-brand">Offer</Link>
          <Link href="/hr/onboarding" className="rounded-lg border border-line px-3.5 py-2 text-sm hover:border-brand hover:text-brand">Onboarding</Link>
          <PrintButton />
        </div>
      </div>
      <div className="no-print"><Flash msg={sp.msg} err={sp.err} /></div>
      <LetterView d={d} letter={letter} />
    </div>
  );
}
