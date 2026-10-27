// Formatting helpers (safe for both server and client components).

const TZ = "Asia/Karachi";

export function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ });
}

export function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

export function fmtTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

export function pkr(n?: number) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return "PKR " + Math.round(n).toLocaleString("en-PK");
}

/** Compact amounts for dashboards: 1.2M, 350K */
export function pkrShort(n: number) {
  if (Math.abs(n) >= 1e9) return `PKR ${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `PKR ${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `PKR ${(n / 1e3).toFixed(0)}K`;
  return `PKR ${n}`;
}

export function daysBetween(a: string | Date, b: string | Date) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

export function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (Math.abs(m) < 1) return "just now";
  if (m > 0) {
    if (m < 60) return `${m} min ago`;
    if (m < 1440) return `${Math.round(m / 60)} h ago`;
    return `${Math.round(m / 1440)} d ago`;
  }
  const f = -m;
  if (f < 60) return `in ${f} min`;
  if (f < 1440) return `in ${Math.round(f / 60)} h`;
  return `in ${Math.round(f / 1440)} d`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function humanize(key: string) {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "2026-10-27" in Karachi time, for <input type="date"> defaults */
export function todayInput(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

export function lines(text: FormDataEntryValue | null | undefined): string[] {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function csv(text: FormDataEntryValue | null | undefined): string[] {
  return String(text ?? "")
    .split(/[,\n]/)
    .map((l) => l.trim())
    .filter(Boolean);
}
