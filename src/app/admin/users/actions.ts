"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { db, mutate, nowIso, uid } from "@/lib/store";
import { roleChangeProblem, tempPassword, userSnapshot } from "@/lib/admin/users";
import type { Role } from "@/lib/types";

const back = (q: string) => redirect(`/admin/users?${q}`);
const enc = encodeURIComponent;

/** Show a temporary password once, via a short-lived cookie (never in the URL or audit log). */
async function revealOnce(id: string, pw: string, reset: boolean) {
  (await cookies()).set("abhi_tmp_pw", JSON.stringify({ id, pw, reset }), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin/users",
    maxAge: 120,
  });
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Enter the person's full name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(["admin", "hr", "hiring"]),
  title: z.string().trim().optional(),
  departmentId: z.string().optional(),
});

export async function createUser(form: FormData) {
  const actor = await requireAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) back(`err=${enc(parsed.error.issues[0]!.message)}&new=1`);
  const v = parsed.data!;
  if (db().users.some((u) => u.email.toLowerCase() === v.email)) back(`err=${enc("A user with this email already exists.")}&new=1`);
  const pw = tempPassword();
  const id = uid("u_");
  mutate((d) => {
    const user = {
      id,
      email: v.email,
      name: v.name,
      role: v.role as Role,
      passwordHash: hashPassword(pw),
      active: true,
      title: v.title || undefined,
      departmentId: v.departmentId || undefined,
      createdAt: nowIso(),
    };
    d.users.push(user);
    audit(d, actor, "user.create", "user", id, `${actor.name} created ${v.role} user ${v.name}`, { after: userSnapshot(user) });
    notify(d, { userId: id }, "Welcome to ABHI People", "Your account is ready. Please change your temporary password from My account.", "/account");
  });
  await revealOnce(id, pw, false);
  back(`created=${id}`);
}

export async function updateUser(form: FormData) {
  const actor = await requireAdmin();
  const id = String(form.get("id"));
  const d0 = db();
  const target = d0.users.find((u) => u.id === id);
  if (!target) back(`err=${enc("User not found.")}`);
  const role = String(form.get("role") ?? target!.role) as Role;
  if (!["admin", "hr", "hiring", "candidate"].includes(role)) back(`err=${enc("Unknown role.")}`);
  const problem = roleChangeProblem(d0, actor, target!, { role });
  if (problem) back(`edit=${id}&err=${enc(problem)}`);
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) back(`edit=${id}&err=${enc("Enter a name.")}`);
  mutate((d) => {
    const u = d.users.find((x) => x.id === id)!;
    const before = userSnapshot(u);
    u.name = name;
    u.role = role;
    if (role !== "candidate") {
      u.title = String(form.get("title") ?? "").trim() || undefined;
      u.departmentId = String(form.get("departmentId") ?? "") || undefined;
    }
    const roleChanged = before.role !== role;
    audit(d, actor, roleChanged ? "user.role_change" : "user.update", "user", id, roleChanged ? `${actor.name} changed ${u.name}'s role from ${before.role} to ${role}` : `${actor.name} updated ${u.name}`, { before, after: userSnapshot(u) });
    if (roleChanged) notify(d, { userId: id }, "Your access has changed", `Your role is now ${role}.`, "/");
  });
  back(`msg=${enc("Changes saved.")}`);
}

export async function setActive(form: FormData) {
  const actor = await requireAdmin();
  const id = String(form.get("id"));
  const active = form.get("active") === "1";
  const d0 = db();
  const target = d0.users.find((u) => u.id === id);
  if (!target) back(`err=${enc("User not found.")}`);
  const problem = roleChangeProblem(d0, actor, target!, { active });
  if (problem) back(`err=${enc(problem)}`);
  mutate((d) => {
    const u = d.users.find((x) => x.id === id)!;
    const before = userSnapshot(u);
    u.active = active;
    audit(d, actor, active ? "user.activate" : "user.deactivate", "user", id, `${actor.name} ${active ? "reactivated" : "deactivated"} ${u.name}`, { before, after: userSnapshot(u) });
  });
  back(`msg=${enc(active ? `${target!.name} can sign in again.` : `${target!.name} can no longer sign in.`)}`);
}

export async function resetPassword(form: FormData) {
  const actor = await requireAdmin();
  const id = String(form.get("id"));
  const target = db().users.find((u) => u.id === id);
  if (!target) back(`err=${enc("User not found.")}`);
  const pw = tempPassword();
  mutate((d) => {
    d.users.find((x) => x.id === id)!.passwordHash = hashPassword(pw);
    audit(d, actor, "user.password_reset", "user", id, `${actor.name} reset the password of ${target!.name}`);
  });
  await revealOnce(id, pw, true);
  back(`created=${id}`);
}
