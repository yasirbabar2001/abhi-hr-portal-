import Link from "next/link";
import clsx from "clsx";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { EmptyState, Flash, LinkButton } from "@/components/ui";
import { buildJourney, canTakeOrientation, hireForUser } from "@/lib/orientation/journey";
import { masterName } from "@/lib/lookup";
import { IdCard } from "@/components/orientation/IdCard";
import { Confetti } from "@/components/orientation/Confetti";
import { ProgressRing } from "@/components/orientation/ProgressRing";

export const metadata = { title: "Orientation" };

const KIND = { presentation: ["🎞️", "Presentation"], pdf: ["📄", "Read"], video: ["🎬", "Watch"], quiz: ["❓", "Quiz"], scorm: ["📦", "Course"] } as const;

export default async function MyOrientation({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(["candidate"]);
  const sp = await searchParams;
  const d = db();
  const hire = hireForUser(d, user.id);
  if (!canTakeOrientation(hire)) {
    const finished = d.hires.some((h) => h.userId === user.id && h.status === "completed");
    return (
      <EmptyState
        title="Orientation opens after you accept an offer"
        body={finished ? "You have completed your onboarding journey. Welcome to the team!" : "Once you accept an offer from ABHI, your orientation journey will appear here."}
        action={<LinkButton href="/me" variant="secondary">Back to my applications</LinkButton>}
      />
    );
  }
  const j = buildJourney(d, hire);
  const offer = d.offers.find((o) => o.id === hire.offerId);
  const justDone = sp.done ? d.modules.find((m) => m.id === sp.done) : undefined;
  const next = j.steps.find((s) => s.unlocked && s.progress?.status !== "completed");
  const celebrate = sp.celebrate === "1" || (!!justDone && j.allDone);

  return (
    <div className="space-y-8">
      {(celebrate || justDone) && <Confetti pieces={celebrate ? 90 : 40} />}
      <Flash err={sp.err} />
      {justDone && !celebrate && (
        <div className="rounded-xl border border-ok/30 bg-ok-bg px-4 py-3 text-sm text-ok" role="status">
          🎉 Nice work! “{justDone.title}” complete. <strong>+{justDone.points} points</strong>
        </div>
      )}

      <section className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-sm md:flex-row md:items-center">
        <ProgressRing value={j.percent}>
          <span className="text-2xl font-semibold">{j.percent}%</span>
          <span className="text-[11px] text-muted">complete</span>
        </ProgressRing>
        <div className="flex-1">
          <p className="text-sm text-muted">Welcome, {hire.name.split(" ")[0]}!</p>
          <h1 className="text-2xl font-semibold">Your orientation journey</h1>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-brand-soft px-3 py-1 font-medium text-brand-2">{j.rank.icon} {j.rank.name}</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">⭐ {j.points} / {j.maxPoints} points</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{j.requiredDone} of {j.requiredTotal} required modules</span>
          </div>
          <p className="mt-3 text-sm text-muted">
            {j.allDone
              ? "You have completed orientation. Your employee ID is ready below."
              : j.nextRank
                ? `Keep going to reach ${j.nextRank.icon} ${j.nextRank.name}. Complete every required module to receive your employee ID.`
                : "Complete every required module to receive your employee ID."}
          </p>
        </div>
        {next && (
          <LinkButton href={`/me/orientation/${next.module.id}`} className="self-start md:self-center">
            {next.progress ? "Continue" : "Start"}: {next.module.title} →
          </LinkButton>
        )}
      </section>

      {hire.employeeNo && (
        <section className="flex flex-col items-start gap-6 rounded-2xl border border-ok/30 bg-ok-bg/50 p-6 md:flex-row md:items-center">
          <IdCard
            name={hire.name}
            employeeNo={hire.employeeNo}
            designation={masterName(d, offer?.designationId)}
            department={masterName(d, offer?.departmentId)}
            branch={masterName(d, offer?.branchId)}
            joiningDate={hire.joiningDate}
            company={d.settings.shortName}
          />
          <div className="text-sm">
            <h2 className="text-lg font-semibold text-ink">🎉 Your employee ID: {hire.employeeNo}</h2>
            <p className="mt-1 text-muted">Generated automatically when you completed orientation. Use it for payroll, IT access and your staff card.</p>
            <Link href="/me/onboarding" className="mt-3 inline-block font-medium text-brand underline">Continue to your onboarding checklist →</Link>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold">Your path</h2>
        <ol className="relative mx-auto max-w-2xl">
          <span className="absolute left-1/2 top-6 bottom-6 w-1 -translate-x-1/2 rounded bg-line" aria-hidden />
          {j.steps.map((s, i) => {
            const done = s.progress?.status === "completed";
            const current = s === next;
            const left = i % 2 === 0;
            const [icon, verb] = KIND[s.module.kind];
            const card = (
              <div
                className={clsx(
                  "rounded-xl border bg-surface p-4 shadow-sm transition",
                  done && "border-ok/40",
                  current && "border-brand ring-4 ring-brand-soft",
                  !s.unlocked && "opacity-60",
                  s.unlocked && "hover:-translate-y-0.5 hover:shadow-md",
                )}
              >
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>Level {i + 1}</span>·<span>{verb}</span>·<span>{s.module.durationMin} min</span>
                  {!s.module.required && <span className="rounded bg-slate-100 px-1.5">Bonus</span>}
                </div>
                <div className="mt-1 font-semibold">{s.module.title}</div>
                <div className="mt-1 line-clamp-2 text-sm text-muted">{s.module.description}</div>
                <div className="mt-2 text-xs font-medium">
                  {done ? (
                    <span className="text-ok">✓ Completed · +{s.progress!.points} pts{s.progress?.score !== undefined ? ` · ${s.progress.score}%` : ""}</span>
                  ) : s.unlocked ? (
                    <span className="text-brand">{s.progress ? "In progress" : "Ready"} · {s.module.points} pts</span>
                  ) : (
                    <span className="text-muted">🔒 Complete the previous level to unlock</span>
                  )}
                </div>
              </div>
            );
            return (
              <li key={s.module.id} className="relative mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className={left ? "" : "invisible"}>{left && (s.unlocked ? <Link href={`/me/orientation/${s.module.id}`}>{card}</Link> : card)}</div>
                <span
                  className={clsx(
                    "relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-4 text-xl",
                    done ? "border-ok bg-ok text-white" : current ? "animate-pulse border-brand bg-surface" : s.unlocked ? "border-brand/40 bg-surface" : "border-line bg-paper",
                  )}
                  aria-hidden
                >
                  {done ? "✓" : s.unlocked ? icon : "🔒"}
                </span>
                <div className={left ? "invisible" : ""}>{!left && (s.unlocked ? <Link href={`/me/orientation/${s.module.id}`}>{card}</Link> : card)}</div>
              </li>
            );
          })}
          <li className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div />
            <span className={clsx("relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-4 text-2xl", j.allDone ? "border-amber-400 bg-amber-100" : "border-line bg-paper")} aria-hidden>🏁</span>
            <div className="text-sm font-medium">{j.allDone ? "Finished! Employee ID earned" : "Finish line: your employee ID"}</div>
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Badges</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {j.badges.map((b) => (
            <li key={b.key} className={clsx("rounded-xl border p-4 text-center", b.earned ? "border-amber-300 bg-amber-50" : "border-dashed border-line bg-surface opacity-60")}>
              <div className={clsx("text-3xl", !b.earned && "grayscale")} aria-hidden>{b.icon}</div>
              <div className="mt-1 text-sm font-semibold">{b.name}</div>
              <div className="text-xs text-muted">{b.earned ? b.description : `Locked: ${b.description.toLowerCase()}`}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
