/* Módulo buddy: compañero, misiones de hoy, palabra del día y avatar en el mapa.
   - Compañero flotante (abajo a la izquierda) en lecciones, repaso, documentos (prácticas y tests) y juegos:
     reacciona a "answer", "game-done", "review-card", "lesson-done"… Se puede esconder (✕) y volver a llamar.
     Si tapa un botón, se esconde solo en el borde de la pantalla.
   - Portada (HOME_SLOTS): «🎯 Misiones de hoy» (3 al día, deterministas por fecha) y «🌟 Palabra del día».
   - Mapa: el personaje junto a la lección actual (camina desde la anterior al terminar una) y «🎁 Regalo en N lecciones».
   - Mientras se juega a un minijuego (html[data-gm-play], lo pone games.js) se aparta y no se puede tocar.
   Guarda: store "buddy:hide" (bool) · "buddy:missions" {day, list:[{k, goal, n, s (lo que ya vio en la portada), got}], chest} · "buddy:wotd" {day, seen, known, paid}. */
(() => {
"use strict";

/* ---------- utilidades ---------- */
const MKEY = "buddy:missions", WKEY = "buddy:wotd", HKEY = "buddy:hide";
const RM = () => { try{ return window.M && typeof window.M.rm === "function" ? window.M.rm() : matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };   /* M.rm() de js/motion.js */
const small = () => { try{ return matchMedia("(max-width:560px)").matches; }catch(e){ return false; } };
const snd = n => { try{ if(typeof sfx !== "undefined") sfx.play(n); }catch(e){} };
const boom = o => { try{ if(typeof confetti === "function") confetti(o); }catch(e){} };
const pick = a => a[Math.floor(Math.random() * a.length)];
const dk = () => dayKey(new Date());
const curH = () => location.hash.replace(/^#\/?/, "");
const isHome = h => h === "" || h === "/";
const BUDDY_RE = /^(leccion\/|repaso|doc\/|juegos)/;

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
/* compañero flotante */
.bd{position:fixed;left:calc(10px + env(safe-area-inset-left,0px));bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:25;transition:transform .4s cubic-bezier(.3,1.3,.5,1),left .3s}
.bd[hidden],.bd-peek[hidden]{display:none!important}
.bd-me{display:block;position:relative;border:0;background:none;padding:0;margin:0;cursor:pointer;line-height:1;-webkit-tap-highlight-color:transparent;touch-action:manipulation;filter:drop-shadow(0 5px 6px rgba(5,20,40,.28));animation:bd-idle 2.6s ease-in-out 3;transform-origin:50% 100%}
.bd-me .hero{display:block}
.bd-me::after{content:"";position:absolute;left:18%;right:18%;bottom:-6px;height:7px;border-radius:50%;background:rgba(5,20,40,.22);filter:blur(1px);z-index:-1}
.bd-me:focus-visible{outline:3px solid var(--brand);outline-offset:4px;border-radius:14px}
.bd-me.jump{animation:bd-jump .62s cubic-bezier(.3,.9,.4,1)}
.bd-me.wobble{animation:bd-wobble .6s ease-in-out}
.bd-me.spin{animation:bd-spin .7s cubic-bezier(.4,1.4,.5,1);transform-origin:50% 55%}
.bd-me.hey{animation:bd-hey .5s ease-out}
.bd-x{position:absolute;right:-10px;top:-8px;width:26px;height:26px;border-radius:50%;border:2px solid var(--line);background:var(--card);color:var(--muted);font-size:.72rem;font-weight:900;line-height:1;display:flex;align-items:center;justify-content:center;padding:0;box-shadow:var(--shadow);opacity:.9}
.bd-x::before{content:"";position:absolute;inset:-10px;border-radius:50%}
.bd-x:hover{color:var(--ink);border-color:var(--brand);opacity:1}
.bd-say{position:absolute;left:calc(100% + 12px);bottom:42%;width:max-content;max-width:min(230px,calc(100vw - 112px));background:var(--card);color:var(--ink);border:2px solid var(--brand);border-radius:16px;padding:8px 13px;font-weight:800;font-size:1rem;line-height:1.25;box-shadow:0 8px 22px rgba(5,20,40,.22);pointer-events:none;white-space:pre-line;transform-origin:0 100%;animation:bd-pop .38s cubic-bezier(.3,1.5,.5,1)}
.bd-say::after{content:"";position:absolute;left:-8px;bottom:12px;width:12px;height:12px;background:inherit;border-left:2px solid;border-bottom:2px solid;border-color:inherit;transform:rotate(45deg)}
.bd-say.ok{border-color:var(--ok)}
.bd-say.bad{border-color:#FFCC00}
.bd-say.gold{border-color:#FFCC00;background:color-mix(in srgb,#FFCC00 18%,var(--card))}
.bd.tuck{transform:translateX(calc(-100% - 10px + 16px))}
.bd.tuck .bd-x,.bd.tuck:not(.out) .bd-say{display:none}
.bd.tuck:not(.out) .bd-me{animation:none}
/* escondido en el borde, sale un momento a hablar: no se puede tocar (los toques pasan al botón de debajo) */
.bd.tuck.out{transform:none;pointer-events:none}
.bd-peek{position:fixed;left:0;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:25;width:46px;height:50px;border-radius:0 25px 25px 0;border:2px solid var(--line);border-left:0;background:var(--card);box-shadow:var(--shadow);font-size:1.35rem;display:flex;align-items:center;justify-content:center;padding:0 2px 0 0;transition:transform .3s}
.bd-peek:hover{border-color:var(--brand)}
.bd-peek.tuck{transform:translateX(-30px)}
/* mientras se juega a un minijuego (games.js marca html[data-gm-play]) se aparta del todo y no se puede tocar */
html[data-gm-play] .bd{transform:translateX(calc(-100% - 10px + 14px));pointer-events:none}
html[data-gm-play] .bd .bd-say,html[data-gm-play] .bd .bd-x{display:none}
html[data-gm-play] .bd .bd-me{animation:none}
html[data-gm-play] .bd-peek{transform:translateX(-32px);pointer-events:none}
body.bd-pad footer{padding-bottom:130px}
.bd-float{position:fixed;z-index:26;font-size:1.6rem;pointer-events:none;transform:translate(-50%,0);animation:bd-float 1.1s ease-out forwards}
.bd-fly{position:fixed;z-index:45;font-size:1.5rem;pointer-events:none;left:0;top:0}
.hbtn.coin.bd-bump{animation:bd-bump .45s}
@keyframes bd-idle{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-3px) scale(1.02,.98)}}
@keyframes bd-jump{0%{transform:translateY(0)}35%{transform:translateY(-38px) scale(1.06)}62%{transform:translateY(0) scale(1.14,.86)}80%{transform:translateY(-8px)}100%{transform:none}}
@keyframes bd-wobble{0%,100%{transform:rotate(0)}20%{transform:rotate(-14deg)}40%{transform:rotate(11deg)}60%{transform:rotate(-7deg)}80%{transform:rotate(4deg)}}
@keyframes bd-spin{0%{transform:rotate(0) scale(1)}50%{transform:rotate(180deg) scale(1.15)}100%{transform:rotate(360deg) scale(1)}}
@keyframes bd-hey{0%{transform:scale(.4) translateY(30px);opacity:0}70%{transform:scale(1.12)}100%{transform:none;opacity:1}}
@keyframes bd-pop{0%{transform:scale(.3);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes bd-float{0%{transform:translate(-50%,0) scale(.6);opacity:0}20%{opacity:1;transform:translate(-50%,-14px) scale(1.15)}100%{transform:translate(-50%,-80px) scale(1);opacity:0}}
@keyframes bd-bump{0%,100%{transform:scale(1)}40%{transform:scale(1.22)}}

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
@keyframes bd-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes bd-walk{0%,100%{transform:translateY(0) rotate(-7deg)}50%{transform:translateY(-9px) rotate(7deg)}}
.bd-gift{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px;background:rgba(0,0,0,.2);border-radius:999px;padding:6px 14px 6px 8px;font-weight:800;font-size:.95rem;width:max-content;max-width:100%}
.bd-gb{font-size:1.35rem;line-height:1}
.bd-gift.soon .bd-gb{animation:bd-shake 1.2s ease-in-out 3}
.bd-gdots{display:inline-flex;gap:5px}
.bd-gdots i{width:11px;height:11px;border-radius:50%;background:rgba(255,255,255,.35)}
.bd-gdots i.on{background:#FFCC00;box-shadow:0 0 0 2px rgba(0,0,0,.12)}
@media (prefers-reduced-motion: reduce){
  .bd-me,.bd-me.jump,.bd-me.wobble,.bd-me.spin,.bd-me.hey,.bd-av-in,.bd-av.walk .bd-av-in,.bd-av.land .bd-av-in,.bd-get,.bd-reveal,.bd-chest.ready .bd-box,.bd-gift.soon .bd-gb,.bd-say,.bd-ww.flip,.bd-wimg.boing,.bd-avs,.bd-plus{animation:none!important}
  .bd,.bd-av,.bd-peek{transition:none!important}
}
`;
function css(){
  if(document.getElementById("css-buddy")) return;
  const s = document.createElement("style"); s.id = "css-buddy"; s.textContent = STYLE; document.head.appendChild(s);
}
css();

/* ---------- frases ---------- */
const OK_LINES = ["¡Genial!", "¡Eres un crack!", "¡Así se hace!", "¡Muy bien! ⭐", "¡Toma ya! 🙌", "¡Bravo! 👏", "¡Perfecto!", "¡Qué cerebro! 💡", "¡Lo sabías! 😎", "¡Increíble!", "¡Sí señor! 💪", "¡Chócala! ✋"];
const BAD_LINES = ["¡Casi! Tú puedes 💪", "¡Uy! La próxima sale 🍀", "¡No pasa nada!\nAsí se aprende 💡", "¡Ánimo! Ya casi 💪", "¡Fallar también es aprender! 🌱", "¡Venga, a por la siguiente! 🚀"];
const TAP_LINES = [
  "¡Ji, ji! ¡Me haces cosquillas! 😆", "¡Choca esos cinco! ✋", "Consejo: toca 🐢 para oír la palabra despacito.",
  "Consejo: repite las palabras en voz alta. ¡Funciona! 🗣️", "¿Sabías que los pulpos tienen 3 corazones? 🌊",
  "¿Sabías que las abejas bailan para hablar? 🐝", "Cada 5 lecciones… ¡hay un regalo! 🎁", "Repasar un poquito cada día es el truco de los campeones 🏆",
  "Si te equivocas, no pasa nada. ¡Así aprende el cerebro! 💡", "Me encanta aprender contigo 💙", "¿Has visto tu granja hoy? ¡Los animales te esperan! 🐔",
  "Los koalas duermen 20 horas al día. ¡Qué vagos! 🐨", "¡Bip, bup! Modo estudio activado 🤖", "¿Un chiste? ¿Qué le dice un 1 a un 10? ¡Para ser como yo, sé sincero! 😂",
];
const IDLE_LINES = ["¿Seguimos? ¡Tú puedes! 💪", "¿Sigues ahí? 👀 ¡Te espero!", "¡Vamos, lo estás haciendo genial! 🌟"];
const TUCK_LINES = ["¡Me escondo para no tapar los botones! 🙈", "¡Estoy aquí escondido! 👀", "¡Cu-cú! 🙈 Sigo contigo"];
const HELLO = {leccion: ["¡Vamos allá! 🚀", "¡A por esta lección! 💪"], repaso: ["¿Te acuerdas? ¡A ver! 🤔", "¡Hora de repasar! 🔁"], doc: ["¡A practicar! 📚", "¡Vamos a aprender! ✨"], juegos: ["¡A jugar! 🎮", "¡Que empiece el juego! 🕹️"]};

/* ---------- compañero flotante ---------- */
let B = null, sayT = 0, outT = 0, scT = 0, idleT = 0, streakN = 0, lastHello = {}, mo = null, ro = null, dRaf = 0;
const heroSize = () => small() ? 48 : 56;
/* games.js marca <html data-gm-play> mientras se juega: el compañero se aparta */
const gmPlay = () => document.documentElement.hasAttribute("data-gm-play");
function buddy(){
  if(B && document.body.contains(B.root)) return B;
  const root = document.createElement("div"); root.className = "bd"; root.id = "bd-buddy"; root.hidden = true;
  root.innerHTML = `<button type="button" class="bd-me" aria-label="Tu compañero. ¡Tócalo!" title="¡Tócame!"></button>
    <div class="bd-say" role="status" aria-live="polite" hidden></div>
    <button type="button" class="bd-x" aria-label="Esconder al compañero" title="Esconder">✕</button>`;
  const peek = document.createElement("button");
  peek.type = "button"; peek.className = "bd-peek"; peek.id = "bd-peek"; peek.hidden = true;
  peek.setAttribute("aria-label", "Llamar a tu compañero"); peek.title = "Llamar a tu compañero";
  document.body.append(root, peek);
  B = {root, peek, me: root.querySelector(".bd-me"), say: root.querySelector(".bd-say"), x: root.querySelector(".bd-x")};
  B.me.addEventListener("click", onTap);
  B.x.addEventListener("click", () => { store.set(HKEY, true); snd("whoosh"); syncBuddy(curH()); });
  peek.addEventListener("click", () => {
    store.set(HKEY, false); syncBuddy(curH()); act("hey"); snd("pop");
    later(() => talk(pick(["¡Aquí estoy! 👋", "¡He vuelto! 😄", "¿Me echabas de menos? 😉"]), "", 2200), 350);
  });
  return B;
}
function visible(){ return !!(B && !B.root.hidden && document.body.contains(B.root)); }
function tucked(){ return !!(B && B.root.classList.contains("tuck")) || gmPlay(); }
function syncBuddy(h){
  const on = BUDDY_RE.test(h), hide = !!store.get(HKEY, false);
  if(!on && !B) return;
  const b = buddy();
  b.root.hidden = !on || hide; b.peek.hidden = !on || !hide;
  document.body.classList.toggle("bd-pad", on);
  b.say.hidden = true; clearTimeout(sayT); clearTimeout(outT);
  b.root.classList.remove("out");
  if(on){
    b.me.innerHTML = heroHtml(heroSize());
    { const hi = itemById(game().wear.hero) || itemById("zorro"); b.peek.innerHTML = `<span aria-hidden="true">${typeof pjImg === "function" && hi ? pjImg(hi) : esc((hi || {}).e || "🦊")}</span>`; }
    watch(true); queueDodge();
  } else { watch(false); b.root.classList.remove("tuck"); b.peek.classList.remove("tuck"); }
}
/* bocadillo. Si está escondido en el borde, sale un momento a decirlo (sin poder tocarse) y vuelve a esconderse */
function talk(text, kind = "", ms = 1900){
  if(!visible() || gmPlay()) return false;
  if(B.root.classList.contains("tuck")) peekOut(ms + 350);
  const s = B.say; s.textContent = text; s.className = "bd-say" + (kind ? " " + kind : ""); s.hidden = false;
  s.style.animation = "none"; void s.offsetWidth; s.style.animation = "";
  clearTimeout(sayT); sayT = setTimeout(() => { if(B) B.say.hidden = true; }, ms);
  return true;
}
function peekOut(ms){
  if(!B) return;
  B.root.classList.add("out"); clearTimeout(outT);
  outT = setTimeout(() => { if(B) B.root.classList.remove("out"); }, ms);
}
/* si el niño lleva un rato sin tocar nada, el compañero le anima (una vez por página) */
function idleArm(){
  if(idleT){ clearTimeout(idleT); TIMERS.delete(idleT); idleT = 0; }
  const h = curH();
  if(!BUDDY_RE.test(h) || h.startsWith("juegos")) return;
  idleT = later(() => { idleT = 0; if(visible() && !gmPlay()){ act("hey"); talk(pick(IDLE_LINES), "", 2800); } }, 45000);
}
function onActivity(){ if(idleT) idleArm(); }
/* animación del personaje */
function act(cls){
  if(!visible()) return;
  const m = B.me; m.classList.remove("jump", "wobble", "spin", "hey"); void m.offsetWidth; m.classList.add(cls);
  const off = () => { m.classList.remove(cls); m.removeEventListener("animationend", off); };
  m.addEventListener("animationend", off);
  setTimeout(off, 900);
}
/* emoji que sube desde el compañero (también cuando está escondido en el borde) */
function floatUp(e){
  if(RM() || !B) return;
  const el = !B.root.hidden ? B.root : !B.peek.hidden ? B.peek : null; if(!el) return;
  const r = el.getBoundingClientRect(), f = document.createElement("span");
  f.className = "bd-float"; f.textContent = e; f.setAttribute("aria-hidden", "true");
  f.style.left = Math.max(22, r.left + r.width * .62) + "px"; f.style.top = (r.top - 6) + "px";
  document.body.appendChild(f); setTimeout(() => f.remove(), 1200);
}
function onTap(){
  if(gmPlay()) return;
  if(tucked()){ act("hey"); snd("tap"); talk(pick(TUCK_LINES), "", 2000); return; }
  act(Math.random() < .5 ? "spin" : "jump"); snd("pop"); floatUp(pick(["💙", "✨", "😄", "⭐"]));
  const g = game(), M = missions(), left = M.list.filter(m => m.n < m.goal).length;
  const extra = [];
  if(g.name) extra.push(`¡Hola, ${g.name}! 👋 ¿Seguimos?`);
  if(left) extra.push(`Te ${left === 1 ? "queda 1 misión" : `quedan ${left} misiones`} hoy 🎯`);
  const h = curH();
  if(h.startsWith("leccion")) extra.push("Pulsa 🔊 para oírla otra vez 👂");
  if(h.startsWith("repaso")) extra.push("Intenta decirla antes de mirar 👀");
  if(h.startsWith("juegos")) extra.push("¡Cada partida te da monedas! 🪙");
  talk(pick(Math.random() < .35 && extra.length ? extra : TAP_LINES), "", 3000);
}
/* esquivar: si el compañero tapa un botón, se esconde en el borde */
const SEL = "button,a,input,textarea,select,label,summary,.opt,[data-say],[role=button],[tabindex]";
function dodge(){
  if(!B || gmPlay()) return;
  const el = !B.root.hidden ? B.root : !B.peek.hidden ? B.peek : null; if(!el) return;
  const app = document.getElementById("app"); if(!app) return;
  const isRoot = el === B.root;
  const w = isRoot ? B.me.offsetWidth : el.offsetWidth, hh = isRoot ? B.me.offsetHeight : el.offsetHeight;
  const L = isRoot ? 10 : 0, bot = innerHeight - (isRoot ? 10 : 16);
  const R = {l: L, r: L + w + 4, t: bot - hh - 4, b: bot};
  let hit = false;
  for(let i = 0; i < 4 && !hit; i++) for(let j = 0; j < 4 && !hit; j++){
    const x = R.l + 2 + (R.r - R.l - 4) * i / 3, y = R.t + 2 + (R.b - R.t - 4) * j / 3;
    for(const e of document.elementsFromPoint(x, y)){
      if(e === B.root || B.root.contains(e) || e === B.peek || B.peek.contains(e)) continue;
      const c = e.closest(SEL);
      if(c && app.contains(c)){ hit = true; break; }
    }
  }
  el.classList.toggle("tuck", hit);
}
function queueDodge(){ if(dRaf) return; dRaf = requestAnimationFrame(() => { dRaf = 0; try{ dodge(); }catch(e){} }); }
/* al hacer scroll se mira cuando la página se para (si no, entraría y saldría sin parar mientras se mueve) */
function onScroll(){ clearTimeout(scT); scT = setTimeout(queueDodge, 160); }
/* se vuelve a mirar cuando cambia la página: nodos nuevos, tamaño (p. ej. al cargar una imagen), scroll o ventana */
function watch(on){
  const app = document.getElementById("app");
  if(on){
    if(!mo && app){
      mo = new MutationObserver(queueDodge); mo.observe(app, {childList: true, subtree: true});
      if(typeof ResizeObserver === "function"){ ro = new ResizeObserver(queueDodge); ro.observe(app); }
      app.addEventListener("load", queueDodge, true);
    }
    addEventListener("scroll", onScroll, {passive: true}); addEventListener("resize", queueDodge);
    document.addEventListener("pointerdown", onActivity, true); document.addEventListener("keydown", onActivity, true);
  } else {
    if(mo){ mo.disconnect(); mo = null; }
    if(ro){ ro.disconnect(); ro = null; }
    if(app) app.removeEventListener("load", queueDodge, true);
    removeEventListener("scroll", onScroll); removeEventListener("resize", queueDodge);
    document.removeEventListener("pointerdown", onActivity, true); document.removeEventListener("keydown", onActivity, true);
    if(dRaf){ cancelAnimationFrame(dRaf); dRaf = 0; }
    clearTimeout(scT); clearTimeout(outT);
  }
}

/* reacciones */
function onAnswer(d){
  if(!d) return;
  const name = game().name;
  if(d.ok){
    streakN++;
    if(!visible()){ if(B && !B.peek.hidden) floatUp(streakN >= 3 ? "🔥" : "⭐"); return; }
    act("jump");
    if(streakN % 5 === 0){
      /* confeti pequeño desde el sitio del compañero (aunque esté escondido en el borde, sale a celebrarlo) */
      const w = B.me.offsetWidth || 56, hh = B.me.offsetHeight || 60;
      if(!gmPlay()) boom({n: streakN >= 10 ? 60 : 36, x: Math.max(40, 10 + w / 2), y: innerHeight - 10 - hh});
      talk(streakN === 5 ? "¡5 seguidas! ¡Imparable! 🚀" : streakN === 10 ? "¡10 seguidas! ¡Eres una máquina! 🤖" : `¡${streakN} seguidas! 🚀`, "gold", 2400);
      floatUp("🎉");
    } else if(streakN === 3){ talk("¡3 seguidas! 🔥", "gold", 2200); floatUp("🔥"); }
    else { talk(name && Math.random() < .2 ? `¡Genial, ${name}!` : pick(OK_LINES), "ok", 1700); floatUp(streakN > 3 ? "🔥" : "⭐"); }
  } else {
    streakN = 0;
    if(!visible()) return;
    act("wobble"); talk(pick(BAD_LINES), "bad", 2200); floatUp("💪");
  }
}

/* tras responder, que se vea el botón «Continuar» / «Siguiente» y que el compañero no tape la respuesta */
function revealNext(){
  const go = document.getElementById("ls-go") || document.getElementById("nextq"); if(!go) return;
  const box = go.closest(".ls-foot") || go.closest("#after") || go, r = box.getBoundingClientRect();
  const shown = !!(B && (!B.root.hidden || !B.peek.hidden));
  /* deja sitio para el compañero y su bocadillo (hasta 2 líneas) */
  const limit = innerHeight - (shown ? 118 : 12);
  if(r.bottom <= limit) return;
  const hd = document.querySelector("header"), top = hd ? hd.getBoundingClientRect().bottom + 10 : 10;
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
  /* aviso: lo dice el compañero si está a la vista; si no, un mensaje abajo (en la portada basta con la tarjeta).
     En mitad de un minijuego espera al resultado: un mensaje encima taparía las burbujas o los globos */
  const near = visible() && !gmPlay();
  fresh.forEach((m, i) => setTimeout(() => {
    if(gmPlay()){ pendMis.push(m); return; }
    misNotice(m);
  }, near ? 1500 + i * 3800 : 900 + i * 2400));
}
let pendMis = [];
function misNotice(m){
  if(gmPlay()){ pendMis.push(m); return; }
  if(visible() && !gmPlay() && talk(`🎯 ¡Misión cumplida!\n${mText(m)}\nRecoge tus 🪙 en Inicio`, "gold", 3600)){ act("jump"); snd("pop"); }
  else if(isHome(curH())) snd("pop");
  else { toast(`🎯 ¡Misión cumplida! ${mText(m)}. Recoge tus 🪙 en Inicio`); snd("pop"); }
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
/* monedas que vuelan hasta el contador de la cabecera */
function flyCoins(from, n = 6){
  const tEl = document.getElementById("coins"), hb = tEl && tEl.closest(".hbtn");
  if(hb) setTimeout(() => { hb.classList.remove("bd-bump"); void hb.offsetWidth; hb.classList.add("bd-bump"); setTimeout(() => hb.classList.remove("bd-bump"), 500); }, RM() ? 0 : 850);
  if(RM() || !from || !tEl || !from.isConnected) return;
  const a = from.getBoundingClientRect(), b = tEl.getBoundingClientRect();
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, dx = b.left + b.width / 2 - x0, dy = b.top + b.height / 2 - y0;
  for(let i = 0; i < n; i++){
    const c = document.createElement("span"); c.className = "bd-fly"; c.textContent = "🪙"; c.setAttribute("aria-hidden", "true");
    c.style.left = x0 + "px"; c.style.top = y0 + "px";
    document.body.appendChild(c);
    const rx = (Math.random() - .5) * 120, ry = -40 - Math.random() * 60;
    try{
      const an = c.animate([
        {transform: "translate(-50%,-50%) scale(.5)", opacity: 0},
        {transform: `translate(calc(-50% + ${rx}px), calc(-50% + ${ry}px)) scale(1.2)`, opacity: 1, offset: .3},
        {transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.6)`, opacity: .9},
      ], {duration: 800, delay: i * 70, easing: "cubic-bezier(.45,0,.55,1)", fill: "both"});
      an.onfinish = () => c.remove();
    }catch(e){}
    setTimeout(() => c.remove(), 1600);
  }
}
/* el botón «Mi granja» de la portada enseña las monedas: se pone al día al ganar en la portada */
function homeCoins(){ const s = document.querySelector(".big-acts .a3 small"); if(s && /monedas/.test(s.textContent)) s.textContent = `🪙 ${game().coins} monedas`; }
bus.on("coins", () => { if(isHome(curH())) homeCoins(); });
function hopHello(){ const h = document.querySelector(".hello .hero"); if(!h || RM()) return; try{ h.animate([{transform: "none"}, {transform: "translateY(-18px) scale(1.06)"}, {transform: "none"}], {duration: 500, easing: "ease-out"}); }catch(e){} }
function onMisClick(e){
  const g = e.target.closest("[data-get]");
  if(g){
    const M = missions(), m = M.list.find(x => x.k === g.dataset.get);
    if(!m || m.got || m.n < m.goal) return;
    m.got = true; store.set(MKEY, M);
    g.disabled = true; flyCoins(g); award(15, "¡Misión cumplida!"); hopHello();
    paintMis();
    const row = document.querySelector(`#bd-mis .bd-row[data-k="${m.k}"]`); if(row) row.classList.add("stamp");
    if(M.list.every(x => x.got)) setTimeout(() => { snd("gift"); const c = document.querySelector("#bd-mis .bd-chest"); if(c && c.scrollIntoView && !RM()) c.scrollIntoView({block: "nearest", behavior: "smooth"}); }, 1300);
    return;
  }
  const c = e.target.closest("[data-chest]");
  if(c){
    const M = missions(); if(M.chest || !M.list.every(x => x.got)) return;
    M.chest = true; store.set(MKEY, M); c.disabled = true;
    const box = document.querySelector("#bd-mis .bd-box"); if(box) box.classList.add("boom");
    snd("gift");
    const r = c.getBoundingClientRect();
    setTimeout(() => {
      boom({n: 90, x: r.left + r.width / 2, y: r.top}); boom({emoji: "🪙", n: 24, x: r.left + r.width / 2, y: r.top});
      flyCoins(c, 8); award(25, "¡Cofre de misiones!"); hopHello(); paintMis();
    }, RM() ? 0 : 420);
  }
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
    const r = k.getBoundingClientRect();
    boom({emoji: "⭐", n: 22, x: r.left + r.width / 2, y: r.top});
    if(pay){ flyCoins(k, 3); award(3, "¡Palabra del día!"); } else { snd("ok"); toast(n ? "➕ ¡Añadida a tu repaso!" : "¡Ya estaba en tu repaso!"); }
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
    const r = av.getBoundingClientRect(); boom({emoji: "✨", n: 14, x: r.left + r.width / 2, y: r.top + 10});
    later(() => av.classList.remove("land"), 700);
    avSay(cur.id === "trophy" ? "¡Llegué al trofeo! 🏆" : pick(["¡Siguiente parada! 🚩", "¡Ya estoy aquí! 🎉", "¡A por la siguiente! 🚀"]), 2600);
  }, 1900);
}

/* ---------- eventos ---------- */
bus.on("route", d => {
  const h = String((d && d.h) || "");
  clearLater(); streakN = 0; if(!h.startsWith("juegos/")) pendMis = [];
  try{ syncBuddy(h); }catch(e){ console.error(e); }
  idleT = 0; idleArm();
  if(isHome(h)) wireHome();
  if(h.startsWith("mapa")){ try{ mapDeco(); }catch(e){ console.error(e); } }
  else if(!h.startsWith("leccion")) walk = null;
  /* saludo al llegar */
  const k = h.split("/")[0];
  /* (si está escondido en el borde no sale a saludar: taparía las opciones antes de empezar) */
  if(visible() && HELLO[k] && Date.now() - (lastHello[k] || 0) > 90e3){
    later(() => { if(!visible() || tucked()) return; lastHello[k] = Date.now(); act("hey"); talk(pick(HELLO[k]), "", 2000); }, 450);
  }
});
bus.on("answer", d => {
  /* en los minijuegos no reacciona (está apartado), pero los aciertos cuentan para las misiones */
  if(!d || d.where !== "game") onAnswer(d);
  bump("answer", d);
  if(d && ["lesson", "grammar", "test"].includes(d.where) && BUDDY_RE.test(curH())) later(revealNext, 140);
});
bus.on("lesson-done", d => {
  /* solo la primera vez: al repetir una lección antigua no cruza medio mapa */
  walk = d && d.id && d.first !== false ? {id: d.id, lv: d.lv, t: Date.now()} : null;
  streakN = 0;
  if(visible()){ act("jump"); talk(d && d.stars === 3 ? "¡3 estrellas! ¡Fenomenal! ⭐⭐⭐" : "¡Lección terminada! 🎉", "gold", 2600); }
  bump("lesson-done", d);
});
bus.on("review-card", d => {
  if(visible() && d){
    if(d.grade === 2){ act("jump"); talk(pick(["¡Qué memoria! 💡", "¡Te acordabas! 😎", "¡Bien! ⭐"]), "ok", 1500); floatUp("⭐"); }
    else if(d.grade === 0){ act("wobble"); talk(pick(["¡Ahora ya la sabes! 💡", "¡Volverá pronto! 🔁"]), "bad", 1800); }
    else { talk("¡Poco a poco! 🐢", "", 1400); }
  }
  bump("review-card", d);
});
bus.on("review-done", () => { if(visible()){ act("jump"); talk("¡Repaso terminado! 🌟", "gold", 2600); } });
bus.on("game-done", d => {
  /* games.js quita la marca de «jugando» justo después de avisar: el compañero sale un poco más tarde a celebrarlo */
  if(d) later(() => { if(visible() && !gmPlay()){ act("jump"); talk(d.stars >= 3 ? "¡Partidazo! ⭐⭐⭐" : d.stars >= 1 ? "¡Buena partida! ⭐" : "¡Otra vez! ¡Tú puedes! 💪", d.stars >= 1 ? "gold" : "", 2600); } }, 300);
  bump("game-done", d);
  /* misiones cumplidas durante la partida: se cuentan ahora, después de la celebración */
  if(pendMis.length){ const L = pendMis.splice(0); L.forEach((m, i) => later(() => misNotice(m), 3200 + i * 3800)); }
});
bus.on("medal", () => { if(visible()){ act("spin"); talk("¡Medalla nueva! 🏅", "gold", 2400); } });
bus.on("farm-feed", d => bump("farm-feed", d));
bus.on("farm-harvest", d => bump("farm-harvest", d));
bus.on("farm-collect", d => bump("farm-collect", d));
bus.on("farm-find", d => bump("farm-find", d));
})();
