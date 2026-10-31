/* IELTS Prep (ielts.html): the core. A separate page for a grown-up who prepares IELTS Academic for band 8.5-9 (≈ C2).
   Everything the learner sees is in British English. It never touches the child's game (no vocab:* keys, no coins,
   no medals, no streak) and needs nothing but the browser: data/ielts/*.json, speechSynthesis and the microphone.
   · Entry: js/ielts-boot.js (in index.html) passes the adult gate and sets sessionStorage "ielts:in" = "1"; without it,
     or with the switch "ielts:on" off, this page only shows how to open it.
   · State (localStorage, this device only; nothing outside ielts:*):
     "ielts:data" = {v:1, lessons:{lid:{done, at, got, total, band, best}},
       tests:[{lid, title, skill, got, total, band, at, attempt, counted, paused?, noaudio?}],
       essays:[{id, iid, task, prompt, text, words, self, band, at, parent?, v?}], speaking:[{iid?, title, self?, band, at}]}.
       v stays 1: new fields are added, never reshaped. migrate() lets v1 through; a higher v (a newer version of the app
       wrote it) opens read-only and pset() never writes; a blob that isn't valid v1 JSON is copied first to
       "ielts:data:bak-<ms>". Nothing is trimmed unless the browser refuses to save (then the caps below apply and a toast
       sends the learner to Settings › Your data).
     "ielts:ui" = {rate, accents: "mixed"|"gb", at}; "ielts:run:<lid>" = a lesson in progress (js/ielts-player.js, saved as
     you go); "ielts:draft:<essayId>" = {text, blank, at, from, alt?} a revision being written (#/essays/<id>/revise; alt =
     the draft of the other mode, so «Write version N» and «Rewrite from memory» never open each other's draft).
   · Bands: attempt = the n-th test of that lesson; a test counts if it is the first attempt (or the previous one was 60+
     days earlier) and wasn't paused or played without sound. Listening and Reading come from the counted tests, newest
     first, pooled until there are 40 questions behind the band; latestInfo() adds the questions and a likely range
     (binomial standard error on 40 marks, through TABLES). Writing comes from first versions only (a revision written
     after reading the model isn't exam evidence); Writing and Speaking are the learner's own estimates.
   · Voices: pickVoices() keeps female and male lists for each accent (gb us ca au nz ie za). speak(text, {voice: "f"|"m",
     accent, alt: 0-2, pitch (×, 0.5-2), rate, slow, gap, exam}) uses that accent, then British, then any English voice;
     "British only" (ielts:ui.accents) ignores accent; inside a timed test (#/lesson/<lid> of kind test) it always plays
     at exam speed. It resolves false when stopped or when the engine fails. ensureVoices() → the number of English
     voices (waits up to 2 s once, then cached and refreshed on voiceschanged).
   · Routes: #/ (home: paints at once from index.json, then fills the counts, Continue and Up next in place as the units
     arrive; a unit that can't load is never skipped: Up next says so, with Try again), #/unit/uNN, #/progress, #/essays, #/essays/<id>, #/essays/<id>/revise[?blank=1], #/essays/<id>/compare,
     #/settings. The router looks ROUTES up at route time, so other files can add or wrap routes.
   · window.IE = {esc, md, ico, LS, isObj, data, band, bandRange, roundBand, fmtBand, prog, ui, uiSet, speak, stopSpeak,
     canSpeak, voices, ensureVoices, voiceTest, ROUTES, route, go, query, setTop, toast, KIND_T, when, words}.
     js/ielts-player.js adds IE.player (#/lesson/<lid>) and js/ielts-viz.js IE.viz (Task 1 visuals); IE.assess (self-marking,
     selfHtml(kind, cur, item) and wireSelf(el, kind, get, set, item)) is used by the revision page when it exists. */
(() => {
"use strict";
const W = window, D = document;
const IE = W.IE = W.IE || {};

/* ---------- helpers ---------- */
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
/* inline markup of the data: **bold** and *italic*, nothing else */
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>");
function ico(name, size = 22, cls = ""){
  const id = D.getElementById(`i-${name}-bold`) ? `i-${name}-bold` : `i-${name}-fill`;
  return `<svg class="ico${cls ? " " + cls : ""}" width="${size}" height="${size}" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><use href="#${id}"></use></svg>`;
}
const LS = {
  get(k, d = null){ try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} },
  keys(){ try{ return Object.keys(localStorage); }catch(e){ return []; } },
  raw(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  setRaw(k, s){ try{ localStorage.setItem(k, String(s)); return true; }catch(e){ return false; } },
};
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const $app = () => D.getElementById("app");
const words = t => (String(t || "").match(/[A-Za-z0-9’'-]+/g) || []).filter(w => /[A-Za-z0-9]/.test(w)).length;
const pad2 = n => String(n).padStart(2, "0");

let toastT = 0;
/* a short message at the bottom; long ones stay longer */
function toast(text, ms){
  let t = D.getElementById("ie-toast");
  if(!t){ t = D.createElement("div"); t.id = "ie-toast"; t.className = "ie-toast"; t.setAttribute("role", "status"); D.body.appendChild(t); }
  t.textContent = text; t.classList.add("is-on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("is-on"), ms || Math.max(2600, String(text).length * 55));
}

/* ---------- data ---------- */
let IDX = null, pIdx = null;
const UNITS = {}, pUnit = {};
const FETCH_MS = 10000;
const SLOW = "IELTS Prep took more than 10 seconds to load. Check the connection and try again.";
/* a JSON file of the course, given up after 10 s so a hung request never leaves the page blank */
async function getJSON(url){
  const ac = typeof AbortController === "function" ? new AbortController() : null;
  const dog = ac ? setTimeout(() => ac.abort(), FETCH_MS) : 0;
  try{
    let r;
    try{ r = await fetch(url, ac ? {signal: ac.signal} : undefined); }
    catch(e){ throw new Error(ac && ac.signal.aborted ? SLOW : "Couldn't load IELTS Prep. Check the connection and try again."); }
    if(!r.ok) throw new Error(`Couldn't load IELTS Prep (${r.status}).`);
    try{ return await r.json(); }
    catch(e){ throw new Error(ac && ac.signal.aborted ? SLOW : "IELTS Prep data is damaged."); }
  } finally { clearTimeout(dog); }
}
const data = {
  index(){
    if(IDX) return Promise.resolve(IDX);
    if(!pIdx) pIdx = getJSON("data/ielts/index.json").then(d => {
      if(!d || d.format !== 1 || !Array.isArray(d.units)) throw new Error("IELTS Prep data is damaged.");
      IDX = d; return d;
    }).catch(e => { pIdx = null; throw e; });
    return pIdx;
  },
  unit(id){
    if(!/^u\d{2}$/.test(String(id))) return Promise.reject(new Error(`No unit ${id}.`));
    if(UNITS[id]) return Promise.resolve(UNITS[id]);
    if(!pUnit[id]) pUnit[id] = getJSON(`data/ielts/${id}.json`).then(u => {
      if(!u || u.format !== 1 || u.id !== id || !Array.isArray(u.lessons)) throw new Error("IELTS Prep data is damaged.");
      UNITS[id] = u; return u;
    }).catch(e => { delete pUnit[id]; throw e; });
    return pUnit[id];
  },
  async lesson(lid){
    const m = /^(u\d{2})-l\d+$/.exec(String(lid)); if(!m) return null;
    const u = await data.unit(m[1]);
    const l = u.lessons.find(x => x.id === lid);
    return l ? {lesson: l, unit: u} : null;
  },
  /* a top-level item of a lesson ("u13-l2-i2" lives in lesson "u13-l2"), or null */
  async item(iid){
    const m = /^(u\d{2}-l\d+)-i\d+$/.exec(String(iid || "")); if(!m) return null;
    let f = null; try{ f = await data.lesson(m[1]); }catch(e){ return null; }
    return f && f.lesson && Array.isArray(f.lesson.items) ? f.lesson.items.find(x => x.id === iid) || null : null;
  },
  avail: () => IDX ? IDX.units.filter(u => u.available) : [],
  row: id => IDX ? IDX.units.find(u => u.id === id) || null : null,
  block: id => IDX ? IDX.blocks.find(b => b.id === id) || null : null,
};

/* ---------- bands ---------- */
/* the usual Academic conversion, approximate: cut-offs vary slightly between test versions. ielts.org publishes only
   some anchors (Listening 16 = 5, 23 = 6, 30 = 7, 35 = 8; Academic Reading 15 = 5, 23 = 6, 30 = 7, 35 = 8) */
const TABLES = {
  listening: [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]],
  reading: [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]],
};
function bandRaw(skill, raw){
  const t = TABLES[skill]; if(!t) return null;
  const r = Math.round(Math.max(0, Math.min(40, raw)));
  for(const [min, b] of t) if(r >= min) return b;
  return r > 0 ? 2 : 0;
}
/* the band for a raw score; shorter tests are scaled to 40 questions */
function band(skill, got, total){ return TABLES[skill] && total > 0 ? bandRaw(skill, got * 40 / total) : null; }
/* the likely range: one standard error of a proportion, on 40 marks. A perfect (or empty) score on few questions
   isn't certain, so p is pulled half a mark in for the error only */
function bandRange(skill, got, n){
  if(!TABLES[skill] || !(n > 0)) return null;
  const p = got / n, q = p > 0 && p < 1 ? p : (got + .5) / (n + 1);
  const se = Math.sqrt(q * (1 - q) / n) * 40;
  return [bandRaw(skill, p * 40 - se), bandRaw(skill, p * 40 + se)];
}
/* the overall band: the mean, to the nearest half band (.25 goes up to .5 and .75 to the next band) */
function roundBand(x){ if(!(x >= 0)) return null; const f = Math.floor(x), r = x - f; return r < .25 ? f : r < .75 ? f + .5 : f + 1; }
const fmtBand = b => b == null ? "–" : (b % 1 ? b.toFixed(1) : String(b));

/* ---------- progress ---------- */
const PK = "ielts:data", ESSAY_MAX = 1000, TEST_MAX = 500, SPEAK_MAX = 500, DAY = 864e5, REDO_DAYS = 60;
const SK = ["listening", "reading", "writing", "speaking"];
const FULL = "Storage is full: download your data in Settings › Your data, then erase old results.";
const NEWER = "Update the app to see your progress.";
const NEWER_ERASE = "Update the app first: this device holds progress from a newer version.";
let RO = false, NEWV = false, roAt = -1e9, roShown = false, bakTried = null;
const fresh = () => ({v: 1, lessons: {}, tests: [], essays: [], speaking: []});
function shape(d){
  if(!isObj(d.lessons)) d.lessons = {};
  for(const k of ["tests", "essays", "speaking"]) d[k] = Array.isArray(d[k]) ? d[k].filter(isObj) : [];
  return d;
}
function warnNewer(again){ if((!roShown || again) && Date.now() - roAt > 4000){ roShown = true; roAt = Date.now(); toast(NEWER, 5000); } }
/* v1 passes through; a newer version's blob is left alone (read-only); anything else is damaged (null) */
function migrate(o){
  if(isObj(o) && o.v === 1) return o;
  if(isObj(o) && typeof o.v === "number" && o.v > 1){ RO = NEWV = true; warnNewer(); return fresh(); }
  return null;
}
/* a copy of a damaged blob before starting again (once: the same text is never copied twice) */
function backupRaw(raw){
  for(const k of LS.keys()) if(k.startsWith(PK + ":bak-") && LS.raw(k) === raw) return true;
  return LS.setRaw(`${PK}:bak-${Date.now()}`, raw);
}
function pget(){
  const raw = LS.raw(PK);
  if(raw == null) return fresh();
  let o, ok = true; try{ o = JSON.parse(raw); }catch(e){ ok = false; }
  const d = ok ? migrate(o) : null;
  if(d) return shape(d);
  if(bakTried !== raw){ bakTried = raw; if(!backupRaw(raw)){ RO = true; toast(FULL, 7000); } }   /* couldn't keep a copy: never overwrite it */
  return fresh();
}
function trimmed(d){
  if(d.tests.length <= TEST_MAX && d.essays.length <= ESSAY_MAX && d.speaking.length <= SPEAK_MAX) return d;
  return Object.assign({}, d, {tests: d.tests.slice(-TEST_MAX), essays: d.essays.slice(-ESSAY_MAX), speaking: d.speaking.slice(-SPEAK_MAX)});
}
/* saves; only if the browser refuses does it keep the newest within the caps (and always says so) */
function pset(d){
  if(RO){ warnNewer(true); return false; }
  if(LS.set(PK, d)) return true;
  const t = trimmed(d), ok = t !== d && LS.set(PK, t);
  toast(FULL, 7000);
  return ok;
}
/* attempt and counted for every test (old records without them get them from their order) */
function normTests(list){
  const seen = {}, last = {};
  return list.filter(isObj).map(t => {
    const k = String(t.lid); seen[k] = (seen[k] || 0) + 1;
    const r = Object.assign({}, t);
    if(!(r.attempt >= 1)) r.attempt = seen[k];
    if(typeof r.counted !== "boolean") r.counted = (r.attempt === 1 || (last[k] != null && (+r.at || 0) - last[k] >= REDO_DAYS * DAY)) && !r.paused && !r.noaudio;
    last[k] = +r.at || 0;
    return r;
  });
}
function lrInfo(tests, skill){
  const all = tests.filter(t => t.skill === skill && t.band != null && t.total > 0);
  if(!all.length) return null;
  const mk = (got, n, b, uncounted) => ({band: b, n, got, range: bandRange(skill, got, n) || [b, b], uncounted});
  const c = all.filter(t => t.counted).reverse();
  if(!c.length){ const t = all[all.length - 1]; return mk(t.got, t.total, t.band, true); }
  if(c[0].total >= 40) return mk(c[0].got, c[0].total, c[0].band, false);
  let g = 0, n = 0;
  for(const t of c){ g += +t.got || 0; n += +t.total; if(n >= 40) break; }
  return mk(g, n, band(skill, g, n), false);
}
function wInfo(es){
  const marked = es.filter(e => e.band != null), first = marked.filter(e => !e.parent);
  const use = (first.length ? first : marked).slice(-2); if(!use.length) return null;
  const t2 = use.filter(e => e.task === 2).pop(), t1 = use.filter(e => e.task === 1).pop();
  const b = t1 && t2 ? roundBand((t1.band + 2 * t2.band) / 3) : (t2 || t1).band;
  return {band: b, n: t1 && t2 ? 2 : 1, range: [b, b], uncounted: !first.length, est: true};
}
function sInfo(sp){ const s = sp.filter(x => x.band != null).pop(); return s ? {band: s.band, n: 1, range: [s.band, s.band], uncounted: false, est: true} : null; }
const chainKey = e => e.parent || e.id;
function chainOf(list, e){ const k = chainKey(e); return list.filter(x => chainKey(x) === k).sort((a, b) => (a.v || 1) - (b.v || 1) || (a.at || 0) - (b.at || 0)); }
const stamp = o => isObj(o) ? +(o.at || o.updated || o.saved || 0) || 0 : 0;
const BK_SKIP = k => k === "ielts:on" || k.startsWith("ielts:run:");
function mergeData(cur, inc, n){
  const out = Object.assign({}, inc, cur, {v: 1});   /* fields this core doesn't know: this device's copy wins */
  out.lessons = Object.assign({}, cur.lessons);
  for(const [lid, r] of Object.entries(isObj(inc.lessons) ? inc.lessons : {})){
    if(!isObj(r)) continue; const c = out.lessons[lid];
    if(!c || (+r.at || 0) > (+c.at || 0)){ out.lessons[lid] = r; n.lessons++; }
  }
  const arr = v => Array.isArray(v) ? v.filter(isObj) : [];
  const union = (a, b, key, cnt) => {
    const m = new Map(); for(const x of a) m.set(key(x), x);
    for(const x of b) if(!m.has(key(x))){ m.set(key(x), x); n[cnt]++; }
    return [...m.values()].sort((x, y) => (+x.at || 0) - (+y.at || 0));
  };
  out.tests = union(cur.tests, arr(inc.tests), t => `${t.lid}|${t.at}`, "tests");
  /* two devices may each hold a first attempt: number them again in time order */
  if(n.tests) out.tests = normTests(out.tests.map(t => { const r = Object.assign({}, t); delete r.attempt; delete r.counted; return r; }));
  const es = new Map(cur.essays.map(e => [e.id, e]));
  for(const e of arr(inc.essays)){ const c = es.get(e.id); if(!c || (+e.at || 0) > (+c.at || 0)){ es.set(e.id, e); n.essays++; } }
  out.essays = [...es.values()].sort((x, y) => (+x.at || 0) - (+y.at || 0));
  out.speaking = union(cur.speaking, arr(inc.speaking), s => `${s.iid || s.title || ""}|${s.at}`, "speaking");
  return out;
}
const prog = {
  get: pget,
  readOnly: () => (pget(), RO),
  lesson: lid => pget().lessons[lid] || null,
  done(lid, rec){
    const d = pget(), old = d.lessons[lid] || {};
    const r = Object.assign({}, old, rec, {done: true, at: Date.now()});
    if(old.band != null && rec.band != null) r.best = Math.max(old.best || old.band, rec.band);
    d.lessons[lid] = r; pset(d); return r;
  },
  /* stores a timed test with its attempt number and whether it counts for the bands; returns the stored record */
  addTest(t){
    const d = pget(), at = +(t && t.at) || Date.now();
    const prev = normTests(d.tests).filter(x => x.lid === t.lid), last = prev[prev.length - 1];
    const attempt = prev.length + 1;
    const counted = (attempt === 1 || (!!last && at - (+last.at || 0) >= REDO_DAYS * DAY)) && !t.paused && !t.noaudio;
    const rec = Object.assign({}, t, {at, attempt, counted});
    d.tests.push(rec); pset(d); return rec;
  },
  tests: () => normTests(pget().tests),
  /* deletes one result and numbers the other attempts of that lesson again (deleting an accidental first attempt makes
     the next one the first, and it counts); paused and no-sound results still don't count */
  delTest(lid, at){
    const d = pget(), i = d.tests.findIndex(t => t.lid === lid && +t.at === +at);
    if(i < 0) return false;
    d.tests.splice(i, 1);
    d.tests = normTests(d.tests.map(t => { if(!isObj(t) || t.lid !== lid) return t; const r = Object.assign({}, t); delete r.attempt; delete r.counted; return r; }));
    return pset(d);
  },
  addEssay(e){
    const d = pget(), rec = Object.assign({at: Date.now()}, e);
    d.essays = d.essays.filter(x => x.id !== e.id); d.essays.push(rec); pset(d); return rec;
  },
  essay: id => pget().essays.find(x => x.id === id) || null,
  /* the versions of a piece of writing, version 1 first */
  chain(id){ const es = pget().essays, e = es.find(x => x.id === id); return e ? chainOf(es, e) : []; },
  addSpeaking(s){ const d = pget(); d.speaking.push(Object.assign({at: Date.now()}, s)); pset(d); },
  /* per skill: {band, n (questions behind it), range: [lo, hi], uncounted, est (your own estimate)} or null */
  latestInfo(){
    const d = pget(), ts = normTests(d.tests);
    return {listening: lrInfo(ts, "listening"), reading: lrInfo(ts, "reading"), writing: wInfo(d.essays), speaking: sInfo(d.speaking)};
  },
  /* the latest band of each skill */
  latest(){ const i = prog.latestInfo(), o = {}; for(const k of SK) o[k] = i[k] ? i[k].band : null; return o; },
  /* {band, skills, partial}: with a skill missing, the mean of the others is only an estimate */
  overallInfo(){
    const l = prog.latest(), v = SK.map(k => l[k]).filter(x => x != null);
    return {band: v.length ? roundBand(v.reduce((a, b) => a + b, 0) / v.length) : null, skills: v.length, partial: v.length < 4};
  },
  overall(){ const o = prog.overallInfo(); return o.partial ? null : o.band; },
  /* erases this device's progress; never a newer version's data (the learner only sees it empty until the app updates) */
  erase(){
    pget(); if(NEWV) return false;
    for(const k of LS.keys()) if(k.startsWith("ielts:") && k !== "ielts:on" && k !== "ielts:ui") LS.del(k);
    return true;
  },
  /* the data on this device was written by a newer version of the app */
  newer: () => (pget(), NEWV),
  /* every ielts:* key except the switch and the lessons in progress, for a file */
  backup(){
    const keys = {};
    for(const k of LS.keys().sort()) if(k.startsWith("ielts:") && !BK_SKIP(k)){
      const raw = LS.raw(k); if(raw == null) continue;
      try{ keys[k] = JSON.parse(raw); }catch(e){ keys[k] = raw; }
    }
    return {app: "ielts-prep", format: 1, saved: new Date().toISOString(), keys};
  },
  /* merges a backup into this device: {lessons, tests, essays, speaking, other} added, or {error} */
  restore(f){
    if(prog.readOnly()) return {error: NEWER};
    const keys = isObj(f) && isObj(f.keys) ? f.keys : isObj(f) && f.v === 1 && isObj(f.lessons) ? {[PK]: f} : null;
    if(!keys) return {error: "That file isn't an IELTS Prep backup."};
    const inc = keys[PK];
    if(inc != null && !(isObj(inc) && inc.v === 1)) return {error: isObj(inc) && inc.v > 1 ? "That file comes from a newer version of the app: update the app first." : "The results in that file are damaged."};
    const n = {lessons: 0, tests: 0, essays: 0, speaking: 0, other: 0};
    if(inc){ const m = mergeData(pget(), shape(Object.assign({}, inc)), n); if((n.lessons || n.tests || n.essays || n.speaking) && !pset(m)) return {error: FULL}; }
    for(const [k, v] of Object.entries(keys)){
      if(k === PK || !k.startsWith("ielts:") || BK_SKIP(k)) continue;
      if(k === "ielts:study" || k === UIK){ const c = LS.get(k); if(c == null || stamp(v) > stamp(c)){ if(LS.set(k, v)) n.other++; } continue; }
      if(LS.raw(k) == null && (typeof v === "string" && k.startsWith(PK + ":bak-") ? LS.setRaw(k, v) : LS.set(k, v))) n.other++;
    }
    return n;
  },
};

/* ---------- voice (the browser's English voices, by accent) ---------- */
const UIK = "ielts:ui";
const ui = () => { const o = LS.get(UIK); return isObj(o) ? o : {}; };
const uiSet = p => LS.set(UIK, Object.assign(ui(), p, {at: Date.now()}));
const canSpeak = () => { try{ return !!W.speechSynthesis && typeof W.SpeechSynthesisUtterance === "function"; }catch(e){ return false; } };
const rx = s => new RegExp(`\\b(${s})\\b`, "i");
const FEM = rx("female|google us english(?! male)|serena|kate|stephanie|martha|libby|sonia|maisie|hazel|susan|fiona|amy|emma|olivia|alice|mia|bella|abbi|hollie|"
  + "samantha|allison|ava|zoe|nicky|joelle|noelle|victoria|zira|jenny|aria|michelle|monica|nancy|sara|amber|ashley|cora|elizabeth|jane|ana|"
  + "karen|catherine|natasha|matilda|annette|carly|elsie|freya|joanne|kim|tina|molly|moira|emily|tessa|leah|clara|linda|heera|neerja|veena|isha");
const MALE = rx("male|daniel|arthur|oliver|ryan|thomas|george|alfie|elliot|harry|ethan|noah|james|brian|guy|rishi|lee|aaron|fred|alex|"
  + "david|mark|tom|evan|nathan|christopher|eric|roger|steffan|andrew|davis|jacob|jason|tony|brandon|kai|"
  + "gordon|william|darren|duncan|ken|neil|tim|mitchell|connor|sean|luke|liam|richard|ravi|prabhat");
/* novelty, robotic and children's voices: never chosen while a real adult voice exists */
const ODD = rx("albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|fred|"
  + "kathy|princess|deranged|hysterical|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|maisie|ana");
const ACC = {gb: "en-gb", us: "en-us", ca: "en-ca", au: "en-au", nz: "en-nz", ie: "en-ie", za: "en-za"};
const ACC_T = {gb: "British", us: "American", ca: "Canadian", au: "Australian", nz: "New Zealand", ie: "Irish", za: "South African"};
const vcode = v => String(v && v.lang || "").replace(/_/g, "-").toLowerCase();
const isEn = v => /^en(-|$)/.test(vcode(v));
const isF = v => FEM.test(v.name || "") && !/\bmale\b/i.test(v.name || "");
const isM = v => MALE.test(v.name || "") && !FEM.test(v.name || "");
function allVoices(){ try{ return canSpeak() ? Array.from(speechSynthesis.getVoices() || []) : []; }catch(e){ return []; } }
/* the default woman and man of a pool (an unnamed voice serves both, told apart by pitch) */
function pair(p){
  const f = p.f[0] || p.all.find(v => !isM(v)) || p.all[0];
  const m = p.m[0] || p.all.find(v => v !== f && !isF(v)) || p.all.find(v => v !== f) || f;
  return {f, m};
}
let VOX = null, VCOUNT = null, pVox = null;
function pickVoices(){
  let en = allVoices().filter(isEn); if(!en.length) return null;
  const real = en.filter(v => !ODD.test(v.name || "")); if(real.length) en = real;
  en = en.slice().sort((x, y) => (y.localService ? 1 : 0) - (x.localService ? 1 : 0));
  const pool = list => ({all: list, f: list.filter(isF), m: list.filter(isM)});
  const acc = {};
  for(const [k, c] of Object.entries(ACC)){ const l = en.filter(v => vcode(v) === c || vcode(v).startsWith(c + "-")); if(l.length) acc[k] = pool(l); }
  const any = pool(en), pr = pair(acc.gb || any);
  return {f: pr.f, m: pr.m, gb: !!acc.gb, acc, any, n: en.length};
}
function voices(){ if(!VOX) VOX = pickVoices(); return VOX; }
if(canSpeak()) try{ speechSynthesis.addEventListener("voiceschanged", () => { VOX = pickVoices(); VCOUNT = VOX ? VOX.n : 0; }); }catch(e){}
/* how many English voices this device has: waits up to 2 s for them once, then answers at once */
function ensureVoices(){
  if(!canSpeak()) return Promise.resolve(0);
  if(VCOUNT != null) return Promise.resolve(VCOUNT);
  const n = allVoices().filter(isEn).length;
  if(n){ VCOUNT = n; return Promise.resolve(n); }
  if(!pVox) pVox = new Promise(res => {
    let t = 0;
    const fin = () => { clearTimeout(t); try{ speechSynthesis.removeEventListener("voiceschanged", on); }catch(e){} VOX = pickVoices(); VCOUNT = VOX ? VOX.n : 0; pVox = null; res(VCOUNT); };
    const on = () => { if(allVoices().some(isEn)) fin(); };
    try{ speechSynthesis.addEventListener("voiceschanged", on); }catch(e){}
    t = setTimeout(fin, 2000);
  });
  return pVox;
}
const accents = () => ui().accents === "gb" ? "gb" : "mixed";
/* the voice for a woman or a man with that accent: that accent, then British, then any English voice; alt picks the
   second or third voice of that kind when the device has one */
function pick(V, g, want, alt){
  const order = [...new Set([V.acc[want], V.acc.gb, V.any].filter(Boolean))];
  for(const p of order) if(p[g].length) return p[g][alt] || p[g][0];
  return pair(order[0])[g];
}
/* {voice, shift}: shift when one voice has to serve both, or the other sex (then the pitch tells them apart) */
function choose(g, accent, alt){
  const V = voices(); if(!V) return null;
  const want = accents() === "gb" || !ACC[accent] ? "gb" : accent;
  const voice = pick(V, g, want, alt), other = pick(V, g === "m" ? "f" : "m", want, 0);
  return {voice, shift: voice === other || (g === "m" ? isF(voice) : isM(voice))};
}
/* inside a timed test the recording always plays at exam speed */
function examNow(){
  const m = /^#\/lesson\/((u\d{2})-l\d+)(?:[/?]|$)/.exec(location.hash || ""); if(!m) return false;
  const u = UNITS[m[2]], l = u && u.lessons.find(x => x.id === m[1]);
  return !!l && l.kind === "test";
}
/* splits a long text into sentences of ≤ 220 characters: Chrome stops one long utterance after about 15 s */
function chunks(text){
  const out = [];
  for(const s of String(text).replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s+(?=[A-Z0-9"'“‘(])/)){
    if(s.length <= 220){ out.push(s); continue; }
    let cur = "";
    for(const part of s.split(/(?<=[,;:])\s+/)){ if((cur + " " + part).trim().length > 220 && cur){ out.push(cur); cur = part; } else cur = (cur + " " + part).trim(); }
    if(cur) out.push(cur);
  }
  return out.filter(Boolean);
}
const HARD = new Set(["synthesis-failed", "synthesis-unavailable", "audio-busy", "audio-hardware", "network", "not-allowed"]);
let speakGen = 0;
/* speaks text; resolves true at the end, false when stopped, impossible or when the engine fails */
function speak(text, o = {}){
  if(!canSpeak()) return Promise.resolve(false);
  const my = ++speakGen;
  try{ speechSynthesis.cancel(); }catch(e){}
  const g = o.voice === "m" ? "m" : "f", ch = choose(g, o.accent, Math.max(0, Math.min(2, Math.round(+o.alt || 0))));
  const parts = chunks(text), rate = (o.rate || (o.exam || examNow() ? 1 : ui().rate) || 1) * (o.slow ? .8 : 1);
  const pitch = Math.max(.5, Math.min(2, (ch && ch.shift ? (g === "m" ? .82 : 1.12) : 1) * (+o.pitch > 0 ? +o.pitch : 1)));
  return new Promise(res => {
    let i = 0;
    const next = () => {
      if(my !== speakGen) return res(false);
      if(i >= parts.length) return res(true);
      const u = new SpeechSynthesisUtterance(parts[i++]);
      const voice = ch && ch.voice;
      if(voice){ u.voice = voice; u.lang = voice.lang; } else u.lang = "en-GB";
      u.rate = rate; u.pitch = pitch;
      let done = false;
      const end = () => { if(done) return; done = true; clearTimeout(dog); setTimeout(next, o.gap == null ? 120 : o.gap); };
      /* some browsers never fire onend: a watchdog moves on after a generous time */
      const dog = setTimeout(end, 4000 + u.text.length * 110 / rate);
      u.onend = end;
      u.onerror = e => { if(done) return; if(e && HARD.has(e.error)){ done = true; clearTimeout(dog); res(false); } else end(); };
      try{ speechSynthesis.speak(u); try{ speechSynthesis.resume(); }catch(e){} }catch(e){ end(); }
    };
    setTimeout(next, 60);
  });
}
function stopSpeak(){ speakGen++; try{ if(canSpeak()) speechSynthesis.cancel(); }catch(e){} }
const NOVOICE = "No English voice on this device.";
const HOWTO = [["Android", "Settings › Text-to-speech"], ["Windows", "Settings › Time & language › Speech › Add voices"], ["iPhone and iPad", "Settings › Accessibility › Spoken Content › Voices"]];
const howtoText = () => `To add one: ${HOWTO.map(([p, s]) => `on ${p}, ${s}`).join("; ")}. Then open IELTS Prep again.`;
const howtoHtml = () => `<p class="t-head">${esc(NOVOICE)}</p><p class="t-note">Listening recordings need one. To add an English (UK) voice:</p>
  <ul class="ie-help">${HOWTO.map(([p, s]) => `<li><b>${esc(p)}:</b> ${esc(s)}</li>`).join("")}</ul><p class="t-note">Then open IELTS Prep again. Until then, Listening lessons show the transcript.</p>`;
/* the accents this device can play, in words */
function accentLine(V){
  if(!V) return "";
  const have = Object.keys(ACC).filter(k => V.acc[k]).map(k => ACC_T[k]);
  if(!have.length) return "This device has English voices, but none with a British, North American, Australian, New Zealand, Irish or South African accent.";
  if(have.length === 7) return `This device can play every accent: ${have.join(", ")}.`;
  return `This device can play ${have.join(", ")}; others fall back to ${V.gb ? "British" : "another English voice"}.`;
}
async function voiceTest(){
  if(!canSpeak()){ toast(`This browser can't speak. ${NOVOICE} ${howtoText()}`, 12000); return 0; }
  const n = await ensureVoices();
  if(!n){
    toast(`${NOVOICE} ${howtoText()}`, 12000);
    return 0;
  }
  const V = voices(), other = accents() === "mixed" ? Object.keys(ACC).find(k => k !== "gb" && V.acc[k]) : null;
  speak("Good morning. My name is Claire, and I'll be your examiner today.", {voice: "f"})
    .then(ok => ok && speak("Thank you. Could you tell me your full name, please?", {voice: "m"}))
    .then(ok => ok && other && speak("In the Listening test, you'll also hear speakers from other English-speaking countries.", {voice: "f", accent: other}));
  if(!V.gb) toast("No British voice on this device: using another English voice.");
  return n;
}

/* ---------- router ---------- */
const ROUTES = {};
const hashPath = () => String(location.hash || "").replace(/^#\/?/, "").split("?")[0];
const parts = () => hashPath().split("/").map(s => { try{ return decodeURIComponent(s); }catch(e){ return s; } });
const query = () => new URLSearchParams(String(location.hash || "").split("?").slice(1).join("?"));
function go(h){ if(location.hash === h) route(); else location.hash = h; }
let leaving = null, routeGen = 0;
async function route(){
  const gen = ++routeGen;
  delete $app().dataset.ready;
  if(typeof leaving === "function"){ try{ leaving(); }catch(e){ console.error(e); } leaving = null; }
  stopSpeak();
  const [name, ...rest] = parts();
  const f = ROUTES[name || "home"] || ROUTES.home;
  const a = $app();
  try{ await data.index(); }catch(e){ if(gen === routeGen){ a.innerHTML = fail(e.message); a.dataset.ready = location.hash || "#/"; } return; }
  if(gen !== routeGen) return;
  try{ const r = await f(rest, a); if(typeof r === "function"){ if(gen === routeGen) leaving = r; else try{ r(); }catch(e){} } }
  catch(e){ console.error(e); if(gen === routeGen) a.innerHTML = fail(e.message); }
  if(gen !== routeGen) return;
  if(!D.activeElement || D.activeElement === D.body) a.focus({preventScroll: true});
  a.dataset.ready = location.hash || "#/";   /* painted (the tests wait for it) */
}
const fail = msg => `<div class="ie-page"><div class="card ie-card ie-empty">${ico("warning-circle", 40)}<h2 class="t-3">Something went wrong</h2>
  <p class="t-sub">${esc(msg)}</p><a class="glass-btn glass-btn--sm" href="#/">Back to IELTS Prep</a></div></div>`;
/* the short back label of a narrow screen ("Unit 17" → "U17"); the aria-label keeps the full one */
function shortLabel(t){
  const s = String(t || "Back"), m = /^Unit (\d+)$/.exec(s);
  return m ? `U${m[1]}` : ({"IELTS Prep": "Home", "My writing": "Writing", "My results": "Results"})[s] || (/^Task (\d)/.exec(s) ? `T${s[5]}` : s);
}
function setTop(o){
  const t = D.getElementById("ie-top");
  const bt = o.backT || "Back";
  const back = o.back ? `<a class="ie-back" href="${esc(o.back)}" aria-label="Back to ${esc(bt)}">${ico("caret-left", 22)}<span class="ie-back-l">${esc(bt)}</span><span class="ie-back-s" aria-hidden="true">${esc(o.backS || shortLabel(bt))}</span></a>`
    : `<a class="ie-back" href="./" aria-label="Back to languages">${ico("caret-left", 22)}<span class="ie-back-l">Languages</span><span class="ie-back-s" aria-hidden="true">Back</span></a>`;
  t.innerHTML = `${back}<span class="ie-top-t">${esc(o.title || "")}</span>${o.right || `<a class="ie-tbtn" href="#/settings" aria-label="Settings">${ico("gear-six", 22)}</a>`}`;
  D.title = o.title && o.title !== "IELTS Prep" ? `${o.title} – IELTS Prep` : "IELTS Prep";
}

/* ---------- pages ---------- */
const BLOCK_ICON = {start: "signpost", listening: "ear", reading: "book-open-text", writing: "pencil-simple", speaking: "chats-circle", language: "translate", mock: "timer"};
const SKILLS = [["listening", "Listening", "ear"], ["reading", "Reading", "book-open-text"], ["writing", "Writing", "pencil-simple"], ["speaking", "Speaking", "chats-circle"]];
const KIND_T = {learn: "Learn", practice: "Practice", test: "Timed test"};
const when = t => new Date(t).toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"});
function lessonCount(uid){ const u = UNITS[uid]; return u ? u.lessons.length : null; }
function doneCount(uid){ const p = pget().lessons; return Object.keys(p).filter(k => k.startsWith(uid + "-") && p[k] && p[k].done).length; }
/* lessons left half-way: started, not finished, with an answer or past the first item; the most recent first
   (run.at, else the furthest along the path) */
const RUN_RE = /^ielts:run:(u\d{2})-l(\d+)$/;
function openRuns(){
  const out = [];
  const filled = v => v != null && v !== "" && !(Array.isArray(v) && !v.length) && !(isObj(v) && !Object.keys(v).length);
  for(const k of LS.keys()){
    const m = RUN_RE.exec(k); if(!m) continue;
    const r = LS.get(k); if(!isObj(r) || !r.started || r.finished) continue;
    if(!(isObj(r.ans) && Object.values(r.ans).some(filled)) && !(r.i > 0)) continue;
    const ix = IDX ? IDX.units.findIndex(u => u.id === m[1]) : -1;
    out.push({lid: `${m[1]}-l${m[2]}`, uid: m[1], run: r, pos: (ix < 0 ? +m[1].slice(1) : ix) * 1000 + +m[2]});
  }
  return out.sort((x, y) => (+y.run.at || 0) - (+x.run.at || 0) || y.pos - x.pos);
}
function scoreTiles(){
  const info = prog.latestInfo(), ov = prog.overallInfo();
  const tile = ([k, t, ic]) => {
    const x = info[k];
    const sub = !x ? "Not yet" : x.est ? (x.uncounted ? "your estimate · a revision" : "your estimate")
      : `from ${x.n} question${x.n === 1 ? "" : "s"}${x.uncounted ? " · not counted" : ""}`;
    const rg = x && !x.est && x.range && x.range[0] !== x.range[1] ? `${fmtBand(x.range[0])}–${fmtBand(x.range[1])}` : "";
    return `<div class="ie-tile" data-skill="${k}">${ico(ic, 20)}<span class="ie-tile-t">${t}</span><b class="t-num">${fmtBand(x ? x.band : null)}</b>
      <small class="ie-tile-n">${esc(sub)}</small>${rg ? `<small class="ie-tile-r"><span class="vh">likely range </span>${rg}</small>` : ""}</div>`;
  };
  const head = !ov.partial ? `<b class="t-num">${fmtBand(ov.band)}</b>`
    : ov.skills ? `<span class="ie-ov-part">about <b class="t-num">${fmtBand(ov.band)}</b> from ${ov.skills} skill${ov.skills > 1 ? "s" : ""}</span>` : `<b class="t-num">–</b>`;
  const o = ov.band, miss = SKILLS.filter(([k]) => !info[k]).map(([, t]) => t);
  const note = !ov.skills ? "Take a timed test in each skill to see your overall band. Target: 8.5 or 9 (C2)."
    : ov.partial ? `Only an estimate until every skill has a band. Still to come: ${miss.join(", ").replace(/, ([^,]*)$/, " and $1")}. Target: 8.5 or 9 (C2).`
    : o >= 8.5 ? "That's C2 territory. Keep it steady across all four skills."
    : `Target: 8.5 or 9 (C2). ${o >= 7 ? "You're close: precision and consistency make the difference now." : "Work through the path in order."}`;
  return `<section class="card ie-card ie-scores" aria-labelledby="ie-sc-h">
    <div class="ie-sc-head"><h2 class="t-head" id="ie-sc-h">Your bands</h2><span class="ie-overall"><small>Overall</small>${head}</span></div>
    <div class="ie-tiles">${SKILLS.map(tile).join("")}</div>
    <p class="t-note">${esc(note)}</p>
    <p class="t-min">Listening and Reading come from your timed tests: the more questions behind a band, the narrower its likely range. A repeat within 60 days, a paused test and a recording played without sound don't count. Writing and Speaking are your own estimates against the criteria.</p></section>`;
}
/* the first lesson not done (and not the one in progress), once the units before it have arrived: undefined = not yet
   known, {failed: row} = a unit before it couldn't load (it may hold the next lesson, so it is never skipped),
   null = every lesson done (every unit loaded), false = nothing left but the lesson in progress.
   settled(id) is true once that unit has arrived or failed; a settled unit missing from UNITS failed */
function findNext(settled, skip){
  const p = pget().lessons; let skipped = false;
  for(const r of data.avail()){
    if(!settled(r.id)) return undefined;
    const u = UNITS[r.id]; if(!u) return {failed: r};
    const l = u.lessons.find(x => !(p[x.id] && p[x.id].done) && !(x.id === skip && (skipped = true)));
    if(l) return {lesson: l, unit: u};
  }
  return skipped ? false : null;
}
/* the first lesson not done; a unit that can't load rejects (it is never taken for a unit with nothing left) */
async function nextLesson(){
  const p = pget().lessons;
  for(const r of data.avail()){
    const u = await data.unit(r.id);
    const l = u.lessons.find(x => !(p[x.id] && p[x.id].done));
    if(l) return {lesson: l, unit: u};
  }
  return null;
}
const cntHtml = (uid, busy) => { const n = lessonCount(uid), bits = []; if(n) bits.push(`${doneCount(uid)} of ${n} lessons`); if(busy) bits.push("In progress"); return bits.length ? esc(bits.join(" · ")) : "&nbsp;"; };
function unitRow(r, busy){
  const n = lessonCount(r.id), full = n && doneCount(r.id) >= n;
  return r.available ? `<a class="ie-row" href="#/unit/${r.id}" data-u="${r.id}"><span class="ie-num t-num${full ? " is-done" : ""}">${full ? ico("check", 18) : r.n}</span>
      <span class="ie-row-t">${esc(r.title)}<small class="ie-cnt">${cntHtml(r.id, busy)}</small></span>${ico("caret-right", 18, "ie-chev")}</a>`
    : `<div class="ie-row is-soon" data-u="${r.id}"><span class="ie-num t-num">${r.n}</span><span class="ie-row-t">${esc(r.title)}<small>Coming soon</small></span></div>`;
}
const waitNext = () => `<div class="card ie-card ie-next is-wait" id="ie-next" aria-busy="true"><span class="ie-next-k">Up next</span><span class="ie-skel" aria-hidden="true"></span><span class="t-note">Loading the course…</span></div>`;
function nextHtml(nx){
  if(!nx && nx !== null) return "";
  if(nx.failed) return `<div class="card ie-card ie-next is-fail" id="ie-next" data-done="1" role="alert"><span class="ie-next-k">Up next</span>
    <span class="t-3">Couldn't load Unit ${esc(nx.failed.n)}.</span><span class="t-note">Check the connection.</span>
    <button type="button" class="glass-btn glass-btn--sm ie-next-b" data-retry>${ico("arrow-counter-clockwise", 18)}Try again</button></div>`;
  if(nx === null) return data.avail().length ? `<div class="card ie-card" id="ie-next" data-done="1"><h2 class="t-3">You've done every lesson</h2><p class="t-sub">Repeat the mock tests under exam conditions, a week apart.</p></div>` : "";
  const {lesson: l, unit: u} = nx, test = l.kind === "test";
  return `<a class="card ie-card ie-next" id="ie-next" data-done="1" href="#/lesson/${l.id}"><span class="ie-next-k">${doneCount(u.id) || Object.keys(pget().lessons).length ? "Up next" : "Start here"}</span>
    <span class="t-3">${esc(l.title)}</span><span class="t-note">Unit ${u.n} · ${esc(u.title)} · ${l.minutes} min${test ? " · timed" : ""}</span>
    <span class="glass-btn glass-btn--pri glass-btn--sm ie-next-b">${ico("play", 18)}${test ? "Start the test" : "Start"}</span></a>`;
}
function contInner(c){
  const u = UNITS[c.uid], L = u && u.lessons.find(x => x.id === c.lid), r = c.run;
  if(!L) return `<span class="ie-next-k">Continue</span><span class="t-3">Your lesson in progress</span><span class="t-note">&nbsp;</span>
    <span class="glass-btn glass-btn--pri glass-btn--sm ie-next-b">${ico("play", 18)}Continue</span>`;
  const test = L.kind === "test", left = test ? (+L.timed || 0) - (+r.el || 0) / 1000 : 0;
  const leftT = left <= 0 ? "time's up" : left < 60 ? "under a minute left" : `${Math.floor(left / 60)} min left`;
  const where = test ? leftT : `${Math.min((+r.i || 0) + 1, L.items.length)} of ${L.items.length}`;
  return `<span class="ie-next-k">Continue</span><span class="t-3">${esc(L.title)}</span>
    <span class="t-note">Unit ${u.n} · ${esc(u.title)} · <b class="ie-left">${esc(where)}</b></span>
    <span class="glass-btn glass-btn--pri glass-btn--sm ie-next-b">${ico("play", 18)}${test ? "Resume the test" : "Continue"}</span>`;
}
ROUTES.home = async (_, a) => {
  setTop({title: "IELTS Prep"});
  const ix = await data.index(), av = data.avail(), gen = routeGen;
  const runs = openRuns(), cont = runs[0] || null, busy = new Set(runs.map(r => r.uid));
  const settled = id => !!UNITS[id], nx = findNext(settled, cont && cont.lid);
  const blocks = ix.blocks.map(b => {
    const rows = ix.units.filter(u => u.block === b.id);
    return `<section class="ie-block" aria-labelledby="ie-b-${b.id}"><h2 class="ie-bh" id="ie-b-${b.id}">${ico(BLOCK_ICON[b.id] || "circle", 20)}${esc(b.title)}</h2>
      <div class="card ie-list">${rows.map(r => unitRow(r, busy.has(r.id))).join("")}</div></section>`;
  }).join("");
  /* the first paint needs only index.json and this device's data */
  a.innerHTML = `<div class="ie-page">
    <header class="ie-hero"><h1 class="t-lt">IELTS Prep</h1><p class="t-sub">Academic · aiming for band 8.5–9 (C2)</p></header>
    ${cont ? `<a class="card ie-card ie-next ie-cont" id="ie-cont" href="#/lesson/${cont.lid}">${contInner(cont)}</a>` : ""}
    ${nx === undefined ? waitNext() : nextHtml(nx)}
    ${scoreTiles()}
    ${blocks}
    <nav class="ie-foot"><a class="glass-btn glass-btn--sm" href="#/progress">${ico("list-checks", 18)}My results</a><a class="glass-btn glass-btn--sm" href="#/essays">${ico("notebook", 18)}My writing</a></nav>
  </div>`;
  fillHome(a, gen, av, cont, busy);
};
/* then each unit fills its row, the Continue card and Up next in place, as it arrives (never all of #app again).
   done = the units settled, loaded or failed; failed ones stay out of UNITS, so findNext stops at them */
function fillHome(a, gen, av, cont, busy){
  const done = new Set(av.filter(r => UNITS[r.id]).map(r => r.id));
  const live = () => gen === routeGen && a.isConnected;
  const nextNow = () => {
    const slot = a.querySelector("#ie-next:not([data-done])"); if(!slot) return;
    const nx = findNext(id => done.has(id), cont && cont.lid); if(nx === undefined) return;
    const h = nextHtml(nx); if(!h){ slot.remove(); return; }
    const n = D.createElement("div"); n.innerHTML = h; const el = n.firstElementChild; slot.replaceWith(el);
    const rt = el.querySelector("[data-retry]"); if(rt) rt.onclick = () => go("#/");
  };
  const settle = id => {
    done.add(id); if(!live()) return;
    const row = a.querySelector(`.ie-row[data-u="${id}"]`), n = lessonCount(id);
    if(row){
      const c = row.querySelector(".ie-cnt"); if(c) c.innerHTML = cntHtml(id, busy.has(id));
      const num = row.querySelector(".ie-num"), full = n && doneCount(id) >= n;
      if(num && full && !num.classList.contains("is-done")){ num.classList.add("is-done"); num.innerHTML = ico("check", 18); }
    }
    if(cont && cont.uid === id){
      const el = a.querySelector("#ie-cont");
      if(el){ const L = UNITS[id] && UNITS[id].lessons.find(x => x.id === cont.lid); if(UNITS[id] && !L) el.remove(); else el.innerHTML = contInner(cont); }
    }
    nextNow();
  };
  for(const r of av) if(!UNITS[r.id]) data.unit(r.id).then(() => settle(r.id), () => settle(r.id));
  nextNow();
}
ROUTES.unit = async ([id], a) => {
  const r = data.row(id);
  if(!r || !r.available) throw new Error("This unit isn't ready yet.");
  const u = await data.unit(id), p = pget().lessons, open = new Set(openRuns().map(x => x.lid));
  setTop({title: `Unit ${u.n}`, back: "#/", backT: "IELTS Prep"});
  a.innerHTML = `<div class="ie-page">
    <header class="ie-hero"><p class="ie-kicker">${ico(BLOCK_ICON[u.block] || "circle", 18)}${esc((data.block(u.block) || {}).title || "")} · Unit ${u.n}</p>
      <h1 class="t-1">${esc(u.title)}</h1><p class="t-sub">${md(u.summary)}</p></header>
    <div class="card ie-list">${u.lessons.map((l, i) => {
      const rec = p[l.id];
      const res = rec && rec.done ? (rec.band != null ? `Band ${fmtBand(rec.band)}` : rec.total ? `${rec.got} of ${rec.total}` : "Done") : "";
      const bits = [KIND_T[l.kind] || "", `${l.minutes} min`, res, open.has(l.id) ? "In progress" : ""].filter(Boolean).join(" · ");
      return `<a class="ie-row" href="#/lesson/${l.id}" data-l="${l.id}"><span class="ie-num t-num${rec && rec.done ? " is-done" : ""}">${rec && rec.done ? ico("check", 18) : i + 1}</span>
        <span class="ie-row-t">${esc(l.title)}<small>${esc(bits)}</small></span>
        ${l.kind === "test" ? `<span class="ie-pill">${ico("timer", 16)}${Math.round(l.timed / 60)} min</span>` : ""}${ico("caret-right", 18, "ie-chev")}</a>`;
    }).join("")}</div>
  </div>`;
};
const skillT = s => s ? String(s)[0].toUpperCase() + String(s).slice(1) : "";
ROUTES.progress = async (_, a) => {
  setTop({title: "My results", back: "#/", backT: "IELTS Prep"});
  const paint = focusAt => {
    const d = pget(), ts = normTests(d.tests).reverse();
    const tag = t => t.counted ? (t.attempt > 1 ? `<span class="ie-tag is-ok">Repeat after 60 days: counted</span>` : "")
      : `<span class="ie-tag">${t.paused ? "Clock paused: not counted" : t.noaudio ? "No sound: not counted" : t.attempt > 1 ? "Repeat: not counted" : "Not counted"}</span>`;
    const rows = ts.map((t, i) => `<div class="ie-row" data-test="${i}"><span class="ie-num t-num">${fmtBand(t.band)}</span>
      <span class="ie-row-t">${esc(t.title || t.lid)}<small>${esc(skillT(t.skill))} · ${t.got} of ${t.total} · ${when(t.at)}</small>${tag(t)}</span>
      <button type="button" class="ie-del" data-del="${i}" aria-label="Delete this result: ${esc(t.title || t.lid)}, ${when(t.at)}">${ico("trash", 20)}</button></div>`).join("");
    const sp = d.speaking.slice().reverse().slice(0, 20).map(s => `<div class="ie-row"><span class="ie-num t-num">${fmtBand(s.band)}</span>
      <span class="ie-row-t">${esc(s.title || "Speaking")}<small>Your estimate · ${when(s.at)}</small></span></div>`).join("");
    a.innerHTML = `<div class="ie-page">${scoreTiles()}
      <section class="ie-block"><h2 class="ie-bh" id="ie-tests-h" tabindex="-1">${ico("timer", 20)}Timed tests</h2>${rows ? `<div class="card ie-list">${rows}</div>
        <p class="t-min ie-pad">Delete a result you didn't mean to keep, such as a test you finished by mistake or one that ran out of time.</p>` : `<p class="t-sub ie-pad">No timed tests yet. Every unit ends with one.</p>`}</section>
      <section class="ie-block"><h2 class="ie-bh">${ico("chats-circle", 20)}Speaking</h2>${sp ? `<div class="card ie-list">${sp}</div>` : `<p class="t-sub ie-pad">No speaking marked yet.</p>`}</section></div>`;
    a.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
      const t = ts[+b.dataset.del]; if(!t) return;
      if(!confirm(`Delete this result (${t.title || t.lid}, ${when(t.at)})? Your bands will be worked out again without it.`)) return;
      if(prog.delTest(t.lid, t.at)){ toast("Result deleted."); paint(+b.dataset.del); }
    });
    if(focusAt != null){ const bs = a.querySelectorAll("[data-del]"), f = bs[Math.min(focusAt, bs.length - 1)] || a.querySelector("#ie-tests-h"); if(f) f.focus(); }
  };
  paint();
};

/* ---------- my writing: versions and revision ---------- */
/* which check a message of IE.player.writingChecks() is: each pattern is anchored to the start of the message, and
   repetition goes first, because "Repeated: “position” ×5" quotes the learner's own words */
const CK = [["repeat", /^(Repeated:|No word is overused)/, "Repetition"], ["words", /^\d+ words?:/, "Length"], ["paras", /^\d+ paragraphs?[.:]/, "Paragraphs"],
  ["overview", /^(There['’]s an overview|No clear overview)/, "Overview"], ["opinion", /^Task 1 reports data/, "No opinions in Task 1"],
  ["position", /^(Your position|Make your position)/, "Clear position"], ["linking", /^(\d+ sentence-opening linkers|Linking isn['’]t)/, "Linking"],
  ["cliche", /^Memorised/, "Memorised phrases"], ["contractions", /^Contractions/, "Contractions"], ["sentences", /^(\d+ sentences? over|Sentences average)/, "Sentences"]];
const ckey = c => (CK.find(([, re]) => re.test(c.t)) || [c.t])[0];
const cname = k => (CK.find(x => x[0] === k) || [0, 0, k])[2];
function checksOf(text, it, e){
  const P = IE.player; if(!P || typeof P.writingChecks !== "function") return null;
  try{ return P.writingChecks(text, it || {task: e.task, minWords: e.task === 1 ? 150 : 250}); }catch(err){ console.error(err); return null; }
}
const checksList = c => `<ul class="ie-checks">${c.map(x => `<li class="${x.ok ? "is-ok" : "is-miss"}">${ico(x.ok ? "check-circle" : "warning-circle", 18)}<span>${esc(x.t)}</span></li>`).join("")}</ul>`;
const paras = t => String(t || "").split(/\n\s*\n|\n/).filter(s => s.trim()).map(p => `<p>${esc(p)}</p>`).join("");
const modelHtml = (m, open = true) => `<details class="ie-model"${open ? " open" : ""}><summary class="t-head">${ico("seal-check", 18)}Band 9 model · ${words(m.text.join("\n"))} words</summary>
  <div class="ie-mtext">${m.text.map(p => `<p>${md(p)}</p>`).join("")}</div>
  <button type="button" class="glass-btn glass-btn--sm" data-say-model>${ico("speaker-high", 18)}Listen</button>
  ${m.notes && m.notes.length ? `<h4 class="t-head">Why it scores high</h4><ul class="ie-notes">${m.notes.map(n => `<li>${md(n)}</li>`).join("")}</ul>` : ""}</details>`;
const wireModel = (a, m) => a.querySelectorAll("[data-say-model]").forEach(b => b.onclick = () => speak(m.text.join(" ").replace(/\*/g, ""), {voice: "f"}));
const vizHtml = it => it && it.visual && IE.viz && typeof IE.viz.html === "function" ? `<figure class="ie-viz">${IE.viz.html(it.visual)}</figure>` : "";
const enc = encodeURIComponent;
const vband = e => e.band != null ? fmtBand(e.band) : "–";
function versionsNav(ch, e){
  return `<nav class="ie-vnav" aria-label="Versions">${ch.map((x, i) => `${i ? `<span class="ie-varr" aria-hidden="true">→</span>` : ""}<a class="ie-vpill" href="#/essays/${enc(x.id)}"${x.id === e.id ? ` aria-current="page"` : ""}>Version ${x.v || 1}<b class="t-num">${vband(x)}</b></a>`).join("")}</nav>`;
}
ROUTES.essays = async ([id, sub], a) => {
  if(id && sub === "revise") return revise(id, a);
  if(id && sub === "compare") return compare(id, a);
  if(id) return essayPage(id, a);
  setTop({title: "My writing", back: "#/", backT: "IELTS Prep"});
  const es = pget().essays, groups = new Map();
  for(const e of es){ const k = chainKey(e); if(!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
  const list = [...groups.values()].map(g => g.sort((x, y) => (x.v || 1) - (y.v || 1) || (x.at || 0) - (y.at || 0)))
    .sort((x, y) => Math.max(...y.map(e => +e.at || 0)) - Math.max(...x.map(e => +e.at || 0)));
  const rows = list.map(g => {
    const r = g[0], more = g.slice(1);
    return `<a class="ie-row" href="#/essays/${enc(r.id)}"><span class="ie-num t-num">${r.band != null ? fmtBand(r.band) : "T" + r.task}</span>
      <span class="ie-row-t">${esc(String(r.prompt).replace(/\*/g, "").slice(0, 90))}…<small>Task ${r.task} · ${r.words} words · ${when(r.at)}</small>
      ${more.length ? `<small class="ie-chain">${g.map(x => `v${x.v || 1} ${vband(x)}`).join(" → ")}</small>` : ""}</span>${ico("caret-right", 18, "ie-chev")}</a>`
      + more.map(x => `<a class="ie-row ie-vrow" href="#/essays/${enc(x.id)}"><span class="ie-num ie-vnum t-num">${x.band != null ? fmtBand(x.band) : "v" + (x.v || 1)}</span>
      <span class="ie-row-t">Version ${x.v || 1}<small>${x.words} words · ${when(x.at)}${x.band != null ? ` · band ${fmtBand(x.band)}` : ""}</small></span>${ico("caret-right", 18, "ie-chev")}</a>`).join("");
  }).join("");
  a.innerHTML = `<div class="ie-page"><p class="t-sub ie-pad">Everything you finish in a writing task is kept here, on this device, with the versions you rewrite under the first one.</p>
    ${rows ? `<div class="card ie-list ie-essays">${rows}</div>` : `<p class="t-sub ie-pad">Nothing yet.</p>`}</div>`;
};
async function essayPage(id, a){
  const es = pget().essays, e = es.find(x => x.id === id); if(!e) throw new Error("That piece of writing isn't on this device.");
  const ch = chainOf(es, e), last = ch[ch.length - 1], nv = Math.max(...ch.map(x => x.v || 1)) + 1;
  setTop({title: ch.length > 1 ? `Task ${e.task} · v${e.v || 1}` : `Task ${e.task}`, back: "#/essays", backT: "My writing"});
  const it = await data.item(e.iid), checks = checksOf(e.text, it, e);
  a.innerHTML = `<div class="ie-page"><div class="card ie-card"><p class="ie-kicker">${when(e.at)} · ${e.words} words${ch.length > 1 ? ` · version ${e.v || 1}` : ""}${e.band != null ? ` · your estimate: band ${fmtBand(e.band)}` : ""}</p>
      <p class="ie-prompt">${md(e.prompt)}</p>${vizHtml(it)}</div>
    ${ch.length > 1 ? versionsNav(ch, e) : ""}
    <article class="card ie-card ie-essay" lang="en-GB">${paras(e.text)}</article>
    ${checks ? `<div class="card ie-card"><h2 class="t-3">Checks</h2>${checksList(checks)}<p class="t-min">Automatic checks only catch the surface. Compare with the model for what examiners mark.</p></div>` : ""}
    ${it && it.model ? `<div class="card ie-card">${modelHtml(it.model)}</div>` : ""}
    <section class="card ie-card ie-improve" aria-labelledby="ie-imp-h"><h2 class="t-3" id="ie-imp-h">Improve it</h2>
      ${nv <= 3 ? `<p class="t-sub">Feedback only helps when you act on it. Write a better version with the checks and the model beside you, or rewrite it from memory with both hidden, then compare.</p>
      <div class="ie-row-b"><a class="glass-btn glass-btn--pri glass-btn--sm" id="ie-rv2" href="#/essays/${enc(last.id)}/revise">${ico("pencil-simple", 18)}Write version ${nv}</a>
        <a class="glass-btn glass-btn--sm" id="ie-rvm" href="#/essays/${enc(last.id)}/revise?blank=1">${ico("arrow-counter-clockwise", 18)}Rewrite from memory</a></div>`
      : `<p class="t-sub">You have three versions of this task, the most kept for one piece of writing. For more practice, try a new task of the same kind.</p>`}</section>
    <div class="ie-dock"><button type="button" class="glass-btn glass-btn--sm" id="ie-copy">${ico("copy", 18)}Copy text</button></div></div>`;
  if(it && it.model) wireModel(a, it.model);
  a.querySelector("#ie-copy").onclick = () => { try{ navigator.clipboard.writeText(e.text).then(() => toast("Copied."), () => toast("Couldn't copy.")); }catch(err){ toast("Couldn't copy."); } };
}
const DRAFT = id => `ielts:draft:${id}`;
/* the drafts of one revision by mode: ielts:draft:<id> holds the one typed last, and the other mode's draft under alt,
   so pressing the other button never opens (or overwrites) a draft of the wrong kind */
function draftsOf(id){
  const o = LS.get(DRAFT(id)), out = {};
  const ok = x => isObj(x) && typeof x.text === "string";
  if(ok(o)){ out[!!o.blank] = o; if(ok(o.alt) && !!o.alt.blank !== !!o.blank) out[!!o.alt.blank] = Object.assign({}, o.alt, {blank: !!o.alt.blank}); }
  return out;
}
const draftRec = (d, other) => { const r = {text: d.text, blank: !!d.blank, at: d.at, from: d.from}; if(other) r.alt = {text: other.text, blank: !!other.blank, at: other.at, from: other.from}; return r; };
async function revise(id, a){
  const es = pget().essays, e = es.find(x => x.id === id); if(!e) throw new Error("That piece of writing isn't on this device.");
  const ch = chainOf(es, e), last = ch[ch.length - 1], nv = Math.max(...ch.map(x => x.v || 1)) + 1, rootId = chainKey(e);
  setTop({title: `Version ${Math.min(nv, 3)}`, back: `#/essays/${enc(id)}`, backT: `Task ${e.task}`});
  if(nv > 3){
    a.innerHTML = `<div class="ie-page ie-narrow"><div class="card ie-card ie-empty">${ico("seal-check", 40)}<h1 class="t-2">Three versions already</h1>
      <p class="t-sub">That's the most kept for one piece of writing. For more practice, try a new task of the same kind.</p><a class="glass-btn glass-btn--sm" href="#/essays/${enc(id)}">See your writing</a></div></div>`;
    return;
  }
  const it = await data.item(e.iid), minW = it && it.minWords || (e.task === 1 ? 150 : 250);
  /* the button pressed decides the mode; a draft is resumed only when it was written in that mode */
  const blank = query().get("blank") === "1", drs = draftsOf(id), dr = drs[blank] || null, other = drs[!blank] || null, resume = !!dr;
  const text = resume ? dr.text : blank ? "" : last.text;
  const todo = !blank ? (checksOf(last.text, it, last) || []).filter(c => !c.ok) : [];
  a.innerHTML = `<div class="ie-page ie-narrow ie-revise">
    <div class="card ie-card ie-wtask"><p class="ie-kicker">${ico("pencil-simple", 18)}Version ${nv} · Writing Task ${e.task} · at least ${minW} words</p>
      <p class="ie-prompt">${md(e.prompt)}</p>${vizHtml(it)}
      ${blank ? `<p class="ie-tip">${ico("lightbulb", 18)}<span>From memory: your earlier version and the model stay hidden until you compare. Rebuild the structure and the best phrases yourself.</span></p>`
        : todo.length ? `<details class="ie-plan" open><summary class="t-head">${ico("list-checks", 18)}What to work on from version ${last.v || 1}</summary>${checksList(todo)}</details>` : ""}
      ${!blank && it && it.model ? `<div class="ie-rvmodel">${modelHtml(it.model, false)}</div>` : ""}</div>
    ${resume ? `<p class="t-note ie-pad ie-resume">You're continuing your draft from ${when(dr.at)}. <button type="button" class="ie-link" id="ie-rv-new">Start again</button></p>` : ""}
    ${other ? `<p class="t-note ie-pad ie-resume" id="ie-rv-other">Your draft ${other.blank ? "from memory" : "with the model"} (${when(other.at)}) is kept too.
      <a class="ie-link" href="#/essays/${enc(id)}/revise${other.blank ? "?blank=1" : ""}">Open it</a></p>` : ""}
    <div class="card ie-card"><textarea class="ie-ta" id="ie-ta" lang="en-GB" spellcheck="false" autocapitalize="sentences" aria-label="Version ${nv}" placeholder="${blank ? "Write the task again from memory. It's saved as you type." : "Improve your answer here. It's saved as you type."}">${esc(text)}</textarea>
      <p class="ie-wc t-note"><span id="ie-wc" class="t-num">${words(text)} words</span><span id="ie-rv-st" class="t-min">${resume ? "Draft saved" : "Saved as you type"}</span></p>
      <button type="button" class="glass-btn glass-btn--pri glass-btn--block" id="ie-rv-done">I've finished: compare</button></div></div>`;
  const ta = a.querySelector("#ie-ta"), wc = a.querySelector("#ie-wc"), st = a.querySelector("#ie-rv-st");
  let t0 = 0, dirty = false;
  const save = () => { clearTimeout(t0); if(!dirty) return; dirty = false;
    if(LS.set(DRAFT(id), draftRec({text: ta.value, blank, at: Date.now(), from: last.id}, other))) st.textContent = "Draft saved"; else toast(FULL, 7000); };
  const fit = () => { ta.style.height = "auto"; ta.style.height = Math.max(260, ta.scrollHeight + 4) + "px"; };
  if(!blank && it && it.model) wireModel(a, it.model);
  ta.addEventListener("input", () => { dirty = true; wc.textContent = `${words(ta.value)} words`; clearTimeout(t0); t0 = setTimeout(save, 300); fit(); });
  requestAnimationFrame(fit);
  const nb = a.querySelector("#ie-rv-new");
  /* clears this mode's draft only */
  if(nb) nb.onclick = () => { if(!confirm("Clear this draft and start again?")) return; clearTimeout(t0); dirty = false; if(other) LS.set(DRAFT(id), draftRec(other)); else LS.del(DRAFT(id)); route(); };
  a.querySelector("#ie-rv-done").onclick = () => {
    const t = ta.value;
    if(!t.trim()){ toast("Write your new version first."); ta.focus(); return; }
    if(words(t) < 30 && !confirm("That's very short. Compare anyway?")) return;
    const taken = new Set(pget().essays.map(x => x.id));
    let nid = `${rootId}-v${nv}`; if(taken.has(nid)) nid += `-${Date.now().toString(36)}`;
    const rec = prog.addEssay({id: nid, parent: rootId, v: nv, iid: e.iid, task: e.task, prompt: e.prompt, text: t, words: words(t), self: null, band: null});
    if(!prog.essay(rec.id)) return;   /* not saved (storage full or a newer version's data): keep the draft */
    clearTimeout(t0); dirty = false; LS.del(DRAFT(id));
    location.replace(`#/essays/${enc(rec.id)}/compare`);
  };
  return () => save();
}
/* a version beside the one before it: what changed, both sets of checks, the model, then marking yourself */
async function compare(id, a){
  const es = pget().essays, cur = es.find(x => x.id === id); if(!cur) throw new Error("That piece of writing isn't on this device.");
  const ch = chainOf(es, cur), i = ch.indexOf(cur), prev = i > 0 ? ch[i - 1] : null;
  if(!prev) return essayPage(id, a);
  setTop({title: `Version ${cur.v || 1}`, back: `#/essays/${enc(id)}`, backT: `Task ${cur.task}`});
  const it = await data.item(cur.iid), c0 = checksOf(prev.text, it, prev) || [], c1 = checksOf(cur.text, it, cur) || [];
  const m0 = new Map(c0.map(c => [ckey(c), c])), m1 = new Map(c1.map(c => [ckey(c), c]));
  const keys = [...new Set([...m0.keys(), ...m1.keys()])];
  const flag0 = k => m0.has(k) && !m0.get(k).ok, flag1 = k => m1.has(k) && !m1.get(k).ok;
  const fixed = keys.filter(k => flag0(k) && !flag1(k)), added = keys.filter(k => !flag0(k) && flag1(k)), still = keys.filter(k => flag0(k) && flag1(k));
  const dw = cur.words - prev.words, pv = prev.v || 1, cv = cur.v || 1;
  /* contractions, memorised phrases and opinions in Task 1 only appear when found: absent means fine */
  const cell = (m, k) => { const c = m.get(k) || (["cliche", "contractions", "opinion"].includes(k) ? {ok: true, t: ""} : null); return !c ? `<td>–</td>` : `<td class="${c.ok ? "is-ok" : "is-miss"}">${ico(c.ok ? "check-circle" : "warning-circle", 18)}<span>${k === "words" ? esc(String(c.t).split(":")[0]) : c.ok ? "Fine" : "To fix"}</span></td>`; };
  const list = ks => ks.map(cname).join(", ");
  const AS = IE.assess, kind = cur.task === 1 ? "w1" : "w2";
  const self = AS && typeof AS.selfHtml === "function" ? AS.selfHtml(kind, cur.self, it) : "";
  a.innerHTML = `<div class="ie-page ie-compare">
    <div class="card ie-card ie-result">${ico("seal-check", 44)}<h1 class="t-2">Version ${cv} saved</h1><p class="t-sub">It's in My writing, under version 1. Here is how it compares with version ${pv}.</p></div>
    <section class="card ie-card ie-changes" aria-labelledby="ie-ch-h"><h2 class="t-3" id="ie-ch-h">What changed</h2>
      <ul class="ie-checks" aria-live="polite">
        <li class="is-ok">${ico("pencil-simple", 18)}<span>Words: ${prev.words} → ${cur.words} (${dw >= 0 ? "+" : "−"}${Math.abs(dw)})</span></li>
        <li class="${fixed.length ? "is-ok" : "is-miss"}">${ico(fixed.length ? "check-circle" : "warning-circle", 18)}<span>${fixed.length ? `Flags fixed: ${fixed.length} (${esc(list(fixed))})` : "No flag fixed yet"}</span></li>
        ${still.length ? `<li class="is-miss">${ico("warning-circle", 18)}<span>Still to fix: ${esc(list(still))}</span></li>` : ""}
        ${added.length ? `<li class="is-miss">${ico("warning-circle", 18)}<span>New flags: ${esc(list(added))}</span></li>` : ""}
      </ul>
      <table class="ie-ctab"><caption class="vh">The checks of both versions</caption><thead><tr><th scope="col">Check</th><th scope="col">Version ${pv}</th><th scope="col">Version ${cv}</th></tr></thead>
        <tbody>${keys.map(k => `<tr><th scope="row">${esc(cname(k))}</th>${cell(m0, k)}${cell(m1, k)}</tr>`).join("")}</tbody></table></section>
    <div class="ie-cmp">
      <section class="card ie-card" aria-labelledby="ie-c0"><h2 class="t-head" id="ie-c0">Version ${pv} · ${prev.words} words</h2>${checksList(c0)}
        <details class="ie-plan"><summary class="t-head">${ico("quotes", 18)}Read version ${pv}</summary><div class="ie-essay">${paras(prev.text)}</div></details></section>
      <section class="card ie-card" aria-labelledby="ie-c1"><h2 class="t-head" id="ie-c1">Version ${cv} · ${cur.words} words</h2>${checksList(c1)}
        <details class="ie-plan"><summary class="t-head">${ico("quotes", 18)}Read version ${cv}</summary><div class="ie-essay">${paras(cur.text)}</div></details></section>
    </div>
    ${it && it.model ? `<div class="card ie-card">${modelHtml(it.model)}</div>` : ""}
    ${self ? `<div class="card ie-card" id="ie-rv-self">${self}</div>` : ""}
    <div class="ie-row-b ie-center"><a class="glass-btn glass-btn--pri" href="#/essays/${enc(cur.id)}">See version ${cv}</a><a class="glass-btn" href="#/essays">My writing</a></div></div>`;
  if(it && it.model) wireModel(a, it.model);
  const box = a.querySelector("#ie-rv-self");
  if(box && typeof AS.wireSelf === "function") AS.wireSelf(box, kind, () => (prog.essay(cur.id) || cur).self, (c, b) => {
    const now = prog.essay(cur.id) || cur;
    prog.addEssay(Object.assign({}, now, {self: c, band: b != null ? b : now.band, at: Date.now()}));   /* a new time, so a restore takes the marked copy */
  }, it);
}

/* ---------- settings ---------- */
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function download(){
  const name = `ielts-prep-${ymd(new Date())}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(prog.backup(), null, 1)], {type: "application/json"}));
  const l = D.createElement("a"); l.href = url; l.download = name; l.hidden = true; D.body.appendChild(l); l.click(); l.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast(`Downloading ${name}.`);
}
const readFile = f => typeof f.text === "function" ? f.text() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(f); });
function restoreMsg(n){
  if(n.error) return n.error;
  const bits = [[n.lessons, "lesson", "lessons"], [n.tests, "test result", "test results"], [n.essays, "piece of writing", "pieces of writing"], [n.speaking, "speaking mark", "speaking marks"]]
    .filter(([x]) => x).map(([x, one, many]) => `${x} ${x === 1 ? one : many}`);
  if(n.other) bits.push(n.other === 1 ? "1 setting or draft" : `${n.other} settings and drafts`);
  return bits.length ? `Restored: ${bits.join(", ").replace(/, ([^,]*)$/, " and $1")}.` : "Nothing new in that file: it was all here already.";
}
function voiceHtml(n){
  if(n == null) return `<p class="t-sub" id="ie-vinfo">Checking this device's voices…</p>`;
  if(!n || !canSpeak()) return `<div class="ie-vnone" id="ie-vhelp">${canSpeak() ? "" : `<p class="t-sub">This browser can't read recordings aloud.</p>`}${howtoHtml()}</div>`;
  const V = voices();
  return `<p class="t-sub" id="ie-vinfo">Listening recordings are read by this device's ${V && V.gb ? "British" : "English"} voices${V && V.f !== V.m ? ` (${esc(V.f.name)} and ${esc(V.m.name)})` : ""}. The exam speaks at normal speed.</p>
    <p class="t-note" id="ie-vacc">${esc(accentLine(V))}</p>`;
}
ROUTES.settings = async (_, a) => {
  setTop({title: "Settings", back: "#/", backT: "IELTS Prep", right: "<span></span>"});
  const rate = ui().rate || 1, acc = accents(), gen = routeGen;
  const seg = (label, attr, opts, on) => `<div class="ie-seg" role="radiogroup" aria-label="${label}">${opts.map(([v, t]) =>
    `<button type="button" role="radio" aria-checked="${on(v)}" ${attr}="${v}">${t}</button>`).join("")}</div>`;
  a.innerHTML = `<div class="ie-page">
    <section class="ie-block" aria-labelledby="ie-s-voice"><h2 class="ie-bh" id="ie-s-voice">${ico("speaker-high", 20)}Voice</h2><div class="card ie-card" id="ie-voice">
      <div id="ie-vbox">${voiceHtml(canSpeak() ? VCOUNT : 0)}</div>
      <h3 class="t-head ie-sh">Speed</h3>${seg("Speed", "data-rate", [[.85, "Slower"], [1, "Exam speed"], [1.1, "Faster"]], r => Math.abs(rate - r) < .01)}
      <p class="t-note">Timed tests always play at exam speed.</p>
      <h3 class="t-head ie-sh">Accents</h3>${seg("Accents", "data-acc", [["mixed", "Mixed, as in the exam"], ["gb", "British only"]], v => v === acc)}
      <p class="t-note">The exam uses British, Australian, New Zealand and North American speakers. British only reads every recording with a British voice.</p>
      <button type="button" class="glass-btn glass-btn--sm" id="ie-vt">${ico("play", 18)}Try the voices</button></div></section>
    <section class="ie-block" aria-labelledby="ie-s-data"><h2 class="ie-bh" id="ie-s-data">${ico("notebook", 20)}Your data</h2><div class="card ie-card">
      <p class="t-sub">Your results, writing, drafts and settings for IELTS Prep, in one file: keep it somewhere safe, or open it on another device. A copy in Google Drive will come later.</p>
      <div class="ie-row-b"><button type="button" class="glass-btn glass-btn--sm" id="ie-dl">${ico("copy", 18)}Download my data</button>
        <label class="glass-btn glass-btn--sm ie-file">${ico("arrow-counter-clockwise", 18)}Restore from a file<input type="file" id="ie-restore" class="vh" accept=".json,application/json"></label></div>
      <p class="t-min">Restoring adds what's in the file to what's on this device; nothing here is lost. Lessons in progress aren't in the file.</p></div></section>
    <section class="ie-block" aria-labelledby="ie-s-about"><h2 class="ie-bh" id="ie-s-about">${ico("info", 20)}About</h2><div class="card ie-card">
      <p class="t-sub">All material here is original and written for this app; it is not affiliated with IELTS, the British Council, IDP or Cambridge.</p>
      <p class="t-sub">Listening and Reading bands use the usual conversion, approximate: cut-offs vary slightly between test versions. IELTS publishes only a few points of it (in Listening, 16 of 40 is band 5, 23 is band 6, 30 is band 7 and 35 is band 8). Writing and Speaking are your own estimates.</p>
      <p class="t-sub">Your progress stays on this device. Recordings stay on this device. Live transcript uses your browser's speech service, which may send your voice to its provider (Google in Chrome).</p></div></section>
    <section class="ie-block" aria-labelledby="ie-s-erase"><h2 class="ie-bh" id="ie-s-erase">${ico("trash", 20)}Start again</h2><div class="card ie-card">
      <p class="t-sub">${prog.newer() ? "This device holds progress from a newer version of the app. Update the app first: until then it can't be erased here."
        : "Erase your results, writing and drafts on this device. Download your data first if you might want them back."}</p>
      <button type="button" class="glass-btn glass-btn--sm" id="ie-erase">${ico("trash", 18)}Erase my progress</button></div></section></div>`;
  if(canSpeak() && VCOUNT == null) ensureVoices().then(n => { const b = a.querySelector("#ie-vbox"); if(gen === routeGen && b) b.innerHTML = voiceHtml(n); });
  a.querySelectorAll("[data-rate]").forEach(b => b.onclick = () => {
    uiSet({rate: +b.dataset.rate}); a.querySelectorAll("[data-rate]").forEach(x => x.setAttribute("aria-checked", x === b)); speak("This is the speed you'll hear.", {voice: "f"});
  });
  a.querySelectorAll("[data-acc]").forEach(b => b.onclick = () => {
    uiSet({accents: b.dataset.acc}); a.querySelectorAll("[data-acc]").forEach(x => x.setAttribute("aria-checked", x === b));
    toast(b.dataset.acc === "gb" ? "Every recording now uses a British voice." : "Recordings now use the accents of the exam where this device has them.");
  });
  a.querySelector("#ie-vt").onclick = () => voiceTest().then(n => { const b = a.querySelector("#ie-vbox"); if(b && gen === routeGen) b.innerHTML = voiceHtml(n); });
  a.querySelector("#ie-dl").onclick = download;
  const inp = a.querySelector("#ie-restore");
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if(!f) return;
    let o; try{ o = JSON.parse(await readFile(f)); }catch(e){ inp.value = ""; toast("That file can't be read: it isn't an IELTS Prep backup."); return; }
    inp.value = "";
    if(!confirm("Add the results, writing and settings in this file to the ones on this device?")) return;
    toast(restoreMsg(prog.restore(o)), 6000);
  };
  a.querySelector("#ie-erase").onclick = () => {
    if(prog.newer()){ toast(NEWER_ERASE, 7000); return; }
    if(confirm("Erase all your IELTS Prep progress on this device?")){ if(prog.erase()){ toast("Progress erased."); go("#/"); } else toast(NEWER_ERASE, 7000); }
  };
};

Object.assign(IE, {esc, md, ico, LS, isObj, data, band, bandRange, roundBand, fmtBand, prog, ui, uiSet, speak, stopSpeak, canSpeak, voices, ensureVoices, voiceTest,
  ROUTES, route, go, query, setTop, toast, KIND_T, when, words, nextLesson});

/* ---------- start ---------- */
function locked(){
  const on = LS.get("ielts:on") === true;
  let inn = false; try{ inn = sessionStorage.getItem("ielts:in") === "1"; }catch(e){}
  return !(on && inn);
}
function start(){
  const a = $app();
  if(locked()){
    D.getElementById("ie-top").innerHTML = `<a class="ie-back" href="./">${ico("caret-left", 22)}<span>Languages</span></a><span class="ie-top-t">IELTS Prep</span><span></span>`;
    a.innerHTML = `<div class="ie-page"><div class="card ie-card ie-empty">${ico("lock", 40)}<h1 class="t-2">IELTS Prep is for grown-ups</h1>
      <p class="t-sub">Turn it on in Settings › For grown-ups, then open it from the language menu.</p>
      <p class="t-sub" lang="es">Se enciende en Ajustes › Para mayores y se abre desde el menú de idioma.</p>
      <a class="glass-btn glass-btn--pri" href="./">Open the app</a></div></div>`;
    return;
  }
  pget();   /* a newer version's data or a damaged blob says so at once */
  addEventListener("hashchange", route);
  route();
}
if(D.readyState === "loading") D.addEventListener("DOMContentLoaded", start); else start();
})();
