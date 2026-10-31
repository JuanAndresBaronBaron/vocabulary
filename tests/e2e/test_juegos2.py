"""Mejoras de los módulos de juegos (segunda ola): explicaciones cortas y teclas aparte, niveles, gramática por edad,
el tema en los juegos de grupo, la IPA al enseñar una palabra, zonas de toque, contraste, idioma de los nombres y
elogios del esfuerzo.
Explicaciones: las de los juegos de los módulos (js/party.js, grammargames, wordplay, quiz, cuartel, topos, flyer,
army, lince, chant, simon y oido) tienen 15 palabras como mucho y no hablan de teclas; las teclas (def.keys, «Con el
teclado…») salen solo con teclado.
Niveles (api.level; ★★★ abre el siguiente): Concurso 15/12/10 s por pregunta; Verdadero o falso, menos tiempo por
tarjeta; Topos, más deprisa y con más topos malos; Sopa de letras 6/8/10 palabras (9 × 9 y 10 × 10 en el celular) y
en diagonal solo en el nivel 3. La tarjeta del menú dice «Nivel 3».
Gramática: sin nivel elegido empieza en el del camino (el más alto con una lección hecha en "map:<idioma>"); lo
elegido a mano se respeta. En A1-A2, tras contestar sale primero la frase modelo (lo que cambia, marcado) y su
español, y la regla plegada en «¿Por qué?» (≥ 44 px); de B1 en adelante, el porqué a la vista. Los botones del
nivel miden ≥ 44 px.
El impostor y Ordenar por grupo prefieren lo del tema elegido (Comida → un caso de comida; Colores → las cestas de
colores y familia); con Soldados, cualquiera. El resultado de Ordenar trae la IPA de cada palabra, y también el de la
Sopa.
Accesibilidad: casillas de la Sopa (también 10 × 10) y del Crucigrama con zona de toque de 44 px a 360 px (y tocar
cerca del borde elige esa casilla); altavoz de cada cesta ≥ 44 px; los nombres con palabras del idioma llevan su
lang (burbujas de Lluvia, topos, cestas, la tarjeta de Verdadero o falso y la lista de la Sopa); el letrero de Topos
en oscuro y la bienvenida del Concurso con contraste ≥ 4,5:1. Ningún módulo elogia a la persona («Eres el rey…»,
«Tienes oído…»). Capturas en capturas/juegos2."""
from __future__ import annotations

import json
import re

import common as C
import test_f4_juegos as J

OUT = C.CAPTURAS / "juegos2"
DATA = json.loads((C.ROOT / "data" / "party.json").read_text(encoding="utf-8"))
T = int(C.FIXED_NOW.timestamp() * 1000)
_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
MODS = ("party", "grammargames", "wordplay", "quiz", "cuartel", "topos", "flyer", "army", "lince", "chant", "simon", "oido")
MINE = ("impostor", "ordenar", "ordenafrase", "completa", "detective", "adivina", "sopa", "crucigrama", "concurso", "verdadero",
        "cajas", "flechas", "cuartel", "topos", "pajarito", "soldados", "lince", "rap", "zorrodice", "oido")
# el nombre accesible de un elemento: aria-labelledby (cada trozo con su lang) o aria-label
_NAME = """el => { if (!el) return null; const ids = (el.getAttribute('aria-labelledby') || '').split(/\\s+/).filter(Boolean);
  if (!ids.length) return {label: el.getAttribute('aria-label') || '', lang: el.closest('[lang]') ? el.closest('[lang]').getAttribute('lang') : '', parts: []};
  const parts = ids.map(id => { const e = document.getElementById(id); return e ? {t: e.textContent.trim(), lang: e.closest('[lang]') ? e.closest('[lang]').getAttribute('lang') : ''} : null; });
  return {label: parts.map(p => p ? p.t : '?').join(' '), parts}; }"""


def _keys(lang="english", topic=None, best=None, extra=None):
    k = C.seed_data()
    k["lang"] = lang
    if topic:
        k["games:topic"] = topic
    for g, lv in (best or {}).items():
        k["games:best"][g] = {"score": 5, "stars": 2, "plays": 3, "at": T - 3600 * 1000, "lv": lv}
    k.update(extra or {})
    return {kk: json.dumps(vv, ensure_ascii=False) for kk, vv in k.items()}


def _play(page, g, keys, hash_=None):
    """abre el juego g (desde su tarjeta, o con hash_) y pasa la explicación"""
    J._open(page, keys)
    if hash_:
        C.goto(page, hash_)
        page.evaluate(J._HOOKS)
        page.wait_for_function("g => document.documentElement.dataset.gmPlay === g", arg=g, timeout=8000)
        page.wait_for_timeout(250)
        if page.locator(".gm-intro .gm-go").count():
            page.locator(".gm-intro .gm-go").click()
    else:
        J._start(page, g)
    page.wait_for_timeout(400)


def _audit(page, scope):
    a = page.evaluate(_AUDIT, {"what": ["contrast"]})
    return [x for x in a["contrast"] if any(s in x for s in scope)]


# ---------------------------------------------------------------- explicaciones
def test_short_hows_and_keys_only_with_keyboard():
    """Las explicaciones de los juegos de los módulos: 15 palabras como mucho y sin teclas; «Con el teclado…» solo con
    teclado (escritorio) y nunca en el móvil."""
    probs = []
    for kind in ("desk", "phone"):
        page = C.new_page(kind)
        try:
            J._open(page, _keys())
            have = page.evaluate("() => vocabGames.list()")
            for g in MINE:
                if g not in have:
                    probs.append(f"{kind}: falta el juego {g}")
                    continue
                page.evaluate("g => vocabGames.peek(g, null)", g)
                page.wait_for_selector("dialog#gm-peek[open]", timeout=3000)
                how = page.evaluate("() => document.querySelector('#gm-peek .gm-pk-p').textContent")
                keys = page.evaluate("() => (document.querySelector('#gm-peek .gm-keys') || {}).textContent || ''")
                page.evaluate("() => document.querySelectorAll('dialog[open]').forEach(d => d.close())")
                if len(how.split()) > 15 or re.search(r"\bpulsa|\btecla|\bteclado|flechas ←", how, re.I):
                    probs.append(f"{kind} {g}: explicación de {len(how.split())} palabras: {how!r}")
                if (kind == "desk") != ("teclado" in keys):
                    probs.append(f"{kind} {g}: teclas {keys!r}")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_no_person_praise_in_modules():
    """Ningún texto de los módulos elogia a la persona (lista, genio, «Eres el rey…», «Tienes oído…»): se elogia lo
    que hizo o se informa."""
    bad = re.compile(r"[¡ ](?:qué|eres|estás hech[oa]) (?:list[oa]|genio|crack|inteligente|el rey|la reina|un[ao]? (?:genio|crack|campe[oó]n[a]?|máquina))"
                     r"|tienes oído|eres el rey|eres la reina|eres un genio|eres una? (?:crack|máquina)|qué listo|qué lista", re.I)
    probs = []
    for m in MODS:
        for i, line in enumerate((C.ROOT / "js" / f"{m}.js").read_text(encoding="utf-8").splitlines(), 1):
            if bad.search(line):
                probs.append(f"js/{m}.js:{i}: {line.strip()[:140]}")
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- niveles
def test_levels_concurso_verdadero_topos():
    """Concurso: 15, 12 y 10 s por pregunta en los niveles 1, 2 y 3. Verdadero o falso: en el 3 cada tarjeta tiene
    el 65 % del tiempo. Topos: en el 3 salen más deprisa y con más malos. Las tarjetas del menú dicen «Nivel 3»."""
    probs = []
    page = C.new_page("phone")
    try:
        for lv, want in ((1, 15), (2, 12), (3, 10)):
            _play(page, "concurso", _keys(best={"concurso": lv}))
            page.wait_for_selector("#cq-s", timeout=8000)
            page.wait_for_timeout(300)
            s = int(page.locator("#cq-s").text_content())
            if not want - 1 <= s <= want:
                probs.append(f"Concurso nivel {lv}: {s} s (se esperaban {want})")
            probs += C.errors(page)
        _play(page, "verdadero", _keys(best={"verdadero": 3}))
        page.wait_for_function("() => document.getElementById('vf-card') && document.getElementById('vf-card').vfLim", timeout=8000)
        lim3 = page.evaluate("() => document.getElementById('vf-card').vfLim")
        _play(page, "verdadero", _keys())
        page.wait_for_function("() => document.getElementById('vf-card') && document.getElementById('vf-card').vfLim", timeout=8000)
        lim1 = page.evaluate("() => document.getElementById('vf-card').vfLim")
        if not (lim1 > 6 and abs(lim3 - lim1 * .65) < .3):
            probs.append(f"Verdadero o falso: tiempo de la tarjeta {lim1} (nivel 1) y {lim3} (nivel 3)")
        _play(page, "topos", _keys(best={"topos": 3}))
        page.wait_for_function("() => document.getElementById('tp') && document.getElementById('tp').tpK", timeout=8000)
        k3 = page.evaluate("() => document.getElementById('tp').tpK")
        _play(page, "topos", _keys())
        page.wait_for_function("() => document.getElementById('tp') && document.getElementById('tp').tpK", timeout=8000)
        k1 = page.evaluate("() => document.getElementById('tp').tpK")
        if not (k3["sp"] < k1["sp"] and k3["ok"] < k1["ok"]):
            probs.append(f"Topos: nivel 1 {k1}, nivel 3 {k3}")
        J._open(page, _keys(best={g: 3 for g in ("concurso", "verdadero", "topos", "sopa")}))
        for g in ("concurso", "verdadero", "topos", "sopa"):
            b = page.evaluate("g => (document.querySelector(`.gm-card[data-g=\"${g}\"] .gm-lvb`) || {}).textContent || ''", g)
            if b != "Nivel 3":
                probs.append(f"tarjeta de {g}: {b!r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


_SP = """() => { const r = document.getElementById('wp-sp'), N = r.wpN;
  const dirs = r.wpWords.map(w => { const a = w.cells[0], b = w.cells[1]; return [Math.floor(b / N) - Math.floor(a / N), b % N - a % N].join(','); });
  return {N, lv: r.wpLv, n: r.wpWords.length, diag: dirs.filter(d => !['0,1', '1,0'].includes(d)).length,
    hit: [...document.querySelectorAll('.wp-c')].slice(0, 3).map(c => { const s = getComputedStyle(c, '::after'), b = c.getBoundingClientRect();
      return {w: b.width - parseFloat(s.left) - parseFloat(s.right), h: b.height - parseFloat(s.top) - parseFloat(s.bottom), cell: b.width}; }),
    scroll: document.documentElement.scrollWidth > innerWidth + 1}; }"""


def test_sopa_levels_diagonals_and_hit_areas():
    """Sopa de letras: nivel 1, 6 palabras sin diagonales (también en el ordenador); nivel 2, 8 en 9 × 9 (celular);
    nivel 3, 10 en 10 × 10 y alguna en diagonal. A 360 px cada casilla tiene una zona de toque de 44 px (aunque mida
    menos), sin scroll de lado, y el reloj y «0/10» no tapan las monedas; tocar la primera y la última letra de una
    palabra la marca."""
    probs = []
    for kind, lv, N, n in (("desk", 1, 10, 6), ("phone", 1, 8, 6), ("phone", 2, 9, 8), ("phone", 3, 10, 10)):
        page = C.new_page(kind)
        try:
            if kind == "phone":
                page.set_viewport_size({"width": 360, "height": 780})
            _play(page, "sopa", _keys(best={"sopa": lv} if lv > 1 else None))
            page.wait_for_selector("#wp-sp .wp-c", timeout=8000)
            page.wait_for_timeout(500)
            st = page.evaluate(_SP)
            if st["N"] != N or st["n"] != n or st["lv"] != lv or (st["diag"] > 0) != (lv == 3):
                probs.append(f"{kind} nivel {lv}: {N}×{N} con {n} palabras: {st}")
            if kind == "phone" and (st["scroll"] or any(h["w"] < 43.5 or h["h"] < 43.5 for h in st["hit"])):
                probs.append(f"{kind} nivel {lv}: zona de toque {st['hit']} (scroll de lado: {st['scroll']})")
            if kind == "phone" and lv == 3:
                gap = page.evaluate("() => document.querySelector('#focusbar .fx-coins').getBoundingClientRect().left - document.querySelector('#wp-sp .gm-stats').getBoundingClientRect().right")
                if gap < 8:
                    probs.append(f"{kind} nivel 3: el reloj y «0/10» llegan a las monedas (hueco {gap:.0f} px)")
                C.shot(page, "sopa-nivel3-360", OUT, full_page=False)
                w = page.evaluate("() => document.getElementById('wp-sp').wpWords[0]")
                page.locator(".wp-c").nth(w["cells"][0]).tap()
                page.locator(".wp-c").nth(w["cells"][-1]).tap()
                page.wait_for_function("() => +document.querySelector('#gm-sc').textContent === 1", timeout=3000)
            probs += [f"{kind} {lv}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_sopa_result_has_ipa_and_list_names_have_lang():
    """La lista de la Sopa: cada palabra se nombra con su lang y «Toca para oírla» en español. Al encontrar las 6 sale
    el resultado con la IPA de cada palabra."""
    probs = []
    page = C.new_page("desk")
    try:
        _play(page, "sopa", _keys())
        page.wait_for_selector("#wp-sp .wp-c", timeout=8000)
        page.wait_for_timeout(400)
        nm = page.evaluate(f"() => ({_NAME})(document.querySelector('.wp-li'))")
        if not nm or len(nm["parts"]) != 2 or nm["parts"][0]["lang"] != "en-GB" or nm["parts"][1]["lang"] != "es" or "oírla" not in nm["label"]:
            probs.append(f"nombre de la lista: {nm}")
        ws = page.evaluate("() => document.getElementById('wp-sp').wpWords")
        for w in ws:
            a, b = [page.evaluate(f"() => {{ const r = document.querySelectorAll('.wp-c')[{i}].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }}") for i in (w["cells"][0], w["cells"][-1])]
            page.mouse.move(*a)
            page.mouse.down()
            page.mouse.move(*b, steps=8)
            page.mouse.up()
            page.wait_for_timeout(150)
        page.wait_for_selector("#gm-end", timeout=6000)
        page.wait_for_timeout(600)
        r = page.evaluate("() => ({w: document.querySelectorAll('#gm-wl .gm-wc').length, ipa: document.querySelectorAll('#gm-wl .ipa').length})")
        if not r["w"] or r["ipa"] < r["w"]:
            probs.append(f"resultado sin IPA: {r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_crucigrama_hit_areas_pick_the_right_cell():
    """Crucigrama a 360 px: cada casilla tiene una zona de toque de 44 px; tocar a 2 px del borde de una casilla elige
    esa casilla (no la vecina)."""
    probs = []
    page = C.new_page("phone")
    try:
        page.set_viewport_size({"width": 360, "height": 740})
        _play(page, "crucigrama", _keys())
        page.wait_for_selector(".wp-cc", timeout=8000)
        page.wait_for_timeout(500)
        st = page.evaluate("""() => [...document.querySelectorAll('.wp-cc')].slice(0, 4).map(c => { const s = getComputedStyle(c, '::before'), b = c.getBoundingClientRect();
          return {w: b.width - parseFloat(s.left) - parseFloat(s.right), h: b.height - parseFloat(s.top) - parseFloat(s.bottom), cell: b.width}; })""")
        if any(h["w"] < 43.5 or h["h"] < 43.5 for h in st):
            probs.append(f"zona de toque de las casillas: {st}")
        # una casilla con vecina a la derecha: tocar cerca de su borde derecho la elige a ella
        pair = page.evaluate("""() => { const cs = [...document.querySelectorAll('.wp-cc')];
          for (const a of cs) { const [r, c] = a.dataset.k.split(',').map(Number); const b = cs.find(x => x.dataset.k === `${r},${c + 1}`);
            if (b) { const ra = a.getBoundingClientRect(); return {k: a.dataset.k, x: ra.right - 2, y: ra.top + ra.height / 2}; } }
          return null; }""")
        if pair:
            page.mouse.click(pair["x"], pair["y"])
            page.wait_for_timeout(200)
            cur = page.evaluate("() => (document.querySelector('.wp-cc.cur') || {dataset: {}}).dataset.k")
            if cur != pair["k"]:
                probs.append(f"tocar el borde de {pair['k']} eligió {cur}")
        else:
            probs.append("el crucigrama no tiene dos casillas seguidas")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- gramática
def _gg(page, g, keys):
    C.seed(page, keys, "#/juegos")
    page.wait_for_selector(f'.gm-card[data-g="{g}"]', timeout=8000)
    page.click(f'.gm-card[data-g="{g}"]')
    page.wait_for_selector("#gg .gg-chips", timeout=8000)
    if page.locator(".gm-intro .gm-go").count():
        page.locator(".gm-intro .gm-go").click()
    page.wait_for_function("() => !document.querySelector('.gm-intro')")
    page.wait_for_timeout(300)


_FB = """() => { const fb = document.querySelector('.gg-fb'); if (!fb) return null; const kids = [...fb.children];
  const at = s => kids.findIndex(e => e.matches(s)), d = fb.querySelector('details.gg-fb-pq'), sm = d && d.querySelector('summary');
  return {kid: fb.classList.contains('kid'), s: at('.gg-fb-s'), es: at('.gg-fb-es'), det: at('details.gg-fb-pq'), why: at('p.gg-fb-why'),
    mark: (fb.querySelector('.gg-fb-s mark') || {}).textContent || '', lang: (fb.querySelector('.gg-fb-s') || {}).lang || '',
    open: d ? d.open : null, sum: sm ? {t: sm.textContent.trim(), h: sm.getBoundingClientRect().height} : null,
    rule: d ? d.querySelector('span').textContent.trim() : ''}; }"""


def test_grammar_path_level_and_frames_first_for_children():
    """Sin nivel elegido, Completa empieza en el nivel del camino (B1 con una lección B1 hecha); lo elegido a mano
    (A2) manda. En A1, tras fallar: la frase modelo (con la palabra buena marcada y su lang), luego el español y la
    regla plegada en «¿Por qué?» (≥ 44 px, se abre al tocarla). En B1, el porqué a la vista. Los botones del nivel
    miden ≥ 44 px, también en pantallas bajas."""
    probs = []
    for vh in (844, 640):
        page = C.new_page("phone")
        try:
            page.set_viewport_size({"width": 390, "height": vh})
            m = C.seed_data()["map:english"]
            _gg(page, "completa", _keys(extra={"map:english": dict(m, **{"B1-003": 2})}))
            if page.evaluate("document.querySelector('#gg').ggLv") != "B1":
                probs.append(f"{vh}: sin elegir, el nivel es {page.evaluate('document.querySelector(`#gg`).ggLv')} (el camino va por B1)")
            hs = page.evaluate("[...document.querySelectorAll('.gg-lv-b')].map(b => b.getBoundingClientRect().height)")
            if not hs or min(hs) < 44:
                probs.append(f"{vh}: botones del nivel de {hs} px")
            if vh == 844:
                page.locator(".gg-op").nth(page.evaluate("() => [...document.querySelectorAll('.gg-op')].findIndex(b => !b.ggOk)")).click()
                page.wait_for_selector(".gg-fb", timeout=3000)
                fb = page.evaluate(_FB)
                if fb["kid"] or fb["why"] < 0 or fb["det"] >= 0:
                    probs.append(f"B1: el porqué no está a la vista: {fb}")
                _gg(page, "completa", _keys(extra={"map:english": dict(m, **{"B1-003": 2}), "gram:lv": {"english": "A2"}}))
                if page.evaluate("document.querySelector('#gg').ggLv") != "A2":
                    probs.append("lo elegido a mano (A2) no manda")
            probs += C.errors(page)
        finally:
            page.context.close()
    page = C.new_page("phone")
    try:
        for g, sel in (("completa", ".gg-op"), ("detective", ".gg-nt")):
            _gg(page, g, _keys())
            right = page.evaluate(f"() => {{ const b = [...document.querySelectorAll('{sel}')].find(b => b.ggOk); return (b.querySelector('mark') || b.querySelector('span') || b).textContent.trim(); }}")
            page.locator(sel).nth(page.evaluate(f"() => [...document.querySelectorAll('{sel}')].findIndex(b => !b.ggOk)")).click()
            page.wait_for_selector(".gg-fb", timeout=3000)
            fb = page.evaluate(_FB)
            if not fb["kid"] or not (0 <= fb["s"] < fb["es"] < fb["det"]) or fb["why"] >= 0 or fb["lang"] != "en-GB" or fb["open"] is not False:
                probs.append(f"{g} A1: {fb}")
            if right and right not in "–—-" and fb["mark"] != right:
                probs.append(f"{g} A1: marca {fb['mark']!r} (la buena es {right!r})")
            if not fb["sum"] or fb["sum"]["t"] != "¿Por qué?" or fb["sum"]["h"] < 44 or not fb["rule"]:
                probs.append(f"{g} A1: «¿Por qué?» {fb['sum']} regla {fb['rule']!r}")
            if g == "completa":
                C.shot(page, "gramatica-a1-modelo", OUT, full_page=False)
            page.locator(".gg-fb-pq summary").click()
            if not page.evaluate("document.querySelector('details.gg-fb-pq').open"):
                probs.append(f"{g}: «¿Por qué?» no se abre")
            # la regla, debajo de «¿Por qué?» (no en una columna al lado)
            lay = page.evaluate("""() => { const d = document.querySelector('details.gg-fb-pq'), s = d.querySelector('summary').getBoundingClientRect(),
              r = d.querySelector(':scope > span').getBoundingClientRect(); return {below: r.top >= s.bottom - 1, sumH: s.height}; }""")
            if not lay["below"] or lay["sumH"] > 60:
                probs.append(f"{g}: «¿Por qué?» abierto mal colocado {lay}")
            if g == "completa":
                C.shot(page, "gramatica-a1-porque", OUT, full_page=False)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- juegos de grupo
def _secret(page):
    return page.evaluate("JSON.parse(localStorage.getItem('party:st')).imp.slice(-1)[0]")


def test_group_games_prefer_the_topic():
    """El impostor con el tema Comida juega un caso de comida (2 partidas seguidas, distintas); Ordenar con Colores
    trae las cestas de colores y familia; con Soldados, Ordenar juega igual (cualquier juego de cestas)."""
    probs = []
    page = C.new_page("phone")
    try:
        seen = []
        for k in range(2):
            keys = _keys(topic="w03")
            if k:
                keys["party:st"] = json.dumps({"imp": seen})
            _play(page, "impostor", keys, "#/juegos/impostor?m=solo")
            page.wait_for_function("() => { try { return JSON.parse(localStorage.getItem('party:st')).imp.length > 0; } catch (e) { return false; } }", timeout=8000)
            s = _secret(page)
            seen.append(s)
            if DATA["words"][s].get("d") != "w03":
                probs.append(f"impostor con Comida: el secreto es {s} ({DATA['words'][s].get('d')})")
        if len(set(seen)) != 2:
            probs.append(f"el impostor repite el caso: {seen}")
        _play(page, "ordenar", _keys(topic="colores"), "#/juegos/ordenar")
        page.wait_for_selector(".pt-bk", timeout=8000)
        names = page.evaluate("[...document.querySelectorAll('.pt-bk .pt-w')].map(e => e.textContent)")
        want = sorted(DATA["sort"]["groups"][g]["n"]["english"][0] for g in ("colours", "family"))
        if sorted(names) != want:
            probs.append(f"Ordenar con Colores: cestas {names} (se esperaban {want})")
        _play(page, "ordenar", _keys(topic="militar"), "#/juegos/ordenar")
        page.wait_for_selector(".pt-bk", timeout=8000)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_sort_names_targets_and_result_ipa():
    """Ordenar (Animales): las cestas se nombran «Cesta» (español) + su nombre (con lang); el altavoz de cada cesta mide
    ≥ 44 px y se nombra «Escuchar» + el nombre; la palabra, su nombre con lang y «Toca para oírla». Ordenando todo a
    la primera, el resultado trae la IPA de cada palabra."""
    probs = []
    page = C.new_page("phone")
    try:
        page.set_viewport_size({"width": 360, "height": 740})
        _play(page, "ordenar", _keys(), "#/juegos/ordenar")
        page.wait_for_selector(".pt-bk", timeout=8000)
        page.wait_for_timeout(400)
        bk = page.evaluate(f"() => ({_NAME})(document.querySelector('.pt-bk'))")
        sy = page.evaluate(f"() => ({_NAME})(document.querySelector('.pt-bk-say'))")
        wc = page.evaluate(f"() => ({_NAME})(document.querySelector('#pt-wc'))")
        for nm, first in ((bk, "Cesta"), (sy, "Escuchar")):
            if not nm or [p["lang"] for p in nm["parts"]] != ["es", "en-GB"] or nm["parts"][0]["t"] != first:
                probs.append(f"nombre {first}: {nm}")
        if not wc or [p["lang"] for p in wc["parts"]] != ["en-GB", "es"]:
            probs.append(f"nombre de la palabra: {wc}")
        sz = page.evaluate("[...document.querySelectorAll('.pt-bk-say')].map(b => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); })")
        if min(sz) < 44:
            probs.append(f"altavoz de las cestas: {sz}")
        C.shot(page, "ordenar-360", OUT, full_page=False)
        G = DATA["sort"]["groups"]
        for _ in range(14):
            if page.locator("#gm-end").count():
                break
            st = page.evaluate("() => ({bk: [...document.querySelectorAll('.pt-bk .pt-w')].map(e => e.textContent), w: (document.querySelector('#pt-wc .pt-w') || {}).textContent || ''})")
            gids = [next((gid for gid, g in G.items() if g["n"]["english"][0] == n), None) for n in st["bk"]]
            gi = next((i for i, g in enumerate(gids) if g and any(DATA["words"][x]["english"][0] == st["w"] for x in G[g]["w"] if x in DATA["words"])), None)
            if gi is None:
                probs.append(f"no sé dónde va «{st['w']}»: {st['bk']}")
                break
            page.locator(f'.pt-bk[data-g="{gi}"]').click()
            page.wait_for_timeout(1000)
        page.wait_for_selector("#pt-end, #gm-end", timeout=8000)
        if page.locator("#pt-end").count():
            page.locator("#pt-end").click()
        page.wait_for_selector("#gm-end", timeout=8000)
        page.wait_for_timeout(700)
        r = page.evaluate("() => ({w: document.querySelectorAll('#gm-wl .gm-wc').length, ipa: document.querySelectorAll('#gm-wl .ipa').length})")
        if not r["w"] or r["ipa"] < r["w"]:
            probs.append(f"resultado sin IPA: {r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- idioma de los nombres y contraste
def test_lang_names_and_contrast():
    """Lluvia: cada burbuja (su nombre es la palabra) lleva el lang del idioma. Topos: un topo se nombra «Topo:» (en
    español) + su palabra (con lang); el letrero en oscuro, ≥ 4,5:1. Verdadero o falso: la tarjeta (grupo) se nombra
    con el dibujo en español y la palabra con su lang. Concurso: la bienvenida y la pregunta, ≥ 4,5:1 (claro y oscuro);
    los comodines miden ≥ 44 px."""
    probs = []
    for scheme in ("light", "dark"):
        page = C.new_page("phone", color_scheme=scheme)
        try:
            J._open(page, _keys())
            J._start(page, "concurso", intro=None)
            page.wait_for_timeout(400)
            probs += [f"{scheme} Concurso (bienvenida): {x}" for x in _audit(page, ("cq-",))]
            C.shot(page, f"concurso-bienvenida-{scheme}", OUT, full_page=False)
            if page.locator(".gm-intro .gm-go").count():
                page.locator(".gm-intro .gm-go").click()
            page.wait_for_selector("#cq-q .cq-ask", timeout=8000)
            page.wait_for_timeout(500)
            probs += [f"{scheme} Concurso: {x}" for x in _audit(page, ("cq-",))]
            mini = page.evaluate("[...document.querySelectorAll('.cq-lf, .cq-mini')].filter(b => b.getClientRects().length).map(b => b.getBoundingClientRect().height)")
            if mini and min(mini) < 44:
                probs.append(f"{scheme}: comodines de {mini} px")
            _play(page, "topos", _keys())
            page.wait_for_selector("#tp-field .tp-cell.up", timeout=8000)
            nm = page.evaluate(f"() => ({_NAME})(document.querySelector('#tp-field .tp-cell.up'))")
            if not nm or [p["lang"] for p in nm["parts"]] != ["es", "en-GB"] or nm["parts"][0]["t"] != "Topo:" or not nm["parts"][1]["t"]:
                probs.append(f"{scheme} topo: {nm}")
            probs += [f"{scheme} Topos: {x}" for x in _audit(page, ("tp-",))]
            if scheme == "dark":
                C.shot(page, "topos-oscuro", OUT, full_page=False)
            _play(page, "verdadero", _keys())
            page.wait_for_function("() => document.getElementById('vf-card') && document.getElementById('vf-card').vfLim", timeout=8000)
            nm = page.evaluate(f"() => ({_NAME})(document.getElementById('vf-card'))")
            if page.evaluate("document.getElementById('vf-card').getAttribute('role')") != "group" or not nm \
                    or [p["lang"] for p in nm["parts"]] != ["es", "en-GB"] or not nm["parts"][0]["t"].startswith("Dibujo de"):
                probs.append(f"{scheme} tarjeta de Verdadero o falso: {nm}")
            probs += C.errors(page)
        finally:
            page.context.close()
    page = C.new_page("phone")
    try:
        J._open(page, _keys())
        J._start(page, "lluvia")
        page.wait_for_selector("#gm-sky .gm-bub", timeout=8000)
        langs = page.evaluate("[...document.querySelectorAll('#gm-sky .gm-bub')].map(b => [b.getAttribute('aria-label'), b.lang])")
        if not langs or any(not a or l != "en-GB" for a, l in langs):
            probs.append(f"Lluvia: {langs}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
