import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { saveUpload } from "@/lib/files";
import { db, mutate, nowIso } from "@/lib/store";

const MAX_BYTES = 60 * 1024 * 1024;

/** Candidate uploads one recorded answer for a one-way video interview. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user || user.role !== "candidate") return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const d = db();
  const iv = d.interviews.find((i) => i.id === id);
  const app = iv && d.applications.find((a) => a.id === iv.applicationId);
  const cand = app && d.candidates.find((c) => c.id === app.candidateId);
  if (!iv || !app || cand?.userId !== user.id || iv.mode !== "recorded_video") {
    return NextResponse.json({ error: "Interview not found." }, { status: 404 });
  }
  if (iv.status !== "scheduled") return NextResponse.json({ error: "This interview is closed." }, { status: 409 });
  if (new Date(iv.start).getTime() < Date.now()) return NextResponse.json({ error: "The deadline for this interview has passed." }, { status: 409 });
  const form = await req.formData();
  const questionId = String(form.get("questionId") ?? "");
  if (!iv.recordedQuestions?.some((q) => q.id === questionId)) return NextResponse.json({ error: "Unknown question." }, { status: 400 });
  const file = form.get("video");
  if (!file || typeof file === "string" || file.size === 0) return NextResponse.json({ error: "No video received." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Recording is too large." }, { status: 413 });
  if (!/^video\//.test(file.type)) return NextResponse.json({ error: "Only video recordings are accepted." }, { status: 415 });
  const prev = iv.recordings?.filter((r) => r.questionId === questionId).length ?? 0;
  if (prev >= 2) return NextResponse.json({ error: "You have already re-recorded this answer." }, { status: 409 });

  const record = await saveUpload(file, user.id, "private");
  if (!record) return NextResponse.json({ error: "Upload failed." }, { status: 400 });
  const result = mutate((dd) => {
    const live = dd.interviews.find((i) => i.id === id)!;
    // Earlier takes are kept (latest one is shown to reviewers); this also caps re-recording at one.
    live.recordings = live.recordings ?? [];
    live.recordings.push({ questionId, fileId: record.id, at: nowIso() });
    const done = live.recordedQuestions!.every((q) => live.recordings!.some((r) => r.questionId === q.id));
    audit(dd, user, "interview.recording", "interview", id, `Video answer uploaded for ${app.code}`);
    if (done) {
      live.status = "completed";
      for (const p of live.panel) notify(dd, { userId: p }, "Video interview ready to review", `${app.code} has answered all questions.`, `/hr/interviews/${id}`);
      audit(dd, user, "interview.complete", "interview", id, `${app.code} completed the recorded interview`);
    }
    return { done, answered: new Set(live.recordings.map((r) => r.questionId)).size, total: live.recordedQuestions!.length };
  });
  return NextResponse.json({ ok: true, ...result });
}
