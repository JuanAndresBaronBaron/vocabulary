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
       últimas. Se pide navigator.storage.persist() al guardar la primera.
   Para otros módulos y pruebas:
     window.vocabMedia = {DB, VER, STORE, ok(), put(cosa), get(id), list(kind?) (la más nueva primero), del(id),
       count(kind?), stats() → {n, audio, photo, kinds}, keep(kind, n) (borra las más viejas), clear() (cierra y borra
       la base), persist()} (todo con promesas).
     window.vocabMailbox = {box(), letters(), clean(obj), encode(obj), decode(d), link(obj), receive(obj), open(id),
       pay(id, desde), lockState(carta), unread(), adornos(), shareText(), slot, adultHtml(), images(), TPL, LOCKS,
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
function unlockVoice(){ try{ if("speechSynthesis" in W) speechSynthesis.speak(new SpeechSynthesisUtterance(" ")); }catch(e){} }
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
  /* que el navegador no borre lo grabado cuando le falte sitio (se pide una vez por sesión) */
  function persist(){
    if(asked) return Promise.resolve(null); asked = true;
    try{ if(navigator.storage && typeof navigator.storage.persist === "function") return navigator.storage.persist().catch(() => false); }catch(e){}
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
  days3: Object.freeze({n: 3, one: "día", many: "días", t: () => "Se abre tras 3 días seguidos practicando",
    go: "#/mapa", btn: "Practicar ahora", ic: "flame", form: () => "Tras 3 días seguidos practicando"}),
});
const lessons = L => { const m = store.get("map:" + L, {}); return isObj(m) ? Object.values(m).filter(v => +v > 0).length : 0; };
function reviews(L){
  const m = store.get("srs:" + L, {}); let n = 0;
  if(isObj(m)) for(const x of Object.values(m)) if(isObj(x)) n += Math.max(0, Math.floor(+x.n) || 0);
  return n;
}
const countOf = (lock, l) => lock === "les3" ? lessons(LK[l]) : lock === "rev30" ? reviews(LK[l]) : 0;
/* días seguidos con actividad que acaban hoy (o ayer, si hoy aún no) y empiezan, como pronto, el día en que llegó */
function streakFrom(at){
  const a = store.get("act", {}); if(!isObj(a)) return 0;
  const d = new Date(); if(!(+a[day(d)] > 0)) d.setDate(d.getDate() - 1);
  let s = 0;
  while(s < 400 && day(d) >= at && +a[day(d)] > 0){ s++; d.setDate(d.getDate() - 1); }
  return s;
}
function lockState(L){
  const K = L && LOCKS[L.lock]; if(!K) return null;
  const raw = L.lock === "days3" ? streakFrom(L.at) : countOf(L.lock, L.lang) - (L.b || 0);
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
  const raw = store.get(KEY, null), b = {v: 1, l: [], paid: []};
  if(!isObj(raw)) return b;
  const seen = new Set();
  for(const x of Array.isArray(raw.l) ? raw.l : []){ const L = stored(x); if(L && !seen.has(L.id)){ seen.add(L.id); b.l.push(L); } }
  b.paid = [...new Set((Array.isArray(raw.paid) ? raw.paid : []).filter(id => typeof id === "string" && ID_RE.test(id)))];
  return b;
}
function saveBox(b){
  while(b.l.length > MAXL){   /* poda: la abierta más vieja; si ninguna está abierta, la más vieja */
    let k = -1; for(let i = b.l.length - 1; i >= 0; i--) if(b.l[i].o){ k = i; break; }
    b.l.splice(k < 0 ? b.l.length - 1 : k, 1);
  }
  store.set(KEY, {v: 1, l: b.l, paid: b.paid.slice(-MAXPAID)});
}
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
/* el regalo de una carta abierta, una sola vez: primero se apunta en paid y se guarda, luego se da */
function pay(id, from){
  const b = box(), L = b.l.find(x => x.id === id);
  if(!L || !L.o || L.gift == null || b.paid.includes(L.id)) return null;
  b.paid.push(L.id); saveBox(b);
  if(typeof L.gift === "number"){
    award(L.gift, `Regalo de ${L.from}`, false, from && from.isConnected ? from : null);
    return {coins: L.gift};
  }
  const it = adornos().find(x => x.id === L.gift);
  if(!it) return {none: true};
  const r = W.vocabShop && typeof vocabShop.gift === "function" ? vocabShop.gift(it.id) : {ok: false, reason: "unknown"};
  if(r && r.ok) bus.emit("gift-open", {item: it});
  return {item: it, had: !!(r && !r.ok && r.reason === "owned")};
}

/* ---------- la voz: ¿en qué idioma está el mensaje? ---------- */
const SW = {
  es: "el los las un una unos unas y que del con por para eres estás está muy mucho mucha mi mis tú hola gracias besos beso abrazo abrazos quiero sigue así bien hoy campeón campeona querido querida tío tía cariño qué cómo pero también estoy orgulloso orgullosa feliz guapo guapa",
  en: "the and you your to is are of in it my i love hello hi very well done keep great so proud we this that have be with for good am going",
  fr: "le les et je des une est pour avec bravo bonjour salut mon ma mes ton ta tes très bien bisous suis fier fière continue c'est c’est nous vous t'aime t’aime",
  da: "og du dig jeg er det at et til med på hej godt gået meget min mit din dit kram elsker fortsæt sådan flot stolt af ikke har vi",
};
const ACC = {es: /[ñ¿¡áíóú]/g, fr: /[àâçèêëîïôûùœ]/g, da: /[æøå]/g};
function msgLang(msg, l){
  const s = String(msg || "").toLowerCase(), words = s.match(/[\p{L}'’]+/gu) || [];
  const A = new Set((SW[l] || "").split(" ")), E = new Set(SW.es.split(" "));
  let a = 0, e = 0;
  for(const w of words){ const ia = A.has(w), ie = E.has(w); if(ia && !ie) a++; else if(ie && !ia) e++; }
  a += 2 * (s.match(ACC[l] || /$^/g) || []).length; e += 2 * (s.match(ACC.es) || []).length;
  return a > e ? l : "es";
}
const codeOf = ab => ab === "es" ? "es-ES" : ((typeof LANGS !== "undefined" && LANGS[LK[ab]]) || {}).code || "en-GB";
/* la voz para un idioma: la elegida en Ajustes si es el idioma que aprende; si no, la mejor de ese idioma */
function pickVoice(code){
  try{ if(typeof voiceFor === "function" && LANGS[lang] && LANGS[lang].code === code) return voiceFor(code); }catch(e){}
  let vs = []; try{ vs = speechSynthesis.getVoices() || []; }catch(e){}
  const lc = code.toLowerCase(), base = lc.slice(0, 2), n = v => String(v.lang || "").replace("_", "-").toLowerCase();
  const c = vs.filter(v => n(v).startsWith(base));
  return c.find(v => n(v) === lc && /natural|online|google|neural/i.test(v.name)) || c.find(v => n(v) === lc) || c[0] || null;
}
function speak(text, code, btn){
  return new Promise(res => {
    if(!text || !("speechSynthesis" in W)){ res(false); return; }
    try{ speechSynthesis.cancel(); }catch(e){}
    let done = false, t = 0;
    const fin = v => { if(done) return; done = true; clearTimeout(t); if(btn) btn.classList.remove("playing"); res(v); };
    let u; try{ u = new SpeechSynthesisUtterance(text); }catch(e){ res(false); return; }
    u.lang = code; u.rate = typeof rate === "number" && rate > 0 ? rate : .9;
    const v = pickVoice(code); if(v) u.voice = v;
    u.onend = () => fin(true); u.onerror = () => fin(false);
    t = setTimeout(() => fin(true), Math.min(30000, 2500 + text.length * 110));
    if(btn) btn.classList.add("playing");
    try{ speechSynthesis.speak(u); }catch(e){ fin(false); }
  });
}

/* ---------- estilos ---------- */
const CSS = `
.mb{max-width:640px;margin:0 auto;padding:4px 0 8px}
.mb-hd{display:flex;align-items:center;gap:14px;margin:4px 0 16px}
.mb-hd-i{flex:none;width:60px;height:60px}
.mb-t{margin:0;font:800 var(--fs-t2)/1.15 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.mb-sub{margin:4px 0 0;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label2);overflow-wrap:anywhere}
.mb-c{text-align:center}
.mb-h{margin:0 0 12px;font:700 var(--fs-head)/1.25 var(--f-round);color:var(--label)}
.mb-card{margin:0 0 22px;padding:16px;border-radius:var(--r-card)}
.mb-tpls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.mb-tpl{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;min-width:0;min-height:84px;margin:0;padding:8px 4px;border:0;
  border-radius:18px;background:var(--fill2);color:var(--label);font:600 var(--fs-min)/1.2 var(--f-text);cursor:pointer;-webkit-tap-highlight-color:transparent}
.mb-tpl img{width:40px;height:40px;pointer-events:none}
.mb-tpl span{max-width:100%;overflow-wrap:anywhere;text-align:center}
.mb-tpl[aria-checked=true]{background:var(--brand-soft);box-shadow:inset 0 0 0 2px var(--brand-tint);color:var(--brand-ink)}
:root[data-theme=dark] .mb-tpl[aria-checked=true]{color:#7DBBFF}
.mb-phr{display:flex;align-items:center;gap:12px;margin:14px 0 0;padding:12px 12px 12px 16px;border-radius:18px;background:var(--bg)}
:root[data-theme=dark] .mb-phr{background:var(--card-2)}
.mb-phr-x{flex:1;min-width:0}
.mb-phr-t{margin:0;font:700 var(--fs-t3)/1.25 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.mb-phr-es{margin:2px 0 0;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.mb-spk{flex:none;display:grid;place-items:center;width:48px;height:48px;margin:0;padding:0;border:0;border-radius:50%;background:var(--brand-soft);color:var(--brand-tint);cursor:pointer;-webkit-tap-highlight-color:transparent}
.mb-spk.playing{background:var(--brand-fill);color:#fff}
.mb-ctl{display:flex;flex-direction:column;align-items:center;gap:10px;margin:18px 0 0;text-align:center}
.mb-rb{position:relative;flex:none;width:120px;height:120px;margin:0;padding:0;border:0;border-radius:50%;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.mb-rb-in{position:absolute;inset:10px;display:grid;place-items:center;border-radius:50%;background:var(--brand-fill);color:#fff;box-shadow:0 6px 16px -6px rgba(30,110,244,.6);transition:transform .15s ease}
.mb-rb:active .mb-rb-in{transform:scale(.95)}
.mb-rb.is-rec .mb-rb-in{background:var(--brand-ink)}
.mb-rb[aria-busy=true]{cursor:progress}
.mb-rb[aria-busy=true] .mb-rb-in{background:#8E8E93;box-shadow:none}
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
.mb-info{display:flex;align-items:flex-start;gap:10px;width:100%;box-sizing:border-box;margin:0;padding:12px 14px;border-radius:16px;background:var(--fill2);color:var(--label);font:400 var(--fs-sub)/1.4 var(--f-text);text-align:left}
.mb-info>.ico{flex:none;margin-top:2px;color:var(--label2)}
.mb-sec{margin:0 0 22px}
.mb-sec .st-g{background:var(--card)}
:root[data-theme=dark] .mb-sec .st-g{background:var(--card)}
.mb-rr{gap:10px;padding-top:6px;padding-bottom:6px}
.mb-rp{flex:none;display:grid;place-items:center;width:44px;height:44px;margin:0 0 0 -6px;padding:0;border:0;border-radius:50%;background:var(--brand-soft);color:var(--brand-tint);cursor:pointer}
.mb-rp.playing{background:var(--brand-fill);color:#fff}
.mb-rr .glass-btn{flex:none}
a.st-r.mb-lr{color:var(--label);cursor:pointer}
.mb-lr .st-ic{border-radius:50%}
.mb-lr .st-ic.gd{background:var(--gold);color:var(--gold-on)}
.mb-lr .st-ic.gr{background:#8E8E93}
.mb-lr .st-l b{font-weight:600}
.mb-chev{flex:none;color:var(--label3)}
.mb-foot{display:flex;justify-content:center;margin:0 0 8px}
.mb-quiet{display:inline-flex;align-items:center;gap:6px;min-height:var(--tap);padding:0 12px;border:0;border-radius:var(--r-pill);background:none;color:var(--brand-ink);font:600 var(--fs-sub)/1.2 var(--f-text);cursor:pointer}
:root[data-theme=dark] .mb-quiet{color:#7DBBFF}
/* Hoy: la fila del sobre */
.mb-ric{background:var(--gold-soft)!important}
.mb-ric img{display:block;width:26px;height:26px}
.mb-row.is-new .mb-ric img{animation:mb-shake .7s ease-in-out .35s 3}
@keyframes mb-shake{0%,100%{transform:rotate(0)}20%{transform:rotate(-14deg)}40%{transform:rotate(11deg)}60%{transform:rotate(-8deg)}80%{transform:rotate(5deg)}}
/* el sobre */
.mb-stage{display:grid;place-items:center;margin:8px 0 18px}
.mb-env{position:relative;width:min(240px,64vw);aspect-ratio:3/2;perspective:800px}
.mb-env>i{position:absolute;display:block}
.mb-e-back{inset:0;border-radius:16px;background:#1857C4}
.mb-e-paper{left:8%;right:8%;top:8%;bottom:10%;z-index:2;border-radius:8px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.18);transition:transform .45s cubic-bezier(.2,.8,.2,1) .28s}
.mb-e-paper::before,.mb-e-paper::after{content:"";position:absolute;left:14%;right:14%;height:6px;border-radius:3px;background:#D6E3F6}
.mb-e-paper::before{top:22%}.mb-e-paper::after{top:40%;right:34%}
.mb-e-front{inset:0;z-index:3;border-radius:16px;background:#1E6EF4;clip-path:polygon(0 0,50% 58%,100% 0,100% 100%,0 100%)}
.mb-e-flap{left:0;right:0;top:0;height:62%;z-index:4;border-radius:16px 16px 0 0;background:#3F86F7;clip-path:polygon(0 0,100% 0,50% 100%);transform-origin:50% 0;
  transition:transform .4s ease,z-index 0s linear .2s}
.mb-env>.mb-e-seal{left:50%;top:58%;z-index:5;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;display:grid;place-items:center;background:#FFCC00;color:#3D2B00;
  box-shadow:0 0 0 3px #fff,0 2px 6px rgba(0,0,0,.25);transition:opacity .2s ease,transform .2s ease}
.mb-env.is-lock .mb-e-back{background:#636366}.mb-env.is-lock .mb-e-front{background:#8E8E93}.mb-env.is-lock .mb-e-flap{background:#AEAEB2}
.mb-env.is-lock .mb-e-seal{background:#48484A;color:#fff}
.mb-env.is-open .mb-e-flap{transform:rotateX(180deg);z-index:1}
.mb-env.is-open .mb-e-paper{transform:translateY(-44%)}
.mb-env.is-open .mb-e-seal{opacity:0;transform:scale(.6)}
.mb-go{margin:18px 0 0}
/* la carta */
.mb-paper{margin:0 0 16px;padding:22px 20px 18px;border-radius:var(--r-card)}
.mb-to{margin:0 0 8px;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2);overflow-wrap:anywhere}
.mb-msg{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:600 var(--fs-t3)/1.4 var(--f-round);color:var(--label)}
.mb-sig{margin:14px 0 0;text-align:right;font:700 var(--fs-head)/1.3 var(--f-round);color:var(--brand-ink);overflow-wrap:anywhere}
:root[data-theme=dark] .mb-sig{color:#7DBBFF}
.mb-paper .mb-say{margin:16px 0 0}
.mb-gift{display:flex;align-items:center;gap:14px;margin:0 0 16px;padding:16px;border-radius:var(--r-card)}
.mb-gift[hidden]{display:none}
.mb-gift-i{flex:none;display:grid;place-items:center;width:64px;height:64px;font-size:44px;line-height:1}
.mb-gift-i img,.mb-gift-i .pj{display:block;width:64px;height:64px;object-fit:contain}
.mb-gift-t{flex:1;min-width:0}
.mb-gift-t b{display:block;font:800 var(--fs-head)/1.25 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.mb-gift-t small{display:block;margin-top:2px;font:400 var(--fs-note)/1.35 var(--f-text);color:var(--label2);overflow-wrap:anywhere}
.mb-gift-w{display:flex;align-items:center;gap:6px;margin-top:4px;font:600 var(--fs-sub)/1.3 var(--f-text);color:var(--label)}
.mb-gift-w .mb-spk{width:40px;height:40px}
.mb-in{animation:mb-in .35s ease-out both}
@keyframes mb-in{from{opacity:0;transform:translateY(12px)}}
/* el candado */
.mb-lk-t{margin:0;font:700 var(--fs-head)/1.3 var(--f-round);color:var(--label)}
.mb-bar{height:12px;margin:14px 0 6px;border-radius:6px;background:var(--fill);overflow:hidden}
.mb-bar>i{display:block;height:100%;border-radius:inherit;background:var(--teal)}
.mb-lk-n{margin:0 0 14px;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2);font-variant-numeric:tabular-nums}
.mb-lk-l{margin:12px 0 0;font:400 var(--fs-note)/1.4 var(--f-text);color:var(--label2)}
/* error: gris con ✗ */
.mb-bad{display:flex;flex-direction:column;align-items:center;gap:10px;padding:28px 20px;border-radius:var(--r-card);text-align:center}
.mb-bad-i{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:var(--miss-fill);color:var(--miss-on);font:700 28px/1 var(--f-text)}
.mb-bad p{margin:0;font:400 var(--fs-sub)/1.4 var(--f-text);color:var(--label2)}
/* Contestar (mayores) */
.mb-form .st-sec{margin:0 0 18px}
.mb-fr{cursor:text}
.mb-fr:focus-within{box-shadow:inset 0 0 0 2px var(--brand-tint);border-radius:var(--r-card)}
.mb-fi{flex:1;min-width:0;width:100%;box-sizing:border-box;min-height:var(--tap);margin:0;padding:0;border:0;background:none;color:var(--label);font:400 var(--fs-body)/1.35 var(--f-text);-webkit-appearance:none;appearance:none}
.mb-fi:focus,.mb-fi:focus-visible{outline:none}
.mb-fi::placeholder{color:var(--label2);opacity:.75}
textarea.mb-fi{min-height:132px;padding:12px 0;resize:vertical}
.mb-fr.col{flex-direction:column;align-items:stretch;gap:0}
.mb-cnt{align-self:flex-end;font:400 var(--fs-min)/1.2 var(--f-text);color:var(--label2);font-variant-numeric:tabular-nums}
.mb-seg{margin:0;max-width:none}
.mb-opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;padding:12px}
.mb-opts.rows{grid-template-columns:1fr}
.mb-opt{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:88px;margin:0;padding:10px 6px;border-radius:16px;background:var(--fill2);
  color:var(--label);font:600 var(--fs-min)/1.2 var(--f-text);text-align:center;cursor:pointer;-webkit-tap-highlight-color:transparent}
.mb-opts.rows .mb-opt{flex-direction:row;justify-content:flex-start;gap:12px;min-height:var(--row);padding:8px 14px;font:600 var(--fs-sub)/1.3 var(--f-text);text-align:left}
.mb-opt input{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none}
.mb-opt img,.mb-opt .pj{display:block;width:44px;height:44px;object-fit:contain;pointer-events:none}
.mb-opt .pj-fb{font-size:34px;line-height:44px}
.mb-opt .ico{flex:none}
.mb-opt.is-on{background:var(--brand-soft);box-shadow:inset 0 0 0 2px var(--brand-tint);color:var(--brand-ink)}
:root[data-theme=dark] .mb-opt.is-on{color:#7DBBFF}
.mb-opt:focus-within{outline:3px solid var(--brand-tint);outline-offset:2px}
.mb-opt:not(:focus-within){outline:none}
.mb-err{display:flex;align-items:center;gap:6px;margin:6px 16px 0;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--miss-ink)}
.mb-err[hidden]{display:none}
.mb-link{display:block;width:100%;box-sizing:border-box;min-height:96px;margin:0 0 12px;padding:12px 14px;border:0;border-radius:16px;background:var(--fill2);color:var(--label);
  font:400 var(--fs-note)/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;resize:none}
.mb-cp{min-height:1.3em;margin:8px 0 0;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2);text-align:center}
.mb-res .mb-btns{margin:0 0 10px}
.mb-res p{margin:0 0 12px;font:400 var(--fs-sub)/1.4 var(--f-text);color:var(--label2)}
/* hojas */
dialog.mb-sh{max-width:560px}
dialog.mb-sh.m-sheet.glass{background:var(--bg);-webkit-backdrop-filter:none;backdrop-filter:none}
dialog.mb-sh p{margin:0 0 12px;font:400 var(--fs-sub)/1.4 var(--f-text);color:var(--label2)}
dialog.mb-sh .mb-fi{min-height:48px;padding:0 14px;border-radius:14px;background:var(--card)}
dialog.mb-sh .mb-fi:focus-visible{box-shadow:inset 0 0 0 2px var(--brand-tint)}
dialog.mb-sh .mb-btns{margin:12px 0 0}
dialog.mb-sh .mb-link{background:var(--card)}
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
async function startRec(){
  if(R.st === "ask" || R.st === "rec" || R.st === "saving") return;
  if(!canRec()){ setRec("nomic"); return; }
  stopAudio(); try{ if("speechSynthesis" in W) speechSynthesis.cancel(); }catch(e){}
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
  const type = mimePick(); let mr = null;
  try{ mr = new MediaRecorder(stream, type ? {mimeType: type, audioBitsPerSecond: 64000} : undefined); }
  catch(e){ try{ mr = new MediaRecorder(stream); }catch(e2){ mr = null; } }
  if(!mr){ stopStream(stream); setRec("fail"); return; }
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
  const rec = {id: "mb-" + Date.now().toString(36) + rid(5), kind: "mail", t: Date.now(), type, dur: Math.round(R.dur), buf, tpl: TPLID, lang: curAb()};
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
  clearTimeout(R.timer); cancelAnimationFrame(R.raf);
  if(R.mr){ const mr = R.mr; R.mr = null; R.dur = 0; try{ if(mr.state !== "inactive") mr.stop(); }catch(e){} }
  stopStream(R.stream); R.stream = null;
  if(R.st === "rec" || R.st === "ask" || R.st === "saving") R.st = "idle";
}
/* parar a medias (otra pantalla, la app escondida): se guarda lo grabado */
function stopSoon(){ if(R.st === "rec") stopRec(); else if(R.st === "ask") cancelRec(); }

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
const shareText = () => { const n = kidName(); return `Un mensaje ${n ? `de ${n} ` : ""}desde la app Vocabulary. Para contestar con una carta, abre: ${appUrl()}#/buzon/responder`; };
function download(file){
  let url; try{ url = URL.createObjectURL(file); }catch(e){ return false; }
  const a = D.createElement("a"); a.href = url; a.download = file.name || "mensaje.webm"; a.rel = "noopener"; a.hidden = true;
  D.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => { try{ URL.revokeObjectURL(url); }catch(e){} }, 60000);
  return true;
}
/* dentro del toque: Web Share con el archivo si se puede; si no, se descarga y una hoja da el texto para mandarlo */
function send(rec, from){
  if(!rec || !rec.buf) return;
  stopAudio();
  const file = fileOf(rec), text = shareText(), N = navigator;
  let can = false;
  try{ can = typeof N.share === "function" && typeof N.canShare === "function" && N.canShare({files: [file]}); }catch(e){ can = false; }
  if(can){
    let p; try{ p = N.share({files: [file], text, title: "Un mensaje para ti"}); }catch(e){ p = Promise.reject(e); }
    Promise.resolve(p).then(() => sent(rec, false), e => {
      if(e && e.name === "AbortError") return;   /* lo cerró sin mandar: no pasa nada */
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
const closeSheets = () => ["mb-tx-s", "mb-paste-s"].forEach(id => closeSheet($id(id), true));
function textSheet(file, from){
  const d = sheet("mb-tx-s", "mb-tx-t");
  d.innerHTML = `<div class="m-head"><h2 id="mb-tx-t">Audio guardado</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Listo</button></div>
    <p>Se ha guardado «<b data-t="f"></b>». Mándaselo a tu tío con este texto:</p>
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
    closeSheet(d, true); location.hash = "#/carta?d=" + dd;
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
      <div><h1 class="mb-t">Buzón del tío</h1><p class="mb-sub">Grábale un mensaje en ${esc(L.name || "")}</p></div></header>
    <section class="card mb-card" aria-labelledby="mb-rec-h">
      <h2 class="mb-h" id="mb-rec-h">¿Qué le dices?</h2>
      <div class="mb-tpls" role="radiogroup" aria-label="Frases para empezar">${TPL.map((t, i) => `<button type="button" class="mb-tpl" role="radio" data-tpl="${t.id}" data-key="${i + 1}" aria-checked="${t === T}"><img src="${t.img}" alt="" width="40" height="40" draggable="false"><span>${esc(t.t)}</span></button>`).join("")}</div>
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
const recBtn = (st) => `<button type="button" class="mb-rb${st === "rec" ? " is-rec" : ""}" id="mb-rb" data-key="enter" aria-label="${st === "rec" ? "Parar la grabación" : "Grabar"}"${st === "ask" || st === "saving" ? ' aria-busy="true"' : ""}>
    <svg class="mb-ring" viewBox="0 0 120 120" aria-hidden="true"><circle class="mb-ring-bg" cx="60" cy="60" r="56"/><circle class="mb-ring-fg" id="mb-ring-fg" cx="60" cy="60" r="56" pathLength="100" stroke-dasharray="${st === "rec" ? "100 100" : "0 100"}"/></svg>
    <span class="mb-rb-in" aria-hidden="true">${st === "rec" ? IC("stop", "fill", 40) : IC("microphone", "fill", 44)}</span></button>`;
const NOTE = "Para grabarte, el navegador te preguntará si puede usar el micrófono. Tu voz se queda en este aparato.";
const info = (t, again) => `<p class="mb-info">${IC("info", "bold", 22)}<span>${esc(t)}</span></p>${again ? `<button type="button" class="glass-btn" id="mb-retry">${IC("arrow-counter-clockwise", "bold", 20)}Probar otra vez</button>` : ""}`;
function paintCtl(){
  const el = $id("mb-ctl"); if(!el) return;
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
        <button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" id="mb-send" data-key="enter">${IC("paper-plane-tilt", "bold", 22)}Mandar</button>`
      : `<p class="mb-ok">${IC("check-circle", "fill", 24)}${R.fb ? "¡Audio guardado!" : "¡Mensaje listo!"}</p>
        <p class="mb-note">${R.fb ? "Mándaselo a tu tío con el texto para contestar." : "Cuando tu tío conteste, su carta llegará aquí."}</p>
        <div class="mb-btns"><button type="button" class="glass-btn" id="mb-play" aria-pressed="false"><span class="mb-pi">${IC("play", "fill", 20)}</span>Escucharme</button>
          <button type="button" class="glass-btn glass-btn--pri" id="mb-new" data-key="enter">${IC("microphone", "fill", 20)}Grabar otro</button></div>`;
    const p = $id("mb-play"); if(p && c) p.onclick = () => playRec(c, p);
    const ag = $id("mb-again"); if(ag) ag.onclick = () => again();
    const s = $id("mb-send"); if(s && c) s.onclick = e => send(c, e.currentTarget);
    const n = $id("mb-new"); if(n) n.onclick = () => { stopAudio(); R.cur = null; R.st = "idle"; paintCtl(); };
    return;
  }
  const lbl = st === "ask" ? "Esperando al micrófono…" : st === "saving" ? "Guardando…" : st === "rec" ? `Grabando… quedan ${Math.max(0, Math.ceil((MAXMS - (performance.now() - R.t0)) / 1000))} s`
    : st === "short" ? "Muy cortito. ¡Prueba otra vez!" : "Toca para grabar";
  el.innerHTML = `${recBtn(st)}<p class="mb-rl" id="mb-rl">${esc(lbl)}</p>${PERM !== "granted" && (st === "idle" || st === "short" || st === "ask") ? `<p class="mb-note" id="mb-note">${NOTE}</p>` : ""}`;
  wireCtl(el);
  if(st === "rec") ring();
}
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
function homeView(my){
  const app = $id("app");
  if(R.st === "rec" || R.st === "ask") cancelRec();
  /* al volver al Buzón se empieza otra vez: lo ya grabado está en «Tus grabaciones» */
  if(R.st !== "saving" && R.st !== "nomic"){ stopAudio(); R.cur = null; R.st = canRec() ? (PERM === "denied" ? "denied" : "idle") : "nomic"; }
  app.innerHTML = homeHtml();
  paintCtl(); paintLetters(); paintRecs(); permCheck();
  const tp = app.querySelector(".mb-tpls");
  tp.addEventListener("click", e => {
    const b = e.target.closest(".mb-tpl"); if(!b) return;
    TPLID = b.dataset.tpl;
    tp.querySelectorAll(".mb-tpl").forEach(x => x.setAttribute("aria-checked", String(x === b)));
    const T = tplOf(TPLID); txt(app, "#mb-phr", T.w[curAb()]); txt(app, "#mb-phr-es", T.es);
    if(typeof say === "function") say(T.w[curAb()], $id("mb-spk"));
  });
  $id("mb-spk").onclick = e => { if(typeof say === "function") say(tplOf(TPLID).w[curAb()], e.currentTarget); };
  $id("mb-recs-l").addEventListener("click", e => {
    const row = e.target.closest(".mb-rr"), r = row && RECS.find(x => x.id === row.dataset.id); if(!r) return;
    if(e.target.closest("[data-play]")) playRec(r, e.target.closest("[data-play]"));
    else if(e.target.closest("[data-send]")) send(r, e.target.closest("[data-send]"));
  });
  $id("mb-paste").onclick = e => pasteSheet(e.currentTarget);
}

/* ---------- #/buzon/responder (mayores) ---------- */
const FORM = {from: "", to: "", lang: "", msg: "", mode: "gift", gift: "20", lock: "les3"};
function gateHtml(){
  return `<div class="mb" id="mb-gate"><div class="card mb-bad">
    <div class="mb-bad-i" aria-hidden="true">${IC("lock", "bold", 28)}</div>
    <h1 class="mb-t">Para mayores</h1>
    <p>Aquí un mayor escribe la carta de respuesta. Antes, una cuenta muy fácil.</p>
    <button type="button" class="glass-btn glass-btn--pri" id="mb-gate-go" data-key="enter">${IC("lock-open", "bold", 20)}Soy mayor</button>
    <a class="glass-btn" href="#/buzon">Volver al Buzón</a></div></div>`;
}
function askGate(my, from){
  if(!W.adultGate){ formView(my); return; }
  GATE = true;
  Promise.resolve(adultGate({reason: "Para escribir una carta de respuesta.", from: from || null})).catch(() => false).then(ok => {
    GATE = false;
    if(my !== NAV || hashPath() !== "buzon/responder") return;
    if(ok) formView(my);
  });
}
function replyView(my){
  const app = $id("app");
  if(W.adultGate && (adultGate.passed() || Date.now() - PASS < 8000)){ PASS = 0; formView(my); return; }
  /* antes de nada, para qué es (quien abre el enlace de la respuesta no ve una cuenta de la nada): la Puerta sale al tocar */
  app.innerHTML = gateHtml();
  $id("mb-gate-go").onclick = e => askGate(my, e.currentTarget);
}
const giftOpts = () => [{v: "20", img: IMG.coin, t: "20 monedas"}, {v: "50", img: IMG.coin, t: "50 monedas"},
  ...adornos().map(it => ({v: it.id, html: W.vocabShop && typeof vocabShop.img === "function" ? vocabShop.img(it) : "", t: it.n}))];
function formHtml(){
  const l = FORM.lang || curAb();
  return `<div class="mb mb-form" id="mb-form">
    <header class="mb-hd"><img class="mb-hd-i" src="${IMG.env}" alt="" width="60" height="60" draggable="false">
      <div><h1 class="mb-t">Contestar con una carta</h1><p class="mb-sub">La carta va dentro del enlace: no pasa por ningún servidor.</p></div></header>
    <form id="mb-f" novalidate autocomplete="off">
    <section class="st-sec"><h2 class="st-h" id="mb-f-de">De</h2><div class="st-g">
      <label class="st-r mb-fr"><input class="mb-fi" id="mb-from" name="from" maxlength="24" placeholder="Tu nombre, por ejemplo «Tío Juan»" aria-labelledby="mb-f-de" required></label></div>
      <p class="mb-err" id="mb-e-from" hidden><span aria-hidden="true">✗</span><span>Escribe tu nombre</span></p></section>
    <section class="st-sec"><h2 class="st-h" id="mb-f-para">Para (si quieres)</h2><div class="st-g">
      <label class="st-r mb-fr"><input class="mb-fi" id="mb-to" name="to" maxlength="24" placeholder="Su nombre" aria-labelledby="mb-f-para"></label></div></section>
    <section class="st-sec"><h2 class="st-h" id="mb-f-l">Idioma de la carta</h2>
      <div class="seg mb-seg" role="radiogroup" aria-labelledby="mb-f-l">${Object.keys(LK).map(k => `<button type="button" class="seg-i" role="radio" data-l="${k}" aria-checked="${k === l}">${esc(cap(lname(k)))}</button>`).join("")}</div></section>
    <section class="st-sec"><h2 class="st-h" id="mb-f-m">Mensaje</h2><div class="st-g">
      <label class="st-r mb-fr col"><textarea class="mb-fi" id="mb-msg" name="msg" maxlength="280" rows="5" placeholder="¡Qué bien hablas! Estoy muy orgulloso de ti." aria-labelledby="mb-f-m" aria-describedby="mb-cnt"></textarea>
        <span class="mb-cnt" id="mb-cnt" aria-live="polite">0 / 280</span></label></div>
      <p class="mb-err" id="mb-e-msg" hidden><span aria-hidden="true">✗</span><span>Escribe el mensaje</span></p></section>
    <section class="st-sec"><h2 class="st-h" id="mb-f-s">Sorpresa</h2>
      <div class="seg mb-seg" role="radiogroup" aria-labelledby="mb-f-s">
        <button type="button" class="seg-i" role="radio" data-mode="gift" aria-checked="${FORM.mode === "gift"}">${IC("gift", "bold", 18)}Un regalo</button>
        <button type="button" class="seg-i" role="radio" data-mode="lock" aria-checked="${FORM.mode === "lock"}">${IC("lock", "bold", 18)}Un candado</button></div>
      <div class="st-g" id="mb-gifts" style="margin-top:10px"${FORM.mode === "gift" ? "" : " hidden"}><div class="mb-opts" role="radiogroup" aria-label="Regalo">${giftOpts().map(o => `<label class="mb-opt${FORM.gift === o.v ? " is-on" : ""}"><input type="radio" name="gift" value="${esc(o.v)}"${FORM.gift === o.v ? " checked" : ""}>${o.img ? `<img src="${o.img}" alt="" width="44" height="44" draggable="false">` : o.html || ""}<span>${esc(cap(o.t))}</span></label>`).join("")}</div></div>
      <div class="st-g" id="mb-locks" style="margin-top:10px"${FORM.mode === "lock" ? "" : " hidden"}><div class="mb-opts rows" role="radiogroup" aria-label="Candado" id="mb-lock-l"></div></div>
      <p class="mb-foot" style="margin:8px 16px 0;justify-content:flex-start"><span class="mb-note" id="mb-s-note"></span></p></section>
    <button type="submit" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" id="mb-make" data-key="enter">${IC("envelope-simple", "bold", 22)}Crear el enlace</button>
    </form>
    <section class="card mb-card mb-res" id="mb-res" hidden aria-labelledby="mb-res-h" style="margin-top:18px">
      <h2 class="mb-h" id="mb-res-h">¡Carta lista!</h2>
      <p>Mándale este enlace por WhatsApp o por correo. Al abrirlo, la carta llega a su Buzón.</p>
      <textarea class="mb-link" id="mb-link" readonly rows="4" aria-label="Enlace de la carta"></textarea>
      <div class="mb-btns">${typeof navigator.share === "function" ? `<button type="button" class="glass-btn glass-btn--pri" id="mb-share">${IC("share-network", "bold", 20)}Compartir</button>` : ""}
        <button type="button" class="glass-btn${typeof navigator.share === "function" ? "" : " glass-btn--pri"}" id="mb-copy">${IC("copy", "bold", 20)}Copiar</button></div>
      <button type="button" class="glass-btn glass-btn--block" id="mb-another">${IC("pencil-simple", "bold", 20)}Escribir otra</button>
      <p class="mb-cp" id="mb-cp" role="status" aria-live="polite"></p></section>
  </div>`;
}
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
function lockOpts(l){
  const el = $id("mb-lock-l"); if(!el) return;
  el.innerHTML = Object.keys(LOCKS).map(k => `<label class="mb-opt${FORM.lock === k ? " is-on" : ""}"><input type="radio" name="lock" value="${k}"${FORM.lock === k ? " checked" : ""}>${IC(LOCKS[k].ic, "bold", 22)}<span>${esc(LOCKS[k].form(l))}</span></label>`).join("");
}
function formView(my){
  const app = $id("app");
  if(!FORM.lang) FORM.lang = curAb();
  if(!FORM.to) FORM.to = kidName();
  app.innerHTML = formHtml();
  const f = $id("mb-f"), from = $id("mb-from"), to = $id("mb-to"), msg = $id("mb-msg"), cnt = $id("mb-cnt");
  from.value = FORM.from; to.value = FORM.to; msg.value = FORM.msg;
  const count = () => { cnt.textContent = `${[...msg.value].length} / 280`; };
  count();
  lockOpts(FORM.lang);
  const note = () => txt(app, "#mb-s-note", FORM.mode === "gift" ? "El regalo se da una sola vez, al abrir la carta." : "La carta llega cerrada y se abre sola al conseguirlo.");
  note();
  from.addEventListener("input", () => { FORM.from = from.value; $id("mb-e-from").hidden = true; });
  to.addEventListener("input", () => { FORM.to = to.value; });
  msg.addEventListener("input", () => { FORM.msg = msg.value; count(); $id("mb-e-msg").hidden = true; });
  app.querySelectorAll("[data-l]").forEach(b => b.addEventListener("click", () => {
    FORM.lang = b.dataset.l; app.querySelectorAll("[data-l]").forEach(x => x.setAttribute("aria-checked", String(x === b))); lockOpts(FORM.lang);
  }));
  app.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => {
    FORM.mode = b.dataset.mode; app.querySelectorAll("[data-mode]").forEach(x => x.setAttribute("aria-checked", String(x === b)));
    $id("mb-gifts").hidden = FORM.mode !== "gift"; $id("mb-locks").hidden = FORM.mode !== "lock"; note();
  }));
  app.addEventListener("change", e => {
    const r = e.target; if(!r || r.type !== "radio") return;
    if(r.name === "gift") FORM.gift = r.value; else if(r.name === "lock") FORM.lock = r.value; else return;
    app.querySelectorAll(`input[name="${r.name}"]`).forEach(x => x.closest(".mb-opt").classList.toggle("is-on", x.checked));
  });
  f.addEventListener("submit", e => { e.preventDefault(); make(app); });
  $id("mb-copy").onclick = async () => { const ta = $id("mb-link"), ok = await copy(ta.value, ta); txt(app, "#mb-cp", ok ? "¡Copiado! Pégalo en un mensaje." : "Mantén pulsado el enlace para copiarlo."); };
  const sh = $id("mb-share");
  if(sh) sh.onclick = () => {
    const u = $id("mb-link").value, t = FORM.to ? `¡${cleanText(FORM.to, 24, false) || ""}, tienes carta en el Buzón!` : "¡Tienes carta en el Buzón!";
    try{ Promise.resolve(navigator.share({title: "Una carta para ti", text: t, url: u})).catch(() => {}); }catch(e){}
  };
  $id("mb-another").onclick = () => { FORM.msg = ""; formView(my); window.scrollTo(0, 0); };
}
function make(app){
  const from = cleanText(FORM.from, 24, false), to = FORM.to.trim() ? cleanText(FORM.to, 24, false) : "", msg = cleanText(FORM.msg, 280, true);
  $id("mb-e-from").hidden = !!from; $id("mb-e-msg").hidden = !!msg;
  if(!from){ $id("mb-from").focus(); return; }
  if(!msg){ $id("mb-msg").focus(); return; }
  const o = {v: 1, id: rid(12), from};
  if(to) o.to = to;
  o.msg = msg; o.lang = has(LK, FORM.lang) ? FORM.lang : curAb();
  if(FORM.mode === "lock") o.lock = has(LOCKS, FORM.lock) ? FORM.lock : "les3";
  else o.gift = /^\d+$/.test(FORM.gift) ? +FORM.gift : FORM.gift;
  const u = link(o);
  /* comprobación: el enlace se lee igual que se escribió */
  const back = u && decode(u.split("?d=")[1]);
  if(!u || !back || JSON.stringify(back) !== JSON.stringify(clean(o))){ txt(app, "#mb-cp", "No se ha podido crear el enlace. Prueba con un mensaje más corto."); return; }
  const res = $id("mb-res"); res.hidden = false;
  $id("mb-link").value = u; txt(app, "#mb-cp", "");
  try{ res.scrollIntoView({block: "start", behavior: rm() ? "auto" : "smooth"}); }catch(e){}
  try{ ($id("mb-share") || $id("mb-copy")).focus({preventScroll: true}); }catch(e){}
}

/* ---------- #/carta ---------- */
const envHtml = lock => `<div class="mb-env${lock ? " is-lock" : ""}" id="mb-env" aria-hidden="true"><i class="mb-e-back"></i><i class="mb-e-paper"></i><i class="mb-e-front"></i><i class="mb-e-flap"></i>
  <i class="mb-e-seal">${lock ? IC("lock", "bold", 22) : IC("heart", "fill", 22)}</i></div>`;
function badHtml(t, sub){
  return `<div class="mb"><div class="card mb-bad"><div class="mb-bad-i" aria-hidden="true">✗</div><h1 class="mb-t">${esc(t)}</h1><p>${esc(sub)}</p>
    <a class="glass-btn glass-btn--pri" href="#/buzon" data-key="enter">${IC("envelope-simple", "bold", 20)}Ir al Buzón</a></div></div>`;
}
function cartaView(parts, my){
  const app = $id("app");
  if(!parts[0]){
    const q = new URLSearchParams(location.hash.split("?")[1] || "");
    if(!q.has("d")){ location.replace("#/buzon"); return; }
    const r = receive(decode(q.get("d")));
    if(!r){ REPL = "#/carta"; app.innerHTML = badHtml("Esta carta no se puede abrir", "Puede que el enlace llegara cortado. Pide que te lo manden otra vez."); return; }
    REPL = "#/carta/" + r.letter.id;
    letterView(app, r.letter.id, my);
    return;
  }
  letterView(app, decodeURIComponent(parts[0]), my);
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
  const s = lockState(L), pct = Math.round(100 * s.have / s.need);
  app.innerHTML = `<div class="mb" id="mb-lv"><div class="mb-stage">${envHtml(true)}</div>
    <h1 class="mb-t mb-c">Carta con candado</h1>
    <p class="mb-sub mb-c"><span>De </span><b data-t="from"></b></p>
    <section class="card mb-card" style="margin-top:18px">
      <p class="mb-lk-t">${esc(s.text)}</p>
      <div class="mb-bar" role="progressbar" aria-label="Lo que llevas" aria-valuemin="0" aria-valuemax="${s.need}" aria-valuenow="${s.have}" aria-valuetext="${s.have} de ${s.need} ${esc(s.units)}"><i style="width:${pct}%"></i></div>
      <p class="mb-lk-n">${s.have} de ${s.need} ${esc(s.units)}</p>
      <a class="glass-btn glass-btn--pri glass-btn--block" href="${s.go}" data-key="enter">${IC(s.ic, "bold", 20)}${esc(s.btn)}</a>
      ${s.lang && LK[s.lang] !== lang ? `<p class="mb-lk-l">Cuenta lo que hagas en ${esc(lname(s.lang))}: cámbialo con la bandera de arriba.</p>` : ""}
    </section></div>`;
  txt(app, "[data-t=from]", L.from);
}
/* el sobre se abre, luego la carta y su voz, luego el regalo */
async function runOpen(app, id, my){
  const L = open(id); if(!L){ letterView(app, id, my); return; }
  PEND = L.gift != null ? L.id : "";
  const env = $id("mb-env"), btn = $id("mb-open");
  if(btn){ btn.disabled = true; btn.setAttribute("aria-disabled", "true"); }
  if(env && !rm()){ env.classList.add("is-open"); await sleep(780); }
  if(my !== NAV) return;
  openView(app, L, true, my);
}
function giftHtml(){
  return `<section class="card mb-gift" id="mb-gift" hidden aria-live="polite"><span class="mb-gift-i" id="mb-gift-i" aria-hidden="true"></span>
    <span class="mb-gift-t"><b id="mb-gift-b"></b><small id="mb-gift-s"></small><span class="mb-gift-w" id="mb-gift-w" hidden></span></span></section>`;
}
function openView(app, L, fresh, my){
  const ab = msgLang(L.msg, L.lang), code = codeOf(ab);
  app.innerHTML = `<div class="mb" id="mb-ov">
    <article class="card mb-paper${fresh && !rm() ? " mb-in" : ""}" aria-labelledby="mb-sig">
      <p class="mb-to" data-t="to"${L.to ? "" : " hidden"}></p>
      <p class="mb-msg" data-t="msg" lang="${esc(code)}"></p>
      <p class="mb-sig" id="mb-sig" data-t="from"></p>
      <button type="button" class="glass-btn glass-btn--sm mb-say" id="mb-say" data-key="space">${IC("speaker-high", "fill", 18)}Escuchar</button>
    </article>
    ${L.gift != null ? giftHtml() : L.lock ? `<p class="mb-note mb-c" style="margin:0 auto 16px">${IC("lock-open", "bold", 18)} Carta secreta: la abriste ${esc(LOCKS[L.lock].form(L.lang).toLowerCase())}.</p>` : ""}
    <a class="glass-btn glass-btn--block" href="#/buzon">${IC("envelope-simple", "bold", 20)}Ir al Buzón</a></div>`;
  if(L.to) txt(app, "[data-t=to]", `Para ${L.to}`);
  txt(app, "[data-t=msg]", L.msg); txt(app, "[data-t=from]", `— ${L.from}`);
  const sb = $id("mb-say");
  sb.onclick = () => speak(L.msg, code, sb);
  if(L.gift == null) return;
  const b0 = box(), paid = b0.paid.includes(L.id);
  if(!fresh || paid){ showGift(app, L, paid ? null : pay(L.id, null), true); PEND = ""; return; }
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
  const gi = $id("mb-gift-i"), gw = $id("mb-gift-w");
  let it = null;
  if(typeof L.gift === "number"){
    gi.innerHTML = `<img src="${IMG.coin}" alt="" width="64" height="64">`;
    txt(app, "#mb-gift-b", past ? `Te regaló ${L.gift} monedas` : `¡${L.gift} monedas!`);
  } else {
    it = adornos().find(x => x.id === L.gift) || (typeof itemById === "function" ? itemById(L.gift) : null);
    gi.innerHTML = it && W.vocabShop && typeof vocabShop.img === "function" ? vocabShop.img(it) : `<img src="${IMG.gift}" alt="" width="64" height="64">`;
    const n = it ? (typeof art === "function" ? art(it.n) : it.n) : "un regalo";
    txt(app, "#mb-gift-b", r && r.had ? `Ya tenías ${n}` : past ? `Te regaló ${n}` : `¡Es ${n} para tu granja!`);
  }
  txt(app, "#mb-gift-s", it ? (r && r.had ? "¡Ahora sabes cómo se dice!" : "Ya está en tu granja.") : `Regalo de ${L.from}`);
  if(it && typeof itemWord === "function"){
    const w = itemWord(it); gw.hidden = false;
    gw.innerHTML = `<span data-t="w"></span><button type="button" class="mb-spk" id="mb-gift-say" aria-label="Oír la palabra">${IC("speaker-high", "fill", 20)}</button>`;
    txt(gw, "[data-t=w]", w);
    $id("mb-gift-say").onclick = e => { if(typeof say === "function") say(w, e.currentTarget); };
    if(!past && typeof say === "function") setTimeout(() => { if($id("mb-gift-say")) say(w, $id("mb-gift-say")); }, 500);
  }
  if(!past && !rm() && W.M && typeof M.burst === "function") try{ M.burst(gi, {n: 14}); }catch(e){}
}

/* ---------- Hoy ---------- */
function slot(){
  const L = unread()[0]; if(!L) return null;
  css();
  const a = D.createElement("a");
  a.className = "card hm-row mb-row"; a.id = "mb-row"; a.href = "#/carta/" + encodeURIComponent(L.id);
  a.innerHTML = `<span class="hm-ric emo mb-ric" aria-hidden="true"><img src="${IMG.env}" alt="" width="26" height="26" draggable="false"></span><span class="hm-rt"><span data-t="t"></span><small data-t="s"></small></span>${IC("caret-right", "bold", 16, "hm-chev")}`;
  const t = L.lock ? "¡Se abrió el candado!" : "¡Tienes carta!", s = L.lock ? `Carta de ${L.from} · Toca para leerla` : `De ${L.from} · Toca para abrirla`;
  txt(a, "[data-t=t]", t); txt(a, "[data-t=s]", s);
  a.setAttribute("aria-label", `${t} ${s}`);
  a.addEventListener("click", () => { unlockVoice(); AUTO = L.id; });
  /* un solo reclamo en Hoy: el sobre tiembla (3 veces) y el zorro no saluda esta vez */
  if(!rm()){ a.classList.add("is-new"); try{ waveAt = Date.now(); }catch(e){} }
  return a;
}
slot.id = "mail";
if(typeof HOME_SLOTS !== "undefined") HOME_SLOTS.unshift(slot);

/* ---------- Juegos: la tarjeta que lleva al Buzón ---------- */
function cardLine(){
  const n = unread().length; if(n) return n === 1 ? "¡1 carta nueva!" : `¡${n} cartas nuevas!`;
  const k = box().l.filter(L => !L.o).length; if(k) return k === 1 ? "1 carta con candado" : `${k} cartas con candado`;
  const r = MEDIA.audio || 0; if(r) return r === 1 ? "1 grabación" : `${r} grabaciones`;
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
      <button type="button" class="st-r st-btn" id="aj-mb-del"${MEDIA.n > 0 ? "" : " hidden"}><span class="st-ic gr" aria-hidden="true">${IC("trash", "bold", 18)}</span>
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
  refreshMedia().then(s => { if(!del.isConnected) return; del.hidden = !(s.n > 0); if(ds) ds.textContent = mediaText(s); });
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
bus.on("route", () => {
  const to = REPL; REPL = null;
  if(!to || typeof hashPath !== "function" || hashPath() !== "carta") return;
  try{ history.replaceState(history.state, "", location.pathname + location.search + to); }catch(e){ return; }
  try{ if(TABMEM.jugar){ TABMEM.jugar.h = to; memSave(); } }catch(e){}
});
refreshMedia();

W.vocabMailbox = Object.freeze({
  KEY, TPL, LOCKS, box, letters, clean, encode, decode, link, receive, open, pay, lockState, unread, adornos, shareText, slot, adultHtml,
  images: () => [...new Set([IMG.box, IMG.env, IMG.coin, IMG.gift, IMG.lock, ...TPL.map(t => t.img)])],
});
})();
