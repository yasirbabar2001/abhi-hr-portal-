import type { Application, Db, Survey, Touchpoint } from "../types";
import { STAGES } from "../types";

// Pure analytics helpers. All take plain data so they can be unit-tested.

export function nps(scores: number[]): { score: number; promoters: number; passives: number; detractors: number; n: number } {
  const n = scores.length;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  const passives = n - promoters - detractors;
  const score = n === 0 ? 0 : Math.round(((promoters - detractors) / n) * 100);
  return { score, promoters, passives, detractors, n };
}

export function avg(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

const DAY = 86_400_000;

/** Days from application to the "hired" stage entry, for hired applications. */
export function timeToHireDays(apps: Application[]): number[] {
  const out: number[] = [];
  for (const a of apps) {
    const hired = a.stageHistory.find((h) => h.stage === "hired");
    if (hired) out.push(Math.max(0, Math.round((new Date(hired.at).getTime() - new Date(a.createdAt).getTime()) / DAY)));
  }
  return out;
}

/** Average days spent in each stage, from consecutive stageHistory entries. */
export function timeInStage(apps: Application[]): { stage: string; label: string; days: number; n: number }[] {
  const acc = new Map<string, number[]>();
  for (const a of apps) {
    for (let i = 0; i < a.stageHistory.length - 1; i++) {
      const cur = a.stageHistory[i]!;
      const next = a.stageHistory[i + 1]!;
      const days = (new Date(next.at).getTime() - new Date(cur.at).getTime()) / DAY;
      if (days >= 0) acc.set(cur.stage, [...(acc.get(cur.stage) ?? []), days]);
    }
  }
  return STAGES.filter((s) => s.key !== "hired").map((s) => {
    const v = acc.get(s.key) ?? [];
    return { stage: s.key, label: s.label, days: round1(avg(v)), n: v.length };
  });
}

/** Number of applications that reached at least each stage. */
export function funnel(apps: Application[]): { label: string; value: number }[] {
  return STAGES.map((s, i) => ({
    label: s.label,
    value: apps.filter((a) => STAGES.findIndex((x) => x.key === a.stage) >= i).length,
  }));
}

/** Applications that ended (rejected or withdrawn) at each stage. */
export function dropOff(apps: Application[]) {
  return STAGES.map((s) => ({
    label: s.label,
    rejected: apps.filter((a) => a.stage === s.key && a.status === "rejected").length,
    withdrawn: apps.filter((a) => a.stage === s.key && a.status === "withdrawn").length,
  })).filter((r) => r.label !== "Hired");
}

export function sourceEffectiveness(d: Pick<Db, "master">, apps: Application[]) {
  const map = new Map<string, { applied: number; shortlisted: number; hired: number }>();
  const shortIdx = STAGES.findIndex((s) => s.key === "shortlisted");
  for (const a of apps) {
    const key = a.sourceId ?? "unknown";
    const row = map.get(key) ?? { applied: 0, shortlisted: 0, hired: 0 };
    row.applied++;
    if (STAGES.findIndex((s) => s.key === a.stage) >= shortIdx) row.shortlisted++;
    if (a.stage === "hired" || a.status === "hired") row.hired++;
    map.set(key, row);
  }
  return [...map.entries()]
    .map(([id, r]) => ({
      label: d.master.find((m) => m.id === id)?.name ?? "Not recorded",
      ...r,
      hireRate: r.applied ? Math.round((r.hired / r.applied) * 100) : 0,
      shortlistRate: r.applied ? Math.round((r.shortlisted / r.applied) * 100) : 0,
    }))
    .sort((a, b) => b.applied - a.applied);
}

export function offerAcceptance(offers: Db["offers"]) {
  const decided = offers.filter((o) => o.status === "accepted" || o.status === "declined");
  const accepted = decided.filter((o) => o.status === "accepted").length;
  return { decided: decided.length, accepted, rate: decided.length ? Math.round((accepted / decided.length) * 100) : 0 };
}

const POS = ["helpful", "friendly", "quick", "clear", "great", "loved", "fun", "easy", "smooth", "excellent", "good", "professional", "saved", "well"];
const NEG = ["slow", "while", "late", "delay", "confusing", "rude", "difficult", "never", "poor", "bad", "faster", "unclear", "long"];

/** Very simple keyword sentiment, good enough to sort comments for review. */
export function sentiment(text: string): "positive" | "negative" | "neutral" {
  const t = text.toLowerCase();
  const p = POS.filter((w) => t.includes(w)).length;
  const n = NEG.filter((w) => t.includes(w)).length;
  return p > n ? "positive" : n > p ? "negative" : "neutral";
}

export const TOUCHPOINTS: { key: Touchpoint; label: string }[] = [
  { key: "application", label: "Application" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "orientation", label: "Orientation" },
  { key: "onboarding", label: "Onboarding" },
];

export function monthlyTrend(surveys: Survey[], months = 6) {
  const out: { label: string; key: string; n: number; nps: number }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const inMonth = surveys.filter((s) => s.at.slice(0, 7) === key);
    out.push({ key, label: dt.toLocaleDateString("en-GB", { month: "short" }), n: inMonth.length, nps: nps(inMonth.map((s) => s.nps)).score });
  }
  return out;
}

export function csvEscape(v: unknown): string {
  const s = v === undefined || v === null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

/** Current time for server-rendered reports (keeps Date.now out of component bodies). */
export function nowMs() {
  return Date.now();
}
