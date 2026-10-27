"use server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db, mutate } from "@/lib/store";
import { lines } from "@/lib/format";
import { renderEmployeeNo } from "@/lib/employee-id";

const enc = encodeURIComponent;

function num(form: FormData, key: string, min: number, max: number) {
  const n = Number(form.get(key));
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${key} must be between ${min} and ${max}.`);
  return Math.round(n);
}

export async function saveSettings(form: FormData) {
  const actor = await requireAdmin();
  const current = db().settings;
  let next;
  try {
    const pattern = String(form.get("employeeIdPattern") ?? "").trim();
    if (!/\{SEQ(:\d+)?\}/.test(pattern)) throw new Error("The employee ID pattern must include {SEQ} so every number is unique.");
    const prefix = String(form.get("employeeIdPrefix") ?? "").trim();
    if (!prefix) throw new Error("Enter an employee ID prefix.");
    const color = String(form.get("primaryColor") ?? "");
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("Brand colour must be a hex value like #0e7c66.");
    const chain = (k: string) => {
      const c = lines(form.get(k));
      if (!c.length) throw new Error("Each approval chain needs at least one step.");
      return c;
    };
    const seq = num(form, "nextEmployeeSeq", 1, 99_999_999);
    if (seq < current.nextEmployeeSeq) {
      // Lowering the sequence is allowed only if it cannot reproduce an existing number.
      const taken = new Set(db().employees.map((e) => e.employeeNo));
      if (taken.has(renderEmployeeNo(pattern, prefix, seq, "IT"))) throw new Error("That sequence number would repeat an existing employee ID.");
    }
    next = {
      ...current,
      companyName: String(form.get("companyName") ?? "").trim() || current.companyName,
      shortName: String(form.get("shortName") ?? "").trim() || current.shortName,
      primaryColor: color,
      careersIntro: String(form.get("careersIntro") ?? "").trim(),
      supportEmail: String(form.get("supportEmail") ?? "").trim(),
      employeeIdPrefix: prefix,
      employeeIdPattern: pattern,
      nextEmployeeSeq: seq,
      requisitionApprovalChain: chain("requisitionApprovalChain"),
      offerApprovalChain: chain("offerApprovalChain"),
      statusChangeApprovalChain: chain("statusChangeApprovalChain"),
      blindScreening: form.get("blindScreening") === "on",
      autoShortlistThreshold: num(form, "autoShortlistThreshold", 0, 100),
      autoRejectKnockout: form.get("autoRejectKnockout") === "on",
      interviewDefaultMinutes: num(form, "interviewDefaultMinutes", 10, 480),
      orientationPassMark: num(form, "orientationPassMark", 0, 100),
      offerValidityDays: num(form, "offerValidityDays", 1, 90),
      candidateDataRetentionMonths: num(form, "candidateDataRetentionMonths", 1, 120),
      surveysEnabled: form.get("surveysEnabled") === "on",
    };
  } catch (e) {
    redirect(`/admin/settings?err=${enc((e as Error).message)}`);
  }
  mutate((d) => {
    const { employeeApi: _b, ...before } = d.settings;
    void _b;
    d.settings = { ...next, employeeApi: d.settings.employeeApi };
    const { employeeApi: _a, ...after } = d.settings;
    void _a;
    audit(d, actor, "settings.update", "settings", "portal", `${actor.name} updated portal settings`, { before, after });
  });
  redirect(`/admin/settings?msg=${enc("Settings saved.")}`);
}
