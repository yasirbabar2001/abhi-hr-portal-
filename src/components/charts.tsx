import clsx from "clsx";

// Lightweight SVG/CSS charts. Every chart also exposes its numbers as text so
// values can be read without hovering, and screen readers get a summary.

const PALETTE = ["#0e7c66", "#2457a6", "#c07a12", "#8a4fbf", "#c2410c", "#0f766e", "#64748b"];

export function BarList({
  items,
  format = (n: number) => n.toLocaleString(),
  max,
}: {
  items: { label: string; value: number; hint?: string }[];
  format?: (n: number) => string;
  max?: number;
}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate text-ink">{i.label}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {format(i.value)}
              {i.hint && <span className="ml-1 text-xs">{i.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand" style={{ width: `${(i.value / top) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Recruitment funnel: each bar shows count and conversion from the previous step. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ul className="space-y-1.5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1]!.value : undefined;
        const conv = prev ? Math.round((s.value / Math.max(1, prev)) * 100) : undefined;
        return (
          <li key={s.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-right text-xs text-muted">{s.label}</span>
            <div className="relative h-7 flex-1">
              <div
                className="mx-auto flex h-full items-center justify-center rounded bg-brand text-xs font-semibold text-white"
                style={{ width: `${Math.max(8, (s.value / top) * 100)}%`, opacity: 1 - i * 0.08 }}
              >
                {s.value}
              </div>
            </div>
            <span className="w-12 shrink-0 text-xs tabular-nums text-muted">{conv !== undefined ? `${conv}%` : ""}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function Donut({
  parts,
  size = 140,
  center,
}: {
  parts: { label: string; value: number; color?: string }[];
  size?: number;
  center?: React.ReactNode;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const r = 15.9155;
  const pcts = parts.map((p) => (p.value / total) * 100);
  const offsets = pcts.map((_, i) => 25 - pcts.slice(0, i).reduce((s, x) => s + x, 0));
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 42 42" width={size} height={size} role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
          <circle cx="21" cy="21" r={r} fill="none" stroke="#eef2f4" strokeWidth="5" />
          {parts.map((p, i) => {
            const pct = pcts[i]!;
            return (
              <circle
                key={p.label}
                cx="21"
                cy="21"
                r={r}
                fill="none"
                stroke={p.color ?? PALETTE[i % PALETTE.length]}
                strokeWidth="5"
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeDashoffset={offsets[i]}
              />
            );
          })}
        </svg>
        {center && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
      </div>
      <ul className="space-y-1 text-sm">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color ?? PALETTE[i % PALETTE.length] }} />
            <span className="text-ink">{p.label}</span>
            <span className="tabular-nums text-muted">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vertical columns, optionally with a second "target" value drawn as an outline. */
export function Columns({
  items,
  height = 160,
  format = (n: number) => n.toLocaleString(),
}: {
  items: { label: string; value: number; target?: number }[];
  height?: number;
  format?: (n: number) => string;
}) {
  const top = Math.max(1, ...items.map((i) => Math.max(i.value, i.target ?? 0)));
  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ height: height + 40 }}>
      {items.map((i) => (
        <div key={i.label} className="flex min-w-10 flex-1 flex-col items-center gap-1">
          <span className="text-[11px] tabular-nums text-muted">{format(i.value)}</span>
          <div className="relative flex w-full justify-center" style={{ height }}>
            {i.target !== undefined && (
              <div className="absolute bottom-0 w-3/4 rounded-t border-2 border-dashed border-slate-300" style={{ height: (i.target / top) * height }} />
            )}
            <div className="absolute bottom-0 w-1/2 rounded-t bg-brand" style={{ height: (i.value / top) * height }} />
          </div>
          <span className="w-full truncate text-center text-[11px] text-muted" title={i.label}>
            {i.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 100},${30 - (v / max) * 28}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" className={clsx("h-8 w-full", className)} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="#0e7c66" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Gauge({ value, label }: { value: number; label: string }) {
  // NPS-style gauge from -100 to 100
  const pct = (value + 100) / 2;
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className={clsx("text-3xl font-semibold tabular-nums", value >= 30 ? "text-ok" : value >= 0 ? "text-warn" : "text-bad")}>{value}</span>
        <span className="text-sm text-muted">{label}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-gradient-to-r from-red-300 via-amber-200 to-emerald-300">
        <div className="relative h-full">
          <span className="absolute -top-1 h-4 w-1 rounded bg-ink" style={{ left: `calc(${pct}% - 2px)` }} />
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>-100</span>
        <span>0</span>
        <span>+100</span>
      </div>
    </div>
  );
}
