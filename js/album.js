/* Módulo album: álbum de pegatinas (Jugar › Álbum).
   - Cada palabra del vocabulario es una pegatina. Se consigue cuando la palabra está en el repaso del idioma
     actual (srsAll() tiene "doc|es") y es DORADA cuando está dominada (caja b >= MASTER).
   - #/album (portada): un anillo con lo conseguido (verde azulado; la parte dorada, en oro) y una línea «91 de 6327
     pegatinas»; los temas con pegatinas nuevas sin pegar (filas); un control segmentado con las partes del álbum
     (Temas · Las 3000 · Expertos, con el nº de nuevas en su aviso) y las miniaturas de esa parte sobre fondo neutro,
     cada una con su anillo de progreso. La parte elegida se guarda en store "album:tab".
   - #/album/<docId> (página de un tema): «‹ Álbum» y la pastilla «Tema: … ▾», que abre una hoja con los temas de cada
     parte (control segmentado arriba) para saltar a otro; la cabecera con su anillo, «9 de 26 pegatinas» y el sello
     «¡Página completa!»; filtros (Todas · Tengo · Faltan · Doradas) y la página de pegatinas (#al-page).
     Deslizar #al-page a la izquierda o a la derecha pasa al tema siguiente o anterior de la misma parte (G.swipe: más
     de 60 px y más del doble que en vertical; nunca con un diálogo abierto): la página sigue al dedo y la nueva entra por
     el otro lado. Navega con location.hash (lo controla NAV). La pastilla del tema es la alternativa sin gesto.
   - Las pegatinas nuevas desde la última visita llegan en un sobre «¡Nueva!»: se despegan al tocarlas (o todas a la vez
     con «Pegar las N nuevas»). Tocar una conseguida abre una tarjeta grande que gira (palabra, 🔊🐢, pronunciación, la
     IPA solo si un mayor la activó, ejemplo y ficha con su brillo). Tocar una bloqueada dice en qué lección está.
   - Página completa (todas conseguidas y pegadas): premio una vez por idioma → award(50) + sello (checkComplete).
   - Punto azul en la pestaña «Jugar» y en su segmento «Álbum» mientras haya pegatinas nuevas sin ver; al terminar una
     lección o un repaso, un enlace a las pegatinas nuevas o doradas.
   Guarda: store "album:seen:<lang>" {clave: 1 vista | 2 vista ya dorada} · "album:done:<lang>" {docId: fecha}
           "album:uniq:<lang>" {docId: nº de pegatinas distintas} · "album:orph:<lang>" · "album:tab" (parte de la portada).
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
const IC = (n, s = "bold", z = 20, c = "") => { try{ return typeof ico === "function" ? ico(n, s, z, c) : ""; }catch(e){ return ""; } };
const haptic = k => { try{ if(window.G && typeof window.G.haptic === "function") window.G.haptic(k || "selection"); }catch(e){} };
const ipaOn = () => { try{ return !!(window.vocabUI && typeof vocabUI.get === "function" && (vocabUI.get() || {}).ipa); }catch(e){ return false; } };
function hash(s){ let h = 2166136261 >>> 0; for(const c of String(s)){ h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
/* color de las iniciales de las pegatinas sin dibujo: azul marino, azul, verde azulado, verde y gris (texto blanco legible) */
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
  {g: "temas",    tab: "Temas"},
  {g: "3000",     tab: "Las 3000"},
  {g: "avanzado", tab: "Expertos"},
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

/* ---------- ciclo de vida: temporizadores, gestos, hoja y diálogo se limpian al salir ---------- */
let NAV = 0, P = null, DLG = null, CARD = null, OPEN_T = 0, LAST_BOOM = 0, TS = null;
let SLIDE = null;   /* "next" | "prev": la página que se pinta ahora entra por ese lado (tras deslizar o elegir en la hoja) */
const TIMERS = new Set(), OVER = new Set();
let GEST = [];
const clearGest = () => { GEST.forEach(off => { try{ off(); }catch(e){} }); GEST = []; };
function later(fn, ms){
  const t = setTimeout(() => { TIMERS.delete(t); try{ fn(); }catch(e){ console.error(e); } }, ms);
  TIMERS.add(t); return t;
}
function stopAll(){
  TIMERS.forEach(clearTimeout); TIMERS.clear();
  OVER.forEach(e => e.remove()); OVER.clear();
  clearGest(); closeTopics(true); closeDlg(); P = null;
}
const onAlbum = () => /^#\/?album(\/|$)/.test(location.hash);
const alive = nav => nav === NAV && onAlbum();
const anyDialog = () => !!document.querySelector("dialog[open]");

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
/* cada tema del idioma con lo conseguido: {d, t, got, gold, nw, done} (para la portada y la hoja de temas) */
async function topics(){
  const idx = (await getIndex()).filter(d => d.langs.includes(lang));
  const U = syncUniq(idx), by = stats(), done = store.get(K.done(), {}) || {};
  return idx.map(d => {
    const o = by[d.id] || {got: 0, gold: 0, nw: 0}, t = U[d.id] != null ? U[d.id] : d.count;
    return {d, t, got: Math.min(o.got, t), gold: Math.min(o.gold, t), nw: o.nw, done: !!done[d.id]};
  });
}
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const groupsOf = all => GROUPS.map(g => ({...g, list: all.filter(x => x.d.group === g.g)})).filter(g => g.list.length);

/* ---------- caras de las pegatinas y anillos ---------- */
function ini(r){
  const es = String(r.es || "?").trim();
  const t = /^\d{1,4}$/.test(es) ? es : ((es.match(/[\p{L}\p{N}]/u) || ["?"])[0]).toUpperCase();
  return `<span class="al-ini${t.length > 2 ? " l" + Math.min(4, t.length) : ""}" style="--pc:${colorOf(es)}">${esc(t)}</span>`;
}
const face = r => r.img ? `<img src="${esc(r.img)}" alt="" loading="lazy" decoding="async">` : ini(r);
/* anillo de progreso (svg): p = conseguidas (verde azulado, o todo oro si está completo), g = doradas (oro, encima) */
const arc = p => (p > 0 ? Math.max(3, Math.min(100, p * 100)) : 0).toFixed(1);
/* la parte dorada, en proporción a lo conseguido (con muy pocas, el arco mínimo de 3 no se tapa entero de oro) */
const garc = (p, g) => (g > 0 && p > 0 ? Math.max(1, arc(p) * Math.min(1, g / p)) : 0).toFixed(1);
function ringSvg(p, g = 0, id = ""){
  return `<svg class="al-rs" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><circle class="al-rb" cx="18" cy="18" r="15.5" pathLength="100"/>
    <circle class="al-rf${p > 0 ? "" : " zero"}"${id ? ` id="${id}"` : ""} cx="18" cy="18" r="15.5" pathLength="100" stroke-dasharray="${arc(p)} 100"/>
    <circle class="al-rg${g > 0 ? "" : " zero"}"${id ? ` id="${id}-g"` : ""} cx="18" cy="18" r="15.5" pathLength="100" stroke-dasharray="${garc(p, g)} 100"/></svg>`;
}
const ringHtml = (x, cls = "") => `<span class="al-ring${cls}">${ringSvg(x.t ? x.got / x.t : 0, x.t ? x.gold / x.t : 0)}<span class="al-ring-e" aria-hidden="true">${emo(x.d)}</span></span>`;

/* ---------- estilos ---------- */
const CSS = `
.al-st[hidden],.al-sec[hidden],.al-ths[hidden],.al-empty[hidden],.al-pall[hidden]{display:none!important}
.al{display:flex;flex-direction:column;gap:12px;max-width:960px}
.al .card{padding:16px}
.al .seg{margin:0}
/* anillos */
.al-ring{position:relative;flex:none;display:grid;place-items:center;width:64px;height:64px}
.al-rs{position:absolute;inset:0;width:100%;height:100%;rotate:-90deg}
.al-rs circle{fill:none;stroke-width:3.5;stroke-linecap:round}
.al-rb{stroke:var(--fill)}
.al-rf{stroke:var(--teal)}
.al-rg{stroke:var(--gold)}
.al-rf.zero,.al-rg.zero{stroke:none}
.al-full .al-rf,.al-th.full .al-rf{stroke:var(--gold)}
.al-ring-e{position:relative;font-size:28px;line-height:1}
/* portada */
.al-sum{display:flex;align-items:center;gap:14px}
.al-sum .al-ring{width:68px;height:68px}
.al-sum-t{flex:1;min-width:0;margin:0;font:400 var(--fs-sub)/1.3 var(--f-text);color:var(--label2)}
.al-sum-t b{font:700 var(--fs-t2)/1 var(--f-round);color:var(--label)}
.al-sum .glass-btn{flex:none}
.al-news .st-h{margin-top:4px}
.al-nw{color:var(--label);font:400 var(--fs-sub)/1.25 var(--f-text);-webkit-tap-highlight-color:transparent}
.al-nw-e,.al-tp-e{flex:none;width:32px;text-align:center;font-size:24px;line-height:1}
.al-cnt{flex:none;min-width:24px;height:24px;padding:0 8px;box-sizing:border-box;border-radius:12px;background:var(--brand-fill);color:#fff;
  font:700 var(--fs-min)/24px var(--f-text);font-variant-numeric:tabular-nums;text-align:center;white-space:nowrap}
.al-chev{flex:none;color:var(--label3)}
.al-ths{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.al-th{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;padding:18px 10px 14px;text-align:center;text-decoration:none;
  color:var(--label);-webkit-tap-highlight-color:transparent}
.al-th .al-ring{width:72px;height:72px;margin:0 0 6px}
.al-th .al-ring-e{font-size:32px}
.al-th-t{max-width:100%;font:600 var(--fs-sub)/1.2 var(--f-text);overflow-wrap:anywhere}
.al-th-n{display:inline-flex;align-items:center;flex-wrap:wrap;justify-content:center;gap:2px 8px;font:400 var(--fs-note)/1.25 var(--f-text);color:var(--label2);font-variant-numeric:tabular-nums}
.al-gd{display:inline-flex;align-items:center;gap:2px;color:var(--gold-ink);font-weight:600}
.al-gd .ico{color:var(--gold-deep)}
:root[data-theme=dark] .al-gd .ico{color:var(--gold)}
.al-th .al-cnt{position:absolute;top:8px;right:8px}
.al-th-stamp{position:absolute;top:8px;left:8px;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--gold-soft);color:var(--gold-ink)}
.al-th:focus-visible,.al-st:focus-visible,.al-nw:focus-visible,.al-tp-r:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
/* página de un tema */
.al-bar{display:flex;align-items:center;gap:8px;min-width:0}
.al-bar .glass-btn{flex:none}
.al-bar .al-tpill{flex:0 1 auto;min-width:0;max-width:100%;gap:6px;font-weight:400}
.al-tpill b{min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.al-tpill .ico{flex:none;color:var(--label2)}
.al-ph{position:relative;display:flex;align-items:center;gap:14px}
.al-ph .al-ring{width:72px;height:72px}
.al-ph .al-ring-e{font-size:32px}
.al-ph-tx{flex:1;min-width:0}
.al-ph:has(.al-stamp.on) .al-ph-h{padding-right:64px}
.al-ph-h{margin:0;font:700 var(--fs-t2)/1.15 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.al-ph-sub{margin:4px 0 0;font:400 var(--fs-sub)/1.3 var(--f-text);color:var(--label2)}
.al-ph-sub b{color:var(--label);font-weight:600}
.al-stamp{position:absolute;right:10px;top:-12px;z-index:3;transform:rotate(9deg);background:#FFF5CC;color:#5a4100;border:2px dashed #B38F00;border-radius:12px;
  padding:4px 10px;font:800 var(--fs-min)/1.15 var(--f-text);text-align:center;box-shadow:0 4px 10px rgba(0,0,0,.18);display:none}
.al-stamp.on{display:block}
.al-stamp.thump{animation:al-thump .7s cubic-bezier(.2,1.4,.4,1) both}
@keyframes al-thump{0%{transform:rotate(9deg) scale(3);opacity:0}60%{transform:rotate(9deg) scale(.9);opacity:1}100%{transform:rotate(9deg) scale(1)}}
.al-f .seg-i{flex:1 1 auto;min-width:0;padding:0 4px;gap:4px}
.al-f .seg-i small{font-weight:400;color:var(--label2);font-variant-numeric:tabular-nums}
:root[data-theme=dark] .al-f .seg-i[aria-selected=true] small{color:#fff}
@media (min-width:700px){.al .al-pall{max-width:440px}}
.al-tip{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;margin:0 4px;font:400 var(--fs-note)/1.35 var(--f-text);color:var(--label2)}
.al-tip>span{flex:1 1 200px;min-width:0}
.al-page{position:relative;padding:16px 12px 20px;border-radius:var(--r-card);background:var(--card)}
.al-page.turn{animation:al-turnin .45s ease-out}
.al-page.turn.in-next{animation:al-in-n .34s cubic-bezier(.2,.9,.25,1)}
.al-page.turn.in-prev{animation:al-in-p .34s cubic-bezier(.2,.9,.25,1)}
@keyframes al-turnin{from{opacity:0;transform:perspective(1400px) rotateY(8deg);transform-origin:left center}to{opacity:1;transform:none}}
@keyframes al-in-n{from{opacity:0;transform:translateX(64px)}to{opacity:1;transform:none}}
@keyframes al-in-p{from{opacity:0;transform:translateX(-64px)}to{opacity:1;transform:none}}
.al-sec+.al-sec{margin-top:22px}
.al-cat{margin:0 4px 12px;font:600 var(--fs-min)/1.2 var(--f-text);letter-spacing:.04em;text-transform:uppercase;color:var(--label2)}
.al-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(124px,1fr));gap:18px 16px}
.al-empty{text-align:center;color:var(--label2);font:600 var(--fs-sub)/1.4 var(--f-text);padding:26px 10px}
.al-st{position:relative;display:flex;flex-direction:column;align-items:stretch;padding:7px 7px 8px;border:0;border-radius:16px;background:#fff;color:#16202c;
  box-shadow:0 1px 0 rgba(15,30,50,.1),0 6px 14px rgba(15,30,50,.16);transform:rotate(var(--r,0deg));transition:transform .15s,box-shadow .15s;text-align:center;
  -webkit-tap-highlight-color:transparent;min-height:44px;touch-action:pan-y;cursor:pointer}
[data-theme=dark] .al-st{background:#e9eef5;box-shadow:0 1px 0 rgba(0,0,0,.3),0 8px 16px rgba(0,0,0,.45)}
@media (hover:hover){.al-st:hover{transform:rotate(0deg) translateY(-3px) scale(1.05);z-index:2;box-shadow:0 2px 0 rgba(15,30,50,.1),0 12px 22px rgba(15,30,50,.22)}}
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
/* un solo brillo al entrar (sin bucle) */
.al-st.gold .al-face::after{content:"";position:absolute;top:-10%;bottom:-10%;left:-70%;width:45%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.85),transparent);transform:skewX(-16deg);animation:al-sheen 2.4s ease-in-out 1 both;animation-delay:var(--d,0s);pointer-events:none}
@keyframes al-sheen{0%{transform:skewX(-16deg) translateX(0)}55%,100%{transform:skewX(-16deg) translateX(420%)}}
.al-st.gold .al-lb small{color:#5e4500}
.al-star{position:absolute;right:-9px;top:-11px;z-index:3;font-size:1.35rem;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))}
.al-st.lock{background:transparent;box-shadow:none;border:2px dashed var(--fill);transform:none;padding:5px 5px 6px;color:var(--label2)}
.al-st.lock .al-face{background:var(--fill2)}
/* silueta: el filtro SVG #al-sil vuelve transparente el fondo blanco de las imágenes opacas (así no sale un cuadrado gris) */
.al-st.lock .al-face img{filter:url(#al-sil);opacity:.16}
[data-theme=dark] .al-st.lock .al-face img{filter:url(#al-sil) invert(1);opacity:.15}
.al-st.lock .al-num{background:none;color:var(--label2)}
.al-q{position:absolute;font-size:2.3rem;font-weight:900;color:var(--label2)}
.al-st.lock .al-lb b{color:var(--label2);font-size:.8rem}
@media (hover:hover){.al-st.lock:hover{transform:translateY(-2px);box-shadow:none;border-color:var(--brand-tint)}}
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
.al-bigstamp{position:fixed;inset:0;z-index:998;display:flex;align-items:center;justify-content:center;pointer-events:none}
.al-bigstamp>div{display:flex;flex-direction:column;align-items:center;gap:4px;background:#FFF5CC;color:#5a4100;border:5px dashed #B38F00;border-radius:28px;
  padding:18px 28px;box-shadow:0 14px 40px rgba(0,0,0,.35);transform:rotate(-6deg);animation:al-bigin .7s cubic-bezier(.2,1.5,.4,1) both}
.al-bigstamp span{font-size:4.2rem;line-height:1}
.al-bigstamp b{font-size:1.9rem;font-weight:900;white-space:nowrap}
.al-bigstamp small{font-size:1.2rem;font-weight:900}
.al-bigstamp.out{opacity:0;transition:opacity .4s}
@keyframes al-bigin{0%{transform:rotate(-6deg) scale(3);opacity:0}60%{transform:rotate(-6deg) scale(.92);opacity:1}100%{transform:rotate(-6deg) scale(1)}}
/* hoja de temas */
dialog.al-tp-d{max-width:560px}
.al-tp-d .seg{margin:0 0 12px;max-width:none}
.al-tp-r{color:var(--label);font:400 var(--fs-sub)/1.25 var(--f-text);text-align:left;cursor:pointer}
.al-tp-r .st-l small{font-variant-numeric:tabular-nums}
.al-tp-ok{flex:none;color:var(--brand-tint)}
/* tarjeta grande */
.al-dlg{border:0;background:transparent;padding:16px 8px 14px;width:min(96vw,430px);max-width:none;max-height:100dvh;overflow:auto;box-shadow:none;color:var(--label)}
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
.al-cf{grid-area:1/1;-webkit-backface-visibility:hidden;backface-visibility:hidden;background:var(--card);color:var(--label);border:9px solid #fff;border-radius:26px;padding:16px 16px 18px;
  box-shadow:0 8px 0 rgba(0,0,0,.3);display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;min-width:0}
[data-theme=dark] .al-cf{border-color:#dfe6ef}
.al-card.gold .al-cf{border-color:transparent;background:linear-gradient(var(--card),var(--card)) padding-box,linear-gradient(135deg,#FFE066,#E6B800 30%,#FFF5CC 50%,#E6B800 75%,#FFE066) border-box}
.al-front{justify-content:center}
.al-back{transform:rotateY(180deg);align-items:stretch;text-align:left;justify-content:flex-start}
.al-cf-top{display:flex;justify-content:space-between;align-items:center;width:100%;min-height:28px;padding-right:44px}
.al-n2{font-weight:800;color:var(--label2);font-size:.9rem}
.al-gtag{background:#FFCC00;color:#3D2B00;border-radius:99px;padding:2px 10px;font-weight:800;font-size:.82rem}
.al-ntag{background:var(--brand-soft);color:var(--brand-ink);border-radius:99px;padding:2px 10px;font-weight:700;font-size:.82rem}
.al-cf-img{position:relative;width:min(100%,230px);aspect-ratio:1.3;border-radius:20px;background:#f1f5fa;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none}
.al-cf-img img{max-width:80%;max-height:84%;object-fit:contain;background:transparent!important}
.al-cf-img .al-ini{font-size:4.6rem}.al-cf-img .al-ini.l3{font-size:3.6rem}.al-cf-img .al-ini.l4{font-size:2.8rem}
.al-card.gold .al-cf-img{background:#fffaf0}
.al-cf-img.lk img{filter:url(#al-sil);opacity:.18}
[data-theme=dark] .al-cf-img.lk{background:#26324a}
[data-theme=dark] .al-cf-img.lk img{filter:url(#al-sil) invert(1);opacity:.18}
.al-cf-img.lk .al-q{font-size:4.2rem}
.al-cf-w{font:700 2rem/1.1 var(--f-round);overflow-wrap:anywhere;margin-top:4px}
.al-cf .sayg{gap:10px}
.al-cf .say{width:54px;height:54px;font-size:1.45rem}
.al-cf .say.sm{width:44px;height:44px;font-size:1.1rem;margin-left:2px}
.al-cf-alt{font-size:.95rem;color:var(--label2)}.al-cf-alt b{color:var(--label)}
.al-cf-es{font-size:1.1rem;font-weight:700;color:var(--label2)}
.al-cf-pr{font-size:1rem}.al-cf-pr b{font-style:italic}
.al-cf-ex{width:100%;margin-top:4px;padding:10px 12px;border-radius:14px;background:var(--fill2);font-size:.98rem;text-align:left}
.al-cf-ex small{display:block;color:var(--label2);font-style:italic;margin-top:2px}
.al-bh{font-weight:800;font-size:1.15rem;text-align:center;margin:2px 0 6px}
.al-fi{display:flex;justify-content:space-between;gap:12px;padding:9px 2px;border-bottom:1px solid var(--sep);font-size:.98rem}
.al-fi span{color:var(--label2);font-weight:600}.al-fi b{text-align:right;overflow-wrap:anywhere}
.al-br{margin-top:10px;text-align:center}
.al-br .lbl{font-weight:800;margin-bottom:6px}
.al-dots{display:flex;gap:8px;justify-content:center}
.al-dots i{width:40px;height:40px;border-radius:50%;background:var(--fill);display:flex;align-items:center;justify-content:center;font-style:normal;font-size:1.2rem;color:var(--label2)}
.al-dots i.on{background:#FFCC00;color:#3D2B00;box-shadow:0 3px 0 #B38F00}
.al-br p{margin:8px 0 0;color:var(--label2);font-weight:600}
.al-back .glass-btn{align-self:center;margin-top:10px}
.al-dnav{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px}
.al-dnav .glass-btn--icon{width:var(--btn-main);min-height:var(--btn-main)}
.al-dnav .al-turn{min-height:var(--btn-main)}
.al-dpos{text-align:center;color:#fff;font-weight:700;margin-top:10px;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.al-lk-t{margin:2px 0;font-size:1.05rem}
.al-lk-w{color:var(--label2);font-weight:600;min-height:1.4em}
.al-lk-a{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:8px}
@media (max-width:560px){
  .al-ths{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .al-th{padding:16px 6px 12px}
  .al-th .al-ring{width:64px;height:64px}.al-th .al-ring-e{font-size:28px}
  .al-ph .al-ring{width:60px;height:60px}.al-ph .al-ring-e{font-size:26px}
  .al-page{padding:14px 10px 18px}
  .al-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 10px}
  .al-st{padding:5px 5px 6px;border-radius:13px}.al-st.got::after{border-radius:13px}
  .al-lb b{font-size:.8rem}.al-lb small{font-size:.66rem}.al-ini{font-size:2rem}.al-ini.l3{font-size:1.5rem}.al-ini.l4{font-size:1.2rem}
  .al-pack span{font-size:1.5rem}.al-pack b{font-size:.9rem}.al-pack small{font-size:.66rem}
  .al-q{font-size:1.9rem}
  .al-bigstamp b{font-size:1.5rem}.al-bigstamp span{font-size:3.4rem}
  .al-cf-w{font-size:1.7rem}
}
@media (max-height:720px){.al-cf-img{width:min(100%,170px)}}
@media (prefers-reduced-motion: reduce){
  .al-st,.al-st *,.al-card,.al-flip,.al-stamp,.al-page,.al-rib,.al-bigstamp,.al-bigstamp>div{animation:none!important;transition:none!important}
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
function thumb(x){
  const full = x.t && x.got >= x.t;
  return `<a class="al-th card${full ? " full" : ""}" href="#/album/${esc(x.d.id)}"
      aria-label="${esc(x.d.title)}: ${x.got} de ${x.t} pegatinas${x.gold ? `, ${x.gold} ${plural(x.gold, "dorada", "doradas")}` : ""}${x.nw ? `, ${x.nw} ${plural(x.nw, "nueva", "nuevas")}` : ""}${x.done ? ", página completa" : ""}">
    ${ringHtml(x)}
    <b class="al-th-t">${esc(x.d.title)}</b>
    <span class="al-th-n"><span>${fmt(x.got)} de ${fmt(x.t)}</span>${x.gold ? `<span class="al-gd">${IC("star", "fill", 14)}${fmt(x.gold)}</span>` : ""}</span>
    ${x.nw ? `<span class="al-cnt" aria-hidden="true">${x.nw > 99 ? "99+" : x.nw} ${plural(x.nw, "nueva", "nuevas")}</span>` : ""}
    ${x.done ? `<span class="al-th-stamp" aria-hidden="true">${IC("medal", "bold", 16)}</span>` : ""}</a>`;
}
async function cover(nav){
  const all = await topics();
  if(!alive(nav)) return;
  const N = sum(all, x => x.got), M = sum(all, x => x.t), G = sum(all, x => x.gold);
  const groups = groupsOf(all);
  let tab = store.get(K.tab, null);
  if(!groups.some(g => g.g === tab)){
    const best = groups.slice().sort((a, b) => sum(b.list, x => x.got) - sum(a.list, x => x.got))[0];
    tab = best && sum(best.list, x => x.got) ? best.g : (groups[0] || {}).g;
  }
  const news = all.filter(x => x.nw).sort((a, b) => b.nw - a.nw).slice(0, 3);
  const segI = g => {
    const nw = sum(g.list, x => x.nw), on = g.g === tab;
    return `<button type="button" class="seg-i" role="tab" id="al-g-${g.g}" data-tab="${g.g}" aria-selected="${on}" tabindex="${on ? 0 : -1}" aria-controls="al-ths-${g.g}"
      ${nw ? `data-badge="${nw > 9 ? "9+" : nw}" aria-label="${esc(g.tab)}, ${nw} ${plural(nw, "pegatina nueva", "pegatinas nuevas")}"` : ""}>${esc(g.tab)}</button>`;
  };
  $("#app").innerHTML = `<div class="al al-cv">
    <section class="card al-sum" aria-label="Mi álbum de pegatinas">
      <span class="al-ring${M && N >= M ? " al-full" : ""}">${ringSvg(M ? N / M : 0, M ? G / M : 0)}<span class="al-ring-e" aria-hidden="true">📒</span></span>
      <p class="al-sum-t"><b class="t-num">${fmt(N)}</b> de <span class="t-num">${fmt(M)}</span> ${plural(M, "pegatina", "pegatinas")}</p>
      ${N ? "" : `<a class="glass-btn glass-btn--pri glass-btn--sm" href="#/mapa">${IC("map-trifold", "bold", 18)}Conseguir</a>`}
    </section>
    ${news.length ? `<section class="al-news" aria-labelledby="al-news-h"><h2 class="st-h" id="al-news-h">Pegatinas nuevas para pegar</h2>
      <div class="st-g">${news.map(x => `<a class="st-r al-nw" href="#/album/${esc(x.d.id)}" aria-label="${esc(x.d.title)}: ${x.nw} ${plural(x.nw, "pegatina nueva", "pegatinas nuevas")}">
        <span class="al-nw-e" aria-hidden="true">${emo(x.d)}</span><span class="st-l">${esc(x.d.title)}</span>
        <span class="al-cnt" aria-hidden="true">${x.nw > 99 ? "99+" : x.nw}</span>${IC("caret-right", "bold", 18, "al-chev")}</a>`).join("")}</div></section>` : ""}
    <div class="seg al-grps" role="tablist" aria-label="Partes del álbum">${groups.map(segI).join("")}</div>
    ${groups.map(g => `<div class="al-ths" id="al-ths-${g.g}" role="tabpanel" aria-labelledby="al-g-${g.g}" data-g="${g.g}" ${g.g === tab ? "" : "hidden"}>
      ${g.list.map(thumb).join("")}</div>`).join("")}
  </div>`;
  const app = $("#app"), seg = app.querySelector(".al-grps"), tabs = [...seg.querySelectorAll("[data-tab]")];
  const pick = b => {
    const t = b.dataset.tab; if(b.getAttribute("aria-selected") === "true") return;
    store.set(K.tab, t); snd("tap"); haptic("selection");
    tabs.forEach(x => { const on = x === b; x.setAttribute("aria-selected", on); x.tabIndex = on ? 0 : -1; });
    app.querySelectorAll(".al-ths").forEach(s => s.hidden = s.dataset.g !== t);
  };
  seg.addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if(b) pick(b); });
  seg.addEventListener("keydown", e => {
    if(typeof rovingKeys !== "function") return;
    rovingKeys(e, tabs);
    const b = document.activeElement && document.activeElement.closest && document.activeElement.closest("[data-tab]");
    if(b && seg.contains(b) && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) pick(b);
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
  if(!s.got) return `<button type="button" class="al-st lock" data-k="${esc(s.k)}" style="${style}" aria-label="Pegatina secreta número ${s.n}">
      <span class="al-face">${s.r.img ? `<img src="${esc(s.r.img)}" alt="" loading="lazy" decoding="async">` : ""}<span class="al-q">?</span></span>
      <span class="al-lb"><b>Nº ${s.n}</b></span></button>`;
  return `<button type="button" class="al-st got${s.gold ? " gold" : ""}${s.isNew ? " new" : ""}${s.newGold ? " newgold" : ""}" data-k="${esc(s.k)}" style="${style}"
      aria-label="${s.isNew ? "Pegatina nueva: tócala para pegarla" : `${esc(d.word)}: ${esc(s.r.es)}${s.gold ? " (dorada)" : ""}`}">
      <span class="al-face">${face(s.r)}<span class="al-num">${s.n}</span></span>
      <span class="al-lb"><b>${esc(d.word)}</b><small>${esc(s.r.es)}</small></span>
      ${s.gold ? `<span class="al-star" aria-hidden="true">⭐</span>` : ""}
      ${s.newGold ? `<span class="al-rib g">¡Dorada!</span>` : ""}
      ${s.isNew ? `<span class="al-pack" aria-hidden="true"><span>✨</span><b>¡Nueva!</b><small>Tócala</small></span>` : ""}</button>`;
}
const backBtn = `<a class="glass-btn glass-btn--sm al-bk" href="#/album">${IC("caret-left", "bold", 18)}Álbum</a>`;
const pillHtml = t => `<span>Tema:</span> <b>${esc(t)}</b>${IC("caret-down", "bold", 16)}`;
async function page(id, nav){
  const idx = await getIndex(), meta = idx.find(d => d.id === id);
  if(!alive(nav)) return;
  if(!meta || !meta.langs.includes(lang)){
    SLIDE = null;
    $("#app").innerHTML = `<div class="al"><div class="al-bar">${backBtn}</div><p class="empty">${meta ? `Esta página todavía no está lista en ${esc(LANGS[lang].name)}.` : "No encontramos esta página del álbum."}</p></div>`;
    return;
  }
  if(!CACHE[id]) $("#app").innerHTML = `<div class="al"><div class="al-bar">${backBtn}</div><p class="empty">Abriendo la página…</p></div>`;
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
  const done = (store.get(K.done(), {}) || {})[id];
  const grp = idx.filter(d => d.group === meta.group && d.langs.includes(lang)), gi = grp.findIndex(d => d.id === id);
  const prev = grp[gi - 1] || null, next = grp[gi + 1] || null;
  const slide = SLIDE; SLIDE = null;
  P = {id, meta, doc, st, secs, f: "all", nav, prev, next, byK: new Map(st.map(s => [s.k, s]))};
  $("#app").innerHTML = `<div class="al al-pg">
    <div class="al-bar">${backBtn}<button type="button" class="glass-btn glass-btn--sm al-tpill" id="al-tpill" aria-haspopup="dialog" aria-controls="al-tp-s"
      aria-label="Tema: ${esc(meta.title)}. Elegir otro tema">${pillHtml(meta.title)}</button></div>
    <section class="card al-ph" aria-labelledby="al-ph-h">
      <span class="al-ring" id="al-ph-ring">${ringSvg(0, 0, "al-ph-rf")}<span class="al-ring-e" aria-hidden="true">${emo(meta)}</span></span>
      <div class="al-ph-tx"><h1 class="al-ph-h" id="al-ph-h">${esc(meta.title)}</h1><p class="al-ph-sub" id="al-ph-sub"></p></div>
      <div class="al-stamp${done ? " on" : ""}" id="al-stamp">¡Página<br>completa!</div>
    </section>
    <div class="seg al-f" id="al-f" role="tablist" aria-label="Qué pegatinas ver"></div>
    <button type="button" class="glass-btn glass-btn--pri glass-btn--block al-pall" id="al-pall" hidden></button>
    <div class="al-tip" id="al-tip"></div>
    <div class="al-page${RM() ? "" : " turn"}${slide && !RM() ? " in-" + slide : ""}" id="al-page" data-f="all" role="tabpanel" aria-label="Pegatinas de ${esc(meta.title)}">
      ${secs.map((sc, i) => `<section class="al-sec" data-s="${i}">${sc.cat ? `<h2 class="al-cat">${esc(sc.cat)}</h2>` : ""}
        <div class="al-grid">${sc.items.map(stHtml).join("")}</div></section>`).join("")}
      <div class="al-empty" id="al-empty" hidden></div>
    </div>
  </div>`;
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
  $("#al-tpill").onclick = e => openTopics(e.currentTarget);
  wireSwipe(pg, nav);
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
  /* la pista del deslizamiento (una por pantalla y sesión, 3 veces como mucho), si no hay sobres que despegar */
  if(prev || next) later(() => {
    if(!alive(nav) || !P || P.st.some(s => s.isNew) || anyDialog() || !window.G || typeof window.G.hint !== "function") return;
    try{ window.G.hint(pg, {id: "al-swipe", gesture: "swipe", text: "Desliza para cambiar de tema"}); }catch(e){}
  }, 1200);
  checkComplete();
}
function counts(){
  const st = P.st, got = st.filter(s => s.got).length, gold = st.filter(s => s.gold).length, nw = st.filter(s => s.isNew).length;
  return {tot: st.length, got, gold, nw, lock: st.length - got};
}
function paintHead(){
  if(!P) return;
  const c = counts();
  const sub = $("#al-ph-sub"), rf = $("#al-ph-rf"), rg = $("#al-ph-rf-g"), ring = $("#al-ph-ring"), f = $("#al-f"), pa = $("#al-pall");
  if(sub) sub.innerHTML = `<b>${c.got}</b> de <b>${c.tot}</b> ${plural(c.tot, "pegatina", "pegatinas")}${c.gold ? ` · ${c.gold} ${plural(c.gold, "dorada", "doradas")}` : ""}`;
  if(rf){ rf.setAttribute("stroke-dasharray", `${arc(c.tot ? c.got / c.tot : 0)} 100`); rf.classList.toggle("zero", !c.got); }
  if(rg){ rg.setAttribute("stroke-dasharray", `${garc(c.tot ? c.got / c.tot : 0, c.tot ? c.gold / c.tot : 0)} 100`); rg.classList.toggle("zero", !c.gold); }
  if(ring) ring.classList.toggle("al-full", !!c.tot && c.got >= c.tot);
  if(f){
    const F = [["all", "Todas", c.tot], ["got", "Tengo", c.got], ["lock", "Faltan", c.lock], ["gold", "Doradas", c.gold]];
    if(f.children.length !== F.length){
      f.innerHTML = F.map(([k, t, n]) => `<button type="button" class="seg-i" role="tab" data-f="${k}" aria-controls="al-page" aria-selected="${P.f === k}" tabindex="${P.f === k ? 0 : -1}">${t} <small>${n}</small></button>`).join("");
      const bs = [...f.querySelectorAll("[data-f]")];
      bs.forEach(b => b.onclick = () => { if(P && P.f !== b.dataset.f){ snd("tap"); haptic("selection"); setFilter(b.dataset.f); } });
      f.addEventListener("keydown", e => {
        if(typeof rovingKeys !== "function") return;
        rovingKeys(e, bs);
        const b = document.activeElement && document.activeElement.closest && document.activeElement.closest("[data-f]");
        if(b && f.contains(b) && P && P.f !== b.dataset.f && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) setFilter(b.dataset.f);
      });
    } else F.forEach(([k, , n], j) => {
      /* sin repintar los botones: el foco no se pierde al elegir un filtro */
      const b = f.children[j], on = P.f === k, sm = b.querySelector("small");
      b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if(sm) sm.textContent = n;
    });
  }
  if(pa){ pa.hidden = !c.nw; pa.innerHTML = `${IC("sparkle", "fill", 20)}${c.nw === 1 ? "Pegar la nueva" : `Pegar las ${c.nw} nuevas`}`; }
  paintTip(c);
  applyFilter();
}
function paintTip(c){
  const tip = $("#al-tip"); if(!tip || !P) return;
  const msg = c.nw ? `¡Tienes ${c.nw} ${plural(c.nw, "pegatina nueva", "pegatinas nuevas")}! Tócala${c.nw > 1 ? "s" : ""} para pegarla${c.nw > 1 ? "s" : ""}.`
    : !c.got ? "Aprende palabras de este tema en el Camino para llenar la página."
    : c.got >= c.tot ? (c.gold >= c.tot ? "¡Todas doradas! ¡Eres un campeón!" : "¡Página completa! Repasa para que todas sean doradas.")
    : `Te ${plural(c.lock, "falta", "faltan")} ${c.lock}. Toca una pegatina para verla en grande.`;
  const x = !c.nw && c.lock && P.more;
  const more = !x ? "" : x.open
    ? `<a class="glass-btn glass-btn--pri glass-btn--sm al-more" href="#/leccion/${esc(x.id)}">${IC("play", "fill", 18)}${c.got ? "Conseguir más" : "Empezar a llenarla"}</a>`
    : `<a class="glass-btn glass-btn--sm al-more" href="#/mapa/${esc(x.lv)}">${IC("map-trifold", "bold", 18)}Ir al nivel ${esc(x.lv)}</a>`;
  tip.innerHTML = `<span>${esc(msg)}</span>${more}`;
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
    e.innerHTML = f === "gold" ? "Todavía no hay pegatinas doradas aquí.<br>¡Repasa tus palabras para que brillen!"
      : f === "got" ? "Todavía no tienes pegatinas de este tema.<br>¡Apréndelas en el Camino!" : "¡No te falta ninguna!";
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

/* ---------- pasar de tema: deslizar la página y la hoja de temas ---------- */
/* ir al tema anterior (k = -1) o siguiente (k = 1) de la misma parte; con el, la página sale por ese lado */
function goTopic(k){
  if(!P) return false;
  const t = k > 0 ? P.next : P.prev; if(!t) return false;
  SLIDE = k > 0 ? "next" : "prev";
  location.hash = "#/album/" + encodeURIComponent(t.id);
  return true;
}
function wireSwipe(pg, nav){
  if(!pg || !window.G || typeof window.G.swipe !== "function") return;
  let dy = 0, live = false;
  const reset = () => { pg.style.translate = ""; pg.style.opacity = ""; };
  const back = i => {
    dy = 0; live = false;
    if(RM() || !pg.isConnected){ reset(); return; }
    const x = parseFloat(pg.style.translate) || 0; reset();
    if(!x) return;
    try{
      if(window.M && typeof M.springTo === "function") M.springTo(pg, [{translate: `${x}px 0`}, {translate: "0 0"}], {velocity: {x: (i && i.v) || 0, y: 0}, commit: false});
      else pg.animate([{translate: `${x}px 0`}, {translate: "0 0"}], {duration: 220, easing: "ease-out"});
    }catch(e){}
  };
  /* más de 60 px, más del doble que en vertical, con destino y sin ningún diálogo abierto (la tarjeta tiene su propio deslizar) */
  const fire = (k, i) => {
    const t = P && (k > 0 ? P.next : P.prev);
    if(!t || !alive(nav) || anyDialog() || !(Math.abs(i.raw) > 60) || !(Math.abs(i.raw) > 2 * Math.abs(dy))){ back(i); return; }
    live = false; dy = 0; haptic("selection"); snd("whoosh");
    if(RM()){ reset(); goTopic(k); return; }
    const x = parseFloat(pg.style.translate) || i.dx || 0, w = pg.offsetWidth || innerWidth;
    reset();
    try{ pg.animate([{translate: `${x}px 0`, opacity: 1}, {translate: `${k > 0 ? -w * .6 : w * .6}px 0`, opacity: 0}], {duration: 160, easing: "ease-in", fill: "forwards"}); }catch(e){}
    setTimeout(() => { if(alive(nav)) goTopic(k); }, 150);
  };
  GEST.push(window.G.swipe(pg, {
    threshold: 60,
    onMove: i => {
      if(anyDialog()){ if(live) reset(); live = false; return; }
      live = true; dy = i.dy;
      if(RM()) return;
      /* sin tema a ese lado, la página apenas se mueve (goma) */
      const has = i.dx < 0 ? !!(P && P.next) : !!(P && P.prev);
      const x = has ? i.dx : i.dx * .2;
      pg.style.translate = `${x.toFixed(1)}px 0`;
      pg.style.opacity = has ? String(Math.max(.55, 1 - Math.abs(x) / 900)) : "";
    },
    onLeft: i => fire(1, i),
    onRight: i => fire(-1, i),
    onCancel: i => back(i),
  }));
}
/* la hoja «Tema»: arriba las partes del álbum (control segmentado) y debajo sus temas con lo conseguido; tocar uno lo abre */
function topicSheet(){
  if(TS && TS.isConnected) return TS;
  TS = document.createElement("dialog");
  TS.id = "al-tp-s"; TS.className = "al-tp-d"; TS.setAttribute("aria-labelledby", "al-tp-t");
  TS.dataset.noRenew = ""; TS.dataset.noHint = "";
  document.body.appendChild(TS);
  TS.addEventListener("click", e => {
    if(e.target.closest("[data-close]")){ closeTopics(); return; }
    const g = e.target.closest("[data-tg]");
    if(g){ if(g.getAttribute("aria-selected") !== "true"){ snd("tap"); haptic("selection"); paintTopics(g.dataset.tg); } return; }
    const r = e.target.closest("[data-tp]");
    if(r) chooseTopic(r.dataset.tp);
  });
  TS.addEventListener("keydown", e => {
    const s = e.target.closest && e.target.closest(".seg"); if(!s || typeof rovingKeys !== "function") return;
    const bs = [...s.querySelectorAll("[data-tg]")];
    rovingKeys(e, bs);
    const b = document.activeElement && document.activeElement.closest && document.activeElement.closest("[data-tg]");
    if(b && s.contains(b) && b.getAttribute("aria-selected") !== "true" && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) paintTopics(b.dataset.tg, true);
  });
  return TS;
}
let TALL = null;   /* los temas que enseña la hoja abierta */
function paintTopics(g, keepFocus){
  if(!TS || !TALL) return;
  const groups = groupsOf(TALL), cur = P ? P.id : null;
  TS.querySelectorAll("[data-tg]").forEach(b => { const on = b.dataset.tg === g; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; });
  const grp = groups.find(x => x.g === g) || groups[0]; if(!grp) return;
  const box = TS.querySelector("#al-tp-l"); if(!box) return;
  box.setAttribute("aria-labelledby", "al-tg-" + grp.g);
  box.innerHTML = grp.list.map(x => {
    const on = x.d.id === cur;
    return `<button type="button" class="st-r al-tp-r" role="radio" aria-checked="${on}" data-tp="${esc(x.d.id)}">
      <span class="al-tp-e" aria-hidden="true">${emo(x.d)}</span>
      <span class="st-l">${esc(x.d.title)}<small>${fmt(x.got)} de ${fmt(x.t)}${x.nw ? ` · ${x.nw} ${plural(x.nw, "nueva", "nuevas")}` : ""}${x.done ? " · completa" : ""}</small></span>
      ${on ? IC("check", "bold", 20, "al-tp-ok") : ""}</button>`;
  }).join("");
  if(!keepFocus){ const sel = box.querySelector('[aria-checked="true"]'); if(sel) try{ sel.scrollIntoView({block: "center"}); }catch(e){} }
}
async function openTopics(from){
  if(!P) return false;
  css();
  const nav = P.nav, all = await topics();
  if(!alive(nav) || !P) return false;
  TALL = all;
  const d = topicSheet(), groups = groupsOf(all), g = P.meta.group;
  d.innerHTML = `<div class="m-head"><h2 id="al-tp-t">Tema</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Listo</button></div>
    <div class="seg" role="tablist" aria-label="Partes del álbum">${groups.map(x => `<button type="button" class="seg-i" role="tab" id="al-tg-${x.g}" data-tg="${x.g}"
      aria-controls="al-tp-l" aria-selected="${x.g === g}" tabindex="${x.g === g ? 0 : -1}">${esc(x.tab)}</button>`).join("")}</div>
    <div class="st-g" id="al-tp-l" role="radiogroup"></div>`;
  try{
    if(window.M && typeof M.openSheet === "function") M.openSheet(d, {from: from && from.nodeType === 1 ? from : null});
    else d.showModal();
  }catch(e){ try{ d.showModal(); }catch(e2){ d.setAttribute("open", ""); } }
  paintTopics(g);
  return true;
}
function closeTopics(now){
  if(!TS || !TS.open) return;
  if(!now && window.M && typeof M.closeSheet === "function" && TS.classList.contains("m-sheet")) M.closeSheet(TS);
  else try{ TS.close(); }catch(e){}
}
function chooseTopic(id){
  if(!P || !TALL) return false;
  const x = TALL.find(t => t.d.id === id); if(!x) return false;
  haptic("selection");
  if(id === P.id){ closeTopics(); return true; }
  /* entra por el lado que le toca si es de la misma parte */
  const ids = TALL.filter(t => t.d.group === P.meta.group).map(t => t.d.id), a = ids.indexOf(P.id), b = ids.indexOf(id);
  SLIDE = a >= 0 && b >= 0 ? (b > a ? "next" : "prev") : null;
  closeTopics(true);
  location.hash = "#/album/" + encodeURIComponent(id);
  return true;
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
  const ipa = ipaOn() && d.ipa ? d.ipa : "";
  return `<div class="al-cf al-front">
    <div class="al-cf-top"><span class="al-n2">Nº ${s.n}</span>${s.gold ? `<span class="al-gtag">⭐ Dorada</span>` : `<span class="al-ntag">Toca para ver la ficha</span>`}</div>
    <div class="al-cf-img">${face(r)}</div>
    <div class="al-cf-w">${esc(d.word)}</div>
    <div>${sayBtn(d.word)}</div>
    ${alts.length ? `<div class="al-cf-alt">También: ${alts.map(a => `<b>${esc(a.word)}</b> ${sayBtn(a.word, 1)}`).join(" · ")}</div>` : ""}
    <div class="al-cf-es">🇪🇸 ${esc(r.es)}</div>
    ${d.pron || ipa ? `<div class="al-cf-pr">🗣️ Suena: ${d.pron ? `<b>${esc(d.pron)}</b>` : ""} ${ipa ? `<span class="ipa">${esc(ipa)}</span>` : ""}</div>` : ""}
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
    <div class="al-bh">Ficha de la pegatina</div>
    <div class="al-fi"><span>Palabra</span><b>${esc(d.word)}</b></div>
    <div class="al-fi"><span>En español</span><b>${esc(r.es)}</b></div>
    <div class="al-fi"><span>Página</span><b>${emo(P ? P.meta : {id: "", title: ""})} ${esc(P ? P.meta.title : "")}</b></div>
    ${lv ? `<div class="al-fi"><span>Nivel</span><b>${esc(r.level)} · ${esc(lv.n)}</b></div>` : ""}
    ${r.pos && POS[r.pos] ? `<div class="al-fi"><span>Tipo</span><b>${esc(POS[r.pos])}</b></div>` : ""}
    ${forms ? `<div class="al-fi"><span>Otras formas</span><b>${esc(forms)}</b></div>` : ""}
    <div class="al-fi"><span>La has repasado</span><b>${s.reps} ${plural(s.reps, "vez", "veces")}</b></div>
    <div class="al-br"><div class="lbl">Brillo</div><div class="al-dots" role="img" aria-label="Brillo ${Math.min(s.box, MASTER)} de ${MASTER}">${dots}</div>
      <p>${s.gold ? "¡Es dorada! Esta palabra ya no se te olvida." : `Acierta ${left} ${plural(left, "repaso", "repasos")} más y será dorada.`}</p></div>
    ${due ? `<a class="glass-btn glass-btn--pri" href="#/repaso">${IC("arrows-clockwise", "bold", 20)}Repasar ahora</a>` : ""}
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
    <button type="button" class="al-x" data-al="x" aria-label="Cerrar">${IC("x", "bold", 22) || "✕"}</button>
    <div class="al-card${s.gold ? " gold" : ""}${anim && !RM() ? " " + anim : ""}"><div class="al-flip" id="al-flip">${frontHtml(s)}${backHtml(s)}</div></div>
    <div class="al-dnav">
      <button type="button" class="glass-btn glass-btn--icon al-nb" data-al="prev" aria-label="Pegatina anterior" ${CARD.i > 0 ? "" : "disabled"}>${IC("caret-left", "bold", 26)}</button>
      <button type="button" class="glass-btn glass-btn--pri al-turn" data-al="turn">${IC("arrows-clockwise", "bold", 20)}<span>Dar la vuelta</span></button>
      <button type="button" class="glass-btn glass-btn--icon al-nb" data-al="next" aria-label="Pegatina siguiente" ${CARD.i < n - 1 ? "" : "disabled"}>${IC("caret-right", "bold", 26)}</button>
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
  const b = DLG.querySelector(".al-turn span"); if(b) b.textContent = CARD.turned ? "Ver la pegatina" : "Dar la vuelta";
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
    <button type="button" class="al-x" data-al="x" aria-label="Cerrar">${IC("x", "bold", 22) || "✕"}</button>
    <div class="al-card${RM() ? "" : " opening"}"><div class="al-cf al-front">
      <div class="al-cf-top"><span class="al-n2">Nº ${s.n}</span></div>
      <div class="al-cf-img lk">${r.img ? `<img src="${esc(r.img)}" alt="">` : ""}<span class="al-q">?</span></div>
      <div class="al-cf-w">¡Pegatina secreta!</div>
      <p class="al-lk-t">Aprende esta palabra en el <b>Camino</b> para conseguirla.</p>
      <div class="al-cf-es">Pista: ${num ? "es un número" : `en español empieza por «${esc(first)}»`}</div>
      <div class="al-lk-w" id="al-lk-w">Buscando en el Camino…</div>
      <div class="al-lk-a" id="al-lk-a"><a class="glass-btn glass-btn--pri" href="#/mapa">${IC("map-trifold", "bold", 20)}Ir al Camino</a></div>
    </div></div></div>`;
  OPEN_T = now(); show(d);
  const tok = CARD;
  findLesson(P.id, s.idx).then(x => {
    if(CARD !== tok || !DLG || !DLG.open) return;
    const w = DLG.querySelector("#al-lk-w"), a = DLG.querySelector("#al-lk-a"); if(!w || !a) return;
    if(!x){ w.textContent = "Sigue aprendiendo en el Camino y la encontrarás."; return; }
    if(x.open){
      w.textContent = `Está en el nivel ${x.lv}, lección ${x.num}. ¡Ya puedes aprenderla!`;
      a.innerHTML = `<a class="glass-btn glass-btn--pri" href="#/leccion/${esc(x.id)}">${IC("play", "fill", 20)}Aprenderla ahora</a><a class="glass-btn" href="#/mapa/${esc(x.lv)}">${IC("map-trifold", "bold", 20)}Ver el Camino</a>`;
    } else {
      w.textContent = `Está más adelante, en el nivel ${x.lv} (lección ${x.num}). ¡Sigue el Camino!`;
      a.innerHTML = `<a class="glass-btn glass-btn--pri" href="#/mapa/${esc(x.lv)}">${IC("map-trifold", "bold", 20)}Ir al nivel ${esc(x.lv)}</a>`;
    }
  }).catch(() => {});
}

/* ---------- conexión con la app ---------- */
ROUTES["album"] = async parts => {
  css(); stopAll();
  const nav = ++NAV, raw = parts && parts[0] ? String(parts[0]) : "";
  let id = raw; try{ id = decodeURIComponent(raw); }catch(e){}   /* «#/album/%E2» → página no encontrada, sin error */
  if(id) await page(id, nav); else { SLIDE = null; await cover(nav); }
};
/* atrás del navegador con la tarjeta o la hoja abierta: se cierran en el acto, sin esperar a que se pinte la ruta nueva */
window.addEventListener("hashchange", () => { if(DLG && DLG.open) closeDlg(); closeTopics(true); });

/* punto azul en la pestaña «Jugar» y en su segmento «Álbum» (tabBadge de index.html) si hay pegatinas nuevas sin ver */
function tabDot(){
  let n = 0; try{ n = newTotal(); }catch(e){}
  try{ if(typeof tabBadge === "function") tabBadge("jugar", n > 0, n > 0 ? `${n} ${plural(n, "pegatina nueva", "pegatinas nuevas")}` : "", "#/album"); }catch(e){}
}
["boot", "lang", "lesson-done", "review-done"].forEach(ev => bus.on(ev, () => setTimeout(() => { try{ tabDot(); }catch(e){} }, 0)));
bus.on("route", d => {
  const h = String((d && d.h) || "");
  if(!h.startsWith("album")){ NAV++; stopAll(); SLIDE = null; }
  try{ css(); tabDot(); }catch(e){ console.error(e); }
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
      host.insertAdjacentHTML("beforeend", `<a class="btn al-ls" href="#/album/${esc(docs[0][0])}">${ico("sparkle", "fill", 18)}¡${n} ${plural(n, "pegatina nueva", "pegatinas nuevas")}!</a>`);
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
      if(n) host.insertAdjacentHTML("beforeend", `<a class="btn al-ls" href="#/album">${ico("star", "fill", 18)}¡${n} ${plural(n, "pegatina dorada nueva", "pegatinas doradas nuevas")}!</a>`);
    }catch(e){ console.error(e); }
  }, 60);
});

/* para las pruebas y otros módulos: pasar de tema y abrir la hoja de temas como lo hacen el gesto y la pastilla */
window.vocabAlbum = {
  next: () => goTopic(1), prev: () => goTopic(-1),
  openTopics: from => openTopics(from || document.getElementById("al-tpill")), closeTopics: () => closeTopics(),
  chooseTopic, newTotal,
};
})();
