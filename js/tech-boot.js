/* Módulo tech-boot (window.vocabTech): la puerta de Tech Prep, la sección escondida para preparar entrevistas técnicas
   de un mayor (S1-SPEC §2-§3). Es lo único de Tech Prep que se carga al abrir la app y no pide nada a la red mientras
   el interruptor está apagado:
   · El interruptor de este aparato (localStorage "tech:on" = "true"; fuera de la partida): la fila «Tech Prep» de
     Ajustes › Para mayores (adultHtml(), en español como el resto de esa página). Apagado: no hay entrada en el menú de
     idioma ni rutas (#/tech… no existe: route() lo cambia por #/) ni se pide data/tech/….
   · La entrada «Tech Prep» del menú de la bandera (menuItem(), que pinta renderLangs de index.html): cierra el menú,
     pasa la Puerta (adultGate, «Para entrar en Tech Prep.») y va a #/tech. Pasada una vez, vale para esta sesión del
     navegador (sessionStorage "tech:in"): recargar o moverse por Tech Prep no la vuelve a pedir; una sesión nueva que
     abre directamente un #/tech… la pide antes de enseñar nada (blocks()) y, si no se pasa, va a #/.
   · Las rutas de Tech Prep (SECS) en ROUTES, como propiedades con getter y setter: el getter da un cargador fino que
     carga los módulos y llama a la ruta de verdad; el setter guarda la ruta de verdad que registra cada módulo
     (ROUTES.techpath = async parts => …, y ROUTES.techpath.load = parts => promesa, si quiere). Así un enlace directo o
     una recarga funcionan aunque el módulo aún no esté cargado, y apagar el interruptor las quita todas.
   · load(): js/tech.js, js/tech-lesson.js y js/tech-pages.js, en ese orden y con el mismo ?v= que este fichero, una sola
     vez; ready es la promesa que se cumple cuando han llegado. Un módulo que aún no existe en esta versión (no está en
     SHELL de sw.js) no se pide: sus rutas enseñan «Coming soon» y ready se cumple igual.
   API (js/tech.js añade el resto con Object.assign): window.vocabTech = {SECS, on(), setOn(v), inSession(), isSec(h),
     active(h), ready, load(), loaded, enter(from), gate(from), leave(lang), blocks(hp), backOf(h), setBack(sec, fn),
     menuItem(), adultHtml()}. */
(() => {
"use strict";
const W = window, D = document, ROOT = D.documentElement;
const SECS = Object.freeze(["tech", "techpath", "techunit", "techsheet", "techgloss", "techplay", "techcases", "techcase",
  "techstories", "techstory", "techmock", "techl"]);
const MODS = ["js/tech.js", "js/tech-lesson.js", "js/tech-pages.js"];
const ON = "tech:on", IN = "tech:in", UI = "tech:ui";
const REASON = "Para entrar en Tech Prep.";
/* el ?v= de este <script> (la VERSION de sw.js): los módulos salen de la misma versión */
const V = (() => { try{ const s = D.currentScript && D.currentScript.src, m = s && /[?&]v=([^&#]+)/.exec(s); return m ? `?v=${m[1]}` : ""; }catch(e){ return ""; } })();
const T = W.vocabTech = W.vocabTech || {};

const LS = {get: k => { try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set: (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} }, del: k => { try{ localStorage.removeItem(k); }catch(e){} }};
const SS = {get: k => { try{ return sessionStorage.getItem(k); }catch(e){ return null; } },
  set: (k, v) => { try{ sessionStorage.setItem(k, v); }catch(e){} }, del: k => { try{ sessionStorage.removeItem(k); }catch(e){} }};
const on = () => LS.get(ON) === "true";
const inSession = () => SS.get(IN) === "1";
const path = h => typeof h === "string" ? h.replace(/^#\/?/, "").split("?")[0] : hashPath();
const isSec = h => SECS.includes(secOf(path(h)));
/* ¿se está en Tech Prep? (una ruta suya, con el interruptor encendido y la Puerta pasada en esta sesión) */
const active = h => isSec(h == null ? hashPath() : h) && on() && inSession();
function uiGet(){ try{ const o = JSON.parse(LS.get(UI)); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; }catch(e){ return {}; } }
function uiSet(p){ LS.set(UI, JSON.stringify(Object.assign(uiGet(), p))); }

/* ---------- los módulos ---------- */
let readyRes = null;
const ready = new Promise(r => { readyRes = r; });
/* los módulos que trae esta versión: los de SHELL de sw.js (todo fichero de la app está ahí). Sin red, la lista de la
   última vez (tech:ui.mods, de este aparato) */
let modsP = null;
function present(){
  const last = () => { const m = uiGet().mods; return Array.isArray(m) && m.length ? MODS.filter(p => m.includes(p)) : MODS.slice(); };
  if(!modsP) modsP = navigator.onLine === false ? Promise.resolve(last())
    : fetch("sw.js", {cache: "no-store"}).then(r => r.ok ? r.text() : Promise.reject(new Error(String(r.status))))
      .then(t => { const m = MODS.filter(p => t.includes(`"${p}"`)); uiSet({mods: m}); return m; })
      .catch(last);
  return modsP;
}
function inject(src){
  return new Promise((res, rej) => {
    if(D.querySelector(`script[data-tech-mod="${src}"]`)) return res();
    const s = D.createElement("script");
    s.src = src + V; s.async = false; s.dataset.techMod = src;
    s.onload = () => res();
    s.onerror = () => { s.remove(); rej(new Error("Tech Prep could not load. Check the connection and try again.")); };
    D.head.appendChild(s);
  });
}
let loadP = null;
function load(){
  if(!loadP) loadP = present().then(async list => {
    for(const src of MODS){
      if(!list.includes(src)) continue;
      try{ await inject(src); }
      catch(e){ if(src === MODS[0]) throw e; console.warn("[tech]", src, e.message); }   /* sin una página, el resto funciona */
    }
    if(!T.loaded) throw new Error("Tech Prep could not start.");
    T.mods = list.slice();
    readyRes(T);
    return T;
  }).catch(e => { loadP = null; modsP = null; throw e; });
  return loadP;
}

/* ---------- las rutas ---------- */
const IMPL = {}, LOADS = {}, WRAP = {};
const $app = () => D.getElementById("app");
function failHtml(msg){
  return `<div class="tp-page tp-fail"><div class="card tp-card"><h2 class="tp-title">Tech Prep isn't available</h2>
    <p class="tp-sub">${esc(msg || "Something went wrong.")}</p>
    <a class="glass-btn glass-btn--sm" href="#/">Back to languages</a></div></div>`;
}
function wrap(s){
  const f = async parts => {
    if(!on() || !inSession()){ location.replace("#/"); return; }
    try{ await load(); }
    catch(e){ if(secOf(hashPath()) === s){ const a = $app(); if(a) a.innerHTML = failHtml(e.message); } return; }
    if(secOf(hashPath()) !== s) return;   /* mientras llegaba se fue a otra pantalla */
    const g = IMPL[s];
    if(typeof g === "function") return g(parts || []);
    if(typeof T.missing === "function") return T.missing(s, parts || []);
    const a = $app(); if(a) a.innerHTML = failHtml("This part of Tech Prep is coming soon.");
  };
  /* ROUTES.x.load: lo que index.html pide antes de pintar con movimiento (los módulos y, luego, lo que pida la ruta) */
  Object.defineProperty(f, "load", {configurable: true, enumerable: true,
    get: () => parts => load().then(() => { const g = LOADS[s] || (IMPL[s] && IMPL[s].load); return typeof g === "function" ? g(parts || []) : null; }),
    set: g => { LOADS[s] = typeof g === "function" ? g : null; }});
  return f;
}
function defineRoutes(){
  for(const s of SECS){
    const d = Object.getOwnPropertyDescriptor(ROUTES, s);
    if(d && d.get) continue;
    if(d && typeof d.value === "function") IMPL[s] = d.value;   /* una que se registró a pelo mientras tanto */
    Object.defineProperty(ROUTES, s, {configurable: true, enumerable: true,
      get: () => WRAP[s] || (WRAP[s] = wrap(s)),
      set: g => { IMPL[s] = typeof g === "function" ? g : null; }});
  }
}
function dropRoutes(){ for(const s of SECS) delete ROUTES[s]; }

/* ---------- la Puerta ---------- */
function gate(from){
  if(typeof W.adultGate !== "function") return Promise.resolve(false);
  return Promise.resolve(W.adultGate({reason: REASON, from: from && from.nodeType === 1 ? from : null}))
    .then(ok => { if(ok) SS.set(IN, "1"); return !!ok; }, () => false);
}
/* entrar desde la parte del niño (el menú de idioma): siempre por la Puerta (que recuerda unos minutos a quien la acaba
   de pasar, js/gate.js) y a #/tech. Desde dentro de Tech Prep, sin Puerta. */
async function enter(from){
  if(!on()) return false;
  if(!ROOT.hasAttribute("data-tech") && !await gate(from)) return false;
  navTo("#/tech");
  return true;
}
/* al salir de Tech Prep a la parte del niño se olvida "tech:in": volver (Atrás, un enlace) pide otra vez la Puerta.
   Recargar o moverse dentro de Tech Prep no sale (index.html avisa con "tech-mode" al cambiar de juego de pestañas) */
bus.on("tech-mode", d => { if(d && !d.on) SS.del(IN); });
/* salir a la parte del niño (un idioma del menú de la bandera dentro de Tech Prep): a #/ y, si es otro, ese idioma */
function leave(k){
  const change = typeof LANGS === "object" && LANGS[k] && k !== lang;
  if(change){ try{ history.pushState(null, "", "#/"); }catch(e){ location.hash = "#/"; return; } setLang(k); }
  else navTo("#/");
}
/* route() pregunta antes de pintar: una sesión nueva que abre #/tech… pasa antes la Puerta (true: se queda donde está);
   dentro de Tech Prep, la sesión de foco abierta (vocabTech.focus, js/tech.js) puede retener la salida */
let gateP = null;
function blocks(hp){
  if(isSec(hp) && on() && !inSession()){
    if(!gateP) gateP = gate(null).then(ok => {
      gateP = null;
      if(!isSec(hashPath())) return;
      if(ok) route(); else location.replace("#/");
    });
    return true;
  }
  try{ return !!(T.focus && typeof T.focus._blocks === "function" && T.focus._blocks(hp)); }catch(e){ console.error(e); return false; }
}

/* ---------- la cápsula de volver de la barra de arriba (backOf de index.html) ---------- */
const BACKS = {
  techunit: () => ({h: "#/techpath", t: "Path"}),
  techsheet: () => ({h: "#/techpath", t: "Path"}),
  techcase: () => ({h: "#/techcases", t: "My cases"}),
  techstory: () => ({h: "#/techstories", t: "My stories"}),
};
function backOf(h){
  const f = BACKS[secOf(path(h))];
  try{ const b = f ? f(path(h)) : null; return b && typeof b.h === "string" ? {h: b.h, t: String(b.t || "Back")} : null; }catch(e){ console.error(e); return null; }
}
function setBack(sec, fn){ if(SECS.includes(sec)) BACKS[sec] = typeof fn === "function" ? fn : () => null; }

/* ---------- el menú de la bandera y Para mayores ---------- */
function menuItem(){
  if(!on()) return "";
  const cur = ROOT.hasAttribute("data-tech");
  return `<button type="button" class="lm-i lm-tp" role="menuitemradio" data-tech-entry aria-checked="${cur}" tabindex="-1" lang="en-GB">
    <span class="flag tp-flag" aria-hidden="true">${ico("briefcase", "fill", 18)}</span><span class="lm-t">Tech Prep<small>Interview prep</small></span>${ico("check", "bold", 22, "lm-chk")}</button>`;
}
function adultHtml(){
  return `<section class="st-sec" id="aj-tp" aria-label="Tech Prep"><div class="st-g ics">
      <label class="st-r" for="aj-tp-on"><span class="st-ic sl" aria-hidden="true">${ico("briefcase", "bold", 18)}</span>
        <span class="st-l"><span lang="en-GB">Tech Prep</span><small>Preparar entrevistas técnicas, en inglés. Solo en este aparato.</small></span>
        <input type="checkbox" role="switch" class="st-sw" id="aj-tp-on" ${on() ? "checked" : ""}></label>
    </div></section>`;
}
function setOn(v){
  if(v){ LS.set(ON, "true"); defineRoutes(); }
  else { LS.del(ON); SS.del(IN); dropRoutes(); }
  try{ renderLangs(); }catch(e){}
  try{ bus.emit("tech", {on: !!v}); }catch(e){}
  if(!v && isSec(hashPath())) location.replace("#/");
}
bus.on("settings", d => {
  if(!d || d.page !== "mayores" || !d.el) return;
  const sw = d.el.querySelector("#aj-tp-on"); if(!sw) return;
  sw.checked = on();
  sw.onchange = () => { setOn(sw.checked); try{ if(W.G && typeof G.haptic === "function") G.haptic("selection"); }catch(e){} };
});
/* otra pestaña lo enciende o lo apaga */
addEventListener("storage", e => {
  if(e.key !== ON && e.key !== null) return;
  if(on()) defineRoutes(); else { dropRoutes(); if(isSec(hashPath())) location.replace("#/"); }
  try{ renderLangs(); }catch(err){}
});

if(on()) defineRoutes();
Object.assign(T, {SECS, on, setOn, inSession, isSec, active, ready, load, loaded: !!T.loaded, enter, gate, leave, blocks,
  backOf, setBack, menuItem, adultHtml});
})();
