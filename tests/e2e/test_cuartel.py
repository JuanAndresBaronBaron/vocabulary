"""«Defensa del cuartel» (js/cuartel.js): la tarjeta en Juegos (solo con el tema «Soldados»), el campo que llena la
pantalla con el soldado y los sacos abajo, los enemigos grandes para tocar en 360 y 390 px, disparar (tocando o con las
teclas 1-3), el cargador de 6 balas, el panel de recarga (los enemigos se paran) con preguntas bien (cargador lleno,
2 balas extra con 3 seguidas, la palabra con su IPA) y mal (✗ gris, la buena se ilumina, solo 2 balas), los corazones
que se pierden cuando un enemigo llega a los sacos, la pausa que lo para todo y el final con récord y monedas.
Capturas del celular (360 y 390 px, claro y oscuro) y del ordenador en capturas/cuartel."""
from __future__ import annotations

import json

try:
    from . import common as C
except ImportError:
    import common as C

SHOTS = C.CAPTURAS / "cuartel"


def _keys(lang="english", topic="militar"):
    k = C.seed_data()
    k["lang"] = lang
    if topic:
        k["games:topic"] = topic
    return {kk: json.dumps(vv, ensure_ascii=False) for kk, vv in k.items()}


def _open(page, lang="english", topic="militar", per=None, speed=None, foe=True):
    """abre el juego (per: enemigos por oleada; speed: más deprisa) y, con foe, espera al primer enemigo"""
    C.seed(page, _keys(lang, topic), "#/juegos")
    if per or speed:
        page.evaluate(f"window.__cuartel = {json.dumps({'per': per or 0, 'speed': speed or 1})}")
    page.wait_for_selector('.gm-card[data-g="cuartel"]:not(.gm-off)', timeout=8000)
    page.click('.gm-card[data-g="cuartel"]')
    page.wait_for_selector("#cu-stage", timeout=8000)
    go = page.locator(".gm-intro .gm-go")
    if go.count():
        go.click()
    page.wait_for_function("() => !document.querySelector('.gm-intro')")
    if foe:
        _wait_foe(page)


def _st(page):
    return page.evaluate("document.querySelector('#cu').cuState()")


def _wait_foe(page, timeout=12000):
    page.wait_for_function("() => { const r = document.querySelector('#cu'); return r && r.cuState && r.cuState().foes.length > 0; }", timeout=timeout)


def _layout(page):
    return page.evaluate("""() => {
      const s = document.querySelector('#cu-stage').getBoundingClientRect(), so = document.querySelector('#cu-sold').getBoundingClientRect();
      const rb = document.querySelector('#cu-rb').getBoundingClientRect(), mg = document.querySelector('#cu-mag').getBoundingClientRect();
      const foes = [...document.querySelectorAll('.cu-foe')].map(f => { const r = f.getBoundingClientRect(); return {w: r.width, h: r.height}; });
      return {top: s.top, bottom: s.bottom, left: s.left, right: s.right, W: s.width, H: s.height, sold: {w: so.width, h: so.height, l: so.left, r: so.right},
        rb: {w: rb.width, h: rb.height, l: rb.left, r: rb.right}, mag: {l: mg.left, r: mg.right}, foes,
        bullets: document.querySelectorAll('#cu-mag i:not(.off)').length, hearts: document.querySelectorAll('#gm-lives i:not(.lost)').length,
        scroll: document.documentElement.scrollWidth > innerWidth + 1};
    }""")


def _tap_foe(page, touch=False):
    """toca (o hace clic en) el enemigo más cercano a los sacos"""
    st = _st(page)
    f = max(st["foes"], key=lambda x: x["p"])
    b = page.evaluate("(() => { const r = document.querySelector('#cu-stage').getBoundingClientRect(); return [r.left, r.top]; })()")
    x, y = b[0] + f["x"], b[1] + f["y"]
    if touch:
        page.touchscreen.tap(x, y)
    else:
        page.mouse.click(x, y)
    return f


def _lane_key(page):
    """dispara con la tecla del camino del enemigo más cercano"""
    f = max(_st(page)["foes"], key=lambda x: x["p"])
    page.keyboard.press(str(f["lane"] + 1))


def _panel(page):
    page.wait_for_selector("#cu-rl:not([hidden]) .cu-op", timeout=4000)


def _answer(page, ok, key=True):
    """contesta la pregunta del panel: bien (ok=True) o mal; con una tecla (1-3) o tocando"""
    i = page.evaluate(f"[...document.querySelectorAll('#cu-rl .cu-op')].findIndex(b => !!b.cuOk === {str(ok).lower()})")
    assert i >= 0
    if key:
        page.keyboard.press(str(i + 1))
    else:
        page.locator("#cu-rl .cu-op").nth(i).click()
    page.wait_for_selector("#cu-go:not([hidden])", timeout=3000)
    return i


def _close_panel(page):
    page.click("#cu-go")
    page.wait_for_selector("#cu-rl[hidden]", state="attached", timeout=3000)


def test_card_locked_and_layout():
    """Sin el tema «Soldados» la tarjeta está apagada con su aviso; con él, se juega. En 360 y 390 px (claro y oscuro)
    el campo llega hasta abajo sin scroll de lado, el soldado mide ≥ 96 px, los enemigos se tocan con ≥ 56 px y de
    cerca miden ≥ 96 px, el cargador (6 balas) y «Recargar» (≥ 56 px) no tapan al soldado. También en el ordenador."""
    page = C.new_page("phone")
    try:
        C.seed(page, _keys("english", None), "#/juegos")
        card = page.locator('.gm-card[data-g="cuartel"]')
        card.wait_for(timeout=8000)
        assert "gm-off" in card.get_attribute("class") and card.get_attribute("aria-disabled") == "true"
        assert "Se activa con el tema Soldados" in card.locator(".gm-lockb").text_content()
        page.wait_for_function("() => document.querySelector('.gm-card[data-g=\"cuartel\"] .gm-ci').naturalWidth > 0", timeout=5000)
        assert page.evaluate("document.querySelector('.gm-card[data-g=\"cuartel\"] .gm-ci').naturalWidth") == 220
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
    for w, scheme in ((360, "dark"), (390, "light")):
        page = C.new_page("phone", color_scheme=scheme)
        try:
            page.set_viewport_size({"width": w, "height": 780})
            _open(page, speed=2.5)
            page.wait_for_function("() => document.querySelector('#cu').cuState().foes.some(f => f.p > .8)", timeout=15000)
            st, ly = _st(page), _layout(page)
            assert 780 - 70 <= ly["bottom"] <= 780, ly
            assert not ly["scroll"], "scroll de lado"
            assert ly["sold"]["w"] >= 96 and st["SW"] >= 96, ly
            assert st["E"] >= 96, st
            assert all(f["w"] >= 56 and f["h"] >= 56 for f in ly["foes"]), ly["foes"]
            assert all(f["w"] >= 56 and f["h"] >= 56 for f in st["foes"]), st["foes"]
            assert ly["rb"]["w"] >= 56 and ly["rb"]["h"] >= 56, ly["rb"]
            assert ly["mag"]["r"] <= ly["sold"]["l"] + 4 and ly["rb"]["l"] >= ly["sold"]["r"] - 4, ly
            assert ly["bullets"] == 6 and ly["hearts"] == 3, ly
            page.wait_for_function("() => document.querySelector('.gm-name img').naturalWidth > 0", timeout=5000)
            assert page.evaluate("document.querySelector('.gm-name img').naturalWidth") == 220
            C.shot(page, f"phone-{w}-{scheme}", SHOTS, full_page=False)
            assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()
    page = C.new_page("desk")
    try:
        _open(page)
        page.wait_for_timeout(1500)
        ly = _layout(page)
        assert ly["W"] >= 600 and ly["H"] >= 500 and not ly["scroll"], ly
        assert all(f["w"] >= 56 for f in ly["foes"]), ly
        C.shot(page, "escritorio", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_shoot_and_reload_questions():
    """Disparar con la tecla del camino neutraliza al enemigo (+1, una bala menos, el trazo de luz). «Recargar» (R) abre
    el panel y los enemigos se paran. Bien: cargador lleno, la palabra con su IPA. Con el cargador vacío el panel sale
    solo; mal: ✗ gris, la buena se ilumina y solo 2 balas, sin sonido triste. 3 bien seguidas: 2 balas extra (8)."""
    page = C.new_page("desk")
    try:
        _open(page)
        _lane_key(page)
        page.wait_for_selector(".cu-tr, .cu-puff", state="attached", timeout=1500)
        page.wait_for_function("() => document.querySelector('#cu').cuState().score === 1", timeout=2000)
        assert _st(page)["mag"] == 5
        assert page.locator("#cu-mag i.off").count() == 1
        assert int(page.text_content("#gm-sc")) == 1
        # «Recargar»: el panel y todo parado
        _wait_foe(page)
        page.keyboard.press("r")
        _panel(page)
        a = _st(page)
        assert a["reloading"] and a["type"] == "say", a
        assert page.locator("#cu-rl .cu-op[lang^='en']").count() == 3
        assert page.locator(".cu-rl-lv").text_content().startswith("Nivel 1")
        page.wait_for_timeout(1200)
        b = _st(page)
        assert a["t"] == b["t"] and [f["p"] for f in a["foes"]] == [f["p"] for f in b["foes"]], (a, b)
        C.shot(page, "panel-pregunta", SHOTS, full_page=False)
        _answer(page, True)
        st = _st(page)
        assert st["mag"] == 6 and st["right"] == 1, st
        assert page.locator("#cu-rl .cu-op.ok").count() == 1 and page.locator("#cu-rl .cu-op.no").count() == 0
        assert page.locator("#cu-fb .ipa").count() == 1 and page.locator("#cu-fb b[lang^='en']").count() == 1
        _close_panel(page)
        assert not _st(page)["reloading"]
        # cargador vacío: el panel sale solo; mal = ✗ gris y solo 2 balas
        _wait_foe(page)
        page.evaluate("document.querySelector('#cu').cuMag(1)")
        _lane_key(page)
        _panel(page)
        assert _st(page)["mag"] == 0
        assert "Sin balas" in page.text_content("#cu-rl-t")
        i = _answer(page, False)
        st = _st(page)
        assert st["mag"] == 2 and st["right"] == 1, st
        ops = page.locator("#cu-rl .cu-op")
        assert "no" in ops.nth(i).get_attribute("class") and page.locator("#cu-rl .cu-op.ok").count() == 1
        bg = page.evaluate(f"getComputedStyle(document.querySelectorAll('#cu-rl .cu-op')[{i}]).backgroundColor")
        assert bg == "rgb(229, 229, 234)", bg
        assert "Era esta" in page.text_content("#cu-fb") and "2 balas" in page.text_content("#cu-fb")
        C.shot(page, "panel-fallo", SHOTS, full_page=False)
        # el panel se cierra solo
        page.wait_for_selector("#cu-rl[hidden]", state="attached", timeout=5000)
        # 3 bien seguidas: 2 balas extra
        for k in range(3):
            page.evaluate("document.querySelector('#cu').cuMag(4)")
            page.keyboard.press("r")
            _panel(page)
            _answer(page, True, key=(k != 1))
            _close_panel(page)
        st = _st(page)
        assert st["mag"] == 8 and st["right"] == 4, st
        assert page.locator("#cu-mag i.bonus:not(.off)").count() == 2
        # «Recargar» con el cargador lleno no abre nada
        page.evaluate("document.querySelector('#cu').cuMag(6)")
        page.keyboard.press("r")
        page.wait_for_timeout(300)
        assert not _st(page)["reloading"]
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_touch_pause_freezes_everything():
    """Tocar un enemigo dispara. Con la pausa (Esc) nada se mueve: ni el reloj, ni los enemigos, ni el panel (que no
    se cierra solo); al seguir, todo sigue."""
    page = C.new_page("phone")
    try:
        _open(page)
        _tap_foe(page, touch=True)
        page.wait_for_function("() => document.querySelector('#cu').cuState().score >= 1", timeout=2000)
        _wait_foe(page)
        page.keyboard.press("Escape")
        page.wait_for_selector("#gm-pause[open]", timeout=3000)
        page.wait_for_timeout(300)
        a = _st(page)
        page.wait_for_timeout(1500)
        b = _st(page)
        assert a["t"] == b["t"] and [f["p"] for f in a["foes"]] == [f["p"] for f in b["foes"]], (a, b)
        assert page.evaluate("document.querySelector('#cu-stage').classList.contains('cu-frozen')")
        page.get_by_role("button", name="Seguir").click()
        page.wait_for_timeout(800)
        assert _st(page)["t"] > b["t"]
        # el panel en pausa: no se cierra solo
        page.evaluate("document.querySelector('#cu').cuMag(3)")
        page.locator("#cu-rb").tap()
        _panel(page)
        _answer(page, True, key=False)
        page.keyboard.press("Escape")
        page.wait_for_selector("#gm-pause[open]", timeout=3000)
        page.wait_for_timeout(3500)
        assert _st(page)["reloading"]
        page.get_by_role("button", name="Seguir").click()
        page.wait_for_selector("#cu-rl[hidden]", state="attached", timeout=4000)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_full_game_to_result():
    """Una partida entera (1 enemigo por oleada, más deprisa): 5 oleadas con su letrero, la radio con la jerga y su
    IPA, «¡Cuartel a salvo!» y el resultado con récord, monedas y las palabras de las preguntas (la fallada, en gris)."""
    page = C.new_page("desk")
    try:
        _open(page, per=1, speed=3, foe=False)
        page.wait_for_selector("#cu-radio.on b[lang^='en']", timeout=4000)
        assert page.locator("#cu-radio .ipa").count() == 1
        assert "Oleada 1 de 5" in page.text_content("#cu-ban")
        asked, over = 0, ""
        todo = {1: True, 3: True}   # una recarga después del 1.º y del 3.º enemigo: la primera mal, la segunda bien
        for _ in range(500):
            if page.locator("#gm-end").count():
                break
            if page.locator(".gm-over").count():
                over = page.text_content(".gm-over")
            st = page.evaluate("(() => { const r = document.querySelector('#cu'); return r && r.cuState ? r.cuState() : null; })()")
            if st is None:
                page.wait_for_timeout(100)
                continue
            if st["reloading"]:
                if page.locator("#cu-go:not([hidden])").count():
                    _close_panel(page)
                else:
                    _answer(page, asked == 1)
                    asked += 1
                continue
            if todo.get(st["score"]) and st["mag"] < 6:
                todo[st["score"]] = False
                page.keyboard.press("r")
                _panel(page)
                continue
            if st["foes"]:
                _lane_key(page)
            page.wait_for_timeout(120)
        assert asked == 2 and "Cuartel a salvo" in over, (asked, over)
        page.wait_for_selector("#gm-end", timeout=8000)
        best = page.evaluate("JSON.parse(localStorage.getItem('games:best')).cuartel")
        assert best["plays"] == 1 and best["score"] == 5 and best["stars"] == 2, best
        assert page.locator(".gm-wc").count() == 2 and page.locator(".gm-wc.gm-miss").count() == 1
        assert "5 enemigos neutralizados" in page.text_content(".gm-end-l")
        C.shot(page, "final", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_lives_lost_and_end():
    """Cada enemigo que llega a los sacos quita un corazón (queda gris, nunca rojo) y la radio dice «Mayday». Sin
    corazones acaba la defensa y sale el resultado."""
    page = C.new_page("phone")
    try:
        _open(page, per=1, speed=7)
        page.wait_for_function("() => document.querySelectorAll('#gm-lives i.lost').length === 1", timeout=10000)
        page.wait_for_selector("#cu-radio.on b:text('Mayday')", timeout=3000)
        col = page.evaluate("getComputedStyle(document.querySelector('#gm-lives i.lost')).color")
        assert col != "rgb(255, 0, 0)" and "255, 59, 48" not in col, col
        assert page.get_attribute("#gm-lives", "aria-label") == "2 vidas"
        C.shot(page, "vida-perdida", SHOTS, full_page=False)
        page.wait_for_selector(".gm-over", timeout=25000)
        assert "Se acabó la defensa" in page.text_content(".gm-over")
        page.wait_for_selector("#gm-end", timeout=6000)
        best = page.evaluate("JSON.parse(localStorage.getItem('games:best')).cuartel")
        assert best["plays"] == 1 and best["score"] == 0 and best["stars"] == 1, best
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_french_danish_and_listen_question():
    """En francés y danés las opciones y la radio están en el idioma (con su lang). La segunda pregunta es de escuchar:
    3 dibujos con su español, y la buena suena. En danés, con «Reducir movimiento»: los enemigos no se balancean."""
    for lang in ("français", "dansk"):
        page = C.new_page("phone", reduced_motion="reduce") if lang == "dansk" else C.new_page("desk")
        try:
            _open(page, lang)
            ab = {"français": "fr", "dansk": "da"}[lang]
            if lang == "dansk":
                assert page.evaluate("getComputedStyle(document.querySelector('.cu-foe .cu-fsvg')).animationName") == "none"
            page.evaluate("document.querySelector('#cu').cuMag(3)")
            page.click("#cu-rb")
            _panel(page)
            assert page.locator(f"#cu-rl .cu-op[lang^='{ab}']").count() == 3
            _answer(page, True, key=False)
            assert page.locator(f"#cu-fb b[lang^='{ab}']").count() == 1
            _close_panel(page)
            assert page.locator(f"#cu-radio b[lang^='{ab}']").count() == 1
            if page.evaluate("'speechSynthesis' in window"):
                page.evaluate("document.querySelector('#cu').cuMag(3)")
                page.click("#cu-rb")
                _panel(page)
                assert _st(page)["type"] == "hear"
                assert page.locator("#cu-rl .cu-ops.pics .cu-op img").count() == 3
                assert page.locator("#cu-say").count() == 1
                if lang == "dansk":
                    C.shot(page, "panel-escucha", SHOTS, full_page=False)
                _answer(page, False, key=False)
                assert page.locator("#cu-rl .cu-op.ok img").count() == 1
            assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()
