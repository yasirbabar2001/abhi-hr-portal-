import type { Hire, OnboardingPhase, OnboardingTask } from "../types";
import { ONBOARDING_PHASES } from "../types";

// Pure read model for an onboarding journey.

export const OWNER_LABEL: Record<OnboardingTask["owner"], string> = {
  hr: "HR",
  it: "IT",
  manager: "Line manager",
  new_hire: "You / new hire",
  admin: "Admin & facilities",
  finance: "Finance",
};

export function isOverdue(t: OnboardingTask, today: string) {
  return !t.done && t.dueDate < today;
}

export function onboardingSummary(hire: Hire, today: string) {
  const phases = ONBOARDING_PHASES.map((p) => {
    const tasks = hire.tasks.filter((t) => t.phase === p.key).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const done = tasks.filter((t) => t.done).length;
    return { ...p, tasks, done, total: tasks.length, complete: tasks.length > 0 && done === tasks.length };
  });
  const total = hire.tasks.length;
  const done = hire.tasks.filter((t) => t.done).length;
  const overdue = hire.tasks.filter((t) => isOverdue(t, today));
  const current: OnboardingPhase | undefined = phases.find((p) => p.total > 0 && !p.complete)?.key;
  return { phases, total, done, percent: total ? Math.round((done / total) * 100) : 0, overdue, current };
}
