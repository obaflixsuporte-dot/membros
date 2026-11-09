// Autoteste do login, da sessão e do acesso por curso.
// Rode o servidor local com: DEV_PAID="aluno@teste.com" DEV_PRODUCTS="ID_PRODUTO_MANUAL" node dev.mjs
// e depois: node test.mjs
import assert from "node:assert/strict";
process.env.SESSION_SECRET = "dev-secret-dev-secret-dev-secret-0000";
const { sign, verify } = await import("./lib/auth.js");

const t = sign({ t: "s", email: "a@b.com", exp: Date.now() + 60000 });
assert.equal(verify(t).email, "a@b.com");
assert.equal(verify(t.slice(0, -2) + "xx"), null, "assinatura adulterada");
assert.equal(verify(sign({ t: "s", exp: Date.now() - 1 })), null, "expirado");
assert.equal(verify("lixo"), null);

const B = "http://localhost:5180";
const post = (email) => fetch(`${B}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
assert.equal((await post("nao-e-email")).status, 400);
const sem = await post("outro@teste.com");
assert.equal(sem.status, 403, "sem compra não entra");
assert.equal(sem.headers.get("set-cookie"), null);
assert.equal((await fetch(`${B}/api/conteudo`)).status, 401, "conteúdo exige sessão");

// Comprador só do Manual
const ok = await post(" Aluno@Teste.com ");
assert.equal(ok.status, 200, "comprador entra só com o e-mail");
const sess = ok.headers.get("set-cookie").split(";")[0];
const h = { headers: { cookie: sess } };
const lista = (await (await fetch(`${B}/api/conteudo`, h)).json()).cursos;
assert.deepEqual(lista.map((c) => [c.id, c.liberado]), [["manual", true], ["shorts", false], ["youtube", false]]);
assert.ok(!("produtos" in lista[0]), "ids de produto não vão para o navegador");
assert.equal((await (await fetch(`${B}/api/conteudo?curso=manual`, h)).json()).modulos.length, 7);
assert.ok((await (await fetch(`${B}/api/conteudo?curso=manual&aula=m4-turboscribe`, h)).json()).md.includes("TurboScribe"));
assert.equal((await fetch(`${B}/api/conteudo?curso=shorts`, h)).status, 403, "curso não comprado bloqueado");
assert.equal((await fetch(`${B}/api/conteudo?curso=shorts&aula=s1-ferramentas`, h)).status, 403);
assert.equal((await fetch(`${B}/api/media?c=shorts&f=aulas/aula-01.jpg`, h)).status, 403, "mídia de curso não comprado bloqueada");
assert.equal((await fetch(`${B}/api/media?c=..&f=manual/media/m4/01-turboscribe.webp`, h)).status, 403);
assert.equal((await fetch(`${B}/api/conteudo?curso=manual&aula=../../lib/auth`, h)).status, 404);
assert.equal((await fetch(`${B}/api/media?c=manual&f=../modulos.json`, h)).status, 404, "fora da pasta media");
assert.equal((await fetch(`${B}/api/media?c=manual&f=m4/01-turboscribe.webp`, h)).status, 200);
const v = await fetch(`${B}/api/media?c=manual&f=m3/voce-escolhe.mp4`, { headers: { cookie: sess, range: "bytes=0-" } });
assert.equal(v.status, 206);
assert.ok(+v.headers.get("content-length") <= 3 * 1024 * 1024, "pedaço cabe no limite da Vercel");

// Sessão forjada com curso a mais não passa (assinatura) e sessão antiga é revalidada
assert.equal((await fetch(`${B}/api/conteudo?curso=shorts`, { headers: { cookie: sess.replace(/\.[^.]+$/, ".x") } })).status, 401);
const old = sign({ t: "s", email: "reembolsado@teste.com", cursos: ["manual"], chk: 0, exp: Date.now() + 60000 });
assert.equal((await fetch(`${B}/api/conteudo`, { headers: { cookie: `sess=${old}` } })).status, 401, "reembolso perde acesso");
console.log("ok");
