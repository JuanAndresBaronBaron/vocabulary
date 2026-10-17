"""Arreglos de las revisiones de F2: la barra de arriba desde 820 px (cabe siempre con sus nombres enteros, se aprieta por
pasos y, si no, vuelve abajo), la pastilla «Guardar» (su borde es el suyo, sin relleno azul), el presupuesto de
desenfoque (3 superficies como mucho), la Puerta de mayores (dos cifras con llevada y teclado: adivinar no sirve; un
minuto de espera tras 3 fallos), rutas que no existen, la ✕ del modo foco, el scroll al volver atrás, los avisos en
los segmentos y del refugio, «Reducir movimiento» en el fondo de las hojas, hojas opacas a toda altura y centradas en
el ordenador, la hoja corta del aviso de Google, Voz y velocidad sin tecnicismos, el título de cada pantalla, los
créditos y la privacidad en español."""
from __future__ import annotations

import json
import re

import common as C
import routes as R

_ROUTE_N = "window.__vocabRouteN || 0"

# la barra de arriba: dónde está cada cosa
_TOP = """() => {
  const nav = document.getElementById('tabbar'), tb = document.getElementById('topbar'), R = e => e.getBoundingClientRect();
  const n = R(nav), f = R(document.getElementById('lang-b')), r = R(document.querySelector('.topbar .tb-right'));
  return {bar: document.documentElement.dataset.bar || '', inTop: nav.parentNode === tb,
    order: [...tb.children].map(e => e.id || e.className.split(' ')[0]),
    n: [n.left, n.right, n.top, n.bottom], f: f.right, r: r.left, rr: r.right, vw: innerWidth, vh: innerHeight,
    cut: [...nav.querySelectorAll('.tab .tl')].filter(t => t.scrollWidth > t.clientWidth + .5).map(t => t.textContent),
    tabs: [...nav.querySelectorAll('.tab')].map(t => Math.round(t.getBoundingClientRect().height))};
}"""
# la pastilla «Guardar» tal como la pinta js/sync.js (paintChip), y monedas de 5 cifras
_PILL = """(coins) => { const g = game(); g.coins = coins; gameSet(g); bus.emit('coins', {n: 0, quiet: true});
  if (!document.getElementById('sv-chip')) { const c = document.createElement('button'); c.type = 'button'; c.id = 'sv-chip'; c.className = 'glass sv-chip';
    c.innerHTML = ico('cloud-arrow-up', 'bold', 20) + '<span class="sv-chip-t" aria-hidden="true">Guardar</span>';
    document.querySelector('[data-sync-slot]').appendChild(c); } }"""
# cuántas superficies visibles tienen desenfoque ahora mismo
_BLUR = """() => [...document.querySelectorAll('body *')].filter(e => {
  const s = getComputedStyle(e), b = s.backdropFilter || s.webkitBackdropFilter;
  if (!b || b === 'none' || s.display === 'none' || s.visibility === 'hidden') return false;
  const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
}).map(e => e.id || e.className.split(' ').slice(0, 2).join('.'))"""


def _wait_route(page, n0, timeout=8000):
    page.wait_for_function(f"n => ({_ROUTE_N}) > n", arg=n0, timeout=timeout)
    C.settle(page, 200)


# ---------------------------------------------------------------- barra de arriba (≥ 820 px)
def test_desk_bar_always_fits():
    """Desde 820 px la barra va en header.topbar entre la bandera y el grupo de la derecha (también en el DOM: el
    orden del teclado es el de la pantalla), con pestañas de 44 px y los 5 nombres enteros, a 12 px como poco de los
    botones de los lados; con la pastilla «Guardar», 12345 monedas y Texto más grande se aprieta por pasos (slim,
    compact) y, si aun así no cabe, vuelve abajo como en el móvil. Por debajo de 820 px, abajo y sin data-bar."""
    probs = []
    for text in ("", "large"):
        for w in (820, 834, 860, 900, 1024, 1100, 1280):
            page = C.new_page("desk")
            try:
                page.set_viewport_size({"width": w, "height": 900})
                C.seed(page)
                C.goto(page, "#/")
                if text:
                    page.evaluate("vocabUI.set('text', 'large')")
                for pill in (False, True):
                    if pill:
                        page.evaluate(_PILL, 12345)
                    page.wait_for_timeout(250)
                    t = page.evaluate(_TOP)
                    tag = f"{w}{' texto grande' if text else ''}{' con pastilla' if pill else ''}"
                    if t["cut"]:
                        probs.append(f"{tag}: nombres cortados {t['cut']}")
                    if t["bar"] == "bottom":
                        if t["inTop"] or t["n"][3] < t["vh"] - 80:
                            probs.append(f"{tag}: con data-bar=bottom la barra no está abajo: {t}")
                        if not (pill or text):
                            probs.append(f"{tag}: la barra baja sin motivo")
                        continue
                    if not t["inTop"] or t["order"][:3] != ["lang-b", "tabbar", "tb-right"]:
                        probs.append(f"{tag}: la barra no va entre la bandera y el grupo de la derecha: {t['order']}")
                    if t["n"][0] < t["f"] + 11.5 or t["n"][1] > t["r"] - 11.5 or t["rr"] > t["vw"] - 15.5:
                        probs.append(f"{tag}: la barra pisa o se arrima a otros botones: {t}")
                    if min(t["tabs"]) < 44:
                        probs.append(f"{tag}: pestañas de {t['tabs']} px")
                if w >= 1100 and not text and page.evaluate("document.documentElement.dataset.bar || ''"):
                    probs.append(f"{w}: a este ancho cabe todo sin apretar ({page.evaluate('document.documentElement.dataset.bar')})")
                probs += C.errors(page)
            finally:
                page.context.close()
    page = C.new_page("desk")
    try:
        page.set_viewport_size({"width": 819, "height": 900})
        C.seed(page)
        C.goto(page, "#/")
        t = page.evaluate(_TOP)
        if t["inTop"] or t["bar"] or t["n"][3] < t["vh"] - 80:
            probs.append(f"819: la barra debería ir abajo, fuera de la cabecera: {t}")
        page.set_viewport_size({"width": 1024, "height": 900})
        page.wait_for_timeout(300)
        if not page.evaluate(_TOP)["inTop"]:
            probs.append("al ensanchar a 1024 la barra no sube a la cabecera")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_pill_rim_is_its_own():
    """El borde de vidrio (::before) de la pastilla «Guardar» mide lo que la pastilla (no la barra entera) y la pastilla
    no lleva relleno azul: es vidrio de la barra con letra azul."""
    probs = []
    for scheme in ("light", "dark"):
        page = C.new_page("phone", color_scheme=scheme)
        try:
            C.seed(page)
            C.goto(page, "#/")
            page.evaluate(_PILL, 245)
            r = page.evaluate("""() => { const c = document.getElementById('sv-chip'), b = getComputedStyle(c, '::before'), s = getComputedStyle(c);
              const px = v => parseFloat(v) || 0, box = (z, a, e) => px(z) + (b.boxSizing === 'border-box' ? 0 : px(b['padding' + a]) + px(b['padding' + e]));
              return {w: c.getBoundingClientRect().width, h: c.getBoundingClientRect().height, bw: box(b.width, 'Left', 'Right'), bh: box(b.height, 'Top', 'Bottom'),
                pos: s.position, bg: s.backgroundColor, img: s.backgroundImage, color: s.color, blur: s.backdropFilter}; }""")
            if abs(r["w"] - r["bw"]) > 1 or abs(r["h"] - r["bh"]) > 1 or r["pos"] != "relative":
                probs.append(f"{scheme}: el borde de la pastilla no es suyo: {r}")
            if "30, 110, 244" in r["bg"] + r["img"]:
                probs.append(f"{scheme}: la pastilla lleva relleno azul: {r}")
            if r["blur"] not in ("none", ""):
                probs.append(f"{scheme}: la pastilla tiene desenfoque propio: {r['blur']}")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_blur_budget():
    """Como mucho 3 superficies con desenfoque a la vez: Hoy; el camino con el accesorio y un aviso; con el menú de
    idioma; con Ajustes abierta; y con la Puerta encima de Ajustes."""
    probs = []
    for kind in ("phone", "desk"):
        page = C.new_page(kind)
        try:
            C.seed(page)
            C.goto(page, "#/")
            cases = [("Hoy", page.evaluate(_BLUR))]
            C.goto(page, "#/mapa")
            page.evaluate("""() => { const a = vocabAccessory && document.getElementById('acc'); if (a) { a.hidden = false; document.documentElement.setAttribute('data-acc', ''); }
              M.toast('¡Muy bien!'); }""")
            page.wait_for_timeout(350)
            cases.append(("camino + accesorio + aviso", page.evaluate(_BLUR)))
            page.locator("#lang-b").click()
            page.wait_for_selector("#lang-m:not([hidden])", timeout=3000)
            page.wait_for_timeout(300)
            cases.append(("menú de idioma", page.evaluate(_BLUR)))
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
            page.locator(".topbar [data-open=ajustes]").click()
            page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
            C.settle(page, 300)
            cases.append(("Ajustes", page.evaluate(_BLUR)))
            page.locator("#aj-may").click()
            page.wait_for_selector("#gate[open]", timeout=3000)
            C.settle(page, 300)
            cases.append(("Puerta sobre Ajustes", page.evaluate(_BLUR)))
            for name, els in cases:
                if len(els) > 3:
                    probs.append(f"{kind} {name}: {len(els)} superficies con desenfoque {els}")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Puerta de mayores
def test_gate_random_guessing_fails():
    """Tocando al azar (3 intentos por apertura, cada uno de 1 a 3 teclas de cifra y OK) la Puerta casi nunca se pasa:
    200 aperturas, 2 como mucho. Tras los 3 fallos queda un minuto de espera ("vocab:gate-wait" en sessionStorage) en el que no se puede
    contestar."""
    page = C.new_page("phone", reduced_motion="reduce")
    try:
        C.seed(page)
        C.goto(page, "#/")
        r = page.evaluate("""async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms)), d = () => document.getElementById('gate');
          let ok = 0, waits = 0, blocked = 0;
          for (let i = 0; i < 200; i++) {
            sessionStorage.removeItem('vocab:gate-wait'); adultGate.forget();
            const p = adultGate({reason: 'Prueba.'});
            for (let k = 0; k < 50 && !(d() && d().open); k++) await sleep(20);   /* (la de antes acaba de cerrarse) */
            for (let t = 0; t < 3 && d().open; t++) {
              /* toques al azar: de 1 a 3 teclas de cifra cualquiera y OK */
              const len = 1 + Math.floor(Math.random() * 3);
              for (let j = 0; j < len; j++) d().querySelector(`.gt-k[data-k="${Math.floor(Math.random() * 10)}"]`).click();
              d().querySelector('.gt-k[data-k="ok"]').click();
            }
            if (await p) ok++;
            else if (adultGate.waiting() > 0) waits++;
            for (let k = 0; k < 40 && d().open; k++) await sleep(20);
            await sleep(10);
          }
          /* durante la espera: se abre sin poder contestar */
          sessionStorage.setItem('vocab:gate-wait', String(Date.now() + 60e3)); adultGate.forget();
          const p = adultGate({});
          blocked = [...d().querySelectorAll('.gt-k')].every(k => k.disabled) && d().querySelector('#gt-q').hidden;
          document.getElementById('gt-x').click(); await p;
          sessionStorage.removeItem('vocab:gate-wait');
          return {ok, waits, blocked};
        }""")
        errs = C.errors(page)
    finally:
        page.context.close()
    assert r["ok"] <= 2, f"tocando al azar se pasó la Puerta {r['ok']} veces de 200"
    assert r["waits"] >= 190, f"tras 3 fallos no queda la espera de un minuto ({r['waits']} de 200)"
    assert r["blocked"], "durante la espera la Puerta deja contestar"
    assert not errs, "\n".join(errs)


def test_gate_keyboard_and_premios_details():
    """La Puerta también se contesta con el teclado físico (cifras, Retroceso, Intro). En Premios, «Para mayores»
    (detalle y descarga) pasa por la Puerta: sin ella se queda cerrado; al acertar se abre."""
    page = C.new_page("desk")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/progreso")
        page.locator("details.adult summary").click()
        page.wait_for_selector("#gate[open]", timeout=3000)
        C.settle(page, 250)
        if page.evaluate("document.querySelector('details.adult').open"):
            probs.append("«Para mayores» de Premios se abre sin la Puerta")
        page.locator("#gt-x").click()
        page.wait_for_function("() => !document.getElementById('gate').open", timeout=3000)
        page.wait_for_timeout(300)
        if page.evaluate("document.querySelector('details.adult').open") or page.evaluate("document.getElementById('adult').innerHTML"):
            probs.append("al cancelar la Puerta, «Para mayores» de Premios se abre igual")
        page.locator("details.adult summary").click()
        page.wait_for_selector("#gate[open]", timeout=3000)
        C.settle(page, 250)
        q = page.evaluate("document.querySelector('#gt-q b').textContent")
        a, b = q.split(" más ")
        import test_f2_ajustes as A   # noqa: PLC0415 (los mismos números en letras)
        s = A._num(a) + A._num(b)
        page.keyboard.type("9")
        page.keyboard.press("Backspace")
        page.keyboard.type(str(s))
        if page.evaluate("document.getElementById('gt-f').textContent") != str(s):
            probs.append(f"el teclado físico no escribe en el campo: {page.evaluate('document.getElementById(`gt-f`).textContent')!r}")
        page.keyboard.press("Enter")
        page.wait_for_function("() => document.querySelector('details.adult').open", timeout=3000)
        page.wait_for_function("() => document.getElementById('adult').innerHTML.length > 0", timeout=4000)
        if page.locator("main #off-panel").count():
            probs.append("Premios sigue teniendo su propia «Descargar todo» (está en Ajustes › Para mayores)")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- rutas y modo foco
def test_unknown_route_and_missing_lesson():
    """Una ruta que no existe (#/xyz) se cambia por Hoy (con su pestaña marcada); una lección que no existe se cambia
    por el camino, fuera del modo foco y con las barras."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/granja")
        page.evaluate("location.hash = '#/xyz'")
        page.wait_for_function("() => location.hash === '#/' || location.hash === ''", timeout=4000)
        C.settle(page, 300)
        st = page.evaluate("""() => ({tab: document.documentElement.dataset.tab, sel: (document.querySelector('#tabbar [aria-selected=true]') || {}).dataset?.nav,
          hm: !!document.getElementById('hm')})""")
        if st != {"tab": "hoy", "sel": "hoy", "hm": True}:
            probs.append(f"#/xyz: {st}")
        page.evaluate("location.hash = '#/leccion/no-existe-999'")
        page.wait_for_function("() => location.hash.startsWith('#/mapa')", timeout=4000)
        C.settle(page, 300)
        st = page.evaluate("""() => ({focus: document.documentElement.dataset.focus || '', bar: !!document.getElementById('tabbar').getClientRects().length,
          tab: document.documentElement.dataset.tab})""")
        if st != {"focus": "", "bar": True, "tab": "aprender"}:
            probs.append(f"lección que no existe: {st} (hash {page.evaluate('location.hash')})")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_focus_x_goes_back_where_it_was():
    """«Empezar» en Hoy (el repaso) y la ✕ vuelven a Hoy, no a Aprender; también tras recargar en medio del repaso.
    Una lección empezada desde el camino vuelve al camino."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/")
        n0 = page.evaluate(_ROUTE_N)
        page.locator("#hm-go").click()
        page.wait_for_function("() => document.documentElement.dataset.focus === 'repaso'", timeout=5000)
        C.settle(page, 300)
        if page.evaluate("document.getElementById('fx-x').getAttribute('href')") != "#/":
            probs.append(f"repaso desde Hoy: la ✕ lleva a {page.evaluate('document.getElementById(`fx-x`).getAttribute(`href`)')}")
        page.locator("#fx-x").click()
        page.wait_for_function("() => !document.documentElement.dataset.focus", timeout=5000)
        C.settle(page, 300)
        if C.current_hash(page) != "" or page.evaluate("document.documentElement.dataset.tab") != "hoy":
            probs.append(f"repaso desde Hoy: la ✕ deja en #/{C.current_hash(page)}")
        # lección desde el camino
        C.goto(page, "#/mapa")
        C.goto(page, f"#/leccion/{R.LESSON}")
        C.reload(page)
        if page.evaluate("document.getElementById('fx-x').getAttribute('href')") != "#/mapa":
            probs.append(f"lección desde el camino (tras recargar): la ✕ lleva a {page.evaluate('document.getElementById(`fx-x`).getAttribute(`href`)')}")
        del n0
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_back_restores_scroll_and_map_keeps_header():
    """Atrás del navegador vuelve al scroll que tenía la pantalla (Palabras a 2000 px → un tema → atrás). Entrar en
    Aprender por la pestaña deja a la vista el título y los segmentos (el camino no se desplaza solo); con un nivel
    (#/mapa/A1) sí baja hasta la lección actual."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/palabras")
        page.evaluate("scrollTo(0, 2000)")
        page.wait_for_timeout(500)
        y0 = page.evaluate("scrollY")
        n0 = page.evaluate(_ROUTE_N)
        page.evaluate("""() => { const a = [...document.querySelectorAll('#app a.doc:not(.off)')].find(a => a.getBoundingClientRect().top > 80); a.click(); }""")
        _wait_route(page, n0)
        n0 = page.evaluate(_ROUTE_N)
        page.go_back()
        _wait_route(page, n0)
        page.wait_for_timeout(600)
        y1 = page.evaluate("scrollY")
        if abs(y1 - y0) > 4:
            probs.append(f"atrás no vuelve al scroll de Palabras: {y0} → {y1}")
    finally:
        page.context.close()
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, "#/")
        n0 = page.evaluate(_ROUTE_N)
        page.locator("#tab-aprender").click()
        _wait_route(page, n0)
        page.wait_for_timeout(500)
        st = page.evaluate("""() => { const s = document.querySelector('#tabhead .seg'); const r = s && s.getBoundingClientRect();
          return {h: location.hash, y: scrollY, seg: r ? r.top >= 0 && r.bottom <= innerHeight : false}; }""")
        if st["h"] != "#/mapa" or not st["seg"]:
            probs.append(f"Aprender por la pestaña: {st}")
        C.goto(page, f"#/mapa/{R.LEVEL}")
        page.wait_for_timeout(700)
        if page.evaluate("scrollY") < 100:
            probs.append(f"#/mapa/{R.LEVEL} no baja hasta la lección actual")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- avisos
def test_badges_on_segments_and_shelter():
    """El «9+» de Aprender sale también en el segmento «Repasar» y el punto de Jugar en «Álbum» (con su texto para el
    lector de pantalla). Un animal que se fue al refugio sin que el niño lo viera pone el punto en Granja y una fila
    en Hoy que lleva a la granja; al ver el aviso en la granja, las dos se van."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/mapa")
        s = page.evaluate("""() => { const a = document.querySelector('#tabhead .seg-i[href="#/repaso"]');
          return a ? {b: a.dataset.badge, label: a.getAttribute('aria-label') || '', after: getComputedStyle(a, '::after').content} : null; }""")
        if not s or s["b"] not in ("9+", "12") or "repasar" not in s["label"].lower() or s["after"] in ("none", "normal"):
            probs.append(f"segmento Repasar: {s}")
        page.evaluate("tabBadge('jugar', true, '2 pegatinas nuevas', '#/album')")
        C.goto(page, "#/juegos")
        s = page.evaluate("""() => { const a = document.querySelector('#tabhead .seg-i[href="#/album"]');
          return a ? {b: a.dataset.badge, label: a.getAttribute('aria-label') || ''} : null; }""")
        if not s or s["b"] != "" or "pegatinas" not in s["label"]:
            probs.append(f"segmento Álbum: {s}")
        # refugio: la gallina se fue y no lo ha visto
        page.evaluate("""() => { const s = store.get('farm:state', {}); s.shelter = {gallina: {t: Date.now() - 3600e3, seen: false}}; store.set('farm:state', s); }""")
        C.goto(page, "#/mapa")
        C.goto(page, "#/")
        st = page.evaluate("""() => { const b = document.querySelector('#tab-granja .tb-badge'), r = document.getElementById('fm-shel');
          return {dot: !b.hidden && b.classList.contains('dot'), label: document.getElementById('tab-granja').getAttribute('aria-label') || '',
            row: r ? {href: r.getAttribute('href'), t: r.textContent.replace(/\\s+/g, ' ').trim()} : null,
            fit: document.documentElement.scrollHeight <= innerHeight + 2}; }""")
        if not st["dot"] or "refugio" not in st["label"]:
            probs.append(f"refugio: la pestaña Granja no avisa: {st}")
        if not st["row"] or st["row"]["href"] != "#/granja" or "refugio" not in st["row"]["t"] or "vuelta" not in st["row"]["t"]:
            probs.append(f"refugio: la fila de Hoy: {st['row']}")
        if not st["fit"]:
            probs.append("con el aviso del refugio Hoy necesita scroll")
        # visto el aviso en la granja, se van
        page.evaluate("""() => { const s = store.get('farm:state', {}); s.shelter.gallina.seen = true; store.set('farm:state', s); }""")
        C.goto(page, "#/mapa")
        C.goto(page, "#/")
        st = page.evaluate("""() => ({row: !!document.getElementById('fm-shel'), label: document.getElementById('tab-granja').getAttribute('aria-label') || ''})""")
        if st["row"] or "refugio" in st["label"] and "en el refugio" not in st["label"]:
            probs.append(f"refugio visto: sigue el aviso {st}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- hojas
def test_sheets_opaque_and_centered_on_desk():
    """Móvil: Ajustes a media altura es de vidrio; a toda altura (una sub-página) es opaca y sin desenfoque. Ordenador:
    Ajustes es una hoja de formulario centrada, sin agarre, opaca y tan alta como su contenido. Con «Reducir
    movimiento» (el del aparato y el de Ajustes) el fondo oscuro de las hojas se funde en 150 ms como mucho."""
    probs = []
    look = """() => { const d = document.getElementById('ajustes'), r = d.getBoundingClientRect(), s = getComputedStyle(d), g = d.querySelector('.m-grab');
      return {detent: d.dataset.detent, top: r.top, bottom: r.bottom, h: r.height, vh: innerHeight, bg: s.backgroundColor, blur: s.backdropFilter,
        grab: !!g && !!g.getClientRects().length, bd: getComputedStyle(d, '::backdrop').transitionDuration}; }"""
    alpha = lambda c: float(c.split(",")[3].strip(" )")) if c.startswith("rgba") else 1.0   # noqa: E731
    for kind in ("phone", "desk"):
        page = C.new_page(kind)
        try:
            C.seed(page)
            C.goto(page, "#/")
            page.locator(".topbar [data-open=ajustes]").click()
            page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
            C.settle(page, 400)
            a = page.evaluate(look)
            if kind == "phone":
                if a["detent"] != "medium" or a["blur"] in ("none", ""):
                    probs.append(f"phone: Ajustes a media altura debería ser de vidrio: {a}")
                page.locator("#aj-acc").click()
                page.wait_for_function("() => vocabSettings.page === 'acc'", timeout=3000)
                page.wait_for_timeout(600)
                a = page.evaluate(look)
                if a["detent"] != "large" or alpha(a["bg"]) < 1 or a["blur"] not in ("none", ""):
                    probs.append(f"phone: Ajustes a toda altura no es opaca: {a}")
            else:
                mid = (a["top"] + a["bottom"]) / 2
                if abs(mid - a["vh"] / 2) > 2 or a["grab"] or alpha(a["bg"]) < 1 or a["blur"] not in ("none", ""):
                    probs.append(f"desk: Ajustes no es una hoja centrada y opaca: {a}")
                if a["h"] >= 676:
                    probs.append(f"desk: Ajustes no se ajusta a su contenido ({a['h']} px)")
            page.keyboard.press("Escape")
            page.wait_for_timeout(200)
            page.keyboard.press("Escape")
            page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=3000)
            probs += C.errors(page)
        finally:
            page.context.close()
    for how in ("aparato", "ajustes"):
        page = C.new_page("phone", reduced_motion="reduce" if how == "aparato" else "no-preference")
        try:
            C.seed(page)
            C.goto(page, "#/")
            if how == "ajustes":
                page.evaluate("vocabUI.set('motion', 'calm')")
            page.locator(".topbar [data-open=ajustes]").click()
            page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
            C.settle(page, 300)
            d = page.evaluate("getComputedStyle(document.getElementById('ajustes'), '::backdrop').transitionDuration")
            if max(float(x.strip().rstrip("s")) for x in d.split(",")) > 0.16:
                probs.append(f"reducir movimiento ({how}): el fondo de la hoja tarda {d}")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_sync_reminder_kid_sheet():
    """La fila «Guarda tu partida» de Hoy abre una hoja corta para el niño: «Enséñale esto a un mayor», «Soy mayor»
    (la Puerta y, al pasarla, Ajustes › Para mayores) y «Ahora no» (cierra y quita la fila)."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/")
        page.locator("#sv-rem").click()
        page.wait_for_selector("dialog#sv-kid[open]", timeout=3000)
        C.settle(page, 300)
        k = page.evaluate("""() => { const d = document.getElementById('sv-kid');
          return {t: (document.getElementById(d.getAttribute('aria-labelledby')) || {}).textContent, txt: d.textContent.replace(/\\s+/g, ' '),
            go: !!d.querySelector('[data-sv-go].glass-btn--pri'), later: !!d.querySelector('#sv-later')}; }""")
        if k["t"] != "Guarda tu partida" or "mayor" not in k["txt"] or not k["go"] or not k["later"]:
            probs.append(f"la hoja del niño: {k}")
        page.locator("#sv-kid [data-sv-go]").click()
        page.wait_for_selector("#gate[open]", timeout=3000)
        try:
            page.wait_for_function("() => !document.getElementById('sv-kid').open", timeout=2000)
        except Exception:  # noqa: BLE001
            probs.append("«Soy mayor» deja abierta la hoja del niño debajo de la Puerta")
        C.settle(page, 250)
        page.locator("#gt-x").click()
        page.wait_for_function("() => !document.getElementById('gate').open", timeout=3000)
        page.wait_for_timeout(300)
        page.locator("#sv-rem").click()
        page.wait_for_selector("dialog#sv-kid[open]", timeout=3000)
        C.settle(page, 250)
        page.locator("#sv-later").click()
        page.wait_for_function("() => !document.getElementById('sv-kid').open", timeout=3000)
        if page.locator("#sv-rem").count():
            probs.append("«Ahora no» no quita la fila de Hoy")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_voice_page_plain_words():
    """Voz y velocidad (sin Puerta): velocidad en palabras («Normal», «Lenta», «Rápida»), tortuga y conejo de Phosphor
    en vez de emoji, sin instrucciones técnicas (van a Para mayores) y, si el aparato no tiene voz del idioma,
    «Probar la voz» está desactivado. En Ajustes, los segmentos y el campo del nombre miden 44 px o más."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/")
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
        C.settle(page, 300)
        hs = page.evaluate("""() => ({seg: [...document.querySelectorAll('#aj-th .seg-i')].map(x => x.getBoundingClientRect().height),
          name: document.getElementById('aj-name').getBoundingClientRect().height})""")
        if min(hs["seg"]) < 44 or hs["name"] < 44:
            probs.append(f"zonas táctiles de Ajustes: {hs}")
        page.locator("#aj-voz").click()
        page.wait_for_function("() => vocabSettings.page === 'voz'", timeout=3000)
        page.wait_for_timeout(500)
        v = page.evaluate("""() => { const d = document.querySelector('#ajustes .aj-pg[data-pg=voz]'), t = d.textContent, b = d.querySelector('#cfg-t');
          return {rv: d.querySelector('#cfg-rv').textContent, vt: d.querySelector('#cfg-r').getAttribute('aria-valuetext'), emoji: /[🐢🐇]/u.test(t),
            win: /Windows|Configuración/.test(t), x: /\\d[.,]\\d+×/.test(t), turtle: !!d.querySelector('use[href="#i-turtle-bold"]'),
            rabbit: !!d.querySelector('use[href="#i-rabbit-bold"]'), voices: langVoices().length, dis: b.disabled}; }""")
        if v["rv"] != "Normal" or v["vt"] != "Normal" or v["emoji"] or v["win"] or v["x"] or not v["turtle"] or not v["rabbit"]:
            probs.append(f"Voz y velocidad: {v}")
        if v["dis"] != (v["voices"] == 0):
            probs.append(f"«Probar la voz» desactivado {v['dis']} con {v['voices']} voces")
        page.evaluate("() => { const r = document.querySelector('#ajustes #cfg-r'); r.value = '1.2'; r.dispatchEvent(new Event('input', {bubbles: true})); }")
        if page.evaluate("document.querySelector('#ajustes #cfg-rv').textContent") != "Rápida":
            probs.append("la velocidad no dice «Rápida»")
        page.evaluate("() => { const r = document.querySelector('#ajustes #cfg-r'); r.value = '0.9'; r.dispatchEvent(new Event('input', {bubbles: true})); }")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- lector de pantalla, créditos y privacidad
def test_title_live_region_credits_privacy():
    """Cada pantalla cambia el título de la página («Jugar · Vocabulary») y lo dice por una región aria-live discreta.
    Los enlaces MIT y OFL de Créditos abren en otra pestaña. privacy.html tiene arriba «Leer en español ↓» hacia
    #es y, al final, los créditos (OpenMoji, Phosphor, Nunito)."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/juegos")
        st = page.evaluate("({t: document.title, say: document.getElementById('route-say').textContent, live: document.getElementById('route-say').getAttribute('aria-live')})")
        if not st["t"].startswith("Jugar") or "Vocabulary" not in st["t"] or "Jugar" not in st["say"] or st["live"] != "polite":
            probs.append(f"título y anuncio en Jugar: {st}")
        C.goto(page, "#/")
        if not page.evaluate("document.title").startswith("Hoy"):
            probs.append(f"título en Hoy: {page.evaluate('document.title')!r}")
        cr = page.evaluate("""() => { const d = document.createElement('div'); d.innerHTML = creditsHtml();
          return [...d.querySelectorAll('a')].filter(a => /LICENSE|OFL/.test(a.getAttribute('href'))).map(a => a.target + ' ' + a.rel); }""")
        if cr != ["_blank noopener", "_blank noopener"]:
            probs.append(f"créditos MIT/OFL: {cr}")
        page.goto(C.base_url(page) + "/privacy.html")
        p = page.evaluate("""() => ({es: !!document.getElementById('es'), link: (document.querySelector('a[href="#es"]') || {}).textContent || '',
          cred: /OpenMoji/.test((document.getElementById('credits') || {}).nextElementSibling?.textContent || '')
            && /Phosphor/.test(document.body.textContent) && /Nunito/.test(document.body.textContent)})""")
        if not p["es"] or "español" not in p["link"] or not p["cred"]:
            probs.append(f"privacy.html: {p}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_short_phones_fit_and_farm_fade():
    """Hoy cabe sin scroll en un iPhone SE (375×667) y en un Android de 360×740 con la partida sembrada (con un solo
    HOME_SLOT). En la granja, la escena llega hasta arriba sin el borde que funde, y al bajar más allá de ella el
    borde vuelve (html[data-fm-past]) para que nada se lea a través de la barra."""
    probs = []
    for w, h in ((375, 667), (360, 740)):
        page = C.new_page("phone")
        try:
            page.set_viewport_size({"width": w, "height": h})
            C.seed(page)
            C.goto(page, "#/", reload=True)
            page.wait_for_timeout(400)
            m = page.evaluate("({sh: document.documentElement.scrollHeight, ih: innerHeight, slots: document.querySelectorAll('.hm-slot').length})")
            if m["sh"] > m["ih"] + 2 or m["slots"] > 1:
                probs.append(f"{w}×{h}: Hoy {m}")
            probs += C.errors(page)
        finally:
            page.context.close()
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, "#/granja")
        page.wait_for_timeout(600)
        a = page.evaluate("document.documentElement.hasAttribute('data-fm-past')")
        page.evaluate("scrollTo(0, document.documentElement.scrollHeight)")
        page.wait_for_timeout(400)
        b = page.evaluate("document.documentElement.hasAttribute('data-fm-past')")
        fade = page.evaluate("getComputedStyle(document.querySelector('.topbar'), '::after').display")
        if a or not b or fade == "none":
            probs.append(f"granja: borde que funde arriba {a}, al bajar {b} ({fade})")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_accessory_full_width_with_chevron():
    """El accesorio «Seguir» ocupa el ancho de la barra de pestañas (520 px como mucho), justo encima, con su flecha."""
    probs = []
    for kind in ("phone", "desk"):
        page = C.new_page(kind)
        try:
            C.seed(page)
            C.goto(page, "#/mapa")
            r = page.evaluate("""() => { const a = document.getElementById('acc'); a.hidden = false; document.documentElement.setAttribute('data-acc', '');
              const x = a.getBoundingClientRect(), t = document.getElementById('tabbar').getBoundingClientRect();
              return {w: x.width, l: x.left, r: x.right, vw: innerWidth, chev: !!a.querySelector('.acc-go'), tl: t.left, tr: t.right, bar: document.documentElement.dataset.bar || '',
                gap: t.top - x.bottom}; }""")
            want = min(520, r["vw"] - 32)
            if abs(r["w"] - want) > 1 or abs((r["l"] + r["r"]) / 2 - r["vw"] / 2) > 1 or not r["chev"]:
                probs.append(f"{kind}: accesorio {r} (ancho esperado {want})")
            if kind == "phone" and not (4 <= r["gap"] <= 12):
                probs.append(f"phone: el accesorio no va justo encima de la barra (hueco {r['gap']})")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_export_unchanged_after_fixes():
    """Tras ver Hoy, Premios, Ajustes y la Puerta, la partida exportada es la de la línea base (sin claves nuevas)."""
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, "#/")
        C.goto(page, "#/progreso")
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
        C.settle(page, 300)
        page.locator("#aj-done").click()
        page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=3000)
        page.evaluate("() => { adultGate({}); }")
        page.wait_for_selector("#gate[open]", timeout=3000)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        C.goto(page, "")
        snap = C.export(page)
        base = C.load_baseline()
        errs = C.errors(page)
    finally:
        page.context.close()
    assert base is not None, "falta la línea base"
    diff = [d for d in C.diff_exports(base, snap) if not re.search(r"album:uniq:", d)]
    assert not diff, json.dumps(diff, ensure_ascii=False)[:2000]
    assert not errs, "\n".join(errs)
