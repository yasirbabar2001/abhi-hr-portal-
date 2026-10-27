import { describe, expect, it } from "vitest";
import { buildJourney, scoreQuiz, scormCompleted } from "./journey";
import type { Hire, OrientationModule, OrientationProgress } from "../types";

const mod = (id: string, order: number, points: number, required = true, kind: OrientationModule["kind"] = "pdf"): OrientationModule => ({
  id, title: id, kind, description: "", order, required, points, durationMin: 5, active: true, createdAt: "",
});
const hire = { id: "h1", badges: [] } as unknown as Hire;
const done = (moduleId: string, points: number, extra: Partial<OrientationProgress> = {}): OrientationProgress => ({
  id: moduleId + "p", hireId: "h1", moduleId, status: "completed", points, attempts: 1,
  startedAt: "2026-10-01T00:00:00Z", completedAt: "2026-10-02T00:00:00Z", ...extra,
});

describe("buildJourney", () => {
  const modules = [mod("a", 1, 100), mod("b", 2, 100, true, "quiz"), mod("c", 3, 50, false)];
  it("locks modules after an unfinished required one", () => {
    const j = buildJourney({ modules, progress: [] }, hire);
    expect(j.steps.map((s) => s.unlocked)).toEqual([true, false, false]);
    expect(j.rank.name).toBe("Newcomer");
    expect(j.allDone).toBe(false);
  });
  it("counts points, rank and badges", () => {
    const j = buildJourney({ modules, progress: [done("a", 100), done("b", 100, { score: 100 })] }, hire);
    expect(j.points).toBe(200);
    expect(j.allDone).toBe(true); // optional module c not needed
    expect(j.rank.name).toBe("Champion");
    const earned = j.badges.filter((b) => b.earned).map((b) => b.key);
    expect(earned).toEqual(expect.arrayContaining(["first", "perfect", "fast", "champion"]));
  });
});

describe("scoring", () => {
  it("scores a quiz", () => {
    expect(scoreQuiz([{ id: "1", answer: 0 }, { id: "2", answer: 1 }], { "1": 0, "2": 0 })).toBe(50);
  });
  it("applies the SCORM pass mark", () => {
    expect(scormCompleted({ "cmi.core.lesson_status": "passed", "cmi.core.score.raw": "80" }, 70)).toBe(true);
    expect(scormCompleted({ "cmi.core.lesson_status": "passed", "cmi.core.score.raw": "60" }, 70)).toBe(false);
    expect(scormCompleted({ "cmi.core.lesson_status": "completed" }, 70)).toBe(true);
    expect(scormCompleted({ "cmi.core.lesson_status": "incomplete" }, 70)).toBe(false);
  });
});
