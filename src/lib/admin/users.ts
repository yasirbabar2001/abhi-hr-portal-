import crypto from "node:crypto";
import type { Db, Role, User } from "../types";

/** Readable temporary password: 3 word-ish chunks + digits, satisfies the password rule. */
export function tempPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const pick = (n: number) => Array.from(crypto.randomBytes(n), (b) => alphabet[b % alphabet.length]).join("");
  return `${pick(4)}-${pick(4)}-${crypto.randomInt(10, 99)}`;
}

export function activeAdmins(d: Db, exceptId?: string) {
  return d.users.filter((u) => u.role === "admin" && u.active && u.id !== exceptId).length;
}

/** Why a role/active change would be unsafe, or null when it is fine. */
export function roleChangeProblem(d: Db, actor: User, target: User, next: { role?: Role; active?: boolean }): string | null {
  const losingAdmin = target.role === "admin" && ((next.role && next.role !== "admin") || next.active === false);
  if (target.id === actor.id && losingAdmin) return "You cannot remove your own administrator access. Ask another administrator.";
  if (losingAdmin && activeAdmins(d, target.id) === 0) return "At least one active administrator is required.";
  if (next.role && (next.role === "candidate") !== (target.role === "candidate"))
    return "Candidate accounts and staff accounts cannot be converted into each other.";
  return null;
}

/** A user snapshot safe to store in the audit trail. */
export function userSnapshot(u: User) {
  return { name: u.name, email: u.email, role: u.role, active: u.active, title: u.title, departmentId: u.departmentId };
}
