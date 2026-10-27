import type { Db, Employee } from "@/lib/types";
import { masterList } from "@/lib/lookup";
import { humanize } from "@/lib/format";
import { EMPLOYMENT_STATUSES } from "@/lib/employees/query";
import { Field } from "@/components/ui";
import { SubmitButton } from "@/components/forms";

export function EmployeeForm({
  d,
  action,
  employee,
  isNew,
  submitLabel,
}: {
  d: Db;
  action: (form: FormData) => Promise<void>;
  employee?: Employee;
  isNew?: boolean;
  submitLabel: string;
}) {
  const e = employee;
  const sel = (name: keyof Employee, type: Parameters<typeof masterList>[1], label: string, required = false) => (
    <Field label={label}>
      <select name={name} defaultValue={(e?.[name] as string) ?? ""} className="input" required={required}>
        <option value="">{required ? "Choose…" : "—"}</option>
        {masterList(d, type).map((m) => (
          <option key={m.id} value={m.id}>
            {type === "grade" ? `${m.code} · ${m.name}` : m.name}
          </option>
        ))}
      </select>
    </Field>
  );
  const managers = d.employees.filter((x) => x.active && x.id !== e?.id).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <form action={action} className="space-y-6">
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Identity & contact</legend>
        {isNew && (
          <Field label="Employee number" hint={`Leave empty to generate one (pattern ${d.settings.employeeIdPattern}).`}>
            <input name="employeeNo" className="input font-mono" placeholder="Auto" />
          </Field>
        )}
        <Field label="Full name (as on CNIC)">
          <input name="name" required defaultValue={e?.name} className="input" />
        </Field>
        <Field label="Official email">
          <input name="email" type="email" required defaultValue={e?.email} className="input" />
        </Field>
        <Field label="Mobile">
          <input name="phone" defaultValue={e?.phone} className="input" placeholder="03XX XXXXXXX" />
        </Field>
        <Field label="CNIC">
          <input name="cnic" defaultValue={e?.cnic} className="input" placeholder="42101-1234567-1" />
        </Field>
        <Field label="Gender">
          <select name="gender" defaultValue={e?.gender ?? ""} className="input">
            <option value="">—</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Date of birth">
          <input name="dateOfBirth" type="date" defaultValue={e?.dateOfBirth?.slice(0, 10)} className="input" />
        </Field>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Job</legend>
        {sel("departmentId", "department", "Department", true)}
        {sel("designationId", "designation", "Designation", true)}
        {sel("gradeId", "grade", "Grade")}
        {sel("branchId", "branch", "Branch / office")}
        {sel("employmentTypeId", "employment_type", "Employment type")}
        <Field label="Reports to">
          <select name="managerEmployeeId" defaultValue={e?.managerEmployeeId ?? ""} className="input">
            <option value="">—</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.employeeNo})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Joining date">
          <input name="joiningDate" type="date" required defaultValue={e?.joiningDate?.slice(0, 10)} className="input" />
        </Field>
        <Field label="Employment status" hint={isNew ? undefined : "For promotions, transfers and exits, raise a status change instead so it is approved and recorded."}>
          <select name="employmentStatus" defaultValue={e?.employmentStatus ?? "probation"} className="input">
            {EMPLOYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Basic salary (PKR / month)">
          <input name="basicSalary" type="number" min={0} step={500} defaultValue={e?.basicSalary} className="input" />
        </Field>
      </fieldset>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
