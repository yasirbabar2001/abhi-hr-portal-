// Pure-CSS confetti burst for celebrations. Decorative only.
const COLORS = ["#71c7ac", "#08182e", "#f59e0b", "#2457a6", "#e11d48", "#8b5cf6", "#10b981"];

export function Confetti({ pieces = 60 }: { pieces?: number }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <style>{`@keyframes abhi-fall{0%{transform:translate3d(0,-10vh,0) rotate(0)}100%{transform:translate3d(var(--dx),110vh,0) rotate(720deg)}}
@media (prefers-reduced-motion: reduce){.abhi-confetti{display:none}}`}</style>
      {Array.from({ length: pieces }, (_, i) => {
        const left = (i * 37) % 100;
        const delay = ((i * 13) % 20) / 10;
        const dur = 2.6 + ((i * 7) % 15) / 10;
        const dx = ((i * 29) % 40) - 20;
        return (
          <span
            key={i}
            className="abhi-confetti absolute top-0 block"
            style={{
              left: `${left}%`,
              width: i % 3 ? 8 : 6,
              height: i % 3 ? 12 : 6,
              borderRadius: i % 3 ? 2 : 999,
              background: COLORS[i % COLORS.length],
              animation: `abhi-fall ${dur}s ${delay}s ease-in forwards`,
              ["--dx" as string]: `${dx}vw`,
            }}
          />
        );
      })}
    </div>
  );
}
