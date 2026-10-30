"""Los cuatro juegos de js/quiz.js (sección «concursos»): «Concurso» (#/juegos/concurso), «Verdadero o falso»
(#/juegos/verdadero), «Abre la caja» (#/juegos/cajas) y «Une con flechas» (#/juegos/flechas).
Las tarjetas en Juegos (dibujo de 220 px), el juego que llena la pantalla sin scroll de lado en 360 y 390 px (claro y
oscuro) y en el ordenador con los dibujos grandes; aciertos y fallos (✗ gris y la palabra buena con su IPA); los
comodines, el tiempo que se acaba y la pausa del Concurso; deslizar en Verdadero o falso; escribir el número de una
caja; arrastrar, tocar y usar el teclado para unir con flechas; cada partida hasta el resultado (récord en
"games:best") y en francés y danés. Capturas en capturas/quiz."""
from __future__ import annotations

import json

try:
    from . import common as C
except ImportError:
    import common as C

SHOTS = C.CAPTURAS / "quiz"
GAMES = ("concurso", "verdadero", "cajas", "flechas")
MAIN = {"concurso": "#cq-main", "verdadero": "#vf-main", "cajas": "#bx-main", "flechas": "#ar-main"}


def _keys(lang="english", topic=None):
    k = C.seed_data()
    k["lang"] = lang
    if topic:
        k["games:topic"] = topic
    return {kk: json.dumps(vv, ensure_ascii=False) for kk, vv in k.items()}


def _open(page, g, lang="english", topic=None, hooks=None):
    """abre el juego g desde el menú (hooks: JS que se ejecuta antes, p. ej. window.__concursoT = 4) y pasa la
    explicación"""
    C.seed(page, _keys(lang, topic), "#/juegos")
    if hooks:
        page.evaluate(hooks)
    page.wait_for_selector(f'.gm-card[data-g="{g}"]', timeout=8000)
    page.click(f'.gm-card[data-g="{g}"]')
    page.wait_for_selector(".gm.qz", timeout=8000)
    go = page.locator(".gm-intro .gm-go")
    if go.count():
        go.click()
    page.wait_for_function("() => !document.querySelector('.gm-intro')")


def _box(page, sel):
    return page.evaluate("(s) => { const r = document.querySelector(s).getBoundingClientRect(); return {w: r.width, h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right}; }", sel)


def _fit(page, g):
    """el juego llega hasta abajo (sin pasarse) y no hay scroll de lado"""
    return page.evaluate("""(s) => { const r = document.querySelector(s).getBoundingClientRect();
      return {bottom: r.bottom, H: innerHeight, scroll: document.documentElement.scrollWidth > innerWidth + 1,
              down: document.documentElement.scrollHeight > innerHeight + 2}; }""", MAIN[g])


def _min_side(page, sel):
    """el lado más corto del dibujo más pequeño (los dibujos son cuadrados y caben enteros: object-fit: contain)"""
    return page.evaluate("""(s) => Math.min(...[...document.querySelectorAll(s)].filter(e => e.offsetParent !== null)
      .map(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }))""", sel)


def _outside(page):
    """los dibujos que se salen de su ficha (debe ser una lista vacía)"""
    return page.evaluate("""() => [...document.querySelectorAll('.cq-o img, .bx-o img, .ar-p img, .vf-pic img, .bx-pic img, .cq-pic img')]
      .filter(i => i.offsetParent !== null).filter(i => { const r = i.getBoundingClientRect(), b = i.closest('.cq-o, .bx-o, .ar-p, .vf-pic, .bx-pic, .cq-pic').getBoundingClientRect();
        return r.top < b.top - 1 || r.bottom > b.bottom + 1 || r.left < b.left - 1 || r.right > b.right + 1; }).map(i => i.getAttribute('src'))""")


def _best(page, g):
    return page.evaluate(f"(JSON.parse(localStorage.getItem('games:best') || '{{}}'))['{g}'] || null")


# ------------------------------------------------------------------ tarjetas y tamaños
def test_cards_and_layouts():
    """Las cuatro tarjetas salen en Juegos con su dibujo de 220 px. En 360 (oscuro) y 390 px (claro) y en el
    ordenador cada juego llena la pantalla sin scroll de lado ni hacia abajo y con los dibujos grandes."""
    page = C.new_page("desk")
    try:
        C.seed(page, _keys(), "#/juegos")
        page.wait_for_selector('.gm-card[data-g="concurso"]', timeout=8000)
        for g in GAMES:
            img = page.evaluate(f"""() => new Promise(r => {{ const i = document.querySelector('.gm-card[data-g="{g}"] .gm-ci');
              if (i.complete) r(i.naturalWidth); else i.onload = () => r(i.naturalWidth); }})""")
            assert img == 220, (g, img)
        C.shot(page, "menu", SHOTS, full_page=True)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
    sizes = {"concurso": (".cq-o .cq-im img", 110), "verdadero": (".vf-pic img", 150), "cajas": (".bx-svg", 96), "flechas": (".ar-p", 100)}
    for w, scheme in ((360, "dark"), (390, "light")):
        for g in GAMES:
            page = C.new_page("phone", color_scheme=scheme)
            try:
                page.set_viewport_size({"width": w, "height": 780})
                _open(page, g)
                if g == "concurso":
                    # la primera pregunta con respuestas de dibujos (escuchar o palabra → dibujo)
                    for _ in range(10):
                        page.wait_for_selector(".cq-o:not(:disabled)", timeout=6000)
                        if page.evaluate("document.querySelector('#cq').classList.contains('po')"):
                            break
                        page.keyboard.press(str(page.evaluate("document.querySelector('#cq').cqAns") + 1))
                        page.wait_for_selector(".cq-o:disabled", timeout=3000)
                        page.wait_for_selector(".cq-o:not(:disabled)", timeout=6000)
                page.wait_for_timeout(900)
                f = _fit(page, g)
                assert not f["scroll"], (g, w, "scroll de lado")
                assert not f["down"], (g, w, "scroll hacia abajo")
                assert f["H"] - 40 <= f["bottom"] <= f["H"], (g, w, f)
                sel, mn = sizes[g]
                assert _min_side(page, sel) >= mn, (g, w, _min_side(page, sel))
                assert not _outside(page), (g, w, _outside(page))
                C.shot(page, f"{g}-{w}-{scheme}", SHOTS, full_page=False)
                if g == "concurso":
                    # la pista hace crecer el escenario: los dibujos de las respuestas siguen dentro de su ficha
                    page.keyboard.press("9")
                    page.wait_for_timeout(400)
                    assert not _outside(page), (g, w, "pista", _outside(page))
                    assert not _fit(page, g)["down"], (g, w, "pista: scroll hacia abajo")
                assert not C.errors(page), C.errors(page)
            finally:
                page.context.close()
    for g in GAMES:
        page = C.new_page("desk")
        try:
            _open(page, g)
            page.wait_for_timeout(900)
            f = _fit(page, g)
            assert not f["scroll"] and not f["down"], (g, f)
            sel, mn = sizes[g]
            if g == "concurso":
                sel = ".cq-o .cq-im img, .cq-pic"
            assert _min_side(page, sel) >= mn, (g, _min_side(page, sel))
            C.shot(page, f"{g}-escritorio", SHOTS, full_page=False)
            assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()


# ------------------------------------------------------------------ Concurso
def _cq_wait(page, n):
    page.wait_for_function(f"() => document.querySelector('#cq-n').textContent === '{n}/10' && !!document.querySelector('.cq-o:not(:disabled)')", timeout=8000)


def test_concurso_full_game():
    """Acertar suma 100 + rapidez (y la palabra sale con su IPA); los tres comodines (50:50 quita dos, +10 s suma
    tiempo, la pista) se gastan; fallar marca ✗ gris y enseña la buena; con 9 de 10 sale el podio con el primer
    puesto y luego el resultado con el récord."""
    page = C.new_page("desk")
    try:
        _open(page, "concurso")
        _cq_wait(page, 1)
        a = page.evaluate("document.querySelector('#cq').cqAns")
        page.keyboard.press(str(a + 1))
        page.wait_for_function("() => +document.querySelector('#gm-sc').textContent >= 100", timeout=3000)
        st = page.evaluate("""() => ({ok: document.querySelectorAll('.cq-o.ok').length, no: document.querySelectorAll('.cq-o.no').length,
          wd: (document.querySelector('.cq-fb .qz-wd') || {}).textContent || '', ipa: !!document.querySelector('.cq-fb .ipa'),
          sc: +document.querySelector('#gm-sc').textContent})""")
        assert st["ok"] == 1 and st["no"] == 0 and st["wd"] and st["ipa"], st
        assert 100 <= st["sc"] <= 200, st
        C.shot(page, "concurso-acierto", SHOTS, full_page=False)
        _cq_wait(page, 2)
        # los comodines: 50:50, +10 s y la pista
        page.keyboard.press("7")
        page.wait_for_function("() => document.querySelectorAll('.cq-o.cut').length === 2")
        assert page.evaluate("document.querySelector('#cq-opts .cq-o.cut:nth-child(1), #cq-opts .cq-o.cut') !== null")
        assert page.evaluate("document.querySelector('#cq').cqAns") not in page.evaluate("[...document.querySelectorAll('.cq-o.cut')].map(b => +b.dataset.i)")
        s0 = int(page.evaluate("document.querySelector('#cq-s').textContent"))
        page.keyboard.press("8")
        page.wait_for_timeout(150)
        s1 = int(page.evaluate("document.querySelector('#cq-s').textContent"))
        assert s1 >= s0 + 8, (s0, s1)
        page.keyboard.press("9")
        page.wait_for_function("() => document.querySelectorAll('.cq-lf.used').length === 3")
        assert page.evaluate("document.querySelector('#cq-help').childElementCount") >= 1
        page.wait_for_timeout(300)
        assert not _outside(page), _outside(page)
        C.shot(page, "concurso-comodines", SHOTS, full_page=False)
        # un fallo: la elegida en gris con ✗ y la buena en verde azulado
        a = page.evaluate("document.querySelector('#cq').cqAns")
        bad = page.evaluate(f"[...document.querySelectorAll('.cq-o:not(.cut)')].map(b => +b.dataset.i).find(i => i !== {a})")
        sc = int(page.evaluate("document.querySelector('#gm-sc').textContent"))
        page.click(f'.cq-o[data-i="{bad}"]')
        page.wait_for_selector(".cq-o.no", timeout=2000)
        st = page.evaluate("""() => ({ok: [...document.querySelectorAll('.cq-o.ok')].map(b => +b.dataset.i), fb: document.querySelector('#cq-fb').textContent,
          ipa: !!document.querySelector('.cq-fb .ipa'), x: document.querySelector('#cq-x').textContent, mk: getComputedStyle(document.querySelector('.cq-o.no .qz-mk')).backgroundColor})""")
        assert st["ok"] == [a] and "Era" in st["fb"] and st["ipa"] and st["x"] == "×1", st
        assert "142, 142, 147" in st["mk"], st["mk"]   # gris, nunca rojo
        assert int(page.evaluate("document.querySelector('#gm-sc').textContent")) == sc
        C.shot(page, "concurso-fallo", SHOTS, full_page=False)
        # las otras 8 bien (la racha multiplica)
        for n in range(3, 11):
            _cq_wait(page, n)
            page.keyboard.press(str(page.evaluate("document.querySelector('#cq').cqAns") + 1))
        page.wait_for_function("() => document.querySelector('#cq-x').textContent === '×3'", timeout=3000)
        page.wait_for_selector("#cq-pod", timeout=6000)
        page.wait_for_timeout(1300)
        pod = page.evaluate("""() => ({t: document.querySelector('#cq-pod-t').textContent, n: +document.querySelector('#cq-pod-n').textContent,
          sc: document.querySelector('#cq').cqScore, me: !!document.querySelector('.cq-step.s1 .cq-me')})""")
        assert pod["t"] == "¡Primer puesto!" and pod["me"] and pod["n"] == pod["sc"] > 2000, pod
        C.shot(page, "concurso-podio", SHOTS, full_page=False)
        page.click("#cq-pod-go")
        page.wait_for_selector("#gm-end", timeout=4000)
        best = _best(page, "concurso")
        assert best["plays"] == 1 and best["score"] == pod["sc"] and best["stars"] == 3, best
        C.shot(page, "concurso-final", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_concurso_phone_question_with_picture_timeout_and_pause():
    """En el celular, la pregunta dibujo → palabra lleva el dibujo grande. Con la pausa (Esc) el tiempo no corre; al
    acabarse el tiempo sale «¡Tiempo!» con la buena y la racha vuelve a ×1."""
    page = C.new_page("phone")
    try:
        page.set_viewport_size({"width": 360, "height": 740})
        _open(page, "concurso", hooks="window.__concursoT = 5")
        for _ in range(10):
            _cq_wait(page, page.evaluate("+document.querySelector('#cq-n').textContent.split('/')[0]"))
            if page.evaluate("!!document.querySelector('.cq-pic')"):
                break
            a = page.evaluate("document.querySelector('#cq').cqAns")
            page.click(f'.cq-o[data-i="{a}"]')
            page.wait_for_selector(".cq-o:disabled", timeout=3000)
            page.wait_for_function("() => !document.querySelector('.cq-o:disabled')", timeout=6000)
        page.wait_for_timeout(400)
        assert _min_side(page, ".cq-pic") >= 120, _min_side(page, ".cq-pic")
        f = _fit(page, "concurso")
        assert not f["scroll"] and not f["down"], f
        C.shot(page, "concurso-dibujo-360", SHOTS, full_page=False)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
        a = page.evaluate("document.querySelector('#cq-tb').style.transform")
        page.wait_for_timeout(1500)
        assert page.evaluate("document.querySelector('#cq-tb').style.transform") == a
        page.get_by_role("button", name="Seguir").click()
        page.wait_for_function("() => document.querySelector('#cq-fb').textContent.includes('¡Tiempo!')", timeout=8000)
        assert page.evaluate("document.querySelectorAll('.cq-o.ok').length") == 1
        assert page.evaluate("document.querySelector('#cq-x').textContent") == "×1"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ------------------------------------------------------------------ Verdadero o falso
def _vf_new(page):
    page.wait_for_function("() => { const c = document.querySelector('#vf-card'); return !c.classList.contains('good') && !c.classList.contains('bad') && !!c.querySelector('.vf-pic img'); }", timeout=5000)
    return page.evaluate("document.querySelector('#vf-card').vfOk")


def test_verdadero_game():
    """Con las teclas → / ← (y V / F) se contesta; acertar suma y se ve la racha; fallar pone la tarjeta en gris con ✗
    y la palabra buena con su IPA; deslizar la tarjeta a la derecha es «verdadero». Al acabar el tiempo, el resultado."""
    page = C.new_page("desk")
    try:
        _open(page, "verdadero", hooks="window.__verdaderoDur = 16")
        ok = _vf_new(page)
        page.keyboard.press("ArrowRight" if ok else "ArrowLeft")
        page.wait_for_function("() => +document.querySelector('#gm-sc').textContent === 1", timeout=2000)
        assert "good" in page.evaluate("document.querySelector('#vf-card').className")
        ok = _vf_new(page)
        page.keyboard.press("f" if ok else "v")
        page.wait_for_selector("#vf-card.bad", timeout=2000)
        st = page.evaluate("""() => ({sc: +document.querySelector('#gm-sc').textContent, ans: document.querySelector('#vf-ans').textContent,
          ipa: !!document.querySelector('#vf-ans .ipa'), wd: !!document.querySelector('#vf-ans .qz-wd'),
          stamp: getComputedStyle(document.querySelector('.vf-stamp')).backgroundColor, strike: document.querySelector('#vf-w').classList.contains('strike')})""")
        assert st["sc"] == 1 and "era" in st["ans"].lower() and st["ipa"] and st["wd"], st
        assert "142, 142, 147" in st["stamp"], st["stamp"]
        assert st["strike"] == (not ok), st
        C.shot(page, "verdadero-fallo", SHOTS, full_page=False)
        # deslizar con el ratón: a la derecha es «verdadero»
        ok = _vf_new(page)
        b = _box(page, "#vf-card")
        x, y = b["left"] + b["w"] / 2, b["top"] + b["h"] / 2
        page.mouse.move(x, y)
        page.mouse.down()
        for k in range(1, 9):
            page.mouse.move(x + k * 30, y + 2)
            page.wait_for_timeout(16)
        page.mouse.up()
        page.wait_for_function("() => /good|bad/.test(document.querySelector('#vf-card').className)", timeout=2000)
        assert ("good" if ok else "bad") in page.evaluate("document.querySelector('#vf-card').className")
        # el resto, bien, hasta el final
        for _ in range(30):
            if page.evaluate("!!document.querySelector('#gm-end, .gm-over')"):
                break
            try:
                ok = _vf_new(page)
            except Exception:
                continue
            page.keyboard.press("v" if ok else "f")
        page.wait_for_selector("#gm-end", timeout=20000)
        best = _best(page, "verdadero")
        assert best["plays"] == 1 and best["score"] >= 4, best
        C.shot(page, "verdadero-final", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_verdadero_pause_and_buttons():
    """En el celular se contesta con los botones grandes; con la pausa el reloj no corre."""
    page = C.new_page("phone", color_scheme="dark")
    try:
        _open(page, "verdadero")
        ok = _vf_new(page)
        page.click("#vf-yes" if ok else "#vf-no")
        page.wait_for_function("() => +document.querySelector('#gm-sc').textContent === 1", timeout=2000)
        C.shot(page, "verdadero-acierto-oscuro", SHOTS, full_page=False)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
        a = page.evaluate("document.querySelector('#vf-clock').textContent")
        page.wait_for_timeout(2200)
        assert page.evaluate("document.querySelector('#vf-clock').textContent") == a
        page.get_by_role("button", name="Seguir").click()
        page.wait_for_timeout(2200)
        assert page.evaluate("document.querySelector('#vf-clock').textContent") != a
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ------------------------------------------------------------------ Abre la caja
def _bx_answer(page, right=True):
    """contesta la pregunta de la caja abierta (o cierra la sorpresa); devuelve 'q' o 's'"""
    page.wait_for_selector("#bx-pop:not([hidden])", timeout=4000)
    if page.evaluate("!!document.querySelector('#bx-pop .bx-o')"):
        a = page.evaluate("document.querySelector('#bx').bxAns")
        i = a if right else (a + 1) % 3
        page.click(f'#bx-pop .bx-o[data-i="{i}"]')
        page.wait_for_selector("#bx-go:not([hidden])", timeout=2000)
        kind = "q"
    else:
        kind = "s"
    page.click("#bx-go")
    page.wait_for_selector("#bx-pop", state="hidden", timeout=2000)
    return kind


def test_cajas_game():
    """Tocar una caja la abre (pregunta o sorpresa); acertar suma y dice la palabra con su IPA; fallar, ✗ gris y la
    buena. Escribir 1 y 1 abre la caja 11. Se abren las 12 (hay 3 sorpresas) y sale el resultado con el récord."""
    page = C.new_page("phone")
    try:
        _open(page, "cajas")
        opened, kinds, shot_q, shot_s, wrong_done = set(), [], False, False, False
        # escribir el número: 1 y 1 → la caja 11
        page.keyboard.press("1")
        page.keyboard.press("1")
        page.wait_for_selector("#bx-pop:not([hidden])", timeout=3000)
        assert page.evaluate("document.querySelector('#bx').bxCur") == 11
        for n in [11] + [k for k in range(1, 13) if k != 11]:
            if n != 11:
                page.click(f'.bx-b[data-n="{n}"]')
            page.wait_for_selector("#bx-pop:not([hidden])", timeout=3000)
            q = page.evaluate("!!document.querySelector('#bx-pop .bx-o')")
            if q:
                a = page.evaluate("document.querySelector('#bx').bxAns")
                right = wrong_done
                i = a if right else (a + 1) % 3
                sc = int(page.evaluate("document.querySelector('#gm-sc').textContent"))
                assert not _outside(page), _outside(page)
                if not shot_q and right:
                    C.shot(page, "cajas-pregunta", SHOTS, full_page=False)
                page.click(f'#bx-pop .bx-o[data-i="{i}"]')
                page.wait_for_selector("#bx-go:not([hidden])", timeout=2000)
                st = page.evaluate("""() => ({ok: document.querySelectorAll('#bx-pop .bx-o.ok').length, no: document.querySelectorAll('#bx-pop .bx-o.no').length,
                  ipa: !!document.querySelector('#bx-fb .ipa'), fb: document.querySelector('#bx-fb').textContent, sc: +document.querySelector('#gm-sc').textContent})""")
                assert st["ok"] == 1 and st["ipa"], st
                if right:
                    assert st["no"] == 0 and st["sc"] > sc, st
                    if not shot_q:
                        C.shot(page, "cajas-acierto", SHOTS, full_page=False)
                        shot_q = True
                else:
                    assert st["no"] == 1 and st["sc"] == sc and "Era" in st["fb"], st
                    C.shot(page, "cajas-fallo", SHOTS, full_page=False)
                    wrong_done = True
                kinds.append("q")
            else:
                if not shot_s:
                    C.shot(page, "cajas-sorpresa", SHOTS, full_page=False)
                    shot_s = True
                kinds.append("s")
            page.click("#bx-go")
            page.wait_for_selector("#bx-pop", state="hidden", timeout=2000)
            opened.add(n)
            assert page.evaluate(f"document.querySelector('.bx-b[data-n=\"{n}\"]').classList.contains('open')")
            if len(opened) == 6:
                C.shot(page, "cajas-mitad", SHOTS, full_page=False)
        assert kinds.count("s") == 3 and kinds.count("q") == 9, kinds
        page.wait_for_selector("#gm-end", timeout=5000)
        best = _best(page, "cajas")
        assert best["plays"] == 1 and best["score"] >= 8, best
        C.shot(page, "cajas-final", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ------------------------------------------------------------------ Une con flechas
def _center(page, sel):
    b = _box(page, sel)
    return b["left"] + b["w"] / 2, b["top"] + b["h"] / 2


def test_flechas_game():
    """Ronda 1: una línea arrastrando, dos tocando (mal a propósito: cruzadas), una tocando y una con el teclado.
    «Comprobar» pinta las buenas de verde azulado y las malas en gris con ✗; las malas se rehacen. Las rondas 2 y 3,
    bien a la primera. El resultado guarda el récord (2 por cada una a la primera y 1 por las arregladas)."""
    page = C.new_page("desk")
    try:
        _open(page, "flechas")
        page.wait_for_selector('.ar-p[data-i="4"]')
        # arrastrar: dibujo 0 → palabra 0
        x0, y0 = _center(page, '.ar-p[data-i="0"]')
        x1, y1 = _center(page, '.ar-w[data-i="0"]')
        page.mouse.move(x0, y0)
        page.mouse.down()
        for k in range(1, 11):
            page.mouse.move(x0 + (x1 - x0) * k / 10, y0 + (y1 - y0) * k / 10)
            page.wait_for_timeout(16)
        page.mouse.up()
        page.wait_for_function("() => document.querySelectorAll('#ar-svg line').length === 1")
        # tocar: dibujo 1 → palabra 2 y dibujo 2 → palabra 1 (mal), dibujo 4 → palabra 4 (bien)
        for p, w in ((1, 2), (2, 1), (4, 4)):
            page.click(f'.ar-p[data-i="{p}"]')
            page.click(f'.ar-w[data-i="{w}"]')
        page.wait_for_function("() => document.querySelectorAll('#ar-svg line').length === 4")
        assert page.evaluate("document.querySelector('#ar-chk').disabled")
        # el teclado: el dibujo 3, Enter, → y ↑ / ↓ hasta la palabra 3, Enter
        page.evaluate("document.querySelector('.ar-p[data-i=\"3\"]').focus()")
        page.keyboard.press("Enter")
        page.keyboard.press("ArrowRight")
        order = page.evaluate("[...document.querySelectorAll('.ar-w')].map(t => +t.dataset.i)")
        at = page.evaluate("+document.activeElement.dataset.i")
        k, j = order.index(at), order.index(3)
        for _ in range(abs(j - k)):
            page.keyboard.press("ArrowDown" if j > k else "ArrowUp")
        assert page.evaluate("+document.activeElement.dataset.i") == 3
        page.keyboard.press("Enter")
        page.wait_for_function("() => document.querySelectorAll('#ar-svg line').length === 5 && !document.querySelector('#ar-chk').disabled")
        C.shot(page, "flechas-lineas", SHOTS, full_page=False)
        page.click("#ar-chk")
        page.wait_for_selector(".ar-p.bad", timeout=2000)
        st = page.evaluate("""() => ({good: [...document.querySelectorAll('.ar-p.good')].map(t => +t.dataset.i).sort(), bad: [...document.querySelectorAll('.ar-p.bad')].map(t => +t.dataset.i).sort(),
          lnBad: document.querySelectorAll('#ar-svg line.bad').length, lnGood: document.querySelectorAll('#ar-svg line.good').length,
          ipa: [...document.querySelectorAll('.ar-w.good .ipa')].filter(e => getComputedStyle(e).display !== 'none').length,
          sc: +document.querySelector('#gm-sc').textContent, stroke: getComputedStyle(document.querySelector('#ar-svg line.bad')).stroke})""")
        assert st["good"] == [0, 3, 4] and st["bad"] == [1, 2] and st["lnBad"] == 2 and st["lnGood"] == 3, st
        assert st["ipa"] == 3 and st["sc"] == 6, st
        assert "142, 142, 147" in st["stroke"], st["stroke"]
        C.shot(page, "flechas-comprobar", SHOTS, full_page=False)
        # las malas se quitan y se rehacen
        page.wait_for_function("() => document.querySelectorAll('#ar-svg line').length === 3 && !document.querySelector('.ar-p.bad')", timeout=4000)
        page.click('.ar-p[data-i="0"]')   # una buena ya no se puede mover
        assert not page.evaluate("document.querySelector('.ar-p[data-i=\"0\"]').classList.contains('sel')")
        for p in (1, 2):
            page.click(f'.ar-w[data-i="{p}"]')
            page.click(f'.ar-p[data-i="{p}"]')
        page.click("#ar-chk")
        page.wait_for_function("() => document.querySelector('#ar-rd').textContent === '2/3'", timeout=5000)
        assert page.evaluate("+document.querySelector('#gm-sc').textContent") == 8
        for r in (2, 3):
            page.wait_for_selector('.ar-p[data-i="4"]:not(.good)')
            for p in range(5):
                page.click(f'.ar-p[data-i="{p}"]')
                page.click(f'.ar-w[data-i="{p}"]')
            page.click("#ar-chk")
            if r == 2:
                page.wait_for_function("() => document.querySelector('#ar-rd').textContent === '3/3'", timeout=5000)
        page.wait_for_selector("#gm-end", timeout=5000)
        best = _best(page, "flechas")
        assert best["plays"] == 1 and best["score"] == 28 and best["stars"] == 3, best
        C.shot(page, "flechas-final", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_flechas_phone_drag_lines():
    """En el celular (360) las dos columnas caben con fichas grandes y las líneas se dibujan encima, también con una
    pareja mal hecha en oscuro."""
    page = C.new_page("phone", color_scheme="dark")
    try:
        page.set_viewport_size({"width": 360, "height": 740})
        _open(page, "flechas")
        page.wait_for_selector('.ar-p[data-i="4"]')
        for p, w in ((0, 1), (1, 0), (2, 2), (3, 3), (4, 4)):
            page.locator(f'.ar-p[data-i="{p}"]').tap()
            page.locator(f'.ar-w[data-i="{w}"]').tap()
        page.wait_for_function("() => document.querySelectorAll('#ar-svg line').length === 5")
        assert _min_side(page, ".ar-p") >= 96, _min_side(page, ".ar-p")
        f = _fit(page, "flechas")
        assert not f["scroll"] and not f["down"], f
        page.locator("#ar-chk").tap()
        page.wait_for_selector(".ar-p.bad", timeout=2000)
        C.shot(page, "flechas-360-oscuro-comprobar", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ------------------------------------------------------------------ otros idiomas
def test_other_languages_and_topics():
    """En francés (Animales) y en danés (otro tema), los cuatro juegos traen palabras del idioma con su lang."""
    for lang, topic in (("français", None), ("dansk", "w03")):
        pre = {"français": "fr", "dansk": "da"}[lang]
        for g in GAMES:
            page = C.new_page("desk")
            try:
                _open(page, g, lang, topic)
                if g == "concurso":
                    _cq_wait(page, 1)
                    page.keyboard.press(str(page.evaluate("document.querySelector('#cq').cqAns") + 1))
                    page.wait_for_selector(".cq-fb .qz-wd", timeout=3000)
                    code = page.evaluate("document.querySelector('.cq-fb .qz-wd').getAttribute('lang')")
                elif g == "verdadero":
                    _vf_new(page)
                    code = page.evaluate("document.querySelector('#vf-w').getAttribute('lang')")
                    assert page.evaluate("document.querySelector('#vf-w').textContent.trim().length") > 0
                elif g == "cajas":
                    for n in range(1, 13):
                        page.click(f'.bx-b[data-n="{n}"]')
                        page.wait_for_selector("#bx-pop:not([hidden])", timeout=3000)
                        if page.evaluate("!!document.querySelector('#bx-pop [lang]')"):
                            break
                        page.click("#bx-go")
                        page.wait_for_selector("#bx-pop", state="hidden", timeout=2000)
                    code = page.evaluate("document.querySelector('#bx-pop [lang]').getAttribute('lang')")
                else:
                    page.wait_for_selector(".ar-w")
                    code = page.evaluate("document.querySelector('.ar-w').getAttribute('lang')")
                assert code.startswith(pre), (lang, g, code)
                if g == "flechas" and lang == "dansk":
                    C.shot(page, "flechas-dansk", SHOTS, full_page=False)
                assert not C.errors(page), (lang, g, C.errors(page))
            finally:
                page.context.close()
