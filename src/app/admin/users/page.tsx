import Link from "next/link";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/store";
import { masterList, masterName } from "@/lib/lookup";
import { fmtDateTime, relative } from "@/lib/format";
import { ROLE_LABEL, type Role } from "@/lib/types";
import { Avatar, Badge, Card, Flash, PageHeader, Tabs } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { createUser, resetPassword, setActive, updateUser } from "./actions";

const ROLE_HELP: Record<Role, string> = {
  admin: "Portal settings, master data, users and everything HR can do",
  hr: "Full recruitment, onboarding and employee records",
  hiring: "Own requisitions, candidates on them, interviews and scorecards",
  candidate: "External applicant (self-registered)",
};

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const d = db();
  const role = (["admin", "hr", "hiring", "candidate"] as const).find((r) => r === sp.role);
  const status = sp.status === "inactive" ? "inactive" : sp.status === "all" ? "all" : "active";
  const q = (sp.q ?? "").trim().toLowerCase();
  const users = d.users
    .filter((u) => (role ? u.role === role : u.role !== "candidate"))
    .filter((u) => (status === "all" ? true : status === "active" ? u.active : !u.active))
    .filter((u) => !q || `${u.name} ${u.email} ${u.title ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  const count = (r?: Role) => d.users.filter((u) => (r ? u.role === r : u.role !== "candidate")).length;
  const departments = masterList(d, "department");
  const editing = sp.edit ? d.users.find((u) => u.id === sp.edit) : undefined;

  let reveal: { id: string; pw: string; reset: boolean } | undefined;
  try {
    const raw = (await cookies()).get("abhi_tmp_pw")?.value;
    if (raw && sp.created) {
      const parsed = JSON.parse(raw) as { id: string; pw: string; reset: boolean };
      if (parsed.id === sp.created) reveal = parsed;
    }
  } catch {
    reveal = undefined;
  }
  const revealUser = reveal ? d.users.find((u) => u.id === reveal!.id) : undefined;
  const base = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ role, status: status === "active" ? undefined : status, q: sp.q, ...extra })) if (v) u.set(k, v);
    const s = u.toString();
    return `/admin/users${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="User management"
        subtitle="Give colleagues access, change roles, and switch off accounts for people who have left."
        actions={<Link href={base({ new: "1" })} className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-2">+ Add staff user</Link>}
      />
      <Flash msg={sp.msg} err={sp.err} />

      {reveal && revealUser && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-warn-bg p-4 text-sm">
          <div className="font-semibold">{reveal.reset ? "Password reset" : "User created"}: {revealUser.name}</div>
          <p className="mt-1">
            Temporary password: <code className="rounded bg-white px-2 py-0.5 text-base font-semibold tracking-wide">{reveal.pw}</code>
          </p>
          <p className="mt-1 text-xs text-muted">Share it securely (not by email together with the username). It is shown only now and is not stored anywhere readable. Ask them to change it after signing in.</p>
        </div>
      )}

      {sp.new && (
        <Card title="Add a staff user" className="mb-4" actions={<Link href={base({})} className="text-muted">Cancel</Link>}>
          <form action={createUser} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label><span className="label">Full name</span><input name="name" required className="input" /></label>
            <label><span className="label">Work email</span><input name="email" type="email" required className="input" placeholder="name@abhi.com.pk" /></label>
            <label>
              <span className="label">Role</span>
              <select name="role" className="input" defaultValue="hiring">
                {(["hiring", "hr", "admin"] as const).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </label>
            <label><span className="label">Job title</span><input name="title" className="input" /></label>
            <label>
              <span className="label">Department</span>
              <select name="departmentId" className="input" defaultValue="">
                <option value="">—</option>
                {departments.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <div className="flex items-end"><SubmitButton>Create user</SubmitButton></div>
            <ul className="text-xs text-muted sm:col-span-2 lg:col-span-3">
              {(["hiring", "hr", "admin"] as const).map((r) => <li key={r}><b>{ROLE_LABEL[r]}:</b> {ROLE_HELP[r]}</li>)}
            </ul>
          </form>
        </Card>
      )}

      {editing && (
        <Card title={`Edit ${editing.name}`} className="mb-4" actions={<Link href={base({})} className="text-muted">Close</Link>}>
          <form action={updateUser} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="id" value={editing.id} />
            <label><span className="label">Full name</span><input name="name" defaultValue={editing.name} required className="input" /></label>
            <label>
              <span className="label">Role</span>
              <select name="role" className="input" defaultValue={editing.role} disabled={editing.role === "candidate"}>
                {(editing.role === "candidate" ? (["candidate"] as const) : (["hiring", "hr", "admin"] as const)).map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
              {editing.role === "candidate" && <input type="hidden" name="role" value="candidate" />}
            </label>
            {editing.role !== "candidate" && (
              <>
                <label><span className="label">Job title</span><input name="title" defaultValue={editing.title} className="input" /></label>
                <label>
                  <span className="label">Department</span>
                  <select name="departmentId" className="input" defaultValue={editing.departmentId ?? ""}>
                    <option value="">—</option>
                    {departments.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </label>
              </>
            )}
            <div className="sm:col-span-2 lg:col-span-4"><SubmitButton>Save changes</SubmitButton></div>
          </form>
        </Card>
      )}

      <Tabs
        active={role ?? "staff"}
        tabs={[
          { key: "staff", label: "All staff", href: "/admin/users", count: count() },
          { key: "admin", label: "Administrators", href: "/admin/users?role=admin", count: count("admin") },
          { key: "hr", label: "HR", href: "/admin/users?role=hr", count: count("hr") },
          { key: "hiring", label: "Hiring team", href: "/admin/users?role=hiring", count: count("hiring") },
          { key: "candidate", label: "Candidates", href: "/admin/users?role=candidate", count: count("candidate") },
        ]}
      />
      <form className="mb-3 flex flex-wrap gap-2">
        {role && <input type="hidden" name="role" value={role} />}
        <input name="q" defaultValue={sp.q} placeholder="Search name, email or title" className="input max-w-xs" />
        <select name="status" defaultValue={status} className="input w-auto">
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
          <option value="all">All</option>
        </select>
        <button className="rounded-lg border border-line bg-surface px-3 text-sm">Filter</button>
      </form>

      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>User</th><th>Role</th><th>Department</th><th>Last sign-in</th><th>Status</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.name} size={30} />
                      <div>
                        <div className="font-medium">{u.name}{u.id === me.id && <span className="ml-1 text-xs text-muted">(you)</span>}</div>
                        <div className="text-xs text-muted">{u.email}{u.title ? ` · ${u.title}` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td><Badge tone={u.role === "admin" ? "bad" : u.role === "hr" ? "brand" : u.role === "hiring" ? "info" : "neutral"}>{ROLE_LABEL[u.role]}</Badge></td>
                  <td className="text-sm">{masterName(d, u.departmentId)}</td>
                  <td className="text-xs text-muted" title={fmtDateTime(u.lastLoginAt)}>{u.lastLoginAt ? relative(u.lastLoginAt) : "Never"}</td>
                  <td>{u.active ? <Badge tone="ok">Active</Badge> : <Badge tone="neutral">Deactivated</Badge>}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Link href={base({ edit: u.id })} className="rounded-lg px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand-soft">Edit</Link>
                      <form action={resetPassword}>
                        <input type="hidden" name="id" value={u.id} />
                        <SubmitButton size="sm" variant="ghost" confirm={`Reset the password for ${u.name}? Their current password will stop working.`}>Reset password</SubmitButton>
                      </form>
                      {u.id !== me.id && (
                        <form action={setActive}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="active" value={u.active ? "0" : "1"} />
                          <SubmitButton size="sm" variant={u.active ? "secondary" : "primary"} confirm={u.active ? `Deactivate ${u.name}? They will be signed out and cannot sign in.` : undefined}>
                            {u.active ? "Deactivate" : "Reactivate"}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted">No users match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
