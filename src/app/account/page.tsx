import { requireUser, isInternal } from "@/lib/auth";
import { Card, Flash, KeyValue, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { InternalShell } from "@/components/shell/InternalShell";
import { PublicShell } from "@/components/shell/PublicShell";
import { ROLE_LABEL } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import { changePassword } from "./actions";

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const body = (
    <div className="max-w-2xl">
      <PageHeader title="My account" />
      <Flash msg={sp.msg} err={sp.err} />
      <div className="space-y-4">
        <Card title="Details">
          <KeyValue items={[["Name", user.name], ["Email", user.email], ["Role", ROLE_LABEL[user.role]], ["Last sign-in", fmtDateTime(user.lastLoginAt)]]} />
        </Card>
        <Card title="Change password">
          <form action={changePassword} className="grid gap-4 sm:grid-cols-3">
            <label><span className="label">Current</span><input type="password" name="current" required className="input" autoComplete="current-password" /></label>
            <label><span className="label">New</span><input type="password" name="next" required className="input" autoComplete="new-password" /></label>
            <label><span className="label">Confirm new</span><input type="password" name="confirm" required className="input" autoComplete="new-password" /></label>
            <div className="sm:col-span-3"><SubmitButton>Update password</SubmitButton></div>
          </form>
        </Card>
      </div>
    </div>
  );
  return isInternal(user) ? <InternalShell user={user}>{body}</InternalShell> : <PublicShell>{body}</PublicShell>;
}
