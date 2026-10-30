"""Los juegos de palabras de js/wordplay.js: «Adivina la palabra» (la cesta del globo), «Sopa de letras» y
«Crucigrama». Las tarjetas en Juegos (con su dibujo de 220 px); en el celular (360 y 390 px, claro y oscuro) todo
cabe a lo ancho, los dibujos se ven grandes y las casillas del crucigrama miden ≥ 30 px; en el ordenador, también.
Aciertos y fallos (gris con ✗), la cesta que baja y aterriza, la sopa con arrastre, toques, una selección mala y la
pista que brilla, el crucigrama con letras mal, «Pista» y palabras cruzadas de verdad; una partida entera de cada uno
hasta el resultado con "games:best"; francés (sin tildes: la E destapa la é) y danés (Æ Ø Å).
Capturas en capturas/wordplay."""
from __future__ import annotations

import json

try:
    from . import common as C
except ImportError:
    import common as C

SHOTS = C.CAPTURAS / "wordplay"
ROOT = {"adivina": "#wp-ad", "sopa": "#wp-sp", "crucigrama": "#wp-cw"}
ABC_EN = "abcdefghijklmnopqrstuvwxyz"


def _keys(lang="english", topic=None):
    k = C.seed_data()
    k["lang"] = lang
    if topic:
        k["games:topic"] = topic
    return {kk: json.dumps(vv, ensure_ascii=False) for kk, vv in k.items()}


def _open(page, g, lang="english", topic=None, js=None):
    """abre el juego g desde su tarjeta (js: algo que poner antes, p. ej. un gancho de prueba) y pasa la explicación"""
    C.seed(page, _keys(lang, topic), "#/juegos")
    if js:
        page.evaluate(js)
    page.wait_for_selector(f'.gm-card[data-g="{g}"]', timeout=8000)
    page.click(f'.gm-card[data-g="{g}"]')
    page.wait_for_selector(ROOT[g], timeout=8000)
    go = page.locator(".gm-intro .gm-go")
    if go.count():
        go.click()
    page.wait_for_function("() => !document.querySelector('.gm-intro')")
    page.wait_for_timeout(500)


def _page(w, scheme):
    page = C.new_page("phone", color_scheme=scheme)
    page.set_viewport_size({"width": w, "height": 780})
    return page


def _no_hscroll(page):
    return page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")


# ------------------------------------------------------------------ tarjetas
def test_cards_in_menu():
    """Las tres tarjetas salen en Juegos con su dibujo propio de 220 px y juegan con el tema elegido."""
    page = C.new_page("desk")
    try:
        C.seed(page, _keys(), "#/juegos")
        for g in ROOT:
            page.wait_for_selector(f'.gm-card[data-g="{g}"]', timeout=8000)
            nw = page.evaluate(f"""() => new Promise(r => {{ const i = document.querySelector('.gm-card[data-g="{g}"] img');
              if (i.complete) r(i.naturalWidth); else i.onload = () => r(i.naturalWidth); }})""")
            assert nw == 220, (g, nw)
            meta = page.evaluate(f"vocabGames.meta('{g}')")
            assert meta and meta["topic"] is True, meta
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ------------------------------------------------------------------ adivina
def _ad(page):
    return page.evaluate("""() => {
      const r = document.querySelector('#wp-ad'), card = document.querySelector('#wp-card').getBoundingClientRect();
      const kb = document.querySelector('#wp-kb').getBoundingClientRect();
      return {word: r.wpAd.word, ipa: r.wpAd.ipa, keys: r.wpAd.keys, card: card.width, kbBottom: kb.bottom, boxes: document.querySelectorAll('.wp-box').length,
        filled: [...document.querySelectorAll('.wp-box')].filter(b => b.textContent).length,
        pops: document.querySelectorAll('.wp-bl.pop').length, land: document.querySelector('#wp-rig').classList.contains('land'),
        ry: parseFloat(getComputedStyle(document.querySelector('#wp-rig')).getPropertyValue('--ry')),
        res: (document.querySelector('#wp-res') || {}).textContent || '', sc: +document.querySelector('#gm-sc').textContent,
        abc: [...document.querySelectorAll('.wp-key')].map(k => k.dataset.l).join('')};
    }""")


def _ad_solve(page, st):
    for k in st["keys"]:
        page.keyboard.press(k)
    page.wait_for_selector("#wp-res.ok", timeout=4000)


def test_adivina_phone_layout():
    """En 360 y 390 px (oscuro y claro): el dibujo de la cesta mide ≥ 96 px, el teclado de letras cabe en la pantalla
    y no hay scroll de lado; las cajitas, tantas como letras."""
    for w, scheme in ((360, "dark"), (390, "light")):
        page = _page(w, scheme)
        try:
            _open(page, "adivina")
            page.wait_for_timeout(600)
            st = _ad(page)
            assert st["card"] >= 96, st["card"]
            assert st["kbBottom"] <= 780, st["kbBottom"]
            assert st["boxes"] >= 3 and st["filled"] == 0, st
            assert st["abc"] == ABC_EN, st["abc"]
            assert _no_hscroll(page), "scroll de lado"
            C.shot(page, f"adivina-{w}-{scheme}", SHOTS, full_page=False)
            assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()


def test_adivina_wrong_right_landing_and_end():
    """Una letra que no está: la tecla en gris con ✗, se pincha un globo y la cesta baja. Las letras buenas (con el
    teclado de verdad) llenan las cajitas y sale la palabra con su IPA. Seis fallos: la cesta aterriza y se ve la
    palabra. Al acabar las 8, el resultado con récord en games:best.adivina."""
    page = C.new_page("desk")
    try:
        _open(page, "adivina")
        st = _ad(page)
        y0 = st["ry"]
        wrong = [c for c in ABC_EN if c not in st["keys"]]
        page.click(f'.wp-key[data-l="{wrong[0]}"]')
        page.wait_for_timeout(800)
        st = _ad(page)
        assert st["pops"] == 1 and st["ry"] > y0 and not st["land"], st
        cls = page.evaluate(f"document.querySelector('.wp-key[data-l=\"{wrong[0]}\"]').className")
        assert "no" in cls, cls
        assert st["filled"] == 0
        C.shot(page, "adivina-fallo", SHOTS, full_page=False)
        _ad_solve(page, st)
        st = _ad(page)
        assert st["filled"] == st["boxes"] and st["sc"] == 1, st
        assert "¡Muy bien!" in st["res"], st["res"]
        assert page.evaluate("!!document.querySelector('#wp-res .ipa')") == bool(st["ipa"]), st["ipa"]
        C.shot(page, "adivina-acierto", SHOTS, full_page=False)
        page.click("#wp-next")
        page.wait_for_function("() => !document.querySelector('#wp-res')")
        # la segunda: seis fallos, la cesta aterriza
        st = _ad(page)
        wrong = [c for c in ABC_EN if c not in st["keys"]][:6]
        for c in wrong:
            page.keyboard.press(c)
            page.wait_for_timeout(60)
        page.wait_for_selector("#wp-res", timeout=4000)
        st = _ad(page)
        assert st["pops"] == 6 and st["land"], st
        assert "aterrizó" in st["res"] and st["filled"] == st["boxes"], st
        assert page.evaluate("document.querySelectorAll('.wp-box.gave').length") > 0
        C.shot(page, "adivina-aterriza", SHOTS, full_page=False)
        page.click("#wp-next")
        for _ in range(6):
            page.wait_for_function("() => !document.querySelector('#wp-res')")
            _ad_solve(page, _ad(page))
            page.click("#wp-next")
        page.wait_for_selector("#gm-end", timeout=5000)
        best = page.evaluate("JSON.parse(localStorage.getItem('games:best')).adivina")
        assert best["plays"] == 1 and best["score"] == 7 and best["stars"] == 3, best
        C.shot(page, "adivina-final", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_adivina_french_and_danish():
    """En francés la E destapa también la é (el artículo l' se ve); en danés el teclado lleva Æ Ø Å y la Ø destapa
    la ø."""
    page = C.new_page("phone")
    try:
        _open(page, "adivina", "français", js="window.__wpPrefer = 'é'")
        st = _ad(page)
        assert "é" in st["word"], st["word"]
        assert all(k in ABC_EN for k in st["keys"]), st["keys"]
        page.keyboard.press("e")
        page.wait_for_timeout(200)
        txt = page.evaluate("[...document.querySelectorAll('.wp-box')].map(b => b.textContent).join('')")
        assert "é" in txt, txt
        assert page.evaluate("document.querySelector('#wp-word').getAttribute('lang')").startswith("fr")
        C.shot(page, "adivina-frances", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
    page = C.new_page("phone", color_scheme="dark")
    try:
        _open(page, "adivina", "dansk", js="window.__wpPrefer = 'ø'")
        st = _ad(page)
        assert st["abc"].endswith("æøå"), st["abc"]
        assert "ø" in st["keys"], st
        page.locator('.wp-key[data-l="ø"]').tap()
        page.wait_for_timeout(200)
        txt = page.evaluate("[...document.querySelectorAll('.wp-box')].map(b => b.textContent).join('')")
        assert "ø" in txt, txt
        assert "ok" in page.evaluate("document.querySelector('.wp-key[data-l=\"ø\"]').className")
        C.shot(page, "adivina-danes", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ------------------------------------------------------------------ sopa
def _sp(page):
    return page.evaluate("""() => {
      const r = document.querySelector('#wp-sp'), b = document.querySelector('#wp-board').getBoundingClientRect();
      const l = document.querySelector('#wp-list').getBoundingClientRect();
      return {N: r.wpN, words: r.wpWords, board: b.width, bh: b.height, listBottom: l.bottom, cells: document.querySelectorAll('.wp-c').length,
        found: +document.querySelector('#gm-sc').textContent, bands: document.querySelectorAll('.wp-band').length,
        done: document.querySelectorAll('.wp-li.done').length, st: document.querySelector('#wp-st').textContent,
        pics: [...document.querySelectorAll('.wp-li-p')].map(p => p.getBoundingClientRect().width),
        clock: document.querySelector('#wp-clock').textContent, hint: [...document.querySelectorAll('.wp-c.hint')].map(c => +c.dataset.i)};
    }""")


def _center(page, i):
    b = page.evaluate(f"(() => {{ const r = document.querySelectorAll('.wp-c')[{i}].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }})()")
    return b[0], b[1]


def _drag(page, a, b):
    x0, y0 = _center(page, a)
    x1, y1 = _center(page, b)
    page.mouse.move(x0, y0)
    page.mouse.down()
    page.mouse.move(x1, y1, steps=8)
    page.mouse.up()


def test_sopa_phone_layout():
    """En 360 y 390 px la sopa es de 8 × 8, cuadrada y a todo el ancho (casillas ≥ 30 px), la lista de 6 palabras con
    su dibujo cabe debajo sin scroll de lado."""
    for w, scheme in ((360, "light"), (390, "dark")):
        page = _page(w, scheme)
        try:
            _open(page, "sopa")
            page.wait_for_timeout(500)
            st = _sp(page)
            assert st["N"] == 8 and st["cells"] == 64, st
            assert st["board"] >= w - 40 and abs(st["board"] - st["bh"]) < 1, st
            assert len(st["words"]) == 6 and all(3 <= len(x["s"]) <= 8 for x in st["words"]), st["words"]
            assert st["listBottom"] <= 780, st["listBottom"]
            assert min(st["pics"]) >= 56, st["pics"]
            assert _no_hscroll(page), "scroll de lado"
            # solo de lado y hacia abajo
            for x in st["words"]:
                c = x["cells"]
                assert c[1] - c[0] in (1, 8), x
            C.shot(page, f"sopa-{w}-{scheme}", SHOTS, full_page=False)
            assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()


def test_sopa_drag_tap_wrong_hint_and_end():
    """En el ordenador (10 × 10): arrastrar sobre una palabra la marca (banda, ✓ en la lista, suena con su IPA);
    tocar la primera y la última letra, también; dos letras que no son nada se quedan en gris un momento. Sin
    encontrar nada, brilla la primera letra de una palabra. Con las 6, el resultado y games:best.sopa."""
    page = C.new_page("desk")
    try:
        _open(page, "sopa", js="window.__wpHint = 3")
        st = _sp(page)
        assert st["N"] == 10 and st["cells"] == 100, st
        ws = st["words"]
        _drag(page, ws[0]["cells"][0], ws[0]["cells"][-1])
        page.wait_for_function("() => +document.querySelector('#gm-sc').textContent === 1", timeout=3000)
        st = _sp(page)
        assert st["bands"] == 1 and st["done"] == 1 and st["st"].startswith("✓"), st
        # tocar la última y luego la primera (al revés también vale)
        page.mouse.click(*_center(page, ws[1]["cells"][-1]))
        page.mouse.click(*_center(page, ws[1]["cells"][0]))
        page.wait_for_function("() => +document.querySelector('#gm-sc').textContent === 2", timeout=3000)
        # mal: dos letras de una esquina libre
        _drag(page, 0, 1)
        page.wait_for_timeout(120)
        assert page.evaluate("document.querySelector('#wp-selb').classList.contains('no')")
        assert _sp(page)["found"] == 2
        C.shot(page, "sopa-escritorio", SHOTS, full_page=False)
        # la pista: a los 3 s sin encontrar, brilla la primera letra de una que falta
        page.wait_for_function("() => document.querySelector('.wp-c.hint')", timeout=6000)
        st = _sp(page)
        firsts = [x["cells"][0] for x in ws[2:]]
        assert any(i in firsts for i in st["hint"]), (st["hint"], firsts)
        C.shot(page, "sopa-pista", SHOTS, full_page=False)
        for x in ws[2:]:
            _drag(page, x["cells"][0], x["cells"][-1])
            page.wait_for_timeout(150)
        page.wait_for_selector("#gm-end", timeout=5000)
        best = page.evaluate("JSON.parse(localStorage.getItem('games:best')).sopa")
        assert best["plays"] == 1 and 1 <= best["stars"] <= 3 and best["score"] > 0, best
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_sopa_touch_and_pause_stops_clock():
    """En el celular se marca tocando la primera y la última letra. Con la pausa (Esc) el reloj no corre."""
    page = C.new_page("phone")
    try:
        _open(page, "sopa")
        ws = _sp(page)["words"]
        page.locator(".wp-c").nth(ws[0]["cells"][0]).tap()
        page.locator(".wp-c").nth(ws[0]["cells"][-1]).tap()
        page.wait_for_function("() => +document.querySelector('#gm-sc').textContent === 1", timeout=3000)
        page.wait_for_timeout(1200)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
        a = _sp(page)["clock"]
        page.wait_for_timeout(2300)
        assert _sp(page)["clock"] == a, a
        page.get_by_role("button", name="Seguir").click()
        page.wait_for_timeout(2300)
        assert _sp(page)["clock"] != a
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ------------------------------------------------------------------ crucigrama
def _cw(page):
    return page.evaluate("""() => {
      const r = document.querySelector('#wp-cw'), b = document.querySelector('#wp-board');
      const cell = document.querySelector('.wp-cc').getBoundingClientRect();
      return {words: r.wpWords, cs: cell.width, bsw: b.scrollWidth, bcw: b.clientWidth, solved: +document.querySelector('#gm-sc').textContent,
        hints: +document.querySelector('#wp-hn').textContent, ok: document.querySelectorAll('.wp-cc.ok').length,
        no: document.querySelectorAll('.wp-cc.no').length, hintC: document.querySelectorAll('.wp-cc.hint').length,
        cs_txt: document.querySelector('#wp-cs').textContent, kbBottom: document.querySelector('#wp-kb').getBoundingClientRect().bottom};
    }""")


def _cells(w):
    dr, dc = (0, 1) if w["dir"] == "a" else (1, 0)
    return [(w["r"] + dr * k, w["c"] + dc * k) for k in range(len(w["sol"]))]


def _type_word(page, i, w):
    """elige la palabra i (su pista) y escribe sus letras en las casillas que no están fijas"""
    page.click(f'.wp-clue[data-w="{i}"]')
    for (r, c), ch in zip(_cells(w), w["sol"]):
        cls = page.evaluate(f"document.querySelector('.wp-cc[data-k=\"{r},{c}\"]').className")
        if " ok" in cls or " hint" in cls:
            continue
        page.keyboard.press(ch.lower())


def test_crucigrama_phone_layout_and_real_crossings():
    """En 360 y 390 px: de 5 a 7 palabras cruzadas de verdad (cada una cruza otra y en el cruce la letra es la misma),
    casillas ≥ 30 px, la rejilla nunca se desplaza de lado y el teclado cabe en la pantalla."""
    for w, scheme in ((360, "light"), (390, "dark")):
        page = _page(w, scheme)
        try:
            _open(page, "crucigrama")
            page.wait_for_timeout(500)
            st = _cw(page)
            ws = st["words"]
            assert 5 <= len(ws) <= 7, ws
            assert st["cs"] >= 30, st["cs"]
            assert st["bsw"] <= st["bcw"] + 1, (st["bsw"], st["bcw"])
            assert st["kbBottom"] <= 780, st["kbBottom"]
            assert _no_hscroll(page), "scroll de lado"
            grid = {}
            for x in ws:
                for rc, ch in zip(_cells(x), x["sol"]):
                    assert grid.get(rc, ch) == ch, (rc, ch, grid.get(rc))
                    grid[rc] = ch
            for x in ws:
                mine = set(_cells(x))
                assert any(mine & set(_cells(o)) for o in ws if o is not x), x
            C.shot(page, f"crucigrama-{w}-{scheme}", SHOTS, full_page=False)
            assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()


def test_crucigrama_wrong_hint_touch_and_end():
    """Letras mal: en gris con ✗ un momento y se borran. Bien: la palabra en turquesa y suena con su IPA. «Pista» pone
    una letra (y cuenta). Con el teclado en pantalla también se escribe. Completo: resultado y games:best.crucigrama."""
    page = C.new_page("phone")
    try:
        _open(page, "crucigrama")
        st = _cw(page)
        ws = st["words"]
        w0 = ws[0]
        page.click('.wp-clue[data-w="0"]')
        for ch in w0["sol"]:
            bad = "q" if ch != "Q" else "z"
            page.locator(f'.wp-key[data-l="{bad}"]').tap()
        page.wait_for_timeout(150)
        assert _cw(page)["no"] >= 1, _cw(page)
        C.shot(page, "crucigrama-fallo", SHOTS, full_page=False)
        page.wait_for_function("() => !document.querySelector('.wp-cc.no')", timeout=3000)
        _type_word(page, 0, w0)
        page.wait_for_function("() => +document.querySelector('#gm-sc').textContent >= 1", timeout=3000)
        st = _cw(page)
        assert st["ok"] >= len(w0["sol"]) and st["cs_txt"].startswith("✓"), st
        C.shot(page, "crucigrama-acierto", SHOTS, full_page=False)
        # la pista en la segunda
        page.click('.wp-clue[data-w="1"]')
        page.locator("#wp-hint").tap()
        page.wait_for_timeout(150)
        st = _cw(page)
        assert st["hints"] == 1 and (st["hintC"] == 1 or st["solved"] >= 2), st
        for i, x in enumerate(ws):
            if page.evaluate(f"document.querySelector('.wp-clue[data-w=\"{i}\"]').classList.contains('done')"):
                continue
            _type_word(page, i, x)
            page.wait_for_timeout(120)
        page.wait_for_selector("#gm-end", timeout=5000)
        best = page.evaluate("JSON.parse(localStorage.getItem('games:best')).crucigrama")
        assert best["plays"] == 1 and 1 <= best["stars"] <= 3, best
        C.shot(page, "crucigrama-final", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_crucigrama_and_sopa_desktop_and_languages():
    """En el ordenador el crucigrama lleva la lista de pistas con el español al lado. En francés las rejillas van en
    mayúsculas sin tildes; en danés (comida) la sopa puede llevar Æ Ø Å y las palabras salen en danés."""
    page = C.new_page("desk")
    try:
        _open(page, "crucigrama", "français")
        st = _cw(page)
        assert 3 <= len(st["words"]) <= 7
        assert all(set(x["sol"]) <= set(ABC_EN.upper()) for x in st["words"]), st["words"]
        assert page.evaluate("getComputedStyle(document.querySelector('.wp-clue .ce')).display") != "none"
        C.shot(page, "crucigrama-escritorio-fr", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
    page = C.new_page("desk", color_scheme="dark")
    try:
        _open(page, "sopa", "dansk", "w03")
        st = _sp(page)
        assert all(set(x["s"]) <= set(ABC_EN.upper() + "ÆØÅ") for x in st["words"]), st["words"]
        assert page.evaluate("document.querySelector('.wp-li-w').getAttribute('lang')").startswith("da")
        C.shot(page, "sopa-escritorio-da", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
