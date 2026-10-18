/* Teclado de toda la app (plan-doc §Teclado, SPEC §5 F5). Un solo oyente de keydown en window, en fase de burbuja: va
   después de los oyentes de cada elemento y de document (también de los document.onkeydown de cada pantalla), así que
   una pantalla que ya trata una tecla gana siempre.

   Qué hace cada tecla
     Espacio         oír la palabra                 Mayús+Espacio   oírla despacio
     Enter           el botón principal             ← / →           anterior / siguiente (en el repaso, No / ¡Sí!)
     1 - 4           elegir una opción (en Hoy, abrir el atajo N de «Tus atajos»)
     Esc             atrás o cerrar (una hoja abierta la cierra el navegador; en una partida, la pausa de games.js)
     ?               la hoja «Teclas» con esta tabla

   Declarativo: un botón dice qué tecla lo pulsa con data-key="<tecla>[ <tecla>…]", con las teclas
     space | shift+space | enter | left | right | 1 | 2 | 3 | 4 | esc | ?
   La primera es la que sale en su etiqueta (data-key-label="…" cambia el texto; data-key-pos="in" la pone dentro, arriba
   a la derecha, en vez de en el borde de abajo; data-key-pos="top", sobre el borde de arriba, como en los botones
   redondos de icono, que la llevan así sin pedirlo; data-key-pos="right", a su derecha si cabe). Al pulsar una tecla, keys.js hace click() en el primer elemento (orden
   del DOM) con esa tecla que se vea y esté habilitado en la capa de arriba: el dialog modal abierto (el que tiene el
   foco) o, si no hay ninguno, la pantalla. En una hoja, su «Listo» de cabecera (.m-head-x) cuenta como data-key="esc".

   No hace nada (deja la tecla al navegador o a la pantalla):
   · si alguien ya la trató (e.defaultPrevented) o la paró (stopPropagation);
   · con Ctrl, Alt o Meta, con la tecla repetida (mantenerla pulsada) o escribiendo (input, select, textarea,
     contenteditable);
   · Enter con el foco en un botón, enlace o summary, y Espacio en un botón o summary: el navegador ya hace el click
     (nunca dos veces);
   · si mientras se trataba la tecla se abrió o se cerró una hoja (alguien la usó), o con un menú abierto
     ([role=menu]: idioma, nivel), que lleva sus propias teclas;
   · dentro de un contenedor [data-key-own]: esas teclas son de la pantalla (vacío = todas; o una lista,
     data-key-own="space enter"); keys.js solo pone las etiquetas de sus botones;
   · en una partida (html[data-gm-play]) solo atiende Esc y ?: las demás son del juego;
   · Esc con una hoja o un menú abiertos: el navegador cierra el dialog (cancel, que M.openSheet anima) o el menú se
     cierra con su oyente.
   Cómo una pantalla toma una tecla para sí: e.preventDefault() en su oyente (de document o del elemento; keys.js va
   después), o data-key-own en su contenedor.
   Sin un data-key="shift+space" a la vista, Mayús+Espacio dice despacio (say(texto, botón, true)) el data-say del botón
   de "space". "?" pulsa el data-key="?" que haya (en las partidas, «Cómo se juega»); si no hay, abre o cierra la hoja
   «Teclas» (nunca encima de otra hoja ni durante una partida).

   Etiquetas: la primera tecla de verdad (no Mayús/Ctrl/Alt/Meta sueltas, y no escribiendo en un campo) pone
   html[data-kbd]; el siguiente toque o clic real (pointerdown de verdad) lo quita. Con html[data-kbd], cada botón que
   pulsaría una tecla lleva una <kbd class="kb-tag"> gris (aria-hidden; el texto va en ::before para no cambiar el
   textContent del botón) en posición absoluta, así que no cambia su tamaño. Va en el borde de abajo (en los botones
   redondos de icono, más pequeña y sobre el borde de arriba); si ahí tocaría otro botón, un texto, otra tarjeta u otra
   etiqueta (con 4 px de aire) o se saldría de la pantalla, pasa encima, a la derecha o a la izquierda, y si no, dentro
   del botón a la derecha (donde no llega su texto); las de un mismo grupo se alinean en una línea. Un botón que ya
   trae su propia <kbd> (las opciones de la lección, Preguntas y la temporada) no lleva otra. html[data-kbd] es el mismo que leen lesson.js
   (kbdMode), learn.js (.ln-kbd) y season.js (.ss-k).

   window.vocabKeys = {help(from?) → dialog, closeHelp(), target(tecla) → Element | null, token(evento) → tecla | null,
     refresh(), get kbd() → boolean, KEYS}. */
(() => {
"use strict";
const W = window, D = document, ROOT = D.documentElement;
const KEYS = Object.freeze(["esc", "enter", "space", "shift+space", "left", "right", "1", "2", "3", "4", "?"]);
const LABEL = {esc: "Esc", enter: "Enter", space: "Espacio", "shift+space": "⇧ Espacio", left: "←", right: "→", "?": "?"};
const ARIA = {esc: "Escape", enter: "Enter", space: "Space", "shift+space": "Shift+Space", left: "ArrowLeft", right: "ArrowRight", "?": "Shift+?"};
/* teclas que no cuentan como «usar el teclado» */
const MODS = new Set(["Shift", "Control", "Alt", "AltGraph", "Meta", "OS", "Super", "Hyper", "CapsLock", "NumLock", "ScrollLock",
  "Fn", "FnLock", "Dead", "Process", "Unidentified", ""]);
/* lo que cuenta como data-key sin llevarlo, dentro de una hoja abierta */
const IMPLICIT = {esc: ".m-head-x"};

const CSS = `
/* la etiqueta de la tecla: gris y sólida, en el borde de abajo del botón (la mitad fuera); no cambia su tamaño */
.kb-pos{position:relative}
.kb-host{overflow:visible!important}
kbd.kb-tag{position:absolute;z-index:3;left:50%;bottom:0;top:auto;right:auto;transform:translate(-50%,55%);margin:0;
  display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-width:1.8em;height:1.6em;padding:0 .4em;
  border-radius:6px;border:1px solid rgba(60,60,67,.2);background:#E5E5EA;color:#3A3A3C;box-shadow:0 1px 2px rgba(0,0,0,.18);
  font:600 var(--fs-min,.8125rem)/1 var(--f-text,system-ui);letter-spacing:0;text-transform:none;white-space:nowrap;
  pointer-events:none;-webkit-user-select:none;user-select:none;animation:kb-in var(--d-fast,160ms) ease-out}
kbd.kb-tag::before{content:attr(data-k)}
[data-key-pos=in]>kbd.kb-tag{left:auto;bottom:auto;top:8px;right:8px;transform:none}
/* dónde va cuando abajo tocaría algo (keys.js lo mira): encima, a la derecha o a la izquierda del botón */
kbd.kb-tag[data-pos=t]{top:0;bottom:auto;transform:translate(-50%,-55%)}
kbd.kb-tag[data-pos=r]{left:100%;top:50%;bottom:auto;transform:translate(4px,-50%)}
kbd.kb-tag[data-pos=l]{left:auto;right:100%;top:50%;bottom:auto;transform:translate(-4px,-50%)}
/* y si alrededor no hay sitio, dentro del botón, a la derecha (en los anchos, donde no llega el texto) */
kbd.kb-tag[data-pos=i]{left:auto;right:12px;top:50%;bottom:auto;transform:translateY(-50%)}
/* en los botones redondos de icono (altavoz, tortuga, micrófono, ✕), un poco más pequeña y sobre el borde de arriba */
kbd.kb-tag.kb-sm{min-width:1.7em;height:1.5em;padding:0 .35em;border-radius:5px;font-size:11px}
:root[data-theme=dark] kbd.kb-tag{border-color:rgba(255,255,255,.16);background:#48484A;color:#F2F2F7;box-shadow:0 1px 2px rgba(0,0,0,.5)}
@keyframes kb-in{from{opacity:0}}
@media (prefers-reduced-motion:reduce){kbd.kb-tag{animation:none}}
@media (forced-colors:active){kbd.kb-tag{border-color:CanvasText;background:Canvas;color:CanvasText}}

/* la hoja «Teclas» */
dialog.kb-sh{max-width:560px}
.kb-sub{margin:0 0 16px;font:400 var(--fs-note,.9375rem)/1.35 var(--f-text,system-ui);color:var(--label2);text-align:center}
.kb-rows{list-style:none;margin:0 0 12px;padding:0;background:var(--card);border-radius:var(--r-card,24px);overflow:hidden}
:root[data-theme=dark] .kb-rows{background:var(--card-2)}
/* como en iPadOS: la acción a la izquierda y sus teclas alineadas a la derecha */
.kb-row{position:relative;display:grid;grid-template-columns:minmax(0,1fr) max-content;align-items:center;column-gap:12px;min-height:var(--row,52px);padding:8px 16px;box-sizing:border-box}
.kb-row+.kb-row::before{content:"";position:absolute;left:16px;right:0;top:0;border-top:.5px solid var(--sep)}
.kb-keys{justify-self:end;display:flex;align-items:center;flex-wrap:nowrap;white-space:nowrap;gap:4px;font:600 var(--fs-note,.9375rem)/1 var(--f-text,system-ui);color:var(--label2)}
.kb-keys kbd{min-width:2.1em;height:2em;padding:0 .5em;border-radius:7px;font:600 var(--fs-min,.8125rem)/1 var(--f-text,system-ui);
  background:#E5E5EA;color:#3A3A3C;box-shadow:inset 0 -1px 0 rgba(60,60,67,.25)}
:root[data-theme=dark] .kb-keys kbd{background:#48484A;color:#F2F2F7;box-shadow:inset 0 -1px 0 rgba(0,0,0,.4)}
.kb-to{padding:0 2px}
.kb-what{min-width:0;display:flex;flex-direction:column;gap:2px;font:400 var(--fs-body,1.1875rem)/1.25 var(--f-text,system-ui);color:var(--label)}
.kb-what small{font:400 var(--fs-note,.9375rem)/1.3 var(--f-text,system-ui);color:var(--label2)}
.kb-note{margin:0 4px 8px;font:400 var(--fs-note,.9375rem)/1.35 var(--f-text,system-ui);color:var(--label2);text-align:center}
/* el texto que va directo sobre el vidrio de la hoja, un gris más fuerte (como .st-h en Ajustes) */
:root[data-theme=light] .kb-sub,:root[data-theme=light] .kb-note{color:rgba(60,60,67,.9)}
@media (forced-colors:active){.kb-keys kbd{border:1px solid CanvasText}}
`;
function css(){
  if(D.getElementById("css-keys")) return;
  const s = D.createElement("style"); s.id = "css-keys"; s.textContent = CSS; D.head.appendChild(s);
}

/* ---------- qué tecla es ---------- */
function token(e){
  if(!e) return null;
  const k = e.key;
  if(k === " " || k === "Spacebar" || (!k && e.code === "Space")) return e.shiftKey ? "shift+space" : "space";
  if(k === "Enter") return "enter";
  if(k === "ArrowLeft" || k === "Left") return e.shiftKey ? null : "left";
  if(k === "ArrowRight" || k === "Right") return e.shiftKey ? null : "right";
  if(k === "Escape" || k === "Esc") return "esc";
  if(k === "1" || k === "2" || k === "3" || k === "4") return k;
  if(k === "?" || k === "¿") return "?";
  return null;
}
const tokens = el => String(el.getAttribute("data-key") || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
/* escribiendo: ninguna tecla es de keys.js */
const editable = t => !!(t && t.nodeType === 1 &&
  (t.isContentEditable || t.closest("input,textarea,select,[contenteditable]:not([contenteditable='false'])")));
/* el navegador ya pulsa el elemento con el foco: Enter en botón, enlace o summary; Espacio en botón o summary */
function nativeTakes(tok, t){
  if(!t || t.nodeType !== 1 || t === D.body || t === ROOT) return false;
  try{
    if(tok === "enter") return t.matches("button,a[href],area[href],summary,input");
    if(tok === "space" || tok === "shift+space") return t.matches("button,summary,input");
  }catch(e){}
  return false;
}

/* ---------- capas: la hoja modal de arriba o la pantalla ---------- */
const isModal = d => { try{ return d.matches(":modal"); }catch(e){ return true; } };
function modals(){ return [...D.querySelectorAll("dialog[open]")].filter(isModal); }
/* la hoja de arriba: la que tiene el foco (una hoja modal deja inerte todo lo de debajo) o la última abierta */
function topDialog(){
  const list = modals(); if(!list.length) return null;
  const ae = D.activeElement;
  return list.find(d => d.contains(ae)) || list[list.length - 1];
}
const closing = () => !!D.querySelector("dialog[open].m-closing");
function openMenu(){
  for(const m of D.querySelectorAll("[role=menu]:not([hidden])")){
    if(m.getClientRects().length && getComputedStyle(m).visibility !== "hidden") return m;
  }
  return null;
}
/* se ve, se puede pulsar y no está en algo escondido o inerte (caras de tarjeta que no se ven, la página que se va…) */
function usable(el){
  if(!el || !el.isConnected || el.disabled || el.getAttribute("aria-disabled") === "true") return false;
  if(el.closest("[inert],[aria-hidden='true'],[hidden],.kb-tag")) return false;
  if(!el.getClientRects().length) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.visibility !== "collapse";
}
function winner(tok, scope){
  if(!scope) return null;
  for(const el of scope.querySelectorAll("[data-key]")) if(tokens(el).includes(tok) && usable(el)) return el;
  const sel = IMPLICIT[tok];
  if(sel && scope.tagName === "DIALOG") for(const el of scope.querySelectorAll(sel)) if(usable(el)) return el;
  return null;
}
/* ¿esa tecla la lleva la propia pantalla en ese sitio? */
function owned(el, tok){
  const o = el && el.closest("[data-key-own]"); if(!o) return false;
  const l = String(o.getAttribute("data-key-own") || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  return !l.length || l.includes(tok);
}
const playing = () => ROOT.hasAttribute("data-gm-play");
/* el elemento que pulsaría esa tecla ahora (null si ninguno o si la tecla es de la pantalla o del juego) */
function target(tok){
  if(!KEYS.includes(tok) || openMenu() || closing()) return null;
  if(playing() && tok !== "esc" && tok !== "?") return null;
  const L = topDialog();
  if(tok === "esc" && L) return null;
  const el = winner(tok, L || D.body);
  return el && !owned(el, tok) ? el : null;
}

/* ---------- el oyente ---------- */
let pre = null;   /* lo que había abierto al empezar la tecla, antes de que la tratara nadie */
W.addEventListener("keydown", e => {
  pre = {dlg: topDialog(), menu: !!openMenu(), closing: closing()};
  /* la primera tecla de verdad: salen las etiquetas */
  if(MODS.has(e.key) || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || editable(e.target)) return;
  if(!ROOT.hasAttribute("data-kbd")) kbdOn();
}, true);
W.addEventListener("keydown", e => {
  const p = pre; pre = null;
  if(e.defaultPrevented || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
  const tok = token(e); if(!tok) return;
  const t = e.target;
  if(editable(t) || nativeTakes(tok, t)) return;
  const play = playing();
  if(play && tok !== "esc" && tok !== "?") return;          /* en la partida, las teclas son del juego */
  const L = topDialog();
  if(p && (p.menu || p.closing || p.dlg !== L)) return;     /* un menú abierto, una hoja cerrándose, o alguien la usó */
  if(openMenu() || closing()) return;
  if(tok === "esc"){
    if(L) return;                                           /* la hoja la cierra el navegador (cancel) */
    const el = winner("esc", D.body);
    if(el && !owned(el, "esc")){ e.preventDefault(); el.click(); }
    return;
  }
  const scope = L || D.body;
  if(tok === "?"){
    const el = winner("?", scope);
    if(el && !owned(el, "?")){ e.preventDefault(); el.click(); return; }
    if(L && L === HELP){ e.preventDefault(); closeHelp(); return; }
    if(L || play) return;
    e.preventDefault(); help();
    return;
  }
  const el = winner(tok, scope);
  if(!el && tok === "shift+space"){
    /* sin tortuga a la vista: el altavoz, despacio */
    const sp = winner("space", scope);
    if(sp && !owned(sp, "space") && sp.dataset.say && typeof W.say === "function"){
      e.preventDefault();
      try{ W.say(sp.dataset.say, sp, true); }catch(err){ console.error(err); }
    }
    return;
  }
  if(!el || owned(el, tok)) return;
  e.preventDefault();
  el.click();
});

/* ---------- etiquetas (html[data-kbd]) ---------- */
let mo = null, raf = 0;
const TAGGED = new Set();
function kbdOn(){
  ROOT.setAttribute("data-kbd", "");
  css();
  if(!mo && typeof MutationObserver === "function"){
    mo = new MutationObserver(recs => {
      for(const r of recs){
        /* nuestras propias etiquetas no cuentan */
        if(r.type === "childList" && [...r.addedNodes, ...r.removedNodes].every(n => n.nodeType === 1 && n.classList.contains("kb-tag"))) continue;
        schedule(); return;
      }
    });
    mo.observe(D.body, {subtree: true, childList: true, attributes: true,
      attributeFilter: ["hidden", "disabled", "aria-disabled", "aria-hidden", "inert", "open", "class", "data-key", "data-key-own"]});
  }
  schedule();
}
function kbdOff(){
  ROOT.removeAttribute("data-kbd");
  if(mo){ mo.disconnect(); mo = null; }
  if(raf){ cancelAnimationFrame(raf); raf = 0; }
  [...TAGGED].forEach(untag);
}
function schedule(){ if(!raf && ROOT.hasAttribute("data-kbd")) raf = requestAnimationFrame(refresh); }
function refresh(){
  raf = 0;
  if(!ROOT.hasAttribute("data-kbd")){ [...TAGGED].forEach(untag); return; }
  if(closing()) return;   /* una hoja se va: lo de debajo vuelve en el siguiente cambio */
  const want = new Map();
  if(!openMenu()){
    const scope = topDialog() || D.body;
    for(const tok of KEYS){ const el = winner(tok, scope); if(el && !want.has(el)) want.set(el, tok); }
  }
  [...TAGGED].forEach(el => { if(!want.has(el)) untag(el); });
  want.forEach((tok, el) => tag(el, tok));
  layout();
  if(mo) mo.takeRecords();   /* lo que acabamos de cambiar no vuelve a pedir otra vuelta */
}
/* ¿botón redondo de icono? (sin texto, tan alto como ancho y con el radio de un círculo) */
function round(el){
  const p = el.getAttribute("data-key-pos"); if(p === "top") return true;
  if(p || el.textContent.trim()) return false;
  const r = el.getBoundingClientRect(); if(!r.width || Math.abs(r.width - r.height) > 4 || r.width > 120) return false;
  const br = getComputedStyle(el).borderTopLeftRadius || "0";
  return br.endsWith("%") ? parseFloat(br) >= 40 : parseFloat(br) >= r.width / 2 - 2;
}
/* dónde va cada etiqueta: abajo (en los redondos, encima); si ahí tocaría otra cosa (otro botón, un texto, otra
   tarjeta, otra etiqueta; con 4 px de aire) o se saldría de la pantalla, prueba encima, a la derecha, a la izquierda
   y, por fin, dentro del botón a la derecha si su texto no llega. Las de un mismo grupo (mismo contenedor, mismo lado) se alinean en una línea. Mientras algo se anima (una hoja que
   entra), se vuelve a mirar al acabar. */
const GAP = 4;
let relay = 0, relayT = 0, SEEN = new Map();
/* ¿se ve? (un contenedor transparente que solo coloca cosas no cuenta: sí un botón, un texto, un dibujo o una tarjeta) */
function counts(e){
  if(SEEN.has(e)) return SEEN.get(e);
  let v = false;
  try{
    if(e.matches("button,a,input,select,textarea,img,svg,video,canvas,label,[role=button]")) v = true;
    else if([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) v = true;
    else {
      const c = getComputedStyle(e), bg = c.backgroundColor;
      v = (bg && bg !== "transparent" && !/rgba?\([^)]*,\s*0\)$/.test(bg)) || c.backgroundImage !== "none" || parseFloat(c.borderTopWidth) > 0 || c.boxShadow !== "none";
    }
  }catch(err){ v = true; }
  SEEN.set(e, v);
  return v;
}
/* dónde caería la etiqueta (w×h) en cada sitio, sin moverla: probarla de verdad fuera de la pantalla ensancharía la
   página (y en el móvil, la ventana), y lo de la derecha se movería */
const box = (l, t, w, h) => ({left: l, top: t, right: l + w, bottom: t + h});
function spot(p, hr, w, h){
  const cx = hr.left + hr.width / 2, cy = hr.top + hr.height / 2;
  if(p === "t") return box(cx - w / 2, hr.top - .55 * h, w, h);
  if(p === "r") return box(hr.right + 4, cy - h / 2, w, h);
  if(p === "l") return box(hr.left - 4 - w, cy - h / 2, w, h);
  if(p === "i") return box(hr.right - 12 - w, cy - h / 2, w, h);
  return box(cx - w / 2, hr.bottom - .45 * h, w, h);
}
/* lo que ocupa por dentro el botón (su texto y su icono), sin la etiqueta */
function inner(el){
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  const add = q => { if(!q.width && !q.height) return; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); };
  for(const n of el.childNodes){
    if(n.nodeType === 1 && !n.classList.contains("kb-tag")) add(n.getBoundingClientRect());
    else if(n.nodeType === 3 && n.textContent.trim()){ const g = D.createRange(); g.selectNodeContents(n); add(g.getBoundingClientRect()); }
  }
  return l === Infinity ? null : {left: l, top: t, right: r, bottom: b};
}
function touches(r, host, taken, vw, p){
  const x0 = r.left - GAP, x1 = r.right + GAP, y0 = r.top - GAP, y1 = r.bottom + GAP;
  const hits = q => q.left < x1 && q.right > x0 && q.top < y1 && q.bottom > y0;
  if(r.left < 0 || r.top < 0 || r.right > vw || r.bottom > innerHeight) return true;
  if(taken.some(hits)) return true;
  if(p === "i"){ const c = inner(host), hr = host.getBoundingClientRect(); return r.left < hr.left + 8 || (!!c && hits(c)); }
  for(const x of [x0 + 1, (x0 + x1) / 2, x1 - 1]) for(const y of [y0 + 1, (y0 + y1) / 2, y1 - 1]){
    for(const e of D.elementsFromPoint(x, y)){
      if(e === host || host.contains(e) || e.contains(host) || (e.closest && e.closest(".kb-tag"))) continue;
      if(counts(e)) return true;
    }
  }
  return false;
}
function layout(){
  const taken = [], groups = new Map(), vw = Math.min(innerWidth, ROOT.clientWidth || innerWidth);
  SEEN = new Map();
  for(const el of [...TAGGED].sort((a, b) => a.compareDocumentPosition(b) & 4 ? -1 : 1)){
    const k = el.querySelector(":scope > kbd.kb-tag"); if(!k) continue;
    k.style.top = k.style.bottom = "";
    if(el.getAttribute("data-key-pos") === "in"){ delete k.dataset.pos; taken.push(k.getBoundingClientRect()); continue; }
    const rnd = round(el);
    k.classList.toggle("kb-sm", rnd);
    const base = rnd ? ["t", "b", "r", "l"] : ["b", "t", "r", "l", "i"], hr = el.getBoundingClientRect(), w = k.offsetWidth, h = k.offsetHeight;
    const order = el.getAttribute("data-key-pos") === "right" ? ["r", ...base.filter(p => p !== "r")] : base;
    let pos = order[0];
    if(hr.bottom > 0 && hr.top < innerHeight){
      const free = order.find(p => !touches(spot(p, hr, w, h), el, taken, vw, p));
      if(free) pos = free;
    }
    if(pos === "b") delete k.dataset.pos; else k.dataset.pos = pos;
    taken.push(spot(pos, hr, w, h));
    if(pos === "t" || pos === "b"){
      const g = el.parentElement;
      if(!groups.has(g)) groups.set(g, {t: [], b: []});
      groups.get(g)[pos].push([el, k, hr]);
    }
  }
  /* un grupo, en una línea: encima, a la altura del más alto; abajo, a la del más bajo */
  groups.forEach(g => {
    if(g.t.length > 1){ const m = Math.min(...g.t.map(x => x[2].top)); g.t.forEach(([, k, r]) => { k.style.top = (m - r.top) + "px"; }); }
    if(g.b.length > 1){ const m = Math.max(...g.b.map(x => x[2].bottom)); g.b.forEach(([, k, r]) => { k.style.bottom = (r.bottom - m) + "px"; }); }
  });
  /* algo se está moviendo (una hoja que sube, una página que entra): otra vuelta cuando acabe */
  let moving = false;
  try{ moving = D.getAnimations().some(a => a.playState === "running" && !(a.effect && a.effect.target && a.effect.target.classList && a.effect.target.classList.contains("kb-tag"))
    && isFinite(a.effect && a.effect.getComputedTiming().endTime)); }catch(e){}
  clearTimeout(relayT);
  if(moving && relay < 12){ relay++; relayT = setTimeout(schedule, 120); } else if(!moving) relay = 0;
}
function tag(el, tok){
  if(!el.hasAttribute("aria-keyshortcuts")){
    const a = tokens(el).map(k => ARIA[k] || k).filter(Boolean);
    if(a.length) el.setAttribute("aria-keyshortcuts", a.join(" "));
  }
  TAGGED.add(el);
  if(el.querySelector("kbd:not(.kb-tag)")) return;          /* ya trae su propia etiqueta */
  const label = el.getAttribute("data-key-label") || LABEL[tok] || tok;
  let k = el.querySelector(":scope > kbd.kb-tag");
  if(k && k.dataset.k === label) return;
  if(!k){ k = D.createElement("kbd"); k.className = "kb-tag"; k.setAttribute("aria-hidden", "true"); el.appendChild(k); }
  k.dataset.k = label;
  if(!el.classList.contains("kb-host")){
    if(getComputedStyle(el).position === "static") el.classList.add("kb-pos");
    if(el.getAttribute("data-key-pos") !== "in") el.classList.add("kb-host");
  }
}
function untag(el){
  TAGGED.delete(el);
  el.querySelectorAll(":scope > kbd.kb-tag").forEach(k => k.remove());
  el.classList.remove("kb-host", "kb-pos");
}
/* un toque o un clic de verdad: fuera las etiquetas (los gestos sintéticos de js/gestures.js no cuentan) */
W.addEventListener("pointerdown", e => { if(e.isTrusted && ROOT.hasAttribute("data-kbd")) kbdOff(); }, {capture: true, passive: true});
D.addEventListener("focusin", schedule, true);
W.addEventListener("resize", schedule, {passive: true});
W.addEventListener("scroll", schedule, {passive: true, capture: true});   /* lo que entra en pantalla se recoloca */

/* ---------- la hoja «Teclas» (?) ---------- */
const K = t => `<kbd>${t}</kbd>`, VH = t => `<span class="vh">${t}</span>`;
const ROWS = [
  {k: K("Espacio"), t: "Oír la palabra"},
  {k: `${K("Mayús")} + ${K("Espacio")}`, t: "Oírla despacio"},
  {k: K("Enter"), t: "El botón azul", s: "Empezar, Seguir…"},
  {k: `${K(`←${VH(" flecha izquierda")}`)}${K(`→${VH(" flecha derecha")}`)}`, t: "Anterior y siguiente", s: "En el repaso: «No» y «¡Sí!»"},
  {k: `${K("1")}<span class="kb-to" aria-hidden="true">–</span>${VH(" a ")}${K("4")}`, t: "Elegir una respuesta", s: "En Hoy: abrir un atajo"},
  {k: K("Esc"), t: "Volver o cerrar", s: "En un juego: pausa"},
  {k: K("?"), t: "Ver estas teclas"},
];
let HELP = null;
function helpSheet(){
  if(HELP && HELP.isConnected) return HELP;
  css();
  const d = D.createElement("dialog");
  d.id = "kb-help"; d.className = "kb-sh"; d.setAttribute("aria-labelledby", "kb-help-t");
  d.dataset.noHint = ""; d.dataset.noRenew = "";
  d.innerHTML = `<div class="m-head"><h2 id="kb-help-t">Teclas</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Listo</button></div>
    <p class="kb-sub">Con un teclado, también puedes usar estas teclas.</p>
    <ul class="kb-rows">${ROWS.map(r => `<li class="kb-row"><span class="kb-what">${r.t}${r.s ? `<small>${r.s}</small>` : ""}</span><span class="kb-keys">${r.k}</span></li>`).join("")}</ul>
    <p class="kb-note">Al pulsar una tecla, cada botón enseña la suya en gris. En los juegos, cada juego tiene sus teclas.</p>`;
  d.addEventListener("click", e => { if(e.target.closest && e.target.closest("[data-close]")) closeHelp(); });
  D.body.appendChild(d);
  HELP = d;
  return d;
}
function help(from){
  const d = helpSheet();
  if(d.open) return d;
  try{
    if(W.M && typeof M.openSheet === "function") M.openSheet(d, {from: from && from.nodeType === 1 ? from : null});
    else d.showModal();
  }catch(e){ try{ d.showModal(); }catch(e2){ d.setAttribute("open", ""); } }
  return d;
}
function closeHelp(now){
  const d = HELP; if(!d || !d.open) return;
  if(!now && W.M && typeof M.closeSheet === "function" && d.classList.contains("m-sheet")) M.closeSheet(d);
  else d.close();
}
/* al cambiar de pantalla: la hoja se cierra y las etiquetas se recolocan */
if(typeof bus !== "undefined" && bus && typeof bus.on === "function") bus.on("route", () => { closeHelp(true); schedule(); });

W.vocabKeys = {help, closeHelp, target, token, refresh: () => { if(raf){ cancelAnimationFrame(raf); raf = 0; } refresh(); },
  get kbd(){ return ROOT.hasAttribute("data-kbd"); }, KEYS};
})();
