import "server-only";
import fs from "node:fs";
import path from "node:path";
import { mutate, nowIso, uid, UPLOAD_DIR } from "./store";
import type { FileRecord } from "./types";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Persist an uploaded file and register it. Returns null for an empty input. */
export async function saveUpload(
  file: FormDataEntryValue | null,
  uploadedBy: string,
  visibility: FileRecord["visibility"] = "private",
): Promise<FileRecord | null> {
  if (!file || typeof file === "string" || file.size === 0) return null;
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 50 MB.");
  return saveBytes(Buffer.from(await file.arrayBuffer()), file.name, file.type || "application/octet-stream", uploadedBy, visibility);
}

export function saveBytes(
  bytes: Buffer,
  name: string,
  mime: string,
  uploadedBy: string,
  visibility: FileRecord["visibility"] = "private",
): FileRecord {
  const id = uid("f_");
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, id), bytes);
  const record: FileRecord = { id, name: path.basename(name), mime, size: bytes.length, visibility, uploadedBy, at: nowIso() };
  mutate((d) => d.files.push(record));
  return record;
}

export function filePath(id: string) {
  if (!/^[A-Za-z0-9_]+$/.test(id)) throw new Error("bad file id");
  return path.join(UPLOAD_DIR, id);
}
