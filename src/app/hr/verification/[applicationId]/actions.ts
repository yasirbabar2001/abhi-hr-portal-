"use server";
import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { audit, notify } from "@/lib/audit";
import { saveUpload } from "@/lib/files";
import { db, mutate, nowIso, uid } from "@/lib/store";
import { summarize } from "@/lib/verification/status";

const PATH = "/hr/verification";
const back = (appId: string, q: string): never => redirect(`${PATH}/${appId}?${q}`);
const ok = (appId: string, m: string) => back(appId, `msg=${encodeURIComponent(m)}`);
const fail = (appId: string, m: string) => back(appId, `err=${encodeURIComponent(m)}`);

function findApp(appId: string) {
  const d = db();
  const app = d.applications.find((a) => a.id === appId);
  if (!app) redirect(`${PATH}?err=Application+not+found`);
  const cand = d.candidates.find((c) => c.id === app.candidateId)!;
  return { app, cand };
}

export async function addReference(form: FormData) {
  const user = await requireSection(PATH);
  const appId = String(form.get("applicationId"));
  const { app, cand } = findApp(appId);
  const f = (k: string) => String(form.get(k) ?? "").trim();
  if (!f("refereeName") || !f("refereeEmail")) fail(appId, "Referee name and email are required.");
  if (!/^\S+@\S+\.\S+$/.test(f("refereeEmail"))) fail(appId, "Please enter a valid referee email.");
  mutate((d) => {
    const ref = {
      id: uid("rf_"),
      applicationId: app.id,
      refereeName: f("refereeName"),
      refereeEmail: f("refereeEmail"),
      refereePhone: f("refereePhone"),
      relationship: f("relationship") || "Former line manager",
      company: f("company"),
      token: crypto.randomBytes(16).toString("hex"),
      status: "requested" as const,
      requestedBy: user.id,
      requestedAt: nowIso(),
    };
    d.references.push(ref);
    audit(d, user, "reference.request", "reference", ref.id, `Reference requested from ${ref.refereeName} for ${cand.name}`);
    notify(d, { userId: cand.userId }, "Reference check started", `We have contacted ${ref.refereeName} for a reference.`, `/me/verification/${app.id}`);
  });
  ok(appId, "Reference added. Share the secure link with the referee.");
}

export async function resendReference(form: FormData) {
  const user = await requireSection(PATH);
  const appId = String(form.get("applicationId"));
  const refId = String(form.get("referenceId"));
  mutate((d) => {
    const r = d.references.find((x) => x.id === refId && x.applicationId === appId);
    if (!r) return;
    r.requestedAt = nowIso();
    audit(d, user, "reference.reminder", "reference", r.id, `Reminder sent to ${r.refereeName}`);
  });
  ok(appId, "Reminder recorded.");
}

export async function decideReference(form: FormData) {
  const user = await requireSection(PATH);
  const appId = String(form.get("applicationId"));
  const refId = String(form.get("referenceId"));
  const decision = String(form.get("decision"));
  if (decision !== "verified" && decision !== "failed") fail(appId, "Unknown decision.");
  const note = String(form.get("note") ?? "").trim();
  if (decision === "failed" && !note) fail(appId, "Please add a note explaining why the reference failed.");
  mutate((d) => {
    const r = d.references.find((x) => x.id === refId && x.applicationId === appId);
    if (!r) return;
    const before = r.status;
    r.status = decision as "verified" | "failed";
    r.verifierNote = note || undefined;
    r.completedAt = r.completedAt ?? nowIso();
    audit(d, user, `reference.${decision}`, "reference", r.id, `Reference from ${r.refereeName} marked ${decision}`, { before: { status: before }, after: { status: r.status, note } });
  });
  ok(appId, `Reference marked ${decision}.`);
}

export async function startEcib(form: FormData) {
  const user = await requireSection(PATH);
  const appId = String(form.get("applicationId"));
  const { app, cand } = findApp(appId);
  const cnic = String(form.get("cnic") ?? cand.cnic).trim();
  if (!/^\d{5}-?\d{7}-?\d$/.test(cnic)) fail(appId, "Enter a valid CNIC (13 digits, e.g. 42101-1234567-1).");
  const open = db().ecib.find((e) => e.applicationId === appId && !["clear", "adverse", "exception"].includes(e.status));
  if (open) fail(appId, "An eCIB check is already in progress.");
  mutate((d) => {
    const e = { id: uid("ec_"), applicationId: app.id, cnic, status: "awaiting_consent" as const, requestedBy: user.id, requestedAt: nowIso() };
    d.ecib.push(e);
    audit(d, user, "ecib.request", "ecib", e.id, `eCIB check started for ${cand.name}; waiting for consent`);
    notify(d, { userId: cand.userId }, "Please give consent for a credit check", "We need your consent to check your credit history with the State Bank's eCIB.", `/me/verification/${app.id}`);
  });
  ok(appId, "eCIB check created. The candidate has been asked for consent.");
}

export async function submitEcib(form: FormData) {
  const user = await requireSection(PATH);
  const appId = String(form.get("applicationId"));
  const id = String(form.get("ecibId"));
  const e = db().ecib.find((x) => x.id === id && x.applicationId === appId);
  if (!e) fail(appId, "Check not found.");
  if (!e!.consentAt) fail(appId, "The candidate has not given consent yet.");
  mutate((d) => {
    const x = d.ecib.find((y) => y.id === id)!;
    x.status = "submitted";
    x.submittedAt = nowIso();
    audit(d, user, "ecib.submit", "ecib", x.id, `eCIB enquiry submitted for CNIC ${x.cnic}`);
  });
  ok(appId, "Marked as submitted to eCIB.");
}

export async function recordEcibResult(form: FormData) {
  const user = await requireSection(PATH);
  const appId = String(form.get("applicationId"));
  const id = String(form.get("ecibId"));
  const result = String(form.get("result"));
  if (!["clear", "adverse", "exception"].includes(result)) fail(appId, "Choose a result.");
  const remarks = String(form.get("remarks") ?? "").trim();
  if (result !== "clear" && !remarks) fail(appId, "Remarks are required for an adverse result or an exception.");
  const e = db().ecib.find((x) => x.id === id && x.applicationId === appId);
  if (!e) fail(appId, "Check not found.");
  if (!e!.consentAt) fail(appId, "The candidate has not given consent yet.");
  let fileId: string | undefined;
  try {
    fileId = (await saveUpload(form.get("report"), user.id))?.id;
  } catch (err) {
    fail(appId, (err as Error).message);
  }
  mutate((d) => {
    const x = d.ecib.find((y) => y.id === id)!;
    const before = { status: x.status };
    x.status = result as "clear" | "adverse" | "exception";
    x.outstanding = Number(form.get("outstanding") || 0);
    x.overdueDays = Number(form.get("overdueDays") || 0);
    x.remarks = remarks || undefined;
    if (fileId) x.reportFileId = fileId;
    x.submittedAt = x.submittedAt ?? nowIso();
    x.resultAt = nowIso();
    x.decidedBy = user.id;
    audit(d, user, "ecib.result", "ecib", x.id, `eCIB result recorded: ${result}`, { before, after: { status: x.status, outstanding: x.outstanding, overdueDays: x.overdueDays, remarks } });
  });
  ok(appId, "eCIB result recorded.");
}

export async function completeVerification(form: FormData) {
  const user = await requireSection(PATH);
  const appId = String(form.get("applicationId"));
  const { app, cand } = findApp(appId);
  const s = summarize(db(), app);
  if (!s.ready) fail(appId, `Not ready: ${s.blockers.join(" ")}`);
  if (app.stage !== "verification") fail(appId, "This application is not in the Verification stage.");
  mutate((d) => {
    const a = d.applications.find((x) => x.id === appId)!;
    a.stage = "offer";
    a.updatedAt = nowIso();
    a.stageHistory.push({ stage: "offer", at: nowIso(), by: user.id, note: "Verification complete" });
    audit(d, user, "application.stage", "application", a.id, `${cand.name}: verification complete, moved to Offer`, { before: { stage: "verification" }, after: { stage: "offer" } });
    notify(d, { roles: ["hr"] }, "Ready for offer", `${cand.name} has cleared verification.`, `/hr/offers/new?application=${a.id}`);
  });
  redirect(`/hr/offers/new?application=${appId}&msg=${encodeURIComponent("Verification complete. Prepare the offer.")}`);
}
