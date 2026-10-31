"""Lecciones (js/lesson.js y el «¿Ya lo sabes?» de js/learn.js): cada palabra por su sitio (tema:fila) y nunca dos
respuestas buenas («Primo» y «Prima» son «cousin»; «phone» y «telephone», «teléfono»); la palabra que se repite en el
idioma («la maison») se enseña una vez. Aprender y preguntar mezclados (aprende 3 → pregunta esas 3 → aprende 3 → …),
con 2 o 3 palabras del repaso que se califican como en el repaso; las falladas van a la caja 0 y «Repasa tus fallos»
vuelve a preguntar solo esas. Recargar sigue el mismo plan. «Ordena las letras» (con el artículo puesto, æøå y
acentos, 1 o 2 letras de sobra, también con el teclado), «Completa la frase» (solo si la palabra sale en el ejemplo;
3 opciones; la frase entera en voz alta y en español) y «Empareja» (4 dibujos con su palabra). Sin dibujo, un número
(«71») o un español de 3 letras sale entero. «¿Ya lo sabes?» al empezar una unidad: con 10 de 12, 1 estrella en sus
lecciones y sus palabras a la caja 2; con menos, nada cambia; nunca bloquea nada. Fallar es gris con ✗, sin temblor ni
sonido triste. Las pantallas nuevas caben sin moverse a 360×740 y 390×844, en claro y en oscuro (capturas en
<VOCAB_CAPTURAS>/lecciones)."""
from __future__ import annotations

import json
from collections import Counter

import common as C
import test_f3_leccion as L

OUT = C.CAPTURAS / "lecciones"
_READY = "() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-page')"
_PG = L._CUR_PG
_GO_SHOWN = "() => { const g = document.getElementById('ls-go'); return g && !g.hidden; }"
_FITS = """() => { const g = [...document.querySelectorAll('.ls-stage > .ls-ghost')]; g.forEach(x => { x.style.display = 'none'; });
  const r = {sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight};
  g.forEach(x => { x.style.display = ''; }); return r; }"""
# gris: los tres canales casi iguales
_GREY = """el => { const m = getComputedStyle(el).backgroundColor.match(/[\\d.]+/g).map(Number); return Math.max(m[0], m[1], m[2]) - Math.min(m[0], m[1], m[2]); }"""
# pone en el paso actual un ejercicio de un tipo (spell · fill · match · pick, o pick de una palabra de repaso: rv) y lo
# pinta; para spell y fill, con una palabra que lo admite (y que encaja con la expresión re, si la hay)
_FORCE = """([t, re]) => { const s = vocabLesson.state, V = vocabLesson; let st = null;
  if (t === 'match') { const ws = [], im = new Set();
    for (const w of s.words) if (w.r.img && !/(^|\\/)fam_/.test(w.r.img) && !im.has(w.r.img) && ws.length < 4) { im.add(w.r.img); ws.push(w); }
    if (ws.length === 4) st = {t, ws}; }
  else if (t === 'rv') { if (s.rvw.length) st = {t: 'pick', w: s.rvw[0]}; }
  else { const ok = w => t === 'spell' ? V.spellOf(w) : t === 'fill' ? V.fillOf(w) : true;
    const ws = s.words.filter(w => ok(w) && (!re || new RegExp(re, 'u').test(w.r.l[lang].word))); if (ws.length) st = {t, w: ws[0]}; }
  if (!st) return null; s.steps[s.i] = st; lsStep(0);
  return st.w ? {word: st.w.r.l[lang].word, es: st.w.r.es, ipa: st.w.r.l[lang].ipa || '', k: st.w.k, ex: st.w.r.l[lang].ex || '', ex_es: st.w.r.l[lang].ex_es || ''}
    : {words: st.ws.map(w => w.r.l[lang].word)}; }"""
_PLAN = """() => vocabLesson.state.steps.map(st => ({t: st.t, k: st.w ? st.w.k : null, rv: !!(st.w && st.w.rv), re: !!st.re,
  ks: st.ws ? st.ws.map(w => w.k) : null}))"""
_ENC = """() => vocabLesson.state.steps.map(st => st.t + ':' + (st.w ? st.w.k : st.ws.map(w => w.k).join(',')) + (st.re ? '!' : ''))"""
_SRS = "() => srsAll()"


def _keys(language="english", P=None):
    keys = C.seed_keys()
    if language != "english":
        keys["lang"] = json.dumps(language)
    if P is not None:
        keys["map:english"] = json.dumps(P)
    return keys


def _open(page, lesson, language="english", keys=None):
    C.seed(page, keys=keys or _keys(language))
    C.goto(page, "#/mapa")
    C.goto(page, "#/leccion/" + lesson)
    page.wait_for_function(_READY, timeout=8000)
    page.wait_for_timeout(250)


def _answer(page, ok=True):
    """Contesta la pregunta de ahora (bien o mal) y sigue con «Seguir» (o sola, si se le adelanta)."""
    st = page.evaluate(L._ST)
    L._pick(page, st["right"] if ok else L._wrong(page, st["right"]))
    page.wait_for_function(_GO_SHOWN, timeout=6000)
    if page.evaluate(L._ST)["i"] == st["i"]:
        L._go(page)


def _run(page, miss=lambda st, q: False, check=None, max_steps=160):
    """Juega hasta el final: las palabras nuevas con «Continuar» y cada pregunta bien, salvo si miss(st, q). check(st, q)
    mira la pregunta antes de contestarla. Devuelve las preguntas contestadas ({t, key, rv, ok})."""
    out = []
    for _ in range(max_steps):
        st = page.evaluate(L._ST)
        if not st or st["ended"]:
            return out
        if st["t"] == "learn":
            L._go(page)
            continue
        q = len(out)
        if check:
            check(st, q)
        ok = st["t"] == "match" or not miss(st, q)
        out.append({"t": st["t"], "key": st["key"], "rv": st["rv"], "ok": ok})
        _answer(page, ok)
    raise AssertionError(f"la lección no termina en {max_steps} pasos: {page.evaluate(L._ST)}")


def _fit(page, label, name, probs, w, h, scheme, vertical=True):
    m = page.evaluate(_FITS)
    if m["sw"] > m["iw"]:
        probs.append(f"{label}: {name} se sale de lado ({m['sw']} > {m['iw']})")
    if vertical and m["sh"] > m["ih"] + 1:
        probs.append(f"{label}: {name} no cabe en la pantalla ({m['sh']} > {m['ih']})")
    C.shot(page, f"{name}-{w}-{scheme}", OUT, full_page=False)


# ---------------------------------------------------------------- cada palabra por su sitio
# las opciones a la vista: ninguna mala dice lo mismo que la buena (la misma palabra del idioma o el mismo español)
_TWO_RIGHT = """() => { const s = vocabLesson.state, st = s.steps[s.i], N = t => String(t || '').normalize('NFC').toLowerCase().trim();
  if (!st || !['pick', 'listen'].includes(st.t)) return [];
  const all = [...s.words, ...(s.pool || []), ...(s.more || []), ...(st.w.pool || [])], f = st.t === 'listen' ? (x => x.r.es) : (x => x.r.l[lang].word);
  const W0 = N(st.w.r.l[lang].word), E0 = N(st.w.r.es), bad = [];
  for (const e of document.querySelectorAll('.ls-stage > .ls-page:not(.ls-ghost) .ls-opt .ls-ot')) { const v = e.textContent; if (v === st.right) continue;
    for (const x of all) if (x && x.r && x.r.l && x.r.l[lang] && N(f(x)) === N(v) && (N(x.r.l[lang].word) === W0 || N(x.r.es) === E0)) { bad.push(st.w.r.l[lang].word + ' → ' + v); break; } }
  return bad; }"""
_WORDS = "() => vocabLesson.state.words.map(w => ({k: w.k, w: w.r.l[lang].word}))"
_DISTINCT = """async id => { await getMap(); const l = MAP[id.slice(0, 2)].flatMap(u => u.ls).find(l => l.id === id), out = new Set();
  for (const [d, i] of l.w) { const r = (await getDoc(d)).rows[i]; if (r && r.l && r.l[lang] && r.l[lang].word) out.add(r.l[lang].word.normalize('NFC').toLowerCase().trim()); }
  return out.size; }"""


def test_words_by_place_and_never_two_right_answers():
    """Las palabras de la lección van por su sitio (tema:fila, sin repetir) y la que repite la palabra del idioma de otra
    no se enseña dos veces: «cousin» (Primo/Prima) en A1-010, «la maison» en A1-032 en francés, «et barnebarn» en
    A1-010 en danés. En ninguna pregunta hay dos opciones buenas (A1-010 y A1-057 con «phone» y «telephone», jugadas
    enteras); todo bien da 3 estrellas y no ofrece «Repasa tus fallos»."""
    probs = []
    for lesson, language, word in (("A1-010", "english", "cousin"), ("A1-057", "english", None), ("A1-032", "français", "la maison"),
                                   ("A1-010", "dansk", "et barnebarn")):
        label = f"{lesson} ({language})"
        page = C.new_page("phone")
        try:
            _open(page, lesson, language)
            ws = page.evaluate(_WORDS)
            keys = [w["k"] for w in ws]
            n = page.evaluate(_DISTINCT, lesson)
            if len(set(keys)) != len(keys) or len(ws) != n:
                probs.append(f"{label}: {len(ws)} palabras ({len(set(keys))} sitios distintos), {n} palabras distintas en el idioma")
            if word:
                learn = Counter(page.evaluate("() => vocabLesson.state.steps.filter(st => st.t === 'learn').map(st => st.w.r.l[lang].word)"))
                if [w["w"] for w in ws].count(word) != 1 or learn[word] != 1:
                    probs.append(f"{label}: «{word}» sale {[w['w'] for w in ws].count(word)} veces (se enseña {learn[word]})")
            if language == "english":
                seen = []
                _run(page, check=lambda st, q: seen.extend(page.evaluate(_TWO_RIGHT)))
                if seen:
                    probs.append(f"{label}: preguntas con dos respuestas buenas: {seen}")
                page.wait_for_selector(".ls-end", timeout=6000)
                page.wait_for_timeout(900)
                end = page.evaluate("() => ({stars: document.querySelectorAll('.ls-star.got').length, fix: !!document.getElementById('ls-fix')})")
                if end["stars"] != 3 or end["fix"]:
                    probs.append(f"{label}: todo bien y el final es {end}")
            probs += [f"{label}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- aprender y preguntar mezclados, con repaso
def test_learn_ask_mix_review_words_and_fix_round():
    """El plan: aprende 3 → pregunta esas 3 → aprende las siguientes → … (trozos de 3 como mucho; cada pregunta, de una
    ya aprendida; cada palabra se pregunta 2 veces con 3 pasos o más entre medias, la segunda recordando si se puede),
    con 2 o 3 palabras del repaso (caja ≤ 2, con la etiqueta «Repaso») desde la segunda vuelta. Fallar la primera
    pregunta y la primera de repaso: la de la lección vuelve 3 a 5 pasos después y va a la caja 0 (hoy); la de repaso no
    vuelve a salir (es del repaso) y se califica como en el repaso (caja 0, hoy); la otra de repaso acertada sube una
    caja. El final ofrece «Repasa tus fallos», que pregunta solo esas dos y acaba en «¡Fallos repasados!» sin estrellas
    ni monedas ni tocar el repaso."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page, L.LESSON)
        page.evaluate(L._HOOK)
        plan, ws = page.evaluate(_PLAN), [w["k"] for w in page.evaluate(_WORDS)]
        # el orden
        if [p["t"] for p in plan[:3]] != ["learn"] * 3 or [p["k"] for p in plan[:3]] != ws[:3]:
            probs.append(f"no empieza aprendiendo las 3 primeras: {plan[:4]}")
        if {p["t"] for p in plan[3:6]} - {"pick", "listen"} or sorted(p["k"] for p in plan[3:6]) != sorted(ws[:3]):
            probs.append(f"después no pregunta esas 3: {plan[3:7]}")
        learnt, bad = set(), []
        for j, p in enumerate(plan):
            if p["t"] == "learn":
                learnt.add(p["k"])
            elif not p["rv"] and any(k not in learnt for k in (p["ks"] or [p["k"]])):
                bad.append(j)
        if bad:
            probs.append(f"preguntas de palabras aún no aprendidas en los pasos {bad}")
        if Counter(p["k"] for p in plan if p["t"] == "learn") != Counter(ws):
            probs.append("no se aprende cada palabra una vez")
        if plan[6]["t"] != "learn":
            probs.append(f"tras las 3 primeras preguntas no vuelve a aprender: {plan[6]}")
        # trozos de 3 como mucho; cada palabra se pregunta 2 veces con 3 pasos o más entre medias, y la segunda, si se
        # puede, recordando («Ordena las letras» o «Completa la frase»)
        runs, run = [], 0
        for p in plan + [{"t": None}]:
            if p["t"] == "learn":
                run += 1
            elif run:
                runs.append(run)
                run = 0
        if max(runs) > 3 or min(runs) < 2 or sum(runs) != len(ws):
            probs.append(f"trozos de palabras nuevas: {runs}")
        recall = dict(zip(ws, page.evaluate("() => vocabLesson.state.words.map(w => !!(vocabLesson.spellOf(w) || vocabLesson.fillOf(w)))")))
        for k in ws:
            at = [(j, p["t"]) for j, p in enumerate(plan) if p["k"] == k and p["t"] not in ("learn", "match") and not p["rv"]]
            if len(at) != 2 or at[1][0] - at[0][0] - 1 < 3:
                probs.append(f"{k} se pregunta en {at} (2 veces con 3 pasos o más entre medias)")
            elif at[0][1] not in ("pick", "listen") or (recall[k] and at[1][1] not in ("spell", "fill")):
                probs.append(f"{k}: primero {at[0][1]} y luego {at[1][1]} (se puede recordar: {recall[k]})")
        rv = [j for j, p in enumerate(plan) if p["rv"]]
        if not 2 <= len(rv) <= 3 or any(plan[j]["t"] != "pick" for j in rv) or min(rv or [0]) < 6:
            probs.append(f"las de repaso: pasos {rv} ({[plan[j] for j in rv]})")
        rvw = page.evaluate("() => vocabLesson.state.rvw.map(w => ({k: srsK(w.doc, w.r), key: w.k}))")
        srs0, t0, iv = page.evaluate(_SRS), page.evaluate("today()"), page.evaluate("IV")
        if any(srs0.get(r["k"], {}).get("b", 9) > 2 for r in rvw):
            probs.append(f"una de repaso no es de las cajas 0-2: {[(r['k'], srs0.get(r['k'])) for r in rvw]}")
        tags = []

        def check(st, q):
            if st["rv"]:
                tags.append(page.evaluate(f"() => {{ const t = document.querySelector('{_PG} .ls-rvt'); return t ? t.textContent.trim() : null; }}"))
        n0 = len(plan)
        miss_rv = rvw[0]["key"] if rvw else None
        done = _run(page, miss=lambda st, q: q == 0 or (st["rv"] and st["key"] == miss_rv), check=check)
        if any(t != "Repaso" for t in tags) or len(tags) != len(rvw):
            probs.append(f"la etiqueta «Repaso»: {tags}")
        x = done[0]["key"]
        # las de repaso no vuelven: solo la fallada de la lección se repite, 3 a 5 pasos después (o justo tras las
        # palabras nuevas, si caía entre ellas) y nunca entre dos palabras nuevas
        fin = page.evaluate(_PLAN)
        if len(fin) != n0 + 1:
            probs.append(f"pasos: {n0} → {len(fin)} (se esperaba una repetición, la de la lección)")
        else:
            p0 = next(j for j, p in enumerate(fin) if p["k"] == x and p["t"] != "learn")
            r = next(j for j, p in enumerate(fin) if p["re"])
            g = r - p0 - 1
            if fin[r]["k"] != x or g < 3 or (g > 5 and fin[r - 1]["t"] != "learn") or (fin[r - 1]["t"] == "learn" and r + 1 < len(fin) and fin[r + 1]["t"] == "learn"):
                probs.append(f"la fallada {x} (paso {p0}) vuelve en el paso {r} ({fin[r - 1]['t']} antes, {g} pasos entre medias)")
        page.wait_for_selector(".ls-end", timeout=6000)
        page.wait_for_timeout(900)
        srs1 = page.evaluate(_SRS)
        xk = page.evaluate("k => { const w = vocabLesson.state.words.find(w => w.k === k); return srsK(w.doc, w.r); }", x)
        if xk not in srs0 and (srs1.get(xk, {}).get("b") != 0 or srs1[xk].get("due") != t0):
            probs.append(f"la fallada {xk}: {srs1.get(xk)} (se esperaba la caja 0, hoy)")
        for j, r in enumerate(rvw):
            b0, x1 = srs0.get(r["k"], {}), srs1.get(r["k"], {})
            b1 = 0 if j == 0 else min(len(iv) - 1, b0.get("b", 0) + 1)
            due = t0 if j == 0 else t0 + iv[b1]
            if x1.get("b") != b1 or x1.get("due") != due or x1.get("n") != b0.get("n", 0) + 1:
                probs.append(f"repaso {r['k']} ({'fallada' if j == 0 else 'acertada'}): {b0} → {x1} (se esperaba caja {b1}, día {due})")
        fixb = page.evaluate("() => { const b = document.getElementById('ls-fix'); return b ? b.textContent.trim() : null; }")
        if fixb != "Repasa tus fallos":
            probs.append(f"con fallos el final no ofrece «Repasa tus fallos»: {fixb!r}")
        _fit(page, "final", "final-con-fallos", probs, 390, 844, "light")
        # «Repasa tus fallos»: solo las dos falladas, sin estrellas, monedas ni repaso
        base = C.export(page)
        page.locator("#ls-fix").click()
        page.wait_for_function("() => vocabLesson.state && vocabLesson.state.fix && document.querySelector('.ls-stage .ls-page')", timeout=5000)
        page.wait_for_timeout(300)
        fx = page.evaluate("() => vocabLesson.state.steps.map(st => [st.t, st.w.k])")
        if sorted(k for _, k in fx) != sorted([x] + ([miss_rv] if miss_rv else [])) or {t for t, _ in fx} - {"pick", "listen"}:
            probs.append(f"«Repasa tus fallos» pregunta {fx} (se esperaban {x} y {miss_rv})")
        _fit(page, "repasa tus fallos", "fallos-pregunta", probs, 390, 844, "light")
        aw0 = len(page.evaluate("__t.aw"))
        _run(page)
        page.wait_for_selector(".ls-fixend", timeout=6000)
        page.wait_for_timeout(900)
        fe = page.evaluate("""() => ({t: document.querySelector('.ls-end-t').textContent, s: document.querySelector('.ls-end-s').textContent,
          stars: document.querySelectorAll('.ls-fixend .ls-star').length, coins: !!document.querySelector('.ls-fixend #ls-plus'),
          next: !!document.getElementById('ls-next'), rep: !!document.getElementById('ls-rep')})""")
        n_fix = len(fx)
        if fe["t"] != "¡Fallos repasados!" or fe["stars"] or fe["coins"] or not fe["next"] or not fe["rep"] or str(n_fix) not in fe["s"]:
            probs.append(f"final de «Repasa tus fallos»: {fe}")
        if len(page.evaluate("__t.aw")) != aw0:
            probs.append("«Repasa tus fallos» da monedas")
        d = C.diff_exports(base, C.export(page), allow_new=False)
        d = [x for x in d if "act" not in x.split(":")[0]]
        if d:
            probs.append("«Repasa tus fallos» cambia la partida:\n  " + "\n  ".join(d))
        _fit(page, "final de fallos", "fallos-final", probs, 390, 844, "light")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- fallar: la respuesta enseguida y vuelve luego
def test_missed_word_shows_the_answer_and_comes_back():
    """Fallar «¿Cuál es…?» o «Escucha y elige» enseña enseguida la respuesta (dibujo, la buena en verde, la palabra con su
    IPA y suena) y la palabra vuelve 3 a 5 pasos después, nunca entre dos palabras nuevas."""
    probs = []
    page = C.new_page("phone", viewport={"width": 360, "height": 740})
    try:
        _open(page, "A1-002")
        page.evaluate(L._HOOK)
        page.evaluate(L._FAKE_AUDIO)
        for t in ("listen", "pick"):
            f = page.evaluate(_FORCE, [t, None])
            page.wait_for_timeout(350)
            i0, n0 = page.evaluate("[vocabLesson.state.i, vocabLesson.state.steps.length]")
            st = page.evaluate(L._ST)
            n_aud, plan0 = page.evaluate("__t.audio.length"), page.evaluate(_PLAN)
            L._pick(page, L._wrong(page, st["right"]))
            page.wait_for_function(_GO_SHOWN, timeout=4000)
            page.wait_for_timeout(500)
            r = page.evaluate(f"""n => {{ const p = document.querySelector('{_PG}'), w = p.querySelector('.ls-fb-w b'), ok = p.querySelector('.ls-opt.is-ok');
              return {{ok: ok ? ok.querySelector('.ls-ot').textContent : null, w: w ? w.textContent : null, ipa: !!p.querySelector('.ls-fb .ipa'),
                pic: !!p.querySelector('.ls-pic img, .ls-opt.is-ok img'), said: __t.audio.slice(n).map(x => x.t)}}; }}""", n_aud)
            if r["ok"] != st["right"] or not r["ipa"] or f["word"] not in r["said"] or (t == "listen" and r["w"] != f["word"]) or (t == "pick" and not r["pic"]):
                probs.append(f"{t} fallada: {r} (la palabra {f['word']!r})")
            _fit(page, t, f"fallo-{t}", probs, 360, 740, "light", vertical=False)
            # el paso nuevo: donde el plan deja de ser el de antes
            plan = page.evaluate(_PLAN)
            r = next((j for j, p in enumerate(plan) if j >= len(plan0) or p != plan0[j]), None)
            if r is not None and not (plan[r]["re"] and plan[r]["k"] == f["k"]):
                r = None
            if len(plan) != n0 + 1 or r is None or not 3 <= r - i0 - 1 <= 5 and plan[r - 1]["t"] != "learn":
                probs.append(f"{t} fallada en el paso {i0}: vuelve en {r} ({len(plan)} pasos, antes {n0})")
            elif plan[r - 1]["t"] == "learn" and r + 1 < len(plan) and plan[r + 1]["t"] == "learn":
                probs.append(f"{t} fallada: vuelve entre dos palabras nuevas (paso {r})")
            L._go(page)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- recargar: el mismo plan
def test_reload_keeps_the_same_plan_and_honest_bar():
    """Recargar a mitad sigue con el mismo plan (los mismos ejercicios de las mismas palabras, las de repaso y la
    repetición de la fallada), en el mismo paso; la barra cuenta los pasos de verdad (hechos de todos, con la
    repetición)."""
    probs = []
    page = C.new_page("phone")
    bar = "() => { const b = document.querySelector('.ls .ls-bar'); return [+b.getAttribute('aria-valuenow'), +b.getAttribute('aria-valuemax')]; }"
    try:
        _open(page, L.LESSON)
        for _ in range(3):
            L._go(page)
        _answer(page, ok=False)
        _answer(page, ok=True)
        before, st0 = page.evaluate(_ENC), page.evaluate(L._ST)
        rv0 = page.evaluate("() => vocabLesson.state.rvw.map(w => w.k)")
        re = [j for j, e in enumerate(before) if e.endswith("!")]
        if page.evaluate(bar) != [st0["i"], st0["n"]] or len(re) != 1:
            probs.append(f"la barra {page.evaluate(bar)} en el paso {st0['i']} de {st0['n']} (repeticiones en {re})")
        C.reload(page)
        page.wait_for_function(_READY, timeout=8000)
        page.wait_for_timeout(300)
        after, st1 = page.evaluate(_ENC), page.evaluate(L._ST)
        if after != before or st1["i"] != st0["i"] or page.evaluate("() => vocabLesson.state.rvw.map(w => w.k)") != rv0:
            probs.append(f"tras recargar el plan cambia:\n  antes {before}\n  ahora {after} (paso {st0['i']} → {st1['i']})")
        if page.evaluate(bar) != [st1["i"], st1["n"]]:
            probs.append(f"tras recargar la barra {page.evaluate(bar)} (paso {st1['i']} de {st1['n']})")
        # y se puede terminar
        _run(page)
        page.wait_for_selector(".ls-end", timeout=6000)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- «Ordena las letras»
_SPELL = f"""() => {{ const p = document.querySelector('{_PG}'), a = p.querySelector('.ls-sp-a'), ts = [...p.querySelectorAll('.ls-tile')];
  return {{tag: (p.querySelector('.ls-tag') || {{}}).textContent, art: a ? a.textContent : '', slots: p.querySelectorAll('.ls-slot').length,
    tiles: ts.map(t => t.dataset.ch), langs: [...new Set(ts.map(t => t.getAttribute('lang')))], min: Math.min(...ts.map(t => Math.min(t.offsetWidth, t.offsetHeight))),
    group: (p.querySelector('.ls-tiles') || {{}}).getAttribute && p.querySelector('.ls-tiles').getAttribute('aria-label')}}; }}"""


def _spell_case(page, label, want_art, probs):
    sp = page.evaluate("() => { const st = vocabLesson.state.steps[vocabLesson.state.i]; return st.sp ? {art: st.sp.art, base: st.sp.base, L: st.sp.L} : null; }")
    look = page.evaluate(_SPELL)
    if look["tag"] != "Ordena las letras" or look["art"] != want_art or look["slots"] != len(sp["L"]):
        probs.append(f"{label}: {look} (palabra {sp})")
    extra = Counter(look["tiles"]) - Counter(sp["L"])
    if Counter(sp["L"]) - Counter(look["tiles"]) or not 1 <= sum(extra.values()) <= 2 or sum(extra.values()) != (2 if len(sp["L"]) <= 5 else 1):
        probs.append(f"{label}: fichas {look['tiles']} para {sp['L']} (de sobra {dict(extra)})")
    if any(c.lower() in [x.lower() for x in sp["L"]] for c in extra):
        probs.append(f"{label}: una ficha de sobra está en la palabra: {dict(extra)}")
    if "".join(look["tiles"][:len(sp["L"])]) == sp["base"]:
        probs.append(f"{label}: las fichas salen en el orden bueno")
    if look["min"] < 44 or look["group"] != "Letras" or len(look["langs"]) != 1 or not look["langs"][0]:
        probs.append(f"{label}: fichas de {look['min']} px, grupo {look['group']!r}, lang {look['langs']}")
    return sp


def test_spell_letters_with_article_accents_and_keyboard():
    """«Ordena las letras»: el artículo ya puesto («la», «en», «et») y solo se ordena la palabra; fichas con todas sus
    letras (acentos y æøå incluidos), 1 o 2 de sobra que no están en ella, nunca en orden, de 44 px o más y con su
    idioma. Una ficha que no va: gris con ✗ un momento, sin temblor, sin vibrar y sin sonido triste. Con 0 o 1 fallos es
    un acierto (pasa sola; ✓ y la IPA); con 2, la siguiente ficha se marca y cuenta como fallada («¡Casi! Se escribe
    «la fenêtre»»). Con el teclado, cada letra toca su ficha (también ø)."""
    probs = []
    # inglés: una mal y el resto con el teclado
    page = C.new_page("phone")
    try:
        _open(page, L.LESSON)
        page.evaluate(L._HOOK)
        f = page.evaluate(_FORCE, ["spell", "^uncle$"]) or page.evaluate(_FORCE, ["spell", None])
        page.wait_for_timeout(350)
        sp = _spell_case(page, "inglés", "", probs)
        _fit(page, "inglés", "letras", probs, 390, 844, "light")
        tiles = page.evaluate(L._TILES)
        wrong = next(t for t in tiles if t["ch"].lower() != sp["L"][0].lower())
        page.locator(f"{_PG} .ls-tile").nth(wrong["k"]).click()
        page.wait_for_timeout(120)
        mk = page.evaluate(f"""() => {{ const b = document.querySelectorAll('{_PG} .ls-tile')[{wrong['k']}]; return {{miss: b.classList.contains('is-miss'), x: !!b.querySelector('.xm'), grey: ({_GREY})(b)}}; }}""")
        if not mk["miss"] or not mk["x"] or mk["grey"] > 24:
            probs.append(f"inglés: la ficha que no va {mk}")
        T = page.evaluate("__t")
        if T["nope"] or T["hap"] or "bad" in T["snd"] or T["ans"]:
            probs.append(f"inglés: al tocar una que no va: temblor {T['nope']}, vibración {T['hap']}, sonidos {T['snd']}, respuestas {T['ans']}")
        page.wait_for_timeout(700)
        for ch in sp["base"]:
            page.keyboard.press(ch)
            page.wait_for_timeout(40)
        page.wait_for_timeout(250)
        done = page.evaluate(f"""() => {{ const p = document.querySelector('{_PG}'); return {{done: !!p.querySelector('.ls-sp.is-done'), slots: [...p.querySelectorAll('.ls-slot')].map(s => s.textContent).join(''),
          fb: p.querySelector('.ls-fb').textContent, ipa: !!p.querySelector('.ls-fb .ipa'), tray: p.querySelector('.ls-tiles').hidden}}; }}""")
        T = page.evaluate("__t")
        if not done["done"] or done["slots"] != sp["base"] or not done["tray"] or "¡Casi!" in done["fb"] or (bool(f["ipa"]) and not done["ipa"]):
            probs.append(f"inglés: escrita con el teclado {done}")
        if [a["ok"] for a in T["ans"]] != [True] or T["hap"].count("success") != 1:
            probs.append(f"inglés: con 1 fallo no cuenta como acierto: {T['ans']} {T['hap']}")
        _fit(page, "inglés", "letras-bien", probs, 390, 844, "light")
        probs += [f"inglés: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    # francés: el artículo puesto, acentos, y 2 fallos = fallada
    page = C.new_page("phone", viewport={"width": 360, "height": 740}, color_scheme="dark")
    try:
        _open(page, "A1-032", "français")
        page.evaluate(L._HOOK)
        f = page.evaluate(_FORCE, ["spell", "fenêtre"]) or page.evaluate(_FORCE, ["spell", "^l[ae] "])
        page.wait_for_timeout(350)
        sp = _spell_case(page, "francés", f["word"].split(" ")[0] if " " in f["word"] else "", probs)
        if "fenêtre" in f["word"] and "ê" not in page.evaluate(_SPELL)["tiles"]:
            probs.append("francés: falta la ficha «ê»")
        _fit(page, "francés", "letras-fr", probs, 360, 740, "dark")
        L._spell(page, ok=False)
        page.wait_for_timeout(300)
        r = page.evaluate(f"""() => {{ const p = document.querySelector('{_PG}'), s = vocabLesson.state, st = s.steps[s.i];
          return {{fb: p.querySelector('.ls-fb').textContent, ipa: !!p.querySelector('.ls-fb .ipa'), miss: s.miss.has(st.w.k), go: document.getElementById('ls-go').textContent}}; }}""")
        if not r["fb"].startswith(f"¡Casi! Se escribe «{f['word'].split(' (')[0]}»") or not r["miss"] or r["go"] != "Seguir" or (bool(f["ipa"]) and not r["ipa"]):
            probs.append(f"francés: con 2 fallos {r}")
        T = page.evaluate("__t")
        if [a["ok"] for a in T["ans"]] != [False] or T["nope"] or "bad" in T["snd"] or T["hap"]:
            probs.append(f"francés: 2 fallos: respuestas {T['ans']}, temblor {T['nope']}, sonidos {T['snd']}, vibración {T['hap']}")
        _fit(page, "francés", "letras-fr-fallo", probs, 360, 740, "dark", vertical=False)
        probs += [f"francés: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    # danés: «en»/«et» puesto y las letras æøå con el teclado
    page = C.new_page("phone", viewport={"width": 360, "height": 740})
    try:
        _open(page, "A1-002", "dansk")
        f = page.evaluate(_FORCE, ["spell", "[æøå]"])
        if not f:
            probs.append("danés: ninguna palabra con æøå para ordenar en A1-002")
        else:
            page.wait_for_timeout(350)
            sp = _spell_case(page, "danés", f["word"].split(" ")[0], probs)
            _fit(page, "danés", "letras-da", probs, 360, 740, "light")
            for ch in sp["base"]:
                page.evaluate("k => document.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true}))", ch)
                page.wait_for_timeout(40)
            page.wait_for_timeout(250)
            if not page.evaluate(f"() => !!document.querySelector('{_PG} .ls-sp.is-done')"):
                probs.append(f"danés: con el teclado no se escribe «{sp['base']}»: {page.evaluate(L._TILES)}")
        probs += [f"danés: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- «Completa la frase»
_FILL_ALL = """() => { const s = vocabLesson.state, N = t => String(t).normalize('NFC').toLowerCase().replace(/’/g, "'"), out = [];
  for (const w of s.words) { const f = vocabLesson.fillOf(w); if (!f) continue;
    const at = f.ex.slice(f.at, f.at + f.len), pre = f.ex.slice(0, f.at).slice(-1), post = f.ex.slice(f.at + f.len).slice(0, 1);
    if (N(at) !== N(f.right) || /[\\p{L}\\p{N}]/u.test(pre) || /[\\p{L}\\p{N}]/u.test(post)) out.push([w.r.l[lang].word, f.ex, f.right]);
    if (f.alt.some(a => N(a.v) === N(f.right))) out.push([w.r.l[lang].word, 'otra opción igual a la buena', f.alt.map(a => a.v)]); }
  return {bad: out, n: s.words.filter(w => vocabLesson.fillOf(w)).length}; }"""


def test_fill_the_sentence_only_when_the_word_is_there():
    """«Completa la frase»: el hueco solo donde la palabra (o su forma sin artículo) sale de verdad en su ejemplo, como
    palabra suelta; 3 opciones con la buena y su idioma. Al acertar, el hueco se llena, suena la frase entera (sayP) y
    sale su español."""
    probs = []
    for lesson, language, scheme, (w, h) in (("A1-002", "english", "light", (390, 844)), ("A1-032", "français", "dark", (360, 740))):
        label = f"{lesson} ({language})"
        page = C.new_page("phone", viewport={"width": w, "height": h}, color_scheme=scheme)
        try:
            _open(page, lesson, language)
            fa = page.evaluate(_FILL_ALL)
            if fa["bad"] or not fa["n"]:
                probs.append(f"{label}: huecos que no son la palabra: {fa}")
            page.evaluate(L._HOOK)
            page.evaluate(L._FAKE_AUDIO)
            f = page.evaluate(_FORCE, ["fill", None])
            page.wait_for_timeout(350)
            g = page.evaluate(f"""() => {{ const p = document.querySelector('{_PG}'), st = vocabLesson.state.steps[vocabLesson.state.i], s = p.querySelector('.ls-sent');
              return {{tag: p.querySelector('.ls-tag').textContent, sent: s.textContent, lang: s.getAttribute('lang'), f: st.f,
                opts: [...p.querySelectorAll('.ls-opt')].map(o => [o.querySelector('.ls-ot').textContent, o.getAttribute('lang')])}}; }}""")
            ff = g["f"]
            if g["tag"] != "Completa la frase" or g["sent"] != ff["ex"][:ff["at"]] + "____" + ff["ex"][ff["at"] + ff["len"]:] or not g["lang"]:
                probs.append(f"{label}: la frase {g['sent']!r} ({ff})")
            texts = [o[0] for o in g["opts"]]
            if len(texts) != 3 or ff["right"] not in texts or len(set(texts)) != 3 or any(o[1] != g["lang"] for o in g["opts"]):
                probs.append(f"{label}: opciones {g['opts']}")
            _fit(page, label, f"frase-{language[:2]}", probs, w, h, scheme)
            n_aud = page.evaluate("__t.audio.length")
            L._pick(page, ff["right"])
            page.wait_for_timeout(700)
            a = page.evaluate(f"""n => {{ const p = document.querySelector('{_PG}'), es = p.querySelector('.ls-fb small[lang=es]');
              return {{gap: p.querySelector('.ls-gap').textContent, es: es ? es.textContent : null, said: __t.audio.slice(n).map(x => x.t)}}; }}""", n_aud)
            if a["gap"] != ff["ex"][ff["at"]:ff["at"] + ff["len"]] or ff["ex"] not in a["said"] or (f["ex_es"] and a["es"] != f["ex_es"]):
                probs.append(f"{label}: tras acertar {a} (frase {ff['ex']!r}, en español {f['ex_es']!r})")
            _fit(page, label, f"frase-{language[:2]}-bien", probs, w, h, scheme, vertical=False)
            probs += [f"{label}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- «Empareja»
_MC = f"""() => [...document.querySelectorAll('{_PG} .ls-mc')].map(b => ({{side: b.dataset.side, m: b.dataset.m, ok: b.classList.contains('is-ok'),
  miss: b.classList.contains('is-miss'), x: !!b.querySelector('.xm'), img: !!b.querySelector('img'), label: b.getAttribute('aria-label'),
  lang: b.getAttribute('lang'), pressed: b.getAttribute('aria-pressed'), h: Math.round(b.getBoundingClientRect().height), dis: b.disabled,
  ipa: !!b.querySelector('.ipa')}}))"""


def test_match_four_pictures_with_their_words():
    """«Empareja»: 4 dibujos (con su nombre para el lector) y sus 4 palabras (con su idioma), de 64 px o más. Tocar uno
    lo marca (aria-pressed). Una pareja que no va: las dos en gris con ✗ un momento, sin temblor ni sonido ni contar
    como fallo. Las buenas en verde con ✓ y la IPA bajo la palabra; con la última, «Seguir», vibración de éxito y pasa
    sola."""
    probs = []
    page = C.new_page("phone", viewport={"width": 360, "height": 740})
    try:
        _open(page, "A1-002")
        page.evaluate(L._HOOK)
        page.evaluate(L._FAKE_AUDIO)
        f = page.evaluate(_FORCE, ["match", None])
        if not f:
            raise AssertionError("A1-002 no tiene 4 palabras con dibujo")
        page.wait_for_timeout(400)
        mc = page.evaluate(_MC)
        ps, ws = [b for b in mc if b["side"] == "p"], [b for b in mc if b["side"] == "w"]
        if len(ps) != 4 or len(ws) != 4 or not all(b["img"] and b["label"] for b in ps) or not all(b["lang"] == "en-GB" for b in ws):
            probs.append(f"las parejas: {mc}")
        if min(b["h"] for b in mc) < 64:
            probs.append(f"botones bajos: {[b['h'] for b in mc]}")
        _fit(page, "empareja", "empareja", probs, 360, 740, "light")
        cell = lambda side, m: page.locator(f"{_PG} .ls-mc[data-side='{side}'][data-m='{m}']")  # noqa: E731
        cell("p", 0).click()
        if page.evaluate(f"() => document.querySelector(\"{_PG} .ls-mc[data-side='p'][data-m='0']\").getAttribute('aria-pressed')") != "true":
            probs.append("el dibujo tocado no queda marcado (aria-pressed)")
        cell("w", 1).click()
        page.wait_for_timeout(120)
        mc = page.evaluate(_MC)
        two = [b for b in mc if (b["side"], b["m"]) in (("p", "0"), ("w", "1"))]
        grey = page.evaluate(f"""() => [...document.querySelectorAll('{_PG} .ls-mc.is-miss')].map(b => ({_GREY})(b))""")
        if not all(b["miss"] and b["x"] for b in two) or any(g > 24 for g in grey):
            probs.append(f"la pareja que no va: {two} (gris {grey})")
        _fit(page, "empareja", "empareja-no-va", probs, 360, 740, "light", vertical=False)
        T = page.evaluate("__t")
        if T["nope"] or T["ans"] or T["hap"] or "bad" in T["snd"]:
            probs.append(f"pareja que no va: temblor {T['nope']}, respuestas {T['ans']}, vibración {T['hap']}, sonidos {T['snd']}")
        page.wait_for_timeout(760)
        if any(b["miss"] or b["x"] for b in page.evaluate(_MC)):
            probs.append("la ✗ no se va")
        i0 = page.evaluate("vocabLesson.state.i")
        for m in range(4):
            cell("p", m).click()
            cell("w", m).click()
            page.wait_for_timeout(60)
        page.wait_for_timeout(250)
        mc = page.evaluate(_MC)
        T = page.evaluate("__t")
        if not all(b["ok"] and b["dis"] for b in mc) or not any(b["ipa"] for b in mc if b["side"] == "w"):
            probs.append(f"hechas las 4: {mc}")
        if [a["ok"] for a in T["ans"]] != [True] * 4 or T["hap"].count("success") != 1 or T["nope"]:
            probs.append(f"hechas las 4: respuestas {T['ans']}, vibración {T['hap']}")
        if page.evaluate("() => document.getElementById('ls-go').textContent") != "Seguir":
            probs.append("al terminar no sale «Seguir»")
        _fit(page, "empareja", "empareja-bien", probs, 360, 740, "light", vertical=False)
        L._wait_change(page, i0, 6000)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- los números sin dibujo
def test_numbers_without_picture_show_the_whole_number():
    """Sin dibujo, una tarjeta de número enseña el número entero («71», no «7»), en la palabra nueva y en «¿Cuál es…?»."""
    probs = []
    page = C.new_page("phone", viewport={"width": 360, "height": 740})
    try:
        _open(page, "A1-019")
        ph = page.evaluate(f"""() => {{ const p = document.querySelector('{_PG}'), x = p.querySelector('.ls-ph'), st = vocabLesson.state.steps[vocabLesson.state.i];
          return {{ph: x ? x.textContent : null, es: st.w.r.es, img: !!st.w.r.img}}; }}""")
        if not ph["img"] and ph["ph"] != ph["es"]:
            probs.append(f"la palabra nueva {ph}")
        C.shot(page, "numero-360-light", OUT, full_page=False)
        page.evaluate(_FORCE, ["pick", None])
        page.wait_for_timeout(350)
        q = page.evaluate(f"""() => {{ const p = document.querySelector('{_PG}'), x = p.querySelector('.ls-ph'); return {{ph: x ? x.textContent : null, es: vocabLesson.state.steps[vocabLesson.state.i].w.r.es}}; }}""")
        if q["ph"] != q["es"]:
            probs.append(f"«¿Cuál es…?» de un número: {q}")
        _fit(page, "números", "numero-pregunta", probs, 360, 740, "light")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- «¿Ya lo sabes?»
_UNITS = """async lv => { await getMap(); const P = mapP(), us = lvUnits(lv), out = []; let k = 0;
  us.forEach((u, ui) => { out.push({ui: ui + 1, first: k, ids: u.ls.map(l => l.id), voc: u.ls.filter(l => l.w && l.w.length).map(l => l.id)}); k += u.ls.length; });
  return {cur: lvCur(lv, P), units: out, all: lvLessons(lv).map(l => l.id)}; }"""
_UNIT_SRS = """async ids => { await getMap(); const out = []; for (const id of ids) { const l = MAP[id.slice(0, 2)].flatMap(u => u.ls).find(l => l.id === id);
  for (const [d, i] of l.w) { const r = (await getDoc(d)).rows[i]; if (r && r.l && r.l[lang] && r.l[lang].word) out.push(srsK(d, r)); } } return [...new Set(out)]; }"""


def _unit_keys(page):
    """La partida sembrada con todo hecho hasta el principio de la siguiente unidad (la que toca ahora)."""
    info = page.evaluate(_UNITS, "A1")
    u = next(x for x in info["units"] if x["first"] >= info["cur"] and x["voc"])
    keys = C.seed_keys()
    P = json.loads(keys["map:english"])
    for lid in info["all"][:u["first"]]:
        P.setdefault(lid, 2)
    keys["map:english"] = json.dumps(P)
    return keys, u


def _quiz(page, n_right):
    q = 0
    for _ in range(20):
        st = page.evaluate(L._ST)
        if not st or st["ended"]:
            break
        if not page.evaluate(f"() => !!document.querySelector('{_PG} .ls-uttag')"):
            raise AssertionError(f"pregunta {q} sin la etiqueta «¿Ya lo sabes?»")
        _answer(page, ok=q < n_right)
        q += 1
    return q


def test_unit_quiz_optional_one_star_and_box_two():
    """«¿Ya lo sabes?» sale bajo la cabecera de la unidad solo al empezarla (la siguiente lección es su primera y no hay
    ninguna hecha) y si ya hizo alguna lección; nunca a un niño nuevo ni a mitad de unidad. Son 12 preguntas
    (dibujo → palabra), sin repetir las falladas. Con 10 o más: 1 estrella (no 3) en cada lección de vocabulario de la
    unidad, sus palabras al repaso en la caja 2 (las nuevas, en 3 días) y unas pocas monedas; «Siguiente lección». Con
    menos: «¡Buen intento!» y la partida no cambia; «Empezar la lección» abre la primera de la unidad como siempre."""
    probs = []
    page = C.new_page("phone", viewport={"width": 360, "height": 740})
    chip = "() => { const a = document.getElementById('cm-ut'); return a ? {href: a.getAttribute('href'), t: a.textContent.replace(/\\s+/g, ' ').trim()} : null; }"
    try:
        # sin la unidad recién empezada (la partida sembrada va a mitad) y un niño nuevo: no sale
        C.seed(page)
        C.goto(page, "#/mapa/A1")
        page.wait_for_timeout(400)
        if page.evaluate(chip):
            probs.append(f"a mitad de unidad sale «¿Ya lo sabes?»: {page.evaluate(chip)}")
        k_new = C.seed_keys()
        k_new["map:english"] = "{}"
        C.seed(page, keys=k_new)
        C.goto(page, "#/mapa/A1")
        page.wait_for_timeout(400)
        if page.evaluate(chip):
            probs.append("a un niño nuevo le sale «¿Ya lo sabes?»")
        C.seed(page)
        C.goto(page, "#/mapa/A1")
        keys, u = _unit_keys(page)
        C.seed(page, keys=keys)
        C.goto(page, "#/mapa/A1")
        page.wait_for_timeout(500)
        c = page.evaluate(chip)
        want = f"#/leccion/A1-U{u['ui']:02d}"
        if not c or c["href"] != want or not c["t"].startswith("¿Ya lo sabes?"):
            probs.append(f"al empezar la unidad {u['ui']}: {c} (se esperaba {want})")
        else:
            page.locator("#cm-ut").scroll_into_view_if_needed()
            page.evaluate("() => scrollBy(0, -160)")
            page.wait_for_timeout(300)
            m = page.evaluate(_FITS)
            if m["sw"] > m["iw"]:
                probs.append(f"el camino con «¿Ya lo sabes?» se sale de lado ({m['sw']} > {m['iw']})")
            C.shot(page, "ya-lo-sabes-camino-360-light", OUT, full_page=False)
        base = C.export(page)
        srs0, t0 = page.evaluate(_SRS), page.evaluate("today()")
        coins0 = page.evaluate("game().coins")
        C.goto(page, want)
        page.wait_for_function(_READY, timeout=8000)
        page.wait_for_timeout(300)
        n = page.evaluate("vocabLesson.state.steps.length")
        types = set(page.evaluate("() => vocabLesson.state.steps.map(st => st.t)"))
        if n != 12 or types != {"pick"}:
            probs.append(f"«¿Ya lo sabes?» tiene {n} preguntas de tipo {types}")
        _fit(page, "¿Ya lo sabes? 360", "ya-lo-sabes-pregunta", probs, 360, 740, "light")
        q = _quiz(page, 10)
        if q != 12:
            probs.append(f"se contestaron {q} (las falladas no se repiten: 12)")
        page.wait_for_selector(".ls-utend", timeout=6000)
        page.wait_for_timeout(900)
        end = page.evaluate("""() => ({t: document.querySelector('.ls-end-t').textContent, s: document.querySelector('.ls-end-s').textContent,
          stars: document.querySelectorAll('.ls-utend .ls-star').length, next: document.getElementById('ls-next').textContent.trim(),
          href: document.getElementById('ls-next').getAttribute('href'), P: mapP(), cur: lvLessons('A1')[lvCur('A1', mapP())].id, coins: game().coins})""")
        if end["t"] != "¡Ya lo sabes!" or end["s"] != "Acertaste 10 de 12." or end["stars"] != 1 or end["next"] != "Siguiente lección" or end["href"] != "#/leccion/" + end["cur"]:
            probs.append(f"con 10 de 12: {end}")
        if any(end["P"].get(i) != 1 for i in u["voc"]):
            probs.append(f"con 10 de 12 las lecciones de la unidad: {[(i, end['P'].get(i)) for i in u['voc']]} (1 estrella cada una)")
        if not 0 < end["coins"] - coins0 <= 15:
            probs.append(f"monedas {coins0} → {end['coins']}")
        srs1 = page.evaluate(_SRS)
        for k in page.evaluate(_UNIT_SRS, u["voc"]):
            x, b0 = srs1.get(k), srs0.get(k)
            if not x or x.get("b", 0) < 2 or (b0 is None and (x.get("b") != 2 or x.get("due") != t0 + 3)):
                probs.append(f"repaso {k}: {b0} → {x} (caja 2)")
                break
        _fit(page, "¿Ya lo sabes? 360", "ya-lo-sabes-final", probs, 360, 740, "light")
        probs += C.errors(page)
        page.context.close()
        # con 9: nada cambia y se empieza la lección como siempre
        page = C.new_page("phone", color_scheme="dark")
        C.seed(page, keys=keys)
        C.goto(page, "#/mapa/A1")
        C.goto(page, want)
        page.wait_for_function(_READY, timeout=8000)
        page.wait_for_timeout(300)
        _fit(page, "¿Ya lo sabes? 390 oscuro", "ya-lo-sabes-pregunta", probs, 390, 844, "dark")
        _quiz(page, 9)
        page.wait_for_selector(".ls-utend", timeout=6000)
        page.wait_for_timeout(900)
        end = page.evaluate("""() => ({t: document.querySelector('.ls-end-t').textContent, s: document.querySelector('.ls-end-s').textContent,
          stars: document.querySelectorAll('.ls-utend .ls-star').length, next: document.getElementById('ls-next').textContent.trim(),
          href: document.getElementById('ls-next').getAttribute('href')})""")
        if end["t"] != "¡Buen intento!" or end["s"] != "Acertaste 9 de 12." or end["stars"] or end["next"] != "Empezar la lección" or end["href"] != "#/leccion/" + u["voc"][0]:
            probs.append(f"con 9 de 12: {end}")
        d = C.diff_exports(base, C.export(page), allow_new=False)
        if d:
            probs.append("con 9 de 12 la partida cambia:\n  " + "\n  ".join(d))
        _fit(page, "¿Ya lo sabes? 390 oscuro", "ya-lo-sabes-final-9", probs, 390, 844, "dark")
        page.wait_for_timeout(300)
        page.locator("#ls-next").click()
        page.wait_for_function(f"() => window.vocabLesson && vocabLesson.state && vocabLesson.state.id === '{u['voc'][0]}' && !vocabLesson.state.ut", timeout=8000)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- las pantallas nuevas caben
def test_new_screens_fit_phones_light_and_dark():
    """A 360×740 y 390×844, en claro y en oscuro: «Ordena las letras», «Completa la frase», «Empareja», la pregunta de
    repaso, el final con «Repasa tus fallos», su pregunta y su final caben en la pantalla sin moverse y sin salirse de
    lado, sin errores."""
    probs = []
    for (w, h) in ((360, 740), (390, 844)):
        for scheme in ("light", "dark"):
            label = f"{w}×{h} {scheme}"
            page = C.new_page("phone", viewport={"width": w, "height": h}, color_scheme=scheme)
            try:
                _open(page, "A1-002")
                for t, name in (("spell", "letras"), ("fill", "frase"), ("match", "empareja"), ("rv", "repaso")):
                    if not page.evaluate(_FORCE, [t, None]):
                        probs.append(f"{label}: sin {name} en A1-002")
                        continue
                    page.wait_for_timeout(450)
                    _fit(page, label, name, probs, w, h, scheme)
                    if t == "rv" and page.evaluate(f"() => {{ const t = document.querySelector('{_PG} .ls-rvt'); return t ? t.textContent.trim() : null; }}") != "Repaso":
                        probs.append(f"{label}: la de repaso sin «Repaso»")
                # el final con un fallo
                page.evaluate("() => { const s = vocabLesson.state; s.miss.add(s.words[0].k); s.i = s.steps.length; lsStep(1); }")
                page.wait_for_selector(".ls-end #ls-fix", timeout=5000)
                page.wait_for_timeout(1200)
                _fit(page, label, "final-con-fallos", probs, w, h, scheme)
                page.locator("#ls-fix").click()
                page.wait_for_function("() => vocabLesson.state && vocabLesson.state.fix && document.querySelector('.ls-stage .ls-page')", timeout=5000)
                page.wait_for_timeout(450)
                _fit(page, label, "fallos-pregunta", probs, w, h, scheme)
                _run(page)
                page.wait_for_selector(".ls-fixend", timeout=6000)
                page.wait_for_timeout(700)
                _fit(page, label, "fallos-final", probs, w, h, scheme)
                probs += [f"{label}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)
