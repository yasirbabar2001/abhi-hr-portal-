import { describe, expect, it } from "vitest";
import { applyMap, extractRecords, getPath, mapStatus, maskSecret, normaliseDate, parseFieldMap } from "./employee-api";

describe("parseFieldMap", () => {
  it("reads lines and reports unknown fields", () => {
    const { map, errors } = parseFieldMap("employeeNo = emp_code\nname: full_name\n# comment\nfoo = bar");
    expect(map).toEqual({ employeeNo: "emp_code", name: "full_name" });
    expect(errors).toEqual(["Unknown field “foo”."]);
  });
  it("requires employeeNo", () => {
    expect(parseFieldMap("name = n").errors).toContain("employeeNo must be mapped (it is the matching key).");
  });
});

describe("mapping", () => {
  it("follows dotted paths", () => {
    const rec = { code: 7, org: { dept: { code: "IT" } }, phones: ["0300"] };
    expect(getPath(rec, "org.dept.code")).toBe("IT");
    expect(getPath(rec, "phones.0")).toBe("0300");
    expect(applyMap(rec, { employeeNo: "code", department: "org.dept.code", grade: "missing" })).toEqual({ employeeNo: "7", department: "IT" });
  });
  it("finds records in common shapes", () => {
    expect(extractRecords([1, 2]).records).toHaveLength(2);
    expect(extractRecords({ data: [1], next: "http://x?page=2" })).toEqual({ records: [1], next: "http://x?page=2" });
    expect(extractRecords({ employees: [1] }).records).toEqual([1]);
    expect(extractRecords({ items: [1, 2, 3] }).records).toHaveLength(3);
    expect(() => extractRecords({ foo: 1 })).toThrow();
  });
  it("maps statuses", () => {
    expect(mapStatus("Permanent")).toEqual({ status: "confirmed", active: true });
    expect(mapStatus("On Probation")).toEqual({ status: "probation", active: true });
    expect(mapStatus("Resigned")).toEqual({ status: "resigned", active: false });
    expect(mapStatus("TERMINATED")).toEqual({ status: "terminated", active: false });
  });
  it("normalises dates", () => {
    expect(normaliseDate("2024-03-05T00:00:00Z")).toBe("2024-03-05");
    expect(normaliseDate("5/3/2024")).toBe("2024-03-05");
    expect(normaliseDate("nonsense")).toBeUndefined();
  });
  it("masks secrets", () => {
    expect(maskSecret("Bearer demo-token")).toMatch(/^Bear•+oken$/);
    expect(maskSecret("")).toBe("");
  });
});
