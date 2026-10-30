"""Los tres juegos de gramática (js/grammargames.js): «Ordena la frase», «Completa la frase» (el tren) y «Detective de
errores». Las tarjetas en Juegos, el nivel A1-C2 (recordado por idioma en "gram:lv"), la pastilla con el título de la
unidad, aciertos (turquesa, suena la frase) y fallos (gris con ✗, la buena iluminada, el porqué y el español), una
partida entera hasta el resultado con "games:best", la pausa que para el «siguiente» automático, francés y danés.
Capturas del celular (360 y 390 px, claro y oscuro) y del ordenador en capturas/gramatica."""
from __future__ import annotations

import json
import re

try:
    from . import common as C
except ImportError:
    import common as C

SHOTS = C.CAPTURAS / "gramatica"
GAMES = ("ordenafrase", "completa", "detective")
CODE = {"english": "en", "français": "fr", "dansk": "da"}


def _keys(lang="english", lv=None):
    k = C.seed_data()
    k["lang"] = lang
    if lv:
        k["gram:lv"] = lv
    return {kk: json.dumps(vv, ensure_ascii=False) for kk, vv in k.items()}


def _open(page, gid, lang="english", lv=None, shot=None):
    """abre el juego desde su tarjeta, pasa la explicación (con shot, antes la captura) y espera a la primera pregunta"""
    C.seed(page, _keys(lang, lv), "#/juegos")
    page.wait_for_selector(f'.gm-card[data-g="{gid}"]', timeout=8000)
    page.click(f'.gm-card[data-g="{gid}"]')
    page.wait_for_selector("#gg .gg-chips", timeout=8000)
    go = page.locator(".gm-intro .gm-go")
    if go.count():
        if shot:
            assert "Gramática" in page.evaluate("document.querySelector('.gm-intro-tp').textContent")
            C.shot(page, shot, SHOTS, full_page=False)
        go.click()
    page.wait_for_function("() => !document.querySelector('.gm-intro')")
    # la voz: se apunta lo que se diría (say() de index.html)
    page.evaluate("() => { window.__said = []; window.say = t => { window.__said.push(String(t)); }; }")


def _letters(s):
    """solo las letras y los números (para comparar lo que se dice con lo que se ve)"""
    return re.sub(r"[\W_]", "", s or "").lower()


def _n(page):
    return int(page.evaluate("+document.querySelector('#gg-n').textContent"))


def _layout(page):
    return page.evaluate("""() => {
      const r = s => { const e = document.querySelector(s); if(!e) return null; const b = e.getBoundingClientRect(); return {w: b.width, h: b.height, l: b.left, r: b.right, t: b.top, b: b.bottom}; };
      const all = s => [...document.querySelectorAll(s)].map(e => { const b = e.getBoundingClientRect(); return {w: b.width, h: b.h || b.height, l: b.left, r: b.right}; });
      return {W: innerWidth, H: innerHeight, scroll: document.documentElement.scrollWidth > innerWidth + 1,
        lv: [...document.querySelectorAll('#gg-lv [role=radio]')].map(b => [b.textContent, b.getAttribute('aria-checked')]),
        lvShown: !!document.querySelector('#gg-lv') && !document.querySelector('#gg-lv').hidden,
        chip: (document.querySelector('.gg-chips .gg-chip:last-child') || {}).textContent || '',
        card: r('.gg-card'), loco: r('.gg-loco-svg'), lens: r('.gg-lens-svg'), wide: Math.max(0, ...[...document.querySelectorAll('#gg *')].map(e => e.getBoundingClientRect().right)),
        tiles: all('.gg-pool .gg-pc'), slots: all('.gg-slot'), ops: all('.gg-op'), notes: all('.gg-nt'), wagons: all('.gg-wb')};
    }""")


def _card_img(page, gid):
    return page.evaluate(f"() => {{ const i = document.querySelector('.gm-card[data-g=\"{gid}\"] img'); return i ? i.naturalWidth : 0; }}")


# ---------------------------------------------------------------- Ordena: resolver
def _solve_ordena(page, kbd=False):
    """pone las piezas en orden (tocándolas o con sus números) y pulsa Comprobar"""
    ans = page.evaluate("() => document.querySelector('#gg').ggAns")
    for k, w in enumerate(ans):
        if page.evaluate(f"() => document.querySelectorAll('.gg-slot')[{k}].textContent") == w:
            continue
        i = page.evaluate("""(w) => { const t = [...document.querySelectorAll('.gg-pool .gg-pc')].find(e => e.ggW === w && !e.classList.contains('used'));
          return t ? +t.dataset.t : -1; }""", w)
        assert i >= 0, (w, ans)
        if kbd:
            page.keyboard.press(str(i + 1))
        else:
            page.locator(f'.gg-pool .gg-pc[data-t="{i}"]').click()
    if kbd:
        page.keyboard.press("Enter")
    else:
        page.click("#gg-chk")


def _next(page):
    n = _n(page)
    page.click("#gg-next")
    page.wait_for_function(f"() => document.querySelector('#gm-end') || +document.querySelector('#gg-n').textContent === {n + 1}", timeout=5000)


def _pick(page, sel, ok):
    """toca la opción buena (ok=True) o una mala de las opciones (sel: .gg-op o .gg-nt)"""
    i = page.evaluate(f"() => [...document.querySelectorAll('{sel}')].findIndex(b => !!b.ggOk === {str(ok).lower()})")
    assert i >= 0
    page.locator(sel).nth(i).click()
    return i


def test_cards_and_phone_layout():
    """Las tres tarjetas salen en Juegos con su dibujo de 220 px. En 360 y 390 px (claro y oscuro) cada juego cabe sin
    scroll de lado, con la fila del nivel (A1 elegido), la pastilla de la unidad y piezas, opciones y dibujos grandes."""
    for w, scheme in ((360, "dark"), (390, "light")):
        page = C.new_page("phone", color_scheme=scheme)
        try:
            page.set_viewport_size({"width": w, "height": 780})
            C.seed(page, _keys(), "#/juegos")
            page.wait_for_selector('.gm-card[data-g="detective"]', timeout=8000)
            for g in GAMES:
                assert _card_img(page, g) == 220, g
            for g in GAMES:
                _open(page, g, shot=f"{g}-intro" if w == 390 else None)
                page.wait_for_timeout(900)
                st = _layout(page)
                assert not st["scroll"] and st["wide"] <= st["W"] + 1, (g, st["wide"], st["W"])
                assert st["lvShown"] and ["A1", "true"] in st["lv"] and len(st["lv"]) == 6, st["lv"]
                assert st["chip"].strip(), st
                if g == "ordenafrase":
                    assert st["tiles"] and min(t["h"] for t in st["tiles"]) >= 48, st["tiles"]
                    assert all(t["r"] <= st["W"] for t in st["tiles"] + st["slots"]), st
                if g == "completa":
                    assert st["loco"]["w"] >= 84, st["loco"]
                    assert len(st["ops"]) == 3 and min(o["h"] for o in st["ops"]) >= 60, st["ops"]
                    assert all(x["r"] <= st["W"] for x in st["wagons"]), st["wagons"]
                if g == "detective":
                    assert st["lens"]["w"] >= 72, st["lens"]
                    assert len(st["notes"]) == 3 and min(o["h"] for o in st["notes"]) >= 56, st["notes"]
                C.shot(page, f"{g}-{w}-{scheme}", SHOTS, full_page=False)
                assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()
    page = C.new_page("desk")
    try:
        for g in GAMES:
            _open(page, g)
            page.wait_for_timeout(900)
            st = _layout(page)
            assert not st["scroll"], g
            C.shot(page, f"{g}-escritorio", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_ordena_wrong_right_drag_and_full_game():
    """Ordena: en el orden revuelto, Comprobar pone las mal puestas en gris con ✗ (las buenas se quedan en turquesa) y
    da otra oportunidad; bien a la segunda no suma. Se puede arrastrar una pieza a un hueco. Con el teclado (números y
    Enter) se juega igual. Al acabar: récord con las de a la primera y 3 estrellas con 7 de 8."""
    page = C.new_page("desk")
    try:
        _open(page, "ordenafrase")
        # en el orden de abajo (revuelto, nunca igual que la frase): mal
        n = page.evaluate("document.querySelectorAll('.gg-pool .gg-pc').length")
        for i in range(n):
            page.locator(f'.gg-pool .gg-pc[data-t="{i}"]').click()
        page.click("#gg-chk")
        page.wait_for_selector(".gg-slot.wrong", timeout=2000)
        st = page.evaluate("""() => ({wrong: document.querySelectorAll('.gg-slot.wrong').length, fb: document.querySelector('#gg-fbw').textContent,
          lv: document.querySelector('#gg-lv').hidden, chip: document.querySelector('.gg-chip.lv') && document.querySelector('.gg-chip.lv').textContent})""")
        assert st["wrong"] >= 1 and "Casi" in st["fb"], st
        assert st["lv"] and st["chip"] == "Nivel A1", st
        C.shot(page, "ordena-fallo", SHOTS, full_page=False)
        page.wait_for_function("() => !document.querySelector('.gg-slot.wrong') && [...document.querySelectorAll('.gg-slot')].some(s => !s.textContent)", timeout=3000)
        # las piezas que quedan, una arrastrada con el ratón hasta su hueco
        ans = page.evaluate("() => document.querySelector('#gg').ggAns")
        k = page.evaluate("() => [...document.querySelectorAll('.gg-slot')].findIndex(s => !s.textContent)")
        i = page.evaluate("(w) => +[...document.querySelectorAll('.gg-pool .gg-pc')].find(e => e.ggW === w && !e.classList.contains('used')).dataset.t", ans[k])
        a = page.locator(f'.gg-pool .gg-pc[data-t="{i}"]').bounding_box()
        b = page.locator(".gg-slot").nth(k).bounding_box()
        page.mouse.move(a["x"] + a["width"] / 2, a["y"] + a["height"] / 2)
        page.mouse.down()
        for s in range(1, 13):
            page.mouse.move(a["x"] + a["width"] / 2 + (b["x"] + b["width"] / 2 - a["x"] - a["width"] / 2) * s / 12,
                            a["y"] + a["height"] / 2 + (b["y"] + b["height"] / 2 - a["y"] - a["height"] / 2) * s / 12)
            page.wait_for_timeout(16)
        page.mouse.up()
        page.wait_for_timeout(200)
        assert page.evaluate(f"() => document.querySelectorAll('.gg-slot')[{k}].textContent") == ans[k]
        _solve_ordena(page)
        page.wait_for_selector(".gg-slot.win", timeout=2000)
        assert page.evaluate("+document.querySelector('#gm-sc').textContent") == 0
        said = page.evaluate("window.__said")
        assert said and _letters(said[-1]) == _letters("".join(ans)), (said, ans)
        assert page.evaluate("(document.querySelector('.gg-fb-why') || {}).textContent || ''"), "falta el resumen de la unidad"
        C.shot(page, "ordena-bien", SHOTS, full_page=False)
        _next(page)
        # el resto, a la primera (la mitad con el teclado)
        for q in range(7):
            _solve_ordena(page, kbd=q % 2 == 0)
            page.wait_for_selector(".gg-slot.win", timeout=2000)
            if q < 6:
                _next(page)
            else:
                page.click("#gg-next")
        page.wait_for_selector("#gm-end", timeout=6000)
        best = page.evaluate("JSON.parse(localStorage.getItem('games:best')).ordenafrase")
        assert best["score"] == 7 and best["stars"] == 3 and best["plays"] == 1, best
        assert page.evaluate("document.querySelectorAll('.gm-wc').length") == 8
        C.shot(page, "ordena-final", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_completa_train_and_full_game():
    """Completa: una opción mala sale gris con ✗, la buena se ilumina, el vagón se llena con ella y salen el porqué y el
    español (sin seguir solo). La buena (tecla 1-3): el vagón en turquesa, suena la frase entera y el tren sigue solo.
    Al acabar: 9 de 10 y 3 estrellas."""
    page = C.new_page("phone")
    try:
        page.set_viewport_size({"width": 390, "height": 780})
        _open(page, "completa")
        right = page.evaluate("() => [...document.querySelectorAll('.gg-op')].find(b => b.ggOk).querySelector('span').textContent.trim()")
        _pick(page, ".gg-op", False)
        st = page.evaluate("""() => ({no: document.querySelectorAll('.gg-op.no').length, lit: document.querySelectorAll('.gg-op.lit').length,
          gap: document.querySelector('#gg-gap').className, wagon: document.querySelector('#gg-gap').textContent,
          es: (document.querySelector('.gg-fb-es') || {}).textContent || '', why: (document.querySelector('.gg-fb-why') || {}).textContent || '',
          next: !!document.querySelector('#gg-next')})""")
        assert st["no"] == 1 and st["lit"] == 1 and "fix" in st["gap"], st
        assert right in st["wagon"], (right, st)
        assert st["es"] and st["why"] and st["next"], st
        assert page.evaluate("+document.querySelector('#gm-sc').textContent") == 0
        C.shot(page, "completa-fallo", SHOTS, full_page=False)
        page.wait_for_timeout(1500)
        assert _n(page) == 1  # tras un fallo no sigue solo
        _next(page)
        page.wait_for_timeout(800)
        # la buena con su tecla
        k = page.evaluate("() => [...document.querySelectorAll('.gg-op')].findIndex(b => b.ggOk)")
        page.keyboard.press(str(k + 1))
        page.wait_for_selector("#gg-gap.ok", timeout=2000)
        assert page.evaluate("+document.querySelector('#gm-sc').textContent") == 1
        said = page.evaluate("window.__said")
        full = page.evaluate("() => document.querySelector('#gg-train').textContent")
        assert said and "___" not in said[-1] and _letters(said[-1]) == _letters(full), (said, full)
        C.shot(page, "completa-bien", SHOTS, full_page=False)
        page.wait_for_function("() => +document.querySelector('#gg-n').textContent === 3", timeout=9000)  # sigue solo
        for q in range(8):
            _pick(page, ".gg-op", True)
            page.wait_for_selector("#gg-gap.ok", timeout=2000)
            page.click("#gg-next")
            if q < 7:
                page.wait_for_function(f"() => +document.querySelector('#gg-n').textContent === {4 + q}", timeout=5000)
        page.wait_for_selector("#gm-end", timeout=6000)
        best = page.evaluate("JSON.parse(localStorage.getItem('games:best')).completa")
        assert best["score"] == 9 and best["stars"] == 3, best
        C.shot(page, "completa-final", SHOTS, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_detective_level_picker_and_full_game():
    """Detective: el nivel guardado ("gram:lv" B1 en inglés) sale elegido; tocar A2 lo cambia, lo guarda y empieza con
    A2. Una nota mala: gris con ✗, la buena iluminada, el porqué y el español; la fila del nivel se va y queda la
    pastilla «Nivel A2». Con Enter se sigue. Al acabar, el récord."""
    page = C.new_page("desk", color_scheme="dark")
    try:
        _open(page, "detective", lv={"english": "B1"})
        assert page.evaluate("document.querySelector('#gg').ggLv") == "B1"
        assert page.evaluate("document.querySelector('#gg-lv [aria-checked=true]').textContent") == "B1"
        page.click('#gg-lv [data-lv="A2"]')
        assert page.evaluate("document.querySelector('#gg').ggLv") == "A2"
        assert page.evaluate("JSON.parse(localStorage.getItem('gram:lv')).english") == "A2"
        # con las flechas, otro nivel y vuelta
        page.focus('#gg-lv [data-lv="A2"]')
        page.keyboard.press("ArrowRight")
        assert page.evaluate("document.querySelector('#gg').ggLv") == "B1"
        page.keyboard.press("ArrowLeft")
        assert page.evaluate("document.querySelector('#gg').ggLv") == "A2"
        notes = page.evaluate("() => [...document.querySelectorAll('.gg-nt')].map(b => b.getAttribute('aria-label'))")
        assert len(set(notes)) == 3 and all("___" not in t for t in notes), notes
        _pick(page, ".gg-nt", False)
        st = page.evaluate("""() => ({no: document.querySelectorAll('.gg-nt.no').length, ok: document.querySelectorAll('.gg-nt.ok').length,
          es: (document.querySelector('.gg-fb-es') || {}).textContent || '', why: (document.querySelector('.gg-fb-why') || {}).textContent || '',
          lv: document.querySelector('#gg-lv').hidden, chip: (document.querySelector('.gg-chip.lv') || {}).textContent})""")
        assert st["no"] == 1 and st["ok"] == 1 and st["es"] and st["why"], st
        assert st["lv"] and st["chip"] == "Nivel A2", st
        ok_label = page.evaluate("() => document.querySelector('.gg-nt.ok').getAttribute('aria-label')")
        assert _letters(page.evaluate("window.__said")[-1]) == _letters(ok_label)
        C.shot(page, "detective-fallo", SHOTS, full_page=False)
        page.keyboard.press("Enter")
        page.wait_for_function("() => +document.querySelector('#gg-n').textContent === 2", timeout=4000)
        for q in range(9):
            k = page.evaluate("() => [...document.querySelectorAll('.gg-nt')].findIndex(b => b.ggOk)")
            page.keyboard.press(str(k + 1))
            page.wait_for_selector(".gg-nt.ok", timeout=2000)
            if q == 0:
                C.shot(page, "detective-bien", SHOTS, full_page=False)
            page.keyboard.press("Enter")
            if q < 8:
                page.wait_for_function(f"() => +document.querySelector('#gg-n').textContent === {3 + q}", timeout=4000)
        page.wait_for_selector("#gm-end", timeout=6000)
        best = page.evaluate("JSON.parse(localStorage.getItem('games:best')).detective")
        assert best["score"] == 9 and best["stars"] == 3, best
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_pause_holds_auto_next():
    """Tras un acierto el juego sigue solo; con la pausa (Esc) espera, y al seguir, sigue."""
    page = C.new_page("desk")
    try:
        _open(page, "completa")
        _pick(page, ".gg-op", True)
        page.wait_for_selector("#gg-gap.ok", timeout=2000)
        page.keyboard.press("Escape")
        page.wait_for_selector("#gm-pause[open]", timeout=2000)
        page.wait_for_timeout(7500)
        assert _n(page) == 1
        page.get_by_role("button", name="Seguir").click()
        page.wait_for_function("() => +document.querySelector('#gg-n').textContent === 2", timeout=4000)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_french_and_danish():
    """En francés y danés: las piezas, las opciones y las notas llevan el idioma (lang) y su texto; ninguna pieza es
    solo un signo; el nivel se guarda por idioma (el C1 del inglés no cambia el A1 del francés)."""
    for lang in ("français", "dansk"):
        page = C.new_page("desk")
        try:
            ab = CODE[lang]
            _open(page, "ordenafrase", lang, lv={"english": "C1"})
            assert page.evaluate("document.querySelector('#gg').ggLv") == "A1"
            ans = page.evaluate("() => document.querySelector('#gg').ggAns")
            assert 3 <= len(ans) <= 9 and all(any(ch.isalnum() for ch in p) for p in ans), ans
            assert page.evaluate("document.querySelector('.gg-pc').getAttribute('lang')").startswith(ab)
            if lang == "dansk":
                # mal dos veces: sale la respuesta (las que faltaban, con borde turquesa) y no suma
                for _ in range(2):
                    order = page.evaluate("""() => { const ans = document.querySelector('#gg').ggAns, sl = [...document.querySelectorAll('.gg-slot')];
                      const free = sl.map((s, k) => s.textContent ? -1 : k).filter(k => k >= 0), need = free.map(k => ans[k]);
                      const rot = need.slice(1).concat(need.slice(0, 1)), used = new Set(), out = [];
                      for(const w of rot){ const t = [...document.querySelectorAll('.gg-pool .gg-pc')].find(e => e.ggW === w && !used.has(e)); used.add(t); out.push(+t.dataset.t); }
                      return out; }""")
                    for i in order:
                        page.locator(f'.gg-pool .gg-pc[data-t="{i}"]').click()
                    page.click("#gg-chk")
                    page.wait_for_selector(".gg-slot.wrong", timeout=2000)
                    page.wait_for_function("() => !document.querySelector('.gg-slot.wrong')", timeout=3000)
                page.wait_for_selector(".gg-slot.fix", timeout=2000)
                fb = page.evaluate("() => ({t: document.querySelector('.gg-fb-h').textContent, s: document.querySelector('.gg-fb-s').textContent})")
                assert "Así se dice" in fb["t"] and _letters(fb["s"]) == _letters("".join(ans)), fb
                assert page.evaluate("+document.querySelector('#gm-sc').textContent") == 0
                C.shot(page, "ordena-respuesta-da", SHOTS, full_page=False)
            else:
                _solve_ordena(page)
                page.wait_for_selector(".gg-slot.win", timeout=2000)
                C.shot(page, f"ordena-{ab}", SHOTS, full_page=False)
            for g, sel in (("completa", ".gg-op"), ("detective", ".gg-nt")):
                _open(page, g, lang)
                assert page.evaluate(f"document.querySelector('{sel}').getAttribute('lang')").startswith(ab)
                texts = page.evaluate(f"() => [...document.querySelectorAll('{sel}')].map(b => b.textContent.trim())")
                assert len(texts) == 3 and all(texts), texts
                _pick(page, sel, True)
                page.wait_for_selector(f"{sel}.ok", timeout=2000)
                C.shot(page, f"{g}-{ab}", SHOTS, full_page=False)
            assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()


def test_reduced_motion_and_menu():
    """Con «Reducir movimiento» el tren no entra ni se va deslizándose (cambia al momento). Las tres tarjetas llevan
    «Nuevo» hasta su primera partida y, en el vistazo, «Gramática» en lugar del tema."""
    page = C.new_page("phone", reduced_motion="reduce")
    try:
        C.seed(page, _keys(), "#/juegos")
        page.wait_for_selector('.gm-card[data-g="completa"]', timeout=8000)
        for g in GAMES:
            assert page.locator(f'.gm-card[data-g="{g}"] .gm-new').count() == 1, g
        assert page.evaluate("vocabGames.peek('detective', document.body)")
        page.wait_for_selector("#gm-peek[open]", timeout=3000)
        assert "Gramática" in page.evaluate("document.querySelector('#gm-peek').textContent")
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        _open(page, "completa")
        assert page.evaluate("document.querySelector('#gg-train').className") == "gg-train"
        _pick(page, ".gg-op", True)
        page.click("#gg-next")
        page.wait_for_function("() => +document.querySelector('#gg-n').textContent === 2", timeout=2000)
        assert page.evaluate("document.querySelector('#gg-train').className") == "gg-train"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
