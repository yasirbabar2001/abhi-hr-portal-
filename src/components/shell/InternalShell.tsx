import Link from "next/link";
import { db } from "@/lib/store";
import { navFor } from "@/lib/nav";
import type { User } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";
import { Avatar } from "@/components/ui";
import { MobileNav, Sidebar } from "./Sidebar";

export function InternalShell({ user, children }: { user: User; children: React.ReactNode }) {
  const d = db();
  const groups = navFor(user.role);
  const unread = d.notifications.filter((n) => n.userId === user.id && !n.read).length;
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 overflow-y-auto bg-side lg:block">
        <Link href="/hr" className="flex h-14 items-center gap-2 border-b border-side-2 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-bold text-white">A</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-white">{d.settings.shortName} People</span>
            <span className="block text-[11px] text-on-side-muted">Talent & HR portal</span>
          </span>
        </Link>
        <Sidebar groups={groups} />
      </aside>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur no-print">
        <MobileNav groups={groups} />
        <form action="/hr/search" className="max-w-md flex-1">
          <input
            name="q"
            type="search"
            placeholder="Search candidates, employees, requisitions…"
            className="input bg-paper"
            aria-label="Search"
          />
        </form>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/careers" className="hidden text-sm text-muted hover:text-brand sm:block" target="_blank">
            Careers site ↗
          </Link>
          <Link href="/hr/notifications" className="relative rounded-lg p-1.5 hover:bg-paper" aria-label={`Notifications (${unread} unread)`}>
            <span aria-hidden>🔔</span>
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-bad px-1 text-center text-[10px] font-semibold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2">
              <Avatar name={user.name} />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-medium">{user.name}</span>
                <span className="block text-[11px] text-muted">{ROLE_LABEL[user.role]}</span>
              </span>
            </summary>
            <div className="absolute right-0 mt-2 w-52 rounded-lg border border-line bg-surface p-1 shadow-lg">
              <div className="px-3 py-2 text-xs text-muted">{user.email}</div>
              <Link href="/account" className="block rounded px-3 py-1.5 text-sm hover:bg-paper">My account</Link>
              <form action="/logout" method="post">
                <button className="w-full rounded px-3 py-1.5 text-left text-sm text-bad hover:bg-paper">Sign out</button>
              </form>
            </div>
          </details>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
