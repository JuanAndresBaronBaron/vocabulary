/* IELTS Prep: the lesson player (#/lesson/<lessonId>) and its results. Loaded by ielts.html after js/ielts.js.
   · learn and practice lessons: one item per screen, «Check» gives the answer and why at once (and says it in a polite
     live region). A writing task can't be passed until «I've finished: compare» shows the checks, the band 9 model and
     the self-marking; the results show them again with a link to revise it later in My writing.
   · test lessons: an intro, then the clock ("timed" seconds). It counts only while the test is on screen: a frozen or
     sleeping page (a gap of 5 s or more between ticks, also watched in exam mode), a hidden page (run.hid) and the time
     spent off the lesson, closed or reloading (from run.at, the last save, to the next load) add to run.away instead,
     and more than two minutes away is reported as "not under exam conditions" (prog.addTest paused). If the time is
     already up when the learner comes back, a «Time is up» card offers Finish and Review (the answers locked, run.over)
     instead of finishing silently. Free movement between items, no feedback until «Finish» (guarded: one click, one
     stored test), then the band (Listening/Reading conversion) and a full review.
   · Listening tests with "exam": true (the computer-delivered exam): after «Start» one controller plays every part in
     order, with no Play buttons: the context, reading time (EXAM.preview s), the script with its pauses (a line's
     "pause": N s), "That is the end of Part N." and checking time (EXAM.check s); after the last part, two minutes to
     check (EXAM.review s, in the top timer), then it finishes by itself. The timed clock doesn't run: the recording sets
     the pace. Moving between items doesn't stop it (a chip offers to go to the part that is playing); leaving or
     reloading does, and «Continue the recording» resumes from the saved line (run.x = {s, k, line, phase, left}); if
     that step is no longer in the data, from the next one that is (never back to Part 1). The time on screen with the
     recording stopped adds to run.away, and the two minutes to check go on by themselves after a reload. The
     reading time shows the range the voice has just named. A mock started before exam mode (no run.xmode) that has
     already used the clock or played a part keeps the timed clock.
     Other test recordings play once; Next, Previous or leaving keeps the line (run.lpos) and «Continue the recording»
     resumes from it. «Played» only once the last line has ended (run.played).
   · No English voice (IE.ensureVoices() resolves 0, the browser can't speak, or the first line's speech fails without
     us stopping it): the transcript instead, "not under exam conditions" (run.noaudio, prog.addTest noaudio). In a test,
     run.heard is set only once the first line has really been spoken. An exam:true test falls back to the timed clock.
   · Speech goes through IE.speak / IE.stopSpeak at call time (tests and other modules wrap them). Each speaker of a
     recording has its own options: voice (f/m), accent, alt (0, 1, 2 for the first, second, third voice of that gender)
     and pitch (1, then .88/1.14 for a second man/woman, .94/1.06 for a third); the context is read by the other gender
     of the first speaker. Tests always play at rate 1 (exam speed), whatever Settings says.
   · Items: card, pick, multi, tfng, gap, select, order (alone or in the sets of a reading or listening; a set may have a
     "visual" drawn by IE.viz), reading (passage and questions side by side, or switched on a phone, keeping the pane and
     the scroll of each pane per item), listening, writing (word count, clock, automatic checks, a band 9 model and marking
     yourself; "visual" and "visual2" drawn above), speaking (the examiner's voice, recording to listen back, a live
     transcript where the browser can, or a timer to the target when there's no microphone; Part 2 follow-up questions),
     say.
   · Self-marking goes through IE.assess ({selfHtml, wireSelf, selfBand}, with descriptors) when it exists, else the
     local versions below.
   · Every screen is a "view": show(), intro(), the «Time is up» card and the results start a new one, which stops the
     microphone and every timer of the old one (a Part 2 preparation can't speak or record on another screen).
   · A lesson in progress is saved as you go ("ielts:run:<lid>" = {v:1, i, ans, checked, heard, self, el, started,
     finished, got, total, band, at} plus away, hid, paused, over, xmode, x, lpos, played, noaudio, panes, rpos, eid, wt,
     smode, sband, fu, counted, attempt, fin; mig and unseen from js/ielts.js): reloading or coming back later picks it
     up. finish() saves the finished run (fin = when this version finished it: js/ielts-study.js has logged it, so its
     one-time deck import leaves it out) before IE.prog.done(lid, rec) and uses what IE.prog.addTest() returns
     ({attempt, counted}). A run is opened through IE.migRun when js/ielts.js provides it (a run whose answers it couldn't
     move this load: moved first, or played without saving). The review marks run.unseen questions as added since. */
(() => {
"use strict";
const W = window, D = document, IE = W.IE;
if(!IE) return;
const {esc, md, ico, LS, isObj, data, band, roundBand, fmtBand, setTop, toast} = IE;
/* looked up at call time: tests and other packages wrap them */
const say = (t, o) => IE.speak(t, o);
const hush = () => { try{ IE.stopSpeak(); }catch(e){} };
const canSay = () => !!(IE.canSpeak && IE.canSpeak());
const P = () => IE.prog;
async function voiceCount(){ try{ return IE.ensureVoices ? await IE.ensureVoices() : 1; }catch(e){ return 1; } }
/* exam timings in seconds (tests shorten them through IE.player.EXAM) */
const EXAM = {preview: 30, check: 30, review: 120};
const EX = () => Object.assign({}, EXAM, IE.player && isObj(IE.player.EXAM) ? IE.player.EXAM : {});
const SCORED = new Set(["pick", "multi", "tfng", "gap", "select", "order"]);
const STOP_ICO = "stop";   /* only in the fill style: ico() of js/ielts.js falls back to it */
const RK = lid => `ielts:run:${lid}`;
const fmtTime = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const words = t => (String(t || "").match(/[A-Za-z0-9’'-]+/g) || []).filter(w => /[A-Za-z0-9]/.test(w)).length;
const plain = s => String(s == null ? "" : s).replace(/\*/g, "");
const calm = () => { try{ return window.M && typeof M.rm === "function" ? !!M.rm() : matchMedia("(prefers-reduced-motion: reduce)").matches || D.documentElement.dataset.motion === "calm"; }catch(e){ return false; } };
const fig = v => v && IE.viz ? `<figure class="ie-viz">${IE.viz.html(v)}</figure>` : "";
/* "…you have some time to look at questions 7 to 10." */
const RANGE = /questions?\s+(\d+)\s*(?:to|and|-|–)\s*(\d+)/i;
const readLabel = t => { const m = RANGE.exec(plain(t)); return m ? `Time to read questions ${m[1]} to ${m[2]}` : "Reading time"; };

/* ---------- questions: numbering and marking ---------- */
/* every scored question of a lesson, in order, with its exam number(s) */
function questions(lesson){
  const out = []; let n = 1;
  for(const it of lesson.items){
    const qs = it.sets ? it.sets.flatMap(s => s.items) : SCORED.has(it.type) ? [it] : [];
    for(const q of qs){ const m = marks(q); out.push({q, parent: it, n, m}); n += m; }
  }
  return out;
}
const marks = q => q.type === "select" ? q.rows.length : q.type === "multi" ? q.answer.length : 1;
const norm = s => String(s == null ? "" : s).toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().replace(/^[\s"'(]+|[\s.,;:!?"')]+$/g, "");
function mark(q, a){
  switch(q.type){
    case "pick": return a === q.answer ? 1 : 0;
    case "tfng": return a === q.answer ? 1 : 0;
    case "multi": return Array.isArray(a) ? Math.min(q.answer.length, a.filter(x => q.answer.includes(x)).length) - Math.max(0, a.length - q.answer.length) : 0;
    case "gap": return a != null && norm(a) !== "" && q.answer.some(x => norm(x) === norm(a)) ? 1 : 0;
    case "select": return isObj(a) ? q.rows.reduce((s, r, i) => s + (+a[i] === r.answer ? 1 : 0), 0) : 0;
    case "order": return Array.isArray(a) && a.length === q.items.length && a.every((x, i) => x === i) ? 1 : 0;
  }
  return 0;
}
const TF = {tfng: [["T", "TRUE"], ["F", "FALSE"], ["NG", "NOT GIVEN"]], ynng: [["Y", "YES"], ["N", "NO"], ["NG", "NOT GIVEN"]]};
function answerText(q){
  switch(q.type){
    case "pick": return `${String.fromCharCode(65 + q.answer)} · ${optText(q, q.answer)}`;
    case "multi": return q.answer.map(i => `${String.fromCharCode(65 + i)} · ${optText(q, i)}`).join(", ");
    case "tfng": return TF[q.mode].find(x => x[0] === q.answer)[1];
    case "gap": return q.answer[0];
    case "order": return q.items.join(" → ");
    case "select": return "";
  }
  return "";
}
function skillOf(lesson){
  const t = new Set(lesson.items.map(i => i.type));
  return t.has("listening") ? "listening" : t.has("reading") ? "reading" : t.has("writing") ? "writing" : t.has("speaking") ? "speaking" : null;
}
/* a seeded shuffle for order items: the same order every time for the same item */
function shuffled(n, seed){
  const a = [...Array(n).keys()]; let h = 0;
  for(const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0;
  for(let i = n - 1; i > 0; i--){ h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  if(a.every((x, i) => x === i) && n > 1) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

/* ---------- question views ---------- */
/* fb: null while answering; true once checked (shows right/wrong and why). lock: shown as answered, nothing can change
   (a test whose time is up, reviewed before Finish) */
/* options that already start with their letter ("A one week") lose it: the letter is drawn beside them */
const optText = (q, i) => q.options.every((o, j) => new RegExp(`^${String.fromCharCode(65 + j)}[.)]?\\s+`).test(o)) ? q.options[i].replace(/^[A-Z][.)]?\s+/, "") : q.options[i];
function qHtml(q, a, num, fb, lock){
  const lab = num ? `<span class="ie-qn t-num">${num}</span>` : "";
  const res = fb ? mark(q, a) : 0, full = fb && res === marks(q);
  const why = fb ? `<div class="ie-why ${full ? "is-ok" : "is-miss"}" role="note">${ico(full ? "check-circle" : "x-circle", 18)}<div>
      ${!full && q.type !== "select" ? `<p><b>Answer:</b> ${md(answerText(q))}</p>` : ""}${q.why ? `<p>${md(q.why)}</p>` : ""}</div></div>` : "";
  const dis = fb || lock ? " disabled" : "";
  switch(q.type){
    case "pick": return `<fieldset class="ie-q" data-q="${esc(q.id)}"><legend>${lab}${md(q.q)}</legend><div class="ie-opts">
      ${q.options.map((o, i) => `<button type="button" class="ie-opt${a === i ? " is-on" : ""}${fb && i === q.answer ? " is-right" : ""}${fb && a === i && i !== q.answer ? " is-wrong" : ""}" data-v="${i}" aria-pressed="${a === i}"${dis}>
        <span class="ie-let">${String.fromCharCode(65 + i)}</span><span>${md(optText(q, i))}</span></button>`).join("")}</div>${why}</fieldset>`;
    case "multi": { const s = Array.isArray(a) ? a : [];
      return `<fieldset class="ie-q" data-q="${esc(q.id)}"><legend>${lab}${md(q.q)}</legend><div class="ie-opts">
      ${q.options.map((o, i) => `<button type="button" class="ie-opt is-multi${s.includes(i) ? " is-on" : ""}${fb && q.answer.includes(i) ? " is-right" : ""}${fb && s.includes(i) && !q.answer.includes(i) ? " is-wrong" : ""}" data-v="${i}" aria-pressed="${s.includes(i)}"${dis}>
        <span class="ie-let">${String.fromCharCode(65 + i)}</span><span>${md(optText(q, i))}</span></button>`).join("")}</div>
      <p class="t-min">Choose ${q.answer.length}.</p>${why}</fieldset>`; }
    case "tfng": return `<fieldset class="ie-q" data-q="${esc(q.id)}"><legend>${lab}${md(q.statement)}</legend><div class="ie-tf">
      ${TF[q.mode].map(([v, t]) => `<button type="button" class="ie-opt${a === v ? " is-on" : ""}${fb && v === q.answer ? " is-right" : ""}${fb && a === v && v !== q.answer ? " is-wrong" : ""}" data-v="${v}" aria-pressed="${a === v}"${dis}>${t}</button>`).join("")}</div>${why}</fieldset>`;
    case "gap": { const [b, af] = q.text.split("___"), ok = fb && res;
      return `<div class="ie-q" data-q="${esc(q.id)}"><p class="ie-gap">${lab}${md(b)}<input type="text" class="ie-in${fb ? ok ? " is-right" : " is-wrong" : ""}" value="${esc(a || "")}" aria-label="Answer${num ? " " + num : ""}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"${fb || lock ? " readonly" : ""}>${md(af)}</p>
        <p class="t-min">${esc(q.limit)}</p>${why}</div>`; }
    case "select": { const s = isObj(a) ? a : {};
      return `<div class="ie-q" data-q="${esc(q.id)}"><p class="ie-qtext">${num ? `<span class="ie-qn t-num">${num}${q.rows.length > 1 ? "–" + (num + q.rows.length - 1) : ""}</span>` : ""}${md(q.q)}</p>
        <ul class="ie-optlist">${q.options.map(o => `<li>${md(o)}</li>`).join("")}</ul>
        <div class="ie-sel">${q.rows.map((r, i) => { const v = s[i] == null ? "" : String(s[i]), ok = fb && +v === r.answer && v !== "";
          return `<label class="ie-selr${fb ? ok ? " is-right" : " is-wrong" : ""}"><span>${num ? `<b class="t-num">${num + i}</b> ` : ""}${md(r.label)}</span>
          <select data-row="${i}"${dis}><option value="">Choose…</option>${q.options.map((o, j) => `<option value="${j}"${v === String(j) ? " selected" : ""}>${esc(o.replace(/\*/g, "").slice(0, 70))}</option>`).join("")}</select>
          ${fb && !ok ? `<small class="ie-corr">${ico("check", 14)}${md(q.options[r.answer])}</small>` : ""}</label>`; }).join("")}</div>${why}</div>`; }
    case "order": { const s = Array.isArray(a) ? a : [], pool = shuffled(q.items.length, q.id).filter(i => !s.includes(i));
      return `<div class="ie-q" data-q="${esc(q.id)}"><p class="ie-qtext">${lab}${md(q.q)}</p>
        <ol class="ie-ord">${s.map(i => `<li><button type="button" class="ie-opt is-on" data-rm="${i}"${dis}>${md(q.items[i])}</button></li>`).join("")}</ol>
        ${fb ? "" : `<div class="ie-opts ie-pool">${pool.map(i => `<button type="button" class="ie-opt" data-add="${i}"${dis}>${md(q.items[i])}</button>`).join("")}</div>
        ${lock ? "" : `<p class="t-min">${pool.length ? "Tap them in the right order. Tap a chosen one to take it back." : "Tap one to take it back."}</p>`}`}${why}</div>`; }
  }
  return "";
}
/* wires a question in el; change(qid, value) stores the answer */
function wireQ(el, q, get, change){
  const box = el.querySelector(`[data-q="${CSS.escape(q.id)}"]`); if(!box) return;
  const re = () => { const n = D.createElement("div"); n.innerHTML = qHtml(q, get(), box.querySelector(".ie-qn") ? box.querySelector(".ie-qn").textContent.split("–")[0] : null, false); const nb = n.firstElementChild; box.replaceWith(nb); wireQ(el, q, get, change); };
  if(q.type === "pick" || q.type === "tfng") box.querySelectorAll("[data-v]").forEach(b => b.onclick = () => { const v = q.type === "pick" ? +b.dataset.v : b.dataset.v; change(q.id, v);
    box.querySelectorAll("[data-v]").forEach(x => { const on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", on); }); });
  if(q.type === "multi") box.querySelectorAll("[data-v]").forEach(b => b.onclick = () => {
    let s = Array.isArray(get()) ? get().slice() : []; const v = +b.dataset.v;
    if(s.includes(v)) s = s.filter(x => x !== v); else { s.push(v); if(s.length > q.answer.length) s.shift(); }
    change(q.id, s);
    box.querySelectorAll("[data-v]").forEach(x => { const on = s.includes(+x.dataset.v); x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", on); });
  });
  if(q.type === "gap"){ const i = box.querySelector("input"); i.oninput = () => change(q.id, i.value); i.onkeydown = e => { if(e.key === "Enter"){ e.preventDefault(); const c = D.getElementById("ie-check"); if(c) c.click(); } }; }
  if(q.type === "select") box.querySelectorAll("select").forEach(s => s.onchange = () => { const o = Object.assign({}, isObj(get()) ? get() : {}); if(s.value === "") delete o[s.dataset.row]; else o[s.dataset.row] = +s.value; change(q.id, o); });
  if(q.type === "order"){
    box.querySelectorAll("[data-add]").forEach(b => b.onclick = () => { change(q.id, [...(Array.isArray(get()) ? get() : []), +b.dataset.add]); re(); });
    box.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { change(q.id, (get() || []).filter(x => x !== +b.dataset.rm)); re(); });
  }
}
const answered = (q, a) => q.type === "multi" ? Array.isArray(a) && a.length === q.answer.length : q.type === "select" ? isObj(a) && Object.keys(a).length === q.rows.length
  : q.type === "order" ? Array.isArray(a) && a.length === q.items.length : q.type === "gap" ? norm(a) !== "" : a != null;

/* ---------- writing checks and self-marking ---------- */
const STOP = new Set("about above after again against also although among because been before being below between both could does doing down during each even every from further have having here into itself just more most much must only other over same should since some such than that their them then there these they this those through under until very were what when where which while whom will with within without would your yours however therefore people".split(" "));
const LINKERS = /(^|[.!?]\s+)(moreover|furthermore|in addition|additionally|firstly|secondly|thirdly|lastly|finally|on the other hand|in conclusion|to conclude|to sum up|besides|what is more)\b/gi;
const CLICHES = ["in this day and age", "it is a well-known fact", "double-edged sword", "every coin has two sides", "plays a vital role", "in a nutshell", "last but not least",
  "since the dawn of time", "it goes without saying", "nowadays, more and more", "a hot topic", "pros and cons", "in the modern era", "the advent of"];
const POSITION = /\b(i (would )?(believe|argue|contend|maintain|agree|disagree|am convinced|regard|consider|view)|in my (view|opinion|judgement)|my (view|position) is|i (would|do) (strongly )?(agree|disagree)|on balance|this essay (will )?(argue|contend)s?)\b/i;
/* the words of a text as words() counts them, lower case */
const toks = t => (String(t || "").match(/[A-Za-z0-9’'-]+/g) || []).filter(w => /[A-Za-z0-9]/.test(w)).map(w => w.toLowerCase().replace(/’/g, "'").replace(/^['-]+|['-]+$/g, ""));
/* copied rubric: words of the answer in runs of 5 or more that also run together in the question ("Any copied rubric must
   be discounted", band descriptors, May 2023) */
function copiedWords(text, prompt){
  const N = 5, p = toks(prompt), t = toks(text);
  if(p.length < N || t.length < N) return 0;
  const grams = new Set();
  for(let i = 0; i + N <= p.length; i++) grams.add(p.slice(i, i + N).join(" "));
  const hit = new Uint8Array(t.length);
  for(let i = 0; i + N <= t.length; i++) if(grams.has(t.slice(i, i + N).join(" "))) hit.fill(1, i, i + N);
  return hit.reduce((s, x) => s + x, 0);
}
/* the labels a Task 1 answer has to name: title, series, x labels, table head and first column, slices, steps, map labels */
function vizLabels(v){
  if(!isObj(v)) return [];
  const out = [v.title], arr = x => Array.isArray(x) ? x : [];
  out.push(...arr(v.series).map(s => s && s.name), ...arr(v.x), ...arr(v.head), ...arr(v.rows).map(r => Array.isArray(r) ? r[0] : ""));
  for(const c of arr(v.charts)) if(c) out.push(c.title, ...arr(c.slices).map(s => s && s.label));
  out.push(...arr(v.steps).map(s => s && s.label));
  for(const m of arr(v.maps)) if(m) out.push(m.title, ...arr(m.items).map(z => z && z.label));
  return out.filter(x => x != null).map(String);
}
function writingChecks(text, it){
  const out = [], t = String(text || ""), w = words(t), low = t.toLowerCase();
  const cp = copiedWords(t, it.prompt), own = w - cp, crit = it.task === 2 ? "Task Response" : "Task Achievement";
  out.push(own >= it.minWords ? {ok: true, t: `${own} words${cp ? " of your own" : ""}: above the ${it.minWords}-word minimum.`}
    : {ok: false, t: `${own} words${cp ? " of your own" : ""}: under ${it.minWords} loses marks for ${crit}.`});
  if(cp) out.push({ok: own >= it.minWords, t: `${cp} word${cp === 1 ? "" : "s"} copied from the question ${cp === 1 ? "is" : "are"} not counted.`});
  const paras = t.split(/\n\s*\n|\n/).filter(s => s.trim()).length;
  if(it.task === 2) out.push(paras >= 4 && paras <= 6 ? {ok: true, t: `${paras} paragraphs.`} : {ok: false, t: `${paras} paragraph${paras === 1 ? "" : "s"}: aim for an introduction, two or three body paragraphs and a conclusion.`});
  else out.push(paras >= 3 ? {ok: true, t: `${paras} paragraphs.`} : {ok: false, t: `${paras} paragraph${paras === 1 ? "" : "s"}: separate the introduction, the overview and the details.`});
  if(it.task === 1){
    out.push(/\b(overall|in general|in summary|it is (clear|evident|apparent))\b/i.test(t) ? {ok: true, t: "There's an overview."} : {ok: false, t: "No clear overview found: Task 1 can't go above band 5 for Task Achievement without one."});
    if(/\b(i think|i believe|in my (opinion|view)|i feel)\b/i.test(t)) out.push({ok: false, t: "Task 1 reports data: leave out opinions."});
  } else {
    out.push(POSITION.test(t) ? {ok: true, t: "Your position is stated."} : {ok: false, t: "Make your position explicit, in the introduction and again in the conclusion."});
  }
  /* words the question and the chart give you (and their family: the same first 6 letters) may come back often */
  const src = [it.prompt, ...vizLabels(it.visual), ...vizLabels(it.visual2)].join(" ").toLowerCase();
  const given = new Set((src.match(/[a-z]{4,}/g) || []).map(x => x.slice(0, 6)));
  const freq = {};
  for(const x of low.match(/[a-z]{4,}/g) || []) if(!STOP.has(x) && !given.has(x.slice(0, 6))) freq[x] = (freq[x] || 0) + 1;
  const lim = Math.max(6, Math.ceil(w / 40)), rep = Object.entries(freq).filter(([, n]) => n >= lim).sort((a, b) => b[1] - a[1]).slice(0, 5);
  out.push(rep.length ? {ok: false, t: `Repeated: ${rep.map(([x, n]) => `“${x}” ×${n}`).join(", ")}. Some repetition of key nouns is fine; vary the rest.`} : {ok: true, t: "No word is overused."});
  const lk = (t.match(LINKERS) || []).length;
  out.push(lk > (it.task === 2 ? 5 : 3) ? {ok: false, t: `${lk} sentence-opening linkers (Moreover, Furthermore…): band 9 cohesion is less mechanical. Use reference and substitution too.`} : {ok: true, t: "Linking isn't mechanical."});
  const cl = CLICHES.filter(c => low.includes(c));
  if(cl.length) out.push({ok: false, t: `Memorised-sounding phrases: ${cl.map(c => `“${c}”`).join(", ")}. Examiners discount them.`});
  const ct = (t.match(/\b\w+'(t|s|re|ve|ll|d|m)\b/gi) || []).filter(x => !/'s$/i.test(x) || /^(it|that|there|what|here|he|she|who)'s$/i.test(x));
  if(ct.length) out.push({ok: false, t: `Contractions (${[...new Set(ct.map(x => x.toLowerCase()))].slice(0, 4).join(", ")}): write them in full in academic writing.`});
  const sents = t.split(/[.!?]+\s/).map(s => words(s)).filter(n => n > 0);
  if(sents.length > 3){
    const long = sents.filter(n => n > 50).length, avg = sents.reduce((a, b) => a + b, 0) / sents.length;
    out.push(long ? {ok: false, t: `${long} sentence${long > 1 ? "s" : ""} over 50 words: split them so the argument stays easy to follow.`}
      : avg < 12 ? {ok: false, t: `Sentences average ${avg.toFixed(0)} words: combine some, with relative or participle clauses, to show range.`}
      : {ok: true, t: `Sentences average ${avg.toFixed(0)} words, with variety.`});
  }
  return out;
}
const CRIT = {
  w1: [["Task Achievement", "A clear overview; every key feature selected, reported accurately and compared; nothing irrelevant."],
    ["Coherence and Cohesion", "Logical, effortless to follow; cohesion so natural it attracts no attention; skilful paragraphing."],
    ["Lexical Resource", "Wide, precise, natural vocabulary; only very rare slips."],
    ["Grammatical Range and Accuracy", "A wide range of structures used flexibly; almost every sentence error-free."]],
  w2: [["Task Response", "Every part of the question answered in full; a clear position throughout; ideas extended and well supported."],
    ["Coherence and Cohesion", "Logical, effortless to follow; cohesion so natural it attracts no attention; skilful paragraphing."],
    ["Lexical Resource", "Wide, precise, natural vocabulary; only very rare slips."],
    ["Grammatical Range and Accuracy", "A wide range of structures used flexibly; almost every sentence error-free."]],
  s: [["Fluency and Coherence", "Fluent, with only rare hesitation, and then for ideas rather than words; fully coherent and well developed."],
    ["Lexical Resource", "Precise, idiomatic vocabulary used naturally on every topic, abstract ones included."],
    ["Grammatical Range and Accuracy", "The full range of structures, natural and accurate."],
    ["Pronunciation", "Stress, rhythm and intonation used effortlessly for meaning; always easy to understand."]],
};
/* the local self-marking (IE.assess replaces it when it exists; the item is the third or fifth argument) */
function selfHtml(kind, cur){
  const c = isObj(cur) ? cur : {};
  return `<div class="ie-self" data-self="${kind}"><h3 class="t-head">Mark yourself</h3><p class="t-note">Compare with the model and be strict. Band 9 means:</p>
    ${CRIT[kind].map(([name, d], i) => `<div class="ie-crit"><p><b>${esc(name)}</b><br><span class="t-note">${esc(d)}</span></p>
      <div class="ie-seg ie-bands" role="radiogroup" aria-label="${esc(name)}">${[5, 6, 7, 8, 9].map(b => `<button type="button" role="radio" data-c="${i}" data-b="${b}" aria-checked="${c[i] === b}">${b}</button>`).join("")}</div></div>`).join("")}
    <p class="ie-selfres t-head" aria-live="polite">${selfBand(c, kind) != null ? `Your estimate: band ${fmtBand(selfBand(c, kind))}` : ""}</p></div>`;
}
const selfBand = (c, kind) => { c = isObj(c) ? c : {}; const v = CRIT[kind].map((_, i) => c[i]); return v.every(x => typeof x === "number") ? roundBand(v.reduce((a, b) => a + b, 0) / v.length) : null; };
function wireSelf(el, kind, get, set){
  const box = el.querySelector(`[data-self="${kind}"]`); if(!box) return;
  box.querySelectorAll("[data-b]").forEach(b => b.onclick = () => {
    const c = Object.assign({}, get() || {}); c[b.dataset.c] = +b.dataset.b; set(c, selfBand(c, kind));
    box.querySelectorAll(`[data-c="${b.dataset.c}"]`).forEach(x => x.setAttribute("aria-checked", x === b));
    const r = selfBand(c, kind); box.querySelector(".ie-selfres").textContent = r != null ? `Your estimate: band ${fmtBand(r)}` : "";
  });
}
/* the shared component of package study when it is there, else the local one */
const SELF = () => (IE.assess && IE.assess.selfHtml ? IE.assess : {selfHtml, wireSelf, selfBand});
const selfKind = it => it.type === "speaking" ? "s" : it.task === 1 ? "w1" : "w2";
const modelHtml = (m, title = "Band 9 model") => `<details class="ie-model" open><summary class="t-head">${ico("seal-check", 18)}${esc(title)}</summary>
  <div class="ie-mtext">${m.text.map(p => `<p>${md(p)}</p>`).join("")}</div>
  <button type="button" class="glass-btn glass-btn--sm" data-say-model>${ico("speaker-high", 18)}Listen</button>
  <h4 class="t-head">Why it scores high</h4><ul class="ie-notes">${m.notes.map(n => `<li>${md(n)}</li>`).join("")}</ul></details>`;

/* ---------- microphone ---------- */
const canRec = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && W.MediaRecorder);
const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
function mime(){ const M = W.MediaRecorder; if(!M || !M.isTypeSupported) return ""; return ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(t => { try{ return M.isTypeSupported(t); }catch(e){ return false; } }) || ""; }
/* records up to max seconds; returns {stop(), done: Promise<{url, secs}>}. stop() also ends the microphone track at once */
async function record(max, tick){
  const stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}});
  const off = () => stream.getTracks().forEach(t => { try{ t.stop(); }catch(e){} });
  const type = mime(); let mr;
  try{ mr = new MediaRecorder(stream, type ? {mimeType: type} : undefined); }catch(e){ try{ mr = new MediaRecorder(stream); }catch(e2){ off(); throw e2; } }
  const bits = [], t0 = Date.now();
  let res, over = false; const done = new Promise(r => { res = r; });
  const end = url => { if(over){ if(url) URL.revokeObjectURL(url); return; } over = true; clearInterval(iv); off(); res({url, secs: (Date.now() - t0) / 1000}); };
  mr.ondataavailable = e => { if(e.data && e.data.size) bits.push(e.data); };
  mr.onstop = () => end(bits.length ? URL.createObjectURL(new Blob(bits, {type: mr.mimeType || type || "audio/webm"})) : null);
  try{ mr.start(250); }catch(e){ off(); throw e; }
  const iv = setInterval(() => { const s = (Date.now() - t0) / 1000; if(tick) tick(s); if(s >= max) stop(); }, 250);
  const stop = () => { clearInterval(iv); try{ if(mr.state !== "inactive") mr.stop(); else end(null); }catch(e){ end(null); } off(); setTimeout(() => end(null), 1500); };
  return {stop, done};
}
function transcribe(max, tick, onText){
  const r = new SR(); r.lang = "en-GB"; r.continuous = true; r.interimResults = true;
  let fin = "", t0 = Date.now(), res, stopped = false, over = false;
  const done = new Promise(x => { res = x; });
  const end = () => { if(over) return; over = true; clearInterval(iv); res({text: fin.trim(), secs: (Date.now() - t0) / 1000}); };
  r.onresult = e => { let inter = ""; for(let i = e.resultIndex; i < e.results.length; i++){ const x = e.results[i]; if(x.isFinal) fin += x[0].transcript + " "; else inter += x[0].transcript; } onText((fin + inter).trim()); };
  r.onend = () => { if(!stopped && (Date.now() - t0) / 1000 < max){ try{ r.start(); return; }catch(e){} } end(); };
  r.onerror = e => { if(e.error === "not-allowed" || e.error === "service-not-allowed"){ stopped = true; toast("The microphone isn't allowed."); } };
  r.start();
  const iv = setInterval(() => { const s = (Date.now() - t0) / 1000; if(tick) tick(s); if(s >= max) stop(); }, 250);
  const stop = () => { stopped = true; clearInterval(iv); try{ r.stop(); }catch(e){} setTimeout(end, 1500); };
  return {stop, done};
}
/* no microphone: only the clock runs, up to max seconds */
function timerOnly(max, tick){
  const t0 = Date.now(); let res, over = false; const done = new Promise(r => { res = r; });
  const stop = () => { if(over) return; over = true; clearInterval(iv); res({url: null, secs: Math.min(max, (Date.now() - t0) / 1000)}); };
  const iv = setInterval(() => { const s = (Date.now() - t0) / 1000; if(tick) tick(Math.min(s, max)); if(s >= max) stop(); }, 250);
  return {stop, done};
}
function speechStats(text, secs){
  const w = words(text), fill = (String(text).toLowerCase().match(/\b(um+|uh+|er+|erm+|ah+|you know|i mean)\b/g) || []).length;
  return `${w} words${secs > 5 ? ` · ${Math.round(w / secs * 60)} words a minute` : ""}${fill ? ` · ${fill} filler${fill > 1 ? "s" : ""} (um, er, you know…; may be undercounted)` : ""}`;
}

/* ---------- voices of a recording ---------- */
const PITCH = {f: [1, 1.14, 1.06], m: [1, .88, .94]};
/* each speaker's options for IE.speak, in the order they first speak: alt 0, 1, 2 within each gender */
function voicesOf(it){
  const order = [...new Set([...it.script.map(l => l.s), ...it.speakers.map(s => s.id)])], n = {f: 0, m: 0}, out = {};
  for(const id of order){
    const s = it.speakers.find(x => x.id === id); if(!s) continue;
    const g = s.voice === "m" ? "m" : "f", k = n[g]++;
    out[id] = Object.assign({voice: g}, s.accent ? {accent: s.accent} : {}, {alt: k, pitch: PITCH[g][k] != null ? PITCH[g][k] : 1});
  }
  return out;
}

/* ---------- the player ---------- */
IE.ROUTES.lesson = async ([lid], a) => {
  const found = await data.lesson(lid);
  if(!found) throw new Error("This lesson doesn't exist.");
  const {lesson: L, unit: U} = found;
  const test = L.kind === "test", QS = questions(L), NUM = {}; for(const x of QS) NUM[x.q.id] = x.n;
  const skill = skillOf(L);
  const LIS = L.items.filter(i => i.type === "listening");
  const examLesson = test && L.exam === true && LIS.length > 0;
  const fresh = () => ({v: 1, i: 0, ans: {}, checked: {}, heard: {}, self: {}, el: 0, started: !test});
  let run = LS.get(RK(lid)), hold = false;
  /* a saved run that js/ielts.js couldn't move to this version's options this load (storage full) is moved first; one
     that still can't be moved whole is played but never saved this load (a save would date it in the old order) */
  const mv = typeof IE.migRun === "function" ? IE.migRun(RK(lid)) : null;
  if(mv){ run = mv.run; hold = !!mv.hold; }
  if(!isObj(run) || run.v !== 1) run = fresh();
  for(const k of ["ans", "checked", "heard", "self"]) if(!isObj(run[k])) run[k] = {};
  if(!(run.el >= 0)) run.el = 0;
  let full = false;
  const save = () => {
    if(hold){ if(!full){ full = true; toast("Couldn't save on this device: storage is full."); } return; }
    run.at = Date.now(); if(!LS.set(RK(lid), run) && !full){ full = true; toast("Couldn't save on this device: storage is full."); }
  };
  const ans = id => run.ans[id];
  let st = 0; const saveSoon = () => { clearTimeout(st); st = setTimeout(save, 400); };
  const setAns = (id, v) => { run.ans[id] = v; saveSoon(); };
  const bag = k => isObj(run[k]) ? run[k] : (run[k] = {});
  let timer = 0, alive = true, recCtl = null, view = 0, screen = "";
  const viewCleanups = [], cleanups = [];
  const exam = () => examLesson && run.xmode !== "timed";
  const running = () => test && !!run.started && !run.finished;
  const locked = () => test && !!run.over && !run.finished;
  /* a mock started before exam mode (no xmode): one that has already used the clock or played a part keeps the timed clock */
  if(examLesson && run.started && !run.finished && run.xmode == null){ run.xmode = run.el > 0 || Object.keys(run.heard).length ? "timed" : "exam"; save(); }
  /* the time away from a running test (another screen, the page closed or reloaded, a hidden page that was discarded) isn't
     exam time either: run.hid (hidden since) or run.at (the last save) to now, from 5 s */
  if(running()){
    const since = +run.hid || +run.at || 0, gap = since ? Date.now() - since : 0;
    delete run.hid;
    if(gap >= 5000) run.away = (run.away || 0) + gap;
    save();
  }
  const virtual = !!(U.back && U.backT);
  const back = virtual ? U.back : `#/unit/${U.id}`, backT = virtual ? U.backT : `Unit ${U.n}`;
  const tag = !virtual && U.n != null ? ` · Unit ${U.n}` : "";
  const narrator = it => { const s = it.speakers.find(x => x.id === (it.script[0] || {}).s); return Object.assign({voice: s && s.voice === "f" ? "m" : "f", gap: 60}, test ? {rate: 1} : {}); };
  const lineOpts = (vo, l) => Object.assign({}, vo[l.s] || {voice: "f"}, {gap: 60}, test ? {rate: 1} : {});

  /* one polite live region for the whole lesson: Check, the results */
  let live = D.getElementById("ie-live");
  if(!live){ live = D.createElement("div"); live.id = "ie-live"; live.className = "vh"; live.setAttribute("role", "status"); live.setAttribute("aria-live", "polite"); D.body.appendChild(live); }
  live.textContent = "";
  let liveT = 0;
  const announce = t => { clearTimeout(liveT); live.textContent = ""; liveT = setTimeout(() => { if(alive) live.textContent = t; }, 80); };

  /* a new screen: stop the microphone and every timer of the old one */
  function flushView(){
    for(const f of viewCleanups.splice(0)) try{ f(); }catch(e){}
    if(recCtl){ try{ recCtl.stop(); }catch(e){} recCtl = null; }
  }
  function newView(name){ view++; screen = name; flushView(); }

  const top = () => {
    let right = `<span class="ie-step t-num" id="ie-stepn"></span>`;
    if(running()){
      if(!exam()){ const left = L.timed - run.el / 1000; right = `<span class="ie-timer t-num${left < 300 ? " is-low" : ""}" id="ie-timer" role="timer" aria-label="Time left">${fmtTime(left)}</span>`; }
      else if(isObj(run.x) && run.x.phase === "review") right = `<span class="ie-timer t-num is-low" id="ie-timer" role="timer" aria-label="Time left to check your answers">${fmtTime(run.x.left != null ? run.x.left : EX().review)}</span>`;
    }
    setTop({title: L.title, back, backT, right});
  };

  /* ----- the test clock: only visible time counts ----- */
  let last = Date.now(), hiddenAt = 0, ticks = 0;
  const stopClock = () => { clearInterval(timer); timer = 0; };
  /* it ticks in exam mode too, only as the watchdog for a frozen or sleeping page (the recording sets the pace) */
  function tickStart(){
    if(!running() || !alive){ stopClock(); return; }
    if(timer) return;
    last = Date.now();
    timer = setInterval(tick, 1000);
  }
  function paintClock(left){ const t = D.getElementById("ie-timer"); if(t){ t.textContent = fmtTime(left); t.classList.toggle("is-low", left < 300); } }
  function tick(){
    if(!alive || !running()) return stopClock();
    const n = Date.now(), dt = n - last; last = n;
    if(D.visibilityState === "visible"){
      if(dt >= 0 && dt < 5000){
        if(!exam()) run.el += dt;
        /* exam mode with the recording stopped (after a reload or coming back, before «Continue the recording»):
           the questions are on screen but nothing sets the pace, so that time is a pause too */
        else if(xStopped()){ run.away = (run.away || 0) + dt; if(++ticks % 5 === 0) save(); }
      }
      else if(dt >= 5000 && !hiddenAt){ run.away = (run.away || 0) + dt; save(); }   /* a frozen or sleeping page: not exam time */
    }
    if(exam()) return;
    const left = L.timed - run.el / 1000;
    paintClock(left);
    if(++ticks % 5 === 0) save();
    if(left <= 0 && !run.over && screen === "items"){
      stopClock();
      if(D.visibilityState === "visible" && dt < 5000){ toast("Time's up."); finish(); } else timeUp();
    }
  }
  /* run.hid keeps "hidden since" in the saved run, so a hidden page that is closed or discarded is counted when it comes back */
  function goneAway(){ if(running() && !hiddenAt){ hiddenAt = Date.now(); run.hid = hiddenAt; } save(); }
  const addHidden = () => { if(hiddenAt){ run.away = (run.away || 0) + Math.max(0, Date.now() - hiddenAt); hiddenAt = 0; } delete run.hid; };
  function cameBack(){
    if(D.visibilityState !== "visible") return;
    if(hiddenAt){ addHidden(); save(); }
    last = Date.now();
    if(running() && !exam() && !run.over && screen === "items" && L.timed - run.el / 1000 <= 0) timeUp();
  }
  const onVis = () => D.visibilityState === "hidden" ? goneAway() : cameBack();
  D.addEventListener("visibilitychange", onVis); W.addEventListener("pagehide", goneAway); D.addEventListener("freeze", goneAway);
  W.addEventListener("pageshow", cameBack); D.addEventListener("resume", cameBack);
  cleanups.push(() => { D.removeEventListener("visibilitychange", onVis); W.removeEventListener("pagehide", goneAway); D.removeEventListener("freeze", goneAway);
    W.removeEventListener("pageshow", cameBack); D.removeEventListener("resume", cameBack); });

  function intro(){
    newView("intro"); stopClock(); top();
    const nq = QS.reduce((s, x) => s + x.m, 0), ex = examLesson && run.xmode !== "timed";
    a.innerHTML = `<div class="ie-page ie-narrow"><div class="card ie-card ie-intro">${ico("timer", 40)}
      <h1 class="t-2">${esc(L.title)}</h1>
      ${ex ? `<p class="t-sub">${LIS.length} part${LIS.length > 1 ? "s" : ""}${nq ? ` · ${nq} questions` : ""}. Like the computer-delivered exam: the recording plays once, straight through, and sets the pace. Before each part there is time to read the questions, after each part time to check them, and at the end two minutes to check your answers. Then the test finishes by itself.</p>
        <p class="t-sub">${ico("speaker-high", 18)} You can move between parts while the recording plays. If you leave the test, the recording stops, and a pause of more than two minutes isn't counted as exam conditions. Tests always play at exam speed. Use headphones.</p>`
      : `<p class="t-sub">${Math.round(L.timed / 60)} minutes${nq ? ` · ${nq} questions` : ""}. Like the real exam: no answers until you finish, and the clock keeps going between parts. The clock stops only while this test isn't on screen, and a pause of more than two minutes isn't counted as exam conditions.</p>
        ${skill === "listening" ? `<p class="t-sub">${ico("speaker-high", 18)} Each recording plays once. Read the questions before you press play. Tests always play at exam speed. Use headphones.</p>` : ""}`}
      ${skill === "writing" ? (() => { const has = n => L.items.some(x => x.type === "writing" && x.task === n), m = Math.round(L.timed / 60); return `<p class="t-sub">${ico("pencil-simple", 18)} ${has(1) && has(2) ? "Spend about 20 minutes on Task 1 and 40 on Task 2: Task 2 counts twice as much." : has(1) ? `Spend the ${m} minutes on Task 1: plan, write, then check your figures.` : `Spend the ${m} minutes on Task 2: plan, write, then check your argument.`}</p>`; })() : ""}
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="ie-go">Start</button></div></div>`;
    const go = a.querySelector("#ie-go");
    go.onclick = async () => {
      if(go.disabled) return; go.disabled = true;
      if(examLesson && run.xmode !== "timed"){
        const n = canSay() ? await voiceCount() : 0;
        if(!alive) return;
        run.started = true;
        if(n === 0){ run.xmode = "timed"; for(const it of LIS) bag("noaudio")[it.id] = true; save(); show(); announce("No English voice on this device: read the transcripts instead."); return; }
        run.xmode = "exam"; save(); show(); xPlay(); return;
      }
      run.started = true; save(); show();
    };
  }

  /* the time ran out while the learner was away: ask, don't finish silently */
  function timeUp(){
    if(!alive || run.finished) return;
    newView("timeup"); stopClock(); hush();
    run.el = Math.max(run.el, L.timed * 1000); save();
    top();
    a.innerHTML = `<div class="ie-page ie-narrow"><div class="card ie-card ie-intro ie-timeup">${ico("timer", 40)}
      <h1 class="t-2">Time is up</h1>
      <p class="t-sub">The clock ran out. Finish now to see your result, or review your answers first and finish from there.</p>
      <div class="ie-row-b"><button type="button" class="glass-btn glass-btn--pri" id="ie-fin">Finish</button>
      <button type="button" class="glass-btn" id="ie-review">${ico("list-checks", 18)}Review</button></div></div></div>`;
    const f = a.querySelector("#ie-fin"), r = a.querySelector("#ie-review");
    f.onclick = () => { if(f.disabled) return; f.disabled = true; finish(); };
    r.onclick = () => { run.over = true; save(); show(); };
    const h = a.querySelector("h1"); if(h){ h.setAttribute("tabindex", "-1"); h.focus({preventScroll: true}); }
    announce("Time is up.");
    W.scrollTo(0, 0);
  }

  /* o.keepScroll: the caller scrolls (Check on a reading item), so the pane's saved scroll isn't restored over it */
  function show(o){
    if(!alive) return;
    if(run.finished) return results();
    if(test && !run.started) return intro();
    if(running() && !exam() && !run.over && L.timed - run.el / 1000 <= 0) return timeUp();
    newView("items");
    if(!exam()) hush();
    run.i = Math.max(0, Math.min(run.i | 0, L.items.length - 1)); save();
    const it = L.items[run.i], fb = !test && !!run.checked[it.id];
    if(it.type === "listening" && !exam() && !canSay()) bag("noaudio")[it.id] = true;
    top(); tickStart();
    const sn = D.getElementById("ie-stepn"); if(sn) sn.textContent = `${run.i + 1} / ${L.items.length}`;
    a.innerHTML = `<div class="ie-page${it.type === "reading" ? " ie-wide" : " ie-narrow"}">
      <div class="ie-bar" aria-hidden="true"><span style="width:${(run.i + (fb ? 1 : 0)) / L.items.length * 100}%"></span></div>
      ${exam() ? `<div class="ie-xbar" id="ie-xbar"></div>` : ""}
      ${locked() ? `<p class="ie-locked" role="note">${ico("lock", 18)}<span>Time is up: you can look through your answers but not change them. Press Finish to see your result.</span></p>` : ""}
      <div id="ie-item">${itemHtml(it, fb)}</div>
      <div class="ie-dock" id="ie-dock">${dockHtml(it, fb)}</div></div>`;
    wireItem(it, fb);
    wireDock(it, fb);
    if(exam()){
      xPaint();
      /* the two minutes to check have no audio: after a reload or coming back they go on by themselves */
      if(!xrun && isObj(run.x) && run.x.phase === "review") xPlay();
    }
    const h = a.querySelector("#ie-item h1, #ie-item h2, #ie-item legend, #ie-item .ie-qtext"); if(h && run.i > 0){ h.setAttribute("tabindex", "-1"); h.focus({preventScroll: true}); }
    if(it.type !== "reading") W.scrollTo(0, 0);
    else if(!(isObj(o) && o.keepScroll)) restoreScroll(it);
  }

  /* what goes in the dock under the item */
  function dockHtml(it, fb){
    const last = run.i === L.items.length - 1, sp = `<span class="ie-sp"></span>`;
    const prev = run.i > 0 ? `<button type="button" class="glass-btn glass-btn--icon" id="ie-prev" aria-label="Previous">${ico("caret-left", 22)}</button>` : "";
    const fin = `<button type="button" class="glass-btn glass-btn--pri" id="ie-fin">Finish</button>`;
    const next = (t, pri = true) => `<button type="button" class="glass-btn${pri ? " glass-btn--pri" : ""}" id="ie-next">${t}${ico("caret-right", 20)}</button>`;
    if(test){
      if(run.over && !last) return `${prev}${sp}${next("Next", false)}${fin}`;
      return `${prev}${sp}${last ? fin : next("Next")}`;
    }
    /* writing practice: compare first (the button under the answer), then go on */
    if(it.type === "writing" && !run.checked[it.id]) return `${prev}${sp}`;
    const scored = SCORED.has(it.type) || it.sets;
    if(scored && !fb) return `${prev}${sp}<button type="button" class="glass-btn glass-btn--pri" id="ie-check">Check</button>`;
    return `${prev}${sp}${last ? fin : next("Continue")}`;
  }
  function askFinish(){
    if(!test) return true;
    if(exam() && !(isObj(run.x) && (run.x.phase === "review" || run.x.phase === "done"))) return confirm("The recording hasn't finished. Finish anyway?");
    const left = QS.filter(x => !answered(x.q, ans(x.q.id))).length;
    return !left || confirm(`${left} question${left > 1 ? "s are" : " is"} unanswered. Finish anyway?`);
  }
  function wireDock(it){
    const q = s => a.querySelector(s);
    /* one click only: the screen is redrawn after it */
    const once = (b, f) => { if(b) b.onclick = () => { if(b.disabled) return; b.disabled = true; f(b); }; };
    once(q("#ie-prev"), () => { run.i--; show(); });
    once(q("#ie-next"), () => { run.i++; show(); });
    once(q("#ie-fin"), b => { if(!askFinish()){ b.disabled = false; return; } finish(); });
    if(q("#ie-check")) q("#ie-check").onclick = () => {
      const qs = it.sets ? it.sets.flatMap(s => s.items) : [it];
      if(qs.every(x => !answered(x, ans(x.id))) && !confirm("You haven't answered yet. Show the answers?")) return;
      run.checked[it.id] = true;
      /* reading on a phone: the answers and reasons are in the Questions pane, and the scroll to the first one wins */
      const rd = it.type === "reading";
      if(rd && pane(it) !== "qs"){ rpos(it)[pane(it)] = Math.round(W.scrollY); bag("panes")[it.id] = "qs"; }
      save(); hush(); show({keepScroll: rd});
      const g = qs.reduce((t, x) => t + mark(x, ans(x.id)), 0), m = qs.reduce((t, x) => t + marks(x), 0);
      announce(!it.sets && it.type !== "select" ? (g === m ? "Correct." : `Not quite. The answer is ${plain(answerText(it))}.`) : `${g} of ${m} correct.`);
      const w = a.querySelector(".ie-why.is-miss, .ie-why"); if(w && it.sets) w.scrollIntoView({block: "center", behavior: calm() ? "auto" : "smooth"});
    };
  }

  /* ----- items ----- */
  /* run.unseen: questions added to the lesson after this run was finished (js/ielts.js): not in its score */
  const unseen = id => Array.isArray(run.unseen) && run.unseen.includes(id);
  const setBody = (s, fb) => `<section class="ie-set"><p class="ie-instr">${md(s.instr)}</p>${s.visual ? fig(s.visual) : ""}${s.items.map(q => (fb && unseen(q.id) ? `<p class="t-note ie-unseen">Added since you did this lesson: not in your score.</p>` : "")
    + qHtml(q, ans(q.id), NUM[q.id], fb, !fb && locked())).join("")}</section>`;
  function setHtml(it, fb){
    return it.sets.map(s => setBody(s, fb)).join("")
      + (fb ? `<p class="ie-score t-head">${(() => { const qs = it.sets.flatMap(s => s.items), g = qs.reduce((t, q) => t + mark(q, ans(q.id)), 0), m = qs.reduce((t, q) => t + marks(q), 0); return `${g} of ${m} correct`; })()}</p>` : "");
  }
  const pane = it => (isObj(run.panes) && run.panes[it.id]) || "text";
  function itemHtml(it, fb){
    switch(it.type){
      case "card": return `<article class="card ie-card ie-lcard"><h1 class="t-2">${md(it.title)}</h1>${it.body.map(p => `<p>${md(p)}</p>`).join("")}
        ${it.list ? `<ul class="ie-ul">${it.list.map(x => `<li>${md(x)}</li>`).join("")}</ul>` : ""}
        ${it.examples ? `<div class="ie-exs">${it.examples.map((x, i) => `<div class="ie-ex"><button type="button" class="glass-btn glass-btn--icon" data-ex="${i}" aria-label="Listen">${ico("speaker-high", 20)}</button>
          <p>${md(x.text)}${x.note ? `<small>${md(x.note)}</small>` : ""}</p></div>`).join("")}</div>` : ""}
        ${it.tip ? `<p class="ie-tip">${ico("lightbulb", 18)}<span>${md(it.tip)}</span></p>` : ""}</article>`;
      case "pick": case "multi": case "tfng": case "gap": case "select": case "order":
        return `<div class="card ie-card">${qHtml(it, ans(it.id), null, fb, !fb && locked())}</div>`;
      case "reading": { const p = pane(it);
        return `<div class="ie-read" data-pane="${p}">
        <div class="ie-seg ie-rtog" role="tablist"><button type="button" role="tab" data-pane="text" aria-selected="${p === "text"}">Passage</button><button type="button" role="tab" data-pane="qs" aria-selected="${p === "qs"}">Questions</button></div>
        <article class="card ie-card ie-passage" lang="en-GB"><p class="ie-kicker">${it.minutes ? `About ${it.minutes} minutes` : ""}</p><h1 class="t-2">${md(it.title)}</h1>
          ${it.paragraphs.map(p => `<p>${p.label ? `<b class="ie-plab">${esc(p.label)}</b>` : ""}${md(p.text)}</p>`).join("")}</article>
        <div class="ie-qpane">${setHtml(it, fb)}</div></div>`; }
      case "listening": return listenHtml(it, fb);
      case "writing": return writingHtml(it);
      case "speaking": return speakingHtml(it);
      case "say": return `<div class="card ie-card ie-say"><p class="ie-kicker">${ico("microphone", 18)}Say it</p><p class="t-1" lang="en-GB">${md(it.text)}</p><p class="ie-ipa" lang="en-GB">${esc(it.ipa)}</p>
        <p class="t-sub">${md(it.tip)}</p><div class="ie-row-b"><button type="button" class="glass-btn glass-btn--sm" data-say="1">${ico("speaker-high", 18)}Listen</button>
        <button type="button" class="glass-btn glass-btn--sm" data-say="slow">${ico("turtle", 18)}Slowly</button>${canRec() ? `<button type="button" class="glass-btn glass-btn--sm" id="ie-rec1">${ico("microphone", 18)}Record me</button>` : ""}</div>
        <audio id="ie-aud" controls hidden></audio></div>`;
    }
    return `<div class="card ie-card"><p class="t-sub">This item can't be shown.</p></div>`;
  }
  const transcriptHtml = (it, open) => `<details class="card ie-card ie-trans"${open ? " open" : ""}><summary class="t-head">${ico("quotes", 18)}Transcript</summary>
    ${it.script.map(l => { const s = it.speakers.find(x => x.id === l.s); return `<p><b>${esc(s ? s.name : l.s)}:</b> ${md(l.t)}</p>`; }).join("")}</details>`;
  /* a test recording heard before this version (heard set on the click, no line kept) counts as played */
  const played = it => !!bag("played")[it.id] || (test && !!run.heard[it.id] && bag("lpos")[it.id] == null);
  function listenHtml(it, fb){
    const head = inner => `<div class="card ie-card ie-listen"><p class="ie-kicker">${ico("ear", 18)}Part ${it.part}</p><h1 class="t-2">${md(it.title)}</h1><p class="t-sub">${md(it.context)}</p>${inner}</div>`;
    if(bag("noaudio")[it.id]) return head(`<p class="ie-noaudio" role="note">${ico("info", 20)}<span>No English voice on this device: read the transcript instead.${test ? " This part isn't under exam conditions." : ""}</span></p>`)
      + transcriptHtml(it, true) + setHtml(it, fb);
    if(exam()) return head(`<div class="ie-xstat"><span id="ie-xst" role="status" aria-live="polite"></span><span id="ie-xclk" class="t-num" aria-hidden="true"></span></div>
      <div class="ie-lbar" aria-hidden="true"><span id="ie-lbar"></span></div>`) + setHtml(it, fb);
    const done = test && played(it), cont = test && !done && bag("lpos")[it.id] != null;
    const n = it.script.length + 1, w = done ? 100 : cont ? (+bag("lpos")[it.id] || 0) / n * 100 : 0;
    return head(`<div class="ie-player"><button type="button" class="glass-btn glass-btn--pri" id="ie-play"${done ? " disabled" : ""}>${ico("play", 20)}${test ? done ? "Played" : cont ? "Continue the recording" : "Play" : run.heard[it.id] ? "Play again" : "Play"}</button>
        ${test ? "" : `<button type="button" class="glass-btn glass-btn--icon" id="ie-stop" aria-label="Stop" hidden>${ico(STOP_ICO, 20)}</button>`}
        <span class="ie-prog t-note" id="ie-lprog" aria-live="polite">${test ? done ? "You've heard this recording." : cont ? "The recording stopped when you left: it goes on from there. What has already played can't be heard again." : "You'll hear the recording once." : ""}</span><span class="ie-lclk t-note t-num" id="ie-lclk" aria-hidden="true"></span></div>
        <div class="ie-lbar" aria-hidden="true"><span id="ie-lbar" style="width:${w}%"></span></div>`)
      + setHtml(it, fb) + (fb ? transcriptHtml(it, true) : "");
  }
  function writingHtml(it){
    const v = ans(it.id) || "", done = !test && run.checked[it.id], ro = done || locked();
    return `<div class="card ie-card ie-wtask"><p class="ie-kicker">${ico("pencil-simple", 18)}Writing Task ${it.task} · about ${it.minutes} minutes · at least ${it.minWords} words</p>
        <p class="ie-prompt">${md(it.prompt)}</p>${fig(it.visual)}${fig(it.visual2)}
        ${it.plan && !test ? `<details class="ie-plan"><summary class="t-head">${ico("list-checks", 18)}How to plan it</summary><ol>${it.plan.map(p => `<li>${md(p)}</li>`).join("")}</ol></details>` : ""}</div>
      <div class="card ie-card ie-wans"><textarea class="ie-ta" id="ie-ta" lang="en-GB" spellcheck="false" autocorrect="off" autocapitalize="${test ? "none" : "sentences"}" aria-label="Your answer" placeholder="Write your answer here. It's saved as you type."${ro ? " readonly" : ""}>${esc(v)}</textarea>
        <p class="ie-wc t-note"><span id="ie-wc" class="t-num">${words(v)} words</span>${test ? "" : `<span id="ie-wclock" class="t-num"></span>`}</p>
        ${!test && !done ? `<button type="button" class="glass-btn glass-btn--pri glass-btn--block" id="ie-wdone">I've finished: compare</button>` : ""}</div>
      ${done ? writingFeedback(it) : ""}`;
  }
  const writingFeedback = it => {
    const eid = run.eid && run.eid[it.id];
    return `<div class="card ie-card ie-wchecks"><h2 class="t-3">Checks</h2><ul class="ie-checks">${writingChecks(ans(it.id), it).map(c => `<li class="${c.ok ? "is-ok" : "is-miss"}">${ico(c.ok ? "check-circle" : "warning-circle", 18)}<span>${esc(c.t)}</span></li>`).join("")}</ul>
      <p class="t-min">Automatic checks only catch the surface. The criteria below are what examiners mark.</p></div>
    <div class="card ie-card">${modelHtml(it.model)}</div><div class="card ie-card" data-selfwrap="${esc(it.id)}">${SELF().selfHtml(selfKind(it), run.self[it.id], it)}</div>
    ${eid ? `<p class="ie-revise"><a class="glass-btn" href="#/essays/${encodeURIComponent(eid)}/revise">${ico("notebook", 18)}Revise it later in My writing</a></p>` : ""}`;
  };
  const smode = () => run.smode === "tr" && SR ? "tr" : run.smode === "rec" && canRec() ? "rec" : canRec() ? "rec" : SR ? "tr" : "none";
  const target = it => it.talk || (it.part === 1 ? 30 : it.part === 2 ? 120 : 60);
  function speakingHtml(it){
    const done = run.checked[it.id], mode = smode();
    const qs = it.part === 2 ? [] : it.questions || [];
    const fu = it.part === 2 && Array.isArray(it.followups) ? it.followups : [];
    const ansBtn = attr => `<button type="button" class="glass-btn glass-btn--sm" ${attr}>${ico(mode === "none" ? "timer" : "microphone", 18)}Answer</button>`;
    const sq = (k, q, attrAsk, attrRec, n) => `<div class="ie-sq" data-k="${k}"><p class="t-head"><span class="ie-qn t-num">${n}</span>${md(q)}</p>
      <div class="ie-row-b"><button type="button" class="glass-btn glass-btn--sm" ${attrAsk}>${ico("speaker-high", 18)}Ask me</button>
      ${ansBtn(attrRec)}<span class="ie-clock t-num" id="ie-clock-${k}"></span></div>
      <div class="ie-out" id="ie-out-${k}"></div></div>`;
    return `<div class="card ie-card ie-speak"><p class="ie-kicker">${ico("chats-circle", 18)}Speaking Part ${it.part} · ${esc(it.topic)}</p>
      ${it.part === 2 ? `<div class="ie-cue"><p class="t-head">${md(it.cue.task)}</p><p class="t-note">You should say:</p><ul>${it.cue.bullets.map(b => `<li>${md(b)}</li>`).join("")}</ul><p>${md(it.cue.close)}</p></div>
        <textarea class="ie-ta ie-notes-ta" id="ie-notes" placeholder="Your notes (1 minute)" aria-label="Notes">${esc(run.ans[it.id + ":notes"] || "")}</textarea>` : ""}
      ${SR && canRec() ? `<div class="ie-seg ie-smode" role="radiogroup" aria-label="Mode"><button type="button" role="radio" data-mode="rec" aria-checked="${mode === "rec"}">Record and listen back</button><button type="button" role="radio" data-mode="tr" aria-checked="${mode === "tr"}">Live transcript</button></div>` : ""}
      ${SR && (canRec() || mode === "tr") ? `<p class="t-min ie-srnote">Live transcript uses your browser's speech service, which may send your voice to its provider (Google in Chrome).</p>` : ""}
      ${mode === "none" ? `<p class="t-sub">This browser can't use the microphone: answer aloud while the timer runs, then compare with the model.</p>` : ""}
      ${it.part === 2 ? `<div class="ie-sq" data-k="cue"><div class="ie-row-b"><button type="button" class="glass-btn glass-btn--pri" id="ie-prep">${ico("timer", 18)}Start: 1 minute to prepare</button>
          <span class="ie-clock t-num t-head" id="ie-clock-cue"></span></div><div class="ie-out" id="ie-out-cue"></div></div>
        ${fu.length ? `<div class="ie-fu" id="ie-fu"${done || bag("fu")[it.id] ? "" : " hidden"}><h2 class="t-head">The examiner's follow-up questions</h2>
          ${fu.map((q, i) => sq(`f${i}`, q, `data-fask="${i}"`, `data-frec="${i}"`, i + 1)).join("")}</div>` : ""}`
        : qs.map((q, i) => sq(i, q, `data-ask="${i}"`, `data-rec="${i}"`, i + 1)).join("")}
      <p class="t-min">${mode === "rec" ? "Recordings stay in this page only and disappear when you leave." : mode === "tr" ? "The transcript is made by your browser and may miss words." : ""} Aim for ${it.part === 1 ? "two to four sentences per answer" : it.part === 2 ? "the full two minutes" : "a developed answer of about a minute, with reasons and examples"}.</p>
      ${it.phrases ? `<details class="ie-plan"><summary class="t-head">${ico("lightbulb", 18)}Useful language</summary><ul>${it.phrases.map(p => `<li>${md(p)}</li>`).join("")}</ul></details>` : ""}
      ${done ? "" : `<button type="button" class="glass-btn glass-btn--block" id="ie-sdone">${ico("seal-check", 18)}Show the model answer</button>`}</div>
      ${done ? `<div class="card ie-card">${modelHtml(it.model, "Model answer")}</div><div class="card ie-card" data-selfwrap="${esc(it.id)}">${SELF().selfHtml("s", run.self[it.id], it)}</div>` : ""}`;
  }

  function wireItem(it, fb){
    const el = a.querySelector("#ie-item");
    const qs = it.sets ? it.sets.flatMap(s => s.items) : SCORED.has(it.type) ? [it] : [];
    if(!fb && !locked()) for(const q of qs) wireQ(el, q, () => ans(q.id), setAns);
    el.querySelectorAll("[data-say-model]").forEach(b => b.onclick = () => say(plain(it.model.text.join(" ")), {voice: "f"}));
    if(it.type === "card") el.querySelectorAll("[data-ex]").forEach(b => b.onclick = () => say(plain(it.examples[+b.dataset.ex].text), {voice: "f"}));
    if(it.type === "reading") wireReading(it, el);
    if(it.type === "listening") wireListen(it, el);
    if(it.type === "writing") wireWriting(it, el);
    if(it.type === "speaking") wireSpeaking(it, el);
    if(it.type === "say") wireSay(it, el);
  }
  function wireSay(it, el){
    el.querySelectorAll("[data-say]").forEach(b => b.onclick = () => say(plain(it.text), {voice: "f", slow: b.dataset.say === "slow"}));
    const r = el.querySelector("#ie-rec1"), au = el.querySelector("#ie-aud"), my = view; let url = null;
    viewCleanups.push(() => { if(url) URL.revokeObjectURL(url); url = null; });
    if(r) r.onclick = async () => {
      if(recCtl){ recCtl.stop(); return; }
      let c; try{ c = await record(15); }catch(e){ toast("The microphone isn't available."); return; }
      if(!alive || my !== view){ c.stop(); return; }
      recCtl = c; r.innerHTML = `${ico(STOP_ICO, 18)}Stop`;
      const res = await c.done; if(recCtl === c) recCtl = null;
      if(!alive || my !== view){ if(res.url) URL.revokeObjectURL(res.url); return; }
      r.innerHTML = `${ico("microphone", 18)}Record again`;
      if(res.url){ if(url) URL.revokeObjectURL(url); url = res.url; au.src = url; au.hidden = false; try{ await au.play(); }catch(e){} }
    };
  }

  /* reading on a phone: each item keeps its pane and the scroll of each pane */
  let restoring = false;
  const rpos = it => { const r = bag("rpos"); return isObj(r[it.id]) ? r[it.id] : (r[it.id] = {}); };
  function restoreScroll(it){
    const to = +rpos(it)[pane(it)] || 0; restoring = true;
    requestAnimationFrame(() => { W.scrollTo(0, to); requestAnimationFrame(() => { restoring = false; }); });
  }
  function wireReading(it, el){
    const rd = el.querySelector(".ie-read"), my = view; let raf = 0;
    const onScroll = () => { if(restoring || raf) return; raf = requestAnimationFrame(() => { raf = 0; if(restoring || my !== view) return; rpos(it)[pane(it)] = Math.round(W.scrollY); saveSoon(); }); };
    W.addEventListener("scroll", onScroll, {passive: true});
    viewCleanups.push(() => { W.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); });
    el.querySelectorAll(".ie-rtog [data-pane]").forEach(b => b.onclick = () => {
      const old = pane(it), nw = b.dataset.pane;
      el.querySelectorAll(".ie-rtog [data-pane]").forEach(x => x.setAttribute("aria-selected", x === b));
      if(old === nw) return;
      rpos(it)[old] = Math.round(W.scrollY);
      bag("panes")[it.id] = nw; save();
      rd.dataset.pane = nw;
      restoreScroll(it);
    });
  }

  /* ----- listening outside exam mode ----- */
  function noAudio(it){
    bag("noaudio")[it.id] = true; save();
    if(exam()) return xFail(LIS.indexOf(it));
    show();
    announce("No English voice on this device: read the transcript instead.");
  }
  function wireListen(it, el){
    if(exam() || bag("noaudio")[it.id]) return;
    const play = el.querySelector("#ie-play"), stop = el.querySelector("#ie-stop"), pr = el.querySelector("#ie-lprog"), bar = el.querySelector("#ie-lbar"), clk = el.querySelector("#ie-lclk");
    if(!play) return;
    const vo = voicesOf(it), lines = [{s: null, t: it.context}].concat(it.script), my = view;
    let gen = 0;
    const gone = g => !alive || g !== gen || my !== view;
    const wait = (ms, g) => new Promise(r => setTimeout(r, ms)).then(() => !gone(g));
    /* a pause line's reading time: the polite live region says what it is once, the digits tick in an aria-hidden span */
    const count = (secs, g, label) => new Promise(res => {
      const end = Date.now() + secs * 1000; let shown = -1;
      if(pr.textContent !== label) pr.textContent = label;
      const over = ok => { clearInterval(iv); clk.textContent = ""; res(ok); };
      const step = () => { if(gone(g)) return over(false);
        const left = Math.max(0, Math.ceil((end - Date.now()) / 1000)); if(left !== shown){ shown = left; clk.textContent = `· ${fmtTime(left)}`; }
        if(Date.now() >= end) over(true); };
      const iv = setInterval(step, 250); step(); viewCleanups.push(() => over(false));
    });
    play.onclick = async () => {
      if(test && play.disabled) return;
      const g = ++gen; if(stop) stop.hidden = false;
      if(test){ play.disabled = true; play.innerHTML = `${ico("play", 20)}Playing`; }
      const n = canSay() ? await voiceCount() : 0;
      if(gone(g)) return;
      if(n === 0) return noAudio(it);
      const from = test ? Math.max(0, Math.min(lines.length - 1, +bag("lpos")[it.id] || 0)) : 0;
      for(let i = from; i < lines.length; i++){
        if(gone(g)) return;
        if(test){ bag("lpos")[it.id] = i; save(); }
        pr.textContent = i === 0 ? "Introduction" : test ? "Playing" : (it.speakers.find(s => s.id === lines[i].s) || {}).name || "";
        bar.style.width = `${i / lines.length * 100}%`;
        const ok = await say(plain(lines[i].t), i === 0 ? narrator(it) : lineOpts(vo, lines[i]));
        if(gone(g)) return;
        if(!ok && i === from && !run.heard[it.id]) return noAudio(it);   /* the first line couldn't be spoken, and we didn't stop it */
        if(ok && !run.heard[it.id]){ run.heard[it.id] = true; save(); }
        if(!(await wait(i === 0 ? 900 : 280, g))) return;
        if(+lines[i].pause > 0 && !(await count(+lines[i].pause, g, readLabel(lines[i].t)))) return;
      }
      if(gone(g)) return;
      bar.style.width = "100%"; pr.textContent = "That is the end of the recording.";
      if(stop) stop.hidden = true;
      if(test){ bag("played")[it.id] = true; save(); play.innerHTML = `${ico("play", 20)}Played`; play.disabled = true; }
      else play.innerHTML = `${ico("play", 20)}Play again`;
    };
    if(stop) stop.onclick = () => { gen++; hush(); stop.hidden = true; pr.textContent = "Stopped."; };
  }

  /* ----- exam-style Listening: one recording for the whole test ----- */
  let XST = null, xgen = 0, xrun = false;
  const FINAL = "That is the end of the Listening test. You now have two minutes to check your answers.";
  const qRange = qs => qs.length ? [NUM[qs[0].id], NUM[qs[qs.length - 1].id] + marks(qs[qs.length - 1]) - 1] : null;
  /* the range the voice has just named ("…look at questions 11 to 20"), else the part's first set */
  const named = t => { const m = RANGE.exec(plain(t)); return m ? [m[1], m[2]] : null; };
  /* every step of the recording: what is said (say) or a countdown (secs) */
  function xSteps(){
    const out = [];
    LIS.forEach((it, k) => {
      const nar = narrator(it), vo = voicesOf(it), end = it.script.length, lastPart = k === LIS.length - 1;
      const r = named(it.context) || qRange(it.sets && it.sets[0] ? it.sets[0].items : []);
      out.push({k, line: -1, phase: "ctx", say: it.context, o: nar, after: 900});
      out.push({k, line: -1, phase: "preview", secs: () => EX().preview, label: r ? `Time to read questions ${r[0]} to ${r[1]}` : "Time to read the questions"});
      it.script.forEach((l, i) => {
        out.push({k, line: i, phase: "line", say: l.t, o: lineOpts(vo, l), after: 280});
        const p = +l.pause;
        if(p > 0) out.push({k, line: i, phase: "pause", secs: () => p, label: readLabel(l.t)});
      });
      out.push({k, line: end, phase: "end", say: lastPart ? FINAL : `That is the end of Part ${it.part}.`, o: nar, after: 400});
      out.push({k, line: end, phase: lastPart ? "review" : "check", secs: () => lastPart ? EX().review : EX().check, label: "Time to check your answers"});
    });
    return out;
  }
  const steps = () => XST || (XST = xSteps());
  /* the recording is stopped while a started exam waits for «Continue the recording» (or hasn't started it) */
  const xStopped = () => exam() && running() && !xrun && !(isObj(run.x) && run.x.phase === "done");
  /* where a step sits in its part: ctx, preview (line -1), then each line and its pause, then end and check/review */
  const RANK = {ctx: 0, preview: 1, line: 0, pause: 1, end: 0, check: 1, review: 1};
  const same = (t, x) => !!t && t.k === x.k && t.phase === x.phase && t.line === x.line;
  function xFind(S){
    const x = run.x; if(!isObj(x)) return 0;
    if(x.phase === "done") return S.length;
    if(Number.isInteger(x.s) && same(S[x.s], x)) return x.s;
    const j = S.findIndex(t => same(t, x));
    if(j >= 0) return j;
    /* the saved step isn't in the data any more (a pause line removed, a script shortened): go on from the next step
       that is there, never back to Part 1, as what has already played is lost */
    if(!Number.isInteger(x.k) || x.k < 0) return 0;
    if(x.k >= LIS.length) return S.length - 1;           /* the part is gone: every part has played, the review is left */
    const end = LIS[x.k].script.length;
    let line = Number.isInteger(x.line) ? x.line : -1, r = RANK[x.phase] != null ? RANK[x.phase] : 0;
    if(line > end){ line = end; if(x.phase === "pause") r = 0; }   /* past a shorter script: its end */
    const n = S.findIndex(t => t.k > x.k || (t.k === x.k && (t.line > line || (t.line === line && RANK[t.phase] >= r))));
    return n >= 0 ? n : S.length - 1;
  }
  /* a new part starts: follow it from the part before or from the intro card, else offer it in a chip */
  function xFollow(k){
    const idx = L.items.indexOf(LIS[k]); if(run.i === idx) return;
    const prev = k > 0 ? L.items.indexOf(LIS[k - 1]) : -1, first = L.items.indexOf(LIS[0]);
    if(run.i === prev || (run.i < first && L.items[run.i].type !== "listening")){ run.i = idx; show(); }
  }
  async function xPlay(){
    if(xrun || !exam() || run.finished || !alive) return;
    const S = steps();
    let s = xFind(S);
    const my = ++xgen; xrun = true;
    const ok = () => alive && my === xgen && !run.finished;
    xPaint();
    for(; s < S.length; s++){
      const t = S[s], it = LIS[t.k];
      const resume = isObj(run.x) && same(t, run.x) && run.x.left != null && t.secs ? +run.x.left : null;
      run.x = {s, k: t.k, line: t.line, phase: t.phase}; save();
      if(t.phase === "ctx") xFollow(t.k);
      if(t.phase === "review") top();
      xPaint();
      if(t.say != null){
        const r = await say(plain(t.say), t.o);
        if(!ok()) return;
        if(!r && t.phase === "ctx" && !run.heard[it.id]) return xFail(t.k);   /* the first line couldn't be spoken, and we didn't stop it */
        if(r && !run.heard[it.id]){ run.heard[it.id] = true; save(); }
        if(t.phase === "end"){ bag("played")[it.id] = true; save(); }
        await new Promise(res => setTimeout(res, t.after));
        if(!ok()) return;
      } else if(!(await xCount(resume != null ? resume : t.secs(), my))) return;
    }
    xrun = false; run.x = {s: S.length, k: LIS.length - 1, line: -1, phase: "done"}; save();
    finish();
  }
  function xCount(secs, my){
    return new Promise(res => {
      const end = Date.now() + Math.max(0, secs) * 1000; let shown = -1;
      const step = () => {
        if(!alive || my !== xgen || run.finished){ clearInterval(iv); return res(false); }
        const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        if(left !== shown){ shown = left; run.x.left = left; save(); xPaint(); }
        if(Date.now() >= end){ clearInterval(iv); res(true); }
      };
      const iv = setInterval(step, 250); step();
    });
  }
  /* no voice: the timed clock and the transcripts, as in a test without exam mode */
  function xFail(k){
    xgen++; xrun = false; hush();
    run.xmode = "timed";
    LIS.forEach((it, j) => { if(j >= k || !bag("played")[it.id]) bag("noaudio")[it.id] = true; });
    save(); show();
    announce("No English voice on this device: read the transcripts instead.");
  }
  async function xStart(){
    const n = canSay() ? await voiceCount() : 0;
    if(!alive || run.finished || !exam()) return;
    if(n === 0) return xFail(isObj(run.x) ? run.x.k : 0);
    xPlay();
  }
  function xStatus(k, x, t){
    const it = LIS[k], n = it.script.length;
    if(!x || k > x.k) return {t: k === 0 ? "This part plays first." : `Waiting: this part plays after Part ${LIS[k - 1].part}.`, p: 0};
    if(k < x.k || x.phase === "done") return {t: "Done: this part has finished.", p: 1};
    const p = Math.max(0, Math.min(1, (x.line + 1) / (n + 1)));
    if(!xrun) return {t: "Stopped: continue the recording to go on.", p};
    if(t && t.secs) return {t: t.label, c: x.left != null ? x.left : t.secs(), p};
    return {t: x.phase === "ctx" ? "Playing: the introduction" : "Playing", p};
  }
  function xPaint(){
    if(!alive || !exam() || !run.started || run.finished || screen !== "items") return;
    const x = isObj(run.x) ? run.x : null, S = steps(), t = x ? S[x.s] : null;
    const cur = x && x.phase !== "done" ? LIS[x.k] : null;
    const bar = D.getElementById("ie-xbar");
    if(bar){
      let h = "";
      if(!xrun && !(x && x.phase === "done")) h = `<div class="card ie-card ie-xgo"><p class="t-sub">${x ? "The recording stopped when you left: it goes on from there, and what has played can't be heard again." : "The recording hasn't started yet."} Until it plays, the time counts as a pause.</p>
        <button type="button" class="glass-btn glass-btn--pri" id="ie-xgo">${ico("play", 20)}${x ? "Continue the recording" : "Start the recording"}</button></div>`;
      else if(xrun && cur && L.items[run.i] !== cur && x.phase !== "review") h = `<button type="button" class="ie-xchip" id="ie-xchip">${ico("speaker-high", 18)}<span>Part ${cur.part} is playing · Go to Part ${cur.part}</span></button>`;
      if(bar.dataset.h !== h){
        bar.dataset.h = h; bar.innerHTML = h;
        const g = bar.querySelector("#ie-xgo"); if(g) g.onclick = () => { if(g.disabled) return; g.disabled = true; xStart(); };
        const c = bar.querySelector("#ie-xchip"); if(c) c.onclick = () => { if(isObj(run.x)){ run.i = L.items.indexOf(LIS[run.x.k]); show(); } };
      }
    }
    const it = L.items[run.i];
    if(it && it.type === "listening" && !bag("noaudio")[it.id]){
      const s = xStatus(LIS.indexOf(it), x, t), te = D.getElementById("ie-xst"), ce = D.getElementById("ie-xclk"), lb = D.getElementById("ie-lbar");
      if(te && te.textContent !== s.t) te.textContent = s.t;
      const c = s.c != null ? ` · ${fmtTime(s.c)}` : "";
      if(ce && ce.textContent !== c) ce.textContent = c;
      if(lb) lb.style.width = `${s.p * 100}%`;
    }
    if(x && x.phase === "review") paintClock(x.left != null ? x.left : EX().review);
  }
  cleanups.push(() => { xgen++; xrun = false; });

  /* ----- writing ----- */
  function wireWriting(it, el){
    const ta = el.querySelector("#ie-ta"), wc = el.querySelector("#ie-wc"), ck = el.querySelector("#ie-wclock");
    if(ta){
      const fit = () => { ta.style.height = "auto"; ta.style.height = Math.max(260, ta.scrollHeight + 4) + "px"; };
      if(!ta.readOnly){ ta.oninput = () => { setAns(it.id, ta.value); wc.textContent = `${words(ta.value)} words`; if(!run.wt) run.wt = {}; if(!run.wt[it.id]) run.wt[it.id] = Date.now(); };
        ta.addEventListener("input", fit); }
      requestAnimationFrame(fit);
    }
    if(ck){
      const iv = setInterval(() => { if(!alive || !D.body.contains(ck)) return clearInterval(iv); const t0 = run.wt && run.wt[it.id]; if(t0) ck.textContent = ` · ${fmtTime((Date.now() - t0) / 1000)} of ${it.minutes}:00`; }, 1000);
      viewCleanups.push(() => clearInterval(iv));
    }
    const d = el.querySelector("#ie-wdone");
    if(d) d.onclick = () => {
      const t = ans(it.id) || ""; if(words(t) < 30 && !confirm("That's very short. Compare anyway?")) return;
      run.checked[it.id] = true; save(); saveEssay(it); show();
      const c = a.querySelector(".ie-wchecks");
      if(c){ const h = c.querySelector("h2"); if(h){ h.setAttribute("tabindex", "-1"); h.focus({preventScroll: true}); }
        /* after the answer box has taken its full height (its own requestAnimationFrame comes first) */
        requestAnimationFrame(() => { if(c.isConnected) c.scrollIntoView({block: "start", behavior: calm() ? "auto" : "smooth"}); }); }
      announce("Checks, the band 9 model and the self-marking are below your answer.");
    };
    wireSelfBox(el, it);
  }
  function wireSelfBox(root, it){
    const box = root.querySelector(`[data-selfwrap="${CSS.escape(it.id)}"]`); if(!box) return;
    const kind = selfKind(it);
    SELF().wireSelf(box, kind, () => run.self[it.id], (c, b) => {
      run.self[it.id] = c; save();
      if(kind !== "s") saveEssay(it, b);
      else if(b != null){ bag("sband")[it.id] = b; save(); }
    }, it);
  }
  function saveEssay(it, b){
    const t = ans(it.id) || ""; if(!t.trim()) return;
    if(!run.eid) run.eid = {}; if(!run.eid[it.id]) { run.eid[it.id] = `${it.id}-${Date.now().toString(36)}`; save(); }
    P().addEssay({id: run.eid[it.id], iid: it.id, task: it.task, prompt: it.prompt, text: t, words: words(t), self: run.self[it.id] || null, band: b != null ? b : SELF().selfBand(run.self[it.id] || {}, selfKind(it))});
  }

  /* ----- speaking ----- */
  function wireSpeaking(it, el){
    const my = view, gone = () => !alive || my !== view, mode = smode(), urls = {};
    const fu = it.part === 2 && Array.isArray(it.followups) ? it.followups : [];
    const revoke = k => { if(urls[k]){ URL.revokeObjectURL(urls[k]); delete urls[k]; } };
    viewCleanups.push(() => { for(const k of Object.keys(urls)) revoke(k); });
    el.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { run.smode = b.dataset.mode; save(); show(); });
    const notes = el.querySelector("#ie-notes"); if(notes) notes.oninput = () => setAns(it.id + ":notes", notes.value);
    el.querySelectorAll("[data-ask]").forEach(b => b.onclick = () => say(plain(it.questions[+b.dataset.ask]), {voice: "m"}));
    el.querySelectorAll("[data-fask]").forEach(b => b.onclick = () => say(plain(fu[+b.dataset.fask]), {voice: "m"}));
    /* one answer: the target on the clock, the recording stops at max */
    const answer = async (k, tgt, max, btn, after) => {
      const clock = el.querySelector(`#ie-clock-${k}`), out = el.querySelector(`#ie-out-${k}`);
      if(recCtl){ recCtl.stop(); return; }
      hush(); revoke(k);
      const tick = s => { if(clock) clock.textContent = `${fmtTime(s)} / ${fmtTime(tgt)}`; };
      let kind = mode, c = null;
      try{
        if(kind === "tr") c = transcribe(max, tick, txt => { out.innerHTML = `<p class="ie-live">${esc(txt)}</p>`; });
        else if(kind === "rec") c = await record(max, tick);
      }catch(e){ c = null; }
      if(gone()){ if(c) c.stop(); return; }
      /* no microphone: the timer runs to the target (30 s, 60 s, 2:00, 20 s for a follow-up): no recording to cap */
      if(!c){ if(kind !== "none") toast("The microphone isn't available: answer aloud while the timer runs."); kind = "none"; c = timerOnly(tgt, tick); }
      recCtl = c; tick(0);
      viewCleanups.push(() => { try{ c.stop(); }catch(e){} });
      const label = btn ? btn.innerHTML : "";
      if(btn){ btn.innerHTML = `${ico(STOP_ICO, 18)}Stop`; btn.classList.add("glass-btn--pri"); }
      const res = await c.done; if(recCtl === c) recCtl = null;
      if(gone()){ if(res.url) URL.revokeObjectURL(res.url); return; }
      if(btn){ btn.innerHTML = /Answer/.test(label) ? `${ico(kind === "none" ? "timer" : "microphone", 18)}Answer again` : label; btn.classList.remove("glass-btn--pri"); }
      const capped = k !== "cue" && res.secs >= max - .5, note = capped ? " · The examiner would usually move on here." : "";
      if(kind === "tr") out.innerHTML = res.text ? `<p class="ie-live">${esc(res.text)}</p><p class="t-note">${esc(speechStats(res.text, res.secs))}${note}</p>` : `<p class="t-note">Nothing was heard.${note}</p>`;
      else if(kind === "rec"){ if(res.url) urls[k] = res.url;
        out.innerHTML = res.url ? `<audio controls src="${res.url}"></audio><p class="t-note">${fmtTime(res.secs)}${k === "cue" && res.secs < 90 ? " · In Part 2, keep going until the examiner stops you at two minutes." : ""}${note}</p>` : `<p class="t-note">Nothing was recorded.${note}</p>`; }
      else {
        out.innerHTML = `<p class="t-note">You spoke for ${fmtTime(res.secs)}${k === "cue" && res.secs < 90 ? ". In Part 2, keep going until the examiner stops you at two minutes" : ""}.${note}</p>`;
        await say("Thank you.", {voice: "m"});
        if(gone()) return;
      }
      if(after) after();
    };
    el.querySelectorAll("[data-rec]").forEach(b => b.onclick = () => answer(b.dataset.rec, target(it), Math.round(target(it) * 1.5), b));
    /* Part 2 follow-ups: the examiner asks each one after the long turn; 20 s answers, stopped at 30 s */
    const asked = {};
    const ask = i => { if(i >= fu.length || asked[i] || gone()) return; asked[i] = true; say(plain(fu[i]), {voice: "m"}); };
    el.querySelectorAll("[data-frec]").forEach(b => b.onclick = () => { const i = +b.dataset.frec; asked[i] = true; answer(`f${i}`, 20, 30, b, () => ask(i + 1)); });
    const prep = el.querySelector("#ie-prep");
    if(prep) prep.onclick = async () => {
      if(prep.dataset.phase === "talk"){ if(recCtl) recCtl.stop(); return; }
      if(prep.dataset.phase === "prep"){ prep.dataset.skip = "1"; return; }
      const clock = el.querySelector("#ie-clock-cue");
      for(const k of Object.keys(asked)) delete asked[k];
      prep.dataset.phase = "prep"; delete prep.dataset.skip; prep.innerHTML = `${ico("caret-right", 18)}I'm ready: speak now`;
      say(`${plain(it.cue.task)}. You have one minute to prepare.`, {voice: "m"});
      const t0 = Date.now(), PREP = it.prep || 60;
      await new Promise(r => {
        const iv = setInterval(() => { const s = (Date.now() - t0) / 1000; if(clock) clock.textContent = `Preparing ${fmtTime(PREP - s)}`;
          if(s >= PREP || prep.dataset.skip || gone()){ clearInterval(iv); r(); } }, 250);
        viewCleanups.push(() => { clearInterval(iv); r(); });
      });
      if(gone()) return;
      if(clock) clock.textContent = "Speak for one to two minutes";
      prep.dataset.phase = "talk"; prep.innerHTML = `${ico(STOP_ICO, 18)}Stop`;
      await say("All right. Remember you have one to two minutes for this. Please start speaking now.", {voice: "m"});
      if(gone()) return;
      await answer("cue", 120, target(it), null);
      if(gone()) return;
      prep.dataset.phase = ""; delete prep.dataset.skip; prep.innerHTML = `${ico("arrow-counter-clockwise", 18)}Try again`;
      if(fu.length){
        const box = el.querySelector("#ie-fu"); if(box) box.hidden = false;
        if(!bag("fu")[it.id]){ bag("fu")[it.id] = true; save(); }
        ask(0);
      }
    };
    const sd = el.querySelector("#ie-sdone");
    if(sd) sd.onclick = () => { if(recCtl) recCtl.stop(); run.checked[it.id] = true; save(); show(); };
    wireSelfBox(el, it);
  }

  /* ----- finishing ----- */
  function finish(){
    if(run.finished) return;
    stopClock(); xgen++; xrun = false; hush(); if(recCtl){ try{ recCtl.stop(); }catch(e){} recCtl = null; }
    addHidden();
    const got = QS.reduce((s, x) => s + mark(x.q, ans(x.q.id)), 0), total = QS.reduce((s, x) => s + x.m, 0);
    const b = (skill === "listening" || skill === "reading") && total ? band(skill, got, total) : null;
    run.finished = true; run.fin = Date.now(); run.got = got; run.total = total; run.band = b;   /* fin: finished (and logged) by this version */
    if(test) run.paused = (run.away || 0) > 120000;
    save();
    for(const it of L.items) if(it.type === "writing" && (ans(it.id) || "").trim()) saveEssay(it);
    P().done(lid, total ? {got, total, band: test ? b : null} : {});
    if(test && b != null){
      const t = {lid, title: `${L.title}${tag}`, skill, got, total, band: b, paused: !!run.paused};
      if(LIS.some(it => bag("noaudio")[it.id])) t.noaudio = true;
      let rec = null; try{ rec = P().addTest(t); }catch(e){ console.error(e); }
      if(isObj(rec)){ if(typeof rec.counted === "boolean") run.counted = rec.counted; if(rec.attempt != null) run.attempt = rec.attempt; save(); }
    }
    results();
  }
  /* drawn at once; the Next lesson link comes when nextOf() resolves */
  function results(){
    newView("results"); stopClock(); xgen++; xrun = false;
    top();
    const sn = D.getElementById("ie-stepn"); if(sn) sn.textContent = "";
    const my = view;
    const scoreLine = run.total ? `${run.got} of ${run.total} correct` : "";
    const writes = L.items.filter(i => i.type === "writing"), speaks = L.items.filter(i => i.type === "speaking");
    const notes = [];
    if(test){
      if(run.counted === false) notes.push("Repeat or paused test: not counted in your bands.");
      if(run.paused) notes.push("Paused for more than two minutes: not under exam conditions.");
      if(LIS.some(it => bag("noaudio")[it.id])) notes.push("Some recordings couldn't play on this device: not under exam conditions.");
      if(run.band != null && run.total < 40) notes.push(`Part test: ${run.got} of ${run.total}. Your headline bands come from full papers and pooled results.`);
    }
    const noteHtml = notes.map(n => `<p class="t-note ie-rnote">${esc(n)}</p>`).join("");
    a.innerHTML = `<div class="ie-page ie-narrow">
      <div class="card ie-card ie-result">${run.band != null ? `<p class="ie-kicker">${esc(skill[0].toUpperCase() + skill.slice(1))}</p><p class="ie-bigband t-num">${fmtBand(run.band)}</p><p class="t-head">${scoreLine}</p>
        ${noteHtml}<p class="t-note">${run.band >= 8.5 ? "C2 level. Now make it consistent." : run.band >= 7 ? "Close: look at every miss below and why it was wrong." : "Review the misses, then repeat the unit's practice."}</p>`
        : `${ico("seal-check", 44)}<h1 class="t-2">Lesson complete</h1>${scoreLine ? `<p class="t-head">${scoreLine}</p>` : ""}${noteHtml}`}
        <div class="ie-row-b"><span id="ie-nextl" hidden></span><a class="glass-btn" href="${esc(back)}">${virtual ? `Back to ${esc(backT)}` : "Back to the unit"}</a>
        <button type="button" class="glass-btn" id="ie-redo">${ico("arrow-counter-clockwise", 18)}Do it again</button></div></div>
      ${test && QS.length ? `<h2 class="ie-bh">${ico("list-checks", 20)}Review</h2>${L.items.filter(i => i.sets || SCORED.has(i.type)).map(it => `<div class="card ie-card">
          ${it.title ? `<h3 class="t-head">${md(it.title)}</h3>` : ""}${it.sets ? it.sets.map(s => setBody(s, true)).join("") : qHtml(it, ans(it.id), NUM[it.id], true)}
          ${it.type === "listening" ? transcriptHtml(it, false) : ""}</div>`).join("")}` : ""}
      ${writes.map(it => `<h2 class="ie-bh">${ico("pencil-simple", 20)}Task ${it.task}</h2><div class="card ie-card"><p class="ie-prompt">${md(it.prompt)}</p>
        <div class="ie-essay">${String(ans(it.id) || "").split(/\n+/).filter(s => s.trim()).map(p => `<p>${esc(p)}</p>`).join("") || `<p class="t-sub">You didn't write anything.</p>`}</div></div>
        ${writingFeedback(it)}`).join("")}
      ${test ? speaks.map(it => `<div class="card ie-card">${modelHtml(it.model, `Speaking Part ${it.part}: model answer`)}</div>`).join("") : ""}
    </div>`;
    a.querySelector("#ie-redo").onclick = () => {
      if(!confirm("Start this lesson again? Your answers here will be cleared.")) return;
      LS.del(RK(lid)); run = fresh(); hold = false; hiddenAt = 0; show();
    };
    const ms = [...writes, ...(test ? speaks : [])].map(x => x.model);
    a.querySelectorAll("[data-say-model]").forEach((b, i) => { b.onclick = () => { if(ms[i]) say(plain(ms[i].text.join(" ")), {voice: "f"}); }; });
    for(const it of writes) wireSelfBox(a, it);
    if(skill === "speaking" || speaks.length){
      const bs = Object.values(run.sband || {}); if(bs.length && !run.sSaved){ run.sSaved = true; save(); P().addSpeaking({title: `${L.title}${tag}`, band: roundBand(bs.reduce((x, y) => x + y, 0) / bs.length)}); }
    }
    nextOf().then(nx => {
      if(!alive || my !== view || !nx) return;
      const s = a.querySelector("#ie-nextl");
      if(s) s.outerHTML = `<a class="glass-btn glass-btn--pri" href="#/lesson/${esc(nx.id)}">Next lesson${ico("caret-right", 20)}</a>`;
    }).catch(() => {});
    announce(run.band != null ? `Band ${fmtBand(run.band)}. ${scoreLine}.` : `Lesson complete.${scoreLine ? ` ${scoreLine}.` : ""}`);
    W.scrollTo(0, 0);
  }
  async function nextOf(){
    const i = U.lessons.indexOf(L);
    if(i >= 0 && i < U.lessons.length - 1) return U.lessons[i + 1];
    if(virtual) return null;
    const av = data.avail(), j = av.findIndex(r => r.id === U.id);
    if(j >= 0 && j < av.length - 1){ try{ const u2 = await data.unit(av[j + 1].id); return u2.lessons[0]; }catch(e){} }
    return null;
  }

  show();
  /* leaving the page: save, stop the clock, the recording, the voice and the microphone */
  return () => {
    alive = false; stopClock(); clearTimeout(st); clearTimeout(liveT); xgen++;
    addHidden();
    save(); hush(); view++; flushView();
    cleanups.forEach(f => { try{ f(); }catch(e){} });
    live.remove();
  };
};
/* speaking lessons finished without a test still record the estimate when you mark yourself (see results) */
IE.player = {questions, mark, marks, writingChecks, selfBand, norm, EXAM};
})();
