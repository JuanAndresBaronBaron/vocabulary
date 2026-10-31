"""IELTS Prep, package content1: answer keys, word limits, question types, Task 1 coverage and the drawn visuals.

Reads data/ielts/*.json directly (no browser), except the last test, which draws the new visuals with js/ielts-viz.js.
- The keys fixed in this package, and the variants every learner should get credit for.
- No accepted gap answer in u01-u12 goes over its word limit.
- The plan (u04), the diagram (u09) and the tables to complete have a visual whose markers or numbered blanks match
  the numbers the player gives the questions.
- Units 3-10 practise sentence, summary and table completion, short answers, diagram labelling and Choose TWO.
- Unit 11 covers line, bar, pie and table Task 1 visuals and ends with a timed (20-minute) Task 1.
- The diagnostic test of u02 does not bunch its keys on one letter.
- SCHEMA.md documents every new field.
"""
from __future__ import annotations

import json
import re
from collections import Counter

import common as C
import ielts_validate as V

_IN = "localStorage.setItem('ielts:on', 'true'); sessionStorage.setItem('ielts:in', '1');"


def _unit(n):
    return json.loads((V.DATA / f"u{n:02d}.json").read_text(encoding="utf-8"))


def _walk(o):
    if isinstance(o, dict):
        yield o
        for v in o.values():
            yield from _walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from _walk(v)


_UNITS = {}


def _u(n):
    if n not in _UNITS:
        _UNITS[n] = _unit(n)
    return _UNITS[n]


def _find(oid):
    for o in _walk(_u(int(oid[1:3]))):
        if o.get("id") == oid:
            return o
    raise AssertionError(f"{oid} is missing")


def _ids(n):
    return {o["id"] for o in _walk(_u(n)) if isinstance(o.get("id"), str)}


def _marks(q):
    return len(q["rows"]) if q["type"] == "select" else len(q["answer"]) if q["type"] == "multi" else 1


def _numbers(lesson):
    """The number the player shows for each scored question of a lesson (js/ielts-player.js, questions())."""
    out, n = {}, 1
    for it in lesson["items"]:
        qs = [q for s in it["sets"] for q in s["items"]] if it.get("sets") else [it] if it["type"] in V.SCORED else []
        for q in qs:
            out[q["id"]] = list(range(n, n + _marks(q)))
            n += _marks(q)
    return out


def _sets(units):
    """(unit, lesson, item, set) for every reading or listening set of the given units."""
    for n in units:
        for les in _u(n)["lessons"]:
            for it in les["items"]:
                for s in it.get("sets") or []:
                    yield n, les, it, s


def _words(paras):
    return sum(len(p.split()) for p in paras)


def test_ielts_content1_keys():
    """The keys and accepted answers fixed in content1."""
    def accepts(qid, *answers):
        got = [a.lower() for a in _find(qid)["answer"]]
        missing = [a for a in answers if a.lower() not in got]
        assert not missing, (qid, missing, got)

    # u02-l1 (diagnostic): Thursday's group starts on the 14th, two days after Tuesday's
    q = _find("u02-l1-i2-q2")
    assert q["answer"][0] == "14th", q["answer"]
    accepts("u02-l1-i2-q2", "14", "fourteenth", "14 September")
    it = _find("u02-l1-i2")
    assert any("on the fourteenth" in ln["t"] and "twelfth" in ln["t"] for ln in it["script"]), "the script must give both dates"
    assert "questions 1 to 7" in it["context"], it["context"]
    # a unit printed beside the gap may be typed too; figures and their variants
    accepts("u02-l1-i2-q3", "185", "£185")
    accepts("u03-l3-i1-q5", "150", "£150")
    accepts("u03-l3-i1-q8", "11.50", "£11.50")
    accepts("u03-l1-i11-q1", "12.50", "£12.50")
    accepts("u03-l2-i1-q3", "10.15", "10:15")
    accepts("u03-l3-i1-q4", "11", "11 pm")
    accepts("u05-l3-i1-q6", "15", "15 minutes")
    accepts("u03-l1-i7-q1", "30th", "30 May")
    accepts("u03-l3-i1-q3", "12th", "12 June")
    lines = " ".join(ln["t"] for ln in _find("u03-l1-i7")["script"])
    assert "twenty-fifth" in lines and "twenty-third" not in lines, "u03-l1-i7: the rejected date is the 25th (a Monday)"
    assert _find("u03-l1-i12-q1")["answer"] == ["photographs"], "the plural -s is part of the answer"
    # variants that must earn the mark
    accepts("u07-l3-i1-q13", "restored towers", "towers")
    accepts("u09-l2-i1-q13", "concrete core", "core")
    accepts("u02-l2-i1-q9", "sodium lamps", "sodium")
    accepts("u11-l1-i8", "plateaued", "levelled off", "levelled out", "stabilised", "held steady")
    accepts("u12-l1-i10", "was converted", "has been converted", "was turned")
    accepts("u12-l1-i7", "it", "instead, it")
    # keys that were wrong or arguable
    q = _find("u07-l3-i1-q5")
    assert q["answer"] == "F" and "Rain" in q["statement"], q
    assert "There is no agreement" in _find("u07-l1-i7")["paragraphs"][1]["text"], "u07-l1-i7-q3 needs its evidence"
    assert _find("u10-l2-i1-q11")["options"][3] == "D  offers nothing to hold our attention."
    assert any(r["label"] == "Part of the woodland made way for a hotel." and r["answer"] == 0 for r in _find("u12-l1-i12")["rows"])
    q = _find("u04-l3-i1-q1")
    assert len(q["options"]) == 7 and q["options"][5].startswith("F") and q["options"][6].startswith("G"), "seven people for five rows"
    script = " ".join(ln["t"] for ln in _find("u04-l3-i1")["script"])
    assert "Sam" in script and "café manager" in script, "the extra options are mentioned in the talk"


def test_ielts_content1_limits():
    """Every accepted gap answer of u01-u12 fits its word limit (ielts.org: over the limit loses the mark)."""
    over = []
    for n in range(1, 13):
        for o in _walk(_u(n)):
            if o.get("type") == "gap":
                assert V.limit_of(o["limit"]) is not None, (o["id"], o["limit"])
                over += [(o["id"], a, o["limit"]) for a in o["answer"] if not V.fits(a, o["limit"])]
    assert not over, over


def test_ielts_content1_numbers():
    """Sets headed "Questions a-b" carry the numbers the player gives them; numbered blanks in a table and numbered
    markers on a diagram match the questions below them; a plan's letters are the options."""
    checked = Counter()
    for n, les, it, s in _sets(range(1, 13)):
        nums = _numbers(les)
        got = [k for q in s["items"] for k in nums[q["id"]]]
        m = re.match(r"Questions (\d+)-(\d+)\.", s["instr"])
        if m:
            assert (got[0], got[-1]) == (int(m[1]), int(m[2])), (it["id"], s["instr"][:40], got)
            checked["heading"] += 1
        v = s.get("visual")
        if not v:
            continue
        if v["kind"] == "table":
            cells = " ".join(c for r in v["rows"] for c in r)
            blanks = [int(x) for x in re.findall(r"\((\d+)\) _{4,}", cells)]
            gaps = [k for q in s["items"] if q["type"] == "gap" for k in nums[q["id"]]]
            assert blanks == gaps, (it["id"], blanks, gaps)
            checked["table"] += 1
        if v["kind"] == "map":
            marks = [z["label"] for mp in v["maps"] for z in mp["items"] if z.get("mark")]
            assert len(marks) == len(set(marks)) and marks, (it["id"], marks)
            if all(x.isdigit() for x in marks):
                assert sorted(map(int, marks)) == got, (it["id"], marks, got)
            else:
                opts = sorted({o.split()[0] for q in s["items"] for o in q.get("options", [])})
                assert sorted(marks) == opts, (it["id"], marks, opts)
            # the learner supplies the name: a marked place is never also labelled in words
            assert all(len(z["label"]) <= 3 for mp in v["maps"] for z in mp["items"] if z.get("mark"))
            checked["map"] += 1
    assert checked["table"] >= 2 and checked["map"] >= 2 and checked["heading"] >= 3, checked


def test_ielts_content1_plan():
    """u04-l2-i1: "Label the plan" with a drawn plan, markers A-G and the main entrance shown."""
    s = _find("u04-l2-i1")["sets"][0]
    assert s["instr"].startswith("Label the plan below"), s["instr"]
    v = s["visual"]
    assert v["kind"] == "map" and len(v["maps"]) == 1, v
    items = v["maps"][0]["items"]
    assert sorted(z["label"] for z in items if z.get("mark")) == list("ABCDEFG")
    assert {"River", "Main entrance"} <= {z["label"] for z in items}
    q = s["items"][0]
    assert q["type"] == "select" and len(q["rows"]) == 5 and len({r["answer"] for r in q["rows"]}) == 5, q


def test_ielts_content1_types():
    """Units 3-10 practise every completion type, short answers, diagram labelling and Choose TWO."""
    found = {}

    def seen(kind, where):
        found.setdefault(kind, []).append(where)

    for n, les, it, s in _sets(range(3, 11)):
        ins, qs = s["instr"], s["items"]
        gaps = all(q["type"] == "gap" for q in qs)
        if "Complete the sentences" in ins and gaps:
            seen("sentence completion", it["id"])
        if "Complete the summary" in ins and all(q["type"] in ("gap", "select") for q in qs):
            seen("summary completion", it["id"])
        if "Answer the questions" in ins and gaps and all("?" in q["text"] for q in qs):
            seen("short-answer questions", it["id"])
        if "Label the diagram" in ins and (s.get("visual") or {}).get("kind") == "map":
            seen("diagram labelling", it["id"])
        if "Complete the table" in ins and (s.get("visual") or {}).get("kind") == "table" and gaps:
            seen("table completion", it["id"])
        if any(q["type"] == "multi" and len(q["answer"]) == 2 and len(q["options"]) == 5 for q in qs) and "Choose TWO" in ins:
            seen("choose TWO", it["id"])
    want = ["sentence completion", "summary completion", "short-answer questions", "diagram labelling", "table completion", "choose TWO"]
    assert [k for k in want if k not in found] == [], found
    # reading has its own diagram labelling and short answers (u09), listening its own short answers (u04)
    assert any(x.startswith("u09") for x in found["diagram labelling"]) and any(x.startswith("u04") for x in found["short-answer questions"])
    # every "Complete the table" and "Label the" set in the course draws what it refers to
    for n, les, it, s in _sets(range(1, 13)):
        if "Complete the table" in s["instr"]:
            assert (s.get("visual") or {}).get("kind") == "table", it["id"]
        if "Label the" in s["instr"]:
            assert (s.get("visual") or {}).get("kind") == "map", it["id"]


def test_ielts_content1_task1():
    """Unit 11 covers line, bar, pie and table visuals, and ends with a timed Task 1 (20 minutes) on two visuals."""
    u = _u(11)
    kinds = set()
    for les in u["lessons"]:
        for it in les["items"]:
            if it["type"] == "writing" and it["task"] == 1:
                kinds |= {v["kind"] for v in (it.get("visual"), it.get("visual2")) if v}
    assert {"line", "bar", "pie", "table"} <= kinds, kinds
    tests = [les for les in u["lessons"] if les["kind"] == "test"]
    assert tests and tests[-1]["timed"] == 1200, [(les["id"], les.get("timed")) for les in tests]
    w = [it for it in tests[-1]["items"] if it["type"] == "writing"]
    assert len(w) == 1 and w[0]["task"] == 1 and w[0]["minutes"] == 20 and w[0]["minWords"] == 150
    assert w[0]["visual"]["kind"] == "pie" and w[0]["visual2"]["kind"] == "table"
    assert "Write at least 150 words." in w[0]["prompt"]
    bar = _find("u11-l4-i4")
    assert bar["visual"]["kind"] == "bar" and len(bar["visual"]["series"]) == 2
    for it in (bar, w[0]):
        n = _words(it["model"]["text"])
        assert 170 <= n <= 230, (it["id"], n, "the unit advises about 170-230 words")
    # the pies add up, and the table total is the sum of its rows
    for c in w[0]["visual"]["charts"]:
        assert sum(s["value"] for s in c["slices"]) == 100, c["title"]
    rows = w[0]["visual2"]["rows"]
    for col in (1, 2):
        assert sum(int(r[col]) for r in rows[:-1]) == int(rows[-1][col]), (col, rows)
    # the comparisons in the bar-chart practice are checked against the figures
    assert _find("u11-l4-i2")["answer"] == 1 and _find("u11-l4-i3")["answer"] == 0


def test_ielts_content1_spread():
    """The u02 diagnostic test uses A, B and C, none for more than half of its pick keys; so does every test."""
    les = next(x for x in _u(2)["lessons"] if x["id"] == "u02-l1")
    assert les["kind"] == "test"
    keys = [q["answer"] for it in les["items"] for q in ([q for s in it.get("sets") or [] for q in s["items"]] or [it]) if q.get("type") == "pick"]
    c = Counter(keys)
    assert len(keys) >= 4 and set(c) == {0, 1, 2} and max(c.values()) <= len(keys) / 2, (keys, c)
    for n in range(1, 13):
        for les in _u(n)["lessons"]:
            if les["kind"] != "test":
                continue
            keys = [o["answer"] for o in _walk(les["items"]) if o.get("type") == "pick"]
            if len(keys) >= 4:
                assert max(Counter(keys).values()) <= len(keys) / 2, (les["id"], keys)


def test_ielts_content1_ids():
    """New questions and lessons take the next free number; removed ids are never reused."""
    new = ["u09-l3-i1-q14", "u09-l3-i1-q15", "u09-l3-i1-q16", "u09-l3-i1-q17", "u09-l2-i1-q14", "u09-l2-i1-q15",
           "u09-l2-i1-q16", "u10-l2-i1-q12", "u11-l4", "u11-l4-i4", "u11-l5", "u11-l5-i1"]
    have = set().union(*(_ids(n) for n in (9, 10, 11)))
    assert [x for x in new if x not in have] == [], "missing new ids"
    gone = ["u09-l3-i1-q6", "u09-l3-i1-q7", "u09-l3-i1-q8", "u09-l3-i1-q9"]
    assert [x for x in gone if x in have] == [], "a removed id came back: saved runs would mark the wrong question"
    # the diagram questions keep their old first id (q5) and then take q14-q17, in the order of the diagram
    s = _find("u09-l3-i1")["sets"][1]
    assert [q["id"] for q in s["items"]] == ["u09-l3-i1-q5", "u09-l3-i1-q14", "u09-l3-i1-q15", "u09-l3-i1-q16", "u09-l3-i1-q17"]


def test_ielts_content1_schema_doc():
    """SCHEMA.md documents every field the validator now accepts, and the word limits."""
    doc = (V.DATA / "SCHEMA.md").read_text(encoding="utf-8")
    fields = ["exam", "pause", "accent", "visual", "mark", "visual2", "followups", "exemplars"]
    assert [f for f in fields if not re.search(r"`" + re.escape(f) + r"(?![\w])", doc)] == []
    for s in ("### Word limits", "### Exam rules the validator enforces", "AND/OR A NUMBER", "Label the", "Never renumber an id"):
        assert s in doc, s


def test_ielts_content1_visuals_render():
    """The plan, the diagram, the tables and the new Task 1 charts draw on a 360 px phone, light and dark: bars have
    their height, markers show, nothing overflows sideways and no SVG label is cut off."""
    vis = {
        "plan": (_find("u04-l2-i1")["sets"][0]["visual"], 7),
        "diagram": (_find("u09-l3-i1")["sets"][1]["visual"], 5),
        "table-u09": (_find("u09-l2-i1")["sets"][2]["visual"], 0),
        "table-u03": (_find("u03-l3-i1")["sets"][1]["visual"], 0),
        "bar": (_find("u11-l4-i4")["visual"], 0),
        "pies": (_find("u11-l5-i1")["visual"], 0),
        "table-u11": (_find("u11-l5-i1")["visual2"], 0),
    }
    for scheme in ("light", "dark"):
        page = C.new_page("phone", color_scheme=scheme, viewport={"width": 360, "height": 800})
        try:
            page.add_init_script(_IN)
            page.goto(C.base_url(page) + "/ielts.html#/")
            page.wait_for_function("() => window.IE && IE.viz", timeout=10000)
            for name, (v, nmarks) in vis.items():
                r = page.evaluate("""v => { const a = document.getElementById('app');
                  a.innerHTML = `<div class="card ie-card" style="margin:16px"><figure class="ie-viz">${IE.viz.html(v)}</figure></div>`;
                  const f = a.querySelector('figure'), s = f.querySelector('svg.ie-svg'), out = {};
                  out.hscroll = document.documentElement.scrollWidth - document.documentElement.clientWidth;
                  out.tables = [...f.querySelectorAll('.ie-tw')].filter(t => !t.closest('details')).map(t => t.scrollWidth - t.clientWidth);
                  out.ticks = [...f.querySelectorAll('svg .ie-tick')].map(t => t.textContent);
                  out.marks = f.querySelectorAll('.ie-mk').length;
                  out.cols = [...f.querySelectorAll('rect.ie-col')].map(r => r.getBBox().height);
                  if(s){ const b = s.getBoundingClientRect();
                    out.cut = [...s.querySelectorAll('text')].filter(t => { const x = t.getBoundingClientRect(); return x.right > b.right + .5 || x.left < b.left - .5; }).map(t => t.textContent); }
                  else out.cut = [];
                  return out; }""", v)
                assert r["hscroll"] <= 0 and all(x <= 0 for x in r["tables"]), (scheme, name, r)
                assert r["cut"] == [], (scheme, name, r["cut"])
                assert r["marks"] == nmarks, (scheme, name, r["marks"])
                if name == "bar":
                    # the player's progress bar (.ie-bar, 4 px high) once flattened every column: heights follow the values,
                    # and the axis stops at the round step above the largest value (52% -> 60%, not 100%)
                    vals = [x for s in v["series"] for x in s["values"]]
                    assert len(r["cols"]) == len(vals) and max(r["cols"]) > 200, r["cols"]
                    assert all(abs(h / max(r["cols"]) - x / max(vals)) < .02 for h, x in zip(r["cols"], vals)), r["cols"]
                    assert "60%" in r["ticks"] and "100%" not in r["ticks"], r["ticks"]
            assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()
