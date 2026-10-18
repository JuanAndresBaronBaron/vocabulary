"""Dibujos más grandes en el celular (la captura del dueño: en Globos, con el tema Familia, los dibujos se veían
diminutos en el móvil aunque en la tableta y el ordenador se veían bien).

Mide el lado del dibujo (el cuadrado más grande que cabe en su <img>, sin el relleno) en 360×740 y 390×844 contra un
mínimo, en Globos (con el tema Familia: árboles con etiquetas), Memoria, Letras locas, Lluvia de palabras, Oído de lince,
el repaso, «Escucha y elige» con dibujos de la lección y «Elige el dibujo» de Truco o trato. Comprueba que la zona de
juego cabe sin scroll en los celulares de la lista (320×568, 360×740, 375×667 iPhone SE, 390×844, 430×932 y tumbado
844×390 en Globos y Memoria; de pie en el resto), que los 4 globos no se tocan ni se salen, que un fallo (gris con ✗)
no hace bajar la página, y que en el iPad 820×1180 y en el ordenador 1280×800 ningún dibujo es más pequeño que antes
(las medidas de antes, del commit 2e7dc3f, van en BEFORE)."""
from __future__ import annotations

import json

import common as C

PHONES = {
    "320x568": dict(viewport={"width": 320, "height": 568}, has_touch=True, is_mobile=True, device_scale_factor=2),
    "360x740": dict(viewport={"width": 360, "height": 740}, has_touch=True, is_mobile=True, device_scale_factor=3),
    "375x667": dict(viewport={"width": 375, "height": 667}, has_touch=True, is_mobile=True, device_scale_factor=2),
    "390x844": dict(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True, device_scale_factor=3),
    "430x932": dict(viewport={"width": 430, "height": 932}, has_touch=True, is_mobile=True, device_scale_factor=3),
    "844x390": dict(viewport={"width": 844, "height": 390}, has_touch=True, is_mobile=True, device_scale_factor=3),
}
BIG = {
    "820x1180": ("phone", dict(viewport={"width": 820, "height": 1180}, has_touch=True, is_mobile=True, device_scale_factor=2)),
    "1280x800": ("desk", {}),
}
PORTRAIT = [k for k in PHONES if k != "844x390"]

# lado mínimo del dibujo (px CSS) en los dos móviles de referencia; antes: Globos 60, Memoria 78/86, Letras 86,
# Lluvia 49, Lince 68/76, repaso 101/104, «Escucha y elige» 42, «Elige el dibujo» 76
MIN = {
    "globos":   {"360x740": 110, "390x844": 120, "320x568": 80, "375x667": 110, "430x932": 120, "844x390": 90},
    "memoria":  {"360x740": 86, "390x844": 95},
    "letras":   {"360x740": 150, "390x844": 170},
    "lluvia":   {"360x740": 56, "390x844": 62},
    "lince":    {"360x740": 110, "390x844": 120},
    "repaso":   {"360x740": 160, "390x844": 180},
    "opciones": {"360x740": 90, "390x844": 96},
    "hoja-pic": {"360x740": 85, "390x844": 95},
}
# lo que medían antes (commit 2e7dc3f) en la tableta y en el ordenador: no puede bajar
BEFORE = {
    "820x1180": {"globos": 76, "memoria": 112, "letras": 102, "lluvia": 62, "lince": 100, "repaso": 104, "opciones": 42, "hoja-pic": 76},
    "1280x800": {"globos": 76, "memoria": 112, "letras": 102, "lluvia": 62, "lince": 100, "repaso": 104, "opciones": 42, "hoja-pic": 76},
}

# la explicación de cada juego y las pistas, ya vistas (no tapan nada); Math.random fijo (las mismas palabras)
_UI = {"hints": {k: 1000 for k in ["fm-regadera", "gm-peek", "ls-swipe", "rv-swipe", "fm-lift", "doc-swipe", "map-peek", "al-swipe"]},
       "gmIntro": ["memoria", "lluvia", "globos", "letras", "lince"]}
_RANDOM = r"""(() => { let a = 20261018;
  Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();"""
_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""
# lado del dibujo: el cuadrado más grande que cabe en el <img> (sin relleno ni borde), de cada <img> visible
_SIDES = """sel => [...document.querySelectorAll(sel)].filter(i => i.offsetWidth && getComputedStyle(i).display !== 'none').map(i => {
  const cs = getComputedStyle(i), p = k => parseFloat(cs[k]) || 0;
  const w = i.offsetWidth - p('paddingLeft') - p('paddingRight') - p('borderLeftWidth') - p('borderRightWidth');
  const h = i.offsetHeight - p('paddingTop') - p('paddingBottom') - p('borderTopWidth') - p('borderBottomWidth');
  return Math.round(Math.min(w, h)); })"""
_FIT = """() => { const se = document.scrollingElement;
  return {sh: se.scrollHeight, ih: innerHeight, sw: se.scrollWidth, iw: innerWidth}; }"""


def _page(vp):
    if vp in PHONES:
        kind, opts = "phone", PHONES[vp]
    else:
        kind, opts = BIG[vp]
    ctx = C.new_context(kind, **opts)
    ctx.add_init_script(_RANDOM)
    page = ctx.new_page()
    C._attach(page, ctx._vocab_base)
    keys = C.seed_keys()
    keys["vocab:ui"] = json.dumps(_UI)
    C.seed(page, keys)
    return page


def _fresh(page, h):
    """Abre la ruta desde cero (por una página en blanco: ninguna guarda de salida se queda con la ruta)."""
    page.goto(C.base_url(page) + "/__blank", wait_until="domcontentloaded")
    C.goto(page, h)


def _game(page, g, topic=None):
    if topic:
        page.evaluate("t => localStorage.setItem('games:topic', JSON.stringify(t))", topic)
    _fresh(page, "#/juegos")
    page.locator(f'.gm-card[data-g="{g}"]').click()
    page.wait_for_function("g => document.documentElement.dataset.gmPlay === g", arg=g, timeout=8000)
    page.wait_for_timeout(300)
    if page.locator(".gm-intro .gm-go").count():
        page.locator(".gm-intro .gm-go").click()


def _settle(page, ms=700):
    page.wait_for_timeout(ms)
    page.evaluate(_FINISH)
    page.wait_for_timeout(80)


def _sides(page, sel):
    return page.evaluate(_SIDES, sel)


def _fits(page):
    f = page.evaluate(_FIT)
    return f["sh"] <= f["ih"] + 1 and f["sw"] <= f["iw"] + 1, f


def _globos(page):
    _game(page, "globos", "familia")
    page.wait_for_function("() => document.querySelectorAll('#gm-air .gm-bal').length === 4", timeout=8000)
    _settle(page, 1300)
    return page.evaluate("""() => { const air = document.getElementById('gm-air').getBoundingClientRect();
      const bs = [...document.querySelectorAll('#gm-air .gm-bal-b')].map(b => b.getBoundingClientRect());
      const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
      let touch = 0; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) if (hit(bs[i], bs[j])) touch++;
      const out = bs.filter(b => b.left < air.left - 1 || b.right > air.right + 1 || b.top < air.top - 1 || b.bottom > air.bottom + 1).length;
      const d = document.getElementById('gm-dots').getBoundingClientRect();
      return {touch, out, n: bs.length, dots: d.bottom <= innerHeight, bw: document.querySelector('#gm-air .gm-bal-b').offsetWidth,
        names: [...document.querySelectorAll('#gm-air .gm-bal')].map(b => b.getAttribute('aria-label'))}; }""")


def test_globos_big_drawings_on_phones():
    """Globos (tema Familia) en los 6 celulares: el dibujo mide al menos MIN (≥ 120 px en 390×844, el doble de lado que
    antes), sin scroll, con los 4 globos dentro de su zona y sin tocarse; los nombres accesibles siguen ahí; un fallo
    (gris con ✗ y otra frase en la tarjeta de escuchar) no hace bajar la página ni encoge los globos de golpe."""
    probs = []
    for vp in PHONES:
        page = _page(vp)
        try:
            g = _globos(page)
            sides = _sides(page, "#gm-air .gm-bal-i img")
            ok, f = _fits(page)
            if len(sides) != 4 or min(sides) < MIN["globos"][vp]:
                probs.append(f"{vp}: dibujos de Globos {sides} (mínimo {MIN['globos'][vp]})")
            if not ok:
                probs.append(f"{vp}: Globos no cabe sin scroll {f}")
            if g["touch"] or g["out"] or not g["dots"]:
                probs.append(f"{vp}: globos que se tocan {g['touch']}, que se salen {g['out']}, puntos a la vista {g['dots']}")
            if not all(n and n.startswith("Globo ") and ": " in n for n in g["names"]):
                probs.append(f"{vp}: nombres de los globos {g['names']}")
            # un fallo: el globo en gris con ✗, la frase «Ese es …» en la tarjeta de escuchar y nada se sale. Desde fuera
            # no se sabe cuál es el bueno: se toca el primero libre; si era el bueno, se espera a la ronda siguiente
            for _ in range(4):
                page.wait_for_function("() => document.querySelectorAll('#gm-air .gm-bal:not(:disabled)').length === 4 && !document.querySelector('.gm-reveal')", timeout=8000)
                page.wait_for_timeout(300)
                page.locator('#gm-air .gm-bal[data-k="0"]').click(force=True)
                page.wait_for_timeout(200)
                if page.locator("#gm-air .gm-bal.no").count():
                    break
                page.wait_for_timeout(2200)
            _settle(page, 700)
            if page.locator("#gm-air .gm-bal.no").count():
                st = page.evaluate("""() => { const b = document.querySelector('#gm-air .gm-bal.no');
                  return {x: getComputedStyle(b.querySelector('.gm-bx')).display, txt: document.getElementById('gm-ltxt').textContent,
                    bw: document.querySelector('#gm-air .gm-bal-b').offsetWidth}; }""")
                ok2, f2 = _fits(page)
                if st["x"] != "flex" or "Ese es" not in st["txt"]:
                    probs.append(f"{vp}: el fallo no sale en gris con ✗ ({st})")
                if not ok2:
                    probs.append(f"{vp}: tras un fallo, Globos baja {f2}")
                if abs(st["bw"] - g["bw"]) > 0.15 * g["bw"]:
                    probs.append(f"{vp}: tras un fallo los globos cambian de {g['bw']} a {st['bw']} px")
            else:
                probs.append(f"{vp}: no se pudo provocar un fallo en Globos")
            probs += [f"{vp}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_globos_tablet_and_desktop_not_smaller():
    """iPad 820×1180 y ordenador 1280×800: los dibujos de Globos no son más pequeños que antes (76 px), sin scroll."""
    probs = []
    for vp in BIG:
        page = _page(vp)
        try:
            g = _globos(page)
            sides = _sides(page, "#gm-air .gm-bal-i img")
            ok, f = _fits(page)
            if len(sides) != 4 or min(sides) < BEFORE[vp]["globos"]:
                probs.append(f"{vp}: dibujos de Globos {sides} (antes {BEFORE[vp]['globos']})")
            if not ok or g["touch"] or g["out"]:
                probs.append(f"{vp}: Globos {f} · se tocan {g['touch']} · se salen {g['out']}")
            probs += [f"{vp}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def _lince_pics(page):
    """Oído de lince hasta una ronda con dibujos (las rondas sin dibujo enseñan solo la palabra)."""
    _game(page, "lince")
    for _ in range(8):
        page.wait_for_function("() => document.querySelectorAll('#ln-cards .ln-c').length === 2", timeout=8000)
        page.wait_for_timeout(400)
        if page.locator("#ln-cards .lx-pic img").count():
            return True
        page.locator('#ln-cards .ln-c[data-i="0"]').click()
        page.wait_for_timeout(300)
        if page.locator("#ln-go:visible").count():
            page.locator("#ln-go").click()
        page.wait_for_timeout(1800)
    return False


def _games(page, vp, probs, check_fit):
    def need(name, sides, ref):
        if not sides:
            probs.append(f"{vp}: {name} sin dibujos")
        elif ref is not None and min(sides) < ref:
            probs.append(f"{vp}: {name} {sorted(sides)[:3]} (mínimo {ref})")

    def fit(name):
        ok, f = _fits(page)
        if check_fit and not ok:
            probs.append(f"{vp}: {name} no cabe sin scroll {f}")

    lim = lambda k: MIN[k].get(vp, BEFORE.get(vp, {}).get(k))   # noqa: E731
    # Memoria: 4 filas de 3 cartas que llenan el alto (tumbado, 2 de 6); se mide la cara del dibujo
    _game(page, "memoria", "animales")
    page.wait_for_selector("#gm-board .gm-mc", timeout=8000)
    _settle(page, 600)
    need("Memoria", _sides(page, "#gm-board .gm-mc-face img"), lim("memoria"))
    fit("Memoria")
    over = page.evaluate("""() => [...document.querySelectorAll('.gm-mw')].filter(e => e.scrollWidth > e.parentNode.clientWidth).map(e => e.textContent)""")
    if over:
        probs.append(f"{vp}: palabras que se salen de su carta en Memoria: {over}")
    # Letras locas
    _game(page, "letras", "familia")
    page.wait_for_selector(".gm-lt-pic img", timeout=8000)
    _settle(page, 500)
    need("Letras", _sides(page, ".gm-lt-pic img"), lim("letras"))
    if vp != "844x390":
        fit("Letras")
    # Lluvia de palabras
    _game(page, "lluvia", "familia")
    page.wait_for_selector("#gm-sky .gm-bub-i img", timeout=8000)
    page.wait_for_timeout(1500)
    need("Lluvia", _sides(page, "#gm-sky .gm-bub-i img"), lim("lluvia"))
    if vp != "844x390":
        fit("Lluvia")
    # Oído de lince
    if _lince_pics(page):
        _settle(page, 300)
        need("Oído de lince", _sides(page, "#ln-cards .lx-pic img"), lim("lince"))
        if vp != "844x390":
            fit("Oído de lince")
    else:
        probs.append(f"{vp}: Oído de lince sin una ronda con dibujos")


def test_games_drawings_on_phones():
    """Memoria, Letras locas, Lluvia y Oído de lince: dibujos de al menos MIN en 360×740 y 390×844, sin scroll en los
    celulares de pie (Memoria también tumbado) y las palabras de Memoria dentro de su carta."""
    probs = []
    for vp in PHONES:
        page = _page(vp)
        try:
            _games(page, vp, probs, check_fit=True)
            probs += [f"{vp}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_games_tablet_and_desktop_not_smaller():
    """iPad y ordenador: los dibujos de Memoria, Letras, Lluvia y Oído de lince no son más pequeños que antes."""
    probs = []
    for vp in BIG:
        page = _page(vp)
        try:
            _games(page, vp, probs, check_fit=True)
            probs += [f"{vp}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def _lesson_pic_options(page):
    """Lección A1-001 hasta «Escucha y elige» con dibujos (contestando a lo que salga antes)."""
    _fresh(page, "#/leccion/A1-001")
    page.wait_for_selector(".ls-page", timeout=8000)
    cur = ".ls-page:not(.ls-ghost)"
    for _ in range(40):
        page.wait_for_timeout(250)
        if page.locator(f"{cur} .ls-opt.has-pic").count():
            return True
        if page.locator(".ls-end").count():
            return False
        if page.locator(f"{cur} .ls-learn").count():
            page.locator("#ls-go").click()
            page.wait_for_timeout(450)
            continue
        if page.evaluate(f"() => {{ const b = [...document.querySelectorAll('{cur} .ls-opt')].find(x => !x.disabled); if (b) b.click(); return !!b; }}"):
            page.wait_for_timeout(1700)
        if page.locator("#ls-go:visible").count():
            page.locator("#ls-go").click()
            page.wait_for_timeout(450)
    return False


def _halloween_pic_sheet(page):
    """Truco o trato: abre puertas hasta una hoja «Elige el dibujo» (vista previa con ?season, no guarda ni paga)."""
    _fresh(page, "#/temporada?season=halloween")
    page.wait_for_selector("#app .ss-door", timeout=8000)
    for i in range(10):
        page.click(f"#app .ss-door[data-i='{i}']")
        page.wait_for_selector("dialog#ss-q[open] .ss-q-b", timeout=6000)
        page.wait_for_timeout(450)
        if page.evaluate("() => !!(vocabSeason.state.sheet && vocabSeason.state.sheet.mode === 'pic')"):
            return True
        page.click("dialog#ss-q [data-close]")
        page.wait_for_function("() => !document.querySelector('dialog#ss-q[open]') && !vocabSeason.state.sheet", timeout=10000)
        page.wait_for_timeout(250)
    return False


def _others(page, vp, probs, check_fit):
    lim = lambda k: MIN[k].get(vp, BEFORE.get(vp, {}).get(k))   # noqa: E731
    # el repaso: la tarjeta con dibujo
    _fresh(page, "#/repaso")
    page.wait_for_selector(".rv-q .rv-pic", timeout=8000)
    _settle(page, 500)
    s = _sides(page, ".rv-q .rv-pic")
    if not s or (lim("repaso") and min(s) < lim("repaso")):
        probs.append(f"{vp}: dibujo del repaso {s} (mínimo {lim('repaso')})")
    ok, f = _fits(page)
    if check_fit and not ok:
        probs.append(f"{vp}: el repaso no cabe sin scroll {f}")
    # la lección: «Escucha y elige» con dibujos
    if _lesson_pic_options(page):
        _settle(page, 300)
        s = _sides(page, ".ls-page:not(.ls-ghost) .ls-opt img")
        if len(s) != 4 or (lim("opciones") and min(s) < lim("opciones")):
            probs.append(f"{vp}: dibujos de «Escucha y elige» {s} (mínimo {lim('opciones')})")
        ok, f = _fits(page)
        if check_fit and not ok:
            probs.append(f"{vp}: «Escucha y elige» con dibujos no cabe sin scroll {f}")
    else:
        probs.append(f"{vp}: la lección A1-001 no llegó a «Escucha y elige» con dibujos")
    # Truco o trato: «Elige el dibujo»
    if _halloween_pic_sheet(page):
        s = _sides(page, "dialog#ss-q .ss-op img")
        if len(s) != 3 or (lim("hoja-pic") and min(s) < lim("hoja-pic")):
            probs.append(f"{vp}: dibujos de «Elige el dibujo» {s} (mínimo {lim('hoja-pic')})")
    else:
        probs.append(f"{vp}: ninguna puerta de Truco o trato pidió elegir el dibujo")


def test_review_lesson_season_drawings():
    """El repaso, «Escucha y elige» con dibujos y «Elige el dibujo»: al menos MIN en 360×740 y 390×844; el repaso y la
    lección siguen cabiendo sin scroll en los celulares de pie; en el iPad y el ordenador, no más pequeños que antes."""
    probs = []
    for vp in ["360x740", "390x844", "320x568", "375x667", "430x932", "820x1180", "1280x800"]:
        page = _page(vp)
        try:
            _others(page, vp, probs, check_fit=vp in PORTRAIT)
            probs += [f"{vp}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)
