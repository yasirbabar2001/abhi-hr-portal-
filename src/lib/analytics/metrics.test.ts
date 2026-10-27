import { describe, expect, it } from "vitest";
import { funnel, nps, sentiment, timeInStage, timeToHireDays, toCsv } from "./metrics";
import type { Application } from "../types";

const app = (over: Partial<Application>): Application => ({
  id: "a",
  code: "A",
  postingId: "p",
  candidateId: "c",
  stage: "applied",
  status: "active",
  knockoutAnswers: {},
  stageHistory: [],
  tags: [],
  notes: [],
  consentAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...over,
});

describe("nps", () => {
  it("is promoters minus detractors as a percentage", () => {
    expect(nps([10, 9, 8, 7, 6, 0]).score).toBe(0);
    expect(nps([10, 10, 9, 5]).score).toBe(50);
    expect(nps([]).score).toBe(0);
  });
});

describe("timeToHireDays", () => {
  it("measures from application to hired stage", () => {
    const a = app({
      stage: "hired",
      stageHistory: [
        { stage: "applied", at: "2026-01-01T00:00:00Z", by: "x" },
        { stage: "hired", at: "2026-01-21T00:00:00Z", by: "x" },
      ],
    });
    expect(timeToHireDays([a, app({})])).toEqual([20]);
  });
});

describe("timeInStage", () => {
  it("averages days between consecutive stages", () => {
    const a = app({
      stageHistory: [
        { stage: "applied", at: "2026-01-01T00:00:00Z", by: "x" },
        { stage: "screening", at: "2026-01-05T00:00:00Z", by: "x" },
      ],
    });
    expect(timeInStage([a]).find((s) => s.stage === "applied")?.days).toBe(4);
  });
});

describe("funnel", () => {
  it("counts applications that reached each stage", () => {
    const f = funnel([app({ stage: "interview" }), app({ stage: "applied" })]);
    expect(f[0]!.value).toBe(2);
    expect(f[3]!.value).toBe(1);
    expect(f[4]!.value).toBe(0);
  });
});

describe("sentiment and csv", () => {
  it("tags comments", () => {
    expect(sentiment("Friendly and quick")).toBe("positive");
    expect(sentiment("Took a while, slow feedback")).toBe("negative");
  });
  it("escapes csv", () => {
    expect(toCsv([["a,b", 'say "hi"', 3]])).toBe('"a,b","say ""hi""",3');
  });
});
