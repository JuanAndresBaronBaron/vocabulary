"""Sin conexión, la copia de Google sin pérdidas y un arranque rápido (sw.js, js/sync.js, js/save.js y el arranque de
index.html).

- SHELL y OFF_APP: los 7 dibujos que faltaban (5 de Juegos, el zorro y el loro), sin «./» (la carpeta es su index.html)
  y sin lo que solo usan algunos (LAZY: los fondos de Pajarito volador, Tech Prep e IELTS Prep), que se guarda al usarlo.
- La gramática que no llega (sin red) no se guarda como vacía: el camino y #/gramatica dicen «Sin conexión» con
  «Reintentar» (nunca «Pronto habrá gramática») y vuelven solos al volver la conexión.
- La primera visita y luego sin conexión: el service worker se registra después de load y, ya activo, la app guarda de
  antemano (vocabOffline) los personajes, la gramática y el mapa de audios, y los temas y dibujos de las lecciones
  siguientes, del tema de Juegos y del repaso. Sin red (el servidor «caído» y el contexto offline): el camino con su
  gramática, la lección, Memoria con dibujos guardados, Pajarito sin su fondo y, para lo que no se guardó, la página
  «Sin conexión» con «Reintentar», que se vuelve a pintar sola al volver la red.
- sw.js: js con ?v=VERSION sale del shell sin esperar a la red; la página y los datos esperan a la red 3 s como mucho;
  nunca se da una copia de otra versión por su nombre; lo de LAZY ya usado pasa a la versión nueva.
- «Reducir movimiento» (calmCss) solo recorre las hojas con data-motion=calm, al encenderlo y mientras siga.
- Un guardado que no cabe sale en Para mayores con «Libera espacio» y «Descargar copia».
- Google Drive de mentira (FakeDrive, compartido por dos aparatos): una partida de una versión más nueva de la app nunca
  se baja ni se pisa (aviso «Hay una versión nueva de la app. Recarga para seguir.»), una dañada sí se reemplaza; dos
  aparatos que jugaron a la vez se juntan sin perder lecciones, repaso, actividad, récords, cuentos ni sellos (gana la
  de más progreso en monedas y granja, y la otra queda para deshacer); se sube al momento al acabar una lección, un
  repaso o una partida, y una partida de más de 60 KB se sube antes (keepalive no la llevaría al cerrar).
Capturas en capturas/offline."""
from __future__ import annotations

import json
import re
import threading
import time
from urllib.parse import parse_qs, urlsplit

import common as C

SHOTS = C.CAPTURAS / "offline"
NOW_MS = int(C.FIXED_NOW.timestamp() * 1000)
MIN = 60_000
NEW_FILES = ["img/games/memoria.png", "img/games/lluvia.png", "img/games/globos.png", "img/games/letras.png",
             "img/games/lince.png", "img/pj/zorro.png", "img/pj/loro.png"]
LAZY = ["img/games/vuelo-en.jpg", "img/games/vuelo-fr.jpg", "img/games/vuelo-da.jpg", "js/tech.js", "js/tech-lesson.js",
        "js/tech-pages.js", "ielts.html", "ielts.css", "js/ielts.js", "js/ielts-viz.js", "js/ielts-player.js",
        "data/ielts/index.json"]
NEWER = "Hay una versión nueva de la app. Recarga para seguir."


def _list(src, name):
    return re.findall(r'"([^"]+)"', re.search(rf"const {name} = \[(.*?)\];", src, re.S).group(1))


def _sw_src():
    return (C.ROOT / "sw.js").read_text(encoding="utf-8")


def _version():
    return int(re.search(r"const VERSION = (\d+);", _sw_src()).group(1))


def _real_errors(page, allow=()):
    """errores de la página salvo los esperados sin red (ficheros que no se guardaron) y los de allow (regex)"""
    out = []
    for e in C.errors(page):
        if any(re.search(a, e) for a in allow):
            continue
        out.append(e)
    return out


# =============================================================== SHELL, OFF_APP y LAZY
def test_shell_lists_and_lazy():
    """SHELL (sw.js) = OFF_APP (index.html), con los 7 dibujos que faltaban, sin «./» y sin LAZY; LAZY existe, está
    escrito en sw.js (js/tech-boot.js lo busca ahí) y los fondos de Pajarito van en «Descargar todo» (OFF_LATER_IMG)."""
    sw, html = _sw_src(), (C.ROOT / "index.html").read_text(encoding="utf-8")
    shell, off, lazy = _list(sw, "SHELL"), _list(html, "OFF_APP"), _list(sw, "LAZY")
    probs = []
    if sorted(shell) != sorted(off):
        probs.append(f"SHELL y OFF_APP no son la misma lista: {sorted(set(shell) ^ set(off))}")
    for f in NEW_FILES:
        if f not in shell:
            probs.append(f"falta {f} en SHELL")
    if "./" in shell or "index.html" not in shell:
        probs.append("SHELL debe llevar index.html y no «./»")
    if sorted(lazy) != sorted(LAZY):
        probs.append(f"LAZY de sw.js: {lazy}")
    for f in LAZY:
        if f in shell:
            probs.append(f"{f} está en SHELL (se guarda al usarlo)")
        if not (C.ROOT / f).is_file():
            probs.append(f"{f} no existe")
        if f'"{f}"' not in sw:
            probs.append(f"{f} no está escrito en sw.js")
    later = _list(html, "OFF_LATER_IMG")
    if sorted(later) != sorted(f for f in LAZY if f.startswith("img/")):
        probs.append(f"OFF_LATER_IMG: {later}")
    for f in shell:
        if not (C.ROOT / f).is_file():
            probs.append(f"{f} (SHELL) no existe")
    assert not probs, "\n".join(probs)


# =============================================================== la gramática sin red
def _map_count(page):
    m = re.search(r"(\d+) de (\d+)", page.inner_text("#app"))
    return (int(m.group(1)), int(m.group(2))) if m else None


def test_grammar_failure_is_not_stored():
    """Sin la gramática (la petición falla), el camino sale sin sus lecciones de gramática y #/gramatica dice «Sin
    conexión. Vuelve a intentarlo cuando haya internet.» con «Reintentar» (nunca «Pronto habrá gramática»). El fallo no
    se guarda: «Reintentar» la trae y el camino vuelve a contarlas; y al volver la conexión (evento online) el camino a
    la vista se repinta solo con ellas."""
    probs = []
    st = {"block": True}

    def gram(route):
        return route.abort() if st["block"] else route.fallback()

    page = C.new_page("phone")
    try:
        page.route("**/data/grammar_*.json", gram)
        C.seed(page, hash="#/mapa")
        off = _map_count(page)
        C.goto(page, "#/gramatica/A1")
        txt = page.inner_text("#app")
        if "Sin conexión. Vuelve a intentarlo cuando haya internet." not in txt or page.locator("#gr-retry").count() != 1:
            probs.append(f"#/gramatica sin red no dice «Sin conexión» con «Reintentar»: {txt[:200]!r}")
        if "Pronto habrá" in txt:
            probs.append("#/gramatica sin red dice «Pronto habrá gramática»")
        C.shot(page, "gramatica-sin-red-390", SHOTS, full_page=False)
        page.set_viewport_size({"width": 360, "height": 740})
        C.shot(page, "gramatica-sin-red-360", SHOTS, full_page=False)
        page.set_viewport_size({"width": 390, "height": 844})
        st["block"] = False
        page.click("#gr-retry")
        page.wait_for_selector(".gr-u", timeout=6000)
        C.goto(page, "#/mapa")
        on = _map_count(page)
        if not off or not on or on[1] <= off[1] or on[0] <= off[0]:
            probs.append(f"el camino no cuenta la gramática al volver: sin red {off}, con red {on}")
        if page.evaluate("gramOff()"):
            probs.append("gramOff() sigue en true con la gramática ya cargada")
    finally:
        page.context.close()

    # al volver la conexión, el camino a la vista se repinta solo
    st["block"] = True
    page = C.new_page("phone")
    try:
        page.route("**/data/grammar_*.json", gram)
        C.seed(page, hash="#/mapa")
        off2 = _map_count(page)
        st["block"] = False
        n0 = page.evaluate("window.__vocabRouteN")
        page.evaluate("dispatchEvent(new Event('online'))")
        page.wait_for_function("n => window.__vocabRouteN > n", arg=n0, timeout=6000)
        C.settle(page)
        on2 = _map_count(page)
        if not off2 or not on2 or on2[1] <= off2[1]:
            probs.append(f"al volver la conexión el camino no se repinta con la gramática: {off2} → {on2}")
        probs += _real_errors(page, [r"grammar_\w+\.json"])
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# =============================================================== primera visita y luego sin conexión
class _Switch(C._Quiet):
    """El servidor de siempre con un interruptor: con ST["down"], corta la conexión sin contestar (como sin red, también
    para el service worker); con ST["slow"] = (regex, s), espera s segundos antes de contestar lo que case; con
    ST["bump"], sirve sw.js con VERSION + 1 e index.html con su ?v= y OFF_SHELL subidos (una versión nueva). Apunta las
    rutas pedidas en ST["log"]."""
    ST = {}

    def do_GET(self):
        st = self.ST
        st.setdefault("log", []).append(self.path)
        if st.get("down"):
            self.close_connection = True
            return
        slow = st.get("slow")
        if slow and re.search(slow[0], self.path):
            time.sleep(slow[1])
        p = self.path.split("?")[0]
        if st.get("bump") and p in ("/sw.js", "/", "/index.html"):
            v = _version()
            src = (C.ROOT / ("sw.js" if p == "/sw.js" else "index.html")).read_text(encoding="utf-8")
            if p == "/sw.js":
                src = src.replace(f"const VERSION = {v};", f"const VERSION = {v + 1};")
            else:
                src = src.replace(f"?v={v}\"", f"?v={v + 1}\"").replace(f'"vocab-shell-v{v}"', f'"vocab-shell-v{v + 1}"')
            body = src.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript; charset=utf-8" if p == "/sw.js" else "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def _switch_server():
    st = {"log": []}
    handler = type("H", (_Switch,), {"ST": st})
    return C.Server(C.ROOT, "localhost", handler=handler), st


_REG = """(() => { const sw = navigator.serviceWorker; if (!sw) return; const reg = sw.register.bind(sw);
  sw.register = (...a) => { (window.__reg = window.__reg || []).push(document.readyState); return reg(...a); }; })();"""
_MEDIA = "async () => (await (await caches.open('vocab-media')).keys()).map(r => decodeURIComponent(new URL(r.url).pathname))"
_BROKEN = """() => [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0)
  .map(i => i.getAttribute('src'))"""
# lo que sin red no se guardó a propósito (mp3 de las palabras: solo «Descargar todo»; el fondo de Pajarito: LAZY)
_OFF_OK = [r"Failed to load resource: net::ERR_FAILED @ \S+/audio/\w+/[\w-]+\.mp3", r"vuelo-\w+\.jpg"]


def _warm_done(page, timeout=60000):
    page.wait_for_function("() => vocabOffline.state.done !== '' && !vocabOffline.state.busy", timeout=timeout)
    return page.evaluate("vocabOffline.state")


def _wanted(page):
    """lo que la app debería haber guardado de antemano para la partida sembrada (calculado aquí, aparte)"""
    d = C.seed_data()
    rows = lambda i: json.loads((C.ROOT / "data" / f"{i}.json").read_text(encoding="utf-8"))["rows"]
    mp = json.loads((C.ROOT / "data" / "map.json").read_text(encoding="utf-8"))
    done = d["map:english"]
    nxt = [(ls, u["doc"]) for u in mp["A1"] for ls in u["ls"] if ls["id"] not in done][:2]
    imgs = set()
    for ls, d0 in nxt:
        for doc, i in ls["w"]:
            r = rows(doc)[i]
            if r.get("img"):
                imgs.add(r["img"])
    for r in rows(d["games:topic"]):
        if r.get("img") and (r.get("l") or {}).get("english"):
            imgs.add(r["img"])
    return [ls["id"] for ls, _ in nxt], imgs


def test_first_visit_then_offline():
    """Primera visita con red: el service worker se registra con la página ya cargada y, ya activo, la app guarda de
    antemano en vocab-media los personajes, la ropa del zorro, la gramática y el mapa de audios del inglés, los temas de
    las 2 lecciones siguientes y del repaso y los dibujos de esas lecciones y del tema de Juegos. Sin red (servidor caído
    y contexto offline) y recargando: el camino con su gramática («10 de 113», como con red), #/gramatica, la lección
    siguiente y Memoria sin dibujos rotos, Pajarito volador (sin su fondo, LAZY) y, en un tema nunca abierto, la página
    «Sin conexión» con «Reintentar» (nunca «No se pudo cargar»), que al volver la red pinta el tema sola."""
    srv, st = _switch_server()
    ctx = C.new_context("phone", sw=True, server=srv)
    ctx.add_init_script(_REG)
    page = ctx.new_page()
    probs = []
    try:
        C.seed(page)
        # el aviso de la voz (sin motor de voz en Chromium sin pantalla) ya se dio: no tapa las capturas
        page.evaluate("() => localStorage.setItem('vocab:tts', JSON.stringify({told: Date.now()}))")
        page.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=30000)
        reg = page.evaluate("window.__reg")
        if reg != ["complete"]:
            probs.append(f"el service worker se registra antes de load: {reg}")
        warm = _warm_done(page)
        if warm["last"]["skipped"]:
            probs.append(f"no guardó de antemano: {warm}")
        C.goto(page, "#/mapa")
        online_count = _map_count(page)
        media = set(page.evaluate(_MEDIA))
        sprites = json.loads((C.ROOT / "data" / "sprites.json").read_text(encoding="utf-8"))
        need = {f"/img/pj/{k}.png" for k in sprites if f"img/pj/{k}.png" not in NEW_FILES}
        need |= {"/data/grammar_en.json", "/audio/en.json", "/data/animales.json", "/data/colores.json", "/data/familia.json"}
        nxt, imgs = _wanted(page)
        need |= {"/" + u for u in imgs}
        miss = sorted(need - media)
        if miss:
            probs.append(f"no guardó de antemano ({len(miss)}): {miss[:8]}")
        shop = page.evaluate("vocabShop.images()")
        if any("/" + u not in media for u in shop):
            probs.append("no guardó la ropa del zorro (img/shop)")
        shell = set(page.evaluate(f"async () => (await (await caches.open('vocab-shell-v{_version()}')).keys()).map(r => new URL(r.url).pathname)"))
        if any("/" + f not in shell for f in NEW_FILES) or any("/" + f in shell for f in LAZY):
            probs.append("el shell no lleva los 7 dibujos nuevos o lleva lo de LAZY")
        if "/" in shell:
            probs.append("el shell guarda «./» además de index.html")

        # sin red
        st["down"] = True
        ctx.set_offline(True)
        C.clear_errors(page)
        C.reload(page)
        shown = {}
        for h in ["#/mapa", "#/gramatica/A1", f"#/leccion/{nxt[0]}", "#/juegos/memoria", "#/juegos/pajarito"]:
            C.clear_errors(page)
            shown[h] = C.goto(page, h, timeout=15000)
            page.wait_for_timeout(700)
            txt = page.inner_text("#app")
            if page.locator("[data-route-fail]").count() or "No se pudo cargar" in txt or "Sin conexión" in txt:
                probs.append(f"sin red {h} no pinta: {txt[:120]!r}")
            if h == "#/mapa" and _map_count(page) != online_count:
                probs.append(f"sin red el camino cuenta {_map_count(page)} (con red {online_count})")
            if h == "#/gramatica/A1" and page.locator(".gr-u").count() < 3:
                probs.append("sin red #/gramatica no tiene sus temas")
            broken = page.evaluate(_BROKEN)
            if broken and h != "#/juegos/pajarito":
                probs.append(f"sin red {h} tiene dibujos rotos: {broken[:4]}")
            probs += [f"sin red {h}: {e}" for e in _real_errors(page, _OFF_OK)]
            if h == "#/juegos/memoria":
                C.shot(page, "memoria-sin-red", SHOTS, full_page=False)
        if shown != {h: C._norm(h) for h in shown}:
            probs.append(f"rutas sin red: {shown}")
        if page.evaluate("navigator.onLine"):
            probs.append("la prueba no está sin red (navigator.onLine)")

        # un tema que nunca se abrió: «Sin conexión» con «Reintentar»
        C.clear_errors(page)
        C.goto(page, "#/doc/w43")
        fail = page.locator('[data-route-fail="offline"]')
        txt = page.inner_text("#app")
        if fail.count() != 1 or "Sin conexión" not in txt or page.locator("#rt-retry").count() != 1 or "No se pudo cargar" in txt:
            probs.append(f"un tema sin guardar sin red no enseña «Sin conexión» con «Reintentar»: {txt[:160]!r}")
        if page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1"):
            probs.append("la página «Sin conexión» tiene scroll de lado")
        probs += [f"«Sin conexión»: {e}" for e in _real_errors(page, [r"/data/w43\.json"])]
        C.shot(page, "sin-conexion-390", SHOTS, full_page=False)
        page.set_viewport_size({"width": 360, "height": 740})
        page.emulate_media(color_scheme="dark")
        page.evaluate("document.documentElement.dataset.theme = 'dark'")
        page.wait_for_timeout(200)
        C.shot(page, "sin-conexion-360-oscuro", SHOTS, full_page=False)
        page.evaluate("document.documentElement.dataset.theme = 'light'")
        page.emulate_media(color_scheme="light")
        page.set_viewport_size({"width": 390, "height": 844})
        # «Reintentar» sin red: sigue igual (y no se cuelga)
        page.click("#rt-retry")
        page.wait_for_timeout(800)
        if page.locator('[data-route-fail="offline"]').count() != 1:
            probs.append("«Reintentar» sin red no vuelve a la página «Sin conexión»")

        # vuelve la red: se pinta sola
        st["down"] = False
        ctx.set_offline(False)
        page.wait_for_function("() => !document.querySelector('[data-route-fail]') && !!document.querySelector('#app .dv, #app [data-mode], #app #view')", timeout=10000)
        C.settle(page)
        if "w43" not in C.current_hash(page) or page.locator("[data-route-fail]").count():
            probs.append("al volver la red el tema no se pinta solo")
    finally:
        try:
            ctx.set_offline(False)
        except Exception:  # noqa: BLE001
            pass
        ctx.close()
        srv.stop()
    assert not probs, "\n".join(probs)


# =============================================================== sw.js: caché primero, 3 s, ?v= y LAZY
def test_sw_cache_first_timeout_and_versions():
    """Con el service worker activo: (1) los js con ?v=VERSION salen del shell (con la red lenta para los js, la app pinta
    igual de rápido y ningún js?v= llega al servidor); (2) con la página y los datos lentos (8 s), pinta antes de 6 s con lo
    guardado; (3) sin red, js/games.js?v=VERSION sale y con otro ?v= no (nunca la copia de otra versión por su nombre), y
    la carpeta («./») abre la app; (4) lo de LAZY ya usado (js/tech.js, ielts.css?v=29) pasa al shell de una versión nueva,
    y lo no usado no."""
    srv, st = _switch_server()
    ctx = C.new_context("phone", sw=True, server=srv)
    page = ctx.new_page()
    v = _version()
    probs = []
    try:
        C.seed(page)
        page.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=30000)
        _warm_done(page)
        C.reload(page)
        # (1) js lentos: del shell
        st["slow"] = (r"^/js/", 8)
        st["log"].clear()
        t0 = time.time()
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function("(window.__vocabRouteN||0) > 0", timeout=20000)
        t_js = time.time() - t0
        asked = [p for p in st["log"] if p.startswith("/js/") and f"?v={v}" in p]
        if asked or t_js > 6:
            probs.append(f"los js con ?v={v} no salen del shell: {asked[:5]} ({t_js:.1f} s)")
        # (2) la página y los datos lentos: lo guardado a los 3 s
        st["slow"] = (r"^/(\?|#|$|index\.html|data/)", 8)
        t0 = time.time()
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function("(window.__vocabRouteN||0) > 0", timeout=30000)
        t_page = time.time() - t0
        if t_page > 6.5 or page.locator("#app").count() != 1:
            probs.append(f"con la red lenta la app tarda {t_page:.1f} s en pintar (se esperaba lo guardado a los 3 s)")
        st["slow"] = None
        page.wait_for_timeout(500)
        C.settle(page)

        # (4) LAZY: usado ahora con red
        page.evaluate("() => Promise.all([fetch('js/tech.js?v=' + %d), fetch('ielts.css?v=29'), fetch('ielts.html')])" % v)
        page.wait_for_timeout(400)
        keys = set(page.evaluate(f"async () => (await (await caches.open('vocab-shell-v{v}')).keys()).map(r => {{ const u = new URL(r.url); return u.pathname + u.search; }})"))
        for k in ("/js/tech.js", "/ielts.css?v=29", "/ielts.html"):
            if k not in keys:
                probs.append(f"{k} no se guardó al usarlo: {sorted(x for x in keys if 'tech' in x or 'ielts' in x)}")

        # (3) sin red: ?v= de esta versión sí, de otra no; la carpeta abre la app
        st["down"] = True
        ctx.set_offline(True)
        got = page.evaluate("""async v => { const t = u => fetch(u).then(r => r.status, () => 'falla');
          return {same: await t('js/games.js?v=' + v), other: await t('js/games.js?v=' + (v - 1)), lazy: await t('js/tech.js?v=' + v),
            ielts: await t('ielts.css?v=29'), ielts2: await t('ielts.css?v=30'), unseen: await t('js/tech-pages.js?v=' + v)}; }""", v)
        want = {"same": 200, "other": "falla", "lazy": 200, "ielts": 200, "ielts2": "falla", "unseen": "falla"}
        if got != want:
            probs.append(f"sin red, por ?v=: {got} (se esperaba {want})")
        page.goto(C.base_url(page) + "/", wait_until="domcontentloaded")
        page.wait_for_function("(window.__vocabRouteN||0) > 0", timeout=20000)
        if page.locator("#app").count() != 1:
            probs.append("sin red la carpeta («./») no abre la app")
        st["down"] = False
        ctx.set_offline(False)
        page.wait_for_timeout(300)

        # versión nueva: lo de LAZY ya usado pasa al shell nuevo (con la misma URL); lo no usado, no
        st["bump"] = True
        page.evaluate("() => navigator.serviceWorker.getRegistration().then(r => r.update())")
        new = f"vocab-shell-v{v + 1}"
        t0 = time.time()
        while time.time() - t0 < 30:
            names = page.evaluate("() => caches.keys()")
            if new in names and f"vocab-shell-v{v}" not in names:
                break
            page.wait_for_timeout(300)
        else:
            probs.append(f"la versión nueva no se activó: {names}")
        keys = set(page.evaluate(f"async () => (await caches.open('{new}')).keys().then(rs => rs.map(r => {{ const u = new URL(r.url); return u.pathname + u.search; }}))"))
        for k in ("/js/tech.js", "/ielts.css?v=29", "/ielts.html"):
            if k not in keys:
                probs.append(f"{k} (ya usado) no pasó al shell de la versión nueva")
        for k in ("/js/tech-pages.js", "/js/ielts.js", "/img/games/vuelo-fr.jpg"):
            if k in keys:
                probs.append(f"{k} (sin usar) está en el shell de la versión nueva")
        probs += _real_errors(page, [r"ERR_FAILED", r"ERR_INTERNET_DISCONNECTED", r"ERR_EMPTY_RESPONSE", r"Failed to fetch"])
    finally:
        try:
            ctx.set_offline(False)
        except Exception:  # noqa: BLE001
            pass
        ctx.close()
        srv.stop()
    assert not probs, "\n".join(probs)


# =============================================================== «Reducir movimiento» (calmCss)
def test_calm_css_only_with_calm():
    """Sin data-motion=calm, calmCss no se llama nunca (ni al arrancar ni al entrar estilos nuevos de los módulos) y no hay
    <style id=css-calm>. Al encender «Reducir movimiento» (vocabUI) se copian las reglas antes del siguiente fotograma; con
    él encendido, un <style> nuevo se copia; apagado, ya no se recorre nada."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        page.evaluate("() => { window.__calmN = 0; const f = window.calmCss; window.calmCss = () => { window.__calmN++; return f(); }; }")
        boot = page.evaluate("() => !!document.getElementById('css-calm') && document.getElementById('css-calm').textContent.length")
        if boot:
            probs.append(f"sin «Reducir movimiento» se copiaron las reglas al arrancar ({boot} caracteres)")
        for h in ("#/juegos", "#/granja", "#/progreso", "#/mapa"):
            C.goto(page, h)
        if page.evaluate("window.__calmN"):
            probs.append(f"sin «Reducir movimiento» calmCss corrió {page.evaluate('window.__calmN')} veces")
        st = page.evaluate("""async () => {
          vocabUI.set('motion', 'calm');
          await new Promise(r => requestAnimationFrame(r));
          const host = document.createElement('div'); host.innerHTML = '<i id="t-inf" style="animation:m-dummy 1s infinite">y</i>';
          document.getElementById('app').appendChild(host);
          const it = getComputedStyle(document.getElementById('t-inf')).animationIterationCount; host.remove();
          const c = document.getElementById('css-calm');
          return {len: c ? c.textContent.length : 0, it, n: window.__calmN}; }""")
        if st["len"] < 200 or st["n"] < 1:
            probs.append(f"al encender «Reducir movimiento» no se copian las reglas a tiempo: {st}")
        page.evaluate("""() => { const s = document.createElement('style'); s.id = 't-new';
          s.textContent = '@media (prefers-reduced-motion: reduce){.t-calm-a{opacity:.5}}'; document.head.appendChild(s); }""")
        page.wait_for_timeout(200)
        if ".t-calm-a" not in page.evaluate("document.getElementById('css-calm').textContent"):
            probs.append("con «Reducir movimiento» un <style> nuevo no se copia")
        page.evaluate("vocabUI.set('motion', null)")
        page.wait_for_timeout(100)
        n0 = page.evaluate("window.__calmN")
        page.evaluate("""() => { const s = document.createElement('style');
          s.textContent = '@media (prefers-reduced-motion: reduce){.t-calm-b{opacity:.5}}'; document.head.appendChild(s); }""")
        C.goto(page, "#/juegos")
        page.wait_for_timeout(200)
        if page.evaluate("window.__calmN") != n0:
            probs.append("apagado, calmCss sigue corriendo al entrar estilos nuevos")
        page.evaluate("vocabUI.set('motion', 'calm')")
        page.wait_for_timeout(100)
        if ".t-calm-b" not in page.evaluate("document.getElementById('css-calm').textContent"):
            probs.append("al volver a encenderlo no se copian los estilos que entraron mientras estaba apagado")
        page.evaluate("vocabUI.set('motion', null)")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# =============================================================== un guardado que no cabe
_FULL = """(() => { const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function(k, v) {
    if (window.__full && this === window.localStorage) throw new DOMException('El navegador no tiene sitio', 'QuotaExceededError');
    return set.call(this, k, v); }; })();"""
_PASS = "() => sessionStorage.setItem('vocab:gate', String(Date.now() + adultGate.MS))"


def _adults_page(page):
    page.evaluate(_PASS)
    page.evaluate("openSettings('google')")
    page.wait_for_function("() => window.vocabSettings && vocabSettings.page === 'mayores'", timeout=5000)
    page.wait_for_timeout(300)


def test_save_failure_shown_to_adults():
    """Si localStorage no tiene sitio, store.set no se calla: SAVE_FAIL lo apunta, la fila «Para mayores» de Ajustes lo dice
    y Para mayores enseña arriba qué pasa, «Libera espacio» y «Descargar copia» (un .json que vocabSave.parse lee
    entero). Cuando esa clave vuelve a guardarse bien, el aviso se va."""
    probs = []
    for scheme, w in (("light", 390), ("dark", 360)):
        page = C.new_page("phone", color_scheme=scheme, accept_downloads=True)
        try:
            page.set_viewport_size({"width": w, "height": 844 if w == 390 else 740})
            page.add_init_script(_FULL)
            C.seed(page)
            page.evaluate("() => { window.__full = true; const a = store.get('act', {}); a['2026-03-11'] = 99; store.set('act', a); }")
            f = page.evaluate("SAVE_FAIL")
            if not f or f.get("k") != "act" or not f.get("full"):
                probs.append(f"SAVE_FAIL no apunta el fallo: {f}")
            page.evaluate("openSettings()")
            page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
            page.wait_for_timeout(300)
            row = page.evaluate("(document.querySelector('#aj-may [data-sync-cfg]') || {}).textContent")
            if not row or "sitio" not in row:
                probs.append(f"la fila «Para mayores» no lo dice: {row!r}")
            _adults_page(page)
            box = page.locator("#sv-fail")
            txt = page.evaluate("() => (document.getElementById('sv-fail-w') || {}).innerText || ''")
            if box.count() != 1 or "Libera espacio" not in txt or "Descargar copia" not in txt:
                probs.append(f"Para mayores no enseña el fallo con qué hacer: {txt[:200]!r}")
            page.evaluate("document.getElementById('sv-fail').scrollIntoView({block: 'center'})")
            page.wait_for_timeout(200)
            if page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1"):
                probs.append(f"{w} px: scroll de lado")
            C.shot(page, f"guardar-sin-sitio-{w}-{scheme}", SHOTS, full_page=False)
            with page.expect_download(timeout=5000) as dl:
                page.click("#sv-dl")
            text = open(dl.value.path(), encoding="utf-8").read()
            ok = page.evaluate("t => { const p = vocabSave.parse(t); return p.ok ? Object.keys(p.data.keys).length : p.err; }", text)
            if not isinstance(ok, int) or ok < 10 or not dl.value.suggested_filename.endswith(".json"):
                probs.append(f"«Descargar copia» no da una partida que se pueda leer: {ok} {dl.value.suggested_filename}")
            page.evaluate("() => { window.__full = false; const a = store.get('act', {}); a['2026-03-11'] = 99; store.set('act', a); }")
            page.wait_for_timeout(200)
            if page.evaluate("SAVE_FAIL") or page.locator("#sv-fail").count():
                probs.append("el aviso sigue cuando ya se guarda bien")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# =============================================================== Google Drive de mentira
_CORS = {"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,OPTIONS"}


class FakeDrive:
    """La carpeta privada de Google Drive de mentira, compartida por varias páginas (aparatos): archivos con
    appProperties y su contenido; lista, metadatos, bajar (alt=media), crear (POST multipart) y cambiar (PATCH)."""

    def __init__(self):
        self.files, self.log, self.n = {}, [], 0
        self.lock = threading.Lock()

    def _stamp(self):
        self.n += 1
        return f"2026-03-11T09:{self.n // 60:02d}:{self.n % 60:02d}.000Z"

    def put(self, body, props, fid="f1"):
        self.files[fid] = {"id": fid, "name": "vocabulary-progress.json", "appProperties": {k: str(v) for k, v in props.items()},
                           "body": body if isinstance(body, str) else json.dumps(body), "modifiedTime": self._stamp()}

    @staticmethod
    def _meta(f):
        return {"id": f["id"], "modifiedTime": f["modifiedTime"], "appProperties": dict(f["appProperties"])}

    @staticmethod
    def _multipart(req):
        b = re.search(r"boundary=([^;\s]+)", req.headers.get("content-type", "")).group(1)
        parts = [p for p in (req.post_data or "").split("--" + b) if p.strip() and p.strip() != "--"]
        body = lambda p: p.split("\r\n\r\n", 1)[1].rsplit("\r\n", 1)[0]
        return json.loads(body(parts[0])), body(parts[1])

    def handle(self, route, who):
        req = route.request
        if req.method == "OPTIONS":
            return route.fulfill(status=204, headers=_CORS)
        u = urlsplit(req.url)
        qs = parse_qs(u.query)
        js = lambda o, s=200: route.fulfill(status=s, headers=dict(_CORS, **{"content-type": "application/json"}), body=json.dumps(o))
        with self.lock:
            kind = "media" if qs.get("alt") == ["media"] else ""
            self.log.append((who, req.method, u.path, kind))
            if u.path == "/drive/v3/about":
                return js({"user": {"emailAddress": "mayor@example.com"}})
            if u.path == "/drive/v3/files" and req.method == "GET":
                fs = sorted(self.files.values(), key=lambda f: f["modifiedTime"], reverse=True)
                return js({"files": [self._meta(f) for f in fs]})
            m = re.fullmatch(r"/drive/v3/files/([^/]+)", u.path)
            if m and req.method == "GET":
                f = self.files.get(m.group(1))
                if not f:
                    return js({"error": {"code": 404, "errors": [{"reason": "notFound"}]}}, 404)
                if kind == "media":
                    return route.fulfill(status=200, headers=dict(_CORS, **{"content-type": "application/json"}), body=f["body"])
                return js(self._meta(f))
            m = re.fullmatch(r"/upload/drive/v3/files(?:/([^/]+))?", u.path)
            if m and req.method in ("POST", "PATCH"):
                md, body = self._multipart(req)
                if req.method == "POST":
                    f = {"id": f"f{len(self.files) + 1}", "name": md.get("name"), "appProperties": {}}
                else:
                    f = self.files.get(m.group(1))
                    if not f:
                        return js({"error": {"code": 404, "errors": [{"reason": "notFound"}]}}, 404)
                f["appProperties"] = md.get("appProperties", f["appProperties"])
                f["body"], f["modifiedTime"] = body, self._stamp()
                self.files[f["id"]] = f
                return js(self._meta(f))
            return js({"error": {"code": 400}}, 400)

    def attach(self, page, who):
        page.route("https://www.googleapis.com/**", lambda r: self.handle(r, who))

    def uploads(self, who=None):
        return [x for x in self.log if x[1] in ("POST", "PATCH") and (who is None or x[0] == who)]

    def downloads(self, who=None):
        return [x for x in self.log if x[3] == "media" and (who is None or x[0] == who)]

    def keys(self, fid="f1"):
        return json.loads(self.files[fid]["body"])["keys"]


def _dev_keys(base=None, fid=None, base_hash=None):
    """partida con Google conectado (hace 2 días), un permiso vigente y la última copia en fid/base_hash"""
    keys = dict(base or C.seed_keys())
    keys["save:sync"] = json.dumps({"connectedAt": NOW_MS - 2 * 864e5, "fileId": fid, "baseHash": base_hash, "lastPushedHash": base_hash,
                                    "lastSync": NOW_MS - 120 * MIN if fid else None, "lastPull": None, "localDirty": False,
                                    "reconnect": None, "hint": "mayor@example.com", "choice": False, "tapAt": 0})
    keys["save:tok"] = json.dumps({"t": "permiso-bueno", "exp": NOW_MS + 3600_000})
    return keys


_IDLE = """async () => { for (let i = 0; i < 80; i++) { const c = vocabSync._idle(); await c; await new Promise(r => setTimeout(r, 80));
  if (c === vocabSync._idle() && !vocabSync.state.running) return vocabSync.state.phase; } return 'ocupado'; }"""


def _idle(page):
    for _ in range(3):
        try:
            return page.evaluate(_IDLE)
        except Exception:  # noqa: BLE001  (la página se recargó: una partida cargada)
            _wait_reloaded(page)
    return page.evaluate(_IDLE)


def _wait_reloaded(page, timeout=20000):
    t0 = time.time()
    while time.time() - t0 < timeout / 1000:
        try:
            if page.evaluate("() => !window.__old && (window.__vocabRouteN || 0) > 0 && !!window.vocabSync"):
                C.settle(page)
                return
        except Exception:  # noqa: BLE001
            pass
        page.wait_for_timeout(100)
    raise TimeoutError("la página no volvió a pintar")


def _device(drive, who, keys, hush=True):
    page = C.new_page("phone")
    drive.attach(page, who)
    C.seed(page, keys=keys)
    if hush:   # que no suba sola mientras se preparan los cambios
        page.evaluate("vocabSync._delays({debounce: 9e8, poll: 9e8, debounceBig: 9e8})")
    _idle(page)
    return page


def _local(page, k):
    return page.evaluate("k => JSON.parse(localStorage.getItem(k))", k)


def _sync_and_wait(page):
    page.evaluate("() => { window.__old = 1; vocabSync.sync('manual'); }")
    try:
        page.wait_for_timeout(300)
        ph = _idle(page)
    except Exception:  # noqa: BLE001
        _wait_reloaded(page)
        ph = _idle(page)
    try:
        if page.evaluate("!!window.__old") is False:
            _wait_reloaded(page)
    except Exception:  # noqa: BLE001
        _wait_reloaded(page)
    return ph


def _toasts(page):
    return page.evaluate("() => [...document.querySelectorAll('#m-toasts .m-toast, .m-toast')].map(t => t.textContent)")


def test_newer_save_on_drive_is_never_overwritten():
    """Una partida de Google escrita por una versión más nueva de la app (appProperties.v = 2) no se baja ni se sube nada
    encima, aunque aquí haya cambios, ni al acabar una lección ni con «Guardar ahora»: aviso «Hay una versión nueva de
    la app. Recarga para seguir.» y Para mayores lo dice con «Recargar». Si appProperties no lo dice pero el archivo es
    v:2, se baja, parse() da code "newer" y tampoco se sube. Control: una partida dañada de verdad sí se reemplaza."""
    probs = []
    seed = C.seed_keys()
    newer_body = {"app": "vocabulary", "v": 2, "saved": "2026-03-11T08:00:00.000Z", "keys": dict(seed, nuevo="{}")}
    for tag, props, body, want_up in (
            ("v=2 en appProperties", {"hash": "nueva", "score": 999, "v": 2}, newer_body, False),
            ("v=2 solo dentro", {"hash": "nueva", "score": 999, "v": 1}, newer_body, False),
            ("dañada (control)", {"hash": "rota", "score": 1, "v": 1}, "{esto no es json", True)):
        drive = FakeDrive()
        drive.put(body, props)
        local = dict(seed)
        local["act"] = json.dumps({"2026-03-11": 42})
        page = _device(drive, "A", _dev_keys(local, "f1", "vieja"), hush=False)
        try:
            ph = page.evaluate("vocabSync.state")
            ups = drive.uploads()
            if want_up:
                if not ups:
                    probs.append(f"{tag}: la partida dañada no se reemplazó ({drive.log})")
                continue
            if ups:
                probs.append(f"{tag}: se subió encima de la partida nueva: {ups}")
            if ph["phase"] != "newer" or not ph["newer"]:
                probs.append(f"{tag}: estado {ph['phase']} (se esperaba «newer»)")
            got_dl = bool(drive.downloads())
            if tag.startswith("v=2 en") and got_dl:
                probs.append(f"{tag}: se bajó sin mirar antes appProperties.v")
            page.wait_for_timeout(500)
            if not any(NEWER in t for t in _toasts(page)):
                probs.append(f"{tag}: no sale el aviso «{NEWER}»: {_toasts(page)}")
            page.evaluate("""() => { const a = store.get('act', {}); a['2026-03-11'] = 50; store.set('act', a);
              bus.emit('lesson-done', {id: 'A1-010', lv: 'A1', stars: 3, first: true, grammar: false, words: []}); vocabSync.sync('manual'); }""")
            page.wait_for_timeout(1500)
            _idle(page)
            if drive.uploads():
                probs.append(f"{tag}: al acabar una lección o con «Guardar ahora» se subió encima: {drive.uploads()}")
            if drive.files["f1"]["body"] != json.dumps(body):
                probs.append(f"{tag}: la partida nueva de Google cambió")
            _adults_page(page)
            txt = page.evaluate("() => document.getElementById('sv-dyn').innerText")
            if NEWER not in txt or page.locator("#sv-reload").count() != 1:
                probs.append(f"{tag}: Para mayores no lo dice con «Recargar»: {txt[:160]!r}")
            if tag.startswith("v=2 en"):
                C.shot(page, "google-version-nueva", SHOTS, full_page=False)
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_merge_rules():
    """vocabSave.merge(base, otra): de la otra se junta lo que solo crece (lecciones con más estrellas, el repaso con más
    repasos o, si empatan, el que vuelve más tarde, la actividad más alta de cada día, el álbum, los récords por juego con
    plays/lv/at más altos, los cuentos, la temporada y los sellos) y lo demás (monedas, granja…) es de base; si la otra
    no trae nada nuevo, el texto de base no cambia."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        J = json.dumps
        base = {"game": J({"coins": 500, "earned": 900}), "farm:state": J({"a": 1}), "lang": J("english"),
                "map:english": J({"A1-001": 3, "A1-002": 1}), "act": J({"2026-03-10": 5, "2026-03-11": 2}),
                "srs:english": J({"x|perro": {"d": "x", "e": "perro", "b": 2, "n": 4, "due": 10},
                                  "x|gato": {"d": "x", "e": "gato", "b": 1, "n": 2, "due": 5}}),
                "album:seen:english": J({"a": 1}), "album:done:english": J({"animales": "2026-03-01"}),
                "games:best": J({"memoria": {"score": 9, "stars": 3, "plays": 3, "at": 100}}),
                "cuentos": J({"v": 1, "done": {"en-play": {"d": "2026-03-01", "e": [0], "n": 1, "p": 1}}, "pay": {"d": "2026-03-10", "n": 1}}),
                "season": J({"2026": {"halloween": {"st": {"bat": 5}, "bags": 1, "last": 7, "run": {"d": 7, "o": ["a"], "ok": [0]}},
                                      "advent": {"open": [1, 2], "paid": 3}}}),
                "phrase:stamps": J({"v": 1, "days": ["2026-03-01", "2026-03-02"], "n": 2})}
        other = {"game": J({"coins": 50, "earned": 100}), "farm:state": J({"b": 2}), "lang": J("français"),
                 "map:english": J({"A1-002": 3, "A1-003": 2}), "act": J({"2026-03-11": 9, "2026-03-12": 1}),
                 "srs:english": J({"x|perro": {"d": "x", "e": "perro", "b": 3, "n": 6, "due": 12},
                                   "x|gato": {"d": "x", "e": "gato", "b": 0, "n": 2, "due": 9},
                                   "x|pez": {"d": "x", "e": "pez", "b": 0, "n": 1, "due": 4}}),
                 "srs:français": J({"x|sol": {"d": "x", "e": "sol", "b": 0, "n": 1, "due": 4}}),
                 "album:seen:english": J({"a": 2, "b": 1}), "album:done:english": J({"colores": "2026-03-02"}),
                 "games:best": J({"memoria": {"score": 5, "stars": 1, "plays": 7, "at": 300, "lv": 2},
                                  "lluvia": {"score": 14, "stars": 2, "plays": 1, "at": 200}}),
                 "cuentos": J({"v": 1, "done": {"en-play": {"d": "2026-03-05", "e": [1], "n": 2}, "en-cake": {"d": "2026-03-04", "e": [0], "n": 1, "p": 1}},
                               "pay": {"d": "2026-03-11", "n": 2}}),
                 "season": J({"2026": {"halloween": {"st": {"cat": 6}, "bags": 3, "last": 6, "run": {"d": 9, "o": ["b"], "ok": []}},
                                       "advent": {"open": [2, 5], "paid": 4}}}),
                 "phrase:stamps": J({"v": 1, "days": ["2026-03-02", "2026-03-05"], "n": 2})}
        out = page.evaluate("([a, b]) => { const m = vocabSave.merge(a, b); const o = {}; for (const k in m) o[k] = JSON.parse(m[k]); return o; }", [base, other])
        want = {
            "game": {"coins": 500, "earned": 900}, "farm:state": {"a": 1}, "lang": "english",
            "map:english": {"A1-001": 3, "A1-002": 3, "A1-003": 2},
            "act": {"2026-03-10": 5, "2026-03-11": 9, "2026-03-12": 1},
            "srs:english": {"x|perro": {"d": "x", "e": "perro", "b": 3, "n": 6, "due": 12},
                            "x|gato": {"d": "x", "e": "gato", "b": 0, "n": 2, "due": 9},
                            "x|pez": {"d": "x", "e": "pez", "b": 0, "n": 1, "due": 4}},
            "srs:français": {"x|sol": {"d": "x", "e": "sol", "b": 0, "n": 1, "due": 4}},
            "album:seen:english": {"a": 2, "b": 1}, "album:done:english": {"animales": "2026-03-01", "colores": "2026-03-02"},
            "games:best": {"memoria": {"score": 9, "stars": 3, "plays": 7, "at": 300, "lv": 2}, "lluvia": {"score": 14, "stars": 2, "plays": 1, "at": 200}},
            "cuentos": {"v": 1, "done": {"en-play": {"d": "2026-03-05", "e": [0, 1], "n": 2, "p": 1}, "en-cake": {"d": "2026-03-04", "e": [0], "n": 1, "p": 1}},
                        "pay": {"d": "2026-03-11", "n": 2}},
            "season": {"2026": {"halloween": {"st": {"bat": 5, "cat": 6}, "bags": 3, "last": 7, "run": {"d": 9, "o": ["b"], "ok": []}},
                                "advent": {"open": [1, 2, 5], "paid": 4}}},
            "phrase:stamps": {"v": 1, "days": ["2026-03-01", "2026-03-02", "2026-03-05"], "n": 3}}
        for k, v in want.items():
            if out.get(k) != v:
                probs.append(f"{k}: {out.get(k)} (se esperaba {v})")
        if set(out) != set(want):
            probs.append(f"claves de más o de menos: {sorted(set(out) ^ set(want))}")
        same = page.evaluate("([a, b]) => { const m = vocabSave.merge(a, b); return Object.keys(a).every(k => m[k] === a[k]) && Object.keys(m).length === Object.keys(a).length; }", [base, base])
        if not same:
            probs.append("juntar una partida consigo misma cambia el texto")
        bad = page.evaluate("([a, b]) => vocabSave.merge(a, b)['map:english']", [base, dict(other, **{"map:english": "{roto"})])
        if bad != base["map:english"]:
            probs.append(f"con un valor dañado en la otra no queda el de base: {bad}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def _play(page, lesson, stars, words, best, earned_plus=0, day_act=0, tale=None, stamp=None):
    """cambios de una partida en este aparato (como si hubiera jugado): una lección, palabras al repaso (con n), un
    récord, monedas ganadas, actividad de hoy, un cuento y un sello"""
    page.evaluate("""([lesson, stars, words, best, plus, act, tale, stamp]) => {
      const m = store.get('map:english', {}); m[lesson] = stars; store.set('map:english', m);
      const s = store.get('srs:english', {}); for (const [k, n] of words) s['animales|' + k] = {d: 'animales', e: k, b: 1, n, due: 20530}; store.set('srs:english', s);
      const b = store.get('games:best', {}); Object.assign(b, best); store.set('games:best', b);
      const g = store.get('game', {}); g.earned = (g.earned || 0) + plus; g.coins = (g.coins || 0) + plus; store.set('game', g);
      const a = store.get('act', {}); a['2026-03-11'] = act; store.set('act', a);
      if (tale) { const c = store.get('cuentos', {v: 1, done: {}}); c.done = c.done || {}; c.done[tale] = {d: '2026-03-11', e: [0], n: 1, p: 1}; store.set('cuentos', c); }
      if (stamp) { const p = store.get('phrase:stamps', {v: 1, days: [], n: 0}); p.days = [...new Set([...(p.days || []), stamp])].sort(); p.n = (p.n || 0) + 1; store.set('phrase:stamps', p); }
    }""", [lesson, stars, words, best, earned_plus, day_act, tale, stamp])


def test_two_devices_merge_without_losing_progress():
    """Dos aparatos con la misma partida en Google juegan a la vez. A sube primero (lección A1-010 con 3 ★, dos palabras,
    récord de Memoria 9, un cuento y un sello). B, con más monedas ganadas, hace A1-011, A1-010 con 1 ★, otras palabras,
    Lluvia y Memoria 5 (con más partidas y nivel 2), otro cuento y otro sello, y sincroniza: en Google y en B queda lo de
    los dos (A1-010 con 3 ★, las palabras de los dos, la actividad más alta, los récords, cuentos y sellos de los dos) con
    las monedas de B; la de A queda para deshacer en B. Luego A sincroniza y queda igual. Y al revés (Google con más
    progreso): en B quedan las monedas de Google, lo de los dos y su partida de antes para deshacer."""
    probs = []
    for tag, b_plus, a_plus in (("gana B (este aparato)", 3000, 0), ("gana Google", 0, 3000)):
        drive = FakeDrive()
        pa = _device(drive, "A", _dev_keys())
        pb = None
        try:
            if not drive.files:
                probs.append(f"{tag}: A no creó la copia en Google ({drive.log})")
                continue
            h0 = drive.files["f1"]["appProperties"]["hash"]
            pb = _device(drive, "B", _dev_keys(fid="f1", base_hash=h0))
            _sync_and_wait(pa)   # los dos con la misma base
            _play(pa, "A1-010", 3, [["perro", 3], ["gato", 2]], {"memoria": {"score": 9, "stars": 3, "plays": 3, "at": NOW_MS}},
                  earned_plus=a_plus, day_act=40, tale="en-play", stamp="2026-03-11")
            _sync_and_wait(pa)
            a_keys = drive.keys()
            _play(pb, "A1-011", 2, [["vaca", 4], ["gato", 5]], {"lluvia": {"score": 14, "stars": 2, "plays": 1, "at": NOW_MS},
                                                                  "memoria": {"score": 5, "stars": 1, "plays": 7, "at": NOW_MS + 5, "lv": 2}},
                  earned_plus=b_plus, day_act=25, tale="en-cake", stamp="2026-03-10")
            pb.evaluate("() => { const m = store.get('map:english', {}); m['A1-010'] = 1; store.set('map:english', m); }")
            b_game = _local(pb, "game")
            b_before = pb.evaluate("vocabSave.collect(true)")
            _sync_and_wait(pb)
            _idle(pb)
            final = drive.keys()
            J = lambda k: json.loads(final[k])
            mp, srs, best = J("map:english"), J("srs:english"), J("games:best")
            if mp.get("A1-010") != 3 or mp.get("A1-011") != 2:
                probs.append(f"{tag}: lecciones en Google {mp}")
            for w in ("animales|perro", "animales|vaca", "animales|gato"):
                if w not in srs:
                    probs.append(f"{tag}: falta {w} del repaso en Google")
            if srs.get("animales|gato", {}).get("n") != 5:
                probs.append(f"{tag}: gato no queda con más repasos (n=5): {srs.get('animales|gato')}")
            if J("act").get("2026-03-11") != 40:
                probs.append(f"{tag}: la actividad de hoy no es la más alta: {J('act').get('2026-03-11')}")
            if best.get("memoria", {}).get("score") != 9 or best.get("memoria", {}).get("plays") != 7 or best.get("memoria", {}).get("lv") != 2 \
                    or best.get("lluvia", {}).get("score") != 14:
                probs.append(f"{tag}: récords {best}")
            if set(J("cuentos")["done"]) != {"en-play", "en-cake"} or not {"2026-03-10", "2026-03-11"} <= set(J("phrase:stamps")["days"]):
                probs.append(f"{tag}: cuentos {J('cuentos')} o sellos {J('phrase:stamps')}")
            winner = b_game if tag.startswith("gana B") else json.loads(a_keys["game"])
            if J("game").get("earned") != winner.get("earned"):
                probs.append(f"{tag}: las monedas de Google no son las de la que gana: {J('game')} vs {winner}")
            # B ya tiene lo juntado (recargó) y la otra para deshacer
            for k in ("map:english", "srs:english", "games:best", "game", "cuentos", "phrase:stamps", "act"):
                if pb.evaluate("k => localStorage.getItem(k)", k) != final[k]:
                    probs.append(f"{tag}: en B {k} no es lo juntado")
            undo = pb.evaluate("() => JSON.parse(localStorage.getItem('save:undo'))")
            lost = a_keys if tag.startswith("gana B") else b_before
            if not undo or undo.get("keys", {}).get("game") != lost.get("game") or undo["keys"].get("map:english") != lost.get("map:english"):
                probs.append(f"{tag}: la partida que perdió algo no queda para deshacer")
            if not any("juntada" in t for t in _toasts(pb)) and tag.startswith("gana"):
                pass   # el aviso es corto y puede haberse ido; lo que cuenta es la partida
            # A sincroniza: carga lo juntado
            _sync_and_wait(pa)
            _idle(pa)
            if json.loads(pa.evaluate("localStorage.getItem('map:english')")).get("A1-011") != 2 or \
                    pa.evaluate("localStorage.getItem('game')") != drive.keys()["game"]:
                probs.append(f"{tag}: A no queda con lo juntado")
            if drive.keys()["map:english"] != final["map:english"]:
                probs.append(f"{tag}: A volvió a cambiar lo juntado en Google")
            for p, w in ((pa, "A"), (pb, "B")):
                probs += [f"{tag} · {w}: {e}" for e in C.errors(p)]
            if tag.startswith("gana B"):
                _adults_page(pb)
                C.shot(pb, "google-juntadas-deshacer", SHOTS, full_page=False)
        finally:
            pa.context.close()
            if pb:
                pb.context.close()
    assert not probs, "\n".join(probs)


def test_uploads_at_once_and_big_saves():
    """Con Google al día: un cambio con el aviso «coins» espera los 20 s de siempre; al acabar una lección, un repaso o una
    partida se sube al momento (< 3 s). Con una partida de más de 60 KB (que no cabe en el keepalive de al cerrar), se
    sube a los 5 s y, al esconderse la página, enseguida."""
    probs = []
    drive = FakeDrive()
    page = _device(drive, "A", _dev_keys(), hush=False)
    try:
        if not drive.files:
            raise AssertionError(f"no se creó la copia en Google: {drive.log}")
        n = len(drive.uploads())
        page.evaluate("() => { const a = store.get('act', {}); a['2026-03-11'] = 61; store.set('act', a); bus.emit('coins', {}); }")
        page.wait_for_timeout(2500)
        if len(drive.uploads()) != n:
            probs.append("un cambio cualquiera se subió antes de los 20 s")
        for ev, data in (("lesson-done", {"id": "A1-010", "lv": "A1", "stars": 3, "first": True, "grammar": False, "words": []}),
                         ("review-done", {"n": 3}), ("game-done", {"game": "memoria", "score": 5, "stars": 2, "tries": 9})):
            n = len(drive.uploads())
            page.evaluate("([ev, d]) => { const a = store.get('act', {}); a['2026-03-11'] = (a['2026-03-11'] || 0) + 1; store.set('act', a); bus.emit(ev, d); }", [ev, data])
            t0 = time.time()
            while time.time() - t0 < 3 and len(drive.uploads()) == n:
                page.wait_for_timeout(100)
            if len(drive.uploads()) == n:
                probs.append(f"tras «{ev}» no se subió al momento")
        _idle(page)
        if page.evaluate("vocabSync.state.big"):
            probs.append("una partida pequeña cuenta como grande")
        # partida de más de 60 KB
        page.evaluate("""() => { const s = store.get('srs:english', {});
          for (let i = 0; i < 900; i++) s['w01|palabra larga número ' + i] = {d: 'w01', e: 'palabra larga número ' + i, b: 1, n: 1, due: 20530};
          store.set('srs:english', s); vocabSync.sync('manual'); }""")
        _idle(page)
        if not page.evaluate("vocabSync.state.big"):
            probs.append("una partida de más de 60 KB no cuenta como grande")
        n = len(drive.uploads())
        page.evaluate("() => { const a = store.get('act', {}); a['2026-03-11'] = 99; store.set('act', a); bus.emit('coins', {}); }")
        t0 = time.time()
        while time.time() - t0 < 9 and len(drive.uploads()) == n:
            page.wait_for_timeout(200)
        dt = time.time() - t0
        if len(drive.uploads()) == n or dt < 4:
            probs.append(f"una partida grande no se sube a los 5 s ({dt:.1f} s)")
        _idle(page)
        n = len(drive.uploads())
        page.evaluate("""() => { const a = store.get('act', {}); a['2026-03-11'] = 100; store.set('act', a);
          Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'hidden'});
          document.dispatchEvent(new Event('visibilitychange')); }""")
        t0 = time.time()
        while time.time() - t0 < 3 and len(drive.uploads()) == n:
            page.wait_for_timeout(100)
        if len(drive.uploads()) == n:
            probs.append("al esconderse la página no se subió enseguida")
        page.evaluate("() => { delete document.visibilityState; }")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
