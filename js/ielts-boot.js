/* Módulo ielts-boot (window.vocabIelts): la entrada a IELTS Prep (ielts.html), la página aparte para que un mayor
   prepare el IELTS Academic (banda 8.5-9 ≈ C2). Igual que Tech Prep, está escondida y no toca nada del niño:
   · El interruptor de este aparato (localStorage "ielts:on" = true; fuera de la partida): la fila «IELTS Prep» de
     Ajustes › Para mayores (adultHtml(), en español como el resto de esa página). Apagado: no hay entrada en el menú.
   · La entrada «IELTS Prep» del menú de la bandera (menuItem(), que pinta renderLangs de index.html): pasa la Puerta
     (adultGate, «Para entrar en IELTS Prep.»), pone sessionStorage "ielts:in" = "1" y abre ielts.html en la misma
     pestaña. ielts.html sin esa marca solo explica cómo entrar.
   · La copia en Google Drive (como la de Tech Prep en js/tech.js): con el Drive de la familia conectado en la app
     (vocabSync de js/sync.js, que ielts.html no carga) e IELTS Prep encendido, su propio archivo
     "vocabulary-ieltsprep.json" en appDataFolder (vocabSync.file) = {app: "vocabulary-ieltsprep", v: 1, saved, data:
     {"ielts:data", "ielts:study", "ielts:ui"}} con appProperties {hash}. Nunca lleva ielts:on, ielts:run:*,
     ielts:draft:*, ielts:mig:* ni ielts:sync (ni, de ielts:study, la sesión de repaso a medias y su marca mig; ni, de cada
     test, attempt y counted, que js/ielts.js vuelve a contar en orden). Se sincroniza al abrir index.html (si hay permiso; si no, en cuanto lo
     hay, mirando cada minuto), al esconderse la página si algo cambió, unos 20 s después de que otra pestaña (ielts.html)
     cambie una de esas claves y al volver la conexión. Nunca pide permiso ni enseña nada al niño; un fallo solo queda
     en "ielts:sync" ({fileId, lastHash, lastSync, err, errAt, linked, full}: de este aparato, no se sube ni va en la copia
     de Settings › Your data).
     Mezcla por registro (merge(), pura, con las mismas reglas que el «Restore» de js/ielts.js): lecciones, la de at
     más nuevo; tests, por lid+at (y los borrados, ielts:data.gone, no vuelven; si cambia la lista, attempt y counted se
     quitan y js/ielts.js los vuelve a contar en orden); textos, por id, el de at más nuevo; speaking, por iid (o
     title)+at; tarjetas del repaso, la de last más nuevo; el cuaderno (log) y la calibración, por q+at e iid+x+at;
     la fecha del examen, la de examAt más nuevo (la hora en que se puso o se quitó; una copia de antes de examAt con
     fecha cuenta con su at); ielts:ui entero, el de at más nuevo; la sesión de repaso a medias y la marca mig de
     ielts:study son de este aparato. Empate: lo de aquí. Nunca se pisa una copia de
     una versión más nueva (v > 1, aquí o en Drive) ni se sube sin haber mezclado antes lo que hay en Drive; un estado
     vacío no se sube sobre uno lleno salvo tras «Erase my progress» (ielts:data.erased = la hora), y ese borrado solo
     cuenta si se hizo con este aparato ya enlazado (después de linked; uno de antes se queda en este aparato): entonces
     lo de antes de esa hora se olvida también en Drive y en los otros aparatos, también en uno que se enlace después
     (como en Tech Prep); en esos aparatos se van además sus ielts:run:* e ielts:draft:* de antes de esa hora
     (dropBefore: una lección terminada sin hora, de un reproductor viejo, lleva la de su resultado en este aparato), así
     que el mazo de js/ielts-study.js, que se monta una vez por aparato con las lecciones terminadas antes de esta
     versión (ielts:mig:deck, que no viaja), nunca se rehace con lecciones borradas.
   API: window.vocabIelts = {on(), setOn(v), enter(from), menuItem(), adultHtml(), sync: {now(), merge(a, b, ea, eb),
   hash(), payload(), state()}}. */
(() => {
"use strict";
const W = window, D = document;
const ON = "ielts:on", IN = "ielts:in";
const on = () => { try{ return localStorage.getItem(ON) === "true"; }catch(e){ return false; } };
function setOn(v){
  try{ if(v) localStorage.setItem(ON, "true"); else { localStorage.removeItem(ON); sessionStorage.removeItem(IN); } }catch(e){}
  try{ renderLangs(); }catch(e){}
  if(v) syncSoon(1500);
}
async function enter(from){
  if(!on()) return false;
  if(typeof W.adultGate !== "function") return false;
  let ok = false;
  try{ ok = await W.adultGate({reason: "Para entrar en IELTS Prep.", from: from && from.nodeType === 1 ? from : null}); }catch(e){ ok = false; }
  if(!ok) return false;
  try{ sessionStorage.setItem(IN, "1"); }catch(e){}
  location.href = "ielts.html";
  return true;
}
function menuItem(){
  if(!on()) return "";
  return `<button type="button" class="lm-i lm-tp" role="menuitem" data-ielts-entry tabindex="-1" lang="en-GB">
    <span class="flag tp-flag" aria-hidden="true">${ico("graduation-cap", "fill", 18)}</span><span class="lm-t">IELTS Prep<small>Academic · band 9</small></span></button>`;
}
function adultHtml(){
  return `<section class="st-sec" id="aj-ie" aria-label="IELTS Prep"><div class="st-g ics">
      <label class="st-r" for="aj-ie-on"><span class="st-ic tl" aria-hidden="true">${ico("graduation-cap", "bold", 18)}</span>
        <span class="st-l"><span lang="en-GB">IELTS Prep</span><small>Preparar el IELTS Academic para un C2, en inglés. En este aparato y, con Google conectado, con copia en Drive.</small></span>
        <input type="checkbox" role="switch" class="st-sw" id="aj-ie-on" ${on() ? "checked" : ""}></label>
    </div></section>`;
}
bus.on("settings", d => {
  if(!d || d.page !== "mayores" || !d.el) return;
  const sw = d.el.querySelector("#aj-ie-on"); if(!sw) return;
  sw.checked = on();
  sw.onchange = () => { setOn(sw.checked); try{ if(W.G && typeof G.haptic === "function") G.haptic("selection"); }catch(e){} };
});

/* ---------- la copia en Google Drive ---------- */
const FILE = "vocabulary-ieltsprep.json", APP = "vocabulary-ieltsprep", SYNC = "ielts:sync";
const PK = "ielts:data", SK = "ielts:study", UK = "ielts:ui", KEYS = [PK, SK, UK];
const LOG_MAX = 3000, CAL_MAX = 200, GONE_MAX = 500;
const now = () => Date.now();
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const arr = v => Array.isArray(v) ? v.filter(isObj) : [];
const online = () => navigator.onLine !== false;
function cyrb53(str){
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for(let i = 0; i < str.length; i++){ const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}
/* JSON con las claves ordenadas (la misma huella en todos los aparatos) */
function canon(v){
  if(Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if(isObj(v)) return `{${Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",")}}`;
  return JSON.stringify(v === undefined ? null : v);
}
function syncGet(){ try{ const o = JSON.parse(localStorage.getItem(SYNC)); return isObj(o) ? o : {}; }catch(e){ return {}; } }
function syncSet(p){ const o = Object.assign(syncGet(), p); try{ localStorage.setItem(SYNC, JSON.stringify(o)); }catch(e){} return o; }
/* lo de este aparato: {ok, data: {clave: objeto}}; ok = false si ielts:data está dañado o es de una versión más nueva
   (entonces no se sincroniza: js/ielts.js lo guarda aparte o lo deja solo, y nada se pisa) */
function local(){
  const data = {};
  for(const k of KEYS){
    let raw = null; try{ raw = localStorage.getItem(k); }catch(e){ return {ok: false, data}; }
    if(raw == null) continue;
    let o; try{ o = JSON.parse(raw); }catch(e){ return {ok: false, data}; }
    if(!isObj(o) || (k !== UK && o.v !== 1)) return {ok: false, data};
    data[k] = o;
  }
  return {ok: true, data};
}
/* lo que viaja: sin lo que es solo de este aparato (la sesión de repaso a medias y la marca mig de ielts:study) ni lo que
   js/ielts.js vuelve a calcular en orden (attempt y counted de cada test): dos aparatos con lo mismo, la misma huella */
function wire(d){
  const o = Object.assign({}, d);
  if(isObj(o[PK]) && Array.isArray(o[PK].tests)) o[PK] = Object.assign({}, o[PK], {tests: o[PK].tests.map(t => {
    if(!isObj(t)) return t; const r = Object.assign({}, t); delete r.attempt; delete r.counted; return r; })});
  if(isObj(o[SK])){ const st = Object.assign({}, o[SK]); delete st.session; delete st.mig; o[SK] = st; }
  return o;
}
const hashOf = data => cyrb53(canon(wire(data)));
const hash = () => hashOf(local().data);
const recs = d => !!d && ((isObj(d[PK]) && (Object.keys(isObj(d[PK].lessons) ? d[PK].lessons : {}).length || ["tests", "essays", "speaking"].some(k => arr(d[PK][k]).length)))
  || (isObj(d[SK]) && (Object.keys(isObj(d[SK].cards) ? d[SK].cards : {}).length || arr(d[SK].log).length)));
const tkey = t => `${t.lid}|${+t.at || 0}`;
const at = r => +(isObj(r) && r.at) || 0;
/* dos copias de ielts:data. ea, eb: el borrado que cuenta de cada lado (0: ninguno). El lado con el borrado más nuevo
   se queda con todo lo suyo; del otro solo pasa lo posterior a ese borrado */
function mergeData(a, b, ea, eb){
  a = isObj(a) ? a : {v: 1}; b = isObj(b) ? b : {v: 1};
  const E = Math.max(ea, eb), okA = r => ea >= eb || at(r) > E, okB = r => eb >= ea || at(r) > E;
  const out = Object.assign({}, b, a, {v: 1});
  delete out.erased; if(E) out.erased = E;
  const lessons = {};
  for(const [lid, r] of Object.entries(isObj(a.lessons) ? a.lessons : {})) if(isObj(r) && okA(r)) lessons[lid] = r;
  for(const [lid, r] of Object.entries(isObj(b.lessons) ? b.lessons : {})) if(isObj(r) && okB(r) && (!lessons[lid] || at(r) > at(lessons[lid]))) lessons[lid] = r;
  out.lessons = lessons;
  const gone = new Map();
  for(const g of [...arr(a.gone), ...arr(b.gone)]) if(g.lid != null) gone.set(tkey(g), {lid: g.lid, at: +g.at || 0, del: Math.max(+g.del || 0, (gone.get(tkey(g)) || {}).del || 0)});
  if(gone.size) out.gone = [...gone.values()].sort((x, y) => x.del - y.del).slice(-GONE_MAX); else delete out.gone;
  const union = (xs, ys, key) => { const m = new Map(); for(const x of xs) m.set(key(x), x); for(const y of ys) if(!m.has(key(y))) m.set(key(y), y); return [...m.values()].sort((x, y) => at(x) - at(y)); };
  const tA = arr(a.tests).filter(okA), tests = union(tA, arr(b.tests).filter(okB), tkey).filter(t => !gone.has(tkey(t)));
  /* otra lista de tests: el número de intento y si cuenta se vuelven a calcular en js/ielts.js, en orden */
  const same = tests.length === tA.length && tests.every(t => tA.includes(t));
  out.tests = same ? tests : tests.map(t => { const r = Object.assign({}, t); delete r.attempt; delete r.counted; return r; });
  const es = new Map();
  for(const e of arr(a.essays).filter(okA)) es.set(e.id, e);
  for(const e of arr(b.essays).filter(okB)){ const c = es.get(e.id); if(!c || at(e) > at(c)) es.set(e.id, e); }
  out.essays = [...es.values()].sort((x, y) => at(x) - at(y));
  out.speaking = union(arr(a.speaking).filter(okA), arr(b.speaking).filter(okB), s => `${s.iid || s.title || ""}|${at(s)}`);
  return out;
}
/* dos copias de ielts:study (js/ielts-study.js): tarjetas por last, cuaderno y calibración unidos, sesión y mig de aquí */
function mergeStudy(a, b, ea, eb){
  if(!isObj(b)){ if(!(eb > ea)) return a; b = {v: 1}; }   /* Drive has none after an erase: what came before it goes here too */
  const A = isObj(a) ? a : {v: 1}, E = Math.max(ea, eb);
  const okA = t => ea >= eb || t > E, okB = t => eb >= ea || t > E;
  const out = Object.assign({}, b, A, {v: 1});
  out.session = isObj(a) && isObj(a.session) && okA(+a.session.at || 0) ? a.session : null;
  if(isObj(a) && a.mig) out.mig = a.mig; else delete out.mig;
  const cards = {};
  for(const [q, c] of Object.entries(isObj(A.cards) ? A.cards : {})) if(isObj(c) && okA(+c.last || 0)) cards[q] = c;
  for(const [q, c] of Object.entries(isObj(b.cards) ? b.cards : {})) if(isObj(c) && okB(+c.last || 0) && (!cards[q] || (+c.last || 0) > (+cards[q].last || 0))) cards[q] = c;
  out.cards = cards;
  const join = (xs, ys, key, max) => { const m = new Map(); for(const x of xs) m.set(key(x), x); for(const y of ys) if(!m.has(key(y))) m.set(key(y), y); return [...m.values()].sort((x, y) => at(x) - at(y)).slice(-max); };
  out.log = join(arr(A.log).filter(e => okA(at(e))), arr(b.log).filter(e => okB(at(e))), e => `${e.q}|${at(e)}`, LOG_MAX);
  out.calib = join(arr(A.calib).filter(e => okA(at(e))), arr(b.calib).filter(e => okB(at(e))), e => `${e.iid}|${e.x || 0}|${at(e)}`, CAL_MAX);
  /* la fecha del examen, por su propia hora (examAt: al ponerla o quitarla, js/ielts-study.js) y nunca por el at de la
     copia, que cambia con cada repaso: una fecha quitada o cambiada en un aparato no vuelve desde otro. Una copia de
     antes de examAt con fecha cuenta con su at (la regla con la que se escribió) */
  const exT = s => +s.examAt || (isObj(s.exam) ? at(s) : 0);
  const ex = [[A, exT(A), okA], [b, exT(b), okB]].filter(([, t, ok]) => ok(t)).sort((x, y) => y[1] - x[1])[0];
  out.exam = ex && isObj(ex[0].exam) ? ex[0].exam : null;
  if(ex && ex[1]) out.examAt = ex[1]; else delete out.examAt;
  out.at = Math.max(at(A), at(b)) || undefined;
  if(out.at === undefined) delete out.at;
  return out;
}
/* la mezcla de todo: a = lo de aquí, b = lo de Drive ({clave: objeto}); pura (no toca a ni b) */
function merge(a, b, ea = 0, eb = 0){
  a = isObj(a) ? a : {}; b = isObj(b) ? b : {};
  const out = {};
  if(a[PK] || b[PK]) out[PK] = mergeData(a[PK], b[PK], ea, eb);
  if(a[SK] || b[SK]){ const s = mergeStudy(a[SK], b[SK], ea, eb); if(s !== undefined) out[SK] = s; }
  const ua = a[UK], ub = b[UK];
  if(ua || ub) out[UK] = !isObj(ua) || (isObj(ub) && at(ub) > at(ua)) ? ub : ua;
  return out;
}
/* tras un «Erase» de otro aparato (a la hora e): las lecciones a medias o terminadas (ielts:run:*) y los borradores
   (ielts:draft:*) de aquí guardados antes de e, o sin hora, se van, como en el aparato que borró: ni «Continue» ni el
   mazo ni los resultados vuelven a traer lo borrado. Lo guardado después de e se queda. Los reproductores de antes de
   esta versión no ponían hora (run.at) a sus lecciones: una terminada lleva la de su resultado en este aparato (mine =
   ielts:data de aquí antes de mezclar: un resultado de otro aparato no dice cuándo se hizo esta), y una a medias con un
   texto escrito (un Task 1 o 2 que no está en ninguna otra parte) se queda */
const wrote = v => isObj(v.ans) && Object.values(v.ans).some(a => typeof a === "string" && a.trim().split(/\s+/).length >= 8);
function dropBefore(e, mine){
  const ls = isObj(mine) && isObj(mine.lessons) ? mine.lessons : {};
  let ks = []; try{ ks = Object.keys(localStorage); }catch(err){ return; }
  for(const k of ks) if(k.startsWith("ielts:run:") || k.startsWith("ielts:draft:")){
    let v = null; try{ v = JSON.parse(localStorage.getItem(k)); }catch(err){}
    let t = isObj(v) ? +v.at || 0 : 0;
    if(!t && isObj(v) && k.startsWith("ielts:run:")){
      if(v.finished) t = at(ls[k.slice(10)]);
      else if(wrote(v)) continue;
    }
    if(!(t > e)){ try{ localStorage.removeItem(k); }catch(err){} }
  }
}
/* el borrado de este aparato que cuenta: solo uno hecho ya enlazado con Drive (uno de antes es solo historia de aquí) */
const erasedHere = (d, st) => { const e = isObj(d[PK]) ? +d[PK].erased || 0 : 0; return e && st.linked && e > st.linked ? e : 0; };

const vs = () => { const S = W.vocabSync; return S && typeof S.file === "function" && typeof S.connected === "function" && typeof S.tokOk === "function" ? S : null; };
const ready = () => { const S = vs(); return !!(on() && S && S.connected() && online() && S.tokOk()); };
const dirty = () => { const L = local(); return L.ok && hashOf(L.data) !== syncGet().lastHash; };
let syncP = null, again = false, syncT = 0, booted = false;
function syncSoon(ms = 20000){ clearTimeout(syncT); syncT = setTimeout(() => { syncT = 0; sync("change"); }, ms); }
function sync(why){
  if(!ready()) return Promise.resolve(false);
  if(syncP){ again = true; return syncP; }
  syncP = (async () => {
    const S = vs(), F = S.file(FILE), st = syncGet();
    try{
      /* un «Erase» de antes de enlazar este aparato solo fue de aquí: no viaja (no borraría lo de los otros aparatos) */
      if(!st.linked){ const L0 = local(), p = L0.ok && L0.data[PK]; if(isObj(p) && p.erased){ const q = Object.assign({}, p); delete q.erased; try{ localStorage.setItem(PK, JSON.stringify(q)); }catch(e){} } }
      let id = st.fileId || null, m = null, rd = null;
      if(id){ try{ m = await F.meta(id); }catch(e){ if(e && e.code === "gone"){ id = null; m = null; } else throw e; } }
      if(!id){ m = await F.find(); id = m ? m.id : null; }
      const rh = m && m.appProperties && m.appProperties.hash || "";
      if(m && rh !== st.lastHash){
        const body = await F.download(id);
        /* de una versión más nueva de la app, o algo que no es esta copia: no se mezcla ni se pisa */
        if(!isObj(body) || body.app !== APP || !(body.v === 1) || !isObj(body.data)) throw Object.assign(new Error("newer"), {code: isObj(body) && body.v > 1 ? "newer" : "bad"});
        rd = body.data;
        if(isObj(rd[PK]) && rd[PK].v !== 1) throw Object.assign(new Error("newer"), {code: "newer"});
        const L = local(); if(!L.ok) throw Object.assign(new Error("local"), {code: "local"});
        /* sin esperas entre leer y escribir: nada de lo que se guarda aquí mientras tanto se pierde */
        const er = isObj(rd[PK]) ? +rd[PK].erased || 0 : 0, mg = merge(L.data, rd, erasedHere(L.data, st), er);
        /* un «Erase» de otro aparato, más nuevo que el último de aquí: se van también las lecciones de antes (dropBefore,
           con los resultados de aquí de antes de mezclar), y el mazo no las vuelve a traer */
        const erNew = er > (isObj(L.data[PK]) ? +L.data[PK].erased || 0 : 0);
        for(const k of KEYS) if(mg[k] !== undefined && canon(mg[k]) !== canon(L.data[k])){ try{ localStorage.setItem(k, JSON.stringify(mg[k])); }catch(e){ throw Object.assign(new Error("full"), {code: "full"}); } }
        if(erNew) dropBefore(er, L.data[PK]);
      }
      const L = local(); if(!L.ok) throw Object.assign(new Error("local"), {code: "local"});
      const h = hashOf(L.data);
      if(!m || h !== rh){
        /* nunca un estado vacío sobre uno lleno (salvo un borrado de verdad, que lleva su hora) */
        if(m && !recs(L.data) && !erasedHere(L.data, st) && (rd ? recs(rd) : st.full !== false)) throw Object.assign(new Error("empty"), {code: "empty"});
        if(!m && !Object.keys(L.data).length){ syncSet({lastHash: h, lastSync: now(), err: ""}); return true; }   /* nada que copiar todavía */
        const r = await F.upload(id, {app: APP, v: 1, saved: new Date(now()).toISOString(), data: wire(L.data)}, {hash: h}, {keepalive: why === "hide"});
        id = r && r.id || id;
      }
      syncSet({fileId: id, lastHash: h, lastSync: now(), err: "", linked: st.linked || now(), full: !!recs(L.data)});
      return true;
    }catch(e){ syncSet({err: e && e.code || "net", errAt: now()}); return false; }
  })().finally(() => { syncP = null; if(again){ again = false; syncSoon(1500); } });
  return syncP;
}
function boot(){ if(booted || !ready()) return; booted = true; sync("boot"); }
D.addEventListener("visibilitychange", () => {
  if(D.visibilityState === "hidden"){ if(ready() && dirty()){ clearTimeout(syncT); syncT = 0; sync("hide"); } }
  else if(ready()) sync("visible");
});
addEventListener("online", () => { if(!booted) boot(); else if(dirty()) syncSoon(1500); });
/* lo de otra pestaña (ielts.html): unos 20 s después del último cambio */
addEventListener("storage", e => {
  if(e.key === ON || e.key === null){ try{ renderLangs(); }catch(err){} }
  if(e.key === null || KEYS.includes(e.key)) syncSoon(20000);
});
/* el permiso puede llegar más tarde (con un toque del niño): se mira cada minuto si falta la primera vez o algo por subir */
setInterval(() => { if(D.visibilityState !== "hidden" && !syncP && !syncT && ready() && (!booted || dirty())){ booted = true; sync("poll"); } }, 60e3);
setTimeout(boot, 4000);   /* al abrir la app, sin estorbar a lo primero que pinta */
const state = () => Object.assign({}, syncGet(), {connected: !!(vs() && vs().connected()), on: on(), dirty: dirty()});
W.vocabIelts = {on, setOn, enter, menuItem, adultHtml,
  sync: Object.freeze({now: () => sync("manual"), merge, hash, payload: () => wire(local().data), state})};
})();
