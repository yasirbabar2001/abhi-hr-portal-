import type { EmploymentStatus, Employee } from "../types";

// Pure helpers for reading the bank's employee feed. No I/O here, so they are unit tested.

/** Fields we can fill from the feed. Codes (department…grade) are resolved to master data by the sync. */
export const MAPPABLE_FIELDS = [
  "employeeNo",
  "name",
  "email",
  "phone",
  "cnic",
  "gender",
  "dateOfBirth",
  "department",
  "branch",
  "designation",
  "grade",
  "employmentType",
  "managerEmployeeNo",
  "joiningDate",
  "status",
  "basicSalary",
  "exitDate",
] as const;
export type MappableField = (typeof MAPPABLE_FIELDS)[number];

export type MappedRecord = Partial<Record<MappableField, string>>;

/** Parse "ourField = source.path" lines into a map; returns unknown fields as errors. */
export function parseFieldMap(text: string): { map: Record<string, string>; errors: string[] } {
  const map: Record<string, string> = {};
  const errors: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Za-z]+)\s*[=:]\s*(.+)$/);
    if (!m) {
      errors.push(`Cannot read “${line}”. Use: ourField = source_field`);
      continue;
    }
    const [, field, path] = m as unknown as [string, string, string];
    if (!(MAPPABLE_FIELDS as readonly string[]).includes(field)) {
      errors.push(`Unknown field “${field}”.`);
      continue;
    }
    map[field] = path.trim();
  }
  if (!map.employeeNo) errors.push("employeeNo must be mapped (it is the matching key).");
  return { map, errors };
}

export function fieldMapToText(map: Record<string, string>): string {
  return Object.entries(map)
    .map(([k, v]) => `${k} = ${v}`)
    .join("\n");
}

/** Read a dotted path such as "org.department.code" or "phones.0". */
export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function applyMap(record: unknown, map: Record<string, string>): MappedRecord {
  const out: MappedRecord = {};
  for (const [field, path] of Object.entries(map)) {
    const v = getPath(record, path);
    if (v === undefined || v === null || v === "") continue;
    out[field as MappableField] = String(v).trim();
  }
  return out;
}

/** Find the list of records in common response shapes. */
export function extractRecords(body: unknown): { records: unknown[]; next?: string } {
  if (Array.isArray(body)) return { records: body };
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    const next =
      typeof o.next === "string" && o.next
        ? o.next
        : o.links && typeof (o.links as Record<string, unknown>).next === "string"
          ? ((o.links as Record<string, unknown>).next as string)
          : undefined;
    for (const key of ["data", "employees", "items", "results", "records"]) {
      if (Array.isArray(o[key])) return { records: o[key] as unknown[], next };
    }
  }
  throw new Error("The response is not a list of employees (expected an array, or data / employees / items).");
}

const STATUS_WORDS: [RegExp, EmploymentStatus][] = [
  [/resign/i, "resigned"],
  [/terminat|dismiss/i, "terminated"],
  [/retire/i, "retired"],
  [/probation/i, "probation"],
  [/contract/i, "contract"],
  [/confirm|permanent|regular|active/i, "confirmed"],
];

export function mapStatus(raw: string | undefined): { status: EmploymentStatus; active: boolean } {
  const s = (raw ?? "").trim();
  for (const [re, status] of STATUS_WORDS) {
    if (re.test(s)) return { status, active: !["resigned", "terminated", "retired"].includes(status) };
  }
  if (/inactive|left|exit/i.test(s)) return { status: "resigned", active: false };
  return { status: "confirmed", active: true };
}

/** Accepts ISO, "dd/mm/yyyy", "dd-mm-yyyy" or "dd-Mon-yyyy"; returns ISO date (yyyy-mm-dd) or undefined. */
export function normaliseDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return undefined;
}

export function mapGender(raw: string | undefined): Employee["gender"] {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === "m" || s.startsWith("male")) return "male";
  if (s === "f" || s.startsWith("female")) return "female";
  return "other";
}

export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  return value.slice(0, 4) + "•".repeat(Math.min(16, value.length - 8)) + value.slice(-4);
}
