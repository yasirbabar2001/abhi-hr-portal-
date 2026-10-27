import { currentUser, isInternal } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db, mutate } from "@/lib/store";
import { filterEmployees, toCsv } from "@/lib/employees/query";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || !isInternal(user)) return new Response("Please sign in.", { status: 401 });
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const d = db();
  const rows = filterEmployees(d, params);
  mutate((x) => audit(x, user, "employee.export", "employee", "-", `Exported ${rows.length} employee record(s) to CSV`));
  const date = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(d, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="abhi-employees-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
