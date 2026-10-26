/* IELTS Prep (ielts.html): the core. A separate page for a grown-up who prepares IELTS Academic for band 8.5-9 (≈ C2).
   Everything the learner sees is in British English. It never touches the child's game (no vocab:* keys, no coins,
   no medals, no streak) and needs nothing but the browser: data/ielts/*.json, speechSynthesis and the microphone.
   · Entry: js/ielts-boot.js (in index.html) passes the adult gate and sets sessionStorage "ielts:in" = "1"; without it,
     or with the switch "ielts:on" off, this page only shows how to open it.
   · State (localStorage, this device only): "ielts:data" = {v:1, lessons:{lid:{done, at, got, total, band}},
     tests:[{lid, skill, got, total, band, at}], essays:[{id, iid, task, prompt, text, words, self, band, at}],
     speaking:[{iid, self, band, at}]}; "ielts:ui" = {rate}; "ielts:run:<lid>" (a lesson in progress) and
     "ielts:draft:<itemId>" (writing drafts) are saved as you type.
   · window.IE = {esc, md, ico, LS, data, prog, band, roundBand, speak, stopSpeak, canSpeak, voiceTest, route, go, toast}.
     js/ielts-player.js adds IE.player (#/lesson/<lid>) and js/ielts-viz.js IE.viz (Task 1 visuals). */
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
};
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const $app = () => D.getElementById("app");

let toastT = 0;
function toast(text){
  let t = D.getElementById("ie-toast");
  if(!t){ t = D.createElement("div"); t.id = "ie-toast"; t.className = "ie-toast"; t.setAttribute("role", "status"); D.body.appendChild(t); }
  t.textContent = text; t.classList.add("is-on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("is-on"), 2600);
}

/* ---------- data ---------- */
let IDX = null, pIdx = null;
const UNITS = {}, pUnit = {};
async function getJSON(url){
  let r;
  try{ r = await fetch(url); }catch(e){ throw new Error("Couldn't load IELTS Prep. Check the connection and try again."); }
  if(!r.ok) throw new Error(`Couldn't load IELTS Prep (${r.status}).`);
  return r.json();
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
  avail: () => IDX ? IDX.units.filter(u => u.available) : [],
  row: id => IDX ? IDX.units.find(u => u.id === id) || null : null,
  block: id => IDX ? IDX.blocks.find(b => b.id === id) || null : null,
};

/* ---------- bands ---------- */
const TABLES = {
  listening: [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]],
  reading: [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]],
};
/* the band for a raw score; shorter tests are scaled to 40 questions */
function band(skill, got, total){
  const t = TABLES[skill]; if(!t || !(total > 0)) return null;
  const raw = Math.round(got * 40 / total);
  for(const [min, b] of t) if(raw >= min) return b;
  return raw > 0 ? 2 : 0;
}
/* the overall band: the mean, to the nearest half band (.25 goes up to .5 and .75 to the next band) */
function roundBand(x){ if(!(x >= 0)) return null; const f = Math.floor(x), r = x - f; return r < .25 ? f : r < .75 ? f + .5 : f + 1; }
const fmtBand = b => b == null ? "–" : (b % 1 ? b.toFixed(1) : String(b));

/* ---------- progress ---------- */
const PK = "ielts:data", ESSAY_MAX = 60, TEST_MAX = 100;
function pget(){
  const o = LS.get(PK);
  const d = isObj(o) && o.v === 1 ? o : {v: 1};
  if(!isObj(d.lessons)) d.lessons = {};
  for(const k of ["tests", "essays", "speaking"]) if(!Array.isArray(d[k])) d[k] = [];
  return d;
}
function pset(d){ if(!LS.set(PK, d)) toast("Couldn't save on this device: storage is full."); }
const prog = {
  get: pget,
  lesson: lid => pget().lessons[lid] || null,
  done(lid, rec){
    const d = pget(), old = d.lessons[lid] || {};
    const r = Object.assign({}, old, rec, {done: true, at: Date.now()});
    if(old.band != null && rec.band != null) r.best = Math.max(old.best || old.band, rec.band);
    d.lessons[lid] = r; pset(d); return r;
  },
  addTest(t){ const d = pget(); d.tests.push(Object.assign({at: Date.now()}, t)); d.tests = d.tests.slice(-TEST_MAX); pset(d); },
  addEssay(e){ const d = pget(); d.essays = d.essays.filter(x => x.id !== e.id); d.essays.push(Object.assign({at: Date.now()}, e)); d.essays = d.essays.slice(-ESSAY_MAX); pset(d); },
  essay: id => pget().essays.find(x => x.id === id) || null,
  addSpeaking(s){ const d = pget(); d.speaking.push(Object.assign({at: Date.now()}, s)); d.speaking = d.speaking.slice(-TEST_MAX); pset(d); },
  /* the latest band of each skill: Listening and Reading from timed tests, Writing and Speaking from your own marking */
  latest(){
    const d = pget(), out = {listening: null, reading: null, writing: null, speaking: null};
    for(const t of d.tests) if(t.skill in out && t.band != null) out[t.skill] = t.band;
    const lastW = d.essays.filter(e => e.band != null).slice(-2);
    if(lastW.length){
      const t2 = lastW.filter(e => e.task === 2).pop(), t1 = lastW.filter(e => e.task === 1).pop();
      out.writing = t1 && t2 ? roundBand((t1.band + 2 * t2.band) / 3) : (t2 || t1).band;
    }
    const lastS = d.speaking.filter(s => s.band != null).pop(); if(lastS) out.speaking = lastS.band;
    return out;
  },
  overall(){ const l = prog.latest(), v = Object.values(l); return v.every(x => x != null) ? roundBand(v.reduce((a, b) => a + b, 0) / 4) : null; },
  erase(){ for(const k of LS.keys()) if(k.startsWith("ielts:") && k !== "ielts:on" && k !== "ielts:ui") LS.del(k); },
};

/* ---------- voice (the browser's British voices) ---------- */
const UIK = "ielts:ui";
const ui = () => { const o = LS.get(UIK); return isObj(o) ? o : {}; };
const uiSet = p => LS.set(UIK, Object.assign(ui(), p));
const canSpeak = () => "speechSynthesis" in W && typeof W.SpeechSynthesisUtterance === "function";
const FEM = /(female|serena|kate|stephanie|martha|libby|sonia|maisie|hazel|susan|fiona|moira|tessa|karen|catherine|amy|emma|olivia|alice|mia|bella|samantha|victoria|zira|jenny|aria|natasha|google uk english female)/i;
const MALE = /(male|daniel|arthur|oliver|ryan|thomas|george|alfie|elliot|harry|ethan|noah|james|brian|guy|rishi|lee|aaron|fred|alex|google uk english male)/i;
let VOX = null;
function pickVoices(){
  if(!canSpeak()) return null;
  const all = speechSynthesis.getVoices() || [];
  if(!all.length) return null;
  const code = v => String(v.lang || "").replace("_", "-").toLowerCase();
  const gb = all.filter(v => code(v) === "en-gb"), en = all.filter(v => code(v).startsWith("en"));
  const pool = gb.length ? gb : en; if(!pool.length) return null;
  const local = a => a.slice().sort((x, y) => (y.localService ? 1 : 0) - (x.localService ? 1 : 0));
  const f = local(pool).find(v => FEM.test(v.name) && !/\bmale\b/i.test(v.name.replace(/female/i, ""))) || null;
  const m = local(pool).find(v => MALE.test(v.name) && !FEM.test(v.name)) || null;
  const any = local(pool)[0];
  return {f: f || any, m: m || (f && pool.find(v => v !== f)) || any, gb: !!gb.length};
}
function voices(){ if(!VOX) VOX = pickVoices(); return VOX; }
if(canSpeak()) try{ speechSynthesis.addEventListener("voiceschanged", () => { VOX = pickVoices(); }); }catch(e){}
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
let speakGen = 0;
/* speaks text with the "f" or "m" voice; resolves true at the end, false when stopped or impossible */
function speak(text, o = {}){
  if(!canSpeak()) return Promise.resolve(false);
  const my = ++speakGen;
  try{ speechSynthesis.cancel(); }catch(e){}
  const v = voices(), parts = chunks(text), rate = (o.rate || ui().rate || 1) * (o.slow ? .8 : 1);
  const same = v && v.f === v.m;
  return new Promise(res => {
    let i = 0;
    const next = () => {
      if(my !== speakGen) return res(false);
      if(i >= parts.length) return res(true);
      const u = new SpeechSynthesisUtterance(parts[i++]);
      const voice = v ? (o.voice === "m" ? v.m : v.f) : null;
      if(voice){ u.voice = voice; u.lang = voice.lang; } else u.lang = "en-GB";
      u.rate = rate; u.pitch = same ? (o.voice === "m" ? .82 : 1.12) : 1;
      let done = false;
      const end = () => { if(done) return; done = true; clearTimeout(dog); setTimeout(next, o.gap == null ? 120 : o.gap); };
      /* some browsers never fire onend: a watchdog moves on after a generous time */
      const dog = setTimeout(end, 4000 + u.text.length * 110 / rate);
      u.onend = end; u.onerror = end;
      try{ speechSynthesis.speak(u); try{ speechSynthesis.resume(); }catch(e){} }catch(e){ end(); }
    };
    setTimeout(next, 60);
  });
}
function stopSpeak(){ speakGen++; try{ if(canSpeak()) speechSynthesis.cancel(); }catch(e){} }
function voiceTest(){
  const v = voices();
  if(!canSpeak()) return toast("This browser can't speak.");
  speak("Good morning. My name is Claire, and I'll be your examiner today.", {voice: "f"})
    .then(ok => ok && speak("Thank you. Could you tell me your full name, please?", {voice: "m"}));
  if(v && !v.gb) toast("No British voice on this device: using another English voice.");
}

/* ---------- router ---------- */
const ROUTES = {};
const parts = () => location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
function go(h){ if(location.hash === h) route(); else location.hash = h; }
let leaving = null;
async function route(){
  delete $app().dataset.ready;
  if(typeof leaving === "function"){ try{ leaving(); }catch(e){ console.error(e); } leaving = null; }
  stopSpeak();
  const [name, ...rest] = parts();
  const f = ROUTES[name || "home"] || ROUTES.home;
  const a = $app();
  try{ await data.index(); }catch(e){ a.innerHTML = fail(e.message); return; }
  try{ const r = await f(rest, a); if(typeof r === "function") leaving = r; }
  catch(e){ console.error(e); a.innerHTML = fail(e.message); }
  if(!D.activeElement || D.activeElement === D.body) a.focus({preventScroll: true});
  a.dataset.ready = location.hash || "#/";   /* painted (the tests wait for it) */
}
const fail = msg => `<div class="ie-page"><div class="card ie-card ie-empty">${ico("warning-circle", 40)}<h2 class="t-3">Something went wrong</h2>
  <p class="t-sub">${esc(msg)}</p><a class="glass-btn glass-btn--sm" href="#/">Back to IELTS Prep</a></div></div>`;
function setTop(o){
  const t = D.getElementById("ie-top");
  const back = o.back ? `<a class="ie-back" href="${esc(o.back)}" aria-label="Back">${ico("caret-left", 22)}<span>${esc(o.backT || "Back")}</span></a>`
    : `<a class="ie-back" href="./" aria-label="Back to languages">${ico("caret-left", 22)}<span>Languages</span></a>`;
  t.innerHTML = `${back}<span class="ie-top-t">${esc(o.title || "")}</span>${o.right || `<a class="ie-tbtn" href="#/settings" aria-label="Settings">${ico("gear-six", 22)}</a>`}`;
  D.title = o.title && o.title !== "IELTS Prep" ? `${o.title} – IELTS Prep` : "IELTS Prep";
}

/* ---------- pages ---------- */
const BLOCK_ICON = {start: "signpost", listening: "ear", reading: "book-open-text", writing: "pencil-simple", speaking: "chats-circle", language: "translate", mock: "timer"};
const SKILLS = [["listening", "Listening", "ear"], ["reading", "Reading", "book-open-text"], ["writing", "Writing", "pencil-simple"], ["speaking", "Speaking", "chats-circle"]];
function lessonCount(uid){ const u = UNITS[uid]; return u ? u.lessons.length : null; }
function doneCount(uid){ const p = pget().lessons; return Object.keys(p).filter(k => k.startsWith(uid + "-") && p[k].done).length; }
function scoreTiles(){
  const l = prog.latest(), o = prog.overall();
  return `<section class="card ie-card ie-scores" aria-labelledby="ie-sc-h">
    <div class="ie-sc-head"><h2 class="t-head" id="ie-sc-h">Your bands</h2><span class="ie-overall"><small>Overall</small><b class="t-num">${fmtBand(o)}</b></span></div>
    <div class="ie-tiles">${SKILLS.map(([k, t, ic]) => `<div class="ie-tile">${ico(ic, 20)}<span class="ie-tile-t">${t}</span><b class="t-num">${fmtBand(l[k])}</b></div>`).join("")}</div>
    <p class="t-note">${o == null ? "Take a timed test in each skill to see your overall band. Target: 8.5 or 9 (C2)." : o >= 8.5 ? "That's C2 territory. Keep it steady across all four skills." : `Target: 8.5 or 9 (C2). ${o >= 7 ? "You're close: precision and consistency make the difference now." : "Work through the path in order."}`}</p>
    <p class="t-min">Listening and Reading come from your timed tests. Writing and Speaking are your own estimates against the criteria.</p></section>`;
}
async function nextLesson(){
  const p = pget().lessons;
  for(const r of data.avail()){
    let u; try{ u = await data.unit(r.id); }catch(e){ continue; }
    const l = u.lessons.find(x => !(p[x.id] && p[x.id].done));
    if(l) return {lesson: l, unit: u};
  }
  return null;
}
ROUTES.home = async (_, a) => {
  setTop({title: "IELTS Prep"});
  const ix = await data.index(), av = data.avail();
  await Promise.all(av.map(r => data.unit(r.id).catch(() => null)));
  const nx = await nextLesson();
  const blocks = ix.blocks.map(b => {
    const rows = ix.units.filter(u => u.block === b.id);
    return `<section class="ie-block" aria-labelledby="ie-b-${b.id}"><h2 class="ie-bh" id="ie-b-${b.id}">${ico(BLOCK_ICON[b.id] || "circle", 20)}${esc(b.title)}</h2>
      <div class="card ie-list">${rows.map(r => {
        const n = lessonCount(r.id), d = doneCount(r.id), full = n && d >= n;
        return r.available ? `<a class="ie-row" href="#/unit/${r.id}"><span class="ie-num t-num${full ? " is-done" : ""}">${full ? ico("check", 18) : r.n}</span>
          <span class="ie-row-t">${esc(r.title)}<small>${n ? `${d} of ${n} lessons` : ""}</small></span>${ico("caret-right", 18, "ie-chev")}</a>`
          : `<div class="ie-row is-soon"><span class="ie-num t-num">${r.n}</span><span class="ie-row-t">${esc(r.title)}<small>Coming soon</small></span></div>`;
      }).join("")}</div></section>`;
  }).join("");
  a.innerHTML = `<div class="ie-page">
    <header class="ie-hero"><h1 class="t-lt">IELTS Prep</h1><p class="t-sub">Academic · aiming for band 8.5–9 (C2)</p></header>
    ${nx ? `<a class="card ie-card ie-next" href="#/lesson/${nx.lesson.id}"><span class="ie-next-k">${doneCount(nx.unit.id) || Object.keys(pget().lessons).length ? "Up next" : "Start here"}</span>
      <span class="t-3">${esc(nx.lesson.title)}</span><span class="t-note">Unit ${nx.unit.n} · ${esc(nx.unit.title)} · ${nx.lesson.minutes} min${nx.lesson.kind === "test" ? " · timed" : ""}</span>
      <span class="glass-btn glass-btn--pri glass-btn--sm ie-next-b">${ico("play", 18)}${nx.lesson.kind === "test" ? "Start the test" : "Start"}</span></a>`
      : av.length ? `<div class="card ie-card"><h2 class="t-3">You've done every lesson</h2><p class="t-sub">Repeat the mock tests under exam conditions, a week apart.</p></div>` : ""}
    ${scoreTiles()}
    ${blocks}
    <nav class="ie-foot"><a class="glass-btn glass-btn--sm" href="#/progress">${ico("list-checks", 18)}My results</a><a class="glass-btn glass-btn--sm" href="#/essays">${ico("notebook", 18)}My writing</a></nav>
  </div>`;
};
const KIND_T = {learn: "Learn", practice: "Practice", test: "Timed test"};
ROUTES.unit = async ([id], a) => {
  const r = data.row(id);
  if(!r || !r.available) throw new Error("This unit isn't ready yet.");
  const u = await data.unit(id), p = pget().lessons;
  setTop({title: `Unit ${u.n}`, back: "#/", backT: "IELTS Prep"});
  a.innerHTML = `<div class="ie-page">
    <header class="ie-hero"><p class="ie-kicker">${ico(BLOCK_ICON[u.block] || "circle", 18)}${esc((data.block(u.block) || {}).title || "")} · Unit ${u.n}</p>
      <h1 class="t-1">${esc(u.title)}</h1><p class="t-sub">${md(u.summary)}</p></header>
    <div class="card ie-list">${u.lessons.map((l, i) => {
      const rec = p[l.id];
      const res = rec && rec.done ? (rec.band != null ? `Band ${fmtBand(rec.band)}` : rec.total ? `${rec.got} of ${rec.total}` : "Done") : "";
      return `<a class="ie-row" href="#/lesson/${l.id}"><span class="ie-num t-num${rec && rec.done ? " is-done" : ""}">${rec && rec.done ? ico("check", 18) : i + 1}</span>
        <span class="ie-row-t">${esc(l.title)}<small>${KIND_T[l.kind] || ""} · ${l.minutes} min${res ? " · " + esc(res) : ""}</small></span>
        ${l.kind === "test" ? `<span class="ie-pill">${ico("timer", 16)}${Math.round(l.timed / 60)} min</span>` : ""}${ico("caret-right", 18, "ie-chev")}</a>`;
    }).join("")}</div>
  </div>`;
};
const when = t => new Date(t).toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"});
ROUTES.progress = async (_, a) => {
  setTop({title: "My results", back: "#/", backT: "IELTS Prep"});
  const d = pget();
  const rows = d.tests.slice().reverse().map(t => `<div class="ie-row"><span class="ie-num t-num">${fmtBand(t.band)}</span>
    <span class="ie-row-t">${esc(t.title || t.lid)}<small>${esc(t.skill[0].toUpperCase() + t.skill.slice(1))} · ${t.got} of ${t.total} · ${when(t.at)}</small></span></div>`).join("");
  const sp = d.speaking.slice().reverse().slice(0, 20).map(s => `<div class="ie-row"><span class="ie-num t-num">${fmtBand(s.band)}</span>
    <span class="ie-row-t">${esc(s.title || "Speaking")}<small>Your estimate · ${when(s.at)}</small></span></div>`).join("");
  a.innerHTML = `<div class="ie-page">${scoreTiles()}
    <section class="ie-block"><h2 class="ie-bh">${ico("timer", 20)}Timed tests</h2>${rows ? `<div class="card ie-list">${rows}</div>` : `<p class="t-sub ie-pad">No timed tests yet. Every unit ends with one.</p>`}</section>
    <section class="ie-block"><h2 class="ie-bh">${ico("chats-circle", 20)}Speaking</h2>${sp ? `<div class="card ie-list">${sp}</div>` : `<p class="t-sub ie-pad">No speaking marked yet.</p>`}</section></div>`;
};
ROUTES.essays = async ([id], a) => {
  const d = pget();
  if(id){
    const e = d.essays.find(x => x.id === id); if(!e) throw new Error("That piece of writing isn't on this device.");
    setTop({title: `Task ${e.task}`, back: "#/essays", backT: "My writing"});
    a.innerHTML = `<div class="ie-page"><div class="card ie-card"><p class="ie-kicker">${when(e.at)} · ${e.words} words${e.band != null ? ` · your estimate: band ${fmtBand(e.band)}` : ""}</p>
      <p class="ie-prompt">${md(e.prompt)}</p></div><article class="card ie-card ie-essay">${String(e.text).split(/\n\s*\n|\n/).filter(s => s.trim()).map(p => `<p>${esc(p)}</p>`).join("")}</article>
      <div class="ie-dock"><button type="button" class="glass-btn glass-btn--sm" id="ie-copy">${ico("copy", 18)}Copy text</button></div></div>`;
    a.querySelector("#ie-copy").onclick = () => { try{ navigator.clipboard.writeText(e.text).then(() => toast("Copied."), () => toast("Couldn't copy.")); }catch(err){ toast("Couldn't copy."); } };
    return;
  }
  setTop({title: "My writing", back: "#/", backT: "IELTS Prep"});
  const rows = d.essays.slice().reverse().map(e => `<a class="ie-row" href="#/essays/${encodeURIComponent(e.id)}"><span class="ie-num t-num">${e.band != null ? fmtBand(e.band) : "T" + e.task}</span>
    <span class="ie-row-t">${esc(String(e.prompt).replace(/\*/g, "").slice(0, 90))}…<small>Task ${e.task} · ${e.words} words · ${when(e.at)}</small></span>${ico("caret-right", 18, "ie-chev")}</a>`).join("");
  a.innerHTML = `<div class="ie-page"><p class="t-sub ie-pad">Everything you finish in a writing task is kept here, on this device.</p>
    ${rows ? `<div class="card ie-list">${rows}</div>` : `<p class="t-sub ie-pad">Nothing yet.</p>`}</div>`;
};
ROUTES.settings = async (_, a) => {
  setTop({title: "Settings", back: "#/", backT: "IELTS Prep", right: "<span></span>"});
  const rate = ui().rate || 1, v = voices();
  a.innerHTML = `<div class="ie-page">
    <section class="ie-block"><h2 class="ie-bh">${ico("speaker-high", 20)}Voice</h2><div class="card ie-card">
      <p class="t-sub">Listening recordings are read by this device's ${v && v.gb ? "British" : "English"} voices${v && v.f !== v.m ? ` (${esc(v.f.name)} and ${esc(v.m.name)})` : ""}. The exam speaks at normal speed.</p>
      <div class="ie-seg" role="radiogroup" aria-label="Speed">${[[.85, "Slower"], [1, "Exam speed"], [1.1, "Faster"]].map(([r, t]) =>
        `<button type="button" role="radio" aria-checked="${Math.abs(rate - r) < .01}" data-rate="${r}">${t}</button>`).join("")}</div>
      <button type="button" class="glass-btn glass-btn--sm" id="ie-vt">${ico("play", 18)}Try the voices</button></div></section>
    <section class="ie-block"><h2 class="ie-bh">${ico("info", 20)}About</h2><div class="card ie-card">
      <p class="t-sub">All material here is original and written for this app; it is not affiliated with IELTS, the British Council, IDP or Cambridge. Bands for Listening and Reading use the usual Academic conversion; Writing and Speaking are your own estimates.</p>
      <p class="t-sub">Your progress stays on this device. Recordings are never saved or sent anywhere.</p></div></section>
    <section class="ie-block"><h2 class="ie-bh">${ico("trash", 20)}Start again</h2><div class="card ie-card">
      <p class="t-sub">Erase your results, writing and drafts on this device.</p>
      <button type="button" class="glass-btn glass-btn--sm" id="ie-erase">${ico("trash", 18)}Erase my progress</button></div></section></div>`;
  a.querySelectorAll("[data-rate]").forEach(b => b.onclick = () => {
    uiSet({rate: +b.dataset.rate}); a.querySelectorAll("[data-rate]").forEach(x => x.setAttribute("aria-checked", x === b)); speak("This is the speed you'll hear.", {voice: "f"});
  });
  a.querySelector("#ie-vt").onclick = voiceTest;
  a.querySelector("#ie-erase").onclick = () => { if(confirm("Erase all your IELTS Prep progress on this device?")){ prog.erase(); toast("Progress erased."); go("#/"); } };
};

Object.assign(IE, {esc, md, ico, LS, isObj, data, band, roundBand, fmtBand, prog, ui, uiSet, speak, stopSpeak, canSpeak, voices, voiceTest,
  ROUTES, route, go, setTop, toast, KIND_T, when});

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
  addEventListener("hashchange", route);
  route();
}
if(D.readyState === "loading") D.addEventListener("DOMContentLoaded", start); else start();
})();
