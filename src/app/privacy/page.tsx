import { PublicShell } from "@/components/shell/PublicShell";
import { db } from "@/lib/store";

export const metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  const s = db().settings;
  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl space-y-4 text-sm leading-relaxed">
        <h1 className="text-2xl font-semibold">Recruitment privacy notice</h1>
        <p>This notice explains how {s.companyName} uses the personal data you give us when you apply for a job.</p>
        <h2 className="text-lg font-semibold">What we collect</h2>
        <p>Your contact details, CNIC, education and work history, your CV, answers to application questions, interview notes and recordings (only with your consent), reference feedback and, for selected candidates, a credit-history check through the State Bank of Pakistan&apos;s eCIB (only with your written consent).</p>
        <h2 className="text-lg font-semibold">Why we use it</h2>
        <p>To assess your application fairly, to communicate with you, to meet our legal and regulatory obligations as a bank, and, if you are hired, to set up your employment.</p>
        <h2 className="text-lg font-semibold">How long we keep it</h2>
        <p>Applications that do not lead to employment are kept for {s.candidateDataRetentionMonths} months, then deleted or anonymised. If you joined the talent pool, we keep your profile until you leave it.</p>
        <h2 className="text-lg font-semibold">Your choices</h2>
        <p>You can view and update your profile at any time, withdraw an application, leave the talent pool, or ask us to delete your data by writing to {s.supportEmail}.</p>
      </article>
    </PublicShell>
  );
}
