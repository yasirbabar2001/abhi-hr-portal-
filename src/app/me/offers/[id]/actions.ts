"use server";
import { redirect } from "next/navigation";
import { clientIp, requireUser } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { offerIsExpired } from "@/lib/offers/OfferLetter";
import { defaultOnboardingTasks } from "@/lib/seed";
import { db, mutate, nowIso, uid } from "@/lib/store";

async function mine(form: FormData) {
  const user = await requireUser(["candidate"]);
  const id = String(form.get("offerId"));
  const d = db();
  const offer = d.offers.find((o) => o.id === id);
  const app = offer ? d.applications.find((a) => a.id === offer.applicationId) : undefined;
  const cand = app ? d.candidates.find((c) => c.id === app.candidateId) : undefined;
  if (!offer || !app || !cand || cand.userId !== user.id) redirect("/me");
  const back = (q: string): never => redirect(`/me/offers/${id}?${q}`);
  if (offer.status !== "sent") back("err=This+offer+is+not+open+for+a+response.");
  if (offerIsExpired(offer)) back(`err=${encodeURIComponent(`This offer expired. Please contact ${d.settings.supportEmail}.`)}`);
  return { user, id, offer, app, cand, back };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export async function acceptOffer(form: FormData) {
  const { user, id, app, cand, back } = await mine(form);
  const signature = String(form.get("signature") ?? "").trim();
  if (!form.get("agree")) back("err=Please+tick+the+box+to+confirm.");
  if (norm(signature) !== norm(cand.name)) back(`err=${encodeURIComponent(`Please type your full name exactly as "${cand.name}".`)}`);
  const ip = await clientIp();
  mutate((d) => {
    const o = d.offers.find((x) => x.id === id)!;
    o.status = "accepted";
    o.candidateResponse = { at: nowIso(), signatureName: signature, ip };
    o.updatedAt = nowIso();
    const posting = d.postings.find((p) => p.id === app.postingId);
    const req = d.requisitions.find((r) => r.id === posting?.requisitionId);
    if (!d.hires.some((h) => h.applicationId === app.id)) {
      d.hires.push({
        id: uid("h_"),
        applicationId: app.id,
        candidateId: cand.id,
        userId: cand.userId,
        offerId: o.id,
        name: cand.name,
        status: "preboarding",
        joiningDate: o.joiningDate,
        managerId: req?.hiringManagerId,
        tasks: defaultOnboardingTasks(o.joiningDate, uid, d.master),
        badges: [],
        createdAt: nowIso(),
      });
    }
    audit(d, user, "offer.accept", "offer", o.id, `${cand.name} accepted offer ${o.code} (signed "${signature}")`, { ip });
    notify(d, { roles: ["hr"] }, "🎉 Offer accepted", `${cand.name} accepted ${o.code}. Issue the appointment letter.`, `/hr/offers/${o.id}`);
    if (req?.hiringManagerId) notify(d, { userId: req.hiringManagerId }, "Offer accepted", `${cand.name} accepted the offer for ${posting?.title}.`, `/hr/onboarding`);
  });
  redirect(`/me/offers/${id}?msg=${encodeURIComponent("Welcome aboard! Your acceptance is recorded. Your appointment letter will follow shortly.")}&accepted=1`);
}

export async function declineOffer(form: FormData) {
  const { user, id, cand, back } = await mine(form);
  const reason = String(form.get("reason") ?? "").trim();
  if (!reason) back("err=Please+tell+us+briefly+why+you+are+declining.");
  const ip = await clientIp();
  mutate((d) => {
    const o = d.offers.find((x) => x.id === id)!;
    o.status = "declined";
    o.candidateResponse = { at: nowIso(), reason, ip };
    o.updatedAt = nowIso();
    audit(d, user, "offer.decline", "offer", o.id, `${cand.name} declined offer ${o.code}: ${reason}`, { ip });
    notify(d, { roles: ["hr"] }, "Offer declined", `${cand.name} declined ${o.code}: ${reason}`, `/hr/offers/${o.id}`);
  });
  back("msg=Your+response+has+been+recorded.+Thank+you+for+letting+us+know.");
}

export async function counterOffer(form: FormData) {
  const { user, id, cand, back, offer } = await mine(form);
  const requested = Math.round(Number(form.get("requested")));
  const note = String(form.get("note") ?? "").trim();
  if (!(requested > 0)) back("err=Please+enter+the+gross+monthly+salary+you+are+asking+for.");
  if (requested <= offer.grossMonthly) back("err=Your+request+should+be+higher+than+the+current+offer.");
  mutate((d) => {
    const o = d.offers.find((x) => x.id === id)!;
    o.counterOffer = { at: nowIso(), requested, note };
    o.updatedAt = nowIso();
    audit(d, user, "offer.counter", "offer", o.id, `${cand.name} requested ${requested} gross on ${o.code}`);
    notify(d, { roles: ["hr"] }, "Counter-offer request", `${cand.name} asked for PKR ${requested.toLocaleString()} on ${o.code}.`, `/hr/offers/${o.id}`);
  });
  back("msg=Your+request+has+been+sent+to+HR.+We+will+get+back+to+you.");
}
