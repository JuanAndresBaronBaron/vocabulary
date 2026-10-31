/* Módulo calls (window.vocabCalls): «El zorro te llama» (SPEC §5-J). El zorro llama por «teléfono» desde Londres, París o
   Copenhague, cuenta algo sencillo en el idioma que se aprende y hace 3 o 4 preguntas que se contestan tocando un dibujo
   (o diciéndolo, si se puede escuchar).

   Cuándo suena (todas a la vez; si no, no suena):
   · «Llamadas del zorro» encendido (Ajustes › Para mayores; encendido de serie) y nunca en un navegador automático
     (navigator.webdriver: las pruebas de las demás pantallas no se encuentran una llamada por sorpresa).
   · Nunca el primer día de uso (vocabSave.firstSeen(); sin save.js, si "act" no tiene un día de antes): así nunca en la
     primera sesión. Como mucho una al día y nunca dos días seguidos (GAP días entre una y otra; cuenta la que sonó,
     se contestara o no).
   · Al abrir la app: una sesión es esta pestaña (sessionStorage "vocab:call-s", fuera de la partida) o volver tras 30
     minutos sin verla. Una vez por sesión, la primera vez que la pantalla está tranquila en sus OPEN_MS primeros, se
     tira el dado (CHANCE); si sale, suena RING_DELAY después (si sigue tranquila; si no, en la siguiente pantalla
     tranquila de esos 3 minutos).
   · Pantalla tranquila: Hoy o la raíz de Juegos, Álbum, Granja, Camino, Palabras, Gramática, Premios o Mi zorro, a la
     vista, sin modo foco (lección, repaso, cuento), sin partida (html[data-gm-play]), sin hoja, menú ni dialog abiertos,
     sin el menú de idioma, sin nada a medias en la granja (BUSY: «¿Dónde está…?», su globo, la bandeja, la regadera,
     un animal levantado; o html[data-busy]), sin un dedo en la pantalla y sin un toque en el último segundo.
   · La primera llamada de su vida lleva debajo del nombre «Es un juego de la app: Zorro quiere hablar contigo…».
   · Solo vibra al deslizar «Contestar» hasta el final (nunca al tocar un botón).
   · El navegador tiene una voz de ese idioma (pickVoice; sin internet, una del aparato) y la llamada y sus palabras se
     cargaron antes (data/calls y los data/<doc>.json de sus palabras). Siempre en el idioma que se aprende.
   La llamada entrante: un <dialog> a pantalla completa, oscuro como el del iPhone y en silencio (iOS no deja sonar nada
   antes de un toque): la foto del zorro (img/pj/zorro.png) grande, «Zorro · Londres», «Contestar» (se desliza el botón
   verde o se toca; Enter) y «Ahora no» (Esc). Solo el retrato llama la atención (3 pulsos) y, con «Reducir movimiento», nada se
   mueve. A los RING_MS sin contestar, al dejar de verse la app o con «Ahora no», es una llamada perdida: Hoy enseña la
   fila «1 llamada perdida» (HOME_SLOTS id "call") durante MISS_DAYS días en ese idioma, y al tocarla se le devuelve la
   llamada (empieza ya hablando). Prioridad en Hoy (homeSlots de index.html): carta > refugio > llamada > temporada >
   candado > frase de la cena.
   Durante la llamada:
   · El zorro habla con la voz del navegador (useVoice(u, lang); si falla una de internet, retryLocal) y las palabras
     con audio grabado suenan con su mp3 (playClip). La primera frase se dice dentro del toque de Contestar (iOS).
   · Subtítulos en el idioma, con las palabras clave iluminadas (y la que suena, más; con el evento boundary si el
     navegador lo da); el español aparece debajo al acabar. Tocar una palabra clave para la llamada y abre un globo con
     la palabra, su IPA (ipaHtml), el español y su audio; al cerrarlo, el zorro sigue.
   · Las preguntas salen con 2 o 3 dibujos (teclas 1-3) con la palabra y su IPA. Al tocar uno: la buena en verde con ✓;
     si no era, la tocada en gris con ✗ (sin rojo, sin temblor, sin sonido triste) y el zorro dice cuál era. Las
     preguntas de gustos («¿Cuál es tu animal favorito?») no tienen mala: el zorro contesta a lo elegido. «Dilo»
     (micrófono, solo si canListen() y hay internet) escucha con listen() y lo compara con vocabReview.matches; tocar
     siempre vale. Si nadie contesta en NUDGE_MS, repite la pregunta una vez.
   · Las respuestas salen en otro orden cada vez que se contesta una llamada (mix(): nunca dentro de get(), que se
     guarda; ok se vuelve a contar y cada contestación «re» sigue con su respuesta), así la buena no es siempre la primera.
   · «Dilo conmigo»: tras cada respuesta (y lo que dice el zorro), la voz dice «Say it with me:» / «Répète avec moi :» /
     «Sig det med mig:» y la palabra suena con su mp3 (sayWord); luego ECHO_MS de pausa con una boca que late y «¡Dilo
     tú!». Si se puede escuchar (canListen(), con internet y con el permiso del micrófono ya dado o tras usar «Dilo»; nunca
     pide el permiso por sorpresa), escucha ECHO_LISTEN ms y, si oye algo, «¡Te he oído!» (no corrige: no es un examen).
   · «Otra vez» (Espacio), «Despacio» (la tortuga, Mayús+Espacio) y «Colgar» (Esc). Al acabar o colgar, «Llamada
     terminada · m:ss». Contestadas todas las preguntas: award(COINS) una vez por llamada y día (PAID_MAX llamadas
     pagadas al día como mucho). Colgar antes no paga y no deja llamada perdida.
   · El dialog lleva data-no-renew (js/sync.js no pide el permiso de Google con sus toques) y la fila perdida también.
   «Llamar al zorro» (#/llamadas, de Juegos: la tarjeta de vocabGames con href, sección «mas»; ‹ Juegos): las llamadas del
   idioma (primero las que aún no se han oído; ✓ en las oídas). Tocar una empieza ya hablando (como devolver la llamada,
   dentro del toque). Las sorpresas siguen como siempre y las monedas igual (PAID_MAX pagadas al día). Sin voz del idioma
   no se puede llamar (lo dice).
   Llamadas: data/calls/index.json = {v: 1, <english|français|dansk>: {city, calls: [{id, f, t}]}} y cada
   data/calls/<en|fr|da>/<nombre>.json = {v: 1, id: "<en|fr|da>-<nombre>", lang, city, t (título en español), lines: [
     {say, es, k?: [{t, r}]}                              una frase del zorro (es = su español)
     {say, es, k?, a: [{r, img?}], ok, yes: {say, es}, no: {say, es}}   pregunta con una buena (ok = su índice)
     {say, es, k?, a: [{r, img?, re: {say, es}}]}          pregunta de gustos (sin ok): cada respuesta trae su contestación
   ]}. r = "<doc>|<es>" (la primera fila de data/<doc>.json con ese es; "<doc>|<es>|<n>" la n-ésima, desde 0): de ahí
   salen la palabra, su IPA, el español y el dibujo (img lo cambia). k.t es el texto tal cual está en say (palabra
   entera). La última línea no es pregunta. En las preguntas y en las contestaciones también se iluminan las palabras
   de las respuestas que aparecen en el texto.
   Guardado: localStorage "calls" (EXACT en js/save.js: va en la partida; solo se escribe cuando suena una llamada o
   alguien hace algo, nunca al arrancar) = {v: 1, off?: true (interruptor apagado), d?: "AAAA-MM-DD" (la última que
   sonó), miss?: {id, d} (la perdida), h?: {id: "AAAA-MM-DD"} (cuándo sonó o se oyó cada una; suena la más antigua),
   paid?: {id: "AAAA-MM-DD"} (las pagadas hoy), heard?: {id: "AAAA-MM-DD"} (las que se contestaron: el ✓ de la lista)}.
   API: window.vocabCalls = {KEY, CHANCE, GAP, state(), blocked(), calm(), check(), ring(id?) → Promise<boolean>,
     answer(), pick(i), replay(slow), hangUp(), notNow(), callBack(), list(lang?), get(id), setOff(off), slot,
     adultHtml(), images(), files(), mix(llamada), call(id) (llamar desde la lista), get current() (con ok: la buena de la
     pregunta en pantalla, en el orden que se ve; -1 si es de gustos)}. */
(() => {
"use strict";
const W = window, D = document, ROOT = D.documentElement;
const KEY = "calls", SS = "vocab:call-s", IMG = "img/pj/zorro.png";
const CHANCE = .4;                  /* probabilidad de que suene en una sesión que puede */
const GAP = 2;                      /* días entre una llamada y la siguiente */
const OPEN_MS = 180000;             /* solo en los primeros 3 minutos de la sesión */
const WAKE_MS = 30 * 60000;         /* volver tras 30 minutos sin ver la app es otra sesión */
const RING_DELAY = 2500, RING_MS = 30000, MISS_DAYS = 3, NUDGE_MS = 15000, REACT_MS = 900, END_MS = 1300, RETRY_MS = 4000;
const COINS = 5, PAID_MAX = 2;
const ECHO_MS = 2500, ECHO_LISTEN = 3000;   /* «Dilo conmigo»: la pausa para repetir y lo que escucha si puede */
const ECHO = {english: "Say it with me:", "français": "Répète avec moi\u202F:", dansk: "Sig det med mig:"};
const CALM = new Set(["", "juegos", "album", "granja", "mapa", "palabras", "gramatica", "progreso", "mizorro"]);
const DK = /^\d{4}-\d{2}-\d{2}$/, ID = /^(en|fr|da)-[a-z0-9-]{1,40}$/;
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const $id = id => D.getElementById(id);
const h = s => esc(s);
const IC = (n, s = "bold", z = 24, c = "") => ico(n, s, z, c);
const rm = () => (W.M && typeof M.rm === "function") ? M.rm() : (() => { try{ return matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } })();
const tKey = () => dayKey(new Date());
const daysTo = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
const code = (l = lang) => (LANGS[l] && LANGS[l].code) || "en-GB";
const abOf = (l = lang) => CLIP_AB[l] || "en";
const onHoy = () => secOf(hashPath()) === "";
const hasTTS = () => "speechSynthesis" in W && typeof W.SpeechSynthesisUtterance === "function";
const stopSpeech = () => { try{ if("speechSynthesis" in W) speechSynthesis.cancel(); else if(typeof stopClip === "function") stopClip(); }catch(e){} };
const haptic = k => { try{ if(W.G && typeof G.haptic === "function") G.haptic(k); }catch(e){} };
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
/* la boca que late en «Dilo conmigo» (dibujo propio) */
const MOUTH = `<svg viewBox="0 0 64 48" width="44" height="33" aria-hidden="true" focusable="false"><path d="M6 18c8-10 44-10 52 0-4 22-48 22-52 0z" fill="#7A2E2E"/><path d="M6 18c8-10 44-10 52 0-14 5-38 5-52 0z" fill="#fff"/><path d="M20 34c6-6 18-6 24 0-8 4-16 4-24 0z" fill="#E07A6B"/><path d="M6 18c8-10 44-10 52 0-4 22-48 22-52 0z" fill="none" stroke="#3A1A1A" stroke-width="3" stroke-linejoin="round"/></svg>`;
const CHK = `<svg class="chk" viewBox="0 0 256 256" width="18" height="18" aria-hidden="true" focusable="false"><polyline points="40 144 96 200 224 72" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ---------- lo guardado ("calls") ---------- */
function days(m){
  const o = {};
  if(isObj(m)) for(const k of Object.keys(m)) if(ID.test(k) && typeof m[k] === "string" && DK.test(m[k])) o[k] = m[k];
  return o;
}
function load(){
  const o = store.get(KEY, null), s = isObj(o) ? o : {};
  const miss = isObj(s.miss) && typeof s.miss.id === "string" && ID.test(s.miss.id) && typeof s.miss.d === "string" && DK.test(s.miss.d)
    ? {id: s.miss.id, d: s.miss.d} : null;
  return {v: 1, off: s.off === true, d: typeof s.d === "string" && DK.test(s.d) ? s.d : "", miss, h: days(s.h), paid: days(s.paid), heard: days(s.heard)};
}
function save(s){
  const t = tKey(), o = {v: 1};
  if(s.off) o.off = true;
  if(s.d) o.d = s.d;
  if(s.miss) o.miss = s.miss;
  const hk = Object.keys(s.h).sort((a, b) => s.h[b].localeCompare(s.h[a])).slice(0, 30);
  if(hk.length) o.h = Object.fromEntries(hk.map(k => [k, s.h[k]]));
  const pk = Object.keys(s.paid).filter(k => s.paid[k] === t);   /* solo cuentan las de hoy */
  if(pk.length) o.paid = Object.fromEntries(pk.map(k => [k, t]));
  const ok = Object.keys(s.heard || {}).sort((a, b) => s.heard[b].localeCompare(s.heard[a])).slice(0, 30);
  if(ok.length) o.heard = Object.fromEntries(ok.map(k => [k, s.heard[k]]));
  store.set(KEY, o);
}
function setOff(off){
  const s = load(); if(s.off === !!off && !(off && s.miss)) return;
  s.off = !!off; if(off) s.miss = null;
  save(s);
}

/* ---------- sesión (sessionStorage, nunca en la partida) ---------- */
let MEM = null;
function sess(){
  try{ const o = JSON.parse(sessionStorage.getItem(SS)); if(isObj(o) && typeof o.t === "number") return o; }catch(e){}
  return MEM;
}
function sessSet(o){ MEM = o; try{ sessionStorage.setItem(SS, JSON.stringify(o)); }catch(e){} }
const sessNew = () => { const o = {t: Date.now(), done: false, p: 0}; sessSet(o); return o; };

/* ---------- las llamadas ---------- */
let IDX = null;
const CALLS = {};
function index(){
  if(!IDX) IDX = fetch("data/calls/index.json").then(r => { if(!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(x => { if(!isObj(x)) throw new Error("index"); return x; }).catch(e => { IDX = null; throw e; });
  return IDX;
}
async function list(l = lang){
  const x = await index(), L = x[l];
  return isObj(L) && Array.isArray(L.calls) ? L.calls.filter(c => isObj(c) && ID.test(c.id) && typeof c.f === "string") : [];
}
const LETTER = /[\p{L}\p{M}\p{N}]/u;
/* dónde está t en text como palabra entera, sin pisar las ya puestas; null si no está */
function findWord(text, t, taken){
  if(!t) return null;
  for(let i = text.indexOf(t); i >= 0; i = text.indexOf(t, i + 1)){
    const a = i, b = i + t.length;
    if((a === 0 || !LETTER.test(text[a - 1])) && (b >= text.length || !LETTER.test(text[b])) && !taken.some(k => a < k.e && b > k.s)) return {s: a, e: b};
  }
  return null;
}
const ART = /^(the|an|a|le|la|les|l'|un|une|des|du|en|et)\s*/i;
/* las palabras de las respuestas que aparecen en una frase (sin mirar mayúsculas; también sin su artículo) */
function autoKeys(text, ws, taken){
  const low = text.toLowerCase(), out = [];
  for(const w of ws){
    if(!w) continue;
    for(const t of [w.say, w.say.replace(ART, "")]){
      const p = findWord(low, t.toLowerCase(), taken.concat(out));
      if(p){ out.push({s: p.s, e: p.e, w}); break; }
    }
  }
  return out;
}
const sortK = ks => ks.sort((a, b) => a.s - b.s);
function rowOf(doc, es, n){
  const rs = (doc && Array.isArray(doc.rows) ? doc.rows : []).filter(r => r && r.es === es && isObj(r.l));
  return rs[n] || null;
}
async function resolve(c, l){
  const refs = new Set();
  const lines = Array.isArray(c.lines) ? c.lines : [];
  for(const ln of lines){
    (Array.isArray(ln.k) ? ln.k : []).forEach(k => refs.add(String(k.r)));
    (Array.isArray(ln.a) ? ln.a : []).forEach(a => refs.add(String(a.r)));
  }
  const docs = {};
  await Promise.all([...new Set([...refs].map(r => r.split("|")[0]))].map(async d => {
    if(!/^[\w-]{1,40}$/.test(d)) throw new Error("doc " + d);
    docs[d] = await getDoc(d);
  }));
  const word = (ref, img) => {
    const [d, es, n] = String(ref).split("|"), r = rowOf(docs[d], es, Math.max(0, parseInt(n, 10) || 0)), x = r && r.l[l];
    if(!x || !x.word) throw new Error("palabra " + ref);
    return {ref: String(ref), word: String(x.word), say: speakable(x.word), ipa: String(x.ipa || ""), es: String(r.es), img: String(img || r.img || "")};
  };
  const part = o => { if(!isObj(o) || typeof o.say !== "string" || !o.say.trim() || typeof o.es !== "string") throw new Error("frase"); return {say: o.say, es: o.es}; };
  const out = lines.map(ln => {
    const L = part(ln), keys = [];
    for(const k of Array.isArray(ln.k) ? ln.k : []){
      const p = findWord(L.say, String(k.t || ""), keys); if(!p) throw new Error("clave " + k.t);
      keys.push({s: p.s, e: p.e, w: word(k.r)});
    }
    if(Array.isArray(ln.a)){
      if(ln.a.length < 2 || ln.a.length > 3) throw new Error("respuestas");
      L.a = ln.a.map(a => { const w = word(a.r, a.img); if(!w.img) throw new Error("dibujo " + a.r); return {w, re: a.re ? part(a.re) : null}; });
      if(typeof ln.ok === "number"){
        if(!(ln.ok >= 0 && ln.ok < L.a.length)) throw new Error("ok");
        L.ok = ln.ok; L.yes = part(ln.yes); L.no = part(ln.no);
        const rw = [L.a[ln.ok].w];
        L.yes.keys = sortK(autoKeys(L.yes.say, rw, [])); L.no.keys = sortK(autoKeys(L.no.say, rw, []));
      } else if(L.a.some(a => !a.re)) throw new Error("re");
      else L.a.forEach(a => { a.re.keys = sortK(autoKeys(a.re.say, [a.w], [])); });
      keys.push(...autoKeys(L.say, L.a.map(a => a.w), keys));
    }
    L.keys = sortK(keys);
    return L;
  });
  if(!out.length || out[out.length - 1].a) throw new Error("fin");
  const qs = out.filter(x => x.a).length;
  if(qs < 1) throw new Error("preguntas");
  return {id: c.id, lang: l, city: String(c.city || ""), t: String(c.t || ""), lines: out, qs};
}
function get(id){
  if(!CALLS[id]) CALLS[id] = (async () => {
    const x = await index();
    let meta = null, L = null;
    for(const l of Object.keys(LANGS)){ const m = (isObj(x[l]) && Array.isArray(x[l].calls) ? x[l].calls : []).find(c => c && c.id === id); if(m){ meta = m; L = l; break; } }
    if(!meta) throw new Error("no existe " + id);
    const r = await fetch("data/calls/" + meta.f); if(!r.ok) throw new Error("HTTP " + r.status);
    const c = await r.json();
    if(!isObj(c) || c.id !== id || c.lang !== L) throw new Error("llamada " + id);
    return resolve(c, L);
  })().catch(e => { delete CALLS[id]; throw e; });
  return CALLS[id];
}
/* la llamada con las respuestas de cada pregunta en otro orden (copia: la de get() no cambia). ok se vuelve a contar;
   yes/no son de la pregunta y cada «re» va dentro de su respuesta, así que siguen con la suya */
function mix(c){
  return Object.assign({}, c, {lines: c.lines.map(l => {
    if(!l.a) return l;
    const ix = l.a.map((_, i) => i);
    for(let i = ix.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [ix[i], ix[j]] = [ix[j], ix[i]]; }
    const o = Object.assign({}, l, {a: ix.map(i => l.a[i])});
    if(typeof l.ok === "number") o.ok = ix.indexOf(l.ok);
    return o;
  })});
}
const pre = src => { if(!src) return; try{ const i = new Image(); i.decoding = "async"; i.src = src; }catch(e){} };
const preload = c => { pre(IMG); c.lines.forEach(l => (l.a || []).forEach(a => pre(a.w.img))); };
/* la que suena: la que hace más que no sonaba en este idioma (a igual, al azar) */
async function pickCall(l = lang){
  const ls = await list(l), s = load();
  const ord = ls.map(c => ({c, r: Math.random()})).sort((a, b) => (s.h[a.c.id] || "").localeCompare(s.h[b.c.id] || "") || a.r - b.r).map(x => x.c);
  for(const m of ord){ try{ return await get(m.id); }catch(e){ /* una que no carga no suena: la siguiente */ } }
  return null;
}

/* ---------- cuándo puede sonar ---------- */
function firstDay(){
  const t = tKey();
  try{ if(W.vocabSave && typeof vocabSave.firstSeen === "function") return dayKey(new Date(vocabSave.firstSeen())) >= t; }catch(e){}
  const a = store.get("act", {}); return !Object.keys(isObj(a) ? a : {}).some(k => DK.test(k) && k < t);
}
function voiceOk(){
  if(!hasTTS() || !Array.isArray(voices) || !voices.length) return false;
  const v = pickVoice(lang); if(!v) return false;
  return !(navigator.onLine === false && vnet(v));
}
/* por qué no puede sonar ahora ("" = puede): "auto" | "off" | "first" | "today" | "gap" | "voices" */
function blocked(){
  if(navigator.webdriver) return "auto";
  const s = load(), t = tKey();
  if(s.off) return "off";
  if(firstDay()) return "first";
  if(s.d === t) return "today";
  if(s.d && daysTo(s.d, t) < GAP) return "gap";
  if(!voiceOk()) return "voices";
  return "";
}
/* un dedo (o el ratón pulsado) en la pantalla: nunca suena debajo de él, aunque lleve más de un segundo arrastrando */
let lastIn = 0;
const DOWN = new Map();
["pointerdown", "keydown", "wheel", "touchstart", "touchmove"].forEach(e => addEventListener(e, () => { lastIn = Date.now(); }, {capture: true, passive: true}));
addEventListener("pointerdown", e => { DOWN.set(e.pointerId, Date.now()); }, {capture: true, passive: true});
addEventListener("pointermove", e => { if(e.buttons || e.pointerType !== "mouse"){ lastIn = Date.now(); if(DOWN.has(e.pointerId)) DOWN.set(e.pointerId, lastIn); } }, {capture: true, passive: true});
["pointerup", "pointercancel"].forEach(t => addEventListener(t, e => { DOWN.delete(e.pointerId); lastIn = Date.now(); }, {capture: true, passive: true}));
addEventListener("blur", () => DOWN.clear());
const pressing = () => { const t = Date.now(); for(const [k, v] of DOWN) if(t - v > 20000) DOWN.delete(k); return DOWN.size > 0; };
/* algo a medias que no es una hoja: el juego «¿Dónde está…?» de la granja, su globo («¿Cómo me llamo?», regalos…), la
   bandeja de comida, la regadera o un animal levantado; html[data-busy] lo puede poner cualquier módulo */
const BUSY = ".fm-stage.finding, .fm-stage.watering, .fm-pop:not([hidden]), .fm-tray:not([hidden]), .fm-it.lift, .vm";
function calm(){
  if(D.visibilityState !== "visible") return false;
  const hp = hashPath();
  if(!CALM.has(secOf(hp)) || !isRootPath(hp)) return false;
  for(const a of ["data-focus", "data-gm-play", "data-sheet", "data-menu", "data-cmenu", "data-busy"]) if(ROOT.hasAttribute(a)) return false;
  if(D.querySelector("dialog[open]") || D.querySelector(BUSY) || pressing()) return false;
  return true;
}

/* ---------- el momento de sonar ---------- */
let TIMER = 0, RINGING = false;
function check(){
  clearTimeout(TIMER); TIMER = 0;
  if(CUR || RINGING || navigator.webdriver) return;
  let s = sess(); if(!s) s = sessNew();
  if(s.done && !s.p) return;
  if(Date.now() - s.t > OPEN_MS){ s.done = true; s.p = 0; sessSet(s); return; }
  const why = blocked();
  if(why === "voices"){ TIMER = setTimeout(check, RETRY_MS); return; }   /* las voces llegan tarde (bus "voices" también avisa) */
  if(why){ s.done = true; s.p = 0; sessSet(s); return; }
  if(!calm() || Date.now() - lastIn < 1000){ TIMER = setTimeout(check, s.done ? 1500 : RETRY_MS); return; }
  if(!s.done){ s.done = true; s.p = Math.random() < CHANCE ? 1 : 0; sessSet(s); if(!s.p) return; }
  TIMER = setTimeout(go, RING_DELAY);
}
async function go(){
  TIMER = 0;
  const s = sess(); if(!s || !s.p || CUR || RINGING) return;
  if(!calm() || blocked() || Date.now() - lastIn < 1000) return check();
  RINGING = true;
  let c = null;
  try{ c = await pickCall(); }catch(e){ c = null; }
  RINGING = false;
  if(!c){ s.p = 0; sessSet(s); return; }           /* sin la llamada o sus palabras no suena */
  if(!calm() || blocked() || CUR) return check();
  s.p = 0; sessSet(s);
  ringCall(c);
}

/* ---------- la pantalla ---------- */
let CUR = null;      /* {call, mode: "ring" | "talk", …} */
function dlg(){
  let d = $id("cl-dlg"); if(d) d.remove();
  d = D.createElement("dialog");
  d.id = "cl-dlg"; d.className = "cl-dlg";
  d.setAttribute("data-no-renew", ""); d.setAttribute("aria-labelledby", "cl-name");
  d.addEventListener("cancel", e => { e.preventDefault(); if($id("cl-pop")) return closePop(); if(CUR && CUR.mode === "ring") notNow(); else hangUp(); });
  d.addEventListener("close", () => { if(CUR && !CUR.closing){ const C = CUR; C.closing = true; teardown(C); CUR = null; d.remove(); } });
  d.addEventListener("click", onClick);
  d.addEventListener("pointerdown", e => { const p = $id("cl-pop"); if(p && !p.contains(e.target) && !e.target.closest(".cl-k")) closePop(); });
  D.body.append(d);
  try{ d.showModal(); }catch(e){ d.setAttribute("open", ""); }
  return d;
}
function teardown(C){
  C.tok++; clearTimeout(C.ringT); clearTimeout(C.nudgeT); clearInterval(C.clockT);
  if(C.offSwipe) try{ C.offSwipe(); }catch(e){}
  stopSpeech(); try{ if(typeof stopListen === "function") stopListen(); }catch(e){}
}
function closeDlg(C){
  if(!C || C.closing) return;
  C.closing = true; teardown(C);
  const d = $id("cl-dlg");
  if(d){ try{ d.close(); }catch(e){} d.remove(); }
  if(CUR === C) CUR = null;
}
function onClick(e){
  const C = CUR; if(!C) return;
  const t = e.target.closest("button"); if(!t) return;
  if(t.id === "cl-yes") return answer();
  if(t.id === "cl-no") return notNow();
  if(t.classList.contains("cl-a")) return pick(+t.dataset.a, "toque");
  if(t.classList.contains("cl-k")) return openPop(t);
  if(t.id === "cl-again") return replay(false);
  if(t.id === "cl-slow") return replay(true);
  if(t.id === "cl-mic") return hear();
  if(t.id === "cl-hang") return hangUp();
  if(t.id === "cl-pop-say"){ const k = C.popK; if(k) sayWord(k.w); return; }
  if(t.id === "cl-pop-x") return closePop();
}

/* ---------- suena ---------- */
function ringHtml(c, first){
  return `<div class="cl-ring">
    <div class="cl-who"><p class="cl-kick">Llamada en ${h(LANGS[c.lang].name)}…</p>
      <h2 class="cl-name" id="cl-name" tabindex="-1" autofocus>Zorro · ${h(c.city)}</h2>
      ${first ? `<p class="cl-hi">Es un juego de la app: Zorro quiere hablar contigo en ${h(LANGS[c.lang].name)}.</p>` : ""}</div>
    <div class="cl-pic" aria-hidden="true"><img src="${IMG}" alt="" width="256" height="224" draggable="false"></div>
    <div class="cl-acts">
      <button type="button" class="cl-no" id="cl-no">Ahora no</button>
      <button type="button" class="cl-slide" id="cl-yes" data-key="enter" data-key-pos="in" aria-label="Contestar">
        <span class="cl-knob" aria-hidden="true">${IC("phone", "fill", 28)}</span><span class="cl-sl-t" aria-hidden="true"><span>Contestar</span></span></button>
    </div></div>`;
}
function ringCall(c){
  if(CUR) return false;
  const s = load(), t = tKey(), first = !s.d && !Object.keys(s.h).length;   /* la primera de su vida: lo explica */
  s.d = t; s.h[c.id] = t; s.miss = {id: c.id, d: t};    /* perdida hasta que se conteste (aunque se cierre la app) */
  save(s);
  preload(c);
  const C = CUR = {call: c, mode: "ring", tok: 0};
  const d = dlg();
  d.classList.toggle("ringing", !rm());
  d.innerHTML = ringHtml(c, first);
  wireSlide(C, d);
  const n = $id("cl-name"); if(n) try{ n.focus({preventScroll: true}); }catch(e){}
  C.ringT = setTimeout(() => missed(C), RING_MS);
  setTimeout(() => d.classList.remove("ringing"), 6500);   /* 3 avisos como mucho */
  return true;
}
function wireSlide(C, d){
  const tr = d.querySelector(".cl-slide"), kn = tr && tr.querySelector(".cl-knob");
  if(!tr || !kn || !W.G || typeof G.swipe !== "function") return;
  let max = 0;
  const pos = x => { kn.style.translate = x ? `${x}px 0` : ""; };
  C.offSwipe = G.swipe(tr, {threshold: .45, touchAction: "none",
    onMove: ({dx}) => { max = Math.max(0, tr.clientWidth - kn.offsetWidth - 16); tr.classList.add("drag"); pos(Math.max(0, Math.min(max, dx))); },
    onRight: () => { tr.classList.remove("drag"); pos(max); haptic("selection"); answer(); },
    onCancel: () => { tr.classList.remove("drag"); pos(0); }});
}
function missed(C){
  if(!C || CUR !== C || C.mode !== "ring") return;
  closeDlg(C);
  if(onHoy() && typeof route === "function") route();   /* sale «1 llamada perdida» */
}
function notNow(){ const C = CUR; if(C && C.mode === "ring") missed(C); }

/* ---------- hablando ---------- */
function talkHtml(c){
  return `<div class="cl-talk">
    <div class="cl-head"><span class="cl-av" aria-hidden="true"><img src="${IMG}" alt="" width="256" height="224" draggable="false"></span>
      <div class="cl-hn"><h2 id="cl-name" tabindex="-1">Zorro · ${h(c.city)}</h2><span class="cl-time" id="cl-time" aria-hidden="true">0:00</span></div></div>
    <div class="cl-sub"><p class="cl-say" id="cl-say" lang="${h(code(c.lang))}" data-a11y-small></p><p class="cl-es" id="cl-es" lang="es" data-hide></p></div>
    <div class="cl-mid" id="cl-mid"><div class="cl-big" id="cl-big" aria-hidden="true"><span class="cl-av"><img src="${IMG}" alt="" width="256" height="224" draggable="false"></span>
        <span class="cl-wave"><i></i><i></i><i></i><i></i></span></div>
      <div class="cl-ans" id="cl-ans" hidden></div>
      <p class="cl-st" id="cl-st" role="status"></p></div>
    <div class="cl-ctl">
      <button type="button" class="cl-b" id="cl-again" data-key="space"><span class="cl-bi">${IC("arrow-counter-clockwise", "bold", 26)}</span>Otra vez</button>
      <button type="button" class="cl-b" id="cl-slow" data-key="shift+space"><span class="cl-bi">${IC("turtle", "fill", 28)}</span>Despacio</button>
      <button type="button" class="cl-b" id="cl-mic" hidden><span class="cl-bi">${IC("microphone", "fill", 26)}</span>Dilo</button>
      <button type="button" class="cl-b hang" id="cl-hang"><span class="cl-bi">${IC("phone-disconnect", "fill", 30)}</span>Colgar</button>
    </div></div>`;
}
function talk(c){
  const d = $id("cl-dlg") || dlg();
  const C = CUR = Object.assign(CUR && CUR.call === c ? CUR : {}, {call: mix(c), mode: "talk", tok: (CUR && CUR.tok) || 0, i: -1, phase: "",
    done: new Set(), t0: Date.now(), listening: false, noMic: false, micUsed: false, nudged: -1});
  clearTimeout(C.ringT);
  if(C.offSwipe){ try{ C.offSwipe(); }catch(e){} C.offSwipe = null; }
  d.classList.remove("ringing");
  d.innerHTML = talkHtml(c);
  const n = $id("cl-name"); if(n) try{ n.focus({preventScroll: true}); }catch(e){}
  C.clockT = setInterval(() => { const el = $id("cl-time"); if(el) el.textContent = mmss(Math.floor((Date.now() - C.t0) / 1000)); }, 1000);
  const s = load(); if(s.miss && s.miss.id === c.id) s.miss = null;
  s.h[c.id] = s.heard[c.id] = tKey(); save(s);
  step(0);   /* la primera frase, dentro del toque */
}
function answer(){
  const C = CUR; if(!C || C.mode !== "ring") return;
  talk(C.call);
}
const alive = (C, tok) => CUR === C && C.tok === tok && C.mode === "talk";
const wait = (ms, C, tok) => new Promise(r => setTimeout(() => r(alive(C, tok)), ms));
const pause = l => Math.max(1800, Math.min(3800, 1400 + l.es.length * 28));
function subHtml(text, keys){
  let out = "", p = 0;
  keys.forEach((k, i) => { out += h(text.slice(p, k.s)) + `<button type="button" class="cl-k" data-k="${i}" aria-haspopup="dialog">${h(text.slice(k.s, k.e))}</button>`; p = k.e; });
  return out + h(text.slice(p));
}
function paintLine(o){
  const C = CUR, say = $id("cl-say"), es = $id("cl-es"); if(!C || !say || !es) return;
  C.keys = o.keys || [];
  say.innerHTML = subHtml(o.say, C.keys);
  es.textContent = o.es; es.setAttribute("data-hide", "");
  keepFocus();
}
/* si lo que tenía el foco se fue al repintar (una palabra clave, un dibujo, el globo), vuelve al nombre de la llamada:
   nunca se queda fuera del dialog */
function keepFocus(){
  const d = $id("cl-dlg"), a = D.activeElement;
  if(!d || (a && a !== D.body && d.contains(a) && !a.disabled)) return;
  const n = $id("cl-name"); if(n) try{ n.focus({preventScroll: true}); }catch(e){}
}
const showEs = () => { const es = $id("cl-es"); if(es) es.removeAttribute("data-hide"); };
function light(ci){
  const C = CUR; if(!C) return;
  D.querySelectorAll("#cl-say .cl-k").forEach((b, i) => { const k = C.keys[i]; b.classList.toggle("now", ci != null && !!k && ci >= k.s && ci < k.e); });
}
function status(t){ const el = $id("cl-st"); if(el) el.textContent = t || ""; }
/* la voz del navegador para una frase; se resuelve al acabar (o si el navegador no avisa) */
function speakLine(text, slow){
  return new Promise(res => {
    stopSpeech(); light(null);
    if(!hasTTS()) return res();
    let done = false, t = 0;
    const fin = () => { if(done) return; done = true; clearTimeout(t); light(null); talking(false); res(); };
    const u = new SpeechSynthesisUtterance(text.replace(/[«»]/g, " "));   /* mismo largo: el boundary sigue valiendo */
    u.rate = slow ? SLOW() : rate;
    useVoice(u, lang);
    u.onend = fin;
    u.onerror = e => { if(!retryLocal(u, e, fin)) fin(); };
    u.onboundary = e => { if(!done && (!e.name || e.name === "word")) light(e.charIndex); };
    t = setTimeout(fin, 2500 + text.length * 120 / (u.rate || 1));
    talking(true);
    try{ speechSynthesis.speak(u); }catch(e){ fin(); }
  });
}
/* mientras habla el zorro, sus ondas se mueven (con «Reducir movimiento», quietas) */
function talking(on){ const d = $id("cl-dlg"); if(d) d.classList.toggle("talking", !!on); }
/* una palabra: su audio grabado si lo tiene; si no, la voz del navegador */
function sayWord(w, slow){
  return new Promise(res => {
    let done = false;
    const fin = () => { if(done) return; done = true; res(); };
    const tts = () => {
      if(done) return;
      if(!hasTTS()) return fin();
      const u = new SpeechSynthesisUtterance(w.say);
      u.rate = slow ? SLOW() : rate;
      useVoice(u, lang);
      u.onend = fin; u.onerror = e => { if(!retryLocal(u, e, fin)) fin(); };
      setTimeout(fin, 1500 + w.say.length * 110 / (u.rate || 1));
      try{ speechSynthesis.speak(u); }catch(e){ fin(); }
    };
    stopSpeech();
    if(playClip(w.word, !!slow, ok => ok ? fin() : tts())) setTimeout(fin, 8000);
    else tts();
  });
}
function paintAnswers(line){
  const box = $id("cl-ans"), C = CUR; if(!box || !C) return;
  const big = $id("cl-big"); if(big) big.hidden = !!(line && line.a);
  if(!line || !line.a){ box.hidden = true; box.innerHTML = ""; return; }
  const cd = code(C.call.lang);
  box.style.setProperty("--n", line.a.length);
  box.innerHTML = line.a.map((a, i) => `<button type="button" class="cl-a" data-a="${i}" data-key="${i + 1}" data-key-pos="in">
      <img src="${h(a.w.img)}" alt="" width="160" height="160" draggable="false"><span class="cl-aw" lang="${h(cd)}">${h(a.w.say)}</span>${ipaHtml(a.w.ipa, cd, "cl-aipa")}</button>`).join("");
  box.hidden = false;
  fitWords(box);
  keepFocus();
}
/* la palabra de cada dibujo nunca se parte: si no cabe, la letra baja (hasta 12 px) */
function fitWords(box){
  box.querySelectorAll(".cl-aw").forEach(el => {
    el.style.fontSize = "";
    let fs = parseFloat(getComputedStyle(el).fontSize) || 17;
    while(el.scrollWidth > el.clientWidth + .5 && fs > 12){ fs -= 1; el.style.fontSize = fs + "px"; }
  });
}
function micShow(on){
  const C = CUR, b = $id("cl-mic"); if(!b || !C) return;
  b.hidden = !(on && !C.noMic && typeof canListen === "function" && canListen() && navigator.onLine !== false);
}
function nudge(C, tok, line){
  clearTimeout(C.nudgeT);
  if(C.nudged === C.i) return;
  C.nudgeT = setTimeout(() => {
    if(!alive(C, tok) || C.phase !== "wait" || C.listening || $id("cl-pop")) return;
    C.nudged = C.i; replay(false);
  }, NUDGE_MS);
}
async function step(i){
  const C = CUR; if(!C || C.mode !== "talk") return;
  const line = C.call.lines[i];
  if(!line) return end();
  const tok = ++C.tok;
  C.i = i; C.phase = line.a ? "wait" : "line"; C.resume = null;
  clearTimeout(C.nudgeT); micShow(false); status(line.a ? "Toca una respuesta" : "");
  paintLine(line); paintAnswers(line.a ? line : null);
  await speakLine(line.say, false);
  if(!alive(C, tok)) return;
  showEs();
  if(line.a){ micShow(true); nudge(C, tok, line); return; }
  C.phase = "gap";
  if(!(await wait(pause(line), C, tok))) return;
  step(i + 1);
}
function replay(slow){
  const C = CUR; if(!C || C.mode !== "talk" || C.phase === "react" || C.phase === "echo" || C.phase === "end") return;
  const line = C.call.lines[C.i]; if(!line) return;
  if(C.listening) try{ stopListen(); }catch(e){}
  const tok = ++C.tok;
  clearTimeout(C.nudgeT);
  C.phase = line.a ? "wait" : "line";
  speakLine(line.say, slow).then(async () => {
    if(!alive(C, tok)) return;
    showEs();
    if(line.a){ micShow(true); nudge(C, tok, line); return; }
    C.phase = "gap";
    if(!(await wait(pause(line), C, tok))) return;
    step(C.i + 1);
  });
}
function marks(line, j){
  const open = typeof line.ok !== "number", btns = [...D.querySelectorAll("#cl-ans .cl-a")];
  btns.forEach((b, i) => {
    b.disabled = true;
    const mk = (cls, ic, sr) => { b.classList.add(cls); b.insertAdjacentHTML("afterbegin", `<span class="cl-mk ${cls.slice(3)}" aria-hidden="true">${ic}</span>`); b.insertAdjacentHTML("beforeend", `<span class="vh" lang="es"> (${sr})</span>`); };
    if(open){ if(i === j) mk("is-pick", CHK, "tu respuesta"); else b.classList.add("is-dim"); return; }
    if(i === line.ok) mk("is-ok", CHK, "correcta");
    else if(i === j) mk("is-miss", IC("x", "bold", 16), "tu respuesta");
    else b.classList.add("is-dim");
  });
  const ok = open || j === line.ok, mkEl = D.querySelector(`#cl-ans .cl-a[data-a="${open ? j : line.ok}"] svg.chk`);
  if(W.M && typeof M.ok === "function" && mkEl) try{ M.ok(mkEl, {haptic: ok}); }catch(e){}
  keepFocus();
}
async function pick(j, how){
  const C = CUR; if(!C || C.mode !== "talk" || (C.phase !== "wait" && C.phase !== "line")) return;
  const line = C.call.lines[C.i]; if(!line || !line.a || !line.a[j]) return;
  if($id("cl-pop")) removePop();
  const tok = ++C.tok;
  C.phase = "react"; C.done.add(C.i); C.resume = null;
  clearTimeout(C.nudgeT); micShow(false); status("");
  if(C.listening) try{ stopListen(); }catch(e){}
  marks(line, j);
  const open = typeof line.ok !== "number", good = open || j === line.ok, right = line.a[open ? j : line.ok];
  const re = open ? line.a[j].re : good ? line.yes : line.no;
  paintLine(re);
  if(good){
    await sayWord(line.a[j].w);            /* la palabra con su audio (dentro del toque) */
    if(!alive(C, tok)) return;
    await speakLine(re.say, false);
  } else {
    await speakLine(re.say, false);        /* el zorro dice cuál era… */
    if(!alive(C, tok)) return;
    await sayWord(right.w);                /* …y suena su audio */
  }
  if(!alive(C, tok)) return;
  showEs();
  if(!(await wait(REACT_MS, C, tok))) return;
  if(!(await echo(C, tok, open ? line.a[j].w : right.w))) return;
  if(!(await wait(600, C, tok))) return;
  step(C.i + 1);
}
/* «Dilo conmigo»: la voz dice la frase («Say it with me:») y la palabra suena con su mp3; después la boca late con «¡Dilo
   tú!» ECHO_MS (o, si se puede escuchar, ECHO_LISTEN ms escuchando; si oye algo, «¡Te he oído!»). false si se colgó */
async function echo(C, tok, w){
  if(!alive(C, tok) || !w) return false;
  C.phase = "echo";
  const fr = ECHO[C.call.lang] || ECHO.english, fin = C.call.lang === "français" ? "\u202F!" : "!";
  const say = `${fr} ${w.say}${fin}`, s0 = fr.length + 1;
  paintLine({say, es: `Dilo conmigo: «${String(w.es || "").toLocaleLowerCase("es")}».`, keys: [{s: s0, e: s0 + w.say.length, w}]});
  await speakLine(fr, false);
  if(!alive(C, tok)) return false;
  light(s0);
  await sayWord(w);
  if(!alive(C, tok)) return false;
  light(null); showEs();
  const box = $id("cl-mid"), el = D.createElement("div");
  el.className = "cl-echo"; el.id = "cl-echo"; el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<span class="cl-mouth">${MOUTH}</span><b>¡Dilo tú!</b>`;
  if(box) box.append(el);
  status("¡Dilo tú!");
  let ok = true;
  if(micOk(C)){
    C.listening = true;
    const r = await listen({ms: ECHO_LISTEN, lang: code(C.call.lang)});
    C.listening = false;
    ok = alive(C, tok);
    if(ok && r && r.status === "ok" && (r.alts || []).some(a => String(a || "").trim())){
      el.classList.add("heard"); el.querySelector("b").textContent = "¡Te he oído!"; status("¡Te he oído!");
      ok = await wait(900, C, tok);
    }
  } else ok = await wait(ECHO_MS, C, tok);
  el.remove(); if(alive(C, tok)) status("");
  return ok && alive(C, tok);
}
/* escuchar sin preguntar: solo si el micrófono ya tiene permiso (o ya se usó «Dilo» en esta llamada) */
let MIC = "";
try{ if(navigator.permissions && navigator.permissions.query) navigator.permissions.query({name: "microphone"}).then(p => { MIC = p.state; p.onchange = () => { MIC = p.state; }; }, () => {}); }catch(e){}
const micOk = C => !C.noMic && typeof canListen === "function" && canListen() && navigator.onLine !== false && (C.micUsed || MIC === "granted");
const heard = (alts, w) => {
  try{ if(W.vocabReview && typeof vocabReview.matches === "function") return vocabReview.matches(alts, w.word, lang); }catch(e){}
  const n = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  return (alts || []).some(a => (" " + n(a) + " ").includes(" " + n(w.say.replace(ART, "")) + " "));
};
async function hear(){
  const C = CUR; if(!C || C.mode !== "talk" || C.phase !== "wait" || C.listening) return;
  const line = C.call.lines[C.i]; if(!line || !line.a) return;
  ++C.tok; const tok = C.tok;
  stopSpeech(); clearTimeout(C.nudgeT);
  C.listening = true;
  const b = $id("cl-mic"); if(b) b.classList.add("on");
  status("Te escucho…");
  const r = await listen({ms: 6000, lang: code(C.call.lang)});
  C.listening = false;
  if(r.status !== "denied" && r.status !== "unavailable" && r.status !== "unsupported") C.micUsed = true;
  if(b) b.classList.remove("on");
  if(!alive(C, tok) || C.phase !== "wait") return;
  if(r.status === "ok"){ const j = line.a.findIndex(a => heard(r.alts, a.w)); if(j >= 0) return pick(j, "voz"); }
  if(r.status === "aborted") return status("Toca una respuesta");
  if(["denied", "unavailable", "unsupported"].includes(r.status)){ C.noMic = true; micShow(false); return status("Sin micrófono: toca una respuesta."); }
  status("No te he oído bien. Toca una respuesta.");
}

/* ---------- el globo de una palabra clave ---------- */
function openPop(btn){
  const C = CUR; if(!C || C.mode !== "talk" || C.phase === "end") return;
  const k = (C.keys || [])[+btn.dataset.k]; if(!k) return;
  if(!C.resume) C.resume = C.phase;
  ++C.tok; clearTimeout(C.nudgeT); stopSpeech(); light(null);
  if(C.listening) try{ stopListen(); }catch(e){}
  removePop();
  C.popK = k; C.popI = +btn.dataset.k;
  const cd = code(C.call.lang), d = $id("cl-dlg"), p = D.createElement("div");
  p.className = "cl-pop"; p.id = "cl-pop"; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Cómo se dice");
  p.innerHTML = `<button type="button" class="cl-pop-say" id="cl-pop-say" aria-label="Escuchar «${h(k.w.say)}»">${IC("speaker-high", "fill", 24)}</button>
    <span class="cl-pop-t"><b lang="${h(cd)}">${h(k.w.say)}</b>${ipaHtml(k.w.ipa, cd, "cl-pop-ipa")}<small lang="es">${h(k.w.es)}</small></span>
    <button type="button" class="cl-pop-x" id="cl-pop-x" aria-label="Cerrar">${IC("x", "bold", 18)}</button>`;
  d.append(p);
  /* debajo de los subtítulos (no tapa la frase), a la altura de la palabra */
  const r = btn.getBoundingClientRect(), dr = d.getBoundingClientRect(), pw = p.offsetWidth;
  const sub = btn.closest(".cl-sub"), sb = sub ? sub.getBoundingClientRect() : r;
  const x = Math.max(12, Math.min(dr.width - pw - 12, r.left + r.width / 2 - pw / 2 - dr.left));
  p.style.left = x + "px"; p.style.top = (sb.bottom - dr.top + 8) + "px";
  p.style.setProperty("--ax", Math.max(18, Math.min(pw - 18, r.left + r.width / 2 - dr.left - x)) + "px");
  btn.classList.add("now"); btn.setAttribute("aria-expanded", "true");
  try{ $id("cl-pop-say").focus({preventScroll: true}); }catch(e){}
  sayWord(k.w);   /* dentro del toque */
}
function removePop(){
  const p = $id("cl-pop"); if(p) p.remove();
  D.querySelectorAll("#cl-say .cl-k[aria-expanded]").forEach(b => { b.removeAttribute("aria-expanded"); b.classList.remove("now"); });
  if(CUR) CUR.popK = null;
}
function closePop(){
  const C0 = CUR, kb = C0 && D.querySelector(`#cl-say .cl-k[data-k="${C0.popI}"]`);
  removePop();
  if(kb) try{ kb.focus({preventScroll: true}); }catch(e){}   /* el foco vuelve a la palabra */
  keepFocus();
  const C = CUR; if(!C || C.mode !== "talk") return;
  const ph = C.resume; C.resume = null;
  stopSpeech();
  if(ph === "react" || ph === "echo") return step(C.i + 1);
  if(ph === "wait"){ C.phase = "wait"; micShow(true); return; }
  if(ph === "line" || ph === "gap") return replay(false);
}

/* ---------- se acaba ---------- */
function end(){
  const C = CUR; if(!C || C.mode !== "talk" || C.phase === "end") return;
  ++C.tok; C.phase = "end";
  clearTimeout(C.nudgeT); clearInterval(C.clockT); stopSpeech();
  if(C.listening) try{ stopListen(); }catch(e){}
  removePop();
  const secs = Math.max(0, Math.floor((Date.now() - C.t0) / 1000)), full = C.done.size >= C.call.qs;
  const t = D.querySelector("#cl-dlg .cl-talk");
  if(t) t.innerHTML = `<div class="cl-endv"><span class="cl-av big" aria-hidden="true"><img src="${IMG}" alt="" width="256" height="224" draggable="false"></span>
    <h2 id="cl-name" tabindex="-1">Llamada terminada · ${mmss(secs)}</h2><p>Zorro · ${h(C.call.city)}</p></div>`;
  const n = $id("cl-name"); if(n) try{ n.focus({preventScroll: true}); }catch(e){}
  setTimeout(() => {
    const hadRow = !!$id("cl-row");
    closeDlg(C);
    if(full) pay(C.call);
    if(hadRow && onHoy() && typeof route === "function") route();
    if(onList()) paintList();
  }, rm() ? 700 : END_MS);
}
function hangUp(){ const C = CUR; if(!C) return; if(C.mode === "ring") return notNow(); end(); }
/* monedas: una vez por llamada y día, PAID_MAX llamadas pagadas al día como mucho */
function pay(c){
  const s = load(), t = tKey();
  if(s.paid[c.id] === t || Object.values(s.paid).filter(d => d === t).length >= PAID_MAX) return false;
  s.paid[c.id] = t; save(s);
  try{ award(COINS, "¡Llamada del zorro!", false, {x: innerWidth / 2, y: innerHeight * .42}); }catch(e){ console.error(e); }
  return true;
}

/* ---------- «1 llamada perdida» en Hoy ---------- */
let ROW = null;   /* la llamada de la fila, ya cargada (tocarla empieza a hablar dentro del toque) */
async function slot(){
  ROW = null;
  const s = load(); if(s.off || !s.miss || s.miss.id.slice(0, 2) !== abOf()) return null;
  if(daysTo(s.miss.d, tKey()) > MISS_DAYS || daysTo(s.miss.d, tKey()) < 0) return null;
  if(!hasTTS() || (Array.isArray(voices) && voices.length && !voiceOk())) return null;   /* sin la lista aún, sí */
  let c = null; try{ c = await get(s.miss.id); }catch(e){ return null; }
  preload(c); ROW = c;
  return `<button type="button" class="card hm-row cl-row" id="cl-row" data-no-renew aria-label="1 llamada perdida del Zorro, desde ${h(c.city)}. Devolver la llamada">
    <span class="hm-ric cl-ric" aria-hidden="true"><img src="${IMG}" alt="" width="32" height="28" draggable="false"></span>
    <span class="hm-rt">1 llamada perdida<small>Zorro · ${h(c.city)}</small></span>
    <span class="cl-cb" aria-hidden="true">${IC("phone", "fill", 18)}</span></button>`;
}
slot.id = "call";
HOME_SLOTS.push(slot);
function callBack(){
  if(CUR || !ROW) return false;
  const c = ROW;
  CUR = {call: c, mode: "ring", tok: 0};
  dlg();
  talk(c);
  return true;
}
D.addEventListener("click", e => { if(e.target.closest && e.target.closest("#cl-row")) callBack(); });

/* ---------- «Llamar al zorro» (#/llamadas) ---------- */
const onList = () => secOf(hashPath()) === "llamadas";
const LISTC = new Map();   /* id → llamada ya cargada (tocar empieza a hablar dentro del toque) */
let LN = 0, IDXV = null;
function startCall(id){
  if(CUR) return false;
  const c = LISTC.get(id); if(!c) return false;
  CUR = {call: c, mode: "ring", tok: 0};
  dlg();
  talk(c);
  return true;
}
async function paintList(){
  const my = ++LN, L = lang, app = $id("app");
  let ms = [];
  try{ ms = await list(L); }catch(e){ ms = null; }
  if(my !== LN || !onList() || !app) return;
  if(!ms){ app.innerHTML = `<div class="cl-list"><div class="card cl-lerr"><p>No se pudieron cargar las llamadas.</p><a class="glass-btn glass-btn--pri" href="#/juegos">Volver a Juegos</a></div></div>`; return; }
  const got = await Promise.all(ms.map(async m => { try{ const c = await get(m.id); LISTC.set(m.id, c); return {m, c}; }catch(e){ return null; } }));
  if(my !== LN || !onList()) return;
  const s = load(), rows = got.filter(Boolean).map((x, i) => Object.assign(x, {i, heard: !!s.heard[x.m.id]}))
    .sort((a, b) => (a.heard - b.heard) || (a.heard ? (s.heard[a.m.id] || "").localeCompare(s.heard[b.m.id] || "") : 0) || a.i - b.i);
  const mute = !hasTTS() || (Array.isArray(voices) && voices.length > 0 && !voiceOk());
  const city = (rows[0] && rows[0].c.city) || "";
  app.innerHTML = `<div class="cl-list" id="cl-list" data-no-renew>
    <header class="cl-lh"><span class="cl-av cl-lav" aria-hidden="true"><img src="${IMG}" alt="" width="256" height="224" draggable="false"></span>
      <div class="cl-lht"><h1 class="cl-lt">Llamar al zorro</h1><p class="cl-ls">Elige de qué quieres hablar. Zorro te contesta desde ${h(city)}, en ${h(LANGS[L].name)}.</p></div></header>
    ${mute ? `<p class="cl-lnote" role="status">Para hablar con el zorro hace falta la voz del ${h(LANGS[L].name)}. Un mayor puede añadirla en Ajustes › Voz y velocidad.</p>` : ""}
    <ul class="cl-ll">${rows.map(({m, c, heard}) => {
      const q = c.lines.find(l => l.a), pic = q ? q.a[0].w.img : IMG;
      return `<li><button type="button" class="card cl-li${heard ? " is-heard" : ""}" data-id="${h(m.id)}"${mute ? " disabled" : ""} aria-label="${h(m.t)}. ${heard ? "Ya la has oído. " : ""}Llamar">
        <span class="cl-li-pic" aria-hidden="true"><img src="${h(pic)}" alt="" width="64" height="64" draggable="false"></span>
        <span class="cl-li-t" aria-hidden="true"><b>${h(m.t)}</b><small>${heard ? `<span class="cl-li-ok">${CHK} Oída</span>` : "Nueva"}</small></span>
        <span class="cl-cb" aria-hidden="true">${IC("phone", "fill", 20)}</span></button></li>`; }).join("")}</ul></div>`;
  const ul = app.querySelector(".cl-ll");
  if(ul) ul.addEventListener("click", e => { const b = e.target.closest(".cl-li"); if(b && !b.disabled) startCall(b.dataset.id); });
}
ROUTES.llamadas = () => paintList();
ROUTES.llamadas.load = () => list().then(ms => Promise.all(ms.map(m => get(m.id).catch(() => null))));
try{
  const T = TABS.find(t => t.id === "jugar");
  if(T){ if(!T.secs.includes("llamadas")) T.secs.push("llamadas"); const sg = (T.segs || []).find(x => x.h === "#/juegos"); if(sg && !sg.secs.includes("llamadas")) sg.secs.push("llamadas"); }
}catch(e){ console.error(e); }
try{
  if(W.vocabGames && typeof vocabGames.register === "function")
    vocabGames.register("llamar", {t: "Llamar al zorro", sub: "Habla con él por teléfono", img: "img/games/llamar.png", href: "#/llamadas", sec: "mas",
      line: () => { const L = IDXV && IDXV[lang], n = L && Array.isArray(L.calls) ? L.calls.length : 0, hd = load().heard;
        const k = n ? L.calls.filter(c => c && hd[c.id]).length : 0; return !n ? "Elige una llamada" : k ? `Oídas: ${k} de ${n}` : `${n} llamadas`; }});
}catch(e){ console.error(e); }
/* el índice para esa línea, al poco de abrir. Sin conexión solo se pide si un service worker lo da de su copia guardada
   (está en SHELL); si no, se espera al evento online: pedirlo a la red sin conexión deja un error en la consola */
function warm(){
  if(IDXV) return;
  let sw = false;
  try{ sw = !!(navigator.serviceWorker && navigator.serviceWorker.controller); }catch(e){}
  if(navigator.onLine === false && !sw) return;
  index().then(x => { IDXV = x; }, () => {});
}
setTimeout(warm, 600);
addEventListener("online", warm);

/* ---------- Ajustes › Para mayores ---------- */
function adultHtml(){
  const on = !load().off;
  return `<section class="st-sec" aria-labelledby="aj-cl-h"><h3 class="st-h" id="aj-cl-h">Llamadas</h3><div class="st-g ics">
      <label class="st-r" for="aj-cl-on"><span class="st-ic ok" aria-hidden="true">${IC("phone", "bold", 18)}</span>
        <span class="st-l">Llamadas del zorro<small>A veces llama para hablar en el idioma. Como mucho una cada dos días, sin sonido hasta contestar.</small></span>
        <input type="checkbox" role="switch" class="st-sw" id="aj-cl-on" ${on ? "checked" : ""}></label></div></section>`;
}
let DIRTY = false;
bus.on("settings", d => {
  if(d && d.page === null){ if(DIRTY){ DIRTY = false; if(onHoy() && typeof route === "function") route(); } return; }
  if(!d || d.page !== "mayores" || !d.el) return;
  const sw = d.el.querySelector("#aj-cl-on");
  if(sw) sw.onchange = () => { setOff(!sw.checked); DIRTY = true; };
});

/* ---------- avisos ---------- */
bus.on("boot", check);
bus.on("route", () => { if(CUR) return; check(); });
bus.on("voices", () => { if(!CUR && !RINGING) check(); });
let hidAt = 0;
D.addEventListener("visibilitychange", () => {
  if(D.visibilityState === "hidden"){
    hidAt = Date.now();
    const C = CUR;
    if(C && C.mode === "ring") missed(C);
    else if(C && C.mode === "talk" && C.phase !== "end") end();
    return;
  }
  if(hidAt && Date.now() - hidAt >= WAKE_MS) sessNew();
  hidAt = 0;
  check();
});
addEventListener("hashchange", () => { const C = CUR; if(!C) return; if(C.mode === "ring") missed(C); else end(); });

/* ---------- para «Descargar todo» y las pruebas ---------- */
async function files(){
  const x = await index(), out = ["data/calls/index.json"];
  for(const l of Object.keys(LANGS)) (isObj(x[l]) && Array.isArray(x[l].calls) ? x[l].calls : []).forEach(c => out.push("data/calls/" + c.f));
  return out;
}
/* los dibujos que no vienen en los temas (los abuelos de img/calls) y la foto del zorro */
async function images(){
  const set = new Set([IMG]);
  try{
    const fs = (await files()).filter(f => f !== "data/calls/index.json");
    await Promise.all(fs.map(async f => {
      try{ const c = await (await fetch(f)).json(); (c.lines || []).forEach(l => (l.a || []).forEach(a => { if(typeof a.img === "string") set.add(a.img); })); }catch(e){}
    }));
  }catch(e){}
  return [...set];
}
async function ring(id){
  if(CUR || RINGING) return false;
  let c = null;
  try{ c = id ? await get(id) : await pickCall(); }catch(e){ c = null; }
  return !!c && ringCall(c);
}

/* ---------- estilos ---------- */
const CSS = `
/* la llamada: a pantalla completa y oscura (como la del iPhone) en claro y en oscuro; el contenido (subtítulos y
   dibujos) es sólido; los botones redondos flotan */
.cl-dlg{position:fixed;inset:0;box-sizing:border-box;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;overflow:hidden;
  background:linear-gradient(180deg,#123A63 0%,#0B2545 46%,#061A31 100%);color:#fff;font-family:var(--f-text)}
.cl-dlg[open]{display:flex;flex-direction:column}
.cl-dlg::backdrop{background:#061A31}
.cl-dlg[open]{animation:cl-in .28s cubic-bezier(.2,.9,.3,1)}
@keyframes cl-in{from{opacity:0;scale:1.03}}
@keyframes cl-fade{from{opacity:0}}
.cl-dlg :focus-visible{outline:3px solid #fff;outline-offset:3px}
.cl-dlg [tabindex="-1"]:focus{outline:none}
.cl-ring{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:16px;min-height:0;
  padding:calc(var(--safe-t) + 44px) calc(var(--safe-r) + 20px) calc(var(--safe-b) + 28px) calc(var(--safe-l) + 20px);text-align:center}
.cl-who{display:flex;flex-direction:column;align-items:center;gap:6px}
.cl-kick{margin:0;font:500 var(--fs-sub)/1.3 var(--f-text);color:rgba(235,235,245,.78)}
.cl-name{margin:0;font:700 min(calc(2.125rem*var(--k)),40px)/1.15 var(--f-round);letter-spacing:-.01em;color:#fff}
.cl-hi{max-width:320px;margin:4px 0 0;font:500 var(--fs-note)/1.35 var(--f-text);color:rgba(235,235,245,.85);text-wrap:balance}
.cl-pic{position:relative;display:grid;place-items:center;width:min(66vw,280px,38vh);aspect-ratio:1;border-radius:50%;background:#fff;box-shadow:0 18px 50px rgba(0,0,0,.35)}
.cl-pic img{position:relative;z-index:1;width:84%;height:auto;translate:0 3%;-webkit-user-drag:none}
.cl-pic::before,.cl-pic::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:3px solid rgba(255,255,255,.55);opacity:0;pointer-events:none}
.cl-dlg.ringing .cl-pic::before{animation:cl-pulse 2s ease-out 3}
.cl-dlg.ringing .cl-pic::after{animation:cl-pulse 2s ease-out .7s 3}
@keyframes cl-pulse{0%{opacity:.85;scale:1}100%{opacity:0;scale:1.32}}
.cl-acts{display:flex;flex-direction:column;align-items:stretch;gap:16px;width:min(100%,420px)}
.cl-no{align-self:center;min-width:140px;min-height:48px;margin:0;padding:0 28px;border:0;border-radius:24px;background:rgba(255,255,255,.18);color:#fff;
  font:600 var(--fs-head)/1 var(--f-text);cursor:pointer}
.cl-slide{position:relative;display:flex;align-items:center;box-sizing:border-box;width:100%;height:76px;margin:0;padding:8px;border:0;border-radius:38px;
  background:rgba(255,255,255,.18);color:#fff;font:inherit;cursor:pointer;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.cl-knob{position:relative;z-index:1;flex:none;display:grid;place-items:center;width:60px;height:60px;border-radius:50%;background:#008932;color:#fff;
  box-shadow:0 6px 16px rgba(0,0,0,.3);transition:translate .3s cubic-bezier(.3,1.25,.5,1)}
.cl-slide.drag .cl-knob{transition:none}
.cl-sl-t{position:absolute;inset:0;display:grid;place-items:center;padding-left:60px;font:700 min(calc(1.375rem*var(--k)),28px)/1 var(--f-round);pointer-events:none}
.cl-talk{flex:1;min-height:0;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow-y:auto;
  padding:calc(var(--safe-t) + 14px) calc(var(--safe-r) + 12px) calc(var(--safe-b) + 14px) calc(var(--safe-l) + 12px)}
.cl-head{display:flex;align-items:center;gap:12px;padding:0 4px}
.cl-av{flex:none;display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:#fff;overflow:hidden}
.cl-av img{width:86%;height:auto;translate:0 4%}
.cl-av.big{width:132px;height:132px}
.cl-hn{flex:1;min-width:0}
.cl-hn h2{margin:0;font:700 var(--fs-head)/1.2 var(--f-round);color:#fff;outline:none}
.cl-time{display:block;font:500 var(--fs-note)/1.3 var(--f-text);color:rgba(235,235,245,.72);font-variant-numeric:tabular-nums}
.cl-sub{position:relative;box-sizing:border-box;min-height:116px;padding:16px 18px;border-radius:24px;background:var(--card);color:var(--label)}
.cl-say{margin:0;font:700 min(calc(1.375rem*var(--k)),28px)/1.4 var(--f-round);overflow-wrap:break-word}
.cl-es{margin:8px 0 0;min-height:1.35em;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label2);transition:opacity .2s ease}
.cl-es[data-hide]{opacity:0}
.cl-k{display:inline;margin:0 -1px;padding:0 3px;border:0;border-radius:6px;background:var(--gold-soft);color:inherit;font:inherit;line-height:inherit;
  box-shadow:inset 0 -2px 0 var(--gold);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background-color .15s ease}
.cl-k.now{background:var(--gold);color:var(--gold-on)}
.cl-mid{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:12px}
.cl-big{display:flex;flex-direction:column;align-items:center;gap:14px}
.cl-big[hidden]{display:none}
.cl-big .cl-av{width:min(40vw,168px,24vh);height:auto;aspect-ratio:1}
.cl-wave{display:flex;align-items:center;gap:5px;height:22px}
.cl-wave i{display:block;width:6px;height:8px;border-radius:3px;background:rgba(255,255,255,.55)}
.cl-dlg.talking .cl-wave i{animation:cl-bar .9s ease-in-out infinite alternate}
.cl-dlg.talking .cl-wave i:nth-child(2){animation-delay:-.3s}.cl-dlg.talking .cl-wave i:nth-child(3){animation-delay:-.6s}.cl-dlg.talking .cl-wave i:nth-child(4){animation-delay:-.15s}
@keyframes cl-bar{from{height:6px}to{height:22px}}
.cl-ans{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:8px}
.cl-ans[hidden]{display:none}
.cl-a{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;margin:0;padding:6px 6px 10px;border:0;border-radius:20px;
  background:var(--card);color:var(--label);font:inherit;text-align:center;cursor:pointer;-webkit-tap-highlight-color:transparent}
.cl-a img{display:block;box-sizing:border-box;width:100%;max-width:170px;height:auto;aspect-ratio:1;object-fit:contain;padding:4px;border-radius:14px;background:#fff;-webkit-user-drag:none}
.cl-aw{display:block;max-width:100%;margin-top:4px;font:700 calc(1.0625rem*var(--k))/1.2 var(--f-round);white-space:nowrap;hyphens:none}
.cl-a .ipa{display:block;max-width:100%;font-size:var(--fs-min);line-height:1.25;color:var(--label2)}
.cl-a:disabled{cursor:default}
.cl-a.is-ok{box-shadow:0 0 0 3px #008932}
.cl-a.is-pick{box-shadow:0 0 0 3px var(--brand-fill)}
.cl-a.is-miss{background:#D1D1D6;color:#3A3A3C}
.cl-a.is-miss .ipa{color:#48484A}
.cl-a.is-miss img{opacity:.7}
:root[data-theme=dark] .cl-a.is-miss{background:#48484A;color:rgba(235,235,245,.8)}
:root[data-theme=dark] .cl-a.is-miss .ipa{color:rgba(235,235,245,.6)}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .cl-a.is-miss{background:#48484A;color:rgba(235,235,245,.8)}
  :root:not([data-theme=light]) .cl-a.is-miss .ipa{color:rgba(235,235,245,.6)}}
.cl-a.is-dim{opacity:.6;filter:grayscale(1)}
.cl-mk{position:absolute;left:8px;top:8px;z-index:1;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;color:#fff;box-shadow:0 0 0 2px #fff}
.cl-mk.ok{background:#008932}.cl-mk.miss{background:#8E8E93}.cl-mk.pick{background:var(--brand-fill)}
.cl-mk .chk{width:18px;height:18px}
.cl-st{margin:0;min-height:1.4em;text-align:center;font:500 var(--fs-note)/1.4 var(--f-text);color:rgba(235,235,245,.8)}
.cl-ctl{display:flex;justify-content:space-evenly;gap:8px;margin-top:auto;padding-top:4px}
.cl-b{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:64px;margin:0;padding:0;border:0;background:none;color:#fff;
  font:500 var(--fs-min)/1.2 var(--f-text);cursor:pointer;-webkit-tap-highlight-color:transparent}
.cl-b[hidden]{display:none}
.cl-bi{display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.18)}
.cl-b.on .cl-bi{background:#fff;color:#0B2545}
.cl-b.hang .cl-bi{background:#636366}
.cl-endv{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center}
.cl-endv h2{margin:0;font:700 var(--fs-t1)/1.2 var(--f-round);color:#fff;outline:none;font-variant-numeric:tabular-nums}
.cl-endv p{margin:0;font:500 var(--fs-sub)/1.3 var(--f-text);color:rgba(235,235,245,.75)}
.cl-pop{position:absolute;z-index:3;display:flex;align-items:center;gap:10px;box-sizing:border-box;max-width:min(340px,calc(100% - 24px));padding:8px 2px 8px 8px;
  border-radius:18px;background:var(--card);color:var(--label);box-shadow:0 12px 32px rgba(0,0,0,.4);text-align:left}
.cl-pop::before{content:"";position:absolute;left:var(--ax,50%);top:-6px;width:14px;height:14px;margin-left:-7px;border-radius:2px;background:inherit;rotate:45deg}
.cl-pop-t{flex:1;min-width:0}
.cl-pop b{display:block;font:700 var(--fs-head)/1.2 var(--f-round)}
.cl-pop .ipa{display:block;font-size:var(--fs-note);color:var(--label2)}
.cl-pop small{display:block;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.cl-pop-say{flex:none;display:grid;place-items:center;width:48px;height:48px;margin:0;padding:0;border:0;border-radius:50%;background:var(--brand-fill);color:#fff;cursor:pointer}
.cl-pop-x{flex:none;display:grid;place-items:center;width:44px;height:44px;margin:0;padding:0;border:0;background:none;color:var(--label2);cursor:pointer}
/* «Dilo conmigo»: la boca que late */
.cl-echo{display:flex;align-items:center;justify-content:center;gap:12px;align-self:center;min-height:64px;padding:8px 22px 8px 12px;border-radius:32px;background:#fff;color:#0B2545;
  box-shadow:0 8px 24px rgba(0,0,0,.25);font:800 min(calc(1.375rem*var(--k)),28px)/1.1 var(--f-round)}
.cl-echo.heard{background:#E3F6EA}
/* con «¡Dilo tú!» a la vista, el aviso (role=status) solo para el lector de pantalla: no se repite escrito */
.cl-mid:has(.cl-echo) .cl-st{position:absolute;width:1px;height:1px;min-height:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.cl-mouth{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:#FFE7A3;animation:cl-talk .55s ease-in-out infinite alternate}
@keyframes cl-talk{from{scale:.86}to{scale:1.08}}
/* «Llamar al zorro» */
.cl-list{display:grid;gap:14px;max-width:640px;margin:0 auto}
.cl-lh{display:flex;align-items:center;gap:14px;padding:0 4px}
.cl-lav{width:72px;height:72px;box-shadow:inset 0 0 0 1px var(--fill)}
.cl-lht{flex:1;min-width:0}
.cl-lt{margin:0;font:800 var(--fs-t1)/1.15 var(--f-round);color:var(--label)}
.cl-ls{margin:4px 0 0;color:var(--label2);font:400 var(--fs-sub)/1.35 var(--f-text)}
.cl-lnote{margin:0;padding:10px 14px;border-radius:var(--r-md);background:var(--fill2);color:var(--label);font:400 var(--fs-note)/1.4 var(--f-text)}
.cl-ll{display:grid;gap:10px;margin:0;padding:0;list-style:none}
.cl-li{display:flex;align-items:center;gap:12px;width:100%;min-height:84px;margin:0;padding:10px 14px 10px 10px;border:0;border-radius:var(--r-card);background:var(--card);color:var(--label);
  font:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}
.cl-li:disabled{cursor:default;opacity:.55}
.cl-li:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.cl-li-pic{flex:none;display:grid;place-items:center;width:64px;height:64px;border-radius:16px;background:#fff;box-shadow:inset 0 0 0 1px var(--fill)}
.cl-li-pic img{width:56px;height:56px;object-fit:contain}
.cl-li-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.cl-li-t b{font:800 var(--fs-head)/1.2 var(--f-round);overflow-wrap:anywhere}
.cl-li-t small{color:var(--label2);font:600 var(--fs-note)/1.3 var(--f-text)}
.cl-li-ok{display:inline-flex;align-items:center;gap:4px;color:var(--ok-ink)}
.cl-li-ok .chk{width:14px;height:14px}
.cl-li .cl-cb{width:44px;height:44px;background:var(--ok-fill);color:#fff}
.cl-lerr{padding:20px;text-align:center}
/* la fila de Hoy */
.cl-ric{background:#fff;overflow:hidden;box-shadow:inset 0 0 0 1px var(--fill)}
.cl-ric img{width:30px;height:auto;translate:0 2px}
.cl-cb{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--ok-soft);color:var(--ok-ink)}
@media (prefers-reduced-motion:reduce){
  .cl-dlg[open]{animation:cl-fade .14s ease}
  .cl-dlg.ringing .cl-pic::before,.cl-dlg.ringing .cl-pic::after{animation:none}
  .cl-knob{transition:translate .12s ease}.cl-es,.cl-k{transition-duration:.12s}
  .cl-dlg.talking .cl-wave i{animation:none;height:14px}
  .cl-mouth{animation:none}
}
:root[data-motion=calm] .cl-mouth{animation:none}
:root[data-motion=calm] .cl-dlg.talking .cl-wave i{animation:none;height:14px}
:root[data-motion=calm] .cl-dlg[open]{animation:cl-fade .14s ease}
:root[data-motion=calm] .cl-dlg.ringing .cl-pic::before,:root[data-motion=calm] .cl-dlg.ringing .cl-pic::after{animation:none}
:root[data-motion=calm] .cl-knob{transition:translate .12s ease}
:root[data-motion=calm] .cl-es,:root[data-motion=calm] .cl-k{transition-duration:.12s}
@media (forced-colors:active){.cl-k{border:1px solid CanvasText}.cl-a.is-ok,.cl-a.is-pick{outline:3px solid Highlight}}
`;
if(!$id("css-calls")){ const st = D.createElement("style"); st.id = "css-calls"; st.textContent = CSS; D.head.append(st); }

W.vocabCalls = Object.freeze({KEY, CHANCE, GAP, state: load, blocked, calm, check, ring, answer, pick: j => pick(j, "toque"), replay, hangUp, notNow, callBack,
  list, get, setOff, slot, adultHtml, images, files, mix, call: startCall, get current(){ const C = CUR; if(!C) return null;
    const l = C.mode === "talk" && C.call.lines[C.i];
    return {id: C.call.id, mode: C.mode, i: C.i, phase: C.phase, answered: C.done ? C.done.size : 0, qs: C.call.qs,
      ok: l && l.a ? (typeof l.ok === "number" ? l.ok : -1) : null}; }});
})();
