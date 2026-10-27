import { requireAdmin } from "@/lib/auth";
import { InternalShell } from "@/components/shell/InternalShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return <InternalShell user={user}>{children}</InternalShell>;
}
