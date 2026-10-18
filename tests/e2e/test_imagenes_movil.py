"""Dibujos más grandes en el celular (la captura del dueño: en Globos, con el tema Familia, los dibujos se veían
diminutos en el móvil aunque en la tableta y el ordenador se veían bien).

Mide el lado del dibujo (el cuadrado más grande que cabe en su <img>, sin el relleno) en 360×740 y 390×844 contra un
mínimo, en Globos (con el tema Familia: árboles con etiquetas), Memoria, Letras locas, Lluvia de palabras, Oído de lince,
el repaso, «Escucha y elige» con dibujos de la lección y «Elige el dibujo» de Truco o trato. Comprueba que la zona de
juego cabe sin scroll en los celulares de la lista (320×568, 360×740, 375×667 iPhone SE, 390×844, 430×932 y tumbado
844×390 en Globos y Memoria; de pie en el resto), que los 4 globos no se tocan ni se salen, que un fallo (gris con ✗)
no hace bajar la página, y que en el iPad 820×1180 y en el ordenador 1280×800 ningún dibujo es más pequeño que antes
(las medidas de antes, del commit 2e7dc3f, van en BEFORE).

Y lo de la revisión: la tarjeta de escuchar no cambia de alto con un fallo de nombre largo (los globos no se mueven ni
encogen), el acierto sale en la misma frase (sin pastilla encima de los globos), la ✗ del fallo va arriba del globo
(fuera del dibujo), las banderas llevan su filete, ningún globo es gris, tumbado con los márgenes de un iPhone (47 px) y
en 667×375 y 568×320 los globos son grandes y no se baja, con «Reducir movimiento» los globos no saltan de tamaño, en
Memoria oscuro la cara del dibujo es blanca, y no se baja tras un fallo en «Escucha y elige» (también con «Texto más
grande» y en 1280×720), con dos pistas en el repaso ni en Letras con «Texto más grande»."""
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
    "opciones": {"360x740": 86, "390x844": 96},
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


def _page(vp, ui=None, **kw):
    if vp in PHONES:
        kind, opts = "phone", PHONES[vp]
    elif vp in BIG:
        kind, opts = BIG[vp]
    else:   # otro tamaño: «WxH» (de 1000 de ancho en adelante, el ordenador)
        w, h = map(int, vp.split("x"))
        kind = "desk" if w >= 1000 else "phone"
        opts = dict(viewport={"width": w, "height": h})
        if kind == "phone":
            opts.update(has_touch=True, is_mobile=True, device_scale_factor=2)
    ctx = C.new_context(kind, **opts, **kw)
    ctx.add_init_script(_RANDOM)
    page = ctx.new_page()
    C._attach(page, ctx._vocab_base)
    keys = C.seed_keys()
    keys["vocab:ui"] = json.dumps(dict(_UI, **(ui or {})))
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
        top: Math.round(bs[0].top),
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
                st = page.evaluate("""() => { const b = document.querySelector('#gm-air .gm-bal.no'), x = b.querySelector('.gm-bx');
                  const xr = x.getBoundingClientRect(), tr = b.querySelector('.gm-bal-i').getBoundingClientRect();
                  return {x: getComputedStyle(x).display, txt: document.getElementById('gm-ltxt').textContent,
                    bw: document.querySelector('#gm-air .gm-bal-b').offsetWidth, top: Math.round(document.querySelector('#gm-air .gm-bal-b').getBoundingClientRect().top),
                    over: Math.round(xr.bottom - tr.top), bg: getComputedStyle(x).backgroundColor}; }""")
                ok2, f2 = _fits(page)
                if st["x"] != "flex" or "Ese es" not in st["txt"]:
                    probs.append(f"{vp}: el fallo no sale en gris con ✗ ({st})")
                if not ok2:
                    probs.append(f"{vp}: tras un fallo, Globos baja {f2}")
                if st["bw"] != g["bw"] or abs(st["top"] - g["top"]) > 4:
                    probs.append(f"{vp}: tras un fallo los globos cambian de {g['bw']} a {st['bw']} px o se mueven de {g['top']} a {st['top']}")
                # la ✗, arriba del globo: como mucho pisa 4 px del cuadrado del dibujo
                if st["over"] > 4:
                    probs.append(f"{vp}: la ✗ del fallo tapa {st['over']} px del dibujo")
            else:
                probs.append(f"{vp}: no se pudo provocar un fallo en Globos")
            probs += [f"{vp}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


_GEO = """() => { const b = document.querySelector('#gm-air .gm-bal-b'), se = document.scrollingElement;
  return {bw: b ? b.offsetWidth : 0, top: b ? Math.round(b.getBoundingClientRect().top) : 0, n: document.querySelectorAll('#gm-air .gm-bal').length,
    side: b ? Math.min(...[...document.querySelectorAll('#gm-air .gm-bal-i img')].map(i => i.offsetWidth)) : 0,
    over: se.scrollHeight - innerHeight, dots: document.getElementById('gm-dots').getBoundingClientRect().bottom <= innerHeight,
    listenH: document.getElementById('gm-listen').offsetHeight}; }"""


def _miss_longest(page):
    """Toca el globo con el nombre más largo (si era el bueno, en la ronda siguiente). True si hubo fallo."""
    for _ in range(4):
        page.wait_for_function("() => document.querySelectorAll('#gm-air .gm-bal:not(:disabled)').length === 4 && !document.querySelector('.gm-reveal')", timeout=8000)
        page.wait_for_timeout(300)
        k = page.evaluate("""() => { const bs = [...document.querySelectorAll('#gm-air .gm-bal')];
          bs.sort((a, b) => b.getAttribute('aria-label').length - a.getAttribute('aria-label').length); return bs[0].dataset.k; }""")
        page.locator(f'#gm-air .gm-bal[data-k="{k}"]').click(force=True)
        page.wait_for_timeout(250)
        if page.locator("#gm-air .gm-bal.no").count():
            return True
        page.wait_for_timeout(2200)
    return False


def test_globos_steady_flags_and_sideways():
    """Países: un fallo con nombre largo («Ese es Países Bajos…») no cambia el alto de la tarjeta de escuchar, así que los
    globos ni se mueven ni encogen; el acierto sale en la frase de la tarjeta (sin nada encima de los globos); las banderas
    llevan su caja 4:3 con filete; ningún globo es gris. Tumbado con los márgenes de un iPhone (47 px), en 667×375 y en
    568×320: globos grandes, sin bajar. Con «Reducir movimiento» los globos salen ya con su tamaño final."""
    probs = []
    for vp in ["320x568", "360x740", "375x667", "390x844"]:
        page = _page(vp)
        try:
            _game(page, "globos", "paises")
            page.wait_for_function("() => document.querySelectorAll('#gm-air .gm-bal').length === 4", timeout=8000)
            _settle(page, 1300)
            g0 = page.evaluate(_GEO)
            fl = page.evaluate("""() => [...document.querySelectorAll('#gm-air .gm-bal-i img')].map(i => ({flag: i.classList.contains('gm-flag'),
              ratio: +(i.offsetWidth / i.offsetHeight).toFixed(2), ring: getComputedStyle(i).boxShadow !== 'none'}))""")
            if not all(f["flag"] and 1.25 <= f["ratio"] <= 1.42 and f["ring"] for f in fl):
                probs.append(f"{vp}: banderas sin su caja 4:3 con filete {fl}")
            cols = page.evaluate("""() => [...document.querySelectorAll('#gm-air .gm-bal')].map(b => {
              const m = getComputedStyle(b).getPropertyValue('--bc').trim().match(/^#(..)(..)(..)$/i); if (!m) return 99;
              const [r, g, bl] = m.slice(1).map(x => parseInt(x, 16)); return Math.max(r, g, bl) - Math.min(r, g, bl); })""")
            if min(cols) < 40:
                probs.append(f"{vp}: un globo es gris (se confunde con uno fallado) {cols}")
            if not _miss_longest(page):
                probs.append(f"{vp}: no se pudo provocar un fallo con Países")
                continue
            _settle(page, 600)
            g1 = page.evaluate(_GEO)
            if g1["bw"] != g0["bw"] or abs(g1["top"] - g0["top"]) > 4 or g1["listenH"] != g0["listenH"] or g1["over"] > 1:
                probs.append(f"{vp}: el fallo con nombre largo mueve los globos {g0} → {g1}")
            # el acierto: en la frase de la tarjeta de escuchar
            for k in range(4):
                b = page.locator(f'#gm-air .gm-bal[data-k="{k}"]')
                if b.is_disabled():
                    continue
                b.click(force=True)
                page.wait_for_timeout(250)
                if page.locator(".gm-reveal").count():
                    break
            rv = page.evaluate("""() => { const r = document.querySelector('.gm-reveal'); return r ? {inCard: !!r.closest('#gm-listen'), txt: r.textContent} : null; }""")
            g2 = page.evaluate(_GEO)
            if not rv or not rv["inCard"] or "=" not in rv["txt"]:
                probs.append(f"{vp}: el acierto no sale en la tarjeta de escuchar ({rv})")
            if g2["listenH"] != g0["listenH"] or g2["over"] > 1:
                probs.append(f"{vp}: el acierto cambia la tarjeta o hace bajar {g0} → {g2}")
            probs += [f"{vp}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    # tumbado: con los márgenes seguros de un iPhone tumbado (47 px a cada lado), y dos móviles más bajitos
    for vp, safe, need in [("844x390", 47, 95), ("667x375", 0, 80), ("568x320", 0, 60)]:
        page = _page(vp)
        try:
            _game(page, "globos", "familia")
            if safe:
                page.evaluate(f"() => {{ document.documentElement.style.setProperty('--safe-l', '{safe}px'); document.documentElement.style.setProperty('--safe-r', '{safe}px'); dispatchEvent(new Event('resize')); }}")
            page.wait_for_function("() => document.querySelectorAll('#gm-air .gm-bal').length === 4", timeout=8000)
            _settle(page, 1300)
            g = page.evaluate(_GEO)
            land = page.evaluate("() => !!document.querySelector('.gm-land')")
            if not land or g["side"] < need or g["over"] > 1 or not g["dots"]:
                probs.append(f"{vp} (márgenes {safe}): tumbado {g} (lado mínimo {need}, columna a la izquierda {land})")
        finally:
            page.context.close()
    # «Reducir movimiento»: el tamaño con el que salen los globos es el final (sin crecer de golpe)
    page = _page("360x740", reduced_motion="reduce")
    try:
        _game(page, "globos", "familia")
        seen = []
        for _ in range(16):
            g = page.evaluate(_GEO)
            if g["n"] == 4:
                seen.append(g["bw"])
            page.wait_for_timeout(60)
        page.wait_for_timeout(500)
        final = page.evaluate(_GEO)["bw"]
        if not seen or any(abs(b - final) > 1 for b in seen):
            probs.append(f"360x740 con «Reducir movimiento»: los globos cambian de tamaño al salir {seen} → {final}")
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


_LSDET = """() => { const se = document.scrollingElement, cur = document.querySelector('.ls-page:not(.ls-ghost)');
  const fb = cur && cur.querySelector('.ls-fb'), dock = document.querySelector('.ls .ls-dock');
  return {over: se.scrollHeight - innerHeight, miss: !!(cur && cur.querySelector('.ls-opt.is-miss')),
    fbBottom: fb && fb.textContent ? Math.round(fb.getBoundingClientRect().bottom) : null, dockTop: dock ? Math.round(dock.getBoundingClientRect().top) : null,
    marks: cur ? [...cur.querySelectorAll('.ls-opt .xm, .ls-opt .chk')].map(m => { const r = m.getBoundingClientRect(), i = m.closest('.ls-opt').querySelector('img');
      if (!i) return null; const q = i.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      return Math.round(Math.min(Math.hypot(cx - q.left, cy - q.bottom), Math.hypot(cx - q.right, cy - q.bottom))); }) : []}; }"""


def _lesson_miss(page):
    """«Escucha y elige» con dibujos: toca una opción que no es la buena. Devuelve las medidas tras el fallo, o None."""
    if not _lesson_pic_options(page):
        return None
    _settle(page, 400)
    # el orden es fijo (Math.random sembrado): se toca la primera; si era la buena, la siguiente pregunta con dibujos
    for _ in range(3):
        page.locator('.ls-page:not(.ls-ghost) .ls-opt:not(:disabled)').first.click()
        page.wait_for_timeout(1200)
        d = page.evaluate(_LSDET)
        if d["miss"]:
            return d
        if not _lesson_pic_options(page):
            return None
        _settle(page, 400)
    return None


def test_no_scroll_after_answers():
    """Tras un fallo en «Escucha y elige» con dibujos (la opción gris con ✗, «¡Casi! Es …» y el botón «Seguir») la
    lección no baja, en los móviles bajos, en 1280×720 y con «Texto más grande»; la ✓ y la ✗ van en una esquina de abajo del dibujo.
    El repaso con dos pistas no baja en 320×568 ni en 360×640, Letras con «Texto más grande» tampoco, y en Memoria oscuro
    la cara del dibujo es blanca."""
    probs = []
    for vp, big in [("375x667", False), ("360x640", False), ("360x740", False), ("1280x720", False),
                    ("375x667", True), ("360x640", True), ("390x844", True)]:
        page = _page(vp, ui={"text": "large"} if big else None)
        try:
            d = _lesson_miss(page)
            tag = f"{vp}{' (texto grande)' if big else ''}"
            if d is None:
                probs.append(f"{tag}: no se pudo fallar en «Escucha y elige» con dibujos")
            else:
                if d["over"] > 1:
                    probs.append(f"{tag}: tras un fallo en «Escucha y elige» la lección baja {d['over']} px")
                if d["fbBottom"] is not None and d["dockTop"] is not None and d["fbBottom"] > d["dockTop"] - 4:
                    probs.append(f"{tag}: la respuesta queda debajo del botón «Seguir» {d}")
                if not d["marks"] or any(m is None or m > 20 for m in d["marks"]):
                    probs.append(f"{tag}: la ✓ o la ✗ no van en la esquina del dibujo {d['marks']}")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    # el repaso: dos pistas
    for vp in ["320x568", "360x640"]:
        page = _page(vp)
        try:
            _fresh(page, "#/repaso")
            page.wait_for_selector(".rv-q .rv-pic", timeout=8000)
            _settle(page, 400)
            for _ in range(2):
                if page.locator('[data-rv="hint"]:visible').count():
                    page.locator('[data-rv="hint"]').first.click()
                    page.wait_for_timeout(500)
            ok, f = _fits(page)
            n = page.locator(".rv-h").count()
            if n < 2 or not ok:
                probs.append(f"{vp}: el repaso con {n} pistas baja {f}")
        finally:
            page.context.close()
    # Letras con «Texto más grande»
    page = _page("360x640", ui={"text": "large"})
    try:
        _game(page, "letras", "familia")
        page.wait_for_selector(".gm-lt-pic img", timeout=8000)
        _settle(page, 600)
        ok, f = _fits(page)
        if not ok:
            probs.append(f"360x640 (texto grande): Letras baja {f}")
    finally:
        page.context.close()
    # Memoria oscuro: la cara del dibujo, blanca (los dibujos opacos de familia no quedan como un rectángulo blanco)
    page = _page("390x844", color_scheme="dark")
    try:
        _game(page, "memoria", "familia")
        page.wait_for_selector("#gm-board .gm-mc", timeout=8000)
        _settle(page, 500)
        bg = page.evaluate("() => [...new Set([...document.querySelectorAll('.gm-mc-face.k-img')].map(f => getComputedStyle(f).backgroundColor))]")
        if bg != ["rgb(255, 255, 255)"]:
            probs.append(f"390x844 oscuro: caras de Memoria con dibujo {bg}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
