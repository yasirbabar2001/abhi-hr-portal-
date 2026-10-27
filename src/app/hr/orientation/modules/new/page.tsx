import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { Card, Flash, PageHeader } from "@/components/ui";
import { ModuleForm } from "../../ModuleForm";
import { saveModule } from "../../actions";

export const metadata = { title: "New orientation module" };

export default async function NewModule({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSection("/hr/orientation");
  const sp = await searchParams;
  return (
    <div className="max-w-4xl">
      <PageHeader title="Add orientation module" back={{ href: "/hr/orientation", label: "Orientation" }} />
      <Flash err={sp.err} />
      <Card>
        <ModuleForm
          action={saveModule}
          values={{ title: "", kind: "presentation", description: "", points: 100, durationMin: 10, required: true, active: true, slides: "", quiz: "", passMark: db().settings.orientationPassMark, hasFile: false }}
        />
      </Card>
    </div>
  );
}
