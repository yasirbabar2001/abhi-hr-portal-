import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DATA_DIR, db } from "./store";
import type { Role, User } from "./types";
import { INTERNAL_ROLES } from "./types";

const COOKIE = "abhi_session";
const SESSION_HOURS = 12;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

/** Password rule shown to users: 8+ characters with a letter and a number. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use at least one letter and one number.";
  return null;
}

function secret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(DATA_DIR, ".session-secret");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(file, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  return fs.readFileSync(file, "utf8").trim();
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

export async function startSession(userId: string) {
  const exp = Date.now() + SESSION_HOURS * 3600_000;
  const value = `${userId}.${exp}`;
  const jar = await cookies();
  jar.set(COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts as [string, string, string];
  const expected = sign(`${userId}.${exp}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now()) return null;
  const user = db().users.find((u) => u.id === userId);
  return user && user.active ? user : null;
}

/** Use at the top of a page or action. Redirects to login when not allowed. */
export async function requireUser(roles?: Role[]): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(user.role === "candidate" ? "/me" : "/hr?denied=1");
  return user;
}

export const requireInternal = () => requireUser(INTERNAL_ROLES);
export const requireHr = () => requireUser(["admin", "hr"]);
export const requireAdmin = () => requireUser(["admin"]);

export function isInternal(user: User | null | undefined) {
  return !!user && INTERNAL_ROLES.includes(user.role);
}

export async function clientIp(): Promise<string | undefined> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined;
}

/** Guard an internal page by the roles its sidebar entry allows (see lib/nav.ts). */
export async function requireSection(path: string): Promise<User> {
  const { rolesForPath } = await import("./nav");
  return requireUser(rolesForPath(path) ?? INTERNAL_ROLES);
}
