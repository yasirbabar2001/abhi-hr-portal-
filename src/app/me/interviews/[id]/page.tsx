import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName } from "@/lib/lookup";
import { MODE_LABEL, nowMs } from "@/lib/hiring";
import { fmtDateTime, fmtTime, relative } from "@/lib/format";
import { Badge, Card, Flash, KeyValue, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { VideoRecorder } from "@/components/hiring/VideoRecorder";
import { confirmAttendance, requestReschedule } from "./actions";

export const metadata = { title: "My interview" };

export default async function MyInterviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser(["candidate"]);
  const { id } = await params;
  const sp = await searchParams;
  const d = db();
  const iv = d.interviews.find((i) => i.id === id);
  const app = iv && d.applications.find((a) => a.id === iv.applicationId);
  const cand = app && d.candidates.find((c) => c.id === app.candidateId);
  if (!iv || !app || cand?.userId !== user.id) notFound();
  const posting = d.postings.find((p) => p.id === app.postingId);
  const end = new Date(new Date(iv.start).getTime() + iv.durationMin * 60_000).toISOString();
  const startsIn = new Date(iv.start).getTime() - nowMs();
  const joinable = iv.mode === "live_video" && iv.status === "scheduled" && startsIn < 15 * 60_000 && nowMs() < new Date(end).getTime() + 30 * 60_000;
  const isJitsi = iv.meetingUrl?.startsWith("https://meet.jit.si/");
  const overdue = iv.mode === "recorded_video" && iv.status === "scheduled" && startsIn < 0;
  const answered = [...new Set((iv.recordings ?? []).map((r) => r.questionId))];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={{ href: `/me/applications/${app.id}`, label: "My application" }}
        title={iv.mode === "recorded_video" ? "Video interview" : "Your interview"}
        subtitle={`${posting?.title ?? ""} · ${posting?.city ?? ""}`}
        actions={iv.mode !== "recorded_video" && iv.status === "scheduled" && <LinkButton href={`/api/interviews/${iv.id}/ics`} variant="secondary">📆 Add to my calendar</LinkButton>}
      />
      <Flash msg={sp.msg} err={sp.err} />

      <div className="space-y-6">
        <Card title="Details" actions={<StatusBadge status={iv.status} />}>
          <KeyValue
            items={[
              ["Format", MODE_LABEL[iv.mode]],
              iv.mode === "recorded_video"
                ? ["Complete before", `${fmtDateTime(iv.start)} (${relative(iv.start)})`]
                : ["When", `${fmtDateTime(iv.start)} – ${fmtTime(end)} Pakistan time (${relative(iv.start)})`],
              ...(iv.location ? [["Where", iv.location] as [string, string]] : []),
              ...(iv.mode === "in_person" ? [["Branch", masterName(d, posting?.branchId)] as [string, string]] : []),
              ["Duration", iv.mode === "recorded_video" ? `${iv.recordedQuestions?.length ?? 0} questions` : `${iv.durationMin} minutes`],
              ...(iv.mode !== "recorded_video" ? [["Attendance", iv.candidateConfirmed ? <Badge key="a" tone="ok">Confirmed</Badge> : <Badge key="a" tone="warn">Please confirm</Badge>] as [string, React.ReactNode]] : []),
            ]}
          />
          {iv.instructions && <p className="mt-4 rounded-lg bg-info-bg p-3 text-sm text-info">📌 {iv.instructions}</p>}
          {iv.mode === "in_person" && (
            <p className="mt-4 text-sm text-muted">Please arrive 10 minutes early and bring your original CNIC and educational documents.</p>
          )}
          {iv.mode === "live_video" && (
            <p className="mt-4 text-sm text-muted">Join from a laptop or phone with a camera. The join button becomes active 15 minutes before the start. No software to install.</p>
          )}
        </Card>

        {iv.status === "scheduled" && iv.mode !== "recorded_video" && (
          <div className="grid gap-4 md:grid-cols-2">
            {!iv.candidateConfirmed && (
              <Card title="Will you attend?">
                <form action={confirmAttendance}>
                  <input type="hidden" name="id" value={iv.id} />
                  <SubmitButton>✓ Yes, I&apos;ll be there</SubmitButton>
                </form>
              </Card>
            )}
            <Card title="Need a different time?">
              <details>
                <summary className="cursor-pointer text-sm text-brand">Request a new time</summary>
                <form action={requestReschedule} className="mt-3 space-y-3">
                  <input type="hidden" name="id" value={iv.id} />
                  <label className="block"><span className="label">Reason</span><input name="reason" required className="input" /></label>
                  <label className="block"><span className="label">Times that suit you (optional)</span><input name="times" className="input" placeholder="e.g. Tue or Wed after 2pm" /></label>
                  <SubmitButton variant="secondary" size="sm">Send request</SubmitButton>
                </form>
              </details>
            </Card>
          </div>
        )}

        {iv.mode === "live_video" && iv.meetingUrl && iv.status === "scheduled" && (
          <Card title="Join the interview">
            {joinable ? (
              <div className="space-y-3">
                <a href={iv.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
                  🎥 Join live interview
                </a>
                {isJitsi && (
                  <iframe
                    src={iv.meetingUrl}
                    allow="camera; microphone; fullscreen; display-capture; autoplay"
                    className="aspect-video w-full rounded-lg border border-line"
                    title="Interview video room"
                  />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">The join button appears here 15 minutes before your interview starts.</p>
            )}
          </Card>
        )}

        {iv.mode === "recorded_video" && (
          <Card title="Record your answers">
            {iv.status === "cancelled" ? (
              <p className="text-sm text-muted">This video interview has been cancelled.</p>
            ) : overdue ? (
              <p className="text-sm text-bad">The deadline has passed. Please contact {d.settings.supportEmail} if you need more time.</p>
            ) : (
              <VideoRecorder
                interviewId={iv.id}
                applicationId={app.id}
                questions={iv.recordedQuestions ?? []}
                answered={iv.status === "completed" ? (iv.recordedQuestions ?? []).map((q) => q.id) : answered}
                deadline={iv.start}
              />
            )}
          </Card>
        )}

        {iv.status === "completed" && iv.mode !== "recorded_video" && (
          <Card title="Thank you">
            <p className="text-sm">Thanks for your time. We will update your application as soon as the panel has finished its review.</p>
            <Link href={`/me/feedback?touchpoint=interview&application=${app.id}`} className="mt-3 inline-block text-sm font-medium text-brand">Share quick feedback on your interview →</Link>
          </Card>
        )}
      </div>
    </div>
  );
}
