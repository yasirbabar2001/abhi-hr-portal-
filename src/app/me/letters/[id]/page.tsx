import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { LetterView } from "@/lib/offers/LetterView";
import { Card, Flash, LinkButton, PageHeader } from "@/components/ui";
import { PrintButton, SubmitButton } from "@/components/forms";
import { acknowledgeLetter } from "./actions";

export const metadata = { title: "Appointment letter" };

export default async function MyLetter({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(["candidate"]);
  const { id } = await params;
  const sp = await searchParams;
  const d = db();
  const letter = d.letters.find((l) => l.id === id);
  const app = letter ? d.applications.find((a) => a.id === letter.applicationId) : undefined;
  const cand = app ? d.candidates.find((c) => c.id === app.candidateId) : undefined;
  if (!letter || !cand || cand.userId !== user.id) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print">
        <PageHeader
          back={{ href: "/me", label: "My applications" }}
          title="Your appointment letter"
          subtitle={`Ref ${letter.ref}`}
          actions={<PrintButton label="Print / download PDF" />}
        />
        <Flash msg={sp.msg} err={sp.err} />
        {letter.status === "acknowledged" ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ok/30 bg-ok-bg p-4 text-sm">
            <span>You have signed this letter. Next: complete your orientation to receive your employee ID.</span>
            <div className="flex gap-2">
              <LinkButton href="/me/orientation" size="sm">Start orientation</LinkButton>
              <LinkButton href="/me/onboarding" size="sm" variant="secondary">Onboarding checklist</LinkButton>
            </div>
          </div>
        ) : (
          <Card title="Read and sign" className="mb-6">
            <form action={acknowledgeLetter} className="grid gap-3 text-sm sm:grid-cols-[1fr_auto] sm:items-end">
              <input type="hidden" name="letterId" value={letter.id} />
              <div className="space-y-2">
                <label className="flex items-start gap-2">
                  <input type="checkbox" name="agree" required className="mt-1" />
                  <span>I have read the letter below and accept the terms and conditions of my appointment.</span>
                </label>
                <input name="signature" required className="input max-w-sm font-serif italic" placeholder={`Type your full name: ${cand.name}`} autoComplete="off" aria-label="Type your full name to sign" />
              </div>
              <SubmitButton>Sign & acknowledge</SubmitButton>
            </form>
          </Card>
        )}
      </div>
      <LetterView d={d} letter={letter} />
    </div>
  );
}
