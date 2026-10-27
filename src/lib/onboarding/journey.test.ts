import { describe, expect, it } from "vitest";
import { onboardingSummary } from "./journey";
import type { Hire, OnboardingTask } from "../types";

const task = (id: string, phase: OnboardingTask["phase"], dueDate: string, done = false): OnboardingTask => ({ id, title: id, phase, owner: "hr", dueDate, done });

describe("onboardingSummary", () => {
  it("groups by phase, finds the current phase and overdue tasks", () => {
    const hire = { tasks: [task("a", "pre_joining", "2026-10-01", true), task("b", "day_one", "2026-10-05"), task("c", "first_30", "2026-11-30")] } as Hire;
    const s = onboardingSummary(hire, "2026-10-27");
    expect(s.percent).toBe(33);
    expect(s.current).toBe("day_one");
    expect(s.overdue.map((t) => t.id)).toEqual(["b"]);
    expect(s.phases.find((p) => p.key === "pre_joining")?.complete).toBe(true);
  });
});
