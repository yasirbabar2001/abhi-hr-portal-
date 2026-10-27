import type { Db } from "./types";

/**
 * Render an employee number from the configured pattern.
 * Tokens: {PREFIX} {YYYY} {YY} {SEQ:n} (n = zero-padded width) {DEPT} (department code).
 */
export function renderEmployeeNo(pattern: string, prefix: string, seq: number, deptCode = "GEN", date = new Date()) {
  const yyyy = String(date.getFullYear());
  return pattern
    .replace(/\{PREFIX\}/g, prefix)
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yyyy.slice(2))
    .replace(/\{DEPT\}/g, deptCode)
    .replace(/\{SEQ(?::(\d+))?\}/g, (_m, w: string | undefined) => String(seq).padStart(Number(w ?? 5), "0"));
}

/** Allocate the next unique employee number (call inside mutate). */
export function allocateEmployeeNo(d: Db, departmentId?: string): string {
  const deptCode = d.master.find((m) => m.id === departmentId)?.code ?? "GEN";
  const taken = new Set(d.employees.map((e) => e.employeeNo));
  let no: string;
  do {
    no = renderEmployeeNo(d.settings.employeeIdPattern, d.settings.employeeIdPrefix, d.settings.nextEmployeeSeq, deptCode);
    d.settings.nextEmployeeSeq += 1;
  } while (taken.has(no));
  return no;
}
