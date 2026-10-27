import type { Db, MasterType } from "./types";

// Small read helpers shared by pages. They take the db snapshot to stay pure.

export function masterName(d: Db, id: string | undefined, fallback = "—"): string {
  if (!id) return fallback;
  return d.master.find((m) => m.id === id)?.name ?? fallback;
}

export function masterList(d: Db, type: MasterType, includeInactive = false) {
  return d.master
    .filter((m) => m.type === type && (includeInactive || m.active))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function userName(d: Db, id: string | undefined, fallback = "—"): string {
  if (!id) return fallback;
  return d.users.find((u) => u.id === id)?.name ?? fallback;
}

export function candidateOf(d: Db, applicationId: string) {
  const app = d.applications.find((a) => a.id === applicationId);
  const cand = app ? d.candidates.find((c) => c.id === app.candidateId) : undefined;
  const posting = app ? d.postings.find((p) => p.id === app.postingId) : undefined;
  return { app, cand, posting };
}

export function qualificationRank(d: Db, id: string | undefined): number {
  if (!id) return 0;
  return Number(d.master.find((m) => m.id === id)?.meta?.rank ?? 0);
}
