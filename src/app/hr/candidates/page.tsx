import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterList, masterName } from "@/lib/lookup";
import { STAGE_LABEL } from "@/lib/hiring";
import { fmtDate } from "@/lib/format";
import { Avatar, Badge, EmptyState, PageHeader, Stat } from "@/components/ui";
import { AutoSelect } from "@/components/forms";

export const metadata = { title: "Talent database" };

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/candidates");
  const sp = await searchParams;
  const d = db();
  const q = (sp.q ?? "").trim().toLowerCase();
  const minExp = Number(sp.exp ?? 0);
  let list = d.candidates.slice();
  if (q) {
    list = list.filter((c) =>
      [c.name, c.email, c.city, c.currentTitle, c.currentEmployer, c.skills.join(" "), c.cvText ?? ""].join(" ").toLowerCase().includes(q),
    );
  }
  if (sp.city) list = list.filter((c) => c.city === sp.city);
  if (sp.pool === "1") list = list.filter((c) => c.talentPool);
  if (sp.qual) list = list.filter((c) => c.qualificationId === sp.qual);
  if (minExp > 0) list = list.filter((c) => c.totalExperienceYears >= minExp);
  list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const cities = [...new Set(d.candidates.map((c) => c.city).filter(Boolean))].sort();
  const appsBy = (cid: string) => d.applications.filter((a) => a.candidateId === cid).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <PageHeader title="Talent database" subtitle="Everyone who has created a candidate account or applied. Search by skill, city or experience to rediscover past applicants." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Candidates" value={d.candidates.length} />
        <Stat label="In talent pool" value={d.candidates.filter((c) => c.talentPool).length} hint="Agreed to hear about future roles" tone="brand" />
        <Stat label="With an active application" value={new Set(d.applications.filter((a) => a.status === "active").map((a) => a.candidateId)).size} />
      </div>
      <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" action="/hr/candidates">
        <input name="q" defaultValue={sp.q} placeholder="Name, skill, employer…" className="input lg:col-span-2" aria-label="Search" />
        <AutoSelect name="city" defaultValue={sp.city ?? ""} aria-label="City">
          <option value="">Any city</option>
          {cities.map((c) => <option key={c}>{c}</option>)}
        </AutoSelect>
        <AutoSelect name="qual" defaultValue={sp.qual ?? ""} aria-label="Qualification">
          <option value="">Any qualification</option>
          {masterList(d, "qualification").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </AutoSelect>
        <div className="flex gap-2">
          <AutoSelect name="exp" defaultValue={sp.exp ?? ""} aria-label="Minimum experience">
            <option value="">Any experience</option>
            {[1, 2, 3, 5, 8].map((n) => <option key={n} value={n}>{n}+ years</option>)}
          </AutoSelect>
          <AutoSelect name="pool" defaultValue={sp.pool ?? ""} aria-label="Talent pool">
            <option value="">Everyone</option>
            <option value="1">Talent pool</option>
          </AutoSelect>
        </div>
      </form>
      {list.length === 0 ? (
        <EmptyState title="No candidates found" body="Try a broader search." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Current role</th>
                <th>Experience</th>
                <th>Qualification</th>
                <th>City</th>
                <th>Applications</th>
                <th>Latest</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const apps = appsBy(c.id);
                const latest = apps[0];
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={c.name} size={28} />
                        <div>
                          {latest ? <Link href={`/hr/applications/${latest.id}`} className="font-medium hover:text-brand">{c.name}</Link> : <span className="font-medium">{c.name}</span>}
                          <div className="text-xs text-muted">{c.email}</div>
                        </div>
                        {c.talentPool && <Badge tone="brand">Pool</Badge>}
                      </div>
                    </td>
                    <td>{c.currentTitle || "—"}<div className="text-xs text-muted">{c.currentEmployer}</div></td>
                    <td className="tabular-nums">{c.totalExperienceYears} yrs</td>
                    <td>{masterName(d, c.qualificationId)}</td>
                    <td>{c.city || "—"}</td>
                    <td className="tabular-nums">{apps.length}</td>
                    <td>
                      {latest ? (
                        <>
                          <Badge tone={latest.status === "rejected" ? "bad" : latest.status === "hired" ? "ok" : "info"}>
                            {latest.status === "active" ? STAGE_LABEL[latest.stage] : latest.status}
                          </Badge>
                          <div className="text-xs text-muted">{fmtDate(latest.createdAt)}</div>
                        </>
                      ) : (
                        <span className="text-xs text-muted">Registered {fmtDate(c.createdAt)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
