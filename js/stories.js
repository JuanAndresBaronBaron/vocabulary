/* Módulo stories (window.vocabStories): «Cuentos del zorro» (SPEC §5-I).
   · #/cuentos (pestaña Jugar, segmento Juegos): la estantería del idioma, con portadas grandes (2 columnas en el móvil,
     4 desde 744 px). El primer cuento (n = 1) siempre está abierto; los demás se abren al saber el 90 % de sus
     palabras (las de "words" que están en el repaso, srsAll(), mirado cada vez que se pinta). Uno cerrado sale en gris
     con candado, «Aprende N palabras más de este cuento» y una barrita; tocarlo abre una hoja con las palabras que
     faltan (dibujo, palabra, IPA y altavoz) e «Ir al camino». Uno que se acaba de abrir desde la última visita da un
     saltito; uno abierto sin leer lleva «¡Nuevo!»; uno leído, «Leído» y cuántos finales lleva.
   · #/cuento/<id>: el cuento en modo foco (html[data-focus=cuento]: sin barras, con la ✕ y las monedas), como un libro:
     arriba el dibujo grande (40 % del alto en el móvil, sobre una placa del color del cuento) y debajo el texto grande
     (28-40 px). Portada, páginas, la página de elegir (dos tarjetas con dibujo: cambian el final) y 2-4 páginas del
     final elegido; después, «The End / Fin / Slut» con el zorro y los finales encontrados. Se pasa de página con
     ‹ y «Siguiente» (abajo, siempre a la vista), deslizando la página (G.swipe) y con ← →.
     Cada página se lee sola al llegar (y con el altavoz; la tortuga, despacio): una frase cada vez con la voz del
     navegador, useVoice(u, idioma) y retryLocal en onerror. La palabra que suena se ilumina: por tiempo (el peso de
     cada palabra según su largo y las pausas de las comas y los puntos, con una velocidad que se corrige con lo que
     duró de verdad cada frase) y, si el navegador da onboundary, por su charIndex. Una frase de una sola palabra
     con audio grabado (audio/<ab>.json) suena con su mp3; sin voz del idioma no se lee con otro acento (lo avisa).
     Tocar una palabra la dice despacio (su mp3 si lo tiene; si no, la voz a SLOW()) y abre un globo con su dibujo,
     la palabra, su IPA (ipaHtml) y su traducción. «Español» enseña la traducción de la página.
     Al llegar al final: award(10) la primera vez que se termina cada cuento (como mucho 3 cuentos pagados al día; si
     ya hay 3, se paga al terminarlo otro día), la medalla «Ratón de biblioteca» con 4 cuentos (achList de index.html)
     y bus "story-done" {id, end, first} (los atajos de Hoy: js/shortcuts.js). Releer o ver el otro final no paga.
     Toda la pantalla lleva data-no-renew (js/sync.js no pide el permiso de Google en mitad de un cuento).
   Formato de data/stories (lo escribe y lo valida un generador; cada página nombra sus dibujos de img/ o img/pj/):
     data/stories/index.json = {v: 1, english|français|dansk: [{id, file, n, title, es, short, cover, tint, words, pages}]}
     data/stories/<en|fr|da>/<slug>.json = {v: 1, id: "<ab>-<slug>", lang, n (orden en la estantería; 1 = libre), title (en
       el idioma), es (título en español), short (nombre corto en español para los atajos), cover (img/pj/…), tint
       (green|yellow|blue|teal), words: [{w, id: "tema|es" del corpus, img?}] (las palabras del cuento: cuentan para
       abrirlo), gloss: {"superficie en minúsculas" (1-3 palabras: "fox", "le renard", "det er nat"): {es, ipa, id?, img?}}
       (todas las palabras del texto tienen la suya), pages: [{img, also?: [hasta 2 dibujos más], t, es, gl?: {glosas
       solo de esa página}}], choice: {img, also?, t, es, gl?, opts: [{key, t, es, img, pages: [...]}, {…}]}}.
     Cada camino (páginas + elegir + un final) tiene 8-12 páginas. Palabras: letras con ' ’ o - por dentro; se juntan
     en una unidad las 2-3 seguidas que tienen glosa (la más larga primero).
   Guardado:
     localStorage "cuentos" (EXACT en js/save.js: va en la partida exportada y en Google Drive; solo se escribe al
       terminar un cuento) = {v: 1, done: {<id>: {d: "AAAA-MM-DD" (la última vez), e: [finales vistos], n: veces, p: 1 si ya
       pagó}}, pay: {d: "AAAA-MM-DD", n: cuentos pagados ese día}}.
     vocab:ui (solo este aparato) → tales: {u: [ids abiertos la última vez que se vio la estantería]}.
     sessionStorage "vocab:cuento" = {id, p, ch, es}: por dónde va (al volver a entrar o recargar sigue ahí).
   window.vocabStories = {ready() → Promise<índice>, index(), list(idioma?), story(id) → Promise, saved(), doneCount(),
     lock(id) → {free, open, need, has, left, miss}, shortcut(id) → atajo de Hoy | null, images() → Promise<[url]>,
     state() → lo que se ve, KEY}.
   Usa de index.html: lang, LANGS, store, bus, ROUTES, TABS, esc, ico, getDoc, srsAll, dayKey, award, heroHtml, say,
   playClip, clipFor, stopClip, useVoice, retryLocal, voices, langVoices, langEs, rate, SLOW, ipaHtml, speakable, navTo,
   secOf, checkAch; window.M, window.G, window.vocabUI, window.vocabGames. Iconos: Phosphor. */
(() => {
"use strict";
const W = window, DOC = document;
const KEY = "cuentos", SES = "vocab:cuento", IDX = "data/stories/index.json", IMG = "img/games/cuentos.png";
const COINS = 10, DAY_PAY = 3, PCT = .9;
const $ = s => DOC.querySelector(s);
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const wait = ms => new Promise(r => setTimeout(r, ms));
const rm = () => { try{ return !!(W.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const code = (L = lang) => (LANGS[L] || LANGS.english).code;
const haptic = t => { try{ if(W.G && typeof G.haptic === "function") G.haptic(t || "selection"); }catch(e){} };
const hashNow = () => location.hash.replace(/^#\/?/, "").split("?")[0];
const TOKRE = /[\p{L}\p{N}\p{M}]+(?:['’-][\p{L}\p{N}\p{M}]+)*/gu;
const TINTS = ["green", "yellow", "blue", "teal"];
/* el final: en el idioma del cuento, con su IPA y su traducción (se toca como las palabras del cuento) */
const END = {english: {t: "The End", es: "Fin", ipa: "/ðiː ˈend/"}, "français": {t: "Fin", es: "Fin", ipa: "/fɛ̃/"}, dansk: {t: "Slut", es: "Fin", ipa: "/ˈslud/"}};

/* ---------- datos ---------- */
let IX = null, ixP = null;
const FILES = {};
function ready(){
  if(IX) return Promise.resolve(IX);
  if(!ixP) ixP = fetch(IDX).then(r => { if(!r.ok) throw new Error(IDX + " " + r.status); return r.json(); })
    .then(d => { if(!isObj(d)) throw new Error(IDX + " no es válido"); IX = d; return d; })
    .catch(e => { ixP = null; throw e; });
  return ixP;
}
const okEntry = e => isObj(e) && typeof e.id === "string" && /^[a-z]{2}-[a-z0-9-]{1,40}$/.test(e.id) && typeof e.file === "string"
  && /^data\/stories\/[a-z]{2}\/[a-z0-9-]+\.json$/.test(e.file) && Array.isArray(e.words) && Number.isFinite(+e.n);
const list = (L = lang) => (IX && Array.isArray(IX[L]) ? IX[L] : []).filter(okEntry).slice().sort((a, b) => a.n - b.n);
function entryOf(id){
  if(!IX) return null;
  for(const L of Object.keys(LANGS)) for(const e of list(L)) if(e.id === id) return Object.assign({L}, e);
  return null;
}
const okPage = p => isObj(p) && typeof p.img === "string" && typeof p.t === "string" && typeof p.es === "string"
  && (p.also === undefined || Array.isArray(p.also)) && (p.gl === undefined || isObj(p.gl));
function valid(s){
  return isObj(s) && typeof s.id === "string" && typeof s.title === "string" && isObj(s.gloss) && Array.isArray(s.pages) && s.pages.length > 0
    && s.pages.every(okPage) && isObj(s.choice) && okPage(s.choice) && Array.isArray(s.choice.opts) && s.choice.opts.length === 2
    && s.choice.opts.every(o => isObj(o) && typeof o.key === "string" && typeof o.t === "string" && typeof o.img === "string" && Array.isArray(o.pages) && o.pages.length > 0 && o.pages.every(okPage));
}
async function story(id){
  if(FILES[id]) return FILES[id];
  await ready();
  const e = entryOf(id); if(!e) return null;
  const r = await fetch(e.file); if(!r.ok) throw new Error(e.file + " " + r.status);
  const s = await r.json();
  if(!valid(s) || s.id !== id) throw new Error(e.file + " no es un cuento válido");
  s.L = e.L; s.entry = e; FILES[id] = s;
  return s;
}
/* los dibujos de un cuento (portada, páginas, opciones y los de las glosas) */
function storyImgs(s){
  const set = new Set([s.cover]);
  const add = p => { if(p && p.img) set.add(p.img); ((p && p.also) || []).forEach(u => set.add(u)); };
  s.pages.forEach(add); add(s.choice);
  s.choice.opts.forEach(o => { set.add(o.img); o.pages.forEach(add); });
  for(const g of Object.values(s.gloss)) if(g && g.img) set.add(g.img);
  return [...set].filter(u => typeof u === "string" && /^img\/[\w./-]+\.(png|jpe?g|svg|webp)$/.test(u));
}
/* al abrir un cuento se piden ya todos sus dibujos (y los del zorro con su ropa, que sale en «The End»): el sw los guarda
   y el cuento se puede leer entero sin conexión */
function heroImgs(){ try{ return [...heroHtml(120).matchAll(/\ssrc="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, "&")); }catch(e){ return []; } }
function preload(s){ [...storyImgs(s), ...heroImgs()].forEach(u => { const i = new Image(); i.decoding = "async"; i.src = u; }); }
async function images(){
  await ready();
  const out = new Set([IMG]);
  for(const L of Object.keys(LANGS)) for(const e of list(L)){
    out.add(e.cover);
    try{ storyImgs(await story(e.id)).forEach(u => out.add(u)); }catch(err){ console.warn("[cuentos]", err.message); }
  }
  return [...out];
}

/* ---------- lo guardado ---------- */
function saved(){
  const o = store.get(KEY, null), out = {v: 1, done: {}, pay: {d: "", n: 0}};
  if(!isObj(o)) return out;
  if(isObj(o.done)) for(const [id, x] of Object.entries(o.done)){
    if(!/^[a-z]{2}-[a-z0-9-]{1,40}$/.test(id) || !isObj(x)) continue;
    out.done[id] = {d: typeof x.d === "string" ? x.d : "", e: Array.isArray(x.e) ? [...new Set(x.e.filter(k => typeof k === "string" && k.length < 40))].slice(0, 4) : [],
      n: Math.max(1, Math.min(99999, Math.floor(+x.n) || 1)), p: x.p ? 1 : 0};
  }
  if(isObj(o.pay) && typeof o.pay.d === "string") out.pay = {d: o.pay.d, n: Math.max(0, Math.min(99, Math.floor(+o.pay.n) || 0))};
  return out;
}
const doneCount = () => Object.keys(saved().done).length;
/* termina el cuento id con el final key: {first, paid, capped, ends} (paga solo una vez por cuento y 3 cuentos al día) */
function finish(id, key){
  const o = saved(), d = dayKey(new Date()), first = !o.done[id];
  const x = o.done[id] || {d, e: [], n: 0, p: 0};
  x.d = d; x.n = (x.n || 0) + 1;
  if(key && !x.e.includes(key)) x.e.push(key);
  let paid = false, capped = false;
  if(!x.p){
    const used = o.pay.d === d ? o.pay.n : 0;
    if(used < DAY_PAY){ x.p = 1; o.pay = {d, n: used + 1}; paid = true; } else capped = true;
  }
  o.done[id] = x;
  store.set(KEY, o);
  return {first, paid, capped, ends: x.e.slice(), n: x.n};
}
function sesGet(){ try{ const o = JSON.parse(sessionStorage.getItem(SES)); return isObj(o) ? o : null; }catch(e){ return null; } }
function sesSet(o){ try{ if(o) sessionStorage.setItem(SES, JSON.stringify(o)); else sessionStorage.removeItem(SES); }catch(e){} }
function uiTales(){ let o = null; try{ o = W.vocabUI ? vocabUI.get().tales : null; }catch(e){ o = null; } return isObj(o) && Array.isArray(o.u) ? o : null; }
function uiSetTales(o){ try{ if(W.vocabUI && typeof vocabUI.set === "function") vocabUI.set("tales", o); }catch(e){} }

/* ---------- abierto o cerrado ---------- */
function known(){ try{ return new Set(Object.keys(srsAll() || {})); }catch(e){ return new Set(); } }
function lockOf(e, K = known()){
  const ws = (e && Array.isArray(e.words) ? e.words : []).filter(w => isObj(w) && typeof w.id === "string");
  const need = Math.ceil(PCT * ws.length - 1e-9), has = ws.filter(w => K.has(w.id)).length;
  const free = +e.n === 1, open = free || has >= need;
  return {free, open, need, has, left: open ? 0 : need - has, miss: ws.filter(w => !K.has(w.id))};
}

/* ---------- estilos ---------- */
const DARK = (s, b) => `:root[data-theme=dark] :is(${s}){${b}}\n@media (prefers-color-scheme:dark){:root:not([data-theme=light]) :is(${s}){${b}}}`;
const STYLE = `
.st-shelf,.st{--st-tint:rgba(52,199,89,.16)}
[data-tint=yellow]{--st-tint:rgba(255,204,0,.24)}
[data-tint=blue]{--st-tint:rgba(30,110,244,.13)}
[data-tint=teal]{--st-tint:rgba(0,129,152,.15)}
[data-tint=green]{--st-tint:rgba(52,199,89,.16)}
/* la estantería */
.st-shelf{display:grid;gap:16px;max-width:960px;margin:0 auto}
.st-hd{display:grid;gap:4px;padding:0 4px}
.st-h1{margin:0;font:800 var(--fs-t1)/1.15 var(--f-round);color:var(--label)}
.st-sub{margin:0;color:var(--label2);font:400 var(--fs-sub)/1.35 var(--f-text)}
.st-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0;padding:0;list-style:none}
@media (min-width:744px){.st-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}}
.st-grid>li{display:flex;min-width:0}
.st-cv{position:relative;flex:1;display:flex;flex-direction:column;align-items:stretch;gap:2px;min-width:0;margin:0;padding:10px 10px 14px;border:0;
  border-radius:var(--r-card);background:var(--card);color:var(--label);text-align:left;text-decoration:none;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.st-cv:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.st-cv-art{position:relative;display:grid;place-items:center;aspect-ratio:1/1;margin-bottom:6px;border-radius:18px;background:var(--st-tint);overflow:hidden}
.st-cv-art img{display:block;width:86%;height:86%;object-fit:contain;pointer-events:none;-webkit-user-drag:none;user-select:none}
.st-cv-t{font:800 var(--fs-sub)/1.2 var(--f-round);overflow-wrap:anywhere}
.st-cv-es{color:var(--label2);font:400 var(--fs-note)/1.25 var(--f-text)}
.st-chip{align-self:flex-start;display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:3px 10px;border-radius:var(--r-pill);font:800 var(--fs-min)/1.3 var(--f-round)}
.st-chip.new{background:var(--gold);color:var(--gold-on)}
.st-chip.ok{background:var(--ok-soft);color:var(--ok-ink)}
.st-cv.is-lock .st-cv-art{background:var(--fill2)}
.st-cv.is-lock .st-cv-art img{filter:grayscale(1);opacity:.42}
.st-lock{position:absolute;display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:var(--card);color:var(--label);box-shadow:0 2px 10px rgb(0 0 0/.14)}
.st-need{margin-top:8px;color:var(--label);font:700 var(--fs-note)/1.3 var(--f-text)}
.st-pb{display:block;height:8px;margin-top:8px;border-radius:999px;background:var(--fill);overflow:hidden}
.st-pb i{display:block;height:100%;border-radius:inherit;background:var(--teal)}
.st-err{padding:20px;text-align:center}
.st-err p{margin:0 0 16px;font:600 var(--fs-body)/1.35 var(--f-text)}
/* la hoja de un cuento cerrado */
dialog.st-sh .st-ls-p{margin:0 0 12px;font:400 var(--fs-body)/1.4 var(--f-text);color:var(--label)}
.st-ls-l{display:grid;gap:8px;margin:0 0 16px;padding:0;list-style:none}
.st-ls-l li{display:flex;align-items:center;gap:12px;min-height:64px;padding:8px 8px 8px 8px;border-radius:var(--r-md);background:var(--card)}
.st-ls-pic{flex:none;display:grid;place-items:center;width:56px;height:56px;border-radius:var(--r-sm);background:var(--fill2)}
.st-ls-pic img{width:48px;height:48px;object-fit:contain}
.st-ls-w{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font:800 var(--fs-sub)/1.2 var(--f-round);color:var(--label)}
.st-ls-w small{font:400 var(--fs-note)/1.25 var(--f-text);color:var(--label2)}
.st-ls-say{flex:none;display:grid;place-items:center;width:var(--tap);height:var(--tap);border:0;border-radius:50%;background:var(--brand-soft);color:var(--brand-tint);cursor:pointer}
.st-ls-say.playing{background:var(--brand-fill);color:#fff}
/* el cuento: un libro */
.st{position:relative;width:min(100%,960px);margin:0 auto;padding-bottom:calc(var(--btn-main) + 40px)}
:root[data-focus=cuento] main{overflow-x:hidden;overflow-x:clip}
:root[data-focus=cuento] .focusbar{left:max(16px,var(--safe-l),calc(50% - 480px));right:max(16px,var(--safe-r),calc(50% - 480px))}
.st-top{display:flex;align-items:center;min-height:var(--tap);margin:4px 0 12px}
:root[data-focus] .st-top{margin-top:calc(-1 * (var(--tap) + 12px));padding:0 92px 0 56px}
.st-bar{flex:1;height:12px;border-radius:999px;background:var(--fill);overflow:hidden}
.st-bar>i{display:block;width:0;height:100%;border-radius:inherit;background:var(--teal);transition:width var(--d-base,260ms)}
.st-stage{position:relative;touch-action:pan-y}
.st-page{display:flex;flex-direction:column;gap:14px;margin:0;padding:12px 12px 16px;border-radius:var(--r-card);background:var(--card);color:var(--label)}
.st-art{position:relative;display:flex;align-items:flex-end;justify-content:center;gap:3%;box-sizing:border-box;height:clamp(220px,42vh,460px);margin:0;
  padding:14px 12px 8px;border-radius:18px;background:var(--st-tint);overflow:hidden}
.st-art img{display:block;pointer-events:none;-webkit-user-drag:none;user-select:none}
/* los dibujos grandes reparten el ancho (cajas fijas: nada salta al cargar); las pegatinas, en una columna a la derecha
   (abajo con un dibujo grande, que deja su sitio; arriba, sobre las cabezas, con dos) */
.st-big{flex:1 1 0;min-width:0;width:100%;height:100%;object-fit:contain;object-position:50% 100%}
.st-art.has-stk[data-n="1"]{padding-right:calc(28% + 16px)}
.st-stks{position:absolute;right:10px;bottom:10px;display:flex;flex-direction:column;gap:8px;width:28%;max-width:150px}
.st-art:not([data-n="1"]) .st-stks{top:10px;bottom:auto}
.st-stks img{display:block;width:100%;height:auto;aspect-ratio:1/1;object-fit:contain}
.st-body{display:flex;flex-direction:column;gap:12px;padding:0 4px}
.st-kick{margin:0;color:var(--label2);font:700 var(--fs-note)/1.3 var(--f-text)}
.st-txt{margin:0;font:800 min(calc(1.75rem*var(--k)),40px)/1.42 var(--f-round);color:var(--label);overflow-wrap:normal;word-break:normal;hyphens:manual;text-wrap:pretty}
.st-title{font-size:min(calc(2rem*var(--k)),46px);line-height:1.25;text-wrap:balance}
.st-u{display:inline-block;margin:0 -3px;padding:0 3px;border:0;border-radius:10px;background:transparent;color:inherit;font:inherit;line-height:inherit;letter-spacing:inherit;
  text-align:inherit;vertical-align:baseline;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms)}
.st-u.is-say{background:var(--gold-soft);box-shadow:0 0 0 2px var(--gold-soft)}
.st-u.is-tap{background:var(--brand-fill);color:#fff;box-shadow:none}
.st-u:focus-visible{outline:3px solid var(--brand-tint);outline-offset:1px}
.st-es{margin:0;color:var(--label2);font:400 var(--fs-body)/1.4 var(--f-text)}
.st-acts{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px}
.st-spk,.st-slow{flex:none;display:grid;place-items:center;width:48px;height:48px;margin:0;padding:0;border:0;border-radius:50%;cursor:pointer;-webkit-tap-highlight-color:transparent;
  transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms)}
.st-spk{background:var(--brand-soft);color:var(--brand-tint)}
.st-slow{background:var(--fill2);color:var(--label)}
.st-spk.playing,.st-slow.playing{background:var(--brand-fill);color:#fff}
.st-spk:focus-visible,.st-slow:focus-visible,.st-esb:focus-visible,.st-opt:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.st-esb{min-height:var(--tap);margin:0 0 0 auto;padding:0 16px;border:0;border-radius:var(--r-pill);background:var(--fill2);color:var(--label);font:700 var(--fs-note)/1 var(--f-text);cursor:pointer}
.st-esb[aria-pressed=true]{background:var(--brand-soft);color:var(--brand-ink)}
.st-note{margin:0;padding:8px 12px;border-radius:var(--r-sm);background:var(--fill2);color:var(--label2);font:400 var(--fs-note)/1.35 var(--f-text)}
.st-note:empty{display:none}
/* elegir el final */
.st-choice{display:flex;flex-direction:column;gap:12px}
.st-choice>.st-page{padding:16px}
.st-opts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.st-opt{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;margin:0;padding:8px 8px 12px;border:0;border-radius:var(--r-card);
  background:var(--card);color:var(--label);font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:box-shadow var(--d-fast,160ms)}
.st-opt-pic{display:grid;place-items:center;width:100%;aspect-ratio:1/1;border-radius:18px;background:var(--st-tint)}
.st-opt-pic img{width:92%;height:92%;object-fit:contain;pointer-events:none}
.st-opt-t{margin-top:6px;font:800 var(--fs-t3)/1.2 var(--f-round);text-align:center;overflow-wrap:anywhere}
.st-opt-es{color:var(--label2);font:400 var(--fs-note)/1.25 var(--f-text)}
.st-opt-ok{position:absolute;top:8px;right:8px;display:none;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--brand-fill);color:#fff}
.st-opt[aria-pressed=true]{box-shadow:0 0 0 4px var(--brand-tint)}
.st-opt[aria-pressed=true] .st-opt-ok{display:grid}
.st-opt.is-nudge{box-shadow:0 0 0 4px var(--gold)}
/* el final */
.st-end{align-items:center;text-align:center;padding:24px 16px}
.st-fox{height:136px;display:grid;place-items:end center}
.st-fox .hero{animation:st-hop .62s cubic-bezier(.3,.7,.4,1) .15s 2 both}
@keyframes st-hop{0%,100%{translate:0 0;rotate:0deg}40%{translate:0 -18px;rotate:-4deg}70%{translate:0 0;rotate:3deg}}
.st-end-t{margin:0;font:800 var(--fs-lt)/1.15 var(--f-round)}
.st-end .ipa{font-size:var(--fs-sub)}
.st-end-m{margin:0;font:700 var(--fs-body)/1.4 var(--f-text);text-wrap:balance}
.st-ends{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:12px 16px;margin:0;padding:0;list-style:none}
.st-endc{position:relative;display:grid;place-items:center;width:96px;height:96px;border-radius:20px;background:var(--fill2)}
.st-endc img{width:80px;height:80px;object-fit:contain;filter:grayscale(1);opacity:.4}
.st-endc.ok{background:var(--st-tint)}
.st-endc.ok img{filter:none;opacity:1}
.st-endc .ck{position:absolute;top:-6px;right:-6px;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--ok-fill);color:#fff}
.st-ends-t{flex-basis:100%;margin:0;color:var(--label2);font:600 var(--fs-note)/1.35 var(--f-text)}
/* abajo: ‹ y «Siguiente», siempre a la vista */
.st-dock{position:fixed;z-index:5;left:max(16px,var(--safe-l),calc(50% - 280px));right:max(16px,var(--safe-r),calc(50% - 280px));
  bottom:calc(var(--safe-b) + 16px);display:flex;align-items:center;gap:12px;pointer-events:none}
.st-dock>*{pointer-events:auto}
.st-dock::before{content:"";position:absolute;z-index:-1;left:-16px;right:-16px;top:-20px;bottom:calc(-1 * (var(--safe-b) + 16px));
  background:linear-gradient(to bottom,transparent,var(--bg) 45%);pointer-events:none}
.st-prev{flex:none;width:var(--btn-main);min-height:var(--btn-main);padding:0;border-radius:50%}
.st-prev.is-off{visibility:hidden}
.st-next,.st-more{flex:1}
.st-again{flex:1}
.st-pick{flex:1;margin:0;text-align:center;color:var(--label2);font:700 var(--fs-sub)/1.3 var(--f-text)}
.st-pick[hidden]{display:none}
/* el globo de una palabra (contenido: sólido) */
.st-bub{position:fixed;z-index:15;left:0;top:0;display:flex;align-items:center;gap:12px;box-sizing:border-box;width:min(360px,calc(100vw - 32px));
  padding:12px 48px 12px 12px;border-radius:20px;background:var(--card);color:var(--label);box-shadow:0 12px 32px rgb(0 0 0/.18),0 0 0 .5px var(--sep)}
.st-bub-pic{flex:none;display:grid;place-items:center;width:88px;height:88px;border-radius:16px;background:var(--st-tint)}
.st-bub-pic img{width:80px;height:80px;object-fit:contain}
.st-bub-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.st-bub-t b{font:800 var(--fs-t3)/1.2 var(--f-round);overflow-wrap:anywhere}
.st-bub-t .ipa{font-size:var(--fs-sub)}
.st-bub-es{color:var(--label2);font:600 var(--fs-sub)/1.3 var(--f-text)}
.st-bub .st-slow{width:44px;height:44px}
.st-bub-x{position:absolute;top:2px;right:2px;display:grid;place-items:center;width:44px;height:44px;margin:0;padding:0;border:0;border-radius:22px;background:none;color:var(--label2);cursor:pointer}
.st-bub-a{position:absolute;left:var(--ax,50%);width:16px;height:16px;margin-left:-8px;background:inherit;rotate:45deg}
.st-bub[data-side=top] .st-bub-a{bottom:-7px;box-shadow:3px 3px 4px rgb(0 0 0/.06)}
.st-bub[data-side=bottom] .st-bub-a{top:-7px}
/* en tableta y ordenador, el libro abierto: el dibujo a la izquierda y el texto a la derecha */
@media (min-width:820px){
  .st-page:not(.st-end):not(.st-q){display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:center;gap:24px;padding:16px}
  .st-page .st-art{height:clamp(300px,56vh,520px)}
  .st-txt{font-size:min(calc(2.25rem*var(--k)),52px)}
  .st-title{font-size:min(calc(2.5rem*var(--k)),58px)}
  .st-opts{gap:16px}
  .st-opt-pic{max-height:42vh}
}
${DARK(".st-art,.st-cv-art,.st-opt-pic,.st-bub-pic,.st-endc.ok", "background:#E8E8ED")}
${DARK(".st-cv.is-lock .st-cv-art", "background:var(--fill2)")}
`;
function css(){
  if(DOC.getElementById("css-stories")) return;
  const s = DOC.createElement("style"); s.id = "css-stories"; s.textContent = STYLE; DOC.head.appendChild(s);
}

/* ---------- el texto: palabras y unidades ---------- */
/* text → {text, toks: [{t, s, e, u}], units: [{i, s, e, text, g}], sents: [{s, e}]} con la glosa del cuento (y la de la página) */
function model(text, gloss, pgl){
  const gl = Object.assign({}, gloss || {}, pgl || {}), toks = [];
  let m; TOKRE.lastIndex = 0;
  while((m = TOKRE.exec(text))) toks.push({t: m[0], s: m.index, e: m.index + m[0].length, u: -1});
  const units = [];
  for(let i = 0; i < toks.length;){
    let n = 1, g = null;
    for(const k of [3, 2, 1]){
      if(i + k > toks.length) continue;
      const key = toks.slice(i, i + k).map(x => x.t.toLowerCase().replace(/’/g, "'")).join(" ");
      if(Object.prototype.hasOwnProperty.call(gl, key) && isObj(gl[key])){ n = k; g = gl[key]; break; }
    }
    const a = toks[i], b = toks[i + n - 1], ui = units.length;
    units.push({i: ui, s: a.s, e: b.e, text: text.slice(a.s, b.e), g, t0: i, t1: i + n - 1});
    for(let j = i; j < i + n; j++) toks[j].u = ui;
    i += n;
  }
  const sents = [], re = /[^.!?…]+(?:[.!?…]+|$)/g;
  while((m = re.exec(text))){ if(!m[0].length){ re.lastIndex++; continue; } if(/[\p{L}\p{N}]/u.test(m[0])) sents.push({s: m.index, e: m.index + m[0].length}); }
  return {text, toks, units, sents};
}
function unitsHtml(M){
  let out = "", at = 0;
  for(const u of M.units){
    out += esc(M.text.slice(at, u.s)) + `<button type="button" class="st-u" data-u="${u.i}">${esc(u.text)}</button>`;
    at = u.e;
  }
  return out + esc(M.text.slice(at));
}
/* la clave del audio grabado: tal cual («Monday») o en minúsculas («Fox» al empezar la frase → «fox») */
const clipKey = t => { const a = String(t || "").replace(/’/g, "'"); try{ if(clipFor(a)) return a; }catch(e){} return a.toLocaleLowerCase(); };
const hasClip = t => { try{ return !!clipFor(clipKey(t)); }catch(e){ return false; } };
function hasVoice(L){
  if(!("speechSynthesis" in W)) return false;
  try{ return !voices.length || langVoices(L).length > 0; }catch(e){ return true; }
}

/* ---------- la voz y la palabra que se ilumina ---------- */
let SAY = 0, HLT = 0, LIT = -1;
const KMS = {};   /* ms por unidad de peso a velocidad 1, por idioma (se corrige con lo que dura cada frase) */
const kms = L => KMS[L] || 66;
function lit(i){
  if(LIT === i) return;
  LIT = i;
  DOC.querySelectorAll("#st .st-u.is-say").forEach(b => b.classList.remove("is-say"));
  if(i < 0) return;
  const b = DOC.querySelector(`#st-txt .st-u[data-u="${i}"]`); if(b) b.classList.add("is-say");
}
function hlStop(){ clearInterval(HLT); HLT = 0; }
/* el plan de una frase: cada palabra con su sitio dentro de lo que se dice y su peso (largo + pausas) */
function plan(M, S, base){
  const ts = M.toks.filter(t => t.s >= S.s && t.s < S.e);
  let acc = 1;
  const out = ts.map((t, k) => {
    const after = M.text.slice(t.e, k + 1 < ts.length ? ts[k + 1].s : S.e);
    const w = Math.max(2, t.t.length) + 1 + (/[,;:]/.test(after) ? 3 : 0) + (/[.!?…]/.test(after) ? 5 : 0);
    const o = {s: t.s - base, e: t.e - base, u: t.u, a: acc, w}; acc += w; return o;
  });
  return {toks: out, total: acc};
}
function hlRun(P, L, r, t0, isB){
  hlStop();
  const step = () => {
    if(isB()) return;
    const w = (performance.now() - t0) / (kms(L) / Math.max(.1, r));
    const t = P.toks.find(x => w < x.a + x.w) || P.toks[P.toks.length - 1];
    if(t) lit(t.u);
  };
  step(); HLT = setInterval(step, 45);
}
function hlAt(P, ci){
  const t = P.toks.find(x => ci >= x.s && ci < x.e) || P.toks.find(x => x.s >= ci) || P.toks[P.toks.length - 1];
  if(t) lit(t.u);
}
function calib(P, L, ms, r){
  if(!(ms > 400) || !P.total) return;
  const k = ms * r / P.total;
  KMS[L] = Math.min(160, Math.max(30, .6 * kms(L) + .4 * k));
}
function stopSay(){
  SAY++; hlStop(); lit(-1);
  try{ if("speechSynthesis" in W) speechSynthesis.cancel(); else stopClip(); }catch(e){}
  DOC.querySelectorAll("#st .playing").forEach(b => b.classList.remove("playing"));
}
/* dice la frase si del modelo M; resuelve al acabar (o al cortarla) */
function speakSent(M, si, slow, tok, L){
  return new Promise(res => {
    const S = M.sents[si];
    let done = false, guard = 0;
    const fin = () => { if(done) return; done = true; clearTimeout(guard); hlStop(); res(); };
    if(tok !== SAY || !S) return fin();
    const us = M.units.filter(u => u.s >= S.s && u.s < S.e);
    const tts = () => {
      if(done) return;
      if(tok !== SAY || !hasVoice(L)) return fin();
      const raw = M.text.slice(S.s, S.e), lead = raw.length - raw.trimStart().length, txt = raw.trim();
      const u = new SpeechSynthesisUtterance(txt);
      u.rate = slow ? SLOW() : rate;
      useVoice(u, L);
      const P = plan(M, S, S.s + lead);
      let started = false, bmode = false, t0 = 0;
      const start = () => { if(started || done || tok !== SAY) return; started = true; t0 = performance.now(); hlRun(P, L, u.rate, t0, () => bmode); };
      u.onstart = start;
      u.onboundary = ev => {
        if(done || tok !== SAY || (ev && ev.name && ev.name !== "word")) return;
        const ci = +(ev && ev.charIndex); if(!Number.isFinite(ci)) return;
        bmode = true; if(!started) start(); hlStop(); hlAt(P, ci);
      };
      u.onend = () => { if(started && !bmode && tok === SAY) calib(P, L, performance.now() - t0, u.rate); fin(); };
      u.onerror = ev => { if(!retryLocal(u, ev, fin)) fin(); };
      guard = setTimeout(fin, 2500 + txt.length * 150 / u.rate);
      try{ speechSynthesis.speak(u); }catch(e){ return fin(); }
      setTimeout(start, 350);   /* sin onstart (o con la voz de reserva de retryLocal): se ilumina por tiempo */
    };
    /* una frase de una sola palabra con audio grabado: su mp3 */
    if(us.length === 1 && hasClip(us[0].text)){
      lit(us[0].i);
      if(playClip(clipKey(us[0].text), slow, ok => ok ? fin() : tts())){ guard = setTimeout(fin, 8000); return; }
    }
    tts();
  });
}
/* lee todas las frases de M; btn (opcional) se rellena mientras suena */
async function narrate(M, slow, btn, L){
  stopSay();
  const tok = SAY;
  if(!M || !M.sents.length) return false;
  if(!hasVoice(L)) noVoice(L);
  if(btn) btn.classList.add("playing");
  for(let i = 0; i < M.sents.length; i++){
    if(tok !== SAY) break;
    await speakSent(M, i, slow, tok, L);
    if(tok !== SAY) break;
    if(i < M.sents.length - 1) await wait(slow ? 420 : 280);
  }
  if(tok === SAY){ lit(-1); if(btn) btn.classList.remove("playing"); }
  return tok === SAY;
}
/* una palabra suelta, despacio: su mp3 si lo tiene; si no, la voz a SLOW() */
function sayWord(text, btn, L){
  stopSay();
  const tok = SAY;
  if(btn) btn.classList.add(btn.classList.contains("st-u") ? "is-tap" : "playing");
  let done = false;
  const off = () => { if(done) return; done = true; if(btn) btn.classList.remove("is-tap", "playing"); };
  const tts = () => {
    if(tok !== SAY || !hasVoice(L)){ if(!hasVoice(L)) noVoice(L); return off(); }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = SLOW(); useVoice(u, L);
    u.onend = off; u.onerror = e => { if(!retryLocal(u, e, off)) off(); };
    setTimeout(off, 3000 + text.length * 220);
    try{ speechSynthesis.speak(u); }catch(e){ off(); }
  };
  if(!playClip(clipKey(text), true, ok => ok ? off() : tts())) tts();
}
function noVoice(L){
  const n = $("#st-note"); if(!n || n.textContent) return;
  n.textContent = `Para oír el cuento hace falta la voz del ${LANGS[L] ? LANGS[L].name : "idioma"}: un mayor puede añadirla en Ajustes › Voz y velocidad › ${langEs(L)}. Las palabras con audio sí suenan.`;
}

/* ---------- #/cuentos: la estantería ---------- */
let NAV = 0, PEND = null;
function errBox(t, retry){
  $("#app").innerHTML = `<div class="st-shelf"><div class="card st-err"><p>${esc(t)}</p>
    <button type="button" class="glass-btn glass-btn--pri" id="st-retry">${ico("arrow-counter-clockwise", "bold", 20)}Probar otra vez</button></div></div>`;
  const b = $("#st-retry"); if(b) b.addEventListener("click", () => navTo(retry));
}
function coverHtml(e, st, sv){
  const d = sv.done[e.id], tint = TINTS.includes(e.tint) ? e.tint : "green";
  const art = `<span class="st-cv-art"><img src="${esc(e.cover)}" alt="" width="220" height="200" draggable="false" decoding="async">${st.open ? "" : `<span class="st-lock" aria-hidden="true">${ico("lock", "bold", 26)}</span>`}</span>`;
  const titles = `<span class="st-cv-t" lang="${esc(code())}">${esc(e.title)}</span><span class="st-cv-es">${esc(e.es)}</span>`;
  if(!st.open){
    const t = `Aprende ${st.left} ${st.left === 1 ? "palabra" : "palabras"} más de este cuento`;
    return `<li><button type="button" class="card st-cv is-lock" data-id="${esc(e.id)}" data-tint="${tint}"><span class="vh">Cuento cerrado. </span>${art}${titles}
      <span class="st-need">${esc(t)}</span><span class="st-pb" aria-hidden="true"><i style="width:${Math.round(100 * Math.min(1, st.has / Math.max(1, st.need)))}%"></i></span></button></li>`;
  }
  const chip = d ? `<span class="st-chip ok">${ico("check", "bold", 14)}${d.e.length >= 2 ? "Leído · 2 finales" : "Leído · 1 de 2 finales"}</span>` : `<span class="st-chip new">¡Nuevo!</span>`;
  return `<li><a class="card st-cv" href="#/cuento/${encodeURIComponent(e.id)}" data-id="${esc(e.id)}" data-tint="${tint}">${art}${titles}${chip}</a></li>`;
}
/* desbloquea la voz en el toque (iOS solo deja hablar dentro de un toque; el cuento empieza a leerse después) */
function unlockVoice(){ try{ if(!("speechSynthesis" in W)) return; const u = new SpeechSynthesisUtterance(" "); useVoice(u, lang); speechSynthesis.speak(u); }catch(e){} }
async function shelf(){
  css(); const my = ++NAV, L = lang;
  stopSay(); closeBub(); R = null;
  try{ await ready(); }catch(e){ console.error(e); if(my === NAV) errBox("No se pudieron cargar los cuentos.", "#/cuentos"); return; }
  if(my !== NAV) return;
  const K = known(), sv = saved(), items = list(L), sts = items.map(e => lockOf(e, K));
  $("#app").innerHTML = `<div class="st-shelf" id="st-shelf">
    <header class="st-hd"><h1 class="st-h1">Cuentos del zorro</h1><p class="st-sub">Lee, escucha y elige el final.</p></header>
    <ul class="st-grid" id="st-grid">${items.map((e, i) => coverHtml(e, sts[i], sv)).join("")}</ul></div>`;
  const grid = $("#st-grid");
  grid.addEventListener("click", ev => {
    const a = ev.target.closest && ev.target.closest(".st-cv"); if(!a) return;
    if(a.classList.contains("is-lock")){ const e = items.find(x => x.id === a.dataset.id); if(e) lockSheet(Object.assign({L}, e), a); return; }
    unlockVoice();
  });
  /* los que se abrieron desde la última visita dan un saltito */
  const prev = uiTales(), openIds = items.filter((e, i) => sts[i].open).map(e => e.id);
  if(prev){
    const fresh = openIds.filter(id => !prev.u.includes(id));
    fresh.forEach((id, k) => { const el = grid.querySelector(`.st-cv[data-id="${CSS.escape(id)}"]`); if(el && W.M && typeof M.bump === "function") setTimeout(() => M.bump(el), 300 + k * 160); });
    if(fresh.length) haptic("success");
  }
  const allU = [...new Set([...(prev ? prev.u : []).filter(id => !openIds.length || !id.startsWith(L === "english" ? "en-" : L === "dansk" ? "da-" : "fr-")), ...openIds])].slice(-60);
  if(!prev || allU.join() !== prev.u.join()) uiSetTales({u: allU});
  /* un cuento cerrado al que se llegó por su enlace: su hoja */
  if(PEND){ const e = items.find(x => x.id === PEND), el = e && grid.querySelector(`.st-cv[data-id="${CSS.escape(e.id)}"]`); PEND = null; if(e) lockSheet(Object.assign({L}, e), el); }
}
/* la hoja de un cuento cerrado: las palabras que faltan, con dibujo, IPA y altavoz, e «Ir al camino» */
function sheetEl(){
  let d = DOC.getElementById("st-lock-s");
  if(!d){
    d = DOC.createElement("dialog"); d.id = "st-lock-s"; d.className = "st-sh"; d.setAttribute("aria-labelledby", "st-ls-t");
    d.dataset.noRenew = ""; d.dataset.noHint = ""; DOC.body.appendChild(d);
    d.addEventListener("click", e => { if(e.target.closest && e.target.closest("[data-close]")) closeSheet(d); });
  }
  return d;
}
function openSheet(d, from){
  try{ if(W.M && typeof M.openSheet === "function") M.openSheet(d, {from: from && from.nodeType === 1 ? from : null}); else d.showModal(); }
  catch(e){ try{ d.showModal(); }catch(e2){ d.setAttribute("open", ""); } }
}
function closeSheet(d, now){
  if(!d || !d.open) return;
  if(!now && W.M && typeof M.closeSheet === "function" && d.classList.contains("m-sheet")) M.closeSheet(d); else d.close();
}
async function lockSheet(e, from){
  const st = lockOf(e), d = sheetEl(), my = ++SHEETN;
  const n = st.left === 1 ? "Te falta 1 palabra" : `Te faltan ${st.left} palabras`;
  d.innerHTML = `<div class="m-head"><h2 id="st-ls-t">¡Casi lo abres!</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Listo</button></div>
    <p class="st-ls-p">${esc(n)} para abrir «${esc(e.es)}». Apréndelas en el camino:</p>
    <ul class="st-ls-l" id="st-ls-l" aria-busy="true"></ul>
    <a class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" href="#/mapa" data-close>${ico("map-trifold", "bold", 20)}Ir al camino</a>`;
  openSheet(d, from);
  const rows = await Promise.all(st.miss.map(async w => {
    const i = w.id.indexOf("|"), doc = w.id.slice(0, i), es = w.id.slice(i + 1);
    let r = null; try{ const D = await getDoc(doc); r = (D && Array.isArray(D.rows) ? D.rows : []).find(x => x && x.es === es) || null; }catch(err){ r = null; }
    const l = r && r.l ? r.l[e.L] : null;
    return {w: speakable(l && l.word ? l.word : w.w), ipa: l ? l.ipa : "", img: (r && r.img) || w.img || "", es};
  }));
  if(my !== SHEETN || !d.open) return;
  const ul = d.querySelector("#st-ls-l"); if(!ul) return;
  const c = code(e.L);
  ul.innerHTML = rows.map(x => `<li><span class="st-ls-pic">${x.img ? `<img src="${esc(x.img)}" alt="" width="48" height="48" draggable="false">` : ico("book-open-text", "bold", 26)}</span>
    <span class="st-ls-w"><span lang="${esc(c)}">${esc(x.w)}</span>${ipaHtml(x.ipa, c)}<small>${esc(x.es.toLocaleLowerCase("es"))}</small></span>
    <button type="button" class="st-ls-say" data-say="${esc(x.w)}" aria-label="Escuchar ${esc(x.w)}">${ico("speaker-high", "fill", 20)}</button></li>`).join("");
  ul.removeAttribute("aria-busy");
}
let SHEETN = 0;

/* ---------- #/cuento/<id>: el cuento ---------- */
let R = null, OFFS = [], PICK = 0;
const isPj = u => /^img\/pj\//.test(u);
const choiceAt = s => s.pages.length + 1;
const totalOf = s => s.pages.length + 1 + Math.max(...s.choice.opts.map(o => o.pages.length));
function pathOf(s, ch){
  const P = [{k: "cover"}];
  s.pages.forEach(pg => P.push({k: "page", pg}));
  P.push({k: "choice", pg: s.choice});
  const o = s.choice.opts.find(x => x.key === ch);
  if(o) o.pages.forEach(pg => P.push({k: "page", pg, end: true}));
  return P;
}
function sesSave(){ if(R && !R.fin) sesSet({id: R.id, p: R.p, ch: R.ch, es: R.es}); }
function artHtml(main, also){
  const all = [main, ...(also || []).slice(0, 2)];
  const big = all.filter(isPj).length ? all.filter(isPj) : [main], stk = all.filter(u => !big.includes(u)).slice(0, 2);
  return `<figure class="st-art${stk.length ? " has-stk" : ""}" data-n="${big.length}" aria-hidden="true">
    ${big.map(u => `<img class="st-big" src="${esc(u)}" alt="" draggable="false">`).join("")}
    ${stk.length ? `<span class="st-stks">${stk.map(u => `<img class="st-stk" src="${esc(u)}" alt="" draggable="false">`).join("")}</span>` : ""}</figure>`;
}
const actsHtml = () => `<div class="st-acts">
    <button type="button" class="st-spk" id="st-say" data-key="space" aria-label="Escuchar la página" title="Escuchar">${ico("speaker-high", "fill", 24)}</button>
    <button type="button" class="st-slow" id="st-slow" data-key="shift+space" aria-label="Escuchar despacio" title="Despacio">${ico("turtle", "fill", 26)}</button>
    <button type="button" class="st-esb" id="st-esb" aria-pressed="${R.es}">Español</button></div>
  <p class="st-note" id="st-note" role="status"></p>`;
function pageHtml(x){
  const c = code(R.L), es = t => `<p class="st-es" id="st-es"${R.es ? "" : " hidden"}>${esc(t)}</p>`;
  if(x.k === "cover") return `<article class="card st-page st-cover">${artHtml(R.s.cover, [])}
    <div class="st-body"><p class="st-kick">Un cuento del zorro</p><h1 class="st-txt st-title" id="st-txt" lang="${esc(c)}">${unitsHtml(R.M)}</h1>${es(R.s.es)}${actsHtml()}</div></article>`;
  if(x.k === "choice") return `<div class="st-choice"><section class="card st-page st-q" aria-labelledby="st-txt">
      <div class="st-body"><p class="st-txt" id="st-txt" lang="${esc(c)}">${unitsHtml(R.M)}</p>${es(x.pg.es)}${actsHtml()}</div></section>
    <div class="st-opts" role="group" aria-label="Elige el final">${x.pg.opts.map((o, i) => `<button type="button" class="st-opt" data-k="${esc(o.key)}" data-key="${i + 1}" data-key-pos="in" aria-pressed="${R.ch === o.key}">
      <span class="st-opt-pic"><img src="${esc(o.img)}" alt="" draggable="false"></span><span class="st-opt-t" lang="${esc(c)}">${esc(o.t)}</span>
      <small class="st-opt-es">${esc(o.es)}</small><span class="st-opt-ok" aria-hidden="true">${ico("check", "bold", 18)}</span></button>`).join("")}</div></div>`;
  return `<article class="card st-page">${artHtml(x.pg.img, x.pg.also)}
    <div class="st-body"><p class="st-txt" id="st-txt" lang="${esc(c)}">${unitsHtml(R.M)}</p>${es(x.pg.es)}${actsHtml()}</div></article>`;
}
function mount(){
  OFFS.forEach(f => { try{ f(); }catch(e){} }); OFFS = [];
  const tint = TINTS.includes(R.s.tint) ? R.s.tint : "green";
  $("#app").innerHTML = `<div class="st" id="st" data-tint="${tint}" data-no-renew data-no-hint>
    <div class="st-top"><div class="st-bar" id="st-bar" role="progressbar" aria-label="Páginas del cuento" aria-valuemin="0" aria-valuemax="${totalOf(R.s)}" aria-valuenow="0"><i></i></div></div>
    <div class="st-stage" id="st-stage"></div>
    <p class="vh" id="st-live" aria-live="polite" aria-atomic="true"></p>
    <div class="st-dock" id="st-dock"></div></div>`;
  const stage = $("#st-stage"), root = $("#st");
  /* tocar una palabra, los altavoces, «Español» y las opciones (delegado: la página se pinta de nuevo al pasar) */
  root.addEventListener("click", ev => {
    const t = ev.target; if(!t || !t.closest) return;
    const u = t.closest(".st-u");
    if(u && root.contains(u)){ tapUnit(u); return; }
    if(t.closest("#st-say")){ const b = $("#st-say"); if(b.classList.contains("playing")) stopSay(); else narrate(R.M, false, b, R.L); return; }
    if(t.closest("#st-slow")){ const b = $("#st-slow"); if(b.classList.contains("playing")) stopSay(); else narrate(R.M, true, b, R.L); return; }
    if(t.closest("#st-esb")){ R.es = !R.es; sesSave(); const es = $("#st-es"), b = $("#st-esb"); if(es) es.hidden = !R.es; if(b) b.setAttribute("aria-pressed", String(R.es)); return; }
    const o = t.closest(".st-opt"); if(o){ pick(o.dataset.k, o); return; }
    if(t.closest("#st-prev")){ go(-1); return; }
    if(t.closest("#st-next")){ go(1); return; }
    if(t.closest("#st-again")){ again(); return; }
  });
  if(W.G && typeof G.swipe === "function") OFFS.push(G.swipe(stage, {
    onMove: e => { const pg = stage.firstElementChild; if(pg && !rm()) pg.style.translate = `${e.dx}px 0`; },
    onLeft: e => { if(!go(1)) springBack(e); },
    onRight: e => { if(!go(-1)) springBack(e); },
    onCancel: e => springBack(e),
  }));
}
function springBack(e){
  const pg = $("#st-stage") && $("#st-stage").firstElementChild; if(!pg) return;
  const from = pg.style.translate || "0px 0"; pg.style.translate = "";
  if(rm() || !pg.animate) return;
  try{ if(W.M && typeof M.springTo === "function") M.springTo(pg, [{translate: from}, {translate: "0 0"}], {velocity: e && e.v ? {x: e.v, y: 0} : 0, commit: false});
  else pg.animate([{translate: from}, {translate: "0 0"}], {duration: 200, easing: "ease-out"}); }catch(err){}
}
function dockHtml(){
  return `<button type="button" class="glass-btn glass-btn--lg st-prev" id="st-prev" aria-label="Página anterior" data-key="left">${ico("caret-left", "bold", 22)}</button>
    <p class="st-pick" id="st-pick" hidden>Toca un dibujo para elegir</p>
    <button type="button" class="glass-btn glass-btn--pri glass-btn--lg st-next" id="st-next" data-key="enter right"><span>Siguiente</span>${ico("caret-right", "bold", 20)}</button>`;
}
function dock(){
  const d = $("#st-dock"); if(!d) return;
  if(!$("#st-next")) d.innerHTML = dockHtml();
  const prev = $("#st-prev"), next = $("#st-next"), hint = $("#st-pick"), x = R.path[R.p], last = R.p === R.path.length - 1 && !!R.ch;
  const off = R.p === 0;
  prev.classList.toggle("is-off", off); prev.disabled = off;
  if(off){ prev.setAttribute("aria-hidden", "true"); prev.tabIndex = -1; } else { prev.removeAttribute("aria-hidden"); prev.removeAttribute("tabindex"); }
  const wantPick = x.k === "choice" && !R.ch;
  next.hidden = wantPick; hint.hidden = !wantPick;
  const label = R.p === 0 ? "Empezar" : last ? "Terminar" : "Siguiente";
  const sp = next.querySelector("span"); if(sp && sp.textContent !== label) sp.textContent = label;
}
function bar(){
  const b = $("#st-bar"); if(!b) return;
  const tot = totalOf(R.s), v = R.fin ? tot : Math.min(R.p, tot);
  b.setAttribute("aria-valuenow", String(v)); b.setAttribute("aria-valuetext", R.fin ? "Cuento terminado" : R.p ? `Página ${R.p} de ${tot}` : "Portada");
  const i = b.querySelector("i"); if(i) i.style.width = `${(100 * v / tot).toFixed(1)}%`;
}
function animIn(el, dir){
  if(!dir || !el || !el.animate) return;
  try{
    if(rm()) el.animate([{opacity: 0}, {opacity: 1}], {duration: 140, easing: "ease-out"});
    else el.animate([{opacity: 0, translate: `${dir > 0 ? 56 : -56}px 0`}, {opacity: 1, translate: "0 0"}], {duration: 240, easing: "cubic-bezier(.2,.8,.2,1)"});
  }catch(e){}
}
let NT = 0;
function show(dir){
  const x = R.path[R.p], stage = $("#st-stage"); if(!stage) return;
  closeBub();
  R.M = x.k === "cover" ? model(R.s.title, R.s.gloss) : model(x.pg.t, R.s.gloss, x.pg.gl);
  stage.innerHTML = pageHtml(x);
  const el = stage.firstElementChild;
  bar(); dock();
  const lv = $("#st-live"); if(lv) lv.textContent = R.p ? (x.k === "choice" ? "Elige el final" : `Página ${R.p}`) : R.s.title;
  animIn(el, dir);
  clearTimeout(NT);
  const at = R.p, id = R.id;
  NT = setTimeout(() => { if(R && R.id === id && R.p === at && !R.fin && secOf(hashNow()) === "cuento") narrate(R.M, false, $("#st-say"), R.L); }, dir ? 360 : 520);
}
/* pasa de página: d = 1 o -1. false si no se pudo (en la portada hacia atrás, o en la de elegir sin elegir) */
function go(d){
  if(!R || R.fin) return false;
  if(d > 0){
    if(R.path[R.p].k === "choice" && !R.ch){ nudge(); return false; }
    if(R.p >= R.path.length - 1){ stopSay(); end(); return true; }
    R.p++;
  } else {
    if(R.p <= 0) return false;
    R.p--;
  }
  stopSay(); sesSave(); haptic("selection"); show(d);
  return true;
}
/* en la de elegir sin elegir: las dos tarjetas brillan un momento (no es un fallo) */
function nudge(){
  const os = DOC.querySelectorAll(".st-opt"); os.forEach(o => o.classList.add("is-nudge"));
  setTimeout(() => os.forEach(o => o.classList.remove("is-nudge")), 700);
  const h = $("#st-pick"); if(h && W.M && typeof M.bump === "function") M.bump(h);
}
function pick(key, btn){
  const o = R.s.choice.opts.find(x => x.key === key); if(!o) return;
  closeBub(); clearTimeout(NT);
  R.ch = key; R.path = pathOf(R.s, key); sesSave();
  DOC.querySelectorAll(".st-opt").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.k === key)));
  if(W.M && typeof M.ok === "function") M.ok(btn); haptic("selection");
  dock();
  const my = ++PICK, t0 = performance.now(), at = R.p;
  narrate(model(o.t, R.s.gloss), false, null, R.L).then(ok => {
    if(!ok) return;
    setTimeout(() => { if(my === PICK && R && R.p === at && R.ch === key && !R.fin) go(1); }, Math.max(250, 900 - (performance.now() - t0)));
  });
}
/* el final del cuento */
function end(){
  R.fin = true; clearTimeout(NT); closeBub(); PICK++;
  const res = finish(R.id, R.ch), E = END[R.L] || END.english, c = code(R.L), opts = R.s.choice.opts;
  sesSet(null);
  R.M = model(E.t, {[E.t.toLowerCase()]: {es: E.es, ipa: E.ipa}});
  const msg = !res.first ? (res.ends.length >= 2 && res.n === 2 ? "¡Ya conoces los dos finales!" : "¡Otra vez! Lo lees genial.")
    : res.paid ? `¡Muy bien! Has leído «${R.s.es}».` : `¡Muy bien! Has leído «${R.s.es}». Hoy ya ganaste monedas con ${DAY_PAY} cuentos: mañana ganas más.`;
  const stage = $("#st-stage");
  stage.innerHTML = `<article class="card st-page st-end" aria-labelledby="st-txt">
    <div class="st-fox">${heroHtml(120)}</div>
    <h1 class="st-end-t st-txt" id="st-txt" lang="${esc(c)}">${unitsHtml(R.M)}</h1>${ipaHtml(E.ipa, c)}
    <p class="st-end-m">${esc(msg)}</p>
    <ul class="st-ends" aria-label="Finales">${opts.map(o => `<li class="st-endc${res.ends.includes(o.key) ? " ok" : ""}"><img src="${esc(o.img)}" alt="" draggable="false">${res.ends.includes(o.key) ? `<span class="ck" aria-hidden="true">${ico("check", "bold", 16)}</span>` : ""}<span class="vh">${esc(o.es)}: ${res.ends.includes(o.key) ? "visto" : "por descubrir"}</span></li>`).join("")}
      <li class="st-ends-t">${res.ends.length >= 2 ? "¡Has encontrado los 2 finales!" : "Has encontrado 1 de 2 finales"}</li></ul>
    <p class="st-note" id="st-note" role="status"></p></article>`;
  const other = opts.find(o => !res.ends.includes(o.key));
  $("#st-dock").innerHTML = `<button type="button" class="glass-btn glass-btn--lg st-again" id="st-again">${ico(other ? "sparkle" : "arrow-counter-clockwise", "bold", 20)}${other ? "Otro final" : "Otra vez"}</button>
    <a class="glass-btn glass-btn--pri glass-btn--lg st-more" id="st-more" href="#/cuentos" data-key="enter">Más cuentos</a>`;
  bar();
  const lv = $("#st-live"); if(lv) lv.textContent = "Fin del cuento";
  animIn(stage.firstElementChild, 1);
  const fox = stage.querySelector(".st-fox");
  if(res.paid) setTimeout(() => { try{ award(COINS, "¡Cuento leído!", false, fox); }catch(e){ console.error(e); } }, rm() ? 0 : 450);
  if(W.M && typeof M.burst === "function" && !rm()) setTimeout(() => { if(fox && fox.isConnected) M.burst(fox, {n: 14}); }, 300);
  haptic("success");
  try{ bus.emit("story-done", {id: R.id, end: R.ch, first: res.first}); }catch(e){}
  if(res.first) setTimeout(() => { try{ if(typeof checkAch === "function") checkAch(); }catch(e){ console.error(e); } }, 1600);   /* «Ratón de biblioteca» */
  const at = R.id;
  NT = setTimeout(() => { if(R && R.id === at && R.fin) narrate(R.M, false, null, R.L); }, 500);
}
/* «Otro final» lleva a la página de elegir; «Otra vez», a la portada */
function again(){
  if(!R) return;
  const d = saved().done[R.id], other = R.s.choice.opts.some(o => !(d && d.e.includes(o.key)));
  R.fin = false; R.ch = null; R.path = pathOf(R.s, null); R.p = other ? choiceAt(R.s) : 0;
  $("#st-dock").innerHTML = dockHtml();
  sesSave(); show(-1);
}
function tapUnit(btn){
  const i = +btn.dataset.u, U = R && R.M && R.M.units[i]; if(!U) return;
  clearTimeout(NT);
  sayWord(U.text, btn, R.L);
  bubble(U, btn);
}

/* ---------- el globo de una palabra ---------- */
let BUB = null;
function closeBub(){ if(BUB){ const b = BUB; BUB = null; b.remove(); } }
function bubble(U, anchor){
  closeBub();
  const g = U.g || {}, c = code(R.L), w = U.text.toLocaleLowerCase(c);
  const b = DOC.createElement("div");
  b.className = "st-bub"; b.id = "st-bub"; b.setAttribute("role", "dialog"); b.setAttribute("aria-label", w);
  b.innerHTML = `${g.img ? `<span class="st-bub-pic"><img src="${esc(g.img)}" alt="" width="80" height="80" draggable="false"></span>` : ""}
    <span class="st-bub-t"><b lang="${esc(c)}">${esc(w)}</b>${ipaHtml(g.ipa, c)}<span class="st-bub-es">${esc(g.es || "")}</span></span>
    <button type="button" class="st-slow" id="st-bub-slow" aria-label="Escuchar despacio" title="Despacio">${ico("turtle", "fill", 24)}</button>
    <button type="button" class="st-bub-x" id="st-bub-x" aria-label="Cerrar">${ico("x", "bold", 18)}</button><span class="st-bub-a" aria-hidden="true"></span>`;
  const root = $("#st") || DOC.body; root.appendChild(b); BUB = b;
  b.querySelector("#st-bub-slow").addEventListener("click", e => { e.stopPropagation(); sayWord(U.text, e.currentTarget, R.L); });
  b.querySelector("#st-bub-x").addEventListener("click", e => { e.stopPropagation(); closeBub(); try{ anchor.focus({preventScroll: true}); }catch(err){} });
  b.addEventListener("click", e => e.stopPropagation());
  placeBub(b, anchor);
  if(W.M && typeof M.popIn === "function") try{ M.popIn(b, {from: anchor}); }catch(e){}
}
function placeBub(b, anchor){
  const r = anchor.getBoundingClientRect(), bw = b.offsetWidth, bh = b.offsetHeight, vw = innerWidth, vh = innerHeight;
  const cx = r.left + r.width / 2, left = Math.max(16, Math.min(vw - 16 - bw, cx - bw / 2));
  const above = r.top - bh - 14 >= 64, top = above ? r.top - bh - 14 : Math.min(vh - bh - 8, r.bottom + 14);
  b.dataset.side = above ? "top" : "bottom";
  b.style.left = `${Math.round(left)}px`; b.style.top = `${Math.round(top)}px`;
  b.style.setProperty("--ax", `${Math.round(Math.max(20, Math.min(bw - 20, cx - left)))}px`);
}
DOC.addEventListener("pointerdown", e => { if(BUB && e.target && e.target.closest && !e.target.closest("#st-bub, .st-u")) closeBub(); }, true);
DOC.addEventListener("keydown", e => { if(BUB && e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); closeBub(); } }, true);
W.addEventListener("resize", closeBub);
W.addEventListener("scroll", () => { if(BUB) closeBub(); }, {passive: true});

async function reader(parts){
  css(); const my = ++NAV;
  stopSay(); closeBub(); clearTimeout(NT);
  let id = parts[0] || ""; try{ id = decodeURIComponent(id); }catch(e){}
  let s = null;
  try{ s = await story(id); }catch(e){ console.error(e); if(my === NAV) errBox("No se pudo abrir este cuento.", "#/cuento/" + encodeURIComponent(id)); return; }
  if(my !== NAV) return;
  if(!s || s.L !== lang){ location.replace("#/cuentos"); return; }
  const st = lockOf(s.entry);
  if(!st.open){ PEND = id; location.replace("#/cuentos"); return; }
  const ses = sesGet(), keep = !!(ses && ses.id === id);
  R = {id, s, L: s.L, p: keep ? Math.floor(+ses.p) || 0 : 0, ch: keep && typeof ses.ch === "string" ? ses.ch : null, es: !!(keep && ses.es), fin: false, M: null};
  if(R.ch && !s.choice.opts.some(o => o.key === R.ch)) R.ch = null;
  R.path = pathOf(s, R.ch);
  R.p = Math.max(0, Math.min(R.path.length - 1, R.p));
  mount(); show(0); sesSave();
  preload(s);
}
const routeShelf = () => shelf();
routeShelf.load = () => ready();
const routeReader = parts => reader(parts);
routeReader.load = parts => { let id = (parts && parts[0]) || ""; try{ id = decodeURIComponent(id); }catch(e){} return story(id).then(s => { if(s) new Image().src = s.cover; }); };
ROUTES["cuentos"] = routeShelf;
ROUTES["cuento"] = routeReader;

/* ---------- conexión con la app ---------- */
try{
  const T = TABS.find(t => t.id === "jugar");
  if(T){
    for(const x of ["cuentos", "cuento"]) if(!T.secs.includes(x)) T.secs.push(x);
    const sg = (T.segs || []).find(x => x.h === "#/juegos"); if(sg) for(const x of ["cuentos", "cuento"]) if(!sg.secs.includes(x)) sg.secs.push(x);
  }
}catch(e){ console.error(e); }
try{
  if(W.vocabGames && typeof vocabGames.register === "function")
    vocabGames.register("cuentos", {t: "Cuentos del zorro", sub: "Lee, escucha y elige el final", img: IMG, href: "#/cuentos",
      line: () => { const ls = list(lang); if(!ls.length) return "4 cuentos"; const d = saved().done, n = ls.filter(e => d[e.id]).length; return n ? `Leídos: ${n} de ${ls.length}` : "¡Empieza el primero!"; }});
}catch(e){ console.error(e); }
/* atajo de Hoy de un cuento (js/shortcuts.js): solo los del idioma de ahora que estén abiertos */
function shortcut(id){
  const e = entryOf(id); if(!e || e.L !== lang || !lockOf(e).open) return null;
  return {href: `#/cuento/${encodeURIComponent(id)}`, t: "Cuento", name: e.es, act: "Cuento", top: e.short || e.es, sub: e.es, label: `Cuento · ${e.es}`,
    img: IMG, badge: {img: e.cover}};
}
bus.on("route", () => {
  if(secOf(hashNow()) === "cuento" || (!R && !BUB && !OFFS.length)) return;   /* solo al salir de un cuento (no corta la voz de otras pantallas) */
  stopSay(); closeBub(); clearTimeout(NT); PICK++; R = null;
  OFFS.forEach(f => { try{ f(); }catch(e){} }); OFFS = [];
});
/* el índice se pide pronto (pesa poco y está en el shell): así la tarjeta de Juegos y los atajos ya lo tienen */
setTimeout(() => { ready().catch(() => {}); }, 400);

W.vocabStories = {
  KEY, ready, index: () => IX, list: L => list(L || lang), story, saved, doneCount, images, shortcut,
  lock: id => { const e = entryOf(id); return e ? lockOf(e) : null; },
  state: () => R ? {id: R.id, lang: R.L, p: R.p, total: totalOf(R.s), kind: R.fin ? "end" : R.path[R.p].k, ch: R.ch, fin: R.fin, es: R.es,
    text: R.M ? R.M.text : "", units: R.M ? R.M.units.map(u => u.text) : [], lit: LIT, pages: R.path.length} : null,
};
})();
