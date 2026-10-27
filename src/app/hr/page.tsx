import { requireSection } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

export default async function Dashboard() {
  const user = await requireSection("/hr");
  return <PageHeader title={`Welcome, ${user.name}`} subtitle="Dashboard placeholder" />;
}
