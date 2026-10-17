/* Módulo album: álbum de pegatinas.
   - Cada palabra del vocabulario es una pegatina. Se consigue cuando la palabra está en el repaso del idioma
     actual (srsAll() tiene "doc|es") y es DORADA cuando está dominada (caja b >= MASTER).
   - Rutas: #/album (portada: libro con pestañas por grupo, progreso de cada tema) · #/album/<docId> (página de un tema).
   - Las pegatinas nuevas desde la última visita llegan en un sobre «¡Nueva!»: se despegan al tocarlas (o todas a la vez).
   - Tocar una conseguida abre una tarjeta grande que gira (palabra, 🔊🐢, pronunciación, ejemplo y ficha con su brillo).
     Tocar una bloqueada dice en qué lección del Camino está.
   - Página completa (todas conseguidas): premio una vez por idioma → award(50) + confeti + sello.
   - Portada (HOME_ACTS): botón «📒 Álbum» con «✨ N nuevas»; fin de lección y de repaso: enlace a las pegatinas nuevas.
     Punto azul en la pestaña «Jugar» mientras haya pegatinas nuevas sin ver.
   Guarda: store "album:seen:<lang>" {clave: 1 vista | 2 vista ya dorada} · "album:done:<lang>" {docId: fecha}
           "album:uniq:<lang>" {docId: nº de pegatinas distintas} · "album:tab" (pestaña de la portada).
   Emite: bus "album-complete" {id}. */
(() => {
"use strict";

/* ---------- utilidades ---------- */
const RM = () => { try{ return window.M && typeof window.M.rm === "function" ? window.M.rm() : matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };   /* M.rm() de js/motion.js */
const snd = n => { try{ if(typeof sfx !== "undefined") sfx.play(n); }catch(e){} };
const boom = o => { try{ if(typeof confetti === "function") confetti(o); }catch(e){} };
function boomAt(el, o = {}){
  if(!el || !el.getBoundingClientRect) return;
  const r = el.getBoundingClientRect();
  boom(Object.assign({}, o, {x: r.left + r.width / 2, y: r.top + r.height / 2}));
}
const speak = (t, btn) => { if(t && "speechSynthesis" in window){ try{ say(t, btn); }catch(e){} } };
const hush = () => { try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch(e){} };
const fmt = n => Number(n || 0).toLocaleString("es");
const plural = (n, one, many) => n === 1 ? one : many;
function hash(s){ let h = 2166136261 >>> 0; for(const c of String(s)){ h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
/* paleta: azul marino, azul, verde azulado, verde y gris (texto blanco legible encima) */
const PAL = ["#1f6fd1", "#117c74", "#23803f", "#22409a", "#0f3d75", "#4b5563", "#1a7f9e"];   /* todos con texto blanco a 4,5:1 */
const colorOf = s => PAL[hash(s) % PAL.length];
const tilt = k => ((hash(k) % 800) / 100 - 4).toFixed(2);              /* giro estable entre -4° y 4° */
const delay = k => ((hash("d" + k) % 300) / 100).toFixed(2);           /* desfase estable de animaciones */

const K = {
  seen: () => "album:seen:" + lang,
  done: () => "album:done:" + lang,
  uniq: () => "album:uniq:" + lang,
  orph: () => "album:orph:" + lang,   /* claves del repaso que ya no tienen pegatina (datos antiguos): no cuentan */
  tab: "album:tab",
};
const getSeen = () => store.get(K.seen(), {}) || {};
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const GROUPS = [
  {g: "temas",    tab: "🎨 Temas",       h: "🎨 Temas para empezar",          sub: "Animales, colores, números, la familia…",  c: "#117c74"},
  {g: "3000",     tab: "📗 Las 3000", h: "📗 Las palabras más importantes", sub: "Las 3000 palabras que más se usan.",        c: "#1f6fd1"},
  {g: "avanzado", tab: "🚀 Expertos",    h: "🚀 Palabras de experto",          sub: "Para cuando ya sepas muchísimo.",           c: "#22409a"},
];
const EMO_ID = {animales: "🐶", colores: "🎨", familia: "👪", nacionalidades: "🧑‍🤝‍🧑", paises: "🌍", profesiones: "👷", numeros: "🔢"};
const EMO_RX = [
  [/verbos esenciales/i, "⚡"], [/verbos de movimiento/i, "🏃"], [/verbos de comunicaci/i, "💬"], [/verbos de pensamiento/i, "🤔"],
  [/verbos de la vida diaria/i, "🪥"], [/verbos de cambio/i, "🔄"], [/adjetivos: aspecto/i, "👀"], [/adjetivos: personalidad/i, "😀"],
  [/adjetivos: valoraci/i, "👍"], [/adjetivos/i, "🧩"], [/adverbios/i, "⏩"], [/preposiciones/i, "📦"], [/pronombres/i, "👉"],
  [/conjunciones/i, "🔗"], [/preguntas/i, "❓"], [/personas/i, "🧑‍🤝‍🧑"], [/cuerpo/i, "🖐️"], [/comida/i, "🍎"], [/casa/i, "🏠"],
  [/ropa/i, "👕"], [/ciudad/i, "🏙️"], [/transporte|viajes/i, "🚗"], [/calendario/i, "📅"], [/clima|naturaleza/i, "🌳"],
  [/educaci/i, "🏫"], [/trabajo/i, "💼"], [/dinero/i, "💰"], [/ocio|deporte/i, "⚽"], [/tecnolog/i, "💻"], [/ciencia/i, "🔬"],
  [/sociedad/i, "🏛️"], [/mente|sentimientos/i, "💭"], [/ideas/i, "💡"],
];
const emo = d => EMO_ID[d.id] || (EMO_RX.find(([rx]) => rx.test(d.title)) || [0, "📒"])[1];
const POS = {noun: "Nombre de cosa o ser", verb: "Acción (verbo)", adjective: "Cómo es (adjetivo)", adverb: "Cómo se hace (adverbio)",
  preposition: "Preposición", pronoun: "Pronombre", determiner: "Determinante", conjunction: "Para unir (conjunción)",
  exclamation: "Exclamación ¡!", "modal verb": "Verbo especial (modal)", phrase: "Expresión", "ordinal number": "Número de orden",
  number: "Número", "definite article": "Artículo"};

/* ---------- ciclo de vida: temporizadores y diálogo se limpian al salir ---------- */
let NAV = 0, P = null, DLG = null, CARD = null, OPEN_T = 0, LAST_BOOM = 0;
const TIMERS = new Set(), OVER = new Set();
function later(fn, ms){
  const t = setTimeout(() => { TIMERS.delete(t); try{ fn(); }catch(e){ console.error(e); } }, ms);
  TIMERS.add(t); return t;
}
function stopAll(){
  TIMERS.forEach(clearTimeout); TIMERS.clear();
  OVER.forEach(e => e.remove()); OVER.clear();
  closeDlg(); P = null;
}
const onAlbum = () => /^#\/?album(\/|$)/.test(location.hash);
const alive = nav => nav === NAV && onAlbum();

/* ---------- datos: contadores sin cargar documentos ---------- */
function syncUniq(idx){
  /* nº de pegatinas distintas de cada documento ya cargado (hay palabras con la misma traducción, p. ej. big/large = grande) */
  const U = store.get(K.uniq(), {}) || {}; let ch = false;
  for(const d of idx){
    const doc = (typeof CACHE !== "undefined") && CACHE[d.id];
    if(doc && doc.rows && U[d.id] == null){ U[d.id] = new Set(doc.rows.filter(r => r.es && r.l && r.l[lang]).map(r => r.es)).size; ch = true; }
  }
  if(ch) store.set(K.uniq(), U);
  return U;
}
function stats(){
  const m = srsAll(), seen = getSeen(), orph = store.get(K.orph(), {}) || {}, by = {};
  for(const [k, x] of Object.entries(m)){
    if(!x || orph[k]) continue;
    const d = x.d || k.split("|")[0];
    const o = by[d] || (by[d] = {got: 0, gold: 0, nw: 0});
    const gold = (x.b || 0) >= MASTER;
    o.got++; if(gold) o.gold++;
    if(!seen[k] || (gold && seen[k] < 2)) o.nw++;
  }
  return by;
}
function newTotal(){
  const by = stats(), idx = (typeof INDEX !== "undefined" && INDEX) ? INDEX : null;
  const ok = idx ? new Set(idx.filter(d => d.langs.includes(lang)).map(d => d.id)) : null;
  return Object.entries(by).reduce((a, [d, o]) => a + (!ok || ok.has(d) ? o.nw : 0), 0);
}

/* ---------- caras de las pegatinas ---------- */
function ini(r){
  const es = String(r.es || "?").trim();
  const t = /^\d{1,4}$/.test(es) ? es : ((es.match(/[\p{L}\p{N}]/u) || ["?"])[0]).toUpperCase();
  return `<span class="al-ini${t.length > 2 ? " l" + Math.min(4, t.length) : ""}" style="--pc:${colorOf(es)}">${esc(t)}</span>`;
}
const face = r => r.img ? `<img src="${esc(r.img)}" alt="" loading="lazy" decoding="async">` : ini(r);

/* ---------- estilos ---------- */
const CSS = `
.al-st[hidden],.al-sec[hidden],.al-grp[hidden],.al-empty[hidden],.btn.al-pall[hidden]{display:none!important}
.al-cover{position:relative;overflow:hidden;border-radius:24px;padding:20px 22px 18px 40px;margin:6px 0 16px;color:#fff;
  background:var(--brand-fill);box-shadow:0 7px 0 rgba(8,30,60,.28),var(--shadow)}
[data-theme=dark] .al-cover{background:#0B2545;box-shadow:0 7px 0 rgba(0,0,0,.45),var(--shadow)}
.al-cover::before{content:"";position:absolute;left:0;top:0;bottom:0;width:22px;background:rgba(4,16,34,.32);border-right:2px dashed rgba(255,255,255,.35)}
.al-cv-top{position:relative;display:flex;align-items:center;gap:14px;z-index:1}
.al-cv-ic{font-size:3.3rem;line-height:1;filter:drop-shadow(0 4px 4px rgba(0,0,0,.25));flex:none}
.al-cover h1{margin:0;font-size:1.7rem;line-height:1.15}
.al-cover p{margin:4px 0 0;font-size:1rem}
.al-cv-st{position:relative;z-index:1;margin-top:14px;max-width:560px}
.al-cv-big{font-size:1.22rem}.al-cv-big b{font-size:1.6rem;color:#FFE066}
.al-bar{height:14px;border-radius:99px;background:rgba(255,255,255,.22);overflow:hidden;margin:8px 0 10px}
.al-bar i{display:block;height:100%;border-radius:99px;background:var(--gold);transition:width .6s}
.al-chips{display:flex;flex-wrap:wrap;gap:8px}
.al-chip{background:rgba(0,0,0,.2);border-radius:99px;padding:5px 12px;font-weight:700;font-size:.92rem;white-space:nowrap}
.al-chip.hot{background:#23803f;color:#fff}
.al-deco{position:absolute;right:18px;top:16px;width:200px;height:150px;pointer-events:none}
.al-deco span{position:absolute;width:62px;height:62px;border-radius:14px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:2.1rem;box-shadow:0 6px 12px rgba(0,0,0,.25)}
.al-deco span:nth-child(1){left:10px;top:4px;transform:rotate(-9deg)}
.al-deco span:nth-child(2){left:86px;top:30px;transform:rotate(7deg)}
.al-deco span:nth-child(3){left:20px;top:80px;transform:rotate(5deg);background:linear-gradient(135deg,#fff6d1,#FFCC00 45%,#FFF5CC 60%,#FFCC00)}
.al-deco span:nth-child(4){left:120px;top:96px;transform:rotate(-6deg);background:rgba(255,255,255,.18);border:3px dashed rgba(255,255,255,.55);box-shadow:none;color:rgba(255,255,255,.8);font-weight:900;font-size:1.8rem}
@media (max-width:860px){.al-deco{display:none}}
.al-hello{display:flex;align-items:center;gap:14px;margin:0 0 14px}
.al-hello .speech b{font-size:1.2rem}
.al-news{background:var(--card);border:2px solid #FFCC00;border-radius:18px;padding:12px 14px;margin:0 0 16px;box-shadow:var(--shadow)}
.al-news>b{display:block;margin-bottom:8px;font-size:1.05rem}
.al-news-l{display:flex;flex-wrap:wrap;gap:8px}
.al-nw{display:inline-flex;align-items:center;gap:8px;min-height:46px;padding:6px 14px;border-radius:99px;background:color-mix(in srgb,#FFCC00 18%,var(--card));border:2px solid color-mix(in srgb,#FFCC00 60%,var(--line));text-decoration:none;font-weight:800}
.al-nw span{background:#23803f;color:#fff;border-radius:99px;padding:1px 8px;font-size:.85rem;white-space:nowrap}
.al-nw:hover{border-color:#FFCC00}
.al-tabs{display:flex;gap:6px;padding:0 10px;position:relative;z-index:1}
.al-tab{position:relative;flex:1 1 0;min-width:0;white-space:nowrap;min-height:56px;border:2px solid var(--line);border-bottom:0;border-top:5px solid var(--tc);
  background:var(--soft);border-radius:16px 16px 0 0;padding:6px 8px;margin-bottom:-2px;color:var(--muted);font-weight:800;
  display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.15;font-size:1rem}
.al-tab small{font-weight:700;font-size:.78rem}
.al-tab.on{background:var(--card);color:var(--ink)}
.al-tab.on::after{content:"";position:absolute;left:0;right:0;bottom:-3px;height:5px;background:var(--card)}
.al-tab .al-tdot{position:absolute;top:-12px;right:6px;background:#23803f;color:#fff;border-radius:99px;font-size:.72rem;padding:1px 7px;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.al-book{background:var(--card);border:2px solid var(--line);border-radius:20px;padding:16px;box-shadow:var(--shadow)}
.al-book h2{margin:2px 0 2px;color:var(--ink);font-size:1.2rem}
.al-book .sub{margin:0 0 14px}
.al-ths{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:14px}
.al-th{--cf:var(--c);position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px;padding:14px 10px 12px;
  border-radius:18px;background:var(--card);border:2px solid var(--line);text-decoration:none;color:var(--ink);box-shadow:0 4px 0 var(--line);
  transition:transform .12s,box-shadow .12s,border-color .12s}
.al-th{--cn:color-mix(in srgb,var(--c) 74%,#000)}
[data-theme=dark] .al-th{--cf:color-mix(in srgb,var(--c) 58%,#fff);--cn:color-mix(in srgb,var(--c) 45%,#fff)}
.al-th:hover{transform:translateY(-3px);border-color:var(--cf)}
.al-th:active{transform:translateY(2px);box-shadow:0 1px 0 var(--line)}
.al-th:focus-visible,.al-tab:focus-visible,.al-st:focus-visible,.al-f button:focus-visible{outline:3px solid var(--brand);outline-offset:3px}
.al-ring{width:76px;height:76px;border-radius:50%;background:conic-gradient(var(--cf) calc(var(--p)*1%),var(--line) 0);display:flex;align-items:center;justify-content:center;flex:none}
.al-ring>span{width:60px;height:60px;border-radius:50%;background:var(--card);display:flex;align-items:center;justify-content:center;font-size:1.95rem}
.al-th-t{font-size:.98rem;line-height:1.2;overflow-wrap:anywhere}
.al-th-n{font-weight:900;color:var(--cn);font-size:1.02rem}
.al-th-n small{color:var(--muted);font-weight:700}
.al-th-gold{font-size:.8rem;font-weight:800;color:var(--gold-ink)}
[data-theme=dark] .al-th-gold{color:#FFCC00}
.al-th.full .al-th-gold{color:color-mix(in srgb,var(--gold-ink) 84%,#000)}
[data-theme=dark] .al-th.full .al-th-gold{color:#FFCC00}
.al-th.full{border-color:#FFCC00;background:color-mix(in srgb,#FFCC00 12%,var(--card));box-shadow:0 4px 0 #B38F00}
.al-th-stamp{position:absolute;left:8px;top:8px;font-size:1.5rem;transform:rotate(-12deg)}
.al-new-b{position:absolute;top:-11px;right:-6px;background:#23803f;color:#fff;white-space:nowrap;font-weight:900;font-size:.8rem;border-radius:99px;padding:3px 9px;box-shadow:0 3px 8px rgba(0,0,0,.22);animation:al-bob 1.6s ease-in-out 3}
@keyframes al-bob{0%,100%{translate:0 0}50%{translate:0 -4px}}
/* página de un tema */
.al-ph{--cf:var(--c);position:relative;display:flex;align-items:center;gap:16px;background:var(--c);color:#fff;border-radius:22px;padding:16px 18px;margin:6px 0 14px;box-shadow:0 6px 0 color-mix(in srgb,var(--c) 58%,#000)}
.al-ph-ic{font-size:2.6rem;width:74px;height:74px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex:none}
.al-ph-tx{flex:1;min-width:0}
.al-ph h1{margin:0;font-size:1.55rem;line-height:1.15;overflow-wrap:anywhere}
.al-ph-sub{font-size:1rem;margin-top:2px}
.al-ph-sub b{font-size:1.15rem}
.al-ph .al-bar{margin:8px 0 0}
.al-stamp{position:absolute;right:-6px;top:-16px;z-index:3;transform:rotate(11deg);background:#FFF5CC;color:#6b4f00;border:3px dashed #B38F00;border-radius:14px;padding:6px 12px;font-weight:900;font-size:.95rem;line-height:1.1;text-align:center;box-shadow:0 6px 14px rgba(0,0,0,.25);display:none}
.al-stamp.on{display:block}
.al-stamp.thump{animation:al-thump .7s cubic-bezier(.2,1.4,.4,1) both}
@keyframes al-thump{0%{transform:rotate(11deg) scale(3);opacity:0}60%{transform:rotate(11deg) scale(.9);opacity:1}100%{transform:rotate(11deg) scale(1)}}
.al-tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 12px}
.al-f{display:flex;flex-wrap:wrap;gap:6px}
.al-f button{min-height:44px;border:2px solid var(--line);background:var(--card);border-radius:99px;padding:6px 14px;font-weight:800;color:var(--muted)}
.al-f button.on{border-color:transparent;background:var(--brand-fill);color:#fff}
.al-f button small{font-weight:700}
.btn.al-pall{margin-left:auto;min-height:48px;background:#23803f;border:0;color:#fff;font-weight:900;font-size:1.02rem;padding:10px 18px;border-radius:99px;box-shadow:0 4px 0 #165a2b;animation:al-glow 1.8s ease-in-out 3}
.btn.al-pall:active{transform:translateY(3px);box-shadow:0 1px 0 #165a2b}
@keyframes al-glow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.12)}}
.al-tip{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:0 0 14px;color:var(--muted);font-weight:600}
.al-tip>span{flex:1 1 220px;min-width:0}
.al-tip .hero{font-size:44px}
.btn.al-more{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:50px;padding:10px 20px;border-radius:99px;border:0;background:#1f6fd1;color:#fff;
  font-weight:900;font-size:1.02rem;text-decoration:none;box-shadow:0 4px 0 #154f99;white-space:nowrap}
.btn.al-more:active{transform:translateY(3px);box-shadow:0 1px 0 #154f99}
.btn.al-more.map{background:#23803f;box-shadow:0 4px 0 #165a2b}
.al-bk{display:inline-flex!important;align-items:center;min-height:44px;padding-right:10px;font-weight:700}
.al-rv{display:inline-flex;align-items:center;min-height:44px;padding:4px 14px;margin:2px 0;border-radius:99px;border:2px solid var(--line);background:var(--card);
  color:var(--brand);font-weight:800;text-decoration:none;white-space:nowrap}
.al-rv:hover{border-color:var(--brand)}
.al-st,.al-th,.al-tab,.al-nb,.al-f button,.al-x,.al-nw{touch-action:manipulation}
.al-bigstamp{position:fixed;inset:0;z-index:998;display:flex;align-items:center;justify-content:center;pointer-events:none}
.al-bigstamp>div{display:flex;flex-direction:column;align-items:center;gap:4px;background:#FFF5CC;color:#5a4100;border:5px dashed #B38F00;border-radius:28px;
  padding:18px 28px;box-shadow:0 14px 40px rgba(0,0,0,.35);transform:rotate(-6deg);animation:al-bigin .7s cubic-bezier(.2,1.5,.4,1) both}
.al-bigstamp span{font-size:4.2rem;line-height:1}
.al-bigstamp b{font-size:1.9rem;font-weight:900;white-space:nowrap}
.al-bigstamp small{font-size:1.2rem;font-weight:900}
.al-bigstamp.out{opacity:0;transition:opacity .4s}
@keyframes al-bigin{0%{transform:rotate(-6deg) scale(3);opacity:0}60%{transform:rotate(-6deg) scale(.92);opacity:1}100%{transform:rotate(-6deg) scale(1)}}
.al-page{position:relative;background:var(--soft);border:2px solid var(--line);border-radius:22px;padding:18px 18px 22px 40px;
  background-image:radial-gradient(color-mix(in srgb,var(--line) 80%,transparent) 1.2px,transparent 1.6px);background-size:20px 20px}
.al-page::before{content:"";position:absolute;left:10px;top:18px;bottom:18px;width:16px;background:radial-gradient(circle at 8px 8px,var(--bg) 0 6px,var(--line) 6px 7.5px,transparent 8px) 0 0/16px 44px repeat-y}
.al-page.turn{animation:al-turnin .5s ease-out}
@keyframes al-turnin{from{opacity:0;transform:perspective(1400px) rotateY(10deg);transform-origin:left center}to{opacity:1;transform:none}}
.al-sec+.al-sec{margin-top:20px}
.al-cat{display:inline-block;background:var(--card);border:2px solid var(--line);border-radius:99px;padding:4px 14px;margin:0 0 14px;font-weight:900;font-size:.78rem;letter-spacing:.06em;color:var(--muted)}
.al-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(124px,1fr));gap:18px 16px}
.al-empty{text-align:center;color:var(--muted);font-weight:700;padding:26px 10px}
.al-st{position:relative;display:flex;flex-direction:column;align-items:stretch;padding:7px 7px 8px;border:0;border-radius:16px;background:#fff;color:#16202c;
  box-shadow:0 1px 0 rgba(15,30,50,.1),0 6px 14px rgba(15,30,50,.16);transform:rotate(var(--r,0deg));transition:transform .15s,box-shadow .15s;text-align:center;
  -webkit-tap-highlight-color:transparent;min-height:44px}
[data-theme=dark] .al-st{background:#e9eef5;box-shadow:0 1px 0 rgba(0,0,0,.3),0 8px 16px rgba(0,0,0,.45)}
.al-st:hover{transform:rotate(0deg) translateY(-3px) scale(1.05);z-index:2;box-shadow:0 2px 0 rgba(15,30,50,.1),0 12px 22px rgba(15,30,50,.22)}
.al-st:active{transform:rotate(0deg) scale(.96)}
.al-st.got::after{content:"";position:absolute;inset:0;border-radius:16px;background:linear-gradient(135deg,rgba(255,255,255,.5),transparent 38%);pointer-events:none}
.al-face{position:relative;display:flex;align-items:center;justify-content:center;aspect-ratio:1;border-radius:11px;background:#f1f5fa;overflow:hidden}
.al-face img{width:80%;height:80%;object-fit:contain;background:transparent!important}
.al-ini{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--pc);color:#fff;font-weight:900;font-size:2.6rem;text-shadow:0 2px 0 rgba(0,0,0,.2);border-radius:inherit}
.al-ini.l3{font-size:2rem}.al-ini.l4{font-size:1.6rem}
.al-num{position:absolute;left:5px;top:4px;z-index:1;font-size:.66rem;font-weight:900;color:rgba(22,32,44,.75);background:rgba(255,255,255,.8);border-radius:6px;padding:0 4px}
.al-lb{display:flex;flex-direction:column;justify-content:center;padding:6px 2px 0;line-height:1.15;min-height:2.7em}
.al-lb b{font-size:.92rem;overflow-wrap:anywhere}
.al-lb small{font-size:.72rem;color:#5b6778;overflow-wrap:anywhere}
.al-st.gold{background:linear-gradient(135deg,#FFF6D1 0%,#FFCC00 30%,#FFF5CC 50%,#E6B800 75%,#FFE066 100%)}
.al-st.gold .al-face{background:#fffaf0}
.al-st.gold .al-face::after{content:"";position:absolute;top:-10%;bottom:-10%;left:-70%;width:45%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.85),transparent);transform:skewX(-16deg);animation:al-sheen 3.6s ease-in-out 3;animation-delay:var(--d,0s);pointer-events:none}
@keyframes al-sheen{0%{transform:skewX(-16deg) translateX(0)}55%,100%{transform:skewX(-16deg) translateX(420%)}}
.al-st.gold .al-lb small{color:#5e4500}
.al-star{position:absolute;right:-9px;top:-11px;z-index:3;font-size:1.35rem;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))}
.al-st.lock{background:transparent;box-shadow:none;border:3px dashed color-mix(in srgb,var(--muted) 45%,transparent);transform:none;padding:5px 5px 6px;color:var(--muted)}
.al-st.lock .al-face{background:color-mix(in srgb,var(--line) 60%,transparent)}
/* silueta: el filtro SVG #al-sil vuelve transparente el fondo blanco de las imágenes opacas (así no sale un cuadrado gris) */
.al-st.lock .al-face img{filter:url(#al-sil);opacity:.16}
[data-theme=dark] .al-st.lock .al-face img{filter:url(#al-sil) invert(1);opacity:.15}
.al-st.lock .al-num{background:none;color:var(--muted)}
.al-q{position:absolute;font-size:2.3rem;font-weight:900;color:var(--muted)}
.al-st.lock .al-lb b{color:var(--miss-on,var(--muted));font-size:.8rem}
.al-st.lock:hover{transform:translateY(-2px);box-shadow:none;border-color:var(--brand)}
.al-pack{position:absolute;inset:-4px;z-index:4;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:#fff;
  background:linear-gradient(135deg,#1E6EF4,#008198);box-shadow:inset 0 0 0 3px rgba(255,255,255,.75),0 6px 14px rgba(15,30,50,.25);transform-origin:0 0;pointer-events:none}
.al-pack::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(45deg,rgba(255,255,255,.13) 0 9px,transparent 9px 18px)}
.al-pack::after{content:"";position:absolute;right:0;bottom:0;width:28px;height:28px;background:linear-gradient(135deg,transparent 50%,#fff 50%);border-top-left-radius:8px;box-shadow:-3px -3px 5px rgba(0,0,0,.18)}
.al-pack>*{position:relative}
.al-pack span{font-size:1.9rem;line-height:1}.al-pack b{font-size:1.05rem}.al-pack small{font-size:.76rem}
.al-st.new{animation:al-wiggle 2.6s ease-in-out 3;animation-delay:var(--d,0s)}
@keyframes al-wiggle{0%,78%,100%{transform:rotate(var(--r))}84%{transform:rotate(calc(var(--r) - 6deg)) scale(1.05)}90%{transform:rotate(calc(var(--r) + 6deg)) scale(1.05)}96%{transform:rotate(var(--r))}}
.al-st.peeling .al-pack{animation:al-peel .6s cubic-bezier(.55,0,.75,.2) forwards}
@keyframes al-peel{0%{transform:none}35%{transform:rotate(-7deg) translate(-3px,-8px)}100%{transform:rotate(-38deg) translate(-30%,-150%);opacity:0}}
.al-st.peeling{animation:al-stick .7s .18s both}
@keyframes al-stick{0%{transform:rotate(var(--r))}35%{transform:rotate(0deg) scale(1.2)}70%{transform:rotate(calc(var(--r) * -1)) scale(.95)}100%{transform:rotate(var(--r))}}
.al-rib{position:absolute;top:-12px;left:50%;z-index:3;transform:translateX(-50%) rotate(-4deg);background:#23803f;color:#fff;font-weight:900;font-size:.74rem;padding:2px 9px;border-radius:7px;white-space:nowrap;box-shadow:0 3px 6px rgba(0,0,0,.2);animation:al-pop .45s cubic-bezier(.2,1.6,.4,1) both}
.al-rib.g{background:#FFCC00;color:#3D2B00}
@keyframes al-pop{from{opacity:0;scale:.3}to{opacity:1;scale:1}}
.al-st.newgold{animation:al-goldup 1.2s .35s both}
@keyframes al-goldup{0%{transform:rotate(var(--r));box-shadow:0 0 0 0 rgba(242,201,76,.9)}40%{transform:rotate(0deg) scale(1.2);box-shadow:0 0 0 14px rgba(242,201,76,.35)}100%{transform:rotate(var(--r));box-shadow:0 0 0 22px rgba(242,201,76,0)}}
.al-pager{display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap;margin:16px 0 0}
.al-pager a{display:inline-flex;align-items:center;gap:8px;min-height:48px;max-width:100%;padding:8px 16px;border-radius:99px;border:2px solid var(--line);background:var(--card);text-decoration:none;font-weight:800;box-shadow:0 3px 0 var(--line)}
.al-pager a:hover{border-color:var(--brand)}
.al-pager a span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.al-pager .nx{margin-left:auto}
/* tarjeta grande */
.al-dlg{border:0;background:transparent;padding:16px 8px 14px;width:min(96vw,430px);max-width:none;max-height:100dvh;overflow:auto;box-shadow:none;color:var(--ink)}
.al-dlg::backdrop{background:rgba(0,0,0,.6)}   /* solo oscurece, sin desenfoque (no es vidrio); el texto blanco de debajo de la tarjeta pasa 4,5:1 */
.al-dw{position:relative}
.al-x{position:absolute;right:2px;top:-6px;z-index:6;display:grid;place-items:center;width:48px;height:48px;padding:0;border-radius:50%;border:0;background:var(--neu);color:var(--neu-ink);font-size:1.25rem;font-weight:700;box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 2px 8px rgba(0,0,0,.22)}
.al-x:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.al-card{perspective:1400px}
.al-card.opening{animation:al-open .62s cubic-bezier(.2,.8,.25,1.1) both}
@keyframes al-open{0%{transform:perspective(1000px) rotateY(-110deg) scale(.45);opacity:0}55%{opacity:1}75%{transform:perspective(1000px) rotateY(10deg) scale(1.02)}100%{transform:none}}
.al-card.sl-n{animation:al-sl-n .38s ease-out both}.al-card.sl-p{animation:al-sl-p .38s ease-out both}
@keyframes al-sl-n{from{transform:translateX(60px) rotate(4deg);opacity:0}to{transform:none;opacity:1}}
@keyframes al-sl-p{from{transform:translateX(-60px) rotate(-4deg);opacity:0}to{transform:none;opacity:1}}
.al-flip{display:grid;transform-style:preserve-3d;transition:transform .65s cubic-bezier(.3,.75,.25,1.1);cursor:pointer;touch-action:pan-y}
.al-flip.turned{transform:rotateY(180deg)}
.al-cf{grid-area:1/1;-webkit-backface-visibility:hidden;backface-visibility:hidden;background:var(--card);color:var(--ink);border:9px solid #fff;border-radius:26px;padding:16px 16px 18px;
  box-shadow:0 8px 0 rgba(0,0,0,.3);display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;min-width:0}
[data-theme=dark] .al-cf{border-color:#dfe6ef}
.al-card.gold .al-cf{border-color:transparent;background:linear-gradient(var(--card),var(--card)) padding-box,linear-gradient(135deg,#FFE066,#E6B800 30%,#FFF5CC 50%,#E6B800 75%,#FFE066) border-box}
.al-front{justify-content:center}
.al-back{transform:rotateY(180deg);align-items:stretch;text-align:left;justify-content:flex-start}
.al-cf-top{display:flex;justify-content:space-between;align-items:center;width:100%;min-height:28px;padding-right:44px}
.al-n2{font-weight:900;color:var(--muted);font-size:.9rem}
.al-gtag{background:#FFCC00;color:#3D2B00;border-radius:99px;padding:2px 10px;font-weight:900;font-size:.82rem}
.al-ntag{background:color-mix(in srgb,var(--brand) 14%,var(--card));color:var(--brand);border-radius:99px;padding:2px 10px;font-weight:800;font-size:.82rem}
.al-cf-img{position:relative;width:min(100%,230px);aspect-ratio:1.3;border-radius:20px;background:#f1f5fa;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none}
.al-cf-img img{max-width:80%;max-height:84%;object-fit:contain;background:transparent!important}
.al-cf-img .al-ini{font-size:4.6rem}.al-cf-img .al-ini.l3{font-size:3.6rem}.al-cf-img .al-ini.l4{font-size:2.8rem}
.al-card.gold .al-cf-img{background:#fffaf0}
.al-cf-img.lk img{filter:url(#al-sil);opacity:.18}
[data-theme=dark] .al-cf-img.lk{background:#26324a}
[data-theme=dark] .al-cf-img.lk img{filter:url(#al-sil) invert(1);opacity:.18}
.al-cf-img.lk .al-q{font-size:4.2rem}
.al-cf-w{font-size:2rem;font-weight:900;line-height:1.1;overflow-wrap:anywhere;margin-top:4px}
.al-cf .sayg{gap:10px}
.al-cf .say{width:54px;height:54px;font-size:1.45rem}
.al-cf .say.sm{width:44px;height:44px;font-size:1.1rem;margin-left:2px}
.al-cf-alt{font-size:.95rem;color:var(--muted)}.al-cf-alt b{color:var(--ink)}
.al-cf-es{font-size:1.1rem;font-weight:800;color:var(--muted)}
.al-cf-pr{font-size:1rem}.al-cf-pr b{font-style:italic}
.al-cf-ex{width:100%;margin-top:4px;padding:10px 12px;border-radius:14px;background:var(--soft);font-size:.98rem;text-align:left}
.al-cf-ex small{display:block;color:var(--muted);font-style:italic;margin-top:2px}
.al-bh{font-weight:900;font-size:1.15rem;text-align:center;margin:2px 0 6px}
.al-fi{display:flex;justify-content:space-between;gap:12px;padding:9px 2px;border-bottom:1px dashed var(--line);font-size:.98rem}
.al-fi span{color:var(--muted);font-weight:700}.al-fi b{text-align:right;overflow-wrap:anywhere}
.al-br{margin-top:10px;text-align:center}
.al-br .lbl{font-weight:900;margin-bottom:6px}
.al-dots{display:flex;gap:8px;justify-content:center}
.al-dots i{width:40px;height:40px;border-radius:50%;background:var(--line);display:flex;align-items:center;justify-content:center;font-style:normal;font-size:1.2rem;color:color-mix(in srgb,var(--muted) 70%,var(--ink))}
.al-dots i.on{background:#FFCC00;color:#3D2B00;box-shadow:0 3px 0 #B38F00}
.al-br p{margin:8px 0 0;color:var(--muted);font-weight:600}
.al-back .btn.lc{align-self:center;margin-top:10px;text-decoration:none}
.al-dnav{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px}
.al-nb{width:58px;height:58px;border-radius:50%;border:0;background:var(--card);color:var(--ink);font-size:1.9rem;font-weight:900;line-height:1;box-shadow:0 4px 0 rgba(0,0,0,.3);flex:none}
.al-nb:disabled{opacity:.35;cursor:default}
.al-nb:not(:disabled):active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.3)}
.btn.al-turn{min-height:54px;border-radius:99px;font-weight:900;font-size:1.02rem;padding:10px 20px;border:0;box-shadow:0 4px 0 rgba(0,0,0,.3)}
.al-dpos{text-align:center;color:#fff;font-weight:800;margin-top:10px;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.al-lk-t{margin:2px 0;font-size:1.05rem}
.al-lk-w{color:var(--muted);font-weight:700;min-height:1.4em}
.al-lk-a{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:8px}
.al-lk-a .btn{text-decoration:none;min-height:48px;display:inline-flex;align-items:center}
.btn.al-ls{background:#117c74;border-color:transparent;color:#fff;font-weight:800;text-decoration:none;padding:11px 18px;box-shadow:0 4px 0 #0b5a54}
.ba.al-ba-new{position:relative;animation:al-hglow 1.8s ease-in-out 3}
.ba.al-ba-new .al-bdot{position:absolute;top:-8px;right:-6px;background:#FFCC00;color:#3D2B00;font-size:.9rem;font-weight:900;border-radius:99px;min-width:30px;height:30px;padding:0 8px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,.25)}
@keyframes al-hglow{0%,100%{box-shadow:0 6px 0 rgba(0,0,0,.18),0 0 0 0 rgba(242,201,76,.75)}50%{box-shadow:0 6px 0 rgba(0,0,0,.18),0 0 0 9px rgba(242,201,76,0)}}
@media (max-width:560px){
  .al-cover{padding:16px 14px 16px 32px;border-radius:20px}.al-cover::before{width:16px}
  .al-cv-ic{font-size:2.6rem}.al-cover h1{font-size:1.35rem}.al-cover p{font-size:.92rem}
  .al-cv-big{font-size:1.05rem}.al-cv-big b{font-size:1.3rem}
  .al-tabs{padding:0 4px;gap:4px}.al-tab{font-size:.88rem;padding:6px 4px;min-height:58px}
  .al-book{padding:12px;border-radius:18px}
  .al-ths{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 10px}
  .al-th{padding:12px 6px 10px}.al-ring{width:66px;height:66px}.al-ring>span{width:52px;height:52px;font-size:1.65rem}
  .al-th-t{font-size:.9rem}
  .al-ph{gap:12px;padding:14px 14px}.al-ph-ic{width:56px;height:56px;font-size:2rem}.al-ph h1{font-size:1.25rem}.al-ph-sub{font-size:.92rem}
  .al-stamp{font-size:.8rem;padding:4px 9px;top:-18px}
  .al-page{padding:14px 10px 18px 28px;border-radius:18px}.al-page::before{left:5px;width:16px}
  .al-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 10px}
  .al-st{padding:5px 5px 6px;border-radius:13px}.al-st.got::after{border-radius:13px}
  .al-lb b{font-size:.8rem}.al-lb small{font-size:.66rem}.al-ini{font-size:2rem}.al-ini.l3{font-size:1.5rem}.al-ini.l4{font-size:1.2rem}
  .al-pack span{font-size:1.5rem}.al-pack b{font-size:.9rem}.al-pack small{font-size:.66rem}
  .al-q{font-size:1.9rem}
  .btn.al-pall{margin-left:0;width:100%}
  .btn.al-more{flex:1 1 100%}
  .al-bigstamp b{font-size:1.5rem}.al-bigstamp span{font-size:3.4rem}
  .al-cf-w{font-size:1.7rem}
  .al-pager a{flex:1 1 100%;justify-content:center}.al-pager .nx{margin-left:0}
}
@media (max-height:720px){.al-cf-img{width:min(100%,170px)}}
@media (prefers-reduced-motion: reduce){
  .al-st,.al-st *,.al-th,.al-new-b,.al-card,.al-flip,.al-stamp,.al-page,.btn.al-pall,.ba.al-ba-new,.al-rib,.al-bar i,.al-bigstamp,.al-bigstamp>div{animation:none!important;transition:none!important}
  .al-st.gold .al-face::after{display:none}
}`;
function css(){
  /* filtro SVG de silueta: color negro y opacidad según lo oscuro del píxel (el blanco del fondo desaparece) */
  if(document.body && !document.getElementById("al-svgf")){
    document.body.insertAdjacentHTML("beforeend", `<svg id="al-svgf" width="0" height="0" aria-hidden="true" focusable="false"
      style="position:absolute;width:0;height:0;overflow:hidden"><filter id="al-sil" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.126 -7.152 -0.722 0 10"/>
      <feComposite in2="SourceAlpha" operator="in"/></filter></svg>`);
  }
  if(document.getElementById("css-album") || !document.head) return;
  const s = document.createElement("style"); s.id = "css-album"; s.textContent = CSS; document.head.appendChild(s);
}
try{ css(); }catch(e){}

/* ---------- portada del álbum ---------- */
async function cover(nav){
  const idx = (await getIndex()).filter(d => d.langs.includes(lang));
  if(!alive(nav)) return;
  const U = syncUniq(idx), by = stats(), done = store.get(K.done(), {}) || {};
  const all = idx.map(d => {
    const o = by[d.id] || {got: 0, gold: 0, nw: 0}, t = U[d.id] != null ? U[d.id] : d.count;
    return {d, t, got: Math.min(o.got, t), gold: Math.min(o.gold, t), nw: o.nw, done: !!done[d.id]};
  });
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const N = sum(all, x => x.got), M = sum(all, x => x.t), G = sum(all, x => x.gold), NW = sum(all, x => x.nw), PD = all.filter(x => x.done).length;
  const groups = GROUPS.map(g => ({...g, list: all.filter(x => x.d.group === g.g)})).filter(g => g.list.length);
  let tab = store.get(K.tab, null);
  if(!groups.some(g => g.g === tab)){
    const best = groups.slice().sort((a, b) => sum(b.list, x => x.got) - sum(a.list, x => x.got))[0];
    tab = best && sum(best.list, x => x.got) ? best.g : (groups[0] || {}).g;
  }
  const pct = M ? Math.max(N ? 1 : 0, Math.round(100 * N / M)) : 0;
  const news = all.filter(x => x.nw).sort((a, b) => b.nw - a.nw).slice(0, 4);
  const card = x => {
    const p = x.t ? Math.round(100 * x.got / x.t) : 0, full = x.t && x.got >= x.t;
    return `<a class="al-th${full ? " full" : ""}" href="#/album/${esc(x.d.id)}" style="--c:${colorOf(x.d.id)};--p:${p}"
        aria-label="${esc(x.d.title)}: ${x.got} de ${x.t} pegatinas${x.nw ? `, ${x.nw} ${plural(x.nw, "nueva", "nuevas")}` : ""}">
      <span class="al-ring"><span>${emo(x.d)}</span></span>
      <b class="al-th-t">${esc(x.d.title)}</b>
      <span class="al-th-n">${x.got}<small>/${x.t}</small></span>
      ${x.gold ? `<span class="al-th-gold">⭐ ${x.gold} ${plural(x.gold, "dorada", "doradas")}</span>` : ""}
      ${x.nw ? `<span class="al-new-b">✨ ${x.nw} ${plural(x.nw, "nueva", "nuevas")}</span>` : ""}
      ${x.done ? `<span class="al-th-stamp" title="¡Página completa!">🏅</span>` : ""}</a>`;
  };
  $("#app").innerHTML = `<a class="back al-bk" href="#/">← Inicio</a>
    <section class="al-cover" aria-label="Mi álbum de pegatinas">
      <div class="al-deco" aria-hidden="true"><span>🐶</span><span>🚗</span><span>⚽</span><span>?</span></div>
      <div class="al-cv-top"><span class="al-cv-ic" aria-hidden="true">📒</span>
        <div><h1>Mi álbum de pegatinas</h1><p>Cada palabra que aprendes en ${esc(LANGS[lang].name)} es una pegatina.</p></div></div>
      <div class="al-cv-st">
        <div class="al-cv-big">Tienes <b>${fmt(N)}</b> ${plural(N, "pegatina", "pegatinas")} de <b>${fmt(M)}</b></div>
        <div class="al-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Pegatinas conseguidas"><i style="width:${pct}%"></i></div>
        <div class="al-chips"><span class="al-chip">⭐ ${fmt(G)} ${plural(G, "dorada", "doradas")}</span>
          ${NW ? `<span class="al-chip hot">✨ ${fmt(NW)} ${plural(NW, "nueva", "nuevas")}</span>` : ""}
          <span class="al-chip">🏅 ${PD} ${plural(PD, "página completa", "páginas completas")}</span></div>
      </div>
    </section>
    ${N ? "" : `<div class="al-hello">${heroHtml(80)}<div class="speech"><b>¡Tu álbum está vacío!</b>Aprende palabras en el Camino y aparecerán aquí como pegatinas.
      <div style="margin-top:10px"><a class="btn lc" href="#/mapa" style="--lc:#008932;text-decoration:none;display:inline-block">🗺️ Ir al Camino</a></div></div></div>`}
    ${news.length ? `<div class="al-news"><b>✨ ¡Tienes pegatinas nuevas para pegar!</b><div class="al-news-l">${news.map(x =>
      `<a class="al-nw" href="#/album/${esc(x.d.id)}">${emo(x.d)} ${esc(x.d.title)} <span>✨ ${x.nw}</span></a>`).join("")}</div></div>` : ""}
    ${N ? `<p class="sub" style="margin:0 0 12px">⭐ Las pegatinas <b>doradas</b> son palabras que ya no olvidas. ${dueList().length
      ? `<a class="al-rv" href="#/repaso">🔁 Repasa para que brillen</a>` : "¡Repasa cada día para que brillen!"}</p>` : ""}
    <div class="al-tabs" role="tablist" aria-label="Partes del álbum">${groups.map(g => {
      const got = sum(g.list, x => x.got), tot = sum(g.list, x => x.t), nw = sum(g.list, x => x.nw);
      return `<button class="al-tab${g.g === tab ? " on" : ""}" role="tab" aria-selected="${g.g === tab}" data-tab="${g.g}" style="--tc:${g.c}">
        ${g.tab}<small>${fmt(got)}/${fmt(tot)}</small>${nw ? `<span class="al-tdot">✨${nw}</span>` : ""}</button>`;
    }).join("")}</div>
    <div class="al-book">${groups.map(g => `<section class="al-grp" data-g="${g.g}" ${g.g === tab ? "" : "hidden"}>
      <h2>${g.h}</h2><p class="sub">${g.sub}</p><div class="al-ths">${g.list.map(card).join("")}</div></section>`).join("")}</div>`;
  const app = $("#app");
  app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => {
    const t = b.dataset.tab; store.set(K.tab, t); snd("tap");
    app.querySelectorAll("[data-tab]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); });
    app.querySelectorAll(".al-grp").forEach(s => s.hidden = s.dataset.g !== t);
  });
}

/* ---------- página de un tema ---------- */
function build(id, doc){
  const st = [], byK = {}, secs = [];
  let sec = {cat: null, items: []}; secs.push(sec);
  doc.rows.forEach((r, i) => {
    if(r.cat){ sec = {cat: r.cat, items: []}; secs.push(sec); return; }
    if(!r.es || !r.l || !r.l[lang]) return;
    const k = srsK(id, r);
    if(byK[k]){ byK[k].alts.push(r); byK[k].idx.push(i); return; }
    const s = {k, r, idx: [i], alts: [], n: st.length + 1};
    byK[k] = s; st.push(s); sec.items.push(s);
  });
  return {st, secs: secs.filter(s => s.items.length)};
}
function refresh(s, m, seen){
  const x = m[s.k];
  s.got = !!x; s.box = x ? (x.b || 0) : 0; s.reps = x ? (x.n || 0) : 0; s.due = x ? x.due : null;
  s.gold = s.got && s.box >= MASTER;
  s.isNew = s.got && !seen[s.k];
  s.newGold = s.gold && seen[s.k] === 1;
}
function stHtml(s){
  const d = s.r.l[lang], style = `--r:${tilt(s.k)}deg;--d:${delay(s.k)}s`;
  if(!s.got) return `<button class="al-st lock" data-k="${esc(s.k)}" style="${style}" aria-label="Pegatina secreta número ${s.n}">
      <span class="al-face">${s.r.img ? `<img src="${esc(s.r.img)}" alt="" loading="lazy" decoding="async">` : ""}<span class="al-q">?</span></span>
      <span class="al-lb"><b>Nº ${s.n}</b></span></button>`;
  return `<button class="al-st got${s.gold ? " gold" : ""}${s.isNew ? " new" : ""}${s.newGold ? " newgold" : ""}" data-k="${esc(s.k)}" style="${style}"
      aria-label="${s.isNew ? "Pegatina nueva: tócala para pegarla" : `${esc(d.word)}: ${esc(s.r.es)}${s.gold ? " (dorada)" : ""}`}">
      <span class="al-face">${face(s.r)}<span class="al-num">${s.n}</span></span>
      <span class="al-lb"><b>${esc(d.word)}</b><small>${esc(s.r.es)}</small></span>
      ${s.gold ? `<span class="al-star" aria-hidden="true">⭐</span>` : ""}
      ${s.newGold ? `<span class="al-rib g">¡Dorada!</span>` : ""}
      ${s.isNew ? `<span class="al-pack" aria-hidden="true"><span>✨</span><b>¡Nueva!</b><small>Tócala</small></span>` : ""}</button>`;
}
async function page(id, nav){
  const idx = await getIndex(), meta = idx.find(d => d.id === id);
  if(!alive(nav)) return;
  if(!meta || !meta.langs.includes(lang)){
    $("#app").innerHTML = `<a class="back al-bk" href="#/album">← Mi álbum</a><p class="empty">${meta ? `Esta página todavía no está lista en ${esc(LANGS[lang].name)}.` : "No encontramos esta página del álbum."}</p>`;
    return;
  }
  if(!CACHE[id]) $("#app").innerHTML = `<a class="back al-bk" href="#/album">← Mi álbum</a><p class="empty">📒 Abriendo la página…</p>`;
  const doc = await getDoc(id);
  if(!alive(nav)) return;
  const {st, secs} = build(id, doc);
  const U = store.get(K.uniq(), {}) || {};
  if(U[id] !== st.length){ U[id] = st.length; store.set(K.uniq(), U); }
  const m = srsAll(), seen = getSeen();
  st.forEach(s => refresh(s, m, seen));
  /* claves del repaso de este tema que ya no tienen pegatina: se apartan para que no cuenten como «nuevas» para siempre */
  const keys = new Set(st.map(s => s.k)), orph = store.get(K.orph(), {}) || {};
  const lost = Object.keys(m).filter(k => m[k] && (m[k].d || k.split("|")[0]) === id && !keys.has(k) && !orph[k]);
  if(lost.length){ lost.forEach(k => orph[k] = 1); store.set(K.orph(), orph); }
  const c = colorOf(id), done = (store.get(K.done(), {}) || {})[id];
  const grp = idx.filter(d => d.group === meta.group && d.langs.includes(lang)), gi = grp.findIndex(d => d.id === id);
  const prev = grp[gi - 1], next = grp[gi + 1];
  P = {id, meta, doc, st, secs, f: "all", nav, byK: new Map(st.map(s => [s.k, s]))};
  $("#app").innerHTML = `<a class="back al-bk" href="#/album">← Mi álbum</a>
    <section class="al-ph" style="--c:${c}">
      <span class="al-ph-ic" aria-hidden="true">${emo(meta)}</span>
      <div class="al-ph-tx"><h1>${esc(meta.title)}</h1>
        <div class="al-ph-sub" id="al-ph-sub"></div>
        <div class="al-bar"><i id="al-ph-bar" style="width:0%"></i></div></div>
      <div class="al-stamp${done ? " on" : ""}" id="al-stamp">🏅 ¡Página<br>completa!</div>
    </section>
    <div class="al-tools"><div class="al-f" id="al-f" role="group" aria-label="Qué pegatinas ver"></div>
      <button class="btn al-pall" id="al-pall" hidden></button></div>
    <div class="al-tip" id="al-tip"></div>
    <div class="al-page${RM() ? "" : " turn"}" id="al-page" data-f="all">
      ${secs.map((sc, i) => `<section class="al-sec" data-s="${i}">${sc.cat ? `<div class="al-cat">${esc(sc.cat)}</div>` : ""}
        <div class="al-grid">${sc.items.map(stHtml).join("")}</div></section>`).join("")}
      <div class="al-empty" id="al-empty" hidden></div>
    </div>
    ${prev || next ? `<nav class="al-pager" aria-label="Pasar página">
      ${prev ? `<a href="#/album/${esc(prev.id)}" aria-label="Página anterior: ${esc(prev.title)}">◀ <span>${emo(prev)} ${esc(prev.title)}</span></a>` : ""}
      ${next ? `<a class="nx" href="#/album/${esc(next.id)}" aria-label="Página siguiente: ${esc(next.title)}"><span>${emo(next)} ${esc(next.title)}</span> ▶</a>` : ""}</nav>` : ""}`;
  paintHead();
  const pg = $("#al-page");
  pg.addEventListener("click", e => {
    const b = e.target.closest(".al-st"); if(!b || !P) return;
    const s = P.byK.get(b.dataset.k); if(!s) return;
    if(s.isNew) return peel(s, b, false);
    /* «Pegar todas» en marcha: tocar un sobre que aún no se ha despegado lo despega ya */
    if(b.classList.contains("new")){ snd("pop"); peelVisual(s, b); return; }
    /* toques repetidos de un niño: no abrir la tarjeta mientras la pegatina se está despegando */
    if(b.classList.contains("peeling") || (s.peelT && now() - s.peelT < 700)) return;
    if(s.got) openCard(s);
    else openLocked(s);
  });
  $("#al-pall").onclick = peelAll;
  /* pegatinas que se han vuelto doradas desde la última visita */
  const ng = st.filter(s => s.newGold);
  if(ng.length){
    markSeen(ng);
    later(() => {
      if(!alive(nav)) return;
      snd("coin"); boomAt(pg.querySelector(".al-st.newgold"), {emoji: "⭐", n: 26});
      toast(`⭐ ¡${ng.length} ${plural(ng.length, "pegatina se ha vuelto dorada", "pegatinas se han vuelto doradas")}!`);
    }, 650);
  }
  /* botón «Conseguir más»: la primera lección del Camino que da pegatinas que faltan en esta página */
  const lockIdx = new Set(st.filter(s => !s.got).flatMap(s => s.idx));
  if(lockIdx.size) lessonFor(id, lockIdx).then(x => {
    if(!x || !alive(nav) || !P || P.nav !== nav) return;
    P.more = x; paintTip(counts());
  }).catch(() => {});
  checkComplete();
}
function counts(){
  const st = P.st, got = st.filter(s => s.got).length, gold = st.filter(s => s.gold).length, nw = st.filter(s => s.isNew).length;
  return {tot: st.length, got, gold, nw, lock: st.length - got};
}
function paintHead(){
  if(!P) return;
  const c = counts(), pct = c.tot ? Math.round(100 * c.got / c.tot) : 0;
  const sub = $("#al-ph-sub"), bar = $("#al-ph-bar"), f = $("#al-f"), pa = $("#al-pall");
  if(sub) sub.innerHTML = `<b>${c.got}</b> de <b>${c.tot}</b> ${plural(c.tot, "pegatina", "pegatinas")}${c.gold ? ` · ⭐ ${c.gold} ${plural(c.gold, "dorada", "doradas")}` : ""}`;
  if(bar) bar.style.width = (c.got ? Math.max(2, pct) : 0) + "%";
  if(f){
    const F = [["all", "Todas", c.tot], ["got", "✅ Tengo", c.got], ["lock", "❓ Me faltan", c.lock], ["gold", "⭐ Doradas", c.gold]];
    if(f.children.length !== F.length){
      f.innerHTML = F.map(([k, t, n]) => `<button data-f="${k}" class="${P.f === k ? "on" : ""}" aria-pressed="${P.f === k}">${t} <small>${n}</small></button>`).join("");
      f.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { snd("tap"); setFilter(b.dataset.f); });
    } else F.forEach(([k, , n], j) => {
      /* sin repintar los botones: el foco no se pierde al elegir un filtro */
      const b = f.children[j], on = P.f === k, sm = b.querySelector("small");
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); if(sm) sm.textContent = n;
    });
  }
  if(pa){ pa.hidden = !c.nw; pa.textContent = c.nw === 1 ? "✨ Pegar la nueva" : `✨ Pegar las ${c.nw} nuevas`; }
  paintTip(c);
  applyFilter();
}
function paintTip(c){
  const tip = $("#al-tip"); if(!tip || !P) return;
  const msg = c.nw ? `¡Tienes ${c.nw} ${plural(c.nw, "pegatina nueva", "pegatinas nuevas")}! Tócala${c.nw > 1 ? "s" : ""} para pegarla${c.nw > 1 ? "s" : ""}.`
    : !c.got ? "Aprende palabras de este tema en el Camino para llenar la página."
    : c.got >= c.tot ? (c.gold >= c.tot ? "¡Todas doradas! ¡Eres un campeón! 🏆" : "¡Página completa! Repasa para que todas sean doradas ⭐")
    : `Te ${plural(c.lock, "falta", "faltan")} ${c.lock}. Toca una pegatina para verla en grande.`;
  const x = !c.nw && c.lock && P.more;
  const more = !x ? "" : x.open
    ? `<a class="btn al-more" href="#/leccion/${esc(x.id)}">${c.got ? "🎯 ¡Conseguir más!" : "▶ ¡Empezar a llenarla!"}</a>`
    : `<a class="btn al-more map" href="#/mapa/${esc(x.lv)}">🗺️ Ir al nivel ${esc(x.lv)}</a>`;
  tip.innerHTML = `${heroHtml(44)}<span>${esc(msg)}</span>${more}`;
}
function setFilter(f){ if(!P) return; P.f = f; paintHead(); }
function applyFilter(){
  const pg = $("#al-page"); if(!pg || !P) return;
  const f = P.f, ok = s => f === "all" || (f === "got" ? s.got : f === "lock" ? !s.got : s.gold);
  pg.dataset.f = f;
  pg.querySelectorAll(".al-st").forEach(b => { const s = P.byK.get(b.dataset.k); b.hidden = !!s && !ok(s); });
  let any = false;
  pg.querySelectorAll(".al-sec").forEach(sec => {
    const v = P.secs[+sec.dataset.s].items.some(ok); sec.hidden = !v; any = any || v;
  });
  const e = $("#al-empty");
  if(e){
    e.hidden = any;
    e.innerHTML = f === "gold" ? "Todavía no hay pegatinas doradas aquí.<br>¡Repasa tus palabras para que brillen! ⭐"
      : f === "got" ? "Todavía no tienes pegatinas de este tema.<br>¡Apréndelas en el Camino! 🗺️" : "¡No te falta ninguna! 🎉";
  }
}
function markSeen(list){
  const seen = getSeen();
  for(const s of list) seen[s.k] = s.gold ? 2 : 1;
  store.set(K.seen(), seen);
}
/* despegar una pegatina nueva */
function peelVisual(s, el){
  if(!el || !el.isConnected || !el.classList.contains("new")) return;   /* ya despegada (p. ej. tocada durante «Pegar todas») */
  s.peelT = now();
  const d = s.r.l[lang];
  el.classList.remove("new"); el.classList.add("peeling");
  el.setAttribute("aria-label", `${d.word}: ${s.r.es}${s.gold ? " (dorada)" : ""}`);
  later(() => {
    if(!el.isConnected) return;
    const pk = el.querySelector(".al-pack"); if(pk) pk.remove();
    el.classList.remove("peeling");
    if(!el.querySelector(".al-rib")) el.insertAdjacentHTML("beforeend", `<span class="al-rib">¡Nueva!</span>`);
  }, RM() ? 0 : 900);
}
function peel(s, el, bulk){
  if(!s.isNew) return;
  s.isNew = false;
  if(!bulk){
    markSeen([s]); snd("pop"); speak(s.r.l[lang].word);
    /* como mucho un confeti cada 300 ms: si el niño toca muy deprisa no se amontonan lienzos */
    const t = now(); if(t - LAST_BOOM > 300){ LAST_BOOM = t; later(() => boomAt(el, {emoji: s.gold ? "⭐" : "✨", n: 16}), RM() ? 0 : 380); }
  }
  peelVisual(s, el);
  if(!bulk){ paintHead(); checkComplete(); }
}
function peelAll(){
  if(!P) return;
  const list = P.st.filter(s => s.isNew); if(!list.length) return;
  if(P.f !== "all" && P.f !== "got") setFilter("all");
  markSeen(list); snd("whoosh");
  const nav = P.nav, step = RM() ? 0 : 85, pg = $("#al-page");
  const els = new Map(pg ? [...pg.querySelectorAll(".al-st")].map(b => [b.dataset.k, b]) : []);
  list.forEach((s, i) => {
    s.isNew = false;
    const el = els.get(s.k);
    later(() => { if(alive(nav)){ peelVisual(s, el); if(i % 4 === 0) snd("pop"); } }, Math.min(i, 40) * step);
  });
  paintHead();
  later(() => {
    if(!alive(nav)) return;
    snd("gift"); boom({emoji: "✨", n: 50});
    toast(`📒 ¡${list.length} ${plural(list.length, "pegatina pegada", "pegatinas pegadas")}!`);
    checkComplete();
  }, Math.min(list.length, 40) * step + (RM() ? 0 : 700));
}
/* premio de página completa (una vez por idioma) */
function checkComplete(){
  if(!P || !P.st.length || P.st.some(s => !s.got || s.isNew)) return;
  const done = store.get(K.done(), {}) || {};
  if(done[P.id]) return;
  done[P.id] = dayKey(new Date()); store.set(K.done(), done);
  award(50, "¡Página completa!");
  bus.emit("album-complete", {id: P.id});
  const nav = P.nav;
  later(() => {
    if(!alive(nav)) return;
    const sp = $("#al-stamp");
    snd("fanfare"); boom({n: 140}); bigStamp();
    /* el sello grande se va y queda el pequeño en la cabecera */
    later(() => { if(!alive(nav)) return; if(sp){ sp.classList.add("on", "thump"); boomAt(sp, {emoji: "🏅", n: 26}); } }, RM() ? 1700 : 2100);
  }, RM() ? 100 : 500);
}
function bigStamp(){
  const d = document.createElement("div"); d.className = "al-bigstamp"; d.setAttribute("role", "status");
  d.innerHTML = `<div><span aria-hidden="true">🏅</span><b>¡Página completa!</b><small>+50 🪙</small></div>`;
  document.body.appendChild(d); OVER.add(d);
  later(() => { d.classList.add("out"); later(() => { d.remove(); OVER.delete(d); }, 450); }, RM() ? 1500 : 1900);
}

/* ---------- tarjeta grande ---------- */
function dlg(){
  if(DLG && DLG.isConnected) return DLG;
  css();
  DLG = document.createElement("dialog"); DLG.className = "al-dlg"; DLG.setAttribute("aria-label", "Pegatina");
  document.body.appendChild(DLG);
  DLG.addEventListener("click", e => {
    /* el clic que sigue justo a un deslizamiento no cuenta como toque */
    if(CARD && CARD.swiped){ const fresh = now() - CARD.swiped < 150; CARD.swiped = 0; if(fresh) return; }
    /* doble toque de un niño sobre la pegatina: el segundo toque no cierra ni gira la tarjeta recién abierta */
    if(now() - OPEN_T < 450 && e.detail !== 0) return;   /* (e.detail 0 = teclado: eso sí vale) */
    if(e.target === DLG){ DLG.close(); return; }
    const a = e.target.closest("[data-al]");
    if(a){ const k = a.dataset.al; if(k === "x") DLG.close(); else if(k === "prev") navCard(-1); else if(k === "next") navCard(1); else if(k === "turn") turn(); return; }
    if(e.target.closest("a")){ DLG.close(); return; }
    if(e.target.closest("button")) return;
    if(e.target.closest(".al-flip") && CARD && !CARD.lock) turn();
  });
  let x0 = null;
  DLG.addEventListener("pointerdown", e => { x0 = e.target.closest(".al-flip") ? e.clientX : null; });
  DLG.addEventListener("pointerup", e => {
    if(x0 == null || !CARD || CARD.lock) return;
    const dx = e.clientX - x0; x0 = null;
    if(Math.abs(dx) > 55){ CARD.swiped = now(); navCard(dx < 0 ? 1 : -1); }
  });
  DLG.addEventListener("pointercancel", () => { x0 = null; });
  DLG.addEventListener("close", () => { hush(); CARD = null; });
  return DLG;
}
/* flechas del teclado mientras la tarjeta está abierta (el foco puede quedar fuera al repintar) */
document.addEventListener("keydown", e => {
  if(!DLG || !DLG.open || !CARD || CARD.lock) return;
  if(e.key === "ArrowLeft"){ e.preventDefault(); navCard(-1); }
  else if(e.key === "ArrowRight"){ e.preventDefault(); navCard(1); }
});
function closeDlg(){ try{ if(DLG && DLG.open) DLG.close(); }catch(e){} CARD = null; }
function show(d){ try{ if(!d.open) d.showModal(); }catch(e){ d.setAttribute("open", ""); } }
function frontHtml(s){
  const r = s.r, d = r.l[lang], alts = s.alts.map(a => a.l[lang]).filter(a => a && a.word && a.word !== d.word);
  return `<div class="al-cf al-front">
    <div class="al-cf-top"><span class="al-n2">Nº ${s.n}</span>${s.gold ? `<span class="al-gtag">⭐ Dorada</span>` : `<span class="al-ntag">Toca para ver la ficha</span>`}</div>
    <div class="al-cf-img">${face(r)}</div>
    <div class="al-cf-w">${esc(d.word)}</div>
    <div>${sayBtn(d.word)}</div>
    ${alts.length ? `<div class="al-cf-alt">También: ${alts.map(a => `<b>${esc(a.word)}</b> ${sayBtn(a.word, 1)}`).join(" · ")}</div>` : ""}
    <div class="al-cf-es">🇪🇸 ${esc(r.es)}</div>
    ${d.pron || d.ipa ? `<div class="al-cf-pr">🗣️ Suena: <b>${esc(d.pron)}</b> <span class="ipa">${esc(d.ipa)}</span></div>` : ""}
    ${d.ex ? `<div class="al-cf-ex"><div>${esc(d.ex)} ${sayBtn(d.ex, 1)}</div>${d.ex_es ? `<small>${esc(d.ex_es)}</small>` : ""}</div>` : ""}
  </div>`;
}
function backHtml(s){
  const r = s.r, d = r.l[lang], left = Math.max(0, MASTER - s.box), lv = r.level && typeof LVS !== "undefined" && LVS[r.level];
  const forms = d.forms && d.forms !== "—" && d.forms !== d.word ? d.forms : "";
  const dots = Array.from({length: MASTER}, (_, j) => `<i class="${j < s.box ? "on" : ""}">${j < s.box ? "⭐" : "☆"}</i>`).join("");
  const due = !s.gold && s.due != null && s.due <= today();
  return `<div class="al-cf al-back">
    <div class="al-cf-top"><span class="al-n2">Nº ${s.n}</span></div>
    <div class="al-bh">📋 Ficha de la pegatina</div>
    <div class="al-fi"><span>Palabra</span><b>${esc(d.word)}</b></div>
    <div class="al-fi"><span>En español</span><b>${esc(r.es)}</b></div>
    <div class="al-fi"><span>Página</span><b>${emo(P ? P.meta : {id: "", title: ""})} ${esc(P ? P.meta.title : "")}</b></div>
    ${lv ? `<div class="al-fi"><span>Nivel</span><b>${esc(r.level)} · ${esc(lv.n)}</b></div>` : ""}
    ${r.pos && POS[r.pos] ? `<div class="al-fi"><span>Tipo</span><b>${esc(POS[r.pos])}</b></div>` : ""}
    ${forms ? `<div class="al-fi"><span>Otras formas</span><b>${esc(forms)}</b></div>` : ""}
    <div class="al-fi"><span>La has repasado</span><b>${s.reps} ${plural(s.reps, "vez", "veces")}</b></div>
    <div class="al-br"><div class="lbl">✨ Brillo</div><div class="al-dots" aria-label="Brillo ${Math.min(s.box, MASTER)} de ${MASTER}">${dots}</div>
      <p>${s.gold ? "¡Es dorada! Esta palabra ya no se te olvida." : `Acierta ${left} ${plural(left, "repaso", "repasos")} más y será dorada.`}</p></div>
    ${due ? `<a class="btn lc" href="#/repaso" style="--lc:#1E6EF4">🔁 Repasar ahora</a>` : ""}
  </div>`;
}
function openCard(s){
  if(!P) return;
  const list = P.st.filter(x => x.got && !x.isNew), i = list.indexOf(s);
  if(i < 0) return;
  CARD = {list, i, lock: false, turned: false, swiped: 0};
  const d = dlg(); snd("whoosh"); drawCard("opening");
  OPEN_T = now(); show(d);
}
function drawCard(anim){
  if(!CARD || !DLG) return;
  const s = CARD.list[CARD.i], n = CARD.list.length;
  CARD.turned = false;
  DLG.innerHTML = `<div class="al-dw">
    <button class="al-x" data-al="x" aria-label="Cerrar">${typeof ico === "function" ? ico("x", "bold", 22) : "✕"}</button>
    <div class="al-card${s.gold ? " gold" : ""}${anim && !RM() ? " " + anim : ""}"><div class="al-flip" id="al-flip">${frontHtml(s)}${backHtml(s)}</div></div>
    <div class="al-dnav">
      <button class="al-nb" data-al="prev" aria-label="Pegatina anterior" ${CARD.i > 0 ? "" : "disabled"}>‹</button>
      <button class="btn pri al-turn" data-al="turn">🔄 Dar la vuelta</button>
      <button class="al-nb" data-al="next" aria-label="Pegatina siguiente" ${CARD.i < n - 1 ? "" : "disabled"}>›</button>
    </div>
    <div class="al-dpos">${CARD.i + 1} de ${n} ${plural(n, "pegatina", "pegatinas")}</div></div>`;
  if(DLG.open){
    const want = DLG.querySelector(anim === "sl-n" ? '[data-al="next"]' : anim === "sl-p" ? '[data-al="prev"]' : '[data-al="turn"]');
    const fb = want && !want.disabled ? want : DLG.querySelector('[data-al="turn"]');
    try{ fb.focus({preventScroll: true}); }catch(e){}
  }
  const tok = CARD, ti = CARD.i;   /* con la flecha pulsada solo habla la última pegatina */
  setTimeout(() => { if(CARD === tok && CARD.i === ti && DLG && DLG.open) speak(s.r.l[lang].word, DLG.querySelector(".al-front .say")); }, anim === "opening" && !RM() ? 450 : 160);
}
function navCard(k){
  if(!CARD || CARD.lock) return;
  const j = CARD.i + k; if(j < 0 || j >= CARD.list.length) return;
  CARD.i = j; hush(); snd("tap"); drawCard(k > 0 ? "sl-n" : "sl-p");
}
function turn(){
  if(!CARD || CARD.lock || !DLG) return;
  const f = DLG.querySelector("#al-flip"); if(!f) return;
  CARD.turned = !CARD.turned; f.classList.toggle("turned", CARD.turned); snd("whoosh");
  const b = DLG.querySelector(".al-turn"); if(b) b.textContent = CARD.turned ? "🔄 Ver la pegatina" : "🔄 Dar la vuelta";
  const fr = DLG.querySelector(".al-front"), bk = DLG.querySelector(".al-back");
  if(fr) fr.setAttribute("aria-hidden", CARD.turned); if(bk) bk.setAttribute("aria-hidden", !CARD.turned);
}
/* pegatina bloqueada: dónde se aprende. Busca la primera lección del Camino con alguna de esas filas del tema;
   si hay una que ya se puede hacer (lección actual o anterior de su nivel) la prefiere. */
async function lessonFor(id, set){
  try{ await getMap(); }catch(e){ return null; }
  if(typeof MAP === "undefined" || !MAP) return null;
  const Pm = mapP(); let closed = null;
  for(const lv of Object.keys(LVS)){
    if(!MAP[lv]) continue;
    const ls = lvLessons(lv), k = ls.findIndex(l => l.w && l.w.some(([d, i]) => d === id && set.has(i)));
    if(k < 0) continue;
    const x = {lv, id: ls[k].id, num: k + 1, open: k <= lvCur(lv, Pm)};
    if(x.open) return x;
    if(!closed) closed = x;
  }
  return closed;
}
const findLesson = (id, rows) => lessonFor(id, new Set(rows));
function openLocked(s){
  if(!P) return;
  CARD = {lock: true}; snd("tap");
  const r = s.r, es = String(r.es || "").trim(), num = /^\d+$/.test(es);
  const first = ((es.match(/[\p{L}\p{N}]/u) || ["?"])[0]).toUpperCase();
  const d = dlg();
  d.innerHTML = `<div class="al-dw">
    <button class="al-x" data-al="x" aria-label="Cerrar">${typeof ico === "function" ? ico("x", "bold", 22) : "✕"}</button>
    <div class="al-card${RM() ? "" : " opening"}"><div class="al-cf al-front">
      <div class="al-cf-top"><span class="al-n2">Nº ${s.n}</span></div>
      <div class="al-cf-img lk">${r.img ? `<img src="${esc(r.img)}" alt="">` : ""}<span class="al-q">?</span></div>
      <div class="al-cf-w">¡Pegatina secreta! 🔒</div>
      <p class="al-lk-t">Aprende esta palabra en el <b>Camino</b> para conseguirla.</p>
      <div class="al-cf-es">🔎 Pista: ${num ? "es un número" : `en español empieza por «${esc(first)}»`}</div>
      <div class="al-lk-w" id="al-lk-w">Buscando en el Camino…</div>
      <div class="al-lk-a" id="al-lk-a"><a class="btn lc" href="#/mapa" style="--lc:#008932">🗺️ Ir al Camino</a></div>
    </div></div></div>`;
  OPEN_T = now(); show(d);
  const tok = CARD;
  findLesson(P.id, s.idx).then(x => {
    if(CARD !== tok || !DLG || !DLG.open) return;
    const w = DLG.querySelector("#al-lk-w"), a = DLG.querySelector("#al-lk-a"); if(!w || !a) return;
    if(!x){ w.textContent = "Sigue aprendiendo en el Camino y la encontrarás."; return; }
    if(x.open){
      w.textContent = `Está en el nivel ${x.lv}, lección ${x.num}. ¡Ya puedes aprenderla!`;
      a.innerHTML = `<a class="btn lc" href="#/leccion/${esc(x.id)}" style="--lc:#008932">▶ Aprenderla ahora</a><a class="btn" href="#/mapa/${esc(x.lv)}">🗺️ Ver el Camino</a>`;
    } else {
      w.textContent = `Está más adelante, en el nivel ${x.lv} (lección ${x.num}). ¡Sigue el Camino!`;
      a.innerHTML = `<a class="btn lc" href="#/mapa/${esc(x.lv)}" style="--lc:#008932">🗺️ Ir al nivel ${esc(x.lv)}</a>`;
    }
  }).catch(() => {});
}

/* ---------- conexión con la app ---------- */
ROUTES["album"] = async parts => {
  css(); stopAll();
  const nav = ++NAV, raw = parts && parts[0] ? String(parts[0]) : "";
  let id = raw; try{ id = decodeURIComponent(raw); }catch(e){}   /* «#/album/%E2» → página no encontrada, sin error */
  if(id) await page(id, nav); else await cover(nav);
};
/* atrás del navegador con la tarjeta abierta: se cierra en el acto, sin esperar a que se pinte la ruta nueva */
window.addEventListener("hashchange", () => { if(DLG && DLG.open) closeDlg(); });
HOME_ACTS.push({href: "#/album", e: "📒", t: "Álbum", color: "#008198",
  get sub(){ try{ const n = newTotal(); return n ? `✨ ${n} ${plural(n, "nueva", "nuevas")}` : "Colecciona pegatinas"; }catch(e){ return "Colecciona pegatinas"; } }});

/* punto azul en la pestaña «Jugar» y en su segmento «Álbum» (tabBadge de index.html) si hay pegatinas nuevas sin ver */
function tabDot(n){
  try{ if(typeof tabBadge === "function") tabBadge("jugar", n > 0, n > 0 ? `${n} ${plural(n, "pegatina nueva", "pegatinas nuevas")}` : "", "#/album"); }catch(e){}
}
function decorateHome(){
  let n = 0; try{ n = newTotal(); }catch(e){}
  tabDot(n);
  const a = document.querySelector('a.ba[href="#/album"]'); if(!a) return;
  a.classList.toggle("al-ba-new", n > 0);
  const old = a.querySelector(".al-bdot"); if(old) old.remove();
  if(n > 0) a.insertAdjacentHTML("beforeend", `<span class="al-bdot" aria-hidden="true">${n > 99 ? "99+" : n}</span>`);
}
["boot", "lang", "lesson-done", "review-done"].forEach(ev => bus.on(ev, () => setTimeout(() => { try{ decorateHome(); }catch(e){} }, 0)));
bus.on("route", d => {
  const h = String((d && d.h) || "");
  if(!h.startsWith("album")){ NAV++; stopAll(); }
  try{ css(); decorateHome(); }catch(e){ console.error(e); }
});
/* al terminar una lección: enlace a las pegatinas nuevas */
bus.on("lesson-done", d => {
  const words = (d && d.words) || [];
  setTimeout(() => {
    try{
      const host = document.querySelector(".ls-end .ctrl"); if(!host || host.querySelector(".al-ls")) return;
      const m = srsAll(), seen = getSeen(), cnt = {};
      for(const w of words){ const k = w.doc + "|" + w.es; if(m[k] && !seen[k]) cnt[w.doc] = (cnt[w.doc] || new Set()).add(k); }
      const docs = Object.entries(cnt).sort((a, b) => b[1].size - a[1].size); if(!docs.length) return;
      const n = docs.reduce((s, [, v]) => s + v.size, 0);
      host.insertAdjacentHTML("beforeend", `<a class="btn al-ls" href="#/album/${esc(docs[0][0])}">📒 ¡${n} ${plural(n, "pegatina nueva", "pegatinas nuevas")}!</a>`);
    }catch(e){ console.error(e); }
  }, 60);
});
/* al terminar un repaso: aviso de pegatinas doradas nuevas */
bus.on("review-done", () => {
  setTimeout(() => {
    try{
      const host = document.querySelector(".pr-end .pr-row"); if(!host || host.querySelector(".al-ls")) return;
      const m = srsAll(), seen = getSeen();
      const n = Object.entries(m).filter(([k, x]) => x && (x.b || 0) >= MASTER && seen[k] !== 2).length;
      if(n) host.insertAdjacentHTML("beforeend", `<a class="btn al-ls" href="#/album">⭐ ¡${n} ${plural(n, "pegatina dorada nueva", "pegatinas doradas nuevas")}!</a>`);
    }catch(e){ console.error(e); }
  }, 60);
});
})();
