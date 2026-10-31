"""F5 entero (integración): «Tus atajos» de Hoy (js/shortcuts.js), el teclado en toda la app y los atajos de la app
instalada (js/keys.js, manifest «shortcuts»), el Buzón del tío (js/mailbox.js) y Frases mágicas con «La frase de la
cena» (js/phrases.js) juntos sobre la app de F4.

Se comprueba: el orden de carga de los cuatro módulos (detrás del script principal, de motion.js y de gestures.js;
keys.js justo detrás de gestures.js) y lo que registran antes del primer route(); sw.js en la versión 20 o más con
OFF_SHELL igual, cada <script> de index.html y privacy.html con «?v=<VERSION>», y los ficheros nuevos (los módulos,
data/phrases.json, los iconos de los atajos y los dibujos nuevos de Juegos) en SHELL y en OFF_APP; save.js con sc:prefs,
mail:box y phrase:stamps en la partida y vocab:sc y phrase:day solo del aparato, e IndexedDB nunca en la partida.
Cada ruta nueva por enlace directo, al recargar y navegando (#/buzon, #/buzon/responder, #/carta?d=…, #/frases,
#/frases/cena, los enlaces de los atajos y las URL de los atajos del manifest). Hoy con todo a la vez (atajos, carta sin
abrir, refugio, temporada y frase de la cena; Google ya no tiene fila): el orden de prioridad de HOME_SLOTS (carta >
refugio > temporada > frase de la cena > el resto) y sin scroll a 390×844 claro y oscuro, en un móvil bajo, en tableta y
en el escritorio; también con el accesorio «Seguir» (una lección a medias), que sale o se va después de pintar Hoy. El
teclado en las pantallas nuevas (Buzón, Frases, la carta y las teclas 1-4 de los atajos) sin que
nada se dispare dos veces. Un recorrido con la partida sembrada en inglés, francés y danés: Hoy, una lección con el
teclado, 3 partidas que hacen un atajo, Frases mágicas con su sello, grabar y mandar al Buzón (simulado), contestar
como mayor y abrir la carta en otra pestaña. Una vuelta sin hacer nada deja la partida como la base. Y la actualización
desde la versión publicada (main 2e7dc3f, sw vocab-shell-v19) en el mismo origen: la partida, la granja y la temporada
siguen intactas y se carga la app nueva entera, también con la caché HTTP de GitHub Pages y sin conexión. Además, las
capturas de F5 con nombre descriptivo (capturas/F5/F5-*.png) con su auditoría de contraste y paleta."""
from __future__ import annotations

import atexit
import base64
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
import routes as R
import test_f4_int as I4
import test_f4_temporadas as T
import test_f5_atajos as SC
import test_f5_buzon as BZ
import test_f5_teclado as K

OUT = C.CAPTURAS / "F5"
_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
_TZ = ZoneInfo(C.TZ)
_MODS = ["js/keys.js", "js/shortcuts.js", "js/mailbox.js", "js/phrases.js"]
_FILES = _MODS + ["data/phrases.json", "icons/sc-repasar.png", "icons/sc-camino.png", "icons/sc-juegos.png",
                  "icons/sc-granja.png", "img/games/buzon.png", "img/games/frases.png"]
_AB = {"english": "en", "français": "fr", "dansk": "da"}
HALLOWEEN = dt.datetime(2026, 10, 28, 10, 0, 0, tzinfo=_TZ)      # en plena temporada de Halloween (por la fecha)
_ROUTE_N = "() => window.__vocabRouteN || 0"
_COINS = "() => game().coins"
_SLOTS = "() => [...document.querySelectorAll('#hm-slots > .hm-slot')].filter(e => !e.hidden).map(e => e.dataset.slot || '?')"
_FIT = "() => ({sh: document.documentElement.scrollHeight, ih: innerHeight})"
_TAB = """() => { const t = document.querySelector('.tabbar [role=tab][aria-selected=true]'); return t ? t.dataset.nav : null; }"""
_SCROW = "() => [...document.querySelectorAll('#hm-sc .sc-p')].map(a => ({k: a.dataset.sc || 'half', href: a.getAttribute('href'), key: a.dataset.key}))"
_PASS = "() => sessionStorage.setItem('vocab:gate', String(Date.now() + adultGate.MS))"
_HINTS = {"hints": {"sc-hold": 1000, "gm-peek": 1000, "al-swipe": 1000, "fm-regadera": 1000}}
_FINISH = SC._FINISH
# una carta sin abrir (regalo de 20 monedas) y otra con candado
LET = {"v": 1, "id": "cartaTodo001", "from": "Tío Juan", "to": "Lucía", "msg": "Well done! I am so proud of you.", "lang": "en", "gift": 20}
LOCK = {"v": 1, "id": "cartaLlave01", "from": "Abuela", "msg": "Keep going! You can do it.", "lang": "en", "lock": "les3"}


def _sc(day, ab="en"):
    """vocab:sc con tres atajos de ese idioma ya hechos (puntos de hoy)."""
    return {"v": 1, "k": {f"{ab}/juego:globos:animales": {"s": 4, "t": day}, f"{ab}/juego:memoria:w03": {"s": 3, "t": day},
                          f"{ab}/tema:w02:test": {"s": 2.5, "t": day}}, "row": {}, "o": {}, "sl": ""}


def _keys(now=C.FIXED_NOW, sc=True, shelter=False, lang=None, **top):
    k = C.seed_keys(now)
    if sc:
        k["vocab:sc"] = json.dumps(_sc(C.day_num(now), _AB.get(lang or "english", "en")))
    k["vocab:ui"] = json.dumps(_HINTS)
    if shelter:
        f = json.loads(k["farm:state"])
        f["shelter"] = {"gallina": {"t": int(now.timestamp() * 1000) - 3600 * 1000, "seen": False}}
        k["farm:state"] = json.dumps(f)
    if lang:
        k["lang"] = json.dumps(lang, ensure_ascii=False)
    for n, v in top.items():
        k[n.replace("__", ":")] = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    return k


def _wait_route(page, n0, timeout=8000):
    page.wait_for_function("n => (window.__vocabRouteN || 0) > n", arg=n0, timeout=timeout)
    C.settle(page, quiet_ms=200)


def _click_nav(page, sel):
    n0 = page.evaluate(_ROUTE_N)
    page.locator(sel).first.click()
    _wait_route(page, n0)


def _fits(page, tag, probs):
    m = page.evaluate(_FIT)
    if m["sh"] > m["ih"] + 1:
        probs.append(f"{tag}: Hoy necesita scroll ({m['sh']} > {m['ih']})")


def _gate_if_open(page, ms=1500):
    """Si se abre la Puerta de mayores, la pasa con su suma (si la Puerta sigue abierta de antes, no sale)."""
    try:
        page.wait_for_selector("dialog#gate[open]", timeout=ms)
    except Exception:  # noqa: BLE001
        return False
    BZ._pass_gate(page)
    return True


def _reply_form(page):
    """#/buzon/responder hasta el formulario: «Soy mayor» y la Puerta (si la Puerta se pasó hace poco, sale ya)."""
    C.goto(page, "#/buzon/responder")
    page.wait_for_selector("#mb-gate-go, #mb-f", timeout=6000)
    if page.locator("#mb-gate-go").count():
        page.locator("#mb-gate-go").click()
        _gate_if_open(page)
    page.wait_for_selector("#mb-f", timeout=6000)


def _hoy(page):
    """Vuelve a Hoy pasando por otra pantalla (Hoy se pinta de nuevo) y espera a la fila de atajos y a sus HOME_SLOTS."""
    C.goto(page, "#/juegos")
    C.goto(page, "")
    page.wait_for_timeout(500)
    page.evaluate(_FINISH)


# ---------------------------------------------------------------- carga, sw.js, save.js y manifest
def test_modules_load_order_sw_save_and_manifest():
    """index.html carga js/keys.js (justo detrás de gestures.js), js/shortcuts.js, js/mailbox.js y js/phrases.js una
    vez, detrás del script principal, de motion.js y de gestures.js (los tres últimos detrás de games.js, shop.js, sync.js
    y review.js, que usan). Al primer route() ya están ROUTES.buzon, carta y frases, vocabKeys, vocabShortcuts,
    vocabMailbox, vocabMedia y vocabPhrases, las tarjetas «Buzón del tío» y «Frases mágicas» en vocabGames, los
    HOME_SLOTS "mail" y "phrase" y las secciones de Jugar. sw.js va por la versión 21 o más con OFF_SHELL igual, cada
    <script> de index.html y privacy.html lleva «?v=<VERSION>», y SHELL = OFF_APP con los ficheros nuevos. save.js:
    sc:prefs, mail:box y phrase:stamps en la partida (objetos); vocab:sc y phrase:day solo del aparato. El manifest
    trae los 4 atajos dentro de su scope con iconos que existen."""
    probs = []
    html = (C.REPO / "index.html").read_text(encoding="utf-8")
    priv = (C.REPO / "privacy.html").read_text(encoding="utf-8")
    v, sw = I4._sw_version()
    if v < 21:
        probs.append(f"sw.js sigue en la versión {v} (F5 con fix-voces y fix-imagenes-movil sube a 21 o más)")
    if f'OFF_SHELL = "vocab-shell-v{v}"' not in html:
        probs.append(f"OFF_SHELL de index.html no es vocab-shell-v{v}")
    for name, src in (("index.html", html), ("privacy.html", priv)):
        for s in I4._tags(src):
            if not s.startswith(("http:", "https:", "//")) and not s.endswith(f"?v={v}"):
                probs.append(f"{name}: <script src=\"{s}\"> no lleva ?v={v}")
    tags = [s.split("?")[0] for s in I4._tags(html)]
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
    if "js/keys.js" in tags and tags.index("js/keys.js") != tags.index("js/gestures.js") + 1:
        probs.append("js/keys.js no va justo detrás de js/gestures.js")
    for m in ("js/shortcuts.js", "js/mailbox.js", "js/phrases.js"):
        for dep in ("js/games.js", "js/learn.js", "js/shop.js", "js/sync.js", "js/review.js", "js/settings.js"):
            if m in tags and dep in tags and tags.index(dep) > tags.index(m):
                probs.append(f"{m} carga antes que {dep}")
    shell = re.findall(r'"([^"]+)"', re.search(r"const SHELL = \[(.*?)\];", sw, re.S).group(1))
    off = re.findall(r'"([^"]+)"', re.search(r"const OFF_APP = \[(.*?)\];", html, re.S).group(1))
    for f in _FILES:
        if f not in shell:
            probs.append(f"falta {f} en SHELL de sw.js")
        if f not in off:
            probs.append(f"falta {f} en OFF_APP de index.html")
        if not (C.REPO / f).exists():
            probs.append(f"{f} no existe")
    if sorted(shell) != sorted(off):
        probs.append(f"SHELL y OFF_APP no son la misma lista: {sorted(set(shell) ^ set(off))}")
    man = json.loads((C.REPO / "manifest.webmanifest").read_text(encoding="utf-8"))
    scs = man.get("shortcuts") or []
    if [s.get("url") for s in scs] != ["./#/repaso", "./#/mapa", "./#/juegos", "./#/granja"]:
        probs.append(f"atajos del manifest: {[s.get('url') for s in scs]}")
    for s in scs:
        for ic in s.get("icons") or []:
            if not (C.REPO / ic["src"]).exists() or ic["src"] not in shell:
                probs.append(f"el icono {ic['src']} del atajo {s.get('name')} no existe o no está en SHELL")
    page = C.new_page("phone")
    try:
        page.add_init_script("""document.addEventListener('DOMContentLoaded', () => { try { const J = TABS.find(t => t.id === 'jugar');
            window.__atBoot = {routes: Object.keys(ROUTES).sort(), keys: typeof window.vocabKeys, sc: typeof window.vocabShortcuts,
              mail: typeof window.vocabMailbox, media: typeof window.vocabMedia, phr: typeof window.vocabPhrases,
              games: window.vocabGames ? vocabGames.list() : null, slots: HOME_SLOTS.map(f => f && f.id || '?'), secs: J ? J.secs.slice() : []};
          } catch (e) { window.__atBoot = {err: String(e)}; } }, {capture: true});""")
        C.seed(page)
        b = page.evaluate("window.__atBoot")
        if not b or b.get("err"):
            probs.append(f"no se pudo ver el estado al arrancar: {b}")
        else:
            for r in ("buzon", "carta", "frases"):
                if r not in b["routes"]:
                    probs.append(f"al primer route() falta ROUTES.{r}")
            for k in ("keys", "sc", "mail", "media", "phr"):
                if b[k] != "object":
                    probs.append(f"al primer route() falta {k}: {b[k]}")
            for g in ("buzon", "frases"):
                if g not in (b["games"] or []):
                    probs.append(f"vocabGames no tiene la tarjeta «{g}» al arrancar: {b['games']}")
            for s in ("mail", "phrase", "granja", "season"):
                if s not in b["slots"]:
                    probs.append(f"falta el HOME_SLOT {s}: {b['slots']}")
            if "sync" in b["slots"]:
                probs.append(f"sigue el HOME_SLOT de Google (sync): {b['slots']}")
            for s in ("buzon", "carta", "frases"):
                if s not in b["secs"]:
                    probs.append(f"la sección {s} no es de la pestaña Jugar: {b['secs']}")
        inv = page.evaluate("""() => ({t: ['sc:prefs', 'mail:box', 'phrase:stamps', 'vocab:sc', 'phrase:day'].map(k => vocabSave.typeOf(k)),
          dev: vocabSave.inventory.deviceOnly})""")
        if inv["t"] != ["o", "o", "o", None, None] or not {"vocab:sc", "phrase:day"} <= set(inv["dev"]):
            probs.append(f"inventario de save.js: {inv}")
        for h, css in (("#/buzon", "css-mailbox"),):
            C.goto(page, h)
            C.goto(page, "#/juegos")
            C.goto(page, h)
            if page.locator(f"style#{css}").count() != 1:
                probs.append(f"<style id={css}> está {page.locator(f'style#{css}').count()} veces")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- rutas
_ROUTES5 = [
    # (hash, lo que pinta, pestaña, hash final sin «#/»)
    ("#/buzon", "#mb-rb", "jugar", "buzon"),
    ("#/buzon/responder", "#mb-gate-go", "jugar", "buzon/responder"),
    (f"#/carta?d={R.CARTA_D}", "#mb-open", "jugar", "carta/rutaCarta01"),
    ("#/frases", "#ph-line", "jugar", "frases"),
    ("#/frases/cena", "#ph-cena", "jugar", "frases/cena"),
    ("#/juegos/globos?t=animales", "html[data-gm-play]", "jugar", "juegos/globos?t=animales"),
    ("#/doc/w02?m=test", "#dv-tab-test[aria-selected=true]", "aprender", "doc/w02?m=test"),
    ("#/doc/animales?m=tarjetas", "#dv-tab-tarjetas[aria-selected=true]", "aprender", "doc/animales?m=tarjetas"),
    ("#/leccion/G-A1-01", ".ls-stage .ls-page", "aprender", "leccion/G-A1-01"),
    # las URL de los atajos del manifest
    ("#/repaso", "#rv-card", "aprender", "repaso"),
    ("#/mapa", "#app .mp-node, #app [data-lesson], #app .lv-node, #app svg", "aprender", "mapa"),
    ("#/juegos", "#gm-cards .gm-card", "jugar", "juegos"),
    ("#/granja", "#app .fm-stage", "granja", "granja"),
]


def test_f5_routes_direct_reload_and_navigation():
    """Cada ruta de F5 (y las URL de los atajos del manifest) por enlace directo con la partida, al recargar y el primer
    día sin partida: pinta, marca su pestaña y queda en su hash (#/carta?d=… pasa a #/carta/<id>; el primer día, la
    carta pregunta antes dónde abrirla, con «Abrir aquí»). Navegando: Jugar ›
    Buzón y Frases mágicas (y la cápsula de volver a Juegos), Hoy › «La frase de la cena» (y volver a Hoy), Hoy › un atajo
    (#/juegos/globos?t=animales), Para mayores › «Contestar una carta del Buzón» (el formulario sin otra Puerta) y la
    carta › volver al Buzón. Sin errores."""
    probs = []
    for h, sel, tab, final in _ROUTES5:
        page = C.new_page("phone")
        try:
            C.seed(page, _keys(), hash=h)
            for when in ("enlace directo", "al recargar"):
                if when == "al recargar":
                    C.reload(page)
                try:
                    page.wait_for_selector(sel, timeout=9000, state="attached")
                except Exception:  # noqa: BLE001
                    probs.append(f"{h} ({when}): no pinta {sel}")
                got = C.current_hash(page)
                if got != final:
                    probs.append(f"{h} ({when}): queda en #/{got} (se esperaba #/{final})")
                if page.evaluate(_TAB) != tab:
                    probs.append(f"{h} ({when}): la pestaña marcada es {page.evaluate(_TAB)} (se esperaba {tab})")
            probs += [f"{h}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    # el primer día, sin partida
    page = C.new_page("phone")
    try:
        for h, sel, tab, final in _ROUTES5[:6]:
            if h.startswith("#/carta"):
                sel = "#mb-wv-here"     # con la partida nueva, antes pregunta dónde abrirla (o «Abrir aquí»)
            C.goto(page, h, reload=True)
            try:
                page.wait_for_selector(sel, timeout=9000, state="attached")
            except Exception:  # noqa: BLE001
                probs.append(f"{h} (primer día): no pinta {sel}")
        probs += [f"primer día: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    # navegando
    page = C.new_page("phone")
    try:
        C.seed(page, _keys())
        _click_nav(page, "#tab-jugar")
        _click_nav(page, ".gm-card[data-g=buzon]")
        bk = page.evaluate("() => { const b = document.getElementById('dv-back'); return b && {h: b.getAttribute('href'), t: b.textContent.trim()}; }")
        if C.current_hash(page) != "buzon" or page.evaluate(_TAB) != "jugar" or not bk or bk["h"] != "#/juegos":
            probs.append(f"Juegos › Buzón: #/{C.current_hash(page)}, pestaña {page.evaluate(_TAB)}, volver {bk}")
        _click_nav(page, "#dv-back")
        if C.current_hash(page) != "juegos":
            probs.append(f"volver desde el Buzón lleva a #/{C.current_hash(page)}")
        _click_nav(page, ".gm-card[data-g=frases]")
        page.wait_for_selector("#ph-line", timeout=8000)
        bk = page.evaluate("() => document.getElementById('dv-back').getAttribute('href')")
        if C.current_hash(page) != "frases" or bk != "#/juegos":
            probs.append(f"Juegos › Frases: #/{C.current_hash(page)}, volver a {bk}")
        _click_nav(page, "#tab-hoy")
        _hoy(page)
        if not page.locator("#ph-hrow .ph-hgo").count():
            probs.append(f"en Hoy no sale «La frase de la cena»: {page.evaluate(_SLOTS)}")
        else:
            _click_nav(page, "#ph-hrow .ph-hgo")
            bk = page.evaluate("() => { const b = document.getElementById('dv-back'); return {h: b.getAttribute('href'), t: b.textContent.trim()}; }")
            if C.current_hash(page) != "frases/cena" or bk != {"h": "#/", "t": "Hoy"}:
                probs.append(f"Hoy › frase de la cena: #/{C.current_hash(page)}, volver {bk}")
            _click_nav(page, "#dv-back")
            if C.current_hash(page) != "":
                probs.append(f"volver desde la frase de la cena lleva a #/{C.current_hash(page)}")
        page.wait_for_selector("#hm-sc .sc-p", timeout=6000)
        href = page.locator("#hm-sc .sc-p").first.get_attribute("href")
        _click_nav(page, "#hm-sc .sc-p")
        if "#/" + C.current_hash(page) != href or page.evaluate(_TAB) != "jugar":
            probs.append(f"Hoy › atajo {href}: #/{C.current_hash(page)} ({page.evaluate(_TAB)})")
        C.goto(page, "#/juegos")
        page.evaluate(_PASS)
        page.evaluate("() => openSettings('mayores')")
        page.wait_for_selector("#aj-mb-reply", timeout=5000)
        page.wait_for_timeout(300)
        page.locator("#aj-mb-reply").click()
        page.wait_for_selector("#mb-f", timeout=6000)
        if C.current_hash(page) != "buzon/responder" or page.evaluate("() => !!(document.getElementById('gate') || {}).open"):
            probs.append(f"Para mayores › Contestar: #/{C.current_hash(page)}")
        BZ._open_link(page, R.CARTA_D)
        if C.current_hash(page) != "carta/rutaCarta01":
            probs.append(f"el enlace de la carta queda en #/{C.current_hash(page)}")
        _click_nav(page, "#dv-back")
        if C.current_hash(page) != "buzon":
            probs.append(f"volver desde la carta lleva a #/{C.current_hash(page)}")
        probs += [f"navegando: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_f5_tour_without_acting_keeps_export():
    """Una vuelta por todo F5 sin hacer nada (Hoy con la fila de atajos y la frase de la cena, el Buzón, contestar, Frases
    mágicas, la frase de la cena, los enlaces de los atajos, la hoja «Teclas», la de editar atajos y Para mayores) deja la
    partida exportada igual que la base (ni claves nuevas: vocab:sc y phrase:day son solo del aparato)."""
    probs = []
    page = BZ._page()
    try:
        C.seed(page, _keys())
        for h in ("", "#/buzon", "#/buzon/responder", "#/frases", "#/frases/cena", "#/juegos", "#/doc/w02?m=test", "#/juegos/globos?t=animales", ""):
            C.goto(page, h)
            page.wait_for_timeout(250)
        page.wait_for_selector("#hm-sc .sc-p", timeout=6000)
        page.keyboard.press("?")
        page.wait_for_selector("dialog#kb-help[open]", timeout=4000)
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.querySelector('dialog#kb-help[open]')", timeout=4000)
        page.locator("#sc-ed").click()
        page.wait_for_selector("dialog#sc-sheet[open]", timeout=4000)
        SC._close_sheet(page)
        page.evaluate(_PASS)
        page.evaluate("() => openSettings('mayores')")
        page.wait_for_selector("#aj-sc-on", timeout=5000)
        page.evaluate("() => vocabSettings.close()")
        page.wait_for_timeout(500)
        d = C.diff_exports(C.load_baseline(), C.export(page), allow_new=False)
        if d:
            probs.append(f"la partida cambia tras la vuelta por F5: {d}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Hoy con todo a la vez
def _all_at_once(page, now=HALLOWEEN, letter=True, hash=""):
    C.seed(page, _keys(now, shelter=True), now=now)
    if letter:
        page.evaluate("o => vocabMailbox.receive(o)", LET)
    if hash:
        C.goto(page, hash)
    _hoy(page)


def test_hoy_everything_at_once_priority_and_no_scroll():
    """En pleno Halloween, con atajos, una carta sin abrir, la gallina en el refugio y la frase de la cena a la vez (y
    sin fila de Google: la partida se guarda sola): en el móvil (390×844, claro y oscuro) la fila de atajos y un solo
    HOME_SLOT, la carta; en tableta (820×1180) y en el escritorio, dos: la carta y el refugio. Al irse cada uno sale el
    siguiente por orden: carta > refugio > temporada > frase de la cena, también en otra visita. Con «Repasar 6» y en
    un móvil bajo (375×667) tampoco hay scroll. Sin errores."""
    probs = []
    for tag, kind, kw, want in (("móvil claro", "phone", {}, ["mail"]), ("móvil oscuro", "phone", {"color_scheme": "dark"}, ["mail"]),
                                ("tableta 820", "phone", {"viewport": {"width": 820, "height": 1180}}, ["mail", "granja"]),
                                ("escritorio", "desk", {}, ["mail", "granja"])):
        page = C.new_page(kind, now=HALLOWEEN, **kw)
        try:
            _all_at_once(page)
            got = page.evaluate(_SLOTS)
            if got != want:
                probs.append(f"{tag}: los HOME_SLOTS son {got} (se esperaba {want})")
            if not page.evaluate("() => +(document.documentElement.dataset.sc || 0)") >= 3:
                probs.append(f"{tag}: no sale la fila de atajos con sus 3 piezas")
            _fits(page, tag, probs)
            if page.locator("#mb-hrow, [data-slot=mail] .hm-row").count() and "carta" not in page.locator("[data-slot=mail]").text_content():
                probs.append(f"{tag}: la fila del sobre no dice «carta»")
            # y al irse cada uno, el siguiente (en el móvil, uno; en los grandes, dos)
            steps = [["granja"], ["season"], ["phrase"]] if len(want) == 1 else \
                [["granja", "season"], ["season", "phrase"], ["phrase"]]
            # 1) se abre la carta
            C.goto(page, "#/carta/" + LET["id"])
            page.locator("#mb-open").click()
            page.wait_for_selector("#mb-gift:not([hidden])", timeout=9000)
            _hoy(page)
            seq = [page.evaluate(_SLOTS)]
            _fits(page, f"{tag} sin la carta", probs)
            # 2) ya vio el refugio
            page.evaluate("() => { const s = store.get('farm:state', {}); s.shelter.gallina.seen = true; store.set('farm:state', s); }")
            _hoy(page)
            seq.append(page.evaluate(_SLOTS))
            _fits(page, f"{tag} sin el refugio", probs)
            # 3) sin temporada
            C.goto(page, "#/?season=off")          # (es Hoy otra vez)
            page.wait_for_timeout(500)
            _hoy(page)
            seq.append(page.evaluate(_SLOTS))
            if seq != steps:
                probs.append(f"{tag}: al irse uno tras otro salen {seq} (se esperaba {steps})")
            # otra visita: lo mismo (no sale ningún aviso de Google)
            C.reload(page)
            page.wait_for_timeout(500)
            again = page.evaluate(_SLOTS)
            if again != ["phrase"]:
                probs.append(f"{tag}: en otra visita salen {again} (la frase de la cena)")
            _fits(page, f"{tag} otra visita", probs)
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    # con «Repasar 6» (la tarjeta pasa a la lección) y en un móvil bajo
    for tag, kw in (("Repasar 6", {}), ("móvil bajo 375×667", {"viewport": {"width": 375, "height": 667}})):
        page = C.new_page("phone", now=HALLOWEEN, **kw)
        try:
            _all_at_once(page)
            if tag == "Repasar 6":
                page.evaluate(SC._FEW)
                _hoy(page)
                if not page.locator("#hm-rev").count():
                    probs.append(f"{tag}: no sale la fila «Repasar»")
            got = page.evaluate(_SLOTS)
            if got not in ([], ["mail"]):
                probs.append(f"{tag}: los HOME_SLOTS son {got} (la carta o nada)")
            _fits(page, tag, probs)
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


_HOYM = """() => ({sh: document.documentElement.scrollHeight, ih: innerHeight, sc: +(document.documentElement.dataset.sc || 0),
  acc: document.documentElement.hasAttribute('data-acc'),
  slots: [...document.querySelectorAll('#hm-slots > .hm-slot')].filter(e => !e.hidden).map(e => e.dataset.slot || '?')})"""
_HALF = {}


def _half_lesson(now=HALLOWEEN, lesson="A1-010", steps=3):
    """La lección a medias tal como la guarda la lección ('vocab:ls' en el formato de ahora, {v: 2, …, plan}; desde el
    paquete «Lecciones», lo de antes sin v empieza de cero al abrir la lección y se borra): se abre con la partida
    sembrada y se pasan sus primeras palabras nuevas con «Continuar». Devuelve el JSON (una vez por día y lección)."""
    key = (now, lesson, steps)
    if key not in _HALF:
        page = C.new_page("phone", now=now)
        try:
            C.seed(page, _keys(now), now=now)
            C.goto(page, "#/leccion/" + lesson)
            page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-page')", timeout=9000)
            for _ in range(steps):
                page.wait_for_timeout(800)          # (los botones de abajo no responden los primeros 0,7 s)
                i0 = page.evaluate("() => vocabLesson.state.i")
                page.locator("#ls-go").click()
                page.wait_for_function("i => vocabLesson.state && vocabLesson.state.i !== i", arg=i0, timeout=6000)
            sv = page.evaluate("() => sessionStorage.getItem('vocab:ls')")
        finally:
            page.context.close()
        v = json.loads(sv or "null")
        assert v and v.get("v") == 2 and v.get("id") == lesson and v.get("i") == steps, f"la lección no guarda lo hecho: {v}"
        _HALF[key] = sv
    return _HALF[key]


def test_hoy_with_the_follow_accessory_keeps_rows_and_fits():
    """Con una lección a medias (el accesorio «Seguir»), en pleno Halloween y con una carta sin abrir, a 390×844 (con y
    sin «Reducir movimiento»): llegando a Hoy desde Juegos (donde sí sale el accesorio) o desde la lección, con la fila de
    atajos (su pieza a medias hace de accesorio) la carta sigue en Hoy; sin atajos sale el accesorio y Hoy cabe con la
    carta (el último HOME_SLOT se va). Cuando el accesorio se va estando en Hoy, la fila que se fue vuelve. Sin scroll y
    sin errores en ningún caso."""
    probs = []
    for motion in ("no-preference", "reduce"):
        for sc in (True, False):
            for via in ("#/juegos", "#/leccion/A1-010"):
                tag = f"{'con' if sc else 'sin'} atajos, desde #/{via[2:]}, movimiento {motion}"
                page = C.new_page("phone", now=HALLOWEEN, reduced_motion=motion)
                try:
                    C.seed(page, _keys(HALLOWEEN, sc=sc), now=HALLOWEEN)
                    page.evaluate("o => vocabMailbox.receive(o)", LET)
                    page.evaluate("v => sessionStorage.setItem('vocab:ls', v)", _half_lesson())
                    C.goto(page, via)
                    page.wait_for_timeout(400)
                    C.goto(page, "")
                    page.wait_for_timeout(900)
                    page.evaluate(_FINISH)
                    m = page.evaluate(_HOYM)
                    if m["sh"] > m["ih"] + 1:
                        probs.append(f"{tag}: Hoy necesita scroll ({m['sh']} > {m['ih']})")
                    if not m["slots"] or m["slots"][0] != "mail":
                        probs.append(f"{tag}: falta la carta en Hoy: {m}")
                    if sc and (m["sc"] < 3 or m["acc"] or not page.locator("#hm-sc .sc-p[data-half]").count()):
                        probs.append(f"{tag}: la fila de atajos con la lección a medias y sin accesorio: {m}")
                    if not sc and not m["acc"]:
                        probs.append(f"{tag}: sin atajos no sale el accesorio «Seguir»: {m}")
                    if not sc:
                        # el accesorio se va estando en Hoy: vuelve la fila que no cabía
                        page.evaluate("() => { sessionStorage.removeItem('vocab:ls'); return vocabAccessory.refresh(); }")
                        page.wait_for_timeout(400)
                        m2 = page.evaluate(_HOYM)
                        if m2["acc"] or m2["slots"][:1] != ["mail"] or len(m2["slots"]) != 2 or m2["sh"] > m2["ih"] + 1:
                            probs.append(f"{tag}: sin el accesorio, Hoy queda {m2} (la carta y otra fila, sin scroll)")
                    probs += [f"{tag}: {e}" for e in C.errors(page)]
                finally:
                    page.context.close()
    # en un móvil bajo (375×667) tampoco hay scroll: con atajos, su pieza a medias; sin atajos, el accesorio
    for sc in (True, False):
        tag = f"móvil bajo, {'con' if sc else 'sin'} atajos"
        page = C.new_page("phone", now=HALLOWEEN, viewport={"width": 375, "height": 667})
        try:
            C.seed(page, _keys(HALLOWEEN, sc=sc, shelter=True), now=HALLOWEEN)
            page.evaluate("o => vocabMailbox.receive(o)", LET)
            page.evaluate("sessionStorage.setItem('vocab:ls', JSON.stringify({id: 'A1-010', i: 3, first: [], miss: []}))")
            C.goto(page, "#/juegos")
            page.wait_for_timeout(400)
            C.goto(page, "")
            page.wait_for_timeout(900)
            page.evaluate(_FINISH)
            m = page.evaluate(_HOYM)
            if m["sh"] > m["ih"] + 1:
                probs.append(f"{tag}: Hoy necesita scroll ({m['sh']} > {m['ih']}): {m}")
            if m["acc"] == (m["sc"] > 0):
                probs.append(f"{tag}: la lección a medias tiene que salir una vez, en la fila o en el accesorio: {m}")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_hoy_short_phone_keeps_the_letter():
    """Un móvil bajo y estrecho (360×740, claro y oscuro; también en pleno Halloween) con «Tus atajos» y una carta sin
    abrir: la carta sigue en Hoy (va antes que la fila; antes, la fila la echaba) y Hoy cabe sin scroll; la fila se
    compacta si hace falta. En 375×667 (más bajo aún) la carta se queda y, si no cabe con ella, se va la fila. Sin carta,
    la fila sigue entera. «Palabra del día» va en una línea, a la izquierda como «Misiones» (la pareja no crece)."""
    probs = []
    cases = (("360×740", {"viewport": {"width": 360, "height": 740}}, C.FIXED_NOW, True),
             ("360×740 oscuro", {"viewport": {"width": 360, "height": 740}, "color_scheme": "dark"}, C.FIXED_NOW, True),
             ("360×740 Halloween", {"viewport": {"width": 360, "height": 740}}, HALLOWEEN, True),
             ("375×667", {"viewport": {"width": 375, "height": 667}}, C.FIXED_NOW, False))
    for tag, kw, now, row in cases:
        page = C.new_page("phone", now=now, **kw)
        try:
            C.seed(page, _keys(now), now=now)
            _hoy(page)
            m0 = page.evaluate(_HOYM)
            if m0["sc"] < 3:
                probs.append(f"{tag}, sin carta: falta la fila de atajos: {m0}")
            _fits(page, f"{tag}, sin carta", probs)
            page.evaluate("o => vocabMailbox.receive(o)", LET)
            _hoy(page)
            m = page.evaluate(_HOYM)
            if m["slots"][:1] != ["mail"]:
                probs.append(f"{tag}: la carta no sale en Hoy: {m}")
            if row and m["sc"] < 3:
                probs.append(f"{tag}: con la carta se fue la fila de atajos (cabían las dos, compacta): {m}")
            _fits(page, tag, probs)
            pl = page.evaluate("""() => { const l = document.querySelector('#bd-wotd .bd-face .bd-pl'), m = document.querySelector('#bd-mis .bd-pl');
              return l && m ? {h: Math.round(l.getBoundingClientRect().height), mh: Math.round(m.getBoundingClientRect().height), al: getComputedStyle(l).textAlign} : null; }""")
            if pl and (pl["h"] > pl["mh"] + 1 or pl["al"] not in ("left", "start")):
                probs.append(f"{tag}: «Palabra del día» en dos líneas o centrada: {pl}")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- teclado en las pantallas nuevas
def test_keyboard_on_new_screens_fires_once():
    """Hoy: 1-3 abren el atajo N (una sola navegación; 4 con 3 piezas no hace nada) y Enter en una pieza enfocada es la
    activación del navegador (keys.js no pulsa además). Buzón: 1-4 eligen la frase (una voz), Espacio la lee, Enter
    graba y para (un solo micrófono y una grabación) y Enter otra vez «Mandar» (un solo envío); ? abre «Teclas» y Esc la
    cierra. Frases mágicas: 1 pone el dibujo 1, Espacio «Oír» una vez, Enter «Otra frase» una vez (sin cambiar de
    pantalla). La carta: Enter «Abrir la carta» paga una sola vez. Las etiquetas de las teclas salen en las pantallas
    nuevas. Sin errores."""
    probs = []
    page = BZ._page(share=True)
    try:
        C.seed(page, _keys())
        page.evaluate("() => sessionStorage.setItem('__mic', 'ok')")
        _hoy(page)
        page.evaluate(K._SPY)
        row = page.evaluate(_SCROW)
        if [x["key"] for x in row] != ["1", "2", "3"]:
            probs.append(f"las piezas de los atajos no llevan las teclas 1-3: {row}")
        for i in (1, 3):
            page.evaluate(K._BLUR)
            page.evaluate(K._RESET)
            n0 = page.evaluate(_ROUTE_N)
            page.keyboard.press(str(i))
            try:
                _wait_route(page, n0)
            except Exception:  # noqa: BLE001
                probs.append(f"la tecla {i} en Hoy no abre el atajo {i}")
                continue
            page.wait_for_timeout(500)
            n = page.evaluate(_ROUTE_N) - n0
            clk = [c for c in page.evaluate(K._K)["clk"] if c["key"] == str(i)]
            if "#/" + C.current_hash(page) != row[i - 1]["href"] or n != 1 or len(clk) != 1:
                probs.append(f"tecla {i}: #/{C.current_hash(page)} (quería {row[i - 1]['href']}), {n} navegaciones, clics {clk}")
            if page.evaluate("() => !!document.documentElement.dataset.gmPlay"):
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)
            C.goto(page, "")
            page.wait_for_timeout(400)
        page.evaluate(K._RESET)
        n0 = page.evaluate(_ROUTE_N)
        page.keyboard.press("4")
        page.wait_for_timeout(700)
        if page.evaluate(_ROUTE_N) != n0 or C.current_hash(page) != "":
            probs.append(f"la tecla 4 con 3 atajos hace algo: #/{C.current_hash(page)}")
        page.focus('#hm-sc .sc-p[data-key="2"]')
        page.evaluate(K._RESET)
        n0 = page.evaluate(_ROUTE_N)
        page.keyboard.press("Enter")
        _wait_route(page, n0)
        page.wait_for_timeout(500)
        k = page.evaluate(K._K)
        if page.evaluate(_ROUTE_N) - n0 != 1 or [c for c in k["clk"] if not c["trusted"]] or "#/" + C.current_hash(page) != row[1]["href"]:
            probs.append(f"Enter en el atajo 2 enfocado: #/{C.current_hash(page)}, {page.evaluate(_ROUTE_N) - n0} navegaciones, clics {k['clk']}")
        if page.evaluate("() => !!document.documentElement.dataset.gmPlay"):
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
        # el Buzón
        C.goto(page, "#/buzon")
        page.wait_for_selector("#mb-rb", timeout=6000)
        page.evaluate(K._BLUR)
        page.evaluate("() => { window.__said.length = 0; }")
        page.evaluate(K._RESET)
        page.keyboard.press("2")
        page.wait_for_timeout(300)
        t = page.evaluate("""() => ({on: [...document.querySelectorAll('.mb-tpl')].map(b => b.getAttribute('aria-checked')), said: window.__said.map(x => x.t),
          phr: document.getElementById('mb-phr').textContent})""")
        if t["on"] != ["false", "true", "false", "false"] or t["said"].count(t["phr"]) != 1:
            probs.append(f"la tecla 2 en el Buzón: {t}")
        page.wait_for_timeout(300)
        page.evaluate(K._RESET)
        page.keyboard.press("Space")
        page.wait_for_timeout(400)
        clk = [c for c in page.evaluate(K._K)["clk"] if c["id"] == "mb-spk"]
        if len(clk) != 1:
            probs.append(f"Espacio en el Buzón pulsa el altavoz {len(clk)} veces")
        if not page.evaluate(K._KBD) or not page.evaluate(K._TAGS):
            probs.append("en el Buzón no salen las etiquetas de las teclas")
        page.keyboard.press("Enter")
        page.wait_for_function("() => document.querySelector('#mb-rb.is-rec')", timeout=4000)
        page.clock.fast_forward(2500)
        page.wait_for_timeout(100)
        page.evaluate(K._BLUR)
        page.keyboard.press("Enter")
        page.wait_for_selector("#mb-send", timeout=5000)
        page.wait_for_timeout(300)
        r = page.evaluate("async () => ({gum: window.__gum, recs: window.__recs, idb: (await vocabMedia.list('mail')).length})")
        if r != {"gum": 1, "recs": 1, "idb": 1}:
            probs.append(f"Enter para grabar y parar: {r} (un micrófono, una grabación)")
        page.evaluate(K._BLUR)
        page.evaluate(_PASS)            # «Mandar» pide la Puerta de mayores (aquí, pasada hace un momento)
        page.keyboard.press("Enter")
        page.wait_for_function("() => window.__shared.length >= 1", timeout=4000)
        page.wait_for_timeout(600)
        if page.evaluate("() => window.__shared.length") != 1:
            probs.append(f"Enter en «Mandar» comparte {page.evaluate('() => window.__shared.length')} veces")
        page.keyboard.press("?")
        try:
            page.wait_for_selector("dialog#kb-help[open]", timeout=3000)
            page.keyboard.press("Escape")
            page.wait_for_function("() => !document.querySelector('dialog#kb-help[open]')", timeout=3000)
        except Exception:  # noqa: BLE001
            probs.append("? no abre (o Esc no cierra) «Teclas» en el Buzón")
        # Frases mágicas
        C.goto(page, "#/frases")
        page.wait_for_selector("#ph-line", timeout=8000)
        page.evaluate(K._BLUR)
        page.evaluate(K._RESET)
        page.keyboard.press("1")
        page.wait_for_timeout(300)
        st = page.evaluate("() => vocabPhrases.state()")
        clk = [c for c in page.evaluate(K._K)["clk"] if c["key"] == "1"]
        if st["placed"] != 0 or len(clk) != 1:
            probs.append(f"la tecla 1 en Frases: puesta {st['placed']}, clics {clk}")
        page.wait_for_function("() => !document.querySelector('#ph-line.is-lit')", timeout=6000)
        page.evaluate(K._RESET)
        page.keyboard.press("Space")
        page.wait_for_timeout(300)
        clk = [c for c in page.evaluate(K._K)["clk"] if c["id"] == "ph-say"]
        if len(clk) != 1:
            probs.append(f"Espacio en Frases pulsa «Oír» {len(clk)} veces")
        page.wait_for_function("() => !document.querySelector('#ph-line.is-lit')", timeout=6000)
        tpl0, n0 = st["tpl"], page.evaluate(_ROUTE_N)
        page.evaluate(K._RESET)
        page.keyboard.press("Enter")
        page.wait_for_timeout(600)
        clk = [c for c in page.evaluate(K._K)["clk"] if c["id"] == "ph-next"]
        st = page.evaluate("() => vocabPhrases.state()")
        if len(clk) != 1 or st["tpl"] == tpl0 or st["placed"] != -1 or page.evaluate(_ROUTE_N) != n0:
            probs.append(f"Enter en Frases: clics {clk}, plantilla {tpl0} → {st['tpl']}, puesta {st['placed']}")
        # la carta
        page.evaluate("o => vocabMailbox.receive(o)", LET)
        C.goto(page, "#/carta/" + LET["id"])
        page.wait_for_selector("#mb-open", timeout=6000)
        c0 = page.evaluate(_COINS)
        page.evaluate(K._BLUR)
        page.evaluate(K._RESET)
        page.keyboard.press("Enter")
        page.wait_for_selector("#mb-gift:not([hidden])", timeout=9000)
        page.wait_for_timeout(500)
        clk = [c for c in page.evaluate(K._K)["clk"] if c["id"] == "mb-open"]
        if page.evaluate(_COINS) != c0 + 20 or len(clk) != 1:
            probs.append(f"Enter en «Abrir la carta»: {c0} → {page.evaluate(_COINS)} monedas, clics {clk}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# las etiquetas de las teclas que se ven: dónde caen y qué tocan (otra etiqueta, otro botón, un texto, otra tarjeta)
_TAGHIT = r"""() => {
  const vis = e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && +c.opacity > 0.05; };
  const tags = [...document.querySelectorAll('.kb-tag')].filter(vis), out = [];
  const R = tags.map(t => t.getBoundingClientRect());
  const near = (a, b, g) => a.left - g < b.right && a.right + g > b.left && a.top - g < b.bottom && a.bottom + g > b.top;
  const who = e => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''));
  const top = document.querySelector('dialog[open]:modal') || document.body;
  /* lo que se ve de verdad (una cara de tarjeta girada no: el navegador no la toca) */
  const seen = e => { const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    return x < 0 || y < 0 || x > innerWidth || y > innerHeight || document.elementsFromPoint(x, y).some(n => n === e || e.contains(n)); };
  const stuff = [...top.querySelectorAll('button, a, p, h1, h2, h3, img, label, small, .card, .kb-what, .kb-keys')].filter(e => vis(e) && seen(e));
  tags.forEach((t, i) => {
    const host = t.parentElement, r = R[i];
    if (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push(`«${t.dataset.k}» de ${who(host)} se sale de la pantalla`);
    if (t.textContent.trim()) out.push(`«${t.dataset.k}» de ${who(host)} lleva texto dentro: «${t.textContent.trim()}»`);   /* p. ej. el nombre de la cápsula de volver */
    R.forEach((q, j) => { if (j > i && near(r, q, 3.5)) out.push(`«${t.dataset.k}» (${who(host)}) toca «${tags[j].dataset.k}» (${who(tags[j].parentElement)})`); });
    for (const e of stuff) {
      if (e === host || host.contains(e) || e.contains(host) || t.contains(e)) continue;
      if (near(r, e.getBoundingClientRect(), 3.5)) { out.push(`«${t.dataset.k}» (${who(host)}) toca ${who(e)} «${(e.textContent || '').trim().slice(0, 24)}»`); break; }
    }
  });
  if (document.documentElement.scrollWidth > innerWidth + 0.5) out.push(`la página se ensancha (${document.documentElement.scrollWidth} > ${innerWidth})`);
  return {n: tags.length, hits: out, pos: tags.map(t => [t.dataset.k, who(t.parentElement), t.dataset.pos || 'b'])};
}"""


def test_key_tags_never_touch_their_neighbours():
    """Con el teclado, cada etiqueta de tecla deja al menos 4 px con lo de al lado (otra etiqueta, otro botón, un
    texto u otra tarjeta) y no se sale de la pantalla: en Hoy con «Tus atajos» (1-3 dentro de cada pieza), en la
    lección (Esc, Espacio y ⇧ Espacio en una línea sobre los botones redondos, Enter), en el repaso, en Tarjetas (sin
    ensanchar la página: nunca se prueba un sitio fuera de la pantalla), en el Buzón (1-4 dentro, Espacio,
    Enter del micrófono), en Frases mágicas, en la frase de la cena y en la hoja «Teclas» (Esc de «Listo»), en claro y
    en oscuro. Al cambiar de pantalla con las etiquetas puestas, el nombre de «‹ Volver» no se mete en la suya. En la hoja «Teclas» la acción va a la izquierda y las teclas a la derecha, sin partir las acciones."""
    probs = []
    for scheme in ("light", "dark"):
        page = BZ._page(color_scheme=scheme)
        try:
            C.seed(page, _keys())
            page.evaluate("() => sessionStorage.setItem('__mic', 'ok')")
            _hoy(page)

            def look(tag, need):
                page.keyboard.press("ArrowUp")          # no es de nadie: solo enseña las etiquetas
                page.wait_for_timeout(700)
                page.evaluate(_FINISH)
                page.wait_for_timeout(300)
                res = page.evaluate(_TAGHIT)
                ks = [p[0] for p in res["pos"]]
                for k in need:
                    if k not in ks:
                        probs.append(f"{scheme} {tag}: falta la etiqueta «{k}» ({res['pos']})")
                probs.extend(f"{scheme} {tag}: {h}" for h in res["hits"])
                if scheme == "light":
                    C.shot(page, f"F5-etiquetas-{tag}-phone-light", OUT, full_page=False)
                return res
            res = look("hoy", ["Enter", "1", "2", "3"])
            ins = [p for p in res["pos"] if p[0] in "123"]
            if not ins or any(p[1] != "a.card" for p in ins):
                probs.append(f"{scheme} hoy: las teclas de los atajos {ins}")
            C.goto(page, "#/mapa")
            C.goto(page, "#/leccion/" + K.LESSON)
            page.wait_for_selector(".ls-stage .ls-page .ls-spk", timeout=8000)
            page.wait_for_timeout(1200)
            res = look("leccion", ["Esc", "Espacio", "⇧ Espacio"])
            line = page.evaluate("""() => [...document.querySelectorAll('.ls-stage .ls-page:not(.ls-ghost) .say > .kb-tag')].map(t => Math.round(t.getBoundingClientRect().top))""")
            if len(line) == 2 and abs(line[0] - line[1]) > 1:
                probs.append(f"{scheme} leccion: las etiquetas del altavoz y la tortuga no van en una línea {line}")
            C.goto(page, "#/repaso")
            page.wait_for_selector("#rv-card", timeout=8000)
            page.wait_for_timeout(600)
            page.keyboard.press("Space")
            page.wait_for_function("() => vocabReview.state.flip", timeout=3000)
            page.wait_for_timeout(600)
            look("repaso", ["Esc", "Espacio", "⇧ Espacio"])
            C.goto(page, f"#/doc/{R.TOPIC}?m=tarjetas")
            page.wait_for_selector("#card", timeout=6000)
            page.wait_for_timeout(500)
            look("tarjetas", ["Esc", "Espacio", "Enter"])
            C.goto(page, "#/buzon")
            page.wait_for_selector("#mb-rb", timeout=6000)
            look("buzon", ["1", "2", "3", "4", "Espacio", "Enter"])
            C.goto(page, "#/frases")
            page.wait_for_selector(".ph-tile", timeout=8000)
            page.locator(".ph-tile").first.click()
            page.wait_for_timeout(300)
            look("frases", ["1", "2", "3", "Espacio", "⇧ Espacio", "Enter"])
            C.goto(page, "#/frases/cena")
            page.wait_for_selector("#ph-stamp", timeout=8000)
            look("cena", ["Espacio", "⇧ Espacio", "Enter"])
            bk = page.evaluate("() => document.querySelector('#dv-back > span').textContent")
            if bk != "Juegos":
                probs.append(f"{scheme} cena: la cápsula de volver dice «{bk}» (tras Tarjetas, Buzón y Frases)")
            C.goto(page, "")
            page.wait_for_timeout(500)
            page.keyboard.press("?")
            page.wait_for_selector("dialog#kb-help[open]", timeout=4000)
            look("teclas", ["Esc"])
            rows = page.evaluate("""() => [...document.querySelectorAll('#kb-help .kb-row')].map(r => { const w = r.querySelector('.kb-what'), k = r.querySelector('.kb-keys'),
              a = w.getBoundingClientRect(), b = k.getBoundingClientRect(), rr = r.getBoundingClientRect(), t = w.firstChild;
              const rg = document.createRange(); rg.selectNodeContents(t); return {t: t.textContent, left: a.left < b.left, right: Math.round(rr.right - b.right), lines: rg.getClientRects().length}; })""")
            for r in rows:
                if not r["left"] or r["right"] > 17 or r["lines"] != 1:
                    probs.append(f"{scheme} teclas: fila «{r['t']}» {r}")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- recorrido en inglés, francés y danés
# dónde está el elemento sel respecto del foco: "here", "fwd" (después, se llega con Tab), "back" (antes: Mayús+Tab) o
# "none" (no está o no se puede enfocar con Tab)
_TAB_DIR = """s => { const t = document.querySelector(s), a = document.activeElement;
  if (!t || t.disabled || t.tabIndex < 0 || !t.getClientRects().length) return 'none';
  if (t === a) return 'here';
  return a && a !== document.body && (a.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_PRECEDING) ? 'back' : 'fwd'; }"""


def _tab_to(page, sel, n=30):
    """Llega a sel solo con Tab (o Mayús+Tab, si está antes del foco), como quien usa el teclado; False si no llega en n
    pulsaciones."""
    for _ in range(n):
        d = page.evaluate(_TAB_DIR, sel)
        if d in ("here", "none"):
            return d == "here"
        page.keyboard.press("Shift+Tab" if d == "back" else "Tab")
    return page.evaluate(_TAB_DIR, sel) == "here"


def _lesson_by_keys(page, max_steps=70):
    """Hace la lección abierta solo con el teclado (Enter en las palabras nuevas y tras contestar; la tecla de la buena en
    cada pregunta; en «Ordena las letras», la tecla de cada letra; en «Empareja», que no tiene teclas propias, Tab (o
    Mayús+Tab) hasta cada dibujo y su palabra y Enter: los dos ejercicios llegaron con el paquete «Lecciones»). Devuelve
    los problemas."""
    probs = []
    page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-page')", timeout=9000)
    page.evaluate(K._SPY)
    page.wait_for_timeout(900)
    for _ in range(max_steps):
        st = page.evaluate(K._LS)
        if not st or st["ended"]:
            break
        page.evaluate(K._BLUR)
        page.evaluate(K._RESET)
        if st["t"] == "learn" or st["done"]:
            page.keyboard.press("Enter")
        elif st["t"] == "spell":
            for ch in st["right"]:
                if ch.isascii():
                    page.keyboard.press(ch)
                else:   # é, æ, ø, å…: teclas de un teclado francés o danés que el de Playwright (EE. UU.) no tiene
                    page.evaluate("k => document.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true}))", ch)
                page.wait_for_timeout(40)
        elif st["t"] == "match":
            cur = ".ls-stage > .ls-page:not(.ls-ghost) .ls-mc"
            for m in range(page.locator(f"{cur}[data-side='p']").count()):
                page.evaluate(K._RESET)
                for side in ("p", "w"):
                    if not _tab_to(page, f"{cur}[data-side='{side}'][data-m='{m}']"):
                        probs.append(f"«Empareja»: con Tab no se llega a la pieza {side}{m} en el paso {st['i']}")
                        break
                    page.keyboard.press("Enter")
                # la pareja se elige por data-m: lo único bueno es una respuesta acertada y esas dos piezas emparejadas
                ans = page.evaluate(K._K)["ans"]
                got = page.evaluate("s => [...document.querySelectorAll(s)].filter(b => b.classList.contains('is-ok')).length", f"{cur}[data-m='{m}']")
                if ans != [True] or got != 2:
                    probs.append(f"«Empareja» con el teclado: la pareja {m} da {ans} y {got} de 2 piezas emparejadas en el paso {st['i']}")
            page.evaluate(K._RESET)
        else:
            opts = page.evaluate(K._OPTS)
            if st["right"] not in opts:
                page.wait_for_timeout(400)
                continue
            page.keyboard.press(str(opts.index(st["right"]) + 1))
        try:
            page.wait_for_function("i => { const s = vocabLesson.state; return !s || s.ended || s.i !== i; }", arg=st["i"], timeout=6000)
        except Exception:  # noqa: BLE001
            probs.append(f"la lección no avanza con el teclado en el paso {st}")
            break
        k = page.evaluate(K._K)
        if len(k["ans"]) > 1:
            probs.append(f"una tecla responde {len(k['ans'])} veces en el paso {st['i']}")
        page.wait_for_timeout(150)
    else:
        probs.append("la lección no termina con el teclado")
    return probs


def _tour(lang):
    ab = _AB[lang]
    probs = []
    page = BZ._page(share=True)
    ctx = page.context
    try:
        C.seed(page, _keys(sc=False, lang=lang))
        page.evaluate("() => sessionStorage.setItem('__mic', 'ok')")
        page.evaluate(SC._FINISH)
        _fits(page, f"{lang}: Hoy", probs)
        # 1) una lección con el teclado
        c0 = page.evaluate(_COINS)
        if lang == "english":       # en inglés la tarjeta de Hoy es el repaso: la lección sale del camino
            C.goto(page, "#/leccion/" + R.LESSON)
        else:
            page.evaluate(K._BLUR)
            n0 = page.evaluate(_ROUTE_N)
            page.keyboard.press("Enter")
            _wait_route(page, n0)
        lid = C.current_hash(page).split("/")[-1]
        if not C.current_hash(page).startswith("leccion/"):
            probs.append(f"{lang}: Enter en Hoy no abre la lección (#/{C.current_hash(page)})")
        else:
            probs += [f"{lang}: {p}" for p in _lesson_by_keys(page)]
            page.wait_for_timeout(1500)
            done = page.evaluate("l => Object.keys(store.get('map:' + l, {}))", lang)
            if lid not in done:
                probs.append(f"{lang}: la lección {lid} hecha con el teclado no queda en el camino: {done}")
            if page.evaluate(_COINS) <= c0:
                probs.append(f"{lang}: la lección no da monedas")
        # 2) tres partidas de Globos: sale su atajo en Hoy
        C.goto(page, "#/juegos/globos")
        for n in range(3):
            SC._start_game(page)
            SC._play_globos(page)
            page.wait_for_timeout(800)
            if n < 2:
                page.locator("#gm-again").click()
                page.wait_for_timeout(500)
        sc = page.evaluate("() => JSON.parse(localStorage.getItem('vocab:sc') || 'null')")
        pts = {k: round(v["s"], 3) for k, v in (sc or {}).get("k", {}).items() if k.startswith(f"{ab}/juego:globos")}
        if sum(pts.values()) < 3:
            probs.append(f"{lang}: 3 partidas de Globos no suman 3 puntos: {pts}")
        C.goto(page, "#/juegos")
        _hoy(page)
        row = page.evaluate(_SCROW)
        if not any(x["k"].startswith(f"{ab}/juego:globos") for x in row):
            probs.append(f"{lang}: tras 3 partidas no sale el atajo de Globos en Hoy: {row}")
        _fits(page, f"{lang}: Hoy con el atajo", probs)
        # 3) Frases mágicas y el sello de la cena
        C.goto(page, "#/frases")
        page.wait_for_selector("#ph-line", timeout=10000)
        page.locator(".ph-tile").first.click()
        page.wait_for_timeout(300)
        st = page.evaluate("() => vocabPhrases.state()")
        if st["placed"] != 0 or st["lang"] != lang or "_" in st["text"] or not st["text"]:
            probs.append(f"{lang}: Frases mágicas: {st}")
        page.wait_for_function("() => !document.querySelector('#ph-line.is-lit')", timeout=8000)
        C.goto(page, "#/frases/cena")
        page.wait_for_selector("#ph-stamp", timeout=8000)
        c1 = page.evaluate(_COINS)
        page.locator("#ph-stamp").click()
        _gate_if_open(page)
        page.wait_for_selector("#ph-done", timeout=6000)
        page.wait_for_timeout(400)
        s = page.evaluate("() => JSON.parse(localStorage.getItem('phrase:stamps') || 'null')")
        if not s or s["n"] != 1 or page.evaluate(_COINS) != c1 + 5:
            probs.append(f"{lang}: el sello: {s}, monedas {c1} → {page.evaluate(_COINS)}")
        # 4) grabar y mandar al Buzón (micrófono y Web Share simulados)
        C.goto(page, "#/buzon")
        page.wait_for_selector("#mb-rb", timeout=6000)
        BZ._record(page)
        page.locator("#mb-send").click()
        _gate_if_open(page)              # «Mandar» pide la Puerta (si no se pasó hace poco)
        page.wait_for_function("() => window.__shared.length === 1", timeout=4000)
        sh = page.evaluate("() => window.__shared[0]")
        if f"#/buzon/responder?l={ab}" not in (sh.get("text") or "") or not sh.get("files"):
            probs.append(f"{lang}: «Mandar»: {sh}")
        # 5) contestar como mayor
        _reply_form(page)
        page.locator("#mb-from").fill("Abuela")
        msg = {"english": "Lovely! I am so proud of you.", "français": "Bravo ! Je suis fière de toi.", "dansk": "Flot! Jeg er stolt af dig."}[lang]
        page.locator("#mb-msg").fill(msg)
        BZ._pick(page, "20")
        page.locator("#mb-make").click()
        _gate_if_open(page, 1200)        # un regalo: la Puerta, salvo la recién resuelta para entrar
        page.wait_for_selector("dialog#mb-res[open]", timeout=4000)
        link = page.locator("#mb-link").input_value()
        o = BZ._unb64(link.split("?d=")[1])
        if o.get("lang") != ab or o.get("gift") != 20 or o.get("msg") != msg or o.get("from") != "Abuela":
            probs.append(f"{lang}: el enlace de la carta: {o}")
        # 6) la carta en otra pestaña limpia (el mismo aparato)
        c2 = page.evaluate(_COINS)
        p2 = ctx.new_page()
        try:
            p2.goto(link, wait_until="domcontentloaded")
            p2.wait_for_function("() => (window.__vocabRouteN || 0) > 0", timeout=20000)
            C.settle(p2, 250)
            p2.wait_for_selector("#mb-open", timeout=8000)
            if C.current_hash(p2) != "carta/" + o["id"]:
                probs.append(f"{lang}: la carta queda en #/{C.current_hash(p2)}")
            p2.locator("#mb-open").click()
            p2.wait_for_selector("#mb-gift:not([hidden])", timeout=9000)
            p2.wait_for_timeout(400)
            said = p2.evaluate("() => window.__said")
            if not any(x["t"] == msg for x in said):
                probs.append(f"{lang}: la voz no lee la carta: {said}")
            C.reload(p2)
            p2.wait_for_timeout(400)
            if p2.evaluate(_COINS) != c2 + 20:
                probs.append(f"{lang}: abrir la carta (y recargar) da {p2.evaluate(_COINS) - c2} monedas (20)")
            probs += [f"{lang} (otra pestaña): {e}" for e in C.errors(p2)]
        finally:
            p2.close()
        # 7) la partida: solo claves de save.js, sin nada de IndexedDB, y se vuelve a cargar
        snap = C.export(page)
        bad = [k for k in snap["keys"] if page.evaluate("k => vocabSave.typeOf(k)", k) is None]
        if bad:
            probs.append(f"{lang}: la exportación lleva claves sin registrar: {bad}")
        txt = json.dumps(snap)
        if "vocab-media" in txt or "ArrayBuffer" in txt or len(txt) > 400_000:
            probs.append(f"{lang}: la exportación lleva cosas de IndexedDB ({len(txt)} caracteres)")
        for k in ("mail:box", "phrase:stamps"):
            if k not in snap["keys"]:
                probs.append(f"{lang}: la exportación no lleva {k}")
        if not page.evaluate("t => vocabSave.parse(t).ok", txt):
            probs.append(f"{lang}: vocabSave.parse() no acepta la exportación")
        probs += [f"{lang}: {e}" for e in C.errors(page)]
    finally:
        ctx.close()
    return probs


def test_tour_english():
    """Inglés: Hoy, la lección siguiente del camino con el teclado (queda en el camino y da monedas), 3 partidas de
    Globos que hacen su atajo en Hoy (y Hoy sin scroll), Frases mágicas (tocar un dibujo completa la frase) y el sello de
    la cena (+5, con la Puerta), grabar y mandar al Buzón (archivo y enlace de respuesta), contestar como mayor con 20
    monedas y abrir la carta en otra pestaña (la voz la lee, paga una vez aunque se recargue). La exportación solo lleva
    claves registradas (mail:box y phrase:stamps incluidas), nada de IndexedDB, y se vuelve a cargar. Sin errores."""
    probs = _tour("english")
    assert not probs, "\n".join(probs)


def test_tour_french():
    """Lo mismo en francés (Enter en Hoy abre la lección que toca)."""
    probs = _tour("français")
    assert not probs, "\n".join(probs)


def test_tour_danish():
    """Lo mismo en danés (sin palabras sabidas: Frases mágicas usa palabras fáciles de un tema)."""
    probs = _tour("dansk")
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- actualización desde la versión publicada (v19)
# main 2e7dc3f (sw vocab-shell-v19): la carpeta de VOCAB_BASE19 si se da (p. ej. un git worktree de ese commit) o, si
# no, una copia sacada del repo con git archive a una carpeta temporal. _published_dir() y _switching_server() valen
# para cualquier versión publicada (test_update_v21.py las usa con main 1f0b356, sw vocab-shell-v21)
_BASE19_COMMIT = "2e7dc3f"
_PUB_TMP = {}
_NEW5 = """() => ({tabbar: !!document.getElementById('tabbar'), granja: typeof ROUTES !== 'undefined' && !!ROUTES.granja,
  shop: typeof window.vocabShop === 'object', rewards: typeof window.vocabRewards === 'object', season: typeof window.vocabSeason === 'object',
  save: !!(window.vocabSave && vocabSave.inventory), keys: !!(window.vocabKeys && vocabKeys.target), sc: !!(window.vocabShortcuts && vocabShortcuts.paint),
  mail: !!(window.vocabMailbox && vocabMailbox.receive), media: !!window.vocabMedia, phr: !!(window.vocabPhrases && vocabPhrases.dinner),
  routes: typeof ROUTES !== 'undefined' && !!ROUTES.buzon && !!ROUTES.carta && !!ROUTES.frases,
  games: !!(window.vocabGames && vocabGames.meta && vocabGames.list().includes('frases') && vocabGames.list().includes('buzon')),
  toast: !!(window.M && M.toast)})"""


def _is_published(d, version, extra=None):
    """¿La carpeta d es una copia de la web con sw.js en esa VERSION (y extra(d), si se da)?"""
    d = Path(d)
    return (d / "index.html").exists() and (d / "sw.js").exists() \
        and f"const VERSION = {version};" in (d / "sw.js").read_text(encoding="utf-8") and (extra is None or extra(d))


def _published_dir(commit, version, env="", extra=None):
    """La versión publicada de ese commit: la carpeta de la variable de entorno env si se da y es esa versión (sw.js con
    «const VERSION = <version>;» y extra(d)) o, si no, una copia del repo sacada con git archive a una carpeta temporal
    (una por commit en cada ejecución; se borra al acabar). None si no se pudo."""
    p = os.environ.get(env, "") if env else ""
    if p and _is_published(p, version, extra):
        return Path(p)
    if commit not in _PUB_TMP:
        d = Path(tempfile.mkdtemp(prefix=f"vocab-base{version}-"))
        atexit.register(shutil.rmtree, d, True)
        arch = subprocess.run(["git", "-C", str(C.REPO), "archive", "--format=tar", commit], capture_output=True)
        if arch.returncode == 0:
            subprocess.run(["tar", "-x", "-C", str(d)], input=arch.stdout, check=True)
        _PUB_TMP[commit] = d
    d = _PUB_TMP[commit]
    return d if _is_published(d, version, extra) else None


def _is_base19(d):
    return _is_published(d, 19, lambda x: not (x / "js" / "keys.js").exists())


def _base19_dir():
    return _published_dir(_BASE19_COMMIT, 19, "VOCAB_BASE19", lambda x: not (x / "js" / "keys.js").exists())


def _switching_server(first, gh_cache):
    """Servidor en localhost que sirve la carpeta roots["cur"] (al principio, first: la versión publicada; para publicar
    esta versión en el mismo origen, roots["cur"] = C.ROOT). Sin cabeceras condicionales y, con gh_cache, con las de
    GitHub Pages (Cache-Control: max-age=600) en lugar de no-store. Devuelve (srv, roots)."""
    roots = {"cur": Path(first)}

    class Handler(C._Quiet):
        def __init__(self, *a, directory=None, **kw):
            super().__init__(*a, directory=str(roots["cur"]), **kw)

        def end_headers(self):
            if gh_cache:
                self.send_header("Cache-Control", "max-age=600")
                super(C._Quiet, self).end_headers()
            else:
                super().end_headers()

        def send_head(self):
            # la carpeta se mira en cada petición y no al abrir la conexión: Chromium abre conexiones de antemano y
            # manda la petición después por ellas (con la carpeta de la conexión, tras «publicar» saldría a veces la
            # versión vieja)
            self.directory = str(roots["cur"])
            # GitHub Pages revalida por el contenido (ETag). Aquí la copia de la versión publicada puede ser más nueva en
            # disco que el repo (un worktree recién sacado), y con If-Modified-Since el servidor diría 304 a ficheros que
            # sí cambiaron: sin cabeceras condicionales, revalidar siempre trae lo que hay ahora
            for h in ("If-Modified-Since", "If-None-Match"):
                if h in self.headers:
                    del self.headers[h]
            return super().send_head()

    srv = C.Server(first, "localhost", handler=Handler)
    return srv, roots


def _v19_then_new(gh_cache):
    """Sirve la versión publicada (main 2e7dc3f con su service worker vocab-shell-v19) en plena temporada de Halloween
    con la partida sembrada; el niño la usa (Hoy, abre una puerta de Truco o trato, la granja, juegos, Premios, un tema).
    Luego se publica esta versión en el mismo origen y el niño vuelve (otro día de la misma temporada sin caché HTTP, o
    recargando en menos de 10 minutos con la de GitHub Pages). Con las voces de Edge simuladas, en la versión publicada
    eligió una voz para inglés (voice:english, que va con la partida): tras actualizar se sigue usando. Devuelve una
    lista de problemas."""
    import test_voces as V
    probs = []
    base_dir = _base19_dir()
    assert base_dir, f"no se pudo sacar la versión publicada (commit {_BASE19_COMMIT}); VOCAB_BASE19=<copia de ese commit>"
    tag = "caché de GitHub Pages" if gh_cache else "sin caché HTTP"
    v, _ = I4._sw_version()
    srv, roots = _switching_server(base_dir, gh_cache)
    ctx = C.new_context("phone", sw=True, server=srv, block_external=not gh_cache, now=HALLOWEEN, reduced_motion="reduce")
    ctx.add_init_script(T._RANDOM)
    ctx.add_init_script(f"{V._FAKE}({json.dumps({'voices': V.EDGE, 'delay': 0}, ensure_ascii=False)})")
    page = ctx.new_page()
    stopped = False
    try:
        C.seed(page, C.seed_keys(HALLOWEEN), now=HALLOWEEN)
        page.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=20000)
        C.reload(page)
        keys0 = page.evaluate("() => caches.keys()")
        if page.evaluate("() => !!window.vocabKeys || !!window.vocabShortcuts") or "vocab-shell-v19" not in keys0:
            probs.append(f"{tag}: la versión publicada no es la de antes (cachés {keys0})")
        # una puerta de Truco o trato (la temporada guarda su clave "season")
        C.goto(page, "#/temporada")
        page.evaluate(T._SPY)
        page.wait_for_selector("#app .ss-door", timeout=8000)
        T._door(page, 0)
        for h in ("#/granja", "#/juegos", "#/progreso", "#/doc/animales", "#/"):
            C.goto(page, h)
            page.wait_for_timeout(250)
        # la voz de inglés elegida en Ajustes de la versión publicada (se guardaba en voice:english, con la partida)
        page.evaluate("n => store.set('voice:english', n)", _HAZEL)
        v19 = page.evaluate("() => (voiceFor('en-GB') || {}).name")
        if v19 != _HAZEL:
            probs.append(f"{tag}: la versión publicada no usa la voz elegida: {v19}")
        old = page.evaluate(I4._STORE)
        old_snap = C.export(page)
        if "season" not in old:
            probs.append(f"{tag}: la versión publicada no guardó la puerta de Halloween")
        old_media = page.evaluate("async () => (await (await caches.open('vocab-media')).keys()).map(r => new URL(r.url).pathname)")
        # se publica esta versión
        roots["cur"] = C.ROOT
        C.clear_errors(page)
        if gh_cache:
            page.reload(wait_until="domcontentloaded")
        else:
            page.goto(C.base_url(page) + "/", wait_until="domcontentloaded")
        page.wait_for_function("() => (window.__vocabRouteN || 0) > 0", timeout=20000)
        page.wait_for_timeout(800)
        first = page.evaluate(_NEW5)
        if not all(first.values()):
            probs.append(f"{tag}: la primera carga tras publicar mezcla versiones o es la vieja: {first}")
        t0 = time.time()
        keys = []
        while time.time() - t0 < 25:
            keys = page.evaluate("() => caches.keys()")
            if f"vocab-shell-v{v}" in keys and "vocab-shell-v19" not in keys:
                break
            page.wait_for_timeout(250)
        if f"vocab-shell-v{v}" not in keys or "vocab-media" not in keys or "vocab-shell-v19" in keys:
            probs.append(f"{tag}: el service worker nuevo no se instaló o no borró vocab-shell-v19: {keys}")
        media = set(page.evaluate("async () => (await (await caches.open('vocab-media')).keys()).map(r => new URL(r.url).pathname)"))
        lost = [p for p in old_media if p not in media]
        if lost:
            probs.append(f"{tag}: se perdieron dibujos, audios o datos de vocab-media: {lost[:5]}")
        shell = set(page.evaluate(f"async () => (await (await caches.open('vocab-shell-v{v}')).keys()).map(r => new URL(r.url).pathname)"))
        miss = [f for f in _FILES if "/" + f not in shell]
        if miss:
            probs.append(f"{tag}: el shell nuevo no guardó {miss}")
        C.reload(page)
        again = page.evaluate(_NEW5)
        if not all(again.values()):
            probs.append(f"{tag}: tras recargar con el sw nuevo no está la app nueva entera: {again}")
        if not page.evaluate("() => navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL"):
            probs.append(f"{tag}: la página no la controla el service worker nuevo")
        # la partida, la granja y la temporada intactas
        C.goto(page, "#/granja")
        page.wait_for_selector("#app .fm-stage .fm-it", timeout=9000)
        page.wait_for_timeout(400)
        farm = json.loads(old["farm:state"])
        shop = {x["id"]: x for x in json.loads((C.ROOT / "data" / "game.json").read_text(encoding="utf-8"))}
        owned_farm = sorted(i for i in json.loads(old["game"])["owned"] if shop.get(i, {}).get("t") == "farm")
        scene = page.evaluate("() => [...document.querySelectorAll('#app .fm-layer > .fm-it[data-fid]')].map(e => e.dataset.fid)")
        if sorted(scene) != owned_farm:
            probs.append(f"{tag}: la granja nueva no enseña lo comprado: {sorted(scene)} ≠ {owned_farm}")
        if json.loads(page.evaluate("() => localStorage.getItem('farm:state')"))["pos"] != farm["pos"]:
            probs.append(f"{tag}: cambian los sitios guardados de la granja")
        C.goto(page, "#/temporada")
        page.wait_for_selector("#app .ss-door", timeout=8000)
        page.wait_for_timeout(300)
        if not page.evaluate("() => { const s = vocabSeason.state.street; return !!s && s.run.ok.includes(0); }"):
            probs.append(f"{tag}: tras actualizar, la puerta abierta de Halloween ya no está abierta")
        C.goto(page, "")
        page.wait_for_timeout(500)
        new = page.evaluate(I4._STORE)
        device = ("vocab:ui", "phrase:day", "vocab:sc")
        for k in sorted(set(old) | set(new)):
            if k in device or k.startswith("album:uniq:"):
                continue
            if old.get(k) != new.get(k):
                if k == "farm:state":
                    a, b = json.loads(old[k]), json.loads(new.get(k) or "{}")
                    a.pop("visit", None), b.pop("visit", None), a.pop("ls", None), b.pop("ls", None)
                    if a == b:
                        continue
                    probs.append(f"{tag}: cambia farm:state: {[x for x in set(a) | set(b) if a.get(x) != b.get(x)]}")
                elif k not in old:
                    probs.append(f"{tag}: clave nueva {k}")
                else:
                    probs.append(f"{tag}: cambia o falta {k}")
        d = [x for x in C.diff_exports(old_snap, C.export(page), allow_new=False)
             if not x.startswith("cambia 'album:uniq:") and not x.startswith("cambia 'farm:state'")]
        if d:
            probs.append(f"{tag}: la exportación tras actualizar no es la de la versión publicada: {d}")
        probs += _after_update_voice_and_new_keys(page, tag, old, old_snap)
        for h, sel in (("#/buzon", "#mb-rb"), ("#/frases", "#ph-line"), ("#/juegos", ".gm-card[data-g=buzon]"),
                       ("#/progreso", "#rw .rw-meds"), ("#/mizorro", "#mz-shop .sc")):
            C.goto(page, h)
            try:
                page.wait_for_selector(sel, timeout=8000)
            except Exception:  # noqa: BLE001
                probs.append(f"{tag}: tras actualizar {h} no pinta")
        errs = C.errors(page)
        if errs:
            probs.append(f"{tag}: errores tras publicar: {errs[:5]}")
        # sin conexión: el servidor parado sirve la app nueva (y lo nuevo de F5) desde vocab-shell
        srv.stop()
        stopped = True
        ctx.set_offline(True)
        C.clear_errors(page)
        C.reload(page)
        offl = page.evaluate(_NEW5)
        if not all(offl.values()):
            probs.append(f"{tag}: sin conexión no sale la app nueva entera: {offl}")
        for h, sel in (("#/frases", "#ph-line"), ("#/buzon", "#mb-rb"), ("#/juegos", ".gm-card[data-g=frases] img")):
            C.goto(page, h)
            try:
                page.wait_for_selector(sel, timeout=8000)
            except Exception:  # noqa: BLE001
                probs.append(f"{tag}: sin conexión {h} no pinta")
        if not page.evaluate("() => { const i = document.querySelector('.gm-card[data-g=frases] img'); return !!i && i.complete && i.naturalWidth > 0; }"):
            probs.append(f"{tag}: sin conexión no sale el dibujo de Frases mágicas")
    finally:
        try:
            ctx.set_offline(False)
        except Exception:  # noqa: BLE001
            pass
        ctx.close()
        if not stopped:
            srv.stop()
    return probs


def _after_update_voice_and_new_keys(page, tag, old, old_snap):
    """Tras actualizar desde v19: la voz elegida antes (voice:english = Hazel) se respeta (sin crear vocab:voice ni tocar
    voice:english) y Frases mágicas suena con ella; elegir otra en este aparato la guarda en vocab:voice, que manda, no va
    en la exportación y deja voice:english como estaba; las claves nuevas de F5 (sc:prefs al fijar un atajo, mail:box al
    llegar una carta, phrase:stamps al sellar la frase de la cena) se crean al usarse y van en la exportación."""
    probs = []
    vo = page.evaluate("""() => ({pick: (pickVoice('english') || {}).name, vf: (voiceFor('en-GB') || {}).name, ch: voiceChoiceOf('english'),
      own: localStorage.getItem('vocab:voice'), old: localStorage.getItem('voice:english')})""")
    if vo["pick"] != _HAZEL or vo["vf"] != _HAZEL or vo["ch"] != {"n": _HAZEL, "own": False} or vo["own"] is not None \
            or vo["old"] != old.get("voice:english") or not vo["old"]:
        probs.append(f"{tag}: tras actualizar no se respeta la voz elegida antes (voice:english): {vo}")
    try:
        C.goto(page, "#/frases")
        page.wait_for_selector(".ph-tile", timeout=8000)
        page.evaluate("() => { window.__spoken.length = 0; }")
        page.locator(".ph-tile").first.click()
        sp = _said(page, "s.text.trim().length > 2")
        if any(x["voice"] != _HAZEL or x["lang"] != "en-GB" for x in sp):
            probs.append(f"{tag}: tras actualizar Frases mágicas no suena con la voz elegida antes: {sp}")
        page.wait_for_function("() => !document.querySelector('#ph-line.is-lit')", timeout=8000)
    except Exception as e:  # noqa: BLE001
        probs.append(f"{tag}: tras actualizar Frases mágicas no habla: {str(e).splitlines()[0]}")
    # otra voz elegida en este aparato
    page.evaluate("n => setVoiceChoice('english', n)", _GEORGE)
    nv = page.evaluate("""() => ({pick: (pickVoice('english') || {}).name, own: JSON.parse(localStorage.getItem('vocab:voice') || 'null'),
      old: localStorage.getItem('voice:english')})""")
    if nv["pick"] != _GEORGE or nv["own"] != {"english": _GEORGE} or nv["old"] != old.get("voice:english"):
        probs.append(f"{tag}: elegir otra voz tras actualizar: {nv}")
    try:
        C.goto(page, "#/buzon")
        page.wait_for_selector("#mb-spk", timeout=8000)
        page.evaluate("() => { window.__spoken.length = 0; }")
        page.locator("#mb-spk").click()
        sp = _said(page, "s.text.trim().length > 2")
        if any(x["voice"] != _GEORGE for x in sp):
            probs.append(f"{tag}: el Buzón no suena con la voz elegida ahora: {sp}")
    except Exception as e:  # noqa: BLE001
        probs.append(f"{tag}: el Buzón no habla: {str(e).splitlines()[0]}")
    # las claves nuevas de F5, al usarse
    page.evaluate("() => vocabShortcuts.pin('en/juego:globos', true)")
    page.evaluate("o => vocabMailbox.receive(o)", dict(LET, id="cartaTrasV19"))
    try:
        C.goto(page, "#/frases/cena")
        page.wait_for_selector("#ph-stamp", timeout=8000)
        page.evaluate(_PASS)
        page.locator("#ph-stamp").click()
        _gate_if_open(page)
        page.wait_for_selector("#ph-done", timeout=6000)
    except Exception as e:  # noqa: BLE001
        probs.append(f"{tag}: tras actualizar no se puede sellar la frase de la cena: {str(e).splitlines()[0]}")
    page.wait_for_timeout(300)
    ls = C.storage(page)
    snap = C.export(page)
    ks = snap["keys"]
    for k, ok in (("sc:prefs", lambda v: "en/juego:globos" in v["pinned"]), ("mail:box", lambda v: any(x["id"] == "cartaTrasV19" for x in v["l"])),
                  ("phrase:stamps", lambda v: v["n"] == 1)):
        try:
            good = ok(json.loads(ls[k])) and ks.get(k) == ls[k]
        except Exception:  # noqa: BLE001
            good = False
        if not good:
            probs.append(f"{tag}: {k} tras usarse: guardada {_short(ls.get(k))}, en la exportación {_short(ks.get(k))}")
    if "vocab:voice" in ks:
        probs.append(f"{tag}: vocab:voice (de este aparato) va en la exportación")
    if ks.get("voice:english") != old_snap["keys"].get("voice:english"):
        probs.append(f"{tag}: cambia voice:english en la exportación: {ks.get('voice:english')}")
    extra = C.new_keys(old_snap, snap)
    if sorted(extra) != ["mail:box", "phrase:stamps", "sc:prefs"]:
        probs.append(f"{tag}: claves nuevas en la exportación: {sorted(extra)}")
    return probs


def _short(s, n=120):
    s = "" if s is None else str(s)
    return s if len(s) <= n else s[:n] + "…"


def test_update_from_published_v19():
    """Un niño con la versión publicada (main 2e7dc3f, sw vocab-shell-v19), la partida sembrada y una puerta de Halloween
    abierta abre la app nueva otro día: se carga la app nueva entera (los módulos de F5 incluidos), el sw nuevo se
    instala (vocab-shell-v<VERSION> con los ficheros nuevos, sin vocab-shell-v19, vocab-media entera) y controla la
    página; la partida queda igual (cada clave, y la exportación como la de la versión publicada), la voz de inglés
    elegida en la versión publicada se sigue usando (y una elegida ahora en este aparato manda sin ir en la
    exportación), las claves nuevas de F5 se crean al usarse y van en la exportación, la granja enseña lo comprado en su
    sitio, la puerta de Halloween sigue abierta, el Buzón, Frases, Juegos, Medallas y Mi zorro pintan, y sin conexión
    sale la app nueva con Frases mágicas y el Buzón. Sin errores."""
    probs = _v19_then_new(gh_cache=False)
    assert not probs, "\n".join(probs)


def test_update_from_v19_with_github_pages_http_cache():
    """Lo mismo con las cabeceras de GitHub Pages (Cache-Control: max-age=600) y la caché HTTP del navegador: el niño
    tenía la app abierta al publicar y recarga en menos de 10 minutos. Los <script> llevan «?v=<VERSION>», así que ningún
    módulo viejo sale de la caché HTTP: la primera carga ya es la app nueva entera y sin errores."""
    probs = _v19_then_new(gh_cache=True)
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- voces de F5 (unión con fix-voces)
_HAZEL = "Microsoft Hazel - English (United Kingdom)"
_HORTENSE = "Microsoft Hortense - French (France)"
_SONIA = "Microsoft Sonia Online (Natural) - English (United Kingdom)"
_GEORGE = "Microsoft George - English (United Kingdom)"
_ELVIRA = "Microsoft Elvira Online (Natural) - Spanish (Spain)"
_SPOKEN = "() => window.__spoken.filter(s => s.text.trim())"


def _said(page, pred_js, ms=6000):
    """Espera a que __spoken (test_voces._FAKE) tenga una frase que cumpla pred_js (texto JS con s) y la devuelve."""
    page.wait_for_function(f"() => window.__spoken.some(s => {pred_js})", timeout=ms)
    return page.evaluate(f"() => window.__spoken.filter(s => {pred_js})")


def test_f5_voices_use_the_voice_of_each_language():
    """Las voces de F5 eligen la voz con la función central de index.html (useVoice), la de su idioma en este aparato:
    con Edge y la voz elegida en Ajustes (vocab:voice: Hazel para inglés, Hortense para francés), Frases mágicas, la frase
    de la cena, la plantilla del Buzón y una carta en inglés suenan con Hazel (lang en-GB); una carta en francés con
    Hortense aunque aprenda inglés; una en español con la mejor voz española (Elvira, es-ES); el toque que desbloquea la
    voz (un atajo de un juego en Hoy, la tarjeta de un juego) lleva la voz del idioma. En francés, Frases y el Buzón con
    Hortense. Si la voz elegida es de internet y falla (Sonia sin red), Frases lo dice otra vez con una del aparato y
    sigue. Sin errores."""
    import test_voces as V
    probs = []
    choice = {"english": _HAZEL, "français": _HORTENSE}
    page = V._page(V.EDGE, lang="english", reduced_motion="reduce",
                   keys={"vocab:voice": choice, "vocab:ui": _HINTS, "vocab:sc": _sc(C.day_num(C.FIXED_NOW))})
    try:
        page.evaluate("() => sessionStorage.setItem('__mic', 'ok')")
        # Frases mágicas: una ficha en el hueco y la frase entera con la voz elegida
        C.goto(page, "#/frases")
        page.wait_for_selector(".ph-tile", timeout=8000)
        page.evaluate("() => { window.__spoken.length = 0; }")
        page.locator(".ph-tile").first.click()
        sp = _said(page, "s.text.trim().length > 2")
        if any(x["voice"] != _HAZEL or x["lang"] != "en-GB" for x in sp):
            probs.append(f"Frases mágicas no usa la voz elegida del inglés: {sp}")
        # la frase de la cena
        C.goto(page, "#/frases/cena")
        page.wait_for_selector("#ph-say", timeout=8000)
        page.evaluate("() => { window.__spoken.length = 0; }")
        page.locator("#ph-say").click()
        sp = _said(page, "s.text.trim().length > 2")
        if any(x["voice"] != _HAZEL for x in sp):
            probs.append(f"la frase de la cena no usa la voz elegida: {sp}")
        # el Buzón: la plantilla
        C.goto(page, "#/buzon")
        page.wait_for_selector("#mb-spk", timeout=8000)
        page.evaluate("() => { window.__spoken.length = 0; }")
        page.locator("#mb-spk").click()
        sp = _said(page, "s.text.trim().length > 2")
        if any(x["voice"] != _HAZEL or x["lang"] != "en-GB" for x in sp):
            probs.append(f"la plantilla del Buzón no usa la voz elegida: {sp}")
        # cartas en inglés, en francés y en español
        for lt, want, lang_tag in ((dict(LET, id="cartaVozEn01"), _HAZEL, "en-GB"),
                                   ({"v": 1, "id": "cartaVozFr01", "from": "Mamie", "msg": "Bravo ! Je suis très fière de toi, mon petit.", "lang": "fr", "lock": "les3"}, _HORTENSE, "fr-FR"),
                                   ({"v": 1, "id": "cartaVozEs01", "from": "Abuela", "msg": "¡Qué bien lo haces! Estoy muy orgullosa de ti.", "lang": "en", "lock": "les3"}, _ELVIRA, "es-ES")):
            page.evaluate("o => vocabMailbox.receive(o)", lt)
            if "lock" in lt:
                # el candado, ya cumplido: la carta se abre como las demás
                page.evaluate("id => { const b = JSON.parse(localStorage.getItem('mail:box')); const l = b.l.find(x => x.id === id); l.b = -99; l.u = l.at; localStorage.setItem('mail:box', JSON.stringify(b)); }", lt["id"])
            C.goto(page, "#/carta/" + lt["id"])
            try:
                page.wait_for_selector("#mb-open", timeout=6000)
                page.locator("#mb-open").click()
                page.wait_for_selector("#mb-say", timeout=6000)
                page.wait_for_timeout(1200)
                # el altavoz de la carta (la de regalo ya se leyó sola al abrirla: aquí, otra vez con el botón)
                page.evaluate("() => { speechSynthesis.cancel(); window.__spoken.length = 0; }")
                page.locator("#mb-say").click()
                sp = _said(page, f"s.text === {json.dumps(lt['msg'])}", ms=9000)
                if any(x["voice"] != want or x["lang"] != lang_tag for x in sp):
                    probs.append(f"la carta {lt['id']} no suena con {want} ({lang_tag}): {sp}")
            except Exception as e:  # noqa: BLE001
                probs.append(f"la carta {lt['id']} no se lee: {str(e).splitlines()[0]} · {page.evaluate(_SPOKEN)}")
        # el toque que desbloquea la voz: un atajo de juego en Hoy y una tarjeta de Juegos (con la voz del idioma; desde
        # v24, en Android ese « » no llega al motor: solo hace falta en iPhone y iPad, y en Android puede atascar la voz)
        andr = page.evaluate("() => /Android/i.test(navigator.userAgent)")
        _hoy(page)
        _hoy(page)
        if page.locator("#hm-sc .sc-p[data-game]").count():
            page.evaluate("() => { window.__spoken.length = 0; }")
            page.locator("#hm-sc .sc-p[data-game]").first.click()
            page.wait_for_timeout(300)
            un = page.evaluate("() => window.__spoken.filter(s => !s.text.trim())")
            if un if andr else (not un or any(x["voice"] != _HAZEL for x in un)):
                probs.append(f"el atajo de un juego desbloquea la voz sin la voz del idioma: {un}")
        else:
            probs.append(f"Hoy sin atajos de juego: {page.evaluate(_SCROW)}")
        C.goto(page, "#/juegos")
        page.wait_for_selector(".gm-card[data-g=globos]", timeout=8000)
        page.evaluate("() => { window.__spoken.length = 0; }")
        page.locator(".gm-card[data-g=globos]").click()
        page.wait_for_timeout(300)
        un = page.evaluate("() => window.__spoken.filter(s => !s.text.trim())")
        if un if andr else (not un or any(x["voice"] != _HAZEL for x in un)):
            probs.append(f"la tarjeta de un juego desbloquea la voz sin la voz del idioma: {un}")
        probs += [f"inglés: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    # en francés: Frases y el Buzón con Hortense
    page = V._page(V.EDGE, lang="français", reduced_motion="reduce", keys={"vocab:voice": choice, "vocab:ui": _HINTS})
    try:
        C.goto(page, "#/frases")
        page.wait_for_selector(".ph-tile", timeout=8000)
        page.evaluate("() => { window.__spoken.length = 0; }")
        page.locator(".ph-tile").first.click()
        sp = _said(page, "s.text.trim().length > 2")
        if any(x["voice"] != _HORTENSE or x["lang"] != "fr-FR" for x in sp):
            probs.append(f"francés: Frases mágicas no usa Hortense: {sp}")
        C.goto(page, "#/buzon")
        page.wait_for_selector("#mb-spk", timeout=8000)
        page.evaluate("() => { window.__spoken.length = 0; }")
        page.locator("#mb-spk").click()
        sp = _said(page, "s.text.trim().length > 2")
        if any(x["voice"] != _HORTENSE for x in sp):
            probs.append(f"francés: la plantilla del Buzón no usa Hortense: {sp}")
        probs += [f"francés: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    # una voz de internet que falla: Frases lo repite con una del aparato y la cadena sigue
    page = V._page(V.EDGE, lang="english", reduced_motion="reduce", keys={"vocab:voice": {"english": _SONIA}, "vocab:ui": _HINTS})
    try:
        C.goto(page, "#/frases")
        page.wait_for_selector(".ph-tile", timeout=8000)
        page.evaluate("""() => { window.__spoken.length = 0; const ss = window.speechSynthesis, sp = ss.speak;
          ss.speak = u => { if (u.voice && u.voice.localService === false && u.text.trim()) { window.__spoken.push({text: u.text, lang: u.lang, voice: u.voice.name, fail: true});
            setTimeout(() => u.onerror && u.onerror({error: 'network'}), 10); } else sp(u); }; }""")
        page.locator(".ph-tile").first.click()
        page.wait_for_function("() => window.__spoken.some(s => s.fail) && window.__spoken.some(s => !s.fail && s.text.trim())", timeout=8000)
        page.wait_for_function("() => !document.querySelector('#ph-line.is-lit')", timeout=8000)
        sp = page.evaluate(_SPOKEN)
        loc = [x for x in sp if not x.get("fail")]
        if not sp or sp[0]["voice"] != _SONIA or not loc or any("Online" in (x["voice"] or "") for x in loc):
            probs.append(f"la voz de internet que falla no se repite con una del aparato: {sp}")
        probs += [f"reintento: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    # la carta: la voz de internet falla tarde (4,5 s) y la del aparato la lee entera (3 s): el reloj de seguridad se
    # vuelve a armar, así que el regalo sale al acabar y nada corta esa segunda lectura
    page = V._page(V.EDGE, lang="english", reduced_motion="reduce", keys={"vocab:voice": {"english": _SONIA}, "vocab:ui": _HINTS})
    try:
        page.evaluate("o => vocabMailbox.receive(o)", dict(LET, id="cartaReint01"))
        C.goto(page, "#/carta/cartaReint01")
        page.wait_for_selector("#mb-open", timeout=8000)
        page.evaluate("""() => { const ss = window.speechSynthesis, t0 = performance.now(), L = window.__lg = [], log = (k, x) => L.push([Math.round(performance.now() - t0), k, x || '']);
          let cur = null;
          ss.speak = u => { if (!u.text.trim()) { setTimeout(() => u.onend && u.onend({}), 5); return; }
            if (u.voice && u.voice.localService === false) { log('net', u.voice.name); setTimeout(() => { log('neterr'); u.onerror && u.onerror({type: 'error', error: 'network'}); }, 4500); return; }
            log('local', u.voice ? u.voice.name : '-'); cur = u; u.__t = setTimeout(() => { if (cur === u) cur = null; log('end'); u.onend && u.onend({}); }, 3000); };
          ss.cancel = () => { if (cur) { const u = cur; cur = null; clearTimeout(u.__t); log('cancel-local'); u.onerror && u.onerror({type: 'error', error: 'interrupted'}); } };
          new MutationObserver(() => { const g = document.getElementById('mb-gift'); if (g && !g.hidden && !window.__g) { window.__g = 1; log('gift'); } })
            .observe(document.body, {subtree: true, childList: true, attributes: true}); }""")
        page.locator("#mb-open").click()
        page.wait_for_function("() => window.__lg.some(x => x[1] === 'gift')", timeout=15000)
        page.wait_for_timeout(900)
        lg = page.evaluate("() => window.__lg")
        t = {k: next((x[0] for x in lg if x[1] == k), None) for k in ("neterr", "local", "end", "gift", "cancel-local")}
        if t["local"] is None or t["neterr"] is None or t["end"] is None or t["gift"] is None or t["gift"] < t["end"] \
                or (t["cancel-local"] is not None and t["cancel-local"] < t["end"]):
            probs.append(f"la carta: el reintento con la voz del aparato se corta o el regalo sale antes de acabar: {lg}")
        probs += [f"carta reintento: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- capturas de F5
def test_captures_f5():
    """Capturas con nombre descriptivo en capturas/F5 (F5-*.png), móvil salvo la lección con etiquetas (escritorio):
    Hoy con «Tus atajos», la hoja Fijar/No sugerir, la pregunta de la tortuga, la hoja «Teclas», la lección con las
    etiquetas de las teclas, el Buzón (frases, grabando y grabado), el formulario del mayor, la carta con regalo y con
    candado, el sobre en Hoy, Frases mágicas (hueco vacío y frase completa), la frase de la cena en Hoy y el sello; Hoy
    con todo a la vez (móvil, oscuro y tableta), y Hoy y Frases en oscuro. En cada una: contraste suficiente y sin
    colores fuera de la paleta. Sin errores."""
    probs = []

    def snap(page, name):
        page.evaluate(_FINISH)
        page.wait_for_timeout(200)
        a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
        for x in a["contrast"] + a["palette"]:
            probs.append(f"{name}: {x}")
        C.shot(page, name, OUT, full_page=False)

    # Hoy con atajos, editar, tortuga, Teclas, el sobre, la frase de la cena
    page = BZ._page(share=True, reduced_motion="reduce")
    try:
        C.seed(page, _keys())
        page.evaluate("() => sessionStorage.setItem('__mic', 'ok')")
        _hoy(page)                                  # Hoy otra vez, con la frase de la cena
        page.wait_for_selector("#hm-sc .sc-p", timeout=6000)
        snap(page, "F5-hoy-atajos-phone-light")
        if page.locator("#ph-hrow").count():
            snap(page, "F5-hoy-frase-cena-phone-light")
        else:
            probs.append(f"la frase de la cena no sale en Hoy: {page.evaluate(_SLOTS)}")
        SC._hold(page, "#hm-sc .sc-p[data-sc]")
        try:
            page.wait_for_selector("dialog#sc-sheet[open]", timeout=4000)
            page.wait_for_timeout(400)
            snap(page, "F5-atajos-fijar-no-sugerir-phone-light")
            SC._close_sheet(page)
        except Exception:  # noqa: BLE001
            probs.append("mantener pulsado un atajo no abre su hoja")
        page.evaluate("() => vocabShortcuts.askSlow(true)")
        try:
            page.wait_for_selector("dialog#sc-slow[open]", timeout=4000)
            page.wait_for_timeout(400)
            snap(page, "F5-tortuga-pregunta-phone-light")
            page.locator("dialog#sc-slow [data-no]").click()
            page.wait_for_function("() => !document.querySelector('dialog#sc-slow[open]')", timeout=4000)
        except Exception:  # noqa: BLE001
            probs.append("no sale la pregunta de la tortuga")
        page.keyboard.press("?")
        page.wait_for_selector("dialog#kb-help[open]", timeout=4000)
        page.wait_for_timeout(400)
        snap(page, "F5-hoja-teclas-phone-light")
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.querySelector('dialog#kb-help[open]')", timeout=4000)
        page.evaluate("o => vocabMailbox.receive(o)", LET)
        _hoy(page)
        page.wait_for_selector("[data-slot=mail]", timeout=6000)
        snap(page, "F5-hoy-sobre-phone-light")
        # el Buzón: frases, grabando, grabado
        C.goto(page, "#/buzon")
        page.wait_for_selector("#mb-rb", timeout=6000)
        snap(page, "F5-buzon-frases-phone-light")
        page.locator("#mb-rb").click()
        page.wait_for_function("() => document.querySelector('#mb-rb.is-rec')", timeout=4000)
        page.clock.fast_forward(6000)
        page.wait_for_timeout(200)
        C.shot(page, "F5-buzon-grabando-phone-light", OUT, full_page=False, animations="allow")
        page.locator("#mb-rb").click()
        page.wait_for_selector("#mb-send", timeout=5000)
        snap(page, "F5-buzon-grabado-phone-light")
        # el formulario del mayor
        _reply_form(page)
        page.locator("#mb-from").fill("Tío Juan")
        page.locator("#mb-to").fill("Lucía")
        page.locator("#mb-msg").fill("Well done! I loved your message.")
        BZ._pick(page, "50")
        page.wait_for_timeout(400)
        page.evaluate("() => scrollTo(0, 0)")
        # el formulario entero: un móvil tan alto como la página (en una captura de página entera, la barra de abajo,
        # que es fija, se quedaría en medio del formulario)
        vp = page.viewport_size
        page.set_viewport_size({"width": vp["width"], "height": max(vp["height"], page.evaluate("() => document.documentElement.scrollHeight"))})
        page.wait_for_timeout(400)
        snap(page, "F5-buzon-contestar-phone-light")
        page.set_viewport_size(vp)
        page.wait_for_timeout(200)
        # la carta con regalo y con candado
        C.goto(page, "#/carta/" + LET["id"])
        page.locator("#mb-open").click()
        page.wait_for_selector("#mb-gift:not([hidden])", timeout=9000)
        page.wait_for_timeout(2600)
        snap(page, "F5-carta-regalo-phone-light")
        page.evaluate("o => vocabMailbox.receive(o)", LOCK)
        C.goto(page, "#/carta/" + LOCK["id"])
        page.wait_for_timeout(500)
        snap(page, "F5-carta-candado-phone-light")
        # Frases mágicas: hueco vacío, frase completa y el sello
        C.goto(page, "#/frases")
        page.wait_for_selector("#ph-line", timeout=8000)
        snap(page, "F5-frases-hueco-phone-light")
        page.locator(".ph-tile").first.click()
        page.wait_for_function("() => !document.querySelector('#ph-line.is-lit')", timeout=8000)
        snap(page, "F5-frases-completa-phone-light")
        C.goto(page, "#/frases/cena")
        page.wait_for_selector("#ph-stamp", timeout=6000)
        page.evaluate(_PASS)
        page.locator("#ph-stamp").click()
        page.wait_for_selector("#ph-done", timeout=6000)
        page.wait_for_timeout(2600)
        page.evaluate("() => document.getElementById('ph-cena').scrollIntoView({block: 'center'})")
        snap(page, "F5-frases-sello-phone-light")
        probs += [f"móvil claro: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    # Hoy con todo a la vez (móvil claro y oscuro, tableta) y Hoy y Frases en oscuro
    for name, kind, kw in (("F5-hoy-todo-phone-light", "phone", {}), ("F5-hoy-todo-phone-dark", "phone", {"color_scheme": "dark"}),
                           ("F5-hoy-todo-tableta-light", "phone", {"viewport": {"width": 820, "height": 1180}})):
        page = C.new_page(kind, now=HALLOWEEN, reduced_motion="reduce", **kw)
        try:
            _all_at_once(page)
            snap(page, name)
            probs += [f"{name}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    page = BZ._page(color_scheme="dark", reduced_motion="reduce")
    try:
        C.seed(page, _keys())
        _hoy(page)
        snap(page, "F5-hoy-phone-dark")
        C.goto(page, "#/frases")
        page.wait_for_selector("#ph-line", timeout=8000)
        page.locator(".ph-tile").first.click()
        page.wait_for_function("() => !document.querySelector('#ph-line.is-lit')", timeout=8000)
        snap(page, "F5-frases-phone-dark")
        probs += [f"oscuro: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    # la lección con las etiquetas de las teclas (escritorio)
    page = BZ._page("desk", reduced_motion="reduce")
    try:
        C.seed(page, _keys())
        C.goto(page, "#/leccion/" + R.LESSON)
        page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-page')", timeout=9000)
        page.wait_for_timeout(900)
        page.evaluate(K._BLUR)
        page.keyboard.press("Space")
        page.wait_for_timeout(500)
        if not page.evaluate(K._TAGS):
            probs.append("la lección no enseña las etiquetas de las teclas")
        snap(page, "F5-leccion-teclas-desk-light")
        probs += [f"lección escritorio: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
