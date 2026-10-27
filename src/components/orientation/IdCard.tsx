import { fmtDate, initials } from "@/lib/format";

/** Digital employee ID card shown to a new hire once their number is generated. */
export function IdCard({
  name,
  employeeNo,
  designation,
  department,
  branch,
  joiningDate,
  company,
}: {
  name: string;
  employeeNo: string;
  designation: string;
  department: string;
  branch: string;
  joiningDate: string;
  company: string;
}) {
  return (
    <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-side p-5 text-white shadow-lg">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden />
      <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-white/5" aria-hidden />
      <div className="relative flex items-center justify-between text-xs uppercase tracking-wider text-white/80">
        <span>{company}</span>
        <span>Employee ID</span>
      </div>
      <div className="relative mt-4 flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/15 text-2xl font-semibold">{initials(name)}</span>
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">{name}</div>
          <div className="truncate text-sm text-white/85">{designation}</div>
          <div className="truncate text-xs text-white/70">{department} · {branch}</div>
        </div>
      </div>
      <div className="relative mt-5 flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/70">Employee no.</div>
          <div className="font-mono text-xl font-semibold tracking-wide">{employeeNo}</div>
        </div>
        <div className="text-right text-[11px] text-white/75">Joined<br />{fmtDate(joiningDate)}</div>
      </div>
    </div>
  );
}
