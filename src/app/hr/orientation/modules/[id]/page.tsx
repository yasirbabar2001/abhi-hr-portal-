import { notFound } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/store";
import { Card, Flash, KeyValue, PageHeader } from "@/components/ui";
import { quizToText, slidesToText } from "@/lib/orientation/text-formats";
import { fmtDate } from "@/lib/format";
import { ModuleForm } from "../../ModuleForm";
import { saveModule } from "../../actions";

export const metadata = { title: "Edit orientation module" };

export default async function EditModule({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSection("/hr/orientation");
  const { id } = await params;
  const sp = await searchParams;
  const d = db();
  const m = d.modules.find((x) => x.id === id);
  if (!m) notFound();
  const file = m.fileId ? d.files.find((f) => f.id === m.fileId) : undefined;
  const progress = d.progress.filter((p) => p.moduleId === m.id);
  const done = progress.filter((p) => p.status === "completed");
  const scores = done.map((p) => p.score).filter((s): s is number => s !== undefined);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div>
        <PageHeader title={m.title} subtitle={`${m.kind.toUpperCase()} module`} back={{ href: "/hr/orientation", label: "Orientation" }} />
        <Flash msg={sp.msg} err={sp.err} />
        <Card>
          <ModuleForm
            action={saveModule}
            values={{
              id: m.id,
              title: m.title,
              kind: m.kind,
              description: m.description,
              points: m.points,
              durationMin: m.durationMin,
              required: m.required,
              active: m.active,
              videoUrl: m.videoUrl,
              slides: slidesToText(m.slides),
              quiz: quizToText(m.quiz?.questions),
              passMark: m.quiz?.passMark ?? d.settings.orientationPassMark,
              hasFile: !!m.fileId,
              fileName: file?.name,
              scormTitle: m.scorm ? (m.scorm.title ?? m.scorm.entry) : undefined,
            }}
          />
        </Card>
      </div>
      <div className="space-y-4 lg:pt-14">
        <Card title="Engagement">
          <KeyValue
            items={[
              ["Started", progress.length],
              ["Completed", done.length],
              ["Average score", scores.length ? `${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}%` : "—"],
              ["Attempts", progress.reduce((s, p) => s + p.attempts, 0)],
              ["Created", fmtDate(m.createdAt)],
            ]}
          />
        </Card>
        {file && (
          <Card title="Current file">
            <a href={`/api/files/${file.id}`} target="_blank" className="text-sm text-brand underline">{file.name}</a>
          </Card>
        )}
      </div>
    </div>
  );
}
