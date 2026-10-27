import type { Db, Hire, OrientationModule, OrientationProgress } from "../types";

// Pure read model for a hire's orientation: progress, points, rank and badges.

export const RANKS = [
  { name: "Newcomer", min: 0, icon: "🌱" },
  { name: "Explorer", min: 25, icon: "🧭" },
  { name: "Insider", min: 60, icon: "🔑" },
  { name: "Champion", min: 100, icon: "🏆" },
] as const;

export interface BadgeInfo {
  key: string;
  name: string;
  icon: string;
  description: string;
  earned: boolean;
}

export interface Journey {
  steps: { module: OrientationModule; progress?: OrientationProgress; unlocked: boolean }[];
  points: number;
  maxPoints: number;
  requiredDone: number;
  requiredTotal: number;
  percent: number;
  allDone: boolean;
  rank: (typeof RANKS)[number];
  nextRank?: (typeof RANKS)[number];
  badges: BadgeInfo[];
}

export function activeModules(d: Pick<Db, "modules">): OrientationModule[] {
  return d.modules.filter((m) => m.active).sort((a, b) => a.order - b.order);
}

export function hireForUser(d: Pick<Db, "hires">, userId: string): Hire | undefined {
  return d.hires.find((h) => h.userId === userId);
}

export function canTakeOrientation(hire: Hire | undefined): hire is Hire {
  return !!hire && (hire.status === "orientation" || hire.status === "onboarding");
}

export function buildJourney(d: Pick<Db, "modules" | "progress">, hire: Hire): Journey {
  const mods = activeModules(d);
  const prog = new Map(d.progress.filter((p) => p.hireId === hire.id).map((p) => [p.moduleId, p]));
  // A module unlocks once every earlier required module is complete (a gentle, game-like path).
  let blocked = false;
  const steps = mods.map((module) => {
    const progress = prog.get(module.id);
    const step = { module, progress, unlocked: !blocked };
    if (module.required && progress?.status !== "completed") blocked = true;
    return step;
  });
  const points = steps.reduce((s, x) => s + (x.progress?.points ?? 0), 0);
  const maxPoints = mods.reduce((s, m) => s + m.points, 0);
  const required = steps.filter((s) => s.module.required);
  const requiredDone = required.filter((s) => s.progress?.status === "completed").length;
  const done = steps.filter((s) => s.progress?.status === "completed");
  const allDone = required.length > 0 ? requiredDone === required.length : done.length === steps.length && steps.length > 0;
  const percent = maxPoints ? Math.round((points / maxPoints) * 100) : allDone ? 100 : 0;
  const rankPct = allDone ? 100 : Math.min(99, percent);
  const rankIdx = RANKS.reduce((best, r, i) => (rankPct >= r.min ? i : best), 0);

  const starts = d.progress.filter((p) => p.hireId === hire.id && p.startedAt).map((p) => p.startedAt!).sort();
  const ends = done.map((s) => s.progress!.completedAt!).filter(Boolean).sort();
  const fast =
    allDone && starts.length > 0 && ends.length > 0 && new Date(ends[ends.length - 1]!).getTime() - new Date(starts[0]!).getTime() <= 3 * 86_400_000;
  const perfect = steps.some((s) => s.module.kind === "quiz" && s.progress?.status === "completed" && s.progress.score === 100);

  const badges: BadgeInfo[] = [
    { key: "welcome", name: "Welcome aboard", icon: "👋", description: "Accepted your offer and joined the journey", earned: true },
    { key: "first", name: "First steps", icon: "👣", description: "Completed your first module", earned: done.length > 0 },
    { key: "perfect", name: "Perfect score", icon: "💯", description: "Scored 100% on a quiz", earned: perfect },
    { key: "fast", name: "Fast finisher", icon: "⚡", description: "Finished orientation within 3 days", earned: fast },
    { key: "champion", name: "Orientation champion", icon: "🏆", description: "Completed every required module", earned: allDone },
  ];
  for (const b of hire.badges) if (!badges.some((x) => x.name === b)) badges.push({ key: b, name: b, icon: "🎖️", description: b, earned: true });

  return {
    steps,
    points,
    maxPoints,
    requiredDone,
    requiredTotal: required.length,
    percent,
    allDone,
    rank: RANKS[rankIdx]!,
    nextRank: RANKS[rankIdx + 1],
    badges,
  };
}

/** Quiz scoring: percentage of correct answers, rounded. */
export function scoreQuiz(questions: { id: string; answer: number }[], answers: Record<string, number | undefined>) {
  const correct = questions.filter((q) => answers[q.id] === q.answer).length;
  return questions.length ? Math.round((correct / questions.length) * 100) : 0;
}

/** SCORM 1.2 completion rule. */
export function scormCompleted(data: Record<string, string>, passMark: number): boolean {
  const status = (data["cmi.core.lesson_status"] ?? "").toLowerCase();
  if (status !== "passed" && status !== "completed") return false;
  const raw = data["cmi.core.score.raw"];
  if (raw === undefined || raw === "") return true;
  const max = Number(data["cmi.core.score.max"] || 100) || 100;
  return (Number(raw) / max) * 100 >= passMark;
}
