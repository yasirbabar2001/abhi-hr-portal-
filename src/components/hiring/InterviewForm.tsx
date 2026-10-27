"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { SubmitButton } from "@/components/forms";

type Mode = "in_person" | "live_video" | "recorded_video";
interface Busy {
  userId: string;
  start: string;
  durationMin: number;
  label: string;
}

const DEFAULT_QUESTIONS = [
  { question: "Tell us about yourself and why you want to join ABHI.", think: 30, max: 120 },
  { question: "Describe a time you went out of your way for a customer.", think: 30, max: 120 },
  { question: "Why are you a good fit for this role?", think: 30, max: 90 },
];

/** Interview scheduling form with live panel-clash warnings and a question editor. */
export function InterviewForm({
  action,
  applicationId,
  users,
  defaultPanel,
  busy,
  defaultMinutes,
  defaultStart,
  defaultLocation,
  serverClash = false,
}: {
  action: (form: FormData) => void;
  applicationId: string;
  users: { id: string; name: string; title?: string }[];
  defaultPanel: string[];
  busy: Busy[];
  defaultMinutes: number;
  defaultStart: string;
  defaultLocation: string;
  /** The server refused the last attempt because of a clash: offer the override. */
  serverClash?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("live_video");
  const [start, setStart] = useState(defaultStart);
  const [duration, setDuration] = useState(defaultMinutes);
  const [panel, setPanel] = useState<string[]>(defaultPanel);
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [ownLink, setOwnLink] = useState(false);

  const clashes = useMemo(() => {
    if (mode === "recorded_video" || !start) return [];
    const s = new Date(`${start}:00+05:00`).getTime();
    const e = s + duration * 60_000;
    return busy.filter((b) => {
      if (!panel.includes(b.userId)) return false;
      const bs = new Date(b.start).getTime();
      return s < bs + b.durationMin * 60_000 && bs < e;
    });
  }, [busy, panel, start, duration, mode]);

  const modes: { key: Mode; icon: string; title: string; body: string }[] = [
    { key: "live_video", icon: "🎥", title: "Live video", body: "Face to face online. A secure meeting link is created for you." },
    { key: "in_person", icon: "🏢", title: "In person", body: "At a branch or head office. Add the room and address." },
    { key: "recorded_video", icon: "⏺️", title: "Recorded (one-way)", body: "Candidate records answers to your questions any time before a deadline." },
  ];

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="applicationId" value={applicationId} />
      <fieldset>
        <legend className="label">How will the interview happen?</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {modes.map((m) => (
            <label
              key={m.key}
              className={clsx(
                "cursor-pointer rounded-xl border p-3 text-sm transition",
                mode === m.key ? "border-brand bg-brand-soft ring-1 ring-brand" : "border-line bg-surface hover:border-brand/50",
              )}
            >
              <input type="radio" name="mode" value={m.key} checked={mode === m.key} onChange={() => setMode(m.key)} className="sr-only" />
              <div className="text-lg">{m.icon}</div>
              <div className="font-medium">{m.title}</div>
              <div className="text-xs text-muted">{m.body}</div>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Title</span>
          <input name="title" className="input" placeholder={mode === "recorded_video" ? "One-way video interview" : "Panel interview"} />
        </label>
        <label className="block">
          <span className="label">{mode === "recorded_video" ? "Deadline to submit answers" : "Date and time (Pakistan time)"}</span>
          <input type="datetime-local" name="start" required value={start} onChange={(e) => setStart(e.target.value)} className="input" />
        </label>
        {mode !== "recorded_video" && (
          <label className="block">
            <span className="label">Duration (minutes)</span>
            <input type="number" name="durationMin" min={10} max={480} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="input" />
          </label>
        )}
        {mode === "in_person" && (
          <label className="block">
            <span className="label">Location</span>
            <input name="location" required defaultValue={defaultLocation} className="input" placeholder="Branch, floor, meeting room" />
          </label>
        )}
        {mode === "live_video" && (
          <div>
            <span className="label">Meeting link</span>
            {ownLink ? (
              <input name="meetingUrl" type="url" placeholder="https://teams.microsoft.com/… or https://zoom.us/…" className="input" />
            ) : (
              <div className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted">A private Jitsi Meet room will be created automatically.</div>
            )}
            <button type="button" onClick={() => setOwnLink((v) => !v)} className="mt-1 text-xs text-brand underline">
              {ownLink ? "Use an automatic link instead" : "Use my own Teams / Zoom / Meet link"}
            </button>
          </div>
        )}
      </div>

      {mode === "recorded_video" && (
        <fieldset className="rounded-xl border border-line p-4">
          <legend className="px-1 text-sm font-semibold">Questions</legend>
          <p className="mb-3 text-xs text-muted">Each question shows on screen, then the candidate gets thinking time before recording starts. They can re-record each answer once.</p>
          <ol className="space-y-3">
            {questions.map((q, i) => (
              <li key={i} className="grid gap-2 sm:grid-cols-[1fr_110px_110px_auto] sm:items-end">
                <label className="block">
                  <span className="label">Question {i + 1}</span>
                  <input
                    name="q_question"
                    value={q.question}
                    onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
                    className="input"
                  />
                </label>
                <label className="block">
                  <span className="label">Think (sec)</span>
                  <input name="q_think" type="number" min={0} max={300} value={q.think} onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, think: Number(e.target.value) } : x)))} className="input" />
                </label>
                <label className="block">
                  <span className="label">Answer (sec)</span>
                  <input name="q_max" type="number" min={15} max={600} value={q.max} onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, max: Number(e.target.value) } : x)))} className="input" />
                </label>
                <button type="button" onClick={() => setQuestions(questions.filter((_, j) => j !== i))} className="rounded-lg px-2 py-2 text-sm text-bad hover:bg-bad-bg" aria-label={`Remove question ${i + 1}`}>
                  ✕
                </button>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setQuestions([...questions, { question: "", think: 30, max: 120 }])} className="mt-3 text-sm font-medium text-brand">
            + Add question
          </button>
        </fieldset>
      )}

      <fieldset>
        <legend className="label">{mode === "recorded_video" ? "Reviewers (they will score the recordings)" : "Interview panel"}</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <label key={u.id} className={clsx("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", panel.includes(u.id) ? "border-brand bg-brand-soft" : "border-line bg-surface")}>
              <input
                type="checkbox"
                name="panel"
                value={u.id}
                checked={panel.includes(u.id)}
                onChange={(e) => setPanel(e.target.checked ? [...panel, u.id] : panel.filter((p) => p !== u.id))}
              />
              <span>
                {u.name}
                {u.title && <span className="block text-xs text-muted">{u.title}</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {serverClash && clashes.length === 0 && mode !== "recorded_video" && (
        <label className="flex items-center gap-2 rounded-lg border border-warn/30 bg-warn-bg p-3 text-sm text-warn">
          <input type="checkbox" name="allowConflict" value="1" /> Schedule anyway, even if a panel member is already booked
        </label>
      )}
      {clashes.length > 0 && (
        <div className="rounded-lg border border-warn/30 bg-warn-bg p-3 text-sm text-warn" role="alert">
          <div className="font-medium">⚠ Calendar clash</div>
          <ul className="mt-1 list-disc pl-5">
            {clashes.map((c, i) => (
              <li key={i}>{c.label}</li>
            ))}
          </ul>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" name="allowConflict" value="1" /> Schedule anyway
          </label>
        </div>
      )}

      <label className="block">
        <span className="label">Message to the candidate (optional)</span>
        <textarea name="instructions" className="input" placeholder="e.g. Please bring your CNIC and original degrees." />
      </label>

      <div className="flex gap-2">
        <SubmitButton>Schedule & notify</SubmitButton>
      </div>
    </form>
  );
}
