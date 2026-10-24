"""F2 entero (plan-doc §Navegación, §Modo foco, §Gestos «Partida»): la barra de 5 pestañas en cada ruta, tocar la
pestaña activa, la memoria de cada pestaña, los segmentos de Aprender y Jugar, las insignias con partidas sembradas a
propósito, la barra arriba en escritorio y abajo en el móvil, el modo foco (lección, repaso en marcha y partida), la
barra de arriba (idioma, monedas que abren la tienda y engranaje con Ajustes), lo que se quitó (js/fab.js, el zorro
flotante y el pie) y la pausa de las partidas: Esc o la ✕ abren «¿Paramos aquí?» (Seguir · Salir) y el juego se para.
Al final, sw.js con la versión subida y la partida exportada igual que la de la base tras una vuelta por todo."""
from __future__ import annotations

import copy
import json
import re

import common as C
import routes as R

TABS = ["hoy", "aprender", "jugar", "granja", "premios"]
_ROUTE_N = "window.__vocabRouteN || 0"
_H = 3600 * 1000

# lo que se ve de la barra de pestañas
_BAR = """() => { const nav = document.getElementById('tabbar'), r = nav.getBoundingClientRect();
  const vis = el => !!el && !!el.getClientRects().length && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
  return {role: (nav.querySelector('[role=tablist]') || nav).getAttribute('role'), land: nav.tagName === 'NAV' && !nav.hasAttribute('role'), shown: vis(nav), top: r.top, bottom: r.bottom, left: r.left, right: r.right,
    vw: innerWidth, vh: innerHeight,
    tabs: [...nav.querySelectorAll('[role=tab]')].map(a => ({id: a.dataset.nav, sel: a.getAttribute('aria-selected'), href: a.getAttribute('href')}))}; }"""
# barras y modo foco
_FOCUS = """() => { const vis = el => !!el && !!el.getClientRects().length && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
  const x = document.getElementById('fx-x');
  return {focus: document.documentElement.dataset.focus || '', tab: vis(document.getElementById('tabbar')), top: vis(document.querySelector('.topbar .tb-group')),
    flag: vis(document.getElementById('lang-b')), head: vis(document.getElementById('tabhead')), x: vis(x), acc: vis(document.getElementById('acc'))}; }"""
# insignias de la barra
_BADGES = """() => Object.fromEntries(['hoy', 'aprender', 'jugar', 'granja', 'premios'].map(id => {
  const a = document.getElementById('tab-' + id), b = a.querySelector('.tb-badge');
  return [id, {hidden: b.hidden || !b.getClientRects().length, dot: b.classList.contains('dot'), text: b.textContent, bg: getComputedStyle(b).backgroundColor,
    label: a.getAttribute('aria-label') || ''}]; }))"""


def _wait_route(page, n0, timeout=8000):
    page.wait_for_function(f"n => ({_ROUTE_N}) > n", arg=n0, timeout=timeout)
    C.settle(page, 200)


def _click_route(page, sel):
    n0 = page.evaluate(_ROUTE_N)
    page.locator(sel).first.click()
    _wait_route(page, n0)


def _expect_tab(name):
    if name == "hoy" or name.startswith("temporada"):    # F4d: la temporada es una pantalla de Hoy
        return "hoy"
    if name.startswith(("mapa", "repaso", "leccion", "doc-", "gramatica", "palabras")):
        return "aprender"
    if name.startswith(("juego", "album")):
        return "jugar"
    if name == "granja" or name.startswith("granja-"):   # F6h: el loro eco (#/loro) es una pantalla de la granja
        return "granja"
    if name in ("progreso", "mizorro"):
        return "premios"
    return None


def _blue(bg):
    m = re.match(r"rgba?\((\d+), (\d+), (\d+)", bg or "")
    if not m:
        return False
    r, g, b = (int(x) for x in m.groups())
    return b > r + 60 and b > g


# ---------------------------------------------------------------- partidas sembradas para las insignias
def _seed_badges(due=0, hungry=0, new_stickers=True):
    """La partida de ejemplo con exactamente `due` palabras pendientes hoy, `hungry` animales con hambre (24 h o más
    sin comer: 2❤️ o menos) y, si new_stickers es False, todas las pegatinas ya vistas."""
    d = copy.deepcopy(C.seed_data())
    today = C.day_num(C.FIXED_NOW)
    T = C._ms(C.FIXED_NOW)
    n = 0
    for x in d["srs:english"].values():
        if n < due:
            x["due"] = today - (n % 3)
            n += 1
        else:
            x["due"] = max(x["due"], today + 2)
    assert n == due, f"la partida tiene menos de {due} palabras"
    # todos los objetos que tiene, comidos hace 2 h, salvo los `hungry` primeros animales (hace 30 h)
    animals = ["conejo", "vaca", "gallina", "pato"]
    fed = {i: T - 2 * _H for i in d["game"]["owned"]}
    for i in animals[:hungry]:
        fed[i] = T - 30 * _H
    d["farm:state"]["fed"] = fed
    if not new_stickers:
        d["album:seen:english"] = {k: 2 for k in d["srs:english"]}
    return {k: C._dumps(v) for k, v in d.items()}


# ---------------------------------------------------------------- barra de pestañas
def test_tabs_selected_on_every_route():
    """En cada ruta (móvil y escritorio) hay un nav role=tablist con 5 role=tab y solo la de su sección tiene
    aria-selected=true; la marcada lleva a la raíz de lo que se ve y las otras a donde se quedaron."""
    probs = []
    for kind in ("phone", "desk"):
        page = C.new_page(kind)
        try:
            C.seed(page)
            for r in R.all_routes():
                C.goto(page, r["hash"])
                b = page.evaluate(_BAR)
                exp = _expect_tab(r["name"])
                if b["role"] != "tablist" or not b["land"]:
                    probs.append(f"{kind} {r['name']}: la lista de pestañas tiene role={b['role']} (nav como punto de referencia: {b['land']})")
                if [t["id"] for t in b["tabs"]] != TABS:
                    probs.append(f"{kind} {r['name']}: pestañas {[t['id'] for t in b['tabs']]}")
                sel = [t["id"] for t in b["tabs"] if t["sel"] == "true"]
                if sel != [exp]:
                    probs.append(f"{kind} {r['name']}: aria-selected en {sel}, se esperaba [{exp}]")
                if any(t["sel"] not in ("true", "false") for t in b["tabs"]):
                    probs.append(f"{kind} {r['name']}: aria-selected sin valor: {b['tabs']}")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_active_tab_scrolls_to_top():
    """Tocar la pestaña en la que ya estás sube al principio (sin cambiar de pantalla), en Palabras y en Juegos; desde
    una subpantalla (la ficha de un tema) vuelve a la raíz de la sección."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        for h, tab in (("#/palabras", "aprender"), ("#/juegos", "jugar")):
            C.goto(page, h)
            # una pantalla que casi cabe entera (Juegos desde F4) se alarga solo para la prueba: lo que se mira es la subida
            page.evaluate("() => { if (document.documentElement.scrollHeight - innerHeight < 300) document.getElementById('app').style.paddingBottom = '600px'; }")
            page.evaluate("scrollTo(0, Math.min(900, document.documentElement.scrollHeight - innerHeight))")
            page.wait_for_timeout(300)
            y0 = page.evaluate("scrollY")
            if y0 < 100:
                probs.append(f"{h}: la página no baja lo bastante para la prueba ({y0})")
                continue
            page.locator(f"#tab-{tab}").click()
            try:
                page.wait_for_function("scrollY < 2", timeout=4000)
            except Exception:  # noqa: BLE001
                probs.append(f"{h}: tocar la pestaña activa deja el scroll en {page.evaluate('scrollY')}")
            if "#/" + C.current_hash(page) != h:
                probs.append(f"{h}: tocar la pestaña activa cambia de pantalla a #/{C.current_hash(page)}")
        C.goto(page, f"#/doc/{R.TOPIC}")
        _click_route(page, "#tab-aprender")
        if C.current_hash(page) != "palabras":
            probs.append(f"desde la ficha, la pestaña activa lleva a #/{C.current_hash(page)} (se esperaba #/palabras)")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_each_tab_remembers_its_section():
    """Cada pestaña recuerda su sub-sección: Aprender › Gramática y Jugar › Álbum siguen ahí al volver desde otra
    pestaña; y también una subpantalla (la ficha de un tema, una página del álbum)."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/mapa")
        _click_route(page, ".seg a.seg-i[href='#/gramatica']")
        _click_route(page, "#tab-jugar")
        _click_route(page, ".seg a.seg-i[href='#/album']")
        _click_route(page, "#tab-hoy")
        _click_route(page, "#tab-aprender")
        if C.current_hash(page) != "gramatica":
            probs.append(f"Aprender vuelve a #/{C.current_hash(page)} (se esperaba #/gramatica)")
        _click_route(page, "#tab-jugar")
        if C.current_hash(page) != "album":
            probs.append(f"Jugar vuelve a #/{C.current_hash(page)} (se esperaba #/album)")
        # subpantallas
        _click_route(page, f"a[href='#/album/{R.ALBUM_DONE}']")
        _click_route(page, "#tab-aprender")
        _click_route(page, ".seg a.seg-i[href='#/palabras']")
        _click_route(page, f".doc[href='#/doc/{R.TOPIC}']")
        _click_route(page, "#tab-premios")
        b = page.evaluate(_BAR)
        hrefs = {t["id"]: t["href"] for t in b["tabs"]}
        if hrefs.get("aprender") != f"#/doc/{R.TOPIC}" or hrefs.get("jugar") != f"#/album/{R.ALBUM_DONE}":
            probs.append(f"los enlaces de las pestañas no apuntan a donde se quedaron: {hrefs}")
        _click_route(page, "#tab-aprender")
        if C.current_hash(page) != f"doc/{R.TOPIC}":
            probs.append(f"Aprender vuelve a #/{C.current_hash(page)} (se esperaba la ficha #/doc/{R.TOPIC})")
        _click_route(page, "#tab-jugar")
        if C.current_hash(page) != f"album/{R.ALBUM_DONE}":
            probs.append(f"Jugar vuelve a #/{C.current_hash(page)} (se esperaba #/album/{R.ALBUM_DONE})")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_segments_go_to_their_routes():
    """Los segmentos de Aprender (Repasar · Camino · Palabras · Gramática), de Jugar (Juegos · Álbum) y de Premios
    (Medallas · Mi zorro) llevan a su ruta y
    quedan marcados (aria-selected) en ella, con la pestaña de arriba marcada también."""
    page = C.new_page("phone")
    probs = []
    seg = """() => [...document.querySelectorAll('#tabhead .seg .seg-i')].map(a => [a.textContent.trim(), a.getAttribute('href'), a.getAttribute('aria-selected')])"""
    want = {"aprender": [("Repasar", "#/repaso"), ("Camino", "#/mapa"), ("Palabras", "#/palabras"), ("Gramática", "#/gramatica")],
            "jugar": [("Juegos", "#/juegos"), ("Álbum", "#/album")],
            "premios": [("Medallas", "#/progreso"), ("Mi zorro", "#/mizorro")]}
    try:
        C.seed(page)
        # F3b: con pendientes «Repasar» empieza el repaso en modo foco (sin segmentos); aquí, sin pendientes («Todo repasado»)
        page.evaluate("""() => { const k = 'srs:english', m = JSON.parse(localStorage.getItem(k)), t = today();
          for (const x of Object.values(m)) if (x.due <= t) x.due = t + 1; localStorage.setItem(k, JSON.stringify(m)); }""")
        C.goto(page, "#/", reload=True)
        for tab, items in want.items():
            C.goto(page, items[-1][1])            # se empieza en el último para que todos sean un cambio
            got = [(t, h) for t, h, _ in page.evaluate(seg)]
            if got != items:
                probs.append(f"{tab}: segmentos {got}, se esperaba {items}")
                continue
            for t, h in items:
                if "#/" + C.current_hash(page) != h:
                    _click_route(page, f"#tabhead .seg-i[href='{h}']")
                if "#/" + C.current_hash(page) != h:
                    probs.append(f"{tab}: «{t}» lleva a #/{C.current_hash(page)} (se esperaba {h})")
                    continue
                sel = [x[0] for x in page.evaluate(seg) if x[2] == "true"]
                if sel != [t]:
                    probs.append(f"{tab} › {t}: segmento marcado {sel}")
                tabs = [x["id"] for x in page.evaluate(_BAR)["tabs"] if x["sel"] == "true"]
                if tabs != [tab]:
                    probs.append(f"{tab} › {t}: pestaña marcada {tabs}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_badges_from_seeded_saves():
    """Insignias con partidas hechas a propósito: sin pendientes, sin hambre y con todas las pegatinas vistas no hay
    ninguna; con 6 pendientes Aprender dice «6» (con 12, «9+»), con un animal con hambre Granja lleva un punto y con
    pegatinas nuevas Jugar lleva un punto. Siempre azules, y el lector de pantalla oye el motivo."""
    probs = []
    cases = [
        ("tranquila", dict(due=0, hungry=0, new_stickers=False), {"aprender": None, "granja": None, "jugar": None}),
        ("6 pendientes, 1 con hambre, pegatinas nuevas", dict(due=6, hungry=1, new_stickers=True), {"aprender": "6", "granja": "dot", "jugar": "dot"}),
        ("12 pendientes", dict(due=12, hungry=0, new_stickers=False), {"aprender": "9+", "granja": None, "jugar": None}),
    ]
    for label, kw, want in cases:
        page = C.new_page("phone")
        try:
            C.seed(page, keys=_seed_badges(**kw))
            facts = page.evaluate("""() => ({due: dueList().length, hungry: farmMount.care.hungryList().map(a => a.id)})""")
            if facts["due"] != kw["due"] or len(facts["hungry"]) != kw["hungry"]:
                probs.append(f"{label}: la partida sembrada no es la esperada: {facts}")
            st = page.evaluate(_BADGES)
            for id in ("hoy", "premios"):
                if not st[id]["hidden"]:
                    probs.append(f"{label}: {id} no debería llevar insignia: {st[id]}")
            for id, w in want.items():
                b = st[id]
                if w is None:
                    if not b["hidden"]:
                        probs.append(f"{label}: {id} lleva insignia y no debería: {b}")
                    continue
                if b["hidden"]:
                    probs.append(f"{label}: falta la insignia de {id} (se esperaba {w})")
                    continue
                if w == "dot" and (not b["dot"] or b["text"]):
                    probs.append(f"{label}: {id} debería ser un punto: {b}")
                if w != "dot" and (b["dot"] or b["text"] != w):
                    probs.append(f"{label}: {id} dice {b['text']!r} (se esperaba {w!r})")
                if not _blue(b["bg"]):
                    probs.append(f"{label}: la insignia de {id} no es azul: {b['bg']}")
                if not b["label"].startswith(id.capitalize() + ", "):
                    probs.append(f"{label}: el lector de pantalla no oye la insignia de {id}: {b['label']!r}")
            probs += [f"{label}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_tabbar_top_on_desk_bottom_on_phone():
    """A 1280 px la barra flota arriba y centrada; a 390 px va abajo, separada de los bordes (16 px a los lados) y
    encima de la zona segura. En las dos, sin scroll horizontal."""
    probs = []
    for kind in ("desk", "phone"):
        page = C.new_page(kind)
        try:
            C.seed(page)
            C.goto(page, "#/mapa")
            b = page.evaluate(_BAR)
            if b["vw"] != (1280 if kind == "desk" else 390):
                probs.append(f"{kind}: ancho {b['vw']}")
            if not b["shown"]:
                probs.append(f"{kind}: la barra no se ve")
            if kind == "desk":
                if b["top"] > 24:
                    probs.append(f"desk: la barra no va arriba (top={b['top']})")
                if abs((b["left"] + b["right"]) / 2 - b["vw"] / 2) > 1.5:
                    probs.append(f"desk: la barra no está centrada ({b['left']}..{b['right']})")
            else:
                if not (b["vh"] - 40 < b["bottom"] <= b["vh"] - 8):
                    probs.append(f"phone: la barra no va abajo (bottom={b['bottom']}, alto {b['vh']})")
                if abs(b["left"] - 16) > 1 or abs(b["vw"] - b["right"] - 16) > 1:
                    probs.append(f"phone: la barra no deja 16 px a los lados ({b['left']}..{b['right']})")
            if page.evaluate("document.documentElement.scrollWidth > innerWidth + 1"):
                probs.append(f"{kind}: scroll horizontal")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- modo foco
def test_focus_mode_hides_bars():
    """En #/leccion/<id>, en un repaso en marcha y en una partida (también durante el juego, no solo en su portada) no
    se ven ni la barra de pestañas ni la de arriba ni el título; sí la ✕. Al salir vuelven las barras."""
    page = C.new_page("phone")
    probs = []

    def check(label, want):
        st = page.evaluate(_FOCUS)
        if st["focus"] != want or st["tab"] or st["top"] or st["flag"] or st["head"] or st["acc"] or not st["x"]:
            probs.append(f"{label}: {st} (se esperaba modo foco {want!r}, sin barras y con la ✕)")

    try:
        C.seed(page)
        C.goto(page, f"#/leccion/{R.LESSON}")
        check("lección", "leccion")
        C.goto(page, "#/mapa")
        st = page.evaluate(_FOCUS)
        if st["focus"] or not st["tab"] or not st["top"] or st["x"]:
            probs.append(f"al salir de la lección: {st}")
        # F3b (js/review.js): con pendientes #/repaso ya es la primera tarjeta; la ✕ abre «¿Paramos aquí?» y «Salir» sale
        C.goto(page, "#/repaso")
        page.wait_for_function("() => document.documentElement.dataset.focus === 'repaso'", timeout=4000)
        check("repaso en marcha", "repaso")
        page.locator("#fx-x").click()
        page.wait_for_selector("dialog#rv-pause[open]", timeout=3000)
        page.locator("#rv-pz-out").click()
        page.wait_for_function("() => !document.documentElement.dataset.focus", timeout=4000)
        C.goto(page, "#/juegos/memoria")
        check("partida (portada)", "juego")
        page.locator(".gm-go").click()
        page.wait_for_timeout(400)
        check("partida (jugando)", "juego")
        C.goto(page, "#/juegos")
        st = page.evaluate(_FOCUS)
        if st["focus"] or not st["tab"] or not st["top"]:
            probs.append(f"en el menú de juegos: {st}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- barra de arriba
def test_language_menu_changes_language():
    """La bandera abre el menú de idiomas; elegir Francés cambia el idioma (store «lang», la bandera, el menú con la ✓
    y lo que se ve) y Esc lo cierra sin cambiar nada. Se deja otra vez en inglés."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/palabras")
        page.locator("#lang-b").click()
        page.wait_for_selector("#lang-m:not([hidden])", timeout=3000)
        page.keyboard.press("Escape")
        page.wait_for_selector("#lang-m[hidden]", state="attached", timeout=3000)
        if page.evaluate("JSON.parse(localStorage.getItem('lang'))") != "english":
            probs.append("Esc en el menú cambió el idioma")
        page.locator("#lang-b").click()
        page.wait_for_selector("#lang-m:not([hidden])", timeout=3000)
        n0 = page.evaluate(_ROUTE_N)
        page.locator("#lang-m [data-lang='français']").click()
        _wait_route(page, n0)
        st = page.evaluate("""() => ({store: JSON.parse(localStorage.getItem('lang')), lang, flag: document.getElementById('lang-b').getAttribute('aria-label'),
          name: LANGS['français'].name, checked: [...document.querySelectorAll('#lang-m [aria-checked=true]')].map(i => i.dataset.lang),
          hidden: document.getElementById('lang-m').hidden, hash: location.hash})""")
        if st["store"] != "français" or st["lang"] != "français":
            probs.append(f"el idioma no cambia: {st}")
        if st["name"] not in (st["flag"] or ""):
            probs.append(f"la bandera no dice el idioma nuevo: {st['flag']!r}")
        if st["checked"] != ["français"] or not st["hidden"] or st["hash"] != "#/palabras":
            probs.append(f"tras elegir: {st}")
        page.locator("#lang-b").click()
        page.wait_for_selector("#lang-m:not([hidden])", timeout=3000)
        n0 = page.evaluate(_ROUTE_N)
        page.locator("#lang-m [data-lang='english']").click()
        _wait_route(page, n0)
        if page.evaluate("lang") != "english":
            probs.append("no vuelve al inglés")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_coin_pill_opens_shop():
    """La pastilla de monedas abre la tienda de la granja, desde otra pestaña y desde la propia granja.
    (F4b: la tienda ya no es una sección de la página, h2#shop, sino la hoja de la granja, dialog#fm-shop, que abre
    window.vocabFarm.openShop(); desde otra pestaña va antes a #/granja.)"""
    page = C.new_page("phone")
    probs = []
    shop = """() => { const d = document.getElementById('fm-shop'), h = d && d.querySelector('.m-head h2'), r = h && h.getBoundingClientRect();
      return {hash: location.hash, open: !!(d && d.open), focus: !!(d && d.contains(document.activeElement)), top: r ? Math.round(r.top) : null, vh: innerHeight}; }"""
    try:
        C.seed(page)
        C.goto(page, "#/progreso")
        n0 = page.evaluate(_ROUTE_N)
        page.locator("[data-coins-pill]").click()
        _wait_route(page, n0)
        page.wait_for_function("() => { const d = document.getElementById('fm-shop'); return d && d.open; }", timeout=6000)
        page.wait_for_timeout(400)
        st = page.evaluate(shop)
        if st["hash"] != "#/granja" or not st["open"] or not st["focus"] or st["top"] is None or not (0 <= st["top"] < st["vh"]):
            probs.append(f"desde Premios: {st}")
        page.locator("#fm-shop [data-x]").click()
        page.wait_for_function("() => !document.getElementById('fm-shop').open", timeout=3000)
        page.wait_for_timeout(300)
        page.locator("[data-coins-pill]").click()
        page.wait_for_function("() => document.getElementById('fm-shop').open", timeout=4000)
        page.wait_for_timeout(400)
        st = page.evaluate(shop)
        if not st["open"] or not st["focus"] or st["top"] is None or not (0 <= st["top"] < st["vh"]):
            probs.append(f"desde la granja: {st}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_farm_clicks_stay_put():
    """Regresión: <html> lleva data-tab (la pestaña de la barra) y la tienda de la granja buscaba document [data-tab]:
    tras abrir la granja, cualquier toque volvía a pintar la granja (con la tienda vacía), también en otras pantallas.
    Ahora un toque en la granja no cambia la tienda ni vuelve a montar la escena y, fuera de ella, no la trae.
    (F4b: la tienda es la hoja de la granja, dialog#fm-shop, sin pestañas: solo cosas de la granja y comida.)"""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/granja")
        page.evaluate("() => { document.querySelector('#app .fm-stage').__keep = 1; vocabFarm.openShop(); }")
        page.wait_for_selector("#fm-shop[open] .shop .sc", timeout=4000)
        n0 = page.locator("#fm-shop .shop .sc").count()
        page.locator("#fm-shop .m-head h2").click()
        page.wait_for_timeout(500)
        st = page.evaluate("""() => ({cards: document.querySelectorAll('#fm-shop .shop .sc').length, open: document.getElementById('fm-shop').open,
          keep: !!document.querySelector('#app .fm-stage').__keep, html: typeof document.documentElement.onclick})""")
        if n0 < 5 or st["cards"] != n0 or not st["open"] or not st["keep"] or st["html"] != "object":
            probs.append(f"un toque en la tienda la cambia: {n0} tarjetas → {st}")
        page.locator("#fm-shop [data-x]").click()
        page.wait_for_function("() => !document.getElementById('fm-shop').open", timeout=3000)
        page.wait_for_timeout(300)
        page.mouse.click(200, 300)   # un toque en el cielo de la escena
        page.wait_for_timeout(500)
        if not page.evaluate("() => !!document.querySelector('#app .fm-stage') && !!document.querySelector('#app .fm-stage').__keep"):
            probs.append("un toque en la escena vuelve a montar la granja")
        C.goto(page, "#/mapa")
        page.mouse.click(20, 420)   # un toque en el camino fuera de los nodos (en el centro está la lección 1)
        page.wait_for_timeout(600)
        if page.locator("#app #farm-host").count() or C.current_hash(page) != "mapa":
            probs.append(f"tras la granja, un toque en el camino pinta la granja (#/{C.current_hash(page)})")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_gear_opens_settings():
    """El engranaje abre la hoja de Ajustes (dialog#ajustes modal con su título) y «Listo» la cierra devolviendo el
    foco al engranaje; en móvil y en escritorio."""
    probs = []
    for kind in ("phone", "desk"):
        page = C.new_page(kind)
        try:
            C.seed(page)
            C.goto(page, "#/mapa")
            page.locator(".topbar [data-open=ajustes]").click()
            page.wait_for_selector("dialog#ajustes[open]", timeout=3000)
            C.settle(page, 200)
            st = page.evaluate("""() => { const d = document.getElementById('ajustes');
              return {modal: d.matches(':modal'), title: (document.getElementById(d.getAttribute('aria-labelledby')) || {}).textContent}; }""")
            if st != {"modal": True, "title": "Ajustes"}:
                probs.append(f"{kind}: hoja de Ajustes {st}")
            page.locator("#aj-done").click()
            page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=3000)
            page.wait_for_timeout(300)
            if not page.evaluate("document.activeElement && document.activeElement.matches('[data-open=ajustes]')"):
                probs.append(f"{kind}: al cerrar, el foco no vuelve al engranaje ({page.evaluate('document.activeElement && document.activeElement.outerHTML.slice(0, 80)')})")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- lo que se quitó
def test_removed_fab_fox_and_footer():
    """No queda js/fab.js (ni su <script>, ni el fichero, ni sus piezas), ni el zorro flotante (.bd, .bd-peek, su
    globo), ni <footer>, en ninguna ruta."""
    page = C.new_page("phone")
    probs = []
    old = ".fab, .fab-main, .fab-back, .fab-say, #bd-buddy, .bd, .bd-peek, .bd-say, .bd-float, footer"
    try:
        C.seed(page)
        st = page.evaluate("""async () => ({script: [...document.scripts].some(s => /fab\\.js/.test(s.src)),
          file: (await fetch('js/fab.js', {cache: 'no-store'})).status, css: !!document.getElementById('css-fab'),
          globals: ['TUCK_LINES', 'IDLE_LINES', 'vocabFab'].filter(k => k in window)})""")
        if st["script"] or st["file"] != 404 or st["css"] or st["globals"]:
            probs.append(f"restos de fab.js o del zorro flotante: {st}")
        C.clear_errors(page)    # el 404 de js/fab.js lo pide la prueba
        for r in R.all_routes():
            C.goto(page, r["hash"])
            found = page.evaluate(f"() => [...document.querySelectorAll({old!r})].map(e => e.tagName.toLowerCase() + '.' + e.className)")
            if found:
                probs.append(f"{r['name']}: {found}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- pausa de las partidas
_RAIN = """() => ({bar: (document.getElementById('gm-tb') || {}).style ? document.getElementById('gm-tb').style.transform : null,
  bubs: [...document.querySelectorAll('.gm-bub')].map(b => b.style.transform).join('|')})"""


def test_escape_in_game_opens_pause():
    """Esc durante una partida (en su portada y jugando) abre la hoja «¿Paramos aquí?» con «Seguir» (destacado) y
    «Salir», sin salir del juego (games.js ya no hace location.hash). Mientras está abierta la lluvia no cae, el reloj
    no corre y las teclas del juego no cuentan; Esc o «Seguir» siguen la partida y «Salir» vuelve a los juegos. La ✕ del
    modo foco abre la misma pausa. La hoja va sin desenfoque (vidrio de los juegos)."""
    page = C.new_page("phone")
    probs = []
    sheet = """() => { const d = document.getElementById('gm-pause');
      return d ? {open: d.open, modal: d.matches(':modal'), title: (document.getElementById(d.getAttribute('aria-labelledby')) || {}).textContent,
        go: (d.querySelector('#gm-pz-go') || {}).textContent, pri: !!d.querySelector('#gm-pz-go.glass-btn--pri'), out: (d.querySelector('#gm-pz-out') || {}).textContent,
        blur: getComputedStyle(d).backdropFilter, paused: vocabGames.paused, hash: location.hash} : null; }"""
    try:
        C.seed(page)
        C.goto(page, "#/juegos/lluvia")
        page.keyboard.press("Escape")
        try:
            page.wait_for_selector("dialog#gm-pause[open]", timeout=3000)
        except Exception:  # noqa: BLE001
            probs.append(f"Esc en la portada del juego no abre la pausa (hash {page.evaluate('location.hash')})")
        st = page.evaluate(sheet)
        want = {"open": True, "modal": True, "title": "¿Paramos aquí?", "go": "Seguir", "pri": True, "out": "Salir", "blur": "none",
                "paused": True, "hash": "#/juegos/lluvia"}
        if st != want:
            probs.append(f"hoja de pausa: {st}")
        page.keyboard.press("Escape")
        try:
            page.wait_for_function("() => !document.getElementById('gm-pause').open && !vocabGames.paused", timeout=3000)
        except Exception:  # noqa: BLE001
            probs.append(f"Esc con la pausa abierta no sigue la partida: {page.evaluate(sheet)}")
        if C.current_hash(page) != "juegos/lluvia":
            probs.append(f"Esc con la pausa abierta sale del juego: #/{C.current_hash(page)}")
        # jugando: la lluvia se para y sigue
        page.locator(".gm-go").click()
        page.wait_for_timeout(1500)
        page.keyboard.press("Escape")
        page.wait_for_selector("dialog#gm-pause[open]", timeout=3000)
        page.wait_for_timeout(300)
        a = page.evaluate(_RAIN)
        page.wait_for_timeout(1200)
        b = page.evaluate(_RAIN)
        if a != b:
            probs.append(f"con la pausa abierta la lluvia sigue: {a} → {b}")
        page.locator("#gm-pz-go").click()
        page.wait_for_function("() => !document.getElementById('gm-pause').open && !vocabGames.paused", timeout=3000)
        page.wait_for_timeout(700)
        c = page.evaluate(_RAIN)
        if c["bar"] == b["bar"]:
            probs.append(f"tras «Seguir» el reloj no corre: {b['bar']} → {c['bar']}")
        # la ✕ del modo foco: la misma pausa; «Salir» vuelve a los juegos
        page.locator("#fx-x").click()
        try:
            page.wait_for_selector("dialog#gm-pause[open]", timeout=3000)
        except Exception:  # noqa: BLE001
            probs.append(f"la ✕ no abre la pausa (hash {page.evaluate('location.hash')})")
        n0 = page.evaluate(_ROUTE_N)
        page.locator("#gm-pz-out").click()
        _wait_route(page, n0)
        st = page.evaluate("""() => ({hash: location.hash, focus: document.documentElement.dataset.focus || '', play: document.documentElement.hasAttribute('data-gm-play'),
          open: document.getElementById('gm-pause').open})""")
        if st != {"hash": "#/juegos", "focus": "", "play": False, "open": False}:
            probs.append(f"«Salir»: {st}")
        # Letras locas: con la pausa abierta las letras del teclado no cuentan
        C.goto(page, "#/juegos/letras")
        page.locator(".gm-go").click()
        page.wait_for_timeout(300)
        ch = page.evaluate("document.querySelector('.gm-tile:not(.used)').textContent")
        page.keyboard.press("Escape")
        page.wait_for_selector("dialog#gm-pause[open]", timeout=3000)
        page.keyboard.type(ch)
        page.wait_for_timeout(200)
        if page.locator(".gm-slot.fill").count():
            probs.append("con la pausa abierta, una tecla pone una letra")
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.getElementById('gm-pause').open && !vocabGames.paused", timeout=3000)
        page.keyboard.type(ch)
        page.wait_for_timeout(200)
        if page.locator(".gm-slot.fill").count() != 1:
            probs.append("tras seguir, la tecla no pone la letra")
        # fuera de una partida (el resultado o el menú), Esc no hace nada
        C.goto(page, "#/juegos")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        if page.evaluate("document.getElementById('gm-pause').open") or C.current_hash(page) != "juegos":
            probs.append("Esc en el menú de juegos abre la pausa o navega")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""


def test_pause_and_privacy_gate_audit():
    """La hoja de pausa y la Puerta de privacy.html (sus enlaces a otras webs también pasan por ella) cumplen la
    auditoría de test_f1: contraste ≥ 4,5:1, sin colores prohibidos y, con html[data-glass=off], sin desenfoque."""
    probs = []
    for scheme in ("light", "dark"):
        page = C.new_page("phone", color_scheme=scheme)
        try:
            C.seed(page)
            C.goto(page, "#/juegos/globos")
            page.keyboard.press("Escape")
            page.wait_for_selector("dialog#gm-pause[open]", timeout=3000)
            page.wait_for_timeout(500)
            page.evaluate(_FINISH)
            a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
            probs += [f"{scheme} pausa: {x}" for x in a["contrast"] + a["palette"]]
            page.evaluate("document.documentElement.dataset.glass = 'off'")
            a = page.evaluate(_AUDIT, {"what": ["backdrop"]})
            probs += [f"{scheme} pausa (sin vidrio): {x}" for x in a["backdrop"]]
            page.evaluate("delete document.documentElement.dataset.glass")
            page.keyboard.press("Escape")
            # privacy.html: un enlace a otra web abre la Puerta y no sale de la página
            page.goto(C.base_url(page) + "/privacy.html")
            page.evaluate("window.open = u => { window.__opened = u; return null; }")
            page.locator("a[href^='https://github.com']").first.click()   # el de «avisar de un fallo» (hay más en Créditos)
            page.wait_for_selector("dialog#gate[open]", timeout=3000)
            page.wait_for_timeout(500)
            page.evaluate(_FINISH)
            if not page.url.endswith("/privacy.html") or page.evaluate("window.__opened || null"):
                probs.append(f"{scheme} privacy.html: el enlace sale sin la Puerta ({page.url})")
            a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
            probs += [f"{scheme} Puerta en privacy.html: {x}" for x in a["contrast"] + a["palette"] if "#gate" in x or "gt-" in x]
            if not page.locator("header a.back[href='./']").count():
                probs.append(f"{scheme} privacy.html no tiene «‹ Vocabulary» para volver a la app")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- sw.js y partida
def test_sw_version_bumped_and_shell():
    """sw.js sube a la versión 16 (F2 entero), con js/gate.js y js/settings.js en SHELL y sin js/fab.js; OFF_SHELL de
    index.html coincide. (Que cada entrada responda 200 lo mira test_f1::test_sw_shell_entries_200.)"""
    sw = (C.REPO / "sw.js").read_text(encoding="utf-8")
    html = (C.REPO / "index.html").read_text(encoding="utf-8")
    probs = []
    m = re.search(r"const VERSION = (\d+);", sw)
    v = int(m.group(1)) if m else 0
    if v < 16:
        probs.append(f"sw.js está en la versión {v} (se esperaba 16 o más)")
    shell = re.search(r"const SHELL = \[(.*?)\];", sw, re.S)
    items = re.findall(r'"([^"]+)"', shell.group(1)) if shell else []
    for f in ("js/gate.js", "js/settings.js"):
        if f not in items:
            probs.append(f"falta {f} en SHELL")
    if any("fab.js" in x for x in items):
        probs.append("js/fab.js sigue en SHELL")
    if f'OFF_SHELL = "vocab-shell-v{v}"' not in html:
        probs.append(f"OFF_SHELL de index.html no es vocab-shell-v{v}")
    off = re.search(r"const OFF_APP = \[(.*?)\];", html, re.S)
    off_items = re.findall(r'"([^"]+)"', off.group(1)) if off else []
    if sorted(off_items) != sorted(items):
        probs.append(f"OFF_APP de index.html y SHELL de sw.js no coinciden: {sorted(set(off_items) ^ set(items))}")
    assert not probs, "\n".join(probs)


def test_nav_tour_keeps_export():
    """Una vuelta por la navegación (pestañas, segmentos, memoria, Ajustes abierto y cerrado, el menú de idioma abierto
    y cerrado con Esc, una lección y un repaso abiertos y dejados con la ✕, una partida en pausa y «Salir») no cambia la
    partida exportada: es la de la base (tests/e2e/baseline/export.json), sin claves nuevas."""
    base = C.load_baseline()
    assert base, "falta tests/e2e/baseline/export.json"
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        for sel in ("#tab-aprender", ".seg a.seg-i[href='#/gramatica']", "#tab-jugar", ".seg a.seg-i[href='#/album']", "#tab-premios", "#tab-hoy",
                    "#tab-aprender", "#tab-jugar"):
            _click_route(page, sel)
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_selector("dialog#ajustes[open]", timeout=3000)
        page.locator("#aj-done").click()
        page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=3000)
        page.locator("#lang-b").click()
        page.wait_for_selector("#lang-m:not([hidden])", timeout=3000)
        page.keyboard.press("Escape")
        C.goto(page, f"#/leccion/{R.LESSON}")
        _click_route(page, "#fx-x")
        C.goto(page, "#/repaso")   # F3b: empieza directo; la ✕ abre «¿Paramos aquí?» y «Salir» lo deja abierto
        page.wait_for_function("() => document.documentElement.dataset.focus === 'repaso'", timeout=4000)
        page.locator("#fx-x").click()
        page.wait_for_selector("dialog#rv-pause[open]", timeout=3000)
        page.locator("#rv-pz-out").click()
        page.wait_for_function("() => !document.documentElement.dataset.focus", timeout=4000)
        C.goto(page, "#/juegos/globos")
        page.keyboard.press("Escape")
        page.wait_for_selector("dialog#gm-pause[open]", timeout=3000)
        _click_route(page, "#gm-pz-out")
        C.goto(page, "")
        snap = C.export(page)
        # album:uniq:<idioma> es una caché que el álbum completa al abrirlo (cuántas pegatinas distintas tiene cada
        # tema): puede ganar temas, pero lo que ya tenía no cambia
        k = "album:uniq:english"
        old_u, new_u = json.loads(base["keys"][k]), json.loads(snap["keys"].get(k, "{}"))
        if any(new_u.get(t) != n for t, n in old_u.items()):
            probs.append(f"cambia {k}: {old_u} → {new_u}")
        keys = dict(snap["keys"]); keys[k] = base["keys"][k]
        d = C.diff_exports(base, dict(snap, keys=keys), allow_new=False)
        if d:
            probs.append("la partida cambió:\n  " + "\n  ".join(d))
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
