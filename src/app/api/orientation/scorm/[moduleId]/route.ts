import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db, mutate } from "@/lib/store";
import { canTakeOrientation, hireForUser, scormCompleted } from "@/lib/orientation/journey";
import { completeOrientationIfDone, recordProgress } from "@/lib/orientation/complete";
import { audit } from "@/lib/audit";

// LMSCommit / LMSFinish from the SCORM player land here.
export async function POST(req: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { moduleId } = await params;
  const hire = hireForUser(db(), user.id);
  if (!canTakeOrientation(hire)) return NextResponse.json({ error: "No active orientation" }, { status: 403 });
  const mod = db().modules.find((m) => m.id === moduleId && m.kind === "scorm" && m.active);
  if (!mod) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { data?: Record<string, unknown> };
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.data ?? {})) {
    if (k.startsWith("cmi.") && k.length < 200) data[k] = String(v).slice(0, 4096);
  }

  const result = mutate((d) => {
    const h = d.hires.find((x) => x.id === hire.id)!;
    const merged = { ...(d.progress.find((p) => p.hireId === h.id && p.moduleId === moduleId)?.scormData ?? {}), ...data };
    const passed = scormCompleted(merged, d.settings.orientationPassMark);
    const raw = merged["cmi.core.score.raw"];
    const max = Number(merged["cmi.core.score.max"] || 100) || 100;
    const score = raw ? Math.round((Number(raw) / max) * 100) : undefined;
    const wasDone = d.progress.find((p) => p.hireId === h.id && p.moduleId === moduleId)?.status === "completed";
    const p = recordProgress(d, h, moduleId, { scormData: data, score, completed: passed });
    if (passed && !wasDone) audit(d, user, "orientation.module_complete", "orientation", moduleId, `${h.name} completed “${mod.title}” (SCORM${score !== undefined ? `, ${score}%` : ""})`);
    const employeeNo = completeOrientationIfDone(d, h, user);
    return { status: p.status, score: p.score, employeeNo };
  });
  return NextResponse.json(result);
}
