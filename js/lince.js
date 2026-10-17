/* módulo lince: «Oído de lince», un juego de Juegos (SPEC §5-D) registrado con vocabGames.register.
   Ruta: #/juegos/lince. Suena una palabra grabada y el niño elige entre 2 tarjetas que suenan casi igual (ship / sheep):
     con dibujo y palabra escrita si las dos tienen dibujo; si no, solo la palabra. 8 rondas.
     Acierto: la tarjeta se pone verde con ✓ y la palabra vuelve a sonar. Fallo: la elegida se pone gris con ✗ (sin
     temblor ni sonido triste), la buena se marca con ✓ y suenan las dos, una detrás de otra, para comparar; «Seguir».
     El altavoz grande repite la palabra y la tortuga la dice despacio. Estrellas por aciertos (7-8 ★★★, 5-6 ★★, 0-4 ★).
   Usa de games.js lo mismo que los otros juegos: tarjeta del menú, récord, explicación la primera vez, «?», pausa
     (Esc y la ✕ del modo foco) y finish() (récord en "games:best".lince, monedas con award desde «+N»).
   Datos: data/lince.json {v, about, english|français|dansk: [[{w, es, img|null, d}, {…}], …]}: pares mínimos del
     corpus con audio grabado (w es la palabra de data/<d>.json, con su artículo; suena su audio de audio/<ab>/).
   Teclas: 1 y 2 (o ← →) eligen · Espacio repite · T despacio · Enter sigue. No guarda nada propio. */
(() => {
"use strict";

const ID = "lince", ROUNDS = 8, MIN_PAIRS = 4;
const IC = (n, s = "bold", z = 22, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
const RM = () => { try{ return !!(window.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const ARTS = {
  english: /^(?:the|an?|to)\s+/i,
  "français": /^(?:les|le|la|une|un|des|du|se)\s+|^(?:l|s|d)['’]/i,
  dansk: /^(?:en|et|at)\s+/i,
};

/* los pares: se cargan una vez; solo los que están bien formados */
let DATA = null;
function load(){
  if(!DATA) DATA = fetch("data/lince.json").then(r => { if(!r.ok) throw new Error("data/lince.json " + r.status); return r.json(); })
    .catch(e => { DATA = null; throw e; });
  return DATA;
}
const okWord = x => x && typeof x === "object" && typeof x.w === "string" && x.w.trim() && typeof x.es === "string" && x.es.trim()
  && (x.img === null || x.img === undefined || (typeof x.img === "string" && /^img\/[\w.\-]+\.png$/.test(x.img)));
const pairsOf = (all, L) => (all && Array.isArray(all[L]) ? all[L] : [])
  .filter(p => Array.isArray(p) && p.length === 2 && okWord(p[0]) && okWord(p[1]) && p[0].w !== p[1].w)
  .map(p => p.map(x => ({w: x.w.trim(), es: x.es.trim(), img: x.img || null})));
/* el audio de cada palabra lo dice audio/<ab>.json; recién abierta la app puede no haber llegado todavía */
async function clipsReady(word){
  for(let i = 0; i < 20; i++){
    try{ if(typeof clipFor !== "function" || clipFor(word)) return; }catch(e){ return; }
    await new Promise(r => setTimeout(r, 100));
  }
}
function splitArt(w){
  const m = w.match(ARTS[lang] || /^$/);
  return m && m[0].length < w.length ? {art: m[0].trim(), base: w.slice(m[0].length)} : {art: "", base: w};
}
const wordFs = w => { const n = [...w].length; return n <= 5 ? "1.75rem" : n <= 8 ? "1.5rem" : n <= 12 ? "1.25rem" : "1.05rem"; };

const CSS = `
.ln-listen{margin-bottom:12px}
.ln-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;max-width:560px;margin:0 auto}
.ln-c{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:208px;padding:16px 10px 14px;margin:0;border:0;
  border-radius:var(--r-card);background:var(--card);color:var(--label);font:inherit;text-align:center;cursor:pointer;touch-action:manipulation;
  box-shadow:0 1px 3px rgba(0,0,0,.06),inset 0 0 0 2px var(--sep);-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;user-select:none;
  transition:background-color .2s,color .2s,box-shadow .2s;animation:gm-in .3s calc(var(--i) * 70ms) backwards}
.ln-c.ln-txt{min-height:156px}
.ln-pic{width:min(124px,72%);aspect-ratio:1;border-radius:22px;background:var(--gm-tile);display:grid;place-items:center;transition:opacity .2s,filter .2s}
.ln-pic img{width:82%;height:82%;object-fit:contain;pointer-events:none}
.ln-w{display:block;max-width:100%;font:800 1.5rem/1.15 var(--f-round);overflow-wrap:anywhere}
.ln-w .ln-a{font-weight:600;opacity:.72;margin-right:.25em}
.ln-es{display:block;min-height:1.3em;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2);visibility:hidden}
.ln.ln-done .ln-es{visibility:visible}
.ln-mk{position:absolute;right:-6px;top:-6px;width:34px;height:34px;border-radius:50%;display:none;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.2);z-index:2}
.ln-c.is-ok{background:var(--ok-fill);color:#fff;box-shadow:none}
.ln-c.is-ok .ln-es{color:#fff}
.ln-c.is-ok .ln-mk,.ln-c.is-right .ln-mk{display:grid;background:var(--ok-fill);color:#fff;box-shadow:0 0 0 3px var(--card),0 2px 6px rgba(0,0,0,.2)}
.ln-c.is-right{box-shadow:inset 0 0 0 3px var(--ok)}
.ln-c.is-miss{background:var(--miss-fill);color:var(--miss-on);box-shadow:none}
.ln-c.is-miss .ln-es{color:var(--miss-on)}
.ln-c.is-miss .ln-pic{filter:grayscale(1);opacity:.6}
.ln-c.is-miss .ln-mk{display:grid;background:var(--miss);color:#fff;box-shadow:0 0 0 3px var(--card),0 2px 6px rgba(0,0,0,.2)}
.ln-c.ln-now{outline:4px solid var(--brand-tint);outline-offset:3px}
@media (hover:hover){.ln:not(.ln-done) .ln-c:hover{box-shadow:0 1px 3px rgba(0,0,0,.06),inset 0 0 0 2px var(--brand-tint)}}
.ln-c:focus-visible{outline:3px solid var(--brand-tint);outline-offset:3px}
.ln-next{display:flex;justify-content:center;align-items:center;min-height:60px;margin-top:12px}
.ln-next .glass-btn{min-width:180px}
.gm-bigsay.playing{box-shadow:0 0 0 6px color-mix(in srgb,var(--brand-fill) 30%,transparent)}
.gm-short .ln-c{min-height:150px;padding:10px 8px}
.gm-short .ln-c.ln-txt{min-height:112px}
.gm-short .ln-pic{width:min(88px,60%)}
.gm-short .ln-next{min-height:52px;margin-top:8px}
@media (max-width:360px){.ln-w{font-size:1.25rem}}
@media (prefers-reduced-motion: reduce){.ln-c,.ln-pic{transition:none}}`;
function css(){
  if(document.getElementById("css-lince")) return;
  const s = document.createElement("style"); s.id = "css-lince"; s.textContent = CSS; document.head.appendChild(s);
}

async function start(app, api, mode){
  const my = api.nav();
  css();
  let all = null;
  try{ all = await load(); }catch(e){ all = null; }
  if(!api.here(my, ID)) return;
  const L = lang, P = pairsOf(all, L);
  if(P.length < MIN_PAIRS){
    app.innerHTML = `<div class="gm"><div class="gm-empty"><p>Este juego todavía no tiene palabras en ${esc(api.nm())}.</p>
      <a class="glass-btn" href="#/juegos">${IC("caret-left", "bold", 18)}Juegos</a></div></div>`;
    return;
  }
  /* 8 rondas con pares distintos (si hay menos, se repiten sin seguirse); la palabra buena, una u otra al azar */
  const order = [];
  while(order.length < ROUNDS){ const s = shuffle(P); if(order.length && s[0] === order[order.length - 1]) s.push(s.shift()); order.push(...s); }
  const rounds = order.slice(0, ROUNDS).map(p => { const k = Math.random() < .5 ? 0 : 1; return {pair: shuffle(p), target: p[k]}; });
  rounds.forEach(r => r.pair.forEach(x => { if(x.img){ const im = new Image(); im.src = x.img; } }));
  await clipsReady(rounds[0].target.w);
  if(!api.here(my, ID) || lang !== L) return;
  const code = LANGS[lang].code;
  const run = api.mount(app, `<div class="gm ln" id="ln">
    ${api.topHtml(ID, `<span class="gm-pill" title="Ronda">👂 <span><b id="gm-rd">1</b>/${ROUNDS}</span></span><span class="gm-pill" title="Aciertos">⭐ <b id="gm-sc">0</b></span>`)}
    <div class="gm-listen ln-listen">
      <button type="button" class="gm-bigsay" id="ln-play" aria-label="Escuchar otra vez">${IC("speaker-high", "fill", 34)}</button>
      <button type="button" class="glass-btn glass-btn--icon" id="ln-slow" aria-label="Escuchar despacio">${IC("turtle", "bold", 24)}</button>
      <div class="gm-ltxt" id="ln-txt" aria-live="polite">¿Cuál oyes?</div>
    </div>
    <div class="ln-cards" id="ln-cards"></div>
    <div class="ln-next" id="ln-next"></div>
    ${api.dotsHtml(ROUNDS)}</div>`, mode);
  const root = run.root, box = root.querySelector("#ln-cards"), nextBox = root.querySelector("#ln-next"), txt = root.querySelector("#ln-txt");
  const playB = root.querySelector("#ln-play");
  let r = 0, score = 0, cur = null, answered = false, started = false, tok = 0, talkN = 0, fit = null;
  const res = [];
  const live = () => api.live(run);
  const cards = () => [...box.querySelectorAll(".ln-c")];
  const dots = () => root.querySelectorAll("#gm-dots i").forEach((d, i) => { d.className = i < res.length ? (res[i] ? "ok" : "meh") : i === r ? "now" : ""; });
  /* la palabra suena desde el altavoz grande (que se ilumina mientras habla); la tortuga, despacio */
  const hear = slow => { if(!cur || !live()) return; talkN++; try{ say(cur.target.w, slow ? root.querySelector("#ln-slow") : playB, !!slow); }catch(e){} };
  /* suena una palabra con su tarjeta marcada; acaba al terminar el audio (o si se para: pausa, otro audio) */
  async function sayCard(x){
    const c = cards().find(el => el.dataset.w === x.w);
    if(c) c.classList.add("ln-now");
    try{ await sayP(x.w); }catch(e){}
    if(c) c.classList.remove("ln-now");
  }
  /* espera dentro de la partida: con la pausa abierta, espera a que siga */
  const wait = ms => new Promise(res => api.later(run, res, ms));

  function cardHtml(x, i, pics){
    const {art, base} = splitArt(x.w);
    return `<button type="button" class="ln-c${pics ? "" : " ln-txt"}" data-i="${i}" data-w="${esc(x.w)}" style="--i:${i}" aria-label="${esc(x.w)}">
      ${pics ? `<span class="ln-pic" aria-hidden="true"><img src="${esc(x.img)}" alt="" draggable="false"></span>` : ""}
      <span class="ln-w" lang="${esc(code)}" style="font-size:${wordFs(x.w)}">${art ? `<span class="ln-a">${esc(art)}</span>` : ""}${esc(base)}</span>
      <span class="ln-es" aria-hidden="true">${esc(x.es)}</span>
      <span class="ln-mk" aria-hidden="true"></span></button>`;
  }
  function round(){
    cur = rounds[r]; answered = false; tok++;
    const pics = cur.pair.every(x => x.img);
    root.classList.remove("ln-done");
    box.innerHTML = cur.pair.map((x, i) => cardHtml(x, i, pics)).join("");
    nextBox.innerHTML = "";
    txt.textContent = "¿Cuál oyes?";
    const rd = root.querySelector("#gm-rd"); if(rd) rd.textContent = r + 1;
    dots();
    if(fit) fit(true);
    playB.classList.remove("ring"); void playB.offsetWidth; playB.classList.add("ring");
    if(started) api.later(run, () => hear(false), RM() ? 250 : 550);
  }
  function choose(c){
    if(!started || answered || !cur || !live()) return;
    const x = cur.pair[+c.dataset.i]; if(!x) return;
    answered = true;
    const my = tok, t = cur.target, ok = x === t;
    try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch(e){}
    res.push(ok); api.answer(ok, {es: t.es, word: t.w});
    root.classList.add("ln-done");
    dots();
    if(ok){
      /* acierto: verde con ✓ y la palabra suena otra vez; luego, la ronda siguiente */
      score++;
      c.classList.add("is-ok"); c.querySelector(".ln-mk").innerHTML = IC("check", "bold", 20);
      c.setAttribute("aria-label", `${t.w}: ¡bien!`);
      api.haptic("success"); api.snd("ok");
      try{ if(window.M && typeof M.ok === "function") M.ok(c); }catch(e){}
      txt.innerHTML = `¡Muy bien! <b lang="${esc(code)}">${esc(t.w)}</b> = ${esc(t.es)}`;
      const sc = root.querySelector("#gm-sc"); if(sc){ sc.textContent = score; api.bump(sc.parentNode); }
      const t0 = performance.now();
      (async () => {
        await wait(200);
        if(tok !== my) return;
        await sayCard(t);
        await wait(Math.max(350, 1100 - (performance.now() - t0)));
        if(live() && tok === my) next();
      })();
      return;
    }
    /* fallo: la elegida en gris con ✗ (sin temblor ni sonido triste), la buena con ✓ y suenan las dos para compararlas */
    c.classList.add("is-miss"); c.querySelector(".ln-mk").innerHTML = IC("x", "bold", 18);
    c.setAttribute("aria-label", `${x.w}: no era esta. Toca para oírla`);
    const right = cards().find(el => el.dataset.w === t.w);
    if(right){ right.classList.add("is-right"); right.querySelector(".ln-mk").innerHTML = IC("check", "bold", 20); right.setAttribute("aria-label", `${t.w}: era esta. Toca para oírla`); }
    txt.innerHTML = `Sonaba <b lang="${esc(code)}">${esc(t.w)}</b>. ¡Escucha las dos!`;
    const n0 = talkN;
    (async () => {
      await wait(250);
      for(const w of [x, t]){
        if(tok !== my || talkN !== n0) break;   /* si el niño toca otra cosa para oírla, se deja de comparar */
        await sayCard(w);
        await wait(300);
      }
      if(tok === my) showNext();
    })();
  }
  function showNext(){
    if(!live() || nextBox.firstChild) return;
    const last = r + 1 >= ROUNDS;
    nextBox.innerHTML = `<button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="ln-go">${last ? "Ver el premio" : "Seguir"}${IC("caret-right", "bold", 20)}</button>`;
    const b = nextBox.querySelector("#ln-go");
    b.onclick = next;
    try{ b.focus({preventScroll: true}); }catch(e){}
  }
  function next(){
    if(!answered || !live()) return;
    tok++;
    try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch(e){}
    r++;
    if(r < ROUNDS){ round(); return; }
    const stars = score >= 7 ? 3 : score >= 5 ? 2 : 1;
    const seen = new Set(), words = [];
    rounds.forEach((o, i) => { const t = o.target; if(!seen.has(t.w)){ seen.add(t.w); words.push({word: t.w, es: t.es, img: t.img, miss: !res[i]}); } });
    api.finish(run, ID, {score, stars, words,
      line: score === ROUNDS ? `¡Las ${ROUNDS} a la primera! Tienes oído de lince.` : score ? `¡Acertaste ${score} de ${ROUNDS}!` : "¡Buen intento! Cada vez lo oirás mejor."});
  }
  box.addEventListener("click", e => {
    const c = e.target.closest(".ln-c"); if(!c || !live()) return;
    if(!answered){ choose(c); return; }
    /* después de un fallo, tocar una tarjeta dice su palabra (para comparar) */
    const x = cur && !res[res.length - 1] && cur.pair[+c.dataset.i];
    if(x){ talkN++; sayCard(x); }
  });
  playB.onclick = () => hear(false);
  root.querySelector("#ln-slow").onclick = () => hear(true);
  const kb = e => {
    if(!started || !cur || e.ctrlKey || e.metaKey || e.altKey) return;
    if(e.target.closest && e.target.closest("input,textarea,select")) return;
    const k = e.key;
    if(k === "1" || k === "2" || (!answered && (k === "ArrowLeft" || k === "ArrowRight"))){
      const c = cards()[k === "1" || k === "ArrowLeft" ? 0 : 1];
      if(c){ e.preventDefault(); c.click(); }
    } else if(k === " " && !(e.target.closest && e.target.closest("button,a"))){ e.preventDefault(); hear(false); }
    else if(k === "t" || k === "T"){ e.preventDefault(); hear(true); }
    else if(k === "Enter" && answered && nextBox.firstChild && !(e.target.closest && e.target.closest("button:not(#ln-go),a"))){ e.preventDefault(); next(); }
  };
  fit = api.autoFit(run, root.querySelector("#gm-dots"));
  round();
  api.intro(run, ID, () => { started = true; api.keys(run, kb); api.later(run, () => hear(false), RM() ? 200 : 450); });
}

const reg = window.vocabGames && typeof vocabGames.register === "function" && vocabGames.register(ID, {
  t: "Oído de lince", sub: "¿Cuál suena?", img: "img/games/lince.png",
  how: "Escucha la palabra. Las dos suenan casi igual: toca la que oyes.",
  words: "Palabras que suenan casi igual",
  rec: b => `${Number.isFinite(+b.score) ? +b.score : 0} de ${ROUNDS}`,
  start,
});
if(!reg) console.warn("[lince] no se pudo añadir a Juegos");
})();
