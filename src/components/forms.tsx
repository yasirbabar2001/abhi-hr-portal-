"use client";
import { useFormStatus } from "react-dom";
import clsx from "clsx";

/** Submit button that disables itself and shows progress while the action runs. */
export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  confirm,
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  confirm?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-wait disabled:opacity-60",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
        variant === "primary" && "bg-brand text-white hover:bg-brand-2",
        variant === "secondary" && "border border-line bg-surface text-ink hover:border-brand hover:text-brand",
        variant === "ghost" && "text-brand hover:bg-brand-soft",
        variant === "danger" && "bg-bad text-white hover:opacity-90",
        className,
      )}
    >
      {pending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

/** Auto-submits its form when the select changes (used by filter bars). */
export function AutoSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx("input", props.className)} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}

export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium hover:border-brand hover:text-brand"
    >
      🖨 {label}
    </button>
  );
}
