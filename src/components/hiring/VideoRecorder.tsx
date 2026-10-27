"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";

interface Question {
  id: string;
  question: string;
  thinkSeconds: number;
  maxSeconds: number;
}

type Phase = "intro" | "ready" | "thinking" | "recording" | "review" | "uploading" | "done";

function pickMime() {
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  if (typeof MediaRecorder === "undefined") return "";
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

/** One-way video interview: device check, then think → record → review → submit for each question. */
export function VideoRecorder({
  interviewId,
  applicationId,
  questions,
  answered,
  deadline,
}: {
  interviewId: string;
  applicationId: string;
  questions: Question[];
  answered: string[];
  deadline: string;
}) {
  const [done, setDone] = useState<string[]>(answered);
  const [phase, setPhase] = useState<Phase>(answered.length >= questions.length ? "done" : "intro");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [retakes, setRetakes] = useState<Record<string, number>>({});
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const liveRef = useRef<HTMLVideoElement | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = questions.find((q) => !done.includes(q.id));
  const index = current ? questions.indexOf(current) : questions.length;

  const clearTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const attach = useCallback((el: HTMLVideoElement | null) => {
    liveRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      void el.play().catch(() => undefined);
    }
  }, []);

  useEffect(
    () => () => {
      clearTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function startDevices() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
      streamRef.current = stream;
      if (liveRef.current) {
        liveRef.current.srcObject = stream;
        void liveRef.current.play().catch(() => undefined);
      }
      // Simple microphone level meter so candidates can see they are heard.
      try {
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!streamRef.current) return;
          analyser.getByteFrequencyData(data);
          setLevel(Math.min(100, (data.reduce((a, b) => a + b, 0) / data.length) * 2));
          requestAnimationFrame(tick);
        };
        tick();
      } catch {
        /* level meter is optional */
      }
      setPhase("ready");
    } catch {
      setError("We could not access your camera or microphone. Please allow access in your browser and try again.");
    }
  }

  function beginThinking() {
    if (!current) return;
    setBlobUrl(null);
    blobRef.current = null;
    if (current.thinkSeconds <= 0) return startRecording();
    setPhase("thinking");
    setLeft(current.thinkSeconds);
    clearTimer();
    timer.current = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearTimer();
          startRecording();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function startRecording() {
    clearTimer();
    if (!current || !streamRef.current) return;
    chunks.current = [];
    const mimeType = pickMime();
    let rec: MediaRecorder;
    try {
      rec = mimeType ? new MediaRecorder(streamRef.current, { mimeType }) : new MediaRecorder(streamRef.current);
    } catch {
      setError("Your browser cannot record video. Please use a recent Chrome, Edge, Firefox or Safari.");
      return;
    }
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks.current, { type: (rec.mimeType || "video/webm").split(";")[0] });
      blobRef.current = blob;
      setBlobUrl(URL.createObjectURL(blob));
      setPhase("review");
    };
    recRef.current = rec;
    rec.start(1000);
    setPhase("recording");
    setLeft(current.maxSeconds);
    timer.current = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          stopRecording();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function stopRecording() {
    clearTimer();
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }

  function retake() {
    if (!current) return;
    setRetakes((r) => ({ ...r, [current.id]: (r[current.id] ?? 0) + 1 }));
    beginThinking();
  }

  async function submit() {
    if (!current || !blobRef.current) return;
    setPhase("uploading");
    setError(null);
    const fd = new FormData();
    fd.set("questionId", current.id);
    const ext = blobRef.current.type.includes("mp4") ? "mp4" : "webm";
    fd.set("video", new File([blobRef.current], `answer-${index + 1}.${ext}`, { type: blobRef.current.type || "video/webm" }));
    try {
      const res = await fetch(`/api/interviews/${interviewId}/recordings`, { method: "POST", body: fd });
      const json = (await res.json()) as { error?: string; done?: boolean };
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      const next = [...done, current.id];
      setDone(next);
      setBlobUrl(null);
      if (json.done || next.length >= questions.length) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setPhase("done");
      } else setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Please check your connection and try again.");
      setPhase("review");
    }
  }

  if (phase === "done") {
    return (
      <div className="rounded-xl border border-ok/30 bg-ok-bg p-6 text-center">
        <div className="text-3xl">🎉</div>
        <h3 className="mt-2 text-lg font-semibold text-ok">All answers submitted</h3>
        <p className="mt-1 text-sm text-ink">Thank you. The hiring team will review your answers and get back to you.</p>
        <Link href={`/me/feedback?touchpoint=interview&application=${applicationId}`} className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
          Tell us how it went (1 minute)
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">Question {Math.min(index + 1, questions.length)} of {questions.length}</span>
        <span className="text-muted">Deadline: {new Date(deadline).toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" })}</span>
      </div>
      <div className="flex gap-1">
        {questions.map((q) => (
          <span key={q.id} className={clsx("h-1.5 flex-1 rounded-full", done.includes(q.id) ? "bg-brand" : q.id === current?.id ? "bg-brand/40" : "bg-slate-200")} />
        ))}
      </div>

      {error && <div role="alert" className="rounded-lg border border-bad/30 bg-bad-bg px-3 py-2 text-sm text-bad">{error}</div>}

      {phase === "intro" ? (
        <div className="space-y-4 rounded-xl border border-line bg-paper p-4 text-sm">
          <h3 className="font-semibold">Before you start</h3>
          <ul className="list-disc space-y-1 pl-5 text-ink">
            <li>Find a quiet, well-lit place. Use headphones if you can.</li>
            <li>Each question appears on screen with a short time to think. Recording then starts automatically.</li>
            <li>You can watch each answer back and re-record it <strong>once</strong>.</li>
            <li>You can stop between questions and come back later, before the deadline.</li>
          </ul>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
            <span>I agree that ABHI may record my video answers and share them with the hiring panel for this role only. Recordings are deleted under the recruitment retention policy.</span>
          </label>
          <button type="button" disabled={!consent} onClick={startDevices} className="rounded-lg bg-brand px-4 py-2 font-medium text-white disabled:opacity-50">
            Test my camera & microphone
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="relative overflow-hidden rounded-xl bg-black">
              {phase === "review" && blobUrl ? (
                <video key={blobUrl} src={blobUrl} controls className="aspect-video w-full" />
              ) : (
                <video ref={attach} muted playsInline autoPlay className="aspect-video w-full -scale-x-100" />
              )}
              {phase === "recording" && (
                <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-bad px-2.5 py-1 text-xs font-semibold text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> REC {left}s
                </span>
              )}
            </div>
            {phase === "ready" && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                🎙 <div className="h-1.5 flex-1 rounded-full bg-slate-200"><div className="h-full rounded-full bg-ok transition-all" style={{ width: `${level}%` }} /></div>
              </div>
            )}
          </div>
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-line p-4">
            {current && (
              <div>
                <div className="text-xs font-medium uppercase text-muted">Question {index + 1}</div>
                <p className={clsx("mt-1 text-lg font-medium", phase === "ready" && "blur-sm select-none")} aria-hidden={phase === "ready"}>
                  {current.question}
                </p>
                {phase === "ready" && <p className="text-xs text-muted">The question is revealed when you press Start.</p>}
                <p className="mt-2 text-xs text-muted">{current.thinkSeconds}s to think · up to {current.maxSeconds}s to answer</p>
              </div>
            )}
            {phase === "thinking" && (
              <div className="text-center">
                <div className="text-4xl font-semibold tabular-nums text-brand">{left}</div>
                <div className="text-xs text-muted">seconds to think</div>
                <button type="button" onClick={startRecording} className="mt-3 rounded-lg border border-line px-3 py-1.5 text-sm hover:border-brand">I&apos;m ready, start recording</button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {phase === "ready" && (
                <button type="button" onClick={beginThinking} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
                  ▶ Start question {index + 1}
                </button>
              )}
              {phase === "recording" && (
                <button type="button" onClick={stopRecording} className="rounded-lg bg-bad px-4 py-2 text-sm font-medium text-white">
                  ■ Stop recording
                </button>
              )}
              {phase === "review" && current && (
                <>
                  <button type="button" onClick={submit} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
                    ✓ Submit this answer
                  </button>
                  {(retakes[current.id] ?? 0) < 1 && (
                    <button type="button" onClick={retake} className="rounded-lg border border-line px-4 py-2 text-sm hover:border-brand">
                      ↺ Re-record (1 left)
                    </button>
                  )}
                </>
              )}
              {phase === "uploading" && <span className="text-sm text-muted">Uploading your answer…</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
