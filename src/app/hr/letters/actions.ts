"use server";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { buildAppointmentLetter, nextLetterRef } from "@/lib/offers/letter";
import { db, mutate, nowIso, uid } from "@/lib/store";

export async function issueLetter(form: FormData) {
  const user = await requireSection("/hr/letters");
  const offerId = String(form.get("offerId"));
  const d0 = db();
  const offer = d0.offers.find((o) => o.id === offerId);
  if (!offer || offer.status !== "accepted") redirect("/hr/letters?err=Only+accepted+offers+can+get+an+appointment+letter.");
  if (d0.letters.some((l) => l.offerId === offerId)) redirect("/hr/letters?err=A+letter+has+already+been+issued+for+this+offer.");
  const id = mutate((d) => {
    const o = d.offers.find((x) => x.id === offerId)!;
    const at = nowIso();
    const ref = nextLetterRef(d);
    const letter = { id: uid("al_"), ref, offerId, applicationId: o.applicationId, issuedAt: at, issuedBy: user.id, body: buildAppointmentLetter(d, o, ref, at), status: "issued" as const };
    d.letters.push(letter);
    const app = d.applications.find((a) => a.id === o.applicationId)!;
    const fromStage = app.stage;
    app.stage = "hired";
    app.status = "hired";
    app.updatedAt = at;
    app.stageHistory.push({ stage: "hired", at, by: user.id, note: `Appointment letter ${ref}` });
    const hire = d.hires.find((h) => h.applicationId === app.id);
    if (hire && hire.status === "preboarding") hire.status = "orientation";
    const posting = d.postings.find((p) => p.id === app.postingId);
    const req = d.requisitions.find((r) => r.id === posting?.requisitionId);
    if (req) {
      req.filled = Math.min(req.headcount, req.filled + 1);
      if (req.filled >= req.headcount) req.status = "filled";
      req.updatedAt = at;
    }
    const cand = d.candidates.find((c) => c.id === app.candidateId);
    audit(d, user, "letter.issue", "letter", letter.id, `Appointment letter ${ref} issued to ${cand?.name}`, { before: { stage: fromStage }, after: { stage: "hired", requisitionFilled: req ? `${req.filled}/${req.headcount}` : undefined } });
    if (cand) notify(d, { userId: cand.userId }, "Your appointment letter is ready", "Please read and acknowledge it, then start your orientation.", `/me/letters/${letter.id}`);
    return letter.id;
  });
  redirect(`/hr/letters/${id}?msg=Appointment+letter+issued.+The+candidate+is+now+marked+as+hired.`);
}
