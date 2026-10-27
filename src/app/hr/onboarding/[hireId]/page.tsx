import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import clsx from "clsx";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { Avatar, Badge, Card, Flash, KeyValue, PageHeader, Progress, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { OWNER_LABEL, isOverdue, onboardingSummary } from "@/lib/onboarding/journey";
import { buildJourney } from "@/lib/orientation/journey";
import { masterList, masterName, userName } from "@/lib/lookup";
import { fmtDate, fmtDateTime, todayInput } from "@/lib/format";
import { ONBOARDING_PHASES } from "@/lib/types";
import { addTask, assignPeople, completeJourney, reopenJourney, toggleTask, updateDue } from "../actions";

export const metadata = { title: "Onboarding journey" };

export default async function JourneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ hireId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireSection("/hr/onboarding");
  const { hireId } = await params;
  const sp = await searchParams;
  const d = db();
  const hire = d.hires.find((h) => h.id === hireId);
  if (!hire) notFound();
  if (user.role === "hiring" && hire.managerId !== user.id) redirect("/hr/onboarding?err=This+journey+belongs+to+another+team.");
  const isHr = user.role !== "hiring";
  const today = todayInput();
  const s = onboardingSummary(hire, today);
  const o = buildJourney(d, hire);
  const offer = d.offers.find((x) => x.id === hire.offerId);
  const cand = d.candidates.find((c) => c.id === hire.candidateId);
  const managers = d.users.filter((u) => u.active && (u.role === "hiring" || u.role === "hr" || u.role === "admin"));
  const docTypes = masterList(d, "document_type");

  return (
    <div>
      <PageHeader
        title={hire.name}
        subtitle={`${masterName(d, offer?.designationId)} · ${masterName(d, offer?.departmentId)} · ${masterName(d, offer?.branchId)}`}
        back={{ href: "/hr/onboarding", label: "Onboarding journeys" }}
        actions={
          isHr &&
          (hire.status === "completed" ? (
            <form action={reopenJourney}><input type="hidden" name="hireId" value={hire.id} /><SubmitButton variant="secondary">Reopen journey</SubmitButton></form>
          ) : (
            <form action={completeJourney}>
              <input type="hidden" name="hireId" value={hire.id} />
              <SubmitButton confirm={s.done < s.total ? `${s.total - s.done} tasks are still open. Close the journey anyway?` : undefined}>Mark journey complete</SubmitButton>
            </form>
          ))
        }
      />
      <Flash msg={sp.msg} err={sp.err} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-6">
              <div className="min-w-48 flex-1">
                <div className="mb-1 flex justify-between text-sm"><span>Checklist</span><span className="text-muted">{s.done}/{s.total} · {s.percent}%</span></div>
                <Progress value={s.percent} tone={s.percent === 100 ? "ok" : "brand"} />
              </div>
              <div className="min-w-48 flex-1">
                <div className="mb-1 flex justify-between text-sm"><span>Orientation</span><span className="text-muted">{o.requiredDone}/{o.requiredTotal} · {o.points} pts</span></div>
                <Progress value={o.requiredTotal ? (o.requiredDone / o.requiredTotal) * 100 : 0} tone={o.allDone ? "ok" : "brand"} />
              </div>
              {s.overdue.length > 0 && <Badge tone="bad">{s.overdue.length} overdue</Badge>}
            </div>
          </Card>

          {s.phases.map((p) => (
            <Card
              key={p.key}
              title={
                <span className="flex items-center gap-2">
                  <span className={clsx("h-2.5 w-2.5 rounded-full", p.complete ? "bg-ok" : p.key === s.current ? "bg-brand" : "bg-line")} />
                  {p.label}
                  <span className="text-xs font-normal text-muted">{p.done}/{p.total}</span>
                </span>
              }
              pad={false}
            >
              {p.tasks.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">No tasks in this phase.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {p.tasks.map((t) => {
                    const overdue = isOverdue(t, today);
                    const editable = isHr || t.owner === "manager";
                    const file = t.fileId ? d.files.find((f) => f.id === t.fileId) : undefined;
                    return (
                      <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                        <form action={toggleTask}>
                          <input type="hidden" name="hireId" value={hire.id} />
                          <input type="hidden" name="taskId" value={t.id} />
                          <button
                            disabled={!editable}
                            aria-label={t.done ? `Reopen ${t.title}` : `Mark ${t.title} done`}
                            className={clsx(
                              "flex h-6 w-6 items-center justify-center rounded-md border text-xs",
                              t.done ? "border-ok bg-ok text-white" : "border-line bg-surface hover:border-brand",
                              !editable && "cursor-not-allowed opacity-50",
                            )}
                          >
                            {t.done ? "✓" : ""}
                          </button>
                        </form>
                        <div className="min-w-0 flex-1">
                          <div className={clsx("text-sm", t.done && "text-muted line-through")}>{t.title}</div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted">
                            <span>{OWNER_LABEL[t.owner]}</span>
                            {t.done ? <span>Done {fmtDateTime(t.doneAt)} by {userName(d, t.doneBy, hire.name)}</span> : <span className={overdue ? "font-medium text-bad" : ""}>Due {fmtDate(t.dueDate)}{overdue ? " · overdue" : ""}</span>}
                            {t.documentTypeId && <span>📎 {masterName(d, t.documentTypeId)}</span>}
                            {file && <a href={`/api/files/${file.id}`} target="_blank" className="text-brand underline">View {file.name}</a>}
                          </div>
                        </div>
                        {!t.done && editable && (
                          <form action={updateDue} className="flex items-center gap-1">
                            <input type="hidden" name="hireId" value={hire.id} />
                            <input type="hidden" name="taskId" value={t.id} />
                            <input type="date" name="dueDate" defaultValue={t.dueDate} className="input w-36 py-1 text-xs" aria-label="Due date" />
                            <SubmitButton variant="ghost" size="sm">Save</SubmitButton>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          ))}

          <Card title="Add a task">
            <form action={addTask} className="grid gap-3 sm:grid-cols-6">
              <input type="hidden" name="hireId" value={hire.id} />
              <label className="sm:col-span-6"><span className="label">Task</span><input name="title" required className="input" placeholder="e.g. Shadow a senior Relationship Officer for two days" /></label>
              <label className="sm:col-span-2">
                <span className="label">Phase</span>
                <select name="phase" className="input" defaultValue={s.current ?? "first_week"}>{ONBOARDING_PHASES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select>
              </label>
              <label className="sm:col-span-2">
                <span className="label">Owner</span>
                <select name="owner" className="input" defaultValue={isHr ? "hr" : "manager"}>
                  {Object.entries(OWNER_LABEL).filter(([k]) => isHr || k === "manager").map(([k, v]) => <option key={k} value={k}>{k === "new_hire" ? "New hire" : v}</option>)}
                </select>
              </label>
              <label className="sm:col-span-2"><span className="label">Due</span><input type="date" name="dueDate" required defaultValue={todayInput(3)} className="input" /></label>
              {isHr && (
                <label className="sm:col-span-4">
                  <span className="label">Document to collect (new-hire tasks only)</span>
                  <select name="documentTypeId" className="input" defaultValue=""><option value="">None</option>{docTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                </label>
              )}
              <div className="flex items-end sm:col-span-2"><SubmitButton>Add task</SubmitButton></div>
            </form>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card title="New joiner">
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={hire.name} size={44} />
              <div>
                <div className="font-semibold">{hire.name}</div>
                <StatusBadge status={hire.status} />
              </div>
            </div>
            <KeyValue
              items={[
                ["Employee ID", hire.employeeNo ? <code key="e" className="font-semibold text-brand-2">{hire.employeeNo}</code> : "After orientation"],
                ["Joining date", fmtDate(hire.joiningDate)],
                ["Email", <span key="m" className="break-all">{cand?.email ?? "—"}</span>],
                ["Mobile", cand?.phone],
                ["Orientation done", fmtDateTime(hire.orientationCompletedAt)],
                ["Rank", `${o.rank.icon} ${o.rank.name}`],
              ]}
            />
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {hire.employeeRecordId && <Link href={`/hr/employees/${hire.employeeRecordId}`} className="text-brand underline">Employee record</Link>}
              {offer && isHr && <Link href={`/hr/offers/${offer.id}`} className="text-brand underline">Offer {offer.code}</Link>}
              {isHr && <Link href="/hr/orientation?tab=progress" className="text-brand underline">Orientation progress</Link>}
            </div>
            {hire.badges.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">{hire.badges.map((b) => <Badge key={b} tone="warn">🎖 {b}</Badge>)}</div>
            )}
          </Card>
          <Card title="Manager & buddy">
            {isHr ? (
              <form action={assignPeople} className="space-y-3">
                <input type="hidden" name="hireId" value={hire.id} />
                <label className="block">
                  <span className="label">Line manager</span>
                  <select name="managerId" className="input" defaultValue={hire.managerId ?? ""}>
                    <option value="">Not assigned</option>
                    {managers.map((u) => <option key={u.id} value={u.id}>{u.name}{u.title ? ` — ${u.title}` : ""}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Onboarding buddy</span>
                  <input name="buddyName" className="input" defaultValue={hire.buddyName} list="buddy-list" placeholder="A colleague in the same team" />
                  <datalist id="buddy-list">{d.employees.filter((e) => e.active && e.departmentId === offer?.departmentId).slice(0, 40).map((e) => <option key={e.id} value={e.name} />)}</datalist>
                </label>
                <SubmitButton variant="secondary">Save</SubmitButton>
              </form>
            ) : (
              <KeyValue items={[["Line manager", userName(d, hire.managerId)], ["Buddy", hire.buddyName]]} />
            )}
          </Card>
          <Card title="Documents received">
            {hire.tasks.filter((t) => t.fileId).length === 0 ? (
              <p className="text-sm text-muted">No documents uploaded yet.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {hire.tasks.filter((t) => t.fileId).map((t) => (
                  <li key={t.id}><a href={`/api/files/${t.fileId}`} target="_blank" className="text-brand underline">{masterName(d, t.documentTypeId, t.title)}</a></li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
