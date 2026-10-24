"""Tech Prep S1 integrado (S1-SPEC §14): las tres piezas (js/tech.js, js/tech-lesson.js, js/tech-pages.js) juntas.

- Carga perezosa: con el interruptor apagado (y encendido pero sin entrar) solo se pide js/tech-boot.js: ni el resto de
  js/tech*.js ni data/tech/…; al entrar llegan js/tech.js, js/tech-lesson.js y js/tech-pages.js en ese orden y con el
  mismo ?v= que la app (la VERSION de sw.js).
- Enlace directo y recarga de cada ruta de S1-SPEC §3: la pantalla, la pestaña marcada, la cápsula de volver, el modo
  foco, document.title y lang="en-GB"; recargar da lo mismo.
- El cambio de juego de pestañas de ida y vuelta (niño → Tech Prep → niño → Tech Prep), cada uno con su memoria, y la
  Puerta al entrar desde el menú de la bandera.
- Que T2 y T3 encajan: los botones de las páginas (Today, Path, una unidad, Play, un caso modelo y uno propio, My
  stories, Interview) abren las sesiones de modo foco de verdad; la práctica de casos usa vocabTech.cases.questions;
  «Write yours» de una lección crea la historia que luego está en My stories; el final de lección lleva a la siguiente.
- El recorrido de un mayor en el móvil (claro y oscuro) y en el escritorio: encender Tech Prep en Para mayores, entrar
  por el menú (Puerta), Today, una lección técnica y una de liderazgo enteras, el repaso, una entrevista corta, Path,
  una unidad, la chuleta, el glosario, Pairs, Beat the clock, un caso propio y uno modelo con su práctica, una
  historia, Tech Prep settings (fecha, descarga para usar sin red, borrar progreso), volver a los idiomas y apagar el
  interruptor. Sin errores en la consola, sin claves ni eventos del niño y la partida exportada igual que la base.
  Capturas con nombre (S1-…) en /mnt/project-files/tech-prep/capturas/S1/."""
from __future__ import annotations

import json
import re

import common as C
import routes as R
import tech_common as TC
import test_tech_lesson as TL

_PASS = "() => sessionStorage.setItem('vocab:gate', String(Date.now() + adultGate.MS))"
_CASE = json.loads((TC.DATA / "cases.json").read_text(encoding="utf-8"))["cases"][0]["id"]
_VIEW = """() => { const r = document.documentElement, b = document.getElementById('dv-back'),
    t = document.querySelector('#tabbar [role=tab][aria-selected=true]'), a = document.getElementById('app');
  return {hash: location.hash, tech: r.hasAttribute('data-tech'), lang: r.lang, focus: r.dataset.focus || '', tab: t ? t.dataset.nav : null,
    back: r.hasAttribute('data-back') && b ? [b.getAttribute('href'), b.textContent.trim()] : null, title: document.title,
    head: (document.querySelector('#tabhead h1, #tabhead .lt') || {}).textContent || '',
    text: (a.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 160), x: (document.getElementById('fx-x') || {}).ariaLabel || '',
    bar: !!document.querySelector('#tabbar') && getComputedStyle(document.querySelector('#tabbar')).display !== 'none'
      && document.querySelector('#tabbar').getClientRects().length > 0,
    mods: (window.vocabTech && vocabTech.mods) || null, dialogs: [...document.querySelectorAll('dialog[open]')].map(d => d.id || d.className)}; }"""
_KID_TABS = ["hoy", "aprender", "jugar", "granja", "premios"]
_TECH_TABS = ["tp-today", "tp-path", "tp-play", "tp-cases", "tp-mock"]


def _wait_hash(page, pred, timeout=8000):
    """Espera a que location.hash (sin '#/') cumpla pred (texto exacto o expresión regular)."""
    rx = pred if isinstance(pred, str) and pred.startswith("^") else "^" + re.escape(pred) + "$"
    page.wait_for_function("rx => new RegExp(rx).test(location.hash.replace(/^#\\/?/, ''))", arg=rx, timeout=timeout)
    if TC.SECS.count(C.current_hash(page).split("/")[0].split("?")[0]):
        TC.wait_tech(page)
    else:
        C.settle(page, 250)


def _view(page):
    return page.evaluate(_VIEW)


def _tab_ids(page):
    return page.evaluate("() => [...document.querySelectorAll('#tabbar [role=tab]')].map(a => a.dataset.nav)")


def _menu_tech(page):
    """Menú de la bandera › «Tech Prep»."""
    page.locator("#lang-b").click()
    page.wait_for_selector("#lang-m:not([hidden]) [data-tech-entry]", timeout=3000)
    page.wait_for_timeout(200)
    page.locator("#lang-m [data-tech-entry]").click()


def _x(page):
    """La ✕ del modo foco."""
    page.locator("#fx-x").click()
    page.wait_for_timeout(250)


def _stop_open(page):
    return page.evaluate("() => { const d = document.getElementById('tp-stop'); return !!(d && d.open); }")


def _stop(page):
    """«Stop here?» › «Stop»."""
    page.wait_for_function("() => { const d = document.getElementById('tp-stop'); return !!(d && d.open); }", timeout=4000)
    page.locator("#tp-stop-out").click()


def _sw_version():
    return int(re.search(r"const VERSION = (\d+);", (C.ROOT / "sw.js").read_text(encoding="utf-8")).group(1))


def _close_sheets(page):
    for _ in range(4):
        if not page.evaluate("() => !!document.querySelector('dialog[open]')"):
            return
        page.keyboard.press("Escape")
        page.wait_for_timeout(450)


# =============================================================== 1. carga perezosa
def test_lazy_loading_only_when_entered():
    """Apagado: #/tech, #/techpath y #/techl/… van a #/, no hay entrada en el menú ni rutas tech en ROUTES, y la página
    solo pide js/tech-boot.js (ni js/tech.js, ni js/tech-lesson.js, ni js/tech-pages.js, ni data/tech/…). Encendido sin
    entrar (Hoy, Aprender, Jugar, Ajustes): lo mismo. Al entrar llegan los tres módulos, una vez, en orden, con
    ?v=<VERSION>, y data/tech/index.json con las unidades."""
    v = _sw_version()
    probs = []
    for on in (False, True):
        page = C.new_page("phone")
        log = []
        page.on("request", lambda r, log=log: log.append(r.url.replace(C.base_url(page), "")))
        try:
            C.seed(page, keys=TC.keys(on=on))
            for h in ["#/", "#/mapa", "#/juegos", "#/granja", "#/progreso"] + ([] if on else ["#/tech", "#/techpath", "#/techl/lesson/u01-l1", "#/techunit/u01"]):
                got = C.goto(page, h)
                if not on and h.startswith("#/tech") and got != "":
                    probs.append(f"apagado: {h} se queda en #/{got}")
            page.evaluate(_PASS)
            page.evaluate("() => { openSettings('mayores'); }")
            page.wait_for_function("() => window.vocabSettings && vocabSettings.page === 'mayores'", timeout=4000)
            page.wait_for_timeout(600)
            _close_sheets(page)
            page.wait_for_timeout(1200)
            tech = sorted({u.split("?")[0] for u in log if "tech" in u})
            if tech != ["/js/tech-boot.js"]:
                probs.append(f"{'encendido sin entrar' if on else 'apagado'}: pide {tech}")
            boot = {u for u in log if u.startswith("/js/tech-boot.js")}
            if boot != {f"/js/tech-boot.js?v={v}"}:
                probs.append(f"tech-boot: {boot}")
            st = page.evaluate("() => ({menu: !!document.querySelector('[data-tech-entry]'), routes: Object.keys(ROUTES).filter(k => /^tech/.test(k)).length,"
                               " css: !!document.getElementById('css-tech'), mods: document.querySelectorAll('script[data-tech-mod]').length})")
            want = {"menu": False, "routes": len(TC.SECS) if on else 0, "css": False, "mods": 0}
            # (el menú solo se pinta al abrirlo: con el interruptor encendido sale al abrirlo, se mira abajo)
            if {**st, "menu": False} != want:
                probs.append(f"{'encendido' if on else 'apagado'}: {st}")
            if on:
                _menu_tech(page)
                TC.answer_gate(page)
                _wait_hash(page, "tech")
                mods = [u for u in log if re.match(r"^/js/tech(?!-boot)", u)]
                if mods != [f"/js/tech.js?v={v}", f"/js/tech-lesson.js?v={v}", f"/js/tech-pages.js?v={v}"]:
                    probs.append(f"módulos al entrar: {mods}")
                if not any(u.startswith("/data/tech/index.json") for u in log):
                    probs.append("al entrar no se pidió data/tech/index.json")
                TC.goto(page, "#/techpath")
                TC.goto(page, "#/techl/pairs")
                again = [u for u in log if re.match(r"^/js/tech(?!-boot)", u)]
                if len(again) != 3:
                    probs.append(f"módulos pedidos más de una vez: {again}")
                if page.evaluate("() => vocabTech.mods") != ["js/tech.js", "js/tech-lesson.js", "js/tech-pages.js"]:
                    probs.append(f"vocabTech.mods = {page.evaluate('() => vocabTech.mods')}")
            if C.errors(page):
                probs.append(f"errores: {C.errors(page)[:3]}")
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# =============================================================== 2. enlaces directos y recarga
def _expect(h):
    """(pestaña, cápsula de volver, foco, título) que se esperan en la ruta h (sin '#/')."""
    sec = h.split("/")[0].split("?")[0]
    focus = {"lesson": "Lesson", "review": "Review", "mock": "Mock interview", "case": "Case practice", "pairs": "Pairs",
             "clock": "Beat the clock"}
    if sec == "techl":
        return None, None, "tech", "Tech Prep · " + focus[h.split("/")[1]]
    tab = {"tech": "tp-today", "techpath": "tp-path", "techunit": "tp-path", "techsheet": "tp-path", "techgloss": "tp-path",
           "techplay": "tp-play", "techcases": "tp-cases", "techcase": "tp-cases", "techstories": "tp-cases",
           "techstory": "tp-cases", "techmock": "tp-mock"}[sec]
    back = {"techunit": ["#/techpath", "Path"], "techsheet": ["#/techpath", "Path"], "techcase": ["#/techcases", "My cases"],
            "techstory": ["#/techstories", "My stories"]}.get(sec)
    title = {"tech": "Tech Prep · Today", "techpath": "Tech Prep · Path · Units", "techunit": "Tech Prep · Path · Units",
             "techsheet": "Tech Prep · Path · Units", "techgloss": "Tech Prep · Path · Glossary", "techplay": "Tech Prep · Play",
             "techcases": "Tech Prep · My cases · Cases", "techcase": "Tech Prep · My cases · Cases",
             "techstories": "Tech Prep · My cases · Stories", "techstory": "Tech Prep · My cases · Stories",
             "techmock": "Tech Prep · Interview"}[sec]
    return tab, back, "", title


# cada ruta de S1-SPEC §3 (con las variantes que tienen) y algo de lo que tiene que enseñar
_DEEP = [
    ("#/tech", "#tp-today"), ("#/techpath", "#app .tp-page"), ("#/techunit/u01", "#tp-u-go"), ("#/techunit/u07", "#tp-u-go"),
    ("#/techsheet/integration", "#app .tp-page"), ("#/techsheet/leadership", "#app .tp-page"), ("#/techgloss", "#app input[type=search], #app input"),
    ("#/techplay", "#tp-g-pairs"), ("#/techcases", "#app .tp-page"), (f"#/techcase/{_CASE}", "#tp-e-go"), ("#/techcase/new", "#tp-e-title"),
    ("#/techstories", "#app .tp-page"), ("#/techstory/new", "#tp-e-title"), ("#/techstory/new?from=u07-l2-i2", "#tp-e-title"),
    ("#/techmock", "#tp-mk-start"), ("#/techl/lesson/u01-l1", "#tp-lrun"), ("#/techl/lesson/u07-l2", "#tp-lrun"),
    ("#/techl/review", "#app .tp-page"), ("#/techl/mock", "#tp-lrun"), (f"#/techl/case/{_CASE}", "#tp-lrun"),
    ("#/techl/pairs", "#app .tp-page"), ("#/techl/clock", "#app .tp-page"),
]


def test_every_route_deep_link_and_reload():
    """Cada ruta de §3 abierta de golpe (enlace directo, la Puerta ya pasada en esta sesión) pinta su pantalla con la
    pestaña de Tech Prep marcada, su cápsula de volver (‹ Path, ‹ My cases, ‹ My stories) o el modo foco «tech» (✕
    «Close», sin barra de pestañas), document.title en inglés y lang="en-GB"; recargar da exactamente lo mismo. #/techcase/new
    y #/techstory/new pasan a su id propio (my-…). Sin «Coming soon» ni errores."""
    probs = []
    for kind in ("phone", "desk"):
        page = TC.tech_page(kind, hash="#/tech")
        try:
            for h, sel in _DEEP:
                if kind == "desk" and h not in ("#/tech", "#/techunit/u01", "#/techcase/new", "#/techl/lesson/u07-l2", "#/techl/clock"):
                    continue
                C.clear_errors(page)
                TC.open_tech(page, h)
                v1 = _view(page)
                hh = v1["hash"][2:]
                tab, back, focus, title = _expect(hh)
                if h.endswith("/new") or "/new?" in h:
                    if not re.match(r"^tech(case|story)/my-[a-z0-9]+$", hh):
                        probs.append(f"{kind} {h}: queda en #{v1['hash']}")
                elif v1["hash"] != h:
                    probs.append(f"{kind} {h}: queda en {v1['hash']}")
                got = (v1["tab"], v1["back"], v1["focus"], v1["title"])
                if got != (tab, back, focus, title):
                    probs.append(f"{kind} {h}: (pestaña, volver, foco, título) = {got}, se esperaba {(tab, back, focus, title)}")
                if not v1["tech"] or v1["lang"] != "en-GB" or v1["x"] != "Close":
                    probs.append(f"{kind} {h}: data-tech {v1['tech']}, lang {v1['lang']}, ✕ «{v1['x']}»")
                if v1["bar"] == bool(focus):
                    probs.append(f"{kind} {h}: barra de pestañas {'visible' if v1['bar'] else 'escondida'} con foco «{focus}»")
                if page.locator(sel).count() == 0:
                    probs.append(f"{kind} {h}: no está {sel} · {v1['text'][:100]}")
                if re.search(r"Coming soon|isn't available|Something went wrong", v1["text"]) and "techpath" not in h:
                    probs.append(f"{kind} {h}: {v1['text'][:100]}")
                if v1["mods"] != ["js/tech.js", "js/tech-lesson.js", "js/tech-pages.js"]:
                    probs.append(f"{kind} {h}: vocabTech.mods {v1['mods']}")
                C.reload(page)
                TC.wait_tech(page)
                v2 = _view(page)
                diff = {k: (v1[k], v2[k]) for k in ("hash", "tab", "back", "focus", "title", "lang", "bar", "head") if v1[k] != v2[k]}
                if diff:
                    probs.append(f"{kind} {h}: tras recargar cambia {diff}")
                if page.locator(sel).count() == 0:
                    probs.append(f"{kind} {h}: tras recargar no está {sel}")
                if TC.gate_open(page):
                    probs.append(f"{kind} {h}: la Puerta sale al recargar en la misma sesión")
                if C.errors(page):
                    probs.append(f"{kind} {h}: errores {C.errors(page)[:2]}")
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# =============================================================== 3. pestañas de ida y vuelta y la Puerta
def test_tab_sets_round_trip_and_gate():
    """Niño en Aprender › Camino → menú › Tech Prep → la Puerta («Para entrar en Tech Prep.») → Today con las cinco
    pestañas de Tech Prep. Path › una unidad, My cases › Stories, Path otra vez vuelve a la unidad (su memoria). Un idioma
    del menú sale a Hoy del niño con sus cinco pestañas en español y Aprender sigue recordando el Camino (la memoria del
    niño intacta). Volver a entrar pide la Puerta otra vez (o la recuerda unos minutos, js/gate.js) y Path sigue en la
    unidad. Con una sesión nueva, un enlace directo a #/techunit/u01 pide la Puerta antes de enseñar nada; cancelarla
    lleva a #/."""
    page = C.new_page("phone")
    page2 = None
    try:
        C.seed(page, keys=TC.keys())
        page.add_init_script(TC.SPEECH)
        before = TC.kid_snapshot(page)
        C.goto(page, "#/mapa")
        assert _tab_ids(page) == _KID_TABS, _tab_ids(page)
        _menu_tech(page)
        g = TC.answer_gate(page)
        assert g["why"] == "Para entrar en Tech Prep.", g
        _wait_hash(page, "tech")
        v = _view(page)
        assert _tab_ids(page) == _TECH_TABS and v["tab"] == "tp-today" and v["lang"] == "en-GB", (v, _tab_ids(page))
        page.locator("#tab-tp-path").click()
        _wait_hash(page, "techpath")
        page.locator("#app a[href='#/techunit/u02']").first.click()
        _wait_hash(page, "techunit/u02")
        assert _view(page)["back"] == ["#/techpath", "Path"], _view(page)
        page.locator("#tab-tp-cases").click()
        _wait_hash(page, "techcases")
        page.locator("#tabhead .seg-i[href='#/techstories']").click()
        _wait_hash(page, "techstories")
        page.locator("#tab-tp-path").click()
        _wait_hash(page, "techunit/u02")
        page.locator("#tab-tp-cases").click()
        _wait_hash(page, "techstories")
        # salir por el menú (el mismo idioma): Hoy del niño, sus pestañas, su memoria
        page.locator("#lang-b").click()
        page.wait_for_selector("#lang-m:not([hidden])")
        page.locator('#lang-m [data-lang="english"]').click()
        _wait_hash(page, "")
        v = _view(page)
        assert _tab_ids(page) == _KID_TABS and not v["tech"] and v["lang"] == "es" and v["tab"] == "hoy", (v, _tab_ids(page))
        assert "Tech Prep" not in v["title"], v
        page.locator("#tab-aprender").click()
        _wait_hash(page, "^mapa")
        mem = page.evaluate("() => ({kid: JSON.parse(sessionStorage.getItem('vocab:tabs') || '{}'), tech: JSON.parse(sessionStorage.getItem('tech:tabs') || '{}')})")
        assert not any(k.startswith("tp-") for k in mem["kid"]), mem
        assert mem["tech"].get("tp-path", {}).get("h") == "#/techunit/u02", mem
        assert page.evaluate("sessionStorage.getItem('tech:in')") is None, "salir no olvidó la Puerta"
        # Atrás del navegador hasta Tech Prep: la pide otra vez (o la recuerda unos minutos)
        _menu_tech(page)
        page.wait_for_timeout(500)
        if TC.gate_open(page):
            TC.answer_gate(page)
        _wait_hash(page, "tech")
        page.locator("#tab-tp-path").click()
        _wait_hash(page, "techunit/u02")
        assert _view(page)["tab"] == "tp-path"
        # «Back to languages» de Today
        page.locator("#tab-tp-today").click()
        _wait_hash(page, "tech")
        page.locator("#tp-back").click()
        _wait_hash(page, "")
        assert _tab_ids(page) == _KID_TABS
        assert not TC.kid_changes(page, before), TC.kid_changes(page, before)
        assert not C.errors(page), C.errors(page)
        local = C.storage(page)
        # sesión nueva con un enlace directo
        page2 = C.new_page("phone")
        page2.goto(C.base_url(page2) + "/__blank")
        page2.evaluate("keys => { localStorage.clear(); for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v); }", local)
        page2.goto(C.base_url(page2) + "/#/techunit/u01")
        page2.wait_for_function("() => document.getElementById('gate') && document.getElementById('gate').open", timeout=8000)
        seen = page2.evaluate("() => ({tech: document.documentElement.hasAttribute('data-tech'), unit: !!document.getElementById('tp-u-go')})")
        assert seen == {"tech": False, "unit": False}, seen
        TC.cancel_gate(page2)
        _wait_hash(page2, "")
        assert _tab_ids(page2) == _KID_TABS
        page2.evaluate("() => { location.hash = '#/techunit/u01'; }")
        page2.wait_for_function("() => document.getElementById('gate').open", timeout=8000)
        TC.answer_gate(page2)
        page2.wait_for_selector("#tp-u-go", timeout=10000)
        assert _view(page2)["back"] == ["#/techpath", "Path"]
        assert not C.errors(page2), C.errors(page2)
    finally:
        page.context.close()
        if page2:
            page2.context.close()


# =============================================================== 4. T2 y T3 encajan
def test_pages_open_the_sessions():
    """Los botones de las páginas abren las sesiones de verdad y la ✕ vuelve a la página de antes:
    Today «Start» → la lección siguiente; una unidad «Start lesson 1» → la lección (contestar una y ✕ › «Stop here?» ›
    «Stop» vuelve a la unidad, que dice «Continue lesson 1», y Today también); Play › Pairs y Beat the clock; un caso
    modelo «Practise this case» → tantas preguntas como vocabTech.cases.questions(id) con «Case notes»; un caso propio →
    las 10 preguntas generales con «A strong answer covers»; una lección de historias «Write yours» → story/<id> con from,
    que sale en My stories y que #/techstory/new?from=<item> vuelve a abrir; Interview «Start» → la entrevista; Today con
    repasos pendientes → el repaso; el final de lección «Next lesson» → la siguiente y «Back to Path» → Path; la chuleta
    desde Path y desde una unidad vuelve a donde se abrió."""
    probs = []
    page = TL._open("#/tech")
    try:
        before = TC.kid_snapshot(page)
        TC.bus_log(page)
        # Today › Start
        assert page.inner_text("#tp-go").strip() == "Start", page.inner_text("#tp-go")
        page.locator("#tp-go").click()
        _wait_hash(page, "techl/lesson/u01-l1")
        page.wait_for_selector("#tp-lrun")
        _x(page)
        _wait_hash(page, "tech")
        # una unidad › Start lesson 1, una respuesta, ✕ › Stop
        TC.goto(page, "#/techunit/u01")
        page.locator("#tp-u-go").click()
        _wait_hash(page, "techl/lesson/u01-l1")
        while not TL._run(page)["started"]:   # (las tarjetas solo se leen: empieza con la primera respuesta)
            s = TL._step(page)
            TL._answer(page, ok=True)
            TL._go_on(page)
            TL._wait_next(page, s["k"])
        done_i = TL._run(page)["i"]
        _x(page)
        _stop(page)
        _wait_hash(page, "techunit/u01")
        if "Continue lesson 1" not in page.inner_text("#tp-u-go"):
            probs.append(f"la unidad no dice «Continue lesson 1»: {page.inner_text('#tp-u-go')!r}")
        page.locator("#tab-tp-today").click()
        _wait_hash(page, "tech")
        if page.inner_text("#tp-go").strip() != "Continue":
            probs.append(f"Today no dice «Continue»: {page.inner_text('#tp-go')!r}")
        # echar un vistazo a otra lección (sin contestar) y salir no pisa la que está a medias
        TC.goto(page, "#/techl/lesson/u02-l1")
        page.wait_for_selector("#tp-lrun")
        page.wait_for_timeout(300)
        _x(page)
        TC.goto(page, "#/tech")
        if page.inner_text("#tp-go").strip() != "Continue":
            probs.append(f"tras abrir otra lección sin contestar, Today dice {page.inner_text('#tp-go')!r} (se esperaba «Continue»)")
        page.locator("#tp-go").click()
        _wait_hash(page, "techl/lesson/u01-l1")
        if TL._run(page)["i"] != done_i:
            probs.append(f"«Continue» no sigue donde se dejó: {TL._run(page)}")
        TL._walk(page)
        page.wait_for_selector("#tp-lend")
        # el final: «Next lesson» y «Back to Path»
        nl = page.get_attribute("#tp-lnextl", "href")
        if nl != "#/techl/lesson/u01-l2":
            probs.append(f"«Next lesson» lleva a {nl}")
        page.locator("#tp-lnextl").click()
        _wait_hash(page, "techl/lesson/u01-l2")
        page.wait_for_selector("#tp-lrun")
        _x(page)   # sin empezar: sale sin preguntar
        page.wait_for_timeout(300)
        if _stop_open(page):
            probs.append("«Stop here?» en una lección sin empezar")
            _stop(page)
        h = C.current_hash(page)
        if h.startswith("techl"):
            probs.append(f"la ✕ de una lección sin empezar se queda en #/{h}")
        TC.goto(page, "#/techl/lesson/u01-l1")
        TL._walk(page)
        page.locator("#tp-lpath").click()
        _wait_hash(page, "techpath")
        # Play
        for card, kind in (("#tp-g-pairs", "pairs"), ("#tp-g-clock", "clock")):
            TC.goto(page, "#/techplay")
            page.locator(card).click()
            _wait_hash(page, f"techl/{kind}")
            v = _view(page)
            if v["focus"] != "tech" or len(v["text"]) < 20:
                probs.append(f"Play › {kind}: {v}")
            _x(page)
            if _stop_open(page):
                _stop(page)
            _wait_hash(page, "techplay")
        # un caso modelo › Practise this case
        n = page.evaluate("id => vocabTech.cases.questions(id).then(q => q.length)", _CASE)
        TC.goto(page, f"#/techcase/{_CASE}")
        page.locator("#tp-e-go").click()
        _wait_hash(page, f"techl/case/{_CASE}")
        page.wait_for_selector("#tp-lrun")
        r = TL._run(page)
        if r["kind"] != "case" or r["n"] != n:
            probs.append(f"práctica del caso: {r['kind']} con {r['n']} preguntas, cases.questions da {n}")
        if page.locator("#tp-lcaseb").count() != 1:
            probs.append("sin el botón «Case notes»")
        else:
            page.locator("#tp-lcaseb").click()
            page.wait_for_selector("dialog#tp-lcase[open]", timeout=3000)
            notes = page.inner_text("dialog#tp-lcase")
            if "Context" not in notes:
                probs.append(f"«Case notes» sin el caso: {notes[:120]!r}")
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
        _x(page)
        if _stop_open(page):
            _stop(page)
        _wait_hash(page, f"techcase/{_CASE}")
        # un caso propio › las preguntas generales
        TC.goto(page, "#/techcase/new")
        page.locator("#tp-e-title").fill("Orders to the warehouse with events")
        page.locator("#tp-e-context").fill("A retail company sends every order to a warehouse system.")
        page.wait_for_timeout(700)
        own = C.current_hash(page).split("/")[1]
        page.locator("#tp-e-go").click()
        _wait_hash(page, f"techl/case/{own}")
        page.wait_for_selector("#tp-lrun")
        r = TL._run(page)
        if r["n"] != 10:
            probs.append(f"caso propio: {r['n']} preguntas (10 generales)")
        page.locator("#tp-lstage .tp-lta").fill("I would start with the context and the constraints, then the options.")
        page.locator("#tp-ldone").click()
        page.wait_for_selector("#tp-lstage [data-ph=review]", timeout=3000)
        if "A strong answer covers" not in page.inner_text("#tp-lstage"):
            probs.append("caso propio sin «A strong answer covers»")
        page.locator("#tp-lg-partly").click()
        page.wait_for_timeout(300)
        _x(page)
        _stop(page)
        _wait_hash(page, f"techcase/{own}")
        if page.input_value("#tp-e-title") != "Orders to the warehouse with events":
            probs.append("el caso propio perdió su título")
        # «Write yours» en la lección de historias (u07-l2: el segundo ítem es una historia)
        TC.goto(page, "#/techl/lesson/u07-l2")
        s = TL._step(page)
        TL._answer(page, ok=True)
        TL._go_on(page)
        TL._wait_next(page, s["k"])
        st = TL._step(page)
        if st["type"] != "story":
            probs.append(f"u07-l2 ítem 2 es {st['type']}")
        else:
            page.locator("#tp-lstage [data-write]").click()
            page.wait_for_selector("#tp-lstage [data-write][aria-pressed=true]", timeout=3000)
            stories = TC.recs(page, "story")
            mine = [k for k, x in stories.items() if x.get("from") == st["it"]["id"]]
            if len(mine) != 1:
                probs.append(f"«Write yours» no creó story/<id> con from={st['it']['id']}: {stories}")
            TL._nav_stop(page, "#/techstories")
            if mine and page.locator(f"#app a[href='#/{mine[0].replace('story/', 'techstory/')}']").count() != 1:
                probs.append(f"My stories no enseña {mine[0]}: {page.inner_text('#app')[:200]!r}")
            TC.goto(page, f"#/techstory/new?from={st['it']['id']}")
            if mine and C.current_hash(page) != mine[0].replace("story/", "techstory/"):
                probs.append(f"#/techstory/new?from= abre #/{C.current_hash(page)} y no {mine[0]}")
        # Interview › Start
        TC.goto(page, "#/techmock")
        page.locator("#tp-mk-start").click()
        _wait_hash(page, "techl/mock")
        page.wait_for_selector("#tp-lrun")
        if TL._run(page)["kind"] != "mock":
            probs.append(f"Interview › Start: {TL._run(page)}")
        _x(page)
        if _stop_open(page):
            _stop(page)
        _wait_hash(page, "techmock")
        # Today con repasos pendientes → el repaso
        due = {f"srs/{it['id']}": TC.srs(b=1, due=TC.TODAY - 1, d=TC.TODAY - 2) for _, _, it in TC.items(uid="u01")[:6] if TC.REVIEWABLE(it["type"])}
        TC.open_tech(page, "#/tech", data_=TC.data(due))
        if page.inner_text("#tp-go").strip() != "Start" or page.get_attribute("#tp-go", "href") != "#/techl/review":
            probs.append(f"Today con repasos: {page.get_attribute('#tp-go', 'href')} {page.inner_text('.tp-hero')!r}")
        page.locator("#tp-go").click()
        _wait_hash(page, "techl/review")
        page.wait_for_selector("#tp-lrun")
        if TL._run(page)["n"] != len(due):
            probs.append(f"el repaso tiene {TL._run(page)['n']} y había {len(due)}")
        _x(page)
        if _stop_open(page):
            _stop(page)
        _wait_hash(page, "tech")
        # la chuleta desde Path y desde una unidad
        TC.goto(page, "#/techpath")
        page.locator("#app a[href='#/techsheet/integration']").first.click()
        _wait_hash(page, "techsheet/integration")
        if _view(page)["back"] != ["#/techpath", "Path"]:
            probs.append(f"chuleta desde Path: {_view(page)['back']}")
        TC.goto(page, "#/techunit/u03")
        sheet = page.locator("#app a[href='#/techsheet/integration']")
        if sheet.count():
            sheet.first.click()
            _wait_hash(page, "techsheet/integration")
            if _view(page)["back"] != ["#/techunit/u03", "Unit 3"]:
                probs.append(f"chuleta desde la unidad 3: {_view(page)['back']}")
        else:
            probs.append("la unidad no enlaza la chuleta de su bloque")
        if TC.bus_seen(page):
            probs.append(f"eventos del niño: {TC.bus_seen(page)}")
        if TC.kid_changes(page, before):
            probs.append(f"claves del niño: {TC.kid_changes(page, before)}")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)[:3]}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# =============================================================== 5. el recorrido de un mayor
import datetime as _dt  # noqa: E402
import os as _os  # noqa: E402
from pathlib import Path as _Path  # noqa: E402

import test_tech_pages as TP  # noqa: E402

AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
SHOTS = _Path(_os.environ.get("VOCAB_TECH_CAPTURAS") or "/mnt/project-files/tech-prep/capturas/S1")
_DAY2 = C.FIXED_NOW + _dt.timedelta(days=1, hours=1)
# texto en español a la vista dentro de Tech Prep (la Puerta y Ajustes del niño no cuentan): letras con tilde, ¿ ¡ y
# palabras sueltas muy españolas, en el texto, aria-label, title y placeholder de lo que se ve. «Ajustes › Para mayores» y
# «Ajustes › Voz y velocidad» sí: son los nombres de las pantallas del niño adonde se manda al mayor (S1-SPEC §7)
_SPANISH = r"""() => {
  if (!document.documentElement.hasAttribute('data-tech')) return [];
  const rx = /[áéíóúñ¿¡]|\b(?:el|los|las|una|pero|también|porque|cuando|para|volver|cerrar|salir|ajustes|idioma|inicio|siguiente|hecho|guardar|aprender|repaso|lección)\b/i;
  const vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const roots = ['#app', '#topbar', '#tabbar', '#tabhead', '#fx-x', '#dv-back', '#lang-m:not([hidden])', '#m-toasts'].map(s => document.querySelector(s))
    .concat([...document.querySelectorAll('dialog[open]')]).filter(e => e && e.id !== 'gate' && e.id !== 'ajustes');
  const out = new Set();
  for (const r of roots) {
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      const t = n.textContent.trim(), el = n.parentElement;
      if (!t || !el || el.closest('.ipa, .tp-ipa, code, pre, svg, [aria-hidden=true]') || !vis(el)) continue;
      if (rx.test(t.replace(/Ajustes › (?:Para mayores|Voz y velocidad)/g, ''))) out.add(t.slice(0, 80));   /* (los nombres de las pantallas del niño, como en S1-SPEC §7) */
    }
    for (const el of [r, ...r.querySelectorAll('[aria-label], [title], [placeholder]')]) {
      if (!vis(el) && el.tagName !== 'DIALOG') continue;
      for (const a of ['aria-label', 'title', 'placeholder']) { const v = el.getAttribute(a); if (v && rx.test(v)) out.add(`${a}=«${v.slice(0, 80)}»`); }
    }
  }
  if (rx.test(document.title)) out.add('document.title=' + document.title);
  return [...out]; }"""


class _Walk:
    """Lo que se apunta en el recorrido: problemas, capturas y las pantallas por las que pasa."""

    def __init__(self, page, kind, scheme, shots):
        self.page, self.kind, self.scheme, self.shots = page, kind, scheme, shots
        self.probs, self.files = [], []
        self.how = "click" if kind == "desk" else "touch"

    def tag(self):
        return f"{self.kind}-{self.scheme}"

    def check(self, label):
        """En cada pantalla: sin español dentro de Tech Prep, sin scroll horizontal, contraste y paleta."""
        p = self.page
        es = p.evaluate(_SPANISH)
        if es:
            self.probs.append(f"{self.tag()} {label}: español en Tech Prep: {es[:4]}")
        w = p.evaluate("[document.documentElement.scrollWidth, innerWidth]")
        if w[0] > w[1]:
            self.probs.append(f"{self.tag()} {label}: scroll horizontal {w}")
        if not p.evaluate("document.documentElement.hasAttribute('data-tech')"):
            return   # (las pantallas y el menú del niño los miran sus propias pruebas; aquí no cambian)
        a = p.evaluate(AUDIT, {"what": ["contrast", "palette"]})
        self.probs += [f"{self.tag()} {label} contraste: {x}" for x in a["contrast"][:3]]
        self.probs += [f"{self.tag()} {label} paleta: {x}" for x in a["palette"][:3]]

    def shot(self, name, full=None, label=None, scroll=None):
        """Captura con nombre (S1-<name>-<light|dark|escritorio>). En modo foco, la ventana (full=False): una captura de
        la página entera dejaría el botón fijo de abajo en medio. scroll: lo que se lleva al centro antes."""
        self.check(label or name)
        if not self.shots:
            return
        p = self.page
        if full is None and p.evaluate("document.documentElement.dataset.focus || ''"):
            full = False
        if scroll:
            p.evaluate("s => { const e = document.querySelector(s); if (e) e.scrollIntoView({block: 'center'}); }", scroll)
        p.wait_for_timeout(250)
        suffix = "escritorio" if self.kind == "desk" else self.scheme
        self.files.append(str(C.shot(p, f"S1-{name}-{suffix}", SHOTS, full_page=full)))


def _walk_lesson(w, before=None, after=None, wrong=()):
    """Una lección (o un repaso) entera: before(st) antes de contestar cada paso, after(res, st) después; los pasos de
    wrong (ids) se contestan mal. Devuelve los pasos."""
    page, seen = w.page, []
    for _ in range(60):
        r = TL._run(page)
        if not r or r["ended"] or not r["step"]:
            break
        st = r["step"]
        if before:
            before(st)
        ok = st["id"] not in wrong or st.get("re")
        res = TL._answer(page, ok=ok, how=w.how, grade="nailed" if ok else "notyet",
                         text=None if ok else "I am not sure, I would ask the team and read the documentation first.")
        if after:
            after(res, st)
        seen.append(res)
        if res["type"] not in ("explain", "flip"):
            TL._go_on(page, w.how)
        TL._wait_next(page, st["k"])
    return seen


def _ajustes_mayores(page):
    """Ajustes (el engranaje) › Para mayores, con la Puerta de verdad."""
    page.locator(".topbar [data-open=ajustes]").click()
    page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
    C.settle(page, 250)
    page.locator("#aj-may").click()
    # (la Puerta se recuerda unos minutos tras pasarla, js/gate.js: si se acaba de pasar para entrar en Tech Prep, no sale)
    page.wait_for_function("() => (document.getElementById('gate') && document.getElementById('gate').open)"
                           " || (window.vocabSettings && vocabSettings.page === 'mayores')", timeout=4000)
    if TC.gate_open(page):
        C.settle(page, 200)
        TC.answer_gate(page)
    page.wait_for_function("() => window.vocabSettings && vocabSettings.page === 'mayores'", timeout=5000)
    page.wait_for_timeout(500)
    page.locator("#aj-tp").scroll_into_view_if_needed()
    page.wait_for_timeout(200)


def _close_ajustes(page):
    for _ in range(4):
        if not page.evaluate("() => !!(document.getElementById('ajustes') && document.getElementById('ajustes').open)"):
            break
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)


def _enter(w, shots=True):
    """Menú de la bandera › Tech Prep › la Puerta › Today."""
    page = w.page
    page.locator("#lang-b").click()
    page.wait_for_selector("#lang-m:not([hidden]) [data-tech-entry]", timeout=3000)
    page.wait_for_timeout(300)
    if shots:
        w.shot("02-menu-con-tech-prep", full=False)
    page.locator("#lang-m [data-tech-entry]").click()
    page.wait_for_function("() => document.getElementById('gate') && document.getElementById('gate').open", timeout=5000)
    C.settle(page, 250)
    g = TC.gate_info(page)
    if g["why"] != "Para entrar en Tech Prep.":
        w.probs.append(f"{w.tag()}: la Puerta dice {g}")
    if shots and w.shots:
        w.files.append(str(C.shot(page, f"S1-03-puerta-al-entrar-{'escritorio' if w.kind == 'desk' else w.scheme}", SHOTS, full_page=False)))
    TC.answer_gate(page)
    _wait_hash(page, "tech")
    page.wait_for_selector("#tp-today")


def _walkthrough(kind, scheme, shots=True, offline=False):
    srv = C.Server(C.ROOT, "localhost")
    ctx = C.new_context(kind, color_scheme=scheme, sw=True, server=srv)
    ctx.add_init_script(TC.SPEECH)
    page = ctx.new_page()
    w = _Walk(page, kind, scheme, shots)
    stopped = False
    base = C.load_baseline()
    try:
        C.seed(page)
        page.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=20000)
        C.reload(page)
        before = TC.kid_snapshot(page)
        if base and C.diff_exports(base, C.export(page), allow_new=False):
            w.probs.append(f"{w.tag()}: la partida sembrada no es la base al empezar")
        # ---- día 1: encender Tech Prep en Ajustes › Para mayores
        _ajustes_mayores(page)
        page.locator("label[for=aj-tp-on]").click()
        page.wait_for_timeout(300)
        if page.evaluate("localStorage.getItem('tech:on')") != "true":
            w.probs.append(f"{w.tag()}: el interruptor no encendió tech:on")
        if shots and w.shots:
            w.files.append(str(C.shot(page, f"S1-01-para-mayores-interruptor-{'escritorio' if kind == 'desk' else scheme}", SHOTS, full_page=False)))
        _close_ajustes(page)
        _enter(w)
        TC.bus_log(page)
        w.shot("04-today", full=True)
        # una lección técnica entera (Today › Start: u01-l1), con la tarjeta de concepto y su IPA
        page.locator("#tp-go").click()
        _wait_hash(page, "techl/lesson/u01-l1")
        page.wait_for_selector("#tp-lrun")
        first_card = {"done": False}

        def card_shot(st):
            if st["type"] == "card" and not first_card["done"]:
                first_card["done"] = True
                ipa = page.evaluate("() => { const s = document.querySelector('#tp-lstage .tp-ipa'); return s ? [s.textContent, s.getBoundingClientRect().height > 0] : null; }")
                if not ipa or not ipa[1] or "/" not in ipa[0]:
                    w.probs.append(f"{w.tag()}: la tarjeta de concepto no enseña la IPA: {ipa}")
                w.shot("05-tarjeta-concepto-con-ipa")
        _walk_lesson(w, before=card_shot, wrong={"u01-l1-i6"})
        page.wait_for_selector("#tp-lend")
        end = page.inner_text("#tp-lend")
        if "Lesson complete" not in end or "right first time" not in end:
            w.probs.append(f"{w.tag()}: final de lección: {end[:160]!r}")
        w.shot("06-final-de-leccion")
        # la siguiente: u01-l2 (práctica), con el scenario contestado, el diagram y el code
        page.locator("#tp-lnextl").click()
        _wait_hash(page, "techl/lesson/u01-l2")
        page.wait_for_selector("#tp-lrun")
        seen_t = set()

        def practice_before(st):
            t = st["type"]
            if t in ("diagram", "code") and t not in seen_t:
                seen_t.add(t)
                w.shot("08-diagram" if t == "diagram" else "09-code")

        def practice_after(res, st):
            if res["type"] == "scenario" and "scenario" not in seen_t:
                seen_t.add("scenario")
                w.shot("07-scenario-contestado", scroll="#tp-lstage .tp-lfb")
        _walk_lesson(w, before=practice_before, after=practice_after, wrong={"u01-l2-i5"})
        page.wait_for_selector("#tp-lend")
        if seen_t != {"diagram", "code", "scenario"}:
            w.probs.append(f"{w.tag()}: u01-l2 sin {({'diagram', 'code', 'scenario'} - seen_t)}")
        # u01-l3 hasta su primer «Explain it»: la revisión con los puntos clave
        page.locator("#tp-lnextl").click()
        _wait_hash(page, "techl/lesson/u01-l3")
        page.wait_for_selector("#tp-lrun")
        for _ in range(10):
            st = TL._step(page)
            if st["type"] == "explain":
                break
            TL._answer(page, ok=True, how=w.how)
            TL._go_on(page, w.how)
            TL._wait_next(page, st["k"])
        st = TL._step(page)
        page.locator("#tp-lstage .tp-lta").fill(st["it"]["model"][:260])
        page.locator("#tp-ldone").click()
        page.wait_for_selector("#tp-lstage [data-ph=review]", timeout=3000)
        kp = page.evaluate("() => [document.querySelectorAll('#tp-lstage .tp-lkp.is-on').length, document.querySelectorAll('#tp-lstage .tp-lkp').length]")
        if not kp[1] or not kp[0]:
            w.probs.append(f"{w.tag()}: «Explain it» sin puntos clave encontrados: {kp}")
        w.shot("10-explain-puntos-clave", scroll="#tp-lstage .tp-lkps")
        page.locator("#tp-lg-nailed").click()
        TL._wait_next(page, st["k"])
        _x(page)
        _stop(page)
        _wait_hash(page, "tech")
        # una lección de liderazgo entera (Path › Unit 7 › Lesson 2: historias), con «Write yours»
        page.locator("#tab-tp-path").click()
        _wait_hash(page, "techpath")
        page.locator("#app a[href='#/techunit/u07']").first.click()
        _wait_hash(page, "techunit/u07")
        page.locator("#tp-l-u07-l2").click()
        _wait_hash(page, "techl/lesson/u07-l2")
        page.wait_for_selector("#tp-lrun")
        wrote = {"n": 0}

        def story_before(st):
            if st["type"] == "story" and not wrote["n"]:
                wrote["n"] = 1
                page.locator("#tp-lstage [data-write]").click()
                page.wait_for_selector("#tp-lstage [data-write][aria-pressed=true]", timeout=3000)
                w.shot("11-leccion-liderazgo-historia")
        _walk_lesson(w, before=story_before)
        page.wait_for_selector("#tp-lend")
        if not TC.recs(page, "story"):
            w.probs.append(f"{w.tag()}: «Write yours» no dejó un borrador en My stories")
        if TC.recs(page, "ls").keys() != {"ls/u01-l1", "ls/u01-l2", "ls/u07-l2"}:
            w.probs.append(f"{w.tag()}: lecciones hechas {sorted(TC.recs(page, 'ls'))}")
        page.locator("#tp-lpath").click()
        _wait_hash(page, "techpath")
        page.locator("#tab-tp-today").click()
        _wait_hash(page, "tech")
        page.locator("#tp-back").click()
        _wait_hash(page, "")
        d = TC.kid_changes(page, before)
        if d:
            w.probs.append(f"{w.tag()} día 1: Tech Prep cambió la partida del niño: {d[:3]}")
        if base and C.diff_exports(base, C.export(page), allow_new=False):
            w.probs.append(f"{w.tag()} día 1: la exportación no es la base: {C.diff_exports(base, C.export(page), allow_new=False)[:3]}")
        if TC.bus_seen(page):
            w.probs.append(f"{w.tag()} día 1: eventos del niño {TC.bus_seen(page)}")
        # ---- día 2: la app abre en Hoy del niño; el mayor vuelve a entrar y repasa
        ctx.clock.set_system_time(_DAY2)
        C.goto(page, "", reload=True)
        before2 = TC.kid_snapshot(page)
        _enter(w, shots=False)
        TC.bus_log(page)
        n_due = page.evaluate("() => vocabTech.srs.dueCount()")
        if not n_due or page.get_attribute("#tp-go", "href") != "#/techl/review":
            w.probs.append(f"{w.tag()} día 2: Today no propone el repaso ({n_due} pendientes)")
        w.shot("12-today-con-repaso", full=True)
        page.locator("#tp-go").click()
        _wait_hash(page, "techl/review")
        page.wait_for_selector("#tp-lrun")
        flips = {"n": 0}

        def review_before(st):
            if st["type"] == "flip" and not flips["n"]:
                flips["n"] = 1
                w.shot("13-repaso-tarjeta")
        _walk_lesson(w, before=review_before)
        page.wait_for_selector("#tp-lrvend, #tp-lend", timeout=5000)
        w.shot("14-repaso-final")
        _x(page)
        if _stop_open(page):
            _stop(page)
        # una entrevista corta (15 minutos)
        page.locator("#tab-tp-mock").click()
        _wait_hash(page, "techmock")
        page.locator("#tp-mk [data-len='15']").click()
        page.locator("#tp-mk-start").click()
        _wait_hash(page, "techl/mock")
        page.wait_for_selector("#tp-lrun")
        n = TL._run(page)["n"]
        for i in range(n):
            if i == 0:
                w.shot("15-entrevista-pregunta")
            TL._mock_answer(page, grade="partly" if i % 2 else "nailed", how=w.how)
        page.wait_for_selector("#tp-lmkend", timeout=5000)
        w.shot("16-entrevista-final")
        if len(TC.recs(page, "mock")) != 1:
            w.probs.append(f"{w.tag()}: la entrevista no quedó en el historial: {TC.recs(page, 'mock')}")
        _x(page)
        if _stop_open(page):
            _stop(page)
        # Path, una unidad, la chuleta y el glosario
        page.locator("#tab-tp-path").click()
        _wait_hash(page, "techpath")
        w.shot("17-path", full=kind != "desk")
        page.locator("#app a[href='#/techunit/u02']").first.click()
        _wait_hash(page, "techunit/u02")
        w.shot("18-unidad", full=False)
        page.locator("#app a[href='#/techsheet/integration']").first.click()
        _wait_hash(page, "techsheet/integration")
        if _view(page)["back"] != ["#/techunit/u02", "Unit 2"]:
            w.probs.append(f"{w.tag()}: la chuleta desde la unidad vuelve a {_view(page)['back']}")
        w.shot("19-chuleta", full=False)
        page.locator("#dv-back").click()   # ‹ Unit 2
        _wait_hash(page, "techunit/u02")
        page.locator("#dv-back").click()   # ‹ Path
        _wait_hash(page, "techpath")
        page.locator("#tabhead .seg-i[href='#/techgloss']").click()
        _wait_hash(page, "techgloss")
        page.locator("#tp-g-q").fill("idempot")
        page.wait_for_timeout(700)
        if "Idempotency" not in page.inner_text("#app"):
            w.probs.append(f"{w.tag()}: buscar «idempot» no da Idempotency")
        w.shot("20-glosario-buscar", full=False)
        # Play: Pairs y Beat the clock
        page.locator("#tab-tp-play").click()
        _wait_hash(page, "techplay")
        page.locator("#tp-g-pairs").click()
        _wait_hash(page, "techl/pairs")
        page.wait_for_selector("#tp-pairs .tp-tile")
        page.locator('.tp-tile[data-s=l][data-i="0"]').click()
        w.shot("21-pairs-jugando")
        page.locator('.tp-tile[data-s=l][data-i="0"]').click()
        TP._pairs_round(page)
        w.shot("22-pairs-final")
        if "best/pairs" not in TC.recs(page, "best"):
            w.probs.append(f"{w.tag()}: Pairs no guardó la mejor marca")
        page.locator("#tp-g-back").click()
        _wait_hash(page, "techplay")
        page.locator("#tp-g-clock").click()
        _wait_hash(page, "techl/clock")
        page.locator("#tp-c-go").click()
        page.wait_for_selector("#tp-c-card")
        for i in range(5):
            page.locator("#tp-c-yes" if i % 2 == 0 else "#tp-c-no").click()
            page.wait_for_selector("#tp-c-fb.ok, #tp-c-fb.miss", timeout=2000)
            if i == 1:
                w.shot("23-beat-the-clock")
            page.clock.run_for(700)
        page.clock.fast_forward(61000)
        page.clock.run_for(500)
        page.wait_for_selector("#tp-cend", timeout=5000)
        if "best/clock" not in TC.recs(page, "best"):
            w.probs.append(f"{w.tag()}: Beat the clock no guardó la mejor marca")
        page.locator("#tp-g-back").click()
        _wait_hash(page, "techplay")
        # un caso propio, con su práctica
        page.locator("#tab-tp-cases").click()
        _wait_hash(page, "techcases")
        page.locator("#tp-c-new").click()
        _wait_hash(page, r"^techcase/my-[a-z0-9]+$")
        own = C.current_hash(page).split("/")[1]
        page.locator("#tp-e-title").fill("Hires to payroll with events")
        page.locator("#tp-e-context").fill("A retail company hires about 300 people a month and payroll needs each new hire the same day.")
        page.locator("#tp-e-requirements").fill("New hires reach payroll within an hour, nothing is lost and nothing is sent twice.")
        page.locator("#tp-e-decision").fill("We published an event per hire and let payroll consume it with an idempotent handler.")
        page.wait_for_timeout(800)
        w.shot("24-caso-propio", full=False)
        page.locator("#tp-e-go").click()
        _wait_hash(page, f"techl/case/{own}")
        page.wait_for_selector("#tp-lrun")
        page.locator("#tp-lstage .tp-lta").fill("The context was a retail company with many hires; the main constraint was no duplicates.")
        page.locator("#tp-ldone").click()
        page.wait_for_selector("#tp-lstage [data-ph=review]", timeout=3000)
        page.locator("#tp-lg-partly").click()
        page.wait_for_timeout(300)
        _x(page)
        _stop(page)
        _wait_hash(page, f"techcase/{own}")
        # un caso modelo y su práctica
        page.locator("#dv-back").click()
        _wait_hash(page, "techcases")
        page.locator(f"#app a[href='#/techcase/{_CASE}']").first.click()
        _wait_hash(page, f"techcase/{_CASE}")
        w.shot("25-caso-modelo", full=False)
        page.locator("#tp-e-go").click()
        _wait_hash(page, f"techl/case/{_CASE}")
        page.wait_for_selector("#tp-lrun")
        st = TL._step(page)
        page.locator("#tp-lstage .tp-lta").fill((st["it"].get("model") or "")[:300])
        page.locator("#tp-ldone").click()
        page.wait_for_selector("#tp-lstage [data-ph=review]", timeout=3000)
        w.shot("26-practica-de-caso")
        page.locator("#tp-lg-nailed").click()
        page.wait_for_timeout(300)
        _x(page)
        _stop(page)
        _wait_hash(page, f"techcase/{_CASE}")
        # una historia
        page.locator("#dv-back").click()
        _wait_hash(page, "techcases")
        page.locator("#tabhead .seg-i[href='#/techstories']").click()
        _wait_hash(page, "techstories")
        page.locator("#tp-s-new").click()
        _wait_hash(page, r"^techstory/my-[a-z0-9]+$")
        page.locator("#tp-e-title").fill("The retry storm")
        page.locator("#tp-e-prompt").fill("Tell me about a time you prevented an outage.")
        for k, t in (("situation", "Our order service called a partner API that started to fail at peak time."),
                     ("task", "I had to stop the failures spreading to checkout before the sale the next morning."),
                     ("action", "I added a circuit breaker, capped retries with backoff and jitter, and agreed a limit with the partner."),
                     ("result", "Checkout stayed up during the sale and partner errors no longer caused a queue of retries."),
                     ("lessons", "Retries need limits and a budget, and partners need to agree on them early.")):
            page.locator(f"#tp-e-{k}").fill(t)
        page.wait_for_timeout(800)
        page.evaluate("() => { window.__spoken.length = 0; }")
        page.locator("#tp-e-hear").click()
        page.wait_for_timeout(500)
        if not any("retry" in x["text"].lower() or "partner" in x["text"].lower() for x in TC.spoken(page)):
            w.probs.append(f"{w.tag()}: «Hear it» no lee la historia: {TC.spoken(page)[:2]}")
        w.shot("27-historia", full=False)
        if "words" not in page.inner_text("#tp-wc"):
            w.probs.append(f"{w.tag()}: sin el contador de palabras: {page.inner_text('#tp-wc')!r}")
        # Tech Prep settings: fecha, descarga para usar sin red, borrar progreso
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_selector("dialog#tp-set[open]", timeout=4000)
        page.wait_for_timeout(500)
        page.locator("#tp-set-date").fill(TC.day_str(TC.TODAY + 21))
        page.wait_for_timeout(300)
        if page.evaluate("vocabTech.interview.date()") != TC.day_str(TC.TODAY + 21):
            w.probs.append(f"{w.tag()}: la fecha de la entrevista no se guardó")
        page.wait_for_function("() => !/Checking/.test(document.getElementById('tp-set-dls').textContent)", timeout=5000)
        page.locator("#tp-set-dl").click()
        page.wait_for_function("() => /^Done|^Saved/.test(document.getElementById('tp-set-dls').textContent)", timeout=30000)
        if not page.inner_text("#tp-set-dls").startswith("Done · all"):
            w.probs.append(f"{w.tag()}: «Download for offline»: {page.inner_text('#tp-set-dls')!r}")
        w.shot("28-ajustes-tech-prep", full=False)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
        if offline:
            srv.stop()
            stopped = True
            ctx.set_offline(True)
            C.clear_errors(page)
            C.reload(page)
            TC.wait_tech(page)
            for h, sel in (("#/techunit/u05", "#tp-u-go"), ("#/techgloss", "#tp-g-q"), ("#/techl/lesson/u06-l1", "#tp-lrun"),
                           (f"#/techcase/{_CASE}", "#tp-e-go"), ("#/tech", "#tp-today")):
                TL._nav_stop(page, h) if C.current_hash(page).startswith("techl") else TC.goto(page, h)
                if page.locator(sel).count() == 0:
                    w.probs.append(f"{w.tag()} sin red: {h} no enseña {sel}: {page.inner_text('#app')[:120]!r}")
            w.shot("29-today-sin-red", full=False)
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_selector("dialog#tp-set[open]", timeout=4000)
        page.wait_for_timeout(400)
        page.locator("#tp-set-erase").click()
        page.wait_for_selector("dialog#tp-erase[open]", timeout=4000)
        page.wait_for_timeout(400)
        w.shot("30-borrar-progreso-confirmar", full=False)
        page.locator("#tp-erase-yes").click()
        page.wait_for_timeout(800)
        left = {k: v for k, v in TC.recs(page).items() if not k.startswith("act/")}
        if left:
            w.probs.append(f"{w.tag()}: tras borrar quedan {sorted(left)[:5]}")
        _close_sheets(page)
        page.wait_for_timeout(300)
        page.locator("#tab-tp-today").click()
        _wait_hash(page, "tech")
        if not page.inner_text("#tp-hero-t").startswith("Unit 1") or page.inner_text("#tp-go").strip() != "Start":
            w.probs.append(f"{w.tag()}: Today tras borrar: {page.inner_text('.tp-hero')!r}")
        # volver a los idiomas (desde los ajustes) y apagar el interruptor
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_selector("dialog#tp-set[open]", timeout=4000)
        page.wait_for_timeout(400)
        page.locator("#tp-set-back").click()
        _wait_hash(page, "")
        if _tab_ids(page) != _KID_TABS:
            w.probs.append(f"{w.tag()}: «Back to languages» deja las pestañas {_tab_ids(page)}")
        _ajustes_mayores(page)
        page.locator("label[for=aj-tp-on]").click()
        page.wait_for_timeout(300)
        _close_ajustes(page)
        if page.evaluate("localStorage.getItem('tech:on')") is not None:
            w.probs.append(f"{w.tag()}: apagar no quitó tech:on")
        page.locator("#lang-b").click()
        page.wait_for_selector("#lang-m:not([hidden])", timeout=3000)
        if page.locator("#lang-m [data-tech-entry]").count():
            w.probs.append(f"{w.tag()}: apagado, el menú sigue con Tech Prep")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        page.evaluate("() => { location.hash = '#/techpath'; }")
        page.wait_for_timeout(800)
        if C.current_hash(page) != "":
            w.probs.append(f"{w.tag()}: apagado, #/techpath se queda en #/{C.current_hash(page)}")
        d = TC.kid_changes(page, before2)
        if d:
            w.probs.append(f"{w.tag()} día 2: Tech Prep cambió la partida del niño: {d[:3]}")
        if TC.bus_seen(page):
            w.probs.append(f"{w.tag()} día 2: eventos del niño {TC.bus_seen(page)}")
        errs = [e for e in C.errors(page) if not (offline and "ERR_INTERNET_DISCONNECTED" in e)]
        if errs:
            w.probs.append(f"{w.tag()}: errores {errs[:4]}")
    finally:
        try:
            ctx.set_offline(False)
        except Exception:  # noqa: BLE001
            pass
        ctx.close()
        if not stopped:
            srv.stop()
    return w


def test_adult_walkthrough_phone_light():
    """El recorrido entero de un mayor en el móvil (390×844, claro), en dos días. Día 1: Ajustes › Para mayores (la
    Puerta) › encender Tech Prep; menú de la bandera › Tech Prep (la Puerta) › Today; una lección técnica entera (u01-l1,
    con la tarjeta y su IPA y un fallo), la siguiente (u01-l2: scenario, diagram, code…), el primer «Explain it» de
    u01-l3 con sus puntos clave y «Stop», la lección de historias de liderazgo entera (u07-l2) con «Write yours»;
    «Back to languages» y la partida del niño igual que la base. Día 2: la app abre en Hoy, se vuelve a entrar (Puerta),
    Today propone el repaso y se hace entero; una entrevista de 15 minutos entera; Path, una unidad, su chuleta
    (vuelve a la unidad) y el glosario con búsqueda; Pairs y Beat the clock con su mejor marca; un caso propio y su
    práctica (preguntas generales), un caso modelo y su práctica; una historia con «Hear it»; Tech Prep settings: la
    fecha de la entrevista, «Download for offline» y, con el servidor parado y sin red, Tech Prep sigue (una unidad que
    no se abrió, el glosario, una lección, un caso); «Erase Tech Prep progress» (confirmación); «Back to languages» y
    apagar el interruptor (ni menú ni rutas). Todo en inglés, sin scroll horizontal, contraste y paleta bien, sin
    errores ni claves o eventos del niño."""
    w = _walkthrough("phone", "light", offline=True)
    assert not w.probs, "\n".join(w.probs)


def test_adult_walkthrough_phone_dark():
    """El mismo recorrido en el móvil en oscuro (con su red: sin la parte sin conexión)."""
    w = _walkthrough("phone", "dark")
    assert not w.probs, "\n".join(w.probs)


def test_adult_walkthrough_desktop():
    """El mismo recorrido en el escritorio (1280×800, claro)."""
    w = _walkthrough("desk", "light")
    assert not w.probs, "\n".join(w.probs)
