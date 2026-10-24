/* Módulo save: el núcleo de la copia de la partida (sin interfaz; la interfaz y Google Drive están en js/sync.js).
   - Inventario de las claves de la app (typeOf/collect), copia (snapshot), lectura comprobada (parse), resumen para
     comparar (summary) y reemplazo de la partida con copia para deshacer ("save:undo") y recarga (apply).
   - Al arrancar pide al navegador que no borre los datos (navigator.storage.persist).
   Formato: {app:"vocabulary", v:1, saved:"<ISO>", keys:{clave: "valor tal cual está en localStorage"}}.
   El origen juanandresbaronbaron.github.io lo comparten otras webs del mismo usuario: solo se leen, guardan y borran
   las claves del inventario de abajo; las demás no se tocan nunca. */
(() => {
"use strict";
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);

const APP = "vocabulary", VER = 1;
const MAX = 16 * 1024 * 1024;         /* tamaño máximo de una partida: muy por encima de lo que cabe en
                                         localStorage (~5 MB) aunque el JSON escape comillas y la ñ ocupe 2 bytes */
const DAY = 864e5;
const now = () => Date.now();          /* las pruebas pueden mover el reloj sustituyendo Date.now */

/* ---------- inventario de claves de la app ----------
   Revisado en index.html y js/*.js. Tipo: "o" = objeto obligatorio (la app hace Object.values/keys sobre él),
   "*" = cualquier JSON válido (la app ya se defiende de valores raros).
   Exactas:
     game (monedas, personaje, compras) · act (actividad por día) · lang · rate · theme · mute (sfx.js) · mapLv ·
     prEx · prAuto · prPrefs (prácticas) · farm:state (farm.js) · games:best · games:topic · games:day (games.js) ·
     buddy:hide · buddy:missions · buddy:wotd (buddy.js) · album:tab (album.js)
     season (fiestas: puertas, pegatinas y ventanitas por año, js/season.js)
     sc:prefs (atajos de Hoy fijados y ocultos, interruptor y pregunta de la tortuga, js/shortcuts.js)
     mail:box (cartas del Buzón del tío y las ya abiertas y pagadas, js/mailbox.js)
     phrase:stamps (los sellos de «La frase de la cena»: días sellados, 60 como mucho, y el total; js/phrases.js)
     calls (las llamadas del zorro: interruptor, última que sonó, la perdida, cuándo sonó cada una y las pagadas hoy;
       js/calls.js; solo se escribe al sonar una o al tocar algo, nunca al arrancar)
     cuentos (los Cuentos del zorro leídos: finales vistos, veces y si ya pagó, y los pagados hoy; js/stories.js)
   Por idioma (<lang> = una clave de LANGS: english, français, dansk):
     srs:<lang> (repaso) · map:<lang> (lecciones del camino) · voice:<lang> · album:seen|done|uniq|orph:<lang>
   Prácticas por documento: pr:<docId>:<lang>
   Solo de este aparato (no se exporta ni se restaura): offline (si ya descargó la web para usarla sin internet) ·
     vocab:ui (pistas de gestos vistas, de js/gestures.js, y ajustes de accesibilidad) · vocab:lsdraft (la lección a
     medias por si se cierra la pestaña, de js/lesson.js; caduca a las 72 horas) · vocab:sc (lo que más se usa, para
     los atajos de Hoy, de js/shortcuts.js; sin horas) · phrase:day (la frase de la cena elegida hoy en cada idioma,
     de js/phrases.js) · vocab:voice (la voz elegida para cada idioma, {english, français, dansk: nombre}: cada aparato
     trae voces distintas; voice:<lang> queda de respaldo) · parrot:st (el loro eco: el mes en que se propuso la cápsula
     en cada idioma, las monedas de hoy y las últimas palabras; js/parrot.js) · hunt:st (el Cazador de cosas: las
     monedas de hoy y cuántos colores lleva cazados; js/hunter.js) · party:st (El impostor y Ordenar por grupo: los
     últimos nombres de los jugadores y los últimos casos y grupos, para no repetir; js/party.js).
     Fuera de localStorage, y nunca en la partida: la base IndexedDB "vocab-media-user" (grabaciones del Buzón, la
     cápsula del tiempo del loro con kind "capsule" y los recortes de «Mi casa» del Cazador con kind "photo" y src
     "hunt"; js/mailbox.js, window.vocabMedia).
   Propias de este módulo (no se exportan ni se restauran desde un archivo):
     save:last (fecha de la última vez que se cargó una partida) · save:first (primer día de uso) ·
     save:snooze («Ahora no» del aviso de Google de la portada, que ya no existe: sin uso) · save:undo (copia para
     deshacer) · save:sync (estado de Google Drive) ·
     save:tok (permiso de Google de ~1 hora). */
const EXACT = {
  game: "o", act: "o", prPrefs: "o", "farm:state": "o",
  lang: "*", rate: "*", theme: "*", mute: "*", mapLv: "*", prEx: "*", prAuto: "*",
  "games:best": "*", "games:topic": "*", "games:day": "*",
  "buddy:hide": "*", "buddy:missions": "*", "buddy:wotd": "*", "album:tab": "*",
  season: "o",
  "sc:prefs": "o",
  "mail:box": "o",
  "phrase:stamps": "o",
  calls: "o",
  cuentos: "o",
};
const PER_LANG = {"srs:": "o", "map:": "o", "voice:": "*", "album:seen:": "*", "album:done:": "*", "album:uniq:": "*", "album:orph:": "*"};
const DEVICE_ONLY = ["offline", "vocab:ui", "vocab:lsdraft", "vocab:sc", "phrase:day", "vocab:voice", "parrot:st", "hunt:st", "party:st"];
const META = {last: "save:last", first: "save:first", snooze: "save:snooze", undo: "save:undo", sync: "save:sync", tok: "save:tok"};
const langs = () => { try{ return Object.keys(LANGS); }catch(e){ return ["english", "français", "dansk"]; } };
/* tipo de una clave de la app, o null si no es nuestra */
function typeOf(k){
  if(typeof k !== "string") return null;
  if(Object.prototype.hasOwnProperty.call(EXACT, k)) return EXACT[k];
  const L = langs();
  for(const p in PER_LANG) if(k.startsWith(p) && L.includes(k.slice(p.length))) return PER_LANG[p];
  const m = /^pr:([A-Za-z0-9_-]{1,60}):(.+)$/.exec(k);
  if(m && L.includes(m[2])) return "*";
  return null;
}
/* ¿el texto v vale para la clave k? (lo mismo comprueban la copia y la carga, así siempre se puede cargar lo guardado) */
function valid(k, v){
  const t = typeOf(k); if(!t || typeof v !== "string") return false;
  let p; try{ p = JSON.parse(v); }catch(e){ return false; }
  return t !== "o" || isObj(p);
}
/* las claves de la app que hay ahora en localStorage, con su texto tal cual
   (good: solo las que se pueden volver a cargar; skipped cuenta las dañadas que se dejan fuera) */
let skipped = 0;
function collect(good){
  const out = {}; if(good) skipped = 0;
  try{
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(typeOf(k)){ const v = localStorage.getItem(k); if(v === null) continue;
        if(good && !valid(k, v)){ skipped++; continue; } out[k] = v; }
    }
  }catch(e){}
  return out;
}
const snapshot = () => ({app: APP, v: VER, saved: new Date(now()).toISOString(), keys: collect(true)});
const metaGet = (k, d) => { try{ const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }catch(e){ return d; } };
const metaSet = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } };
const metaDel = k => { try{ localStorage.removeItem(k); }catch(e){} };

/* ---------- leer y comprobar una partida ---------- */
const fail = err => ({ok: false, err});
/* devuelve {ok, data:{saved, keys}, ignored, bad} o {ok:false, err}. Solo se rechaza la partida entera si falla su
   estructura (app, v, keys); un dato suelto dañado se salta y se cuenta en bad */
function parse(text){
  if(typeof text !== "string" || !text.trim()) return fail("La partida está vacía.");
  if(text.length > MAX) return fail("Es demasiado grande para ser una partida de Vocabulario.");
  let o; try{ o = JSON.parse(text); }catch(e){ return fail("Esto no es una partida de Vocabulario (o está dañada). No se ha cambiado nada."); }
  if(!isObj(o) || o.app !== APP) return fail("Esto no es una partida de Vocabulario: parece de otra app. No se ha cambiado nada.");
  if(typeof o.v !== "number" || !(o.v >= 1)) return fail("La partida está dañada (falta la versión). No se ha cambiado nada.");
  if(o.v > VER) return fail("Esta partida es de una versión más nueva de la app. Recarga la página para actualizarla y prueba otra vez.");
  if(!isObj(o.keys)) return fail("La partida está dañada (no tiene datos). No se ha cambiado nada.");
  const keys = {}; let ignored = 0, bad = 0;
  for(const [k, v] of Object.entries(o.keys)){
    if(!typeOf(k)){ ignored++; continue; }
    if(!valid(k, v)){ bad++; continue; }
    keys[k] = v;
  }
  if(bad && !Object.keys(keys).length) return fail("La partida está dañada (ningún dato se puede leer). No se ha cambiado nada.");
  const t = Date.parse(o.saved);
  return {ok: true, data: {saved: isFinite(t) ? t : null, keys}, ignored, bad};
}

/* ---------- resumen para comparar ---------- */
const val = (keys, k, d) => { try{ return k in keys ? JSON.parse(keys[k]) : d; }catch(e){ return d; } };
function summary(keys){
  const g = val(keys, "game", {}) || {};
  const kinds = (() => { try{ return farmMount.kinds.animal; }catch(e){ return []; } })();
  const owned = isObj(g.owned) ? g.owned : {};
  const per = {};
  for(const L of langs()){
    const m = val(keys, "map:" + L, {}), s = val(keys, "srs:" + L, {});
    per[L] = {lessons: isObj(m) ? Object.values(m).filter(x => +x > 0).length : 0, words: isObj(s) ? Object.keys(s).length : 0};
  }
  return {coins: Math.max(0, Math.floor(+g.coins || 0)), earned: Math.max(0, Math.floor(+g.earned || 0)),
    animals: kinds.filter(id => owned[id]).length, per, n: Object.keys(keys).length};
}
const total = (s, f) => Object.values(s.per).reduce((a, x) => a + x[f], 0);

/* ---------- reemplazar la partida ---------- */
const FLASH = "vocab:save-flash";   /* sessionStorage: {t: mensaje que se enseña al recargar, adult: abrir «Para mayores»} */
function writeAll(keys){
  for(const k of Object.keys(collect())) localStorage.removeItem(k);
  for(const [k, v] of Object.entries(keys)) if(typeOf(k)) localStorage.setItem(k, v);
}
/* mode "load": guarda copia para deshacer · "undo": vuelve a la copia y la borra.
   flash: {t, adult} para enseñar tras recargar (por defecto el mensaje de siempre y abrir «Para mayores»).
   Devuelve "" si va bien (y recarga), "rollback" si quedó a medias, o un mensaje de error para mayores. */
function apply(keys, mode, flash){
  const before = collect(), lastBefore = metaGet(META.last, null);
  if(mode === "load"){
    const u = {app: APP, v: VER, saved: new Date(now()).toISOString(), last: lastBefore, keys: before};
    if(!metaSet(META.undo, u)) return "No hay sitio en el navegador para guardar la copia de seguridad. No se ha cambiado nada.";
  }
  try{
    writeAll(keys);
    if(mode === "load") metaSet(META.last, now());
    else { const u = metaGet(META.undo, null); if(u && u.last) metaSet(META.last, u.last); else metaDel(META.last); metaDel(META.undo); }
  }catch(e){
    try{ writeAll(before); }catch(e2){
      /* tampoco se pudo volver atrás: se conserva la copia para deshacer y se avisa */
      if(lastBefore === null) metaDel(META.last); else metaSet(META.last, lastBefore);
      return mode === "load" ? "rollback" : "No se pudo terminar de volver a la partida de antes porque el navegador no tiene sitio. Libera espacio y pulsa otra vez «↩️ Deshacer».";
    }
    if(mode === "load") metaDel(META.undo);
    return "No hay sitio en el navegador para esta partida. No se ha cambiado nada.";
  }
  const f = flash || {t: mode === "load" ? "✓ ¡Partida cargada!" : "↩️ Has vuelto a la partida de antes", adult: true};
  try{ sessionStorage.setItem(FLASH, JSON.stringify(f)); }catch(e){}
  /* una pantalla abierta (la granja guarda su estado al tocar o al cerrarse) podría escribir encima en estos
     milisegundos: se vuelve a escribir la partida justo antes de recargar */
  setTimeout(() => { try{ writeAll(keys); }catch(e){} location.reload(); }, 60);
  return "";
}
/* guarda keys como copia para deshacer sin cambiar la partida (cuando gana la de este aparato) */
function keepUndo(keys, saved){
  return metaSet(META.undo, {app: APP, v: VER, saved: new Date(saved || now()).toISOString(), last: metaGet(META.last, null), keys});
}
/* el mensaje que dejó apply antes de recargar (se lee una vez) */
function takeFlash(){
  let f = null; try{ f = sessionStorage.getItem(FLASH); sessionStorage.removeItem(FLASH); }catch(e){}
  if(!f) return null;
  try{ const o = JSON.parse(f); if(isObj(o) && typeof o.t === "string") return o; }catch(e){}
  return {t: String(f), adult: true};   /* formato antiguo: solo el texto */
}

/* ---------- protección de los datos ---------- */
let persisted = null;   /* true | false | null (no se sabe) */
function askPersist(){
  try{
    const S = navigator.storage; if(!S || !S.persisted) return;
    S.persisted().then(p => p || (S.persist ? S.persist() : false)).then(p => { persisted = !!p; try{ bus.emit("save-persist", {persisted}); }catch(e){} }).catch(() => {});
  }catch(e){}
}
const isIOS = () => { try{ const u = navigator.userAgent || ""; return /iPad|iPhone|iPod/.test(u) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }catch(e){ return false; } };
const standalone = () => { try{ return navigator.standalone === true || matchMedia("(display-mode: standalone)").matches; }catch(e){ return false; } };

/* ---------- fechas ---------- */
const fmtShort = t => { const d = new Date(t); return d.toLocaleDateString("es", {day: "numeric", month: "short", year: "numeric"}) + " " + d.toLocaleTimeString("es", {hour: "2-digit", minute: "2-digit"}); };
const fmtDate = t => { const d = new Date(t); return d.toLocaleDateString("es", {day: "numeric", month: "long", year: "numeric"}) + ", " + d.toLocaleTimeString("es", {hour: "2-digit", minute: "2-digit"}); };
const ago = t => { const d = Math.floor((new Date(now()).setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / DAY);
  return d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`; };

/* ---------- primer día de uso y si ya hay progreso (los usaba el aviso de Google de la portada, ya quitado) ---------- */
function firstSeen(){
  let f = metaGet(META.first, null);
  if(typeof f !== "number" || !isFinite(f)){
    f = now();
    try{ const a = store.get("act", {}) || {}; for(const k of Object.keys(a)){ const t = new Date(k + "T12:00:00").getTime(); if(isFinite(t) && t < f) f = t; } }catch(e){}
    metaSet(META.first, f);
  }
  return f;
}
function progress(){
  try{
    const g = store.get("game", {}) || {};
    if((+g.earned || 0) >= 30) return true;
    return langs().some(L => { const m = store.get("map:" + L, {}); return isObj(m) && Object.values(m).some(x => +x > 0); });
  }catch(e){ return false; }
}
/* ---------- arranque ---------- */
bus.on("boot", () => { firstSeen(); askPersist(); });

/* para js/sync.js, las pruebas y los mayores curiosos */
window.vocabSave = Object.freeze({typeOf, collect, snapshot, parse, summary, total, apply, keepUndo, takeFlash,
  metaGet, metaSet, metaDel, META, APP, VER, firstSeen, progress, isIOS, standalone, fmtShort, fmtDate, ago, langs,
  inventory: {exact: Object.keys(EXACT), perLang: Object.keys(PER_LANG), pr: "pr:<docId>:<lang>", deviceOnly: DEVICE_ONLY, meta: Object.values(META)},
  get skipped(){ return skipped; }, get persisted(){ return persisted; }});
})();
