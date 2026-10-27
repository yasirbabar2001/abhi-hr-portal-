"use server";
import { redirect } from "next/navigation";
import { clientIp, requireUser } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { db, mutate, nowIso } from "@/lib/store";

export async function giveConsent(form: FormData) {
  const user = await requireUser(["candidate"]);
  const appId = String(form.get("applicationId"));
  const back = (q: string): never => redirect(`/me/verification/${appId}?${q}`);
  const d0 = db();
  const app = d0.applications.find((a) => a.id === appId);
  const cand = app ? d0.candidates.find((c) => c.id === app.candidateId) : undefined;
  if (!app || !cand || cand.userId !== user.id) redirect("/me");
  const check = d0.ecib.find((e) => e.applicationId === appId && e.status === "awaiting_consent");
  if (!check) back("err=There+is+no+consent+request+waiting.");
  const signature = String(form.get("signature") ?? "").trim();
  if (!form.get("agree")) back("err=Please+tick+the+consent+box.");
  if (signature.toLowerCase().replace(/\s+/g, " ") !== cand!.name.toLowerCase().replace(/\s+/g, " "))
    back(`err=${encodeURIComponent(`Please type your full name exactly as "${cand!.name}".`)}`);
  const ip = await clientIp();
  mutate((d) => {
    const e = d.ecib.find((x) => x.id === check!.id)!;
    e.consentAt = nowIso();
    e.status = "pending";
    audit(d, user, "ecib.consent", "ecib", e.id, `${user.name} gave consent for an eCIB check (signed "${signature}")`, { ip });
    notify(d, { roles: ["hr"] }, "eCIB consent received", `${user.name} has consented to the credit check.`, `/hr/verification/${appId}`);
  });
  back("msg=Thank+you.+Your+consent+has+been+recorded.");
}
