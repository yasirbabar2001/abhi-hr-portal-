import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-5xl">🧭</div>
      <h1 className="text-xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="text-sm text-muted">It may have moved, or the link may be out of date.</p>
      <div className="flex gap-2">
        <Link href="/" className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white">Go home</Link>
        <Link href="/careers" className="rounded-lg border border-line px-3.5 py-2 text-sm">Browse jobs</Link>
      </div>
    </div>
  );
}
