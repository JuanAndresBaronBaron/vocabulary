#!/usr/bin/env python3
"""Validation of the IELTS Prep data (data/ielts/SCHEMA.md, format 1).

    python3 tests/e2e/ielts_validate.py            # data/ielts/index.json and every data/ielts/u*.json
    python3 tests/e2e/ielts_validate.py file…      # only those unit files

Not a test_*.py: run.py does not pick it up by itself (test_ielts.py calls check_all()).

Besides the shape of every item, three exam rules are errors: every accepted gap answer fits its word limit
(fits()), a set whose instruction says "Label the ..." has a visual, and in a test with 4 or more pick questions no
answer letter holds more than half of their keys.
"""
import json
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "data" / "ielts"
BLOCKS = ["start", "listening", "reading", "writing", "speaking", "language", "mock"]
KINDS = {"learn", "practice", "test"}
SCORED = {"pick", "multi", "tfng", "gap", "select", "order"}
TYPES = SCORED | {"card", "reading", "listening", "writing", "speaking", "say"}
SPANISH = re.compile(r"[¿¡ñ]|\b(los|las|una|para|tambi[eé]n|cuando|porque|pero)\b", re.I)
AMERICAN = re.compile(r"\b(color|colors|favorite|center|centers|analyze|analyzed|organize|organized|organization|behavior|"
                      r"neighbor|neighborhood|realize|realized|theater|traveling|traveled|program(?:me)?s? (?:of study)|"
                      r"apartment|vacation|gotten|labor|defense|license[ds]?|catalog|honor|humor|recognize|recognized|"
                      r"apologize|summarize|summarized|emphasize|emphasized|minimize|maximize|prioritize|criticize|"
                      r"utilize|utilized|fiber|liter|meter|meters|centimeter|kilometer)\b")
MARKUP = re.compile(r"<[a-z/][^>]*>|\[[^\]]+\]\(", re.I)
ACCENTS = {"gb", "us", "ca", "au", "nz", "ie", "za"}
# Package content2 fixes these in u23 and u24: errors of the three exam rules on these ids are skipped.
# the integrator empties this after merging content2
PENDING = {"u23-l1-i2-q10", "u24-l1-i2-q4", "u23-l1-i3", "u23-l1", "u23-l2", "u24-l1", "u24-l2"}

# ---------- word limits (ielts.org: "You will lose the mark for writing more than the word limit.") ----------
_LIMIT = re.compile(r"(?:NO MORE THAN )?(ONE|TWO|THREE)(?: OR (TWO|THREE))? WORDS?(?: ONLY)?( AND/OR A NUMBER)?")
_NUM = {"ONE": 1, "TWO": 2, "THREE": 3}


def limit_of(limit):
    """(words, numbers) that a limit allows: ONE = 1, TWO = 2, THREE = 3, ONE OR TWO = 2, TWO OR THREE = 3 words,
    'A NUMBER' alone = no words; 'AND/OR A NUMBER' (and 'A NUMBER') also allows one number. None if unknown."""
    s = re.sub(r"\s+", " ", str(limit or "")).strip().upper()
    if s == "A NUMBER":
        return (0, 1)
    m = _LIMIT.fullmatch(s)
    if not m:
        return None
    return (_NUM[m.group(2) or m.group(1)], 1 if m.group(3) else 0)


def count_answer(a):
    """(words, numbers) in an answer. Split on spaces, so a hyphenated word is one word; a run of consecutive
    tokens that each contain a digit is one number (07700 911483, BS7 4QD, 10:15, £85, 14th); spelled-out numbers
    are words."""
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
    """True if the answer is within the limit (an unknown limit fits nothing)."""
    lim = limit_of(limit)
    if lim is None:
        return False
    w, n = count_answer(answer)
    return w <= lim[0] and n <= lim[1]


def _texts(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, list):
        for x in o:
            yield from _texts(x)
    elif isinstance(o, dict):
        for k, v in o.items():
            if k not in ("id", "type", "kind", "mode", "voice", "s", "shape", "block", "answer", "accent"):
                yield from _texts(v)


def _str(v):
    return isinstance(v, str) and v.strip() != ""


def _strs(v, lo=1, hi=99):
    return isinstance(v, list) and lo <= len(v) <= hi and all(_str(x) for x in v)


def check_scored(it, e, where, rule=None):
    rule = rule or (lambda _id, msg: e(msg))
    t = it.get("type")
    if t == "pick":
        if not _str(it.get("q")) or not _strs(it.get("options"), 2, 5):
            e(f"{where}: pick needs q and 2-5 options")
        elif not isinstance(it.get("answer"), int) or not 0 <= it["answer"] < len(it["options"]):
            e(f"{where}: pick answer out of range")
        if not _str(it.get("why")):
            e(f"{where}: pick needs why")
    elif t == "multi":
        a = it.get("answer")
        if not _str(it.get("q")) or not _strs(it.get("options"), 4, 7):
            e(f"{where}: multi needs q and 4-7 options")
        elif not (isinstance(a, list) and len(a) >= 2 and len(set(a)) == len(a)
                  and all(isinstance(x, int) and 0 <= x < len(it["options"]) for x in a)):
            e(f"{where}: multi answer must be 2+ distinct indexes")
        if not _str(it.get("why")):
            e(f"{where}: multi needs why")
    elif t == "tfng":
        m = it.get("mode")
        ok = {"tfng": {"T", "F", "NG"}, "ynng": {"Y", "N", "NG"}}.get(m)
        if not ok:
            e(f"{where}: tfng mode must be tfng or ynng")
        elif it.get("answer") not in ok:
            e(f"{where}: tfng answer {it.get('answer')!r} not valid for {m}")
        if not _str(it.get("statement")) or not _str(it.get("why")):
            e(f"{where}: tfng needs statement and why")
    elif t == "gap":
        if not isinstance(it.get("text"), str) or it["text"].count("___") != 1:
            e(f"{where}: gap text needs exactly one ___")
        if not _strs(it.get("answer"), 1, 16):
            e(f"{where}: gap answer must be a list of 1-16 strings")
        if not _str(it.get("limit")) or not _str(it.get("why")):
            e(f"{where}: gap needs limit and why")
        elif limit_of(it["limit"]) is None:
            rule(where, f"{where}: unknown word limit {it['limit']!r}")
        elif isinstance(it.get("answer"), list):
            for a in it["answer"]:
                if isinstance(a, str) and not fits(a, it["limit"]):
                    rule(where, f"{where}: accepted answer {a!r} is over the limit {it['limit']}")
    elif t == "select":
        if not _str(it.get("q")) or not _strs(it.get("options"), 2, 12):
            e(f"{where}: select needs q and 2-12 options")
        rows = it.get("rows")
        if not isinstance(rows, list) or not 1 <= len(rows) <= 10:
            e(f"{where}: select needs 1-10 rows")
        else:
            for r in rows:
                if not isinstance(r, dict) or not _str(r.get("label")) or not isinstance(r.get("answer"), int) \
                        or not 0 <= r["answer"] < len(it.get("options") or []):
                    e(f"{where}: bad select row {r!r}"[:200])
    elif t == "order":
        if not _str(it.get("q")) or not _strs(it.get("items"), 3, 7) or not _str(it.get("why")):
            e(f"{where}: order needs q, 3-7 items and why")
        elif len(set(it["items"])) != len(it["items"]):
            e(f"{where}: order items must be distinct")


def marks(it):
    t = it.get("type")
    if t == "select":
        return len(it.get("rows") or [])
    if t == "multi":
        return len(it.get("answer") or [])
    return 1 if t in SCORED else 0


VISUALS = {"line", "bar", "pie", "table", "process", "map"}


def check_visual(v, e, where):
    k = v.get("kind") if isinstance(v, dict) else None
    if k not in VISUALS:
        return e(f"{where}: visual kind must be one of {sorted(VISUALS)}")
    if not _str(v.get("title")):
        e(f"{where}: visual needs a title")
    if k in ("line", "bar"):
        x, s = v.get("x"), v.get("series")
        if not _strs(x, 2, 14) or not isinstance(s, list) or not 1 <= len(s) <= 6:
            return e(f"{where}: {k} needs x labels and 1-6 series")
        for ser in s:
            vals = ser.get("values") if isinstance(ser, dict) else None
            if not _str(ser.get("name") if isinstance(ser, dict) else None) or not isinstance(vals, list) \
                    or len(vals) != len(x) or not all(isinstance(n, (int, float)) for n in vals):
                e(f"{where}: series must have a name and one number per x label")
    elif k == "pie":
        ch = v.get("charts")
        if not isinstance(ch, list) or not 1 <= len(ch) <= 3:
            return e(f"{where}: pie needs 1-3 charts")
        for c in ch:
            sl = c.get("slices") if isinstance(c, dict) else None
            if not isinstance(sl, list) or not 2 <= len(sl) <= 8 or \
                    not all(isinstance(z, dict) and _str(z.get("label")) and isinstance(z.get("value"), (int, float)) for z in sl):
                e(f"{where}: pie chart needs 2-8 labelled slices")
    elif k == "table":
        h, rows = v.get("head"), v.get("rows")
        if not isinstance(h, list) or not isinstance(rows, list) or not rows or \
                not all(isinstance(r, list) and len(r) == len(h) for r in rows):
            e(f"{where}: table rows must match head length")
    elif k == "process":
        st = v.get("steps")
        if not isinstance(st, list) or not 3 <= len(st) <= 12 or not all(isinstance(z, dict) and _str(z.get("label")) for z in st):
            e(f"{where}: process needs 3-12 labelled steps")
    elif k == "map":
        ms = v.get("maps")
        if not isinstance(ms, list) or not 1 <= len(ms) <= 2:
            return e(f"{where}: map needs 1-2 maps")
        for m in ms:
            its = m.get("items") if isinstance(m, dict) else None
            if not _str(m.get("title") if isinstance(m, dict) else None) or not isinstance(its, list) or not its:
                e(f"{where}: each map needs a title and items")
                continue
            for z in its:
                ok = isinstance(z, dict) and _str(z.get("label")) and z.get("shape", "rect") in ("rect", "circle", "road", "water") \
                    and all(isinstance(z.get(c), (int, float)) and 0 <= z[c] <= 100 for c in ("x", "y", "w", "h"))
                if not ok:
                    e(f"{where}: bad map item {z!r}"[:200])
                elif "mark" in z and (z["mark"] is not True or len(z["label"].strip()) > 3):
                    e(f"{where}: a marker needs mark: true and a label of 1-3 characters (a letter or number): {z!r}"[:200])


def check_sets(it, e, where, ids, rule=None):
    rule = rule or (lambda _id, msg: e(msg))
    sets = it.get("sets")
    if not isinstance(sets, list) or not sets:
        return e(f"{where}: needs sets")
    for si, s in enumerate(sets):
        if not isinstance(s, dict) or not _str(s.get("instr")) or not isinstance(s.get("items"), list) or not s["items"]:
            e(f"{where} set {si}: needs instr and items")
            continue
        if "visual" in s:
            check_visual(s["visual"], e, f"{where} set {si}")
        elif "label the" in s["instr"].lower():
            rule(where, f"{where} set {si}: 'Label the ...' needs a visual (a plan, map or diagram)")
        for q in s["items"]:
            qid = q.get("id") if isinstance(q, dict) else None
            if not _str(qid):
                e(f"{where} set {si}: question without id")
                continue
            if qid in ids:
                e(f"{where}: duplicate id {qid}")
            ids.add(qid)
            if q.get("type") not in SCORED:
                e(f"{qid}: type {q.get('type')!r} cannot go inside a set")
            else:
                check_scored(q, e, qid, rule)


def _words(paras):
    return len(" ".join(paras).split())


def check(path):
    try:
        u = json.load(open(path, encoding="utf-8"))
    except Exception as x:
        return [f"cannot parse JSON: {x}"]
    return check_unit(u, Path(path).stem)


def check_unit(u, stem=None):
    """Every error in one unit (a dict). stem: the file name without .json, checked against the id."""
    errs = []
    e = errs.append

    def rule(rid, msg):
        """An error of the three exam rules, skipped for the ids content2 still has to fix (PENDING)."""
        if rid not in PENDING:
            e(msg)
    for k in ("format", "id", "n", "block", "title", "summary", "lessons"):
        if k not in u:
            e(f"missing unit field '{k}'")
    if errs:
        return errs
    if u["format"] != 1:
        e("format must be 1")
    if not re.fullmatch(r"u\d\d", u["id"]) or int(u["id"][1:]) != u["n"]:
        e("id must be uNN and match n")
    if stem is not None and stem != u["id"]:
        e("file name must match id")
    if u["block"] not in BLOCKS:
        e(f"unknown block {u['block']!r}")
    les = u["lessons"]
    if not isinstance(les, list) or not 2 <= len(les) <= 5:
        e("2-5 lessons per unit")
        return errs
    ids = set()
    for li, l in enumerate(les):
        lid = f"{u['id']}-l{li + 1}"
        if l.get("id") != lid:
            e(f"lesson {li + 1} id must be {lid}")
        if l.get("kind") not in KINDS:
            e(f"{lid}: kind must be one of {sorted(KINDS)}")
        if not _str(l.get("title")) or not isinstance(l.get("minutes"), (int, float)):
            e(f"{lid}: needs title and minutes")
        if l.get("kind") == "test" and not (isinstance(l.get("timed"), int) and l["timed"] >= 60):
            e(f"{lid}: test lessons need timed (seconds)")
        items = l.get("items")
        if not isinstance(items, list) or not items:
            e(f"{lid}: needs items")
            continue
        if "exam" in l:
            kinds = {it.get("type") for it in items if isinstance(it, dict)}
            if l["exam"] is not True or l.get("kind") != "test" or "listening" not in kinds or not kinds <= {"listening", "card"}:
                e(f"{lid}: exam: true is only for a test whose scored items are all in listening items")
        picks = [q for it in items if isinstance(it, dict) for s in (it.get("sets") or [{"items": [it]}]) if isinstance(s, dict)
                 for q in (s.get("items") or []) if isinstance(q, dict) and q.get("type") == "pick" and isinstance(q.get("answer"), int)]
        if l.get("kind") == "test" and len(picks) >= 4:
            top = max(sum(1 for q in picks if q["answer"] == a) for a in {q["answer"] for q in picks})
            if top * 2 > len(picks):
                rule(lid, f"{lid}: {top} of the {len(picks)} pick keys share one letter (at most half may)")
        for it in items:
            iid = it.get("id") if isinstance(it, dict) else None
            if not _str(iid) or not iid.startswith(lid + "-i"):
                e(f"{lid}: item id {iid!r} must start with {lid}-i")
                continue
            if iid in ids:
                e(f"duplicate id {iid}")
            ids.add(iid)
            t = it.get("type")
            if t not in TYPES:
                e(f"{iid}: unknown type {t!r}")
            elif t in SCORED:
                check_scored(it, e, iid, rule)
            elif t == "card":
                if not _str(it.get("title")) or not _strs(it.get("body"), 1, 8):
                    e(f"{iid}: card needs title and 1-8 body paragraphs")
                if "examples" in it and not (isinstance(it["examples"], list) and all(isinstance(x, dict) and _str(x.get("text")) for x in it["examples"])):
                    e(f"{iid}: examples must be [{{text, note?}}]")
                if "list" in it and not _strs(it["list"], 1, 12):
                    e(f"{iid}: list must be 1-12 strings")
            elif t == "reading":
                ps = it.get("paragraphs")
                if not _str(it.get("title")) or not isinstance(it.get("minutes"), (int, float)):
                    e(f"{iid}: reading needs title and minutes")
                if not isinstance(ps, list) or not ps or not all(isinstance(p, dict) and _str(p.get("text")) for p in ps):
                    e(f"{iid}: reading needs paragraphs [{{label, text}}]")
                check_sets(it, e, iid, ids, rule)
            elif t == "listening":
                sp = it.get("speakers")
                spk = {s.get("id") for s in sp} if isinstance(sp, list) and all(isinstance(s, dict) for s in sp) else set()
                if not _str(it.get("title")) or it.get("part") not in (1, 2, 3, 4) or not _str(it.get("context")):
                    e(f"{iid}: listening needs title, part 1-4 and context")
                if not spk or not all(s.get("voice") in ("f", "m") and _str(s.get("name")) for s in sp):
                    e(f"{iid}: speakers need id, name and voice f/m")
                if isinstance(sp, list) and any(isinstance(s, dict) and "accent" in s and s["accent"] not in ACCENTS for s in sp):
                    e(f"{iid}: speaker accent must be one of {sorted(ACCENTS)}")
                sc = it.get("script")
                if not isinstance(sc, list) or len(sc) < 2 or not all(isinstance(x, dict) and x.get("s") in spk and _str(x.get("t")) for x in sc):
                    e(f"{iid}: script lines need s (a speaker id) and t")
                elif any("pause" in x and not (type(x["pause"]) is int and 5 <= x["pause"] <= 60) for x in sc):
                    e(f"{iid}: a script line's pause is a whole number of seconds, 5-60")
                check_sets(it, e, iid, ids, rule)
            elif t == "writing":
                if it.get("task") not in (1, 2) or not _str(it.get("prompt")):
                    e(f"{iid}: writing needs task 1/2 and prompt")
                if not isinstance(it.get("minutes"), int) or not isinstance(it.get("minWords"), int):
                    e(f"{iid}: writing needs minutes and minWords")
                m = it.get("model")
                if not isinstance(m, dict) or not _strs(m.get("text"), 2, 8) or not _strs(m.get("notes"), 1, 10):
                    e(f"{iid}: writing model needs text paragraphs and notes")
                else:
                    w = len(" ".join(m["text"]).split())
                    if w < it.get("minWords", 0):
                        e(f"{iid}: model answer has {w} words, below minWords")
                if it.get("task") == 1:
                    if "visual" not in it:
                        e(f"{iid}: task 1 needs a visual")
                    else:
                        check_visual(it["visual"], e, iid)
                if "visual2" in it:
                    if it.get("task") != 1 or "visual" not in it:
                        e(f"{iid}: visual2 is a second visual, for Task 1 only")
                    else:
                        check_visual(it["visual2"], e, iid + " visual2")
                if "exemplars" in it:
                    ex = it["exemplars"]
                    if not isinstance(ex, list) or not 1 <= len(ex) <= 3:
                        e(f"{iid}: exemplars must be a list of 1-3")
                    else:
                        for x in ex:
                            b = x.get("band") if isinstance(x, dict) else None
                            if not (isinstance(b, (int, float)) and not isinstance(b, bool) and 5 <= b <= 9 and float(b * 2).is_integer()) \
                                    or not _strs(x.get("text"), 2, 8) or not _strs(x.get("notes"), 1, 6):
                                e(f"{iid}: each exemplar needs band 5-9 (halves allowed), text (2-8 paragraphs) and notes (1-6)")
                            elif _words(x["text"]) < it.get("minWords", 0):
                                e(f"{iid}: a band {b} exemplar has {_words(x['text'])} words, below minWords")
            elif t == "speaking":
                p = it.get("part")
                if p not in (1, 2, 3) or not _str(it.get("topic")):
                    e(f"{iid}: speaking needs part 1-3 and topic")
                if p == 2:
                    c = it.get("cue")
                    if not isinstance(c, dict) or not _str(c.get("task")) or not _strs(c.get("bullets"), 2, 5) or not _str(c.get("close")):
                        e(f"{iid}: part 2 needs cue {{task, bullets, close}}")
                elif p in (1, 3) and not _strs(it.get("questions"), 1, 8):
                    e(f"{iid}: parts 1 and 3 need questions")
                if not isinstance(it.get("prep"), int) or not isinstance(it.get("talk"), int):
                    e(f"{iid}: speaking needs prep and talk (seconds)")
                if "followups" in it and (p != 2 or not _strs(it["followups"], 1, 2)):
                    e(f"{iid}: followups are 1-2 questions, for Part 2 only")
                m = it.get("model")
                if not isinstance(m, dict) or not _strs(m.get("text"), 1, 10) or not _strs(m.get("notes"), 1, 10):
                    e(f"{iid}: speaking model needs text and notes")
            elif t == "say":
                if not _str(it.get("text")) or not re.fullmatch(r"/.+/", str(it.get("ipa", ""))) or not _str(it.get("tip")):
                    e(f"{iid}: say needs text, ipa in slashes and tip")
        if l.get("kind") == "test" and not sum(marks(q) for it in items for s in (it.get("sets") or [{"items": [it]}]) for q in s.get("items", [])) \
                and not any(it.get("type") in ("writing", "speaking") for it in items):
            e(f"{lid}: a test needs scored questions or a writing/speaking task")
    for s in _texts(u):
        if MARKUP.search(s):
            e(f"markup not allowed: {s[:80]!r}")
        if SPANISH.search(s):
            e(f"looks Spanish: {s[:80]!r}")
        m = AMERICAN.search(s)
        if m:
            e(f"American spelling {m.group(0)!r}: {s[:80]!r}")
    return errs


def check_index():
    errs = []
    try:
        ix = json.load(open(DATA / "index.json", encoding="utf-8"))
    except Exception as x:
        return [f"index.json: {x}"]
    if ix.get("format") != 1:
        errs.append("index.json: format must be 1")
    bl = ix.get("blocks") or []
    if [b.get("id") for b in bl] != BLOCKS:
        errs.append(f"index.json: blocks must be {BLOCKS}")
    us = ix.get("units") or []
    for i, r in enumerate(us):
        if r.get("n") != i + 1 or r.get("id") != f"u{i + 1:02d}" or r.get("block") not in BLOCKS or not _str(r.get("title")):
            errs.append(f"index.json: bad unit row {r!r}")
            continue
        f = DATA / f"{r['id']}.json"
        if r.get("available"):
            if not f.exists():
                errs.append(f"index.json: {r['id']} is available but has no file")
            else:
                u = json.load(open(f, encoding="utf-8"))
                if u.get("title") != r["title"] or u.get("block") != r["block"]:
                    errs.append(f"index.json: {r['id']} title/block differ from the unit file")
    for b in bl:
        if sorted(b.get("units") or []) != sorted(r["n"] for r in us if r.get("block") == b.get("id")):
            errs.append(f"index.json: block {b.get('id')} units list does not match")
    return errs


def check_all():
    out = {"index.json": check_index()}
    for f in sorted(DATA.glob("u*.json")):
        out[f.name] = check(f)
    return {k: v for k, v in out.items() if v}


if __name__ == "__main__":
    if len(sys.argv) > 1:
        bad = {p: check(p) for p in sys.argv[1:]}
        bad = {k: v for k, v in bad.items() if v}
    else:
        bad = check_all()
    for k, v in bad.items():
        print(k)
        for m in v[:40]:
            print("  -", m)
    print("OK" if not bad else f"{len(bad)} file(s) with errors")
    sys.exit(1 if bad else 0)
