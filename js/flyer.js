/* módulo flyer: «Pajarito volador», un juego de Juegos registrado con vocabGames.register (como js/lince.js).
   Ruta: #/juegos/pajarito. Se vuela por una calle de una ciudad del idioma (inglés: Londres, francés: París, danés:
     Copenhague, dibujos img/games/vuelo-<en|fr|da>.jpg). Arriba sale una palabra en español con su dibujo; por la
     calle llegan 3 puertas con palabras en el idioma y hay que ir a la buena: tocando la puerta o su carril,
     deslizando a los lados o con ← → (1 2 3). Al pasar suena la palabra y se ve con su IPA.
     Acierto: la puerta en verde, una moneda más y chispas. Fallo: se pierde un corazón (3), la buena se pone verde y
     suena (sin sonido triste). Cada 5 aciertos sube de nivel y todo llega más deprisa.
     Acaba a las 15 palabras (o las que tenga el tema) o sin corazones. Estrellas por aciertos (todas menos 2 ★★★,
     el 60 % ★★, si no ★).
   Las palabras son las del tema elegido en Juegos (api.topicPool, como Memoria o Globos). Con el tema «Soldados»
     (la jerga del ejército) se elige además la nave al empezar (se recuerda en "flyer:veh", solo de este aparato);
     con los demás temas se vuela siempre con el pajarito, sin nada de soldados:
     · Pajarito: lo de arriba, sin nada más.
     · Avión de combate («misión»): además de cruzar la puerta, puede derribar la palabra buena con «Fuego» (Espacio).
       Derribar una mala cuenta como fallo. Por el aire llegan drones (obstáculos): se esquivan o se derriban; chocar
       quita un corazón. Por las aceras pasan campamentos aliados, a los que se lanza ayuda («Ayuda», tecla S: cae una
       caja con un objeto del campamento, p. ej. «the helmet»), y barricadas enemigas, que se bombardean («Bomba», B).
       Cada entrega o barricada da un punto de misión 🎖. Los soldados contestan por radio con la jerga del ejército
       del idioma (data/army/<en|fr|da>.json de js/army.js: «Roger», «Reçu», «Forstået», «Over», «Fremad march!»…),
       con su español y su IPA, y la voz lo dice.
   Usa de games.js lo de los demás juegos: tarjeta del menú, récord, explicación la primera vez, «?», pausa (el
     reloj del juego se para) y finish() (récord en "games:best".pajarito, monedas con award desde «+N»).
   Datos: las del tema (games.js) y, con «Soldados», data/army/<ab>.json (terms con id roger, copy, over, out, again,
     att, march y los del campamento) para la radio y las cajas de ayuda. */
(() => {
"use strict";

const ID = "pajarito", ROUNDS = 15, LIVES = 3, PER_LEVEL = 5, MAX_LEN = 16, VKEY = "flyer:veh";
const Z_FAR = 5;                       /* la profundidad donde nacen las puertas (1 = a la altura de la nave) */
const SPEED = [5.2, 4.4, 3.7, 3.2];    /* segundos que tarda una fila de puertas en llegar, por nivel */
const IC = (n, s = "bold", z = 22, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
const RM = () => { try{ return !!(window.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const SCENES = {
  english:   {img: "img/games/vuelo-en.jpg", city: "Londres", vy: .325},
  "français": {img: "img/games/vuelo-fr.jpg", city: "París", vy: .29},
  dansk:     {img: "img/games/vuelo-da.jpg", city: "Copenhague", vy: .31},
};
const AB = {english: "en", "français": "fr", dansk: "da"};
const IMG_AR = 768 / 1152;             /* ancho/alto de los dibujos de las ciudades */
/* lo que llevan las cajas de ayuda (ids de los términos del campamento de data/army) */
const SUPPLY = ["helmet", "boots", "bottle", "map", "compass", "torch", "rucksack", "binoculars", "radio", "tent"];
/* el pajarito (dibujo propio, con el trazo negro de los demás dibujos de Juegos) */
const BIRD = `<svg viewBox="0 0 120 100" aria-hidden="true" focusable="false">
  <g class="fl-wl"><path d="M30 52 C10 40 2 46 4 56 C6 66 20 68 34 62Z" fill="#F1B70E" stroke="#000" stroke-width="3" stroke-linejoin="round"/></g>
  <g class="fl-wr"><path d="M90 52 C110 40 118 46 116 56 C114 66 100 68 86 62Z" fill="#F1B70E" stroke="#000" stroke-width="3" stroke-linejoin="round"/></g>
  <path d="M52 16 C54 6 62 4 60 14 C66 6 72 10 64 18Z" fill="#F1B70E" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
  <ellipse cx="60" cy="54" rx="32" ry="34" fill="#FCD34D" stroke="#000" stroke-width="3"/>
  <ellipse cx="60" cy="66" rx="18" ry="16" fill="#FDE68A"/>
  <circle cx="48" cy="46" r="5" fill="#000"/><circle cx="72" cy="46" r="5" fill="#000"/>
  <circle cx="49.6" cy="44.4" r="1.6" fill="#fff"/><circle cx="73.6" cy="44.4" r="1.6" fill="#fff"/>
  <path d="M53 56 L67 56 L60 66Z" fill="#F59E0B" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
  <path d="M50 88 l-4 8 M56 89 l0 8 M70 88 l4 8 M64 89 l0 8" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/></svg>`;
/* el avión de combate, visto desde detrás y arriba (verde oliva y gris, con la escarapela azul) */
const JET = `<svg viewBox="0 0 120 110" aria-hidden="true" focusable="false">
  <g class="fl-fire"><path d="M52 92 Q60 112 68 92Z" fill="#FDE68A"/><path d="M55 92 Q60 104 65 92Z" fill="#fff"/></g>
  <path d="M60 4 C66 14 68 30 68 44 L114 70 L114 80 L68 70 L68 84 L80 94 L80 100 L60 96 L40 100 L40 94 L52 84 L52 70 L6 80 L6 70 L52 44 C52 30 54 14 60 4Z"
    fill="#55663f" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
  <path d="M68 50 L110 72 L110 76 L68 66Z M52 50 L10 72 L10 76 L52 66Z" fill="#6f8152"/>
  <path d="M60 14 C64 22 64 32 63 40 L57 40 C56 32 56 22 60 14Z" fill="#9fd3f0" stroke="#000" stroke-width="2.5"/>
  <circle cx="92" cy="68" r="6" fill="#1f5fbf" stroke="#fff" stroke-width="2.5"/><circle cx="28" cy="68" r="6" fill="#1f5fbf" stroke="#fff" stroke-width="2.5"/>
  <circle cx="92" cy="68" r="2" fill="#fff"/><circle cx="28" cy="68" r="2" fill="#fff"/>
  <path d="M58 70 L58 92 M62 70 L62 92" stroke="#3a4630" stroke-width="2"/></svg>`;
/* un dron enemigo (obstáculo del aire), una barricada enemiga y un campamento aliado (en la acera) */
const DRONE = `<svg viewBox="0 0 80 50" aria-hidden="true" focusable="false"><g stroke="#000" stroke-width="2.5">
  <path d="M14 24 L66 24" /><ellipse cx="12" cy="14" rx="11" ry="4" fill="#cbd5e1"/><ellipse cx="68" cy="14" rx="11" ry="4" fill="#cbd5e1"/>
  <path d="M12 14 L12 24 M68 14 L68 24"/><rect x="26" y="16" width="28" height="20" rx="8" fill="#374151"/></g>
  <circle cx="40" cy="26" r="5" fill="#FCD34D" stroke="#000" stroke-width="2"/></svg>`;
const BARRICADE = `<svg viewBox="0 0 90 60" aria-hidden="true" focusable="false"><g stroke="#000" stroke-width="2.5" stroke-linejoin="round">
  <path d="M8 56 L20 22 L70 22 L82 56Z" fill="#4b5563"/><rect x="28" y="8" width="34" height="16" rx="4" fill="#374151"/>
  <path d="M62 14 L86 10" stroke-width="5" stroke-linecap="round"/><path d="M14 44 L76 44" stroke="#9ca3af"/></g>
  <path d="M36 30 L54 48 M54 30 L36 48" stroke="#FCD34D" stroke-width="5" stroke-linecap="round"/></svg>`;
const CAMP = `<svg viewBox="0 0 90 70" aria-hidden="true" focusable="false"><g stroke="#000" stroke-width="2.5" stroke-linejoin="round">
  <path d="M6 64 L36 20 L66 64Z" fill="#55663f"/><path d="M36 20 L36 64" /><path d="M28 64 L36 44 L44 64Z" fill="#2d3a22"/>
  <path d="M74 64 L74 10" /><path d="M74 10 L88 15 L74 20Z" fill="#1f5fbf"/></g>
  <circle cx="74" cy="64" r="3" fill="#000"/></svg>`;
const CRATE = `<svg viewBox="0 0 40 52" aria-hidden="true" focusable="false"><path d="M4 18 Q20 -6 36 18" fill="#e5e7eb" stroke="#000" stroke-width="2"/>
  <path d="M6 18 L18 32 M34 18 L22 32" stroke="#000" stroke-width="1.5"/><rect x="11" y="30" width="18" height="18" rx="2" fill="#a16207" stroke="#000" stroke-width="2.5"/>
  <path d="M11 39 H29 M20 30 V48" stroke="#000" stroke-width="1.5"/></svg>`;
const BOMB = `<svg viewBox="0 0 30 40" aria-hidden="true" focusable="false"><path d="M15 4 C22 10 22 28 15 36 C8 28 8 10 15 4Z" fill="#374151" stroke="#000" stroke-width="2.5"/>
  <path d="M9 6 L15 0 L21 6" fill="none" stroke="#000" stroke-width="2.5"/></svg>`;
/* iconos de los botones de misión (sin iconos del sprite para bomba y paracaídas) */
const ICO_BOMB = `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false"><circle cx="11" cy="14" r="7.5" fill="currentColor"/><path d="M15 8 L18 5 M18 5 q2-2 4 0" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`;
const ICO_BOX = `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false"><path d="M3 10 Q12 -2 21 10Z" fill="currentColor"/><path d="M4 10 L10 15 M20 10 L14 15" stroke="currentColor" stroke-width="1.8"/><rect x="8" y="14" width="8" height="8" rx="1.5" fill="currentColor"/></svg>`;

const ARMY = {};
function loadArmy(ab){
  if(!ARMY[ab]) ARMY[ab] = fetch(`data/army/${ab}.json`).then(r => { if(!r.ok) throw new Error(`data/army/${ab}.json ${r.status}`); return r.json(); })
    .catch(e => { delete ARMY[ab]; throw e; });
  return ARMY[ab];
}
const pic = src => (window.vocabGames && typeof vocabGames.pic === "function") ? vocabGames.pic(src) : src;
/* palabras que caben en una puerta */
const fits = x => x && typeof x.word === "string" && x.word.trim() && [...x.word].length <= MAX_LEN && typeof x.es === "string" && x.es.trim();
/* la jerga del ejército del idioma: {id: {w, es, ipa}} (vacío si no carga: el juego sigue sin radio) */
function termsOf(A){
  const out = {};
  for(const t of (A && Array.isArray(A.terms) ? A.terms : [])) if(t && typeof t.id === "string" && typeof t.w === "string" && t.w.trim())
    out[t.id] = {w: t.w.trim(), es: String(t.es || ""), ipa: String(t.ipa || "")};
  return out;
}
const gateFs = w => { const n = [...w].length; return n <= 6 ? 1.3 : n <= 9 ? 1.12 : n <= 12 ? .98 : .86; };
function vehGet(){ try{ const v = store.get(VKEY, null); return v === "jet" ? "jet" : v === "bird" ? "bird" : ""; }catch(e){ return ""; } }
function vehSet(v){ try{ store.set(VKEY, v); }catch(e){} }

const CSS = `
.fl{max-width:720px}
.fl .gm-top{margin-bottom:8px}
.fl-stage{position:relative;overflow:hidden;border-radius:var(--r-card,22px);height:440px;
  background:#5b9bd5 linear-gradient(#3d7cc9,#8cc4ef 55%,#9fb6c9);background-size:cover;background-position:center top;
  touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:pointer;isolation:isolate}
.fl-stage::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:linear-gradient(rgba(11,37,69,.18),transparent 30%,transparent 70%,rgba(11,37,69,.22))}
/* la calle: un trapecio desde el punto de fuga hasta abajo */
.fl-road{position:absolute;inset:0;z-index:1;pointer-events:none;background:rgba(26,158,148,.30);
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.35)}
.fl-jet .fl-road{background:rgba(75,85,99,.26)}
.fl-puff{position:absolute;left:0;top:0;z-index:2;width:40px;height:24px;margin:-12px 0 0 -20px;pointer-events:none;
  background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 24'%3E%3Cpath d='M8 22a7 7 0 0 1 0-14 9 9 0 0 1 17-3 7 7 0 0 1 8 6 6 6 0 0 1-1 11Z' fill='%23fff'/%3E%3C/svg%3E") center/contain no-repeat}
/* la palabra que hay que traducir */
.fl-card{display:flex;align-items:center;gap:12px;padding:10px 14px;margin:0 0 10px;border-radius:20px;
  background:var(--card,#fff);color:var(--label,#0b2545);box-shadow:0 1px 3px rgba(0,0,0,.06),inset 0 0 0 2px var(--sep,#e5e7eb)}
.fl-card .fl-pic{flex:none;width:clamp(64px,18vw,92px);aspect-ratio:1;border-radius:14px;background:var(--gm-tile,#fff);display:grid;place-items:center}
.fl-card .fl-pic img{width:90%;height:90%;object-fit:contain;mix-blend-mode:multiply}
.fl-card .fl-pic:empty{display:none}
.fl-txt{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.fl-lab{font:800 .78rem/1.2 var(--f-round);letter-spacing:.06em;text-transform:uppercase;color:var(--brand-tint,#1f5fbf)}
.fl-es{font:800 clamp(1.7rem,7.5vw,2.4rem)/1.1 var(--f-round);overflow-wrap:anywhere}
.fl-ans{min-height:1.4em;font:700 1.05rem/1.3 var(--f-text);color:var(--ok-ink,#1a7f4b);overflow-wrap:anywhere;visibility:hidden}
.fl-ans.on{visibility:visible}
.fl-ans .ipa{font-weight:500;margin-left:.35em}
/* las puertas: una pastilla con la palabra encima de dos postes */
.fl-gate{position:absolute;left:0;top:0;z-index:4;display:flex;flex-direction:column;align-items:center;transform-origin:50% 100%;will-change:transform,opacity;cursor:pointer}
.fl-gate b{display:block;padding:10px 16px;border-radius:999px;background:#0b2545;color:#fff;font:800 1.2rem/1.1 var(--f-round);white-space:nowrap;
  box-shadow:0 0 0 3px rgba(255,255,255,.9),0 6px 14px rgba(0,0,0,.3);transition:background-color .2s,color .2s}
.fl-gate i{display:block;width:calc(100% - 26px);height:46px;margin-top:-2px;border:6px solid rgba(255,255,255,.88);border-top:0;border-radius:0 0 8px 8px}
.fl-jet .fl-gate b{background:#2d3a22;box-shadow:0 0 0 3px #FCD34D,0 6px 14px rgba(0,0,0,.3)}
.fl-gate.ok b,.fl-jet .fl-gate.ok b{background:#2b9a55}
.fl-gate.ok i{border-color:#7fe0a3}
.fl-gate.no b,.fl-jet .fl-gate.no b{background:#6b7280;color:#e5e7eb}
.fl-gate.no{opacity:.7}
.fl-gate.shot b{animation:fl-shot .5s}
@keyframes fl-shot{30%{transform:scale(1.25)}}
/* la nave */
.fl-bird{position:absolute;left:0;top:0;z-index:5;width:clamp(96px,26vw,128px);margin-left:calc(clamp(96px,26vw,128px) / -2);pointer-events:none;
  transition:transform .2s cubic-bezier(.3,.7,.4,1);filter:drop-shadow(0 10px 8px rgba(0,0,0,.25))}
.fl-bird svg{display:block;width:100%;height:auto;animation:fl-bob 1.1s ease-in-out infinite}
.fl-wl,.fl-wr{transform-box:fill-box;animation:fl-flap .32s ease-in-out infinite alternate}
.fl-wl{transform-origin:100% 50%}.fl-wr{transform-origin:0 50%}
@keyframes fl-flap{to{transform:rotate(-22deg) scaleY(.8)}}
.fl-wr{animation-name:fl-flapr}@keyframes fl-flapr{to{transform:rotate(22deg) scaleY(.8)}}
@keyframes fl-bob{50%{transform:translateY(-5px)}}
.fl-fire{transform-box:fill-box;transform-origin:50% 0;animation:fl-fire .12s linear infinite alternate}
@keyframes fl-fire{to{transform:scaleY(.65)}}
.fl-bird.hit svg{animation:fl-hit .5s}
@keyframes fl-hit{25%{transform:translateX(-6px) rotate(-6deg)}75%{transform:translateX(6px) rotate(6deg)}}
.fl-paused .fl-bird svg,.fl-paused .fl-wl,.fl-paused .fl-wr,.fl-paused .fl-fire{animation-play-state:paused}
/* lo que vuela y lo que hay en las aceras */
.fl-obj{position:absolute;left:0;top:0;z-index:4;width:96px;transform-origin:50% 100%;pointer-events:none;will-change:transform,opacity}
.fl-obj svg{display:block;width:100%;height:auto}
.fl-obj.camp,.fl-obj.foe{z-index:3}
.fl-obj .fl-tag{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);margin-bottom:4px;padding:3px 9px;border-radius:999px;white-space:nowrap;
  font:800 .8rem/1.2 var(--f-round);color:#fff;background:#2d3a22;box-shadow:0 0 0 2px #fff}
.fl-obj.foe .fl-tag{background:#374151}
.fl-obj.zone .fl-tag{background:#FCD34D;color:#0b2545;animation:fl-tag .5s ease-in-out infinite alternate}
@keyframes fl-tag{to{transform:translateX(-50%) scale(1.12)}}
.fl-obj.done{opacity:.5;filter:grayscale(1)}
.fl-shot{position:absolute;z-index:6;width:8px;height:22px;margin:-11px 0 0 -4px;border-radius:4px;background:#FCD34D;box-shadow:0 0 8px #fff;pointer-events:none}
.fl-drop{position:absolute;z-index:6;width:38px;margin-left:-19px;pointer-events:none}
.fl-drop svg{display:block;width:100%;height:auto}
.fl-boom{position:absolute;z-index:6;width:90px;height:90px;margin:-45px 0 0 -45px;border-radius:50%;pointer-events:none;
  background:radial-gradient(circle,#fff 0 18%,#FCD34D 19% 46%,rgba(252,211,77,.5) 47% 62%,transparent 63%);animation:fl-boom .55s ease-out forwards}
@keyframes fl-boom{from{transform:scale(.2);opacity:1}to{transform:scale(1.5);opacity:0}}
/* la radio: lo que dicen los soldados */
.fl-radio{position:absolute;z-index:7;left:50%;top:54px;transform:translate(-50%,-8px);width:max-content;max-width:calc(100% - 24px);opacity:0;display:flex;align-items:center;gap:8px;
  padding:8px 12px;border-radius:14px;background:rgba(18,26,14,.88);color:#e5f0d8;font:700 .95rem/1.25 var(--f-text);pointer-events:none;
  box-shadow:0 0 0 2px #6f8152;transition:opacity .25s,transform .25s}
.fl-radio.on{opacity:1;transform:translate(-50%,0)}
.fl-radio .ico{flex:none;color:#FCD34D}
.fl-radio b{color:#fff;font-family:var(--f-round);font-weight:800}
.fl-radio small{display:block;color:#c5d4b2;font-weight:600}
.fl-radio .ipa{color:#c5d4b2;font-weight:500;margin-left:.3em}
.fl-arrow{position:absolute;z-index:6;bottom:calc(var(--safe-b,0px) + 10px);width:52px;height:52px;border:0;border-radius:50%;display:grid;place-items:center;
  background:rgba(11,37,69,.55);color:#fff;cursor:pointer}
.fl-arrow.l{left:12px}.fl-arrow.r{right:12px}
.fl-arrow:focus-visible,.fl-act:focus-visible{outline:3px solid #fff;outline-offset:2px}
/* los botones de misión (solo con el avión) */
.fl-acts{position:absolute;z-index:6;left:50%;transform:translateX(-50%);bottom:calc(var(--safe-b,0px) + 8px);display:flex;gap:8px}
.fl-act{width:62px;height:62px;border:0;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:0;
  background:rgba(18,26,14,.82);color:#fff;font:800 .72rem/1 var(--f-round);cursor:pointer;box-shadow:0 0 0 2px rgba(255,255,255,.55);touch-action:manipulation}
.fl-act.fire{background:#1f5fbf}
.fl-act:active{transform:scale(.94)}
.fl-act.cool{opacity:.55}
.fl-jet .fl-arrow{bottom:calc(var(--safe-b,0px) + 13px)}
.fl-lvl{position:absolute;z-index:8;left:50%;top:44%;transform:translate(-50%,-50%) scale(.6);opacity:0;padding:14px 26px;border-radius:999px;
  background:#0b2545;color:#ffd34d;font:800 1.8rem/1 var(--f-round);box-shadow:0 0 0 4px #fff,0 10px 24px rgba(0,0,0,.3);pointer-events:none;
  transition:transform .3s cubic-bezier(.3,1.5,.5,1),opacity .3s;white-space:nowrap}
.fl-lvl.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
.fl-lvp{position:absolute;z-index:3;left:10px;top:10px;display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:999px;
  background:rgba(11,37,69,.72);color:#fff;font:800 .95rem/1 var(--f-round);pointer-events:none}
.fl-lvp .ico{color:#ffd34d}
.fl-mp{position:absolute;z-index:3;right:10px;top:10px;display:none;align-items:center;gap:4px;padding:6px 12px;border-radius:999px;
  background:rgba(18,26,14,.82);color:#fff;font:800 .95rem/1 var(--f-round);pointer-events:none}
.fl-jet .fl-mp{display:inline-flex}
.fl-mp .ico{color:#FCD34D}
.fl-plus{position:absolute;z-index:7;pointer-events:none;font:800 1.4rem/1 var(--f-round);color:#ffd34d;text-shadow:0 0 3px #000,0 2px 6px rgba(0,0,0,.7);white-space:nowrap;
  animation:fl-up .9s ease-out forwards}
@keyframes fl-up{to{transform:translateY(-70px);opacity:0}}
/* elegir la nave */
.fl-pick[hidden],.fl-acts[hidden]{display:none}
.fl-pick{position:absolute;z-index:9;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px;
  background:rgba(11,37,69,.55)}
.fl-pick h2{margin:0;color:#fff;font:800 1.5rem/1.2 var(--f-round);text-align:center;text-shadow:0 2px 6px rgba(0,0,0,.4)}
.fl-pick-r{display:flex;gap:12px;width:100%;max-width:440px}
.fl-veh{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 8px 12px;border:0;border-radius:22px;background:var(--card,#fff);color:var(--label,#0b2545);
  font:800 1.05rem/1.2 var(--f-round);cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,.25)}
.fl-veh svg{width:min(120px,80%);height:auto}
.fl-veh small{font:600 .8rem/1.25 var(--f-text);color:var(--label2,#4b5563);text-align:center}
.fl-veh.last{box-shadow:0 0 0 4px #FCD34D,0 8px 20px rgba(0,0,0,.25)}
.fl-veh:focus-visible{outline:3px solid #fff;outline-offset:3px}
/* el avión fuera del tema Soldados: en oscuro, con candado */
.fl-veh.off{background:rgba(15,23,42,.72);color:rgba(255,255,255,.78);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.28);cursor:not-allowed}
.fl-veh.off svg{filter:grayscale(1);opacity:.6}
.fl-veh .fl-lock{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:12px;background:#fff;color:#0b2545;font-weight:700;text-align:left}
.fl-veh .fl-lock svg{width:14px;height:14px;flex:none;filter:none;opacity:1}
@media (max-width:380px){.fl-act{width:56px;height:56px}.fl-acts{gap:6px}}
@media (prefers-reduced-motion: reduce){.fl-bird{transition:none}.fl-bird svg,.fl-wl,.fl-wr,.fl-fire,.fl-obj .fl-tag{animation:none}.fl-plus,.fl-boom{animation-duration:.01s}.fl-lvl,.fl-radio{transition:none}}`;
function css(){
  if(document.getElementById("css-flyer")) return;
  const s = document.createElement("style"); s.id = "css-flyer"; s.textContent = CSS; document.head.appendChild(s);
}

async function start(app, api, mode){
  const my = api.nav();
  css();
  const L = lang, ab = AB[L] || "en";
  let TP = {P: [], mil: false, name: ""}, A = null;
  try{ TP = await api.topicPool(ID, 6, fits); }catch(e){}
  if(TP.mil) try{ A = await loadArmy(ab); }catch(e){ A = null; }
  if(!api.here(my, ID) || lang !== L) return;
  const P = TP.P, T = termsOf(A), MIL = TP.mil, N = Math.min(ROUNDS, P.length);
  if(P.length < 6){
    app.innerHTML = `<div class="gm"><div class="gm-empty"><p>Este juego todavía no tiene palabras en ${esc(api.nm())}.</p>
      <a class="glass-btn" href="#/juegos">${IC("caret-left", "bold", 18)}Juegos</a></div></div>`;
    return;
  }
  const code = LANGS[L].code, scene = SCENES[L] || SCENES.english;
  /* las rondas: 15 palabras distintas (con dibujo primero) y 2 puertas falsas para cada una */
  const pool = shuffle(P.filter(x => x.img)).concat(shuffle(P.filter(x => !x.img)));
  const rounds = pool.slice(0, N).map(t => {
    const others = shuffle(P.filter(x => x !== t && x.word.toLowerCase() !== t.word.toLowerCase())).slice(0, 2);
    const opts = shuffle([t, ...others]);
    return {t, opts, ok: opts.indexOf(t)};
  });
  rounds.slice(0, 4).forEach(r => { if(r.t.img){ const im = new Image(); im.src = pic(r.t.img); } });
  const lastVeh = MIL ? vehGet() || "jet" : "bird";
  const JET_OFF = "El avión de combate se activa con el tema Soldados";
  const run = api.mount(app, `<div class="gm fl" id="fl">
    ${api.topHtml(ID, `<span class="gm-pill gm-lives" id="gm-lives" role="img" aria-label="${LIVES} vidas">${`<i>${IC("heart", "fill", 18)}${IC("heart", "bold", 18)}</i>`.repeat(LIVES)}</span><span class="gm-pill" title="Monedas">${IC("coin", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`)}
    <div class="fl-card" aria-live="polite"><span class="fl-pic" id="fl-pic"></span>
      <div class="fl-txt"><span class="fl-lab" id="fl-lab">Vuela a la puerta de…</span><span class="fl-es" id="fl-es">¡Elige tu nave!</span><span class="fl-ans" id="fl-ans" lang="${esc(code)}"></span></div></div>
    <div class="fl-stage" id="fl-stage" style="background-image:url('${esc(scene.img)}')" aria-label="La calle de ${esc(scene.city)}">
      <div class="fl-road" id="fl-road"></div>
      <div class="fl-bird" id="fl-bird">${BIRD}</div>
      <button type="button" class="fl-arrow l" id="fl-l" aria-label="A la izquierda">${IC("caret-left", "bold", 28)}</button>
      <button type="button" class="fl-arrow r" id="fl-r" aria-label="A la derecha">${IC("caret-right", "bold", 28)}</button>
      <div class="fl-acts" id="fl-acts" hidden>
        <button type="button" class="fl-act fire" id="fl-fire" aria-label="Fuego (Espacio)">${IC("target", "fill", 26)}Fuego</button>
        <button type="button" class="fl-act" id="fl-bomb" aria-label="Bomba (B)">${ICO_BOMB}Bomba</button>
        <button type="button" class="fl-act" id="fl-aid" aria-label="Lanzar ayuda (S)">${ICO_BOX}Ayuda</button></div>
      <div class="fl-radio" id="fl-radio" role="status" aria-live="polite"></div>
      <div class="fl-lvl" id="fl-lvlb" aria-hidden="true"></div>
      <span class="fl-lvp" title="Nivel">${IC("lightning", "fill", 16)}Nivel <b id="fl-lv">1</b></span>
      <span class="fl-mp" title="Puntos de misión">${IC("medal", "fill", 16)}<b id="fl-mp">0</b></span>
      <div class="fl-pick" id="fl-pick" hidden><h2>¿Con qué vuelas hoy?</h2><div class="fl-pick-r">
        <button type="button" class="fl-veh${lastVeh !== "jet" ? " last" : ""}" data-veh="bird">${BIRD}Pajarito<small>Vuela por la puerta buena</small></button>
        ${MIL ? `<button type="button" class="fl-veh${lastVeh === "jet" ? " last" : ""}" data-veh="jet">${JET}Avión de combate<small>Dispara, bombardea y ayuda a los soldados</small></button>`
          : `<button type="button" class="fl-veh off" data-veh="jet" aria-disabled="true">${JET}Avión de combate<small class="fl-lock">${IC("lock", "bold", 14)}Se activa con el tema Soldados</small></button>`}</div></div>
    </div></div>`, mode);
  const root = run.root, stage = root.querySelector("#fl-stage"), road = root.querySelector("#fl-road"), bird = root.querySelector("#fl-bird");
  const esEl = root.querySelector("#fl-es"), picEl = root.querySelector("#fl-pic"), ans = root.querySelector("#fl-ans"), radioEl = root.querySelector("#fl-radio");
  let W = 0, H = 0, VY = 0, BY = 0, GAP = 0;
  let r = 0, lane = 1, z = Z_FAR, phase = "wait", score = 0, lives = LIVES, level = 1, hits = 0, started = false, last = 0, gates = [], ended = false;
  let jet = false, mp = 0, cool = 0, radioT = 0, gameT = 0, hurtT = -9;
  const res = [], puffs = [], objs = [], stats = {aid: 0, foe: 0, drone: 0};
  const live = () => api.live(run);
  /* la proyección: profundidad z → escala, y la altura en la calle */
  const proj = zz => { const s = 1 / zz, f = (s - 1 / Z_FAR) / (1 - 1 / Z_FAR); return {s: .32 + .68 * s * (1 - .1 * (1 - f)), y: VY + (BY - VY) * f}; };
  const laneX = (i, s) => W / 2 + (i - 1) * GAP * s;
  const speed = () => (Z_FAR - 1) / SPEED[Math.min(level, SPEED.length) - 1];
  function measure(){
    /* la calle llena lo que queda de pantalla (sin pasar de 900 px ni bajar de 380) */
    const t0 = stage.getBoundingClientRect().top, sb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-b")) || 0;
    stage.style.height = Math.round(Math.max(380, Math.min(900, innerHeight - t0 - 12 - sb))) + "px";
    const b = stage.getBoundingClientRect(); W = b.width; H = b.height;
    /* el horizonte del dibujo (background-size: cover, arriba y centrado) */
    const sc = Math.max(W / IMG_AR, H);
    VY = Math.max(40, sc * scene.vy);
    BY = H - Math.max(jet ? 140 : 110, H * (jet ? .2 : .16));
    GAP = Math.min(W * .32, 170);
    const top = GAP * .32 * 1.6, bot = GAP * 1.75, yb = H;
    road.style.clipPath = `polygon(${W / 2 - top}px ${VY - 10}px,${W / 2 + top}px ${VY - 10}px,${W / 2 + bot * 1.25}px ${yb}px,${W / 2 - bot * 1.25}px ${yb}px)`;
    placeBird(true);
    draw();
  }
  function placeBird(now){
    if(now) bird.style.transition = "none";
    bird.style.transform = `translate(${laneX(lane, 1)}px,${BY - bird.offsetHeight * .62}px)`;
    if(now){ void bird.offsetWidth; bird.style.transition = ""; }
  }
  function move(to){
    if(!started || ended || !live() || run.paused) return;
    to = Math.max(0, Math.min(2, to));
    if(to === lane) return;
    lane = to; placeBird(false); api.haptic("selection");
  }
  /* nubecitas a los lados que pasan de lejos a cerca: dan sensación de velocidad */
  for(let i = 0; i < 6; i++){
    const el = document.createElement("i"); el.className = "fl-puff"; stage.insertBefore(el, bird);
    puffs.push({el, side: i % 2 ? 1 : -1, z: 1 + (Z_FAR - 1) * (i / 6), k: 1.9 + (i % 3) * .25});
  }
  /* x, y de un objeto: los drones van por un carril; los campamentos y barricadas, por una acera */
  const objX = (o, s) => o.side ? W / 2 + o.side * GAP * 1.6 * s : laneX(o.lane, s);
  function draw(){
    const p = proj(Math.max(.55, z));
    gates.forEach((g, i) => {
      const x = laneX(i, p.s);
      const o = z < 1 ? Math.max(0, (z - .55) / .45) : Math.min(1, (Z_FAR - z) / .5 + .15);
      g.style.transform = `translate(${x}px,${p.y}px) translate(-50%,-100%) scale(${p.s})`;
      g.style.opacity = o;
    });
    for(const f of puffs){
      const q = proj(f.z);
      f.el.style.transform = `translate(${W / 2 + f.side * GAP * f.k * q.s}px,${q.y}px) scale(${q.s * 1.4})`;
      f.el.style.opacity = (f.z < 1.2 ? Math.max(0, (f.z - .7) / .5) : f.z > Z_FAR - .6 ? (Z_FAR - f.z) / .6 : 1) * .8;
    }
    for(const o of objs){
      const q = proj(Math.max(.4, o.z)), up = o.kind === "drone" ? 70 * q.s : 0;
      o.el.style.transform = `translate(${objX(o, q.s)}px,${q.y - up}px) translate(-50%,-100%) scale(${q.s})`;
      o.el.style.opacity = o.z < .8 ? Math.max(0, (o.z - .4) / .4) : Math.min(1, (Z_FAR - o.z) / .5 + .15);
    }
  }
  /* ---------- la radio: jerga del ejército del idioma (con su español, su IPA y la voz) ---------- */
  function radio(id, extra, speak = true){
    const t = T[id];
    if(!t && !extra) return;
    radioEl.innerHTML = `${IC("chat-circle-text", "fill", 22)}<span>${t ? `<b lang="${esc(code)}">${esc(t.w)}</b>${ipaOn() && t.ipa ? ipaHtml(t.ipa, code) : ""}<small>${esc(t.es)}${extra ? " · " + esc(extra) : ""}</small>` : `<b>${esc(extra)}</b>`}</span>`;
    radioEl.classList.add("on");
    radioT = gameT + 2.4;
    if(speak && t) try{ say(t.w); }catch(e){}
  }
  function flash(txt, x, y){
    const pl = document.createElement("span"); pl.className = "fl-plus"; pl.textContent = txt;
    pl.style.left = Math.max(4, Math.min(W - 120, x - 30)) + "px"; pl.style.top = y + "px";
    stage.appendChild(pl); setTimeout(() => pl.remove(), 1000);
  }
  function boom(x, y){
    const b = document.createElement("i"); b.className = "fl-boom"; b.style.left = x + "px"; b.style.top = y + "px";
    stage.appendChild(b); setTimeout(() => b.remove(), 700);
  }
  function addMp(){ mp++; const el = root.querySelector("#fl-mp"); if(el){ el.textContent = mp; api.bump(el.parentNode); } }
  function loseLife(){
    lives--;
    const Lv = root.querySelector("#gm-lives");
    if(Lv){ const h = Lv.querySelectorAll("i")[lives]; if(h) h.classList.add("lost", "hurt"); Lv.setAttribute("aria-label", lives === 1 ? "1 vida" : `${Math.max(0, lives)} vidas`); }
  }
  /* ---------- objetos de la misión ---------- */
  function spawn(kind, opt){
    const el = document.createElement("div");
    el.className = "fl-obj " + kind;
    el.innerHTML = kind === "drone" ? DRONE : kind === "camp" ? CAMP + `<span class="fl-tag">Aliados</span>` : BARRICADE + `<span class="fl-tag">Enemigo</span>`;
    stage.insertBefore(el, bird);
    const o = Object.assign({kind, el, z: Z_FAR, v: 1, done: false, lane: 1, side: 0}, opt);
    objs.push(o);
    return o;
  }
  function killObj(o){ o.dead = true; o.el.remove(); }
  function mission(){
    /* cada ronda: un dron (desde el nivel 1, una ronda sí y otra no) y algo en la acera, que llegan antes que las puertas */
    if(!jet) return;
    if(level > 1 || r % 2 === 1) spawn("drone", {lane: Math.floor(Math.random() * 3), v: 1.75});
    if(level > 2 && Math.random() < .5) spawn("drone", {lane: Math.floor(Math.random() * 3), v: 1.45, z: Z_FAR + .8});
    spawn(r % 3 === 1 ? "foe" : "camp", {side: Math.random() < .5 ? -1 : 1, v: 1.35});
  }
  const inZone = o => !o.done && !o.dead && o.z <= 2.5 && o.z >= 1.05;
  function round(){
    if(!live()) return;
    const R = rounds[r];
    phase = "fly"; z = Z_FAR;
    esEl.textContent = R.t.es;
    picEl.innerHTML = R.t.img ? `<img src="${esc(pic(R.t.img))}" alt="" draggable="false"${pic(R.t.img) !== R.t.img ? ` data-f="${esc(R.t.img)}" onerror="if(this.dataset.f){this.src=this.dataset.f;delete this.dataset.f}"` : ""}>` : "";
    ans.classList.remove("on"); ans.innerHTML = "";
    gates.forEach(g => g.remove());
    gates = R.opts.map((x, i) => {
      const g = document.createElement("div");
      g.className = "fl-gate"; g.dataset.i = i; g.flOk = i === R.ok;   /* flOk: para las pruebas */
      g.innerHTML = `<b lang="${esc(code)}" style="font-size:${gateFs(x.word)}rem">${esc(x.word)}</b><i></i>`;
      stage.insertBefore(g, bird);
      return g;
    });
    const nx = rounds[r + 1]; if(nx && nx.t.img){ const im = new Image(); im.src = pic(nx.t.img); }
    mission();
    draw();
  }
  /* la ronda se decide al llegar la fila de puertas (por el carril) o, con el avión, al derribar una puerta */
  function resolve(ok, shot){
    if(phase !== "fly") return;
    phase = "pass";
    const R = rounds[r];
    res.push(ok);
    try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch(e){}
    api.answer(ok, {es: R.t.es, word: R.t.word});
    gates[R.ok].classList.add("ok");
    gates.forEach((g, i) => { if(i !== R.ok) g.classList.add("no"); });
    if(shot !== undefined) gates[shot].classList.add("shot");
    ans.innerHTML = `${esc(R.t.word)}${ipaOn() && R.t.ipa ? ipaHtml(R.t.ipa, code) : ""}`;
    ans.classList.add("on");
    try{ say(R.t.word); }catch(e){}
    if(ok){
      score++; hits++;
      api.snd("coin"); api.haptic("success");
      const sc = root.querySelector("#gm-sc"); if(sc){ sc.textContent = score; api.bump(sc.parentNode); }
      flash(jet && shot !== undefined ? "¡Objetivo abatido!" : "+1", laneX(shot !== undefined ? shot : lane, 1), BY - bird.offsetHeight);
      try{ if(window.M && typeof M.burst === "function" && !RM()) M.burst(bird, {n: 10}); }catch(e){}
      if(jet) radio(Math.random() < .5 ? "roger" : "copy", null, false);
    } else {
      loseLife();
      if(jet) radio("again", "era «" + R.t.word + "»", false);
    }
    api.later(run, after, ok ? 1100 : 1900);
  }
  function after(){
    if(!live() || ended) return;
    r++;
    if(lives <= 0 || r >= N){ end(); return; }
    if(res[res.length - 1] && hits % PER_LEVEL === 0 && level < SPEED.length + 2){
      level++;
      const lv = root.querySelector("#fl-lv"); if(lv){ lv.textContent = level; api.bump(lv.parentNode); }
      const b = root.querySelector("#fl-lvlb"); b.textContent = jet ? `¡Ascenso! Nivel ${level}` : `¡Nivel ${level}!`; b.classList.add("on");
      api.snd("whoosh");
      if(jet) radio("march", "nivel " + level);
      phase = "wait";
      api.later(run, () => { b.classList.remove("on"); round(); }, 1300);
      return;
    }
    round();
  }
  function end(){
    if(ended) return;
    ended = true; phase = "wait";
    const stars = score >= N - 2 ? 3 : score >= Math.ceil(N * .6) ? 2 : 1;
    const seen = new Set(), words = [];
    rounds.slice(0, res.length).forEach((o, i) => { if(!seen.has(o.t.word)){ seen.add(o.t.word); words.push({word: o.t.word, es: o.t.es, img: o.t.img, miss: !res[i]}); } });
    const extra = jet ? ` Ayuda entregada: ${stats.aid} · barricadas: ${stats.foe} · drones: ${stats.drone}.` : "";
    api.finish(run, ID, {score, stars, words: words.sort((a, b) => b.miss - a.miss),
      line: (lives <= 0 ? `¡Pasaste ${score} puerta${score === 1 ? "" : "s"} por ${scene.city}! La próxima llegas más lejos.`
        : score === N ? (jet ? `¡Misión cumplida! Las ${N} palabras en ${scene.city}.` : `¡Las ${N} puertas! Eres el rey del cielo de ${scene.city}.`)
        : jet ? `Misión cumplida: ${score} de ${N} palabras en ${scene.city}.` : `¡Pasaste ${score} de ${N} puertas por ${scene.city}!`) + extra});
  }
  /* ---------- armas y ayuda (solo el avión) ---------- */
  function fire(){
    if(!jet || !started || ended || !live() || run.paused || cool > gameT) return;
    cool = gameT + .32;
    const fb = root.querySelector("#fl-fire"); if(fb){ fb.classList.add("cool"); api.later(run, () => fb.classList.remove("cool"), 320); }
    api.snd("pop");
    /* lo primero que haya en el carril: un dron o, si la fila está cerca, la puerta */
    const drone = objs.filter(o => o.kind === "drone" && !o.dead && o.lane === lane && o.z > .9 && o.z < 4.2).sort((a, b) => a.z - b.z)[0];
    const gateOn = phase === "fly" && z < 3.8;
    const tz = drone && (!gateOn || drone.z < z) ? drone.z : gateOn ? z : 3.5;
    const q = proj(tz), x0 = laneX(lane, 1), y0 = BY - bird.offsetHeight * .7, x1 = laneX(lane, q.s), y1 = q.y - (drone && tz === drone.z ? 70 * q.s : 40 * q.s);
    const b = document.createElement("i"); b.className = "fl-shot"; stage.appendChild(b);
    const t0 = performance.now(), dur = 180;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      b.style.transform = `translate(${x0 + (x1 - x0) * k}px,${y0 + (y1 - y0) * k}px)`;
      if(k < 1 && b.isConnected) requestAnimationFrame(step); else b.remove();
    };
    requestAnimationFrame(step);
    api.later(run, () => {
      if(drone && tz === drone.z){
        if(drone.dead) return;
        const qq = proj(drone.z); boom(laneX(drone.lane, qq.s), qq.y - 70 * qq.s);
        killObj(drone); stats.drone++; addMp(); api.haptic("success");
        flash("¡Dron derribado!", laneX(drone.lane, 1), BY - bird.offsetHeight - 30);
      } else if(gateOn && phase === "fly"){
        const R = rounds[r];
        boom(x1, y1);
        resolve(lane === R.ok, lane);
      }
    }, dur);
  }
  function drop(kind){
    if(!jet || !started || ended || !live() || run.paused) return;
    const want = kind === "aid" ? "camp" : "foe";
    const tgt = objs.find(o => !o.side ? false : inZone(o) && o.kind === want);
    const other = objs.find(o => o.side && inZone(o) && o.kind !== want);
    const el = document.createElement("div"); el.className = "fl-drop"; el.innerHTML = kind === "aid" ? CRATE : BOMB;
    const x0 = laneX(lane, 1), y0 = BY - bird.offsetHeight * .3;
    const q = tgt ? proj(Math.max(.75, tgt.z - .35)) : null;
    const x1 = tgt ? objX(tgt, q.s) : x0, y1 = tgt ? q.y - 20 : Math.min(H - 30, y0 + 80);
    stage.appendChild(el);
    el.style.transform = `translate(${x0}px,${y0}px)`;
    el.animate([{transform: `translate(${x0}px,${y0}px) scale(1)`}, {transform: `translate(${x1}px,${y1 - 40}px) scale(.8)`}],
      {duration: RM() ? 1 : 420, easing: "ease-in", fill: "forwards"});
    api.snd("whoosh");
    api.later(run, () => {
      el.remove();
      if(tgt && !tgt.dead && !tgt.done){
        tgt.done = true; tgt.el.classList.add("done"); tgt.el.classList.remove("zone"); addMp(); api.haptic("success");
        if(kind === "aid"){
          stats.aid++;
          const it = T[SUPPLY[(stats.aid + r) % SUPPLY.length]];
          flash("¡Ayuda entregada!", W / 2, VY + 30);
          radio("roger", it ? `les llegó: ${it.w} (${it.es})` : "ayuda recibida");
        } else {
          stats.foe++; boom(x1, y1 - 20);
          flash("¡Blanco destruido!", W / 2, VY + 30);
          radio("copy", "barricada destruida");
        }
      } else if(other){
        /* bomba a los aliados o ayuda al enemigo: no pasa nada (solo un aviso) */
        flash(other.kind === "camp" ? "¡Alto! Son aliados" : "Eso es del enemigo", objX(other, 1), y0 - 60);
        radio("halt", other.kind === "camp" ? "¡no bombardees a los aliados!" : null, false);
      }
    }, RM() ? 30 : 420);
  }
  function frame(now){
    if(!live() || ended) return;
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    const on = started && !document.hidden && !run.paused;
    root.classList.toggle("fl-paused", !on);
    if(on){
      gameT += dt;
      const sp = speed();
      for(const f of puffs){ f.z -= dt * sp * 1.1; if(f.z < .7) f.z += Z_FAR - .7; }
      if(phase === "fly"){ z -= dt * sp; if(z <= 1){ z = 1; resolve(lane === rounds[r].ok); } }
      else if(phase === "pass" && z > .55) z -= dt * sp * .8;
      for(const o of objs){
        if(o.dead) continue;
        o.z -= dt * sp * o.v;
        if(o.side) o.el.classList.toggle("zone", inZone(o));
        /* un dron que llega al carril de la nave: choque */
        if(o.kind === "drone" && !o.done && o.z <= 1){
          o.done = true;
          if(o.lane === lane && gameT - hurtT > .8 && phase !== "wait"){
            hurtT = gameT; loseLife(); boom(laneX(lane, 1), BY - bird.offsetHeight * .5);
            bird.classList.remove("hit"); void bird.offsetWidth; bird.classList.add("hit");
            flash("¡Impacto!", laneX(lane, 1), BY - bird.offsetHeight - 30);
            radio("again", "¡esquiva los drones!", false);
            if(lives <= 0 && phase === "fly"){ phase = "wait"; api.later(run, end, 900); }
          }
        }
        if(o.z < .4) killObj(o);
      }
      for(let i = objs.length - 1; i >= 0; i--) if(objs[i].dead) objs.splice(i, 1);
      if(radioT && gameT > radioT){ radioEl.classList.remove("on"); radioT = 0; }
      draw();
    }
    run.raf = requestAnimationFrame(frame);
  }
  /* tocar: la puerta o el carril (por la x del toque); deslizar a un lado mueve un carril */
  let sx = null, sy = 0, swiped = false;
  const isBtn = e => e.target.closest(".fl-arrow,.fl-act,.fl-pick");
  stage.addEventListener("pointerdown", e => { if(isBtn(e)) return; sx = e.clientX; sy = e.clientY; swiped = false; });
  stage.addEventListener("pointermove", e => {
    if(sx === null || swiped) return;
    const dx = e.clientX - sx;
    if(Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(e.clientY - sy)){ swiped = true; move(lane + (dx > 0 ? 1 : -1)); }
  });
  stage.addEventListener("pointerup", e => {
    if(sx === null) return;
    const was = swiped; sx = null;
    if(was || isBtn(e)) return;
    const g = e.target.closest(".fl-gate");
    if(g){ move(+g.dataset.i); return; }
    const x = e.clientX - stage.getBoundingClientRect().left;
    move(x < W / 2 - GAP / 2 ? 0 : x > W / 2 + GAP / 2 ? 2 : 1);
  });
  stage.addEventListener("pointercancel", () => { sx = null; });
  root.querySelector("#fl-l").onclick = () => move(lane - 1);
  root.querySelector("#fl-r").onclick = () => move(lane + 1);
  root.querySelector("#fl-fire").onclick = fire;
  root.querySelector("#fl-bomb").onclick = () => drop("bomb");
  root.querySelector("#fl-aid").onclick = () => drop("aid");
  const kb = e => {
    if(e.ctrlKey || e.metaKey || e.altKey || (e.target.closest && e.target.closest("input,textarea,select"))) return;
    const k = e.key;
    if(k === "ArrowLeft" || k === "a" || k === "A"){ e.preventDefault(); move(lane - 1); }
    else if(k === "ArrowRight" || k === "d" || k === "D"){ e.preventDefault(); move(lane + 1); }
    else if(k === "1" || k === "2" || k === "3"){ e.preventDefault(); move(+k - 1); }
    else if(jet && (k === " " || k === "ArrowUp" || k === "f" || k === "F")){ e.preventDefault(); fire(); }
    else if(jet && (k === "b" || k === "B")){ e.preventDefault(); drop("bomb"); }
    else if(jet && (k === "s" || k === "S")){ e.preventDefault(); drop("aid"); }
  };
  const onR = () => { if(live()) measure(); };
  addEventListener("resize", onR); run.clean.push(() => removeEventListener("resize", onR));
  measure();
  requestAnimationFrame(() => { if(live()) measure(); });
  last = performance.now();
  run.raf = requestAnimationFrame(frame);
  /* elegir la nave (después de la explicación); con el teclado, 1 o 2. Fuera del tema Soldados el avión sale en oscuro
     y al tocarlo solo avisa */
  function choose(v){
    const pk = root.querySelector("#fl-pick"); if(!pk || pk.hidden || !live() || started) return;
    if(v === "jet" && !MIL){
      api.haptic("selection");
      try{ if(window.M && typeof M.toast === "function") M.toast(`${JET_OFF}. Elígelo en Juegos, arriba en «Tema».`, {icon: IC("lock", "bold", 20)}); }catch(e){}
      return;
    }
    pk.hidden = true;
    jet = v === "jet";
    if(MIL) vehSet(v);
    root.classList.toggle("fl-jet", jet);
    bird.innerHTML = jet ? JET : BIRD;
    root.querySelector("#fl-acts").hidden = !jet;
    root.querySelector("#fl-lab").textContent = jet ? "Objetivo: la palabra…" : "Vuela a la puerta de…";
    api.haptic("selection");
    started = true; last = performance.now(); measure();
    api.keys(run, kb);
    round();
    if(jet) radio("att", "¡empieza la misión!");
  }
  root.querySelectorAll(".fl-veh").forEach(b => { b.onclick = () => choose(b.dataset.veh); });
  api.intro(run, ID, () => {
    const pk = root.querySelector("#fl-pick"); pk.hidden = false;
    api.keys(run, e => {
      if(e.key === "1" || e.key === "2"){ e.preventDefault(); choose(e.key === "1" ? "bird" : "jet"); }
      else if(e.key === "Enter" && !(e.target.closest && e.target.closest("button"))){ e.preventDefault(); choose(lastVeh || "bird"); }
    });
    const b = pk.querySelector(".fl-veh.last");
    if(b && api.kbd && api.kbd()) try{ b.focus({preventScroll: true}); }catch(e){}
  });
}

const reg = window.vocabGames && typeof vocabGames.register === "function" && vocabGames.register(ID, {
  t: "Pajarito volador", sub: "Pajarito o avión de combate", img: "img/games/pajarito.png",
  how: "Arriba sale una palabra del tema. Ve a la puerta que la dice en el idioma: toca la puerta, tu lado o desliza. Con el tema Soldados puedes volar en avión de combate: dispara, esquiva drones, bombardea barricadas y lanza ayuda a los soldados.",
  topic: true,
  fresh: true,
  rec: b => `${Number.isFinite(+b.score) ? +b.score : 0} palabras`,
  start,
});
if(!reg) console.warn("[flyer] no se pudo añadir a Juegos");
})();
