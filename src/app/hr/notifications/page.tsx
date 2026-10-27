import { requireSection } from "@/lib/auth";
import { NotificationList } from "./NotificationList";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSection("/hr");
  const sp = await searchParams;
  return <NotificationList user={user} back="/hr/notifications" filter={sp.filter} msg={sp.msg} />;
}
