import { normEmail, validEmail, cursosLiberados, readJson, send, newSession } from "../lib/auth.js";

// Entrada só com o e-mail da compra: libera os cursos dos produtos pagos na Cakto.
export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "método" });
  const email = normEmail((await readJson(req)).email);
  if (!validEmail(email)) return send(res, 400, { error: "Informe um e-mail válido." });
  try {
    const cursos = await cursosLiberados(email);
    if (!cursos.length) return send(res, 403, { error: "Não encontramos uma compra aprovada com este e-mail. Use o mesmo e-mail da compra." });
    return send(res, 200, { ok: true }, { "Set-Cookie": newSession(email, cursos) });
  } catch (e) {
    console.error(e);
    return send(res, 502, { error: "Não foi possível verificar sua compra agora. Tente de novo em alguns minutos." });
  }
}
