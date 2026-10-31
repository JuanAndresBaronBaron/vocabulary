"""IELTS Prep, the integration of the five packages (content1, content2, core, player, study).

- Saved answers: the one migration in js/ielts.js (flags ielts:mig:content1 and ielts:mig:content2) maps the option
  indexes saved by the old orders in lesson runs and in a review session, once: a right answer stays right and a wrong
  one wrong; a run saved by this version (run.at) is left alone; the u09-l3 questions that left the course clear a
  finished run; u24-l2 q8/q9 become the Choose TWO q11; u23-l3's replaced Task 1 is kept in My writing with its old
  prompt (and its page says the task was replaced, with no chart); u23-l4 keeps its item; cards of questions that left
  the course leave the deck. A reload maps nothing again and «Erase my progress» keeps the flags.
- Writing compare: «N words copied from the question» is its own check («Copied from the question»).
- Offline: with the service worker in control, IELTS Prep saves every unit file in vocab-media in the background, so a
  unit never opened works without a connection, with no console errors.
- Google Drive (js/ielts-boot.js, with a fake Drive): its own file vocabulary-ieltsprep.json with only ielts:data,
  ielts:study and ielts:ui; two devices end up with the same merge, newer record wins, a deleted result never comes back,
  an erase made in IELTS Prep travels, a newer or foreign copy is never merged or overwritten, an empty state is never
  uploaded over a full one, and nothing happens with IELTS Prep off or Google not connected.
- The review deck with content1's real data: the card of the u04-l2 plan question carries the plan, and the player
  draws it in #/lesson/review.
"""
from __future__ import annotations

import json
import re

import common as C
import ielts_validate as V
import tech_common as TC

H = 3600_000
NOW = TC.NOW_MS
FILE = "vocabulary-ieltsprep.json"
KID_FILE = "vocabulary-progress.json"
_U = {}


def _unit(n):
    if n not in _U:
        _U[n] = json.loads((V.DATA / f"u{n:02d}.json").read_text(encoding="utf-8"))
    return _U[n]


def _walk(o):
    if isinstance(o, dict):
        yield o
        for v in o.values():
            yield from _walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from _walk(v)


def _q(qid):
    hits = [o for o in _walk(_unit(int(qid[1:3]))) if o.get("id") == qid]
    assert len(hits) == 1, (qid, len(hits))
    return hits[0]


def _mark(q, a):
    """IE.player.mark, for pick and multi"""
    if q["type"] == "pick":
        return 1 if a == q["answer"] else 0
    if q["type"] == "multi":
        if not isinstance(a, list):
            return 0
        return min(len(q["answer"]), len([x for x in a if x in q["answer"]])) - max(0, len(a) - len(q["answer"]))
    raise AssertionError(q["type"])


def _seed(page, keys, session=True):
    page.goto(C.base_url(page) + "/__blank")
    page.evaluate("""([ks, ss]) => { localStorage.clear(); sessionStorage.clear();
      localStorage.setItem('ielts:on', 'true'); if (ss) sessionStorage.setItem('ielts:in', '1');
      for (const [k, v] of Object.entries(ks)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }""", [keys, session])


def _open(page, hash="#/"):
    page.goto(C.base_url(page) + "/ielts.html" + hash)
    page.wait_for_function("h => { const a = document.getElementById('app'); return a && a.dataset.ready === h; }", arg=hash, timeout=15000)
    page.wait_for_timeout(200)


def _ls(page, k):
    v = page.evaluate("k => localStorage.getItem(k)", k)
    return None if v is None else json.loads(v)


# ---------------------------------------------------------------- 1. saved answers follow the new options, once
# the old option orders: MAP (content1) and MAP2 (content2) in js/ielts.js give, for each old index, the new one
M1 = {"u01-l3-i8": [1, 0, 2, 3], "u05-l1-i8-q1": [1, 0, 2, 4, 3], "u02-l1-i3-q1": [1, 0, 2]}
M2 = {"u15-l2-i4": "x0xx", "u23-l1-i4-q5": "10243", "u20-l1-i4": "2xxx"}


def _old(m, new):
    """the old index of the option now at new"""
    m = [None if c == "x" else int(c) for c in m] if isinstance(m, str) else m
    return m.index(new)


def test_ielts_integration_saved_answers():
    page = C.new_page("phone")
    page.on("dialog", lambda d: d.accept())
    try:
        js = (C.REPO / "js" / "ielts.js").read_text(encoding="utf-8")
        for qid, m in M1.items():
            assert f'"{qid}": {json.dumps(m)}' in js, f"{qid} is not in MAP as the test expects"
        for qid, m in M2.items():
            assert f'"{qid}": "{m}"' in js, f"{qid} is not in MAP2 as the test expects"
        q8, q5, q15, q11 = _q("u01-l3-i8"), _q("u05-l1-i8-q1"), _q("u15-l2-i4"), _q("u24-l2-i4-q11")
        q23 = _q("u23-l1-i4-q5")
        right8 = _old(M1["u01-l3-i8"], q8["answer"])
        wrong8 = next(i for i in range(4) if M1["u01-l3-i8"][i] != q8["answer"])
        multi5 = sorted(_old(M1["u05-l1-i8-q1"], x) for x in q5["answer"])
        multi23 = sorted(_old(M2["u23-l1-i4-q5"], x) for x in q23["answer"])
        right15 = _old(M2["u15-l2-i4"], q15["answer"])
        gone20 = next(i for i, c in enumerate(M2["u20-l1-i4"]) if c == "x")
        assert q11["answer"] == [1, 4], q11["answer"]
        w1 = _q("u23-l3-i2")
        assert "Westhaven" not in w1["prompt"], "u23-l3-i2 is still the old task"
        essay = "Commuting in Westhaven changed a great deal over the period. " * 12
        keys = {
            "ielts:run:u01-l3": {"i": 3, "ans": {"u01-l3-i8": right8, "u01-l3-i10": 1}, "checked": {}},
            "ielts:run:u05-l1": {"i": 2, "ans": {"u05-l1-i8-q1": multi5}},
            "ielts:run:u15-l2": {"i": 1, "ans": {"u15-l2-i4": right15}},
            "ielts:run:u20-l1": {"i": 1, "ans": {"u20-l1-i4": gone20}},
            "ielts:run:u23-l1": {"i": 2, "ans": {"u23-l1-i4-q5": multi23}, "started": True},
            # saved by this version (it has at): never touched
            "ielts:run:u02-l1": {"i": 1, "at": NOW - H, "ans": {"u02-l1-i3-q1": 0}},
            "ielts:run:u09-l3": {"i": 9, "finished": True, "ans": {"u09-l3-i1-q6": 1, "u09-l3-i1-q1": 0}},
            "ielts:run:u24-l2": {"i": 3, "ans": {"u24-l2-i4-q8": 0, "u24-l2-i4-q9": 1, "u24-l2-i4-q2": "Y"}},
            "ielts:run:u23-l3": {"i": 1, "ans": {"u23-l3-i2": essay}, "self": {"u23-l3-i2": {"ta": 7}}},
            "ielts:run:u23-l4": {"i": 1, "ans": {}},
            "ielts:study": {"v": 1, "cards": {"u24-l2-i4-q8": {"b": 1, "last": NOW - H}, "u01-l3-i8": {"b": 2, "last": NOW - H}},
                            "log": [], "session": {"at": NOW - 600_000, "ids": ["u24-l2-i4-q9", "u01-l3-i8", "u15-l2-i4"],
                                                   "ord": {"u01-l3-i8": [3, 2, 1, 0], "u15-l2-i4": [0, 1, 2, 3]}},
                            "exam": None, "calib": [], "at": NOW - H},
            "ielts:run:review": {"i": 0, "ans": {"u01-l3-i8": 2, "u15-l2-i4": 1}},
        }
        _seed(page, keys)
        _open(page)
        flags = page.evaluate("() => [localStorage.getItem('ielts:mig:content1'), localStorage.getItem('ielts:mig:content2')]")
        assert all(flags), flags
        r = {k: _ls(page, k) for k in keys}
        a8 = r["ielts:run:u01-l3"]["ans"]["u01-l3-i8"]
        assert a8 == q8["answer"] and _mark(q8, a8) == 1, a8
        assert _mark(q5, r["ielts:run:u05-l1"]["ans"]["u05-l1-i8-q1"]) == 2, r["ielts:run:u05-l1"]
        assert _mark(q23, r["ielts:run:u23-l1"]["ans"]["u23-l1-i4-q5"]) == 2, r["ielts:run:u23-l1"]
        assert r["ielts:run:u15-l2"]["ans"]["u15-l2-i4"] == q15["answer"], r["ielts:run:u15-l2"]
        # an option that is gone was a wrong one: the answer goes and stays wrong
        assert "u20-l1-i4" not in r["ielts:run:u20-l1"]["ans"], r["ielts:run:u20-l1"]
        assert r["ielts:run:u02-l1"] == keys["ielts:run:u02-l1"], "a run saved by this version was mapped"
        assert r["ielts:run:u09-l3"] is None, "a finished u09-l3 run with removed questions was kept"
        a24 = r["ielts:run:u24-l2"]["ans"]
        assert a24 == {"u24-l2-i4-q11": [1, 3]} and _mark(q11, a24["u24-l2-i4-q11"]) == 1, a24
        es = page.evaluate("() => IE.prog.get().essays")
        assert len(es) == 1 and es[0]["iid"] == "u23-l3-i2" and "Westhaven" in es[0]["prompt"] and es[0]["text"] == essay, es
        assert es[0]["task"] == 1 and es[0]["self"] == {"ta": 7}, es[0]
        assert "u23-l3-i2" not in r["ielts:run:u23-l3"]["ans"] and "u23-l3-i2" not in (r["ielts:run:u23-l3"].get("self") or {}), r["ielts:run:u23-l3"]
        assert r["ielts:run:u23-l4"]["i"] == 2, r["ielts:run:u23-l4"]
        st = r["ielts:study"]
        assert "u24-l2-i4-q8" not in st["cards"] and "u01-l3-i8" in st["cards"], st["cards"]
        assert "u24-l2-i4-q9" not in st["session"]["ids"], st["session"]
        assert st["session"]["ord"].get("u01-l3-i8") == [M1["u01-l3-i8"][i] for i in [3, 2, 1, 0]], st["session"]
        assert "u15-l2-i4" not in st["session"]["ord"], st["session"]
        # in the review run an answer is a place on screen: kept with its shuffle, dropped with it
        assert r["ielts:run:review"]["ans"] == {"u01-l3-i8": 2}, r["ielts:run:review"]

        # never twice: a reload maps nothing again
        before = {k: page.evaluate("k => localStorage.getItem(k)", k) for k in keys}
        _open(page, "#/unit/u01")
        page.reload()
        page.wait_for_function("() => document.getElementById('app').dataset.ready === '#/unit/u01'", timeout=15000)
        after = {k: page.evaluate("k => localStorage.getItem(k)", k) for k in keys}
        assert after == before, [k for k in keys if after[k] != before[k]]

        # the replaced task: its own prompt, no chart of the new one, and a note
        _open(page, f"#/essays/{es[0]['id']}")
        t = page.inner_text("#app")
        assert "Westhaven" in t and "This task has since been replaced in the course" in t, t[:400]
        assert page.locator("#app .ie-viz").count() == 0, "the new chart is shown for the old task"

        # «Erase my progress» keeps the flags: runs saved after it already use the new order
        assert page.evaluate("() => IE.prog.erase()") is True
        assert page.evaluate("() => [localStorage.getItem('ielts:mig:content1'), localStorage.getItem('ielts:mig:content2')]") == flags
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- 2. writing compare: words copied from the question
def test_ielts_integration_compare_copied():
    page = C.new_page("phone")
    try:
        it = _q("u13-l2-i2")
        prompt = it["prompt"]
        copied = prompt.split("\n")[0] + " " + prompt.split("\n")[0] + " I agree. " * 20
        own = ("New buildings should be planned carefully, but a law that fixes their life at a century would be a blunt tool. "
               "Cities change, and the needs of their people change with them. ") * 8
        wds = lambda s: len(s.split())
        e1 = {"id": "c1", "iid": "u13-l2-i2", "task": 2, "prompt": prompt, "text": copied, "words": wds(copied), "at": NOW - 2 * H, "band": None}
        e2 = {"id": "c2", "iid": "u13-l2-i2", "task": 2, "prompt": prompt, "text": "\n\n".join([own] * 4), "words": wds(own) * 4,
              "at": NOW - H, "band": None, "parent": "c1", "v": 2}
        _seed(page, {"ielts:data": {"v": 1, "lessons": {}, "tests": [], "essays": [e1, e2], "speaking": []}})
        _open(page, "#/essays/c1")
        msgs = page.evaluate("([t, p]) => IE.player.writingChecks(t, {task: 2, minWords: 250, prompt: p}).map(c => c.t)", [copied, prompt])
        assert any(re.match(r"^\d+ words? copied from the question", m) for m in msgs), msgs
        _open(page, "#/essays/c2/compare")
        t = page.inner_text("#app")
        assert re.search(r"Flags fixed: \d+ \([^)]*Copied from the question", t), t[:800]
        assert "copied from the question are not counted" not in page.inner_text(".ie-changes"), "the raw message is used as a check name"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- 3. every unit, offline
class _Switch(C._Quiet):
    """the usual server; with ST["down"] it closes the connection without answering (no network, for the service worker too)"""
    ST = {}

    def do_GET(self):
        if self.ST.get("down"):
            self.close_connection = True
            return
        super().do_GET()


_MEDIA = "async () => (await (await caches.open('vocab-media')).keys()).map(r => new URL(r.url).pathname).filter(p => /^\\/data\\/ielts\\/u\\d\\d\\.json$/.test(p)).sort()"


def test_ielts_integration_units_offline():
    st = {}
    srv = C.Server(C.ROOT, "localhost", handler=type("H", (_Switch,), {"ST": st}))
    ctx = C.new_context("phone", sw=True, server=srv)
    page = ctx.new_page()
    try:
        # as a learner gets there: the app first (it registers the service worker), then IELTS Prep through its menu
        C.seed(page, {**C.seed_keys(), "ielts:on": "true"})
        page.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=30000)
        page.evaluate("() => sessionStorage.setItem('ielts:in', '1')")
        _open(page, "#/unit/u01")
        n = len(json.loads((V.DATA / "index.json").read_text(encoding="utf-8"))["units"])
        # (wait_for_function would take the promise of an async function as already true: poll from here)
        got = []
        for _ in range(120):
            got = page.evaluate(_MEDIA)
            if len(got) >= n:
                break
            page.wait_for_timeout(500)
        assert got == [f"/data/ielts/u{i:02d}.json" for i in range(1, n + 1)], got
        assert page.evaluate("() => IE.warmUnits()") == {"saved": 0, "have": n}
        assert not C.errors(page), C.errors(page)

        st["down"] = True
        ctx.set_offline(True)
        assert page.evaluate("() => IE.warmUnits()")["skipped"] == "offline"
        page.reload()
        page.wait_for_function("() => document.getElementById('app').dataset.ready === '#/unit/u01'", timeout=15000)
        les = next(x for x in _unit(22)["lessons"] if x["id"] == "u22-l2")
        for h, want in [("#/unit/u17", _unit(17)["title"]), ("#/lesson/u22-l2", les["title"]), ("#/unit/u24", _unit(24)["title"])]:
            _open(page, h)
            t = page.inner_text("body")
            assert "Couldn't load" not in t and "Check the connection" not in t, (h, t[:300])
            assert want in t, (h, want, t[:300])
        assert not C.errors(page), C.errors(page)
    finally:
        try:
            ctx.set_offline(False)
        except Exception:  # noqa: BLE001
            pass
        ctx.close()
        srv.stop()


# ---------------------------------------------------------------- 4. the Google Drive copy
def _gk(extra=None, on=True):
    k = TC.google_keys(base=C.seed_keys())
    if on:
        k["ielts:on"] = "true"
    for a, b in (extra or {}).items():
        k[a] = b if isinstance(b, str) else json.dumps(b)
    return k


def _sync(page, after=0, timeout=15000):
    page.wait_for_function("t => (JSON.parse(localStorage.getItem('ielts:sync') || '{}').lastSync || 0) > t", arg=after, timeout=timeout)
    page.wait_for_timeout(150)
    return _ls(page, "ielts:sync")


def _home(page, keys):
    """index.html (the child's app) with these keys: the IELTS Prep copy runs there, about 4 s after it opens"""
    C.seed(page, keys)
    page.evaluate("() => sessionStorage.setItem('ielts:in', '1')")


def _data(lessons=None, tests=None, essays=None, **kw):
    return dict({"v": 1, "lessons": lessons or {}, "tests": tests or [], "essays": essays or [], "speaking": []}, **kw)


def _t(lid, at, **kw):
    return dict({"lid": lid, "skill": "listening", "got": 30, "total": 40, "band": 7, "at": at}, **kw)


def test_ielts_integration_drive_two_devices():
    pa = C.new_page("phone")
    pa.on("dialog", lambda d: d.accept())
    drive = TC.FakeDrive(pa)
    others = []
    try:
        # A: an erase from before Google was connected (only this device's history), then its own work
        da = _data({"u01-l1": {"done": True, "got": 3, "total": 4, "at": NOW - 5 * H}},
                   [_t("u03-l3", NOW - 4 * H, attempt=1, counted=True)],
                   [{"id": "ea", "iid": "u13-l2-i2", "task": 2, "prompt": "P", "text": "t", "words": 1, "at": NOW - 3 * H}],
                   erased=NOW - 6 * H)
        sa = {"v": 1, "cards": {"u01-l3-i8": {"b": 1, "last": NOW - 3 * H}}, "log": [{"q": "u01-l3-i8", "at": NOW - 3 * H}],
              "session": {"at": NOW - 600_000, "ids": ["u01-l3-i8"], "ord": {}}, "exam": None, "calib": [], "mig": 1, "at": NOW - 3 * H}
        _home(pa, _gk({"ielts:data": da, "ielts:study": sa, "ielts:ui": {"rate": 1, "at": NOW - 2 * H},
                       "ielts:run:u02-l1": {"i": 1, "ans": {}}, "ielts:draft:ea": "draft", "ielts:mig:content1": "1"}))
        s1 = _sync(pa)
        fid, f = drive.by_name(FILE)
        assert fid and s1["fileId"] == fid and s1["linked"] and not s1["err"], (s1, drive.log)
        w = [x for x in drive.writes if x[1] == FILE]
        assert len(w) == 1 and w[0][2].get("parents") == ["appDataFolder"], w
        body = json.loads(f["body"])
        assert body["app"] == "vocabulary-ieltsprep" and body["v"] == 1 and body["saved"], body
        assert sorted(body["data"]) == ["ielts:data", "ielts:study", "ielts:ui"], sorted(body["data"])
        assert "erased" not in body["data"]["ielts:data"], "an erase from before linking travelled"
        assert "session" not in body["data"]["ielts:study"] and "mig" not in body["data"]["ielts:study"], body["data"]["ielts:study"]
        assert all("attempt" not in t and "counted" not in t for t in body["data"]["ielts:data"]["tests"])
        assert f["appProperties"]["hash"] == pa.evaluate("vocabIelts.sync.hash()") == s1["lastHash"]
        assert pa.evaluate("vocabIelts.sync.payload()") == body["data"]
        assert "erased" not in _ls(pa, "ielts:data"), "the erase from before linking is still on this device"
        assert _ls(pa, "ielts:study")["session"]["ids"] == ["u01-l3-i8"], "this device's review session was lost"

        # B: a newer record of A's lesson, its own lesson, test and cards, and A's test deleted there
        pb = C.new_page("phone")
        others.append(pb)
        drive.attach(pb)
        db = _data({"u01-l1": {"done": True, "got": 4, "total": 4, "at": NOW - H}, "u02-l2": {"done": True, "at": NOW - 2 * H}},
                   [_t("u04-l4", NOW - 90 * 60_000, attempt=1, counted=True)],
                   gone=[{"lid": "u03-l3", "at": NOW - 4 * H, "del": NOW - 2 * H}])
        sb = {"v": 1, "cards": {"u01-l3-i8": {"b": 3, "last": NOW - H}, "u02-l1-i3-q1": {"b": 1, "last": NOW - H}},
              "log": [{"q": "u02-l1-i3-q1", "at": NOW - H}], "session": None, "exam": {"date": "2026-06-01", "from": "2026-03-01"},
              "calib": [], "at": NOW - H}
        _home(pb, _gk({"ielts:data": db, "ielts:study": sb, "ielts:ui": {"rate": 1.1, "at": NOW - 1800_000}}))
        _sync(pb)
        assert ("DOWNLOAD", fid, FILE) in drive.log
        mb = _ls(pb, "ielts:data")
        assert mb["lessons"]["u01-l1"]["got"] == 4 and "u02-l2" in mb["lessons"], mb["lessons"]
        assert [t["lid"] for t in mb["tests"]] == ["u04-l4"], "a deleted result came back"
        assert [e["id"] for e in mb["essays"]] == ["ea"] and [g["lid"] for g in mb["gone"]] == ["u03-l3"], mb
        stb = _ls(pb, "ielts:study")
        assert stb["cards"]["u01-l3-i8"]["b"] == 3 and "u02-l1-i3-q1" in stb["cards"] and len(stb["log"]) == 2, stb
        assert stb["exam"]["date"] == "2026-06-01" and stb["session"] is None and "mig" not in stb, stb
        assert _ls(pb, "ielts:ui")["rate"] == 1.1
        assert drive.body(FILE)["data"] == pb.evaluate("vocabIelts.sync.payload()"), "the file doesn't hold the merge"

        # A again: the same merge, its own review session kept, and nothing to upload
        nw = len(drive.writes)
        assert pa.evaluate("vocabIelts.sync.now()") is True
        assert pa.evaluate("vocabIelts.sync.payload()") == pb.evaluate("vocabIelts.sync.payload()"), "the two devices differ"
        assert _ls(pa, "ielts:study")["session"]["ids"] == ["u01-l3-i8"] and _ls(pa, "ielts:study")["mig"] == 1
        assert [t["lid"] for t in _ls(pa, "ielts:data")["tests"]] == ["u04-l4"]
        assert len(drive.writes) == nw, f"uploaded for nothing: {drive.writes[nw:]}"
        nl = len(drive.log)
        assert pb.evaluate("vocabIelts.sync.now()") is True
        assert not [x for x in drive.log[nl:] if x[0] in ("DOWNLOAD", "PATCH", "POST")], drive.log[nl:]

        # «Erase my progress» in IELTS Prep (Settings says when the copy last saved), then back in the app
        _open(pa, "#/settings")
        assert "last saved today at" in pa.inner_text("#ie-drive"), pa.inner_text("#ie-drive")
        pa.click("#ie-erase")
        pa.wait_for_function("() => document.getElementById('app').dataset.ready === '#/'", timeout=10000)
        er = _ls(pa, "ielts:data")
        assert er["erased"] > 0 and not er["lessons"] and _ls(pa, "ielts:sync")["fileId"] == fid, er
        s2 = _ls(pa, "ielts:sync")["lastSync"]
        pa.goto(C.base_url(pa) + "/")
        _sync(pa, s2)
        rb = drive.body(FILE)["data"]
        assert rb["ielts:data"]["erased"] == er["erased"] and not rb["ielts:data"]["lessons"] and not rb["ielts:data"]["tests"], rb["ielts:data"]
        assert not rb.get("ielts:study") or not rb["ielts:study"].get("cards"), rb.get("ielts:study")
        # B: what it did before the erase goes; what it did after it stays
        pb.evaluate("""e => { const d = JSON.parse(localStorage.getItem('ielts:data'));
          d.lessons['u05-l1'] = {done: true, got: 2, total: 2, at: e + 60000}; localStorage.setItem('ielts:data', JSON.stringify(d)); }""", er["erased"])
        assert pb.evaluate("vocabIelts.sync.now()") is True
        mb2 = _ls(pb, "ielts:data")
        assert list(mb2["lessons"]) == ["u05-l1"] and not mb2["tests"] and not mb2["essays"] and mb2["erased"] == er["erased"], mb2
        assert not _ls(pb, "ielts:study")["cards"], _ls(pb, "ielts:study")
        assert pa.evaluate("vocabIelts.sync.now()") is True
        assert list(_ls(pa, "ielts:data")["lessons"]) == ["u05-l1"]

        # a copy from a newer version of the app: never merged, never overwritten
        good = drive.files[fid]["body"]
        newer = json.loads(good)
        newer["v"] = 2
        drive.files[fid]["body"] = json.dumps(newer)
        drive.files[fid]["appProperties"] = {"hash": "zz-newer"}
        before = pa.evaluate("vocabIelts.sync.payload()")
        nw = len(drive.writes)
        assert pa.evaluate("vocabIelts.sync.now()") is False
        assert _ls(pa, "ielts:sync")["err"] == "newer" and len(drive.writes) == nw and pa.evaluate("vocabIelts.sync.payload()") == before
        drive.files[fid]["body"] = json.dumps({"app": "something-else", "v": 1, "data": {}})
        assert pa.evaluate("vocabIelts.sync.now()") is False and _ls(pa, "ielts:sync")["err"] == "bad" and len(drive.writes) == nw
        drive.files[fid]["body"] = good
        drive.files[fid]["appProperties"] = {"hash": "zz-back"}
        assert pa.evaluate("vocabIelts.sync.now()") is True and not _ls(pa, "ielts:sync")["err"]

        # a device whose IELTS Prep data went missing: an empty state never goes over the full copy
        pc = C.new_page("phone")
        others.append(pc)
        drive.attach(pc)
        hsh = drive.files[fid]["appProperties"]["hash"]
        _home(pc, _gk({"ielts:sync": {"fileId": fid, "lastHash": hsh, "lastSync": NOW - H, "linked": NOW - 9 * H, "full": True}}))
        nw = len(drive.writes)
        assert pc.evaluate("vocabIelts.sync.now()") is False
        assert _ls(pc, "ielts:sync")["err"] == "empty" and len([x for x in drive.writes[nw:] if x[1] == FILE]) == 0
        assert list(drive.body(FILE)["data"]["ielts:data"]["lessons"]) == ["u05-l1"]
        assert not C.errors(pc), C.errors(pc)
        others.remove(pc)
        pc.context.close()

        # IELTS Prep off, or Google not connected: nothing at all
        pd = C.new_page("phone")
        others.append(pd)
        drive.attach(pd)
        _home(pd, _gk({"ielts:data": da}, on=False))
        pe = C.new_page("phone")
        others.append(pe)
        drive.attach(pe)
        _home(pe, {**C.seed_keys(), "ielts:on": "true", "ielts:data": json.dumps(da)})
        nl = len(drive.log)
        for p in (pd, pe):
            p.clock.fast_forward(70_000)
            p.wait_for_timeout(400)
            assert p.evaluate("vocabIelts.sync.now()") is False and _ls(p, "ielts:sync") is None
        assert pe.evaluate("vocabIelts.sync.state().connected") is False
        assert not [x for x in drive.log[nl:] if x[2] == FILE], drive.log[nl:]

        # the child's file never carries IELTS Prep
        for _, name, _, content in drive.writes:
            assert name in (FILE, KID_FILE), name
            if name == KID_FILE:
                assert "ielts:" not in content, content[:200]
        for p in [pa, *others]:
            assert not C.errors(p), C.errors(p)
    finally:
        for p in others:
            p.context.close()
        pa.context.close()


def test_ielts_integration_drive_merge_rules():
    """vocabIelts.sync.merge(a, b, ea, eb) (pure): ties keep this device's, results by lid+at, tombstones, the erase epoch"""
    page = C.new_page("phone")
    try:
        C.seed(page, {**C.seed_keys(), "ielts:on": "true"})
        r = page.evaluate("""() => { const M = vocabIelts.sync.merge, D = 'ielts:data', S = 'ielts:study';
          const a = {[D]: {v: 1, lessons: {x: {at: 5, got: 1}}, tests: [{lid: 'l', at: 1}], essays: [{id: 'e', at: 3, text: 'a'}], speaking: []},
                     [S]: {v: 1, cards: {q: {last: 4, b: 1}}, log: [{q: 'q', at: 4}], session: {at: 1, ids: ['q'], ord: {}}, calib: [], at: 4},
                     'ielts:ui': {rate: 1, at: 2}};
          const b = {[D]: {v: 1, lessons: {x: {at: 5, got: 9}, y: {at: 1}}, tests: [{lid: 'l', at: 1}, {lid: 'l', at: 2}],
                           essays: [{id: 'e', at: 4, text: 'b'}], speaking: [], gone: [{lid: 'l', at: 1, del: 9}]},
                     [S]: {v: 1, cards: {q: {last: 3, b: 5}}, log: [{q: 'q', at: 2}], session: null, calib: [], at: 3},
                     'ielts:ui': {rate: 1.1, at: 1}};
          const sa = JSON.stringify(a), sb = JSON.stringify(b);
          const m = M(a, b), e = M(a, b, 0, 4);
          return {pure: JSON.stringify(a) === sa && JSON.stringify(b) === sb, m, e}; }""")
        assert r["pure"], "merge changed its inputs"
        m, e = r["m"], r["e"]
        d = m["ielts:data"]
        assert d["lessons"]["x"]["got"] == 1 and "y" in d["lessons"], "a tie must keep this device's record"
        assert [t["at"] for t in d["tests"]] == [2] and "attempt" not in d["tests"][0], d["tests"]
        assert d["essays"][0]["text"] == "b" and m["ielts:ui"]["rate"] == 1, d
        s = m["ielts:study"]
        assert s["cards"]["q"]["b"] == 1 and len(s["log"]) == 2 and s["session"]["ids"] == ["q"], s
        # the other side erased at 4: from here only what came after it (and its own)
        de = e["ielts:data"]
        # (the side that erased keeps all its own; from this one only lesson x, saved at 5)
        assert de["erased"] == 4 and sorted(de["lessons"]) == ["x", "y"] and de["lessons"]["x"]["got"] == 1, de
        assert [t["at"] for t in de["tests"]] == [2] and [x["text"] for x in de["essays"]] == ["b"], de
        se = e["ielts:study"]
        assert se["cards"]["q"]["b"] == 5 and [x["at"] for x in se["log"]] == [2] and se["session"] is None, se
        # Drive has no ielts:study after an erase there: this device's goes too
        r2 = page.evaluate("""() => vocabIelts.sync.merge({'ielts:study': {v: 1, cards: {q: {last: 3}, r: {last: 9}}, log: [{q: 'q', at: 3}],
          session: {at: 3, ids: ['q'], ord: {}}, calib: [], at: 3}}, {'ielts:data': {v: 1, lessons: {}, tests: [], essays: [], speaking: [], erased: 5}}, 0, 5)""")
        assert list(r2["ielts:study"]["cards"]) == ["r"] and not r2["ielts:study"]["log"] and r2["ielts:study"]["session"] is None, r2
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- 5. a review card keeps the real set visual
_FINISH = """async ([lid, ans]) => {
  localStorage.setItem('ielts:run:' + lid, JSON.stringify({v: 1, i: 0, ans, checked: {}, heard: {}, self: {}, el: 0, started: true, finished: true}));
  IE.prog.done(lid, {got: 0, total: 1});
  await IE.study.settled();
  return JSON.parse(localStorage.getItem('ielts:study'));
}"""


def test_ielts_integration_review_card_real_visual():
    """content1's real u04-l2 plan (no page.route): the review card of its question carries the plan, and the player draws it"""
    page = C.new_page("phone")
    try:
        les = next(x for x in _unit(4)["lessons"] if x["id"] == "u04-l2")
        it = next(i for i in les["items"] if i["id"] == "u04-l2-i1")
        s0 = it["sets"][0]
        assert s0.get("visual") and "Label the" in s0["instr"], s0.keys()
        qid = s0["items"][0]["id"]
        _seed(page, {})
        _open(page)
        s = page.evaluate(_FINISH, ["u04-l2", {}])
        assert qid in s["cards"], sorted(s["cards"])
        page.evaluate("""(id) => { const s = JSON.parse(localStorage.getItem('ielts:study'));
          for(const [k, c] of Object.entries(s.cards)) if(k !== id) c.due += 30 * 864e5; else c.due -= 2 * 864e5;
          s.session = null; localStorage.setItem('ielts:study', JSON.stringify(s)); }""", qid)
        L = page.evaluate("async () => (await IE.data.lesson('review')).lesson")
        assert [i["id"] for i in L["items"]] == ["rv-" + qid], [i["id"] for i in L["items"]]
        assert L["items"][0]["sets"][0]["visual"] == s0["visual"], L["items"][0]["sets"][0].keys()
        _open(page, "#/lesson/review")
        page.wait_for_selector("#ie-item")
        page.locator("#ie-item .ie-set figure.ie-viz svg").first.wait_for(state="attached", timeout=5000)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
