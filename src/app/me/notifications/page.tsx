import { requireUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { relative } from "@/lib/format";
import { EmptyState, Flash } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { markAllRead, openNotification } from "../actions";

export const metadata = { title: "Notifications" };

export default async function MyNotifications({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(["candidate"]);
  const sp = await searchParams;
  const list = db().notifications.filter((n) => n.userId === user.id).sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        {list.some((n) => !n.read) && <form action={markAllRead}><SubmitButton variant="secondary" size="sm">Mark all as read</SubmitButton></form>}
      </div>
      <Flash msg={sp.msg} />
      {list.length === 0 ? (
        <EmptyState title="No notifications yet" body="Updates about your applications will appear here." />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {list.map((n) => (
            <li key={n.id}>
              <form action={openNotification}>
                <input type="hidden" name="id" value={n.id} />
                <button className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-paper ${n.read ? "" : "bg-brand-soft/40"}`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-brand"}`} />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{n.title}</span>
                    <span className="block text-sm text-muted">{n.body}</span>
                    <span className="block text-xs text-muted">{relative(n.at)}</span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
