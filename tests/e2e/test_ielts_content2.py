"""IELTS Prep content, package content2: the two mock tests (u23, u24) and the keys of u13-u22.

The tests read the JSON directly (no browser), except the last one:
- rules: content1's three exam rules hold on u13-u24 (every accepted gap answer fits its limit, every «Label the» set
  has a visual, in a test lesson with 4 or more picks no index holds more than half of the keys), and the new
  fields keep their shapes (exam, pause on a Narrator line, accent, mark, followups, exemplars).
- listening: u23-l1 and u24-l1 are full papers in exam mode: exam:true, a Narrator who gives one pause halfway through
  Parts 1-3 that previews the next set, forty marks numbered 1-40, an accent other than gb in Parts 2-4, and the
  card's timing.
- keys: the corrected answers and the variants that must score, the drawn plan of u23-l1-i3, the ids that left
  and the ids that came, and no id twice.
- reading: forty marks in 17 + 20 + 23 minutes; each mock has short-answer or sentence completion and a table or a
  Choose TWO.
- writing: Mock 1's Task 1 is unseen (not u11-l2-i2) and every figure in its model is on the chart; the official
  rubric lines; Task Achievement is named only for Task 1.
- speaking: 12 Part 1 questions, Part 2 follow-ups and talks of about 300 words, Part 3 answers of 90-130 words
  (u17, u18, u23, u24).
- exemplars: a band 7 essay beside the model in u13-l2-i2 and u14-l2-i2.
- collocations: the rewritten picks offer real collocates; the why puts the right phrase in bold and explains every
  distractor; the keys of u13-u22 are spread and each why names the right letter.
- visuals_render: the new plan, table and bar chart drawn by IE.viz.html on a phone (390 px), light and dark (screenshots in
  VOCAB_CAPTURAS/content2).
"""
from __future__ import annotations

import json
import os
import re
from collections import Counter

import common as C
import ielts_validate as V

_IN = "localStorage.setItem('ielts:on', 'true'); sessionStorage.setItem('ielts:in', '1');"
_U = {}


def _unit(n):
    k = f"u{int(n):02d}"
    if k not in _U:
        _U[k] = json.loads((V.DATA / f"{k}.json").read_text(encoding="utf-8"))
    return _U[k]


def _walk(o):
    if isinstance(o, dict):
        yield o
        for v in o.values():
            yield from _walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from _walk(v)


def _find(id_):
    hits = [o for o in _walk(_unit(int(id_[1:3]))) if o.get("id") == id_]
    assert len(hits) == 1, (id_, len(hits))
    return hits[0]


def _has(id_):
    return any(o.get("id") == id_ for n in range(13, 25) for o in _walk(_unit(n)))


def _words(x):
    return len((" ".join(x) if isinstance(x, list) else str(x)).split())


def _marks(q):
    t = q.get("type")
    if t == "select":
        return len(q["rows"])
    if t == "multi":
        return len(q["answer"])
    return 1


def _sets(it):
    return it.get("sets") or [{"items": [it]}]


# ---------------------------------------------------------------- content1's limit rule, re-implemented
_LIMIT = re.compile(r"(?:NO MORE THAN )?(ONE|TWO|THREE)(?: OR (TWO|THREE))? WORDS?(?: ONLY)?( AND/OR A NUMBER)?")
_N = {"ONE": 1, "TWO": 2, "THREE": 3}


def limit_of(limit):
    s = re.sub(r"\s+", " ", str(limit or "")).strip().upper()
    if s == "A NUMBER":
        return (0, 1)
    m = _LIMIT.fullmatch(s)
    return (_N[m.group(2) or m.group(1)], 1 if m.group(3) else 0) if m else None


def count_answer(a):
    """(words, numbers): a hyphenated word is one word; a run of tokens with digits is one number."""
    words = nums = 0
    prev = False
    for tok in str(a).split():
        if re.search(r"\d", tok):
            nums += 0 if prev else 1
            prev = True
        else:
            words += 1
            prev = False
    return words, nums


def fits(answer, limit):
    lim = limit_of(limit)
    if lim is None:
        return False
    w, n = count_answer(answer)
    return w <= lim[0] and n <= lim[1]


def test_ielts_content2_rules():
    assert fits("14th", "ONE WORD AND/OR A NUMBER") and not fits("the fourteenth", "ONE WORD AND/OR A NUMBER")
    assert fits("20 minutes", "ONE WORD AND/OR A NUMBER") and fits("£120", "A NUMBER") and not fits("a darker", "ONE WORD ONLY")
    bad = []
    for n in range(13, 25):
        for les in _unit(n)["lessons"]:
            lid, picks = les["id"], []
            if "exam" in les:
                kinds = {it["type"] for it in les["items"]}
                if les["exam"] is not True or les.get("kind") != "test" or "listening" not in kinds or not kinds <= {"listening", "card"}:
                    bad.append(f"{lid}: exam is for a test of listening and cards only")
            for it in les["items"]:
                for s in _sets(it):
                    if "label the" in s.get("instr", "").lower() and "visual" not in s:
                        bad.append(f"{it['id']}: a 'Label the' set without a visual")
                    for q in s["items"]:
                        if q.get("type") == "pick":
                            picks.append(q["answer"])
                        if q.get("type") == "gap":
                            if limit_of(q.get("limit")) is None:
                                bad.append(f"{q['id']}: unknown limit {q.get('limit')!r}")
                            bad += [f"{q['id']}: {a!r} does not fit {q['limit']}" for a in q["answer"] if not fits(a, q["limit"])]
                    m = s.get("visual", {})
                    for mp in m.get("maps", []) if m.get("kind") == "map" else []:
                        bad += [f"{it['id']}: bad marker {z}" for z in mp["items"] if "mark" in z and (z["mark"] is not True or len(z["label"].strip()) > 3)]
                        # content1's viz draws the outline of a marked place only when it names its shape
                        bad += [f"{it['id']}: marker {z['label']} has a box but no shape" for z in mp["items"]
                                if z.get("mark") and (z.get("w") or z.get("h")) and "shape" not in z]
                if it["type"] == "listening":
                    ids = {s["id"]: s for s in it["speakers"]}
                    bad += [f"{it['id']}: accent {s['accent']!r}" for s in it["speakers"] if "accent" in s and s["accent"] not in {"gb", "us", "ca", "au", "nz", "ie", "za"}]
                    for x in it["script"]:
                        if "pause" in x and not (type(x["pause"]) is int and 5 <= x["pause"] <= 60 and x["s"] == "nar"
                                                 and ids.get("nar", {}).get("name") == "Narrator"):
                            bad.append(f"{it['id']}: a pause is 5-60 seconds, on a Narrator line")
                if "followups" in it:
                    f = it["followups"]
                    if it.get("part") != 2 or not (isinstance(f, list) and 1 <= len(f) <= 2 and all(isinstance(x, str) and x.strip() for x in f)):
                        bad.append(f"{it['id']}: followups are 1-2 questions, Part 2 only")
                for x in it.get("exemplars", []):
                    b = x.get("band")
                    if not (isinstance(b, (int, float)) and 5 <= b <= 9 and float(b * 2).is_integer() and 2 <= len(x["text"]) <= 8
                            and 1 <= len(x["notes"]) <= 6 and _words(x["text"]) >= it.get("minWords", 0)):
                        bad.append(f"{it['id']}: exemplar shape")
            if les.get("kind") == "test" and len(picks) >= 4:
                top = Counter(picks).most_common(1)[0]
                if top[1] * 2 > len(picks):
                    bad.append(f"{lid}: {top[1]} of {len(picks)} pick keys are index {top[0]}")
    assert not bad, "\n".join(bad[:40])


_QN = re.compile(r"^Questions (\d+)-(\d+)\.")


def _numbered(les):
    """[(first, last, set, part)] for every set of a 40-question paper, checking the numbers run 1-40 with no gap."""
    out, nxt = [], 1
    for it in les["items"]:
        for s in it.get("sets", []):
            m = _QN.match(s.get("instr", ""))
            assert m, (it["id"], s.get("instr", "")[:60])
            a, b = int(m.group(1)), int(m.group(2))
            assert a == nxt and b - a + 1 == sum(_marks(q) for q in s["items"]), (it["id"], a, b, nxt)
            out.append((a, b, s, it))
            nxt = b + 1
    assert nxt == 41, (les["id"], nxt - 1)
    return out


def test_ielts_content2_listening_exam():
    for lid in ("u23-l1", "u24-l1"):
        les = _find(lid)
        assert les["exam"] is True and les["kind"] == "test", lid
        sets = _numbered(les)
        parts = [it for it in les["items"] if it["type"] == "listening"]
        assert len(parts) == 4, lid
        card = les["items"][0]
        assert card["type"] == "card" and "about 23 minutes of recording" in " ".join(card["body"]), card["body"]
        for i, p in enumerate(parts, 1):
            assert p["context"].startswith(f"Part {i}."), (p["id"], p["context"][:40])
            nar = [s for s in p["speakers"] if s["id"] == "nar"]
            assert i == 4 or (nar and nar[0]["name"] == "Narrator"), p["id"]
            if i >= 2:
                assert {s.get("accent", "gb") for s in p["speakers"] if s["id"] != "nar"} - {"gb"}, f"{p['id']}: every voice is British"
            pauses = [x for x in p["script"] if "pause" in x]
            if i == 4:
                assert not pauses, f"{p['id']}: Part 4 plays straight through"
                continue
            assert len(pauses) == 1, (p["id"], len(pauses))
            m = re.search(r"questions (\d+) to (\d+)", pauses[0]["t"])
            starts = [a for a, b, s, it in sets if it is p]
            last = max(b for a, b, s, it in sets if it is p)
            assert m and int(m.group(1)) in starts[1:] and int(m.group(2)) == last, (p["id"], pauses[0]["t"], starts, last)


def test_ielts_content2_keys():
    a = lambda i: _find(i)["answer"]
    assert {"20", "20 minutes", "twenty minutes"} <= set(a("u23-l1-i2-q8"))
    assert {"120", "£120"} <= set(a("u23-l1-i2-q10")) and {"85", "£85"} <= set(a("u24-l1-i2-q4"))
    assert "unihemispheric" in a("u23-l2-i3-q5") and "waste" in a("u23-l2-i3-q7")
    assert a("u23-l2-i2-q1") == "F" and a("u24-l2-i4-q2") == "Y" and a("u24-l2-i4-q11") == [1, 4]
    assert a("u14-l1-i8") == ["effect"]
    # the drawn plan: eight lettered places, and the letters are the options
    it = _find("u23-l1-i3")
    s = it["sets"][0]
    assert s["instr"].startswith("Questions 11-15. Label the plan") and s["visual"]["kind"] == "map"
    marks = sorted(z["label"] for mp in s["visual"]["maps"] for z in mp["items"] if z.get("mark"))
    assert marks == list("ABCDEFGH"), marks
    (q,) = s["items"]
    assert q["type"] == "select" and q["options"] == list("ABCDEFGH"), q["options"]
    assert "".join("ABCDEFGH"[r["answer"]] for r in q["rows"]) == "GCDEF", q["rows"]
    assert ["ABC"[_find(f"u23-l1-i3-q{n}")["answer"]] for n in (3, 4, 5)] == ["B", "C", "A"]
    # ids: two picks left Mock 2 Reading for a Choose TWO, three speaking items came, nothing appears twice
    assert not _has("u24-l2-i4-q8") and not _has("u24-l2-i4-q9")
    assert all(_has(i) for i in ("u24-l2-i4-q11", "u23-l4-i6", "u24-l4-i5", "u24-l4-i6"))
    ids = Counter(o["id"] for n in range(1, 25) for o in _walk(_unit(n)) if re.match(r"u\d\d-", str(o.get("id"))))
    assert not [k for k, v in ids.items() if v > 1], [k for k, v in ids.items() if v > 1][:10]


def test_ielts_content2_reading():
    for lid in ("u23-l2", "u24-l2"):
        les = _find(lid)
        _numbered(les)
        assert [it["minutes"] for it in les["items"] if it["type"] == "reading"] == [17, 20, 23], lid
    for u in ("u23", "u24"):
        sets = [s for lid in (f"{u}-l1", f"{u}-l2") for it in _find(lid)["items"] for s in it.get("sets", [])]
        short = [s for s in sets if re.search(r"Answer the questions|Complete the sentences", s["instr"])
                 and all(q["type"] == "gap" for q in s["items"])]
        two = [s for s in sets if (s.get("visual") or {}).get("kind") == "table" or "Choose TWO" in s["instr"]]
        assert short and two, (u, len(short), len(two))
        for s in sets:
            if "Choose TWO" in s["instr"]:
                assert all(q["type"] == "multi" and len(q["answer"]) == 2 for q in s["items"]), s["instr"]


def test_ielts_content2_writing():
    old, new = _find("u11-l2-i2"), _find("u23-l3-i2")
    v = new["visual"]
    assert v["kind"] != old["visual"]["kind"] and v["title"] != old["visual"]["title"]
    assert new["prompt"].startswith("You should spend about 20 minutes on this task.") and "Calderford" in new["prompt"]
    assert not any("Calderford" in json.dumps(_unit(n)) for n in range(1, 23)), "Calderford is used elsewhere"
    text = " ".join(new["model"]["text"])
    assert 170 <= _words(text) <= 230, _words(text)
    assert not re.search(r"\d", new["model"]["text"][1]), "the overview has no figures"
    totals = [sum(s["values"][i] for s in v["series"]) for i in range(len(v["x"]))]
    allowed = {float(x) for s in v["series"] for x in s["values"]} | {float(t) for t in totals} | {16.0, 29.0, 30.0, 49.0, 50.0, 2024.0}
    nums = {float(x) for x in re.findall(r"\d+(?:\.\d+)?", text)}
    assert nums <= allowed, sorted(nums - allowed)
    assert all(f"{t:g}" in text for t in totals), totals
    # the notes quote the model as it is (a fragment with ... is quoted in parts)
    for i in ("u23-l3-i2", "u24-l3-i2"):
        m = _find(i)["model"]
        body = " ".join(m["text"]).lower()
        miss = [q for n in m["notes"] for q in re.findall(r"\*([^*]+)\*", n)
                if not all(p.strip().lower() in body for p in q.split("...") if p.strip())]
        assert not miss, (i, miss)
    assert _find("u24-l3-i2")["prompt"].startswith("You should spend about 20 minutes on this task.")
    for i in ("u23-l3-i3", "u24-l3-i3"):
        assert _find(i)["prompt"].startswith("You should spend about 40 minutes on this task.\n\nWrite about the following topic:"), i
    gr = "Give reasons for your answer and include any relevant examples from your own knowledge or experience."
    for n in range(13, 25):
        for o in _walk(_unit(n)):
            if o.get("type") == "writing" and o.get("task") == 2:
                assert gr in o["prompt"] and o["prompt"].endswith("Write at least 250 words."), o["id"]
            for k, s in o.items():
                if isinstance(s, str) and "Task Achievement" in s:
                    assert "Task 1" in s, (o.get("id"), s[:120])
    assert _find("u13-l1-i1")["body"][0].startswith("Task 1 is marked for Task Achievement; Task 2 for Task Response.")
    assert "Task Response" in _find("u13-l1-i11")["q"] and "Task Response" in " ".join(_find("u14-l1-i1")["body"])


def test_ielts_content2_speaking():
    for lid in ("u23-l4", "u24-l4"):
        sp = [it for it in _find(lid)["items"] if it["type"] == "speaking"]
        p1 = [it for it in sp if it["part"] == 1]
        assert sum(len(it["questions"]) for it in p1) == 12, (lid, [len(it["questions"]) for it in p1])
        (p2,) = [it for it in sp if it["part"] == 2]
        assert len(p2["followups"]) == 2 and len(p2["cue"]["bullets"]) == 3 and p2["cue"]["close"].startswith("and explain"), p2["id"]
        assert 290 <= _words(p2["model"]["text"]) <= 330, (p2["id"], _words(p2["model"]["text"]))
        (p3,) = [it for it in sp if it["part"] == 3]
        assert len(p3["model"]["text"]) == len(p3["questions"]), p3["id"]
        assert all(90 <= _words(t) <= 130 for t in p3["model"]["text"]), [_words(t) for t in p3["model"]["text"]]
    for i in ("u17-l2-i1", "u17-l2-i2", "u17-l3-i1", "u17-l3-i2"):
        it = _find(i)
        assert len(it["followups"]) == 2 and 285 <= _words(it["model"]["text"]) <= 315, (i, _words(it["model"]["text"]))
    for i in ("u18-l2-i1", "u18-l2-i2", "u18-l3-i1", "u18-l3-i2"):
        t = _find(i)["model"]["text"]
        assert all(90 <= _words(x) <= 130 for x in t), (i, [_words(x) for x in t])
    it = _find("u17-l2-i1")
    assert "had made" in " ".join(it["model"]["text"]) and "had made" in it["model"]["notes"][1], it["model"]["notes"][1]


def test_ielts_content2_exemplars():
    for i in ("u13-l2-i2", "u14-l2-i2"):
        it = _find(i)
        (ex,) = it["exemplars"]
        assert ex["band"] == 7 and 250 <= _words(ex["text"]) <= 330, (i, _words(ex["text"]))
        assert not set(ex["text"]) & set(it["model"]["text"]), i
        heads = [n.split(":")[0] for n in ex["notes"]]
        assert heads[:4] == ["TR 7", "CC 7", "LR 7", "GRA 7"], heads
        assert re.search(r"band 8", ex["notes"][-1]), ex["notes"][-1]
        assert list(it).index("exemplars") == list(it).index("model") + 1, list(it)


# the picks whose options were rewritten as real collocates (Boers et al. 2014: no non-words, one defensible answer)
_COLLOC = ["u15-l2-i4", "u15-l2-i10", "u20-l1-i3", "u20-l1-i4", "u20-l1-i10", "u20-l1-i11", "u20-l2-i3", "u20-l2-i4",
           "u20-l2-i10", "u20-l2-i11", "u20-l3-i10"]
# picks whose why begins with the letter of the key
_LETTER = {"u13-l1-i6": "D", "u13-l1-i10": "A", "u14-l1-i5": "D", "u15-l1-i4": "D", "u15-l3-i4": "A", "u16-l1-i6": "A",
           "u16-l1-i8": "D", "u21-l2-i8": "A", "u21-l2-i9": "D", "u22-l1-i5": "D", "u22-l2-i4": "A"}


def test_ielts_content2_collocations_and_keys():
    norm = lambda s: re.sub(r"[^a-z ]", "", s.lower()).strip()
    for i in _COLLOC:
        q = _find(i)
        opts = q["options"]
        assert len(opts) == 4 and len({norm(o) for o in opts}) == 4, i
        bold = norm(re.search(r"\*\*(.+?)\*\*", q["why"]).group(1))
        key = norm(opts[q["answer"]])
        assert key in bold or bold in key, (i, key, bold)
        why = q["why"].lower()
        toks = re.findall(r"[a-z]+", why)
        for j, o in enumerate(opts):
            o = o.strip().lower()
            if j != q["answer"] and " " not in o:  # a one-word distractor is named in the why (uphold for upheld)
                assert any(len(os.path.commonprefix([t, o])) >= max(3, len(o) // 2) for t in toks), (i, o)
    cnt = Counter()
    for n in range(13, 23):
        for o in _walk(_unit(n)):
            if o.get("type") == "pick" and len(o.get("options", [])) == 4:
                cnt["ABCD"[o["answer"]]] += 1
    tot = sum(cnt.values())
    assert all(0.15 <= cnt[L] / tot <= 0.35 for L in "ABCD"), dict(cnt)
    for i, L in _LETTER.items():
        q = _find(i)
        assert "ABCD"[q["answer"]] == L and q["why"].startswith(L + " "), (i, q["answer"], q["why"][:30])


def test_ielts_content2_visuals_render():
    vis = [("u23-plan", _find("u23-l1-i3")["sets"][0]["visual"]),
           ("u24-table", _find("u24-l1-i5")["sets"][0]["visual"]),
           ("u23-task1", _find("u23-l3-i2")["visual"])]
    folder = C.CAPTURAS / "content2"
    for scheme in ("light", "dark"):
        page = C.new_page("phone", color_scheme=scheme)
        try:
            page.add_init_script(_IN)
            page.goto(C.base_url(page) + "/ielts.html#/")
            page.wait_for_function("() => window.IE && IE.viz && document.getElementById('app').children.length > 0", timeout=10000)
            for name, v in vis:
                r = page.evaluate("""v => {
                  const f = document.createElement('figure'); f.className = 'ie-viz'; f.innerHTML = IE.viz.html(v);
                  document.getElementById('app').replaceChildren(f); window.scrollTo(0, 0);
                  const svg = f.querySelector('svg'), txt = [...f.querySelectorAll('svg text')].map(t => t.textContent);
                  const cw = document.documentElement.clientWidth;
                  return {err: !!f.querySelector('.t-sub'), w: document.documentElement.scrollWidth - cw, cw,
                          svgW: svg ? svg.getBoundingClientRect().width : 0, rects: svg ? svg.querySelectorAll('rect').length : 0,
                          tallest: svg ? Math.max(0, ...[...svg.querySelectorAll('rect')].map(x => x.getBBox().height)) : 0,
                          txt, rows: f.querySelectorAll('table.ie-table tbody tr').length, text: f.innerText,
                          out: [...f.querySelectorAll('svg text')].filter(t => { const b = t.getBoundingClientRect(), s = t.ownerSVGElement.getBoundingClientRect();
                            return b.left < s.left - 1 || b.right > s.right + 1; }).map(t => t.textContent)};
                }""", v)
                assert not r["err"] and r["w"] <= 1, (scheme, name, r)
                if name == "u23-plan":
                    assert set("ABCDEFGH") <= set(r["txt"]) and "Main entrance" in " ".join(r["txt"]), r["txt"]
                    assert 300 <= r["svgW"] <= r["cw"], (r["svgW"], r["cw"])
                elif name == "u24-table":
                    assert r["rows"] == len(v["rows"]) and all(f"({n})" in r["text"] for n in range(31, 36)), r
                else:
                    assert r["rects"] == sum(len(s["values"]) for s in v["series"]) and set(v["x"]) <= set(r["txt"]), r
                    # the bars have their height (17 h is about 230 of the 272 units of the plot), not the 4 px of the
                    # player's progress bar (.ie-bar), which once flattened every column
                    assert r["tallest"] > 100, r["tallest"]
                assert not r["out"], (scheme, name, r["out"])
                C.shot(page, f"{name}-phone-{scheme}", folder, full_page=True)
            assert not C.errors(page), C.errors(page)[:5]
        finally:
            page.context.close()
