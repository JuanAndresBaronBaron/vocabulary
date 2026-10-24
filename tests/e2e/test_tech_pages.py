"""Tech Prep, las páginas (T3, S1-SPEC §10.2-§10.8 y §13): Path, la página de una unidad, la chuleta de un bloque,
el glosario, Play con sus dos partidas en modo foco (Pairs y Beat the clock), My cases y My stories (js/tech-pages.js),
y data/tech/cases.json.

Lo que se comprueba: Path y las unidades salen de los datos («Coming soon» se lee y no se toca), la chuleta y el glosario
están completos (cada término, cada respuesta modelo, cada historia), el buscador, las dos partidas de principio a fin con
su mejor marca, los casos y las historias se guardan solos (al recargar sigue el texto y no hay botón de guardar), copiar
un caso de ejemplo, borrar con la hoja de confirmar, #/techstory/new?from=<itemId>, vocabTech.cases.questions, que
cases.json valida (palabras, puntos clave, fuentes https, inglés británico), las pantallas a 390×844 y 360×740 en claro y
oscuro y en escritorio, y que nada del niño cambia (ni claves, ni eventos del bus).
"""
from __future__ import annotations

import json
import re

import common as C
import tech_common as TC

AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
A11Y = (C.HERE / "a11y.js").read_text(encoding="utf-8")
CASES = json.loads((TC.DATA / "cases.json").read_text(encoding="utf-8"))
T = TC.TODAY

_TEXT_SIZES = """sel => { const out = [];
  for (const el of document.querySelectorAll(sel + ' *')) {
    if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own || el.closest('.vh, [aria-hidden=true], svg')) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 15) out.push(`${el.className || el.tagName}: ${fs}px «${el.textContent.trim().slice(0, 30)}»`);
  } return out; }"""
_PRI = "sel => [...document.querySelectorAll(sel + ' .glass-btn--pri, ' + sel + ' .btn-fill')].filter(e => e.getClientRects().length).length"
# transiciones y animaciones de lo que se ve (con Reducir movimiento, ≤ 160 ms)
_MOTION = """sel => { const out = [], ms = v => v.split(',').map(x => x.trim().endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000);
  for (const el of document.querySelectorAll(sel + ', ' + sel + ' *')) {
    const s = getComputedStyle(el), t = Math.max(...ms(s.transitionDuration)), a = s.animationName !== 'none' ? Math.max(...ms(s.animationDuration)) : 0;
    if (t > 160 || a > 160) out.push(`${el.className || el.tagName}: ${t}/${a} ms`);
  } return out.slice(0, 8); }"""


# ---------------------------------------------------------------- ayudas
def _screen_audit(page, label, scope="#app"):
    probs = []
    a = page.evaluate(AUDIT, {"what": ["contrast", "palette"]})
    probs += [f"{label} contraste: {x}" for x in a["contrast"]] + [f"{label} paleta: {x}" for x in a["palette"]]
    y = page.evaluate(A11Y, {"what": ["names", "roles", "images", "targets", "ids", "focusable"]})
    for k in ("names", "roles", "images", "targets", "ids", "focusable"):
        probs += [f"{label} {k}: {x}" for x in y[k]]
    probs += [f"{label} letra pequeña: {x}" for x in page.evaluate(_TEXT_SIZES, scope)]
    w = page.evaluate("[document.documentElement.scrollWidth, innerWidth]")
    if w[0] > w[1]:
        probs.append(f"{label} scroll horizontal: {w}")
    n = page.evaluate(_PRI, scope)
    if n > 1:
        probs.append(f"{label}: {n} botones destacados")
    return probs


def _hash(page):
    return C.current_hash(page)


def _wait_hash(page, pred, timeout=8000):
    """Espera a que el hash (sin '#/') cumpla pred (una cadena exacta o un prefijo terminado en '*')."""
    if pred.endswith("*"):
        page.wait_for_function("p => location.hash.replace(/^#\\/?/, '').startsWith(p)", arg=pred[:-1], timeout=timeout)
    else:
        page.wait_for_function("h => location.hash.replace(/^#\\/?/, '') === h", arg=pred, timeout=timeout)
    C.settle(page, 250)
    return _hash(page)


def _back_pill(page):
    return page.evaluate("""() => document.documentElement.hasAttribute('data-back') ?
      {t: document.querySelector('#dv-back > span').textContent, h: document.getElementById('dv-back').getAttribute('href')} : null""")


def _toasts(page):
    return page.evaluate("() => [...document.querySelectorAll('#m-toasts .m-toast')].map(t => t.textContent.trim())")


def _app_text(page):
    return page.evaluate("() => document.getElementById('app').innerText")


def _flat(s):
    return re.sub(r"\s+", " ", str(s)).strip()


def _runs():
    """Las secciones del camino: tramos seguidos de un mismo bloque, por número de unidad."""
    out = []
    for u in sorted(TC.index()["units"], key=lambda u: u["n"]):
        if out and out[-1][0] == u["block"]:
            out[-1][1].append(u)
        else:
            out.append((u["block"], [u]))
    return out


def _match_pairs(uids=None):
    out = set()
    for u, _, it in TC.items("match"):
        if uids is None or u["id"] in uids:
            out |= {(_flat(a), _flat(b)) for a, b in it["pairs"]}
    return out


def _tf():
    return {_flat(it["statement"]): (u, it) for u, _, it in TC.items("tf")}


def _done(uid, n=3):
    return {f"ls/{uid}-l{i}": TC.rec(best=8, total=10, done=TC.NOW_MS) for i in range(1, n + 1)}


# ---------------------------------------------------------------- data/tech/cases.json
_NORM = lambda s: " " + re.sub(r"\s+", " ", re.sub(r"[^a-z0-9$]+", " ", str(s).lower().replace("'", "").replace("\u2019", ""))).strip() + " "  # noqa: E731
_US = ["organization", "organize", "color", "behavior", "favorite", "center ", "analyze", "optimize", "license ", "catalog ",
       "defense", "labor", "program ", "modeling", "canceled", "traveled", "fulfill ", "enrollment", "artifact"]
_ES = re.compile(r"[áéíóúñ¿¡ü]|\b(?:el|la|los|las|una|pero|también|porque|cuando)\b", re.I)


def _texts(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for k, v in o.items():
            if k not in ("url", "id", "src", "kw"):
                yield from _texts(v)
    elif isinstance(o, list):
        for v in o:
            yield from _texts(v)


def validate_cases(d) -> list:
    """Las reglas de cases.json (S1-SPEC §10.7-§10.8 y SCHEMA.md): devuelve los problemas (vacío = válido)."""
    p = []
    if d.get("format") != 1:
        p.append("format no es 1")
    for k in ("cases", "generic", "guides"):
        if not isinstance(d.get(k), list):
            p.append(f"falta {k}")
            return p
    if len(d["cases"]) != 3:
        p.append(f"{len(d['cases'])} casos (deben ser 3)")
    if len(d["generic"]) != 10:
        p.append(f"{len(d['generic'])} preguntas generales (deben ser 10)")
    if [g.get("id") for g in d["guides"]] != ["conflict", "failure", "influence", "decision", "risk"]:
        p.append(f"guías: {[g.get('id') for g in d['guides']]}")
    ids = set()
    for c in d["cases"]:
        cid = c.get("id", "?")
        if not re.fullmatch(r"[a-z][a-z0-9-]{2,40}", cid) or cid.startswith("my-"):
            p.append(f"{cid}: id")
        for k in ("title", "summary"):
            if not str(c.get(k, "")).strip():
                p.append(f"{cid}: falta {k}")
        f = c.get("fields", {})
        if sorted(f) != sorted(["context", "requirements", "options", "decision", "tradeoffs", "outcome"]) or not all(str(v).strip() for v in f.values()):
            p.append(f"{cid}: campos {sorted(f)}")
        src = c.get("sources", [])
        sid = {s.get("id") for s in src}
        if not src:
            p.append(f"{cid}: sin fuentes")
        for s in src:
            if not str(s.get("url", "")).startswith("https://") or not s.get("title") or not isinstance(s.get("official"), bool):
                p.append(f"{cid}: fuente {s}")
        if not any(s.get("official") for s in src):
            p.append(f"{cid}: ninguna fuente oficial")
        qs = c.get("questions", [])
        if not 6 <= len(qs) <= 8:
            p.append(f"{cid}: {len(qs)} preguntas (6-8)")
        for q in qs:
            qid = q.get("id", "?")
            if qid in ids:
                p.append(f"{qid}: id repetido")
            ids.add(qid)
            if not str(q.get("q", "")).strip().endswith("?"):
                p.append(f"{qid}: la pregunta no acaba en ?")
            if not isinstance(q.get("seconds"), int) or not 60 <= q["seconds"] <= 180:
                p.append(f"{qid}: seconds {q.get('seconds')}")
            n = len(str(q.get("model", "")).split())
            if not 90 <= n <= 160:
                p.append(f"{qid}: la respuesta modelo tiene {n} palabras (90-160)")
            if q.get("src") not in sid:
                p.append(f"{qid}: src {q.get('src')} no es una fuente del caso")
            kps = q.get("keypoints", [])
            if not 3 <= len(kps) <= 6:
                p.append(f"{qid}: {len(kps)} puntos clave (3-6)")
            m = _NORM(q.get("model", ""))
            for kp in kps:
                kw = kp.get("kw", [])
                if not str(kp.get("text", "")).strip() or not kw:
                    p.append(f"{qid}: punto clave vacío {kp}")
                    continue
                if any(k != k.lower() or not k.strip() for k in kw):
                    p.append(f"{qid}: kw con mayúsculas o vacía {kw}")
                if not any(_NORM(k) in m for k in kw):
                    p.append(f"{qid}: ninguna kw de «{kp['text']}» está en la respuesta modelo ({kw})")
    for g in d["generic"]:
        gid = g.get("id", "?")
        if gid in ids:
            p.append(f"{gid}: id repetido")
        ids.add(gid)
        # una general puede ser una petición («Walk me through …»): acaba en ? o en .
        if not str(g.get("q", "")).strip().endswith(("?", ".")) or not 3 <= len(g.get("covers", [])) <= 6:
            p.append(f"{gid}: pregunta o covers")
    for g in d["guides"]:
        for k in ("title", "prompt", "opener"):
            if not str(g.get(k, "")).strip():
                p.append(f"guía {g.get('id')}: falta {k}")
        for k in ("looksFor", "tips", "pitfalls"):
            if not 3 <= len(g.get(k, [])) <= 6:
                p.append(f"guía {g.get('id')}: {k} con {len(g.get(k, []))}")
    for s in _texts({k: v for k, v in d.items() if k != "notes"}):
        low = s.lower()
        if _ES.search(s):
            p.append(f"¿español? «{s[:60]}»")
        for w in _US:
            if w in low + " " and "integration center" not in low:
                p.append(f"ortografía de EE. UU. ({w.strip()}): «{s[:60]}»")
        if re.search(r"\*\*|`|^#|\[[^\]]+\]\(", s):
            p.append(f"markdown: «{s[:60]}»")
        if "!" in s:
            p.append(f"exclamación: «{s[:60]}»")
        if re.search(r"claude|anthropic|opus|sonnet|haiku", low):
            p.append(f"nombre de modelo: «{s[:60]}»")
    return p


def test_cases_json_validates():
    """data/tech/cases.json: 3 casos con sus 6 campos, 6-8 preguntas con respuestas de 90-160 palabras y 3-6 puntos clave
    cuyas kw (minúsculas) salen en la respuesta, fuentes https (alguna oficial), 10 preguntas generales con lo que cubre una
    buena respuesta, las 5 guías; inglés británico, sin español, sin markdown, sin exclamaciones."""
    probs = validate_cases(CASES)
    assert not probs, "\n".join(probs)
    # el validador sí ve los fallos
    bad = json.loads(json.dumps(CASES))
    bad["cases"][0]["questions"][0]["model"] = "Too short."
    bad["cases"][0]["questions"][1]["keypoints"][0]["kw"] = ["Zzz"]
    bad["cases"][1]["sources"][0]["url"] = "http://example.com"
    bad["guides"][0]["tips"][0] = "Organize the color of the behavior."
    got = "\n".join(validate_cases(bad))
    for frag in ("palabras", "mayúsculas", "fuente", "EE. UU."):
        assert frag in got, (frag, got)


def test_cases_api_questions():
    """vocabTech.cases (para la práctica de casos de js/tech-lesson.js): questions(modelo) da sus preguntas con respuesta y
    puntos clave; questions(caso propio), las 10 generales con covers; un id que no existe falla con un mensaje claro;
    get, list y models."""
    page = TC.tech_page("phone", hash="#/techcases", data=TC.data({"case/my-own": TC.rec(title="Mine", fields={"context": "x"})}))
    try:
        r = page.evaluate("""async () => {
          const C = vocabTech.cases, m = await C.questions('partner-api'), o = await C.questions('my-own');
          let err = ''; try { await C.questions('nope'); } catch (e) { err = e.message; }
          return {m, o, err, get: C.get('my-own'), model: C.get('nightly-batch'), list: C.list().map(c => c.id), models: C.models().map(c => c.id),
            fields: C.FIELDS.map(f => f.k), star: C.STAR.map(f => f.k), off: vocabTech.offline.files().includes('data/tech/cases.json')}; }""")
        src = next(c for c in CASES["cases"] if c["id"] == "partner-api")
        assert [q["id"] for q in r["m"]] == [q["id"] for q in src["questions"]], r["m"]
        q0 = r["m"][0]
        assert q0["type"] == "explain" and q0["model"] == src["questions"][0]["model"] and q0["keypoints"] == src["questions"][0]["keypoints"], q0
        assert q0["caseId"] == "partner-api" and q0["own"] is False and q0["source"]["url"].startswith("https://"), q0
        assert [q["id"] for q in r["o"]] == [g["id"] for g in CASES["generic"]], r["o"]
        assert all(q["model"] is None and q["keypoints"] == [] and len(q["covers"]) >= 3 and q["own"] for q in r["o"]), r["o"][0]
        assert r["err"] == "No case nope.", r["err"]
        assert r["get"]["title"] == "Mine" and r["get"]["model"] is False and r["get"]["fields"]["context"] == "x", r["get"]
        assert r["model"]["model"] is True and r["model"]["fields"]["decision"], r["model"]
        assert r["list"] == ["my-own"] and r["models"] == [c["id"] for c in CASES["cases"]], r
        assert r["fields"] == ["context", "requirements", "options", "decision", "tradeoffs", "outcome"], r["fields"]
        assert r["star"] == ["situation", "task", "action", "result", "lessons"] and r["off"], r
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- Path y unidades
def test_path_from_data():
    """Path: los bloques en el orden del camino (Leadership entre los demás, con su bloque), cada unidad con su número,
    título y 3 puntos; las no disponibles dicen «Coming soon», se leen y no se tocan (no son enlaces ni botones); la
    cabecera del bloque con «Interview ready» (anillo) y «Cheat sheet»; «Next» en la unidad de la lección siguiente."""
    data = TC.data({**_done("u01", 2), "srs/u02-l1-i1": TC.srs()})
    page = TC.tech_page("phone", hash="#/techpath", data=data)
    try:
        secs = page.evaluate("""() => [...document.querySelectorAll('#tp-path > .tp-blk')].map(s => ({b: s.dataset.block,
          title: s.querySelector('.tp-bh').firstChild.textContent, sub: s.querySelector('.tp-bh-s').textContent,
          ring: !!s.querySelector('.tp-bhead > .tp-ring'), sheet: (s.querySelector('.tp-bh-cs') || {getAttribute: () => null}).getAttribute('href'),
          units: [...s.querySelectorAll('.tp-urow')].map(r => ({id: r.dataset.unit, tag: r.tagName, href: r.getAttribute('href'), role: r.getAttribute('role'),
            tab: r.tabIndex, text: r.innerText.replace(/\\s+/g, ' '), dots: r.querySelectorAll('.tp-dots i').length, on: r.querySelectorAll('.tp-dots i.on').length,
            next: !!r.querySelector('.tp-badge.pri')}))}))""")
        runs = _runs()
        blocks = {b["id"]: b for b in TC.index()["blocks"]}
        assert [s["b"] for s in secs] == [b for b, _ in runs], [s["b"] for s in secs]
        for s, (bid, us) in zip(secs, runs):
            assert s["title"] == blocks[bid]["title"], s
            assert [u["id"] for u in s["units"]] == [u["id"] for u in us], s
            av = any(u["available"] for u in us)
            assert s["ring"] == av and (s["sheet"] == f"#/techsheet/{bid}") == av, s
            assert ("interview ready" in s["sub"]) == av and (s["sub"] == "Coming soon") == (not av), s
            for r, u in zip(s["units"], us):
                assert f"Unit {u['n']}" in r["text"] and u["title"] in r["text"], r
                if u["available"]:
                    assert r["tag"] == "A" and r["href"] == f"#/techunit/{u['id']}" and r["dots"] == 3, r
                else:
                    assert r["tag"] == "DIV" and r["href"] is None and r["role"] is None and r["tab"] == -1, r
                    assert "Coming soon" in r["text"] and r["dots"] == 0, r
        u01 = secs[0]["units"][0]
        assert u01["on"] == 2 and "2 of 3 lessons done" in u01["text"] and u01["next"], u01
        assert not any(r["next"] for s in secs for r in s["units"] if r["id"] != "u01")
        # una «Coming soon» se lee bien (no está apagada con opacidad) y tocarla no hace nada
        soon = page.locator('.tp-soon[data-unit="u08"]')
        op = soon.evaluate("e => getComputedStyle(e).opacity")
        assert float(op) == 1.0, op
        soon.click()
        page.wait_for_timeout(300)
        assert _hash(page) == "techpath"
        page.locator('a.tp-urow[data-unit="u02"]').click()
        assert _wait_hash(page, "techunit/u02") == "techunit/u02"
        assert _back_pill(page) == {"t": "Path", "h": "#/techpath"}, _back_pill(page)
        assert page.evaluate("document.querySelector('#tabhead').hidden"), "la página de la unidad no lleva el título grande"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_unit_pages_from_data():
    """La página de cada unidad disponible: sus 3 lecciones (estado, mejor nota, Start/Continue/Repeat, enlace a
    #/techl/lesson/<id>), cada término con su IPA, altavoces, definición y ejemplo al tocar, la chuleta entera, las fuentes
    (las oficiales marcadas), la fecha de revisión y las notas de versión. El botón destacado abre la siguiente lección.
    Una unidad que no existe o que aún no está, con su aviso."""
    data = TC.data({"ls/u07-l1": TC.rec(best=7, total=10, done=TC.NOW_MS)})
    page = TC.tech_page("phone", hash="#/techunit/u01", data=data,
                        session={"tech:ls": {"id": "u07-l2"}})
    try:
        for u in TC.units():
            TC.goto(page, f"#/techunit/{u['id']}")
            r = page.evaluate("""() => ({
              h1: document.querySelector('#tp-unit h1').textContent,
              lessons: [...document.querySelectorAll('.tp-lrow')].map(a => ({href: a.getAttribute('href'), text: a.innerText.replace(/\\s+/g, ' '), pill: a.querySelector('.tp-pill').textContent})),
              go: (document.getElementById('tp-u-go') || {}).textContent || '', goHref: document.getElementById('tp-u-go') && document.getElementById('tp-u-go').getAttribute('href'),
              terms: [...document.querySelectorAll('.tp-terms .tp-tm')].map(t => ({id: t.dataset.term, name: t.querySelector('.tp-term-t').textContent,
                ipa: (t.querySelector('.tp-ipa') || {}).textContent || '', says: t.querySelectorAll('.tp-say').length, say: t.querySelector('.tp-say').dataset.say,
                def: (t.querySelector('.tp-def') || {}).textContent || '', ex: !!t.querySelector('[data-ex]'), src: !!t.querySelector('.tp-src')})),
              cs: [...document.querySelectorAll('.tp-cs .tp-cs-h')].map(h => h.textContent), points: [...document.querySelectorAll('.tp-cs .tp-cs-l li')].map(l => l.textContent),
              srcs: [...document.querySelectorAll('.tp-srcs a')].map(a => ({href: a.getAttribute('href'), off: !!a.querySelector('.tp-badge'), blank: a.target, rel: a.rel})),
              foot: document.querySelector('.tp-foot').innerText})""")
            assert r["h1"] == u["title"], r["h1"]
            assert [x["href"] for x in r["lessons"]] == [f"#/techl/lesson/{l['id']}" for l in u["lessons"]], r["lessons"]
            for x, l in zip(r["lessons"], u["lessons"]):
                assert l["title"] in x["text"] and f"{len(l['items'])} items" in x["text"], x
            assert [t["id"] for t in r["terms"]] == [t["id"] for t in u["terms"]], u["id"]
            for t, d in zip(r["terms"], u["terms"]):
                assert t["name"] == d["term"] and t["def"] == d["def"] and t["says"] == 2 and t["say"] == (d.get("say") or d["term"]), t
                assert bool(t["ipa"]) == bool(d.get("ipa")) and (not d.get("ipa") or d["ipa"].replace("/", "") in t["ipa"].replace("\u2060", "").replace("/", "")), (t, d.get("ipa"))
                assert t["ex"] == bool(d.get("example")) and t["src"], t
            secs = u["cheatsheet"]["sections"]
            assert r["cs"] == [s["h"] for s in secs] and r["points"] == [p for s in secs for p in s["points"]], u["id"]
            want = [s for s in u["sources"] if s["url"].startswith("https://")]
            assert [s["href"] for s in r["srcs"]] == [s["url"] for s in want], u["id"]
            assert [s["off"] for s in r["srcs"]] == [bool(s["official"]) for s in want], u["id"]
            assert all(s["blank"] == "_blank" and "noopener" in s["rel"] for s in r["srcs"]), r["srcs"][:2]
            assert "Facts checked on 24 October 2026." in r["foot"], r["foot"][:80]
            for n in u.get("versionNotes", []):
                assert _flat(n) in _flat(r["foot"]), n[:60]
            if u["id"] == "u07":
                assert [x["pill"] for x in r["lessons"]] == ["Repeat", "Continue", "Start"], r["lessons"]
                assert "Best 7 of 10" in r["lessons"][0]["text"], r["lessons"][0]
                assert r["go"].strip() == "Continue lesson 2" and r["goHref"] == "#/techl/lesson/u07-l2", r["go"]
            elif u["id"] == "u01":
                assert r["go"].strip() == "Start lesson 1" and [x["pill"] for x in r["lessons"]] == ["Start"] * 3, r
        # ejemplo al tocar y voz
        TC.goto(page, "#/techunit/u01")
        t0 = TC.unit("u01")["terms"][0]
        b = page.locator(f'#tp-t-{t0["id"]} [data-ex]')
        assert b.get_attribute("aria-expanded") == "false" and page.locator(f'#tp-x-{t0["id"]}').is_hidden()
        b.click()
        assert b.get_attribute("aria-expanded") == "true" and t0["example"] in page.inner_text(f'#tp-x-{t0["id"]}'), "el ejemplo no se abre"
        assert b.inner_text().strip() == "Hide example"
        page.locator(f'#tp-t-{t0["id"]} .tp-say').first.click()
        page.wait_for_function("() => (window.__spoken || []).length > 0", timeout=3000)
        sp = TC.spoken(page)
        assert sp[-1]["text"] == (t0.get("say") or t0["term"]) and sp[-1]["lang"].startswith("en"), sp
        page.locator("#tp-u-go").click()
        assert _wait_hash(page, "techl/*").startswith("techl/lesson/u01-l1")
        TC.goto(page, "#/techunit/u31")
        assert "Coming soon" in _app_text(page) and "Unit 31" in _app_text(page)
        TC.goto(page, "#/techunit/u99")
        assert "No such unit" in _app_text(page)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- la chuleta del bloque
def test_block_cheat_sheet_complete():
    """La chuleta de un bloque: todas las secciones de sus unidades disponibles y «Interview answers» con cada respuesta
    modelo de explain (con sus puntos clave y altavoz) y cada historia modelo (en sus partes STAR); los saltos llevan a
    cada parte; la cápsula de volver lleva a donde se estaba (Unit N, Glossary o Path) y no cambia al recargar."""
    page = TC.tech_page("phone", hash="#/techunit/u01")
    try:
        for bid in ("integration", "leadership"):
            TC.goto(page, f"#/techsheet/{bid}")
            us = [u for u in TC.units() if u["block"] == bid]
            text = _flat(_app_text(page))
            for u in us:
                for s in u["cheatsheet"]["sections"]:
                    assert _flat(s["h"]) in text, (bid, s["h"])
                    for p in s["points"]:
                        assert _flat(p) in text, (bid, p[:50])
            r = page.evaluate("""() => [...document.querySelectorAll('.tp-ans')].map(a => ({id: a.dataset.item, q: a.querySelector('.tp-ans-q').textContent,
              say: (a.querySelector('.tp-say') || {dataset: {}}).dataset.say, says: a.querySelectorAll('.tp-say').length, text: a.innerText,
              dt: [...a.querySelectorAll('.tp-star dt')].map(d => d.textContent)}))""")
            ex = [(u, it) for u in us for l in u["lessons"] for it in l["items"] if it["type"] == "explain"]
            st = [(u, it) for u in us for l in u["lessons"] for it in l["items"] if it["type"] == "story"]
            assert [a["id"] for a in r] == [it["id"] for _, it in ex] + [it["id"] for _, it in st], bid
            for a, (u, it) in zip(r, ex + st):
                assert a["says"] == 2 and a["say"] == it["model"], a["id"]
                if it["type"] == "explain":
                    assert a["q"] == it["q"] and _flat(it["model"]) in _flat(a["text"]), a["id"]
                    for k in it["keypoints"]:
                        assert _flat(k["text"]) in _flat(a["text"]), (a["id"], k["text"])
                else:
                    assert a["q"] == it["prompt"] and a["dt"] == ["Situation", "Task", "Action", "Result", "Lessons learned"], a
            if bid == "leadership":
                assert len(st) == 3 and "Unit 7 · more units coming soon" in text
        # saltos
        TC.goto(page, "#/techsheet/integration")
        page.locator('[data-jump="tp-sh-ans"]').click()
        page.wait_for_timeout(900)
        top = page.evaluate("document.getElementById('tp-sh-ans').getBoundingClientRect().top")
        assert 0 <= top < 200, top
        # la cápsula de volver
        TC.goto(page, "#/techunit/u03")
        page.locator("#tp-u-sheet").click()
        _wait_hash(page, "techsheet/integration")
        assert _back_pill(page) == {"t": "Unit 3", "h": "#/techunit/u03"}, _back_pill(page)
        C.reload(page)
        TC.wait_tech(page)
        assert _back_pill(page) == {"t": "Unit 3", "h": "#/techunit/u03"}, "tras recargar"
        page.locator("#dv-back").click()
        _wait_hash(page, "techunit/u03")
        TC.goto(page, "#/techgloss")
        TC.goto(page, "#/techsheet/leadership")
        assert _back_pill(page) == {"t": "Glossary", "h": "#/techgloss"}, _back_pill(page)
        TC.goto(page, "#/techpath")
        page.locator('.tp-blk[data-block="integration"] .tp-bh-cs').click()
        _wait_hash(page, "techsheet/integration")
        assert _back_pill(page) == {"t": "Path", "h": "#/techpath"}, _back_pill(page)
        TC.goto(page, "#/techsheet/java")
        assert "Coming soon" in _app_text(page)
        TC.goto(page, "#/techsheet/nope")
        assert "No such cheat sheet" in _app_text(page)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- glosario
def test_glossary_complete_and_search():
    """El glosario: cada término de las unidades disponibles (con IPA, altavoz, definición y enlace a su unidad), de la A a
    la Z por letras; el buscador filtra por término y definición, dice cuántos hay y avisa si no hay ninguno; vaciarlo
    vuelve a enseñarlos todos; la búsqueda sigue al volver a la pantalla."""
    page = TC.tech_page("phone", hash="#/techgloss")
    try:
        all_t = [(u, t) for u in TC.units() for t in u["terms"]]
        r = page.evaluate("""() => ({letters: [...document.querySelectorAll('.tp-gl')].map(h => h.textContent),
          n: document.getElementById('tp-g-n').textContent,
          items: [...document.querySelectorAll('.tp-ge')].map(e => ({id: e.dataset.term, unit: e.dataset.unit, name: e.querySelector('.tp-term-t').textContent,
            ipa: !!e.querySelector('.tp-ipa'), says: e.querySelectorAll('.tp-say').length, def: (e.querySelector('.tp-def') || {}).textContent || '',
            link: e.querySelector('.tp-ilink').getAttribute('href')}))})""")
        assert r["n"] == f"{len(all_t)} terms", r["n"]
        assert sorted((i["unit"], i["id"]) for i in r["items"]) == sorted((u["id"], t["id"]) for u, t in all_t)
        by = {(u["id"], t["id"]): t for u, t in all_t}
        for i in r["items"]:
            t = by[(i["unit"], i["id"])]
            assert i["name"] == t["term"] and i["def"] == t["def"] and i["says"] == 2 and i["ipa"] == bool(t.get("ipa")), i
            assert i["link"] == f"#/techunit/{i['unit']}", i
        names = [i["name"].lower() for i in r["items"]]
        assert names == sorted(names, key=lambda s: (not s[0].isdigit(), s)) or names[0][0].isdigit(), names[:10]
        assert r["letters"] == sorted(set(r["letters"]), key=lambda x: (x != "#", x)), r["letters"]
        q = page.locator("#tp-g-q")
        q.fill("idempotency")
        page.wait_for_timeout(400)
        vis = page.evaluate("() => [...document.querySelectorAll('.tp-ge')].filter(e => !e.hidden).map(e => e.querySelector('.tp-term-t').textContent)")
        want = [t["term"] for _, t in all_t if "idempotency" in (t["term"] + " " + t.get("say", "") + " " + t["def"]).lower()]
        assert sorted(vis) == sorted(want) and vis, (vis, want)
        assert page.inner_text("#tp-g-n") == f"{len(want)} {'term matches' if len(want) == 1 else 'terms match'} “idempotency”", page.inner_text("#tp-g-n")
        assert page.evaluate("() => [...document.querySelectorAll('.tp-gsec')].filter(s => !s.hidden).every(s => [...s.querySelectorAll('.tp-ge')].some(e => !e.hidden))")
        q.fill("zzqx")
        page.wait_for_timeout(400)
        assert page.locator("#tp-g-none").is_visible() and "No terms match “zzqx”" in page.inner_text("#tp-g-none")
        q.fill("")
        page.wait_for_timeout(400)
        assert page.inner_text("#tp-g-n") == f"{len(all_t)} terms" and page.locator("#tp-g-none").is_hidden()
        q.fill("pub/sub")
        page.wait_for_timeout(400)
        first = page.locator(".tp-ge:not([hidden]) .tp-ilink").first
        href = first.get_attribute("href")
        first.click()
        _wait_hash(page, href[2:])
        page.go_back()
        _wait_hash(page, "techgloss")
        assert page.input_value("#tp-g-q") == "pub/sub" and "match" in page.inner_text("#tp-g-n")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- Play
def _pairs_round(page, miss=False, wait_ms=0):
    """Juega una ronda de Pairs: un fallo (si miss), espera wait_ms con el reloj y empareja todo. Devuelve los pares."""
    page.wait_for_selector("#tp-pairs .tp-tile")
    pairs = page.evaluate("""() => [...document.querySelectorAll('.tp-tile[data-s=l]')].map(l => [l.dataset.i, l.querySelector('.tp-tile-t').textContent,
      document.querySelector(`.tp-tile[data-s=r][data-i="${l.dataset.i}"] .tp-tile-t`).textContent])""")
    if miss:
        page.locator('.tp-tile[data-s=l][data-i="0"]').click()
        page.locator('.tp-tile[data-s=r][data-i="1"]').click()
    else:
        page.locator('.tp-tile[data-s=l][data-i="0"]').click()
        page.locator('.tp-tile[data-s=l][data-i="0"]').click()   # tocarla otra vez la suelta
    if wait_ms:
        page.clock.run_for(wait_ms)
    for i, _, _ in pairs:
        page.locator(f'.tp-tile[data-s=r][data-i="{i}"]').click()
        page.locator(f'.tp-tile[data-s=l][data-i="{i}"]').click()
    page.clock.run_for(800)
    page.wait_for_selector("#tp-pend", timeout=5000)
    return pairs


def test_pairs_end_to_end():
    """Pairs: 6 parejas de verdad (de los match), sin repetir; tocar dos que no van juntas las pone en gris con ✗ (nunca
    rojo) un momento; las buenas se quedan en verde con ✓; al acabar, el tiempo, los fallos y la mejor marca
    (best/pairs, menos es mejor); otra ronda más lenta no la cambia y una más rápida sí; Play enseña la mejor marca; de
    las unidades estudiadas si dan para una ronda. A mitad de ronda, la ✕ y Atrás preguntan «Stop this round?»."""
    page = TC.tech_page("phone", hash="#/techplay")
    try:
        page.locator("#tp-g-pairs").click()
        _wait_hash(page, "techl/pairs")
        all_pairs = _match_pairs()
        pairs = page.evaluate("""() => [...document.querySelectorAll('.tp-tile[data-s=l]')].map(l => [l.querySelector('.tp-tile-t').textContent,
          document.querySelector(`.tp-tile[data-s=r][data-i="${l.dataset.i}"] .tp-tile-t`).textContent])""")
        assert len(pairs) == 6 and page.locator(".tp-tile[data-s=r]").count() == 6, pairs
        assert all((_flat(a), _flat(b)) in all_pairs for a, b in pairs), pairs
        texts = [_flat(x).lower() for p in pairs for x in p]
        assert len(set(texts)) == 12, texts
        assert page.evaluate("document.documentElement.dataset.focus") == "tech"
        # un fallo: gris con ✗
        page.locator('.tp-tile[data-s=l][data-i="0"]').click()
        assert page.get_attribute('.tp-tile[data-s=l][data-i="0"]', "aria-pressed") == "true"
        page.locator('.tp-tile[data-s=r][data-i="1"]').click()
        miss = page.evaluate("""() => { const t = document.querySelector('.tp-tile[data-s=r][data-i="1"]'), s = getComputedStyle(t);
          return {cls: t.className, bg: s.backgroundColor, fg: s.color, x: !!t.querySelector('use[href*="x-bold"], use[*|href*="x-bold"]')}; }""")
        assert "miss" in miss["cls"], miss
        rgb = [int(float(v)) for v in re.findall(r"[\d.]+", miss["bg"])[:3]]
        assert not (rgb[0] > rgb[1] + 30 and rgb[0] > rgb[2] + 30), f"el fallo es rojo: {miss}"
        page.clock.run_for(900)
        assert "miss" not in page.get_attribute('.tp-tile[data-s=r][data-i="1"]', "class")
        # la ✕ a mitad de ronda: «Stop this round?» · «Keep going»
        page.locator("#fx-x").click()
        page.wait_for_selector("dialog#tp-stop[open]", timeout=3000)
        assert "Stop this round?" in page.inner_text("#tp-stop") and "won't be saved" in page.inner_text("#tp-stop")
        page.locator("#tp-stop-go").click()
        page.wait_for_function("() => !document.getElementById('tp-stop').open", timeout=3000)
        assert _hash(page) == "techl/pairs"
        # Atrás del navegador: pregunta; «Stop» sale a Play
        page.go_back()
        page.wait_for_selector("dialog#tp-stop[open]", timeout=3000)
        assert _hash(page) == "techl/pairs"
        page.locator("#tp-stop-out").click()
        _wait_hash(page, "techplay")
        assert not TC.recs(page, "best"), "una ronda a medias no guarda marca"
        # una ronda entera (con un fallo y 20 s)
        page.locator("#tp-g-pairs").click()
        _wait_hash(page, "techl/pairs")
        _pairs_round(page, miss=True, wait_ms=20000)
        b1 = TC.recs(page, "best")["best/pairs"]
        assert b1["score"] >= 20000 and b1["mistakes"] == 1, b1
        end = page.inner_text("#tp-pend")
        assert "Round complete" in end and "1 mistake" in end and "Your first round" in end, end
        assert page.locator("#tp-pend .tp-pli").count() == 6
        act = TC.recs(page, "act")
        assert act[f"act/{TC.day_str(T)}"]["n"] == 6, act
        # otra más rápida: nueva mejor marca
        page.locator("#tp-g-again").click()
        _pairs_round(page)
        b2 = TC.recs(page, "best")["best/pairs"]
        assert b2["score"] < b1["score"] and b2["mistakes"] == 0, (b1, b2)
        assert "New best time" in page.inner_text("#tp-pend")
        # y una más lenta: no cambia
        page.locator("#tp-g-again").click()
        _pairs_round(page, wait_ms=90000)
        assert TC.recs(page, "best")["best/pairs"]["score"] == b2["score"]
        assert "Best time" in page.inner_text("#tp-pend")
        page.locator("#tp-g-back").click()
        _wait_hash(page, "techplay")
        s = int(round(b2["score"] / 1000))
        assert f"Best time {s // 60}:{s % 60:02d}" in page.inner_text("#tp-g-pairs"), page.inner_text("#tp-g-pairs")
        assert "From all available units" in page.inner_text("#tp-g-pairs")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
    # de lo estudiado: u01 y u02 hechas → solo sus parejas
    page = TC.tech_page("phone", hash="#/techplay", data=TC.data({**_done("u01"), **_done("u02")}))
    try:
        assert "From the units you've studied" in page.inner_text("#tp-g-pairs")
        mine = _match_pairs({"u01", "u02"})
        for _ in range(3):
            TC.goto(page, "#/techplay")
            page.locator("#tp-g-pairs").click()
            _wait_hash(page, "techl/pairs")
            pairs = page.evaluate("""() => [...document.querySelectorAll('.tp-tile[data-s=l]')].map(l => [l.querySelector('.tp-tile-t').textContent,
              document.querySelector(`.tp-tile[data-s=r][data-i="${l.dataset.i}"] .tp-tile-t`).textContent])""")
            assert all((_flat(a), _flat(b)) in mine for a, b in pairs), pairs
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_beat_the_clock_end_to_end():
    """Beat the clock: «Start», 60 s de enunciados de los tf; True/False (o ← →, o deslizar la tarjeta); cada respuesta
    enseña ✓ o ✗ un momento; al acabar el tiempo, aciertos, fallos y los fallos con su «why» y su fuente; la mejor marca
    en best/clock (más es mejor); Play la enseña."""
    page = TC.tech_page("phone", hash="#/techplay")
    try:
        tf = _tf()
        page.locator("#tp-g-clock").click()
        _wait_hash(page, "techl/clock")
        assert "Beat the clock" in page.inner_text("#tp-clock") and page.locator("#tp-c-go").is_visible()
        page.locator("#tp-c-go").click()
        page.wait_for_selector("#tp-c-card")
        assert page.inner_text("#tp-c-t") == "1:00"

        def cur():
            return tf[_flat(page.inner_text("#tp-c-q"))]

        def answer(right, how="tap"):
            u, it = cur()
            v = it["answer"] if right else not it["answer"]
            if how == "key":
                page.keyboard.press("ArrowRight" if v else "ArrowLeft")
            elif how == "swipe":
                box = page.locator("#tp-c-card").bounding_box()
                x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
                page.mouse.move(x, y)
                page.mouse.down()
                for k in range(1, 9):
                    page.mouse.move(x + (1 if v else -1) * k * 30, y)
                page.mouse.up()
            else:
                page.locator("#tp-c-yes" if v else "#tp-c-no").click()
            page.wait_for_selector("#tp-c-fb.ok, #tp-c-fb.miss", timeout=2000)
            fb = page.evaluate("() => ({cls: document.getElementById('tp-c-fb').className, t: document.getElementById('tp-c-fb').innerText, card: document.getElementById('tp-c-card').className})")
            assert (("ok" in fb["cls"]) == right) and ("Right" in fb["t"]) == right, fb
            if not right:
                assert "it's true" in fb["t"] if it["answer"] else "it's false" in fb["t"], fb
            page.clock.run_for(700)
            return it

        wrong = []
        answer(True)
        wrong.append(answer(False))
        answer(True, "key")
        answer(True, "swipe")
        wrong.append(answer(False, "key"))
        answer(True)
        assert page.inner_text("#tp-c-sc") == "4 right"
        page.clock.run_for(20000)
        assert page.inner_text("#tp-c-t") in ("0:40", "0:39", "0:38", "0:37", "0:36"), page.inner_text("#tp-c-t")
        page.clock.fast_forward(45000)
        page.clock.run_for(500)
        page.wait_for_selector("#tp-cend", timeout=5000)
        end = page.inner_text("#tp-cend")
        assert "Time's up" in end and "2 wrong" in end and "Your first round" in end, end
        assert page.inner_text("#tp-res-n").split()[0] == "4", page.inner_text("#tp-res-n")
        miss = page.evaluate("() => [...document.querySelectorAll('.tp-mi')].map(m => ({id: m.dataset.item, text: m.innerText, src: !!m.querySelector('.tp-src')}))")
        assert sorted(m["id"] for m in miss) == sorted({w["id"] for w in wrong}), miss
        for m in miss:
            it = next(w for w in wrong if w["id"] == m["id"])
            assert _flat(it["why"]) in _flat(m["text"]) and ("It's true." if it["answer"] else "It's false.") in m["text"] and m["src"], m
        b = TC.recs(page, "best")["best/clock"]
        assert b["score"] == 4 and b["answered"] == 6, b
        assert TC.recs(page, "act")[f"act/{TC.day_str(T)}"]["n"] == 6
        # otra ronda peor: no cambia; Play enseña la mejor
        page.locator("#tp-g-again").click()
        page.wait_for_selector("#tp-c-card")
        answer(True)
        page.clock.fast_forward(61000)
        page.clock.run_for(500)
        page.wait_for_selector("#tp-cend", timeout=5000)
        assert TC.recs(page, "best")["best/clock"]["score"] == 4 and "Best score 4" in page.inner_text("#tp-cend")
        page.locator("#tp-g-back").click()
        _wait_hash(page, "techplay")
        assert "Best score 4" in page.inner_text("#tp-g-clock")
        # a mitad de ronda la ✕ pregunta y el reloj se para mientras tanto
        page.locator("#tp-g-clock").click()
        _wait_hash(page, "techl/clock")
        page.locator("#tp-c-go").click()
        page.wait_for_selector("#tp-c-card")
        page.locator("#fx-x").click()
        page.wait_for_selector("dialog#tp-stop[open]", timeout=3000)
        page.clock.run_for(30000)
        page.locator("#tp-stop-go").click()
        page.wait_for_function("() => !document.getElementById('tp-stop').open", timeout=3000)
        page.clock.run_for(400)
        assert page.inner_text("#tp-c-t") in ("1:00", "0:59"), page.inner_text("#tp-c-t")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- My cases
def test_cases_autosave_copy_delete():
    """My cases: «New case» abre uno vacío que no se guarda hasta escribir; se guarda solo al escribir (sin botón de
    guardar) y al recargar sigue ahí; la lista dice cuánto está hecho; un caso de ejemplo es de solo lectura, con sus
    preguntas y «Use as a starting point», que lo copia en uno propio; «Practise this case» va a #/techl/case/<id>;
    borrar pide confirmación («Cancel» destacado) y luego lo quita."""
    page = TC.tech_page("phone", hash="#/techcases")
    try:
        assert page.locator("#tp-c-none").is_visible() and page.locator(".tp-mrow").count() == 3
        assert [b.inner_text() for b in page.locator(".tp-mrow .tp-badge").all()] == ["Example"] * 3
        page.locator("#tp-c-new").click()
        h = _wait_hash(page, "techcase/my-*")
        cid = h.split("/")[1]
        assert not TC.recs(page, "case"), "un caso nuevo sin escribir no se guarda"
        btns = page.evaluate("() => [...document.querySelectorAll('#app button, #app a, #app [role=button]')].map(b => b.innerText.trim().toLowerCase())")
        assert not any("save" in b for b in btns), btns
        assert page.locator("#tp-case textarea").count() == 6 and page.locator(".tp-hint").count() == 6
        assert page.get_attribute("#tp-e-go", "href") == f"#/techl/case/{cid}"
        page.locator("#tp-e-title").fill("Hires to payroll")
        page.locator("#tp-e-context").fill("Payroll learns about new starters a day late.\nAbout 2,000 hires a year.")
        page.locator("#tp-e-decision").fill("Publish a hire event.")
        page.clock.run_for(600)
        rec = TC.recs(page, "case")[f"case/{cid}"]
        assert rec["title"] == "Hires to payroll" and rec["fields"]["context"].endswith("2,000 hires a year.") and rec["fields"]["decision"], rec
        assert "Saved on this device" in page.inner_text("#tp-sv")
        h0 = page.evaluate("document.getElementById('tp-e-context').offsetHeight")
        page.locator("#tp-e-context").fill("Line\n" * 12)
        page.clock.run_for(600)
        assert page.evaluate("document.getElementById('tp-e-context').offsetHeight") > h0 + 60, "el cuadro no crece"
        page.locator("#tp-e-context").fill("Payroll learns about new starters a day late.")
        # al irse antes de que pase la espera, también se guarda
        page.locator("#tp-e-outcome").fill("Same-day accounts")
        TC.goto(page, "#/techcases")
        assert TC.recs(page, "case")[f"case/{cid}"]["fields"]["outcome"] == "Same-day accounts"
        row = page.locator(f'.tp-crow[data-case="{cid}"]')
        assert "Hires to payroll" in row.inner_text() and "3 of 6 sections" in row.inner_text(), row.inner_text()
        TC.goto(page, f"#/techcase/{cid}")
        C.reload(page)
        TC.wait_tech(page)
        assert page.input_value("#tp-e-title") == "Hires to payroll" and page.input_value("#tp-e-outcome") == "Same-day accounts"
        assert _back_pill(page) == {"t": "My cases", "h": "#/techcases"}
        # otro nuevo, sin escribir, y fuera: nada guardado
        TC.goto(page, "#/techcase/new")
        _wait_hash(page, "techcase/my-*")
        TC.goto(page, "#/techcases")
        assert len(TC.recs(page, "case")) == 1, TC.recs(page, "case")
        # un ejemplo: solo lectura, preguntas, copiar
        m = CASES["cases"][1]
        page.locator(f'.tp-mrow[data-case="{m["id"]}"]').click()
        _wait_hash(page, f"techcase/{m['id']}")
        assert page.locator("#tp-case textarea, #tp-case input").count() == 0
        assert page.locator(".tp-qq").count() == len(m["questions"]) and page.locator(".tp-ro").count() == 6
        txt = _flat(_app_text(page))
        for k in ("context", "requirements", "options", "decision", "tradeoffs", "outcome"):
            assert _flat(m["fields"][k]) in txt, k
        q = m["questions"][0]
        page.locator(f'[aria-controls="tp-qa-{q["id"]}"]').click()
        assert _flat(q["model"]) in _flat(page.inner_text(f'#tp-qa-{q["id"]}'))
        assert page.get_attribute("#tp-e-go", "href") == f"#/techl/case/{m['id']}"
        assert page.evaluate(_PRI, "#app") == 1
        page.locator("#tp-e-copy").click()
        h = _wait_hash(page, "techcase/my-*")
        nid = h.split("/")[1]
        r = TC.recs(page, "case")[f"case/{nid}"]
        assert r["from"] == m["id"] and r["title"] == m["title"] and r["fields"] == m["fields"], r
        assert page.input_value("#tp-e-tradeoffs") == m["fields"]["tradeoffs"]
        assert any("Copied" in t for t in _toasts(page)), _toasts(page)
        assert m["title"] in page.inner_text(".tp-from")
        # borrar: confirmar, cancelar, borrar
        page.locator("#tp-e-del").click()
        page.wait_for_selector("dialog#tp-del[open]", timeout=3000)
        d = page.evaluate("""() => ({t: document.getElementById('tp-del').innerText, focus: document.activeElement.id,
          pri: document.getElementById('tp-del-no').classList.contains('glass-btn--pri'), del: document.getElementById('tp-del-yes').classList.contains('glass-btn--pri')})""")
        assert "Delete this case?" in d["t"] and "can't be undone" in d["t"] and d["pri"] and not d["del"] and d["focus"] == "tp-del-no", d
        page.locator("#tp-del-no").click()
        page.wait_for_function("() => !document.getElementById('tp-del').open", timeout=3000)
        assert f"case/{nid}" in TC.recs(page, "case")
        page.locator("#tp-e-del").click()
        page.wait_for_selector("dialog#tp-del[open]", timeout=3000)
        page.locator("#tp-del-yes").click()
        _wait_hash(page, "techcases")
        assert f"case/{nid}" not in TC.recs(page, "case") and TC.state(page)["recs"][f"case/{nid}"].get("del") is True
        assert any("Case deleted" in t for t in _toasts(page)), _toasts(page)
        assert page.locator(f'.tp-crow[data-case="{nid}"]').count() == 0
        TC.goto(page, f"#/techcase/{nid}")
        assert "This case isn't here" in _app_text(page)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- My stories
def test_stories_autosave_hear_and_from_item():
    """My stories: una historia nueva se guarda sola (título, pregunta y las 5 partes STAR), cuenta las palabras frente
    a 120-200 y «Hear it» la dice con la voz inglesa; al recargar sigue ahí. #/techstory/new?from=<itemId> la empieza con
    la pregunta de ese ítem (y su historia modelo para mirar) y, si ya existe, abre esa. Las 5 guías en una hoja con lo que
    busca el entrevistador, consejos, errores y una buena primera frase; «Write this story» empieza una con su pregunta.
    Borrar con confirmación."""
    page = TC.tech_page("phone", hash="#/techstories")
    try:
        assert page.locator("#tp-s-none").is_visible() and page.locator("[data-guide]").count() == 5
        page.locator("#tp-s-new").click()
        h = _wait_hash(page, "techstory/my-*")
        sid = h.split("/")[1]
        assert not TC.recs(page, "story")
        assert page.locator("#tp-story textarea").count() == 6 and "0 words · aim for 120 to 200" == page.inner_text("#tp-wc")
        page.locator("#tp-e-title").fill("The retry storm")
        page.locator("#tp-e-prompt").fill("Tell me about a time you fixed an outage.")
        sit = " ".join(["word"] * 50)
        page.locator("#tp-e-situation").fill(sit)
        page.locator("#tp-e-action").fill(" ".join(["step"] * 80))
        page.clock.run_for(600)
        assert page.inner_text("#tp-wc") == "130 words · within the 120 to 200 target", page.inner_text("#tp-wc")
        rec = TC.recs(page, "story")[f"story/{sid}"]
        assert rec["title"] == "The retry storm" and rec["prompt"].startswith("Tell me") and rec["fields"]["situation"] == sit, rec
        n0 = len(TC.spoken(page))
        page.locator("#tp-e-hear").click()
        page.wait_for_function("n => (window.__spoken || []).length > n", arg=n0, timeout=3000)
        said = " ".join(x["text"] for x in TC.spoken(page)[n0:])
        assert said.startswith("word word") and "step" in said, said[:80]
        C.reload(page)
        TC.wait_tech(page)
        assert page.input_value("#tp-e-title") == "The retry storm" and page.input_value("#tp-e-situation") == sit
        assert _back_pill(page) == {"t": "My stories", "h": "#/techstories"}
        TC.goto(page, "#/techstories")
        row = page.locator(f'.tp-srow2[data-story="{sid}"]')
        assert "The retry storm" in row.inner_text() and "130 words" in row.inner_text()
        # desde un ítem de lección
        it = TC.item("u07-l2-i4")
        TC.goto(page, "#/techstory/new?from=u07-l2-i4")
        h = _wait_hash(page, "techstory/my-*")
        fid = h.split("/")[1]
        assert page.input_value("#tp-e-prompt") == it["prompt"] and "From Unit 7" in page.inner_text(".tp-from")
        page.locator('[aria-controls="tp-ms-b"]').click()
        assert "Situation" in page.inner_text("#tp-ms-b") and "Lessons learned" in page.inner_text("#tp-ms-b")
        page.locator("#tp-e-result").fill("All three leads accepted it.")
        page.clock.run_for(600)
        r = TC.recs(page, "story")[f"story/{fid}"]
        assert r["from"] == "u07-l2-i4" and r["prompt"] == it["prompt"], r
        TC.goto(page, "#/techstories")
        TC.goto(page, "#/techstory/new?from=u07-l2-i4")
        assert _wait_hash(page, f"techstory/{fid}") == f"techstory/{fid}", "no abre la historia que ya había"
        # las guías
        TC.goto(page, "#/techstories")
        g = CASES["guides"][2]
        page.locator(f'[data-guide="{g["id"]}"]').click()
        page.wait_for_selector("dialog#tp-guide[open]", timeout=3000)
        page.wait_for_timeout(400)
        t = _flat(page.inner_text("#tp-guide"))
        for x in [g["title"], g["prompt"], g["opener"], *g["looksFor"], *g["tips"], *g["pitfalls"]]:
            assert _flat(x) in t, x
        for hh in ("What the interviewer looks for", "Tips", "Pitfalls", "A good first sentence"):
            assert hh in t, hh
        page.locator("#tp-guide .tp-say").first.click()
        page.wait_for_function("t => (window.__spoken || []).some(s => s.text === t)", arg=g["opener"], timeout=3000)
        page.locator("#tp-gd-go").click()
        h = _wait_hash(page, "techstory/my-*")
        page.wait_for_function("() => !document.getElementById('tp-guide').open", timeout=3000)
        assert page.input_value("#tp-e-prompt") == g["prompt"] and page.locator("#tp-e-guide").count() == 1
        page.locator("#tp-e-task").fill("I wanted one shared client.")
        page.clock.run_for(600)
        assert TC.recs(page, "story")[f"story/{h.split('/')[1]}"]["guide"] == g["id"]
        page.locator("#tp-e-guide").click()
        page.wait_for_selector("dialog#tp-guide[open]", timeout=3000)
        assert page.locator("#tp-gd-go").count() == 0
        page.locator("#tp-guide [data-close]").click()
        page.wait_for_function("() => !document.getElementById('tp-guide').open", timeout=3000)
        # borrar
        TC.goto(page, f"#/techstory/{sid}")
        page.locator("#tp-e-del").click()
        page.wait_for_selector("dialog#tp-del[open]", timeout=3000)
        assert "Delete this story?" in page.inner_text("#tp-del") and "The retry storm" in page.inner_text("#tp-del")
        page.locator("#tp-del-yes").click()
        _wait_hash(page, "techstories")
        assert f"story/{sid}" not in TC.recs(page, "story")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- pantallas: tamaños, temas, escritorio, capturas
_SEED = TC.data({
    **_done("u01"), "ls/u02-l1": TC.rec(best=9, total=10, done=TC.NOW_MS),
    "srs/u01-l1-i1": TC.srs(b=2, due=T + 3), "best/pairs": TC.rec(score=41000, mistakes=1), "best/clock": TC.rec(score=12, answered=15),
    "case/my-hires": TC.rec(title="Hires to payroll with events", fields={
        "context": "A retail company hires about 2,000 people a year. Payroll learns about new starters a day late.",
        "requirements": "New starters must be in payroll within 15 minutes. No personal data in logs.",
        "options": "1. Keep the nightly file. 2. Run the file every hour. 3. Publish a hire event to Pub/Sub.",
        "decision": "", "tradeoffs": "", "outcome": ""}),
    "story/my-storm": TC.rec(title="The retry storm", prompt="Tell me about a time you fixed an outage.", fields={
        "situation": "At a retail company, a partner API slowed down and our retries made it worse.",
        "task": "As the integration lead, I had to stop the incident and prevent the next one.",
        "action": "I added exponential backoff with jitter, a circuit breaker and an alert on the error rate.",
        "result": "The next slowdown caused no incident.", "lessons": "Retries need limits from day one."}),
})
_ROUTES = [("path", "#/techpath"), ("unit-u01", "#/techunit/u01"), ("cheat-sheet-leadership", "#/techsheet/leadership"),
           ("glossary", "#/techgloss"), ("play", "#/techplay"), ("my-cases", "#/techcases"), ("case-example", "#/techcase/recruiting-events"),
           ("case-own", "#/techcase/my-hires"), ("my-stories", "#/techstories"), ("story", "#/techstory/my-storm"),
           ("pairs", "#/techl/pairs"), ("beat-the-clock", "#/techl/clock")]


def test_screens_phone_light_dark():
    """Cada pantalla a 390×844 y 360×740, en claro y oscuro: contraste ≥ 4,5:1, sin colores prohibidos, nombres, roles,
    objetivos ≥ 44 px, letra ≥ 15 px, sin scroll horizontal, un solo botón destacado como mucho, sin errores. Capturas a
    390 (claro y oscuro)."""
    probs = []
    for (w, h) in [(390, 844), (360, 740)]:
        for scheme in ("light", "dark"):
            page = TC.tech_page("phone", hash="#/techpath", data=_SEED, color_scheme=scheme, viewport={"width": w, "height": h})
            try:
                for name, r in _ROUTES:
                    TC.goto(page, r)
                    label = f"{name}-{w}-{scheme}"
                    probs += _screen_audit(page, label)
                    if w == 390:
                        long = name in ("unit-u01", "cheat-sheet-leadership", "glossary", "case-example")
                        TC.shot(page, f"{name}-390-{scheme}", full_page=not long)
                probs += [f"{w}-{scheme}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs[:80])


def test_screens_in_play_and_extra_captures():
    """Las partidas jugando y al acabar, la guía de historias, una búsqueda y la chuleta de Integration, a 390 (claro y
    oscuro), con su auditoría; con Reducir movimiento nada dura más de 160 ms."""
    probs = []
    for scheme in ("light", "dark"):
        page = TC.tech_page("phone", hash="#/techplay", data=_SEED, color_scheme=scheme)
        try:
            TC.goto(page, "#/techl/pairs")
            page.locator('.tp-tile[data-s=l][data-i="0"]').click()
            page.locator('.tp-tile[data-s=r][data-i="0"]').click()
            page.locator('.tp-tile[data-s=l][data-i="1"]').click()
            page.locator('.tp-tile[data-s=r][data-i="2"]').click()
            page.wait_for_timeout(150)
            probs += _screen_audit(page, f"pairs-play-{scheme}")
            TC.shot(page, f"pairs-playing-390-{scheme}", full_page=False)
            page.clock.run_for(900)
            page.locator('.tp-tile[data-s=l][data-i="3"]').click()
            probs += _screen_audit(page, f"pairs-sel-{scheme}")
            # a mitad de ronda la ✕ pregunta; «Stop» sale a Play
            page.locator("#fx-x").click()
            page.wait_for_selector("dialog#tp-stop[open]", timeout=3000)
            page.wait_for_timeout(400)
            probs += _screen_audit(page, f"stop-{scheme}", scope="#tp-stop")
            page.locator("#tp-stop-out").click()
            _wait_hash(page, "techplay")
            page.locator("#tp-g-pairs").click()
            _wait_hash(page, "techl/pairs")
            _pairs_round(page, miss=True, wait_ms=3000)
            probs += _screen_audit(page, f"pairs-end-{scheme}")
            TC.shot(page, f"pairs-end-390-{scheme}", full_page=False)
            TC.goto(page, "#/techl/clock")
            page.locator("#tp-c-go").click()
            page.wait_for_selector("#tp-c-card")
            probs += _screen_audit(page, f"clock-play-{scheme}")
            TC.shot(page, f"beat-the-clock-playing-390-{scheme}", full_page=False)
            tf = _tf()
            for right in (False, True):
                it = tf[_flat(page.inner_text("#tp-c-q"))][1]
                page.locator("#tp-c-yes" if (it["answer"] if right else not it["answer"]) else "#tp-c-no").click()
                page.wait_for_timeout(120)
                probs += _screen_audit(page, f"clock-fb-{right}-{scheme}")
                if not right:
                    TC.shot(page, f"beat-the-clock-answer-390-{scheme}", full_page=False)
                page.clock.run_for(700)
            page.clock.fast_forward(61000)
            page.clock.run_for(500)
            page.wait_for_selector("#tp-cend", timeout=5000)
            probs += _screen_audit(page, f"clock-end-{scheme}")
            TC.shot(page, f"beat-the-clock-end-390-{scheme}", full_page=False)
            TC.goto(page, "#/techstories")
            page.locator('[data-guide="failure"]').click()
            page.wait_for_selector("dialog#tp-guide[open]", timeout=3000)
            page.wait_for_timeout(500)
            probs += _screen_audit(page, f"guide-{scheme}", scope="#tp-guide")
            TC.shot(page, f"story-guide-390-{scheme}", full_page=False)
            page.keyboard.press("Escape")
            page.wait_for_timeout(400)
            TC.goto(page, "#/techcase/my-hires")
            page.locator("#tp-e-del").click()
            page.wait_for_selector("dialog#tp-del[open]", timeout=3000)
            page.wait_for_timeout(400)
            probs += _screen_audit(page, f"delete-{scheme}", scope="#tp-del")
            TC.shot(page, f"case-delete-confirm-390-{scheme}", full_page=False)
            page.locator("#tp-del-no").click()
            TC.goto(page, "#/techgloss")
            page.locator("#tp-g-q").fill("retry")
            page.wait_for_timeout(400)
            probs += _screen_audit(page, f"gloss-search-{scheme}")
            TC.shot(page, f"glossary-search-390-{scheme}", full_page=False)
            TC.goto(page, "#/techsheet/integration")
            TC.shot(page, f"cheat-sheet-integration-390-{scheme}", full_page=False)
            page.locator('[data-jump="tp-sh-ans"]').click()
            page.wait_for_timeout(800)
            TC.shot(page, f"cheat-sheet-interview-answers-390-{scheme}", full_page=False)
            probs += [f"{scheme}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    page = TC.tech_page("phone", hash="#/techl/pairs", data=_SEED, reduced_motion="reduce")
    try:
        for r in ["#/techl/pairs", "#/techunit/u01", "#/techstory/my-storm"]:
            TC.goto(page, r)
            probs += [f"reduce {r}: {x}" for x in page.evaluate(_MOTION, "#app")]
        TC.goto(page, "#/techl/clock")
        page.locator("#tp-c-go").click()
        page.wait_for_selector("#tp-c-card")
        probs += [f"reduce clock: {x}" for x in page.evaluate(_MOTION, "#app")]
    finally:
        page.context.close()
    assert not probs, "\n".join(probs[:80])


def test_screens_desktop():
    """En escritorio (1280): la columna de Tech Prep (≤ 680 px) centrada, el texto largo a ≤ 70 caracteres por línea,
    sin scroll horizontal ni errores; capturas de Path, una unidad, la chuleta y Pairs."""
    page = TC.tech_page("desk", hash="#/techpath", data=_SEED)
    probs = []
    try:
        for name, r in _ROUTES:
            TC.goto(page, r)
            box = page.evaluate("""() => { const p = document.querySelector('#app .tp-page').getBoundingClientRect();
              return [Math.round(p.width), Math.round(p.left + p.width / 2), innerWidth]; }""")
            if box[0] > 680 or abs(box[1] - box[2] / 2) > 30:
                probs.append(f"{name}: columna {box}")
            # cada línea de texto que se ve, medida en «ch» de su letra (como max-width:70ch): ≤ 70
            long = page.evaluate("""() => { const out = [], cv = document.createElement('canvas').getContext('2d');
              const tw = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
              for (let n; (n = tw.nextNode());) {
                const el = n.parentElement;
                if (!n.textContent.trim() || !el.getClientRects().length || el.closest('.tp-tile, svg, .vh, textarea')) continue;
                const s = getComputedStyle(el); cv.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
                const r = document.createRange(); r.selectNodeContents(n);
                const w = Math.max(0, ...[...r.getClientRects()].map(x => x.width)), cpl = w / cv.measureText('0').width;
                if (cpl > 70.5) out.push(`${el.className || el.tagName}: ${Math.round(cpl)} «${n.textContent.trim().slice(0, 30)}»`);
              } return out.slice(0, 5); }""")
            probs += [f"{name} línea larga: {x}" for x in long]
            probs += _screen_audit(page, f"desk-{name}")
            if name in ("path", "unit-u01", "pairs", "my-cases"):
                TC.shot(page, f"{name}-escritorio")
        TC.goto(page, "#/techsheet/integration")
        TC.shot(page, "cheat-sheet-integration-escritorio")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs[:60])


# ---------------------------------------------------------------- lo del niño no cambia
def test_kid_untouched_after_heavy_use():
    """Mucho uso de las páginas (todas las pantallas, varias rondas de las dos partidas, casos y historias escritos,
    copiados y borrados, guías, búsquedas) no cambia nada del niño: su partida y la exportación de la base siguen
    iguales, ninguna clave que no sea tech:* cambia y no se emite ningún evento del niño en el bus."""
    page = TC.tech_page("desk", hash="")   # desde Hoy del niño (lo que escribe solo al abrirse ya está escrito)
    try:
        before = TC.kid_snapshot(page)
        ls0 = {k: v for k, v in C.storage(page).items() if not k.startswith("tech:")}
        TC.bus_log(page)
        TC.goto(page, "#/techpath")
        for _, r in _ROUTES[:6]:
            TC.goto(page, r)
        TC.goto(page, "#/techsheet/integration")
        for _ in range(2):
            TC.goto(page, "#/techplay")
            page.locator("#tp-g-pairs").click()
            _wait_hash(page, "techl/pairs")
            _pairs_round(page, miss=True)
        TC.goto(page, "#/techl/clock")
        page.locator("#tp-c-go").click()
        page.wait_for_selector("#tp-c-card")
        for _ in range(4):
            page.locator("#tp-c-yes").click()
            page.clock.run_for(700)
        page.clock.fast_forward(61000)
        page.clock.run_for(500)
        page.wait_for_selector("#tp-cend", timeout=5000)
        TC.goto(page, "#/techcase/new")
        _wait_hash(page, "techcase/my-*")
        page.locator("#tp-e-title").fill("A case")
        page.locator("#tp-e-context").fill("Some context.")
        page.clock.run_for(600)
        TC.goto(page, "#/techcase/partner-api")
        page.locator("#tp-e-copy").click()
        _wait_hash(page, "techcase/my-*")
        page.locator("#tp-e-del").click()
        page.wait_for_selector("dialog#tp-del[open]", timeout=3000)
        page.locator("#tp-del-yes").click()
        _wait_hash(page, "techcases")
        TC.goto(page, "#/techstory/new?from=u07-l2-i2")
        _wait_hash(page, "techstory/my-*")
        page.locator("#tp-e-situation").fill("At a retail company, hires reached IT a day late.")
        page.clock.run_for(600)
        page.locator("#tp-e-hear").click()
        TC.goto(page, "#/techstories")
        page.locator('[data-guide="risk"]').click()
        page.wait_for_selector("dialog#tp-guide[open]", timeout=3000)
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        TC.goto(page, "#/techgloss")
        page.locator("#tp-g-q").fill("token")
        page.wait_for_timeout(300)
        TC.goto(page, "#/tech")
        page.locator("#tp-back").click()
        _wait_hash(page, "")
        after = TC.kid_snapshot(page)
        d = C.diff_exports(before, after, allow_new=False)
        assert not d, "Tech Prep cambió la partida del niño:\n  " + "\n  ".join(d)
        base = C.load_baseline()
        d2 = C.diff_exports(base, C.export(page))
        assert not d2, "la exportación ya no es la de la base:\n  " + "\n  ".join(d2)
        ls1 = {k: v for k, v in C.storage(page).items() if not k.startswith("tech:")}
        changed = sorted(k for k in set(ls0) | set(ls1) if ls0.get(k) != ls1.get(k))
        assert not changed, f"claves que no son de Tech Prep cambiaron: {changed}"
        bad = page.evaluate("() => Object.keys(localStorage).filter(k => k.startsWith('tech:') && vocabSave.typeOf(k))")
        assert not bad, bad
        assert TC.bus_seen(page) == [], TC.bus_seen(page)
        ss = TC.tech_keys(page)["session"]
        assert set(ss) <= {"tech:in", "tech:ls", "tech:new", "tech:sheetfrom", "tech:tabs"}, ss
        assert len(TC.recs(page, "case")) == 1 and len(TC.recs(page, "story")) == 1 and set(TC.recs(page, "best")) == {"best/pairs", "best/clock"}
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
