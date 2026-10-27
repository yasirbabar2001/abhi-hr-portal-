import Link from "next/link";
import type { Metadata } from "next";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { PublicShell } from "@/components/shell/PublicShell";
import { register } from "./actions";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <PublicShell>
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold">Create your candidate account</h1>
        <p className="mt-1 text-sm text-muted">
          One account to apply for jobs, track your applications, join interviews and complete onboarding. Already registered?{" "}
          <Link href={`/login${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="text-brand underline">Sign in</Link>
        </p>
        <div className="mt-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
          <Flash err={sp.err} />
          <form action={register} className="space-y-4">
            <input type="hidden" name="next" value={sp.next ?? ""} />
            <label className="block"><span className="label">Full name (as on CNIC)</span><input name="name" required className="input" autoComplete="name" /></label>
            <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
            <label className="block"><span className="label">Mobile number</span><input name="phone" required className="input" placeholder="03XX XXXXXXX" autoComplete="tel" /></label>
            <label className="block">
              <span className="label">Password</span>
              <input name="password" type="password" required minLength={8} className="input" autoComplete="new-password" />
              <span className="hint block">At least 8 characters, with a letter and a number.</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="consent" required className="mt-1" />
              <span>I agree that ABHI may process my data for recruitment, as described in the <Link href="/privacy" className="text-brand underline" target="_blank">privacy notice</Link>.</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="talentPool" className="mt-1" />
              <span>Keep me in the talent pool and tell me about suitable future roles.</span>
            </label>
            <SubmitButton className="w-full">Create account</SubmitButton>
          </form>
        </div>
      </div>
    </PublicShell>
  );
}
