import { currentUser, isInternal } from "@/lib/auth";
import { canSeeApplication, MODE_LABEL } from "@/lib/hiring";
import { db } from "@/lib/store";

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Download an interview as an .ics calendar invite (works in Outlook, Google and Apple calendars). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const d = db();
  const iv = d.interviews.find((i) => i.id === id);
  if (!iv) return new Response("Not found", { status: 404 });
  const app = d.applications.find((a) => a.id === iv.applicationId);
  const cand = app && d.candidates.find((c) => c.id === app.candidateId);
  const allowed = isInternal(user) ? canSeeApplication(d, user, iv.applicationId) : cand?.userId === user.id;
  if (!allowed || !app) return new Response("Not found", { status: 404 });
  const posting = d.postings.find((p) => p.id === app.postingId);
  const origin = new URL(req.url).origin;
  const link = isInternal(user) ? `${origin}/hr/interviews/${iv.id}` : `${origin}/me/interviews/${iv.id}`;
  const end = new Date(new Date(iv.start).getTime() + iv.durationMin * 60_000).toISOString();
  const summary =
    iv.mode === "recorded_video"
      ? `Deadline: video interview – ${posting?.title ?? "ABHI"}`
      : isInternal(user)
        ? `Interview: ${cand?.name ?? "Candidate"} – ${posting?.title ?? ""}`
        : `ABHI interview – ${posting?.title ?? ""}`;
  const description = [`${MODE_LABEL[iv.mode]} interview (round ${iv.round}).`, iv.meetingUrl ? `Join: ${iv.meetingUrl}` : "", iv.instructions ?? "", `Details: ${link}`]
    .filter(Boolean)
    .join("\n");
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ABHI Microfinance Bank//HR Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${iv.id}@abhi-hr-portal`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(iv.start)}`,
    `DTEND:${stamp(iv.mode === "recorded_video" ? iv.start : end)}`,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(description)}`,
    `LOCATION:${esc(iv.location ?? iv.meetingUrl ?? "Online")}`,
    ...(iv.meetingUrl ? [`URL:${iv.meetingUrl}`] : []),
    `STATUS:${iv.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Interview reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="interview-${app.code}.ics"`,
    },
  });
}
