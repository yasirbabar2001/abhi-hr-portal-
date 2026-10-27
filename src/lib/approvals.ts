import type { ApprovalStep, User } from "./types";
import { nowIso } from "./store";

export function makeApprovals(chain: string[]): ApprovalStep[] {
  return chain.map((label, i) => ({ step: i + 1, label, status: "pending" as const }));
}

export function currentStep(steps: ApprovalStep[]): ApprovalStep | undefined {
  return steps.find((s) => s.status === "pending");
}

/**
 * Record a decision on the current step. Returns the overall outcome:
 * "approved" when the last step passes, "rejected" on any rejection, otherwise "pending".
 */
export function decide(
  steps: ApprovalStep[],
  user: Pick<User, "id" | "name">,
  decision: "approved" | "rejected",
  comment?: string,
): "approved" | "rejected" | "pending" {
  const step = currentStep(steps);
  if (!step) return steps.some((s) => s.status === "rejected") ? "rejected" : "approved";
  step.status = decision;
  step.by = user.id;
  step.byName = user.name;
  step.at = nowIso();
  step.comment = comment || undefined;
  if (decision === "rejected") return "rejected";
  return currentStep(steps) ? "pending" : "approved";
}
