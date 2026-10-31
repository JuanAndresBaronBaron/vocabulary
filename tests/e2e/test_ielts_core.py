"""IELTS Prep, the core (js/ielts.js and its section of ielts.css): bands, data safety, voices, home, backup, revision.

- Bands that mean something: attempts and «counted» (repeats within 60 days, paused tests and tests without sound don't
  count); Listening and Reading pool the newest counted tests up to 40 questions, so a part test after a mock doesn't
  replace the mock band; latestInfo() with the questions behind a band and its likely range; the tiles, the partial
  overall, and deleting a result in #/progress.
- Data safety: v1 data loads unchanged, a newer version's blob is never overwritten, a damaged blob is copied to
  ielts:data:bak-*, 61 essays and more are kept, a full storage says so, a hung request gives up after 10 s.
- Voices with a fake speechSynthesis: accent pools, the alt voice, the pitch multiplier, «British only», an engine
  error stops at once, exam speed in timed tests, ensureVoices() (0 without voices, cached, refreshed) and the help
  when the device has no English voice.
- Home paints before the units arrive and fills in place (an element put after .ie-hero survives); Continue with the
  time left of a test; «In progress» rows.
- Writing revision: version 2 autosaves in ielts:draft:<id>, compare shows both versions and saves {parent, v};
  rewrite from memory hides the model; My writing groups the versions; self-marking only with IE.assess.
- Backup: download and restore merge without duplicates and leave out ielts:on and ielts:run:*.
- The chosen segment is clear in dark mode, targets are 44 px, the short back label below 400 px; screenshots of home,
  settings, progress, writing and revision at 360 and 1280 px, light and dark, with no horizontal scroll, British
  spelling, the palette and nothing outside ielts:*.
"""
from __future__ import annotations

import json
import re

import common as C
import ielts_validate as V

_IN = "localStorage.setItem('ielts:on', 'true'); sessionStorage.setItem('ielts:in', '1');"
AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
SHOTS = C.CAPTURAS / "ielts-core"
DAY = 864e5
FULL = "Storage is full: download your data in Settings › Your data, then erase old results."

# speechSynthesis de mentira: lo que se dice queda en window.__said; window.__ttsErr hace que cada frase falle con ese error
_FAKE = r"""(cfg => {
  const ss = window.speechSynthesis; if (!ss) return;
  window.__voices = cfg.voices.map(([name, lang]) => Object.freeze({name, lang, voiceURI: name, localService: true, default: false}));
  window.__said = []; window.__ttsErr = cfg.err || null;
  const def = (k, v) => Object.defineProperty(ss, k, {configurable: true, writable: true, value: v});
  def('getVoices', () => window.__voices.slice());
  def('cancel', () => {});
  def('resume', () => {});
  def('speak', u => {
    window.__said.push({text: String(u.text), voice: u.voice ? u.voice.name : null, lang: String(u.lang || ''), pitch: u.pitch, rate: u.rate});
    setTimeout(() => { try { if (window.__ttsErr) { if (u.onerror) u.onerror({error: window.__ttsErr}); } else if (u.onend) u.onend({}); } catch (e) {} }, 30);
  });
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t == null ? '' : String(t); this.lang = ''; this.rate = 1;
    this.pitch = 1; this.volume = 1; this.voice = null; this.onend = this.onerror = null; } };
})"""
_VOICES = [["Google UK English Female", "en-GB"], ["Serena", "en-GB"], ["Google UK English Male", "en-GB"], ["Daniel", "en-GB"],
           ["Samantha", "en-US"], ["Alex", "en-US"], ["Karen", "en-AU"], ["Lee", "en-AU"], ["Moira", "en-IE"], ["Google español", "es-ES"]]


def _fake(voices, err=None):
    return f"{_FAKE}({json.dumps({'voices': voices, 'err': err})})"


def _page(kind="phone", voices=_VOICES, **kw):
    page = C.new_page(kind, **kw)
    page.add_init_script(_IN)
    if voices is not None:
        page.add_init_script(_fake(voices))
    page.on("dialog", lambda d: d.accept())
    return page


def _open(page, hash="#/", reload=False):
    on = page.url.startswith(C.base_url(page) + "/ielts.html")
    if reload or not on:
        if on:
            page.goto(C.base_url(page) + "/__blank")
        page.goto(C.base_url(page) + "/ielts.html" + hash)
    else:
        page.evaluate("h => { location.hash = h; }", hash)
    page.wait_for_function("h => { const a = document.getElementById('app'); return a && a.dataset.ready === h; }", arg=hash, timeout=15000)
    page.wait_for_timeout(150)


def _seed(page, keys):
    """Writes these ielts:* keys (values as JSON, or a raw string) on a blank page of the same origin, before the app."""
    page.goto(C.base_url(page) + "/__blank")
    page.evaluate("""ks => { for (const k of Object.keys(localStorage)) if (k.startsWith('ielts:')) localStorage.removeItem(k);
      localStorage.setItem('ielts:on', 'true'); sessionStorage.setItem('ielts:in', '1');
      for (const [k, v] of Object.entries(ks)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }""", keys)


def _toast(page):
    return page.evaluate("() => { const t = document.getElementById('ie-toast'); return t ? t.textContent : ''; }")


def _prompt(iid):
    u = json.loads((V.DATA / f"{iid[:3]}.json").read_text(encoding="utf-8"))
    for les in u["lessons"]:
        for it in les["items"]:
            if it["id"] == iid:
                return it
    raise KeyError(iid)


ESSAY1 = """In this day and age, cities replace buildings faster than ever. Some people think every new building should be required by law to last a hundred years. I believe this is partly right, but a strict law isn't the best tool.

Firstly, long-lasting buildings save resources. Concrete and steel cause a large share of emissions, so a block that stands for a century doesn't need to be rebuilt three times.

Secondly, durable buildings give streets character. Victorian terraces are still loved because they were built well, and people don't want to lose them.

However, a single rule for every building would be unwise. A hospital needs to change as medicine changes, and a factory may be useless in twenty years. Forcing them to last a century would waste money on strength nobody needs.

In conclusion, I agree that most homes and public buildings should be built to last, but the law should set different lifespans for different kinds of building."""

ESSAY2 = """Cities now replace their buildings faster than at any time in the past. Some people therefore argue that every new building should be required by law to last for at least a century. I believe this view is partly right, but a single legal lifespan would be a blunt instrument.

The strongest argument for durability is environmental. Concrete and steel account for a large share of global emissions, so a block of flats that stands for a hundred years, rather than being demolished and rebuilt three times, saves an enormous quantity of carbon. Durable materials also cost less over the life of a building, even if they cost more at the start.

A second argument concerns the character of a place. Victorian terraces and Georgian squares are still admired largely because they were built well, and residents rarely want to see them replaced. Buildings that last allow neighbourhoods to keep a sense of continuity.

However, a requirement that applies to every building would be unwise. A hospital must adapt as medicine changes, and a warehouse or a data centre may be obsolete within twenty years. Forcing such structures to last a century would waste money on strength that nobody needs, and might even discourage the adaptation that cities depend on.

In conclusion, I agree that most homes and public buildings should be designed to last for generations, but I would argue that the law should set different minimum lifespans for different kinds of building, rather than one figure for all of them."""


def _essay1(at=1773219600000):
    it = _prompt("u13-l2-i2")
    return {"id": "u13-l2-i2-seed", "iid": "u13-l2-i2", "task": 2, "prompt": it["prompt"], "text": ESSAY1, "words": len(re.findall(r"[A-Za-z0-9’'-]+", ESSAY1)),
            "self": {"0": 6, "1": 6, "2": 6, "3": 6}, "band": 6, "at": at}


# ---------------------------------------------------------------- 1. bands
def test_core_bands():
    page = _page("desk")
    try:
        _seed(page, {})
        _open(page, "#/", reload=True)
        r = page.evaluate("""() => {
          const P = IE.prog, b = IE.band;
          const mock = P.addTest({lid: 'u23-l1', title: 'Listening test · Unit 23', skill: 'listening', got: 32, total: 40, band: b('listening', 32, 40)});
          const p1 = P.addTest({lid: 'u03-l3', title: 'Test: a full Part 1 · Unit 3', skill: 'listening', got: 8, total: 10, band: b('listening', 8, 10)});
          const after1 = P.latest().listening;
          const p2 = P.addTest({lid: 'u03-l3', title: 'Test: a full Part 1 · Unit 3', skill: 'listening', got: 10, total: 10, band: b('listening', 10, 10)});
          const out = {mock, p1, p2, after1, after2: P.latest().listening, info: P.latestInfo().listening};
          out.paused = P.addTest({lid: 'u04-l3', title: 'Test: a full Part 2 · Unit 4', skill: 'listening', got: 10, total: 10, band: 9, paused: true});
          out.noaudio = P.addTest({lid: 'u05-l3', title: 'Test: a full Part 3 · Unit 5', skill: 'listening', got: 10, total: 10, band: 9, noaudio: true});
          out.after3 = P.latest().listening;
          out.late = P.addTest({lid: 'u03-l3', title: 'Test: a full Part 1 · Unit 3', skill: 'listening', got: 9, total: 10, band: 8, at: p2.at + 61 * 864e5});
          out.info2 = P.latestInfo().listening;
          return out; }""")
        assert r["mock"]["band"] == 7.5 and r["mock"]["attempt"] == 1 and r["mock"]["counted"] is True, r["mock"]
        assert r["p1"]["attempt"] == 1 and r["p1"]["counted"] is True, r["p1"]
        assert r["p2"]["attempt"] == 2 and r["p2"]["counted"] is False, r["p2"]
        # the part test pools with the mock (40 of 50 = the same 7.5); the redo at 10/10 counts for nothing
        assert r["after1"] == 7.5 and r["after2"] == 7.5, r
        assert r["info"]["n"] == 50 and r["info"]["range"][0] < r["info"]["range"][1] and not r["info"]["uncounted"], r["info"]
        assert r["paused"]["counted"] is False and r["noaudio"]["counted"] is False and r["after3"] == 7.5, r
        assert r["late"]["attempt"] == 3 and r["late"]["counted"] is True, r["late"]
        assert r["info2"]["n"] == 60 and r["info2"]["got"] == 49, r["info2"]   # 9/10 (counted, 61 days later) + the first 8/10 + the mock
        # only a full 40-question test stands alone; the range narrows with more questions
        r2 = page.evaluate("""() => { const P = IE.prog; P.erase();
          P.addTest({lid: 'u03-l3', skill: 'listening', got: 10, total: 10, band: 9});
          const one = P.latestInfo().listening;
          P.addTest({lid: 'u23-l1', skill: 'listening', got: 30, total: 40, band: 7});
          const mock = P.latestInfo().listening;
          P.erase(); P.addTest({lid: 'u03-l3', skill: 'listening', got: 6, total: 10, band: 6, paused: true});
          const unc = P.latestInfo().listening;
          return {one, mock, unc}; }""")
        assert r2["one"]["band"] == 9 and r2["one"]["n"] == 10 and r2["one"]["range"] == [8.5, 9], r2["one"]
        assert r2["mock"]["band"] == 7 and r2["mock"]["n"] == 40 and r2["mock"]["range"][0] < 7 < r2["mock"]["range"][1], r2["mock"]
        assert r2["unc"]["uncounted"] is True and r2["unc"]["band"] == 6, r2["unc"]
        # old records without attempt get it from their order; reading them writes nothing
        old = {"v": 1, "lessons": {}, "tests": [{"lid": "u07-l3", "skill": "reading", "got": 10, "total": 13, "band": 7, "at": 1},
                                               {"lid": "u07-l3", "skill": "reading", "got": 13, "total": 13, "band": 9, "at": 2}], "essays": [], "speaking": []}
        _seed(page, {"ielts:data": old})
        _open(page, "#/", reload=True)
        r3 = page.evaluate("() => ({t: IE.prog.tests().map(t => [t.attempt, t.counted]), l: IE.prog.latest().reading, raw: localStorage.getItem('ielts:data')})")
        assert r3["t"] == [[1, True], [2, False]] and r3["l"] == 7 and json.loads(r3["raw"]) == old, r3
        # the tiles: questions, range and the partial overall
        page.evaluate("""() => { const P = IE.prog, b = IE.band; P.erase();
          P.addTest({lid: 'u23-l1', title: 'Listening test · Unit 23', skill: 'listening', got: 32, total: 40, band: 7.5});
          P.addTest({lid: 'u03-l3', title: 'Test: a full Part 1 · Unit 3', skill: 'listening', got: 8, total: 10, band: 7.5});
          P.addTest({lid: 'u03-l3', title: 'Test: a full Part 1 · Unit 3', skill: 'listening', got: 10, total: 10, band: 9});
          P.addTest({lid: 'u04-l3', title: 'Test: a full Part 2 · Unit 4', skill: 'listening', got: 9, total: 10, band: 8, paused: true});
          P.addTest({lid: 'u23-l2', title: 'Reading test · Unit 23', skill: 'reading', got: 30, total: 40, band: 7});
          P.addEssay({id: 'e1', iid: 'u13-l2-i2', task: 2, prompt: 'x', text: 'y', words: 1, self: null, band: 7}); }""")
        _open(page, "#/progress")
        tiles = page.evaluate("() => Object.fromEntries([...document.querySelectorAll('.ie-tile')].map(t => [t.dataset.skill, t.textContent.replace(/\\s+/g, ' ').trim()]))")
        assert "from 50 questions" in tiles["listening"] and re.search(r"\d(\.5)?–\d", tiles["listening"]), tiles
        assert "from 40 questions" in tiles["reading"] and "your estimate" in tiles["writing"] and "Not yet" in tiles["speaking"], tiles
        ov = page.inner_text(".ie-overall").replace("\n", " ")
        assert "about 7 from 3 skills" in re.sub(r"\s+", " ", ov), ov
        assert page.evaluate("() => [IE.prog.overall(), IE.prog.overallInfo()]") == [None, {"band": 7, "skills": 3, "partial": True}]
        rows = page.evaluate("() => [...document.querySelectorAll('[data-test]')].map(r => r.textContent.replace(/\\s+/g, ' ').trim())")
        assert sum("Repeat: not counted" in x for x in rows) == 1 and sum("Clock paused: not counted" in x for x in rows) == 1, rows
        n0 = page.locator("[data-del]").count()
        assert n0 == 5 and all(page.evaluate("() => [...document.querySelectorAll('[data-del]')].map(b => b.getBoundingClientRect().height >= 44 && /^Delete this result/.test(b.getAttribute('aria-label')))"))
        page.locator("[data-test]", has_text="Clock paused").locator("[data-del]").click()
        page.wait_for_timeout(200)
        assert page.locator("[data-del]").count() == 4 and "Result deleted" in _toast(page)
        assert not [t for t in page.evaluate("() => IE.prog.tests()") if t.get("paused")]
        _open(page, "#/settings")
        assert "the usual conversion, approximate: cut-offs vary slightly between test versions" in page.inner_text("#app")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- 2. data safety
def test_core_data_safety():
    page = _page("phone")
    try:
        # v1 data loads unchanged: no page writes it back
        v1 = {"v": 1, "lessons": {"u01-l1": {"done": True, "at": 5, "got": 3, "total": 4, "band": None}},
              "tests": [{"lid": "u03-l3", "skill": "listening", "got": 7, "total": 10, "band": 7, "at": 10}],
              "essays": [_essay1()], "speaking": [{"title": "Part 1", "band": 7, "at": 20}]}
        raw = json.dumps(v1, separators=(",", ":"))
        _seed(page, {"ielts:data": raw})
        for h in ("#/", "#/progress", "#/essays", "#/essays/u13-l2-i2-seed", "#/settings", "#/unit/u03"):
            _open(page, h, reload=h == "#/")
        assert page.evaluate("() => localStorage.getItem('ielts:data')") == raw
        assert page.evaluate("() => IE.prog.get()") == v1
        # a newer version's data: read-only, never overwritten
        v2 = json.dumps({"v": 2, "lessons": {"u01-l1": {"done": True}}, "tests": [], "essays": [], "speaking": [], "newField": {"x": 1}})
        _seed(page, {"ielts:data": v2})
        _open(page, "#/", reload=True)
        assert "Update the app to see your progress" in _toast(page), _toast(page)
        page.evaluate("""() => { IE.prog.addTest({lid: 'u03-l3', skill: 'listening', got: 1, total: 10, band: 2}); IE.prog.done('u01-l2', {});
          IE.prog.addEssay({id: 'x', task: 2, text: 'a', words: 1}); IE.prog.addSpeaking({band: 6}); IE.prog.delTest('u03-l3', 1); }""")
        assert page.evaluate("() => localStorage.getItem('ielts:data')") == v2
        assert page.evaluate("() => [IE.prog.readOnly(), IE.prog.restore({app: 'ielts-prep', keys: {'ielts:data': {v: 1, lessons: {}}}}).error]") == [True, "Update the app to see your progress."]
        # damaged JSON is copied to ielts:data:bak-<ms> before starting empty
        _seed(page, {"ielts:data": "{oops, half a file"})
        _open(page, "#/", reload=True)
        bak = page.evaluate("() => Object.keys(localStorage).filter(k => k.startsWith('ielts:data:bak-')).map(k => [k, localStorage.getItem(k)])")
        assert len(bak) == 1 and bak[0][1] == "{oops, half a file" and re.fullmatch(r"ielts:data:bak-\d{13}", bak[0][0]), bak
        assert page.evaluate("() => IE.prog.get()") == {"v": 1, "lessons": {}, "tests": [], "essays": [], "speaking": []}
        _open(page, "#/", reload=True)
        assert page.evaluate("() => Object.keys(localStorage).filter(k => k.startsWith('ielts:data:bak-')).length") == 1
        page.evaluate("() => IE.prog.addTest({lid: 'u03-l3', skill: 'listening', got: 7, total: 10, band: 7})")
        assert json.loads(page.evaluate("() => localStorage.getItem('ielts:data')"))["tests"][0]["attempt"] == 1
        # 61 essays and more are kept (the old cap of 60 deleted the oldest silently)
        n = page.evaluate("""() => { IE.prog.erase();
          for (let i = 0; i < 75; i++) IE.prog.addEssay({id: 'e' + i, iid: 'u13-l2-i2', task: 2, prompt: 'p', text: 'word '.repeat(280), words: 280, self: null, band: null});
          return IE.prog.get().essays.length; }""")
        assert n == 75, n
        # a full storage says where to go, and nothing is trimmed when saving works
        page.evaluate("""() => { const s0 = Storage.prototype.setItem;
          Storage.prototype.setItem = function (k, v) { if (k === 'ielts:data') throw new DOMException('full', 'QuotaExceededError'); return s0.call(this, k, v); };
          IE.prog.addTest({lid: 'u04-l3', skill: 'listening', got: 5, total: 10, band: 5});
          Storage.prototype.setItem = s0; }""")
        assert _toast(page) == FULL, _toast(page)
        assert page.evaluate("() => IE.prog.get().essays.length") == 75
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_core_fetch_gives_up_after_10s():
    page = _page("phone")
    held = []
    try:
        page.route("**/data/ielts/u05.json", lambda r: held.append(r))
        _seed(page, {})
        _open(page, "#/", reload=True)
        page.evaluate("() => { window.__r = null; IE.data.unit('u05').then(() => { window.__r = 'ok'; }, e => { window.__r = e.message; }); }")
        page.wait_for_timeout(300)
        assert page.evaluate("() => window.__r") is None and held
        page.clock.fast_forward(9000)
        page.wait_for_timeout(200)
        assert page.evaluate("() => window.__r") is None
        page.clock.fast_forward(1500)
        page.wait_for_function("() => window.__r !== null", timeout=5000)
        msg = page.evaluate("() => window.__r")
        assert "more than 10 seconds" in msg and "connection" in msg, msg
        # home is there all the same, with every other unit counted
        assert page.locator(".ie-hero").count() == 1
        assert "of" in page.inner_text('.ie-row[data-u="u04"] .ie-cnt') and page.inner_text('.ie-row[data-u="u05"] .ie-cnt').strip() == ""
    finally:
        for r in held:
            try:
                r.abort()
            except Exception:
                pass
        page.context.close()


# ---------------------------------------------------------------- 3. voices
def test_core_voices():
    page = _page("desk")
    try:
        _seed(page, {})
        _open(page, "#/", reload=True)
        say = """async o => { window.__said = []; const ok = await IE.speak('Hello there.', o); const s = window.__said[0] || {}; return [s.voice, +(+s.pitch).toFixed(3), ok]; }"""
        cases = [
            ({"voice": "f"}, "Google UK English Female", 1), ({"voice": "m"}, "Google UK English Male", 1),
            ({"voice": "f", "accent": "us"}, "Samantha", 1), ({"voice": "m", "accent": "us"}, "Alex", 1),
            ({"voice": "f", "accent": "au"}, "Karen", 1), ({"voice": "m", "accent": "au"}, "Lee", 1),
            ({"voice": "f", "accent": "ie"}, "Moira", 1), ({"voice": "m", "accent": "ie"}, "Google UK English Male", 1),   # no Irish man: British
            ({"voice": "f", "accent": "nz"}, "Google UK English Female", 1), ({"voice": "f", "accent": "xx"}, "Google UK English Female", 1),
            ({"voice": "f", "alt": 1}, "Serena", 1), ({"voice": "m", "alt": 1}, "Daniel", 1),
            ({"voice": "m", "alt": 2}, "Google UK English Male", 1), ({"voice": "f", "accent": "au", "alt": 1, "pitch": .9}, "Karen", .9),
            ({"voice": "f", "pitch": 1.3}, "Google UK English Female", 1.3), ({"voice": "m", "pitch": 5}, "Google UK English Male", 2),
            ({"voice": "m", "pitch": .1}, "Google UK English Male", .5),
        ]
        for o, name, pitch in cases:
            got = page.evaluate(say, o)
            assert got == [name, pitch, True], (o, got)
        # British only ignores the accent
        page.evaluate("() => IE.uiSet({accents: 'gb'})")
        assert page.evaluate(say, {"voice": "f", "accent": "us"})[0] == "Google UK English Female"
        assert page.evaluate(say, {"voice": "m", "accent": "au", "alt": 1})[0] == "Daniel"
        page.evaluate("() => IE.uiSet({accents: 'mixed'})")
        # an engine error stops the whole text at once; an interruption doesn't
        r = page.evaluate("""async () => { window.__said = []; window.__ttsErr = 'synthesis-failed';
          const ok = await IE.speak('One sentence. Two sentences. Three sentences.', {voice: 'f'}); const n = window.__said.length;
          window.__said = []; window.__ttsErr = 'interrupted';
          const ok2 = await IE.speak('One sentence. Two sentences. Three sentences.', {voice: 'f'}); const n2 = window.__said.length;
          window.__ttsErr = null; return [ok, n, ok2, n2]; }""")
        assert r == [False, 1, True, 3], r
        for err in ("synthesis-unavailable", "audio-busy", "audio-hardware", "network", "not-allowed"):
            assert page.evaluate("async e => { window.__ttsErr = e; const ok = await IE.speak('A. B.', {}); window.__ttsErr = null; return ok; }", err) is False, err
        # exam speed inside a timed test, the chosen speed elsewhere
        page.evaluate("() => IE.uiSet({rate: .85})")
        _open(page, "#/lesson/u03-l3")
        rate_test = page.evaluate("async () => { window.__said = []; await IE.speak('Test.', {voice: 'f'}); return window.__said[0].rate; }")
        _open(page, "#/lesson/u03-l1")
        rate_learn = page.evaluate("async () => { window.__said = []; await IE.speak('Learn.', {voice: 'f', slow: true}); return window.__said[0].rate; }")
        assert rate_test == 1 and abs(rate_learn - .68) < 1e-6, (rate_test, rate_learn)
        assert page.evaluate("() => IE.ensureVoices()") == 9
        # settings: the accents control and what this device can play
        _open(page, "#/settings")
        t = page.inner_text("#ie-voice")
        assert "Mixed, as in the exam" in t and "British only" in t and "Timed tests always play at exam speed." in t, t
        assert "This device can play British, American, Australian, Irish; others fall back to British." in t, t
        assert "British, Australian, New Zealand and North American" in t
        page.click('[data-acc="gb"]')
        assert page.evaluate("() => IE.ui().accents") == "gb" and page.get_attribute('[data-acc="gb"]', "aria-checked") == "true"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
    # one voice for everyone: the man and the woman differ by pitch, and the multiplier still applies
    page = _page("desk", voices=[["Daniel", "en-GB"]])
    try:
        _seed(page, {})
        _open(page, "#/", reload=True)
        r = page.evaluate("""async () => { const out = [];
          for (const o of [{voice: 'f'}, {voice: 'm'}, {voice: 'f', pitch: 1.5}, {voice: 'm', alt: 1}]) { window.__said = []; await IE.speak('Hi.', o); out.push([window.__said[0].voice, +window.__said[0].pitch.toFixed(3)]); }
          return out; }""")
        assert r == [["Daniel", 1.12], ["Daniel", .82], ["Daniel", 1.68], ["Daniel", .82]], r
    finally:
        page.context.close()


def test_core_no_english_voice():
    # no English voice: ensureVoices waits up to 2 s once, then answers at once; voiceschanged refreshes it
    page = _page("phone", voices=[["Google español", "es-ES"]])
    try:
        _seed(page, {})
        _open(page, "#/", reload=True)
        r = page.evaluate("""async () => { const t0 = performance.now(); const n = await IE.ensureVoices(); const t1 = performance.now();
          const n2 = await IE.ensureVoices(); const t2 = performance.now(); return [n, t1 - t0, n2, t2 - t1]; }""")
        assert r[0] == 0 and 1800 <= r[1] <= 3500 and r[2] == 0 and r[3] < 100, r
        _open(page, "#/settings")
        t = page.inner_text("#ie-voice")
        for s in ("No English voice on this device", "Android: Settings › Text-to-speech", "Windows: Settings › Time & language › Speech › Add voices",
                  "iPhone and iPad: Settings › Accessibility › Spoken Content › Voices"):
            assert s in t, (s, t)
        page.click("#ie-vt")
        page.wait_for_timeout(300)
        tt = _toast(page)
        assert "No English voice on this device" in tt and "Settings › Text-to-speech" in tt and "Spoken Content › Voices" in tt, tt
        assert page.evaluate("() => window.__said.length") == 0
        n = page.evaluate("""async () => { window.__voices = [{name: 'Google UK English Female', lang: 'en-GB', localService: true}];
          speechSynthesis.dispatchEvent(new Event('voiceschanged')); return await IE.ensureVoices(); }""")
        assert n == 1
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
    # no speechSynthesis at all
    page = C.new_page("phone")
    try:
        page.add_init_script(_IN)
        page.add_init_script("window.SpeechSynthesisUtterance = undefined;")
        _seed(page, {})
        _open(page, "#/settings", reload=True)
        assert page.evaluate("async () => [IE.canSpeak(), await IE.ensureVoices(), await IE.speak('x')]") == [False, 0, False]
        t = page.inner_text("#ie-voice")
        assert "can't read recordings aloud" in t and "No English voice on this device" in t, t
    finally:
        page.context.close()


# ---------------------------------------------------------------- 4. home
def test_core_home_paints_before_the_units():
    page = _page("phone")
    held = []
    try:
        _seed(page, {
            "ielts:run:u23-l2": {"v": 1, "i": 2, "ans": {"u23-l2-i2-q1": "T"}, "checked": {}, "heard": {}, "self": {}, "el": 26 * 60000, "started": True, "at": 1773219000000},
            "ielts:run:u05-l1": {"v": 1, "i": 3, "ans": {}, "checked": {}, "heard": {}, "self": {}, "el": 0, "started": True},
            "ielts:run:u06-l1": {"v": 1, "i": 0, "ans": {}, "checked": {}, "heard": {}, "self": {}, "el": 0, "started": True},
            "ielts:run:u07-l1": {"v": 1, "i": 4, "ans": {"x": 1}, "checked": {}, "heard": {}, "self": {}, "el": 0, "started": True, "finished": True},
        })
        page.route("**/data/ielts/u*.json", lambda r: held.append(r))
        page.goto(C.base_url(page) + "/ielts.html#/")
        page.wait_for_function("() => document.getElementById('app').dataset.ready === '#/'", timeout=5000)
        assert len(held) >= 20, len(held)   # painted while every unit request still hangs
        s = page.evaluate("""() => { const q = s => document.querySelector(s), cnt = u => q(`.ie-row[data-u="${u}"] .ie-cnt`).textContent.trim();
          const hero = q('.ie-hero'); hero.__mark = 1;
          hero.insertAdjacentHTML('afterend', '<div id="probe" class="card ie-card">Injected after the hero</div>');
          return {u01: cnt('u01'), u23: cnt('u23'), u05: cnt('u05'), u06: cnt('u06'), u07: cnt('u07'), wait: !!q('#ie-next.is-wait'), scores: !!q('.ie-scores'),
            cont: q('#ie-cont') && q('#ie-cont').getAttribute('href')}; }""")
        assert s == {"u01": "", "u23": "In progress", "u05": "In progress", "u06": "", "u07": "", "wait": True, "scores": True, "cont": "#/lesson/u23-l2"}, s
        page.wait_for_timeout(3000)
        for r in held:
            r.continue_()
        page.wait_for_function("() => /of \\d+ lessons/.test(document.querySelector('.ie-row[data-u=\"u24\"] .ie-cnt').textContent)", timeout=10000)
        page.wait_for_timeout(200)
        s = page.evaluate("""() => { const q = s => document.querySelector(s), cnt = u => q(`.ie-row[data-u="${u}"] .ie-cnt`).textContent.trim();
          return {probe: !!q('.ie-hero + #probe'), mark: q('.ie-hero').__mark, u01: cnt('u01'), u23: cnt('u23'), wait: !!q('#ie-next.is-wait'),
            next: q('#ie-next').textContent.replace(/\\s+/g, ' ').trim(), cont: q('#ie-cont').textContent.replace(/\\s+/g, ' ').trim(),
            order: [...q('.ie-page').children].slice(0, 4).map(e => e.id || e.className)}; }""")
        assert s["probe"] and s["mark"] == 1 and not s["wait"], s
        assert re.fullmatch(r"0 of \d lessons", s["u01"]) and re.fullmatch(r"0 of \d lessons · In progress", s["u23"]), s
        assert "Reading test" in s["cont"] and "34 min left" in s["cont"] and "Resume the test" in s["cont"], s["cont"]
        assert s["next"].startswith("Start here") and "Unit 1" in s["next"], s["next"]
        assert s["order"][0] == "ie-hero" and s["order"][1] == "probe" and s["order"][2] == "ie-cont" and s["order"][3] == "ie-next", s["order"]
        _open(page, "#/unit/u23")
        assert "In progress" in page.inner_text('[data-l="u23-l2"]') and "In progress" not in page.inner_text('[data-l="u23-l1"]')
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- 5. writing revision
def test_core_writing_revision():
    page = _page("phone")
    try:
        e1 = _essay1()
        _seed(page, {"ielts:data": {"v": 1, "lessons": {}, "tests": [], "essays": [e1], "speaking": []}})
        _open(page, "#/essays/u13-l2-i2-seed", reload=True)
        t = page.inner_text("#app")
        assert page.locator(".ie-checks li").count() >= 5 and page.locator(".ie-model").count() == 1, t[:400]
        assert "Contractions" in t and "Memorised-sounding phrases" in t and "Band 9 model" in t
        assert page.inner_text("#ie-rv2").strip() == "Write version 2" and page.inner_text("#ie-rvm").strip() == "Rewrite from memory"
        assert page.get_attribute("#ie-rvm", "href") == "#/essays/u13-l2-i2-seed/revise?blank=1"
        # version 2: prefilled, autosaved as you type, resumed after a reload
        page.click("#ie-rv2")
        page.wait_for_function("() => document.getElementById('app').dataset.ready === '#/essays/u13-l2-i2-seed/revise'")
        assert page.input_value("#ie-ta") == ESSAY1 and page.locator(".ie-model").count() == 1 and page.locator("#ie-rv-done").count() == 1
        assert page.locator("button", has_text=re.compile("^Save")).count() == 0
        page.fill("#ie-ta", ESSAY2)
        page.wait_for_timeout(700)
        dr = page.evaluate("() => JSON.parse(localStorage.getItem('ielts:draft:u13-l2-i2-seed'))")
        assert dr["text"] == ESSAY2 and dr["blank"] is False, dr
        _open(page, "#/essays/u13-l2-i2-seed/revise", reload=True)
        assert page.input_value("#ie-ta") == ESSAY2 and "continuing your draft" in page.inner_text("#app")
        page.click("#ie-rv-done")
        page.wait_for_function("() => document.getElementById('app').dataset.ready === '#/essays/u13-l2-i2-seed-v2/compare'")
        page.wait_for_timeout(200)
        c = page.inner_text("#app")
        assert page.locator(".ie-cmp > section").count() == 2 and "Version 1" in c and "Version 2" in c, c[:500]
        assert re.search(r"Words: \d+ → \d+ \(\+\d+\)", c) and "Flags fixed: 3 (Length, Memorised phrases, Contractions)" in c, c[:800]
        assert "New flags: Sentences" in c and "Still to fix" not in c, c[:800]   # a sentence over 40 words is not the length check
        assert page.locator(".ie-model").count() == 1 and page.locator("#ie-rv-self").count() == 0
        es = page.evaluate("() => IE.prog.get().essays")
        v2 = [e for e in es if e["id"] == "u13-l2-i2-seed-v2"][0]
        assert v2["parent"] == "u13-l2-i2-seed" and v2["v"] == 2 and v2["iid"] == "u13-l2-i2" and v2["text"] == ESSAY2 and v2["words"] >= 250 and v2["task"] == 2, v2
        assert page.evaluate("() => localStorage.getItem('ielts:draft:u13-l2-i2-seed')") is None
        _open(page, "#/essays/u13-l2-i2-seed")
        # rewrite from memory: empty, model hidden; self-marking through IE.assess when it exists
        page.evaluate("""() => { IE.assess = {
          selfHtml: (kind, cur, item) => `<div data-self="${kind}" class="stub-self"><button type="button" id="stub-b" data-item="${item ? item.id : ''}">Band 7</button></div>`,
          wireSelf: (el, kind, get, set) => { el.querySelector('#stub-b').onclick = () => set({0: 7, 1: 7, 2: 7, 3: 7}, 7); } }; }""")
        assert page.get_attribute("#ie-rvm", "href") == "#/essays/u13-l2-i2-seed-v2/revise?blank=1" and page.inner_text("#ie-rv2").strip() == "Write version 3"
        page.click("#ie-rvm")
        page.wait_for_function("() => document.getElementById('app').dataset.ready === '#/essays/u13-l2-i2-seed-v2/revise?blank=1'")
        assert page.input_value("#ie-ta") == "" and page.locator(".ie-model").count() == 0 and "From memory" in page.inner_text("#app")
        assert ESSAY2[:40] not in page.inner_text("#app")
        page.fill("#ie-ta", ESSAY2.replace("Cities now replace", "Today, cities replace"))
        page.wait_for_timeout(500)
        assert page.evaluate("() => JSON.parse(localStorage.getItem('ielts:draft:u13-l2-i2-seed-v2')).blank") is True
        page.click("#ie-rv-done")
        page.wait_for_function("() => document.getElementById('app').dataset.ready === '#/essays/u13-l2-i2-seed-v3/compare'")
        assert page.get_attribute("#ie-rv-self .stub-self button", "data-item") == "u13-l2-i2"
        page.click("#stub-b")
        v3 = page.evaluate("() => IE.prog.essay('u13-l2-i2-seed-v3')")
        assert v3["parent"] == "u13-l2-i2-seed" and v3["v"] == 3 and v3["band"] == 7 and v3["self"] == {"0": 7, "1": 7, "2": 7, "3": 7}, v3
        # three versions at most; My writing groups them under the original
        _open(page, "#/essays/u13-l2-i2-seed-v3")
        assert page.locator("#ie-rv2").count() == 0 and "three versions" in page.inner_text(".ie-improve")
        assert page.locator(".ie-vnav .ie-vpill").count() == 3
        _open(page, "#/essays/u13-l2-i2-seed/revise")
        assert "Three versions already" in page.inner_text("#app") and page.locator("#ie-ta").count() == 0
        _open(page, "#/essays")
        assert page.locator(".ie-row").count() == 3 and page.locator(".ie-vrow").count() == 2
        assert re.sub(r"\s+", " ", page.inner_text(".ie-chain")) == "v1 6 → v2 – → v3 7", page.inner_text(".ie-chain")
        assert [x.strip() for x in page.locator(".ie-vrow .ie-row-t").all_inner_texts()][0].startswith("Version 2")
        # the writing band comes from first versions only
        assert page.evaluate("() => IE.prog.latest().writing") == 6
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- 6. backup
def test_core_backup_round_trip():
    page = _page("desk")
    try:
        data = {"v": 1, "lessons": {"u01-l1": {"done": True, "at": 100, "got": 3, "total": 4, "band": None}, "u01-l2": {"done": True, "at": 100}},
                "tests": [{"lid": "u03-l3", "title": "Test: a full Part 1 · Unit 3", "skill": "listening", "got": 7, "total": 10, "band": 7, "at": 1000, "attempt": 1, "counted": True}],
                "essays": [_essay1(at=2000)], "speaking": [{"title": "Part 1 · Unit 16", "band": 7, "at": 3000}]}
        _seed(page, {"ielts:data": data, "ielts:ui": {"rate": 1, "accents": "gb", "at": 100}, "ielts:study": {"at": 100, "box": {"a": 1}},
                     "ielts:draft:u13-l2-i2-seed": {"text": "draft", "blank": False, "at": 5}, "ielts:run:u03-l1": {"v": 1, "i": 2, "ans": {}, "started": True}})
        _open(page, "#/settings", reload=True)
        with page.expect_download() as dl:
            page.click("#ie-dl")
        d = dl.value
        assert d.suggested_filename == "ielts-prep-2026-03-11.json", d.suggested_filename
        f = json.loads(open(d.path(), encoding="utf-8").read())
        assert f["app"] == "ielts-prep" and sorted(f["keys"]) == ["ielts:data", "ielts:draft:u13-l2-i2-seed", "ielts:study", "ielts:ui"], sorted(f["keys"])
        assert f["keys"]["ielts:data"] == data
        # another device: some of the same, some new; a newer study copy here, an older ui copy here
        page.evaluate("""() => { IE.prog.erase();
          localStorage.setItem('ielts:data', JSON.stringify({v: 1, lessons: {'u01-l1': {done: true, at: 50, got: 1, total: 4}, 'u02-l1': {done: true, at: 70}},
            tests: [{lid: 'u03-l3', title: 'Test: a full Part 1 · Unit 3', skill: 'listening', got: 9, total: 10, band: 8, at: 500, attempt: 1, counted: true}],
            essays: [], speaking: [{title: 'Part 1 · Unit 16', band: 7, at: 3000}]}));
          localStorage.setItem('ielts:study', JSON.stringify({at: 200, box: {b: 2}}));
          localStorage.setItem('ielts:ui', JSON.stringify({rate: 1.1, at: 50})); }""")
        buf = json.dumps(f).encode()
        page.set_input_files("#ie-restore", files=[{"name": "ielts-prep-2026-03-11.json", "mimeType": "application/json", "buffer": buf}])
        page.wait_for_timeout(300)
        msg = _toast(page)
        assert msg.startswith("Restored: ") and "1 test result" in msg and "1 piece of writing" in msg, msg
        r = page.evaluate("() => ({d: IE.prog.get(), study: JSON.parse(localStorage.getItem('ielts:study')), ui: JSON.parse(localStorage.getItem('ielts:ui')), keys: Object.keys(localStorage).sort()})")
        d2 = r["d"]
        assert d2["lessons"]["u01-l1"]["at"] == 100 and d2["lessons"]["u02-l1"]["at"] == 70 and "u01-l2" in d2["lessons"], d2["lessons"]
        assert [(t["at"], t["attempt"], t["counted"]) for t in d2["tests"]] == [(500, 1, True), (1000, 2, False)], d2["tests"]
        assert [e["id"] for e in d2["essays"]] == ["u13-l2-i2-seed"] and len(d2["speaking"]) == 1, d2
        assert r["study"] == {"at": 200, "box": {"b": 2}} and r["ui"]["rate"] == 1 and r["ui"]["accents"] == "gb", r
        assert "ielts:draft:u13-l2-i2-seed" in r["keys"] and not [k for k in r["keys"] if k.startswith("ielts:run:")], r["keys"]
        # the same file again adds nothing
        page.set_input_files("#ie-restore", files=[{"name": "again.json", "mimeType": "application/json", "buffer": buf}])
        page.wait_for_timeout(300)
        assert _toast(page) == "Nothing new in that file: it was all here already."
        assert page.evaluate("() => IE.prog.get()") == d2
        # not a backup
        page.set_input_files("#ie-restore", files=[{"name": "x.json", "mimeType": "application/json", "buffer": b"[1, 2]"}])
        page.wait_for_timeout(300)
        assert _toast(page) == "That file isn't an IELTS Prep backup."
        t = page.inner_text("#app")
        assert "A copy in Google Drive will come later." in t
        assert "Recordings stay on this device. Live transcript uses your browser's speech service, which may send your voice to its provider (Google in Chrome)." in t
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- 7. look and targets
def _rgb(s):
    m = re.findall(r"[\d.]+", s)
    return [float(x) for x in m[:3]] + [float(m[3]) if len(m) > 3 else 1.0]


def _lum(c):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
    return .2126 * ch(c[0]) + .7152 * ch(c[1]) + .0722 * ch(c[2])


def _over(top, bot):
    a = top[3]
    return [top[i] * a + bot[i] * (1 - a) for i in range(3)] + [1.0]


def _ratio(a, b):
    x, y = _lum(a), _lum(b)
    return (max(x, y) + .05) / (min(x, y) + .05)


def test_core_segments_targets_and_top_bar():
    page = _page("phone", color_scheme="dark", viewport={"width": 360, "height": 740})
    try:
        _seed(page, {})
        _open(page, "#/settings", reload=True)
        s = page.evaluate("""() => { const g = getComputedStyle, seg = document.querySelector('[aria-label="Speed"]');
          const on = seg.querySelector('[aria-checked=true]'), off = seg.querySelector('[aria-checked=false]');
          return {on: g(on).backgroundColor, onc: g(on).color, onw: g(on).fontWeight, off: g(off).backgroundColor, seg: g(seg).backgroundColor,
            card: g(seg.closest('.card')).backgroundColor, h: [...document.querySelectorAll('.ie-seg>button')].map(b => b.getBoundingClientRect().height)}; }""")
        assert _rgb(s["on"])[:3] == [30, 110, 244] and _rgb(s["onc"])[:3] == [255, 255, 255] and s["onw"] == "700", s
        under = _over(_rgb(s["seg"]), _rgb(s["card"]))
        # the chosen segment against the others: about 1.2:1 before (#3A3A3C on dark grey), now white bold text on blue
        assert _ratio(_rgb(s["on"]), under) >= 2.5 and _ratio(_rgb(s["on"]), [255, 255, 255, 1]) >= 4.5, (s, _ratio(_rgb(s["on"]), under))
        assert min(s["h"]) >= 44, s["h"]
        small = page.evaluate("""() => [...document.querySelectorAll('#app button, #app a, #app label.glass-btn, #ie-top a')].filter(e => e.offsetParent)
          .map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 30) || e.getAttribute('aria-label'), r.width, r.height]; }).filter(x => x[1] < 44 || x[2] < 44)""")
        assert not small, small
        # gaps in a lesson are 44 px tall
        _open(page, "#/lesson/u03-l2")
        hs = page.evaluate("() => [...document.querySelectorAll('.ie-in')].map(i => i.getBoundingClientRect().height)")
        assert hs and min(hs) >= 44, hs
        # the short back label under 400 px
        top = page.evaluate("""() => { const b = document.querySelector('.ie-back'); return {aria: b.getAttribute('aria-label'), text: b.innerText.trim(),
          right: b.getBoundingClientRect().right, title: document.querySelector('.ie-top-t').getBoundingClientRect().left}; }""")
        assert top["aria"] == "Back to Unit 3" and top["text"] == "U3" and top["right"] <= top["title"], top
        _open(page, "#/lesson/u17-l1")
        assert page.evaluate("() => [document.querySelector('.ie-back').getAttribute('aria-label'), document.querySelector('.ie-back').innerText.trim()]") == ["Back to Unit 17", "U17"]
        page.set_viewport_size({"width": 1280, "height": 800})
        page.wait_for_timeout(100)
        assert page.evaluate("() => document.querySelector('.ie-back').innerText.trim()") == "Unit 17"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


_US = re.compile(r"\b(colors?|colored|favorite\w*|center(s|ed)?|organiz\w*|realiz\w*|recogniz\w*|analyz\w*|behavior\w*|gray|catalog|labeled|canceled|modeled)\b", re.I)


def test_core_screens():
    e1 = _essay1(at=1773000000000)
    v2 = dict(e1, id="u13-l2-i2-seed-v2", parent="u13-l2-i2-seed", v=2, text=ESSAY2, words=len(ESSAY2.split()), band=7, at=1773100000000)
    t1 = _prompt("u11-l2-i2")
    task1 = {"id": "u11-l2-i2-x", "iid": "u11-l2-i2", "task": 1, "prompt": t1["prompt"], "text": "\n\n".join(t1["model"]["text"]).replace("**", "").replace("*", ""),
             "words": 180, "self": None, "band": None, "at": 1773150000000}
    keys = {"ielts:data": {"v": 1, "lessons": {"u01-l1": {"done": True, "at": 1}, "u01-l2": {"done": True, "at": 2}},
                           "tests": [{"lid": "u23-l1", "title": "Listening test · Unit 23", "skill": "listening", "got": 33, "total": 40, "band": 7.5, "at": 1772900000000, "attempt": 1, "counted": True},
                                     {"lid": "u03-l3", "title": "Test: a full Part 1 · Unit 3", "skill": "listening", "got": 8, "total": 10, "band": 7.5, "at": 1772950000000, "attempt": 1, "counted": True},
                                     {"lid": "u03-l3", "title": "Test: a full Part 1 · Unit 3", "skill": "listening", "got": 10, "total": 10, "band": 9, "at": 1772960000000, "attempt": 2, "counted": False},
                                     {"lid": "u07-l3", "title": "Test: a full passage · Unit 7", "skill": "reading", "got": 11, "total": 13, "band": 8, "at": 1773000000000, "attempt": 1, "counted": True}],
                           "essays": [e1, v2, task1], "speaking": []},
            "ielts:run:u23-l2": {"v": 1, "i": 1, "ans": {"q": "T"}, "checked": {}, "heard": {}, "self": {}, "el": 1560000, "started": True},
            "ielts:draft:u13-l2-i2-seed-v2": {"text": ESSAY2, "blank": False, "at": 1773200000000}}
    pages = [("home", "#/"), ("settings", "#/settings"), ("progress", "#/progress"), ("essays", "#/essays"),
             ("essay", "#/essays/u13-l2-i2-seed-v2"), ("revise", "#/essays/u13-l2-i2-seed-v2/revise"), ("compare", "#/essays/u13-l2-i2-seed-v2/compare"),
             ("revise-t1", "#/essays/u11-l2-i2-x/revise?blank=1")]
    bad = []
    for kind, w, h in (("phone", 360, 740), ("desk", 1280, 800)):
        for scheme in ("light", "dark"):
            page = _page(kind, color_scheme=scheme, viewport={"width": w, "height": h})
            try:
                _seed(page, keys)
                for i, (name, hs) in enumerate(pages):
                    _open(page, hs, reload=i == 0)
                    if name == "home":
                        page.wait_for_function("() => !document.querySelector('#ie-next.is-wait')", timeout=10000)
                    page.wait_for_timeout(250)
                    sw = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                    if sw > 1:
                        bad.append(f"{w} {scheme} {name}: horizontal scroll {sw}px")
                    over = page.evaluate("""() => [...document.querySelectorAll('#app *')].filter(e => e.offsetParent && e.getBoundingClientRect().right > innerWidth + 1
                      && !e.closest('.ie-tw, .ie-viz')).slice(0, 3).map(e => e.className || e.tagName)""")
                    if over:
                        bad.append(f"{w} {scheme} {name}: wider than the screen {over}")
                    a = page.evaluate(AUDIT, {"what": ["palette", "contrast"]})
                    if a["palette"]:
                        bad.append(f"{w} {scheme} {name}: palette {a['palette'][:3]}")
                    mine = [x for x in a["contrast"] if re.search(r"ie-(tile|ov-part|cont|tag|del|chain|vrow|vnum|vpill|ctab|vnone|help|link|left|seg|back|skel|next)", x)]
                    if mine:
                        bad.append(f"{w} {scheme} {name}: contrast {mine[:3]}")
                    us = _US.findall(page.inner_text("body"))
                    if us:
                        bad.append(f"{w} {scheme} {name}: US spelling {us[:5]}")
                    C.shot(page, f"{w}-{scheme}-{name}", SHOTS)
                if [k for k in page.evaluate("Object.keys(localStorage)") if not k.startswith("ielts:")]:
                    bad.append(f"{w} {scheme}: keys outside ielts:*")
                if C.errors(page):
                    bad.append(f"{w} {scheme}: {C.errors(page)[:3]}")
            finally:
                page.context.close()
    assert not bad, "\n".join(bad)
