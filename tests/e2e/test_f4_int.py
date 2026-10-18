"""F4 entero (integración): la tienda común (js/shop.js), Juegos y «Oído de lince» (js/games.js, js/lince.js), la
granja a pantalla completa (js/farm.js), Premios y Mi zorro con el álbum nuevo (js/rewards.js, js/album.js) y las
temporadas (js/season.js) juntos sobre la app de F3.

Se comprueba: el orden de carga de los módulos nuevos (detrás del script principal, de motion.js y gestures.js; shop.js
antes que farm.js, lince.js detrás de games.js y rewards.js detrás de album.js) y lo que registran antes del primer
route(); sw.js en la versión 19 o más con OFF_SHELL igual, los ficheros nuevos en SHELL y OFF_APP y cada <script> de la
app con «?v=<VERSION>» (al publicar, una recarga con la caché HTTP de GitHub Pages no mezcla un index.html nuevo con
módulos viejos); save.js con la clave "season" y toda clave que la app escribe en localStorage registrada; «Descargar
todo» con los dibujos de la tienda, de Juegos y de las temporadas. Cada ruta de F4 por enlace directo, al recargar y
navegando (pestañas, segmentos, la fila de la temporada). La granja vende solo cosas de la granja y Mi zorro solo
trajes; lo que se compra en uno se ve en el otro (el sombrero en el personaje de la granja, el animal en la escena); la
pastilla de monedas abre la hoja de la tienda desde cualquier pestaña. Recorridos con la partida sembrada: los 5 juegos
seguidos (award una vez cada uno); la granja (comer arrastrando, regar arrastrando, mover, comprar) y lo guardado tras
recargar; Premios › Medallas (detalle) y Mi zorro; Halloween (Hoy › Truco o trato › granja con calabazas, y nada con
?season=off) y el adviento; francés y danés en juegos, lince, granja, tienda y Mi zorro. Una vuelta por todo F4 sin
jugar deja la partida como la base. Y la actualización desde la versión publicada (main, sw vocab-v13): la partida y
la granja siguen intactas y se carga la app nueva, también sin conexión y con la caché HTTP de GitHub Pages."""
from __future__ import annotations

import atexit
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from zoneinfo import ZoneInfo

import common as C
import test_f4_granja as GR
import test_f4_juegos as J
import test_f4_temporadas as T

_MODS = ["js/shop.js", "js/lince.js", "js/rewards.js", "js/season.js"]
_DATA = ["data/lince.json", "data/season.json"]
_ROUTE_N = "() => window.__vocabRouteN || 0"
_GAME = "() => JSON.parse(localStorage.getItem('game'))"
_FARM = "() => JSON.parse(localStorage.getItem('farm:state'))"
_STORE = "() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))"
_TZ = ZoneInfo(C.TZ)
# la versión publicada antes del rediseño (commit 1721796, sw vocab-v13): la carpeta de VOCAB_BASE si se da (una copia
# de ese commit, p. ej. un git worktree) y, si no, se saca del repo con git archive a una carpeta temporal
_BASE_COMMIT = "1721796"
_BASE_DIRS = [Path(p) for p in [os.environ.get("VOCAB_BASE", "")] if p]
_BASE_TMP = {}
_LOOK = """() => { const t = document.querySelector('.tabbar [role=tab][aria-selected=true]'), s = document.querySelector('#tabhead .seg-i[aria-selected=true]');
  const vis = el => !!el && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  return {focus: document.documentElement.dataset.focus || '', tab: t && t.dataset.nav, seg: vis(s) ? s.textContent.replace(/\\d+/g, '').trim() : null,
    tabbar: vis(document.getElementById('tabbar')), title: document.title}; }"""


def _wait_route(page, n0, timeout=8000):
    page.wait_for_function("n => (window.__vocabRouteN || 0) > n", arg=n0, timeout=timeout)
    C.settle(page, quiet_ms=200)


def _click_nav(page, sel):
    n0 = page.evaluate(_ROUTE_N)
    page.locator(sel).first.click()
    _wait_route(page, n0)


def _keys(now=C.FIXED_NOW, **top):
    k = C.seed_keys(now)
    for n, v in top.items():
        k[n] = json.dumps(v, ensure_ascii=False, separators=(",", ":"))
    return k


def _no_hints(page):
    """Las pistas de gestos ya vistas (que no tapen nada en los recorridos)."""
    page.evaluate("""() => { let o = {}; try { o = JSON.parse(localStorage.getItem('vocab:ui') || '{}') || {}; } catch (e) {}
      o.hints = Object.assign({}, o.hints, {'gm-peek': 1000, 'al-swipe': 1000, 'fm-regadera': 1000}); localStorage.setItem('vocab:ui', JSON.stringify(o)); }""")


def _tags(html):
    return re.findall(r'<script src="([^"]+)"></script>', html)


def _sw_version():
    sw = (C.REPO / "sw.js").read_text(encoding="utf-8")
    return int(re.search(r"const VERSION = (\d+);", sw).group(1)), sw


# ---------------------------------------------------------------- carga, sw.js y save.js
def test_modules_load_order_sw_and_save():
    """index.html carga js/shop.js, js/lince.js, js/rewards.js y js/season.js una vez, detrás del script principal, de
    motion.js y de gestures.js (shop.js antes que farm.js, lince.js justo detrás de games.js, rewards.js detrás de
    album.js); al primer route() ya están ROUTES.granja, progreso, mizorro y temporada, vocabShop, vocabGames (con lince),
    vocabRewards, vocabSeason, vocabFarm y vocabAlbum, los segmentos «Medallas · Mi zorro», la temporada en la pestaña Hoy
    y su HOME_SLOT. sw.js va por la versión 19 o más, con OFF_SHELL igual; SHELL y OFF_APP llevan los módulos y los datos
    nuevos (y son la misma lista); cada <script src="js/…"> de index.html y privacy.html lleva «?v=<VERSION>». save.js
    registra "season" (objeto) y deja vocab:ui fuera de la partida."""
    probs = []
    html = (C.REPO / "index.html").read_text(encoding="utf-8")
    priv = (C.REPO / "privacy.html").read_text(encoding="utf-8")
    v, sw = _sw_version()
    if v < 19:
        probs.append(f"sw.js sigue en la versión {v} (F4 sube a 19 o más)")
    if f'OFF_SHELL = "vocab-shell-v{v}"' not in html:
        probs.append(f"OFF_SHELL de index.html no es vocab-shell-v{v}")
    # «?v=<VERSION>» en cada script local: una versión nueva nunca coge un módulo viejo de la caché HTTP
    for name, src in (("index.html", html), ("privacy.html", priv)):
        for s in _tags(src):
            if s.startswith(("http:", "https:", "//")):
                continue
            if not s.endswith(f"?v={v}"):
                probs.append(f"{name}: <script src=\"{s}\"> no lleva ?v={v}")
    tags = [s.split("?")[0] for s in _tags(html)]
    main_end = html.find("</script>", html.find("async function route("))
    for m in _MODS:
        if tags.count(m) != 1:
            probs.append(f"index.html carga {m} {tags.count(m)} veces")
            continue
        if html.find(f'<script src="{m}') < main_end:
            probs.append(f"{m} carga antes que el script principal")
        for dep in ("js/motion.js", "js/gestures.js"):
            if tags.index(dep) > tags.index(m):
                probs.append(f"{m} carga antes que {dep}")
    for a, b in (("js/shop.js", "js/farm.js"), ("js/games.js", "js/lince.js"), ("js/album.js", "js/rewards.js")):
        if a in tags and b in tags and tags.index(a) > tags.index(b):
            probs.append(f"{a} tiene que cargar antes que {b}")
    if "js/games.js" in tags and "js/lince.js" in tags and tags.index("js/lince.js") != tags.index("js/games.js") + 1:
        probs.append("js/lince.js no va justo detrás de js/games.js")
    shell = re.findall(r'"([^"]+)"', re.search(r"const SHELL = \[(.*?)\];", sw, re.S).group(1))
    off = re.findall(r'"([^"]+)"', re.search(r"const OFF_APP = \[(.*?)\];", html, re.S).group(1))
    for f in _MODS + _DATA + ["js/farm.js", "js/games.js", "js/album.js"]:
        if f not in shell:
            probs.append(f"falta {f} en SHELL de sw.js")
        if f not in off:
            probs.append(f"falta {f} en OFF_APP de index.html")
    if sorted(shell) != sorted(off):
        probs.append(f"SHELL y OFF_APP no son la misma lista: {sorted(set(shell) ^ set(off))}")
    if not re.search(r'\bseason: "o"', (C.REPO / "js" / "save.js").read_text(encoding="utf-8")):
        probs.append('js/save.js no registra la clave "season" como objeto (EXACT)')
    page = C.new_page("phone")
    try:
        page.add_init_script("""document.addEventListener('DOMContentLoaded', () => { try { window.__atBoot = {
            routes: Object.keys(ROUTES).sort(), shop: typeof window.vocabShop, games: window.vocabGames ? vocabGames.list().map(g => g.id || g) : null,
            rewards: typeof window.vocabRewards, season: typeof window.vocabSeason, farm: typeof window.vocabFarm, album: typeof window.vocabAlbum,
            segs: (TABS.find(t => t.id === 'premios').segs || []).map(s => s.t + ' ' + s.h), hoy: TABS.find(t => t.id === 'hoy').secs,
            slot: HOME_SLOTS.some(f => f && f.id === 'season')}; } catch (e) { window.__atBoot = {err: String(e)}; } }, {capture: true});""")
        C.seed(page)
        boot = page.evaluate("window.__atBoot")
        if not boot or boot.get("err"):
            probs.append(f"no se pudo ver el estado al arrancar: {boot}")
        else:
            for r in ("granja", "progreso", "mizorro", "temporada", "juegos", "album"):
                if r not in boot["routes"]:
                    probs.append(f"al primer route() falta ROUTES.{r}: {boot['routes']}")
            for k in ("shop", "rewards", "season", "farm", "album"):
                if boot[k] != "object":
                    probs.append(f"al primer route() falta window.vocab{k.capitalize()}: {boot[k]}")
            if not boot["games"] or "lince" not in json.dumps(boot["games"]):
                probs.append(f"vocabGames no tiene «lince» al arrancar: {boot['games']}")
            if boot["segs"] != ["Medallas #/progreso", "Mi zorro #/mizorro"]:
                probs.append(f"segmentos de Premios: {boot['segs']}")
            if "temporada" not in boot["hoy"] or not boot["slot"]:
                probs.append(f"la temporada no está en la pestaña Hoy o en HOME_SLOTS: {boot['hoy']} {boot['slot']}")
        inv = page.evaluate("() => ({season: vocabSave.typeOf('season'), ui: vocabSave.typeOf('vocab:ui'), dev: vocabSave.inventory.deviceOnly})")
        if inv["season"] != "o" or inv["ui"] is not None or "vocab:ui" not in inv["dev"]:
            probs.append(f"inventario de save.js: {inv}")
        for css in ("css-shop", "css-rewards", "css-season"):
            C.goto(page, {"css-shop": "#/mizorro", "css-rewards": "#/progreso", "css-season": "#/temporada?season=halloween"}[css])
            if page.locator(f"style#{css}").count() != 1:
                probs.append(f"<style id={css}> está {page.locator(f'style#{css}').count()} veces")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_every_written_key_is_registered_and_download_has_new_drawings():
    """Tras usar todo F4 (jugar Oído de lince, comprar en la granja y en Mi zorro, abrir puertas de Halloween, el
    adviento, despegar pegatinas), cada clave de localStorage que la app escribe está en el inventario de js/save.js
    (exacta, por idioma, prácticas, solo del aparato o propia del módulo): ninguna se perdería al exportar o se colaría
    sin control. «Descargar todo» guarda también los dibujos de la tienda (img/shop), de Juegos (img/games) y de las
    temporadas (img/season, vía vocabSeason.images())."""
    probs = []
    page = T._page("phone", now=T.OCT)
    try:
        # primero Oído de lince (con los ganchos de Juegos, que oyen los audios) y después Halloween (los de temporadas
        # cambian say() por uno mudo)
        C.seed(page, T._keys(T.OCT), now=T.OCT)
        _no_hints(page)
        C.goto(page, "#/juegos")
        page.evaluate(J._HOOKS)
        J._start(page, "lince")
        J._play_lince(page)
        J._to_menu(page)
        page.evaluate(T._SPY)
        C.goto(page, "#/temporada")
        T._door(page, 0)
        C.goto(page, "#/granja")
        page.evaluate("() => vocabFarm.openShop()")
        page.wait_for_selector("#fm-shop[open] .sc[data-id]", timeout=6000)
        page.evaluate("() => vocabShop.buy(vocabShop.items('farm').filter(x => !vocabShop.owned(x.id)).sort((a, b) => a.p - b.p)[0].id)")
        page.keyboard.press("Escape")
        C.goto(page, "#/mizorro")
        page.evaluate("() => vocabShop.buy(vocabShop.items('hat').filter(x => !vocabShop.owned(x.id)).sort((a, b) => a.p - b.p)[0].id)")
        C.goto(page, "#/album/familia")
        if page.locator("#al-pall").count():
            page.locator("#al-pall").click()
            page.wait_for_timeout(800)
        C.goto(page, "#/temporada?season=advent")
        page.wait_for_selector(".ss-cal .ss-w", timeout=6000)
        C.goto(page, "#/?season=auto")
        bad = page.evaluate("""() => Object.keys(localStorage).filter(k => !vocabSave.typeOf(k) && !vocabSave.inventory.deviceOnly.includes(k)
            && !vocabSave.inventory.meta.includes(k))""")
        if bad:
            probs.append(f"claves de localStorage que save.js no conoce: {bad}")
        imgs = page.evaluate("async () => (window.vocabSeason && vocabSeason.images) ? await vocabSeason.images() : null")
        if not imgs:
            probs.append("vocabSeason.images() no existe o está vacío")
        else:
            need = sorted("img/season/" + p.name for p in (C.REPO / "img" / "season").glob("*.png"))
            miss = [u for u in need if u not in imgs]
            if miss:
                probs.append(f"vocabSeason.images() no lleva {miss}")
        # «Descargar todo» de verdad (sin audios, que son muchos: se quitan del mapa del idioma)
        page.evaluate("() => { window.audioIds = async () => []; }")
        res = page.evaluate("""async () => { await downloadAll(); for (let i = 0; i < 600 && offJob && !offJob.end; i++) await new Promise(r => setTimeout(r, 100));
          const m = await caches.open('vocab-media'), have = new Set((await m.keys()).map(r => new URL(r.url).pathname));
          return {end: offJob ? offJob.end : 'sin trabajo', shop: have.has('/img/shop/gorra.png'), games: have.has('/img/games/lince.png'),
            season: have.has('/img/season/pumpkin.png') && have.has('/img/season/angel.png')}; }""")
        if not (res["shop"] and res["games"] and res["season"]):
            probs.append(f"«Descargar todo» no guarda los dibujos nuevos: {res}")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- rutas: enlace directo, recarga y navegación
_F4_ROUTES = [
    # (hash, lo que tiene que verse, modo foco, pestaña, segmento)
    ("#/juegos", "#gm-cards .gm-card", "", "jugar", "Juegos"),
    ("#/juegos/lince", ".gm-intro, #ln", "juego", "jugar", None),
    ("#/album", "#app .al-sum", "", "jugar", "Álbum"),
    ("#/album/colores", "#al-page", "", "jugar", None),
    ("#/granja", "#app .fm-stage .fm-it", "", "granja", None),
    ("#/progreso", "#rw .rw-meds .rw-m", "", "premios", "Medallas"),
    ("#/mizorro", "#mz-shop .sc", "", "premios", "Mi zorro"),
    ("#/temporada", "#ss-street .ss-door", "", "hoy", None),
    ("#/temporada/cosas", "#app .ss-stks .ss-stk", "", "hoy", None),
]


def _check_route(page, h, sel, focus, tab, seg, how, probs):
    try:
        page.wait_for_selector(sel, timeout=8000)
    except Exception:
        probs.append(f"{how} {h}: no se ve {sel} (#/{C.current_hash(page)})")
        return
    page.wait_for_timeout(200)
    st = page.evaluate(_LOOK)
    if st["focus"] != focus:
        probs.append(f"{how} {h}: modo foco «{st['focus']}» (se esperaba «{focus}»)")
    if tab and st["tab"] != tab:
        probs.append(f"{how} {h}: pestaña {st['tab']} (se esperaba {tab})")
    if seg and st["seg"] != seg:
        probs.append(f"{how} {h}: segmento «{st['seg']}» (se esperaba «{seg}»)")
    if C.current_hash(page) != h[2:]:
        probs.append(f"{how} {h}: acaba en #/{C.current_hash(page)}")


def test_f4_routes_direct_reload_and_navigation():
    """En pleno Halloween (17 de octubre, sin forzar nada): cada ruta de F4 (Juegos, Oído de lince, Álbum y una página,
    Granja, Medallas, Mi zorro, Truco o trato y «Mis cosas») se pinta abierta desde cero, al recargar y navegando: Jugar ›
    Álbum › un tema › «‹ Álbum»; Granja; Premios › Mi zorro › Medallas; Hoy › fila «Truco o trato» › «Mis cosas» ›
    «‹ Hoy»; con la pestaña, el segmento y el modo foco que tocan. Sin errores."""
    probs = []
    page = C.new_page("phone", now=T.OCT)
    try:
        C.seed(page, now=T.OCT)
        _no_hints(page)
        for h, sel, focus, tab, seg in _F4_ROUTES:
            C.goto(page, h, reload=True)
            _check_route(page, h, sel, focus, tab, seg, "enlace directo", probs)
            C.reload(page)
            _check_route(page, h, sel, focus, tab, seg, "recarga", probs)
        # cada pestaña recuerda su última pantalla: se empieza con Jugar en Juegos y Premios en Medallas
        C.goto(page, "#/juegos")
        C.goto(page, "#/progreso")
        C.goto(page, "", reload=True)
        _click_nav(page, "#tab-jugar")
        _check_route(page, "#/juegos", "#gm-cards .gm-card", "", "jugar", "Juegos", "navegando", probs)
        _click_nav(page, '#tabhead .seg-i[href="#/album"]')
        _check_route(page, "#/album", "#app .al-sum", "", "jugar", "Álbum", "navegando", probs)
        _click_nav(page, '#app a[href="#/album/colores"]')
        _check_route(page, "#/album/colores", "#al-page", "", "jugar", None, "navegando", probs)
        _click_nav(page, "#app a.al-bk")
        _check_route(page, "#/album", "#app .al-sum", "", "jugar", "Álbum", "navegando («‹ Álbum»)", probs)
        _click_nav(page, "#tab-granja")
        _check_route(page, "#/granja", "#app .fm-stage .fm-it", "", "granja", None, "navegando", probs)
        _click_nav(page, "#tab-premios")
        _check_route(page, "#/progreso", "#rw .rw-meds .rw-m", "", "premios", "Medallas", "navegando", probs)
        _click_nav(page, '#tabhead .seg-i[href="#/mizorro"]')
        _check_route(page, "#/mizorro", "#mz-shop .sc", "", "premios", "Mi zorro", "navegando", probs)
        _click_nav(page, '#tabhead .seg-i[href="#/progreso"]')
        _check_route(page, "#/progreso", "#rw .rw-meds .rw-m", "", "premios", "Medallas", "navegando", probs)
        _click_nav(page, "#tab-hoy")
        page.wait_for_selector("#ss-row", timeout=6000)
        _click_nav(page, "#ss-row")
        _check_route(page, "#/temporada", "#ss-street .ss-door", "", "hoy", None, "navegando (fila de Hoy)", probs)
        _click_nav(page, '#app a[href="#/temporada/cosas"]')
        _check_route(page, "#/temporada/cosas", "#app .ss-stks .ss-stk", "", "hoy", None, "navegando", probs)
        _click_nav(page, "#app a.ss-back")
        if C.current_hash(page) != "" or not page.locator("#ss-row").count():
            probs.append(f"«‹ Hoy» no vuelve a Hoy con la fila de la temporada: #/{C.current_hash(page)}")
        # la pestaña Hoy marcada en la temporada vuelve a Hoy al tocarla
        C.goto(page, "#/temporada")
        _click_nav(page, "#tab-hoy")
        if C.current_hash(page) != "":
            probs.append(f"tocar Hoy desde la temporada no vuelve a Hoy: #/{C.current_hash(page)}")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- tienda: granja sin trajes, Mi zorro con ellos
_SHEET_IDS = "() => [...document.querySelectorAll('#fm-shop .sc[data-id]')].map(c => c.dataset.id)"


def _mz_ids(page):
    out = []
    for t in page.evaluate("() => [...document.querySelectorAll('#mz-seg .seg-i[data-t]')].map(b => b.dataset.t)"):
        page.locator(f'#mz-seg .seg-i[data-t="{t}"]').click()
        page.wait_for_function("t => document.querySelector('#mz-shop .sc') && [...document.querySelectorAll('#mz-shop .sc')].every(c => c.dataset.t === t)", arg=t, timeout=4000)
        out += page.evaluate("() => [...document.querySelectorAll('#mz-shop .sc[data-id]')].map(c => c.dataset.id)")
    return out


def test_farm_sells_farm_things_and_mizorro_outfits():
    """La pastilla de monedas abre la hoja de la tienda de la granja desde Hoy, Juegos, Álbum, Medallas, Mi zorro y la
    temporada (va a #/granja y la abre) y en la granja la abre sin moverse. La hoja tiene las 29 cosas de la granja y la
    comida, ningún traje; Mi zorro, las 35 piezas de personajes, sombreros, gafas, juguetes y mascotas, ninguna de la
    granja. Comprar un animal en la hoja resta su precio una vez y sale en la escena sin volver a montarla; comprar un
    sombrero en Mi zorro resta una vez, se lo pone (arriba con saltito) y el personaje de la granja lo lleva. Sin errores."""
    probs = []
    page = C.new_page("phone", reduced_motion="reduce")
    try:
        C.seed(page, _keys(game=dict(C.seed_data()["game"], coins=600)))
        _no_hints(page)
        page.evaluate(GR._HOOKS)
        for h in ("#/", "#/juegos", "#/album", "#/progreso", "#/mizorro", "#/temporada?season=halloween", "#/granja"):
            C.goto(page, h)
            n0 = page.evaluate(_ROUTE_N)
            page.locator("[data-coins-pill]").click()
            if h != "#/granja":
                _wait_route(page, n0)
            try:
                page.wait_for_selector("#fm-shop[open] .sc[data-id]", timeout=6000)
            except Exception:
                probs.append(f"desde {h}, la pastilla de monedas no abre la hoja de la tienda (#/{C.current_hash(page)})")
                continue
            if C.current_hash(page) != "granja":
                probs.append(f"desde {h}, la tienda se abre fuera de la granja: #/{C.current_hash(page)}")
            page.keyboard.press("Escape")
            page.wait_for_function("() => !document.querySelector('#fm-shop[open]')", timeout=4000)
        page.evaluate("() => vocabFarm.openShop()")
        page.wait_for_selector("#fm-shop[open] .sc[data-id]", timeout=6000)
        page.evaluate("() => { document.getElementById('fm-shop').dataset.detent = 'large'; }")
        page.wait_for_timeout(300)
        # en la granja todo el vidrio es ligero (sin desenfoque), también la hoja de la tienda
        bf = page.evaluate("""() => [...document.querySelectorAll('*')].filter(e => { const cs = getComputedStyle(e);
          return cs.backdropFilter && cs.backdropFilter !== 'none' && e.getClientRects().length; }).map(e => e.id || e.className)""")
        if bf:
            probs.append(f"en la granja, con la hoja de la tienda abierta, hay desenfoque (tiene que ser vidrio ligero): {bf}")
        # y la hoja, que lleva contenido, es opaca: no se transparenta la escena
        bg = page.evaluate("() => getComputedStyle(document.getElementById('fm-shop')).backgroundColor")
        if not re.fullmatch(r"rgb\(\d+, \d+, \d+\)", bg):
            probs.append(f"la hoja de la tienda de la granja no es opaca: {bg}")
        sheet = page.evaluate(_SHEET_IDS)
        farm = page.evaluate("() => vocabShop.items('farm').map(x => x.id)")
        zorro = page.evaluate("() => vocabShop.items('zorro').map(x => x.id)")
        if len(farm) != 29 or len(zorro) != 35:
            probs.append(f"vocabShop: {len(farm)} cosas de la granja y {len(zorro)} trajes (se esperaban 29 y 35)")
        if sorted(sheet) != sorted(farm):
            probs.append(f"la hoja de la granja no tiene justo las cosas de la granja: sobran {sorted(set(sheet) - set(farm))}, faltan {sorted(set(farm) - set(sheet))}")
        if not page.locator("#fm-shop [data-fbuy]").count():
            probs.append("la hoja de la granja no tiene la comida")
        # comprar un animal: una vez, sale en la escena sin volver a montar la granja
        page.evaluate("() => { window.__stage0 = document.querySelector('#app .fm-stage'); }")
        buy = page.evaluate("() => vocabShop.items('farm').filter(x => !vocabShop.owned(x.id) && vocabShop.state(x) === 'buy').map(x => ({id: x.id, p: x.p}))[0]")
        c0 = page.evaluate(_GAME)["coins"]
        btn = page.locator(f'#fm-shop .sc[data-id="{buy["id"]}"] [data-buy]')
        btn.scroll_into_view_if_needed()
        btn.click()
        page.wait_for_timeout(700)
        g = page.evaluate(_GAME)
        if g["coins"] != c0 - buy["p"] or not g["owned"].get(buy["id"]):
            probs.append(f"comprar {buy['id']} en la hoja: monedas {c0} → {g['coins']} (precio {buy['p']}), comprado {g['owned'].get(buy['id'])}")
        sc = page.evaluate("id => ({it: !!document.querySelector(`#app .fm-stage .fm-it[data-fid=\"${id}\"]`), same: window.__stage0 === document.querySelector('#app .fm-stage'), open: !!document.querySelector('#fm-shop[open]')})", buy["id"])
        if not sc["it"] or not sc["same"] or not sc["open"]:
            probs.append(f"tras comprar {buy['id']}: en la escena {sc['it']}, misma escena {sc['same']}, hoja abierta {sc['open']}")
        page.keyboard.press("Escape")
        # Mi zorro: solo trajes; comprar un sombrero se lo pone y la granja lo enseña
        C.goto(page, "#/mizorro")
        mz = _mz_ids(page)
        if sorted(mz) != sorted(zorro):
            probs.append(f"Mi zorro no tiene justo los trajes: sobran {sorted(set(mz) - set(zorro))}, faltan {sorted(set(zorro) - set(mz))}")
        if buy["id"] in mz:
            probs.append(f"Mi zorro enseña {buy['id']} (de la granja)")
        hat = page.evaluate("() => vocabShop.items('hat').filter(x => !vocabShop.owned(x.id) && vocabShop.state(x) === 'buy').map(x => ({id: x.id, p: x.p, e: x.e}))[0]")
        page.locator('#mz-seg .seg-i[data-t="hat"]').click()
        page.wait_for_selector(f'#mz-shop .sc[data-id="{hat["id"]}"] [data-buy]', timeout=4000)
        c1 = page.evaluate(_GAME)["coins"]
        b = page.locator(f'#mz-shop .sc[data-id="{hat["id"]}"] [data-buy]')
        b.scroll_into_view_if_needed()
        b.click()
        page.wait_for_timeout(800)
        g = page.evaluate(_GAME)
        if g["coins"] != c1 - hat["p"] or g["wear"].get("hat") != hat["id"]:
            probs.append(f"comprar {hat['id']} en Mi zorro: monedas {c1} → {g['coins']} (precio {hat['p']}), puesto {g['wear'].get('hat')}")
        top = page.evaluate("() => { const h = document.querySelector('#mz-fox .h-hat'); return h ? h.textContent.trim() : null; }")
        if top != hat["e"]:
            probs.append(f"el personaje de Mi zorro no lleva {hat['id']}: {top!r}")
        C.goto(page, "#/granja")
        page.wait_for_selector("#app .fm-hero", timeout=6000)
        fh = page.evaluate("() => { const h = document.querySelector('#app .fm-hero .h-hat'); return h ? h.textContent.trim() : null; }")
        if fh != hat["e"]:
            probs.append(f"el personaje de la granja no lleva el sombrero comprado en Mi zorro: {fh!r} (se esperaba {hat['e']})")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- recorridos con la partida sembrada
def test_all_games_in_a_row():
    """Jugar › los 5 juegos seguidos en la misma visita (Memoria, Lluvia, Globos, Letras y Oído de lince) hasta el
    resultado: cada uno en modo foco, paga una vez por finish() (award desde «+N») y vuelve al menú sin modo foco; las
    monedas suben exactamente lo pagado y games:best guarda los 5. Después la granja y Premios se pintan bien (sin
    temporizadores de un juego colándose). Sin errores."""
    probs = []
    page = C.new_page("phone")
    try:
        J._open(page)
        c0 = page.evaluate(_GAME)["coins"]
        for g in J.GAMES:
            n0 = len(page.evaluate("() => __aw"))
            J._start(page, g)
            if page.evaluate("() => document.documentElement.dataset.focus || ''") != "juego":
                probs.append(f"{g}: no va en modo foco")
            J.DRIVERS[g](page)
            page.wait_for_timeout(500)
            aw = page.evaluate("() => __aw")[n0:]
            if len(aw) != 1 or aw[0]["from"] != "gm-plus" or aw[0]["n"] <= 0:
                probs.append(f"{g}: award al terminar: {aw}")
            J._to_menu(page)
            st = page.evaluate("() => ({focus: document.documentElement.dataset.focus || '', play: document.documentElement.dataset.gmPlay || '', tab: !!document.getElementById('tabbar').getClientRects().length})")
            if st["focus"] or st["play"] or not st["tab"]:
                probs.append(f"{g}: al volver al menú sigue el modo foco: {st}")
        aw = page.evaluate("() => __aw")
        c1 = page.evaluate(_GAME)["coins"]
        paid = sum(a["n"] for a in aw)
        if c1 - c0 < paid:
            probs.append(f"monedas: {c0} → {c1} con {paid} pagadas en las partidas ({aw})")
        best = page.evaluate(J._BEST)
        miss = [g for g in J.GAMES if g not in best]
        if miss:
            probs.append(f"games:best no guarda {miss}: {list(best)}")
        for h, sel in (("#/granja", "#app .fm-stage .fm-it"), ("#/progreso", "#rw .rw-meds"), ("#/juegos", "#gm-cards .gm-card")):
            C.goto(page, h)
            try:
                page.wait_for_selector(sel, timeout=6000)
            except Exception:
                probs.append(f"tras jugar, {h} no pinta {sel}")
        page.wait_for_timeout(1500)
        if C.current_hash(page) != "juegos":
            probs.append(f"algo de una partida cambió la ruta: #/{C.current_hash(page)}")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_farm_tour_drag_water_move_buy_and_reload():
    """Granja con la partida sembrada, en la misma visita: arrastrar la zanahoria de la bandeja hasta el conejo (come:
    una ración menos, s.fed a ahora, «¿Cómo me llamo?»), arrastrar la regadera hasta la zanahoria (crece), mantener la
    gallina y moverla (farm:state.pos), y comprar en la hoja (Tienda del dock) una cosa de la granja que sale en la escena.
    Tras recargar, todo sigue: la posición, la comida, la planta, la compra. Sin errores."""
    probs = []
    page = GR._page("phone", reduced_motion="reduce")
    try:
        C.seed(page, _keys(game=dict(C.seed_data()["game"], coins=600)))
        _no_hints(page)
        page.evaluate(GR._HOOKS)
        C.goto(page, "#/granja")
        page.wait_for_selector("#app .fm-stage .fm-it", timeout=6000)
        page.wait_for_timeout(400)
        f0 = page.evaluate(_FARM)
        t0 = page.evaluate("Date.now()")
        # comer arrastrando
        GR._tap(page, '#app .fm-dock [data-fm="food"]')
        page.wait_for_selector('#app .fm-tray [data-pfood="zanahoria"]', timeout=3000)
        page.wait_for_timeout(300)
        GR._drag(page, '#app .fm-tray [data-pfood="zanahoria"]', GR._it("conejo"))
        try:
            page.wait_for_selector('#app .fm-pop[data-kind="quiz"]:not([hidden])', timeout=9000)
        except Exception:
            probs.append("arrastrar la zanahoria al conejo no termina en «¿Cómo me llamo?»")
        f1 = page.evaluate(_FARM)
        if f1["pan"].get("zanahoria") != f0["pan"]["zanahoria"] - 1 or f1["fed"]["conejo"] < t0:
            probs.append(f"comer arrastrando: zanahoria {f0['pan']['zanahoria']} → {f1['pan'].get('zanahoria')}, fed {f1['fed']['conejo']}")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        if page.locator('#app .fm-tray:not([hidden])').count() and page.locator('#app .fm-tray').is_visible():
            GR._tap(page, '#app .fm-dock [data-fm="food"]')
            page.wait_for_timeout(300)
        # regar arrastrando
        GR._drag(page, '#app .fm-dock [data-fm="water"]', GR._it("zanahoria"))
        page.wait_for_timeout(1100)
        f2 = page.evaluate(_FARM)
        if f2["pl"]["zanahoria"]["s"] != f0["pl"]["zanahoria"]["s"] + 1 or f2["pl"]["zanahoria"]["w"] < t0:
            probs.append(f"regar arrastrando: {f0['pl']['zanahoria']} → {f2['pl']['zanahoria']}")
        # mover la gallina
        page.evaluate("() => { const b = document.querySelector('#app .fm-bub'); if (b) b.hidden = true; }")
        x, y = GR._center(page, GR._it("gallina"))
        page.mouse.move(x, y)
        page.mouse.down()
        page.wait_for_timeout(650)
        for i in range(1, 11):
            page.mouse.move(x - 6 * i, y - 4 * i)
            page.wait_for_timeout(16)
        page.mouse.up()
        page.wait_for_timeout(400)
        p3 = page.evaluate(_FARM)["pos"]["gallina"]
        if p3 == f0["pos"]["gallina"]:
            probs.append("mantener y mover la gallina no la mueve")
        # comprar en la hoja (Tienda del dock)
        GR._tap(page, '#app .fm-dock [data-fm="shop"]')
        page.wait_for_selector("#fm-shop[open] .sc[data-id]", timeout=6000)
        page.evaluate("() => { document.getElementById('fm-shop').dataset.detent = 'large'; }")
        page.wait_for_timeout(300)
        buy = page.evaluate("() => vocabShop.items('farm').filter(x => !vocabShop.owned(x.id) && vocabShop.state(x) === 'buy').map(x => ({id: x.id, p: x.p}))[0]")
        c0 = page.evaluate(_GAME)["coins"]
        b = page.locator(f'#fm-shop .sc[data-id="{buy["id"]}"] [data-buy]')
        b.scroll_into_view_if_needed()
        b.click()
        page.wait_for_timeout(700)
        if page.evaluate(_GAME)["coins"] != c0 - buy["p"]:
            probs.append(f"comprar {buy['id']}: {c0} → {page.evaluate(_GAME)['coins']} (precio {buy['p']})")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        before = page.evaluate(_FARM)
        C.reload(page)
        page.wait_for_selector(f'#app .fm-it[data-fid="{buy["id"]}"]', timeout=9000)
        after = page.evaluate(_FARM)
        for k in ("pos", "pan", "fed", "pl"):
            if before.get(k) != after.get(k):
                probs.append(f"tras recargar cambia farm:state.{k}: {before.get(k)} → {after.get(k)}")
        left = page.evaluate("() => parseFloat(document.querySelector('#app .fm-it[data-fid=gallina]').style.left)")
        if abs(left - after["pos"]["gallina"]["x"]) > .2:
            probs.append(f"tras recargar la gallina no está donde se dejó: left {left} / {after['pos']['gallina']}")
        if not page.evaluate(_GAME)["owned"].get(buy["id"]):
            probs.append(f"tras recargar {buy['id']} no está comprado")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_premios_medal_detail_and_mizorro():
    """Premios › Medallas: tocar una medalla ganada y una que falta abre su hoja de detalle (y se cierra con «Listo» y
    con Esc); el segmento «Mi zorro» enseña el personaje con lo que lleva; elegir la rana (comprada) la pone de
    personaje sin gastar monedas y Medallas sigue igual al volver. Sin errores."""
    probs = []
    page = C.new_page("phone", reduced_motion="reduce")
    try:
        C.seed(page)
        C.goto(page, "#/progreso")
        page.wait_for_selector("#rw .rw-meds .rw-m", timeout=6000)
        for sel in ("#rw .rw-meds .rw-m:has(.rw-mc.ok)", "#rw .rw-meds .rw-m:has(.rw-mc.lock)"):
            loc = page.locator(sel).first
            loc.scroll_into_view_if_needed()
            loc.click()
            try:
                page.wait_for_selector("dialog#rw-sheet[open] #rw-sh-t", timeout=4000)
            except Exception:
                probs.append(f"tocar {sel} no abre la hoja de la medalla")
                continue
            t = page.locator("#rw-sh-t").inner_text()
            page.locator("dialog#rw-sheet [data-close]").click()
            page.wait_for_function("() => !document.querySelector('dialog#rw-sheet[open]')", timeout=4000)
            if not t.strip():
                probs.append(f"la hoja de {sel} no tiene título")
        page.locator("#rw .rw-meds .rw-m").first.click()
        page.wait_for_selector("dialog#rw-sheet[open]", timeout=4000)
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.querySelector('dialog#rw-sheet[open]')", timeout=4000)
        _click_nav(page, '#tabhead .seg-i[href="#/mizorro"]')
        page.wait_for_selector("#mz-fox .hero", timeout=6000)
        c0 = page.evaluate(_GAME)["coins"]
        page.locator('#mz-seg .seg-i[data-t="hero"]').click()
        page.wait_for_selector('#mz-shop .sc[data-id="rana"] [data-wear]', timeout=4000)
        page.locator('#mz-shop .sc[data-id="rana"] [data-wear]').click()
        page.wait_for_timeout(800)
        g = page.evaluate(_GAME)
        if g["wear"].get("hero") != "rana" or g["coins"] != c0:
            probs.append(f"elegir la rana: personaje {g['wear'].get('hero')}, monedas {c0} → {g['coins']}")
        name = page.locator("#mz-name").inner_text().strip()
        if name.lower() != "rana":
            probs.append(f"Mi zorro no enseña la rana arriba: «{name}»")
        _click_nav(page, '#tabhead .seg-i[href="#/progreso"]')
        page.wait_for_selector("#rw .rw-meds .rw-m", timeout=6000)
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_halloween_today_trick_or_treat_and_farm_pumpkins():
    """17 de octubre (Halloween por la fecha): Hoy tiene la fila «Truco o trato» sin scroll; tocarla abre la calle, una
    puerta acertada suma un caramelo a la bolsa y guarda "season"; la pestaña Granja enseña 4 calabazas y 2 murciélagos en
    .fm-season (debajo de los animales, sin toques) y los animales se siguen tocando. Con ?season=off no hay fila ni
    calabazas, y con ?season=auto vuelven. En diciembre: «Calendario» en Hoy, el calendario con 24 ventanitas y la granja
    sin calabazas. Sin errores."""
    probs = []
    page = T._page("phone", now=T.OCT)
    try:
        T._open(page, T.OCT, hash="")
        page.wait_for_selector("#ss-row", timeout=6000)
        fit = page.evaluate(T._FIT)
        if fit["sh"] > fit["ih"] + 1:
            probs.append(f"Hoy con la fila de Halloween tiene scroll: {fit}")
        if "Truco o trato" not in page.locator("#ss-row").inner_text():
            probs.append(f"la fila de Hoy no dice «Truco o trato»: {page.locator('#ss-row').inner_text()!r}")
        _click_nav(page, "#ss-row")
        page.wait_for_selector("#ss-street .ss-door", timeout=6000)
        T._door(page, 0)
        st = page.evaluate(T._ST)
        if st["street"]["run"]["ok"] != [0] or page.locator("#ss-bag-n").inner_text().strip() != "1":
            probs.append(f"la puerta acertada no suma a la bolsa: {st['street']['run']} / {page.locator('#ss-bag-n').inner_text()}")
        if not st["saved"]:
            probs.append("acertar una puerta no guarda la clave season")
        _click_nav(page, "#tab-granja")
        page.wait_for_selector("#app .fm-stage .fm-it", timeout=6000)
        page.wait_for_timeout(500)
        deco = page.evaluate("""() => { const s = document.querySelector('#app .fm-season'), cs = getComputedStyle(s);
          const z = q => +getComputedStyle(document.querySelector('#app ' + q)).zIndex;
          return {pump: s.querySelectorAll('img[src$="pumpkin.png"]').length, bats: s.querySelectorAll('img[src$="bat.png"]').length,
            pe: cs.pointerEvents, below: z('.fm-season') < z('.fm-layer') && z('.fm-season') > z('.fm-ground'),
            loaded: [...s.querySelectorAll('img')].every(i => i.complete && i.naturalWidth > 0)}; }""")
        if deco["pump"] != 4 or deco["bats"] != 2 or deco["pe"] != "none" or not deco["below"] or not deco["loaded"]:
            probs.append(f"la granja en Halloween: {deco}")
        GR._tap(page, GR._it("gallina"))
        page.wait_for_timeout(400)
        if page.locator("#app .fm-bub").is_hidden():
            probs.append("con las calabazas, tocar la gallina no la acaricia")
        C.goto(page, "#/?season=off")
        if page.locator("#ss-row").count():
            probs.append("con ?season=off sigue la fila de la temporada en Hoy")
        C.goto(page, "#/granja")
        page.wait_for_selector("#app .fm-stage .fm-it", timeout=6000)
        if page.locator("#app .fm-season img").count():
            probs.append("con ?season=off la granja sigue con calabazas")
        C.goto(page, "#/?season=auto")
        page.wait_for_selector("#ss-row", timeout=6000)
        if C.errors(page):
            probs.append(f"octubre: errores {C.errors(page)}")
    finally:
        page.context.close()
    page = T._page("phone", now=T.DEC)
    try:
        T._open(page, T.DEC, hash="")
        page.wait_for_selector("#ss-row", timeout=6000)
        if "Calendario" not in page.locator("#ss-row").inner_text():
            probs.append(f"en diciembre la fila no es el calendario: {page.locator('#ss-row').inner_text()!r}")
        _click_nav(page, "#ss-row")
        page.wait_for_selector(".ss-cal .ss-w", timeout=6000)
        n = page.locator(".ss-cal .ss-w").count()
        today = page.locator(".ss-cal .ss-w.is-today").count()
        if n != 24 or today != 1:
            probs.append(f"el calendario tiene {n} ventanitas y {today} de hoy")
        C.goto(page, "#/granja")
        page.wait_for_selector("#app .fm-stage .fm-it", timeout=6000)
        if page.locator("#app .fm-season img").count():
            probs.append("en diciembre la granja tiene calabazas")
        if C.errors(page):
            probs.append(f"diciembre: errores {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_french_and_danish_games_lince_farm_and_shop():
    """En francés y en danés: el menú de Juegos, una partida de Memoria y Oído de lince enteros con sus audios del
    idioma (award una vez cada una), las palabras de Lince con lang del idioma; la granja dice el hambre en ese idioma
    («J'ai faim !» / «Jeg er sulten!») con su voz; la hoja de la tienda y Mi zorro escriben las palabras en ese idioma
    (lang) y el álbum se pinta. Sin errores."""
    probs = []
    for lang, code, phrase in (("français", "fr", "J'ai faim !"), ("dansk", "da", "Jeg er sulten!")):
        page = C.new_page("phone", reduced_motion="reduce")
        page.add_init_script(GR._SPEECH)
        try:
            J._open(page, _keys(lang=lang))
            if page.evaluate("() => lang") != lang:
                probs.append(f"{lang}: la app no arranca en {lang}")
            n0 = len(page.evaluate("() => __aw"))
            J._start(page, "memoria")
            J._play_memoria(page)
            page.wait_for_timeout(400)
            J._to_menu(page)
            J._start(page, "lince")
            page.wait_for_function(J._LN_READY, timeout=8000)
            langs = page.evaluate("() => [...document.querySelectorAll('#ln [lang]')].map(e => e.getAttribute('lang'))")
            if not langs or any(not l.startswith(code) for l in langs):
                probs.append(f"{lang}: Lince escribe palabras con lang {sorted(set(langs))}")
            res = J._play_lince(page)
            srcs = [p["src"] for p in page.evaluate("() => __played")]
            if not srcs or any(not s.startswith(f"audio/{code}/") for s in srcs if s.startswith("audio/")):
                probs.append(f"{lang}: Lince suena audios de otro idioma: {sorted(set(s.split('/')[1] for s in srcs if s.startswith('audio/')))}")
            page.wait_for_timeout(400)
            aw = page.evaluate("() => __aw")[n0:]
            if len(aw) != 2:
                probs.append(f"{lang}: memoria y lince no pagan una vez cada una: {aw}")
            if len(res) != 8:
                probs.append(f"{lang}: Lince no tuvo 8 rondas: {len(res)}")
            J._to_menu(page)
            C.goto(page, "#/granja")
            page.wait_for_selector("#app .fm-stage .fm-it", timeout=6000)
            try:
                page.wait_for_function("t => __spoken.some(s => s.text === t)", arg=phrase, timeout=8000)
            except Exception:
                probs.append(f"{lang}: la granja no dice «{phrase}»: {page.evaluate('() => __spoken')}")
            page.evaluate("() => vocabFarm.openShop()")
            page.wait_for_selector("#fm-shop[open] .sc[data-id]", timeout=6000)
            ws = page.evaluate("""() => [...document.querySelectorAll('#fm-shop .sc[data-id]')].map(c => { const w = c.querySelector('.shp-w');
              return {id: c.dataset.id, w: w && w.textContent.trim(), lang: w && w.getAttribute('lang'), want: vocabShop.word(c.dataset.id)}; })""")
            bad = [w for w in ws if not w["w"] or w["w"] != w["want"] or not (w["lang"] or "").startswith(code)]
            if bad:
                probs.append(f"{lang}: palabras de la hoja de la tienda: {bad[:4]}")
            page.keyboard.press("Escape")
            C.goto(page, "#/mizorro")
            ws = page.evaluate("() => [...document.querySelectorAll('#mz-shop .shp-w')].map(w => [w.textContent.trim(), w.getAttribute('lang')])")
            if not ws or any(not w or not (l or "").startswith(code) for w, l in ws):
                probs.append(f"{lang}: palabras de Mi zorro: {ws[:4]}")
            C.goto(page, "#/album")
            page.wait_for_selector("#app .al-sum", timeout=6000)
            if C.errors(page):
                probs.append(f"{lang}: errores {C.errors(page)}")
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_f4_tour_keeps_export():
    """Una vuelta por todo F4 sin jugar ni comprar (Juegos con la hoja de tema y un vistazo, el álbum y una página con su
    hoja de temas, la granja con la bandeja y la hoja de la tienda, Medallas con una hoja, Mi zorro y sus tipos, Truco o
    trato y «Mis cosas» forzando Halloween, la granja con calabazas) deja la partida exportada como la de la base: solo
    cambia la hora de la visita a la granja (y la caché album:uniq), sin claves nuevas."""
    probs = []
    base = C.load_baseline()
    assert base, "falta tests/e2e/baseline/export.json"
    page = C.new_page("phone", reduced_motion="reduce")
    try:
        C.seed(page)
        _no_hints(page)
        C.goto(page, "#/juegos")
        page.locator("#gm-tpill").click()
        page.wait_for_selector("dialog#gm-tp-s[open]", timeout=4000)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        page.evaluate("() => vocabGames.peek('memoria')")
        page.wait_for_selector("dialog#gm-peek[open]", timeout=4000)
        page.keyboard.press("Escape")
        C.goto(page, "#/album")
        C.goto(page, "#/album/familia")
        page.evaluate("() => vocabAlbum.openTopics()")
        page.wait_for_selector("dialog#al-tp-s[open]", timeout=4000)
        page.keyboard.press("Escape")
        C.goto(page, "#/granja")
        page.wait_for_selector("#app .fm-stage .fm-it", timeout=6000)
        GR._tap(page, '#app .fm-dock [data-fm="food"]')
        page.wait_for_timeout(300)
        GR._tap(page, '#app .fm-dock [data-fm="food"]')
        page.evaluate("() => vocabFarm.openShop()")
        page.wait_for_selector("#fm-shop[open]", timeout=4000)
        page.keyboard.press("Escape")
        C.goto(page, "#/progreso")
        page.locator("#rw .rw-meds .rw-m").first.click()
        page.wait_for_selector("dialog#rw-sheet[open]", timeout=4000)
        page.keyboard.press("Escape")
        C.goto(page, "#/mizorro")
        _mz_ids(page)
        C.goto(page, "#/temporada?season=halloween")
        page.wait_for_selector("#ss-street .ss-door", timeout=6000)
        C.goto(page, "#/temporada/cosas")
        C.goto(page, "#/granja")
        page.wait_for_selector("#app .fm-season img", timeout=6000)
        C.goto(page, "#/?season=auto")
        snap = C.export(page)
        d = C.diff_exports(base, snap, allow_new=False)
        allowed = []
        for x in d:
            if x.startswith("cambia 'album:uniq:"):
                continue
            if x.startswith("cambia 'farm:state'"):
                a, b = json.loads(base["keys"]["farm:state"]), json.loads(snap["keys"]["farm:state"])
                a.pop("visit", None), b.pop("visit", None)
                if a == b:
                    continue
                x += " · " + ", ".join(k for k in set(a) | set(b) if a.get(k) != b.get(k))
            allowed.append(x)
        if allowed:
            probs.append("la partida cambia tras la vuelta por F4:\n  " + "\n  ".join(allowed))
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- actualización desde la versión publicada
def _is_base(d):
    return (d / "index.html").exists() and (d / "sw.js").exists() and 'CACHE = "vocab-v13"' in (d / "sw.js").read_text(encoding="utf-8")


def _base_dir():
    for d in _BASE_DIRS:
        if _is_base(d):
            return d
    if "dir" not in _BASE_TMP:
        # git archive solo lee el repo: no toca la rama, el índice ni los worktrees
        d = Path(tempfile.mkdtemp(prefix="vocab-base-"))
        arch = subprocess.run(["git", "-C", str(C.REPO), "archive", "--format=tar", _BASE_COMMIT], capture_output=True)
        if arch.returncode == 0:
            subprocess.run(["tar", "-x", "-C", str(d)], input=arch.stdout, check=True)
            atexit.register(shutil.rmtree, d, True)
        _BASE_TMP["dir"] = d
    d = _BASE_TMP["dir"]
    return d if _is_base(d) else None


# lo que se ve de cada módulo: si está la versión nueva de cada uno (un index.html nuevo con un módulo viejo se rompe)
_NEW = """() => ({tabbar: !!document.getElementById('tabbar'), granja: typeof ROUTES !== 'undefined' && !!ROUTES.granja,
  album: typeof window.vocabAlbum === 'object', games: !!(window.vocabGames && vocabGames.register), buddy: !!(window.vocabBuddy && vocabBuddy.misHtml),
  shop: typeof window.vocabShop === 'object', rewards: typeof window.vocabRewards === 'object', season: typeof window.vocabSeason === 'object',
  sync: !!(window.vocabSync && vocabSync.go), save: !!(window.vocabSave && vocabSave.inventory)})"""


def _published_then_new(gh_cache):
    """Sirve la versión publicada (con su service worker vocab-v13) y la partida sembrada; el niño la usa (Hoy, granja,
    álbum, juegos, Premios, un tema). Luego, en el mismo origen, se publica esta versión y el niño vuelve. gh_cache: el
    servidor manda «Cache-Control: max-age=600» como GitHub Pages (y se deja la caché HTTP del navegador); el niño
    recarga en menos de 10 minutos. Devuelve una lista de problemas."""
    probs = []
    base_dir = _base_dir()
    assert base_dir, f"no se pudo sacar la versión publicada (commit {_BASE_COMMIT}) con git archive; VOCAB_BASE=<copia de ese commit>"
    roots = {"cur": base_dir}

    class Handler(C._Quiet):
        def __init__(self, *a, directory=None, **kw):
            super().__init__(*a, directory=str(roots["cur"]), **kw)

        def end_headers(self):
            if gh_cache:
                self.send_header("Cache-Control", "max-age=600")
                super(C._Quiet, self).end_headers()
            else:
                super().end_headers()

    tag = "caché de GitHub Pages" if gh_cache else "sin caché HTTP"
    srv = C.Server(base_dir, "localhost", handler=Handler)
    # con rutas de Playwright Chromium no usa su caché HTTP: para la de GitHub Pages no se cortan los dominios de fuera
    ctx = C.new_context("phone", sw=True, server=srv, block_external=not gh_cache)
    page = ctx.new_page()
    stopped = False
    try:
        C.seed(page)
        page.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=20000)
        C.reload(page)
        for h in ("#/granja", "#/album", "#/juegos", "#/progreso", "#/doc/animales", "#/"):
            C.goto(page, h)
            page.wait_for_timeout(250)
        keys0 = page.evaluate("() => caches.keys()")
        if keys0 != ["vocab-v13"] or page.evaluate("() => !!document.getElementById('tabbar')"):
            probs.append(f"{tag}: la versión publicada no es la de antes (cachés {keys0})")
        old = page.evaluate(_STORE)
        # (los iconos de la app no son media: van en el shell nuevo)
        old_media = page.evaluate("async () => (await (await caches.open('vocab-v13')).keys()).map(r => new URL(r.url).pathname).filter(p => /\\.(png|mp3)$/.test(p) && !p.includes('/icons/'))")
        # se publica esta versión
        roots["cur"] = C.ROOT
        C.clear_errors(page)
        if gh_cache:
            page.reload(wait_until="domcontentloaded")    # recarga en menos de 10 minutos (Safari: tirar hacia abajo)
        else:
            page.goto(C.base_url(page) + "/", wait_until="domcontentloaded")   # vuelve otro día
        page.wait_for_function("() => (window.__vocabRouteN || 0) > 0", timeout=20000)
        page.wait_for_timeout(800)
        first = page.evaluate(_NEW)
        if not all(first.values()):
            probs.append(f"{tag}: la primera carga tras publicar mezcla versiones o es la vieja: {first}")
        t0 = time.time()
        while time.time() - t0 < 25:
            keys = page.evaluate("() => caches.keys()")
            if any(k.startswith("vocab-shell-v") for k in keys) and "vocab-v13" not in keys:
                break
            page.wait_for_timeout(250)
        v, _ = _sw_version()
        if f"vocab-shell-v{v}" not in keys or "vocab-media" not in keys or "vocab-v13" in keys:
            probs.append(f"{tag}: el service worker nuevo no se instaló o no borró vocab-v13: {keys}")
        media = set(page.evaluate("async () => (await (await caches.open('vocab-media')).keys()).map(r => new URL(r.url).pathname)"))
        lost_media = [p for p in old_media if p not in media]
        if lost_media:
            probs.append(f"{tag}: dibujos o audios de vocab-v13 que no pasaron a vocab-media: {lost_media[:5]}")
        C.reload(page)
        again = page.evaluate(_NEW)
        if not all(again.values()):
            probs.append(f"{tag}: tras recargar con el sw nuevo no está la app nueva entera: {again}")
        ctrl = page.evaluate("() => navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL")
        if not ctrl:
            probs.append(f"{tag}: la página no la controla el service worker nuevo")
        # la partida y la granja intactas
        C.goto(page, "#/granja")
        page.wait_for_selector("#app .fm-stage .fm-it", timeout=9000)
        page.wait_for_timeout(400)
        farm = json.loads(old["farm:state"])
        shop = {x["id"]: x for x in json.loads((C.ROOT / "data" / "game.json").read_text(encoding="utf-8"))}
        owned_farm = sorted(i for i in json.loads(old["game"])["owned"] if shop.get(i, {}).get("t") == "farm")
        scene = page.evaluate("() => [...document.querySelectorAll('#app .fm-layer > .fm-it[data-fid]')].map(e => e.dataset.fid)")
        if sorted(scene) != owned_farm:
            probs.append(f"{tag}: la granja nueva no enseña lo comprado: {sorted(scene)} ≠ {owned_farm}")
        # (los sitios guardados se comparan abajo en farm:state; en la escena los animales pasean y el árbol se
        # acerca un poco al centro para caber en el móvil, como antes)
        if json.loads(page.evaluate("() => localStorage.getItem('farm:state')"))["pos"] != farm["pos"]:
            probs.append(f"{tag}: cambian los sitios guardados de la granja")
        new = page.evaluate(_STORE)
        for k in sorted(set(old) | set(new)):
            if k in ("vocab:ui",) or k.startswith("album:uniq:"):
                continue
            if old.get(k) != new.get(k):
                if k == "farm:state":
                    a, b = json.loads(old[k]), json.loads(new.get(k) or "{}")
                    a.pop("visit", None), b.pop("visit", None)
                    if a == b:
                        continue
                    probs.append(f"{tag}: cambia farm:state: {[x for x in set(a) | set(b) if a.get(x) != b.get(x)]}")
                elif k not in old:
                    probs.append(f"{tag}: clave nueva {k}")
                else:
                    probs.append(f"{tag}: cambia o falta {k}")
        base = C.load_baseline()
        d = [x for x in C.diff_exports(base, C.export(page), allow_new=False)
             if not x.startswith("cambia 'album:uniq:") and not x.startswith("cambia 'farm:state'")]
        if d:
            probs.append(f"{tag}: la exportación tras actualizar no es la de la base: {d}")
        for h, sel in (("#/juegos", "#gm-cards .gm-card"), ("#/album", "#app .al-sum"), ("#/progreso", "#rw .rw-meds"), ("#/mizorro", "#mz-shop .sc")):
            C.goto(page, h)
            try:
                page.wait_for_selector(sel, timeout=8000)
            except Exception:
                probs.append(f"{tag}: tras actualizar {h} no pinta")
        errs = C.errors(page)
        if errs:
            probs.append(f"{tag}: errores tras publicar: {errs[:5]}")
        # sin conexión: el servidor parado sirve la app nueva desde vocab-shell
        srv.stop()
        stopped = True
        ctx.set_offline(True)
        C.clear_errors(page)
        C.reload(page)
        offl = page.evaluate(_NEW)
        if not all(offl.values()):
            probs.append(f"{tag}: sin conexión no sale la app nueva entera: {offl}")
        for h, sel in (("#/granja", "#app .fm-stage .fm-it"), ("#/juegos", "#gm-cards .gm-card")):
            C.goto(page, h)
            try:
                page.wait_for_selector(sel, timeout=8000)
            except Exception:
                probs.append(f"{tag}: sin conexión {h} no pinta")
    finally:
        try:
            ctx.set_offline(False)
        except Exception:  # noqa: BLE001
            pass
        ctx.close()
        if not stopped:
            srv.stop()
    return probs


def test_update_from_published_version():
    """Un niño con la versión publicada (main, commit 1721796: sw vocab-v13 y sus claves) y la partida sembrada abre la
    app nueva otro día: se carga la app nueva entera (todos sus módulos), el sw nuevo se instala (vocab-shell-vN y
    vocab-media, sin vocab-v13, con sus dibujos y audios pasados a vocab-media) y controla la página; la partida queda
    igual (cada clave, y la exportación como la base; solo la hora de la visita a la granja), la granja enseña lo comprado
    en su sitio; Juegos, Álbum, Medallas y Mi zorro pintan; y sin conexión sale la app nueva. Sin errores."""
    probs = _published_then_new(gh_cache=False)
    assert not probs, "\n".join(probs)


def test_update_with_github_pages_http_cache():
    """Lo mismo con las cabeceras de GitHub Pages (Cache-Control: max-age=600) y la caché HTTP del navegador: el niño
    tenía la app abierta al publicar y recarga en menos de 10 minutos. Con el sw viejo, el index.html nuevo llega por la
    red; sus módulos llevan «?v=<VERSION>», así que tampoco salen de la caché HTTP (antes salían js/farm.js, js/album.js,
    js/games.js y js/buddy.js viejos: «imgHtml is not defined» y la granja, el álbum y los juegos rotos). La primera
    carga ya es la app nueva entera y sin errores."""
    probs = _published_then_new(gh_cache=True)
    assert not probs, "\n".join(probs)
