/* Módulo gestures (window.G): deslizar, mantener y arrastrar con Pointer Events, vibración y pistas al estilo TipKit.
   Cada gesto es un atajo: siempre hay un botón visible que hace lo mismo.
   - G.swipe(el, {onMove, onLeft, onRight, onCancel, threshold:.35, limit, touchAction:"pan-y"}) → off()
       Solo en horizontal (el scroll vertical sigue). onMove({dx, raw, dy, p, dir}) mientras arrastra: dx ya con efecto goma
       en el lado que no tiene acción o más allá de limit (px); p = dx / distancia de disparo. Al soltar llama a
       onLeft/onRight({dx, raw, v, vy}) si pasó el 35 % del ancho de el (threshold; si es >1, en px) o iba a ≥0,35 px/ms;
       si no, onCancel({dx, raw, v, vy}). v y vy en px/ms (para M.springTo).
   - G.hold(el, {ms:500, onHold, onMove, onRelease, onCancel, touchAction}) → off(): quieto 500 ms (10 px de tolerancia).
       onHold({x, y}); después onMove({x, y, dx, dy}) y onRelease({x, y, dx, dy, moved}); onCancel() si el aparato lo corta.
   - G.drag(el, {onStart, onMove, onDrop, onCancel, ghost, touchAction:"none"}) → off(). ghost: true (una copia de el), un
       elemento o el => elemento: sigue al dedo y se quita al terminar. Los avisos traen {x, y, dx, dy, over, ghost}
       (over = lo que hay bajo el dedo). onStart puede devolver false; onDrop devuelve true si lo aceptó (si no, el
       fantasma vuelve a su sitio). Mientras se arrastra, el lleva la clase .g-dragging.
   - G.haptic("selection"|"success"): Android con navigator.vibrate; iPhone (iOS 18+) con el truco del interruptor, que
       tiene que ir dentro del toque; si no hay, nada. Con el Sonido apagado (localStorage "mute") no vibra.
   - G.hint(el, {id, text, gesture:"swipe"|"left"|"right"|"hold"|"drag"|"tap", max:3, delay}) → {close()} | null:
       globo sólido pegado a el, con una mano que hace el gesto (3 veces) y ≤5 palabras, y ✕. Una pista por pantalla y
       sesión; nunca con html[data-gm-play], dentro de [data-no-hint] ni en una hoja abierta. Cuenta las veces en
       localStorage "vocab:ui" → {hints: {id: n}} (sin tocar lo demás). G.learned(id) la retira para siempre; lo hacen
       solos la ✕ y usar el gesto en ese elemento.
   - G.swallowClick(ms = 350, x, y): se traga el clic fantasma que llega justo después de un gesto, donde acabó (x, y);
       swipe, hold y drag ya lo hacen. Nunca se traga un el.click() del código ni un clic de teclado.
   Umbrales: arranque 10 px con el dedo y 4 con ratón; eje si |dx| > 1,2·|dy|; swipe y drag ignoran lo que empieza a
   <24 px de los bordes izquierdo y derecho (es el gesto de atrás del sistema). En los elementos con gesto: sin menú de
   «guardar imagen», sin lupa ni selección de texto, imágenes no arrastrables y sin menú contextual.
   Sin teclado: eso llega con la fase 5. Iconos: Phosphor (MIT). */
(() => {
"use strict";
const DOC = document, ROOT = DOC.documentElement;
const EDGE = 24, AXIS = 1.2, TRIG = .35, VTRIG = .35, HOLD_MS = 500, TOL = 10, GHOST_MS = 350;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const now = () => performance.now();
const ts = e => (e && e.timeStamp) || now();
const slopOf = e => e.pointerType === "mouse" ? 4 : 10;
const rm = () => (window.M && typeof M.rm === "function") ? M.rm() : (() => { try{ return matchMedia("(prefers-reduced-motion: reduce)").matches || ROOT.dataset.motion === "calm"; }catch(e){ return false; } })();
const rubber = (x, d, c = .55) => (1 - 1 / (x * c / Math.max(1, d) + 1)) * d;
const call = (f, a) => { if(typeof f !== "function") return; try{ return f(a); }catch(e){ console.error(e); } };
const nearEdge = e => e.pointerType !== "mouse" && (e.clientX < EDGE || e.clientX > innerWidth - EDGE);
const skip = t => !t || !t.closest || !!t.closest("input,textarea,select,[contenteditable=''],[contenteditable=true],[data-no-gesture]");
const unpress = () => { try{ if(window.M && M.unpress) M.unpress(); }catch(e){} };

/* ---------- estilos ---------- */
const DARK = (s, b) => `:root[data-theme=dark] ${s}{${b}}\n@media (prefers-color-scheme:dark){:root:not([data-theme=light]) ${s}{${b}}}`;
const STYLE = `
:where(.g-dragging){opacity:.45}
.g-ghost{box-shadow:0 14px 30px rgb(0 0 0/.22),0 2px 8px rgb(0 0 0/.12)}
.g-hint{position:fixed;left:0;top:0;z-index:25;display:flex;align-items:center;gap:6px;box-sizing:border-box;max-width:min(320px,calc(100vw - 24px));
  padding:4px 2px 4px 12px;border-radius:16px;background:#fff;color:#000;box-shadow:0 10px 30px rgb(0 0 0/.16),0 0 0 .5px rgb(0 0 0/.06);
  font:600 1.0625rem/1.25 system-ui,-apple-system,"Inter",Roboto,sans-serif;text-align:left;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;transform-origin:var(--ax,50%) 100%}
.g-hint[data-side=bottom]{transform-origin:var(--ax,50%) 0}
.g-hint-a{position:absolute;left:var(--ax,50%);width:14px;height:14px;margin-left:-7px;background:inherit;border-radius:2px;rotate:45deg}
.g-hint[data-side=top] .g-hint-a{bottom:-6px;box-shadow:3px 3px 4px rgb(0 0 0/.05)}
.g-hint[data-side=bottom] .g-hint-a{top:-6px}
.g-hint-h{flex:none;display:block;width:30px;height:30px;color:var(--brand-tint,#1E6EF4)}
.g-hint-h svg{display:block;width:100%;height:100%}
.g-hint-t{flex:1 1 auto;min-width:0;padding:8px 0}
.g-hint-x{flex:none;display:grid;place-items:center;width:44px;height:44px;margin:0;padding:0;border:0;border-radius:22px;background:none;color:#6C6C70;cursor:pointer;font:inherit}
.g-hint-x::before{content:"";position:absolute;width:28px;height:28px;border-radius:14px;background:rgb(120 120 128/.16)}
.g-hint-x{position:relative}
.g-hint-x svg{position:relative;width:13px;height:13px}
.g-hint-x:focus-visible{outline:3px solid var(--brand-tint,#1E6EF4);outline-offset:-3px}
${DARK(".g-hint", "background:#2C2C2E;color:#fff;box-shadow:0 10px 30px rgb(0 0 0/.5),0 0 0 .5px rgb(255 255 255/.12)")}
${DARK(".g-hint-x", "color:#AEAEB2")}
${DARK(".g-hint-h", "color:var(--brand-tint,#0091FF)")}
@media (forced-colors:active){.g-hint{border:2px solid CanvasText;background:Canvas;color:CanvasText}.g-hint-h{color:CanvasText}}
.g-hint .g-hint-h svg{animation:var(--g-anim,none) 1.5s ease-in-out .35s 3 both}
.g-hint.g-still .g-hint-h svg{animation:none}
.g-hint[data-g=swipe],.g-hint[data-g=left]{--g-anim:g-left}
.g-hint[data-g=right]{--g-anim:g-right}
.g-hint[data-g=hold]{--g-anim:g-hold}
.g-hint[data-g=tap]{--g-anim:g-tap}
.g-hint[data-g=drag]{--g-anim:g-drag}
@keyframes g-left{0%{translate:6px 0;scale:1}15%{translate:6px 0;scale:.86}65%{translate:-10px 0;scale:.86}80%,100%{translate:6px 0;scale:1}}
@keyframes g-right{0%{translate:-6px 0;scale:1}15%{translate:-6px 0;scale:.86}65%{translate:10px 0;scale:.86}80%,100%{translate:-6px 0;scale:1}}
@keyframes g-hold{0%,100%{scale:1}15%,70%{scale:.82}}
@keyframes g-tap{0%,40%,100%{scale:1}20%{scale:.8}}
@keyframes g-drag{0%{translate:-4px 4px;scale:1}15%{translate:-4px 4px;scale:.86}65%{translate:8px -6px;scale:.86}80%,100%{translate:-4px 4px;scale:1}}
@media (prefers-reduced-motion:reduce){.g-hint .g-hint-h svg{animation:none}}
:root[data-motion=calm] .g-hint .g-hint-h svg{animation:none}
`;
if(!DOC.getElementById("css-gestures")){ const st = DOC.createElement("style"); st.id = "css-gestures"; st.textContent = STYLE; DOC.head.appendChild(st); }

/* ---------- clic fantasma ----------
   Solo el clic que el navegador genera al soltar el dedo o el ratón donde acabó el gesto (a <40 px), y uno solo.
   Pasan siempre los clics del código (el.click() en onLeft/onRelease…, isTrusted falso) y los del teclado (detail 0). */
const GHOST_R = 40;
let SW = 0, SWX = NaN, SWY = NaN;
addEventListener("click", e => {
  if(now() >= SW || !e.isTrusted || e.detail === 0) return;
  if(Number.isFinite(SWX) && Math.hypot(e.clientX - SWX, e.clientY - SWY) > GHOST_R) return;
  const t = e.target; if(t && t.closest && t.closest("[data-g-haptic]")) return;
  SW = 0;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
/* x, y: dónde acabó el gesto (sin ellos, cualquier clic de la persona durante ms) */
const swallowClick = (ms = GHOST_MS, x, y) => {
  SW = Math.max(SW, now() + ms);
  const pt = Number.isFinite(x) && Number.isFinite(y);
  SWX = pt ? x : NaN; SWY = pt ? y : NaN;
};
const swallowAt = e => swallowClick(GHOST_MS, e && e.clientX, e && e.clientY);

/* ---------- quién se queda cada dedo (gestos anidados: gana el primero que arranca) ---------- */
const CLAIM = new Map();
const claim = (id, who) => CLAIM.set(id, who);
const taken = (id, who) => CLAIM.has(id) && CLAIM.get(id) !== who;
const free = e => setTimeout(() => { if(!CLAIM.has(e.pointerId)) return; CLAIM.delete(e.pointerId); }, 0);
addEventListener("pointerup", free); addEventListener("pointercancel", free);
const capture = (el, id) => { try{ if(!el.hasPointerCapture(id)) el.setPointerCapture(id); }catch(e){} };

/* ---------- lo común a todos los elementos con gesto ---------- */
const PREP = new WeakSet();
const noMenu = e => e.preventDefault();
function prep(el, ta){
  if(ta) el.style.touchAction = ta;
  const st = el.style;
  st.setProperty("-webkit-touch-callout", "none"); st.setProperty("-webkit-user-select", "none"); st.setProperty("user-select", "none"); st.setProperty("-webkit-user-drag", "none");
  if(el.tagName === "IMG") el.draggable = false;
  el.querySelectorAll("img").forEach(i => { i.draggable = false; });
  if(!PREP.has(el)){ PREP.add(el); el.addEventListener("contextmenu", noMenu); el.addEventListener("dragstart", noMenu); }
}
function tracker(){
  const S = [];
  return {
    add(e){ S.push([ts(e), e.clientX, e.clientY]); while(S.length > 2 && S[S.length - 1][0] - S[0][0] > 100) S.shift(); },
    v(){ if(S.length < 2) return {x: 0, y: 0}; const a = S[0], b = S[S.length - 1], dt = b[0] - a[0]; return dt > 0 ? {x: (b[1] - a[1]) / dt, y: (b[2] - a[2]) / dt} : {x: 0, y: 0}; },
  };
}
/* escucha el dedo en toda la ventana mientras dura el gesto */
function follow(h){
  const o = {capture: true, passive: true};
  addEventListener("pointermove", h.move, o); addEventListener("pointerup", h.up, o); addEventListener("pointercancel", h.cancel, o);
  return () => { removeEventListener("pointermove", h.move, o); removeEventListener("pointerup", h.up, o); removeEventListener("pointercancel", h.cancel, o); };
}

/* ---------- deslizar ---------- */
function swipe(el, o = {}){
  if(!el) return () => {};
  prep(el, o.touchAction || "pan-y");
  let S = null, unfollow = null;
  const stop = () => { if(unfollow) unfollow(); unfollow = null; S = null; };
  const shape = (raw, w) => {
    const can = raw < 0 ? !!o.onLeft : !!o.onRight, lim = can ? (o.limit > 0 ? o.limit : Infinity) : 0, a = Math.abs(raw);
    return a <= lim ? raw : Math.sign(raw) * (lim + rubber(a - lim, w));
  };
  const down = e => {
    if(S || !e.isPrimary || e.button > 0 || nearEdge(e) || skip(e.target)) return;
    const w = el.offsetWidth || el.getBoundingClientRect().width || innerWidth;
    const th = o.threshold > 1 ? o.threshold : w * (o.threshold > 0 ? o.threshold : TRIG);
    S = {id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, w, th, slop: slopOf(e), tr: tracker(), dx: 0};
    S.tr.add(e);
    unfollow = follow({move, up, cancel});
  };
  const move = e => {
    if(!S || e.pointerId !== S.id) return;
    const raw = e.clientX - S.x0, dy = e.clientY - S.y0;
    S.tr.add(e);
    if(!S.on){
      if(Math.hypot(raw, dy) < S.slop) return;
      if(Math.abs(raw) <= AXIS * Math.abs(dy) || taken(e.pointerId, S)) return stop();
      S.on = true; claim(e.pointerId, S); capture(el, e.pointerId); unpress();
    }
    S.dx = shape(raw, S.w);
    call(o.onMove, {dx: S.dx, raw, dy, p: S.dx / S.th, dir: S.dx < 0 ? "left" : "right", el, e});
  };
  const up = e => {
    if(!S || e.pointerId !== S.id) return;
    const s = S; stop(); if(!s.on) return;
    s.tr.add(e); swallowAt(e);
    const raw = e.clientX - s.x0, v = s.tr.v(), dx = shape(raw, s.w);
    const go = Math.abs(raw) >= s.th || (Math.abs(v.x) >= VTRIG && Math.sign(v.x) === Math.sign(raw));
    const fn = go ? (raw < 0 ? o.onLeft : o.onRight) : null, info = {dx, raw, v: v.x, vy: v.y, dir: raw < 0 ? "left" : "right", el, e};
    if(typeof fn === "function"){ learnOn(el); call(fn, info); } else call(o.onCancel, info);
  };
  const cancel = e => {
    if(!S || e.pointerId !== S.id) return;
    const s = S; stop();
    if(s.on) call(o.onCancel, {dx: s.dx, raw: s.dx, v: 0, vy: 0, dir: s.dx < 0 ? "left" : "right", el, e, cancelled: true});
  };
  el.addEventListener("pointerdown", down, {passive: true});
  return () => { el.removeEventListener("pointerdown", down, {passive: true}); stop(); };
}

/* ---------- mantener pulsado ---------- */
function hold(el, o = {}){
  if(!el) return () => {};
  prep(el, o.touchAction);
  const ms = o.ms > 0 ? o.ms : HOLD_MS;
  let S = null, unfollow = null;
  const stop = () => { if(S) clearTimeout(S.timer); if(unfollow) unfollow(); unfollow = null; S = null; };
  const info = (s, e) => ({x: s.x, y: s.y, dx: s.x - s.x0, dy: s.y - s.y0, moved: Math.hypot(s.x - s.x0, s.y - s.y0) > TOL, el, e});
  const fire = () => {
    const s = S; if(!s) return;
    if(taken(s.id, s)) return stop();
    s.held = true; claim(s.id, s); capture(el, s.id); unpress(); learnOn(el);
    call(o.onHold, {x: s.x, y: s.y, el});
  };
  const down = e => {
    if(S || !e.isPrimary || e.button > 0 || skip(e.target)) return;
    S = {id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, held: false, timer: setTimeout(fire, ms)};
    unfollow = follow({move, up, cancel});
  };
  const move = e => {
    if(!S || e.pointerId !== S.id) return;
    S.x = e.clientX; S.y = e.clientY;
    if(!S.held){ if(Math.hypot(S.x - S.x0, S.y - S.y0) > TOL) stop(); return; }
    call(o.onMove, info(S, e));
  };
  const up = e => {
    if(!S || e.pointerId !== S.id) return;
    const s = S; s.x = e.clientX; s.y = e.clientY; stop();
    if(s.held){ swallowAt(e); call(o.onRelease, info(s, e)); }
  };
  const cancel = e => {
    if(!S || e.pointerId !== S.id) return;
    const s = S; stop();
    if(s.held){ swallowAt(e); if(typeof o.onCancel === "function") call(o.onCancel, info(s, e)); else call(o.onRelease, Object.assign(info(s, e), {cancelled: true})); }
  };
  el.addEventListener("pointerdown", down, {passive: true});
  return () => { el.removeEventListener("pointerdown", down, {passive: true}); stop(); };
}

/* ---------- arrastrar ---------- */
function makeGhost(el, g, r){
  let n = null;
  try{
    if(g === true){
      n = el.cloneNode(true); n.removeAttribute("id"); n.querySelectorAll("[id]").forEach(x => x.removeAttribute("id"));
      n.classList.remove("g-dragging", "is-pressed", "m-bump");
      const cs = getComputedStyle(el);
      for(const k of ["display", "alignItems", "justifyContent", "gap", "padding", "font", "color", "background", "borderRadius", "lineHeight", "textAlign"]) n.style[k] = cs[k];
    } else if(typeof g === "function") n = g(el);
    else if(g && g.nodeType === 1) n = g;
  }catch(e){ console.error(e); }
  if(!n) return null;
  n.classList.add("g-ghost"); n.setAttribute("aria-hidden", "true");
  Object.assign(n.style, {position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", margin: "0",
    pointerEvents: "none", zIndex: "40", boxSizing: "border-box", translate: "0 0", opacity: "1"});
  (el.closest("dialog[open]") || DOC.body).appendChild(n);
  if(!rm() && n.animate) try{ n.animate([{scale: 1}, {scale: 1.06}], {duration: 160, easing: "ease-out", fill: "forwards"}); }catch(e){}
  return n;
}
function dropGhost(n, ok, v){
  if(!n) return;
  const gone = () => n.remove();
  let a = null;
  try{
    if(ok || rm()) a = n.animate([{opacity: 1}, {opacity: 0, scale: ok && !rm() ? .6 : 1}], {duration: rm() ? 120 : 180, easing: "ease-in", fill: "forwards"});
    else if(window.M && M.springTo){ a = M.springTo(n, {translate: "0 0"}, {velocity: v, commit: false}); }
    else a = n.animate([{translate: "0 0"}], {duration: 260, easing: "cubic-bezier(.2,.9,.25,1)", fill: "forwards"});
  }catch(e){}
  if(a) a.finished.then(gone, gone); else gone();
  setTimeout(gone, 1500);
}
function drag(el, o = {}){
  if(!el) return () => {};
  prep(el, o.touchAction || "none");
  let S = null, unfollow = null;
  const stop = () => { if(unfollow) unfollow(); unfollow = null; S = null; };
  const hit = (x, y) => { try{ return DOC.elementFromPoint(x, y); }catch(e){ return null; } };
  const info = (s, e) => ({x: e.clientX, y: e.clientY, dx: e.clientX - s.x0, dy: e.clientY - s.y0, over: hit(e.clientX, e.clientY), ghost: s.ghost, el, e});
  const down = e => {
    if(S || !e.isPrimary || e.button > 0 || nearEdge(e) || skip(e.target)) return;
    S = {id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, slop: slopOf(e), tr: tracker(), ghost: null};
    S.tr.add(e);
    unfollow = follow({move, up, cancel});
  };
  const move = e => {
    if(!S || e.pointerId !== S.id) return;
    S.tr.add(e);
    const dx = e.clientX - S.x0, dy = e.clientY - S.y0;
    if(!S.on){
      if(Math.hypot(dx, dy) < S.slop) return;
      if(taken(e.pointerId, S)) return stop();
      S.on = true; claim(e.pointerId, S); capture(el, e.pointerId); unpress();
      if(o.ghost) S.ghost = makeGhost(el, o.ghost, el.getBoundingClientRect());
      el.classList.add("g-dragging");
      if(call(o.onStart, info(S, e)) === false){ el.classList.remove("g-dragging"); if(S.ghost) S.ghost.remove(); return stop(); }
    }
    if(S.ghost) S.ghost.style.translate = `${dx}px ${dy}px`;
    call(o.onMove, info(S, e));
  };
  const up = e => {
    if(!S || e.pointerId !== S.id) return;
    const s = S; stop(); if(!s.on) return;
    s.tr.add(e); swallowAt(e);
    el.classList.remove("g-dragging");
    const ok = call(o.onDrop, info(s, e)) === true;
    if(ok) learnOn(el);
    dropGhost(s.ghost, ok, s.tr.v());
  };
  const cancel = e => {
    if(!S || e.pointerId !== S.id) return;
    const s = S; stop(); if(!s.on) return;
    swallowAt(e); el.classList.remove("g-dragging");
    dropGhost(s.ghost, false, {x: 0, y: 0});
    call(o.onCancel, info(s, e));
  };
  el.addEventListener("pointerdown", down, {passive: true});
  return () => { el.removeEventListener("pointerdown", down, {passive: true}); stop(); };
}

/* ---------- vibración ---------- */
const SWITCH = (() => { try{ const i = DOC.createElement("input"); i.type = "checkbox"; i.setAttribute("switch", ""); return "switch" in i; }catch(e){ return false; } })();
const VIB = typeof navigator.vibrate === "function";
const mute = () => { try{ return JSON.parse(localStorage.getItem("mute")) === true; }catch(e){ return false; } };
const halt = e => e.stopPropagation();
function haptic(type = "selection"){
  if(mute()) return false;
  try{
    if(VIB && !SWITCH){
      if(navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
      return navigator.vibrate(type === "success" ? [14, 60, 22] : 10);
    }
    if(SWITCH){
      /* iOS 18+: al cambiar un <input switch> el iPhone da un toque (tiene que ser dentro del gesto del niño) */
      const l = DOC.createElement("label"), i = DOC.createElement("input");
      l.setAttribute("aria-hidden", "true"); l.setAttribute("data-g-haptic", ""); l.style.display = "none";
      i.type = "checkbox"; i.setAttribute("switch", ""); i.tabIndex = -1;
      for(const ev of ["click", "input", "change"]){ l.addEventListener(ev, halt); i.addEventListener(ev, halt); }
      l.appendChild(i); DOC.head.appendChild(l); l.click(); l.remove();
      return true;
    }
  }catch(e){}
  return false;
}

/* ---------- pistas ---------- */
const UI = "vocab:ui", LEARNED = 1000;
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
function uiGet(){ try{ const v = JSON.parse(localStorage.getItem(UI)); return isObj(v) ? v : {}; }catch(e){ return {}; } }
function hintN(id){ const h = uiGet().hints; return isObj(h) && typeof h[id] === "number" ? h[id] : 0; }
function hintSet(id, n){
  try{ const ui = uiGet(); if(!isObj(ui.hints)) ui.hints = {}; ui.hints[id] = n; localStorage.setItem(UI, JSON.stringify(ui)); }catch(e){}
}
const SKEY = "g:hint-screens";
let SCREENS = null;
function screens(){
  if(SCREENS) return SCREENS;
  try{ const a = JSON.parse(sessionStorage.getItem(SKEY)); SCREENS = new Set(Array.isArray(a) ? a : []); }catch(e){ SCREENS = new Set(); }
  return SCREENS;
}
function screenUsed(k){ screens().add(k); try{ sessionStorage.setItem(SKEY, JSON.stringify([...SCREENS])); }catch(e){} }
const screenKey = () => (location.hash.replace(/^#\/?/, "").split(/[/?]/)[0]) || "hoy";
const SAY = {swipe: "Desliza para seguir", left: "Desliza a la izquierda", right: "Desliza a la derecha", hold: "Mantén pulsado", drag: "Arrástralo con el dedo", tap: "Toca aquí"};
const HAND = `<svg viewBox="0 0 256 256" aria-hidden="true"><path fill="currentColor" d="M224,104v50.93c0,46.2-36.85,84.55-83,85.06A83.71,83.71,0,0,1,80.6,215.4C58.79,192.33,34.15,136,34.15,136a16,16,0,0,1,6.53-22.23c7.66-4,17.1-.84,21.4,6.62l21,36.44a6.09,6.09,0,0,0,6,3.09l.12,0A8.19,8.19,0,0,0,96,151.74V32a16,16,0,0,1,16.77-16c8.61.4,15.23,7.82,15.23,16.43V104a8,8,0,0,0,8.53,8,8.17,8.17,0,0,0,7.47-8.25V88a16,16,0,0,1,16.77-16c8.61.4,15.23,7.82,15.23,16.43V112a8,8,0,0,0,8.53,8,8.17,8.17,0,0,0,7.47-8.25v-7.28c0-8.61,6.62-16,15.23-16.43A16,16,0,0,1,224,104Z"/></svg>`;
const XMARK = `<svg viewBox="0 0 256 256" aria-hidden="true"><path fill="currentColor" d="M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z"/></svg>`;
let CUR = null;
const banned = el => ROOT.hasAttribute("data-gm-play") || !el.isConnected || !!el.closest("[data-no-hint]") || !!el.closest("dialog[open]");
function visibleRect(el){
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth ? r : null;
}
let SAFE = null;
function safeTop(){
  if(!SAFE){ SAFE = DOC.createElement("div"); SAFE.setAttribute("aria-hidden", "true"); SAFE.style.cssText = "position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none"; DOC.body.appendChild(SAFE); }
  return SAFE.offsetHeight || 0;
}
function placeHint(H){
  const r = visibleRect(H.el), b = H.node;
  if(!r){ b.style.visibility = "hidden"; return; }
  b.style.visibility = "";
  const bw = b.offsetWidth, bh = b.offsetHeight, m = 12, gap = 12, top = safeTop() + 8;
  let side = r.top - gap - bh >= top ? "top" : "bottom";
  if(side === "bottom" && r.bottom + gap + bh > innerHeight - 8 && r.top - gap - bh >= 8) side = "top";
  const y = side === "top" ? r.top - gap - bh : Math.min(r.bottom + gap, innerHeight - bh - 8);
  const cx = r.left + r.width / 2, x = clamp(cx - bw / 2, m, Math.max(m, innerWidth - m - bw));
  b.dataset.side = side;
  b.style.left = Math.round(x) + "px"; b.style.top = Math.round(y) + "px";
  b.style.setProperty("--ax", Math.round(clamp(cx - x, 22, bw - 22)) + "px");
}
function hint(el, o = {}){
  const id = o.id && String(o.id);
  if(!el || el.nodeType !== 1 || !id || CUR || banned(el)) return null;
  const max = o.max > 0 ? o.max : 3;
  if(hintN(id) >= max) return null;
  const key = screenKey(); if(screens().has(key)) return null;
  const gesture = SAY[o.gesture] ? o.gesture : "swipe", text = String(o.text || SAY[gesture]);
  const H = {id, el, node: null, closed: false, timers: [], offs: []};
  CUR = H;
  const close = learned => {
    if(H.closed) return; H.closed = true;
    H.timers.forEach(t => { clearTimeout(t); clearInterval(t); }); H.offs.forEach(f => f());
    if(learned) hintSet(id, LEARNED);
    if(CUR === H) CUR = null;
    const n = H.node; if(!n) return;
    let a = null;
    try{ a = n.animate([{opacity: 1}, {opacity: 0, scale: rm() ? 1 : .94}], {duration: rm() ? 120 : 160, easing: "ease-in", fill: "forwards"}); }catch(e){}
    if(a) a.finished.then(() => n.remove(), () => n.remove()); else n.remove();
  };
  H.close = close;
  const show = () => {
    if(H.closed) return;
    if(banned(el) || !visibleRect(el) || hintN(id) >= max || screens().has(key)){ close(false); return; }
    const n = H.node = DOC.createElement("div");
    n.className = "g-hint"; n.dataset.g = gesture; n.setAttribute("role", "status"); n.setAttribute("aria-live", "polite"); n.setAttribute("data-press", "none");
    n.innerHTML = `<span class="g-hint-h" aria-hidden="true">${HAND}</span><span class="g-hint-t"></span><button type="button" class="g-hint-x" aria-label="Cerrar pista" title="Cerrar pista">${XMARK}</button><i class="g-hint-a" aria-hidden="true"></i>`;
    n.querySelector(".g-hint-t").textContent = text;
    n.querySelector(".g-hint-x").addEventListener("click", e => { e.stopPropagation(); close(true); });
    DOC.body.appendChild(n);
    el.setAttribute("data-g-hint", id);
    hintSet(id, hintN(id) + 1); screenUsed(key);
    placeHint(H);
    try{ n.animate(rm() ? [{opacity: 0}, {opacity: 1}] : [{opacity: 0, scale: .9}, {opacity: 1, scale: 1}], rm() ? {duration: 150, easing: "ease-out"} : {duration: 320, easing: "cubic-bezier(.2,.9,.25,1)"}); }catch(e){}
    let raf = 0;
    const re = () => { if(!raf) raf = requestAnimationFrame(() => { raf = 0; if(!H.closed) placeHint(H); }); };
    const pd = e => {
      n.classList.add("g-still");                                   /* la mano para al primer toque */
      if(n.contains(e.target) || el.contains(e.target)) return;
      close(false);                                                 /* tocar en otro sitio la quita (sin darla por aprendida) */
    };
    const hc = () => close(false);
    addEventListener("scroll", re, {capture: true, passive: true}); addEventListener("resize", re);
    addEventListener("pointerdown", pd, {capture: true, passive: true}); addEventListener("hashchange", hc);
    H.offs.push(() => { removeEventListener("scroll", re, {capture: true, passive: true}); removeEventListener("resize", re); removeEventListener("pointerdown", pd, {capture: true, passive: true}); removeEventListener("hashchange", hc); if(raf) cancelAnimationFrame(raf); });
    H.timers.push(setInterval(() => { if(banned(el)) close(false); else placeHint(H); }, 400));
  };
  H.timers.push(setTimeout(show, o.delay >= 0 ? o.delay : 500));
  return {close: () => close(false), get shown(){ return !!H.node && !H.closed; }};
}
function learned(id){
  if(!id) return;
  hintSet(String(id), LEARNED);
  if(CUR && CUR.id === String(id)) CUR.close(false);
}
/* usar el gesto donde estaba la pista la da por aprendida */
function learnOn(el){
  try{
    const h = (el.closest && el.closest("[data-g-hint]")) || (el.querySelector && el.querySelector("[data-g-hint]"));
    if(h) learned(h.getAttribute("data-g-hint"));
  }catch(e){}
}

window.G = {swipe, hold, drag, haptic, hint, learned, swallowClick,
  get T(){ return {edge: EDGE, axis: AXIS, trigger: TRIG, velocity: VTRIG, hold: HOLD_MS, tolerance: TOL, ghost: GHOST_MS}; }};
})();
