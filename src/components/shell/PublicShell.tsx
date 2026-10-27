import Link from "next/link";
import { currentUser, isInternal } from "@/lib/auth";
import { db } from "@/lib/store";

/** Header and footer for the careers site and the candidate portal. */
export async function PublicShell({ children, candidateNav = false }: { children: React.ReactNode; candidateNav?: boolean }) {
  const user = await currentUser();
  const s = db().settings;
  const unread = user ? db().notifications.filter((n) => n.userId === user.id && !n.read).length : 0;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur no-print">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/careers" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-bold text-white">A</span>
            <span className="whitespace-nowrap text-sm font-semibold">{s.shortName}<span className="hidden sm:inline"> Careers</span></span>
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm">
            <Link href="/careers" className="whitespace-nowrap rounded-lg px-2 py-1.5 sm:px-3 hover:bg-paper">Jobs</Link>
            {user && user.role === "candidate" && (
              <>
                <Link href="/me" className="whitespace-nowrap rounded-lg px-2 py-1.5 sm:px-3 hover:bg-paper">My applications</Link>
                <Link href="/me/notifications" className="whitespace-nowrap rounded-lg px-2 py-1.5 sm:px-3 hover:bg-paper" aria-label="Notifications">
                  🔔{unread > 0 && <span className="ml-1 rounded-full bg-bad px-1.5 text-[10px] text-white">{unread}</span>}
                </Link>
              </>
            )}
            {user && isInternal(user) && (
              <Link href="/hr" className="whitespace-nowrap rounded-lg px-2 py-1.5 sm:px-3 hover:bg-paper">HR workspace</Link>
            )}
            {user ? (
              <details className="relative">
                <summary className="cursor-pointer list-none whitespace-nowrap rounded-lg px-2 py-1.5 sm:px-3 hover:bg-paper">{user.name.split(" ")[0]} ▾</summary>
                <div className="absolute right-0 mt-1 w-48 rounded-lg border border-line bg-surface p-1 shadow-lg">
                  {user.role === "candidate" && <Link href="/me/profile" className="block rounded px-3 py-1.5 hover:bg-paper">My profile</Link>}
                  <Link href="/account" className="block rounded px-3 py-1.5 hover:bg-paper">Account & password</Link>
                  <form action="/logout" method="post">
                    <button className="w-full rounded px-3 py-1.5 text-left text-bad hover:bg-paper">Sign out</button>
                  </form>
                </div>
              </details>
            ) : (
              <>
                <Link href="/login" className="whitespace-nowrap rounded-lg px-2 py-1.5 sm:px-3 hover:bg-paper">Sign in</Link>
                <Link href="/register" className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand-2">Create account</Link>
              </>
            )}
          </nav>
        </div>
        {candidateNav && <div className="h-0" />}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-line bg-surface py-6 text-center text-xs text-muted no-print">
        © {new Date().getFullYear()} {s.companyName}. An equal opportunity employer. Questions? {s.supportEmail}
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:text-brand">Privacy notice</Link>
      </footer>
    </div>
  );
}
