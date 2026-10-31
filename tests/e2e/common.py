"""Utilidades compartidas de las pruebas de extremo a extremo (Playwright síncrono + Chromium).

Uso típico:

    import common as C
    page = C.new_page("phone", color_scheme="dark")      # servidor, navegador y contexto listos
    C.seed(page)                                          # partida de ejemplo y carga #/
    C.goto(page, "#/granja")                              # espera a que la ruta pinte
    assert not C.errors(page), C.errors(page)
    snap = C.export(page)                                 # {"app", "v", "saved", "keys"} de js/save.js
    C.shot(page, "phone-granja", "/ruta/de/capturas")
    page.context.close()

El reloj de cada contexto empieza en FIXED_NOW (Playwright clock.install, el tiempo corre normal desde ahí) y la zona
horaria es Europe/Madrid: así la partida sembrada y su exportación son siempre las mismas. Con now=None se usa la hora
real. Las peticiones a otros dominios se cortan (no hay red en las pruebas) y sus errores no cuentan.
"""
from __future__ import annotations

import datetime as _dt
import functools
import json
import math
import os
import re
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
# el Chromium de las pruebas: el primero que exista (VOCAB_CHROME manda)
CHROME = os.environ.get("VOCAB_CHROME") or next((p for p in ("/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium") if os.path.exists(p)), "/opt/pw-browsers/chromium")
TZ = "Europe/Madrid"
LOCALE = "es-ES"
FIXED_NOW = _dt.datetime(2026, 3, 11, 10, 0, 0, tzinfo=ZoneInfo(TZ))   # miércoles, de día, fuera de toda temporada
BASELINE = HERE / "baseline" / "export.json"
# las capturas de las pruebas (VOCAB_CAPTURAS cambia la carpeta, p. ej. si la carpeta compartida no responde)
CAPTURAS = Path(os.environ.get("VOCAB_CAPTURAS") or "/mnt/project-files/rediseno/capturas")

# carpeta que se sirve por defecto (run.py --root o la variable VOCAB_ROOT)
ROOT = Path(os.environ.get("VOCAB_ROOT") or REPO).resolve()


def set_root(path) -> Path:
    """Cambia la carpeta que sirven serve()/new_context() por defecto."""
    global ROOT
    ROOT = Path(path).resolve()
    return ROOT


# ---------------------------------------------------------------- servidor estático
class _Quiet(SimpleHTTPRequestHandler):
    """Servidor de ficheros sin registro ni caché. /__blank es una página vacía del mismo origen
    (para escribir en localStorage antes de que arranque la app)."""

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/__blank":
            body = b"<!doctype html><meta charset=utf-8><title>blank</title>"
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def handle(self):
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError):
            pass


class Server:
    """Servidor en un puerto libre de 127.0.0.1 para una carpeta. .url es la base sin barra final.
    handler: otra subclase de _Quiet (por defecto, _Quiet)."""

    def __init__(self, root=None, host="127.0.0.1", handler=None):
        self.root = Path(root or ROOT).resolve()
        handler = functools.partial(handler or _Quiet, directory=str(self.root))
        self.httpd = ThreadingHTTPServer((host, 0), handler)
        self.httpd.daemon_threads = True
        self.host = host
        self.port = self.httpd.server_address[1]
        self.url = f"http://{host}:{self.port}"
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def stop(self):
        self.httpd.shutdown()
        self.httpd.server_close()


_SERVERS: dict = {}


def serve(root=None, host="127.0.0.1") -> Server:
    """Servidor (uno por carpeta y host, reutilizado durante la ejecución)."""
    key = (str(Path(root or ROOT).resolve()), host)
    if key not in _SERVERS:
        _SERVERS[key] = Server(key[0], host)
    return _SERVERS[key]


# ---------------------------------------------------------------- navegador y contextos
_PW = None
_BROWSER = None


def browser():
    """Chromium compartido (se cierra con close_all(), que run.py llama al final)."""
    global _PW, _BROWSER
    if _BROWSER is None or not _BROWSER.is_connected():
        from playwright.sync_api import sync_playwright
        if _PW is None:
            _PW = sync_playwright().start()
        _BROWSER = _PW.chromium.launch(
            executable_path=CHROME,
            args=["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
        )
    return _BROWSER


def close_all():
    global _PW, _BROWSER
    try:
        if _BROWSER is not None:
            _BROWSER.close()
    except Exception:
        pass
    _BROWSER = None
    try:
        if _PW is not None:
            _PW.stop()
    except Exception:
        pass
    _PW = None
    for s in list(_SERVERS.values()):
        try:
            s.stop()
        except Exception:
            pass
    _SERVERS.clear()


def _major():
    try:
        return browser().version.split(".")[0]
    except Exception:
        return "141"


KINDS = {
    "phone": dict(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True, device_scale_factor=2),
    "desk": dict(viewport={"width": 1280, "height": 800}, has_touch=False, is_mobile=False, device_scale_factor=1),
}


def _ua(kind):
    v = _major()
    if kind == "phone":
        return f"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{v}.0.0.0 Mobile Safari/537.36"
    return f"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{v}.0.0.0 Safari/537.36"


# se ejecuta antes que la app en cada documento: apunta cada evento "route" del bus (la ruta ya pintada)
_HOOK = r"""
(() => {
  if (window.__vocabHook) return; window.__vocabHook = 1;
  window.__vocabRouteN = 0; window.__vocabRouteH = null;
  document.addEventListener("DOMContentLoaded", () => {
    try {
      if (typeof bus === "undefined" || !bus || typeof bus.on !== "function") { window.__vocabNoBus = true; return; }
      bus.on("route", d => { window.__vocabRouteH = String((d && d.h) || ""); window.__vocabRouteN++; });
    } catch (e) { window.__vocabNoBus = true; }
  });
})();
"""

# fallos de red y mensajes de servicios externos que no cuentan como error de la app
EXTERNAL = re.compile(r"accounts\.google\.com|apis\.google\.com|googleapis\.com|gstatic\.com|googleusercontent\.com|google-analytics|doubleclick", re.I)


def _is_local(url, base):
    if not url:
        return True
    if url.startswith(("data:", "blob:", "about:")):
        return True
    return url.startswith(base)


def _attach(page, base):
    """Recoge errores de consola, excepciones y respuestas HTTP >= 400 del propio servidor."""
    if getattr(page, "_vocab_errors", None) is not None:
        return
    page._vocab_errors = []
    page._vocab_base = base
    page._vocab_inflight = set()

    def on_console(msg):
        if msg.type != "error":
            return
        loc = (msg.location or {}).get("url", "") if hasattr(msg, "location") else ""
        text = msg.text
        if EXTERNAL.search(text) or (loc and not _is_local(loc, base)):
            return
        if text.startswith("Failed to load resource") and loc and not _is_local(loc, base):
            return
        page._vocab_errors.append(f"console: {text}" + (f" @ {loc}" if loc else ""))

    def on_pageerror(err):
        text = f"{err}"
        stack = getattr(err, "stack", "") or ""
        if EXTERNAL.search(text) or EXTERNAL.search(stack):
            return
        page._vocab_errors.append(f"pageerror: {text}" + (f"\n{stack}" if stack and stack not in text else ""))

    def on_response(resp):
        try:
            if resp.status >= 400 and _is_local(resp.url, base) and not resp.url.startswith(("data:", "blob:")):
                page._vocab_errors.append(f"http {resp.status}: {resp.url[len(base):]}")
        except Exception:
            pass

    def on_req(req):
        if req.url.startswith(base):
            page._vocab_inflight.add(req)

    def on_done(req):
        page._vocab_inflight.discard(req)

    page.on("console", on_console)
    page.on("pageerror", on_pageerror)
    page.on("response", on_response)
    page.on("request", on_req)
    page.on("requestfinished", on_done)
    page.on("requestfailed", on_done)


def new_context(kind="phone", color_scheme="light", reduced_motion="no-preference", now=FIXED_NOW, root=None,
                host="127.0.0.1", sw=False, block_external=True, server=None, **kw):
    """Contexto de navegador para 'phone' (390×844 táctil, ×2) o 'desk' (1280×800).
    color_scheme: 'light' | 'dark' · reduced_motion: 'reduce' | 'no-preference' · now: datetime, ms o None (hora real)
    sw: False bloquea el service worker (más estable); True lo deja (sirve en localhost: host="localhost").
    server: un Server propio (p. ej. para pararlo y probar sin conexión: context.set_offline no corta las peticiones
    del service worker); por defecto, el compartido de serve(root, host).
    El resto de **kw va a browser.new_context (p. ej. offline=True no: usa context.set_offline)."""
    if kind not in KINDS:
        raise ValueError(f"kind debe ser phone o desk, no {kind!r}")
    srv = server or serve(root, host)
    opts = dict(KINDS[kind])
    opts.update(color_scheme=color_scheme, reduced_motion=reduced_motion, locale=LOCALE, timezone_id=TZ,
                user_agent=_ua(kind), service_workers="allow" if sw else "block")
    opts.update(kw)
    ctx = browser().new_context(**opts)
    ctx._vocab_base = srv.url
    ctx._vocab_kind = kind
    if now is not None:
        ms = now if isinstance(now, (int, float)) else int(now.timestamp() * 1000)
        ctx.clock.install(time=ms / 1000.0)
    ctx.add_init_script(_HOOK)
    if block_external:
        def _route(route):
            if route.request.url.startswith(srv.url) or route.request.url.startswith(("data:", "blob:")):
                route.continue_()
            else:
                route.abort()
        ctx.route("**/*", _route)
    ctx.on("page", lambda p: _attach(p, srv.url))
    ctx.set_default_timeout(20000)
    return ctx


def new_page(kind="phone", **kw):
    """Página nueva en un contexto nuevo (ciérrala con page.context.close())."""
    ctx = new_context(kind, **kw)
    page = ctx.new_page()
    _attach(page, ctx._vocab_base)
    return page


def base_url(page) -> str:
    return getattr(page, "_vocab_base", None) or page.context._vocab_base


def errors(page) -> list:
    """Errores recogidos en esta página desde que se abrió (o desde clear_errors)."""
    return list(getattr(page, "_vocab_errors", []) or [])


def clear_errors(page):
    if getattr(page, "_vocab_errors", None) is not None:
        page._vocab_errors.clear()


# ---------------------------------------------------------------- navegación
def _norm(h) -> str:
    """'#/mapa', '/mapa', 'mapa', '#mapa' → 'mapa' · '', '#', '#/' → ''"""
    h = str(h or "")
    if h.startswith("#"):
        h = h[1:]
    return h.strip("/")


def current_hash(page) -> str:
    try:
        return _norm(page.evaluate("location.hash"))
    except Exception:
        return _norm(urlsplit(page.url).fragment)


def _on_app(page) -> bool:
    base = base_url(page)
    u = page.url
    if not u.startswith(base):
        return False
    path = urlsplit(u).path
    return path in ("", "/", "/index.html")


def _wait_route(page, n0, timeout):
    """Espera un evento "route" nuevo (o, sin bus, a que #app deje de decir «Cargando…»)."""
    try:
        page.wait_for_function(
            """n0 => {
              if (window.__vocabNoBus) { const a = document.getElementById("app");
                return document.readyState === "complete" && !(a && /Cargando/.test(a.textContent || "")); }
              return (window.__vocabRouteN || 0) > n0;
            }""",
            arg=n0, timeout=timeout, polling=50)
        return True
    except Exception:
        return False


def settle(page, quiet_ms=300, max_ms=6000):
    """Espera a que no queden peticiones al servidor durante quiet_ms (como mucho max_ms), a las fuentes,
    a las imágenes visibles y a dos fotogramas."""
    t0 = time.time()
    quiet_since = None
    while (time.time() - t0) * 1000 < max_ms:
        busy = len(getattr(page, "_vocab_inflight", ()) or ())
        if busy == 0:
            quiet_since = quiet_since or time.time()
            if (time.time() - quiet_since) * 1000 >= quiet_ms:
                break
        else:
            quiet_since = None
        page.wait_for_timeout(50)
    try:
        page.evaluate("""async () => {
          /* el paso de una pantalla a otra (js/navmotion.js): mientras dura, los toques no llegan a la página */
          try { if (window.vocabNavMotion) await Promise.race([vocabNavMotion.idle(), new Promise(r => setTimeout(r, 2000))]); } catch (e) {}
          try { await document.fonts.ready; } catch (e) {}
          const vis = i => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; };
          const imgs = [...document.images].filter(i => !i.complete && (i.loading !== "lazy" || vis(i)));
          await Promise.race([
            Promise.all(imgs.map(i => new Promise(r => { i.addEventListener("load", r, {once: true}); i.addEventListener("error", r, {once: true}); }))),
            new Promise(r => setTimeout(r, 3000))]);
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        }""")
    except Exception:
        pass


def goto(page, hash="", reload=False, timeout=20000, settle_ms=300):
    """Va a la ruta (p. ej. "#/mapa", "granja", "" = Hoy) y espera a que pinte.
    Si ya está en la app cambia location.hash (como al tocar un enlace); si la app no deja salir de la ruta
    (guarda de salida) o reload=True, carga la página entera. Devuelve el hash final (sin '#/')."""
    target = _norm(hash)
    base = base_url(page)
    url = f"{base}/#/{target}" if target else f"{base}/"

    def full():
        if _on_app(page) and current_hash(page) == target and urlsplit(page.url).fragment != "":
            page.reload(wait_until="domcontentloaded")
        else:
            page.goto(url, wait_until="domcontentloaded")
        if not _wait_route(page, 0, timeout):
            raise TimeoutError(f"la ruta #/{target} no terminó de pintar en {timeout} ms")

    if reload or not _on_app(page) or current_hash(page) == target:
        full()
    else:
        n0 = page.evaluate("window.__vocabRouteN || 0")
        page.evaluate("h => { location.hash = h; }", "#/" + target)
        ok = _wait_route(page, n0, min(timeout, 8000))
        if not ok or current_hash(page) != target:
            full()
    settle(page, settle_ms)
    return current_hash(page)


def reload(page, settle_ms=300):
    """Recarga la página y espera a que la ruta pinte."""
    page.reload(wait_until="domcontentloaded")
    if not _wait_route(page, 0, 20000):
        raise TimeoutError("la página no terminó de pintar tras recargar")
    settle(page, settle_ms)


# ---------------------------------------------------------------- partida sembrada
def _ms(dt):
    return int(dt.timestamp() * 1000)


def _dumps(v):
    """JSON igual que JSON.stringify (compacto, sin escapar acentos)."""
    return json.dumps(v, separators=(",", ":"), ensure_ascii=False)


def day_key(dt) -> str:
    """dayKey() de la app: fecha local AAAA-MM-DD."""
    return dt.astimezone(ZoneInfo(TZ)).strftime("%Y-%m-%d")


def day_num(dt) -> int:
    """today() de la app: días desde 1970 en hora local."""
    loc = dt.astimezone(ZoneInfo(TZ))
    return math.floor((_ms(loc) + loc.utcoffset().total_seconds() * 1000) / 864e5)


_DOCS: dict = {}


def _doc(i):
    if i not in _DOCS:
        _DOCS[i] = json.loads((REPO / "data" / f"{i}.json").read_text(encoding="utf-8"))
    return _DOCS[i]


def _jload(name):
    return json.loads((REPO / "data" / name).read_text(encoding="utf-8"))


def lesson_sequence(lv="A1", lang_code="en"):
    """Lecciones del nivel en el orden del camino, con las de gramática intercaladas (como lvUnits())."""
    m, g = _jload("map.json"), _jload(f"grammar_{lang_code}.json")
    units, G = m[lv], g.get(lv, [])
    N = sum(len(u["ls"]) for u in units)
    at = [max(1, math.floor((k + 0.5) * N / len(G) + 0.5)) for k in range(len(G))]
    out, n, k = [], 0, 0
    for u in units:
        for l in u["ls"]:
            n += 1
            out.append({"id": l["id"], "doc": u["doc"], "w": l["w"]})
            while k < len(G) and at[k] == n:
                out.append({"id": f"G-{lv}-{k + 1:02d}", "doc": None, "w": None, "t": G[k]["t"]})
                k += 1
    return out


def _lesson_words(lesson, lang):
    seen, out = set(), []
    for d, i in lesson["w"] or []:
        rows = _doc(d)["rows"]
        if i >= len(rows):
            continue
        r = rows[i]
        if not (r.get("es") and (r.get("l") or {}).get(lang)):
            continue
        k = f"{d}|{r['es']}"
        if k in seen:
            continue
        seen.add(k)
        out.append((d, r["es"], k))
    return out


def _uniq(doc_id, lang):
    rows = _doc(doc_id)["rows"]
    return len({r["es"] for r in rows if r.get("es") and (r.get("l") or {}).get(lang)})


# los 10 primeros pasos del camino A1 en inglés (9 de vocabulario + G-A1-01) y sus estrellas
_EN_DONE = 10
_EN_STARS = [3, 3, 2, 3, 3, 2, 3, 1, 2, 3]


def seed_plan(now=FIXED_NOW) -> dict:
    """Datos de la partida de ejemplo (para que las pruebas sepan qué esperar)."""
    seq = lesson_sequence("A1", "en")
    done = seq[:_EN_DONE]
    nxt = seq[_EN_DONE]
    gram_next = next(x for x in seq[_EN_DONE:] if x["id"].startswith("G-"))
    return {"done": [x["id"] for x in done], "next_lesson": nxt["id"], "next_gram": gram_next["id"],
            "done_gram": [x["id"] for x in done if x["id"].startswith("G-")],
            "fr_done": [x["id"] for x in lesson_sequence("A1", "fr")[:2]],
            "lang": "english", "today": day_key(now)}


def seed_data(now=FIXED_NOW) -> dict:
    """La partida de ejemplo como objetos Python {clave: valor} (seed_keys() da los textos de localStorage).
    Inglés: 10 pasos del camino A1 hechos, ~90 palabras en el repaso (12 pendientes hoy, ~29 dominadas), álbum con la
    página de colores completa y 9 pegatinas nuevas; francés: 2 lecciones. Granja con 4 animales (2 con hambre), comida,
    3 plantas y un árbol con fruta. Monedas, racha de 5 días, medallas, regalo del día ya cobrado, misiones a medias,
    récords de 3 juegos."""
    now = now.astimezone(ZoneInfo(TZ))
    T = _ms(now)
    H = 3600 * 1000
    today = day_num(now)
    dk = lambda d: day_key(now - _dt.timedelta(days=d))   # noqa: E731
    seq = lesson_sequence("A1", "en")
    done = seq[:_EN_DONE]

    # ---- camino y repaso (inglés)
    map_en = {x["id"]: s for x, s in zip(done, _EN_STARS)}
    srs_en, voc = {}, [x for x in done if x["w"]]
    pending = 0
    for li, les in enumerate(voc):
        words = _lesson_words(les, "english")
        for wi, (d, es, k) in enumerate(words):
            if li < 3:                       # las primeras: dominadas (caja 4-5), vuelven dentro de 1-20 días
                b = 5 if wi % 4 == 0 else 4
                x = {"d": d, "e": es, "b": b, "due": today + 1 + (wi * 3 + li) % 20, "n": b + 1 + wi % 2}
            elif li < 6:                     # las de en medio: algunas tocan hoy (o se pasaron unos días)
                b = 2 + (wi % 2)
                if pending < 12 and wi % 3 != 2:
                    due = today - (wi % 4)
                    pending += 1
                else:
                    due = today + 2 + wi % 5
                x = {"d": d, "e": es, "b": b, "due": due, "n": b + wi % 3}
            elif li < len(voc) - 1:          # recientes: caja 1-2
                b = 1 + (wi % 2)
                x = {"d": d, "e": es, "b": b, "due": today + (1 if b == 1 else 3), "n": b}
            else:                            # la de hoy: recién añadidas (caja 1, mañana)
                x = {"d": d, "e": es, "b": 1, "due": today + 1, "n": 0}
            srs_en[k] = x
    last_words = {k for _, _, k in _lesson_words(voc[-1], "english")}

    # ---- francés: 2 lecciones hechas, 19 palabras en caja 1-2
    fr_seq = lesson_sequence("A1", "fr")[:2]
    map_fr = {fr_seq[0]["id"]: 3, fr_seq[1]["id"]: 2}
    srs_fr = {}
    for li, les in enumerate(fr_seq):
        for wi, (d, es, k) in enumerate(_lesson_words(les, "français")):
            b = 2 if li == 0 else 1
            srs_fr[k] = {"d": d, "e": es, "b": b, "due": today + 2 + wi % 3, "n": b}

    # ---- álbum (inglés): visto todo menos lo de la última lección; colores completo
    seen_en = {k: (2 if x["b"] >= 4 else 1) for k, x in srs_en.items() if k not in last_words}
    docs_en = sorted({x["d"] for x in srs_en.values()})
    uniq_en = {d: _uniq(d, "english") for d in docs_en}
    album_done = {}
    for d in docs_en:
        have = {x["e"] for x in srs_en.values() if x["d"] == d}
        if len(have) >= uniq_en[d]:
            album_done[d] = dk(3)

    # ---- actividad: racha de 5 días (hoy incluido), antes días sueltos
    act = {}
    for d, n in [(19, 14), (17, 22), (16, 9), (13, 30), (12, 18), (11, 25), (9, 12), (7, 21), (6, 0),
                 (4, 16), (3, 27), (2, 19), (1, 33), (0, 8)]:
        if n:
            act[dk(d)] = n
    act = dict(sorted(act.items()))

    # ---- monedas, compras y medallas
    owned = ["zorro", "gallina", "pato", "conejo", "vaca", "flor", "girasol", "zanahoria", "arbol", "rana", "gorra", "balon"]
    shop = {x["id"]: x for x in _jload("game.json")}
    owned = [i for i in owned if i in shop]
    hats = [i for i in owned if shop[i]["t"] == "hat"]
    wear = {"hero": "zorro"}
    if hats:
        wear["hat"] = hats[0]
    all_map = len(map_en) + len(map_fr)
    les_n = sum(1 for k in list(map_en) + list(map_fr) if "G-" not in k)
    gr_n = sum(1 for k in map_en if "G-" in k)
    three = sum(1 for v in list(map_en.values()) + list(map_fr.values()) if v == 3)
    mast = sum(1 for x in srs_en.values() if x["b"] >= 4)
    farm_n = sum(1 for i in owned if shop[i]["t"] == "farm")
    things = len(owned) - 1
    earned = 640
    streak = 5
    conds = [("l1", les_n, 1), ("l10", les_n, 10), ("l50", les_n, 50), ("l150", les_n, 150), ("g1", gr_n, 1), ("g10", gr_n, 10),
             ("s3", three, 5), ("s20", three, 20), ("r3", streak, 3), ("r7", streak, 7), ("r30", streak, 30),
             ("w50", len(srs_en), 50), ("w300", len(srs_en), 300), ("m25", mast, 25), ("c200", earned, 200),
             ("c1000", earned, 1000), ("f5", farm_n, 5), ("f20", farm_n, 20), ("t10", things, 10)]
    ach = {}
    for i, (aid, v, goal) in enumerate(c for c in conds if c[1] >= c[2]):
        ach[aid] = dk(18 - 2 * i if 18 - 2 * i > 0 else 1)
    game = {"coins": 245, "earned": earned, "owned": {i: True for i in owned}, "wear": wear, "ach": ach, "name": "",
            "gifts": all_map // 5, "day": dk(0)}

    # ---- granja: 4 animales (vaca y conejo con hambre), comida, 3 plantas, un árbol con una pera
    fed = {"gallina": T - 3 * H, "pato": T - 10 * H, "conejo": T - 50 * H, "vaca": T - 30 * H}
    pos = {"gallina": {"x": 22.5, "y": 76.4}, "pato": {"x": 38.2, "y": 84.1}, "conejo": {"x": 61.7, "y": 73.9},
           "vaca": {"x": 79.3, "y": 70.2}, "flor": {"x": 14.6, "y": 90.3}, "girasol": {"x": 47.9, "y": 91.2},
           "zanahoria": {"x": 70.4, "y": 88.6}, "arbol": {"x": 88.1, "y": 62.5}}
    farm = {"welcome": True, "pos": pos, "fed": fed,
            "prod": {"arbol-pera1": {"a": "arbol", "p": "pera", "x": 81.1, "y": 65.0}},
            "pl": {"flor": {"s": 2, "w": T - 6 * H}, "girasol": {"s": 1, "w": T - 1 * H}, "zanahoria": {"s": 0, "w": 0},
                   "arbol": {"s": 2, "w": T - 30 * H}},
            "tree": {"arbol": T - 4 * H},
            "seen": {i: T - (40 - n) * H for n, i in enumerate(i for i in owned if shop[i]["t"] == "farm")},
            "drops": 2, "dn": 0, "hero": {"x": 54.0, "y": 79.5}, "light": True, "fd": {"day": dk(1), "n": 3},
            "pan": {"grano": 3, "zanahoria": 2, "heno": 1}, "shelter": {}, "cv": 1, "visit": T - 20 * H, "lay": 58}

    missions = {"day": dk(0), "list": [
        {"k": "les", "goal": 1, "n": 1, "s": 1, "got": True},
        {"k": "rev", "goal": 10, "n": 4, "s": 4, "got": False},
        {"k": "feed", "goal": 4, "n": 4, "s": 4, "got": False}], "chest": False}

    data = {
        "lang": "english",
        "game": game,
        "act": act,
        "mapLv": "A1",
        "rate": 0.9,
        "mute": False,
        "prPrefs": {"acts": ["escuchar", "leer", "escribir"], "reps": 21},
        "prEx": True,
        "prAuto": True,
        "farm:state": farm,
        "games:best": {"memoria": {"score": 6, "stars": 3, "plays": 4, "tries": 9},
                       "lluvia": {"score": 14, "stars": 2, "plays": 3},
                       "globos": {"score": 8, "stars": 2, "plays": 2}},
        "games:topic": "animales",
        "games:day": {"k": dk(0), "n": 2},
        "buddy:hide": False,
        "buddy:missions": missions,
        "buddy:wotd": {"day": dk(1), "seen": {"english": True}, "known": {"english": True}, "paid": True},
        "album:tab": "temas",
        "srs:english": srs_en,
        "map:english": map_en,
        "album:seen:english": seen_en,
        "album:done:english": album_done,
        "album:uniq:english": uniq_en,
        "srs:français": srs_fr,
        "map:français": map_fr,
    }
    return data


def seed_keys(now=FIXED_NOW) -> dict:
    """La partida de ejemplo como textos de localStorage {clave: JSON}."""
    return {k: _dumps(v) for k, v in seed_data(now).items()}


def seed(page, keys=None, hash="", now=FIXED_NOW, clear=True):
    """Borra localStorage/sessionStorage del origen, escribe la partida (keys = {clave: texto JSON} o, por defecto,
    seed_keys()) antes de que arranque la app y abre la ruta hash. Devuelve las claves escritas."""
    if keys is None:
        keys = seed_keys(now)
    keys = {k: (v if isinstance(v, str) else _dumps(v)) for k, v in keys.items()}
    page.goto(base_url(page) + "/__blank", wait_until="domcontentloaded")
    page.evaluate("""([keys, clear]) => {
      if (clear) { localStorage.clear(); sessionStorage.clear(); }
      for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v);
    }""", [keys, clear])
    goto(page, hash)
    return keys


def storage(page) -> dict:
    """Todo localStorage del origen {clave: texto} (antes, srsFlush(): el repaso se escribe 250 ms después de cambiar)."""
    return page.evaluate("""() => { try { if (typeof srsFlush === 'function') srsFlush(); } catch (e) {}
      return Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])); }""")


# ---------------------------------------------------------------- exportación
def export(page) -> dict:
    """La exportación de la partida tal como la guarda js/save.js: vocabSave.snapshot() =
    {"app": "vocabulary", "v": 1, "saved": ISO, "keys": {clave: texto JSON}} (es lo que se sube a Google Drive)."""
    snap = page.evaluate("() => (window.vocabSave && typeof vocabSave.snapshot === 'function') ? vocabSave.snapshot() : null")
    if snap is None:
        raise RuntimeError("window.vocabSave.snapshot() no existe en esta página")
    return snap


def diff_exports(old, new, allow_new=True) -> list:
    """Diferencias entre dos exportaciones (dicts de export() o solo sus "keys"). Ignora "saved".
    Una clave que falta o un valor distinto siempre es diferencia; una clave nueva solo si allow_new es False
    (o una lista de las claves nuevas permitidas)."""
    a = old.get("keys", old) if isinstance(old, dict) and "keys" in old else old
    b = new.get("keys", new) if isinstance(new, dict) and "keys" in new else new
    out = []
    for k in ("app", "v"):
        if isinstance(old, dict) and isinstance(new, dict) and k in old and k in new and old[k] != new[k]:
            out.append(f"{k}: {old[k]!r} → {new[k]!r}")
    for k in a:
        if k not in b:
            out.append(f"falta la clave {k!r}")
        elif a[k] != b[k]:
            out.append(f"cambia {k!r}: {_short(a[k])} → {_short(b[k])}")
    extra = [k for k in b if k not in a]
    if allow_new is not True:
        ok = set(allow_new or [])
        out += [f"clave nueva {k!r}" for k in extra if k not in ok]
    return out


def import_export(page, snap, timeout=20000) -> dict:
    """Carga una exportación (dict de export() o texto JSON) como lo hace la app al cargar una partida:
    vocabSave.parse() y vocabSave.apply(keys, "load"), que recarga la página. Espera a que la app vuelva a pintar.
    Devuelve {"ok", "n" (claves cargadas), "ignored", "bad", "err"}."""
    text = snap if isinstance(snap, str) else json.dumps(snap, ensure_ascii=False)
    if not _on_app(page):
        goto(page, "")
    res = page.evaluate("""text => {
      const p = vocabSave.parse(text);
      if (!p.ok) return {ok: false, err: p.err};
      return {ok: true, n: Object.keys(p.data.keys).length, ignored: p.ignored, bad: p.bad, keys: p.data.keys};
    }""", text)
    if not res.get("ok"):
        return res
    page.evaluate("() => { window.__vocabOld = 1; }")
    r = page.evaluate("keys => vocabSave.apply(keys, 'load')", res.pop("keys"))
    if r:
        res.update(ok=False, err=r)
        return res
    t0 = time.time()
    while True:   # apply() recarga la página a los ~60 ms: se espera al documento nuevo ya pintado
        try:
            if page.evaluate("() => !window.__vocabOld && (!!window.__vocabNoBus || (window.__vocabRouteN || 0) > 0)"):
                break
        except Exception:
            pass
        if (time.time() - t0) * 1000 > timeout:
            raise TimeoutError("la app no volvió a pintar tras cargar la partida")
        page.wait_for_timeout(50)
    settle(page)
    return res


def new_keys(old, new) -> list:
    a = old.get("keys", old)
    b = new.get("keys", new)
    return [k for k in b if k not in a]


def _short(s, n=160):
    s = str(s)
    return s if len(s) <= n else s[:n] + f"… ({len(s)} car.)"


def load_baseline(path=BASELINE) -> dict | None:
    p = Path(path)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def save_json(obj, path):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=1, sort_keys=False) + "\n", encoding="utf-8")
    return p


# ---------------------------------------------------------------- capturas
def shot(page, name, folder, full_page=None, animations="disabled"):
    """Captura PNG en folder/name.png. full_page: None = sí en phone, no en desk. Carga antes las imágenes perezosas.
    Devuelve la ruta."""
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    if full_page is None:
        full_page = getattr(page.context, "_vocab_kind", "phone") == "phone"
    if full_page:
        try:
            page.evaluate("""async () => {
              document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = "eager"; });
              const imgs = [...document.images].filter(i => !i.complete);
              await Promise.race([
                Promise.all(imgs.map(i => new Promise(r => { i.addEventListener("load", r, {once: true}); i.addEventListener("error", r, {once: true}); }))),
                new Promise(r => setTimeout(r, 4000))]);
            }""")
        except Exception:
            pass
    path = folder / (name if name.endswith(".png") else name + ".png")
    page.screenshot(path=str(path), full_page=full_page, animations=animations)
    return path
