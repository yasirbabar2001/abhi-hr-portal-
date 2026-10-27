import { currentUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { toCsv } from "@/lib/analytics/metrics";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || (user.role !== "admin" && user.role !== "hr")) return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const days = Number(url.searchParams.get("period") ?? "365") || 365;
  const tp = url.searchParams.get("touchpoint");
  const since = Date.now() - days * 86_400_000;
  const d = db();
  const rows = d.surveys
    .filter((s) => new Date(s.at).getTime() >= since && (!tp || s.touchpoint === tp))
    .map((s) => [s.at, s.touchpoint, d.applications.find((a) => a.id === s.applicationId)?.code ?? "", s.nps, s.csat, s.ease, s.comments ?? ""]);
  const csv = toCsv([["date", "touchpoint", "application", "nps", "csat", "ease", "comments"], ...rows]);
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="experience-surveys.csv"` },
  });
}
