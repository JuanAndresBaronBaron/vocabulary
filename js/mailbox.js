/* módulo mailbox: el «Buzón del tío» (SPEC §5-F · ideas-viabilidad, fila 6, plan A: sin Drive ni servidor).
   El niño graba un mensaje de voz corto en el idioma que aprende y se lo manda a quien quiera con el menú de compartir
   del aparato; un mayor contesta con una carta que viaja dentro de un enlace y que trae un regalo o un candado.
   Pantallas (de la pestaña Jugar; la cápsula de arriba dice «‹ Juegos» o «‹ Buzón»):
   - #/buzon: 4 frases para empezar (dibujo, la frase en el idioma con su altavoz, que lee la voz del navegador, y en
     español; teclas 1-4), el botón grande de grabar (MediaRecorder: audio/mp4 si el navegador lo graba, si no
     audio/webm; 20 s como mucho, con un anillo que se vacía y los segundos que quedan; se para cuando quiera). Antes de
     pedir el micrófono, una frase dice para qué. Sin micrófono o con el permiso denegado, una frase amable y nada se
     rompe. Al parar: se guarda sola (menos de 0,8 s es «Muy cortito») y salen «Escucharme», «Otra vez» (la borra y
     graba de nuevo) y «Mandar»: Web Share con el archivo si navigator.canShare({files}) lo deja; si no, se descarga y
     una hoja enseña el texto con «Copiar». El texto: «Un mensaje de <nombre> desde la app Vocabulary. Para contestar
     con una carta, abre: <app>#/buzon/responder». Debajo, «Tus grabaciones» (las 5 últimas: oír y mandar), «Cartas»
     (también las abiertas, para releerlas) y «Pegar el enlace de una carta» (por si se abrió en otro navegador, como
     pasa con la app instalada en el iPhone: Safari y la app no comparten lo guardado).
   - #/buzon/responder (para mayores; antes, una tarjeta dice para qué es y «Soy mayor» abre la Puerta de mayores;
     desde Ajustes › Para mayores entra sin volver a preguntar): de quién, para quién (opcional), idioma, mensaje (280 letras como mucho) y O un regalo (20 o 50
     monedas, o un adorno de la granja: vocabShop farm de 150 o menos que no sea un animal) O un candado («al terminar
     3 lecciones», «al repasar 30 palabras» o «tras 3 días seguidos practicando», del idioma elegido). Crea el enlace
     y lo comparte (Web Share) o lo copia.
   - #/carta?d=<base64url> recibe la carta: se valida y se limpia (versión, tamaños, solo valores de las listas
     cerradas; el texto nunca va por innerHTML), se guarda y ?d= se quita con history.replaceState (queda
     #/carta/<id>). #/carta/<id>: el sobre cerrado y «Abrir la carta» → el sobre se abre (sin movimiento con «Reducir
     movimiento»), la voz del navegador lee el mensaje (en el idioma de la carta si el texto lo parece; si no, en
     español) y luego sale el regalo: award(n, "Regalo de <de>", false, desde) o vocabShop.gift(id), una sola vez por
     carta (también al recargar, al abrir dos veces el mismo enlace y en otro aparato con la partida sincronizada). Con
     candado: el sobre gris con su candado, lo que pide y una barra de progreso que cuenta desde que llegó (lecciones
     del camino nuevas en map:<idioma>, repasos en srs:<idioma>.n, días seguidos en "act"); cuando se cumple, se abre
     como las demás (las de candado no traen regalo: la carta es la sorpresa).
   - Hoy: HOME_SLOTS con id "mail" (va el primero): una fila con el sobre solo si hay una carta sin abrir o un candado
     recién abierto; el sobre tiembla 3 veces al entrar (nada con «Reducir movimiento») y tocarla abre la carta.
   - Juegos: la tarjeta «Buzón del tío» (vocabGames.register con href: solo lleva a #/buzon).
   - Ajustes › Para mayores: «Contestar una carta del Buzón» y, solo si hay grabaciones o fotos, «Borrar grabaciones y
     fotos» (con un segundo toque para confirmar), que borra la base de datos IndexedDB entera.
   El enlace: <app>#/carta?d=<base64url del JSON en UTF-8, sin =>, con JSON = {v: 1, id: [A-Za-z0-9_-]{8,24} (12 al
     azar), from: texto de 1 a 24, to?: texto de hasta 24, msg: texto de 1 a 280 (con saltos de línea), lang: "en" |
     "fr" | "da", y uno solo de gift: 20 | 50 | "<id de un adorno>" o lock: "les3" | "rev30" | "days3"}.
   Guardado:
     localStorage "mail:box" (EXACT en js/save.js: va en la partida exportada y en Google Drive) = {v: 1, l: [cartas,
       la más nueva primero, 30 como mucho: al pasar se quita la abierta más vieja], paid: [ids de las cartas ya
       abiertas del todo: con su regalo dado, 300 como mucho]}; cada carta = la del enlace + {at: día en que llegó,
       o: día en que se abrió | "", u: día en que se abrió su candado | "", b: la cuenta de su candado al llegar}.
       Solo se escribe al recibir o abrir una carta (mirar no escribe).
     IndexedDB "vocab-media-user" (versión 1, almacén "media", keyPath "id", índice "kind"): solo de este aparato,
       nunca se exporta ni se sube. Cada cosa = {id, kind ("mail"; F6: "parrot", "capsule", "photo"…), t (ms), type
       (MIME), dur (ms), buf (ArrayBuffer: Safari guarda mal los Blob), tpl?, lang?, sent?}. Del Buzón se quedan las 5
       últimas. Se pide navigator.storage.persist() al guardar la primera (sin avisos: no si ya lo está, ni en Firefox).
   Para otros módulos y pruebas:
     window.vocabMedia = {DB, VER, STORE, ok(), put(cosa), get(id), list(kind?) (la más nueva primero), del(id),
       count(kind?), stats() → {n, audio, photo, kinds}, keep(kind, n) (borra las más viejas), clear() (cierra y borra
       la base), persist()} (todo con promesas).
     window.vocabMailbox = {box(), letters(), clean(obj), encode(obj), decode(d), link(obj), receive(obj), open(id),
       pay(id, desde), lockState(carta), unread(), adornos(), shareText(), slot, adultHtml(), mediaHtml(), images(), TPL, LOCKS,
       KEY}. Emite bus "mail-new" {id} · "mail-open" {id} · "gift-open" {item} (adorno regalado). */
(() => {
"use strict";
const W = window, D = document;
const KEY = "mail:box", MAXL = 30, MAXPAID = 300;
const MAXREC = 5, MAXMS = 20000, MINMS = 800;
const LK = Object.freeze({en: "english", fr: "français", da: "dansk"});
const AB = Object.freeze({english: "en", "français": "fr", dansk: "da"});
const COINS = Object.freeze([20, 50]);
const ANIM0 = ["gallina", "pato", "conejo", "abeja", "cerdo", "oveja", "cabra", "pavo", "vaca", "burro", "caballo"];
const ID_RE = /^[A-Za-z0-9_-]{8,24}$/, DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const IMG = {env: "img/om_2709.png", box: "img/games/buzon.png", coin: "img/om_1FA99.png", lock: "img/om_1F512.png", gift: "img/om_1F381.png"};

/* ---------- utilidades ---------- */
const IC = (n, s = "bold", z = 20, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const $id = id => D.getElementById(id);
const rm = () => !!(W.M && typeof M.rm === "function" && M.rm());
const day = (d = new Date()) => typeof dayKey === "function" ? dayKey(d) : d.toLocaleDateString("sv");
const curAb = () => AB[lang] || "en";
const lname = l => ((typeof LANGS !== "undefined" && LANGS[LK[l]]) || {}).name || "";
const kidName = () => { try{ return String(game().name || "").trim(); }catch(e){ return ""; } };
const appUrl = () => location.origin + location.pathname;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const txt = (root, sel, s) => { const el = root && root.querySelector(sel); if(el) el.textContent = s; return el; };
const notice = (t, icon) => { try{ if(W.M && typeof M.toast === "function") M.toast(t, icon ? {icon} : {}); }catch(e){} };
function rid(n){
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let a; try{ a = crypto.getRandomValues(new Uint8Array(n)); }catch(e){ a = Array.from({length: n}, () => Math.floor(Math.random() * 256)); }
  return Array.from(a, x => A[x & 63]).join("");
}
function unlockVoice(){ try{ if(!("speechSynthesis" in W)) return; const u = new SpeechSynthesisUtterance(" "); if(typeof useVoice === "function") useVoice(u, lang); speechSynthesis.speak(u); }catch(e){} }
/* iPhone o iPad fuera de la app instalada (Safari, o el navegador de dentro de otra app): no comparte lo guardado con
   la app de la pantalla de inicio */
const iosBrowser = () => { try{ return typeof IOS !== "undefined" && !!IOS && !(typeof iosPWA === "function" && iosPWA()); }catch(e){ return false; } };
/* una partida que parece recién empezada (ningún día practicado ni palabras en el repaso de ningún idioma) */
function freshSave(){
  try{
    const a = store.get("act", {}); if(isObj(a) && Object.keys(a).length) return false;
    return Object.values(LK).every(L => { const m = store.get("srs:" + L, {}); return !isObj(m) || !Object.keys(m).length; });
  }catch(e){ return false; }
}
const when = t => {
  const d = new Date(t), k = day(d), h = day(), y = new Date(); y.setDate(y.getDate() - 1);
  return k === h ? "hoy" : k === day(y) ? "ayer" : d.toLocaleDateString("es-ES", {day: "numeric", month: "long"});
};

/* ---------- IndexedDB: lo grabado (solo de este aparato) ---------- */
const Media = (() => {
  const DB = "vocab-media-user", VER = 1, STORE = "media";
  let dbp = null, asked = false;
  const ok = () => { try{ return typeof indexedDB !== "undefined" && !!indexedDB; }catch(e){ return false; } };
  function open(){
    if(!ok()) return Promise.reject(new Error("IndexedDB no está disponible"));
    if(dbp) return dbp;
    dbp = new Promise((res, rej) => {
      let r; try{ r = indexedDB.open(DB, VER); }catch(e){ rej(e); return; }
      r.onupgradeneeded = () => {
        const d = r.result;
        if(!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, {keyPath: "id"}).createIndex("kind", "kind");
      };
      r.onsuccess = () => {
        const d = r.result;
        d.onversionchange = () => { try{ d.close(); }catch(e){} dbp = null; };   /* otra pestaña la borra o la sube */
        d.onclose = () => { dbp = null; };
        res(d);
      };
      r.onerror = () => rej(r.error || new Error("No se pudo abrir"));
      r.onblocked = () => rej(new Error("La base de datos está ocupada"));
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }
  /* una transacción: fn(almacén) devuelve una petición (o nada); se resuelve con su resultado al completarse */
  const tx = (mode, fn) => open().then(d => new Promise((res, rej) => {
    let t, q; try{ t = d.transaction(STORE, mode); q = fn(t.objectStore(STORE)); }catch(e){ rej(e); return; }
    t.oncomplete = () => res(q && "result" in q ? q.result : undefined);
    t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("Cancelado"));
  }));
  const put = x => isObj(x) && typeof x.id === "string" && x.id && typeof x.kind === "string" ? tx("readwrite", s => s.put(x)) : Promise.reject(new TypeError("Falta id o kind"));
  const get = id => tx("readonly", s => s.get(String(id)));
  const del = id => tx("readwrite", s => s.delete(String(id)));
  const list = kind => tx("readonly", s => kind ? s.index("kind").getAll(String(kind)) : s.getAll())
    .then(a => (a || []).sort((x, y) => (+y.t || 0) - (+x.t || 0)));
  const count = kind => tx("readonly", s => kind ? s.index("kind").count(String(kind)) : s.count());
  /* cuántas de cada tipo, sin cargar los audios ni las fotos */
  const stats = () => open().then(d => new Promise((res, rej) => {
    const kinds = {}; let t;
    try{ t = d.transaction(STORE, "readonly"); const c = t.objectStore(STORE).index("kind").openKeyCursor();
      c.onsuccess = () => { const k = c.result; if(k){ kinds[k.key] = (kinds[k.key] || 0) + 1; k.continue(); } }; }catch(e){ rej(e); return; }
    t.oncomplete = () => {
      const n = Object.values(kinds).reduce((a, b) => a + b, 0), photo = kinds.photo || 0;
      res({n, photo, audio: n - photo, kinds});
    };
    t.onerror = () => rej(t.error);
  }));
  /* deja las n más nuevas de un tipo; devuelve los ids borrados */
  const keep = (kind, n) => tx("readonly", s => s.index("kind").getAllKeys(String(kind))).then(async ids => {
    if(!ids || ids.length <= n) return [];
    const all = await list(kind), out = all.slice(Math.max(0, n)).map(x => x.id);
    await tx("readwrite", s => { out.forEach(id => s.delete(id)); });
    return out;
  });
  /* todo fuera: cierra la conexión y borra la base entera */
  function clear(){
    const p0 = dbp ? dbp.then(d => { try{ d.close(); }catch(e){} }, () => {}) : Promise.resolve();
    dbp = null;
    return p0.then(() => new Promise((res, rej) => {
      if(!ok()){ res(true); return; }
      let r; try{ r = indexedDB.deleteDatabase(DB); }catch(e){ rej(e); return; }
      r.onsuccess = () => res(true); r.onerror = () => rej(r.error || new Error("No se pudo borrar"));
    }));
  }
  /* que el navegador no borre lo grabado cuando le falte sitio (se pide una vez por sesión). Sin avisos delante del
     niño: si ya lo está, no se pide; Firefox lo pregunta con un aviso, así que ahí no se pide (lo pide js/save.js). */
  function persist(){
    if(asked) return Promise.resolve(null); asked = true;
    try{
      const S = navigator.storage;
      if(!S || typeof S.persist !== "function") return Promise.resolve(false);
      if(/\bFirefox\//.test(navigator.userAgent || "")) return Promise.resolve(false);
      const was = typeof S.persisted === "function" ? S.persisted().catch(() => false) : Promise.resolve(false);
      return was.then(p => p ? true : S.persist().catch(() => false));
    }catch(e){}
    return Promise.resolve(false);
  }
  return Object.freeze({DB, VER, STORE, ok, put, get, del, list, count, stats, keep, clear, persist});
})();
W.vocabMedia = Media;
let MEDIA = {n: 0, audio: 0, photo: 0};   /* lo que hay en IndexedDB (para Ajustes y la tarjeta de Juegos, sin esperar) */
const refreshMedia = () => Media.stats().then(s => { MEDIA = s; return s; }, () => MEDIA);

/* ---------- las frases para empezar ---------- */
const TPL = Object.freeze([
  {id: "hola", img: "img/om_1F44B.png", t: "Saludar", es: "Hola, me llamo…",
    w: {en: "Hello! My name is…", fr: "Bonjour ! Je m’appelle…", da: "Hej! Jeg hedder…"}},
  {id: "animal", img: "img/om_1F436.png", t: "Mi animal", es: "Mi animal favorito es…",
    w: {en: "My favourite animal is…", fr: "Mon animal préféré, c’est…", da: "Mit yndlingsdyr er…"}},
  {id: "hoy", img: "img/om_1F4A1.png", t: "Qué aprendí", es: "Hoy he aprendido…",
    w: {en: "Today I learned…", fr: "Aujourd’hui, j’ai appris…", da: "I dag har jeg lært…"}},
  {id: "color", img: "img/om_1F308.png", t: "Mi color", es: "Mi color favorito es…",
    w: {en: "My favourite colour is…", fr: "Ma couleur préférée, c’est…", da: "Min yndlingsfarve er…"}},
].map(t => Object.freeze(Object.assign(t, {w: Object.freeze(t.w)}))));
let TPLID = TPL[0].id;
const tplOf = id => TPL.find(t => t.id === id) || TPL[0];

/* ---------- los candados ---------- */
const LOCKS = Object.freeze({
  les3: Object.freeze({n: 3, one: "lección", many: "lecciones", t: l => `Se abre al terminar 3 lecciones de ${lname(l)}`,
    go: "#/mapa", btn: "Ir al Camino", ic: "map-trifold", form: l => `Al terminar 3 lecciones de ${lname(l)}`}),
  rev30: Object.freeze({n: 30, one: "palabra", many: "palabras", t: l => `Se abre al repasar 30 palabras de ${lname(l)}`,
    go: "#/repaso", btn: "Ir a Repasar", ic: "arrow-counter-clockwise", form: l => `Al repasar 30 palabras de ${lname(l)}`}),
  days3: Object.freeze({n: 3, one: "día", many: "días", t: () => "Se abre cuando practiques 3 días",
    go: "#/mapa", btn: "Practicar ahora", ic: "flame", form: () => "Al practicar 3 días (no hace falta seguidos)"}),
});
const lessons = L => { const m = store.get("map:" + L, {}); return isObj(m) ? Object.values(m).filter(v => +v > 0).length : 0; };
function reviews(L){
  const m = store.get("srs:" + L, {}); let n = 0;
  if(isObj(m)) for(const x of Object.values(m)) if(isObj(x)) n += Math.max(0, Math.floor(+x.n) || 0);
  return n;
}
const countOf = (lock, l) => lock === "les3" ? lessons(LK[l]) : lock === "rev30" ? reviews(LK[l]) : 0;
/* días distintos con actividad desde el día en que llegó (ese incluido); no hace falta que sean seguidos */
function daysFrom(at){
  const a = store.get("act", {}); if(!isObj(a)) return 0;
  return Object.keys(a).filter(k => DAY_RE.test(k) && k >= at && +a[k] > 0).length;
}
function lockState(L){
  const K = L && LOCKS[L.lock]; if(!K) return null;
  const raw = L.lock === "days3" ? daysFrom(L.at) : countOf(L.lock, L.lang) - (L.b || 0);
  const have = L.u ? K.n : Math.max(0, Math.min(K.n, raw));
  return {lock: L.lock, need: K.n, have, done: !!L.u || have >= K.n, text: K.t(L.lang), unit: have === 1 ? K.one : K.many,
    units: K.many, go: K.go, btn: K.btn, ic: K.ic, lang: L.lock === "days3" ? "" : L.lang};
}

/* ---------- validar y limpiar ---------- */
/* fuera: controles (menos el salto de línea), marcas de dirección y caracteres invisibles */
const CTRL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F­؜᠎​‎‏‪-‮⁠-⁤⁦-⁯﻿￹-￻]/g;
function cleanText(s, max, lines){
  if(typeof s !== "string" || s.length > max * 4 + 16) return null;
  let t = s.normalize ? s.normalize("NFC") : s;
  t = t.replace(/\r\n?/g, "\n").replace(/\t/g, " ").replace(CTRL, "");
  t = lines ? t.split("\n").map(x => x.replace(/ {2,}/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n")
    : t.replace(/\s+/g, " ");
  t = t.trim();
  return t && [...t].length <= max ? t : null;
}
const animals = () => { try{ const k = W.farmMount && farmMount.kinds; if(k && k.animal && k.animal.length) return new Set(k.animal); }catch(e){} return new Set(ANIM0); };
/* los adornos que se pueden regalar: cosas de la granja de 150 monedas o menos que no son animales (en su orden) */
function adornos(){
  let list = [];
  try{ list = W.vocabShop && typeof vocabShop.items === "function" ? vocabShop.items("farm") : (Array.isArray(SHOP) ? SHOP.filter(x => x.t === "farm") : []); }catch(e){ list = []; }
  const an = animals();
  return list.filter(it => it && typeof it.id === "string" && typeof it.p === "number" && it.p <= 150 && !an.has(it.id));
}
const okGift = (g, strict) => typeof g === "number" ? COINS.includes(g)
  : typeof g === "string" && /^[a-z]{2,16}$/.test(g) && (!strict || adornos().some(it => it.id === g));
/* la carta tal como viaja en el enlace: null si algo no vale. strict: el adorno tiene que estar en la tienda */
function clean(o, strict = true){
  if(!isObj(o) || o.v !== 1) return null;
  if(typeof o.id !== "string" || !ID_RE.test(o.id)) return null;
  const from = cleanText(o.from, 24, false); if(!from) return null;
  let to = "";
  if(o.to != null && o.to !== ""){ to = cleanText(o.to, 24, false); if(!to) return null; }
  const msg = cleanText(o.msg, 280, true); if(!msg) return null;
  if(typeof o.lang !== "string" || !has(LK, o.lang)) return null;
  const hg = has(o, "gift") && o.gift != null, hl = has(o, "lock") && o.lock != null;
  if(hg === hl) return null;   /* o un regalo o un candado: uno y solo uno */
  const out = {v: 1, id: o.id, from};
  if(to) out.to = to;
  out.msg = msg; out.lang = o.lang;
  if(hg){ if(!okGift(o.gift, strict)) return null; out.gift = o.gift; }
  else { if(typeof o.lock !== "string" || !has(LOCKS, o.lock)) return null; out.lock = o.lock; }
  return out;
}
/* base64url del JSON en UTF-8 (sin =) */
function b64e(s){
  const u = new TextEncoder().encode(s); let bin = "";
  for(let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64d(s){
  if(typeof s !== "string" || !/^[A-Za-z0-9_-]{8,2400}$/.test(s) || s.length % 4 === 1) return null;
  const t = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  let bin; try{ bin = atob(t); }catch(e){ return null; }
  const u = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  try{ return new TextDecoder("utf-8", {fatal: true}).decode(u); }catch(e){ return null; }
}
const encode = o => { const c = clean(o, true); return c ? b64e(JSON.stringify(c)) : null; };
function decode(d){
  const s = b64d(d); if(s == null || s.length > 2000) return null;
  let o; try{ o = JSON.parse(s); }catch(e){ return null; }
  return clean(o, true);
}
const link = o => { const e = encode(o); return e ? `${appUrl()}#/carta?d=${e}` : null; };

/* ---------- el buzón guardado (mail:box) ---------- */
function stored(x){
  const c = isObj(x) ? clean(x, false) : null; if(!c) return null;
  const L = Object.assign(c, {at: DAY_RE.test(x.at) ? x.at : day(), o: DAY_RE.test(x.o) ? x.o : "", u: DAY_RE.test(x.u) ? x.u : ""});
  if(L.lock) L.b = Math.max(0, Math.floor(+x.b) || 0);
  return L;
}
function box(){
  const raw = store.get(KEY, null), b = {v: 1, l: [], paid: [], pd: ""};
  if(!isObj(raw)) return b;
  const seen = new Set();
  for(const x of Array.isArray(raw.l) ? raw.l : []){ const L = stored(x); if(L && !seen.has(L.id)){ seen.add(L.id); b.l.push(L); } }
  b.paid = [...new Set((Array.isArray(raw.paid) ? raw.paid : []).filter(id => typeof id === "string" && ID_RE.test(id)))];
  if(DAY_RE.test(raw.pd)) b.pd = raw.pd;
  return b;
}
function saveBox(b){
  while(b.l.length > MAXL){   /* poda: la abierta más vieja; si ninguna está abierta, la más vieja */
    let k = -1; for(let i = b.l.length - 1; i >= 0; i--) if(b.l[i].o){ k = i; break; }
    b.l.splice(k < 0 ? b.l.length - 1 : k, 1);
  }
  const o = {v: 1, l: b.l, paid: b.paid.slice(-MAXPAID)};
  if(b.pd) o.pd = b.pd;
  store.set(KEY, o);
}
/* como mucho un regalo al día en este aparato (y en los que comparten la partida): el de una carta que llega cuando
   ya se dio el de hoy se guarda para otro día */
const giftToday = b => b.pd === day();
/* las cartas abiertas con el regalo aún por dar (porque hoy ya llegó otro) */
const waitingGift = b => b.l.filter(L => L.o && L.gift != null && !b.paid.includes(L.id));
const letters = () => box().l;
/* una carta del enlace entra en el buzón (si ya estaba, no cambia nada) */
function receive(o){
  const c = clean(o, true); if(!c) return null;
  const b = box(), old = b.l.find(x => x.id === c.id);
  if(old) return {letter: old, fresh: false};
  const L = Object.assign({}, c, {at: day(), o: "", u: ""});
  if(L.lock) L.b = countOf(L.lock, L.lang);
  if(b.paid.includes(L.id)) L.o = L.at;   /* ya se abrió antes (y se podó): llega abierta y sin otro regalo */
  b.l.unshift(L); saveBox(b);
  bus.emit("mail-new", {id: L.id});
  return {letter: L, fresh: true};
}
/* ¿algún candado se cumplió? (se apunta el día una vez: así sigue abierto aunque luego baje la racha) */
function unlockDue(b){
  let ch = false;
  for(const L of b.l) if(L.lock && !L.u && !L.o){ const s = lockState(L); if(s && s.done){ L.u = day(); ch = true; } }
  if(ch) saveBox(b);
  return b;
}
const openable = L => !L.o && (!L.lock || !!L.u);
function unread(){ const b = box(); if(!b.l.length) return []; return unlockDue(b).l.filter(openable); }
/* abre la carta: se guarda antes de cualquier regalo */
function open(id){
  const b = box(), L = b.l.find(x => x.id === id); if(!L) return null;
  if(L.lock && !L.u){ const s = lockState(L); if(!s || !s.done) return null; L.u = day(); }
  const first = !L.o;
  if(first) L.o = day();
  if(L.gift == null && !b.paid.includes(L.id)) b.paid.push(L.id);
  saveBox(b);
  if(first) bus.emit("mail-open", {id: L.id});
  return L;
}
/* el regalo de una carta abierta, una sola vez: primero se apunta en paid y se guarda, luego se da. Si hoy ya llegó un
   regalo, este espera: {later: true} (se da al abrirla otro día). Las monedas vuelan desde from sin aviso (la tarjeta
   ya dice de quién son); sin from, sale el aviso. */
const OWNED_COINS = 20;
function pay(id, from){
  const b = box(), L = b.l.find(x => x.id === id);
  if(!L || !L.o || L.gift == null || b.paid.includes(L.id)) return null;
  if(giftToday(b)) return {later: true};
  b.paid.push(L.id); b.pd = day(); saveBox(b);
  const el = from && from.isConnected ? from : null, why = el ? "" : `Regalo de ${L.from}`;
  if(typeof L.gift === "number"){
    award(L.gift, why, false, el);
    return {coins: L.gift};
  }
  const it = adornos().find(x => x.id === L.gift);
  if(!it) return {none: true};
  const r = W.vocabShop && typeof vocabShop.gift === "function" ? vocabShop.gift(it.id) : {ok: false, reason: "unknown"};
  if(r && r.ok){ bus.emit("gift-open", {item: it}); return {item: it}; }
  /* ya lo tenía (quien escribe no sabe qué hay en la granja): a cambio, unas monedas */
  if(r && r.reason === "owned"){ award(OWNED_COINS, why, false, el); return {item: it, had: true, coins: OWNED_COINS}; }
  return {item: it};
}

/* ---------- la voz: ¿en qué idioma está el mensaje? ---------- */
const SW = {
  es: "el los las un una unos unas y que del con por para eres estás está muy mucho mucha mi mis tú hola gracias besos beso abrazo abrazos quiero sigue así bien hoy campeón campeona querido querida tío tía cariño qué cómo pero también estoy orgulloso orgullosa feliz guapo guapa",
  en: "the and you your to is are of in it my i love hello hi very well done keep great so proud we this that have be with for good am going",
  fr: "le les et je des une est pour avec bravo bonjour salut mon ma mes ton ta tes très bien bisous suis fier fière continue c'est c’est nous vous t'aime t’aime",
  da: "og du dig jeg er det at et til med på hej godt gået meget min mit din dit kram elsker fortsæt sådan flot stolt af ikke har vi",
};
const ACC = {es: /[ñ¿¡áíóú]/g, fr: /[àâçèêëîïôûùœ]/g, da: /[æøå]/g};
/* el idioma que más se parece (inglés, francés, danés o español: el tío puede escribir en cualquiera, no solo en el
   que aprende el niño); en un empate gana el de la carta y, sin pistas, el español */
const SWS = Object.fromEntries(Object.entries(SW).map(([k, v]) => [k, new Set(v.split(" "))]));
function msgLang(msg, l){
  const s = String(msg || "").toLowerCase(), words = s.match(/[\p{L}'’]+/gu) || [];
  const sc = {};
  for(const k of Object.keys(SWS)){
    let n = 0;
    for(const w of words) if(SWS[k].has(w) && !Object.keys(SWS).some(o => o !== k && SWS[o].has(w))) n++;
    sc[k] = n + 2 * (s.match(ACC[k] || /$^/g) || []).length;
  }
  const best = Math.max(...Object.values(sc));
  if(best <= 0) return "es";
  return sc[l] === best ? l : Object.keys(sc).find(k => sc[k] === best);
}
const codeOf = ab => ab === "es" ? "es-ES" : ((typeof LANGS !== "undefined" && LANGS[LK[ab]]) || {}).code || "en-GB";
/* la voz: la de index.html (useVoice: para en-GB, fr-FR y da-DK la elegida en este aparato en Ajustes › Voz y velocidad
   para ESE idioma, o «Automática»; para es-ES, la mejor voz española). pickVoice queda solo por si index.html no la tiene */
function pickVoice(code){
  try{ if(typeof voiceFor === "function" && LANGS[lang] && LANGS[lang].code === code) return voiceFor(code); }catch(e){}
  let vs = []; try{ vs = speechSynthesis.getVoices() || []; }catch(e){}
  const lc = code.toLowerCase(), base = lc.slice(0, 2), n = v => String(v.lang || "").replace("_", "-").toLowerCase();
  const c = vs.filter(v => n(v).startsWith(base));
  return c.find(v => n(v) === lc && /natural|online|google|neural/i.test(v.name)) || c.find(v => n(v) === lc) || c[0] || null;
}
let SPK = null;   /* el botón que suena ahora (otro toque lo apaga) */
function speak(text, code, btn, slow){
  return new Promise(res => {
    if(!text || !("speechSynthesis" in W)){ res(false); return; }
    try{ speechSynthesis.cancel(); }catch(e){}
    if(SPK && SPK !== btn) SPK.classList.remove("playing");
    SPK = btn || null;
    let done = false, t = 0;
    const fin = v => { if(done) return; done = true; clearTimeout(t); if(btn) btn.classList.remove("playing"); if(SPK === btn) SPK = null; res(v); };
    let u; try{ u = new SpeechSynthesisUtterance(text); }catch(e){ res(false); return; }
    const r0 = typeof rate === "number" && rate > 0 ? rate : .9;
    u.rate = slow ? (typeof SLOW === "function" ? SLOW() : r0 * .6) : r0;
    if(typeof useVoice === "function") useVoice(u, code);
    else { u.lang = code; const v = pickVoice(code); if(v) u.voice = v; }
    /* por si el navegador no avisa al acabar; se vuelve a armar si hay que reintentar */
    const arm = () => { clearTimeout(t); t = setTimeout(() => fin(true), Math.min(40000, 2500 + text.length * (slow ? 180 : 110))); };
    /* una voz de internet que falla: otra vez con una del aparato (retryLocal de index.html), con su tiempo entero */
    u.onend = () => fin(true);
    u.onerror = e => {
      if(!done && typeof retryLocal === "function" && retryLocal(u, e, ev => fin(!(ev && ev.type === "error")))) arm();
      else fin(false);
    };
    arm();
    if(btn) btn.classList.add("playing");
    try{ speechSynthesis.speak(u); }catch(e){ fin(false); }
  });
}

/* ---------- estilos ---------- */
const CSS = `
.mb{max-width:640px;margin:0 auto;padding:4px 0 8px}
.mb-hd{display:flex;align-items:center;gap:16px;margin:4px 0 16px}
.mb-hd-i{flex:none;width:60px;height:60px}
.mb-t{margin:0;font:800 var(--fs-t2)/1.15 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.mb-sub{margin:4px 0 0;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label2);overflow-wrap:anywhere}
.mb-c{text-align:center}
/* la carta cerrada, en el móvil: el sobre, el título y «Abrir la carta» en el centro del sitio libre (no pegados arriba con
   media pantalla vacía debajo) */
@media (max-width:743px){:root:not([data-acc]) #mb-cv{box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;
  min-height:calc(100vh - var(--topbar-h) - var(--tabbar-h) - var(--tabbar-b) - 28px);min-height:calc(100svh - var(--topbar-h) - var(--tabbar-h) - var(--tabbar-b) - 28px)}}
.mb-h{margin:0 0 12px;font:700 var(--fs-head)/1.25 var(--f-round);color:var(--label)}
.mb-card{margin:0 0 24px;padding:16px;border-radius:var(--r-card)}
.mb-tpls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.mb-tpl{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;min-width:0;min-height:84px;margin:0;padding:8px 4px;border:0;
  border-radius:var(--r-md);background:var(--fill2);color:var(--label);font:600 var(--fs-min)/1.2 var(--f-text);cursor:pointer;-webkit-tap-highlight-color:transparent;
  transition:opacity var(--d-fast,160ms)}
/* el dibujo de cada frase llena el ancho de su botón, hasta 64 px (antes 40); en el móvil, huecos algo más cortos entre
   bloques (y 4 px alrededor en el botón) para que la pantalla no baje más que antes */
.mb-tpl img{box-sizing:border-box;width:min(100%,64px);height:auto;aspect-ratio:1;pointer-events:none}
@media (max-width:743px){.mb-hd{margin-bottom:12px}.mb-card{margin-bottom:16px}.mb-tpl{padding:4px}.mb-phr{margin-top:12px}.mb-ctl{margin-top:12px}}
.mb-tpl span{max-width:100%;overflow-wrap:anywhere;text-align:center}
.mb-tpl[aria-checked=true]{background:var(--brand-soft);box-shadow:inset 0 0 0 2px var(--brand-tint);color:var(--brand-ink)}
:root[data-theme=dark] .mb-tpl[aria-checked=true]{color:#7DBBFF}
.mb-tpl:focus-visible,.mb-spk:focus-visible,.mb-slow:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.mb-phr{display:flex;align-items:center;gap:12px;margin:16px 0 0;padding:12px 12px 12px 16px;border-radius:var(--r-md);background:var(--bg)}
:root[data-theme=dark] .mb-phr{background:var(--card-2)}
.mb-phr-x{flex:1;min-width:0}
.mb-phr-t{margin:0;font:700 var(--fs-t3)/1.25 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.mb-phr-es{margin:4px 0 0;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
/* mientras graba, las frases y su altavoz se apagan (no se pueden tocar: su voz se colaría en el mensaje) */
.mb-card.is-busy :is(.mb-tpl,.mb-spk){opacity:.4;pointer-events:none}
/* el altavoz: el mismo que el de la lección (círculo azul claro que se rellena al sonar) y la tortuga gris al lado */
.mb-spk{flex:none;display:grid;place-items:center;width:48px;height:48px;margin:0;padding:0;border:0;border-radius:50%;background:var(--brand-soft);color:var(--brand-tint);cursor:pointer;
  -webkit-tap-highlight-color:transparent;transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms),opacity var(--d-fast,160ms)}
.mb-spk.playing,.mb-slow.playing{background:var(--brand-fill);color:#fff}
.mb-slow{flex:none;display:grid;place-items:center;width:48px;height:48px;margin:0;padding:0;border:0;border-radius:50%;background:var(--fill2);color:var(--label);cursor:pointer;-webkit-tap-highlight-color:transparent}
.mb-aud{display:flex;align-items:center;gap:20px}   /* 20: sitio para las etiquetas de las teclas */
.mb-ctl{display:flex;flex-direction:column;align-items:center;gap:8px;margin:16px 0 0;text-align:center}
.mb-rb{position:relative;flex:none;width:120px;height:120px;margin:0;padding:0;border:0;border-radius:50%;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.mb-rb-in{position:absolute;inset:8px;display:grid;place-items:center;border-radius:50%;background:var(--brand-fill);color:#fff;box-shadow:0 6px 16px -6px rgba(30,110,244,.6);transition:transform .15s ease}
.mb-rb:active .mb-rb-in{transform:scale(.95)}
.mb-rb.is-rec .mb-rb-in{background:var(--brand-ink)}
.mb-rb[aria-busy=true]{cursor:progress}
.mb-rb[aria-busy=true] .mb-rb-in{background:#8E8E93;box-shadow:none}
.mb-rb.is-count .mb-rb-in{background:var(--brand-ink);font:800 48px/1 var(--f-round);font-variant-numeric:tabular-nums}
.mb-ring{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);pointer-events:none}
.mb-ring circle{fill:none;stroke-width:6}
.mb-ring-bg{stroke:var(--fill)}
.mb-ring-fg{stroke:var(--teal);stroke-linecap:round}
.mb-rb:not(.is-rec) .mb-ring-fg{display:none}
.mb-rl{margin:0;min-height:1.3em;font:600 var(--fs-sub)/1.3 var(--f-text);color:var(--label);font-variant-numeric:tabular-nums}
.mb-note{margin:0;max-width:30em;font:400 var(--fs-note)/1.4 var(--f-text);color:var(--label2)}
.mb-ok{display:flex;align-items:center;justify-content:center;gap:8px;margin:0;font:700 var(--fs-head)/1.25 var(--f-round);color:var(--ok-ink)}
.mb-btns{display:flex;gap:8px;width:100%}
.mb-btns>*{flex:1 1 0;min-width:0}
.mb-info{display:flex;align-items:flex-start;gap:8px;width:100%;box-sizing:border-box;margin:0;padding:12px 16px;border-radius:var(--r-md);background:var(--fill2);color:var(--label);font:400 var(--fs-sub)/1.4 var(--f-text);text-align:left}
.mb-info>.ico{flex:none;margin-top:2px;color:var(--label2)}
.mb-sec{margin:0 0 24px}
.mb-sec .st-g{background:var(--card)}
:root[data-theme=dark] .mb-sec .st-g{background:var(--card)}
.mb-rr{gap:8px;padding-top:4px;padding-bottom:4px}
.mb-rp{flex:none;display:grid;place-items:center;width:44px;height:44px;margin:0 0 0 -4px;padding:0;border:0;border-radius:50%;background:var(--brand-soft);color:var(--brand-tint);cursor:pointer}
.mb-rp.playing{background:var(--brand-fill);color:#fff}
.mb-rr .glass-btn{flex:none}
a.st-r.mb-lr{color:var(--label);cursor:pointer}
.mb-lr .st-ic{border-radius:50%}
.mb-lr .st-ic.gd{background:var(--gold);color:var(--gold-on)}
.mb-lr .st-ic.gr{background:#8E8E93}
.mb-lr .st-l b{font-weight:600}
.mb-chev{flex:none;color:var(--label3)}
.mb-foot{display:flex;justify-content:center;margin:0 0 8px}
.mb-quiet{display:inline-flex;align-items:center;gap:8px;min-height:var(--tap);padding:0 12px;border:0;border-radius:var(--r-pill);background:none;color:var(--brand-ink);font:600 var(--fs-sub)/1.2 var(--f-text);cursor:pointer}
:root[data-theme=dark] .mb-quiet{color:#7DBBFF}
/* Hoy: la fila del sobre (sobre gris claro, como la de la temporada) */
.mb-ric img{display:block;width:26px;height:26px}
.mb-row.is-new .mb-ric img{animation:mb-shake .7s ease-in-out .35s 3}
@keyframes mb-shake{0%,100%{transform:rotate(0)}20%{transform:rotate(-14deg)}40%{transform:rotate(11deg)}60%{transform:rotate(-8deg)}80%{transform:rotate(5deg)}}
/* el sobre: de papel (el único color, el sello dorado), para que no parezca un botón */
.mb-stage{display:grid;place-items:center;margin:8px 0 16px}
.mb-env{--e-back:#E5E5EA;--e-front:#FFFFFF;--e-flap1:#F7F7FA;--e-flap2:#DCDCE2;--e-paper:#FFFFFF;--e-line:#D1D1D6;
  position:relative;width:min(240px,64vw);aspect-ratio:3/2;perspective:800px}
:root[data-theme=dark] .mb-env{--e-back:#2C2C2E;--e-front:#3A3A3C;--e-flap1:#545458;--e-flap2:#48484A;--e-paper:#F2F2F7;--e-line:#C7C7CC}
.mb-env>i{position:absolute;display:block}
.mb-e-back{inset:0;border-radius:var(--r-md);background:var(--e-back);box-shadow:0 0 0 1px var(--sep),0 8px 20px rgba(0,0,0,.10)}
:root[data-theme=dark] .mb-e-back{box-shadow:0 0 0 1px var(--sep),0 8px 20px rgba(0,0,0,.5)}
.mb-e-paper{left:8%;right:8%;top:8%;bottom:12%;z-index:2;border-radius:8px;background:var(--e-paper);box-shadow:0 1px 3px rgba(0,0,0,.18);transition:transform .45s cubic-bezier(.2,.8,.2,1) .28s}
.mb-e-paper::before,.mb-e-paper::after{content:"";position:absolute;left:12%;right:12%;height:6px;border-radius:4px;background:var(--e-line)}
.mb-e-paper::before{top:20%}.mb-e-paper::after{top:40%;right:36%}
.mb-e-front{inset:0;z-index:3;border-radius:var(--r-md);background:var(--e-front);clip-path:polygon(0 0,50% 58%,100% 0,100% 100%,0 100%)}
.mb-e-flap{left:0;right:0;top:0;height:62%;z-index:4;border-radius:var(--r-md) var(--r-md) 0 0;background:linear-gradient(180deg,var(--e-flap1),var(--e-flap2));clip-path:polygon(0 0,100% 0,50% 100%);transform-origin:50% 0;
  transition:transform .4s ease,z-index 0s linear .2s}
.mb-env>.mb-e-seal{left:50%;top:58%;z-index:5;width:48px;height:48px;margin:-24px 0 0 -24px;border-radius:50%;display:grid;place-items:center;background:#FFCC00;color:#3D2B00;
  box-shadow:0 0 0 3px var(--e-front),0 2px 6px rgba(0,0,0,.25);transition:opacity .2s ease,transform .2s ease}
.mb-env.is-lock>.mb-e-seal{background:#8E8E93;color:#fff}
.mb-env.is-open .mb-e-flap{transform:rotateX(180deg);z-index:1}
.mb-env.is-open .mb-e-paper{transform:translateY(-48%)}
.mb-env.is-open .mb-e-seal{opacity:0;transform:scale(.6)}
.mb-go{margin:16px 0 0}
/* la carta */
.mb-paper{margin:0 0 16px;padding:24px 20px 16px;border-radius:var(--r-card)}
.mb-to{margin:0 0 8px;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2);overflow-wrap:anywhere}
.mb-msg{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:600 var(--fs-t3)/1.4 var(--f-round);color:var(--label)}
.mb-sig{margin:16px 0 0;text-align:right;font:600 var(--fs-head)/1.3 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.mb-paper .mb-aud{margin:16px 0 0}
.mb-gift{display:flex;align-items:center;gap:16px;margin:0 0 16px;padding:16px;border-radius:var(--r-card)}
.mb-gift[hidden]{display:none}
.mb-gift-i{flex:none;display:grid;place-items:center;width:64px;height:64px;font-size:44px;line-height:1}
.mb-gift-i img,.mb-gift-i .pj{display:block;width:64px;height:64px;object-fit:contain}
.mb-gift-t{flex:1;min-width:0}
.mb-gift-t b{display:block;font:800 var(--fs-head)/1.25 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.mb-gift-t small{display:block;margin-top:4px;font:400 var(--fs-note)/1.35 var(--f-text);color:var(--label2);overflow-wrap:anywhere}
.mb-gift-w{display:flex;align-items:center;gap:8px;margin-top:4px;font:600 var(--fs-sub)/1.3 var(--f-text);color:var(--label)}
.mb-gift.is-later .mb-gift-i{opacity:.5}
.mb-in{animation:mb-in .35s ease-out both}
.mb-in2{animation-delay:.3s}
@keyframes mb-in{from{opacity:0;transform:translateY(12px)}}
/* el candado: los pasos (3 lecciones o 3 días) o la barra (30 palabras) */
.mb-lk-t{margin:0;font:700 var(--fs-head)/1.3 var(--f-round);color:var(--label)}
.mb-bar{height:12px;margin:16px 0 8px;border-radius:8px;background:var(--fill);overflow:hidden}
.mb-bar>i{display:block;height:100%;border-radius:inherit;background:var(--teal)}
.mb-steps{display:flex;gap:12px;margin:16px 0 8px;padding:0;list-style:none}
.mb-steps li{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--fill);color:var(--label2);font:700 var(--fs-note)/1 var(--f-round)}
.mb-steps li.is-done{background:var(--teal);color:#fff}
:root[data-theme=dark] .mb-steps li.is-done{color:#00363B}
.mb-lk-n{margin:0 0 16px;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2);font-variant-numeric:tabular-nums}
.mb-lk-l{margin:12px 0 0;font:400 var(--fs-note)/1.4 var(--f-text);color:var(--label2)}
/* error: gris con ✗ */
.mb-bad{display:flex;flex-direction:column;align-items:center;gap:12px;padding:28px 20px;border-radius:var(--r-card);text-align:center}
.mb-bad-i{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:var(--miss-fill);color:var(--miss-on);font:700 28px/1 var(--f-text)}
.mb-bad p{margin:0;font:400 var(--fs-sub)/1.4 var(--f-text);color:var(--label2)}
.mb-lock-i{background:var(--fill2);color:var(--label)}
/* ¿dónde se abre la carta? (iPhone o iPad fuera de la app instalada, o una partida nueva) */
.mb-where{margin:0 0 16px}
.mb-where p{margin:0 0 12px;font:400 var(--fs-sub)/1.4 var(--f-text);color:var(--label)}
.mb-where p b{font-weight:700}
.mb-where .glass-btn+.glass-btn{margin-top:8px}
/* Contestar (mayores): como un formulario de Ajustes */
.mb-form .st-sec{margin:0 0 20px}
.mb-fr{cursor:text}
.mb-fr:focus-within{box-shadow:inset 0 0 0 2px var(--brand-tint);border-radius:var(--r-card)}
.mb-fl{flex:none;width:4.5em;font:600 var(--fs-body)/1.3 var(--f-text);color:var(--label)}
.mb-fi{flex:1;min-width:0;width:100%;box-sizing:border-box;min-height:var(--tap);margin:0;padding:0;border:0;background:none;color:var(--label);font:400 var(--fs-body)/1.35 var(--f-text);-webkit-appearance:none;appearance:none}
.mb-fi:focus,.mb-fi:focus-visible{outline:none}
.mb-fi::placeholder{color:var(--label2);opacity:.75}
textarea.mb-fi{min-height:132px;padding:12px 0;resize:vertical}
.mb-fr.col{flex-direction:column;align-items:stretch;gap:0}
.mb-cnt{align-self:flex-end;font:400 var(--fs-min)/1.2 var(--f-text);color:var(--label2);font-variant-numeric:tabular-nums}
.mb-seg{margin:0;max-width:none}
.mb-fnote{margin:8px 16px 0;font:400 var(--fs-note)/1.35 var(--f-text);color:var(--label2)}
.mb-pick{color:var(--label)}
.mb-pick .st-l{font-weight:400}
.mb-pv{flex:none;max-width:55%;font:400 var(--fs-body)/1.3 var(--f-text);color:var(--label2);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mb-pick .pj,.mb-pick img.mb-pi2{flex:none;display:block;width:32px;height:32px;object-fit:contain}
.mb-pick .pj-fb{font-size:24px;line-height:32px}
.mb-opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;padding:12px}
.mb-opts.rows{grid-template-columns:1fr;gap:0;padding:0}
.mb-opt{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:88px;margin:0;padding:8px;border-radius:var(--r-md);background:var(--fill2);
  color:var(--label);font:600 var(--fs-min)/1.2 var(--f-text);text-align:center;cursor:pointer;-webkit-tap-highlight-color:transparent}
.mb-opts.rows .mb-opt{flex-direction:row;justify-content:flex-start;gap:12px;min-height:var(--row);padding:8px 16px;border-radius:0;background:none;font:400 var(--fs-body)/1.3 var(--f-text);text-align:left}
.mb-opts.rows .mb-opt+.mb-opt::before{content:"";position:absolute;top:0;left:52px;right:0;height:1px;background:var(--sep);transform:scaleY(.5);transform-origin:0 0}
.mb-opts.rows .mb-opt .mb-ck{margin-left:auto;color:var(--brand-tint);visibility:hidden}
.mb-opts.rows .mb-opt.is-on .mb-ck{visibility:visible}
.mb-opt input{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none}
.mb-opt img,.mb-opt .pj{display:block;width:44px;height:44px;object-fit:contain;pointer-events:none}
.mb-opt .pj-fb{font-size:32px;line-height:44px}
.mb-opt .ico{flex:none}
.mb-opts:not(.rows) .mb-opt.is-on{background:var(--brand-soft);box-shadow:inset 0 0 0 2px var(--brand-tint);color:var(--brand-ink)}
:root[data-theme=dark] .mb-opts:not(.rows) .mb-opt.is-on{color:#7DBBFF}
.mb-opt:focus-within{outline:3px solid var(--brand-tint);outline-offset:-3px}
.mb-opt:not(:focus-within){outline:none}
.mb-gh{margin:16px 16px 0;font:600 var(--fs-note)/1.33 var(--f-text);color:var(--label2)}
.mb-err{display:flex;align-items:center;gap:8px;margin:8px 16px 0;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--miss-ink)}
.mb-err[hidden]{display:none}
.mb-link{display:block;width:100%;box-sizing:border-box;min-height:96px;margin:0 0 12px;padding:12px 16px;border:0;border-radius:var(--r-md);background:var(--fill2);color:var(--label);
  font:400 var(--fs-note)/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;resize:none}
.mb-link.vh{position:absolute;width:1px;height:1px;min-height:0;margin:0;padding:0;opacity:0;pointer-events:none}
.mb-cp{min-height:1.3em;margin:8px 0 0;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2);text-align:center}
.mb-pre{display:flex;align-items:center;gap:12px;margin:0 0 16px;padding:12px 16px;border-radius:var(--r-md);background:var(--card)}
.mb-pre img{flex:none;width:44px;height:44px}
.mb-pre b{display:block;font:700 var(--fs-head)/1.25 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.mb-pre small{display:block;margin-top:2px;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2);overflow-wrap:anywhere}
dialog.mb-sh .mb-res-b>*+*{margin-top:8px}
/* hojas */
dialog.mb-sh{max-width:560px}
dialog.mb-sh.m-sheet.glass{background:var(--bg);-webkit-backdrop-filter:none;backdrop-filter:none}
dialog.mb-sh p{margin:0 0 12px;font:400 var(--fs-sub)/1.4 var(--f-text);color:var(--label2)}
dialog.mb-sh .mb-fi{min-height:48px;padding:0 16px;border-radius:var(--r-sm);background:var(--card)}
dialog.mb-sh .mb-fi:focus-visible{box-shadow:inset 0 0 0 2px var(--brand-tint)}
dialog.mb-sh .mb-btns{margin:12px 0 0}
dialog.mb-sh .mb-link{background:var(--card)}
dialog.mb-sh .st-g{background:var(--card)}
dialog.mb-sh .mb-opts:not(.rows) .mb-opt{background:var(--fill2)}
/* dibujos con fondo blanco en modo oscuro: sobre una placa clara, como la Palabra del día */
:root[data-theme=dark] :is(.mb-tpl,.mb-gift-i,.mb-opt,.mb-pick) img:not([src*="om_1FA99"]){background:#F2F2F7;border-radius:var(--r-sm);padding:4px;box-sizing:border-box}
@media (prefers-reduced-motion:reduce){
  .mb-row.is-new .mb-ric img,.mb-in{animation:none}
  .mb-env>i,.mb-rb-in{transition:none}
}
@media (forced-colors:active){.mb-tpl,.mb-opt,.mb-rb-in{border:1px solid CanvasText}}`;
function css(){
  if($id("css-mailbox")) return;
  const s = D.createElement("style"); s.id = "css-mailbox"; s.textContent = CSS; D.head.appendChild(s);
}
css();

/* ---------- estado de las pantallas ---------- */
let NAV = 0, AUTO = "", REPL = null, PASS = 0, PEND = "", GATE = false;
const onBuzon = () => typeof hashPath === "function" && hashPath() === "buzon";

/* ---------- grabar ---------- */
const R = {st: "idle", tok: 0, mr: null, stream: null, chunks: [], type: "", t0: 0, dur: 0, timer: 0, raf: 0, cur: null, fb: false};
let PERM = "", RECS = [];
const canRec = () => !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function" && typeof W.MediaRecorder === "function");
function mimePick(){
  const MR = W.MediaRecorder; if(!MR || typeof MR.isTypeSupported !== "function") return "";
  for(const t of ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"]){ try{ if(MR.isTypeSupported(t)) return t; }catch(e){} }
  return "";
}
function permCheck(){
  try{
    if(!navigator.permissions || typeof navigator.permissions.query !== "function") return;
    navigator.permissions.query({name: "microphone"}).then(p => {
      const set = () => { const old = PERM; PERM = p.state; if(old !== PERM && onBuzon() && (R.st === "idle" || R.st === "denied")){ if(PERM === "denied") R.st = "denied"; else if(R.st === "denied") R.st = "idle"; paintCtl(); } };
      set(); p.onchange = set;
    }, () => {});
  }catch(e){}
}
const stopStream = s => { try{ if(s) s.getTracks().forEach(t => t.stop()); }catch(e){} };
function setRec(st){ R.st = st; if(onBuzon()) paintCtl(); }
function live(t){ const el = $id("mb-live"); if(el) el.textContent = t; }
const busy = () => R.st === "ask" || R.st === "count" || R.st === "rec" || R.st === "saving";
/* mientras graba (o espera al micrófono), las frases y su altavoz no se pueden tocar: su voz se colaría en el mensaje */
function lockTpls(){
  const card = D.querySelector("#mb-home .mb-card"); if(!card) return;
  const on = busy();
  card.classList.toggle("is-busy", on);
  card.querySelectorAll(".mb-tpl, #mb-spk").forEach(b => { if(on) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled"); });
}
/* la cuenta atrás antes de grabar (1,5 s: 3 · 2 · 1), para que no se pierda el principio; sin ella con «Reducir movimiento» */
const COUNT_MS = 1500;
function countdown(tok){
  return new Promise(res => {
    if(rm()){ res(true); return; }
    const t0 = performance.now();
    const step = () => {
      if(tok !== R.tok || R.st !== "count"){ res(false); return; }
      const left = COUNT_MS - (performance.now() - t0);
      if(left <= 0){ res(true); return; }
      const n = String(Math.ceil(left / (COUNT_MS / 3))), el = D.querySelector("#mb-rb .mb-rb-in");
      if(el && el.textContent !== n){ el.textContent = n; live(n); }
      R.cd = setTimeout(step, 50);
    };
    step();
  });
}
async function startRec(){
  if(busy()) return;
  if(!canRec()){ setRec("nomic"); return; }
  stopAudio(); try{ if("speechSynthesis" in W) speechSynthesis.cancel(); }catch(e){}
  R.tpl = TPLID;   /* la frase elegida al empezar es la que se guarda con la grabación */
  const tok = ++R.tok; setRec("ask");
  let stream;
  try{ stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}}); }
  catch(e){
    if(tok !== R.tok) return;
    const n = e && e.name;
    setRec(n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError" ? "denied" : n === "NotFoundError" || n === "DevicesNotFoundError" || n === "OverconstrainedError" ? "nodev" : "fail");
    return;
  }
  if(tok !== R.tok || !onBuzon()){ stopStream(stream); if(tok === R.tok) R.st = "idle"; return; }
  PERM = "granted";
  R.stream = stream;
  setRec("count");
  if(!(await countdown(tok))){ if(R.stream === stream){ stopStream(stream); R.stream = null; } return; }
  if(tok !== R.tok || !onBuzon()){ stopStream(stream); if(R.stream === stream) R.stream = null; if(tok === R.tok) setRec("idle"); return; }
  const type = mimePick(); let mr = null;
  try{ mr = new MediaRecorder(stream, type ? {mimeType: type, audioBitsPerSecond: 64000} : undefined); }
  catch(e){ try{ mr = new MediaRecorder(stream); }catch(e2){ mr = null; } }
  if(!mr){ stopStream(stream); R.stream = null; setRec("fail"); return; }
  R.mr = mr; R.stream = stream; R.chunks = []; R.type = type; R.dur = 0;
  mr.ondataavailable = ev => { if(ev.data && ev.data.size) R.chunks.push(ev.data); };
  mr.onstop = () => finish(tok, mr);
  mr.onerror = () => { if(R.mr === mr) stopRec(); };
  try{ mr.start(1000); }catch(e){ stopStream(stream); R.mr = null; R.stream = null; setRec("fail"); return; }
  R.t0 = performance.now(); setRec("rec"); live("Grabando");
  R.timer = setTimeout(stopRec, MAXMS);   /* 20 s como mucho */
  ring();
}
function ring(){
  cancelAnimationFrame(R.raf);
  if(R.st !== "rec") return;
  const t = Math.min(MAXMS, performance.now() - R.t0), left = Math.max(0, Math.ceil((MAXMS - t) / 1000));
  const fg = $id("mb-ring-fg"), lb = $id("mb-rl");
  if(fg) fg.setAttribute("stroke-dasharray", `${(100 * (MAXMS - t) / MAXMS).toFixed(2)} 100`);
  if(lb && lb.dataset.s !== String(left)){ lb.dataset.s = String(left); lb.textContent = `Grabando… quedan ${left} s`; }
  R.raf = requestAnimationFrame(ring);
}
function stopRec(){
  if(R.st !== "rec" || !R.mr) return;
  clearTimeout(R.timer); cancelAnimationFrame(R.raf);
  R.dur = Math.min(MAXMS, performance.now() - R.t0);
  const mr = R.mr; setRec("saving");
  try{ if(mr.state !== "inactive") mr.stop(); else finish(R.tok, mr); }catch(e){ finish(R.tok, mr); }
}
/* al parar: se guarda sola (aunque ya se haya ido a otra pantalla); si es muy corta, no */
async function finish(tok, mr){
  if(mr.__mbDone) return; mr.__mbDone = true;
  stopStream(R.stream); R.stream = null; if(R.mr === mr) R.mr = null;
  const chunks = R.chunks; R.chunks = [];
  const type = String(mr.mimeType || R.type || "audio/webm");
  const blob = new Blob(chunks, {type});
  if(R.dur < MINMS || !blob.size){ if(tok === R.tok){ setRec("short"); live("Muy cortito"); } return; }
  let buf; try{ buf = await blob.arrayBuffer(); }catch(e){ if(tok === R.tok) setRec("fail"); return; }
  const rec = {id: "mb-" + Date.now().toString(36) + rid(5), kind: "mail", t: Date.now(), type, dur: Math.round(R.dur), buf, tpl: R.tpl || TPLID, lang: curAb()};
  let saved = true;
  try{ await Media.put(rec); await Media.keep("mail", MAXREC); Media.persist(); }catch(e){ saved = false; }
  await refreshMedia();
  if(tok !== R.tok) return;
  R.cur = rec; R.saved = saved; R.fb = false;
  setRec("done"); live("¡Grabado!");
  if(onBuzon()) paintRecs();
}
function cancelRec(){
  R.tok++;
  clearTimeout(R.timer); clearTimeout(R.cd); cancelAnimationFrame(R.raf);
  if(R.mr){ const mr = R.mr; R.mr = null; R.dur = 0; try{ if(mr.state !== "inactive") mr.stop(); }catch(e){} }
  stopStream(R.stream); R.stream = null;
  if(busy()) R.st = "idle";
}
/* parar a medias (otra pantalla, la app escondida): se guarda lo grabado */
function stopSoon(){ if(R.st === "rec") stopRec(); else if(R.st === "ask" || R.st === "count") cancelRec(); }

/* ---------- oír ---------- */
let AUD = null;
function stopAudio(){
  if(!AUD) return;
  const x = AUD; AUD = null;
  try{ x.a.pause(); }catch(e){}
  try{ URL.revokeObjectURL(x.url); }catch(e){}
  if(x.btn && x.btn.isConnected){ x.btn.classList.remove("playing"); x.btn.setAttribute("aria-pressed", "false"); if(x.ic) x.btn.querySelector(".mb-pi").innerHTML = x.ic; }
}
function playRec(rec, btn){
  if(AUD && AUD.id === rec.id){ stopAudio(); return; }
  stopAudio(); try{ if("speechSynthesis" in W) speechSynthesis.cancel(); }catch(e){}
  let url; try{ url = URL.createObjectURL(new Blob([rec.buf], {type: String(rec.type || "audio/webm")})); }catch(e){ return; }
  const a = new Audio(); a.preload = "auto";
  const pi = btn && btn.querySelector(".mb-pi");
  AUD = {a, url, btn, id: rec.id, ic: pi ? pi.innerHTML : ""};
  if(btn){ btn.classList.add("playing"); btn.setAttribute("aria-pressed", "true"); if(pi) pi.innerHTML = IC("pause", "bold", btn.classList.contains("mb-rp") ? 18 : 20); }
  const end = () => { if(AUD && AUD.a === a) stopAudio(); };
  a.onended = end; a.onerror = end;
  a.src = url;
  try{ const p = a.play(); if(p && p.catch) p.catch(end); }catch(e){ end(); }
}

/* ---------- mandar ---------- */
function fileOf(rec){
  const base = String(rec.type || "").split(";")[0].trim() || "audio/webm";
  const ext = /mp4|m4a|aac/.test(base) ? "m4a" : /ogg/.test(base) ? "ogg" : /wav/.test(base) ? "wav" : "webm";
  const d = new Date(rec.t || Date.now()), hh = String(d.getHours()).padStart(2, "0"), mm = String(d.getMinutes()).padStart(2, "0");
  const name = `mensaje-${day(d)}-${hh}${mm}.${ext}`, type = ext === "m4a" ? "audio/mp4" : base;
  try{ return new File([rec.buf], name, {type}); }catch(e){ const b = new Blob([rec.buf], {type}); try{ b.name = name; }catch(e2){} return b; }
}
/* el enlace para contestar lleva el idioma que aprende y su nombre (así el formulario del mayor ya los trae) */
const replyUrl = () => { const n = kidName(); return `${appUrl()}#/buzon/responder?l=${curAb()}${n ? "&n=" + encodeURIComponent(n) : ""}`; };
const shareText = () => { const n = kidName(); return `Un mensaje ${n ? `de ${n} ` : ""}desde la app Vocabulary. Para contestar con una carta, abre: ${replyUrl()}`; };
function download(file){
  let url; try{ url = URL.createObjectURL(file); }catch(e){ return false; }
  const a = D.createElement("a"); a.href = url; a.download = file.name || "mensaje.webm"; a.rel = "noopener"; a.hidden = true;
  D.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => { try{ URL.revokeObjectURL(url); }catch(e){} }, 60000);
  return true;
}
/* «Mandar» abre otra app (el menú de compartir del aparato): antes, la Puerta de mayores (se recuerda 5 minutos, así
   que dentro de ese rato manda al momento, dentro del toque). Web Share con el archivo si se puede; si no, se descarga
   y una hoja da el texto para mandarlo. */
function send(rec, from){
  if(!rec || !rec.buf) return;
  stopAudio();
  if(W.adultGate && !adultGate.passed()){
    Promise.resolve(adultGate({reason: "Para mandar tu audio con otra app. Tú eliges a quién.", from: from || null})).catch(() => false).then(ok => {
      if(ok && onBuzon()) share(rec, from, true);
    });
    return;
  }
  share(rec, from, false);
}
function share(rec, from, late){
  const file = fileOf(rec), text = shareText(), N = navigator;
  let can = false;
  try{ can = typeof N.share === "function" && typeof N.canShare === "function" && N.canShare({files: [file]}); }catch(e){ can = false; }
  if(can){
    let p; try{ p = N.share({files: [file], text, title: "Un mensaje para ti"}); }catch(e){ p = Promise.reject(e); }
    Promise.resolve(p).then(() => sent(rec, false), e => {
      if(e && e.name === "AbortError") return;   /* lo cerró sin mandar: no pasa nada */
      /* tras la Puerta, el navegador puede pedir otro toque para abrir el menú de compartir */
      if(late && e && e.name === "NotAllowedError"){ notice("¡Listo! Toca «Mandar» otra vez.", IC("paper-plane-tilt", "bold", 22)); return; }
      download(file); sent(rec, true); textSheet(file, from);
    });
    return;
  }
  download(file); sent(rec, true); textSheet(file, from);
}
function sent(rec, fb){
  rec.sent = Date.now();
  Media.put(rec).catch(() => {});
  if(R.cur && R.cur.id === rec.id){ R.fb = fb; setRec("sent"); }
  if(!fb) notice("¡Mensaje listo!", IC("paper-plane-tilt", "bold", 22));
}
async function copy(t, field){
  try{ if(navigator.clipboard && typeof navigator.clipboard.writeText === "function"){ await navigator.clipboard.writeText(t); return true; } }catch(e){}
  try{ if(field){ field.focus({preventScroll: true}); field.select(); field.setSelectionRange(0, field.value.length); } return !!(D.execCommand && D.execCommand("copy")); }catch(e){ return false; }
}

/* ---------- hojas ---------- */
function sheet(id, label){
  let d = $id(id);
  if(!d){ d = D.createElement("dialog"); d.id = id; d.className = "mb-sh"; d.setAttribute("aria-labelledby", label); d.dataset.noRenew = ""; d.dataset.noHint = ""; D.body.appendChild(d);
    d.addEventListener("click", e => { if(e.target.closest && e.target.closest("[data-close]")) closeSheet(d); }); }
  return d;
}
function openSheet(d, from){
  try{ if(W.M && typeof M.openSheet === "function") M.openSheet(d, {from: from && from.nodeType === 1 ? from : null}); else d.showModal(); }
  catch(e){ try{ d.showModal(); }catch(e2){ d.setAttribute("open", ""); } }
  d.classList.add("lite");
}
function closeSheet(d, now){
  if(!d || !d.open) return;
  if(!now && W.M && typeof M.closeSheet === "function" && d.classList.contains("m-sheet")) M.closeSheet(d); else d.close();
}
const closeSheets = () => ["mb-tx-s", "mb-paste-s", "mb-pick-s", "mb-res"].forEach(id => closeSheet($id(id), true));
function textSheet(file, from){
  const d = sheet("mb-tx-s", "mb-tx-t");
  d.innerHTML = `<div class="m-head"><h2 id="mb-tx-t">Audio guardado</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Listo</button></div>
    <p>Se ha guardado «<b data-t="f"></b>». Mándaselo a tu tío, o a quien quieras, con este texto:</p>
    <textarea class="mb-link" id="mb-tx" readonly rows="4" aria-label="Texto para mandar"></textarea>
    <button type="button" class="glass-btn glass-btn--pri glass-btn--block" id="mb-tx-c">${IC("copy", "bold", 20)}Copiar el texto</button>
    <p class="mb-cp" id="mb-tx-m" role="status" aria-live="polite"></p>`;
  txt(d, "[data-t=f]", file.name || "mensaje");
  const ta = d.querySelector("#mb-tx"); ta.value = shareText();
  d.querySelector("#mb-tx-c").onclick = async () => { const ok = await copy(ta.value, ta); txt(d, "#mb-tx-m", ok ? "¡Copiado! Ya lo puedes pegar." : "Mantén pulsado el texto para copiarlo."); };
  openSheet(d, from);
}
/* pegar el enlace de una carta que se abrió en otro navegador (o en Safari, con la app instalada) */
function pasteSheet(from){
  const d = sheet("mb-paste-s", "mb-ps-t");
  d.innerHTML = `<div class="m-head"><h2 id="mb-ps-t">Pegar una carta</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Listo</button></div>
    <p>Si la carta se abrió en otro sitio, copia su enlace y pégalo aquí.</p>
    <input class="mb-fi" id="mb-ps-in" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Pega aquí el enlace" aria-label="Enlace de la carta">
    <p class="mb-err" id="mb-ps-e" hidden><span aria-hidden="true">✗</span><span>Ese enlace no es una carta. Cópialo entero.</span></p>
    <div class="mb-btns">${navigator.clipboard && typeof navigator.clipboard.readText === "function" ? `<button type="button" class="glass-btn" id="mb-ps-p">${IC("clipboard-text", "bold", 20)}Pegar</button>` : ""}
      <button type="button" class="glass-btn glass-btn--pri" id="mb-ps-go">${IC("envelope-open", "bold", 20)}Abrir</button></div>`;
  const inp = d.querySelector("#mb-ps-in"), err = d.querySelector("#mb-ps-e");
  const go = () => {
    const v = String(inp.value || "").trim(), m = /[#?&]d=([A-Za-z0-9_-]+)/.exec(v), dd = m ? m[1] : /^[A-Za-z0-9_-]{8,}$/.test(v) ? v : "";
    if(!dd || !decode(dd)){ err.hidden = false; return; }
    closeSheet(d, true); HERE = dd; location.hash = "#/carta?d=" + dd;
  };
  inp.addEventListener("input", () => { err.hidden = true; });
  inp.addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); go(); } });
  const pb = d.querySelector("#mb-ps-p");
  if(pb) pb.onclick = () => { navigator.clipboard.readText().then(t => { inp.value = String(t || "").slice(0, 4000); err.hidden = true; }, () => { inp.focus(); }); };
  d.querySelector("#mb-ps-go").onclick = go;
  openSheet(d, from);
}

/* ---------- #/buzon ---------- */
function homeHtml(){
  const T = tplOf(TPLID), ab = curAb(), L = LANGS[lang] || {};
  return `<div class="mb" id="mb-home">
    <header class="mb-hd"><img class="mb-hd-i" src="${IMG.box}" alt="" width="60" height="60" draggable="false">
      <div><h1 class="mb-t">Buzón del tío</h1><p class="mb-sub">Graba un mensaje en ${esc(L.name || "")} para tu tío o para quien quieras</p></div></header>
    <section class="card mb-card" aria-labelledby="mb-rec-h">
      <h2 class="mb-h" id="mb-rec-h">¿Qué le dices?</h2>
      <div class="mb-tpls" role="radiogroup" aria-label="Frases para empezar">${TPL.map((t, i) => `<button type="button" class="mb-tpl" role="radio" data-tpl="${t.id}" data-key="${i + 1}" data-key-pos="in" aria-checked="${t === T}" tabindex="${t === T ? 0 : -1}"><img src="${t.img}" alt="" width="40" height="40" draggable="false"><span>${esc(t.t)}</span></button>`).join("")}</div>
      <div class="mb-phr"><div class="mb-phr-x"><p class="mb-phr-t" id="mb-phr" lang="${esc(L.code || ab)}">${esc(T.w[ab])}</p><p class="mb-phr-es" id="mb-phr-es">${esc(T.es)}</p></div>
        <button type="button" class="mb-spk" id="mb-spk" data-key="space" aria-label="Oír la frase">${IC("speaker-high", "fill", 24)}</button></div>
      <div class="mb-ctl" id="mb-ctl"></div>
      <p class="sr-only" id="mb-live" role="status" aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap"></p>
    </section>
    <section class="mb-sec" id="mb-recs" aria-labelledby="mb-recs-h" hidden><h2 class="st-h" id="mb-recs-h">Tus grabaciones</h2><div class="st-g" id="mb-recs-l"></div></section>
    <section class="mb-sec" id="mb-lets" aria-labelledby="mb-lets-h" hidden><h2 class="st-h" id="mb-lets-h">Cartas</h2><div class="st-g ics" id="mb-lets-l"></div></section>
    <p class="mb-foot"><button type="button" class="mb-quiet" id="mb-paste" aria-haspopup="dialog">${IC("clipboard-text", "bold", 20)}Pegar el enlace de una carta</button></p>
  </div>`;
}
const recBtn = (st) => `<button type="button" class="mb-rb${st === "rec" ? " is-rec" : st === "count" ? " is-count" : ""}" id="mb-rb" data-key="enter" aria-label="${st === "rec" ? "Parar la grabación" : "Grabar"}"${st === "ask" || st === "saving" || st === "count" ? ' aria-busy="true"' : ""}>
    <svg class="mb-ring" viewBox="0 0 120 120" aria-hidden="true"><circle class="mb-ring-bg" cx="60" cy="60" r="56"/><circle class="mb-ring-fg" id="mb-ring-fg" cx="60" cy="60" r="56" pathLength="100" stroke-dasharray="${st === "rec" ? "100 100" : "0 100"}"/></svg>
    <span class="mb-rb-in" aria-hidden="true">${st === "rec" ? IC("stop", "fill", 40) : st === "count" ? "3" : IC("microphone", "fill", 44)}</span></button>`;
const NOTE = "Para grabarte, el navegador te preguntará si puede usar el micrófono. Tu voz se queda en este aparato hasta que tú la mandes.";
const info = (t, again) => `<p class="mb-info">${IC("info", "bold", 22)}<span>${esc(t)}</span></p>${again ? `<button type="button" class="glass-btn" id="mb-retry">${IC("arrow-counter-clockwise", "bold", 20)}Probar otra vez</button>` : ""}`;
function paintCtl(){
  const el = $id("mb-ctl"); if(!el) return;
  /* el foco vuelve al botón equivalente después de pintar (con teclado o lector de pantalla no se pierde el sitio) */
  const ae = D.activeElement, had = ae && ae !== D.body && el.contains(ae) ? (ae.id || "x") : "";
  paintCtl0(el);
  lockTpls();
  if(had){
    const t = (had !== "x" && $id(had) && el.contains($id(had)) ? $id(had) : null) || el.querySelector("#mb-rb, #mb-send, #mb-new, #mb-retry, button");
    if(t) try{ t.focus({preventScroll: true}); }catch(e){}
  }
}
function paintCtl0(el){
  const st = R.st;
  if(st === "nomic"){ el.innerHTML = info("Este aparato no puede grabar. ¡Puedes oír las frases y decirlas en voz alta!", false); return; }
  if(st === "denied"){ el.innerHTML = info("El micrófono está apagado para esta web. Pide a un mayor que lo active en los ajustes del navegador.", true); wireCtl(el); return; }
  if(st === "nodev"){ el.innerHTML = info("No encuentro ningún micrófono. Si tienes uno, conéctalo y prueba otra vez.", true); wireCtl(el); return; }
  if(st === "fail"){ el.innerHTML = info("No se ha podido grabar. ¡Prueba otra vez!", true); wireCtl(el); return; }
  if(st === "done" || st === "sent"){
    const c = R.cur;
    el.innerHTML = st === "done"
      ? `<p class="mb-ok">${IC("check-circle", "fill", 24)}¡Muy bien! Ya está grabado.</p>
        ${R.saved === false ? `<p class="mb-note">En este navegador no se puede guardar: mándalo ahora.</p>` : ""}
        <div class="mb-btns"><button type="button" class="glass-btn" id="mb-play" aria-pressed="false"><span class="mb-pi">${IC("play", "fill", 20)}</span>Escucharme</button>
          <button type="button" class="glass-btn" id="mb-again">${IC("arrow-counter-clockwise", "bold", 20)}Otra vez</button></div>
        <button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" id="mb-send" data-key="enter">${IC("paper-plane-tilt", "bold", 22)}Mandar</button>
        <p class="mb-note" id="mb-send-n">${esc(SEND_NOTE)}</p>`
      : `<p class="mb-ok">${IC("check-circle", "fill", 24)}${R.fb ? "¡Audio guardado!" : "¡Mensaje listo!"}</p>
        <p class="mb-note">${R.fb ? "Mándaselo a tu tío, o a quien quieras, con el texto para contestar." : "Cuando te contesten, te llegará un enlace: ábrelo y la carta aparecerá aquí."}</p>
        <div class="mb-btns"><button type="button" class="glass-btn" id="mb-play" aria-pressed="false"><span class="mb-pi">${IC("play", "fill", 20)}</span>Escucharme</button>
          <button type="button" class="glass-btn glass-btn--pri" id="mb-new" data-key="enter">${IC("microphone", "fill", 20)}Grabar otro</button></div>`;
    const p = $id("mb-play"); if(p && c) p.onclick = () => playRec(c, p);
    const ag = $id("mb-again"); if(ag) ag.onclick = () => again();
    const s = $id("mb-send"); if(s && c) s.onclick = e => send(c, e.currentTarget);
    const n = $id("mb-new"); if(n) n.onclick = () => { stopAudio(); R.cur = null; R.st = "idle"; paintCtl(); };
    return;
  }
  const lbl = st === "ask" ? "Esperando al micrófono…" : st === "count" ? "¡Prepárate!" : st === "saving" ? "Guardando…" : st === "rec" ? `Grabando… quedan ${Math.max(0, Math.ceil((MAXMS - (performance.now() - R.t0)) / 1000))} s`
    : st === "short" ? "Muy cortito. ¡Prueba otra vez!" : "Toca para grabar";
  el.innerHTML = `${recBtn(st)}<p class="mb-rl" id="mb-rl">${esc(lbl)}</p>${PERM !== "granted" && (st === "idle" || st === "short" || st === "ask") ? `<p class="mb-note" id="mb-note">${NOTE}</p>` : ""}`;
  wireCtl(el);
  if(st === "rec") ring();
}
const SEND_NOTE = "Se manda tu audio y un enlace para que te contesten. Tú eliges a quién.";
function wireCtl(el){
  const b = el.querySelector("#mb-rb");
  if(b) b.onclick = () => { if(R.st === "rec") stopRec(); else if(R.st === "idle" || R.st === "short") startRec(); };
  const r = el.querySelector("#mb-retry");
  if(r) r.onclick = () => { R.st = "idle"; startRec(); };
}
/* «Otra vez»: esta no vale; se borra y se graba otra */
function again(){
  stopAudio();
  const c = R.cur; R.cur = null;
  if(c){ RECS = RECS.filter(x => x.id !== c.id); Media.del(c.id).catch(() => {}).then(refreshMedia).then(() => { if(onBuzon()) paintRecs(); }); }
  R.st = "idle"; startRec();
}
async function paintRecs(){
  const my = NAV;
  let list = [];
  try{ list = (await Media.list("mail")).slice(0, MAXREC); }catch(e){ list = []; }
  if(my !== NAV || !onBuzon()) return;
  RECS = list;
  const sec = $id("mb-recs"), box0 = $id("mb-recs-l"); if(!sec || !box0) return;
  sec.hidden = !list.length;
  box0.innerHTML = list.map(r => `<div class="st-r mb-rr" data-id="${esc(r.id)}">
      <button type="button" class="mb-rp" data-play aria-pressed="false" aria-label="Escuchar"><span class="mb-pi" aria-hidden="true">${IC("play", "fill", 18)}</span></button>
      <span class="st-l">${esc(tplOf(r.tpl).t)}<small>${Math.max(1, Math.round((+r.dur || 0) / 1000))} s · ${esc(when(r.t))}${r.sent ? " · mandado" : ""}</small></span>
      <button type="button" class="glass-btn glass-btn--sm" data-send>${IC("paper-plane-tilt", "bold", 18)}Mandar</button></div>`).join("");
}
function paintLetters(){
  const sec = $id("mb-lets"), el = $id("mb-lets-l"); if(!sec || !el) return;
  const b = box(); if(b.l.length) unlockDue(b);
  sec.hidden = !b.l.length;
  el.innerHTML = b.l.map(L => {
    const s = L.lock && !L.u ? lockState(L) : null;
    const [ic, cls, sub] = !L.o && s ? ["lock", "gr", `Con candado · ${s.have} de ${s.need} ${s.units}`]
      : !L.o ? ["envelope-simple", "gd", "¡Sin abrir!"] : ["envelope-open", "", `Abierta ${L.o === day() ? "hoy" : "el " + new Date(L.o + "T12:00").toLocaleDateString("es-ES", {day: "numeric", month: "long"})}`];
    return `<a class="st-r mb-lr" href="#/carta/${encodeURIComponent(L.id)}" data-id="${esc(L.id)}"><span class="st-ic${cls ? " " + cls : ""}" aria-hidden="true">${IC(ic, "bold", 18)}</span>
      <span class="st-l"><span>De </span><b data-t="from"></b><small>${esc(sub)}</small></span>${IC("caret-right", "bold", 16, "mb-chev")}</a>`;
  }).join("");
  [...el.querySelectorAll("[data-id]")].forEach((a, i) => { txt(a, "[data-t=from]", b.l[i].from); });
}
/* un grupo de opciones (role=radio): flechas para moverse y un solo botón en el orden de tabulación */
function radioKeys(group, sel, pick){
  group.addEventListener("keydown", e => {
    const k = e.key; if(!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(k)) return;
    const all = [...group.querySelectorAll(sel)].filter(b => b.getAttribute("aria-disabled") !== "true"); if(!all.length) return;
    const i = Math.max(0, all.indexOf(D.activeElement));
    const j = k === "Home" ? 0 : k === "End" ? all.length - 1 : (i + (k === "ArrowLeft" || k === "ArrowUp" ? -1 : 1) + all.length) % all.length;
    e.preventDefault(); all[j].focus(); pick(all[j]);
  });
}
const roving = (group, sel, on) => group.querySelectorAll(sel).forEach(b => { b.setAttribute("aria-checked", String(b === on)); b.tabIndex = b === on ? 0 : -1; });
function homeView(my){
  const app = $id("app");
  if(busy() && R.st !== "saving") cancelRec();
  /* al volver al Buzón se empieza otra vez: lo ya grabado está en «Tus grabaciones» */
  if(R.st !== "saving" && R.st !== "nomic"){ stopAudio(); R.cur = null; R.st = canRec() ? (PERM === "denied" ? "denied" : "idle") : "nomic"; }
  app.innerHTML = homeHtml();
  paintCtl(); paintLetters(); paintRecs(); permCheck();
  const tp = app.querySelector(".mb-tpls");
  const pickTpl = (b, talk) => {
    if(busy() || !b) return;   /* grabando: la frase no cambia ni suena */
    TPLID = b.dataset.tpl;
    roving(tp, ".mb-tpl", b);
    const T = tplOf(TPLID); txt(app, "#mb-phr", T.w[curAb()]); txt(app, "#mb-phr-es", T.es);
    if(talk && typeof say === "function") say(T.w[curAb()], $id("mb-spk"));
  };
  tp.addEventListener("click", e => pickTpl(e.target.closest(".mb-tpl"), true));
  radioKeys(tp, ".mb-tpl", b => pickTpl(b, true));
  $id("mb-spk").onclick = e => { if(busy()) return; if(typeof say === "function") say(tplOf(TPLID).w[curAb()], e.currentTarget); };
  $id("mb-recs-l").addEventListener("click", e => {
    const row = e.target.closest(".mb-rr"), r = row && RECS.find(x => x.id === row.dataset.id); if(!r) return;
    if(e.target.closest("[data-play]")) playRec(r, e.target.closest("[data-play]"));
    else if(e.target.closest("[data-send]")) send(r, e.target.closest("[data-send]"));
  });
  $id("mb-paste").onclick = e => pasteSheet(e.currentTarget);
}

/* ---------- #/buzon/responder (mayores) ---------- */
const FORM = {from: "", to: "", lang: "", msg: "", mode: "gift", gift: "20", lock: "les3", made: null};
/* una carta con regalo necesita la Puerta resuelta para ella: la de entrar al formulario vale para una; después (o si
   se entró con la Puerta aún recordada de otra cosa) se vuelve a preguntar. Así un niño no se fabrica monedas. */
let GIFTOK = false;
/* lo que trae el enlace de «Mandar»: ?l=<en|fr|da>&n=<nombre del niño> */
function replyParams(){
  const q = new URLSearchParams(location.hash.split("?")[1] || ""), l = q.get("l"), n = q.get("n");
  return {lang: l && has(LK, l) ? l : "", name: n ? cleanText(n, 24, false) || "" : ""};
}
function gateHtml(){
  const p = replyParams();
  const who = p.name ? `${p.name} te ha mandado un audio${p.lang ? ` en ${lname(p.lang)}` : ""}. Contéstale con una carta.` : "Aquí un mayor contesta con una carta.";
  return `<div class="mb" id="mb-gate"><div class="card mb-bad">
    <div class="mb-bad-i mb-lock-i" aria-hidden="true">${IC("envelope-simple", "bold", 28)}</div>
    <h1 class="mb-t">Para mayores</h1>
    <p><span data-t="who">${esc(who)}</span> Antes, una cuenta muy fácil.</p>
    <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="mb-gate-go" data-key="enter">${IC("lock-open", "bold", 20)}Soy mayor</button>
    <a class="glass-btn" href="#/buzon">Volver al Buzón</a></div></div>`;
}
function askGate(my, from){
  if(!W.adultGate){ GIFTOK = true; formView(my); return; }
  GATE = true;
  try{ adultGate.forget(); }catch(e){}   /* siempre una cuenta de verdad, aunque quede abierta de otra cosa */
  Promise.resolve(adultGate({reason: "Para escribir una carta de respuesta.", from: from || null})).catch(() => false).then(ok => {
    GATE = false;
    if(my !== NAV || hashPath() !== "buzon/responder") return;
    if(ok){ GIFTOK = true; formView(my); }
  });
}
function replyView(my){
  const app = $id("app");
  const p = replyParams();
  if(p.lang || p.name){ FORM.lang = p.lang || FORM.lang; FORM.to = p.name || FORM.to; FORM.made = null; }
  /* desde Ajustes › Para mayores (acaba de pasar la Puerta) entra sin otra pregunta; una carta con regalo la pedirá */
  if(W.adultGate && Date.now() - PASS < 8000){ PASS = 0; GIFTOK = false; formView(my); return; }
  /* antes de nada, para qué es (quien abre el enlace de la respuesta no ve una cuenta de la nada): la Puerta sale al tocar */
  app.innerHTML = gateHtml();
  $id("mb-gate-go").onclick = e => askGate(my, e.currentTarget);
}
const COIN_OPTS = () => [{v: "20", img: IMG.coin, t: "20 monedas"}, {v: "50", img: IMG.coin, t: "50 monedas"}];
const deco = () => adornos().map(it => ({v: it.id, html: W.vocabShop && typeof vocabShop.img === "function" ? vocabShop.img(it) : "", t: it.n}));
const giftOpts = () => [...COIN_OPTS(), ...deco()];
const giftName = v => { const o = giftOpts().find(x => x.v === v); return o ? cap(o.t) : ""; };
const lockName = (k, l) => { const K = LOCKS[k]; return K ? K.form(l) : ""; };
const pickValue = () => FORM.mode === "gift" ? giftName(FORM.gift) : ({les3: "3 lecciones", rev30: "30 palabras", days3: "3 días"})[FORM.lock] || "";
function formHtml(){
  const l = FORM.lang || curAb();
  return `<div class="mb mb-form" id="mb-form">
    <header class="mb-hd"><img class="mb-hd-i" src="${IMG.env}" alt="" width="60" height="60" draggable="false">
      <div><h1 class="mb-t">Contestar con una carta</h1><p class="mb-sub">La carta va dentro del enlace: no pasa por ningún servidor de la app, solo por la app con la que lo mandes.</p></div></header>
    <form id="mb-f" novalidate autocomplete="off">
    <section class="st-sec"><div class="st-g">
      <label class="st-r mb-fr"><span class="mb-fl" id="mb-f-de">De</span><input class="mb-fi" id="mb-from" name="from" maxlength="24" placeholder="Tu nombre: «Tío Juan»" aria-labelledby="mb-f-de" required></label>
      <label class="st-r mb-fr"><span class="mb-fl" id="mb-f-para">Para</span><input class="mb-fi" id="mb-to" name="to" maxlength="24" placeholder="Su nombre (si quieres)" aria-labelledby="mb-f-para"></label></div>
      <p class="mb-err" id="mb-e-from" hidden><span aria-hidden="true">✗</span><span>Escribe tu nombre</span></p></section>
    <section class="st-sec"><h2 class="st-h" id="mb-f-l">Idioma que aprende</h2>
      <div class="seg mb-seg" role="radiogroup" aria-labelledby="mb-f-l" aria-describedby="mb-f-ln">${Object.keys(LK).map(k => `<button type="button" class="seg-i" role="radio" data-l="${k}" aria-checked="${k === l}" tabindex="${k === l ? 0 : -1}">${esc(cap(lname(k)))}</button>`).join("")}</div>
      <p class="mb-fnote" id="mb-f-ln">Puedes escribir en español. La voz lee la carta en el idioma en que la escribas.</p></section>
    <section class="st-sec"><h2 class="st-h" id="mb-f-m">Mensaje</h2><div class="st-g">
      <label class="st-r mb-fr col"><textarea class="mb-fi" id="mb-msg" name="msg" maxlength="280" rows="5" placeholder="¡Qué bien hablas! Estoy muy orgulloso de ti." aria-labelledby="mb-f-m" aria-describedby="mb-cnt"></textarea>
        <span class="mb-cnt" id="mb-cnt" aria-live="polite">0 / 280</span></label></div>
      <p class="mb-err" id="mb-e-msg" hidden><span aria-hidden="true">✗</span><span>Escribe el mensaje</span></p></section>
    <section class="st-sec"><h2 class="st-h" id="mb-f-s">Sorpresa</h2>
      <div class="seg mb-seg" role="radiogroup" aria-labelledby="mb-f-s">
        <button type="button" class="seg-i" role="radio" data-mode="gift" aria-checked="${FORM.mode === "gift"}" tabindex="${FORM.mode === "gift" ? 0 : -1}">${IC("gift", "bold", 18)}Un regalo</button>
        <button type="button" class="seg-i" role="radio" data-mode="lock" aria-checked="${FORM.mode === "lock"}" tabindex="${FORM.mode === "lock" ? 0 : -1}">${IC("lock", "bold", 18)}Un candado</button></div>
      <div class="st-g" style="margin-top:8px"><button type="button" class="st-r mb-pick" id="mb-pick" aria-haspopup="dialog">
        <span class="st-l" id="mb-pick-l"></span><span class="mb-pv" id="mb-pv"></span>${IC("caret-right", "bold", 16, "mb-chev")}</button></div>
      <p class="mb-fnote" id="mb-s-note"></p></section>
    <button type="submit" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" id="mb-make" data-key="enter"></button>
    </form>
  </div>`;
}
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
/* la fila «Regalo ……… 50 monedas ›» o «Candado ……… 3 lecciones ›», su nota y el botón de abajo */
function paintPick(){
  const g = FORM.mode === "gift";
  txt(D, "#mb-pick-l", g ? "Regalo" : "Candado");
  txt(D, "#mb-pv", pickValue());
  const pk = $id("mb-pick"); if(pk) pk.setAttribute("aria-label", `${g ? "Regalo" : "Candado"}: ${g ? pickValue() : lockName(FORM.lock, FORM.lang || curAb())}. Cambiar`);
  txt(D, "#mb-s-note", g ? "El regalo se da una sola vez, al abrir la carta." : `${lockName(FORM.lock, FORM.lang || curAb())}: la carta llega cerrada y se abre sola al conseguirlo.`);
  const mk = $id("mb-make"); if(!mk) return;
  /* con el enlace ya hecho, el botón pasa a gris («Ver el enlace»); cualquier cambio hace otra carta */
  mk.classList.toggle("glass-btn--pri", !FORM.made);
  mk.innerHTML = FORM.made ? `${IC("eye", "bold", 22)}Ver el enlace` : `${IC("envelope-simple", "bold", 22)}Crear el enlace`;
}
function changed(){ if(FORM.made){ FORM.made = null; paintPick(); } }
/* las hojas para elegir el regalo (Monedas · Adornos) o el candado: tocar una opción la elige y cierra */
function pickSheet(from){
  const g = FORM.mode === "gift", l = FORM.lang || curAb();
  const d = sheet("mb-pick-s", "mb-pk-t");
  const opt = o => `<label class="mb-opt${FORM.gift === o.v ? " is-on" : ""}"><input type="radio" name="gift" value="${esc(o.v)}"${FORM.gift === o.v ? " checked" : ""}>${o.img ? `<img src="${o.img}" alt="" width="44" height="44" draggable="false">` : o.html || ""}<span>${esc(cap(o.t))}</span></label>`;
  d.innerHTML = `<div class="m-head"><h2 id="mb-pk-t">${g ? "Regalo" : "Candado"}</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Listo</button></div>
    ${g ? `<h3 class="mb-gh">Monedas</h3><div class="st-g"><div class="mb-opts" role="radiogroup" aria-label="Monedas">${COIN_OPTS().map(opt).join("")}</div></div>
      <h3 class="mb-gh">Adornos para la granja</h3><div class="st-g"><div class="mb-opts" role="radiogroup" aria-label="Adornos">${deco().map(opt).join("")}</div></div>
      <p class="mb-fnote">Si ya tiene ese adorno, le llegan 20 monedas.</p>`
    : `<div class="st-g"><div class="mb-opts rows" role="radiogroup" aria-label="Candado" id="mb-lock-l">${Object.keys(LOCKS).map(k => `<label class="mb-opt${FORM.lock === k ? " is-on" : ""}"><input type="radio" name="lock" value="${k}"${FORM.lock === k ? " checked" : ""}>${IC(LOCKS[k].ic, "bold", 22)}<span>${esc(LOCKS[k].form(l))}</span>${IC("check", "bold", 20, "mb-ck")}</label>`).join("")}</div></div>
      <p class="mb-fnote">Cuenta lo que haga desde que abra el enlace.</p>`}`;
  d.onchange = e => {
    const r = e.target; if(!r || r.type !== "radio") return;
    if(r.name === "gift") FORM.gift = r.value; else if(r.name === "lock") FORM.lock = r.value; else return;
    d.querySelectorAll(`input[name="${r.name}"]`).forEach(x => x.closest(".mb-opt").classList.toggle("is-on", x.checked));
    changed(); paintPick();
    setTimeout(() => closeSheet(d), rm() ? 0 : 120);
  };
  /* tocar la que ya estaba elegida también cierra la hoja (no hay cambio que avise) */
  let pre = null;
  d.onpointerdown = e => { const o = e.target.closest && e.target.closest(".mb-opt"), r = o && o.querySelector("input"); pre = r && r.checked ? r : null; };
  d.onclick = e => {
    const o = e.target.closest && e.target.closest(".mb-opt"); if(!o || !pre || o.querySelector("input") !== pre) return;
    pre = null; setTimeout(() => closeSheet(d), rm() ? 0 : 120);
  };
  openSheet(d, from);
  const on = d.querySelector("input:checked"); if(on) setTimeout(() => { try{ on.focus({preventScroll: true}); }catch(e){} }, 60);
}
function formView(my){
  const app = $id("app");
  if(!FORM.lang) FORM.lang = curAb();
  if(!FORM.to) FORM.to = kidName();
  app.innerHTML = formHtml();
  const f = $id("mb-f"), from = $id("mb-from"), to = $id("mb-to"), msg = $id("mb-msg"), cnt = $id("mb-cnt");
  from.value = FORM.from; to.value = FORM.to; msg.value = FORM.msg;
  const count = () => { cnt.textContent = `${[...msg.value].length} / 280`; };
  count(); paintPick();
  from.addEventListener("input", () => { FORM.from = from.value; $id("mb-e-from").hidden = true; changed(); });
  to.addEventListener("input", () => { FORM.to = to.value; changed(); });
  msg.addEventListener("input", () => { FORM.msg = msg.value; count(); $id("mb-e-msg").hidden = true; changed(); });
  const segL = app.querySelector('[aria-labelledby="mb-f-l"]'), segS = app.querySelector('[aria-labelledby="mb-f-s"]');
  const pickL = b => { FORM.lang = b.dataset.l; roving(segL, "[data-l]", b); changed(); paintPick(); };
  const pickS = b => { FORM.mode = b.dataset.mode; roving(segS, "[data-mode]", b); changed(); paintPick(); };
  segL.querySelectorAll("[data-l]").forEach(b => b.addEventListener("click", () => pickL(b)));
  segS.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => pickS(b)));
  radioKeys(segL, "[data-l]", pickL); radioKeys(segS, "[data-mode]", pickS);
  $id("mb-pick").onclick = e => pickSheet(e.currentTarget);
  f.addEventListener("submit", e => { e.preventDefault(); if(FORM.made) resSheet($id("mb-make")); else make(app, my); });
}
/* «¡Carta lista!»: una hoja con lo que lleva la carta (no el enlace entero), «Compartir» (o «Copiar» sin Web Share) */
function resSheet(from){
  const m = FORM.made; if(!m) return;
  const share = typeof navigator.share === "function";
  const d = sheet("mb-res", "mb-res-h");
  const what = m.o.gift != null ? giftName(String(m.o.gift)) : lockName(m.o.lock, m.o.lang);
  d.innerHTML = `<div class="m-head"><h2 id="mb-res-h">¡Carta lista!</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Listo</button></div>
    <div class="mb-pre"><img src="${IMG.env}" alt="" width="44" height="44"><span><b data-t="t"></b><small data-t="s"></small></span></div>
    <p>Mándale este enlace por WhatsApp o por correo. Al abrirlo, la carta llega a su Buzón.</p>
    <p>Si usa la app desde la pantalla de inicio del iPhone o el iPad, que copie el enlace y lo pegue en Juegos › Buzón.</p>
    <textarea class="mb-link vh" id="mb-link" readonly rows="3" aria-label="Enlace de la carta" tabindex="-1"></textarea>
    <div class="mb-res-b">${share ? `<button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" id="mb-share" data-key="enter">${IC("share-network", "bold", 22)}Compartir</button>` : ""}
      <button type="button" class="glass-btn glass-btn--block${share ? "" : " glass-btn--pri glass-btn--lg"}" id="mb-copy"${share ? "" : ' data-key="enter"'}>${IC("copy", "bold", 20)}Copiar el enlace</button>
      <button type="button" class="glass-btn glass-btn--block" id="mb-another">${IC("pencil-simple", "bold", 20)}Escribir otra</button></div>
    <p class="mb-cp" id="mb-cp" role="status" aria-live="polite"></p>`;
  txt(d, "[data-t=t]", `Carta de ${m.o.from}`);
  txt(d, "[data-t=s]", [m.o.to ? `Para ${m.o.to}` : "", what].filter(Boolean).join(" · "));
  const ta = d.querySelector("#mb-link"); ta.value = m.u;
  d.querySelector("#mb-copy").onclick = async () => {
    const ok = await copy(ta.value, ta);
    if(!ok){ ta.classList.remove("vh"); ta.removeAttribute("tabindex"); }
    txt(d, "#mb-cp", ok ? "¡Copiado! Pégalo en un mensaje." : "Mantén pulsado el enlace para copiarlo.");
  };
  const sh = d.querySelector("#mb-share");
  if(sh) sh.onclick = () => {
    const t = m.o.to ? `¡${m.o.to}, tienes carta en el Buzón!` : "¡Tienes carta en el Buzón!";
    try{ Promise.resolve(navigator.share({title: "Una carta para ti", text: t, url: m.u})).catch(() => {}); }catch(e){}
  };
  d.querySelector("#mb-another").onclick = () => {
    FORM.msg = ""; FORM.made = null;
    closeSheet(d, true);
    const app = $id("app"); if(app && $id("mb-f")){ $id("mb-msg").value = ""; $id("mb-cnt").textContent = "0 / 280"; paintPick(); }
    try{ $id("mb-msg").focus({preventScroll: true}); }catch(e){}
    window.scrollTo(0, 0);
  };
  openSheet(d, from);
}
async function make(app, my){
  const from = cleanText(FORM.from, 24, false), to = FORM.to.trim() ? cleanText(FORM.to, 24, false) : "", msg = cleanText(FORM.msg, 280, true);
  $id("mb-e-from").hidden = !!from; $id("mb-e-msg").hidden = !!msg;
  if(!from){ $id("mb-from").focus(); return; }
  if(!msg){ $id("mb-msg").focus(); return; }
  const o = {v: 1, id: rid(12), from};
  if(to) o.to = to;
  o.msg = msg; o.lang = has(LK, FORM.lang) ? FORM.lang : curAb();
  if(FORM.mode === "lock") o.lock = has(LOCKS, FORM.lock) ? FORM.lock : "les3";
  else o.gift = /^\d+$/.test(FORM.gift) ? +FORM.gift : FORM.gift;
  /* una carta con regalo: la Puerta, salvo la recién resuelta para entrar (vale para una carta) */
  if(o.gift != null && W.adultGate){
    if(!GIFTOK){
      try{ adultGate.forget(); }catch(e){}
      GATE = true;
      const ok = await Promise.resolve(adultGate({reason: "Para mandar un regalo en la carta.", from: $id("mb-make")})).catch(() => false);
      GATE = false;
      if(!ok || my !== NAV || !$id("mb-f")) return;
    }
    GIFTOK = false;
  }
  const u = link(o);
  /* comprobación: el enlace se lee igual que se escribió */
  const back = u && decode(u.split("?d=")[1]);
  if(!u || !back || JSON.stringify(back) !== JSON.stringify(clean(o))){ notice("No se ha podido crear el enlace. Prueba con un mensaje más corto."); return; }
  if(o.gift != null) try{ adultGate.forget(); }catch(e){}   /* la siguiente con regalo vuelve a preguntar */
  FORM.made = {u, o: back};
  paintPick();
  resSheet($id("mb-make"));
}

/* ---------- #/carta ---------- */
const envHtml = lock => `<div class="mb-env${lock ? " is-lock" : ""}" id="mb-env" aria-hidden="true"><i class="mb-e-back"></i><i class="mb-e-paper"></i><i class="mb-e-front"></i><i class="mb-e-flap"></i>
  <i class="mb-e-seal">${lock ? IC("lock", "bold", 22) : IC("heart", "fill", 22)}</i></div>`;
function badHtml(t, sub){
  return `<div class="mb"><div class="card mb-bad"><div class="mb-bad-i" aria-hidden="true">✗</div><h1 class="mb-t">${esc(t)}</h1><p>${esc(sub)}</p>
    <a class="glass-btn glass-btn--pri" href="#/buzon" data-key="enter">${IC("envelope-simple", "bold", 20)}Ir al Buzón</a></div></div>`;
}
/* el enlace pegado en «Pegar el enlace de una carta» o con «Abrir aquí» ya elegido: no se pregunta dónde abrirla */
let HERE = "";
/* #/carta?d=… → #/carta/<id> sin dejar el enlace en el historial */
function applyRepl(){
  const to = REPL; REPL = null;
  if(!to || typeof hashPath !== "function" || hashPath() !== "carta") return;
  try{ history.replaceState(history.state, "", location.pathname + location.search + to); }catch(e){ return; }
  try{ if(TABMEM.jugar){ TABMEM.jugar.h = to; memSave(); } }catch(e){}
}
function cartaView(parts, my){
  const app = $id("app");
  if(!parts[0]){
    const q = new URLSearchParams(location.hash.split("?")[1] || "");
    if(!q.has("d")){ location.replace("#/buzon"); return; }
    const d = q.get("d"), c = decode(d);
    if(!c){ REPL = "#/carta"; app.innerHTML = badHtml("Esta carta no se puede abrir", "Puede que el enlace llegara cortado. Pide que te lo manden otra vez."); return; }
    /* en el iPhone o el iPad fuera de la app instalada (no ve lo guardado en ella), o con una partida nueva: antes de
       que llegue (y de dar el regalo a una partida vacía), dónde abrirla */
    const known = box().l.some(x => x.id === c.id);
    if(!known && HERE !== d && (iosBrowser() || freshSave())){ whereView(app, d, c, my); return; }
    HERE = "";
    const r = receive(c);
    REPL = "#/carta/" + r.letter.id;
    letterView(app, r.letter.id, my);
    return;
  }
  let id = ""; try{ id = decodeURIComponent(parts[0]); }catch(e){ id = ""; }
  if(!ID_RE.test(id)){ app.innerHTML = badHtml("No encuentro esa carta", "Puede que se borrara. ¡Mira en tu Buzón!"); return; }
  letterView(app, id, my);
}
function whereView(app, d, c, my){
  const fresh = freshSave(), url = `${appUrl()}#/carta?d=${d}`;
  app.innerHTML = `<div class="mb" id="mb-wv"><div class="mb-stage">${envHtml(!!c.lock)}</div>
    <h1 class="mb-t mb-c">¡Tienes carta!</h1>
    <p class="mb-sub mb-c"><span>De </span><b data-t="from"></b></p>
    <section class="card mb-card mb-where" style="margin-top:16px" aria-labelledby="mb-wv-q">
      <p id="mb-wv-q"><b>¿Juegas con Vocabulary desde la pantalla de inicio?</b> Copia este enlace y pégalo allí, en Juegos › Buzón, para que la carta llegue a tu partida.</p>
      <button type="button" class="glass-btn glass-btn--block${fresh ? " glass-btn--pri glass-btn--lg" : ""}" id="mb-wv-copy"${fresh ? ' data-key="enter"' : ""}>${IC("copy", "bold", 20)}Copiar el enlace</button>
      <button type="button" class="glass-btn glass-btn--block${fresh ? "" : " glass-btn--pri glass-btn--lg"}" id="mb-wv-here"${fresh ? "" : ' data-key="enter"'}>${IC("envelope-open", "bold", 20)}Abrir aquí</button>
      <textarea class="mb-link vh" id="mb-wv-l" readonly rows="3" aria-label="Enlace de la carta" tabindex="-1"></textarea>
      <p class="mb-cp" id="mb-wv-m" role="status" aria-live="polite"></p></section></div>`;
  txt(app, "[data-t=from]", c.from);
  const ta = $id("mb-wv-l"); ta.value = url;
  $id("mb-wv-copy").onclick = async () => {
    const ok = await copy(url, ta);
    if(!ok){ ta.classList.remove("vh"); ta.removeAttribute("tabindex"); }
    txt(app, "#mb-wv-m", ok ? "¡Copiado! Ahora abre Vocabulary y pégalo en Juegos › Buzón." : "Mantén pulsado el enlace para copiarlo.");
  };
  $id("mb-wv-here").onclick = () => {
    if(my !== NAV) return;
    HERE = d;
    cartaView([], my);
    applyRepl();
  };
}
function letterView(app, id, my){
  const b = box(), L = b.l.find(x => x.id === id);
  if(!L){ app.innerHTML = badHtml("No encuentro esa carta", "Puede que se borrara. ¡Mira en tu Buzón!"); return; }
  if(L.lock && !L.u && !L.o) unlockDue(b);
  if(L.o){ openView(app, L, false, my); return; }
  if(L.lock && !L.u){ lockedView(app, L); return; }
  closedView(app, L, my);
}
function closedView(app, L, my){
  app.innerHTML = `<div class="mb" id="mb-cv"><div class="mb-stage">${envHtml(false)}</div>
    <h1 class="mb-t mb-c">${L.lock ? "¡Se abrió el candado!" : "¡Tienes carta!"}</h1>
    <p class="mb-sub mb-c"><span>De </span><b data-t="from"></b></p>
    <button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block mb-go" id="mb-open" data-key="enter">${IC("envelope-open", "bold", 22)}Abrir la carta</button></div>`;
  txt(app, "[data-t=from]", L.from);
  const go = () => { unlockVoice(); runOpen(app, L.id, my); };
  $id("mb-open").onclick = go;
  if(AUTO === L.id){ AUTO = ""; go(); }   /* desde la fila de Hoy: el toque ya fue el de abrir */
}
function lockedView(app, L){
  const s = lockState(L), pct = Math.round(100 * s.have / s.need), steps = s.need <= 5;
  const prog = steps
    ? `<ol class="mb-steps" role="img" aria-label="${s.have} de ${s.need} ${esc(s.units)}">${Array.from({length: s.need}, (x, i) => `<li${i < s.have ? ' class="is-done"' : ""}>${i < s.have ? IC("check", "bold", 18) : i + 1}</li>`).join("")}</ol>`
    : `<div class="mb-bar" role="progressbar" aria-label="Lo que llevas" aria-valuemin="0" aria-valuemax="${s.need}" aria-valuenow="${s.have}" aria-valuetext="${s.have} de ${s.need} ${esc(s.units)}"><i style="width:${pct}%"></i></div>`;
  app.innerHTML = `<div class="mb" id="mb-lv"><div class="mb-stage">${envHtml(true)}</div>
    <h1 class="mb-t mb-c">Carta con candado</h1>
    <p class="mb-sub mb-c"><span>De </span><b data-t="from"></b></p>
    <section class="card mb-card" style="margin-top:16px">
      <p class="mb-lk-t">${esc(s.text)}</p>
      ${prog}
      <p class="mb-lk-n">${s.have} de ${s.need} ${esc(s.units)}</p>
      <a class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" href="${s.go}" data-key="enter">${IC(s.ic, "bold", 20)}${esc(s.btn)}</a>
      ${s.lang && LK[s.lang] !== lang ? `<p class="mb-lk-l">Cuenta lo que hagas en ${esc(lname(s.lang))}: cámbialo con la bandera de arriba.</p>` : ""}
    </section></div>`;
  txt(app, "[data-t=from]", L.from);
}
/* el sobre se abre, la hoja sale de él y se hace la carta; luego su voz y el regalo */
async function runOpen(app, id, my){
  const L = open(id); if(!L){ letterView(app, id, my); return; }
  PEND = L.gift != null ? L.id : "";
  const env = $id("mb-env"), btn = $id("mb-open");
  if(btn){ btn.disabled = true; btn.setAttribute("aria-disabled", "true"); }
  let from = null;
  if(env && !rm()){
    env.classList.add("is-open");
    await sleep(720);
    const p = env.querySelector(".mb-e-paper"); if(p) from = p.getBoundingClientRect();
  }
  if(my !== NAV) return;
  openView(app, L, true, my, from);
}
function giftHtml(){
  return `<section class="card mb-gift" id="mb-gift" hidden aria-live="polite"><span class="mb-gift-i" id="mb-gift-i" aria-hidden="true"></span>
    <span class="mb-gift-t"><b id="mb-gift-b"></b><small id="mb-gift-s"></small><span class="mb-gift-w" id="mb-gift-w" hidden></span></span></section>`;
}
function openView(app, L, fresh, my, from){
  const ab = msgLang(L.msg, L.lang), code = codeOf(ab), anim = fresh && !rm();
  app.innerHTML = `<div class="mb" id="mb-ov">
    <article class="card mb-paper" aria-labelledby="mb-sig">
      <p class="mb-to" data-t="to"${L.to ? "" : " hidden"}></p>
      <p class="mb-msg" data-t="msg" lang="${esc(code)}"></p>
      <p class="mb-sig" id="mb-sig" data-t="from"></p>
      <div class="mb-aud"><button type="button" class="mb-spk" id="mb-say" data-key="space" aria-label="Escuchar la carta">${IC("speaker-high", "fill", 24)}</button>
        <button type="button" class="mb-slow" id="mb-say-s" data-key="shift+space" aria-label="Escuchar despacio">${IC("turtle", "fill", 26)}</button></div>
    </article>
    ${L.gift != null ? giftHtml() : L.lock ? `<p class="mb-note mb-c${anim ? " mb-in mb-in2" : ""}" style="margin:0 auto 16px">${IC("lock-open", "bold", 18)} Carta secreta: la abriste ${esc(LOCKS[L.lock].form(L.lang).toLowerCase())}.</p>` : ""}
    <a class="glass-btn glass-btn--block${anim ? " mb-in mb-in2" : ""}" href="#/buzon">${IC("envelope-simple", "bold", 20)}Ir al Buzón</a></div>`;
  if(L.to) txt(app, "[data-t=to]", `Para ${L.to}`);
  txt(app, "[data-t=msg]", L.msg); txt(app, "[data-t=from]", `— ${L.from}`);
  /* la hoja que salió del sobre se hace la carta, en su sitio */
  const paper = app.querySelector(".mb-paper");
  if(anim && paper && paper.animate){
    const r = paper.getBoundingClientRect();
    const kf = from && r.width ? [{transform: `translate(${(from.left + from.width / 2) - (r.left + r.width / 2)}px, ${from.top - r.top}px) scale(${Math.max(.2, from.width / r.width)})`, opacity: .85},
      {transform: "none", opacity: 1}] : [{transform: "translateY(12px)", opacity: 0}, {transform: "none", opacity: 1}];
    try{ paper.style.transformOrigin = "50% 0"; paper.animate(kf, {duration: 420, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards"}); }catch(e){}
  }
  const sb = $id("mb-say"), ss = $id("mb-say-s");
  sb.onclick = () => speak(L.msg, code, sb);
  ss.onclick = () => speak(L.msg, code, ss, true);
  if(L.gift == null) return;
  const b0 = box(), paid = b0.paid.includes(L.id);
  if(paid){ showGift(app, L, null, true); PEND = ""; return; }
  if(!fresh){   /* abierta antes con el regalo guardado para otro día: si hoy ya puede, llega ahora */
    PEND = "";
    const g = $id("mb-gift"); if(g) g.hidden = false;
    showGift(app, L, pay(L.id, $id("mb-gift-i")), false);
    return;
  }
  /* la primera vez: la voz lee el mensaje y luego sale el regalo (sin voz, al momento) */
  const t0 = Date.now();
  Promise.race([speak(L.msg, code, sb), sleep(9000)]).then(async () => {
    const w = 900 - (Date.now() - t0); if(w > 0) await sleep(w);
    if(my !== NAV || PEND !== L.id) return;
    PEND = "";
    const g = $id("mb-gift"); if(g) g.hidden = false;
    showGift(app, L, pay(L.id, $id("mb-gift-i")), false);
  });
}
function showGift(app, L, r, past){
  const g = $id("mb-gift"); if(!g) return;
  g.hidden = false;
  const later = !!(r && r.later);
  g.classList.toggle("is-later", later);
  const gi = $id("mb-gift-i"), gw = $id("mb-gift-w");
  let it = null;
  if(typeof L.gift === "number"){
    gi.innerHTML = `<img src="${IMG.coin}" alt="" width="64" height="64">`;
    txt(app, "#mb-gift-b", later ? "¡Tu regalo llega mañana!" : past ? `Te regaló ${L.gift} monedas` : `¡${L.gift} monedas!`);
  } else {
    it = adornos().find(x => x.id === L.gift) || (typeof itemById === "function" ? itemById(L.gift) : null);
    gi.innerHTML = it && W.vocabShop && typeof vocabShop.img === "function" ? vocabShop.img(it) : `<img src="${IMG.gift}" alt="" width="64" height="64">`;
    const n = it ? (typeof art === "function" ? art(it.n) : it.n) : "un regalo";
    txt(app, "#mb-gift-b", later ? "¡Tu regalo llega mañana!" : r && r.had ? `¡Ya lo tenías! Te regala ${r.coins} monedas` : past ? `Te regaló ${n}` : `¡Es ${n} para tu granja!`);
  }
  txt(app, "#mb-gift-s", later ? "Hoy ya te llegó un regalo. Mañana abre esta carta otra vez." : it && !(r && r.had) ? "Ya está en tu granja." : `Regalo de ${L.from}`);
  gw.hidden = true; gw.innerHTML = "";
  if(it && !later && typeof itemWord === "function"){
    const w = itemWord(it); gw.hidden = false;
    gw.innerHTML = `<span data-t="w"></span><button type="button" class="mb-spk" id="mb-gift-say" aria-label="Oír la palabra">${IC("speaker-high", "fill", 24)}</button>`;
    txt(gw, "[data-t=w]", w);
    $id("mb-gift-say").onclick = e => { if(typeof say === "function") say(w, e.currentTarget); };
    if(!past && typeof say === "function") setTimeout(() => { if($id("mb-gift-say")) say(w, $id("mb-gift-say")); }, 500);
  }
  if(!past && !later && !rm() && W.M && typeof M.burst === "function") try{ M.burst(gi, {n: 14}); }catch(e){}
}

/* ---------- Hoy ---------- */
function slotRow(L, t, s, icon){
  const a = D.createElement("a");
  a.className = "card hm-row mb-row"; a.id = "mb-row"; a.href = "#/carta/" + encodeURIComponent(L.id);
  a.innerHTML = `<span class="hm-ric emo mb-ric" aria-hidden="true">${icon}</span><span class="hm-rt"><span data-t="t"></span><small data-t="s"></small></span>${IC("caret-right", "bold", 16, "hm-chev")}`;
  txt(a, "[data-t=t]", t); txt(a, "[data-t=s]", s);
  a.setAttribute("aria-label", `${t}. ${s}`);
  return a;
}
function slot(){
  const L = unread()[0];
  if(!L){
    /* un regalo que se guardó para hoy */
    const b = box(), w = giftToday(b) ? null : waitingGift(b)[0];
    if(!w) return null;
    css();
    return slotRow(w, "¡Ya llegó tu regalo!", `De ${w.from} · Toca para verlo`, IC("gift", "bold", 18));
  }
  css();
  const t = L.lock ? "¡Se abrió el candado!" : "¡Tienes carta!", s = L.lock ? `Carta de ${L.from} · Toca para leerla` : `De ${L.from} · Toca para abrirla`;
  const a = slotRow(L, t, s, `<img src="${IMG.env}" alt="" width="26" height="26" draggable="false">`);
  a.addEventListener("click", () => { unlockVoice(); AUTO = L.id; });
  /* un solo reclamo en Hoy: el sobre tiembla (3 veces) y el zorro no saluda esta vez */
  if(!rm()){ a.classList.add("is-new"); try{ waveAt = Date.now(); }catch(e){} }
  return a;
}
slot.id = "mail";
if(typeof HOME_SLOTS !== "undefined") HOME_SLOTS.unshift(slot);
/* una carta con candado aún cerrada: el reto y cómo va (la fila que menos manda de Hoy) */
function lockSlot(){
  const b = box(); if(!b.l.length) return null;
  unlockDue(b);
  const L = b.l.find(x => x.lock && !x.u && !x.o); if(!L) return null;
  const s = lockState(L); if(!s) return null;
  return {icon: "lock", tone: "gray", t: `Carta de ${L.from}`, sub: `Con candado · ${s.have} de ${s.need} ${s.units}`, href: "#/carta/" + encodeURIComponent(L.id),
    label: `Carta con candado de ${L.from}: ${s.have} de ${s.need} ${s.units}`};
}
lockSlot.id = "mail-lock";
if(typeof HOME_SLOTS !== "undefined") HOME_SLOTS.push(lockSlot);

/* ---------- Juegos: la tarjeta que lleva al Buzón ---------- */
function cardLine(){
  const n = unread().length; if(n) return n === 1 ? "¡1 carta nueva!" : `¡${n} cartas nuevas!`;
  const k = box().l.filter(L => !L.o).length; if(k) return k === 1 ? "1 carta con candado" : `${k} cartas con candado`;
  const r = (MEDIA.kinds ? MEDIA.kinds.mail : MEDIA.audio) || 0; if(r) return r === 1 ? "1 grabación" : `${r} grabaciones`;   /* solo las del Buzón (no la cápsula del loro) */
  return "Graba tu voz";
}
try{
  if(W.vocabGames && typeof vocabGames.register === "function")
    vocabGames.register("buzon", {t: "Buzón del tío", sub: "Mándale un audio", img: IMG.box, href: "#/buzon", line: cardLine});
}catch(e){ console.error(e); }

/* ---------- Ajustes › Para mayores ---------- */
const mediaText = s => { const p = []; if(s.audio) p.push(s.audio === 1 ? "1 grabación" : `${s.audio} grabaciones`); if(s.photo) p.push(s.photo === 1 ? "1 foto" : `${s.photo} fotos`); return p.length ? `${p.join(" y ")} en este aparato.` : "No queda nada guardado."; };
function adultHtml(){
  return `<section class="st-sec" aria-labelledby="aj-mb-h"><h3 class="st-h" id="aj-mb-h">Buzón del tío</h3><div class="st-g ics">
      <button type="button" class="st-r aj-go" id="aj-mb-reply"><span class="st-ic" aria-hidden="true">${IC("envelope-simple", "bold", 18)}</span>
        <span class="st-l">Contestar una carta del Buzón<small>Un mensaje con un regalo o un candado.</small></span><span class="aj-chev" aria-hidden="true">${IC("caret-right", "bold", 16)}</span></button>
    </div></section>`;
}
/* va aparte, más abajo en Para mayores (después de los atajos), y solo si hay algo guardado */
function mediaHtml(){
  return `<section class="st-sec" id="aj-mb-media" aria-labelledby="aj-mb-mh"${MEDIA.n > 0 ? "" : " hidden"}><h3 class="st-h" id="aj-mb-mh">Grabaciones y fotos</h3><div class="st-g ics">
      <button type="button" class="st-r st-btn" id="aj-mb-del"><span class="st-ic gr" aria-hidden="true">${IC("trash", "bold", 18)}</span>
        <span class="st-l">Borrar grabaciones y fotos<small id="aj-mb-ds">${esc(mediaText(MEDIA))}</small></span></button>
    </div></section>`;
}
bus.on("settings", d => {
  if(!d || d.page !== "mayores" || !d.el) return;
  const rp = d.el.querySelector("#aj-mb-reply"), del = d.el.querySelector("#aj-mb-del"), ds = d.el.querySelector("#aj-mb-ds");
  if(rp) rp.onclick = () => {
    PASS = Date.now();   /* ya pasó la Puerta para entrar en Para mayores (Ajustes la cierra al cerrarse) */
    try{ if(W.vocabSettings) vocabSettings.close(); }catch(e){}
    location.hash = "#/buzon/responder";
  };
  if(!del) return;
  const sec = d.el.querySelector("#aj-mb-media");
  refreshMedia().then(s => { if(!del.isConnected) return; if(sec) sec.hidden = !(s.n > 0); if(ds) ds.textContent = mediaText(s); });
  let armed = 0;
  del.onclick = () => {
    const t = Date.now();
    if(!armed || t - armed > 5000){   /* confirmación: un segundo toque en 5 s */
      armed = t;
      if(ds) ds.textContent = "¿Seguro? Toca otra vez para borrarlas.";
      setTimeout(() => { if(armed === t && ds && ds.isConnected){ armed = 0; ds.textContent = mediaText(MEDIA); } }, 5000);
      return;
    }
    if(t - armed < 400) return;   /* un doble toque sin querer no cuenta */
    armed = 0; del.disabled = true;
    stopAudio(); cancelRec(); R.cur = null; if(R.st === "done" || R.st === "sent") R.st = "idle"; RECS = [];
    Media.clear().then(() => {
      MEDIA = {n: 0, audio: 0, photo: 0};
      if(ds) ds.textContent = "Hecho: se han borrado.";
      notice("Listo: grabaciones borradas", IC("check-circle", "fill", 22));
    }, () => { del.disabled = false; if(ds) ds.textContent = "No se ha podido borrar. Prueba otra vez."; });
  };
});

/* ---------- rutas ---------- */
try{ const T = TABS.find(t => t.id === "jugar"); if(T) ["buzon", "carta"].forEach(s => { if(!T.secs.includes(s)) T.secs.push(s); }); }catch(e){}
ROUTES["buzon"] = async parts => {
  const my = ++NAV; css();
  if(parts[0] === "responder" && parts.length === 1) return replyView(my);
  if(parts.length){ location.replace("#/buzon"); return; }
  return homeView(my);
};
ROUTES["carta"] = async parts => { const my = ++NAV; css(); return cartaView(parts, my); };
/* al dejar una pantalla: se para lo que grababa o sonaba, se cierra su Puerta y, si el regalo no llegó a salir, se da */
function leave(){
  const h = typeof hashPath === "function" ? hashPath() : "";
  if(h !== "buzon"){ stopSoon(); stopAudio(); closeSheets(); }
  if(h !== "buzon/responder" && GATE){ const g = $id("gate"); if(g && g.open) g.close(); }
  if(PEND && h !== "carta/" + PEND){ const id = PEND; PEND = ""; pay(id, null); }
}
addEventListener("hashchange", leave);
D.addEventListener("visibilitychange", () => { if(D.hidden){ stopSoon(); stopAudio(); if(PEND){ const id = PEND; PEND = ""; pay(id, null); } } });
/* #/carta?d=… → #/carta/<id> sin dejar el enlace en el historial (después de pintar: así route() pone las barras) */
bus.on("route", applyRepl);
refreshMedia();

W.vocabMailbox = Object.freeze({
  KEY, TPL, LOCKS, box, letters, clean, encode, decode, link, receive, open, pay, lockState, unread, adornos, shareText, slot, adultHtml, mediaHtml,
  images: () => [...new Set([IMG.box, IMG.env, IMG.coin, IMG.gift, IMG.lock, ...TPL.map(t => t.img)])],
});
})();
