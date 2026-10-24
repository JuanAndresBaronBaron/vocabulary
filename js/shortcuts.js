/* módulo shortcuts: «Tus atajos» de Hoy, que se registran solos (plan-doc «Atajos que se registran solos»; SPEC §6 F5).
   - Qué cuenta: solo cosas concretas con su enlace directo, nunca una pestaña entera:
       un juego con su tema («Globos · Animales» → #/juegos/globos?t=animales; Oído de lince no tiene tema),
       un tema en un modo («Comida · Tarjetas» → #/doc/w03?m=tarjetas; Tarjetas, Preguntas o Escribir),
       una unidad de gramática («Gramática · El verbo to be» → #/leccion/G-A1-01),
       un cuento del zorro abierto («Cuento · A jugar» → #/cuento/en-play; js/stories.js),
       y lo que dejó a medias (una lección guardada o un repaso abierto, lo mismo que el accesorio «Seguir», y una
       práctica de Escribir tocada en los últimos 3 días), que sale primero con un anillo de progreso. Si la tarjeta
       principal de Hoy ya ofrece eso mismo, no se repite; si lo enseña la fila, el accesorio no sale en Hoy (covers()).
       Una lección o un repaso a medias solos no hacen fila (para eso ya está el accesorio); la práctica, sí.
   - Puntos: cada vez que termina algo suma 1 punto a esa clave, y los puntos valen la mitad cada 7 días (se guardan el
     punto y el día, sin horas). Entra con 2 puntos o más. Lo que termina: bus "game-done" {game, tp} · "doc-done"
     {id, mode: test|practica} (fin de Preguntas o de Escribir) · "doc-flip" {id, i, n} (Tarjetas: 8 tarjetas distintas
     giradas en una visita, o todas si hay menos) · "lesson-done" con grammar (una unidad de gramática) · "story-done"
     {id} (un cuento leído hasta el final). "answer" con
     where "practice" apunta qué práctica está a medias (y "doc-done" de Escribir la quita); la lección y el repaso a
     medias se miran al pintar Hoy (accState() de index.html), así que lo terminado ya no sale.
   - Cuántos: hasta 3 en el móvil y 4 en tableta (ancho ≥ 744 px). Cada atajo conserva su sitio (vocab:sc.row): uno
     nuevo solo entra si supera en un 20 % al que saldría. El primer día (store "act" sin días de antes) no hay fila.
   - Fila en Hoy (paint(), la llama home() de index.html): entre las dos piezas y los HOME_SLOTS; piezas sólidas con una
     sola regla: el dibujo grande es qué se hace (el dibujo del juego; el icono del modo con tinte; la gramática o la
     lección, su dibujo sobre una ficha gris) y la insignia, de qué tema; debajo, dos líneas: «Globos» / «Animales» (el
     nombre corto del tema; el entero va en aria-label). Cada una, un enlace de 56 px o más con data-key 1-4
     (js/keys.js). Mantener pulsada una pieza (G.hold: se hunde y crece al cumplirse) o «Editar» (al final de la
     cabecera de la sección) abre una hoja con «Fijar» ↔ «Fijado» (conmutador) y «No sugerir» (30 días; M.toast «Ya no
     sale en Hoy» con «Deshacer» 9 s). Hoy sigue sin scroll: con la fila, en el móvil (< 744 px) homeSlots() deja 1 HOME_SLOT
     (wantsRow()) y, si aun así no cabe, fit() quita los HOME_SLOTS que sobren, del último al primero (la fila manda,
     salvo ante una carta sin abrir); en un móvil muy bajo compacta la fila y, como último recurso, la quita.
     html[data-sc] = cuántas piezas enseña.
   - «¿Lo pongo siempre despacio?»: si de las últimas 20 escuchas tocadas (altavoces y tortugas) el 60 % o más fueron
     con la tortuga, el zorro lo pregunta una vez en Hoy. «Sí, despacio» pone la velocidad «Lenta» del ajuste de siempre
     (store "rate", Ajustes › Voz y velocidad). Nunca cambia nada sin preguntar.
   - Para mayores (Ajustes): interruptor «Atajos automáticos» (apagado: ni fila ni registro ni pregunta) y «Olvidar lo
     aprendido» (borra solo vocab:sc; las palabras, el progreso, los fijados y los ocultos se quedan). adultHtml() lo
     pinta js/settings.js.
   Guardado:
     localStorage "vocab:sc" (solo este aparato: DEVICE_ONLY en js/save.js; no se exporta ni se sube) =
       {v: 1, k: {clave: {s: puntos, t: día}} (60 claves como mucho; se quitan las de menos puntos), row: {en|fr|da:
       [clave | null, …]} (el sitio de cada atajo), o: {clave: día} (prácticas a medias), sl: "0101…" (últimas 20
       escuchas: 1 = tortuga)}. Día = today() de index.html (días desde 1970, hora local), nunca la hora.
     localStorage "sc:prefs" (EXACT en js/save.js: se exporta y se sincroniza; solo se escribe cuando el niño o un mayor
       cambian algo) = {pinned: [clave…], hidden: {clave: hasta el día}, off: bool, slowAsked: bool}.
     Clave = "<en|fr|da>/juego:<juego>[:<tema>]" · "<en|fr|da>/tema:<doc>:<modo>" · "<en|fr|da>/gram:<G-A1-02>" ·
       "<en|fr|da>/cuento:<id del cuento>".
   API: window.vocabShortcuts = {wantsRow(), paint(), covers(st), suggest(), log(clave), points(clave), keys, prefs(),
     pin(clave, on), hide(clave) → deshacer, unhide(clave), setOff(off), forget(), openEdit(desde), openItem(clave,
     desde), closeSheet(), askSlow(forzar), slowWanted(), adultHtml(), fit(soft), SC, PREFS, shown (claves en la fila)}. */
(() => {
"use strict";
const D = document, W = window, ROOT = D.documentElement;
const SC = "vocab:sc", PREFS = "sc:prefs";
const MIN = 2, HALF_LIFE = 7, BEAT = 1.2, MAX_KEYS = 60, HIDE_DAYS = 30, MAX_PIN = 3, OPEN_DAYS = 3, UNDO_MS = 9000;
const SLOW_N = 20, SLOW_P = .6, SLOW_RATE = .7, CARDS_MIN = 8;
const TABLET = matchMedia("(min-width:744px)");
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const h = s => typeof esc === "function" ? esc(s) : String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const IC = (n, s = "bold", z = 20, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
const day = () => { try{ if(typeof today === "function") return today(); }catch(e){} const d = new Date(); return Math.floor((d - d.getTimezoneOffset() * 6e4) / 864e5); };
const ab = () => { try{ return (typeof CLIP_AB !== "undefined" && CLIP_AB[lang]) || "en"; }catch(e){ return "en"; } };
const hp = () => typeof hashPath === "function" ? hashPath() : location.hash.replace(/^#\/?/, "").split("?")[0];
const onHoy = () => hp() === "";
const r3 = x => Math.round(x * 1000) / 1000;
const haptic = t => { try{ if(W.G && typeof G.haptic === "function") G.haptic(t || "selection"); }catch(e){} };
const toast = (t, o) => { try{ if(W.M && typeof M.toast === "function") M.toast(t, o || {}); }catch(e){} };

/* ---------- lo guardado ---------- */
function scGet(){
  let o = null;
  try{ o = JSON.parse(localStorage.getItem(SC)); }catch(e){ o = null; }
  const out = {v: 1, k: {}, row: {}, o: {}, sl: ""};
  if(!isObj(o)) return out;
  if(isObj(o.k)) for(const [k, e] of Object.entries(o.k)) if(isObj(e) && Number.isFinite(+e.s) && Number.isFinite(+e.t) && +e.s > 0) out.k[k] = {s: +e.s, t: Math.round(+e.t)};
  if(isObj(o.row)) for(const [l, a] of Object.entries(o.row)) if(Array.isArray(a)) out.row[l] = a.slice(0, 4).map(k => typeof k === "string" ? k : null);
  if(isObj(o.o)) for(const [k, d] of Object.entries(o.o)) if(Number.isFinite(+d)) out.o[k] = Math.round(+d);
  if(typeof o.sl === "string") out.sl = o.sl.replace(/[^01]/g, "").slice(-SLOW_N);
  return out;
}
function scSet(o){ try{ localStorage.setItem(SC, JSON.stringify(o)); }catch(e){} }
function prefs(){
  let p = null;
  try{ p = JSON.parse(localStorage.getItem(PREFS)); }catch(e){ p = null; }
  const out = {pinned: [], hidden: {}, off: false, slowAsked: false};
  if(!isObj(p)) return out;
  if(Array.isArray(p.pinned)) out.pinned = [...new Set(p.pinned.filter(k => typeof k === "string" && k.length < 120))];
  if(isObj(p.hidden)) for(const [k, d] of Object.entries(p.hidden)) if(Number.isFinite(+d)) out.hidden[k] = Math.round(+d);
  out.off = p.off === true; out.slowAsked = p.slowAsked === true;
  return out;
}
function prefsSet(p){
  const d = day(), hidden = {};
  for(const [k, u] of Object.entries(p.hidden || {})) if(u > d) hidden[k] = u;   /* los ocultos que ya vencieron, fuera */
  try{ localStorage.setItem(PREFS, JSON.stringify({pinned: p.pinned || [], hidden, off: !!p.off, slowAsked: !!p.slowAsked})); }catch(e){}
}

/* ---------- puntos ---------- */
const pts = (e, d = day()) => e && e.s > 0 ? e.s * Math.pow(.5, Math.max(0, d - e.t) / HALF_LIFE) : 0;
const keys = {
  game: (g, tp) => `${ab()}/juego:${g}${tp ? ":" + tp : ""}`,
  doc: (id, m) => `${ab()}/tema:${id}:${m}`,
  gram: id => `${ab()}/gram:${id}`,
};
function log(key, n = 1){
  if(!key || prefs().off) return 0;
  const o = scGet(), d = day(), p = r3(pts(o.k[key], d) + n);
  o.k[key] = {s: p, t: d};
  /* 60 claves como mucho: se van las de menos puntos de las demás (la que acaba de sumar se queda siempre) */
  const ks = Object.keys(o.k);
  if(ks.length > MAX_KEYS){
    const others = ks.filter(k => k !== key).sort((a, b) => pts(o.k[a], d) - pts(o.k[b], d));
    others.slice(0, ks.length - MAX_KEYS).forEach(k => { delete o.k[k]; });
  }
  scSet(o);
  return p;
}
const points = key => pts(scGet().k[key]);
/* el primer día de la app (ningún día de actividad antes de hoy) no hay fila */
function firstDay(){
  let a = {}; try{ a = typeof store !== "undefined" ? store.get("act", {}) || {} : {}; }catch(e){ a = {}; }
  const t = typeof dayKey === "function" ? dayKey(new Date()) : new Date().toLocaleDateString("sv");
  return !Object.keys(a).some(k => k < t);
}

/* ---------- de una clave a su atajo ---------- */
/* cada pieza dice dos cosas: qué se hace (el dibujo grande y la 1.ª línea: «Globos», «Tarjetas», «Gramática», «Seguir»)
   y de qué (la insignia y la 2.ª línea, con un nombre corto: «Animales», «Cuerpo», «To be») */
const GSHORT = {lluvia: "Lluvia", letras: "Letras", lince: "Lince"};
const IMG_GRAM = "img/om_1F4D6.png", IMG_LES = "img/om_1F393.png";
const cap1 = t => t ? t[0].toUpperCase() + t.slice(1) : t;
/* «El cuerpo y la salud» → «Cuerpo»; «Ideas y conceptos (2)» → «Ideas 2»; «Números (0–110)» → «Números» */
function short(t){
  let x = String(t || "").trim(), n = "";
  const m = /\s*\(([^)]*)\)$/.exec(x);
  if(m){ if(/^\d+$/.test(m[1])) n = " " + m[1]; x = x.slice(0, m.index); }
  x = x.split(/:|,| y | e /)[0].trim().replace(/^(el|la|los|las|le|les|l')\s*/i, "");
  return cap1(x) + n;
}
/* «El verbo to be» → «To be»; «Presente simple: afirmativa» → «Presente simple»; «Can y can't» → «Can y can't» */
function shortGram(t){
  let x = String(t || "").trim().replace(/^(el|la|los|las) (verbo |verbos )?/i, "");
  x = x.split(/:| \(/)[0].trim();
  return cap1(x);
}
const MODE_T = {tarjetas: "Tarjetas", test: "Preguntas", practica: "Escribir"};
const MODE_IC = {tarjetas: "cards", test: "question", practica: "pencil-simple"};
function parse(key){
  const m = /^([a-z]{2})\/(juego|tema|gram|cuento):([^:]+)(?::([^:]+))?$/.exec(String(key || ""));
  return m ? {l: m[1], type: m[2], a: m[3], b: m[4] || ""} : null;
}
function docMeta(id){
  try{ return (typeof INDEX !== "undefined" && Array.isArray(INDEX) ? INDEX : []).find(d => d && d.id === id) || null; }catch(e){ return null; }
}
function resolve(key){
  const k = parse(key); if(!k || k.l !== ab()) return null;
  if(k.type === "juego"){
    const VG = W.vocabGames; if(!VG || typeof VG.meta !== "function") return null;
    const g = VG.meta(k.a); if(!g) return null;
    let tp = null;
    if(g.topic){ tp = k.b && typeof VG.topic === "function" ? VG.topic(k.b) : null; if(!tp) return null; }
    else if(k.b) return null;
    return {key, type: "juego", href: `#/juegos/${encodeURIComponent(g.id)}${tp ? "?t=" + encodeURIComponent(tp.id) : ""}`, t: g.t,
      name: tp ? tp.name : GSHORT[g.id] || g.t, act: GSHORT[g.id] || g.t, top: tp ? short(tp.name) : "Juego",
      sub: tp ? tp.name : "Juego", label: tp ? `${g.t} · ${tp.name}` : g.t, img: g.img, badge: tp ? {img: tp.img} : null, game: true};
  }
  if(k.type === "tema"){
    const meta = docMeta(k.a), mt = MODE_T[k.b];
    if(!meta || !mt || !(meta.langs || []).includes(lang)) return null;
    let pic = "img/om_1F4D6.png"; try{ if(W.vocabLearn && typeof vocabLearn.topicPic === "function") pic = vocabLearn.topicPic(meta); }catch(e){}
    return {key, type: "tema", href: `#/doc/${encodeURIComponent(meta.id)}?m=${k.b}`, t: meta.title, name: meta.title, act: mt, top: short(meta.title),
      sub: mt, label: `${meta.title} · ${mt}`, ic: MODE_IC[k.b], tone: "soft", badge: {img: pic}};
  }
  if(k.type === "gram"){
    const m = /^G-([A-C][12])-(\d{2})$/.exec(k.a);
    let x = null; try{ x = m && typeof GRAM !== "undefined" ? ((GRAM[lang] || {})[m[1]] || [])[+m[2] - 1] : null; }catch(e){ x = null; }
    if(!x || !x.t) return null;
    return {key, type: "gram", href: `#/leccion/${k.a}`, t: "Gramática", name: x.t, act: "Gramática", top: shortGram(x.t), sub: x.t, label: `Gramática · ${x.t}`,
      img: IMG_GRAM, plate: true};
  }
  if(k.type === "cuento"){   /* un cuento del zorro (js/stories.js): solo si está abierto */
    const it = W.vocabStories && typeof vocabStories.shortcut === "function" ? vocabStories.shortcut(k.a) : null;
    return it ? Object.assign({}, it, {key, type: "cuento"}) : null;
  }
  return null;
}

/* ---------- lo que dejó a medias ---------- */
/* lo que ofrece la tarjeta principal de Hoy (la misma regla que nextAction() de index.html) */
async function cardOffer(){
  try{
    if(typeof dueList === "function" && dueList().length >= 10) return {kind: "repaso"};
    const L = typeof nextLesson === "function" ? await nextLesson() : null;
    return L && !L.done && L.l ? {kind: "leccion", id: L.l.id} : null;
  }catch(e){ return null; }
}
const sameOffer = (a, b) => !!(a && b && a.kind === b.kind && (a.kind === "repaso" || a.id === b.id));
async function halfItem(o, d){
  let st = null;
  try{ st = typeof accState === "function" ? await accState() : null; }catch(e){ st = null; }
  if(st && (st.kind === "repaso" || st.kind === "leccion") && !sameOffer(st, await cardOffer()))
    return {half: true, kind: st.kind, id: st.id || "", href: st.href, t: st.label, name: st.label, act: "Seguir", top: st.label, sub: "Seguir", p: +st.p || 0, label: st.aria,
      img: st.kind === "repaso" ? "" : st.label === "Gramática" ? IMG_GRAM : IMG_LES, plate: true, ic: "arrow-counter-clockwise"};
  /* una práctica de Escribir a medias (pr:<tema>:<idioma>, js/learn.js), tocada en los últimos 3 días */
  let best = null;
  for(const [k, dd] of Object.entries(o.o)){
    const x = parse(k);
    if(!x || x.type !== "tema" || x.b !== "practica" || x.l !== ab() || d - dd > OPEN_DAYS) continue;
    let s = null; try{ s = store.get(`pr:${x.a}:${lang}`, null); }catch(e){ s = null; }
    if(!isObj(s) || !Array.isArray(s.words) || !s.words.length || !(+s.reps > 0) || !s.words.some(w => (+(w && w.n) || 0) < s.reps)) continue;
    const it = resolve(k); if(!it) continue;
    const p = s.words.reduce((a, w) => a + Math.min(+(w && w.n) || 0, s.reps), 0) / (s.words.length * s.reps);
    if(!best || dd > best.dd) best = {dd, it, p};
  }
  if(best) return Object.assign({}, best.it, {half: true, kind: "practica", id: best.it.key, act: "Seguir", sub: "Escribir", p: best.p, label: `Seguir: ${best.it.label}`});
  return null;
}

/* ---------- la fila: qué atajos y en qué sitio ---------- */
async function ready(){
  try{ await Promise.all([typeof getIndex === "function" ? getIndex() : null, typeof getMap === "function" ? getMap() : null,
    W.vocabStories && typeof vocabStories.ready === "function" ? vocabStories.ready().catch(() => null) : null]); }catch(e){}   /* los cuentos: para saber cuáles están abiertos */
}
async function compute(){
  const P = prefs(), n = TABLET.matches ? 4 : 3;
  if(P.off) return {n, half: null, items: []};
  await ready();
  const d = day(), o = scGet(), L = ab(), mine = k => typeof k === "string" && k.startsWith(L + "/");
  const half = await halfItem(o, d);
  const hidden = k => (P.hidden[k] || 0) > d;
  const pins = P.pinned.filter(k => mine(k) && !hidden(k));
  const cand = new Map();
  for(const k of pins){ const it = resolve(k); if(it) cand.set(k, {p: pts(o.k[k], d), pin: true, it}); }
  if(!firstDay()) for(const [k, e] of Object.entries(o.k)){
    if(cand.has(k) || !mine(k) || hidden(k)) continue;
    const p = pts(e, d); if(p < MIN) continue;
    const it = resolve(k); if(it) cand.set(k, {p, pin: false, it});
  }
  if(half && half.kind === "practica") cand.delete(half.id);   /* la práctica a medias ya sale primera */
  const cap = Math.max(0, n - (half ? 1 : 0)), prev = o.row[L] || [];
  const slots = prev.slice(0, cap).map(k => k && cand.has(k) ? k : null);
  while(slots.length < cap) slots.push(null);
  const has = k => slots.includes(k);
  const weakest = () => { let w = -1; slots.forEach((k, i) => { if(k && !cand.get(k).pin && (w < 0 || cand.get(k).p < cand.get(slots[w]).p)) w = i; }); return w; };
  /* los fijados siempre: en un hueco libre o en el sitio del más flojo que no esté fijado */
  for(const k of pins){ if(!cand.has(k) || has(k)) continue; let i = slots.indexOf(null); if(i < 0) i = weakest(); if(i < 0) break; slots[i] = k; }
  /* los demás, de más a menos puntos: llenan huecos y solo echan a uno si lo superan en un 20 % */
  const rest = [...cand.entries()].filter(([k, c]) => !c.pin && !has(k)).sort((a, b) => b[1].p - a[1].p);
  for(const [k, c] of rest){
    let i = slots.indexOf(null);
    if(i < 0){ const w = weakest(); if(w < 0 || !(c.p > BEAT * cand.get(slots[w]).p)) continue; i = w; }
    slots[i] = k;
  }
  if(JSON.stringify(prev) !== JSON.stringify(slots) && (slots.some(Boolean) || prev.some(Boolean))){ o.row[L] = slots; scSet(o); }
  const items = slots.map(k => k ? Object.assign({pinned: cand.get(k).pin, p: cand.get(k).p}, cand.get(k).it) : null);
  /* una lección o un repaso a medias solos no hacen fila: ya los ofrece el accesorio «Seguir» */
  return {n, half: half && half.kind !== "practica" && !items.some(Boolean) ? null : half, items};
}
let PENDING = null, TOK = 0, COVER = null, SHOWN = [], GEST = [];
/* ¿habrá fila? (homeSlots() de index.html: con fila, un solo HOME_SLOT). Deja el cálculo listo para paint() */
async function wantsRow(){
  try{ const r = await compute(); PENDING = r; return !!(r.half || r.items.some(Boolean)); }
  catch(e){ console.error(e); PENDING = null; return false; }
}
async function suggest(){ const r = await compute(); return [r.half, ...r.items].filter(Boolean).slice(0, r.n); }

/* ---------- pintar la fila en Hoy ---------- */
const clearGest = () => { GEST.forEach(off => { try{ off(); }catch(e){} }); GEST = []; };
function ring(p){
  const v = Math.max(0, Math.min(1, +p || 0)) * 100;
  return `<svg class="sc-rs" viewBox="0 0 44 44" aria-hidden="true"><circle class="sc-rb" cx="22" cy="22" r="20"/><circle class="sc-rf" cx="22" cy="22" r="20" pathLength="100" stroke-dasharray="${v.toFixed(1)} 100"/></svg>`;
}
function picHtml(it, z = 36){
  /* el dibujo del juego tal cual; la gramática y la lección, su dibujo sobre una ficha gris; un modo, su icono con tinte */
  const pic = it.img && it.plate ? `<span class="sc-tile sc-ti"><img src="${h(it.img)}" alt="" width="${Math.round(z * .72)}" height="${Math.round(z * .72)}" draggable="false"></span>`
    : it.img ? `<img src="${h(it.img)}" alt="" width="${z}" height="${z}" draggable="false">`
    : `<span class="sc-tile${it.tone === "soft" ? " soft" : ""}">${IC(it.ic || "sparkle", it.ics || "bold", Math.round(z * .56))}</span>`;
  const b = it.badge ? `<span class="sc-bdg">${it.badge.img ? `<img src="${h(it.badge.img)}" alt="" width="16" height="16" draggable="false">` : IC(it.badge.ic, "bold", 12)}</span>` : "";
  return `<span class="sc-pic${it.half ? " sc-ringed" : ""}" aria-hidden="true">${it.half ? ring(it.p) : ""}${pic}${b}</span>`;
}
function pieceHtml(it, i){
  const lab = it.half ? `${it.label}. Vas por el ${Math.round((+it.p || 0) * 100)} %` : it.label + (it.pinned ? ", fijado" : "");
  return `<li class="sc-li"><a class="card sc-p${it.half ? " sc-half" : ""}" href="${h(it.href)}" ${it.half ? "data-half" : `data-sc="${h(it.key)}"`} data-key="${i + 1}" data-key-pos="in" aria-label="${h(lab)}"${it.game ? " data-game" : ""}>
    ${picHtml(it, 32)}<span class="sc-n" aria-hidden="true"><span class="sc-a">${h(it.act || it.t)}</span><span class="sc-tp">${h(it.top || it.name || "")}</span></span>${it.pinned ? `<span class="sc-pin" aria-hidden="true">${IC("push-pin", "fill", 12)}</span>` : ""}</a></li>`;
}
/* home() de index.html la llama con Hoy ya pintado (entre las piezas y los HOME_SLOTS) */
function paint(){
  css();
  clearGest();
  const old = D.getElementById("hm-sc"); if(old) old.remove();
  ROOT.removeAttribute("data-sc"); COVER = null; SHOWN = [];
  const slots = D.getElementById("hm-slots");
  /* al repintar la misma Hoy (Fijar, No sugerir…), vuelven los HOME_SLOTS que quitó fit(); en una Hoy nueva, no */
  if(slots && CUT.box === slots) CUT.forEach(el => slots.append(el));
  CUT = [];
  if(!slots || !onHoy()){ PENDING = null; return; }
  const res = PENDING; PENDING = null;
  const tok = ++TOK;
  if(!res){   /* sin el cálculo de homeSlots(): se calcula ahora y se pinta al llegar */
    compute().then(r => {
      if(tok !== TOK || !slots.isConnected || !onHoy()) return;
      render(r, slots);
      fit();
      if(COVER) try{ W.vocabAccessory && vocabAccessory.refresh(); }catch(e){}
    }).catch(e => console.error(e));
    return;
  }
  render(res, slots);
}
function render(res, slots){
  let half = res.half;
  /* lo que ya ofrece la tarjeta principal no se repite */
  try{ if(half && half.kind !== "practica" && typeof homeOffer !== "undefined" && sameOffer(half, homeOffer)) half = null; }catch(e){}
  const list = [half, ...res.items.filter(Boolean)].filter(Boolean).slice(0, res.n);
  setTimeout(() => askSlow(false), 900);
  if(!list.length) return;
  COVER = half && half.kind !== "practica" ? {kind: half.kind, id: half.id} : null;
  SHOWN = list.filter(it => !it.half).map(it => it.key);
  /* columnas: las piezas que hay (3 como mínimo, para que una sola no ocupe toda la fila); en tableta con 3 piezas, 3
     columnas anchas y el nombre entero, no 4 con un hueco al final */
  const sec = D.createElement("section");
  sec.id = "hm-sc"; sec.className = "sc-row"; sec.setAttribute("aria-labelledby", "sc-h");
  /* «Editar», al final de la cabecera de la sección (como en iOS): las piezas se reparten todo el ancho */
  sec.innerHTML = `<div class="sc-hd"><h2 class="sc-h" id="sc-h">Tus atajos</h2>${SHOWN.length
      ? `<button type="button" class="sc-ed" id="sc-ed" aria-haspopup="dialog" aria-label="Editar atajos">Editar</button>` : ""}</div>
    <ul class="sc-ps" role="list" style="--sc-n:${Math.max(list.length, Math.min(3, res.n))}">${list.map(pieceHtml).join("")}</ul>`;
  slots.before(sec);
  ROOT.dataset.sc = String(list.length);
  wire(sec);
  fit(true);   /* la medida buena llega con "acc", tras "route" (con la cabecera de Hoy y el accesorio ya puestos), y al cargar la letra */
  try{ if(D.fonts && D.fonts.status !== "loaded") D.fonts.ready.then(() => { if(sec.isConnected) fit(); }); }catch(e){}
}
/* Hoy sin scroll. Si con la fila no cabe: 1) se van los HOME_SLOTS, del último al primero; 2) la fila se compacta (piezas
   de 44 px con el dibujo al lado; «Editar» sigue en la cabecera); 3) si aun así no cabe (un móvil bajo con mucho en Hoy),
   la fila se va (y vuelven las filas que entonces quepan).
   La carta sin abrir («¡Tienes carta!», el primer HOME_SLOT cuando la hay: llega pocas veces y es de alguien de casa) va
   antes que la fila: en el paso 1 se queda y, si con la fila compacta sigue sin caber, se va la fila (los atajos siguen
   en Juegos). Salvo si la fila hace de accesorio «Seguir» (su pieza a medias): entonces la fila manda.
   Se puede volver a llamar (con "route", al cargar la letra o al girar): antes de medir, vuelve a poner lo que quitó.
   soft: sin el paso 3 (al pintar, antes de que route() ponga la cabecera de Hoy); ahí la carta también se va, y vuelve
   con la medida buena ("acc").
   El paso 1 vale también sin la fila (atajos apagados o aún sin atajos): con el accesorio «Seguir» en Hoy y dos
   HOME_SLOTS, el último se va. Un HOME_SLOT que se va llama a su .skip(), si la tiene (así no gasta su vez). */
const FIRST = new Set(["mail"]);   /* los HOME_SLOTS que van antes que la fila de atajos */
let CUT = [];
function fit(soft){
  const sec = D.getElementById("hm-sc"), box = D.getElementById("hm-slots");
  if(!box || !onHoy()){ CUT = []; return; }
  const over = () => ROOT.scrollHeight > innerHeight;
  if(sec) sec.classList.remove("sc-tight");
  if(CUT.box === box) CUT.forEach(el => box.append(el));
  CUT = []; CUT.box = box;
  if(!over()) return;
  const trim = (keep = 0) => {
    const ss = [...box.querySelectorAll(":scope > .hm-slot")];
    while(ss.length > keep && over()){
      const el = ss.pop(); el.remove(); CUT.unshift(el);
      try{ const f = typeof HOME_SLOTS !== "undefined" && HOME_SLOTS.find(s => s && s.id && s.id === el.dataset.slot); if(f && typeof f.skip === "function") f.skip(); }catch(e){}
    }
  };
  const first = box.querySelector(":scope > .hm-slot");
  const vip = !!(sec && !COVER && first && FIRST.has(first.dataset.slot));
  trim(vip ? 1 : 0);
  if(!sec) return;
  if(over()) sec.classList.add("sc-tight");
  if(over() && soft) trim();
  if(over() && !soft){
    sec.remove(); clearGest(); ROOT.removeAttribute("data-sc"); SHOWN = [];
    CUT.forEach(el => box.append(el)); CUT = []; CUT.box = box;   /* sin la fila vuelven las filas… */
    trim();                                                          /* …las que quepan */
    /* la pieza a medias se fue: sale el accesorio «Seguir» y, con "acc", se vuelve a medir */
    if(COVER){ COVER = null; try{ W.vocabAccessory && vocabAccessory.refresh(); }catch(e){} }
  }
}
let FIT_T = 0;
W.addEventListener("resize", () => { clearTimeout(FIT_T); FIT_T = setTimeout(fit, 150); });
function wire(sec){
  const ed = sec.querySelector("#sc-ed");
  if(ed) ed.onclick = e => openEdit(e.currentTarget);
  sec.querySelectorAll(".sc-p").forEach(a => {
    /* un juego habla: la primera voz tiene que nacer de un toque (iOS), como en el menú de juegos */
    if(a.hasAttribute("data-game")) a.addEventListener("click", () => { try{ if(!("speechSynthesis" in W)) return; const u = new SpeechSynthesisUtterance(" "); if(typeof useVoice === "function") useVoice(u, lang); speechSynthesis.speak(u); }catch(e){} });
    const k = a.dataset.sc;
    /* al mantener: la pieza se hunde un poco (CSS :active) y, al cumplirse, crece un instante antes de abrir su hoja */
    if(k && W.G && typeof G.hold === "function") GEST.push(G.hold(a, {onHold: () => {
      haptic("selection");
      const rmo = !!(W.M && typeof M.rm === "function" && M.rm());
      if(rmo){ openItem(k, a); return; }
      a.classList.add("is-held");
      setTimeout(() => { a.classList.remove("is-held"); openItem(k, a); }, 140);
    }}));
  });
  const first = sec.querySelector(".sc-p[data-sc]");
  if(first) setTimeout(() => {
    if(!first.isConnected || !W.G || typeof G.hint !== "function" || D.querySelector("dialog[open]")) return;
    try{ G.hint(first, {id: "sc-hold", gesture: "hold", text: "Mantén para fijar", side: "bottom"}); }catch(e){}
  }, 1400);
}
/* ¿la fila enseña lo mismo que el accesorio «Seguir»? Entonces el accesorio no sale en Hoy (accRefresh de index.html) */
function covers(st){
  return !!(COVER && st && onHoy() && D.getElementById("hm-sc") && sameOffer(st, COVER));
}
function refreshRow(){
  if(!onHoy() || !D.getElementById("hm-slots")) return Promise.resolve();
  return compute().then(r => { PENDING = r; paint(); if(SH && SH.open && !ONE) paintSheet(); }).catch(e => console.error(e));
}

/* ---------- Fijar · No sugerir ---------- */
const nameOf = k => { const it = resolve(k); return it ? it.label : "ese atajo"; };
function pin(key, on){
  const P = prefs(), L = ab();
  P.pinned = P.pinned.filter(k => k !== key);
  let dropped = null;
  if(on){
    const mine = P.pinned.filter(k => k.startsWith(L + "/"));
    if(mine.length >= MAX_PIN){ dropped = mine[0]; P.pinned = P.pinned.filter(k => k !== dropped); }
    P.pinned.push(key); delete P.hidden[key];
  }
  prefsSet(P);
  haptic("selection");
  /* el botón ya enseña «Fijado»; el aviso, solo si otro deja de estarlo */
  if(dropped) toast(`Fijado. «${nameOf(dropped)}» ya no está fijado`, {icon: IC("push-pin", "fill", 22)});
  return refreshRow();
}
function hide(key){
  const P = prefs(), o = scGet(), L = ab();
  const before = {pinned: P.pinned.slice(), hid: P.hidden[key], row: (o.row[L] || []).slice()};
  const t = nameOf(key);
  P.pinned = P.pinned.filter(k => k !== key);
  P.hidden[key] = day() + HIDE_DAYS;
  prefsSet(P);
  const undo = () => {
    const Q = prefs();
    Q.pinned = before.pinned;
    if(before.hid) Q.hidden[key] = before.hid; else delete Q.hidden[key];
    prefsSet(Q);
    const o2 = scGet(); o2.row[L] = before.row; scSet(o2);
    refreshRow();
  };
  toast("Ya no sale en Hoy", {icon: IC("eye-slash", "bold", 22), ms: UNDO_MS, action: {t: "Deshacer", fn: undo}});
  live(`«${t}» ya no sale en Hoy durante 30 días`);
  refreshRow();
  return undo;
}
/* lo que el lector de pantalla tiene que oír además del aviso */
function live(t){
  let el = D.getElementById("sc-live");
  if(!el){ el = D.createElement("p"); el.id = "sc-live"; el.className = "sc-sr"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); D.body.appendChild(el); }
  el.textContent = ""; setTimeout(() => { el.textContent = t; }, 60);
}
function unhide(key){
  const P = prefs(); delete P.hidden[key]; prefsSet(P);
  return refreshRow();
}
function setOff(off){
  const P = prefs(); P.off = !!off; prefsSet(P);
}
function forget(){
  try{ localStorage.removeItem(SC); }catch(e){}
}

/* ---------- la hoja: «Editar» (toda la fila) o mantener pulsada una pieza (solo esa) ---------- */
let SH = null, ONE = null;
function sheetEl(){
  if(SH && SH.isConnected) return SH;
  SH = D.createElement("dialog");
  SH.id = "sc-sheet"; SH.className = "sc-sheet"; SH.setAttribute("aria-labelledby", "sc-sh-t");
  SH.innerHTML = `<div class="sc-sh-in"></div>`;
  SH.addEventListener("click", onSheet);
  SH.addEventListener("close", () => { ONE = null; });
  D.body.appendChild(SH);
  return SH;
}
/* «Fijar» es un conmutador (como en iOS): «Fijar» ↔ «Fijado» (con tinte); «No sugerir» lleva debajo lo que hace */
/* one: la hoja de una sola pieza (al mantenerla): solo los botones, bajo su nombre en el título; así es baja y no tapa la fila */
function rowHtml(it, P, one){
  const pinned = P.pinned.includes(it.key);
  return `<div class="sc-er${one ? " sc-er1" : ""}" data-k="${h(it.key)}">${one ? "" : `${picHtml(it)}<span class="sc-tx"><span class="sc-t">${h(it.act || it.t)}</span><span class="sc-s">${h(it.name && it.name !== it.act ? it.name : it.sub)}</span></span>`}
    <div class="sc-eb"><button type="button" class="glass-btn glass-btn--sm sc-pinb" data-pin aria-pressed="${pinned}" aria-label="Fijar «${h(it.label)}»">${IC("push-pin", pinned ? "fill" : "bold", 18)}<span>${pinned ? "Fijado" : "Fijar"}</span></button>
      <span class="sc-hb"><button type="button" class="glass-btn glass-btn--sm" data-hide aria-label="No sugerir «${h(it.label)}»" aria-describedby="sc-hn-${h(it.key).replace(/[^\w-]/g, "_")}">${IC("eye-slash", "bold", 18)}No sugerir</button>
        <small class="sc-hn" id="sc-hn-${h(it.key).replace(/[^\w-]/g, "_")}">Sale de Hoy 30 días</small></span></div></div>`;
}
function paintSheet(){
  const d = sheetEl(), P = prefs(), now = day(), L = ab();
  const ae = D.activeElement, ar = ae && d.contains(ae) && ae.closest ? ae.closest(".sc-er[data-k]") : null;
  const fk = ar ? {k: ar.dataset.k, sel: ae.hasAttribute("data-pin") ? "[data-pin]" : ae.hasAttribute("data-unhide") ? "[data-unhide]" : "[data-hide]"} : null;
  const items = (ONE ? [ONE] : SHOWN).map(resolve).filter(Boolean);
  const hid = ONE ? [] : Object.keys(P.hidden).filter(k => P.hidden[k] > now && k.startsWith(L + "/")).map(resolve).filter(Boolean);
  const title = ONE && items[0] ? items[0].label : "Tus atajos";
  d.querySelector(".sc-sh-in").innerHTML = `<div class="m-head"><h2 id="sc-sh-t">${h(title)}</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Listo</button></div>
    ${ONE ? "" : `<p class="sc-sh-sub">Salen solos con lo que más usas. Fija los que quieras tener siempre.</p>`}
    ${items.length ? `<div class="sc-g">${items.map(it => rowHtml(it, P, !!ONE)).join("")}</div>` : `<p class="sc-sh-sub">Ahora no hay atajos.</p>`}
    ${hid.length ? `<h3 class="st-h sc-hh">No sugeridos</h3><div class="sc-g">${hid.map(it => `<div class="sc-er" data-k="${h(it.key)}">${picHtml(it)}<span class="sc-tx"><span class="sc-t">${h(it.act || it.t)}</span><span class="sc-s">${h(it.name && it.name !== it.act ? it.name : it.sub)}</span></span>
      <div class="sc-eb"><button type="button" class="glass-btn glass-btn--sm" data-unhide aria-label="Volver a sugerir «${h(it.label)}»">${IC("eye", "bold", 18)}Volver a sugerir</button></div></div>`).join("")}</div>` : ""}`;
  /* el foco vuelve al mismo botón de la misma fila (o a «Listo»): con teclado o lector de pantalla no se pierde el sitio */
  if(fk){
    const row = [...d.querySelectorAll(".sc-er[data-k]")].find(r => r.dataset.k === fk.k);
    const t = (row && row.querySelector(fk.sel)) || (row && row.querySelector("button")) || d.querySelector("[data-close]");
    if(t) try{ t.focus({preventScroll: true}); }catch(e){}
  }
}
function openSheet(from){
  const d = sheetEl();
  paintSheet();
  if(d.open) return Promise.resolve();
  try{ return W.M && typeof M.openSheet === "function" ? M.openSheet(d, {from: from || null}) : (d.showModal(), Promise.resolve()); }
  catch(e){ console.error(e); return Promise.resolve(); }
}
function closeSheet(){
  const d = SH; if(!d || !d.open) return Promise.resolve();
  try{ return W.M && typeof M.closeSheet === "function" ? M.closeSheet(d) : (d.close(), Promise.resolve()); }catch(e){ try{ d.close(); }catch(_){} return Promise.resolve(); }
}
function openEdit(from){ ONE = null; return openSheet(from); }
function openItem(key, from){ if(!resolve(key)) return Promise.resolve(); ONE = key; return openSheet(from); }
function onSheet(e){
  const t = e.target.closest ? e.target.closest("button") : null; if(!t) return;
  if(t.hasAttribute("data-close")){ closeSheet(); return; }
  const k = (t.closest("[data-k]") || {}).dataset ? t.closest("[data-k]").dataset.k : ""; if(!k) return;
  if(t.hasAttribute("data-pin")){
    const on = t.getAttribute("aria-pressed") !== "true";
    t.setAttribute("aria-pressed", String(on));   /* se ve al momento; luego se repinta igual */
    pin(k, on).then(() => { if(SH && SH.open) paintSheet(); });
  }
  else if(t.hasAttribute("data-hide")){
    /* con la hoja abierta el aviso no se podría tocar (la hoja es modal): primero se cierra, luego «Deshacer». Con
       teclado (un clic sin puntero), el foco va al «Deshacer» del aviso; si no, a «Editar» */
    const kb = e.detail === 0;
    closeSheet().then(() => { hide(k); if(kb) setTimeout(() => {
      const u = D.querySelector("#m-toasts .m-ta") || D.getElementById("sc-ed");
      if(u) try{ u.focus({preventScroll: true}); }catch(err){}
    }, 120); });
  }
  else if(t.hasAttribute("data-unhide")){ unhide(k).then(() => { if(SH && SH.open) paintSheet(); }); toast("Vuelve a salir en Hoy", {icon: IC("eye", "bold", 22)}); }
}

/* ---------- lo que se termina ---------- */
let FLIP = null;   /* Tarjetas: las giradas en esta visita a la ficha */
function on(ev, f){ try{ if(typeof bus !== "undefined") bus.on(ev, d => { try{ f(d || {}); }catch(e){ console.error(e); } }); }catch(e){} }
on("game-done", d => { if(d.game) log(keys.game(String(d.game), d.tp ? String(d.tp) : "")); });
on("doc-done", d => {
  if(!d.id || !MODE_T[d.mode]) return;
  log(keys.doc(String(d.id), d.mode));
  if(d.mode === "practica"){ const o = scGet(), k = keys.doc(String(d.id), "practica"); if(o.o[k] != null){ delete o.o[k]; scSet(o); } }
});
on("doc-flip", d => {
  if(!d.id || !Number.isFinite(+d.i)) return;
  if(!FLIP || FLIP.id !== d.id) FLIP = {id: d.id, seen: new Set(), done: false};
  FLIP.seen.add(+d.i);
  if(!FLIP.done && FLIP.seen.size >= Math.min(CARDS_MIN, Math.max(1, +d.n || CARDS_MIN))){ FLIP.done = true; log(keys.doc(String(d.id), "tarjetas")); }
});
on("lesson-done", d => { if(d.grammar && d.id) log(keys.gram(String(d.id))); });
on("story-done", d => { if(d.id && /^[a-z]{2}-[a-z0-9-]+$/.test(String(d.id))) log(`${ab()}/cuento:${d.id}`); });
on("answer", d => {
  if(d.where !== "practice" || prefs().off) return;
  const p = hp(); if(!p.startsWith("doc/")) return;
  const o = scGet(), k = keys.doc(p.slice(4), "practica"), t = day();
  if(o.o[k] !== t){ o.o[k] = t; scSet(o); }
});
on("review-done", () => { PENDING = null; });
/* con "route" el hueco del accesorio «Seguir» aún puede ser el de la pantalla anterior: ahí solo la medida suave (lo que
   quita vuelve en la siguiente); la buena, con "acc" (index.html, cuando el accesorio ya está puesto o quitado) */
on("route", () => { FLIP = null; if(!onHoy()){ clearGest(); COVER = null; } else fit(true); });
on("acc", () => { if(onHoy()) fit(); });
on("lang", () => { PENDING = null; });

/* ---------- «¿Lo pongo siempre despacio?» ---------- */
/* cada escucha tocada: un altavoz (aria-label «Escuchar…» u «Oír…», [data-say], el «Oír» de Frases) o una tortuga
   («… despacio», [data-slow]). Oír sus propias grabaciones del Buzón no cuenta */
const LISTEN = '[data-say], button[aria-label^="Escuchar"], button[aria-label^="Oír"], #ph-say, #ph-slow';
D.addEventListener("click", e => {
  const b = e.target && e.target.closest ? e.target.closest(LISTEN) : null;
  if(!b || b.closest(".mb-rp, #mb-play") || b.disabled || b.getAttribute("aria-disabled") === "true" || prefs().off) return;
  if(ROOT.hasAttribute("data-tech")) return;   /* lo que oye un mayor en Tech Prep no cuenta para la tortuga del niño */
  const slow = b.hasAttribute("data-slow") || b.id === "ph-slow" || /despacio/i.test(b.getAttribute("aria-label") || "");
  const o = scGet(); o.sl = (o.sl + (slow ? "1" : "0")).slice(-SLOW_N); scSet(o);
}, true);
function slowWanted(){
  const P = prefs(); if(P.off || P.slowAsked) return false;
  try{ if(typeof rate !== "undefined" && +rate < .75) return false; }catch(e){}
  const s = scGet().sl; if(s.length < SLOW_N) return false;
  return s.split("").filter(c => c === "1").length / s.length >= SLOW_P;
}
let SLOWD = null;
function askSlow(force){
  if(!force && !slowWanted()) return false;
  if(!onHoy() || ROOT.hasAttribute("data-focus") || D.querySelector("dialog[open]")) return false;
  css();
  if(!SLOWD || !SLOWD.isConnected){
    SLOWD = D.createElement("dialog"); SLOWD.id = "sc-slow"; SLOWD.className = "sc-sheet sc-slow-d"; SLOWD.setAttribute("aria-labelledby", "sc-slow-t");
    D.body.appendChild(SLOWD);
    SLOWD.addEventListener("click", e => {
      const b = e.target.closest ? e.target.closest("[data-yes],[data-no]") : null; if(!b) return;
      const yes = b.hasAttribute("data-yes");
      if(yes){
        try{ rate = SLOW_RATE; }catch(_){}
        try{ store.set("rate", SLOW_RATE); }catch(_){}
        haptic("success");
      }
      const done = () => { if(yes) toast("¡Hecho! Ahora todo suena despacio", {icon: IC("turtle", "fill", 22)}); };
      try{ (W.M && typeof M.closeSheet === "function" ? M.closeSheet(SLOWD) : (SLOWD.close(), Promise.resolve())).then(done); }catch(_){ done(); }
    });
    /* cerrarla de cualquier forma (botón, fondo, arrastre o Esc) cuenta como preguntado: no vuelve a salir */
    SLOWD.addEventListener("close", () => { const P = prefs(); if(!P.slowAsked){ P.slowAsked = true; prefsSet(P); } });
  }
  let fox = ""; try{ fox = typeof heroHtml === "function" ? heroHtml(64) : ""; }catch(e){}
  SLOWD.innerHTML = `<div class="sc-slow">
      <div class="sc-slow-fox" aria-hidden="true">${fox}</div>
      <h2 id="sc-slow-t">¿Lo pongo siempre despacio?</h2>
      <p class="sc-slow-p">Usas mucho la tortuga. Puedo hacer que todo suene más despacio.</p>
      <div class="sc-slow-b"><button type="button" class="glass-btn glass-btn--lg" data-no>No, así está bien</button>
        <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" data-yes>${IC("turtle", "fill", 22)}Sí, despacio</button></div>
      <p class="sc-slow-n">Se puede cambiar en Ajustes › Voz y velocidad.</p></div>`;
  /* ya preguntado desde que sale (aunque se cierre la app sin contestar) */
  const P = prefs(); P.slowAsked = true; prefsSet(P);
  try{ if(W.M && typeof M.openSheet === "function") M.openSheet(SLOWD); else SLOWD.showModal(); }catch(e){ console.error(e); }
  return true;
}

/* ---------- Ajustes › Para mayores ---------- */
const FORGET_SUB = "Borra solo lo que usan los atajos. Las palabras y el progreso no se tocan; los fijados se quedan.";
function adultHtml(){
  const P = prefs();
  return `<section class="st-sec" aria-labelledby="aj-sc-h"><h3 class="st-h" id="aj-sc-h">Atajos</h3><div class="st-g ics">
      <label class="st-r" for="aj-sc-on"><span class="st-ic" aria-hidden="true">${IC("sparkle", "bold", 18)}</span>
        <span class="st-l">Atajos automáticos<small>Hoy sugiere lo que más usa. Lo aprendido se queda en este aparato.</small></span>
        <input type="checkbox" role="switch" class="st-sw" id="aj-sc-on" ${P.off ? "" : "checked"}></label>
      <button type="button" class="st-r st-btn" id="aj-sc-forget"><span class="st-ic gr" aria-hidden="true">${IC("arrow-counter-clockwise", "bold", 18)}</span>
        <span class="st-l">Olvidar lo aprendido<small id="aj-sc-fs">${h(FORGET_SUB)}</small></span></button>
    </div></section>`;
}
let DIRTY = false;
on("settings", d => {
  if(d.page === null){ if(DIRTY){ DIRTY = false; if(onHoy() && typeof route === "function") route(); } return; }
  if(d.page !== "mayores" || !d.el) return;
  const sw = d.el.querySelector("#aj-sc-on"), fg = d.el.querySelector("#aj-sc-forget");
  if(sw) sw.onchange = () => { setOff(!sw.checked); DIRTY = true; haptic("selection"); };
  if(fg){
    let armed = 0;
    const fs = d.el.querySelector("#aj-sc-fs");
    fg.onclick = () => {
      const t = Date.now();
      if(!armed || t - armed > 5000){   /* confirmación corta: un segundo toque en 5 s */
        armed = t;
        if(fs) fs.textContent = "¿Seguro? Toca otra vez para olvidar.";
        setTimeout(() => { if(armed === t && fs && fs.isConnected){ armed = 0; fs.textContent = FORGET_SUB; } }, 5000);
        return;
      }
      if(t - armed < 400) return;   /* un doble toque sin querer no cuenta */
      armed = 0; forget(); DIRTY = true;
      if(fs) fs.textContent = "Hecho: lo aprendido se ha olvidado.";
      toast("Listo: los atajos empiezan de cero", {icon: IC("check-circle", "fill", 22)});
    };
  }
});

/* ---------- estilos ---------- */
const CSS = `
/* «Tus atajos» en Hoy: piezas sólidas (contenido, sin vidrio) con el dibujo encima y dos líneas debajo (qué se hace y de
   qué), 3 en el móvil y 4 en tableta; «Editar», al final de la cabecera de la sección */
.sc-row{display:flex;flex-direction:column;gap:4px;min-width:0;margin:0}
.sc-hd{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:20px;padding:0 4px 0 8px}
.sc-h{margin:0;font:600 var(--fs-note,.9375rem)/20px var(--f-text);color:rgba(60,60,67,.9)}
:root[data-theme=dark] .sc-h{color:var(--label2)}
/* un toque de 44 px sin hacer más alta la cabecera: lo que sobra va hacia arriba (el hueco entre bloques de Hoy) y
   casi nada hacia las piezas */
.sc-ed{position:relative;flex:none;margin:0;padding:0 8px;border:0;border-radius:var(--r-sm);background:none;color:var(--brand-ink);
  font:600 var(--fs-note,.9375rem)/20px var(--f-text);cursor:pointer;-webkit-tap-highlight-color:transparent}
.sc-ed::after{content:"";position:absolute;inset:-16px -4px -8px}
.sc-ed:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.sc-ps{min-width:0;display:grid;grid-template-columns:repeat(var(--sc-n,3),minmax(0,1fr));gap:8px;margin:0;padding:0;list-style:none}
.sc-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* sin sitio (móvil bajo con mucho en Hoy, fit()): la fila se compacta: cabecera de 16 px y piezas de 44 px con el dibujo
   al lado de sus dos líneas */
.sc-row.sc-tight{gap:2px}
.sc-row.sc-tight .sc-hd{min-height:16px}
.sc-row.sc-tight :is(.sc-h,.sc-ed){font-size:calc(.8125rem*var(--k,1));line-height:16px}
.sc-row.sc-tight .sc-ed::after{inset:-22px -4px -6px}   /* zona de toque de 44 px (no se ve) */
.sc-row.sc-tight .sc-p{flex-direction:row;align-items:center;justify-content:flex-start;gap:8px;min-height:var(--tap,44px);padding:4px 8px;text-align:left}
.sc-row.sc-tight .sc-n{align-items:flex-start}
.sc-li{min-width:0;display:flex}
.sc-p{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px;min-width:0;min-height:56px;margin:0;
  padding:4px 8px;border-radius:var(--r-md);color:var(--label);text-align:center;text-decoration:none;-webkit-tap-highlight-color:transparent;
  transition:transform .15s ease,box-shadow .15s ease}
/* mantener: se hunde a los 80 ms; al cumplirse, crece un instante (js) */
.sc-p:active{transform:scale(.97);transition-delay:.08s}
.sc-p.is-held{transform:scale(1.06);box-shadow:0 8px 24px rgb(11 37 69/.18);transition-delay:0s}
@media (prefers-reduced-motion:reduce){.sc-p,.sc-p:active,.sc-p.is-held{transform:none;transition:none}}
.sc-pic{position:relative;flex:none;width:36px;height:36px;display:grid;place-items:center}
.sc-pic>img{display:block;width:36px;height:36px;max-width:none;object-fit:contain}
.sc-tile{display:grid;place-items:center;width:36px;height:36px;border-radius:var(--r-sm);background:var(--fill2);color:var(--label2)}
.sc-tile.soft{background:var(--brand-soft);color:var(--brand-ink)}
.sc-ti img{display:block;width:72%;height:72%;max-width:none;object-fit:contain}
/* en el móvil, el dibujo de 24 px (Hoy cabe sin scroll con la fila y un HOME_SLOT); en tableta, de 32 */
.sc-p .sc-pic,.sc-p .sc-pic>img,.sc-p .sc-tile{width:24px;height:24px}
.sc-p .sc-tile{border-radius:8px}
.sc-p .sc-bdg{right:-8px;bottom:-4px;width:16px;height:16px}
.sc-p .sc-bdg img{width:12px;height:12px}
.sc-ringed>img,.sc-ringed>.sc-tile{width:24px;height:24px;border-radius:50%}
.sc-p .sc-ringed>img,.sc-p .sc-ringed>.sc-tile{width:16px;height:16px;border-radius:50%}
/* (en un móvil alto, desde 900 px, también de 32: ahí Hoy tiene sitio de sobra; en 390×844 no cabe sin quitar una fila) */
@media (max-width:743px) and (min-height:900px){
  .sc-p .sc-pic,.sc-p .sc-pic>img,.sc-p .sc-tile{width:32px;height:32px}
  .sc-p .sc-tile{border-radius:var(--r-sm)}
  .sc-p .sc-bdg{right:-4px;bottom:-4px;width:20px;height:20px}
  .sc-p .sc-bdg img{width:16px;height:16px}
  .sc-p .sc-ringed>img,.sc-p .sc-ringed>.sc-tile{width:24px;height:24px}
}
@media (min-width:744px){
  .sc-p{padding:8px}
  .sc-p .sc-pic,.sc-p .sc-pic>img,.sc-p .sc-tile{width:32px;height:32px}
  .sc-p .sc-tile{border-radius:var(--r-sm)}
  .sc-p .sc-bdg{right:-4px;bottom:-4px;width:20px;height:20px}
  .sc-p .sc-bdg img{width:16px;height:16px}
  .sc-p .sc-ringed>img,.sc-p .sc-ringed>.sc-tile{width:24px;height:24px}
}
.sc-ringed>.sc-tile svg{width:14px;height:14px}
.sc-rs{position:absolute;inset:-2px;width:calc(100% + 4px);height:calc(100% + 4px);rotate:-90deg}
/* dos líneas de 13 px: qué se hace (600) y de qué (400, gris), con nombres cortos; en tableta, el tema puede ir en 2 */
.sc-n{display:flex;flex-direction:column;align-items:center;max-width:100%;min-width:0;font:400 calc(.8125rem*var(--k,1))/calc(14px*var(--k,1)) var(--f-text)}
.sc-a,.sc-tp{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sc-a{font-weight:600}
.sc-tp{color:var(--label2)}
@media (min-width:744px){.sc-tp{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;text-wrap:balance}}
.sc-rs circle{fill:none;stroke-width:3.5}
.sc-rb{stroke:var(--fill)}
.sc-rf{stroke:var(--teal);stroke-linecap:round}
.sc-bdg{position:absolute;right:-4px;bottom:-4px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:var(--card);color:var(--brand-tint);box-shadow:0 0 0 1px var(--sep)}
.sc-bdg img{display:block;width:16px;height:16px;max-width:none}
/* en oscuro, los dibujos (hechos para fondo claro) sobre una ficha clara, como en el resto de la app */
:root[data-theme=dark] .sc-pic>img{background:#F2F2F7;border-radius:var(--r-sm);padding:2px}
:root[data-theme=dark] .sc-ti,:root[data-theme=dark] .sc-bdg{background:#F2F2F7}
.sc-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.sc-t{font:600 var(--fs-note,.9375rem)/1.2 var(--f-text);overflow-wrap:anywhere}
.sc-s{font:400 var(--fs-min,.8125rem)/1.25 var(--f-text);color:var(--label2);overflow-wrap:anywhere}
.sc-pin{position:absolute;top:8px;right:8px;display:flex;color:var(--label2)}
.sc-p:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
@media (forced-colors:active){.sc-p{border:1px solid CanvasText}.sc-rf{stroke:CanvasText}}
/* hojas: «Editar», una pieza y la pregunta del zorro (M.openSheet); dentro, grupos sólidos */
dialog.sc-sheet{max-width:560px}
.sc-sh-sub{margin:0 0 16px;font:400 var(--fs-note)/1.33 var(--f-text);color:var(--label2);text-align:center}
.sc-g{margin:0 0 12px;background:var(--card);border-radius:var(--r-card,24px);overflow:hidden}
:root[data-theme=dark] .sc-g{background:var(--card-2)}
.sc-er{position:relative;display:grid;grid-template-columns:36px minmax(0,1fr);align-items:center;column-gap:12px;row-gap:12px;padding:12px 16px}
.sc-er+.sc-er::before{content:"";position:absolute;top:0;left:64px;right:0;height:1px;background:var(--sep);transform:scaleY(.5);transform-origin:0 0}
.sc-er .sc-t{font-size:var(--fs-sub,1.0625rem)}
.sc-er .sc-s{font-size:var(--fs-note,.9375rem)}
.sc-eb{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px}
.sc-eb>.glass-btn,.sc-hb{flex:1 1 140px;min-width:0}
.sc-eb .glass-btn{white-space:normal;padding-inline:16px}
.sc-hb{display:flex;flex-direction:column;gap:4px}
.sc-hn{font:400 var(--fs-min,.8125rem)/1.25 var(--f-text);color:var(--label2);text-align:center}
/* «Fijado»: el estado se ve (tinte de la marca), como un conmutador de iOS */
:root:root .sc-eb .glass-btn.sc-pinb[aria-pressed=true]{background:color-mix(in srgb,var(--brand-tint) 14%,var(--card));color:var(--brand-ink);box-shadow:none}
:root:root[data-theme=dark] .sc-eb .glass-btn.sc-pinb[aria-pressed=true]{background:color-mix(in srgb,var(--brand-tint) 30%,var(--card-2));color:#fff}
.sc-pinb[aria-pressed=true]::before{display:none}
.sc-er1{display:block;padding:12px 16px}
.sc-hh{margin-top:4px}
.sc-slow{display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 0 4px;text-align:center}
.sc-slow-fox{display:flex}
.sc-slow h2{margin:4px 0 0;font:700 var(--fs-t3,1.375rem)/1.2 var(--f-round);color:var(--label);text-wrap:balance}
.sc-slow-p{margin:0;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label2);text-wrap:balance}
.sc-slow-b{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;width:100%;margin-top:12px}
.sc-slow-b .glass-btn{flex:1 1 200px}
.sc-slow-n{margin:4px 0 0;font:400 var(--fs-note)/1.33 var(--f-text);color:var(--label2)}
/* sobre el vidrio de la hoja (y el fondo oscurecido), el gris secundario un poco más fuerte: contraste ≥ 4,5:1 */
.sc-sh-sub,.sc-hn,.sc-slow-p,.sc-slow-n{color:color-mix(in srgb,var(--label2),var(--label) 25%)}
`;
function css(){
  if(D.getElementById("css-shortcuts")) return;
  const s = D.createElement("style"); s.id = "css-shortcuts"; s.textContent = CSS; D.head.appendChild(s);
}
css();

W.vocabShortcuts = Object.freeze({
  wantsRow, paint, covers, suggest, log, points, keys, prefs, pin, hide, unhide, setOff, forget,
  openEdit, openItem, closeSheet, askSlow, slowWanted, adultHtml, fit, SC, PREFS,
  get shown(){ return SHOWN.slice(); },
});
})();
