"use client";
import { useState } from "react";

export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium hover:border-brand hover:text-brand"
      onClick={async () => {
        await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "✓ Link copied" : "🔗 Copy share link"}
    </button>
  );
}
