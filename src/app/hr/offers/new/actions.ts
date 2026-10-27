"use server";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { makeApprovals } from "@/lib/approvals";
import { lines } from "@/lib/format";
import { gross, readAllowances } from "@/lib/offers/calc";
import { activeOfferFor } from "@/lib/offers/OfferLetter";
import { db, mutate, nextCode, nowIso, uid } from "@/lib/store";

export async function createOffer(form: FormData) {
  const user = await requireSection("/hr/offers");
  const appId = String(form.get("applicationId"));
  const fail = (m: string): never => redirect(`/hr/offers/new?application=${appId}&err=${encodeURIComponent(m)}`);
  const d0 = db();
  const app = d0.applications.find((a) => a.id === appId);
  if (!app) redirect("/hr/offers?err=Application+not+found");
  if (activeOfferFor(d0, appId)) fail("This candidate already has an active offer.");
  const basic = Math.round(Number(form.get("basicSalary")));
  if (!(basic > 0)) fail("Enter a basic salary.");
  const joiningDate = String(form.get("joiningDate") ?? "");
  const expiresDate = String(form.get("expiresAt") ?? "");
  if (!joiningDate || !expiresDate) fail("Joining date and expiry date are required.");
  if (new Date(expiresDate) < new Date(new Date().toDateString())) fail("The expiry date must be in the future.");
  const allowances = readAllowances(form);
  const asDraft = form.get("intent") === "draft";
  const s = d0.settings;
  const id = mutate((d) => {
    const cand = d.candidates.find((c) => c.id === app!.candidateId);
    const offer = {
      id: uid("o_"),
      code: nextCode(d, "OFR"),
      applicationId: appId,
      designationId: String(form.get("designationId")),
      gradeId: String(form.get("gradeId")),
      departmentId: String(form.get("departmentId")),
      branchId: String(form.get("branchId")),
      employmentTypeId: String(form.get("employmentTypeId")),
      basicSalary: basic,
      allowances,
      grossMonthly: gross(basic, allowances),
      benefits: lines(form.get("benefits")),
      joiningDate,
      probationMonths: Math.max(0, Number(form.get("probationMonths") || 6)),
      expiresAt: new Date(`${expiresDate}T23:59:00+05:00`).toISOString(),
      status: (asDraft ? "draft" : "pending_approval") as "draft" | "pending_approval",
      approvals: makeApprovals(s.offerApprovalChain),
      createdBy: user.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    d.offers.push(offer);
    audit(d, user, "offer.create", "offer", offer.id, `Offer ${offer.code} prepared for ${cand?.name} (gross ${offer.grossMonthly})`, { after: offer });
    if (!asDraft) notify(d, { roles: ["admin", "hr"] }, "Offer needs approval", `${offer.code} for ${cand?.name}`, `/hr/offers/${offer.id}`);
    return offer.id;
  });
  redirect(`/hr/offers/${id}?msg=${encodeURIComponent(asDraft ? "Draft saved." : "Offer created and sent for approval.")}`);
}
