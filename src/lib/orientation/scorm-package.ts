import "server-only";
import fs from "node:fs";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { UPLOAD_DIR, uid } from "../store";
import { scormLaunch } from "./text-formats";

export const SCORM_DIR = path.join(UPLOAD_DIR, "scorm");

/** Extract an uploaded SCORM 1.2 zip and find its launch page. */
export function extractScorm(zip: Uint8Array): { packageId: string; entry: string; title?: string } {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zip);
  } catch {
    throw new Error("That file is not a valid zip archive.");
  }
  const manifestKey = Object.keys(files).find((k) => k.toLowerCase().endsWith("imsmanifest.xml"));
  if (!manifestKey) throw new Error("No imsmanifest.xml found. Please upload a SCORM 1.2 package.");
  const base = manifestKey.slice(0, manifestKey.length - "imsmanifest.xml".length); // packages zipped inside a folder
  const launch = scormLaunch(strFromU8(files[manifestKey]!));
  if (!launch) throw new Error("The manifest does not name a launch page.");

  const packageId = uid("sp_");
  const root = path.join(SCORM_DIR, packageId);
  for (const [name, bytes] of Object.entries(files)) {
    if (name.endsWith("/") || !name.startsWith(base)) continue;
    const rel = name.slice(base.length);
    const target = path.resolve(root, rel);
    if (!target.startsWith(root + path.sep)) continue; // zip-slip guard
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  return { packageId, entry: launch.href, title: launch.title };
}

/** Resolve a file inside an extracted package, refusing anything outside it. */
export function scormFile(packageId: string, rel: string): string | null {
  if (!/^[A-Za-z0-9_]+$/.test(packageId)) return null;
  const root = path.join(SCORM_DIR, packageId);
  const target = path.resolve(root, rel);
  if (!target.startsWith(root + path.sep)) return null;
  return fs.existsSync(target) && fs.statSync(target).isFile() ? target : null;
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".xml": "application/xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".swf": "application/x-shockwave-flash",
  ".txt": "text/plain; charset=utf-8",
};

export function contentType(file: string) {
  return TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}
