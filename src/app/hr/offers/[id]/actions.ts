"use server";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { currentStep, decide, makeApprovals } from "@/lib/approvals";
import { gross, readAllowances } from "@/lib/offers/calc";
import { db, mutate, nowIso } from "@/lib/store";
import type { Db, Offer } from "@/lib/types";

const back = (id: string, q: string): never => redirect(`/hr/offers/${id}?${q}`);

async function load(form: FormData) {
  const user = await requireSection("/hr/offers");
  const id = String(form.get("offerId"));
  const offer = db().offers.find((o) => o.id === id);
  if (!offer) redirect("/hr/offers?err=Offer+not+found");
  return { user, id, offer };
}

function who(d: Db, o: Offer) {
  const app = d.applications.find((a) => a.id === o.applicationId);
  return d.candidates.find((c) => c.id === app?.candidateId);
}

export async function submitForApproval(form: FormData) {
  const { user, id, offer } = await load(form);
  if (offer.status !== "draft") back(id, "err=Only+drafts+can+be+submitted.");
  mutate((d) => {
    const o = d.offers.find((x) => x.id === id)!;
    o.status = "pending_approval";
    o.approvals = makeApprovals(d.settings.offerApprovalChain);
    o.updatedAt = nowIso();
    audit(d, user, "offer.submit", "offer", o.id, `Offer ${o.code} submitted for approval`);
    notify(d, { roles: ["admin", "hr"] }, "Offer needs approval", `${o.code} for ${who(d, o)?.name}`, `/hr/offers/${o.id}`);
  });
  back(id, "msg=Submitted+for+approval.");
}

export async function decideOffer(form: FormData) {
  const { user, id, offer } = await load(form);
  const decision = String(form.get("decision")) === "approved" ? "approved" : "rejected";
  const comment = String(form.get("comment") ?? "").trim();
  if (offer.status !== "pending_approval") back(id, "err=This+offer+is+not+awaiting+approval.");
  if (decision === "rejected" && !comment) back(id, "err=Please+give+a+reason+when+rejecting.");
  const step = currentStep(offer.approvals);
  mutate((d) => {
    const o = d.offers.find((x) => x.id === id)!;
    const outcome = decide(o.approvals, user, decision, comment);
    if (outcome === "approved") o.status = "approved";
    if (outcome === "rejected") o.status = "draft";
    o.updatedAt = nowIso();
    audit(d, user, `offer.${decision === "approved" ? "approve" : "reject"}`, "offer", o.id, `${step?.label}: ${decision} offer ${o.code}${comment ? ` — ${comment}` : ""}`);
    const owner = o.createdBy;
    if (outcome === "approved") notify(d, { userId: owner }, "Offer approved", `${o.code} is approved and ready to send.`, `/hr/offers/${o.id}`);
    if (outcome === "rejected") notify(d, { userId: owner }, "Offer returned", `${o.code} was returned: ${comment}`, `/hr/offers/${o.id}`);
  });
  back(id, `msg=${encodeURIComponent(decision === "approved" ? "Approval recorded." : "Offer returned to draft for revision.")}`);
}

export async function sendOffer(form: FormData) {
  const { user, id, offer } = await load(form);
  if (offer.status !== "approved") back(id, "err=The+offer+must+be+fully+approved+before+sending.");
  mutate((d) => {
    const o = d.offers.find((x) => x.id === id)!;
    o.status = "sent";
    if (new Date(o.expiresAt).getTime() < Date.now() + 86_400_000) {
      o.expiresAt = new Date(Date.now() + d.settings.offerValidityDays * 86_400_000).toISOString();
    }
    o.updatedAt = nowIso();
    const cand = who(d, o);
    audit(d, user, "offer.send", "offer", o.id, `Offer ${o.code} sent to ${cand?.name}`);
    if (cand) notify(d, { userId: cand.userId }, "🎉 You have an offer", "Congratulations! Please review and respond to your offer.", `/me/offers/${o.id}`);
  });
  back(id, "msg=Offer+sent+to+the+candidate.");
}

export async function closeOffer(form: FormData) {
  const { user, id, offer } = await load(form);
  const to = String(form.get("to")) === "expired" ? "expired" : "withdrawn";
  if (["accepted", "declined", "withdrawn", "expired"].includes(offer.status)) back(id, "err=This+offer+is+already+closed.");
  const reason = String(form.get("reason") ?? "").trim();
  mutate((d) => {
    const o = d.offers.find((x) => x.id === id)!;
    const before = o.status;
    o.status = to;
    o.updatedAt = nowIso();
    const cand = who(d, o);
    audit(d, user, `offer.${to === "expired" ? "expire" : "withdraw"}`, "offer", o.id, `Offer ${o.code} ${to}${reason ? `: ${reason}` : ""}`, { before: { status: before }, after: { status: to } });
    if (cand && before === "sent") notify(d, { userId: cand.userId }, `Offer ${to}`, `Your offer ${o.code} is no longer open.`, `/me/offers/${o.id}`);
  });
  back(id, `msg=Offer+${to}.`);
}

/** Revise salary/terms (e.g. after a counter-offer). Restarts the approval chain. */
export async function reviseOffer(form: FormData) {
  const { user, id, offer } = await load(form);
  if (["accepted", "declined", "withdrawn", "expired"].includes(offer.status)) back(id, "err=Closed+offers+cannot+be+revised.");
  const basic = Math.round(Number(form.get("basicSalary")));
  if (!(basic > 0)) back(id, "err=Enter+a+basic+salary.");
  const allowances = readAllowances(form);
  const joiningDate = String(form.get("joiningDate") || offer.joiningDate);
  const note = String(form.get("note") ?? "").trim();
  mutate((d) => {
    const o = d.offers.find((x) => x.id === id)!;
    const before = { basicSalary: o.basicSalary, allowances: o.allowances, grossMonthly: o.grossMonthly, joiningDate: o.joiningDate, status: o.status };
    o.basicSalary = basic;
    o.allowances = allowances;
    o.grossMonthly = gross(basic, allowances);
    o.joiningDate = joiningDate;
    o.status = "pending_approval";
    o.approvals = makeApprovals(d.settings.offerApprovalChain);
    if (o.counterOffer) o.counterOffer = { ...o.counterOffer, note: `${o.counterOffer.note} [revised ${nowIso().slice(0, 10)}]` };
    o.updatedAt = nowIso();
    audit(d, user, "offer.revise", "offer", o.id, `Offer ${o.code} revised to gross ${o.grossMonthly}${note ? ` — ${note}` : ""}`, { before, after: { basicSalary: o.basicSalary, allowances: o.allowances, grossMonthly: o.grossMonthly, joiningDate } });
    notify(d, { roles: ["admin", "hr"] }, "Revised offer needs approval", o.code, `/hr/offers/${o.id}`);
  });
  back(id, "msg=Offer+revised+and+sent+for+re-approval.");
}
