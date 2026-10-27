"use server";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { db, mutate, nowIso } from "@/lib/store";

const score = (v: FormDataEntryValue | null) => Math.min(5, Math.max(1, Number(v) || 0));

export async function submitReference(form: FormData) {
  const token = String(form.get("token") ?? "");
  const back = (q: string): never => redirect(`/reference/${token}?${q}`);
  const ref = db().references.find((r) => r.token === token);
  if (!ref || ref.status !== "requested") back("err=This+link+is+no+longer+active.");
  if (!form.get("declaration")) back("err=Please+confirm+the+declaration.");
  for (const k of ["performance", "integrity", "teamwork"]) if (!form.get(k)) back("err=Please+rate+all+three+areas.");
  if (!form.get("rehire")) back("err=Please+answer+the+re-hire+question.");
  const ip = await clientIp();
  mutate((d) => {
    const r = d.references.find((x) => x.token === token)!;
    const app = d.applications.find((a) => a.id === r.applicationId);
    const cand = app ? d.candidates.find((c) => c.id === app.candidateId) : undefined;
    r.response = {
      capacity: String(form.get("capacity") ?? "").trim() || r.relationship,
      period: String(form.get("period") ?? "").trim() || "—",
      performance: score(form.get("performance")),
      integrity: score(form.get("integrity")),
      teamwork: score(form.get("teamwork")),
      rehire: form.get("rehire") === "yes",
      comments: String(form.get("comments") ?? "").trim().slice(0, 3000),
    };
    r.status = "received";
    r.completedAt = nowIso();
    audit(d, { id: `referee:${r.id}`, name: r.refereeName, role: "public" }, "reference.submit", "reference", r.id, `${r.refereeName} submitted a reference for ${cand?.name ?? "a candidate"}`, { ip });
    notify(d, { roles: ["hr"] }, "Reference received", `${r.refereeName} responded for ${cand?.name ?? "a candidate"}.`, `/hr/verification/${r.applicationId}`);
  });
  back("done=1");
}
