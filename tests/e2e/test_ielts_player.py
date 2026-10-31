"""IELTS Prep, the lesson player (js/ielts-player.js): test integrity, exam-style Listening, Speaking and Writing fixes.

Every high bug has a regression test that failed before the fix (the old player is in git: 72ee060):
- the test clock: a frozen or sleeping page (page.clock.fast_forward) and a hidden page don't take time off the clock,
  they add to run.away; a test then finishes as "paused" (prog.addTest paused), and a double click on Finish stores one
  test; the time already up on coming back shows «Time is up» (Finish or Review) instead of finishing silently;
- a Part 2 preparation left with Continue never speaks or records on the next screen (61 s later), and Continue while
  answering in Part 1 stops the microphone track;
- writing practice can't be passed without «I've finished: compare»; the results show the checks, the model, the
  self-marking and «Revise it later in My writing»;
- no English voice (IE.ensureVoices() = 0): the transcript, run.heard not set, noaudio reaches prog.addTest.
Then: exam:true Listening (previews, pause lines, check time, two minutes to check and the automatic finish, in order;
moving between items doesn't stop the audio; a reload resumes from the saved line, or from the next step the data still
has; time on screen with the recording stopped is a pause, and the two minutes to check go on by themselves after a
reload; one test stored; test_ielts.py's walker still finishes u23-l1 and u24-l1 with exam:true), resuming a test recording after Next/Previous, the voice
options of each speaker (accent, alt, pitch) and rate 1 in tests, writingChecks on the band 9 models and its rules, set
visuals and visual2, Part 2 follow-ups, no microphone, IE.assess delegation, results labels (addTest's counted, part
tests, unit.back/backT), the live region, reading panes and scroll (Check shows the first reason), storage full, and screenshots at 360, 390 and
1280 px, light and dark, with reduced motion (no horizontal scroll, 44 px targets, palette and contrast).
New data fields are served with page.route (the data in this branch doesn't have them yet).
"""
from __future__ import annotations

import copy
import json
import re

import common as C
import ielts_validate as V
import tech_common as TC
import test_ielts as T

_IN = T._IN
A11Y = (C.HERE / "a11y.js").read_text(encoding="utf-8")
AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
SHOTS = C.CAPTURAS / "ielts-player"

# IE.speak spied at call time: window.__said = [{t, o, at}] (survives Object.assign of js/ielts.js through a setter)
SPY = r"""
(() => {
  const IE = window.IE = window.IE || {};
  if (Object.getOwnPropertyDescriptor(IE, 'speak')) return;
  window.__said = [];
  let real = null;
  Object.defineProperty(IE, 'speak', {configurable: true, enumerable: true,
    get() { return real && ((t, o) => { window.__said.push({t: String(t), o: o ? JSON.parse(JSON.stringify(o)) : {}, at: Date.now()}); return real(t, o); }); },
    set(v) { real = v; }});
})();
"""
# a speechSynthesis with no voice at all, and core's ensureVoices() answering 0 (core's real one overwrites the stub)
NOVOICE = TC.SPEECH + r"""
(() => { const ss = window.speechSynthesis; if (ss) Object.defineProperty(ss, 'getVoices', {configurable: true, writable: true, value: () => []}); })();
(() => { const IE = window.IE = window.IE || {}; IE.ensureVoices = () => Promise.resolve(0); })();
"""
# getUserMedia and MediaRecorder of mentira: window.__rec = {starts, stops, tracks (stopped), revoked}
MIC = r"""
(() => {
  window.__rec = {starts: 0, stops: 0, tracks: 0, revoked: 0};
  let md = navigator.mediaDevices;
  if (!md) { md = {}; Object.defineProperty(navigator, 'mediaDevices', {configurable: true, value: md}); }
  md.getUserMedia = async () => { const t = {kind: 'audio', readyState: 'live', stop() { if (this.readyState !== 'ended') { this.readyState = 'ended'; window.__rec.tracks++; } }};
    return {getTracks: () => [t], getAudioTracks: () => [t]}; };
  window.MediaRecorder = class { constructor(s) { this.stream = s; this.state = 'inactive'; this.mimeType = 'audio/webm'; }
    start() { this.state = 'recording'; window.__rec.starts++; }
    stop() { if (this.state === 'inactive') return; this.state = 'inactive'; window.__rec.stops++;
      setTimeout(() => { try { if (this.ondataavailable) this.ondataavailable({data: new Blob(['x'], {type: 'audio/webm'})}); } catch (e) {} if (this.onstop) this.onstop(); }, 20); }
    static isTypeSupported(t) { return /webm/.test(t); } };
  const rv = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = u => { window.__rec.revoked++; return rv(u); };
})();
"""
NOMIC = r"""
(() => { for (const k of ['MediaRecorder', 'SpeechRecognition', 'webkitSpeechRecognition'])
  Object.defineProperty(window, k, {configurable: true, writable: true, value: undefined}); })();
"""
# a SpeechRecognition that hears one sentence with fillers
FAKE_SR = r"""
(() => {
  class FakeSR { start() { setTimeout(() => { const r = [{transcript: 'Um, I think, er, it is mostly the weather, you know.'}]; r.isFinal = true;
      if (this.onresult) this.onresult({resultIndex: 0, results: [r]}); }, 50); }
    stop() { setTimeout(() => { if (this.onend) this.onend(); }, 10); } }
  for (const k of ['SpeechRecognition', 'webkitSpeechRecognition']) Object.defineProperty(window, k, {configurable: true, writable: true, value: FakeSR});
})();
"""
# every exam position written to ielts:run:u23-l1, kept in sessionStorage (it survives a reload)
PHASES = r"""
(() => {
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    set.call(this, k, v);
    if (k !== 'ielts:run:u23-l1') return;
    try { const x = JSON.parse(v).x; if (!x) return; const log = JSON.parse(sessionStorage.getItem('__ph') || '[]'), e = x.k + ':' + x.phase + ':' + x.line;
      if (log[log.length - 1] !== e) { log.push(e); set.call(sessionStorage, '__ph', JSON.stringify(log)); } } catch (e) {}
  };
})();
"""
# package study's shared self-marking, stubbed: it records what it was given (js/ielts-study.js sets the real one when it
# loads; the stub stays, so that this test sees exactly what the player passes)
ASSESS = r"""
(() => {
  const IE = window.IE = window.IE || {};
  window.__assess = [];
  let stub = null;
  Object.defineProperty(IE, 'assess', {configurable: true, enumerable: true, get() { return stub; }, set(v) { if (!stub) stub = v; else window.__realAssess = v; }});
  IE.assess = {
    selfHtml: (kind, cur, it) => `<div class="stub-self" data-kind="${kind}" data-item="${it && it.id}"><button type="button" class="glass-btn" data-stub>Band 7</button></div>`,
    wireSelf: (el, kind, get, set, it) => { window.__assess.push(['wire', kind, it && it.id]);
      const b = el.querySelector('[data-stub]'); if (b) b.onclick = () => set({0: 7, 1: 7, 2: 7, 3: 7}, 7); },
    selfBand: (c, kind) => { window.__assess.push(['band', kind]); return 7; },
  };
})();
"""


def _unit(uid):
    return json.loads((V.DATA / f"{uid}.json").read_text(encoding="utf-8"))


def _serve(page, uid, fn):
    """Serves data/ielts/<uid>.json changed by fn(unit) (fn changes it in place)."""
    u = _unit(uid)
    fn(u)
    body = json.dumps(u)
    page.route(f"**/data/ielts/{uid}.json*", lambda r: r.fulfill(status=200, content_type="application/json", body=body))
    return u


def _page(kind="phone", init=(), **kw):
    page = C.new_page(kind, **kw)
    page.on("dialog", lambda d: d.accept())
    page.add_init_script(_IN)
    for s in init:
        page.add_init_script(s)
    return page


def _lesson(u, lid):
    return next(l for l in u["lessons"] if l["id"] == lid)


def _item(u, iid):
    return next(it for l in u["lessons"] for it in l["items"] if it["id"] == iid)


def _run(page, lid):
    return page.evaluate("lid => JSON.parse(localStorage.getItem('ielts:run:' + lid))", lid)


def _tests(page):
    return page.evaluate("() => IE.prog.get().tests")


def _said(page):
    return page.evaluate("() => (window.__said || []).map(x => x.t)")


def _text(page, sel):
    return page.evaluate("s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; }", sel)


def _seed_run(page, lid, run):
    T._open(page, "#/")
    page.evaluate("([lid, r]) => localStorage.setItem('ielts:run:' + lid, JSON.stringify(r))", [lid, run])


def _hidden(page, on):
    page.evaluate("""on => {
      Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => on ? 'hidden' : 'visible'});
      Object.defineProperty(document, 'hidden', {configurable: true, get: () => on});
      document.dispatchEvent(new Event('visibilitychange')); }""", on)


# ---------------------------------------------------------------- contracts and writingChecks
def test_player_exports_and_writing_checks():
    page = _page("desk")
    try:
        T._open(page)
        keys = page.evaluate("() => Object.keys(IE.player).sort()")
        assert keys == sorted(["questions", "mark", "marks", "writingChecks", "selfBand", "norm", "EXAM"]), keys
        assert page.evaluate("() => IE.player.EXAM") == {"preview": 30, "check": 30, "review": 120}
        # every band 9 model passes every check
        models = []
        for row in T._index()["units"]:
            for l in _unit(row["id"])["lessons"]:
                models += [it for it in l["items"] if it["type"] == "writing"]
        assert len(models) >= 14, len(models)
        bad = page.evaluate("""ms => ms.map(it => [it.id, IE.player.writingChecks(it.model.text.join('\\n\\n'), it).filter(c => !c.ok).map(c => c.t)])
          .filter(x => x[1].length)""", models)
        assert not bad, bad
        r = page.evaluate(r"""() => {
          const W = IE.player.writingChecks, rep = (w, n) => Array(n).fill(w).join(' ');
          const filler = n => Array.from({length: n}, (_, i) => 'word' + String.fromCharCode(97 + i % 26) + String.fromCharCode(97 + Math.floor(i / 26) % 26)).join(' ');
          const t2 = {task: 2, minWords: 250, prompt: 'Some people think that universities should teach only practical skills. To what extent do you agree or disagree?'};
          const t1 = {task: 1, minWords: 150, prompt: 'The chart shows passenger journeys.', visual: {kind: 'line', title: 'Journeys', x: ['2010', '2020'], series: [{name: 'Rail', values: [1, 2]}]},
                      visual2: {kind: 'table', title: 'Fares', head: ['', 'Bus'], rows: [['Ferries', '3']]}};
          const bad = (out, re) => out.filter(c => !c.ok && re.test(c.t)).length;
          const sent = n => 'This sentence ' + filler(n - 3) + ' ends.';
          return {
            short2: W('Too short.', t2).find(c => /words/.test(c.t)).t,
            short1: W('Too short.', t1).find(c => /words/.test(c.t)).t,
            /* the prompt's words and the visual's labels (and their family) may repeat */
            promptRep: bad(W(rep('universities', 9) + ' ' + filler(300), t2), /Repeated/),
            labelRep: bad(W(rep('rail', 9) + ' ' + rep('ferries', 8) + ' ' + rep('journey', 7) + ' ' + filler(200), t1), /Repeated/),
            otherRep: bad(W(rep('gadget', 8) + ' ' + filler(250), t2), /Repeated/),
            /* the limit grows with length: max(6, ceil(words / 40)) */
            limitShort: bad(W(rep('gadget', 6) + ' ' + filler(200), t2), /Repeated/),
            limitLong: bad(W(rep('gadget', 10) + ' ' + filler(400), t2), /Repeated/),
            limitLong11: bad(W(rep('gadget', 11) + ' ' + filler(400), t2), /Repeated/),
            /* only sentences over 50 words */
            s45: bad(W([sent(45), sent(20), sent(20), sent(20)].join(' '), t2), /over 50 words/),
            s55: bad(W([sent(55), sent(20), sent(20), sent(20)].join(' '), t2), /over 50 words/),
            pos: ['On balance, the benefits outweigh the costs.', 'I would regard this as a mistake.', 'I consider it wise.', 'I view it as fair.',
                  'In my judgement, it fails.', 'This essay argues that it works.', 'This essay will argue that it works.']
                  .map(s => bad(W(s, t2), /position explicit/)),
            nopos: bad(W('Universities teach many subjects.', t2), /position explicit/),
            /* copied rubric: runs of 5+ words of the question are not counted */
            copyShort: W('Some people think that universities should teach only practical skills. ' + filler(240), t2).filter(c => /copied|words/.test(c.t)).map(c => [c.ok, c.t]),
            copyLong: W('Some people think that universities should teach only practical skills. ' + filler(260), t2).filter(c => /copied|words/.test(c.t)).map(c => [c.ok, c.t]),
            copyFour: W('Some people think that ' + filler(260), t2).filter(c => /copied/.test(c.t)).length,
          }; }""")
        assert "Task Response" in r["short2"] and "Task Achievement" in r["short1"], r
        assert r["promptRep"] == 0 and r["labelRep"] == 0, r
        assert r["otherRep"] == 1, r
        assert r["limitShort"] == 1 and r["limitLong"] == 0 and r["limitLong11"] == 1, r
        assert r["s45"] == 0 and r["s55"] == 1, r
        assert r["pos"] == [0] * 7 and r["nopos"] == 1, r
        cs, cl = r["copyShort"], r["copyLong"]
        assert cs[0] == [False, "240 words of your own: under 250 loses marks for Task Response."], cs
        assert cs[1] == [False, "10 words copied from the question are not counted."], cs
        assert cl[0][0] is True and cl[1] == [True, "10 words copied from the question are not counted."], cl
        assert r["copyFour"] == 0, r
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- the test clock and Finish
def test_clock_ignores_freeze_sleep_and_hidden_time_and_finish_counts_once():
    page = _page("phone")
    try:
        T._open(page, "#/lesson/u07-l3")
        intro = page.inner_text("#app")
        page.click("#ie-go")
        page.wait_for_selector("#ie-timer")
        page.wait_for_timeout(1300)
        el0 = _run(page, "u07-l3")["el"]
        # a frozen page: 8 s without a tick
        page.clock.fast_forward(8000)
        page.wait_for_timeout(1300)
        page.evaluate("() => { document.dispatchEvent(new Event('freeze')); document.dispatchEvent(new Event('resume')); }")
        el1 = _run(page, "u07-l3")["el"]
        assert el1 - el0 < 3500, (el0, el1)
        # a laptop asleep for 25 minutes (the page stays "visible"): no automatic finish, no band 0
        page.clock.fast_forward("25:00")
        page.wait_for_timeout(1300)
        r = _run(page, "u07-l3")
        assert not r.get("finished") and not _tests(page), r
        assert r["el"] < 8000 and r["away"] >= 25 * 60 * 1000, r
        assert page.locator("#ie-fin").count() == 1 and page.locator(".ie-timeup").count() == 0
        # a hidden page adds to run.away too, and the clock waits
        _hidden(page, True)
        page.clock.fast_forward("03:00")
        page.wait_for_timeout(300)
        _hidden(page, False)
        page.wait_for_timeout(300)
        r = _run(page, "u07-l3")
        assert r["away"] >= 28 * 60 * 1000 and r["el"] < 9000, r
        # prog.done sees the finished run already saved
        page.evaluate("""() => { const o = IE.prog.done; window.__doneRun = null;
          IE.prog.done = (lid, rec) => { window.__doneRun = JSON.parse(localStorage.getItem('ielts:run:' + lid)); return o.call(IE.prog, lid, rec); }; }""")
        page.dblclick("#ie-fin")
        page.wait_for_selector(".ie-result")
        page.wait_for_timeout(600)
        tests = _tests(page)
        assert len(tests) == 1, tests
        assert tests[0]["paused"] is True and tests[0]["skill"] == "reading", tests
        d = page.evaluate("() => window.__doneRun")
        assert d and d["finished"] is True and d["total"] > 0 and "got" in d and "band" in d, d
        r = _run(page, "u07-l3")
        for k in ("v", "i", "ans", "checked", "heard", "self", "el", "started", "finished", "got", "total", "band", "at"):
            assert k in r, (k, r)
        assert r["v"] == 1 and abs(r["at"] - page.evaluate("Date.now()")) < 60000, r
        t = page.inner_text(".ie-result")
        assert "Paused for more than two minutes: not under exam conditions." in t, t
        assert "Part test:" in t, t
        page.wait_for_function("() => document.querySelector('.ie-result a[href^=\"#/lesson/\"]')", timeout=5000)
        assert "Band" in page.evaluate("() => document.getElementById('ie-live').textContent")
        assert "The clock stops only while this test isn't on screen, and a pause of more than two minutes isn't counted as exam conditions." in intro, intro
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_time_up_on_coming_back_asks_first():
    page = _page("phone")
    try:
        _seed_run(page, "u07-l3", {"v": 1, "i": 0, "ans": {}, "checked": {}, "heard": {}, "self": {}, "el": 1205000, "started": True})
        T._open(page, "#/lesson/u07-l3")
        page.wait_for_selector(".ie-timeup")
        assert "Time is up" in page.inner_text(".ie-timeup")
        page.wait_for_timeout(1500)
        assert not _tests(page) and not _run(page, "u07-l3").get("finished")
        assert page.locator("#ie-fin").is_visible() and page.locator("#ie-review").is_visible()
        page.click("#ie-review")
        page.wait_for_selector(".ie-read")
        # Review looks through the answers: nothing can be changed once the time is up
        assert "you can look through your answers but not change them" in page.inner_text(".ie-locked")
        lk = page.evaluate("""() => ({ins: [...document.querySelectorAll('.ie-qpane input.ie-in')].map(i => i.readOnly),
          opts: [...document.querySelectorAll('.ie-qpane .ie-opt')].map(b => b.disabled)})""")
        assert lk["ins"] and all(lk["ins"]) and lk["opts"] and all(lk["opts"]), lk
        page.evaluate("""() => { document.querySelector('.ie-qpane .ie-opt').click(); const i = document.querySelector('.ie-qpane input.ie-in');
          i.value = 'late'; i.dispatchEvent(new Event('input')); }""")
        page.wait_for_timeout(2500)
        assert _run(page, "u07-l3")["ans"] == {}, _run(page, "u07-l3")["ans"]
        assert _text(page, "#ie-timer") == "0:00"
        assert not _tests(page), "Review finished the test by itself"
        page.click(".ie-rtog [data-pane='qs']")
        assert page.locator(".ie-qpane .ie-in >> nth=0").is_visible()
        page.click("#ie-fin")
        page.wait_for_selector(".ie-result")
        assert len(_tests(page)) == 1
        # the time running out in front of the learner finishes the test, as in the exam
        _seed_run(page, "u08-l3", {"v": 1, "i": 0, "ans": {}, "checked": {}, "heard": {}, "self": {}, "el": 1199000, "started": True})
        T._open(page, "#/lesson/u08-l3")
        page.wait_for_selector("#ie-timer")
        page.wait_for_timeout(2600)
        page.wait_for_selector(".ie-result, .ie-timeup")
        assert page.locator(".ie-result").count() == 1, "the time ran out in front of the learner: it finishes"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_time_off_the_lesson_counts_as_a_pause():
    """Leaving the test for another screen, closing it or sleeping in exam mode is not exam time (prog.addTest paused)."""
    page = _page("phone", init=[TC.SPEECH, SPY])
    try:
        _serve(page, "u23", _exam_unit)
        _serve(page, "u24", lambda u: _lesson(u, "u24-l1").__setitem__("exam", True))
        # a timed test left for the home screen for 3 minutes
        T._open(page, "#/lesson/u07-l3")
        page.click("#ie-go")
        page.wait_for_selector("#ie-timer")
        page.wait_for_timeout(1200)
        T._open(page, "#/")
        page.clock.fast_forward("03:00")
        T._open(page, "#/lesson/u07-l3")
        page.wait_for_selector("#ie-timer")
        r = _run(page, "u07-l3")
        assert r["away"] >= 180000 and r["el"] < 5000, r
        page.click("#ie-fin")
        page.wait_for_selector(".ie-result")
        t = _tests(page)
        assert len(t) == 1 and t[0]["paused"] is True, t
        assert "Paused for more than two minutes: not under exam conditions." in page.inner_text(".ie-result")
        # closed and opened again 3 minutes later (its last save is 3 minutes old); a quick reload isn't a pause
        _seed_run(page, "u08-l3", {"v": 1, "i": 0, "ans": {}, "checked": {}, "heard": {}, "self": {}, "el": 60000, "started": True,
                                   "at": page.evaluate("Date.now()") - 180000})
        T._open(page, "#/lesson/u08-l3")
        page.wait_for_selector("#ie-timer")
        a1 = _run(page, "u08-l3")["away"]
        assert a1 >= 180000, a1
        page.reload()
        page.wait_for_selector("#ie-timer")
        page.wait_for_timeout(300)
        assert _run(page, "u08-l3")["away"] == a1, (_run(page, "u08-l3"), a1)
        # exam mode: left for 3 minutes in the middle of the recording, then «Continue the recording» to the end
        T._open(page, "#/lesson/u23-l1")
        page.evaluate("() => { IE.player.EXAM = {preview: 1, check: 1, review: 2}; }")
        page.click("#ie-go")
        page.wait_for_function("() => { const r = JSON.parse(localStorage.getItem('ielts:run:u23-l1')); return r.x && r.x.phase === 'line'; }", timeout=8000)
        T._open(page, "#/")
        page.clock.fast_forward("03:00")
        T._open(page, "#/lesson/u23-l1")
        page.wait_for_selector("#ie-xgo")
        assert _run(page, "u23-l1")["away"] >= 180000, _run(page, "u23-l1")
        page.evaluate("() => { IE.player.EXAM = {preview: 1, check: 1, review: 2}; }")
        page.click("#ie-xgo")
        page.wait_for_selector(".ie-result", timeout=30000)
        t = [x for x in _tests(page) if x["lid"] == "u23-l1"]
        assert len(t) == 1 and t[0]["paused"] is True, t
        # exam mode: a laptop asleep for 3 minutes during the reading time (the page stays visible, nothing ticks)
        T._open(page, "#/lesson/u24-l1")
        page.evaluate("() => { IE.player.EXAM = {preview: 30, check: 1, review: 2}; }")
        page.click("#ie-go")
        rg = re.search(r"questions (\d+) to (\d+)", _item(_unit("u24"), "u24-l1-i2")["context"])
        page.wait_for_function("l => ((document.getElementById('ie-xst') || {}).textContent || '').startsWith(l)",
                               arg=f"Time to read questions {rg.group(1)} to {rg.group(2)}", timeout=8000)
        a0 = _run(page, "u24-l1").get("away", 0)
        page.clock.fast_forward("03:00")
        page.wait_for_timeout(1500)
        r = _run(page, "u24-l1")
        assert r["away"] - a0 >= 180000, (a0, r.get("away"))
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- speaking flows that outlive their screen
def test_part2_preparation_left_never_speaks_or_records():
    page = _page("phone", init=[TC.SPEECH, SPY, MIC])
    try:
        T._open(page, "#/lesson/u17-l2")
        page.click("#ie-prep")
        page.wait_for_timeout(400)
        page.click("#ie-next")
        page.wait_for_selector("[data-k='cue']")
        page.clock.fast_forward(61000)
        page.wait_for_timeout(1800)
        spoken = _said(page) + page.evaluate("() => window.__spoken.map(x => x.text)")
        assert not [t for t in spoken if "Please start speaking now" in t], spoken
        assert page.evaluate("() => window.__rec.starts") == 0
        # Parts 1 and 3: Continue while answering stops the microphone at once
        T._open(page, "#/lesson/u16-l2")
        page.click("[data-rec='0']")
        page.wait_for_function("() => window.__rec.starts === 1")
        assert page.evaluate("() => window.__rec.tracks") == 0
        page.click("#ie-next")
        page.wait_for_timeout(300)
        rec = page.evaluate("() => window.__rec")
        assert rec["tracks"] == 1 and rec["stops"] == 1, rec
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_part2_follow_ups_targets_and_no_microphone():
    def fu(u):
        _item(u, "u17-l2-i1")["followups"] = ["Do you think people value this more than they used to?", "Why might that be?"]
    page = _page("phone", init=[TC.SPEECH, SPY, MIC])
    try:
        _serve(page, "u17", fu)
        T._open(page, "#/lesson/u17-l2")
        assert page.locator("#ie-fu").is_hidden()
        page.click("#ie-prep")
        page.wait_for_timeout(300)
        page.click("#ie-prep")          # I'm ready: speak now
        page.wait_for_function("() => window.__rec.starts === 1", timeout=8000)
        assert "/ 2:00" in _text(page, "#ie-clock-cue")
        page.click("#ie-prep")          # Stop
        page.wait_for_function("() => (window.__said || []).some(x => x.t.startsWith('Do you think people value'))", timeout=5000)
        q = [x for x in page.evaluate("() => window.__said") if x["t"].startswith("Do you think")][0]
        assert q["o"]["voice"] == "m", q
        assert page.locator("#ie-fu").is_visible() and "Try again" in page.inner_text("#ie-prep")
        page.click("[data-frec='0']")
        page.wait_for_function("() => window.__rec.starts === 2")
        assert _text(page, "#ie-clock-f0").endswith("/ 0:20"), _text(page, "#ie-clock-f0")
        page.clock.fast_forward(31000)
        page.wait_for_function("() => document.querySelector('#ie-out-f0 audio')", timeout=5000)
        assert "The examiner would usually move on here." in _text(page, "#ie-out-f0")
        page.wait_for_function("() => window.__said.some(x => x.t === 'Why might that be?')", timeout=5000)
        assert page.evaluate("() => window.__rec.revoked") == 0
        page.click("[data-frec='0']")    # again: the old recording is let go
        page.wait_for_function("() => window.__rec.starts === 3")
        assert page.evaluate("() => window.__rec.revoked") >= 1
        # Parts 1 and 3: the target on the clock, the recording stops later (45 s and 90 s)
        T._open(page, "#/lesson/u18-l2")
        page.click("[data-rec='0']")
        page.wait_for_function("() => window.__rec.starts === 4")
        assert _text(page, "#ie-clock-0").endswith("/ 1:00")
        page.clock.fast_forward(61000)
        page.wait_for_timeout(500)
        assert page.evaluate("() => window.__rec.stops") == 3, "Part 3 stopped at the target"
        page.clock.fast_forward(30000)
        page.wait_for_function("() => document.querySelector('#ie-out-0 audio')", timeout=5000)
        assert "The examiner would usually move on here." in _text(page, "#ie-out-0")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()

    # no microphone: a timer with Stop, then the examiner's "Thank you", and «Try again»
    page = _page("phone", init=[TC.SPEECH, SPY, NOMIC])
    try:
        _serve(page, "u17", fu)
        T._open(page, "#/lesson/u17-l2")
        assert "answer aloud while the timer runs" in page.inner_text("#app")
        page.click("#ie-prep")
        page.wait_for_timeout(300)
        page.click("#ie-prep")
        page.wait_for_function("() => /0:0\\d \\/ 2:00/.test(document.getElementById('ie-clock-cue').textContent)", timeout=8000)
        assert "Stop" in page.inner_text("#ie-prep")
        page.click("#ie-prep")
        page.wait_for_function("() => window.__said.some(x => x.t === 'Thank you.')", timeout=5000)
        page.wait_for_function("() => /Try again/.test(document.getElementById('ie-prep').textContent)")
        assert page.locator("#ie-fu").is_visible() and page.locator("[data-frec='0']").is_visible()
        # Parts 1 and 3: the timer runs to the target (30 s here), with no recording to cap
        T._open(page, "#/lesson/u16-l2")
        page.evaluate("() => { window.__said = []; }")
        page.click("[data-rec='0']")
        page.wait_for_timeout(400)
        assert _text(page, "#ie-clock-0").endswith("/ 0:30")
        page.clock.fast_forward(31000)
        page.wait_for_function("() => /You spoke for 0:30\\./.test(document.getElementById('ie-out-0').textContent)", timeout=5000)
        assert "move on here" not in _text(page, "#ie-out-0"), _text(page, "#ie-out-0")
        page.wait_for_function("() => window.__said.some(x => x.t === 'Thank you.')", timeout=5000)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- writing practice
def test_writing_practice_needs_the_compare_and_results_show_feedback():
    page = _page("phone")
    try:
        T._open(page, "#/lesson/u11-l2")
        page.click("#ie-next")
        page.wait_for_selector("#ie-ta")
        assert page.locator("#ie-dock #ie-next, #ie-dock #ie-fin, #ie-dock #ie-check").count() == 0
        assert page.locator("#ie-dock #ie-prev").count() == 1
        assert page.get_attribute("#ie-ta", "autocorrect") == "off"
        text = "\n\n".join(_item(_unit("u11"), "u11-l2-i2")["model"]["text"])
        page.fill("#ie-ta", text)
        page.click("#ie-wdone")
        page.wait_for_selector(".ie-wchecks")
        page.wait_for_timeout(900)
        top = page.evaluate("() => document.querySelector('.ie-wchecks').getBoundingClientRect().top")
        assert 0 <= top < 400, top
        page.click("#ie-fin")
        page.wait_for_selector(".ie-result")
        t = page.inner_text("#app")
        assert "Band 9 model" in t and "Mark yourself" in t and "Checks" in t, t[:400]
        eid = _run(page, "u11-l2")["eid"]["u11-l2-i2"]
        assert page.get_attribute(".ie-revise a", "href") == f"#/essays/{eid}/revise"
        page.click(".ie-self [data-c='0'][data-b='8']")
        assert page.evaluate("() => IE.prog.get().essays.length") == 1
        page.click(".ie-revise a")
        page.wait_for_function("() => document.getElementById('app').dataset.ready && location.hash.endsWith('/revise')")
        assert page.locator(".ie-revise #ie-ta").count() == 1 and page.input_value("#ie-ta") == text
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- no English voice
def test_no_voice_shows_the_transcript_and_reaches_add_test():
    page = _page("phone", init=[NOVOICE, SPY])
    try:
        T._open(page, "#/lesson/u03-l3")
        page.click("#ie-go")
        page.click("#ie-play")
        page.wait_for_selector(".ie-noaudio")
        assert "No English voice on this device: read the transcript instead. This part isn't under exam conditions." in _text(page, ".ie-noaudio")
        assert page.evaluate("() => document.querySelector('.ie-trans').open") is True
        r = _run(page, "u03-l3")
        assert not r["heard"].get("u03-l3-i1") and r["noaudio"]["u03-l3-i1"] is True, r
        assert not _said(page), "nothing should be spoken"
        page.fill(".ie-in >> nth=0", "answer")
        page.click("#ie-fin")
        page.wait_for_selector(".ie-result")
        t = _tests(page)
        assert len(t) == 1 and t[0]["noaudio"] is True, t
        assert "Some recordings couldn't play on this device" in page.inner_text(".ie-result")
        # an exam:true test falls back to the timed transcript mode
        _serve(page, "u23", lambda u: _lesson(u, "u23-l1").__setitem__("exam", True))
        T._open(page, "#/lesson/u23-l1")
        page.click("#ie-go")
        page.click("#ie-next")
        page.wait_for_selector(".ie-noaudio")
        assert page.locator("#ie-timer").count() == 1 and page.locator("#ie-xbar").count() == 0
        assert _run(page, "u23-l1")["xmode"] == "timed"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- voices
def test_each_speaker_has_its_voice_and_tests_play_at_exam_speed():
    page = _page("phone", init=[TC.SPEECH, SPY, "localStorage.setItem('ielts:ui', JSON.stringify({rate: .85}));"])
    try:
        _serve(page, "u02", lambda u: [s.__setitem__("accent", "us") for s in _item(u, "u02-l1-i3")["speakers"] if s["name"] == "Maya"])
        T._open(page, "#/lesson/u02-l1")
        assert "Tests always play at exam speed." in page.inner_text("#app")
        page.click("#ie-go")
        page.click("#ie-next")
        page.click("#ie-next")
        page.wait_for_selector("#ie-play")
        page.click("#ie-play")
        it = _item(_unit("u02"), "u02-l1-i3")
        page.wait_for_function("n => (window.__said || []).length >= n", arg=9, timeout=15000)
        said = page.evaluate("() => window.__said")
        assert said[0]["t"] == it["context"] and said[0]["o"]["voice"] == "m" and said[0]["o"]["rate"] == 1, said[0]
        names = {s["id"]: s["name"] for s in it["speakers"]}
        want = {"Dr Reeve": {"voice": "f", "alt": 0, "pitch": 1, "rate": 1}, "Maya": {"voice": "f", "alt": 1, "pitch": 1.14, "rate": 1, "accent": "us"},
                "Daniel": {"voice": "m", "alt": 0, "pitch": 1, "rate": 1}}
        seen = set()
        for x, line in zip(said[1:], it["script"]):
            assert x["t"] == line["t"].replace("*", ""), (x, line)
            w = want[names[line["s"]]]
            assert {k: x["o"].get(k) for k in w} == w, (names[line["s"]], x["o"])
            seen.add(names[line["s"]])
        assert len(seen) >= 2, seen
        # practice: the speed of Settings (no rate passed), a second man a lower pitch
        T._open(page, "#/lesson/u05-l2")
        page.evaluate("() => { window.__said = []; }")
        page.click("#ie-play")
        it = _item(_unit("u05"), "u05-l2-i1")
        page.wait_for_function("() => window.__said.length >= 8", timeout=15000)
        said = page.evaluate("() => window.__said")
        assert all("rate" not in x["o"] for x in said), said[:2]
        by = {s["id"]: s for s in it["speakers"]}
        order = list(dict.fromkeys(l["s"] for l in it["script"]))
        males = [s for s in order if by[s]["voice"] == "m"]
        for x, line in zip(said[1:], it["script"]):
            if line["s"] == males[1]:
                assert x["o"]["alt"] == 1 and x["o"]["pitch"] == 0.88, x
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_a_test_recording_resumes_after_next_and_previous():
    def short(u):
        it = _item(u, "u02-l1-i2")
        it["script"] = it["script"][:7]
    page = _page("phone", init=[TC.SPEECH, SPY])
    try:
        u = _serve(page, "u02", short)
        lines = [_item(u, "u02-l1-i2")["context"]] + [l["t"].replace("*", "") for l in _item(u, "u02-l1-i2")["script"]]
        T._open(page, "#/lesson/u02-l1")
        page.click("#ie-go")
        page.click("#ie-next")
        page.click("#ie-play")
        assert "Playing" in page.inner_text("#ie-play")
        page.wait_for_function("() => window.__said.length >= 3", timeout=8000)
        r = _run(page, "u02-l1")
        assert r["heard"]["u02-l1-i2"] is True and r["lpos"]["u02-l1-i2"] >= 1, r
        page.click("#ie-next")
        page.wait_for_timeout(1200)
        n = len(_said(page))
        page.wait_for_timeout(1000)
        assert len(_said(page)) == n, "the voice went on after Next"
        pos = _run(page, "u02-l1")["lpos"]["u02-l1-i2"]
        page.click("#ie-prev")
        page.wait_for_selector("#ie-play")
        assert "Continue the recording" in page.inner_text("#ie-play") and not page.is_disabled("#ie-play")
        assert "Played" not in page.inner_text("#ie-play")
        page.click("#ie-play")
        page.wait_for_function("n => window.__said.length > n", arg=n, timeout=5000)
        assert _said(page)[n] == lines[pos], (_said(page)[n], pos)
        assert "Played" not in page.inner_text("#ie-play")
        page.wait_for_function("() => /Played/.test(document.getElementById('ie-play').textContent)", timeout=15000)
        assert _said(page)[-1] == lines[-1] and page.is_disabled("#ie-play")
        assert _run(page, "u02-l1")["played"]["u02-l1-i2"] is True
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- exam mode
def _exam_unit(u, lines=3):
    les = _lesson(u, "u23-l1")
    les["exam"] = True
    for it in les["items"]:
        if it["type"] != "listening":
            continue
        it["script"] = it["script"][:lines]
        for s in it["speakers"]:
            s["accent"] = "gb"
        if it["part"] == 1:
            it["script"].insert(2, {"s": it["script"][0]["s"], "t": "Before you hear the rest of the conversation, you have some time to look at questions 7 to 10.", "pause": 3})
    return u


def test_exam_listening_plays_in_order_survives_navigation_and_reload():
    page = _page("phone", init=[TC.SPEECH, SPY, PHASES])
    try:
        u = _serve(page, "u23", _exam_unit)
        les = _lesson(u, "u23-l1")
        parts = [it for it in les["items"] if it["type"] == "listening"]
        T._open(page, "#/lesson/u23-l1")
        assert "Like the computer-delivered exam" in page.inner_text("#app")
        page.evaluate("() => { IE.player.EXAM = {preview: 1, check: 1, review: 2}; }")
        page.click("#ie-go")
        # Part 1 comes up by itself, with no Play button
        page.wait_for_function("() => JSON.parse(localStorage.getItem('ielts:run:u23-l1')).i === 1")
        page.wait_for_selector("#ie-xst")
        assert page.locator("#ie-play").count() == 0
        page.wait_for_function("() => /^Time to read questions 1 to 6 · 0:0\\d$/.test(document.querySelector('.ie-xstat').textContent.trim())", timeout=6000)
        page.wait_for_function("() => /^Time to read questions 7 to 10 · 0:0\\d$/.test(document.querySelector('.ie-xstat').textContent.trim())", timeout=8000)
        # moving between items doesn't stop the recording; a chip offers the part that is playing
        page.click("#ie-next")
        page.wait_for_selector("#ie-xchip")
        assert _text(page, "#ie-xchip") == "Part 1 is playing · Go to Part 1"
        n = len(_said(page))
        page.wait_for_function("n => window.__said.length > n", arg=n, timeout=6000)
        page.click("#ie-prev")
        page.wait_for_timeout(200)
        page.click("#ie-prev")      # the intro card
        # Part 2 starts: from the intro card the learner is taken to it
        page.wait_for_function("() => { const r = JSON.parse(localStorage.getItem('ielts:run:u23-l1')); return r.x && r.x.k === 1; }", timeout=12000)
        page.wait_for_function("() => JSON.parse(localStorage.getItem('ielts:run:u23-l1')).i === 2", timeout=3000)
        # reload in Part 3: the voice stops, «Continue the recording» goes on from the saved line
        page.wait_for_function("() => { const r = JSON.parse(localStorage.getItem('ielts:run:u23-l1')); return r.x && r.x.k === 2 && r.x.phase === 'line' && r.x.line === 1; }", timeout=15000)
        page.reload()
        page.wait_for_selector("#ie-xgo")
        x = _run(page, "u23-l1")["x"]
        assert "Continue the recording" in page.inner_text("#ie-xgo")
        page.wait_for_timeout(600)
        assert _said(page) == []
        page.evaluate("() => { IE.player.EXAM = {preview: 1, check: 1, review: 2}; }")   # a reload brings back the real timings
        page.click("#ie-xgo")
        page.wait_for_function("() => window.__said.length > 0")
        assert _said(page)[0] == parts[x["k"]]["script"][x["line"]]["t"].replace("*", ""), (_said(page)[0], x)
        # the two minutes to check show in the top timer, then it finishes by itself
        page.wait_for_function("() => { const r = JSON.parse(localStorage.getItem('ielts:run:u23-l1')); return r.x && r.x.phase === 'review'; }", timeout=25000)
        page.wait_for_selector("#ie-timer")
        page.wait_for_selector(".ie-result", timeout=10000)
        page.wait_for_timeout(800)
        tests = _tests(page)
        assert len(tests) == 1 and tests[0]["skill"] == "listening" and tests[0]["lid"] == "u23-l1", tests
        said = _said(page)
        assert said[-1] == "That is the end of the Listening test. You now have two minutes to check your answers.", said[-3:]
        ph = json.loads(page.evaluate("() => sessionStorage.getItem('__ph')"))
        assert ph[-1] == f"{len(parts) - 1}:done:-1", ph[-3:]
        ph = ph[:-1]
        for k, it in enumerate(parts):
            seq = [p for p in ph if p.startswith(f"{k}:")]
            phases = [p.split(":")[1] for p in seq]
            assert phases[0] == "ctx" and phases[1] == "preview", (k, seq)
            tail = ["end", "review"] if k == len(parts) - 1 else ["end", "check"]
            assert phases[-2:] == tail, (k, seq)
            lines = [int(p.split(":")[2]) for p in seq if p.split(":")[1] == "line"]
            assert lines == sorted(lines) and lines[-1] == len(it["script"]) - 1, (k, seq)
            if k == 0:
                i = phases.index("pause")
                assert seq[i - 1] == "0:line:2" and seq[i + 1] == "0:line:3", seq
        order = [int(p.split(":")[0]) for p in ph]
        assert order == sorted(order), ph
        o = [x["o"] for x in page.evaluate("() => window.__said") if x["t"] == parts[-1]["script"][-1]["t"].replace("*", "")]
        assert o and o[0]["rate"] == 1 and o[0]["accent"] == "gb", o
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_exam_finish_early_asks_and_walker_finishes_mocks():
    page = C.new_page("phone")
    msgs = []
    page.on("dialog", lambda d: (msgs.append(d.message), d.accept()))
    try:
        page.add_init_script(_IN)
        page.add_init_script(TC.SPEECH)
        for uid, lid in (("u23", "u23-l1"), ("u24", "u24-l1")):
            _serve(page, uid, lambda u, lid=lid: _lesson(u, lid).__setitem__("exam", True))
        for uid, lid in (("u23", "u23-l1"), ("u24", "u24-l1")):
            les = _lesson(_unit(uid), lid)
            T._open(page, f"#/lesson/{lid}")
            steps = []
            for _ in range(len(les["items"]) * 3 + 6):
                s = page.evaluate(T._STEP)
                steps.append(s)
                if s in ("done", "stuck"):
                    break
                page.wait_for_timeout(120)
            assert steps[-1] == "done", (lid, steps)
            assert page.evaluate(f"() => IE.prog.lesson('{lid}')")["done"]
        assert "The recording hasn't finished. Finish anyway?" in msgs, msgs
        tests = _tests(page)
        assert [t["lid"] for t in tests] == ["u23-l1", "u24-l1"], tests
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_a_mock_started_before_exam_mode_keeps_its_clock():
    """A u23-l1 run from before exam mode (no run.xmode) that used the clock or played a part stays timed under exam:true."""
    page = _page("phone", init=[TC.SPEECH, SPY])
    try:
        _serve(page, "u23", lambda u: _lesson(u, "u23-l1").__setitem__("exam", True))
        _seed_run(page, "u23-l1", {"v": 1, "i": 1, "ans": {}, "checked": {}, "heard": {"u23-l1-i2": True}, "self": {}, "el": 600000, "started": True})
        T._open(page, "#/lesson/u23-l1")
        page.wait_for_selector("#ie-timer")
        assert page.locator("#ie-xbar, #ie-xgo, #ie-xst").count() == 0
        assert _run(page, "u23-l1")["xmode"] == "timed"
        assert "Played" in page.inner_text("#ie-play") and page.is_disabled("#ie-play")
        page.wait_for_timeout(600)
        assert _said(page) == [], "Part 1 played again"
        page.click("#ie-next")
        page.wait_for_selector("#ie-play")
        assert page.inner_text("#ie-play").strip() == "Play" and not page.is_disabled("#ie-play")
        # started but not yet timed or played: it goes on in exam mode
        _seed_run(page, "u23-l1", {"v": 1, "i": 0, "ans": {}, "checked": {}, "heard": {}, "self": {}, "el": 0, "started": True})
        T._open(page, "#/lesson/u23-l1")
        page.wait_for_selector("#ie-xgo")
        assert "Start the recording" in page.inner_text("#ie-xgo") and page.locator("#ie-timer").count() == 0
        assert _run(page, "u23-l1")["xmode"] == "exam"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def _clock_secs(page):
    m, s = (_text(page, "#ie-timer") or "0:00").split(":")
    return int(m) * 60 + int(s)


def test_exam_stopped_recording_counts_as_a_pause_and_the_review_goes_on():
    """After a reload the exam waits for «Continue the recording»: that time on screen, with the questions open and nothing
    setting the pace, is a pause (over two minutes: paused). The two minutes to check have no audio: they go on by themselves."""
    page = _page("phone", init=[TC.SPEECH, SPY])
    try:
        u = _serve(page, "u23", _exam_unit)
        les = _lesson(u, "u23-l1")
        parts = [it for it in les["items"] if it["type"] == "listening"]
        last, p1 = len(les["items"]) - 1, parts[0]["id"]
        # stopped in Part 2's reading time, on screen for 2.5 minutes without «Continue the recording»
        _seed_run(page, "u23-l1", {"v": 1, "i": last, "ans": {}, "checked": {}, "heard": {p1: True}, "self": {}, "el": 0, "started": True,
                                   "xmode": "exam", "played": {p1: True}, "x": {"k": 1, "line": -1, "phase": "preview", "left": 20}})
        T._open(page, "#/lesson/u23-l1")
        page.wait_for_selector("#ie-xgo")
        assert "the time counts as a pause" in page.inner_text("#ie-xbar")
        page.clock.run_for(150000)
        r = _run(page, "u23-l1")
        assert r.get("away", 0) >= 145000 and r["x"]["phase"] == "preview", r
        assert page.locator("#ie-xgo").count() == 1 and _said(page) == []
        page.click("#ie-fin")
        page.wait_for_selector(".ie-result")
        t = _tests(page)
        assert len(t) == 1 and t[0]["paused"] is True, t
        assert "Paused for more than two minutes: not under exam conditions." in page.inner_text(".ie-result")
        # stopped in the two minutes to check, 1:40 left: after the reload they go on and the test finishes by itself
        allp = {p["id"]: True for p in parts}
        _seed_run(page, "u23-l1", {"v": 1, "i": last, "ans": {}, "checked": {}, "heard": dict(allp), "self": {}, "el": 0, "started": True,
                                   "xmode": "exam", "played": dict(allp),
                                   "x": {"k": len(parts) - 1, "line": len(parts[-1]["script"]), "phase": "review", "left": 100}})
        T._open(page, "#/lesson/u23-l1")
        page.wait_for_selector("#ie-timer")
        assert page.locator("#ie-xgo").count() == 0
        assert 98 <= _clock_secs(page) <= 100, _text(page, "#ie-timer")
        page.clock.run_for(30000)
        assert 68 <= _clock_secs(page) <= 71, _text(page, "#ie-timer")
        page.clock.run_for(72000)
        page.wait_for_selector(".ie-result")
        t = [x for x in _tests(page) if x["lid"] == "u23-l1"]
        assert len(t) == 2 and t[-1]["paused"] is False, t
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_exam_resumes_from_the_next_step_the_data_still_has():
    """A saved exam position the data no longer has (a pause line removed, a script shortened) goes on from the next step
    there, never back to Part 1: what has already played is lost."""
    page = _page("phone", init=[TC.SPEECH, SPY])
    try:
        u = _serve(page, "u23", _exam_unit)
        les = _lesson(u, "u23-l1")
        parts = [it for it in les["items"] if it["type"] == "listening"]
        for k, x, first in ((2, {"s": 40, "k": 2, "line": 1, "phase": "pause", "left": 2}, parts[2]["script"][2]["t"]),
                            (1, {"k": 1, "line": 9, "phase": "line"}, f"That is the end of Part {parts[1]['part']}.")):
            heard = {p["id"]: True for p in parts[:k + 1]}
            _seed_run(page, "u23-l1", {"v": 1, "i": les["items"].index(parts[k]), "ans": {}, "checked": {}, "heard": heard, "self": {}, "el": 0,
                                       "started": True, "xmode": "exam", "played": {p["id"]: True for p in parts[:k]}, "x": x})
            T._open(page, "#/lesson/u23-l1")
            page.wait_for_selector("#ie-xgo")
            page.evaluate("() => { IE.player.EXAM = {preview: 1, check: 1, review: 2}; }")
            n = len(_said(page))
            page.click("#ie-xgo")
            page.wait_for_function("n => window.__said.length > n", arg=n)
            said = _said(page)[n]
            assert said == first.replace("*", ""), (x, said)
            r = _run(page, "u23-l1")
            assert r["x"]["k"] == k, (x, r["x"])
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_reading_time_names_the_voices_range_and_keeps_its_digits_quiet():
    def pause(u):
        it = _item(u, "u05-l2-i1")
        it["script"].insert(1, {"s": it["script"][0]["s"], "t": "Now you have some time to look at questions 5 to 7.", "pause": 3})
    page = _page("phone", init=[TC.SPEECH, SPY])
    try:
        def u24(u):
            _lesson(u, "u24-l1")["exam"] = True
            it = _item(u, "u24-l1-i3")
            assert "questions 11 to 14" in it["context"], it["context"]
            it["context"] = it["context"].replace("questions 11 to 14", "questions 11 to 20")
        _serve(page, "u24", u24)
        _serve(page, "u05", pause)
        # exam mode, u24-l1 Part 2: the voice says "questions 11 to 20" (its first set is 11 to 14)
        _seed_run(page, "u24-l1", {"v": 1, "i": 2, "ans": {}, "checked": {}, "heard": {"u24-l1-i2": True}, "self": {}, "el": 0, "started": True,
                                   "xmode": "exam", "played": {"u24-l1-i2": True}, "x": {"k": 1, "line": -1, "phase": "preview"}})
        T._open(page, "#/lesson/u24-l1")
        page.wait_for_selector("#ie-xgo")
        page.evaluate("() => { IE.player.EXAM = {preview: 5, check: 1, review: 2}; }")
        page.click("#ie-xgo")
        page.wait_for_function("() => /^Time to read questions 11 to 20 · 0:0\\d$/.test(document.querySelector('.ie-xstat').textContent.trim())", timeout=5000)
        # practice, a pause line: the live region says what it is once, the digits tick in an aria-hidden span
        T._open(page, "#/lesson/u05-l2")
        page.evaluate("""() => { window.__lp = []; const el = document.getElementById('ie-lprog');
          new MutationObserver(() => window.__lp.push(el.textContent)).observe(el, {childList: true, characterData: true, subtree: true}); }""")
        page.click("#ie-play")
        page.wait_for_function("() => /^· 0:0[1-3]$/.test(document.getElementById('ie-lclk').textContent)", timeout=8000)
        assert _text(page, "#ie-lprog") == "Time to read questions 5 to 7"
        assert page.get_attribute("#ie-lclk", "aria-hidden") == "true"
        page.wait_for_function("() => window.__lp.length && !/Time to read/.test(window.__lp[window.__lp.length - 1])", timeout=8000)
        lp = page.evaluate("() => window.__lp")
        assert [x for x in lp if "Time to read" in x] == ["Time to read questions 5 to 7"], lp
        assert not [x for x in lp if re.search(r"\d:\d\d", x)], lp
        assert _text(page, "#ie-lclk") == ""
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- reading, visuals, inputs
def test_reading_keeps_pane_and_scroll_per_item():
    page = _page("phone")
    try:
        T._open(page, "#/lesson/u23-l2")
        page.click("#ie-go")
        page.click("#ie-next")
        page.wait_for_selector(".ie-read")
        page.wait_for_timeout(300)
        page.evaluate("() => window.scrollTo(0, 2500)")
        page.wait_for_timeout(300)
        y0 = page.evaluate("scrollY")
        assert y0 > 2000, y0
        page.click(".ie-rtog [data-pane='qs']")
        page.wait_for_timeout(300)
        page.click(".ie-rtog [data-pane='text']")
        page.wait_for_timeout(300)
        assert abs(page.evaluate("scrollY") - y0) <= 2, (page.evaluate("scrollY"), y0)
        page.click(".ie-rtog [data-pane='qs']")
        page.wait_for_timeout(300)
        r = _run(page, "u23-l2")
        assert r["panes"]["u23-l2-i2"] == "qs" and abs(r["rpos"]["u23-l2-i2"]["text"] - y0) <= 1, r
        page.click("#ie-next")
        page.wait_for_selector(".ie-read[data-pane='text']")
        page.click("#ie-prev")
        page.wait_for_selector(".ie-read[data-pane='qs']")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_check_on_a_reading_item_shows_the_first_reason():
    """On a phone, Check scrolls to the first answer and reason: the pane's saved scroll doesn't win over it, and from the
    Passage pane it switches to Questions, where the reasons are."""
    page = _page("phone", reduced_motion="reduce")
    try:
        for start in ("qs", "text"):
            T._open(page, "#/")
            page.evaluate("() => localStorage.removeItem('ielts:run:u07-l2')")
            T._open(page, "#/lesson/u07-l2")
            page.wait_for_selector(".ie-read")
            if start == "qs":
                page.click(".ie-rtog [data-pane='qs']")
            page.wait_for_timeout(300)
            page.evaluate("() => window.scrollTo(0, document.documentElement.scrollHeight)")
            page.wait_for_timeout(300)
            assert page.evaluate("scrollY") > 1000, (start, page.evaluate("scrollY"))
            page.click("#ie-check")
            page.wait_for_selector(".ie-why")
            page.wait_for_timeout(400)
            box = page.evaluate("() => { const r = document.querySelector('.ie-why').getBoundingClientRect(); return [r.top, r.bottom, innerHeight]; }")
            assert 0 <= box[0] < box[2], (start, box)
            assert page.get_attribute(".ie-read", "data-pane") == "qs"
            page.wait_for_timeout(600)
            y = page.evaluate("scrollY")
            assert abs(_run(page, "u07-l2")["rpos"]["u07-l2-i1"]["qs"] - y) <= 2, (start, y, _run(page, "u07-l2")["rpos"])
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def _plan(u):
    s = _item(u, "u04-l2-i1")["sets"][0]
    s["visual"] = {"kind": "map", "title": "The mill site (north is at the top)", "maps": [{"title": "Site plan", "items": [
        {"label": "Entrance", "x": 40, "y": 88, "w": 20, "h": 10, "shape": "rect"},
        {"label": "Courtyard", "x": 30, "y": 35, "w": 40, "h": 40, "shape": "rect"},
        {"label": "A", "x": 8, "y": 70, "w": 16, "h": 14, "shape": "rect", "mark": True},
        {"label": "River", "x": 0, "y": 2, "w": 100, "h": 8, "shape": "water"}]}]}


def test_set_visuals_and_a_second_task1_visual():
    page = _page("phone")
    try:
        _serve(page, "u04", _plan)
        _serve(page, "u11", lambda u: _item(u, "u11-l2-i2").__setitem__("visual2", {"kind": "table", "title": "Average fares", "head": ["", "2010", "2020"], "rows": [["Rail", "£4", "£6"]]}))
        u03 = _serve(page, "u03", lambda u: _item(u, "u03-l3-i1")["sets"][0].__setitem__("visual", {"kind": "table", "title": "Booking form", "head": ["Item", "Detail"], "rows": [["Name", "1 ____"]]}))
        nvis = sum(1 for it in _lesson(u03, "u03-l3")["items"] for st in it.get("sets") or [] if st.get("visual"))
        T._open(page, "#/lesson/u04-l2")
        order = page.evaluate("""() => [...document.querySelector('.ie-set').children].map(e => e.tagName + '.' + e.className.split(' ')[0])""")
        assert order[0] == "P.ie-instr" and order[1] == "FIGURE.ie-viz" and order[2].endswith("ie-q"), order
        assert page.locator(".ie-set .ie-viz svg").count() == 1
        T._open(page, "#/lesson/u11-l2")
        page.click("#ie-next")
        page.wait_for_selector(".ie-wtask")
        assert page.locator(".ie-wtask .ie-viz").count() == 2 and "Average fares" in page.inner_text(".ie-wtask")
        T._open(page, "#/lesson/u03-l3")
        page.click("#ie-go")
        page.click("#ie-fin")
        page.wait_for_selector(".ie-result")
        assert nvis >= 1 and page.locator(".ie-set .ie-viz").count() == nvis and "Booking form" in page.inner_text("#app")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- the shared self-marking and the results
def test_self_marking_goes_through_ie_assess():
    page = _page("phone", init=[ASSESS])
    try:
        T._open(page, "#/lesson/u11-l2")
        page.click("#ie-next")
        page.fill("#ie-ta", "Overall, " + "the figures rose steadily. " * 40)
        page.click("#ie-wdone")
        page.wait_for_selector(".stub-self")
        assert page.get_attribute(".stub-self", "data-item") == "u11-l2-i2" and page.get_attribute(".stub-self", "data-kind") == "w1"
        assert ["wire", "w1", "u11-l2-i2"] in page.evaluate("() => window.__assess")
        page.click("[data-stub]")
        assert page.evaluate("() => IE.prog.get().essays[0].band") == 7
        page.click("#ie-fin")
        page.wait_for_selector(".ie-result .stub-self, .ie-result ~ * .stub-self, .stub-self")
        assert page.locator(".stub-self").count() == 1
        T._open(page, "#/lesson/u16-l2")
        page.click("#ie-sdone")
        page.wait_for_selector(".stub-self")
        assert page.get_attribute(".stub-self", "data-kind") == "s" and page.get_attribute(".stub-self", "data-item") == "u16-l2-i1"
        assert ["wire", "s", "u16-l2-i1"] in page.evaluate("() => window.__assess")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_results_labels_counted_part_tests_and_virtual_units():
    page = _page("phone")
    try:
        _serve(page, "u03", lambda u: u.update({"back": "#/progress", "backT": "My results"}))
        T._open(page, "#/lesson/u03-l3")
        assert page.get_attribute(".ie-back", "href") == "#/progress" and page.get_attribute(".ie-back", "aria-label") == "Back to My results"
        page.evaluate("""() => { const o = IE.prog.addTest; IE.prog.addTest = t => { o.call(IE.prog, t); window.__added = t; return Object.assign({}, t, {attempt: 2, counted: false}); }; }""")
        page.click("#ie-go")
        page.click("#ie-fin")
        page.wait_for_selector(".ie-result")
        t = page.inner_text(".ie-result")
        assert "Repeat or paused test: not counted in your bands." in t, t
        m = sum(len(q["rows"]) if q["type"] == "select" else len(q["answer"]) if q["type"] == "multi" else 1
                                      for it in _lesson(_unit("u03"), "u03-l3")["items"] for st in it.get("sets", []) for q in st["items"])
        assert f"Part test: 0 of {m}. Your headline bands come from full papers and pooled results." in t, t
        assert "Scaled to a 40-question paper" not in t
        assert page.evaluate("() => window.__added.paused") is False
        assert page.get_attribute(".ie-result a[href='#/progress']", "href") == "#/progress"
        assert "Back to My results" in t and page.get_attribute(".ie-back", "href") == "#/progress"
        r = _run(page, "u03-l3")
        assert r["counted"] is False and r["attempt"] == 2, r
        page.reload()
        page.wait_for_selector(".ie-result")
        assert "not counted in your bands" in page.inner_text(".ie-result")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_live_region_inputs_transcript_note_fillers_and_storage_full():
    page = _page("phone", init=[TC.SPEECH, MIC, FAKE_SR])
    try:
        u = _unit("u01")
        les = _lesson(u, "u01-l1")
        k = next(i for i, it in enumerate(les["items"]) if it["type"] == "pick")
        it = les["items"][k]
        _seed_run(page, "u01-l1", {"v": 1, "i": k, "ans": {}, "checked": {}, "heard": {}, "self": {}, "el": 0, "started": True})
        T._open(page, "#/lesson/u01-l1")
        wrong = (it["answer"] + 1) % len(it["options"])
        page.click(f".ie-opt[data-v='{wrong}']")
        page.click("#ie-check")
        page.wait_for_timeout(300)
        live = page.evaluate("() => { const l = document.getElementById('ie-live'); return [l.textContent, l.getAttribute('aria-live'), l.className]; }")
        assert live[0].startswith("Not quite. The answer is ") and live[1] == "polite" and live[2] == "vh", live
        assert page.locator("#ie-live").count() == 1
        T._open(page, "#/lesson/u03-l2")
        page.click("#ie-check")
        page.wait_for_timeout(300)
        assert page.evaluate("() => /^0 of \\d+ correct\\.$/.test(document.getElementById('ie-live').textContent)"), _text(page, "#ie-live")
        assert page.get_attribute(".ie-in >> nth=0", "autocorrect") == "off"
        T._open(page, "#/lesson/u02-l3")
        page.click("#ie-go")
        assert page.get_attribute("#ie-ta", "autocapitalize") == "none" and page.get_attribute("#ie-ta", "autocorrect") == "off"
        # the Live transcript note, and fillers "may be undercounted"
        T._open(page, "#/lesson/u16-l2")
        assert "Live transcript uses your browser's speech service, which may send your voice to its provider (Google in Chrome)." in page.inner_text("#app")
        page.click("[data-mode='tr']")
        page.click("[data-rec='0']")
        page.wait_for_timeout(400)
        page.click("[data-rec='0']")
        page.wait_for_function("() => /fillers/.test(document.getElementById('ie-out-0').textContent)", timeout=5000)
        assert "may be undercounted" in _text(page, "#ie-out-0")
        # storage full: one toast
        page.evaluate("""() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) {
          if (String(k).startsWith('ielts:run:')) throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); }; }""")
        T._open(page, "#/lesson/u03-l2")
        page.wait_for_function("() => /storage is full/.test((document.getElementById('ie-toast') || {}).textContent || '')", timeout=3000)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- screenshots and checks
def _checks(page, name, mine):
    w = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    assert w <= 1, f"{name}: horizontal scroll {w}px"
    a = page.evaluate(A11Y, {"what": ["names", "targets", "ids"]})
    bad = [x for x in a["targets"] + a["names"] + a["ids"] if any(m in x for m in mine)]
    assert not bad, (name, bad)
    p = page.evaluate(AUDIT, {"what": ["palette", "contrast"]})
    assert not p["palette"], (name, p["palette"][:5])
    badc = [x for x in p["contrast"] if any(m in x for m in mine)]
    assert not badc, (name, badc[:5])
    assert page.locator("#ie-live").count() == 1


def _desk_writing(page, width):
    r = page.evaluate("""() => { const t = document.querySelector('.ie-wtask').getBoundingClientRect(), a = document.querySelector('.ie-wans').getBoundingClientRect();
      return {tl: t.left, al: a.left, tt: t.top, at: a.top}; }""")
    if width >= 960:
        assert r["al"] > r["tl"] + 200 and abs(r["at"] - r["tt"]) < 4, r
    else:
        assert abs(r["al"] - r["tl"]) < 2 and r["at"] > r["tt"], r


def test_player_screens():
    def fu(u):
        _item(u, "u17-l2-i1")["followups"] = ["Do you think people value this more than they used to?", "Why might that be?"]
    combos = [(360, "light", "no-preference"), (360, "dark", "no-preference"), (390, "light", "reduce"), (390, "dark", "no-preference"),
              (1280, "light", "no-preference"), (1280, "dark", "reduce")]
    for width, scheme, motion in combos:
        kind = "desk" if width > 900 else "phone"
        page = _page(kind, init=[TC.SPEECH, MIC], color_scheme=scheme, reduced_motion=motion,
                     viewport={"width": width, "height": 800 if kind == "desk" else 780})
        tag = f"{width}-{scheme}" + ("-calm" if motion == "reduce" else "")
        try:
            _serve(page, "u23", lambda u: _exam_unit(u, 6))
            _serve(page, "u04", _plan)
            _serve(page, "u17", fu)
            # exam: the status line in the preview, then the chip
            T._open(page, "#/lesson/u23-l1")
            page.click("#ie-go")
            page.wait_for_function("() => /^Time to read questions 1 to 6/.test((document.getElementById('ie-xst') || {}).textContent || '')", timeout=8000)
            C.shot(page, f"{tag}-exam-status", SHOTS)
            _checks(page, f"{tag} exam status", ["ie-xst", "ie-xclk", "Time to read", "ie-in", "ie-timer"])
            page.click("#ie-next")
            page.wait_for_selector("#ie-xchip")
            C.shot(page, f"{tag}-exam-chip", SHOTS)
            _checks(page, f"{tag} exam chip", ["ie-xchip", "is playing", "ie-sel"])
            # a plan drawn on a question set
            T._open(page, "#/lesson/u04-l2")
            page.locator(".ie-set .ie-viz").scroll_into_view_if_needed()
            C.shot(page, f"{tag}-plan", SHOTS)
            _checks(page, f"{tag} plan", ["ie-viz"])
            # writing practice before the compare: the dock has only Previous; side by side on a desktop
            T._open(page, "#/lesson/u11-l2")
            page.click("#ie-next")
            page.wait_for_selector(".ie-wtask")
            C.shot(page, f"{tag}-writing", SHOTS)
            _desk_writing(page, width)
            _checks(page, f"{tag} writing", ["ie-wdone", "ie-ta"])
            # Part 2 with its follow-up questions
            _seed_run(page, "u17-l2", {"v": 1, "i": 0, "ans": {}, "checked": {}, "heard": {}, "self": {}, "el": 0, "started": True, "fu": {"u17-l2-i1": True}})
            T._open(page, "#/lesson/u17-l2")
            page.locator("#ie-fu").scroll_into_view_if_needed()
            C.shot(page, f"{tag}-part2-followups", SHOTS)
            _checks(page, f"{tag} follow-ups", ["Answer", "Ask me", "follow-up", "role=radio", "ie-prep"])
            # no English voice
            _seed_run(page, "u03-l3", {"v": 1, "i": 0, "ans": {}, "checked": {}, "heard": {}, "self": {}, "el": 0, "started": True, "noaudio": {"u03-l3-i1": True}})
            T._open(page, "#/lesson/u03-l3")
            C.shot(page, f"{tag}-no-voice", SHOTS)
            _checks(page, f"{tag} no voice", ["ie-noaudio", "No English voice"])
            # the time is up
            _seed_run(page, "u07-l3", {"v": 1, "i": 0, "ans": {}, "checked": {}, "heard": {}, "self": {}, "el": 1300000, "started": True})
            T._open(page, "#/lesson/u07-l3")
            page.wait_for_selector(".ie-timeup")
            C.shot(page, f"{tag}-time-up", SHOTS)
            _checks(page, f"{tag} time up", ["ie-fin", "ie-review", "Time is up", "ie-timer"])
            page.keyboard.press("Tab")
            ring = page.evaluate("() => { const e = document.activeElement; const s = getComputedStyle(e); return [e.id || e.className, s.outlineStyle, s.outlineWidth]; }")
            assert ring[1] != "none" and ring[2] != "0px", ring
            assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()
