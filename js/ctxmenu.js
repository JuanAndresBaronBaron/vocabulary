/* Módulo ctxmenu (window.vocabMenu): el menú que sale al mantener pulsado, como el de iOS. El fondo se desenfoca, la
   pieza que se mantiene (una copia suya) crece un poco por encima y al lado sale una lista de opciones con icono.
   Cada opción es un atajo: lo mismo se puede hacer sin mantener, con un botón que se ve (SPEC: un gesto siempre tiene su
   botón). Esc, tocar fuera o el «atrás» del sistema lo cierran sin elegir; el foco vuelve a la pieza.
   - vocabMenu.hold(el, spec, o) → off(): mantener el (G.hold de js/gestures.js, 500 ms) abre el menú; también el clic
       derecho del ratón y la tecla de menú o Mayús+F10 con el foco dentro de el. Con el dedo aún en la pantalla, se
       puede deslizar hasta una opción y soltar para elegirla. spec es un objeto o una función (el) → objeto | null; con
       null no hay menú y al soltar sin moverse se hace o.fallback(el) (por defecto, el.click(): lo de tocar).
       o: {ms, touchAction, lite, radius, haptic, fallback} (lite, radius y haptic como en open()).
   - vocabMenu.open(el, spec, o) → Promise<id | null>: abre el menú de la pieza el (la que se copia y crece). Devuelve el
       id de la opción elegida o null si se cerró sin elegir. o: {x, y} (el dedo), lite: true (sin desenfoque: granja,
       juegos; también va sin él con html[data-gm-play], data-glass=lite|off, más contraste y menos transparencia),
       radius: px (la copia va recortada con esas esquinas y sombra, para filas de una lista), haptic: false (no vibra al
       abrir; por defecto vibra «selection» cuando lo abre mantener).
   - vocabMenu.close(now) cierra sin elegir (now: sin animación, p. ej. si el dedo empieza a arrastrar la pieza).
   - vocabMenu.isOpen(el?) dice si hay un menú abierto (de esa pieza, si se pasa).
   spec = {label, title, sub, lang, ipa, items, tap}
     label: nombre del menú para el lector de pantalla (por defecto «Opciones de <title>»); title: la palabra de la
     cabecera (en lang, el código BCP 47 de la palabra) y sub: su traducción; ipa: HTML de ipaHtml() (o una promesa que
     lo da; si un mayor apagó la IPA llega ""); tap: qué hace tocar la copia de la pieza (si no, cierra).
     items: [{id, t, ic, st, disabled, say, slow, gap, fn}]: t texto, ic icono del sprite (ico(); st "bold" o "fill"),
     disabled la muestra apagada, say: texto que dice al elegirla (es un botón [data-say] como los altavoces, con
     data-slow si slow: lo toca el say() de index.html, con su audio grabado o la voz central), gap: línea gruesa
     antes (otro grupo), fn(el) lo que hace (después de cerrar el menú, con el foco ya de vuelta).
   La lista es role=menu con role=menuitem (flechas, Inicio y Fin; Tab da la vuelta), dentro de un <dialog> modal con
   nombre. Vidrio solo en lo flotante: el fondo desenfocado cuenta como una superficie de vidrio y con el menú abierto
   la barra de pestañas y las monedas van sin desenfoque (html[data-cmenu]). Con Reducir movimiento solo hay fundidos
   cortos (≤ 150 ms). Sin sonido. Iconos: Phosphor (MIT). */
(() => {
"use strict";
const W = window, DOC = document, ROOT = DOC.documentElement;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rm = () => { try{ return W.M && typeof M.rm === "function" ? !!M.rm() : matchMedia("(prefers-reduced-motion: reduce)").matches || ROOT.dataset.motion === "calm"; }catch(e){ return false; } };
const mq = q => { try{ return matchMedia(q).matches; }catch(e){ return false; } };
const call = (f, a) => { if(typeof f !== "function") return; try{ return f(a); }catch(e){ console.error(e); } };
const E = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const IC = (n, st, z) => { try{ return typeof ico === "function" ? ico(n, st || "bold", z || 22, "vm-ic") : ""; }catch(e){ return ""; } };
const GG = () => W.G && typeof W.G.hold === "function" ? W.G : null;
const PAD = 12, GAP = 10;

/* ---------- estilos ---------- */
const DARK = (s, b) => `:root[data-theme=dark] ${s}{${b}}`;
const STYLE = `
.vm{position:fixed;inset:0;z-index:2147483000;width:auto;height:auto;max-width:none;max-height:none;margin:0;padding:0;border:0;
  background:transparent;color:var(--label,#000);overflow:hidden;outline:none;touch-action:none;overscroll-behavior:contain;
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;
  --vm-bg:rgba(255,255,255,.96);--vm-hl:rgba(120,120,128,.16);--vm-gap:rgba(120,120,128,.12)}
${DARK(".vm", "--vm-bg:rgba(44,44,46,.97);--vm-hl:rgba(120,120,128,.32);--vm-gap:rgba(0,0,0,.28)")}
.vm::backdrop{background:transparent}
.vm.vm-out{display:block;pointer-events:none}
.vm-scrim{position:absolute;inset:0;background:rgba(0,0,0,.16);-webkit-backdrop-filter:blur(14px) saturate(150%);backdrop-filter:blur(14px) saturate(150%)}
${DARK(".vm-scrim", "background:rgba(0,0,0,.42)")}
.vm.lite .vm-scrim{-webkit-backdrop-filter:none;backdrop-filter:none;background:rgba(0,0,0,.42)}
.vm.lite{--vm-bg:#fff}
${DARK(".vm.lite .vm-scrim", "background:rgba(0,0,0,.6)")}
${DARK(".vm.lite", "--vm-bg:#2C2C2E")}
:root[data-glass=off] .vm-scrim,:root[data-contrast=more] .vm-scrim{-webkit-backdrop-filter:none;backdrop-filter:none;background:rgba(0,0,0,.42)}
@media (prefers-reduced-transparency:reduce){.vm-scrim{-webkit-backdrop-filter:none;backdrop-filter:none;background:rgba(0,0,0,.42)}}
@media (prefers-contrast:more){.vm-scrim{-webkit-backdrop-filter:none;backdrop-filter:none;background:rgba(0,0,0,.42)}}
.vm-pv{position:absolute;left:0;top:0;width:0;height:0;overflow:visible}
.vm-pv-in{position:absolute;left:0;top:0;transform-origin:0 0}
.vm-pv-hit{position:absolute;cursor:pointer}
.vm-box{position:absolute;left:0;top:0;width:min(260px,calc(100vw - ${PAD * 2}px));max-height:calc(100dvh - ${PAD * 2}px);overflow:auto;
  border-radius:var(--r-menu,20px);background:var(--vm-bg);color:var(--label,#000);
  box-shadow:0 18px 50px rgba(0,0,0,.22),0 3px 10px rgba(0,0,0,.08),0 0 0 .5px rgba(0,0,0,.08)}
${DARK(".vm-box", "box-shadow:0 18px 50px rgba(0,0,0,.5),0 0 0 .5px rgba(255,255,255,.1)")}
:root[data-contrast=more] .vm-box{border:2px solid var(--sep);background:var(--card,#fff)}
@media (prefers-contrast:more){.vm-box{border:2px solid var(--sep);background:var(--card,#fff)}}
.vm-h{margin:0;padding:11px 16px 10px;font:400 var(--fs-note,15px)/1.3 var(--f-text,system-ui);color:var(--label2);box-shadow:inset 0 -.5px 0 var(--sep)}
.vm-h b{font-weight:600;color:var(--label)}
.vm-h .ipa{margin-left:6px;color:var(--label2)}
.vm-hs{display:block}
.vm-m{display:flex;flex-direction:column}
.vm-m:focus{outline:none}
.vm-i{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:48px;margin:0;padding:10px 16px;border:0;border-radius:0;
  background:none;color:var(--label,#000);font:400 var(--fs-sub,17px)/1.25 var(--f-text,system-ui);text-align:left;cursor:pointer;
  -webkit-tap-highlight-color:transparent;touch-action:none}
.vm-i+.vm-i{box-shadow:inset 0 .5px 0 var(--sep)}
.vm-i.vm-gap{border-top:8px solid var(--vm-gap);box-shadow:none}
.vm-t{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
.vm-i .vm-ic{flex:none;width:22px;height:22px}
.vm-i.hov,.vm-i:active{background:var(--vm-hl)}
@media (hover:hover){.vm-i:hover{background:var(--vm-hl)}}
.vm-i:focus{outline:none}
.vm-i:focus-visible{outline:3px solid var(--brand-tint,#1E6EF4);outline-offset:-4px;border-radius:12px}
.vm-i:disabled{color:var(--label2);cursor:default;background:none}
.vm-i.playing .vm-ic{color:var(--brand-tint,#1E6EF4)}
:where(:root[data-cmenu]) .glass:where(.tabbar,.tb-group,.acc,.tb-flag){-webkit-backdrop-filter:none;backdrop-filter:none}
@media (forced-colors:active){.vm-box{border:1px solid CanvasText}.vm-i{color:ButtonText}.vm-scrim{background:rgba(0,0,0,.5)}}
`;
function css(){
  if(DOC.getElementById("css-ctxmenu")) return;
  const st = DOC.createElement("style"); st.id = "css-ctxmenu"; st.textContent = STYLE; DOC.head.appendChild(st);
}

/* ---------- la copia de la pieza ---------- */
const KEEP_SVG = /^(viewBox|preserveAspectRatio|d|points|x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|width|height|href|xlink:href|fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|transform|opacity|fill-rule|clip-rule|offset|stop-color|stop-opacity|gradientUnits|gradientTransform|lang)$/;
const KEEP_HTML = /^(src|srcset|sizes|alt|lang|dir|width|height|decoding)$/;
const NO_ANIM = "animation:none!important;transition:none!important;view-transition-name:none!important;pointer-events:none!important;outline:none!important;";
function styleText(cs){
  let t = "";
  for(let j = 0; j < cs.length; j++){ const p = cs[j]; if(p.startsWith("--")) continue; t += `${p}:${cs.getPropertyValue(p)};`; }
  return t;
}
/* copia el con todos sus estilos calculados (también ::before y ::after), sin ids, clases, data-*, aria ni nada que se
   pueda tocar: así ningún módulo ni prueba la confunde con la de verdad */
function cloneStyled(src){
  const root = src.cloneNode(true);
  const A = [src, ...src.querySelectorAll("*")], B = [root, ...root.querySelectorAll("*")];
  let pse = "";
  for(let i = 0; i < A.length && i < B.length; i++){
    const a = A[i], b = B[i], svg = b.namespaceURI === "http://www.w3.org/2000/svg";
    for(const at of [...b.attributes]){ if(!(svg ? KEEP_SVG : KEEP_HTML).test(at.name)) b.removeAttribute(at.name); }
    if(b.tagName === "IMG"){ b.setAttribute("alt", ""); b.loading = "eager"; }
    if(b.tagName === "STYLE" || b.tagName === "SCRIPT" || b.tagName === "TEMPLATE"){ b.remove(); continue; }
    let cs; try{ cs = getComputedStyle(a); }catch(e){ continue; }
    b.setAttribute("style", styleText(cs) + NO_ANIM);
    for(const pe of ["::before", "::after"]){
      let ps; try{ ps = getComputedStyle(a, pe); }catch(e){ continue; }
      const c = ps.content; if(!c || c === "none" || c === "normal") continue;
      b.setAttribute("data-vm-n", i);
      pse += `.vm-pv [data-vm-n="${i}"]${pe}{${styleText(ps)}animation:none!important;transition:none!important}\n`;
    }
  }
  return {root, pse};
}
/* la caja de el sin su propia transformación (con la de sus antepasados): ahí va la copia, que lleva la suya */
function layoutRect(el){
  const s = el.style, P = ["transform", "translate", "scale", "rotate"];
  const keep = P.map(p => [p, s.getPropertyValue(p), s.getPropertyPriority(p)]);
  P.forEach(p => s.setProperty(p, "none", "important"));
  const r = el.getBoundingClientRect();
  keep.forEach(([p, v, pr]) => { if(v) s.setProperty(p, v, pr); else s.removeProperty(p); });
  return r;
}
const FOCUSABLE = "button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex='-1'])";
const focusOf = el => !el || !el.isConnected ? null : el.matches(FOCUSABLE) ? el : el.querySelector(FOCUSABLE) || el.closest(FOCUSABLE);

/* ---------- el menú abierto ---------- */
let CUR = null, SEQ = 0, TOUCH = 0, KEYT = -1e9;
/* la tecla de menú o Mayús+F10 (el contextmenu que llega justo después es del teclado: el foco va a la 1.ª opción) */
addEventListener("keydown", e => { if(e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) KEYT = performance.now(); }, true);
addEventListener("pointerdown", e => { if(e.pointerType === "touch") TOUCH++; }, true);
const untouch = e => { if(e.pointerType === "touch") TOUCH = Math.max(0, TOUCH - 1); };
addEventListener("pointerup", untouch, true); addEventListener("pointercancel", untouch, true);

function liteNow(o){
  return !!o.lite || ROOT.hasAttribute("data-gm-play") || /^(lite|off)$/.test(ROOT.dataset.glass || "") || ROOT.dataset.contrast === "more"
    || mq("(prefers-reduced-transparency: reduce)") || mq("(prefers-contrast: more)");
}
function itemHtml(it, i){
  const say = it.say ? ` data-say="${E(it.say)}"${it.slow ? " data-slow" : ""}` : "";
  return `<button type="button" role="menuitem" class="vm-i${it.gap && i ? " vm-gap" : ""}" data-vm="${i}"${say}${it.disabled ? " disabled" : ""}>`
    + `<span class="vm-t">${E(it.t)}</span>${it.ic ? IC(it.ic, it.st || "bold", 22) : ""}</button>`;
}

function open(src, spec, o = {}){
  if(CUR) shut(null, true);
  if(!src || !src.isConnected || !spec || !Array.isArray(spec.items) || !spec.items.length) return Promise.resolve(null);
  css();
  const n = ++SEQ, R = rm(), lite = liteNow(o);
  /* lo que se ve de la pieza ahora mismo */
  const V = src.getBoundingClientRect(), L = layoutRect(src);
  const w0 = src.offsetWidth || L.width || 1, h0 = src.offsetHeight || L.height || 1, k = L.width / w0 || 1;
  const {root: copy, pse} = cloneStyled(src);
  copy.style.setProperty("position", "absolute", "important"); copy.style.setProperty("inset", "auto", "important");
  copy.style.setProperty("left", "0", "important"); copy.style.setProperty("top", "0", "important");
  copy.style.setProperty("margin", "0", "important"); copy.style.setProperty("visibility", "visible", "important");
  copy.style.setProperty("opacity", "1", "important");
  if(o.radius > 0){
    copy.style.setProperty("border-radius", o.radius + "px", "important"); copy.style.setProperty("overflow", "hidden", "important");
    copy.style.setProperty("box-shadow", "0 12px 34px rgba(0,0,0,.2),0 2px 6px rgba(0,0,0,.08)", "important");
  }
  const title = spec.title ? String(spec.title) : "";
  const label = spec.label || (title ? `Opciones de ${title}` : "Opciones");
  const hid = `vm-h-${n}`;
  const head = title || spec.sub ? `<div class="vm-h" id="${hid}">${title ? `<b${spec.lang ? ` lang="${E(spec.lang)}"` : ""}>${E(title)}</b>` : ""}<span class="vm-ipa"></span>${spec.sub ? `<span class="vm-hs">${E(spec.sub)}</span>` : ""}</div>` : "";
  const d = DOC.createElement("dialog");
  d.className = "vm" + (lite ? " lite" : "");
  d.setAttribute("aria-label", label);
  d.setAttribute("data-no-renew", "");   /* sus opciones acarician, dan de comer o dicen la palabra: nunca piden el permiso de Google */
  d.innerHTML = `<style>${pse}</style><div class="vm-scrim"></div>
    <div class="vm-pv" aria-hidden="true"><div class="vm-pv-in" inert></div><div class="vm-pv-hit"></div></div>
    <div class="vm-box">${head}<div class="vm-m" role="menu" tabindex="-1" aria-label="${E(label)}">${spec.items.map(itemHtml).join("")}</div></div>`;
  const pv = d.querySelector(".vm-pv"), pin = d.querySelector(".vm-pv-in"), hit = d.querySelector(".vm-pv-hit"), box = d.querySelector(".vm-box");
  pin.style.cssText = `left:${L.left}px;top:${L.top}px;width:${w0}px;height:${h0}px;transform:scale(${k})`;
  pin.appendChild(copy);
  hit.style.cssText = `left:${V.left}px;top:${V.top}px;width:${V.width}px;height:${V.height}px`;
  /* la IPA de la cabecera (ipaHtml ya la deja vacía si un mayor la apagó) */
  const ipaEl = d.querySelector(".vm-ipa");
  const putIpa = h => { if(ipaEl && typeof h === "string" && h) ipaEl.innerHTML = h; };
  if(spec.ipa && typeof spec.ipa.then === "function") spec.ipa.then(h => { if(CUR && CUR.n === n){ putIpa(h); place(CUR); } }, () => {});
  else putIpa(spec.ipa);

  const prevFocus = DOC.activeElement;
  DOC.body.appendChild(d);
  try{ d.showModal(); }catch(e){ d.setAttribute("open", ""); }
  ROOT.setAttribute("data-cmenu", "");
  { const g = W.G; if(g && typeof g.hideHint === "function") g.hideHint(); }   /* nada de pistas debajo del menú */
  const c = CUR = {n, d, src, spec, o, R, V, pv, box, hit, lite, prevFocus, vis: [src.style.getPropertyValue("visibility"), src.style.getPropertyPriority("visibility")], res: null};
  const p = new Promise(r => { c.res = r; });
  src.style.setProperty("visibility", "hidden", "important");
  place(c);
  /* el foco entra en el menú: con el teclado, a la primera opción; con el dedo o el ratón, a la lista (sin anillo; las
     flechas van luego a las opciones) */
  const first = o.via === "key" ? items(c)[0] : null;
  try{ (first || d.querySelector(".vm-m")).focus({preventScroll: true}); }catch(e){}
  /* eventos */
  d.addEventListener("cancel", e => { e.preventDefault(); if(CUR === c) shut(null); });
  d.addEventListener("click", e => onClick(c, e));
  d.addEventListener("keydown", e => onKey(c, e));
  d.addEventListener("wheel", e => { if(!box.contains(e.target)) e.preventDefault(); }, {passive: false});
  d.addEventListener("contextmenu", e => e.preventDefault());
  c.away = () => { if(CUR === c) shut(null, true); };
  c.hide = () => { if(DOC.visibilityState === "hidden" && CUR === c) shut(null, true); };
  addEventListener("hashchange", c.away); addEventListener("resize", c.away); DOC.addEventListener("visibilitychange", c.hide);
  /* entrada */
  if(R){
    for(const el of [d.querySelector(".vm-scrim"), pv, box]) anim(el, [{opacity: 0}, {opacity: 1}], {duration: 120, easing: "ease-out"});
  } else {
    anim(d.querySelector(".vm-scrim"), [{opacity: 0}, {opacity: 1}], {duration: 220, easing: "ease-out"});
    anim(pv, [{transform: "none"}, {transform: c.pvT}], {duration: 360, easing: "cubic-bezier(.3,1.45,.5,1)"});
    anim(box, [{opacity: 0, transform: "scale(.5)"}, {opacity: 1, offset: .4}, {opacity: 1, transform: "scale(1)"}], {duration: 340, easing: "cubic-bezier(.3,1.3,.5,1)"});
  }
  if(o.haptic !== false && o.via === "hold"){ const g = GG(); if(g && g.haptic) try{ g.haptic("selection"); }catch(e){} }
  return p;
}
function anim(el, kf, op){ try{ return el.animate(kf, op); }catch(e){ return null; } }
const items = c => [...c.box.querySelectorAll(".vm-i")].filter(b => !b.disabled);

/* dónde van la copia (crece un poco sobre su centro; si no cabe con el menú, se mueve) y el menú (debajo o encima,
   pegado al borde de la pieza que queda más cerca del centro) */
function place(c){
  const vw = DOC.documentElement.clientWidth || innerWidth, vh = innerHeight, V = c.V, box = c.box;
  const mw = box.offsetWidth, mh = box.offsetHeight;
  const cx = V.left + V.width / 2, cy = V.top + V.height / 2;
  let g = 1 + clamp(14 / Math.max(V.width, V.height, 1), .025, .08);
  g = Math.max(1, Math.min(g, (vw - 8) / Math.max(1, V.width)));
  let pw = V.width * g, ph = V.height * g, px = cx - pw / 2, py = cy - ph / 2, dx = 0, dy = 0, top, side = "below";
  const below = vh - PAD - (py + ph + GAP), above = py - GAP - PAD;
  if(mh <= below) top = py + ph + GAP;
  else if(mh <= above){ top = py - GAP - mh; side = "above"; }
  else {
    if(ph + GAP + mh > vh - 2 * PAD){ g *= Math.max(.25, (vh - 2 * PAD - GAP - mh) / ph); pw = V.width * g; ph = V.height * g; px = cx - pw / 2; py = cy - ph / 2; }
    const ny = clamp(py, PAD, Math.max(PAD, vh - PAD - mh - GAP - ph));
    dy = ny - py; py = ny; top = py + ph + GAP;
  }
  if(pw <= vw - 2 * PAD){ const nx = clamp(px, PAD, vw - PAD - pw); dx = nx - px; px = nx; }
  const left = clamp(cx <= vw / 2 + 1 ? px : px + pw - mw, PAD, Math.max(PAD, vw - PAD - mw));
  c.pvT = `translate(${dx}px, ${dy}px) scale(${g})`;
  c.pv.style.transformOrigin = `${cx}px ${cy}px`;
  c.pv.style.transform = c.pvT;
  box.style.left = left + "px"; box.style.top = Math.max(PAD, top) + "px";
  const ox = clamp(cx + dx - left, 0, mw);
  box.style.transformOrigin = `${ox}px ${side === "below" ? 0 : mh}px`;
}

/* ---------- elegir ---------- */
function pick(c, b){
  if(CUR !== c || !b || b.disabled) return;
  const i = +b.dataset.vm, it = c.spec.items[i]; if(!it) return;
  shut(it.id === undefined ? i : it.id);
  call(it.fn, c.src);
}
function onClick(c, e){
  if(CUR !== c) return;
  const b = e.target.closest && e.target.closest(".vm-i");
  if(b){ if(b.disabled){ e.stopPropagation(); return; } pick(c, b); return; }   /* los de data-say siguen hasta index.html */
  e.stopPropagation();
  if(e.target.closest && e.target.closest(".vm-pv-hit") && typeof c.spec.tap === "function"){ const f = c.spec.tap, s = c.src; shut(null); call(f, s); return; }
  if(!(e.target.closest && e.target.closest(".vm-box"))) shut(null);
}
function onKey(c, e){
  if(CUR !== c) return;
  const L = items(c); if(!L.length) return;
  const i = L.indexOf(DOC.activeElement);
  let j = null;
  if(e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) j = i < 0 ? 0 : (i + 1) % L.length;
  else if(e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) j = i < 0 ? L.length - 1 : (i - 1 + L.length) % L.length;
  else if(e.key === "Home") j = 0;
  else if(e.key === "End") j = L.length - 1;
  if(j === null) return;
  e.preventDefault(); e.stopPropagation();
  try{ L[j].focus(); }catch(err){}
}
/* con el dedo aún abajo: la opción bajo el dedo se ilumina y al soltar se elige */
function itemAt(c, x, y){
  const t = DOC.elementFromPoint(x, y), b = t && t.closest && t.closest(".vm-i");
  return b && c.d.contains(b) && !b.disabled ? b : null;
}
function hover(c, x, y){
  const b = itemAt(c, x, y);
  c.box.querySelectorAll(".vm-i.hov").forEach(x => { if(x !== b) x.classList.remove("hov"); });
  if(b && !b.classList.contains("hov")){ b.classList.add("hov"); const g = GG(); if(g && g.haptic) try{ g.haptic("selection"); }catch(e){} }
}

/* ---------- cerrar ---------- */
function shut(id, now){
  const c = CUR; if(!c) return;
  CUR = null;
  removeEventListener("hashchange", c.away); removeEventListener("resize", c.away); DOC.removeEventListener("visibilitychange", c.hide);
  ROOT.removeAttribute("data-cmenu");
  const d = c.d;
  try{ d.close(); }catch(e){ d.removeAttribute("open"); }
  /* la pieza vuelve a verse (la copia, encima, se encoge hasta ella) y el foco vuelve a ella (o a lo que se pueda
     enfocar dentro) */
  const [v, pr] = c.vis;
  if(v) c.src.style.setProperty("visibility", v, pr); else c.src.style.removeProperty("visibility");
  const f = focusOf(c.src) || (c.prevFocus && c.prevFocus.isConnected ? c.prevFocus : null);
  if(f){ try{ f.focus({preventScroll: true}); }catch(e){} }
  const done = () => { if(d.isConnected) d.remove(); };
  call(c.res, id === undefined ? null : id);
  if(now){ done(); return; }
  /* sale sin poder tocarse: el menú se funde y la copia vuelve a su sitio */
  d.classList.add("vm-out");
  d.querySelectorAll(".vm-i.hov").forEach(b => b.classList.remove("hov"));
  const scrim = d.querySelector(".vm-scrim"), picked = id !== null && id !== undefined;
  let a;
  if(c.R){
    anim(c.box, [{opacity: 1}, {opacity: 0}], {duration: 120, easing: "ease-out", fill: "forwards"});
    anim(c.pv, [{opacity: 1}, {opacity: 0}], {duration: 120, easing: "ease-out", fill: "forwards"});
    a = anim(scrim, [{opacity: 1}, {opacity: 0}], {duration: 120, easing: "ease-out", fill: "forwards"});
  } else {
    anim(c.box, [{opacity: 1, transform: "scale(1)"}, {opacity: 0, transform: "scale(.8)"}], {duration: picked ? 140 : 180, easing: "ease-in", fill: "forwards"});
    anim(c.pv, [{transform: c.pvT || "none"}, {transform: "none"}], {duration: 240, easing: "cubic-bezier(.3,.9,.4,1)", fill: "forwards"});
    a = anim(scrim, [{opacity: 1}, {opacity: 0}], {duration: 240, easing: "ease-out", fill: "forwards"});
  }
  if(a){ a.onfinish = done; a.oncancel = done; } else done();
  setTimeout(done, 600);   /* por si la animación no termina (pestaña en segundo plano) */
}

/* ---------- mantener pulsado ---------- */
function hold(el, spec, o = {}){
  if(!el) return () => {};
  const offs = [];
  const specOf = () => typeof spec === "function" ? call(spec, el) : spec;
  let mine = false, fb = false;
  const g = GG();
  if(g) offs.push(g.hold(el, {ms: o.ms, touchAction: o.touchAction,
    onHold: ({x, y}) => {
      fb = false; mine = false;
      const s = specOf();
      if(!s){ fb = true; return; }
      mine = true;
      open(el, s, Object.assign({}, o, {x, y, via: "hold"}));
    },
    onMove: ({x, y}) => { if(mine && CUR && CUR.src === el) hover(CUR, x, y); },
    onRelease: ({x, y, moved, cancelled}) => {
      if(fb){ fb = false; if(!moved && !cancelled){ if(typeof o.fallback === "function") call(o.fallback, el); else el.click(); } return; }
      if(!mine) return; mine = false;
      const c = CUR; if(!c || c.src !== el) return;
      const b = moved ? itemAt(c, x, y) : null;
      c.box.querySelectorAll(".vm-i.hov").forEach(x => x.classList.remove("hov"));
      if(b) b.click();   /* el mismo camino que tocarla (y data-say la oye index.html) */
    },
    onCancel: () => { fb = false; mine = false; if(CUR) CUR.box.querySelectorAll(".vm-i.hov").forEach(x => x.classList.remove("hov")); }}));
  /* ratón (clic derecho) y teclado (tecla de menú, Mayús+F10); el dedo ya lo lleva G.hold */
  const ctx = e => {
    if(e.pointerType === "touch" || e.pointerType === "pen" || TOUCH > 0) { e.preventDefault(); return; }
    e.preventDefault();
    const s = specOf(); if(!s) return;
    const key = performance.now() - KEYT < 800 || (!e.pointerType && e.button !== 2);
    open(el, s, Object.assign({}, o, {x: e.clientX, y: e.clientY, via: key ? "key" : "mouse"}));
  };
  el.addEventListener("contextmenu", ctx);
  offs.push(() => el.removeEventListener("contextmenu", ctx));
  return () => { offs.forEach(f => { try{ f(); }catch(e){} }); if(CUR && CUR.src === el) shut(null, true); };
}

W.vocabMenu = {
  open, hold,
  close: now => shut(null, !!now),
  isOpen: el => !!CUR && (!el || CUR.src === el),
  get current(){ return CUR ? {el: CUR.src, spec: CUR.spec, dialog: CUR.d} : null; },
};
})();
