/* módulo welcome: la bienvenida de la primera vez, al abrir la app en un aparato nuevo.
   - Cuándo: al arrancar en Hoy (#/), solo si el aparato está «nuevo» (en localStorage no hay "lang", "game", map:* ni
     srs:*), sin Google conectado (vocabSync.connected(): la partida llega sola) y sin vocab:ui {hello} (se apunta al
     terminarla o al saltarla; es de este aparato, DEVICE_ONLY en js/save.js). Pruebas: ?hello=off la apaga y ?hello=on
     la enseña también en un navegador automático (con navigator.webdriver no sale sola, como la llamada de js/calls.js:
     las pruebas que empiezan sin nada no se la encuentran); en la dirección de la página o en la del hash, para esta
     sesión (sessionStorage "vocab:hello"; ?hello=auto lo quita).
   - Una hoja a pantalla completa en el móvil (M.openSheet, data-detent=large; desde 820 px, centrada), en 2 pasos, con
     «Saltar» siempre arriba a la derecha (y Esc): a) el zorro pregunta «¿Qué quieres aprender?» y hay 3 banderas
     grandes; tocar una la elige (setLang) y suena su saludo grabado con say() (hello, bonjour, hej; con su IPA);
     «Siguiente». b) «¿Cómo te llamas?», un campo grande (20 letras como mucho) y «¡Vamos!»: el idioma (setLang y
     "lang"), game.name y a la primera lección del camino (#/leccion/<id>). «Saltar» se queda en Hoy.
   - El zorro habla en español solo tras un toque (hmSpeak de index.html: la voz que elige useVoice(u, "es-ES")): el
     primer toque en la hoja (fuera de un botón) lee la pregunta, «Siguiente» lee «¿Cómo te llamas?» y el altavoz la
     repite. Sin voz española en el aparato no hay altavoz (html sin data-es-voice).
   - Mientras está abierta no suena la llamada del zorro (js/calls.js no llama con un dialog abierto) y los avisos de
     M.toast esperan a que se cierre.
   API: window.vocabWelcome = {open(), close(), wanted(), fresh(), get isOpen()} */
(() => {
"use strict";
const D = document, W = window, ROOT = D.documentElement, SKEY = "vocab:hello";
const WORDS = {english: {w: "hello", ipa: "/həˈləʊ/"}, "français": {w: "bonjour", ipa: "/bɔ̃ʒuʁ/"}, dansk: {w: "hej", ipa: "/ˈhaj/"}};
const Q1 = "¿Qué quieres aprender?", Q2 = "¿Cómo te llamas?", MAXN = 20;
const IC = (n, s = "bold", z = 20, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
const h = s => typeof esc === "function" ? esc(s) : String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const rm = () => !!(W.M && typeof M.rm === "function" && M.rm());
const hap = () => { try{ if(W.G && typeof G.haptic === "function") G.haptic("selection"); }catch(e){} };
const FINE = matchMedia("(pointer:fine)");

/* ---------- ¿sale? ---------- */
function setQ(q){
  q = String(q || "").toLowerCase();
  try{ if(q === "on" || q === "off") sessionStorage.setItem(SKEY, q); else if(q === "auto") sessionStorage.removeItem(SKEY); }catch(e){}
}
try{ const q = new URLSearchParams(location.search).get("hello"); if(q) setQ(q); }catch(e){}
function readHash(){
  const i = location.hash.indexOf("?"); if(i < 0) return;
  try{ const q = new URLSearchParams(location.hash.slice(i + 1)).get("hello"); if(q) setQ(q); }catch(e){}
}
const forced = () => { try{ return sessionStorage.getItem(SKEY) || ""; }catch(e){ return ""; } };
/* un aparato nuevo: nada de idioma, partida, camino ni repaso guardados */
function fresh(){
  try{
    for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(k === "lang" || k === "game" || /^(map|srs):/.test(k)) return false; }
  }catch(e){ return false; }
  return true;
}
const seen = () => { try{ const o = W.vocabUI ? vocabUI.get() : JSON.parse(localStorage.getItem("vocab:ui") || "{}"); return !!(o && o.hello); }catch(e){ return false; } };
const onHoy = () => (typeof hashPath === "function" ? hashPath() : location.hash.replace(/^#\/?/, "").split("?")[0]) === "";
const linked = () => { try{ return !!(W.vocabSync && typeof vocabSync.connected === "function" && vocabSync.connected()); }catch(e){ return false; } };
function wanted(){
  readHash();
  const f = forced(); if(f === "off") return false;
  if(navigator.webdriver && f !== "on") return false;
  return onHoy() && fresh() && !seen() && !linked() && !ROOT.hasAttribute("data-tech");
}

/* ---------- la hoja ---------- */
let DLG = null, STEP = 1, PICK = null, SPOKE = false, DONE = false, NAME = "";
function css(){
  if(D.getElementById("css-welcome")) return;
  const s = D.createElement("style"); s.id = "css-welcome"; s.textContent = CSS; D.head.appendChild(s);
}
const CSS = `
dialog.wl.m-sheet{padding:0 16px max(16px,env(safe-area-inset-bottom,0px))}
dialog.wl .m-grab{display:none}
@media (max-width:819px){dialog.wl.m-sheet{inset:0;width:100%;max-width:none;height:100%;max-height:none;margin:0;border-radius:0;
  padding:env(safe-area-inset-top,0px) max(16px,env(safe-area-inset-right,0px)) max(16px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}}
@media (min-width:820px){dialog.wl.m-sheet{max-width:560px;padding:0 24px 24px}}
.wl-in{display:flex;flex-direction:column;min-height:100%;max-width:520px;margin:0 auto;text-align:center}
.wl-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px}
.wl-bar .glass-btn{min-height:var(--tap,44px)}
.wl-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:4px 0 16px}
.wl-fox{display:flex;transform-origin:50% 92%}
.wl-q{display:flex;align-items:center;justify-content:center;gap:10px;margin:0;font:700 var(--fs-t1)/1.15 var(--f-round);color:var(--label);text-wrap:balance}
.wl-q label{display:inline;margin:0;font:inherit}
.wl-spk{flex:none;display:grid;place-items:center;width:44px;height:44px;margin:0;padding:0;border:0;border-radius:50%;background:var(--brand-soft);color:var(--brand-ink);cursor:pointer;-webkit-tap-highlight-color:transparent}
.wl-spk.is-playing{background:var(--brand-fill);color:#fff}
.wl-flags{display:grid;gap:12px;width:100%;margin:0;padding:0}
.wl-flag{position:relative;display:flex;align-items:center;gap:14px;width:100%;min-height:76px;margin:0;padding:10px 14px 10px 10px;border:0;border-radius:20px;
  background:var(--card-2);color:var(--label);font:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;
  box-shadow:inset 0 0 0 2px transparent;transition:box-shadow .15s,background-color .15s,scale .1s}
.wl-flag:active{scale:.98}
.wl-flag[aria-pressed=true]{background:var(--brand-soft);box-shadow:inset 0 0 0 3px var(--brand-fill)}
.wl-fl{flex:none;width:56px;height:56px;border-radius:14px;overflow:hidden;box-shadow:0 0 0 1px rgb(0 0 0/.08)}
.wl-fl svg{display:block;width:100%;height:100%}
.wl-ft{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.wl-ft b{font:700 var(--fs-head)/1.2 var(--f-round)}
.wl-hi{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 8px;font:600 var(--fs-sub)/1.25 var(--f-text);color:var(--label2)}
.wl-hi .ipa{font-size:var(--fs-note)}
.wl-play{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--card);color:var(--brand-ink)}
.wl-flag[aria-pressed=true] .wl-play,.wl-flag.playing .wl-play{background:var(--brand-fill);color:#fff}
.wl-name{display:block;box-sizing:border-box;width:100%;min-height:64px;margin:0;padding:10px 20px;border:2px solid var(--sep);border-radius:18px;
  background:var(--card-2);color:var(--label);font:700 var(--fs-t1)/1.2 var(--f-round);text-align:center}
.wl-name::placeholder{color:var(--label3);font-weight:600}
.wl-name:focus{outline:none;border-color:var(--brand-fill);box-shadow:0 0 0 3px var(--brand-soft)}
.wl-hint{margin:-6px 0 0;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.wl-foot{padding:4px 0 0}
.wl-flag:focus-visible,.wl-spk:focus-visible{outline:3px solid var(--brand-tint);outline-offset:3px}
@media (max-height:700px){.wl-body{gap:12px}.wl-flag{min-height:68px}.wl-fl{width:48px;height:48px}}
@media (forced-colors:active){.wl-flag{border:1px solid CanvasText}.wl-flag[aria-pressed=true]{outline:3px solid Highlight}}
@media (prefers-reduced-motion:reduce){.wl-flag{transition:none}.wl-flag:active{scale:none}}
:root[data-motion=calm] .wl-flag{transition:none}`;
function el(){
  if(DLG && DLG.isConnected) return DLG;
  css();
  DLG = D.createElement("dialog");
  DLG.id = "wl"; DLG.className = "wl"; DLG.dataset.detent = "large"; DLG.setAttribute("aria-labelledby", "wl-q");
  DLG.innerHTML = `<div class="wl-in" id="wl-in"></div>`;
  DLG.addEventListener("click", onClick);
  DLG.addEventListener("keydown", e => { if(e.key === "Enter" && e.target && e.target.id === "wl-name"){ e.preventDefault(); go(); } });
  DLG.addEventListener("input", e => { if(e.target && e.target.id === "wl-name") NAME = e.target.value; });
  DLG.addEventListener("close", () => finish());
  D.body.appendChild(DLG);
  return DLG;
}
const fox = () => `<div class="wl-fox" aria-hidden="true">${typeof heroHtml === "function" ? heroHtml(88) : ""}</div>`;
const spk = q => `<button type="button" class="wl-spk" data-say aria-label="Escuchar: ${h(q)}">${IC("speaker-high", "fill", 22)}</button>`;
function flagHtml(k){
  const L = LANGS[k], wd = WORDS[k], es = (typeof LANG_ES !== "undefined" && LANG_ES[k]) || [L.name];
  return `<button type="button" class="wl-flag" data-lang="${h(k)}" aria-pressed="${k === PICK}">
    <span class="wl-fl" aria-hidden="true">${(typeof FLAGS !== "undefined" && FLAGS[k]) || ""}</span>
    <span class="wl-ft"><b>${h(es[0])}</b><span class="wl-hi"><span lang="${h(L.code)}">${h(wd.w)}</span>${typeof ipaHtml === "function" ? ipaHtml(wd.ipa, L.code) : ""}</span></span>
    <span class="wl-play" aria-hidden="true">${IC("speaker-high", "fill", 20)}</span></button>`;
}
function paint(){
  const box = DLG && DLG.querySelector("#wl-in"); if(!box) return;
  const skip = `<button type="button" class="glass-btn glass-btn--sm" data-skip aria-label="Saltar la bienvenida">Saltar</button>`;
  if(STEP === 1){
    box.innerHTML = `<div class="wl-bar"><span></span>${skip}</div>
      <div class="wl-body">${fox()}
        <h2 class="wl-q" id="wl-q"><span>${h(Q1)}</span>${spk(Q1)}</h2>
        <div class="wl-flags" role="group" aria-labelledby="wl-q">${Object.keys(LANGS).filter(k => WORDS[k]).map(flagHtml).join("")}</div>
      </div>
      <div class="wl-foot"><button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" data-next>Siguiente${IC("arrow-right", "bold", 20)}</button></div>`;
  } else {
    box.innerHTML = `<div class="wl-bar"><button type="button" class="glass-btn glass-btn--sm" data-back aria-label="Atrás: elegir idioma">${IC("caret-left", "bold", 18)}Atrás</button>${skip}</div>
      <div class="wl-body">${fox()}
        <h2 class="wl-q" id="wl-q"><label for="wl-name">${h(Q2)}</label>${spk(Q2)}</h2>
        <input class="wl-name" id="wl-name" type="text" maxlength="${MAXN}" autocomplete="given-name" autocapitalize="words" spellcheck="false" enterkeyhint="go" placeholder="Tu nombre" value="${h(NAME)}">
        <p class="wl-hint">Así te saluda el zorro.</p>
      </div>
      <div class="wl-foot"><button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" data-go>${IC("play", "fill", 20)}¡Vamos!</button></div>`;
  }
  try{ if(typeof hmEsPaint === "function") hmEsPaint(); }catch(e){}
}
const talk = (t, btn) => { try{ return typeof hmSpeak === "function" && hmSpeak(t, btn); }catch(e){ return false; } };
function onClick(e){
  const t = e.target;
  if(t.closest("[data-skip]")){ SPOKE = true; close(); return; }
  if(t.closest("[data-back]")){ SPOKE = true; STEP = 1; paint(); focusIn("[data-next]"); return; }
  const sb = t.closest("[data-say]");
  if(sb){ SPOKE = true; talk(STEP === 1 ? Q1 : Q2, sb); return; }
  const f = t.closest("[data-lang]");
  if(f){ SPOKE = true; pick(f.dataset.lang, f); return; }
  if(t.closest("[data-next]")){
    SPOKE = true; hap();
    if(!PICK) PICK = lang;
    STEP = 2; paint();
    talk(Q2, DLG.querySelector(".wl-spk"));
    if(FINE.matches) focusIn("#wl-name"); else focusIn(".wl-q");
    return;
  }
  if(t.closest("[data-go]")){ go(); return; }
  /* el primer toque fuera de un botón (en el zorro, en la pregunta…): el zorro la lee */
  if(!SPOKE && !t.closest("button,input,a,label")){ SPOKE = true; talk(STEP === 1 ? Q1 : Q2, DLG.querySelector(".wl-spk")); }
}
function focusIn(sel){
  const x = DLG && DLG.querySelector(sel); if(!x) return;
  if(x.tagName === "H2" && !x.hasAttribute("tabindex")) x.tabIndex = -1;
  try{ x.focus({preventScroll: true}); }catch(e){}
}
/* tocar una bandera: ese idioma (setLang, el de toda la app) y su saludo grabado con say() */
function pick(k, btn){
  if(!LANGS[k] || !WORDS[k]) return;
  hap();
  PICK = k;
  DLG.querySelectorAll("[data-lang]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === k)));
  try{ if(typeof setLang === "function" && k !== lang) setLang(k); }catch(e){ console.error(e); }
  try{ say(WORDS[k].w, btn); }catch(e){}
}
async function go(){
  if(DONE) return;
  const name = String(NAME || "").replace(/\s+/g, " ").trim().slice(0, MAXN);
  const k = PICK && LANGS[PICK] ? PICK : lang;
  try{ if(typeof setLang === "function" && k !== lang) setLang(k); }catch(e){ console.error(e); }
  try{ store.set("lang", lang); }catch(e){}
  if(name){ try{ const g = game(); g.name = name; gameSet(g); }catch(e){ console.error(e); } }
  try{ if(W.G && typeof G.haptic === "function") G.haptic("success"); }catch(e){}
  let id = null;
  try{ const L = typeof nextLesson === "function" ? await nextLesson() : null; id = L && L.l && L.l.id || null; }catch(e){ console.error(e); }
  await close();
  location.hash = id ? "#/leccion/" + encodeURIComponent(id) : "#/mapa";
}

/* ---------- abrir y cerrar ---------- */
let T0 = null, TQ = [];
function hold(){
  if(T0 || !W.M || typeof M.toast !== "function") return;
  T0 = M.toast; M.toast = (text, o) => { TQ.push([text, o]); };
}
function unhold(){
  if(!T0) return;
  M.toast = T0; T0 = null;
  TQ.splice(0).forEach(([t, o], i) => setTimeout(() => { try{ M.toast(t, o); }catch(e){} }, 450 + i * 60));
}
async function open(){
  const d = el();
  if(d.open) return;
  STEP = 1; PICK = null; SPOKE = false; DONE = false; NAME = "";
  hold();
  try{ if(typeof getShop === "function") await getShop(); }catch(e){}   /* el dibujo del zorro (data/sprites.json) */
  if(d.open) return;
  paint();
  /* los 3 saludos grabados, ya pedidos (say() usa el mapa del idioma de ahora) */
  try{ Object.keys(WORDS).forEach(k => typeof loadClips === "function" && loadClips(k)); }catch(e){}
  try{ await (W.M && typeof M.openSheet === "function" ? M.openSheet(d, {}) : (d.showModal(), null)); }catch(e){ console.error(e); }
}
function close(){
  if(!DLG || !DLG.open){ finish(); return Promise.resolve(); }
  try{ if("speechSynthesis" in W) speechSynthesis.cancel(); }catch(e){}
  return W.M && typeof M.closeSheet === "function" ? M.closeSheet(DLG) : (DLG.close(), Promise.resolve());
}
/* al cerrarse de cualquier forma (Saltar, Esc, ¡Vamos!): no vuelve a salir en este aparato */
function finish(){
  if(DONE) return;
  DONE = true;
  try{ if(W.vocabUI && typeof vocabUI.set === "function") vocabUI.set("hello", 1);
    else { const o = JSON.parse(localStorage.getItem("vocab:ui") || "{}") || {}; o.hello = 1; localStorage.setItem("vocab:ui", JSON.stringify(o)); } }catch(e){}
  unhold();
  if(onHoy()) setTimeout(() => { const b = D.getElementById("hm-go"); if(b && onHoy()) try{ b.focus({preventScroll: true}); }catch(e){} }, 60);
}
function maybe(){ try{ if(wanted()) open(); }catch(e){ console.error(e); } }
if(typeof bus !== "undefined") bus.on("boot", () => setTimeout(maybe, 0));

W.vocabWelcome = Object.freeze({open, close, wanted, fresh, get isOpen(){ return !!(DLG && DLG.open); }});
})();
