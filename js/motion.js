/* Módulo motion (window.M): muelles, respuesta al pulsar, monedas que vuelan, chispas, confeti, avisos y hojas.
   - M.rm() → true con «Reducir movimiento» del aparato o con html[data-motion=calm]. Entonces todo es un fundido de
     ≤160 ms sin desplazamientos; los colores y la ✓/✗ se quedan igual.
   - Al pulsar (delegado en document; nunca :active y sin sonido): .glass-btn, .btn-fill y .glass que se pueden tocar
     crecen a 1,06 y reciben --mx/--my (el dedo, en %); un botón suelto dentro de un .glass (pestañas, monedas) crece él.
     Las .card que se pueden tocar (a, button, role, tabindex, onclick) y [data-press~=sink] se hunden a .97
     ([data-press~=grow] crece). .is-pressed entra a los 75 ms si el dedo no se movió >10 px (al instante con ratón, en la
     barra de pestañas, en .glass-btn--pri/.btn-pri y en [data-press~=instant]) y se quita al soltar, con pointercancel o
     al mover >10 px. [data-press=none] lo apaga. M.unpress() suelta lo que esté pulsado.
   - M.ok(el, {haptic}) rebote 1→1,04→1 y dibuja el svg.chk de dentro · M.nope(el) ±6 px en 300 ms (solo errores de manejo,
     nunca al fallar una respuesta) · M.bump(el, ms) el saltito de una sola clase (.m-bump).
   - M.coins(n, from, why, {quiet}) → Promise: 3-8 monedas en arco desde from (elemento o {x, y}) hasta M.coinTarget(),
     cada 60 ms y con una nota más aguda (sfx.note(i) si existe; si no, un tono propio; respeta Sonido); why sale en la
     cápsula de avisos. M.coinTarget() → el primero visible de [data-coin-target], #coins o [data-coins-pill]; si no hay
     ninguno, un punto invisible arriba a la derecha (#m-coin-corner).
   - M.burst(x, y, {colors, n}) o M.burst(el, {…}) chispas oro, azul y verde azulado · M.confetti({x, y, n}) ≤60 piezas.
   - M.toast(text, {icon, ms}) cápsula de avisos arriba (role=status), en cola y de una en una. icon: "coin", un emoji
     o un "<svg…>". Usa .glass si la página la tiene; si no, un vidrio propio.
   - M.openSheet(dialog, {from}) · M.closeSheet(dialog, {velocity}) → Promise: hoja que sube desde abajo (@starting-style,
     o animate() si el navegador no lo tiene; desde su botón con from), con agarre (.m-grab o [data-sheet-grab]) que se
     arrastra 1:1, y que se cierra al bajarla, al tocar fuera y con Esc, siempre con dialog.close() de verdad (los
     oyentes de "close" siguen funcionando). Mientras hay una abierta: html[data-sheet].
   - M.springTo(el, keyframes, {velocity, damping:.86, response:.35, commit}) → Animation: muelle que conserva la velocidad
     del dedo (px/ms, número o {x, y}); keyframes de animate(), o uno solo y sale de donde esté. M.spring(d, r, v0) → {easing, ms}.
   Pone en :root (solo si faltan): --d-press 90ms · --d-fast 160ms · --d-base 260ms · --d-slow 420ms ·
   --sp-snappy (amortiguación .86, va con --d-slow) · --sp-bouncy (.7, solo premios, ~700 ms); linear() con
   cubic-bezier de reserva. */
(() => {
"use strict";
const DOC = document, ROOT = DOC.documentElement;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const now = () => performance.now();
const RMQ = (() => { try{ return matchMedia("(prefers-reduced-motion: reduce)"); }catch(e){ return {matches: false}; } })();
const rm = () => !!RMQ.matches || ROOT.dataset.motion === "calm";
const GOLD = "#FFCC00", BLUE = "#1E6EF4", TEAL = "#008198";
const LIN = (() => { try{ return CSS.supports("transition-timing-function", "linear(0, 1)"); }catch(e){ return false; } })();
const POP = typeof HTMLElement !== "undefined" && typeof HTMLElement.prototype.showPopover === "function";
const STARTING = typeof window.CSSStartingStyleRule !== "undefined";
const EASE_OUT = "cubic-bezier(.2,.9,.25,1)";

/* ---------- muelles ----------
   Muelle con amortiguación d (1 = sin rebote) y periodo r (s), que sale con velocidad v0 (en «trayectos por segundo»).
   Se muestrea en una curva linear() que vale para animate() y para CSS. */
function spring(damping = .86, response = .35, v0 = 0){
  const z = clamp(+damping || .86, .05, 1), w = 2 * Math.PI / Math.max(.05, +response || .35);
  let pos, env;
  if(z < 1){
    const wd = w * Math.sqrt(1 - z * z), B = (v0 - z * w) / wd, amp = Math.sqrt(1 + B * B);
    pos = t => 1 + Math.exp(-z * w * t) * (-Math.cos(wd * t) + B * Math.sin(wd * t));
    env = t => amp * Math.exp(-z * w * t);
  } else {
    const B = v0 - w;
    pos = t => 1 + (-1 + B * t) * Math.exp(-w * t);
    env = t => (1 + Math.abs(B) * t) * Math.exp(-w * t);
  }
  let T = 1 / 60; while(T < 3 && env(T) > .002) T += 1 / 120;
  const n = clamp(Math.round(T * 60), 12, 64), pts = [0];
  for(let i = 1; i < n; i++) pts.push(+pos(T * i / n).toFixed(4));
  pts.push(1);
  return {easing: `linear(${pts.join(",")})`, ms: Math.round(T * 1000)};
}
const SNAPPY = spring(.86, .35), BOUNCY = spring(.7, .5);
const easeOf = s => LIN ? s.easing : EASE_OUT;

/* animate() a prueba de navegadores: si no entiende la curva o el composite, prueba sin ellos */
function anim(el, kf, o){
  if(!el || typeof el.animate !== "function") return null;
  try{ return el.animate(kf, o); }
  catch(e){
    try{ const p = Object.assign({}, o, {easing: EASE_OUT}); delete p.composite; return el.animate(kf.map ? kf.map(f => { const g = Object.assign({}, f); delete g.easing; delete g.composite; return g; }) : kf, p); }
    catch(e2){ return null; }
  }
}
const js = a => !(window.CSSTransition && a instanceof CSSTransition) && !(window.CSSAnimation && a instanceof CSSAnimation);
const stopJs = el => { try{ el.getAnimations().forEach(a => { if(js(a)) a.cancel(); }); }catch(e){} };
const rubber = (x, d, c = .55) => (1 - 1 / (x * c / Math.max(1, d) + 1)) * d;

/* ---------- estilos ---------- */
function tokens(){
  let cs = null; try{ cs = getComputedStyle(ROOT); }catch(e){}
  const has = k => cs && cs.getPropertyValue(k).trim();
  const D = {"--d-press": "90ms", "--d-fast": "160ms", "--d-base": "260ms", "--d-slow": "420ms"};
  const S = {"--sp-snappy": [SNAPPY.easing, EASE_OUT], "--sp-bouncy": [BOUNCY.easing, "cubic-bezier(.34,1.56,.64,1)"]};
  let a = "", b = "";
  for(const k in D) if(!has(k)) a += `${k}:${D[k]};`;
  for(const k in S) if(!has(k)){ a += `${k}:${S[k][1]};`; b += `${k}:${S[k][0]};`; }
  return (a ? `:where(:root){${a}}\n` : "") + (b ? `@supports (transition-timing-function:linear(0,1)){:where(:root){${b}}}\n` : "");
}
const DARK = s => `:root[data-theme=dark] ${s}`;
const DARKQ = (s, body) => `${DARK(s)}{${body}}\n@media (prefers-color-scheme:dark){:root:not([data-theme=light]) ${s}{${body}}}`;
const STYLE = () => tokens() + `
/* saltito de una sola clase (monedas que llegan, insignias) */
.m-bump{animation:m-bump var(--m-bump-d,420ms) cubic-bezier(.3,.7,.4,1) both}
@keyframes m-bump{0%{scale:1}22%{scale:1.16}55%{scale:1.05}100%{scale:1}}
@keyframes m-dim{50%{opacity:.55}}
@media (prefers-reduced-motion:reduce){.m-bump{animation:m-dim 150ms ease both}}
:root[data-motion=calm] .m-bump{animation:m-dim 150ms ease both}

/* capa de efectos (monedas, chispas, confeti): encima de todo, también de las hojas abiertas */
#m-fx{position:fixed;inset:0;width:auto;height:auto;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;overflow:visible;pointer-events:none;z-index:31;color:inherit}
#m-fx .m-coin{position:absolute;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;will-change:transform}
#m-fx .m-coin svg{display:block;width:100%;height:100%;filter:drop-shadow(0 2px 3px rgb(0 0 0/.2))}
#m-fx .m-spark{position:absolute;left:0;top:0;clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%);will-change:transform}
#m-fx .m-confetti{position:absolute;left:0;top:0;width:100%;height:100%}
#m-coin-corner{position:fixed;top:calc(env(safe-area-inset-top,0px) + 24px);right:calc(env(safe-area-inset-right,0px) + 44px);width:2px;height:2px;pointer-events:none;visibility:hidden}

/* cápsula de avisos, arriba bajo la zona segura */
#m-toasts{position:fixed;inset:calc(env(safe-area-inset-top,0px) + 8px) 0 auto 0;width:auto;height:auto;max-width:none;max-height:none;margin:0;padding:0 16px;border:0;background:transparent;overflow:visible;justify-content:center;pointer-events:none;z-index:30;color:inherit}
#m-toasts:not([popover]){display:flex}
#m-toasts:popover-open{display:flex}
#m-toasts .m-toast{pointer-events:auto;display:flex;align-items:center;gap:8px;box-sizing:border-box;min-height:44px;max-width:min(520px,100%);padding:10px 18px;border-radius:999px;font:600 var(--fs-sub,1.0625rem)/1.3 var(--f-text,system-ui,-apple-system,"Inter",Roboto,sans-serif);color:var(--label,#000);text-align:left;cursor:default;-webkit-user-select:none;user-select:none}
#m-toasts .m-ti{flex:none;display:grid;place-items:center;width:24px;height:24px;font-size:1.25rem;line-height:1}
#m-toasts .m-ti svg{display:block;width:24px;height:24px}
#m-toasts .m-own{background:rgb(255 255 255/.74);border:1px solid rgb(255 255 255/.6);background-clip:padding-box;box-shadow:inset 0 1px 0 rgb(255 255 255/.65),0 0 0 .5px rgb(0 0 0/.08),0 6px 20px rgb(11 37 69/.14);-webkit-backdrop-filter:blur(16px) saturate(170%);backdrop-filter:blur(16px) saturate(170%)}
${DARKQ("#m-toasts .m-toast", "color:var(--label,#fff)")}
${DARKQ("#m-toasts .m-own", "background:rgb(28 28 30/.68);border-color:rgb(255 255 255/.22);box-shadow:inset 0 1px 0 rgb(255 255 255/.22),0 6px 20px rgb(0 0 0/.4)")}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){#m-toasts .m-own{background:rgb(255 255 255/.96)}${DARK("#m-toasts .m-own")}{background:rgb(28 28 30/.96)}}
:root[data-glass=off] #m-toasts .m-own{background:#fff;-webkit-backdrop-filter:none;backdrop-filter:none}
:root[data-glass=off][data-theme=dark] #m-toasts .m-own{background:#1C1C1E}
@media (prefers-reduced-transparency:reduce){#m-toasts .m-own{background:#fff;-webkit-backdrop-filter:none;backdrop-filter:none}${DARK("#m-toasts .m-own")}{background:#1C1C1E}}
@media (prefers-contrast:more){#m-toasts .m-own{background:#fff;border:2px solid #000;-webkit-backdrop-filter:none;backdrop-filter:none}${DARK("#m-toasts .m-own")}{background:#1C1C1E;border-color:#fff}}
@media (forced-colors:active){#m-toasts .m-toast{border:2px solid CanvasText;background:Canvas;color:CanvasText}}

/* hojas */
dialog.m-sheet{position:fixed;inset:auto 0 8px 0;margin:0 auto;width:calc(100% - 16px);max-width:640px;max-height:calc(100vh - 24px);max-height:calc(100dvh - env(safe-area-inset-top,0px) - 24px);box-sizing:border-box;overflow:auto;overscroll-behavior:contain;border:0;border-radius:32px;padding:0 16px max(16px,env(safe-area-inset-bottom,0px));background:var(--card,#fff);color:inherit;box-shadow:0 12px 40px rgb(0 0 0/.18);translate:none;
  transition:translate var(--d-slow,420ms) var(--sp-snappy,ease-out);
  transition:translate var(--d-slow,420ms) var(--sp-snappy,ease-out),display var(--d-slow,420ms) allow-discrete,overlay var(--d-slow,420ms) allow-discrete}
dialog.m-sheet:not([open]){translate:0 calc(100% + 24px);
  transition:translate var(--d-base,260ms) cubic-bezier(.3,0,.8,.4);
  transition:translate var(--d-base,260ms) cubic-bezier(.3,0,.8,.4),display var(--d-base,260ms) allow-discrete,overlay var(--d-base,260ms) allow-discrete}
@starting-style{dialog.m-sheet[open]{translate:0 calc(100% + 24px)}}
dialog.m-sheet::backdrop{background:rgb(0 0 0/.2);opacity:var(--m-bd,1);
  transition:opacity var(--d-base,260ms) ease;
  transition:opacity var(--d-base,260ms) ease,display var(--d-slow,420ms) allow-discrete,overlay var(--d-slow,420ms) allow-discrete}
dialog.m-sheet:not([open])::backdrop{opacity:0}
@starting-style{dialog.m-sheet[open]::backdrop{opacity:0}}
dialog.m-sheet.m-js,dialog.m-sheet.m-drag,dialog.m-sheet.m-closing,dialog.m-sheet.m-closing::backdrop{transition:none!important}
dialog.m-sheet:focus{outline:none}
dialog.m-sheet .m-grab{position:sticky;top:0;z-index:1;display:block;height:24px;margin:0 -16px;touch-action:none;cursor:grab;-webkit-user-select:none;user-select:none}
dialog.m-sheet .m-grab::before{content:"";position:absolute;left:50%;top:8px;width:36px;height:5px;margin-left:-18px;border-radius:3px;background:#C7C7CC}
${DARKQ("dialog.m-sheet .m-grab::before", "background:#636366")}
dialog.m-sheet [data-sheet-grab]{touch-action:none}
/* hoja de vidrio flotante (con el .glass de index.html): tinte alto para leer bien y sin el borde de ::before, que se
   iría con el scroll de la hoja; sin transparencia, con más contraste o sin desenfoque, opaca */
dialog.m-sheet.glass{background:linear-gradient(180deg,var(--g-top,rgb(255 255 255/.5)) 0%,rgb(255 255 255/0) 120px),rgb(255 255 255/.94);
  box-shadow:var(--g-hi,inset 0 1px 0 rgb(255 255 255/.95)),0 0 0 .5px var(--g-edge,rgb(0 0 0/.07)),0 12px 40px rgb(0 0 0/.18)}
${DARKQ("dialog.m-sheet.glass", "background:linear-gradient(180deg,rgb(255 255 255/.08) 0%,rgb(255 255 255/0) 120px),rgb(28 28 30/.94)")}
dialog.m-sheet.glass::before{display:none}
:root[data-glass=off] dialog.m-sheet.glass,:root[data-contrast=more] dialog.m-sheet.glass{background:var(--card,#fff);-webkit-backdrop-filter:none;backdrop-filter:none}
@media (prefers-reduced-transparency:reduce){:root[data-theme] dialog.m-sheet.glass,dialog.m-sheet.glass{background:var(--card,#fff);-webkit-backdrop-filter:none;backdrop-filter:none}}
@media (prefers-contrast:more){:root[data-theme] dialog.m-sheet.glass,dialog.m-sheet.glass{background:var(--card,#fff);-webkit-backdrop-filter:none;backdrop-filter:none}}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){:root[data-theme] dialog.m-sheet.glass,dialog.m-sheet.glass{background:var(--card,#fff)}}
/* hoja a toda altura (data-detent=large) y todas desde 820 px: opacas, sin desenfoque (como en iOS al estirarla) */
:root dialog.m-sheet.glass[data-detent=large]{background:var(--card,#fff);-webkit-backdrop-filter:none;backdrop-filter:none}
:root[data-theme=dark] dialog.m-sheet.glass[data-detent=large]{background:#1C1C1E}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) dialog.m-sheet.glass[data-detent=large]{background:#1C1C1E}}
/* tableta grande y ordenador: hoja de formulario centrada (como en iPadOS), tan alta como su contenido, sin agarre;
   se cierra con su botón, con Esc o tocando fuera. Deja libre la barra de arriba (y la de abajo) más 12 px */
@media (min-width:820px){
  dialog.m-sheet{inset:0;margin:auto;width:calc(100% - 48px);max-width:560px;height:fit-content;max-height:min(760px,calc(100dvh - 2 * var(--topbar-h,68px) - 24px));padding-top:20px}
  dialog.m-sheet .m-grab{display:none}
  :root dialog.m-sheet.glass{background:var(--card,#fff);-webkit-backdrop-filter:none;backdrop-filter:none}
  :root[data-theme=dark] dialog.m-sheet.glass{background:#1C1C1E}
  @media (prefers-color-scheme:dark){:root:not([data-theme=light]) dialog.m-sheet.glass{background:#1C1C1E}}
}
/* la cabecera de todas las hojas: título centrado (19, semibold) y, a la derecha, «Listo» gris; a la izquierda, «‹ Atrás»
   si hace falta. Los lados a 16 px, como el contenido. Azul solo cuando hay algo que confirmar */
.m-head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;min-height:52px;margin:0 0 4px}
.m-head>h2{grid-column:2;margin:0;font:600 var(--fs-head,1.1875rem)/1.2 var(--f-text,system-ui);color:var(--label,#000);text-align:center;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m-head>.m-head-x{grid-column:3;justify-self:end}
@media (prefers-reduced-motion:reduce){
  dialog.m-sheet,dialog.m-sheet:not([open]){translate:none;transition:opacity 150ms ease;transition:opacity 150ms ease,display 150ms allow-discrete,overlay 150ms allow-discrete}
  dialog.m-sheet:not([open]){opacity:0}
  @starting-style{dialog.m-sheet[open]{translate:none;opacity:0}}
}
:root[data-motion=calm] dialog.m-sheet,:root[data-motion=calm] dialog.m-sheet:not([open]){translate:none;transition:opacity 150ms ease;transition:opacity 150ms ease,display 150ms allow-discrete,overlay 150ms allow-discrete}
:root[data-motion=calm] dialog.m-sheet:not([open]){opacity:0}
@starting-style{:root[data-motion=calm] dialog.m-sheet[open]{translate:none;opacity:0}}
`;
function css(){ if(DOC.getElementById("css-motion")) return; const st = DOC.createElement("style"); st.id = "css-motion"; st.textContent = STYLE(); DOC.head.appendChild(st); }
css();

/* ---------- utilidades de posición ---------- */
function pointOf(p){
  if(!p) return null;
  if(typeof p.getBoundingClientRect === "function"){
    if(p.isConnected === false) return null;
    const r = p.getBoundingClientRect(); if(!r.width && !r.height) return null;
    return {x: r.left + r.width / 2, y: r.top + r.height / 2};
  }
  if(isFinite(p.x) && isFinite(p.y)) return {x: +p.x, y: +p.y};
  if(isFinite(p.left) && isFinite(p.top)) return {x: p.left + (p.width || 0) / 2, y: p.top + (p.height || 0) / 2};
  return null;
}
function shown(el){
  if(!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if(r.width < 1 || r.height < 1 || r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) return false;
  try{ if(el.checkVisibility) return el.checkVisibility({checkOpacity: true, checkVisibilityCSS: true, opacityProperty: true, visibilityProperty: true}); }catch(e){}
  for(let n = el; n && n.nodeType === 1; n = n.parentElement){ const cs = getComputedStyle(n); if(cs.visibility === "hidden" || +cs.opacity === 0 || cs.display === "none") return false; }
  return true;
}
/* las capas propias van en la capa superior (popover) para verse también encima de una hoja abierta */
function raise(el){
  if(!POP || !el.hasAttribute("popover")) return;
  try{
    let modal = false; try{ modal = !!DOC.querySelector("dialog:modal"); }catch(e){ modal = !!DOC.querySelector("dialog[open]"); }
    const open = el.matches(":popover-open");
    if(open && modal){ el.hidePopover(); el.showPopover(); } else if(!open) el.showPopover();
  }catch(e){ el.removeAttribute("popover"); }
}
let FX = null;
function fx(){
  if(!FX || !FX.isConnected){
    FX = DOC.createElement("div"); FX.id = "m-fx"; FX.setAttribute("aria-hidden", "true");
    if(POP) FX.setAttribute("popover", "manual");
    DOC.body.appendChild(FX);
  }
  raise(FX); return FX;
}

/* ---------- al pulsar ---------- */
const GROW = ".glass-btn,.btn-fill,.glass";
const PRESSABLE = "[data-press],.glass-btn,.btn-fill,.glass,.card";
const ACTIVE = "a[href],button,summary,label,select,[role=button],[role=tab],[role=link],[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox],[role=option],[role=switch],[role=checkbox],[role=radio],[tabindex]:not([tabindex='-1'])";
const live = el => el.matches(ACTIVE) || typeof el.onclick === "function";
const tok = (el, w) => new RegExp(`(^|\\s)${w}(\\s|$)`).test(el.getAttribute("data-press") || "");
function pressFor(t){
  let el = t && t.closest ? t.closest(PRESSABLE) : null;
  while(el){
    if(tok(el, "none")) return null;
    if(el.matches(":disabled,[aria-disabled=true]")) return null;
    const grow = tok(el, "grow") || (!tok(el, "sink") && el.matches(GROW));
    if(tok(el, "sink") || tok(el, "grow") || tok(el, "instant") || live(el)) return {el, grow, instant: tok(el, "instant")};
    if(el.matches(".glass") && !el.matches("dialog,[role=dialog],[role=menu],[role=listbox]")){   /* pestañas, monedas, engranaje… (las filas de hojas y menús no crecen) */
      const b = t.closest(ACTIVE);
      if(b && b !== el && el.contains(b) && b.offsetWidth <= 240 && !b.closest("[data-press~=none]") && !b.matches(":disabled,[aria-disabled=true]")) return {el: b, grow: true, instant: false};
    }
    el = el.parentElement ? el.parentElement.closest(PRESSABLE) : null;
  }
  return null;
}
const PA = new WeakMap();      /* elemento → su animación de pulsar */
function scaleNow(el){ const n = parseFloat(getComputedStyle(el).scale); return isFinite(n) ? n : 1; }
function pressAnim(el, to, dir){
  const old = PA.get(el); let a;
  if(rm()){
    const o0 = old ? parseFloat(getComputedStyle(el).opacity) || 1 : 1; if(old) old.cancel();
    a = anim(el, [{opacity: o0}, {opacity: dir === "in" ? .78 : 1}], dir === "in" ? {duration: 60, easing: "ease-out", fill: "forwards"} : {duration: 150, easing: "ease-out"});
  } else {
    const s0 = old ? scaleNow(el) : 1; if(old) old.cancel();
    a = anim(el, [{scale: s0}, {scale: to}], dir === "in" ? {duration: 90, easing: "cubic-bezier(.25,.8,.3,1)", fill: "forwards"} : {duration: SNAPPY.ms, easing: easeOf(SNAPPY)});
  }
  if(!a){ PA.delete(el); return; }
  PA.set(el, a);
  if(dir === "out") a.onfinish = () => { if(PA.get(el) === a) PA.delete(el); };
}
function setMx(el, x, y){
  const r = el.getBoundingClientRect(); if(!r.width || !r.height) return;
  el.style.setProperty("--mx", clamp((x - r.left) / r.width * 100, 0, 100).toFixed(1) + "%");
  el.style.setProperty("--my", clamp((y - r.top) / r.height * 100, 0, 100).toFixed(1) + "%");
}
const SLOP = 10, DELAY = 75, FLASH = 90;
let P = null;
function pressOn(p){ if(p.on) return; p.on = true; p.el.classList.add("is-pressed"); pressAnim(p.el, p.grow ? 1.06 : .97, "in"); }
function pressOff(p){ clearTimeout(p.timer); if(!p.on) return; p.on = false; p.el.classList.remove("is-pressed"); pressAnim(p.el, 1, "out"); }
function endPress(tap){
  const p = P; P = null; if(!p) return; clearTimeout(p.timer);
  if(tap && !p.on){ pressOn(p); setTimeout(() => pressOff(p), FLASH); }   /* un toque rápido también se ve */
  else pressOff(p);
}
const unpress = () => endPress(false);
DOC.addEventListener("pointerdown", e => {
  if(P) endPress(false);
  if(!e.isPrimary || e.button > 0) return;
  const f = pressFor(e.target); if(!f) return;
  const p = P = {el: f.el, grow: f.grow, x: e.clientX, y: e.clientY, id: e.pointerId, on: false, timer: 0};
  if(f.grow) setMx(f.el, e.clientX, e.clientY);
  const inst = f.instant || e.pointerType === "mouse" || !!f.el.closest(".tabbar,[role=tablist]") || f.el.matches(".glass-btn--pri,.btn-pri");
  if(inst) pressOn(p); else p.timer = setTimeout(() => { if(P === p) pressOn(p); }, DELAY);
}, {capture: true, passive: true});
DOC.addEventListener("pointermove", e => {
  if(!P || e.pointerId !== P.id) return;
  if(Math.hypot(e.clientX - P.x, e.clientY - P.y) > SLOP) return endPress(false);
  if(P.on && P.grow) setMx(P.el, e.clientX, e.clientY);
}, {capture: true, passive: true});
DOC.addEventListener("pointerup", e => { if(P && e.pointerId === P.id) endPress(true); }, {capture: true, passive: true});
DOC.addEventListener("pointercancel", e => { if(P && e.pointerId === P.id) endPress(false); }, {capture: true, passive: true});
DOC.addEventListener("scroll", () => { if(P) endPress(false); }, {capture: true, passive: true});
addEventListener("blur", unpress);
DOC.addEventListener("visibilitychange", unpress);

/* ---------- acierto y error de manejo ---------- */
function drawCheck(svg){
  if(rm()) return anim(svg, [{opacity: 0}, {opacity: 1}], {duration: 150, easing: "ease-out"});
  svg.querySelectorAll("path,polyline,line,polygon,circle").forEach((p, i) => {
    let L = 0; try{ L = p.getTotalLength(); }catch(e){}
    if(!L) return;
    p.style.strokeDasharray = String(L);
    anim(p, [{strokeDashoffset: String(L)}, {strokeDashoffset: "0"}], {duration: 280, delay: 60 + i * 70, easing: "cubic-bezier(.3,.7,.3,1)", fill: "backwards"});
  });
}
function ok(el, o = {}){
  if(!el) return null;
  const chk = el.matches && el.matches("svg.chk") ? el : (el.querySelector && el.querySelector("svg.chk"));
  if(chk) drawCheck(chk);
  if(o.haptic && window.G && typeof G.haptic === "function") G.haptic("success");
  const old = PA.get(el); const s0 = old && !rm() ? scaleNow(el) : 1; if(old){ old.cancel(); PA.delete(el); }
  if(rm()) return anim(el, [{opacity: .6}, {opacity: 1}], {duration: 150, easing: "ease-out"});
  const e = "cubic-bezier(.2,.7,.3,1)";
  return anim(el, [{scale: s0, easing: e}, {scale: 1.04, offset: .32, easing: e}, {scale: .995, offset: .7, easing: e}, {scale: 1}], {duration: 380});
}
function nope(el){
  if(!el) return null;
  if(rm()) return anim(el, [{opacity: 1}, {opacity: .55}, {opacity: 1}], {duration: 160, easing: "ease-in-out"});
  return anim(el, [{translate: "0 0"}, {translate: "-6px 0"}, {translate: "6px 0"}, {translate: "-4px 0"}, {translate: "4px 0"}, {translate: "0 0"}], {duration: 300, easing: "ease-in-out", composite: "add"});
}
const BUMPT = new WeakMap();
function bump(el, ms = 420){
  if(!el || !el.classList || el.id === "m-coin-corner") return;
  el.classList.remove("m-bump"); void el.offsetWidth;
  el.style.setProperty("--m-bump-d", Math.round(ms) + "ms"); el.classList.add("m-bump");
  clearTimeout(BUMPT.get(el)); BUMPT.set(el, setTimeout(() => el.classList.remove("m-bump"), (rm() ? 150 : ms) + 60));
}

/* ---------- monedas ---------- */
const COIN = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#FFCC00"/><circle cx="12" cy="12" r="10.5" fill="none" stroke="#C7A000" stroke-opacity=".8"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#B39000" stroke-opacity=".55" stroke-width="1.4"/><path d="M12 7.8 13.06 10.54 15.99 10.7 13.71 12.56 14.47 15.4 12 13.8 9.53 15.4 10.29 12.56 8.01 10.7 10.94 10.54Z" fill="#A88700" fill-opacity=".8"/><path d="M6.4 8.2a7 7 0 0 1 4.4-3.4" stroke="#fff" stroke-opacity=".85" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>`;
const SFX = () => { try{ if(typeof sfx !== "undefined" && sfx) return sfx; }catch(e){} return window.sfx || null; };
function muted(){
  const s = SFX(); try{ if(s && "muted" in s) return !!s.muted; }catch(e){}
  try{ return JSON.parse(localStorage.getItem("mute")) === true; }catch(e){ return false; }
}
let AC = null;
const STEP = [0, 2, 4, 7, 9, 12, 14, 16];   /* pentatónica: cada moneda un poco más aguda */
function note(i){
  if(muted()) return;
  const s = SFX(); try{ if(s && typeof s.note === "function") return s.note(i); }catch(e){}
  try{
    if(navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    const C = window.AudioContext || window.webkitAudioContext; if(!C) return;
    if(!AC) AC = new C();
    if(AC.state === "suspended") AC.resume().catch(() => {});
    const f = 1046.5 * Math.pow(2, STEP[i % STEP.length] / 12), t = AC.currentTime + .005;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.07, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + .17);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + .2);
  }catch(e){}
}
let CORNER = null;
function corner(){
  if(!CORNER || !CORNER.isConnected){ CORNER = DOC.createElement("i"); CORNER.id = "m-coin-corner"; CORNER.setAttribute("aria-hidden", "true"); DOC.body.appendChild(CORNER); }
  return CORNER;
}
function coinTarget(){
  for(const s of ["[data-coin-target]", "#coins", "[data-coins-pill]"]) for(const el of DOC.querySelectorAll(s)) if(shown(el)) return el;
  return corner();
}
const q = (a, c, b, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * c + u * u * b;
const inOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function coins(n, from, why, o = {}){
  n = Math.round(Number(n) || 0);
  if(why) toast(n > 0 ? `${why} +${n}` : String(why), {icon: n > 0 ? "coin" : o.icon});
  if(n <= 0) return Promise.resolve();
  const tgt = coinTarget(), end = pointOf(tgt) || {x: innerWidth - 44, y: 40};
  const a = pointOf(from) || {x: innerWidth / 2, y: innerHeight * .45};
  const k = clamp(Math.ceil(n / 5) + 2, 3, 8), spread = (k - 1) * 60;
  if(rm()){ bump(tgt); if(!o.quiet) note(0); return new Promise(r => setTimeout(r, 160)); }
  const host = fx(), D = 640, N = 12;
  return new Promise(res => {
    let left = k;
    for(let i = 0; i < k; i++){
      const c = DOC.createElement("span"); c.className = "m-coin"; c.innerHTML = COIN; host.appendChild(c);
      const sx = a.x + (Math.random() - .5) * 26, sy = a.y + (Math.random() - .5) * 18;
      const cx = (sx + end.x) / 2 + (Math.random() - .5) * 110, cy = Math.min(sy, end.y) - 60 - Math.random() * 70;
      const kf = [];
      for(let j = 0; j <= N; j++){
        const u = inOut(j / N), s = u < .25 ? .45 + 2.6 * u : 1.1 - .5 * (u - .25) / .75;
        kf.push({transform: `translate(${q(sx, cx, end.x, u).toFixed(1)}px,${q(sy, cy, end.y, u).toFixed(1)}px) scale(${s.toFixed(3)})`, opacity: j === 0 ? 0 : 1});
      }
      let done = false;
      const land = () => {
        if(done) return; done = true; c.remove();
        if(i === 0) bump(tgt, spread + 360);
        if(!o.quiet) note(i);
        if(--left === 0) res();
      };
      const an = anim(c, kf, {duration: D, delay: i * 60, easing: "linear", fill: "both"});
      if(an){ an.onfinish = land; an.oncancel = land; }
      setTimeout(land, D + i * 60 + 400);   /* por si la animación no llega a terminar (pestaña oculta) */
    }
  });
}

/* ---------- chispas y confeti ---------- */
function burst(x, y, o = {}){
  if(x && typeof x === "object"){ if(y && typeof y === "object") o = y; const p = pointOf(x); if(!p) return; x = p.x; y = p.y; }
  if(rm() || !isFinite(x) || !isFinite(y)) return;
  const cols = o.colors && o.colors.length ? o.colors : [GOLD, BLUE, TEAL], n = clamp(Math.round(o.n || 10), 1, 24), host = fx();
  for(let i = 0; i < n; i++){
    const s = DOC.createElement("i"), sz = 8 + Math.random() * 8, a = i / n * Math.PI * 2 + Math.random() * .6, d = 36 + Math.random() * 50;
    s.className = "m-spark"; s.style.background = cols[i % cols.length];
    s.style.width = s.style.height = sz + "px"; s.style.margin = `${-sz / 2}px 0 0 ${-sz / 2}px`;
    host.appendChild(s);
    const dx = Math.cos(a) * d, dy = Math.sin(a) * d, r = (Math.random() < .5 ? -1 : 1) * (90 + Math.random() * 90);
    const an = anim(s, [
      {transform: `translate(${x}px,${y}px) scale(.3) rotate(0deg)`, opacity: 1},
      {transform: `translate(${x + dx}px,${y + dy}px) scale(1) rotate(${r * .6}deg)`, opacity: 1, offset: .6},
      {transform: `translate(${x + dx * 1.15}px,${y + dy * 1.15 + 12}px) scale(.5) rotate(${r}deg)`, opacity: 0},
    ], {duration: 620 + Math.random() * 180, easing: "cubic-bezier(.2,.8,.3,1)", fill: "both"});
    const gone = () => s.remove();
    if(an){ an.onfinish = gone; an.oncancel = gone; } else gone();
    setTimeout(gone, 1200);
  }
}
function confetti(o = {}){
  if(rm()) return;
  const host = fx(), cv = DOC.createElement("canvas"), dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  cv.className = "m-confetti"; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); host.appendChild(cv);
  const c = cv.getContext && cv.getContext("2d"); if(!c){ cv.remove(); return; }
  c.scale(dpr, dpr);
  const cols = [GOLD, BLUE, TEAL], N = clamp(Math.round(o.n || 60), 1, 60);
  const x0 = isFinite(o.x) ? o.x : W / 2, y0 = isFinite(o.y) ? o.y : H * .32, LIFE = 1700;
  const P = Array.from({length: N}, (_, i) => ({x: x0 + (Math.random() - .5) * 40, y: y0 + (Math.random() - .5) * 20, vx: (Math.random() - .5) * 11,
    vy: -Math.random() * 10 - 4, w: 6 + Math.random() * 5, h: 3 + Math.random() * 3, a: Math.random() * 6, va: (Math.random() - .5) * .3, c: cols[i % 3], round: i % 5 === 0}));
  let t0 = 0, last = 0;
  const f = ts => {
    if(!cv.isConnected) return;
    if(!t0) t0 = last = ts;
    const k = (ts - t0) / LIFE, dt = clamp((ts - last) / 16.67, 0, 3); last = ts;
    c.clearRect(0, 0, W, H);
    for(const p of P){
      p.vy += .3 * dt; p.vx *= Math.pow(.99, dt); p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
      c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.globalAlpha = Math.max(0, 1 - k * k); c.fillStyle = p.c;
      if(p.round){ c.beginPath(); c.arc(0, 0, p.h, 0, Math.PI * 2); c.fill(); } else c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      c.restore();
    }
    if(k < 1) requestAnimationFrame(f); else cv.remove();
  };
  requestAnimationFrame(f);
  setTimeout(() => cv.remove(), LIFE + 1500);
}

/* ---------- cápsula de avisos ---------- */
let TH = null, TCUR = null, GLASS = false;
const TQ = [];
function thost(){
  if(!TH || !TH.isConnected){
    TH = DOC.createElement("div"); TH.id = "m-toasts";
    TH.setAttribute("role", "status"); TH.setAttribute("aria-live", "polite"); TH.setAttribute("aria-atomic", "true");
    if(POP) TH.setAttribute("popover", "manual");
    DOC.body.appendChild(TH);
  }
  raise(TH); return TH;
}
function hasGlass(){
  if(GLASS) return true;
  const p = DOC.createElement("div"); p.className = "glass"; p.setAttribute("aria-hidden", "true");
  p.style.cssText = "position:fixed;left:-9999px;top:0;width:10px;height:10px;pointer-events:none";
  DOC.body.appendChild(p);
  const cs = getComputedStyle(p), bf = cs.backdropFilter || cs.webkitBackdropFilter || "none";
  GLASS = (bf && bf !== "none") || cs.boxShadow !== "none" || cs.backgroundImage !== "none" || !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(cs.backgroundColor);
  p.remove(); return GLASS;
}
function iconNode(ic){
  if(!ic) return null;
  const s = DOC.createElement("span"); s.className = "m-ti"; s.setAttribute("aria-hidden", "true");
  if(ic === "coin") s.innerHTML = COIN;
  else if(typeof ic === "string" && /^\s*<svg[\s>]/i.test(ic)) s.innerHTML = ic;
  else if(ic && ic.nodeType === 1) s.appendChild(ic.cloneNode(true));
  else s.textContent = String(ic);
  return s;
}
function toast(text, o = {}){
  text = String(text == null ? "" : text).trim(); if(!text) return;
  if((TCUR && TCUR.text === text && !TCUR.gone) || TQ.some(t => t.text === text)) return;
  TQ.push({text, icon: o.icon, ms: o.ms});
  if(!TCUR) nextToast();
}
function nextToast(){
  if(TCUR) return;
  const t = TCUR = TQ.shift() || null; if(!t) return;
  const h = thost(), el = DOC.createElement("div");
  el.className = "m-toast " + (hasGlass() ? "glass" : "m-own");
  const ic = iconNode(t.icon); if(ic) el.appendChild(ic);
  const tx = DOC.createElement("span"); tx.className = "m-tt"; tx.textContent = t.text; el.appendChild(tx);
  h.replaceChildren(el);
  anim(el, rm() ? [{opacity: 0}, {opacity: 1}] : [{opacity: 0, transform: "translateY(-14px) scale(.92)"}, {opacity: 1, transform: "none"}],
    rm() ? {duration: 150, easing: "ease-out"} : {duration: SNAPPY.ms, easing: easeOf(SNAPPY)});
  const ms = t.ms > 0 ? t.ms : clamp(1700 + t.text.length * 45, 2200, 4500);
  const hide = () => {
    if(t.gone) return; t.gone = true; clearTimeout(t.timer);
    const a = anim(el, rm() ? [{opacity: 1}, {opacity: 0}] : [{opacity: 1, transform: "none"}, {opacity: 0, transform: "translateY(-8px) scale(.96)"}],
      {duration: rm() ? 150 : 180, easing: "ease-in", fill: "forwards"});
    const fin = () => { if(el.parentNode) el.remove(); if(TCUR === t){ TCUR = null; setTimeout(nextToast, 60); } };
    if(a){ a.onfinish = fin; a.oncancel = fin; } else fin();
  };
  t.timer = setTimeout(hide, ms);
  el.addEventListener("click", hide);
}

/* ---------- muelle que sigue al dedo ---------- */
function pxPair(v){
  if(v == null) return null;
  const s = String(v).trim(); if(s === "none") return {x: 0, y: 0};
  const m = s.match(/^(-?[\d.]+)(?:px)?(?:\s+(-?[\d.]+)(?:px)?)?(?:\s+-?[\d.]+(?:px)?)?$/);
  return m ? {x: +m[1], y: m[2] != null ? +m[2] : 0} : null;
}
function fromTransform(v){
  if(v == null) return null;
  const s = String(v).trim(); if(s === "none" || s === "") return {x: 0, y: 0};
  let m = s.match(/translate(?:3d)?\(\s*(-?[\d.]+)px(?:\s*,\s*(-?[\d.]+)px)?/); if(m) return {x: +m[1], y: m[2] != null ? +m[2] : 0};
  m = s.match(/translateX\(\s*(-?[\d.]+)px\)/); const my = s.match(/translateY\(\s*(-?[\d.]+)px\)/);
  if(m || my) return {x: m ? +m[1] : 0, y: my ? +my[1] : 0};
  try{ const d = new DOMMatrixReadOnly(s); return {x: d.m41, y: d.m42}; }catch(e){ return null; }
}
const xyOf = f => !f ? null : f.translate != null ? pxPair(f.translate) : f.transform != null ? fromTransform(f.transform) : null;
function curXY(el, f){
  const cs = getComputedStyle(el);
  return f && f.transform != null && f.translate == null ? fromTransform(cs.transform) : pxPair(cs.translate);
}
const SPR = new WeakMap();
function springTo(el, keyframes, o = {}){
  if(!el || typeof el.animate !== "function" || !keyframes) return null;
  let kf = Array.isArray(keyframes) ? keyframes.slice() : [keyframes];
  if(!kf.length) return null;
  const prev = SPR.get(el);
  if(prev){ try{ prev.commitStyles(); }catch(e){} prev.cancel(); SPR.delete(el); }
  let v0 = 0;
  const vel = o.velocity;
  if(vel){
    const last = kf[kf.length - 1], a = kf.length > 1 ? xyOf(kf[0]) : curXY(el, last), b = xyOf(last);
    if(a && b){
      const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || +o.distance || 0;
      if(dist > .5){
        const vx = typeof vel === "number" ? vel * dx / dist : (+vel.x || 0), vy = typeof vel === "number" ? vel * dy / dist : (+vel.y || 0);
        v0 = clamp((vx * dx + vy * dy) / dist * 1000 / dist, -60, 60);
      }
    } else if(typeof vel === "number" && o.distance > 0) v0 = clamp(vel * 1000 / o.distance, -60, 60);
  }
  const sp = spring(o.damping == null ? .86 : o.damping, o.response == null ? .35 : o.response, v0), R = rm();
  const a = anim(el, kf, {duration: R ? 120 : sp.ms, easing: R ? "ease-out" : (LIN ? sp.easing : EASE_OUT), fill: "forwards"});
  if(!a) return null;
  SPR.set(el, a);
  a.finished.then(() => {
    if(o.commit !== false){ try{ a.commitStyles(); }catch(e){} }
    if(SPR.get(el) === a) SPR.delete(el);
    a.cancel();
  }).catch(() => {});
  return a;
}

/* ---------- hojas ---------- */
const SHEETS = new WeakMap(), OPEN = new Set();
let SWALLOW = 0;
addEventListener("click", e => { if(now() < SWALLOW){ e.preventDefault(); e.stopImmediatePropagation(); } }, true);
const swallow = (ms = 350) => { if(window.G && typeof G.swallowClick === "function") G.swallowClick(ms); else SWALLOW = now() + ms; };
const outside = (d, e) => { const r = d.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
function ensureGrab(d){
  if(d.querySelector(":scope > .m-grab")) return;
  const g = DOC.createElement("div"); g.className = "m-grab"; g.setAttribute("aria-hidden", "true"); d.prepend(g);
}
function markOpen(d, on){
  if(on) OPEN.add(d); else OPEN.delete(d);
  for(const x of OPEN) if(!x.isConnected || !x.open) OPEN.delete(x);
  if(OPEN.size) ROOT.setAttribute("data-sheet", ""); else ROOT.removeAttribute("data-sheet");
}
/* deja la hoja quieta donde se ve ahora y devuelve cuánto está bajada (px) */
function freeze(d){
  const a = d.getBoundingClientRect().top;
  d.classList.add("m-drag"); stopJs(d);
  d.style.translate = "none"; d.style.removeProperty("scale"); d.style.removeProperty("opacity");
  const y = a - d.getBoundingClientRect().top;
  d.style.translate = `0 ${y}px`;
  return y;
}
function prep(d){
  let s = SHEETS.get(d); if(s) return s;
  s = {from: null, closing: null}; SHEETS.set(d, s);
  d.classList.add("m-sheet");
  if(hasGlass()) d.classList.add("glass");            /* vidrio flotante (SPEC: las hojas son de vidrio) */
  d.addEventListener("cancel", e => { if(!d.classList.contains("m-sheet")) return; e.preventDefault(); closeSheet(d); });
  let downOut = false;
  d.addEventListener("pointerdown", e => { downOut = e.target === d && outside(d, e); if(!downOut) grab(d, e); });
  d.addEventListener("click", e => { if(e.target === d && downOut && outside(d, e)) closeSheet(d); downOut = false; });
  d.addEventListener("close", () => {
    if(d.open){ markOpen(d, true); return; }      /* el aviso llega tarde y ya se volvió a abrir: no tocar la animación nueva */
    const st = SHEETS.get(d); if(st){ st.closing = null; st.drag = null; }
    markOpen(d, false); stopJs(d);
    d.style.removeProperty("translate"); d.style.removeProperty("scale"); d.style.removeProperty("opacity"); d.style.removeProperty("--m-bd");
    d.classList.remove("m-js", "m-drag");
    requestAnimationFrame(() => requestAnimationFrame(() => { if(!d.open) d.classList.remove("m-closing"); }));
  });
  return s;
}
function grab(d, e){
  if(!e.isPrimary || e.button > 0) return;
  const zone = e.target.closest && e.target.closest(".m-grab,[data-sheet-grab]");
  const s = SHEETS.get(d);
  if(!zone || !d.contains(zone) || !s || s.closing || !d.open || s.drag) return;
  const st = s.drag = {id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, slop: e.pointerType === "mouse" ? 4 : 10, base: 0, h: 1, y: 0, S: [[e.timeStamp || now(), e.clientY]]};
  const add = ev => { st.S.push([ev.timeStamp || now(), ev.clientY]); while(st.S.length > 2 && st.S[st.S.length - 1][0] - st.S[0][0] > 100) st.S.shift(); };
  const vel = () => { const a = st.S[0], b = st.S[st.S.length - 1], dt = b[0] - a[0]; return dt > 0 ? (b[1] - a[1]) / dt : 0; };
  const stop = () => { removeEventListener("pointermove", move, true); removeEventListener("pointerup", up, true); removeEventListener("pointercancel", cancel, true); if(s.drag === st) s.drag = null; };
  const move = ev => {
    if(ev.pointerId !== st.id) return;
    const dy = ev.clientY - st.y0;
    if(!st.on){
      if(Math.hypot(ev.clientX - st.x0, dy) < st.slop) return;
      if(Math.abs(ev.clientX - st.x0) > 1.2 * Math.abs(dy)) return stop();
      st.on = true; unpress();
      try{ zone.setPointerCapture(ev.pointerId); }catch(_){}
      st.base = freeze(d); st.h = d.getBoundingClientRect().height + 8;
    }
    add(ev);
    const y = st.base + dy, t = y >= 0 ? y : -rubber(-y, st.h);
    st.y = t; d.style.translate = `0 ${t}px`;
    d.style.setProperty("--m-bd", clamp(1 - t / st.h, 0, 1).toFixed(3));
  };
  const up = ev => {
    if(ev.pointerId !== st.id) return;
    stop(); if(!st.on) return;
    add(ev); swallow(350);
    const v = vel(), y = st.y;
    if(y > 0 && (y > st.h * .35 || v > .35)) closeSheet(d, {velocity: Math.max(0, v), drag: true});
    else back(v);
  };
  const cancel = ev => { if(ev.pointerId !== st.id) return; stop(); if(st.on) back(0); };
  const back = v => { d.style.setProperty("--m-bd", "1"); settle(d, st.y, v); };
  addEventListener("pointermove", move, true); addEventListener("pointerup", up, true); addEventListener("pointercancel", cancel, true);
}
/* vuelve a su sitio con muelle desde y px (y la velocidad del dedo) */
function settle(d, y, v = 0){
  const s = SHEETS.get(d);
  d.classList.add("m-drag"); d.style.removeProperty("translate");
  const a = springTo(d, [{translate: `0 ${y}px`}, {translate: "0 0"}], {velocity: {x: 0, y: v}, commit: false});
  const done = () => { if(s && s.closing) return; d.classList.remove("m-drag"); };
  if(a) a.finished.then(done, done); else done();
}
function openSheet(d, o = {}){
  if(!d || d.tagName !== "DIALOG") return Promise.resolve();
  const s = prep(d); ensureGrab(d);
  if(s.closing && d.open){   /* se estaba cerrando: vuelve */
    const y = rm() ? 0 : freeze(d);
    if(s.closing.anim) s.closing.anim.cancel();
    s.closing = null; d.style.setProperty("--m-bd", "1"); d.classList.remove("m-js");
    if(y) settle(d, y); else { stopJs(d); d.classList.remove("m-drag"); d.style.removeProperty("translate"); }
  }
  if(d.open){ markOpen(d, true); return Promise.resolve(); }
  s.from = o.from && o.from.nodeType === 1 ? o.from : null;
  if(!d.isConnected) DOC.body.appendChild(d);
  d.classList.remove("m-closing", "m-drag"); stopJs(d);
  d.style.removeProperty("translate"); d.style.removeProperty("scale"); d.style.removeProperty("opacity"); d.style.removeProperty("--m-bd");
  const R = rm(), viaJs = !R && (!STARTING || !!(s.from && shown(s.from)));
  d.classList.toggle("m-js", viaJs || (R && !STARTING));
  try{ d.showModal(); }catch(e){ try{ d.show(); }catch(e2){ d.setAttribute("open", ""); } }
  if(!d.querySelector("[autofocus]")){   /* como en iOS: abre sin una fila enfocada (el foco va a la hoja) */
    if(!d.hasAttribute("tabindex")) d.tabIndex = -1;
    try{ d.focus({preventScroll: true}); }catch(e){}
  }
  markOpen(d, true);
  if(!d.classList.contains("m-js")) return new Promise(r => setTimeout(r, R ? 150 : SNAPPY.ms));
  let a;
  if(R) a = anim(d, [{opacity: 0}, {opacity: 1}], {duration: 150, easing: "ease-out"});
  else {
    const r = d.getBoundingClientRect(), f = s.from && shown(s.from) ? s.from.getBoundingClientRect() : null;
    if(f){
      const dx = f.left + f.width / 2 - (r.left + r.width / 2), dy = f.top + f.height / 2 - (r.top + r.height / 2);
      const sc = clamp(Math.max(f.width / Math.max(1, r.width), f.height / Math.max(1, r.height)), .08, 1);
      a = anim(d, [{translate: `${dx}px ${dy}px`, scale: sc, opacity: 0}, {opacity: 1, offset: .3}, {translate: "0 0", scale: 1, opacity: 1}], {duration: SNAPPY.ms, easing: easeOf(SNAPPY)});
    } else a = anim(d, [{translate: "0 calc(100% + 24px)"}, {translate: "0 0"}], {duration: SNAPPY.ms, easing: easeOf(SNAPPY)});
  }
  return new Promise(res => {
    const fin = () => { if(d.open && !s.closing) d.classList.remove("m-js"); res(); };
    if(a) a.finished.then(fin, fin); else fin();
  });
}
function closeSheet(d, o = {}){
  if(!d || !d.open) return Promise.resolve();
  const s = prep(d); if(s.closing) return s.closing.p;
  let res; const p = new Promise(r => res = r);
  s.closing = {p, anim: null};
  d.style.setProperty("--m-bd", "0");
  const R = rm(), from = !o.drag && s.from && shown(s.from) ? s.from : null;
  let a;
  if(R){ stopJs(d); d.classList.add("m-js"); a = anim(d, [{opacity: 1}, {opacity: 0}], {duration: 150, easing: "ease-out", fill: "forwards"}); }
  else {
    const y = freeze(d), r = d.getBoundingClientRect();
    if(from){
      const f = from.getBoundingClientRect(), dx = f.left + f.width / 2 - (r.left + r.width / 2), dy = y + f.top + f.height / 2 - (r.top + r.height / 2);
      const sc = clamp(Math.max(f.width / Math.max(1, r.width), f.height / Math.max(1, r.height)), .08, 1);
      a = anim(d, [{translate: `0 ${y}px`, scale: 1, opacity: 1}, {opacity: 1, offset: .55}, {translate: `${dx}px ${dy}px`, scale: sc, opacity: 0}], {duration: 300, easing: "cubic-bezier(.3,0,.2,1)", fill: "forwards"});
    } else {
      const dist = Math.max(40, innerHeight - r.top + 16), v = Math.max(0, +o.velocity || 0);
      const ms = clamp(dist / Math.max(v, 1.4) * 1.5, 170, 340), slope = v * ms / dist;
      a = anim(d, [{translate: `0 ${y}px`}, {translate: `0 ${y + dist}px`}], {duration: ms, easing: `cubic-bezier(.25,${clamp(.25 * slope, .08, 1).toFixed(3)},.4,1)`, fill: "forwards"});
    }
  }
  s.closing.anim = a;
  let shut = false;
  const fin = () => {
    if(shut) return; shut = true;
    if(s.closing && s.closing.anim !== a) return;     /* se volvió a abrir a mitad */
    d.classList.add("m-closing");
    try{ d.close(); }catch(e){ d.removeAttribute("open"); }
    if(d.open) d.removeAttribute("open");
    res();
  };
  if(a){ a.onfinish = fin; a.oncancel = () => { shut = true; if(s.closing && s.closing.anim === a) s.closing = null; res(); }; } else fin();
  return p;
}

/* ---------- arranque ---------- */
function init(){ if(DOC.body) thost(); }
if(DOC.readyState === "loading") DOC.addEventListener("DOMContentLoaded", init, {once: true}); else init();

window.M = {rm, ok, nope, bump, coins, coinTarget, burst, confetti, toast, openSheet, closeSheet, springTo, spring, unpress,
  get snappy(){ return SNAPPY; }, get bouncy(){ return BOUNCY; }};
})();
