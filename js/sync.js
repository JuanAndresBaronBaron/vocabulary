/* Módulo sync: la partida se guarda sola en Google Drive (sin servidor).
   - Google Identity Services, modelo de «token» (el script se carga solo cuando hace falta), permiso
     drive.appdata y nada más: la app solo ve su carpeta privada de Drive, no los archivos de la persona.
   - Un archivo «vocabulary-progress.json» en appDataFolder con la copia de js/save.js (snapshot) y en appProperties
     el hash de lo que contiene ({hash, score, v}).
   - Subir: unos 20 s después de jugar (eventos del bus o un vistazo cada 30 s) y al esconder o cerrar la página.
   - Bajar: al arrancar y al volver a la página. Si solo cambió la de Google, se carga (apply, con copia para deshacer,
     y recarga). Si cambiaron las dos, gana la que tiene más progreso y la otra queda como copia para deshacer.
   - La primera vez en un aparato con progreso y una partida en Google, el mayor elige cuál seguir.
   - El permiso dura ~1 hora: se pide otra vez sin ventanas (prompt:""); si el navegador no deja, se avisa con un botón
     «Volver a conectar» y no se abre nada solo.
   - Interfaz: el bloque va en Ajustes › Para mayores (js/settings.js avisa por el bus «settings»; se llega tras la
     Puerta de mayores), el estado en la fila «Para mayores» de Ajustes ([data-sync-cfg]), la pastilla «Guardar» junto a
     las monedas ([data-sync-slot]) cuando el permiso caducó y hay algo sin subir, y el aviso de la portada
     (HOME_SLOTS) si no está conectado. Entrar, salir o cambiar la partida pasan por la Puerta (window.adultGate).
   Estado propio (no se sube ni se restaura): "save:sync" {fileId, remoteModified, baseHash, lastPushedHash,
   localDirty, connectedAt, lastSync, hint, reconnect, choice} y "save:tok" {t, exp}. */
(() => {
"use strict";
const S = window.vocabSave; if(!S) return;
const CLIENT_ID = "69558510843-6hqgnkrkc47p8hq4sokv47oaelcg3n0r.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const GSI = "https://accounts.google.com/gsi/client";
const API = "https://www.googleapis.com/drive/v3/files", UP = "https://www.googleapis.com/upload/drive/v3/files";
const ABOUT = "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)";
const REVOKE = "https://oauth2.googleapis.com/revoke";
const NAME = "vocabulary-progress.json", FIELDS = "id,modifiedTime,appProperties";
const M = S.META, MIN = 6e4, DAY = 864e5;
const T = {debounce: 20e3, poll: 30e3, retry: 30e3, retryMax: 10 * MIN, silentGap: 10 * MIN};
const now = () => Date.now();
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const online = () => navigator.onLine !== false;
const visible = () => document.visibilityState !== "hidden";
class SErr extends Error { constructor(code, status){ super(code); this.code = code; this.status = status || 0; } }

/* ---------- huella de la partida ----------
   Lo que no es progreso (idioma elegido, voz, tema, pestañas, la palabra del día, la hora de la última visita a la
   granja) no cuenta para saber si algo cambió; sí se sube con lo demás. */
const NOHASH = new Set(["lang", "rate", "theme", "mute", "mapLv", "album:tab", "buddy:wotd", "buddy:hide", "games:topic"]);
function cyrb53(str){
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for(let i = 0; i < str.length; i++){ const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}
function hashKeys(keys){
  const parts = [];
  for(const k of Object.keys(keys).sort()){
    if(NOHASH.has(k) || k.startsWith("voice:")) continue;
    let v = keys[k];
    if(k === "farm:state"){ try{ const o = JSON.parse(v); if(isObj(o)){ delete o.visit; v = JSON.stringify(o); } }catch(e){} }
    parts.push(k + "\u0001" + v);
  }
  return cyrb53(parts.join("\u0002"));
}
const localHash = () => hashKeys(S.collect(true));
/* cuánto progreso hay: monedas ganadas, lecciones, palabras en repaso y animales */
function score(keys){
  const s = S.summary(keys);
  return s.earned + 10 * S.total(s, "lessons") + S.total(s, "words") + 5 * s.animals;
}
/* progreso de verdad (no solo el regalo del día): lo mismo que usa el aviso de la portada */
function hasProgress(keys){ const s = S.summary(keys); return s.earned >= 30 || S.total(s, "lessons") > 0 || S.total(s, "words") > 0; }

/* ---------- estado guardado ---------- */
const DEF = {fileId: null, remoteModified: null, baseHash: null, lastPushedHash: null, localDirty: false,
  connectedAt: null, lastSync: null, lastPull: null, hint: null, reconnect: null, choice: false, tapAt: 0};
function meta(){ const m = S.metaGet(M.sync, null); return Object.assign({}, DEF, isObj(m) ? m : {}); }
function setMeta(p){ const m = Object.assign(meta(), p); S.metaSet(M.sync, m); return m; }
const connected = () => !!meta().connectedAt;

/* ---------- permiso de Google (token de ~1 hora) ---------- */
let tok = S.metaGet(M.tok, null);
const tokOk = () => isObj(tok) && typeof tok.t === "string" && typeof tok.exp === "number" && tok.exp - MIN > now();
function setTok(t, sec){ tok = {t, exp: now() + (sec > 0 ? sec : 3600) * 1000}; S.metaSet(M.tok, tok); }
function dropTok(){ tok = null; S.metaDel(M.tok); }

let gisP = null, client = null, pend = null;
const gisReady = () => { try{ return !!(window.google && google.accounts && google.accounts.oauth2 && google.accounts.oauth2.initTokenClient); }catch(e){ return false; } };
function loadGis(){
  if(gisReady()) return Promise.resolve();
  if(!online()) return Promise.reject(new SErr("offline"));
  if(!gisP) gisP = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = GSI; s.async = true;
    s.onload = () => { if(gisReady()) res(); else { gisP = null; rej(new SErr("gis")); } };
    s.onerror = () => { s.remove(); gisP = null; rej(new SErr(online() ? "gis" : "offline")); };
    document.head.appendChild(s);
  });
  return gisP;
}
function tokenClient(){
  if(client) return client;
  client = google.accounts.oauth2.initTokenClient({client_id: CLIENT_ID, scope: SCOPE,
    callback: r => {
      const p = pend; pend = null; if(!p) return;
      if(!r || r.error || !r.access_token) return p.rej(new SErr(r && r.error === "access_denied" ? "denied" : "auth"));
      let all = true; try{ all = google.accounts.oauth2.hasGrantedAllScopes(r, SCOPE); }catch(e){}
      if(!all) return p.rej(new SErr("scope"));
      setTok(r.access_token, +r.expires_in); p.res();
    },
    error_callback: e => { const p = pend; pend = null; if(p) p.rej(new SErr(e && e.type === "popup_closed" ? "closed" : "blocked")); }});
  return client;
}
/* interactive: un mayor ha pulsado un botón. Si no, es el intento sin ventanas (prompt:"" y la cuenta de antes) */
function askToken(interactive){
  const go = () => new Promise((res, rej) => {
    if(pend){ const p = pend; pend = null; p.rej(new SErr("superseded")); }
    let timer = 0;
    pend = {res: () => { clearTimeout(timer); res(); }, rej: e => { clearTimeout(timer); rej(e); }};
    if(!interactive) timer = setTimeout(() => { if(pend){ const p = pend; pend = null; p.rej(new SErr("blocked")); } }, 15e3);
    const m = meta(), o = {prompt: interactive && !m.hint ? "select_account" : ""};
    if(m.hint){ o.login_hint = m.hint; o.hint = m.hint; }
    try{ tokenClient().requestAccessToken(o); }
    catch(e){ const p = pend; pend = null; if(p) p.rej(new SErr("gis")); }
  });
  return gisReady() ? go() : loadGis().then(go);
}
let lastSilent = 0;
function markReconnect(){ dropTok(); if(connected() && !meta().reconnect) setMeta({reconnect: now()}); }
function clearReconnect(){ if(meta().reconnect) setMeta({reconnect: null}); }
/* ¿hay un toque del usuario en curso? Entonces el navegador SÍ dejaría abrir la ventana de Google: el intento
   automático no se hace para no abrir nada solo mientras el niño juega (solo se abre desde tapInTap/chip/botones) */
const activeTap = () => { try{ return !!(navigator.userActivation && navigator.userActivation.isActive); }catch(e){ return false; } };
async function ensureTok(){
  if(tokOk()) return;
  if(meta().reconnect && now() - lastSilent < T.silentGap) throw new SErr("reconnect");
  if(activeTap()){ markReconnect(); throw new SErr("reconnect"); }
  lastSilent = now();
  try{ await askToken(false); }
  catch(e){ if(e && e.code === "offline") throw e; markReconnect(); throw new SErr("reconnect"); }
  clearReconnect();
}

/* ---------- Drive REST v3 ---------- */
function kind(st, reason){
  const r = String(reason || "");
  if(st === 401) return "auth";
  if(st === 403){
    if(/storageQuota/i.test(r)) return "full";
    if(/rate|limit|quota/i.test(r)) return "rate";
    return "auth";
  }
  if(st === 404) return "gone";
  if(st === 429) return "rate";
  return "server";
}
async function drive(method, url, opt = {}, again){
  if(!online()) throw new SErr("offline");
  await ensureTok();
  const headers = Object.assign({Authorization: "Bearer " + tok.t}, opt.headers || {});
  let r;
  try{ r = await fetch(url, {method, headers, body: opt.body, keepalive: !!opt.keepalive, cache: "no-store"}); }
  catch(e){
    if(opt.keepalive && !again) return drive(method, url, Object.assign({}, opt, {keepalive: false}), true);
    throw new SErr(online() ? "net" : "offline");
  }
  if(r.status === 401 && !again){ dropTok(); return drive(method, url, opt, true); }
  if(!r.ok){
    let reason = "";
    try{ const j = await r.json(); const e = (j && j.error) || {}; reason = ((e.errors || [])[0] || {}).reason || e.status || ""; }catch(e){}
    const c = kind(r.status, reason);
    if(c === "auth") markReconnect();
    throw new SErr(c, r.status);
  }
  if(opt.text) return r.text();
  if(r.status === 204) return null;
  try{ return await r.json(); }catch(e){ return null; }
}
async function findFile(){
  const q = encodeURIComponent(`name='${NAME}' and trashed=false`);
  const r = await drive("GET", `${API}?spaces=appDataFolder&q=${q}&orderBy=modifiedTime%20desc&pageSize=10&fields=files(${FIELDS})`);
  return r && Array.isArray(r.files) && r.files[0] || null;
}
const getMeta = id => drive("GET", `${API}/${encodeURIComponent(id)}?fields=${FIELDS}`);
const download = id => drive("GET", `${API}/${encodeURIComponent(id)}?alt=media`, {text: true});
/* crea (POST) o actualiza (PATCH) el archivo con contenido y appProperties en una sola petición multipart */
function upload(id, keys, h, keepalive){
  const md = {appProperties: {hash: h, score: String(score(keys)), v: String(S.VER)}};
  if(!id) Object.assign(md, {name: NAME, parents: ["appDataFolder"], mimeType: "application/json"});
  const B = "vocab" + Math.random().toString(36).slice(2) + now().toString(36);
  const data = JSON.stringify({app: S.APP, v: S.VER, saved: new Date(now()).toISOString(), keys});
  const body = `--${B}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(md)}\r\n--${B}\r\nContent-Type: application/json\r\n\r\n${data}\r\n--${B}--`;
  let small = false; try{ small = new Blob([body]).size < 60000; }catch(e){}   /* keepalive admite ~64 KB */
  const url = id ? `${UP}/${encodeURIComponent(id)}?uploadType=multipart&fields=${FIELDS}` : `${UP}?uploadType=multipart&fields=${FIELDS}`;
  return drive(id ? "PATCH" : "POST", url, {body, headers: {"Content-Type": `multipart/related; boundary=${B}`}, keepalive: !!keepalive && small});
}
async function fetchHint(){
  try{ const r = await drive("GET", ABOUT); const e = r && r.user && r.user.emailAddress; if(typeof e === "string" && e.includes("@") && connected()){ setMeta({hint: e}); paint(); } }catch(e){}
}

/* ---------- sincronizar ---------- */
let phase = connected() ? (meta().reconnect ? "reconnect" : "ok") : "off", errCode = "";
let chain = Promise.resolve(), queued = null, queuedWhy = "", lastCheck = 0;
/* lo que había al abrir la página, antes de que la portada o las misiones pongan nada al día */
const bootHash = connected() ? localHash() : null;
let retryT = 0, backoff = T.retry, pushT = 0, choice = null;
function setPhase(p, code){ phase = p; errCode = code || ""; paint(); }
function job(fn){ const p = chain.then(fn); chain = p.catch(() => {}); return p; }
function onErr(e){
  const c = (e && e.code) || "net";
  if(c === "superseded") return;
  if(c === "offline"){ setPhase("offline"); return; }
  if(c === "reconnect" || c === "auth" || c === "scope"){ markReconnect(); setPhase("reconnect"); return; }
  setPhase("error", c); retryLater();
}
function retryLater(){ clearTimeout(retryT); retryT = setTimeout(() => sync("retry"), backoff); backoff = Math.min(backoff * 2, T.retryMax); }
/* una sola sincronización a la vez; las que llegan mientras tanto se juntan en una */
function sync(why){
  if(!connected()) return Promise.resolve();
  queuedWhy = queuedWhy === "boot" ? "boot" : why;
  if(queued) return queued;
  queued = job(async () => {
    const w = queuedWhy; queued = null; queuedWhy = "";
    if(!connected()) return;
    clearTimeout(retryT); clearTimeout(pushT); pushT = 0;
    if(meta().choice){ await firstSync(); return; }
    if(!online()){ setPhase("offline"); return; }
    if(phase !== "ok") setPhase("busy");
    await run(w);
    backoff = T.retry;
  }).catch(onErr);
  return queued;
}
function adopt(remote, h){
  setMeta({fileId: remote.id, baseHash: h, remoteModified: remote.modifiedTime || null, lastSync: now(), localDirty: false});
  lastCheck = now(); setPhase("ok");
}
async function push(id, keys, h, keepalive){
  let r;
  try{ r = await upload(id, keys, h, keepalive); }
  catch(e){ if(e && e.code === "gone" && id){ setMeta({fileId: null}); r = await upload(null, keys, h, keepalive); } else throw e; }
  setMeta({fileId: (r && r.id) || id, remoteModified: (r && r.modifiedTime) || null, baseHash: h, lastPushedHash: h, localDirty: false, lastSync: now()});
  lastCheck = now(); setPhase("ok");
}
/* cargar la partida de Google (apply guarda la de ahora para deshacer y recarga) */
const APPLIED = "vocab:sync-applied";
function pull(remote, keys, h, flash){
  let list = []; try{ list = JSON.parse(sessionStorage.getItem(APPLIED) || "[]"); }catch(e){}
  if(!Array.isArray(list)) list = [];
  list = list.filter(t => typeof t === "number" && now() - t < 20e3 && t <= now());
  if(list.length >= 4){ setPhase("error", "loop"); return; }   /* nunca recargar una y otra vez */
  const before = S.metaGet(M.sync, null);
  setMeta({fileId: remote.id, baseHash: h, remoteModified: remote.modifiedTime || null, lastSync: now(), localDirty: false, choice: false});
  try{ list.push(now()); sessionStorage.setItem(APPLIED, JSON.stringify(list)); }catch(e){}
  const err = S.apply(keys, "load", flash || {t: "☁️ Partida actualizada desde otro aparato", adult: false});
  if(err){ if(before) S.metaSet(M.sync, before); setPhase("error", err === "rollback" ? "rollback" : "space"); if(err !== "rollback") msg(err, "bad"); }
  else { choice = null; setPhase("busy"); }
}
async function run(why){
  let m = meta();
  const keys = S.collect(true), lh = hashKeys(keys), hidden = !visible();
  /* «cambió aquí»: al arrancar se mira lo que había al abrir (no lo que la portada pone al día en ese momento) */
  const dirty = (why === "boot" && bootHash) ? bootHash !== m.baseHash : lh !== m.baseHash;
  if(m.localDirty !== (lh !== m.baseHash)) m = setMeta({localDirty: lh !== m.baseHash});
  /* al esconderse hay poco tiempo: si se miró Google hace poco, se sube directamente */
  if(hidden && m.fileId && now() - lastCheck < 2 * MIN){
    if(lh !== m.baseHash) await push(m.fileId, keys, lh, true); else setPhase("ok");
    return;
  }
  let remote = null;
  if(m.fileId){ try{ remote = await getMeta(m.fileId); }catch(e){ if(!e || e.code !== "gone") throw e; } }
  if(!remote) remote = await findFile();
  lastCheck = now(); m = setMeta({lastPull: now()});
  if(!remote){ await push(null, keys, lh, hidden); return; }
  if(remote.id !== m.fileId) m = setMeta({fileId: remote.id});
  const rh = (remote.appProperties && remote.appProperties.hash) || null;
  const changed = rh ? rh !== m.baseHash : remote.modifiedTime !== m.remoteModified;
  if(!changed){
    if(lh !== m.baseHash) await push(remote.id, keys, lh, hidden);
    else { setMeta({remoteModified: remote.modifiedTime || null, lastSync: now()}); setPhase("ok"); }
    return;
  }
  if(rh && rh === lh){ adopt(remote, lh); return; }
  if(hidden){ setPhase("ok"); return; }   /* la de Google es nueva: se carga al volver, no con la página escondida */
  const p = S.parse(await download(remote.id));
  if(!p.ok){ await push(remote.id, keys, lh, false); return; }   /* la de Google está dañada: se reemplaza */
  const rk = p.data.keys, rkh = hashKeys(rk);
  if(rkh === lh){ adopt(remote, lh); return; }
  if(!dirty || score(rk) >= score(keys)){ pull(remote, rk, rkh); return; }
  /* cambiaron las dos y esta tiene más progreso: se sube y la de Google queda como copia para deshacer */
  S.keepUndo(rk, Date.parse(remote.modifiedTime) || now());
  await push(remote.id, keys, lh, false);
  paintUndo();
}
/* primera vez en este aparato (o pendiente de elegir) */
async function firstSync(){
  const remote = await findFile();
  setMeta({lastPull: now()});
  const keys = S.collect(true), lh = hashKeys(keys);
  if(!remote){ setMeta({connectedAt: meta().connectedAt || now(), choice: false}); await push(null, keys, lh, false); return; }
  const p = S.parse(await download(remote.id));
  setMeta({connectedAt: meta().connectedAt || now(), fileId: remote.id});
  if(!p.ok){ setMeta({choice: false}); await push(remote.id, keys, lh, false); return; }
  const rk = p.data.keys, rkh = hashKeys(rk);
  if(rkh === lh){ setMeta({choice: false}); adopt(remote, lh); return; }
  if(!hasProgress(keys)){ pull(remote, rk, rkh, {t: "✓ Partida de Google cargada", adult: true}); return; }
  setMeta({choice: true});
  choice = {remote, keys: rk, hash: rkh, saved: p.data.saved || Date.parse(remote.modifiedTime) || null};
  setPhase("choice");
}
function useLocal(){
  const c = choice; if(!c) return;
  return job(async () => {
    const keys = S.collect(true), lh = hashKeys(keys);
    S.keepUndo(c.keys, c.saved || now());
    setMeta({choice: false}); choice = null;
    await push(c.remote.id, keys, lh, false);
    paintUndo(); closeBox();
    msg("✓ Se ha guardado en Google la partida de este aparato. La que había en Google queda como copia: «↩️ Deshacer» la recupera.", "ok");
  }).catch(onErr);
}
function useRemote(){
  const c = choice; if(!c) return;
  pull(c.remote, c.keys, c.hash, {t: "✓ Partida de Google cargada", adult: true});
}

/* subir unos segundos después de jugar */
function schedule(){
  if(pushT || !connected() || meta().choice) return;
  pushT = setTimeout(() => { pushT = 0; if(connected() && localHash() !== meta().baseHash) sync("change"); }, T.debounce);
}
const dirtyNow = () => { const m = meta(); return !!m.connectedAt && !m.choice && localHash() !== m.baseHash; };
["coins", "lesson-done", "review-done", "farm-feed", "farm-harvest", "farm-collect", "buy", "game-done", "medal", "gift-open", "album-complete", "route"]
  .forEach(ev => bus.on(ev, () => { if(connected()){ schedule(); paintChip(); } }));
let pollI = 0;
function startPoll(){
  if(pollI) return;
  pollI = setInterval(() => {
    if(!connected() || !visible()) return;
    if(dirtyNow()) schedule();
    paintStatus(); paintChip(); preGis();
  }, T.poll);
}
let lastVis = 0;
document.addEventListener("visibilitychange", () => {
  if(!connected()) return;
  if(!visible()){ if(dirtyNow()) sync("hide"); }
  else if(now() - lastVis > 5e3){ lastVis = now(); sync("visible"); }
});
window.addEventListener("pagehide", () => { if(dirtyNow()) sync("hide"); });
window.addEventListener("online", () => { if(connected()) sync("online"); });
window.addEventListener("offline", () => { if(connected()) setPhase("offline"); });

/* ---------- renovar el permiso dentro de un toque del niño ----------
   El permiso de Google dura ~1 hora y renovarlo abre (y cierra sola) una ventanita de Google, que el navegador
   solo deja abrir dentro de un toque. Así que se renueva:
   - con la pastilla «Guardar» junto a las monedas (cuando hace falta y hay algo sin subir o hace más de 1 h que no se mira)
   - de paso, en toques que el niño ya hace fuera de una pregunta (las pestañas, el botón principal de una pantalla, el
     fin de lección, la granja, las monedas), como mucho una vez cada 50 min y solo si el permiso caduca en 5 min o ya
     caducó. Nunca en mitad de una lección, un repaso o una partida, ni en la Puerta de mayores ([data-no-renew]). */
const TAP_GAP = 50 * MIN, SOON = 5 * MIN;
const tokLeft = () => isObj(tok) && typeof tok.exp === "number" ? tok.exp - now() : -1;
/* llamar SIEMPRE desde dentro de un manejador de click: requestAccessToken se llama en el mismo toque */
function renewInTap(force){
  const m = meta();
  if(!m.connectedAt || m.choice || !online() || !gisReady()) return null;
  if(!force && (tokLeft() > SOON || now() - (m.tapAt || 0) < TAP_GAP)) return null;
  setMeta({tapAt: now()}); lastSilent = now();
  const p = askToken(false);   /* con GIS ya cargado, la ventana se pide aquí mismo, dentro del toque */
  return p.then(() => { clearReconnect(); if(phase === "reconnect") setPhase("busy"); paintChip(); return sync("tap"); })
    .catch(e => { if(e && e.code !== "superseded" && !tokOk()) markReconnect(); paintChip(); throw e; });
}
/* el script de Google se tiene preparado cuando el permiso va a hacer falta pronto */
function preGis(){
  const m = meta();
  if(m.connectedAt && !m.choice && online() && !gisReady() && (m.reconnect || tokLeft() < 10 * MIN)) loadGis().catch(() => {});
}
const OPP = '.tabbar [data-nav], .glass-btn--pri, .btn-fill, .btn-pri, .btn.lc, .ls-end a, .ls-end button, a[href="#/granja"], a[href="#/mapa"], a.ba, [data-coins-pill], [data-open=ajustes]';
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest(OPP); if(!a || a.closest("[data-no-renew], .opt")) return;
  const r = document.documentElement;
  if(r.hasAttribute("data-gm-play") || (r.dataset.focus && !a.closest(".ls-end"))) return;
  const p = renewInTap(false); if(p) p.catch(() => {});
}, true);

/* pastilla «Guardar» (icono de nube) junto a las monedas, en el hueco [data-sync-slot] de la barra de arriba. Es lo único
   de Google que ve el niño: sale solo si el permiso caducó y hay algo sin subir, y la renovación va dentro de su toque. */
function chipWanted(){
  const m = meta();
  if(!m.connectedAt || m.choice || tokOk() || !(m.reconnect || phase === "reconnect")) return false;
  return dirtyNow() || !m.lastPull || now() - m.lastPull > 60 * MIN;
}
function paintChip(){
  const want = chipWanted();
  let c = $s("sv-chip");
  if(!want){ if(c) c.remove(); return; }
  preGis();
  if(c) return;
  const slot = document.querySelector("[data-sync-slot]"); if(!slot) return;
  css();
  c = document.createElement("button");
  c.type = "button"; c.id = "sv-chip"; c.className = "glass-btn glass-btn--pri glass-btn--sm sv-chip"; c.dataset.noRenew = "";
  c.title = "Guardar tu partida en Google"; c.setAttribute("aria-label", "Guardar tu partida en Google");
  c.innerHTML = `${ico("cloud-arrow-up", "bold", 20)}<span class="sv-chip-t" aria-hidden="true">Guardar</span>`;
  c.onclick = () => {
    if(c.disabled) return;
    c.disabled = true;
    const p = renewInTap(true);
    if(!p){ c.disabled = false; try{ toast(online() ? "☁️ Un momento y vuelve a tocar" : "📴 Sin internet: se guardará luego"); }catch(e){} if(online()) loadGis().catch(() => {}); return; }
    p.then(() => { if(!chipWanted()) try{ toast("☁️ ¡Partida guardada!"); }catch(e){} })
     .catch(() => { try{ toast("☁️ Ahora no se pudo guardar. Prueba luego."); }catch(e){} })
     .finally(() => { const x = $s("sv-chip"); if(x) x.disabled = false; paintChip(); });
  };
  slot.appendChild(c);
  try{ if(window.M && typeof M.bump === "function") M.bump(c); }catch(e){}
}

/* lo que no debe hacer un niño solo (entrar o salir de Google, cambiar o borrar una partida) pasa por la Puerta de
   mayores. Si se pasó hace poco, sigue dentro del mismo toque (así la ventana de Google se puede abrir). */
function gated(reason, fn, from){
  const g = window.adultGate;
  if(typeof g !== "function" || g.passed()) return fn();
  g({reason, from}).then(ok => { if(ok) fn(); });
}

/* ---------- entrar y salir ---------- */
const AUTH_MSG = {
  closed: "No se ha terminado de entrar en Google. Puedes intentarlo otra vez.",
  denied: "Google no ha dado permiso. Puedes intentarlo otra vez.",
  scope: "Hace falta permitir que la app guarde en Google Drive (marca la casilla). Inténtalo otra vez.",
  blocked: "El navegador no ha dejado abrir la ventana de Google. Permite las ventanas emergentes e inténtalo otra vez.",
  offline: "Sin internet. Conéctate a internet para entrar con Google.",
  gis: "No se pudo abrir Google. Comprueba la conexión e inténtalo otra vez.",
};
async function connect(){
  if(!online()){ msg(AUTH_MSG.offline, "bad"); return; }
  const b = document.querySelector("#sv-g, #sv-re"); if(b) b.disabled = true;
  msg("Abriendo Google…");
  try{ await askToken(true); }
  catch(e){ const c = (e && e.code) || "gis"; if(c !== "superseded") msg(AUTH_MSG[c] || AUTH_MSG.gis, "bad"); if(b && b.isConnected) b.disabled = false; return; }
  clearReconnect(); lastSilent = 0; msg("");
  if(connected() && !meta().choice){ if(!meta().hint) fetchHint(); sync("reconnect"); return; }
  setPhase("busy");
  job(firstSync).then(() => { if(phase === "ok") msg("✓ Conectado. La partida se guarda sola en Google.", "ok"); startPoll(); if(connected() && !meta().hint) fetchHint(); })
    .catch(e => { if(!connected()) msg("No se pudo hablar con Google Drive. Inténtalo otra vez en un rato.", "bad"); onErr(e); if(!connected()) setPhase("off"); });
}
function disconnect(){
  const t = tok && tok.t; const c = $s("sv-chip"); if(c) c.remove();
  dropTok(); S.metaDel(M.sync); choice = null;
  clearTimeout(pushT); pushT = 0; clearTimeout(retryT);
  if(t && online()){
    try{
      if(gisReady()) google.accounts.oauth2.revoke(t, () => {});
      else fetch(REVOKE, {method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: "token=" + encodeURIComponent(t)}).catch(() => {});
    }catch(e){}
  }
  closeBox(); setPhase("off");
  msg("Has salido de Google. La partida sigue en este aparato.", "ok");
}

/* ---------- fechas ---------- */
function agoMin(t){
  if(typeof t !== "number" || !isFinite(t)) return "todavía no";
  const d = now() - t;
  if(d < MIN) return "hace un momento";
  if(d < 60 * MIN) return `hace ${Math.floor(d / MIN)} min`;
  if(d < DAY) return `hace ${Math.floor(d / (60 * MIN))} h`;
  return S.ago(t);
}

/* ---------- estilos (el bloque va en las filas agrupadas de Ajustes: .st-g, .st-r, .st-ic de index.html) ---------- */
const CSS = `
.sv{margin:0}
.sv [hidden],.sv-rem [hidden]{display:none!important}
.sv .st-ic svg[data-brand]{width:18px;height:18px}
.sv .st-r.st-btn:disabled{opacity:.55;cursor:default}
.sv .sv-quiet{color:var(--label);font-weight:400}
.sv-msg{margin:8px 16px 0;font:600 var(--fs-note,.9375rem)/1.38 var(--f-text,system-ui);color:var(--label2)}
.sv-msg:empty{display:none}
.sv-msg.ok{color:var(--ok-ink)}.sv-msg.bad{color:var(--miss-ink)}
.sv-acc{overflow-wrap:anywhere}
.sv-box{margin:12px 0 0;padding:16px;border-radius:var(--r-card,24px);background:var(--card)}
:root[data-theme=dark] .sv-box{background:var(--card-2)}
.sv-box h3{margin:0 0 8px;font:600 var(--fs-head,1.1875rem)/1.26 var(--f-text,system-ui);color:var(--label)}
.sv-box p{margin:0 0 10px;font:400 var(--fs-note,.9375rem)/1.38 var(--f-text,system-ui);color:var(--label2)}
.sv-box p b{color:var(--label)}
.sv-acts{display:flex;flex-direction:column;gap:8px}
.sv-cmp{width:100%;border-collapse:collapse;font:400 var(--fs-note,.9375rem)/1.3 var(--f-text,system-ui);margin:0 0 12px;table-layout:fixed;color:var(--label)}
.sv-cmp th,.sv-cmp td{padding:7px 6px;border-bottom:.5px solid var(--sep);text-align:left;vertical-align:top;overflow-wrap:anywhere}
.sv-cmp th{color:var(--label2);font-weight:600;font-size:var(--fs-min,.8125rem)}
.sv-cmp td:nth-child(n+2){font-weight:600}
.sv-cmp td:first-child{width:40%}
.sv-undo{margin-top:12px}
.sv-rem{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;margin:0 0 12px}
.sv-rem-ic{flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--brand-fill);color:#fff}
.sv-rem-tx{flex:1;min-width:0}
.sv-rem h2{margin:0;font:600 var(--fs-head,1.1875rem)/1.26 var(--f-text,system-ui);color:var(--label)}
.sv-rem p{margin:2px 0 10px;font:400 var(--fs-note,.9375rem)/1.35 var(--f-text,system-ui);color:var(--label2)}
.sv-rem-b{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.sv-later{min-height:44px;padding:0 10px;border:0;background:none;color:var(--label2);font:600 var(--fs-sub,1.0625rem)/1.2 var(--f-text,system-ui);cursor:pointer}
.sv-chip{flex:none}
.sv-chip:disabled{opacity:.7}
@media (min-width:820px) and (max-width:1099px){.sv-chip{width:var(--tap,44px);padding:0}.sv-chip-t{display:none}}
`;
function css(){ if(document.getElementById("css-sync")) return; const s = document.createElement("style"); s.id = "css-sync"; s.textContent = CSS; document.head.appendChild(s); }
const G = `<svg viewBox="0 0 48 48" aria-hidden="true" data-brand="google"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

/* ---------- bloque «Guardar la partida en Google» (Ajustes › Para mayores) ---------- */
const $s = id => document.getElementById(id);
const flag = L => { const l = (typeof LANGS !== "undefined" && LANGS[L] && LANGS[L].label) || L; return l.split(" ")[0]; };
const msg = (t, k) => { const m = $s("sv-msg"); if(m){ m.textContent = t; m.className = "sv-msg" + (k ? " " + k : ""); } };
const ERR = {
  full: "Tu Google Drive está lleno: libera espacio para seguir guardando la partida.",
  rate: "Google está muy ocupado ahora. Lo intentaremos otra vez en un rato.",
  server: "Google no responde ahora. Lo intentaremos otra vez en un rato.",
  net: "No se pudo conectar con Google. Lo intentaremos otra vez en un rato.",
  gone: "No se encontró la partida en Google. Lo intentaremos otra vez en un rato.",
  loop: "La partida ha cambiado varias veces seguidas. Toca «Guardar ahora» para intentarlo otra vez.",
  space: "No hay sitio en el navegador para la partida de Google.",
  rollback: "El navegador se quedó sin sitio a mitad de la carga. Toca «Volver a la partida de antes» para recuperarla.",
};
/* una fila (o un botón) de las de Ajustes: icono en su cuadradito, texto y una línea pequeña */
const row = (ic, cls, t, sub, id) => `<div class="st-r"${id ? ` id="${id}"` : ""}><span class="st-ic${cls ? " " + cls : ""}" aria-hidden="true">${ic}</span><span class="st-l">${t}${sub ? `<small class="sv-acc">${sub}</small>` : ""}</span></div>`;
const btn = (id, ic, cls, t, sub, extra) => `<button type="button" class="st-r st-btn${extra ? " " + extra : ""}" id="${id}"><span class="st-ic${cls ? " " + cls : ""}" aria-hidden="true">${ic}</span><span class="st-l">${t}${sub ? `<small>${sub}</small>` : ""}</span></button>`;
const okText = () => `Sincronizado · ${agoMin(meta().lastSync)}`;
function statusHtml(){
  const m = meta();
  if(!m.connectedAt) return `<div class="st-g ics">${btn("sv-g", G, "gg", "Entrar con Google", "La partida se guarda sola y se puede seguir en otro aparato.")}</div>
    <p class="st-foot">La app solo usa una carpeta privada suya en tu Google Drive: no puede ver tus archivos. <a href="privacy.html">Privacidad</a></p>`;
  const acc = m.hint ? esc(m.hint) : "Conectado con Google";
  const now_ = btn("sv-now", ico("arrows-clockwise", "bold", 18), "", "Guardar ahora", "");
  const out = btn("sv-out", ico("sign-out", "bold", 18), "gr", "Salir de Google", "", "sv-quiet");
  if(m.choice) return `<div class="st-g ics">${row(ico("cloud-check", "bold", 18), "", "Conectado con Google",
    `${acc} · ${choice ? "Elige qué partida quieres seguir." : "Mirando la partida de Google…"}`)}${out}</div>`;
  const last = agoMin(m.lastSync);
  let st, foot = "";
  if(phase === "reconnect" || m.reconnect){
    st = row(ico("cloud-slash", "bold", 18), "gr", "Hace falta volver a entrar en Google", acc) + btn("sv-re", ico("sign-in", "bold", 18), "", "Volver a conectar", "");
    if(m.lastSync) foot = `<p class="st-foot">Última vez guardada en Google: ${esc(last)}. Lo que se juegue mientras tanto se guarda aquí y se subirá al conectar.</p>`;
  }
  else if(phase === "offline") st = row(ico("wifi-slash", "bold", 18), "gr", "Sin internet", `Se guardará en Google cuando vuelva la conexión.${m.lastSync ? " Última vez: " + esc(last) + "." : ""}`);
  else if(phase === "busy") st = row(ico("arrows-clockwise", "bold", 18), "", "Sincronizando con Google…", acc);
  else if(phase === "error") st = row(ico("warning-circle", "bold", 18), "gr", esc(ERR[errCode] || ERR.server), `${acc}${m.lastSync ? " · última vez " + esc(last) : ""}`);
  else st = row(ico("cloud-check", "bold", 18), "ok", `<span id="sv-ok">${esc(okText())}</span>`, acc);
  return `<div class="st-g ics">${st}${now_}${out}</div>${foot}`;
}
function blockHtml(){
  return `<section class="sv" id="sv-box" aria-label="Guardar la partida en Google">
    <div id="sv-dyn">${statusHtml()}</div>
    <p class="sv-msg" id="sv-msg" role="status" aria-live="polite"></p>
    <div id="sv-confirm" hidden></div>
    <div id="sv-undo-w"></div>
    <p class="st-foot" id="sv-safe"></p>
    <p class="st-foot" id="sv-ios" hidden></p>
  </section>`;
}
function paintStatus(){
  const ok = $s("sv-ok"); if(ok && phase === "ok") ok.textContent = okText();
  cfgPaint();
}
function paint(){
  cfgPaint(); paintChip();
  const d = $s("sv-dyn"); if(!d) return;
  const focus = document.activeElement && d.contains(document.activeElement) ? document.activeElement.id : "";
  d.innerHTML = statusHtml();
  const on = (id, f) => { const b = $s(id); if(b) b.onclick = f; };
  on("sv-g", e => gated("Para entrar con Google.", connect, e.currentTarget));
  on("sv-re", e => gated("Para volver a entrar en Google.", connect, e.currentTarget));
  on("sv-out", e => gated("Para salir de Google.", disconnect, e.currentTarget));
  on("sv-now", () => { msg(""); lastSilent = 0;
    if(!tokOk()){ const p = renewInTap(true); if(p){ p.catch(e => { if(e && e.code !== "superseded") msg(AUTH_MSG[e.code] || AUTH_MSG.gis, "bad"); }); return; } }
    sync("manual"); });
  if(focus && $s(focus)) $s(focus).focus({preventScroll: true});
  paintSafe();
  if(phase === "choice" && choice) choiceBox();
  else if(!meta().choice){ const b = $s("sv-confirm"); if(b && b.dataset.k === "choice") closeBox(); }
}
function closeBox(){ const b = $s("sv-confirm"); if(b){ b.hidden = true; b.innerHTML = ""; delete b.dataset.k; } }
function cmpRows(a, b, colA, colB, savedB){
  const used = S.langs().filter(L => a.per[L].lessons || a.per[L].words || b.per[L].lessons || b.per[L].words);
  const by = (s, f) => used.length ? used.map(L => `${flag(L)} ${s.per[L][f]}`).join(" · ") : "0";
  return `<table class="sv-cmp"><thead><tr><th></th><th>${colA}</th><th>${colB}</th></tr></thead><tbody>
      ${savedB ? `<tr><td>Guardada</td><td>—</td><td>${esc(S.fmtShort(savedB))}</td></tr>` : ""}
      <tr><td>Monedas ganadas</td><td>${a.earned}</td><td>${b.earned}</td></tr>
      <tr><td>Animales de la granja</td><td>${a.animals}</td><td>${b.animals}</td></tr>
      <tr><td>Lecciones del camino</td><td>${by(a, "lessons")}</td><td>${by(b, "lessons")}</td></tr>
      <tr><td>Palabras en repaso</td><td>${by(a, "words")}</td><td>${by(b, "words")}</td></tr>
    </tbody></table>`;
}
/* primera vez: ¿la de Google o la de este aparato? */
function choiceBox(){
  const box = $s("sv-confirm"); if(!box || !choice || box.dataset.k === "choice") return;
  const lk = S.collect(true), a = S.summary(lk), b = S.summary(choice.keys);
  const g = score(choice.keys) >= score(lk);
  box.dataset.k = "choice";
  box.innerHTML = `<div class="sv-box" role="group" aria-labelledby="sv-c-h">
    <h3 id="sv-c-h">Ya hay una partida guardada en Google</h3>
    <p>Este aparato también tiene progreso. ¿Con cuál seguimos? La otra se guarda como copia para deshacer.</p>
    ${cmpRows(a, b, "En este aparato", "En Google", choice.saved)}
    <p>Recomendado: <b>${g ? "la de Google" : "la de este aparato"}</b>, porque tiene más progreso.</p>
    <div class="sv-acts">
      <button class="glass-btn glass-btn--block${g ? " glass-btn--pri" : ""}" id="sv-use-g" type="button">Usar la partida de Google</button>
      <button class="glass-btn glass-btn--block${g ? "" : " glass-btn--pri"}" id="sv-use-l" type="button">Usar la de este aparato</button></div></div>`;
  box.hidden = false;
  const lock = () => { $s("sv-use-g").disabled = $s("sv-use-l").disabled = true; };
  $s("sv-use-g").onclick = e => gated("Para elegir la partida.", () => { lock(); msg("Cargando la partida de Google…", "ok"); useRemote(); }, e.currentTarget);
  $s("sv-use-l").onclick = e => gated("Para elegir la partida.", () => { lock(); msg("Guardando en Google…"); useLocal(); }, e.currentTarget);
}
/* «Volver a la partida de antes»: la copia automática */
function paintUndo(){
  const w = $s("sv-undo-w"); if(!w) return;
  const u = S.metaGet(M.undo, null);
  w.innerHTML = u && isObj(u.keys) ? `<div class="st-g ics sv-undo" id="sv-undo">
      ${btn("sv-undo-b", ico("arrow-counter-clockwise", "bold", 18), "sl", "Volver a la partida de antes", "Copia automática del " + esc(S.fmtDate(Date.parse(u.saved) || now())))}
      ${btn("sv-undo-x", ico("trash", "bold", 18), "gr", "Borrar esta copia", "", "sv-quiet")}</div>` : "";
  const ub = $s("sv-undo-b"); if(ub) ub.onclick = undoBox;
  const ux = $s("sv-undo-x"); if(ux) ux.onclick = e => gated("Para borrar la copia.", () => { S.metaDel(M.undo); paintUndo(); msg("Copia borrada."); }, e.currentTarget);
}
function undoBox(){
  const box = $s("sv-confirm"), u = S.metaGet(M.undo, null); if(!box) return;
  const p = S.parse(u ? JSON.stringify({app: S.APP, v: S.VER, saved: u.saved, keys: u.keys}) : "");
  if(!p.ok){ msg(p.err, "bad"); return; }
  const a = S.summary(S.collect()), b = S.summary(p.data.keys);
  box.dataset.k = "undo";
  box.innerHTML = `<div class="sv-box" role="group" aria-labelledby="sv-c-h">
    <h3 id="sv-c-h">¿Volver a la partida de antes?</h3>
    ${cmpRows(a, b, "Ahora en este aparato", "Partida de antes", p.data.saved)}
    <p><b>Esto reemplazará la partida de este aparato</b>${connected() ? " y después la de Google" : ""}.</p>
    <div class="sv-acts"><button class="glass-btn glass-btn--block glass-btn--pri" id="sv-yes" type="button">Sí, volver a la de antes</button>
      <button class="glass-btn glass-btn--block" id="sv-no" type="button">Cancelar</button></div></div>`;
  box.hidden = false;
  $s("sv-no").onclick = () => { closeBox(); msg("No se ha cambiado nada."); };
  $s("sv-yes").onclick = e => gated("Para cambiar la partida.", () => {
    $s("sv-yes").disabled = $s("sv-no").disabled = true;
    const err = S.apply(p.data.keys, "undo");
    if(err){ msg(err, "bad"); closeBox(); } else msg("Volviendo a la partida de antes…", "ok");
  }, e.currentTarget);
  try{ box.scrollIntoView({block: "nearest", behavior: window.M && M.rm() ? "auto" : "smooth"}); }catch(e){}
  $s("sv-yes").focus({preventScroll: true});
}
function paintSafe(){
  const el = $s("sv-safe"); if(!el) return;
  const p = S.persisted, c = connected();
  el.textContent = p === true ? "Datos protegidos: este navegador no los borrará para hacer sitio."
    : c ? "Aunque el navegador borre los datos, la partida está en Google."
    : p === false ? "Este navegador podría borrar los datos si se queda sin espacio. Conecta Google para tener una copia."
    : "No sabemos si este navegador protege los datos. Conecta Google para tener una copia.";
  const io = $s("sv-ios");
  if(io){ const show = S.isIOS() && !S.standalone(); io.hidden = !show;
    if(show) io.innerHTML = "<b>En iPhone o iPad</b>, si añades la app a la <b>pantalla de inicio</b> (Safari › Compartir › «Añadir a pantalla de inicio»), ábrela desde ese icono y entra allí también con Google: la app del icono tiene sus propios datos."; }
}
bus.on("save-persist", paintSafe);
/* pone el bloque en Ajustes › Para mayores (host = el [data-sync-block] de esa página) */
function mountBlock(host){
  if(!host) return;
  css();
  host.innerHTML = blockHtml();
  paint(); paintUndo(); paintSafe();
  /* el script de Google se prepara al abrir «Para mayores», así la ventana sale enseguida al tocar */
  if(online() && (!connected() || meta().reconnect)) loadGis().catch(() => {});
}
/* con el bloque a la vista: el foco en lo que toca hacer (entrar, volver a conectar, elegir o guardar) */
function openAdult(){
  setTimeout(() => {
    const box = $s("sv-box"); if(!box) return;
    try{ box.scrollIntoView({block: "nearest"}); }catch(e){}
    const b = $s("sv-g") || $s("sv-re") || $s("sv-use-g") || $s("sv-now"); if(b) b.focus({preventScroll: true});
  }, 80);
}
/* ir a los controles: Ajustes › Para mayores (antes, la Puerta). auto: sin que nadie lo pida (tras cargar una partida),
   solo si la Puerta ya se pasó hace poco: nunca sale una Puerta que nadie ha pedido */
function go(o = {}){
  if(typeof window.openSettings !== "function") return;
  if(o.auto && typeof window.adultGate === "function" && !window.adultGate.passed()) return;
  window.openSettings("google", {from: o.from});
}
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest("[data-sv-go]"); if(!a) return;
  e.preventDefault();
  const d = a.closest("dialog");
  if(d && d.open && d.id !== "ajustes"){ if(window.M && d.classList.contains("m-sheet")) M.closeSheet(d); else d.close(); }
  go({from: d ? null : a});
});
bus.on("settings", d => {
  if(!d || !d.el) return;
  if(d.page === "root") cfgPaint();
  else if(d.page === "mayores"){ mountBlock(d.el.querySelector("[data-sync-block]")); if(d.focus === "google") openAdult(); }
});

/* Ajustes: el estado de Google en la fila «Para mayores» ([data-sync-cfg]) */
function cfgText(){
  const m = meta();
  if(!m.connectedAt) return "Google: sin conectar";
  if(m.choice) return "Google: elige qué partida seguir";
  if(m.reconnect || phase === "reconnect") return "Google: hay que volver a entrar";
  return m.lastSync ? `Google: guardado ${agoMin(m.lastSync)}` : "Google: conectado";
}
function cfgPaint(){ document.querySelectorAll("[data-sync-cfg]").forEach(el => { el.textContent = cfgText(); }); }

/* ---------- aviso en la portada (solo si no está conectado, o si hace días que hay que volver a conectar) ---------- */
let shownVisit = false;   /* como mucho una vez por visita (carga de la página) */
function due(){
  const t = now(), sn = S.metaGet(M.snooze, 0);
  if(typeof sn === "number" && t < sn) return "";
  if(!S.progress()) return "";
  if(t - S.firstSeen() < 3 * DAY) return "";
  const m = meta();
  if(!m.connectedAt) return "connect";
  if(m.reconnect && t - m.reconnect > 3 * DAY) return "reconnect";
  return "";
}
const remSlot = async () => {   /* el primero de la portada: sale poco y así el niño lo ve sin bajar */
  const d = shownVisit ? "" : due(); if(!d) return "";
  shownVisit = true; css();
  return `<section class="card sv-rem" id="sv-rem" aria-labelledby="sv-rem-t">
    <span class="sv-rem-ic" aria-hidden="true">${ico("cloud-arrow-up", "bold", 22)}</span>
    <div class="sv-rem-tx"><h2 id="sv-rem-t">${d === "connect" ? "Pide a un mayor que guarde tu partida" : "Pide a un mayor que vuelva a conectar Google"}</h2>
      <p>Así nunca pierdes tus monedas, tu granja ni tus lecciones.</p>
      <div class="sv-rem-b"><button type="button" class="glass-btn glass-btn--sm" data-sv-go>Avisar a un mayor</button><button class="sv-later" id="sv-later" type="button">Ahora no</button></div></div>
  </section>`;
};
remSlot.id = "sync";
HOME_SLOTS.unshift(remSlot);
document.addEventListener("click", e => {
  if(!e.target.closest || !e.target.closest("#sv-later")) return;
  S.metaSet(M.snooze, now() + 2 * DAY);
  const r = $s("sv-rem"); if(r) r.remove();
});

/* ---------- arranque ---------- */
bus.on("boot", () => {
  const f = S.takeFlash();
  if(f){ setTimeout(() => { try{ toast(f.t); }catch(e){} }, 400); if(f.adult) setTimeout(() => go({auto: true}), 900); }
  if(!connected()) return;
  startPoll();
  lastVis = now();
  preGis();
  sync("boot").then(paintChip);
});

/* para pruebas y para los mayores curiosos */
window.vocabSync = Object.freeze({
  sync: why => sync(why || "manual"), connect, disconnect, due, hash: localHash, hashKeys, score, renewInTap, chipWanted, go,
  get state(){ return {phase, errCode, meta: meta(), tokOk: tokOk(), choice: !!choice}; },
  _delays(o){ Object.assign(T, o || {}); if(pollI){ clearInterval(pollI); pollI = 0; startPoll(); } if(pushT){ clearTimeout(pushT); pushT = 0; schedule(); } },
  _idle: () => chain,
});
})();
