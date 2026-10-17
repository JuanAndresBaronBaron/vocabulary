/* Módulo buddy: misiones de hoy, palabra del día, cofre y el zorro del camino.
   El zorro ya no flota en una esquina: vive dentro del contenido (tarjeta de Hoy, camino) y sus frases de logros
   (misión cumplida, 5 o 10 aciertos seguidos) salen en la cápsula de avisos de arriba (M.toast). Nada de frases sueltas.
   - Portada (HOME_SLOTS): «🎯 Misiones de hoy» (3 al día, deterministas por fecha, +15 🪙 cada una y cofre de +25 🪙)
     y «🌟 Palabra del día» (+3 🪙 la primera vez que dice «¡Me la sé!»). Las monedas salen volando desde el botón (award(…, desde)).
   - Mapa: el personaje junto a la lección actual (camina desde la anterior al terminar una) y «🎁 Regalo en N lecciones».
   - Mientras se juega a un minijuego (html[data-gm-play], lo pone games.js) los avisos de misión esperan al resultado.
   API: window.vocabBuddy = {missions(), misHtml(), paintMis(), claim(k, desde), openChest(desde), wotdPick(), paintWotd(),
        wire(), cheer(texto, icono)}. claim/openChest devuelven true si han pagado.
   Guarda: store "buddy:missions" {day, list:[{k, goal, n, s (lo que ya vio en la portada), got}], chest} · "buddy:wotd" {day, seen, known, paid}.
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
/* portada: misiones y palabra del día */
.bd-slot{margin:0 0 14px}
/* las dos tarjetas juntas: en escritorio una al lado de la otra y con la misma altura */
.bd-duo{display:grid;gap:14px;margin:0 0 14px}
.bd-duo>.bd-slot{margin:0;min-width:0}
@media (min-width:900px){.bd-duo{grid-template-columns:1fr 1fr;align-items:stretch}
  .bd-duo .bd-wotd{display:flex;flex-direction:column}.bd-duo .bd-wotd .bd-wb{flex:1}
  .bd-duo .bd-wotd .bd-wimg{width:150px;height:150px}.bd-duo .bd-wotd .bd-wimg .img img{max-width:124px;max-height:124px}}
.bd-mh{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.bd-mh h2{margin:0;font-size:1.25rem}
.bd-pill{margin-left:auto;background:var(--soft);border:2px solid var(--line);border-radius:999px;padding:3px 11px;font-weight:800;color:var(--muted);font-size:.88rem;white-space:nowrap}
.bd-rows{display:grid;gap:10px}
.bd-row{display:grid;grid-template-columns:50px 1fr auto;align-items:center;gap:12px;padding:10px 12px;border-radius:16px;border:2px solid var(--line);background:var(--card);text-decoration:none;color:var(--ink);min-height:70px;transition:transform .12s,border-color .2s,background .3s}
a.bd-row:hover{border-color:var(--brand)}
a.bd-row:active{transform:translateY(2px)}
.bd-ic{width:50px;height:50px;border-radius:15px;background:var(--soft);display:flex;align-items:center;justify-content:center;font-size:1.65rem}
.bd-mt{min-width:0;display:block}
.bd-mt b{display:block;font-size:1rem;line-height:1.2}
.bd-bar{display:block;height:12px;border-radius:99px;background:var(--line);overflow:hidden;margin:6px 0 3px}
.bd-bar i{display:block;height:100%;border-radius:99px;background:var(--teal);transition:width .6s}
.bd-mt small{display:block;color:var(--muted);font-weight:700;font-size:.82rem}
.bd-go{width:40px;height:40px;border-radius:50%;background:var(--soft);color:var(--brand);font-size:1.5rem;font-weight:900;display:flex;align-items:center;justify-content:center;line-height:1}
.bd-row.done{border-color:#FFCC00;background:color-mix(in srgb,#FFCC00 14%,var(--card))}
.bd-row.done .bd-ic{background:color-mix(in srgb,#FFCC00 35%,var(--card))}
.bd-row.done .bd-bar i{background:var(--gold)}
.bd-row.got{border-color:color-mix(in srgb,var(--ok) 45%,var(--line))}
.bd-row.got .bd-bar i{background:var(--ok)}
.bd-row.got .bd-mt small{color:var(--ok-ink)}
.bd-plus{display:inline-block;margin-left:6px;padding:0 7px;border-radius:99px;background:#FFCC00;color:#3D2B00;font-weight:900;animation:bd-stamp .5s cubic-bezier(.3,1.6,.5,1)}
.bd-get{border:0;border-radius:14px;background:#FFCC00;color:#3D2B00;font-weight:900;font-size:1rem;padding:10px 14px;min-height:46px;box-shadow:0 4px 0 #B38F00;white-space:nowrap;animation:bd-pulse 1.5s ease-in-out 3}
.bd-get:hover{background:#f7d774}
.bd-get:active{transform:translateY(3px);box-shadow:0 1px 0 #B38F00;animation:none}
.bd-check{width:42px;height:42px;border-radius:50%;background:#23843f;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.3rem}
.bd-row.stamp .bd-check{animation:bd-stamp .45s cubic-bezier(.3,1.6,.5,1)}
.bd-chest{display:flex;align-items:center;gap:12px;margin-top:12px;padding:10px 12px;border-radius:16px;border:2px dashed var(--line);color:var(--muted);min-height:70px}
.bd-box{font-size:2.3rem;line-height:1;filter:grayscale(1);opacity:.5;flex:none}
.bd-ct{flex:1;min-width:0}.bd-ct b{display:block;color:var(--ink)}.bd-ct small{display:block;font-weight:600}
.bd-cdots{display:flex;gap:6px}
.bd-cdots i{width:14px;height:14px;border-radius:50%;background:var(--line)}
.bd-cdots i.on{background:#FFCC00;box-shadow:0 0 0 2px color-mix(in srgb,#FFCC00 50%,transparent)}
.bd-chest.ready{border:2px solid #FFCC00;background:linear-gradient(120deg,color-mix(in srgb,#FFCC00 24%,var(--card)),var(--card));color:var(--ink)}
.bd-chest.ready .bd-box{filter:none;opacity:1;animation:bd-shake 1s ease-in-out 3}
.bd-chest.open{border-style:solid;border-color:color-mix(in srgb,var(--ok) 45%,var(--line))}
.bd-chest.open .bd-box{filter:none;opacity:1;animation:bd-stamp .5s}
@keyframes bd-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes bd-stamp{0%{transform:scale(2.2) rotate(-20deg);opacity:0}100%{transform:none;opacity:1}}
@keyframes bd-shake{0%,100%{transform:rotate(0)}15%{transform:rotate(-12deg) scale(1.08)}30%{transform:rotate(10deg) scale(1.08)}45%{transform:rotate(-6deg)}60%{transform:rotate(0)}}
@keyframes bd-open{0%{transform:scale(1)}40%{transform:scale(1.5) rotate(8deg)}100%{transform:scale(0);opacity:0}}
.bd-chest .bd-box.boom{animation:bd-open .5s forwards}
.bd-wb{display:flex;gap:16px;align-items:center}
.bd-wimg{flex:none;width:128px;height:128px;border-radius:22px;border:2px solid var(--line);background:var(--soft);display:flex;align-items:center;justify-content:center;padding:8px;cursor:pointer;transition:transform .12s;-webkit-tap-highlight-color:transparent}
.bd-wimg:hover{border-color:var(--brand)}
.bd-wimg .img img{max-width:104px;max-height:104px}
.bd-wimg .img .ph{width:96px;height:96px;font-size:2.4rem}
.bd-wimg.boing{animation:bd-boing .5s}
[data-theme=dark] .bd-wimg{background:#fff;border-color:#fff}
@keyframes bd-boing{0%,100%{transform:scale(1)}30%{transform:scale(1.12,.9)}60%{transform:scale(.94,1.06)}}
.bd-wt{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px;align-items:flex-start}
.bd-wes{color:var(--muted);font-weight:800;font-size:1.1rem}
.bd-ww{font-size:2rem;font-weight:900;color:var(--brand);line-height:1.1;word-break:break-word}
.bd-ww.flip{animation:bd-flip .5s cubic-bezier(.3,1.4,.5,1)}
@keyframes bd-flip{0%{transform:rotateX(90deg);opacity:0}100%{transform:none;opacity:1}}
.bd-wsay{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.bd-wsay .say{width:44px;height:44px;font-size:1.15rem}
.bd-wsay .pron{color:var(--muted)}
.bd-reveal{border:2px dashed var(--brand);background:var(--soft);color:var(--brand);border-radius:16px;padding:10px 14px;font-weight:900;font-size:1.05rem;min-height:56px;text-align:left;line-height:1.2;animation:bd-pulse 1.8s ease-in-out 3}
.bd-reveal small{display:block;font-weight:700;color:var(--muted);font-size:.85rem;margin-top:2px}
.bd-wotd .ex{margin-top:12px}
.bd-wotd .ex .say.sm{width:44px;height:44px;font-size:1.05rem}
.bd-wfoot{margin-top:12px}
.bd-whint{margin-top:12px;padding:9px 12px;border-radius:12px;background:var(--soft);color:var(--muted);font-weight:700;font-size:.92rem;text-align:center}
.bd-know{width:100%;font-size:1.1rem;min-height:52px}
.bd-known{display:flex;align-items:center;gap:10px;background:color-mix(in srgb,var(--ok) 13%,var(--card));color:var(--ok-ink);border-radius:14px;padding:10px 14px;font-weight:800}
.bd-known span{font-size:1.5rem}
.bd-known small{display:block;color:var(--muted);font-weight:600}
@media (max-width:480px){
  .bd-row{grid-template-columns:46px 1fr auto;gap:10px;padding:10px}
  .bd-ic{width:46px;height:46px;font-size:1.5rem}
  .bd-row.done{grid-template-columns:46px 1fr}
  .bd-row.done .bd-get{grid-column:1/-1;width:100%}
  .bd-wimg{width:100px;height:100px;border-radius:18px}
  .bd-wimg .img img{max-width:82px;max-height:82px}
  .bd-ww{font-size:1.65rem}
  .bd-chest.ready{flex-wrap:wrap}.bd-chest.ready .bd-get{width:100%}
}

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
  .bd-av-in,.bd-av.walk .bd-av-in,.bd-av.land .bd-av-in,.bd-get,.bd-reveal,.bd-chest.ready .bd-box,.bd-gift.soon .bd-gb,.bd-ww.flip,.bd-wimg.boing,.bd-avs,.bd-plus,.bd-row.stamp .bd-check,.bd-chest .bd-box.boom,.bd-chest.open .bd-box{animation:none!important}
  .bd-av{transition:none!important}
}
`;
function css(){
  if(document.getElementById("css-buddy")) return;
  const s = document.createElement("style"); s.id = "css-buddy"; s.textContent = STYLE; document.head.appendChild(s);
}
css();

/* ---------- aciertos seguidos (lección y gramática) ---------- */
let streakN = 0;
function onStreak(d){
  if(!d) return;
  if(!d.ok){ streakN = 0; return; }
  streakN++;
  if(streakN === 5) cheer("¡5 seguidas! ¡Imparable!", "🚀");
  else if(streakN === 10) cheer("¡10 seguidas! ¡Eres una máquina!", "🤖");
}

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
function bump(ev, d){
  if((ev === "answer" || ev === "farm-find") && !(d && d.ok)) return;
  const M = missions(), fresh = [];
  if(!M.list.some(m => MDEF[m.k].ev === ev)) return;
  for(const m of M.list){
    if(MDEF[m.k].ev !== ev || m.n >= m.goal) continue;
    m.n++; if(m.n >= m.goal) fresh.push(m);
  }
  store.set(MKEY, M); paintMis();
  /* aviso en la cápsula de arriba (en la portada basta con la tarjeta). En mitad de un minijuego espera al
     resultado: un aviso encima taparía las burbujas o los globos */
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
function misHtml(){
  const M = missions(), got = M.list.filter(m => m.got).length, done = M.list.filter(m => m.n >= m.goal).length;
  const rows = M.list.map(m => {
    const D = MDEF[m.k], pct = Math.min(100, Math.round(100 * m.n / m.goal)), full = m.n >= m.goal;
    /* lo que ha avanzado desde la última vez que lo vio: la barra crece delante de él y sale «+N» */
    const from = typeof m.s === "number" && m.s < m.n ? Math.max(0, m.s) : m.n, grow = Math.min(m.n, m.goal) - Math.min(from, m.goal);
    const pct0 = Math.min(100, Math.round(100 * from / m.goal));
    const inner = `<span class="bd-ic" aria-hidden="true">${D.e}</span><span class="bd-mt"><b>${esc(mText(m))}</b>
      <span class="bd-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${m.goal}" aria-valuenow="${Math.min(m.n, m.goal)}"><i style="width:${grow > 0 ? pct0 : pct}%"${grow > 0 ? ` data-to="${pct}"` : ""}></i></span>
      <small>${m.got ? "¡Conseguida! 🎉" : full ? "¡Lo lograste! 🎉" : `${m.n} de ${m.goal}`}${grow > 0 && !m.got ? `<span class="bd-plus" aria-hidden="true">+${grow}</span>` : ""}</small></span>`;
    if(m.got) return `<div class="bd-row got" data-k="${m.k}">${inner}<span class="bd-check" aria-label="Recogida">✓</span></div>`;
    if(full) return `<div class="bd-row done" data-k="${m.k}">${inner}<button type="button" class="bd-get" data-get="${m.k}">¡Recoger! +15 🪙</button></div>`;
    return `<a class="bd-row" href="${D.href}" data-k="${m.k}" aria-label="${esc(mText(m))}: ${m.n} de ${m.goal}. ¡Vamos!">${inner}<span class="bd-go" aria-hidden="true">›</span></a>`;
  }).join("");
  const chest = M.chest
    ? `<div class="bd-chest open"><span class="bd-box" aria-hidden="true">🎉</span><span class="bd-ct"><b>¡Cofre abierto! +25 🪙</b><small>Mañana habrá misiones nuevas 🌙</small></span></div>`
    : got === M.list.length
    ? `<div class="bd-chest ready"><span class="bd-box" aria-hidden="true">🎁</span><span class="bd-ct"><b>¡Cofre sorpresa!</b><small>¡Hiciste las 3 misiones!</small></span><button type="button" class="bd-get" data-chest="1">¡Abrir! +25 🪙</button></div>`
    : `<div class="bd-chest"><span class="bd-box" aria-hidden="true">🎁</span><span class="bd-ct"><b>Cofre sorpresa</b><small>Recoge las 3 misiones para abrirlo</small></span><span class="bd-cdots" aria-label="${got} de 3">${M.list.map(m => `<i class="${m.got ? "on" : ""}"></i>`).join("")}</span></div>`;
  return `<div class="bd-mh"><h2>🎯 Misiones de hoy</h2><span class="bd-pill">⭐ ${done}/3</span></div><div class="bd-rows">${rows}</div>${chest}`;
}
function paintMis(){ const el = document.getElementById("bd-mis"); if(el){ el.innerHTML = misHtml(); animBars(); } }
/* las barras que han avanzado crecen hasta su sitio; se apunta lo que el niño ya ha visto */
function animBars(){
  const M = missions(); let ch = false;
  M.list.forEach(m => { if(m.s !== m.n){ m.s = m.n; ch = true; } });
  if(ch) store.set(MKEY, M);
  const bars = [...document.querySelectorAll("#bd-mis .bd-bar i[data-to]")]; if(!bars.length) return;
  const go = () => bars.forEach(i => { i.style.width = i.dataset.to + "%"; i.removeAttribute("data-to"); });
  if(RM()) return go();
  later(go, 380); later(() => snd("pop"), 420);
}
/* el botón «Mi granja» de la portada enseña las monedas: se pone al día al ganar en la portada */
function homeCoins(){ const s = document.querySelector(".big-acts .a3 small"); if(s && /monedas/.test(s.textContent)) s.textContent = `🪙 ${game().coins} monedas`; }
bus.on("coins", () => { if(isHome(curH())) homeCoins(); });
function hopHello(){ const h = document.querySelector(".hello .hero"); if(!h || RM()) return; try{ h.animate([{transform: "none"}, {transform: "translateY(-18px) scale(1.06)"}, {transform: "none"}], {duration: 500, easing: "ease-out"}); }catch(e){} }
/* recoger una misión cumplida: +15 🪙 que salen volando desde «desde» (el botón) hasta el contador */
function claim(k, from){
  const M = missions(), m = M.list.find(x => x.k === k);
  if(!m || m.got || m.n < m.goal) return false;
  m.got = true; store.set(MKEY, M);
  award(15, "¡Misión cumplida!", false, from || null); hopHello();
  paintMis();
  const row = document.querySelector(`#bd-mis .bd-row[data-k="${m.k}"]`); if(row) row.classList.add("stamp");
  if(M.list.every(x => x.got)) setTimeout(() => { snd("gift"); const c = document.querySelector("#bd-mis .bd-chest"); if(c && c.scrollIntoView && !RM()) c.scrollIntoView({block: "nearest", behavior: "smooth"}); }, 1300);
  return true;
}
/* abrir el cofre cuando las 3 están recogidas: +25 🪙 */
function openChest(from){
  const M = missions(); if(M.chest || !M.list.every(x => x.got)) return false;
  M.chest = true; store.set(MKEY, M);
  const box = document.querySelector("#bd-mis .bd-box"); if(box) box.classList.add("boom");
  snd("gift");
  const at = from && from.getBoundingClientRect ? from.getBoundingClientRect() : null;
  const pt = at && (at.width || at.height) ? {x: at.left + at.width / 2, y: at.top + at.height / 2} : null;
  setTimeout(() => {
    if(pt) spark(pt, 16);
    award(25, "¡Cofre de misiones!", false, pt); hopHello(); paintMis();
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
/* la tarjeta guarda qué palabra es (data-doc / data-es); se busca en CACHE al tocarla */
function wotdOf(el){
  const doc = el && CACHE[el.dataset.doc], r = doc && (doc.rows || []).find(x => x.es === el.dataset.es && x.l && x.l[lang]);
  return r ? {doc: el.dataset.doc, r} : null;
}
function wotdInner(x){
  if(!x) return "";
  const r = x.r, d = r.l[lang], w = wState(), seen = !!w.seen[lang], known = !!w.known[lang];
  const when = new Date().toLocaleDateString("es", {weekday: "long", day: "numeric"});
  return `<div class="bd-mh"><h2>🌟 Palabra del día</h2><span class="bd-pill">📅 ${esc(when)}</span></div>
    <div class="bd-wb">
      <button type="button" class="bd-wimg" ${seen ? `data-say="${esc(d.word)}"` : ""} aria-label="${seen ? "Escuchar" : "Descubrir la palabra"}">${imgHtml(r)}</button>
      <div class="bd-wt"><div class="bd-wes">${esc(r.es)}</div>
        ${seen ? `<div class="bd-ww">${esc(d.word)}</div><div class="bd-wsay">${sayBtn(d.word)}${d.pron ? `<span class="pron">${esc(d.pron)}</span>` : ""}</div>`
               : `<button type="button" class="bd-reveal" data-reveal="1">❓ ¿Cómo se dice en ${esc(LANGS[lang].name)}?<small>¡Toca para descubrirlo!</small></button>`}
      </div></div>
    ${seen && d.ex ? `<div class="ex">${esc(d.ex)} ${sayBtn(d.ex, 1)}<div class="tr">${esc(d.ex_es || "")}</div></div>` : ""}
    ${!seen ? `<div class="bd-whint">👆 Descúbrela, escúchala y dila en voz alta${w.paid ? "" : " · ¡Te da +3 🪙!"}</div>` : ""}
    ${seen ? `<div class="bd-wfoot">${known
      ? `<div class="bd-known"><span>✅</span><div>¡Ya está en tu repaso!<small>Mañana habrá otra palabra 🌙</small></div></div>`
      : `<button type="button" class="btn lc bd-know" data-know="1" style="--lc:#008932">✋ ¡Me la sé!${w.paid ? "" : " +3 🪙"}</button>`}</div>` : ""}`;
}
function paintWotd(flip){
  const el = document.getElementById("bd-wotd"), x = wotdOf(el); if(!x) return;
  el.innerHTML = wotdInner(x);
  if(flip){ const w = el.querySelector(".bd-ww"); if(w) w.classList.add("flip"); }
}
function onWotdClick(e){
  const x = wotdOf(e.currentTarget); if(!x) return;
  const d = x.r.l[lang];
  if(e.target.closest("[data-reveal]") || (e.target.closest(".bd-wimg") && !wState().seen[lang])){
    const w = wState(); w.seen[lang] = true; store.set(WKEY, w);
    paintWotd(true); snd("pop");
    setTimeout(() => { const b = document.querySelector("#bd-wotd .bd-wsay .say"); try{ say(d.word, b); }catch(err){} }, 250);
    return;
  }
  const img = e.target.closest(".bd-wimg");
  if(img){ img.classList.remove("boing"); void img.offsetWidth; img.classList.add("boing"); return; }
  const k = e.target.closest("[data-know]");
  if(k){
    const w = wState(); if(w.known[lang]) return;
    w.known[lang] = true;
    let n = 0; try{ n = srsAdd(x.doc, [x.r], 1); }catch(err){}
    const pay = !w.paid; w.paid = true; store.set(WKEY, w);
    spark(k, 12);
    if(pay) award(3, "¡Palabra del día!", false, k); else { snd("ok"); toast(n ? "➕ ¡Añadida a tu repaso!" : "¡Ya estaba en tu repaso!"); }
    hopHello(); paintWotd(false);
  }
}

/* ---------- portada ---------- */
HOME_SLOTS.push(async () => `<section class="panel bd-slot bd-mis" id="bd-mis" aria-label="Misiones de hoy">${misHtml()}</section>`);
HOME_SLOTS.push(async () => {
  let x = null; try{ x = await wotdPick(); }catch(e){}
  return x ? `<section class="panel bd-slot bd-wotd" id="bd-wotd" data-doc="${esc(x.doc)}" data-es="${esc(x.r.es)}" aria-label="Palabra del día">${wotdInner(x)}</section>` : "";
});
function wireHome(){
  const m = document.getElementById("bd-mis"); if(m) m.onclick = onMisClick;
  const w = document.getElementById("bd-wotd"); if(w) w.onclick = onWotdClick;
  /* las dos tarjetas en una rejilla (misma altura en escritorio) */
  if(m && w && m.nextElementSibling === w && !m.parentElement.classList.contains("bd-duo")){
    const d = document.createElement("div"); d.className = "bd-duo"; m.before(d); d.append(m, w);
  }
  if(m) animBars();
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
  clearLater(); streakN = 0; if(!h.startsWith("juegos/")) pendMis = [];
  if(isHome(h)) wireHome();
  if(h.startsWith("mapa")){ try{ mapDeco(); }catch(e){ console.error(e); } }
  else if(!h.startsWith("leccion")) walk = null;
});
bus.on("answer", d => {
  if(d && (d.where === "lesson" || d.where === "grammar")) onStreak(d);
  bump("answer", d);
  if(d && ["lesson", "grammar", "test"].includes(d.where)) later(revealNext, 140);
});
bus.on("lesson-done", d => {
  /* solo la primera vez: al repetir una lección antigua no cruza medio mapa */
  walk = d && d.id && d.first !== false ? {id: d.id, lv: d.lv, t: Date.now()} : null;
  streakN = 0;
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

window.vocabBuddy = {missions, misHtml, paintMis, claim, openChest, wotdPick, paintWotd, wire: wireHome, cheer};
})();
