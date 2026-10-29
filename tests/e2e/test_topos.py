"""«Topos» (js/topos.js): la tarjeta en Juegos, el prado que llena la pantalla (2 × 3 en el celular, 3 × 3 en el
ordenador), los topos grandes en 360 y 390 px, el letrero «dicen» con el dibujo y la palabra en español, golpear un
topo bueno (+1, se marea, suena la palabra) y uno malo (✗ gris y lo que era), el cambio a «bien escritos» con faltas
que nunca son palabras del tema, la pausa que para el reloj y el final con récord y monedas.
Capturas del celular (360 y 390 px, claro y oscuro) y del ordenador en capturas/topos."""
from __future__ import annotations

import json

try:
    from . import common as C
except ImportError:
    import common as C

SHOTS = C.CAPTURAS / "topos"


def _keys(lang="english", topic=None):
    k = C.seed_data()
    k["lang"] = lang
    if topic:
        k["games:topic"] = topic
    return {kk: json.dumps(vv, ensure_ascii=False) for kk, vv in k.items()}


def _open(page, lang="english", topic=None, dur=None):
    """abre el juego (con dur, la partida dura esos segundos) y espera al primer topo"""
    C.seed(page, _keys(lang, topic), "#/juegos")
    if dur:
        page.evaluate(f"window.__toposDur = {dur}")
    page.wait_for_selector('.gm-card[data-g="topos"]', timeout=8000)
    page.click('.gm-card[data-g="topos"]')
    page.wait_for_selector("#tp-field", timeout=8000)
    go = page.locator(".gm-intro .gm-go")
    if go.count():
        go.click()
    page.wait_for_function("() => !document.querySelector('.gm-intro')")
    page.wait_for_selector(".tp-cell.up", timeout=6000)


def _state(page):
    return page.evaluate("""() => {
      const f = document.querySelector('#tp-field'), fr = f.getBoundingClientRect();
      const cells = [...f.querySelectorAll('.tp-cell')].filter(c => getComputedStyle(c).display !== 'none');
      const up = cells.filter(c => c.classList.contains('up')).map(c => ({i: +c.dataset.i, ok: !!c.tpOk, w: c.querySelector('.tp-bub b').textContent,
        cls: c.className, bw: c.querySelector('.tp-bub').getBoundingClientRect().width, cw: c.getBoundingClientRect().width}));
      return {n: cells.length, two: f.classList.contains('two'), top: fr.top, bottom: fr.bottom, W: fr.width,
        mole: document.querySelector('.tp-svg').getBoundingClientRect().width, up,
        lab: document.querySelector('#tp-lab').textContent, tg: document.querySelector('#tp-tg').textContent,
        sc: +document.querySelector('#gm-sc').textContent, clock: document.querySelector('#tp-clock').textContent,
        scroll: document.documentElement.scrollWidth > innerWidth + 1};
    }""")


def _wait_up(page, ok, timeout=9000):
    """espera a un topo arriba que sea bueno (ok=True) o malo (ok=False) y devuelve su número"""
    page.wait_for_function(f"() => [...document.querySelectorAll('.tp-cell.up:not(.hit)')].some(c => !!c.tpOk === {str(ok).lower()} && getComputedStyle(c).display !== 'none')",
                           timeout=timeout)
    return page.evaluate(f"() => +[...document.querySelectorAll('.tp-cell.up:not(.hit)')].find(c => !!c.tpOk === {str(ok).lower()}).dataset.i")


def test_card_and_phone_layout():
    """La tarjeta sale en Juegos con su dibujo de 220 px. En 360 y 390 px el prado es de 2 × 3, llega hasta abajo sin
    scroll de lado y el topo mide ≥ 96 px; el bocadillo nunca es más ancho que su agujero. En el ordenador, 3 × 3."""
    for w, scheme in ((360, "dark"), (390, "light")):
        page = C.new_page("phone", color_scheme=scheme)
        try:
            page.set_viewport_size({"width": w, "height": 780})
            _open(page)
            page.wait_for_timeout(1500)
            st = _state(page)
            assert st["two"] and st["n"] == 6, st
            assert st["mole"] >= 96, st["mole"]
            assert 780 - 70 <= st["bottom"] <= 780, st["bottom"]
            assert not st["scroll"], "scroll de lado"
            assert all(u["bw"] <= u["cw"] for u in st["up"]), st["up"]
            assert st["lab"] == "Golpea los topos que dicen:" and st["tg"], st
            img = page.evaluate("document.querySelector('.gm-name img').naturalWidth")
            assert img == 220, img
            C.shot(page, f"phone-{w}-{scheme}", SHOTS, full_page=False)
            assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()
    page = C.new_page("desk")
    try:
        _open(page)
        page.wait_for_timeout(1500)
        st = _state(page)
        assert not st["two"] and st["n"] == 9, st
        assert st["mole"] >= 96, st["mole"]
        C.shot(page, "escritorio", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_hits_rounds_spelling_and_end():
    """Un topo bueno suma y se marea (✓ turquesa); uno malo no suma y enseña lo que era (✗ gris). Con 3 buenos el
    letrero pasa a «bien escritos»: los topos buenos traen palabras del tema y los malos, faltas que no son palabras
    del tema. Al acabar el tiempo sale el resultado con récord (buenos − malos) y monedas."""
    page = C.new_page("desk")
    try:
        _open(page, dur=40)
        words = page.evaluate("() => document.querySelector('#tp').tpWords.map(w => w.normalize('NFC').toLowerCase())")
        es0 = _state(page)["tg"]
        i = _wait_up(page, True)
        page.keyboard.press(str(i + 1))
        page.wait_for_function("() => +document.querySelector('#gm-sc').textContent >= 1", timeout=3000)
        cls = page.evaluate(f"document.querySelector('.tp-cell[data-i=\"{i}\"]').className")
        assert "hit" in cls and "good" in cls, cls
        assert page.evaluate("document.querySelector('#tp-ans').classList.contains('on')")
        i = _wait_up(page, False)
        sc = _state(page)["sc"]
        page.keyboard.press(str(i + 1))
        page.wait_for_timeout(150)
        cell = page.evaluate(f"""() => {{ const c = document.querySelector('.tp-cell[data-i="{i}"]');
          return {{cls: c.className, small: (c.querySelector('.tp-bub small') || {{}}).textContent || ''}}; }}""")
        assert "bad" in cell["cls"] and cell["small"], cell
        assert _state(page)["sc"] == sc
        # dos buenos más: cambia el letrero
        while _state(page)["tg"] == es0:
            i = _wait_up(page, True)
            page.keyboard.press(str(i + 1))
            page.wait_for_timeout(120)
        st = _state(page)
        assert st["lab"] == "Golpea los topos que están:" and st["tg"] == "Bien escritos", st
        page.wait_for_timeout(300)
        seen_bad = set()
        for _ in range(40):
            for u in _state(page)["up"]:
                if "hit" in u["cls"]:
                    continue
                if u["ok"]:
                    assert u["w"].lower() in words, u
                else:
                    assert u["w"].lower() not in words, u
                    seen_bad.add(u["w"])
            if len(seen_bad) >= 3:
                break
            page.wait_for_timeout(250)
        assert len(seen_bad) >= 3, seen_bad
        C.shot(page, "bien-escritos", SHOTS, full_page=False)
        page.wait_for_selector("#gm-end", timeout=45000)
        best = page.evaluate("JSON.parse(localStorage.getItem('games:best')).topos")
        assert best["plays"] == 1 and best["score"] >= 2, best
        C.shot(page, "final", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_touch_and_pause_stops_clock():
    """Tocar un topo bueno lo golpea. Con la pausa (Esc) el reloj no corre y los topos no cambian; al seguir, sigue."""
    page = C.new_page("phone")
    try:
        _open(page)
        i = _wait_up(page, True)
        page.locator(f'.tp-cell[data-i="{i}"]').tap()
        page.wait_for_function("() => +document.querySelector('#gm-sc').textContent >= 1", timeout=3000)
        page.keyboard.press("Escape")
        page.wait_for_timeout(600)
        a = _state(page)
        page.wait_for_timeout(2500)
        b = _state(page)
        assert a["clock"] == b["clock"], (a["clock"], b["clock"])
        assert [u["i"] for u in a["up"]] == [u["i"] for u in b["up"]], (a["up"], b["up"])
        page.get_by_role("button", name="Seguir").click()
        page.wait_for_timeout(2500)
        assert _state(page)["clock"] != b["clock"]
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_other_languages_and_topics():
    """En francés y danés, y con otro tema, los bocadillos traen palabras del idioma y el letrero, el español."""
    for lang, topic in (("français", None), ("dansk", "w03")):
        page = C.new_page("desk")
        try:
            _open(page, lang, topic)
            page.wait_for_timeout(800)
            st = _state(page)
            assert st["up"] and all(u["w"] for u in st["up"]), st
            code = page.evaluate("document.querySelector('.tp-bub').getAttribute('lang')")
            assert code.startswith({"français": "fr", "dansk": "da"}[lang]), code
            assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()
