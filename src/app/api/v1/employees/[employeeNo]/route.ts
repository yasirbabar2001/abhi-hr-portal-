import { NextResponse } from "next/server";
import { db } from "@/lib/store";
import { checkApiKey, employeeJson } from "@/lib/integrations/outbound";

export async function GET(req: Request, { params }: { params: Promise<{ employeeNo: string }> }) {
  const denied = checkApiKey(req);
  if (denied) return denied;
  const { employeeNo } = await params;
  const d = db();
  const e = d.employees.find((x) => x.employeeNo === decodeURIComponent(employeeNo));
  if (!e) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ data: employeeJson(d, e) });
}
