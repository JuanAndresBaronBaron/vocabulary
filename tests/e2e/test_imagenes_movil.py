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
grande» y en 1280×720), con dos pistas en el repaso ni en Letras con «Texto más grande».

Y las pantallas de F5 con dibujos, con el mismo criterio (MIN_F5): la bandeja de Frases mágicas (con los árboles de
familia recortados), las plantillas del Buzón, las tarjetas de Juegos del Buzón y de Frases y la fila «Tus atajos» de Hoy,
sin scroll donde antes no lo había; y img/fam2 fuera de SHELL, en «Descargar todo» y sin conexión una vez visto.

El repaso tiene, además de la tarjeta de siempre (palabras de la caja 4 o más), las pantallas que corrige la app: en
«Escucha y elige» (caja 0) los 4 dibujos son tan grandes como los de la lección (MIN «opciones») y en «¿Cuál es…?» (caja 1)
y las letras (cajas 2-3) el dibujo de la tarjeta, como el de siempre (MIN «repaso»); caben sin scroll y, tras un fallo
(gris con ✗, la respuesta y «Seguir»), tampoco se baja, en los mismos tamaños que la lección y en 320×568, sin que se
vaya el dibujo (48 px o más; en «Escucha y elige», 64) ni la palabra, su IPA o su audio. Lo que hace sitio tras un
fallo no pasa a la tarjeta de siempre que viene detrás."""
from __future__ import annotations

import json

import common as C
import test_f3_repaso as V
import test_repaso_metodo as RM

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


# el repaso con las tres pantallas que corrige la app, una tras otra: Perro (caja 0, «Escucha y elige»), Gato (caja 1,
# «¿Cuál es…?») y Conejo (caja 2, las letras); después, tarjetas de siempre
_TASKS = RM._keys(RM._ent("Perro", 0, RM.T - 6), RM._ent("Gato", 1, RM.T - 5), RM._ent("Conejo", 2, RM.T - 4),
                  RM._fillers(4, skip=("Perro", "Gato", "Conejo")))
# lo que se mide en cada una: los 4 dibujos de «Escucha y elige» (como los de la lección) o el dibujo de la tarjeta
_TASK_PIC = {"listen": ("#rv-dock .rv-opt.pic img", "opciones"), "pick": ("#rv-card .rv-pic", "repaso"), "spell": ("#rv-card .rv-pic", "repaso")}
# tras un fallo se ve, a la vez y sin bajar, el dibujo, la palabra, su IPA y su audio (metodo.md, regla 6): el dibujo de la
# tarjeta nunca por debajo de 48 px; en «Escucha y elige», el de la buena (con la ✓) nunca por debajo de 64 px
_MISS_PIC = {"listen": ("#rv-dock .rv-opt.pic.is-ok img", 64), "pick": ("#rv-card .rv-pic", 48), "spell": ("#rv-card .rv-pic", 48)}
_MISS_SEEN = """() => { const q = s => document.querySelector(s);
  const inside = e => { if (!e || !e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return false;
    const r = e.getBoundingClientRect(); return r.top >= -0.5 && r.left >= -0.5 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5; };
  return {word: inside(q('#rv-card .rv-ans .rv-word')), ipa: inside(q('#rv-card .rv-ans .rv-ipa')), spk: inside(q('#rv-card .rv-spk')),
    slow: inside(q('#rv-card .rv-slow'))}; }"""
# cómo queda la tarjeta de siempre: lo que fitRoom pone en #rv, la pila de detrás y los márgenes
_RV_LOOK = """() => { const rv = document.getElementById('rv');
  return {cls: [...rv.classList].filter(c => c !== 'rv').sort(), backs: [...document.querySelectorAll('#rv-stack .rv-back')].map(b => getComputedStyle(b).display),
    stage: getComputedStyle(document.querySelector('.rv-stage')).paddingBottom, gap: getComputedStyle(document.querySelector('.rv-dock')).rowGap}; }"""


def _miss_probs(page, kind):
    """Lo que falta tras un fallo en la pantalla kind del repaso: sin scroll, el dibujo visible y grande (_MISS_PIC) y la
    palabra, su IPA, el altavoz y la tortuga dentro de la pantalla."""
    out = []
    ok, f = _fits(page)
    if not ok:
        out.append(f"tras un fallo en el repaso ({kind}) se baja {f}")
    sel, least = _MISS_PIC[kind]
    s = _sides(page, sel)
    if len(s) != 1 or s[0] < least:
        out.append(f"tras un fallo en el repaso ({kind}) el dibujo no se ve o es pequeño: {s} (mínimo {least})")
    seen = page.evaluate(_MISS_SEEN)
    if not all(seen.values()):
        out.append(f"tras un fallo en el repaso ({kind}) no se ve todo en la pantalla {seen}")
    return out


def _review(page, keys, ui=None):
    """#/repaso con la partida de ejemplo y el repaso de keys (los mismos ajustes de _page)."""
    keys = dict(keys)
    keys["vocab:ui"] = json.dumps(dict(_UI, **(ui or {})))
    C.seed(page, keys, hash="#/repaso")
    page.wait_for_selector("#rv-card", timeout=10000)


def _review_tasks(page, at):
    """Recorre «Escucha y elige», «¿Cuál es…?» y las letras (de _TASKS, ya abierto): at(kind, "q") con la pregunta y
    at(kind, "miss") tras fallarla con el dedo (una opción mala; en las letras, dos fichas malas); luego «Seguir»."""
    for kind in ("listen", "pick", "spell"):
        page.wait_for_function("k => { const s = vocabReview.state; return !!s && s.kind === k && !s.graded; }", arg=kind, timeout=8000)
        _settle(page, 500)
        at(kind, "q")
        st = page.evaluate("() => vocabReview.state")
        if kind == "spell":
            for i in [i for i, t in enumerate(st["tiles"]) if t.lower() != st["letters"][0].lower()][:2]:
                page.locator(f'#rv-dock .rv-tile[data-i="{i}"]').click()
                page.wait_for_timeout(120)
        else:
            page.locator(f'#rv-dock .rv-opt[data-i="{(st["right"] + 1) % 4}"]').click()
        page.wait_for_function("() => vocabReview.state.graded", timeout=4000)
        _settle(page, 500)
        at(kind, "miss")
        page.locator('#rv-dock [data-rv="tnext"]').click()


def _others(page, vp, probs, check_fit):
    lim = lambda k: MIN[k].get(vp, BEFORE.get(vp, {}).get(k))   # noqa: E731
    # el repaso: la tarjeta de siempre (palabras de la caja 4 o más), con dibujo
    _review(page, V._card_keys())
    page.wait_for_selector(".rv-q .rv-pic", timeout=8000)
    _settle(page, 500)
    s = _sides(page, ".rv-q .rv-pic")
    if not s or (lim("repaso") and min(s) < lim("repaso")):
        probs.append(f"{vp}: dibujo del repaso {s} (mínimo {lim('repaso')})")
    ok, f = _fits(page)
    if check_fit and not ok:
        probs.append(f"{vp}: el repaso no cabe sin scroll {f}")

    # y las que corrige la app, sin contestar: el dibujo tan grande como en la tarjeta (en «Escucha y elige», los 4 como
    # los de la lección) y sin scroll
    def task(kind, when):
        if when != "q":
            return
        sel, k = _TASK_PIC[kind]
        s = _sides(page, sel)
        if not s or (kind == "listen" and len(s) != 4) or (lim(k) and min(s) < lim(k)):
            probs.append(f"{vp}: dibujo del repaso ({kind}) {s} (mínimo {lim(k)})")
        ok, f = _fits(page)
        if check_fit and not ok:
            probs.append(f"{vp}: el repaso ({kind}) no cabe sin scroll {f}")
    _review(page, _TASKS)
    _review_tasks(page, task)
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
    """El repaso (la tarjeta de siempre y las que corrige la app), «Escucha y elige» con dibujos y «Elige el dibujo»: al
    menos MIN en 360×740 y 390×844; el repaso y la lección siguen cabiendo sin scroll en los celulares de pie; en el iPad
    y el ordenador, no más pequeños que antes."""
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
    En los mismos tamaños y en 320×568 (también con «Texto más grande», en oscuro y con las dos cosas), tras un fallo en
    las pantallas del repaso que corrige la app («Escucha y elige», «¿Cuál es…?» y las letras: gris con ✗, la respuesta
    y «Seguir») tampoco se baja, y se ven a la vez el dibujo (el de la tarjeta, de 48 px o más medido en el dibujo, sin
    el margen blanco que lleva en oscuro; en «Escucha y elige», el de la buena, de 64 px o más), la palabra, su IPA y
    su audio.
    El repaso con dos pistas no baja en 320×568 ni en 360×640, Letras con «Texto más grande» tampoco, y en Memoria oscuro
    la cara del dibujo es blanca."""
    probs = []
    # (la lección no se mira en 320×568: ahí solo el repaso, que ya lo prometía con la tarjeta de siempre)
    for vp, big, lesson, dark in [("375x667", False, True, False), ("360x640", False, True, False), ("360x740", False, True, False),
                                  ("1280x720", False, True, False), ("375x667", True, True, False), ("360x640", True, True, False),
                                  ("390x844", True, True, False), ("320x568", False, False, False), ("320x568", True, False, False),
                                  ("320x568", False, False, True), ("320x568", True, False, True)]:
        page = _page(vp, ui={"text": "large"} if big else None, **({"color_scheme": "dark"} if dark else {}))
        try:
            d = _lesson_miss(page) if lesson else None
            tag = f"{vp}{' (texto grande)' if big else ''}{' (oscuro)' if dark else ''}"
            if lesson and d is None:
                probs.append(f"{tag}: no se pudo fallar en «Escucha y elige» con dibujos")
            elif d is not None:
                if d["over"] > 1:
                    probs.append(f"{tag}: tras un fallo en «Escucha y elige» la lección baja {d['over']} px")
                if d["fbBottom"] is not None and d["dockTop"] is not None and d["fbBottom"] > d["dockTop"] - 4:
                    probs.append(f"{tag}: la respuesta queda debajo del botón «Seguir» {d}")
                if not d["marks"] or any(m is None or m > 20 for m in d["marks"]):
                    probs.append(f"{tag}: la ✓ o la ✗ no van en la esquina del dibujo {d['marks']}")

            # el repaso: un fallo en cada pantalla que corrige la app
            def task(kind, when):
                if when == "miss":
                    probs.extend(f"{tag}: {e}" for e in _miss_probs(page, kind))
            _review(page, _TASKS, ui={"text": "large"} if big else None)
            _review_tasks(page, task)
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    # el repaso: dos pistas (en la tarjeta de siempre)
    for vp in ["320x568", "360x640"]:
        page = _page(vp)
        try:
            _review(page, V._card_keys())
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



def test_flip_card_after_a_miss_looks_fresh():
    """Lo que hace sitio tras un fallo (los márgenes justos, la respuesta más junta, sin las tarjetas de detrás) es de esa
    tarjeta: la tarjeta de siempre que viene detrás (#rv es el mismo en todo el repaso) se ve como una recién abierta, con
    la pila de detrás y sus márgenes. Tras «¿Cuál es…?» fallada en 320×568 y tras «Escucha y elige» fallada en 360×640 con
    «Texto más grande»."""
    probs = []
    for vp, big, es, box in [("320x568", False, "Gato", 1), ("360x640", True, "Perro", 0)]:
        ui = {"text": "large"} if big else None
        tag = f"{vp}{' (texto grande)' if big else ''}"
        # una recién abierta: solo tarjetas de siempre (caja 4)
        page = _page(vp, ui=ui)
        try:
            _review(page, RM._keys(RM._fillers(5)), ui=ui)
            page.wait_for_function("() => vocabReview.state && vocabReview.state.kind === 'card'", timeout=8000)
            _settle(page, 600)
            fresh = page.evaluate(_RV_LOOK)
        finally:
            page.context.close()
        page = _page(vp, ui=ui)
        try:
            _review(page, RM._keys(RM._ent(es, box, RM.T - 5), RM._fillers(4, skip=(es,))), ui=ui)
            kind = "pick" if box == 1 else "listen"
            st = page.wait_for_function("k => { const s = vocabReview.state; return s && s.kind === k && !s.graded ? s : null; }",
                                        arg=kind, timeout=8000).json_value()
            _settle(page, 500)
            page.locator(f'#rv-dock .rv-opt[data-i="{(st["right"] + 1) % 4}"]').click()
            page.wait_for_function("() => vocabReview.state.graded", timeout=4000)
            _settle(page, 500)
            miss = page.evaluate(_RV_LOOK)
            if not miss["cls"]:
                probs.append(f"{tag}: tras fallar ({kind}) no hacía falta sitio: la prueba no mira nada {miss}")
            probs.extend(f"{tag}: {e}" for e in _miss_probs(page, kind))
            page.locator('#rv-dock [data-rv="tnext"]').click()
            page.wait_for_function("() => vocabReview.state.kind === 'card' && !!document.querySelector('#rv-card .rv-q')", timeout=6000)
            _settle(page, 600)
            after = page.evaluate(_RV_LOOK)
            if after != fresh:
                probs.append(f"{tag}: la tarjeta de siempre tras fallar ({kind}) {after} no es como una recién abierta {fresh}")
            ok, f = _fits(page)
            if not ok:
                probs.append(f"{tag}: la tarjeta de siempre tras fallar baja {f}")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)

# ---------------------------------------------------------------- las pantallas de F5 con dibujos
# lado mínimo en los móviles: las fichas de Frases mágicas (antes 48 en 360 y 56 en 390), las plantillas del Buzón
# (antes 40), el dibujo de las piezas de «Tus atajos» en Hoy (24; en un móvil alto, 32) y las tarjetas de Juegos del Buzón
# y de Frases (iguales que las de los demás juegos). Frases y el Buzón llenan el ancho de su ficha: con 4 fichas en una
# fila no llegan a 96 px sin hacer bajar la pantalla, y Hoy no tiene sitio para piezas más altas en 390×844.
MIN_F5 = {
    "frases": {"360x740": 64, "390x844": 72, "430x932": 80},
    "buzon": {"360x740": 56, "390x844": 60, "430x932": 60},
    "atajos": {"360x740": 24, "390x844": 24, "430x932": 32},
}
BEFORE_F5 = {"820x1180": {"frases": 72, "buzon": 40, "atajos": 32}, "1280x800": {"frases": 72, "buzon": 40, "atajos": 32}}
# donde la pantalla ya bajaba antes (la tarjeta de la cena debajo de la bandeja; el Buzón con su explicación): ahí se mira
# que lo principal (la bandeja con «Otra frase», el botón de grabar) se vea sin bajar
SCROLLED_F5 = {"frases": {"360x740", "1280x800"}, "buzon": {"360x740"}}
# lo alto de la barra de pestañas cuando va abajo (móvil); en el ordenador va arriba: cuenta la ventana entera
_BAR_TOP = """() => { const b = document.querySelector('.tabbar'), r = b && b.offsetHeight ? b.getBoundingClientRect() : null;
  return r && r.top > innerHeight / 2 ? Math.round(r.top) : innerHeight; }"""
_BOTTOM = "sel => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().bottom) : null; }"
_FAM2 = """() => [...document.querySelectorAll('.ph-tile img')].filter(i => /fam_/.test(i.getAttribute('src') || '')).map(i =>
  ({src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0}))"""


def _white_px(page, sel):
    """Píxeles casi blancos (los tres canales ≥ 250) en la captura del primer elemento sel (None sin Pillow)."""
    try:
        import io
        from PIL import Image
    except ImportError:
        return None
    el = page.locator(sel).first
    if not el.count():
        return None
    im = Image.open(io.BytesIO(el.screenshot(animations="disabled"))).convert("RGB")
    return sum(1 for r, g, b in im.getdata() if r >= 250 and g >= 250 and b >= 250)


def _f5_keys():
    """La partida sembrada con tres atajos hechos hoy (para la fila de Hoy) y sus pistas ya vistas."""
    keys = C.seed_keys()
    day = C.day_num(C.FIXED_NOW)
    keys["vocab:sc"] = json.dumps({"v": 1, "k": {"en/juego:globos:animales": {"s": 4, "t": day}, "en/juego:memoria:w03": {"s": 3, "t": day},
                                                  "en/tema:w02:test": {"s": 2.5, "t": day}}, "row": {}, "o": {}, "sl": ""})
    keys["vocab:ui"] = json.dumps(dict(_UI, hints=dict(_UI["hints"], **{"sc-hold": 1000})))
    return keys


def _f5_screens(page, vp, probs, dark=False):
    tag = vp + (" oscuro" if dark else "")
    lim = lambda k: MIN_F5[k].get(vp, BEFORE_F5.get(vp, {}).get(k))   # noqa: E731

    def need(name, sides, ref, n=None):
        if not sides or (n and len(sides) != n):
            probs.append(f"{tag}: {name}: dibujos {sides}")
        elif ref and min(sides) < ref - (4 if dark else 0):   # en oscuro, la placa clara lleva un margen
            probs.append(f"{tag}: {name}: dibujos {sorted(sides)[:3]} (mínimo {ref})")

    def fit(name, key, main_sel):
        ok, f = _fits(page)
        if vp in SCROLLED_F5.get(key, ()):
            bottom, bar = page.evaluate(_BOTTOM, main_sel), page.evaluate(_BAR_TOP)
            if bottom is None or bottom > bar:
                probs.append(f"{tag}: {name}: {main_sel} queda debajo de la barra ({bottom} > {bar})")
        elif not ok:
            probs.append(f"{tag}: {name} baja {f} (antes cabía)")

    # Frases mágicas: la bandeja de dibujos (sin poner y con uno puesto en el hueco); los árboles de familia, recortados
    _fresh(page, "#/frases")
    page.wait_for_selector(".ph-tile img", timeout=8000)
    _settle(page)
    need("Frases mágicas", _sides(page, ".ph-tile img"), lim("frases"))
    fit("Frases mágicas", "frases", "#ph-next")
    fam = page.evaluate(_FAM2)
    for _ in range(10):
        if fam:
            break
        page.locator("#ph-next").click()
        page.wait_for_timeout(500)
        fam = page.evaluate(_FAM2)
    if not fam:
        probs.append(f"{tag}: Frases mágicas no sacó ninguna plantilla con la familia")
    elif not all("img/fam2/" in x["src"] and x["ok"] for x in fam):
        probs.append(f"{tag}: Frases mágicas no usa los árboles recortados (img/fam2/) o no cargan: {fam}")
    elif dark:
        # el fondo blanco de los árboles (PNG opacos) se funde con la placa clara: ningún rectángulo blanco dentro
        white = _white_px(page, ".ph-tile img[src*='img/fam2/']")
        if white is not None and white > 8:
            probs.append(f"{tag}: Frases mágicas: el árbol de familia lleva un rectángulo blanco sobre la placa ({white} px blancos)")
    page.locator(".ph-tile").first.click()
    page.wait_for_timeout(700)
    _settle(page)
    need("Frases mágicas con el hueco lleno", _sides(page, ".ph-tile img"), lim("frases"))
    fit("Frases mágicas con el hueco lleno", "frases", "#ph-next")
    # el Buzón: las 4 plantillas con su dibujo
    _fresh(page, "#/buzon")
    page.wait_for_selector(".mb-tpl img", timeout=8000)
    _settle(page)
    need("plantillas del Buzón", _sides(page, ".mb-tpl img"), lim("buzon"), 4)
    fit("el Buzón", "buzon", "#mb-rb")
    # Juegos: las tarjetas del Buzón y de Frases, como las de los demás juegos
    _fresh(page, "#/juegos")
    page.wait_for_selector('.gm-card[data-g="frases"] .gm-ci', timeout=8000)
    _settle(page)
    cards = {g: _sides(page, f'.gm-card[data-g="{g}"] .gm-ci') for g in ("globos", "memoria", "buzon", "frases")}
    if any(len(v) != 1 for v in cards.values()) or len({v[0] for v in cards.values()}) != 1 or cards["buzon"][0] < 56:
        probs.append(f"{tag}: dibujos de las tarjetas de Juegos distintos o pequeños: {cards}")
    # Hoy: la fila «Tus atajos» (y Hoy sin scroll, con la frase de la cena donde cabe). La segunda visita de la sesión:
    # en la primera sale el aviso de guardar en Google, que va antes que la frase de la cena
    _fresh(page, "")
    C.goto(page, "#/juegos")
    C.goto(page, "")
    page.wait_for_selector("#hm-sc .sc-p", timeout=8000)
    _settle(page, 600)
    need("«Tus atajos»", _sides(page, "#hm-sc .sc-pic>img"), lim("atajos"))
    ok, f = _fits(page)
    if not ok:
        probs.append(f"{tag}: Hoy con «Tus atajos» baja {f}")
    slots = page.evaluate("() => [...document.querySelectorAll('#hm-slots > .hm-slot')].filter(e => !e.hidden).map(e => e.dataset.slot)")
    if vp in ("390x844", "430x932") and "phrase" not in slots:
        probs.append(f"{tag}: Hoy pierde la frase de la cena ({slots})")


def test_f5_screens_big_drawings_on_phones():
    """Frases mágicas (la bandeja de dibujos, también con el hueco lleno), las plantillas del Buzón, las tarjetas de Juegos
    del Buzón y de Frases y la fila «Tus atajos» de Hoy en 360×740, 390×844 (también oscuro) y 430×932: el lado del
    dibujo llega a MIN_F5 (Frases 72 y el Buzón 60 en 390×844, antes 56 y 40), sin scroll donde antes no lo había (Hoy,
    Frases y el Buzón en 390×844; donde ya bajaba, la bandeja con «Otra frase» y el botón de grabar se ven sin bajar);
    Frases usa los árboles de familia recortados de img/fam2/; Hoy no pierde la frase de la cena."""
    probs = []
    for vp, dark in (("360x740", False), ("390x844", False), ("390x844", True), ("430x932", False)):
        page = _page(vp, color_scheme="dark" if dark else "light")
        try:
            C.seed(page, _f5_keys())
            _f5_screens(page, vp, probs, dark)
            probs += [f"{vp}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_f5_screens_tablet_and_desktop_not_smaller():
    """iPad 820×1180 y ordenador 1280×800: los dibujos de Frases, del Buzón, de las tarjetas de Juegos y de «Tus atajos»
    no son más pequeños que antes y no bajan donde antes no bajaban."""
    probs = []
    for vp in BIG:
        page = _page(vp)
        try:
            C.seed(page, _f5_keys())
            _f5_screens(page, vp, probs)
            probs += [f"{vp}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- img/fam2 sin conexión
_FAM2_FILES = sorted(p.name for p in (C.REPO / "img" / "fam2").glob("*.png"))


def test_fam2_in_download_all_and_offline():
    """Los árboles de familia recortados (img/fam2/, los de los juegos) no van en SHELL sino en vocab-media: «Descargar
    todo» los guarda los 26 (con los demás dibujos de los temas) y el service worker, sin conexión, sirve los que ya se
    vieron (una partida de Globos con Familia y luego sin red: los dibujos recortados cargan)."""
    import urllib.parse as up
    probs = []
    sw = (C.REPO / "sw.js").read_text(encoding="utf-8")
    if "img/fam2" in sw.split("const SHELL = [", 1)[1].split("];", 1)[0]:
        probs.append("img/fam2 está en SHELL (va en «Descargar todo»)")
    if len(_FAM2_FILES) != 26:
        probs.append(f"img/fam2 tiene {len(_FAM2_FILES)} dibujos (se esperaban 26)")
    # «Descargar todo» de verdad, sin audios y con solo el tema Familia (los demás temas, vacíos: más rápido)
    page = _page("390x844")
    try:
        def route(rt):
            path = up.urlparse(rt.request.url).path
            if path.startswith("/data/") and path.endswith(".json") and path.count("/") == 2:
                name = path.rsplit("/", 1)[1][:-5]
                if name not in ("familia", "index", "map", "game", "sprites", "lince", "season", "phrases") and not name.startswith("grammar_"):
                    return rt.fulfill(status=200, content_type="application/json", body='{"rows":[]}')
            return rt.fallback()
        page.route("**/*", route)
        page.evaluate("() => { window.audioIds = async () => []; }")
        res = page.evaluate("""async () => { await downloadAll(); for (let i = 0; i < 900 && offJob && !offJob.end; i++) await new Promise(r => setTimeout(r, 100));
          const m = await caches.open('vocab-media');
          return {end: offJob ? offJob.end : 'sin trabajo', fam2: (await m.keys()).map(r => decodeURIComponent(new URL(r.url).pathname)).filter(p => p.startsWith('/img/fam2/')).map(p => p.slice(10)).sort()}; }""")
        miss = [f for f in _FAM2_FILES if f not in res["fam2"]]
        if miss:
            probs.append(f"«Descargar todo» no guarda {len(miss)} árboles de img/fam2 ({miss[:4]}…): {res['end']}")
        probs += [f"Descargar todo: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    # el service worker: lo visto con red sale sin conexión
    srv = C.Server(C.ROOT, "localhost")
    ctx = C.new_context("phone", sw=True, server=srv)
    ctx.add_init_script(_RANDOM)
    page = ctx.new_page()
    stopped = False
    try:
        keys = C.seed_keys()
        keys["vocab:ui"] = json.dumps(_UI)
        C.seed(page, keys)
        page.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=20000)
        _game(page, "globos", "familia")
        page.wait_for_function("() => document.querySelectorAll('#gm-air .gm-bal-i img').length === 4", timeout=8000)
        page.wait_for_timeout(1500)
        seen = page.evaluate("() => [...document.querySelectorAll('#gm-air .gm-bal-i img')].map(i => i.getAttribute('src'))")
        if not seen or not all(s.startswith("img/fam2/") for s in seen):
            probs.append(f"Globos con Familia no usa img/fam2: {seen}")
        cached = page.evaluate("""async urls => { const m = await caches.open('vocab-media'), out = [];
          for (const u of urls) out.push(!!(await m.match(new URL(u, location.href).href))); return out; }""", seen)
        if not all(cached):
            probs.append(f"los árboles vistos no se guardaron en vocab-media: {list(zip(seen, cached))}")
        srv.stop()
        stopped = True
        ctx.set_offline(True)
        off = page.evaluate("""async urls => Promise.all(urls.map(u => new Promise(res => { const i = new Image();
          i.onload = () => res(i.naturalWidth > 0); i.onerror = () => res(false); i.src = u + '?off=' + Math.random(); })))""", seen)
        if not all(off):
            probs.append(f"sin conexión no salen los árboles ya vistos: {list(zip(seen, off))}")
    finally:
        try:
            ctx.set_offline(False)
        except Exception:  # noqa: BLE001
            pass
        ctx.close()
        if not stopped:
            srv.stop()
    assert not probs, "\n".join(probs)
