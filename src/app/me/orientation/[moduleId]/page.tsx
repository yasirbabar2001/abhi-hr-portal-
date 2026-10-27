import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { Card, EmptyState, LinkButton } from "@/components/ui";
import { buildJourney, canTakeOrientation, hireForUser } from "@/lib/orientation/journey";
import { youtubeEmbed } from "@/lib/orientation/text-formats";
import { SAMPLE_SCORM_ENTRY } from "@/lib/orientation/sample-scorm";
import { completeModule, submitQuiz } from "../actions";
import { ConfirmComplete, QuizPlayer, ScormPlayer, SlidePlayer, VideoPlayer } from "../players";

export const metadata = { title: "Orientation module" };

// Shown for the policy module when HR has not uploaded the PDF yet.
const CONDUCT_SUMMARY = [
  ["Act with integrity", "Be honest in every record, report and conversation. Never misuse your position for personal gain."],
  ["Treat customers fairly", "Explain products and charges clearly, respect privacy, and handle complaints promptly and politely."],
  ["Protect confidential information", "Customer and bank information is shared only with people who need it for their work."],
  ["Avoid conflicts of interest", "Declare outside jobs, gifts above the policy limit and any relationship that could affect your judgement."],
  ["Respect colleagues", "Harassment and discrimination of any kind are not tolerated. Everyone deserves a safe workplace."],
  ["Speak up", "Report wrongdoing through your manager, Compliance or the whistle-blowing channel. Retaliation is prohibited."],
];

export default async function ModulePage({ params }: { params: Promise<{ moduleId: string }> }) {
  const user = await requireUser(["candidate"]);
  const { moduleId } = await params;
  const d = db();
  const hire = hireForUser(d, user.id);
  if (!canTakeOrientation(hire)) redirect("/me/orientation");
  const j = buildJourney(d, hire);
  const idx = j.steps.findIndex((s) => s.module.id === moduleId);
  const step = j.steps[idx];
  if (!step) notFound();
  const m = step.module;
  if (!step.unlocked) {
    return <EmptyState title="This level is locked" body="Finish the earlier required modules to unlock it." action={<LinkButton href="/me/orientation">Back to journey</LinkButton>} />;
  }
  const done = step.progress?.status === "completed";
  const nextStep = j.steps[idx + 1];

  let body: React.ReactNode;
  if (m.kind === "presentation") {
    body = m.slides?.length ? (
      <SlidePlayer slides={m.slides} moduleId={m.id} action={completeModule} completed={done} />
    ) : m.fileId ? (
      <div className="space-y-4">
        <iframe src={`/api/files/${m.fileId}`} title={m.title} className="h-[70vh] w-full rounded-xl border border-line" />
        {!done && <ConfirmComplete moduleId={m.id} action={completeModule} statement="I have gone through the whole presentation." />}
      </div>
    ) : (
      <p className="text-sm text-muted">This presentation has no slides yet.</p>
    );
    if (m.slides?.length && m.fileId) {
      body = (
        <div className="space-y-4">
          {body}
          <a href={`/api/files/${m.fileId}`} target="_blank" className="text-sm text-brand underline">Download the full presentation (PDF)</a>
        </div>
      );
    }
  } else if (m.kind === "pdf") {
    body = (
      <div className="space-y-4">
        {m.fileId ? (
          <>
            <iframe src={`/api/files/${m.fileId}`} title={m.title} className="h-[70vh] w-full rounded-xl border border-line" />
            <a href={`/api/files/${m.fileId}`} target="_blank" className="text-sm text-brand underline">Open in a new tab</a>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">Summary of the key commitments in our staff code of conduct:</p>
            <ol className="grid gap-3 sm:grid-cols-2">
              {CONDUCT_SUMMARY.map(([t, b], i) => (
                <li key={t} className="rounded-xl border border-line bg-paper p-4">
                  <div className="text-xs font-semibold text-brand">{i + 1}</div>
                  <div className="font-semibold">{t}</div>
                  <p className="mt-1 text-sm text-muted">{b}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
        {!done && <ConfirmComplete moduleId={m.id} action={completeModule} statement="I have read and understood this document and agree to follow it." />}
      </div>
    );
  } else if (m.kind === "video") {
    const yt = youtubeEmbed(m.videoUrl);
    const src = m.fileId ? `/api/files/${m.fileId}` : m.videoUrl;
    body = yt ? (
      <div className="space-y-4">
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          <iframe src={yt} title={m.title} className="h-full w-full" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />
        </div>
        {!done && <ConfirmComplete moduleId={m.id} action={completeModule} statement="I have watched the whole video." />}
      </div>
    ) : src ? (
      <VideoPlayer src={src} moduleId={m.id} action={completeModule} completed={done} />
    ) : (
      <p className="text-sm text-muted">The video for this module has not been added yet.</p>
    );
  } else if (m.kind === "quiz" && m.quiz) {
    body = (
      <QuizPlayer
        moduleId={m.id}
        questions={m.quiz.questions.map(({ id, question, options }) => ({ id, question, options }))}
        passMark={m.quiz.passMark}
        action={submitQuiz}
        attempts={step.progress?.attempts ?? 0}
        bestScore={step.progress?.score}
      />
    );
  } else if (m.kind === "scorm") {
    const entry = m.scorm?.entry ?? SAMPLE_SCORM_ENTRY;
    body = (
      <ScormPlayer
        moduleId={m.id}
        src={`/api/scorm/${m.id}/${entry.split("/").map(encodeURIComponent).join("/")}`}
        initial={step.progress?.scormData ?? {}}
        studentId={hire.employeeNo ?? hire.id}
        studentName={hire.name}
        completed={done}
      />
    );
  } else {
    body = <p className="text-sm text-muted">This module is not set up yet.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/me/orientation" className="text-sm text-muted hover:text-brand">← Back to journey</Link>
      <div className="mb-4 mt-1 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Level {idx + 1} of {j.steps.length} · {m.durationMin} min · {m.points} points</div>
          <h1 className="text-2xl font-semibold">{m.title}</h1>
          {m.description && <p className="mt-1 text-sm text-muted">{m.description}</p>}
        </div>
        {done && <span className="rounded-full bg-ok-bg px-3 py-1 text-sm font-medium text-ok">✓ Completed</span>}
      </div>
      <Card>{body}</Card>
      {done && nextStep?.module && (
        <div className="mt-4 text-right">
          <LinkButton href={`/me/orientation/${nextStep.module.id}`}>Next: {nextStep.module.title} →</LinkButton>
        </div>
      )}
    </div>
  );
}
