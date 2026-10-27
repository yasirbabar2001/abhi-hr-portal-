"use server";
import { redirect } from "next/navigation";
import { clientIp, startSession, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db, mutate, nowIso } from "@/lib/store";
import { INTERNAL_ROLES } from "@/lib/types";

const failures = new Map<string, { count: number; until: number }>();

export async function login(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");
  const lock = failures.get(email);
  if (lock && lock.count >= 5 && lock.until > Date.now()) {
    redirect(`/login?err=${encodeURIComponent("Too many attempts. Please wait 15 minutes and try again.")}`);
  }
  const user = db().users.find((u) => u.email.toLowerCase() === email);
  const ip = await clientIp();
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    const f = failures.get(email) ?? { count: 0, until: 0 };
    failures.set(email, { count: f.count + 1, until: Date.now() + 15 * 60_000 });
    mutate((d) =>
      audit(d, { id: user?.id ?? "unknown", name: email || "unknown", role: "public" }, "auth.login_failed", "user", user?.id ?? "-", `Failed sign-in for ${email}`, { ip }),
    );
    redirect(`/login?err=${encodeURIComponent("Email or password is not correct.")}&email=${encodeURIComponent(email)}`);
  }
  failures.delete(email);
  mutate((d) => {
    const u = d.users.find((x) => x.id === user.id)!;
    u.lastLoginAt = nowIso();
    audit(d, user, "auth.login", "user", user.id, `${user.name} signed in`, { ip });
  });
  await startSession(user.id);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "";
  redirect(safeNext || (INTERNAL_ROLES.includes(user.role) ? "/hr" : "/me"));
}
