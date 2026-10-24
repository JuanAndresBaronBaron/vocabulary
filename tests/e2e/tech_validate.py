#!/usr/bin/env python3
"""Validación de los ficheros de Tech Prep (S1-SPEC §4): las mismas reglas que tools/validate.py de la carpeta compartida
(SCHEMA.md, format 1), copiadas tal cual en check(path), más check_index() para data/tech/index.json y
check_all() para la carpeta entera (lo usa test_tech_core.py).

    python3 tests/e2e/tech_validate.py            # valida data/tech/index.json y data/tech/u*.json
    python3 tests/e2e/tech_validate.py fichero…   # solo esos ficheros de unidad

No es un test_*.py: run.py no lo recoge por sí mismo.
"""
import json
import re
import sys
from pathlib import Path

BLOCKS = {"integration", "leadership", "successfactors", "gcp", "java", "extras", "final"}
KINDS_TECH = ["concepts", "practice", "interview"]
KINDS_LEAD = ["concepts", "stories", "interview"]
TYPES = {"card", "pick", "scenario", "order", "code", "diagram", "match", "tf", "explain", "say", "story"}
SPANISH = re.compile(r"[¿¡ñ]|\b(el|los|las|una|que|para|con|por|del|tambi[eé]n|cuando|porque|pero)\b", re.I)
URL = re.compile(r"^https://\S+$")


def check(path):
    errs = []
    def e(msg):
        errs.append(msg)
    try:
        u = json.load(open(path, encoding="utf-8"))
    except Exception as x:
        return [f"cannot parse JSON: {x}"]

    for k in ("format", "id", "n", "block", "title", "summary", "reviewed", "terms", "lessons", "cheatsheet", "sources"):
        if k not in u:
            e(f"missing unit field '{k}'")
    if errs:
        return errs
    if u["format"] != 1:
        e("format must be 1")
    if not re.fullmatch(r"u\d\d", u["id"]) or int(u["id"][1:]) != u["n"]:
        e("id must be uNN matching n")
    if u["block"] not in BLOCKS:
        e(f"bad block {u['block']}")
    if not re.fullmatch(r"\d{4}-\d\d-\d\d", u["reviewed"]):
        e("reviewed must be YYYY-MM-DD")

    srcs = {}
    for s in u["sources"]:
        if not {"id", "title", "url", "official"} <= s.keys():
            e(f"source missing fields: {s}")
            continue
        if not URL.match(s["url"]):
            e(f"source {s['id']} url must be https")
        srcs[s["id"]] = s
    if not srcs:
        e("no sources")

    ids = set()
    def uid(i, where):
        if not i:
            e(f"{where}: missing id")
        elif i in ids:
            e(f"duplicate id {i}")
        ids.add(i)

    terms = {}
    if not 6 <= len(u["terms"]) <= 14:
        e(f"terms: {len(u['terms'])} (want 6-14)")
    for t in u["terms"]:
        for k in ("id", "term", "ipa", "say", "def", "example", "src"):
            if k not in t:
                e(f"term {t.get('id')}: missing {k}")
        uid(t.get("id"), "term")
        terms[t.get("id")] = t
        ipa = t.get("ipa")
        if ipa is None:
            if not t.get("ipaTodo"):
                e(f"term {t.get('id')}: ipa null without ipaTodo")
        elif not (isinstance(ipa, str) and ipa.startswith("/") and ipa.endswith("/") and len(ipa) > 2):
            e(f"term {t.get('id')}: ipa must be /.../")
        if t.get("src") not in srcs:
            e(f"term {t.get('id')}: src {t.get('src')} not in sources")

    kinds = [l.get("kind") for l in u["lessons"]]
    want = KINDS_LEAD if u["block"] == "leadership" else KINDS_TECH
    if u["block"] != "final" and kinds != want:
        e(f"lesson kinds {kinds} (want {want})")
    for li, l in enumerate(u["lessons"]):
        uid(l.get("id"), "lesson")
        if not l.get("title"):
            e(f"lesson {l.get('id')}: missing title")
        items = l.get("items", [])
        if not 6 <= len(items) <= 10:
            e(f"lesson {l.get('id')}: {len(items)} items (want 6-10)")
        for it in items:
            iid = it.get("id")
            uid(iid, "item")
            t = it.get("type")
            if t not in TYPES:
                e(f"{iid}: bad type {t}")
                continue
            if it.get("src") not in srcs:
                e(f"{iid}: src {it.get('src')} not in sources")
            need = {
                "card": ["term"], "pick": ["q", "options", "answer", "why"],
                "scenario": ["q", "options"], "order": ["q", "steps"],
                "code": ["q", "lang", "code", "gaps"], "diagram": ["q", "layout", "nodes", "edges", "decoys"],
                "match": ["q", "pairs"], "tf": ["statement", "answer", "why"],
                "explain": ["q", "seconds", "model", "keypoints"], "say": ["text"],
                "story": ["prompt", "template", "model"],
            }[t]
            for k in need:
                if k not in it:
                    e(f"{iid}: missing {k}")
            if t == "card" and it.get("term") not in terms:
                e(f"{iid}: card term {it.get('term')} not in terms")
            if t == "pick":
                if len(it.get("options", [])) != 4 or not isinstance(it.get("answer"), int) or not 0 <= it["answer"] < 4:
                    e(f"{iid}: pick needs 4 options and answer 0-3")
            if t == "scenario":
                ops = it.get("options", [])
                if not 3 <= len(ops) <= 4 or sum(1 for o in ops if o.get("ok")) != 1 or any(not o.get("why") for o in ops):
                    e(f"{iid}: scenario needs 3-4 options, exactly one ok, each with why")
            if t == "order" and not 3 <= len(it.get("steps", [])) <= 7:
                e(f"{iid}: order needs 3-7 steps")
            if t == "code":
                gaps = it.get("gaps", [])
                found = sorted(int(n) for n in re.findall(r"\[\[(\d+)\]\]", it.get("code", "")))
                if found != sorted(g.get("n") for g in gaps) or not gaps:
                    e(f"{iid}: code gaps {found} do not match gaps list")
                for g in gaps:
                    if not g.get("answer") or len(g.get("decoys", [])) < 2:
                        e(f"{iid}: gap {g.get('n')} needs answer and 2+ decoys")
            if t == "diagram":
                nids = {n.get("id") for n in it.get("nodes", [])}
                if not any(n.get("slot") for n in it.get("nodes", [])):
                    e(f"{iid}: diagram needs at least one slot")
                for ed in it.get("edges", []):
                    if ed.get("from") not in nids or ed.get("to") not in nids:
                        e(f"{iid}: edge {ed} refers to unknown node")
            if t == "match" and not 3 <= len(it.get("pairs", [])) <= 6:
                e(f"{iid}: match needs 3-6 pairs")
            if t == "tf" and not isinstance(it.get("answer"), bool):
                e(f"{iid}: tf answer must be bool")
            if t == "explain":
                words = len(it.get("model", "").split())
                if not 90 <= words <= 180:
                    e(f"{iid}: explain model has {words} words (want 90-180)")
                kp = it.get("keypoints", [])
                if not 3 <= len(kp) <= 6 or any(not k.get("kw") for k in kp):
                    e(f"{iid}: explain needs 3-6 keypoints with kw")
                if not 60 <= it.get("seconds", 0) <= 180:
                    e(f"{iid}: seconds 60-180")
            if t == "say" and len(it.get("text", "").split()) > 30:
                e(f"{iid}: say text over 30 words")
            if t == "story":
                if u["block"] != "leadership":
                    e(f"{iid}: story only in leadership units")
                w = len(it.get("model", "").split())
                if not 120 <= w <= 200:
                    e(f"{iid}: story model has {w} words (want 120-200)")

    cs = u["cheatsheet"].get("sections", [])
    if not 3 <= len(cs) <= 8:
        e(f"cheatsheet: {len(cs)} sections (want 3-8)")

    # crude Spanish detector over all strings
    def walk(o, p=""):
        if isinstance(o, str):
            if SPANISH.search(o) and p.split(".")[-1] not in ("url", "code"):
                e(f"possible Spanish at {p}: {o[:60]!r}")
        elif isinstance(o, dict):
            for k, v in o.items():
                walk(v, f"{p}.{k}")
        elif isinstance(o, list):
            for i, v in enumerate(o):
                walk(v, f"{p}[{i}]")
    walk(u)
    return errs


# ---------------------------------------------------------------- añadido para la app (no está en tools/validate.py)
DATA = Path(__file__).resolve().parents[2] / "data" / "tech"
TITLES = 33   # el temario completo del plan: 33 unidades


def check_index(path=DATA / "index.json"):
    """data/tech/index.json: {format:1, blocks:[{id, title, short, units:[n…]}], units:[{id, n, block, title, available}]}.
    33 unidades u01-u33 en orden, cada una en el bloque que la lista; disponibles = las que tienen fichero."""
    errs = []
    e = errs.append
    try:
        ix = json.load(open(path, encoding="utf-8"))
    except Exception as x:
        return [f"cannot parse JSON: {x}"]
    if ix.get("format") != 1:
        e("format must be 1")
    blocks, units = ix.get("blocks") or [], ix.get("units") or []
    order = ["integration", "leadership", "successfactors", "gcp", "java", "extras", "final"]
    if [b.get("id") for b in blocks] != order:
        e(f"blocks must be {order} in order, got {[b.get('id') for b in blocks]}")
    if len(units) != TITLES:
        e(f"{len(units)} units (want {TITLES})")
    owner = {}
    for b in blocks:
        for k in ("id", "title", "short", "units"):
            if k not in b:
                e(f"block {b.get('id')}: missing {k}")
        if SPANISH.search(str(b.get("title", ""))):
            e(f"block {b.get('id')}: possible Spanish title")
        for n in b.get("units", []):
            if n in owner:
                e(f"unit {n} in two blocks")
            owner[n] = b.get("id")
    for i, u in enumerate(units, 1):
        for k in ("id", "n", "block", "title", "available"):
            if k not in u:
                e(f"unit {u.get('id')}: missing {k}")
        if u.get("n") != i or u.get("id") != f"u{i:02d}":
            e(f"unit #{i}: id/n {u.get('id')}/{u.get('n')} out of order")
        if owner.get(u.get("n")) != u.get("block"):
            e(f"unit {u.get('id')}: block {u.get('block')} but listed in {owner.get(u.get('n'))}")
        if not isinstance(u.get("available"), bool):
            e(f"unit {u.get('id')}: available must be bool")
        has = (Path(path).parent / f"{u.get('id')}.json").exists()
        if u.get("available") != has:
            e(f"unit {u.get('id')}: available={u.get('available')} but file {'exists' if has else 'is missing'}")
        if not u.get("title") or SPANISH.search(u.get("title", "")):
            e(f"unit {u.get('id')}: missing or Spanish title")
    if set(owner) != set(range(1, TITLES + 1)):
        e("blocks do not cover units 1-33 exactly once")
    return errs


def check_all(folder=DATA):
    """{fichero: [problemas]} de index.json y de cada uNN.json de la carpeta (vacío = todo bien). Además: el fichero de cada
    unidad coincide con su entrada del índice (id, n, bloque y título)."""
    folder = Path(folder)
    out = {"index.json": check_index(folder / "index.json")}
    try:
        ix = {u["id"]: u for u in json.load(open(folder / "index.json", encoding="utf-8"))["units"]}
    except Exception:
        ix = {}
    for p in sorted(folder.glob("u[0-9][0-9].json")):
        errs = check(str(p))
        try:
            u = json.load(open(p, encoding="utf-8"))
            m = ix.get(u.get("id"))
            if not m:
                errs.append("unit not in index.json")
            elif (m["n"], m["block"], m["title"]) != (u.get("n"), u.get("block"), u.get("title")):
                errs.append(f"index.json says {(m['n'], m['block'], m['title'])}, file says {(u.get('n'), u.get('block'), u.get('title'))}")
        except Exception:
            pass
        out[p.name] = errs
    return {k: v for k, v in out.items() if v}


def main():
    if len(sys.argv) > 1:
        bad = {p: check(p) for p in sys.argv[1:]}
        bad = {k: v for k, v in bad.items() if v}
    else:
        bad = check_all()
    for p, errs in bad.items():
        print(f"FAIL {p} ({len(errs)} problems)")
        for x in errs:
            print("  -", x)
    if not bad:
        print("OK")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
