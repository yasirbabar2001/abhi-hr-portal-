import type { Db, FileRecord, User } from "../types";
import { INTERNAL_ROLES } from "../types";

/** Whether a signed-in user may read a stored file. */
export function canReadFile(d: Db, user: User, file: FileRecord): boolean {
  if (INTERNAL_ROLES.includes(user.role)) return true;
  if (file.visibility === "public" || file.uploadedBy === user.id) return true;
  const id = file.id;
  // Orientation material is for every signed-in user.
  if (d.modules.some((m) => m.fileId === id || m.scorm?.packageId === id)) return true;
  const cand = d.candidates.find((c) => c.userId === user.id);
  if (!cand) return false;
  if (cand.cvFileId === id) return true;
  const appIds = new Set(d.applications.filter((a) => a.candidateId === cand.id).map((a) => a.id));
  if (d.interviews.some((iv) => appIds.has(iv.applicationId) && (iv.recordings?.some((r) => r.fileId === id) || iv.sessionRecordingIds?.includes(id)))) return true;
  if (d.hires.some((h) => h.userId === user.id && h.tasks.some((t) => t.fileId === id))) return true;
  // eCIB reports and reference material are internal only.
  return false;
}

/** Parse a single "bytes=start-end" range. Returns null when absent or unsatisfiable. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return "invalid";
  let start: number;
  let end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return "invalid";
  return { start, end };
}
