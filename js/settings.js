/* Módulo settings: Ajustes (la hoja del engranaje), como Ajustes del iPhone.
   - window.openSettings(section?, {from, after}) → Promise<boolean>. Abre la hoja (M.openSheet; en el móvil, altura
     media y grande: crece al bajar el contenido, al subir el agarre o al entrar en una sub-página). section:
       ""/"root" (o nada) la portada · "voz" Voz y velocidad · "accesibilidad" · "mayores" Para mayores · "google" Para
       mayores con el bloque de Google a la vista · "descargar" Para mayores en «Descargar todo».
     "mayores", "google" y "descargar" pasan antes por la Puerta (window.adultGate); si no se pasa, da false y no abre.
     from: el botón del que sale la hoja; after(): se llama al cerrarla. También vale la forma de antes
     openSettings(after, fromEl) (la usa el engranaje).
   - Portada: el zorro con su traje, el nombre (game.name, el mismo de antes) y la racha · Sonido (interruptor; clave
     "mute" con sfx.toggle) · Voz y velocidad › (la hoja de voz de index.html, openCfg, dentro de la hoja) · Apariencia
     (Automático · Claro · Oscuro con setTheme; Automático borra "theme") · Accesibilidad › · Para mayores › (Puerta).
   - Accesibilidad: Reducir transparencia (html[data-glass=off]) · Reducir movimiento (data-motion=calm) · Aumentar
     contraste (data-contrast=more) · Texto más grande (data-text=large). Se guardan en localStorage "vocab:ui" (solo
     este aparato, no va en la partida) sin tocar sus otras propiedades; el <head> de index.html los pone antes de pintar.
   - Para mayores: Progreso por tema › · Google (el bloque lo monta js/sync.js en [data-sync-block]) · instalar la app
     · Descargar todo (offlinePanel) · Atajos (vocabShortcuts.adultHtml(), js/shortcuts.js) · Mostrar pronunciación (IPA)
     (encendido de serie: apagarlo guarda vocab:ui.ipa = false y encenderlo quita la marca; ipaOn() de index.html) · Buzón del tío (vocabMailbox.adultHtml()) · Llamadas del zorro (vocabCalls.adultHtml(), js/calls.js; encendido de serie) · Borrar grabaciones y fotos (vocabMailbox.mediaHtml(),
     solo si hay algo) · créditos · Privacidad.
   - Progreso por tema (el informe de antes de Premios, solo lectura): las repeticiones de los últimos 14 días (store
     "act") y, por partes (Temas · Las 3000 · Avanzado, data/index.json), cada tema empezado con sus palabras
     dominadas (caja ≥ MASTER) y aprendiendo de su total, con una barra; los que faltan, contados al pie. Lee srsAll()
     del idioma actual; no guarda nada.
   - Voz y velocidad: una fila por idioma (primero el que aprende); cada una entra en su página "voz-en" · "voz-fr" ·
     "voz-da" (título: el idioma; «‹ Voz y velocidad» vuelve y deja el foco en su fila) con las voces de este aparato
     (voiceListPage de index.html). Entrar sube la hoja a toda altura y volver la deja como estaba; en escritorio la
     página de un idioma mide al menos lo que Voz y velocidad. Si las voces llegan tarde (bus "voices"), la página
     abierta se repinta en su sitio.
   - Barra: el título siempre en el centro; si la etiqueta de volver no cabe a su lado se acorta a «Atrás» y, si
     tampoco, queda solo ‹ (fitBackLabel de index.html; aria-label sigue diciendo adónde vuelve).
   - Sub-páginas con navegación de iOS dentro de la hoja: «‹ Ajustes» vuelve; Esc vuelve (en la portada cierra).
   - Avisos del bus: "settings" {page, el, focus} al pintar una página (sync.js pinta ahí lo suyo) · "ui" {k, v} al
     cambiar una preferencia.
   - window.vocabUI = {get(), set(k, v), apply()}: las preferencias de "vocab:ui" ({glass:"off", motion:"calm",
     contrast:"more", text:"large", ipa:false, hints:{…} de js/gestures.js}). set(k, null | undefined) quita la clave;
     false se guarda (ipa:false = la IPA apagada; sin clave, o con un ipa:true de antes, se ve). */
(() => {
"use strict";
const D = document, ROOT = D.documentElement, UI = "vocab:ui";
const $ = id => D.getElementById(id);
const h = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const rm = () => window.M && typeof M.rm === "function" ? M.rm() : matchMedia("(prefers-reduced-motion: reduce)").matches;
const haptic = () => { try{ if(window.G && typeof G.haptic === "function") G.haptic("selection"); }catch(e){} };
const emit = (e, d) => { try{ if(typeof bus !== "undefined") bus.emit(e, d); }catch(err){} };
const PHONE = matchMedia("(max-width:819px)");

/* ---------- preferencias de este aparato ("vocab:ui") ---------- */
const A11Y = [
  {k: "glass", v: "off", t: "Reducir transparencia", d: "Las barras y las hojas se ven opacas, sin vidrio."},
  {k: "motion", v: "calm", t: "Reducir movimiento", d: "Menos animaciones, y más cortas."},
  {k: "contrast", v: "more", t: "Aumentar contraste", d: "Bordes y letras más marcados."},
  {k: "text", v: "large", t: "Texto más grande", d: "Letra más grande en toda la app."},
];
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
function uiGet(){ try{ const o = JSON.parse(localStorage.getItem(UI)); return isObj(o) ? o : {}; }catch(e){ return {}; } }
function uiSet(k, v){
  const o = uiGet();
  if(v === undefined || v === null) delete o[k]; else o[k] = v;
  try{ localStorage.setItem(UI, JSON.stringify(o)); }catch(e){}
  applyUI(o); emit("ui", {k, v: o[k]});
  return o;
}
function applyUI(o = uiGet()){
  for(const a of A11Y){
    if(o[a.k] === a.v) ROOT.dataset[a.k] = a.v;
    else if(ROOT.dataset[a.k] === a.v) delete ROOT.dataset[a.k];
  }
}
applyUI();
addEventListener("storage", e => { if(e.key === UI || e.key === null){ applyUI(); paintA11y(); } });
window.vocabUI = Object.freeze({get: uiGet, set: uiSet, apply: () => applyUI()});

/* ---------- estilos ---------- */
const CSS = `
dialog#ajustes.m-sheet{padding:0;overflow:hidden;height:min(680px,calc(100dvh - var(--safe-t,0px) - 24px))}
dialog#ajustes.m-sheet[open]{display:flex;flex-direction:column}
dialog#ajustes.m-sheet.glass{background:linear-gradient(180deg,rgb(255 255 255/.5) 0%,rgb(255 255 255/0) 120px),rgb(242 242 247/.94)}
:root[data-theme=dark] dialog#ajustes.m-sheet.glass{background:linear-gradient(180deg,rgb(255 255 255/.06) 0%,rgb(255 255 255/0) 120px),rgb(28 28 30/.94)}
/* a toda altura (y siempre desde 820 px), opaca: lo de detrás no se trasluce */
:root dialog#ajustes.m-sheet.glass[data-detent=large]{background:#F2F2F7;-webkit-backdrop-filter:none;backdrop-filter:none}
:root[data-theme=dark] dialog#ajustes.m-sheet.glass[data-detent=large]{background:#1C1C1E}
:root[data-glass=off] dialog#ajustes.m-sheet.glass,:root[data-contrast=more] dialog#ajustes.m-sheet.glass{background:#F2F2F7;-webkit-backdrop-filter:none;backdrop-filter:none}
:root[data-glass=off][data-theme=dark] dialog#ajustes.m-sheet.glass,:root[data-contrast=more][data-theme=dark] dialog#ajustes.m-sheet.glass{background:#1C1C1E}
@media (prefers-reduced-transparency:reduce){:root dialog#ajustes.m-sheet.glass{background:#F2F2F7;-webkit-backdrop-filter:none;backdrop-filter:none}
  :root[data-theme=dark] dialog#ajustes.m-sheet.glass{background:#1C1C1E}}
@media (prefers-contrast:more){:root dialog#ajustes.m-sheet.glass{background:#F2F2F7;-webkit-backdrop-filter:none;backdrop-filter:none}
  :root[data-theme=dark] dialog#ajustes.m-sheet.glass{background:#1C1C1E}}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){:root dialog#ajustes.m-sheet.glass{background:#F2F2F7}
  :root[data-theme=dark] dialog#ajustes.m-sheet.glass{background:#1C1C1E}}
@media (max-width:819px){
  dialog#ajustes.m-sheet{height:calc(100dvh - var(--safe-t,0px) - 24px)}
  dialog#ajustes.m-sheet[data-detent=medium]{height:min(calc(100dvh - var(--safe-t,0px) - 24px),max(420px,62dvh))}}
/* tableta grande y ordenador: hoja de formulario centrada, tan alta como la página que enseña (las páginas se apilan en
   la misma celda; la que no cabe se desplaza dentro) */
@media (min-width:820px){
  dialog#ajustes.m-sheet{--aj-max:min(760px,calc(100dvh - 152px));height:fit-content;max-height:var(--aj-max);padding:0}
  dialog#ajustes .aj-bar{padding-top:12px}
  dialog#ajustes .aj-pgs{display:grid;flex:0 1 auto}
  dialog#ajustes .aj-pg{position:relative;inset:auto;grid-area:1/1;max-height:calc(var(--aj-max) - 72px)}
  /* la página de un idioma no es más baja que Voz y velocidad: «‹» no salta de sitio al entrar en una corta */
  dialog#ajustes .aj-pg[data-pg^="voz-"]{min-height:var(--aj-vozh,0px)}
  :root dialog#ajustes.m-sheet.glass{background:#F2F2F7;-webkit-backdrop-filter:none;backdrop-filter:none}
  :root[data-theme=dark] dialog#ajustes.m-sheet.glass{background:#1C1C1E}}
dialog#ajustes .m-grab{flex:none;margin:0;position:relative}
.aj-bar{flex:none;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;min-height:52px;padding:0 16px 8px}
.aj-tt{grid-column:2;margin:0;font:600 var(--fs-head,1.1875rem)/1.2 var(--f-text,system-ui);color:var(--label);text-align:center;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:56vw}
.aj-tt:focus{outline:none}
.aj-back{grid-column:1;justify-self:start;display:inline-flex;align-items:center;gap:2px;min-height:var(--tap,44px);max-width:100%;padding:0 8px 0 2px;
  border:0;border-radius:var(--r-pill,999px);background:none;color:var(--brand-ink);font:400 var(--fs-sub,1.0625rem)/1.2 var(--f-text,system-ui);cursor:pointer;white-space:nowrap}
.aj-back[hidden]{display:none}
.aj-back span{overflow:hidden;text-overflow:ellipsis}
.aj-done{grid-column:3;justify-self:end;white-space:nowrap;min-width:max-content}
.aj-pgs{position:relative;flex:1 1 auto;min-height:0;overflow:hidden}
.aj-pg{position:absolute;inset:0;overflow:auto;overscroll-behavior:contain;padding:4px 16px max(28px,calc(var(--safe-b,0px) + 16px))}
.aj-pg[hidden]{display:none}
.aj-pg.aj-anim{will-change:transform,opacity}
.aj-me{display:flex;align-items:center;gap:14px;margin:0 0 22px;padding:12px 16px;border-radius:var(--r-card,24px);background:var(--card)}
:root[data-theme=dark] .aj-me{background:var(--card-2)}
.aj-av{flex:none;width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:var(--fill2);overflow:hidden}
.aj-av .hero{margin:0;line-height:1}
.aj-av>img{width:52px;height:52px;object-fit:contain}
.aj-me-t{flex:1;min-width:0}
.aj-nm{display:flex;align-items:center;gap:6px;color:var(--label2)}
.aj-name{flex:1;min-width:0;width:100%;min-height:var(--tap,44px);margin:0;padding:4px 0;border:0;border-radius:8px;background:none;color:var(--label);
  font:700 var(--fs-t3,1.375rem)/1.2 var(--f-round,system-ui)}
.aj-name::placeholder{color:var(--label2);opacity:1}
.aj-name:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.aj-st{display:flex;align-items:center;gap:6px;margin:2px 0 0;font:600 var(--fs-note,.9375rem)/1.3 var(--f-text,system-ui);color:var(--label2)}
.aj-st .ico{color:var(--gold-ink)}
dialog#ajustes .st-sec{margin:0 0 24px}
dialog#ajustes .aj-pg>.st-sec:last-child{margin-bottom:0}
dialog#ajustes .st-g{border-radius:var(--r-card,24px)}
dialog#ajustes .st-r{font-size:var(--fs-sub,1.0625rem)}
dialog#ajustes .st-g>*+.st-r::before{content:"";position:absolute;top:0;left:16px;right:0;height:1px;background:var(--sep);transform:scaleY(.5);transform-origin:0 0}
dialog#ajustes .st-g.ics>*+.st-r::before{left:58px}
dialog#ajustes .st-l small:empty{display:none}
dialog#ajustes a.st-r{color:var(--label)}
.aj-go{cursor:pointer}
.aj-val{flex:none;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--label2);font-size:var(--fs-sub,1.0625rem)}
.aj-chev{flex:none;display:grid;place-items:center;color:var(--label3)}
:root[data-contrast=more] .aj-chev{color:var(--label2)}
.st-ic.ok{background:#008932}.st-ic.sl{background:#46566c}.st-ic.gg{background:#fff;box-shadow:inset 0 0 0 1px rgba(60,60,67,.18)}
.st-ic.gg svg{width:18px;height:18px}
.st-foot{margin:8px 16px 0;font:400 var(--fs-note,.9375rem)/1.38 var(--f-text,system-ui);color:var(--label2)}
.st-foot a{color:var(--brand-ink)}
.st-foot:empty{display:none}
dialog#ajustes .st-g .seg{margin:0;max-width:none}
.aj-seg{padding:8px}
dialog#ajustes .st-cred{margin:0}
dialog#ajustes #aj-vh>.st-r::before{content:"";position:absolute;top:0;left:58px;right:0;height:1px;background:var(--sep);transform:scaleY(.5);transform-origin:0 0}
dialog#ajustes .aj-off .off-rows>.st-r:first-child::before{content:"";position:absolute;top:0;left:58px;right:0;height:1px;background:var(--sep);transform:scaleY(.5);transform-origin:0 0}
.aj-hint{margin:0 0 16px;padding:0 4px;font:400 var(--fs-sub,1.0625rem)/1.38 var(--f-text,system-ui);color:var(--label2)}
/* Progreso por tema: barras de 14 días y una barra por tema (dorado = dominadas, verde azulado = aprendiendo) */
.aj-dbox{padding:16px 16px 12px}
.aj-days{display:flex;align-items:flex-end;gap:4px;height:72px}
.aj-days i{flex:1;border-radius:4px;background:var(--fill)}
.aj-days i.on{background:var(--teal)}
.aj-dl{display:flex;justify-content:space-between;margin-top:4px;font:400 var(--fs-min,.8125rem)/1.3 var(--f-text,system-ui);color:var(--label2)}
.aj-ds{margin:8px 0 0;font:400 var(--fs-sub,1.0625rem)/1.3 var(--f-text,system-ui);color:var(--label)}
.aj-lg{display:flex;gap:16px;margin:-8px 4px 16px;font:400 var(--fs-note,.9375rem)/1.3 var(--f-text,system-ui);color:var(--label2)}
.aj-lg span{display:inline-flex;align-items:center;gap:8px}
.aj-lg i{width:12px;height:12px;border-radius:4px}
.aj-pb{display:flex;height:8px;margin-top:8px;border-radius:4px;background:var(--fill);overflow:hidden}
.aj-pb i{display:block;height:100%}
.aj-lg .m,.aj-pb .m{background:var(--gold)}
.aj-lg .l,.aj-pb .l{background:var(--teal)}
.aj-pn{flex:none;min-width:48px;text-align:right;font:600 var(--fs-sub,1.0625rem)/1 var(--f-text,system-ui);font-variant-numeric:tabular-nums;color:var(--label2)}
@media (forced-colors:active){.st-ic{border:1px solid CanvasText}}
`;
function css(){ if($("css-settings")) return; const s = D.createElement("style"); s.id = "css-settings"; s.textContent = CSS; D.head.appendChild(s); }

/* ---------- la hoja ---------- */
let dlg = null, stack = [], opt = {}, offHome = null, vozUp = false;
const PAGES = {
  root: {t: "Ajustes"},
  voz: {t: "Voz y velocidad"},
  acc: {t: "Accesibilidad"},
  mayores: {t: "Para mayores", gate: true},
  progreso: {t: "Progreso"},   /* corto: cabe en la barra con «‹ Para mayores» y «Listo» */
};
const SECTIONS = {"": [], root: [], sonido: [], apariencia: [], voz: ["voz"], "voz-en": ["voz", "voz-en"], "voz-fr": ["voz", "voz-fr"],
  "voz-da": ["voz", "voz-da"], accesibilidad: ["acc"], acc: ["acc"],
  mayores: ["mayores"], google: ["mayores"], descargar: ["mayores"], instalar: ["mayores"], creditos: ["mayores"]};
const GATE_WHY = {mayores: "Aquí están Google, instalar la app y descargar todo.", google: "Para guardar la partida en Google.",
  descargar: "Para descargar todo y usarla sin internet."};

function build(){
  if(dlg) return dlg;
  css();
  dlg = D.createElement("dialog");
  dlg.id = "ajustes"; dlg.className = "aj";
  dlg.setAttribute("aria-labelledby", "aj-tt");
  dlg.innerHTML = `<div class="aj-bar" data-sheet-grab>
      <button type="button" class="aj-back" id="aj-back" hidden>${ico("caret-left", "bold", 22)}<span id="aj-back-t">Ajustes</span></button>
      <h2 class="aj-tt" id="aj-tt" tabindex="-1">Ajustes</h2>
      <button type="button" class="glass-btn glass-btn--sm aj-done" id="aj-done">Listo</button></div>
    <div class="aj-pgs" id="aj-pgs"></div>`;
  D.body.appendChild(dlg);
  /* el ancho de la barra cambia al abrir la hoja, al girar el móvil o con letra más grande */
  try{ if(typeof ResizeObserver === "function") new ResizeObserver(() => fitBack()).observe(dlg.querySelector(".aj-bar")); }catch(e){}
  $("aj-done").onclick = () => close();
  $("aj-back").onclick = () => back();
  /* Esc en una sub-página vuelve atrás (en la portada, la hoja se cierra como siempre) */
  dlg.addEventListener("cancel", e => { if(stack.length > 1){ e.preventDefault(); e.stopImmediatePropagation(); back(); } });
  dlg.addEventListener("close", () => {
    if(dlg.open) return;
    const a = opt.after; opt = {};
    unmountOff();
    /* al cerrar Ajustes, la Puerta se vuelve a cerrar: el niño no entra después en Para mayores sin pregunta */
    try{ if(window.adultGate && typeof adultGate.forget === "function") adultGate.forget(); }catch(e){}
    /* fuera las páginas (la próxima vez empieza en la portada, y sus ids no se repiten con la hoja de voz) */
    dlg.querySelectorAll(".aj-pg").forEach(x => x.remove()); stack = []; vozUp = false;
    try{ if(typeof voiceNote === "function") voiceNote(); }catch(e){}
    emit("settings", {page: null});
    if(typeof a === "function") try{ a(); }catch(e){ console.error(e); }
  });
  /* altura media → grande: al bajar el contenido o al subir el agarre */
  $("aj-pgs").addEventListener("scroll", e => { if(dlg.dataset.detent === "medium" && e.target === pageEl(curPage()) && !e.target.classList.contains("aj-anim") && e.target.scrollTop > 2) detent("large"); }, true);
  let drag = null;
  dlg.addEventListener("pointerdown", e => {
    drag = e.isPrimary && e.target.closest && e.target.closest(".m-grab,.aj-bar") ? {id: e.pointerId, y: e.clientY, dy: 0} : null;
  });
  addEventListener("pointermove", e => {
    if(!drag || e.pointerId !== drag.id || !dlg.open) return;
    drag.dy = e.clientY - drag.y;
    if(drag.dy < -24 && dlg.dataset.detent === "medium") detent("large");
  }, true);
  addEventListener("pointerup", e => {
    if(!drag || e.pointerId !== drag.id) return;
    const dy = drag.dy; drag = null;
    /* de grande, un tirón corto hacia abajo la deja en media (uno largo la cierra, eso lo hace M) */
    if(PHONE.matches && dlg.open && dlg.dataset.detent === "large" && stack.length === 1 && dy > 70 && dy < dlg.getBoundingClientRect().height * .3) detent("medium");
  }, true);
  addEventListener("pointercancel", () => { drag = null; }, true);
  addEventListener("beforeinstallprompt", () => setTimeout(paintInstall, 0));
  addEventListener("appinstalled", () => setTimeout(paintInstall, 0));
  return dlg;
}
function detent(name, anim = true){
  if(!dlg) return;
  if(!PHONE.matches) name = "large";
  if(dlg.dataset.detent === name) return;
  const h0 = dlg.open ? dlg.getBoundingClientRect().height : 0;
  dlg.dataset.detent = name;
  if(!anim || !dlg.open || rm() || !window.M || !M.snappy) return;
  const h1 = dlg.getBoundingClientRect().height;
  if(Math.abs(h1 - h0) < 2) return;
  try{ dlg.animate([{height: h0 + "px"}, {height: h1 + "px"}], {duration: M.snappy.ms, easing: M.snappy.easing}); }catch(e){}
}
const pageEl = p => dlg && dlg.querySelector(`.aj-pg[data-pg="${p}"]`);
/* "voz-en" → "english" (la página de voces de ese idioma) */
const vozLang = p => { try{ return /^voz-/.test(p || "") && typeof CLIP_AB === "object" ? Object.keys(CLIP_AB).find(k => "voz-" + CLIP_AB[k] === p) || null : null; }catch(e){ return null; } };
const ttl = p => { const L = vozLang(p); return L ? (typeof LANG_ES === "object" && LANG_ES[L] ? LANG_ES[L][0] : LANGS[L].name) : (PAGES[p] || PAGES.root).t; };
const curPage = () => stack[stack.length - 1];
function pageNode(p){
  let el = pageEl(p);
  if(!el){ el = D.createElement("section"); el.className = "aj-pg"; el.dataset.pg = p; el.setAttribute("aria-labelledby", "aj-tt"); $("aj-pgs").appendChild(el); }
  return el;
}
function paintBar(){
  const p = curPage(), prev = stack[stack.length - 2];
  $("aj-tt").textContent = ttl(p);
  const b = $("aj-back"); b.hidden = !prev;
  if(prev){ $("aj-back-t").textContent = ttl(prev); b.setAttribute("aria-label", "Volver a " + ttl(prev)); }
  fitBack();
}
/* el título queda en el centro: si «‹ Voz y velocidad» no cabe a su lado, «‹ Atrás» y, si tampoco, solo ‹ (como en iOS) */
function fitBack(){
  const prev = stack[stack.length - 2];
  if(!dlg || !prev) return;
  try{ if(typeof fitBackLabel === "function") fitBackLabel($("aj-back"), $("aj-back-t"), $("aj-tt"), ttl(prev)); }catch(e){}
}
/* pinta una página (y avisa por el bus, para que sync.js ponga lo suyo) */
function render(p, focus){
  const el = pageNode(p);
  if(p === "root") el.innerHTML = rootHtml();
  else if(p === "acc") el.innerHTML = accHtml();
  else if(p === "mayores") el.innerHTML = adultHtml();
  else if(p === "progreso"){ el.innerHTML = ""; progFill(el); }
  else if(p === "voz" || vozLang(p)) el.innerHTML = "";
  wire(p, el);
  emit("settings", {page: p, el, focus: focus || ""});
  return el;
}
/* navegación como en iOS: la nueva entra desde la derecha y la de antes se aparta un poco y se apaga */
function slide(inEl, outEl, dir){
  const S = window.M && M.snappy, ms = S ? S.ms : 420, ease = S ? S.easing : "cubic-bezier(.2,.9,.25,1)";
  [inEl, outEl].forEach(el => { if(el) el.getAnimations().forEach(a => a.cancel()); });
  inEl.hidden = false;
  if(!outEl || outEl === inEl) return;
  /* la que sale: se quita si ya no está en la pila (sus ids no se repiten), o se esconde */
  const gone = () => {
    if(!outEl.isConnected || outEl.dataset.pg === curPage()) return;
    const h0 = boxH();
    if(stack.includes(outEl.dataset.pg)) outEl.hidden = true;
    else { if(outEl.querySelector("#aj-off")) unmountOff(); outEl.remove(); }
    fitH(h0);
  };
  if(rm()) return gone();
  const A = (el, k) => { el.classList.add("aj-anim"); const a = el.animate(k, {duration: ms, easing: ease}); const end = () => el.classList.remove("aj-anim"); a.finished.then(end, end); return a; };
  if(dir > 0){ A(inEl, [{transform: "translateX(100%)"}, {transform: "none"}]); A(outEl, [{transform: "none", opacity: 1}, {transform: "translateX(-30%)", opacity: 0}]).finished.then(gone, () => {}); }
  else { A(inEl, [{transform: "translateX(-30%)", opacity: 0}, {transform: "none", opacity: 1}]); A(outEl, [{transform: "none"}, {transform: "translateX(100%)"}]).finished.then(gone, () => {}); }
}
/* en el ordenador la hoja mide lo que su página: al cambiar de página, la altura cambia con una animación corta */
const boxH = () => dlg && dlg.open ? dlg.getBoundingClientRect().height : 0;
function fitH(h0){
  if(PHONE.matches || !h0 || !dlg.open || rm()) return;
  const h1 = boxH(); if(Math.abs(h1 - h0) < 2) return;
  try{ dlg.animate([{height: h0 + "px"}, {height: h1 + "px"}], {duration: 260, easing: "cubic-bezier(.2,.9,.25,1)"}); }catch(e){}
}
function push(p, o = {}){
  const from = pageEl(curPage()), h0 = boxH();
  stack.push(p);
  const el = render(p, o.focus);
  el.scrollTop = 0;
  paintBar();
  if(vozLang(p) && curPage() === p && stack[stack.length - 2] === "voz"){
    vozUp = dlg.dataset.detent === "medium";
    const vz = pageEl("voz"); if(vz && !PHONE.matches) dlg.style.setProperty("--aj-vozh", vz.offsetHeight + "px");
  }
  if(p !== "voz") detent("large", !o.instant);   /* Voz y velocidad es corta: se queda a media altura */
  if(o.instant){ if(from) from.hidden = true; el.hidden = false; }
  else { slide(el, from, 1); fitH(h0); try{ $("aj-tt").focus({preventScroll: true}); }catch(e){} }
  return el;
}
function back(){
  if(stack.length < 2) return close();
  const out = stack.pop(), outEl = pageEl(out), inEl = pageEl(curPage());
  if(out === "voz"){ try{ if(typeof voiceNote === "function") voiceNote(); }catch(e){} }
  if(curPage() === "root") paintRoot();
  /* de la página de un idioma a Voz y velocidad: su fila dice ya la voz elegida y recibe el foco (como en iOS) */
  let row = null;
  if(curPage() === "voz" && vozLang(out) && inEl){
    try{ if(typeof paintVoz === "function") paintVoz(inEl); }catch(e){ console.error(e); }
    row = inEl.querySelector("#cfg-l-" + out.slice(4));
    if(vozUp) detent("medium");
  }
  if(curPage() === "voz") vozUp = false;
  paintBar();
  const h0 = boxH();
  slide(inEl, outEl, -1);
  fitH(h0);
  try{ (row || $("aj-tt")).focus({preventScroll: true}); }catch(e){}
}
function close(){
  if(!dlg || !dlg.open) return;
  if(window.M && typeof M.closeSheet === "function" && dlg.classList.contains("m-sheet")) M.closeSheet(dlg); else dlg.close();
}

/* ---------- portada ---------- */
const rateText = () => { const r = +(typeof rate !== "undefined" ? rate : .9) || .9;
  return r < .75 ? "Lenta" : r <= 1 ? "Normal" : "Rápida"; };
function heroBox(){
  try{ if(typeof heroHtml === "function" && typeof game === "function") return heroHtml(46, game()); }catch(e){}
  return `<img src="img/pj/zorro.png" alt="" draggable="false">`;
}
function streakText(){
  let n = 0; try{ n = typeof streak === "function" ? streak() : 0; }catch(e){}
  return n > 0 ? `${n} ${n === 1 ? "día seguido" : "días seguidos"}` : "¡Hoy empieza tu racha!";
}
function chev(){ return `<span class="aj-chev" aria-hidden="true">${ico("caret-right", "bold", 16)}</span>`; }
function navRow(id, ic, cls, label, val){
  return `<button type="button" class="st-r aj-go" id="${id}"><span class="st-ic${cls ? " " + cls : ""}" aria-hidden="true">${ico(ic, "bold", 18)}</span>`
    + `<span class="st-l">${h(label)}${val && val.sub ? `<small ${val.attr || ""}>${h(val.sub)}</small>` : val && val.attr ? `<small ${val.attr}></small>` : ""}</span>`
    + `${val && val.v ? `<span class="aj-val">${h(val.v)}</span>` : ""}${chev()}</button>`;
}
function accOn(){ const o = uiGet(); return A11Y.filter(a => o[a.k] === a.v); }
function rootHtml(){
  let name = ""; try{ name = typeof game === "function" ? game().name || "" : ""; }catch(e){}
  const muted = typeof sfx !== "undefined" && !!sfx.muted, on = accOn();
  const mode = typeof themeMode === "function" ? themeMode() : "auto";
  return `<div class="aj-me">
      <div class="aj-av" aria-hidden="true">${heroBox()}</div>
      <div class="aj-me-t">
        <label class="aj-nm">${ico("pencil-simple", "bold", 16)}<input class="aj-name" id="aj-name" maxlength="20" autocomplete="off" enterkeyhint="done"
          placeholder="Escribe tu nombre" aria-label="Tu nombre" value="${h(name)}"></label>
        <p class="aj-st">${ico("fire", "fill", 18)}<span id="aj-streak">${h(streakText())}</span></p></div></div>
    <section class="st-sec" aria-label="Sonido y voz"><div class="st-g ics">
      <label class="st-r" for="aj-snd"><span class="st-ic tl" aria-hidden="true">${ico("speaker-high", "bold", 18)}</span><span class="st-l">Sonido</span>
        <input type="checkbox" role="switch" class="st-sw" id="aj-snd" ${muted ? "" : "checked"}></label>
      ${navRow("aj-voz", "chat-circle-text", "", "Voz y velocidad", {v: rateText()})}
    </div></section>
    <section class="st-sec" aria-labelledby="aj-thl"><h3 class="st-h" id="aj-thl">Apariencia</h3><div class="st-g aj-seg">
      <div class="seg" id="aj-th" role="radiogroup" aria-labelledby="aj-thl">${[["auto", "Automático"], ["light", "Claro"], ["dark", "Oscuro"]].map(([k, t]) =>
        `<button type="button" class="seg-i" role="radio" data-th="${k}" aria-checked="${mode === k}" tabindex="${mode === k ? 0 : -1}">${t}</button>`).join("")}</div>
    </div></section>
    <section class="st-sec" aria-label="Más ajustes"><div class="st-g ics">
      ${navRow("aj-acc", "person-arms-spread", "", "Accesibilidad", {v: on.length ? (on.length === 1 ? "1 activado" : on.length + " activados") : ""})}
      ${navRow("aj-may", "lock", "gr", "Para mayores", {attr: "data-sync-cfg"})}
    </div></section>`;
}
/* lo que cambia sin repintar la portada al volver de una sub-página */
function paintRoot(){
  const el = pageEl("root"); if(!el) return;
  const v = el.querySelector("#aj-voz .aj-val"); if(v) v.textContent = rateText();
  const a = el.querySelector("#aj-acc"); if(a){ const n = accOn().length, old = a.querySelector(".aj-val");
    if(old) old.remove(); if(n) a.querySelector(".aj-chev").insertAdjacentHTML("beforebegin", `<span class="aj-val">${n === 1 ? "1 activado" : n + " activados"}</span>`); }
  const s = el.querySelector("#aj-snd"); if(s && typeof sfx !== "undefined") s.checked = !sfx.muted;
  emit("settings", {page: "root", el, focus: ""});
}

/* ---------- Accesibilidad ---------- */
function accHtml(){
  const o = uiGet();
  return `<p class="aj-hint">Para ver y usar mejor la app. Se guarda solo en este aparato.</p>
    <section class="st-sec" aria-label="Accesibilidad"><div class="st-g">${A11Y.map(a => `
      <label class="st-r" for="aj-a-${a.k}"><span class="st-l">${h(a.t)}<small>${h(a.d)}</small></span>
        <input type="checkbox" role="switch" class="st-sw" id="aj-a-${a.k}" data-ui="${a.k}" ${o[a.k] === a.v ? "checked" : ""}></label>`).join("")}
    </div></section>`;
}
function paintA11y(){
  const el = pageEl("acc"); if(!el) return;
  const o = uiGet();
  A11Y.forEach(a => { const c = el.querySelector(`[data-ui="${a.k}"]`); if(c) c.checked = o[a.k] === a.v; });
}

/* ---------- Para mayores ---------- */
function credits(){
  const c = typeof creditsHtml === "function" ? creditsHtml() : "";
  return c.replace(/\s*·\s*<b>Vocabulary<\/b>[\s\S]*$/, "") || c;
}
function installHtml(){ return typeof installRow === "function" ? installRow() : ""; }
function voiceHelp(){ try{ return typeof voiceHelpRow === "function" ? voiceHelpRow() : ""; }catch(e){ return ""; } }
function adultHtml(){
  const ipa = typeof ipaOn === "function" ? ipaOn() : uiGet().ipa !== false;
  return `<section class="st-sec" aria-label="Progreso"><div class="st-g ics">
      ${navRow("aj-prog", "graduation-cap", "ok", "Progreso por tema", {sub: "Palabras dominadas y repasos de 14 días"})}</div></section>
    <section class="st-sec" aria-labelledby="aj-g-h"><h3 class="st-h" id="aj-g-h">Google</h3><div data-sync-block>
      <p class="st-foot">Guardar en Google no está disponible ahora.</p></div></section>
    <section class="st-sec" aria-labelledby="aj-app-h"><h3 class="st-h" id="aj-app-h">La app</h3><div class="st-g ics">
      <div id="aj-inst">${installHtml()}</div>
      <div class="aj-off" id="aj-off"></div></div></section>
    ${window.vocabShortcuts && typeof vocabShortcuts.adultHtml === "function" ? vocabShortcuts.adultHtml() : ""}
    <section class="st-sec" aria-labelledby="aj-l-h"><h3 class="st-h" id="aj-l-h">Pronunciación</h3><div class="st-g ics">
      <label class="st-r" for="aj-ipa"><span class="st-ic tl" aria-hidden="true">${ico("text-aa", "bold", 18)}</span>
        <span class="st-l">Mostrar pronunciación (IPA)<small>Símbolos de cómo suena cada palabra.</small></span>
        <input type="checkbox" role="switch" class="st-sw" id="aj-ipa" ${ipa ? "checked" : ""}></label><div id="aj-vh">${voiceHelp()}</div></div></section>
    ${window.vocabMailbox && typeof vocabMailbox.adultHtml === "function" ? vocabMailbox.adultHtml() : ""}
    ${window.vocabCalls && typeof vocabCalls.adultHtml === "function" ? vocabCalls.adultHtml() : ""}
    ${window.vocabHunter && typeof vocabHunter.adultHtml === "function" ? vocabHunter.adultHtml() : ""}
    ${window.vocabMailbox && typeof vocabMailbox.mediaHtml === "function" ? vocabMailbox.mediaHtml() : ""}
    <section class="st-sec" aria-labelledby="aj-c-h"><h3 class="st-h" id="aj-c-h">Créditos</h3><div class="st-g ics">
      <p class="st-cred">${credits()}</p>
      <a class="st-r" href="privacy.html#es" id="aj-priv"><span class="st-ic" aria-hidden="true">${ico("shield-check", "bold", 18)}</span><span class="st-l">Privacidad</span>${chev()}</a>
    </div></section>`;
}
function paintInstall(){
  const w = $("aj-inst"); if(!w) return;
  w.innerHTML = installHtml(); wireInstall();
}
function wireInstall(){
  const b = $("cfg-inst"); if(!b || typeof installEv === "undefined") return;
  b.onclick = async () => {
    if(!installEv) return;
    const ev = installEv; installEv = null;
    try{ ev.prompt(); await ev.userChoice; }catch(e){}
    paintInstall();
  };
}
/* «Descargar todo»: el bloque de index.html usa ids fijos, así que si está también en la página (Premios) se aparta
   mientras la hoja lo enseña, y vuelve al cerrarla */
function mountOff(){
  const host = $("aj-off"); if(!host || typeof offlinePanel !== "function") return;
  const other = D.querySelector("main #off-panel");
  if(other && other.querySelector(".off-dl")){ other.innerHTML = ""; offHome = other; }
  offlinePanel(host, {row: true});
}
function unmountOff(){
  const host = $("aj-off"); if(host) host.innerHTML = "";
  const o = offHome; offHome = null;
  if(o && o.isConnected && typeof offlinePanel === "function") offlinePanel(o);
}

/* ---------- Progreso por tema ---------- */
const PGROUPS = [["temas", "Temas"], ["3000", "Las 3000"], ["avanzado", "Avanzado"]];
async function progFill(el){
  let idx = [];
  try{ idx = typeof getIndex === "function" ? await getIndex() : []; }catch(e){ idx = []; }
  if(!el.isConnected || curPage() !== "progreso") return;
  el.innerHTML = progHtml(Array.isArray(idx) ? idx : []);
  emit("settings", {page: "progreso", el, focus: ""});
}
function progHtml(idx){
  const L = typeof lang === "string" ? lang : "", m = Object.values(typeof srsAll === "function" ? srsAll() : {});
  const MB = typeof MASTER === "number" ? MASTER : 4;
  let act = {}; try{ act = typeof store !== "undefined" ? store.get("act", {}) || {} : {}; }catch(e){ act = {}; }
  const key = d => typeof dayKey === "function" ? dayKey(d) : d.toLocaleDateString("sv");
  const days = [];
  for(let k = 13; k >= 0; k--){ const d = new Date(); d.setDate(d.getDate() - k); const n = +act[key(d)] || 0; days.push({n, lbl: d.toLocaleDateString("es", {weekday: "short"})}); }
  const max = Math.max(1, ...days.map(x => x.n)), total = days.reduce((a, x) => a + x.n, 0);
  const by = {};
  for(const x of m){ if(!x || !x.d) continue; const o = by[x.d] = by[x.d] || {l: 0, m: 0}; if(+x.b >= MB) o.m++; else o.l++; }
  const all = {m: 0, l: 0}; Object.values(by).forEach(o => { all.m += o.m; all.l += o.l; });
  const pct = (a, b) => b ? Math.min(100, 100 * a / b).toFixed(1) : "0";
  const row = d => {
    const o = by[d.id], n = Math.max(1, +d.count || 0), mm = Math.min(o.m, n), ll = Math.min(o.l, n - mm);
    return `<div class="st-r aj-pr"><span class="st-l">${h(d.title)}<small>${mm} de ${n} dominadas${ll ? ` · ${ll} aprendiendo` : ""}</small>
      <span class="aj-pb" aria-hidden="true"><i class="m" style="width:${pct(mm, n)}%"></i><i class="l" style="width:${pct(ll, n)}%"></i></span></span>
      <span class="aj-pn">${Math.round(100 * mm / n)}%</span></div>`;
  };
  const groups = PGROUPS.map(([g, t], i) => {
    const docs = idx.filter(d => d && d.group === g && (d.langs || []).includes(L));
    if(!docs.length) return "";
    const on = docs.filter(d => by[d.id]), off = docs.length - on.length;
    const foot = off ? `<p class="st-foot">${on.length ? "Y " : ""}${off} ${off === 1 ? "tema" : "temas"} por empezar.</p>` : "";
    return `<section class="st-sec" aria-labelledby="aj-pr-${i}"><h3 class="st-h" id="aj-pr-${i}">${t}</h3>
      ${on.length ? `<div class="st-g">${on.map(row).join("")}</div>` : ""}${foot}</section>`;
  }).join("");
  const nm = typeof LANGS === "object" && LANGS[L] ? LANGS[L].name : "";
  return `<p class="aj-hint">Lo aprendido en ${h(nm)}: ${all.m} ${all.m === 1 ? "palabra dominada" : "palabras dominadas"} y ${all.l} aprendiendo. Una palabra está dominada cuando su repaso toca cada 14 días o más.</p>
    <section class="st-sec" aria-labelledby="aj-pr-d"><h3 class="st-h" id="aj-pr-d">Últimos 14 días</h3><div class="st-g aj-dbox">
      <div class="aj-days" role="img" aria-label="${total} ${total === 1 ? "repetición" : "repeticiones"} en los últimos 14 días">${days.map(x =>
        `<i class="${x.n ? "on" : ""}" style="height:${x.n ? Math.max(8, Math.round(100 * x.n / max)) : 6}%"></i>`).join("")}</div>
      <div class="aj-dl" aria-hidden="true"><span>${h(days[0].lbl)}</span><span>hoy</span></div>
      <p class="aj-ds"><b>${total}</b> ${total === 1 ? "repetición" : "repeticiones"} en total</p></div></section>
    <div class="aj-lg" aria-hidden="true"><span><i class="m"></i>Dominadas</span><span><i class="l"></i>Aprendiendo</span></div>
    ${groups}`;
}

/* ---------- qué hace cada cosa ---------- */
function wire(p, el){
  if(p === "root"){
    const nm = el.querySelector("#aj-name");
    if(nm){
      const save = () => { try{ if(typeof game !== "function" || typeof gameSet !== "function") return; const g = game(), v = nm.value.trim().slice(0, 20); if(g.name !== v){ g.name = v; gameSet(g); } }catch(e){} };
      nm.onchange = save; nm.onblur = save;
      nm.onkeydown = e => { if(e.key === "Enter"){ e.preventDefault(); nm.blur(); } };
    }
    const snd = el.querySelector("#aj-snd");
    if(snd) snd.onchange = () => { if(typeof sfx !== "undefined" && sfx.muted === snd.checked) sfx.toggle(); haptic(); };
    const th = [...el.querySelectorAll("[data-th]")];
    th.forEach(b => b.onclick = () => {
      if(typeof setTheme === "function") setTheme(b.dataset.th);
      if(typeof paintTheme === "function") paintTheme();
      th.forEach(x => { const on = x === b; x.setAttribute("aria-checked", on); x.tabIndex = on ? 0 : -1; });
      haptic();
    });
    const seg = el.querySelector("#aj-th");
    if(seg) seg.onkeydown = e => {
      const i = th.indexOf(D.activeElement), k = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key];
      if(i < 0 || !k) return;
      e.preventDefault(); const b = th[(i + k + th.length) % th.length]; b.focus(); b.click();
    };
    el.querySelector("#aj-voz").onclick = () => push("voz");
    el.querySelector("#aj-acc").onclick = () => push("acc");
    el.querySelector("#aj-may").onclick = e => {
      const b = e.currentTarget;
      gate("mayores", b).then(ok => { if(ok && dlg.open && curPage() === "root"){ push("mayores"); afterGate(); } });
    };
  } else if(p === "voz"){
    if(typeof openCfg === "function") openCfg(null, null, el, L => { if(curPage() === "voz" && typeof CLIP_AB === "object" && CLIP_AB[L]) push("voz-" + CLIP_AB[L]); });
  } else if(vozLang(p)){
    if(typeof voiceListPage === "function") voiceListPage(el, vozLang(p));
  } else if(p === "acc"){
    el.querySelectorAll("[data-ui]").forEach(c => c.onchange = () => {
      const a = A11Y.find(x => x.k === c.dataset.ui); if(!a) return;
      uiSet(a.k, c.checked ? a.v : null); haptic();
    });
  } else if(p === "mayores"){
    const pr = el.querySelector("#aj-prog");
    if(pr) pr.onclick = () => push("progreso");
    wireInstall();
    mountOff();
    const ipa = el.querySelector("#aj-ipa");
    /* encendida es lo normal (sin marca); apagada se guarda como ipa:false. ipaWas: cómo estaba al abrir (al cerrar la
       hoja, si cambió, se repinta la pantalla de debajo) */
    if(ipa) ipa.onchange = () => { if(ipaWas === null) ipaWas = !ipa.checked; uiSet("ipa", ipa.checked ? null : false); haptic(); };
  }
}
/* la Puerta se cierra con su animación y, al cerrarse, el navegador devuelve el foco a la fila que la abrió (que ya está
   escondida): el foco va al título de la página nueva */
function afterGate(){
  const g = $("gate"), t = () => {
    if(!dlg || !dlg.open) return;
    const a = D.activeElement, pg = pageEl(curPage());
    if(a && a !== dlg && (a === $("aj-tt") || (pg && pg.contains(a)))) return;   /* ya está en la página nueva (p. ej. «Entrar con Google») */
    try{ $("aj-tt").focus({preventScroll: true}); }catch(e){}
  };
  if(g && g.open) g.addEventListener("close", () => setTimeout(t, 0), {once: true}); else t();
}
function gate(section, from){
  if(typeof window.adultGate !== "function") return Promise.resolve(true);
  return window.adultGate({reason: GATE_WHY[section] || GATE_WHY.mayores, from});
}

/* ---------- abrir ---------- */
async function openSettings(a, b){
  let section = "", o = {};
  if(typeof a === "function") o.after = a;
  else if(typeof a === "string") section = a.toLowerCase();
  else if(isObj(a) && !a.nodeType) o = Object.assign({}, a);
  if(b && b.nodeType === 1) o.from = b; else if(isObj(b)) Object.assign(o, b);
  if(!Object.prototype.hasOwnProperty.call(SECTIONS, section)) section = "";
  const path = SECTIONS[section];
  build();
  if(path.some(p => PAGES[p] && PAGES[p].gate) && !(dlg.open && stack.includes("mayores"))){
    if(!await gate(section, o.from)) return false;
    o.gated = true;
  }
  try{ if(typeof getShop === "function") await getShop(); }catch(e){}
  const focus = section === "google" || section === "descargar" ? section : "";
  if(!dlg.open){
    opt = {after: o.after};
    dlg.querySelectorAll(".aj-pg").forEach(x => x.remove());
    stack = ["root"];
    render("root");
    paintBar();
    dlg.dataset.detent = path.length || !PHONE.matches ? "large" : "medium";
    path.forEach(p => push(p, {instant: true, focus}));
    D.querySelectorAll(".aj-pg").forEach(x => { if(x.closest("#ajustes")) x.hidden = x.dataset.pg !== curPage(); });
    if(window.M && typeof M.openSheet === "function") await M.openSheet(dlg, {from: o.from});
    else { try{ dlg.showModal(); }catch(e){ dlg.setAttribute("open", ""); } }
  } else {
    if(typeof o.after === "function") opt.after = o.after;
    for(const p of path) if(!stack.includes(p)) push(p, {focus});
  }
  if(o.gated) afterGate();
  if(focus === "descargar"){ const x = $("aj-off"); if(x) try{ x.scrollIntoView({block: "center"}); }catch(e){} }
  return true;
}
window.openSettings = openSettings;
window.vocabSettings = Object.freeze({open: openSettings, close, back, get page(){ return dlg && dlg.open ? curPage() : null; }, detent: () => dlg && dlg.dataset.detent});

/* las voces del aparato llegan tarde (Chrome, Edge, Safari): lo abierto se repinta en su sitio, sin cambiar de página */
try{ if(typeof bus !== "undefined") bus.on("voices", () => {
  if(!dlg || !dlg.open) return;
  const vz = pageEl("voz"), L = vozLang(curPage()), vh = $("aj-vh");
  if(vz && typeof paintVoz === "function") paintVoz(vz);
  if(L && typeof voiceListPage === "function") voiceListPage(pageEl(curPage()), L, {keep: true});
  if(vh) vh.innerHTML = voiceHelp();
}); }catch(e){}
/* el sonido cambió desde otro sitio */
try{ if(typeof bus !== "undefined") bus.on("mute", () => { const s = $("aj-snd"); if(s && typeof sfx !== "undefined") s.checked = !sfx.muted; }); }catch(e){}
/* la IPA se encendió o se apagó con la hoja abierta: al cerrarla se repinta la pantalla de debajo, como al cambiar de
   idioma (lo ya pintado, como la Palabra del día girada o un detalle abierto de Palabras, seguía como antes). Sin perder
   lo que había a medias: la ficha de un tema se repinta en su sitio (vocabLearn.repaint(): la ronda de Preguntas y el
   orden de «Barajar» siguen), y en un juego (también en su pantalla final, fuera del modo foco) no se toca nada: volver
   a su ruta empezaría otra partida, y cada ronda ya mira ipaOn(). En el modo foco no hay engranaje; por si acaso, ahí
   tampoco se toca nada */
let ipaWas = null;
try{ if(typeof bus !== "undefined") bus.on("settings", e => {
  if(!e || e.page !== null || ipaWas === null) return;
  const was = ipaWas; ipaWas = null;
  if(typeof ipaOn !== "function" || ipaOn() === was || typeof route !== "function" || ROOT.hasAttribute("data-focus")) return;
  if(/^juegos\/./.test(typeof hashPath === "function" ? hashPath() : "")) return;
  const L = window.vocabLearn;
  if(L && typeof L.repaint === "function" && L.repaint()) return;
  route();
}); }catch(e){}
})();
