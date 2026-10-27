import Link from "next/link";
import type { Metadata } from "next";
import clsx from "clsx";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterList, masterName } from "@/lib/lookup";
import { daysBetween, fmtDate, humanize } from "@/lib/format";
import { EMPLOYMENT_STATUSES, filterEmployees, type EmployeeFilters } from "@/lib/employees/query";
import { maybeAutoSync } from "@/lib/employees/auto-sync";
import { Avatar, Badge, Card, EmptyState, Flash, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { AutoSelect } from "@/components/forms";

export const metadata: Metadata = { title: "Employee master" };

const PAGE_SIZE = 25;

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<EmployeeFilters & { msg?: string; err?: string }> }) {
  const user = await requireSection("/hr/employees");
  maybeAutoSync();
  const sp = await searchParams;
  const d = db();
  const canEdit = user.role === "admin" || user.role === "hr";
  const rows = filterEmployees(d, sp);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(sp.page ?? 1) || 1));
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const active = d.employees.filter((e) => e.active);
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const chips: { label: string; value: number; href: string }[] = [
    { label: "Active", value: active.length, href: "/hr/employees" },
    { label: "On probation", value: active.filter((e) => e.employmentStatus === "probation").length, href: "/hr/employees?status=probation" },
    { label: "Confirmed", value: active.filter((e) => e.employmentStatus === "confirmed").length, href: "/hr/employees?status=confirmed" },
    { label: "Contract", value: active.filter((e) => e.employmentStatus === "contract").length, href: "/hr/employees?status=contract" },
    { label: "Joined in last 90 days", value: active.filter((e) => daysBetween(e.joiningDate, new Date()) <= 90).length, href: "/hr/employees?sort=joined&dir=desc" },
    { label: "Left this year", value: d.employees.filter((e) => !e.active && (e.exitDate ?? "") >= yearStart).length, href: "/hr/employees?active=no" },
  ];

  const qs = (patch: Partial<EmployeeFilters>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v && k !== "msg" && k !== "err") p.set(k, String(v));
    return `/hr/employees?${p.toString()}`;
  };
  const sortLink = (key: string, label: string) => {
    const on = (sp.sort ?? "name") === key;
    const dir = on && sp.dir !== "desc" ? "desc" : "asc";
    return (
      <Link href={qs({ sort: key, dir, page: undefined })} className={clsx("hover:text-ink", on && "text-ink")}>
        {label} {on ? (sp.dir === "desc" ? "↓" : "↑") : ""}
      </Link>
    );
  };
  const filtersOn = !!(sp.q || sp.dept || sp.branch || sp.grade || sp.status || sp.source || (sp.active && sp.active !== "yes"));
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !["page", "msg", "err"].includes(k)) as [string, string][]).toString();

  return (
    <div>
      <PageHeader
        title="Employee master"
        subtitle={`${d.employees.length} records · synced from the core HR system, added by onboarding, or entered by hand`}
        actions={
          <>
            <LinkButton href={`/hr/employees/export?${exportQs}`} variant="secondary">
              ⬇ Export CSV
            </LinkButton>
            {canEdit && <LinkButton href="/hr/employees/new">+ Add employee</LinkButton>}
          </>
        }
      />
      <Flash msg={sp.msg} err={sp.err} />

      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-full border border-line bg-surface px-3 py-1 text-sm hover:border-brand">
            <span className="font-semibold tabular-nums">{c.value}</span> <span className="text-muted">{c.label}</span>
          </Link>
        ))}
      </div>

      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7" action="/hr/employees">
          <input name="q" defaultValue={sp.q} placeholder="Name, employee no., CNIC, email…" className="input lg:col-span-2" aria-label="Search" />
          <AutoSelect name="dept" defaultValue={sp.dept ?? ""} aria-label="Department">
            <option value="">All departments</option>
            {masterList(d, "department").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </AutoSelect>
          <AutoSelect name="branch" defaultValue={sp.branch ?? ""} aria-label="Branch">
            <option value="">All branches</option>
            {masterList(d, "branch").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </AutoSelect>
          <AutoSelect name="grade" defaultValue={sp.grade ?? ""} aria-label="Grade">
            <option value="">All grades</option>
            {masterList(d, "grade").map((m) => <option key={m.id} value={m.id}>{m.code}</option>)}
          </AutoSelect>
          <AutoSelect name="status" defaultValue={sp.status ?? ""} aria-label="Employment status">
            <option value="">Any status</option>
            {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </AutoSelect>
          <div className="flex gap-2">
            <AutoSelect name="active" defaultValue={sp.active ?? "yes"} aria-label="Active">
              <option value="yes">Active</option>
              <option value="no">Left</option>
              <option value="all">All</option>
            </AutoSelect>
            <AutoSelect name="source" defaultValue={sp.source ?? ""} aria-label="Source">
              <option value="">Any source</option>
              <option value="api">Core HR API</option>
              <option value="portal">Onboarding</option>
              <option value="manual">Manual</option>
            </AutoSelect>
          </div>
          <input type="hidden" name="sort" value={sp.sort ?? ""} />
          <input type="hidden" name="dir" value={sp.dir ?? ""} />
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-7">
            <button className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-2">Search</button>
            {filtersOn && <Link href="/hr/employees" className="text-sm text-muted hover:text-brand">Clear filters</Link>}
            <span className="ml-auto text-sm text-muted">{rows.length} found</span>
          </div>
        </form>
      </Card>

      {shown.length === 0 ? (
        <EmptyState title="No employees match" body="Try a different search or clear the filters." />
      ) : (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{sortLink("name", "Employee")}</th>
                  <th>{sortLink("no", "Employee no.")}</th>
                  <th>{sortLink("dept", "Department")}</th>
                  <th>{sortLink("designation", "Designation")}</th>
                  <th>Grade</th>
                  <th>Branch</th>
                  <th>{sortLink("joined", "Joined")}</th>
                  <th>{sortLink("status", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/hr/employees/${e.id}`} className="flex items-center gap-2.5">
                        <Avatar name={e.name} size={30} />
                        <span>
                          <span className="block font-medium text-ink hover:text-brand">{e.name}</span>
                          <span className="block text-xs text-muted">{e.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs">{e.employeeNo}</td>
                    <td>{masterName(d, e.departmentId)}</td>
                    <td>{masterName(d, e.designationId)}</td>
                    <td>{d.master.find((m) => m.id === e.gradeId)?.code ?? "—"}</td>
                    <td>{masterName(d, e.branchId)}</td>
                    <td className="whitespace-nowrap">{fmtDate(e.joiningDate)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge status={e.employmentStatus} />
                        {!e.active && <Badge tone="bad">Left</Badge>}
                        {e.source !== "api" && <Badge tone="brand">{e.source === "portal" ? "New hire" : "Manual"}</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
              <span className="text-muted">
                Page {page} of {pages}
              </span>
              <div className="flex gap-2">
                {page > 1 && <LinkButton variant="secondary" size="sm" href={qs({ page: String(page - 1) })}>← Previous</LinkButton>}
                {page < pages && <LinkButton variant="secondary" size="sm" href={qs({ page: String(page + 1) })}>Next →</LinkButton>}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
