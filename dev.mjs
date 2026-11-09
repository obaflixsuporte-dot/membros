// Servidor local (só desenvolvimento): node dev.mjs
// Sem chaves reais, simula a Cakto: e-mails em DEV_PAID compraram os produtos em DEV_PRODUCTS (padrão: todos do cursos.json).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

if (existsSync(".env")) for (const l of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const PORT = 5180;
Object.assign(process.env, {
  NODE_ENV: "development",
  SESSION_SECRET: process.env.SESSION_SECRET || "dev-secret-dev-secret-dev-secret-0000",
});

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt = {}) => {
  const u = String(url);
  if (u.includes("api.cakto.com.br") && !process.env.CAKTO_CLIENT_ID) {
    if (u.endsWith("/token/")) return Response.json({ access_token: "dev", expires_in: 36000 });
    const email = new URL(u).searchParams.get("customer");
    const paid = (process.env.DEV_PAID || "aluno@teste.com").split(",");
    const todos = [...new Set(JSON.parse(readFileSync("content/cursos.json", "utf8")).flatMap((c) => c.produtos))];
    const produtos = process.env.DEV_PRODUCTS ? process.env.DEV_PRODUCTS.split(",") : todos;
    const results = paid.includes(email) ? produtos.map((id) => ({ status: "paid", customer: { email }, product: { id } })) : [];
    return Response.json({ count: results.length, results });
  }
  return realFetch(url, opt);
};

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml" };
http.createServer(async (req, res) => {
  const p = new URL(req.url, "http://x").pathname;
  try {
    if (p.startsWith("/api/")) {
      const mod = await import(`./api/${path.basename(p)}.js`);
      return await mod.default(req, res);
    }
    const f = path.join("public", p === "/" ? "index.html" : path.extname(p) ? p : `${p}.html`);
    const body = await readFile(f);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
    res.end(body);
  } catch (e) {
    if (e.code !== "ENOENT" && e.code !== "ERR_MODULE_NOT_FOUND") console.error(e);
    if (!res.headersSent) { res.writeHead(404); res.end("404"); }
  }
}).listen(PORT, () => console.log(`Área de membros em http://localhost:${PORT}`));
