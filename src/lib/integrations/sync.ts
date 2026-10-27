import "server-only";
import { audit } from "../audit";
import { db, mutate, nowIso, uid } from "../store";
import type { Db, Employee, EmployeeApiSettings, MasterType, User } from "../types";
import { applyMap, extractRecords, mapGender, mapStatus, normaliseDate, type MappedRecord } from "./employee-api";

const TIMEOUT_MS = 20_000;
const MAX_PAGES = 50;

async function fetchPage(url: string, api: EmployeeApiSettings) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (api.authHeader && api.authValue) headers[api.authHeader] = api.authValue;
  const started = Date.now();
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  const ms = Date.now() - started;
  if (!res.ok) throw new Error(`The server answered ${res.status} ${res.statusText}.`);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error("The response is not valid JSON.");
  }
  return { ...extractRecords(body), status: res.status, ms };
}

function describeError(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "TimeoutError" || e.name === "AbortError") return `No answer within ${TIMEOUT_MS / 1000} seconds.`;
    const cause = (e as Error & { cause?: { code?: string; message?: string } }).cause;
    return cause?.code ? `${e.message} (${cause.code})` : e.message;
  }
  return String(e);
}

export interface TestResult {
  ok: boolean;
  message: string;
  status?: number;
  ms?: number;
  count?: number;
  hasMore?: boolean;
  sampleRaw?: unknown;
  sampleMapped?: MappedRecord;
}

export async function testConnection(api: EmployeeApiSettings): Promise<TestResult> {
  if (!api.url) return { ok: false, message: "Enter the API address first." };
  try {
    const page = await fetchPage(api.url, api);
    return {
      ok: true,
      message: `Connected. ${page.records.length} record(s) on the first page${page.next ? ", more pages available" : ""}.`,
      status: page.status,
      ms: page.ms,
      count: page.records.length,
      hasMore: !!page.next,
      sampleRaw: page.records[0],
      sampleMapped: page.records[0] ? applyMap(page.records[0], api.fieldMap) : undefined,
    };
  } catch (e) {
    return { ok: false, message: describeError(e) };
  }
}

export interface SyncResult {
  ok: boolean;
  message: string;
  pages: number;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  deactivated: number;
  createdMaster: string[];
  errors: { row: number; employeeNo?: string; message: string }[];
}

type Actor = { id: string; name: string; role: User["role"] | "system" };

/** Fetch every page from the bank's HR API and upsert employees by employee number. */
export async function syncEmployees(actor: Actor, opts: { deactivateMissing: boolean }): Promise<SyncResult> {
  const api = db().settings.employeeApi;
  const result: SyncResult = { ok: false, message: "", pages: 0, fetched: 0, created: 0, updated: 0, unchanged: 0, deactivated: 0, createdMaster: [], errors: [] };
  if (!api.url) {
    result.message = "No API address configured.";
    return result;
  }
  const records: unknown[] = [];
  try {
    let url: string | undefined = api.url;
    const seen = new Set<string>();
    while (url && result.pages < MAX_PAGES && !seen.has(url)) {
      seen.add(url);
      const page = await fetchPage(url, api);
      result.pages++;
      records.push(...page.records);
      url = page.next ? new URL(page.next, url).toString() : undefined;
    }
  } catch (e) {
    result.message = `Sync stopped after ${result.pages} page(s): ${describeError(e)}`;
    finish(actor, result);
    return result;
  }
  result.fetched = records.length;

  mutate((d) => {
    const at = nowIso();
    const seenNos = new Set<string>();
    const managerLinks: [Employee, string][] = [];
    records.forEach((raw, i) => {
      const row = i + 1;
      const m = applyMap(raw, api.fieldMap);
      if (!m.employeeNo) {
        result.errors.push({ row, message: "No employee number" });
        return;
      }
      if (seenNos.has(m.employeeNo)) {
        result.errors.push({ row, employeeNo: m.employeeNo, message: "Duplicate employee number in the feed; later row ignored" });
        return;
      }
      seenNos.add(m.employeeNo);
      const existing = d.employees.find((e) => e.employeeNo === m.employeeNo);
      if (!existing && !m.name) {
        result.errors.push({ row, employeeNo: m.employeeNo, message: "New employee without a name" });
        return;
      }
      const st = m.status !== undefined ? mapStatus(m.status) : undefined;
      const patch: Partial<Employee> = {
        name: m.name,
        email: m.email?.toLowerCase(),
        phone: m.phone,
        cnic: m.cnic,
        gender: mapGender(m.gender),
        dateOfBirth: normaliseDate(m.dateOfBirth),
        departmentId: resolveMaster(d, "department", m.department, result),
        branchId: resolveMaster(d, "branch", m.branch, result),
        designationId: resolveMaster(d, "designation", m.designation, result),
        gradeId: resolveMaster(d, "grade", m.grade, result),
        employmentTypeId: resolveMaster(d, "employment_type", m.employmentType, result),
        joiningDate: normaliseDate(m.joiningDate),
        employmentStatus: st?.status,
        active: st?.active,
        basicSalary: m.basicSalary !== undefined && !Number.isNaN(Number(m.basicSalary)) ? Number(m.basicSalary) : undefined,
        exitDate: normaliseDate(m.exitDate),
      };
      for (const k of Object.keys(patch) as (keyof Employee)[]) if (patch[k] === undefined) delete patch[k];
      if (m.joiningDate && !patch.joiningDate) result.errors.push({ row, employeeNo: m.employeeNo, message: `Unreadable joining date “${m.joiningDate}”` });

      if (existing) {
        const changed = (Object.keys(patch) as (keyof Employee)[]).some((k) => existing[k] !== patch[k]);
        Object.assign(existing, patch, { lastSyncedAt: at });
        if (changed) {
          existing.updatedAt = at;
          result.updated++;
        } else result.unchanged++;
        if (m.managerEmployeeNo) managerLinks.push([existing, m.managerEmployeeNo]);
      } else {
        const emp: Employee = {
          id: uid("e_"),
          employeeNo: m.employeeNo,
          name: m.name!,
          email: patch.email ?? "",
          joiningDate: patch.joiningDate ?? at.slice(0, 10),
          employmentStatus: patch.employmentStatus ?? "confirmed",
          active: patch.active ?? true,
          source: "api",
          lastSyncedAt: at,
          createdAt: at,
          updatedAt: at,
          ...patch,
        };
        d.employees.push(emp);
        result.created++;
        if (m.managerEmployeeNo) managerLinks.push([emp, m.managerEmployeeNo]);
      }
    });
    for (const [emp, mgrNo] of managerLinks) {
      const mgr = d.employees.find((e) => e.employeeNo === mgrNo);
      if (mgr) emp.managerEmployeeId = mgr.id;
    }
    if (opts.deactivateMissing && result.fetched > 0) {
      for (const e of d.employees) {
        if (e.source === "api" && e.active && !seenNos.has(e.employeeNo)) {
          e.active = false;
          e.updatedAt = at;
          result.deactivated++;
        }
      }
    }
  });
  result.ok = true;
  result.message = `Synced ${result.fetched} record(s): ${result.created} new, ${result.updated} updated, ${result.unchanged} unchanged${
    opts.deactivateMissing ? `, ${result.deactivated} marked inactive` : ""
  }${result.errors.length ? `, ${result.errors.length} row problem(s)` : ""}.`;
  finish(actor, result);
  return result;
}

function finish(actor: Actor, result: SyncResult) {
  mutate((d) => {
    d.settings.employeeApi.lastSyncAt = nowIso();
    d.settings.employeeApi.lastSyncStatus = result.message;
    audit(d, actor as Parameters<typeof audit>[1], "employee.sync", "integration", "employee-api", result.message, {
      after: { ...result, errors: result.errors.slice(0, 50) },
    });
  });
}

function resolveMaster(d: Db, type: MasterType, code: string | undefined, result: SyncResult): string | undefined {
  if (!code) return undefined;
  const c = code.trim().toLowerCase();
  const found = d.master.find((x) => x.type === type && (x.code.toLowerCase() === c || x.name.toLowerCase() === c));
  if (found) return found.id;
  const item = {
    id: uid("m_"),
    type,
    code: code.trim().toUpperCase(),
    name: code.trim(),
    active: true,
    order: d.master.filter((x) => x.type === type).length,
    meta: { createdBy: "employee-sync" },
  };
  d.master.push(item);
  result.createdMaster.push(`${type.replace("_", " ")}: ${item.code}`);
  return item.id;
}
