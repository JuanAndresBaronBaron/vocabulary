/* IELTS Prep: the lesson player (#/lesson/<lessonId>) and its results. Loaded by ielts.html after js/ielts.js.
   · learn and practice lessons: one item per screen, «Check» gives the answer and why at once.
   · test lessons: an intro, then the clock ("timed" seconds; it pauses while you're away), free movement between items,
     no feedback until «Finish», then the band (Listening/Reading conversion) and a full review.
   · Items: card, pick, multi, tfng, gap, select, order (alone or in the sets of a reading or listening), reading
     (passage and questions side by side, or switched on a phone), listening (read aloud by the British voices, once in
     a test), writing (word count, clock, automatic checks, a band 9 model and marking yourself against the four
     criteria), speaking (the examiner's voice, recording to listen back, or a live transcript where the browser can),
     say (listen, record, compare).
   · A lesson in progress is saved as you go ("ielts:run:<lid>"): reloading or coming back later picks it up. */
(() => {
"use strict";
const W = window, D = document, IE = W.IE;
if(!IE) return;
const {esc, md, ico, LS, isObj, data, band, roundBand, fmtBand, prog, speak, stopSpeak, canSpeak, setTop, toast} = IE;
const SCORED = new Set(["pick", "multi", "tfng", "gap", "select", "order"]);
const STOP_ICO = "stop";   /* only in the fill style: ico() of js/ielts.js falls back to it */
const RK = lid => `ielts:run:${lid}`;
const fmtTime = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const words = t => (String(t || "").match(/[A-Za-z0-9’'-]+/g) || []).filter(w => /[A-Za-z0-9]/.test(w)).length;

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
/* fb: null while answering; true once checked (shows right/wrong and why) */
/* options that already start with their letter ("A one week") lose it: the letter is drawn beside them */
const optText = (q, i) => q.options.every((o, j) => new RegExp(`^${String.fromCharCode(65 + j)}[.)]?\\s+`).test(o)) ? q.options[i].replace(/^[A-Z][.)]?\s+/, "") : q.options[i];
function qHtml(q, a, num, fb){
  const lab = num ? `<span class="ie-qn t-num">${num}</span>` : "";
  const res = fb ? mark(q, a) : 0, full = fb && res === marks(q);
  const why = fb ? `<div class="ie-why ${full ? "is-ok" : "is-miss"}" role="note">${ico(full ? "check-circle" : "x-circle", 18)}<div>
      ${!full && q.type !== "select" ? `<p><b>Answer:</b> ${md(answerText(q))}</p>` : ""}${q.why ? `<p>${md(q.why)}</p>` : ""}</div></div>` : "";
  const dis = fb ? " disabled" : "";
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
      return `<div class="ie-q" data-q="${esc(q.id)}"><p class="ie-gap">${lab}${md(b)}<input type="text" class="ie-in${fb ? ok ? " is-right" : " is-wrong" : ""}" value="${esc(a || "")}" aria-label="Answer${num ? " " + num : ""}" autocomplete="off" autocapitalize="off" spellcheck="false"${fb ? " readonly" : ""}>${md(af)}</p>
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
        ${fb ? "" : `<div class="ie-opts ie-pool">${pool.map(i => `<button type="button" class="ie-opt" data-add="${i}">${md(q.items[i])}</button>`).join("")}</div>
        <p class="t-min">${pool.length ? "Tap them in the right order. Tap a chosen one to take it back." : "Tap one to take it back."}</p>`}${why}</div>`; }
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
function writingChecks(text, it){
  const out = [], t = String(text || ""), w = words(t), low = t.toLowerCase();
  const paras = t.split(/\n\s*\n|\n/).filter(s => s.trim()).length;
  out.push(w >= it.minWords ? {ok: true, t: `${w} words: above the ${it.minWords}-word minimum.`} : {ok: false, t: `${w} words: under ${it.minWords} loses marks for task achievement.`});
  if(it.task === 2) out.push(paras >= 4 && paras <= 6 ? {ok: true, t: `${paras} paragraphs.`} : {ok: false, t: `${paras} paragraph${paras === 1 ? "" : "s"}: aim for an introduction, two or three body paragraphs and a conclusion.`});
  else out.push(paras >= 3 ? {ok: true, t: `${paras} paragraphs.`} : {ok: false, t: `${paras} paragraph${paras === 1 ? "" : "s"}: separate the introduction, the overview and the details.`});
  if(it.task === 1){
    out.push(/\b(overall|in general|in summary|it is (clear|evident|apparent))\b/i.test(t) ? {ok: true, t: "There's an overview."} : {ok: false, t: "No clear overview found: Task 1 can't go above band 5 for Task Achievement without one."});
    if(/\b(i think|i believe|in my (opinion|view)|i feel)\b/i.test(t)) out.push({ok: false, t: "Task 1 reports data: leave out opinions."});
  } else {
    out.push(/\b(i (would )?(believe|argue|contend|maintain|agree|disagree|am convinced)|in my (view|opinion)|my (view|position) is|i (would|do) (strongly )?(agree|disagree))\b/i.test(t)
      ? {ok: true, t: "Your position is stated."} : {ok: false, t: "Make your position explicit, in the introduction and again in the conclusion."});
  }
  const freq = {};
  for(const x of low.match(/[a-z]{4,}/g) || []) if(!STOP.has(x)) freq[x] = (freq[x] || 0) + 1;
  const lim = it.task === 2 ? 5 : 4, rep = Object.entries(freq).filter(([, n]) => n >= lim).sort((a, b) => b[1] - a[1]).slice(0, 5);
  out.push(rep.length ? {ok: false, t: `Repeated: ${rep.map(([x, n]) => `“${x}” ×${n}`).join(", ")}. Some repetition of key nouns is fine; vary the rest.`} : {ok: true, t: "No word is overused."});
  const lk = (t.match(LINKERS) || []).length;
  out.push(lk > (it.task === 2 ? 5 : 3) ? {ok: false, t: `${lk} sentence-opening linkers (Moreover, Furthermore…): band 9 cohesion is less mechanical. Use reference and substitution too.`} : {ok: true, t: "Linking isn't mechanical."});
  const cl = CLICHES.filter(c => low.includes(c));
  if(cl.length) out.push({ok: false, t: `Memorised-sounding phrases: ${cl.map(c => `“${c}”`).join(", ")}. Examiners discount them.`});
  const ct = (t.match(/\b\w+'(t|s|re|ve|ll|d|m)\b/gi) || []).filter(x => !/'s$/i.test(x) || /^(it|that|there|what|here|he|she|who)'s$/i.test(x));
  if(ct.length) out.push({ok: false, t: `Contractions (${[...new Set(ct.map(x => x.toLowerCase()))].slice(0, 4).join(", ")}): write them in full in academic writing.`});
  const sents = t.split(/[.!?]+\s/).map(s => words(s)).filter(n => n > 0);
  if(sents.length > 3){
    const long = sents.filter(n => n > 40).length, avg = sents.reduce((a, b) => a + b, 0) / sents.length;
    out.push(long ? {ok: false, t: `${long} sentence${long > 1 ? "s" : ""} over 40 words: split them so the argument stays easy to follow.`}
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
function selfHtml(kind, cur){
  const c = isObj(cur) ? cur : {};
  return `<div class="ie-self" data-self="${kind}"><h3 class="t-head">Mark yourself</h3><p class="t-note">Compare with the model and be strict. Band 9 means:</p>
    ${CRIT[kind].map(([name, d], i) => `<div class="ie-crit"><p><b>${esc(name)}</b><br><span class="t-note">${esc(d)}</span></p>
      <div class="ie-seg ie-bands" role="radiogroup" aria-label="${esc(name)}">${[5, 6, 7, 8, 9].map(b => `<button type="button" role="radio" data-c="${i}" data-b="${b}" aria-checked="${c[i] === b}">${b}</button>`).join("")}</div></div>`).join("")}
    <p class="ie-selfres t-head" aria-live="polite">${selfBand(c, kind) != null ? `Your estimate: band ${fmtBand(selfBand(c, kind))}` : ""}</p></div>`;
}
const selfBand = (c, kind) => { const v = CRIT[kind].map((_, i) => c[i]); return v.every(x => typeof x === "number") ? roundBand(v.reduce((a, b) => a + b, 0) / v.length) : null; };
function wireSelf(el, kind, get, set){
  const box = el.querySelector(`[data-self="${kind}"]`); if(!box) return;
  box.querySelectorAll("[data-b]").forEach(b => b.onclick = () => {
    const c = Object.assign({}, get() || {}); c[b.dataset.c] = +b.dataset.b; set(c, selfBand(c, kind));
    box.querySelectorAll(`[data-c="${b.dataset.c}"]`).forEach(x => x.setAttribute("aria-checked", x === b));
    const r = selfBand(c, kind); box.querySelector(".ie-selfres").textContent = r != null ? `Your estimate: band ${fmtBand(r)}` : "";
  });
}
const modelHtml = (m, title = "Band 9 model") => `<details class="ie-model" open><summary class="t-head">${ico("seal-check", 18)}${esc(title)}</summary>
  <div class="ie-mtext">${m.text.map(p => `<p>${md(p)}</p>`).join("")}</div>
  <button type="button" class="glass-btn glass-btn--sm" data-say-model>${ico("speaker-high", 18)}Listen</button>
  <h4 class="t-head">Why it scores high</h4><ul class="ie-notes">${m.notes.map(n => `<li>${md(n)}</li>`).join("")}</ul></details>`;

/* ---------- microphone ---------- */
const canRec = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && W.MediaRecorder);
const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
function mime(){ const M = W.MediaRecorder; if(!M || !M.isTypeSupported) return ""; return ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(t => { try{ return M.isTypeSupported(t); }catch(e){ return false; } }) || ""; }
/* records up to max seconds; returns {stop(), done: Promise<{url, secs}>} */
async function record(max, tick){
  const stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}});
  const type = mime(); let mr;
  try{ mr = new MediaRecorder(stream, type ? {mimeType: type} : undefined); }catch(e){ mr = new MediaRecorder(stream); }
  const bits = [], t0 = Date.now();
  let res; const done = new Promise(r => { res = r; });
  mr.ondataavailable = e => { if(e.data && e.data.size) bits.push(e.data); };
  mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); clearInterval(iv); const b = new Blob(bits, {type: mr.mimeType || type || "audio/webm"}); res({url: bits.length ? URL.createObjectURL(b) : null, secs: (Date.now() - t0) / 1000}); };
  mr.start(250);
  const iv = setInterval(() => { const s = (Date.now() - t0) / 1000; if(tick) tick(s); if(s >= max) stop(); }, 250);
  const stop = () => { try{ if(mr.state !== "inactive") mr.stop(); }catch(e){ res({url: null, secs: 0}); } };
  return {stop, done};
}
function transcribe(max, tick, onText){
  const r = new SR(); r.lang = "en-GB"; r.continuous = true; r.interimResults = true;
  let fin = "", t0 = Date.now(), res, stopped = false;
  const done = new Promise(x => { res = x; });
  r.onresult = e => { let inter = ""; for(let i = e.resultIndex; i < e.results.length; i++){ const x = e.results[i]; if(x.isFinal) fin += x[0].transcript + " "; else inter += x[0].transcript; } onText((fin + inter).trim()); };
  r.onend = () => { if(!stopped && (Date.now() - t0) / 1000 < max){ try{ r.start(); return; }catch(e){} } clearInterval(iv); res({text: fin.trim(), secs: (Date.now() - t0) / 1000}); };
  r.onerror = e => { if(e.error === "not-allowed" || e.error === "service-not-allowed"){ stopped = true; toast("The microphone isn't allowed."); } };
  r.start();
  const iv = setInterval(() => { const s = (Date.now() - t0) / 1000; if(tick) tick(s); if(s >= max) stop(); }, 250);
  const stop = () => { stopped = true; try{ r.stop(); }catch(e){} };
  return {stop, done};
}
function speechStats(text, secs){
  const w = words(text), fill = (String(text).toLowerCase().match(/\b(um+|uh+|er+|erm+|ah+|you know|i mean)\b/g) || []).length;
  return `${w} words · ${secs > 5 ? Math.round(w / secs * 60) + " words a minute" : ""}${fill ? ` · ${fill} filler${fill > 1 ? "s" : ""} (um, er, you know…)` : ""}`;
}

/* ---------- the player ---------- */
IE.ROUTES.lesson = async ([lid], a) => {
  const found = await data.lesson(lid);
  if(!found) throw new Error("This lesson doesn't exist.");
  const {lesson: L, unit: U} = found;
  const test = L.kind === "test", QS = questions(L), NUM = {}; for(const x of QS) NUM[x.q.id] = x.n;
  const skill = skillOf(L);
  let run = LS.get(RK(lid));
  if(!isObj(run) || run.v !== 1) run = {v: 1, i: 0, ans: {}, checked: {}, heard: {}, self: {}, el: 0, started: !test};
  const save = () => LS.set(RK(lid), run);
  const ans = id => run.ans[id];
  const setAns = (id, v) => { run.ans[id] = v; saveSoon(); };
  let st = 0; const saveSoon = () => { clearTimeout(st); st = setTimeout(save, 400); };
  let timer = 0, alive = true, recCtl = null;
  const back = `#/unit/${U.id}`;
  const top = () => setTop({title: L.title, back, backT: `Unit ${U.n}`,
    right: test && run.started && !run.finished ? `<span class="ie-timer t-num" id="ie-timer" role="timer" aria-label="Time left">${fmtTime(L.timed - run.el / 1000)}</span>` : `<span class="ie-step t-num" id="ie-stepn"></span>`});

  function tickStart(){
    clearInterval(timer);
    if(!test || !run.started || run.finished) return;
    let last = Date.now();
    timer = setInterval(() => {
      if(!alive) return clearInterval(timer);
      const n = Date.now(); if(D.visibilityState === "visible") run.el += n - last; last = n;
      const left = L.timed - run.el / 1000, t = D.getElementById("ie-timer");
      if(t){ t.textContent = fmtTime(left); t.classList.toggle("is-low", left < 300); }
      if(Math.round(run.el / 1000) % 5 === 0) save();
      if(left <= 0){ clearInterval(timer); toast("Time's up."); finish(); }
    }, 1000);
  }

  function intro(){
    top();
    const nq = QS.reduce((s, x) => s + x.m, 0);
    a.innerHTML = `<div class="ie-page ie-narrow"><div class="card ie-card ie-intro">${ico("timer", 40)}
      <h1 class="t-2">${esc(L.title)}</h1>
      <p class="t-sub">${Math.round(L.timed / 60)} minutes${nq ? ` · ${nq} questions` : ""}. Like the real exam: no answers until you finish, and the clock keeps going between parts. It pauses if you leave this page.</p>
      ${skill === "listening" ? `<p class="t-sub">${ico("speaker-high", 18)} Each recording plays once. Read the questions before you press play. Use headphones.</p>` : ""}
      ${skill === "writing" ? `<p class="t-sub">${ico("pencil-simple", 18)} Spend about 20 minutes on Task 1 and 40 on Task 2: Task 2 counts twice as much.</p>` : ""}
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="ie-go">Start</button></div></div>`;
    a.querySelector("#ie-go").onclick = () => { run.started = true; save(); show(); };
  }

  function show(){
    if(!alive) return;
    if(run.finished) return results();
    if(test && !run.started) return intro();
    stopSpeak();
    run.i = Math.max(0, Math.min(run.i, L.items.length - 1)); save();
    const it = L.items[run.i], fb = !test && !!run.checked[it.id];
    top(); tickStart();
    const sn = D.getElementById("ie-stepn"); if(sn) sn.textContent = `${run.i + 1} / ${L.items.length}`;
    a.innerHTML = `<div class="ie-page${it.type === "reading" ? " ie-wide" : " ie-narrow"}">
      <div class="ie-bar" aria-hidden="true"><span style="width:${(run.i + (fb ? 1 : 0)) / L.items.length * 100}%"></span></div>
      <div id="ie-item">${itemHtml(it, fb)}</div>
      <div class="ie-dock" id="ie-dock">${dockHtml(it, fb)}</div></div>`;
    wireItem(it, fb);
    wireDock(it, fb);
    const h = a.querySelector("h1,h2,legend,.ie-qtext"); if(h && run.i > 0){ h.setAttribute("tabindex", "-1"); h.focus({preventScroll: true}); }
    W.scrollTo(0, 0);
  }

  /* what goes in the dock under the item */
  function dockHtml(it, fb){
    const last = run.i === L.items.length - 1;
    const prev = run.i > 0 ? `<button type="button" class="glass-btn glass-btn--icon" id="ie-prev" aria-label="Previous">${ico("caret-left", 22)}</button>` : "";
    if(test) return `${prev}<span class="ie-sp"></span>${last ? `<button type="button" class="glass-btn glass-btn--pri" id="ie-fin">Finish</button>` : `<button type="button" class="glass-btn glass-btn--pri" id="ie-next">Next${ico("caret-right", 20)}</button>`}`;
    const scored = SCORED.has(it.type) || it.sets;
    if(scored && !fb) return `${prev}<span class="ie-sp"></span><button type="button" class="glass-btn glass-btn--pri" id="ie-check">Check</button>`;
    return `${prev}<span class="ie-sp"></span><button type="button" class="glass-btn glass-btn--pri" id="${last ? "ie-fin" : "ie-next"}">${last ? "Finish" : "Continue"}${last ? "" : ico("caret-right", 20)}</button>`;
  }
  function wireDock(it){
    const q = s => a.querySelector(s);
    if(q("#ie-prev")) q("#ie-prev").onclick = () => { run.i--; show(); };
    if(q("#ie-next")) q("#ie-next").onclick = () => { run.i++; show(); };
    if(q("#ie-fin")) q("#ie-fin").onclick = () => {
      if(test){
        const left = QS.filter(x => !answered(x.q, ans(x.q.id))).length;
        if(left && !confirm(`${left} question${left > 1 ? "s are" : " is"} unanswered. Finish anyway?`)) return;
      }
      finish();
    };
    if(q("#ie-check")) q("#ie-check").onclick = () => {
      const qs = it.sets ? it.sets.flatMap(s => s.items) : [it];
      if(qs.every(x => !answered(x, ans(x.id))) && !confirm("You haven't answered yet. Show the answers?")) return;
      run.checked[it.id] = true; save(); stopSpeak(); show();
      const w = a.querySelector(".ie-why.is-miss, .ie-why"); if(w && it.sets) w.scrollIntoView({block: "center", behavior: "smooth"});
    };
  }

  /* ----- items ----- */
  function setHtml(it, fb){
    return it.sets.map(s => `<section class="ie-set"><p class="ie-instr">${md(s.instr)}</p>${s.items.map(q => qHtml(q, ans(q.id), NUM[q.id], fb)).join("")}</section>`).join("")
      + (fb ? `<p class="ie-score t-head">${(() => { const qs = it.sets.flatMap(s => s.items), g = qs.reduce((t, q) => t + mark(q, ans(q.id)), 0), m = qs.reduce((t, q) => t + marks(q), 0); return `${g} of ${m} correct`; })()}</p>` : "");
  }
  function itemHtml(it, fb){
    switch(it.type){
      case "card": return `<article class="card ie-card ie-lcard"><h1 class="t-2">${md(it.title)}</h1>${it.body.map(p => `<p>${md(p)}</p>`).join("")}
        ${it.list ? `<ul class="ie-ul">${it.list.map(x => `<li>${md(x)}</li>`).join("")}</ul>` : ""}
        ${it.examples ? `<div class="ie-exs">${it.examples.map((x, i) => `<div class="ie-ex"><button type="button" class="glass-btn glass-btn--icon" data-ex="${i}" aria-label="Listen">${ico("speaker-high", 20)}</button>
          <p>${md(x.text)}${x.note ? `<small>${md(x.note)}</small>` : ""}</p></div>`).join("")}</div>` : ""}
        ${it.tip ? `<p class="ie-tip">${ico("lightbulb", 18)}<span>${md(it.tip)}</span></p>` : ""}</article>`;
      case "pick": case "multi": case "tfng": case "gap": case "select": case "order":
        return `<div class="card ie-card">${qHtml(it, ans(it.id), null, fb)}</div>`;
      case "reading": return `<div class="ie-read" data-pane="${run.pane || "text"}">
        <div class="ie-seg ie-rtog" role="tablist"><button type="button" role="tab" data-pane="text" aria-selected="${(run.pane || "text") === "text"}">Passage</button><button type="button" role="tab" data-pane="qs" aria-selected="${run.pane === "qs"}">Questions</button></div>
        <article class="card ie-card ie-passage" lang="en-GB"><p class="ie-kicker">${it.minutes ? `About ${it.minutes} minutes` : ""}</p><h1 class="t-2">${md(it.title)}</h1>
          ${it.paragraphs.map(p => `<p>${p.label ? `<b class="ie-plab">${esc(p.label)}</b>` : ""}${md(p.text)}</p>`).join("")}</article>
        <div class="ie-qpane">${setHtml(it, fb)}</div></div>`;
      case "listening": {
        const heard = run.heard[it.id], once = test;
        return `<div class="card ie-card ie-listen"><p class="ie-kicker">${ico("ear", 18)}Part ${it.part}</p><h1 class="t-2">${md(it.title)}</h1><p class="t-sub">${md(it.context)}</p>
          <div class="ie-player"><button type="button" class="glass-btn glass-btn--pri" id="ie-play"${once && heard ? " disabled" : ""}>${ico("play", 20)}${once ? heard ? "Played" : "Play" : heard ? "Play again" : "Play"}</button>
          ${once ? "" : `<button type="button" class="glass-btn glass-btn--icon" id="ie-stop" aria-label="Stop" hidden>${ico(STOP_ICO, 20)}</button>`}
          <span class="ie-prog t-note" id="ie-lprog" aria-live="polite">${canSpeak() ? once ? heard ? "You've heard this recording." : "You'll hear the recording once." : "" : "This browser can't speak: read the transcript instead."}</span></div>
          <div class="ie-lbar" aria-hidden="true"><span id="ie-lbar"></span></div></div>
          ${setHtml(it, fb)}
          ${fb || !canSpeak() ? transcriptHtml(it, fb || !canSpeak()) : ""}`;
      }
      case "writing": return writingHtml(it, false);
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
  function writingHtml(it){
    const v = ans(it.id) || "", done = !test && run.checked[it.id];
    return `<div class="card ie-card ie-wtask"><p class="ie-kicker">${ico("pencil-simple", 18)}Writing Task ${it.task} · about ${it.minutes} minutes · at least ${it.minWords} words</p>
        <p class="ie-prompt">${md(it.prompt)}</p>${it.visual && IE.viz ? `<figure class="ie-viz">${IE.viz.html(it.visual)}</figure>` : ""}
        ${it.plan && !test ? `<details class="ie-plan"><summary class="t-head">${ico("list-checks", 18)}How to plan it</summary><ol>${it.plan.map(p => `<li>${md(p)}</li>`).join("")}</ol></details>` : ""}</div>
      <div class="card ie-card"><textarea class="ie-ta" id="ie-ta" lang="en-GB" spellcheck="false" autocapitalize="sentences" aria-label="Your answer" placeholder="Write your answer here. It's saved as you type."${done ? " readonly" : ""}>${esc(v)}</textarea>
        <p class="ie-wc t-note"><span id="ie-wc" class="t-num">${words(v)} words</span>${test ? "" : `<span id="ie-wclock" class="t-num"></span>`}</p>
        ${!test && !done ? `<button type="button" class="glass-btn glass-btn--pri glass-btn--block" id="ie-wdone">I've finished: compare</button>` : ""}</div>
      ${done ? writingFeedback(it) : ""}`;
  }
  const writingFeedback = it => `<div class="card ie-card"><h2 class="t-3">Checks</h2><ul class="ie-checks">${writingChecks(ans(it.id), it).map(c => `<li class="${c.ok ? "is-ok" : "is-miss"}">${ico(c.ok ? "check-circle" : "warning-circle", 18)}<span>${esc(c.t)}</span></li>`).join("")}</ul>
      <p class="t-min">Automatic checks only catch the surface. The criteria below are what examiners mark.</p></div>
    <div class="card ie-card">${modelHtml(it.model)}</div><div class="card ie-card">${selfHtml(it.task === 1 ? "w1" : "w2", run.self[it.id])}</div>`;
  function speakingHtml(it){
    const done = run.checked[it.id];
    const qs = it.part === 2 ? [] : it.questions;
    const sr = !!SR, mode = run.smode || (canRec() ? "rec" : sr ? "tr" : "none");
    return `<div class="card ie-card ie-speak"><p class="ie-kicker">${ico("chats-circle", 18)}Speaking Part ${it.part} · ${esc(it.topic)}</p>
      ${it.part === 2 ? `<div class="ie-cue"><p class="t-head">${md(it.cue.task)}</p><p class="t-note">You should say:</p><ul>${it.cue.bullets.map(b => `<li>${md(b)}</li>`).join("")}</ul><p>${md(it.cue.close)}</p></div>
        <textarea class="ie-ta ie-notes-ta" id="ie-notes" placeholder="Your notes (1 minute)" aria-label="Notes">${esc(run.ans[it.id + ":notes"] || "")}</textarea>` : ""}
      ${sr && canRec() ? `<div class="ie-seg ie-smode" role="radiogroup" aria-label="Mode"><button type="button" role="radio" data-mode="rec" aria-checked="${mode === "rec"}">Record and listen back</button><button type="button" role="radio" data-mode="tr" aria-checked="${mode === "tr"}">Live transcript</button></div>` : ""}
      ${mode === "none" ? `<p class="t-sub">This browser can't use the microphone: answer aloud, then compare with the model.</p>` : ""}
      ${it.part === 2 ? `<div class="ie-sq" data-k="cue"><div class="ie-row-b"><button type="button" class="glass-btn glass-btn--pri" id="ie-prep">${ico("timer", 18)}Start: 1 minute to prepare</button>
          <span class="ie-clock t-num t-head" id="ie-clock-cue"></span></div><div class="ie-out" id="ie-out-cue"></div></div>`
        : qs.map((q, i) => `<div class="ie-sq" data-k="${i}"><p class="t-head"><span class="ie-qn t-num">${i + 1}</span>${md(q)}</p>
          <div class="ie-row-b"><button type="button" class="glass-btn glass-btn--sm" data-ask="${i}">${ico("speaker-high", 18)}Ask me</button>
          ${mode !== "none" ? `<button type="button" class="glass-btn glass-btn--sm" data-rec="${i}">${ico("microphone", 18)}Answer</button>` : ""}<span class="ie-clock t-num" id="ie-clock-${i}"></span></div>
          <div class="ie-out" id="ie-out-${i}"></div></div>`).join("")}
      <p class="t-min">${mode === "rec" ? "Recordings stay in this page only and disappear when you leave." : mode === "tr" ? "The transcript is made by your browser and may miss words." : ""} Aim for ${it.part === 1 ? "two to four sentences per answer" : it.part === 2 ? "the full two minutes" : "a developed answer of about a minute, with reasons and examples"}.</p>
      ${it.phrases ? `<details class="ie-plan"><summary class="t-head">${ico("lightbulb", 18)}Useful language</summary><ul>${it.phrases.map(p => `<li>${md(p)}</li>`).join("")}</ul></details>` : ""}
      ${done ? "" : `<button type="button" class="glass-btn glass-btn--block" id="ie-sdone">${ico("seal-check", 18)}Show the model answer</button>`}</div>
      ${done ? `<div class="card ie-card">${modelHtml(it.model, "Model answer")}</div><div class="card ie-card">${selfHtml("s", run.self[it.id])}</div>` : ""}`;
  }

  function wireItem(it, fb){
    const el = a.querySelector("#ie-item");
    const qs = it.sets ? it.sets.flatMap(s => s.items) : SCORED.has(it.type) ? [it] : [];
    if(!fb) for(const q of qs) wireQ(el, q, () => ans(q.id), setAns);
    el.querySelectorAll("[data-say-model]").forEach(b => b.onclick = () => { const m = it.model; speak(m.text.join(" "), {voice: "f"}); });
    if(it.type === "card") el.querySelectorAll("[data-ex]").forEach(b => b.onclick = () => speak(String(it.examples[+b.dataset.ex].text).replace(/\*/g, ""), {voice: "f"}));
    if(it.type === "reading") el.querySelectorAll(".ie-rtog [data-pane]").forEach(b => b.onclick = () => {
      run.pane = b.dataset.pane; save(); el.querySelector(".ie-read").dataset.pane = run.pane;
      el.querySelectorAll(".ie-rtog [data-pane]").forEach(x => x.setAttribute("aria-selected", x === b)); W.scrollTo(0, 0);
    });
    if(it.type === "listening") wireListen(it, el);
    if(it.type === "writing") wireWriting(it, el);
    if(it.type === "speaking") wireSpeaking(it, el);
    if(it.type === "say"){
      el.querySelectorAll("[data-say]").forEach(b => b.onclick = () => speak(it.text.replace(/\*/g, ""), {voice: "f", slow: b.dataset.say === "slow"}));
      const r = el.querySelector("#ie-rec1"), au = el.querySelector("#ie-aud");
      if(r) r.onclick = async () => {
        if(recCtl){ recCtl.stop(); return; }
        try{ recCtl = await record(15); }catch(e){ toast("The microphone isn't available."); return; }
        r.innerHTML = `${ico(STOP_ICO, 18)}Stop`;
        const res = await recCtl.done; recCtl = null; r.innerHTML = `${ico("microphone", 18)}Record again`;
        if(res.url){ au.src = res.url; au.hidden = false; try{ await au.play(); }catch(e){} }
      };
    }
  }
  function wireListen(it, el){
    const play = el.querySelector("#ie-play"), stop = el.querySelector("#ie-stop"), pr = el.querySelector("#ie-lprog"), bar = el.querySelector("#ie-lbar");
    if(!play || !canSpeak()) { if(play) play.disabled = true; return; }
    const vo = id => (it.speakers.find(s => s.id === id) || {}).voice || "f";
    let gen = 0;
    play.onclick = async () => {
      if(test){ run.heard[it.id] = true; save(); play.disabled = true; play.innerHTML = `${ico("play", 20)}Playing`; }
      const my = ++gen; if(stop) stop.hidden = false;
      const lines = [{s: null, t: it.context}].concat(it.script);
      for(let i = 0; i < lines.length; i++){
        if(my !== gen || !alive) return;
        pr.textContent = i === 0 ? "Introduction" : `${(it.speakers.find(s => s.id === lines[i].s) || {}).name || ""}`;
        bar.style.width = `${i / lines.length * 100}%`;
        const ok = await speak(lines[i].t.replace(/\*/g, ""), {voice: lines[i].s ? vo(lines[i].s) : (vo(it.script[0].s) === "f" ? "m" : "f"), gap: 60});
        if(!ok && my !== gen) return;
        await new Promise(r => setTimeout(r, i === 0 ? 900 : 280));
      }
      if(my !== gen) return;
      bar.style.width = "100%"; pr.textContent = "That is the end of the recording.";
      if(stop) stop.hidden = true;
      if(!test){ run.heard[it.id] = true; save(); play.innerHTML = `${ico("play", 20)}Play again`; }
      else play.innerHTML = `${ico("play", 20)}Played`;
    };
    if(stop) stop.onclick = () => { gen++; stopSpeak(); stop.hidden = true; pr.textContent = "Stopped."; };
    cleanups.push(() => { gen++; });
  }
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
      cleanups.push(() => clearInterval(iv));
    }
    const d = el.querySelector("#ie-wdone");
    if(d) d.onclick = () => {
      const t = ans(it.id) || ""; if(words(t) < 30 && !confirm("That's very short. Compare anyway?")) return;
      run.checked[it.id] = true; save(); saveEssay(it); show();
    };
    wireSelf(el, it.task === 1 ? "w1" : "w2", () => run.self[it.id], (c, b) => { run.self[it.id] = c; save(); saveEssay(it, b); });
  }
  function saveEssay(it, b){
    const t = ans(it.id) || ""; if(!t.trim()) return;
    if(!run.eid) run.eid = {}; if(!run.eid[it.id]) { run.eid[it.id] = `${it.id}-${Date.now().toString(36)}`; save(); }
    prog.addEssay({id: run.eid[it.id], iid: it.id, task: it.task, prompt: it.prompt, text: t, words: words(t), self: run.self[it.id] || null, band: b != null ? b : selfBand(run.self[it.id] || {}, it.task === 1 ? "w1" : "w2")});
  }
  function wireSpeaking(it, el){
    el.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { run.smode = b.dataset.mode; save(); show(); });
    const mode = run.smode || (canRec() ? "rec" : SR ? "tr" : "none");
    const notes = el.querySelector("#ie-notes"); if(notes) notes.oninput = () => setAns(it.id + ":notes", notes.value);
    el.querySelectorAll("[data-ask]").forEach(b => b.onclick = () => speak(it.questions[+b.dataset.ask].replace(/\*/g, ""), {voice: "m"}));
    const answer = async (k, max, btn) => {
      const clock = el.querySelector(`#ie-clock-${k}`), out = el.querySelector(`#ie-out-${k}`);
      if(recCtl){ recCtl.stop(); return; }
      stopSpeak();
      const tick = s => { clock.textContent = `${fmtTime(s)} / ${fmtTime(max)}`; };
      try{
        recCtl = mode === "tr" ? transcribe(max, tick, txt => { out.innerHTML = `<p class="ie-live">${esc(txt)}</p>`; }) : await record(max, tick);
      }catch(e){ toast("The microphone isn't available."); recCtl = null; return; }
      const label = btn ? btn.innerHTML : ""; if(btn){ btn.innerHTML = `${ico(STOP_ICO, 18)}Stop`; btn.classList.add("glass-btn--pri"); }
      const res = await recCtl.done; recCtl = null;
      if(btn){ btn.innerHTML = label.includes("Answer") ? `${ico("microphone", 18)}Answer again` : label; btn.classList.remove("glass-btn--pri"); }
      if(!alive) return;
      if(mode === "tr") out.innerHTML = res.text ? `<p class="ie-live">${esc(res.text)}</p><p class="t-note">${esc(speechStats(res.text, res.secs))}</p>` : `<p class="t-note">Nothing was heard.</p>`;
      else out.innerHTML = res.url ? `<audio controls src="${res.url}"></audio><p class="t-note">${fmtTime(res.secs)}${it.part === 2 && res.secs < 90 ? " · In Part 2, keep going until the examiner stops you at two minutes." : ""}</p>` : `<p class="t-note">Nothing was recorded.</p>`;
    };
    el.querySelectorAll("[data-rec]").forEach(b => b.onclick = () => answer(b.dataset.rec, it.talk || 45, b));
    const prep = el.querySelector("#ie-prep");
    if(prep) prep.onclick = async () => {
      if(prep.dataset.phase === "talk"){ if(recCtl) recCtl.stop(); return; }
      if(prep.dataset.phase === "prep"){ prep.dataset.skip = "1"; return; }
      prep.dataset.phase = "prep"; prep.innerHTML = `${ico("caret-right", 18)}I'm ready: speak now`;
      speak(`${it.cue.task.replace(/\*/g, "")}. You have one minute to prepare.`, {voice: "m"});
      const clock = el.querySelector("#ie-clock-cue"), t0 = Date.now(), P = it.prep || 60;
      await new Promise(r => { const iv = setInterval(() => { const s = (Date.now() - t0) / 1000; clock.textContent = `Preparing ${fmtTime(P - s)}`;
        if(s >= P || prep.dataset.skip || !alive){ clearInterval(iv); r(); } }, 250); cleanups.push(() => clearInterval(iv)); });
      if(!alive) return;
      if(mode === "none"){ clock.textContent = "Now speak for two minutes."; prep.disabled = true; return; }
      prep.dataset.phase = "talk"; prep.innerHTML = `${ico(STOP_ICO, 18)}Stop`;
      await speak("All right. Remember you have one to two minutes for this. Please start speaking now.", {voice: "m"});
      if(!alive) return;
      await answer("cue", it.talk || 120, null);
      prep.dataset.phase = ""; delete prep.dataset.skip; prep.innerHTML = `${ico("arrow-counter-clockwise", 18)}Try again`;
    };
    const sd = el.querySelector("#ie-sdone");
    if(sd) sd.onclick = () => { if(recCtl) recCtl.stop(); run.checked[it.id] = true; save(); show(); };
    wireSelf(el, "s", () => run.self[it.id], (c, b) => { run.self[it.id] = c; save(); if(b != null){ run.sband = run.sband || {}; run.sband[it.id] = b; save(); } });
  }

  /* ----- finishing ----- */
  function finish(){
    clearInterval(timer); stopSpeak(); if(recCtl) try{ recCtl.stop(); }catch(e){}
    const got = QS.reduce((s, x) => s + mark(x.q, ans(x.q.id)), 0), total = QS.reduce((s, x) => s + x.m, 0);
    const b = (skill === "listening" || skill === "reading") && total ? band(skill, got, total) : null;
    run.finished = true; run.got = got; run.total = total; run.band = b; save();
    for(const it of L.items) if(it.type === "writing" && (ans(it.id) || "").trim()) saveEssay(it);
    prog.done(lid, total ? {got, total, band: test ? b : null} : {});
    if(test && b != null) prog.addTest({lid, title: `${L.title} · Unit ${U.n}`, skill, got, total, band: b});
    results();
  }
  async function results(){
    top();
    const sn = D.getElementById("ie-stepn"); if(sn) sn.textContent = "";
    const nx = await nextOf();
    const scoreLine = run.total ? `${run.got} of ${run.total} correct` : "";
    const writes = L.items.filter(i => i.type === "writing"), speaks = L.items.filter(i => i.type === "speaking");
    a.innerHTML = `<div class="ie-page ie-narrow">
      <div class="card ie-card ie-result">${run.band != null ? `<p class="ie-kicker">${esc(skill[0].toUpperCase() + skill.slice(1))}</p><p class="ie-bigband t-num">${fmtBand(run.band)}</p><p class="t-head">${scoreLine}</p>
        <p class="t-note">${run.total < 40 ? "Scaled to a 40-question paper, so treat it as a guide. " : ""}${run.band >= 8.5 ? "C2 level. Now make it consistent." : run.band >= 7 ? "Close: look at every miss below and why it was wrong." : "Review the misses, then repeat the unit's practice."}</p>`
        : `${ico("seal-check", 44)}<h1 class="t-2">Lesson complete</h1>${scoreLine ? `<p class="t-head">${scoreLine}</p>` : ""}`}
        <div class="ie-row-b">${nx ? `<a class="glass-btn glass-btn--pri" href="#/lesson/${nx.id}">Next lesson${ico("caret-right", 20)}</a>` : ""}<a class="glass-btn" href="#/unit/${U.id}">Back to the unit</a>
        <button type="button" class="glass-btn" id="ie-redo">${ico("arrow-counter-clockwise", 18)}Do it again</button></div></div>
      ${test && QS.length ? `<h2 class="ie-bh">${ico("list-checks", 20)}Review</h2>${L.items.filter(i => i.sets || SCORED.has(i.type)).map(it => `<div class="card ie-card">
          ${it.title ? `<h3 class="t-head">${md(it.title)}</h3>` : ""}${it.sets ? it.sets.map(s => `<section class="ie-set"><p class="ie-instr">${md(s.instr)}</p>${s.items.map(q => qHtml(q, ans(q.id), NUM[q.id], true)).join("")}</section>`).join("") : qHtml(it, ans(it.id), NUM[it.id], true)}
          ${it.type === "listening" ? transcriptHtml(it, false) : ""}</div>`).join("")}` : ""}
      ${writes.map(it => `<h2 class="ie-bh">${ico("pencil-simple", 20)}Task ${it.task}</h2><div class="card ie-card"><p class="ie-prompt">${md(it.prompt)}</p>
        <div class="ie-essay">${String(ans(it.id) || "").split(/\n+/).filter(s => s.trim()).map(p => `<p>${esc(p)}</p>`).join("") || `<p class="t-sub">You didn't write anything.</p>`}</div></div>
        ${test ? writingFeedback(it) : ""}`).join("")}
      ${test ? speaks.map(it => `<div class="card ie-card">${modelHtml(it.model, `Speaking Part ${it.part}: model answer`)}</div>`).join("") : ""}
    </div>`;
    a.querySelector("#ie-redo").onclick = () => { if(!confirm("Start this lesson again? Your answers here will be cleared.")) return; LS.del(RK(lid)); run = {v: 1, i: 0, ans: {}, checked: {}, heard: {}, self: {}, el: 0, started: !test}; show(); };
    a.querySelectorAll("[data-say-model]").forEach((b, i) => { const ms = [...writes, ...speaks].map(x => x.model); b.onclick = () => speak(ms[i].text.join(" "), {voice: "f"}); });
    for(const it of writes) wireSelf(a, it.task === 1 ? "w1" : "w2", () => run.self[it.id], (c, b) => { run.self[it.id] = c; save(); saveEssay(it, b); });
    if(skill === "speaking" || speaks.length){
      const bs = Object.values(run.sband || {}); if(bs.length && !run.sSaved){ run.sSaved = true; save(); prog.addSpeaking({title: `${L.title} · Unit ${U.n}`, band: roundBand(bs.reduce((x, y) => x + y, 0) / bs.length)}); }
    }
    W.scrollTo(0, 0);
  }
  async function nextOf(){
    const i = U.lessons.indexOf(L);
    if(i < U.lessons.length - 1) return U.lessons[i + 1];
    const av = data.avail(), j = av.findIndex(r => r.id === U.id);
    if(j >= 0 && j < av.length - 1){ try{ const u2 = await data.unit(av[j + 1].id); return u2.lessons[0]; }catch(e){} }
    return null;
  }

  const cleanups = [];
  show();
  /* leaving the page: save, stop the clock, the voice and the microphone */
  return () => { alive = false; clearInterval(timer); clearTimeout(st); save(); stopSpeak(); if(recCtl) try{ recCtl.stop(); }catch(e){} cleanups.forEach(f => { try{ f(); }catch(e){} }); };
};
/* speaking lessons finished without a test still record the estimate when you mark yourself (see results) */
IE.player = {questions, mark, marks, writingChecks, selfBand, norm};
})();
