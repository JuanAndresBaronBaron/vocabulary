/* Módulo tech (window.vocabTech, el núcleo de Tech Prep; S1-SPEC §4-§8, §10.1, §10.9 y §11). Lo carga js/tech-boot.js la
   primera vez que se entra en Tech Prep (antes que js/tech-lesson.js y js/tech-pages.js) y añade a window.vocabTech:
   · Datos (data/tech/index.json y data/tech/uNN.json, pedidos la primera vez y guardados por sw.js en vocab-media):
     index() · unit(id) · units() (las disponibles, cargadas) · item(itemId) → {item, lesson, unit} · lessonOf(id) ·
     blockList() · blockOf(id) · pathUnits() · unitsOf(blockId) (vocabTech.blocks(hp) es la guarda de rutas de tech-boot.js).
   · Estado (localStorage "tech:data" = {v:1, dev, erased?, recs:{"<kind>/<id>": {…, at}}}; fuera del inventario de
     js/save.js): get/put/del/list, merge(a, b) (por registro: gana el at más nuevo; empate, el de aquí; act, el n mayor;
     borrar = lápida {del:true, at} que dura 90 días; erased = «todo lo de antes de esta hora se borró»).
   · Google (su propio archivo, "vocabulary-techprep.json", con vocabSync.file de js/sync.js): al entrar, ~20 s después de
     un cambio, al esconder y al volver; nunca pide permiso ni enseña nada al niño. sync.now() · sync.status().
   · Repaso (§8): srs.grade · srs.gradeExplain · srs.queue · srs.dueCount · srs.get; fecha de la entrevista (interview).
   · Progreso y premios (§11): progress.lessonDone/unitStatus/nextLesson · act.log/streak/week · readiness · medals.
   · Voz inglesa (speak/stopSpeak, nunca say() ni los mp3 del niño) · el modo foco (focus.register y ROUTES.techl) ·
     los componentes compartidos (CSS "css-tech", clases tp-…, y ui.*) · Today (#/tech) y sus ajustes (openSettings).
   Nunca llama a award(), logAct(), srsGrade(), srsAdd() ni checkAch(), no escribe claves de la partida del niño y no
   emite coins, lesson-done, review-done, game-done, medal, gift-open ni answer. */
(() => {
"use strict";
const W = window, D = document, ROOT = D.documentElement;
const T = W.vocabTech; if(!T) return;
const DATA = "tech:data", SYNC = "tech:sync", UI = "tech:ui", LSKEY = "tech:ls", LSDRAFT = "tech:lsdraft";
const FILE = "vocabulary-techprep.json", APP = "vocabulary-techprep";
const TIV = [0, 1, 3, 7, 14, 30, 60];
const DAY = 864e5, KEEP_DEL = 90 * DAY, MOCK_MAX = 20, EXPLAIN_MAX = 5, QUEUE_N = 20, ACT_DAY = 10;
const REVIEWABLE = t => !!t && t !== "say" && t !== "story";
const now = () => Date.now();
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const $ = s => D.querySelector(s);
const tday = () => { try{ return today(); }catch(e){ const d = new Date(); return Math.floor((d - d.getTimezoneOffset() * 6e4) / DAY); } };
/* el número de día de today() ↔ "YYYY-MM-DD" (la fecha de este aparato) */
const dayStr = n => new Date(n * DAY).toISOString().slice(0, 10);
const strDay = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "")); if(!m) return null; const t = Date.UTC(+m[1], +m[2] - 1, +m[3]); return isFinite(t) && dayStr(Math.round(t / DAY)) === m[0] ? Math.round(t / DAY) : null; };
const haptic = k => { try{ if(W.G && typeof G.haptic === "function") G.haptic(k); }catch(e){} };
const toastT = (t, icon) => { try{ if(W.M && typeof M.toast === "function") M.toast(t, icon ? {icon} : {}); }catch(e){} };
const emit = (e, d) => { try{ bus.emit(e, d); }catch(err){ console.error(err); } };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function cyrb53(str){
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for(let i = 0; i < str.length; i++){ const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}
const h32 = s => parseInt(cyrb53(String(s)).slice(8), 16) >>> 0;
/* JSON con las claves ordenadas (la misma huella en todos los aparatos) */
function canon(v){
  if(Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if(isObj(v)) return `{${Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",")}}`;
  return JSON.stringify(v === undefined ? null : v);
}
function uiGet(){ try{ const o = JSON.parse(localStorage.getItem(UI)); return isObj(o) ? o : {}; }catch(e){ return {}; } }
function uiSet(p){ const o = Object.assign(uiGet(), p); try{ localStorage.setItem(UI, JSON.stringify(o)); }catch(e){} return o; }

/* ---------- datos ---------- */
let IDX = null, pIdx = null;
const UNITS = {}, pUnit = {}, ITEMS = {}, LESSONS = {};
async function getJSON(url){
  let r;
  try{ r = await fetch(url); }catch(e){ throw new Error("Couldn't load Tech Prep. Check the connection and try again."); }
  if(!r.ok) throw new Error(`Couldn't load Tech Prep (${r.status}).`);
  return r.json();
}
function index(){
  if(IDX) return Promise.resolve(IDX);
  if(!pIdx) pIdx = getJSON("data/tech/index.json").then(d => {
    if(!d || d.format !== 1 || !Array.isArray(d.units) || !Array.isArray(d.blocks)) throw new Error("Tech Prep data is damaged.");
    IDX = d; return d;
  }).catch(e => { pIdx = null; throw e; });
  return pIdx;
}
function unit(id){
  if(!/^u\d{2}$/.test(String(id))) return Promise.reject(new Error(`No unit ${id}.`));
  if(UNITS[id]) return Promise.resolve(UNITS[id]);
  if(!pUnit[id]) pUnit[id] = getJSON(`data/tech/${id}.json`).then(u => {
    if(!u || u.format !== 1 || u.id !== id || !Array.isArray(u.lessons)) throw new Error("Tech Prep data is damaged.");
    UNITS[id] = u;
    for(const l of u.lessons){ LESSONS[l.id] = {lesson: l, unit: u}; for(const it of l.items || []) ITEMS[it.id] = {item: it, lesson: l, unit: u}; }
    return u;
  }).catch(e => { delete pUnit[id]; throw e; });
  return pUnit[id];
}
/* las unidades disponibles, en el orden del camino (por número) y ya cargadas */
const avail = () => IDX ? IDX.units.filter(u => u.available).sort((a, b) => a.n - b.n) : [];
function units(){ return index().then(ix => Promise.all(avail().map(u => unit(u.id)))); }
const item = id => ITEMS[id] || null;
const lessonOf = id => LESSONS[id] || null;
const blockList = () => IDX ? IDX.blocks.slice() : [];
const pathUnits = () => IDX ? IDX.units.slice().sort((a, b) => a.n - b.n) : [];
const blockOf = id => (IDX && IDX.blocks.find(b => b.id === id)) || null;
/* las unidades disponibles (cargadas) de un bloque */
const unitsOf = bid => avail().filter(u => u.block === bid).map(u => UNITS[u.id]).filter(Boolean);
const lessonIds = uid => UNITS[uid] ? UNITS[uid].lessons.map(l => l.id) : [1, 2, 3].map(i => `${uid}-l${i}`);

/* ---------- estado: tech:data ---------- */
let DB = null, lastAt = 0;
const newDev = () => "d" + Math.random().toString(36).slice(2, 10) + now().toString(36);
function norm(o){
  const out = {v: 1, dev: isObj(o) && typeof o.dev === "string" && o.dev ? o.dev : newDev(), recs: {}};
  if(isObj(o) && +o.erased > 0) out.erased = +o.erased;
  if(isObj(o) && isObj(o.recs)) for(const k in o.recs){ const r = o.recs[k]; if(isObj(r) && typeof r.at === "number" && /^[a-z]+\/./.test(k)) out.recs[k] = r; }
  return out;
}
function db(){
  if(DB) return DB;
  let o = null; try{ o = JSON.parse(localStorage.getItem(DATA)); }catch(e){}
  DB = norm(o);
  return DB;
}
function save(){ try{ localStorage.setItem(DATA, JSON.stringify(DB)); }catch(e){ console.warn("[tech] no se pudo guardar", e && e.message); } }
const stamp = () => { const t = Math.max(now(), lastAt + 1); lastAt = t; return t; };
const K = (kind, id) => {
  if(!/^[a-z]{2,12}$/.test(String(kind)) || id == null || String(id) === "") throw new Error(`vocabTech: bad record ${kind}/${id}`);
  return `${kind}/${id}`;
};
let chT = 0, chKinds = new Set();
function changed(kind){
  chKinds.add(kind);
  if(!chT) chT = setTimeout(() => { chT = 0; const k = [...chKinds]; chKinds = new Set(); emit("tech-data", {kinds: k}); paintBadge(); }, 0);
  syncSoon();
}
function prune(d){
  const lim = now() - KEEP_DEL;
  for(const k in d.recs){ const r = d.recs[k]; if(r.del && r.at < lim) delete d.recs[k]; }
  /* las entrevistas de práctica: las 20 últimas (las demás, lápida) */
  const mocks = Object.keys(d.recs).filter(k => k.startsWith("mock/") && !d.recs[k].del);
  if(mocks.length > MOCK_MAX){
    mocks.sort((a, b) => (+d.recs[a].when || d.recs[a].at) - (+d.recs[b].when || d.recs[b].at));
    for(const k of mocks.slice(0, mocks.length - MOCK_MAX)) d.recs[k] = {del: true, at: stamp()};
  }
}
function get(kind, id){ const r = db().recs[K(kind, id)]; return r && !r.del ? Object.assign({}, r) : null; }
function putRaw(kind, id, obj){
  const r = Object.assign({}, isObj(obj) ? obj : {}, {at: stamp()}); delete r.del;
  db().recs[K(kind, id)] = r;
  return r;
}
function put(kind, id, obj){
  const r = putRaw(kind, id, obj);
  prune(db()); save(); changed(kind);
  return Object.assign({}, r);
}
function del(kind, id){
  const k = K(kind, id), d = db();
  if(!d.recs[k] || d.recs[k].del) return false;
  d.recs[k] = {del: true, at: stamp()};
  save(); changed(kind);
  return true;
}
/* los registros vivos de un tipo, el más nuevo primero: [{id, …campos, at}] */
function list(kind){
  const p = kind + "/", d = db(), out = [];
  for(const k in d.recs) if(k.startsWith(p) && !d.recs[k].del) out.push(Object.assign({id: k.slice(p.length)}, d.recs[k]));
  return out.sort((a, b) => b.at - a.at);
}
/* mezcla de dos copias (§5): gana el at más nuevo (empate: la de aquí, a); act se queda con el n mayor; nada de antes de
   un «Erase» (erased) sobrevive; las lápidas de más de 90 días se olvidan. Pura: no toca a ni b. */
function merge(a, b){
  a = norm(a); b = norm(b);
  const out = {v: 1, dev: a.dev, recs: {}}, E = Math.max(a.erased || 0, b.erased || 0), lim = now() - KEEP_DEL;
  if(E) out.erased = E;
  for(const k of new Set([...Object.keys(a.recs), ...Object.keys(b.recs)])){
    const x = a.recs[k], y = b.recs[k];
    let r;
    if(!y) r = x; else if(!x) r = y;
    else if(k.startsWith("act/") && !x.del && !y.del && (+x.n || 0) !== (+y.n || 0)) r = (+x.n || 0) > (+y.n || 0) ? x : y;
    else r = y.at > x.at ? y : x;
    if(!r || (E && r.at <= E) || (r.del && r.at < lim)) continue;
    out.recs[k] = Object.assign({}, r);
  }
  return out;
}
const hashData = d => cyrb53(canon({erased: d.erased || 0, recs: d.recs}));
addEventListener("storage", e => { if(e.key === DATA || e.key === null){ DB = null; changed("*"); } });

/* ---------- Google: el archivo de Tech Prep ---------- */
function syncGet(){ try{ const o = JSON.parse(localStorage.getItem(SYNC)); return isObj(o) ? o : {}; }catch(e){ return {}; } }
function syncSet(p){ const o = Object.assign(syncGet(), p); try{ localStorage.setItem(SYNC, JSON.stringify(o)); }catch(e){} return o; }
const vs = () => { const S = W.vocabSync; return S && typeof S.file === "function" && typeof S.connected === "function" ? S : null; };
const dirty = () => hashData(db()) !== syncGet().lastHash;
let syncP = null, again = false, syncT = 0;
function syncSoon(ms = 20000){ clearTimeout(syncT); syncT = setTimeout(() => { syncT = 0; sync("change"); }, ms); }
function sync(why){
  const S = vs();
  if(!S || !S.connected() || navigator.onLine === false || !S.tokOk()){ paintSync(); return Promise.resolve(false); }
  if(syncP){ again = true; return syncP; }
  syncP = (async () => {
    const F = S.file(FILE), st = syncGet();
    try{
      let id = st.fileId || null, m = null;
      if(id){ try{ m = await F.meta(id); }catch(e){ if(e && e.code === "gone"){ id = null; m = null; } else throw e; } }
      if(!id){ m = await F.find(); id = m ? m.id : null; }
      const rh = m && m.appProperties && m.appProperties.hash || "";
      if(m && rh !== st.lastHash){
        const body = await F.download(id);
        if(body && body.app === APP && isObj(body.data)){
          const cur = db(), mg = merge(cur, body.data);   /* sin esperas entre leer y escribir: no se pierde nada de lo de aquí */
          if(canon(mg) !== canon(cur)){ DB = mg; save(); changed("*"); }
        }
      }
      const data = db(), h = hashData(data);
      if(!m || h !== rh){
        const r = await F.upload(id, {app: APP, v: 1, saved: new Date(now()).toISOString(), data}, {hash: h}, {keepalive: why === "hide"});
        id = r && r.id || id;
      }
      syncSet({fileId: id, lastHash: h, lastSync: now(), err: ""});
      return true;
    }catch(e){ syncSet({err: e && e.code || "net", errAt: now()}); return false; }
  })().finally(() => { syncP = null; paintSync(); if(again){ again = false; syncSoon(1500); } });
  return syncP;
}
D.addEventListener("visibilitychange", () => {
  if(D.visibilityState === "hidden"){ if(dirty()){ clearTimeout(syncT); sync("hide"); } }
  else if(ROOT.hasAttribute("data-tech")) sync("visible");
});
addEventListener("online", () => { if(dirty()) syncSoon(1500); });
/* lo que queda por subir, de vez en cuando mientras se está dentro (el permiso puede llegar con un toque) */
setInterval(() => { if(ROOT.hasAttribute("data-tech") && D.visibilityState !== "hidden" && dirty() && !syncT) sync("poll"); }, 60e3);
function ago(ms){
  const m = Math.max(0, Math.round((now() - ms) / 6e4));
  if(m < 1) return "just now";
  if(m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if(h < 24) return h === 1 ? "1 hour ago" : `${h} hours ago`;
  const d = Math.round(h / 24); return d === 1 ? "yesterday" : `${d} days ago`;
}
/* la línea de «Google copy» (§7) */
function syncStatus(){
  const S = vs(), st = syncGet();
  if(!S || !S.connected()) return {state: "off", icon: "cloud-slash", text: "Not connected · connect Google in Ajustes › Para mayores to keep a copy"};
  if(st.lastSync && !dirty() && !st.err) return {state: "ok", icon: "cloud-check", text: `Saved to Google · ${ago(st.lastSync)}`};
  return {state: "wait", icon: "cloud", text: "Waiting for Google · changes are safe on this device"};
}
function paintSync(){
  const el = D.getElementById("tp-set-g"); if(!el) return;
  const s = syncStatus();
  el.innerHTML = `${ico(s.icon, "bold", 18)}<span>${esc(s.text)}</span>`;
  el.dataset.state = s.state;
}
/* «Erase Tech Prep progress»: todo a cero aquí y, con Google, el archivo vacío (con la hora: en los otros aparatos se
   borra también lo de antes) */
async function erase(){
  DB = {v: 1, dev: db().dev, erased: stamp(), recs: {}}; save();
  try{ sessionStorage.removeItem(LSKEY); localStorage.removeItem(LSDRAFT); }catch(e){}
  QUEUED.clear(); changed("*"); clearTimeout(syncT); syncT = 0;
  const S = vs();
  if(!S || !S.connected()) return "local";
  try{
    if(navigator.onLine === false || !S.tokOk()) throw new Error("wait");
    const F = S.file(FILE), st = syncGet();
    let id = st.fileId || null;
    if(!id){ const f = await F.find(); id = f ? f.id : null; }
    const h = hashData(DB), r = await F.upload(id, {app: APP, v: 1, saved: new Date(now()).toISOString(), data: DB}, {hash: h});
    syncSet({fileId: r && r.id || id, lastHash: h, lastSync: now(), err: ""});
    return "google";
  }catch(e){ syncSoon(3000); return "wait"; }
}

/* ---------- repaso (§8) ---------- */
const QUEUED = new Set();   /* lo que ha salido hoy en una cola de repaso: calificarlo cuenta como repaso */
const box = b => Math.max(0, Math.min(TIV.length - 1, Math.round(+b) || 0));
function iDay(){ const d = interviewDate(); return d ? strDay(d) : null; }
/* con fecha de entrevista: nada vence después del día de antes; lo que caería después se trae a los 7 días anteriores,
   repartido (por el id: siempre el mismo día para la misma tarjeta) */
function compress(due, id, t = tday()){
  const I = iDay(); if(I == null) return due;
  const L = I - 1; if(L <= t || due <= L) return due;
  const start = Math.max(t + 1, I - 7), span = L - start + 1;
  return start + h32(id) % span;
}
function typeOf(id, old){ const x = item(id); return x && x.item ? x.item.type : old && old.t || ""; }
function setSrs(id, b, ivd, g, o, old){
  const t = tday(), type = o.type || typeOf(id, old);
  const review = !!old && (QUEUED.has(id) || !!o.review);
  const rec = {b, due: compress(t + ivd, id, t), n: (old ? +old.n || 0 : 0) + 1, g, d: t, iv: ivd, t: type};
  if(review) rec.r = t; else if(old && old.r) rec.r = old.r;
  const out = put("srs", id, rec);
  if(review) actAdd(1);
  return out;
}
/* g: 2 a la primera · 1 con pista o al segundo intento · 0 mal. o: {review: true} si es un repaso (lo que da queue() ya
   cuenta solo), {type} si el ítem no está cargado */
function grade(id, g, o = {}){
  g = g === 2 ? 2 : g === 1 ? 1 : 0;
  const old = get("srs", id), type = o.type || typeOf(id, old);
  if(type && !REVIEWABLE(type)) return null;   /* say y story no entran en el repaso */
  let b = old ? box(old.b) : 0, ivd;
  if(g === 2){ b = Math.min(TIV.length - 1, b + 1); ivd = TIV[b]; }
  else if(g === 1) ivd = Math.max(1, Math.round(TIV[b] / 2));
  else { b = 0; ivd = 1; }
  return setSrs(id, b, ivd, g, Object.assign({}, o, {type}), old);
}
function gradeExplain(id, v, o = {}){
  const old = get("srs", id), opt = Object.assign({}, o, {type: "explain"});
  if(v === "nailed") return grade(id, 2, opt);
  if(v === "partly") return setSrs(id, old ? box(old.b) : 0, 2, 1, opt, old);
  return setSrs(id, 0, 1, 0, opt, old);
}
function srsGet(id){ const r = get("srs", id); return r ? {b: r.b, due: r.due, n: r.n, g: r.g, t: r.t || "", d: r.d} : null; }
/* las fichas que tocan hoy: atrasadas primero (la más antigua), luego las de la unidad estudiada más recientemente,
   mezclando tipos; como mucho 5 «Explain it» al día */
function order(){
  const t = tday(), d = db(), due = [], seen = {};
  let ex = 0;
  for(const k in d.recs){
    if(!k.startsWith("srs/")) continue;
    const r = d.recs[k]; if(r.del) continue;
    const id = k.slice(4);
    if(r.t === "explain" && r.r === t) ex++;
    if(typeof r.due === "number" && r.due <= t) due.push({id, due: r.due, t: r.t || "", u: id.slice(0, 3)});
  }
  for(const k in d.recs){
    const r = d.recs[k]; if(r.del) continue;
    const m = /^(?:srs|ls)\/(u\d{2})/.exec(k); if(m) seen[m[1]] = Math.max(seen[m[1]] || 0, r.at);
  }
  const over = due.filter(x => x.due < t).sort((a, b) => a.due - b.due || (a.id < b.id ? -1 : 1));
  const td = due.filter(x => x.due === t).sort((a, b) => (seen[b.u] || 0) - (seen[a.u] || 0) || (a.id < b.id ? -1 : 1));
  const mixed = [];
  while(td.length){
    const prev = mixed.length ? mixed[mixed.length - 1].t : null;
    let j = td.findIndex(x => x.t !== prev && x.u === td[0].u);
    if(j < 0) j = 0;
    mixed.push(td.splice(j, 1)[0]);
  }
  const out = [];
  for(const x of over.concat(mixed)){
    if(x.t === "explain"){ if(ex >= EXPLAIN_MAX) continue; ex++; }
    out.push(x.id);
  }
  return out;
}
function queue(o = {}){
  const lim = o.limit == null ? QUEUE_N : Math.max(0, +o.limit || 0);
  const q = order().slice(0, lim);
  q.forEach(id => QUEUED.add(id));
  return q;
}
const dueCount = () => order().length;
/* fecha de la entrevista (set/interview) */
function interviewDate(){ const r = get("set", "interview"); return r && typeof r.date === "string" && strDay(r.date) != null ? r.date : null; }
function setInterview(v){
  let s = null;
  if(v instanceof Date && !isNaN(v)) s = dayStr(Math.floor((v - v.getTimezoneOffset() * 6e4) / DAY));
  else if(typeof v === "string" && strDay(v) != null) s = v;
  put("set", "interview", {date: s});
  /* lo de antes se vuelve a planear: el día natural (último repaso + intervalo) y, con fecha, apretado */
  const d = db(), t = tday(); let n = 0;
  for(const k in d.recs){
    if(!k.startsWith("srs/")) continue;
    const r = d.recs[k]; if(r.del || typeof r.d !== "number" || typeof r.iv !== "number") continue;
    const nat = r.d + r.iv, due = compress(nat, k.slice(4), t);
    if(due !== r.due){ d.recs[k] = Object.assign({}, r, {due, at: stamp()}); n++; }
  }
  if(n){ save(); changed("srs"); }
  return s;
}
const daysLeft = () => { const I = iDay(); return I == null ? null : I - tday(); };

/* ---------- progreso, racha y premios (§11) ---------- */
function actAdd(n){
  const k = dayStr(tday()), old = get("act", k);
  return put("act", k, {n: (old ? +old.n || 0 : 0) + Math.max(0, +n || 0)});
}
const activeDay = n => { const r = get("act", dayStr(n)); return !!r && (+r.n || 0) >= ACT_DAY; };
function streak(){
  let t = tday(); if(!activeDay(t)) t--;
  let n = 0; while(n < 3660 && activeDay(t - n)) n++;
  return n;
}
/* lunes a domingo de esta semana */
function week(){ const t = tday(), start = t - (new Date(t * DAY).getUTCDay() + 6) % 7; return [0, 1, 2, 3, 4, 5, 6].map(i => activeDay(start + i)); }
function unitStatus(uid){
  const ids = lessonIds(uid), u = UNITS[uid], best = {};
  const lessons = ids.map((id, i) => {
    const r = get("ls", id), l = u && u.lessons[i];
    if(r) best[id] = +r.best || 0;
    return {id, n: i + 1, title: l ? l.title : "", kind: l ? l.kind : "", done: !!r, best: r ? +r.best || 0 : null, total: r ? +r.total || 0 : l ? l.items.length : null};
  });
  return {done: lessons.filter(l => l.done).length, total: ids.length, best, lessons};
}
/* la primera lección sin hacer del camino (por número de unidad); null si ya están todas */
function nextLesson(){
  for(const iu of avail()){
    const ids = lessonIds(iu.id);
    for(let i = 0; i < ids.length; i++) if(!get("ls", ids[i])){
      const u = UNITS[iu.id] || iu;
      return {unit: u, lesson: u.lessons ? u.lessons[i] : {id: ids[i]}, i: i + 1, of: ids.length};
    }
  }
  return null;
}
function medalInfo(b){
  const iu = IDX ? IDX.units.filter(u => u.block === b.id) : [], av = iu.filter(u => u.available);
  let total = 0, done = 0;
  for(const u of av) for(const id of lessonIds(u.id)){ total++; if(get("ls", id)) done++; }
  const r = get("medal", b.id), full = av.length > 0 && av.length === iu.length;
  const sub = r ? "Medal earned" : full ? `${done} of ${total} lessons` : `${done} of ${total} lessons so far`;
  return {id: b.id, title: b.title, sub, note: full ? "" : "More units coming soon", got: !!r, at: r ? r.at : null, done, total, complete: full};
}
/* una medalla por bloque, para los bloques con algo disponible */
function medals(){ return IDX ? IDX.blocks.filter(b => IDX.units.some(u => u.block === b.id && u.available)).map(medalInfo) : []; }
function checkMedals(){
  const got = [];
  for(const m of medals()){
    if(m.got || !m.complete || !m.total || m.done < m.total) continue;
    put("medal", m.id, {});
    got.push(Object.assign({}, m, {got: true, sub: "Medal earned", at: now()}));
  }
  if(got.length){
    haptic("success");
    got.forEach(m => toastT(`Medal earned: ${m.title}!`, ico("medal", "fill", 22)));
  }
  return got;
}
function lessonDone(lessonId, o = {}){
  const score = Math.max(0, Math.round(+o.score || 0)), total = Math.max(0, Math.round(+o.total || 0));
  const old = get("ls", lessonId);
  put("ls", lessonId, {best: Math.max(old ? +old.best || 0 : 0, score), total: total || (old && +old.total) || 0, done: old && old.done ? old.done : now()});
  actAdd(ACT_DAY);
  return {newMedals: checkMedals(), first: !old};
}
/* «Interview ready» (0-100) de un bloque o de una unidad: 40 % lecciones hechas, 30 % fichas repasables al día y en caja
   ≥ 2, 30 % «Explain it» con «Nailed it» la última vez */
function readyOf(us){
  const t = tday(); let L = 0, Ld = 0, R = 0, Rok = 0, E = 0, Eok = 0;
  for(const u of us) for(const l of u.lessons){
    L++; if(get("ls", l.id)) Ld++;
    for(const it of l.items || []){
      if(!REVIEWABLE(it.type)) continue;
      const s = get("srs", it.id);
      R++; if(s && s.due >= t && s.b >= 2) Rok++;
      if(it.type === "explain"){ E++; if(s && s.g === 2) Eok++; }
    }
  }
  return Math.round(40 * (L ? Ld / L : 0) + 30 * (R ? Rok / R : 0) + 30 * (E ? Eok / E : 0));
}
const readiness = bid => readyOf(unitsOf(bid));
const unitReadiness = uid => UNITS[uid] ? readyOf([UNITS[uid]]) : 0;
/* en qué centrarse antes de la entrevista: el bloque con menos «Interview ready» y, dentro, su unidad más floja */
function focusArea(){
  const bs = medals().map(m => ({b: blockOf(m.id), r: readiness(m.id)})).filter(x => x.b);
  if(!bs.length) return null;
  bs.sort((a, z) => a.r - z.r);
  const us = unitsOf(bs[0].b.id).map(u => ({u, r: unitReadiness(u.id)})).sort((a, z) => a.r - z.r || a.u.n - z.u.n);
  return {block: bs[0].b, unit: us.length ? us[0].u : null, ready: bs[0].r};
}

/* ---------- voz inglesa ---------- */
let SPK = 0;
const rate = () => { const r = +uiGet().rate; return r >= .5 && r <= 1.5 ? r : 1; };
/* en trozos de frases (Chrome corta las frases muy largas) */
function chunks(s){
  const out = []; let cur = "";
  for(const p of s.match(/[^.!?;:]+[.!?;:]*\s*/g) || [s]){
    if(cur && (cur + p).length > 220){ out.push(cur.trim()); cur = ""; }
    cur += p;
  }
  if(cur.trim()) out.push(cur.trim());
  return out;
}
let noTts = false;
function speak(text, btn, o = {}){
  stopSpeak();
  const tok = ++SPK, s = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
  if(!s) return Promise.resolve(false);
  if(!("speechSynthesis" in W)){ if(!noTts){ noTts = true; toastT("This browser can't speak. You can read the text instead."); } return Promise.resolve(false); }
  if(btn && btn.classList) btn.classList.add("playing");
  const parts = chunks(s), r = o.slow ? Math.max(.5, rate() * .7) : rate();
  return new Promise(res => {
    let i = 0, fin = false;
    const done = ok => { if(fin) return; fin = true; if(btn && btn.classList && tok === SPK) btn.classList.remove("playing"); res(ok); };
    const next = () => {
      if(tok !== SPK) return done(false);
      if(i >= parts.length) return done(true);
      const u = new SpeechSynthesisUtterance(parts[i++]);
      try{ useVoice(u, "english"); }catch(e){ u.lang = "en-GB"; }
      u.rate = r;
      u.onend = next;
      u.onerror = e => { if(e && (e.error === "interrupted" || e.error === "canceled")) return done(false); if(!retryLocal(u, e, next)) next(); };
      try{ speechSynthesis.speak(u); }catch(e){ done(false); }
    };
    next();
  });
}
function stopSpeak(){
  SPK++;
  D.querySelectorAll(".tp-say.playing, [data-say].playing").forEach(b => b.classList.remove("playing"));
  try{ if("speechSynthesis" in W) speechSynthesis.cancel(); }catch(e){}
}

/* ---------- componentes compartidos (ui.*) ---------- */
const ui = {
  esc: s => esc(s),
  icon: (n, st = "bold", sz = 20, cls = "") => ico(n, st, sz, cls),
  /* altavoz (y tortuga, despacio): data-say → say() de index.html → speak() en Tech Prep */
  say(text, o = {}){
    if(!text) return "";
    const t = esc(text), l = o.label || "Listen";
    return `<span class="tp-says"><button type="button" class="tp-say" data-say="${t}" aria-label="${esc(l)}" title="${esc(l)}">${ico("speaker-high", "bold", 22)}</button>${o.slow === false ? "" :
      `<button type="button" class="tp-say" data-say="${t}" data-slow aria-label="${esc(l)} slowly" title="${esc(l)} slowly">${ico("turtle", "bold", 22)}</button>`}</span>`;
  },
  /* la IPA siempre se ve en Tech Prep (el interruptor «Mostrar pronunciación» de Para mayores es del niño): el mismo
     marcado que ipaHtml() de index.html (con los «word joiner» para no partir la barra ni antes del acento) */
  ipa(ipa){
    if(!ipa) return "";
    const t = esc(ipa).replace(/(\S)(?=[ˈˌ])/g, "$1⁠").replace(/\/(?=[^\s⁠])/g, "/⁠");
    return `<span class="ipa tp-ipa" lang="en-GB"><span class="vh">Pronunciation: </span>${t}</span>`;
  },
  /* un término: nombre, IPA (si la tiene), altavoces; o.def y o.example lo añaden */
  term(t, o = {}){
    if(!t) return "";
    return `<div class="tp-term"><div class="tp-term-h"><span class="tp-term-t">${esc(t.term)}</span>${ui.say(t.say || t.term)}</div>${ui.ipa(t.ipa)}${o.def !== false && t.def ? `<p class="tp-def">${esc(t.def)}</p>` : ""}${o.example && t.example ? ui.quote(t.example) : ""}</div>`;
  },
  quote: s => s ? `<blockquote class="tp-quote">${ico("quotes", "bold", 18, "tp-q-ic")}<span>${esc(s)}</span></blockquote>` : "",
  /* anillo de progreso (decorativo: el número va en texto al lado) */
  ring(p, o = {}){
    const s = o.size || 40, v = Math.max(0, Math.min(100, Math.round(+p || 0)));
    return `<svg class="tp-ring${o.cls ? " " + o.cls : ""}" width="${s}" height="${s}" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><circle class="tp-ring-bg" cx="18" cy="18" r="15"/>${v ? `<circle class="tp-ring-fg" cx="18" cy="18" r="15" pathLength="100" stroke-dasharray="${v} 100" transform="rotate(-90 18 18)"/>` : ""}</svg>`;
  },
  /* los puntos de las 3 lecciones de una unidad */
  dots(uid){
    const s = unitStatus(uid);
    return `<span class="tp-dots" role="img" aria-label="${s.done} of ${s.total} lessons done">${s.lessons.map(l => `<i${l.done ? ' class="on"' : ""}></i>`).join("")}</span>`;
  },
  badge: (t, cls = "") => `<span class="tp-badge${cls ? " " + cls : ""}">${esc(t)}</span>`,
  /* el enlace «Source» de un ítem o término (fuera de la app: data-no-gate, el mayor ya pasó la Puerta) */
  src(u, srcId, label = "Source"){
    const s = u && Array.isArray(u.sources) ? u.sources.find(x => x.id === srcId) : null;
    if(!s || !/^https:\/\//.test(s.url)) return "";
    return `<a class="tp-src" href="${esc(s.url)}" target="_blank" rel="noopener" data-no-gate title="${esc(s.title)}">${ico("arrow-square-out", "bold", 16)}<span>${esc(label)}</span><span class="vh">: ${esc(s.title)} (opens in a new tab)</span></a>`;
  },
  /* fila de una lista agrupada (.tp-list): {href | (botón), icon, tone: "ok"|"gr"|"gold" (clase tp-ric-<tone>), t, sub, id,
     chev, attrs, cls, end, iconStyle} */
  row(o = {}){
    const ic = o.icon ? `<span class="tp-ric${o.tone ? " tp-ric-" + o.tone : ""}" aria-hidden="true">${ico(o.icon, o.iconStyle || "bold", 18)}</span>` : "";
    const inner = `${ic}<span class="tp-rt">${esc(o.t)}${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</span>${o.end || ""}${o.href || o.chev ? ico("caret-right", "bold", 16, "tp-chev") : ""}`;
    const at = `${o.id ? ` id="${esc(o.id)}"` : ""}${o.attrs ? " " + o.attrs : ""}`, cls = `tp-row${o.icon ? "" : " tp-row-noic"}${o.cls ? " " + o.cls : ""}`;
    return o.href ? `<a class="${cls}" href="${esc(o.href)}"${at}>${inner}</a>` : `<button type="button" class="${cls}"${at}>${inner}</button>`;
  },
  empty(o = {}){
    return `<div class="card tp-card tp-empty">${o.icon ? `<span class="tp-empty-ic" aria-hidden="true">${ico(o.icon, "bold", 28)}</span>` : ""}<h2 class="tp-title">${esc(o.title || "Nothing here yet")}</h2>${o.sub ? `<p class="tp-sub">${esc(o.sub)}</p>` : ""}${o.href ? `<a class="glass-btn${o.pri ? " glass-btn--pri" : ""}" href="${esc(o.href)}">${esc(o.btn || "Back to Today")}</a>` : ""}</div>`;
  },
};
const fmt = {
  ago,
  /* cuándo vuelve (un número de día): «today», «tomorrow», «in 3 days», «on 12 Nov» */
  due(n){
    const k = n - tday();
    if(k <= 0) return "today"; if(k === 1) return "tomorrow"; if(k < 7) return `in ${k} days`;
    return "on " + new Date(n * DAY).toLocaleDateString("en-GB", {day: "numeric", month: "short", timeZone: "UTC"});
  },
  date: s => { const n = strDay(s); return n == null ? "" : new Date(n * DAY).toLocaleDateString("en-GB", {weekday: "short", day: "numeric", month: "long", timeZone: "UTC"}); },
  plural,
};

/* ---------- el modo foco: #/techl/<kind>/… ---------- */
const FOCUS = {}, TITLES = {lesson: "Lesson", review: "Review", mock: "Mock interview", case: "Case practice", pairs: "Pairs", clock: "Beat the clock"};
let ACTIVE = "", PASS = false, FPATH = "";
function register(kind, o){
  if(!/^[a-z][a-z0-9-]{0,30}$/.test(String(kind)) || !o || typeof o.render !== "function") throw new Error("vocabTech.focus.register(kind, {render, exit, blocks})");
  FOCUS[kind] = o;
  if(typeof o.title === "string") TITLES[kind] = o.title;
}
ROUTES.techl = async parts => {
  const k = parts[0] || "", r = FOCUS[k];
  ACTIVE = r ? k : ""; FPATH = hashPath();
  if(!r) return missing("techl", parts);
  await r.render(parts.slice(1));
};
ROUTES.techl.load = parts => { const r = FOCUS[(parts || [])[0]]; return r && typeof r.load === "function" ? r.load(parts.slice(1)) : units(); };
bus.on("route", () => { PASS = false; if(secOf(hashPath()) !== "techl") ACTIVE = ""; });
const SZ = {d: null, o: null, closing: false};
function stopSheet(){
  if(SZ.d && SZ.d.isConnected) return SZ.d;
  const d = D.createElement("dialog");
  d.id = "tp-stop"; d.className = "tp-sheet tp-stop-d"; d.setAttribute("aria-labelledby", "tp-stop-t"); d.lang = "en-GB";
  d.dataset.noRenew = ""; d.dataset.noHint = "";
  d.addEventListener("click", e => {
    if(e.target.closest("#tp-stop-go")){
      const o = SZ.o || {}; SZ.o = null; SZ.closing = true;
      closeSheet(d);
      if(typeof o.onKeep === "function") try{ o.onKeep(); }catch(err){ console.error(err); }
    }
    else if(e.target.closest("#tp-stop-out")){
      const o = SZ.o || {}; SZ.o = null;
      try{ d.close(); }catch(_){}
      try{ if(typeof o.onStop === "function") o.onStop(); }catch(err){ console.error(err); }
      leave(!!o.viaBack);
    }
  });
  /* cerrada con Escape (o al terminar de cerrarse tras «Keep going»): seguir */
  d.addEventListener("close", () => { SZ.closing = false; const o = SZ.o; SZ.o = null; if(o && typeof o.onKeep === "function") try{ o.onKeep(); }catch(e){ console.error(e); } });
  D.body.appendChild(d); SZ.d = d;
  return d;
}
function closeSheet(d){ if(!d || !d.open) return; if(W.M && typeof M.closeSheet === "function" && d.classList.contains("m-sheet")) M.closeSheet(d); else d.close(); }
/* «Stop here?» («Keep going» destacado · «Stop»). o: {from, viaBack, title, sub, onStop, onKeep}. true = se enseña */
function ask(o = {}){
  const d = stopSheet();
  if(d.open && SZ.o && !SZ.closing){ if(o.viaBack) SZ.o.viaBack = true; return true; }
  SZ.o = Object.assign({}, o); SZ.closing = false;   /* (si se estaba cerrando, M.openSheet la vuelve a abrir) */
  d.innerHTML = `<div class="tp-stop">
    <span class="tp-stop-ic" aria-hidden="true">${ico("pause", "bold", 28)}</span>
    <h2 class="tp-stop-t" id="tp-stop-t">${esc(o.title || "Stop here?")}</h2>
    <p class="tp-sub">${esc(o.sub || "What you've done so far is saved on this device.")}</p>
    <div class="tp-stop-b"><button type="button" class="glass-btn glass-btn--lg" id="tp-stop-out">Stop</button>
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="tp-stop-go" data-key="enter" autofocus>Keep going</button></div></div>`;
  stopSpeak();
  try{ if(W.M && typeof M.openSheet === "function") M.openSheet(d, {from: o.from && o.from.nodeType === 1 ? o.from : null}); else d.showModal(); }
  catch(e){ try{ d.showModal(); }catch(e2){ d.setAttribute("open", ""); } }
  return true;
}
/* salir de verdad de la sesión: Atrás del navegador (viaBack) o la ✕ (a donde se estaba antes) */
function leave(viaBack){
  PASS = true; stopSpeak();
  if(viaBack){ try{ history.back(); }catch(e){} return; }
  const x = D.getElementById("fx-x");
  if(x && x.isConnected && ROOT.hasAttribute("data-focus")) x.click(); else navTo("#/tech");
}
/* para blocks(hp): vuelve a poner la sesión en el historial y pregunta; true */
function guard(hp, o = {}){
  if(!FPATH || hp === FPATH) return false;
  try{ history.pushState(history.state, "", "#/" + FPATH); }catch(e){ return false; }
  return ask(Object.assign({}, o, {viaBack: true}));
}
const focus = {
  register, ask, guard, leave,
  get active(){ return ACTIVE; },
  title: h => { const k = String(h == null ? hashPath() : h).replace(/^#?\/?/, "").split("/")[1]; return TITLES[k] || "Practice"; },
  exit(from){
    if(PASS) return false;
    const r = FOCUS[ACTIVE]; if(!r || typeof r.exit !== "function") return false;
    try{ return !!r.exit(from); }catch(e){ console.error(e); return false; }
  },
  _blocks(hp){
    if(PASS || !ACTIVE) return false;
    const r = FOCUS[ACTIVE]; if(!r || typeof r.blocks !== "function") return false;
    try{ return !!r.blocks(hp); }catch(e){ console.error(e); return false; }
  },
};
/* una pantalla de Tech Prep que esta versión aún no trae */
function missing(sec){
  const a = D.getElementById("app"); if(!a) return;
  css();
  a.innerHTML = `<div class="tp-page">${ui.empty({icon: "timer", title: "Coming soon", sub: "This part of Tech Prep isn't ready in this version yet.", href: "#/tech"})}</div>`;
}

/* ---------- CSS compartido ---------- */
const CSS = `
:root[data-tech] #tabhead{max-width:calc(680px + max(16px,var(--safe-l)) + max(16px,var(--safe-r)))}
.tp-page{display:flex;flex-direction:column;gap:12px;max-width:680px;margin:0 auto;min-width:0}
.tp-card{padding:16px}
:root[data-theme=dark] .tp-card.card,:root[data-theme=dark] .tp-list{background:var(--card)}
.tp-eyebrow{margin:0 0 2px;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.tp-title{margin:0;font:700 var(--fs-t3)/1.22 var(--f-round);color:var(--label);overflow-wrap:anywhere;text-wrap:balance}
.tp-sub{margin:4px 0 0;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label2);overflow-wrap:anywhere}
.tp-text{font:400 var(--fs-sub)/1.5 var(--f-text);color:var(--label);max-width:70ch}
.tp-h{margin:8px 16px 6px;font:600 var(--fs-note)/1.33 var(--f-text);color:var(--label2)}
.tp-list{background:var(--card);border-radius:var(--r-card);overflow:hidden}
.tp-row{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:var(--row);margin:0;padding:10px 16px;border:0;background:none;
  color:var(--label);font:400 var(--fs-sub)/1.3 var(--f-text);text-align:left;text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.tp-list>.tp-row+.tp-row::before,.tp-list>*+.tp-row::before{content:"";position:absolute;top:0;left:60px;right:0;height:1px;background:var(--sep);transform:scaleY(.5);transform-origin:0 0}
.tp-list>.tp-row.tp-row-noic::before{left:16px}
.tp-list>h2+.tp-row::before,.tp-list>h3+.tp-row::before{display:none}
.tp-row:focus-visible{outline-offset:-3px}
.tp-row[aria-disabled=true]{cursor:default;color:var(--label2)}
.tp-ric{flex:none;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--brand-fill);color:#fff}
.tp-ric.tp-ric-ok{background:var(--ok-fill)}.tp-ric.tp-ric-gr{background:#8E8E93}.tp-ric.tp-ric-gold{background:var(--gold);color:var(--gold-on)}
.tp-rt{flex:1;min-width:0;overflow-wrap:anywhere}
.tp-rt small{display:block;margin-top:1px;font:400 var(--fs-note)/1.33 var(--f-text);color:var(--label2)}
.tp-chev{flex:none;color:var(--label3)}
:root[data-contrast=more] .tp-chev{color:var(--label2)}
.tp-chip{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:var(--tap);max-width:100%;padding:6px 14px;border:2px solid transparent;
  border-radius:var(--r-pill);background:var(--fill);color:var(--label);font:600 var(--fs-sub)/1.25 var(--f-text);text-align:center;cursor:pointer;
  overflow-wrap:anywhere;-webkit-tap-highlight-color:transparent}
.tp-chip[aria-pressed=true],.tp-chip.tp-on{background:var(--brand-soft);border-color:var(--brand-tint);color:var(--brand-ink)}
.tp-chip.tp-ok{background:var(--ok-fill);color:#fff;border-color:transparent}
.tp-chip.tp-miss{background:var(--miss-fill);color:var(--miss-on);border-color:transparent}
.tp-chip:disabled{cursor:default}
.tp-says{display:inline-flex;gap:8px;flex:none}
.tp-say{flex:none;width:var(--tap);height:var(--tap);padding:0;border:0;border-radius:50%;display:grid;place-items:center;
  background:var(--brand-soft);color:var(--brand-ink);cursor:pointer;-webkit-tap-highlight-color:transparent}
.tp-say.playing{background:var(--brand-fill);color:#fff}
.tp-term{display:flex;flex-direction:column;gap:4px;min-width:0}
.tp-term-h{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.tp-term-t{min-width:0;font:700 var(--fs-t2)/1.2 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.tp-ipa{font-size:var(--fs-sub);line-height:1.35}
.tp-def{margin:4px 0 0;font:400 var(--fs-sub)/1.45 var(--f-text);color:var(--label);max-width:70ch}
.tp-quote{display:flex;gap:10px;margin:8px 0 0;padding:10px 14px;border-radius:var(--r-md);background:var(--fill2);
  font:400 var(--fs-sub)/1.45 var(--f-text);color:var(--label);max-width:70ch}
.tp-q-ic{flex:none;margin-top:2px;color:var(--label2)}
.tp-ring{flex:none;display:block}
.tp-ring-bg{fill:none;stroke:var(--fill);stroke-width:4}
.tp-ring-fg{fill:none;stroke:var(--teal);stroke-width:4;stroke-linecap:round;transition:stroke-dasharray var(--d-base,260ms) ease}
.tp-ring.done .tp-ring-fg{stroke:var(--ok-fill)}
.tp-dots{display:inline-flex;gap:6px;flex:none}
.tp-dots i{width:10px;height:10px;border-radius:50%;background:var(--fill);box-shadow:inset 0 0 0 1px var(--sep)}
.tp-dots i.on{background:var(--ok-fill);box-shadow:none}
.tp-badge{display:inline-flex;align-items:center;min-height:24px;padding:2px 10px;border-radius:var(--r-pill);background:var(--fill2);color:var(--label2);
  font:600 var(--fs-note)/1.2 var(--f-text);white-space:nowrap}
.tp-badge.pri{background:var(--brand-soft);color:var(--brand-ink)}
.tp-src{display:inline-flex;align-items:center;gap:6px;min-height:var(--tap);padding:0 4px;color:var(--brand-ink);font:600 var(--fs-note)/1.2 var(--f-text);text-decoration:none}
.tp-src:hover span:first-of-type{text-decoration:underline}
.tp-ok{color:var(--ok-ink)}.tp-miss{color:var(--miss-ink)}
.tp-empty{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:28px 20px}
.tp-empty .tp-sub{margin:0 0 8px}
.tp-empty-ic{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;background:var(--fill2);color:var(--label2)}
/* modo foco (#/techl/…): la fila de arriba en la línea de la ✕ (barra de progreso), y el botón principal fijo abajo */
.tp-ftop{display:flex;align-items:center;gap:12px;min-height:var(--tap);margin:4px 0 16px}
:root[data-focus=tech] .tp-ftop{margin-top:calc(-1 * (var(--tap) + 12px));padding:0 0 0 56px}
.tp-pbar{flex:1;height:10px;border-radius:999px;background:var(--fill);overflow:hidden}
.tp-pbar>i{display:block;width:0;height:100%;border-radius:inherit;background:var(--teal);transition:width var(--d-base,260ms) ease}
:root[data-focus=tech] main{padding-bottom:calc(var(--btn-main) + var(--safe-b) + 48px)}
.tp-dock{position:fixed;z-index:5;left:max(16px,var(--safe-l),calc(50% - 340px));right:max(16px,var(--safe-r),calc(50% - 340px));
  bottom:calc(var(--safe-b) + 16px);display:flex;gap:12px;pointer-events:none}
.tp-dock>*{pointer-events:auto;flex:1}
.tp-dock::before{content:"";position:absolute;z-index:-1;left:-16px;right:-16px;top:-20px;bottom:calc(-1 * (var(--safe-b) + 16px));
  background:linear-gradient(to bottom,transparent,var(--bg) 45%);pointer-events:none}
/* «Stop here?» y las hojas de Tech Prep */
.tp-stop{display:flex;flex-direction:column;align-items:center;text-align:center;padding:4px 4px 8px}
.tp-stop-ic{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;margin:4px 0 12px;color:var(--brand-tint);background:var(--fill)}
.tp-stop-t{margin:0 0 2px;font:700 var(--fs-t2)/1.2 var(--f-round);color:var(--label)}
.tp-stop .tp-sub{margin:0 0 20px}
.tp-stop-b{display:flex;gap:12px;width:100%;max-width:440px}
.tp-stop-b>*{flex:1}
/* Today */
.tp-today .tp-hero{display:flex;flex-direction:column;align-items:stretch}
.tp-hero .tp-go{margin-top:16px}
.tp-cd{border-radius:var(--r-card)}
.tp-streak{display:grid;grid-template-columns:40px minmax(0,1fr);grid-template-areas:"fl t" "fl wk";align-items:center;column-gap:12px;row-gap:6px;padding:12px 16px}
.tp-fl{grid-area:fl;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--gold-soft);color:var(--gold-ink)}
.tp-streak.quiet .tp-fl{background:var(--fill2);color:var(--label2)}
.tp-st-t{grid-area:t;min-width:0;font:600 var(--fs-sub)/1.3 var(--f-text);color:var(--label)}
.tp-streak.quiet .tp-st-t{font-weight:400;color:var(--label2)}
.tp-wk{grid-area:wk;display:flex;gap:4px}
.tp-wk span{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--fill2);color:var(--label2);
  font:600 var(--fs-note)/1 var(--f-text)}
.tp-wk span.on{background:var(--ok-fill);color:#fff}
.tp-wk span.now{box-shadow:inset 0 0 0 2px var(--label2)}
.tp-wk span.on.now{box-shadow:inset 0 0 0 2px rgba(255,255,255,.7)}
.tp-ready{display:flex;flex-direction:column;min-width:0}
.tp-ready .tp-h{margin:4px 16px 6px}
.tp-rgrid{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x proximity;padding:0 0 2px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.tp-rgrid::-webkit-scrollbar{display:none}
.tp-rd{flex:0 0 136px;scroll-snap-align:start;display:flex;flex-direction:column;gap:4px;min-width:0;padding:10px 14px;border-radius:var(--r-card);
  background:var(--card);color:var(--label);text-decoration:none;-webkit-tap-highlight-color:transparent}
.tp-rd:focus-visible{outline-offset:-3px}
.tp-rd-t{font:600 var(--fs-sub)/1.25 var(--f-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tp-rd-r{display:flex;align-items:center;gap:8px}
.tp-rd small{font:400 var(--fs-note)/1.33 var(--f-text);color:var(--label2)}
@media (min-width:700px){.tp-rgrid{flex-wrap:wrap;overflow:visible}.tp-rd{flex:1 1 140px}}
.tp-pct{flex:none;font:700 var(--fs-sub)/1 var(--f-text);font-variant-numeric:tabular-nums;color:var(--label)}
.tp-medal{flex:none;color:var(--gold-ink)}
.tp-date{flex:none;min-height:var(--tap);max-width:170px;padding:0 10px;border:0;border-radius:10px;background:var(--fill2);color:var(--label);
  font:400 var(--fs-sub)/1 var(--f-text)}
.tp-dlist{position:relative}
.tp-dlist .tp-date{display:block;margin:0 16px 12px 60px}
.tp-date.tp-date-x{position:absolute;left:60px;bottom:8px;width:1px;height:1px;margin:0;padding:0;opacity:0;pointer-events:none}
@media (max-width:379px){.tp-wk span{width:26px;height:26px}}
/* ajustes de Tech Prep */
dialog#tp-set.m-sheet{padding:0;overflow:hidden;height:min(720px,calc(100dvh - var(--safe-t,0px) - 24px));max-width:600px}
dialog#tp-set.m-sheet[open]{display:flex;flex-direction:column}
dialog#tp-set.m-sheet,dialog#tp-set.m-sheet.glass{background:#F2F2F7;-webkit-backdrop-filter:none;backdrop-filter:none}
:root[data-theme=dark] dialog#tp-set.m-sheet,:root[data-theme=dark] dialog#tp-set.m-sheet.glass{background:#1C1C1E}
dialog#tp-set .m-grab{flex:none;margin:0;position:relative}
.tp-sbar{flex:none;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;min-height:52px;padding:0 16px 8px}
.tp-stt{grid-column:2;margin:0;font:600 var(--fs-head)/1.2 var(--f-text);color:var(--label);white-space:nowrap}
.tp-stt:focus{outline:none}
.tp-sdone{grid-column:3;justify-self:end;min-height:var(--tap);padding:0 8px;border:0;background:none;color:var(--brand-ink);font:600 var(--fs-sub)/1 var(--f-text);cursor:pointer}
.tp-spg{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;padding:4px 16px max(28px,calc(var(--safe-b,0px) + 16px))}
#tp-set .st-sec{margin:0 0 22px}
#tp-set .st-g{background:var(--card)}
:root[data-theme=dark] #tp-set .st-g{background:var(--card-2)}
#tp-set .st-g>*+.st-r::before{content:"";position:absolute;top:0;left:58px;right:0;height:1px;background:var(--sep);transform:scaleY(.5);transform-origin:0 0}
#tp-set .st-r{font-size:var(--fs-sub)}
#tp-set .st-r.col{align-items:stretch}
#tp-set select{min-height:var(--tap);min-width:0;flex:1;padding:0 10px;border:0;border-radius:10px;background:var(--fill2);color:var(--label);font:400 var(--fs-sub)/1.2 var(--f-text)}
#tp-set .seg{margin:0;max-width:none;min-height:44px}
.tp-sline{display:flex;align-items:flex-start;gap:10px;margin:0;padding:12px 16px;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label)}
.tp-sline .ico{flex:none;margin-top:1px;color:var(--label2)}
.tp-sline[data-state=ok] .ico{color:var(--ok-ink)}
.tp-vrow{display:flex;gap:8px;align-items:center;width:100%}
.tp-date.tp-date-w{flex:1;max-width:none}
#tp-set .st-g>*+.st-r.col::before{left:16px}
.tp-off-p{display:block;height:6px;margin-top:8px;border-radius:3px;background:var(--fill);overflow:hidden}
.tp-off-p[hidden]{display:none}
.tp-off-p>i{display:block;height:100%;width:0;background:var(--teal)}
dialog#tp-erase .tp-stop-b .glass-btn{white-space:normal}
/* en claro, el texto secundario de todas las hojas de vidrio de Tech Prep, un poco más fuerte (≥ 4,5:1 sobre el vidrio
   con el fondo oscurecido detrás) */
:root:not([data-theme=dark]) dialog.tp-sheet.glass{--label2:rgba(60,60,67,.86)}
@media (min-width:820px){dialog#tp-set.m-sheet{height:fit-content;max-height:min(760px,calc(100dvh - 152px))}}
@media (forced-colors:active){.tp-say,.tp-chip,.tp-wk span{border:1px solid CanvasText}}
`;
function css(){ if(D.getElementById("css-tech") || !D.head) return; const s = D.createElement("style"); s.id = "css-tech"; s.textContent = CSS; D.head.appendChild(s); }

/* ---------- Today (#/tech, §10.1) ---------- */
function lsSaved(id){
  try{ const v = JSON.parse(sessionStorage.getItem(LSKEY)); if(v && v.id === id) return true; }catch(e){}
  try{ const d = JSON.parse(localStorage.getItem(LSDRAFT)); if(d && typeof d.t === "number" && now() - d.t < 72 * 36e5 && d.v && d.v.id === id) return true; }catch(e){}
  return false;
}
function todayHtml(){
  const n = dueCount(), nx = nextLesson(), dl = daysLeft(), f = dl != null && dl >= 0 ? focusArea() : null;
  let hero;
  if(n){
    const min = Math.max(1, Math.round(Math.min(n, QUEUE_N) * .6));
    hero = {eye: "Review", t: plural(n, "item to review", "items to review"), sub: `About ${min} min · the ones you're about to forget come first`, href: "#/techl/review", btn: "Start"};
  } else if(nx){
    const u = nx.unit;
    hero = {eye: nx.i === 1 && !unitStatus(u.id).done ? "Next unit" : "Next lesson", t: `Unit ${u.n} · ${u.title}`,
      sub: `Lesson ${nx.i} of ${nx.of}${nx.lesson && nx.lesson.title ? " · " + nx.lesson.title : ""}`, href: "#/techl/lesson/" + nx.lesson.id, btn: lsSaved(nx.lesson.id) ? "Continue" : "Start"};
  } else hero = {eye: "All caught up", t: "Every lesson is done", sub: "Keep sharp with a mock interview.", href: "#/techmock", btn: "Start"};
  const second = n && nx ? `<div class="tp-list">${ui.row({href: "#/techl/lesson/" + nx.lesson.id, icon: "path", t: `Next lesson · Unit ${nx.unit.n}`,
    sub: `${nx.unit.title} · Lesson ${nx.i} of ${nx.of}`, id: "tp-next"})}</div>` : "";
  const cd = dl != null && dl >= 0 ? `<div class="tp-list">${ui.row({href: f && f.unit ? "#/techunit/" + f.unit.id : "#/techpath", icon: "calendar-blank", id: "tp-cd",
    t: dl === 0 ? "Interview today" : dl === 1 ? "Interview tomorrow" : `Interview in ${dl} days`, sub: f ? `Focus: ${f.unit ? f.unit.title : f.block.title}` : ""})}</div>` : "";
  const s = streak(), wk = week(), t = tday(), wi = (new Date(t * DAY).getUTCDay() + 6) % 7, L = ["M", "T", "W", "T", "F", "S", "S"], LL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const nwk = wk.filter(Boolean).length;
  const st = `<section class="card tp-streak${s ? "" : " quiet"}" aria-label="Study streak">
      <span class="tp-fl" aria-hidden="true">${ico("flame", s ? "fill" : "bold", 22)}</span>
      <span class="tp-st-t">${s ? `${s}-day streak` : nwk ? plural(nwk, "study day this week", "study days this week") : "No study days yet this week"}</span>
      <span class="tp-wk" role="img" aria-label="This week: ${nwk ? wk.map((x, i) => x ? LL[i] : "").filter(Boolean).join(", ") : "no study days yet"}">${wk.map((x, i) => `<span class="${x ? "on" : ""}${i === wi ? " now" : ""}">${L[i]}</span>`).join("")}</span></section>`;
  const ms = medals();
  /* una ficha pequeña por bloque, en una fila que se desliza en el móvil (con los 7 bloques, Today sigue cabiendo sin scroll) */
  const ready = ms.length ? `<section class="tp-ready" aria-labelledby="tp-ready-h"><h2 id="tp-ready-h" class="tp-h">Interview ready</h2><div class="tp-rgrid">${ms.map(m => {
    const r = readiness(m.id), b = blockOf(m.id) || {};
    return `<a class="tp-rd" href="#/techpath" data-block="${esc(m.id)}" aria-label="${esc(`${m.title}: ${r}% interview ready, ${m.sub}${m.note ? ". " + m.note : ""}`)}">
      <span class="tp-rd-t">${esc(b.short || m.title)}</span>
      <span class="tp-rd-r">${ui.ring(r, {size: 40, cls: m.got ? "done" : ""})}<span class="tp-pct">${r}%</span>${m.got ? ico("medal", "fill", 22, "tp-medal") : ""}</span>
      <small>${esc(m.sub)}</small></a>`;
  }).join("")}</div></section>` : "";
  const date = dl == null || dl < 0 ? `<div class="tp-list tp-dlist">${ui.row({icon: "calendar-blank", t: "Set interview date", sub: "Reviews are planned around it", id: "tp-date-b", chev: true})}
      <input type="date" class="tp-date tp-date-x" id="tp-date" min="${dayStr(t)}" aria-label="Interview date" tabindex="-1"></div>` : "";
  return `<div class="tp-page tp-today" id="tp-today">${cd}
    <section class="card tp-card tp-hero" aria-labelledby="tp-hero-t">
      <p class="tp-eyebrow">${esc(hero.eye)}</p>
      <h2 class="tp-title" id="tp-hero-t">${esc(hero.t)}</h2>
      <p class="tp-sub">${esc(hero.sub)}</p>
      <a class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block tp-go" id="tp-go" href="${esc(hero.href)}" data-key="enter">${ico("play", "fill", 20)}${esc(hero.btn)}</a>
    </section>${second}
    ${st}${ready}${date}
    <div class="tp-list">${ui.row({href: "#/", icon: "translate", tone: "gr", t: "Back to languages", id: "tp-back"})}</div></div>`;
}
async function todayRoute(){
  css();
  const hp = hashPath(), app = D.getElementById("app");
  try{ await units(); }
  catch(e){
    if(hashPath() !== hp) return;
    app.innerHTML = `<div class="tp-page">${ui.empty({icon: "wifi-slash", title: "Couldn't load Tech Prep", sub: e.message})}
      <div class="tp-list">${ui.row({icon: "arrows-clockwise", t: "Try again", id: "tp-retry"})}${ui.row({href: "#/", icon: "translate", tone: "gr", t: "Back to languages"})}</div></div>`;
    const b = D.getElementById("tp-retry"); if(b) b.onclick = () => route();
    return;
  }
  if(hashPath() !== hp) return;
  app.innerHTML = todayHtml();
  wireToday();
}
/* «Set interview date»: el selector del sistema (showPicker); si no lo hay o falla, el campo se ve en la fila */
function wireToday(){
  const b = D.getElementById("tp-date-b"), di = D.getElementById("tp-date");
  if(!b || !di) return;
  b.addEventListener("click", () => {
    let ok = false;
    if(typeof di.showPicker === "function"){ try{ di.showPicker(); ok = true; }catch(e){} }
    if(!ok){ di.classList.remove("tp-date-x"); di.removeAttribute("tabindex"); try{ di.focus(); }catch(e){} }
  });
  di.addEventListener("change", () => { if(!di.value || strDay(di.value) == null) return; setInterview(di.value); haptic("selection"); repaintToday(); });
}
function repaintToday(){
  const el = D.getElementById("tp-today"); if(!el || hashPath() !== "tech") return;
  const y = scrollY, f = D.activeElement && D.activeElement.id; const box = D.createElement("div"); box.innerHTML = todayHtml(); el.replaceWith(box.firstElementChild);
  wireToday();
  scrollTo(0, y);
  /* el foco vuelve a su sitio (o, si esa fila ya no está, a la cuenta atrás que la sustituye) */
  const back = (f && D.getElementById(f)) || (f === "tp-date-b" || f === "tp-date" ? D.getElementById("tp-cd") : null);
  if(back) try{ back.focus({preventScroll: true}); }catch(e){}
}
ROUTES.tech = () => todayRoute();
ROUTES.tech.load = () => units();
/* el aviso de la pestaña Today: lo que toca repasar */
function paintBadge(){
  if(!ROOT.hasAttribute("data-tech") || typeof tabBadge !== "function") return;
  const n = dueCount();
  tabBadge("tp-today", n, n ? plural(n, "item to review", "items to review") : "");
}

/* ---------- ajustes de Tech Prep (§10.9) ---------- */
let SET = null;
const RATES = [{v: .8, t: "Slower"}, {v: 1, t: "Normal"}, {v: 1.2, t: "Faster"}];
const ACC = {GB: "UK", US: "US", IE: "Ireland", AU: "Australia", NZ: "New Zealand", ZA: "South Africa", CA: "Canada", IN: "India"};
function voiceOpts(){
  let list = []; try{ list = langVoices("english"); }catch(e){}
  let auto = null; try{ auto = autoVoice("english"); }catch(e){}
  const cur = (() => { try{ const c = voiceChoiceOf("english").n; return c && findVoice("english", c) ? c : ""; }catch(e){ return ""; } })();
  const name = v => { let c = v.name; try{ c = vcore(v.name) || v.name; }catch(e){} const r = (() => { try{ return vlang(v).r; }catch(e){ return ""; } })(); return ACC[r] ? `${c} · ${ACC[r]}` : c; };
  const opts = [`<option value=""${cur ? "" : " selected"}>${esc(auto ? `Automatic (${name(auto)})` : "Automatic")}</option>`];
  for(const v of list){ let id = v.name; try{ id = vid(v, "english"); }catch(e){} opts.push(`<option value="${esc(id)}"${id === cur ? " selected" : ""}>${esc(name(v))}</option>`); }
  return {html: opts.join(""), n: list.length};
}
function offFiles(){
  const out = new Set(["data/tech/index.json"]);
  for(const u of avail()) out.add(`data/tech/${u.id}.json`);
  if((T.mods || []).includes("js/tech-pages.js")) out.add("data/tech/cases.json");   /* los casos son de js/tech-pages.js */
  for(const f of OFF_EXTRA) out.add(f);
  return [...out];
}
const OFF_EXTRA = new Set();
const absUrl = u => { const x = new URL(u, location.href); return x.origin + x.pathname; };
const MEDIA = (() => { try{ return OFF_MEDIA; }catch(e){ return "vocab-media"; } })();
async function offState(){
  if(!("caches" in W)) return {can: false};
  try{
    const files = offFiles(), c = await caches.open(MEDIA);
    const have = await Promise.all(files.map(u => c.match(absUrl(u)).then(r => !!r, () => false)));
    return {can: true, n: have.filter(Boolean).length, of: files.length};
  }catch(e){ return {can: false}; }
}
let offJob = null;
async function offDownload(onStep){
  if(offJob) return offJob;
  offJob = (async () => {
    if(!("caches" in W)) return {ok: 0, of: 0, can: false};
    await index().catch(() => null);
    const files = offFiles(), c = await caches.open(MEDIA);
    let ok = 0, i = 0;
    for(const u of files){
      try{
        const r = await fetch(u, {cache: "reload"});
        if(r.ok){ await c.put(absUrl(u), r.clone()); ok++; }
      }catch(e){}
      i++; if(onStep) try{ onStep(i, files.length); }catch(e){}
    }
    return {ok, of: files.length, can: true};
  })().finally(() => { offJob = null; });
  return offJob;
}
function offLine(s){
  if(!s || !s.can) return "This browser can't keep files for offline use.";
  if(s.n >= s.of) return `Ready offline · all ${s.of} files are on this device`;
  if(!s.n) return "Not downloaded yet · lessons you've opened already work offline";
  return `${s.n} of ${s.of} files on this device`;
}
function setHtml(){
  const date = interviewDate(), r = rate(), v = voiceOpts();
  return `<div class="tp-sbar"><h2 class="tp-stt" id="tp-set-t" tabindex="-1">Settings</h2><button type="button" class="tp-sdone" id="tp-set-x">Done</button></div>
  <div class="tp-spg">
    <section class="st-sec" aria-labelledby="tp-s-i"><h3 class="st-h" id="tp-s-i">Interview</h3><div class="st-g">
      <div class="st-r col"><label class="st-l" for="tp-set-date">Interview date<small>${date ? esc(fmt.date(date)) : "Optional"}</small></label>
        <div class="tp-vrow"><input type="date" class="tp-date tp-date-w" id="tp-set-date" value="${esc(date || "")}" min="${dayStr(tday())}"></div></div>
      <button type="button" class="st-r st-btn" id="tp-set-clear"${date ? "" : " hidden"}><span class="st-ic gr" aria-hidden="true">${ico("x", "bold", 18)}</span><span class="st-l">Clear interview date</span></button>
    </div><p class="st-foot">With a date, everything you've studied comes back in the last week before it.</p></section>
    <section class="st-sec" aria-labelledby="tp-s-v"><h3 class="st-h" id="tp-s-v">Voice</h3><div class="st-g">
      <div class="st-r col"><label for="tp-set-voice" class="st-l">English voice<small>The same voice as English in Ajustes › Voz y velocidad</small></label>
        <div class="tp-vrow"><select id="tp-set-voice">${v.html}</select>
        <button type="button" class="glass-btn glass-btn--sm" id="tp-set-try" data-say-try>${ico("speaker-high", "bold", 18)}Try</button></div></div>
      <div class="st-r col"><span class="st-l" id="tp-set-rl">Speaking speed<small>Only for Tech Prep</small></span>
        <div class="seg" role="radiogroup" aria-labelledby="tp-set-rl">${RATES.map(x => `<button type="button" class="seg-i" role="radio" data-rate="${x.v}" aria-checked="${Math.abs(x.v - r) < .01}">${x.t}</button>`).join("")}</div></div>
    </div></section>
    <section class="st-sec" aria-labelledby="tp-s-o"><h3 class="st-h" id="tp-s-o">Offline</h3><div class="st-g">
      <button type="button" class="st-r" id="tp-set-dl"><span class="st-ic" aria-hidden="true">${ico("download-simple", "bold", 18)}</span>
        <span class="st-l">Download for offline<small id="tp-set-dls" aria-live="polite">Checking…</small><span class="tp-off-p" id="tp-set-dlp" hidden><i></i></span></span></button>
    </div></section>
    <section class="st-sec" aria-labelledby="tp-s-g"><h3 class="st-h" id="tp-s-g">Google copy</h3><div class="st-g">
      <p class="tp-sline" id="tp-set-g" aria-live="polite"></p></div></section>
    <section class="st-sec" aria-labelledby="tp-s-p"><h3 class="st-h" id="tp-s-p">Progress</h3><div class="st-g">
      <button type="button" class="st-r" id="tp-set-erase"><span class="st-ic gr" aria-hidden="true">${ico("trash", "bold", 18)}</span>
        <span class="st-l">Erase Tech Prep progress<small>Lessons, reviews, streak, medals, cases and stories</small></span></button>
    </div></section>
    <section class="st-sec" aria-label="Leave Tech Prep"><div class="st-g">
      <a class="st-r" href="#/" id="tp-set-back"><span class="st-ic gr" aria-hidden="true">${ico("translate", "bold", 18)}</span><span class="st-l">Back to languages</span>${ico("caret-right", "bold", 16, "tp-chev")}</a>
    </div></section>
  </div>`;
}
function setSheet(){
  if(SET && SET.isConnected) return SET;
  const d = D.createElement("dialog");
  d.id = "tp-set"; d.className = "tp-sheet"; d.lang = "en-GB"; d.setAttribute("aria-labelledby", "tp-set-t");
  D.body.appendChild(d);
  d.addEventListener("click", e => {
    const t = e.target;
    if(t.closest("#tp-set-x")) return closeSheet(d);
    if(t.closest("#tp-set-back")){ e.preventDefault(); closeSheet(d); navTo("#/"); return; }
    if(t.closest("#tp-set-clear")){ setInterview(null); haptic("selection"); paintSet(); repaintToday(); return; }
    const rb = t.closest("[data-rate]");
    if(rb){ uiSet({rate: +rb.dataset.rate}); d.querySelectorAll("[data-rate]").forEach(b => b.setAttribute("aria-checked", b === rb)); haptic("selection"); return; }
    const tr = t.closest("#tp-set-try"); if(tr){ speak("This is how Tech Prep sounds at this speed.", tr); return; }
    if(t.closest("#tp-set-dl")) return runDownload(d);
    if(t.closest("#tp-set-erase")) return askErase(t.closest("#tp-set-erase"));
  });
  d.addEventListener("change", e => {
    const t = e.target;
    if(t.id === "tp-set-date"){ if(t.value && strDay(t.value) != null){ setInterview(t.value); haptic("selection"); paintSet(true); repaintToday(); } }
    else if(t.id === "tp-set-voice"){ try{ setVoiceChoice("english", t.value); }catch(err){} haptic("selection"); }
  });
  d.addEventListener("keydown", e => {   /* flechas en la velocidad (radio) */
    const rb = e.target.closest && e.target.closest("[data-rate]"); if(!rb) return;
    const k = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key]; if(!k) return;
    e.preventDefault(); const bs = [...d.querySelectorAll("[data-rate]")], j = (bs.indexOf(rb) + k + bs.length) % bs.length; bs[j].focus(); bs[j].click();
  });
  d.addEventListener("close", () => stopSpeak());
  SET = d;
  return d;
}
/* repinta lo que cambia sin perder el foco (keep: deja el campo de fecha como está) */
function paintSet(keep){
  const d = SET; if(!d || !d.open) return;
  const date = interviewDate(), lab = d.querySelector('label[for="tp-set-date"] small'), cl = d.querySelector("#tp-set-clear"), di = d.querySelector("#tp-set-date");
  if(lab) lab.textContent = date ? fmt.date(date) : "Optional";
  if(cl) cl.hidden = !date;
  if(di && !keep) di.value = date || "";
  paintSync();
}
async function paintOff(){
  const s = await offState(), el = SET && SET.querySelector("#tp-set-dls");
  if(el && !offJob) el.textContent = offLine(s);
}
async function runDownload(d){
  const b = d.querySelector("#tp-set-dl"), s = d.querySelector("#tp-set-dls"), p = d.querySelector("#tp-set-dlp");
  if(!b || offJob) return;
  b.setAttribute("aria-disabled", "true");
  if(p){ p.hidden = false; p.firstElementChild.style.width = "0"; }
  if(s) s.textContent = "Downloading…";
  const r = await offDownload((i, n) => { if(p) p.firstElementChild.style.width = `${Math.round(100 * i / n)}%`; if(s) s.textContent = `Downloading · ${i} of ${n}`; });
  b.removeAttribute("aria-disabled"); if(p) p.hidden = true;
  const st = await offState();
  if(s) s.textContent = !r.can ? offLine(r) : r.ok === r.of ? `Done · all ${r.of} files are ready offline` : `Saved ${r.ok} of ${r.of} files · check the connection and try again`;
  if(r.can && r.ok === r.of) haptic("success");
  void st;
}
function openSettings(from){
  css();
  const d = setSheet();
  if(d.open) return;
  d.innerHTML = setHtml();
  paintSync(); paintOff();
  try{ if(W.M && typeof M.openSheet === "function") M.openSheet(d, {from: from && from.nodeType === 1 ? from : null}); else d.showModal(); }
  catch(e){ try{ d.showModal(); }catch(e2){ d.setAttribute("open", ""); } }
  try{ d.querySelector("#tp-set-t").focus({preventScroll: true}); }catch(e){}
  sync("settings");
}
bus.on("voices", () => { const s = SET && SET.open && SET.querySelector("#tp-set-voice"); if(s && D.activeElement !== s) s.innerHTML = voiceOpts().html; });
/* confirmación de «Erase Tech Prep progress» («Cancel» destacado · «Erase») */
let ER = null;
function askErase(from){
  if(!ER || !ER.isConnected){
    ER = D.createElement("dialog"); ER.id = "tp-erase"; ER.className = "tp-sheet"; ER.lang = "en-GB"; ER.setAttribute("aria-labelledby", "tp-erase-t");
    D.body.appendChild(ER);
    ER.addEventListener("click", async e => {
      if(e.target.closest("#tp-erase-no")) return closeSheet(ER);
      if(!e.target.closest("#tp-erase-yes")) return;
      const b = e.target.closest("#tp-erase-yes"); b.disabled = true;
      const where = await erase();
      closeSheet(ER);
      toastT(where === "google" ? "Tech Prep progress erased here and in your Google copy" : where === "wait" ? "Tech Prep progress erased · your Google copy will follow" : "Tech Prep progress erased", ico("check-circle", "fill", 22));
      paintSet(); repaintToday();
    });
  }
  const g = vs() && vs().connected();
  ER.innerHTML = `<div class="tp-stop"><span class="tp-stop-ic" aria-hidden="true">${ico("trash", "bold", 28)}</span>
    <h2 class="tp-stop-t" id="tp-erase-t">Erase Tech Prep progress?</h2>
    <p class="tp-sub">Lessons, reviews, streak, medals, cases and stories on this device${g ? " and in your Google copy" : ""} will be erased. This can't be undone.</p>
    <div class="tp-stop-b"><button type="button" class="glass-btn glass-btn--lg" id="tp-erase-yes">Erase</button>
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="tp-erase-no" autofocus>Cancel</button></div></div>`;
  try{ if(W.M && typeof M.openSheet === "function") M.openSheet(ER, {from}); else ER.showModal(); }catch(e){ try{ ER.showModal(); }catch(e2){} }
}

/* ---------- al entrar y al salir ---------- */
bus.on("tech-mode", d => {
  if(d && d.on){ css(); sync("enter"); setTimeout(paintBadge, 0); }
  else { stopSpeak(); [SET, ER, SZ.d].forEach(x => { if(x && x.open) try{ x.close(); }catch(e){} }); }
});
bus.on("route", () => { if(ROOT.hasAttribute("data-tech")) paintBadge(); });
/* la primera vez, "tech-mode" llega antes que este módulo (index.html cambia de pestañas antes de cargar la ruta) */
if(ROOT.hasAttribute("data-tech")) setTimeout(() => { sync("enter"); paintBadge(); }, 0);
/* «?» dentro de Tech Prep: la hoja de teclas de js/keys.js es del niño (en español); aquí no sale */
D.addEventListener("keydown", e => {
  if(e.key !== "?" || !ROOT.hasAttribute("data-tech") || e.defaultPrevented) return;
  const t = e.target; if(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if(!D.querySelector('[data-key~="?"]')) e.preventDefault();
});
css();

Object.assign(T, {
  loaded: true,
  index, unit, units, item, lessonOf, blockList, pathUnits, unitsOf, blockOf,
  get, put, del, list, merge,
  srs: {grade, gradeExplain, queue, dueCount, get: srsGet, TIV: TIV.slice()},
  progress: {lessonDone, unitStatus, nextLesson},
  act: {log: n => actAdd(n == null ? 1 : n), streak, week},
  interview: {date: interviewDate, set: setInterview, daysLeft},
  readiness, unitReadiness, medals, focusArea,
  speak, stopSpeak, rate,
  focus, missing,
  ui, fmt, css,
  sync: {now: () => sync("manual"), status: syncStatus, soon: syncSoon},
  offline: {files: offFiles, add: u => { if(typeof u === "string" && /^data\/tech\/[\w.-]+\.json$/.test(u)) OFF_EXTRA.add(u); }, state: offState, download: offDownload},
  openSettings, erase,
  day: tday, dayStr, strDay,
  _hash: () => hashData(db()), _reset: () => { DB = null; },
});
T.lesson = T.lesson || {};
if(!T.cases) T.cases = {};
})();
