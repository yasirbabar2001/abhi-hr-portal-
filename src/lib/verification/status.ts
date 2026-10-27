import type { Application, Db, EcibCheck, ReferenceCheck } from "../types";

export const OVERDUE_DAYS = 5;

export interface VerificationSummary {
  refs: ReferenceCheck[];
  refsVerified: number;
  refsReceived: number; // received or verified
  ecib?: EcibCheck;
  overdue: boolean;
  ready: boolean;
  blockers: string[];
}

export function isOverdue(requestedAt: string, done: boolean) {
  return !done && Date.now() - new Date(requestedAt).getTime() > OVERDUE_DAYS * 86_400_000;
}

/** Everything HR needs to know about one application's checks, and what blocks moving to offer. */
export function summarize(d: Db, app: Application): VerificationSummary {
  const refs = d.references.filter((r) => r.applicationId === app.id);
  const ecibs = d.ecib.filter((e) => e.applicationId === app.id);
  const ecib = ecibs[ecibs.length - 1];
  const refsVerified = refs.filter((r) => r.status === "verified").length;
  const refsReceived = refs.filter((r) => r.status === "received" || r.status === "verified").length;
  const blockers: string[] = [];
  if (refs.length === 0) blockers.push("Add at least one reference.");
  else if (refs.some((r) => r.status !== "verified")) blockers.push("Every reference must be verified.");
  if (!ecib) blockers.push("Start an eCIB check.");
  else if (ecib.status === "exception" && !ecib.remarks?.trim()) blockers.push("Add a remark approving the eCIB exception.");
  else if (ecib.status !== "clear" && ecib.status !== "exception") blockers.push(`eCIB is ${ecib.status.replace(/_/g, " ")}.`);
  const overdue =
    refs.some((r) => isOverdue(r.requestedAt, r.status === "verified" || r.status === "failed" || r.status === "received")) ||
    (!!ecib && isOverdue(ecib.requestedAt, ["clear", "adverse", "exception"].includes(ecib.status)));
  return { refs, refsVerified, refsReceived, ecib, overdue, ready: blockers.length === 0, blockers };
}
