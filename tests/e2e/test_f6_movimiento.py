"""F6a (SPEC §4 «View Transitions», §3 título grande; plan-doc «Microanimaciones» y «Gestos › Vibración»): el
movimiento de la navegación (js/navmotion.js), las hojas que nacen de su botón (M.sheet / M.popIn de js/motion.js) y la
vibración de los momentos buenos.

· Entrar y volver DENTRO de una pestaña pasa por document.startViewTransition (la nueva entra desde la derecha; al
  volver, al revés); el modo foco (lección, partida) sube como una hoja y baja al salir; cambiar de pestaña, cambiar de
  segmento y el gesto atrás del sistema (hasUAVisualTransition) no animan. Nada se pinta dos veces ni queda a medias.
· Con «Reducir movimiento» ninguna animación ni transición pasa de 160 ms (getAnimations() durante la vuelta y las
  duraciones CSS de las rutas principales).
· En la raíz de Aprender, Jugar y Premios el título grande se encoge al bajar en una línea de 17 px en la barra (con su
  fondo de vidrio) y vuelve al subir, sin mover nada; la granja no tiene título y Hoy no tiene scroll.
· La hoja de Ajustes nace del engranaje y vuelve a él; el menú de idioma nace de la bandera; la pausa (Esc) de la ✕;
  una hoja a pantalla completa sube como siempre.
· navigator.vibrate: al acertar y al mantener pulsado lo que abre un menú; nunca en un toque normal.
· La partida exportada es la de la base."""
from __future__ import annotations

import math

import common as C
import routes as R

_ROUTE_N = "window.__vocabRouteN || 0"
CAPS = C.CAPTURAS / "F6"

# espías antes de que arranque la app: cada startViewTransition (con el movimiento pedido) y cada vibración
_SPY = r"""
(() => {
  window.__vt = []; window.__vib = [];
  const o = Document.prototype.startViewTransition;
  if (o) Document.prototype.startViewTransition = function (cb) {
    window.__vt.push({k: document.documentElement.dataset.vt || '', h: location.hash});
    return o.call(this, cb);
  };
  try { Object.defineProperty(Navigator.prototype, 'vibrate', {configurable: true, writable: true,
    value: function (p) { window.__vib.push(p); return true; }}); } catch (e) {}
  /* el gesto atrás del sistema: con window.__ua, el popstate dice que el navegador ya pinta su animación */
  addEventListener('popstate', e => { if (window.__ua) try { Object.defineProperty(e, 'hasUAVisualTransition', {value: true}); } catch (_) {} }, true);
})();
"""

# lo que dura cada animación que esté en marcha (también las de ::view-transition), muestreado en cada fotograma
_SAMPLER = r"""
(() => {
  window.__long = []; const seen = new Set();
  const tick = () => {
    try {
      for (const a of document.getAnimations()) {
        const t = a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming(); if (!t) continue;
        const it = t.iterations === Infinity ? 1e3 : (+t.iterations || 1);
        const d = (t.duration === Infinity ? 1e9 : (+t.duration || 0)) * it + Math.max(0, +t.delay || 0);
        if (d <= 160) continue;
        const tg = a.effect.target, pe = a.effect.pseudoElement || '';
        const key = [a.constructor.name, a.animationName || a.transitionProperty || '', tg ? (tg.id || String(tg.className || '') || tg.tagName) : '', pe, Math.round(d)].join('|');
        if (!seen.has(key)) { seen.add(key); window.__long.push(key + ' @' + location.hash); }
      }
    } catch (e) {}
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
"""

# duraciones CSS de animaciones y transiciones de todo lo que hay en la página (y sus ::before/::after)
_CSS_DUR = r"""() => {
  const ms = v => v.split(',').map(x => { x = x.trim(); return x.endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000; });
  const out = [];
  const look = (el, pe) => {
    const cs = getComputedStyle(el, pe);
    if (pe && cs.content === 'none') return;
    if (cs.animationName !== 'none') {
      const d = ms(cs.animationDuration), dl = ms(cs.animationDelay), n = cs.animationIterationCount.split(',').map(x => x.trim() === 'infinite' ? 1e3 : +x);
      d.forEach((v, i) => { const tot = v * (n[i % n.length] || 1) + Math.max(0, dl[i % dl.length] || 0); if (tot > 160) out.push(`anim ${el.id || el.className}${pe || ''}: ${cs.animationName} ${tot}ms`); });
    }
    if (cs.transitionProperty !== 'none') {
      const d = ms(cs.transitionDuration), dl = ms(cs.transitionDelay);
      d.forEach((v, i) => { const tot = v + Math.max(0, dl[i % dl.length] || 0); if (tot > 160) out.push(`trans ${el.id || String(el.className).slice(0, 40)}${pe || ''}: ${cs.transitionProperty} ${tot}ms`); });
    }
  };
  for (const el of document.querySelectorAll('body *')) { look(el, null); look(el, '::before'); look(el, '::after'); }
  return [...new Set(out)].slice(0, 20);
}"""

# lo que tiene que estar bien después de cada paso: sin transición a medias ni nada repetido
_CLEAN = r"""() => {
  const ids = {}; document.querySelectorAll('[id]').forEach(e => { ids[e.id] = (ids[e.id] || 0) + 1; });
  return {vt: document.documentElement.dataset.vt || '', apps: document.querySelectorAll('#app').length,
    dup: Object.keys(ids).filter(k => ids[k] > 1), dv: document.querySelectorAll('#app .dv').length,
    focus: document.documentElement.dataset.focus || '', hash: location.hash};
}"""


def _page(**kw):
    page = C.new_page("phone", **kw)
    page.context.add_init_script(_SPY)
    return page


def _route(page, act, timeout=8000):
    """Hace act() (un toque, un history.back()…) y espera a que la ruta nueva esté pintada y la transición acabada."""
    n0 = page.evaluate(_ROUTE_N)
    act()
    page.wait_for_function(f"n => ({_ROUTE_N}) > n", arg=n0, timeout=timeout)
    C.settle(page, 200)


def _vt(page):
    return page.evaluate("window.__vt.map(x => x.k)")


def _center(r):
    return (r["x"] + r["width"] / 2, r["y"] + r["height"] / 2)


# ---------------------------------------------------------------- View Transitions dentro de una pestaña
def test_entrar_y_volver_dentro_de_una_pestana_se_desliza():
    """Palabras › tema y atrás, Álbum › página y atrás: una transición cada vez (fwd y back); el camino › lección y la
    ✕: sube y baja (up/down); Juegos › partida y «Salir» de la pausa: sube y baja. Después de cada una no queda
    html[data-vt], hay un solo #app, ningún id repetido y la pantalla de antes ya no está."""
    page = _page()
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/palabras")
        if _vt(page):
            probs.append(f"la primera pantalla ya animó: {_vt(page)}")

        def step(name, act, want, check=None):
            k0 = len(_vt(page))
            _route(page, act)
            got = _vt(page)[k0:]
            if got != want:
                probs.append(f"{name}: transiciones {got} (se esperaba {want})")
            st = page.evaluate(_CLEAN)
            if st["vt"] or st["apps"] != 1 or st["dup"]:
                probs.append(f"{name}: queda algo a medias o repetido {st}")
            if check:
                msg = check(st)
                if msg:
                    probs.append(f"{name}: {msg} {st}")

        step("Palabras › tema", lambda: page.locator("#app a[href^='#/doc/']").first.click(), ["fwd"],
             lambda st: None if st["dv"] == 1 and st["hash"].startswith("#/doc/") else "no se ve el tema")
        page.wait_for_timeout(150)
        C.shot(page, "F6a-tema-tras-entrar", CAPS, full_page=False)
        step("tema › Palabras («‹ Palabras»)", lambda: page.locator("#dv-back").click(), ["back"],
             lambda st: None if st["dv"] == 0 and st["hash"] == "#/palabras" else "el tema sigue o no vuelve a Palabras")
        step("Palabras → pestaña Jugar", lambda: page.locator("#tab-jugar").click(), [])
        step("Juegos → segmento Álbum", lambda: page.locator("#tabhead .seg a[href='#/album']").click(), [])
        step("Álbum › página", lambda: page.locator("#app a[href^='#/album/']").first.click(), ["fwd"])
        step("página › Álbum", lambda: page.locator("#dv-back").click(), ["back"],
             lambda st: None if st["hash"] == "#/album" else "no vuelve al álbum")
        step("Álbum → pestaña Aprender", lambda: page.locator("#tab-aprender").click(), [])
        C.goto(page, f"#/mapa/{R.LEVEL}")
        step("camino › lección", lambda: page.evaluate(f"location.hash = '#/leccion/{R.LESSON}'"), ["up"],
             lambda st: None if st["focus"] == "leccion" else "no entra en el modo foco")
        step("lección › ✕", lambda: page.locator("#fx-x").click(), ["down"],
             lambda st: None if not st["focus"] and st["hash"].startswith("#/mapa") else "no sale del modo foco al camino")
        step("Aprender → pestaña Jugar", lambda: page.locator("#tab-jugar").click(), [])
        if page.evaluate("location.hash") != "#/juegos":
            step("Álbum → segmento Juegos", lambda: page.locator("#tabhead .seg a[href='#/juegos']").click(), [])
        step("Juegos › Memoria", lambda: page.locator("#app a.gm-card[data-g='memoria']").click(), ["up"],
             lambda st: None if st["focus"] == "juego" else "la partida no está en modo foco")
        page.locator("#fx-x").click()
        page.wait_for_selector("dialog#gm-pause[open]", timeout=4000)
        page.wait_for_timeout(400)
        step("pausa › Salir", lambda: page.locator("#gm-pz-out").click(), ["down"],
             lambda st: None if not st["focus"] and st["hash"] == "#/juegos" else "no vuelve a los juegos")
        if page.evaluate("!!document.querySelector('dialog[open]')"):
            probs.append("queda una hoja abierta tras salir de la partida")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_cambiar_de_pestana_no_anima():
    """Tocar las cinco pestañas no pasa por startViewTransition (la pestaña cambia al momento); tocar la pestaña activa
    desde una pantalla de dentro vuelve a su raíz deslizándose hacia atrás, como en iOS."""
    page = _page()
    probs = []
    try:
        C.seed(page)
        for t in ("aprender", "jugar", "granja", "premios", "hoy", "aprender"):
            _route(page, lambda: page.locator(f"#tab-{t}").click())
        if _vt(page):
            probs.append(f"cambiar de pestaña animó: {_vt(page)}")
        C.goto(page, "#/palabras")
        k0 = len(_vt(page))
        _route(page, lambda: page.locator("#app a[href^='#/doc/']").first.click())
        _route(page, lambda: page.locator("#tab-aprender").click())
        if _vt(page)[k0:] != ["fwd", "back"] or page.evaluate("location.hash") != "#/palabras":
            probs.append(f"la pestaña activa desde el tema: {_vt(page)[k0:]} → {page.evaluate('location.hash')}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_gesto_atras_del_sistema_no_anima_dos_veces():
    """Atrás con el gesto del sistema (popstate con hasUAVisualTransition, el navegador ya pinta su animación): sin
    View Transition. El botón Atrás normal sí se desliza hacia atrás."""
    page = _page()
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/palabras")
        k0 = len(_vt(page))
        _route(page, lambda: page.locator("#app a[href^='#/doc/']").first.click())
        page.evaluate("window.__ua = true")
        _route(page, lambda: page.evaluate("history.back()"))
        page.evaluate("window.__ua = false")
        got = _vt(page)[k0:]
        if got != ["fwd"] or page.evaluate("location.hash") != "#/palabras":
            probs.append(f"con el gesto del sistema: {got} → {page.evaluate('location.hash')}")
        if page.evaluate("document.documentElement.dataset.vt || ''"):
            probs.append("queda html[data-vt] tras el gesto")
        _route(page, lambda: page.locator("#app a[href^='#/doc/']").first.click())
        _route(page, lambda: page.evaluate("history.back()"))
        got = _vt(page)[k0:]
        if got != ["fwd", "fwd", "back"]:
            probs.append(f"Atrás normal: {got}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Reducir movimiento
def test_reducir_movimiento_nada_pasa_de_160_ms():
    """Con «Reducir movimiento»: las transiciones entre pantallas son un fundido (data-vt=fade) y ninguna animación en
    marcha (getAnimations(), también las de ::view-transition, las hojas y el menú) dura más de 160 ms; en las rutas
    principales ninguna animación ni transición CSS pasa de 160 ms."""
    page = _page(reduced_motion="reduce")
    page.context.add_init_script(_SAMPLER)
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/palabras")
        _route(page, lambda: page.locator("#app a[href^='#/doc/']").first.click())
        _route(page, lambda: page.locator("#dv-back").click())
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
        page.wait_for_timeout(300)
        page.locator("#aj-done").click()
        page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=4000)
        page.locator("#lang-b").click()
        page.wait_for_selector("#lang-m:not([hidden])", timeout=3000)
        page.wait_for_timeout(250)
        page.keyboard.press("Escape")
        page.wait_for_timeout(250)
        C.goto(page, f"#/mapa/{R.LEVEL}")
        _route(page, lambda: page.evaluate(f"location.hash = '#/leccion/{R.LESSON}'"))
        _route(page, lambda: page.locator("#fx-x").click())
        kinds = _vt(page)
        if not kinds or any(k != "fade" for k in kinds):
            probs.append(f"con Reducir movimiento las transiciones no son un fundido: {kinds}")
        for h in ("", "#/mapa", "#/palabras", "#/juegos", "#/album", "#/granja", "#/progreso", "#/mizorro"):
            C.goto(page, h)
            page.wait_for_timeout(300)
            css = page.evaluate(_CSS_DUR)
            if css:
                probs.append(f"{h or '#/'}: CSS de más de 160 ms: {css}")
        long = page.evaluate("window.__long")
        if long:
            probs.append(f"animaciones de más de 160 ms: {long[:12]}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- título grande
_TT = r"""() => { const t = document.getElementById('tb-title'), h1 = document.querySelector('#tabhead:not([hidden]) .th-t');
  const r = t && t.getBoundingClientRect(), tb = document.getElementById('topbar');
  const pill = document.querySelector('[data-coins-pill]').getBoundingClientRect(), fl = document.getElementById('lang-b').getBoundingClientRect();
  const hit = document.elementFromPoint(pill.left + pill.width / 2, pill.top + pill.height / 2);
  return {y: Math.round(scrollY), tcol: document.documentElement.hasAttribute('data-tcol'), txt: t ? t.textContent : null, h1: h1 ? h1.textContent : null,
    op: t ? +getComputedStyle(t).opacity : null, fs: t ? getComputedStyle(t).fontSize : null, rect: r ? [r.left, r.top, r.right, r.bottom] : null,
    band: +getComputedStyle(tb, '::before').opacity, pill: [pill.left, pill.top, pill.right, pill.bottom], flag: [fl.left, fl.top, fl.right, fl.bottom],
    pillHit: !!(hit && hit.closest('[data-coins-pill]')), h1Top: h1 ? Math.round(h1.getBoundingClientRect().top + scrollY) : null,
    appTop: Math.round(document.getElementById('app').getBoundingClientRect().top + scrollY), sh: document.documentElement.scrollHeight, ih: innerHeight}; }"""


def test_titulo_grande_se_encoge_al_bajar():
    """Aprender (Palabras), Jugar y Premios: al bajar, html[data-tcol], el título de 17 px en la barra (el mismo texto
    que el <h1>, sin tapar la bandera ni las monedas, que se siguen pudiendo tocar) y el fondo de vidrio; al subir, todo
    vuelve. Nada se mueve de sitio. La granja no tiene título que encoger y Hoy no tiene scroll."""
    probs = []
    for scheme in ("light", "dark"):
        page = _page(color_scheme=scheme)
        try:
            C.seed(page)
            for h in ("#/palabras", "#/juegos", "#/progreso"):
                C.goto(page, h)
                a = page.evaluate(_TT)
                if a["tcol"] or a["op"]:
                    probs.append(f"{scheme} {h}: arriba del todo ya está encogido {a}")
                page.mouse.wheel(0, 420)
                page.wait_for_timeout(450)
                b = page.evaluate(_TT)
                if not (b["y"] > 0 and b["tcol"] and b["op"] == 1 and b["band"] == 1 and b["fs"] == "17px" and b["txt"] == b["h1"]):
                    probs.append(f"{scheme} {h}: al bajar no se encoge bien {b}")
                elif b["rect"][0] < b["flag"][2] or b["rect"][2] > b["pill"][0] or b["rect"][3] > b["pill"][3] + 8:
                    probs.append(f"{scheme} {h}: el título pisa la bandera o las monedas {b}")
                if not b["pillHit"]:
                    probs.append(f"{scheme} {h}: con el título encogido las monedas no se pueden tocar")
                if b["h1Top"] != a["h1Top"] or b["appTop"] != a["appTop"]:
                    probs.append(f"{scheme} {h}: algo se movió de sitio al encogerse ({a['h1Top']}/{a['appTop']} → {b['h1Top']}/{b['appTop']})")
                if scheme == "light" and h == "#/palabras":
                    C.shot(page, "F6a-titulo-encogido", CAPS, full_page=False)
                if scheme == "dark" and h == "#/juegos":
                    C.shot(page, "F6a-titulo-encogido-oscuro", CAPS, full_page=False)
                page.mouse.wheel(0, -5000)
                page.wait_for_timeout(450)
                c = page.evaluate(_TT)
                if c["y"] != 0 or c["tcol"] or c["op"] != 0 or c["band"] != 0:
                    probs.append(f"{scheme} {h}: al subir no vuelve {c}")
            C.goto(page, "#/granja")
            page.mouse.wheel(0, 420)
            page.wait_for_timeout(400)
            g = page.evaluate(_TT)
            if g["h1"] is not None or g["tcol"]:
                probs.append(f"{scheme} granja: {g}")
            C.goto(page, "")
            page.mouse.wheel(0, 420)
            page.wait_for_timeout(400)
            o = page.evaluate(_TT)
            if o["sh"] > o["ih"] + 1 or o["y"] or o["tcol"]:
                probs.append(f"{scheme} Hoy: tiene scroll o se encoge {o}")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- hojas que nacen de su botón
_FIRST = r"""sel => { window.__fr = null; window.__last = null; let seen = false;
  const t0 = performance.now();
  const poll = () => { const d = document.querySelector(sel);
    const open = d && (d.tagName === 'DIALOG' ? d.open : !d.hidden || getComputedStyle(d).display !== 'none');
    if (open && d.getClientRects().length) { const r = d.getBoundingClientRect(); const v = {x: r.x, y: r.y, width: r.width, height: r.height};
      if (!seen) { seen = true; window.__fr = v; } window.__last = v; }
    if (performance.now() - t0 < 3000) requestAnimationFrame(poll); };
  requestAnimationFrame(poll); }"""


def test_las_hojas_nacen_de_su_boton():
    """Ajustes: en el primer fotograma la hoja es pequeña y está sobre el engranaje; al cerrarla con «Listo» termina
    otra vez en él. El menú de idioma nace de la bandera ([hidden] cambia al momento al cerrarlo). La pausa con Esc
    nace de la ✕. Una hoja a pantalla completa (data-detent=large) sube desde abajo con su ancho de siempre."""
    page = _page()
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/palabras")
        gear = page.locator(".topbar [data-open=ajustes]").bounding_box()
        gx, gy = _center(gear)
        page.evaluate(_FIRST, "dialog#ajustes")
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
        page.wait_for_timeout(900)
        fr, fin = page.evaluate("[window.__fr, window.__last]")
        if not fr or not fin:
            probs.append(f"Ajustes no se vio abrirse: {fr} {fin}")
        else:
            fx, fy = _center(fr)
            if math.hypot(fx - gx, fy - gy) > 100 or fr["width"] > fin["width"] * .5:
                probs.append(f"Ajustes no nace del engranaje: primer fotograma {fr} (engranaje {gear}, al final {fin})")
            C.shot(page, "F6a-ajustes-abierto", CAPS, full_page=False)
        page.evaluate(_FIRST, "dialog#ajustes")
        page.locator("#aj-done").click()
        page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=4000)
        last = page.evaluate("window.__last")
        if last:
            lx, ly = _center(last)
            if math.hypot(lx - gx, ly - gy) > 140 or last["width"] > 250:
                probs.append(f"Ajustes no vuelve al engranaje: último fotograma {last}")
        # el menú de idioma
        flag = page.locator("#lang-b").bounding_box()
        page.evaluate(_FIRST, "#lang-m")
        page.locator("#lang-b").click()
        page.wait_for_selector("#lang-m:not([hidden])", timeout=3000)
        page.wait_for_timeout(700)
        fr, fin = page.evaluate("[window.__fr, window.__last]")
        if not fr or fr["width"] > fin["width"] * .6:
            probs.append(f"el menú de idioma no crece: {fr} → {fin}")
        else:
            near = fr["x"] <= flag["x"] + flag["width"] + 40 and fr["y"] <= flag["y"] + flag["height"] + 40
            if not near:
                probs.append(f"el menú de idioma no nace de la bandera: {fr} (bandera {flag})")
        page.keyboard.press("Escape")
        mid = page.evaluate("() => { const m = document.getElementById('lang-m'); return {hidden: m.hidden, inert: m.inert, shown: getComputedStyle(m).display !== 'none'}; }")
        if not mid["hidden"]:
            probs.append(f"al cerrar el menú [hidden] no cambia al momento: {mid}")
        if mid["shown"] and not mid["inert"]:
            probs.append(f"el menú que sale se puede tocar: {mid}")
        page.wait_for_timeout(450)
        end = page.evaluate("() => { const m = document.getElementById('lang-m'); return {hidden: m.hidden, shown: getComputedStyle(m).display !== 'none', inert: m.inert, style: m.style.display}; }")
        if end != {"hidden": True, "shown": False, "inert": False, "style": ""}:
            probs.append(f"el menú no termina de cerrarse: {end}")
        # una hoja a pantalla completa: sube como siempre
        fr = page.evaluate("""async () => { const d = document.createElement('dialog'); d.id = 'f6-big'; d.dataset.detent = 'large';
          d.style.height = 'calc(100dvh - 24px)'; d.innerHTML = '<p>Hoja grande</p>'; document.body.appendChild(d);
          const g = document.querySelector('.topbar [data-open=ajustes]');
          M.sheet(d, g); await new Promise(r => requestAnimationFrame(r)); const r = d.getBoundingClientRect();
          await new Promise(r => setTimeout(r, 700)); const f = d.getBoundingClientRect();
          await M.closeSheet(d); d.remove();
          return {first: [r.x, r.y, r.width], fin: [f.x, f.y, f.width]}; }""")
        if abs(fr["first"][2] - fr["fin"][2]) > 2 or fr["first"][1] <= fr["fin"][1] + 20:
            probs.append(f"la hoja a pantalla completa no sube desde abajo: {fr}")
        # la pausa con Esc nace de la ✕
        C.goto(page, "#/juegos")
        _route(page, lambda: page.locator("#app a.gm-card[data-g='memoria']").click())
        go = page.locator(".gm-go")
        if go.count():
            go.first.click(force=True)
            page.wait_for_timeout(300)
        x = page.locator("#fx-x").bounding_box()
        page.evaluate(_FIRST, "dialog#gm-pause")
        page.keyboard.press("Escape")
        page.wait_for_selector("dialog#gm-pause[open]", timeout=4000)
        page.wait_for_timeout(700)
        fr = page.evaluate("window.__fr")
        if not fr or math.hypot(_center(fr)[0] - _center(x)[0], _center(fr)[1] - _center(x)[1]) > 100:
            probs.append(f"la pausa con Esc no nace de la ✕: {fr} (✕ {x})")
        page.locator("#gm-pz-go").click()
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- vibración
def test_vibra_al_acertar_y_al_mantener_pulsado_no_al_tocar():
    """navigator.vibrate: nada al tocar pestañas, segmentos, filas ni la bandera; [14, 60, 22] al acertar en la
    lección; 10 al mantener pulsada una tarjeta de juego (abre su vistazo)."""
    page = _page()
    probs = []
    try:
        C.seed(page)
        _route(page, lambda: page.locator("#tab-aprender").click())
        _route(page, lambda: page.locator("#tabhead .seg a[href='#/palabras']").click())
        _route(page, lambda: page.locator("#app a[href^='#/doc/']").first.click())
        _route(page, lambda: page.locator("#dv-back").click())
        page.locator("#lang-b").click()
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        v = page.evaluate("window.__vib")
        if v:
            probs.append(f"vibra en toques normales: {v}")
        # mantener pulsada una tarjeta de juego
        C.goto(page, "#/juegos")
        box = page.locator("#app a.gm-card[data-g='memoria']").bounding_box()
        page.mouse.move(*_center(box))
        page.mouse.down()
        page.wait_for_timeout(800)
        page.mouse.up()
        page.wait_for_selector("dialog#gm-peek[open]", timeout=3000)
        v = page.evaluate("window.__vib")
        if v != [10]:
            probs.append(f"al mantener pulsada la tarjeta: {v} (se esperaba [10])")
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.querySelector('dialog#gm-peek[open]')", timeout=3000)
        page.evaluate("window.__vib.length = 0")
        # acierto en la lección
        C.goto(page, f"#/mapa/{R.LEVEL}")
        _route(page, lambda: page.evaluate(f"location.hash = '#/leccion/{R.LESSON}'"))
        st = "() => { const s = vocabLesson.state, x = s && s.steps[s.i]; return x ? {i: s.i, t: x.t, right: x.right != null ? x.right : null} : null; }"
        for _ in range(20):
            s = page.evaluate(st)
            if s and s["t"] != "learn":
                break
            page.locator("#ls-go").click()
            page.wait_for_function("i0 => vocabLesson.state.i !== i0", arg=s["i"], timeout=5000)
            page.wait_for_timeout(300)
        if page.evaluate("window.__vib"):
            probs.append(f"vibra al pasar las palabras nuevas: {page.evaluate('window.__vib')}")
        s = page.evaluate(st)
        opts = page.evaluate("() => [...document.querySelectorAll('.ls-stage > .ls-page:not(.ls-ghost) .ls-opt .ls-ot')].map(e => e.textContent)")
        page.locator(".ls-stage > .ls-page:not(.ls-ghost) .ls-opt").nth(opts.index(s["right"])).click()
        page.wait_for_timeout(300)
        v = page.evaluate("window.__vib")
        if [14, 60, 22] not in v:
            probs.append(f"no vibra al acertar: {v}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la partida, igual
def test_la_partida_exportada_es_la_de_la_base():
    """Una vuelta con transiciones (tema y atrás, camino › lección › ✕, la pestaña activa desde dentro) no cambia nada
    de lo que se guarda: la exportación es la de tests/e2e/baseline/export.json. (El álbum no entra: abrirlo apunta el
    total de pegatinas de los temas ya cargados en album:uniq, con o sin transiciones.)"""
    page = _page()
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/palabras")
        _route(page, lambda: page.locator("#app a[href^='#/doc/']").first.click())
        _route(page, lambda: page.locator("#dv-back").click())
        C.goto(page, f"#/mapa/{R.LEVEL}")
        _route(page, lambda: page.evaluate(f"location.hash = '#/leccion/{R.LESSON}'"))
        _route(page, lambda: page.locator("#fx-x").click())
        C.goto(page, "#/palabras")
        _route(page, lambda: page.locator("#app a[href^='#/doc/']").first.click())
        _route(page, lambda: page.locator("#tab-aprender").click())
        C.goto(page, "")
        page.wait_for_timeout(400)
        d = C.diff_exports(C.load_baseline(), C.export(page), allow_new=False)
        if d:
            probs.append(f"la partida cambia: {d}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- capturas a mitad de movimiento
def test_capturas_a_mitad_del_movimiento():
    """Capturas (capturas/F6/F6a-*) de fotogramas a mitad: entrar en un tema, la lección que sube, Ajustes creciendo
    desde el engranaje y el menú de idioma desde la bandera. Sin errores."""
    page = _page()
    probs = []
    try:
        C.seed(page)
        CAPS.mkdir(parents=True, exist_ok=True)

        def mid(act, wait_js, ms, name):
            act()
            page.wait_for_function(wait_js, timeout=5000)
            page.wait_for_timeout(ms)
            page.screenshot(path=str(CAPS / f"{name}.png"))
            C.settle(page, 200)
            page.wait_for_timeout(600)

        C.goto(page, "#/palabras")
        mid(lambda: page.locator("#app a[href^='#/doc/']").first.click(), "() => document.documentElement.dataset.vt === 'fwd'", 140, "F6a-entrar-a-mitad")
        mid(lambda: page.locator("#dv-back").click(), "() => document.documentElement.dataset.vt === 'back'", 140, "F6a-volver-a-mitad")
        C.goto(page, f"#/mapa/{R.LEVEL}")
        mid(lambda: page.evaluate(f"location.hash = '#/leccion/{R.LESSON}'"), "() => document.documentElement.dataset.vt === 'up'", 150, "F6a-leccion-sube")
        mid(lambda: page.locator("#fx-x").click(), "() => document.documentElement.dataset.vt === 'down'", 140, "F6a-leccion-baja")
        mid(lambda: page.locator(".topbar [data-open=ajustes]").click(), "() => document.getElementById('ajustes') && document.getElementById('ajustes').open", 90, "F6a-ajustes-crece")
        page.locator("#aj-done").click()
        page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=4000)
        page.wait_for_timeout(300)
        mid(lambda: page.locator("#lang-b").click(), "() => !document.getElementById('lang-m').hidden", 70, "F6a-idioma-crece")
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
