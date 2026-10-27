import Link from "next/link";
import clsx from "clsx";
import { db } from "@/lib/store";
import { fmtDateTime, relative } from "@/lib/format";
import type { User } from "@/lib/types";
import { Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { markAllRead, markRead } from "./actions";

export function NotificationList({ user, back, filter, msg }: { user: User; back: string; filter?: string; msg?: string }) {
  const all = db()
    .notifications.filter((n) => n.userId === user.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  const unread = all.filter((n) => !n.read).length;
  const list = filter === "unread" ? all.filter((n) => !n.read) : all;
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You're all caught up."}
        actions={
          unread > 0 && (
            <form action={markAllRead}>
              <input type="hidden" name="back" value={back} />
              <SubmitButton variant="secondary">Mark all as read</SubmitButton>
            </form>
          )
        }
      />
      <Flash msg={msg} />
      <div className="mb-3 flex gap-2 text-sm">
        <Link href={back} className={clsx("rounded-full px-3 py-1", filter !== "unread" ? "bg-brand text-white" : "bg-surface text-muted")}>All ({all.length})</Link>
        <Link href={`${back}?filter=unread`} className={clsx("rounded-full px-3 py-1", filter === "unread" ? "bg-brand text-white" : "bg-surface text-muted")}>Unread ({unread})</Link>
      </div>
      {list.length === 0 ? (
        <EmptyState title="No notifications" body="Approvals, interview updates and candidate responses will appear here." />
      ) : (
        <Card pad={false}>
          <ul className="divide-y divide-line">
            {list.slice(0, 200).map((n) => (
              <li key={n.id} className={clsx("flex items-start gap-3 px-4 py-3", !n.read && "bg-brand-soft/40")}>
                <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand")} aria-label={n.read ? "Read" : "Unread"} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="text-sm text-muted">{n.body}</div>
                  <div className="mt-0.5 text-xs text-muted" title={fmtDateTime(n.at)}>{relative(n.at)}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {n.href && (
                    <form action={markRead}>
                      <input type="hidden" name="id" value={n.id} />
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="open" value="1" />
                      <SubmitButton size="sm">Open</SubmitButton>
                    </form>
                  )}
                  {!n.read && (
                    <form action={markRead}>
                      <input type="hidden" name="id" value={n.id} />
                      <input type="hidden" name="back" value={back} />
                      <SubmitButton size="sm" variant="ghost">Mark read</SubmitButton>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
