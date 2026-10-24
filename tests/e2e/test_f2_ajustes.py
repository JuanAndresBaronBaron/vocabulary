"""F2b (plan-doc §Ajustes y Puerta de mayores): la Puerta de mayores (window.adultGate: una suma de dos cifras con
llevada en letras, que se contesta con un teclado numérico, nueva en cada intento, 3 fallos y un minuto de espera, se
recuerda 5 minutos y se olvida al cerrar Ajustes), la hoja de Ajustes al estilo de iPhone
(window.openSettings: Sonido, Voz y velocidad, Apariencia, Accesibilidad y Para mayores con Google, instalar, descargar
todo, IPA, créditos y privacidad), las preferencias de este aparato en "vocab:ui" (fuera de la partida) y Google sin
botón de guardar (js/sync.js): el permiso se renueva solo en un toque normal, nunca en mitad de una lección, una partida,
la Puerta o un campo de texto, y Para mayores dice cómo va la copia."""
from __future__ import annotations

import json

import common as C
import routes as R
import test_f3_leccion as LS
import test_f4_granja as FG
import test_f4_juegos as GJ
import test_f4_temporadas as TS

UNI = {"uno": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6, "siete": 7, "ocho": 8, "nueve": 9}
TENS = {"treinta": 30, "cuarenta": 40, "cincuenta": 50, "sesenta": 60, "setenta": 70, "ochenta": 80, "noventa": 90}
VEINTI = {w: 20 + i for i, w in enumerate(["veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco",
                                           "veintiséis", "veintisiete", "veintiocho", "veintinueve"])}
NOW_MS = int(C.FIXED_NOW.timestamp() * 1000)
MIN = 60_000

# lo que enseña la Puerta abierta
_GATE = """() => { const d = document.getElementById('gate'); if (!d) return {open: false};
  const b = d.querySelector('#gt-q b'), ks = [...d.querySelectorAll('#gt-ks .gt-k')];
  return {open: d.open, q: b ? b.textContent : '', keys: ks.map(x => x.dataset.k), h: ks.map(x => x.offsetHeight),
    off: ks.filter(x => x.disabled).map(x => x.dataset.k), field: d.querySelector('#gt-f').textContent, qShown: !d.querySelector('#gt-q').hidden,
    msg: d.querySelector('#gt-msg').textContent, why: d.querySelector('#gt-why').textContent,
    title: (document.getElementById(d.getAttribute('aria-labelledby')) || {}).textContent,
    inside: d.contains(document.activeElement)}; }"""
_PAGE = "() => window.vocabSettings ? vocabSettings.page : null"
_UI = "() => { try { return JSON.parse(localStorage.getItem('vocab:ui')); } catch (e) { return 'roto'; } }"
_PASS = "() => sessionStorage.setItem('vocab:gate', String(Date.now() + adultGate.MS))"


def _num(words):
    """21-99 en letras («cuarenta y siete», «veintiséis») → número."""
    w = words.strip()
    if w in VEINTI:
        return VEINTI[w]
    if " y " in w:
        t, u = w.split(" y ")
        return TENS[t] + UNI[u]
    return TENS[w]


def _nums(q):
    a, b = q.split(" más ")
    return _num(a), _num(b)


def _sum(q):
    assert " más " in q, f"la pregunta no es una suma en letras: {q!r}"
    a, b = _nums(q)
    return a + b


def _type(page, n):
    """Escribe n con el teclado de la Puerta y toca OK."""
    for ch in str(n):
        page.locator(f'#gt-ks .gt-k[data-k="{ch}"]').click()
    page.locator('#gt-ks .gt-k[data-k="ok"]').click()


def _open_settings(page):
    page.locator(".topbar [data-open=ajustes]").click()
    page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
    C.settle(page, 250)


def _wait_page(page, name, timeout=4000):
    page.wait_for_function(f"() => ({_PAGE})() === {json.dumps(name)}", timeout=timeout)
    page.wait_for_timeout(450)   # la sub-página entra deslizándose


def _answer(page, right):
    g = page.evaluate(_GATE)
    s = _sum(g["q"])
    _type(page, s if right else s + 1)
    return g


def _gate_closed(page):
    page.wait_for_function("() => !document.getElementById('gate').open", timeout=3000)


# ---------------------------------------------------------------- Puerta de mayores
def test_gate_blocks_wrong_and_lets_right_in():
    """Ajustes › Para mayores pasa por la Puerta: una suma de dos números de dos cifras con llevada, en letras, que se
    contesta con un teclado numérico (0-9, borrar y OK, teclas grandes); un fallo no deja entrar y trae otra suma,
    acertar entra (con el foco en el título de la página nueva) y se recuerda 5 minutos en sessionStorage, y cerrar
    Ajustes la olvida; 3 fallos la cierran con un aviso amable y un minuto de espera (se abre sin teclado), y Esc o
    «Cancelar» dan false. Es un dialog con su título y el foco dentro."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/")
        _open_settings(page)
        if page.evaluate(_PAGE) != "root":
            probs.append(f"Ajustes no abre en la portada: {page.evaluate(_PAGE)}")
        page.locator("#aj-may").click()
        page.wait_for_selector("#gate[open]", timeout=3000)
        C.settle(page, 250)
        g = page.evaluate(_GATE)
        if g["title"] != "Para mayores" or not g["why"] or not g["inside"]:
            probs.append(f"la Puerta: título {g['title']!r}, motivo {g['why']!r}, foco dentro {g['inside']}")
        if page.evaluate("document.getElementById('gate').tagName") != "DIALOG":
            probs.append("la Puerta no es un <dialog>")
        try:
            s = _sum(g["q"])
        except (KeyError, ValueError, AssertionError) as e:
            probs.append(f"pregunta rara: {g['q']!r} ({e})")
            s = None
        if s is not None:
            a, b = _nums(g["q"])
            if not (36 <= a <= 89 and 36 <= b <= 89 and a % 10 and b % 10 and a % 10 + b % 10 >= 10):
                probs.append(f"la suma no es de dos cifras con llevada: {g['q']!r}")
        if g["keys"] != ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"] or g["off"] != ["ok"] or g["field"] != "?":
            probs.append(f"el teclado: {g['keys']}, desactivadas {g['off']}, campo {g['field']!r}")
        if min(g["h"] or [0]) < 56:
            probs.append(f"las teclas son pequeñas: {g['h']}")
        # borrar: escribe 12, borra una y queda 1
        page.locator('#gt-ks .gt-k[data-k="1"]').click()
        page.locator('#gt-ks .gt-k[data-k="2"]').click()
        page.locator('#gt-ks .gt-k[data-k="del"]').click()
        if page.evaluate(_GATE)["field"] != "1":
            probs.append(f"borrar no quita la última cifra: {page.evaluate(_GATE)['field']!r}")
        page.locator('#gt-ks .gt-k[data-k="del"]').click()
        # un fallo: no entra, otra suma y un mensaje amable
        g0 = _answer(page, right=False)
        page.wait_for_timeout(200)
        g1 = page.evaluate(_GATE)
        if not g1["open"] or g1["q"] == g0["q"] or "Prueba" not in g1["msg"]:
            probs.append(f"tras un fallo: abierta {g1['open']}, pregunta {g0['q']!r} → {g1['q']!r}, mensaje {g1['msg']!r}")
        if page.evaluate("sessionStorage.getItem('vocab:gate')") is not None or page.evaluate(_PAGE) != "root":
            probs.append("un fallo deja entrar en Para mayores")
        # acertar: entra en Para mayores y se recuerda
        _answer(page, right=True)
        _gate_closed(page)
        _wait_page(page, "mayores")
        left = page.evaluate("+sessionStorage.getItem('vocab:gate') - Date.now()")
        if not (4 * MIN < left <= 5 * MIN):
            probs.append(f"la Puerta no se recuerda 5 minutos: quedan {left} ms")
        if page.locator("#aj-tt").text_content() != "Para mayores":
            probs.append(f"título de la sub-página: {page.locator('#aj-tt').text_content()!r}")
        page.wait_for_timeout(300)
        foc = page.evaluate("() => { const a = document.activeElement; return {id: a && a.id, inside: document.getElementById('ajustes').contains(a)}; }")
        if not foc["inside"] or foc["id"] != "aj-tt":
            probs.append(f"tras la Puerta el foco no está en el título de Para mayores: {foc}")
        # volver y entrar otra vez: ya no pregunta
        page.locator("#aj-back").click()
        _wait_page(page, "root")
        page.locator("#aj-may").click()
        _wait_page(page, "mayores")
        if page.evaluate("document.getElementById('gate').open"):
            probs.append("con la Puerta pasada hace poco vuelve a preguntar")
        page.locator("#aj-done").click()
        page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=3000)
        page.wait_for_timeout(300)
        if page.evaluate("sessionStorage.getItem('vocab:gate')") is not None:
            probs.append("cerrar Ajustes no vuelve a cerrar la Puerta")
        # tres fallos: false, se cierra, avisa y espera un minuto
        page.evaluate("() => { adultGate.forget(); window.__g = 'esperando'; adultGate({reason: 'Prueba.'}).then(v => { window.__g = v; }); }")
        page.wait_for_selector("#gate[open]", timeout=3000)
        C.settle(page, 200)
        for _ in range(3):
            _answer(page, right=False)
            page.wait_for_timeout(120)
        page.wait_for_function("() => window.__g !== 'esperando'", timeout=3000)
        if page.evaluate("window.__g") is not False:
            probs.append(f"tres fallos dan {page.evaluate('window.__g')!r}")
        _gate_closed(page)
        page.wait_for_timeout(400)
        if "para mayores" not in page.evaluate("document.getElementById('m-toasts').textContent").lower():
            probs.append("tras tres fallos no sale el aviso amable")
        wait = page.evaluate("adultGate.waiting()")
        if not (50_000 < wait <= 60_000):
            probs.append(f"tras tres fallos no hay un minuto de espera: {wait} ms")
        page.wait_for_timeout(300)
        page.evaluate("() => { window.__g = 'esperando'; adultGate({}).then(v => { window.__g = v; }); }")
        page.wait_for_selector("#gate[open]", timeout=3000)
        C.settle(page, 200)
        g = page.evaluate(_GATE)
        if g["qShown"] or len(g["off"]) != 12 or "un minuto" not in g["msg"]:
            probs.append(f"durante la espera la Puerta deja contestar: {g}")
        page.locator("#gt-x").click()
        _gate_closed(page)
        # Esc y Cancelar: false
        for how in ("Escape", "cancelar"):
            page.wait_for_timeout(250)
            page.evaluate("() => { window.__g = 'esperando'; adultGate({}).then(v => { window.__g = v; }); }")
            page.wait_for_selector("#gate[open]", timeout=3000)
            C.settle(page, 200)
            if how == "Escape":
                page.keyboard.press("Escape")
            else:
                page.locator("#gt-x").click()
            page.wait_for_function("() => window.__g !== 'esperando'", timeout=3000)
            if page.evaluate("window.__g") is not False:
                probs.append(f"{how} da {page.evaluate('window.__g')!r}")
            _gate_closed(page)
        if page.evaluate("sessionStorage.getItem('vocab:gate')") is not None:
            probs.append("fallar o cancelar deja la Puerta abierta")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_external_links_pass_the_gate():
    """Un enlace a otra web pasa por la Puerta (sin ella no se abre nada) y se abre en otra pestaña al acertar; con la
    Puerta pasada se abre directo, también en otra pestaña."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/")
        page.evaluate("""() => { const a = document.createElement('a'); a.id = 't-ext'; a.href = 'https://example.org/'; a.textContent = 'fuera';
          a.style.cssText = 'position:fixed;left:20px;top:200px;z-index:5;padding:12px;background:#fff'; document.body.appendChild(a); }""")
        page.locator("#t-ext").click()
        page.wait_for_selector("#gate[open]", timeout=3000)
        C.settle(page, 200)
        if not page.url.startswith(C.base_url(page)) or len(page.context.pages) != 1:
            probs.append("el enlace se abre sin pasar la Puerta")
        if "otra web" not in page.evaluate("document.getElementById('gt-why').textContent"):
            probs.append("la Puerta no dice que el enlace abre otra web")
        with page.context.expect_page(timeout=4000) as pi:
            _answer(page, right=True)
        pi.value.close()
        _gate_closed(page)
        with page.context.expect_page(timeout=4000) as pi:
            page.locator("#t-ext").click()
        pi.value.close()
        if not page.url.startswith(C.base_url(page)):
            probs.append(f"la app se ha ido a {page.url}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Ajustes
def test_settings_sheet_rows():
    """La hoja de Ajustes: cabecera con el zorro, el nombre y la racha; Sonido, Voz y velocidad (la de openCfg, dentro
    de la hoja), Apariencia, Accesibilidad y Para mayores; altura media en móvil y grande al entrar en una sub-página;
    «‹ Ajustes» vuelve y «Listo» cierra."""
    probs = []
    for kind in ("phone", "desk"):
        page = C.new_page(kind)
        try:
            C.seed(page)
            C.goto(page, "#/")
            _open_settings(page)
            r = page.evaluate("""() => { const d = document.getElementById('ajustes');
              return {title: (document.getElementById(d.getAttribute('aria-labelledby')) || {}).textContent, sheet: d.classList.contains('m-sheet'),
                hero: !!d.querySelector('.aj-av img, .aj-av svg'), name: (d.querySelector('#aj-name') || {}).value,
                streak: (d.querySelector('#aj-streak') || {}).textContent || '', snd: !!d.querySelector('#aj-snd[role=switch]'),
                th: [...d.querySelectorAll('#aj-th [data-th]')].map(x => x.textContent), voz: (d.querySelector('#aj-voz') || {}).textContent || '',
                acc: !!d.querySelector('#aj-acc'), may: !!d.querySelector('#aj-may [data-sync-cfg]'), detent: d.dataset.detent,
                h: Math.round(d.getBoundingClientRect().height), vh: innerHeight, back: getComputedStyle(document.getElementById('aj-back')).visibility}; }""")
            name = page.evaluate("game().name || ''")
            if r["title"] != "Ajustes" or not r["sheet"] or not r["hero"] or r["name"] != name or not r["streak"]:
                probs.append(f"{kind}: cabecera de Ajustes {r}")
            if not r["snd"] or r["th"] != ["Automático", "Claro", "Oscuro"] or "Voz y velocidad" not in r["voz"] or not r["acc"] or not r["may"]:
                probs.append(f"{kind}: filas de Ajustes {r}")
            want = "medium" if kind == "phone" else "large"
            if r["detent"] != want or (kind == "phone" and not (380 <= r["h"] < r["vh"] * 0.75)):
                probs.append(f"{kind}: altura {r['detent']} {r['h']} px de {r['vh']}")
            # sonido
            m0 = page.evaluate("sfx.muted")
            page.locator("label[for=aj-snd]").click()
            if page.evaluate("sfx.muted") == m0:
                probs.append(f"{kind}: el interruptor de Sonido no cambia nada")
            page.locator("label[for=aj-snd]").click()
            if page.evaluate("sfx.muted") != m0 or page.evaluate("document.getElementById('aj-snd').checked") == m0:
                probs.append(f"{kind}: el interruptor de Sonido no vuelve a su sitio")
            # Voz y velocidad: la de siempre, dentro de la hoja (es corta: se queda a la altura que tenía la hoja)
            d0 = page.evaluate("document.getElementById('ajustes').dataset.detent")
            page.locator("#aj-voz").click()
            _wait_page(page, "voz")
            v = page.evaluate("""() => { const d = document.getElementById('ajustes');
              return {r: !!d.querySelector('#cfg-r'), t: !!d.querySelector('#cfg-t'), tt: document.getElementById('aj-tt').textContent,
                detent: d.dataset.detent, back: getComputedStyle(document.getElementById('aj-back')).visibility,
                cfg: (document.getElementById('cfg') || {}).open || false}; }""")
            if v != {"r": True, "t": True, "tt": "Voz y velocidad", "detent": d0, "back": "visible", "cfg": False}:
                probs.append(f"{kind}: Voz y velocidad {v}")
            page.evaluate("() => { const r = document.querySelector('#ajustes #cfg-r'); r.value = '0.6'; r.dispatchEvent(new Event('input', {bubbles: true})); }")
            if abs(page.evaluate("rate") - 0.6) > 1e-6:
                probs.append(f"{kind}: la velocidad no cambia")
            page.locator("#aj-back").click()
            _wait_page(page, "root")
            if page.evaluate("document.querySelector('#aj-voz .aj-val').textContent") != "Lenta":
                probs.append(f"{kind}: la fila de voz no dice «Lenta»")
            # Esc en una sub-página vuelve atrás; en la portada cierra
            page.locator("#aj-acc").click()
            _wait_page(page, "acc")
            page.keyboard.press("Escape")
            _wait_page(page, "root")
            if not page.evaluate("document.getElementById('ajustes').open"):
                probs.append(f"{kind}: Esc en Accesibilidad cierra la hoja en vez de volver")
            page.locator("#aj-done").click()
            page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=3000)
            if page.evaluate("typeof window.openSettings") != "function":
                probs.append(f"{kind}: falta window.openSettings")
            # openSettings('accesibilidad') abre directamente la sub-página
            page.wait_for_timeout(300)
            page.evaluate("openSettings('accesibilidad')")
            _wait_page(page, "acc")
            page.keyboard.press("Escape")
            _wait_page(page, "root")
            page.keyboard.press("Escape")
            page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=3000)
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_appearance_auto_removes_theme():
    """Apariencia: Claro y Oscuro guardan "theme"; Automático borra la clave y sigue al sistema."""
    probs = []
    for scheme in ("light", "dark"):
        page = C.new_page("phone", color_scheme=scheme)
        try:
            C.seed(page)
            C.goto(page, "#/")
            _open_settings(page)
            for k, want in (("dark", "dark"), ("light", "light"), ("auto", scheme)):
                page.locator(f"#ajustes [data-th={k}]").click()
                page.wait_for_timeout(150)
                st = page.evaluate("""k => ({key: localStorage.getItem('theme'), th: document.documentElement.dataset.theme,
                  on: [...document.querySelectorAll('#ajustes [data-th]')].filter(x => x.getAttribute('aria-checked') === 'true').map(x => x.dataset.th)})""", k)
                key = None if k == "auto" else json.dumps(k)
                if st["key"] != key or st["th"] != want or st["on"] != [k]:
                    probs.append(f"{scheme}: Apariencia {k}: clave {st['key']!r}, tema {st['th']}, marcado {st['on']}")
            C.reload(page)
            if page.evaluate("localStorage.getItem('theme')") is not None or page.evaluate("document.documentElement.dataset.theme") != scheme:
                probs.append(f"{scheme}: Automático no sobrevive a recargar")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


A11Y = [("glass", "off"), ("motion", "calm"), ("contrast", "more"), ("text", "large")]
# (la hoja a toda altura ya es opaca: el vidrio se mira en una superficie .glass de prueba fuera de la hoja)
_FX = """() => { const cs = getComputedStyle(document.documentElement);
  let g = document.getElementById('t-glass'); if (!g) { g = document.createElement('div'); g.id = 't-glass'; g.className = 'glass';
    g.style.cssText = 'position:fixed;left:0;top:0;width:40px;height:40px'; document.body.appendChild(g); }
  return {blur: getComputedStyle(g).backdropFilter, rm: M.rm(), sep: cs.getPropertyValue('--sep').trim(),
    fs: parseFloat(getComputedStyle(document.querySelector('#ajustes .aj-hint')).fontSize)}; }"""


def test_accessibility_switches_persist():
    """Cada interruptor de Accesibilidad pone su atributo en <html> (data-glass=off, data-motion=calm,
    data-contrast=more, data-text=large) con su efecto, se guarda en "vocab:ui" sin tocar lo demás (las pistas de
    gestos), se pone antes de pintar al recargar y se quita al apagarlo. «Mostrar pronunciación (IPA)» sale encendido
    de serie: apagarlo guarda ipa:false y encenderlo quita la marca (sin tocar las pistas)."""
    page = C.new_page("phone")
    probs = []
    try:
        page.context.add_init_script("""(() => { const mo = new MutationObserver(() => { if (document.body) { mo.disconnect();
          window.__uiAtBody = Object.assign({}, document.documentElement.dataset); } }); mo.observe(document, {childList: true, subtree: true}); })();""")
        keys = C.seed_keys()
        keys["vocab:ui"] = json.dumps({"hints": {"swipe": 2, "hold": 1000}})
        C.seed(page, keys=keys)
        C.goto(page, "#/")
        _open_settings(page)
        page.locator("#aj-acc").click()
        _wait_page(page, "acc")
        fx0 = page.evaluate(_FX)
        for k, v in A11Y:
            page.locator(f"label[for=aj-a-{k}]").click()
            page.wait_for_timeout(150)
            at = page.evaluate(f"document.documentElement.dataset.{k}")
            ui = page.evaluate(_UI)
            if at != v or not isinstance(ui, dict) or ui.get(k) != v or ui.get("hints") != {"swipe": 2, "hold": 1000}:
                probs.append(f"Accesibilidad {k}: atributo {at!r}, vocab:ui {ui!r}")
        page.wait_for_timeout(300)
        fx = page.evaluate(_FX)
        if fx0["blur"] == "none" or fx["blur"] != "none":
            probs.append(f"Reducir transparencia: backdrop-filter {fx0['blur']!r} → {fx['blur']!r}")
        if fx0["rm"] or not fx["rm"]:
            probs.append(f"Reducir movimiento: M.rm() {fx0['rm']} → {fx['rm']}")
        if fx0["sep"] == fx["sep"]:
            probs.append(f"Aumentar contraste no cambia --sep ({fx['sep']})")
        if not fx["fs"] > fx0["fs"] * 1.1:
            probs.append(f"Texto más grande: {fx0['fs']} → {fx['fs']} px")
        # al recargar, antes de pintar
        C.reload(page)
        body = page.evaluate("window.__uiAtBody || {}")
        now = page.evaluate("Object.assign({}, document.documentElement.dataset)")
        for k, v in A11Y:
            if body.get(k) != v or now.get(k) != v:
                probs.append(f"tras recargar, {k}: al empezar {body.get(k)!r}, después {now.get(k)!r}")
        _open_settings(page)
        if "4 activados" not in page.locator("#aj-acc").text_content():
            probs.append(f"la fila de Accesibilidad dice {page.locator('#aj-acc').text_content()!r}")
        page.locator("#aj-acc").click()
        _wait_page(page, "acc")
        on = page.evaluate("[...document.querySelectorAll('#ajustes [data-ui]')].map(c => c.checked)")
        if on != [True] * 4:
            probs.append(f"tras recargar, los interruptores: {on}")
        # apagarlos
        for k, v in A11Y:
            page.locator(f"label[for=aj-a-{k}]").click()
            page.wait_for_timeout(120)
            at = page.evaluate(f"document.documentElement.dataset.{k} || null")
            ui = page.evaluate(_UI)
            if at is not None or k in ui or ui.get("hints") != {"swipe": 2, "hold": 1000}:
                probs.append(f"apagar {k}: atributo {at!r}, vocab:ui {ui!r}")
        # IPA, en Para mayores
        page.evaluate(_PASS)
        page.locator("#aj-back").click()
        _wait_page(page, "root")
        page.locator("#aj-may").click()
        _wait_page(page, "mayores")
        if not page.evaluate("document.getElementById('aj-ipa').checked"):
            probs.append("«Mostrar pronunciación (IPA)» no sale encendido de serie")
        page.locator("label[for=aj-ipa]").click()
        page.wait_for_timeout(120)
        ui = page.evaluate(_UI)
        if ui.get("ipa") is not False or ui.get("hints") != {"swipe": 2, "hold": 1000}:
            probs.append(f"IPA apagada: vocab:ui {ui!r}")
        page.locator("label[for=aj-ipa]").click()
        page.wait_for_timeout(120)
        ui = page.evaluate(_UI)
        if "ipa" in ui or ui.get("hints") != {"swipe": 2, "hold": 1000}:
            probs.append(f"IPA encendida: vocab:ui {ui!r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_ui_prefs_not_in_export():
    """"vocab:ui" (y la Puerta, en sessionStorage) no van en la partida: la exportación sigue siendo la de la base."""
    page = C.new_page("desk")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/")
        page.evaluate("() => { ['glass:off', 'motion:calm', 'contrast:more', 'text:large'].forEach(x => { const [k, v] = x.split(':'); vocabUI.set(k, v); }); vocabUI.set('ipa', true); }")
        page.evaluate(_PASS)
        snap = C.export(page)
        ks = snap["keys"]
        if "vocab:ui" in ks or "vocab:gate" in ks:
            probs.append(f"en la exportación están: {[k for k in ('vocab:ui', 'vocab:gate') if k in ks]}")
        base = C.load_baseline()
        if base:
            d = C.diff_exports(base, snap)
            if d:
                probs.append("la exportación cambia:\n  " + "\n  ".join(d))
            extra = C.new_keys(base, snap)
            if extra:
                print(f"      claves nuevas respecto a la base: {', '.join(extra)}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_google_block_in_adults_page():
    """El bloque de Google (js/sync.js) se monta dentro de Ajustes › Para mayores, con instalar, descargar todo,
    IPA, créditos y privacidad (y, desde F5a, la sección Atajos de js/shortcuts.js); la fila dice el estado de Google. Desde fuera
    (vocabSync.go) pasa antes por la Puerta, entrar con Google también, y tras cargar una partida (adult:true) se abre
    sola solo si la Puerta se pasó hace poco."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, "#/")
        _open_settings(page)
        cfg = page.evaluate("document.querySelector('#aj-may [data-sync-cfg]').textContent")
        if cfg != "Google: sin conectar":
            probs.append(f"la fila Para mayores dice {cfg!r}")
        page.evaluate(_PASS)
        page.locator("#aj-may").click()
        _wait_page(page, "mayores")
        r = page.evaluate("""() => { const d = document.getElementById('ajustes'), t = d.textContent;
          return {box: !!d.querySelector('[data-sync-block] #sv-box'), n: document.querySelectorAll('#sv-box').length,
            g: (d.querySelector('#sv-g') || {}).textContent || '', inst: /Instalar|instalada/.test((d.querySelector('#aj-inst') || {}).textContent || ''),
            off: !!d.querySelector('#aj-off #off-dl'), ipa: !!d.querySelector('#aj-ipa[role=switch]'),
            cred: /Phosphor/.test(t) && /Nunito/.test(t), priv: !!d.querySelector('a#aj-priv[href="privacy.html#es"]'), atajos: !!d.querySelector('#aj-sc-on[role=switch]') && !!d.querySelector('#aj-sc-forget')}; }""")
        want = {"box": True, "n": 1, "g": r["g"], "inst": True, "off": True, "ipa": True, "cred": True, "priv": True, "atajos": True}
        if r != want or "Entrar con Google" not in r["g"]:
            probs.append(f"Para mayores: {r}")
        # entrar con Google pasa por la Puerta
        page.evaluate("adultGate.forget()")
        page.locator("#sv-g").click()
        page.wait_for_selector("#gate[open]", timeout=3000)
        C.settle(page, 200)
        page.locator("#gt-x").click()
        _gate_closed(page)
        if page.evaluate("document.getElementById('sv-msg').textContent"):
            probs.append("sin pasar la Puerta, «Entrar con Google» hace algo")
        page.locator("#aj-done").click()
        page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=3000)
        page.wait_for_timeout(300)
        # desde fuera: vocabSync.go() → Puerta → Ajustes › Para mayores con el foco en «Entrar con Google»
        page.evaluate("vocabSync.go({})")
        page.wait_for_selector("#gate[open]", timeout=3000)
        C.settle(page, 200)
        if page.evaluate("document.getElementById('ajustes').open"):
            probs.append("vocabSync.go() abre Ajustes antes de la Puerta")
        _answer(page, right=True)
        _gate_closed(page)
        _wait_page(page, "mayores")
        page.wait_for_timeout(200)
        if page.evaluate("document.activeElement && document.activeElement.id") != "sv-g":
            probs.append(f"el foco no está en «Entrar con Google»: {page.evaluate('document.activeElement && document.activeElement.id')!r}")
        page.locator("#aj-done").click()
        page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=3000)
        # tras cargar una partida (adult:true), con la Puerta pasada: se abre Para mayores. Al cerrar Ajustes la Puerta
        # se olvida; una carga de verdad se hace dentro de Para mayores y recarga con Ajustes abierta (la Puerta sigue)
        page.wait_for_function("() => !adultGate.passed()", timeout=3000)
        page.evaluate(_PASS)
        page.evaluate("sessionStorage.setItem('vocab:save-flash', JSON.stringify({t: '✓ ¡Partida cargada!', adult: true}))")
        C.reload(page)
        try:
            page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
            _wait_page(page, "mayores")
        except Exception:
            probs.append("tras cargar una partida no se abre Ajustes › Para mayores")
        # sin la Puerta pasada no sale nada solo
        page.evaluate("() => { adultGate.forget(); sessionStorage.setItem('vocab:save-flash', JSON.stringify({t: '✓ ¡Partida cargada!', adult: true})); }")
        C.reload(page)
        page.wait_for_timeout(1600)
        st = page.evaluate("({gate: !!(document.getElementById('gate') || {}).open, aj: !!(document.getElementById('ajustes') || {}).open})")
        if st != {"gate": False, "aj": False}:
            probs.append(f"tras cargar una partida sin la Puerta pasada se abre algo solo: {st}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Google sin botón de guardar
# GIS de mentira: requestAccessToken apunta cada llamada (¿dentro de un toque?, ¿con el toque activo?) y contesta a los
# 30 ms (o a los window.__gisDelay ms: red lenta, o un mayor que entra a mano): con un permiso nuevo si se llamó dentro
# de un toque y, si no, como el navegador (ventana bloqueada).
# window.__gisFail = N hace que las N siguientes llamadas dentro de un toque fallen (la ventanita se cerró).
_GIS = """(() => {
  window.__gis = []; window.__gisFail = 0;
  window.google = {accounts: {oauth2: {
    initTokenClient(cfg) { return {requestAccessToken(o) {
      const ev = window.event, tap = !!(ev && ev.type === 'click');
      const act = !!(navigator.userActivation && navigator.userActivation.isActive);
      const fail = tap && window.__gisFail > 0; if (fail) window.__gisFail--;
      window.__gis.push({tap, act, fail, prompt: o && o.prompt, at: location.hash,
        focus: document.documentElement.dataset.focus || '', play: document.documentElement.dataset.gmPlay || ''});
      setTimeout(() => { if (tap && !fail) cfg.callback({access_token: 'nuevo-' + window.__gis.length, expires_in: 3600});
        else cfg.error_callback({type: fail ? 'popup_closed' : 'popup_failed_to_open'}); }, window.__gisDelay || 30);
    }}; },
    hasGrantedAllScopes() { return true; },
    revoke(t, cb) { if (cb) cb(); }}}};
})();"""
_CORS = {"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,OPTIONS"}
# lo que el niño ve de Google: botones o avisos que pidan guardar (fuera de Ajustes), la pastilla vieja, su hueco, la
# fila vieja de Hoy y su hoja, lo que hay a la derecha de la barra de arriba y los avisos de Google
_NO_SAVE = """() => {
  const vis = e => !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
  const say = e => [e.textContent, e.getAttribute('aria-label'), e.getAttribute('title')].join(' ');
  return {buttons: [...document.querySelectorAll('button, a, [role=button]')]
      .filter(e => vis(e) && !e.closest('dialog#ajustes') && /guardar|guarda tu|google/i.test(say(e))).map(e => e.id || e.className || e.tagName),
    chip: !!document.getElementById('sv-chip'), slot: !!document.querySelector('[data-sync-slot]'),
    rem: !!document.getElementById('sv-rem'), kid: !!document.getElementById('sv-kid'),
    right: [...document.querySelectorAll('.topbar .tb-right > *')].filter(vis).map(e => e.className.split(' ')[0]),
    toasts: [...document.querySelectorAll('#m-toasts .m-toast')].map(t => t.textContent).filter(t => /google|guardar|☁/i.test(t))};
}"""
_NO_SAVE_OK = {"buttons": [], "chip": False, "slot": False, "rem": False, "kid": False, "right": ["tb-group"], "toasts": []}
_TAPS = "() => window.__gis.filter(c => c.tap).length"


def _drive(page, log):
    def handle(route):
        req = route.request
        if req.method == "OPTIONS":
            return route.fulfill(status=204, headers=_CORS)
        log.append(f"{req.method} {req.url.split('?')[0]}")
        if "/upload/" in req.url:
            body = {"id": "f1", "modifiedTime": "2026-03-11T09:00:05.000Z", "appProperties": {"hash": "y"}}
        else:
            body = {"id": "f1", "modifiedTime": "2026-03-11T08:00:00.000Z", "appProperties": {"hash": "x"}}
        route.fulfill(status=200, headers=dict(_CORS, **{"content-type": "application/json"}), body=json.dumps(body))
    page.route("https://www.googleapis.com/**", handle)


def _sync_keys(tok_exp, reconnect=True, base=None, now_ms=NOW_MS, tap_at=0):
    """Google conectado hace 2 días, última copia hace 2 h, cambios sin subir (baseHash de mentira) y el permiso que
    caduca en tok_exp. tap_at: el último intento de renovarlo (0: nunca)."""
    keys = dict(base) if base is not None else C.seed_keys()
    keys["save:sync"] = json.dumps({"connectedAt": now_ms - 2 * 864e5, "fileId": "f1", "baseHash": "x", "lastPushedHash": "x",
                                    "lastSync": now_ms - 120 * MIN, "lastPull": now_ms - 120 * MIN, "localDirty": True,
                                    "reconnect": now_ms - 90 * MIN if reconnect else None, "hint": None, "choice": False, "tapAt": tap_at})
    keys["save:tok"] = json.dumps({"t": "viejo", "exp": tok_exp})
    return keys


def _sync_page(scheme="light", exp=NOW_MS - 30 * MIN, reconnect=True, hash="#/"):
    """Móvil con Google conectado (Drive y GIS de mentira), cambios sin subir y el permiso que caduca en exp."""
    page = C.new_page("phone", color_scheme=scheme)
    log = []
    page.context.add_init_script(_GIS)
    _drive(page, log)
    C.seed(page, keys=_sync_keys(exp, reconnect=reconnect), hash=hash)
    page.evaluate("vocabSync._delays({debounce: 300, poll: 500, retry: 60e3})")
    return page, log


def _armed_keys(base, now_ms=NOW_MS):
    """Como _sync_keys, pero con un intento de renovar justo ahora (tapAt) y sin racha de fallos: durante los toques de
    preparación no se pide nada; pasados 3 min (_arm), el siguiente toque que valga lo pediría."""
    return _sync_keys(now_ms - 30 * MIN, reconnect=False, base=base, now_ms=now_ms, tap_at=now_ms)


def _arm(page):
    """Pasan los 3 min del hueco corto: devuelve (llamadas hasta ahora, ¿lo pediría ya el siguiente toque que valga?)."""
    n0 = page.evaluate("window.__gis.length")
    page.clock.fast_forward(3 * MIN + 2000)
    page.wait_for_timeout(200)
    return n0, page.evaluate("vocabSync.tapDue()")


def _uploaded(log):
    return any(x.startswith("PATCH ") and "/upload/" in x for x in log)


def _adults(page):
    """Ajustes (abierta sin tocar nada) › la fila «Para mayores» y, con la Puerta ya pasada, la página con el bloque de
    Google: lo que dicen. Cierra Ajustes con Escape (tampoco es un toque)."""
    page.evaluate("openSettings()")
    page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
    C.settle(page, 250)
    cfg = page.evaluate("document.querySelector('#aj-may [data-sync-cfg]').textContent")
    page.evaluate(_PASS)
    page.evaluate("openSettings('google')")
    _wait_page(page, "mayores")
    box = page.evaluate("""() => { const d = document.getElementById('sv-dyn'), f = document.querySelector('#sv-box .st-foot');
      return {t: d.textContent.replace(/\\s+/g, ' ').trim(), now: !!d.querySelector('#sv-now'), re: !!d.querySelector('#sv-re'),
        foot: f ? f.textContent : ''}; }""")
    for _ in range(3):   # Escape vuelve de Para mayores a Ajustes y luego la cierra
        if not page.evaluate("document.getElementById('ajustes').open"):
            break
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
    page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=3000)
    page.wait_for_timeout(300)
    return cfg, box


def test_no_save_button_and_next_tap_renews():
    """Con Google conectado, el permiso caducado y cambios sin subir, el niño no ve ningún botón ni aviso de guardar
    (ni la pastilla vieja junto a las monedas, ni su hueco, ni una fila en Hoy) y no se pide nada fuera de un toque. El
    siguiente toque en una pestaña pide el permiso dentro del mismo toque y sube la partida. Con el permiso vigente, un
    toque no pide nada."""
    probs = []
    for how in ("pestaña", "vigente"):
        page, log = _sync_page(exp=NOW_MS + 50 * MIN if how == "vigente" else NOW_MS - 30 * MIN, reconnect=how != "vigente")
        try:
            want = "ok" if how == "vigente" else "reconnect"
            try:
                page.wait_for_function("p => vocabSync.state.phase === p", arg=want, timeout=5000)
            except Exception:  # noqa: BLE001
                probs.append(f"{how}: al arrancar el estado es {page.evaluate('vocabSync.state.phase')} (se esperaba {want})")
            page.wait_for_timeout(600)
            seen = page.evaluate(_NO_SAVE)
            if seen != _NO_SAVE_OK:
                probs.append(f"{how}: el niño ve algo de guardar: {seen}")
            if page.evaluate("window.__gis.length"):
                probs.append(f"{how}: se pidió el permiso sin un toque: {page.evaluate('window.__gis')}")
            page.locator(".tabbar [data-nav=aprender]").click()
            if how == "vigente":
                page.wait_for_timeout(600)
                if page.evaluate("window.__gis.length"):
                    probs.append(f"con el permiso vigente, un toque lo pide otra vez: {page.evaluate('window.__gis')}")
                probs += C.errors(page)
                continue
            try:
                page.wait_for_function("() => window.__gis.length > 0", timeout=3000)
            except Exception:  # noqa: BLE001
                probs.append(f"{how}: el toque no pide el permiso (estado {page.evaluate('vocabSync.state')})")
                continue
            call = page.evaluate("window.__gis[0]")
            if not (call["tap"] and call["act"]) or call["prompt"] != "" or page.evaluate("window.__gis.length") != 1:
                probs.append(f"{how}: requestAccessToken no se llamó una vez dentro del toque: {page.evaluate('window.__gis')}")
            try:
                page.wait_for_function("() => vocabSync.state.phase === 'ok' && vocabSync.state.tokOk", timeout=6000)
            except Exception:  # noqa: BLE001
                probs.append(f"{how}: tras renovar, estado {page.evaluate('vocabSync.state')}")
            if not _uploaded(log):
                probs.append(f"{how}: no se subió la partida: {log}")
            st = page.evaluate("vocabSync.state")
            if st["meta"]["reconnect"] or st["meta"]["localDirty"]:
                probs.append(f"{how}: el permiso o la copia no quedaron al día: {st['meta']}")
            seen = page.evaluate(_NO_SAVE)
            if seen["chip"] or seen["slot"] or seen["toasts"]:
                probs.append(f"{how}: tras subir sale algo de guardar: {seen}")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_no_renew_mid_game_gate_field_or_lesson():
    """Con el permiso caducado y cambios sin subir, ningún toque lo pide en mitad de una partida (la explicación, las
    cartas), en la Puerta de mayores (el toque que la abre y sus teclas), en el campo del nombre ni en mitad de una
    lección (respuestas y botones). En el final de la lección, «Siguiente lección» tampoco (empieza otra: la ventanita
    taparía su primer sonido); fuera ya del modo foco, el primer toque en una pestaña sí, dentro del toque."""
    probs = []
    page, log = _sync_page(hash="#/juegos")
    try:
        page.evaluate(GJ._NO_HINT)
        # una partida (se entra sin tocar: el toque en la tarjeta del juego sería como «Empezar»)
        C.goto(page, "#/juegos/memoria")
        page.wait_for_function("() => document.documentElement.dataset.gmPlay === 'memoria'", timeout=8000)
        page.wait_for_timeout(300)
        if page.locator(".gm-intro .gm-go").count():
            page.locator(".gm-intro .gm-go").click()
            page.wait_for_timeout(300)
        for i in (0, 1):
            page.locator("#gm-board .gm-mc").nth(i).click()
            page.wait_for_timeout(150)
        page.wait_for_timeout(400)
        if page.evaluate(_TAPS):
            probs.append(f"en mitad de una partida se pide el permiso: {page.evaluate('window.__gis')}")
        # la Puerta y el campo del nombre (Ajustes abierta sin tocar)
        C.goto(page, "#/mapa")
        page.evaluate("openSettings()")
        page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
        C.settle(page, 250)
        page.locator("#aj-name").click()
        page.keyboard.type("Leo")
        page.locator("#aj-may").click()
        page.wait_for_selector("#gate[open]", timeout=3000)
        C.settle(page, 250)
        for k in ("1", "2", "del"):
            page.locator(f'#gt-ks .gt-k[data-k="{k}"]').click()
        page.locator("#gt-x").click()
        _gate_closed(page)
        page.wait_for_timeout(300)
        if page.evaluate(_TAPS):
            probs.append(f"en la Puerta o en el campo de texto se pide el permiso: {page.evaluate('window.__gis')}")
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=3000)
        page.wait_for_timeout(300)
        # una lección entera, con sus toques (respuestas, «Continuar», «Seguir»)
        C.goto(page, "#/leccion/" + R.LESSON)
        page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-page')", timeout=8000)
        n = LS._play(page, miss=(1,))
        if not n:
            probs.append("la lección no tenía preguntas")
        page.wait_for_selector(".ls-end #ls-next", timeout=8000)
        page.wait_for_timeout(2000)   # las estrellas (los botones no responden hasta entonces) y el regalo, si sale
        if page.evaluate(_TAPS):
            probs.append(f"en mitad de una lección se pide el permiso: {page.evaluate('window.__gis')}")
        if page.evaluate("!!document.querySelector('dialog[open]')"):
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
        # el final de la lección: «Siguiente lección» empieza otra (no lo pide)
        if not page.evaluate("vocabSync.tapDue()"):
            probs.append(f"al final de la lección no tocaría renovar: {page.evaluate('vocabSync.state')}")
        page.locator(".ls-end #ls-next").click()
        page.wait_for_function("() => !document.querySelector('.ls-end') && document.documentElement.dataset.focus === 'leccion'", timeout=8000)
        page.wait_for_timeout(600)
        if page.evaluate(_TAPS):
            probs.append(f"«Siguiente lección» pide el permiso: {page.evaluate('window.__gis')}")
        # fuera del modo foco, el primer toque en una pestaña sí
        C.goto(page, "#/mapa")
        page.wait_for_function("() => !document.documentElement.dataset.focus", timeout=5000)
        page.locator(".tabbar [data-nav=hoy]").click()
        try:
            page.wait_for_function("() => window.__gis.length > 0", timeout=3000)
            call = page.evaluate("window.__gis[0]")
            if not (call["tap"] and call["act"]) or page.evaluate("window.__gis.length") != 1:
                probs.append(f"tras la lección, el permiso no se pidió una vez dentro del toque: {page.evaluate('window.__gis')}")
            page.wait_for_function("() => vocabSync.state.phase === 'ok' && vocabSync.state.tokOk", timeout=6000)
        except Exception:  # noqa: BLE001
            probs.append(f"tras la lección, el toque en una pestaña no renueva el permiso: {page.evaluate('window.__gis')}, {page.evaluate('vocabSync.state')}")
        if not _uploaded(log):
            probs.append(f"tras la lección no se subió la partida: {log}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_no_renew_when_starting_or_mid_question():
    """Con el permiso caducado, cambios sin subir y el toque siguiente listo para renovarlo (vocabSync.tapDue()), no lo
    piden los toques que empiezan algo (la ventanita taparía su primer sonido): «Empezar» de Hoy, una lección del
    camino, una tarjeta de Juegos, «Empezar» de Palabras › Practicar. Tampoco los de mitad de una pregunta fuera del
    modo foco ni lo que suena o escucha: en la granja, «Dilo» y una respuesta de «¿Cómo me llamo?», un animal y una
    respuesta de «¿Dónde está…?»; el altavoz de la hoja de una puerta de la temporada antes de contestar; en el álbum,
    una pegatina conseguida (abre su ficha y dice la palabra) y las flechas ‹ › de la ficha (también la dicen); el micrófono
    de Palabras › Practicar › Hablar y «Seguir» entre preguntas de Palabras › Preguntas; en Palabras › Tarjetas, tocar
    la tarjeta (al girarla dice la palabra) y «Automático» (empieza a decirlas una tras otra). Luego, un toque en una
    pestaña sí lo pide (dentro del toque)."""
    probs = []

    def check(page, what, n0):
        page.wait_for_timeout(400)
        n = page.evaluate("window.__gis.length")
        if n != n0:
            probs.append(f"{what}: se pide el permiso ({page.evaluate('window.__gis')[n0:]})")

    def due(page, what):
        if not page.evaluate("vocabSync.tapDue()"):
            probs.append(f"{what}: no tocaría renovar (la prueba no vale): {page.evaluate('vocabSync.state')}")

    def control(page, what):
        n0 = page.evaluate("window.__gis.length")
        page.locator(".tabbar [data-nav=hoy]").click()
        try:
            page.wait_for_function("n => window.__gis.length > n", arg=n0, timeout=3000)
            c = page.evaluate("window.__gis")[-1]
            if not (c["tap"] and c["act"]):
                probs.append(f"{what}: el toque en la pestaña no lo pidió dentro del toque: {c}")
        except Exception:  # noqa: BLE001
            probs.append(f"{what}: luego, un toque en una pestaña no lo pide: {page.evaluate('vocabSync.state')}")

    # empezar: «Empezar» de Hoy, una lección del camino, una tarjeta de Juegos (el primer toque: tapAt = 0)
    page, log = _sync_page()
    try:
        page.evaluate(GJ._NO_HINT)
        page.wait_for_function("() => vocabSync.state.phase === 'reconnect'", timeout=5000)
        page.wait_for_timeout(400)
        due(page, "Hoy")
        page.locator("#hm-go").click()
        check(page, "«Empezar» de Hoy", 0)
        C.goto(page, "#/mapa")
        page.wait_for_function("() => !document.documentElement.dataset.focus", timeout=5000)
        page.wait_for_timeout(400)
        page.locator("#app .node[data-ls]:not(.lock)").last.click()
        page.wait_for_function("() => document.documentElement.dataset.focus === 'leccion'", timeout=5000)
        check(page, "una lección del camino", 0)
        C.goto(page, "#/juegos")
        page.wait_for_function("() => !document.documentElement.dataset.focus", timeout=5000)
        page.wait_for_timeout(400)
        page.locator('#app .gm-card[href^="#/juegos/"]').first.click()
        page.wait_for_function("() => document.documentElement.hasAttribute('data-gm-play')", timeout=8000)
        check(page, "una tarjeta de Juegos", 0)
        C.goto(page, "#/")
        page.wait_for_function("() => !document.documentElement.dataset.focus", timeout=5000)
        page.wait_for_timeout(400)
        control(page, "empezar")
        probs += C.errors(page)
    finally:
        page.context.close()

    def farm_page(sr):
        page = FG._page("phone", sr=sr, reduced_motion="reduce")
        log = []
        page.context.add_init_script(_GIS)
        _drive(page, log)
        FG._open(page, _armed_keys(FG._keys()))
        return page

    # la granja: «¿Cómo me llamo?» («Dilo» y una respuesta)
    page = farm_page(FG._FAKE_SR)
    try:
        FG._to_quiz(page)
        n0, ok = _arm(page)
        due(page, "granja, quiz")
        page.locator("#app .fm-pop [data-mic]").click()
        check(page, "granja: «Dilo»", n0)
        page.wait_for_timeout(300)
        page.locator('#app .fm-pop .fm-opt[data-fo="conejo"]').click()
        check(page, "granja: una respuesta de «¿Cómo me llamo?»", n0)
        control(page, "granja, quiz")
        probs += C.errors(page)
    finally:
        page.context.close()

    # la granja: un animal y una respuesta de «¿Dónde está…?»
    page = farm_page(FG._NO_SR)
    try:
        page.wait_for_timeout(600)
        n0, ok = _arm(page)
        due(page, "granja")
        FG._tap(page, FG._it("conejo"))
        check(page, "granja: tocar un animal", n0)
        page.keyboard.press("Escape")   # (su globo de comer, si sale)
        page.wait_for_function("() => !document.querySelector('#app .fm-pop:not([hidden])')", timeout=3000)
        page.wait_for_timeout(300)
        page.evaluate("document.querySelector('#app .fm-hero').dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))")
        page.wait_for_timeout(500)
        if page.locator("#app [data-play-find]").count():
            page.locator("#app [data-play-find]").first.click()
        page.wait_for_selector("#app .fm-stage.finding", timeout=5000)
        page.wait_for_timeout(800)
        due(page, "granja, «¿Dónde está…?»")
        tgt = page.evaluate("() => [...document.querySelectorAll('#app .fm-it')].map(e => e.dataset.fid)")
        FG._tap(page, FG._it(tgt[0]))
        check(page, "granja: una respuesta de «¿Dónde está…?»", n0)
        probs += C.errors(page)
    finally:
        page.context.close()

    # la temporada: el altavoz de la hoja de una puerta, antes de contestar
    now = TS.OCT
    now_ms = int(now.timestamp() * 1000)
    page = TS._page(now=now)
    log = []
    page.context.add_init_script(_GIS)
    _drive(page, log)
    try:
        C.seed(page, _armed_keys(TS._keys(now), now_ms=now_ms), now=now)
        page.evaluate(TS._SPY)
        C.goto(page, "#/temporada")
        page.click("#app .ss-door[data-i='0']")
        TS._sheet(page)
        n0, ok = _arm(page)
        due(page, "temporada")
        page.locator("dialog#ss-q #ss-q-spk").click()
        check(page, "temporada: el altavoz de la hoja", n0)
        probs += C.errors(page)
    finally:
        page.context.close()

    # el álbum: tocar una pegatina conseguida (abre su ficha y dice la palabra) y las flechas ‹ › de la ficha (pasan a
    # otra pegatina y la dicen)
    page = C.new_page("phone")
    log = []
    page.context.add_init_script(_GIS)
    _drive(page, log)
    try:
        k = _armed_keys(C.seed_keys())
        k["vocab:ui"] = json.dumps({"hints": {"al-swipe": 1000}})
        C.seed(page, k)
        C.goto(page, f"#/album/{R.ALBUM_DONE}")
        st = "#al-page .al-st.got:not(.new)"
        page.wait_for_selector(st, timeout=6000)
        page.wait_for_timeout(400)
        page.evaluate("""() => { window.__said = []; const o = window.say;
          window.say = function(...a) { window.__said.push(a[0]); return o.apply(this, a); }; }""")
        n0, ok = _arm(page)
        due(page, "álbum")
        page.locator(st).first.click()
        page.wait_for_selector("dialog.al-dlg[open]", timeout=3000)
        check(page, "álbum: tocar una pegatina", n0)
        page.wait_for_timeout(300)
        for k_, what in (("next", "la flecha › de la ficha"), ("prev", "la flecha ‹ de la ficha")):
            n_said = page.evaluate("window.__said.length")
            page.locator(f"dialog.al-dlg [data-al={k_}]").click()
            check(page, f"álbum: {what}", n0)
            if page.evaluate("window.__said.length") <= n_said:
                probs.append(f"álbum: {what} no dice la palabra (la prueba no vale)")
        if not page.evaluate("document.querySelector('dialog.al-dlg').hasAttribute('data-no-renew')"):
            probs.append("álbum: la ficha de la pegatina no lleva data-no-renew")
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.querySelector('dialog.al-dlg[open]')", timeout=3000)
        page.wait_for_timeout(300)
        control(page, "álbum")
        probs += C.errors(page)
    finally:
        page.context.close()

    # Palabras › Practicar › Hablar (el micrófono), Palabras › Preguntas («Seguir») y Palabras › Tarjetas (girar la
    # tarjeta, que dice la palabra, y «Automático»)
    for what in ("hablar", "preguntas", "tarjeta", "automatico"):
        page = C.new_page("phone")
        log = []
        page.context.add_init_script(_GIS)
        if what == "hablar":
            page.add_init_script(FG._FAKE_SR)
        _drive(page, log)
        try:
            k = _armed_keys(C.seed_keys())
            k["vocab:ui"] = json.dumps({"hints": {"map-peek": 1000, "doc-swipe": 1000}})
            if what == "hablar":
                k["prPrefs"] = json.dumps({"acts": ["hablar"], "reps": 7})
            C.seed(page, k)
            C.goto(page, f"#/doc/{R.TOPIC}")
            if what == "hablar":
                page.locator("#dv-tab-practica").click()
                page.wait_for_timeout(300)
                n0, ok = _arm(page)
                due(page, "Practicar")
                page.locator("#pr-go").click()
                check(page, "Palabras › Practicar: «Empezar»", n0)
                page.wait_for_selector("#view .pr-card.cur .mic:not([hidden])", timeout=5000)
                page.wait_for_timeout(600)
                due(page, "Practicar › Hablar")
                page.locator("#view .pr-card.cur .mic").click()
                check(page, "Palabras › Practicar › Hablar: el micrófono", n0)
            elif what == "preguntas":
                page.locator("#dv-tab-test").click()
                page.wait_for_timeout(300)
                n0, ok = _arm(page)
                due(page, "Preguntas")
                page.locator("#view .qz-opt").nth(0).click()
                page.wait_for_selector("#nextq:not([hidden])", timeout=3000)
                page.locator("#nextq").click()
                check(page, "Palabras › Preguntas: «Seguir»", n0)
            else:
                page.locator("#dv-tab-tarjetas").click()
                page.wait_for_selector("#view #card", timeout=4000)
                page.wait_for_timeout(300)
                page.evaluate("""() => { window.__said = []; for (const f of ['say', 'sayP']) { const o = window[f];
                  window[f] = function(...a) { window.__said.push(a[0]); return o.apply(this, a); }; } }""")
                n0, ok = _arm(page)
                due(page, "Tarjetas")
                if what == "tarjeta":
                    page.locator("#view #card").click(position={"x": 24, "y": 24})   # (una esquina: no el altavoz)
                    page.wait_for_selector("#view #card.is-back", timeout=3000)
                    check(page, "Palabras › Tarjetas: girar la tarjeta", n0)
                else:
                    page.locator("#view #auto").click()
                    page.wait_for_function("() => window.__said.length > 0", timeout=6000)
                    check(page, "Palabras › Tarjetas: «Automático»", n0)
                    page.locator("#view #auto").click()   # «Parar»
                    page.wait_for_timeout(300)
                if not page.evaluate("window.__said.length"):
                    probs.append(f"Palabras › Tarjetas ({what}): no ha dicho la palabra (la prueba no vale)")
            control(page, what)
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_failed_renew_retries_after_short_gap_and_adults_page_tells():
    """Si la ventanita de Google falla, el niño no ve nada (ni botón ni aviso) y Ajustes › Para mayores dice la verdad
    sin alarmas: la fila «Google: última copia hace 2 h» y, dentro, «Hay cambios sin subir a Google» con «Guardar ahora»
    (sin «Volver a conectar»: eso solo si «Guardar ahora» no pudo) y un pie sin promesas («mientras se juega»). Un toque
    enseguida no la vuelve a pedir, tampoco tras recargar (la racha de fallos se guarda); el primero pasados 3 min sí,
    sube la partida y Para mayores dice «Copia al día». Con la ventanita fallando siempre (Google pide entrar a mano),
    en una hora de toques (y recargas) se pide 3 veces (a los 0, 3 y ~53 min: tras dos fallos, ya no enseguida) y Para
    mayores dice que toque «Guardar ahora»."""
    probs = []
    page, log = _sync_page()
    try:
        page.evaluate("window.__gisFail = 1")
        page.wait_for_function("() => vocabSync.state.phase === 'reconnect'", timeout=5000)
        page.wait_for_timeout(600)
        page.locator(".tabbar [data-nav=aprender]").click()
        try:
            page.wait_for_function("() => window.__gis.length > 0", timeout=3000)
        except Exception:  # noqa: BLE001
            probs.append(f"el primer toque no pide el permiso: {page.evaluate('vocabSync.state')}")
        page.wait_for_timeout(500)
        if page.evaluate("window.__gis.length") != 1 or not page.evaluate("window.__gis[0].fail"):
            probs.append(f"el primer intento: {page.evaluate('window.__gis')}")
        st = page.evaluate("vocabSync.state")
        if st["phase"] != "reconnect" or st["tokOk"] or _uploaded(log):
            probs.append(f"tras fallar la ventanita: estado {st['phase']}, permiso {st['tokOk']}, subidas {log}")
        seen = page.evaluate(_NO_SAVE)
        if seen != _NO_SAVE_OK:
            probs.append(f"tras fallar, el niño ve algo de guardar: {seen}")
        cfg, box = _adults(page)
        if cfg != "Google: última copia hace 2 h":
            probs.append(f"la fila Para mayores dice {cfg!r} tras fallar")
        if ("Hay cambios sin subir a Google" not in box["t"] or not box["now"] or box["re"] or "mientras se juega" not in box["foot"]
                or "próximo toque" in box["foot"]):
            probs.append(f"Para mayores tras fallar: {box}")
        # enseguida, otro toque: no se pide (el hueco corto aún no ha pasado)
        page.locator(".tabbar [data-nav=jugar]").click()
        page.wait_for_timeout(500)
        if page.evaluate("window.__gis.length") != 1:
            probs.append(f"un toque justo después de fallar la vuelve a pedir: {page.evaluate('window.__gis')}")
        # tras recargar (el primer toque de la visita), tampoco: la racha sigue
        C.reload(page)
        page.wait_for_function("() => vocabSync.state.phase === 'reconnect'", timeout=5000)
        page.evaluate("vocabSync._delays({debounce: 300, poll: 500, retry: 60e3})")
        page.locator(".tabbar [data-nav=aprender]").click()
        page.wait_for_timeout(500)
        if page.evaluate("window.__gis.length"):
            probs.append(f"tras recargar, el primer toque la vuelve a pedir enseguida: {page.evaluate('window.__gis')}")
        # pasados 3 min, el siguiente toque sí
        page.clock.fast_forward(3 * MIN + 5000)
        page.wait_for_timeout(300)
        if page.evaluate("window.__gis.length"):
            probs.append(f"sin un toque se pidió el permiso: {page.evaluate('window.__gis')}")
        page.locator(".tabbar [data-nav=hoy]").click()
        try:
            page.wait_for_function("() => window.__gis.length === 1", timeout=3000)
            call = page.evaluate("window.__gis[0]")
            if not (call["tap"] and call["act"]) or call["fail"]:
                probs.append(f"el segundo intento no fue dentro del toque: {call}")
            page.wait_for_function("() => vocabSync.state.phase === 'ok' && vocabSync.state.tokOk", timeout=6000)
        except Exception:  # noqa: BLE001
            probs.append(f"pasados 3 min, el toque no reintenta: {page.evaluate('window.__gis')}, {page.evaluate('vocabSync.state')}")
        if not _uploaded(log):
            probs.append(f"tras el reintento no se subió la partida: {log}")
        cfg, box = _adults(page)
        if not cfg.startswith("Google: guardado hace"):
            probs.append(f"la fila Para mayores dice {cfg!r} tras subir")
        if "Copia al día" not in box["t"] or "sin subir" in box["t"] or not box["now"] or box["re"]:
            probs.append(f"Para mayores tras subir: {box}")
        probs += C.errors(page)
    finally:
        page.context.close()
    # la ventanita falla siempre (Google pide entrar a mano): un toque por minuto durante una hora, sin y con recargas
    for every in (0, 10):
        page, log = _sync_page()
        try:
            page.wait_for_function("() => vocabSync.state.phase === 'reconnect'", timeout=5000)
            page.evaluate("window.__gisFail = 999")
            at, n = [], 0
            for m in range(60):
                if every and m and m % every == 0:
                    n += page.evaluate("window.__gis.length")
                    C.reload(page, settle_ms=100)
                    page.evaluate("window.__gisFail = 999")
                before = n + page.evaluate("window.__gis.length")
                page.locator(f".tabbar [data-nav={('aprender', 'jugar', 'hoy')[m % 3]}]").click()
                page.wait_for_timeout(120)
                if n + page.evaluate("window.__gis.length") > before:
                    at.append(m)
                page.clock.fast_forward(MIN)
            if len(at) != 3 or at[:2] != [0, 3] or not 52 <= at[2] <= 54:   # 0, 3 y 3 + 50; el siguiente, a los ~159
                probs.append(f"con la ventanita fallando siempre (recarga cada {every or 'nunca'} min), se pide en los minutos {at}")
            if not every:
                cfg, box = _adults(page)
                if "toca «Guardar ahora» para seguir guardando" not in box["foot"] or "mientras se juega" in box["foot"]:
                    probs.append(f"tras varios fallos, Para mayores no dice que toque «Guardar ahora»: {box}")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def _clean(page):
    """Lo de este aparato ya está en Google (baseHash = la huella de ahora); recarga."""
    h = page.evaluate("vocabSync.hash()")
    page.evaluate("""h => { const m = JSON.parse(localStorage.getItem('save:sync')); m.baseHash = h; m.lastPushedHash = h; m.localDirty = false;
      localStorage.setItem('save:sync', JSON.stringify(m)); }""", h)
    C.reload(page)
    page.wait_for_function("() => vocabSync.state.phase === 'reconnect'", timeout=5000)
    page.wait_for_timeout(400)


def _open_adults(page):
    page.evaluate("openSettings()")
    page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
    page.evaluate(_PASS)
    page.evaluate("openSettings('google')")
    _wait_page(page, "mayores")


_BOX = """() => { const d = document.getElementById('sv-dyn'), f = document.querySelector('#sv-box .st-foot');
  return {t: d.textContent.replace(/\\s+/g, ' ').trim(), now: !!d.querySelector('#sv-now'), re: !!d.querySelector('#sv-re'),
    foot: f ? f.textContent : '', msg: document.getElementById('sv-msg').textContent, safe: document.getElementById('sv-safe').textContent}; }"""


def test_adults_page_says_at_a_glance_and_save_now():
    """Para mayores con el permiso caducado. Sin nada que subir: «Copia al día · hace 2 h», solo «Guardar ahora» (sin
    «Volver a conectar»), «El permiso de Google se renueva solo mientras se juega» y la fila «Google: guardado hace 2 h».
    Con cambios sin subir: «Hay cambios sin subir a Google», la fila «Google: última copia hace 2 h» (sin alarmas: la ve
    también el niño) y, abajo, que lo que no se ha subido se perdería si el navegador borrara los datos. Si «Guardar
    ahora» no puede (la ventanita se cerró), lo dice y sale «Volver a conectar»; otra vez «Guardar ahora» sí: sube y
    «Copia al día». «Guardar ahora» espera a Google lo que haga falta (un mayor que escribe su contraseña): a los 20 s
    no dice que el navegador bloqueó la ventana y el permiso vale."""
    probs = []
    page, log = _sync_page()
    try:
        page.wait_for_function("() => vocabSync.state.phase === 'reconnect'", timeout=5000)
        _clean(page)
        cfg, box = _adults(page)
        if cfg != "Google: guardado hace 2 h":
            probs.append(f"sin nada que subir, la fila dice {cfg!r}")
        if ("Copia al día · hace 2 h" not in box["t"] or "caducó" in box["t"] or "sin subir" in box["t"] or not box["now"] or box["re"]
                or "se renueva solo mientras se juega" not in box["foot"]):
            probs.append(f"Para mayores sin nada que subir: {box}")
        # con cambios sin subir
        page.evaluate("() => { const m = JSON.parse(localStorage.getItem('save:sync')); m.baseHash = 'x'; m.localDirty = true; localStorage.setItem('save:sync', JSON.stringify(m)); }")
        C.reload(page)
        page.wait_for_function("() => vocabSync.state.phase === 'reconnect'", timeout=5000)
        page.wait_for_timeout(400)
        cfg, box = _adults(page)
        if cfg != "Google: última copia hace 2 h":
            probs.append(f"con cambios sin subir, la fila dice {cfg!r}")
        if "Hay cambios sin subir a Google" not in box["t"] or not box["now"] or box["re"] or "mientras se juega" not in box["foot"]:
            probs.append(f"Para mayores con cambios sin subir: {box}")
        # «Guardar ahora» que no puede, y luego sí
        _open_adults(page)
        page.evaluate("window.__gisFail = 1")
        page.locator("#sv-now").click()
        try:
            page.wait_for_selector("#sv-dyn #sv-re", timeout=3000)
        except Exception:  # noqa: BLE001
            probs.append(f"«Guardar ahora» falla y no sale «Volver a conectar»: {page.evaluate(_BOX)}")
        b = page.evaluate(_BOX)
        if "No se ha terminado de entrar en Google" not in b["msg"] or not ("se perdería lo que aún no se ha subido" in b["safe"] or b["safe"].startswith("Datos protegidos")):
            probs.append(f"«Guardar ahora» falla: {b}")
        page.locator("#sv-now").click()
        try:
            page.wait_for_function("() => vocabSync.state.phase === 'ok' && vocabSync.state.tokOk", timeout=6000)
            page.wait_for_timeout(300)
        except Exception:  # noqa: BLE001
            probs.append(f"«Guardar ahora» no renueva: {page.evaluate('vocabSync.state')}")
        b = page.evaluate(_BOX)
        if not _uploaded(log) or "Copia al día" not in b["t"] or b["re"] or b["msg"] or not ("la partida está en Google" in b["safe"] or b["safe"].startswith("Datos protegidos")):
            probs.append(f"tras «Guardar ahora»: {b}, subidas {log}")
        calls = page.evaluate("window.__gis")
        if len(calls) != 2 or not all(c["tap"] and c["act"] and c["prompt"] == "" for c in calls):
            probs.append(f"«Guardar ahora» no pidió el permiso dentro de su toque: {calls}")
        probs += C.errors(page)
    finally:
        page.context.close()
    # «Guardar ahora» con Google que tarda 20 s
    page, log = _sync_page()
    try:
        page.wait_for_function("() => vocabSync.state.phase === 'reconnect'", timeout=5000)
        _open_adults(page)
        page.evaluate("window.__gisDelay = 20000")
        page.locator("#sv-now").click()
        page.wait_for_timeout(200)
        page.clock.fast_forward(16_000)
        page.wait_for_timeout(300)
        b = page.evaluate(_BOX)
        if "navegador" in b["msg"] or "tardando" in b["msg"]:
            probs.append(f"a los 16 s, «Guardar ahora» ya dice que falló: {b['msg']!r}")
        page.clock.fast_forward(5_000)
        try:
            page.wait_for_function("() => vocabSync.state.phase === 'ok' && vocabSync.state.tokOk", timeout=6000)
        except Exception:  # noqa: BLE001
            probs.append(f"«Guardar ahora» con Google lento: {page.evaluate('vocabSync.state')}, {page.evaluate(_BOX)}")
        if not _uploaded(log):
            probs.append(f"«Guardar ahora» con Google lento no sube: {log}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_late_google_answer_counts_and_two_tabs_share_it():
    """Si en un toque del niño Google contesta pasados los 15 s de espera (red lenta), el permiso vale igual: se guarda,
    se sube la partida y no se abre otra ventana a los 3 min. Con dos pestañas abiertas, si una renueva el permiso, la
    otra lo usa (habla con Google con él) en vez de borrarlo y marcar que caducó."""
    probs = []
    page, log = _sync_page()
    try:
        page.wait_for_function("() => vocabSync.state.phase === 'reconnect'", timeout=5000)
        page.evaluate("window.__gisDelay = 16000")
        page.locator(".tabbar [data-nav=aprender]").click()
        page.wait_for_timeout(200)
        page.clock.fast_forward(17_000)
        try:
            page.wait_for_function("() => vocabSync.state.phase === 'ok' && vocabSync.state.tokOk", timeout=6000)
        except Exception:  # noqa: BLE001
            probs.append(f"el permiso que llega tarde se tira: {page.evaluate('vocabSync.state')}")
        st = page.evaluate("vocabSync.state")
        if st["meta"]["reconnect"] or not page.evaluate("localStorage.getItem('save:tok')") or not _uploaded(log):
            probs.append(f"tras el permiso tardío: {st['meta']}, subidas {log}")
        page.clock.fast_forward(3 * MIN + 5000)
        page.locator(".tabbar [data-nav=jugar]").click()
        page.wait_for_timeout(500)
        if page.evaluate("window.__gis.length") != 1:
            probs.append(f"tras el permiso tardío se vuelve a pedir: {page.evaluate('window.__gis')}")
        probs += C.errors(page)
    finally:
        page.context.close()
    # dos pestañas
    a, log = _sync_page()
    try:
        b = a.context.new_page()
        _drive(b, log)
        b.goto(C.base_url(a) + "#/")
        b.wait_for_function("() => window.vocabSync && vocabSync.state.phase === 'reconnect'", timeout=8000)
        a.wait_for_function("() => vocabSync.state.phase === 'reconnect'", timeout=5000)
        a.bring_to_front()
        a.locator(".tabbar [data-nav=aprender]").click()
        a.wait_for_function("() => vocabSync.state.phase === 'ok' && vocabSync.state.tokOk", timeout=6000)
        new = a.evaluate("JSON.parse(localStorage.getItem('save:tok')).t")
        b.bring_to_front()
        n = len(log)
        b.evaluate("vocabSync.sync('change')")
        b.wait_for_function("() => vocabSync.state.phase === 'ok'", timeout=6000)
        st = b.evaluate("vocabSync.state")
        tok = b.evaluate("localStorage.getItem('save:tok')")
        if not st["tokOk"] or st["meta"]["reconnect"] or not tok or json.loads(tok)["t"] != new:
            probs.append(f"la otra pestaña no usa el permiso nuevo: {st}, save:tok {tok}")
        if not log[n:]:
            probs.append(f"la otra pestaña no habla con Google con el permiso nuevo: {log}")
        if b.evaluate("window.__gis.length"):
            probs.append(f"la otra pestaña pide otra ventana: {b.evaluate('window.__gis')}")
        probs += C.errors(a) + C.errors(b)
    finally:
        a.context.close()
    assert not probs, "\n".join(probs)


def test_captures_topbar_and_adults_status():
    """Capturas (móvil 390×844, claro y oscuro) en capturas/guardado-puerta: la barra de arriba sin pastilla con Google
    conectado y el permiso caducado, y Ajustes › Para mayores con el estado de la copia: con cambios sin subir
    (guardado-mayores-estado) y con la copia al día (guardado-mayores-aldia)."""
    probs = []
    out = C.CAPTURAS / "guardado-puerta"
    for scheme in ("light", "dark"):
        page, log = _sync_page(scheme=scheme)
        try:
            page.wait_for_function("() => vocabSync.state.phase === 'reconnect'", timeout=5000)
            C.settle(page, 400)
            seen = page.evaluate(_NO_SAVE)
            if seen != _NO_SAVE_OK:
                probs.append(f"{scheme}: el niño ve algo de guardar: {seen}")
            C.shot(page, f"guardado-barra-sin-pastilla-phone-{scheme}", out, full_page=False)
            page.evaluate("openSettings()")
            page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
            page.evaluate(_PASS)
            page.evaluate("openSettings('google')")
            _wait_page(page, "mayores")
            page.evaluate("document.getElementById('sv-box').scrollIntoView({block: 'start'})")
            C.settle(page, 400)
            page.evaluate("document.activeElement && document.activeElement.blur()")   # sin el anillo del foco en la captura
            C.shot(page, f"guardado-mayores-estado-phone-{scheme}", out, full_page=False)
            if page.evaluate("window.__gis.length"):
                probs.append(f"{scheme}: se pidió el permiso sin un toque: {page.evaluate('window.__gis')}")
            # la copia al día (el permiso sigue caducado)
            _clean(page)
            _open_adults(page)
            page.evaluate("document.getElementById('sv-box').scrollIntoView({block: 'start'})")
            C.settle(page, 400)
            page.evaluate("document.activeElement && document.activeElement.blur()")
            if "Copia al día" not in page.evaluate("document.getElementById('sv-dyn').textContent"):
                probs.append(f"{scheme}: la copia al día no lo dice")
            C.shot(page, f"guardado-mayores-aldia-phone-{scheme}", out, full_page=False)
            if page.evaluate("window.__gis.length"):
                probs.append(f"{scheme}: se pidió el permiso sin un toque: {page.evaluate('window.__gis')}")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)
