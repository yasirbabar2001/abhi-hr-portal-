"use client";
import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={url} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Referee link" />
      <button
        type="button"
        className="shrink-0 rounded-lg border border-line px-3 text-xs font-medium hover:border-brand hover:text-brand"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
