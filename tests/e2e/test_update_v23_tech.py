"""La actualización desde la versión publicada ahora (main 4185280, sw.js VERSION 23, cachés vocab-shell-v23 y
vocab-media) a esta (VERSION 24: Tech Prep S1, la sección escondida de mayores) en el mismo origen.

Dos niños con la v23 y la partida sembrada (C.seed), como en test_update_v22.py:
- Lucía, con un mayor conectado a Google (GIS y Drive de mentira, sin red): el permiso caducó y hay cambios sin subir.
  En la v23 usa Hoy, un repaso de 3 tarjetas y la granja por enlaces (nada que renueve el permiso), y tiene un mensaje
  del Buzón grabado (IndexedDB "vocab-media-user"). Nunca tocó el interruptor de la IPA.
- Leo, sin Google; un mayor apagó en la v23 «Mostrar pronunciación (IPA)» (vocab:ui {ipa: false}).
Se publica esta versión y los dos vuelven: sin caché HTTP (abren la app otra vez) o con la de GitHub Pages
(Cache-Control: max-age=600; recargan antes de 10 minutos). Se comprueba que la primera carga ya es la app nueva entera
(cada módulo de js/ que se ejecuta es el de esta versión con «?v=24», también js/tech-boot.js), que el sw nuevo se
instala y controla (vocab-shell-v24 con todo SHELL; js/tech.js, js/tech-lesson.js y js/tech-pages.js en SHELL o en LAZY, sin
vocab-shell-v23, vocab-media sin perder nada), que la partida queda igual (cada clave de localStorage y la exportación
como en la v23, sin claves nuevas: tampoco ninguna tech:…), que la granja tiene los mismos animales con el mismo hambre,
que el mensaje grabado sigue en IndexedDB, que la IPA se ve de serie para Lucía y que para Leo sigue apagada hasta que un
mayor la enciende, y que el siguiente toque seguro de Lucía (una pestaña) pide el permiso dentro del toque y sube la
partida de la v23 tal cual (el guardado sigue igual).
Tech Prep sale apagado: sin entrada en el menú de la bandera, #/tech… va a #/, ninguna ruta tech en ROUTES y la página
solo pide js/tech-boot.js (ni js/tech.js ni data/tech/…). Un mayor lo enciende en Ajustes › Para mayores en el aparato de
Leo, entra por el menú (la Puerta), los módulos llegan con «?v=24», hace parte de una lección, pide «Download for
offline» y, con el servidor parado y sin red, Tech Prep sigue: Today, una unidad que nunca abrió con red, el glosario,
una lección, un caso modelo; luego vuelve a los idiomas y lo apaga. La partida de Leo sigue igual que en la v23 después de
usar Tech Prep. Sin errores de consola ni de página.

La versión publicada: la carpeta de VOCAB_BASE23 (una copia de 4185280, p. ej. un git worktree) o, si no, una copia
sacada del repo con git archive a una carpeta temporal (test_f5_int._published_dir)."""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

import common as C
import tech_common as TC
import test_f2_ajustes as A
import test_f3_repaso as V
import test_f4_int as I4
import test_f5_buzon as BZ
import test_f5_int as F5
import test_ipa as IPA
import test_tech_lesson as TL
import test_update_v21 as U
import test_update_v22 as U22

OUT = C.CAPTURAS / "v24"
_BASE23_COMMIT = "4185280"
_OLD_SHELL = "vocab-shell-v23"
NOW_MS = A.NOW_MS
MIN = A.MIN
_CASE = json.loads((TC.DATA / "cases.json").read_text(encoding="utf-8"))["cases"][0]["id"]
_TECH_MODS = ["js/tech.js", "js/tech-lesson.js", "js/tech-pages.js"]

# la v23 de verdad: la de F6 (el cazador, las llamadas), OFF_SHELL v23 y nada de Tech Prep
_V23 = """() => ({ipa: typeof ipaOn === 'function', sync: !!(window.vocabSync && typeof vocabSync.tapDue === 'function'),
  off: typeof OFF_SHELL !== 'undefined' && OFF_SHELL === 'vocab-shell-v23', f6: !!window.vocabHunter && !!window.vocabCalls,
  noTech: !window.vocabTech})"""
# Tech Prep apagado: el arranque está (vocabTech) pero nada más
_TECH_OFF = """() => ({boot: !!(window.vocabTech && typeof vocabTech.on === 'function'), on: !!(window.vocabTech && vocabTech.on()),
  loaded: !!(window.vocabTech && vocabTech.loaded), routes: Object.keys(ROUTES).filter(k => /^tech/.test(k)).length,
  mods: document.querySelectorAll('script[data-tech-mod]').length, css: !!document.getElementById('css-tech'),
  keys: Object.keys(localStorage).concat(Object.keys(sessionStorage)).filter(k => k.startsWith('tech:'))})"""
_TECH_OFF_WANT = {"boot": True, "on": False, "loaded": False, "routes": 0, "mods": 0, "css": False, "keys": []}
# las peticiones del permiso hechas por la versión nueva (OFF_SHELL v24 o más, las fases de después siguen subiendo
# VERSION; test_update_v22._GISVER)
_GIS_NEW = "() => JSON.parse(sessionStorage.getItem('__gis_all') || '[]').filter(c => c.ver >= 24)"


def _is_base23(d):
    d = Path(d)
    return (d / "js" / "hunter.js").exists() and not (d / "js" / "tech-boot.js").exists()


def _base23_dir():
    return F5._published_dir(_BASE23_COMMIT, 23, "VOCAB_BASE23", _is_base23)


def _start_v23(page, keys, tag, probs):
    """Abre la v23 con esa partida, espera a su service worker y recarga ya controlada."""
    C.seed(page, keys)
    page.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=20000)
    C.reload(page)
    v23 = page.evaluate(_V23)
    caches = page.evaluate("() => caches.keys()")
    if not all(v23.values()) or _OLD_SHELL not in caches:
        probs.append(f"{tag}: la versión publicada no es la v23 ({v23}, cachés {caches})")


def _new_sw(page, v, shell, old_media, tag, probs):
    """El sw nuevo se instala (vocab-shell-v<v> con todo SHELL, sin vocab-shell-v23, vocab-media sin perder nada) y,
    tras recargar, controla la página con la app nueva (y el arranque de Tech Prep, apagado)."""
    t0, keys = time.time(), []
    while time.time() - t0 < 25:
        keys = page.evaluate("() => caches.keys()")
        if f"vocab-shell-v{v}" in keys and _OLD_SHELL not in keys:
            break
        page.wait_for_timeout(250)
    if f"vocab-shell-v{v}" not in keys or "vocab-media" not in keys or _OLD_SHELL in keys \
            or any(re.match(r"^vocab-shell-v\d+$", k) and k != f"vocab-shell-v{v}" for k in keys):
        probs.append(f"{tag}: el service worker nuevo no se instaló o no borró {_OLD_SHELL}: {keys}")
    media = set(page.evaluate(U._MEDIA))
    lost = [p for p in old_media if p not in media]
    if lost:
        probs.append(f"{tag}: se perdieron dibujos, audios o datos de vocab-media: {lost[:5]}")
    have = set(page.evaluate(f"async () => (await (await caches.open('vocab-shell-v{v}')).keys()).map(r => new URL(r.url).pathname)"))
    miss = [f for f in shell if ("/" if f == "./" else "/" + f) not in have]
    if miss:
        probs.append(f"{tag}: vocab-shell-v{v} no tiene {miss}")
    C.reload(page)
    again = page.evaluate(U._NEW22, v)
    again.pop("stale")
    f6 = page.evaluate(U22._F6)
    if not all(again.values()) or not all(f6.values()):
        probs.append(f"{tag}: tras recargar con el sw nuevo no está la app nueva entera: {again} {f6}")
    off = page.evaluate(_TECH_OFF)
    if off != _TECH_OFF_WANT:
        probs.append(f"{tag}: tras recargar, Tech Prep no está apagado del todo: {off}")
    ctrl = page.evaluate(U._CTRL)
    if ctrl != {"ctrl": True, "active": True, "state": "activated", "waiting": False, "installing": False}:
        probs.append(f"{tag}: la página no la controla el service worker nuevo: {ctrl}")


def _tech_off(page, reqs, tag, probs):
    """Tech Prep apagado tras actualizar: sin entrada en el menú, #/tech… a #/ y solo js/tech-boot.js pedido."""
    page.locator("#lang-b").click()
    page.wait_for_selector("#lang-m:not([hidden])", timeout=3000)
    page.wait_for_timeout(250)
    if page.locator("#lang-m [data-tech-entry]").count():
        probs.append(f"{tag}: tras actualizar, el menú de la bandera ya tiene Tech Prep")
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    for h in ("#/tech", "#/techpath", "#/techl/lesson/u01-l1"):
        page.evaluate("h => { location.hash = h; }", h)
        page.wait_for_timeout(700)
        if C.current_hash(page) != "":
            probs.append(f"{tag}: con Tech Prep apagado, {h} se queda en #/{C.current_hash(page)}")
    C.settle(page, 300)
    tech = sorted({u.split("?")[0] for u in reqs if "tech" in u})
    if tech != ["/js/tech-boot.js"]:
        probs.append(f"{tag}: con Tech Prep apagado se pide {tech}")
    off = page.evaluate(_TECH_OFF)
    if off != _TECH_OFF_WANT:
        probs.append(f"{tag}: Tech Prep no está apagado del todo: {off}")


def _mayores(page):
    """Ajustes › Para mayores (la Puerta, si no se acaba de pasar)."""
    page.evaluate("() => { openSettings('mayores'); }")   # (sin devolver su promesa: se cumple al cerrar Ajustes)
    page.wait_for_function("() => (document.getElementById('gate') && document.getElementById('gate').open)"
                           " || (window.vocabSettings && vocabSettings.page === 'mayores')", timeout=5000)
    if TC.gate_open(page):
        BZ._pass_gate(page)
    page.wait_for_function("() => window.vocabSettings && vocabSettings.page === 'mayores'", timeout=5000)
    page.wait_for_timeout(500)


def _close_settings(page):
    page.evaluate("() => vocabSettings.close()")
    page.wait_for_function("() => !document.querySelector('dialog#ajustes[open]')", timeout=4000)
    page.wait_for_timeout(300)


def _tech_on_and_use(page, reqs, v, snap, tag, probs):
    """Un mayor enciende Tech Prep en el aparato de Leo, entra por el menú (la Puerta), los módulos llegan con ?v=<v>,
    hace parte de una lección y pide «Download for offline». La partida del niño no cambia."""
    _mayores(page)
    page.locator("label[for=aj-tp-on]").click()
    page.wait_for_timeout(300)
    _close_settings(page)
    if page.evaluate("localStorage.getItem('tech:on')") != "true":
        probs.append(f"{tag}: el interruptor de Para mayores no encendió Tech Prep")
        return False
    page.locator("#lang-b").click()
    page.wait_for_selector("#lang-m:not([hidden]) [data-tech-entry]", timeout=3000)
    page.wait_for_timeout(250)
    page.locator("#lang-m [data-tech-entry]").click()
    page.wait_for_timeout(600)
    if TC.gate_open(page):
        TC.answer_gate(page)
    page.wait_for_function("() => location.hash === '#/tech'", timeout=8000)
    TC.wait_tech(page)
    if page.locator("#tp-today").count() != 1 or "Unit 1" not in page.inner_text(".tp-hero"):
        probs.append(f"{tag}: Today de Tech Prep no sale: {page.inner_text('#app')[:150]!r}")
        return False
    mods = [u for u in reqs if re.match(r"^/js/tech(?!-boot)", u)]
    if mods != [f"/{m}?v={v}" for m in _TECH_MODS]:
        probs.append(f"{tag}: los módulos de Tech Prep llegan como {mods} (se esperaba cada uno una vez con ?v={v})")
    C.shot(page, "v24-tech-prep-today", OUT)
    TC.goto(page, "#/techunit/u01")
    page.locator("#tp-u-go").click()
    page.wait_for_function("() => location.hash === '#/techl/lesson/u01-l1'", timeout=8000)
    TC.wait_tech(page)
    page.wait_for_selector("#tp-lrun", timeout=8000)
    while not TL._run(page)["started"]:
        st = TL._step(page)
        TL._answer(page, ok=True)
        TL._go_on(page)
        TL._wait_next(page, st["k"])
    page.locator("#fx-x").click()
    page.wait_for_selector("dialog#tp-stop[open]", timeout=4000)
    page.locator("#tp-stop-out").click()
    page.wait_for_function("() => location.hash === '#/techunit/u01'", timeout=8000)
    TC.wait_tech(page)
    page.locator(".topbar [data-open=ajustes]").click()
    page.wait_for_selector("dialog#tp-set[open]", timeout=4000)
    page.wait_for_function("() => !/Checking/.test(document.getElementById('tp-set-dls').textContent)", timeout=8000)
    page.locator("#tp-set-dl").click()
    try:
        page.wait_for_function("() => /^Done|^Saved/.test(document.getElementById('tp-set-dls').textContent)", timeout=30000)
    except Exception:  # noqa: BLE001
        pass
    done = page.inner_text("#tp-set-dls")
    files = page.evaluate("vocabTech.offline.files()")
    if not done.startswith("Done · all") or "data/tech/cases.json" not in files:
        probs.append(f"{tag}: «Download for offline» dice {done!r} ({files})")
    have = set(page.evaluate("async () => (await (await caches.open('vocab-media')).keys()).map(r => new URL(r.url).pathname.slice(1))"))
    if not set(files) <= have:
        probs.append(f"{tag}: «Download for offline» no guardó {sorted(set(files) - have)}")
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    d = C.diff_exports(snap, C.export(page), allow_new=False)
    if d:
        probs.append(f"{tag}: usar Tech Prep cambió la partida del niño: {d[:3]}")
    return True


def _tech_offline(page, tag, probs):
    """Sin red (servidor parado): Tech Prep arranca del shell y sus datos de vocab-media; luego volver a los idiomas y
    apagar el interruptor (sin red también)."""
    C.clear_errors(page)
    C.reload(page)
    TC.wait_tech(page)
    for h, sel in (("#/tech", "#tp-today"), ("#/techunit/u05", "#tp-u-go"), ("#/techgloss", "#tp-g-q"),
                   ("#/techl/lesson/u03-l1", "#tp-lrun"), (f"#/techcase/{_CASE}", "#tp-e-go"), ("#/tech", "#tp-today")):
        try:
            TC.goto(page, h)
            page.wait_for_selector(sel, timeout=6000)
        except Exception:  # noqa: BLE001
            probs.append(f"{tag} · sin red: {h} no enseña {sel}: {page.inner_text('#app')[:150]!r}")
    go = page.inner_text("#tp-go").strip() if page.locator("#tp-go").count() else ""
    if go != "Continue":
        probs.append(f"{tag} · sin red: Today no sigue con la lección a medias ({go!r}, se esperaba «Continue»)")
    C.shot(page, "v24-tech-prep-sin-red", OUT)
    page.locator("#tp-back").click()
    page.wait_for_function("() => location.hash === '#/' || location.hash === ''", timeout=8000)
    C.settle(page, 300)
    _mayores(page)
    page.locator("label[for=aj-tp-on]").click()
    page.wait_for_timeout(300)
    _close_settings(page)
    if page.evaluate("localStorage.getItem('tech:on')") is not None:
        probs.append(f"{tag}: apagar el interruptor no quitó tech:on")
    page.evaluate("() => { location.hash = '#/techpath'; }")
    page.wait_for_timeout(800)
    if C.current_hash(page) != "":
        probs.append(f"{tag}: apagado, #/techpath se queda en #/{C.current_hash(page)}")
    probs += [f"{tag} · sin red: {e}" for e in U._errors(page) if "ERR_INTERNET_DISCONNECTED" not in e]


def _v23_then_new(gh_cache):
    probs = []
    base_dir = _base23_dir()
    assert base_dir, f"no se pudo sacar la versión publicada (commit {_BASE23_COMMIT}); VOCAB_BASE23=<copia de ese commit>"
    var = "gh" if gh_cache else "sin-cache"
    tag = "caché de GitHub Pages" if gh_cache else "sin caché HTTP"
    ta, tb = f"{tag} · Lucía", f"{tag} · Leo"
    v, shell = U._sw(C.ROOT)
    sw = (C.ROOT / "sw.js").read_text(encoding="utf-8")
    lazy = re.findall(r'"([^"]+)"', re.search(r"const LAZY = \[(.*?)\];", sw, re.S).group(1)) if "const LAZY = [" in sw else []
    if "js/tech-boot.js" not in shell:
        probs.append("js/tech-boot.js no está en SHELL de sw.js")
    for m in _TECH_MODS:   # los módulos de mayores: en SHELL o en LAZY (se guardan en el shell la primera vez que se usan)
        if m not in shell and m not in lazy:
            probs.append(f"{m} no está ni en SHELL ni en LAZY de sw.js")
    mods = [s.split("?")[0] for s in I4._tags((C.ROOT / "index.html").read_text(encoding="utf-8"))
            if not s.startswith(("http:", "https:", "//"))]
    srv, roots = F5._switching_server(base_dir, gh_cache)
    ctx_a, pa = U22._ctx(srv)
    ctx_b, pb = U22._ctx(srv)
    ctx_b.add_init_script(TC.SPEECH)
    sa, sb = U._Scripts(pa), U._Scripts(pb)
    reqs_b = []
    pb.on("request", lambda r: reqs_b.append(r.url.replace(srv.url, "")) if r.url.startswith(srv.url) else None)
    stopped = False
    try:
        # ---- Lucía en la v23: Google conectado, el permiso caducó hace 30 min y hay cambios sin subir
        _start_v23(pa, A._sync_keys(NOW_MS - 30 * MIN, reconnect=True, base=U._keys()), ta, probs)
        C.goto(pa, "#/repaso")
        pa.wait_for_selector("#rv-card", timeout=10000)
        for _ in range(3):
            st0 = pa.evaluate(V._ST)
            V._tap_card(pa)
            pa.locator(".rv-yes").click()
            V._wait_next(pa, st0["i"])
            pa.wait_for_selector("#rv-card:not(.is-flipped)", timeout=3000)
        farm_a = U22._farm(pa)
        C.goto(pa, "")
        pa.wait_for_timeout(600)
        ver = pa.evaluate(U22._PUT)
        C.shot(pa, f"v23-hoy-{var}", OUT)
        gis = pa.evaluate(U._GIS_ALL)
        if any(c["tap"] for c in gis):
            probs.append(f"{ta}: en la v23 se renovó el permiso en un toque (la prueba no vale): {gis}")
        if pa.evaluate("vocabSync.state.phase") != "reconnect":
            probs.append(f"{ta}: en la v23 el estado de Google es {pa.evaluate('vocabSync.state')} (la prueba no vale)")
        old_a, snap_a = C.storage(pa), C.export(pa)
        media_a = pa.evaluate(U._MEDIA)
        probs += [f"{ta} · v23: {e}" for e in U._errors(pa)]

        # ---- Leo en la v23: sin Google; un mayor apaga la IPA
        _start_v23(pb, U._keys(), tb, probs)
        pb.evaluate("() => { openSettings('mayores'); }")
        BZ._pass_gate(pb)
        pb.wait_for_selector("#aj-ipa", state="attached", timeout=5000)
        pb.wait_for_timeout(500)
        if (IPA._switch(pb) or {}).get("on") is not True:
            probs.append(f"{tb}: en la v23 el interruptor de la IPA no salía encendido: {IPA._switch(pb)}")
        pb.locator("label[for=aj-ipa]").click()
        pb.wait_for_timeout(200)
        _close_settings(pb)
        farm_b = U22._farm(pb)
        C.goto(pb, "")
        old_b, snap_b = C.storage(pb), C.export(pb)
        media_b = pb.evaluate(U._MEDIA)
        ui_b = json.loads(old_b.get("vocab:ui") or "{}")
        if ui_b != {"hints": U._HINTS, "ipa": False}:
            probs.append(f"{tb}: en la v23 apagar la IPA guardó {old_b.get('vocab:ui')}")
        probs += [f"{tb} · v23: {e}" for e in U._errors(pb)]

        # ---- se publica esta versión y vuelven
        U._quiet((pa, pb))
        roots["cur"] = C.ROOT
        reqs_b.clear()
        U._come_back(pa, sa, gh_cache, v, mods, ta, probs)
        U._come_back(pb, sb, gh_cache, v, mods, tb, probs)
        for page, t in ((pa, ta), (pb, tb)):
            f6 = page.evaluate(U22._F6)
            if not all(f6.values()):
                probs.append(f"{t}: en la primera carga faltan módulos de F6: {f6}")
            off = page.evaluate(_TECH_OFF)
            if off != _TECH_OFF_WANT:
                probs.append(f"{t}: en la primera carga Tech Prep no sale apagado: {off}")
        if pa.evaluate(_GIS_NEW):
            probs.append(f"{ta}: al abrir la versión nueva se pide el permiso sin un toque: {pa.evaluate(_GIS_NEW)}")
        C.shot(pa, f"v24-hoy-tras-actualizar-{var}", OUT)
        for page, t, old_media in ((pa, ta, media_a), (pb, tb, media_b)):
            _new_sw(page, v, shell, old_media, t, probs)
        # la partida igual: cada clave y la exportación (sin claves nuevas, tampoco tech:…)
        for page, t, old, snap in ((pa, ta, old_a, snap_a), (pb, tb, old_b, snap_b)):
            U._same_keys(old, C.storage(page), t, probs)
            d = C.diff_exports(snap, C.export(page), allow_new=False)
            if d:
                probs.append(f"{t}: la exportación tras actualizar no es la de la v23: {d}")
        after = U22._farm(pb)
        if after != farm_b or not farm_b:
            probs.append(f"{tb}: la granja cambia al actualizar: {farm_b} → {after}")
        C.goto(pb, "")
        got = pa.evaluate(U22._GET)
        if not got or not got["ok"] or got["kind"] != "mail" or got["ver"] != ver:
            probs.append(f"{ta}: el mensaje grabado en la v23 no sigue igual en IndexedDB: {got} (versión de antes {ver})")

        # ---- Leo: Tech Prep apagado; la IPA que apagó un mayor sigue apagada; al encenderla, se ve
        _tech_off(pb, reqs_b, tb, probs)
        U22._how(pb, probs, tb, False)
        C.goto(pb, "")
        _mayores(pb)
        sw = IPA._switch(pb)
        if not sw or sw["on"] or sw["role"] != "switch":
            probs.append(f"{tb}: con el {{ipa: false}} de la v23, el interruptor no sale apagado: {sw}")
        tp = pb.evaluate("() => { const i = document.getElementById('aj-tp-on'); return i ? i.checked : null; }")
        if tp is not False:
            probs.append(f"{tb}: el interruptor de Tech Prep en Para mayores: {tp} (se esperaba apagado)")
        pb.locator("label[for=aj-ipa]").click()
        pb.wait_for_timeout(200)
        _close_settings(pb)
        _how(pb, probs, tb)
        U._back_of_card(pb, probs, tb)
        C.goto(pb, "")
        U22._new_screens(pb, tb, probs)
        # la partida justo antes de Tech Prep (el loro, que es de la granja, ya escribió en farm:state; la IPA es de
        # vocab:ui, del aparato, y no va en la partida)
        snap_b2 = C.export(pb)
        # ---- Leo: un mayor enciende Tech Prep, lo usa y lo baja para usarlo sin red
        reqs_b.clear()
        tech_ok = _tech_on_and_use(pb, reqs_b, v, snap_b2, tb, probs)
        probs += [f"{tb}: {e}" for e in C.errors(pb)]

        # ---- Lucía: sin pedir nada fuera de un toque; el siguiente toque seguro (una pestaña) sube la partida
        try:
            pa.wait_for_function("() => vocabSync.state.phase === 'reconnect'", timeout=5000)
        except Exception:  # noqa: BLE001
            probs.append(f"{ta}: tras actualizar, el estado de Google es {pa.evaluate('vocabSync.state')} (se esperaba reconnect)")
        if pa.evaluate(_GIS_NEW) or pa.evaluate("window.__gis.length"):
            probs.append(f"{ta}: la versión nueva pidió el permiso sin un toque: {pa.evaluate(_GIS_NEW)}")
        if any("/upload/" in x["url"] for x in pa.evaluate(U._DRIVE_LOG)):
            probs.append(f"{ta}: se subió algo sin permiso: {pa.evaluate(U._DRIVE_LOG)}")
        tab = pa.locator(".tabbar [data-nav=hoy]")
        tab.click()
        try:
            pa.wait_for_function("() => window.__gis.length > 0", timeout=3000)
            calls = pa.evaluate("window.__gis")
            if len(calls) != 1 or not (calls[0]["tap"] and calls[0]["act"]) or calls[0]["prompt"] != "":
                probs.append(f"{ta}: el toque en la pestaña no pidió el permiso una vez dentro del toque: {calls}")
            pa.wait_for_function("() => vocabSync.state.phase === 'ok' && vocabSync.state.tokOk", timeout=8000)
        except Exception:  # noqa: BLE001
            probs.append(f"{ta}: el toque en la pestaña Hoy no renueva el permiso ni sube: {pa.evaluate('window.__gis')}, "
                         f"{pa.evaluate('vocabSync.state')}")
        ups = [x for x in pa.evaluate(U._DRIVE_LOG) if x["method"] == "PATCH" and "/upload/drive/v3/files/f1" in x["url"]]
        if len(ups) != 1:
            probs.append(f"{ta}: subidas a Drive tras el toque: {[(x['method'], x['url']) for x in pa.evaluate(U._DRIVE_LOG)]}")
        else:
            md, data = U._multipart(ups[0]["body"])
            d = C.diff_exports(snap_a, data, allow_new=False)
            if data.get("app") != "vocabulary" or d:
                probs.append(f"{ta}: lo que se sube a Google no es la partida de la v23: {d}")
            if md.get("appProperties", {}).get("hash") != pa.evaluate("vocabSync.hash()"):
                probs.append(f"{ta}: la huella de la subida no es la de la partida: {md}")
        if any("techprep" in x["url"] or "techprep" in x.get("body", "") for x in pa.evaluate(U._DRIVE_LOG)):
            probs.append(f"{ta}: con Tech Prep apagado se tocó el archivo de Tech Prep en Google")
        after = U22._farm(pa)
        if after != farm_a or not farm_a:
            probs.append(f"{ta}: la granja cambia al actualizar: {farm_a} → {after}")
        C.goto(pa, "")
        _how(pa, probs, ta)
        U._back_of_card(pa, probs, ta)
        C.shot(pa, f"v24-repaso-ipa-{var}", OUT)
        C.goto(pa, "")
        if "ipa" in json.loads(pa.evaluate("() => localStorage.getItem('vocab:ui')") or "{}"):
            probs.append(f"{ta}: tras actualizar vocab:ui tiene la clave ipa sin que nadie tocara el interruptor")
        probs += [f"{ta}: {e}" for e in C.errors(pa)]
        for page, t in ((pa, ta), (pb, tb)):
            if page._outside:
                probs.append(f"{t}: se pidió algo fuera del servidor: {page._outside[:5]}")

        # ---- sin conexión: el servidor parado; la app nueva desde vocab-shell-v24 y Tech Prep de lo bajado
        srv.stop()
        stopped = True
        ctx_a.set_offline(True)
        ctx_b.set_offline(True)
        C.clear_errors(pa)
        sa.reset()
        C.reload(pa)
        off = pa.evaluate(U._NEW22, v)
        off.pop("stale")
        if not all(off.values()) or not all(pa.evaluate(U22._F6).values()):
            probs.append(f"{ta}: sin conexión no sale la app nueva entera: {off} {pa.evaluate(U22._F6)}")
        missing, other = sa.check(C.base_url(pa), C.ROOT, mods)
        if missing or other:
            probs.append(f"{ta}: sin conexión no se ejecutan {missing} y son de otra versión {other}")
        probs += [f"{ta} · sin conexión: {e}" for e in C.errors(pa)]
        if tech_ok:
            _tech_offline(pb, tb, probs)
            d = C.diff_exports(snap_b2, C.export(pb), allow_new=False)
            if d:
                probs.append(f"{tb}: tras usar Tech Prep sin red, la partida del niño cambió: {d[:3]}")
    finally:
        for c in (ctx_a, ctx_b):
            try:
                c.set_offline(False)
            except Exception:  # noqa: BLE001
                pass
        for c in (ctx_a, ctx_b):
            try:
                c.close()
            except Exception:  # noqa: BLE001
                pass
        if not stopped:
            srv.stop()
    return probs


def _how(page, probs, tag):
    """La IPA se ve en «Cómo suena» (test_update_v22._how con la IPA encendida)."""
    U22._how(page, probs, tag, True)


def test_update_from_published_v23():
    """Lucía (Google conectado, permiso caducado, cambios sin subir, un mensaje del Buzón) y Leo (sin Google, la IPA
    apagada por un mayor) con la versión publicada (main 4185280, sw vocab-shell-v23). Se publica esta versión y vuelven
    abriendo la app: la primera carga ya es la app nueva entera con «?v=24» (también js/tech-boot.js), el sw nuevo se
    instala y controla (vocab-shell-v24 con todo SHELL, sin vocab-shell-v23, vocab-media entera), la partida queda igual
    (cada clave y la exportación, sin claves nuevas), la granja igual, el mensaje grabado sigue, la IPA se ve de serie
    para Lucía y sigue apagada para Leo hasta que se enciende, y el siguiente toque de Lucía en una pestaña pide el
    permiso dentro del toque y sube la partida de la v23 tal cual. Tech Prep sale apagado (ni menú, ni rutas, ni
    módulos, ni data/tech); encendido en el aparato de Leo funciona, sus módulos llegan con «?v=24» y, tras «Download for
    offline», se usa sin red (una unidad que no se abrió con red, el glosario, una lección, un caso) y se apaga. La
    partida de Leo sigue igual. Sin errores."""
    probs = _v23_then_new(gh_cache=False)
    assert not probs, "\n".join(probs)


def test_update_from_v23_with_github_pages_http_cache():
    """Lo mismo con las cabeceras de GitHub Pages (Cache-Control: max-age=600) y la caché HTTP del navegador: los dos
    tenían la app abierta al publicar y recargan antes de 10 minutos. Ningún módulo viejo sale de la caché HTTP: la
    primera carga ya ejecuta cada módulo de esta versión (con «?v=24») y los de Tech Prep, al encenderlo, también llegan
    con «?v=24». Sin errores."""
    probs = _v23_then_new(gh_cache=True)
    assert not probs, "\n".join(probs)
