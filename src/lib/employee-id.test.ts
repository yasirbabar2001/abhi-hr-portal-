import { describe, expect, it } from "vitest";
import { renderEmployeeNo } from "./employee-id";

describe("renderEmployeeNo", () => {
  it("fills every token", () => {
    expect(renderEmployeeNo("{PREFIX}-{YYYY}-{SEQ:5}", "ABHI", 42, "IT", new Date("2026-10-27"))).toBe("ABHI-2026-00042");
    expect(renderEmployeeNo("{PREFIX}{YY}{DEPT}{SEQ:3}", "AB", 7, "FIN", new Date("2026-01-01"))).toBe("AB26FIN007");
  });
  it("defaults the sequence width to 5", () => {
    expect(renderEmployeeNo("{SEQ}", "X", 3)).toBe("00003");
  });
});
