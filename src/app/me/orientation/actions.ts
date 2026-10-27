"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db, mutate } from "@/lib/store";
import { buildJourney, canTakeOrientation, hireForUser, scoreQuiz } from "@/lib/orientation/journey";
import { completeOrientationIfDone, recordProgress } from "@/lib/orientation/complete";

async function context(moduleId: string) {
  const user = await requireUser(["candidate"]);
  const d = db();
  const hire = hireForUser(d, user.id);
  if (!canTakeOrientation(hire)) redirect("/me/orientation");
  const step = buildJourney(d, hire).steps.find((s) => s.module.id === moduleId);
  if (!step) redirect("/me/orientation?err=That+module+is+not+available.");
  if (!step.unlocked) redirect("/me/orientation?err=Finish+the+earlier+modules+first.");
  return { user, hire, module: step.module };
}

/** Completion for read / watch / slide modules (the client only offers it once the content is consumed). */
export async function completeModule(form: FormData) {
  const moduleId = String(form.get("moduleId"));
  const { user, hire, module } = await context(moduleId);
  if (module.kind === "quiz" || module.kind === "scorm") redirect(`/me/orientation/${moduleId}`);
  const employeeNo = mutate((d) => {
    const h = d.hires.find((x) => x.id === hire.id)!;
    const before = d.progress.find((p) => p.hireId === h.id && p.moduleId === moduleId)?.status;
    recordProgress(d, h, moduleId, { completed: true, attempt: true });
    if (before !== "completed") audit(d, user, "orientation.module_complete", "orientation", moduleId, `${h.name} completed “${module.title}”`);
    return completeOrientationIfDone(d, h, user);
  });
  redirect(`/me/orientation?done=${moduleId}${employeeNo ? "&celebrate=1" : ""}`);
}

export interface QuizState {
  submitted: boolean;
  score?: number;
  passed?: boolean;
  passMark?: number;
  answers?: Record<string, number>;
  correct?: Record<string, number>;
  employeeNo?: string | null;
  error?: string;
}

export async function submitQuiz(_prev: QuizState, form: FormData): Promise<QuizState> {
  const moduleId = String(form.get("moduleId"));
  const { user, hire, module } = await context(moduleId);
  const quiz = module.quiz;
  if (module.kind !== "quiz" || !quiz) return { submitted: false, error: "This module is not a quiz." };
  const answers: Record<string, number> = {};
  for (const q of quiz.questions) {
    const v = form.get(q.id);
    if (v === null) return { submitted: false, error: "Please answer every question." };
    answers[q.id] = Number(v);
  }
  const score = scoreQuiz(quiz.questions, answers);
  const passed = score >= quiz.passMark;
  const employeeNo = mutate((d) => {
    const h = d.hires.find((x) => x.id === hire.id)!;
    const before = d.progress.find((p) => p.hireId === h.id && p.moduleId === moduleId)?.status;
    recordProgress(d, h, moduleId, { attempt: true, score, completed: passed });
    audit(d, user, passed ? "orientation.quiz_pass" : "orientation.quiz_fail", "orientation", moduleId, `${h.name} scored ${score}% on “${module.title}”`);
    if (passed && score === 100 && !h.badges.includes("Perfect score")) h.badges.push("Perfect score");
    void before;
    return completeOrientationIfDone(d, h, user);
  });
  return {
    submitted: true,
    score,
    passed,
    passMark: quiz.passMark,
    answers,
    correct: Object.fromEntries(quiz.questions.map((q) => [q.id, q.answer])),
    employeeNo,
  };
}
