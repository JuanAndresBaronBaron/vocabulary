/* módulo season: las temporadas (SPEC §5-E), por la fecha local del aparato. Fuera de fecha no se ve nada.
   - Halloween del 10 al 31 de octubre · Bonfire Night del 1 al 5 de noviembre (solo si el idioma es inglés) · calendario
     de adviento del 1 al 24 de diciembre (los tres idiomas).
   - Pruebas: ?season=halloween|bonfire|advent fuerza una temporada y ?season=off las apaga, en la dirección
     (index.html?season=… o #/…?season=…). Vale para esta sesión (sessionStorage "vocab:season"); ?season=auto vuelve a la
     fecha. Bonfire Night sigue siendo solo en inglés.
   - Hoy: una fila compacta (HOME_SLOTS, id "season"): «Truco o trato», «Bonfire Night» o «Calendario» con la ventanita del
     día. Lleva a #/temporada, una pantalla de Hoy (la pestaña Hoy queda marcada y al tocarla vuelve a Hoy).
   - Halloween, «Truco o trato» (#/temporada): una calle de noche con 10 puertas. Al tocar una se abre y sale un dibujo; en
     una hoja suena la palabra y se elige entre 3 palabras escritas (o, la mitad de las veces, se oye y se elige entre 3
     dibujos). Acierto: ✓ verde, suena, la hoja se cierra sola al acabar el audio (nunca antes de 0,9 s) y un caramelo vuela
     a la bolsa (M.burst). Fallo: la elegida en gris con ✗, la buena en verde y vuelve a sonar, «Seguir»; la puerta se
     cierra y se queda para volver a intentarlo. Sin temblor ni sonido triste. Con las 10: «¡Bolsa llena!», una pegatina
     nueva en «Mis cosas de Halloween» (#/temporada/cosas) y award(10, "¡Truco o trato!", false, pegatina), las dos cosas
     una vez al día como mucho (también si se va a otra pantalla justo al acertar la última). «Otra vez» cierra las
     puertas para seguir practicando.
   - Bonfire Night: lo mismo con 5 cajas, fuegos artificiales al acertar (M.burst con oro, azul, verde azulado, verde y
     blanco), «Mis cosas de Bonfire Night» y award(10, "¡Bonfire Night!") una vez al día.
   - Adviento: 24 ventanitas. Se abren la de hoy y todas las de antes (nunca caducan); las de después dicen con amabilidad
     cuándo se abren. Cada una enseña su dibujo, suena su palabra y pregunta «¿Qué palabra has oído?» con 2 opciones; luego
     se ve la palabra. Abrir la del día da award(5, "¡Ventanita del día!") una vez al día (al cerrar su hoja).
   - Granja: en Halloween, 4 calabazas y 2 murciélagos en posiciones fijas en la capa .fm-season (bus "farm-mounted"),
     debajo de los animales; los murciélagos vuelan un poco (3 veces) y con «Reducir movimiento» están quietos. Sin la capa,
     nada.
   Datos: data/season.json {v, about, halloween: [10], bonfire: [5], advent: [24 en orden]}; cada palabra {id, es, img,
     w: {english, français?, dansk?}}. Suena con say()/sayP(): el audio grabado si audio/<ab>.json tiene la palabra y, si
     no, la voz del navegador en ese idioma.
   Guardado: localStorage "season" (EXACT en js/save.js: se exporta y se sincroniza) = {"<año>": {
     halloween|bonfire: {run: {d: día, o: [id de la palabra de cada puerta], ok: [puertas acertadas]}, st: {id: día en que
       se consiguió la pegatina}, last: día del último premio, bags: bolsas llenas},
     advent: {open: [ventanitas abiertas], paid: día de las últimas monedas}}}. Solo se escribe al jugar; se guardan este
     año y el anterior. Las monedas solo entran por award().
   Para otros módulos y pruebas: window.vocabSeason = {active(), byDate(fecha), forced(), today(), load(), slot,
     decorate(capa, hz), state}. Emite bus "season-done" {season, sticker, paid} y "season-window" {n, today, first}. */
(() => {
"use strict";

const KEY = "season", SKEY = "vocab:season";
const IDS = ["halloween", "bonfire", "advent"];
const RANGE = {halloween: [10, 10, 31], bonfire: [11, 1, 5], advent: [12, 1, 24]};   /* mes, del día, al día */
const ONLY = {bonfire: ["english"]};
const STREET = {
  halloween: {title: "Truco o trato", seg: "Calle", door: "Puerta", doors: "Puertas", place: "La calle", bag: "basket",
    tip: "Toca una puerta para pedir caramelos", unit: "caramelos", done: "¡Bolsa llena!", why: "¡Truco o trato!",
    cosas: "Mis cosas de Halloween", more: "Llena la bolsa para conseguir otra", row: "img/season/pumpkin.png",
    fresh: "10 puertas con sorpresa", over: "¡Bolsa llena! Vuelve mañana", fly: "img/season/sweets.png", deco: "img/season/bat.png"},
  bonfire: {title: "Bonfire Night", seg: "Fuegos", door: "Caja", doors: "Cajas", place: "La noche de los fuegos", bag: "sparkle",
    tip: "Toca una caja para lanzar fuegos", unit: "fuegos", done: "¡Qué fuegos tan bonitos!", why: "¡Bonfire Night!",
    cosas: "Mis cosas de Bonfire Night", more: "Lanza los 5 fuegos para conseguir otra", row: "img/season/firework.png",
    fresh: "5 cajas con sorpresa", over: "¡Fuegos lanzados! Vuelve mañana", fly: null, deco: "img/season/bonfire.png"},
};
const ADV_ROW = "img/season/christmas-tree.png";
const FIRE = ["#FFCC00", "#1E6EF4", "#008198", "#34C759", "#FFFFFF"];   /* fuegos artificiales: colores de la app */
/* la granja en Halloween: x en % del ancho; y en % de la altura del mundo (dy: desde el horizonte); s en unidades de la
   granja (--u). Las calabazas, junto a la valla y en una esquina; los murciélagos, en el cielo. */
const FARM_DECO = [
  {img: "img/season/pumpkin.png", x: 7, dy: 7, s: .8},
  {img: "img/season/pumpkin.png", x: 30, dy: 4, s: .6},
  {img: "img/season/pumpkin.png", x: 85, dy: 6, s: .72},
  {img: "img/season/pumpkin.png", x: 91, y: 98, s: .9},
  {img: "img/season/bat.png", x: 18, y: 20, s: .62, bat: 1},
  {img: "img/season/bat.png", x: 71, y: 14, s: .5, bat: 2},
];

const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const RM = () => { try{ return !!(window.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const IC = (n, s = "bold", z = 22, c = "") => { try{ return ico(n, s, z, c); }catch(e){ return ""; } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const shuf = a => { a = [...a]; for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const today = () => dayKey(new Date());
const yearKey = () => String(new Date().getFullYear());
const code = () => (LANGS[lang] || {}).code || "en-GB";
const onRoute = () => secOf(hashPath()) === "temporada";
const snd = n => { try{ sfx.play(n); }catch(e){} };

/* ---------- ¿qué temporada hay? ---------- */
function setForced(q){
  q = String(q || "").toLowerCase();
  try{ if(q === "auto") sessionStorage.removeItem(SKEY); else if(q === "off" || IDS.includes(q)) sessionStorage.setItem(SKEY, q); }catch(e){}
}
/* ?season= en la dirección de la página (una vez, al cargar) y en la del hash (cada vez que se mira) */
try{ const q = new URLSearchParams(location.search).get("season"); if(q) setForced(q); }catch(e){}
function readHash(){
  const i = location.hash.indexOf("?"); if(i < 0) return;
  try{ const q = new URLSearchParams(location.hash.slice(i + 1)).get("season"); if(q) setForced(q); }catch(e){}
}
const forced = () => { try{ const v = sessionStorage.getItem(SKEY); return v === "off" || IDS.includes(v) ? v : null; }catch(e){ return null; } };
function byDate(d = new Date()){
  const m = d.getMonth() + 1, n = d.getDate();
  return IDS.find(id => RANGE[id][0] === m && n >= RANGE[id][1] && n <= RANGE[id][2]) || null;
}
function active(){
  readHash();
  const f = forced(), id = f === "off" ? null : f || byDate();
  return id && (!ONLY[id] || ONLY[id].includes(lang)) ? id : null;
}
/* la ventanita de hoy: el día de diciembre (si se fuerza el adviento otro mes, el día del mes, hasta 24) */
const advToday = () => Math.max(1, Math.min(24, new Date().getDate()));

/* ---------- guardado: localStorage "season" ---------- */
function rootSt(){ const o = store.get(KEY, null); return isObj(o) ? o : {}; }
function get(id){ const Y = rootSt()[yearKey()], s = isObj(Y) ? Y[id] : null; return isObj(s) ? JSON.parse(JSON.stringify(s)) : {}; }
function put(id, s){
  const o = rootSt(), y = yearKey();
  for(const k of Object.keys(o)) if(/^\d{4}$/.test(k) && +k < +y - 1) delete o[k];
  o[y] = Object.assign({}, isObj(o[y]) ? o[y] : {}, {[id]: s});
  store.set(KEY, o);
}
const openSet = s => new Set((Array.isArray(s.open) ? s.open : []).filter(n => Number.isInteger(n) && n >= 1 && n <= 24));

/* ---------- palabras ---------- */
let DATA = null;
function load(){
  if(!DATA) DATA = fetch("data/season.json").then(r => { if(!r.ok) throw new Error("data/season.json " + r.status); return r.json(); })
    .catch(e => { DATA = null; throw e; });
  return DATA;
}
const okW = w => isObj(w) && typeof w.id === "string" && w.id && typeof w.es === "string" && typeof w.img === "string"
  && /^img\/[\w\/.\-]+\.png$/.test(w.img) && isObj(w.w);
const wd = (w, L = lang) => w && isObj(w.w) && typeof w.w[L] === "string" ? w.w[L].trim() : "";
const wordsOf = (D, id) => (D && Array.isArray(D[id]) ? D[id] : []).filter(w => okW(w) && wd(w));
/* el mapa de audios grabados del idioma llega al abrir la app: se espera un poco (2 s como mucho) antes de la primera palabra */
const clipsLoaded = () => { try{ const m = clipMaps[lang]; return !!m && Object.keys(m).length > 0; }catch(e){ return true; } };
async function clipsReady(){ for(let i = 0; i < 20 && !clipsLoaded(); i++) await wait(100); }

/* ---------- estilos ---------- */
const CSS = `
.ss{max-width:640px;margin:0 auto}
.ss-back{display:inline-flex;align-items:center;gap:2px;min-height:var(--tap);margin:0 0 0 -8px;padding:0 12px 0 4px;border-radius:var(--r-pill);
  color:var(--brand-ink);font:600 var(--fs-sub)/1 var(--f-text);text-decoration:none;-webkit-tap-highlight-color:transparent}
.ss-back .ico{color:var(--brand-tint)}
.ss-t{margin:0 0 12px;font:700 var(--fs-t1)/1.1 var(--f-round);color:var(--label)}
.ss .ss-seg{margin-bottom:16px}
.ss-sub{margin:-4px 0 16px;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label2)}
.ss-empty{margin:24px 0;text-align:center;font:400 var(--fs-sub)/1.4 var(--f-text);color:var(--label2)}
/* la calle (contenido sólido: azul marino de noche) */
.ss-street{position:relative;overflow:hidden;isolation:isolate;border-radius:var(--r-card);background:#0B2545;color:#fff;padding:12px 10px 0}
.ss-street::after{content:"";position:absolute;left:0;right:0;bottom:0;height:18px;background:#071A31;z-index:0}
.ss-sky{position:relative;height:92px}
.ss-moon{position:absolute;left:12px;top:6px;width:44px;height:44px;border-radius:50%;background:#F4F1DE;
  box-shadow:0 0 0 8px rgba(244,241,222,.1),0 0 30px 8px rgba(244,241,222,.16)}
.ss-moon::after{content:"";position:absolute;left:25px;top:9px;width:9px;height:9px;border-radius:50%;background:rgba(11,37,69,.12)}
.ss-st{position:absolute;left:var(--x);top:var(--y);width:3px;height:3px;border-radius:50%;background:#fff;opacity:.75}
.ss-sky-d{position:absolute;left:96px;top:14px;width:46px;height:46px;object-fit:contain;-webkit-user-drag:none}
.ss-bag{position:absolute;right:12px;top:12px;z-index:2;display:flex;align-items:center;gap:6px;min-height:40px;padding:0 14px 0 10px;
  border-radius:var(--r-pill);background:#1D3A5F;color:#fff;font:700 var(--fs-sub)/1 var(--f-round);font-variant-numeric:tabular-nums}
.ss-bag .ico{color:#FFCC00}
.ss-doors{position:relative;z-index:1;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px 6px;padding:0 0 18px}
.ss-door{position:relative;display:flex;flex-direction:column;align-items:center;min-width:0;min-height:96px;padding:0;margin:0;border:0;
  background:none;color:#fff;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;
  -webkit-touch-callout:none;user-select:none;--wall:#2E4A6B;--roof:#152C47;--dr:#5C4433}
.ss-door:nth-child(5n+2){--wall:#3A4A5E;--roof:#1C2A3B;--dr:#2F5D4F}
.ss-door:nth-child(5n+3){--wall:#2B5552;--roof:#163331;--dr:#6A3F3F}
.ss-door:nth-child(5n+4){--wall:#454B5A;--roof:#272B36;--dr:#2E4F7A}
.ss-door:nth-child(5n){--wall:#36587C;--roof:#1A3150;--dr:#585E6A}
.ss-roof{display:block;width:100%;height:26px;background:var(--roof);clip-path:polygon(50% 0,100% 100%,0 100%)}
.ss-wall{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;width:86%;height:72px;
  background:var(--wall);border-radius:0 0 4px 4px}
.ss-win{position:absolute;top:8px;left:50%;width:14px;height:12px;margin-left:-7px;border-radius:2px;background:#FFCC00;box-shadow:0 0 10px rgba(255,204,0,.5)}
.ss-dr{position:relative;width:64%;max-width:46px;height:46px;perspective:260px}
.ss-in{position:absolute;inset:0;border-radius:6px 6px 0 0;background:#FFE9A8;display:grid;place-items:center;overflow:hidden}
.ss-in img{width:90%;height:90%;object-fit:contain;-webkit-user-drag:none}
.ss-in .ico{color:#0B2545}
.ss-leaf{position:absolute;inset:0;border-radius:6px 6px 0 0;background:var(--dr);display:grid;place-items:center;transform-origin:0 50%;
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.14);transition:transform .38s cubic-bezier(.3,1.2,.5,1)}
.ss-leaf::after{content:"";position:absolute;right:5px;top:56%;width:5px;height:5px;border-radius:50%;background:#FFCC00}
.ss-leaf b{font:700 1.05rem/1 var(--f-round);color:#fff}
.ss-door.is-open .ss-leaf,.ss-door.is-done .ss-leaf{transform:rotateY(-108deg)}
.ss-door.is-open .ss-in>*{animation:ss-pop .34s .16s cubic-bezier(.3,1.4,.5,1) backwards}
@keyframes ss-pop{from{transform:scale(.3);opacity:0}}
.ss-got{position:absolute;right:4%;top:20px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:var(--ok-fill);color:#fff;box-shadow:0 0 0 2px #0B2545}
.ss-door:focus-visible{outline:3px solid #fff;outline-offset:2px;border-radius:8px}
@media (hover:hover){.ss-door:not(.is-done):hover .ss-leaf{filter:brightness(1.18)}}
.ss-tip{margin:12px 4px 0;text-align:center;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label2)}
.ss-fly{position:fixed;z-index:35;width:40px;height:40px;object-fit:contain;pointer-events:none}
/* Bonfire Night: cajas en la colina */
.ss-bonfire .ss-street::after{height:56px;background:#1F3A2E;border-radius:50% 50% 0 0/24px 24px 0 0}
.ss-bonfire .ss-sky{height:112px}
.ss-bonfire .ss-sky-d{left:auto;right:18px;top:auto;bottom:6px;width:60px;height:60px}
.ss-bonfire .ss-bag{right:auto;left:72px}
.ss-bonfire .ss-door{min-height:88px}
.ss-bonfire .ss-roof,.ss-bonfire .ss-win{display:none}
.ss-bonfire .ss-wall{width:92%;height:82px;border-radius:8px;justify-content:center;background:repeating-linear-gradient(0deg,#5C4433 0 13px,#4A3628 13px 15px)}
.ss-bonfire .ss-dr{width:72%;max-width:52px;height:58px}
.ss-bonfire .ss-leaf,.ss-bonfire .ss-in{border-radius:6px}
.ss-bonfire .ss-leaf{background:var(--wall)}
.ss-bonfire .ss-leaf::after{display:none}
.ss-bonfire .ss-got{top:-6px}
/* «¡Bolsa llena!» encima de la calle */
.ss-street.is-full{min-height:340px}
.ss-full{position:absolute;inset:10px;z-index:3;display:grid;place-items:center}
.ss-full[hidden]{display:none}
.ss-fc{width:min(100%,360px);padding:16px 16px 18px;text-align:center;box-shadow:0 12px 30px rgba(0,0,0,.35)}
.ss-fc:focus{outline:none}
.ss-fimg{display:block;width:96px;height:96px;margin:0 auto;object-fit:contain}
.ss-fimg.is-new{animation:ss-spin .7s cubic-bezier(.3,1.35,.5,1) backwards}
@keyframes ss-spin{from{transform:rotateY(180deg) scale(.3);opacity:0}}
.ss-ft{margin:6px 0 4px;font:700 var(--fs-t3)/1.15 var(--f-round);color:var(--label)}
.ss-fm{margin:0 0 14px;font:400 var(--fs-sub)/1.3 var(--f-text);color:var(--label2)}
.ss-fb{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
/* Mis cosas */
.ss-ct{margin:0 0 4px;font:700 var(--fs-t3)/1.2 var(--f-round);color:var(--label)}
.ss-stks{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:12px}
.ss-stk{display:flex;flex-direction:column;align-items:center;gap:2px;min-height:132px;padding:12px 6px 10px;border:0;font:inherit;color:var(--label);
  text-align:center;cursor:pointer;-webkit-tap-highlight-color:transparent}
.ss-stk img{width:64px;height:64px;object-fit:contain;margin-bottom:4px;-webkit-user-drag:none}
.ss-sw{font:700 var(--fs-sub)/1.15 var(--f-round);overflow-wrap:anywhere}
.ss-se{font:400 var(--fs-note)/1.2 var(--f-text);color:var(--label2)}
.ss-stk.is-off{cursor:default;background:var(--fill2)}
.ss-stk.is-off img{filter:brightness(0);opacity:.18}
:root[data-theme=dark] .ss-stk.is-off img{filter:brightness(0) invert(1);opacity:.2}
.ss-stk.is-off .ss-sw{color:var(--label2)}
/* adviento */
.ss-cal{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
@media (min-width:560px){.ss-cal{grid-template-columns:repeat(6,minmax(0,1fr))}}
.ss-w{position:relative;aspect-ratio:1;min-height:64px;padding:0;margin:0;border:0;border-radius:var(--r-md);background:#0B2545;color:#fff;font:inherit;
  cursor:pointer;overflow:hidden;display:grid;place-items:center;box-shadow:inset 0 0 0 2px rgba(255,255,255,.14);perspective:320px;
  -webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;user-select:none}
.ss-wl{display:flex;flex-direction:column;align-items:center;gap:2px}
.ss-wl b,.ss-wleaf b{font:700 1.75rem/1 var(--f-round)}
.ss-w.is-past::after{content:"";position:absolute;right:8px;top:8px;width:8px;height:8px;border-radius:50%;background:#FFCC00}
.ss-w.is-today{box-shadow:0 0 0 3px var(--gold),inset 0 0 0 2px rgba(255,255,255,.2)}
.ss-w.ss-call{animation:ss-call 1.1s ease-in-out 3}
@keyframes ss-call{50%{transform:scale(1.06)}}
.ss-w.is-future{background:#21385A;color:rgba(255,255,255,.72);cursor:default}
.ss-w.is-future .ico{opacity:.8}
.ss-w.is-open{background:#fff;box-shadow:inset 0 0 0 2px var(--sep)}
.ss-w.is-open img{width:68%;height:68%;object-fit:contain;-webkit-user-drag:none}
.ss-wn{position:absolute;left:8px;top:6px;font:700 var(--fs-note)/1 var(--f-round);color:#3C3C43}
.ss-wleaf{position:absolute;inset:0;display:grid;place-items:center;background:#0B2545;color:#fff;transform-origin:0 50%;transition:transform .42s cubic-bezier(.3,1.1,.5,1)}
.ss-w.is-opening .ss-wleaf{transform:rotateY(-112deg)}
.ss-w:focus-visible{outline:3px solid var(--brand-tint);outline-offset:3px}
:root[data-theme=dark] .ss-w.is-open{background:#F2F2F7}
/* la hoja de cada puerta o ventanita */
dialog.ss-q{max-width:560px}
dialog#ss-q.m-sheet.glass{background:var(--card,#fff);-webkit-backdrop-filter:none;backdrop-filter:none}   /* sólida, como las hojas de los juegos */
.ss-q-b{display:flex;flex-direction:column;align-items:center;gap:12px;padding:0 0 8px}
.ss-q-pic{width:132px;height:132px;border-radius:28px;background:var(--card-2);display:grid;place-items:center}
.ss-q-pic img{width:86%;height:86%;object-fit:contain;-webkit-user-drag:none}
:root[data-theme=dark] .ss-q-pic{background:#F2F2F7}
.ss-q-say{display:flex;align-items:center;gap:16px}
.ss-spk{width:64px;height:64px;border:0;border-radius:50%;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-tint);cursor:pointer;
  transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms)}
.ss-slow{width:48px;height:48px;border:0;border-radius:50%;display:grid;place-items:center;background:var(--fill2);color:var(--label);cursor:pointer}
.ss-spk.playing,.ss-slow.playing{background:var(--brand-fill);color:#fff}
.ss-q-w{margin:0;text-align:center;font:700 var(--fs-t2)/1.15 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.ss-q-es{margin:-6px 0 0;text-align:center;font:400 var(--fs-sub)/1.3 var(--f-text);color:var(--label2)}
.ss-q-p{margin:0;min-height:2.6em;display:flex;align-items:center;justify-content:center;text-align:center;font:600 var(--fs-head)/1.3 var(--f-text);color:var(--label)}
.ss-q-p b{font-family:var(--f-round)}
.ss-opts{display:grid;gap:10px;width:100%}
.ss-opts.is-word{grid-template-columns:minmax(0,1fr)}
.ss-opts.is-pic{grid-template-columns:repeat(3,minmax(0,1fr))}
.ss-o{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;min-width:0;min-height:60px;padding:8px 46px;margin:0;border:0;
  border-radius:20px;background:var(--card-2);color:var(--label);font:700 var(--fs-t3)/1.15 var(--f-round);text-align:center;overflow-wrap:anywhere;cursor:pointer;
  box-shadow:inset 0 0 0 2px var(--sep);transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms);-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.ss-op{min-height:108px;padding:10px 6px}
.ss-op img{width:76px;height:76px;object-fit:contain;-webkit-user-drag:none}
:root[data-theme=dark] .ss-op img{background:#F2F2F7;border-radius:16px;padding:4px}
.ss-o.is-ok{background:var(--ok-fill);color:#fff;box-shadow:0 8px 20px -8px rgba(0,137,50,.7)}
.ss-o.is-miss{background:var(--miss-fill);color:var(--miss-on);box-shadow:none}
.ss-o.is-miss img{filter:grayscale(1);opacity:.55}
.ss-o.is-dim{color:var(--label2)}
.ss-o.is-dim img{opacity:.6}
.ss-o[aria-disabled=true]{cursor:default}
.ss-mk{position:absolute;right:12px;top:50%;width:28px;height:28px;margin-top:-14px;border-radius:50%;display:none;place-items:center}
.ss-op .ss-mk{top:8px;right:8px;margin:0}
.ss-o.is-ok .ss-mk{display:grid;background:#fff;color:var(--ok-fill)}
.ss-o.is-miss .ss-mk{display:grid;background:var(--miss);color:#fff}
.ss-k{display:none;position:absolute;left:10px;top:8px;color:var(--label)}
.ss-o[aria-disabled=true] .ss-k{visibility:hidden}
:root[data-kbd] .ss-k{display:inline-flex}
@media (hover:hover) and (pointer:fine){.ss-k{display:inline-flex}}
@media (hover:hover){.ss-o:not([aria-disabled=true]):hover{box-shadow:inset 0 0 0 2px var(--brand-tint)}}
.ss-o:focus-visible{outline:3px solid var(--brand-tint);outline-offset:3px}
.ss-q-dock{min-height:56px;display:flex;justify-content:center;align-items:center;width:100%}
.ss-q-dock .glass-btn{min-width:200px}
/* Hoy */
.ss-ric img{width:26px;height:26px;object-fit:contain}
:root[data-theme=dark] .ss-ric{background:#F2F2F7}
/* la granja */
.ss-fd{position:absolute;transform:translate(-50%,-100%);pointer-events:none;-webkit-user-drag:none;user-select:none;filter:drop-shadow(0 3px 2px rgba(0,0,0,.18))}
.ss-fd-bat{transform:translate(-50%,-50%);filter:none;animation:ss-bat 2.6s ease-in-out var(--dl,0s) 6 alternate}
.ss-fd-bat.still{animation:none}
@keyframes ss-bat{from{translate:0 0;rotate:-5deg}to{translate:12px -9px;rotate:5deg}}
@media (max-width:380px){.ss-doors{gap:12px 4px}.ss-leaf b{font-size:.95rem}.ss-o{padding:8px 40px}}
@media (prefers-reduced-motion: reduce){
  .ss-leaf,.ss-wleaf{transition:opacity .15s}
  .ss-door.is-open .ss-leaf,.ss-door.is-done .ss-leaf,.ss-w.is-opening .ss-wleaf{transform:none;opacity:0}
  .ss-door.is-open .ss-in>*,.ss-fimg.is-new,.ss-w.ss-call,.ss-fd-bat{animation:none}
  .ss-o,.ss-spk{transition:none}
}`;
function css(){
  if(document.getElementById("css-season")) return;
  const s = document.createElement("style"); s.id = "css-season"; s.textContent = CSS; document.head.appendChild(s);
}

/* ---------- Hoy: la fila de la temporada ---------- */
const rowHtml = (img, t, sub) => `<a class="card hm-row ss-row" href="#/temporada" id="ss-row" aria-label="${esc(t)}. ${esc(sub)}">`
  + `<span class="hm-ric emo ss-ric" aria-hidden="true"><img src="${esc(img)}" alt="" width="26" height="26"></span>`
  + `<span class="hm-rt">${esc(t)}<small>${esc(sub)}</small></span>${IC("caret-right", "bold", 16, "hm-chev")}</a>`;
function slot(){
  const id = active(); if(!id) return null;
  css();
  if(id === "advent"){
    const n = advToday(), open = openSet(get("advent")).has(n);
    return rowHtml(ADV_ROW, "Calendario", open ? `¡Ventanita ${n} abierta!` : `Abre la ventanita ${n}`);
  }
  const C = STREET[id], s = get(id), d = today(), r = isObj(s.run) && s.run.d === d && Array.isArray(s.run.ok) ? s.run : null;
  const n = id === "halloween" ? 10 : 5, k = r ? Math.min(n, new Set(r.ok).size) : 0;
  const sub = s.last === d ? C.over : k ? `${k} de ${n} ${C.unit}` : C.fresh;
  return rowHtml(C.row, C.title, sub);
}
slot.id = "season";
if(typeof HOME_SLOTS !== "undefined") HOME_SLOTS.push(slot);

/* #/temporada es una pantalla de Hoy: la pestaña Hoy queda marcada (y rootOf la devuelve a Hoy) */
try{ const T = TABS.find(t => t.id === "hoy"); if(T && !T.secs.includes("temporada")) T.secs.push("temporada"); }catch(e){}

/* ---------- la hoja de una puerta o una ventanita ----------
   o = {w, pool, mode: "word" (dibujo + 3 palabras) | "pic" (se oye + 3 dibujos) | "quiz" (dibujo + 2 palabras, luego se ve
   la palabra) | "show" (solo la palabra), title, from, close: texto del botón de arriba}. Se crea una hoja nueva cada vez.
   Devuelve una promesa con {ok, answered} al cerrarse (de cualquier forma: botón, fondo, arrastre, Esc o cambio de ruta). */
let Q = null;
function ask(o){
  return new Promise(resolve => {
    const w = o.w, word = wd(w), L = code(), mode = o.mode;
    const n = mode === "quiz" ? 2 : mode === "show" ? 0 : 3;
    const opts = n ? shuf([w, ...shuf(o.pool.filter(x => x.id !== w.id)).slice(0, n - 1)]) : [];
    const d = document.createElement("dialog");
    d.className = "ss-q"; d.id = "ss-q"; d.setAttribute("aria-labelledby", "ss-q-t"); d.setAttribute("data-no-hint", "");
    const q = Q = {d, w, word, mode, answered: false, ok: false, closed: false};
    const pic = mode !== "pic" ? `<div class="ss-q-pic"><img src="${esc(w.img)}" alt="${esc(w.es)}"></div>` : "";
    const shown = mode === "show" ? `<p class="ss-q-w" lang="${L}">${esc(word)}</p><p class="ss-q-es">${esc(w.es)}</p>` : "";
    const ask = mode === "word" ? "¿Cuál es? Elige la palabra" : mode === "pic" ? "¿Qué has oído? Elige el dibujo" : mode === "quiz" ? "¿Qué palabra has oído?" : "";
    d.innerHTML = `<div class="m-head"><h2 id="ss-q-t">${esc(o.title)}</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>${esc(o.close || "Cerrar")}</button></div>
      <div class="ss-q-b">${pic}${shown}
        <div class="ss-q-say"><button type="button" class="say ss-spk" id="ss-q-spk" aria-label="Escuchar">${IC("speaker-high", "fill", 34)}</button><button type="button" class="say ss-slow" id="ss-q-slow" aria-label="Escuchar despacio">${IC("turtle", "bold", 24)}</button></div>
        ${n ? `<p class="ss-q-p" id="ss-q-p" aria-live="polite">${ask}</p>
        <div class="ss-opts ${mode === "pic" ? "is-pic" : "is-word"}" role="group" aria-labelledby="ss-q-p">${opts.map((x, k) => mode === "pic"
          ? `<button type="button" class="ss-o ss-op" data-id="${esc(x.id)}" aria-label="${esc(x.es)}"><kbd class="ss-k" aria-hidden="true">${k + 1}</kbd><img src="${esc(x.img)}" alt=""><span class="ss-mk" aria-hidden="true"></span></button>`
          : `<button type="button" class="ss-o" data-id="${esc(x.id)}"><kbd class="ss-k" aria-hidden="true">${k + 1}</kbd><span class="ss-ow" lang="${L}">${esc(wd(x))}</span><span class="ss-mk" aria-hidden="true"></span></button>`).join("")}</div>` : ""}
        <div class="ss-q-dock"><button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="ss-q-go"${mode === "show" ? "" : " hidden"}>${mode === "quiz" || mode === "show" ? "Listo" : "Seguir"}</button></div>
      </div>`;
    document.body.appendChild(d);
    const spk = d.querySelector("#ss-q-spk");
    d.addEventListener("click", e => {
      const t = e.target;
      if(t.closest("[data-close]") || t.closest("#ss-q-go")){ closeQ(); return; }
      if(t.closest("#ss-q-spk")){ say(word, spk); return; }
      if(t.closest("#ss-q-slow")){ say(word, t.closest("#ss-q-slow"), true); return; }
      const b = t.closest(".ss-o"); if(b) pick(q, b);
    });
    d.addEventListener("keydown", e => {
      if(e.altKey || e.ctrlKey || e.metaKey) return;
      const k = +e.key;
      if(k >= 1 && k <= opts.length){ e.preventDefault(); const b = d.querySelectorAll(".ss-o")[k - 1]; if(b) pick(q, b); }
      else if(e.key === " " && !(e.target.closest && e.target.closest("button"))){ e.preventDefault(); say(word, spk, e.shiftKey); }
    });
    d.addEventListener("close", () => {
      q.closed = true; if(Q === q) Q = null;
      try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch(e){}
      setTimeout(() => d.remove(), 600);
      resolve({ok: q.ok, answered: q.answered});
    }, {once: true});
    try{ if(window.M && typeof M.openSheet === "function") M.openSheet(d, {from: o.from || null}); else d.showModal(); }catch(e){ try{ d.showModal(); }catch(e2){} }
    clipsReady().then(() => { if(!q.closed && !q.answered) sayP(word, spk); });
  });
}
function closeQ(now){
  const q = Q; if(!q || !q.d.open) return;
  if(now){ q.d.close(); return; }
  try{ if(window.M && typeof M.closeSheet === "function") M.closeSheet(q.d); else q.d.close(); }catch(e){ q.d.close(); }
}
function mark(b, ok){
  if(!b) return;
  b.classList.add(ok ? "is-ok" : "is-miss");
  const m = b.querySelector(".ss-mk"); if(m) m.innerHTML = IC(ok ? "check" : "x", "bold", 16);
  const lbl = b.getAttribute("aria-label");
  const t = ok ? " (correcta)" : " (tu respuesta)";
  if(lbl) b.setAttribute("aria-label", lbl + t); else b.insertAdjacentHTML("beforeend", `<span class="vh">${t}</span>`);
}
async function pick(q, b){
  if(q.answered || q.closed) return;
  q.answered = true;
  const ok = b.dataset.id === q.w.id, d = q.d, spk = d.querySelector("#ss-q-spk"), p = d.querySelector("#ss-q-p"), L = code();
  const right = [...d.querySelectorAll(".ss-o")].find(x => x.dataset.id === q.w.id);
  d.querySelectorAll(".ss-o").forEach(x => { x.setAttribute("aria-disabled", "true"); if(x !== b && x !== right) x.classList.add("is-dim"); });
  mark(right, true);
  const said = `«<b lang="${L}">${esc(q.word)}</b>» · ${esc(q.w.es)}`;
  if(q.mode === "quiz"){   /* adviento: después de contestar se ve la palabra */
    const pic = d.querySelector(".ss-q-pic");
    if(pic) pic.insertAdjacentHTML("afterend", `<p class="ss-q-w" lang="${L}">${esc(q.word)}</p><p class="ss-q-es">${esc(q.w.es)}</p>`);
  }
  if(ok){
    q.ok = true;
    try{ M.ok(b, {haptic: true}); }catch(e){}
    snd("ok");
    if(p) p.innerHTML = `<span>¡Muy bien! ${said}</span>`;
    if(q.mode === "quiz"){ showGo(d); try{ M.burst(b, {n: 10}); }catch(e){} sayP(q.word, spk); return; }
    const t0 = Date.now();
    await sayP(q.word, spk);
    await wait(Math.max(350, 900 - (Date.now() - t0)));
    if(Q === q && !q.closed) closeQ();
  } else {
    mark(b, false);
    if(p) p.innerHTML = `<span>¡Casi! Es ${said}</span>`;
    say(q.word, spk);
    showGo(d);
  }
}
function showGo(d){ const g = d.querySelector("#ss-q-go"); if(g){ g.hidden = false; try{ g.focus({preventScroll: true}); }catch(e){} } }

/* ---------- la calle (Halloween) y las cajas (Bonfire Night) ---------- */
let NAV = 0, S = null, A = null;
const STARS = [[22, 64], [30, 14], [44, 40], [55, 10], [62, 58], [70, 28], [80, 70], [88, 18], [12, 78], [38, 80], [94, 46], [5, 30]];
function head(id, sub){
  const C = STREET[id];
  return `<a class="ss-back" href="#/">${IC("caret-left", "bold", 20)}<span>Hoy</span></a>
    <h1 class="ss-t">${esc(C.title)}</h1>
    <div class="seg ss-seg" role="tablist" aria-label="${esc(C.title)}">
      <a class="seg-i" role="tab" href="#/temporada" aria-selected="${!sub}" tabindex="${sub ? -1 : 0}">${esc(C.seg)}</a>
      <a class="seg-i" role="tab" href="#/temporada/cosas" aria-selected="${!!sub}" tabindex="${sub ? 0 : -1}">Mis cosas</a></div>`;
}
/* las puertas de hoy: un orden nuevo cada día (o al pulsar «Otra vez»), con las acertadas */
function runFor(id, W){
  const s = get(id), d = today(), ids = W.map(w => w.id);
  let r = s.run;
  if(!(isObj(r) && r.d === d && Array.isArray(r.o) && r.o.length === ids.length && r.o.every(x => ids.includes(x)) && new Set(r.o).size === r.o.length))
    r = {d, o: shuf(ids), ok: []};
  r = {d: r.d, o: [...r.o], ok: [...new Set((Array.isArray(r.ok) ? r.ok : []).filter(i => Number.isInteger(i) && i >= 0 && i < r.o.length))]};
  return r;
}
function doorHtml(st, i){
  const w = st.byId[st.run.o[i]], done = st.run.ok.includes(i);
  const lbl = done ? `${st.C.door} ${i + 1}: ${w.es}, ${wd(w)}` : `${st.C.door} ${i + 1}`;
  return `<button type="button" class="ss-door${done ? " is-done" : ""}" data-i="${i}" data-press="sink" aria-label="${esc(lbl)}">
    <span class="ss-roof" aria-hidden="true"></span>
    <span class="ss-wall" aria-hidden="true"><i class="ss-win"></i><span class="ss-dr"><span class="ss-in">${done ? `<img src="${esc(w.img)}" alt="">` : ""}</span><span class="ss-leaf"><b>${i + 1}</b></span></span></span>
    ${done ? `<span class="ss-got" aria-hidden="true">${IC("check", "bold", 14)}</span>` : ""}</button>`;
}
function streetPage(id, D, sub){
  const C = STREET[id], W = wordsOf(D, id), app = $("#app");
  if(W.length < 3){
    app.innerHTML = `<div class="ss ss-${id}" data-season="${id}">${head(id, sub)}<p class="ss-empty">Ahora no se puede abrir. ¡Prueba otra vez en un rato!</p></div>`;
    return;
  }
  if(sub === "cosas") return cosas(id, C, W);
  const st = S = {id, C, W, byId: Object.fromEntries(W.map(w => [w.id, w])), run: runFor(id, W), busy: false, full: false, root: null, target: null, mode: null};
  const N = W.length;
  app.innerHTML = `<div class="ss ss-${id}" id="ss" data-season="${id}">${head(id, "")}
    <section class="ss-street" id="ss-street" aria-label="${esc(C.place)}">
      <div class="ss-sky" aria-hidden="true"><i class="ss-moon"></i>${STARS.map(([x, y]) => `<i class="ss-st" style="--x:${x}%;--y:${y}%"></i>`).join("")}<img class="ss-sky-d" src="${esc(C.deco)}" alt=""></div>
      <div class="ss-bag" id="ss-bag">${IC(C.bag, "bold", 20)}<b id="ss-bag-n">${st.run.ok.length}</b><span>/ ${N}</span><span class="vh"> ${esc(C.unit)}</span></div>
      <div class="ss-doors" role="group" aria-label="${esc(C.doors)}">${W.map((w, i) => doorHtml(st, i)).join("")}</div>
      <div class="ss-full" id="ss-full" hidden></div>
    </section>
    <p class="ss-tip" id="ss-tip" aria-live="polite">${esc(C.tip)}</p></div>`;
  st.root = app.querySelector("#ss");
  st.root.querySelector(".ss-doors").addEventListener("click", e => { const b = e.target.closest(".ss-door"); if(b) knock(st, b); });
  /* la bolsa ya está llena: el premio de hoy, si se fue de la pantalla antes de verlo; si no, la tarjeta de antes */
  if(st.run.ok.length >= N){ if(get(id).last !== today()) full(st); else { st.full = true; showFull(st, {fresh: null, pay: false}); } }
}
async function knock(st, b){
  if(S !== st || st.busy || st.full) return;
  const i = +b.dataset.i, w = st.byId[st.run.o[i]]; if(!w) return;
  if(st.run.ok.includes(i)){ say(wd(w)); try{ M.ok(b); }catch(e){} return; }   /* ya abierta: vuelve a decir su palabra */
  st.busy = true;
  const mode = Math.random() < .5 ? "pic" : "word", inn = b.querySelector(".ss-in");
  st.target = w.id; st.mode = mode;
  inn.innerHTML = mode === "word" ? `<img src="${esc(w.img)}" alt="">` : IC("speaker-high", "fill", 22);
  b.classList.add("is-open");
  await wait(RM() ? 120 : 420);
  let res = {ok: false};
  if(S === st) res = await ask({w, mode, pool: st.W, title: `${st.C.door} ${i + 1}`, from: b});
  st.target = null; st.mode = null;
  if(S !== st){ if(res.ok){ okDoor(st, i); if(st.run.ok.length >= st.W.length) left(st); } return; }
  if(res.ok) await doorDone(st, b, i, w);
  else {
    b.classList.remove("is-open");
    setTimeout(() => { if(!b.classList.contains("is-open") && !b.classList.contains("is-done")) inn.innerHTML = ""; }, 450);
    try{ b.focus({preventScroll: true}); }catch(e){}
  }
  st.busy = false;
}
/* una puerta acertada se guarda enseguida (aunque se vaya a otra pantalla mientras se cierra la hoja) */
function okDoor(st, i){
  if(!st.run.ok.includes(i)) st.run.ok.push(i);
  const s = get(st.id); s.run = st.run; put(st.id, s);
}
async function doorDone(st, b, i, w){
  okDoor(st, i);
  const N = st.W.length, n = st.run.ok.length;
  b.classList.add("is-done");
  b.setAttribute("aria-label", `${st.C.door} ${i + 1}: ${w.es}, ${wd(w)}`);
  b.querySelector(".ss-in").innerHTML = `<img src="${esc(w.img)}" alt="">`;
  if(!b.querySelector(".ss-got")) b.insertAdjacentHTML("beforeend", `<span class="ss-got" aria-hidden="true">${IC("check", "bold", 14)}</span>`);
  const bag = st.root.querySelector("#ss-bag");
  if(st.id === "halloween") await fly(b, bag, st.C.fly);
  else fireworks(st);
  if(S !== st){ if(n >= N) left(st); return; }
  const num = st.root.querySelector("#ss-bag-n"); if(num) num.textContent = n;
  try{ M.bump(bag); }catch(e){}
  try{ M.burst(bag, {n: 10, colors: st.id === "bonfire" ? FIRE : undefined}); }catch(e){}
  const tip = st.root.querySelector("#ss-tip");
  if(tip) tip.textContent = n >= N ? st.C.done : `¡${n} de ${N} ${st.C.unit}!`;
  if(n >= N) full(st);
  else try{ b.focus({preventScroll: true}); }catch(e){}
}
/* el caramelo vuela de la puerta a la bolsa (con «Reducir movimiento», no vuela) */
function fly(from, to, img){
  return new Promise(res => {
    if(RM() || !from || !to || !img || typeof from.animate !== "function"){ res(); return; }
    const a = from.getBoundingClientRect(), z = to.getBoundingClientRect(), el = document.createElement("img");
    el.src = img; el.alt = ""; el.className = "ss-fly"; el.setAttribute("aria-hidden", "true");
    const x0 = a.left + a.width / 2 - 20, y0 = a.top + a.height * .62 - 20, dx = z.left + z.width / 2 - 20 - x0, dy = z.top + z.height / 2 - 20 - y0;
    el.style.left = x0 + "px"; el.style.top = y0 + "px";
    document.body.appendChild(el);
    const lift = Math.min(110, Math.abs(dx) * .35 + 50);
    let done = false;
    const end = () => { if(done) return; done = true; el.remove(); res(); };
    try{
      const an = el.animate([{transform: "translate(0,0) scale(.5)", opacity: 0}, {transform: `translate(${dx * .45}px,${dy * .45 - lift}px) scale(1.15)`, opacity: 1, offset: .5},
        {transform: `translate(${dx}px,${dy}px) scale(.6)`, opacity: 1}], {duration: 640, easing: "cubic-bezier(.3,.6,.4,1)"});
      an.onfinish = end; an.oncancel = end;
    }catch(e){ end(); }
    setTimeout(end, 1300);
  });
}
/* fuegos artificiales en el cielo de la noche (M.burst; nada con «Reducir movimiento») */
function fireworks(st){
  const sky = st.root && st.root.querySelector(".ss-sky"); if(!sky || RM()) return;
  const r = sky.getBoundingClientRect();
  [0, 170, 340].forEach((t, k) => setTimeout(() => {
    if(S !== st) return;
    try{ M.burst(r.left + r.width * (.22 + .28 * k + Math.random() * .08), r.top + r.height * (.3 + Math.random() * .35), {colors: FIRE, n: 16}); }catch(e){}
  }, t));
  snd("pop");
}
/* las 10 puertas (o las 5 cajas): una pegatina nueva y award(10) una vez al día */
function claim(st){
  const s = get(st.id), d = today();
  let fresh = null, pay = false;
  if(s.last !== d){
    pay = true;
    const have = isObj(s.st) ? s.st : {};
    fresh = st.W.find(w => !have[w.id]) || null;
    if(fresh) have[fresh.id] = d;
    s.st = have; s.last = d; s.bags = (Math.floor(+s.bags) || 0) + 1;
  }
  s.run = st.run; put(st.id, s);
  try{ bus.emit("season-done", {season: st.id, sticker: fresh ? fresh.id : null, paid: pay}); }catch(e){}
  return {fresh, pay};
}
function full(st){ st.full = true; showFull(st, claim(st)); }
/* la última puerta acertada justo al irse a otra pantalla: la pegatina y las monedas, igual (sin la tarjeta) */
function left(st){ const r = claim(st); if(r.pay) award(10, st.C.why); }
function showFull(st, o){
  const box = st.root.querySelector("#ss-full"), street = st.root.querySelector("#ss-street"); if(!box) return;
  const s = get(st.id), have = isObj(s.st) ? s.st : {}, d = today(), L = code();
  const todays = st.W.find(w => have[w.id] === d), all = st.W.every(w => have[w.id]);
  const pic = o.fresh || todays || st.W.filter(w => have[w.id]).pop() || st.W[0];
  const msg = o.fresh ? `¡Pegatina nueva! <b lang="${L}">${esc(wd(o.fresh))}</b> · ${esc(o.fresh.es)}`
    : todays && s.last === d ? `Hoy ganaste <b lang="${L}">${esc(wd(todays))}</b>. ¡Mañana, otra pegatina!`
    : all ? "¡Ya tienes todas las pegatinas!" : "¡Mañana hay otra pegatina!";
  box.innerHTML = `<div class="card ss-fc" tabindex="-1" aria-labelledby="ss-ft">
    <img class="ss-fimg${o.fresh ? " is-new" : ""}" id="ss-fimg" src="${esc(pic.img)}" alt="">
    <h2 class="ss-ft" id="ss-ft">${esc(st.C.done)}</h2>
    <p class="ss-fm">${msg}</p>
    <div class="ss-fb"><a class="glass-btn glass-btn--pri" href="#/temporada/cosas" id="ss-cosas">${IC("sparkle", "bold", 18)}Mis cosas</a><button type="button" class="glass-btn" id="ss-again">${IC("arrow-counter-clockwise", "bold", 18)}Otra vez</button></div></div>`;
  box.hidden = false; street.classList.add("is-full");
  box.querySelector("#ss-again").addEventListener("click", () => again(st));
  const card = box.firstElementChild;
  if(o.pay || o.fresh){
    try{ card.focus({preventScroll: true}); }catch(e){}
    if(o.fresh) snd("gift");
    /* las monedas salen de la pegatina cuando ya se ve; si mientras tanto se va a otra pantalla, se dan igual */
    const img = box.querySelector("#ss-fimg");
    if(o.pay) setTimeout(() => award(10, st.C.why, false, img && img.isConnected ? img : undefined), RM() ? 150 : 650);
  }
}
function again(st){
  if(S !== st) return;
  st.run = {d: today(), o: shuf(st.W.map(w => w.id)), ok: []}; st.full = false;
  const s = get(st.id); s.run = st.run; put(st.id, s);
  const box = st.root.querySelector("#ss-full"); box.hidden = true; box.innerHTML = "";
  st.root.querySelector("#ss-street").classList.remove("is-full");
  st.root.querySelector(".ss-doors").innerHTML = st.W.map((w, i) => doorHtml(st, i)).join("");
  st.root.querySelector("#ss-bag-n").textContent = "0";
  st.root.querySelector("#ss-tip").textContent = st.C.tip;
  try{ st.root.querySelector(".ss-door").focus({preventScroll: true}); }catch(e){}
}
/* «Mis cosas»: las pegatinas de la temporada (las que faltan, en silueta gris); tocar una dice su palabra */
function cosas(id, C, W){
  const s = get(id), have = isObj(s.st) ? s.st : {}, n = W.filter(w => have[w.id]).length, L = code(), app = $("#app");
  app.innerHTML = `<div class="ss ss-${id}" data-season="${id}">${head(id, "cosas")}
    <h2 class="ss-ct">${esc(C.cosas)}</h2>
    <p class="ss-sub">${n} de ${W.length} pegatinas · ${n >= W.length ? "¡Las tienes todas!" : esc(C.more)}</p>
    <div class="ss-stks">${W.map(w => have[w.id]
      ? `<button type="button" class="card ss-stk" data-w="${esc(w.id)}" data-press="sink" aria-label="${esc(w.es)}: ${esc(wd(w))}"><img src="${esc(w.img)}" alt=""><span class="ss-sw" lang="${L}">${esc(wd(w))}</span><span class="ss-se">${esc(w.es)}</span></button>`
      : `<div class="card ss-stk is-off" role="img" aria-label="Pegatina por conseguir"><img src="${esc(w.img)}" alt=""><span class="ss-sw" aria-hidden="true">?</span></div>`).join("")}</div></div>`;
  app.querySelector(".ss-stks").addEventListener("click", e => {
    const b = e.target.closest(".ss-stk[data-w]"); if(!b) return;
    const w = W.find(x => x.id === b.dataset.w); if(!w) return;
    say(wd(w), b); try{ M.ok(b); }catch(err){}
  });
}

/* ---------- el calendario de adviento ---------- */
function winState(n, t, open){ return open.has(n) ? "open" : n > t ? "future" : n === t ? "today" : "past"; }
function winHtml(n, w, stt){
  const lbl = stt === "open" ? `Ventanita ${n}: ${w.es}` : stt === "future" ? `Ventanita ${n}. Se abre el día ${n}` : `Ventanita ${n}${stt === "today" ? ", la de hoy" : ", puedes abrirla"}`;
  return `<button type="button" class="ss-w is-${stt}" data-n="${n}" aria-label="${esc(lbl)}"${stt === "future" ? ' aria-disabled="true"' : ""}>${stt === "open"
    ? `<img src="${esc(w.img)}" alt=""><b class="ss-wn" aria-hidden="true">${n}</b>`
    : `<span class="ss-wl" aria-hidden="true"><b>${n}</b>${stt === "future" ? IC("lock", "bold", 14) : ""}</span>`}</button>`;
}
function advSub(t, open){
  if(open.has(t)) return t === 24 ? "¡Feliz Navidad! Ya abriste todas las de hoy." : `¡Ya abriste la ${t}! Mañana, otra ventanita.`;
  return `Hoy toca la ventanita ${t}. ¡Tócala!`;
}
function advent(D){
  const W = wordsOf(D, "advent"), app = $("#app");
  if(W.length < 24){
    app.innerHTML = `<div class="ss ss-advent" data-season="advent"><a class="ss-back" href="#/">${IC("caret-left", "bold", 20)}<span>Hoy</span></a><h1 class="ss-t">Calendario</h1><p class="ss-empty">Ahora no se puede abrir. ¡Prueba otra vez en un rato!</p></div>`;
    return;
  }
  const t = advToday(), open = openSet(get("advent"));
  const st = A = {W, t, busy: false, root: null};
  app.innerHTML = `<div class="ss ss-advent" id="ss" data-season="advent"><a class="ss-back" href="#/">${IC("caret-left", "bold", 20)}<span>Hoy</span></a>
    <h1 class="ss-t">Calendario</h1>
    <p class="ss-sub" id="ss-asub" aria-live="polite">${esc(advSub(t, open))}</p>
    <div class="ss-cal" role="group" aria-label="Ventanitas">${W.slice(0, 24).map((w, i) => winHtml(i + 1, w, winState(i + 1, t, open))).join("")}</div></div>`;
  st.root = app.querySelector("#ss");
  st.root.querySelector(".ss-cal").addEventListener("click", e => { const b = e.target.closest(".ss-w"); if(b) openWin(st, b); });
  const tb = st.root.querySelector(".ss-w.is-today");
  if(tb && !RM()){ tb.classList.add("ss-call"); tb.addEventListener("animationend", () => tb.classList.remove("ss-call"), {once: true}); }
  /* la de hoy abierta pero sin cobrar (se cerró la app con la hoja abierta): se cobra ahora */
  if(open.has(t)) setTimeout(() => { if(A === st) payToday(st); }, 600);
}
function payToday(st){
  const s = get("advent"), d = today();
  if(s.paid === d || !openSet(s).has(st.t)) return false;
  s.paid = d; put("advent", s);
  const b = st.root && st.root.isConnected ? st.root.querySelector(`.ss-w[data-n="${st.t}"]`) : null;
  award(5, "¡Ventanita del día!", false, b || undefined);
  return true;
}
async function openWin(st, b){
  if(A !== st || st.busy) return;
  const n = +b.dataset.n, w = st.W[n - 1]; if(!w) return;
  if(n > st.t){
    const txt = `¡Paciencia! La ventanita ${n} se abre el día ${n}.`;
    try{ M.toast(txt, {icon: IC("lock", "bold", 20)}); }catch(e){ try{ toast(txt); }catch(e2){} }
    return;
  }
  st.busy = true;
  const s = get("advent"), open = openSet(s), first = !open.has(n);
  if(first){
    open.add(n); s.open = [...open].sort((a, c) => a - c); put("advent", s);
    b.className = "ss-w is-open";
    b.removeAttribute("aria-disabled");
    b.setAttribute("aria-label", `Ventanita ${n}: ${w.es}`);
    b.innerHTML = `<img src="${esc(w.img)}" alt=""><b class="ss-wn" aria-hidden="true">${n}</b><span class="ss-wleaf" aria-hidden="true"><b>${n}</b></span>`;
    if(!RM()){ void b.offsetWidth; b.classList.add("is-opening"); await wait(440); } else { b.classList.add("is-opening"); await wait(160); }
    const lf = b.querySelector(".ss-wleaf"); if(lf) lf.remove();
    b.classList.remove("is-opening");
    try{ bus.emit("season-window", {n, today: n === st.t, first: true}); }catch(e){}
  }
  if(A !== st){ return; }
  await ask({w, mode: first ? "quiz" : "show", pool: st.W, title: `Ventanita ${n}`, from: b});
  if(n === st.t) payToday(st);   /* también si la hoja se cerró al irse a otra pantalla */
  if(A !== st) return;
  const sub = st.root.querySelector("#ss-asub"); if(sub) sub.textContent = advSub(st.t, openSet(get("advent")));
  st.busy = false;
  try{ b.focus({preventScroll: true}); }catch(e){}
}

/* ---------- la ruta #/temporada ---------- */
ROUTES.temporada = async parts => {
  const my = ++NAV; S = null; A = null; closeQ(true);
  const id = active();
  if(!id){ location.replace("#/"); return; }
  css();
  let D = null;
  try{ D = await load(); }catch(e){ console.error(e); }
  if(my !== NAV || !onRoute()) return;
  if(id === "advent") advent(D);
  else streetPage(id, D, parts && parts[0] === "cosas" ? "cosas" : "");
};

/* ---------- la granja: calabazas y murciélagos en Halloween ---------- */
function decorate(layer, hz){
  if(!layer || typeof layer.querySelectorAll !== "function" || !layer.isConnected) return 0;
  layer.querySelectorAll(".ss-fd").forEach(e => e.remove());
  if(active() !== "halloween") return 0;
  css();
  const H = isFinite(+hz) && +hz > 0 ? +hz : 50, still = RM();
  for(const p of FARM_DECO){
    const img = document.createElement("img"), y = p.y != null ? p.y : H + p.dy;
    img.className = "ss-fd" + (p.bat ? " ss-fd-bat" + (still ? " still" : "") : "");
    img.src = p.img; img.alt = ""; img.draggable = false; img.setAttribute("aria-hidden", "true");
    img.style.left = p.x + "%";
    img.style.top = `calc(var(--fm-wh, 70vh) * ${(y / 100).toFixed(3)})`;
    img.style.width = `calc(var(--u, 56px) * ${p.s})`;
    if(p.bat === 2) img.style.setProperty("--dl", "-1.3s");
    layer.appendChild(img);
  }
  return FARM_DECO.length;
}
/* la capa ya montada (si se fuerza o se quita la temporada estando en la granja) */
function refreshFarm(){
  const layer = document.querySelector(".fm-stage .fm-season"); if(!layer) return;
  const want = active() === "halloween", has = !!layer.querySelector(".ss-fd");
  if(want === has) return;
  const stg = layer.closest(".fm-stage"), hz = stg ? parseFloat(stg.style.getPropertyValue("--hz")) : NaN;
  decorate(layer, hz);
}
bus.on("farm-mounted", d => { try{ decorate(d && d.season, d && d.hz); }catch(e){ console.error(e); } });
bus.on("route", d => {
  const h = String((d && d.h) || "");
  if(!h.startsWith("temporada")){ NAV++; S = null; A = null; closeQ(true); }
  try{ refreshFarm(); }catch(e){ console.error(e); }
});
/* si hay temporada, las palabras y los dibujos se piden pronto (para que la calle salga enseguida y sin red) */
bus.on("boot", () => { if(active()) load().catch(() => {}); });

window.vocabSeason = {active, byDate, forced, today: advToday, load, slot, decorate,
  get state(){ return {season: active(), street: S ? {id: S.id, run: JSON.parse(JSON.stringify(S.run)), busy: S.busy, full: S.full, target: S.target, mode: S.mode} : null,
    advent: A ? {today: A.t, busy: A.busy} : null, sheet: Q ? {target: Q.w.id, mode: Q.mode, answered: Q.answered, ok: Q.ok} : null, saved: rootSt()}; }};
})();
