import { requireUser } from "@/lib/auth";
import { PublicShell } from "@/components/shell/PublicShell";

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  await requireUser(["candidate"]);
  return <PublicShell candidateNav>{children}</PublicShell>;
}
