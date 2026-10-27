import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

export default async function MyHome() {
  const user = await requireUser(["candidate"]);
  return <PageHeader title={`Hello, ${user.name}`} />;
}
