import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterName } from "@/lib/lookup";
import { displayName, visibleApplications, visiblePostings } from "@/lib/hiring";
import { pkr, relative } from "@/lib/format";
import { Avatar, Badge, EmptyState, Flash, LinkButton, PageHeader, Tabs } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { ScoreBadge } from "@/components/hiring/StageControls";
import { managerReview } from "../applications/actions";

export const metadata = { title: "Shortlisting" };

export default async function ShortlistingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSection("/hr/shortlisting");
  const sp = await searchParams;
  const d = db();
  const shortlisted = visibleApplications(d, user).filter((a) => a.status === "active" && a.stage === "shortlisted");
  const postings = visiblePostings(d, user).filter((p) => shortlisted.some((a) => a.postingId === p.id));
  const postingId = sp.posting && postings.some((p) => p.id === sp.posting) ? sp.posting : postings[0]?.id;
  const posting = d.postings.find((p) => p.id === postingId);
  const rows = shortlisted.filter((a) => a.postingId === postingId).sort((a, b) => (b.screening?.score ?? 0) - (a.screening?.score ?? 0));
  const back = `/hr/shortlisting?posting=${postingId ?? ""}`;

  const attrs: [string, (a: (typeof rows)[number]) => React.ReactNode][] = [
    ["Match score", (a) => <ScoreBadge score={a.screening?.score} />],
    ["Experience", (a) => `${d.candidates.find((c) => c.id === a.candidateId)?.totalExperienceYears ?? 0} years`],
    ["Qualification", (a) => masterName(d, d.candidates.find((c) => c.id === a.candidateId)?.qualificationId)],
    ["Current role", (a) => d.candidates.find((c) => c.id === a.candidateId)?.currentTitle || "—"],
    ["City", (a) => d.candidates.find((c) => c.id === a.candidateId)?.city || "—"],
    [
      "Expected salary",
      (a) => (
        <span>
          {pkr(a.expectedSalary)}
          {posting?.salaryMin !== undefined && a.expectedSalary !== undefined && (
            <span className={`block text-xs ${a.expectedSalary > (posting.salaryMax ?? Infinity) ? "text-warn" : "text-ok"}`}>
              {a.expectedSalary > (posting.salaryMax ?? Infinity) ? "Above range" : a.expectedSalary < (posting.salaryMin ?? 0) ? "Below range" : "Within range"}
            </span>
          )}
        </span>
      ),
    ],
    ["Notice period", (a) => (a.noticePeriodDays !== undefined ? `${a.noticePeriodDays} days` : "—")],
    ["Matched keywords", (a) => <div className="flex flex-wrap gap-1">{a.screening?.matchedKeywords.map((k) => <Badge key={k} tone="brand">{k}</Badge>)}</div>],
    [
      "Manager review",
      (a) =>
        a.tags.includes("manager-approved") ? <Badge tone="ok">Approved for interview</Badge> : a.tags.includes("manager-declined") ? <Badge tone="bad">Not suitable</Badge> : <Badge tone="warn">Awaiting review</Badge>,
    ],
  ];

  return (
    <div>
      <PageHeader title="Shortlisting" subtitle="Compare shortlisted candidates side by side. Hiring managers approve who goes to interview." />
      <Flash msg={sp.msg} err={sp.err} />
      {postings.length === 0 ? (
        <EmptyState title="No shortlisted candidates yet" body="Shortlist candidates from CV screening and they will appear here for review." action={user.role !== "hiring" ? <LinkButton href="/hr/screening">Open CV screening</LinkButton> : undefined} />
      ) : (
        <>
          <Tabs
            active={postingId ?? ""}
            tabs={postings.map((p) => ({ key: p.id, href: `/hr/shortlisting?posting=${p.id}`, label: `${p.title} · ${p.city}`, count: shortlisted.filter((a) => a.postingId === p.id).length }))}
          />
          {posting && posting.salaryMin !== undefined && (
            <p className="mb-3 text-sm text-muted">Budgeted salary range: {pkr(posting.salaryMin)} – {pkr(posting.salaryMax)}</p>
          )}
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="table">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-[#fafbfc]">Compare</th>
                  {rows.map((a) => {
                    const c = d.candidates.find((x) => x.id === a.candidateId);
                    const name = displayName(d, c, a);
                    return (
                      <th key={a.id} className="min-w-52 normal-case tracking-normal">
                        <Link href={`/hr/applications/${a.id}`} className="flex items-center gap-2 text-sm font-semibold text-ink hover:text-brand">
                          <Avatar name={name} size={28} /> {name}
                        </Link>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {attrs.map(([label, render]) => (
                  <tr key={label}>
                    <td className="sticky left-0 bg-surface text-xs font-medium uppercase text-muted">{label}</td>
                    {rows.map((a) => <td key={a.id}>{render(a)}</td>)}
                  </tr>
                ))}
                <tr>
                  <td className="sticky left-0 bg-surface text-xs font-medium uppercase text-muted">Your review</td>
                  {rows.map((a) => (
                    <td key={a.id}>
                      <form action={managerReview} className="space-y-2">
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="back" value={back} />
                        <textarea name="comment" placeholder="Comment (optional)" className="input min-h-14 text-xs" />
                        <div className="flex flex-wrap gap-1">
                          <SubmitButton name="verdict" value="approve" size="sm">✓ Interview</SubmitButton>
                          <SubmitButton name="verdict" value="decline" size="sm" variant="secondary">Not suitable</SubmitButton>
                        </div>
                      </form>
                      {a.decisionNote && <p className="mt-2 text-xs text-muted">Last: {a.decisionNote} · {relative(a.updatedAt)}</p>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="sticky left-0 bg-surface" />
                  {rows.map((a) => (
                    <td key={a.id}>
                      <LinkButton href={`/hr/interviews/new?application=${a.id}`} size="sm" variant="secondary">📅 Schedule interview</LinkButton>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
