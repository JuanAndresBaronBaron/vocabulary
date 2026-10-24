"""F6b (SPEC §6, plan-doc «Accesibilidad»): el menú de mantener pulsado (js/ctxmenu.js, window.vocabMenu) y la auditoría
de accesibilidad de todas las pantallas.

Menús: mantener pulsada una palabra de Palabras › Lista (Oír, Oír despacio, Al repaso), una pegatina pegada del álbum
(Ver grande, Oír, Oír despacio) o un animal de la granja (Acariciar, Dar de comer, Oír su nombre) abre un menú de vidrio
como el de iOS: el fondo se desenfoca (en la granja, sin desenfoque), la pieza crece un poco y las opciones llevan icono.
Cada opción hace lo mismo que su botón de siempre; Esc o tocar fuera lo cierran y el foco vuelve a la pieza; con el dedo
aún abajo se puede deslizar hasta una opción y soltar; Mayús+F10 lo abre con el teclado.

Auditoría (tests/e2e/a11y.js, propia: axe-core no está en la máquina y no se instala nada; el contraste lo mide audit.js
de F1): nombres accesibles, roles de pestañas y segmentos, regiones vivas al contestar, dibujos con alt o aria-hidden,
objetivos ≥ 44 px, foco visible y en orden, hojas modales con nombre y el foco dentro que vuelve a quien las abrió.
Con Reducir movimiento nada se anima más de 160 ms. La granja nunca usa backdrop-filter. Sin errores de consola y la
partida exportada igual que tests/e2e/baseline/export.json."""
from __future__ import annotations

import common as C
import routes as R

OUT = C.CAPTURAS / "F6"
A11Y = (C.HERE / "a11y.js").read_text(encoding="utf-8")
AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")

# las pantallas que se auditan (routes.py: SPEC §6 y las nuevas de F2-F5, con #/buzon, #/frases y #/carta)
ROUTE_NAMES = ["hoy", "mapa", f"mapa-{R.LEVEL}", "repaso", "leccion", "leccion-gram", f"doc-{R.TOPIC}", f"doc-{R.TOPIC_3000}",
               "gramatica", f"gramatica-{R.GRAM_LEVEL}", "juegos", "juego-memoria", "juego-lluvia", "juego-globos", "juego-letras",
               "album", f"album-{R.ALBUM_DONE}", "album-familia", "granja", "progreso", "palabras", "juego-lince", "mizorro",
               "juegos-buzon", "juegos-buzon-responder", "juegos-carta", "juegos-frases", "juegos-frases-cena", "temporada",
               "temporada-cosas"]

_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""

# ---------------------------------------------------------------- mantener pulsado con PointerEvents sintéticos (dedo)
_DOWN = """(sel) => { const el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!el) return null;
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  window.__hp = {x, y};
  el.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true, composed: true, pointerId: 41, pointerType: 'touch',
    isPrimary: true, clientX: x, clientY: y, button: 0, buttons: 1}));
  return {x, y}; }"""
_MOVE = """([x, y]) => { window.__hp = {x, y}; const t = document.elementFromPoint(x, y) || document.body;
  t.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, cancelable: true, composed: true, pointerId: 41, pointerType: 'touch',
    isPrimary: true, clientX: x, clientY: y, button: -1, buttons: 1})); }"""
_UP = """() => { const {x, y} = window.__hp; const t = document.elementFromPoint(x, y) || document.body;
  t.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, cancelable: true, composed: true, pointerId: 41, pointerType: 'touch',
    isPrimary: true, clientX: x, clientY: y, button: 0, buttons: 0})); }"""
_MENU = """() => { const d = document.querySelector('dialog.vm[open]'); if (!d) return null;
  const a = document.activeElement;
  return {items: [...d.querySelectorAll('[role=menuitem]')].map(b => b.textContent.trim()), off: [...d.querySelectorAll('[role=menuitem]:disabled')].map(b => b.textContent.trim()),
    head: (d.querySelector('.vm-h') || {}).textContent || '', ipa: !!d.querySelector('.vm-h .ipa'), lite: d.classList.contains('lite'),
    modal: d.matches(':modal'), label: d.getAttribute('aria-label'), menu: !!d.querySelector('[role=menu]'),
    focus: d.contains(a), focusItem: a && a.getAttribute('role') === 'menuitem' ? a.textContent.trim() : null,
    srcHidden: !!document.querySelector('[style*="visibility: hidden"]'),
    blur: getComputedStyle(d.querySelector('.vm-scrim')).backdropFilter, cmenu: document.documentElement.hasAttribute('data-cmenu')}; }"""
_SPY = """() => { window.__said = []; if (!window.__sayOrig) { window.__sayOrig = window.say; window.say = function (t, b, slow) { window.__said.push([String(t), !!slow]); }; } }"""
_SAID = "() => { const s = window.__said.slice(); window.__said.length = 0; return s; }"
_ACTIVE = """() => { const a = document.activeElement; if (!a || a === document.body) return null;
  return {tag: a.tagName.toLowerCase(), cls: typeof a.className === 'string' ? a.className : '', text: (a.textContent || '').trim().slice(0, 60)}; }"""


def _hold(page, sel, ms=650):
    """Mantiene pulsado sel (el centro) con el dedo y lo suelta sin moverse."""
    pt = page.evaluate(_DOWN, sel)
    assert pt, f"no hay {sel}"
    page.wait_for_timeout(ms)
    page.evaluate(_UP)
    page.wait_for_timeout(420)
    return pt


def _pick(page, text):
    page.locator("dialog.vm [role=menuitem]", has_text=text).first.click()
    page.wait_for_timeout(350)


def _no_menu(page):
    return page.evaluate("() => !document.querySelector('dialog.vm')")


def _audit_menu(page, tag, probs):
    """El menú abierto pasa la auditoría (nombres, roles, objetivos, diálogo modal con el foco dentro) y el contraste."""
    page.evaluate(_FINISH)
    page.wait_for_timeout(60)
    a = page.evaluate(A11Y, {})
    b = page.evaluate(AUDIT, {"what": ["contrast", "palette"]})
    for k in ("names", "roles", "images", "targets", "ids", "dialogs", "focusable"):
        probs += [f"{tag} [{k}] {x}" for x in a[k]]
    probs += [f"{tag} [contraste] {x}" for x in b["contrast"]]
    probs += [f"{tag} [colores] {x}" for x in b["palette"]]


def _free_word(page):
    """Un tema y una fila de la Lista que aún no está en el repaso (la partida sembrada tiene muchos temas dentro)."""
    for tid in (R.TOPIC_3000, "nacionalidades", "profesiones", "paises", "numeros", "w05", "w06"):
        C.goto(page, f"#/doc/{tid}?m=lista")
        page.wait_for_timeout(300)
        n = page.evaluate("() => [...document.querySelectorAll('.dl-r:not(.in-srs)')].slice(0, 2).map(r => r.dataset.i)")
        if len(n) == 2:
            return tid, n
    raise AssertionError("no hay palabras fuera del repaso en ningún tema")


def _srs(page, tid, i):
    return page.evaluate("([t, i]) => { const doc = CACHE[t]; const r = doc && doc.rows[+i]; return r ? srsAll()[srsK(t, r)] || null : 'sin fila'; }", [tid, i])


# ---------------------------------------------------------------- 1. una palabra de Palabras › Lista
def test_word_menu_same_as_buttons():
    """Mantener una palabra de la Lista: menú con la palabra, su IPA y Oír / Oír despacio / Al repaso (si ya está, «Ya está
    en el repaso», apagada). Oír = el altavoz de la fila; Oír despacio = la tortuga del detalle; Al repaso = el botón «Al
    repaso» del detalle (el mismo registro del repaso). Tocar la copia abre el detalle. Esc y tocar fuera cierran sin hacer
    nada más y el foco vuelve a la fila; deslizar el dedo hasta una opción y soltar la elige; Mayús+F10 lo abre con el foco
    en la primera opción (flechas para moverse). Mientras está abierto, html[data-cmenu] y el fondo desenfocado."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        tid, (ia, ib) = _free_word(page)
        page.evaluate(_SPY)
        row = f'.dl-r[data-i="{ia}"]'
        word = page.evaluate("s => document.querySelector(s + ' .dl-w').textContent", row)
        _hold(page, row + " .dl-fg")
        m = page.evaluate(_MENU)
        if not m or m["items"] != ["Oír", "Oír despacio", "Al repaso"] or m["off"]:
            probs.append(f"el menú de la palabra: {m}")
        else:
            if word not in m["head"] or not m["ipa"]:
                probs.append(f"la cabecera no tiene la palabra y su IPA: {m['head']!r} ipa={m['ipa']}")
            if not (m["modal"] and m["menu"] and m["focus"] and m["label"]):
                probs.append(f"el menú no es un diálogo modal con nombre y el foco dentro: {m}")
            if "blur" not in (m["blur"] or "") or not m["cmenu"] or not m["srcHidden"]:
                probs.append(f"fondo sin desenfocar, sin html[data-cmenu] o la pieza no se levanta: {m}")
            C.shot(page, "F6b-menu-palabra-light", OUT, full_page=False)
            # Oír = el altavoz de la fila
            _pick(page, "Oír")
            menu_say = page.evaluate(_SAID)
            page.locator(row + " .dl-fg .say").click()
            page.wait_for_timeout(200)
            btn_say = page.evaluate(_SAID)
            if menu_say != [[word, False]] or menu_say != btn_say:
                probs.append(f"«Oír» no es el altavoz: menú {menu_say} · botón {btn_say}")
            if not _no_menu(page):
                probs.append("elegir «Oír» no cierra el menú")
            # Oír despacio = la tortuga del detalle
            _hold(page, row + " .dl-fg")
            _pick(page, "Oír despacio")
            menu_slow = page.evaluate(_SAID)
            page.locator(row + " .dl-open").click()
            page.wait_for_timeout(300)
            page.locator(row + " .ln-slow").click()
            page.wait_for_timeout(200)
            btn_slow = page.evaluate(_SAID)
            page.locator(row + " .dl-open").click()   # cierra el detalle
            page.wait_for_timeout(250)
            if menu_slow != [[word, True]] or menu_slow != btn_slow:
                probs.append(f"«Oír despacio» no es la tortuga: menú {menu_slow} · botón {btn_slow}")
            # Esc: cierra y el foco vuelve a la fila
            _hold(page, row + " .dl-fg")
            page.keyboard.press("Escape")
            page.wait_for_timeout(450)
            act = page.evaluate(_ACTIVE)
            if not _no_menu(page) or not act or "dl-open" not in act["cls"] or word not in act["text"]:
                probs.append(f"Esc no cierra o el foco no vuelve a la fila: {act}")
            # tocar fuera: cierra y no hace nada más (no abre el detalle, no habla)
            _hold(page, row + " .dl-fg")
            page.mouse.click(8, 8)
            page.wait_for_timeout(450)
            st = page.evaluate("s => ({open: document.querySelector(s + ' .dl-open').getAttribute('aria-expanded'), hash: location.hash})", row)
            if not _no_menu(page) or st["open"] != "false" or page.evaluate(_SAID) or "doc/" + tid not in st["hash"]:
                probs.append(f"tocar fuera no cierra limpio: {st}")
            # tocar la copia de la pieza = tocar la fila (abre el detalle)
            _hold(page, row + " .dl-fg")
            page.locator("dialog.vm .vm-pv-hit").click()
            page.wait_for_timeout(400)
            if page.evaluate("s => document.querySelector(s + ' .dl-open').getAttribute('aria-expanded')", row) != "true" or not _no_menu(page):
                probs.append("tocar la copia de la palabra no abre su detalle")
            page.locator(row + " .dl-open").click()
            page.wait_for_timeout(250)
            # deslizar hasta «Oír despacio» con el dedo aún abajo y soltar
            page.evaluate(_DOWN, row + " .dl-fg")
            page.wait_for_timeout(650)
            tgt = page.evaluate("() => { const b = [...document.querySelectorAll('dialog.vm [role=menuitem]')].find(b => b.textContent.trim() === 'Oír despacio'); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }")
            p0 = page.evaluate("() => window.__hp")
            for k in range(1, 7):
                page.evaluate(_MOVE, [p0["x"] + (tgt[0] - p0["x"]) * k / 6, p0["y"] + (tgt[1] - p0["y"]) * k / 6])
                page.wait_for_timeout(20)
            hov = page.evaluate("() => [...document.querySelectorAll('dialog.vm .vm-i.hov')].map(b => b.textContent.trim())")
            page.evaluate(_UP)
            page.wait_for_timeout(400)
            slid = page.evaluate(_SAID)
            if hov != ["Oír despacio"] or slid != [[word, True]] or not _no_menu(page):
                probs.append(f"deslizar hasta una opción y soltar: resaltada {hov}, dijo {slid}")
            # Al repaso (menú, fila A) = «Al repaso» del detalle (fila B): el mismo registro
            _hold(page, row + " .dl-fg")
            _pick(page, "Al repaso")
            rb = f'.dl-r[data-i="{ib}"]'
            page.locator(rb + " .dl-open").click()
            page.wait_for_timeout(300)
            page.locator(rb + " [data-add]").click()
            page.wait_for_timeout(300)
            sa, sb = _srs(page, tid, ia), _srs(page, tid, ib)
            strip = lambda x: {k: v for k, v in (x or {}).items() if k != "e"} if isinstance(x, dict) else x
            if not isinstance(sa, dict) or strip(sa) != strip(sb):
                probs.append(f"«Al repaso» del menú no es el del botón: {sa} · {sb}")
            if not page.evaluate("s => document.querySelector(s).classList.contains('in-srs')", row):
                probs.append("tras «Al repaso» la fila no se marca como en el repaso")
            _hold(page, row + " .dl-fg")
            m2 = page.evaluate(_MENU)
            if not m2 or m2["off"] != ["Ya está en el repaso"]:
                probs.append(f"con la palabra ya en el repaso, la opción no se apaga: {m2}")
            page.keyboard.press("Escape")
            page.wait_for_timeout(400)
            # teclado: Mayús+F10 con el foco en la fila
            page.locator(row + " .dl-open").focus()
            page.keyboard.press("Shift+F10")
            page.wait_for_timeout(450)
            k1 = page.evaluate(_MENU)
            page.keyboard.press("ArrowDown")
            k2 = page.evaluate(_MENU)
            page.keyboard.press("Escape")
            page.wait_for_timeout(450)
            act = page.evaluate(_ACTIVE)
            if not k1 or k1["focusItem"] != "Oír" or not k2 or k2["focusItem"] != "Oír despacio":
                probs.append(f"con el teclado: {k1} → {k2}")
            if not act or "dl-open" not in act["cls"] or not _no_menu(page):
                probs.append(f"Esc (teclado) no devuelve el foco a la fila: {act}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 2. una pegatina del álbum
def test_sticker_menu_same_as_buttons():
    """Mantener una pegatina pegada: Ver grande / Oír / Oír despacio, con su palabra e IPA. «Ver grande» abre la misma
    tarjeta grande que tocarla; Oír y Oír despacio, lo mismo que sus botones de la tarjeta. Una pegatina secreta no tiene
    menú: mantener y soltar hace lo de tocarla. Esc cierra y el foco vuelve a la pegatina."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, f"#/album/{R.ALBUM_DONE}")
        page.wait_for_timeout(500)
        page.evaluate(_SPY)
        st = ".al-st.got:not(.new)"
        k = page.evaluate("s => document.querySelector(s).dataset.k", st)
        sel = f'.al-st[data-k="{k}"]'
        word = page.evaluate("s => document.querySelector(s + ' .al-lb b').textContent", sel)
        _hold(page, sel)
        m = page.evaluate(_MENU)
        if not m or m["items"] != ["Ver grande", "Oír", "Oír despacio"] or word not in m["head"] or not m["ipa"]:
            probs.append(f"el menú de la pegatina: {m}")
        else:
            C.shot(page, "F6b-menu-pegatina-light", OUT, full_page=False)
            _pick(page, "Ver grande")
            page.wait_for_selector("dialog.al-dlg[open]", timeout=3000)
            page.wait_for_timeout(700)
            big = page.evaluate("() => document.querySelector('dialog.al-dlg[open] .al-cf-w').textContent")
            page.keyboard.press("Escape")
            page.wait_for_timeout(600)
            page.evaluate(_SAID)
            page.locator(sel).click()
            page.wait_for_selector("dialog.al-dlg[open]", timeout=3000)
            page.wait_for_timeout(700)
            big2 = page.evaluate("() => document.querySelector('dialog.al-dlg[open] .al-cf-w').textContent")
            # los botones de la tarjeta
            page.evaluate(_SAID)
            page.locator("dialog.al-dlg[open] .al-front .al-sayg .say:not([data-slow])").first.click()
            page.wait_for_timeout(200)
            b_say = page.evaluate(_SAID)
            page.locator("dialog.al-dlg[open] .al-front .al-sayg [data-slow]").first.click()
            page.wait_for_timeout(200)
            b_slow = page.evaluate(_SAID)
            page.keyboard.press("Escape")
            page.wait_for_timeout(600)
            if big != word or big2 != big:
                probs.append(f"«Ver grande» no abre la tarjeta de tocarla: {big!r} · {big2!r}")
            _hold(page, sel)
            _pick(page, "Oír")
            m_say = page.evaluate(_SAID)
            _hold(page, sel)
            _pick(page, "Oír despacio")
            m_slow = page.evaluate(_SAID)
            if m_say != b_say or m_slow != b_slow or m_say != [[word, False]] or m_slow != [[word, True]]:
                probs.append(f"Oír / Oír despacio: menú {m_say} {m_slow} · tarjeta {b_say} {b_slow}")
            _hold(page, sel)
            page.keyboard.press("Escape")
            page.wait_for_timeout(450)
            focus_k = page.evaluate("() => document.activeElement && document.activeElement.dataset.k")
            if focus_k != k or not _no_menu(page):
                probs.append(f"Esc no devuelve el foco a la pegatina: {focus_k}")
        # una secreta: sin menú, mantener y soltar = tocarla
        C.goto(page, "#/album/familia")
        page.wait_for_timeout(500)
        if page.locator(".al-st.lock").count():
            _hold(page, ".al-st.lock")
            held = page.evaluate("() => ({menu: !!document.querySelector('dialog.vm'), card: !!document.querySelector('dialog.al-dlg[open] .al-cf-img.lk')})")
            if held["menu"] or not held["card"]:
                probs.append(f"mantener una pegatina secreta no hace lo de tocarla: {held}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 3. un animal de la granja
def test_animal_menu_same_as_buttons():
    """Mantener un animal: Acariciar / Dar de comer / Oír su nombre, sin desenfoque (vidrio lite) y sin backdrop-filter en
    toda la granja. Acariciar = tocarlo (corazones y su nombre); Dar de comer = tocar uno con hambre (su globo de comida) o,
    si está lleno, «¡Está lleno!»; Oír su nombre = el altavoz de su globo. Esc cierra y el foco vuelve al animal."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, "#/granja")
        page.wait_for_selector(".fm-it[data-fid=gallina]", timeout=9000)
        page.wait_for_timeout(600)
        page.evaluate(_SPY)
        hen = ".fm-it[data-fid=gallina]"
        _hold(page, hen)
        m = page.evaluate(_MENU)
        bd = page.evaluate(AUDIT, {"what": ["backdrop"]})["backdrop"]
        if not m or m["items"] != ["Acariciar", "Dar de comer", "Oír su nombre"] or "hen" not in m["head"] or not m["lite"]:
            probs.append(f"el menú del animal: {m}")
        else:
            if bd or (m["blur"] and m["blur"] != "none"):
                probs.append(f"en la granja el menú no debe desenfocar: {m['blur']} · {bd}")
            C.shot(page, "F6b-menu-granja-light", OUT, full_page=False)
            _pick(page, "Acariciar")
            page.wait_for_timeout(300)
            pet = page.evaluate("() => { const b = document.querySelector('#app .fm-bub'); return {shown: !b.hidden, text: b.textContent}; }")
            said_m = page.evaluate(_SAID)
            page.evaluate("() => { document.querySelector('#app .fm-bub').hidden = true; }")
            page.wait_for_timeout(2800)   # que vuelva a pasear y el globo se vaya
            page.evaluate("s => document.querySelector(s).click()", hen)
            page.wait_for_timeout(300)
            pet2 = page.evaluate("() => { const b = document.querySelector('#app .fm-bub'); return {shown: !b.hidden, text: b.textContent}; }")
            said_b = page.evaluate(_SAID)
            if not pet["shown"] or "hen" not in pet["text"] or not pet2["shown"] or "hen" not in pet2["text"] or said_m != said_b:
                probs.append(f"«Acariciar» no es tocarla: {pet} {said_m} · {pet2} {said_b}")
            # Dar de comer: la gallina está llena → «¡Está lleno!»
            page.evaluate("() => { document.querySelector('#app .fm-bub').hidden = true; }")
            _hold(page, hen)
            _pick(page, "Dar de comer")
            full = page.evaluate("() => { const b = document.querySelector('#app .fm-bub'); return {shown: !b.hidden, text: b.textContent, pop: !document.querySelector('#app .fm-pop').hidden}; }")
            if not full["shown"] or "lleno" not in full["text"] or full["pop"]:
                probs.append(f"«Dar de comer» con la gallina llena: {full}")
            # el pato tiene hambre: «Dar de comer» = tocarlo (su globo de comida)
            _hold(page, ".fm-it[data-fid=pato]")
            _pick(page, "Dar de comer")
            feed = page.evaluate("() => { const p = document.querySelector('#app .fm-pop'); return {open: !p.hidden, kind: p.dataset.kind, fid: p.dataset.fid}; }")
            if feed != {"open": True, "kind": "feed", "fid": "pato"}:
                probs.append(f"«Dar de comer» con el pato con hambre no abre su globo: {feed}")
            page.locator("#app .fm-pop .fm-x").click()
            page.wait_for_timeout(300)
            page.evaluate("() => document.querySelector('.fm-it[data-fid=pato]').click()")
            page.wait_for_timeout(300)
            feed2 = page.evaluate("() => { const p = document.querySelector('#app .fm-pop'); return {open: !p.hidden, kind: p.dataset.kind, fid: p.dataset.fid}; }")
            if feed2 != feed:
                probs.append(f"tocar el pato: {feed2} (menú: {feed})")
            page.locator("#app .fm-pop .fm-x").click()
            page.wait_for_timeout(300)
            # Oír su nombre = el altavoz de su globo
            page.evaluate(_SAID)
            _hold(page, hen)
            _pick(page, "Oír su nombre")
            m_say = page.evaluate(_SAID)
            if m_say != [["hen", False]]:
                probs.append(f"«Oír su nombre»: {m_say}")
            # Esc: el foco vuelve al animal
            _hold(page, hen)
            page.keyboard.press("Escape")
            page.wait_for_timeout(450)
            fid = page.evaluate("() => document.activeElement && document.activeElement.dataset.fid")
            if fid != "gallina" or not _no_menu(page):
                probs.append(f"Esc no devuelve el foco al animal: {fid}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 4. el menú pasa la auditoría (claro y oscuro)
def test_menus_pass_audit_light_dark():
    """Con cada menú abierto (palabra, pegatina, animal), en móvil (390 y 360 px) y escritorio, claro y oscuro: diálogo modal
    con nombre y el foco dentro, opciones role=menuitem dentro de role=menu de ≥ 44 px, la copia de la pieza fuera del
    árbol accesible, contraste ≥ 4,5:1 y sin colores prohibidos. El menú cabe en la pantalla."""
    probs = []
    for kind, vp in (("phone", None), ("phone", {"width": 360, "height": 780}), ("desk", None)):
        for scheme in ("light", "dark"):
            kw = {"viewport": vp} if vp else {}
            page = C.new_page(kind, color_scheme=scheme, **kw)
            tag0 = f"{kind}{vp['width'] if vp else ''}-{scheme}"
            try:
                C.seed(page)
                for name, hash_, sel in (("palabra", f"#/doc/{R.TOPIC}?m=lista", ".dl-r .dl-fg"),
                                         ("pegatina", f"#/album/{R.ALBUM_DONE}", ".al-st.got:not(.new)"),
                                         ("granja", "#/granja", ".fm-it[data-fid=gallina]")):
                    C.goto(page, hash_)
                    page.wait_for_selector(sel, timeout=9000)
                    page.wait_for_timeout(500)
                    _hold(page, sel)
                    if not page.evaluate(_MENU):
                        probs.append(f"{tag0} {name}: no se abre el menú")
                        continue
                    _audit_menu(page, f"{tag0} {name}", probs)
                    fit = page.evaluate("""() => { const b = document.querySelector('dialog.vm .vm-box').getBoundingClientRect();
                      return b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight; }""")
                    if not fit:
                        probs.append(f"{tag0} {name}: el menú se sale de la pantalla")
                    if scheme == "dark" and kind == "phone" and not vp:
                        C.shot(page, f"F6b-menu-{name}-dark", OUT, full_page=False)
                    if vp:
                        C.shot(page, f"F6b-menu-{name}-360-{scheme}", OUT, full_page=False)
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(450)
                probs += [f"{tag0}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 5. auditoría de todas las pantallas
def test_audit_all_routes_light_dark():
    """Todas las pantallas (ROUTE_NAMES), en móvil y escritorio, claro y oscuro: a11y.js sin fallos (nombres, roles de
    pestañas y segmentos, dibujos, objetivos ≥ 44 px, ids, diálogos, nada enfocable en aria-hidden) y audit.js sin textos
    con poco contraste."""
    names = [r["name"] for r in R.all_routes()]
    missing = [n for n in ROUTE_NAMES if n not in names]
    assert not missing, f"faltan rutas en routes.py: {missing}"
    probs = []
    for kind in ("phone", "desk"):
        for scheme in ("light", "dark"):
            page = C.new_page(kind, color_scheme=scheme)
            try:
                C.seed(page)
                for r in R.all_routes(ROUTE_NAMES):
                    if r["name"] not in ROUTE_NAMES:
                        continue
                    C.goto(page, r["hash"])
                    page.evaluate(_FINISH)
                    page.wait_for_timeout(60)
                    a = page.evaluate(A11Y, {})
                    tag = f"{kind}-{scheme}-{r['name']}"
                    for k in ("names", "roles", "images", "targets", "ids", "dialogs", "focusable"):
                        probs += [f"{tag} [{k}] {x}" for x in a[k]]
                    if a["n"]["controls"] < 1:
                        probs.append(f"{tag}: ningún control a la vista (¿no pintó?)")
                    b = page.evaluate(AUDIT, {"what": ["contrast"]})
                    probs += [f"{tag} [contraste] {x}" for x in b["contrast"]]
                probs += [f"{kind}-{scheme}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs[:80])


# ---------------------------------------------------------------- 6. hojas y menús: modales, con nombre, el foco vuelve
_SHEETS = [
    ("hoy", "#/", "#bd-mis", "dialog#bd-mis-s"),
    ("ajustes", "#/", "#cfg-b, [data-open=ajustes], button[aria-label='Ajustes']", "dialog[open]"),
    ("idioma", "#/", "#lang-b", "#lang-m:not([hidden])"),
    ("nivel", "#/mapa", ".lvp-b", ".lvp-m:not([hidden])"),
    ("juegos-tema", "#/juegos", "#gm-tpill", "dialog#gm-tp-s"),
    ("pegatina", f"#/album/{R.ALBUM_DONE}", ".al-st.got:not(.new)", "dialog.al-dlg"),
    ("tienda", "#/granja", "[data-fm=shop]", "dialog#fm-shop"),
    ("practicar", f"#/doc/{R.TOPIC}?m=practica", "#pr-opt", "dialog[open]"),
]


def test_sheets_modal_named_and_focus_returns():
    """Cada hoja (Misiones, Ajustes, el tema de Juegos, la tarjeta de una pegatina, la Tienda de la granja, las opciones de
    Practicar) y cada menú (idioma, nivel), abiertos con el teclado (foco en su botón y Enter): es modal (o un menú
    role=menu), tiene nombre, el foco está dentro, pasa la auditoría, y con Esc se cierra y el foco vuelve a su botón."""
    probs = []
    for scheme in ("light", "dark"):
        page = C.new_page("phone", color_scheme=scheme)
        try:
            C.seed(page)
            for name, hash_, opener, sheet in _SHEETS:
                C.goto(page, hash_)
                page.wait_for_timeout(400)
                loc = page.locator(opener).first
                if not loc.count():
                    probs.append(f"{scheme} {name}: no está el botón {opener}")
                    continue
                page.evaluate("() => { window.__op = null; }")
                loc.focus()
                page.evaluate("() => { window.__op = document.activeElement; }")
                page.keyboard.press("Enter")
                try:
                    page.wait_for_selector(sheet, timeout=4000)
                except Exception:  # noqa: BLE001
                    probs.append(f"{scheme} {name}: Enter no abre {sheet}")
                    continue
                page.wait_for_timeout(700)
                page.evaluate(_FINISH)
                st = page.evaluate("""(s) => { const d = document.querySelector(s); const a = document.activeElement;
                  const isDlg = d.tagName === 'DIALOG'; return {dlg: isDlg, modal: isDlg ? d.matches(':modal') : null,
                  menu: d.getAttribute('role') === 'menu' || !!d.querySelector('[role=menu]') || d.matches('[role=menu]'),
                  focus: d.contains(a) || a === d}; }""", sheet)
                if (st["dlg"] and not st["modal"]) or (not st["dlg"] and not st["menu"]) or not st["focus"]:
                    probs.append(f"{scheme} {name}: {st}")
                a = page.evaluate(A11Y, {"what": ["names", "roles", "images", "targets", "ids", "dialogs", "focusable"]})
                for k in ("names", "roles", "images", "targets", "ids", "dialogs", "focusable"):
                    probs += [f"{scheme} {name} [{k}] {x}" for x in a[k]]
                page.keyboard.press("Escape")
                page.wait_for_timeout(700)
                back = page.evaluate("""(s) => { const d = document.querySelector(s); const o = window.__op, a = document.activeElement;
                  return {closed: !d || (d.tagName === 'DIALOG' ? !d.open : d.hidden || !d.getClientRects().length),
                  focus: !!o && (a === o || o.contains(a)), on: a ? a.tagName + '.' + a.className : null}; }""", sheet)
                if not back["closed"] or not back["focus"]:
                    probs.append(f"{scheme} {name}: tras Esc {back}")
            probs += [f"{scheme}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 7. foco visible y en orden
_FOCUS = """() => {
  const el = document.activeElement; if (!el || el === document.body) return null;
  const d = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
  const ringOf = x => { const c = getComputedStyle(x); return (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 1.5) || (c.boxShadow && c.boxShadow !== 'none'); };
  const ring = ringOf(el) || [...el.querySelectorAll('*')].slice(0, 12).some(ringOf);
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  let op = 1; for (let p = el; p && p !== document.documentElement; p = p.parentElement) op *= +getComputedStyle(p).opacity;
  const vis = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && op >= .5;
  return {d, ring, vis}; }"""


def test_focus_visible_and_in_order():
    """Con el teclado (Tab, 30 veces) en cada pantalla, en escritorio: cada parada se ve (dentro de la pantalla, sin
    opacidad casi cero) y tiene su anillo de foco (outline o sombra, en ella o en lo de dentro, p. ej. el dibujo del personaje de la granja); ningún tabindex positivo
    (a11y.js) y el foco no se queda atascado."""
    probs = []
    page = C.new_page("desk")
    try:
        C.seed(page)
        for r in R.all_routes(ROUTE_NAMES):
            C.goto(page, r["hash"])
            page.wait_for_timeout(250)
            page.evaluate("() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); scrollTo(0, 0); }")
            seen = []
            for _ in range(30):
                page.keyboard.press("Tab")
                page.wait_for_timeout(30)
                f = page.evaluate(_FOCUS)
                if not f:
                    continue
                seen.append(f["d"])
                if not f["ring"] or not f["vis"]:
                    probs.append(f"{r['name']}: {f}")
            # (con una hoja modal abierta, p. ej. la cápsula del mes al entrar en el loro, el foco se queda en sus botones)
            # (con VOCAB_TECH=1, el repaso vacío de Tech Prep en modo foco solo tiene la ✕ y «Learn something new»)
            if len(set(seen)) < (2 if r.get("tech") else 3) and not page.evaluate("() => !!document.querySelector('dialog[open]:modal')"):
                probs.append(f"{r['name']}: el foco solo pasa por {sorted(set(seen))}")
            ti = page.evaluate(A11Y, {"what": ["roles"]})["roles"]
            probs += [f"{r['name']} {x}" for x in ti if "tabindex" in x]
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(sorted(set(probs))[:60])


# ---------------------------------------------------------------- 8. regiones vivas al contestar
def test_answers_are_announced():
    """Al contestar, el resultado se anuncia en una región viva: la lección (#ls-say), los juegos (.gm-live: «¡Bien!
    <palabra>» o «Casi, prueba otra vez»; Oído de lince ya tiene la suya, #ln-txt) y las Preguntas de un tema (#qz-fb)."""
    import test_f3_leccion as L
    import test_f4_juegos as J
    probs = []
    page = C.new_page("phone")
    try:
        L._open(page)
        for _ in range(12):
            st = page.evaluate(L._ST)
            if st["t"] in (None, "learn"):
                L._go(page)
                continue
            L._pick(page, st["right"])
            page.wait_for_timeout(300)
            said = page.evaluate("() => { const e = document.getElementById('ls-say'); return e ? {t: e.textContent, live: e.getAttribute('aria-live')} : null; }")
            if not said or said["live"] != "polite" or not said["t"].strip():
                probs.append(f"la lección no anuncia la respuesta: {said}")
            break
        J._open(page)
        J._start(page, "globos")
        page.wait_for_function("() => document.querySelectorAll('#gm-air .gm-bal:not(:disabled)').length === 4", timeout=6000)
        reg = page.evaluate("() => { const e = document.querySelector('.gm-live'); return e ? [e.getAttribute('role'), e.getAttribute('aria-live')] : null; }")
        if reg != ["status", "polite"]:
            probs.append(f"los juegos no tienen región viva: {reg}")
        page.evaluate("() => document.querySelector('#gm-air .gm-bal').click()")
        page.wait_for_timeout(300)
        t = page.evaluate("() => document.querySelector('.gm-live') && document.querySelector('.gm-live').textContent")
        if t != "Casi, prueba otra vez" and not (t or "").startswith("¡Bien! "):
            probs.append(f"el juego no anuncia la respuesta: {t!r}")
        C.goto(page, f"#/doc/{R.TOPIC}?m=test")
        page.wait_for_timeout(500)
        fb = page.evaluate("() => { const e = document.getElementById('qz-fb'); return e ? e.getAttribute('role') : null; }")
        if fb != "status":
            probs.append(f"las Preguntas no tienen región viva: {fb}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 9. Reducir movimiento
_HOOK = """(() => {
  window.__long = [];
  const desc = el => { if (!el || !el.tagName) return String(el); let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id;
    const k = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''; return k ? s + '.' + k : s; };
  const orig = Element.prototype.animate;
  Element.prototype.animate = function (kf, op) {
    const a = orig.call(this, kf, op);
    try { const t = a.effect.getComputedTiming(); const d = (t.duration || 0) * (t.iterations === Infinity ? 1e6 : (t.iterations || 1)) + (t.delay || 0);
      if (d > 160) window.__long.push(desc(this) + ' ' + Math.round(t.duration) + ' ms ×' + t.iterations + ' · ' + (location.hash || '#/')); } catch (e) {}
    return a;
  };
})();"""
_RUNNING = """() => { const out = []; for (const a of document.getAnimations()) { try { const t = a.effect.getComputedTiming();
  const d = (t.duration || 0) * (t.iterations === Infinity ? 1e6 : (t.iterations || 1)) + (t.delay || 0);
  if (d > 160) { const el = a.effect.target; out.push((a.animationName || a.transitionProperty || 'js') + ' ' + (el ? el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className.trim().split(/\\s+/)[0] : '') : '') + ' ' + Math.round(t.duration) + ' ms ×' + t.iterations); } } catch (e) {} } return out; }"""


def test_reduced_motion_nothing_over_160ms():
    """Con Reducir movimiento (el del aparato), en todas las pantallas y al usar lo que se mueve (los menús de mantener,
    una hoja, una partida de globos, contestar en la lección, tocar animales, despegar una pegatina): ninguna animación ni
    transición pasa de 160 ms (ni las de CSS ni las de element.animate())."""
    import test_f4_juegos as J
    probs = []
    page = C.new_page("phone", reduced_motion="reduce")
    try:
        page.context.add_init_script(_HOOK)
        C.seed(page)

        def look(tag, n=3):
            for _ in range(n):
                page.wait_for_timeout(250)
                probs.extend(f"{tag}: {x}" for x in page.evaluate(_RUNNING))
        for r in R.all_routes(ROUTE_NAMES):
            C.goto(page, r["hash"])
            look(r["name"])
        for hash_, sel in ((f"#/doc/{R.TOPIC}?m=lista", ".dl-r .dl-fg"), (f"#/album/{R.ALBUM_DONE}", ".al-st.got:not(.new)"), ("#/granja", ".fm-it[data-fid=gallina]")):
            C.goto(page, hash_)
            page.wait_for_selector(sel, timeout=9000)
            page.evaluate(_DOWN, sel)
            page.wait_for_timeout(650)
            page.evaluate(_UP)
            look("menú " + hash_, 2)
            page.keyboard.press("Escape")
            look("menú cerrándose " + hash_, 1)
        C.goto(page, "#/granja")
        page.wait_for_timeout(500)
        for fid in ("gallina", "pato", "vaca"):
            page.evaluate("f => { const b = document.querySelector(`.fm-it[data-fid=${f}]`); if (b) b.click(); }", fid)
            look(f"granja {fid}", 2)
        C.goto(page, "#/album/familia")
        page.wait_for_timeout(400)
        page.evaluate("() => { const b = document.querySelector('.al-st.new'); if (b) b.click(); }")
        look("despegar", 2)
        C.goto(page, "#/")
        page.locator("#bd-mis").click()
        look("hoja de misiones", 2)
        page.keyboard.press("Escape")
        look("hoja cerrándose", 1)
        J._open(page)
        J._start(page, "globos")
        J._play_globos(page)
        look("globos", 3)
        probs += page.evaluate("() => window.__long")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(sorted(set(probs))[:60])


# ---------------------------------------------------------------- 10. la granja, sin backdrop-filter
def test_farm_never_blurs():
    """En la granja (móvil y escritorio, claro y oscuro) ningún elemento, pseudoelemento ni ::backdrop tiene
    backdrop-filter: la escena, la Tienda, el globo de un animal y su menú de mantener."""
    probs = []
    for kind in ("phone", "desk"):
        for scheme in ("light", "dark"):
            page = C.new_page(kind, color_scheme=scheme)
            tag = f"{kind}-{scheme}"
            try:
                C.seed(page)
                C.goto(page, "#/granja")
                page.wait_for_selector(".fm-it[data-fid=gallina]", timeout=9000)
                page.wait_for_timeout(500)
                probs += [f"{tag} escena: {x}" for x in page.evaluate(AUDIT, {"what": ["backdrop"]})["backdrop"]]
                page.locator("[data-fm=shop]").click()
                page.wait_for_selector("dialog#fm-shop[open]", timeout=4000)
                page.wait_for_timeout(500)
                probs += [f"{tag} tienda: {x}" for x in page.evaluate(AUDIT, {"what": ["backdrop"]})["backdrop"]]
                page.keyboard.press("Escape")
                page.wait_for_timeout(500)
                page.evaluate("() => document.querySelector('.fm-it[data-fid=pato]').click()")
                page.wait_for_timeout(400)
                probs += [f"{tag} globo: {x}" for x in page.evaluate(AUDIT, {"what": ["backdrop"]})["backdrop"]]
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)
                _hold(page, ".fm-it[data-fid=gallina]")
                if not page.evaluate(_MENU):
                    probs.append(f"{tag}: no se abre el menú del animal")
                probs += [f"{tag} menú: {x}" for x in page.evaluate(AUDIT, {"what": ["backdrop"]})["backdrop"]]
                page.keyboard.press("Escape")
                probs += [f"{tag}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 11. la partida no cambia
def test_export_matches_baseline():
    """Abrir y cerrar los menús (Esc, tocar fuera), oír con ellos y ver una pegatina en grande no guarda nada: la partida
    exportada es la de tests/e2e/baseline/export.json, sin claves nuevas; en la granja, el menú de un animal abierto y
    cerrado tampoco cambia nada."""
    base = C.load_baseline()
    assert base, f"falta {C.BASELINE}"
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        page.evaluate(_SPY)
        C.goto(page, f"#/doc/{R.TOPIC}?m=lista")
        page.wait_for_timeout(400)
        _hold(page, ".dl-r .dl-fg")
        _pick(page, "Oír")
        _hold(page, ".dl-r .dl-fg")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        C.goto(page, f"#/album/{R.ALBUM_DONE}")
        page.wait_for_timeout(400)
        _hold(page, ".al-st.got:not(.new)")
        _pick(page, "Ver grande")
        page.wait_for_timeout(700)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
        snap = C.export(page)
        probs += C.diff_exports(base, snap, allow_new=False)
        # la granja apunta la hora de la visita al entrar (farm:state.visit, lo de siempre): se compara antes y después del menú
        C.goto(page, "#/granja")
        page.wait_for_selector(".fm-it[data-fid=gallina]", timeout=9000)
        page.wait_for_timeout(500)
        before = C.export(page)
        _hold(page, ".fm-it[data-fid=gallina]")
        page.mouse.click(8, 400)
        page.wait_for_timeout(400)
        probs += [f"granja: {x}" for x in C.diff_exports(before, C.export(page), allow_new=False)]
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
