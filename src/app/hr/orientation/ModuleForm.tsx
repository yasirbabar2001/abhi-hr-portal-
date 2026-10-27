"use client";
import { useState } from "react";
import type { ModuleKind } from "@/lib/types";
import { SubmitButton } from "@/components/forms";

export interface ModuleFormValues {
  id?: string;
  title: string;
  kind: ModuleKind;
  description: string;
  points: number;
  durationMin: number;
  required: boolean;
  active: boolean;
  videoUrl?: string;
  slides: string;
  quiz: string;
  passMark: number;
  hasFile: boolean;
  fileName?: string;
  scormTitle?: string;
}

const KIND_INFO: Record<ModuleKind, { label: string; icon: string; hint: string }> = {
  presentation: { label: "Presentation", icon: "🎞️", hint: "Slide-by-slide story, great for welcome and culture." },
  pdf: { label: "PDF document", icon: "📄", hint: "Policies to read and acknowledge." },
  video: { label: "Video", icon: "🎬", hint: "Upload an MP4 or paste a YouTube / video link." },
  quiz: { label: "Quiz", icon: "❓", hint: "Multiple-choice check with a pass mark." },
  scorm: { label: "SCORM course", icon: "📦", hint: "Upload a SCORM 1.2 .zip from your e-learning tool." },
};

export function ModuleForm({ action, values }: { action: (f: FormData) => Promise<void>; values: ModuleFormValues }) {
  const [kind, setKind] = useState<ModuleKind>(values.kind);
  return (
    <form action={action} className="space-y-6">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <fieldset>
        <legend className="label">Module type</legend>
        <div className="grid gap-2 sm:grid-cols-5">
          {(Object.keys(KIND_INFO) as ModuleKind[]).map((k) => (
            <label
              key={k}
              className={`cursor-pointer rounded-lg border p-3 text-sm transition ${kind === k ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand/50"}`}
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              <span className="block text-xl" aria-hidden>{KIND_INFO[k].icon}</span>
              <span className="block font-medium">{KIND_INFO[k].label}</span>
              <span className="block text-xs text-muted">{KIND_INFO[k].hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="label">Title</span><input name="title" required defaultValue={values.title} className="input" /></label>
        <label className="sm:col-span-2"><span className="label">Short description (shown to the new hire)</span><textarea name="description" defaultValue={values.description} className="input" /></label>
        <label><span className="label">Points awarded</span><input name="points" type="number" min={0} defaultValue={values.points} className="input" /></label>
        <label><span className="label">Estimated minutes</span><input name="durationMin" type="number" min={1} defaultValue={values.durationMin} className="input" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="required" defaultChecked={values.required} /> Required to earn the employee ID</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={values.active} /> Active (visible to new hires)</label>
      </div>

      {(kind === "pdf" || kind === "presentation") && (
        <label className="block">
          <span className="label">{kind === "pdf" ? "PDF document" : "Optional: presentation exported as PDF"}</span>
          <input type="file" name="file" accept="application/pdf" className="input" />
          <span className="hint block">{values.hasFile ? `Current file: ${values.fileName ?? "uploaded"}. Upload again to replace it.` : "Up to 50 MB."}</span>
        </label>
      )}
      {kind === "video" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="label">Video link (YouTube or .mp4)</span><input name="videoUrl" defaultValue={values.videoUrl} className="input" placeholder="https://…" /></label>
          <label>
            <span className="label">Or upload a video</span>
            <input type="file" name="file" accept="video/mp4,video/webm" className="input" />
            <span className="hint block">{values.hasFile ? `Current file: ${values.fileName ?? "uploaded"}.` : "MP4 or WebM, up to 50 MB."}</span>
          </label>
        </div>
      )}
      {kind === "presentation" && (
        <label className="block">
          <span className="label">Slides</span>
          <textarea name="slides" defaultValue={values.slides} className="input font-mono" rows={12} />
          <span className="hint block">One slide per block, separated by a blank line. First line: <code>emoji | Title</code>; following lines are the slide text.</span>
        </label>
      )}
      {kind === "quiz" && (
        <div className="space-y-4">
          <label className="block max-w-xs"><span className="label">Pass mark (%)</span><input name="passMark" type="number" min={1} max={100} defaultValue={values.passMark} className="input" /></label>
          <label className="block">
            <span className="label">Questions</span>
            <textarea name="quiz" defaultValue={values.quiz} className="input font-mono" rows={14} placeholder={"What does KYC stand for?\nKeep Your Cash\n*Know Your Customer\nKey Yield Calculation"} />
            <span className="hint block">One question per block, separated by a blank line. First line is the question, then one option per line. Put <code>*</code> before the correct option.</span>
          </label>
        </div>
      )}
      {kind === "scorm" && (
        <label className="block">
          <span className="label">SCORM 1.2 package (.zip)</span>
          <input type="file" name="scormZip" accept=".zip,application/zip" className="input" />
          <span className="hint block">
            {values.scormTitle ? `Current package: ${values.scormTitle}. Upload a new zip to replace it.` : "No package uploaded yet: the built-in Information Security sample course will run."} Completion and score are recorded automatically.
          </span>
        </label>
      )}
      <SubmitButton>Save module</SubmitButton>
    </form>
  );
}
