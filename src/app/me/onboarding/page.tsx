import Link from "next/link";
import clsx from "clsx";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { Card, EmptyState, Flash, LinkButton, Progress } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { OWNER_LABEL, isOverdue, onboardingSummary } from "@/lib/onboarding/journey";
import { buildJourney, hireForUser } from "@/lib/orientation/journey";
import { masterName, userName } from "@/lib/lookup";
import { daysBetween, fmtDate, todayInput } from "@/lib/format";
import { IdCard } from "@/components/orientation/IdCard";
import { completeOwnTask, uploadDocument } from "./actions";

export const metadata = { title: "My onboarding" };

export default async function MyOnboarding({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(["candidate"]);
  const sp = await searchParams;
  const d = db();
  const hire = hireForUser(d, user.id);
  if (!hire) {
    return <EmptyState title="Onboarding starts after you accept an offer" body="Your personal checklist will appear here." action={<LinkButton href="/me" variant="secondary">My applications</LinkButton>} />;
  }
  const today = todayInput();
  const s = onboardingSummary(hire, today);
  const o = buildJourney(d, hire);
  const offer = d.offers.find((x) => x.id === hire.offerId);
  const manager = d.users.find((u) => u.id === hire.managerId);
  const daysToJoin = daysBetween(today, hire.joiningDate);
  const branch = masterName(d, offer?.branchId);
  const mine = hire.tasks.filter((t) => t.owner === "new_hire" && !t.done);

  return (
    <div className="space-y-6">
      <Flash msg={sp.msg} err={sp.err} />
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-side p-6 text-white shadow-sm">
        <p className="text-sm text-white/80">Welcome to {d.settings.shortName}, {hire.name.split(" ")[0]} 👋</p>
        <h1 className="mt-1 text-2xl font-semibold">
          {hire.status === "completed" ? "You have completed onboarding!" : daysToJoin > 0 ? `${daysToJoin} day${daysToJoin === 1 ? "" : "s"} until your first day` : "Your onboarding journey"}
        </h1>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
          <div><div className="text-white/70">Joining date</div><div className="font-medium">{fmtDate(hire.joiningDate)}</div></div>
          <div><div className="text-white/70">Role</div><div className="font-medium">{masterName(d, offer?.designationId)}</div></div>
          <div><div className="text-white/70">Line manager</div><div className="font-medium">{manager?.name ?? "To be confirmed"}</div></div>
          <div><div className="text-white/70">Onboarding buddy</div><div className="font-medium">{hire.buddyName ?? "To be confirmed"}</div></div>
        </div>
        <div className="mt-5 max-w-md">
          <div className="mb-1 flex justify-between text-xs text-white/80"><span>Journey progress</span><span>{s.done}/{s.total} tasks</span></div>
          <div className="h-2 rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${s.percent}%` }} /></div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {mine.length > 0 && (
            <Card title={`Your to-do (${mine.length})`}>
              <ul className="space-y-3">
                {mine.map((t) => (
                  <li key={t.id} className={clsx("rounded-xl border p-3", isOverdue(t, today) ? "border-bad/40 bg-bad-bg/40" : "border-line")}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{t.title}</div>
                        <div className={clsx("text-xs", isOverdue(t, today) ? "text-bad" : "text-muted")}>Due {fmtDate(t.dueDate)}{isOverdue(t, today) ? " · overdue" : ""}</div>
                      </div>
                      {t.documentTypeId ? (
                        <form action={uploadDocument} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="taskId" value={t.id} />
                          <input type="file" name="file" required accept="image/*,application/pdf" className="max-w-56 text-xs" aria-label={`Upload ${t.title}`} />
                          <SubmitButton size="sm">Upload</SubmitButton>
                        </form>
                      ) : /orientation/i.test(t.title) && !hire.employeeNo ? (
                        <LinkButton href="/me/orientation" size="sm">Go to orientation</LinkButton>
                      ) : /survey/i.test(t.title) ? (
                        <form action={completeOwnTask}>
                          <input type="hidden" name="taskId" value={t.id} />
                          <Link href="/me/feedback?touchpoint=onboarding" className="mr-2 text-xs text-brand underline">Open survey</Link>
                          <SubmitButton size="sm" variant="secondary">Mark done</SubmitButton>
                        </form>
                      ) : (
                        <form action={completeOwnTask}><input type="hidden" name="taskId" value={t.id} /><SubmitButton size="sm">Mark done</SubmitButton></form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Your journey">
            <ol className="relative space-y-6 border-l-2 border-line pl-6">
              {s.phases.map((p) => (
                <li key={p.key} className="relative">
                  <span
                    className={clsx(
                      "absolute -left-[33px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                      p.complete ? "bg-ok text-white" : p.key === s.current ? "bg-brand text-white ring-4 ring-brand-soft" : "border-2 border-line bg-surface",
                    )}
                  >
                    {p.complete ? "✓" : ""}
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold">{p.label}</h3>
                    <span className="text-xs text-muted">{p.done}/{p.total}</span>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {p.tasks.map((t) => (
                      <li key={t.id} className="flex items-start gap-2 text-sm">
                        <span className={clsx("mt-0.5", t.done ? "text-ok" : "text-muted")} aria-hidden>{t.done ? "✓" : "○"}</span>
                        <span className={clsx("flex-1", t.done && "text-muted")}>
                          {t.title}
                          <span className="ml-1 text-xs text-muted">· {t.owner === "new_hire" ? "you" : OWNER_LABEL[t.owner]}{!t.done && ` · ${fmtDate(t.dueDate)}`}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <aside className="space-y-4">
          {hire.employeeNo ? (
            <IdCard
              name={hire.name}
              employeeNo={hire.employeeNo}
              designation={masterName(d, offer?.designationId)}
              department={masterName(d, offer?.departmentId)}
              branch={branch}
              joiningDate={hire.joiningDate}
              company={d.settings.shortName}
            />
          ) : (
            <Card title="Orientation">
              <p className="text-sm text-muted">Complete your orientation modules to receive your employee ID.</p>
              <div className="my-3"><Progress value={o.percent} /></div>
              <LinkButton href="/me/orientation" size="sm">Open orientation ({o.requiredDone}/{o.requiredTotal})</LinkButton>
            </Card>
          )}
          <Card title="Your first day">
            <ul className="space-y-2 text-sm">
              <li>📍 <strong>Where:</strong> {branch}</li>
              <li>🕘 <strong>When:</strong> {fmtDate(hire.joiningDate)}, 9:00 am. Please arrive 15 minutes early.</li>
              <li>🪪 <strong>Bring:</strong> your original CNIC and educational certificates for verification.</li>
              <li>👔 <strong>Dress:</strong> business formal.</li>
              <li>🙋 <strong>Ask for:</strong> {manager?.name ?? "HR reception"}{manager?.title ? `, ${manager.title}` : ""}.</li>
            </ul>
          </Card>
          <Card title="Your people">
            <ul className="space-y-2 text-sm">
              <li><span className="text-muted">Manager:</span> {userName(d, hire.managerId, "To be confirmed")}</li>
              <li><span className="text-muted">Buddy:</span> {hire.buddyName ?? "To be confirmed"}</li>
              <li><span className="text-muted">HR contact:</span> {d.settings.supportEmail}</li>
            </ul>
          </Card>
          <Card title="How is it going?">
            <p className="text-sm text-muted">Tell us about your onboarding so far. It takes a minute and helps us improve for the next joiner.</p>
            <LinkButton href="/me/feedback?touchpoint=onboarding" variant="secondary" size="sm" className="mt-3">Share feedback</LinkButton>
          </Card>
        </aside>
      </div>
    </div>
  );
}
