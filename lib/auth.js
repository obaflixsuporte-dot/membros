import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const SECRET = process.env.SESSION_SECRET || "";
const CAKTO = "https://api.cakto.com.br/public_api";
export const SESSION_DAYS = 30;
const RECHECK_MS = 60 * 60 * 1000; // revalida a compra na Cakto no máximo a cada 1 h

if (SECRET.length < 32) console.error("SESSION_SECRET ausente ou curto (mín. 32 caracteres).");

const b64 = (s) => Buffer.from(s).toString("base64url");
const hmac = (s) => crypto.createHmac("sha256", SECRET).update(s).digest("base64url");

// Token assinado "payload.assinatura"; payload = JSON em base64url.
export function sign(obj) {
  const p = b64(JSON.stringify(obj));
  return `${p}.${hmac(p)}`;
}
export function verify(token) {
  if (!SECRET || typeof token !== "string") return null;
  const [p, sig] = token.split(".");
  if (!p || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(hmac(p));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(p, "base64url").toString());
    return obj.exp > Date.now() ? obj : null;
  } catch { return null; }
}

export const normEmail = (e) => String(e || "").trim().toLowerCase();
export const validEmail = (e) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

let cached = { token: "", exp: 0 }; // token da Cakto vale 10 h; reaproveita enquanto a função estiver quente
async function caktoToken() {
  if (cached.exp > Date.now()) return cached.token;
  const r = await fetch(`${CAKTO}/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.CAKTO_CLIENT_ID, client_secret: process.env.CAKTO_CLIENT_SECRET }),
  });
  if (!r.ok) throw new Error(`Cakto token ${r.status}`);
  const j = await r.json();
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in - 300) * 1000 };
  return cached.token;
}

// Cursos e produtos que liberam cada um ficam em content/cursos.json.
export const CURSOS = JSON.parse(readFileSync(path.join(process.cwd(), "content", "cursos.json"), "utf8"));

// IDs dos cursos liberados para o e-mail: pedidos "paid" dos produtos ligados a cada curso.
// Reembolso/chargeback mudam o status do pedido, então ele deixa de contar.
export async function cursosLiberados(email) {
  const token = await caktoToken();
  const q = new URLSearchParams({ customer: email, status: "paid", limit: "100" });
  const r = await fetch(`${CAKTO}/orders/?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Cakto orders ${r.status}`);
  const { results = [] } = await r.json();
  // "customer" é busca ampla (nome, documento...), então confere o e-mail exato.
  const pagos = new Set(results.filter((o) => o.status === "paid" && normEmail(o.customer?.email) === email).map((o) => o.product?.id));
  return CURSOS.filter((c) => c.produtos.some((id) => pagos.has(id))).map((c) => c.id);
}

export function readCookie(req, name) {
  const m = (req.headers.cookie || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}
export function sessionCookie(value, maxAge) {
  const secure = process.env.NODE_ENV === "development" ? "" : " Secure;";
  return `sess=${value}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${maxAge}`;
}

export const newSession = (email, cursos, exp = Date.now() + SESSION_DAYS * 864e5) =>
  sessionCookie(sign({ t: "s", email, cursos, chk: Date.now(), exp }), Math.floor((exp - Date.now()) / 1000));

export function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

// Exige sessão válida; revalida as compras na Cakto quando a última checagem tem mais de 1 h.
// Retorna { email, cursos } ou null (e já respondeu 401).
export async function requireSession(req, res) {
  const s = verify(readCookie(req, "sess"));
  if (!s || s.t !== "s" || !Array.isArray(s.cursos)) { send(res, 401, { error: "login" }, { "Set-Cookie": sessionCookie("", 0) }); return null; }
  if (Date.now() - s.chk < RECHECK_MS) return s;
  let cursos;
  try { cursos = await cursosLiberados(s.email); }
  catch (e) { console.error(e); return s; } // Cakto fora do ar: não derruba quem já tinha acesso
  if (!cursos.length) { send(res, 401, { error: "revogado" }, { "Set-Cookie": sessionCookie("", 0) }); return null; }
  res.setHeader("Set-Cookie", newSession(s.email, cursos, s.exp));
  return { email: s.email, cursos };
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const c of req) { raw += c; if (raw.length > 4096) break; }
  try { return JSON.parse(raw); } catch { return {}; }
}
