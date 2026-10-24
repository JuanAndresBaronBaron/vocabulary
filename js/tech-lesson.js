/* Módulo tech-lesson (window.vocabTech.lesson; Tech Prep, el motor: S1-SPEC §8-§9). Lo carga js/tech-boot.js la primera
   vez que se entra en Tech Prep, después de js/tech.js y antes de js/tech-pages.js. Todo lo que se ve está en inglés
   británico; los comentarios, en español como el resto del repo.
   · Las sesiones en modo foco (vocabTech.focus.register): #/techl/lesson/<lessonId> (una lección), #/techl/review (el
     repaso de hoy: vocabTech.srs.queue, 20 por sesión, «Keep going» trae las 20 siguientes), #/techl/mock (la entrevista
     de práctica) y #/techl/case/<caseId> (practicar un caso con las preguntas de vocabTech.cases.questions, de
     js/tech-pages.js). Una pantalla por ítem, la barra de progreso en la línea de la ✕ y el botón principal fijo abajo
     («Check», «Continue», «Next», «Done»). La ✕ (y Esc) y Atrás del navegador preguntan «Stop here?» si ya se hizo algo.
   · #/techmock (pestaña Interview): preparar la entrevista (duración y alcance) y el historial de las últimas.
   · Los 11 tipos de ítem de SCHEMA.md: card, pick, tf, scenario, match, order, code, diagram, explain, say y story. Tras
     contestar, su «why» y el enlace «Source» (data-no-gate). Acierto: verde con ✓ y G.haptic("success"); fallo: gris
     con ✗, sin temblor, sin sonido y sin vibración.
   · Notas al repaso con vocabTech.srs (grade/gradeExplain): 2 a la primera, 1 al segundo intento o con pocos fallos, 0
     mal (vuelve a salir al final de la sesión, una vez, sin volver a calificar). Las tarjetas de concepto entran en el
     repaso al verlas la primera vez; say y story no entran. El final de la lección: vocabTech.progress.lessonDone.
   · Explain it (vocabTech.lesson.explain): la pregunta, «Listen», un reloj que sigue contando (nunca para), «Answer
     aloud» (dictado largo) cuando se puede y siempre «Type your answer»; «Done» enseña tu respuesta, la respuesta modelo
     (con altavoz) y los puntos clave marcados por palabras completas (sin mayúsculas, con guiones y signos
     normalizados); «How did it go?» «Not yet» · «Partly» · «Nailed it». La app nunca puntúa la respuesta.
   · Dictado largo (vocabTech.lesson.dictation): SpeechRecognition en-GB, continuous e interimResults, se vuelve a
     arrancar si el navegador lo corta, hasta «Stop» o seconds + 60 s; nunca a la vez que listen() (ocupa recNow de
     index.html con su propio «_stop», así stopListen() también lo para). Sin permiso o sin red: una línea tranquila y el
     cuadro de texto. Sin canListen() (la app instalada del iPhone) no se ofrece.
   · Lo empezado sobrevive a recargar: sessionStorage "tech:ls" = {id: <lección a medias>, lesson, review, mock, case}
     (cada uno {id, steps, i, res, cur, started, day, …}, guardado desde que empieza: el orden, el repaso y las preguntas
     de la entrevista son los mismos al volver) y su copia localStorage "tech:lsdraft" = {t, v} (72 h, de este aparato).
     El texto de «Explain it» se guarda mientras se escribe (y el reloj, cada 5 s y al recargar o cerrar).
   · Registros (vocabTech.put): mock/<id> {when, n, grades, secs, items, len, scope, total} (cada entrevista; js/tech.js
     se queda las 20 últimas), cp/<caseId> {when, n, grades} (la última práctica de un caso) y story/<id> {title, prompt,
     fields, from} (el borrador de «Write yours»); tech:ui guarda mockLen (15 | 30) y mockScope ("studied" | "all").
   Nunca llama a award(), logAct(), srsGrade(), srsAdd() ni checkAch(); solo escribe claves tech:… (con vocabTech.put y
   las dos de arriba) y no emite coins, lesson-done, review-done, game-done, medal, gift-open ni answer.
   API: Object.assign(vocabTech.lesson, {explain(el, item, opts) → control, dictation: {can(), start(o) → {stop(), reset()}},
     keypoints(text, keypoints), normText(s), diagram: {html(d, o), fit(fig)}, storyParts(model, template),
     storyDraft(item), state()}) y el getter vocabTech.lesson.running (la sesión de ahora, o null). */
(() => {
"use strict";
const W = window, D = document, ROOT = D.documentElement;
const T = W.vocabTech; if(!T || !T.loaded) return;
const ui = T.ui, fmt = T.fmt;
const LSK = "tech:ls", DRK = "tech:lsdraft", UIK = "tech:ui", DRAFT_MS = 72 * 36e5;
const KINDS = ["lesson", "review", "mock", "case"];
const SCORED = new Set(["pick", "tf", "scenario", "match", "order", "code", "diagram"]);
const STAR = ["Situation", "Task", "Action", "Result", "Lessons learned"];
const STAR_HINT = {Situation: "Where and when, in one or two sentences", Task: "What you had to achieve, and why it mattered",
  Action: "What you did, step by step. Say “I”, not “we”", Result: "What changed, with a number if you can",
  "Lessons learned": "What you would keep or do differently"};
const LANG_NAME = {java: "Java", http: "HTTP", json: "JSON", yaml: "YAML", text: "Text", sql: "SQL", ts: "TypeScript"};
const now = () => Date.now();
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const $ = (s, r) => (r || D).querySelector(s);
const $$ = (s, r) => [...(r || D).querySelectorAll(s)];
const mix = a => { a = [...a]; for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rm = () => { try{ return !!(W.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const haptic = k => { try{ if(W.G && typeof G.haptic === "function") G.haptic(k); }catch(e){} };
const okAnim = el => { try{ if(W.M && typeof M.ok === "function") M.ok(el); }catch(e){} };
const toast = (t, icon) => { try{ if(W.M && typeof M.toast === "function") M.toast(t, icon ? {icon} : {}); }catch(e){} };
const appEl = () => D.getElementById("app");
const mmss = s => { s = Math.max(0, Math.round(+s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const mins = s => { const m = Math.round((+s || 0) / 60); return m < 1 ? "under a minute" : plural(m, "min", "min"); };
const nWords = s => (String(s || "").trim().match(/\S+/g) || []).length;
const plural = (n, one, many) => fmt.plural(n, one, many);
const dayOf = ms => Math.floor((ms - new Date(ms).getTimezoneOffset() * 6e4) / 864e5);
const call = (f, ...a) => { try{ if(typeof f === "function") return f(...a); }catch(e){ console.error(e); } };
let UID = 0;
const uid = p => `${p}${++UID}`;
const IC = {};
const icon = (n, st = "bold", sz = 20, cls = "") => { const k = `${n}|${st}|${sz}|${cls}`; return IC[k] || (IC[k] = ico(n, st, sz, cls)); };

/* ---------- lo empezado: tech:ls (esta pestaña) y tech:lsdraft (72 h, este aparato) ---------- */
function lsRead(){
  try{ const v = JSON.parse(sessionStorage.getItem(LSK)); if(isObj(v)) return v; }catch(e){}
  try{ const d = JSON.parse(localStorage.getItem(DRK)); if(isObj(d) && typeof d.t === "number" && now() - d.t < DRAFT_MS && isObj(d.v)) return d.v; }catch(e){}
  return {};
}
function lsWrite(o){
  const keep = {};
  for(const k of KINDS) if(isObj(o[k])) keep[k] = o[k];
  const ls = keep.lesson;   /* Today: «Continue» en vez de «Start», con algo ya hecho */
  if(ls && ls.id && (ls.started || isObj(ls.res) && Object.keys(ls.res).length)) keep.id = ls.id;
  try{
    if(Object.keys(keep).length){ sessionStorage.setItem(LSK, JSON.stringify(keep)); localStorage.setItem(DRK, JSON.stringify({t: now(), v: keep})); }
    else { sessionStorage.removeItem(LSK); localStorage.removeItem(DRK); }
  }catch(e){}
}
const sGet = k => { const o = lsRead()[k]; return isObj(o) && (typeof o.t !== "number" || now() - o.t < DRAFT_MS) ? o : null; };
const sSet = (k, v) => { const o = lsRead(); o[k] = Object.assign({}, v, {t: now()}); lsWrite(o); };
const sDel = k => { const o = lsRead(); if(!(k in o)) return; delete o[k]; lsWrite(o); };
function uiGet(){ try{ const o = JSON.parse(localStorage.getItem(UIK)); return isObj(o) ? o : {}; }catch(e){ return {}; } }
function uiSet(p){ try{ localStorage.setItem(UIK, JSON.stringify(Object.assign(uiGet(), p))); }catch(e){} }

/* ---------- puntos clave: palabras completas, sin mayúsculas, guiones y signos normalizados ---------- */
function normText(s){
  return " " + String(s == null ? "" : s).normalize("NFKC").toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/(\d)[.,](?=\d)/g, "$1\u0001")                  /* 99.9 y 10,000 siguen siendo un número */
    .replace(/[‐-―−_/\\-]+/g, " ")             /* guiones, barras y subrayados: espacios */
    .replace(/'(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])'/gu, " ")   /* el apóstrofo solo dentro de una palabra (don't) */
    .replace(/[^\p{L}\p{N}'\u0001]+/gu, " ")
    .replace(/\u0001/g, ".")
    .replace(/\s+/g, " ").trim() + " ";
}
/* [{text, found, kw}] (kw: la palabra clave que se encontró) */
function keypoints(text, kps){
  const hay = normText(text);
  return (Array.isArray(kps) ? kps : []).map(kp => {
    const hit = (Array.isArray(kp.kw) ? kp.kw : []).find(k => { const n = normText(k); return n.trim() !== "" && hay.includes(n); });
    return {text: String(kp.text || ""), found: !!hit, kw: hit || null};
  });
}

/* ---------- dictado largo ---------- */
const SRC = () => W.SpeechRecognition || W.webkitSpeechRecognition || null;
function dictCan(){
  if(!SRC()) return false;
  try{ return typeof canListen === "function" ? !!canListen() : true; }catch(e){ return true; }
}
/* recNow es de index.html (listen()): mientras se dicta lo ocupa un testigo con _stop (stopListen() lo para) */
const recBusy = () => { try{ return typeof recNow !== "undefined" && !!recNow; }catch(e){ return false; } };
const recIs = v => { try{ return typeof recNow !== "undefined" && recNow === v; }catch(e){ return false; } };
const recSet = v => { try{ if(typeof recNow !== "undefined") recNow = v; }catch(e){} };
const join = (a, b) => { a = String(a || "").trim(); b = String(b || "").trim(); return a && b ? `${a} ${b}` : a || b; };
let DICT = null;
/* o: {seconds, onText(text, final), onEnd({status, text, error}), lang}. status: "stopped" | "limit" | "denied" |
   "unavailable" | "unsupported" | "busy" | "error". text = lo oído desde el último reset() */
function dictStart(o = {}){
  const S = SRC();
  const nop = {stop(){}, reset(){}, get on(){ return false; }};
  if(!S || !dictCan()){ setTimeout(() => call(o.onEnd, {status: "unsupported", text: ""}), 0); return nop; }
  if(recBusy()){ setTimeout(() => call(o.onEnd, {status: "busy", text: ""}), 0); return nop; }
  const limit = (Math.max(10, +o.seconds || 120) + 60) * 1000, t0 = now();
  let rec = null, ended = false, stopping = "", finals = "", interim = "", consumed = 0, lastLen = 0, restarts = 0, startedAt = 0, guard = 0, limT = 0;
  const emit = () => call(o.onText, join(finals, interim), !interim);
  const tok = {_tech: true, _stop: () => api.stop()};
  const end = (status, error) => {
    if(ended) return;
    ended = true; clearTimeout(limT); clearTimeout(guard);
    const r = rec; rec = null;
    if(r){ r.onresult = r.onerror = r.onend = null; try{ r.abort(); }catch(e){} }
    if(recIs(tok)) recSet(null);
    if(DICT === api) DICT = null;
    if(interim){ finals = join(finals, interim); interim = ""; emit(); }
    call(o.onEnd, error ? {status, error, text: finals} : {status, text: finals});
  };
  const halt = why => {
    if(ended || stopping) return;
    stopping = why;
    const r = rec; if(!r) return end(why);
    try{ r.stop(); }catch(e){ return end(why); }
    guard = setTimeout(() => end(why), 1500);
  };
  const begin = () => {
    if(ended) return;
    if(stopping) return end(stopping);
    let r; try{ r = new S(); }catch(e){ return end("unsupported"); }
    rec = r; consumed = 0; lastLen = 0;
    r.lang = o.lang || "en-GB"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = e => {
      if(rec !== r || ended) return;
      const res = e.results || []; let it = "";
      for(let i = Math.max(+e.resultIndex || 0, consumed); i < res.length; i++){
        const x = res[i], tx = x && x[0] ? String(x[0].transcript || "") : "";
        if(x && x.isFinal){ finals = join(finals, tx); consumed = i + 1; } else it = join(it, tx);
      }
      lastLen = res.length; interim = it; emit();
    };
    r.onerror = e => {
      if(rec !== r || ended) return;
      const c = e && e.error || "error";
      if(c === "not-allowed" || c === "service-not-allowed") return end("denied", c);
      if(c === "network" || c === "audio-capture" || c === "language-not-supported") return end("unavailable", c);
      /* no-speech, aborted…: onend vuelve a arrancar */
    };
    r.onend = () => {
      if(rec !== r || ended) return;
      if(stopping) return end(stopping);
      if(now() - t0 >= limit) return end("limit");
      if(interim){ finals = join(finals, interim); interim = ""; }   /* lo que se estaba oyendo no se pierde */
      if(++restarts > 60) return end("error", "restarts");
      rec = null;
      setTimeout(begin, now() - startedAt < 1500 ? 500 : 60);       /* el navegador lo cortó antes de tiempo: otra vez */
    };
    startedAt = now();
    try{ r.start(); }catch(err){ rec = null; return end(restarts ? "error" : "busy", String(err && err.name || err)); }
  };
  const api = {
    stop: () => halt("stopped"),
    /* lo que ya se ve en el cuadro (el usuario lo ha cambiado) no se vuelve a mandar */
    reset(){ finals = ""; interim = ""; consumed = lastLen; },
    get on(){ return !ended; },
  };
  if(DICT) DICT.stop();
  DICT = api;
  limT = setTimeout(() => halt("limit"), limit);
  recSet(tok);
  begin();
  return api;
}
const dictStop = () => { if(DICT) DICT.stop(); };

/* ---------- el reloj de «Explain it» (sigue contando pasado el tiempo; nunca para la respuesta) ---------- */
function timerHtml(secs){
  return `<span class="tp-ltm" role="timer" aria-label="Suggested time ${mmss(secs)}"><span class="tp-ltm-r" aria-hidden="true">${ui.ring(0, {size: 36})}</span><span class="tp-ltm-t">0:00</span><span class="tp-ltm-of">of ${mmss(secs)}</span></span>`;
}
function timerRun(box, secs, start = 0){
  let base = Math.max(0, +start || 0), t0 = 0, on = false, iv = 0, lastP = -1;
  const val = () => base + (on ? (now() - t0) / 1000 : 0);
  const paint = () => {
    if(!box || !box.isConnected) return;
    const v = val(), p = Math.min(100, Math.floor(100 * v / secs)), over = v >= secs;
    const t = box.querySelector(".tp-ltm-t"); if(t) t.textContent = mmss(v);
    const of = box.querySelector(".tp-ltm-of"); if(of) of.textContent = over ? `· over ${mmss(secs)}` : `of ${mmss(secs)}`;
    if(p !== lastP){ lastP = p; const r = box.querySelector(".tp-ltm-r"); if(r) r.innerHTML = ui.ring(p, {size: 36}); }
    box.classList.toggle("is-over", over);
  };
  return {
    start(){ if(on) return; on = true; t0 = now(); paint(); iv = setInterval(paint, 1000); },
    stop(){ if(!on) return; base = val(); on = false; clearInterval(iv); paint(); },
    value: val, paint,
    destroy(){ clearInterval(iv); if(on){ base = val(); on = false; } },
  };
}

/* ---------- diagramas: flow (capas de arriba abajo en el móvil, de izquierda a derecha si cabe) y sequence ---------- */
function dgModel(d){
  const nodes = (d && Array.isArray(d.nodes) ? d.nodes : []).filter(n => n && n.id != null);
  const by = {}; nodes.forEach(n => { by[n.id] = n; });
  const edges = (d && Array.isArray(d.edges) ? d.edges : []).filter(e => e && by[e.from] && by[e.to]);
  return {nodes, by, edges, layout: d && d.layout === "sequence" ? "sequence" : "flow"};
}
/* capas por anchura (BFS desde los nodos sin entrada); dentro de cada capa, en el orden de sus padres */
function dgLayers(m){
  const inc = {}; m.nodes.forEach(n => { inc[n.id] = 0; });
  m.edges.forEach(e => { if(e.from !== e.to) inc[e.to]++; });
  const L = {}, q = [];
  let roots = m.nodes.filter(n => !inc[n.id]); if(!roots.length && m.nodes.length) roots = [m.nodes[0]];
  roots.forEach(r => { L[r.id] = 0; q.push(r.id); });
  for(let i = 0; i < q.length; i++){
    const u = q[i];
    for(const e of m.edges) if(e.from === u && L[e.to] == null){ L[e.to] = L[u] + 1; q.push(e.to); }
    if(i === q.length - 1){ const rest = m.nodes.find(n => L[n.id] == null); if(rest){ L[rest.id] = 0; q.push(rest.id); } }
  }
  const layers = []; q.forEach(id => { (layers[L[id]] = layers[L[id]] || []).push(id); });
  return {L, layers: layers.filter(Boolean)};
}
/* o: {slots: true (los nodos slot son huecos), blank(i)} → HTML; dgFit(fig) lo coloca (y otra vez al cambiar el ancho) */
function dgHtml(d, o = {}){
  const m = dgModel(d); if(!m.nodes.length) return "";
  const slotIx = {}; let si = 0;
  if(o.slots) m.nodes.forEach(n => { if(n.slot) slotIx[n.id] = si++; });
  const name = id => slotIx[id] != null ? `blank ${slotIx[id] + 1}` : m.by[id].label;
  const node = id => {
    const n = m.by[id];
    if(slotIx[id] != null) return `<button type="button" class="tp-ldg-n tp-ldg-slot is-empty" data-n="${esc(id)}" data-slot="${slotIx[id]}" aria-pressed="false"><span class="tp-lsl-t">Blank ${slotIx[id] + 1}</span></button>`;
    return `<div class="tp-ldg-n" data-n="${esc(id)}">${esc(n.label).replace(/\//g, "/<wbr>")}</div>`;
  };
  const desc = m.edges.map((e, i) => m.layout === "sequence" ? `${i + 1}. ${name(e.from)} to ${name(e.to)}${e.label ? ": " + e.label : ""}.` : `${name(e.from)} to ${name(e.to)}${e.label ? ": " + e.label : ""}.`).join(" ");
  if(m.layout === "sequence"){
    const ix = {}; m.nodes.forEach((n, i) => { ix[n.id] = i; });
    const N = m.nodes.length;
    return `<figure class="tp-ldg tp-ldg-seq" style="--n:${N}" data-n="${N}">
      <div class="tp-ldg-sh">${m.nodes.map(n => node(n.id)).join("")}</div>
      <ol class="tp-ldg-ms" aria-hidden="true">${m.nodes.map((n, i) => `<i class="tp-ldg-life" style="left:${((i + .5) / N * 100).toFixed(3)}%"></i>`).join("")}${m.edges.map((e, k) => {
        const a = ix[e.from], b = ix[e.to], lo = Math.min(a, b), hi = Math.max(a, b);
        return `<li class="tp-ldg-m" data-a="${a}" data-b="${b}"><p class="tp-ldg-mt"><b>${k + 1}</b><span>${esc(e.label || "")}</span></p>
          <span class="tp-ldg-ma ${b >= a ? "r" : "l"}" style="left:${((lo + .5) / N * 100).toFixed(3)}%;width:${(Math.max(.3, hi - lo) / N * 100).toFixed(3)}%"></span></li>`;
      }).join("")}</ol>
      <figcaption class="vh">Sequence diagram. ${esc(desc)}</figcaption></figure>`;
  }
  const {L, layers} = dgLayers(m);
  const fwd = [], other = [];
  m.edges.forEach(e => { (L[e.to] === L[e.from] + 1 ? fwd : other).push(e); });
  const mk = uid("tp-ldg-a");
  return `<figure class="tp-ldg tp-ldg-flow" data-dir="ttb" data-layers="${layers.length}" data-mk="${mk}">
    <div class="tp-ldg-w">${layers.map((ly, k) => `${k ? `<div class="tp-ldg-gap" data-gap="${k - 1}"></div>` : ""}<div class="tp-ldg-row" style="--c:${ly.length}">${ly.map(node).join("")}</div>`).join("")}
      <svg class="tp-ldg-svg" aria-hidden="true" focusable="false"><defs><marker id="${mk}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs><g></g></svg>
      ${fwd.map((e, j) => `<span class="tp-ldg-lb" aria-hidden="true" data-e="${j}" data-from="${esc(e.from)}" data-to="${esc(e.to)}" data-gap="${L[e.from]}">${esc(e.label || "")}</span>`).join("")}
    </div>
    ${other.length ? `<ul class="tp-ldg-more" aria-hidden="true">${other.map(e => `<li>${icon(L[e.to] <= L[e.from] ? "arrow-counter-clockwise" : "arrow-right", "bold", 18)}<span><b data-ln="${esc(e.from)}">${esc(slotIx[e.from] != null ? `Blank ${slotIx[e.from] + 1}` : m.by[e.from].label)}</b> → <b data-ln="${esc(e.to)}">${esc(slotIx[e.to] != null ? `Blank ${slotIx[e.to] + 1}` : m.by[e.to].label)}</b>${e.label ? `<span class="tp-ldg-ol">${esc(e.label)}</span>` : ""}</span></li>`).join("")}</ul>` : ""}
    <figcaption class="vh">Diagram. ${esc(desc)}</figcaption></figure>`;
}
const FIT = new WeakMap();
function dgFit(fig){
  if(!fig || !fig.isConnected || !fig.getClientRects().length) return;
  if(!FIT.has(fig) && typeof ResizeObserver === "function"){
    let w0 = 0;
    const ro = new ResizeObserver(() => { if(!fig.isConnected){ ro.disconnect(); return; } const w = Math.round(fig.clientWidth); if(w !== w0){ w0 = w; requestAnimationFrame(() => dgFit(fig)); } });
    ro.observe(fig); FIT.set(fig, ro);
    try{ D.fonts.ready.then(() => dgFit(fig)); }catch(e){}
  }
  if(fig.classList.contains("tp-ldg-seq")) return seqFit(fig);
  const w = fig.querySelector(".tp-ldg-w"); if(!w) return;
  const W = w.clientWidth, nl = +fig.dataset.layers || 1;
  const gaps = $$(".tp-ldg-gap", w), lbs = $$(".tp-ldg-lb", w);
  let RC = {};
  const rectOf = id => {
    if(RC[id] !== undefined) return RC[id];
    const el = w.querySelector(`[data-n="${CSS.escape(id)}"]`); if(!el) return (RC[id] = null);
    const b = w.getBoundingClientRect(), r = el.getBoundingClientRect();
    return (RC[id] = {l: r.left - b.left, t: r.top - b.top, r: r.right - b.left, b: r.bottom - b.top, cx: (r.left + r.right) / 2 - b.left, cy: (r.top + r.bottom) / 2 - b.top});
  };
  const gapBox = g => { const b = w.getBoundingClientRect(), r = g.getBoundingClientRect(); return {t: r.top - b.top, b: r.bottom - b.top, l: r.left - b.left, r: r.right - b.left}; };
  /* una etiqueta por salida cuando todas las de un mismo nodo dicen lo mismo («own copy», «emits») */
  const gkey = lb => `${lb.dataset.gap}|${lb.dataset.from}|${lb.textContent}`, groups = {};
  lbs.forEach(lb => { (groups[gkey(lb)] = groups[gkey(lb)] || []).push(lb); });
  lbs.forEach(lb => { lb.hidden = !lb.textContent.trim(); });
  Object.values(groups).forEach(g => { if(g.length > 1) g.slice(1).forEach(lb => { lb.hidden = true; }); });
  const merged = lb => (groups[gkey(lb)] || []).length > 1;
  /* de izquierda a derecha si cabe: ancho, 2-3 capas y una sola etiqueta en cada hueco */
  const perGap = {}; lbs.forEach(lb => { if(!lb.hidden) perGap[lb.dataset.gap] = (perGap[lb.dataset.gap] || 0) + 1; });
  const ltr = W >= 560 && nl > 1 && nl <= 3 && Object.values(perGap).every(n => n <= 1);
  fig.dataset.dir = ltr ? "ltr" : "ttb";
  gaps.forEach(g => { g.style.height = ""; g.style.width = ""; });
  w.style.paddingTop = "";
  /* los extremos de cada flecha, repartidos por el borde cuando de un nodo salen (o a él llegan) varias: nunca un «^» */
  const outs = {}, ins = {};
  lbs.forEach(lb => { (outs[lb.dataset.from] = outs[lb.dataset.from] || []).push(lb); (ins[lb.dataset.to] = ins[lb.dataset.to] || []).push(lb); });
  const sortBy = (arr, f) => arr.sort((a, z) => { const A = rectOf(f(a)), Z = rectOf(f(z)); return !A || !Z ? 0 : ltr ? A.cy - Z.cy : A.cx - Z.cx; });
  Object.values(outs).forEach(a => sortBy(a, lb => lb.dataset.to));
  Object.values(ins).forEach(a => sortBy(a, lb => lb.dataset.from));
  const off = (arr, me, room) => { const n = arr.length; if(n < 2) return 0; const step = Math.min(ltr ? 14 : 40, room * .6 / (n - 1)); return (arr.indexOf(me) - (n - 1) / 2) * step; };
  const pts = lb => {
    const s = rectOf(lb.dataset.from), t = rectOf(lb.dataset.to); if(!s || !t) return null;
    const so = off(outs[lb.dataset.from], lb, ltr ? s.b - s.t : s.r - s.l), to = off(ins[lb.dataset.to], lb, ltr ? t.b - t.t : t.r - t.l);
    return ltr ? {x1: s.r, y1: s.cy + so, x2: t.l - 2, y2: t.cy + to, s, t} : {x1: s.cx + so, y1: s.b, x2: t.cx + to, y2: t.t - 2, s, t};
  };
  const byGap = {};
  lbs.forEach(lb => { if(!lb.hidden) (byGap[lb.dataset.gap] = byGap[lb.dataset.gap] || []).push(lb); });
  const PAD = 11, place = [];
  if(!ltr){
    /* de arriba abajo: cada etiqueta sobre su propia flecha, en carriles si no caben juntas; el hueco crece lo justo */
    for(const k of Object.keys(byGap)){
      const list = byGap[k], g = gaps[+k]; if(!g) continue;
      const gb = gapBox(g), maxW = Math.max(110, Math.min(W * .86, list.length > 1 ? W / list.length + 40 : W * .86));
      const items = list.map(lb => {
        lb.style.maxWidth = `${Math.round(maxW)}px`; lb.style.left = "0"; lb.style.top = "0";
        const p = pts(lb) || {x1: W / 2, x2: W / 2, y1: gb.t, y2: gb.b, s: {cx: W / 2}};
        return {lb, w: lb.offsetWidth, h: lb.offsetHeight, x1: p.x1, x2: p.x2, d1: gb.t - p.y1, d2: p.y2 - gb.b, sx: p.s.cx, m: merged(lb)};
      });
      const lh = Math.max(22, ...items.map(i => i.h));
      const H = L => 2 * PAD + L * lh + (L - 1) * 6;
      const xAt = (o, ln, L) => { const yc = PAD + ln * (lh + 6) + lh / 2, tt = (yc + o.d1) / Math.max(1, H(L) + o.d1 + o.d2);
        const x = o.m ? o.sx : o.x1 + (o.x2 - o.x1) * tt; return Math.max(o.w / 2 + 2, Math.min(W - o.w / 2 - 2, x)); };
      let L = 1, lanes = [];
      for(let pass = 0; pass < 6; pass++){
        lanes = [];
        for(const o of items.slice().sort((a, z) => (a.x1 + a.x2) - (z.x1 + z.x2))){
          let ln = 0;
          for(;; ln++){ o.x = xAt(o, ln, Math.max(L, ln + 1)); if(!lanes[ln] || !lanes[ln].some(q => Math.abs(q.x - o.x) < (q.w + o.w) / 2 + 8)) break; }
          (lanes[ln] = lanes[ln] || []).push(o); o.ln = ln;
        }
        if(lanes.length <= L) break;
        L = lanes.length;
      }
      L = Math.max(1, lanes.length);
      items.forEach(o => { o.x = xAt(o, o.ln, L); });
      g.style.height = `${Math.max(40, H(L))}px`;
      place.push({g, items, lh});
    }
  } else {
    for(const k of Object.keys(byGap)){
      const list = byGap[k];
      list.forEach(lb => { lb.style.maxWidth = "170px"; lb.style.left = "0"; lb.style.top = "0"; });
      const mw = Math.max(40, ...list.map(lb => lb.offsetWidth));
      const g = gaps[+k]; if(g) g.style.width = `${Math.min(220, Math.max(72, mw + 48))}px`;
    }
    /* sitio encima de las flechas para sus etiquetas */
    const lhMax = Math.max(0, ...lbs.filter(lb => !lb.hidden).map(lb => lb.offsetHeight));
    if(lhMax) w.style.paddingTop = `${Math.round(lhMax + 4)}px`;
  }
  RC = {};   /* con los huecos ya medidos, las cajas están en su sitio */
  const svg = w.querySelector(".tp-ldg-svg"), gEl = svg && svg.querySelector("g"); if(!gEl) return;
  const WW = w.scrollWidth, HH = w.scrollHeight;
  svg.setAttribute("width", WW); svg.setAttribute("height", HH); svg.setAttribute("viewBox", `0 0 ${WW} ${HH}`);
  const mk = fig.dataset.mk, f1 = v => v.toFixed(1);
  gEl.innerHTML = lbs.map(lb => { const p = pts(lb); return p ? `<path d="M${f1(p.x1)} ${f1(p.y1)}L${f1(p.x2)} ${f1(p.y2)}" marker-end="url(#${mk})"/>` : ""; }).join("");
  if(!ltr){
    for(const {g, items, lh} of place){
      const top = gapBox(g).t;
      items.forEach(o => { o.lb.style.left = `${f1(o.x - o.w / 2)}px`; o.lb.style.top = `${f1(top + PAD + o.ln * (lh + 6))}px`; });
    }
  } else {
    for(const k of Object.keys(byGap)){
      /* la etiqueta, encima de su flecha (la flecha se ve entera) */
      byGap[k].forEach(lb => { const p = pts(lb); if(!p) return;
        const lw = lb.offsetWidth, lh = lb.offsetHeight, x = (p.x1 + p.x2) / 2, y = Math.min(p.y1, p.y2) - lh - 3;
        lb.style.left = `${f1(x - lw / 2)}px`; lb.style.top = `${f1(Math.max(0, y))}px`; });
    }
  }
}
function seqFit(fig){
  const ms = fig.querySelector(".tp-ldg-ms"); if(!ms) return;
  const N = +fig.dataset.n || 1, Wd = ms.clientWidth, col = Wd / N;
  $$(".tp-ldg-m", ms).forEach(li => {
    const a = +li.dataset.a, b = +li.dataset.b, lo = Math.min(a, b), hi = Math.max(a, b), span = (hi - lo) * col;
    const t = li.querySelector(".tp-ldg-mt");
    if(span >= 150){ t.style.marginLeft = `${((lo + .5) * col).toFixed(1)}px`; t.style.width = `${span.toFixed(1)}px`; t.classList.add("on-span"); }
    else { t.style.marginLeft = ""; t.style.width = ""; t.classList.remove("on-span"); }
  });
}
function fitAll(root){ $$(".tp-ldg", root).forEach(f => dgFit(f)); }

/* ---------- huecos que se rellenan con fichas (code y diagram) ---------- */
/* root: tiene [data-slot=i] (huecos) y [data-chip=c] (fichas). o: {answers: [texto de cada hueco], chips: [texto],
   blank(i), name(i)}. Tocar un hueco lo elige (otra vez, lo vacía); tocar una ficha la pone en el elegido (o en el primero
   vacío); arrastrar una ficha a un hueco también. */
function filler(root, o){
  const n = o.answers.length;
  const F = {fill: Array(n).fill(null), sel: 0, marks: null, locked: false, onChange: null, n};
  const firstEmpty = (from = 0) => { for(let k = 0; k < n; k++){ const i = (from + k) % n; if(F.fill[i] == null) return i; } return null; };
  const slotEls = () => $$("[data-slot]", root), chipEls = () => $$("[data-chip]", root);
  function paint(){
    slotEls().forEach(el => {
      const i = +el.dataset.slot, c = F.fill[i], mk = F.marks ? F.marks[i] : null;
      const t = el.querySelector(".tp-lsl-t"); if(t) t.textContent = c == null ? o.blank(i) : o.chips[c];
      el.classList.toggle("is-empty", c == null);
      el.classList.toggle("is-sel", F.sel === i && !F.locked);
      el.classList.toggle("is-ok", mk === true); el.classList.toggle("is-miss", mk === false);
      el.setAttribute("aria-pressed", String(F.sel === i && !F.locked));
      let m = el.querySelector(".tp-lmk"); if(m) m.remove();
      if(mk != null) el.insertAdjacentHTML("beforeend", mk ? MK_OK : MK_NO);
      el.setAttribute("aria-label", `${o.name(i)}: ${c == null ? "empty" : o.chips[c]}${mk === true ? ", correct" : mk === false ? ", not right" : ""}`);
      if(F.locked) el.setAttribute("aria-disabled", "true"); else el.removeAttribute("aria-disabled");
    });
    chipEls().forEach(el => { const used = F.fill.includes(+el.dataset.chip); el.classList.toggle("is-used", used); el.disabled = used || F.locked; });
    /* contestado: fuera las fichas que sobran (y la pista de cómo se rellena) */
    $$(".tp-lchips, .tp-lhint", root).forEach(el => { el.hidden = F.locked; });
    if(F.locked) $$(".tp-lpre", root).forEach(p => { p.scrollLeft = 0; });
    call(F.onChange, F);
  }
  function place(c, i){
    if(F.locked) return;
    if(i == null) i = firstEmpty(F.sel || 0);
    if(i == null) i = F.sel != null ? F.sel : 0;
    const prev = F.fill.indexOf(c); if(prev >= 0) F.fill[prev] = null;
    F.fill[i] = c; F.marks = null;
    F.sel = firstEmpty(i + 1);
    haptic("selection"); paint();
  }
  root.addEventListener("click", e => {
    if(F.locked) return;
    const sl = e.target.closest("[data-slot]"), ch = e.target.closest("[data-chip]");
    if(sl && root.contains(sl)){
      const i = +sl.dataset.slot;
      if(F.sel === i && F.fill[i] != null){ F.fill[i] = null; F.marks = null; } else F.sel = i;
      paint(); return;
    }
    if(ch && root.contains(ch) && !ch.disabled){
      place(+ch.dataset.chip, F.sel != null && F.fill[F.sel] == null ? F.sel : (F.sel != null ? F.sel : null));
      /* con el teclado (la ficha usada ya no se puede pulsar): a la siguiente ficha, o al «Check» si está todo */
      if(e.detail === 0){ const nx = chipEls().find(c => !c.disabled); if(F.full() || !nx) focusCheck(); else try{ nx.focus({preventScroll: true}); }catch(err){} }
    }
  });
  const hov = el => { $$("[data-slot].is-hover", root).forEach(x => { if(x !== el) x.classList.remove("is-hover"); }); if(el) el.classList.add("is-hover"); };
  const slotAt = over => { const s = over && over.closest ? over.closest("[data-slot]") : null; return s && root.contains(s) ? s : null; };
  if(W.G && typeof G.drag === "function") chipEls().forEach(el => G.drag(el, {ghost: true,
    onStart: () => (F.locked || el.disabled) ? false : undefined,
    onMove: i => hov(slotAt(i.over)),
    onDrop: i => { const s = slotAt(i.over); hov(null); if(!s) return false; place(+el.dataset.chip, +s.dataset.slot); return true; },
    onCancel: () => hov(null)}));
  Object.assign(F, {
    paint, place,
    full: () => F.fill.every(c => c != null),
    check(){ F.marks = F.fill.map((c, i) => c != null && o.chips[c] === o.answers[i]); paint(); return F.marks.every(Boolean); },
    right: () => (F.marks || []).filter(Boolean).length,
    reveal(){
      const used = new Set();
      F.fill = o.answers.map(a => { const c = o.chips.findIndex((t, k) => t === a && !used.has(k)); used.add(c); return c >= 0 ? c : null; });
      F.marks = null; F.locked = true; paint();   /* la respuesta, sin verde: no la puso el usuario */
    },
    lock(){ F.locked = true; paint(); },
  });
  paint();
  return F;
}

/* ---------- piezas comunes ---------- */
const MK_OK = `<span class="tp-lmk tp-lmk-ok" aria-hidden="true">${ico("check", "bold", 20)}</span>`;
const MK_NO = `<span class="tp-lmk tp-lmk-no" aria-hidden="true">${ico("x", "bold", 20)}</span>`;
const EYE = {card: "New term", pick: "Choose one", tf: "True or false?", scenario: "Scenario", match: "Match", order: "Put in order",
  code: "Complete the code", diagram: "Complete the diagram", explain: "Explain it", say: "Say it", story: "Story", flip: "Do you know it?"};
const eyeOf = (ctx, type) => ctx.eye || `${ctx.re ? "Again · " : ""}${EYE[type] || ""}`;
/* el enlace «Source»: el src de la unidad, o el source {title, url} / url que traiga el ítem (las preguntas de un caso) */
function srcOf(ctx, it){
  if(!it) return "";
  if(ctx.unit && it.src){ const h = ui.src(ctx.unit, it.src); if(h) return h; }
  const s = isObj(it.source) ? it.source : {url: it.url, title: ""};
  if(!s.url || !/^https:\/\//.test(s.url)) return "";
  return `<a class="tp-src" href="${esc(s.url)}" target="_blank" rel="noopener" data-no-gate${s.title ? ` title="${esc(s.title)}"` : ""}>${icon("arrow-square-out", "bold", 16)}<span>Source</span><span class="vh">${s.title ? `: ${esc(s.title)}` : ""} (opens in a new tab)</span></a>`;
}
function verdict(state, msg){
  const ok = state === true;
  return `<p class="tp-lv ${ok ? "ok" : "miss"}">${icon(ok ? "check-circle" : "x-circle", "fill", 22)}<span>${esc(msg || (ok ? "Correct" : "Not quite"))}</span></p>`;
}
function feedback(box, o){
  if(!box) return;
  box.innerHTML = `${verdict(o.ok, o.msg)}${o.why ? `<p class="tp-lwhy">${esc(o.why)}</p>` : ""}${o.src ? `<div class="tp-lsrc">${o.src}</div>` : ""}`;
  box.hidden = false;
  showSoon(box);
}
/* que se vea lo que acaba de salir (sin quedar bajo el botón fijo de abajo) */
function showSoon(el){
  requestAnimationFrame(() => {
    if(!el || !el.isConnected) return;
    const r = el.getBoundingClientRect(), dock = D.getElementById("tp-ldock"), dh = dock && !dock.hidden ? dock.getBoundingClientRect().height + 40 : 24;
    const over = r.bottom - (innerHeight - dh);
    if(over > 0) try{ scrollBy({top: Math.min(over, Math.max(0, r.top - 80)), behavior: rm() ? "auto" : "smooth"}); }catch(e){ scrollBy(0, over); }
  });
}
const optHtml = (t, k, i, extra = "") => `<button type="button" class="tp-lopt" data-i="${i}"${k < 4 ? ` data-key="${k + 1}"` : ""}>${k < 4 ? `<kbd class="tp-lk" aria-hidden="true">${k + 1}</kbd>` : ""}<span class="tp-lot">${esc(t)}${extra}</span></button>`;
function markOpts(wrap, right, chosen){
  $$(".tp-lopt", wrap).forEach(b => {
    const i = +b.dataset.i; b.disabled = true;
    if(i === right){ b.classList.add("is-ok"); b.insertAdjacentHTML("beforeend", `${MK_OK}<span class="vh">, the right answer</span>`); }
    else if(i === chosen){ b.classList.add("is-miss"); b.insertAdjacentHTML("beforeend", `${MK_NO}<span class="vh">, your answer, not right</span>`); }
    else b.classList.add("is-dim");
  });
}
const focusCheck = () => { const c = D.getElementById("tp-lcheck"); if(c) try{ c.focus({preventScroll: true}); }catch(e){} };
/* el altavoz principal de una pantalla responde a Espacio (Mayús+Espacio, despacio: js/keys.js) */
function spaceKey(box){ const b = box.querySelector(".tp-say:not(.tp-say-slow), [data-say]:not([data-slow])"); if(b){ b.setAttribute("data-key", "space"); b.setAttribute("data-key-label", "Space"); } }
function sayBtn(text, label = "Listen"){
  return `<span class="tp-lsays"><button type="button" class="glass-btn glass-btn--sm tp-llisten" data-say="${esc(text)}" data-key="space" data-key-label="Space">${icon("speaker-high", "bold", 18)}<span>${esc(label)}</span></button><button type="button" class="tp-say" data-say="${esc(text)}" data-slow aria-label="${esc(label)} slowly" title="${esc(label)} slowly">${icon("turtle", "fill", 22)}</button></span>`;
}

/* ---------- «Explain it» (también las historias de la entrevista y las preguntas de un caso) ---------- */
/* el: dónde se pinta. item: {id, q | prompt, seconds, model, keypoints, covers, template, src, url}.
   o: {dock(btns) (sin dock, los botones van dentro de el), unit, state {text, el, ph, star}, save(state), eyebrow,
   story (respuesta tipo STAR: la historia modelo y la lista para comprobarla), write (botón «Write yours»), onDone(r),
   onGrade(v, r)}. r = {text, secs, kp: {found, of}, star: [..]}. Devuelve {phase, text(), state(), done(), grade(v), destroy()} */
function explain(el, item, o = {}){
  const secs = Math.max(30, Math.round(+item.seconds || 120)), q = String(item.q || item.prompt || "");
  const st = Object.assign({text: "", el: 0, ph: "answer", star: []}, isObj(o.state) ? o.state : {});
  if(!Array.isArray(st.star)) st.star = [];
  const can = dictCan(), id = uid("tp-lx"), story = !!o.story, kps = Array.isArray(item.keypoints) && item.keypoints.length ? item.keypoints : null;
  const covers = !kps && Array.isArray(item.covers) && item.covers.length ? item.covers : null;
  let tm = null, dict = null, base = "", saveT = 0, tickT = 0, dead = false, graded = false;
  const dockFn = typeof o.dock === "function" ? o.dock : null;
  const elapsed = () => tm ? tm.value() : st.el;
  const save = soon => {
    if(!o.save || dead) return;
    clearTimeout(saveT);
    const f = () => { if(!dead) call(o.save, {text: st.text, el: Math.round(elapsed()), ph: st.ph, star: st.star.slice()}); };
    if(soon === true) f(); else saveT = setTimeout(f, 400);
  };
  const ta = () => el.querySelector(".tp-lta");
  const status = (t, cls = "") => { const s = el.querySelector(".tp-lstat"); if(s){ s.textContent = t || ""; s.className = `tp-lstat${cls ? " " + cls : ""}`; s.hidden = !t; } };
  const micBtn = () => el.querySelector(".tp-lmic");
  const paintMic = on => {
    const b = micBtn(); if(!b) return;
    b.setAttribute("aria-pressed", String(!!on));
    b.innerHTML = on ? `${icon("stop", "fill", 18)}<span>Stop</span>` : `${icon("microphone", "bold", 18)}<span>Answer aloud</span>`;
  };
  const grow = () => { const t = ta(); if(!t) return; t.style.height = "auto"; t.style.height = `${Math.max(160, t.scrollHeight + 2)}px`; };
  function startDict(){
    if(dict && dict.on) return dict.stop();
    if(recBusy()){ status("The microphone is busy. Try again in a moment."); return; }
    T.stopSpeak();
    const t = ta(); base = t ? t.value.replace(/\s+$/, "") : "";
    paintMic(true);
    status("Listening · speak in English. You can edit the text afterwards.", "on");
    call(o.onStart);
    dict = dictStart({seconds: secs, lang: "en-GB",
      onText: tx => { const t2 = ta(); if(!t2 || dead) return; t2.value = base ? (tx ? `${base} ${tx}` : base) : tx; st.text = t2.value; grow(); save(); },
      onEnd: r => {
        dict = null; if(dead) return;
        paintMic(false);
        const M = {stopped: "", limit: `Stopped listening after ${mins(secs + 60)}. You can keep typing.`,
          denied: "The microphone isn't allowed here. You can type your answer instead.",
          unavailable: "Speech recognition isn't available right now (it may need a connection). You can type your answer instead.",
          unsupported: "This browser can't listen. You can type your answer instead.", busy: "The microphone is busy. Try again in a moment.",
          error: "Listening stopped. You can type, or tap Answer aloud again."};
        status(M[r.status] != null ? M[r.status] : M.error, r.status === "stopped" ? "" : "calm");
        if(r.status === "denied" || r.status === "unavailable" || r.status === "unsupported"){ const t2 = ta(); if(t2) try{ t2.focus({preventScroll: true}); }catch(e){} }
        save(true);
      }});
  }
  function paintAnswer(){
    el.innerHTML = `<div class="tp-litem tp-lex" data-ph="answer">
      <p class="tp-eyebrow">${esc(o.eyebrow || "Explain it")} · about ${esc(mins(secs))}</p>
      <h2 class="tp-lq" id="${id}-q" tabindex="-1">${esc(q)}</h2>
      <div class="tp-lexbar">${sayBtn(q, "Listen")}${timerHtml(secs)}</div>
      <div class="card tp-card tp-lans">
        ${can ? `<button type="button" class="glass-btn glass-btn--sm tp-lmic" data-mic aria-pressed="false">${icon("microphone", "bold", 18)}<span>Answer aloud</span></button>` : ""}
        <p class="tp-lstat" role="status" aria-live="polite" hidden></p>
        <label class="tp-llab" for="${id}-ta">Type your answer</label>
        <textarea class="tp-lta" id="${id}-ta" rows="6" lang="en-GB" spellcheck="true" autocomplete="off" placeholder="${can ? "Type here, or tap Answer aloud and speak" : "Type here, or say it aloud and note the main points"}"></textarea>
      </div>
      ${dockFn ? "" : `<div class="tp-lexb"><button type="button" class="glass-btn glass-btn--pri glass-btn--lg tp-lexdone">Done</button></div>`}
    </div>`;
    const t = ta(); t.value = st.text || ""; grow();
    t.addEventListener("input", e => {
      st.text = t.value; grow(); save();
      if(e.isTrusted && dict && dict.on){ base = t.value.replace(/\s+$/, ""); dict.reset(); }
      if(st.text.trim()) call(o.onStart);
    });
    t.addEventListener("keydown", e => { if(e.key === "Enter" && (e.ctrlKey || e.metaKey)){ e.preventDefault(); done(); } });
    const mb = micBtn(); if(mb) mb.addEventListener("click", startDict);
    const db = el.querySelector(".tp-lexdone"); if(db) db.addEventListener("click", done);
    tm = timerRun(el.querySelector(".tp-ltm"), secs, st.el); tm.start();
    tickT = setInterval(() => save(true), 5000);
    W.addEventListener("pagehide", onHide);   /* al recargar o cerrar: el texto y el reloj de ahora */
    if(dockFn) dockFn([{t: "Done", pri: true, key: "enter", id: "tp-ldone", on: done}]);
  }
  function done(){
    if(dead || st.ph !== "answer") return;
    if(dict && dict.on){ const d = dict; dict = null; d.stop(); }
    const t = ta(); if(t) st.text = t.value;
    st.el = Math.round(elapsed()); if(tm){ tm.stop(); tm.destroy(); tm = null; }
    clearInterval(tickT); W.removeEventListener("pagehide", onHide); T.stopSpeak();
    st.ph = "review"; save(true);
    call(o.onDone, result());
    paintReview();
    const h = el.querySelector(".tp-lq"); if(h) try{ h.focus({preventScroll: true}); }catch(e){}
    scrollTo(0, 0);
  }
  function result(){
    const k = kps ? keypoints(st.text, kps) : [];
    return {text: st.text, secs: st.el, kp: {found: k.filter(x => x.found).length, of: k.length}, star: st.star.slice()};
  }
  function modelHtml(){
    if(!item.model) return "";
    const parts = story ? storyParts(item.model, item.template) : null;
    const body = parts ? `<dl class="tp-lstory">${parts.map(p => `<dt>${esc(p.label)}</dt><dd>${esc(p.text)}</dd>`).join("")}</dl>` : `<p class="tp-ltext">${esc(item.model)}</p>`;
    return `<section class="card tp-card tp-lsec" aria-labelledby="${id}-m"><div class="tp-lsech"><h3 class="tp-lh3" id="${id}-m">${story ? "Model story" : "Model answer"}</h3>${ui.say(item.model, {label: story ? "Listen to the model story" : "Listen to the model answer"})}</div>${body}</section>`;
  }
  function pointsHtml(){
    if(kps){
      const k = keypoints(st.text, kps), f = k.filter(x => x.found).length;
      return `<section class="card tp-card tp-lsec" aria-labelledby="${id}-k"><h3 class="tp-lh3" id="${id}-k">Key points <span class="tp-lcnt">· ${f} of ${k.length} in your answer</span></h3>
        ${st.text.trim() ? "" : `<p class="tp-sub tp-lnote">Nothing was typed, so nothing is ticked. Compare what you said with this list.</p>`}
        <ul class="tp-lkps">${k.map(x => `<li class="tp-lkp${x.found ? " is-on" : ""}"><span class="tp-lkp-i" aria-hidden="true">${x.found ? icon("check-circle", "fill", 22) : icon("circle", "bold", 22)}</span><span class="tp-lkp-t"><span class="vh">${x.found ? "In your answer: " : "Not in your answer: "}</span>${esc(x.text)}${x.found ? `<small>You said “${esc(x.kw)}”</small>` : ""}</span></li>`).join("")}</ul></section>`;
    }
    if(covers) return `<section class="card tp-card tp-lsec" aria-labelledby="${id}-c"><h3 class="tp-lh3" id="${id}-c">A strong answer covers</h3><ul class="tp-lcov">${covers.map(c => `<li>${esc(c)}</li>`).join("")}</ul></section>`;
    if(story){
      const L = Array.isArray(item.template) && item.template.length ? item.template : STAR;
      return `<section class="card tp-card tp-lsec"><fieldset class="tp-lstar"><legend class="tp-lh3">Did your answer have…</legend>${L.map((l, i) => `<label class="tp-lchk"><input type="checkbox" data-star="${i}"${st.star.includes(i) ? " checked" : ""}><span>${esc(l)}</span></label>`).join("")}</fieldset></section>`;
    }
    return "";
  }
  function paintReview(){
    const words = nWords(st.text), src = srcOf({unit: o.unit}, item);
    el.innerHTML = `<div class="tp-litem tp-lex" data-ph="review">
      <p class="tp-eyebrow">${esc(o.eyebrow || "Explain it")}</p>
      <h2 class="tp-lq" tabindex="-1">${esc(q)}</h2>
      <section class="card tp-card tp-lsec" aria-labelledby="${id}-y"><h3 class="tp-lh3" id="${id}-y">Your answer</h3>
        ${st.text.trim() ? `<p class="tp-ltext tp-lyours">${esc(st.text.trim())}</p>` : `<p class="tp-sub">You didn't type anything.</p>`}
        <p class="tp-lmeta">${icon("timer", "bold", 18)}<span>${mmss(st.el)}${words ? ` · ${plural(words, "word", "words")}` : ""}</span></p></section>
      ${modelHtml()}${pointsHtml()}
      ${o.write ? `<div class="tp-lwrite">${o.write}</div>` : ""}
      ${src ? `<div class="tp-lsrc">${src}</div>` : ""}
      <h3 class="tp-lh3 tp-lhow" id="${id}-h">How did it go?</h3>
      ${dockFn ? "" : `<div class="tp-lgrades" role="group" aria-labelledby="${id}-h">${gradeBtns().map(b => `<button type="button" class="glass-btn tp-lgr" data-v="${b.v}">${esc(b.t)}</button>`).join("")}</div>`}
    </div>`;
    el.querySelectorAll("[data-star]").forEach(c => c.addEventListener("change", () => { const i = +c.dataset.star; st.star = st.star.filter(x => x !== i); if(c.checked) st.star.push(i); save(true); }));
    el.querySelectorAll(".tp-lgr[data-v]").forEach(b => b.addEventListener("click", () => grade(b.dataset.v)));
    call(o.onReview, el);
    if(dockFn) dockFn(gradeBtns().map((b, i) => ({t: b.t, key: String(i + 1), cls: "tp-lgr", id: `tp-lg-${b.v}`, on: () => grade(b.v), label: `${b.t}. How did it go?`})));
  }
  const gradeBtns = () => [{v: "notyet", t: "Not yet"}, {v: "partly", t: "Partly"}, {v: "nailed", t: "Nailed it"}];
  function grade(v){
    if(graded || dead || !["notyet", "partly", "nailed"].includes(v)) return;
    graded = true; if(v === "nailed") haptic("success");
    T.stopSpeak();
    call(o.onGrade, v, result());
    if(!dockFn){ const g = el.querySelector(".tp-lgrades"); if(g){ g.querySelectorAll("button").forEach(b => { b.disabled = true; b.setAttribute("aria-pressed", String(b.dataset.v === v)); }); } }
  }
  function onHide(){ if(st.ph === "answer"){ const t = ta(); if(t) st.text = t.value; save(true); } }
  function destroy(){
    dead = true; clearTimeout(saveT); clearInterval(tickT); W.removeEventListener("pagehide", onHide);
    if(tm){ tm.destroy(); }
    if(dict && dict.on){ const d = dict; dict = null; d.stop(); }
  }
  if(st.ph === "review") paintReview(); else paintAnswer();
  return {get phase(){ return st.ph; }, text: () => st.text, state: () => Object.assign({}, st, {el: Math.round(elapsed())}), done, grade, destroy};
}

/* la historia modelo por partes («Situation: … Task: …») */
function storyParts(model, template){
  const labels = (Array.isArray(template) && template.length ? template : STAR).map(String);
  const re = new RegExp(`(?:^|\\s)(${labels.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}):\\s*`, "g");
  const out = []; let m, last = null;
  while((m = re.exec(model))){ if(last) last.text = model.slice(last.end, m.index).trim(); last = {label: m[1], end: re.lastIndex, text: ""}; out.push(last); }
  if(last) last.text = model.slice(last.end).trim();
  return out.length >= 2 && out.every(p => p.text) ? out.map(p => ({label: p.label, text: p.text})) : null;
}
/* «Write yours»: un borrador en My stories (story/<id>, el que ya hay para ese ítem si existe) */
function storyDraft(it){
  const ex = T.list("story").find(s => s.from === it.id);
  if(ex) return ex.id;
  const sid = "s" + now().toString(36) + Math.random().toString(36).slice(2, 6);
  T.put("story", sid, {title: "", prompt: String(it.prompt || ""), fields: {situation: "", task: "", action: "", result: "", lessons: ""}, from: it.id});   /* My stories enseña el prompt hasta que tenga título */
  return sid;
}

/* ---------- los tipos de ítem ---------- */
/* R[type](box, item, ctx). ctx: {mode, unit, re, cur, eye, dock(btns), answer(res), finish(ok), next(), save(cur), leave(fn),
   started(), write(it)} */
const R = {};
R.card = (box, it, ctx) => {
  const x = ctx.unit && Array.isArray(ctx.unit.terms) ? ctx.unit.terms.find(t => t.id === it.term) : null;
  const src = srcOf(ctx, it.src ? it : x);
  box.innerHTML = `<article class="card tp-card tp-litem tp-lcard">
    <p class="tp-eyebrow">${esc(eyeOf(ctx, "card"))}</p>
    ${x ? ui.term(x, {def: true, example: true}).replace('class="tp-term-t"', 'class="tp-term-t" tabindex="-1"') : `<p class="tp-sub">This card's term is missing.</p>`}
    ${it.diagram ? dgHtml(it.diagram) : ""}
    ${src ? `<div class="tp-lsrc">${src}</div>` : ""}
  </article>`;
  spaceKey(box); fitAll(box);
  ctx.dock([{t: "Continue", pri: true, key: "enter", on: () => { ctx.answer({g: null, seen: true}); ctx.next(); }}]);
};
/* en el repaso, la tarjeta gira: el término (con su IPA y el altavoz) → la definición; «Did you know it?» No / Yes */
R.flip = (box, it, ctx) => {
  const x = ctx.unit && Array.isArray(ctx.unit.terms) ? ctx.unit.terms.find(t => t.id === it.term) : null;
  if(!x){ ctx.answer({g: null, skip: true}); return ctx.next(); }
  const id = uid("tp-lf");
  box.innerHTML = `<article class="card tp-card tp-litem tp-lcard tp-lflip" data-side="front">
    <p class="tp-eyebrow">${esc(eyeOf(ctx, "flip"))}</p>
    <div class="tp-term"><div class="tp-term-h"><span class="tp-term-t" id="${id}" tabindex="-1">${esc(x.term)}</span>${ui.say(x.say || x.term)}</div>${ui.ipa(x.ipa)}</div>
    <div class="tp-lback" id="${id}-b" hidden>${x.def ? `<p class="tp-def">${esc(x.def)}</p>` : ""}${ui.quote(x.example)}${it.diagram ? dgHtml(it.diagram) : ""}${srcOf(ctx, it.src ? it : x) ? `<div class="tp-lsrc">${srcOf(ctx, it.src ? it : x)}</div>` : ""}</div>
  </article>`;
  spaceKey(box);
  const show = () => {
    const b = $(`#${id}-b`, box); if(!b || !b.hidden) return;
    b.hidden = false; box.querySelector(".tp-lflip").dataset.side = "back"; fitAll(box); showSoon(b);
    const fin = g => { ctx.answer({g}); if(g === 2){ haptic("success"); okAnim(box.querySelector(".tp-lflip")); } ctx.next(); };
    ctx.dock([{t: "No", key: "1 left", id: "tp-lno", on: () => fin(0)}, {t: "Yes", ok: true, key: "2 right", id: "tp-lyes", on: () => fin(2)}]);
    const h = $(".tp-lback", box); if(h) h.setAttribute("aria-live", "polite");
    ctx.started();
  };
  ctx.dock([{t: "Show meaning", pri: true, key: "enter", on: show}]);
};
R.pick = (box, it, ctx) => {
  const qid = uid("tp-lq"), order = mix(it.options.map((t, i) => i));
  box.innerHTML = `<article class="tp-litem" aria-labelledby="${qid}">
    <p class="tp-eyebrow">${esc(eyeOf(ctx, "pick"))}</p>
    <h2 class="tp-lq" id="${qid}" tabindex="-1">${esc(it.q)}</h2>
    <div class="tp-lopts" role="group" aria-labelledby="${qid}">${order.map((i, k) => optHtml(it.options[i], k, i)).join("")}</div>
    <div class="tp-lfb" role="status" hidden></div></article>`;
  let done = false;
  box.querySelector(".tp-lopts").addEventListener("click", e => {
    const b = e.target.closest(".tp-lopt"); if(!b || done || b.disabled) return;
    done = true;
    const ch = +b.dataset.i, ok = ch === it.answer;
    markOpts(box, it.answer, ch);
    if(ok){ haptic("success"); okAnim(b); }
    ctx.answer({g: ok ? 2 : 0});
    feedback(box.querySelector(".tp-lfb"), {ok, why: it.why, src: srcOf(ctx, it)});
    ctx.finish(ok);
  });
};
R.tf = (box, it, ctx) => {
  const qid = uid("tp-lq");
  box.innerHTML = `<article class="tp-litem" aria-labelledby="${qid}">
    <p class="tp-eyebrow">${esc(eyeOf(ctx, "tf"))}</p>
    <div class="card tp-card tp-lstate"><p class="tp-lq" id="${qid}" tabindex="-1">${esc(it.statement)}</p></div>
    <div class="tp-ltf" role="group" aria-labelledby="${qid}">${optHtml("False", 0, 0)}${optHtml("True", 1, 1)}</div>
    <div class="tp-lfb" role="status" hidden></div></article>`;
  let done = false;
  box.querySelector(".tp-ltf").addEventListener("click", e => {
    const b = e.target.closest(".tp-lopt"); if(!b || done || b.disabled) return;
    done = true;
    const right = it.answer ? 1 : 0, ch = +b.dataset.i, ok = ch === right;
    markOpts(box, right, ch);
    if(ok){ haptic("success"); okAnim(b); }
    ctx.answer({g: ok ? 2 : 0});
    feedback(box.querySelector(".tp-lfb"), {ok, msg: ok ? `Correct · it's ${it.answer ? "true" : "false"}` : `Not quite · it's ${it.answer ? "true" : "false"}`, why: it.why, src: srcOf(ctx, it)});
    ctx.finish(ok);
  });
};
R.scenario = (box, it, ctx) => {
  const qid = uid("tp-lq"), opts = Array.isArray(it.options) ? it.options : [], order = mix(opts.map((o, i) => i));
  const right = opts.findIndex(o => o && o.ok), mock = ctx.mode === "mock";
  box.innerHTML = `<article class="tp-litem" aria-labelledby="${qid}">
    <p class="tp-eyebrow">${esc(eyeOf(ctx, "scenario"))}</p>
    ${mock ? `<div class="tp-lexbar">${timerHtml(60)}</div>` : ""}
    <div class="card tp-card tp-lsit"><p class="tp-lq tp-lq-s" id="${qid}" tabindex="-1">${esc(it.q)}</p></div>
    <div class="tp-lopts tp-lsopts" role="group" aria-labelledby="${qid}">${order.map((i, k) => optHtml(opts[i].text, k, i, `<span class="tp-lowhy" hidden>${esc(opts[i].why || "")}</span>`)).join("")}</div>
    <div class="tp-lfb" role="status" hidden></div></article>`;
  let tm = null;
  if(mock){ tm = timerRun(box.querySelector(".tp-ltm"), 60, ctx.cur && ctx.cur.el); tm.start(); ctx.leave(() => tm.destroy()); }
  let done = false;
  box.querySelector(".tp-lopts").addEventListener("click", e => {
    const b = e.target.closest(".tp-lopt"); if(!b || done || b.disabled) return;
    done = true;
    const ch = +b.dataset.i, ok = ch === right;
    markOpts(box, right, ch);
    $$(".tp-lowhy", box).forEach(w => { w.hidden = !w.textContent.trim(); });
    if(ok){ haptic("success"); okAnim(b); }
    const secs = tm ? tm.value() : undefined; if(tm) tm.stop();
    ctx.answer({g: ok ? 2 : 0, secs});
    feedback(box.querySelector(".tp-lfb"), {ok, msg: ok ? "Correct" : "Not quite · each option says why", src: srcOf(ctx, it)});
    ctx.finish(ok);
  });
};
R.match = (box, it, ctx) => {
  const pairs = (Array.isArray(it.pairs) ? it.pairs : []).filter(p => Array.isArray(p) && p.length >= 2);
  const qid = uid("tp-lq"), Ls = mix(pairs.map((p, i) => i)), Rs = mix(pairs.map((p, i) => i));
  const btn = (side, i) => `<button type="button" class="tp-lmi" data-side="${side}" data-p="${i}" aria-pressed="false"><span class="tp-lmi-t">${esc(pairs[i][side === "l" ? 0 : 1])}</span></button>`;
  box.innerHTML = `<article class="tp-litem" aria-labelledby="${qid}">
    <p class="tp-eyebrow">${esc(eyeOf(ctx, "match"))}</p>
    <h2 class="tp-lq" id="${qid}" tabindex="-1">${esc(it.q || "Match the pairs.")}</h2>
    <p class="tp-lhint">Tap an item on the left, then its match on the right. You can also drag it across.</p>
    <div class="tp-lmatch"><div class="tp-lmcol" role="group" aria-label="Left column">${Ls.map(i => btn("l", i)).join("")}</div>
      <div class="tp-lmcol" role="group" aria-label="Right column">${Rs.map(i => btn("r", i)).join("")}</div></div>
    <div class="tp-lfb" role="status" hidden></div></article>`;
  let sel = null, miss = 0, n = 0, done = false;
  const live = box.querySelector(".tp-lfb");
  const setSel = el => { $$(".tp-lmi[aria-pressed=true]", box).forEach(b => b.setAttribute("aria-pressed", "false")); sel = el; if(el) el.setAttribute("aria-pressed", "true"); };
  const tryPair = (a, b) => {
    setSel(null);
    if(a.dataset.p === b.dataset.p){
      n++;
      [a, b].forEach(x => { x.classList.add("is-ok"); x.disabled = true; x.setAttribute("aria-pressed", "false"); x.insertAdjacentHTML("afterbegin", `<span class="tp-lpn" aria-hidden="true">${n}</span>`); x.insertAdjacentHTML("beforeend", `<span class="vh">, matched, pair ${n}</span>`); });
      haptic("selection"); okAnim(a); okAnim(b);
      ctx.started();
      if(box.querySelectorAll(".tp-lmi:not(.is-ok)").length === 0) finish();
    } else {
      miss++;
      [a, b].forEach(x => { x.classList.add("is-miss"); x.insertAdjacentHTML("beforeend", MK_NO); });
      live.hidden = false; live.innerHTML = verdict(false, "Not a pair · try another");
      setTimeout(() => { [a, b].forEach(x => { if(x.classList.contains("is-ok")) return; x.classList.remove("is-miss"); const m = x.querySelector(".tp-lmk-no"); if(m) m.remove(); }); if(!done){ live.hidden = true; live.innerHTML = ""; } }, 900);
      ctx.started();
    }
  };
  const pick = el => {
    if(done || !el || el.classList.contains("is-ok")) return;
    if(sel === el) return setSel(null);
    if(!sel || sel.dataset.side === el.dataset.side) return setSel(el);
    const a = sel.dataset.side === "l" ? sel : el, b = a === sel ? el : sel;
    tryPair(a, b);
  };
  box.querySelector(".tp-lmatch").addEventListener("click", e => {
    const b = e.target.closest(".tp-lmi"); if(!b || b.disabled) return;
    pick(b);
    /* con el teclado: si la pareja quedó fija (botones desactivados), al primero que falta de la izquierda */
    if(e.detail === 0 && b.disabled && !done){ const nx = box.querySelector(".tp-lmi[data-side=l]:not(.is-ok)"); if(nx) try{ nx.focus({preventScroll: true}); }catch(err){} }
  });
  const hov = el => { $$(".tp-lmi.is-hover", box).forEach(x => { if(x !== el) x.classList.remove("is-hover"); }); if(el) el.classList.add("is-hover"); };
  const target = (over, side) => { const t = over && over.closest ? over.closest(".tp-lmi") : null; return t && box.contains(t) && t.dataset.side !== side && !t.classList.contains("is-ok") ? t : null; };
  if(W.G && typeof G.drag === "function") $$(".tp-lmi", box).forEach(el => G.drag(el, {ghost: true, touchAction: "pan-y",
    onStart: () => { if(done || el.classList.contains("is-ok")) return false; setSel(el); },
    onMove: i => hov(target(i.over, el.dataset.side)),
    onDrop: i => { const t = target(i.over, el.dataset.side); hov(null); if(!t) return false; pick(t); return true; },
    onCancel: () => hov(null)}));
  function finish(){
    done = true;
    const g = miss === 0 ? 2 : miss <= 2 ? 1 : 0;
    /* todo emparejado: las parejas, una por fila, en el orden de la izquierda */
    const ord = $$(".tp-lmi[data-side=l]", box).map(x => +x.dataset.p), mt = box.querySelector(".tp-lmatch");
    if(mt) mt.outerHTML = `<ul class="tp-lmdone" aria-label="Matched pairs">${ord.map(i => `<li class="tp-lmd">${MK_OK}<span class="tp-lmd-l">${esc(pairs[i][0])}</span><span class="tp-lmd-r">${icon("arrow-right", "bold", 16)}<span>${esc(pairs[i][1])}</span></span></li>`).join("")}</ul>`;
    const hn = box.querySelector(".tp-lhint"); if(hn) hn.hidden = true;
    if(g === 2) haptic("success");
    ctx.answer({g, miss});
    feedback(live, {ok: g > 0, msg: miss === 0 ? "All matched, no mistakes" : `All matched · ${plural(miss, "mistake", "mistakes")}`, src: srcOf(ctx, it)});
    ctx.finish(g > 0);
  }
};
R.order = (box, it, ctx) => {
  const steps = (Array.isArray(it.steps) ? it.steps : []).map(String), N = steps.length;
  const qid = uid("tp-lq");
  let pool = mix(steps.map((s, i) => i)); if(N > 1 && pool.every((x, i) => x === i)) pool.reverse();
  const O = {placed: [], marks: null, locked: false, onChange: null, n: N};
  box.innerHTML = `<article class="tp-litem" aria-labelledby="${qid}">
    <p class="tp-eyebrow">${esc(eyeOf(ctx, "order"))}</p>
    <h2 class="tp-lq" id="${qid}" tabindex="-1">${esc(it.q)}</h2>
    <p class="tp-lhint">Tap the steps in order. Tap a placed step to take it out, or drag it by its handle.</p>
    <h3 class="tp-lh3" id="${qid}-o">Your order</h3>
    <ol class="tp-lord" aria-labelledby="${qid}-o"></ol>
    <h3 class="tp-lh3 tp-lpool-h" id="${qid}-p">Steps</h3>
    <ul class="tp-lord tp-lpool" aria-labelledby="${qid}-p"></ul>
    <div class="tp-lfb" role="status" hidden></div></article>`;
  const ol = box.querySelector("ol.tp-lord"), ul = box.querySelector(".tp-lpool");
  const row = (k, pos) => `<li class="tp-lsr${O.marks ? (O.marks[pos] ? " is-ok" : " is-miss") : ""}" data-k="${k}"${pos != null ? ` data-pos="${pos}"` : ""}>
      <button type="button" class="tp-lsb"${O.locked ? " disabled" : ""} aria-label="${pos != null ? `Step ${pos + 1}: ${esc(steps[k])}. Tap to take it out` : `${esc(steps[k])}. Tap to place it next`}">${pos != null ? `<span class="tp-lnum" aria-hidden="true">${pos + 1}</span>` : ""}<span class="tp-lst-t">${esc(steps[k])}</span>${O.marks && pos != null ? (O.marks[pos] ? MK_OK : MK_NO) : ""}</button>
      ${O.locked ? "" : `<span class="tp-lgrip" aria-hidden="true">${icon("list", "bold", 20)}</span>`}</li>`;
  function paint(){
    ol.innerHTML = O.placed.map((k, i) => row(k, i)).join("") + (O.placed.length < N && !O.locked ? `<li class="tp-lslot" aria-hidden="true">${O.placed.length ? "Next step" : "Tap the first step below"}</li>` : "");
    ul.innerHTML = pool.map(k => row(k, null)).join("");
    ul.hidden = !pool.length; box.querySelector(".tp-lpool-h").hidden = !pool.length;
    if(!O.locked) $$(".tp-lsr", box).forEach(wireDrag);
    call(O.onChange, O);
  }
  const keepFocus = (k, fn) => { fn(); paint(); const b = box.querySelector(`.tp-lsr[data-k="${k}"] .tp-lsb`); if(b && D.activeElement === D.body) try{ b.focus({preventScroll: true}); }catch(e){} };
  box.addEventListener("click", e => {
    const b = e.target.closest(".tp-lsb"); if(!b || O.locked) return;
    const li = b.closest(".tp-lsr"), k = +li.dataset.k;
    O.marks = null; haptic("selection"); ctx.started();
    keepFocus(k, () => {
      if(li.dataset.pos != null){ O.placed.splice(+li.dataset.pos, 1); pool.push(k); }
      else { pool = pool.filter(x => x !== k); O.placed.push(k); }
    });
    if(e.detail === 0 && !pool.length) focusCheck();   /* con el teclado: todo puesto, al «Check» */
  });
  let ins = null;
  const dropIdx = y => { const rows = $$(".tp-lsr", ol); let i = 0; for(const r of rows){ const b = r.getBoundingClientRect(); if(y > b.top + b.height / 2) i++; } return i; };
  const overList = (x, y) => { const r = ol.getBoundingClientRect(); return x >= r.left - 24 && x <= r.right + 24 && y >= r.top - 40 && y <= r.bottom + 40; };
  const showIns = i => {
    if(!ins){ ins = D.createElement("li"); ins.className = "tp-lins"; ins.setAttribute("aria-hidden", "true"); }
    const rows = $$(".tp-lsr", ol); const ref = rows[i] || ol.querySelector(".tp-lslot") || null;
    if(ins.nextSibling !== ref || ins.parentNode !== ol) ol.insertBefore(ins, ref);
  };
  const hideIns = () => { if(ins && ins.parentNode) ins.remove(); };
  function wireDrag(li){
    if(!(W.G && typeof G.drag === "function")) return;
    let grip = false;
    li.addEventListener("pointerdown", e => { grip = !!(e.target.closest && e.target.closest(".tp-lgrip")); });
    G.drag(li, {ghost: true, touchAction: "pan-y",
      onStart: () => grip && !O.locked ? undefined : false,
      onMove: i => { if(overList(i.x, i.y)) showIns(dropIdx(i.y)); else hideIns(); },
      onDrop: i => {
        const k = +li.dataset.k, from = li.dataset.pos != null ? +li.dataset.pos : null;
        const inList = overList(i.x, i.y), idx = inList ? dropIdx(i.y) : null; hideIns();
        if(!inList && from == null) return false;
        O.marks = null; ctx.started();
        if(from != null) O.placed.splice(from, 1); else pool = pool.filter(x => x !== k);
        if(inList){ let j = idx; if(from != null && from < idx) j--; O.placed.splice(Math.max(0, Math.min(O.placed.length, j)), 0, k); }
        else pool.push(k);
        haptic("selection"); setTimeout(paint, 0);
        return true;
      },
      onCancel: hideIns});
  }
  Object.assign(O, {
    full: () => O.placed.length === N,
    check(){ O.marks = O.placed.map((k, i) => k === i); paint(); return O.marks.every(Boolean); },
    right: () => (O.marks || []).filter(Boolean).length,
    reveal(){ O.placed = steps.map((s, i) => i); pool = []; O.marks = null; O.locked = true; paint(); },
    lock(){ O.locked = true; paint(); },
  });
  paint();
  checkFlow(box, it, ctx, O, {partial: r => `${r} of ${N} in the right place`, hint: "Move the ones marked ✗ and check again, or show the answer.", answer: "This is the right order"});
};
/* «Check» de order, code y diagram: a la primera bien = 2, a la segunda = 1; si no, la respuesta (0) */
function checkFlow(box, it, ctx, F, txt){
  let tries = 0, answered = false;
  const fb = box.querySelector(".tp-lfb");
  const dockCheck = () => { if(answered) return; ctx.dock([...(tries ? [{t: "Show answer", id: "tp-lshow", on: () => reveal(false)}] : []), {t: "Check", pri: true, key: "enter", id: "tp-lcheck", dis: !F.full(), on: check}]); };
  function check(){
    if(answered || !F.full()) return;
    tries++; ctx.started();
    const ok = F.check();
    if(ok){
      answered = true; F.lock(); haptic("success");
      const g = tries === 1 ? 2 : 1;
      ctx.answer({g});
      feedback(fb, {ok: true, msg: tries === 1 ? "Correct" : "Correct on the second try", src: srcOf(ctx, it)});
      ctx.finish(true);
    } else if(tries >= 2) reveal(true);
    else { feedback(fb, {ok: false, msg: txt.partial(F.right()), why: txt.hint}); dockCheck(); }
  }
  function reveal(auto){
    if(answered) return;
    answered = true; F.reveal();
    ctx.answer({g: 0});
    feedback(fb, {ok: false, msg: auto ? `Not quite · ${txt.answer.toLowerCase()}` : txt.answer, src: srcOf(ctx, it)});
    ctx.finish(false);
  }
  F.onChange = () => { if(answered) return; if(!F.marks && fb && !fb.hidden && tries){ fb.hidden = true; } dockCheck(); };
  dockCheck();
}
R.code = (box, it, ctx) => {
  const gaps = (Array.isArray(it.gaps) ? it.gaps : []).slice().sort((a, b) => a.n - b.n), byN = {};
  gaps.forEach((g, i) => { byN[g.n] = i; });
  const chips = mix(gaps.flatMap(g => [g.answer, ...(Array.isArray(g.decoys) ? g.decoys : [])]).map(String));
  const qid = uid("tp-lq"), lang = LANG_NAME[it.lang] || String(it.lang || "Code");
  const lines = String(it.code || "").split("\n").map(line => {
    const parts = line.split(/(\[\[\d+\]\])/);
    return `<div class="tp-lln${/\[\[\d+\]\]/.test(line) ? " has-gap" : ""}">${parts.map(p => { const m = /^\[\[(\d+)\]\]$/.exec(p); if(!m || byN[+m[1]] == null) return esc(p); const i = byN[+m[1]]; return `<button type="button" class="tp-lgap is-empty" data-slot="${i}" aria-pressed="false"><span class="tp-lsl-t">${i + 1}</span></button>`; }).join("") || " "}</div>`;
  }).join("");
  box.innerHTML = `<article class="tp-litem" aria-labelledby="${qid}">
    <p class="tp-eyebrow">${esc(eyeOf(ctx, "code"))}</p>
    <h2 class="tp-lq" id="${qid}" tabindex="-1">${esc(it.q)}</h2>
    <div class="tp-lcb"><span class="tp-badge">${esc(lang)}</span><div class="tp-lpre" role="group" aria-label="${esc(lang)} code with ${plural(gaps.length, "gap", "gaps")}" tabindex="0">${lines}</div></div>
    <p class="tp-lhint">Tap a gap, then the code that goes there. You can also drag a piece onto a gap.</p>
    <div class="tp-lchips" role="group" aria-label="Pieces of code">${chips.map((c, i) => `<button type="button" class="tp-chip tp-lchip tp-lmono" data-chip="${i}">${esc(c)}</button>`).join("")}</div>
    <div class="tp-lfb" role="status" hidden></div></article>`;
  const F = filler(box, {answers: gaps.map(g => String(g.answer)), chips, blank: i => String(i + 1), name: i => `Gap ${i + 1}`});
  checkFlow(box, it, ctx, F, {partial: r => `${r} of ${gaps.length} gaps right`, hint: "Change the gaps marked ✗ and check again, or show the answer.", answer: "Here's the right code"});
};
R.diagram = (box, it, ctx) => {
  const slots = (it.nodes || []).filter(n => n.slot);
  const chips = mix([...slots.map(n => String(n.label)), ...(Array.isArray(it.decoys) ? it.decoys.map(String) : [])]);
  const qid = uid("tp-lq");
  box.innerHTML = `<article class="tp-litem" aria-labelledby="${qid}">
    <p class="tp-eyebrow">${esc(eyeOf(ctx, "diagram"))}</p>
    <h2 class="tp-lq" id="${qid}" tabindex="-1">${esc(it.q)}</h2>
    <div class="card tp-card tp-ldgc">${dgHtml(it, {slots: true})}</div>
    <p class="tp-lhint">Tap a blank, then the label that goes there. You can also drag a label onto a blank.</p>
    <div class="tp-lchips" role="group" aria-label="Labels">${chips.map((c, i) => `<button type="button" class="tp-chip tp-lchip" data-chip="${i}">${esc(c)}</button>`).join("")}</div>
    <div class="tp-lfb" role="status" hidden></div></article>`;
  const F = filler(box, {answers: slots.map(n => String(n.label)), chips, blank: i => `Blank ${i + 1}`, name: i => `Blank ${i + 1}`});
  const fig = box.querySelector(".tp-ldg");
  const relabel = () => {   /* las otras flechas (bajo el dibujo) dicen lo que hay en cada hueco */
    $$("[data-ln]", box).forEach(b => { const n = it.nodes.find(x => x.id === b.dataset.ln); if(!n || !n.slot) return; const i = slots.indexOf(n), c = F.fill[i]; b.textContent = c == null ? `Blank ${i + 1}` : chips[c]; });
    requestAnimationFrame(() => dgFit(fig));
  };
  checkFlow(box, it, ctx, F, {partial: r => `${r} of ${slots.length} blanks right`, hint: "Change the blanks marked ✗ and check again, or show the answer.", answer: "Here's the right diagram"});
  const oc = F.onChange; F.onChange = s => { relabel(); call(oc, s); };
  dgFit(fig);
};
R.explain = (box, it, ctx) => {
  const c = explain(box, it, {dock: ctx.dock, unit: ctx.unit, state: ctx.cur, eyebrow: eyeOf(ctx, "explain"), story: !!ctx.story,
    write: ctx.write ? ctx.write(it) : "", save: s => ctx.save(s), onStart: () => ctx.started(),
    onReview: el => wireWrite(el, it, ctx),
    onGrade: (v, r) => { ctx.answer({v, secs: r.secs, kp: r.kp, star: r.star}); ctx.next(); }});
  ctx.leave(() => c.destroy());
};
R.say = (box, it, ctx) => {
  const id = uid("tp-ls");
  const src = srcOf(ctx, it);
  box.innerHTML = `<article class="card tp-card tp-litem tp-lsay">
    <p class="tp-eyebrow">${esc(eyeOf(ctx, "say"))}</p>
    <p class="tp-lsent" id="${id}" tabindex="-1">${esc(it.text)}</p>
    <div class="tp-lsays-c">${sayBtn(it.text, "Listen")}</div>
    <p class="tp-sub">Say it aloud, then continue.</p>
    ${src ? `<div class="tp-lsrc">${src}</div>` : ""}
  </article>`;
  ctx.dock([{t: "Continue", pri: true, key: "enter", on: () => { ctx.answer({g: null, seen: true}); ctx.next(); }}]);
};
function writeBtn(it){
  const ex = T.list("story").find(s => s.from === it.id);
  return `<button type="button" class="glass-btn glass-btn--sm tp-lwr" data-write="${esc(it.id)}"${ex ? ' aria-pressed="true"' : ""}>${icon(ex ? "check" : "pencil-simple", "bold", 18)}<span>${ex ? "In My stories" : "Write yours"}</span></button>`;
}
function wireWrite(el, it, ctx){
  const b = el.querySelector(".tp-lwr"); if(!b) return;
  b.addEventListener("click", () => {
    const sid = storyDraft(it);
    ctx.started();
    call(ctx.onWrite, sid, it);
    b.setAttribute("aria-pressed", "true");
    b.innerHTML = `${icon("check", "bold", 18)}<span>In My stories</span>`;
    toast("Saved to My stories · write it after this", icon("notebook", "bold", 20));
    haptic("selection");
  });
}
R.story = (box, it, ctx) => {
  const id = uid("tp-lst"), L = Array.isArray(it.template) && it.template.length ? it.template : STAR, parts = storyParts(String(it.model || ""), L);
  const src = srcOf(ctx, it);
  box.innerHTML = `<article class="tp-litem tp-lstoryi">
    <p class="tp-eyebrow">${esc(eyeOf(ctx, "story"))}</p>
    <h2 class="tp-lq" id="${id}" tabindex="-1">${esc(it.prompt)}</h2>
    <section class="card tp-card tp-lsec" aria-labelledby="${id}-t"><h3 class="tp-lh3" id="${id}-t">How to answer</h3>
      <ol class="tp-lstar-s">${L.map(l => `<li><b>${esc(l)}</b>${STAR_HINT[l] ? `<span>${esc(STAR_HINT[l])}</span>` : ""}</li>`).join("")}</ol></section>
    <section class="card tp-card tp-lsec" aria-labelledby="${id}-m"><div class="tp-lsech"><h3 class="tp-lh3" id="${id}-m">Model story</h3>${ui.say(it.model, {label: "Listen to the model story"})}</div>
      ${parts ? `<dl class="tp-lstory">${parts.map(p => `<dt>${esc(p.label)}</dt><dd>${esc(p.text)}</dd>`).join("")}</dl>` : `<p class="tp-ltext">${esc(it.model)}</p>`}</section>
    <div class="tp-lwrite">${writeBtn(it)}<p class="tp-sub">Your own version goes to My stories, to write after this lesson.</p></div>
    ${src ? `<div class="tp-lsrc">${src}</div>` : ""}
  </article>`;
  wireWrite(box, it, ctx);
  ctx.dock([{t: "Continue", pri: true, key: "enter", on: () => { ctx.answer({g: null, seen: true}); ctx.next(); }}]);
};

/* ---------- el motor de las sesiones ---------- */
let RUN = null, LAST = null;
function cleanup(r){
  if(!r) return;
  const fs = r.leave.splice(0); fs.forEach(f => call(f));
  dictStop();
}
function stopRun(){ if(RUN){ cleanup(RUN); RUN = null; } T.stopSpeak(); }
/* cfg: {kind, id, steps [{k, id, it, u, re, type}], i, res, cur, started, st (extra), title, label, onAnswer, onEnd, ctx(s)} */
function runStart(cfg){
  stopRun();
  const r = RUN = {kind: cfg.kind, id: cfg.id, path: hashPath(), steps: cfg.steps, i: Math.max(0, +cfg.i || 0), res: isObj(cfg.res) ? cfg.res : {},
    cur: isObj(cfg.cur) ? cfg.cur : null, started: !!cfg.started, ended: false, st: isObj(cfg.st) ? cfg.st : {}, cfg, leave: [], shown: now()};
  const a = appEl(); if(!a) return;
  a.innerHTML = `<div class="tp-page tp-lrun" id="tp-lrun" data-kind="${esc(cfg.kind)}">
    <div class="tp-ftop"><div class="tp-pbar" role="progressbar" aria-label="${esc(cfg.label || "Progress")}" aria-valuemin="0"><i></i></div><span class="tp-lcount" aria-hidden="true"></span></div>
    ${cfg.title ? `<p class="tp-lrt">${esc(cfg.title)}</p>` : ""}
    <div class="tp-lstage" id="tp-lstage"></div>
    <div class="tp-dock" id="tp-ldock" hidden></div></div>`;
  persist(r);   /* el plan (orden, repaso, entrevista) sobrevive a una recarga */
  show(r);
}
function persist(r){
  if(r !== RUN || r.ended) return;
  sSet(r.kind, Object.assign({}, r.st, {id: r.id, steps: r.steps.map(s => ({k: s.k, id: s.id, re: s.re ? 1 : 0})), i: r.i, res: r.res, cur: r.cur, started: r.started, day: T.day()}));
}
function setDock(r, btns){
  const d = D.getElementById("tp-ldock"); if(!d || r !== RUN) return;
  d.innerHTML = (btns || []).map((b, i) => `<button type="button" class="glass-btn glass-btn--lg${b.pri ? " glass-btn--pri" : ""}${b.ok ? " glass-btn--ok" : ""}${b.cls ? " " + b.cls : ""}" data-b="${i}"${b.id ? ` id="${esc(b.id)}"` : ""}${b.key ? ` data-key="${esc(b.key)}"` : ""}${b.keyLabel ? ` data-key-label="${esc(b.keyLabel)}"` : ""}${b.dis ? ' aria-disabled="true"' : ""}${b.label ? ` aria-label="${esc(b.label)}"` : ""}>${b.icon ? icon(b.icon, "bold", 20) : ""}<span>${esc(b.t)}</span></button>`).join("");
  d.hidden = !(btns && btns.length);
  $$("button[data-b]", d).forEach(el => el.addEventListener("click", e => { if(el.getAttribute("aria-disabled") === "true") return; const b = btns[+el.dataset.b]; if(b && b.on) call(b.on, e); }));
}
function progress(r){
  const n = r.steps.length, done = Math.min(n, r.i), bar = $(".tp-lrun .tp-pbar");
  if(bar){ bar.setAttribute("aria-valuemax", String(n)); bar.setAttribute("aria-valuenow", String(done)); bar.setAttribute("aria-valuetext", `${done} of ${n} done`); const i = bar.querySelector("i"); if(i) i.style.width = `${n ? Math.round(100 * done / n) : 0}%`; }
  const c = $(".tp-lrun .tp-lcount"); if(c) c.textContent = n ? `${Math.min(n, r.i + 1)} of ${n}` : "";
}
function show(r){
  if(r !== RUN) return;
  cleanup(r);
  while(r.i < r.steps.length && r.res[r.steps[r.i].k]) r.i++;   /* lo ya contestado (al volver tras recargar) */
  progress(r);
  if(r.i >= r.steps.length) return end(r);
  const s = r.steps[r.i], stage = D.getElementById("tp-lstage"); if(!stage) return;
  r.shown = now(); T.stopSpeak();
  stage.innerHTML = "";
  setDock(r, []);
  const type = s.type || (s.it && s.it.type);
  const ctx = mkCtx(r, s);
  const f = R[type];
  try{ if(f) f(stage, s.it, ctx); else { ctx.answer({g: null, skip: true}); return ctx.next(); } }
  catch(e){ console.error(e); stage.innerHTML = `<div class="card tp-card"><p class="tp-sub">This item couldn't be shown.</p></div>`; setDock(r, [{t: "Skip", pri: true, key: "enter", on: () => { ctx.answer({g: null, skip: true}); ctx.next(); }}]); }
  scrollTo(0, 0);
  const h = stage.querySelector(".tp-lq, .tp-term-t, .tp-lsent"); if(h){ if(!h.hasAttribute("tabindex")) h.tabIndex = -1; try{ h.focus({preventScroll: true}); }catch(e){} }
  if(!rm()) stage.classList.add("tp-lin"); setTimeout(() => stage.classList.remove("tp-lin"), 400);
}
function mkCtx(r, s){
  const alive = () => r === RUN && !r.ended && r.steps[r.i] === s;
  const ctx = {
    mode: r.kind, unit: s.u || null, re: !!s.re, item: s.it, story: s.type === "explain" && s.it && s.it.type === "story",
    cur: r.cur && r.cur.k === s.k ? r.cur : null,
    eye: call(r.cfg.eye, s, r) || "",
    write: r.cfg.write ? it => r.cfg.write(it, r) : null,
    onWrite: (sid, it) => { r.st.stories = (r.st.stories || []).filter(x => x.id !== sid).concat([{id: sid, prompt: it.prompt}]); persist(r); },
    dock: btns => { if(alive()) setDock(r, btns); },
    answer(res){
      if(!alive() || r.res[s.k]) return;
      const out = Object.assign({}, res);
      if(out.secs == null) out.secs = Math.round((now() - r.shown) / 1000 + (ctx.cur && +ctx.cur.el || 0));
      out.secs = Math.round(out.secs);
      r.res[s.k] = out; r.cur = null;
      if(!res.seen && !res.skip) r.started = true;
      call(r.cfg.onAnswer, s, out, r);
      persist(r);
    },
    finish(ok){ if(alive()) setDock(r, [{t: ok ? "Continue" : "Next", pri: true, key: "enter", id: "tp-lnext", on: () => ctx.next()}]); },
    next(){ if(r !== RUN || r.ended || r.steps[r.i] !== s) return; if(!r.res[s.k]) r.res[s.k] = {g: null, skip: true}; r.i++; persist(r); show(r); },
    save(cur){ if(!alive()) return; r.cur = Object.assign({}, cur, {k: s.k}); if(cur && cur.text && String(cur.text).trim()) r.started = true; persist(r); },
    leave(fn){ r.leave.push(fn); },
    started(){ if(!r.started){ r.started = true; persist(r); } },
  };
  return ctx;
}
function reask(r, s){
  const k = `${s.id}#2`;
  if(s.re || r.steps.some(x => x.k === k)) return;
  r.steps.push(Object.assign({}, s, {k, re: true}));
}
function end(r){
  if(r.ended) return;
  r.ended = true; cleanup(r); T.stopSpeak();
  sDel(r.kind);
  setDock(r, []);
  const out = call(r.cfg.onEnd, r);
  LAST = {path: r.path, kind: r.kind, html: null};
  return out;
}
/* «Stop here?»: la ✕ (exit) y Atrás del navegador (blocks); solo con algo hecho */
/* (route() pregunta blocks(hp) con la ruta nueva ya en la barra: ahí no se compara con hashPath()) */
const live = () => !!(RUN && RUN.started && !RUN.ended);
const busy = () => live() && hashPath() === RUN.path;
const onStop = () => { if(RUN){ persist(RUN); cleanup(RUN); } T.stopSpeak(); };
const FOCUS_OPTS = {
  exit: from => busy() ? T.focus.ask({from, onStop}) : false,
  blocks: hp => live() && hp !== RUN.path ? T.focus.guard(hp, {onStop}) : false,
};
/* restaura los pasos guardados (los que ya no existen se quitan) */
function restoreSteps(saved, resolve){
  if(!saved || !Array.isArray(saved.steps)) return null;
  const out = [];
  for(const x of saved.steps){ if(!x || !x.k) continue; const s = resolve(x); if(s) out.push(Object.assign(s, {k: String(x.k), re: !!x.re})); }
  return out.length ? out : null;
}
function stepOf(id){
  const x = T.item(id); if(!x) return null;
  return {k: id, id, it: x.item, u: x.unit, l: x.lesson, type: x.item.type};
}
function calm(o){
  const a = appEl(); if(!a) return;
  a.innerHTML = `<div class="tp-page tp-lrun tp-lcalm">${ui.empty({icon: o.icon || "info", title: o.title, sub: o.sub})}
    <div class="tp-dock" id="tp-ldock"><a class="glass-btn glass-btn--lg glass-btn--pri" href="${esc(o.href || "#/tech")}" data-key="enter">${esc(o.btn || "Back to Today")}</a></div></div>`;
}

/* ---------- lección (#/techl/lesson/<lessonId>) ---------- */
async function lessonRender(parts){
  css();
  const id = String(parts[0] || ""), hp = hashPath();
  try{ await T.units(); }catch(e){ if(hashPath() === hp) calm({icon: "wifi-slash", title: "Couldn't load the lesson", sub: e.message, href: "#/techpath", btn: "Back to Path"}); return; }
  if(hashPath() !== hp) return;
  const x = T.lessonOf(id);
  if(!x){
    const uidN = id.slice(0, 3), row = T.pathUnits().find(u => u.id === uidN);
    return calm(row && !row.available ? {icon: "timer", title: "Coming soon", sub: `Unit ${row.n} · ${row.title} isn't ready yet.`, href: "#/techpath", btn: "Back to Path"}
      : {icon: "warning-circle", title: "Lesson not found", sub: "This link doesn't point to a lesson.", href: "#/techpath", btn: "Back to Path"});
  }
  const {lesson, unit} = x;
  const saved = sGet("lesson");
  const resume = saved && saved.id === id ? restoreSteps(saved, s => stepOf(s.id)) : null;
  const steps = resume || lesson.items.map(it => ({k: it.id, id: it.id, it, u: unit, l: lesson, type: it.type}));
  const li = unit.lessons.indexOf(lesson);
  runStart({kind: "lesson", id, steps, i: resume ? saved.i : 0, res: resume ? saved.res : {}, cur: resume ? saved.cur : null, started: resume ? saved.started : false,
    st: resume ? {stories: Array.isArray(saved.stories) ? saved.stories : []} : {stories: []},
    title: `Unit ${unit.n} · Lesson ${li + 1} of ${unit.lessons.length} · ${lesson.title}`, label: "Lesson progress",
    onAnswer: (s, res) => {
      if(s.re || res.skip) return;
      const t = s.it.type;
      if(t === "card"){ if(!T.srs.get(s.id)) T.srs.grade(s.id, 2); return; }
      if(t === "say" || t === "story") return;
      if(t === "explain"){ T.srs.gradeExplain(s.id, res.v); if(res.v === "notyet") reask(RUN, s); return; }
      T.srs.grade(s.id, res.g === 2 ? 2 : res.g === 1 ? 1 : 0);
      if(!res.g) reask(RUN, s);
    },
    onEnd: r => lessonEnd(r, lesson, unit)});
}
function lessonScore(r){
  let score = 0, total = 0, exN = 0, exOk = 0;
  for(const s of r.steps){
    if(s.re) continue;
    const res = r.res[s.k] || {}, t = s.it.type;
    if(t === "explain"){ total++; exN++; if(res.v === "nailed"){ score++; exOk++; } }
    else if(SCORED.has(t)){ total++; if(res.g === 2) score++; }
  }
  return {score, total, exN, exOk};
}
function lessonEnd(r, lesson, unit){
  const sc = lessonScore(r);
  const out = T.progress.lessonDone(lesson.id, {score: sc.score, total: sc.total}) || {};
  const tm = T.day() + 1;
  const back = lesson.items.filter(it => { const g = T.srs.get(it.id); return g && g.due === tm; }).length;
  const nx = T.progress.nextLesson();
  let next = nx && nx.lesson ? nx.lesson.id : null;
  if(!next){ const li = unit.lessons.indexOf(lesson); if(unit.lessons[li + 1]) next = unit.lessons[li + 1].id; }
  if(next === lesson.id) next = null;
  const nxL = next ? T.lessonOf(next) : null;
  const stories = (r.st.stories || []).filter(x => T.get("story", x.id));
  const medals = Array.isArray(out.newMedals) ? out.newMedals : [];
  const a = appEl(); if(!a) return;
  a.innerHTML = `<div class="tp-page tp-lrun tp-lend" id="tp-lend">
    <section class="card tp-card tp-lendc" aria-labelledby="tp-lend-t">
      <span class="tp-lend-ic" aria-hidden="true">${icon("check-circle", "fill", 34)}</span>
      <h2 class="tp-lend-t" id="tp-lend-t" tabindex="-1">Lesson complete</h2>
      <p class="tp-sub">Unit ${unit.n} · ${esc(lesson.title)}</p>
      ${sc.total ? `<p class="tp-lscore"><b>${sc.score} of ${sc.total}</b> right first time</p>` : ""}
      ${sc.exN ? `<p class="tp-sub">Including ${sc.exOk} of ${plural(sc.exN, "explanation", "explanations")} you nailed</p>` : ""}
      <p class="tp-lback-l">${icon("calendar-blank", "bold", 18)}<span>${back ? `${plural(back, "item comes", "items come")} back tomorrow` : "Your reviews are planned"}</span></p>
      ${medals.map(m => `<p class="tp-lmedal">${icon("medal", "fill", 22)}<span>Medal earned: ${esc(m.title)}</span></p>`).join("")}
    </section>
    ${stories.length ? `<h2 class="tp-h">Your stories to write</h2><div class="tp-list">${stories.map(x => ui.row({href: `#/techstory/${encodeURIComponent(x.id)}`, icon: "pencil-simple", t: "Write your story", sub: x.prompt})).join("")}</div>` : ""}
    <div class="tp-dock" id="tp-ldock">
      <a class="glass-btn glass-btn--lg${nxL ? "" : " glass-btn--pri"}" href="#/techpath" id="tp-lpath"${nxL ? "" : ' data-key="enter"'}>Back to Path</a>
      ${nxL ? `<a class="glass-btn glass-btn--lg glass-btn--pri" href="#/techl/lesson/${esc(next)}" id="tp-lnextl" data-key="enter">Next lesson</a>` : ""}
    </div></div>`;
  const h = D.getElementById("tp-lend-t"); if(h) try{ h.focus({preventScroll: true}); }catch(e){}
  okAnim(a.querySelector(".tp-lend-ic"));
  haptic("success");
  scrollTo(0, 0);
}

/* ---------- repaso (#/techl/review) ---------- */
async function reviewRender(){
  css();
  const hp = hashPath();
  try{ await T.units(); }catch(e){ if(hashPath() === hp) calm({icon: "wifi-slash", title: "Couldn't load the review", sub: e.message}); return; }
  if(hashPath() !== hp) return;
  const saved = sGet("review");
  let steps = saved && saved.day === T.day() ? restoreSteps(saved, s => stepOf(s.id)) : null;
  const resume = !!steps;
  if(!steps) steps = T.srs.queue({limit: 20}).map(stepOf).filter(Boolean);
  steps.forEach(s => { if(s.type === "card") s.type = "flip"; });
  if(!steps.length) return reviewEmpty();
  runStart({kind: "review", id: "review", steps, i: resume ? saved.i : 0, res: resume ? saved.res : {}, cur: resume ? saved.cur : null, started: resume ? saved.started : false,
    title: "Today's review", label: "Review progress",
    eye: s => `${s.re ? "Again · " : ""}${EYE[s.type] || ""} · Unit ${s.u ? s.u.n : ""}`,
    onAnswer: (s, res) => {
      if(s.re || res.skip) return;
      if(s.it.type === "explain"){ T.srs.gradeExplain(s.id, res.v, {review: true}); if(res.v === "notyet") reask(RUN, s); return; }
      T.srs.grade(s.id, res.g === 2 ? 2 : res.g === 1 ? 1 : 0, {review: true});
      if(!res.g) reask(RUN, s);
    },
    onEnd: reviewEnd});
}
function reviewEmpty(){
  const a = appEl(); if(!a) return;
  const nx = T.progress.nextLesson();
  a.innerHTML = `<div class="tp-page tp-lrun tp-lcalm" id="tp-lrv0">${ui.empty({icon: "check-circle", title: "All caught up", sub: "Nothing to review today. New items join your review as you learn them."})}
    <div class="tp-dock" id="tp-ldock"><a class="glass-btn glass-btn--lg glass-btn--pri" id="tp-llearn" data-key="enter" href="${nx && nx.lesson ? `#/techl/lesson/${esc(nx.lesson.id)}` : "#/techpath"}">Learn something new</a></div></div>`;
}
function reviewEnd(r){
  const firsts = r.steps.filter(s => !s.re && !(r.res[s.k] || {}).skip);
  const right = firsts.filter(s => { const x = r.res[s.k] || {}; return x.g === 2 || x.v === "nailed"; }).length;
  const groups = {};
  for(const s of firsts){ const g = T.srs.get(s.id); if(!g) continue; groups[g.due] = (groups[g.due] || 0) + 1; }
  const days = Object.keys(groups).map(Number).sort((a, b) => a - b);
  const more = T.srs.dueCount();
  const a = appEl(); if(!a) return;
  a.innerHTML = `<div class="tp-page tp-lrun tp-lend" id="tp-lrvend">
    <section class="card tp-card tp-lendc" aria-labelledby="tp-lend-t">
      <span class="tp-lend-ic" aria-hidden="true">${icon("check-circle", "fill", 34)}</span>
      <h2 class="tp-lend-t" id="tp-lend-t" tabindex="-1">Review done</h2>
      <p class="tp-lscore"><b>${plural(firsts.length, "item", "items")}</b> reviewed · ${right} right first time</p>
    </section>
    ${days.length ? `<section class="tp-list tp-lwhen" aria-labelledby="tp-lwhen-h"><h2 class="tp-h" id="tp-lwhen-h">What comes back when</h2>${days.map(d => `<div class="tp-row tp-row-noic"><span class="tp-rt">${esc(cap(fmt.due(d)))}</span><span class="tp-lpct">${groups[d]}</span></div>`).join("")}</section>` : ""}
    <div class="tp-dock" id="tp-ldock">
      ${more ? `<a class="glass-btn glass-btn--lg" href="#/tech" id="tp-ldone">Done</a><button type="button" class="glass-btn glass-btn--lg glass-btn--pri" id="tp-lmore" data-key="enter">Keep going · ${Math.min(20, more)} more</button>`
        : `<a class="glass-btn glass-btn--lg glass-btn--pri" href="#/tech" id="tp-ldone" data-key="enter">Done</a>`}
    </div></div>`;
  const k = D.getElementById("tp-lmore"); if(k) k.addEventListener("click", () => { RUN = null; sDel("review"); navTo("#/techl/review"); });
  const h = D.getElementById("tp-lend-t"); if(h) try{ h.focus({preventScroll: true}); }catch(e){}
  haptic("success");
  scrollTo(0, 0);
}
const cap = s => String(s || "").replace(/^./, c => c.toUpperCase());

/* ---------- entrevista de práctica (#/techmock, #/techl/mock) ---------- */
const LENS = {15: 5, 30: 9};
function studied(us){
  const seen = new Set([...T.list("ls"), ...T.list("srs")].map(x => String(x.id).slice(0, 3)));
  return us.filter(u => seen.has(u.id));
}
function mockPlan(us, len, scope, only){
  const n = LENS[len] || 5;
  if(Array.isArray(only) && only.length) return {ids: only.filter(id => T.item(id)), fallback: false};
  let pool = scope === "all" ? us : studied(us); const fallback = scope !== "all" && !pool.length; if(!pool.length) pool = us;
  const all = pool.flatMap(u => u.lessons.flatMap(l => l.items.map(it => ({it, l}))));
  const weak = x => { const g = T.srs.get(x.it.id); return g && g.g === 2 ? 1 : 0; };
  const ex = mix(all.filter(x => x.it.type === "explain")).sort((a, b) => weak(a) - weak(b));
  const st = mix(all.filter(x => x.it.type === "story"));
  const sc = [...mix(all.filter(x => x.it.type === "scenario" && x.l.kind === "interview")), ...mix(all.filter(x => x.it.type === "scenario" && x.l.kind !== "interview"))];
  const nSt = Math.min(st.length, n >= 9 ? 2 : 1), nSc = Math.min(sc.length, n >= 9 ? 2 : 1);
  const others = [...st.slice(0, nSt), ...sc.slice(0, nSc)];
  let exs = ex.slice(0, Math.max(0, n - others.length));
  const extra = [...sc.slice(nSc), ...st.slice(nSt)];
  while(exs.length + others.length < n && extra.length) others.push(extra.shift());
  const out = [], oth = mix(others), gap = Math.max(1, Math.floor(exs.length / (oth.length + 1)));
  while(exs.length || oth.length){ for(let k = 0; k < gap && exs.length; k++) out.push(exs.shift()); if(oth.length) out.push(oth.shift()); }
  return {ids: out.map(x => x.it.id), fallback};
}
function mockStep(id){
  const s = stepOf(id); if(!s) return null;
  if(s.type === "story") s.type = "explain";
  if(s.it.type === "story"){ s.it = Object.assign({}, s.it, {seconds: 150}); }
  return s;
}
const prefs = () => { const o = uiGet(); return {len: o.mockLen === 30 ? 30 : 15, scope: o.mockScope === "all" ? "all" : "studied"}; };
async function mockRender(){
  css();
  const hp = hashPath();
  let us; try{ us = await T.units(); }catch(e){ if(hashPath() === hp) calm({icon: "wifi-slash", title: "Couldn't load the interview", sub: e.message, href: "#/techmock", btn: "Back"}); return; }
  if(hashPath() !== hp) return;
  let saved = sGet("mock");
  let steps = saved ? restoreSteps(saved, s => mockStep(s.id)) : null;
  if(!steps){
    const p = prefs(), plan = mockPlan(us, p.len, p.scope);
    saved = {len: p.len, scope: p.scope, when: now(), i: 0, res: {}, mid: "m" + now().toString(36)};
    steps = plan.ids.map(mockStep).filter(Boolean);
  }
  if(!steps.length) return calm({icon: "info", title: "No questions yet", sub: "There are no interview questions in these units yet.", href: "#/techmock", btn: "Back"});
  const N = steps.length;
  runStart({kind: "mock", id: "mock", steps, i: saved.i || 0, res: saved.res || {}, cur: saved.cur || null, started: !!saved.started,
    st: {len: saved.len, scope: saved.scope, when: saved.when || now(), mid: saved.mid || "m" + now().toString(36), weak: saved.weak || null, stories: saved.stories || []},
    title: "Mock interview", label: "Interview progress",
    eye: (s, r) => `Question ${r.steps.indexOf(s) + 1} of ${N} · Unit ${s.u ? s.u.n : ""} · ${s.it.type === "story" ? "Story" : s.it.type === "scenario" ? "Scenario" : "Explain it"}`,
    write: it => it.type === "story" ? writeBtn(it) : "",
    /* las notas van al repaso como en el repaso (cuentan para los 5 «Explain it» de hoy y para la racha: js/tech.js suma
       la actividad de lo que ya estaba en el repaso; lo nuevo y las historias, aquí) */
    onAnswer: (s, res) => {
      if(res.skip) return;
      const had = !!T.srs.get(s.id);
      if(s.it.type === "explain") T.srs.gradeExplain(s.id, res.v, {review: true});
      else if(s.it.type === "scenario") T.srs.grade(s.id, res.g === 2 ? 2 : 0, {review: true});
      if(!had || s.it.type === "story") T.act.log(1);
    },
    onEnd: mockEnd});
}
const G_LABEL = {nailed: "Nailed it", partly: "Partly", notyet: "Not yet", right: "Right", wrong: "Wrong"};
const weakOf = g => g === "notyet" || g === "partly" || g === "wrong";
function mockEnd(r){
  const grades = {}, secs = {}, ids = [];
  for(const s of r.steps){
    const x = r.res[s.k] || {}; ids.push(s.id); secs[s.id] = Math.round(+x.secs || 0);
    grades[s.id] = s.it.type === "scenario" ? (x.skip ? "" : x.g === 2 ? "right" : "wrong") : (x.v || "");
  }
  const total = Object.values(secs).reduce((a, b) => a + b, 0);
  const rec = {when: r.st.when || now(), n: ids.length, grades, secs, items: ids, len: r.st.len || 15, scope: r.st.scope || "studied", total};
  T.put("mock", r.st.mid || "m" + now().toString(36), rec);
  const a = appEl(); if(!a) return;
  a.innerHTML = `<div class="tp-page tp-lrun tp-lend" id="tp-lmkend">
    <section class="card tp-card tp-lendc" aria-labelledby="tp-lend-t">
      <span class="tp-lend-ic" aria-hidden="true">${icon("microphone-stage", "fill", 32)}</span>
      <h2 class="tp-lend-t" id="tp-lend-t" tabindex="-1">Interview complete</h2>
      <p class="tp-lscore"><b>${plural(ids.length, "question", "questions")}</b> · ${esc(mins(total))}</p>
      <p class="tp-sub">${esc(gradeLine(grades))}</p>
    </section>
    ${summaryHtml(rec)}
    ${(r.st.stories || []).length ? `<h2 class="tp-h">Your stories to write</h2><div class="tp-list">${r.st.stories.filter(x => T.get("story", x.id)).map(x => ui.row({href: `#/techstory/${encodeURIComponent(x.id)}`, icon: "pencil-simple", t: "Write your story", sub: x.prompt})).join("")}</div>` : ""}
    <div class="tp-dock" id="tp-ldock">${mockEndBtns(rec)}</div></div>`;
  wireWeak(a, rec);
  const h = D.getElementById("tp-lend-t"); if(h) try{ h.focus({preventScroll: true}); }catch(e){}
  haptic("success");
  scrollTo(0, 0);
}
function gradeLine(grades){
  const c = {}; Object.values(grades).forEach(g => { if(g) c[g] = (c[g] || 0) + 1; });
  const parts = ["nailed", "partly", "notyet", "right", "wrong"].filter(k => c[k]).map(k => `${c[k]} ${G_LABEL[k].toLowerCase()}`);
  return parts.length ? parts.join(" · ") : "No answers graded";
}
function summaryHtml(rec){
  const rows = (rec.items || Object.keys(rec.grades || {})).map(id => {
    const x = T.item(id), it = x && x.item, q = it ? (it.q || it.prompt || "") : id, g = (rec.grades || {})[id] || "";
    const ok = g === "nailed" || g === "right";
    return `<li class="tp-lsum-r"><span class="tp-lsum-q">${esc(q)}</span><span class="tp-lsum-m"><span class="tp-lsum-t">${icon("timer", "bold", 16)}${mmss((rec.secs || {})[id] || 0)}</span>${g ? `<span class="tp-lsum-g ${ok ? "is-ok" : weakOf(g) ? "is-miss" : ""}">${ok ? icon("check", "bold", 16) : g === "wrong" || g === "notyet" ? icon("x", "bold", 16) : ""}${esc(G_LABEL[g] || g)}</span>` : `<span class="tp-lsum-g">Skipped</span>`}</span></li>`;
  }).join("");
  return `<section class="card tp-card tp-lsec tp-lsum" aria-label="Questions"><ol class="tp-lsum-l">${rows}</ol></section>`;
}
function weakIds(rec){ return (rec.items || []).filter(id => weakOf((rec.grades || {})[id]) && T.item(id)); }
function mockEndBtns(rec){
  const w = weakIds(rec);
  return w.length ? `<a class="glass-btn glass-btn--lg" href="#/techmock" id="tp-ldone">Done</a><button type="button" class="glass-btn glass-btn--lg glass-btn--pri" id="tp-lweak" data-key="enter">Practise the weak ones</button>`
    : `<a class="glass-btn glass-btn--lg glass-btn--pri" href="#/techmock" id="tp-ldone" data-key="enter">Done</a>`;
}
function startWeak(rec){
  const w = weakIds(rec); if(!w.length) return;
  RUN = null;
  sSet("mock", {len: rec.len || 15, scope: rec.scope || "studied", when: now(), mid: "m" + now().toString(36), steps: w.map(id => ({k: id, id})), i: 0, res: {}, weak: true});
  navTo("#/techl/mock");
}
function wireWeak(root, rec){ const b = root.querySelector("#tp-lweak, .tp-lweak"); if(b) b.addEventListener("click", () => { closeSheets(); startWeak(rec); }); }

/* la pantalla de preparar (pestaña Interview) */
function mockSetupHtml(us){
  const p = prefs(), saved = sGet("mock"), st = studied(us);
  const busyMock = saved && Array.isArray(saved.steps) && saved.steps.length;
  const hist = T.list("mock").filter(m => typeof m.when === "number").sort((a, b) => b.when - a.when).slice(0, 20);
  const scopeLine = p.scope === "all" ? `All ${plural(us.length, "available unit", "available units")}` : st.length ? `${st.map(u => `Unit ${u.n}`).join(", ")}` : `You haven't studied a unit yet, so all ${plural(us.length, "available unit", "available units")} are used`;
  return `<div class="tp-page tp-mk" id="tp-mk">
    ${busyMock ? `<section class="card tp-card tp-mk-go" aria-labelledby="tp-mk-c"><p class="tp-eyebrow">In progress</p><h2 class="tp-title" id="tp-mk-c">Mock interview</h2>
      <p class="tp-sub">${saved.i || 0} of ${plural(saved.steps.length, "question", "questions")} answered</p>
      <a class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block tp-go" id="tp-mk-cont" href="#/techl/mock" data-key="enter" data-no-renew>${icon("play", "fill", 20)}Continue</a></section>` : ""}
    <section class="card tp-card tp-mk-set" aria-labelledby="tp-mk-t">
      <h2 class="tp-title" id="tp-mk-t">${busyMock ? "Start a new one" : "A timed interview"}</h2>
      <p class="tp-text tp-mk-intro">Questions from your units, one at a time with a timer. Answer aloud or type, then compare with a model answer and say how it went.</p>
      <div class="tp-mk-f"><span class="tp-mk-l" id="tp-mk-ll">Length</span>
        <div class="seg tp-mk-seg" role="radiogroup" aria-labelledby="tp-mk-ll">${[15, 30].map(v => `<button type="button" class="seg-i" role="radio" data-len="${v}" aria-checked="${p.len === v}">${v} minutes</button>`).join("")}</div>
        <p class="tp-mk-s" id="tp-mk-ls">About ${LENS[p.len]} questions</p></div>
      <div class="tp-mk-f"><span class="tp-mk-l" id="tp-mk-sl">Questions from</span>
        <div class="seg tp-mk-seg" role="radiogroup" aria-labelledby="tp-mk-sl">${[["studied", "Units I've studied"], ["all", "All available units"]].map(([v, t]) => `<button type="button" class="seg-i" role="radio" data-scope="${v}" aria-checked="${p.scope === v}">${t}</button>`).join("")}</div>
        <p class="tp-mk-s" id="tp-mk-ss">${esc(scopeLine)}</p></div>
      <button type="button" class="glass-btn${busyMock ? "" : " glass-btn--pri"} glass-btn--lg glass-btn--block" id="tp-mk-start"${busyMock ? "" : ' data-key="enter"'} data-no-renew>${icon("play", busyMock ? "bold" : "fill", 20)}Start</button>
    </section>
    <h2 class="tp-h" id="tp-mk-h">Past interviews</h2>
    ${hist.length ? `<div class="tp-list" aria-labelledby="tp-mk-h">${hist.map(m => ui.row({icon: "chats-circle", tone: weakIds(m).length ? "" : "ok", t: fmt.date(T.dayStr(dayOf(m.when))) || "Mock interview",
      sub: `${plural(+m.n || (m.items || []).length, "question", "questions")} · ${mins(m.total)} · ${gradeLine(m.grades || {})}`, attrs: `data-mk="${esc(m.id)}"`, chev: true})).join("")}</div>`
      : `<p class="tp-sub tp-mk-none">Your mock interviews will appear here.</p>`}
  </div>`;
}
async function mockSetupRoute(){
  css();
  const hp = hashPath(), a = appEl();
  let us; try{ us = await T.units(); }catch(e){ if(hashPath() === hp && a) a.innerHTML = `<div class="tp-page">${ui.empty({icon: "wifi-slash", title: "Couldn't load Tech Prep", sub: e.message})}</div>`; return; }
  if(hashPath() !== hp || !a) return;
  a.innerHTML = mockSetupHtml(us);
  const root = D.getElementById("tp-mk");
  root.addEventListener("click", e => {
    const lb = e.target.closest("[data-len]"), sb = e.target.closest("[data-scope]");
    if(lb){ uiSet({mockLen: +lb.dataset.len}); paintSeg(root, us); haptic("selection"); return; }
    if(sb){ uiSet({mockScope: sb.dataset.scope}); paintSeg(root, us); haptic("selection"); return; }
    if(e.target.closest("#tp-mk-start")){
      const p = prefs(), plan = mockPlan(us, p.len, p.scope);
      if(!plan.ids.length){ toast("There are no interview questions in these units yet."); return; }
      RUN = null;
      sSet("mock", {len: p.len, scope: p.scope, when: now(), mid: "m" + now().toString(36), steps: plan.ids.map(id => ({k: id, id})), i: 0, res: {}});
      navTo("#/techl/mock");
      return;
    }
    const row = e.target.closest("[data-mk]");
    if(row){ const m = T.get("mock", row.dataset.mk); if(m) mockSheet(Object.assign({id: row.dataset.mk}, m), row); }
  });
  root.addEventListener("keydown", e => {   /* flechas en los grupos de opciones (radio) */
    const b = e.target.closest && e.target.closest(".tp-mk-seg [role=radio]"); if(!b) return;
    const k = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key]; if(!k) return;
    e.preventDefault(); const bs = $$("[role=radio]", b.parentElement), j = (bs.indexOf(b) + k + bs.length) % bs.length; bs[j].focus(); bs[j].click();
  });
}
function paintSeg(root, us){
  const p = prefs(), st = studied(us);
  $$("[data-len]", root).forEach(b => b.setAttribute("aria-checked", String(+b.dataset.len === p.len)));
  $$("[data-scope]", root).forEach(b => b.setAttribute("aria-checked", String(b.dataset.scope === p.scope)));
  const ls = $("#tp-mk-ls", root); if(ls) ls.textContent = `About ${LENS[p.len]} questions`;
  const ss = $("#tp-mk-ss", root); if(ss) ss.textContent = p.scope === "all" ? `All ${plural(us.length, "available unit", "available units")}` : st.length ? st.map(u => `Unit ${u.n}`).join(", ") : `You haven't studied a unit yet, so all ${plural(us.length, "available unit", "available units")} are used`;
}
let MKS = null;
function closeSheets(){ [MKS, CSH].forEach(d => { if(d && d.open) try{ if(W.M && typeof M.closeSheet === "function") M.closeSheet(d); else d.close(); }catch(e){ try{ d.close(); }catch(e2){} } }); }
function mockSheet(rec, from){
  if(!MKS || !MKS.isConnected){
    MKS = D.createElement("dialog"); MKS.id = "tp-lmks"; MKS.className = "tp-sheet tp-lsheet"; MKS.lang = "en-GB"; MKS.setAttribute("aria-labelledby", "tp-lmks-t"); MKS.dataset.noRenew = "";
    D.body.appendChild(MKS);
    MKS.addEventListener("click", e => { if(e.target.closest(".tp-sdone")) closeSheets(); });
  }
  const w = weakIds(rec);
  MKS.innerHTML = `<div class="tp-sbar"><h2 class="tp-stt" id="tp-lmks-t" tabindex="-1">${esc(fmt.date(T.dayStr(dayOf(rec.when))) || "Mock interview")}</h2><button type="button" class="tp-sdone">Done</button></div>
    <div class="tp-spg"><p class="tp-sub tp-lmks-s">${plural(+rec.n || (rec.items || []).length, "question", "questions")} · ${esc(mins(rec.total))} · ${esc(gradeLine(rec.grades || {}))}</p>
    ${summaryHtml(rec)}
    ${w.length ? `<button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block tp-lweak" data-key="enter" data-no-renew>Practise the weak ones</button>` : ""}</div>`;
  wireWeak(MKS, rec);
  try{ if(W.M && typeof M.openSheet === "function") M.openSheet(MKS, {from}); else MKS.showModal(); }catch(e){ try{ MKS.showModal(); }catch(e2){} }
  try{ MKS.querySelector("#tp-lmks-t").focus({preventScroll: true}); }catch(e){}
}

/* ---------- practicar un caso (#/techl/case/<caseId>) ---------- */
async function caseRender(parts){
  css();
  const cid = String(parts[0] || ""), hp = hashPath(), back = cid ? `#/techcase/${encodeURIComponent(cid)}` : "#/techcases";
  const fn = T.cases && T.cases.questions;
  if(typeof fn !== "function") return calm({icon: "info", title: "Case practice isn't here yet", sub: "This version doesn't have the case questions. Your cases are safe in My cases.", href: back, btn: "Back to the case"});
  let qs = null, err = null;
  try{ qs = await fn.call(T.cases, cid); }catch(e){ err = e; }
  if(err && typeof T.cases.get === "function"){   /* ¿el caso no existe, o no se pudieron cargar los casos? */
    let loaded = typeof T.cases.load !== "function";
    if(!loaded) try{ await T.cases.load(); loaded = true; }catch(e){}
    if(hashPath() !== hp) return;
    if(loaded && !T.cases.get(cid)) return calm({icon: "info", title: "This case isn't here", sub: "It may have been deleted, or the link is wrong.", href: "#/techcases", btn: "Back to My cases"});
  }
  if(hashPath() !== hp) return;
  const list = (Array.isArray(qs) ? qs : []).filter(q => q && q.id != null && (q.q || q.prompt));
  if(!list.length) return calm({icon: err ? "wifi-slash" : "info", title: err ? "Couldn't load the questions" : "No questions for this case", sub: err ? String(err.message || "Check the connection and try again.") : "There are no interviewer questions for this case yet.", href: back, btn: "Back to the case"});
  const byK = {};
  const steps = list.map(q => { const k = String(q.id); const s = {k, id: k, it: Object.assign({}, q, {id: k, type: "explain", seconds: +q.seconds || 120}), u: null, type: "explain"}; byK[k] = s; return s; });
  const saved = sGet("case");
  const resume = saved && saved.id === cid ? restoreSteps(saved, s => byK[s.id] ? Object.assign({}, byK[s.id]) : null) : null;
  const N = (resume || steps).length;
  runStart({kind: "case", id: cid, steps: resume || steps, i: resume ? saved.i : 0, res: resume ? saved.res : {}, cur: resume ? saved.cur : null, started: resume ? saved.started : false,
    title: "Case practice", label: "Case practice progress",
    eye: (s, r) => `Question ${r.steps.indexOf(s) + 1} of ${N}`,
    onAnswer: (s, res) => { if(!res.skip) T.act.log(1); },   /* no entra en el repaso; sí cuenta para la racha */
    onEnd: r => caseEnd(r, cid, back)});
  addCaseBtn(cid);
}
/* «Case notes»: el caso a un toque (una hoja) */
function addCaseBtn(cid){
  const run = D.getElementById("tp-lrun"); if(!run || run.querySelector(".tp-lcasebar")) return;
  const bar = D.createElement("div"); bar.className = "tp-lcasebar";
  bar.innerHTML = `<button type="button" class="glass-btn glass-btn--sm" id="tp-lcaseb">${icon("clipboard-text", "bold", 18)}<span>Case notes</span></button>`;
  const rt = run.querySelector(".tp-lrt"); (rt || run.querySelector(".tp-ftop")).after(bar);
  bar.querySelector("button").addEventListener("click", e => caseSheet(cid, e.currentTarget));
}
async function caseData(cid){
  const own = T.get("case", cid); if(own) return own;
  const C = T.cases || {};
  for(const f of ["get", "model", "byId", "one"]) if(typeof C[f] === "function"){ try{ const r = await C[f](cid); if(r) return r; }catch(e){} }
  try{ const r = await fetch("data/tech/cases.json"); if(r.ok){ const j = await r.json(); const c = (j.cases || []).find(x => x.id === cid); if(c) return c; } }catch(e){}
  return null;
}
const FIELDS = [["context", "Context"], ["requirements", "Requirements"], ["options", "Options"], ["decision", "Decision"], ["tradeoffs", "Trade-offs"], ["outcome", "Outcome"]];
let CSH = null;
async function caseSheet(cid, from){
  if(!CSH || !CSH.isConnected){
    CSH = D.createElement("dialog"); CSH.id = "tp-lcase"; CSH.className = "tp-sheet tp-lsheet"; CSH.lang = "en-GB"; CSH.setAttribute("aria-labelledby", "tp-lcase-t"); CSH.dataset.noRenew = "";
    D.body.appendChild(CSH);
    CSH.addEventListener("click", e => { if(e.target.closest(".tp-sdone")) closeSheets(); });
  }
  CSH.innerHTML = `<div class="tp-sbar"><h2 class="tp-stt" id="tp-lcase-t" tabindex="-1">Case notes</h2><button type="button" class="tp-sdone">Done</button></div><div class="tp-spg"><p class="tp-sub">Loading…</p></div>`;
  try{ if(W.M && typeof M.openSheet === "function") M.openSheet(CSH, {from}); else CSH.showModal(); }catch(e){ try{ CSH.showModal(); }catch(e2){} }
  const c = await caseData(cid);
  const pg = CSH.querySelector(".tp-spg"); if(!pg) return;
  if(!c){ pg.innerHTML = `<p class="tp-sub">The case text isn't available.</p>`; return; }
  const f = isObj(c.fields) ? c.fields : {};
  const FL = T.cases && Array.isArray(T.cases.FIELDS) && T.cases.FIELDS.length ? T.cases.FIELDS.map(x => [x.k, x.t]) : FIELDS;   /* los títulos de My cases */
  pg.innerHTML = `<h3 class="tp-title tp-lcase-h">${esc(c.title || "Untitled case")}</h3>${c.summary ? `<p class="tp-ltext">${esc(c.summary)}</p>` : ""}
    ${FL.filter(([k]) => String(f[k] || "").trim()).map(([k, t]) => `<section class="tp-lcf"><h4 class="tp-lh3">${t}</h4><p class="tp-ltext tp-lpw">${esc(String(f[k]).trim())}</p></section>`).join("") || `<p class="tp-sub">This case has no notes yet.</p>`}`;
}
function caseEnd(r, cid, back){
  const grades = {};
  r.steps.forEach(s => { const x = r.res[s.k] || {}; if(x.v) grades[s.id] = x.v; });
  T.put("cp", cid, {when: now(), n: r.steps.length, grades});
  const a = appEl(); if(!a) return;
  a.innerHTML = `<div class="tp-page tp-lrun tp-lend" id="tp-lcsend">
    <section class="card tp-card tp-lendc" aria-labelledby="tp-lend-t">
      <span class="tp-lend-ic" aria-hidden="true">${icon("briefcase", "fill", 32)}</span>
      <h2 class="tp-lend-t" id="tp-lend-t" tabindex="-1">Case practice complete</h2>
      <p class="tp-lscore"><b>${plural(r.steps.length, "question", "questions")}</b></p>
      <p class="tp-sub">${esc(gradeLine(grades))}</p>
    </section>
    <section class="card tp-card tp-lsec tp-lsum" aria-label="Questions"><ol class="tp-lsum-l">${r.steps.map(s => { const g = grades[s.id]; return `<li class="tp-lsum-r"><span class="tp-lsum-q">${esc(s.it.q || s.it.prompt)}</span><span class="tp-lsum-m"><span class="tp-lsum-t">${icon("timer", "bold", 16)}${mmss((r.res[s.k] || {}).secs || 0)}</span><span class="tp-lsum-g ${g === "nailed" ? "is-ok" : g ? "is-miss" : ""}">${esc(G_LABEL[g] || "Skipped")}</span></span></li>`; }).join("")}</ol></section>
    <div class="tp-dock" id="tp-ldock"><a class="glass-btn glass-btn--lg glass-btn--pri" href="${esc(back)}" id="tp-ldone" data-key="enter">Done</a></div></div>`;
  const h = D.getElementById("tp-lend-t"); if(h) try{ h.focus({preventScroll: true}); }catch(e){}
  haptic("success");
  scrollTo(0, 0);
}

/* ---------- al salir de la pantalla ---------- */
bus.on("route", () => { if(RUN && hashPath() !== RUN.path){ cleanup(RUN); RUN = null; } if(secOf(hashPath()) !== "techmock") closeSheets(); });
bus.on("tech-mode", d => { if(d && !d.on){ stopRun(); closeSheets(); } });
D.addEventListener("visibilitychange", () => { if(D.visibilityState === "hidden"){ dictStop(); if(RUN) persist(RUN); } });

/* ---------- registro ---------- */
T.focus.register("lesson", Object.assign({render: lessonRender, load: () => T.units()}, FOCUS_OPTS));
T.focus.register("review", Object.assign({render: reviewRender, load: () => T.units()}, FOCUS_OPTS));
T.focus.register("mock", Object.assign({render: mockRender, load: () => T.units()}, FOCUS_OPTS));
T.focus.register("case", Object.assign({render: caseRender, load: () => T.units()}, FOCUS_OPTS));
ROUTES.techmock = () => mockSetupRoute();
ROUTES.techmock.load = () => T.units();

/* ---------- CSS ---------- */
const STYLE = `
.tp-lrun{gap:0}
.tp-lcount{flex:none;font:600 var(--fs-note)/1 var(--f-text);color:var(--label2);font-variant-numeric:tabular-nums;white-space:nowrap}
.tp-lrt{margin:-6px 0 14px;font:400 var(--fs-note)/1.35 var(--f-text);color:var(--label2);overflow-wrap:anywhere}
.tp-lstage{display:flex;flex-direction:column;gap:12px;min-width:0}
.tp-lstage.tp-lin{animation:tp-lin var(--d-base,260ms) ease-out}
@keyframes tp-lin{from{opacity:0;translate:0 8px}to{opacity:1;translate:0 0}}
.tp-litem{display:flex;flex-direction:column;gap:12px;min-width:0}
.tp-litem>.tp-eyebrow{margin:0}
.tp-lq{margin:0;font:700 var(--fs-t3)/1.28 var(--f-round);color:var(--label);overflow-wrap:anywhere;text-wrap:pretty;max-width:36em}
.tp-lq:focus,.tp-term-t:focus,.tp-lsent:focus,.tp-lend-t:focus,.tp-stt:focus{outline:none}
.tp-lq-s{font:500 var(--fs-head)/1.45 var(--f-text);max-width:70ch}
.tp-lstate .tp-lq{font-size:var(--fs-t3)}
.tp-lhint{margin:0;font:400 var(--fs-note)/1.4 var(--f-text);color:var(--label2);max-width:70ch}
.tp-lh3{margin:0;font:600 var(--fs-head)/1.3 var(--f-text);color:var(--label)}
.tp-lcnt{font-weight:400;color:var(--label2)}
.tp-ltext{margin:0;font:400 var(--fs-sub)/1.55 var(--f-text);color:var(--label);max-width:70ch;overflow-wrap:anywhere}
.tp-lpw{white-space:pre-wrap}
.tp-lsec{display:flex;flex-direction:column;gap:10px}
.tp-lsech{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.tp-lsrc{display:flex;margin:-4px 0 0}
/* opciones sólidas */
.tp-lopts{display:flex;flex-direction:column;gap:10px}
.tp-lopt{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:56px;margin:0;padding:12px 16px;border:0;border-radius:var(--r-md);
  background:var(--card);color:var(--label);font:500 var(--fs-head)/1.35 var(--f-text);text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;
  box-shadow:0 1px 2px rgba(0,0,0,.05);transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms)}
.tp-lot{flex:1;min-width:0;overflow-wrap:anywhere;max-width:66ch}
.tp-lowhy{display:block;margin-top:8px;font:400 var(--fs-sub)/1.45 var(--f-text);color:inherit;opacity:.92}
.tp-lopt.is-dim .tp-lowhy{color:var(--label2);opacity:1}
.tp-lopt:disabled{cursor:default}
.tp-lopt.is-ok{background:var(--ok-fill);color:#fff;box-shadow:0 8px 20px -10px rgba(0,137,50,.7)}
.tp-lopt.is-miss{background:var(--miss-fill);color:var(--miss-on);box-shadow:none}
.tp-lopt.is-dim{color:var(--label2)}
.tp-lk{display:none;flex:none}
:root[data-kbd] .tp-lk{display:inline-flex}
@media (hover:hover) and (pointer:fine){.tp-lk{display:inline-flex}}
.tp-lopt.is-ok .tp-lk,.tp-lopt.is-miss .tp-lk,.tp-lopt.is-dim .tp-lk{visibility:hidden}
.tp-lmk{flex:none;display:grid;place-items:center;align-self:center}
.tp-lopt .tp-lmk{width:28px;height:28px;border-radius:50%}
.tp-lopt.is-ok .tp-lmk{background:rgba(255,255,255,.22)}
.tp-ltf{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tp-ltf .tp-lopt{justify-content:center;text-align:center;min-height:64px;font:700 var(--fs-t3)/1.2 var(--f-round)}
.tp-ltf .tp-lot{flex:none}
.tp-ltf .tp-lk{position:absolute;left:10px;top:10px}
/* lo que dice al contestar */
.tp-lfb{display:flex;flex-direction:column;gap:8px;padding:14px 16px;border-radius:var(--r-md);background:var(--card)}
.tp-lfb[hidden]{display:none}
.tp-lv{display:flex;align-items:center;gap:8px;margin:0;font:700 var(--fs-head)/1.3 var(--f-text)}
.tp-lv.ok{color:var(--ok-ink)}
.tp-lv.miss{color:var(--label)}.tp-lv.miss .ico{color:var(--miss-ink)}
.tp-lwhy{margin:0;font:400 var(--fs-sub)/1.5 var(--f-text);color:var(--label);max-width:70ch}
/* match */
.tp-lmatch{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:start}
.tp-lmcol{display:flex;flex-direction:column;gap:8px;min-width:0}
.tp-lmi{position:relative;display:flex;align-items:center;gap:8px;width:100%;min-height:56px;margin:0;padding:10px 12px;border:2px solid transparent;border-radius:var(--r-md);
  background:var(--card);color:var(--label);font:500 var(--fs-sub)/1.35 var(--f-text);text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;
  box-shadow:0 1px 2px rgba(0,0,0,.05);transition:background-color var(--d-fast,160ms),border-color var(--d-fast,160ms)}
.tp-lmi-t{flex:1;min-width:0;overflow-wrap:break-word}
.tp-lmi[aria-pressed=true],.tp-lmi.is-hover{border-color:var(--brand-tint);background:var(--brand-soft);color:var(--brand-ink)}
.tp-lmi.is-ok{background:var(--ok-fill);color:#fff;border-color:transparent;cursor:default}
.tp-lmi.is-miss{background:var(--miss-fill);color:var(--miss-on);border-color:transparent}
.tp-lpn{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.25);font:700 var(--fs-note)/1 var(--f-text)}
.tp-lmi-t,.tp-lst-t,.tp-lot{hyphens:auto;-webkit-hyphens:auto}
.tp-lmdone{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.tp-lmd{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 12px;align-items:start;padding:12px 14px;border-radius:var(--r-md);background:var(--card);box-shadow:0 1px 2px rgba(0,0,0,.05)}
.tp-lmd>.tp-lmk{grid-row:1/3;width:28px;height:28px;border-radius:50%;background:var(--ok-fill);color:#fff}
.tp-lmd-l{font:400 var(--fs-sub)/1.4 var(--f-text);color:var(--label);overflow-wrap:break-word}
.tp-lmd-r{display:flex;gap:6px;align-items:baseline;font:600 var(--fs-sub)/1.4 var(--f-text);color:var(--ok-ink);overflow-wrap:break-word}
.tp-lmd-r .ico{flex:none;align-self:flex-start;margin-top:.2em}
/* order */
.tp-lord{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.tp-lsr{position:relative;display:flex;align-items:stretch;border-radius:var(--r-md);background:var(--card);color:var(--label);box-shadow:0 1px 2px rgba(0,0,0,.05)}
.tp-lsb{flex:1;min-width:0;display:flex;align-items:center;gap:10px;min-height:56px;margin:0;padding:10px 4px 10px 14px;border:0;border-radius:inherit;background:none;color:inherit;
  font:500 var(--fs-sub)/1.4 var(--f-text);text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}
.tp-lsb:disabled{cursor:default}
.tp-lst-t{flex:1;min-width:0;overflow-wrap:anywhere}
.tp-lnum{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--fill);font:700 var(--fs-note)/1 var(--f-text);font-variant-numeric:tabular-nums}
.tp-lgrip{flex:none;width:44px;display:grid;place-items:center;color:var(--label2);touch-action:none;cursor:grab}
.tp-lsr.is-ok{background:var(--ok-fill);color:#fff}.tp-lsr.is-ok .tp-lnum{background:rgba(255,255,255,.25)}.tp-lsr.is-ok .tp-lgrip{color:#fff}
.tp-lsr.is-miss{background:var(--miss-fill);color:var(--miss-on);box-shadow:none}.tp-lsr.is-miss .tp-lgrip{color:var(--miss-on)}
.tp-lslot{display:flex;align-items:center;justify-content:center;min-height:56px;padding:8px 14px;border:2px dashed var(--sep);border-radius:var(--r-md);
  font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2);text-align:center}
.tp-lins{height:4px;margin:-2px 8px;border-radius:2px;background:var(--brand-tint);list-style:none}
.tp-lpool .tp-lsr{background:var(--card)}
/* code */
.tp-lcb{position:relative;display:flex;flex-direction:column;gap:6px;padding:12px 0;border-radius:var(--r-md);background:var(--card);min-width:0}
.tp-lcb>.tp-badge{align-self:flex-start;margin:0 16px}
.tp-lpre{overflow-x:auto;padding:2px 16px 6px;font:400 var(--fs-note)/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono","DejaVu Sans Mono",monospace;color:var(--label);overscroll-behavior-x:contain}
.tp-lpre:focus-visible{outline-offset:-3px}
.tp-lln{white-space:pre;min-width:max-content;min-height:1.65em}
.tp-lln.has-gap{padding:2px 0;white-space:pre-wrap;min-width:0}
.tp-lgap{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:56px;min-height:44px;margin:0;padding:0 10px;border:2px dashed var(--brand-tint);border-radius:10px;
  background:var(--brand-soft);color:var(--brand-ink);font:600 var(--fs-note)/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono","DejaVu Sans Mono",monospace;vertical-align:middle;
  white-space:normal;overflow-wrap:anywhere;text-align:left;max-width:100%;cursor:pointer}
.tp-lgap:not(.is-empty){border-style:solid;border-color:var(--sep);background:var(--fill2);color:var(--label)}
.tp-lgap.is-sel{box-shadow:0 0 0 3px var(--brand-tint);border-color:var(--brand-tint)}
.tp-lgap.is-hover{border-style:solid;border-color:var(--brand-tint);background:var(--brand-soft)}
.tp-lgap.is-ok{background:var(--ok-fill);color:#fff;border:2px solid transparent;box-shadow:none}
.tp-lgap.is-miss{background:var(--miss-fill);color:var(--miss-on);border:2px solid transparent;box-shadow:none}
.tp-lchips{display:flex;flex-wrap:wrap;gap:8px}
.tp-lchips[hidden],.tp-lhint[hidden]{display:none}
.tp-lchip{text-align:left;max-width:100%}
.tp-lchip.is-used{visibility:hidden}
.tp-lmono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono","DejaVu Sans Mono",monospace;font-weight:500;font-size:var(--fs-note)}
/* diagramas */
.tp-ldg{margin:4px 0 0;min-width:0}
.tp-ldgc{padding:16px 12px}
.tp-ldg-w{position:relative;display:flex;flex-direction:column;align-items:stretch}
.tp-ldg-row{position:relative;z-index:1;display:grid;grid-template-columns:repeat(var(--c),minmax(0,1fr));gap:10px;justify-items:center;align-items:center}
.tp-ldg-gap{height:44px;flex:none}
.tp-ldg-n{position:relative;display:flex;align-items:center;justify-content:center;gap:4px;width:100%;max-width:260px;min-height:48px;margin:0;padding:8px 10px;border:1.5px solid var(--sep);border-radius:12px;
  background:var(--fill2);color:var(--label);font:600 var(--fs-note)/1.3 var(--f-text);text-align:center;overflow-wrap:anywhere;hyphens:auto;-webkit-hyphens:auto}
:root[data-theme=dark] .tp-ldg-n{background:var(--card-2)}
.tp-ldg-slot{border:2px dashed var(--brand-tint);background:var(--card);color:var(--brand-ink);cursor:pointer;min-height:52px}
.tp-ldg-slot:not(.is-empty){border-style:solid;border-color:var(--sep);color:var(--label);background:var(--fill2)}
.tp-ldg-slot.is-sel{box-shadow:0 0 0 3px var(--brand-tint);border-color:var(--brand-tint)}
.tp-ldg-slot.is-hover{border-style:solid;border-color:var(--brand-tint);background:var(--brand-soft)}
.tp-ldg-slot.is-ok{background:var(--ok-fill);color:#fff;border:2px solid transparent;box-shadow:none}
.tp-ldg-slot.is-miss{background:var(--miss-fill);color:var(--miss-on);border:2px solid transparent;box-shadow:none}
.tp-ldg-svg{position:absolute;left:0;top:0;z-index:0;overflow:visible;pointer-events:none}
.tp-ldg-svg path{fill:none;stroke:var(--label2);stroke-width:1.75}
.tp-ldg-svg marker path{fill:var(--label2);stroke:none}
.tp-ldg-lb{position:absolute;z-index:2;left:0;top:0;padding:1px 6px;border-radius:8px;background:var(--card);color:var(--label2);
  font:400 var(--fs-note)/1.3 var(--f-text);text-align:center;overflow-wrap:anywhere;white-space:normal;width:max-content}
.tp-ldg-lb[hidden]{display:none}
.tp-ldg[data-dir=ltr] .tp-ldg-w{flex-direction:row;align-items:center}
.tp-ldg[data-dir=ltr] .tp-ldg-row{flex:1 1 0;min-width:0;grid-template-columns:minmax(0,1fr);gap:14px}
.tp-ldg[data-dir=ltr] .tp-ldg-gap{height:auto;width:96px;align-self:stretch}
.tp-ldg-more{list-style:none;margin:12px 0 0;padding:10px 0 0;border-top:1px solid var(--sep);display:flex;flex-direction:column;gap:6px}
.tp-ldg-more li{display:flex;gap:8px;align-items:flex-start;font:400 var(--fs-note)/1.4 var(--f-text);color:var(--label)}
.tp-ldg-more .ico{flex:none;margin-top:2px;color:var(--label2)}
.tp-ldg-more b{font-weight:600}
.tp-ldg-ol{display:block;color:var(--label2)}
.tp-ldg-sh{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:6px;position:relative;z-index:1}
.tp-ldg-seq .tp-ldg-n{min-height:52px;padding:6px 3px}
.tp-ldg-sh{gap:4px}
.tp-ldg-ms{position:relative;list-style:none;margin:0;padding:6px 0 10px;display:flex;flex-direction:column;gap:2px}
.tp-ldg-life{position:absolute;top:0;bottom:0;width:0;border-left:1.5px dashed var(--sep);translate:-.75px 0}
.tp-ldg-m{position:relative;display:flex;flex-direction:column;padding:6px 0 10px}
.tp-ldg-mt{position:relative;z-index:1;display:flex;gap:6px;align-items:baseline;margin:0 0 6px;font:400 var(--fs-note)/1.35 var(--f-text);color:var(--label);overflow-wrap:anywhere}
.tp-ldg-mt.on-span{justify-content:center;text-align:center}
.tp-ldg-mt b{flex:none;min-width:22px;height:22px;padding:0 6px;border-radius:11px;display:inline-grid;place-items:center;background:var(--brand-soft);color:var(--brand-ink);font:700 var(--fs-note)/1 var(--f-text)}
.tp-ldg-mt span{background:var(--card);border-radius:6px;padding:0 4px}
.tp-ldg-ma{position:relative;display:block;height:2px;background:var(--label2)}
.tp-ldg-ma::after{content:"";position:absolute;top:-5px;border:6px solid transparent}
.tp-ldg-ma.r::after{right:-2px;border-left:9px solid var(--label2);border-right:0}
.tp-ldg-ma.l::after{left:-2px;border-right:9px solid var(--label2);border-left:0}
/* card, say y story */
.tp-lcard{gap:10px}
.tp-lcard .tp-term-t{font-size:var(--fs-t1)}
.tp-lback{display:flex;flex-direction:column;gap:8px}
.tp-lback[hidden]{display:none}
.tp-lsay{gap:12px}
.tp-lsent{margin:0;font:600 var(--fs-t3)/1.4 var(--f-round);color:var(--label);max-width:34em;overflow-wrap:anywhere}
.tp-lsays{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}
.tp-llisten{gap:6px}
.tp-llisten.playing{background:var(--brand-fill);color:#fff}
.tp-lstar-s{margin:0;padding:0 0 0 22px;display:flex;flex-direction:column;gap:6px;font:400 var(--fs-sub)/1.4 var(--f-text);color:var(--label)}
.tp-lstar-s b{font-weight:600}
.tp-lstar-s span{display:block;color:var(--label2);font-size:var(--fs-note)}
.tp-lstory{margin:0;display:grid;grid-template-columns:minmax(0,1fr);gap:4px}
.tp-lstory dt{margin-top:6px;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--brand-ink)}
.tp-lstory dt:first-child{margin-top:0}
.tp-lstory dd{margin:0;font:400 var(--fs-sub)/1.55 var(--f-text);color:var(--label);max-width:70ch}
.tp-lwrite{display:flex;flex-direction:column;align-items:flex-start;gap:4px}
.tp-lwrite .tp-sub{margin:0}
.tp-lwr[aria-pressed=true]{color:var(--ok-ink)}
/* explain */
.tp-lexbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.tp-ltm{display:inline-flex;align-items:center;gap:8px;min-height:44px;font:600 var(--fs-sub)/1 var(--f-text);font-variant-numeric:tabular-nums;color:var(--label)}
.tp-ltm-r{display:grid}
.tp-ltm-of{font-weight:400;color:var(--label2)}
.tp-lans{display:flex;flex-direction:column;align-items:stretch;gap:8px}
.tp-lans .tp-lmic{align-self:flex-start}
.tp-lmic[aria-pressed=true]{background:var(--brand-fill);color:#fff}
.tp-lstat{margin:0;font:400 var(--fs-note)/1.4 var(--f-text);color:var(--label2)}
.tp-lstat.on{color:var(--brand-ink);font-weight:600}
.tp-lstat[hidden]{display:none}
.tp-llab{margin-top:4px;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.tp-lta{display:block;width:100%;min-height:160px;margin:0;padding:12px 14px;border:1px solid var(--sep);border-radius:12px;background:var(--bg);color:var(--label);
  font:400 var(--fs-sub)/1.5 var(--f-text);resize:vertical;overflow-wrap:anywhere}
.tp-lta::placeholder{color:var(--label2);opacity:1}
.tp-lta:focus-visible{outline:3px solid var(--brand-tint);outline-offset:1px}
.tp-lexb,.tp-lgrades{display:flex;gap:10px;flex-wrap:wrap}
.tp-lgrades .tp-lgr{flex:1 1 0;min-width:96px}
.tp-lgrades .tp-lgr[aria-pressed=true]{background:var(--brand-fill);color:#fff}
.tp-lyours{white-space:pre-wrap}
.tp-lmeta{display:flex;align-items:center;gap:6px;margin:0;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2);font-variant-numeric:tabular-nums}
.tp-lkps,.tp-lcov{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.tp-lcov{list-style:disc;padding-left:22px;gap:6px;font:400 var(--fs-sub)/1.45 var(--f-text)}
.tp-lkp{display:flex;gap:10px;align-items:flex-start;font:400 var(--fs-sub)/1.4 var(--f-text);color:var(--label)}
.tp-lkp-i{flex:none;display:grid;color:var(--miss-ink)}
.tp-lkp.is-on .tp-lkp-i{color:var(--ok-ink)}
.tp-lkp-t{min-width:0;overflow-wrap:anywhere}
.tp-lkp-t small{display:block;margin-top:2px;font-size:var(--fs-note);color:var(--label2)}
.tp-lnote{margin:0}
.tp-lstar{margin:0;padding:0;border:0;display:flex;flex-direction:column;gap:2px}
.tp-lstar legend{padding:0;margin-bottom:6px}
.tp-lchk{display:flex;align-items:center;gap:12px;min-height:44px;font:400 var(--fs-sub)/1.3 var(--f-text);color:var(--label);cursor:pointer}
.tp-lchk input{flex:none;width:22px;height:22px;margin:0;accent-color:var(--ok-fill)}
.tp-lhow{margin-top:4px}
.tp-dock .tp-lgr{padding:0 8px;min-width:0;font-size:var(--fs-sub)}
/* finales: el principal se lleva casi todo el sitio que sobra; si no caben en una fila, uno encima de otro (el principal arriba) */
.tp-lend{gap:12px;padding-bottom:calc(var(--btn-main) + 12px)}
.tp-lend .tp-dock,.tp-lcalm .tp-dock{flex-wrap:wrap-reverse}
.tp-lend .tp-dock>*,.tp-lcalm .tp-dock>*{flex:1 0 auto;padding:0 22px}
.tp-lend .tp-dock>.glass-btn--pri{flex-grow:3}
.tp-lendc{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:24px 20px}
.tp-lend-ic{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:var(--ok-soft);color:var(--ok-ink)}
.tp-lend-t{margin:8px 0 0;font:700 var(--fs-t1)/1.2 var(--f-round);color:var(--label)}
.tp-lscore{margin:4px 0 0;font:400 var(--fs-head)/1.35 var(--f-text);color:var(--label)}
.tp-lscore b{font-weight:700}
.tp-lend .tp-sub{margin:0}
.tp-lback-l,.tp-lmedal{display:flex;align-items:center;justify-content:center;gap:6px;margin:6px 0 0;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label)}
.tp-lback-l .ico{color:var(--label2)}
.tp-lmedal{font-weight:600}.tp-lmedal .ico{color:var(--gold-ink)}
.tp-lwhen .tp-h{margin-top:10px}
.tp-lpct{flex:none;font:700 var(--fs-sub)/1 var(--f-text);font-variant-numeric:tabular-nums;color:var(--label)}
.tp-lsum{padding:6px 16px}
.tp-lsum-l{list-style:none;margin:0;padding:0}
.tp-lsum-r{display:flex;flex-direction:column;gap:6px;padding:12px 0}
.tp-lsum-r+.tp-lsum-r{border-top:1px solid var(--sep)}
.tp-lsum-q{font:400 var(--fs-sub)/1.4 var(--f-text);color:var(--label);overflow-wrap:anywhere}
.tp-lsum-m{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font:400 var(--fs-note)/1.2 var(--f-text);color:var(--label2);font-variant-numeric:tabular-nums}
.tp-lsum-t,.tp-lsum-g{display:inline-flex;align-items:center;gap:4px}
.tp-lsum-g{min-height:26px;padding:0 10px;border-radius:13px;background:var(--fill2);color:var(--label2);font-weight:600}
.tp-lsum-g.is-ok{background:var(--ok-fill);color:#fff}
.tp-lsum-g.is-miss{background:var(--miss-fill);color:var(--miss-on)}
.tp-lcalm{padding-top:8px}
.tp-lcasebar{display:flex;margin:-4px 0 12px}
/* hojas (historial de una entrevista, el caso) */
dialog.tp-lsheet.m-sheet{padding:0;overflow:hidden;max-width:640px;height:min(720px,calc(100dvh - var(--safe-t,0px) - 24px))}
dialog.tp-lsheet.m-sheet[open]{display:flex;flex-direction:column}
dialog.tp-lsheet.m-sheet,dialog.tp-lsheet.m-sheet.glass{background:#F2F2F7;-webkit-backdrop-filter:none;backdrop-filter:none}
:root[data-theme=dark] dialog.tp-lsheet.m-sheet,:root[data-theme=dark] dialog.tp-lsheet.m-sheet.glass{background:#1C1C1E}
dialog.tp-lsheet .m-grab{flex:none;margin:0;position:relative}
dialog.tp-lsheet .tp-spg{display:flex;flex-direction:column;gap:12px}
.tp-lcase-h{margin:0}
.tp-lcf{display:flex;flex-direction:column;gap:4px}
.tp-lmks-s{margin:0}
@media (min-width:820px){dialog.tp-lsheet.m-sheet{height:fit-content;max-height:min(760px,calc(100dvh - 152px))}}
/* preparar la entrevista (#/techmock) */
.tp-mk-set,.tp-mk-go{display:flex;flex-direction:column;gap:12px}
.tp-mk-intro{margin:0}
.tp-mk-f{display:flex;flex-direction:column;gap:6px}
.tp-mk-l{font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.tp-mk-seg.seg{margin:0;max-width:none}
.tp-mk-seg .seg-i{min-width:0;white-space:normal;text-align:center;line-height:1.2;padding:4px 8px}
.tp-mk-s{margin:0;font:400 var(--fs-note)/1.35 var(--f-text);color:var(--label2)}
.tp-mk-none{margin:0 16px}
.tp-mk .tp-go{margin-top:4px}
@media (prefers-reduced-motion:reduce){.tp-lstage.tp-lin{animation:tp-lfade 120ms ease-out}.tp-lopt,.tp-lmi{transition:none}}
:root[data-motion=calm] .tp-lstage.tp-lin{animation:tp-lfade 120ms ease-out}
@keyframes tp-lfade{from{opacity:0}to{opacity:1}}
@media (forced-colors:active){.tp-lopt,.tp-lmi,.tp-lsr,.tp-ldg-n,.tp-lgap{border:1px solid CanvasText}.tp-ldg-svg path{stroke:CanvasText}}
`;
function css(){ T.css(); if(D.getElementById("css-tech-lesson") || !D.head) return; const s = D.createElement("style"); s.id = "css-tech-lesson"; s.textContent = STYLE; D.head.appendChild(s); }
css();

Object.assign(T.lesson, {
  explain: (el, item, opts) => { css(); return explain(el, item || {}, opts || {}); },
  dictation: {can: dictCan, start: dictStart, stop: dictStop},
  keypoints, normText, storyParts, storyDraft,
  diagram: {html: dgHtml, fit: dgFit},
  state: () => lsRead(),
});
/* la sesión en marcha: {kind, id, i, n, started, ended, step: {k, id, type, re, it}} (null fuera de una sesión) */
Object.defineProperty(T.lesson, "running", {configurable: true, enumerable: true, get(){
  if(!RUN) return null;
  const s = RUN.steps[RUN.i];
  return {kind: RUN.kind, id: RUN.id, i: RUN.i, n: RUN.steps.length, started: RUN.started, ended: RUN.ended,
    step: s ? {k: s.k, id: s.id, type: s.type || (s.it && s.it.type), re: !!s.re, it: s.it} : null};
}});
})();
