import type { Db } from "../types";

/** How many times each master id is referenced anywhere outside the master list. */
export function masterUsage(d: Db): Map<string, number> {
  const { master, audit, ...rest } = d;
  void audit;
  const text = JSON.stringify(rest) + JSON.stringify(master.map((m) => m.meta ?? {}));
  const usage = new Map<string, number>();
  for (const m of master) {
    let n = 0;
    let i = text.indexOf(`"${m.id}"`);
    while (i !== -1) {
      n++;
      i = text.indexOf(`"${m.id}"`, i + 1);
    }
    usage.set(m.id, n);
  }
  return usage;
}

/** Parse "key=value" lines into an object; blank lines ignored. */
export function parseMeta(text: string): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}
