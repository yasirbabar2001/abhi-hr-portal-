"use client";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { SubmitButton } from "@/components/forms";
import type { QuizState } from "./actions";

function CompleteForm({ action, moduleId, label = "Mark as complete", disabled }: { action: (f: FormData) => Promise<void>; moduleId: string; label?: string; disabled?: boolean }) {
  return (
    <form action={action}>
      <input type="hidden" name="moduleId" value={moduleId} />
      {disabled ? (
        <button type="button" disabled className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white opacity-50">{label}</button>
      ) : (
        <SubmitButton>{label}</SubmitButton>
      )}
    </form>
  );
}

export function SlidePlayer({
  slides,
  moduleId,
  action,
  completed,
}: {
  slides: { emoji?: string; title: string; body: string }[];
  moduleId: string;
  action: (f: FormData) => Promise<void>;
  completed: boolean;
}) {
  const [i, setI] = useState(0);
  const last = slides.length - 1;
  const go = useCallback((n: number) => setI((cur) => Math.max(0, Math.min(last, cur + n))), [last]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);
  const s = slides[i]!;
  return (
    <div>
      <div className="relative flex min-h-80 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-brand-soft to-white p-8 text-center shadow-inner" aria-live="polite">
        <div className="absolute right-4 top-3 text-xs text-muted">{i + 1} / {slides.length}</div>
        {s.emoji && <div className="mb-3 text-5xl" aria-hidden>{s.emoji}</div>}
        <h2 className="text-2xl font-semibold text-ink">{s.title}</h2>
        <p className="mt-3 max-w-xl whitespace-pre-line text-base leading-relaxed text-muted">{s.body}</p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" onClick={() => go(-1)} disabled={i === 0} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm disabled:opacity-40">← Back</button>
        <div className="flex gap-1.5" role="tablist" aria-label="Slides">
          {slides.map((x, n) => (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={n === i}
              aria-label={`Slide ${n + 1}: ${x.title}`}
              onClick={() => setI(n)}
              className={clsx("h-2.5 rounded-full transition-all", n === i ? "w-6 bg-brand" : n < i ? "w-2.5 bg-brand/50" : "w-2.5 bg-line")}
            />
          ))}
        </div>
        {i < last ? (
          <button type="button" onClick={() => go(1)} className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white">Next →</button>
        ) : completed ? (
          <Link href="/me/orientation" className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white">Back to journey</Link>
        ) : (
          <CompleteForm action={action} moduleId={moduleId} label="Finish 🎉" />
        )}
      </div>
      <p className="mt-2 text-center text-xs text-muted">Tip: use ← → keys to move between slides.</p>
    </div>
  );
}

export function VideoPlayer({
  src,
  moduleId,
  action,
  completed,
}: {
  src: string;
  moduleId: string;
  action: (f: FormData) => Promise<void>;
  completed: boolean;
}) {
  const watched = useRef(0);
  const [pct, setPct] = useState(completed ? 100 : 0);
  return (
    <div>
      <video
        src={src}
        controls
        playsInline
        className="w-full rounded-xl bg-black"
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          // only count forward progress made by watching, not by seeking far ahead
          if (v.currentTime - watched.current < 2.5) watched.current = Math.max(watched.current, v.currentTime);
          if (v.duration) setPct((p) => Math.max(p, Math.round((watched.current / v.duration) * 100)));
        }}
        onEnded={(e) => {
          if (e.currentTarget.duration - watched.current < 2.5) setPct(100);
        }}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted">{completed ? "Completed ✓" : pct >= 90 ? "Great, you watched it all." : `Watched ${pct}%. Watch at least 90% to complete.`}</div>
        {!completed && <CompleteForm action={action} moduleId={moduleId} disabled={pct < 90} />}
      </div>
    </div>
  );
}

export function ConfirmComplete({ moduleId, action, statement }: { moduleId: string; action: (f: FormData) => Promise<void>; statement: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-1" />
        <span>{statement}</span>
      </label>
      <CompleteForm action={action} moduleId={moduleId} disabled={!ok} label="Confirm & complete" />
    </div>
  );
}

export function QuizPlayer({
  moduleId,
  questions,
  passMark,
  action,
  attempts,
  bestScore,
}: {
  moduleId: string;
  questions: { id: string; question: string; options: string[] }[];
  passMark: number;
  action: (prev: QuizState, f: FormData) => Promise<QuizState>;
  attempts: number;
  bestScore?: number;
}) {
  const [state, formAction, pending] = useActionState(action, { submitted: false });
  const [key, setKey] = useState(0);
  const [dismissed, setDismissed] = useState<QuizState | null>(null);
  const result = state.submitted && state !== dismissed ? state : null;
  return (
    <div>
      {result && (
        <div className={clsx("mb-5 rounded-xl p-4", result.passed ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn")} role="status">
          <div className="text-lg font-semibold">{result.passed ? `🎉 You passed with ${result.score}%` : `You scored ${result.score}%`}</div>
          <div className="text-sm">
            {result.passed
              ? result.employeeNo
                ? `Orientation complete! Your employee ID is ${result.employeeNo}.`
                : "Points added to your journey."
              : `The pass mark is ${result.passMark}%. Review the correct answers below and try again.`}
          </div>
          <div className="mt-3 flex gap-2">
            <Link href={result.employeeNo ? "/me/orientation?celebrate=1" : "/me/orientation"} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white">Back to journey</Link>
            {!result.passed && (
              <button type="button" className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink" onClick={() => {
                  setDismissed(state);
                  setKey((k) => k + 1);
                }}>
                Try again
              </button>
            )}
          </div>
        </div>
      )}
      {state.error && <div className="mb-4 rounded-lg bg-bad-bg px-4 py-2 text-sm text-bad">{state.error}</div>}
      <form key={key} action={formAction} className="space-y-4">
        <input type="hidden" name="moduleId" value={moduleId} />
        <p className="text-sm text-muted">
          {questions.length} questions · pass mark {passMark}% · attempts so far {attempts}
          {bestScore !== undefined && ` · best score ${bestScore}%`}
        </p>
        {questions.map((q, n) => {
          const chosen = result?.answers?.[q.id];
          const right = result?.correct?.[q.id];
          return (
            <fieldset key={q.id} className="rounded-xl border border-line bg-surface p-4">
              <legend className="px-1 text-sm font-semibold">{n + 1}. {q.question}</legend>
              <div className="mt-2 space-y-1.5">
                {q.options.map((o, i) => (
                  <label
                    key={i}
                    className={clsx(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                      right === i ? "border-ok bg-ok-bg" : chosen === i ? "border-bad bg-bad-bg" : "border-line hover:border-brand/50",
                    )}
                  >
                    <input type="radio" name={q.id} value={i} required defaultChecked={chosen === i} disabled={!!result} />
                    {o}
                    {right === i && <span className="ml-auto text-xs font-medium text-ok">Correct answer</span>}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
        {!result && (
          <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {pending ? "Checking…" : "Submit answers"}
          </button>
        )}
      </form>
    </div>
  );
}

type ScormApi = Record<string, (...args: string[]) => string>;

/** Hosts a SCORM 1.2 course in an iframe and exposes window.API to it. */
export function ScormPlayer({
  moduleId,
  src,
  initial,
  studentId,
  studentName,
  completed,
}: {
  moduleId: string;
  src: string;
  initial: Record<string, string>;
  studentId: string;
  studentName: string;
  completed: boolean;
}) {
  const data = useRef<Record<string, string>>({});
  const [status, setStatus] = useState<{ done: boolean; score?: number; employeeNo?: string | null; saving?: boolean }>({ done: completed });
  const lastError = useRef("0");
  const defaults = useMemo(
    () => ({
      "cmi.core.student_id": studentId,
      "cmi.core.student_name": studentName,
      "cmi.core.lesson_status": "not attempted",
      "cmi.core.lesson_location": "",
      "cmi.core.credit": "credit",
      "cmi.core.lesson_mode": "normal",
      "cmi.core.score.raw": "",
      "cmi.core.score.min": "",
      "cmi.core.score.max": "",
      "cmi.core.total_time": "0000:00:00",
      "cmi.suspend_data": "",
      "cmi.launch_data": "",
      ...initial,
      "cmi.core.entry": initial["cmi.core.lesson_location"] || initial["cmi.suspend_data"] ? "resume" : "ab-initio",
    }),
    [initial, studentId, studentName],
  );

  useEffect(() => {
    data.current = { ...defaults };
    const dirty: Record<string, string> = {};
    const commit = async () => {
      const payload = { ...dirty };
      for (const k of Object.keys(dirty)) delete dirty[k];
      if (!Object.keys(payload).length) return;
      setStatus((s) => ({ ...s, saving: true }));
      try {
        const res = await fetch(`/api/orientation/scorm/${moduleId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: payload }),
          keepalive: true,
        });
        const json = (await res.json()) as { status?: string; score?: number; employeeNo?: string | null };
        setStatus((s) => ({ done: s.done || json.status === "completed", score: json.score, employeeNo: json.employeeNo ?? s.employeeNo, saving: false }));
      } catch {
        setStatus((s) => ({ ...s, saving: false }));
      }
    };
    const readOnly = new Set(["cmi.core.student_id", "cmi.core.student_name", "cmi.core.credit", "cmi.core.entry", "cmi.core.total_time", "cmi.core.lesson_mode", "cmi.launch_data"]);
    const api: ScormApi = {
      LMSInitialize: () => ((lastError.current = "0"), "true"),
      LMSFinish: () => {
        void commit();
        return "true";
      },
      LMSGetValue: (key) => {
        lastError.current = "0";
        if (key === "cmi.core._children") return "student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time";
        if (key === "cmi.core.score._children") return "raw,min,max";
        if (key in data.current) return data.current[key]!;
        if (key.startsWith("cmi.")) return "";
        lastError.current = "401";
        return "";
      },
      LMSSetValue: (key, value) => {
        if (readOnly.has(key)) {
          lastError.current = "403";
          return "false";
        }
        lastError.current = "0";
        data.current[key] = String(value);
        dirty[key] = String(value);
        return "true";
      },
      LMSCommit: () => {
        void commit();
        return "true";
      },
      LMSGetLastError: () => lastError.current,
      LMSGetErrorString: (code) => ({ "0": "No error", "401": "Not implemented", "403": "Element is read only" })[code] ?? "Unknown error",
      LMSGetDiagnostic: (code) => `SCORM error ${code || lastError.current}`,
    };
    (window as unknown as { API: ScormApi }).API = api;
    const flush = () => void commit();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
      delete (window as unknown as { API?: ScormApi }).API;
    };
  }, [defaults, moduleId]);

  return (
    <div>
      {status.done && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ok-bg px-4 py-3 text-sm text-ok" role="status">
          <span>
            ✓ Course complete{status.score !== undefined ? ` · score ${status.score}%` : ""}
            {status.employeeNo ? ` · your employee ID is ${status.employeeNo}` : ""}
          </span>
          <Link href={status.employeeNo ? "/me/orientation?celebrate=1" : "/me/orientation"} className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white">Back to journey</Link>
        </div>
      )}
      <iframe src={src} title="SCORM course" className="h-[70vh] min-h-[480px] w-full rounded-xl border border-line bg-white" />
      <p className="mt-2 text-xs text-muted">{status.saving ? "Saving progress…" : "Your progress is saved automatically."}</p>
    </div>
  );
}
