import { requireInternal } from "@/lib/auth";
import { InternalShell } from "@/components/shell/InternalShell";

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const user = await requireInternal();
  return <InternalShell user={user}>{children}</InternalShell>;
}
