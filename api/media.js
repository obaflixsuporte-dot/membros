import { open, stat } from "node:fs/promises";
import path from "node:path";
import { requireSession, send } from "../lib/auth.js";

const CONTENT = path.join(process.cwd(), "content");
const TYPES = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".mp4": "video/mp4", ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8" };
const CHUNK = 3 * 1024 * 1024; // resposta de função na Vercel tem limite de 4,5 MB; vídeo vai em pedaços (206)

export default async function handler(req, res) {
  const s = await requireSession(req, res);
  if (!s) return;
  const q = new URL(req.url, "http://x").searchParams;
  const curso = q.get("c") || "";
  if (!s.cursos.includes(curso)) return send(res, 403, { error: "curso" }); // só cursos da compra (ids vêm do cursos.json)
  const ROOT = path.join(CONTENT, curso, "media");
  const file = path.join(ROOT, q.get("f") || "");
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type || !file.startsWith(ROOT + path.sep)) return send(res, 404, { error: "arquivo" });
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return send(res, 404, { error: "arquivo" });

  const size = info.size;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  let start = 0, end = size - 1, status = 200;
  if (m || size > CHUNK) {
    start = m?.[1] ? +m[1] : 0;
    end = Math.min(m?.[2] ? +m[2] : size - 1, start + CHUNK - 1, size - 1);
    if (start >= size) { res.writeHead(416, { "Content-Range": `bytes */${size}` }); return res.end(); }
    status = 206;
  }
  const len = end - start + 1;
  const buf = Buffer.alloc(len);
  const fh = await open(file);
  try { await fh.read(buf, 0, len, start); } finally { await fh.close(); }
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": len,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    ...(status === 206 ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
  });
  res.end(buf);
}
