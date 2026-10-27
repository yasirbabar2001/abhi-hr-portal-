import "server-only";
import type { Db, Role, User } from "./types";
import { nowIso, uid } from "./store";

type Actor = Pick<User, "id" | "name" | "role"> | { id: string; name: string; role: "system" | "public" };

/**
 * Record an audit entry inside a mutate() callback, so the change and its
 * audit record are written together. Never store passwords or secrets here.
 */
export function audit(
  d: Db,
  actor: Actor,
  action: string,
  entity: string,
  entityId: string,
  summary: string,
  extra?: { before?: unknown; after?: unknown; ip?: string },
) {
  d.audit.push({
    id: uid("au_"),
    at: nowIso(),
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role as Role | "system" | "public",
    action,
    entity,
    entityId,
    summary,
    before: scrub(extra?.before),
    after: scrub(extra?.after),
    ip: extra?.ip,
  });
}

const SECRET_KEYS = new Set(["passwordHash", "authValue", "outboundApiKey", "token"]);
function scrub(value: unknown): unknown {
  if (value === undefined || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(scrub);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEYS.has(k) ? "•••" : scrub(v)]),
  );
}

export const SYSTEM: Actor = { id: "system", name: "System", role: "system" };

/** Notify one user, or every active user holding one of the roles. */
export function notify(
  d: Db,
  target: { userId: string } | { roles: Role[] },
  title: string,
  body: string,
  href?: string,
) {
  const ids =
    "userId" in target
      ? [target.userId]
      : d.users.filter((u) => u.active && target.roles.includes(u.role)).map((u) => u.id);
  for (const userId of ids) {
    d.notifications.push({ id: uid("nt_"), userId, title, body, href, read: false, at: nowIso() });
  }
}
