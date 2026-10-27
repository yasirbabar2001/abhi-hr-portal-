import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName, userName } from "@/lib/lookup";
import { displayName, isoToKarachiLocal, MODE_LABEL, requisitionOf, visibleApplications, STAGE_LABEL, nowMs } from "@/lib/hiring";
import { fmtDateTime, fmtTime } from "@/lib/format";
import { Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import { InterviewForm } from "@/components/hiring/InterviewForm";
import { createInterview } from "../actions";

export const metadata = { title: "Schedule interview" };

export default async function NewInterviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSection("/hr/interviews");
  const sp = await searchParams;
  const d = db();
  const apps = visibleApplications(d, user).filter((a) => a.status === "active" && ["shortlisted", "interview", "screening", "verification"].includes(a.stage));

  if (!sp.application) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Schedule an interview" back={{ href: "/hr/interviews", label: "Interviews" }} subtitle="Choose the candidate first." />
        {apps.length === 0 ? (
          <EmptyState title="No candidates ready for interview" body="Shortlist candidates first." />
        ) : (
          <Card pad={false}>
            <ul className="divide-y divide-line">
              {apps.map((a) => {
                const c = d.candidates.find((x) => x.id === a.candidateId);
                const p = d.postings.find((x) => x.id === a.postingId);
                return (
                  <li key={a.id}>
                    <Link href={`/hr/interviews/new?application=${a.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-paper">
                      <span>
                        <span className="font-medium">{displayName(d, c, a, false)}</span>
                        <span className="block text-xs text-muted">{p?.title} · {p?.city}</span>
                      </span>
                      <span className="text-xs text-muted">{STAGE_LABEL[a.stage]} →</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  const app = d.applications.find((a) => a.id === sp.application);
  if (!app || !visibleApplications(d, user).some((a) => a.id === app.id)) redirect("/hr/interviews?err=Application+not+found.");
  const cand = d.candidates.find((c) => c.id === app.candidateId);
  const posting = d.postings.find((p) => p.id === app.postingId);
  const req = requisitionOf(d, app);
  const staff = d.users.filter((u) => u.active && u.role !== "candidate").map((u) => ({ id: u.id, name: u.name, title: u.title }));
  const defaultPanel = [...new Set([req?.hiringManagerId, user.id].filter(Boolean) as string[])];
  const busy = d.interviews
    .filter((i) => i.status === "scheduled" && i.mode !== "recorded_video" && new Date(i.start).getTime() > nowMs() - 86_400_000)
    .flatMap((i) => i.panel.map((p) => ({ userId: p, start: i.start, durationMin: i.durationMin, label: `${userName(d, p)} is busy ${fmtDateTime(i.start)}–${fmtTime(new Date(new Date(i.start).getTime() + i.durationMin * 60_000).toISOString())}` })));
  const tomorrow = new Date(nowMs() + 86_400_000);
  tomorrow.setUTCHours(6, 0, 0, 0); // 11:00 Karachi
  const previous = d.interviews.filter((i) => i.applicationId === app.id);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Schedule an interview"
        back={{ href: `/hr/applications/${app.id}`, label: "Back to application" }}
        subtitle={`${displayName(d, cand, app, false)} · ${posting?.title} · ${posting?.city}`}
      />
      <Flash err={sp.err} />
      {previous.length > 0 && (
        <p className="mb-4 rounded-lg bg-info-bg px-3 py-2 text-sm text-info">
          Previous rounds: {previous.map((i) => `${MODE_LABEL[i.mode]} on ${fmtDateTime(i.start)} (${i.status})`).join("; ")}
        </p>
      )}
      <Card>
        <InterviewForm
          action={createInterview}
          applicationId={app.id}
          users={staff}
          defaultPanel={defaultPanel}
          busy={busy}
          defaultMinutes={d.settings.interviewDefaultMinutes}
          defaultStart={isoToKarachiLocal(tomorrow.toISOString())}
          defaultLocation={`${masterName(d, posting?.branchId, "Head Office")}, `}
          serverClash={!!sp.err?.includes("clash")}
        />
      </Card>
    </div>
  );
}
