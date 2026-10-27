import type { AppointmentLetter, Db } from "../types";
import { fmtDateTime } from "../format";
import { letterBody } from "./letter";

/** A4 printable appointment letter on bank letterhead. */
export function LetterView({ d, letter }: { d: Db; letter: AppointmentLetter }) {
  const s = d.settings;
  const paras = letterBody(d, letter).split(/\n{2,}/);
  return (
    <article className="print-area mx-auto max-w-[210mm] rounded-xl border border-line bg-white p-8 text-[13.5px] leading-relaxed shadow-sm sm:p-12">
      <header className="mb-8 flex items-end justify-between border-b-2 border-brand pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-lg font-bold text-white">A</span>
          <div>
            <div className="text-lg font-bold text-brand">{s.companyName}</div>
            <div className="text-xs text-muted">Human Resources Division</div>
          </div>
        </div>
        <div className="text-right text-xs text-muted">STRICTLY PRIVATE & CONFIDENTIAL</div>
      </header>
      {paras.map((p, i) => {
        const [first, ...rest] = p.split("\n");
        const heading = /^\d+\.\s/.test(first ?? "") || (first ?? "").startsWith("Subject:");
        return (
          <div key={i} className="mb-3 whitespace-pre-line">
            {heading ? (
              <>
                <div className="font-semibold">{first}</div>
                {rest.length > 0 && <div>{rest.join("\n")}</div>}
              </>
            ) : (
              p
            )}
          </div>
        );
      })}
      <footer className="mt-10 border-t border-line pt-4 text-xs">
        {letter.status === "acknowledged" ? (
          <div className="rounded-lg border border-ok/40 bg-ok-bg p-3">
            Acknowledged and accepted electronically by <span className="font-serif text-sm italic">{letter.acknowledgedName}</span> on {fmtDateTime(letter.acknowledgedAt)}.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-8 pt-6 text-muted">
            <div className="border-t border-dashed border-slate-400 pt-1">Employee signature</div>
            <div className="border-t border-dashed border-slate-400 pt-1">Date</div>
          </div>
        )}
      </footer>
    </article>
  );
}
