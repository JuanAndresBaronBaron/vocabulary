/* módulo grammargames: tres juegos de gramática de Jugar › Juegos registrados con vocabGames.register (como
   js/party.js, que registra dos desde un módulo). No usan el tema elegido: words «Gramática», sec "gramatica".
   Rutas: #/juegos/ordenafrase («Ordena la frase») · #/juegos/completa («Completa la frase») · #/juegos/detective
     («Detective de errores»).
   Datos: data/grammar_<en|fr|da>.json (getGram() de index.html; si no, fetch): {A1: [unidad…], …, C2}; cada unidad
     {t (título en español), sum, rules, ex: [{t (la frase en el idioma), es}], q: [{s (con ___), o, a, es, why}]}.
   Nivel: arriba de cada partida, una fila A1 … C2 (por defecto A1; se recuerda por idioma en store "gram:lv"
     {english: "A1", …}). Cambiarlo empieza otra vez con ese nivel; al contestar la primera pregunta la fila se va y
     queda la pastilla «Nivel A1». Las preguntas mezclan las unidades del nivel (una de cada unidad por vuelta) y cada
     una lleva su título en una pastilla. Después de cada respuesta sale el porqué (why; en Ordena, el resumen de la
     unidad) y la frase buena suena con la voz de la app (api.speak).
   Ordena la frase: 8 frases de ex con 3-9 piezas (los signos van pegados a su palabra: «Paris ?», «— Oui,»). Sale lo
     que significa en español; se tocan las piezas en orden (o se arrastran a un hueco; tocar una puesta la quita) y
     «Comprobar». Bien: turquesa y suena la frase. Mal: las mal puestas en gris con ✗ (las buenas se quedan) y otra
     oportunidad; a la segunda, la respuesta. Estrellas por las acertadas a la primera (7-8 ★★★, 5-6 ★★).
   Completa la frase: 10 frases de q en un tren: los vagones llevan las palabras y el hueco es un vagón vacío; 3
     opciones (si hay 4, la buena y 2 al azar). Bien: el vagón se llena en turquesa, suena la frase y el tren se va.
     Mal: ✗ gris, la buena se ilumina, el vagón se llena con ella y salen el porqué y el español. 9-10 ★★★, 6-8 ★★.
   Detective de errores: 10 casos de q: 3 notas con la frase rellena con cada opción (lo que cambia, subrayado) y solo
     una está bien. Mal: ✗ gris y la buena se ilumina. Luego el porqué y el español. 9-10 ★★★, 6-8 ★★.
   Teclas: 1-9 (piezas u opciones), Retroceso (quitar la última pieza), Enter (Comprobar / Siguiente), ← → en el nivel.
   Pruebas: root.ggAns (las piezas en orden) y pieza.ggW (Ordena); opción.ggOk (Completa y Detective); root.ggLv. */
(() => {
"use strict";

const ORD = "ordenafrase", COM = "completa", DET = "detective";
const LVS = ["A1", "A2", "B1", "B2", "C1", "C2"], LV_KEY = "gram:lv";
const NB = " ";
const IC = (n, s = "bold", z = 22, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
const RM = () => { try{ return !!(window.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const code = () => (LANGS[lang] || LANGS.english).code;
const num = v => Number.isFinite(+v) ? +v : 0;
const shuf = a => { const b = [...a]; for(let i = b.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
/* el **negrita** de algunos resúmenes */
const md = s => esc(String(s || "")).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*([^*\s][^*]*?)\*/g, "<i>$1</i>").replace(/(^|\s)-(?=\p{L})/gu, "$1-⁠");   /* «-ene» sin partirse tras el guion */
const starsOf = (ok, n) => { const r = n ? ok / n : 0; return r >= .85 ? 3 : r >= .6 ? 2 : 1; };

/* ---------- el nivel (por idioma) ---------- */
function lvGet(){
  const o = store.get(LV_KEY, null), v = o && typeof o === "object" ? o[lang] : null;
  return LVS.includes(v) ? v : "A1";
}
function lvSet(v){
  if(!LVS.includes(v)) return;
  const o = store.get(LV_KEY, null), n = o && typeof o === "object" && !Array.isArray(o) ? o : {};
  n[lang] = v; store.set(LV_KEY, n);
}

/* ---------- los datos ---------- */
async function gram(){
  let g = null;
  try{ if(typeof getGram === "function") g = await getGram(); }catch(e){ g = null; }
  if(!g || !LVS.some(l => Array.isArray(g[l]) && g[l].length)){
    try{ const r = await fetch(`data/grammar_${code().slice(0, 2)}.json`); g = r.ok ? await r.json() : null; }catch(e){ g = null; }
  }
  return g && typeof g === "object" ? g : {};
}
/* n cosas del nivel mezclando sus unidades: una de cada unidad por vuelta (unidades en orden al azar), luego al azar */
function mix(units, get, n){
  const pools = shuf((Array.isArray(units) ? units : []).map(u => shuf(get(u) || []).map(x => ({x, u})))).filter(p => p.length);
  const out = [];
  while(out.length < n && pools.some(p => p.length)) for(const p of pools) if(p.length && out.length < n) out.push(p.pop());
  return shuf(out);
}
/* las piezas de una frase: por espacios, y los signos sueltos pegados a su palabra («Paris ?», «— Oui,», «« Entrez »,») */
const isWord = w => /[\p{L}\p{N}]/u.test(w) || w.includes("___");
const OPEN = /^[«¿¡“„([—–-]+$/;
function pieces(t){
  const out = []; let carry = "";
  for(const w of String(t || "").trim().split(/\s+/)){
    if(!w) continue;
    if(!isWord(w)){
      if(OPEN.test(w) || !out.length){ carry += w + NB; continue; }
      out[out.length - 1] += NB + w; continue;
    }
    out.push(carry + w); carry = "";
  }
  if(carry){ if(out.length) out[out.length - 1] += NB + carry.trim(); else out.push(carry.trim()); }
  return out;
}
/* Completa: si una palabra no cabe entera en su botón (se partiría: childre|n), las opciones van una debajo de otra */
function fitOps(box){
  if(!box || !box.isConnected) return;
  box.classList.remove("long");
  const op = box.querySelector(".gg-op"); let wide = false;
  if(op){
    const cs = getComputedStyle(op), room = op.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2;
    const cx = (fitOps.cv || (fitOps.cv = document.createElement("canvas"))).getContext("2d");
    cx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    wide = [...box.querySelectorAll(".gg-op > span")].some(sp => sp.textContent.split(/\s+/).some(w => cx.measureText(w).width > room));
  }
  box.classList.toggle("long", box.dataset.long === "1" || wide);
}
/* la frase de q con una opción en el hueco: {pre, mid, post, full}. «–» = nada (sin artículo); «'ll» va pegado */
const NONE = o => /^[–—-]?$/.test(String(o).trim());
const ELI = /(?:^|\s)(?:[cdjlmnst]|\p{L}*qu)['’]$/iu;
function fill(s, o){
  const i = s.indexOf("___");
  if(i < 0) return {pre: s, mid: "", post: "", full: s, none: false};
  let pre = s.slice(0, i), post = s.slice(i + 3), mid = String(o).trim();
  const none = NONE(mid);
  if(none){
    mid = "";
    if(!pre.trim()){ post = post.replace(/^\s+/, ""); post = post.charAt(0).toUpperCase() + post.slice(1); }
    else if(/\s$/.test(pre) && /^\s/.test(post)) post = post.replace(/^\s+/, "");
    else if(/^[.,;:!?]/.test(post)) pre = pre.replace(/\s+$/, "");
  } else {
    if(/^['’]/.test(mid)) pre = pre.replace(/\s+$/, "");
    if(ELI.test(mid)) post = post.replace(/^\s+/, "");   /* L'hôtel, J'écoute, n'aime (no «Lars' cykel») */
  }
  return {pre, mid, post, full: pre + mid + post, none};
}
/* lo que se dice en voz alta: sin «→» ni comillas */
const spoken = s => String(s || "").replace(/\s*→\s*/g, ". ").replace(/[«»“”"]/g, " ").replace(/\s+([.?!,;:])/g, "$1")
  .replace(/([.?!])\s*\.(?!\.)/g, "$1").replace(/\s{2,}/g, " ").trim();
const okQ = x => x && typeof x.s === "string" && x.s.split("___").length === 2 && Array.isArray(x.o) && x.o.length >= 2 &&
  x.o.every(o => typeof o === "string") && Number.isInteger(x.a) && x.a >= 0 && x.a < x.o.length;
/* 3 opciones: la buena y 2 de las otras, en orden al azar */
function three(q){
  const right = q.o[q.a], o = shuf([right, ...shuf(q.o.filter((_, i) => i !== q.a)).slice(0, 2)]);
  return {o, a: o.indexOf(right)};
}

/* ---------- dibujos (trazo negro, colores sobrios) ---------- */
const LOCO = `<svg class="gg-loco-svg" viewBox="0 0 120 92" aria-hidden="true" focusable="false">
  <g class="gg-steam" fill="#fff" stroke="#000" stroke-width="2.5"><circle cx="94" cy="11" r="7"/><circle cx="108" cy="6" r="5"/></g>
  <rect x="4" y="22" width="40" height="50" rx="5" fill="#22409a" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M0 22 H48" stroke="#000" stroke-width="6" stroke-linecap="round"/>
  <rect x="12" y="30" width="24" height="18" rx="3" fill="#cfe4f6" stroke="#000" stroke-width="3"/>
  <rect x="40" y="42" width="68" height="30" rx="10" fill="#1f5fbf" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
  <rect x="56" y="42" width="7" height="30" fill="#FFCC00" stroke="#000" stroke-width="2"/>
  <path d="M78 42 V24 H96 V42" fill="#4b5563" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M74 24 H100" stroke="#000" stroke-width="5.5" stroke-linecap="round"/>
  <circle cx="111" cy="55" r="6" fill="#FFCC00" stroke="#000" stroke-width="3"/>
  <rect x="4" y="70" width="106" height="8" rx="3" fill="#3a3a3c" stroke="#000" stroke-width="2.5"/>
  <g fill="#1b1b1b" stroke="#000" stroke-width="3"><circle cx="22" cy="80" r="10"/><circle cx="52" cy="80" r="10"/><circle cx="90" cy="82" r="8"/></g>
  <g fill="#c7cdd4"><circle cx="22" cy="80" r="3.5"/><circle cx="52" cy="80" r="3.5"/><circle cx="90" cy="82" r="3"/></g></svg>`;
const LENS = `<svg class="gg-lens-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
  <path d="M66 66 L90 92" stroke="#000" stroke-width="17" stroke-linecap="round"/><path d="M66 66 L90 92" stroke="#a8734a" stroke-width="10" stroke-linecap="round"/>
  <circle cx="42" cy="42" r="33" fill="#cfe4f6" fill-opacity=".8"/>
  <circle cx="42" cy="42" r="29" fill="none" stroke="#4b5563" stroke-width="7"/>
  <circle cx="42" cy="42" r="33" fill="none" stroke="#000" stroke-width="3.5"/><circle cx="42" cy="42" r="25" fill="none" stroke="#000" stroke-width="2.5"/>
  <path d="M27 31 a19 19 0 0 1 11 -7" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
  <text x="42" y="54" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="34" fill="#22409a">?</text></svg>`;
/* colores de los vagones (texto blanco encima con contraste ≥ 4,5); el turquesa es solo para el vagón acertado */
const WAGONS = ["#1f5fbf", "#2b7a4b", "#8a5a33", "#22409a", "#4b5563"];

const CSS = `
.gg{max-width:760px;--gg-teal:#007a8f;--gg-teal-d:#005c6b;--gg-teal-soft:#e0f3f6}
.gg .gm-top{margin-bottom:8px}
/* el nivel: una fila de 6 al empezar; luego, una pastilla */
.gg-lv{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 auto 10px;max-width:520px}
.gg-lv[hidden]{display:none}
.gg-lv-l{flex:none;font:700 var(--fs-note)/1.2 var(--f-text);color:var(--label2)}
.gg-lv-s{flex:1;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:3px;padding:3px;border-radius:14px;background:var(--fill)}
.gg-lv-b{min-width:0;min-height:40px;padding:0;border:0;border-radius:11px;background:none;color:var(--label);font:800 1rem/1 var(--f-round);cursor:pointer;
  -webkit-tap-highlight-color:transparent}
.gg-lv-b[aria-checked=true]{background:var(--navy);color:#fff;box-shadow:0 2px 0 rgba(0,0,0,.25)}
[data-theme=dark] .gg-lv-b[aria-checked=true]{background:#2f63b8}
.gg-lv-b:focus-visible{outline:3px solid var(--brand-tint);outline-offset:1px}
/* la tarjeta de la pregunta */
.gg-card{background:var(--card);border-radius:var(--r-card,20px);padding:12px 12px 14px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.gg-q.in{animation:gg-in .35s cubic-bezier(.2,.9,.3,1.2)}
@keyframes gg-in{from{opacity:0;transform:translateY(10px)}}
.gg-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:0 0 10px}
.gg-chip{display:inline-flex;align-items:center;gap:5px;max-width:100%;min-height:28px;padding:3px 11px;border-radius:999px;background:var(--brand-soft);color:var(--brand-ink);
  font:700 var(--fs-min,.8125rem)/1.2 var(--f-text);text-align:left}
.gg-chip .ico{flex:none}
.gg-chip.lv{background:var(--navy);color:#fff}
[data-theme=dark] .gg-chip.lv{background:#2f63b8}
.gg-ask{margin:0;text-align:center;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.gg kbd.gg-k{display:none;position:absolute;left:6px;top:5px;min-width:1.5em;height:1.5em;padding:0 .3em;border-radius:6px;border:1px solid rgba(60,60,67,.25);
  background:#E5E5EA;color:#3A3A3C;font:700 .72rem/1.5em var(--f-text);text-align:center;pointer-events:none}
:root[data-kbd] .gg kbd.gg-k{display:block}
/* lo que pasó y por qué */
.gg-fbw:empty{display:none}
.gg-fb{margin-top:12px;padding:12px 14px;border-radius:16px;background:var(--fill);color:var(--label);display:flex;flex-direction:column;gap:6px;animation:gg-in .3s both}
.gg-fb.ok{background:color-mix(in srgb,var(--gg-teal) 13%,var(--card))}
.gg-fb-h{display:flex;align-items:center;gap:10px;font:800 1.15rem/1.25 var(--f-round)}
.gg-fb-h b{flex:1;min-width:0}
.gg-fb-ic{flex:none;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;color:#fff;background:#8e8e93;font:900 1.05rem/1 var(--f-text)}
.gg-fb.ok .gg-fb-ic{background:var(--gg-teal)}
.gg-fb .gg-say{width:46px;height:46px}
.gg-fb-s{margin:0;font:800 1.15rem/1.3 var(--f-round);overflow-wrap:anywhere}
.gg-fb-es{margin:0;font:600 var(--fs-body,1.05rem)/1.35 var(--f-text);color:var(--label)}
.gg-fb-es::before{content:"Significa: ";font-weight:500;color:var(--label2)}
.gg-fb-why{margin:0;display:flex;gap:8px;align-items:flex-start;font:500 var(--fs-sub,1rem)/1.4 var(--f-text);color:var(--label)}
.gg-fb-why .ico{flex:none;margin-top:1px;color:var(--gold-ink)}
.gg-next{align-self:center;margin-top:6px}
.gg-dw .gm-dots{margin-top:12px}
/* Ordena la frase: los huecos (la frase) y las piezas de madera */
.gg-es{margin:2px 0 12px;text-align:center;font:800 clamp(1.25rem,5.6vw,1.65rem)/1.25 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.gg-line{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:10px 7px;min-height:72px;padding:12px 8px;border-radius:16px;background:var(--card-2,#F2F2F7)}
.gg-pool{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 8px;min-height:52px;margin:14px 0 2px}
.gg-pc,.gg-slot{position:relative;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:54px;max-width:100%;margin:0;padding:6px 14px;
  border-radius:12px;font:800 clamp(1.12rem,5vw,1.4rem)/1.15 var(--f-round);text-align:center;overflow-wrap:anywhere;cursor:pointer;
  -webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gg-pc{border:2px solid #6e4b2a;background:linear-gradient(180deg,#f6e2bf,#e5c38c);color:#2a1a0c;box-shadow:0 3px 0 #6e4b2a}
.gg-pc.used{visibility:hidden}
.gg-pc:focus-visible,.gg-slot:focus-visible,.gg-op:focus-visible,.gg-nt:focus-visible{outline:3px solid var(--brand-tint);outline-offset:3px}
@media (hover:hover){.gg-pool .gg-pc:not(.used):hover{transform:translateY(-2px)}}
.gg-slot{min-width:56px;border:2.5px dashed var(--sep);background:var(--card);color:var(--label);box-shadow:none}
.gg-slot.next{border-color:var(--brand-tint)}
.gg-slot.full{border:2px solid #6e4b2a;background:linear-gradient(180deg,#f6e2bf,#e5c38c);color:#2a1a0c;box-shadow:0 3px 0 #6e4b2a}
.gg-slot.good{border:3px solid var(--gg-teal);background:var(--gg-teal-soft);color:#00434e;box-shadow:none;cursor:default}
.gg-slot.win{border:2px solid var(--gg-teal-d);background:var(--gg-teal);color:#fff;box-shadow:0 3px 0 var(--gg-teal-d);animation:gg-hop .45s calc(var(--i,0) * 60ms) both}
.gg-slot.fix{border:3px dashed var(--gg-teal);background:var(--gg-teal-soft);color:#00434e;box-shadow:none}
.gg-slot.wrong{border:2px solid var(--miss);background:var(--miss-fill);color:var(--miss-on);box-shadow:none}
.gg-slot.wrong::after,.gg-op.no::after,.gg-nt.no::after{content:"✗";position:absolute;right:-8px;top:-8px;width:22px;height:22px;border-radius:50%;background:#8e8e93;color:#fff;
  font:900 .78rem/22px var(--f-text);text-align:center;box-shadow:0 0 0 2px var(--card)}
.gg-slot.drop{border-color:var(--brand-tint);transform:scale(1.08)}
@keyframes gg-hop{40%{transform:translateY(-7px)}}
.gg-acts{display:flex;justify-content:center;align-items:center;gap:10px;margin-top:14px}
.gg-acts .glass-btn{padding:0 18px}
.gg-acts #gg-chk{flex:1 1 auto;max-width:260px}
.gg-acts .glass-btn[disabled]{opacity:.5;cursor:default}
.gg-q.done .gg-pool,.gg-q.done .gg-acts{display:none}
/* Completa la frase: el tren */
.gg-track{position:relative;overflow:hidden;margin:0 0 14px;padding:12px 10px 14px;border-radius:18px;background:linear-gradient(180deg,#d4e7f6,#edf5fb)}
[data-theme=dark] .gg-track{background:linear-gradient(180deg,#0f2740,#173552)}
.gg-train{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:center;gap:18px 15px;transition:transform .7s cubic-bezier(.25,.8,.3,1)}
.gg-train.in{transform:translateX(-112%);transition:none}
.gg-train.go{transform:translateX(112%);transition:transform .55s cubic-bezier(.5,0,.9,.5)}
.gg-wg,.gg-loco{position:relative;flex:none;max-width:100%;padding-bottom:17px}
.gg-wb{box-sizing:border-box;display:flex;align-items:center;justify-content:center;min-height:clamp(48px,12vw,58px);min-width:62px;max-width:100%;padding:6px 12px;border:3px solid #000;
  border-radius:10px 10px 5px 5px;background:var(--c,#1f5fbf);color:#fff;font:800 clamp(1.05rem,4.6vw,1.45rem)/1.15 var(--f-round);text-align:center;overflow-wrap:anywhere}
/* las ruedas, el enganche y la vía */
.gg-wg::after{content:"";position:absolute;left:7px;right:7px;bottom:0;height:19px;
  background:radial-gradient(circle,#c7cdd4 0 3px,#1b1b1b 3.5px 7.5px,#000 8px 9px,transparent 9.5px) left center/19px 19px no-repeat,
    radial-gradient(circle,#c7cdd4 0 3px,#1b1b1b 3.5px 7.5px,#000 8px 9px,transparent 9.5px) right center/19px 19px no-repeat}
/* el enganche con el de delante (no en el primero de cada fila: .row0, lo pone rows()) */
.gg-wg:not(.row0)::before,.gg-loco:not(.row0)::before{content:"";position:absolute;left:-17px;bottom:22px;width:19px;height:6px;border-radius:3px;background:#000}
.gg-rl{position:absolute;left:-15px;right:0;bottom:-7px;height:7px;pointer-events:none;
  background:linear-gradient(#5d4b39,#5d4b39) top/100% 3px no-repeat,repeating-linear-gradient(90deg,#8a7458 0 5px,transparent 5px 13px) bottom/100% 4px no-repeat}
.row0>.gg-rl{left:-6px}
[data-theme=dark] .gg-rl{background:linear-gradient(#a8957c,#a8957c) top/100% 3px no-repeat,repeating-linear-gradient(90deg,#7d6a52 0 5px,transparent 5px 13px) bottom/100% 4px no-repeat}
.gg-loco{padding-bottom:0}
.gg-loco-svg{display:block;width:clamp(88px,25vw,128px);height:auto;margin-bottom:-1px}
.gg-train:not(.in):not(.go) .gg-steam{animation:gg-puff 1.6s ease-in-out infinite}
@keyframes gg-puff{50%{transform:translateY(-3px);opacity:.75}}
/* el vagón del hueco */
.gg-wg.gap .gg-wb{border-style:dashed;border-color:#2c3e50;background:rgba(255,255,255,.82);color:#14212e}
[data-theme=dark] .gg-wg.gap .gg-wb{border-color:#c7d2de;background:rgba(255,255,255,.1);color:#fff}
.gg-hole{display:inline-block;min-width:1.5em;margin:0 .1em;opacity:.7;font-weight:900}
.gg-hole::before{content:"?"}
.gg-wg.gap.ok .gg-wb{border:3px solid #000;background:var(--gg-teal);color:#fff;animation:gg-hop .45s}
.gg-wg.gap.fix .gg-wb{border:3px solid var(--gg-teal);background:var(--gg-teal-soft);color:#00434e}
/* las opciones */
.gg-opts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
@media (max-width:560px){.gg-opts.long{grid-template-columns:1fr}}
.gg-op{position:relative;display:flex;align-items:center;justify-content:center;flex-direction:column;min-width:0;min-height:66px;padding:10px 12px;border-radius:18px;
  border:3px solid var(--sep);background:var(--card);color:var(--label);font:800 clamp(1.1rem,4.9vw,1.4rem)/1.2 var(--f-round);text-align:center;overflow-wrap:anywhere;
  box-shadow:0 4px 0 var(--sep);cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
@media (hover:hover){.gg-op:not(:disabled):hover{border-color:var(--brand-tint)}}
.gg-op small{font:600 .78rem/1.2 var(--f-text);color:var(--label2)}
.gg-op:disabled{cursor:default}
.gg-op.ok{border-color:var(--gg-teal-d);background:var(--gg-teal);color:#fff;box-shadow:0 4px 0 var(--gg-teal-d)}
.gg-op.ok::after,.gg-nt.ok::after{content:"✓";position:absolute;right:-8px;top:-8px;width:24px;height:24px;border-radius:50%;background:var(--gg-teal);color:#fff;
  font:900 .85rem/24px var(--f-text);text-align:center;box-shadow:0 0 0 2px var(--card)}
.gg-op.lit{border-color:var(--gg-teal);background:var(--gg-teal-soft);color:#00434e;box-shadow:0 4px 0 var(--gg-teal)}
.gg-op.ok small,.gg-op.lit small{color:inherit}
.gg-op.no{border-color:var(--miss);background:var(--miss-fill);color:var(--miss-on);box-shadow:none}
.gg-op.dim{opacity:.55}
/* Detective de errores: la lupa y las tres notas */
.gg-case{display:flex;align-items:center;gap:12px;margin:0 0 12px}
.gg-lens{flex:none;width:clamp(72px,21vw,96px)}
.gg-lens-svg{display:block;width:100%;height:auto}
.gg-case.look .gg-lens{animation:gg-look .7s ease-in-out}
@keyframes gg-look{30%{transform:translate(6px,-4px) rotate(-8deg)}70%{transform:translate(-4px,2px) rotate(6deg)}}
.gg-case-t{display:block;font:800 clamp(1.2rem,5.2vw,1.5rem)/1.2 var(--f-round);color:var(--label)}
.gg-case-s{display:block;margin-top:2px;font:500 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.gg-notes{display:grid;gap:14px}
.gg-nt{position:relative;display:block;width:100%;min-height:60px;margin:0;padding:13px 14px 13px 50px;border:2px solid #c9b48a;border-radius:6px 6px 16px 6px;
  background:#fffbef;color:#1f1a12;text-align:left;font:700 clamp(1.05rem,4.6vw,1.25rem)/1.4 var(--f-text);overflow-wrap:anywhere;box-shadow:0 3px 0 #d9c9a3;
  transform:rotate(var(--r,0deg));cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.gg-nt:nth-child(1){--r:-.6deg}.gg-nt:nth-child(2){--r:.5deg}.gg-nt:nth-child(3){--r:-.3deg}
@media (hover:hover){.gg-nt:not(:disabled):hover{border-color:var(--brand-tint)}}
.gg-nt:disabled{cursor:default}
.gg-nt .gg-n{position:absolute;left:11px;top:50%;width:28px;height:28px;margin-top:-14px;border-radius:50%;background:#e9dcbd;color:#5b4a2a;border:2px solid #c9b48a;
  font:900 .92rem/24px var(--f-round);text-align:center}
.gg-nt mark{color:inherit;background:linear-gradient(transparent 60%,rgba(255,204,0,.55) 60%);padding:0 .06em;border-radius:2px}
.gg-nt mark.gg-none{display:inline-block;width:.9em;height:1em;margin-right:.25em;vertical-align:-.12em;background:none;border:2px dotted #a08850;border-radius:4px}
.gg-nt.ok{border-color:var(--gg-teal);background:#e6f6f8;color:#0d2f35;box-shadow:0 0 0 3px var(--gg-teal);transform:none}
.gg-nt.ok .gg-n{background:var(--gg-teal);border-color:var(--gg-teal-d);color:#fff}
.gg-nt.no{border-color:var(--miss);background:#ececee;color:#48484a;box-shadow:none}
.gg-nt.dim{opacity:.6}
[data-theme=dark] .gg-nt{background:#2b2720;border-color:#6b5a3a;color:#f4ecd8;box-shadow:0 3px 0 #4a3f2b}
[data-theme=dark] .gg-nt .gg-n{background:#4a3f2b;border-color:#6b5a3a;color:#f4ecd8}
[data-theme=dark] .gg-nt mark{background:linear-gradient(transparent 60%,rgba(255,214,0,.35) 60%)}
[data-theme=dark] .gg-nt.ok{background:#123c44;color:#fff}
[data-theme=dark] .gg-nt.no{background:var(--miss-fill);color:var(--miss-on)}
/* el fantasma de la pieza que se arrastra */
.gg-ghost{box-shadow:0 12px 24px rgba(0,0,0,.3)!important;rotate:-4deg}
/* pantallas bajitas */
@media (max-height:700px){.gg-card{padding:10px 10px 12px}.gg-es{margin-bottom:8px}.gg-pool{margin-top:10px}.gg-lv{margin-bottom:8px}.gg-lv-b{min-height:36px}}
@media (prefers-reduced-motion:reduce){.gg-q.in,.gg-fb,.gg-slot.win,.gg-wg.gap.ok .gg-wb,.gg-case.look .gg-lens,.gg-steam{animation:none!important}
  .gg-train,.gg-train.go{transition:none}}
`;
function css(){
  if(document.getElementById("css-grammargames")) return;
  const s = document.createElement("style"); s.id = "css-grammargames"; s.textContent = CSS; document.head.appendChild(s);
}

/* ---------- piezas comunes ---------- */
const lvRowHtml = cur => `<div class="gg-lv" id="gg-lv" role="radiogroup" aria-label="Nivel de gramática">
  <span class="gg-lv-l" aria-hidden="true">Nivel</span>
  <div class="gg-lv-s">${LVS.map(v => `<button type="button" role="radio" class="gg-lv-b" data-lv="${v}" aria-checked="${v === cur}" tabindex="${v === cur ? 0 : -1}">${v}</button>`).join("")}</div></div>`;
/* la fila del nivel: tocar uno (o ← →) lo elige, lo recuerda y empieza otra vez con ese nivel */
function wireLv(root, api, onPick){
  const box = root.querySelector("#gg-lv"); if(!box) return;
  const bs = [...box.querySelectorAll(".gg-lv-b")];
  const set = (b, focus) => {
    bs.forEach(x => { const on = x === b; x.setAttribute("aria-checked", on); x.tabIndex = on ? 0 : -1; });
    if(focus) try{ b.focus({preventScroll: true}); }catch(e){}
    lvSet(b.dataset.lv);
    onPick(b.dataset.lv);
  };
  bs.forEach(b => b.onclick = () => { if(b.getAttribute("aria-checked") === "true") return; api.haptic("selection"); api.snd("tap"); set(b, false); });
  box.addEventListener("keydown", e => {
    const i = bs.indexOf(document.activeElement); if(i < 0) return;
    const k = e.key, n = bs.length;
    const j = k === "ArrowRight" || k === "ArrowDown" ? (i + 1) % n : k === "ArrowLeft" || k === "ArrowUp" ? (i - 1 + n) % n : k === "Home" ? 0 : k === "End" ? n - 1 : -1;
    if(j < 0) return;
    e.preventDefault(); e.stopPropagation();
    if(j !== i){ api.haptic("selection"); set(bs[j], true); }
  });
}
const chipsHtml = (lv, u, showLv) => `<div class="gg-chips">${showLv ? `<span class="gg-chip lv">Nivel ${esc(lv)}</span>` : ""}<span class="gg-chip" title="El tema de gramática">${IC("book-open", "bold", 15)}${esc((u && u.t) || "")}</span></div>`;
function fbHtml(o){
  return `<div class="gg-fb ${o.ok ? "ok" : "no"}">
    <div class="gg-fb-h"><span class="gg-fb-ic" aria-hidden="true">${o.ok ? "✓" : "✗"}</span><b>${esc(o.title)}</b>${o.say ? `<button type="button" class="gm-say gg-say" id="gg-say" aria-label="Escuchar la frase">${IC("speaker-high", "fill", 22)}</button>` : ""}</div>
    ${o.sent ? `<p class="gg-fb-s" lang="${esc(code())}">${esc(o.sent)}</p>` : ""}
    ${o.es ? `<p class="gg-fb-es">${esc(o.es)}</p>` : ""}
    ${o.why ? `<p class="gg-fb-why">${IC("lightbulb", "fill", 20)}<span>${md(o.why)}</span></p>` : ""}
    ${o.next ? `<button type="button" class="glass-btn glass-btn--pri glass-btn--lg gg-next" id="gg-next" data-key="enter">${o.last ? "Ver el premio" : "Siguiente"}${IC("caret-right", "bold", 20)}</button>` : ""}</div>`;
}
/* teclas de la partida: los números pulsan [data-gk], Enter el [data-key~=enter] que se vea; extra(e) → true si la trató */
function useKeys(api, run, extra){
  api.keys(run, e => {
    if(e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const t = e.target;
    if(t && t.closest && t.closest("input,textarea,select")) return;
    if(extra && extra(e) === true){ e.preventDefault(); return; }
    const k = e.key === "Enter" ? "enter" : /^[1-9]$/.test(e.key) ? e.key : null;
    if(!k) return;
    const own = k === "enter" && t && t.closest ? t.closest("button,a") : null;
    if(own && !own.disabled) return;   /* el navegador ya pulsa el botón enfocado */
    const sel = k === "enter" ? '[data-key~="enter"]' : `[data-gk="${k}"]`;
    const el = [...run.root.querySelectorAll(sel)].find(x => !x.disabled && x.getClientRects().length && !x.classList.contains("used"));
    if(el){ e.preventDefault(); el.click(); }
  });
}
const emptyHtml = api => `<div class="gm"><div class="gm-empty"><p>Todavía no hay gramática de ${esc(api.nm())} para este juego.</p>
  <a class="glass-btn" href="#/juegos">${IC("caret-left", "bold", 18)}Juegos</a></div></div>`;
/* que se vea lo que acaba de salir (el porqué, debajo) sin mover la pantalla si ya se ve */
function reveal(el){
  if(!el || !el.isConnected) return;
  const r = el.getBoundingClientRect();
  if(r.bottom > innerHeight - 8) try{ el.scrollIntoView({block: "nearest", behavior: RM() ? "auto" : "smooth"}); }catch(e){}
}
const toTop = root => { if(root.getBoundingClientRect().top < 0) try{ window.scrollTo({top: 0, behavior: "auto"}); }catch(e){} };

/* el armazón de los tres juegos: carga, nivel, puntos, bolitas de progreso, siguiente y final.
   g = {id, cls, stats(n) → html de las pastillas, items(unidades) → preguntas, show(F) pinta F.list[F.qi] en F.q,
        leave?(F, go) (la salida animada), keys?(F, e) → true si trató la tecla, done(F) → {line}, words(F) → resultado} */
async function frame(app, api, mode, g){
  const my = api.nav(), L = lang;
  css();
  const G = await gram();
  if(!api.here(my, g.id) || lang !== L) return null;
  let lv = lvGet();
  let list = g.items(G[lv]);
  if(!list.length && lv !== "A1"){ lv = "A1"; list = g.items(G.A1); }
  if(!list.length){ app.innerHTML = emptyHtml(api); return null; }
  const run = api.mount(app, `<div class="gm gg ${g.cls}" id="gg">
    ${api.topHtml(g.id, g.stats(list.length))}
    ${lvRowHtml(lv)}
    <div class="gg-card"><div class="gg-q" id="gg-q"></div><div class="gg-fbw" id="gg-fbw" role="status" aria-live="polite"></div></div>
    <div class="gg-dw" id="gg-dw">${api.dotsHtml(list.length)}</div></div>`, mode);
  const root = run.root;
  const F = {run, root, api, G, lv, list, qi: 0, score: 0, res: [], locked: false, started: false,
    q: root.querySelector("#gg-q"), fbw: root.querySelector("#gg-fbw"), cur: null};
  root.ggLv = lv;
  F.paintDots = () => root.querySelectorAll("#gm-dots i").forEach((d, i) => { d.className = i < F.res.length ? F.res[i] : i === F.qi ? "now" : ""; });
  F.setScore = () => { const sc = root.querySelector("#gm-sc"); if(sc){ sc.textContent = F.score; api.bump(sc.parentNode); } };
  F.setN = () => { const n = root.querySelector("#gg-n"); if(n) n.textContent = Math.min(F.qi + 1, F.list.length); const t = root.querySelector("#gg-nt"); if(t) t.textContent = F.list.length; };
  F.chips = u => chipsHtml(F.lv, u, F.locked);
  /* al contestar la primera: el nivel se queda (la fila se va y sale la pastilla) */
  F.lock = () => {
    if(F.locked) return;
    F.locked = true;
    const row = root.querySelector("#gg-lv"); if(row) row.hidden = true;
    const ch = F.q.querySelector(".gg-chips");
    if(ch) ch.insertAdjacentHTML("afterbegin", `<span class="gg-chip lv">Nivel ${esc(F.lv)}</span>`);
  };
  F.fb = o => {
    F.fbw.innerHTML = fbHtml(Object.assign({last: F.qi + 1 >= F.list.length}, o));
    const nx = F.fbw.querySelector("#gg-next"); if(nx) nx.onclick = () => F.next();
    const sy = F.fbw.querySelector("#gg-say"); if(sy) sy.onclick = () => api.speak(spoken(o.sayText || o.sent || ""));
    if(nx && api.kbd()) try{ nx.focus({preventScroll: true}); }catch(e){}
    reveal(F.fbw.firstElementChild);
  };
  /* tras un acierto, sigue solo (con tiempo para leer el porqué); tras un fallo, con «Siguiente» */
  F.auto = (chars = 0) => { const c = F.cur; api.later(run, () => { if(F.cur === c) F.next(); }, Math.min(6500, 2800 + 30 * chars)); };
  /* lo que deja la pregunta al irse (los arrastres de Ordena) */
  F.dispose = () => { const c = F.cur; if(c && c.offs){ c.offs.splice(0).forEach(f => { try{ f(); }catch(e){} }); } };
  /* la tarjeta nueva entra con un saltito (sin él con «Reducir movimiento») */
  F.enter = () => { F.q.classList.remove("in"); if(!RM()){ void F.q.offsetWidth; F.q.classList.add("in"); } };
  F.next = () => {
    const c = F.cur;
    if(!c || !c.done || c.leaving) return;
    c.leaving = true;
    const last = F.qi + 1 >= F.list.length;
    const go = () => { F.dispose(); if(last){ F.end(); return; } F.qi++; F.render(); };
    if(g.leave) g.leave(F, go); else go();
  };
  F.render = () => {
    F.fbw.innerHTML = "";
    F.setN(); F.paintDots();
    g.show(F);
    toTop(root);
  };
  F.end = () => {
    const n = F.list.length, o = g.done(F);
    api.finish(run, g.id, {score: F.score, stars: starsOf(F.score, n), words: g.words(F), line: o.line});
  };
  wireLv(root, api, v => {
    if(F.locked) return;
    const nl = g.items(G[v]);
    if(!nl.length) return;
    F.dispose();
    F.lv = v; F.list = nl; F.qi = 0; F.score = 0; F.res = []; F.cur = null;
    root.ggLv = v;
    root.querySelector("#gg-dw").innerHTML = api.dotsHtml(nl.length);
    const sc = root.querySelector("#gm-sc"); if(sc) sc.textContent = "0";
    F.render();
  });
  F.render();
  api.intro(run, g.id, () => { F.started = true; useKeys(api, run, g.keys ? e => g.keys(F, e) : null); if(g.go) g.go(F); });
  return F;
}

/* =====================================================================
   1. ORDENA LA FRASE
   ===================================================================== */
const ordena = (app, api, mode) => frame(app, api, mode, {
  id: ORD, cls: "gg-of",
  stats: n => `<span class="gm-pill" title="Frase">${IC("text-aa", "bold", 18)}<span><b id="gg-n">1</b>/<span id="gg-nt">${n}</span></span></span><span class="gm-pill" title="A la primera">${IC("star", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`,
  items: units => mix(units, u => (u.ex || []).filter(e => e && typeof e.t === "string" && typeof e.es === "string")
    .map(e => ({t: e.t.trim(), es: e.es, p: pieces(e.t)})).filter(e => e.p.length >= 3 && e.p.length <= 9 && new Set(e.p).size > 1), 8)
    .map(({x, u}) => Object.assign({u}, x)),
  show(F){
    const {api, run, root} = F, it = F.list[F.qi], ans = it.p, c = code();
    let order = shuf(ans.map((_, i) => i)), k = 0;
    while(order.every((v, i) => ans[v] === ans[i]) && k++ < 12) order = shuf(order);
    const S = F.cur = {it, ans, tiles: order.map(i => ({w: ans[i], at: -1})), slots: ans.map(() => -1), lock: ans.map(() => ""), tries: 0, done: false, busy: false, offs: []};
    root.ggAns = ans;
    F.enter();
    F.q.innerHTML = `${F.chips(it.u)}
      <p class="gg-ask">Ordena las piezas para decir:</p>
      <p class="gg-es" lang="es">${esc(it.es)}</p>
      <div class="gg-line" id="gg-line" role="group" aria-label="Tu frase">${ans.map((_, i) => `<button type="button" class="gg-slot" data-s="${i}" lang="${esc(c)}" aria-label="Hueco ${i + 1}"></button>`).join("")}</div>
      <div class="gg-pool" id="gg-pool" role="group" aria-label="Piezas">${S.tiles.map((t, i) => `<button type="button" class="gg-pc" data-t="${i}" data-gk="${i + 1}" lang="${esc(c)}"><kbd class="gg-k" aria-hidden="true">${i + 1}</kbd>${esc(t.w)}</button>`).join("")}</div>
      <div class="gg-acts"><button type="button" class="glass-btn" id="gg-del" aria-label="Quitar la última pieza">${IC("arrow-counter-clockwise", "bold", 20)}Quitar</button>
        <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="gg-chk" data-key="enter" disabled>${IC("check", "bold", 20)}Comprobar</button></div>`;
    const slotEls = [...F.q.querySelectorAll(".gg-slot")], tileEls = [...F.q.querySelectorAll(".gg-pc")];
    tileEls.forEach((el, i) => { el.ggW = S.tiles[i].w; });
    const chk = F.q.querySelector("#gg-chk");
    const paint = () => {
      const nextFree = S.slots.indexOf(-1);
      slotEls.forEach((el, i) => {
        const ti = S.slots[i];
        el.textContent = ti >= 0 ? S.tiles[ti].w : "";
        el.className = "gg-slot" + (ti >= 0 && !S.lock[i] ? " full" : "") + (S.lock[i] ? " " + S.lock[i] : "") + (!S.done && !S.busy && i === nextFree ? " next" : "");
        el.setAttribute("aria-label", ti >= 0 ? `Hueco ${i + 1}: ${S.tiles[ti].w}` : `Hueco ${i + 1}, vacío`);
      });
      tileEls.forEach((el, i) => { el.classList.toggle("used", S.tiles[i].at >= 0); el.disabled = S.done || S.tiles[i].at >= 0; });
      chk.disabled = S.done || S.busy || S.slots.some(v => v < 0);
      F.q.classList.toggle("done", S.done);   /* resuelta: sin piezas ni botones, solo la frase y el porqué */
    };
    const place = (ti, k) => {
      if(!F.started || S.done || S.busy || !S.tiles[ti] || S.tiles[ti].at >= 0) return false;
      if(k === undefined || k < 0 || S.lock[k]) k = S.slots.indexOf(-1);
      if(k < 0) return false;
      if(S.slots[k] >= 0) S.tiles[S.slots[k]].at = -1;
      S.slots[k] = ti; S.tiles[ti].at = k;
      api.snd("tap"); api.haptic("selection"); paint();
      if(S.slots.every(v => v >= 0) && api.kbd()) try{ chk.focus({preventScroll: true}); }catch(e){}
      return true;
    };
    const unplace = k => {
      if(S.done || S.busy || k < 0 || S.lock[k] || S.slots[k] < 0) return false;
      S.tiles[S.slots[k]].at = -1; S.slots[k] = -1; return true;
    };
    const erase = () => { for(let k = S.slots.length - 1; k >= 0; k--) if(unplace(k)){ api.snd("whoosh"); paint(); return true; } return false; };
    S.erase = erase;
    const check = () => {
      if(S.done || S.busy || S.slots.some(v => v < 0)) return;
      F.lock();
      const bad = S.ans.map((w, k) => S.tiles[S.slots[k]].w !== w);
      const sum = it.u && it.u.sum;
      if(!bad.some(Boolean)){
        S.done = true;
        const first = !S.tries;
        if(first){ F.score++; api.answer(true, {es: it.es, word: it.t}); F.setScore(); }
        F.res[F.qi] = first ? "ok" : "meh";
        S.lock = S.lock.map(() => "win"); paint();
        slotEls.forEach((el, i) => el.style.setProperty("--i", i));
        api.snd("ok"); api.haptic("success");
        api.speak(spoken(it.t));
        F.paintDots();
        F.fb({ok: true, title: first ? "¡Perfecto!" : "¡Muy bien!", say: true, sayText: it.t, why: sum, next: true});
        F.auto(String(sum || "").length);
        return;
      }
      S.tries++; S.busy = true;
      api.snd("tap");
      if(S.tries === 1) api.answer(false, {es: it.es, word: it.t});
      bad.forEach((b, k) => { if(!b) S.lock[k] = "good"; });
      paint();
      bad.forEach((b, k) => { if(b) slotEls[k].classList.add("wrong"); });
      if(S.tries === 1){
        F.fb({ok: false, title: "Casi. Las grises van en otro sitio: ¡prueba otra vez!"});
        api.later(run, () => {
          if(F.cur !== S) return;
          S.busy = false; bad.forEach((b, k) => { if(b) unplace(k); }); paint();
        }, 900);
        return;
      }
      /* a la segunda: la respuesta (las que faltaban, con borde turquesa) */
      api.later(run, () => {
        if(F.cur !== S) return;
        S.busy = false; S.done = true;
        F.res[F.qi] = "meh"; F.paintDots();
        S.tiles.forEach(t => { t.at = -1; });
        const free = S.tiles.map((t, i) => i);
        S.ans.forEach((w, k) => { const j = free.findIndex(i => S.tiles[i].w === w); const ti = free.splice(j, 1)[0]; S.slots[k] = ti; S.tiles[ti].at = k; S.lock[k] = bad[k] ? "fix" : "good"; });
        paint();
        api.speak(spoken(it.t));
        F.fb({ok: false, title: "Así se dice:", say: true, sent: it.t, why: sum, next: true});
      }, 900);
    };
    S.check = check;
    /* tocar: una pieza va al primer hueco libre; una puesta vuelve abajo */
    tileEls.forEach((el, i) => { el.onclick = () => place(i); });
    slotEls.forEach((el, k) => { el.onclick = () => { if(F.started && unplace(k)){ api.snd("whoosh"); paint(); } }; });
    F.q.querySelector("#gg-del").onclick = () => { if(F.started) erase(); };
    chk.onclick = check;
    /* arrastrar (G.drag de js/gestures.js): una pieza a un hueco; una puesta, a otro hueco (se cambian) o abajo */
    if(window.G && typeof G.drag === "function"){
      let over = null;
      const setOver = s => { if(over === s) return; if(over) over.classList.remove("drop"); over = s; if(s) s.classList.add("drop"); };
      const slotAt = d => { const s = d.over && d.over.closest ? d.over.closest(".gg-slot") : null; return s && slotEls.includes(s) && !S.lock[+s.dataset.s] ? s : null; };
      tileEls.forEach((el, i) => S.offs.push(G.drag(el, {
        ghost: x => { const gh = x.cloneNode(true); gh.classList.add("gg-ghost"); gh.querySelectorAll("kbd").forEach(k => k.remove()); return gh; },
        onStart: () => { if(!F.started || S.done || S.busy || S.tiles[i].at >= 0 || run.paused) return false; api.haptic("selection"); },
        onMove: d => setOver(slotAt(d)),
        onDrop: d => { const s = slotAt(d); setOver(null); return s ? place(i, +s.dataset.s) : false; },
        onCancel: () => setOver(null),
      })));
      slotEls.forEach((el, k) => S.offs.push(G.drag(el, {
        ghost: x => { const gh = x.cloneNode(true); gh.classList.add("gg-ghost"); return gh; },
        onStart: () => { if(!F.started || S.done || S.busy || S.slots[k] < 0 || S.lock[k] || run.paused) return false; api.haptic("selection"); },
        onMove: d => setOver(slotAt(d)),
        onDrop: d => {
          const s = slotAt(d); setOver(null);
          const pool = d.over && d.over.closest ? d.over.closest(".gg-pool") : null;
          if(s && +s.dataset.s !== k){ const j = +s.dataset.s, a = S.slots[k], b = S.slots[j]; S.slots[j] = a; S.tiles[a].at = j; S.slots[k] = b; if(b >= 0) S.tiles[b].at = k; api.snd("tap"); paint(); return true; }
          if(pool && unplace(k)){ api.snd("whoosh"); paint(); return true; }
          return false;
        },
        onCancel: () => setOver(null),
      })));
      run.clean.push(() => S.offs.splice(0).forEach(f => { try{ f(); }catch(e){} }));
    }
    paint();
  },
  keys(F, e){
    const S = F.cur; if(!S) return false;
    if(e.key === "Backspace" && !S.done){ S.erase(); return true; }
    return false;
  },
  done: F => ({line: F.score ? `¡${F.list.length} frases en orden! ${F.score} a la primera.` : "¡Muy bien! La próxima vez, más a la primera."}),
  words: F => F.list.map((it, i) => ({word: it.t, es: it.es, img: "", miss: F.res[i] !== "ok"})),
});

/* =====================================================================
   2. COMPLETA LA FRASE (el tren)
   ===================================================================== */
const qItems = (units, n) => mix(units, u => (u.q || []).filter(okQ), n).map(({x, u}) => Object.assign({u, q: x}, three(x)));
/* los vagones: una palabra en cada uno (con más de 7, de 2 o 3 en 3 hasta ~13 letras); el hueco va solo, con lo que lleva pegado */
function wagons(s){
  const ps = pieces(s), gi = ps.findIndex(p => p.includes("___"));
  const group = arr => {
    if(ps.length <= 7) return arr.map(p => [p]);
    const out = [];
    for(const p of arr){
      const last = out[out.length - 1];
      if(last && last.length < 3 && (last.join(" ") + " " + p).length <= 13) last.push(p); else out.push([p]);
    }
    return out;
  };
  const before = group(ps.slice(0, gi)), after = group(ps.slice(gi + 1));
  const [pre, post] = (ps[gi] || "___").split("___");
  return {before: before.map(a => a.join(" ")), gap: {pre, post}, after: after.map(a => a.join(" "))};
}
const optLabel = o => NONE(o) ? `–<small>(nada)</small>` : esc(o);
/* el primero de cada fila del tren (sin enganche delante): los de una fila acaban a la misma altura */
function rows(t){
  if(!t || !t.isConnected) return;
  let last = null;
  [...t.children].forEach(el => { const b = el.offsetTop + el.offsetHeight; el.classList.toggle("row0", last === null || Math.abs(b - last) > 4); last = b; });
}
const completa = (app, api, mode) => frame(app, api, mode, {
  id: COM, cls: "gg-co",
  stats: n => `<span class="gm-pill" title="Frase">${IC("text-aa", "bold", 18)}<span><b id="gg-n">1</b>/<span id="gg-nt">${n}</span></span></span><span class="gm-pill" title="Aciertos">${IC("star", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`,
  items: units => qItems(units, 10),
  show(F){
    const it = F.list[F.qi], c = code(), W = wagons(it.q.s);
    const S = F.cur = {it, done: false};
    let ci = Math.floor(Math.random() * WAGONS.length);
    const wg = t => `<div class="gg-wg" style="--c:${WAGONS[ci++ % WAGONS.length]}"><div class="gg-wb">${esc(t)}</div><i class="gg-rl"></i></div>`;
    const long = it.o.some(o => o.length > 9);   /* y fitOps mira si alguna palabra no cabe entera */
    F.q.classList.remove("in");
    F.q.innerHTML = `${F.chips(it.u)}
      <div class="gg-track" id="gg-track"><div class="gg-train${RM() ? "" : " in"}" id="gg-train" lang="${esc(c)}" role="group" aria-label="La frase">
        ${W.before.map(wg).join("")}
        <div class="gg-wg gap" id="gg-gap"><div class="gg-wb">${esc(W.gap.pre)}<span class="gg-hole"><span class="vh" lang="es">hueco</span></span>${esc(W.gap.post)}</div><i class="gg-rl"></i></div>
        ${W.after.map(wg).join("")}
        <div class="gg-loco">${LOCO}<i class="gg-rl"></i></div></div></div>
      <p class="gg-ask" id="gg-ask">¿Qué palabra va en el vagón vacío?</p>
      <div class="gg-opts${long ? " long" : ""}" id="gg-opts" data-long="${long ? 1 : 0}" role="group" aria-labelledby="gg-ask" style="margin-top:8px">${it.o.map((o, i) => `<button type="button" class="gg-op" data-o="${i}" data-gk="${i + 1}" lang="${esc(c)}"${NONE(o) ? ' aria-label="Nada"' : ""}><kbd class="gg-k" aria-hidden="true">${i + 1}</kbd><span>${optLabel(o)}</span></button>`).join("")}</div>`;
    const train = F.q.querySelector("#gg-train");
    rows(train); fitOps(F.q.querySelector("#gg-opts"));
    if(!F.rowsOn){
      F.rowsOn = true;
      const onR = () => { rows(F.q.querySelector("#gg-train")); fitOps(F.q.querySelector("#gg-opts")); };
      addEventListener("resize", onR); F.run.clean.push(() => removeEventListener("resize", onR));
    }
    api.later(F.run, () => { rows(train); fitOps(F.q.querySelector("#gg-opts")); }, 250);
    if(train.classList.contains("in")) requestAnimationFrame(() => requestAnimationFrame(() => train.classList.remove("in")));
    const ops = [...F.q.querySelectorAll(".gg-op")];
    ops.forEach((b, i) => { b.ggOk = i === it.a; b.onclick = () => choose(i); });
    const choose = k => {
      if(!F.started || S.done || F.run.paused) return;
      S.done = true; F.lock();
      const ok = k === it.a, right = it.o[it.a], R = fill(it.q.s, right);
      ops.forEach((b, i) => { b.disabled = true; b.classList.add(i === it.a ? (ok ? "ok" : "lit") : i === k ? "no" : "dim"); });
      const gap = F.q.querySelector("#gg-gap");
      gap.classList.add(ok ? "ok" : "fix");
      const hole = gap.querySelector(".gg-hole");
      if(hole) hole.outerHTML = `<b class="gg-fillw">${NONE(right) ? "–" : esc(right)}</b>`;
      api.speak(spoken(R.full));
      if(ok){
        F.score++; F.setScore(); F.res[F.qi] = "ok";
        api.answer(true, {es: it.q.es, word: R.full});
        api.snd("ok"); api.haptic("success");
        F.fb({ok: true, title: "¡Muy bien!", say: true, sayText: R.full, es: it.q.es, why: it.q.why, next: true});
        F.auto(String(it.q.why || "").length + String(it.q.es || "").length);
      } else {
        F.res[F.qi] = "meh";
        api.answer(false, {es: it.q.es, word: R.full});
        api.snd("tap");
        F.fb({ok: false, title: NONE(right) ? "Casi. Aquí no va nada." : `Casi. Va «${right}».`, say: true, sayText: R.full, es: it.q.es, why: it.q.why, next: true});
      }
      F.paintDots();
    };
  },
  /* el tren se va por la derecha y llega el siguiente por la izquierda */
  leave(F, go){
    const t = F.q.querySelector("#gg-train");
    if(!t || RM()){ go(); return; }
    t.classList.add("go");
    F.api.later(F.run, go, 520);
  },
  done: F => ({line: `¡${F.score} de ${F.list.length} vagones llenos a la primera!`}),
  words: F => F.list.map((it, i) => ({word: fill(it.q.s, it.o[it.a]).full, es: it.q.es, img: "", miss: F.res[i] !== "ok"})),
});

/* =====================================================================
   3. DETECTIVE DE ERRORES
   ===================================================================== */
const noteHtml = (s, o) => { const f = fill(s, o); return `${esc(f.pre)}${f.none ? `<mark class="gg-none" aria-hidden="true"></mark>` : `<mark>${esc(f.mid)}</mark>`}${esc(f.post)}`; };
const detective = (app, api, mode) => frame(app, api, mode, {
  id: DET, cls: "gg-dt",
  stats: n => `<span class="gm-pill" title="Caso">${IC("magnifying-glass", "bold", 18)}<span><b id="gg-n">1</b>/<span id="gg-nt">${n}</span></span></span><span class="gm-pill" title="Resueltos">${IC("star", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`,
  items: units => qItems(units, 10),
  show(F){
    const it = F.list[F.qi], c = code();
    const S = F.cur = {it, done: false};
    F.enter();
    F.q.innerHTML = `${F.chips(it.u)}
      <div class="gg-case" id="gg-case"><span class="gg-lens">${LENS}</span><span><b class="gg-case-t" id="gg-case-t">¿Cuál está bien?</b>
        <span class="gg-case-s">${it.q.es ? `Quiere decir: «${esc(it.q.es)}»` : "Solo una de las tres frases está bien. ¡Encuéntrala!"}</span></span></div>
      <div class="gg-notes" role="group" aria-labelledby="gg-case-t">${it.o.map((o, i) => `<button type="button" class="gg-nt" data-o="${i}" data-gk="${i + 1}" lang="${esc(c)}" aria-label="${esc(fill(it.q.s, o).full)}"><span class="gg-n" aria-hidden="true">${i + 1}</span>${noteHtml(it.q.s, o)}</button>`).join("")}</div>`;
    const notes = [...F.q.querySelectorAll(".gg-nt")];
    notes.forEach((b, i) => { b.ggOk = i === it.a; b.onclick = () => choose(i); });
    const choose = k => {
      if(!F.started || S.done || F.run.paused) return;
      S.done = true; F.lock();
      const ok = k === it.a, R = fill(it.q.s, it.o[it.a]);
      notes.forEach((b, i) => { b.disabled = true; b.classList.add(i === it.a ? "ok" : i === k ? "no" : "dim"); });
      const cs = F.q.querySelector("#gg-case"); if(cs && !RM()) cs.classList.add("look");
      api.speak(spoken(R.full));
      if(ok){
        F.score++; F.setScore(); F.res[F.qi] = "ok";
        api.answer(true, {es: it.q.es, word: R.full});
        api.snd("ok"); api.haptic("success");
        F.fb({ok: true, title: "¡Caso resuelto!", say: true, sayText: R.full, es: it.q.es, why: it.q.why, next: true});
        F.auto(String(it.q.why || "").length + String(it.q.es || "").length);
      } else {
        F.res[F.qi] = "meh";
        api.answer(false, {es: it.q.es, word: R.full});
        api.snd("tap");
        F.fb({ok: false, title: `Casi. La buena es la ${it.a + 1}.`, say: true, sayText: R.full, es: it.q.es, why: it.q.why, next: true});
      }
      F.paintDots();
    };
  },
  done: F => ({line: `¡Resolviste ${F.score} de ${F.list.length} casos!`}),
  words: F => F.list.map((it, i) => ({word: fill(it.q.s, it.o[it.a]).full, es: it.q.es, img: "", miss: F.res[i] !== "ok"})),
});

/* ---------- a Juegos ---------- */
const reg = (id, def) => window.vocabGames && typeof vocabGames.register === "function" && vocabGames.register(id, Object.assign({words: "Gramática", sec: "gramatica", fresh: true}, def));
if(!reg(ORD, {
  t: "Ordena la frase", sub: "Pon las palabras en orden", img: "img/games/ordenafrase.png",
  how: "Lee lo que significa la frase. Toca las piezas en orden (o arrástralas) y pulsa «Comprobar». Si una está mal, se pone gris y tienes otra oportunidad.",
  rec: b => `${num(b.score)} a la primera`,
  start: ordena,
})) console.warn("[grammargames] no se pudo añadir «Ordena la frase» a Juegos");
if(!reg(COM, {
  t: "Completa la frase", sub: "Llena el vagón vacío", img: "img/games/completa.png",
  how: "Al tren le falta una palabra. Elige la que va en el vagón vacío (o pulsa 1, 2 o 3). Si aciertas, ¡el tren arranca!",
  rec: b => `${num(b.score)} de 10`,
  start: completa,
})) console.warn("[grammargames] no se pudo añadir «Completa la frase» a Juegos");
if(!reg(DET, {
  t: "Detective de errores", sub: "¿Qué frase está bien?", img: "img/games/detective.png",
  how: "Hay tres frases y solo una está bien. Debajo de la lupa ves lo que quiere decir. ¡Búscala! Tócala o pulsa 1, 2 o 3.",
  rec: b => `${num(b.score)} de 10 casos`,
  start: detective,
})) console.warn("[grammargames] no se pudo añadir «Detective de errores» a Juegos");
})();
