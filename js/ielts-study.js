/* IELTS Prep: the study engine. Loaded by ielts.html after js/ielts-player.js.
   · Adds: the review deck (spaced retrieval and successive relearning of the questions you missed, played by the real
     player as the virtual lesson #/lesson/review), the mistake notebook ("Where my marks go", the TRUE/FALSE/NOT GIVEN
     confusion table, accuracy by question type), a light exam plan (exam date, this week's advice, essays to rewrite
     from memory), all on #/review, the Review card on home, and IE.assess: self-marking against descriptor checklists
     and exemplar calibration, for the player and My writing.
   · Stores one key, "ielts:study" = {v:1, cards:{qid: {lid, box, due, hits, last, n, p?, sec?}}, log:[{q, l, k, s, ok,
     tag?, x?, g?, m?, c?, a?, at}], session:{at, ids:[qid], ord:{qid:[original index…]}} | null,
     exam:{date:"YYYY-MM-DD", from} | null, examAt?, calib:[{iid, x, guess, band, at}], mig?, at}. at = the time of the
     last write (a restore from a backup takes the newer copy); examAt = when the exam date was last set or cleared (the
     Drive copy in js/ielts-boot.js keeps the newer date by it, not by at). Card: p = the reading/listening
     item a set question lives in (a "wrapped" card), sec = when it was retired as secure. Log: x = a standalone
     exercise (not an exam-format question), g/m = marks got/available when a question is worth more than one, c/a = the
     right and the given answer of TRUE/FALSE/NOT GIVEN. Every read and write goes through IE.LS (try/catch); a missing
     or damaged key is built again (a damaged one is copied once to "ielts:study:bak"). Nothing is written outside
     ielts:*; ielts:run:review is deleted when a new review session starts.
   · Wraps once, at load: IE.prog.done (logs every finished lesson and updates the deck; the virtual "review" lesson is
     graded here and never reaches the original), IE.data.lesson ("review" → the virtual lesson and its unit),
     IE.ROUTES.home (the Review card before .ie-scores) and IE.ROUTES.unit ("review" → the Review page). Adds
     IE.ROUTES.review, IE.assess = {selfHtml, wireSelf, selfBand, CRIT} and IE.study (the engine, for the tests). */
(() => {
"use strict";
const W = window, D = document, IE = W.IE;
if(!IE || !IE.prog || !IE.data || !IE.ROUTES || IE.study) return;
const {esc, md, ico, LS, isObj, data, prog, ROUTES, fmtBand, roundBand, toast} = IE;
const SK = "ielts:study", RV = "review", RK = lid => `ielts:run:${lid}`, RUN_RE = /^ielts:run:(u\d{2}-l\d+)$/;
const DAY = 864e5, INT = [1, 3, 7, 14, 30, 60], LOG_MAX = 3000, CAL_MAX = 200, PER_SESSION = 20, WRAP_MAX = 5;
const SCORED = new Set(["pick", "multi", "tfng", "gap", "select", "order"]);
const P = () => IE.player || null;
const clone = o => JSON.parse(JSON.stringify(o));
const when = t => new Date(t).toLocaleDateString("en-GB", {weekday: "short", day: "numeric", month: "short"});
const whenY = t => new Date(t).toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"});
const plural = (n, w, ws) => `${n} ${n === 1 ? w : ws || w + "s"}`;

/* ---------- days (local midnight, so DST never shifts a due date) ---------- */
const day0 = t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const addDays = (t, n) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime(); };
const parseDay = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "")); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null; };
const ymd = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const daysBetween = (a, b) => Math.round((day0(b) - day0(a)) / DAY);

/* ---------- storage ---------- */
const blank = () => ({v: 1, cards: {}, log: [], session: null, exam: null, calib: []});
let RO = false, bakDone = false, migDone = false;
function sget(){
  let raw = null; try{ raw = localStorage.getItem(SK); }catch(e){}
  let o = null;
  if(raw != null){ try{ o = JSON.parse(raw); }catch(e){ o = null; } }
  if(raw != null && !(isObj(o) && o.v >= 1) && !bakDone){ bakDone = true; try{ localStorage.setItem(SK + ":bak", raw); }catch(e){} }
  RO = isObj(o) && o.v > 1;   /* written by a newer version of the app: read it, never overwrite it */
  const s = isObj(o) && o.v >= 1 ? o : blank();
  if(!isObj(s.cards)) s.cards = {};
  for(const [k, c] of Object.entries(s.cards)) if(!isObj(c) || typeof c.lid !== "string" || !(c.box >= 0) || !(c.due > 0)) delete s.cards[k];
  if(!Array.isArray(s.log)) s.log = []; else s.log = s.log.filter(e => isObj(e) && typeof e.q === "string");
  if(!Array.isArray(s.calib)) s.calib = []; else s.calib = s.calib.filter(e => isObj(e) && typeof e.guess === "number" && typeof e.band === "number");
  if(!(isObj(s.session) && Array.isArray(s.session.ids) && s.session.at > 0)) s.session = null;
  else if(!isObj(s.session.ord)) s.session.ord = {};
  if(!(isObj(s.exam) && parseDay(s.exam.date))) s.exam = null;
  return s;
}
function sset(s){
  if(RO) return false;
  if(migDone) s.mig = 1;
  s.at = Date.now();   /* core's restore keeps whichever copy of ielts:study is newer */
  s.log = s.log.slice(-LOG_MAX); s.calib = s.calib.slice(-CAL_MAX);
  if(LS.set(SK, s)) return true;
  s.log = s.log.slice(-Math.floor(LOG_MAX / 3));   /* storage is full: keep the newest answers */
  if(LS.set(SK, s)) return true;
  toast("Couldn't save your review on this device: storage is full.");
  return false;
}

/* ---------- scheduling ---------- */
function examLeft(s, t = Date.now()){ const e = s.exam && parseDay(s.exam.date); return e ? daysBetween(t, e) : null; }
/* with an exam date ahead, no interval is longer than max(1, 20% of the days left) */
function capDays(s, t = Date.now()){ const left = examLeft(s, t); return left != null && left > 0 ? Math.max(1, Math.floor(left * .2)) : Infinity; }
const effDue = (c, s, t = Date.now()) => { const cap = capDays(s, t); return cap === Infinity ? c.due : Math.min(c.due, addDays(c.last || c.due, cap)); };
const isDue = (c, s, t = Date.now()) => !c.sec && effDue(c, s, t) <= t;
const later = (s, t, n) => addDays(t, Math.min(n, capDays(s, t)));
/* a question met in a lesson: a standalone item of a learn or practice lesson always becomes a card (missed → box 0,
   back tomorrow; right → box 1, in 3 days); a set question only when missed. A card already in the deck that is missed
   again drops two boxes (not below 0) and comes back tomorrow; answered right in a lesson it keeps its box (only spaced
   review moves a card up). */
function meet(s, qid, lid, p, ok, make, t){
  let c = s.cards[qid];
  if(!c){
    if(!make && ok) return;
    c = s.cards[qid] = {lid, box: ok ? 1 : 0, due: later(s, t, ok ? INT[1] : INT[0]), hits: ok ? 1 : 0, last: t, n: 1};
    if(p) c.p = p;
    return;
  }
  c.n = (c.n || 0) + 1; c.last = t;
  if(ok) c.hits = (c.hits || 0) + 1;
  else { c.box = Math.max(0, c.box - 2); c.due = later(s, t, 1); delete c.sec; }
}
/* a card graded in review: right → the next box; missed → two boxes down (not below 0), back tomorrow. Right at box 4
   or more with 3 or more hits: retired as secure */
function grade(c, ok, s, t){
  c.n = (c.n || 0) + 1; c.last = t;
  if(ok){
    c.hits = (c.hits || 0) + 1;
    const was = c.box; c.box = Math.min(INT.length - 1, c.box + 1);
    if(was >= 4 && c.hits >= 3) c.sec = t;
    c.due = later(s, t, INT[c.box]);
  } else { c.box = Math.max(0, c.box - 2); c.due = later(s, t, 1); delete c.sec; }
}
function dueList(s, t = Date.now()){
  return Object.entries(s.cards).filter(([, c]) => isDue(c, s, t))
    .sort((a, b) => effDue(a[1], s, t) - effDue(b[1], s, t) || a[1].box - b[1].box || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
/* at most 20 due cards, oldest due first, and at most 5 wrapped ones (a passage or a transcript each) */
function pickDue(s, t = Date.now()){
  const out = []; let w = 0;
  for(const [id, c] of dueList(s, t)){
    if(out.length >= PER_SESSION) break;
    if(c.p){ if(w >= WRAP_MAX) continue; w++; }
    out.push(id);
  }
  return out;
}

/* ---------- the notebook: kinds and tags ---------- */
const KIND_T = {tfng: "TRUE/FALSE/NOT GIVEN", ynng: "YES/NO/NOT GIVEN", form: "Form completion", notes: "Note completion", table: "Table completion",
  flow: "Flow-chart completion", sentence: "Sentence completion", summary: "Summary completion", short: "Short answer", diagram: "Diagram labelling",
  headings: "Matching headings", info: "Matching information", features: "Matching features", endings: "Matching sentence endings",
  plan: "Plan/map labelling", mc: "Multiple choice", mc2: "Choose TWO", order: "Putting in order"};
/* the kind of a question, from its type and the instruction of its set (or its own question for a standalone select) */
function kindOf(q, instr, parent){
  const t = String(instr || "").toLowerCase();
  switch(q.type){
    case "tfng": return q.mode === "ynng" ? "ynng" : "tfng";
    case "pick": return "mc";
    case "multi": return "mc2";
    case "order": return "order";
    case "gap":
      if(/\bforms?\b/.test(t)) return "form";
      if(/flow[- ]?chart/.test(t)) return "flow";
      if(/\btables?\b/.test(t)) return "table";
      if(/\bsummary\b/.test(t)) return "summary";
      if(/\bnotes?\b/.test(t)) return "notes";
      if(/\bsentences?\b/.test(t)) return "sentence";
      if(/\bdiagram\b|\blabel/.test(t)) return "diagram";
      if(parent && /^[^:_]{1,40}:\s/.test(String(q.text || ""))) return parent.type === "listening" && parent.part === 1 ? "form" : "notes";
      return parent ? "short" : "sentence";
    case "select":
      if(/heading/.test(t)) return "headings";
      if(/which paragraph|paragraph contains|\binformation\b/.test(t)) return "info";
      if(/\bendings?\b/.test(t)) return "endings";
      if(/\bplan\b|\bmap\b|\blabel/.test(t)) return "plan";
      if(/\bsummary\b|list of words/.test(t)) return "summary";
      return "features";
  }
  return q.type;
}
const NUMW = {one: 1, two: 2, three: 3, four: 4, five: 5};
/* "ONE WORD AND/OR A NUMBER" → {w: 1, n: 1}; "NO MORE THAN TWO WORDS" → {w: 2, n: 0}; "A NUMBER" → {w: 0, n: 1} */
function parseLimit(s){
  const t = String(s || "").toLowerCase(), num = /\bnumber\b/.test(t);
  if(/^\s*(write\s+)?a number\.?\s*$/.test(t)) return {w: 0, n: 1};
  const m = /\b(one|two|three|four|five)(?:\s+or\s+(one|two|three|four|five))?\s+words?\b/.exec(t);
  return m ? {w: NUMW[m[2] || m[1]], n: num ? 1 : 0} : null;
}
/* words beyond the limit: a hyphenated word counts as one, a number as a word unless the limit allows one; a run of
   tokens with digits is one number (07700 911483, BS7 4QD), as in the validator */
function overLimit(v, lim){
  let nums = 0, words = 0, prevNum = false;
  for(const x of String(v).trim().split(/\s+/).filter(Boolean)){
    const d = /\d/.test(x);
    if(d){ if(!prevNum) nums++; } else words++;
    prevNum = d;
  }
  return words + Math.max(0, nums - lim.n) > lim.w;
}
/* edit distance where swapping two adjacent letters counts as one edit (optimal string alignment): feild → field is 1 */
function lev(a, b){
  if(a === b) return 0; if(!a.length) return b.length; if(!b.length) return a.length;
  if(Math.abs(a.length - b.length) > 3) return 9;
  let prev2 = null, prev = Array.from({length: b.length + 1}, (_, i) => i);
  for(let i = 1; i <= a.length; i++){
    const cur = [i];
    for(let j = 1; j <= b.length; j++){
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if(i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
    }
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}
const isPlural = (x, v) => [x + "s", x + "es", x.replace(/y$/, "ies")].includes(v) || [v + "s", v + "es", v.replace(/y$/, "ies")].includes(x);
const TFL = {T: "T", F: "F", NG: "NG", Y: "Y", N: "N"};
function tfTag(c, a){
  const pair = [c, a].sort((x, y) => "TYFNNG".indexOf(x) - "TYFNNG".indexOf(y));
  return pair[0] in TFL && pair[1] in TFL ? `${pair[0]}↔${pair[1]}` : "unanswered";
}
const blankAns = a => a == null || (typeof a === "string" && !a.trim()) || (Array.isArray(a) && !a.length) || (isObj(a) && !Object.keys(a).length);
/* why a question lost marks (null when it didn't) */
function tagOf(q, a){
  const pl = P(); if(!pl) return null;
  if(pl.mark(q, a) === pl.marks(q)) return null;
  if(blankAns(a)) return "unanswered";
  switch(q.type){
    case "gap": {
      const v = pl.norm(a), acc = q.answer.map(pl.norm), lim = parseLimit(q.limit);
      if(lim && overLimit(v, lim)) return "word limit";
      if(/\d/.test(v) || acc.some(x => /\d/.test(x))) return "number format";
      if(acc.some(x => isPlural(x, v))) return "singular/plural";
      if(acc.some(x => { const d = lev(x, v); return d > 0 && d <= (x.length >= 6 ? 2 : 1); })) return "spelling";
      return "wrong word";
    }
    case "tfng": return tfTag(q.answer, a);
    case "pick": return "distractor";
    case "multi": return Array.isArray(a) && a.some(x => !q.answer.includes(x)) ? "distractor" : "unanswered";
    case "select": return isObj(a) && q.rows.some((r, i) => a[i] != null && +a[i] !== r.answer) ? "wrong match" : "unanswered";
    case "order": return !Array.isArray(a) || a.length < q.items.length ? "unanswered" : "wrong order";
  }
  return "wrong word";
}
const REMEDY = {
  "word limit": "re-read the instruction; a hyphenated word counts as one, and a number as a word unless a number is allowed.",
  "spelling": "every letter counts: check double letters and endings, and copy words from the passage exactly.",
  "singular/plural": "check whether the gap needs a singular or a plural: look at the article and the verb around it.",
  "number format": "write numbers in digits, keep the unit outside the gap and listen for corrections ('no, sorry, fifteen').",
  "wrong word": "predict the kind of word before you read or listen, and match the meaning, not the words you see.",
  "T↔NG": "TRUE needs the passage to say it; if you have to assume or infer it, it's NOT GIVEN.",
  "F↔NG": "FALSE needs the passage to contradict the statement; if the point simply isn't there, it's NOT GIVEN.",
  "T↔F": "check the qualifiers (some, all, only, usually, first): one word can turn TRUE into FALSE.",
  "Y↔NG": "YES needs the writer to state the view; if you have to guess what the writer thinks, it's NOT GIVEN.",
  "N↔NG": "NO needs the writer to reject the claim; if the writer doesn't address it, it's NOT GIVEN.",
  "Y↔N": "check whose view it is and how strong it is: reported claims and hedges change the answer.",
  "distractor": "an option that repeats words from the text is often the trap: check that the whole option matches the meaning.",
  "wrong match": "match ideas, not shared words, and cross out options you've used when each can be used only once.",
  "wrong order": "find the sequence markers (first, then, once, finally) before you order the steps.",
  "unanswered": "never leave a blank: a wrong answer costs nothing, so always write your best guess.",
};
/* the unit that teaches each kind (Reading and Listening) */
const TEACH = {
  reading: {tfng: "u07", ynng: "u10", headings: "u08", info: "u08", features: "u08", endings: "u10", summary: "u09", sentence: "u09", notes: "u09",
    table: "u09", flow: "u09", diagram: "u09", short: "u09", mc: "u09", mc2: "u09"},
  listening: {form: "u03", short: "u03", table: "u03", plan: "u04", diagram: "u04", features: "u04", mc: "u05", mc2: "u05", notes: "u06",
    flow: "u06", sentence: "u06", summary: "u06"},
};
/* the notebook's numbers: exam-format questions (Reading and Listening sets) of real lessons only */
function notebook(s, t = Date.now()){
  const ex = s.log.filter(e => !e.x && e.l !== RV && (e.s === "reading" || e.s === "listening"));
  const since = t - 30 * DAY, recent = ex.filter(e => +e.at >= since);
  const lost = (e) => (e.m || 1) - (e.g != null ? e.g : e.ok ? 1 : 0);
  const tags = {}; let lostAll = 0, marksAll = 0;
  for(const e of recent){ marksAll += e.m || 1; if(!e.ok){ const n = lost(e); lostAll += n; if(e.tag) tags[e.tag] = (tags[e.tag] || 0) + n; } }
  const TF3 = {T: "T", Y: "T", F: "F", N: "F", NG: "NG"};
  const conf = {T: {T: 0, F: 0, NG: 0}, F: {T: 0, F: 0, NG: 0}, NG: {T: 0, F: 0, NG: 0}}; let tfBlank = 0;
  for(const e of ex) if((e.k === "tfng" || e.k === "ynng") && TF3[e.c]){ if(TF3[e.a]) conf[TF3[e.c]][TF3[e.a]]++; else tfBlank++; }
  const acc = {};
  for(const e of ex){ const k = `${e.s}|${e.k}`, r = acc[k] || (acc[k] = {s: e.s, k: e.k, n: 0, got: 0}); r.n += e.m || 1; r.got += (e.m || 1) - lost(e); }
  const rows = Object.values(acc).map(r => Object.assign(r, {pct: r.n ? Math.round(r.got / r.n * 100) : 0, unit: (TEACH[r.s] || {})[r.k] || null}))
    .sort((a, b) => a.pct - b.pct || b.n - a.n);
  const pool = rows.filter(r => r.n >= 3).length >= 3 ? rows.filter(r => r.n >= 3) : rows;
  const weak = pool.filter(r => r.pct < 100).slice(0, 3).map(r => `${r.s}|${r.k}`);
  return {tags: Object.entries(tags).sort((a, b) => b[1] - a[1]), lost: lostAll, marks: marksAll, conf, tfBlank, rows, weak};
}

/* ---------- lessons finished: the log and the deck ---------- */
const origLesson = data.lesson.bind(data);
const blockOf = U => U.block || "";
async function onLesson(lid, run, at){
  const pl = P(); if(!pl) return;
  const found = await origLesson(lid); if(!found) return;
  const {lesson: L, unit: U} = found, ans = isObj(run) && isObj(run.ans) ? run.ans : {};
  const s = sget(), t = at || Date.now();
  const handle = (q, parent, instr, standalone) => {
    const a = ans[q.id], m = pl.marks(q), g = Math.max(0, pl.mark(q, a)), ok = g >= m;
    const e = {q: q.id, l: lid, k: kindOf(q, instr, parent), s: parent ? parent.type : blockOf(U), ok, at: t};
    if(standalone) e.x = 1;
    if(!ok) e.tag = tagOf(q, a);
    if(m > 1){ e.g = g; e.m = m; }
    if(q.type === "tfng"){ e.c = q.answer; e.a = typeof a === "string" && a ? a : null; }
    s.log.push(e);
    meet(s, q.id, lid, parent ? parent.id : null, ok, standalone && L.kind !== "test", t);
  };
  for(const it of L.items){
    if(Array.isArray(it.sets)) for(const st of it.sets) for(const q of st.items) handle(q, it, st.instr, false);
    else if(SCORED.has(it.type)) handle(it, null, it.type === "select" ? it.q : "", true);
  }
  sset(s);
}

/* ---------- the virtual review lesson ---------- */
const PARA_REF = /\bparagraphs?\s+[A-H](?:\s*(?:,|and|or|to|-|–)\s*[A-H])*\b/gi;
/* true when a text refers to options by letter or by position: "(B)", "B is", "option C", "A and D", "A says",
   "the first option" (paragraph letters don't count) */
const A_SUBJ = /(?:^|[.;:!?]\s+)(?:\*\*)?A(?:\*\*)?\s+(?:says|uses|gives|has|keeps|matches|fits|shows|states|means|sounds|repeats|describes|does|doesn't|would|could|also)\b/;
const POS_REF = /\b(?:first|second|third|fourth|fifth|last)\s+(?:options?|answers?|choices?)\b|\bthe\s+(?:former|latter)\b/i;
function letterRefs(txt){
  const t = String(txt || "").replace(PARA_REF, " ");
  return /\(\s*[A-H]\s*\)/.test(t) || /\boptions?\s+[A-H]\b/i.test(t) || /\b[B-H]\b/.test(t)
    || /\bA\b(?=\s*(?:[,;:).]|\band\b|\bor\b|\bis\b|\bwas\b|\bare\b))/.test(t) || /\b(?:and|or|nor|but|while|whereas|unlike|than)\s+A\b/.test(t)
    || A_SUBJ.test(t) || POS_REF.test(t);
}
const TF_OPTS = /^(true|false|not given|yes|no)$/i;
function canShuffle(q){
  if(!(q.type === "pick" || q.type === "multi") || !Array.isArray(q.options) || q.options.length < 2) return false;
  if(letterRefs(q.q) || letterRefs(q.why)) return false;
  const opts = optsOf(q);
  if(opts.every(o => TF_OPTS.test(String(o).trim()))) return false;
  return !opts.some(o => letterRefs(o) || /\b(all|none|both|neither) of (the )?(above|these|them)\b/i.test(o));
}
/* options that start with their own letter ("A  one week") lose it before a shuffle */
const labelled = q => q.options.every((o, j) => new RegExp(`^${String.fromCharCode(65 + j)}[.)]?\\s+`).test(o));
const optsOf = q => labelled(q) ? q.options.map(o => o.replace(/^[A-Z][.)]?\s+/, "")) : q.options.slice();
function perm(n){
  const a = [...Array(n).keys()];
  for(let i = n - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  if(n > 1 && a.every((x, i) => x === i)) [a[0], a[1]] = [a[1], a[0]];
  return a;
}
const validOrd = (ord, q) => Array.isArray(ord) && ord.length === q.options.length && ord.slice().sort((x, y) => x - y).every((x, i) => x === i);
/* ord[i] = the original index of the option now at i; the answer is remapped */
function applyOrd(q, ord){
  const opts = optsOf(q), inv = {};
  ord.forEach((o, i) => { inv[o] = i; });
  q.options = ord.map(i => opts[i]);
  if(q.type === "pick") q.answer = inv[q.answer]; else q.answer = q.answer.map(x => inv[x]).sort((x, y) => x - y);
  return q;
}
function findQ(u, lid, qid, p){
  const L = u.lessons.find(l => l.id === lid); if(!L) return null;
  if(!p){ const it = L.items.find(i => i.id === qid); return it && SCORED.has(it.type) ? {L, it, q: it, st: null} : null; }
  const it = L.items.find(i => i.id === p); if(!it || !Array.isArray(it.sets)) return null;
  for(const st of it.sets){ const q = st.items.find(x => x.id === qid); if(q) return {L, it, q, st}; }
  return null;
}
/* a set question becomes a reading item of its own, with the passage (or the transcript of the recording) */
function wrap(f, q){
  const it = f.it, instr = String(f.st.instr || "").replace(/^Questions?\s+\d+(?:\s*[-–]\s*\d+)?[.:]?\s*/i, "");
  /* the set's visual (the plan, map or diagram to label, the table to complete) goes with the question */
  const set = {instr, items: [q]};
  if(f.st.visual) set.visual = clone(f.st.visual);
  if(it.type === "reading") return {id: `rv-${q.id}`, type: "reading", title: it.title, paragraphs: clone(it.paragraphs), sets: [set]};
  const name = id => ((it.speakers || []).find(x => x.id === id) || {}).name || id;
  return {id: `rv-${q.id}`, type: "reading", title: `Transcript · ${it.title}`,
    paragraphs: (it.script || []).map(l => ({label: null, text: `**${name(l.s)}:** ${l.t}`})), sets: [set]};
}
async function buildItems(sess, s, fresh){
  const items = [], ids = [], meta = {};
  for(const qid of sess.ids){
    const c = s.cards[qid]; if(!c) continue;
    let u; try{ u = await data.unit(c.lid.slice(0, 3)); }catch(e){ continue; }
    const f = findQ(u, c.lid, qid, c.p); if(!f) continue;
    const q = clone(f.q);
    let ord = sess.ord[qid];
    if(fresh && !ord && canShuffle(q)) ord = sess.ord[qid] = perm(q.options.length);
    if(ord && validOrd(ord, q)) applyOrd(q, ord); else delete sess.ord[qid];
    items.push(c.p ? wrap(f, q) : q); ids.push(qid);
    meta[qid] = {k: kindOf(f.q, f.st ? f.st.instr : f.q.type === "select" ? f.q.q : "", c.p ? f.it : null), s: c.p ? f.it.type : blockOf(u)};
  }
  return {items, ids, meta};
}
const reviewUnit = L => ({id: RV, n: 0, title: "Review", block: "review", summary: "", lessons: [L], back: "#/review", backT: "Review"});
const reviewLessonOf = items => ({id: RV, title: "Review", kind: "practice", minutes: 10, items});
function emptyLesson(s){
  const next = Object.values(s.cards).filter(c => !c.sec).map(c => effDue(c, s)).sort((a, b) => a - b)[0];
  const body = Object.keys(s.cards).length
    ? ["Nothing is due today. Every question you've missed comes back here on the day it's due: tomorrow after a miss, then after 3, 7, 14, 30 and 60 days.",
      next ? `The next one is due on ${whenY(next)}.` : "Every card in your deck is secure."]
    : ["Your review deck is empty. Finish a lesson and the questions you miss come back here, spaced out over the following weeks.",
      "Short, spaced retrieval like this is one of the most reliable ways to make what you learn stick."];
  return reviewLessonOf([{id: "rv-none", type: "card", title: "Nothing due today", body, tip: "Meanwhile, look at Where my marks go on the Review page: it shows where your marks are lost."}]);
}
let cur = null, building = null;   /* cur: the review lesson in play {at, items, meta} */
function reviewLesson(){
  if(building) return building;
  building = (async () => {
    await pending;   /* a migration or a lesson being logged writes the deck first (nothing in that chain waits on this) */
    let s = sget();
    const t = Date.now();
    if(s.session){
      const r = await buildItems(s.session, s, false);
      if(r.items.length){ cur = {at: s.session.at, items: r.items, meta: r.meta}; const L = reviewLessonOf(r.items); return {lesson: L, unit: reviewUnit(L)}; }
      s = sget(); s.session = null;   /* read again: the store may have changed while the units loaded */
    }
    LS.del(RK(RV));   /* a new session starts afresh */
    const ids = pickDue(s, t);
    if(!ids.length){ cur = null; if(!RO && LS.get(SK) != null) sset(s); const L = emptyLesson(s); return {lesson: L, unit: reviewUnit(L)}; }
    const sess = {at: t, ids, ord: {}}, r = await buildItems(sess, s, true);
    sess.ids = r.ids; s = sget(); s.session = r.ids.length ? sess : null; sset(s);
    if(!r.items.length){ cur = null; const L = emptyLesson(s); return {lesson: L, unit: reviewUnit(L)}; }
    cur = {at: t, items: r.items, meta: r.meta};
    const L = reviewLessonOf(r.items); return {lesson: L, unit: reviewUnit(L)};
  })();
  const b = building; b.then(() => { building = null; }, () => { building = null; });
  return b;
}
/* the end of a review: each card graded against the session's own copy of its question */
function finishReview(run){
  const s0 = sget(), sess = s0.session, pl = P(); if(!sess || !pl) return Promise.resolve(false);
  const ans = isObj(run) && isObj(run.ans) ? run.ans : {};
  const apply = (items, meta) => {
    const s = sget(); if(!s.session || s.session.at !== sess.at) return false;
    const t = Date.now();
    for(const x of pl.questions({items})){
      const q = x.q, a = ans[q.id], g = Math.max(0, pl.mark(q, a)), ok = g >= x.m, mt = meta[q.id] || {k: kindOf(q, "", null), s: ""};
      const c = s.cards[q.id]; if(c) grade(c, ok, s, t);
      const e = {q: q.id, l: RV, k: mt.k, s: mt.s, ok, at: t};
      if(!ok) e.tag = tagOf(q, a);
      if(x.m > 1){ e.g = g; e.m = x.m; }
      if(q.type === "tfng"){ e.c = q.answer; e.a = typeof a === "string" && a ? a : null; }
      s.log.push(e);
    }
    s.session = null; cur = null; sset(s); return true;
  };
  if(cur && cur.at === sess.at) return Promise.resolve(apply(cur.items, cur.meta));
  return buildItems(sess, s0, false).then(r => apply(r.items, r.meta));
}

/* ---------- wrappers (installed once) ---------- */
let pending = Promise.resolve();
const origDone = prog.done;
prog.done = function(lid, rec){
  if(lid === RV){
    let run = null; try{ run = LS.get(RK(RV)); }catch(e){}
    pending = pending.then(() => finishReview(run)).catch(e => console.error(e));
    return Object.assign({}, rec, {done: true, at: Date.now()});
  }
  const r = origDone.apply(this, arguments);
  let run = null; try{ run = LS.get(RK(lid)); }catch(e){}
  pending = pending.then(() => onLesson(lid, run)).catch(e => console.error(e));
  return r;
};
data.lesson = function(lid){ return lid === RV ? reviewLesson() : origLesson(lid); };
const origHome = ROUTES.home, origUnit = ROUTES.unit;
ROUTES.home = async function(rest, a){
  const r = await origHome.apply(this, arguments);
  try{ homeCard(a); }catch(e){ console.error(e); }
  return r;
};
ROUTES.unit = function(rest, a){ return rest && rest[0] === RV ? ROUTES.review([], a) : origUnit.apply(this, arguments); };

/* ---------- home: the Review card ---------- */
function homeCard(a){
  if(!a || a.querySelector("#ie-rvcard")) return;
  const s = sget(), n = dueList(s).length, inPlay = !!s.session;
  const el = D.createElement("a");
  el.className = "card ie-card ie-rvcard"; el.id = "ie-rvcard"; el.href = "#/review";
  el.innerHTML = `<span class="ie-rvc-ico">${ico("cards", 24)}</span><span class="ie-rvc-t"><span class="t-head">Review · ${n ? `${n} due` : inPlay ? "in progress" : "Nothing due today"}</span>
    <small class="t-note">${n || inPlay ? "The questions you missed, back at the right time · about 10 minutes" : "Your mistake notebook and exam plan"}</small></span>${ico("caret-right", 18, "ie-chev")}`;
  const sc = a.querySelector(".ie-scores");
  if(sc) sc.parentNode.insertBefore(el, sc);
  else { const pg = a.querySelector(".ie-page"); if(pg) pg.appendChild(el); }
}

/* ---------- #/review ---------- */
const skillT = s => s ? s[0].toUpperCase() + s.slice(1) : "";
function deckHtml(s){
  const t = Date.now(), due = dueList(s, t), all = Object.values(s.cards), secure = all.filter(c => c.sec).length;
  const live = all.filter(c => !c.sec), next = live.filter(c => !isDue(c, s, t)).map(c => effDue(c, s, t)).sort((x, y) => x - y)[0];
  const run = LS.get(RK(RV)), going = !!s.session && isObj(run) && !run.finished && (run.i > 0 || (isObj(run.ans) && Object.keys(run.ans).length));
  const inS = s.session ? s.session.ids.length : 0;
  const lastAt = s.log.reduce((m, e) => e.l === RV && +e.at > m ? +e.at : m, 0), last = lastAt ? s.log.filter(e => e.l === RV && +e.at === lastAt) : [];
  const head = going ? "Review in progress" : s.session ? `${plural(inS, "question")} in today's session` : due.length ? `${plural(due.length, "question")} due` : "Nothing due today";
  return `<section class="card ie-card ie-rv-deck" aria-labelledby="ie-rv-dh"><p class="ie-kicker">${ico("cards", 18)}Review deck</p>
    <h2 class="t-2" id="ie-rv-dh">${esc(head)}</h2>
    <p class="t-sub">${due.length > PER_SESSION && !s.session ? `${due.length} are due; a session takes the ${PER_SESSION} that have waited longest, about 10 minutes. ` : ""}A question you miss comes back tomorrow; one you get right comes back after 3, 7, 14, 30 and then 60 days, until it's secure.</p>
    ${due.length || s.session ? `<a class="glass-btn glass-btn--pri ie-rv-go" id="ie-rv-go" href="#/lesson/review">${ico("play", 18)}${going ? "Continue" : "Start today's review"}</a>` : ""}
    <dl class="ie-rv-stats"><div><dt>In the deck</dt><dd class="t-num">${live.length}</dd></div><div><dt>Secure</dt><dd class="t-num">${secure}</dd></div>
      <div><dt>Next due</dt><dd>${due.length ? "Today" : next ? esc(when(next)) : "–"}</dd></div></dl>
    ${last.length ? `<p class="t-note ie-rv-last">Last review, ${esc(when(lastAt))}: ${last.filter(e => e.ok).length} of ${last.length} right.</p>` : ""}</section>`;
}
function marksHtml(nb){
  const rows = nb.tags.map(([tag, n]) => `<li><b class="t-num ie-rv-n">${n}</b><span><b>${esc(tag)}</b>: ${esc(REMEDY[tag] || "")}</span></li>`).join("");
  return `<section class="ie-block" aria-labelledby="ie-rv-mh"><h2 class="ie-bh" id="ie-rv-mh">${ico("target", 20)}Where my marks go</h2>
    <div class="card ie-card ie-rv-marks"><p class="t-note">Your Reading and Listening questions in the last 30 days${nb.marks ? `: ${plural(nb.lost, "mark")} lost out of ${nb.marks}` : ""}. At band 8.5–9 the margin is one to three questions per paper, so these are the marks to win back.</p>
      ${rows ? `<ul class="ie-rv-tags">${rows}</ul>` : `<p class="t-sub">${nb.marks ? "No marks lost in the last 30 days." : "Nothing yet: finish a Reading or Listening lesson and every mark you lose is sorted here by its cause."}</p>`}</div></section>`;
}
function confHtml(nb){
  const L = [["T", "TRUE"], ["F", "FALSE"], ["NG", "NOT GIVEN"]], tot = L.reduce((x, [r]) => x + L.reduce((y, [c]) => y + nb.conf[r][c], 0), 0);
  return `<section class="ie-block" aria-labelledby="ie-rv-ch"><h2 class="ie-bh" id="ie-rv-ch">${ico("list-checks", 20)}TRUE, FALSE or NOT GIVEN</h2>
    <div class="card ie-card"><p class="t-note">The right answer (rows) against what you wrote (columns), from every TRUE/FALSE/NOT GIVEN and YES/NO/NOT GIVEN question you've answered here (YES counts as TRUE, NO as FALSE).</p>
    ${tot || nb.tfBlank ? `<div class="ie-tw"><table class="ie-table ie-rv-conf"><caption class="vh">TRUE/FALSE/NOT GIVEN confusion table</caption>
      <thead><tr><th scope="col">Answer</th>${L.map(([, t]) => `<th scope="col">You: ${t}</th>`).join("")}</tr></thead>
      <tbody>${L.map(([r, t]) => `<tr><th scope="row">${t}</th>${L.map(([c]) => `<td class="t-num${r === c ? " is-ok" : nb.conf[r][c] ? " is-miss" : ""}" data-r="${r}" data-c="${c}">${nb.conf[r][c]}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      ${nb.tfBlank ? `<p class="t-min">${plural(nb.tfBlank, "question")} left blank.</p>` : ""}` : `<p class="t-sub">Nothing yet. Units 7 and 10 practise these questions.</p>`}</div></section>`;
}
function accHtml(nb){
  const row = r => {
    const weak = nb.weak.includes(`${r.s}|${r.k}`), u = r.unit && data.row(r.unit), name = `${skillT(r.s)} · ${KIND_T[r.k] || r.k}`;
    return `<li class="ie-rv-a${weak ? " is-weak" : ""}" data-k="${esc(r.s + "|" + r.k)}"><div class="ie-rv-ah"><span class="ie-rv-at">${esc(name)}</span>
      <span class="ie-rv-pc"><b class="t-num" data-pct>${r.pct}%</b> <small>of <span class="t-num" data-n>${r.n}</span> ${r.n === 1 ? "mark" : "marks"}</small></span></div>
      <span class="ie-rv-bar" aria-hidden="true"><span style="width:${r.pct}%"></span></span>
      ${weak && u ? `<a class="ie-rv-link" href="#/unit/${u.id}">${ico("caret-right", 14)}Practise it: Unit ${u.n} · ${esc(u.title)}</a>` : ""}</li>`;
  };
  return `<section class="ie-block" aria-labelledby="ie-rv-ah"><h2 class="ie-bh" id="ie-rv-ah">${ico("book-open-text", 20)}Accuracy by question type</h2>
    <div class="card ie-card">${nb.rows.length ? `<p class="t-note">The share of marks you got on each type of Reading and Listening question, weakest first. The weakest three link to the unit that teaches them.</p>
      <ul class="ie-rv-accl" aria-label="Accuracy by question type">${nb.rows.map(row).join("")}</ul>` : `<p class="t-sub">Nothing yet: it fills in as you answer Reading and Listening questions.</p>`}</div></section>`;
}
/* the exam plan: weeks left and this week's advice (no streaks, no countdown) */
function planInfo(s, t = Date.now()){
  if(!s.exam) return null;
  const ex = parseDay(s.exam.date), left = daysBetween(t, ex), weeks = Math.floor(left / 7);
  const from = Math.min(day0(s.exam.from || t), day0(t)), total = Math.max(1, daysBetween(from, ex));
  const m1 = addDays(from, Math.round(total / 3)), m2 = addDays(from, Math.round(total * 2 / 3)), f1 = addDays(ex, -10), f2 = addDays(ex, -7);
  const thisWeek = d => d >= day0(t) && d < addDays(t, 7);
  let lines, mock = "";
  if(left < 0) return {left, weeks, head: "Your exam date has passed", lines: ["Set the date of your next exam, or clear it to plan without one."]};
  if(left <= 2) lines = ["A light review only, and plenty of sleep: nothing new now.", "Read through Where my marks go once, calmly."];
  else if(weeks >= 8){
    lines = ["Follow the path in order, one unit at a time.", "Two timed practices a week: a Reading and a Listening test.",
      "One Task 1 and one Task 2 a week, each rewritten as a version 2 a few days later.", "Review daily: about 10 minutes."];
    mock = `Full mocks at about one third and two thirds of the time (around ${when(m1)} and ${when(m2)}), and a final mock 7–10 days before (${when(f1)} to ${when(f2)}).`;
    if(thisWeek(m1) || thisWeek(m2)) lines.unshift("This week: a full mock (Unit 23 or 24) under exam conditions, in one sitting.");
  } else if(weeks >= 4){
    lines = ["Work on the units of your weakest skill first; skip what you already do well.", "Two timed practices a week, and one essay a week with a version 2.",
      "Review daily, and read Where my marks go after every test."];
    mock = `A full mock in the next fortnight, and a final mock 7–10 days before (${when(f1)} to ${when(f2)}).`;
  } else {
    lines = ["Mocks, the mistake notebook and review only: no new units now.", "One full mock a week under exam conditions; the last one 7–10 days before the exam.",
      "After each mock, read Where my marks go and work on the cause at the top.", "Review daily: about 10 minutes."];
    if(thisWeek(f1) || thisWeek(f2)) lines.unshift("This week: your final mock, in one sitting.");
  }
  const head = left === 0 ? "Your exam is today" : weeks >= 1 ? `${plural(weeks, "week")} to go` : `${plural(left, "day")} to go`;
  return {left, weeks, head, lines, mock};
}
function planInner(s){
  const p = planInfo(s);
  if(!p) return `<p class="t-sub">Add the date of your exam to get each week's advice. With a date, no review interval is longer than a fifth of the days left.</p>`;
  return `<p class="t-head ie-rv-wk">${esc(p.head)}</p><ul class="ie-ul ie-rv-adv">${p.lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>${p.mock ? `<p class="t-note">${esc(p.mock)}</p>` : ""}`;
}
function planHtml(s){
  return `<section class="ie-block" aria-labelledby="ie-rv-ph"><h2 class="ie-bh" id="ie-rv-ph">${ico("calendar-blank", 20)}Exam plan</h2>
    <div class="card ie-card ie-rv-plan"><label class="ie-rv-dl" for="ie-exam">Exam date</label>
      <div class="ie-rv-date"><input type="date" id="ie-exam" class="ie-in ie-rv-in" value="${s.exam ? esc(s.exam.date) : ""}" min="${ymd(addDays(Date.now(), -1))}">
        <button type="button" class="glass-btn glass-btn--sm" id="ie-exam-x"${s.exam ? "" : " hidden"}>Clear</button></div>
      <div id="ie-plan-out" aria-live="polite">${planInner(s)}</div>
      <p class="t-min">Real gains are about half a band per 10-12 weeks of intensive study (Elder &amp; O'Loughlin 2003).</p></div></section>`;
}
/* up to 3 first versions older than 3 days with no version 2 yet (newest first) */
function toRewrite(t = Date.now()){
  let es = []; try{ es = prog.get().essays || []; }catch(e){}
  const has2 = new Set(es.filter(e => e.parent).map(e => e.parent));
  return es.filter(e => isObj(e) && !e.parent && !has2.has(e.id) && +e.at && t - +e.at > 3 * DAY).sort((a, b) => +b.at - +a.at).slice(0, 3);
}
function rewriteHtml(){
  const es = toRewrite(); if(!es.length) return "";
  return `<section class="ie-block" aria-labelledby="ie-rv-wh"><h2 class="ie-bh" id="ie-rv-wh">${ico("pencil-simple", 20)}Rewrite from memory</h2>
    <div class="card ie-list">${es.map(e => `<a class="ie-row" href="#/essays/${encodeURIComponent(e.id)}/revise?blank=1"><span class="ie-num t-num">T${e.task}</span>
      <span class="ie-row-t">${esc(String(e.prompt || "").replace(/\*/g, "").slice(0, 90))}…<small>Task ${e.task} · ${esc(whenY(e.at))} · Rewrite from memory</small></span>${ico("caret-right", 18, "ie-chev")}</a>`).join("")}</div>
    <p class="t-min ie-pad">Writing it again a few days later, without looking at your first version or the model, shows what has really stuck.</p></section>`;
}
ROUTES.review = async (_, a) => {
  IE.setTop({title: "Review", back: "#/", backT: "IELTS Prep"});
  const s = sget(), nb = notebook(s);
  a.innerHTML = `<div class="ie-page ie-rv">
    <header class="ie-hero"><h1 class="t-1">Review</h1><p class="t-sub">Spaced retrieval of what you missed, where your marks go, and a light plan to the exam.</p></header>
    ${deckHtml(s)}${marksHtml(nb)}${confHtml(nb)}${accHtml(nb)}${planHtml(s)}${rewriteHtml()}</div>`;
  const inp = a.querySelector("#ie-exam"), clr = a.querySelector("#ie-exam-x"), out = a.querySelector("#ie-plan-out");
  const saveExam = ev => {
    const st = sget(), v = inp.value;
    if(!v && ev && (ev.type === "input" || (inp.validity && inp.validity.badInput))) return;   /* a date being typed */
    if(v && parseDay(v)) st.exam = {date: v, from: st.exam && st.exam.date ? st.exam.from || Date.now() : Date.now()};
    else if(!v) st.exam = null; else return;
    st.examAt = Date.now();
    sset(st); out.innerHTML = planInner(st); clr.hidden = !st.exam;
  };
  inp.addEventListener("change", saveExam); inp.addEventListener("input", saveExam);
  clr.onclick = () => { inp.value = ""; saveExam(); inp.focus(); };
};

/* ---------- migration: the deck from lessons finished before this file existed ---------- */
function unlocked(){ let inn = false; try{ inn = sessionStorage.getItem("ielts:in") === "1"; }catch(e){} return LS.get("ielts:on") === true && inn; }
function migrate(){
  const s = sget();
  if(s.mig || RO){ migDone = true; return Promise.resolve(); }
  /* js/ielts.js couldn't move every saved answer to the new options this load (storage full): the runs would be graded
     in the old order, so the deck waits for the load that moves them */
  if(IE.migPending) return Promise.resolve();
  const runs = LS.keys().map(k => RUN_RE.exec(k)).filter(Boolean).map(m => [m[1], LS.get(m[0])]).filter(([, r]) => isObj(r) && r.finished && isObj(r.ans));
  if(Object.keys(s.cards).length || !runs.length){ migDone = true; return Promise.resolve(); }
  const done = prog.get().lessons || {};
  runs.sort((x, y) => (+(done[x[0]] || {}).at || 0) - (+(done[y[0]] || {}).at || 0));
  return (async () => {
    /* a unit this device kept from an older version, which can't be fetched again now (offline: data.unit says so with
       e.stale), would leave its runs out of the deck for good: then nothing is written and the next load tries again */
    for(const u of new Set(runs.map(([lid]) => lid.slice(0, 3)))){ try{ await data.unit(u); }catch(e){ if(e && e.stale) return; } }
    for(const [lid, run] of runs){ try{ await onLesson(lid, run, +(done[lid] || {}).at || Date.now()); }catch(e){ console.error(e); } }
    migDone = true; const st = sget(); sset(st);
  })();
}
if(unlocked()) pending = pending.then(migrate).catch(e => console.error(e));
else migDone = true;

/* ---------- IE.assess: self-marking against the descriptors ---------- */
/* Short paraphrases of the public IELTS Writing band descriptors (May 2023) and Speaking band descriptors. A statement
   answered Yes means the response meets it. The checklist band is 6 if any band 7 statement is No, else 7 if any
   band 8 statement is No, else 8 if any band 9 statement is No, else 9. */
const CC = ["Coherence and Cohesion", "Logical, effortless to follow; cohesion so natural it attracts no attention; skilful paragraphing.", {
  7: ["Ideas are logically organised and the text moves forward clearly from start to finish.", "Reference and substitution (this, these, such, do so) carry the links, not only linking words.",
    "Each paragraph has one clear focus."],
  8: ["A reader can follow it with ease: the information comes in a logical sequence throughout.", "Cohesion is well managed, with only an occasional lapse or overused connective.",
    "Paragraphing is sufficient and appropriate."],
  9: ["It can be followed effortlessly.", "The linking almost never draws attention to itself.", "Paragraphing is skilfully managed."]}];
const LRW = ["Lexical Resource", "Wide, precise, natural vocabulary; only very rare slips.", {
  7: ["The vocabulary gives some flexibility and precision, beyond the basic words.", "Some less common words and natural collocations, even if a few are slightly off.",
    "Spelling and word-formation errors are few and never cloud the meaning."],
  8: ["A wide range of vocabulary is used fluently to express precise meanings.", "Less common or idiomatic items are used skilfully where they suit.",
    "At most two word-choice or collocation slips."],
  9: ["Every word choice is precise and natural; nothing sounds forced or memorised.", "Spelling or word-formation slips are extremely rare: one at most."]}];
const GRAW = ["Grammatical Range and Accuracy", "A wide range of structures used flexibly; almost every sentence error-free.", {
  7: ["A variety of complex structures: relative, conditional and participle clauses, for example.", "Error-free sentences are frequent.",
    "Grammar and punctuation are generally well controlled."],
  8: ["A wide range of structures is used flexibly and accurately.", "Most sentences are error-free.", "Errors are occasional and not systematic: no mistake keeps coming back."],
  9: ["Structures are used with full flexibility and control.", "At most one slip in the whole text.", "Punctuation is appropriate throughout."]}];
const CRIT = {
  w1: [["Task Achievement", "A clear overview; every key feature selected, reported accurately and compared; nothing irrelevant.", {
    7: ["A clear overview of the main trends, differences or stages.", "The key features are covered and the figures are accurate, with at most a few slips.",
      "The data are grouped sensibly, not reported item by item."],
    8: ["The key features are skilfully selected and each one is illustrated with the right data.", "Everything the task asks for is covered, with no more than an occasional slip."],
    9: ["All requirements are fully met: nothing important is missing or misreported.", "Every detail earns its place; nothing is irrelevant, speculative or an opinion."]}], CC, LRW, GRAW],
  w2: [["Task Response", "Every part of the question answered in full; a clear position throughout; ideas extended and well supported.", {
    7: ["The main parts of the prompt are addressed.", "The position is clear and developed.", "Main ideas are extended and supported, even if some support is general."],
    8: ["Every part of the prompt is addressed sufficiently.", "A clear, well-developed position runs through the whole essay.",
      "Ideas are relevant, well extended and supported, with only an occasional lapse."],
    9: ["Every part of the prompt answered, ideas explored in depth.", "A fully developed position answers the question directly.",
      "Every idea is relevant and fully supported; lapses are extremely rare."]}], CC, LRW, GRAW],
  s: [["Fluency and Coherence", "Fluent, with only rare hesitation, and then for ideas rather than words; fully coherent and well developed.", {
    7: ["You keep going and give long answers without noticeable effort.", "Hesitation, repetition or self-correction never breaks the thread.",
      "Discourse markers and connectives are used flexibly (actually, mind you, that said)."],
    8: ["Hesitation only occasionally to find words; most pauses are for content.", "Repetition and self-correction are very rare.",
      "Each answer develops the topic coherently and relevantly."],
    9: ["Any pause is to plan what to say, never to find a word or a structure.", "Topics are developed fully and coherently, at the length the question needs."]}],
    ["Lexical Resource", "Precise, idiomatic vocabulary used naturally on every topic, abstract ones included.", {
      7: ["You can talk about a variety of topics, unfamiliar ones included.", "Some less common and idiomatic items, even if not always apt.",
        "When a word escapes you, you paraphrase without losing the thread."],
      8: ["Precise meaning on every topic, conveyed readily and flexibly.", "Less common and idiomatic items are used skilfully, with only occasional slips."],
      9: ["Total flexibility and precision in every context.", "Idiomatic language is accurate and natural throughout."]}],
    ["Grammatical Range and Accuracy", "The full range of structures, natural and accurate.", {
      7: ["Simple and complex sentences are both used effectively, despite some errors.", "Error-free sentences are frequent."],
      8: ["A wide range of structures is used flexibly.", "Most sentences are error-free; errors are occasional and not systematic."],
      9: ["Structures are precise and accurate throughout.", "The only slips are the kind a native speaker makes in conversation."]}],
    ["Pronunciation", "Stress, rhythm and intonation used effortlessly for meaning; always easy to understand.", {
      7: ["You can be understood throughout without much effort.", "Chunking is mostly natural, and stress and intonation often support the meaning.",
        "Mispronounced words cause only the occasional unclear moment."],
      8: ["Easily understood throughout; accent has minimal effect.", "A natural rhythm is sustained, with stress and intonation used flexibly across long turns."],
      9: ["Accent has no effect on intelligibility.", "Connected speech (linking, weak forms, elision) is sustained throughout.",
        "Intonation and stress convey subtle meaning, such as contrast or doubt."]}]],
};
const BANDS = [7, 8, 9];
const ckKeys = list => BANDS.flatMap(b => list[b].map((_, j) => `${b}.${j}`));
/* the band of one criterion's checklist, or null until every statement is answered */
function ckBand(list, ans){
  if(!isObj(ans) || ckKeys(list).some(k => typeof ans[k] !== "boolean")) return null;
  for(const b of BANDS) if(list[b].some((_, j) => ans[`${b}.${j}`] === false)) return b - 1;
  return 9;
}
const critBand = (c, kind, i) => { const k = CRIT[kind] && CRIT[kind][i]; if(!k) return null; const b = ckBand(k[2], isObj(c.ck) ? c.ck[i] : null); return b != null ? b : typeof c[i] === "number" ? c[i] : null; };
/* the estimate: the checklist band for each criterion whose checklist is complete, the tapped band otherwise */
function selfBand(c, kind){
  if(!isObj(c) || !CRIT[kind]) return null;
  const v = CRIT[kind].map((_, i) => critBand(c, kind, i));
  return v.every(x => typeof x === "number") ? roundBand(v.reduce((x, y) => x + y, 0) / v.length) : null;
}
let uid = 0;
const radio = (attrs, label, on, first) => `<button type="button" role="radio" ${attrs} aria-checked="${on}" tabindex="${on || first ? 0 : -1}">${label}</button>`;
function calibAvg(){ const l = sget().calib.slice(-5); return l.length ? {n: l.length, err: l.reduce((x, e) => x + Math.abs(e.guess - e.band), 0) / l.length} : null; }
const calibLine = () => { const c = calibAvg(); return c ? `Your calibration: average error ${(Math.round(c.err * 10) / 10).toFixed(1)} over your last ${c.n === 1 ? "rating" : plural(c.n, "rating")} (aim for 0.5 or less).` : ""; };
const rated = (iid, x) => sget().calib.filter(e => e.iid === iid && (e.x || 0) === x).pop() || null;
function calibResult(ex, r){
  const d = r.guess - ex.band;
  return `<p class="t-head">${d === 0 ? `Spot on: an examiner would give it ${fmtBand(ex.band)}.` : `You said ${fmtBand(r.guess)}; an examiner would give it ${fmtBand(ex.band)}.`}</p>
    ${Array.isArray(ex.notes) && ex.notes.length ? `<ul class="ie-notes">${ex.notes.map(n => `<li>${md(n)}</li>`).join("")}</ul>` : ""}`;
}
function calibHtml(it){
  const xs = it && Array.isArray(it.exemplars) ? it.exemplars.filter(e => isObj(e) && typeof e.band === "number" && Array.isArray(e.text)) : [];
  if(!xs.length) return "";
  return `<section class="ie-calib" data-calib><h3 class="t-head">${ico("target", 18)}Calibrate: rate this answer before you see its band</h3>
    <p class="t-note">People tend to rate their own writing too high. Judging an answer whose band is known first sharpens the eye.</p>
    ${xs.map((ex, x) => { const r = rated(it.id, x), id = `ie-cal-${++uid}`;
      return `<div class="ie-cal1" data-x="${x}"><div class="ie-mtext" lang="en-GB">${ex.text.map(p => `<p>${md(p)}</p>`).join("")}</div>
        <p class="t-note" id="${id}">Your band for this answer:</p>
        <div class="ie-seg ie-bands" role="radiogroup" aria-labelledby="${id}">${[5, 6, 7, 8, 9].map((b, k) => radio(`data-g="${b}"${r ? " disabled" : ""}`, b, !!r && r.guess === b, !r && k === 0)).join("")}</div>
        <div class="ie-cal-res" aria-live="polite">${r ? calibResult(ex, r) : ""}</div></div>`; }).join("")}
    <p class="t-note ie-cal-avg" aria-live="polite">${calibLine()}</p></section>`;
}
function ckInner(kind, i, c){
  const list = CRIT[kind][i][2], ans = isObj(c.ck) && isObj(c.ck[i]) ? c.ck[i] : {}, b = ckBand(list, ans), tap = typeof c[i] === "number" ? c[i] : null;
  const n = ckKeys(list).filter(k => typeof ans[k] === "boolean").length, all = ckKeys(list).length;
  const gap = b != null && tap != null && Math.abs(b - tap) >= 1;
  return {status: b != null ? `Checklist: band ${b}` : `${n} of ${all} answered`,
    res: b != null ? `Checklist: band ${b}.${gap ? ` The checklist says ${b}, you said ${tap}: the checklist is usually closer to an examiner.` : ""}` : "", gap};
}
function selfHtml(kind, cur, it){
  if(!CRIT[kind]) return "";
  const c = isObj(cur) ? cur : {}, est = selfBand(c, kind), base = ++uid;
  return `<div class="ie-self" data-self="${kind}"${it && it.id ? ` data-iid="${esc(it.id)}"` : ""}>${calibHtml(it)}
    <h3 class="t-head">Mark yourself</h3><p class="t-note">Tap a band for each criterion, then check it against the descriptors: people tend to overrate themselves, and the checklist is usually closer to an examiner. Band 9 means:</p>
    ${CRIT[kind].map(([name, d, list], i) => { const ck = ckInner(kind, i, c), hid = `ie-cr-${base}-${i}`;
      return `<div class="ie-crit" data-ci="${i}"><p id="${hid}"><b>${esc(name)}</b><br><span class="t-note">${esc(d)}</span></p>
      <div class="ie-seg ie-bands" role="radiogroup" aria-labelledby="${hid}">${[5, 6, 7, 8, 9].map((b, k) => radio(`data-c="${i}" data-b="${b}"`, b, c[i] === b, typeof c[i] !== "number" && k === 0)).join("")}</div>
      <details class="ie-ck"><summary>${ico("list-checks", 18)}<span>Check against the descriptors</span><small class="ie-ck-st">${esc(ck.status)}</small></summary>
        ${BANDS.map(b => `<p class="ie-ck-b">Band ${b}</p>${list[b].map((st, j) => { const k = `${b}.${j}`, sid = `ie-st-${base}-${i}-${b}-${j}`, v = isObj(c.ck) && isObj(c.ck[i]) ? c.ck[i][k] : undefined;
          return `<div class="ie-st"><span class="ie-st-t" id="${sid}">${esc(st)}</span><span class="ie-yn" role="radiogroup" aria-labelledby="${sid}" data-st="${i}|${k}">
            ${radio(`data-yn="1"`, "Yes", v === true, typeof v !== "boolean")}${radio(`data-yn="0"`, "No", v === false, false)}</span></div>`; }).join("")}`).join("")}
      </details><p class="ie-ck-res${ck.gap ? " is-gap" : ""}" aria-live="polite">${esc(ck.res)}</p></div>`; }).join("")}
    <p class="ie-selfres t-head" aria-live="polite">${est != null ? `Your estimate: band ${fmtBand(est)}` : ""}</p></div>`;
}
/* arrow keys move and choose inside a radiogroup (one tab stop per group) */
function roving(group){
  const rs = [...group.querySelectorAll('[role="radio"]')], on = rs.find(r => r.getAttribute("aria-checked") === "true") || rs.find(r => !r.disabled) || rs[0];
  rs.forEach(r => { r.tabIndex = r === on ? 0 : -1; });
}
function keys(group){
  group.addEventListener("keydown", e => {
    const rs = [...group.querySelectorAll('[role="radio"]:not(:disabled)')], i = rs.indexOf(D.activeElement); if(i < 0) return;
    const j = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % rs.length : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + rs.length) % rs.length
      : e.key === "Home" ? 0 : e.key === "End" ? rs.length - 1 : -1;
    if(j < 0) return;
    e.preventDefault(); rs[j].focus(); rs[j].click();
  });
}
function check(group, btn){ group.querySelectorAll('[role="radio"]').forEach(x => x.setAttribute("aria-checked", x === btn)); roving(group); }
/* set(c, band) runs on every tap: keys 0-3 of c are the bands you tapped, c.ck the checklist answers, c.calc the
   checklist band of each criterion whose checklist is complete */
function wireSelf(el, kind, get, set, it){
  if(!el || !CRIT[kind]) return;
  const box = (el.matches && el.matches(`[data-self="${kind}"]`) && el) || (it && it.id && el.querySelector(`[data-self="${kind}"][data-iid="${CSS.escape(it.id)}"]`)) || el.querySelector(`[data-self="${kind}"]:not([data-wired])`) || el.querySelector(`[data-self="${kind}"]`);
  if(!box || box.dataset.wired) return;
  box.dataset.wired = "1";
  const now = () => { let c = {}; try{ const g = get(); c = isObj(g) ? clone(g) : {}; }catch(e){} return c; };
  const refresh = (c, i) => {
    const crit = box.querySelector(`.ie-crit[data-ci="${i}"]`);
    if(crit){ const ck = ckInner(kind, i, c), r = crit.querySelector(".ie-ck-res"); crit.querySelector(".ie-ck-st").textContent = ck.status; r.textContent = ck.res; r.classList.toggle("is-gap", ck.gap); }
    const est = selfBand(c, kind); box.querySelector(".ie-selfres").textContent = est != null ? `Your estimate: band ${fmtBand(est)}` : "";
  };
  const commit = (c, i) => {
    const calc = {}; CRIT[kind].forEach((k, j) => { const b = ckBand(k[2], isObj(c.ck) ? c.ck[j] : null); if(b != null) calc[j] = b; });
    c.calc = calc;
    try{ set(c, selfBand(c, kind)); }catch(e){ console.error(e); }
    refresh(c, i);
  };
  box.querySelectorAll(".ie-crit .ie-bands").forEach(g => { roving(g); keys(g); g.querySelectorAll("[data-b]").forEach(b => b.onclick = () => {
    const c = now(), i = +b.dataset.c; c[i] = +b.dataset.b; check(g, b); commit(c, i); }); });
  box.querySelectorAll("[data-st]").forEach(g => { roving(g); keys(g); g.querySelectorAll("[data-yn]").forEach(b => b.onclick = () => {
    const [i, k] = g.dataset.st.split("|"), c = now();
    if(!isObj(c.ck)) c.ck = {}; if(!isObj(c.ck[i])) c.ck[i] = {};
    c.ck[i][k] = b.dataset.yn === "1"; check(g, b); commit(c, +i); }); });
  const cal = box.querySelector("[data-calib]");
  if(cal) cal.querySelectorAll(".ie-cal1").forEach(one => {
    const x = +one.dataset.x, ex = it.exemplars[x], g = one.querySelector(".ie-bands"); roving(g); keys(g);
    g.querySelectorAll("[data-g]").forEach(b => b.onclick = () => {
      if(b.disabled || rated(it.id, x)) return;
      const r = {iid: it.id, x, guess: +b.dataset.g, band: ex.band, at: Date.now()}, s = sget();
      s.calib.push(r); sset(s); check(g, b);
      g.querySelectorAll("[data-g]").forEach(y => { y.disabled = true; });
      one.querySelector(".ie-cal-res").innerHTML = calibResult(ex, r);
      cal.querySelector(".ie-cal-avg").textContent = calibLine();
    });
  });
}
IE.assess = {selfHtml, wireSelf, selfBand, CRIT};

IE.study = {get: sget, due: (t) => dueList(sget(), t).map(([id]) => id), pickDue: t => pickDue(sget(), t), notebook: t => notebook(sget(), t),
  tagOf, kindOf, parseLimit, letterRefs, canShuffle, planInfo: t => planInfo(sget(), t), toRewrite, capDays: t => capDays(sget(), t),
  addDays, INT, settled: () => pending.then(() => building || null).then(() => pending), reviewLesson};
})();
