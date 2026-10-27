import { SubmitButton } from "@/components/forms";
import { Badge } from "@/components/ui";
import type { Application, Db } from "@/lib/types";
import { STAGES } from "@/lib/types";
import { masterList } from "@/lib/lookup";
import { moveApplication, rejectApplicationAction } from "@/app/hr/applications/actions";
import { scoreBand } from "@/lib/screening";

/** Back / next stage buttons and a compact reject form, used on cards and rows. */
export function StageControls({ d, app, back, compact = false }: { d: Db; app: Application; back: string; compact?: boolean }) {
  if (app.status !== "active") return null;
  const idx = STAGES.findIndex((s) => s.key === app.stage);
  const prev = idx > 0 ? STAGES[idx - 1] : undefined;
  const next = idx < STAGES.length - 2 ? STAGES[idx + 1] : undefined; // never jump to "hired" manually
  const reasons = masterList(d, "rejection_reason");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {prev && (
        <form action={moveApplication}>
          <input type="hidden" name="id" value={app.id} />
          <input type="hidden" name="stage" value={prev.key} />
          <input type="hidden" name="back" value={back} />
          <SubmitButton size="sm" variant="secondary">← {compact ? "" : prev.label}</SubmitButton>
        </form>
      )}
      {next && (
        <form action={moveApplication}>
          <input type="hidden" name="id" value={app.id} />
          <input type="hidden" name="stage" value={next.key} />
          <input type="hidden" name="back" value={back} />
          <SubmitButton size="sm">{next.label} →</SubmitButton>
        </form>
      )}
      <details className="relative">
        <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-xs font-medium text-bad hover:bg-bad-bg">Decline</summary>
        <form action={rejectApplicationAction} className="absolute right-0 z-20 mt-1 w-64 space-y-2 rounded-lg border border-line bg-surface p-3 shadow-lg">
          <input type="hidden" name="id" value={app.id} />
          <input type="hidden" name="back" value={back} />
          <label className="block">
            <span className="label">Reason</span>
            <select name="reasonId" required className="input">
              <option value="">Choose…</option>
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Internal note (optional)</span>
            <input name="note" className="input" />
          </label>
          <p className="text-[11px] text-muted">The candidate receives a polite, standard message. Your reason stays internal.</p>
          <SubmitButton size="sm" variant="danger">Decline candidate</SubmitButton>
        </form>
      </details>
    </div>
  );
}

export function ScoreBadge({ score }: { score?: number }) {
  if (score === undefined) return <Badge>Not screened</Badge>;
  const band = scoreBand(score);
  return <Badge tone={band.tone}>{score}% · {band.label}</Badge>;
}
