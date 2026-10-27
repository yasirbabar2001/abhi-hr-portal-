import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { Flash, PageHeader } from "@/components/ui";
import { JdForm } from "../JdForm";

export const metadata = { title: "New job description" };

export default async function NewJd({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/job-descriptions");
  const sp = await searchParams;
  return (
    <div className="max-w-4xl">
      <PageHeader title="New job description" subtitle="Write it once, reuse it for every requisition and posting." back={{ href: "/hr/job-descriptions", label: "Job description bank" }} />
      <Flash err={sp.err} />
      <JdForm d={db()} />
    </div>
  );
}
