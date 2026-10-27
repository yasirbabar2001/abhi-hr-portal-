import Link from "next/link";
import clsx from "clsx";
import type { ApprovalStep } from "@/lib/types";
import { fmtDateTime, humanize, initials } from "@/lib/format";

// Shared presentational components (server-safe: no hooks).

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-block text-sm text-muted hover:text-brand">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
  className,
  pad = true,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={clsx("rounded-xl border border-line bg-surface shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {actions && <div className="flex items-center gap-2 text-sm">{actions}</div>}
        </header>
      )}
      <div className={clsx(pad && "p-4")}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "ok" | "warn" | "bad" | "brand";
  href?: string;
}) {
  const inner = (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:border-brand/40">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div
        className={clsx(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
          tone === "bad" && "text-bad",
          tone === "brand" && "text-brand",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "brand";
const toneClass: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
  info: "bg-info-bg text-info",
  neutral: "bg-slate-100 text-slate-700",
  brand: "bg-brand-soft text-brand-2",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", toneClass[tone])}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  approved: "ok",
  open: "ok",
  active: "ok",
  completed: "ok",
  accepted: "ok",
  clear: "ok",
  verified: "ok",
  hired: "ok",
  confirmed: "ok",
  applied: "info",
  issued: "info",
  acknowledged: "ok",
  received: "info",
  sent: "info",
  submitted: "info",
  scheduled: "info",
  in_progress: "info",
  orientation: "info",
  onboarding: "info",
  preboarding: "info",
  pending: "warn",
  pending_approval: "warn",
  requested: "warn",
  awaiting_consent: "warn",
  on_hold: "warn",
  probation: "warn",
  contract: "neutral",
  draft: "neutral",
  closed: "neutral",
  not_started: "neutral",
  archived: "neutral",
  filled: "brand",
  rejected: "bad",
  declined: "bad",
  withdrawn: "bad",
  cancelled: "bad",
  adverse: "bad",
  failed: "bad",
  expired: "bad",
  no_show: "bad",
  exception: "warn",
  resigned: "bad",
  terminated: "bad",
  retired: "neutral",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{label ?? humanize(status)}</Badge>;
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
const btnClass = (variant: BtnVariant, size: "sm" | "md") =>
  clsx(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
    variant === "primary" && "bg-brand text-white hover:bg-brand-2",
    variant === "secondary" && "border border-line bg-surface text-ink hover:border-brand hover:text-brand",
    variant === "ghost" && "text-brand hover:bg-brand-soft",
    variant === "danger" && "bg-bad text-white hover:opacity-90",
  );

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return <button {...props} className={clsx(btnClass(variant, size), className)} />;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  target,
}: {
  href: string;
  variant?: BtnVariant;
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
  target?: string;
}) {
  return (
    <Link href={href} target={target} className={clsx(btnClass(variant, size), className)}>
      {children}
    </Link>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      <div className="text-base font-medium text-ink">{title}</div>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

/** Shows ?msg= / ?err= feedback after a redirect. */
export function Flash({ msg, err }: { msg?: string; err?: string }) {
  if (!msg && !err) return null;
  return (
    <div
      role="status"
      className={clsx(
        "mb-4 rounded-lg border px-4 py-2.5 text-sm",
        err ? "border-bad/30 bg-bad-bg text-bad" : "border-ok/30 bg-ok-bg text-ok",
      )}
    >
      {err ?? msg}
    </div>
  );
}

export function Tabs({ tabs, active }: { tabs: { href: string; label: string; key: string; count?: number }[]; active: string }) {
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={clsx(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
            t.key === active ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-muted">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const hue = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 45% 42%)` }}
    >
      {initials(name)}
    </span>
  );
}

export function Progress({ value, tone = "brand" }: { value: number; tone?: "brand" | "ok" | "warn" | "bad" }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={clsx(
          "h-full rounded-full",
          tone === "brand" && "bg-accent-2",
          tone === "ok" && "bg-ok",
          tone === "warn" && "bg-amber-500",
          tone === "bad" && "bg-bad",
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function KeyValue({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="mt-0.5 text-ink">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Vertical trail of approval steps with who/when. */
export function ApprovalTrail({ steps }: { steps: ApprovalStep[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s) => (
        <li key={s.step} className="flex gap-3">
          <span
            className={clsx(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              s.status === "approved" && "bg-ok text-white",
              s.status === "rejected" && "bg-bad text-white",
              s.status === "pending" && "border border-line bg-surface text-muted",
            )}
          >
            {s.status === "approved" ? "✓" : s.status === "rejected" ? "✕" : s.step}
          </span>
          <div className="text-sm">
            <div className="font-medium">{s.label}</div>
            <div className="text-xs text-muted">
              {s.status === "pending" ? "Waiting" : `${humanize(s.status)} by ${s.byName ?? "—"} · ${fmtDateTime(s.at)}`}
            </div>
            {s.comment && <div className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs text-ink">“{s.comment}”</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="text-amber-500" aria-label={`${value} of ${max}`}>
      {"★".repeat(Math.round(value))}
      <span className="text-slate-300">{"★".repeat(max - Math.round(value))}</span>
    </span>
  );
}

/** Horizontal stepper used for the candidate status tracker and onboarding journey. */
export function Stepper({ steps, current, failed }: { steps: string[]; current: number; failed?: boolean }) {
  return (
    <ol className="flex w-full items-start">
      {steps.map((label, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span className={clsx("absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2", i <= current ? "bg-brand" : "bg-line")} />}
            <span
              className={clsx(
                "relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                done && "bg-brand text-white",
                now && !failed && "bg-brand text-white ring-4 ring-brand-soft",
                now && failed && "bg-bad text-white ring-4 ring-bad-bg",
                !done && !now && "border border-line bg-surface text-muted",
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={clsx("mt-1.5 px-1 text-[11px] leading-tight", now ? "font-semibold text-ink" : "text-muted")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
