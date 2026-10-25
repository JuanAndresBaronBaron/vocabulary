/* Módulo tech-pages (las páginas de Tech Prep; S1-SPEC §10.2-§10.8). Lo carga js/tech-boot.js después de js/tech.js y
   js/tech-lesson.js (solo si está en SHELL de sw.js) y añade a window.vocabTech:
   · Las rutas (ROUTES.<sec> = async parts => …, con su .load para que navmotion pinte de una vez):
     #/techpath (Path: los bloques en el orden del camino, sus unidades con los 3 puntos de lección, «Coming soon» que se
     lee pero no se toca y, por bloque, su «Interview ready» y «Cheat sheet») · #/techunit/<uNN> (lecciones, términos con
     IPA y voz, la chuleta de la unidad, fuentes, la fecha de revisión y las notas de versión en letra pequeña) ·
     #/techsheet/<bloque> (la chuleta del bloque y «Interview answers»: cada respuesta modelo de explain y cada historia,
     con voz; la cápsula de volver lleva a donde se estaba) · #/techgloss (glosario A-Z con buscador) · #/techplay
     (Pairs y Beat the clock) · #/techcases y #/techcase/<id> (casos propios y los 3 de ejemplo de data/tech/cases.json)
     · #/techstories y #/techstory/<id> (historias STAR y las 5 guías; «new» abre una nueva, ?from=<itemId> con la
     pregunta de ese ítem de lección y ?guide=<id> con la de una guía).
   · Las dos partidas en modo foco (vocabTech.focus.register): pairs (#/techl/pairs: 6 parejas de los match de las
     unidades estudiadas, o de todas) y clock (#/techl/clock: 60 s de verdadero o falso de los tf). Su mejor marca en
     best/pairs {score: ms, mistakes} (menos es mejor) y best/clock {score: aciertos, answered}; act.log al acabar.
   · vocabTech.cases = {load(), data(), get(id), list(), models(), questions(caseId), FIELDS, STAR}: questions da las
     preguntas del entrevistador para la práctica de casos de js/tech-lesson.js (las del caso modelo o, para un caso
     propio, las 10 generales con su «A strong answer covers»).
   Nada de botón de guardar: un caso o una historia se guarda sola al escribir (case/<id>, story/<id> de tech:data con
   vocabTech.put; una nueva no se guarda hasta que se escribe algo). Nunca toca la partida del niño, ni sus monedas,
   ni sus partidas, ni emite sus eventos; todo el texto de la pantalla, en inglés británico. */
(() => {
"use strict";
const W = window, D = document;
const T = W.vocabTech; if(!T || !T.loaded) return;
const ui = T.ui, fmt = T.fmt;
const DAY = 864e5, PAIRS_N = 6, CLOCK_MS = 60e3, FEED_MS = 600, SAVE_MS = 400;
const WC_MIN = 120, WC_MAX = 200;
const app = () => D.getElementById("app");
const haptic = k => { try{ if(W.G && typeof G.haptic === "function") G.haptic(k); }catch(e){} };
const toast = (t, icon) => { try{ if(W.M && typeof M.toast === "function") M.toast(t, icon ? {icon} : {}); }catch(e){} };
const rm = () => { try{ return W.M && typeof M.rm === "function" ? !!M.rm() : matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const str = v => typeof v === "string" ? v : "";
const plural = fmt.plural;
const norm = s => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s ]+/g, " ").trim();
const shuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const words = s => String(s == null ? "" : s).trim().split(/\s+/).filter(w => /[A-Za-z0-9À-ɏ]/.test(w)).length;
const mmss = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const longDate = s => { const n = T.strDay(s); return n == null ? "" : new Date(n * DAY).toLocaleDateString("en-GB", {day: "numeric", month: "long", year: "numeric", timeZone: "UTC"}); };
const host = u => { try{ return new URL(u).hostname.replace(/^www\./, ""); }catch(e){ return ""; } };
const chev = () => ico("caret-right", "bold", 16, "tp-chev");
const KIND = {concepts: "Concepts", practice: "Practice", interview: "Interview", stories: "Stories"};
const KIND_IC = {concepts: "book-open", practice: "target", interview: "chats-circle", stories: "chat-circle-text"};
const openSheet = (d, from) => { try{ if(W.M && typeof M.openSheet === "function") M.openSheet(d, {from: from && from.nodeType === 1 ? from : null}); else d.showModal(); }catch(e){ try{ d.showModal(); }catch(e2){ d.setAttribute("open", ""); } } };
const closeSheet = d => { if(!d || !d.open) return; try{ if(W.M && typeof M.closeSheet === "function" && d.classList.contains("m-sheet")) M.closeSheet(d); else d.close(); }catch(e){ try{ d.close(); }catch(e2){} } };

/* las unidades disponibles ya cargadas (en el orden del camino) */
let US = [];
const unitById = id => US.find(u => u.id === id) || null;
const idxUnit = id => T.pathUnits().find(u => u.id === id) || null;

/* una lección a medias (js/tech-lesson.js la guarda en tech:ls y, 72 h, en tech:lsdraft): «Continue» */
function lsSaved(id){
  try{ const v = JSON.parse(sessionStorage.getItem("tech:ls")); if(v && v.id === id) return true; }catch(e){}
  try{ const d = JSON.parse(localStorage.getItem("tech:lsdraft")); if(d && typeof d.t === "number" && Date.now() - d.t < 72 * 36e5 && d.v && d.v.id === id) return true; }catch(e){}
  return false;
}

/* ---------- data/tech/cases.json ---------- */
const FIELDS = Object.freeze([
  {k: "context", t: "Context and problem", hint: "Who has the problem, how big it is, and what happens today."},
  {k: "requirements", t: "Requirements and constraints", hint: "What must be true: volumes, delays, security, budget, deadlines."},
  {k: "options", t: "Options considered", hint: "Two or three real options, including keeping things as they are."},
  {k: "decision", t: "Decision and why", hint: "What you chose and the main reasons, in plain words."},
  {k: "tradeoffs", t: "Trade-offs, risks and mitigations", hint: "What you gave up, what could go wrong, and how you reduce it."},
  {k: "outcome", t: "Outcome and metrics", hint: "What changed, with numbers if you have them."},
].map(Object.freeze));
const STAR = Object.freeze([
  {k: "situation", t: "Situation", hint: "Where and when: the team, the system and the problem, in two or three sentences."},
  {k: "task", t: "Task", hint: "What you had to achieve, and why it was yours to do."},
  {k: "action", t: "Action", hint: "What you did, step by step. Say “I”, not “we”."},
  {k: "result", t: "Result", hint: "What changed, with numbers if you have them."},
  {k: "lessons", t: "Lessons learned", hint: "What you learned, or what you would do differently next time."},
].map(Object.freeze));
const FK = FIELDS.map(f => f.k), SK = STAR.map(f => f.k);
const cleanFields = (o, keys) => Object.fromEntries(keys.map(k => [k, isObj(o) && typeof o[k] === "string" ? o[k] : ""]));
let CD = null, pCD = null;
function casesLoad(){
  if(CD) return Promise.resolve(CD);
  if(!pCD) pCD = fetch("data/tech/cases.json")
    .then(r => { if(!r.ok) throw new Error(`Couldn't load the cases (${r.status}).`); return r.json(); },
      () => { throw new Error("Couldn't load the cases. Check the connection and try again."); })
    .then(d => {
      if(!d || d.format !== 1 || !Array.isArray(d.cases) || !Array.isArray(d.generic) || !Array.isArray(d.guides)) throw new Error("The cases file is damaged.");
      CD = d; return d;
    })
    .catch(e => { pCD = null; throw e; });
  return pCD;
}
const modelOf = id => (CD && CD.cases.find(c => c.id === id)) || null;
const guideOf = id => (CD && CD.guides.find(g => g.id === id)) || null;
/* los casos y las historias nuevas que aún no tienen nada escrito: solo en esta sesión (sessionStorage tech:new) */
const NEWK = "tech:new";
const NEW = (() => { try{ const o = JSON.parse(sessionStorage.getItem(NEWK)); return isObj(o) ? o : {}; }catch(e){ return {}; } })();
const saveNew = () => { try{ if(Object.keys(NEW).length) sessionStorage.setItem(NEWK, JSON.stringify(NEW)); else sessionStorage.removeItem(NEWK); }catch(e){} };
const newId = () => "my-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isNew = (kind, id) => !!(NEW[id] && NEW[id].kind === kind);
function caseGet(id){
  const m = modelOf(id);
  if(m) return {id: m.id, title: m.title, summary: str(m.summary), fields: cleanFields(m.fields, FK), model: true,
    sources: (m.sources || []).map(s => Object.assign({}, s)), notes: (m.notes || []).slice(), questions: (m.questions || []).length, from: null, at: null};
  const r = T.get("case", id) || (isNew("case", id) ? {} : null);
  if(!r) return null;
  return {id, title: str(r.title), summary: "", fields: cleanFields(r.fields, FK), model: false, sources: [], notes: [], from: str(r.from) || null, at: r.at || null};
}
const caseFill = c => FK.filter(k => str(c.fields && c.fields[k]).trim()).length;
/* las preguntas del entrevistador de un caso, como ítems «explain» (para la práctica de casos de js/tech-lesson.js) */
async function questions(caseId){
  const d = await casesLoad();
  const m = d.cases.find(c => c.id === caseId);
  if(m) return (m.questions || []).map(q => {
    const s = (m.sources || []).find(x => x.id === q.src) || null;
    return {id: q.id, type: "explain", q: q.q, seconds: +q.seconds || 120, model: q.model, keypoints: (q.keypoints || []).map(k => ({text: k.text, kw: (k.kw || []).slice()})),
      covers: [], src: q.src || null, source: s ? {title: s.title, url: s.url, official: !!s.official} : null, caseId, own: false};
  });
  if(T.get("case", caseId) || isNew("case", caseId)) return d.generic.map(g => ({id: g.id, type: "explain", q: g.q, seconds: +g.seconds || 120, model: null,
    keypoints: [], covers: (g.covers || []).slice(), src: null, source: null, caseId, own: true}));
  throw new Error(`No case ${caseId}.`);
}

/* ---------- pintar una página ---------- */
let CUR = null;   /* la página pintada: {hp, paint} (para repintar en su sitio cuando cambian los datos) */
async function show(o, paint){
  T.css(); css();
  const hp = hashPath(), a = app(); if(!a) return;
  try{ await Promise.all([T.units().then(u => { US = u; }), o.cases ? casesLoad() : null]); }
  catch(e){
    if(hashPath() !== hp) return;
    CUR = null;
    a.innerHTML = `<div class="tp-page">${ui.empty({icon: "wifi-slash", title: "Couldn't load Tech Prep", sub: e.message})}
      <div class="tp-list">${ui.row({icon: "arrows-clockwise", t: "Try again", id: "tp-retry"})}</div></div>`;
    const b = D.getElementById("tp-retry"); if(b) b.onclick = () => route();
    return;
  }
  if(hashPath() !== hp) return;
  CUR = {hp, paint};
  paint(a);
}
function repaint(){
  if(!CUR || CUR.hp !== hashPath()) return;
  const a = app(); if(!a) return;
  const y = scrollY, f = D.activeElement && D.activeElement.id;
  CUR.paint(a);
  scrollTo(0, y);
  const el = f && D.getElementById(f); if(el) try{ el.focus({preventScroll: true}); }catch(e){}
}
const notFound = (title, sub, href, btn) => `<div class="tp-page">${ui.empty({icon: "warning-circle", title, sub, href, btn})}</div>`;
const srcRows = list => `<ul class="tp-list tp-srcs" role="list">${(list || []).filter(s => /^https:\/\//.test(s.url)).map(s =>
  `<li><a class="tp-row tp-row-noic tp-srow" href="${esc(s.url)}" target="_blank" rel="noopener" data-no-gate><span class="tp-rt">${esc(s.title)}<small>${esc(host(s.url))}</small></span>${s.official ? ui.badge("Official", "pri") : ""}${ico("arrow-square-out", "bold", 16, "tp-chev")}<span class="vh"> (opens in a new tab)</span></a></li>`).join("")}</ul>`;
const sheetSecs = u => ((u.cheatsheet && u.cheatsheet.sections) || []).map(s =>
  `<h3 class="tp-cs-h">${esc(s.h)}</h3><ul class="tp-cs-l">${(s.points || []).map(p => `<li>${esc(p)}</li>`).join("")}</ul>`).join("");
const STAR_RE = /(Situation|Task|Action|Result|Lessons learned):\s*/g;
function starParts(model){
  const s = String(model || ""), marks = [...s.matchAll(STAR_RE)];
  if(!marks.length) return [{label: "", text: s}];
  return marks.map((m, i) => ({label: m[1], text: s.slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : s.length).trim()}));
}
const starDl = model => `<dl class="tp-star">${starParts(model).map(p => `${p.label ? `<dt>${esc(p.label)}</dt>` : ""}<dd>${esc(p.text)}</dd>`).join("")}</dl>`;
/* «Show example» / «Show model answer»: data-ex con aria-controls */
function toggleEx(b){
  const box = D.getElementById(b.getAttribute("aria-controls")); if(!box) return;
  const open = b.getAttribute("aria-expanded") !== "true";
  b.setAttribute("aria-expanded", String(open)); box.hidden = !open;
  const t = b.querySelector("span"); if(t && b.dataset.on && b.dataset.off) t.textContent = open ? b.dataset.on : b.dataset.off;
}
const exBtn = (id, off, on) => `<button type="button" class="tp-more" aria-expanded="false" aria-controls="${esc(id)}" data-ex data-off="${esc(off)}" data-on="${esc(on)}">${ico("caret-down", "bold", 16, "tp-more-ic")}<span>${esc(off)}</span></button>`;

/* ---------- Path (#/techpath, §10.2) ---------- */
function unitSub(st){
  if(!st.done) return "Not started";
  return st.done >= st.total ? `All ${st.total} lessons done` : `${st.done} of ${st.total} lessons done`;
}
function pathHtml(){
  const all = T.pathUnits(), nx = T.progress.nextLesson(), ms = {};
  for(const m of T.medals()) ms[m.id] = m;
  const runs = [];
  for(const u of all){ const r = runs[runs.length - 1]; if(r && r.block === u.block) r.units.push(u); else runs.push({block: u.block, units: [u]}); }
  return `<div class="tp-page tp-path" id="tp-path">${runs.map((r, i) => {
    const b = T.blockOf(r.block) || {id: r.block, title: r.block}, m = ms[b.id], av = r.units.some(u => u.available);
    let head;
    if(av){
      const pct = T.readiness(b.id), got = !!(m && m.got);
      head = `<div class="tp-bhead">${ui.ring(pct, {size: 40, cls: got ? "done" : ""})}
        <div class="tp-bh-t"><h2 class="tp-bh" id="tp-bk-${i}">${esc(b.title)}${got ? `${ico("medal", "fill", 20, "tp-medal")}<span class="vh">, medal earned</span>` : ""}</h2>
        <p class="tp-bh-s">${esc(`${pct}% interview ready${m ? " · " + m.sub : ""}`)}</p></div>
        <a class="glass-btn glass-btn--sm tp-bh-cs" href="#/techsheet/${esc(b.id)}" aria-label="${esc(b.title)} cheat sheet">${ico("notebook", "bold", 18)}Cheat sheet</a></div>`;
    } else head = `<div class="tp-bhead"><div class="tp-bh-t"><h2 class="tp-bh" id="tp-bk-${i}">${esc(b.title)}</h2><p class="tp-bh-s">Coming soon</p></div></div>`;
    const rows = r.units.map(u => {
      if(!u.available) return `<div class="tp-row tp-urow tp-soon" data-unit="${esc(u.id)}"><span class="tp-num" aria-hidden="true">${u.n}</span>
        <span class="tp-rt"><span class="vh">Unit ${u.n}: </span>${esc(u.title)}<small>Coming soon</small></span></div>`;
      const st = T.progress.unitStatus(u.id), next = !!(nx && nx.unit && nx.unit.id === u.id);
      const cls = `tp-row tp-urow${next ? " tp-next" : ""}${st.done >= st.total ? " tp-udone" : ""}`;
      return `<a class="${cls}" href="#/techunit/${esc(u.id)}" data-unit="${esc(u.id)}"><span class="tp-num" aria-hidden="true">${u.n}</span>
        <span class="tp-rt"><span class="vh">Unit ${u.n}: </span>${esc(u.title)}<small>${esc(unitSub(st))}</small></span>${next ? ui.badge("Next", "pri") : ""}<span aria-hidden="true">${ui.dots(u.id)}</span>${chev()}</a>`;
    }).join("");
    return `<section class="tp-list tp-blk" aria-labelledby="tp-bk-${i}" data-block="${esc(b.id)}">${head}${rows}</section>`;
  }).join("")}</div>`;
}
ROUTES.techpath = () => show({}, a => { a.innerHTML = pathHtml(); });
ROUTES.techpath.load = () => T.units();

/* ---------- una unidad (#/techunit/<uNN>, §10.3) ---------- */
function unitHtml(u){
  const b = T.blockOf(u.block) || {id: u.block, title: u.block};
  const st = T.progress.unitStatus(u.id), pct = T.unitReadiness(u.id), next = st.lessons.find(l => !l.done);
  const cta = next ? `<a class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block tp-go" id="tp-u-go" href="#/techl/lesson/${esc(next.id)}" data-key="enter">${ico("play", "fill", 20)}${lsSaved(next.id) ? "Continue" : "Start"} lesson ${next.n}</a>`
    : `<p class="tp-alldone">${ico("check-circle", "fill", 20, "tp-ok")}<span>All lessons done. Repeat any of them below.</span></p>`;
  const lessons = st.lessons.map((l, i) => {
    const L = u.lessons[i] || {items: [], title: "", kind: ""}, n = L.items.length, saved = !l.done && lsSaved(l.id);
    const sub = [KIND[L.kind] || "Lesson", plural(n, "item", "items"), l.done ? `Best ${l.best} of ${l.total || n}` : saved ? "In progress" : ""].filter(Boolean).join(" · ");
    return `<a class="tp-row tp-lrow" href="#/techl/lesson/${esc(l.id)}" id="tp-l-${esc(l.id)}" data-lesson="${esc(l.id)}">
      <span class="tp-ric${l.done ? " tp-ric-ok" : ""}" aria-hidden="true">${ico(l.done ? "check" : KIND_IC[L.kind] || "book-open", "bold", 18)}</span>
      <span class="tp-rt">Lesson ${l.n} · ${esc(L.title)}<small>${esc(sub)}${l.done ? '<span class="vh"> · done</span>' : ""}</small></span>
      <span class="tp-pill">${l.done ? "Repeat" : saved ? "Continue" : "Start"}</span>${chev()}</a>`;
  }).join("");
  const terms = (u.terms || []).map(t => `<div class="tp-tm" id="tp-t-${esc(t.id)}" data-term="${esc(t.id)}">${ui.term(t)}
      <div class="tp-tm-f">${t.example ? exBtn("tp-x-" + t.id, "Show example", "Hide example") : ""}${ui.src(u, t.src)}</div>
      ${t.example ? `<div class="tp-ex" id="tp-x-${esc(t.id)}" hidden>${ui.quote(t.example)}</div>` : ""}</div>`).join("");
  const notes = (u.versionNotes || []).filter(Boolean);
  return `<div class="tp-page tp-unit" id="tp-unit" data-unit="${esc(u.id)}">
    <header class="card tp-card tp-uhead">
      <p class="tp-eyebrow">Unit ${u.n} · ${esc(b.title)}</p>
      <h1 class="tp-title tp-h1">${esc(u.title)}</h1>
      ${u.summary ? `<p class="tp-sub tp-sum">${esc(u.summary)}</p>` : ""}
      <p class="tp-rdy">${ui.ring(pct, {size: 32, cls: st.done >= st.total ? "done" : ""})}<span>${pct}% interview ready · ${esc(unitSub(st))}</span></p>
      ${cta}
    </header>
    <section aria-labelledby="tp-u-ls"><h2 class="tp-h2" id="tp-u-ls">Lessons</h2><div class="tp-list">${lessons}</div></section>
    <section aria-labelledby="tp-u-kt"><h2 class="tp-h2" id="tp-u-kt">Key terms</h2><div class="tp-list tp-terms">${terms}</div></section>
    <section aria-labelledby="tp-u-cs"><h2 class="tp-h2" id="tp-u-cs">Cheat sheet</h2><div class="card tp-card tp-cs">${sheetSecs(u)}</div>
      <div class="tp-list tp-after">${ui.row({href: "#/techsheet/" + b.id, icon: "notebook", t: `${b.title} cheat sheet`, sub: "Every unit of the block, with the interview answers", id: "tp-u-sheet"})}</div></section>
    <section aria-labelledby="tp-u-src"><h2 class="tp-h2" id="tp-u-src">Sources</h2>${srcRows(u.sources)}</section>
    <div class="tp-foot">${u.reviewed ? `<p>Facts checked on ${esc(longDate(u.reviewed))}.</p>` : ""}
      ${notes.length ? `<h2 class="tp-foot-h">Version notes</h2><ul>${notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}</div>
  </div>`;
}
function wireEx(root){
  root.addEventListener("click", e => { const b = e.target.closest("[data-ex]"); if(b && root.contains(b)) toggleEx(b); });
}
ROUTES.techunit = parts => show({}, a => {
  const id = String(parts[0] || ""), iu = idxUnit(id);
  if(!iu){ a.innerHTML = notFound("No such unit", "This link doesn't match a unit of Tech Prep.", "#/techpath", "Back to Path"); return; }
  const u = unitById(id);
  if(!iu.available || !u){ a.innerHTML = notFound(`Unit ${iu.n} · ${iu.title}`, "Coming soon. This unit isn't in this version yet.", "#/techpath", "Back to Path"); return; }
  a.innerHTML = unitHtml(u);
  wireEx(D.getElementById("tp-unit"));
});
ROUTES.techunit.load = () => T.units();

/* ---------- la chuleta de un bloque (#/techsheet/<bloque>, §10.4) ---------- */
const SHEETFROM = "tech:sheetfrom";
function sheetFrom(){ try{ const o = JSON.parse(sessionStorage.getItem(SHEETFROM)); return isObj(o) ? o : null; }catch(e){ return null; } }
function backFor(h){
  const s = secOf(h || "");
  if(s === "techunit"){ const iu = idxUnit(String(h.split("/")[1] || "")); if(iu) return {h: "#/" + h, t: `Unit ${iu.n}`}; }
  if(s === "tech") return {h: "#/tech", t: "Today"};
  if(s === "techgloss") return {h: "#/techgloss", t: "Glossary"};
  return {h: "#/techpath", t: "Path"};
}
T.setBack("techsheet", p => { const f = sheetFrom(), b = String(p).split("/")[1] || ""; return backFor(f && f.b === b ? f.from : ""); });
function unitsLabel(ns){
  if(!ns.length) return "";
  if(ns.length === 1) return `Unit ${ns[0]}`;
  const run = ns.every((n, i) => !i || n === ns[i - 1] + 1);
  return run ? `Units ${ns[0]} to ${ns[ns.length - 1]}` : `Units ${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}`;
}
function sheetHtml(b){
  const iu = T.pathUnits().filter(u => u.block === b.id), us = US.filter(u => u.block === b.id);
  const ex = [], stories = [];
  for(const u of us) for(const l of u.lessons) for(const it of l.items || []){ if(it.type === "explain") ex.push({u, it}); else if(it.type === "story") stories.push({u, it}); }
  const sub = unitsLabel(us.map(u => u.n)) + (us.length < iu.length ? " · more units coming soon" : "");
  const jump = `<nav class="tp-jump" aria-label="Jump to">${us.map(u => `<button type="button" class="tp-chip" data-jump="tp-sh-${esc(u.id)}">Unit ${u.n}</button>`).join("")}${ex.length || stories.length ? `<button type="button" class="tp-chip" data-jump="tp-sh-ans">Interview answers</button>` : ""}</nav>`;
  const units = us.map(u => `<section class="card tp-card tp-cs tp-shu" id="tp-sh-${esc(u.id)}" aria-labelledby="tp-sh-h-${esc(u.id)}" tabindex="-1">
      <p class="tp-eyebrow">Unit ${u.n}</p><h2 class="tp-title tp-cs-t" id="tp-sh-h-${esc(u.id)}">${esc(u.title)}</h2>${sheetSecs(u)}
      <a class="tp-ilink" href="#/techunit/${esc(u.id)}">${ico("path", "bold", 16)}<span>Open unit ${u.n}</span></a></section>`).join("");
  const exHtml = ex.map(({u, it}) => `<article class="card tp-card tp-ans" id="tp-a-${esc(it.id)}" data-item="${esc(it.id)}" aria-labelledby="tp-aq-${esc(it.id)}">
      <p class="tp-eyebrow">Unit ${u.n} · Explain it</p>
      <div class="tp-ans-h"><h3 class="tp-ans-q" id="tp-aq-${esc(it.id)}">${esc(it.q)}</h3>${ui.say(it.model, {label: "Listen to the model answer"})}</div>
      <p class="tp-ans-m">${esc(it.model)}</p>
      ${(it.keypoints || []).length ? `<h4 class="tp-kp-h">Key points</h4><ul class="tp-kp">${it.keypoints.map(k => `<li>${esc(k.text)}</li>`).join("")}</ul>` : ""}
      ${ui.src(u, it.src)}</article>`).join("");
  const stHtml = stories.map(({u, it}) => `<article class="card tp-card tp-ans tp-ans-st" id="tp-a-${esc(it.id)}" data-item="${esc(it.id)}" aria-labelledby="tp-aq-${esc(it.id)}">
      <p class="tp-eyebrow">Unit ${u.n} · Story</p>
      <div class="tp-ans-h"><h3 class="tp-ans-q" id="tp-aq-${esc(it.id)}">${esc(it.prompt)}</h3>${ui.say(it.model, {label: "Listen to the model story"})}</div>
      ${starDl(it.model)}${ui.src(u, it.src)}</article>`).join("");
  return `<div class="tp-page tp-sheet" id="tp-sheet" data-block="${esc(b.id)}">
    <header class="card tp-card tp-shead"><p class="tp-eyebrow">Cheat sheet</p><h1 class="tp-title tp-h1">${esc(b.title)}</h1><p class="tp-sub">${esc(sub)}</p></header>
    ${jump}${units}
    ${ex.length || stories.length ? `<section class="tp-shans" id="tp-sh-ans" aria-labelledby="tp-sh-ans-h" tabindex="-1"><h2 class="tp-h2" id="tp-sh-ans-h">Interview answers</h2>
      <p class="tp-lead">Model answers to practise aloud. The key points are what an interviewer listens for.</p>${exHtml}${stHtml}</section>` : ""}
  </div>`;
}
ROUTES.techsheet = parts => {
  const bid = String(parts[0] || ""), from = typeof ROUTE_FROM === "string" ? ROUTE_FROM : "", f = sheetFrom();
  /* al recargar (no hay pantalla de antes) o con Atrás/Adelante se queda de dónde se vino la primera vez */
  const restore = typeof ROUTE_FROM !== "string" || (typeof ROUTE_RESTORE !== "undefined" && ROUTE_RESTORE);
  if(secOf(from) !== "techsheet" && !(restore && f && f.b === bid)) try{ sessionStorage.setItem(SHEETFROM, JSON.stringify({b: bid, from: secOf(from) === "techl" ? "" : from})); }catch(e){}
  return show({}, a => {
    const b = T.blockOf(bid);
    if(!b){ a.innerHTML = notFound("No such cheat sheet", "This link doesn't match a block of Tech Prep.", "#/techpath", "Back to Path"); return; }
    if(!US.some(u => u.block === b.id)){ a.innerHTML = notFound(`${b.title} cheat sheet`, "Coming soon. None of this block's units are in this version yet.", "#/techpath", "Back to Path"); return; }
    a.innerHTML = sheetHtml(b);
    const root = D.getElementById("tp-sheet");
    root.addEventListener("click", e => {
      const j = e.target.closest("[data-jump]"); if(!j) return;
      const t = D.getElementById(j.dataset.jump); if(!t) return;
      t.scrollIntoView({behavior: rm() ? "auto" : "smooth", block: "start"});
      try{ t.focus({preventScroll: true}); }catch(err){}
    });
  });
};
ROUTES.techsheet.load = () => T.units();

/* ---------- el glosario (#/techgloss, §10.5) ---------- */
let GQ = "";
/* «@RestController» va con la R y «$batch» con la B: los signos del principio no cuentan ni para ordenar ni para la letra */
const glossKey = s => norm(s).replace(/^[^a-z0-9]+/, "");
const letterOf = s => { const c = glossKey(s).charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; };
function glossHtml(){
  const all = [];
  for(const u of US) for(const t of u.terms || []) all.push({t, u, q: norm(`${t.term} ${t.say || ""} ${t.def || ""}`)});
  all.sort((a, b) => glossKey(a.t.term).localeCompare(glossKey(b.t.term), "en-GB", {sensitivity: "base", numeric: true}) || a.u.n - b.u.n);
  const groups = [];
  for(const e of all){ const L = letterOf(e.t.term), g = groups[groups.length - 1]; if(g && g.L === L) g.list.push(e); else groups.push({L, list: [e]}); }
  return `<div class="tp-page tp-gloss" id="tp-gloss">
    <div class="tp-search" role="search"><label class="vh" for="tp-g-q">Search terms</label>${ico("magnifying-glass", "bold", 20, "tp-search-ic")}
      <input type="search" id="tp-g-q" placeholder="Search terms" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-describedby="tp-g-n"></div>
    <p class="tp-gcount" id="tp-g-n" aria-live="polite">${plural(all.length, "term", "terms")}</p>
    ${groups.map(g => `<section class="tp-gsec" data-l="${esc(g.L)}" aria-labelledby="tp-gl-${esc(g.L === "#" ? "n" : g.L)}"><h2 class="tp-gl" id="tp-gl-${esc(g.L === "#" ? "n" : g.L)}">${esc(g.L)}</h2>
      <div class="tp-list">${g.list.map(e => `<div class="tp-tm tp-ge" data-q="${esc(e.q)}" data-term="${esc(e.t.id)}" data-unit="${esc(e.u.id)}">${ui.term(e.t)}
        <a class="tp-ilink" href="#/techunit/${esc(e.u.id)}">${ico("path", "bold", 16)}<span>Unit ${e.u.n} · ${esc(e.u.title)}</span></a></div>`).join("")}</div></section>`).join("")}
    <div class="card tp-card tp-empty tp-g-none" id="tp-g-none" hidden><span class="tp-empty-ic" aria-hidden="true">${ico("magnifying-glass", "bold", 28)}</span>
      <h2 class="tp-title" id="tp-g-nt">No terms match</h2><p class="tp-sub">Try a shorter word, or check the spelling.</p></div>
  </div>`;
}
function glossFilter(){
  const box = D.getElementById("tp-gloss"); if(!box) return;
  const qs = norm(GQ).split(" ").filter(Boolean); let n = 0;
  box.querySelectorAll(".tp-gsec").forEach(sec => {
    let k = 0;
    sec.querySelectorAll(".tp-ge").forEach(e => {
      const ok = qs.every(w => e.dataset.q.includes(w));
      e.hidden = !ok; e.classList.toggle("tp-first", ok && !k); if(ok) k++;
    });
    sec.hidden = !k; n += k;
  });
  const c = D.getElementById("tp-g-n"), none = D.getElementById("tp-g-none"), q = GQ.trim();
  if(c) c.textContent = !qs.length ? plural(n, "term", "terms") : n ? `${n} ${n === 1 ? "term matches" : "terms match"} “${q}”` : `No terms match “${q}”`;
  if(none){ none.hidden = !!n; const t = D.getElementById("tp-g-nt"); if(t) t.textContent = `No terms match “${q}”`; }
}
ROUTES.techgloss = () => show({}, a => {
  a.innerHTML = glossHtml();
  const inp = D.getElementById("tp-g-q");
  inp.value = GQ; glossFilter();
  let t = 0;
  inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { GQ = inp.value; glossFilter(); }, 120); });
  inp.addEventListener("keydown", e => { if(e.key === "Enter"){ clearTimeout(t); GQ = inp.value; glossFilter(); inp.blur(); } });
  inp.addEventListener("search", () => { clearTimeout(t); GQ = inp.value; glossFilter(); });
});
ROUTES.techgloss.load = () => T.units();

/* ---------- Play (#/techplay, §10.6) ---------- */
/* las unidades estudiadas: con una lección hecha o algo en el repaso */
function studied(){
  const s = new Set();
  for(const r of T.list("ls")){ const m = /^(u\d{2})-/.exec(r.id); if(m) s.add(m[1]); }
  for(const r of T.list("srs")){ const m = /^(u\d{2})-/.exec(r.id); if(m) s.add(m[1]); }
  return s;
}
const itemsOf = (us, type) => us.flatMap(u => u.lessons.flatMap(l => (l.items || []).filter(it => it.type === type).map(it => ({it, u}))));
function distinctPairs(list){
  const seen = new Set(); let n = 0;
  for(const {it} of list) for(const p of it.pairs || []){ const a = norm(p[0]), b = norm(p[1]); if(seen.has(a) || seen.has(b)) continue; seen.add(a); seen.add(b); n++; }
  return n;
}
/* de dónde sale una partida: lo estudiado si da para una ronda; si no, todas las unidades disponibles */
function pool(type){
  const st = studied(), mine = itemsOf(US.filter(u => st.has(u.id)), type);
  const enough = type === "match" ? distinctPairs(mine) >= PAIRS_N : mine.length >= 10;
  return enough ? {items: mine, studied: true} : {items: itemsOf(US, type), studied: false};
}
function playHtml(){
  const bp = T.get("best", "pairs"), bc = T.get("best", "clock"), pp = pool("match"), pc = pool("tf");
  const from = p => p.studied ? "From the units you've studied" : "From all available units";
  const card = (id, href, icon, cls, t, d, meta) => `<a class="card tp-card tp-game ${cls}" id="${id}" href="${href}">
      <span class="tp-game-ic" aria-hidden="true">${ico(icon, "bold", 30)}</span>
      <span class="tp-game-b"><h2 class="tp-game-t">${esc(t)}</h2><span class="tp-game-d">${esc(d)}</span><span class="tp-game-m">${esc(meta)}</span></span>${chev()}</a>`;
  return `<div class="tp-page tp-play" id="tp-play">
    ${card("tp-g-pairs", "#/techl/pairs", "squares-four", "pairs", "Pairs", "Match six terms with their partners, as fast as you can.",
      `${bp && +bp.score > 0 ? `Best time ${mmss(+bp.score)}` : "No best time yet"} · ${from(pp)}`)}
    ${card("tp-g-clock", "#/techl/clock", "timer", "clock", "Beat the clock", "60 seconds of true or false statements. Answer as many as you can.",
      `${bc && bc.score != null ? `Best score ${+bc.score || 0}` : "No best score yet"} · ${from(pc)}`)}
    <p class="tp-note">Best scores are saved with your Tech Prep progress.</p>
  </div>`;
}
ROUTES.techplay = () => show({}, a => { a.innerHTML = playHtml(); });
ROUTES.techplay.load = () => T.units();

/* ---------- las partidas (modo foco): lo común ---------- */
const GAME = {pairs: null, clock: null};
const live = t => { const el = D.getElementById("tp-live"); if(el){ el.textContent = ""; setTimeout(() => { el.textContent = t; }, 30); } };
const stopOpts = (kind, from) => ({from, title: "Stop this round?", sub: "This round won't be saved.",
  onStop: () => gameStop(kind), onKeep: () => gameResume(kind)});
function gameStop(kind){ const S = GAME[kind]; if(S){ clearInterval(S.tick); clearTimeout(S.wait); S.over = true; } GAME[kind] = null; }
function gamePause(kind){
  const S = GAME[kind]; if(!S || S.paused != null) return;
  clearInterval(S.tick); S.tick = 0; S.paused = Date.now();
}
function gameResume(kind){
  const S = GAME[kind]; if(!S || S.paused == null || S.over) return;
  const d = Date.now() - S.paused; S.paused = null;
  if(kind === "pairs"){ if(S.t0) S.t0 += d; pairsTick(); }
  else { S.deadline += d; clockTick(); }
}
const busy = kind => { const S = GAME[kind]; return !!(S && !S.over && (kind === "pairs" ? S.t0 > 0 : S.phase === "play")); };
function askStop(kind, from){ gamePause(kind); return T.focus.ask(stopOpts(kind, from)); }
/* Atrás del navegador (u otra ruta) a mitad de ronda: «Stop this round?» */
function guardGame(kind, hp){
  if(!busy(kind) || new RegExp(`^techl/${kind}(/|$)`).test(hp)) return false;
  gamePause(kind);
  const r = T.focus.guard(hp, stopOpts(kind));
  if(!r) gameResume(kind);
  return r;
}
D.addEventListener("visibilitychange", () => {
  for(const k of ["pairs", "clock"]){
    if(!busy(k)) continue;
    const sheet = D.getElementById("tp-stop");
    if(D.hidden) gamePause(k); else if(!(sheet && sheet.open)) gameResume(k);
  }
});
const endDock = () => `<div class="tp-dock"><a class="glass-btn glass-btn--lg" href="#/techplay" id="tp-g-back">Back to Play</a>
  <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="tp-g-again" data-key="enter">${ico("arrows-clockwise", "bold", 20)}Play again</button></div>`;

/* ---------- Pairs (#/techl/pairs) ---------- */
function pairsNew(){
  const p = pool("match"), items = shuffle(p.items.slice()), seen = new Set(), pairs = [], qs = [];
  for(const {it, u} of items){
    let used = false;
    for(const [l, r] of shuffle((it.pairs || []).slice())){
      if(pairs.length >= PAIRS_N) break;
      const a = norm(l), b = norm(r); if(!a || !b || seen.has(a) || seen.has(b)) continue;
      seen.add(a); seen.add(b); pairs.push({l, r, u, src: it.src, item: it.id}); used = true;
    }
    if(used) qs.push(it.q);
    if(pairs.length >= PAIRS_N) break;
  }
  GAME.pairs = {pairs, qs, studied: p.studied, L: shuffle(pairs.map((x, i) => i)), R: shuffle(pairs.map((x, i) => i)),
    sel: null, done: new Set(), miss: 0, t0: 0, end: 0, tick: 0, wait: 0, paused: null, over: false};
}
function pairsHtml(){
  const S = GAME.pairs, n = S.pairs.length;
  const tile = (side, i) => `<button type="button" class="tp-tile" data-s="${side}" data-i="${i}" aria-pressed="false"><span class="tp-tile-t">${esc(side === "l" ? S.pairs[i].l : S.pairs[i].r)}</span></button>`;
  return `<div class="tp-page tp-game-p tp-pairs" id="tp-pairs">
    <div class="tp-ftop"><div class="tp-pbar" id="tp-p-bar" role="progressbar" aria-label="Pairs found" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="0"><i></i></div>
      <span class="tp-timer" role="timer"><span class="vh">Time: </span><span id="tp-p-t">0:00</span></span></div>
    <h1 class="tp-gt">Pairs</h1>
    <p class="tp-sub">Tap one on the left, then its partner on the right.</p>
    ${S.qs.length ? `<ul class="tp-pq">${S.qs.map(q => `<li>${esc(q)}</li>`).join("")}</ul>` : ""}
    <div class="tp-pgrid"><div class="tp-pcol" role="group" aria-label="Left">${S.L.map(i => tile("l", i)).join("")}</div>
      <div class="tp-pcol" role="group" aria-label="Right">${S.R.map(i => tile("r", i)).join("")}</div></div>
    <p class="vh" id="tp-live" aria-live="polite"></p>
  </div>`;
}
function pairsTick(){
  const S = GAME.pairs; if(!S) return;
  clearInterval(S.tick);
  const paint = () => { const el = D.getElementById("tp-p-t"); if(el && S.t0) el.textContent = mmss((S.end || Date.now()) - S.t0); };
  paint();
  if(!S.end) S.tick = setInterval(paint, 250);
}
function pairsPaint(){
  const a = app(), S = GAME.pairs; if(!a || !S) return;
  if(S.pairs.length < 2){
    a.innerHTML = `<div class="tp-page">${ui.empty({icon: "squares-four", title: "No pairs yet", sub: "The units in this version don't have matching exercises yet.", href: "#/techplay", btn: "Back to Play"})}</div>`;
    return;
  }
  a.innerHTML = pairsHtml();
  D.getElementById("tp-pairs").addEventListener("click", e => { const b = e.target.closest(".tp-tile"); if(b) pairsTap(b); });
}
function setSel(b, on){ b.setAttribute("aria-pressed", String(on)); }
function pairsTap(b){
  const S = GAME.pairs; if(!S || S.end || b.disabled) return;
  if(!S.t0){ S.t0 = Date.now(); pairsTick(); }
  D.querySelectorAll("#tp-pairs .tp-tile.miss").forEach(x => pairsUnmiss(x));
  const sel = S.sel;
  if(!sel){ S.sel = b; setSel(b, true); haptic("selection"); return; }
  if(sel === b){ S.sel = null; setSel(b, false); return; }
  if(sel.dataset.s === b.dataset.s){ setSel(sel, false); S.sel = b; setSel(b, true); haptic("selection"); return; }
  S.sel = null; setSel(sel, false);
  const i = +sel.dataset.i, j = +b.dataset.i;
  if(i === j){
    S.done.add(i);
    for(const x of [sel, b]){ x.classList.add("ok"); x.disabled = true; x.removeAttribute("aria-pressed"); x.insertAdjacentHTML("afterbegin", ico("check", "bold", 18)); x.insertAdjacentHTML("beforeend", '<span class="vh">, matched</span>'); }
    haptic("success");
    const bar = D.getElementById("tp-p-bar"), n = S.pairs.length;
    if(bar){ bar.setAttribute("aria-valuenow", String(S.done.size)); bar.firstElementChild.style.width = `${Math.round(100 * S.done.size / n)}%`; }
    live(S.done.size < n ? `Matched. ${S.done.size} of ${n}.` : "All pairs matched.");
    if(S.done.size >= n){ S.end = Date.now(); clearInterval(S.tick); pairsTick(); S.wait = setTimeout(pairsFinish, rm() ? 250 : 500); }
  } else {
    S.miss++;
    for(const x of [sel, b]){ x.classList.add("miss"); x.insertAdjacentHTML("afterbegin", ico("x", "bold", 18)); x.insertAdjacentHTML("beforeend", '<span class="vh tp-miss-vh">, not a pair</span>'); x._mt = setTimeout(() => pairsUnmiss(x), 700); }
    live("Not a pair. Try again.");
  }
}
function pairsUnmiss(x){
  clearTimeout(x._mt); if(!x.classList.contains("miss")) return;
  x.classList.remove("miss");
  const ic = x.querySelector(":scope > .ico"); if(ic) ic.remove();
  const v = x.querySelector(".tp-miss-vh"); if(v) v.remove();
}
function pairsFinish(){
  const S = GAME.pairs; if(!S || S.over) return;
  S.over = true;
  const ms = S.end - S.t0, old = T.get("best", "pairs"), had = !!(old && +old.score > 0), better = !had || ms < +old.score;
  if(better) T.put("best", "pairs", {score: ms, mistakes: S.miss});
  T.act.log(S.pairs.length);
  if(better && had) haptic("success");
  const a = app(); if(!a) return;
  a.innerHTML = `<div class="tp-page tp-game-p tp-gend" id="tp-pend">
    <section class="card tp-card tp-res" aria-labelledby="tp-res-t"><span class="tp-res-ic" aria-hidden="true">${ico(better && had ? "trophy" : "check-circle", "bold", 32)}</span>
      <h1 class="tp-title" id="tp-res-t">${better && had ? "New best time" : "Round complete"}</h1>
      <p class="tp-res-n" id="tp-res-n">${mmss(ms)}</p>
      <p class="tp-sub">${esc(`${S.miss ? plural(S.miss, "mistake", "mistakes") : "No mistakes"} · ${!had ? "Your first round" : better ? `Previous best ${mmss(+old.score)}` : `Best time ${mmss(+old.score)}`}`)}</p></section>
    <section aria-labelledby="tp-pr-h"><h2 class="tp-h2" id="tp-pr-h">The pairs</h2>
      <ul class="tp-list tp-plist" role="list">${S.pairs.map(p => `<li class="tp-pli"><span class="tp-pl">${esc(p.l)}</span><span class="tp-pr">${esc(p.r)}</span><span class="tp-pu">Unit ${p.u.n}${ui.src(p.u, p.src)}</span></li>`).join("")}</ul></section>
    ${endDock()}
  </div>`;
  wireEnd("pairs");
}
function wireEnd(kind){
  /* el resultado se ve desde arriba (la ronda pudo acabar con la página bajada) y el lector de pantalla empieza por él */
  scrollTo(0, 0);
  const h = D.getElementById("tp-res-t"); if(h){ h.tabIndex = -1; try{ h.focus({preventScroll: true}); }catch(e){} }
  const b = D.getElementById("tp-g-again");
  if(b) b.addEventListener("click", () => { gameStop(kind); if(kind === "pairs"){ pairsNew(); pairsPaint(); } else { clockNew(); clockStart(); } scrollTo(0, 0); });
}
T.focus.register("pairs", {
  title: "Pairs",
  load: () => T.units(),
  render: async () => {
    T.css(); css();
    const hp = hashPath();
    try{ US = await T.units(); }catch(e){ if(hashPath() === hp){ const a = app(); if(a) a.innerHTML = `<div class="tp-page">${ui.empty({icon: "wifi-slash", title: "Couldn't load Tech Prep", sub: e.message, href: "#/techplay", btn: "Back to Play"})}</div>`; } return; }
    if(hashPath() !== hp) return;
    gameStop("pairs"); pairsNew(); pairsPaint();
  },
  exit: from => busy("pairs") ? askStop("pairs", from) : false,
  blocks: hp => guardGame("pairs", hp),
});

/* ---------- Beat the clock (#/techl/clock) ---------- */
function clockNew(){
  const p = pool("tf");
  GAME.clock = {phase: "intro", pool: shuffle(p.items.slice()), studied: p.studied, k: -1, cur: null, right: 0, wrong: [], answered: 0,
    deadline: 0, tick: 0, wait: 0, paused: null, lock: false, over: false, late: false};
}
function clockIntro(){
  const a = app(), S = GAME.clock; if(!a || !S) return;
  if(!S.pool.length){ a.innerHTML = `<div class="tp-page">${ui.empty({icon: "timer", title: "No statements yet", sub: "The units in this version don't have true or false statements yet.", href: "#/techplay", btn: "Back to Play"})}</div>`; return; }
  const b = T.get("best", "clock");
  a.innerHTML = `<div class="tp-page tp-game-p tp-clock" id="tp-clock">
    <section class="card tp-card tp-res tp-cintro" aria-labelledby="tp-c-h"><span class="tp-res-ic" aria-hidden="true">${ico("timer", "bold", 32)}</span>
      <h1 class="tp-title" id="tp-c-h">Beat the clock</h1>
      <p class="tp-sub">You have 60 seconds. Decide whether each statement is true or false, and answer as many as you can.</p>
      <p class="tp-game-m">${esc(`${b && b.score != null ? `Best score ${+b.score || 0}` : "No best score yet"} · ${S.studied ? "From the units you've studied" : "From all available units"}`)}</p>
      <p class="tp-cho">${ico("hand-pointing", "bold", 18)}<span>Tap False or True. You can also swipe the card, or use the arrow keys.</span></p></section>
    <div class="tp-dock"><button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="tp-c-go" data-key="enter">${ico("play", "fill", 20)}Start</button></div>
  </div>`;
  D.getElementById("tp-c-go").addEventListener("click", clockStart);
}
function clockStart(){
  const a = app(), S = GAME.clock; if(!a || !S) return;
  S.phase = "play"; S.deadline = Date.now() + CLOCK_MS;
  a.innerHTML = `<div class="tp-page tp-game-p tp-clock" id="tp-clock">
    <div class="tp-ftop"><div class="tp-pbar tp-cbar" id="tp-c-bar" role="progressbar" aria-label="Time left" aria-valuemin="0" aria-valuemax="60" aria-valuenow="60"><i style="width:100%"></i></div>
      <span class="tp-timer" role="timer"><span class="vh">Time left: </span><span id="tp-c-t">1:00</span></span></div>
    <p class="tp-cscore" id="tp-c-sc">0 right</p>
    <section class="card tp-card tp-stmt" id="tp-c-card" aria-labelledby="tp-c-q">
      <p class="tp-eyebrow" id="tp-c-n">Statement 1</p>
      <p class="tp-stmt-t" id="tp-c-q"></p>
      <p class="tp-fb" id="tp-c-fb" aria-live="polite"></p>
    </section>
    <div class="tp-dock tp-cdock"><button type="button" class="glass-btn glass-btn--lg tp-c-no" id="tp-c-no" data-key="left">${ico("x", "bold", 20)}False</button>
      <button type="button" class="glass-btn glass-btn--lg tp-c-yes" id="tp-c-yes" data-key="right">${ico("check", "bold", 20)}True</button></div>
  </div>`;
  D.getElementById("tp-c-no").addEventListener("click", () => clockAnswer(false));
  D.getElementById("tp-c-yes").addEventListener("click", () => clockAnswer(true));
  const card = D.getElementById("tp-c-card");
  if(W.G && typeof G.swipe === "function"){
    const reset = () => { card.style.translate = ""; };
    G.swipe(card, {onMove: ({dx}) => { card.style.translate = `${Math.round(dx)}px 0`; }, onLeft: () => { reset(); clockAnswer(false); }, onRight: () => { reset(); clockAnswer(true); }, onCancel: reset});
  }
  clockNext(); clockTick();
}
function clockNext(){
  const S = GAME.clock; if(!S) return;
  S.k++;
  if(S.k >= S.pool.length){ const last = S.cur; S.pool = shuffle(S.pool.slice()); if(S.pool.length > 1 && S.pool[0] === last) S.pool.push(S.pool.shift()); S.k = 0; }
  S.cur = S.pool[S.k];
  const q = D.getElementById("tp-c-q"), n = D.getElementById("tp-c-n"), fb = D.getElementById("tp-c-fb"), card = D.getElementById("tp-c-card");
  if(q) q.textContent = S.cur.it.statement;
  if(n) n.textContent = `Statement ${S.answered + 1}`;
  if(fb){ fb.className = "tp-fb"; fb.innerHTML = ""; }
  if(card) card.classList.remove("ok", "miss");
}
function clockTick(){
  const S = GAME.clock; if(!S || S.phase !== "play") return;
  clearInterval(S.tick);
  const paint = () => {
    const left = Math.max(0, S.deadline - Date.now()), t = D.getElementById("tp-c-t"), bar = D.getElementById("tp-c-bar");
    if(t) t.textContent = mmss(Math.ceil(left / 1000) * 1000);
    if(bar){ bar.setAttribute("aria-valuenow", String(Math.ceil(left / 1000))); bar.firstElementChild.style.width = `${(100 * left / CLOCK_MS).toFixed(2)}%`; }
    if(left <= 0){ clearInterval(S.tick); S.tick = 0; if(S.lock) S.late = true; else clockEnd(); }
  };
  paint();
  if(S.phase === "play" && !S.over) S.tick = setInterval(paint, 200);
}
function clockAnswer(v){
  const S = GAME.clock; if(!S || S.phase !== "play" || S.lock || S.paused != null || !S.cur) return;
  if(Date.now() >= S.deadline){ clockEnd(); return; }
  const it = S.cur.it, ok = !!it.answer === v;
  S.answered++; S.lock = true;
  if(ok) S.right++; else S.wrong.push(S.cur);
  const fb = D.getElementById("tp-c-fb"), card = D.getElementById("tp-c-card"), sc = D.getElementById("tp-c-sc");
  if(card) card.classList.add(ok ? "ok" : "miss");
  if(fb){ fb.className = "tp-fb " + (ok ? "ok" : "miss"); fb.innerHTML = `${ico(ok ? "check" : "x", "bold", 20)}<span>${ok ? "Right" : it.answer ? "Not quite: it's true" : "Not quite: it's false"}</span>`; }
  if(sc) sc.textContent = `${S.right} right`;
  haptic(ok ? "success" : "selection");
  S.wait = setTimeout(() => {
    S.lock = false;
    if(!GAME.clock || GAME.clock !== S || S.over) return;
    if(S.late || Date.now() >= S.deadline) clockEnd(); else clockNext();
  }, rm() ? 450 : FEED_MS);
}
function clockEnd(){
  const S = GAME.clock; if(!S || S.over || S.phase !== "play") return;
  S.over = true; S.phase = "end"; clearInterval(S.tick); clearTimeout(S.wait);
  const old = T.get("best", "clock"), had = !!(old && old.score != null), better = !had || S.right > (+old.score || 0);
  if(better) T.put("best", "clock", {score: S.right, answered: S.answered});
  if(S.answered) T.act.log(S.answered);
  if(better && had) haptic("success");
  const seen = new Set(), misses = S.wrong.filter(x => !seen.has(x.it.id) && seen.add(x.it.id));
  const a = app(); if(!a) return;
  a.innerHTML = `<div class="tp-page tp-game-p tp-gend" id="tp-cend">
    <section class="card tp-card tp-res" aria-labelledby="tp-res-t"><span class="tp-res-ic" aria-hidden="true">${ico(better && had ? "trophy" : "timer", "bold", 32)}</span>
      <h1 class="tp-title" id="tp-res-t">${better && had ? "New best score" : "Time's up"}</h1>
      <p class="tp-res-n" id="tp-res-n">${S.right}<span class="tp-res-u"> right</span></p>
      <p class="tp-sub">${esc(`${S.wrong.length} wrong · ${!had ? "Your first round" : better ? `Previous best ${+old.score || 0}` : `Best score ${+old.score || 0}`}`)}</p></section>
    ${misses.length ? `<section aria-labelledby="tp-mi-h"><h2 class="tp-h2" id="tp-mi-h">To look at again</h2>
      <ul class="tp-list tp-misses" role="list">${misses.map(({it, u}) => `<li class="tp-mi" data-item="${esc(it.id)}"><p class="tp-mi-s">${ico("x", "bold", 18, "tp-mi-ic")}<span>${esc(it.statement)}</span></p>
        <p class="tp-mi-w"><b>${it.answer ? "It's true." : "It's false."}</b> ${esc(it.why || "")}</p><p class="tp-mi-f"><span>Unit ${u.n} · ${esc(u.title)}</span>${ui.src(u, it.src)}</p></li>`).join("")}</ul></section>`
      : S.answered ? `<p class="tp-lead tp-nomiss">${ico("check-circle", "fill", 20, "tp-ok")}<span>No mistakes this round.</span></p>` : ""}
    ${endDock()}
  </div>`;
  wireEnd("clock");
}
T.focus.register("clock", {
  title: "Beat the clock",
  load: () => T.units(),
  render: async () => {
    T.css(); css();
    const hp = hashPath();
    try{ US = await T.units(); }catch(e){ if(hashPath() === hp){ const a = app(); if(a) a.innerHTML = `<div class="tp-page">${ui.empty({icon: "wifi-slash", title: "Couldn't load Tech Prep", sub: e.message, href: "#/techplay", btn: "Back to Play"})}</div>`; } return; }
    if(hashPath() !== hp) return;
    gameStop("clock"); clockNew(); clockIntro();
  },
  exit: from => busy("clock") ? askStop("clock", from) : false,
  blocks: hp => guardGame("clock", hp),
});

/* ---------- el editor (casos y historias): se guarda solo ---------- */
let ED = null;   /* {kind, id, rec, t (temporizador), dirty, at} */
const grow = ta => { if(!ta || !ta.isConnected) return; ta.style.height = "auto"; ta.style.height = `${Math.max(ta.scrollHeight + 2, ta.tagName === "TEXTAREA" && ta.dataset.min ? +ta.dataset.min : 0)}px`; };
function edSave(){
  if(!ED || !ED.dirty) return;
  clearTimeout(ED.t); ED.t = 0;
  const r = Object.assign({}, ED.rec, {fields: Object.assign({}, ED.rec.fields)}); delete r.at; delete r.id; delete r.del;
  const out = T.put(ED.kind, ED.id, r);
  ED.at = out.at; ED.dirty = false;
  if(NEW[ED.id]){ delete NEW[ED.id]; saveNew(); }
  const s = D.getElementById("tp-sv"); if(s) s.innerHTML = `${ico("check-circle", "bold", 16)}<span>Saved on this device</span>`;
}
function edInput(el){
  if(!ED) return;
  const k = el.dataset.k; if(!k) return;
  if(k.startsWith("f.")) ED.rec.fields[k.slice(2)] = el.value; else ED.rec[k] = el.value;
  ED.dirty = true; clearTimeout(ED.t); ED.t = setTimeout(edSave, SAVE_MS);
  const s = D.getElementById("tp-sv"); if(s) s.innerHTML = `${ico("pencil-simple", "bold", 16)}<span>Saving…</span>`;
  if(el.tagName === "TEXTAREA") grow(el);
  if(ED.kind === "story") paintWc();
}
addEventListener("hashchange", () => edSave());
addEventListener("pagehide", () => edSave());
D.addEventListener("visibilitychange", () => { if(D.hidden) edSave(); });
const storyText = rec => SK.map(k => str(rec.fields && rec.fields[k]).trim()).filter(Boolean).join(" ");
function paintWc(){
  if(!ED || ED.kind !== "story") return;
  const n = words(storyText(ED.rec)), t = D.getElementById("tp-wc"), bar = D.getElementById("tp-wc-bar");
  if(t) t.textContent = n < WC_MIN ? `${plural(n, "word", "words")} · aim for ${WC_MIN} to ${WC_MAX}` : n <= WC_MAX ? `${plural(n, "word", "words")} · within the ${WC_MIN} to ${WC_MAX} target` : `${plural(n, "word", "words")} · try to cut it to ${WC_MAX}`;
  if(bar){ bar.style.width = `${Math.min(100, 100 * n / 240).toFixed(1)}%`; bar.parentElement.classList.toggle("in", n >= WC_MIN && n <= WC_MAX); }
}
function wireEditor(root){
  root.addEventListener("input", e => { const el = e.target.closest("[data-k]"); if(el) edInput(el); });
  root.addEventListener("keydown", e => {
    if(e.key !== "Enter" || e.target.tagName !== "INPUT" || e.isComposing) return;
    e.preventDefault();
    const all = [...root.querySelectorAll("[data-k]")], i = all.indexOf(e.target);
    if(i >= 0 && all[i + 1]) all[i + 1].focus();
  });
  root.querySelectorAll("textarea[data-k]").forEach(grow);
  requestAnimationFrame(() => root.querySelectorAll("textarea[data-k]").forEach(grow));
}
let growT = 0;
addEventListener("resize", () => { clearTimeout(growT); growT = setTimeout(() => D.querySelectorAll(".tp-edit textarea[data-k]").forEach(grow), 150); });
/* otro aparato cambió (o borró) lo que se está editando */
function edRemote(){
  if(!ED) return;
  const r = T.get(ED.kind, ED.id);
  if(!r){ if(ED.at && !isNew(ED.kind, ED.id)){ const s = D.getElementById("tp-sv"); if(s) s.innerHTML = `${ico("info", "bold", 16)}<span>Deleted on another device. Type to keep it here.</span>`; ED.at = null; } return; }
  if(r.at === ED.at || ED.dirty) return;
  ED.at = r.at;
  const keys = ED.kind === "case" ? FK : SK;
  ED.rec = Object.assign({}, r, {fields: cleanFields(r.fields, keys)});
  D.querySelectorAll(".tp-edit [data-k]").forEach(el => {
    if(el === D.activeElement) return;
    const k = el.dataset.k, v = k.startsWith("f.") ? ED.rec.fields[k.slice(2)] : str(ED.rec[k]);
    if(el.value !== v){ el.value = v; if(el.tagName === "TEXTAREA") grow(el); }
  });
  if(ED.kind === "story") paintWc();
}
/* borrar (con su hoja de confirmar) */
let DEL = null;
function confirmDelete(kind, id, title, from){
  if(!DEL){
    DEL = D.createElement("dialog"); DEL.id = "tp-del"; DEL.className = "tp-sheet"; DEL.lang = "en-GB"; DEL.setAttribute("aria-labelledby", "tp-del-t");
    DEL.dataset.noRenew = ""; DEL.dataset.noHint = "";
    D.body.appendChild(DEL);
    DEL.addEventListener("click", e => {
      if(e.target.closest("#tp-del-no")) return closeSheet(DEL);
      if(!e.target.closest("#tp-del-yes")) return;
      const o = DEL._o; DEL._o = null;
      try{ DEL.close(); }catch(err){}
      if(o) o();
    });
  }
  const what = kind === "case" ? "case" : "story";
  DEL._o = () => {
    if(ED && ED.id === id){ clearTimeout(ED.t); ED = null; }
    if(NEW[id]){ delete NEW[id]; saveNew(); }
    T.del(kind, id);
    toast(kind === "case" ? "Case deleted" : "Story deleted", ico("trash", "bold", 20));
    location.replace(kind === "case" ? "#/techcases" : "#/techstories");
  };
  DEL.innerHTML = `<div class="tp-stop"><span class="tp-stop-ic" aria-hidden="true">${ico("trash", "bold", 28)}</span>
    <h2 class="tp-stop-t" id="tp-del-t">Delete this ${what}?</h2>
    <p class="tp-sub">${title ? `“${esc(title)}” will be deleted.` : `This ${what} will be deleted.`} This can't be undone.</p>
    <div class="tp-stop-b"><button type="button" class="glass-btn glass-btn--lg" id="tp-del-yes">Delete</button>
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="tp-del-no" autofocus>Cancel</button></div></div>`;
  openSheet(DEL, from);
}

/* ---------- My cases (#/techcases y #/techcase/<id>, §10.7) ---------- */
function casesHtml(){
  const own = T.list("case");
  const rows = own.map(r => {
    const f = caseFill({fields: cleanFields(r.fields, FK)}), t = str(r.title).trim() || "Untitled case";
    return `<a class="tp-row tp-row-noic tp-crow" href="#/techcase/${esc(r.id)}" data-case="${esc(r.id)}"><span class="tp-rt">${esc(t)}<small>${esc(`${f} of ${FK.length} sections · edited ${fmt.ago(r.at)}`)}</small></span>
      <span aria-hidden="true">${ui.ring(100 * f / FK.length, {size: 32, cls: f >= FK.length ? "done" : ""})}</span>${chev()}</a>`;
  }).join("");
  const models = CD.cases.map(c => `<a class="tp-row tp-mrow" href="#/techcase/${esc(c.id)}" data-case="${esc(c.id)}"><span class="tp-ric" aria-hidden="true">${ico("briefcase", "bold", 18)}</span>
      <span class="tp-rt"><span class="tp-rt-b">${ui.badge("Example")}</span>${esc(c.title)}<small>${esc(c.summary || "")}</small></span>${chev()}</a>`).join("");
  return `<div class="tp-page tp-cases" id="tp-cases">
    <p class="tp-lead">Write up projects you know well, then practise explaining them to an interviewer. Everything saves as you type.</p>
    <a class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" id="tp-c-new" href="#/techcase/new">${ico("plus", "bold", 20)}New case</a>
    ${own.length ? `<section class="tp-list" aria-labelledby="tp-own-h"><h2 class="tp-lh" id="tp-own-h">Your cases</h2>${rows}</section>`
      : `<div class="card tp-card tp-none" id="tp-c-none"><p class="tp-text">No cases yet. Start a new one, or copy one of the examples below and make it yours.</p></div>`}
    <section class="tp-list" aria-labelledby="tp-ex-h"><h2 class="tp-lh" id="tp-ex-h">Examples</h2>${models}</section>
  </div>`;
}
ROUTES.techcases = () => show({cases: true}, a => { a.innerHTML = casesHtml(); });
ROUTES.techcases.load = () => Promise.all([T.units(), casesLoad()]);
function modelHtml(c){
  const m = modelOf(c.id);
  const qs = (m.questions || []).map((q, i) => `<div class="tp-tm tp-qq" data-q="${esc(q.id)}"><p class="tp-qq-t"><span class="tp-qn" aria-hidden="true">${i + 1}</span><span>${esc(q.q)}</span></p>
      ${exBtn("tp-qa-" + q.id, "Show model answer", "Hide model answer")}
      <div class="tp-qa" id="tp-qa-${esc(q.id)}" hidden><div class="tp-qa-h">${ui.say(q.model, {label: "Listen to the model answer"})}</div><p class="tp-ans-m">${esc(q.model)}</p>
        ${(q.keypoints || []).length ? `<h3 class="tp-kp-h">Key points</h3><ul class="tp-kp">${q.keypoints.map(k => `<li>${esc(k.text)}</li>`).join("")}</ul>` : ""}${ui.src(m, q.src)}</div></div>`).join("");
  return `<div class="tp-page tp-case tp-model" id="tp-case" data-case="${esc(c.id)}">
    <header class="card tp-card tp-chead"><p class="tp-eyebrow">Example case</p><h1 class="tp-title tp-h1">${esc(c.title)}</h1>${c.summary ? `<p class="tp-sub">${esc(c.summary)}</p>` : ""}
      <a class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block tp-go" id="tp-e-go" href="#/techl/case/${esc(c.id)}">${ico("chats-circle", "bold", 20)}Practise this case</a>
      <button type="button" class="glass-btn glass-btn--lg glass-btn--block tp-go2" id="tp-e-copy">${ico("copy", "bold", 20)}Use as a starting point</button></header>
    ${FIELDS.map(f => `<section class="card tp-card tp-fld" aria-labelledby="tp-f-${f.k}"><h2 class="tp-flabel" id="tp-f-${f.k}">${esc(f.t)}</h2><p class="tp-ro">${esc(c.fields[f.k])}</p></section>`).join("")}
    <section aria-labelledby="tp-cq-h"><h2 class="tp-h2" id="tp-cq-h">Interviewer questions</h2><div class="tp-list">${qs}</div></section>
    <section aria-labelledby="tp-cs-h"><h2 class="tp-h2" id="tp-cs-h">Sources</h2>${srcRows(c.sources)}</section>
    ${c.notes.length ? `<div class="tp-foot">${CD.reviewed ? `<p>Facts checked on ${esc(longDate(CD.reviewed))}.</p>` : ""}<h2 class="tp-foot-h">Notes</h2><ul>${c.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}
  </div>`;
}
function editHtml(kind, id, rec){
  const isCase = kind === "case", F = isCase ? FIELDS : STAR, fromItem = !isCase && rec.from ? T.item(rec.from) : null, g = !isCase && rec.guide ? guideOf(rec.guide) : null;
  const m = isCase && rec.from ? modelOf(rec.from) : null;
  const saved = T.get(kind, id);
  const head = `<div class="card tp-card tp-ehead">
      <label class="tp-flabel" for="tp-e-title">${isCase ? "Case title" : "Story title"}</label>
      <input class="tp-in tp-in-t" id="tp-e-title" data-k="title" type="text" maxlength="140" autocomplete="off" enterkeyhint="next" placeholder="${isCase ? "For example: Hires to payroll with events" : "For example: The retry storm"}">
      ${isCase ? "" : `<label class="tp-flabel tp-fl2" for="tp-e-prompt">Interview question</label>
      <textarea class="tp-in tp-ta tp-ta-s" id="tp-e-prompt" data-k="prompt" data-min="52" rows="2" placeholder="For example: Tell me about a time you disagreed with a technical decision."></textarea>`}
      <p class="tp-sv" id="tp-sv">${saved ? `${ico("check-circle", "bold", 16)}<span>Saved on this device</span>` : `${ico("pencil-simple", "bold", 16)}<span>Saves as you type</span>`}</p>
      ${m ? `<p class="tp-from">Started from the example <a class="tp-ilink" href="#/techcase/${esc(m.id)}">${esc(m.title)}</a></p>` : ""}
      ${fromItem ? `<p class="tp-from">From Unit ${fromItem.unit.n} · ${esc(fromItem.lesson.title)}</p>` : ""}
    </div>`;
  const fields = F.map(f => `<div class="card tp-card tp-fld"><label class="tp-flabel" for="tp-e-${f.k}">${esc(f.t)}</label><p class="tp-hint" id="tp-h-${f.k}">${esc(f.hint)}</p>
      <textarea class="tp-in tp-ta" id="tp-e-${f.k}" data-k="f.${f.k}" data-min="96" rows="3" aria-describedby="tp-h-${f.k}"></textarea></div>`).join("");
  if(isCase) return `<div class="tp-page tp-edit tp-case" id="tp-case" data-case="${esc(id)}">${head}${fields}
    <a class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" id="tp-e-go" href="#/techl/case/${esc(id)}">${ico("chats-circle", "bold", 20)}Practise this case</a>
    <p class="tp-note">The interviewer asks ten general questions about your case. Your notes stay here to look at afterwards.</p>
    <div class="tp-list">${ui.row({icon: "trash", tone: "gr", t: "Delete case", id: "tp-e-del"})}</div></div>`;
  const model = fromItem && fromItem.item.type === "story" && fromItem.item.model ? `<section class="card tp-card tp-mstory" aria-labelledby="tp-ms-h"><h2 class="tp-flabel" id="tp-ms-h">Model story</h2>
      <p class="tp-hint">One way to answer this question, from the lesson.</p>${exBtn("tp-ms-b", "Show model story", "Hide model story")}
      <div id="tp-ms-b" hidden><div class="tp-qa-h">${ui.say(fromItem.item.model, {label: "Listen to the model story"})}</div>${starDl(fromItem.item.model)}</div></section>` : "";
  return `<div class="tp-page tp-edit tp-story" id="tp-story" data-story="${esc(id)}">${head}${fields}
    <section class="card tp-card tp-wcc" aria-label="Word count"><p class="tp-wc-t" id="tp-wc"></p><div class="tp-wc-bar" aria-hidden="true"><span class="tp-wc-zone"></span><i id="tp-wc-bar"></i></div></section>
    <button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" id="tp-e-hear">${ico("speaker-high", "bold", 20)}<span>Hear it</span></button>
    ${model}
    <div class="tp-list">${g ? ui.row({icon: "lightbulb", t: "Open the guide", sub: g.title, id: "tp-e-guide"}) : ""}${ui.row({icon: "trash", tone: "gr", t: "Delete story", id: "tp-e-del"})}</div></div>`;
}
function openEditor(kind, id, rec){
  const a = app();
  const keys = kind === "case" ? FK : SK;
  ED = {kind, id, rec: Object.assign({}, rec, {fields: cleanFields(rec.fields, keys)}), t: 0, dirty: false, at: rec.at || null};
  delete ED.rec.at; delete ED.rec.id;
  a.innerHTML = editHtml(kind, id, ED.rec);
  const root = a.firstElementChild;
  root.querySelectorAll("[data-k]").forEach(el => { const k = el.dataset.k; el.value = k.startsWith("f.") ? ED.rec.fields[k.slice(2)] : str(ED.rec[k]); });
  wireEditor(root); wireEx(root);
  if(kind === "story") paintWc();
  const del = D.getElementById("tp-e-del");
  if(del) del.addEventListener("click", () => { edSave(); confirmDelete(kind, id, str(ED && ED.rec.title).trim(), del); });
  const go = D.getElementById("tp-e-go"); if(go) go.addEventListener("click", () => edSave());
  const hear = D.getElementById("tp-e-hear");
  if(hear) hear.addEventListener("click", () => {
    const lab = hear.querySelector("span");
    if(hear.classList.contains("playing")){ T.stopSpeak(); if(lab) lab.textContent = "Hear it"; return; }
    const text = ED ? storyText(ED.rec) : "";
    if(!text){ toast("Write something first, then listen to it."); return; }
    if(lab) lab.textContent = "Stop";
    Promise.resolve(T.speak(text, hear)).then(() => { if(lab && !hear.classList.contains("playing")) lab.textContent = "Hear it"; });
  });
  const gb = D.getElementById("tp-e-guide");
  if(gb) gb.addEventListener("click", () => { const g = guideOf(ED && ED.rec.guide); if(g) openGuide(g, gb, false); });
}
function newRoute(kind){
  const q = new URLSearchParams((location.hash.split("?")[1]) || ""), from = q.get("from") || "", gid = q.get("guide") || "";
  if(kind === "story" && from){ const ex = T.list("story").find(s => s.from === from); if(ex){ location.replace("#/techstory/" + ex.id); return; } }
  const id = newId(), n = {kind};
  if(kind === "story" && from){ const x = T.item(from); if(x && x.item.type === "story"){ n.prompt = x.item.prompt; n.from = from; } }
  if(kind === "story" && gid){ const g = guideOf(gid); if(g){ n.prompt = g.prompt; n.guide = g.id; } }
  NEW[id] = n; saveNew();
  location.replace(`#/tech${kind}/${id}`);
}
const idOk = id => /^[\w-]{1,64}$/.test(id);
ROUTES.techcase = parts => show({cases: true}, a => {
  const id = String(parts[0] || "");
  if(id === "new") return newRoute("case");
  if(ED && (ED.kind !== "case" || ED.id !== id)){ edSave(); ED = null; }
  const c = idOk(id) ? caseGet(id) : null;
  if(!c){ a.innerHTML = notFound("This case isn't here", "It may have been deleted, or the link is wrong.", "#/techcases", "Back to My cases"); return; }
  if(c.model){
    a.innerHTML = modelHtml(c);
    const root = D.getElementById("tp-case"); wireEx(root);
    D.getElementById("tp-e-copy").addEventListener("click", () => {
      const nid = newId();
      T.put("case", nid, {title: c.title, fields: Object.assign({}, c.fields), from: c.id});
      toast("Copied to your cases", ico("copy", "bold", 20));
      location.hash = "#/techcase/" + nid;
    });
    return;
  }
  const r = T.get("case", id) || {title: "", fields: {}};
  const rec = {title: str(r.title), fields: r.fields, at: r.at}; if(r.from) rec.from = r.from;
  openEditor("case", id, rec);
});
ROUTES.techcase.load = () => Promise.all([T.units(), casesLoad()]);

/* ---------- My stories (#/techstories y #/techstory/<id>, §10.8) ---------- */
function storiesHtml(){
  const own = T.list("story");
  const rows = own.map(r => {
    const n = words(storyText({fields: cleanFields(r.fields, SK)})), t = str(r.title).trim() || str(r.prompt).trim() || "Untitled story";
    const inT = n >= WC_MIN && n <= WC_MAX;
    return `<a class="tp-row tp-row-noic tp-srow2" href="#/techstory/${esc(r.id)}" data-story="${esc(r.id)}"><span class="tp-rt">${esc(t)}<small>${esc(`${plural(n, "word", "words")} · edited ${fmt.ago(r.at)}`)}</small></span>
      ${inT ? `${ico("check-circle", "fill", 20, "tp-ok")}<span class="vh">, within the target length</span>` : ""}${chev()}</a>`;
  }).join("");
  const guides = CD.guides.map(g => ui.row({icon: "lightbulb", t: g.title, sub: g.prompt, chev: true, attrs: `data-guide="${esc(g.id)}" aria-haspopup="dialog"`, cls: "tp-grow"})).join("");
  return `<div class="tp-page tp-stories" id="tp-stories">
    <p class="tp-lead">Short STAR stories about your own work, ready to tell: situation, task, action, result and what you learned. Aim for ${WC_MIN} to ${WC_MAX} words.</p>
    <a class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" id="tp-s-new" href="#/techstory/new">${ico("plus", "bold", 20)}New story</a>
    ${own.length ? `<section class="tp-list" aria-labelledby="tp-sown-h"><h2 class="tp-lh" id="tp-sown-h">Your stories</h2>${rows}</section>`
      : `<div class="card tp-card tp-none" id="tp-s-none"><p class="tp-text">No stories yet. Start a new one, or open a guide below for ideas.</p></div>`}
    <section class="tp-list" aria-labelledby="tp-gd-h"><h2 class="tp-lh" id="tp-gd-h">Story guides</h2>${guides}</section>
  </div>`;
}
let GD = null;
function openGuide(g, from, write = true){
  if(!GD){
    GD = D.createElement("dialog"); GD.id = "tp-guide"; GD.className = "tp-sheet"; GD.lang = "en-GB"; GD.setAttribute("aria-labelledby", "tp-gd-t");
    GD.dataset.noHint = "";
    D.body.appendChild(GD);
    GD.addEventListener("click", e => {
      if(e.target.closest("[data-close]")) return closeSheet(GD);
      if(e.target.closest("#tp-gd-go")) closeSheet(GD);
    });
  }
  const list = (h, xs) => xs && xs.length ? `<h4 class="tp-gd-h">${esc(h)}</h4><ul>${xs.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  GD.innerHTML = `<div class="m-head"><h2 id="tp-gd-t">Story guide</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Done</button></div>
    <div class="tp-gd" data-guide="${esc(g.id)}">
      <h3 class="tp-title">${esc(g.title)}</h3>
      ${ui.quote(g.prompt)}
      ${list("What the interviewer looks for", g.looksFor)}${list("Tips", g.tips)}${list("Pitfalls", g.pitfalls)}
      ${g.opener ? `<h4 class="tp-gd-h">A good first sentence</h4><div class="tp-gd-o">${ui.quote(g.opener)}${ui.say(g.opener, {label: "Listen to the first sentence"})}</div>` : ""}
      ${write ? `<a class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block tp-go" id="tp-gd-go" href="#/techstory/new?guide=${esc(g.id)}">${ico("pencil-simple", "bold", 20)}Write this story</a>` : ""}
    </div>`;
  openSheet(GD, from);
}
ROUTES.techstories = () => show({cases: true}, a => {
  a.innerHTML = storiesHtml();
  D.getElementById("tp-stories").addEventListener("click", e => { const b = e.target.closest("[data-guide]"); if(!b) return; const g = guideOf(b.dataset.guide); if(g) openGuide(g, b); });
});
ROUTES.techstories.load = () => Promise.all([T.units(), casesLoad()]);
ROUTES.techstory = parts => show({cases: true}, a => {
  const id = String(parts[0] || "");
  if(id === "new") return newRoute("story");
  if(ED && (ED.kind !== "story" || ED.id !== id)){ edSave(); ED = null; }
  const r = idOk(id) ? T.get("story", id) || (isNew("story", id) ? Object.assign({title: "", fields: {}}, NEW[id]) : null) : null;
  if(!r){ a.innerHTML = notFound("This story isn't here", "It may have been deleted, or the link is wrong.", "#/techstories", "Back to My stories"); return; }
  const rec = {title: str(r.title), prompt: str(r.prompt), fields: r.fields, at: r.at};
  if(r.from) rec.from = r.from;
  if(r.guide) rec.guide = r.guide;
  openEditor("story", id, rec);
});
ROUTES.techstory.load = () => Promise.all([T.units(), casesLoad()]);

/* ---------- cambios de datos y de ruta ---------- */
const WATCH = {techpath: ["ls", "srs", "medal"], techunit: ["ls", "srs", "medal"], techsheet: [], techplay: ["best", "ls", "srs"], techcases: ["case"], techstories: ["story"]};
bus.on("tech-data", d => {
  const ks = (d && d.kinds) || [], all = ks.includes("*");
  if(ED && (all || ks.includes(ED.kind))) edRemote();
  const w = WATCH[secOf(hashPath())];
  if(w && (all || w.some(k => ks.includes(k)))) repaint();
});
bus.on("route", () => {
  const hp = hashPath(), s = secOf(hp);
  if(!/^techl\/pairs(\/|$)/.test(hp) && GAME.pairs) gameStop("pairs");
  if(!/^techl\/clock(\/|$)/.test(hp) && GAME.clock) gameStop("clock");
  if(GD && GD.open && s !== "techstories" && s !== "techstory") closeSheet(GD);
  if(DEL && DEL.open && s !== "techcase" && s !== "techstory") closeSheet(DEL);
  if(ED && !(s === "tech" + ED.kind && String(hp.split("/")[1] || "") === ED.id)){ edSave(); ED = null; }
  if(!CUR || CUR.hp !== hp) CUR = null;
});
bus.on("tech-mode", d => {
  if(d && d.on) return;
  edSave(); ED = null; gameStop("pairs"); gameStop("clock");
  [GD, DEL].forEach(x => { if(x && x.open) try{ x.close(); }catch(e){} });
});

/* ---------- CSS ---------- */
const CSS = `
.tp-page [hidden]{display:none!important}
.tp-h1{font-size:var(--fs-t2)}
.tp-h2{margin:12px 4px 8px;font:700 var(--fs-t3)/1.25 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.tp-lead{margin:0 4px;font:400 var(--fs-sub)/1.45 var(--f-text);color:var(--label2);max-width:70ch}
.tp-note{margin:0 4px;font:400 var(--fs-note)/1.45 var(--f-text);color:var(--label2);max-width:70ch}
.tp-lh{margin:0;padding:12px 16px 4px;font:600 var(--fs-note)/1.33 var(--f-text);color:var(--label2)}
.tp-list>.tp-lh+.tp-row::before{display:none}
.tp-rt-b{display:block;margin:2px 0 4px}
.tp-mrow{align-items:flex-start;padding-top:12px;padding-bottom:12px}
.tp-mrow .tp-ric{margin-top:2px}
.tp-mrow .tp-chev{align-self:center}
.tp-ilink{display:inline-flex;align-items:center;gap:6px;min-height:var(--tap);padding:0 4px;color:var(--brand-ink);font:600 var(--fs-note)/1.2 var(--f-text);text-decoration:none}
.tp-ilink:hover span{text-decoration:underline}
.tp-ilink .ico{flex:none}
.tp-pill{flex:none;display:inline-flex;align-items:center;min-height:30px;padding:0 12px;border-radius:var(--r-pill);background:var(--fill2);color:var(--label);font:600 var(--fs-note)/1 var(--f-text)}
.tp-more{display:inline-flex;align-items:center;gap:6px;min-height:var(--tap);margin:0;padding:0 4px;border:0;background:none;color:var(--brand-ink);font:600 var(--fs-note)/1.2 var(--f-text);cursor:pointer;-webkit-tap-highlight-color:transparent}
.tp-more .tp-more-ic{flex:none;transition:rotate 150ms ease}
.tp-more[aria-expanded=true] .tp-more-ic{rotate:180deg}
.tp-go2{margin-top:10px}
/* Path */
.tp-bhead{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;padding:14px 16px 10px}
.tp-bh-t{flex:1 1 150px;min-width:0}
.tp-bh{display:flex;align-items:center;gap:6px;margin:0;font:700 var(--fs-t3)/1.2 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.tp-bh-s{margin:2px 0 0;font:400 var(--fs-note)/1.35 var(--f-text);color:var(--label2)}
.tp-bh-cs{flex:none;margin-left:auto}
.tp-blk>.tp-bhead+.tp-row::before{left:16px}
.tp-num{flex:none;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--fill2);color:var(--label);font:700 var(--fs-note)/1 var(--f-text);font-variant-numeric:tabular-nums}
.tp-urow.tp-next .tp-num{background:var(--brand-soft);color:var(--brand-ink)}
.tp-soon{cursor:default;color:var(--label2)}
.tp-soon .tp-num{color:var(--label2);background:var(--fill2)}
.tp-soon .tp-rt small{color:var(--label2)}
.tp-urow .tp-dots{margin-left:2px}
/* una unidad */
.tp-uhead .tp-go{margin-top:16px}
.tp-sum{max-width:70ch}
.tp-rdy{display:flex;align-items:center;gap:10px;margin:12px 0 0;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.tp-alldone{display:flex;align-items:center;gap:8px;margin:14px 0 0;font:600 var(--fs-sub)/1.35 var(--f-text);color:var(--label)}
.tp-alldone .ico,.tp-nomiss .ico{flex:none;color:var(--ok-ink)}
.tp-lrow .tp-pill{margin-left:4px}
.tp-tm{position:relative;padding:14px 16px}
.tp-list>.tp-tm+.tp-tm::before{content:"";position:absolute;top:0;left:16px;right:0;height:1px;background:var(--sep);transform:scaleY(.5);transform-origin:0 0}
.tp-list>.tp-tm.tp-first::before{display:none}
.tp-tm-f{display:flex;flex-wrap:wrap;align-items:center;gap:0 12px;margin:2px 0 -8px -4px}
.tp-ex .tp-quote{margin-top:4px}
.tp-terms .tp-term-t,.tp-ge .tp-term-t{font-size:var(--fs-head)}
.tp-cs{padding:16px 16px 18px}
.tp-cs-t{margin-bottom:4px}
.tp-cs-h{margin:16px 0 6px;font:700 var(--fs-head)/1.3 var(--f-text);color:var(--label);overflow-wrap:anywhere}
.tp-cs>.tp-cs-h:first-child,.tp-cs>.tp-eyebrow+.tp-cs-t+.tp-cs-h{margin-top:8px}
.tp-cs-l,.tp-kp,.tp-foot ul,.tp-gd ul{margin:0;padding:0 0 0 1.25em;font:400 var(--fs-sub)/1.45 var(--f-text);color:var(--label);max-width:70ch}
.tp-cs-l li+li,.tp-kp li+li,.tp-gd li+li{margin-top:6px}
.tp-after{margin-top:12px}
.tp-srcs{margin:0;padding:0;list-style:none}
.tp-srcs>li{position:relative}
.tp-srcs>li+li::before{content:"";position:absolute;z-index:1;top:0;left:16px;right:0;height:1px;background:var(--sep);transform:scaleY(.5);transform-origin:0 0}
.tp-srow .tp-badge{margin-left:4px}
.tp-foot{margin:4px 4px 0;font:400 var(--fs-note)/1.45 var(--f-text);color:var(--label2);max-width:70ch}
.tp-foot p{margin:0 0 8px}
.tp-foot-h{margin:12px 0 6px;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.tp-foot ul{font-size:var(--fs-note);color:var(--label2)}
.tp-foot li+li{margin-top:6px}
/* chuleta del bloque */
.tp-jump{display:flex;flex-wrap:wrap;gap:8px}
.tp-shu,.tp-shans,.tp-ans{scroll-margin-top:calc(var(--safe-t,0px) + 96px)}
.tp-shu:focus,.tp-shans:focus{outline:none}
.tp-shans{display:flex;flex-direction:column;gap:12px}
.tp-shans>.tp-h2{margin-bottom:0}
.tp-ans{padding:16px}
.tp-ans-h{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.tp-ans-q{margin:0;min-width:0;font:700 var(--fs-head)/1.3 var(--f-text);color:var(--label);overflow-wrap:anywhere}
.tp-ans-m{margin:10px 0 0;font:400 var(--fs-sub)/1.5 var(--f-text);color:var(--label);max-width:70ch}
.tp-kp-h{margin:14px 0 6px;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.tp-ans .tp-src,.tp-qa .tp-src{margin:6px 0 -8px -4px}
.tp-star{margin:6px 0 0}
.tp-star dt{margin:10px 0 2px;font:700 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.tp-star dd{margin:0;font:400 var(--fs-sub)/1.5 var(--f-text);color:var(--label);max-width:70ch}
/* glosario */
.tp-search{position:relative;display:flex;align-items:center}
.tp-search .tp-search-ic{position:absolute;left:14px;color:var(--label2);pointer-events:none}
.tp-search input[type=search]{flex:1;min-width:0;min-height:var(--tap);margin:0;padding:10px 14px 10px 44px;border:0;border-radius:12px;background:var(--fill);color:var(--label);font:400 var(--fs-sub)/1.3 var(--f-text);-webkit-appearance:none;appearance:none}
.tp-search input[type=search]::placeholder{color:var(--label2);opacity:1}
.tp-gcount{margin:0 4px;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.tp-gsec{display:flex;flex-direction:column;gap:6px}
.tp-gl{margin:6px 4px 0;font:700 var(--fs-t3)/1.1 var(--f-round);color:var(--label)}
.tp-ge .tp-ilink{margin:2px 0 -8px -4px}
/* Play */
.tp-game{display:flex;align-items:center;gap:16px;min-height:120px;padding:20px 16px;color:var(--label);text-decoration:none;-webkit-tap-highlight-color:transparent}
.tp-game-ic{flex:none;width:56px;height:56px;border-radius:16px;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-ink)}
.tp-game.clock .tp-game-ic{background:var(--gold-soft);color:var(--gold-ink)}
.tp-game-b{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.tp-game-t{margin:0;font:700 var(--fs-t2)/1.2 var(--f-round);color:var(--label)}
.tp-game-d{font:400 var(--fs-sub)/1.4 var(--f-text);color:var(--label)}
.tp-game-m{display:block;margin:2px 0 0;font:600 var(--fs-note)/1.35 var(--f-text);color:var(--label2)}
/* las partidas */
.tp-gt{margin:0;font:700 var(--fs-t2)/1.2 var(--f-round);color:var(--label)}
.tp-game-p>.tp-sub{margin-top:-4px}
.tp-timer{flex:none;min-width:3.4em;text-align:right;font:700 var(--fs-sub)/1 var(--f-text);font-variant-numeric:tabular-nums;color:var(--label)}
.tp-pq{margin:0;padding:0;list-style:none;font:400 var(--fs-note)/1.4 var(--f-text);color:var(--label2);max-width:70ch}
.tp-pq li+li{margin-top:2px}
.tp-pgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;margin-top:4px}
.tp-pcol{display:flex;flex-direction:column;gap:10px;min-width:0}
.tp-tile{position:relative;display:flex;align-items:center;gap:8px;flex:1 0 auto;min-height:64px;margin:0;padding:10px 12px;border:2px solid var(--sep);border-radius:var(--r-md);
  background:var(--card);color:var(--label);font:600 var(--fs-note)/1.3 var(--f-text);text-align:left;overflow-wrap:anywhere;hyphens:auto;cursor:pointer;
  -webkit-tap-highlight-color:transparent;transition:background-color 120ms ease,border-color 120ms ease}
.tp-tile[data-s=r]{font-weight:400}
.tp-tile .ico{flex:none}
.tp-tile-t{min-width:0}
.tp-tile[aria-pressed=true]{border-color:var(--brand-tint);background:var(--brand-soft);color:var(--brand-ink)}
.tp-tile.ok{border-color:transparent;background:var(--ok-soft);color:var(--label);cursor:default}
.tp-tile.ok .ico{color:var(--ok-ink)}
.tp-tile.miss{border-color:transparent;background:var(--miss-fill);color:var(--miss-on)}
.tp-tile:disabled{opacity:1}
.tp-res{display:flex;flex-direction:column;align-items:center;text-align:center;padding:24px 16px}
.tp-res .tp-sub{max-width:44ch}
.tp-res .tp-title:focus{outline:none}
.tp-res-ic{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;margin:0 0 12px;background:var(--gold-soft);color:var(--gold-ink)}
.tp-res-n{margin:10px 0 0;font:800 var(--fs-lt)/1 var(--f-round);font-variant-numeric:tabular-nums;color:var(--label)}
.tp-res-u{font:700 var(--fs-t3)/1 var(--f-round)}
.tp-cho{display:flex;align-items:flex-start;gap:8px;margin:14px 0 0;max-width:44ch;text-align:left;font:400 var(--fs-note)/1.4 var(--f-text);color:var(--label2)}
.tp-cho .ico{flex:none;margin-top:1px}
.tp-plist,.tp-misses{margin:0;padding:0;list-style:none}
.tp-pli,.tp-mi{position:relative;display:flex;flex-direction:column;gap:2px;padding:12px 16px}
.tp-plist>li+li::before,.tp-misses>li+li::before{content:"";position:absolute;top:0;left:16px;right:0;height:1px;background:var(--sep);transform:scaleY(.5);transform-origin:0 0}
.tp-pl{font:700 var(--fs-sub)/1.35 var(--f-text);color:var(--label)}
.tp-pr{font:400 var(--fs-sub)/1.4 var(--f-text);color:var(--label);max-width:70ch}
.tp-pu,.tp-mi-f{display:flex;flex-wrap:wrap;align-items:center;gap:0 10px;margin:0 0 -8px;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.tp-cscore{margin:-4px 0 0;font:600 var(--fs-sub)/1.2 var(--f-text);color:var(--label2);font-variant-numeric:tabular-nums}
.tp-stmt{display:flex;flex-direction:column;justify-content:center;min-height:220px;padding:20px;touch-action:pan-y;transition:background-color 120ms ease}
.tp-stmt-t{margin:6px 0 0;font:600 var(--fs-t3)/1.4 var(--f-text);color:var(--label);overflow-wrap:anywhere;max-width:60ch}
.tp-stmt.ok{background:var(--ok-soft)}
.tp-stmt.miss{background:var(--miss-fill)}
.tp-stmt.miss .tp-eyebrow{color:var(--miss-on)}
.tp-fb{display:flex;align-items:center;gap:8px;min-height:28px;margin:14px 0 0;font:700 var(--fs-sub)/1.25 var(--f-text);color:var(--label)}
.tp-fb.ok .ico{color:var(--ok-ink)}
.tp-fb.miss .ico{color:var(--miss-ink)}
.tp-mi-s{display:flex;align-items:flex-start;gap:8px;margin:0;font:600 var(--fs-sub)/1.4 var(--f-text);color:var(--label)}
.tp-mi-ic{flex:none;margin-top:3px;color:var(--miss-ink)}
.tp-mi-w{margin:4px 0 0 26px;font:400 var(--fs-sub)/1.45 var(--f-text);color:var(--label);max-width:70ch}
.tp-mi-f{margin-left:26px}
.tp-nomiss{display:flex;align-items:center;gap:8px;color:var(--label)}
/* editor de casos e historias */
.tp-flabel{display:block;margin:0;font:700 var(--fs-head)/1.3 var(--f-text);color:var(--label)}
.tp-fl2{margin-top:16px}
.tp-hint{margin:2px 0 0;font:400 var(--fs-note)/1.4 var(--f-text);color:var(--label2);max-width:70ch}
.tp-in{display:block;box-sizing:border-box;width:100%;min-height:var(--tap);margin:10px 0 0;padding:10px 12px;border:0;border-radius:12px;background:var(--fill2);color:var(--label);
  font:400 var(--fs-sub)/1.45 var(--f-text);-webkit-appearance:none;appearance:none}
.tp-in::placeholder{color:var(--label2);opacity:1}
.tp-in:focus-visible{outline:2px solid var(--brand-tint);outline-offset:1px}
.tp-in-t{font-weight:600}
.tp-ta{min-height:96px;resize:none;overflow:hidden}
.tp-ta.tp-ta-s{min-height:52px}
.tp-sv{display:flex;align-items:center;gap:6px;margin:12px 0 0;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.tp-sv .ico{flex:none}
.tp-from{margin:6px 0 -8px;font:400 var(--fs-note)/1.35 var(--f-text);color:var(--label2)}
.tp-from .tp-ilink{padding:0;vertical-align:middle}
.tp-ro{margin:6px 0 0;white-space:pre-line;font:400 var(--fs-sub)/1.5 var(--f-text);color:var(--label);max-width:70ch;overflow-wrap:anywhere}
.tp-qq-t{display:flex;align-items:flex-start;gap:10px;margin:0;font:600 var(--fs-sub)/1.4 var(--f-text);color:var(--label)}
.tp-qn{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--fill2);color:var(--label);font:700 var(--fs-note)/1 var(--f-text)}
.tp-qq .tp-more{margin:2px 0 -8px 34px}
.tp-qa{margin:12px 0 4px 38px}
.tp-qa-h{display:flex;justify-content:flex-end}
.tp-qa .tp-ans-m{margin-top:4px}
.tp-none{padding:16px}
.tp-none .tp-text{margin:0}
.tp-wc-t{margin:0;font:600 var(--fs-sub)/1.35 var(--f-text);color:var(--label)}
.tp-wc-bar{position:relative;height:8px;margin-top:10px;border-radius:4px;background:var(--fill);overflow:hidden}
.tp-wc-bar>i{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:4px;background:var(--teal);transition:width 120ms ease}
.tp-wc-bar.in>i{background:var(--ok-fill)}
.tp-wc-zone{position:absolute;z-index:1;top:0;bottom:0;left:50%;width:33.334%;box-shadow:inset 2px 0 0 var(--label2),inset -2px 0 0 var(--label2)}
.tp-mstory .tp-more{margin:4px 0 -8px -4px}
.tp-mstory [id=tp-ms-b]{margin-top:12px}
/* la guía de historias (hoja) */
.tp-gd{padding:0 4px 8px}
.tp-gd>.tp-title{margin:2px 0 6px}
.tp-gd-h{margin:18px 0 6px;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.tp-gd-o{display:flex;align-items:flex-start;gap:12px}
.tp-gd-o .tp-quote{flex:1;margin:0}
.tp-gd .tp-go{margin-top:22px}
@media (min-width:600px){.tp-pgrid{gap:12px}.tp-pcol{gap:12px}.tp-tile{font-size:var(--fs-sub)}}
@media (prefers-reduced-motion:reduce){.tp-tile,.tp-stmt,.tp-wc-bar>i,.tp-more .tp-more-ic{transition-duration:100ms}}
:root[data-motion=calm] .tp-tile,:root[data-motion=calm] .tp-stmt,:root[data-motion=calm] .tp-wc-bar>i{transition-duration:100ms}
@media (forced-colors:active){.tp-tile,.tp-pill,.tp-num{border:1px solid CanvasText}.tp-tile[aria-pressed=true]{outline:3px solid Highlight}}
`;
function css(){ if(D.getElementById("css-tech-pages") || !D.head) return; const s = D.createElement("style"); s.id = "css-tech-pages"; s.textContent = CSS; D.head.appendChild(s); }
css();

/* ---------- API ---------- */
T.offline.add("data/tech/cases.json");
T.cases = Object.assign(T.cases || {}, {
  load: () => casesLoad(),
  data: () => CD,
  get: id => caseGet(String(id || "")),
  list: () => T.list("case").map(r => caseGet(r.id)).filter(Boolean),
  models: () => (CD ? CD.cases.map(c => caseGet(c.id)) : []),
  questions,
  FIELDS, STAR,
});
})();
