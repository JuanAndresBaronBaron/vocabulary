"""IELTS Prep (ielts.html, js/ielts-boot.js, js/ielts.js, js/ielts-player.js, js/ielts-viz.js).

- The data: every file passes ielts_validate.py and every unit of index.json is available.
- The entry: off by default; the «IELTS Prep» switch in Ajustes › Para mayores puts «IELTS Prep» in the flag menu;
  choosing it passes the adult gate and opens ielts.html. Without the switch or the gate in this session, ielts.html
  only explains how to get in. Nothing of the child's game changes.
- Marking: bands from the Academic tables (scaled to 40), the overall rounding, every question type.
- Every lesson of every unit, on a phone: it opens, each item can be checked or passed, a test starts and finishes,
  and the results show, without console errors. Writing: the checks, the model and marking yourself keep the essay
  in My writing.
"""
from __future__ import annotations

import json
import re

import common as C
import ielts_validate as V
import tech_common as TC

_PASS = "() => sessionStorage.setItem('vocab:gate', String(Date.now() + adultGate.MS))"
_IN = "localStorage.setItem('ielts:on', 'true'); sessionStorage.setItem('ielts:in', '1');"


def _index():
    return json.loads((V.DATA / "index.json").read_text(encoding="utf-8"))


def _open(page, hash="#/"):
    page.goto(C.base_url(page) + "/ielts.html" + hash)
    page.wait_for_function("h => { const a = document.getElementById('app'); return a && a.children.length > 0 && (a.dataset.ready === h || !window.IE || !IE.route); }", arg=hash, timeout=10000)
    page.wait_for_timeout(250)


def test_ielts_data_valid():
    bad = V.check_all()
    assert not bad, json.dumps(bad, indent=1)[:3000]
    ix = _index()
    assert len(ix["units"]) == 24 and all(u["available"] for u in ix["units"]), [u["id"] for u in ix["units"] if not u["available"]]


def test_ielts_entry_from_the_app():
    page = C.new_page("phone")
    try:
        C.seed(page)
        before = TC.kid_snapshot(page)
        page.click("#lang-b")
        page.wait_for_timeout(300)
        assert page.locator("[data-ielts-entry]").count() == 0, "IELTS Prep is in the menu while switched off"
        page.keyboard.press("Escape")
        page.evaluate(_PASS)
        page.evaluate("() => { openSettings('mayores'); }")
        page.wait_for_function("() => window.vocabSettings && vocabSettings.page === 'mayores'", timeout=4000)
        page.wait_for_timeout(500)
        row = page.evaluate("() => { const s = document.getElementById('aj-ie'); return s && s.textContent.replace(/\\s+/g, ' ').trim(); }")
        assert row and row.startswith("IELTS Prep") and "C2" in row, row
        page.locator("#aj-ie").scroll_into_view_if_needed()
        page.locator("label[for=aj-ie-on]").click()
        page.wait_for_timeout(200)
        assert page.evaluate("localStorage.getItem('ielts:on')") == "true"
        for _ in range(3):
            if not page.evaluate("document.getElementById('ajustes').open"):
                break
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
        page.evaluate(_PASS)
        page.click("#lang-b")
        page.wait_for_timeout(300)
        it = page.locator("[data-ielts-entry]")
        assert it.count() == 1 and "IELTS Prep" in it.inner_text()
        with page.expect_navigation():
            it.click()
        page.wait_for_function("() => document.querySelector('.ie-hero h1')", timeout=10000)
        assert page.evaluate("document.querySelector('.ie-hero h1').textContent") == "IELTS Prep"
        assert page.evaluate("document.documentElement.lang") == "en-GB"
        page.goto(C.base_url(page) + "/")
        page.wait_for_timeout(800)
        assert not TC.kid_changes(page, before), TC.kid_changes(page, before)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_ielts_locked_without_the_gate():
    page = C.new_page("phone")
    try:
        page.goto(C.base_url(page) + "/ielts.html#/unit/u01")
        page.wait_for_timeout(600)
        t = page.inner_text("#app")
        assert "for grown-ups" in t and "Para mayores" in t, t
        assert page.locator(".ie-row").count() == 0
        page.evaluate("() => localStorage.setItem('ielts:on', 'true')")
        page.reload()
        page.wait_for_timeout(600)
        assert "for grown-ups" in page.inner_text("#app")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_ielts_validator_rules():
    """The exam rules of ielts_validate.py: the word-limit counter, 'Label the' needs a visual, the spread of pick keys
    in a test and of Choose TWO pairs in a unit; the new optional fields (markers, callouts, alt); the content revision
    every unit carries (rev, equal to REV in js/ielts.js and IELTS_REV in sw.js); and every PENDING id (left for content2) exists."""
    import copy
    fits = [("14th", "ONE WORD AND/OR A NUMBER"), ("07700 911483", "A NUMBER"), ("BS7 4QD", "ONE WORD AND/OR A NUMBER"),
            ("10:15", "A NUMBER"), ("£85", "A NUMBER"), ("check-in", "ONE WORD ONLY"), ("15 minutes", "ONE WORD AND/OR A NUMBER"),
            ("concrete core", "NO MORE THAN TWO WORDS"), ("Austria and Germany", "NO MORE THAN THREE WORDS AND/OR A NUMBER"),
            ("a little", "ONE OR TWO WORDS"), ("has been converted", "TWO OR THREE WORDS"), ("fourteenth", "ONE WORD"),
            ("the lower path", "NO MORE THAN THREE WORDS AND/OR A NUMBER"), ("Flat 3", "NO MORE THAN TWO WORDS AND/OR A NUMBER")]
    over = [("the fourteenth", "ONE WORD AND/OR A NUMBER"), ("one hundred and eighty-five", "ONE WORD AND/OR A NUMBER"),
            ("ten fifteen", "A NUMBER"), ("fifteen", "A NUMBER"), ("14", "ONE WORD ONLY"), ("12 and 14", "ONE WORD AND/OR A NUMBER"),
            ("an old towel", "ONE WORD ONLY"), ("fully shielded lamps", "NO MORE THAN TWO WORDS"), ("towel", "ONE TOWEL"), ("towel", "")]
    assert [a for a, lim in fits if not V.fits(a, lim)] == [], "rejected within the limit"
    assert [a for a, lim in over if V.fits(a, lim)] == [], "accepted over the limit"
    assert V.limit_of("NO MORE THAN THREE WORDS AND/OR A NUMBER") == (3, 1) and V.limit_of("A NUMBER") == (0, 1)
    assert V.limit_of("ONE OR TWO WORDS") == (2, 0) and V.limit_of("one word") == (1, 0) and V.limit_of("FEW WORDS") is None
    assert V.count_answer("07700 911483 or BS7 4QD") == (1, 2)

    base = json.loads((V.DATA / "u03.json").read_text(encoding="utf-8"))
    assert V.check_unit(copy.deepcopy(base), "u03") == []

    def planted(change, expect):
        u = copy.deepcopy(base)
        change(u)
        errs = V.check_unit(u, "u03")
        assert any(expect in m for m in errs), (expect, errs)

    les = base["lessons"]
    lst = next(i for i, it in enumerate(les[1]["items"]) if it["type"] == "listening")
    def over_limit(u):
        u["lessons"][1]["items"][lst]["sets"][0]["items"][0]["answer"].append("a big rucksack")
    def unknown_limit(u):
        u["lessons"][1]["items"][lst]["sets"][0]["items"][0]["limit"] = "A FEW WORDS"
    def label_no_visual(u):
        u["lessons"][1]["items"][lst]["sets"][1]["instr"] = "Label the plan below. Choose the correct letter, A-C."
    def keys_bunched(u):
        u["lessons"][2]["items"].append({"id": "u03-l3-i2", "type": "reading", "title": "t", "minutes": 5, "paragraphs": [{"label": None, "text": "x"}],
                                          "sets": [{"instr": "Choose A, B or C.", "items": [{"id": f"u03-l3-i2-q{k}", "type": "pick", "q": "q",
                                                    "options": ["A  a", "B  b", "C  c"], "answer": 1 if k < 4 else 0, "why": "w"} for k in range(1, 5)]}]})
    # every unit carries the content revision js/ielts.js asks for (an older copy kept on a phone is fetched again)
    planted(lambda u: u.pop("rev"), "rev must be a whole number, 2 or more")
    planted(lambda u: u.update(rev=1), "rev must be a whole number, 2 or more")
    planted(lambda u: u.update(rev="2"), "rev must be a whole number, 2 or more")
    js_rev = re.search(r"\bconst REV = (\d+)", (C.REPO / "js" / "ielts.js").read_text(encoding="utf-8"))
    assert js_rev and int(js_rev.group(1)) == V.REV == base["rev"], "REV in js/ielts.js, ielts_validate.REV and the units' rev differ"
    # sw.js refreshes, at install, every unit copy in vocab-media with a lower rev (IELTS_REV): the same number
    sw_rev = re.search(r"\bconst IELTS_REV = (\d+)", (C.REPO / "sw.js").read_text(encoding="utf-8"))
    assert sw_rev and int(sw_rev.group(1)) == V.REV, "IELTS_REV in sw.js and REV in js/ielts.js differ"
    planted(over_limit, "'a big rucksack' is over the limit")
    planted(unknown_limit, "unknown word limit")
    planted(label_no_visual, "needs a visual")
    planted(keys_bunched, "3 of the 4 pick keys share one letter")
    # a correct visual on the set clears the 'Label the' error
    def label_with_visual(u):
        label_no_visual(u)
        u["lessons"][1]["items"][lst]["sets"][1]["visual"] = {"kind": "map", "title": "Plan", "maps": [{"title": "Plan", "items": [
            {"label": "A", "mark": True, "x": 10, "y": 10, "w": 10, "h": 10, "shape": "rect"}]}]}
    u = copy.deepcopy(base)
    label_with_visual(u)
    assert V.check_unit(u, "u03") == [], V.check_unit(u, "u03")
    # markers: a room (w and h, shape optional), a callout (0 x 0, no shape) and an alt text are all fine
    def plan_items(u, items, **extra):
        label_with_visual(u)
        v = u["lessons"][1]["items"][lst]["sets"][1]["visual"]
        v["maps"][0]["items"] = items
        v.update(extra)
    u = copy.deepcopy(base)
    plan_items(u, [{"label": "A", "mark": True, "x": 10, "y": 10, "w": 20, "h": 12}, {"label": "B", "mark": True, "x": 50, "y": 50, "w": 0, "h": 0}],
               alt="A: in the north-west corner. B: in the middle.")
    assert V.check_unit(u, "u03") == [], V.check_unit(u, "u03")
    planted(lambda u: plan_items(u, [{"label": "B", "mark": True, "x": 50, "y": 50, "w": 0, "h": 0, "shape": "rect"}]), "a callout marker (w and h 0) has no shape")
    planted(lambda u: plan_items(u, [{"label": "B", "mark": True, "x": 50, "y": 50, "w": 0, "h": 12}]), "has both a width and a height")
    planted(lambda u: plan_items(u, [{"label": "A", "mark": True, "x": 10, "y": 10, "w": 20, "h": 12}], alt=""), "alt is a text alternative")
    def alt_on_table(u):
        u["lessons"][2]["items"][0]["sets"][1]["visual"]["alt"] = "A table."
    assert base["lessons"][2]["items"][0]["sets"][1]["visual"]["kind"] == "table"
    planted(alt_on_table, "for a map visual only")
    # Choose TWO: 3 of 4 multi questions with the same pair is too many; 2 of 4 is fine
    def multis(pairs):
        def change(u):
            u["lessons"][2]["items"].append({"id": "u03-l3-i2", "type": "reading", "title": "t", "minutes": 5, "paragraphs": [{"label": None, "text": "x"}],
                                              "sets": [{"instr": "Choose TWO letters, A-E.", "items": [{"id": f"u03-l3-i2-q{k}", "type": "multi", "q": "Which TWO?",
                                                        "options": ["A  a", "B  b", "C  c", "D  d", "E  e"], "answer": list(p), "why": "w"} for k, p in enumerate(pairs, 1)]}]})
        return change
    planted(multis([(1, 3), (3, 1), (1, 3), (0, 4)]), "3 of the 4 multi questions share one answer pair")
    u = copy.deepcopy(base)
    multis([(1, 3), (3, 1), (0, 2), (0, 4)])(u)
    assert V.check_unit(u, "u03") == [], V.check_unit(u, "u03")
    # the new optional fields are checked too
    def bad_fields(u):
        it = u["lessons"][1]["items"][lst]
        it["speakers"][0]["accent"] = "british"
        it["script"][0]["pause"] = 3
        u["lessons"][1]["exam"] = True
    planted(bad_fields, "accent must be one of")
    planted(bad_fields, "pause is a whole number")
    planted(bad_fields, "exam: true is only for a test")
    w = json.loads((V.DATA / "u11.json").read_text(encoding="utf-8"))
    wi = next((li, ii) for li, l in enumerate(w["lessons"]) for ii, it in enumerate(l["items"]) if it["type"] == "writing" and it["task"] == 1)
    def bad_writing(u):
        it = u["lessons"][wi[0]]["items"][wi[1]]
        it["exemplars"] = [{"band": 4.5, "text": ["a", "b"], "notes": ["n"]}]
        it["visual2"] = {"kind": "chart", "title": "x"}
    uw = copy.deepcopy(w)
    bad_writing(uw)
    errs = V.check_unit(uw, "u11")
    assert any("exemplar needs band 5-9" in m for m in errs) and any("visual kind must be" in m for m in errs), errs

    ids = set()
    for n in (23, 24):
        u = json.loads((V.DATA / f"u{n}.json").read_text(encoding="utf-8"))
        for l in u["lessons"]:
            ids.add(l["id"])
            for it in l["items"]:
                ids.add(it["id"])
                ids.update(q["id"] for s in it.get("sets") or [] for q in s["items"])
    assert V.PENDING <= ids, sorted(V.PENDING - ids)


def test_ielts_marking():
    page = C.new_page("desk")
    try:
        page.add_init_script(_IN)
        _open(page)
        r = page.evaluate("""() => {
          const P = IE.player, b = IE.band;
          return {
            l: [b('listening', 40, 40), b('listening', 37, 40), b('listening', 30, 40), b('listening', 16, 40)],
            r: [b('reading', 39, 40), b('reading', 33, 40), b('reading', 30, 40), b('reading', 23, 40), b('reading', 13, 13)],
            round: [IE.roundBand(6.25), IE.roundBand(6.75), IE.roundBand(6.1), IE.roundBand(8.875)],
            gap: P.mark({type: 'gap', answer: ['19th', 'nineteenth']}, ' Nineteenth. '),
            gapNo: P.mark({type: 'gap', answer: ['station']}, 'stations'),
            multi: [P.mark({type: 'multi', answer: [1, 3]}, [3, 1]), P.mark({type: 'multi', answer: [1, 3]}, [1, 2])],
            sel: P.mark({type: 'select', rows: [{answer: 0}, {answer: 2}, {answer: 1}]}, {0: 0, 1: 2, 2: 2}),
            ord: [P.mark({type: 'order', items: ['a', 'b', 'c']}, [0, 1, 2]), P.mark({type: 'order', items: ['a', 'b', 'c']}, [1, 0, 2])],
            tf: P.mark({type: 'tfng', answer: 'NG'}, 'NG'),
          }; }""")
        assert r["l"] == [9, 8.5, 7, 5] and r["r"] == [9, 7.5, 7, 6, 9], r
        assert r["round"] == [6.5, 7, 6, 9], r
        assert r["gap"] == 1 and r["gapNo"] == 0 and r["multi"] == [2, 1] and r["sel"] == 2 and r["ord"] == [1, 0] and r["tf"] == 1, r
    finally:
        page.context.close()


_STEP = """() => {
  const q = s => document.querySelector(s);
  if(q('#ie-go')){ q('#ie-go').click(); return 'start'; }
  if(q('.ie-bigband, .ie-result')) return 'done';
  /* answer something in each kind of question, so marking runs on real answers */
  document.querySelectorAll('.ie-q').forEach(box => {
    const opt = box.querySelector('.ie-opt[data-v]:not(:disabled)'); if(opt && !box.querySelector('.ie-opt.is-on')) opt.click();
    const inp = box.querySelector('input.ie-in:not([readonly])'); if(inp && !inp.value){ inp.value = 'answer'; inp.dispatchEvent(new Event('input')); }
    box.querySelectorAll('select:not(:disabled)').forEach(s => { if(!s.value){ s.value = '0'; s.dispatchEvent(new Event('change')); } });
    const add = box.querySelector('[data-add]'); if(add) add.click();
  });
  const ta = q('#ie-ta:not([readonly])'); if(ta && !ta.value){ ta.value = 'Overall, the figures rose. '.repeat(45); ta.dispatchEvent(new Event('input')); }
  for(const id of ['#ie-check', '#ie-wdone', '#ie-sdone', '#ie-next', '#ie-fin']){ const b = q(id); if(b && !b.disabled){ b.click(); return id; } }
  return 'stuck';
}"""


def test_ielts_every_lesson_runs():
    page = C.new_page("phone")
    page.on("dialog", lambda d: d.accept())
    try:
        page.add_init_script(_IN)
        _open(page)
        ix = _index()
        n = 0
        for row in ix["units"]:
            if not (V.DATA / f"{row['id']}.json").exists():
                continue
            u = json.loads((V.DATA / f"{row['id']}.json").read_text(encoding="utf-8"))
            for les in u["lessons"]:
                _open(page, f"#/lesson/{les['id']}")
                steps = []
                for _ in range(len(les["items"]) * 3 + 6):
                    s = page.evaluate(_STEP)
                    steps.append(s)
                    if s in ("done", "stuck"):
                        break
                    page.wait_for_timeout(120)
                assert steps[-1] == "done", f"{les['id']}: {steps}"
                rec = page.evaluate(f"() => IE.prog.lesson('{les['id']}')")
                assert rec and rec["done"], (les["id"], rec)
                n += 1
        assert n >= 60, n
        d = page.evaluate("() => IE.prog.get()")
        assert d["essays"] and all(e["words"] >= 150 for e in d["essays"]), len(d["essays"])
        assert {t["skill"] for t in d["tests"]} >= {"listening", "reading"}, d["tests"][:3]
        _open(page, "#/essays")
        assert page.locator(".ie-row").count() == len(d["essays"])
        _open(page, "#/progress")
        assert page.locator(".ie-tile b").count() == 4
        assert not [k for k in page.evaluate("Object.keys(localStorage)") if not k.startswith("ielts:")], "IELTS Prep wrote keys outside ielts:*"
        assert not C.errors(page), C.errors(page)[:5]
    finally:
        page.context.close()


def test_ielts_pages_both_themes():
    for kind, scheme in (("phone", "dark"), ("desk", "light")):
        page = C.new_page(kind, color_scheme=scheme)
        try:
            page.add_init_script(_IN)
            for h in ("#/", "#/unit/u11", "#/lesson/u12-l3", "#/settings", "#/progress", "#/essays"):
                _open(page, h)
                w = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                assert w <= 1, f"{kind} {h}: horizontal scroll {w}px"
            assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()
