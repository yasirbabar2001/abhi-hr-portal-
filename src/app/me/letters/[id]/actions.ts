"use server";
import { redirect } from "next/navigation";
import { clientIp, requireUser } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { db, mutate, nowIso } from "@/lib/store";

export async function acknowledgeLetter(form: FormData) {
  const user = await requireUser(["candidate"]);
  const id = String(form.get("letterId"));
  const back = (q: string): never => redirect(`/me/letters/${id}?${q}`);
  const d0 = db();
  const letter = d0.letters.find((l) => l.id === id);
  const app = letter ? d0.applications.find((a) => a.id === letter.applicationId) : undefined;
  const cand = app ? d0.candidates.find((c) => c.id === app.candidateId) : undefined;
  if (!letter || !cand || cand.userId !== user.id) redirect("/me");
  if (letter.status === "acknowledged") back("msg=Already+acknowledged.");
  const name = String(form.get("signature") ?? "").trim();
  if (!form.get("agree")) back("err=Please+tick+the+box+to+confirm.");
  if (name.toLowerCase().replace(/\s+/g, " ") !== cand.name.toLowerCase().replace(/\s+/g, " ")) back(`err=${encodeURIComponent(`Please type your full name exactly as "${cand.name}".`)}`);
  const ip = await clientIp();
  mutate((d) => {
    const l = d.letters.find((x) => x.id === id)!;
    l.status = "acknowledged";
    l.acknowledgedAt = nowIso();
    l.acknowledgedName = name;
    audit(d, user, "letter.acknowledge", "letter", l.id, `${cand.name} acknowledged appointment letter ${l.ref}`, { ip });
    notify(d, { roles: ["hr"] }, "Appointment letter acknowledged", `${cand.name} signed ${l.ref}.`, `/hr/letters/${l.id}`);
  });
  back("msg=Thank+you!+Your+acknowledgement+is+recorded.&done=1");
}
