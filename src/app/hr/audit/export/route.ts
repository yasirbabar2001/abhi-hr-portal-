import { currentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db, mutate } from "@/lib/store";
import { toCsv } from "@/lib/analytics/metrics";
import { filterAudit } from "@/lib/admin/audit-filter";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || (user.role !== "admin" && user.role !== "hr")) return new Response("Forbidden", { status: 403 });
  const p = new URL(req.url).searchParams;
  const get = (k: string) => p.get(k) || undefined;
  const rows = filterAudit(db().audit, { actor: get("actor"), entity: get("entity"), action: get("action"), from: get("from"), to: get("to"), q: get("q") });
  mutate((d) => audit(d, user, "audit.export", "audit", "-", `${user.name} exported ${rows.length} audit entries`));
  const csv = toCsv([
    ["at", "actor", "role", "action", "entity", "entity_id", "summary", "ip", "before", "after"],
    ...rows.map((e) => [e.at, e.actorName, e.actorRole, e.action, e.entity, e.entityId, e.summary, e.ip ?? "", e.before ?? "", e.after ?? ""]),
  ]);
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="audit-trail.csv"` } });
}
