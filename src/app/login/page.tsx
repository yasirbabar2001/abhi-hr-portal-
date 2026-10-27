import Link from "next/link";
import type { Metadata } from "next";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { DEMO_PASSWORD } from "@/lib/seed";
import { login } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const DEMO = [
  ["admin@abhi.com.pk", "Administrator"],
  ["hr@abhi.com.pk", "HR (talent acquisition)"],
  ["manager@abhi.com.pk", "Hiring manager"],
  ["candidate@example.com", "Candidate / new hire"],
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const showDemo = process.env.DEMO_MODE !== "off";
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-side p-10 text-on-side lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand font-bold text-white">A</span>
          <span className="font-semibold text-white">ABHI People</span>
        </div>
        <div>
          <h2 className="text-3xl font-semibold leading-tight text-white">From requisition to first day,<br />in one place.</h2>
          <p className="mt-3 max-w-md text-on-side-muted">
            Plan headcount, hire with structured interviews, verify references and eCIB, send offers, and welcome new colleagues with a guided orientation.
          </p>
        </div>
        <p className="text-xs text-on-side-muted">ABHI Microfinance Bank Limited</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-muted">
            New candidate? <Link href="/register" className="text-brand underline">Create an account</Link> or{" "}
            <Link href="/careers" className="text-brand underline">browse jobs</Link>.
          </p>
          <div className="mt-6">
            <Flash msg={sp.msg} err={sp.err} />
            <form action={login} className="space-y-4">
              <input type="hidden" name="next" value={sp.next ?? ""} />
              <label className="block">
                <span className="label">Email</span>
                <input name="email" type="email" required autoComplete="email" defaultValue={sp.email} className="input" />
              </label>
              <label className="block">
                <span className="label">Password</span>
                <input name="password" type="password" required autoComplete="current-password" className="input" />
              </label>
              <SubmitButton className="w-full">Sign in</SubmitButton>
            </form>
          </div>
          {showDemo && (
            <div className="mt-8 rounded-lg border border-line bg-surface p-4 text-sm">
              <div className="font-medium">Demo accounts</div>
              <p className="text-xs text-muted">Password for all: <code className="rounded bg-paper px-1">{DEMO_PASSWORD}</code>. Turn off with DEMO_MODE=off.</p>
              <ul className="mt-2 space-y-1">
                {DEMO.map(([email, role]) => (
                  <li key={email} className="flex justify-between gap-2">
                    <code className="text-xs">{email}</code>
                    <span className="text-xs text-muted">{role}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
