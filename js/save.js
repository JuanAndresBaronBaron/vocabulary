/* Módulo save: copia de la partida sin servidor.
   - «💾 Guardar partida»: descarga vocabulario-partida-AAAA-MM-DD.json (y, si el móvil lo permite, «📤 Enviar archivo»).
   - «📂 Cargar partida»: lee ese archivo, enseña qué hay dentro comparado con lo de ahora y pide confirmación.
   - «📋 Copiar código» / «📥 Cargar código»: lo mismo como un texto (VOC1: gzip + base64url; VOC0: sin comprimir).
   - Antes de reemplazar guarda una copia automática ("save:undo") con «↩️ Deshacer».
   - Al arrancar pide al navegador que no borre los datos (navigator.storage.persist) y, en iPhone/iPad, aconseja
     añadir la app a la pantalla de inicio.
   - Portada (HOME_SLOTS): «💾 Pídele a un mayor que guarde tu partida» cada 7 días (o a los 3 días si nunca se guardó).
   Los controles viven en «Para mayores» (página de premios) y se llega también desde ⚙️.
   Formato: {app:"vocabulary", v:1, saved:"<ISO>", keys:{clave: "valor tal cual está en localStorage"}}.
   El origen juanandresbaronbaron.github.io lo comparten otras webs del mismo usuario: solo se leen, guardan y borran
   las claves del inventario de abajo; las demás no se tocan nunca. */
(() => {
"use strict";

const APP = "vocabulary", VER = 1;
const MAX = 5 * 1024 * 1024;          /* tamaño máximo de un archivo o código (localStorage suele dar ~5 MB) */
const DAY = 864e5;
const now = () => Date.now();          /* las pruebas pueden mover el reloj sustituyendo Date.now */

/* ---------- inventario de claves de la app ----------
   Revisado en index.html y js/*.js. Tipo: "o" = objeto obligatorio (la app hace Object.values/keys sobre él),
   "*" = cualquier JSON válido (la app ya se defiende de valores raros).
   Exactas:
     game (monedas, personaje, compras) · act (actividad por día) · lang · rate · theme · mute (sfx.js) · mapLv ·
     prEx · prAuto · prPrefs (prácticas) · farm:state (farm.js) · games:best · games:topic · games:day (games.js) ·
     buddy:hide · buddy:missions · buddy:wotd (buddy.js) · album:tab (album.js)
   Por idioma (<lang> = una clave de LANGS: english, français, dansk):
     srs:<lang> (repaso) · map:<lang> (lecciones del camino) · voice:<lang> · album:seen|done|uniq|orph:<lang>
   Prácticas por documento: pr:<docId>:<lang>
   Solo de este aparato (no se exporta ni se restaura): offline (si ya descargó la web para usarla sin internet).
   Propias de este módulo (no se exportan ni se restauran desde un archivo):
     save:last (fecha de la última copia; al cargar una partida pasa a ser «ahora», porque lo que hay en el aparato
       ya está en una copia; así el aviso no sale enseguida ni se esconde por una fecha vieja del archivo) ·
     save:first (primer día de uso, para el aviso) · save:snooze («Ahora no» hasta…) · save:undo (copia para deshacer). */
const EXACT = {
  game: "o", act: "o", prPrefs: "o", "farm:state": "o",
  lang: "*", rate: "*", theme: "*", mute: "*", mapLv: "*", prEx: "*", prAuto: "*",
  "games:best": "*", "games:topic": "*", "games:day": "*",
  "buddy:hide": "*", "buddy:missions": "*", "buddy:wotd": "*", "album:tab": "*",
};
const PER_LANG = {"srs:": "o", "map:": "o", "voice:": "*", "album:seen:": "*", "album:done:": "*", "album:uniq:": "*", "album:orph:": "*"};
const DEVICE_ONLY = ["offline"];
const META = {last: "save:last", first: "save:first", snooze: "save:snooze", undo: "save:undo"};
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
/* las claves de la app que hay ahora en localStorage, con su texto tal cual */
function collect(){
  const out = {};
  try{
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(typeOf(k)){ const v = localStorage.getItem(k); if(v !== null) out[k] = v; }
    }
  }catch(e){}
  return out;
}
const snapshot = () => ({app: APP, v: VER, saved: new Date(now()).toISOString(), keys: collect()});
const metaGet = (k, d) => { try{ const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }catch(e){ return d; } };
const metaSet = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } };
const metaDel = k => { try{ localStorage.removeItem(k); }catch(e){} };

/* ---------- leer y comprobar una partida ---------- */
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const fail = err => ({ok: false, err});
/* devuelve {ok, data:{saved, keys}, ignored} o {ok:false, err} */
function parse(text){
  if(typeof text !== "string" || !text.trim()) return fail("El archivo está vacío.");
  if(text.length > MAX) return fail("Es demasiado grande para ser una partida de Vocabulario.");
  let o; try{ o = JSON.parse(text); }catch(e){ return fail("Esto no es una partida de Vocabulario (o está dañada). No se ha cambiado nada."); }
  if(!isObj(o) || o.app !== APP) return fail("Esto no es una partida de Vocabulario: parece de otra app. No se ha cambiado nada.");
  if(typeof o.v !== "number" || !(o.v >= 1)) return fail("La partida está dañada (falta la versión). No se ha cambiado nada.");
  if(o.v > VER) return fail("Esta partida es de una versión más nueva de la app. Recarga la página para actualizarla y prueba otra vez.");
  if(!isObj(o.keys)) return fail("La partida está dañada (no tiene datos). No se ha cambiado nada.");
  const keys = {}; let ignored = 0;
  for(const [k, v] of Object.entries(o.keys)){
    const t = typeOf(k);
    if(!t){ ignored++; continue; }
    if(typeof v !== "string") return fail(`La partida está dañada (dato «${k}»). No se ha cambiado nada.`);
    let p; try{ p = JSON.parse(v); }catch(e){ return fail(`La partida está dañada (dato «${k}»). No se ha cambiado nada.`); }
    if(t === "o" && !isObj(p)) return fail(`La partida está dañada (dato «${k}»). No se ha cambiado nada.`);
    keys[k] = v;
  }
  const t = Date.parse(o.saved);
  return {ok: true, data: {saved: isFinite(t) ? t : null, keys}, ignored};
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
const FLASH = "vocab:save-flash";   /* sessionStorage: mensaje que se enseña al recargar */
function writeAll(keys){
  for(const k of Object.keys(collect())) localStorage.removeItem(k);
  for(const [k, v] of Object.entries(keys)) if(typeOf(k)) localStorage.setItem(k, v);
}
/* mode "load": guarda copia para deshacer · "undo": vuelve a la copia y la borra */
function apply(keys, mode){
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
    try{ writeAll(before); }catch(e2){}
    if(mode === "load") metaDel(META.undo);
    return "No hay sitio en el navegador para esta partida. No se ha cambiado nada.";
  }
  try{ sessionStorage.setItem(FLASH, mode === "load" ? "✓ ¡Partida cargada!" : "↩️ Has vuelto a la partida de antes"); }catch(e){}
  setTimeout(() => location.reload(), 60);
  return "";
}

/* ---------- código de texto ---------- */
const b64u = bytes => { let s = ""; for(let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = str => { const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4)); const b = new Uint8Array(s.length); for(let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
const pipe = async (bytes, T) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new T("gzip"))).arrayBuffer());
async function encode(obj){
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if(typeof CompressionStream === "function"){ try{ return "VOC1:" + b64u(await pipe(raw, CompressionStream)); }catch(e){} }
  return "VOC0:" + b64u(raw);
}
/* devuelve el texto JSON de la partida, o lanza un Error con un mensaje para mayores */
async function decode(code){
  const c = String(code || "").replace(/\s+/g, "");
  if(!c) throw new Error("Pega primero el código.");
  if(c.length > MAX * 1.4) throw new Error("El código es demasiado largo para ser una partida.");
  if(c.startsWith("{")) return String(code).trim();   /* han pegado el contenido del archivo: también vale */
  const m = /^VOC([01]):([A-Za-z0-9_-]+)$/.exec(c);
  const bad = "El código no es válido. Copia el código entero, desde «VOC1:» hasta el final. No se ha cambiado nada.";
  if(!m) throw new Error(bad);
  let bytes; try{ bytes = unb64u(m[2]); }catch(e){ throw new Error(bad); }
  if(m[1] === "1"){
    if(typeof DecompressionStream !== "function") throw new Error("Este navegador no puede leer ese código. Prueba con el archivo o con otro navegador.");
    try{ bytes = await pipe(bytes, DecompressionStream); }catch(e){ throw new Error(bad); }
  }
  try{ return new TextDecoder("utf-8", {fatal: true}).decode(bytes); }catch(e){ throw new Error(bad); }
}

/* ---------- archivo ---------- */
const fileName = () => `vocabulario-partida-${dayKey(new Date(now()))}.json`;
function download(name, text){
  const u = URL.createObjectURL(new Blob([text], {type: "application/json"}));
  const a = document.createElement("a"); a.href = u; a.download = name; a.rel = "noopener"; a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 30000);
}
/* archivo que el móvil sabe compartir (Chrome en Android no comparte .json: se prueba también .txt con el mismo contenido) */
function shareFile(text){
  try{
    if(!navigator.canShare || typeof File !== "function") return null;
    const n = fileName();
    for(const [name, type] of [[n, "application/json"], [n.replace(/\.json$/, ".txt"), "text/plain"]]){
      const f = new File([text], name, {type});
      if(navigator.canShare({files: [f]})) return f;
    }
  }catch(e){}
  return null;
}

/* ---------- protección de los datos ---------- */
let persisted = null;   /* true | false | null (no se sabe) */
function askPersist(){
  try{
    const S = navigator.storage; if(!S || !S.persisted) return;
    S.persisted().then(p => p || (S.persist ? S.persist() : false)).then(p => { persisted = !!p; paintSafe(); }).catch(() => {});
  }catch(e){}
}
const isIOS = () => { try{ const u = navigator.userAgent || ""; return /iPad|iPhone|iPod/.test(u) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }catch(e){ return false; } };
const standalone = () => { try{ return navigator.standalone === true || matchMedia("(display-mode: standalone)").matches; }catch(e){ return false; } };

/* ---------- fechas ---------- */
const fmtDate = t => { const d = new Date(t); return d.toLocaleDateString("es", {day: "numeric", month: "long", year: "numeric"}) + ", " + d.toLocaleTimeString("es", {hour: "2-digit", minute: "2-digit"}); };
const ago = t => { const d = Math.floor((new Date(now()).setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / DAY);
  return d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`; };

/* ---------- estilos ---------- */
const CSS = `
.sv{border-top:1px solid var(--line);margin:0 0 16px;padding:14px 0 4px;scroll-margin-top:120px}
.sv h2{margin:0 0 4px;font-size:1.1rem}
.sv .sub{margin:0 0 10px}
.sv-last{margin:0 0 10px;font-weight:600}
.sv-row{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}
.sv-b{min-height:46px;font:inherit;font-weight:600;padding:10px 16px;flex:1 1 180px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-align:center;color:var(--ink)}
.sv-b.pri{color:#fff}
.sv-file{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.sv textarea{width:100%;min-height:76px;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);font:.82rem/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:10px;word-break:break-all;resize:vertical}
.sv-lbl{display:block;font-weight:700;margin:6px 0 6px}
.sv-msg{margin:4px 0 10px;font-weight:600}
.sv-msg:empty{display:none}
.sv-msg.ok{color:var(--ok)}.sv-msg.bad{color:var(--bad)}
.sv-box{scroll-margin-top:120px;border:2px solid var(--brand);border-radius:14px;padding:14px;margin:0 0 12px;background:var(--soft)}
.sv-box h3{margin:0 0 8px;font-size:1.02rem}
.sv-cmp{width:100%;border-collapse:collapse;font-size:.93rem;margin:0 0 10px}
.sv-cmp th,.sv-cmp td{padding:7px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.sv-cmp th{color:var(--muted);font-weight:700;font-size:.82rem}
.sv-cmp td:nth-child(n+2){font-weight:700;white-space:nowrap}
.sv-cmp td:first-child{width:42%}
.sv-warn{border:1px solid #d9a21b;background:color-mix(in srgb,#f2c94c 16%,var(--card));color:var(--ink);border-radius:10px;padding:9px 12px;margin:0 0 10px;font-size:.92rem}
.sv-safe{margin:6px 0 8px;font-size:.92rem;color:var(--muted)}
.sv-undo{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px}
.sv-undo .sv-b{flex:1 1 220px}
.sv-x{background:none;border:0;color:var(--muted);text-decoration:underline;min-height:44px;padding:0 8px;font:inherit;font-size:.88rem;cursor:pointer}
.sv-cfg{margin:16px 0 0;padding-top:12px;border-top:1px solid var(--line)}
.sv-cfg a{display:flex;align-items:center;min-height:44px;color:var(--brand);font-weight:700;text-decoration:none}
.sv-rem{display:flex;gap:14px;align-items:flex-start;border:2px solid #1a9e94;background:color-mix(in srgb,#1a9e94 9%,var(--card))}
.sv-rem-e{font-size:2.4rem;line-height:1}
.sv-rem h2{margin:0 0 4px;font-size:1.12rem;color:var(--ink)}
.sv-rem p{margin:0 0 10px;color:var(--muted)}
.sv-rem .sv-row{margin:0;align-items:center}
.sv-rem .btn.lc{min-height:46px;display:inline-flex;align-items:center;text-decoration:none}
.sv-later{min-height:44px;background:none;border:0;color:var(--muted);font:inherit;font-weight:600;text-decoration:underline;cursor:pointer;padding:0 10px}
@media (max-width:420px){.sv-rem{flex-direction:column;gap:6px}.sv-b{flex-basis:100%}}
`;
function css(){ if(document.getElementById("css-save")) return; const s = document.createElement("style"); s.id = "css-save"; s.textContent = CSS; document.head.appendChild(s); }

/* ---------- bloque «💾 Copia de tu partida» (Para mayores) ---------- */
const $s = id => document.getElementById(id);
const flag = L => { const l = (typeof LANGS !== "undefined" && LANGS[L] && LANGS[L].label) || L; return l.split(" ")[0]; };
function lastHtml(){
  const t = metaGet(META.last, null);
  return t ? `Última copia: <b>${ago(t)}</b> (${esc(fmtDate(t))})` : "Todavía no has guardado ninguna copia en este aparato.";
}
function blockHtml(){
  const u = metaGet(META.undo, null);
  return `<section class="sv" id="sv-box" aria-labelledby="sv-h">
    <h2 id="sv-h">💾 Copia de tu partida</h2>
    <p class="sub">Para no perder el progreso si cambias de móvil o se borran los datos del navegador.</p>
    <p class="sv-last" id="sv-last">${lastHtml()}</p>
    <div class="sv-row">
      <button class="btn pri sv-b" id="sv-save" type="button">💾 Guardar partida</button>
      <button class="btn sv-b" id="sv-share" type="button" hidden>📤 Enviar archivo (WhatsApp, Drive…)</button>
      <button class="btn sv-b" id="sv-load" type="button">📂 Cargar partida</button>
      <input class="sv-file" type="file" id="sv-file" accept=".json,.txt,application/json,text/plain" tabindex="-1" aria-hidden="true">
    </div>
    <div class="sv-row"><button class="btn sv-b" id="sv-copy" type="button">📋 Copiar código</button></div>
    <div id="sv-out" hidden><label class="sv-lbl" for="sv-code" id="sv-out-l">Tu código:</label><textarea id="sv-code" readonly></textarea></div>
    <label class="sv-lbl" for="sv-in">Pegar código</label>
    <textarea id="sv-in" placeholder="Pega aquí el código que empieza por VOC1:" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
    <div class="sv-row" style="margin-top:8px"><button class="btn sv-b" id="sv-in-go" type="button">📥 Cargar código</button></div>
    <div class="sv-msg" id="sv-msg" role="status" aria-live="polite"></div>
    <div id="sv-confirm" hidden></div>
    ${u && isObj(u.keys) ? `<div class="sv-undo" id="sv-undo"><button class="btn sv-b" id="sv-undo-b" type="button">↩️ Deshacer: volver a la partida de antes</button>
      <small class="count">Copia automática del ${esc(fmtDate(Date.parse(u.saved) || now()))}</small>
      <button class="sv-x" id="sv-undo-x" type="button">Borrar esta copia</button></div>` : ""}
    <p class="sv-safe" id="sv-safe"></p>
    <p class="note" id="sv-ios" hidden></p>
  </section>`;
}
function paintSafe(){
  const el = $s("sv-safe"); if(!el) return;
  el.textContent = persisted === true ? "🔒 Datos protegidos: este navegador no los borrará para hacer sitio."
    : persisted === false ? "⚠️ Este navegador podría borrar los datos si se queda sin espacio. Guarda una copia de vez en cuando."
    : "ℹ️ No sabemos si este navegador protege los datos. Guarda una copia de vez en cuando.";
  const io = $s("sv-ios");
  if(io){ const show = isIOS() && !standalone(); io.hidden = !show;
    if(show) io.innerHTML = "📱 <b>En iPhone o iPad</b>, Safari borra los datos de las webs que no se abren en 7 días. Para evitarlo: guarda aquí la partida, añade la app con <b>Compartir › «Añadir a pantalla de inicio»</b>, ábrela desde ese icono y carga allí la partida (la app del icono tiene sus propios datos)."; }
}
const msg = (t, k) => { const m = $s("sv-msg"); if(m){ m.textContent = t; m.className = "sv-msg" + (k ? " " + k : ""); } };
function markSaved(){ metaSet(META.last, now()); const l = $s("sv-last"); if(l) l.innerHTML = lastHtml(); }

function confirmBox(p, mode){
  const box = $s("sv-confirm"); if(!box) return;
  const a = summary(collect()), b = summary(p.data.keys);
  const used = langs().filter(L => a.per[L].lessons || a.per[L].words || b.per[L].lessons || b.per[L].words);
  const by = (s, f) => used.length ? used.map(L => `${flag(L)} ${s.per[L][f]}`).join(" · ") : "0";
  const fewer = b.coins < a.coins || total(b, "lessons") < total(a, "lessons") || total(b, "words") < total(a, "words") || b.animals < a.animals;
  const undo = mode === "undo";
  box.innerHTML = `<div class="sv-box" role="group" aria-labelledby="sv-c-h">
    <h3 id="sv-c-h">${undo ? "↩️ ¿Volver a la partida de antes?" : "📂 ¿Cargar esta partida?"}</h3>
    <table class="sv-cmp"><thead><tr><th></th><th>Ahora en este aparato</th><th>${undo ? "Partida de antes" : "En la partida"}</th></tr></thead><tbody>
      <tr><td>📅 Guardada</td><td>—</td><td>${p.data.saved ? esc(fmtDate(p.data.saved)) : "—"}</td></tr>
      <tr><td>🪙 Monedas</td><td>${a.coins}</td><td>${b.coins}</td></tr>
      <tr><td>🐄 Animales de la granja</td><td>${a.animals}</td><td>${b.animals}</td></tr>
      <tr><td>🗺️ Lecciones del camino</td><td>${by(a, "lessons")}</td><td>${by(b, "lessons")}</td></tr>
      <tr><td>🔁 Palabras en repaso</td><td>${by(a, "words")}</td><td>${by(b, "words")}</td></tr>
    </tbody></table>
    ${fewer ? `<p class="sv-warn">⚠️ ${undo ? "La partida de antes" : "Esta partida"} tiene menos progreso en algo que lo que hay ahora.</p>` : ""}
    <p style="margin:0 0 10px"><b>Esto reemplazará la partida de este aparato.</b> ${undo ? "" : "Antes guardaremos una copia por si quieres deshacerlo."}</p>
    <div class="sv-row" style="margin:0"><button class="btn pri sv-b" id="sv-yes" type="button">${undo ? "↩️ Sí, volver a la de antes" : "✅ Sí, cargar esta partida"}</button><button class="btn sv-b" id="sv-no" type="button">Cancelar</button></div></div>`;
  box.hidden = false;
  $s("sv-no").onclick = () => { box.hidden = true; box.innerHTML = ""; msg("No se ha cambiado nada."); };
  $s("sv-yes").onclick = () => {
    $s("sv-yes").disabled = $s("sv-no").disabled = true;
    const err = apply(p.data.keys, mode);
    if(err){ msg(err, "bad"); box.hidden = true; box.innerHTML = ""; } else msg("Cargando la partida…", "ok");
  };
  try{ box.scrollIntoView({block: "nearest", behavior: "smooth"}); }catch(e){}
  $s("sv-yes").focus({preventScroll: true});
}
function offer(text, mode){
  const p = parse(text);
  const box = $s("sv-confirm"); if(box){ box.hidden = true; box.innerHTML = ""; }
  if(!p.ok){ msg(p.err, "bad"); return; }
  msg(p.ignored ? `(Se han ignorado ${p.ignored} datos que no son de esta app.)` : "");
  confirmBox(p, mode);
}

function wire(){
  const text = () => JSON.stringify(snapshot());
  $s("sv-save").onclick = () => { try{ download(fileName(), text()); markSaved(); msg(`✓ Guardado «${fileName()}». Mira en Descargas y guárdalo en un sitio seguro.`, "ok"); }catch(e){ console.error(e); msg("No se pudo guardar el archivo. Prueba con «Copiar código».", "bad"); } };
  const sh = $s("sv-share");
  if(shareFile("{}")){
    sh.hidden = false;
    sh.onclick = async () => {
      const f = shareFile(text());
      if(!f){ $s("sv-save").click(); return; }
      try{ await navigator.share({files: [f], title: "Partida de Vocabulario"}); markSaved(); msg("✓ Partida enviada.", "ok"); }
      catch(e){ if(e && e.name === "AbortError") return; download(fileName(), text()); markSaved(); msg(`✓ No se pudo enviar, así que se ha descargado «${fileName()}».`, "ok"); }
    };
  }
  const fi = $s("sv-file");
  $s("sv-load").onclick = () => { fi.value = ""; fi.click(); };
  fi.onchange = async () => {
    const f = fi.files && fi.files[0]; if(!f) return;
    if(f.size > MAX){ msg("Es demasiado grande para ser una partida de Vocabulario. No se ha cambiado nada.", "bad"); return; }
    if(!f.size){ msg("El archivo está vacío. No se ha cambiado nada.", "bad"); return; }
    let t; try{ t = await f.text(); }catch(e){ msg("No se pudo leer el archivo.", "bad"); return; }
    offer(t, "load"); fi.value = "";
  };
  $s("sv-copy").onclick = async () => {
    let code; try{ code = await encode(snapshot()); }catch(e){ console.error(e); msg("No se pudo crear el código.", "bad"); return; }
    const out = $s("sv-out"), ta = $s("sv-code");
    let ok = false;
    try{ if(navigator.clipboard && navigator.clipboard.writeText){ await navigator.clipboard.writeText(code); ok = true; } }catch(e){}
    ta.value = code; out.hidden = false;
    $s("sv-out-l").textContent = ok ? `Tu código (${code.length} letras):` : "Tu código: mantén pulsado (o Ctrl+C) para copiarlo";
    markSaved();
    if(ok) msg(`✓ Código copiado (${code.length} letras). Pégalo en un mensaje o una nota para guardarlo.`, "ok");
    else { msg("El navegador no deja copiar solo: copia el código del cuadro a mano.", "bad"); ta.focus(); ta.select(); }
  };
  $s("sv-in-go").onclick = async () => {
    let t; try{ t = await decode($s("sv-in").value); }catch(e){ msg(e.message, "bad"); return; }
    offer(t, "load");
  };
  const ub = $s("sv-undo-b");
  if(ub) ub.onclick = () => { const u = metaGet(META.undo, null); offer(u ? JSON.stringify({app: APP, v: VER, saved: u.saved, keys: u.keys}) : "", "undo"); };
  const ux = $s("sv-undo-x");
  if(ux) ux.onclick = () => { metaDel(META.undo); const d = $s("sv-undo"); if(d) d.remove(); msg("Copia borrada."); };
  paintSafe();
}
/* pone el bloque en «Para mayores» de la página de premios */
function mountBlock(){
  const det = document.querySelector("details.adult"); if(!det || $s("sv-box")) return;
  css();
  const sum = det.querySelector("summary");
  if(sum && !/copia/.test(sum.textContent)) sum.textContent = "👨‍👩‍👦 Para mayores: copia de la partida, detalle por documento e instalación";
  const ad = det.querySelector("#adult");
  const w = document.createElement("div"); w.innerHTML = blockHtml();
  det.insertBefore(w.firstElementChild, ad || null);
  wire();
}
/* ir a los controles (desde el aviso de la portada o desde ⚙️) */
let goAdult = false;
function openAdult(){
  const det = document.querySelector("details.adult"), box = $s("sv-box"); if(!det || !box) return;
  if(!det.open) det.open = true;
  setTimeout(() => { try{ box.scrollIntoView({block: "start", behavior: "smooth"}); }catch(e){ box.scrollIntoView(); } $s("sv-save").focus({preventScroll: true}); }, 80);
}
function go(){
  goAdult = true;
  if(/^#\/?progreso/.test(location.hash)){ goAdult = false; openAdult(); }
  else location.hash = "#/progreso";
}
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest("[data-sv-go]"); if(!a) return;
  e.preventDefault();
  const d = a.closest("dialog"); if(d && d.open) d.close();
  go();
});

/* ⚙️: enlace a la copia de la partida al final del panel */
function cfgLink(){
  const d = $s("cfg"); if(!d || !d.firstElementChild || $s("sv-cfg")) return;
  css();
  const p = document.createElement("p"); p.className = "sv-cfg";
  p.innerHTML = `<a href="#/progreso" id="sv-cfg" data-sv-go>💾 Copia de la partida (para mayores) →</a>`;
  d.appendChild(p);
}
try{ const d = $s("cfg"); if(d && typeof MutationObserver === "function") new MutationObserver(cfgLink).observe(d, {childList: true}); }catch(e){}

/* ---------- aviso semanal en la portada ---------- */
let shownVisit = false;   /* como mucho una vez por visita (carga de la página) */
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
function due(){
  const t = now(), sn = metaGet(META.snooze, 0);
  if(typeof sn === "number" && t < sn) return false;
  if(!progress()) return false;
  const last = metaGet(META.last, null);
  if(typeof last === "number" && isFinite(last)) return t - last >= 7 * DAY;
  return t - firstSeen() >= 3 * DAY;
}
HOME_SLOTS.push(async () => {
  if(shownVisit || !due()) return "";
  shownVisit = true; css();
  return `<section class="panel sv-rem" id="sv-rem" aria-label="Guardar la partida">
    <div class="sv-rem-e" aria-hidden="true">💾</div>
    <div><h2>Pídele a un mayor que guarde tu partida</h2>
      <p>Así nunca pierdes tus monedas, tu granja ni tus lecciones.</p>
      <div class="sv-row"><a class="btn lc" href="#/progreso" data-sv-go style="--lc:#1f5fbf">👨 ¡Avisar a un mayor!</a><button class="sv-later" id="sv-later" type="button">Ahora no</button></div></div>
  </section>`;
});
document.addEventListener("click", e => {
  if(!e.target.closest || !e.target.closest("#sv-later")) return;
  metaSet(META.snooze, now() + 2 * DAY);
  const r = $s("sv-rem"); if(r) r.remove();
});

/* ---------- arranque y rutas ---------- */
bus.on("boot", () => {
  firstSeen(); askPersist();
  let f = null; try{ f = sessionStorage.getItem(FLASH); sessionStorage.removeItem(FLASH); }catch(e){}
  if(f) setTimeout(() => { try{ toast(f); }catch(e){} }, 400);
});
bus.on("route", d => {
  if(!String((d && d.h) || "").startsWith("progreso")){ return; }
  mountBlock();
  if(goAdult){ goAdult = false; openAdult(); }
});

/* para pruebas y para los mayores curiosos */
window.vocabSave = Object.freeze({typeOf, collect, snapshot, parse, summary, encode, decode, due, firstSeen,
  inventory: {exact: Object.keys(EXACT), perLang: Object.keys(PER_LANG), pr: "pr:<docId>:<lang>", deviceOnly: DEVICE_ONLY, meta: Object.values(META)},
  get persisted(){ return persisted; }});
})();
