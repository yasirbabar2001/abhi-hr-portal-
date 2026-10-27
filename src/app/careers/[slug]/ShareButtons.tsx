"use client";
import { useState } from "react";

export function ShareButtons({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const link = "rounded-lg border border-line px-3 py-1.5 text-sm hover:border-brand hover:text-brand";
  return (
    <div className="flex flex-wrap gap-2">
      <a className={link} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${enc(`${title} at ABHI: ${url}`)}`}>WhatsApp</a>
      <a className={link} target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`}>LinkedIn</a>
      <a className={link} href={`mailto:?subject=${enc(title)}&body=${enc(url)}`}>Email</a>
      <button type="button" className={link} onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); }}>{copied ? "✓ Copied" : "Copy link"}</button>
    </div>
  );
}
