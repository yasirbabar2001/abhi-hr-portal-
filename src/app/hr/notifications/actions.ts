"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { mutate } from "@/lib/store";

// Shared by the internal and candidate notification pages.
export async function markRead(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  let href: string | undefined;
  mutate((d) => {
    const n = d.notifications.find((x) => x.id === id && x.userId === user.id);
    if (n) {
      n.read = true;
      href = n.href;
    }
  });
  const back = String(form.get("back") ?? "/hr/notifications");
  redirect(form.get("open") && href ? href : back);
}

export async function markAllRead(form: FormData) {
  const user = await requireUser();
  mutate((d) => d.notifications.filter((n) => n.userId === user.id).forEach((n) => (n.read = true)));
  redirect(`${String(form.get("back") ?? "/hr/notifications")}?msg=All+caught+up.`);
}
