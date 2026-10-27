"use server";
import { redirect } from "next/navigation";
import { hashPassword, passwordProblem, requireUser, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { mutate } from "@/lib/store";

export async function changePassword(form: FormData) {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (!verifyPassword(current, user.passwordHash)) redirect("/account?err=Your+current+password+is+not+correct.");
  const problem = passwordProblem(next);
  if (problem) redirect(`/account?err=${encodeURIComponent(problem)}`);
  if (next !== String(form.get("confirm") ?? "")) redirect("/account?err=The+new+passwords+do+not+match.");
  mutate((d) => {
    d.users.find((u) => u.id === user.id)!.passwordHash = hashPassword(next);
    audit(d, user, "auth.password_change", "user", user.id, `${user.name} changed their password`);
  });
  redirect("/account?msg=Password+changed.");
}
