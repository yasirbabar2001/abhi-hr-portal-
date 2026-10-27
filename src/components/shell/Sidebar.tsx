"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { NavGroup } from "@/lib/nav";

export function Sidebar({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/hr" ? path === "/hr" : path === href || path.startsWith(href + "/"));
  return (
    <nav className="space-y-5 px-3 py-4" aria-label="Main">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-on-side-muted">{g.label}</div>
          <ul className="space-y-0.5">
            {g.items.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  onClick={onNavigate}
                  aria-current={isActive(i.href) ? "page" : undefined}
                  className={clsx(
                    "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm",
                    isActive(i.href) ? "bg-side-2 font-medium text-white" : "text-on-side hover:bg-side-2/60",
                  )}
                >
                  <span aria-hidden className="w-5 text-center">{i.icon}</span>
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function MobileNav({ groups }: { groups: NavGroup[] }) {
  return (
    <details className="group lg:hidden">
      <summary className="flex cursor-pointer list-none items-center rounded-lg border border-line px-2.5 py-1.5 text-sm">☰ Menu</summary>
      <div className="fixed inset-x-0 top-14 bottom-0 z-40 overflow-y-auto bg-side">
        <Sidebar groups={groups} onNavigate={() => document.querySelectorAll("details[open]").forEach((d) => d.removeAttribute("open"))} />
      </div>
    </details>
  );
}
