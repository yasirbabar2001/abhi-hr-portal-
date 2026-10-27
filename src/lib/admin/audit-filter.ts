import type { AuditEntry } from "../types";

export interface AuditFilter {
  actor?: string;
  entity?: string;
  action?: string;
  from?: string; // yyyy-mm-dd
  to?: string;
  q?: string;
}

export function filterAudit(entries: AuditEntry[], f: AuditFilter): AuditEntry[] {
  const q = f.q?.trim().toLowerCase();
  const from = f.from ? new Date(`${f.from}T00:00:00+05:00`).getTime() : undefined;
  const to = f.to ? new Date(`${f.to}T23:59:59+05:00`).getTime() : undefined;
  return entries
    .filter((e) => {
      if (f.actor && e.actorId !== f.actor) return false;
      if (f.entity && e.entity !== f.entity) return false;
      if (f.action && !e.action.startsWith(f.action)) return false;
      const t = new Date(e.at).getTime();
      if (from !== undefined && t < from) return false;
      if (to !== undefined && t > to) return false;
      if (q && !`${e.summary} ${e.actorName} ${e.action} ${e.entityId}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Field-level differences between two snapshots (top-level keys only). */
export function diffKeys(before: unknown, after: unknown): { key: string; before: unknown; after: unknown }[] {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys.filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k])).map((k) => ({ key: k, before: b[k], after: a[k] }));
}
