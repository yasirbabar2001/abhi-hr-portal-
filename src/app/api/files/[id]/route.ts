import fs from "node:fs";
import { Readable } from "node:stream";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { filePath } from "@/lib/files";
import { canReadFile, parseRange } from "@/lib/admin/file-access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const d = db();
  const file = d.files.find((f) => f.id === id);
  if (!file || !canReadFile(d, user, file)) return new Response("Not found", { status: 404 });
  let path: string;
  try {
    path = filePath(id);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!fs.existsSync(path)) return new Response("Not found", { status: 404 });
  const size = fs.statSync(path).size;
  const url = new URL(req.url);
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
  const headers: Record<string, string> = {
    "Content-Type": file.mime || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `${url.searchParams.get("download") ? "attachment" : "inline"}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
  };
  // Uploaded HTML/SVG must never run as a page on our origin.
  if (/html|svg|xml|javascript/i.test(file.mime)) headers["Content-Security-Policy"] = "sandbox";

  const range = parseRange(req.headers.get("range"), size);
  if (range === "invalid") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  if (range) {
    const stream = Readable.toWeb(fs.createReadStream(path, { start: range.start, end: range.end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${range.start}-${range.end}/${size}`, "Content-Length": String(range.end - range.start + 1) },
    });
  }
  const stream = Readable.toWeb(fs.createReadStream(path)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
