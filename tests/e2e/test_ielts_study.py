"""IELTS Prep: the study engine (js/ielts-study.js and its «package: study» section of ielts.css).

- The deck: a finished learn lesson makes a card of every standalone question (missed → box 0, due tomorrow; right →
  box 1, due in 3 days); a missed set question of a test becomes a wrapped card with its passage or its transcript
  and the set's visual (the plan to label, the table to complete);
  #/lesson/review runs in the real player and grading moves the boxes (+1 / −2, never below 0); the exam-date cap;
  secure cards retire; at most 20 cards (5 wrapped) per session; options are shuffled only when no text refers to them
  by letter, and the answer follows; a reload resumes the same session; a new session deletes ielts:run:review; the
  first load builds the deck from lessons finished before (migration), once.
- The notebook: the tags (spelling, word limit, number format, singular/plural, T↔NG and the rest), the 30-day
  «Where my marks go», the TRUE/FALSE/NOT GIVEN confusion table and accuracy by question type on a seeded log.
- IE.assess mounted in a div: per-criterion checklist bands 6-9, the estimate from complete checklists, the warning
  at a difference of 1 or more, every tap saved, old {0..3} objects as before, exemplar calibration and its average
  error, radiogroups, arrow keys and 44 px targets.
- The home card, the exam plan and «Rewrite from memory», #/unit/review, the icons copied from index.html, only
  ielts:study written, Erase removes it, the wrappers installed once; screenshots at 360 and 1280 px, light and dark,
  without horizontal scroll and without purple or pink.
"""
from __future__ import annotations

import colorsys
import json
import re

import common as C
import ielts_validate as V

_IN = "localStorage.setItem('ielts:on', 'true'); sessionStorage.setItem('ielts:in', '1');"
SHOTS = C.CAPTURAS / "ielts-study"


def _open(page, hash="#/", reload=False):
    """opens ielts.html at hash: a fresh load the first time or with reload=True, otherwise the app's own router"""
    url = C.base_url(page) + "/ielts.html" + hash
    if page.url.split("#")[0] != url.split("#")[0]:
        page.goto(url)
    elif reload:
        page.evaluate("h => history.replaceState(null, '', h)", hash)
        page.reload()
    else:
        page.evaluate("h => IE.go(h)", hash)
    page.wait_for_function("h => document.getElementById('app').dataset.ready === h", arg=hash, timeout=10000)
    page.wait_for_timeout(150)


def _page(kind="phone", **kw):
    page = C.new_page(kind, **kw)
    page.add_init_script(_IN)
    page.on("dialog", lambda d: d.accept())
    return page


def _unit(uid):
    return json.loads((V.DATA / f"{uid}.json").read_text(encoding="utf-8"))


def _lesson(lid):
    return next(l for l in _unit(lid[:3])["lessons"] if l["id"] == lid)


# finishes a lesson exactly as the player does: the run is saved first, then prog.done
_FINISH = """async ([lid, ans]) => {
  localStorage.setItem('ielts:run:' + lid, JSON.stringify({v: 1, i: 0, ans, checked: {}, heard: {}, self: {}, el: 0, started: true, finished: true}));
  IE.prog.done(lid, {got: 0, total: 1});
  await IE.study.settled();
  return JSON.parse(localStorage.getItem('ielts:study'));
}"""
# moves every card (and the log) back by n days, as if they had been made n days ago
_AGE = """(n) => {
  const s = JSON.parse(localStorage.getItem('ielts:study'));
  for(const c of Object.values(s.cards)){ c.due -= n * 864e5; c.last -= n * 864e5; }
  localStorage.setItem('ielts:study', JSON.stringify(s));
}"""
_STUDY = "() => JSON.parse(localStorage.getItem('ielts:study'))"


def _finish(page, lid, ans):
    return page.evaluate(_FINISH, [lid, ans])


def test_study_deck_from_lessons():
    page = _page()
    try:
        _open(page)
        les = _lesson("u01-l1")
        qs = [i for i in les["items"] if i["type"] in ("pick", "tfng")]
        right, wrong = qs[0], qs[1]
        ans = {right["id"]: right["answer"], wrong["id"]: ("F" if wrong["answer"] != "F" else "T") if wrong["type"] == "tfng" else (wrong["answer"] + 1) % len(wrong["options"])}
        s = _finish(page, "u01-l1", ans)
        exp = page.evaluate("() => ({d1: IE.study.addDays(Date.now(), 1), d3: IE.study.addDays(Date.now(), 3)})")
        c1, c0 = s["cards"][right["id"]], s["cards"][wrong["id"]]
        assert c1["box"] == 1 and c1["due"] == exp["d3"] and c1["hits"] == 1 and c1["n"] == 1 and c1["lid"] == "u01-l1" and "p" not in c1, c1
        assert c0["box"] == 0 and c0["due"] == exp["d1"] and c0["hits"] == 0, c0
        assert set(s["cards"]) == {q["id"] for q in qs}, sorted(s["cards"])   # every standalone question of a learn lesson
        log = [e for e in s["log"] if e["l"] == "u01-l1"]
        assert len(log) == len(qs) and all(e.get("x") == 1 and e["s"] == "start" for e in log), log[:2]
        assert {e["k"] for e in log} == {"mc", "tfng"}, log
        # nothing is due today: missed cards come back tomorrow
        assert page.evaluate("() => IE.study.due().length") == 0

        # a reading test: only missed set questions become (wrapped) cards
        rt = _lesson("u07-l3")
        rq = [q for it in rt["items"] if it.get("sets") for st in it["sets"] for q in st["items"]]
        q0 = rq[0]
        good = {q0["id"]: q0["answer"]}
        s = _finish(page, "u07-l3", good)
        assert q0["id"] not in s["cards"], "a set question answered right made a card"
        miss = [q["id"] for q in rq[1:]]
        assert all(s["cards"][i]["p"] == "u07-l3-i1" and s["cards"][i]["box"] == 0 for i in miss), [s["cards"].get(i) for i in miss[:2]]
        tl = [e for e in s["log"] if e["l"] == "u07-l3"]
        assert len(tl) == len(rq) and all(e["s"] == "reading" and "x" not in e for e in tl)
        # a listening test: the same, with the transcript
        lt = _lesson("u03-l3")
        lq = [(it, q) for it in lt["items"] if it.get("sets") for st in it["sets"] for q in st["items"]]
        s = _finish(page, "u03-l3", {})
        assert all(s["cards"][q["id"]]["p"] == it["id"] for it, q in lq)

        page.evaluate(_AGE, 2)
        # two reading cards waited longer: the session takes them first, then three listening ones (at most 5 wrapped)
        page.evaluate("""(ids) => { const s = JSON.parse(localStorage.getItem('ielts:study'));
          for(const id of ids) s.cards[id].due -= 864e5; localStorage.setItem('ielts:study', JSON.stringify(s)); }""", miss[:2])
        r = page.evaluate("async () => (await IE.data.lesson('review'))")
        L, U = r["lesson"], r["unit"]
        assert L["id"] == "review" and L["kind"] == "practice" and L["minutes"] == 10 and L["title"] == "Review", {k: L[k] for k in ("id", "kind", "title")}
        assert U["id"] == "review" and U["n"] == 0 and U["back"] == "#/review" and U["backT"] == "Review" and U["lessons"][0]["id"] == "review", U
        items = {i["id"]: i for i in L["items"]}
        wrapped = [i for i in L["items"] if i["id"].startswith("rv-")]
        assert 1 <= len(wrapped) <= 5 and len(L["items"]) <= 20, [i["id"] for i in L["items"]]
        rd = [i for i in wrapped if i["title"] == next(it["title"] for it in rt["items"] if it["type"] == "reading")]
        ls = [i for i in wrapped if i["title"].startswith("Transcript · ")]
        assert len(wrapped) == 5 and len(rd) == 2 and len(ls) == 3, [i["title"] for i in wrapped]
        assert [i["id"] for i in L["items"]][:2] == ["rv-" + x for x in miss[:2]], [i["id"] for i in L["items"]][:3]
        passage = next(it for it in rt["items"] if it["type"] == "reading")
        for w in rd:
            assert w["type"] == "reading" and w["paragraphs"] == passage["paragraphs"] and len(w["sets"]) == 1 and len(w["sets"][0]["items"]) == 1
            assert w["id"] == "rv-" + w["sets"][0]["items"][0]["id"] and not w["sets"][0]["instr"].startswith("Questions")
        lit = next(it for it in lt["items"] if it["type"] == "listening")
        names = {sp["id"]: sp["name"] for sp in lit["speakers"]}
        for w in ls:
            assert w["type"] == "reading" and w["title"] == f"Transcript · {lit['title']}", w["title"]
            assert [p["text"] for p in w["paragraphs"]] == [f"**{names[l['s']]}:** {l['t']}" for l in lit["script"]]
            assert all(p["label"] is None for p in w["paragraphs"])
        assert right["id"] in items or wrong["id"] in items
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


_PLAY = """([lid, want]) => {
  const q = s => document.querySelector(s);
  if(q('.ie-result')) return 'done';
  const box = q('#ie-item .ie-q');
  if(box && !q('#ie-item .ie-why')){
    const id = box.dataset.q, x = want[id];
    if(x != null){ const b = box.querySelector(`[data-v="${x}"]`); if(b) b.click(); }
  }
  for(const id of ['#ie-check', '#ie-next', '#ie-fin']){ const b = q(id); if(b && !b.disabled){ b.click(); return id; } }
  return 'stuck';
}"""


def test_study_review_in_the_player():
    page = _page()
    try:
        _open(page)
        les = _lesson("u01-l1")
        qs = [i for i in les["items"] if i["type"] in ("pick", "tfng")]
        _finish(page, "u01-l1", {})
        # boxes 2 (to be answered right) and 3 or 1 (to be missed): right → +1; missed → −2, never below 0
        page.evaluate("""(ids) => { const s = JSON.parse(localStorage.getItem('ielts:study'));
          ids.forEach((id, i) => { s.cards[id].box = [2, 2, 2, 3, 1, 0][i]; s.cards[id].hits = 1; });
          localStorage.setItem('ielts:study', JSON.stringify(s)); }""", [q["id"] for q in qs])
        page.evaluate(_AGE, 5)
        _open(page, "#/lesson/review")
        L = page.evaluate("async () => (await IE.data.lesson('review')).lesson")
        assert sorted(i["id"] for i in L["items"]) == sorted(q["id"] for q in qs), [i["id"] for i in L["items"]]
        right_ids = {q["id"] for q in qs[:3]}
        want = {}
        for it in L["items"]:
            if it["id"] in right_ids:
                want[it["id"]] = it["answer"]
            elif it["type"] == "pick":
                want[it["id"]] = (it["answer"] + 1) % len(it["options"])
            else:
                want[it["id"]] = "NG" if it["answer"] != "NG" else "T"
        assert page.evaluate("() => document.querySelector('.ie-top-t').textContent") == "Review"
        steps = []
        for _ in range(len(L["items"]) * 3 + 4):
            s = page.evaluate(_PLAY, ["review", want])
            steps.append(s)
            if s in ("done", "stuck"):
                break
            page.wait_for_timeout(80)
        assert steps[-1] == "done", steps
        page.evaluate("() => IE.study.settled()")
        st = page.evaluate(_STUDY)
        t = page.evaluate("() => ({d1: IE.study.addDays(Date.now(), 1), d14: IE.study.addDays(Date.now(), 14)})")
        for i, q in enumerate(qs):
            c = st["cards"][q["id"]]
            if i < 3:
                assert c["box"] == 3 and c["due"] == t["d14"] and c["hits"] == 2, (q["id"], c)
            else:
                assert c["box"] == [1, 0, 0][i - 3] and c["due"] == t["d1"], (q["id"], c)
        assert st["session"] is None
        rv = [e for e in st["log"] if e["l"] == "review"]
        assert len(rv) == 6 and sum(e["ok"] for e in rv) == 3, rv
        assert "3 of 6 correct" in page.inner_text("#app")
        # «Back to the unit» leads to the Review page
        page.click("a[href='#/unit/review']")
        page.wait_for_function("() => document.getElementById('app').dataset.ready === '#/unit/review'")
        assert page.locator(".ie-rv-deck").count() == 1
        assert "Last review" in page.inner_text(".ie-rv-deck")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# a small plan for the label-the-plan set of u04-l2-i1, served in place of the real one (content packages add the real
# visuals; the study engine only has to carry them over)
_PLAN = {"kind": "map", "title": "Hallam Bridge Mill", "maps": [{"title": "Site plan (north is at the top)", "items": [
    {"label": "River", "x": 0, "y": 5, "w": 100, "h": 12, "shape": "water"},
    {"label": "A", "mark": True, "x": 10, "y": 30, "w": 20, "h": 15, "shape": "rect"},
    {"label": "B", "mark": True, "x": 40, "y": 30, "w": 20, "h": 15, "shape": "rect"},
    {"label": "C", "mark": True, "x": 70, "y": 30, "w": 20, "h": 15, "shape": "rect"},
    {"label": "Courtyard", "x": 30, "y": 55, "w": 40, "h": 30, "shape": "rect"}]}]}


def test_study_wrapped_card_keeps_the_set_visual():
    page = _page()
    try:
        u04 = _unit("u04")
        les = next(l for l in u04["lessons"] if l["id"] == "u04-l2")
        it = next(i for i in les["items"] if i["id"] == "u04-l2-i1")
        with_vis = it["sets"][0]
        assert "Label the" in with_vis["instr"], with_vis["instr"]
        with_vis["visual"] = _PLAN
        body = json.dumps(u04)
        page.route("**/data/ielts/u04.json*", lambda r: r.fulfill(status=200, content_type="application/json", body=body))
        _open(page)
        s = _finish(page, "u04-l2", {})
        ids = [q["id"] for st_ in it["sets"] for q in st_["items"]]
        assert all(s["cards"][i]["p"] == "u04-l2-i1" for i in ids), [s["cards"].get(i) for i in ids]
        # only the plan question is due: its wrapped item carries the plan
        page.evaluate("""(id) => { const s = JSON.parse(localStorage.getItem('ielts:study'));
          for(const [k, c] of Object.entries(s.cards)) if(k !== id) c.due += 30 * 864e5; else c.due -= 2 * 864e5;
          localStorage.setItem('ielts:study', JSON.stringify(s)); }""", with_vis["items"][0]["id"])
        L = page.evaluate("async () => (await IE.data.lesson('review')).lesson")
        assert [i["id"] for i in L["items"]] == ["rv-" + with_vis["items"][0]["id"]], [i["id"] for i in L["items"]]
        w = L["items"][0]
        assert w["title"] == f"Transcript · {it['title']}" and w["sets"][0]["visual"] == _PLAN, w["sets"][0].keys()
        assert w["sets"][0]["items"][0]["options"] == with_vis["items"][0]["options"]
        # a set without a visual doesn't get one
        q2 = it["sets"][1]["items"][0]["id"]
        page.evaluate("""([a, b]) => { const s = JSON.parse(localStorage.getItem('ielts:study'));
          s.cards[a].due += 60 * 864e5; s.cards[b].due -= 90 * 864e5; s.session = null;
          localStorage.setItem('ielts:study', JSON.stringify(s)); }""", [with_vis["items"][0]["id"], q2])
        L2 = page.evaluate("async () => (await IE.data.lesson('review')).lesson")
        assert [i["id"] for i in L2["items"]] == ["rv-" + q2] and "visual" not in L2["items"][0]["sets"][0], L2["items"][0]["sets"][0].keys()
        # the review lesson opens in the real player; a player that draws set visuals draws the plan
        page.evaluate("""(id) => { const s = JSON.parse(localStorage.getItem('ielts:study'));
          for(const c of Object.values(s.cards)) c.due += 120 * 864e5; s.cards[id].due -= 200 * 864e5; s.session = null;
          localStorage.setItem('ielts:study', JSON.stringify(s)); }""", with_vis["items"][0]["id"])
        _open(page, "#/lesson/review")
        page.wait_for_selector("#ie-item")
        player = (V.DATA.parents[1] / "js" / "ielts-player.js").read_text(encoding="utf-8")
        if "s.visual" in player:
            page.locator("#ie-item .ie-set figure.ie-viz").first.wait_for(state="attached", timeout=5000)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_study_exam_cap_and_secure_cards():
    page = _page()
    try:
        _open(page)
        les = _lesson("u01-l1")
        qs = [i for i in les["items"] if i["type"] in ("pick", "tfng")]
        _finish(page, "u01-l1", {})
        a, b = qs[0]["id"], qs[1]["id"]
        page.evaluate("""([a, b]) => { const s = JSON.parse(localStorage.getItem('ielts:study'));
          for(const k of Object.keys(s.cards)) if(k !== a && k !== b) delete s.cards[k];
          Object.assign(s.cards[a], {box: 2, hits: 1}); Object.assign(s.cards[b], {box: 4, hits: 2});
          const ex = new Date(Date.now() + 10 * 864e5);
          s.exam = {date: `${ex.getFullYear()}-${String(ex.getMonth() + 1).padStart(2, '0')}-${String(ex.getDate()).padStart(2, '0')}`, from: Date.now()};
          localStorage.setItem('ielts:study', JSON.stringify(s)); }""", [a, b])
        page.evaluate(_AGE, 2)
        assert page.evaluate("() => IE.study.capDays()") == 2   # max(1, 20% of 10 days)
        r = page.evaluate("""async () => {
          const L = (await IE.data.lesson('review')).lesson, ans = {};
          for(const it of L.items) ans[it.id] = it.answer;
          localStorage.setItem('ielts:run:review', JSON.stringify({v: 1, i: 0, ans, checked: {}, heard: {}, self: {}, el: 0, started: true, finished: true}));
          IE.prog.done('review', {got: 2, total: 2});
          await IE.study.settled();
          return {s: JSON.parse(localStorage.getItem('ielts:study')), d2: IE.study.addDays(Date.now(), 2), rec: IE.prog.lesson('review')};
        }""")
        ca, cb = r["s"]["cards"][a], r["s"]["cards"][b]
        assert ca["box"] == 3 and ca["due"] == r["d2"] and not ca.get("sec"), ca          # 14 days capped to 2
        assert cb["box"] == 5 and cb.get("sec") and cb["hits"] == 3, cb                   # right at box 4 with 3 hits: secure
        assert r["rec"] is None, "the virtual lesson reached ielts:data"
        page.evaluate(_AGE, 400)
        assert page.evaluate("() => IE.study.due()") == [a], page.evaluate("() => IE.study.due()")
        # a secure card missed again in a lesson comes back
        _finish(page, "u01-l1", {})
        cb = page.evaluate(_STUDY)["cards"][b]
        assert not cb.get("sec") and cb["box"] == 3, cb
        # without an exam date there is no cap
        page.evaluate("() => { const s = JSON.parse(localStorage.getItem('ielts:study')); s.exam = null; localStorage.setItem('ielts:study', JSON.stringify(s)); }")
        assert page.evaluate("() => IE.study.capDays()") is None or page.evaluate("() => IE.study.capDays() === Infinity")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_study_session_limits_shuffle_and_resume():
    page = _page()
    try:
        _open(page)
        for lid in ("u20-l1", "u20-l2", "u20-l3", "u21-l1", "u11-l1", "u13-l1"):
            _finish(page, lid, {})
        for lid in ("u07-l3", "u08-l3"):
            _finish(page, lid, {})
        page.evaluate(_AGE, 3)
        st = page.evaluate(_STUDY)
        due = page.evaluate("() => IE.study.due().length")
        assert due > 30 and sum(1 for c in st["cards"].values() if c.get("p")) > 8, due
        page.evaluate("() => localStorage.setItem('ielts:run:review', JSON.stringify({v: 1, i: 3, ans: {}, finished: true}))")
        L = page.evaluate("async () => (await IE.data.lesson('review')).lesson")
        assert page.evaluate("() => localStorage.getItem('ielts:run:review')") is None, "a new session didn't start afresh"
        items = L["items"]
        assert len(items) == 20 and sum(1 for i in items if i["type"] == "reading") <= 5, (len(items), [i["id"] for i in items])
        sess = page.evaluate(_STUDY)["session"]
        assert len(sess["ids"]) == 20 and sess["at"] > 0
        # oldest due first: no card left out is older than one taken
        eff = page.evaluate("""(ids) => { const s = JSON.parse(localStorage.getItem('ielts:study'));
          return Object.entries(s.cards).map(([k, c]) => [k, c.due, !!c.p, ids.includes(k)]); }""", sess["ids"])
        taken = [d for _, d, w, i in eff if i and not w]
        left = [d for _, d, w, i in eff if not i and not w]
        assert not left or min(left) >= max(taken), (min(left), max(taken))
        # the shuffle: only when safe, the answer remapped, never the identity
        orig = {}
        for lid in ("u20-l1", "u20-l2", "u20-l3", "u21-l1", "u11-l1", "u13-l1", "u07-l3", "u08-l3"):
            for it in _lesson(lid)["items"]:
                for q in ([q for st_ in it["sets"] for q in st_["items"]] if it.get("sets") else [it]):
                    orig[q["id"]] = q
        copies = []
        for it in items:
            for q in ([q for st_ in it["sets"] for q in st_["items"]] if it.get("sets") else [it]):
                copies.append(q)
        assert sess["ord"], "nothing was shuffled"
        strip = lambda o: [re.sub(r"^[A-Z][.)]?\s+", "", x) for x in o] if all(re.match(rf"^{chr(65 + j)}[.)]?\s+", x) for j, x in enumerate(o)) else list(o)
        for q in copies:
            o = orig[q["id"]]
            if q["type"] not in ("pick", "multi"):
                assert q == o, q["id"]
                continue
            safe = page.evaluate("(q) => IE.study.canShuffle(q)", o)
            ord_ = sess["ord"].get(q["id"])
            if not safe:
                assert ord_ is None and q["options"] == o["options"] and q["answer"] == o["answer"], q["id"]
                continue
            assert ord_ and ord_ != list(range(len(o["options"]))), (q["id"], ord_)
            so = strip(o["options"])
            assert q["options"] == [so[i] for i in ord_]
            if q["type"] == "pick":
                assert q["options"][q["answer"]] == so[o["answer"]], q["id"]
            else:
                assert sorted(q["options"][i] for i in q["answer"]) == sorted(so[i] for i in o["answer"]), q["id"]
        # option letters in the question or the explanation keep the order
        assert page.evaluate("(q) => IE.study.canShuffle(q)", orig["u11-l1-i6"]) is False
        # «A says…» and «the first option…» name an option too (both are learn items, so they'd be standalone cards)
        for lid, iid in (("u22-l2", "u22-l2-i5"), ("u01-l3", "u01-l3-i13")):
            q = next(i for i in _lesson(lid)["items"] if i["id"] == iid)
            assert page.evaluate("(q) => IE.study.canShuffle(q)", q) is False, iid
        lr = page.evaluate("""() => [IE.study.letterRefs('Option B summarises the trend.'), IE.study.letterRefs('A is wrong: it overstates.'),
          IE.study.letterRefs('(C) is a distractor'), IE.study.letterRefs('Paragraph C: the char insulates.'),
          IE.study.letterRefs('A case study first, then the figures.'), IE.study.letterRefs('Paragraphs B and D give the dates.'),
          IE.study.letterRefs('A says the same thing in neutral language.'), IE.study.letterRefs('Good. A uses the right word.'),
          IE.study.letterRefs('The first option is forced and overblown.'), IE.study.letterRefs('*A sharp rise in* is the standard collocation.'),
          IE.study.letterRefs('Ben first finds it persuasive.')]""")
        assert lr == [True, True, True, False, False, False, True, True, True, False, False], lr
        # a reload rebuilds the same lesson, in the real player too
        _open(page, "#/lesson/review")
        first = page.inner_text("#ie-item")
        page.evaluate("() => document.querySelector('#ie-item .ie-opt[data-v]').click()")
        page.wait_for_timeout(700)
        page.reload()
        page.wait_for_function("() => document.getElementById('app').dataset.ready === '#/lesson/review'")
        page.wait_for_timeout(200)
        assert page.inner_text("#ie-item") == first
        assert page.locator("#ie-item .ie-opt.is-on").count() == 1, "the answer wasn't kept"
        L2 = page.evaluate("async () => (await IE.data.lesson('review')).lesson")
        assert L2 == L, "the session changed after a reload"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_study_migration_from_finished_runs():
    page = _page()
    try:
        _open(page)
        les = _lesson("u01-l1")
        qs = [i for i in les["items"] if i["type"] in ("pick", "tfng")]
        page.evaluate("""([ans, at]) => {
          localStorage.removeItem('ielts:study');
          localStorage.setItem('ielts:run:u01-l1', JSON.stringify({v: 1, i: 11, ans, checked: {}, heard: {}, self: {}, el: 0, started: true, finished: true}));
          localStorage.setItem('ielts:run:u07-l2', JSON.stringify({v: 1, i: 0, ans: {}, checked: {}, heard: {}, self: {}, el: 0, started: true}));
          localStorage.setItem('ielts:data', JSON.stringify({v: 1, lessons: {'u01-l1': {done: true, at: Date.now() - 5 * 864e5, got: 1, total: 6}}, tests: [], essays: [], speaking: []}));
        }""", [{qs[0]["id"]: qs[0]["answer"]}, 0])
        _open(page, "#/", reload=True)
        page.evaluate("() => IE.study.settled()")
        s = page.evaluate(_STUDY)
        assert s and s.get("mig") == 1 and set(s["cards"]) == {q["id"] for q in qs}, s and sorted(s["cards"])
        assert not any(k.startswith("u07-l2") for k in s["cards"]), "an unfinished run was migrated"
        # made 5 days ago: the right one is due in 3 days from then, the missed ones are due now
        assert page.evaluate("() => IE.study.due().length") == len(qs), page.evaluate("() => IE.study.due()")
        n = len(s["log"])
        _open(page, "#/review", reload=True)
        page.evaluate("() => IE.study.settled()")
        assert len(page.evaluate(_STUDY)["log"]) == n, "migrated twice"

        # the first load opens straight on #/lesson/review (a reload there, a bookmark): the review waits for the
        # migration, so it plays the migrated cards and its session does not wipe them
        page.evaluate("() => { localStorage.removeItem('ielts:study'); localStorage.removeItem('ielts:run:review'); }")
        _open(page, "#/lesson/review", reload=True)
        page.evaluate("() => IE.study.settled()")
        s = page.evaluate(_STUDY)
        assert s and s.get("mig") == 1 and set(s["cards"]) == {q["id"] for q in qs}, s and sorted(s["cards"])
        assert len(s["log"]) == n, (len(s["log"]), n)
        assert s["session"] and sorted(s["session"]["ids"]) == sorted(q["id"] for q in qs), s["session"]
        assert "Nothing due today" not in page.inner_text("#app")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_study_notebook_tags_and_tables():
    page = _page()
    try:
        _open(page)
        r = page.evaluate("""() => {
          const T = IE.study.tagOf, g = (answer, limit, a) => T({type: 'gap', text: 'x ___', answer, limit}, a);
          const tf = (mode, answer, a) => T({type: 'tfng', mode, answer}, a);
          return {
            spelling: g(['accommodation'], 'ONE WORD ONLY', 'accomodation'),
            limit: g(['towel'], 'ONE WORD ONLY', 'an old towel'),
            limit2: g(['Fisher'], 'ONE WORD AND/OR A NUMBER', 'Ryan Fisher'),
            hyphen: g(['self-catering'], 'ONE WORD ONLY', 'self-catering'),
            hyphenMiss: g(['self-catering'], 'ONE WORD ONLY', 'self-caterring'),
            number: g(['1890'], 'A NUMBER', '1980'),
            number2: g(['15.50'], 'ONE WORD AND/OR A NUMBER', '£15.50'),
            number3: g(['12'], 'ONE WORD AND/OR A NUMBER', '12 May'),
            phone: g(['07700 911483', '07700911483'], 'A NUMBER', '07700 911438'),
            phoneOver: g(['07700 911483'], 'A NUMBER', 'mobile 07700 911438'),
            swaps: [g(['field'], 'ONE WORD ONLY', 'feild'), g(['their'], 'ONE WORD ONLY', 'thier'), g(['piano'], 'ONE WORD ONLY', 'paino')],
            plural: g(['station'], 'ONE WORD ONLY', 'stations'),
            plural2: g(['library'], 'ONE WORD ONLY', 'libraries'),
            wrong: g(['table'], 'ONE WORD ONLY', 'chair'),
            short: g(['bus'], 'ONE WORD ONLY', 'bed'),
            blank: g(['table'], 'ONE WORD ONLY', '  '),
            tng: tf('tfng', 'T', 'NG'), ngt: tf('tfng', 'NG', 'T'), fng: tf('tfng', 'F', 'NG'), tfx: tf('tfng', 'F', 'T'),
            yng: tf('ynng', 'Y', 'NG'), nng: tf('ynng', 'NG', 'N'), yn: tf('ynng', 'N', 'Y'), tfBlank: tf('tfng', 'T', null),
            pick: T({type: 'pick', options: ['a', 'b', 'c'], answer: 1}, 0), pickBlank: T({type: 'pick', options: ['a', 'b'], answer: 1}, null),
            multi: T({type: 'multi', options: ['a', 'b', 'c', 'd', 'e'], answer: [1, 3]}, [1, 2]), multiHalf: T({type: 'multi', options: ['a', 'b', 'c', 'd', 'e'], answer: [1, 3]}, [1]),
            right: g(['table'], 'ONE WORD ONLY', 'Table.'),
            lim: [IE.study.parseLimit('ONE WORD AND/OR A NUMBER'), IE.study.parseLimit('NO MORE THAN TWO WORDS'), IE.study.parseLimit('A NUMBER'), IE.study.parseLimit('TWO OR THREE WORDS')],
            kinds: [
              IE.study.kindOf({type: 'gap', text: 'a ___'}, 'Complete the form below. Write ONE WORD AND/OR A NUMBER for each answer.', {type: 'listening', part: 1}),
              IE.study.kindOf({type: 'gap', text: 'a ___'}, 'Questions 31-40. Complete the notes below.', {type: 'listening', part: 4}),
              IE.study.kindOf({type: 'gap', text: 'a ___'}, 'Complete the flow chart below.', {type: 'reading'}),
              IE.study.kindOf({type: 'gap', text: 'Surname: ___'}, 'Write ONE WORD.', {type: 'listening', part: 1}),
              IE.study.kindOf({type: 'select'}, 'The passage has seven paragraphs, A-G. Choose the correct heading for paragraphs B-G', {type: 'reading'}),
              IE.study.kindOf({type: 'select'}, 'Which paragraph contains the following information?', {type: 'reading'}),
              IE.study.kindOf({type: 'select'}, 'Complete each sentence with the correct ending, A-G.', {type: 'reading'}),
              IE.study.kindOf({type: 'select'}, 'Label the plan below.', {type: 'listening'}),
              IE.study.kindOf({type: 'select'}, 'Match each statement with the correct researcher, A-D.', {type: 'reading'}),
              IE.study.kindOf({type: 'tfng', mode: 'ynng'}, '', {type: 'reading'}),
              IE.study.kindOf({type: 'multi'}, 'Choose TWO letters, A-E.', {type: 'listening'})],
          }; }""")
        assert r["spelling"] == "spelling" and r["limit"] == "word limit" and r["limit2"] == "word limit", r
        assert r["hyphen"] is None and r["hyphenMiss"] == "spelling", r
        assert r["number"] == r["number2"] == r["number3"] == "number format", r
        # a phone number with a space is one number, not two words over the limit
        assert r["phone"] == "number format" and r["phoneOver"] == "word limit", r
        # swapping two adjacent letters is one slip, even in a short word
        assert r["swaps"] == ["spelling"] * 3, r["swaps"]
        assert r["plural"] == r["plural2"] == "singular/plural" and r["wrong"] == "wrong word" and r["short"] == "wrong word" and r["blank"] == "unanswered", r
        assert [r[k] for k in ("tng", "ngt", "fng", "tfx", "yng", "nng", "yn", "tfBlank")] == ["T↔NG", "T↔NG", "F↔NG", "T↔F", "Y↔NG", "N↔NG", "Y↔N", "unanswered"], r
        assert r["pick"] == "distractor" and r["pickBlank"] == "unanswered" and r["multi"] == "distractor" and r["multiHalf"] == "unanswered" and r["right"] is None, r
        assert r["lim"] == [{"w": 1, "n": 1}, {"w": 2, "n": 0}, {"w": 0, "n": 1}, {"w": 3, "n": 0}], r["lim"]
        assert r["kinds"] == ["form", "notes", "flow", "form", "headings", "info", "endings", "plan", "features", "ynng", "mc2"], r["kinds"]

        # a seeded log: what the Review page shows
        page.evaluate("""() => {
          const t = Date.now(), e = (k, s, ok, x) => Object.assign({q: 'q' + Math.random().toString(36).slice(2), l: 'u07-l2', k, s, ok, at: t - 864e5}, x || {});
          const log = [
            e('tfng', 'reading', true, {c: 'T', a: 'T'}), e('tfng', 'reading', false, {c: 'T', a: 'NG', tag: 'T↔NG'}), e('tfng', 'reading', false, {c: 'NG', a: 'T', tag: 'T↔NG'}),
            e('tfng', 'reading', false, {c: 'F', a: 'NG', tag: 'F↔NG'}), e('tfng', 'reading', true, {c: 'NG', a: 'NG'}),
            e('ynng', 'reading', false, {c: 'Y', a: 'N', tag: 'Y↔N'}), e('ynng', 'reading', true, {c: 'N', a: 'N'}),
            e('summary', 'reading', true), e('summary', 'reading', false, {tag: 'spelling'}), e('summary', 'reading', false, {tag: 'word limit'}),
            e('form', 'listening', true), e('form', 'listening', true), e('form', 'listening', false, {tag: 'number format'}), e('form', 'listening', false, {tag: 'unanswered'}),
            e('plan', 'listening', false, {tag: 'wrong match', g: 3, m: 5}), e('mc', 'reading', true),
            e('tfng', 'reading', false, {c: 'F', a: 'T', tag: 'T↔F', at: t - 40 * 864e5}),
            e('sentence', 'language', false, {tag: 'spelling', x: 1}), e('mc', 'reading', false, {tag: 'distractor', l: 'review'})];
          localStorage.setItem('ielts:study', JSON.stringify({v: 1, cards: {}, log, session: null, exam: null, calib: []}));
        }""")
        _open(page, "#/review")
        tags = page.evaluate("() => [...document.querySelectorAll('.ie-rv-tags li')].map(li => [li.querySelector('b b, span > b').textContent, +li.querySelector('.ie-rv-n').textContent])")
        assert tags[:2] in ([["T↔NG", 2], ["wrong match", 2]], [["wrong match", 2], ["T↔NG", 2]]), tags
        assert sorted(tags[2:]) == sorted([["F↔NG", 1], ["Y↔N", 1], ["spelling", 1], ["word limit", 1], ["number format", 1], ["unanswered", 1]]), tags
        txt = page.inner_text(".ie-rv-marks")
        assert "10 marks lost out of 20" in txt and "a hyphenated word counts as one" in txt, txt
        conf = page.evaluate("() => Object.fromEntries([...document.querySelectorAll('.ie-rv-conf td')].map(td => [td.dataset.r + td.dataset.c, +td.textContent]))")
        assert conf == {"TT": 1, "TF": 1, "TNG": 1, "FT": 1, "FF": 1, "FNG": 1, "NGT": 1, "NGF": 0, "NGNG": 1}, conf
        acc = page.evaluate("""() => [...document.querySelectorAll('.ie-rv-a')].map(li => [li.dataset.k, +li.querySelector('[data-n]').textContent,
          li.querySelector('[data-pct]').textContent, li.classList.contains('is-weak'), (li.querySelector('.ie-rv-link') || {}).hash || null])""")
        assert acc == [["reading|tfng", 6, "33%", True, "#/unit/u07"], ["reading|summary", 3, "33%", True, "#/unit/u09"],
                       ["listening|form", 4, "50%", True, "#/unit/u03"], ["reading|ynng", 2, "50%", False, None],
                       ["listening|plan", 5, "60%", False, None], ["reading|mc", 1, "100%", False, None]], acc
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


_MOUNT = """([kind, it, cur]) => {
  const a = document.getElementById('app');
  a.innerHTML = '<div class="ie-page ie-narrow"><div class="card ie-card" id="mount"></div></div>';
  const d = document.getElementById('mount');
  window.__c = cur; window.__saved = [];
  d.innerHTML = IE.assess.selfHtml(kind, cur, it);
  IE.assess.wireSelf(d, kind, () => window.__c, (c, b) => { window.__c = c; window.__saved.push([JSON.parse(JSON.stringify(c)), b]); }, it);
}"""


def _yn(page, ci, key, yes):
    page.locator(f".ie-crit[data-ci='{ci}'] [data-st='{ci}|{key}'] [data-yn='{1 if yes else 0}']").click()


def test_study_assess_component():
    page = _page()
    try:
        _open(page)
        it = {"id": "u13-l2-i2"}
        page.evaluate(_MOUNT, ["w2", it, None])
        assert page.locator("[data-calib]").count() == 0
        crit = page.evaluate("() => IE.assess.CRIT.w2.map(c => [c[0], c[2][7].length, c[2][8].length, c[2][9].length])")
        assert [c[0] for c in crit] == ["Task Response", "Coherence and Cohesion", "Lexical Resource", "Grammatical Range and Accuracy"]
        assert all(2 <= n <= 3 for c in crit for n in c[1:]), crit
        for kind in ("w1", "s"):
            assert all(2 <= len(c[2][b]) <= 3 for c in page.evaluate(f"() => IE.assess.CRIT.{kind}") for b in ("7", "8", "9"))
        taps = 0
        for i, b in enumerate([8, 8, 7, 8]):
            page.locator(f".ie-crit[data-ci='{i}'] [data-b='{b}']").click()
            taps += 1
        assert page.inner_text(".ie-selfres") == "Your estimate: band 8", page.inner_text(".ie-selfres")   # 7.75 → 8
        # criterion 0: every band 7 and 8 statement Yes, one band 9 No → checklist band 8 (as tapped: no warning)
        page.locator(".ie-crit[data-ci='0'] details summary").click()
        lists = page.evaluate("() => IE.assess.CRIT.w2[0][2]")
        for b in ("7", "8", "9"):
            for j in range(len(lists[b])):
                _yn(page, 0, f"{b}.{j}", not (b == "9" and j == 0))
                taps += 1
        assert "Checklist: band 8" in page.inner_text(".ie-crit[data-ci='0'] .ie-ck-st")
        assert "closer to an examiner" not in page.inner_text(".ie-crit[data-ci='0']")
        # criterion 2: tapped 7, checklist all Yes → 9, and the warning
        page.locator(".ie-crit[data-ci='2'] details summary").click()
        l2 = page.evaluate("() => IE.assess.CRIT.w2[2][2]")
        keys2 = [f"{b}.{j}" for b in ("7", "8", "9") for j in range(len(l2[b]))]
        for k in keys2[:-1]:
            _yn(page, 2, k, True)
            taps += 1
        assert page.evaluate("() => window.__c.calc[2]") is None, "an incomplete checklist counted"
        assert page.inner_text(".ie-selfres") == "Your estimate: band 8"
        _yn(page, 2, keys2[-1], True)
        taps += 1
        res = page.inner_text(".ie-crit[data-ci='2'] .ie-ck-res")
        assert "The checklist says 9, you said 7: the checklist is usually closer to an examiner." in res, res
        c = page.evaluate("() => window.__c")
        assert c["0"] == 8 and c["2"] == 7 and c["calc"] == {"0": 8, "2": 9}, c   # keys 0-3 stay the tapped bands
        assert len(c["ck"]["0"]) == sum(len(v) for v in lists.values()) and all(v is True for v in c["ck"]["2"].values())
        assert page.inner_text(".ie-selfres") == "Your estimate: band 8.5", page.inner_text(".ie-selfres")   # 8, 8, 9, 8
        saved = page.evaluate("() => window.__saved")
        assert len(saved) == taps and saved[-1][1] == 8.5, (len(saved), taps, saved[-1][1])
        # the rule: 6 if any band 7 No; 7 if any band 8 No; 8 if any band 9 No; else 9
        r = page.evaluate("""() => { const out = [];
          for(const kind of ['w1', 'w2', 's']){ const K = IE.assess.CRIT[kind];
            /* every criterion with the same answers: No to the first statement of each band in nos */
            const mk = (nos, skip) => { const ck = {}; K.forEach((c, i) => { const o = {}; for(const b of [7, 8, 9]) c[2][b].forEach((_, j) => { o[b + '.' + j] = !(nos.includes(b) && j === 0); });
              if(skip) delete o['8.0']; ck[i] = o; }); return {0: 5, 1: 5, 2: 5, 3: 5, ck}; };
            out.push([mk([]), mk([9]), mk([8]), mk([7]), mk([7, 9]), mk([8, 9]), mk([], true)].map(c => IE.assess.selfBand(c, kind))); }
          return out; }""")
        assert r == [[9, 8, 7, 6, 6, 7, 5]] * 3, r   # an incomplete checklist leaves the tapped band (5)
        old = page.evaluate("() => [IE.assess.selfBand({0: 7, 1: 8, 2: 7, 3: 8}, 'w2'), IE.player.selfBand({0: 7, 1: 8, 2: 7, 3: 8}, 'w2'), IE.assess.selfBand({0: 7, 1: 8, 2: 7}, 'w1')]")
        assert old == [7.5, 7.5, None], old
        # aria and keyboard: labelled radiogroups, one tab stop each, arrow keys choose and save
        aria = page.evaluate("""() => [...document.querySelectorAll('[role=radiogroup]')].map(g => {
          const l = document.getElementById(g.getAttribute('aria-labelledby'));
          return [!!(l && l.textContent.trim()), [...g.querySelectorAll('[role=radio]')].filter(r => r.tabIndex === 0).length]; })""")
        assert aria and all(x == [True, 1] for x in aria), aria
        assert page.evaluate("() => document.querySelector('.ie-selfres').getAttribute('aria-live')") == "polite"
        n0 = len(page.evaluate("() => window.__saved"))
        page.locator(".ie-crit[data-ci='1'] [data-b='8']").focus()
        page.keyboard.press("ArrowRight")
        assert page.evaluate("() => document.activeElement.dataset.b") == "9"
        assert page.evaluate("() => window.__c[1]") == 9 and len(page.evaluate("() => window.__saved")) == n0 + 1
        page.keyboard.press("ArrowLeft")
        assert page.evaluate("() => window.__c[1]") == 8
        sizes = page.evaluate("() => [...document.querySelectorAll('[data-yn], .ie-bands [role=radio], .ie-ck summary')].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })")
        assert sizes and all(w >= 44 and h >= 44 for w, h in sizes), [s for s in sizes if s[0] < 44 or s[1] < 44][:5]
        C.shot(page, "assess-phone", SHOTS)

        # a saved object comes back as it was
        page.evaluate(_MOUNT, ["w2", it, c])
        assert page.inner_text(".ie-selfres") == "Your estimate: band 8.5"
        assert page.evaluate("() => document.querySelector(\".ie-crit[data-ci='2'] [data-b='7']\").getAttribute('aria-checked')") == "true"

        # exemplar calibration: first, rated before the band shows
        ex = {"id": "u13-l2-i2", "exemplars": [{"band": 7, "text": ["First paragraph of a band 7 answer.", "Second paragraph."], "notes": ["Position clear but **under-developed**."]}]}
        page.evaluate(_MOUNT, ["w2", ex, None])
        order = page.evaluate("() => [...document.querySelectorAll('#mount [data-calib], #mount .ie-crit')].map(e => e.className)")
        assert order[0] == "ie-calib", order
        assert "Calibrate: rate this answer before you see its band" in page.inner_text("[data-calib]")
        assert "under-developed" not in page.inner_text("[data-calib]") and page.inner_text(".ie-cal-res") == ""
        page.locator("[data-calib] [data-g='8']").click()
        cal = page.evaluate("() => JSON.parse(localStorage.getItem('ielts:study')).calib")
        assert len(cal) == 1 and cal[0]["iid"] == "u13-l2-i2" and cal[0]["guess"] == 8 and cal[0]["band"] == 7 and cal[0]["at"] > 0, cal
        res = page.inner_text(".ie-cal-res")
        assert "You said 8; an examiner would give it 7." in res and "under-developed" in res, res
        assert "Your calibration: average error 1.0 over your last rating (aim for 0.5 or less)." in page.inner_text(".ie-cal-avg")
        assert page.evaluate("() => window.__saved.length") == 0, "calibration changed the self-marking"
        page.evaluate("""() => { const s = JSON.parse(localStorage.getItem('ielts:study'));
          for(const [g, b] of [[7, 7], [6, 7], [8, 8], [9, 8], [5, 9]]) s.calib.push({iid: 'other', x: 0, guess: g, band: b, at: Date.now()});
          localStorage.setItem('ielts:study', JSON.stringify(s)); }""")
        page.evaluate(_MOUNT, ["w2", ex, None])
        assert page.locator("[data-calib] [data-g]:disabled").count() == 5 and "You said 8" in page.inner_text(".ie-cal-res")
        assert "average error 1.2 over your last 5 ratings (aim for 0.5 or less)" in page.inner_text(".ie-cal-avg"), page.inner_text(".ie-cal-avg")   # (0+1+0+1+4)/5
        # the speaking criteria
        page.evaluate(_MOUNT, ["s", {"id": "u16-l2-i1"}, None])
        assert [x.strip() for x in page.locator(".ie-crit > p b").all_inner_texts()] == ["Fluency and Coherence", "Lexical Resource", "Grammatical Range and Accuracy", "Pronunciation"]
        assert "Accent has no effect on intelligibility." in page.text_content(".ie-crit[data-ci='3'] details")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_study_home_plan_icons_storage_and_erase():
    page = _page()
    try:
        # the icons, exactly as in index.html
        idx = (C.REPO / "index.html").read_text(encoding="utf-8")
        ie = (C.REPO / "ielts.html").read_text(encoding="utf-8")
        for n in ("cards-bold", "calendar-blank-bold", "target-bold", "eye-bold", "eye-slash-bold", "shuffle-bold"):
            m = re.search(rf'<symbol id="i-{n}".*?</symbol>', idx, re.S)
            assert m and ie.count(m.group(0)) == 1, n
        assert ie.index("js/ielts-player.js") < ie.index('<script src="js/ielts-study.js?v=29"></script>')

        _open(page)
        card = page.locator("#ie-rvcard")
        assert card.count() == 1 and "Review · Nothing due today" in card.inner_text()
        assert page.evaluate("() => document.querySelector('#ie-rvcard').nextElementSibling.classList.contains('ie-scores')")
        keys0 = set(page.evaluate("Object.keys(localStorage)"))
        assert "ielts:study" not in keys0, "ielts:study written with nothing to store"
        st = _finish(page, "u01-l1", {})
        # stamped on every write, so core's restore keeps whichever copy of ielts:study is newer
        assert isinstance(st.get("at"), (int, float)) and st["at"] > 0, st.get("at")
        page.evaluate(_AGE, 2)
        keys1 = set(page.evaluate("Object.keys(localStorage)"))
        assert keys1 - keys0 <= {"ielts:study", "ielts:run:u01-l1", "ielts:data"}, keys1 - keys0
        _open(page, "#/", reload=True)
        n = page.evaluate("() => IE.study.due().length")
        assert n == 6 and f"Review · {n} due" in page.inner_text("#ie-rvcard")
        # the wrappers are installed once, even if the file runs again
        same = page.evaluate("""async () => { const d = IE.prog.done, l = IE.data.lesson, h = IE.ROUTES.home;
          await new Promise(r => { const s = document.createElement('script'); s.src = 'js/ielts-study.js?again'; s.onload = r; document.body.appendChild(s); });
          return d === IE.prog.done && l === IE.data.lesson && h === IE.ROUTES.home; }""")
        assert same
        page.click("#ie-rvcard")
        page.wait_for_function("() => document.getElementById('app').dataset.ready === '#/review'")
        assert "6 questions due" in page.inner_text(".ie-rv-deck") and page.locator("#ie-rv-go").get_attribute("href") == "#/lesson/review"
        _open(page, "#/unit/review")
        assert page.locator(".ie-rv-deck").count() == 1

        # the exam plan
        ymd = page.evaluate("(d) => { const x = new Date(Date.now() + d * 864e5); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }", 71)
        page.fill("#ie-exam", ymd)
        page.wait_for_timeout(100)
        ex = page.evaluate(_STUDY)["exam"]
        assert ex["date"] == ymd and ex["from"] > 0, ex
        out = page.inner_text("#ie-plan-out")
        assert "10 weeks to go" in out and "Two timed practices a week" in out and "version 2" in out and "Review daily" in out and "Full mocks at about one third and two thirds" in out and "final mock 7–10 days before" in out, out
        assert "Real gains are about half a band per 10-12 weeks of intensive study (Elder & O'Loughlin 2003)." in page.inner_text(".ie-rv-plan")
        ymd3 = page.evaluate("(d) => { const x = new Date(Date.now() + d * 864e5); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }", 20)
        page.fill("#ie-exam", ymd3)
        page.wait_for_timeout(100)
        out = page.inner_text("#ie-plan-out")
        assert "2 weeks to go" in out and "Mocks, the mistake notebook and review only" in out and "Full mocks at about" not in out, out
        assert page.evaluate("() => IE.study.capDays()") == 4
        assert not re.search(r"streak|hurry|only \d+ days? left", page.inner_text("#app"), re.I)
        page.click("#ie-exam-x")
        assert page.evaluate(_STUDY)["exam"] is None

        # rewrite from memory: first versions older than 3 days without a version 2
        page.evaluate("""() => { const d = JSON.parse(localStorage.getItem('ielts:data')) || {v: 1, lessons: {}, tests: [], speaking: []}, t = Date.now(), D = 864e5;
          const e = (id, task, at, x) => Object.assign({id, iid: 'u13-l2-i2', task, prompt: 'Some people *believe* that cities should ban cars from their centres. To what extent do you agree?', text: 'x', words: 260, self: null, band: 7, at: t - at * D}, x || {});
          d.essays = [e('a1', 2, 5), e('a2', 2, 1), e('a3', 1, 10), e('a3-v2', 1, 8, {parent: 'a3', v: 2}), e('a4', 2, 20), e('a5', 1, 30), e('a6', 2, 40)];
          localStorage.setItem('ielts:data', JSON.stringify(d)); }""")
        _open(page, "#/review", reload=True)
        hrefs = page.evaluate("() => [...document.querySelectorAll('[aria-labelledby=ie-rv-wh] a.ie-row')].map(a => a.getAttribute('href'))")
        assert hrefs == ["#/essays/a1/revise?blank=1", "#/essays/a4/revise?blank=1", "#/essays/a5/revise?blank=1"], hrefs
        assert "Rewrite from memory" in page.inner_text("[aria-labelledby=ie-rv-wh]")

        # only ielts:study is written; Erase in Settings removes it
        assert not [k for k in page.evaluate("Object.keys(localStorage)") if not k.startswith("ielts:")]
        _open(page, "#/settings")
        page.click("#ie-erase")
        page.wait_for_function("() => document.getElementById('app').dataset.ready === '#/'")
        page.wait_for_timeout(300)
        assert page.evaluate("() => localStorage.getItem('ielts:study')") is None
        assert "Nothing due today" in page.inner_text("#ie-rvcard")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def _hue_bad(page):
    """elements in #app whose colour (text, background, border) is purple, lilac, violet or pink (hue 260-340°)"""
    cols = page.evaluate("""() => { const out = new Set();
      for(const el of document.querySelectorAll('#app *, #ie-top *')){ const cs = getComputedStyle(el);
        for(const p of ['color', 'backgroundColor', 'borderTopColor']) out.add(cs[p]); }
      return [...out]; }""")
    bad = []
    for c in cols:
        m = re.match(r"rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)", c)
        if not m or (m.group(4) is not None and float(m.group(4)) < .05):
            continue
        h, l, s = colorsys.rgb_to_hls(*(float(m.group(i)) / 255 for i in (1, 2, 3)))
        if s > .25 and .08 < l < .95 and 260 <= h * 360 <= 340:
            bad.append(c)
    return bad


def test_study_screens_both_themes():
    seed = """() => { const t = Date.now(), D = 864e5;
      const e = (k, s, ok, x) => Object.assign({q: 'q' + Math.random().toString(36).slice(2), l: 'u07-l2', k, s, ok, at: t - D}, x || {});
      const log = [e('tfng', 'reading', false, {c: 'T', a: 'NG', tag: 'T↔NG'}), e('tfng', 'reading', false, {c: 'NG', a: 'F', tag: 'F↔NG'}), e('tfng', 'reading', true, {c: 'F', a: 'F'}),
        e('summary', 'reading', false, {tag: 'word limit'}), e('summary', 'reading', true), e('summary', 'reading', false, {tag: 'spelling'}),
        e('form', 'listening', false, {tag: 'number format'}), e('form', 'listening', true), e('form', 'listening', true),
        e('headings', 'reading', false, {tag: 'wrong match', g: 4, m: 6}), e('mc', 'listening', false, {tag: 'distractor'}), e('mc', 'listening', true), e('mc', 'listening', true)];
      const cards = {}; for(let i = 1; i <= 9; i++) cards[`u20-l1-i${i}`] = {lid: 'u20-l1', box: i % 3, due: t - D, hits: 1, last: t - 3 * D, n: 2};
      const x = new Date(t + 75 * D), ymd = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
      localStorage.setItem('ielts:study', JSON.stringify({v: 1, cards, log, session: null, exam: {date: ymd, from: t - 7 * D}, calib: [], mig: 1}));
      localStorage.setItem('ielts:data', JSON.stringify({v: 1, lessons: {}, tests: [], speaking: [], essays: [{id: 'e1', iid: 'u13-l2-i2', task: 2, prompt: 'Some people believe that cities should ban private cars from their centres. To what extent do you agree?', text: 'x', words: 270, self: null, band: 7, at: t - 6 * D}]}));
    }"""
    for kind, scheme, w in (("phone", "light", 360), ("phone", "dark", 360), ("desk", "light", 1280), ("desk", "dark", 1280)):
        kw = {"viewport": {"width": 360, "height": 740}} if w == 360 else {}
        page = _page(kind, color_scheme=scheme, **kw)
        try:
            _open(page)
            page.evaluate(seed)
            for h, name in (("#/", "home"), ("#/review", "review")):
                _open(page, h, reload=True)
                sw = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                assert sw <= 1, f"{w} {scheme} {h}: horizontal scroll {sw}px"
                assert not _hue_bad(page), (h, _hue_bad(page))
                if h == "#/review":
                    small = page.evaluate("""() => [...document.querySelectorAll('.ie-rv a, .ie-rv button, .ie-rv input')].filter(b => b.offsetParent)
                      .map(b => { const r = b.getBoundingClientRect(); return [b.id || b.className || b.tagName, Math.round(r.height)]; }).filter(x => x[1] < 44)""")
                    assert not small, small
                    assert page.locator(".ie-rv-a.is-weak .ie-rv-link").count() == 3
                C.shot(page, f"{name}-{w}-{scheme}", SHOTS)
            page.evaluate(_MOUNT, ["w1", {"id": "u11-l2-i2", "exemplars": [{"band": 7, "text": ["The line graph compares the proportion of commuters who used four modes of transport in a city between 1990 and 2020.", "Overall, the car remained dominant despite a steady fall, while cycling grew the most."], "notes": ["Accurate overview, but key figures are not compared."]}]}, {"0": 8, "1": 7}])
            page.locator(".ie-crit[data-ci='0'] details summary").click()
            page.locator(".ie-crit[data-ci='0'] [data-st='0|7.0'] [data-yn='1']").click()
            page.locator(".ie-crit[data-ci='0'] [data-st='0|7.1'] [data-yn='0']").click()
            sw = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            assert sw <= 1, f"{w} {scheme} assess: horizontal scroll {sw}px"
            assert not _hue_bad(page), _hue_bad(page)
            C.shot(page, f"assess-{w}-{scheme}", SHOTS)
            assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()
