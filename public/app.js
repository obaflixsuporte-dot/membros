const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// Tema: segue o sistema até o aluno escolher; a escolha fica salva no navegador.
function setupTheme() {
  const root = document.documentElement;
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const paint = () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : mq.matches;
    root.toggleAttribute("data-dark", dark);
    $('meta[name="theme-color"]').content = dark ? "#1E1410" : "#F3ECD9";
  };
  mq.addEventListener("change", paint);
  paint();
  $(".js-theme")?.addEventListener("click", () => {
    root.dataset.theme = root.hasAttribute("data-dark") ? "light" : "dark";
    try { localStorage.setItem("tema", root.dataset.theme); } catch {}
    paint();
  });
}

const ERROS = {
  servidor: "Não foi possível verificar sua compra agora. Tente de novo em alguns minutos.",
  sessao: "Sua sessão terminou. Entre de novo com o e-mail da compra.",
};

function setupLogin(form) {
  const msg = $(".msg", form);
  const show = (text, erro) => { msg.textContent = text; msg.hidden = false; msg.classList.toggle("msg--erro", !!erro); };
  const erro = new URLSearchParams(location.search).get("erro");
  if (ERROS[erro]) show(ERROS[erro], true);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!form.email.checkValidity() || !email) return show("Informe um e-mail válido.", true);
    const btn = $("button[type=submit]", form);
    btn.disabled = true;
    try {
      const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const j = await r.json();
      if (r.ok) return location.assign("/painel");
      show(j.error, true);
    } catch {
      show("Sem conexão. Verifique sua internet e tente de novo.", true);
    } finally { btn.disabled = false; }
  });
}

// Player igual ao da página de vendas: botão laranja no centro, clique pausa/continua,
// e uma barra fina com progresso, tempo e tela cheia.
const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l11-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
};
const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

function enhanceVideos(root) {
  root.querySelectorAll("video").forEach((v) => {
    v.removeAttribute("controls");
    v.classList.add("player__video");
    const box = document.createElement("div");
    box.className = `player${v.classList.contains("vertical") ? " player--vertical" : ""}`;
    box.dataset.state = "paused";
    v.replaceWith(box);
    box.innerHTML = `<button class="player__play" type="button" aria-label="Reproduzir vídeo">${ICON.play}</button>
      <div class="player__bar">
        <button class="player__btn js-pp" type="button" aria-label="Reproduzir">${ICON.play}</button>
        <input class="player__seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Posição do vídeo">
        <span class="player__time">0:00</span>
        <button class="player__btn js-fs" type="button" aria-label="Tela cheia">${ICON.full}</button>
      </div>`;
    box.prepend(v);
    const big = $(".player__play", box), pp = $(".js-pp", box), seek = $(".player__seek", box), time = $(".player__time", box);
    const toggle = () => (v.paused ? v.play().catch(() => {}) : v.pause());
    [big, pp, v].forEach((el) => el.addEventListener("click", toggle));
    v.addEventListener("play", () => {
      document.querySelectorAll(".md video").forEach((o) => o !== v && o.pause()); // um vídeo por vez
      box.dataset.state = "playing"; pp.innerHTML = ICON.pause; pp.setAttribute("aria-label", "Pausar");
    });
    v.addEventListener("pause", () => { box.dataset.state = "paused"; pp.innerHTML = ICON.play; pp.setAttribute("aria-label", "Reproduzir"); });
    v.addEventListener("timeupdate", () => {
      if (v.duration) seek.value = Math.round((v.currentTime / v.duration) * 1000);
      time.textContent = `${fmt(v.currentTime)} / ${fmt(v.duration)}`;
    });
    v.addEventListener("loadedmetadata", () => { time.textContent = `0:00 / ${fmt(v.duration)}`; });
    seek.addEventListener("input", () => { if (v.duration) v.currentTime = (seek.value / 1000) * v.duration; });
    $(".js-fs", box).addEventListener("click", () => {
      if (document.fullscreenElement) return document.exitFullscreen();
      if (box.requestFullscreen) box.requestFullscreen();
      else v.webkitEnterFullscreen?.(); // iPhone só deixa o próprio vídeo em tela cheia
    });
  });
}

// Visualizador de imagens: abre em tela cheia, zoom com roda/pinça/duplo clique/botões e arrastar para mover.
function setupLightbox() {
  const dlg = document.createElement("dialog");
  dlg.className = "lb";
  dlg.setAttribute("aria-label", "Visualizar imagem");
  dlg.innerHTML = `<div class="lb__stage"><img class="lb__img" alt=""></div>
    <div class="lb__tools">
      <button class="icon-btn js-zout" type="button" aria-label="Diminuir zoom"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>
      <button class="icon-btn js-zin" type="button" aria-label="Aumentar zoom"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg></button>
      <button class="icon-btn js-close" type="button" aria-label="Fechar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <p class="lb__cap"></p>`;
  document.body.append(dlg);
  const stage = $(".lb__stage", dlg), img = $(".lb__img", dlg), cap = $(".lb__cap", dlg);
  let s = 1, x = 0, y = 0;
  const pts = new Map();
  let last = null, pinch = null, moved = false;
  const apply = () => { img.style.transform = `translate(${x}px, ${y}px) scale(${s})`; dlg.toggleAttribute("data-zoom", s > 1); };
  const zoom = (ns, cx = 0, cy = 0) => { // zoom mantendo o ponto (cx, cy) do centro no lugar
    ns = Math.min(5, Math.max(1, ns));
    x = cx - ((cx - x) * ns) / s; y = cy - ((cy - y) * ns) / s; s = ns;
    if (s === 1) x = y = 0;
    apply();
  };
  const center = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2]; };

  stage.addEventListener("wheel", (e) => { e.preventDefault(); zoom(s * (e.deltaY < 0 ? 1.2 : 1 / 1.2), ...center(e)); }, { passive: false });
  stage.addEventListener("dblclick", (e) => zoom(s > 1 ? 1 : 2.5, ...center(e)));
  stage.addEventListener("pointerdown", (e) => {
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, e); last = e; moved = false;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), s }; }
  });
  stage.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, e);
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      return zoom(pinch.s * (Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d));
    }
    const dx = e.clientX - last.clientX, dy = e.clientY - last.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    if (s > 1) { x += dx; y += dy; apply(); }
    last = e;
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
  stage.addEventListener("pointerup", (e) => {
    up(e);
    if (!moved && s === 1 && e.target === stage) dlg.close(); // toque fora da imagem fecha
  });
  stage.addEventListener("pointercancel", up);
  $(".js-zin", dlg).addEventListener("click", () => zoom(s * 1.5));
  $(".js-zout", dlg).addEventListener("click", () => zoom(s / 1.5));
  $(".js-close", dlg).addEventListener("click", () => dlg.close());
  dlg.addEventListener("close", () => { img.removeAttribute("src"); });

  return (el) => {
    s = 1; x = y = 0; apply();
    img.src = el.currentSrc || el.src; img.alt = el.alt;
    cap.textContent = el.alt; cap.hidden = !el.alt;
    dlg.showModal();
  };
}
let openImage;
function enhanceImages(root) {
  openImage ||= setupLightbox();
  root.querySelectorAll("img").forEach((img) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "zoomable";
    b.setAttribute("aria-label", `Ampliar imagem${img.alt ? `: ${img.alt}` : ""}`);
    img.replaceWith(b); b.append(img);
    b.addEventListener("click", () => openImage(img));
  });
}

const CHECK ='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';

async function api(url) {
  const r = await fetch(url, { credentials: "same-origin" });
  if (r.status === 401) { location.href = "/?erro=sessao"; throw new Error("401"); }
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

// Arquivos das aulas ficam fora da pasta pública; "media/..." vira a rota protegida do curso.
const mediaUrl = (cid, v) => (v && v.startsWith("media/") ? `/api/media?c=${cid}&f=${encodeURIComponent(v.slice(6))}` : v);
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

async function setupPainel() {
  const main = $(".js-main"), nav = $(".js-nav"), side = $(".js-side"), layout = $(".layout");
  let data;
  try { data = await api("/api/conteudo"); }
  catch (e) { if (e.message !== "401") main.innerHTML = '<p class="msg msg--erro">Não foi possível carregar o conteúdo. Recarregue a página.</p>'; return; }

  const cursos = data.cursos;
  const cache = {};
  // Módulos e progresso de cada curso, carregados na primeira visita.
  const load = async (cid) => {
    if (cache[cid]) return cache[cid];
    const { modulos } = await api(`/api/conteudo?curso=${encodeURIComponent(cid)}`);
    const aulas = modulos.flatMap((m, mi) => m.aulas.map((a) => ({ ...a, mod: m, mi })));
    const KEY = `progresso:${data.email}:${cid}`;
    const prog = store.get(KEY) || { done: [], last: null };
    const done = new Set(prog.done.filter((id) => aulas.some((a) => a.id === id)));
    return (cache[cid] = { cid, curso: cursos.find((c) => c.id === cid), mods: modulos, aulas, prog, done, save: () => store.set(KEY, { done: [...done], last: prog.last }) });
  };
  const pct = (c) => Math.round((c.done.size / (c.aulas.length || 1)) * 100);
  const modPct = (c, m) => Math.round((m.aulas.filter((a) => c.done.has(a.id)).length / (m.aulas.length || 1)) * 100);
  const next = (c) => c.aulas.find((a) => a.id === c.prog.last && !c.done.has(a.id)) || c.aulas.find((a) => !c.done.has(a.id) && !a.bloqueada) || c.aulas.find((a) => a.id === c.prog.last) || c.aulas[0];
  const aulaHref = (c, id) => `#/c/${c.cid}/aula/${encodeURIComponent(id)}`;

  const renderNav = (c, cur) => {
    layout.removeAttribute("data-full");
    $(".js-ctitle").textContent = c.curso.titulo;
    nav.innerHTML = c.mods.map((m, mi) => `<li>
      <p class="nav__mod"><span>Módulo ${mi + 1}</span> · ${esc(m.titulo)}</p>
      <ol>${m.aulas.map((a) => `<li><a href="${aulaHref(c, a.id)}" class="${c.done.has(a.id) ? "is-done" : ""}"${a.id === cur ? ' aria-current="page"' : ""}>${a.bloqueada ? `<span class="chk chk--lock" title="Bloqueada">${LOCK}</span>` : `<span class="chk">${CHECK}</span>`}<span>${esc(a.titulo)}</span></a></li>`).join("")}</ol>
    </li>`).join("");
    $(".js-pct").textContent = `${pct(c)}%`;
    $(".js-bar").style.width = `${pct(c)}%`;
    $(".prog", side).setAttribute("aria-valuenow", pct(c));
  };

  const renderCursos = () => {
    layout.setAttribute("data-full", "");
    main.innerHTML = `<section class="home">
      <p class="tag">Área de membros</p>
      <h1>Seus <span class="ac">cursos</span></h1>
      <p class="home__lead">Escolha por onde quer começar.</p>
      <ol class="mods mods--cursos">${cursos.map((c) => {
        const tag = c.embreve ? '<span class="pill">Em breve</span>' : c.liberado ? "" : `<span class="pill pill--lock">${LOCK} Bloqueado</span>`;
        const inner = `<span class="mod__n">${c.liberado ? "Incluso na sua compra" : "Não incluso na sua compra"}</span>${tag}<h2>${esc(c.titulo)}</h2><p>${esc(c.descricao)}</p>`;
        if (c.liberado && !c.embreve) return `<li><a class="card mod" href="#/c/${esc(c.id)}">${inner}<span class="mod__go">Acessar →</span></a></li>`;
        const cta = !c.liberado && c.checkout ? `<a class="btn btn--sm" href="${esc(c.checkout)}" target="_blank" rel="noopener">Quero liberar</a>` : "";
        return `<li><div class="card mod mod--off">${inner}${cta}</div></li>`;
      }).join("")}</ol>
    </section>`;
  };

  const renderHome = (c) => {
    const n = next(c);
    const started = c.done.size > 0 || c.prog.last;
    main.innerHTML = `<section class="home">
      <div class="home__head">
        <div>
          <p class="tag">Área de membros</p>
          <h1>${esc(c.curso.titulo)}</h1>
          <p class="home__lead">Siga os módulos na ordem. Marque cada aula como concluída para acompanhar seu progresso.</p>
        </div>
        <div class="card home__resume">
          <div class="prog-label"><span>${c.done.size} de ${c.aulas.length} aulas</span><span>${pct(c)}%</span></div>
          <div class="prog"><i style="width:${pct(c)}%"></i></div>
          <a class="btn" href="${aulaHref(c, n.id)}">${started ? "Continuar de onde parei" : "Começar pelo módulo 1"}</a>
        </div>
      </div>
      <ol class="mods">${c.mods.map((m, mi) => `<li><a class="card mod" href="${aulaHref(c, m.aulas[0]?.id || "")}">
        <span class="mod__n">Módulo ${mi + 1}</span><h2>${esc(m.titulo)}</h2><p>${esc(m.descricao)}</p>
        <div class="prog-label"><span>${m.aulas.length} ${m.aulas.length === 1 ? "aula" : "aulas"}</span><span>${modPct(c, m)}%</span></div><div class="prog"><i style="width:${modPct(c, m)}%"></i></div>
      </a></li>`).join("")}</ol>
    </section>`;
    renderNav(c, null);
  };

  const renderAula = async (c, id) => {
    const i = c.aulas.findIndex((a) => a.id === id);
    if (i === -1) return (location.hash = `#/c/${c.cid}`);
    const a = c.aulas[i], prev = c.aulas[i - 1], nxt = c.aulas[i + 1];
    const here = location.hash;
    c.prog.last = id; c.save();
    renderNav(c, id);
    main.innerHTML = '<p class="loading">Carregando aula…</p>';
    let md = "", travada = "";
    try { ({ md, bloqueada: travada } = await api(`/api/conteudo?curso=${c.cid}&aula=${encodeURIComponent(id)}`)); } catch (e) { if (e.message === "401") return; }
    if (location.hash !== here) return; // aluno já trocou de aula
    const body = travada ? `<div class="locked">${LOCK}<p><strong>Aula bloqueada</strong></p><p>${esc(travada)}</p></div>`
      : md.trim() ? (window.marked ? marked.parse(md) : `<pre>${esc(md)}</pre>`) : '<p class="pending">O conteúdo desta aula está sendo preparado.</p>';
    main.innerHTML = `<article class="card lesson">
      <p class="tag">Módulo ${a.mi + 1} · ${esc(a.mod.titulo)}</p>
      <h1>${esc(a.titulo)}</h1>
      <div class="md">${body}</div>
      <div class="lesson__acts">
        ${travada ? "<span></span>" : `<button class="btn ${c.done.has(id) ? "btn--sec" : ""} js-done" type="button" aria-pressed="${c.done.has(id)}">${c.done.has(id) ? "✓ Aula concluída" : "Marcar como concluída"}</button>`}
        <div>
          ${prev ? `<a class="btn btn--sec" href="${aulaHref(c, prev.id)}">← Anterior</a>` : `<a class="btn btn--sec" href="#/c/${c.cid}">← Início do curso</a>`}
          ${nxt ? `<a class="btn btn--sec" href="${aulaHref(c, nxt.id)}">Próxima →</a>` : `<a class="btn btn--sec" href="#/c/${c.cid}">Ver todos os módulos</a>`}
        </div>
      </div>
    </article>`;
    const md$ = $(".md", main);
    md$.querySelectorAll("img,video,source").forEach((el) => {
      ["src", "poster"].forEach((at) => el.hasAttribute(at) && el.setAttribute(at, mediaUrl(c.cid, el.getAttribute(at))));
      if (el.tagName === "IMG") el.loading = "lazy";
    });
    md$.querySelectorAll("a[href]").forEach((el) => {
      el.setAttribute("href", mediaUrl(c.cid, el.getAttribute("href")));
      if (/^https?:/.test(el.getAttribute("href"))) { el.target = "_blank"; el.rel = "noopener"; }
    });
    enhanceVideos(md$);
    enhanceImages(md$);
    md$.querySelectorAll("pre").forEach((pre) => {
      const b = document.createElement("button");
      b.className = "copy"; b.type = "button"; b.textContent = "Copiar";
      b.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(pre.innerText.replace(/Copiar$|Copiado!$/, "").trim()); b.textContent = "Copiado!"; } catch { b.textContent = "Selecione e copie"; }
      });
      pre.append(b);
    });
    $(".js-done", main)?.addEventListener("click", () => {
      c.done.has(id) ? c.done.delete(id) : c.done.add(id);
      c.save();
      if (c.done.has(id) && nxt) location.hash = aulaHref(c, nxt.id);
      else renderAula(c, id);
    });
    main.focus({ preventScroll: true });
    scrollTo({ top: 0 });
  };

  const route = async () => {
    side.removeAttribute("data-open");
    $(".js-side-toggle").setAttribute("aria-expanded", "false");
    const m = location.hash.match(/^#\/c\/([\w-]+)(?:\/aula\/(.+))?$/);
    const curso = m && cursos.find((c) => c.id === m[1] && c.liberado && !c.embreve);
    if (!curso) return renderCursos();
    let c;
    try { c = await load(curso.id); } catch (e) { if (e.message !== "401") renderCursos(); return; }
    m[2] ? renderAula(c, decodeURIComponent(m[2])) : renderHome(c);
  };
  addEventListener("hashchange", route);
  route();

  $(".js-side-toggle").addEventListener("click", (e) => {
    const open = !side.hasAttribute("data-open");
    side.toggleAttribute("data-open", open);
    e.currentTarget.setAttribute("aria-expanded", open);
  });
  $(".js-sair").addEventListener("click", async () => {
    await fetch("/api/sair", { method: "POST" }).catch(() => {});
    location.href = "/";
  });
}

setupTheme();
if ($(".js-login")) setupLogin($(".js-login"));
if ($(".js-main")) setupPainel();
