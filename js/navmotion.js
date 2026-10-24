/* Módulo navmotion: el movimiento de la navegación, como en iOS.
   · View Transitions al entrar y volver DENTRO de una pestaña (document.startViewTransition): la pantalla nueva entra
     desde la derecha y la de antes se aparta un poco y se oscurece; al volver, al revés. El modo foco (lección,
     repaso en marcha, partida) sube como una hoja desde abajo y baja al salir. Las barras (#topbar, #tabbar), el
     accesorio «Seguir», los avisos y las monedas que vuelan no se mueven (view-transition-name con animation:none, y
     solo mientras dura: un nombre hace del elemento una raíz de fondo y su vidrio dejaría de desenfocar lo de detrás).
     No anima: al cambiar de pestaña (tocar otra en la barra o ir a otra sección), la primera pantalla, sin la API, con
     el gesto atrás del sistema (hasUAVisualTransition: Safari ya pinta el suyo), con la página oculta o con una hoja
     que no termina de cerrarse. Con «Reducir movimiento» (el del aparato o el de Ajustes), un fundido de 150 ms.
     route() de index.html, en este orden: kind = vocabNavMotion.kind(from, to) antes de cambiar nada (consume el
     toque en la barra y el gesto del sistema), await prefetch(to) (ROUTES[x].load(partes) o loader(to) de aquí: los
     datos de la pantalla, con la de antes aún a la vista) y vocabNavMotion.run(kind, render): render() pinta la ruta
     de una vez (los datos ya están) y run lo hace dentro de la transición. Si al final el modo foco no es el previsto
     (una lección que no existe y vuelve al camino, un juego que es un enlace), la transición se salta sin animar.
   · Título grande que se encoge (html[data-tcol]): en la raíz de una pestaña (y en las pantallas de dentro, con su
     <h1>, entre la cápsula de volver y las monedas, con puntos suspensivos si no cabe), cuando el título pasa por
     debajo de la barra de arriba, sale en ella en una línea de 17 px centrada (span.tb-title, aria-hidden: el <h1>
     sigue siendo el título) y aparece el fondo de vidrio de la barra; al subir, vuelve. Scroll pasivo + rAF, sin
     mover nada de sitio (Hoy, sin scroll, nunca se encoge; la granja no tiene título).
   · Vibración de los momentos buenos (G.haptic("success")): fin de lección, medalla nueva, regalo abierto, página del
     álbum completa y temporada terminada. Nunca en cada toque.
   window.vocabNavMotion = {kind(from, to), run(kind, render) → Promise, loader(h) → fn | null, idle() → Promise,
     busy, collapse()} */
(() => {
"use strict";
const W = window, D = document, ROOT = D.documentElement;
const VT = typeof D.startViewTransition === "function";
const now = () => Date.now();
const rm = () => { try{ return !!(W.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const hp = (h = location.hash) => typeof hashPath === "function" ? hashPath(h) : String(h || "").replace(/^#\/?/, "").split("?")[0];
const sec = h => String(h || "").split("/")[0];

/* ---------- estilos ---------- */
const BARS = ":is([data-vt=fwd],[data-vt=back],[data-vt=fade])";
const CSS = `
html${BARS} #topbar{view-transition-name:nm-top}
html${BARS} #tabbar{view-transition-name:nm-tab}
html${BARS} #acc:not([hidden]){view-transition-name:nm-acc}
html[data-vt] #m-toasts{view-transition-name:nm-toast}
html[data-vt] #m-fx{view-transition-name:nm-fx}
html[data-vt]::view-transition-group(*){animation:none}
html[data-vt]::view-transition-old(*){display:none;animation:none}
html[data-vt]::view-transition-old(*):only-child{display:block;animation:nm-out .15s ease both}
html[data-vt]::view-transition-new(*){animation:none}
html[data-vt]::view-transition-new(*):only-child{animation:nm-in .15s ease both}
html[data-vt]::view-transition-old(root){display:block}
html:is([data-vt=fwd],[data-vt=back],[data-vt=up],[data-vt=down])::view-transition-old(root),
html:is([data-vt=fwd],[data-vt=back],[data-vt=up],[data-vt=down])::view-transition-new(root){mix-blend-mode:normal}
html[data-vt=fwd]::view-transition-old(root){animation:nm-push-out var(--d-slow,420ms) var(--sp-snappy,cubic-bezier(.2,.8,.2,1)) both}
html[data-vt=fwd]::view-transition-new(root){animation:nm-push-in var(--d-slow,420ms) var(--sp-snappy,cubic-bezier(.2,.8,.2,1)) both}
html[data-vt=back]::view-transition-old(root){z-index:1;animation:nm-pop-out var(--d-slow,420ms) var(--sp-snappy,cubic-bezier(.2,.8,.2,1)) both}
html[data-vt=back]::view-transition-new(root){animation:nm-pop-in var(--d-slow,420ms) var(--sp-snappy,cubic-bezier(.2,.8,.2,1)) both}
html[data-vt=up]::view-transition-old(root){animation:nm-dim var(--d-slow,420ms) ease both}
html[data-vt=up]::view-transition-new(root){animation:nm-rise var(--d-slow,420ms) var(--sp-snappy,cubic-bezier(.2,.8,.2,1)) both}
html[data-vt=down]::view-transition-old(root){z-index:1;animation:nm-sink 360ms cubic-bezier(.3,0,.2,1) both}
html[data-vt=down]::view-transition-new(root){animation:nm-undim 360ms ease both}
html[data-vt=fade]::view-transition-old(root){animation:nm-out .15s ease both}
html[data-vt=fade]::view-transition-new(root){animation:nm-in .15s ease both}
@keyframes nm-push-out{to{transform:translateX(-30%);filter:brightness(.9)}}
@keyframes nm-push-in{from{transform:translateX(100%)}}
@keyframes nm-pop-out{to{transform:translateX(100%)}}
@keyframes nm-pop-in{from{transform:translateX(-30%);filter:brightness(.9)}}
@keyframes nm-rise{from{transform:translateY(100%)}}
@keyframes nm-sink{to{transform:translateY(100%)}}
@keyframes nm-dim{to{filter:brightness(.88)}}
@keyframes nm-undim{from{filter:brightness(.88)}}
@keyframes nm-out{to{opacity:0}}
@keyframes nm-in{from{opacity:0}}

/* el título que se encoge: una línea de 17 px en la fila de los botones, centrada en la pantalla si cabe */
.topbar>.tb-title{position:absolute;top:var(--bar-top);left:0;height:var(--tb-row);max-width:calc(100% - 32px);box-sizing:border-box;
  font:600 calc(1.0625rem*var(--k,1))/var(--tb-row) var(--f-text,system-ui);letter-spacing:-.02em;color:var(--label);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;opacity:0;transition:opacity 180ms ease}
:root[data-tcol]:not([data-focus]) .topbar>.tb-title{opacity:1}
/* con la barra de pestañas arriba (desde 820 px) sus nombres ya dicen dónde se está: solo el fondo */
@media (min-width:820px){:root:not([data-bar=bottom]) .topbar>.tb-title{display:none}}
/* el fondo de vidrio de la barra, que aparece al encogerse el título (en lugar del borde que funde) */
.topbar::before{content:"";position:absolute;z-index:-1;inset:0;pointer-events:none;opacity:0;visibility:hidden;
  background:linear-gradient(180deg,var(--g-top) 0%,rgba(255,255,255,0) 52%),var(--g-tint);
  -webkit-backdrop-filter:blur(16px) saturate(170%);backdrop-filter:blur(16px) saturate(170%);box-shadow:0 .5px 0 var(--sep);
  transition:opacity 180ms ease,visibility 0s linear 180ms}
:root[data-tcol]:not([data-focus]) .topbar::before{opacity:1;visibility:visible;transition:opacity 180ms ease}
.topbar::after{transition:opacity 180ms ease}
:root[data-tcol]:not([data-focus]) .topbar::after{opacity:0}
/* vidrio sobre vidrio, no: los botones de encima van sin desenfoque mientras se ve el fondo (y así no pasan de 3
   superficies con desenfoque: el fondo, la barra de pestañas y el accesorio o el menú) */
.topbar .glass:where(:root[data-tcol]:not([data-focus]) *){-webkit-backdrop-filter:none;backdrop-filter:none;
  background:linear-gradient(180deg,var(--g-top) 0%,rgba(255,255,255,0) 52%),var(--g-lite,rgba(255,255,255,.96))}
.topbar .glass:where(:root[data-tcol][data-theme=dark]:not([data-focus]) *){
  background:linear-gradient(180deg,var(--g-top) 0%,rgba(255,255,255,0) 52%),var(--g-lite-d,rgba(28,28,30,.96))}
:root[data-glass=lite] .topbar::before{-webkit-backdrop-filter:none;backdrop-filter:none;background:var(--g-lite,rgba(255,255,255,.96))}
:root[data-glass=lite][data-theme=dark] .topbar::before{background:var(--g-lite-d,rgba(28,28,30,.96))}
:root[data-glass=off] .topbar::before,:root[data-contrast=more] .topbar::before{-webkit-backdrop-filter:none;backdrop-filter:none;background:var(--g-solid)}
@media (prefers-reduced-transparency:reduce){.topbar::before{-webkit-backdrop-filter:none;backdrop-filter:none;background:var(--g-solid)}}
@media (prefers-contrast:more){.topbar::before{-webkit-backdrop-filter:none;backdrop-filter:none;background:var(--g-solid);box-shadow:0 1px 0 var(--sep)}}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.topbar::before{background:var(--g-solid)}}
@media (forced-colors:active){.topbar::before{background:Canvas;box-shadow:0 1px 0 CanvasText}.topbar>.tb-title{color:CanvasText}}
`;
function css(){
  if(D.getElementById("css-navmotion")) return;
  const st = D.createElement("style"); st.id = "css-navmotion"; st.textContent = CSS; D.head.appendChild(st);
}
css();

/* ---------- qué movimiento toca ---------- */
/* el último toque en la barra de pestañas (antes que su propio click, que cambia de ruta) */
let TAP = null;
D.addEventListener("click", e => {
  const a = e.target && e.target.closest && e.target.closest("#tabbar .tab");
  if(a) TAP = {id: a.dataset.nav || "", cur: typeof curTab === "string" ? curTab : null, t: now()};
}, true);
/* el gesto atrás del sistema ya pinta su animación (Safari): esa navegación va sin la nuestra */
let UA = 0;
const uaMark = e => { if(e && e.hasUAVisualTransition) UA = now() + 1500; };
W.addEventListener("popstate", uaMark, true);
try{ if(W.navigation && typeof W.navigation.addEventListener === "function") W.navigation.addEventListener("navigate", uaMark); }catch(e){}

const focusNow = () => typeof focusOn === "string" && !!focusOn;
/* ¿la ruta abre el modo foco? (lección; repaso a medias o con palabras para hoy; una partida) */
function focusTo(h){
  const p = h.split("/"), s = p[0];
  if(s === "leccion") return true;
  if(s === "repaso"){
    try{
      if(typeof rv !== "undefined" && rv && rv.q && rv.i < rv.q.length && !rv.end) return true;
      return typeof dueList === "function" && dueList().length > 0;
    }catch(e){ return false; }
  }
  if(s === "juegos" && p[1]){ try{ return !!(W.vocabGames && typeof vocabGames.meta === "function" && vocabGames.meta(p[1])); }catch(e){ return false; } }
  if(s === "cuento") return true;   /* un cuento del zorro (js/stories.js) */
  if(s === "cazador") return true;  /* el cazador de cosas (js/hunter-boot.js) */
  if(s === "techl") return true;    /* una sesión de Tech Prep (lección, repaso, entrevista…; js/tech.js) */
  return false;
}
/* la pantalla de la que cuelga (la de la cápsula de volver; si no, la raíz de su pestaña); null en una raíz */
function parentOf(h){
  if(sec(h) === "frases") return h === "frases" ? "juegos" : "frases";   /* (back() de js/phrases.js recuerda de dónde se vino: aquí no se le llama) */
  let b = null; try{ b = typeof backOf === "function" ? backOf(h) : null; }catch(e){}
  if(b && typeof b.h === "string") return hp(b.h);
  const r = typeof rootOf === "function" ? rootOf(h) : h;
  return r === h ? null : r;
}
function depth(h){
  let n = 0, x = h;
  while(n < 8){ const p = parentOf(x); if(p == null || p === x) break; x = p; n++; }
  return n;
}
/* la pestaña de una ruta: la suya o la de la pantalla de la que cuelga (la temporada es de Hoy; el Buzón, de Jugar) */
function tabKey(h){
  if(typeof tabOf !== "function") return null;
  let x = h;
  for(let i = 0; i < 8 && x != null; i++){ const t = tabOf(x); if(t) return t.id; const p = parentOf(x); if(p === x) break; x = p; }
  return null;
}
function pushKind(a, b){
  const fr = h => sec(h) === "frases";
  if(fr(b) && !fr(a) && (a === "" || a === "juegos")) return "fwd";    /* Frases mágicas y la frase de la cena: desde Hoy o desde Juegos */
  if(fr(a) && !fr(b) && (b === "" || b === "juegos")) return "back";
  const tA = tabKey(a); if(!tA || tA !== tabKey(b)) return null;
  const dA = depth(a), dB = depth(b);
  if(dB > dA) return "fwd";
  if(dB < dA) return "back";
  if(!dA) return null;                                             /* de un segmento o un nivel a otro: sin movimiento */
  if(b.startsWith(a + "/")) return "fwd";
  if(a.startsWith(b + "/")) return "back";
  return null;                                                     /* de una ficha a otra: se cambia en su sitio */
}
/* la última pantalla que se llegó a pintar entera (una ruta que se fue a otra a mitad, como una lección que no
   existe, no cuenta: se anima desde lo que de verdad se ve) */
let LAST = null;
function kind(from, to){
  const tap = TAP; TAP = null;
  const ua = UA > now(); UA = 0;
  if(LAST != null) from = LAST;
  if(!VT || from == null || to == null || from === to || D.visibilityState === "hidden" || ua) return null;
  if(tap && now() - tap.t < 2500 && tap.id !== tap.cur) return null;     /* otra pestaña: el cambio es al momento */
  const fA = focusNow(), fB = focusTo(to);
  const k = !fA && fB ? "up" : fA && !fB ? "down" : fA ? null : pushKind(from, to);
  return k && rm() ? "fade" : k;
}

/* ---------- la transición ---------- */
/* una hoja abierta o cerrándose saldría dos veces (congelada en la foto de antes y viva encima): las que siguen
   abiertas (la pausa con «Salir», que cambia de ruta sin cerrarla) se cierran como siempre, hacia su botón, y se
   espera a que terminen */
const moving = d => { try{ return d.getAnimations().length > 0; }catch(e){ return false; } };
function sheetsBusy(){
  if(D.querySelector("dialog[open]")) return true;
  for(const d of D.querySelectorAll("dialog.m-sheet")) if(moving(d)) return true;
  return false;
}
function closeOpen(){
  for(const d of D.querySelectorAll("dialog[open]")){
    if(moving(d)) continue;
    try{ if(W.M && typeof M.closeSheet === "function" && d.classList.contains("m-sheet")) M.closeSheet(d); else d.close(); }catch(e){}
  }
}
async function sheetsCalm(max){
  const t0 = now();
  if(sheetsBusy()) closeOpen();
  while(sheetsBusy()){ if(now() - t0 > max) return false; await new Promise(r => setTimeout(r, 30)); }
  return true;
}
/* render() pinta la ruta; si devuelve false (mientras se esperaba ya se fue a otra), no se anima nada */
let SEQ = 0, BUSY = null;
async function run(k, render){
  if(!k || !VT) return render();
  if(!(await sheetsCalm(450)) || D.visibilityState === "hidden") return render();
  const my = ++SEQ, was = focusNow();
  let tr = null, started = false, fin0;
  const upP = new Promise(r => { fin0 = r; });
  const update = async () => {
    if(started) return upP; started = true;
    let r; try{ r = await render(); }catch(e){ console.error(e); }
    try{ collapse(); }catch(e){}
    fin0();
    const f = ROOT.hasAttribute("data-focus");
    const ok = r !== false && (k === "up" ? f : k === "down" ? !f : k === "fade" || f === was);
    if(!ok && tr) try{ tr.skipTransition(); }catch(e){}
  };
  ROOT.dataset.vt = k;
  /* Chromium no pinta en la foto de la pantalla de antes los dibujos con decoding=async: se piden ya descodificados */
  try{ D.querySelectorAll("#app img[decoding=async]").forEach(i => { if(i.complete) i.decoding = "sync"; }); }catch(e){}
  try{ tr = D.startViewTransition(update); }
  catch(e){ if(SEQ === my) delete ROOT.dataset.vt; await update(); return; }
  /* una pantalla que tarda en pintarse no deja la de antes congelada: se salta la animación y se ve llegar */
  let ended = false;
  const guard = setTimeout(() => { if(!ended) try{ tr.skipTransition(); }catch(e){} }, 300);
  upP.then(() => { ended = true; clearTimeout(guard); });
  try{ tr.ready.catch(() => {}); }catch(e){}
  try{ tr.updateCallbackDone.catch(() => {}); }catch(e){}
  const fin = Promise.resolve(tr.finished).catch(() => {}).then(() => { if(SEQ === my) delete ROOT.dataset.vt; });
  BUSY = fin; fin.then(() => { if(BUSY === fin) BUSY = null; });
  /* (si el navegador no llegara a llamar a update, se pinta igual) */
  await Promise.race([upP, new Promise(r => setTimeout(r, 6000))]);
  if(!started) await update();
  else await upP;
}
const idle = () => BUSY ? BUSY.then(() => idle()) : Promise.resolve();

/* ---------- los datos de una pantalla, antes de pintarla ----------
   Para las rutas sin ROUTES[x].load. Nunca se pide un documento que no está en el índice (un 404 sería un error). */
async function inIndex(id){ try{ const idx = await getIndex(); return Array.isArray(idx) && idx.some(d => d && d.id === id); }catch(e){ return false; } }
const docIf = async id => { if(id && await inIndex(id)) await getDoc(id); };
const LOAD = {
  leccion: async p => {
    const id = p.join("/"); await getMap();
    if(id.startsWith("G-")) return getGram();
    const lv = typeof lessonLv === "function" ? lessonLv(id) : id.slice(0, 2);
    const u = (MAP && MAP[lv] || []).find(u => u && Array.isArray(u.ls) && u.ls.some(l => l.id === id));
    const l = u && u.ls.find(l => l.id === id);
    if(!l || !Array.isArray(l.w)) return;
    await Promise.all([...new Set([...l.w.map(x => x[0]), u.doc].filter(Boolean))].map(d => getDoc(d)));
  },
  doc: p => docIf(p.join("/")),
  palabras: () => getIndex(),
  mapa: () => getMap(),
  gramatica: () => getMap(),
  repaso: async () => {
    if(typeof rv !== "undefined" && rv && rv.q && rv.i < rv.q.length && !rv.end) return;
    const ids = [...new Set((typeof dueList === "function" ? dueList() : []).map(x => x.d))];
    await Promise.all(ids.map(id => docIf(id)));
  },
  album: p => p[0] ? (async () => { let id = p[0]; try{ id = decodeURIComponent(id); }catch(e){} await docIf(id); })() : getIndex(),
  juegos: p => {
    if(!p[0]) return null;
    let t = null; try{ t = new URLSearchParams(location.hash.split("?")[1] || "").get("t"); }catch(e){}
    if(!t) t = typeof store === "object" ? store.get("games:topic", "animales") : "animales";
    return typeof t === "string" ? docIf(t) : null;
  },
  progreso: () => getMap(),
};
function loader(h){
  const s = sec(hp("#/" + String(h || "").replace(/^#?\/?/, "")));
  const f = LOAD[s];
  return f ? parts => f(Array.isArray(parts) ? parts : []) : null;
}

/* ---------- el título que se encoge ---------- */
let TT = null, colRaf = 0, colOn = false, colTxt = "";
function ttEl(){
  const tb = D.getElementById("topbar"); if(!tb) return null;
  if(!TT || !TT.isConnected){
    TT = D.createElement("span"); TT.className = "tb-title"; TT.id = "tb-title"; TT.setAttribute("aria-hidden", "true");
    tb.appendChild(TT);
  }
  return TT;
}
const shownEl = el => !!el && el.getClientRects().length > 0;
/* centrada en la pantalla si cabe entre lo de la izquierda (bandera o cápsula de volver) y el grupo de la derecha;
   si no, en el hueco que queda, con puntos suspensivos si ni así */
function place(t, txt){
  if(t.textContent !== txt) t.textContent = txt;
  const tb = D.getElementById("topbar"), lf = [D.getElementById("dv-back"), D.getElementById("lang-b")].find(shownEl);
  const rt = tb && tb.querySelector(".tb-right");
  const tbr = tb.getBoundingClientRect();
  const L = (lf ? lf.getBoundingClientRect().right : tbr.left + 16) + 8, R = (shownEl(rt) ? rt.getBoundingClientRect().left : tbr.right - 16) - 8;
  t.style.maxWidth = "none";
  const w = Math.min(t.getBoundingClientRect().width, Math.max(0, R - L));
  const x = Math.max(L, Math.min(innerWidth / 2 - w / 2, R - w));
  t.style.left = `${Math.round(x - tbr.left)}px`; t.style.maxWidth = `${Math.max(0, Math.floor(R - L))}px`;
}
/* el título grande de la pantalla: el de la raíz de la pestaña (#tabhead) o, en una pantalla de dentro (con la cápsula
   de volver: html[data-back]), su primer <h1> a la vista («Cuentos del zorro», «Animales», «Mi casa»…) */
function titleEl(){
  const head = D.getElementById("tabhead");
  const t = head && !head.hidden ? head.querySelector(".th-t") : null;
  if(t || !ROOT.hasAttribute("data-back")) return t;
  const app = D.getElementById("app");
  return app ? [...app.querySelectorAll("h1")].find(shownEl) || null : null;
}
function collapse(){
  const tb = D.getElementById("topbar"), h1 = titleEl();
  let on = false;
  if(h1 && tb && !ROOT.hasAttribute("data-focus") && shownEl(tb) && shownEl(h1)){
    const rt = tb.querySelector(".tb-right"), lim = shownEl(rt) ? rt.getBoundingClientRect().bottom : tb.getBoundingClientRect().bottom;
    on = h1.getBoundingClientRect().bottom <= lim + .5;
  }
  if(on){
    const t = ttEl(), txt = (h1.textContent || "").trim();
    if(t && (!colOn || txt !== colTxt)){ place(t, txt); colTxt = txt; }
  }
  if(on !== colOn){ colOn = on; ROOT.toggleAttribute("data-tcol", on); }
  return on;
}
function colSoon(){ if(!colRaf) colRaf = requestAnimationFrame(() => { colRaf = 0; collapse(); }); }
addEventListener("scroll", colSoon, {passive: true});
const reColl = () => { colTxt = ""; colSoon(); };   /* (vuelve a medir dónde va el título) */
addEventListener("resize", reColl);
try{ new MutationObserver(reColl).observe(ROOT, {attributes: true, attributeFilter: ["data-focus", "data-bar", "data-back"]}); }catch(e){}

/* ---------- vibración de los momentos buenos ---------- */
const buzz = () => { try{ if(W.G && typeof G.haptic === "function") G.haptic("success"); }catch(e){} };
if(typeof bus === "object" && bus){
  ["lesson-done", "medal", "gift-open", "album-complete", "season-done"].forEach(ev => bus.on(ev, buzz));
  bus.on("route", d => {
    const h = hp("#/" + String((d && d.h) || ""));
    if(h === hp()) LAST = h;
    reColl();
  });
  bus.on("boot", () => { ttEl(); colSoon(); });
}
if(D.readyState !== "loading") ttEl(); else D.addEventListener("DOMContentLoaded", () => ttEl(), {once: true});

W.vocabNavMotion = Object.freeze({kind, run, loader, idle, collapse, get busy(){ return !!BUSY; }});
})();
