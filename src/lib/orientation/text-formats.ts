import type { QuizQuestion } from "../types";

// Plain-text editors for slides and quizzes, so HR can author content in a textarea.

/** Slides: one block per slide, blocks separated by a blank line. First line "emoji | title", rest is the body. */
export function parseSlides(text: string): { emoji?: string; title: string; body: string }[] {
  return blocks(text).map((lines) => {
    const head = lines[0]!;
    const parts = head.split("|").map((s) => s.trim());
    const [emoji, title] = parts.length >= 2 ? [parts[0] || undefined, parts.slice(1).join(" | ")] : [undefined, parts[0]!];
    return { emoji, title: title || "Untitled", body: lines.slice(1).join("\n") };
  });
}

export function slidesToText(slides: { emoji?: string; title: string; body: string }[] = []): string {
  return slides.map((s) => `${s.emoji ? `${s.emoji} | ` : ""}${s.title}\n${s.body}`).join("\n\n");
}

/** Quiz: one block per question. First line the question, then one option per line; mark the right one with a leading '*'. */
export function parseQuiz(text: string): { questions: QuizQuestion[]; errors: string[] } {
  const errors: string[] = [];
  const questions: QuizQuestion[] = [];
  blocks(text).forEach((lines, i) => {
    const [question, ...opts] = lines;
    const answer = opts.findIndex((o) => o.startsWith("*"));
    const options = opts.map((o) => o.replace(/^\*\s*/, ""));
    if (options.length < 2) errors.push(`Question ${i + 1} needs at least two options.`);
    else if (answer < 0) errors.push(`Question ${i + 1}: mark the correct option with *.`);
    else if (opts.filter((o) => o.startsWith("*")).length > 1) errors.push(`Question ${i + 1}: mark only one option with *.`);
    else questions.push({ id: `q${i + 1}`, question: question!, options, answer });
  });
  return { questions, errors };
}

export function quizToText(questions: QuizQuestion[] = []): string {
  return questions.map((q) => [q.question, ...q.options.map((o, i) => (i === q.answer ? `*${o}` : o))].join("\n")).join("\n\n");
}

function blocks(text: string): string[][] {
  return text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((b) => b.length > 0);
}

/** Convert a YouTube watch/short link to an embeddable URL; null for anything else. */
export function youtubeEmbed(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

/** Find the launch file of a SCORM package from imsmanifest.xml. */
export function scormLaunch(manifest: string): { href: string; title?: string } | null {
  const orgDefault = manifest.match(/<organizations[^>]*default\s*=\s*"([^"]+)"/i)?.[1];
  const itemRef = (() => {
    const orgRe = /<organization\b[^>]*identifier\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/organization>/gi;
    let m: RegExpExecArray | null;
    let first: string | undefined;
    while ((m = orgRe.exec(manifest))) {
      const ref = m[2]!.match(/<item\b[^>]*identifierref\s*=\s*"([^"]+)"/i)?.[1];
      if (!first) first = ref;
      if (m[1] === orgDefault && ref) return ref;
    }
    return first;
  })();
  const title = manifest.match(/<organization\b[^>]*>\s*<title>([^<]*)<\/title>/i)?.[1]?.trim();
  const resRe = /<resource\b([^>]*)>/gi;
  let r: RegExpExecArray | null;
  let fallback: string | undefined;
  while ((r = resRe.exec(manifest))) {
    const attrs = r[1]!;
    const id = attrs.match(/identifier\s*=\s*"([^"]+)"/i)?.[1];
    const href = attrs.match(/href\s*=\s*"([^"]+)"/i)?.[1];
    if (!href) continue;
    if (!fallback) fallback = href;
    if (itemRef && id === itemRef) return { href, title };
  }
  return fallback ? { href: fallback, title } : null;
}
