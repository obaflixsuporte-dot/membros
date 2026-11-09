import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireSession, send, CURSOS } from "../lib/auth.js";

const ROOT = path.join(process.cwd(), "content");

// Sem parâmetros: lista de cursos (com quais estão liberados).
// ?curso=id: módulos do curso. ?curso=id&aula=id: Markdown da aula.
// Só abre arquivos listados nos JSON (nada de caminho vindo do usuário) e só de cursos liberados.
export default async function handler(req, res) {
  const s = await requireSession(req, res);
  if (!s) return;
  const q = new URL(req.url, "http://x").searchParams;
  const id = q.get("curso");
  if (!id) {
    const cursos = CURSOS.map(({ produtos, ...c }) => ({ ...c, liberado: s.cursos.includes(c.id) }));
    return send(res, 200, { email: s.email, cursos });
  }
  const curso = CURSOS.find((c) => c.id === id);
  if (!curso) return send(res, 404, { error: "Curso não encontrado." });
  if (!s.cursos.includes(id)) return send(res, 403, { error: "Este curso não faz parte da sua compra." });
  if (curso.embreve) return send(res, 200, { modulos: [] });
  const modulos = JSON.parse(await readFile(path.join(ROOT, id, "modulos.json"), "utf8"));
  const aulaId = q.get("aula");
  if (!aulaId) return send(res, 200, { modulos });
  const aula = modulos.flatMap((m) => m.aulas).find((a) => a.id === aulaId);
  if (!aula) return send(res, 404, { error: "Aula não encontrada." });
  const md = await readFile(path.join(ROOT, id, "aulas", `${aula.id}.md`), "utf8").catch(() => "");
  send(res, 200, { md });
}
