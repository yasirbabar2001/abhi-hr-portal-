import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { Card, Flash, PageHeader } from "@/components/ui";
import { EmployeeForm } from "../../EmployeeForm";
import { updateEmployee } from "../../actions";

export const metadata: Metadata = { title: "Edit employee" };

export default async function EditEmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireSection("/hr/employees");
  const { id } = await params;
  const sp = await searchParams;
  const d = db();
  const e = d.employees.find((x) => x.id === id);
  if (!e) notFound();
  const allowed = user.role === "admin" || (user.role === "hr" && e.source !== "api");
  if (!allowed) redirect(`/hr/employees/${id}?err=${encodeURIComponent("This record is managed by the core HR system and can only be changed there (or by an administrator).")}`);
  return (
    <div className="max-w-5xl">
      <PageHeader title={`Edit ${e.name}`} subtitle={e.employeeNo} back={{ href: `/hr/employees/${id}`, label: "Back to profile" }} />
      <Flash err={sp.err} />
      {e.source === "api" && (
        <div className="mb-4 rounded-lg border border-warn/30 bg-warn-bg px-4 py-3 text-sm text-warn">
          ⚠ This record comes from the core HR system. Changes made here will be overwritten at the next sync unless they are also made in the core system.
        </div>
      )}
      <Card>
        <EmployeeForm d={d} action={updateEmployee.bind(null, id)} employee={e} submitLabel="Save changes" />
      </Card>
    </div>
  );
}
