/* Módulo save: el núcleo de la copia de la partida (sin interfaz; la interfaz y Google Drive están en js/sync.js).
   - Inventario de las claves de la app (typeOf/collect), copia (snapshot), lectura comprobada (parse, con el porqué en
     code: "newer" = de una versión más nueva de la app), resumen para comparar (summary), juntar dos partidas (merge) y
     reemplazo de la partida con copia para deshacer ("save:undo") y recarga (apply).
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
     prEx · prAuto · prPrefs (prácticas) · farm:state (farm.js) · games:best · games:topic · games:day · games:reto
     (el «Reto de hoy»: los días conseguidos; games.js) · gram:lv (el nivel A1-C2 de los juegos de gramática por
     idioma, js/grammargames.js y js/learn.js) ·
     buddy:hide · buddy:missions · buddy:wotd (buddy.js) · album:tab (album.js)
     season (fiestas: puertas, pegatinas y ventanitas por año, js/season.js)
     sc:prefs (atajos de Hoy fijados y ocultos, interruptor y pregunta de la tortuga, js/shortcuts.js)
     mail:box (cartas del Buzón del tío y las ya abiertas y pagadas, js/mailbox.js)
     phrase:stamps (los sellos de «La frase de la cena»: días sellados, 60 como mucho, y el total; js/phrases.js)
     calls (las llamadas del zorro: interruptor, última que sonó, la perdida, cuándo sonó cada una y las pagadas hoy;
       js/calls.js; solo se escribe al sonar una o al tocar algo, nunca al arrancar)
     cuentos (los Cuentos del zorro leídos: finales vistos, veces y si ya pagó, y los pagados hoy; js/stories.js)
     rv:stat (las últimas 50 respuestas del repaso comprobadas por la app, para alargar o acortar los intervalos de ese
       niño; index.html) · mig (los cambios de datos ya hechos al arrancar, {nac: 1}; index.html)
   Por idioma (<lang> = una clave de LANGS: english, français, dansk):
     srs:<lang> (repaso) · map:<lang> (lecciones del camino) · voice:<lang> · album:seen|done|uniq|orph:<lang>
     army:<lang> (el último rango del soldado ya celebrado en ese idioma, 0-12; js/army.js)
   Prácticas por documento: pr:<docId>:<lang>
   Solo de este aparato (no se exporta ni se restaura): offline (si ya descargó la web para usarla sin internet) ·
     vocab:ui (pistas de gestos vistas, de js/gestures.js, y ajustes de accesibilidad) · vocab:lsdraft (la lección a
     medias por si se cierra la pestaña, de js/lesson.js; caduca a las 72 horas) · vocab:sc (lo que más se usa, para
     los atajos de Hoy, de js/shortcuts.js; sin horas) · phrase:day (la frase de la cena elegida hoy en cada idioma,
     de js/phrases.js) · vocab:voice (la voz elegida para cada idioma, {english, français, dansk: nombre}: cada aparato
     trae voces distintas; voice:<lang> queda de respaldo) · parrot:st (el loro eco: el mes en que se propuso la cápsula
     en cada idioma, las monedas de hoy y las últimas palabras; js/parrot.js) · hunt:st (el Cazador de cosas: las
     monedas de hoy y cuántos colores lleva cazados; js/hunter.js) · party:st (El impostor y Ordenar por grupo: los
     últimos nombres de los jugadores y los últimos casos y grupos, para no repetir; js/party.js) · vocab:tts (si la voz del navegador de cada idioma
     no suena en este aparato y si ya se avisó; index.html).
     Fuera de localStorage, y nunca en la partida: la base IndexedDB "vocab-media-user" (grabaciones del Buzón, la
     cápsula del tiempo del loro con kind "capsule" y los recortes de «Mi casa» del Cazador con kind "photo" y src
     "hunt"; js/mailbox.js, window.vocabMedia).
     Fuera del inventario A PROPÓSITO: las claves "tech:…" de Tech Prep (la sección de mayores, js/tech-boot.js y
     js/tech.js: tech:on, tech:data, tech:ui, tech:sync, tech:lsdraft…). No son de la partida del niño: ni se exportan
     ni se cargan ni se borran con ella (writeAll solo quita claves del inventario); tienen su propio archivo de Google.
   Propias de este módulo (no se exportan ni se restauran desde un archivo):
     save:last (fecha de la última vez que se cargó una partida) · save:first (primer día de uso) ·
     save:snooze («Ahora no» del aviso de Google de la portada, que ya no existe: sin uso) · save:undo (copia para
     deshacer) · save:sync (estado de Google Drive) ·
     save:tok (permiso de Google de ~1 hora). */
const EXACT = {
  game: "o", act: "o", prPrefs: "o", "farm:state": "o",
  lang: "*", rate: "*", theme: "*", mute: "*", mapLv: "*", prEx: "*", prAuto: "*",
  "games:best": "*", "games:topic": "*", "games:day": "*", "games:reto": "*", "gram:lv": "*",
  "buddy:hide": "*", "buddy:missions": "*", "buddy:wotd": "*", "album:tab": "*",
  season: "o",
  "sc:prefs": "o",
  "mail:box": "o",
  "phrase:stamps": "o",
  calls: "o",
  cuentos: "o",
  "rv:stat": "o", mig: "o",
};
const PER_LANG = {"srs:": "o", "map:": "o", "voice:": "*", "album:seen:": "*", "album:done:": "*", "album:uniq:": "*", "album:orph:": "*",
  "army:": "*"};
const DEVICE_ONLY = ["offline", "vocab:ui", "vocab:lsdraft", "vocab:sc", "phrase:day", "vocab:voice", "parrot:st", "hunt:st", "party:st", "vocab:tts", "flyer:veh"];
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
  try{ if(typeof srsFlush === "function") srsFlush(); }catch(e){}   /* el repaso en memoria (index.html), ya escrito */
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
const fail = (err, code) => ({ok: false, err, code});
/* devuelve {ok, data:{saved, keys}, ignored, bad} o {ok:false, err, code}. Solo se rechaza la partida entera si falla su
   estructura (app, v, keys); un dato suelto dañado se salta y se cuenta en bad.
   code dice por qué: "empty" · "big" · "json" · "app" (de otra app) · "ver" (sin versión) · "keys" · "bad" (nada se
   puede leer), que son una partida dañada, y "newer": está bien, pero la escribió una versión más nueva de la app (esta
   no sabe leerla). js/sync.js nunca sube encima de una "newer": esa la tiene que leer la app nueva. */
function parse(text){
  if(typeof text !== "string" || !text.trim()) return fail("La partida está vacía.", "empty");
  if(text.length > MAX) return fail("Es demasiado grande para ser una partida de Vocabulario.", "big");
  let o; try{ o = JSON.parse(text); }catch(e){ return fail("Esto no es una partida de Vocabulario (o está dañada). No se ha cambiado nada.", "json"); }
  if(!isObj(o) || o.app !== APP) return fail("Esto no es una partida de Vocabulario: parece de otra app. No se ha cambiado nada.", "app");
  if(typeof o.v !== "number" || !(o.v >= 1)) return fail("La partida está dañada (falta la versión). No se ha cambiado nada.", "ver");
  if(o.v > VER) return fail("Esta partida es de una versión más nueva de la app. Recarga la página para actualizarla y prueba otra vez.", "newer");
  if(!isObj(o.keys)) return fail("La partida está dañada (no tiene datos). No se ha cambiado nada.", "keys");
  const keys = {}; let ignored = 0, bad = 0;
  for(const [k, v] of Object.entries(o.keys)){
    if(!typeOf(k)){ ignored++; continue; }
    if(!valid(k, v)){ bad++; continue; }
    keys[k] = v;
  }
  if(bad && !Object.keys(keys).length) return fail("La partida está dañada (ningún dato se puede leer). No se ha cambiado nada.", "bad");
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

/* ---------- juntar dos partidas (dos aparatos que jugaron a la vez; js/sync.js) ----------
   merge(base, other) → claves {clave: texto}. base es la que gana (la de más progreso): de ella salen las monedas y lo
   comprado (game), la granja (farm:state) y todo lo demás. De other se junta lo que solo crece, así no se pierde lo
   jugado en el otro aparato:
     map:<lang> (lecciones del camino): las de las dos, con las estrellas más altas de cada lección
     srs:<lang> (repaso): las palabras de las dos; si está en las dos, la que lleva más repasos (n) y, con los mismos, la
       que vuelve más tarde (due)
     act (actividad por día): la cifra más alta de cada día
     album:seen|uniq:<lang>: lo más alto de cada clave · album:done|orph:<lang>: las de las dos
     games:best: por juego, la partida de récord más alto (con sus estrellas e intentos); plays, lv y at, los más altos
     cuentos: los leídos en las dos (por cuento: los finales vistos de las dos, veces y pagado lo más alto, la última
       fecha) y lo pagado, el del día más nuevo (si es el mismo día, lo más alto)
     season: por año y fiesta, las pegatinas y ventanitas de las dos; bolsas, último premio y monedas, lo más alto; la
       ronda a medias, la del día más nuevo
     phrase:stamps: los días sellados de las dos (los 60 últimos) y el total con los días que solo tenía la otra
   Una de estas claves que solo está en other se añade. Si en una de las dos no se puede leer, queda la de base. Si
   other no trae nada nuevo, el texto de base no cambia (ni el orden de sus claves). */
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const num = x => +x || 0;
const more = (x, y) => num(y) > num(x) ? y : x;
const newer = (x, y) => (typeof y === typeof x ? y > x : y != null && x == null) ? y : x;   /* fechas «AAAA-MM-DD», ISO o días */
const union = (a, b) => [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])];
const byKey = f => (a, b) => {
  const o = {};
  for(const k of Object.keys(a)) o[k] = own(b, k) ? f(a[k], b[k], k) : a[k];
  for(const k of Object.keys(b)) if(!own(o, k)) o[k] = b[k];
  return o;
};
const objs = f => (x, y) => isObj(x) && isObj(y) ? f(x, y) : isObj(x) ? x : y;
const srsPick = objs((x, y) => num(y.n) > num(x.n) || (num(y.n) === num(x.n) && num(y.due) > num(x.due)) ? y : x);
const bestPick = objs((x, y) => {
  const o = Object.assign({}, num(y.score) > num(x.score) ? y : x);
  for(const k of ["plays", "lv", "at"]) if(own(x, k) || own(y, k)) o[k] = Math.max(num(x[k]), num(y[k]));
  return o;
});
const talePick = objs((x, y) => {
  const o = Object.assign({}, x, {d: newer(x.d, y.d), e: union(x.e, y.e), n: Math.max(num(x.n), num(y.n))});
  if(x.p || y.p) o.p = 1;
  return o;
});
function tales(a, b){
  const o = Object.assign({}, a);
  if(isObj(a.done) || isObj(b.done)) o.done = byKey(talePick)(isObj(a.done) ? a.done : {}, isObj(b.done) ? b.done : {});
  if(isObj(b.pay) && (!isObj(a.pay) || newer(a.pay.d, b.pay.d) !== a.pay.d)) o.pay = b.pay;
  else if(isObj(a.pay) && isObj(b.pay) && a.pay.d === b.pay.d) o.pay = Object.assign({}, a.pay, {n: Math.max(num(a.pay.n), num(b.pay.n))});
  return o;
}
const fest = objs((x, y) => {
  const o = Object.assign({}, x);
  if(isObj(x.st) || isObj(y.st)) o.st = byKey(v => v)(isObj(x.st) ? x.st : {}, isObj(y.st) ? y.st : {});
  if(Array.isArray(x.open) || Array.isArray(y.open)) o.open = union(x.open, y.open);
  for(const k of ["last", "paid"]) if(own(x, k) || own(y, k)) o[k] = newer(x[k], y[k]);
  if(own(x, "bags") || own(y, "bags")) o.bags = Math.max(num(x.bags), num(y.bags));
  const ra = x.run, rb = y.run;
  if(isObj(rb) && (!isObj(ra) || newer(ra.d, rb.d) !== ra.d || (ra.d === rb.d && union(rb.ok).length > union(ra.ok).length))) o.run = rb;
  return o;
});
const seasons = byKey(objs((ya, yb) => byKey(fest)(ya, yb)));
function stamps(a, b){
  const da = union(a.days), db = union(b.days), sa = new Set(da), sb = new Set(db);
  const days = union(da, db).filter(d => typeof d === "string").sort().slice(-60);
  const n = Math.max(num(a.n) + db.filter(d => !sa.has(d)).length, num(b.n) + da.filter(d => !sb.has(d)).length, days.length);
  return Object.assign({}, a, {days, n});
}
const GROW = [
  [k => k.startsWith("map:"), byKey(more)],
  [k => k.startsWith("srs:"), byKey(srsPick)],
  [k => k === "act", byKey(more)],
  [k => /^album:(seen|uniq):/.test(k), byKey(more)],
  [k => /^album:(done|orph):/.test(k), byKey(v => v)],
  [k => k === "games:best", byKey(bestPick)],
  [k => k === "cuentos", tales],
  [k => k === "season", seasons],
  [k => k === "phrase:stamps", stamps],
];
function merge(base, other){
  const out = Object.assign({}, isObj(base) ? base : {});
  if(!isObj(other)) return out;
  for(const k of Object.keys(other)){
    const g = typeOf(k) && GROW.find(r => r[0](k));
    if(!g || typeof other[k] !== "string") continue;
    if(!own(out, k)){ if(valid(k, other[k])) out[k] = other[k]; continue; }
    let a, b; try{ a = JSON.parse(out[k]); b = JSON.parse(other[k]); }catch(e){ continue; }
    if(!isObj(a) || !isObj(b)) continue;
    const m = JSON.stringify(g[1](a, b));
    if(m !== JSON.stringify(a)) out[k] = m;
  }
  return out;
}

/* ---------- reemplazar la partida ---------- */
const FLASH = "vocab:save-flash";   /* sessionStorage: {t: mensaje que se enseña al recargar, adult: abrir «Para mayores»} */
function writeAll(keys){
  for(const k of Object.keys(collect())) localStorage.removeItem(k);
  for(const [k, v] of Object.entries(keys)) if(typeOf(k)) localStorage.setItem(k, v);
}
/* mode "load": guarda copia para deshacer · "undo": vuelve a la copia y la borra · "merge": la partida juntada de dos
   aparatos (js/sync.js), sin tocar la copia para deshacer (sync.js ya guardó ahí la que perdió algo).
   flash: {t, adult} para enseñar tras recargar (por defecto el mensaje de siempre y abrir «Para mayores»).
   Devuelve "" si va bien (y recarga), "rollback" si quedó a medias, o un mensaje de error para mayores. */
function apply(keys, mode, flash){
  const before = collect(), lastBefore = metaGet(META.last, null);
  /* la granja se queda con la hora «visto» (farm:state.ls) más nueva de las dos (vocabFarm.mergeSeen de js/farm.js) */
  if(mode === "load" && keys && keys["farm:state"] && before["farm:state"]){
    try{ const VF = window.vocabFarm; if(VF && typeof VF.mergeSeen === "function") keys = Object.assign({}, keys, {"farm:state": VF.mergeSeen(keys["farm:state"], before["farm:state"])}); }catch(e){}
  }
  if(mode === "load"){
    const u = {app: APP, v: VER, saved: new Date(now()).toISOString(), last: lastBefore, keys: before};
    if(!metaSet(META.undo, u)) return "No hay sitio en el navegador para guardar la copia de seguridad. No se ha cambiado nada.";
  }
  try{
    writeAll(keys);
    if(mode === "load" || mode === "merge") metaSet(META.last, now());
    else { const u = metaGet(META.undo, null); if(u && u.last) metaSet(META.last, u.last); else metaDel(META.last); metaDel(META.undo); }
  }catch(e){
    try{ writeAll(before); }catch(e2){
      /* tampoco se pudo volver atrás: se conserva la copia para deshacer y se avisa */
      if(lastBefore === null) metaDel(META.last); else metaSet(META.last, lastBefore);
      return mode !== "undo" ? "rollback" : "No se pudo terminar de volver a la partida de antes porque el navegador no tiene sitio. Libera espacio y pulsa otra vez «↩️ Deshacer».";
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
window.vocabSave = Object.freeze({typeOf, collect, snapshot, parse, summary, total, merge, apply, keepUndo, takeFlash,
  metaGet, metaSet, metaDel, META, APP, VER, firstSeen, progress, isIOS, standalone, fmtShort, fmtDate, ago, langs,
  inventory: {exact: Object.keys(EXACT), perLang: Object.keys(PER_LANG), pr: "pr:<docId>:<lang>", deviceOnly: DEVICE_ONLY, meta: Object.values(META)},
  get skipped(){ return skipped; }, get persisted(){ return persisted; }});
})();
