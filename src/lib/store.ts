import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Db } from "./types";
import { buildSeed } from "./seed";

// A small JSON document store. Reads are served from memory; every mutation is
// written atomically to data/db.json. Swap this module for a database adapter
// (Postgres, SQL Server) without touching the pages: they only use db()/mutate().

export const DATA_DIR = process.env.ABHI_DATA_DIR ?? path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const g = globalThis as unknown as { __abhiDb?: Db; __abhiMtime?: number };

function load(): Db {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const seed = buildSeed();
    write(seed);
    return seed;
  }
  const mtime = fs.statSync(DB_FILE).mtimeMs;
  if (g.__abhiDb && g.__abhiMtime === mtime) return g.__abhiDb;
  const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as Db;
  g.__abhiDb = parsed;
  g.__abhiMtime = mtime;
  return parsed;
}

function write(data: Db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, DB_FILE);
  g.__abhiDb = data;
  g.__abhiMtime = fs.statSync(DB_FILE).mtimeMs;
}

/** Read-only snapshot. Do not mutate the returned object; use mutate(). */
export function db(): Db {
  return load();
}

/** Apply a change and persist it. The callback receives the live document. */
export function mutate<T>(fn: (d: Db) => T): T {
  const d = load();
  const result = fn(d);
  write(d);
  return result;
}

export function uid(prefix = ""): string {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

/** Next number in a named sequence, e.g. nextCode(d, "REQ") -> REQ-2026-0007 */
export function nextCode(d: Db, key: string, width = 4): string {
  const year = new Date().getFullYear();
  const counterKey = `${key}-${year}`;
  const n = (d.counters[counterKey] ?? 0) + 1;
  d.counters[counterKey] = n;
  return `${key}-${year}-${String(n).padStart(width, "0")}`;
}

export function nowIso() {
  return new Date().toISOString();
}
