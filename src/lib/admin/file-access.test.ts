import { describe, expect, it } from "vitest";
import { parseRange } from "./file-access";

describe("parseRange", () => {
  it("handles open, closed and suffix ranges", () => {
    expect(parseRange("bytes=0-", 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=50-500", 100)).toEqual({ start: 50, end: 99 });
  });
  it("rejects bad ranges", () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange("bytes=200-", 100)).toBe("invalid");
    expect(parseRange("items=1-2", 100)).toBe("invalid");
  });
});
