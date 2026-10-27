import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { Card, Flash, PageHeader } from "@/components/ui";
import { EmployeeForm } from "../EmployeeForm";
import { createEmployee } from "../actions";

export const metadata: Metadata = { title: "Add employee" };

export default async function NewEmployeePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSection("/hr/employees");
  if (user.role === "hiring") redirect("/hr/employees?err=Only+HR+can+add+employees.");
  const sp = await searchParams;
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Add employee"
        subtitle="For people not yet in the core HR system. New hires are added automatically when they finish orientation."
        back={{ href: "/hr/employees", label: "Employee master" }}
      />
      <Flash err={sp.err} />
      <Card>
        <EmployeeForm d={db()} action={createEmployee} isNew submitLabel="Add employee" />
      </Card>
    </div>
  );
}
