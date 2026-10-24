"""F2a (armazón de navegación, plan-doc §Navegación): barra de 5 pestañas con insignias azules, segmentos de cada
pestaña, barra de arriba (bandera con menú de idiomas, monedas que abren la tienda y engranaje con Ajustes), modo foco
en lecciones, repaso y partidas, cápsula de avisos bajo la barra, monedas que suenan una sola vez, html[data-motion=calm]
y lo que se quita (cabecera de dos filas, pie, estrella flotante y zorro flotante)."""
from __future__ import annotations

import re

import common as C
import routes as R

TABS = [("hoy", "Hoy"), ("aprender", "Aprender"), ("jugar", "Jugar"), ("granja", "Granja"), ("premios", "Premios")]

# lo que se ve de la barra en una ruta
_BAR = """() => {
  const nav = document.getElementById('tabbar'), r = nav.getBoundingClientRect();
  const tabs = [...nav.querySelectorAll('[role=tab]')];
  return {role: (nav.querySelector('[role=tablist]') || nav).getAttribute('role'), land: nav.tagName === 'NAV' && !nav.hasAttribute('role'), shown: !!nav.getClientRects().length && getComputedStyle(nav).display !== 'none',
    top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height,
    tabs: tabs.map(a => ({id: a.dataset.nav, label: a.querySelector('.tl').textContent, sel: a.getAttribute('aria-selected'),
      ti: a.tabIndex, ico: a.querySelector('svg.ico') ? a.querySelector('svg.ico').getBoundingClientRect().width : 0,
      font: getComputedStyle(a.querySelector('.tl')).fontSize + ' ' + getComputedStyle(a.querySelector('.tl')).fontWeight,
      color: getComputedStyle(a).color}))};
}"""

_ROUTE_N = "window.__vocabRouteN || 0"


def _wait_route(page, n0, timeout=8000):
    page.wait_for_function(f"n => ({_ROUTE_N}) > n", arg=n0, timeout=timeout)
    C.settle(page, 200)


def _click_route(page, sel):
    n0 = page.evaluate(_ROUTE_N)
    page.locator(sel).first.click()
    _wait_route(page, n0)


def _expect_tab(route_name):
    n = route_name
    if n == "hoy" or n.startswith("temporada"):    # F4d: la temporada es una pantalla de Hoy
        return "hoy"
    if n.startswith(("mapa", "repaso", "leccion", "doc-", "gramatica", "palabras")):
        return "aprender"
    if n.startswith(("juego", "album")):
        return "jugar"
    if n == "granja" or n.startswith("granja-"):   # F6h: el loro eco (#/loro) es una pantalla de la granja
        return "granja"
    if n in ("progreso", "mizorro"):
        return "premios"
    return None


# ---------------------------------------------------------------- barra de pestañas
def test_tabbar_on_every_route():
    """En cada ruta, en móvil y en escritorio: 5 pestañas role=tab en una lista role=tablist dentro de un <nav> (punto
    de referencia «Principal»), una sola marcada (la de su sección) y con el foco itinerante; icono de 26 px y etiqueta
    de 12 px seminegrita en móvil."""
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
                if [(t["id"], t["label"]) for t in b["tabs"]] != TABS:
                    probs.append(f"{kind} {r['name']}: pestañas {[(t['id'], t['label']) for t in b['tabs']]}")
                sel = [t["id"] for t in b["tabs"] if t["sel"] == "true"]
                if sel != [exp]:
                    probs.append(f"{kind} {r['name']}: pestaña marcada {sel}, se esperaba {exp}")
                if [t["ti"] for t in b["tabs"]].count(0) != 1:
                    probs.append(f"{kind} {r['name']}: el foco itinerante no está en una sola pestaña: {[t['ti'] for t in b['tabs']]}")
                if kind == "phone" and b["shown"]:
                    bad = [t for t in b["tabs"] if round(t["ico"]) != 26 or t["font"] != "12px 600"]
                    if bad:
                        probs.append(f"{kind} {r['name']}: icono o etiqueta de pestaña: {bad[:2]}")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_tabbar_layout_phone_and_desk():
    """Móvil: abajo, sin encogerse al bajar la página. Desde 820 px flota arriba, centrada si cabe (si el grupo de la
    derecha es ancho, se corre lo justo), a 12 px como poco de la bandera y de las monedas (también justo en 820 px).
    Respeta las zonas seguras."""
    probs = []
    for kind, w in (("phone", None), ("desk", None), ("desk", 820), ("desk", 1024)):
        page = C.new_page(kind)
        try:
            if w:
                page.set_viewport_size({"width": w, "height": 800})
            C.seed(page)
            C.goto(page, "#/palabras")
            vw = page.evaluate("innerWidth")
            vh = page.evaluate("innerHeight")
            b0 = page.evaluate(_BAR)
            page.evaluate("scrollTo(0, 600)")
            page.wait_for_timeout(300)
            b1 = page.evaluate(_BAR)
            if abs(b0["h"] - b1["h"]) > 0.5 or abs(b0["top"] - b1["top"]) > 0.5:
                probs.append(f"{kind}/{vw}: la barra cambia al bajar: {b0['h']}→{b1['h']}, top {b0['top']}→{b1['top']}")
            if vw < 820:
                if not (b0["bottom"] <= vh - 12 + 0.5 and b0["bottom"] > vh - 40):
                    probs.append(f"{kind}/{vw}: en móvil la barra debería ir abajo (bottom={b0['bottom']}, alto {vh})")
            else:
                if b0["top"] > 40:
                    probs.append(f"{kind}/{vw}: desde 820 px la barra va arriba (top={b0['top']})")
                mid = (b0["left"] + b0["right"]) / 2
                g = page.evaluate("""() => ({f: document.getElementById('lang-b').getBoundingClientRect().right,
                  r: document.querySelector('.topbar .tb-right').getBoundingClientRect().left})""")
                gap_l, gap_r = b0["left"] - g["f"], g["r"] - b0["right"]
                if gap_l < 11.5 or gap_r < 11.5:
                    probs.append(f"{kind}/{vw}: la barra está a menos de 12 px de los botones de arriba ({gap_l:.1f} / {gap_r:.1f})")
                if abs(mid - vw / 2) > 1.5 and abs(gap_r - 12) > 1.5:
                    probs.append(f"{kind}/{vw}: la barra no está centrada ni pegada a 12 px del grupo de la derecha ({mid} frente a {vw / 2})")
                ov = page.evaluate("""() => { const t = document.getElementById('tabbar').getBoundingClientRect();
                  return ['#lang-b', '.tb-group'].map(s => document.querySelector(s)).filter(Boolean)
                    .filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect();
                      return r.right > t.left && r.left < t.right && r.bottom > t.top && r.top < t.bottom ? (e.id || e.className) : null; })
                    .filter(Boolean); }""")
                if ov:
                    probs.append(f"{kind}/{vw}: la barra de pestañas pisa {ov}")
            if page.evaluate("document.documentElement.scrollWidth > innerWidth + 1"):
                probs.append(f"{kind}/{vw}: hay scroll horizontal")
            # zonas seguras: las barras usan env(safe-area-inset-*)
            css = page.evaluate("""() => { const s = getComputedStyle(document.documentElement);
              return [s.getPropertyValue('--bar-top'), s.getPropertyValue('--tabbar-b')].join(' | '); }""")
            if "safe" not in page.evaluate("""() => [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch (e) { return []; } })
                .map(r => r.cssText).filter(t => /--bar-top|--tabbar-b/.test(t)).join(' ')"""):
                probs.append(f"{kind}/{vw}: las barras no usan las zonas seguras ({css})")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_tab_badges_blue_and_bump():
    """Aprender: número de pendientes (hasta «9+»); Granja: punto si hay animales con hambre; Jugar: punto si hay
    pegatinas nuevas. Siempre azules (nunca rojos) y dan un saltito al cambiar."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/")
        st = page.evaluate("""() => Object.fromEntries(['aprender', 'jugar', 'granja', 'hoy', 'premios'].map(id => {
          const b = document.querySelector('#tab-' + id + ' .tb-badge');
          return [id, {hidden: b.hidden, dot: b.classList.contains('dot'), text: b.textContent, bg: getComputedStyle(b).backgroundColor,
            label: document.getElementById('tab-' + id).getAttribute('aria-label')}]; }))""")
        due = page.evaluate("dueList().length")
        want = "9+" if due > 9 else str(due)
        a = st["aprender"]
        if due and (a["hidden"] or a["dot"] or a["text"] != want):
            probs.append(f"Aprender: insignia {a}, se esperaba «{want}» ({due} pendientes)")
        if due and not (a["label"] or "").startswith("Aprender, "):
            probs.append(f"Aprender: el lector de pantalla no oye las pendientes: {a['label']}")
        for id in ("granja", "jugar"):
            if st[id]["hidden"] or not st[id]["dot"] or st[id]["text"]:
                probs.append(f"{id}: tendría que llevar un punto azul (partida con animales con hambre y pegatinas nuevas): {st[id]}")
        for id in ("hoy", "premios"):
            if not st[id]["hidden"]:
                probs.append(f"{id}: no debería llevar insignia: {st[id]}")
        for id, v in st.items():
            if v["hidden"]:
                continue
            m = re.match(r"rgba?\((\d+), (\d+), (\d+)", v["bg"])
            r, g, b = (int(x) for x in m.groups())
            if not (b > r + 60 and b > g):
                probs.append(f"{id}: la insignia no es azul: {v['bg']}")
        # al cambiar da un saltito (M.bump pone .m-bump un momento); sin cambio, nada
        bumped = page.evaluate("""async () => {
          const b = document.querySelector('#tab-aprender .tb-badge');
          await new Promise(r => setTimeout(r, 600)); b.classList.remove('m-bump');
          tabBadge('aprender', 3, '3 palabras para repasar'); const one = b.classList.contains('m-bump') && b.textContent === '3';
          await new Promise(r => setTimeout(r, 600));
          tabBadge('aprender', 3, '3 palabras para repasar'); const same = b.classList.contains('m-bump');
          tabBadge('aprender', 0); const gone = b.hidden;
          return {one, same, gone}; }""")
        if bumped != {"one": True, "same": False, "gone": True}:
            probs.append(f"saltito de la insignia al cambiar: {bumped}")
        # el farm.js antiguo ponía un número rojo: ya no
        if page.locator(".fm-nb").count():
            probs.append("sigue la insignia roja .fm-nb de la granja")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_tab_memory_and_active_tap():
    """Cada pestaña recuerda su sección y su scroll; tocar la pestaña activa sube arriba, y desde una subpantalla
    vuelve a la raíz. Cambiar de pestaña es instantáneo (sin transición en la barra)."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/mapa")
        _click_route(page, ".seg a.seg-i[href='#/palabras']")
        if C.current_hash(page) != "palabras":
            probs.append(f"el segmento Palabras lleva a #/{C.current_hash(page)}")
        page.evaluate("scrollTo(0, 420)")
        page.wait_for_timeout(400)
        y0 = page.evaluate("scrollY")
        _click_route(page, "#tab-hoy")
        if C.current_hash(page) != "":
            probs.append(f"la pestaña Hoy lleva a #/{C.current_hash(page)}")
        _click_route(page, "#tab-aprender")
        page.wait_for_timeout(600)
        if C.current_hash(page) != "palabras":
            probs.append(f"Aprender no recuerda la sección: #/{C.current_hash(page)}")
        y1 = page.evaluate("scrollY")
        if abs(y1 - y0) > 4:
            probs.append(f"Aprender no recuerda el scroll: {y0} → {y1}")
        # tocar la pestaña activa sube arriba
        page.locator("#tab-aprender").click()
        page.wait_for_function("scrollY < 2", timeout=4000)
        # desde una subpantalla (la ficha de un tema) vuelve a la raíz de la sección
        _click_route(page, f".doc[href='#/doc/{R.TOPIC}']")
        if C.current_hash(page) != f"doc/{R.TOPIC}":
            probs.append(f"la tarjeta del tema lleva a #/{C.current_hash(page)}")
        _click_route(page, "#tab-aprender")
        if C.current_hash(page) != "palabras":
            probs.append(f"desde la ficha, la pestaña activa vuelve a #/{C.current_hash(page)} (se esperaba #/palabras)")
        tr = page.evaluate("""() => [...document.querySelectorAll('#tabbar .tab')].map(a => getComputedStyle(a).transitionDuration)""")
        if any(t not in ("0s", "") for t in tr):
            probs.append(f"las pestañas tienen transición: {tr}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- segmentos y título
def test_segments_and_large_title():
    """Aprender: Repasar · Camino · Palabras · Gramática; Jugar: Juegos · Álbum; Premios: Medallas · Mi zorro (F4c).
    Título grande de 36 px solo en la raíz y sin fecha. #/palabras tiene las tarjetas de temas que antes estaban en Hoy."""
    page = C.new_page("phone")
    probs = []
    seg = """() => { const h = document.getElementById('tabhead'); if (h.hidden) return null;
      const t = h.querySelector('.th-t'), s = h.querySelector('.seg');
      return {title: t ? t.textContent : '', size: t ? getComputedStyle(t).fontSize : '', role: s ? s.getAttribute('role') : null,
        items: s ? [...s.querySelectorAll('.seg-i')].map(a => [a.textContent.trim(), a.getAttribute('role'), a.getAttribute('aria-selected')]) : []}; }"""
    want = {
        "#/repaso": ("Aprender", ["Repasar", "Camino", "Palabras", "Gramática"], "Repasar"),
        "#/mapa": ("Aprender", ["Repasar", "Camino", "Palabras", "Gramática"], "Camino"),
        "#/palabras": ("Aprender", ["Repasar", "Camino", "Palabras", "Gramática"], "Palabras"),
        "#/gramatica": ("Aprender", ["Repasar", "Camino", "Palabras", "Gramática"], "Gramática"),
        "#/juegos": ("Jugar", ["Juegos", "Álbum"], "Juegos"),
        "#/album": ("Jugar", ["Juegos", "Álbum"], "Álbum"),
        "#/progreso": ("Premios", ["Medallas", "Mi zorro"], "Medallas"),
        "#/mizorro": ("Premios", ["Medallas", "Mi zorro"], "Mi zorro"),
        "#/": ("Hoy", [], None),
    }
    try:
        C.seed(page)
        # F3b: con pendientes, #/repaso ya es la primera tarjeta en modo foco (sin título ni segmentos); el título y los
        # segmentos de Repasar se miran en «Todo repasado» (sin pendientes)
        C.goto(page, "#/repaso")
        if page.evaluate(seg):
            probs.append("#/repaso con pendientes (modo foco) no debería llevar título grande ni segmentos")
        page.evaluate("""() => { const k = 'srs:english', m = JSON.parse(localStorage.getItem(k)), t = today();
          for (const x of Object.values(m)) if (x.due <= t) x.due = t + 1; localStorage.setItem(k, JSON.stringify(m)); }""")
        C.goto(page, "#/", reload=True)
        for h, (title, items, on) in want.items():
            C.goto(page, h)
            s = page.evaluate(seg)
            if not s:
                probs.append(f"{h}: falta el título grande")
                continue
            if s["title"] != title or s["size"] != "36px":
                probs.append(f"{h}: título {s['title']!r} de {s['size']} (se esperaba {title!r} de 36px)")
            if re.search(r"\d", s["title"]):
                probs.append(f"{h}: el título lleva fecha: {s['title']}")
            got = [x[0] for x in s["items"]]
            if got != items:
                probs.append(f"{h}: segmentos {got}, se esperaba {items}")
            if items:
                if s["role"] != "tablist" or any(x[1] != "tab" for x in s["items"]):
                    probs.append(f"{h}: los segmentos no son un tablist de tabs: {s}")
                sel = [x[0] for x in s["items"] if x[2] == "true"]
                if sel != [on]:
                    probs.append(f"{h}: segmento marcado {sel}, se esperaba {on}")
        # subpantallas y granja: sin título grande
        for h in (f"#/doc/{R.TOPIC}", f"#/album/{R.ALBUM_DONE}", "#/granja", f"#/leccion/{R.LESSON}"):
            C.goto(page, h)
            if page.evaluate(seg):
                probs.append(f"{h}: no debería llevar título grande ni segmentos")
        # Palabras: las tarjetas de temas; Hoy ya no las tiene
        C.goto(page, "#/palabras")
        n = page.locator("#app .doc").count()
        if n < 10:
            probs.append(f"#/palabras tiene {n} tarjetas de temas")
        C.goto(page, "#/")
        if page.locator("#app .doc").count():
            probs.append("Hoy sigue teniendo la lista de temas")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- barra de arriba
def test_topbar_language_menu():
    """La bandera (44 px, vidrio) abre un menú con los 3 idiomas y una ✓; elegir uno cambia el idioma (store «lang»),
    avisa por el bus («lang») y cierra el menú. Esc también lo cierra y devuelve el foco a la bandera."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/mapa")
        b = page.evaluate("""() => { const r = document.getElementById('lang-b').getBoundingClientRect();
          return [Math.round(r.width), Math.round(r.height), document.getElementById('lang-b').classList.contains('glass')]; }""")
        if b != [44, 44, True]:
            probs.append(f"la bandera mide {b} (se esperaba 44×44 de vidrio)")
        page.evaluate("window.__langEv = []; bus.on('lang', d => window.__langEv.push(d && d.lang))")
        page.locator("#lang-b").click()
        page.wait_for_selector("#lang-m:not([hidden])", timeout=3000)
        m = page.evaluate("""() => { const m = document.getElementById('lang-m');
          return {role: m.getAttribute('role'), exp: document.getElementById('lang-b').getAttribute('aria-expanded'),
            items: [...m.querySelectorAll('[role=menuitemradio]')].map(i => [i.dataset.lang, i.getAttribute('aria-checked'),
              getComputedStyle(i.querySelector('.lm-chk')).visibility]),
            radius: getComputedStyle(m).borderTopLeftRadius}; }""")
        if m["role"] != "menu" or m["exp"] != "true" or len(m["items"]) != 3:
            probs.append(f"menú de idiomas: {m}")
        checked = [i for i in m["items"] if i[1] == "true"]
        if [c[0] for c in checked] != ["english"] or checked[0][2] != "visible":
            probs.append(f"la ✓ del idioma actual: {m['items']}")
        if any(i[2] == "visible" for i in m["items"] if i[1] != "true"):
            probs.append(f"hay ✓ en idiomas no elegidos: {m['items']}")
        if m["radius"] != "20px":
            probs.append(f"el menú tiene radio {m['radius']} (20px)")
        n0 = page.evaluate(_ROUTE_N)
        page.locator("#lang-m [data-lang='français']").click()
        _wait_route(page, n0)
        st = page.evaluate("""() => ({lang: JSON.parse(localStorage.getItem('lang')), ev: window.__langEv,
          open: !document.getElementById('lang-m').hidden})""")
        if st != {"lang": "français", "ev": ["français"], "open": False}:
            probs.append(f"al elegir francés: {st}")
        page.locator("#lang-b").click()
        page.wait_for_selector("#lang-m:not([hidden])", timeout=3000)
        page.keyboard.press("Escape")
        page.wait_for_selector("#lang-m[hidden]", state="attached", timeout=3000)
        if page.evaluate("document.activeElement && document.activeElement.id") != "lang-b":
            probs.append("Esc no devuelve el foco a la bandera")
        # volver al inglés para no dejar la partida cambiada
        page.locator("#lang-b").click()
        page.wait_for_selector("#lang-m:not([hidden])", timeout=3000)
        page.locator("#lang-m [data-lang='english']").click()
        page.wait_for_timeout(400)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_topbar_coins_and_settings():
    """Las monedas (data-coins-pill con id=coins dentro) abren la tienda de la granja; el engranaje («Ajustes») abre
    la hoja de Ajustes de js/settings.js (sonido, voz y velocidad, apariencia, accesibilidad y Para mayores, con el
    estado de Google). Junto a las monedas no hay nada de Google (ni la pastilla «Guardar» ni su hueco: la partida se
    guarda sola) y no queda nada de la cabecera vieja."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/mapa")
        old = page.evaluate("""() => ({hnav: !!document.querySelector('.hnav'), footer: !!document.querySelector('footer'),
          cfgb: !!document.getElementById('cfg-b'), fab: [...document.scripts].some(s => /fab\\.js/.test(s.src)),
          svchip: !!document.querySelector('#sv-chip'), slot: !!document.querySelector('[data-sync-slot], .tb-slot'),
          coins: !!document.querySelector('[data-coins-pill] #coins'), gear: (document.querySelector('.topbar [aria-label=Ajustes]') || {}).tagName})""")
        if old != {"hnav": False, "footer": False, "cfgb": False, "fab": False, "svchip": False, "slot": False, "coins": True, "gear": "BUTTON"}:
            probs.append(f"barra de arriba: {old}")
        n0 = page.evaluate(_ROUTE_N)
        page.locator("[data-coins-pill]").click()
        _wait_route(page, n0)
        page.wait_for_timeout(900)
        # F4b: la tienda es la hoja de la granja (dialog#fm-shop), no una sección h2#shop de la página
        sh = page.evaluate("""() => { const d = document.getElementById('fm-shop'), h = d && d.querySelector('.m-head h2'), r = h && h.getBoundingClientRect();
          return {hash: location.hash, open: !!(d && d.open), focus: !!(d && d.contains(document.activeElement)), top: r ? Math.round(r.top) : null, vh: innerHeight}; }""")
        if sh["hash"] != "#/granja" or not sh["open"] or not sh["focus"] or sh["top"] is None or not (0 <= sh["top"] < sh["vh"]):
            probs.append(f"las monedas no abren la tienda: {sh}")
        if sh["open"]:
            page.locator("#fm-shop [data-x]").click()
            page.wait_for_function("() => !document.getElementById('fm-shop').open", timeout=3000)
            page.wait_for_timeout(300)
        # el engranaje abre la hoja de Ajustes
        page.locator(".topbar [aria-label=Ajustes]").click()
        page.wait_for_selector("dialog#ajustes[open]", timeout=3000)
        C.settle(page, 200)
        cfg = page.evaluate("""() => { const d = document.getElementById('ajustes');
          return {sheet: d.classList.contains('m-sheet'), title: (document.getElementById(d.getAttribute('aria-labelledby')) || {}).textContent,
            snd: !!d.querySelector('#aj-snd[role=switch]'), theme: d.querySelectorAll('#aj-th [data-th]').length,
            voz: !!d.querySelector('#aj-voz'), acc: !!d.querySelector('#aj-acc'), may: !!d.querySelector('#aj-may'),
            sync: !!d.querySelector('[data-sync-cfg]')}; }""")
        want = {"sheet": True, "title": "Ajustes", "snd": True, "theme": 3, "voz": True, "acc": True, "may": True, "sync": True}
        if cfg != want:
            probs.append(f"hoja de Ajustes: {cfg}")
        # el interruptor de sonido quita y pone los sonidos
        m0 = page.evaluate("sfx.muted")
        page.locator("label[for=aj-snd]").click()
        if page.evaluate("sfx.muted") == m0:
            probs.append("el interruptor de Sonidos no cambia nada")
        page.locator("label[for=aj-snd]").click()
        if page.evaluate("sfx.muted") != m0:
            probs.append("el interruptor de Sonidos no vuelve a su sitio")
        page.locator("#aj-done").click()
        page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=3000)
        if page.evaluate("typeof window.openSettings") != "function":
            probs.append("falta window.openSettings")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- modo foco
def test_focus_mode():
    """html[data-focus] en una lección, durante un repaso y en una partida: sin barras, con una ✕ de vidrio de 44 px
    arriba a la izquierda que vuelve a donde estaba antes de entrar (o a la raíz de la pestaña) y un contador de
    monedas arriba a la derecha."""
    page = C.new_page("phone")
    probs = []
    look = """() => { const vis = el => !!el && !!el.getClientRects().length && getComputedStyle(el).display !== 'none';
      const x = document.getElementById('fx-x'), c = document.querySelector('.focusbar [data-coin-target]');
      const xr = x.getBoundingClientRect(), cr = c.getBoundingClientRect();
      return {focus: document.documentElement.dataset.focus || '', tab: vis(document.getElementById('tabbar')), top: vis(document.querySelector('.topbar .tb-group')),
        x: vis(x) ? [Math.round(xr.width), Math.round(xr.height), Math.round(xr.left)] : null, href: x.getAttribute('href'),
        coin: vis(c) ? [Math.round(innerWidth - cr.right), c.textContent.replace(/\\D/g, '')] : null,
        coins: String(game().coins), target: M.coinTarget() === c}; }"""
    try:
        C.seed(page)
        C.goto(page, "#/mapa")
        st = page.evaluate(look)
        if st["focus"] or not st["tab"] or not st["top"] or st["x"]:
            probs.append(f"fuera del modo foco: {st}")
        cases = [(f"#/leccion/{R.LESSON}", "leccion", "#/mapa"), ("#/juegos/lluvia", "juego", "#/juegos")]
        for h, f, back in cases:
            C.goto(page, h)
            st = page.evaluate(look)
            if st["focus"] != f or st["tab"] or st["top"]:
                probs.append(f"{h}: modo foco {st['focus']!r}, barras {st['tab']}/{st['top']}")
            if st["x"] is None or st["x"][:2] != [44, 44] or st["x"][2] > 30:
                probs.append(f"{h}: la ✕ {st['x']}")
            if st["href"] != back:
                probs.append(f"{h}: la ✕ lleva a {st['href']} (se esperaba {back})")
            if not st["coin"] or st["coin"][0] > 30 or st["coin"][1] != st["coins"] or not st["target"]:
                probs.append(f"{h}: contador de monedas {st['coin']} (monedas {st['coins']}, destino {st['target']})")
            n0 = page.evaluate(_ROUTE_N)
            page.locator("#fx-x").click()
            if f == "juego":                 # en una partida, la ✕ es la pausa: «Salir» vuelve a los juegos
                page.wait_for_selector("dialog#gm-pause[open]", timeout=3000)
                page.locator("#gm-pz-out").click()
            _wait_route(page, n0)
            st = page.evaluate(look)
            if "#/" + C.current_hash(page) != back or st["focus"] or not st["tab"]:
                probs.append(f"{h}: al tocar la ✕ queda en #/{C.current_hash(page)} con foco {st['focus']!r}")
        # repaso (F3b, js/review.js): con pendientes #/repaso ya es la primera tarjeta, en modo foco; la ✕ abre
        # «¿Paramos aquí?» y «Salir» vuelve a donde estaba (los juegos)
        C.goto(page, "#/repaso")
        page.wait_for_function("() => document.documentElement.dataset.focus === 'repaso'", timeout=4000)
        st = page.evaluate(look)
        if st["tab"] or st["href"] != "#/juegos":
            probs.append(f"repaso en marcha: {st}")
        page.locator("#fx-x").click()
        page.wait_for_selector("dialog#rv-pause[open]", timeout=3000)
        page.locator("#rv-pz-out").click()
        page.wait_for_function("() => !document.documentElement.dataset.focus", timeout=4000)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- monedas y avisos
def test_coins_fly_once_and_toast_below_bar():
    """award(n, por qué, false, desde) hace volar las monedas al contador y el motivo sale en la cápsula de avisos,
    debajo de la barra de arriba. El sonido de moneda suena una sola vez: o las notas de M.coins o sfx «coin»."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/mapa")
        page.evaluate("""() => { window.__snd = []; const p = sfx.play.bind(sfx), n = sfx.note.bind(sfx);
          sfx.play = k => { window.__snd.push(k); return p(k); }; sfx.note = i => { window.__snd.push('note'); return n(i); }; }""")
        c0 = page.evaluate("game().coins")
        page.evaluate("award(5, '¡Prueba!', false, document.querySelector('#app'))")
        page.wait_for_selector("#m-toasts:not(:empty)", timeout=3000)
        page.wait_for_timeout(500)              # la cápsula entra bajando: se mide donde se queda
        t = page.evaluate("""() => { const t = document.getElementById('m-toasts'), r = (t.firstElementChild || t).getBoundingClientRect(),
          b = document.querySelector('.topbar .tb-group').getBoundingClientRect(); return {text: t.textContent, top: r.top, bar: b.bottom}; }""")
        if "¡Prueba! +5" not in t["text"]:
            probs.append(f"la cápsula dice {t['text']!r}")
        if t["top"] < t["bar"]:
            probs.append(f"la cápsula ({t['top']}) queda encima de la barra de arriba ({t['bar']})")
        page.wait_for_timeout(1800)
        st = page.evaluate("({coins: document.getElementById('coins').textContent, n: game().coins, snd: window.__snd})")
        if st["coins"] != str(c0 + 5) or st["n"] != c0 + 5:
            probs.append(f"el contador no sube: {st}")
        if "coin" in st["snd"] or "note" not in st["snd"]:
            probs.append(f"monedas que vuelan: sonidos {st['snd']} (solo notas, sin «coin»)")
        page.evaluate("window.__snd = []")
        page.evaluate("award(2, '', false)")
        page.wait_for_timeout(600)
        snd = page.evaluate("window.__snd")
        if snd.count("coin") != 1 or "note" in snd:
            probs.append(f"monedas sin vuelo: sonidos {snd} (un «coin»)")
        # el viejo .pr-toast ya no existe
        page.evaluate("toast('Hola')")
        if page.locator(".pr-toast").count():
            probs.append("toast() sigue usando .pr-toast")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_buddy_without_floating_fox():
    """Del zorro flotante no queda nada (ni .bd, ni .bd-peek, ni sus frases); las misiones y la palabra del día siguen
    en Hoy, recoger una misión paga con monedas que vuelan y sin «Recoge tus 🪙 en Inicio»."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        for h in (f"#/leccion/{R.LESSON}", "#/repaso", f"#/doc/{R.TOPIC}", "#/juegos/lluvia", "#/"):
            C.goto(page, h)
            if page.locator(".bd, .bd-peek, .bd-say, .bd-float").count():
                probs.append(f"{h}: sigue el zorro flotante")
        api = page.evaluate("Object.keys(window.vocabBuddy || {}).sort()")
        for k in ("missions", "misHtml", "paintMis", "claim", "openChest", "wotdPick", "paintWotd", "cheer"):
            if k not in api:
                probs.append(f"window.vocabBuddy.{k} no está")
        if not page.locator("#bd-mis").count():
            probs.append("Hoy no tiene las misiones")
        # una misión cumplida fuera de Hoy: cápsula de logro sin «Recoge»
        C.goto(page, "#/mapa")
        page.evaluate("""() => { const k = 'buddy:missions', M = JSON.parse(localStorage.getItem(k)); const m = M.list.find(x => !x.got);
          m.n = m.goal - 1; localStorage.setItem(k, JSON.stringify(M)); window.__mk = m.k; }""")
        ev = page.evaluate("""() => { const M = vocabBuddy.missions(), m = M.list.find(x => x.k === window.__mk);
          return {les: 'lesson-done', ans: 'answer', rev: 'review-card', game: 'game-done', feed: 'farm-feed', harv: 'farm-harvest',
            coll: 'farm-collect', find: 'farm-find'}[m.k]; }""")
        page.evaluate("ev => bus.emit(ev, {ok: true, id: 'x', first: false})", ev)
        page.wait_for_function("() => /Misión cumplida/.test((document.getElementById('m-toasts') || {}).textContent || '')", timeout=4000)
        txt = page.evaluate("document.getElementById('m-toasts').textContent")
        if "Recoge" in txt:
            probs.append(f"el aviso de misión dice {txt!r}")
        # recogerla en Hoy (en la hoja de Misiones): +15 con monedas que vuelan
        C.goto(page, "#/")
        c0 = page.evaluate("game().coins")
        page.locator("#bd-mis").click()
        page.wait_for_selector("#bd-mis-s[open]", timeout=3000)
        btn = page.locator("#bd-mis-s [data-get]")
        if not btn.count():
            probs.append("en Hoy no sale el botón de recoger la misión")
        else:
            btn.first.click()
            page.wait_for_timeout(1800)
            c1 = page.evaluate("game().coins")
            if c1 - c0 < 15:
                probs.append(f"recoger la misión da {c1 - c0} monedas")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- movimiento tranquilo
def test_calm_motion_matches_reduced_motion():
    """html[data-motion=calm] apaga lo mismo que «Reducir movimiento»: la regla global de index.html y las de los
    módulos (copiadas en <style id=css-calm>)."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/")
        st = page.evaluate("""() => { const host = document.createElement('div'); host.innerHTML =
            '<button class="bd-bounce" id="t-rv">x</button><i id="t-inf" style="animation:m-dummy 1s infinite">y</i>';
          document.getElementById('app').appendChild(host);
          const css = id => getComputedStyle(document.getElementById(id));
          const a = [css('t-rv').animationName, css('t-inf').animationIterationCount];
          document.documentElement.dataset.motion = 'calm';
          const b = [css('t-rv').animationName, css('t-inf').animationIterationCount];
          delete document.documentElement.dataset.motion; host.remove();
          const calm = document.getElementById('css-calm');
          return {a, b, calm: calm ? calm.textContent.length : 0, rm: M.rm()}; }""")
        if st["a"][0] == "none" or st["a"][1] != "infinite":
            probs.append(f"sin calma: {st['a']}")
        if st["b"] != ["none", "1"]:
            probs.append(f"con data-motion=calm: {st['b']} (se esperaba animación quitada y un solo ciclo)")
        if st["calm"] < 200:
            probs.append(f"<style id=css-calm> casi vacío ({st['calm']})")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_sw_version_and_no_fab():
    """sw.js va por la versión 15 o más (F1 era la 14), sin js/fab.js, y OFF_SHELL de index.html coincide."""
    sw = (C.REPO / "sw.js").read_text(encoding="utf-8")
    html = (C.REPO / "index.html").read_text(encoding="utf-8")
    probs = []
    m = re.search(r"const VERSION = (\d+);", sw)
    v = int(m.group(1)) if m else 0
    if v < 15:
        probs.append(f"sw.js está en la versión {v} (F2 sube a 15 o más)")
    if "fab.js" in sw or "fab.js" in html:
        probs.append("sigue habiendo referencias a js/fab.js")
    if (C.REPO / "js" / "fab.js").exists():
        probs.append("js/fab.js sigue en el repo")
    if f'OFF_SHELL = "vocab-shell-v{v}"' not in html:
        probs.append(f"OFF_SHELL no es vocab-shell-v{v}")
    assert not probs, "\n".join(probs)
