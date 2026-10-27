import fs from "node:fs";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { contentType, scormFile } from "@/lib/orientation/scorm-package";
import { SAMPLE_SCORM_FILES } from "@/lib/orientation/sample-scorm";

// Serves SCORM package files to the player iframe. Sign-in required.
export async function GET(_req: Request, { params }: { params: Promise<{ moduleId: string; path: string[] }> }) {
  const user = await currentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const { moduleId, path: parts } = await params;
  const mod = db().modules.find((m) => m.id === moduleId && m.kind === "scorm");
  if (!mod) return new Response("Not found", { status: 404 });
  const rel = parts.map(decodeURIComponent).join("/");
  const headers = { "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" };

  if (!mod.scorm) {
    const body = SAMPLE_SCORM_FILES[rel];
    if (body === undefined) return new Response("Not found", { status: 404 });
    return new Response(body, { headers: { ...headers, "Content-Type": contentType(rel) } });
  }
  const file = scormFile(mod.scorm.packageId, rel);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(file), { headers: { ...headers, "Content-Type": contentType(file) } });
}
