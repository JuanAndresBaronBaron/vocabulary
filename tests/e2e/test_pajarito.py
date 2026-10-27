"""«Pajarito volador» (js/flyer.js): la tarjeta en Juegos, la ciudad de cada idioma, elegir la nave, puertas que
llegan, mover el pajarito (toque, flechas, teclas), acertar y fallar, la pausa que para el reloj y el final con récord
y monedas. Con el avión de combate: disparar a la palabra buena (y a una mala = fallo), derribar o chocar con drones,
lanzar ayuda al campamento y bombardear la barricada, con la radio en la jerga del idioma.
Capturas del celular (360 y 390 px) y del ordenador en capturas/pajarito."""
from __future__ import annotations

import json

try:
    from . import common as C
except ImportError:
    import common as C

SHOTS = C.CAPTURAS / "pajarito"
CITY = {"english": "vuelo-en.jpg", "français": "vuelo-fr.jpg", "dansk": "vuelo-da.jpg"}


def _keys(lang="english", topic=None):
    k = C.seed_data()
    k["lang"] = lang
    if topic:
        k["games:topic"] = topic
    return {kk: json.dumps(vv, ensure_ascii=False) for kk, vv in k.items()}


def _open(page, lang="english", veh="bird", topic=None):
    """abre el juego; con veh="jet" (o topic="militar") el tema es «Soldados» y se elige la nave"""
    if veh == "jet" and not topic:
        topic = "militar"
    C.seed(page, _keys(lang, topic), "#/juegos")
    page.wait_for_selector('.gm-card[data-g="pajarito"]', timeout=8000)
    page.click('.gm-card[data-g="pajarito"]')
    page.wait_for_selector("#fl-stage", timeout=8000)
    go = page.locator(".gm-intro .gm-go")
    if go.count():
        go.click()
    page.wait_for_function("() => !document.querySelector('.gm-intro')")
    if topic == "militar":
        page.wait_for_selector("#fl-pick:not([hidden])", timeout=4000)
        page.click(f'.fl-veh[data-veh="{veh}"]')
    page.wait_for_selector(".fl-gate", timeout=6000)


def _state(page):
    return page.evaluate("""() => {
      const s = document.querySelector('#fl-stage'), b = document.querySelector('#fl-bird').getBoundingClientRect();
      const g = [...document.querySelectorAll('.fl-gate')].map(x => { const r = x.getBoundingClientRect(); return {w: x.textContent.trim(), x: r.left + r.width / 2, y: r.bottom, cls: x.className, op: +getComputedStyle(x).opacity}; });
      return {bg: s.style.backgroundImage, h: s.getBoundingClientRect().height, W: s.getBoundingClientRect().width, bird: {x: b.left + b.width / 2, w: b.width},
        gates: g, es: document.querySelector('#fl-es').textContent, sc: +document.querySelector('#gm-sc').textContent,
        lives: document.querySelectorAll('#gm-lives i:not(.lost)').length, scroll: document.documentElement.scrollWidth > innerWidth + 1};
    }""")


def _answer(page):
    """el carril de la palabra buena de la ronda"""
    return page.evaluate("() => [...document.querySelectorAll('.fl-gate')].findIndex(g => g.flOk)")


def test_card_and_cities():
    """La tarjeta sale en Juegos con su dibujo de 220 px; en cada idioma la calle es su ciudad, sin errores ni scroll
    de lado, y las puertas tienen palabras del idioma."""
    for kind in ("phone", "desk"):
        page = C.new_page(kind)
        try:
            for lang, img in CITY.items():
                _open(page, lang)
                page.wait_for_timeout(1200)
                st = _state(page)
                assert img in st["bg"], (lang, st["bg"])
                assert len(st["gates"]) == 3 and all(g["w"] for g in st["gates"]), st["gates"]
                assert not st["scroll"], "scroll de lado"
                assert st["h"] >= 380, st["h"]
                C.shot(page, f"{kind}-{lang}", SHOTS, full_page=False)
            assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()


def test_phone_sizes_big():
    """En 360 y 390 px el pajarito mide ≥ 96 px y la calle llena la pantalla hasta abajo."""
    for w in (360, 390):
        page = C.new_page("phone")
        try:
            page.set_viewport_size({"width": w, "height": 780})
            _open(page)
            page.wait_for_timeout(2500)
            st = _state(page)
            assert st["bird"]["w"] >= 96, st["bird"]
            bottom = page.evaluate("document.querySelector('#fl-stage').getBoundingClientRect().bottom")
            assert 780 - 60 <= bottom <= 780, bottom
            C.shot(page, f"phone-{w}", SHOTS, full_page=False)
        finally:
            page.context.close()


def test_play_right_wrong_and_end():
    """Acertar suma una moneda; fallar quita un corazón; con 3 fallos acaba y sale el resultado con récord."""
    page = C.new_page("desk")
    try:
        _open(page)
        i = _answer(page)
        page.keyboard.press(str(i + 1))
        page.wait_for_function("() => +document.querySelector('#gm-sc').textContent === 1", timeout=9000)
        assert _state(page)["lives"] == 3
        for n in range(3):
            page.wait_for_function("() => document.querySelectorAll('.fl-gate.ok').length === 0", timeout=6000)
            i = _answer(page)
            page.keyboard.press(str((i + 1) % 3 + 1))
            page.wait_for_function(f"() => document.querySelectorAll('#gm-lives i:not(.lost)').length === {2 - n}", timeout=9000)
        page.wait_for_selector("#gm-end", timeout=8000)
        best = page.evaluate("JSON.parse(localStorage.getItem('games:best')).pajarito")
        assert best["score"] == 1 and best["plays"] == 1, best
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_touch_moves_and_pause_stops():
    """Tocar una puerta lleva el pajarito a su carril; las flechas también. Con la pausa las puertas no se mueven."""
    page = C.new_page("phone")
    try:
        _open(page)
        page.wait_for_timeout(600)
        st = _state(page)
        g = st["gates"][0]
        page.click(".fl-gate >> nth=0")
        page.wait_for_timeout(400)
        st2 = _state(page)
        assert st2["bird"]["x"] < st["bird"]["x"] - 40, (st["bird"], st2["bird"])
        page.click("#fl-r")
        page.wait_for_timeout(400)
        assert abs(_state(page)["bird"]["x"] - st["bird"]["x"]) < 4
        page.keyboard.press("Escape")
        page.wait_for_selector("#gm-pause[open]", timeout=4000)
        y1 = _state(page)["gates"][0]["y"]
        page.wait_for_timeout(800)
        assert abs(_state(page)["gates"][0]["y"] - y1) < 1, "con la pausa las puertas siguen"
        page.click("#gm-pz-go")
        page.wait_for_function(f"() => Math.abs(document.querySelector('.fl-gate').getBoundingClientRect().bottom - {y1}) > 2", timeout=4000)
        assert g["w"]
    finally:
        page.context.close()


_JET_STATE = """() => ({lane: null, objs: [...document.querySelectorAll('.fl-obj')].map(o => o.className),
  mp: +document.querySelector('#fl-mp').textContent, radio: document.querySelector('#fl-radio').textContent,
  on: document.querySelector('#fl-radio').classList.contains('on'), acts: !document.querySelector('#fl-acts').hidden,
  jet: document.querySelector('#fl').classList.contains('fl-jet'), veh: localStorage.getItem('flyer:veh')})"""


def test_jet_mission():
    """El avión: botones de misión, la radio dice «Attention!» al empezar; «Fuego» al carril de la palabra buena la
    derriba (+1 moneda); a una mala, fallo; la ayuda al campamento y la bomba a la barricada dan puntos 🎖 y la radio
    contesta en el idioma; la nave elegida se recuerda (solo en este aparato)."""
    for lang, att in (("english", "Attention!"), ("français", "Garde-à-vous"), ("dansk", "Ret!")):
        page = C.new_page("phone")
        try:
            _open(page, lang, "jet")
            st = page.evaluate(_JET_STATE)
            assert st["jet"] and st["acts"] and st["veh"] == '"jet"', st
            assert att in st["radio"], st["radio"]
            if lang != "english":
                continue
            C.shot(page, "phone-jet", SHOTS, full_page=False)
            # derribar la buena: ir a su carril y disparar cuando la fila esté cerca
            i = _answer(page)
            page.keyboard.press(str(i + 1))
            page.wait_for_function("() => [...document.querySelectorAll('.fl-gate')].some(g => g.getBoundingClientRect().top > 0) && document.querySelector('#fl-stage')", timeout=4000)
            page.wait_for_timeout(2600)
            page.click("#fl-fire")
            page.wait_for_function("() => +document.querySelector('#gm-sc').textContent === 1", timeout=3000)
            assert page.locator(".fl-gate.shot.ok").count() == 1
            # esperar a que algo de la acera esté en la zona y soltar lo que toca
            got = 0
            for _ in range(60):
                k = page.evaluate("() => { const o = document.querySelector('.fl-obj.zone'); return o ? (o.classList.contains('camp') ? 'aid' : 'bomb') : ''; }")
                if k:
                    page.click("#fl-aid" if k == "aid" else "#fl-bomb")
                    page.wait_for_function(f"() => +document.querySelector('#fl-mp').textContent > {got}", timeout=3000)
                    got = page.evaluate("+document.querySelector('#fl-mp').textContent")
                    rd = page.evaluate("document.querySelector('#fl-radio').textContent")
                    assert any(w in rd for w in ("Roger", "Copy")), rd
                    if got >= 2:
                        break
                page.wait_for_timeout(150)
            assert got >= 1, "no se pudo entregar ayuda ni bombardear"
            assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()
    page = C.new_page("desk")
    try:
        _open(page, "english", "jet")
        page.wait_for_timeout(300)
        C.shot(page, "desk-jet", SHOTS, full_page=False)
        # disparar a una mala = fallo
        i = _answer(page)
        page.keyboard.press(str((i + 1) % 3 + 1))
        page.wait_for_timeout(2600)
        page.keyboard.press(" ")
        page.wait_for_function("() => document.querySelectorAll('#gm-lives i.lost').length >= 1", timeout=3000)
        assert page.locator(".fl-gate.shot.no").count() == 1
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_topic_words_and_soldiers_apart():
    """El pajarito juega con el tema elegido (Colores: las puertas son colores de data/colores.json) y sin nada de
    soldados (ni elegir nave ni radio). «Misión por radio» solo sale con el tema «Soldados»; ese tema da palabras de la
    jerga del ejército (radio, órdenes, campamento, rangos) también en Memoria."""
    page = C.new_page("phone")
    try:
        _open(page, "english", "bird", "colores")
        words = page.evaluate("[...document.querySelectorAll('.fl-gate b')].map(b => b.textContent)")
        cols = page.evaluate("""async () => { const d = await (await fetch('data/colores.json')).json();
          return d.rows.map(r => r.l && r.l.english && r.l.english.word).filter(Boolean); }""")
        assert all(any(w in c or c.endswith(w) for c in cols) for w in words), (words, cols[:20])
        assert page.locator("#fl-pick:not([hidden])").count() == 0 and page.locator("#fl-acts:not([hidden])").count() == 0
        assert page.evaluate("document.querySelector('#fl-bird svg').getAttribute('viewBox')") == "0 0 120 100"
        C.goto(page, "#/juegos")
        assert page.locator('.gm-card[data-g="soldados"]').is_hidden()
        assert page.locator('.gm-card[data-g="pajarito"]').is_visible()
        # elegir «Soldados» en la hoja de temas: sale «Misión por radio»
        page.click("#gm-tpill")
        page.click('#gm-tp-s [data-tp="militar"]')
        page.wait_for_function("() => !document.getElementById('gm-tp-s').open", timeout=3000)
        assert page.locator('.gm-card[data-g="soldados"]').is_visible()
        page.click('.gm-card[data-g="memoria"]')
        go = page.locator(".gm-intro .gm-go")
        page.wait_for_selector(".gm-intro, .gm-mem, #gm-board", timeout=8000)
        if go.count():
            assert "Soldados" in page.locator(".gm-intro-tp").text_content()
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
