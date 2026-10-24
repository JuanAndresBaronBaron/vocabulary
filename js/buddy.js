/* Módulo buddy: misiones de hoy, palabra del día, cofre y el zorro del camino.
   El zorro ya no flota en una esquina: vive dentro del contenido (tarjeta de Hoy, camino) y sus frases de logros
   (misión cumplida) salen en la cápsula de avisos de arriba (M.toast). Nada de frases sueltas. Los aciertos seguidos
   de la lección los celebra ella misma (el chip de la llama de js/lesson.js).
   - Hoy: home() de index.html pinta las dos piezas que da este módulo. «Misiones» (misPiece(): la siguiente misión y 3
     puntos; al tocarla, la hoja #bd-mis-s con las 3 misiones de hoy, su progreso, «Recoger · 15» y el cofre de +25).
     «Palabra del día» (wotdPiece(): dibujo y palabra; al tocarla gira en 3D, enseña la traducción, la palabra y su IPA
     (ipaHtml() de index.html, salvo que un mayor la apague; va en el sitio de la etiqueta) y suena; detrás,
     «¡Me la sé!» la manda al repaso y da +3 la primera vez del día). Las monedas salen volando desde el botón
     (award(…, desde)). La pieza de Misiones salta una vez cuando hay una misión recién cumplida (attention()).
   - Mapa: el personaje junto a la lección actual (camina desde la anterior al terminar una) y «🎁 Regalo en N lecciones».
   - Mientras se juega a un minijuego (html[data-gm-play], lo pone games.js) los avisos de misión esperan al resultado.
   API: window.vocabBuddy = {missions(), misHtml(), paintMis(), misPiece(), openMissions(desde), claim(k, desde),
        openChest(desde), wotdPick(), wotdPiece(), paintWotd(girada), attention(), wire(), cheer(texto, icono)}.
        claim/openChest devuelven true si han pagado; attention() true si la pieza de Misiones ha saltado.
   Guarda: store "buddy:missions" {day, list:[{k, goal, n, s (lo que ya vio en la hoja), got}], chest} · "buddy:wotd" {day, seen, known, paid}.
   ("buddy:hide" era el ✕ del zorro flotante: ya no se escribe, pero la clave se conserva en la partida). */
(() => {
"use strict";

/* ---------- utilidades ---------- */
const MKEY = "buddy:missions", WKEY = "buddy:wotd";
const RM = () => { try{ return window.M && typeof window.M.rm === "function" ? window.M.rm() : matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };   /* M.rm() de js/motion.js */
const small = () => { try{ return matchMedia("(max-width:560px)").matches; }catch(e){ return false; } };
const snd = n => { try{ if(typeof sfx !== "undefined") sfx.play(n); }catch(e){} };
/* chispas (M.burst) en un elemento o en un punto: el confeti grande es solo del final de lección */
const spark = (at, n = 12) => { try{ if(window.M && typeof M.burst === "function" && at) M.burst(at, {n}); }catch(e){} };
/* logros: una cápsula de avisos arriba */
function cheer(text, icon){
  try{ if(window.M && typeof M.toast === "function"){ M.toast(text, icon ? {icon} : {}); return true; } }catch(e){}
  try{ if(typeof toast === "function"){ toast(text); return true; } }catch(e){}
  return false;
}
const pick = a => a[Math.floor(Math.random() * a.length)];
const dk = () => dayKey(new Date());
const curH = () => location.hash.replace(/^#\/?/, "");
const isHome = h => h === "" || h === "/";
const gmPlay = () => document.documentElement.hasAttribute("data-gm-play");

/* temporizadores de la página actual: se limpian al cambiar de ruta */
const TIMERS = new Set();
function later(fn, ms){ const t = setTimeout(() => { TIMERS.delete(t); try{ fn(); }catch(e){ console.error(e); } }, ms); TIMERS.add(t); return t; }
function clearLater(){ TIMERS.forEach(t => clearTimeout(t)); TIMERS.clear(); }

/* azar determinista por fecha */
function rng(seed){
  let h = 2166136261 >>> 0;
  for(let i = 0; i < seed.length; i++){ h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const sshuf = (arr, r) => { const a = [...arr]; for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };


/* ---------- estilos ---------- */
const STYLE = `
/* Hoy: las dos piezas (las pinta home() de index.html): contenido sólido, como las tarjetas */
.bd-piece{position:relative;min-width:0;margin:0}
.bd-mis{display:flex;flex-direction:column;align-items:stretch;min-height:120px;padding:14px 16px 16px;border:0;text-align:left;color:var(--label);
  font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.bd-pl{display:flex;align-items:center;gap:6px;min-width:0;font:600 var(--fs-note)/1.33 var(--f-text);color:var(--label2)}
.bd-pl .ico{flex:none;color:var(--brand-tint)}
.bd-pl span{min-width:0;overflow-wrap:anywhere}   /* con texto grande pasa a dos líneas, sin cortarse con puntos */
.bd-mt{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;margin:8px 0 10px;font:600 var(--fs-head)/1.22 var(--f-text);overflow-wrap:anywhere}
/* los 3 puntos de las misiones, iguales en la pieza de Hoy y en el cofre de la hoja: gris = por hacer, verde azulado =
   hecha, y con la marca ✓ = premio recogido */
.bd-dots{display:flex;gap:6px;margin-top:auto}
.bd-dots i,.bd-cdots i{position:relative;width:14px;height:14px;border-radius:7px;background:var(--fill)}
.bd-dots i.on,.bd-cdots i.on{background:var(--teal)}
.bd-dots i.got::after,.bd-cdots i.got::after{content:"";position:absolute;left:4px;top:3px;width:4px;height:7px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}
@media (forced-colors:active){.bd-dots i,.bd-cdots i{border:1px solid CanvasText}.bd-dots i.on,.bd-cdots i.on{background:CanvasText}}
.bd-bounce{animation:bd-bounce .62s cubic-bezier(.3,1.3,.5,1) 1}
@keyframes bd-bounce{0%,100%{translate:0 0}30%{translate:0 -12px}55%{translate:0 0}75%{translate:0 -4px}}
/* palabra del día: dos caras (dibujo y palabra · traducción) que giran en 3D */
.bd-wotd{display:grid;perspective:900px}
.bd-flip{position:relative;display:grid;min-width:0;transform-style:preserve-3d;transition:transform var(--d-slow,420ms) var(--sp-snappy,cubic-bezier(.2,.9,.25,1))}
.bd-flip.back{transform:rotateY(180deg)}
.bd-face{grid-area:1/1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px;margin:0;padding:14px 12px;border:0;text-align:center;color:var(--label);
  font:inherit;-webkit-backface-visibility:hidden;backface-visibility:hidden;cursor:pointer;-webkit-tap-highlight-color:transparent}
/* la etiqueta, a la izquierda como la de Misiones (también si pasa a dos líneas); en un móvil estrecho, sin margen a la
   derecha para que «Palabra del día» quepa en una línea (en 360 px no cabía y la pareja crecía 16 px) */
.bd-face .bd-pl{align-self:stretch;margin:0 4px 2px;text-align:left}
@media (max-width:379px){.bd-face .bd-pl{margin-right:0}}
.bd-wback{gap:2px;transform:rotateY(180deg)}
.bd-wimg{display:block;flex:none;width:64px;height:64px}
.bd-wotd .bd-wimg img{display:block;width:64px;height:64px;max-width:none;max-height:none;object-fit:contain}
@media (max-width:819px) and (max-height:760px){   /* móviles bajos: las piezas de Hoy, más bajas */
  .bd-mis{min-height:104px;padding:12px 14px}
  .bd-mt{margin:4px 0 8px;-webkit-line-clamp:2}
  .bd-face{padding:12px}
  .bd-wotd .bd-wimg img{width:48px;height:48px}}
.bd-ww{display:block;max-width:100%;margin:auto 0 0;font:700 calc(1.625rem*var(--k,1))/1.15 var(--f-round);overflow-wrap:anywhere;-webkit-hyphens:auto;hyphens:auto}
.bd-ww.s{font-size:calc(1.3125rem*var(--k,1))}.bd-ww.xs{font-size:calc(1.0625rem*var(--k,1))}
.bd-wtap{display:flex;flex-direction:column;align-items:center;gap:0;width:100%;margin:0 0 6px;padding:0;border:0;background:none;color:inherit;font:inherit;cursor:pointer}
.bd-wes{max-width:100%;font:700 calc(1.5rem*var(--k,1))/1.15 var(--f-round);overflow-wrap:anywhere}
/* detrás: la traducción en grande, la palabra (en el color del texto: es lo que se aprende) y su IPA en gris, en una sola
   línea (la pieza no crece: Hoy cabe); entre todo eso y «¡Me la sé!», 8 px como mínimo */
.bd-wsm{max-width:100%;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label);overflow-wrap:anywhere}
.bd-wipa{display:block;max-width:100%;font-size:var(--fs-note);line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bd-know{margin-top:auto;font-size:var(--fs-note)}
.bd-c{display:inline-flex;align-items:center;gap:3px;font-variant-numeric:tabular-nums}
.bd-c svg{display:block;width:16px;height:16px}
.bd-wok{display:inline-flex;align-items:center;gap:5px;margin-top:auto;min-height:var(--tap,44px);font:600 var(--fs-note)/1.2 var(--f-text);color:var(--ok-ink)}

/* hoja «Misiones de hoy» (M.openSheet): grupos sólidos sobre la hoja de vidrio */
dialog.bd-ms{max-width:560px}
.bd-ms-top{margin:0}
.bd-ms-sub{margin:0 0 16px;font:400 var(--fs-note)/1.33 var(--f-text);color:var(--label2);text-align:center}
.bd-ms-g{margin:0 0 12px;background:var(--card);border-radius:var(--r-card);overflow:hidden}
:root[data-theme=dark] .bd-ms-g{background:var(--card-2)}
.bd-row{position:relative;display:flex;align-items:center;gap:12px;min-height:64px;padding:10px 14px;color:var(--label);text-decoration:none}
.bd-row+.bd-row::before{content:"";position:absolute;top:0;left:62px;right:0;height:1px;background:var(--sep);transform:scaleY(.5);transform-origin:0 0}
.bd-ric{flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--brand-fill);color:#fff}
.bd-row.done .bd-ric,.bd-chest.ready .bd-ric{background:var(--gold);color:var(--gold-on)}
.bd-row.got .bd-ric,.bd-chest.open .bd-ric{background:var(--ok-fill);color:#fff}
.bd-chest.lock .bd-ric{background:var(--fill);color:var(--label2)}
.bd-rt{flex:1;min-width:0}
.bd-rt b{display:block;font:600 var(--fs-sub)/1.25 var(--f-text)}
.bd-rt small{display:block;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.bd-row.done .bd-rt small,.bd-row.got .bd-rt small,.bd-chest.open .bd-rt small{color:var(--ok-ink)}
.bd-bar{display:block;height:8px;margin:6px 0 4px;border-radius:4px;background:var(--fill);overflow:hidden}
.bd-bar i{display:block;height:100%;border-radius:4px;background:var(--teal);transition:width .6s cubic-bezier(.2,.9,.25,1)}
.bd-row.done .bd-bar i,.bd-row.got .bd-bar i{background:var(--ok)}
.bd-plus{display:inline-block;margin-left:6px;padding:0 7px;border-radius:99px;background:var(--gold);color:var(--gold-on);font-weight:800;animation:bd-stamp .5s cubic-bezier(.3,1.6,.5,1)}
.bd-chev{flex:none;color:var(--label3)}
:root[data-theme=dark] .bd-chev{color:rgba(235,235,245,.45)}
.bd-row .glass-btn{flex:none}
.bd-row.done{flex-wrap:wrap;row-gap:6px}.bd-row.done .bd-rt{flex-basis:calc(100% - 48px)}.bd-row.done .glass-btn{margin-left:48px}
.bd-cdots{display:flex;flex:none;gap:6px}
.bd-row.stamp .bd-ric{animation:bd-stamp .45s cubic-bezier(.3,1.6,.5,1)}
.bd-chest .bd-ric.boom{animation:bd-open .5s forwards}
@keyframes bd-stamp{0%{transform:scale(1.8);opacity:0}100%{transform:none;opacity:1}}
@keyframes bd-open{0%{transform:scale(1)}40%{transform:scale(1.4) rotate(8deg)}100%{transform:scale(1)}}
@keyframes bd-shake{0%,100%{transform:rotate(0)}15%{transform:rotate(-12deg) scale(1.08)}30%{transform:rotate(10deg) scale(1.08)}45%{transform:rotate(-6deg)}60%{transform:rotate(0)}}

/* mapa: avatar y regalo */
.bd-av{position:absolute;top:50%;z-index:3;cursor:pointer;-webkit-tap-highlight-color:transparent;translate:0 0;transition:translate 1.5s cubic-bezier(.45,.05,.4,1)}
.bd-av.r{left:calc(100% + 14px)}.bd-av.l{right:calc(100% + 14px)}
.bd-av-in{margin-top:-40px;filter:drop-shadow(0 4px 4px rgba(5,20,40,.3));animation:bd-bob 1.5s ease-in-out 3;transform-origin:50% 100%}
.bd-av-in .hero{display:block}
.bd-av::after{content:"";position:absolute;left:16%;right:16%;bottom:-4px;height:7px;border-radius:50%;background:rgba(5,20,40,.2);z-index:-1}
.bd-av.walk .bd-av-in{animation:bd-walk .34s ease-in-out infinite}
.bd-av.land .bd-av-in{animation:bd-jump .62s cubic-bezier(.3,.9,.4,1)}
.bd-avs{position:absolute;bottom:calc(100% + 46px);width:max-content;max-width:min(190px,calc(100vw - 40px));background:var(--card);color:var(--ink);border:2px solid var(--brand);border-radius:14px;padding:6px 11px;font-weight:800;font-size:.92rem;line-height:1.25;box-shadow:0 6px 16px rgba(5,20,40,.22);pointer-events:none;text-align:left;animation:bd-pop .35s cubic-bezier(.3,1.5,.5,1)}
.bd-av.l .bd-avs{left:-4px;transform-origin:20px 100%}.bd-av.r .bd-avs{right:-4px;transform-origin:calc(100% - 20px) 100%}
.bd-avs[hidden]{display:none}
@keyframes bd-jump{0%{transform:translateY(0)}35%{transform:translateY(-38px) scale(1.06)}62%{transform:translateY(0) scale(1.14,.86)}80%{transform:translateY(-8px)}100%{transform:none}}
@keyframes bd-pop{0%{transform:scale(.3);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes bd-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes bd-walk{0%,100%{transform:translateY(0) rotate(-7deg)}50%{transform:translateY(-9px) rotate(7deg)}}
.bd-gift{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px;background:rgba(0,0,0,.2);border-radius:999px;padding:6px 14px 6px 8px;font-weight:800;font-size:.95rem;width:max-content;max-width:100%}
.bd-gb{font-size:1.35rem;line-height:1}
.bd-gift.soon .bd-gb{animation:bd-shake 1.2s ease-in-out 3}
.bd-gdots{display:inline-flex;gap:5px}
.bd-gdots i{width:11px;height:11px;border-radius:50%;background:rgba(255,255,255,.35)}
.bd-gdots i.on{background:#FFCC00;box-shadow:0 0 0 2px rgba(0,0,0,.12)}
@media (prefers-reduced-motion: reduce){
  .bd-av-in,.bd-av.walk .bd-av-in,.bd-av.land .bd-av-in,.bd-gift.soon .bd-gb,.bd-avs,.bd-bounce,.bd-plus,.bd-row.stamp .bd-ric,.bd-chest .bd-ric.boom{animation:none!important}
  .bd-av{transition:none!important}
  /* la palabra del día no gira: las caras se cambian con un fundido corto */
  .bd-flip{transition:none!important}
  .bd-flip.back{transform:none}
  .bd-wback{transform:none;opacity:0;visibility:hidden}
  .bd-wfront,.bd-wback{transition:opacity .15s ease,visibility .15s}
  .bd-flip.back .bd-wfront{opacity:0;visibility:hidden}
  .bd-flip.back .bd-wback{opacity:1;visibility:visible}
  .bd-bar i{transition:none}
}
`;
function css(){
  if(document.getElementById("css-buddy")) return;
  const s = document.createElement("style"); s.id = "css-buddy"; s.textContent = STYLE; document.head.appendChild(s);
}
css();

/* tras responder, que se vea el botón «Continuar» / «Siguiente» sin quedar debajo de la barra de arriba */
function revealNext(){
  const go = document.getElementById("ls-go") || document.getElementById("nextq"); if(!go) return;
  const box = go.closest(".ls-foot") || go.closest("#after") || go, r = box.getBoundingClientRect();
  const limit = innerHeight - 12;
  if(r.bottom <= limit) return;
  let top = 10;
  for(const id of ["focusbar", "topbar"]){
    const el = document.getElementById(id);
    if(el && el.getClientRects().length && getComputedStyle(el).display !== "none"){ top = Math.max(top, el.getBoundingClientRect().bottom + 10); break; }
  }
  const dy = Math.min(r.bottom - limit, r.top - top);
  if(dy > 4) scrollBy({top: dy, behavior: RM() ? "auto" : "smooth"});
}

/* ---------- misiones de hoy ---------- */
/* especies: las de farm.js (farmMount.kinds) y, si no está, esta copia */
const ANIMALS =["gallina", "pato", "conejo", "abeja", "cerdo", "oveja", "cabra", "pavo", "vaca", "burro", "caballo"];
const PLANTS = ["flor", "girasol", "seta", "zanahoria", "fresa", "maiz", "calabaza", "trigo", "manzana"];
const TREES = ["arbol", "pino"];
const FARM_IDS = [...ANIMALS, ...PLANTS, ...TREES, "tienda", "cabana", "casa", "tractor", "fuente", "castillo", "cohete", "molino"];
const fmKinds = () => { try{ const K = typeof farmMount === "function" && farmMount.kinds; return K && Array.isArray(K.animal) ? K : null; }catch(e){ return null; } };
function farmCount(){
  const o = game().owned || {}, n = a => a.filter(id => o[id]).length, K = fmKinds();
  const ids = Array.isArray(SHOP) && SHOP.length ? SHOP.filter(x => x.t === "farm").map(x => x.id) : FARM_IDS;
  /* animales en la granja: los del refugio no cuentan (no se les puede dar de comer) */
  let an = n(K ? K.animal : ANIMALS);
  try{ if(farmMount.care && typeof farmMount.care.animals === "function") an = farmMount.care.animals().length; }catch(e){}
  return {an, pl: n(K ? K.plant : PLANTS), tr: n(K ? K.tree : TREES), all: n(ids)};
}
const plural = (n, one, many) => n === 1 ? `1 ${one}` : `${n} ${many}`;
/* ev: evento que la hace avanzar · ok(): si se puede hacer hoy · goal(): cuánto hay que hacer */
const MDEF = {
  les:  {ev: "lesson-done",  e: "🗺️", href: "#/mapa",     learn: true, t: g => `Termina ${plural(g, "lección", "lecciones")} del camino`},
  ans:  {ev: "answer",       e: "✅", href: "#/mapa",     learn: true, t: g => `Acierta ${g} respuestas`},
  rev:  {ev: "review-card",  e: "🔁", href: "#/repaso",   learn: true, t: g => `Repasa ${plural(g, "palabra", "palabras")}`, ok: () => dueList().length >= 4, goal: () => Math.min(10, dueList().length)},
  game: {ev: "game-done",    e: "🎮", href: "#/juegos",   t: () => "Juega a un minijuego", ok: () => typeof ROUTES === "object" && typeof ROUTES.juegos === "function"},
  /* cada animal come como mucho una vez cada 8 h: el objetivo son sus animales (hasta 4) */
  feed: {ev: "farm-feed",    e: "🍽️", href: "#/granja",   t: g => g === 1 ? "Da de comer a tu animal" : "Da de comer a tus animales", ok: () => farmCount().an >= 1, goal: () => Math.min(4, farmCount().an)},
  harv: {ev: "farm-harvest", e: "🧺", href: "#/granja",   t: g => `Cosecha ${plural(g, "planta", "plantas")}`, ok: () => farmCount().pl >= 1, goal: () => Math.min(2, farmCount().pl)},
  /* cada animal da 1 o 2 regalos por comida (como mucho cada 8 h) y cada árbol 1 cada 3 h: el objetivo depende de cuántos tiene */
  coll: {ev: "farm-collect", e: "🥚", href: "#/granja",   t: g => `Recoge ${plural(g, "tesoro", "tesoros")} de la granja`, ok: () => farmCount().an + farmCount().tr >= 1, goal: () => Math.min(3, farmCount().an + farmCount().tr)},
  find: {ev: "farm-find",    e: "🔍", href: "#/granja",   t: g => `Encuentra ${plural(g, "cosa", "cosas")} en la granja`, ok: () => farmCount().all >= 3},
};
const BASE_GOAL = {les: 1, ans: 15, rev: 10, game: 1, feed: 1, harv: 2, coll: 3, find: 5};
function makeMissions(day){
  const r = rng("buddy|" + day);
  const can = k => { try{ return !MDEF[k].ok || !!MDEF[k].ok(); }catch(e){ return false; } };
  const goalOf = k => {
    if(k === "les") return r() < .5 ? 1 : 2;
    try{ return Math.max(1, MDEF[k].goal ? MDEF[k].goal() : BASE_GOAL[k]); }catch(e){ return BASE_GOAL[k]; }
  };
  const all = sshuf(Object.keys(MDEF), r).filter(can);
  const learn = all.filter(k => MDEF[k].learn);
  const first = learn[0] || "les";
  const rest = all.filter(k => k !== first).slice(0, 2);
  while(rest.length < 2){ const k = ["ans", "les", "rev"].find(x => x !== first && !rest.includes(x)); if(!k) break; rest.push(k); }
  return {day, list: [first, ...rest].map(k => ({k, goal: goalOf(k), n: 0, s: 0, got: false})), chest: false};
}
function missions(){
  const day = dk();
  let M = store.get(MKEY, null);
  const bad = m => !m || typeof m !== "object" || !MDEF[m.k] || !(m.goal >= 1) || typeof m.n !== "number" || !(m.n >= 0);
  if(!M || typeof M !== "object" || M.day !== day || !Array.isArray(M.list) || M.list.length !== 3 || M.list.some(bad)){
    M = makeMissions(day); store.set(MKEY, M);
  }
  return M;
}
const mText = m => MDEF[m.k].t(m.goal);
/* icono de cada misión (Phosphor) */
const MIC = {les: "map-trifold", ans: "check", rev: "arrow-counter-clockwise", game: "game-controller", feed: "bowl-food", harv: "basket", coll: "egg", find: "magnifying-glass"};
const icon = (n, s = "bold", z = 20, c = "") => { try{ return typeof ico === "function" ? ico(n, s, z, c) : ""; }catch(e){ return ""; } };
const COIN = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="11" fill="#FFCC00"/><circle cx="12" cy="12" r="10.5" fill="none" stroke="#C7A000" stroke-opacity=".8"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#B39000" stroke-opacity=".55" stroke-width="1.4"/><path d="M12 7.8 13.06 10.54 15.99 10.7 13.71 12.56 14.47 15.4 12 13.8 9.53 15.4 10.29 12.56 8.01 10.7 10.94 10.54Z" fill="#A88700" fill-opacity=".8"/></svg>`;
const mKey = (M, m) => M.day + "|" + m.k;
/* misiones recién cumplidas que ya han hecho saltar la pieza en esta visita (salta una vez por misión) */
const JUMPED = new Set();
function bump(ev, d){
  if((ev === "answer" || ev === "farm-find") && !(d && d.ok)) return;
  const M = missions(), fresh = [];
  if(!M.list.some(m => MDEF[m.k].ev === ev)) return;
  for(const m of M.list){
    if(MDEF[m.k].ev !== ev || m.n >= m.goal) continue;
    m.n++; if(m.n >= m.goal) fresh.push(m);
  }
  store.set(MKEY, M); paintMis();
  /* en Hoy, la pieza de Misiones salta; fuera, un aviso en la cápsula de arriba. En mitad de un minijuego espera al
     resultado: un aviso encima taparía las burbujas o los globos */
  if(fresh.length && isHome(curH())){ fresh.forEach(m => JUMPED.add(mKey(M, m))); bounce(document.getElementById("bd-mis")); }
  fresh.forEach((m, i) => setTimeout(() => {
    if(gmPlay()){ pendMis.push(m); return; }
    misNotice(m);
  }, 900 + i * 2400));
}
let pendMis = [];
function misNotice(m){
  if(gmPlay()){ pendMis.push(m); return; }
  snd("pop");
  if(!isHome(curH())) cheer(`¡Misión cumplida! ${mText(m)}`, "🎯");
}
/* la pieza salta una vez (nada con «Reducir movimiento») */
function bounce(el){
  if(!el || RM()) return false;
  el.classList.remove("bd-bounce"); void el.offsetWidth; el.classList.add("bd-bounce");
  el.addEventListener("animationend", () => el.classList.remove("bd-bounce"), {once: true});
  return true;
}
/* al entrar en Hoy: si hay una misión cumplida que aún no ha visto en la hoja, la pieza salta (una vez) */
function attention(){
  const el = document.getElementById("bd-mis"); if(!el) return false;
  const M = missions();
  const fresh = M.list.filter(m => m.n >= m.goal && !m.got && !(typeof m.s === "number" && m.s >= m.goal) && !JUMPED.has(mKey(M, m)));
  if(!fresh.length) return false;
  fresh.forEach(m => JUMPED.add(mKey(M, m)));
  return bounce(el);
}

/* pieza de Hoy: la siguiente misión que toca y 3 puntos (uno por misión cumplida) */
function misNext(M){
  if(M.list.some(m => !m.got && m.n >= m.goal)) return "¡Recoge tu premio!";
  const todo = M.list.find(m => m.n < m.goal);
  if(todo) return mText(todo);
  return M.chest ? "¡Todo hecho! Mañana hay más" : "¡Abre el cofre sorpresa!";
}
const misDots = M => M.list.map(m => `<i class="${m.n >= m.goal ? "on" : ""}${m.got ? " got" : ""}"></i>`).join("");
function misPieceInner(){
  const M = missions();
  return `<span class="bd-pl">${icon("target", "fill", 18)}<span>Misiones</span></span><span class="bd-mt">${esc(misNext(M))}</span>
    <span class="bd-dots" aria-hidden="true">${misDots(M)}</span>`;
}
function misLabel(){ const M = missions(), done = M.list.filter(m => m.n >= m.goal).length; return `Misiones de hoy: ${misNext(M)} ${done} de 3 hechas.`; }
function misPiece(){
  return `<button type="button" class="card bd-piece bd-mis" id="bd-mis" aria-haspopup="dialog" aria-label="${esc(misLabel())}">${misPieceInner()}</button>`;
}

/* contenido de la hoja: las 3 misiones con su barra y el cofre */
function misHtml(){
  const M = missions(), got = M.list.filter(m => m.got).length;
  const rows = M.list.map(m => {
    const pct = Math.min(100, Math.round(100 * m.n / m.goal)), full = m.n >= m.goal;
    /* lo que ha avanzado desde la última vez que la abrió: la barra crece delante de él y sale «+N» */
    const from = typeof m.s === "number" && m.s < m.n ? Math.max(0, m.s) : m.n, grow = Math.min(m.n, m.goal) - Math.min(from, m.goal);
    const pct0 = Math.min(100, Math.round(100 * from / m.goal));
    const ic = `<span class="bd-ric" aria-hidden="true">${icon(m.got ? "check" : MIC[m.k] || "target", "bold", 20)}</span>`;
    const txt = `<span class="bd-rt"><b>${esc(mText(m))}</b>
      <span class="bd-bar" role="progressbar" aria-label="${esc(mText(m))}" aria-valuemin="0" aria-valuemax="${m.goal}" aria-valuenow="${Math.min(m.n, m.goal)}"><i style="width:${grow > 0 ? pct0 : pct}%"${grow > 0 ? ` data-to="${pct}"` : ""}></i></span>
      <small>${m.got ? "¡Conseguida!" : full ? "¡Lo lograste!" : `${Math.min(m.n, m.goal)} de ${m.goal}`}${grow > 0 && !m.got ? `<span class="bd-plus" aria-hidden="true">+${grow}</span>` : ""}</small></span>`;
    if(m.got) return `<div class="bd-row got" data-k="${m.k}">${ic}${txt}</div>`;
    if(full) return `<div class="bd-row done" data-k="${m.k}">${ic}${txt}<button type="button" class="glass-btn glass-btn--pri glass-btn--sm" data-get="${m.k}" aria-label="Recoger 15 monedas">Recoger<span class="bd-c">${COIN}15</span></button></div>`;
    return `<a class="bd-row" href="${MDEF[m.k].href}" data-k="${m.k}" aria-label="${esc(mText(m))}: ${m.n} de ${m.goal}. ¡Vamos!">${ic}${txt}${icon("caret-right", "bold", 16, "bd-chev")}</a>`;
  }).join("");
  const chest = M.chest
    ? `<div class="bd-row bd-chest open"><span class="bd-ric" aria-hidden="true">${icon("treasure-chest", "bold", 20)}</span><span class="bd-rt"><b>¡Cofre abierto!</b><small>Mañana habrá misiones nuevas</small></span></div>`
    : got === M.list.length
    ? `<div class="bd-row bd-chest ready"><span class="bd-ric" aria-hidden="true">${icon("treasure-chest", "bold", 20)}</span><span class="bd-rt"><b>¡Cofre sorpresa!</b><small>Hiciste las 3 misiones</small></span><button type="button" class="glass-btn glass-btn--pri glass-btn--sm" data-chest="1" aria-label="Abrir el cofre: 25 monedas">Abrir<span class="bd-c">${COIN}25</span></button></div>`
    : `<div class="bd-row bd-chest lock"><span class="bd-ric" aria-hidden="true">${icon("treasure-chest", "bold", 20)}</span><span class="bd-rt"><b>Cofre sorpresa</b><small>Recoge las 3 misiones para abrirlo</small></span><span class="bd-cdots" role="img" aria-label="${got} de 3 recogidas">${misDots(M)}</span></div>`;
  return `<div class="m-head bd-ms-top"><h2 id="bd-ms-tt">Misiones de hoy</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Listo</button></div>
    <p class="bd-ms-sub">${M.chest ? "¡Todas hechas! Mañana hay más." : "Haz las 3 y abre el cofre sorpresa."}</p>
    <div class="bd-ms-g">${rows}</div><div class="bd-ms-g">${chest}</div>`;
}
/* pinta lo que se vea: la pieza de Hoy y la hoja (si está abierta) */
function paintMis(){
  const p = document.getElementById("bd-mis");
  if(p){ p.innerHTML = misPieceInner(); p.setAttribute("aria-label", misLabel()); }
  if(MS && MS.open){ MS.querySelector(".bd-ms-in").innerHTML = misHtml(); animBars(); }
}
/* las barras que han avanzado crecen hasta su sitio; se apunta lo que el niño ya ha visto */
function animBars(){
  const M = missions(); let ch = false;
  M.list.forEach(m => { if(m.s !== m.n){ m.s = m.n; ch = true; } });
  if(ch) store.set(MKEY, M);
  const bars = MS ? [...MS.querySelectorAll(".bd-bar i[data-to]")] : []; if(!bars.length) return;
  const go = () => bars.forEach(i => { i.style.width = i.dataset.to + "%"; i.removeAttribute("data-to"); });
  if(RM()) return go();
  later(go, 420); later(() => snd("pop"), 460);
}
/* la hoja: se crea la primera vez y se cierra sola si se va a otra pantalla (una fila lleva a su sitio) */
let MS = null;
function misSheet(){
  if(MS && MS.isConnected) return MS;
  MS = document.createElement("dialog"); MS.id = "bd-mis-s"; MS.className = "bd-ms"; MS.setAttribute("aria-labelledby", "bd-ms-tt");
  MS.innerHTML = `<div class="bd-ms-in"></div>`;
  MS.addEventListener("click", e => {
    if(e.target.closest("[data-close]")){ closeMissions(); return; }
    onMisClick(e);
  });
  document.body.appendChild(MS);
  return MS;
}
function openMissions(from){
  const d = misSheet();
  d.querySelector(".bd-ms-in").innerHTML = misHtml();
  let p;
  try{ p = window.M && typeof M.openSheet === "function" ? M.openSheet(d, {from: from || null}) : (d.showModal(), Promise.resolve()); }catch(e){ console.error(e); p = Promise.resolve(); }
  animBars();
  return p;
}
function closeMissions(){
  if(!MS || !MS.open) return;
  if(window.M && typeof M.closeSheet === "function") M.closeSheet(MS); else MS.close();
}
addEventListener("hashchange", () => { if(MS && MS.open) MS.close(); });
/* el zorro de la tarjeta de Hoy da un saltito (no con «Reducir movimiento») */
function hop(){
  const f = document.getElementById("hm-fox"); if(!f || RM()) return;
  f.classList.remove("wave", "hop"); void f.offsetWidth; f.classList.add("hop");
  f.addEventListener("animationend", () => f.classList.remove("hop"), {once: true});
}
/* recoger una misión cumplida: +15 🪙 que salen volando desde «desde» (el botón) hasta el contador */
function claim(k, from){
  const M = missions(), m = M.list.find(x => x.k === k);
  if(!m || m.got || m.n < m.goal) return false;
  m.got = true; store.set(MKEY, M);
  award(15, "¡Misión cumplida!", false, from || null); hop();
  paintMis();
  const row = MS && MS.querySelector(`.bd-row[data-k="${m.k}"]`);
  if(row){ row.classList.add("stamp"); row.tabIndex = -1; try{ row.focus({preventScroll: true}); }catch(e){} }
  if(M.list.every(x => x.got)) setTimeout(() => {
    snd("gift");
    const c = MS && MS.open && MS.querySelector(".bd-chest"); if(c && c.scrollIntoView) c.scrollIntoView({block: "nearest", behavior: RM() ? "auto" : "smooth"});
  }, 1300);
  return true;
}
/* abrir el cofre cuando las 3 están recogidas: +25 🪙 */
function openChest(from){
  const M = missions(); if(M.chest || !M.list.every(x => x.got)) return false;
  M.chest = true; store.set(MKEY, M);
  const box = MS && MS.querySelector(".bd-chest .bd-ric"); if(box) box.classList.add("boom");
  snd("gift");
  const at = from && from.getBoundingClientRect ? from.getBoundingClientRect() : null;
  const pt = at && (at.width || at.height) ? {x: at.left + at.width / 2, y: at.top + at.height / 2} : null;
  setTimeout(() => {
    if(pt) spark(pt, 16);
    award(25, "¡Cofre de misiones!", false, pt); hop(); paintMis();
  }, RM() ? 0 : 420);
  return true;
}
function onMisClick(e){
  const g = e.target.closest("[data-get]");
  if(g){ if(claim(g.dataset.get, g)) g.disabled = true; return; }
  const c = e.target.closest("[data-chest]");
  if(c && openChest(c)) c.disabled = true;
}

/* ---------- palabra del día ---------- */
/* temas con dibujos claros para un niño (si no existen, se usan todos los de «temas» y «3000») */
const KID_DOCS = ["animales", "colores", "familia", "profesiones", "paises", "w02", "w03", "w04", "w05", "w06", "w07", "w09", "w10", "w13", "w15"];
async function wotdPick(){
  const L = lang, day = dk(), idx = await getIndex(), r = rng("wotd|" + day);
  let pool = idx.filter(d => (d.group === "temas" || d.group === "3000") && d.langs.includes(L) && !["numeros", "nacionalidades"].includes(d.id));
  const kid = pool.filter(d => KID_DOCS.includes(d.id)); if(kid.length) pool = kid;
  const docs = sshuf(pool, r);
  for(const d of docs.slice(0, 12)){
    let doc = null; try{ doc = await getDoc(d.id); }catch(e){ continue; }
    const rows = (doc.rows || []).filter(x => x.es && x.img && x.l && x.l[L] && x.l[L].word
      && (d.group === "temas" ? !x.level || ["A1", "A2"].includes(x.level) : ["A1", "A2"].includes(x.level) && (!x.pos || x.pos === "noun")));
    if(rows.length) return {doc: d.id, r: rows[Math.floor(r() * rows.length)]};
  }
  return null;
}
function wState(){
  const day = dk(); let w = store.get(WKEY, null);
  if(!w || typeof w !== "object" || w.day !== day) w = {day, seen: {}, known: {}, paid: false};
  if(!w.seen || typeof w.seen !== "object") w.seen = {};
  if(!w.known || typeof w.known !== "object") w.known = {};
  return w;
}
/* la pieza guarda qué palabra es (data-doc / data-es); se busca en CACHE al tocarla */
function wotdOf(el){
  const doc = el && CACHE[el.dataset.doc], r = doc && (doc.rows || []).find(x => x.es === el.dataset.es && x.l && x.l[lang]);
  return r ? {doc: el.dataset.doc, r} : null;
}
/* dos caras: delante el dibujo y la palabra; detrás la traducción y «¡Me la sé!» (o «En tu repaso») */
function wotdInner(x, back){
  if(!x) return "";
  const r = x.r, d = r.l[lang], w = wState(), known = !!w.known[lang], code = (LANGS[lang] || {}).code || "";
  /* detrás, la IPA va en el sitio de la etiqueta (delante ya se lee «Palabra del día»): la pieza no crece y Hoy cabe. Con
     dos formas («/fʁɛʁ/ · /sœʁ/», «/ˈweɪtə/, /ˈweɪtrəs/») solo la primera (las dos están en Palabras); y si aun así no
     cabe, termina en «…» */
  const ipa = ipaHtml(String(d.ipa || "").split(/ · |, /)[0], code, "bd-wipa");
  const len = [...d.word].length, sz = len > 13 ? " xs" : len > 8 ? " s" : "";
  const lbl = `<span class="bd-pl">${icon("sparkle", "fill", 18)}<span>Palabra del día</span></span>`;
  return `<div class="bd-flip${back ? " back" : ""}">
    <button type="button" class="card bd-face bd-wfront" aria-label="Palabra del día: ${esc(d.word)}. Toca para darle la vuelta y oírla"${back ? " inert" : ""}>
      ${lbl}<span class="bd-wimg img"><img src="${esc(r.img)}" alt="" loading="lazy" draggable="false"></span><b class="bd-ww${sz}" lang="${esc(code)}">${esc(d.word)}</b></button>
    <div class="card bd-face bd-wback" data-press="sink"${back ? "" : " inert"}>
      <button type="button" class="bd-wtap" aria-label="${esc(d.word)} es ${esc(r.es)}. Toca para volver y oírla">${ipa ? "" : lbl}<b class="bd-wes">${esc(r.es)}</b><span class="bd-wsm" lang="${esc(code)}">${esc(d.word)}</span>${ipa}</button>
      ${known ? `<span class="bd-wok">${icon("check", "bold", 16)}En tu repaso</span>`
        : `<button type="button" class="glass-btn glass-btn--sm bd-know" data-know="1"${w.paid ? "" : ' aria-label="¡Me la sé! Gana 3 monedas"'}>¡Me la sé!${w.paid ? "" : `<span class="bd-c">${COIN}3</span>`}</button>`}
    </div></div>`;
}
async function wotdPiece(){
  let x = null; try{ x = await wotdPick(); }catch(e){ console.error(e); }
  return x ? `<section class="bd-piece bd-wotd" id="bd-wotd" data-doc="${esc(x.doc)}" data-es="${esc(x.r.es)}" aria-label="Palabra del día">${wotdInner(x, false)}</section>` : "";
}
function paintWotd(flip){
  const el = document.getElementById("bd-wotd"), x = wotdOf(el); if(!x) return;
  el.innerHTML = wotdInner(x, !!flip);
}
/* girar la pieza (y pasar el foco a la otra cara si estaba dentro) */
function flipWotd(el, back){
  const f = el.querySelector(".bd-flip"); if(!f) return;
  const b = back == null ? !f.classList.contains("back") : !!back, had = el.contains(document.activeElement);
  f.classList.toggle("back", b);
  const fr = f.querySelector(".bd-wfront"), bk = f.querySelector(".bd-wback");
  if(fr) fr.inert = b; if(bk) bk.inert = !b;
  if(had){ const t = b ? bk && bk.querySelector(".bd-wtap") : fr; try{ if(t) t.focus({preventScroll: true}); }catch(e){} }
}
function onWotdClick(e){
  const el = e.currentTarget, x = wotdOf(el); if(!x) return;
  const d = x.r.l[lang], k = e.target.closest("[data-know]");
  if(k){
    const w = wState(); if(w.known[lang]) return;
    w.known[lang] = true; w.seen[lang] = true;
    let n = 0; try{ n = srsAdd(x.doc, [x.r], 1); }catch(err){}
    const pay = !w.paid; w.paid = true; store.set(WKEY, w);
    const rc = k.getBoundingClientRect(), pt = {x: rc.left + rc.width / 2, y: rc.top + rc.height / 2};
    spark(pt, 12);
    if(pay) award(3, "¡Palabra del día!", false, pt); else { snd("ok"); toast(n ? "➕ ¡Añadida a tu repaso!" : "¡Ya estaba en tu repaso!"); }
    hop(); paintWotd(true);
    const t = el.querySelector(".bd-wtap"); try{ if(t) t.focus({preventScroll: true}); }catch(err){}
    return;
  }
  if(!e.target.closest(".bd-face")) return;
  const w = wState(); if(!w.seen[lang]){ w.seen[lang] = true; store.set(WKEY, w); }
  flipWotd(el);
  try{ say(d.word); }catch(err){}
}

/* ---------- Hoy ---------- */
function wireHome(){
  const m = document.getElementById("bd-mis"); if(m) m.onclick = () => openMissions(m);
  const w = document.getElementById("bd-wotd"); if(w) w.onclick = onWotdClick;
}

/* ---------- mapa: avatar y regalo ---------- */
let walk = null;
function mapDeco(){
  const app = document.getElementById("app"); if(!app || !app.querySelector(".path")) return;
  const head = app.querySelector(".lv-head");
  if(head && !head.querySelector(".bd-gift")){
    let n = 0; try{ n = Object.keys(allMapP()).length; }catch(e){}
    const left = 5 - (n % 5), have = 5 - left;
    head.insertAdjacentHTML("beforeend", `<div class="bd-gift${left === 1 ? " soon" : ""}"><span class="bd-gb" aria-hidden="true">🎁</span><span>${left === 1 ? "¡Regalo en la próxima lección!" : `Regalo en ${left} lecciones`}</span><span class="bd-gdots" aria-hidden="true">${[0, 1, 2, 3, 4].map(i => `<i class="${i < have ? "on" : ""}"></i>`).join("")}</span></div>`);
  }
  const cur = document.getElementById("cur-node") || document.getElementById("trophy"); if(!cur) return;
  const nd = cur.closest(".nd"); if(!nd || nd.querySelector(".bd-av")) return;
  const x = parseFloat(nd.style.getPropertyValue("--x")) || 0, gram = cur.classList.contains("gram");
  const side = gram ? (x > 0 ? "r" : "l") : (x > 0 ? "l" : "r");
  nd.insertAdjacentHTML("beforeend", `<div class="bd-av ${side}" role="img" aria-label="¡Tú estás aquí!" title="¡Estás aquí!"><div class="bd-av-in">${heroHtml(small() ? 42 : 46)}</div><span class="bd-avs" hidden></span></div>`);
  const av = nd.querySelector(".bd-av"), bub = av.querySelector(".bd-avs");
  let bubT = 0;
  /* mientras habla, el cartel «SIGUIENTE» del nodo se aparta para que no se tapen */
  const pill = nd.querySelector(".bubble");
  const avSay = (t, ms = 2400) => {
    bub.textContent = t; bub.hidden = false; bub.style.animation = "none"; void bub.offsetWidth; bub.style.animation = "";
    if(pill) pill.style.visibility = "hidden";
    clearTimeout(bubT); TIMERS.delete(bubT);
    bubT = later(() => { bub.hidden = true; if(pill) pill.style.visibility = ""; }, ms);
  };
  /* al tocarlo salta y dice algo útil: qué tocar, cuánto falta para el regalo… */
  const lines = () => {
    let n = 0; try{ n = Object.keys(allMapP()).length; }catch(e){}
    const left = 5 - (n % 5);
    return [
      cur.id === "trophy" ? "¡Nivel completado! 🏆 ¡Eres un campeón!" : gram ? "¡Toca el 📘 para aprender gramática!" : "¡Toca la ⭐ para empezar!",
      left === 1 ? "¡Una lección más y hay regalo! 🎁" : `¡Faltan ${left} lecciones para el regalo! 🎁`,
      "¡Estoy aquí! 📍 ¡Vamos!", "¡Qué bien lo estás haciendo! 🌟",
    ];
  };
  let tapN = 0;
  av.addEventListener("click", () => {
    av.classList.remove("land"); void av.offsetWidth; av.classList.add("land"); snd("pop");
    setTimeout(() => av.classList.remove("land"), 700);
    const L = lines(); avSay(L[tapN++ % L.length]);
  });
  /* venimos de terminar una lección (la primera vez): camina desde la anterior */
  const w = walk; walk = null;
  if(!w || Date.now() - w.t > 10 * 60e3 || RM()) return;
  let prev = null; try{ prev = app.querySelector(`.node[data-ls="${CSS.escape(w.id)}"]`); }catch(e){}
  if(!prev || prev === cur) return;
  const a = prev.getBoundingClientRect(), c = cur.getBoundingClientRect();
  const dx = Math.round(a.left + a.width / 2 - (c.left + c.width / 2)), dy = Math.round(a.top + a.height / 2 - (c.top + c.height / 2));
  av.style.transition = "none"; av.style.translate = `${dx}px ${dy}px`; av.classList.add("walk");
  void av.offsetWidth;
  later(() => { av.style.transition = ""; av.style.translate = "0px 0px"; snd("whoosh"); }, 350);
  later(() => {
    av.classList.remove("walk"); av.classList.add("land"); snd("pop");
    spark(av, 8);
    later(() => av.classList.remove("land"), 700);
    avSay(cur.id === "trophy" ? "¡Llegué al trofeo! 🏆" : pick(["¡Siguiente parada! 🚩", "¡Ya estoy aquí! 🎉", "¡A por la siguiente! 🚀"]), 2600);
  }, 1900);
}

/* ---------- eventos ---------- */
bus.on("route", d => {
  const h = String((d && d.h) || "");
  clearLater(); if(!h.startsWith("juegos/")) pendMis = [];
  if(h.startsWith("mapa")){ try{ mapDeco(); }catch(e){ console.error(e); } }
  else if(!h.startsWith("leccion")) walk = null;
});
bus.on("answer", d => {
  bump("answer", d);
  if(d && ["lesson", "grammar", "test"].includes(d.where)) later(revealNext, 140);
});
bus.on("lesson-done", d => {
  /* solo la primera vez: al repetir una lección antigua no cruza medio mapa */
  walk = d && d.id && d.first !== false ? {id: d.id, lv: d.lv, t: Date.now()} : null;
  bump("lesson-done", d);
});
bus.on("review-card", d => bump("review-card", d));
bus.on("game-done", d => {
  bump("game-done", d);
  /* misiones cumplidas durante la partida: se cuentan ahora, después del resultado */
  if(pendMis.length){ const P = pendMis.splice(0); P.forEach((m, i) => later(() => misNotice(m), 2600 + i * 2400)); }
});
bus.on("farm-feed", d => bump("farm-feed", d));
bus.on("farm-harvest", d => bump("farm-harvest", d));
bus.on("farm-collect", d => bump("farm-collect", d));
bus.on("farm-find", d => bump("farm-find", d));

window.vocabBuddy = {missions, misHtml, paintMis, misPiece, openMissions, claim, openChest, wotdPick, wotdPiece, paintWotd, attention, wire: wireHome, cheer};
})();
