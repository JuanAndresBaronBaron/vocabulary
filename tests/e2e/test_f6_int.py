"""F6 (integración): lo de las seis piezas de F6 junto, con la partida sembrada.

- Versión 23 (o más, las fases de después) en sw.js, OFF_SHELL y el ?v= de todos los <script>; los ficheros nuevos en SHELL (y en OFF_APP) o en
  «Descargar todo»; el orden de carga de los módulos (window.vocabMedia de js/mailbox.js antes que el loro y el
  cazador, js/navmotion.js el último, js/hunter.js solo al entrar y con el mismo ?v=) y el inventario de js/save.js
  (cuentos y calls en la partida; parrot:st y hunt:st solo del aparato; IndexedDB fuera).
- Enlace directo y recarga de #/loro, #/loro/capsula, #/cuentos, #/cuento/<id>, #/cazador y #/album/casa en los tres
  idiomas: la pantalla, la pestaña marcada, la cápsula de volver o el modo foco.
- Hoy con todo a la vez (llamada perdida, carta del Buzón, hambre y refugio, ?season=halloween, la frase de la cena y
  los atajos) en 390×844 claro y oscuro y en tableta: el orden de HOME_SLOTS y sin scroll. La llamada entrante no sale
  encima de la Puerta de mayores, de Ajustes ni de un menú de mantener pulsado, y suena al cerrarlos.
- Toques seguros de Google: nada a mitad de un cuento, de una llamada, del loro grabando ni del cazador con la cámara
  pide el permiso; luego, un toque en una pestaña sí.
- El recorrido en inglés, francés y danés: Hoy, una transición dentro de una pestaña, el título que se pliega, el menú
  de mantener pulsado, el loro, un cuento entero, una llamada contestada y otra perdida y el cazador con la cámara de
  mentira; con la IPA a la vista, sin errores en la consola y con la partida exportada como la base (más lo nuevo)."""
from __future__ import annotations

import datetime as dt
import json
import re

import common as C
import routes as R
import test_f2_ajustes as A
import test_f5_int as I5
import test_f6_accesibilidad as AX
import test_f6_cazador as HN
import test_f6_cuentos as CU
import test_f6_llamada as CL
import test_f6_loro as LO

AB = {"english": "en", "français": "fr", "dansk": "da"}
CHOSEN = {"english": "Daniel", "français": "Thomas", "dansk": "Sara"}
_ROUTE_N = "window.__vocabRouteN || 0"
_TAB = """() => { const t = document.querySelector('.tabbar [role=tab][aria-selected=true]'); return t ? t.dataset.nav : null; }"""
_VIEW = """() => { const r = document.documentElement, b = document.getElementById('dv-back');
  return {focus: r.dataset.focus || '', back: r.hasAttribute('data-back') && b ? b.getAttribute('href') : null,
    dialogs: [...document.querySelectorAll('dialog[open]')].map(d => d.id || d.className), title: document.title}; }"""
_IPA = """sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent && getComputedStyle(e).visibility !== 'hidden')
  .map(e => e.textContent.replace('IPA: ', '').replace(/\\u2060/g, '').trim()).filter(Boolean)"""

# --------------------------------------------------------------- dobles de prueba juntos (voz, micrófono, cámara)
# La voz de los cuentos (CU._TTS: dura según las letras y llama a onend), el micrófono y el MediaRecorder del loro
# (LO._MOCK) y la cámara de lienzo del cazador (HN._CAM). Juntos: getUserMedia con vídeo es la cámara y sin vídeo el
# micrófono; el <video> de la cámara reproduce de verdad y el audio grabado (los mp3) se apunta en __played.
_REAL = "window.__play0 = HTMLMediaElement.prototype.play; window.__pause0 = HTMLMediaElement.prototype.pause;"
_KEEP_TTS = "window.__tts = window.speechSynthesis ? {speak: speechSynthesis.speak, cancel: speechSynthesis.cancel} : null;"
_KEEP_MIC = "window.__micGum = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;"
_MIX = r"""
(() => {
  const md = navigator.mediaDevices, cam = md.getUserMedia, mic = window.__micGum;
  md.getUserMedia = c => (c && c.video) ? cam(c) : mic(c);
  if (window.__tts) for (const k of ['speak', 'cancel'])
    Object.defineProperty(speechSynthesis, k, {configurable: true, writable: true, value: window.__tts[k]});
  HTMLMediaElement.prototype.play = function () {
    if (this instanceof HTMLVideoElement) return window.__play0.call(this);
    window.__played.push({rec: (this.dataset && this.dataset.rec) || '', src: this.src, rate: this.playbackRate, t: Date.now()});
    setTimeout(() => this.dispatchEvent(new Event('ended')), window.__playMs || 60);   /* __playMs: lo que «dura» (capturas) */
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function () { if (this instanceof HTMLVideoElement) return window.__pause0.call(this); };
  window.__coins = [];
  document.addEventListener('DOMContentLoaded', () => { try { bus.on('coins', e => window.__coins.push(e)); } catch (e) {} });
})();
"""


def _page(kind="phone", gis=False, **kw):
    page = C.new_page(kind, **kw)
    ctx = page.context
    if gis:
        ctx.add_init_script(A._GIS)
    ctx.add_init_script(_REAL)
    ctx.add_init_script(f"{CU._TTS}({json.dumps({'voices': CU.VOICES, 'boundary': False, 'ms': 30}, ensure_ascii=False)})")
    ctx.add_init_script(_KEEP_TTS)
    ctx.add_init_script(LO._MOCK)
    ctx.add_init_script(_KEEP_MIC)
    ctx.add_init_script(f"{HN._CAM}({json.dumps('canvas')})")
    ctx.add_init_script(_MIX)
    ctx.add_init_script(CL._WD)
    return page


def _keys(lang="english", now=C.FIXED_NOW, parrot=True, **top):
    """La partida sembrada en ese idioma, con la voz elegida de cada idioma y, con parrot, la cápsula de este mes ya
    propuesta (así no sale su hoja al entrar en el loro)."""
    k = dict(C.seed_keys(now))
    k["lang"] = json.dumps(lang, ensure_ascii=False)
    k["vocab:voice"] = json.dumps(CHOSEN, ensure_ascii=False)
    if parrot:
        m = now.strftime("%Y-%m")
        k["parrot:st"] = json.dumps({"v": 1, "cap": {"en": m, "fr": m, "da": m}})
    for n, v in top.items():
        k[n.replace("__", ":")] = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    return k


def _first_story(lang):
    return next(x for x in CU.IDX[lang] if x["n"] == 1)["id"]


def _wait_route(page, n0, timeout=8000):
    page.wait_for_function(f"n => ({_ROUTE_N}) > n", arg=n0, timeout=timeout)
    C.settle(page, 200)


# =============================================================== 1. versión, SHELL, orden de carga y save.js
def test_version_shell_load_order_and_inventory():
    """sw.js VERSION 23 o más = OFF_SHELL = el ?v= de cada <script> de index.html y privacy.html. Cada js/*.js, cada guion de
    llamada y cada cuento está en SHELL y en OFF_APP (las mismas listas). En el navegador: los módulos de F6 existen
    (vocabMenu, vocabNavMotion, vocabParrot, vocabCalls, vocabStories, vocabHunter) y window.vocabMedia (de
    js/mailbox.js) está antes que js/parrot.js y js/hunter-boot.js; js/navmotion.js es el último; js/hunter.js no se pide
    hasta entrar en el cazador y entonces llega con ?v=<VERSION>. Los dibujos de los cuentos, las llamadas y el cazador van en
    «Descargar todo» y existen. vocabSave.inventory: cuentos y calls en la partida, parrot:st y hunt:st solo del
    aparato."""
    probs = []
    sw = (C.ROOT / "sw.js").read_text(encoding="utf-8")
    html = (C.ROOT / "index.html").read_text(encoding="utf-8")
    priv = (C.ROOT / "privacy.html").read_text(encoding="utf-8")
    v = int(re.search(r"const VERSION = (\d+);", sw).group(1))
    if v < 23:   # F6 subió a 23; las fases de después (Tech Prep S1: 24) siguen subiendo
        probs.append(f"sw.js VERSION = {v} (se esperaba 23 o más)")
    if f'const OFF_SHELL = "vocab-shell-v{v}"' not in html:
        probs.append("OFF_SHELL de index.html no es vocab-shell-v%d" % v)
    for name, txt in (("index.html", html), ("privacy.html", priv)):
        for src in re.findall(r'<script[^>]*\ssrc="([^"]+)"', txt):
            if not src.endswith(f"?v={v}"):
                probs.append(f"{name}: <script src={src}> sin ?v={v}")
    shell = set(re.findall(r'"([^"]+)"', sw[sw.index("const SHELL"):sw.index("];", sw.index("const SHELL"))]))
    off = set(re.findall(r'"([^"]+)"', html[html.index("const OFF_APP"):html.index("];", html.index("const OFF_APP"))]))
    for f in sorted({str(p.relative_to(C.ROOT)) for p in (C.ROOT / "js").glob("*.js")}
                    | {str(p.relative_to(C.ROOT)) for d in ("data/stories", "data/calls") for p in (C.ROOT / d).rglob("*.json")}
                    | {"img/games/cuentos.png", "img/games/cazador.png"}):
        if f not in shell:
            probs.append(f"{f} no está en SHELL")
        if f not in off:
            probs.append(f"{f} no está en OFF_APP")
    for f in sorted(shell - off - {"vocab-media", "vocab-shell-v"}):
        probs.append(f"{f} está en SHELL y no en OFF_APP")
    order = re.findall(r'<script src="js/([\w-]+)\.js', html)
    for a, b in (("mailbox", "parrot"), ("mailbox", "hunter-boot"), ("motion", "ctxmenu"), ("gestures", "ctxmenu"),
                 ("save", "calls"), ("settings", "stories")):
        if a in order and b in order and order.index(a) > order.index(b):
            probs.append(f"js/{a}.js se carga después de js/{b}.js")
    if order and order[-1] != "navmotion":
        probs.append(f"el último <script> es js/{order[-1]}.js (se esperaba js/navmotion.js)")

    page = _page()
    reqs = []
    page.on("request", lambda r: reqs.append(r.url))
    try:
        C.seed(page, keys=_keys())
        mods = page.evaluate("""() => ({menu: !!window.vocabMenu, nav: !!window.vocabNavMotion, parrot: !!window.vocabParrot,
          calls: !!window.vocabCalls, stories: !!window.vocabStories, hunter: !!window.vocabHunter, media: !!window.vocabMedia,
          hunterLoaded: !!(window.vocabHunter && vocabHunter.loaded)})""")
        for k in ("menu", "nav", "parrot", "calls", "stories", "hunter", "media"):
            if not mods[k]:
                probs.append(f"falta el módulo {k}")
        if mods["hunterLoaded"] or any("/js/hunter.js" in n for n in reqs):
            probs.append("js/hunter.js se pidió antes de entrar en el cazador")
        C.goto(page, "#/cazador")
        page.wait_for_selector("#hn", timeout=10000)
        hj = [u for u in reqs if "/js/hunter.js" in u]
        if not hj or not all(n.endswith(f"?v={v}") for n in hj):
            probs.append(f"js/hunter.js llega como {hj} (se esperaba ?v={v})")
        imgs = page.evaluate("""async () => { const out = new Set();
          for (const f of [() => vocabCalls.images(), () => vocabStories.images(), () => vocabHunter.images()]) (await f()).forEach(u => out.add(u));
          return [...out]; }""")
        if len(imgs) < 30:
            probs.append(f"«Descargar todo» solo trae {len(imgs)} dibujos de las llamadas, los cuentos y el cazador")
        for u in imgs:
            if not (C.ROOT / u.split("?")[0]).is_file():
                probs.append(f"«Descargar todo» pide {u}, que no existe")
        inv = page.evaluate("() => vocabSave.inventory")
        for k in ("cuentos", "calls"):
            if k not in inv["exact"]:
                probs.append(f"save.js: «{k}» no va en la partida")
        for k in ("parrot:st", "hunt:st"):
            if k not in inv["deviceOnly"]:
                probs.append(f"save.js: «{k}» no es solo de este aparato")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# =============================================================== 2. enlace directo y recarga
_DIRECT = [
    ("#/loro", "#lr-rb, #lr-info", {"tab": "granja", "back": "#/granja", "focus": ""}),
    ("#/loro/capsula", "#lr-rb, #lr-info", {"tab": "granja", "back": "#/granja", "focus": "", "cap": True}),
    ("#/cuentos", "#st-grid .st-cv", {"tab": "jugar", "back": "#/juegos", "focus": ""}),
    ("#/cuento/{story}", "#st-stage .st-page", {"focus": "cuento"}),
    ("#/cazador", "#hn", {"focus": "cazador"}),
    ("#/album/casa", "#hn-casa", {"tab": "jugar", "back": "#/album", "focus": ""}),
]


def test_direct_links_and_reload_in_three_languages():
    """Abrir cada ruta nueva de F6 por enlace directo (la app sin abrir antes) y recargarla: sale su pantalla, con la
    pestaña marcada y la cápsula de volver (‹ Granja, ‹ Juegos, ‹ Álbum) o en modo foco (cuento y cazador), sin hojas
    abiertas (con la cápsula de este mes ya propuesta) y sin errores, en inglés, francés y danés."""
    probs = []
    for lang, ab in AB.items():
        page = _page()
        try:
            for hsh, sel, want in _DIRECT:
                h = hsh.format(story=_first_story(lang))
                C.seed(page, keys=_keys(lang), hash=h)
                for when in ("enlace", "recarga"):
                    if when == "recarga":
                        C.reload(page)
                    tag = f"{ab} {h} ({when})"
                    try:
                        page.wait_for_selector(sel, timeout=10000)
                    except Exception:  # noqa: BLE001
                        probs.append(f"{tag}: no se pinta {sel}")
                        continue
                    page.wait_for_timeout(250)
                    v = page.evaluate(_VIEW)
                    if C.current_hash(page) != h.lstrip("#/"):
                        probs.append(f"{tag}: acaba en {C.current_hash(page)}")
                    if v["focus"] != want["focus"]:
                        probs.append(f"{tag}: modo foco {v['focus']!r} (se esperaba {want['focus']!r})")
                    if "tab" in want and page.evaluate(_TAB) != want["tab"]:
                        probs.append(f"{tag}: pestaña marcada {page.evaluate(_TAB)} (se esperaba {want['tab']})")
                    if "back" in want and v["back"] != want["back"]:
                        probs.append(f"{tag}: la cápsula de volver lleva a {v['back']} (se esperaba {want['back']})")
                    if want.get("cap") and page.evaluate("() => vocabParrot.state.mode") != "cap":
                        probs.append(f"{tag}: no abre la cápsula ({page.evaluate('() => vocabParrot.state')})")
                    if v["dialogs"]:
                        probs.append(f"{tag}: hay hojas abiertas {v['dialogs']}")
                    sw = page.evaluate("() => document.documentElement.scrollWidth - innerWidth")
                    if sw > 0:
                        probs.append(f"{tag}: se sale {sw} px por el lado")
            probs += [f"{ab}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# =============================================================== 3. Hoy con todo a la vez
def _hoy_all(page, now=C.FIXED_NOW, lang=None):
    t = C.day_key(now)
    k = I5._keys(now, shelter=True, lang=lang)
    k["calls"] = json.dumps({"v": 1, "d": t, "miss": {"id": "en-zoo", "d": t}})
    CL._seed(page, k, armed=False, now=now)
    page.evaluate("o => vocabMailbox.receive(o)", I5.LET)
    C.goto(page, "#/juegos")
    C.goto(page, "#/?season=halloween")
    page.wait_for_timeout(500)
    page.evaluate(CL._FINISH)


def test_hoy_everything_at_once_with_season_url():
    """En marzo con ?season=halloween, atajos, una carta sin abrir, un animal con hambre y la gallina en el refugio, la
    frase de la cena y una llamada perdida a la vez: en 390×844 (claro y oscuro) cabe sin scroll con la fila de atajos y
    un HOME_SLOT, la carta; en tableta (820×1180), carta y refugio. Al irse cada uno sale el siguiente por PRI (carta >
    refugio > llamada perdida > temporada > frase de la cena): con ?season=off queda la frase. La pestaña Granja lleva su
    punto azul por el hambre. Sin scroll en ningún paso."""
    probs = []
    for tag, kw, want in (("390 claro", {}, ["mail"]), ("390 oscuro", {"color_scheme": "dark"}, ["mail"]),
                          ("tableta", {"viewport": {"width": 820, "height": 1180}}, ["mail", "granja"])):
        page = CL._page("phone", **kw)
        try:
            _hoy_all(page)
            got = page.evaluate(I5._SLOTS)
            if got != want:
                probs.append(f"{tag}: HOME_SLOTS {got} (se esperaba {want})")
            if not page.evaluate("() => !!document.querySelector('#hm-sc .sc-p')"):
                probs.append(f"{tag}: no se ve la fila de atajos")
            if not page.evaluate("() => { const b = document.querySelector('#tab-granja .tb-badge'); return !!b && !b.hidden; }"):
                probs.append(f"{tag}: la pestaña Granja no avisa del hambre")
            I5._fits(page, tag, probs)
            if tag == "390 claro":
                C.shot(page, "F6-hoy-todo-a-la-vez", C.CAPTURAS / "F6", full_page=False)
            if tag == "390 oscuro":
                C.shot(page, "F6-hoy-todo-a-la-vez-oscuro", C.CAPTURAS / "F6", full_page=False)
            seq = []
            C.goto(page, "#/carta/" + I5.LET["id"])
            page.locator("#mb-open").click()
            page.wait_for_selector("#mb-gift:not([hidden])", timeout=9000)
            CL._hoy(page)
            seq.append(page.evaluate(I5._SLOTS))
            I5._fits(page, f"{tag} sin la carta", probs)
            page.evaluate("() => { const s = store.get('farm:state', {}); s.shelter.gallina.seen = true; store.set('farm:state', s); }")
            CL._hoy(page)
            seq.append(page.evaluate(I5._SLOTS))
            I5._fits(page, f"{tag} sin el refugio", probs)
            page.evaluate("() => { const s = store.get('calls', {}); delete s.miss; store.set('calls', s); }")
            CL._hoy(page)
            seq.append(page.evaluate(I5._SLOTS))
            I5._fits(page, f"{tag} sin la llamada", probs)
            C.goto(page, "#/?season=off")
            page.wait_for_timeout(400)
            page.evaluate(CL._FINISH)
            seq.append(page.evaluate(I5._SLOTS))
            I5._fits(page, f"{tag} sin la temporada", probs)
            steps = ([["granja"], ["call"], ["season"], ["phrase"]] if len(want) == 1
                     else [["granja", "call"], ["call", "season"], ["season", "phrase"], ["phrase"]])
            if seq != steps:
                probs.append(f"{tag}: al irse uno tras otro salen {seq} (se esperaba {steps})")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_call_never_over_gate_settings_or_menu():
    """Con una sesión «con llamada» en Hoy: mientras está abierta la Puerta de mayores, Ajustes o un menú de mantener
    pulsado, la llamada no suena (calm() es false) aunque pase su rato; al cerrarlos, suena, y entonces es el único
    diálogo abierto. Si ya iba a sonar (a mitad de RING_DELAY) y se abre la Puerta, espera a que se cierre."""
    probs = []
    opens = (
        ("la Puerta", "() => { window.__gp = adultGate({reason: 'Prueba de la llamada.'}); }", "dialog#gate[open]"),
        ("Ajustes", "() => openSettings()", "dialog#ajustes[open]"),
        ("un menú de mantener pulsado", """() => { vocabMenu.open(document.querySelector('#hm-go') || document.querySelector('#app a, #app button'),
            {title: 'Prueba', items: [{id: 'a', t: 'Una', ic: 'star'}, {id: 'b', t: 'Otra', ic: 'heart'}]}); }""", "dialog.vm[open]"),
    )
    for tag, js, sel in opens:
        for early in (False, True):
            page = CL._page()
            try:
                CL._seed(page)
                if early:
                    page.clock.run_for(1200)
                page.evaluate(js)
                page.wait_for_selector(sel, timeout=5000)
                page.wait_for_timeout(300)
                if page.evaluate("() => vocabCalls.calm()"):
                    probs.append(f"{tag}: con ella abierta la pantalla cuenta como tranquila")
                if CL._rings(page, 9000):
                    probs.append(f"{tag}{' (ya iba a sonar)' if early else ''}: suena encima")
                page.keyboard.press("Escape")
                page.wait_for_function(f"() => !document.querySelector({json.dumps(sel)})", timeout=4000)
                page.wait_for_timeout(400)
                if tag == "Ajustes" and page.evaluate("() => !!document.querySelector('dialog#ajustes[open]')"):
                    page.keyboard.press("Escape")
                if not CL._rings(page, 9000):
                    probs.append(f"{tag}{' (ya iba a sonar)' if early else ''}: al cerrarla no suena")
                else:
                    ds = page.evaluate("() => [...document.querySelectorAll('dialog[open]')].map(d => d.id || d.className)")
                    if ds != ["cl-dlg"]:
                        probs.append(f"{tag}: al sonar hay estos diálogos abiertos {ds}")
                probs += [f"{tag}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)


# =============================================================== 4. toques seguros de Google
def test_no_google_prompt_mid_story_call_parrot_or_camera():
    """Con Google conectado, el permiso caducado, cambios sin subir y el toque siguiente listo para renovarlo
    (vocabSync.tapDue()): ningún toque a mitad de un cuento (Siguiente, una palabra, su globo, la elección), de una
    llamada (Contestar, una palabra, una respuesta, Colgar), del loro (grabar y parar) ni del cazador con la cámara
    («Usar la cámara», Siguiente, el modo tocar) pide el permiso de Google. Después, un toque en una pestaña sí (dentro
    del toque)."""
    probs = []

    def check(page, what, n0):
        page.wait_for_timeout(300)
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

    def open_page(hash):
        page = _page(gis=True, reduced_motion="reduce")
        log = []
        A._drive(page, log)
        k = A._armed_keys(_keys())
        CL._seed(page, k, hash=hash, armed=False)
        page.evaluate("vocabSync._delays({debounce: 300, poll: 500, retry: 60e3})")
        return page

    # un cuento: la portada se abre con «Leer»; Siguiente, una palabra (su globo y la tortuga), la elección
    page = open_page("#/cuento/en-play")
    try:
        page.wait_for_selector("#st-stage .st-page", timeout=10000)
        n0, _ = A._arm(page)
        due(page, "cuento")
        page.locator("#st-next").click()
        CU._wait_state(page, "s.p === 1")
        check(page, "cuento: Siguiente", n0)
        page.locator("#st-txt .st-u").first.click()
        page.wait_for_selector("#st-bub", timeout=3000)
        check(page, "cuento: una palabra", n0)
        page.locator("#st-bub-slow").click()
        check(page, "cuento: la tortuga del globo", n0)
        page.locator("#st-bub-x").click()
        for _ in range(12):
            st = CU._state(page)
            if st["kind"] == "choice":
                break
            page.locator("#st-next").click()
            CU._wait_state(page, f"s.p > {st['p']}")
        page.locator(".st-opt").first.click()
        CU._wait_state(page, "!!s.ch")
        check(page, "cuento: la elección", n0)
        page.locator("#fx-x").click()
        page.wait_for_function("() => !document.documentElement.dataset.focus", timeout=5000)
        page.wait_for_timeout(300)
        control(page, "cuento")
        probs += [f"cuento: {e}" for e in C.errors(page)]
    finally:
        page.context.close()

    # una llamada: Contestar, una palabra de los subtítulos, una respuesta y Colgar
    page = open_page("")
    try:
        n0, _ = A._arm(page)
        due(page, "llamada")
        page.evaluate("() => vocabCalls.ring('en-zoo')")
        page.wait_for_selector("dialog#cl-dlg[open] .cl-ring", timeout=6000)
        page.wait_for_timeout(200)
        page.locator("#cl-yes").click()
        page.wait_for_function("() => vocabCalls.current && vocabCalls.current.mode === 'talk'", timeout=4000)
        check(page, "llamada: Contestar", n0)
        for _ in range(60):
            if page.locator("#cl-dlg .cl-k").count():
                break
            page.clock.run_for(500)
            page.wait_for_timeout(25)
        if page.locator("#cl-dlg .cl-k").count():
            page.locator("#cl-dlg .cl-k").first.click()
            page.wait_for_selector("#cl-pop", timeout=3000)
            check(page, "llamada: una palabra", n0)
            page.locator("#cl-pop-x").click()
        cur = CL._to_wait(page)
        if cur:
            CL._pick(page, 0)
            check(page, "llamada: una respuesta", n0)
        if page.evaluate(CL._OPEN):
            CL._hang(page)
            check(page, "llamada: Colgar", n0)
        page.wait_for_timeout(400)
        control(page, "llamada")
        probs += [f"llamada: {e}" for e in C.errors(page)]
    finally:
        page.context.close()

    # el loro: grabar (tocar para empezar; para solo tras el silencio) y otra vez para parar
    page = open_page("#/loro")
    try:
        page.wait_for_selector("#lr-rb", timeout=10000)
        n0, _ = A._arm(page)
        due(page, "loro")
        page.locator("#lr-rb").click()
        page.wait_for_function("() => vocabParrot.state.st === 'rec'", timeout=5000)
        check(page, "loro: empezar a grabar", n0)
        page.locator("#lr-rb").click()
        page.wait_for_function("() => vocabParrot.state.st !== 'rec'", timeout=5000)
        check(page, "loro: parar", n0)
        page.wait_for_function("() => vocabParrot.state.st === 'done'", timeout=12000)
        page.wait_for_timeout(500)
        check(page, "loro: el eco y el nativo", n0)
        control(page, "loro")
        probs += [f"loro: {e}" for e in C.errors(page)]
    finally:
        page.context.close()

    # el cazador: «Usar la cámara», encontrar el color, Siguiente y el modo tocar
    page = open_page("#/cazador")
    try:
        page.wait_for_selector("#hn", timeout=10000)
        page.evaluate(HN._SPY)
        n0, _ = A._arm(page)
        due(page, "cazador")
        HN._start(page)
        check(page, "cazador: Usar la cámara", n0)
        HN._find(page)
        page.locator("#hn-next").click()
        page.wait_for_timeout(250)
        check(page, "cazador: Siguiente", n0)
        page.locator("#hn-tap").click()
        page.wait_for_selector(".hn-opt", timeout=4000)
        check(page, "cazador: el modo tocar", n0)
        page.locator(".hn-opt").first.click()
        check(page, "cazador: un dibujo del modo tocar", n0)
        page.locator("#fx-x").click()
        page.wait_for_function("() => !document.documentElement.dataset.focus", timeout=5000)
        page.wait_for_timeout(300)
        control(page, "cazador")
        probs += [f"cazador: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# =============================================================== 5. el recorrido en los tres idiomas
_ALLOWED = {"game", "calls", "cuentos", "act", "buddy:missions", "games:day", "album:seen:english", "album:seen:français",
            "album:seen:dansk"}


def _tour(lang, probs, shots=False):
    ab = AB[lang]
    OUT = C.CAPTURAS / "F6"
    page = _page(viewport={"width": 390, "height": 844})
    page.context.add_init_script(
        "(() => { window.__vt = []; const o = Document.prototype.startViewTransition; if (o) Document.prototype.startViewTransition ="
        " function (cb) { window.__vt.push(document.documentElement.dataset.vt || ''); return o.call(this, cb); }; })();")
    tag = ab
    try:
        CL._seed(page, _keys(lang), armed=False)
        base = C.export(page)
        # Hoy
        C.goto(page, "")
        page.wait_for_timeout(400)
        page.evaluate(CL._FINISH)
        I5._fits(page, f"{tag} Hoy", probs)
        # una transición dentro de una pestaña: Palabras › un tema (fwd) y ‹ Palabras (back)
        C.goto(page, "#/palabras")
        k0 = len(page.evaluate("window.__vt"))
        n0 = page.evaluate(_ROUTE_N)
        page.locator("#app a[href^='#/doc/']").first.click()
        _wait_route(page, n0)
        n0 = page.evaluate(_ROUTE_N)
        page.locator("#dv-back").click()
        _wait_route(page, n0)
        vt = page.evaluate("window.__vt")[k0:]
        if vt != ["fwd", "back"]:
            probs.append(f"{tag}: Palabras › tema › Palabras anima {vt} (se esperaba ['fwd', 'back'])")
        # el título que se pliega
        page.mouse.wheel(0, 420)
        page.wait_for_timeout(450)
        tc = page.evaluate("() => ({tcol: document.documentElement.hasAttribute('data-tcol'), t: (document.getElementById('tb-title') || {}).textContent || ''})")
        if not tc["tcol"] or tc["t"] != "Aprender":
            probs.append(f"{tag}: al bajar en Palabras el título no se pliega {tc}")
        page.mouse.wheel(0, -5000)
        page.wait_for_timeout(300)
        # el menú de mantener pulsado de una palabra (Palabras › tema en lista)
        C.goto(page, f"#/doc/{R.TOPIC}?m=lista")
        page.wait_for_selector(".dl-r .dl-fg", timeout=8000)
        AX._hold(page, ".dl-r .dl-fg")
        m = page.evaluate(AX._MENU)
        if not m or len(m["items"]) < 2 or not m["modal"]:
            probs.append(f"{tag}: el menú de mantener pulsado no sale bien {m}")
        elif not m["ipa"]:
            probs.append(f"{tag}: el menú de la palabra no enseña la IPA {m}")
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        # el loro: grabar, el eco y el nativo
        C.goto(page, "#/loro")
        page.wait_for_selector("#lr-rb", timeout=8000)
        if not page.evaluate(_IPA, "#app .ipa"):
            probs.append(f"{tag}: el loro no enseña la IPA de la palabra")
        st = LO._record(page)
        if st["st"] != "done" or not st["heard"] or not 1 <= st["stars"] <= 3:
            probs.append(f"{tag}: el loro no acaba bien {st}")
        # un cuento entero (con una palabra tocada y su globo con IPA)
        sid = _first_story(lang)
        s, _ = CU._story(sid)
        C.goto(page, f"#/cuento/{sid}")
        page.wait_for_selector("#st-stage .st-page", timeout=10000)
        page.locator("#st-next").click()
        CU._wait_state(page, "s.p === 1")
        gl = s["gloss"]
        units = CU._state(page)["units"]
        iu = next((i for i, u in enumerate(units) if (gl.get(u.lower()) or {}).get("ipa")), None)
        if iu is None:
            probs.append(f"{tag}: ninguna palabra de la página 1 de {sid} tiene IPA")
        else:
            page.locator(f"#st-txt .st-u[data-u='{iu}']").click()
            page.wait_for_selector("#st-bub", timeout=3000)
            ipa = page.evaluate(_IPA, "#st-bub .ipa")
            if ipa != [gl[units[iu].lower()]["ipa"]]:
                probs.append(f"{tag}: el globo de «{units[iu]}» enseña la IPA {ipa}")
            page.locator("#st-bub-x").click()
        key = s["choice"]["opts"][0]["key"]
        CU._read(page, key)
        page.wait_for_function("() => vocabStories.state() && vocabStories.state().fin", timeout=6000)
        if not page.evaluate("id => JSON.stringify(store.get('cuentos', {})).includes(id)", sid):
            probs.append(f"{tag}: «cuentos» no apunta {sid} tras leerlo")
        page.locator("#fx-x").click()
        page.wait_for_function("() => !document.documentElement.dataset.focus", timeout=5000)
        # una llamada contestada: suena en Hoy, se contesta, se ve la IPA de las respuestas y acaba sola
        C.goto(page, "")
        CL._again(page)
        CL._ring(page)
        if shots:
            C.shot(page, f"F6-recorrido-{ab}-llamada-entrante", OUT, full_page=False)
        CL._answer(page)
        cur = CL._to_wait(page)
        if cur and not page.evaluate(_IPA, "#cl-ans .ipa"):
            probs.append(f"{tag}: las respuestas de la llamada no enseñan la IPA")
        CL._finish(page)
        for _ in range(10):
            if not page.evaluate(CL._OPEN):
                break
            page.clock.run_for(500)
            page.wait_for_timeout(30)
        if page.evaluate(CL._OPEN):
            probs.append(f"{tag}: la llamada contestada no cuelga sola")
        paid = page.evaluate("() => window.__coins.filter(e => e.why === '¡Llamada del zorro!').length")
        if paid != 1:
            probs.append(f"{tag}: la llamada contestada paga {paid} veces")
        # otra perdida, dos días después: «Ahora no» deja «1 llamada perdida» en Hoy
        page.clock.set_system_time(C.FIXED_NOW + dt.timedelta(days=2, hours=1))
        CL._again(page)
        CL._ring(page)
        page.locator("#cl-no").click()
        page.wait_for_function("() => !document.querySelector('dialog#cl-dlg[open]')", timeout=4000)
        CL._hoy(page)
        row = page.evaluate(CL._ROW)
        if not row or "perdida" not in row:
            probs.append(f"{tag}: tras «Ahora no» Hoy no enseña la llamada perdida ({row})")
        I5._fits(page, f"{tag} Hoy con la llamada perdida", probs)
        # el cazador con la cámara de mentira: pide un color en el idioma y lo encuentra
        C.goto(page, "#/cazador")
        page.wait_for_selector("#hn", timeout=10000)
        page.evaluate(HN._SPY)
        HN._start(page)
        if not page.evaluate(_IPA, "#hn .ipa"):
            probs.append(f"{tag}: el cazador no enseña la IPA del color")
        HN._find(page)
        page.wait_for_timeout(300)
        if not page.evaluate("() => window.__found.length"):
            probs.append(f"{tag}: el cazador no apunta el color encontrado")
        if page.evaluate(HN._LIVE) < 1:
            probs.append(f"{tag}: la cámara de mentira no está encendida mientras se juega")
        page.locator("#fx-x").click()
        page.wait_for_function("() => !document.documentElement.dataset.focus", timeout=5000)
        page.wait_for_timeout(300)
        if page.evaluate(HN._LIVE):
            probs.append(f"{tag}: al salir del cazador la cámara sigue encendida")
        # la partida exportada: la de antes más lo nuevo (sin grabaciones ni fotos)
        after = C.export(page)
        bk, ak = set(base.get("keys", base)), set(after.get("keys", after))
        if bk - ak:
            probs.append(f"{tag}: la partida pierde {sorted(bk - ak)}")
        changed = sorted(k for k in ak if k not in bk or json.dumps((base.get("keys", base)).get(k), sort_keys=True)
                         != json.dumps((after.get("keys", after)).get(k), sort_keys=True))
        odd = [k for k in changed if k not in _ALLOWED]
        if odd:
            probs.append(f"{tag}: cambian claves de más en la partida {odd}")
        txt = json.dumps(after, ensure_ascii=False)
        for bad in ("parrot:st", "hunt:st", "vocab-media", "capsule", "\"photo\""):
            if bad in txt:
                probs.append(f"{tag}: la partida exportada lleva {bad}")
        probs += [f"{tag}: {e}" for e in C.errors(page)]
    finally:
        page.context.close()


def test_tour_english():
    """El recorrido entero con la partida sembrada en inglés."""
    probs = []
    _tour("english", probs, shots=True)
    assert not probs, "\n".join(probs)


def test_tour_french():
    """El recorrido entero con la partida sembrada en francés."""
    probs = []
    _tour("français", probs)
    assert not probs, "\n".join(probs)


def test_tour_danish():
    """El recorrido entero con la partida sembrada en danés."""
    probs = []
    _tour("dansk", probs)
    assert not probs, "\n".join(probs)


# =============================================================== 6. capturas (capturas/F6/F6-*.png, móvil 390×844)
_HOLD_ANIMS = """f => { for (const a of document.getAnimations()) { try { const t = a.effect.getComputedTiming();
  if (t.iterations === Infinity || !isFinite(t.endTime)) continue;
  a.pause(); a.currentTime = (t.delay || 0) + (t.activeDuration || 0) * f; } catch (e) {} } }"""


def _cap_story(page, sid, s, probs, tag, out, name_word, name_choice=None):
    """Una página del cuento con una palabra tocada (iluminada mientras suena) y su globo con la IPA; luego, la elección."""
    C.goto(page, f"#/cuento/{sid}")
    page.wait_for_selector("#st-stage .st-page", timeout=10000)
    page.locator("#st-next").click()
    CU._wait_state(page, "s.p === 1")
    page.wait_for_timeout(300)
    gl = s["gloss"]
    units = CU._state(page)["units"]
    iu = next((i for i, u in enumerate(units) if (gl.get(u.lower()) or {}).get("ipa") and (gl.get(u.lower()) or {}).get("img")), None)
    if iu is None:
        iu = next(i for i, u in enumerate(units) if (gl.get(u.lower()) or {}).get("ipa"))
    page.evaluate("() => { window.__playMs = 6000; }")
    page.locator(f"#st-txt .st-u[data-u='{iu}']").click()
    page.wait_for_selector("#st-bub", timeout=3000)
    page.wait_for_timeout(350)
    lit = page.evaluate("() => !!document.querySelector('#st-txt .st-u.is-tap')")
    ipa = page.evaluate(_IPA, "#st-bub .ipa")
    if not lit or not ipa:
        probs.append(f"{tag}: la palabra tocada no se ilumina ({lit}) o su globo no enseña la IPA ({ipa})")
    C.shot(page, name_word, out, full_page=False)
    page.evaluate("() => { window.__playMs = 60; }")
    page.locator("#st-bub-x").click()
    if not name_choice:
        return
    for _ in range(14):
        st = CU._state(page)
        if st["kind"] == "choice":
            break
        page.locator("#st-next").click()
        CU._wait_state(page, f"s.p > {st['p']}")
    page.wait_for_timeout(500)
    page.evaluate(CL._FINISH)
    C.shot(page, name_choice, out, full_page=False)


def _cap_call(page, probs, tag, out, ring_name, talk_name):
    C.goto(page, "")
    CL._again(page)
    CL._ring(page)
    page.clock.run_for(1500)
    page.wait_for_timeout(200)
    C.shot(page, ring_name, out, full_page=False)
    CL._answer(page)
    cur = CL._to_wait(page)
    page.wait_for_timeout(300)
    if not cur or not page.evaluate(_IPA, "#cl-ans .ipa"):
        probs.append(f"{tag}: la llamada no llega a una pregunta con la IPA de sus respuestas ({cur})")
    C.shot(page, talk_name, out, full_page=False)


def test_captures_f6_phone():
    """Capturas del móvil (390×844) con nombre: el título grande y plegado, Ajustes saliendo del engranaje (a mitad), el
    menú de una palabra, el loro grabando y con las dos ondas, la cápsula en Premios, la estantería de cuentos, una
    página con una palabra iluminada y su globo con la IPA, la elección, la llamada entrante y en curso, «1 llamada
    perdida» en Hoy, el cazador pidiendo un color y encontrado, «Mi casa» del álbum; y Hoy, un cuento y la llamada en
    oscuro. Sin errores en la consola."""
    out = C.CAPTURAS / "F6"
    probs = []
    page = _page(viewport={"width": 390, "height": 844})
    try:
        CL._seed(page, _keys(), armed=False)
        # el título grande de Aprender › Palabras y plegado al bajar
        C.goto(page, "#/palabras")
        page.wait_for_timeout(300)
        C.shot(page, "F6-titulo-grande", out, full_page=False)
        page.mouse.wheel(0, 420)
        page.wait_for_timeout(500)
        if not page.evaluate("() => document.documentElement.hasAttribute('data-tcol')"):
            probs.append("el título no se pliega al bajar")
        C.shot(page, "F6-titulo-plegado", out, full_page=False)
        page.mouse.wheel(0, -5000)
        page.wait_for_timeout(300)
        # Ajustes saliendo del engranaje: el fotograma de la mitad
        C.goto(page, "")
        page.wait_for_timeout(400)
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_function("() => { const d = document.getElementById('ajustes'); return !!d && d.open && document.getAnimations().length > 0; }", timeout=5000)
        page.evaluate(_HOLD_ANIMS, 0.45)
        page.wait_for_timeout(80)
        out.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(out / "F6-ajustes-saliendo-del-engranaje.png"), animations="allow")
        page.evaluate(CL._FINISH)
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.querySelector('dialog#ajustes[open]')", timeout=4000)
        page.wait_for_timeout(300)
        # el menú de mantener pulsado de una palabra
        C.goto(page, f"#/doc/{R.TOPIC}?m=lista")
        page.wait_for_selector(".dl-r .dl-fg", timeout=8000)
        AX._hold(page, ".dl-r .dl-fg")
        page.evaluate(CL._FINISH)
        page.wait_for_timeout(200)
        if not page.evaluate(AX._MENU):
            probs.append("no sale el menú de la palabra")
        C.shot(page, "F6-menu-de-una-palabra", out, full_page=False)
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        # el loro: grabando y con las dos ondas
        C.goto(page, "#/loro")
        page.wait_for_selector("#lr-rb", timeout=8000)
        page.wait_for_function("() => ['idle', 'done'].includes(vocabParrot.state.st)", timeout=5000)
        page.locator("#lr-rb").click()
        page.wait_for_function("() => vocabParrot.state.st === 'rec'", timeout=5000)
        page.wait_for_timeout(350)
        C.shot(page, "F6-loro-grabando", out, full_page=False, animations="allow")
        page.wait_for_function("() => vocabParrot.state.st === 'done'", timeout=12000)
        page.evaluate(CL._FINISH)
        page.wait_for_timeout(800)
        px = [page.evaluate(LO._PAINT, "lr-cv-me"), page.evaluate(LO._PAINT, "lr-cv-nat")]
        if min(px) < 50:
            probs.append(f"las dos ondas no se pintan {px}")
        C.shot(page, "F6-loro-dos-ondas", out, full_page=False)
        # la cápsula del tiempo en Premios (las de octubre y enero)
        page.evaluate(LO._PUT2)
        C.goto(page, "#/granja")
        C.goto(page, "#/progreso")
        page.wait_for_selector("#rw-voz:not([hidden]) .lr-tc", timeout=6000)
        page.evaluate("() => document.getElementById('rw-voz').scrollIntoView({block: 'center'})")
        page.wait_for_timeout(500)
        C.shot(page, "F6-premios-capsula", out, full_page=False)
        page.evaluate("() => scrollTo(0, 0)")
        # la estantería de cuentos, una página con su palabra y la elección
        C.goto(page, "#/cuentos")
        page.wait_for_selector("#st-grid .st-cv", timeout=8000)
        page.wait_for_timeout(400)
        C.shot(page, "F6-cuentos-estante", out, full_page=False)
        s, _ = CU._story("en-play")
        _cap_story(page, "en-play", s, probs, "claro", out, "F6-cuento-palabra-iluminada-con-ipa", "F6-cuento-eleccion")
        page.locator("#fx-x").click()
        page.wait_for_function("() => !document.documentElement.dataset.focus", timeout=5000)
        # la llamada: entrante y en curso; otra perdida dos días después
        _cap_call(page, probs, "claro", out, "F6-llamada-entrante", "F6-llamada-en-curso")
        CL._finish(page)
        page.clock.set_system_time(C.FIXED_NOW + dt.timedelta(days=2, hours=1))
        CL._again(page)
        CL._ring(page)
        page.locator("#cl-no").click()
        page.wait_for_function("() => !document.querySelector('dialog#cl-dlg[open]')", timeout=4000)
        CL._hoy(page)
        if not page.evaluate(CL._ROW):
            probs.append("Hoy no enseña la llamada perdida")
        C.shot(page, "F6-hoy-1-llamada-perdida", out, full_page=False)
        # el cazador: pidiendo un color y encontrado (dos colores, para «Mi casa»)
        C.goto(page, "#/cazador")
        page.wait_for_selector("#hn", timeout=10000)
        page.evaluate(HN._SPY)
        HN._start(page)
        page.wait_for_timeout(600)
        C.shot(page, "F6-cazador-pide-un-color", out, full_page=False)
        HN._find(page)
        page.wait_for_timeout(500)
        C.shot(page, "F6-cazador-encontrado", out, full_page=False)
        page.locator("#hn-next").click()
        page.wait_for_function("() => vocabHunter.state().step !== 'found'", timeout=5000)
        page.wait_for_timeout(600)
        HN._find(page)
        page.wait_for_function("() => window.__found.length >= 2", timeout=5000)
        page.locator("#fx-x").click()
        page.wait_for_function("() => !document.documentElement.dataset.focus", timeout=5000)
        C.goto(page, "#/album/casa")
        page.wait_for_selector("#hn-cg .hn-cc img", timeout=6000)
        try:   # sin los avisos de monedas encima del título
            page.wait_for_function("() => !document.querySelector('#m-toasts .m-toast')", timeout=8000)
        except Exception:  # noqa: BLE001
            pass
        page.wait_for_timeout(300)
        C.shot(page, "F6-album-mi-casa", out, full_page=False)
        probs += C.errors(page)
    finally:
        page.context.close()

    # en oscuro: Hoy, un cuento y la llamada
    page = _page(viewport={"width": 390, "height": 844}, color_scheme="dark")
    try:
        CL._seed(page, _keys(), armed=False)
        C.goto(page, "")
        page.wait_for_timeout(500)
        page.evaluate(CL._FINISH)
        C.shot(page, "F6-hoy-oscuro", out, full_page=False)
        s, _ = CU._story("en-play")
        _cap_story(page, "en-play", s, probs, "oscuro", out, "F6-cuento-oscuro")
        page.locator("#fx-x").click()
        page.wait_for_function("() => !document.documentElement.dataset.focus", timeout=5000)
        _cap_call(page, probs, "oscuro", out, "F6-llamada-entrante-oscuro", "F6-llamada-en-curso-oscuro")
        CL._finish(page)
        probs += [f"oscuro: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
