"""F6k (SPEC §5-K): el «Cazador de cosas» (js/hunter-boot.js, siempre; js/hunter.js, solo al entrar).

#/cazador es un juego en modo foco de la pestaña Jugar (tarjeta en Juegos). Antes de la cámara, una frase y un botón
(«Para jugar, la app mira por la cámara. Nada sale del aparato.»). Cada color se pide en el idioma: la frase con la voz
elegida del navegador (useVoice) y la palabra con su mp3; la palabra se ve con su IPA. Un cuadro en el centro mide el
color (lienzo de 40×40, HSV con tolerancia y luz mínima): el color pedido sostenido 1 s se encuentra y paga una vez con
award() (2 monedas; tope de 10 al día); otro color, poca luz o un destello no. Se guarda solo un recorte de 192×192 del
centro del cuadro en IndexedDB (window.vocabMedia, kind "photo", src "hunt") y se ve en «Mi casa» (#/album/casa); Para
mayores lo borra. Sin permiso, sin cámara o tocando «Jugar tocando», el modo tocar (4 dibujos). Las pistas de la cámara
se paran al salir, al ocultar la pestaña, al pasar a tocar y al acabar. Nada se carga hasta entrar. La partida
exportada es la de la base ("hunt:st" es solo del aparato).

Cámara de mentira: getUserMedia devuelve canvas.captureStream() de un lienzo pintado de un color que la prueba cambia
(window.__cam: color, deny, err, delay; streams guarda cada flujo) y, en una prueba aparte, la cámara falsa de Chromium
(--use-fake-device-for-media-stream con --use-file-for-fake-video-capture de un .y4m rojo liso). Voz de mentira
(window.__spoken: texto, lang, voz) y audio grabado espiado (window.__played)."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

import common as C

OUT = C.CAPTURAS / "F6"
_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
_A11Y = (C.HERE / "a11y.js").read_text(encoding="utf-8")
AB = {"english": "en", "français": "fr", "dansk": "da"}
CODE = {"english": "en-GB", "français": "fr-FR", "dansk": "da-DK"}
CHOSEN = {"english": "Daniel", "français": "Thomas", "dansk": "Sara"}
HEX = {"red": "#E53935", "yellow": "#FDD835", "green": "#43A047", "blue": "#1E88E5"}
ES = {"red": "rojo", "yellow": "amarillo", "green": "verde", "blue": "azul"}
WORD = {"english": {"red": "red", "yellow": "yellow", "green": "green", "blue": "blue"},
        "français": {"red": "rouge", "yellow": "jaune", "green": "vert", "blue": "bleu"},
        "dansk": {"red": "rød", "yellow": "gul", "green": "grøn", "blue": "blå"}}
ASKW = {"english": WORD["english"], "français": WORD["français"],
        "dansk": {"red": "rødt", "yellow": "gult", "green": "grønt", "blue": "blåt"}}
PHRASE = {"english": "Find something {}!", "français": "Trouve quelque chose de {} !", "dansk": "Find noget {}!"}
INTRO = "Para jugar, la app mira por la cámara. Nada sale del aparato."
TODAY = C.FIXED_NOW.strftime("%Y-%m-%d")
CLIPS = {ab: json.loads((C.REPO / "audio" / f"{ab}.json").read_text(encoding="utf-8")) for ab in AB.values()}


def _v(name, lang, local=True):
    return {"name": name, "lang": lang, "localService": local, "default": False, "voiceURI": name}


VOICES = [_v("Google UK English Female", "en-GB", False), _v("Daniel", "en-GB"), _v("Google français", "fr-FR", False),
          _v("Thomas", "fr-FR"), _v("Sara", "da-DK")]

_TTS = r"""
(cfg => {
  const ss = window.speechSynthesis; if (!ss) return;
  const list = cfg.voices.map(v => Object.freeze(Object.assign({}, v)));
  window.__spoken = [];
  let cur = null, tm = null;
  Object.defineProperty(ss, 'getVoices', {configurable: true, writable: true, value: () => list.slice()});
  Object.defineProperty(ss, 'speak', {configurable: true, writable: true, value: u => {
    window.__spoken.push({text: String(u.text || ''), lang: String(u.lang || ''), voice: u.voice ? u.voice.name : null, rate: u.rate, t: Date.now()});
    cur = u;
    tm = setTimeout(() => { if (cur !== u) return; cur = null; if (u.onend) u.onend({}); }, 120 + String(u.text).length * 25);
  }});
  Object.defineProperty(ss, 'cancel', {configurable: true, writable: true, value: () => {
    clearTimeout(tm); const u = cur; cur = null;
    if (u && u.onerror) setTimeout(() => { try { u.onerror({error: 'interrupted'}); } catch (e) {} }, 0);
  }});
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t == null ? '' : String(t); this.lang = ''; this.rate = 1;
    this.pitch = 1; this.volume = 1; this.voice = null; this.onstart = this.onend = this.onerror = this.onboundary = null; } };
})
"""
# el audio grabado (los mp3) se espía; el <video> de la cámara sigue con su play() de verdad
_MEDIA = r"""
(() => {
  window.__played = [];
  const play0 = HTMLMediaElement.prototype.play, pause0 = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.play = function () {
    if (this instanceof HTMLVideoElement) return play0.call(this);
    window.__played.push({src: this.src, rate: this.playbackRate, t: Date.now()});
    setTimeout(() => this.dispatchEvent(new Event('ended')), 60);
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function () { if (this instanceof HTMLVideoElement) return pause0.call(this); };
})();
"""
_CAM = r"""
(mode => {
  window.__cam = {color: '#808080', streams: [], calls: 0, deny: false, err: '', delay: 0, last: null};
  if (mode === 'none') { try { Object.defineProperty(navigator, 'mediaDevices', {configurable: true, value: undefined}); } catch (e) {} return; }
  if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', {configurable: true, value: {}});
  navigator.mediaDevices.getUserMedia = async c => {
    const k = window.__cam; k.calls++; k.last = JSON.parse(JSON.stringify(c || null));
    if (k.delay) await new Promise(r => setTimeout(r, k.delay));
    if (k.deny) throw new DOMException('Permission denied', 'NotAllowedError');
    if (k.err) throw new DOMException('No camera', k.err);
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 240;
    const x = cv.getContext('2d');
    const draw = () => { x.fillStyle = k.color; x.fillRect(0, 0, 320, 240); };
    draw(); const iv = setInterval(draw, 50);
    const s = cv.captureStream(20);
    s.getTracks().forEach(t => { const st = t.stop.bind(t); t.stop = () => { clearInterval(iv); st(); }; });
    k.streams.push(s);
    return s;
  };
})
"""
_SPY = """() => { if (window.__aw) return; window.__aw = [];
  const a0 = window.award; window.award = function(n, why, quiet, from){ window.__aw.push([n, why, !!quiet, !!from]); return a0.apply(this, arguments); };
  window.__found = []; bus.on('hunt-found', d => window.__found.push(d)); window.__end = []; bus.on('hunt-end', d => window.__end.push(d)); }"""
_ST = "() => vocabHunter.state()"
_TRACKS = "() => window.__cam.streams.map(s => s.getTracks().map(t => t.readyState))"
_LIVE = "() => window.__cam.streams.flatMap(s => s.getTracks()).filter(t => t.readyState === 'live').length"
_IDB = """async () => { const all = await vocabMedia.list(); const out = [];
  for (const x of all) { let w = 0, h = 0;
    if (x.kind === 'photo' && x.buf) { try { const b = await createImageBitmap(new Blob([x.buf], {type: x.type})); w = b.width; h = b.height; } catch (e) {} }
    const o = Object.assign({}, x); delete o.buf; o.bytes = x.buf ? x.buf.byteLength : 0; o.iw = w; o.ih = h; out.push(o); }
  return out; }"""
_HIDE = """hidden => { Object.defineProperty(document, 'hidden', {configurable: true, get: () => hidden});
  Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => hidden ? 'hidden' : 'visible'});
  document.dispatchEvent(new Event('visibilitychange')); }"""
_PASS = "() => sessionStorage.setItem('vocab:gate', String(Date.now() + adultGate.MS))"
_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""


# ---------------------------------------------------------------- utilidades
def _page(kind="phone", cam="canvas", voices=None, **kw):
    page = C.new_page(kind, **kw)
    ctx = page.context
    ctx.add_init_script(f"{_TTS}({json.dumps({'voices': VOICES if voices is None else voices})})")
    ctx.add_init_script(_MEDIA)
    ctx.add_init_script(f"{_CAM}({json.dumps(cam)})")
    return page


def _keys(lang=None, **extra):
    k = C.seed_keys()
    if lang:
        k["lang"] = json.dumps(lang, ensure_ascii=False)
    k["vocab:voice"] = json.dumps(CHOSEN, ensure_ascii=False)
    for a, b in extra.items():
        k[a.replace("__", ":")] = b if isinstance(b, str) else json.dumps(b, ensure_ascii=False)
    return k


def _open(page, keys=None, hash="#/cazador"):
    C.seed(page, keys=keys if keys is not None else _keys(), hash=hash)
    if hash.startswith("#/cazador"):
        page.wait_for_selector("#hn", timeout=10000)
    page.evaluate(_SPY)
    page.wait_for_timeout(100)


def _st(page):
    return page.evaluate(_ST)


def _start(page, color="#808080"):
    """«Usar la cámara» con la cámara de mentira enseñando color; espera a que mida."""
    page.evaluate("c => { window.__cam.color = c; }", color)
    page.locator("#hn-start").click()
    page.wait_for_function("() => { const s = vocabHunter.state(); return s.cam.on && !!s.reading; }", timeout=6000)


def _show(page, hexcol):
    page.evaluate("c => { window.__cam.color = c; }", hexcol)


def _find(page, timeout=5000):
    """Enseña el color pedido y espera a que se encuentre; devuelve los ms que tardó."""
    c = _st(page)["color"]
    t0 = page.evaluate("() => performance.now()")
    _show(page, HEX[c])
    page.wait_for_function("() => vocabHunter.state().step === 'found'", timeout=timeout)
    return page.evaluate("() => performance.now()") - t0, c


def _a11y(page):
    a = page.evaluate(_A11Y, {})
    return [f"{k}: {x}" for k in ("names", "roles", "images", "targets", "ids", "dialogs", "focusable") for x in a.get(k, [])]


def _box(page, sel):
    return page.evaluate("""s => [...document.querySelectorAll(s)].map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })""", sel)


def _pass_gate(page):
    from test_f5_buzon import _pass_gate as pg
    pg(page)


# ---------------------------------------------------------------- carga perezosa, tarjeta y ruta
def test_nothing_loads_until_entering():
    """Al abrir la app (Hoy, Juegos y la portada del álbum) solo está js/hunter-boot.js: ni js/hunter.js ni sus estilos,
    y la cámara no se ha pedido. Juegos tiene la tarjeta «Cazador de cosas» (con su dibujo) y el álbum la fila «Mi casa».
    Al entrar (tocando la tarjeta) se pide js/hunter.js una vez, la pantalla es de modo foco (sin barras, con la ✕ que
    vuelve a Juegos) y sale la frase de la cámara con su botón, sin pedir todavía la cámara."""
    probs = []
    page = _page()
    reqs = []
    page.on("request", lambda r: reqs.append(r.url))
    try:
        _open(page, hash="#/")
        LOADED = """() => ({loaded: vocabHunter.loaded, css: !!document.getElementById('css-hunter'), calls: window.__cam.calls,
          route: typeof ROUTES.cazador, tab: TABS.find(t => t.id === 'jugar').secs.includes('cazador')})"""

        def ev():
            s = page.evaluate(LOADED)
            s["res"] = [u.split("/js/")[1].split("?")[0] for u in reqs if "/js/hunter" in u]
            return s
        s = ev()
        if s != {"loaded": False, "res": ["hunter-boot.js"], "css": False, "calls": 0, "route": "function", "tab": True}:
            probs.append(f"al abrir: {s}")
        C.goto(page, "#/juegos")
        page.wait_for_selector('.gm-card[data-g="cazador"]', timeout=5000)
        card = page.evaluate("""() => { const a = document.querySelector('.gm-card[data-g="cazador"]'); const i = a.querySelector('img');
          return {href: a.getAttribute('href'), t: a.querySelector('.gm-ct').textContent, img: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0, label: a.getAttribute('aria-label')}; }""")
        if card["href"] != "#/cazador" or card["t"] != "Cazador de cosas" or card["img"] != "img/games/cazador.png" or not card["ok"]:
            probs.append(f"tarjeta de Juegos: {card}")
        C.goto(page, "#/album")
        page.wait_for_selector(".hn-casa-r", timeout=5000)
        row = page.evaluate("() => { const a = document.querySelector('.hn-casa-r'); return {href: a.getAttribute('href'), t: a.textContent.replace(/\\s+/g, ' ').trim()}; }")
        if row["href"] != "#/album/casa" or "Mi casa" not in row["t"]:
            probs.append(f"fila «Mi casa» del álbum: {row}")
        s = ev()
        if s["loaded"] or s["res"] != ["hunter-boot.js"] or s["calls"]:
            probs.append(f"antes de entrar ya se cargó algo: {s}")
        C.goto(page, "#/juegos")
        page.wait_for_selector('.gm-card[data-g="cazador"]', timeout=5000)
        page.locator('.gm-card[data-g="cazador"]').click()
        page.wait_for_selector("#hn .hn-intro", timeout=8000)
        page.wait_for_timeout(300)
        s = ev()
        if not s["loaded"] or s["res"] != ["hunter-boot.js", "hunter.js"] or not s["css"] or s["calls"]:
            probs.append(f"al entrar: {s}")
        f = page.evaluate("""() => ({focus: document.documentElement.dataset.focus, x: document.getElementById('fx-x').getAttribute('href'),
          tabbar: getComputedStyle(document.getElementById('tabbar')).display, p: document.querySelector('.hn-in-p').textContent,
          btn: document.getElementById('hn-start').textContent.trim(), tap: document.getElementById('hn-tap0').textContent.trim(),
          renew: !!document.querySelector('#hn[data-no-renew]'), title: document.title})""")
        if f["focus"] != "cazador" or f["x"] != "#/juegos" or f["tabbar"] != "none" or not f["renew"]:
            probs.append(f"modo foco: {f}")
        if f["p"] != INTRO or f["btn"] != "Usar la cámara" or f["tap"] != "Jugar tocando":
            probs.append(f"la frase y el botón de la cámara: {f}")
        if not f["title"].startswith("Cazador de cosas"):
            probs.append(f"título de la ventana: {f['title']!r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la voz
def test_asks_color_in_language_with_voice_then_mp3():
    """En inglés, francés y danés el color se pide con la voz elegida de ese idioma («Find something red!», «Trouve
    quelque chose de rouge !», «Find noget rødt!») y después suena el mp3 de la palabra. La palabra se ve con su IPA. El
    altavoz lo repite y la tortuga dice la palabra despacio. Cambiar de idioma a mitad sigue en el mismo color, sin
    volver a pedir la cámara, y lo pide en el idioma nuevo. Sin voz de un idioma, solo suena el mp3 (no otro acento)."""
    probs = []
    for L in ("english", "français", "dansk"):
        page = _page()
        try:
            _open(page, keys=_keys(L))
            _start(page)
            c = _st(page)["color"]
            want = PHRASE[L].format(ASKW[L][c])
            page.wait_for_function("t => window.__spoken.some(x => x.text === t)", arg=want, timeout=5000)
            mp3 = f"audio/{AB[L]}/{CLIPS[AB[L]][WORD[L][c]]}.mp3"
            page.wait_for_function("m => window.__played.some(x => x.src.endsWith(m))", arg=mp3, timeout=5000)
            sp = next(x for x in page.evaluate("() => window.__spoken") if x["text"] == want)
            if sp["voice"] != CHOSEN[L] or not sp["lang"].startswith(CODE[L][:2]):
                probs.append(f"{L}: la frase no va con la voz elegida: {sp}")
            pl = next(x for x in page.evaluate("() => window.__played") if x["src"].endswith(mp3))
            if pl["t"] < sp["t"]:
                probs.append(f"{L}: el mp3 suena antes que la frase")
            ui = page.evaluate("""() => ({q: document.getElementById('hn-q').textContent, ql: document.getElementById('hn-q').lang,
              mark: document.querySelector('#hn-q mark').textContent, w: document.querySelector('.hn-wt b').textContent,
              ipa: (document.querySelector('.hn-wt .ipa') || {}).textContent || '', es: document.querySelector('.hn-es').textContent})""")
            if ui["q"] != want or ui["ql"] != CODE[L] or ui["mark"] != ASKW[L][c] or ui["w"] != WORD[L][c] or "/" not in ui["ipa"] or ui["es"] != ES[c]:
                probs.append(f"{L}: lo que se ve: {ui}")
            n0 = len(page.evaluate("() => window.__spoken"))
            page.locator("#hn-say").click()
            page.wait_for_function("([t, n]) => window.__spoken.slice(n).some(x => x.text === t)", arg=[want, n0], timeout=4000)
            p0 = len(page.evaluate("() => window.__played"))
            page.locator("#hn-slow").click()
            page.wait_for_function("([m, n]) => window.__played.slice(n).some(x => x.src.endsWith(m) && x.rate < 0.8)", arg=[mp3, p0], timeout=4000)
            if L == "english":
                calls = page.evaluate("() => window.__cam.calls")
                page.evaluate("() => setLang('français')")
                want2 = PHRASE["français"].format(ASKW["français"][c])
                page.wait_for_function("t => window.__spoken.some(x => x.text === t)", arg=want2, timeout=5000)
                s2 = _st(page)
                if s2["color"] != c or s2["i"] != 0 or not s2["cam"]["on"] or page.evaluate("() => window.__cam.calls") != calls:
                    probs.append(f"cambio de idioma a mitad: {s2}")
                if page.locator("#hn-q").text_content() != want2:
                    probs.append(f"tras cambiar de idioma: {page.locator('#hn-q').text_content()!r}")
                page.wait_for_function("() => vocabHunter.state().reading && document.getElementById('hn-v').readyState >= 2", timeout=4000)
            probs += [f"{L}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    # sin voz danesa: solo el mp3
    page = _page(voices=[v for v in VOICES if not v["lang"].startswith("da")])
    try:
        _open(page, keys=_keys("dansk"))
        _start(page)
        c = _st(page)["color"]
        mp3 = f"audio/da/{CLIPS['da'][WORD['dansk'][c]]}.mp3"
        page.wait_for_function("m => window.__played.some(x => x.src.endsWith(m))", arg=mp3, timeout=5000)
        da = [x for x in page.evaluate("() => window.__spoken") if x["text"]]
        if da:
            probs.append(f"sin voz danesa se leyó con otra voz: {da}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- encontrar
def test_right_color_held_one_second_found_pays_once():
    """El color pedido dentro del cuadro: se encuentra cuando lleva 1 s (no antes; el anillo se llena), con award(2)
    desde el cuadro, la ✓, «¡Lo encontraste!» y la palabra otra vez; paga una sola vez aunque siga a la vista. Un
    destello de medio segundo no cuenta (el anillo vuelve a vaciarse). «Siguiente color» pide otro y el color de antes
    ya no vale. "hunt:st" lleva las monedas de hoy y los colores cazados."""
    probs = []
    page = _page()
    try:
        _open(page)
        _start(page)
        c = _st(page)["color"]
        # un destello: medio segundo y fuera
        _show(page, HEX[c])
        page.wait_for_timeout(450)
        _show(page, "#808080")
        page.wait_for_timeout(1500)
        s = _st(page)
        if s["step"] != "ask" or s["hold"] != 0 or page.evaluate("() => window.__aw.length"):
            probs.append(f"un destello de medio segundo contó: {s}")
        ms, c = _find(page)
        if not (900 <= ms <= 2600):
            probs.append(f"se encontró en {ms:.0f} ms (debe ser ~1 s)")
        page.wait_for_timeout(2200)
        aw = page.evaluate("() => window.__aw")
        if aw != [[2, "¡Color cazado!", False, True]]:
            probs.append(f"award: {aw}")
        ui = page.evaluate("""() => ({got: (document.getElementById('hn-got') || {}).textContent || '', ok: !document.getElementById('hn-okm').hidden,
          next: (document.getElementById('hn-next') || {}).textContent || '', dash: getComputedStyle(document.getElementById('hn-pr')).strokeDashoffset})""")
        if "¡Lo encontraste!" not in ui["got"] or "Guardado en Mi casa" not in ui["got"] or not ui["ok"] or "Siguiente color" not in ui["next"] or ui["dash"] not in ("0", "0px"):
            probs.append(f"pantalla de encontrado: {ui}")
        st = json.loads(page.evaluate("() => localStorage.getItem('hunt:st')"))
        if st != {"v": 1, "day": {"d": TODAY, "c": 2}, "n": 1}:
            probs.append(f"hunt:st: {st}")
        fd = page.evaluate("() => window.__found")
        if fd != [{"color": c, "mode": "cam", "saved": True, "coins": 2}]:
            probs.append(f"hunt-found: {fd}")
        w = WORD["english"][c]
        if not any(x["src"].endswith(f"{CLIPS['en'][w]}.mp3") for x in page.evaluate("() => window.__played")[-2:]):
            probs.append("al encontrarlo no se dice la palabra")
        page.locator("#hn-next").click()
        page.wait_for_timeout(300)
        s = _st(page)
        if s["i"] != 1 or s["step"] != "ask" or s["color"] == c or not s["cam"]["on"]:
            probs.append(f"siguiente color: {s}")
        page.wait_for_timeout(2200)   # el color de antes sigue en la cámara
        s = _st(page)
        if s["step"] != "ask" or len(page.evaluate("() => window.__aw")) != 1:
            probs.append(f"el color de antes valió para el siguiente: {s}")
        if s["tip"] != f"other:{c}" or ES[c] not in page.locator("#hn-tip").text_content():
            probs.append(f"aviso con otro color: {s['tip']} {page.locator('#hn-tip').text_content()!r}")
        if page.evaluate("() => window.__cam.calls") != 1:
            probs.append("al pasar de color se volvió a pedir la cámara")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_daily_cap():
    """Con 9 monedas ganadas hoy, encontrar uno paga 1 (lo que queda hasta 10) y dice que ya están todas; el siguiente,
    nada (ni award). Tocando, igual. Al día siguiente vuelve a pagar."""
    probs = []
    page = _page()
    try:
        _open(page, keys=_keys(**{"hunt:st": {"v": 1, "day": {"d": TODAY, "c": 9}, "n": 9}}))
        _start(page)
        _find(page)
        page.wait_for_timeout(400)
        if page.evaluate("() => window.__aw") != [[1, "¡Color cazado!", False, True]]:
            probs.append(f"con 9 de 10: {page.evaluate('() => window.__aw')}")
        if "ya ganaste todas las monedas" not in page.locator("#hn-got").text_content():
            probs.append("no avisa de que ya ganó todas las monedas de hoy")
        page.locator("#hn-next").click()
        page.wait_for_timeout(300)
        _find(page)
        page.wait_for_timeout(400)
        page.locator("#hn-next").click()
        page.wait_for_timeout(300)
        page.locator("#hn-tap").click()
        page.wait_for_selector(".hn-opt", timeout=4000)
        c = _st(page)["color"]
        page.locator(f'.hn-opt[data-c="{c}"]').click()
        page.wait_for_timeout(400)
        aw = page.evaluate("() => window.__aw")
        if aw != [[1, "¡Color cazado!", False, True]]:
            probs.append(f"tras el tope siguió pagando: {aw}")
        st = json.loads(page.evaluate("() => localStorage.getItem('hunt:st')"))
        if st["day"] != {"d": TODAY, "c": 10} or st["n"] != 12:
            probs.append(f"hunt:st con el tope: {st}")
        if _st(page)["left"] != 0:
            probs.append("left debería ser 0")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = _page()
    try:
        _open(page, keys=_keys(**{"hunt:st": {"v": 1, "day": {"d": "2026-03-10", "c": 10}, "n": 30}}))
        _start(page)
        _find(page)
        page.wait_for_timeout(400)
        if page.evaluate("() => window.__aw") != [[2, "¡Color cazado!", False, True]]:
            probs.append(f"otro día no vuelve a pagar: {page.evaluate('() => window.__aw')}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_other_color_dark_and_grey_not_found():
    """Otro color fuerte, gris o casi negro durante 2,5 s no se encuentra (ni monedas): el aviso dice qué color ve (con su
    palabra) o que hay poca luz. Y el clasificador: cada color fuerte es él mismo; naranja, morado, rosa, piel, marrón,
    blanco, gris, negro y turquesa no son ninguno (el verde lima es verde)."""
    probs = []
    page = _page()
    try:
        _open(page)
        _start(page)
        c = _st(page)["color"]
        other = next(k for k in HEX if k != c)
        for col, tip in ((HEX[other], f"other:{other}"), ("#7F7F7F", "aim"), ("#0A0A0A", "dark"), ("#FB8C00", "aim"), ("#8E24AA", "aim")):
            _show(page, col)
            page.wait_for_timeout(2500)
            s = _st(page)
            if s["step"] != "ask" or s["hold"] != 0 or s["tip"] != tip:
                probs.append(f"{col}: {s['step']} hold={s['hold']} tip={s['tip']} (se esperaba {tip})")
        if page.evaluate("() => window.__aw.length"):
            probs.append("pagó con otro color")
        _show(page, "#0A0A0A")
        page.wait_for_timeout(1200)
        if "poca luz" not in page.locator("#hn-tip").text_content():
            probs.append(f"aviso de poca luz: {page.locator('#hn-tip').text_content()!r}")
        cls = page.evaluate("""() => { const px = h => { const n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
            const a = new Uint8ClampedArray(64 * 4); for (let i = 0; i < 64; i++) { a[i * 4] = r; a[i * 4 + 1] = g; a[i * 4 + 2] = b; a[i * 4 + 3] = 255; } return a; };
          const k = h => { const r = vocabHunter.classify(px(h)); return Object.entries(r.frac).filter(([, f]) => f >= vocabHunter.NEED).map(([c]) => c); };
          return {red: k('#E53935'), red2: k('#C62828'), yellow: k('#FDD835'), yellow2: k('#FFEB3B'), green: k('#43A047'), green2: k('#2E7D32'),
            blue: k('#1E88E5'), blue2: k('#1565C0'), orange: k('#FB8C00'), purple: k('#8E24AA'), pink: k('#EC407A'), skin: k('#E0AC69'),
            brown: k('#795548'), white: k('#FFFFFF'), grey: k('#9E9E9E'), black: k('#000000'), turquoise: k('#1ABC9C'), lime: k('#AEEA00')}; }""")
        want = {"red": ["red"], "red2": ["red"], "yellow": ["yellow"], "yellow2": ["yellow"], "green": ["green"], "green2": ["green"],
                "blue": ["blue"], "blue2": ["blue"], "orange": [], "purple": [], "pink": [], "skin": [], "brown": [], "white": [], "grey": [],
                "black": [], "turquoise": [], "lime": ["green"]}
        if cls != want:
            probs.append(f"clasificador: {cls}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la foto y «Mi casa»
def test_crop_saved_to_mi_casa_and_deleted_in_para_mayores():
    """Al encontrar un color se guarda en IndexedDB solo un recorte de 192×192 (JPEG, kind "photo", src "hunt", con el
    color, el idioma y el día; nunca la imagen de 320×240 de la cámara) y quedan las 48 más nuevas. «Mi casa» (#/album/casa,
    de la portada del álbum) las enseña con el color en el idioma de ahora, su IPA y el altavoz (su mp3). En Para mayores
    (tras la Puerta), «Borrar las fotos de Mi casa» con dos toques las borra todas sin tocar las grabaciones del Buzón; y
    «Mi casa» se queda vacía, con un botón para cazar."""
    probs = []
    page = _page()
    try:
        _open(page)
        # 49 fotos viejas del cazador y una grabación del Buzón
        page.evaluate("""async () => { const buf = new Uint8Array(10).buffer;
          for (let i = 0; i < 49; i++) await vocabMedia.put({id: 'hunt-old' + String(i).padStart(2, '0'), kind: 'photo', src: 'hunt', t: 1000 + i, type: 'image/jpeg', w: 192, h: 192, buf, color: 'blue', lang: 'en', day: '2026-01-01'});
          await vocabMedia.put({id: 'mb-keep', kind: 'mail', t: 5, type: 'audio/webm', dur: 1000, buf}); }""")
        _start(page)
        _, c = _find(page)
        page.wait_for_function("() => window.__found.length === 1", timeout=5000)
        recs = page.evaluate(_IDB)
        hunt = [r for r in recs if r.get("src") == "hunt"]
        mine = [r for r in hunt if not r["id"].startswith("hunt-old")]
        if len(hunt) != 48 or len(mine) != 1 or not any(r["id"] == "mb-keep" for r in recs):
            probs.append(f"fotos guardadas: {len(hunt)} del cazador, nuevas {len(mine)}, ids {sorted(r['id'] for r in recs)[:5]}…")
        if any(r["id"] in ("hunt-old00", "hunt-old01") for r in hunt):
            probs.append("no se borraron las más viejas")
        if mine:
            r = mine[0]
            want = {"kind": "photo", "src": "hunt", "type": "image/jpeg", "w": 192, "h": 192, "iw": 192, "ih": 192, "color": c, "lang": "en", "day": TODAY}
            got = {k: r.get(k) for k in want}
            if got != want or not r["id"].startswith("hunt-") or not (500 < r["bytes"] < 40000):
                probs.append(f"la foto: {r}")
            extra = set(r) - {"id", "kind", "src", "t", "type", "w", "h", "color", "lang", "day", "bytes", "iw", "ih"}
            if extra:
                probs.append(f"la foto lleva más cosas: {extra}")
        C.goto(page, "#/album")
        page.wait_for_selector(".hn-casa-r", timeout=5000)
        page.wait_for_function("() => /48 fotos/.test(document.querySelector('.hn-casa-r small').textContent)", timeout=5000)
        page.locator(".hn-casa-r").click()
        page.wait_for_selector("#hn-cg .hn-cc", timeout=6000)
        page.wait_for_timeout(300)
        casa = page.evaluate("""() => ({n: document.querySelectorAll('#hn-cg .hn-cc').length, h: document.getElementById('hn-ch-h').textContent,
          first: (() => { const li = document.querySelector('#hn-cg .hn-cc'); const i = li.querySelector('img');
            return {w: li.querySelector('b').textContent, lang: li.querySelector('b').lang, ipa: (li.querySelector('.ipa') || {}).textContent || '',
              say: li.querySelector('[data-say]').dataset.say, d: li.querySelector('.hn-cc-d').textContent, ok: i.complete && i.naturalWidth === 192, alt: i.alt}; })(),
          tab: document.documentElement.dataset.tab, back: document.getElementById('dv-back').textContent.trim(), focus: document.documentElement.dataset.focus || ''})""")
        f = casa["first"]
        if casa["n"] != 48 or casa["h"] != "Mi casa" or f["w"] != WORD["english"][c] or f["lang"] != "en-GB" or "/" not in f["ipa"] or f["d"] != "hoy" or not f["ok"] or ES[c] not in f["alt"]:
            probs.append(f"«Mi casa»: {casa}")
        if casa["tab"] != "jugar" or "Álbum" not in casa["back"] or casa["focus"]:
            probs.append(f"«Mi casa» no cuelga del álbum: {casa}")
        p0 = len(page.evaluate("() => window.__played"))
        page.locator("#hn-cg .hn-cc [data-say]").first.click()
        mp3 = f"{CLIPS['en'][WORD['english'][c]]}.mp3"
        page.wait_for_function("([m, n]) => window.__played.slice(n).some(x => x.src.endsWith(m))", arg=[mp3, p0], timeout=4000)
        page.evaluate("() => setLang('dansk')")
        page.wait_for_function("w => document.querySelector('#hn-cg .hn-cc b').textContent === w", arg=WORD["dansk"][c], timeout=5000)
        page.evaluate("() => setLang('english')")
        page.wait_for_selector("#hn-cg .hn-cc", timeout=5000)
        # Para mayores
        page.evaluate("() => { openSettings('mayores'); }")
        _pass_gate(page)
        page.wait_for_selector("#aj-hn:not([hidden]) #aj-hn-del", timeout=5000)
        page.wait_for_timeout(300)
        ds = page.locator("#aj-hn-ds").text_content()
        if not ds.startswith("48 fotos en este aparato"):
            probs.append(f"fila de borrar: {ds!r}")
        page.locator("#aj-hn-del").click()
        page.wait_for_timeout(500)
        if "Toca otra vez" not in page.locator("#aj-hn-ds").text_content():
            probs.append("el primer toque no pide confirmación")
        page.locator("#aj-hn-del").click()
        page.wait_for_function("() => /Hecho/.test(document.getElementById('aj-hn-ds').textContent)", timeout=5000)
        recs = page.evaluate(_IDB)
        if [r["id"] for r in recs] != ["mb-keep"]:
            probs.append(f"tras borrar queda: {[r['id'] for r in recs]}")
        page.evaluate("() => vocabSettings.close()")
        page.wait_for_function("() => !document.querySelector('dialog#ajustes[open]')", timeout=4000)
        C.goto(page, "#/album")
        C.goto(page, "#/album/casa")
        page.wait_for_selector("#hn-casa .hn-ce", timeout=5000)
        e = page.evaluate("() => ({n: document.querySelectorAll('#hn-cg .hn-cc').length, go: document.querySelector('.hn-ce a').getAttribute('href'), row: vocabHunter.count()})")
        if e != {"n": 0, "go": "#/cazador", "row": 0}:
            probs.append(f"«Mi casa» vacía: {e}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- sin cámara
def test_permission_denied_goes_to_tap_mode():
    """Permiso denegado: el modo tocar con un aviso gris («La cámara no tiene permiso…»), sin volver a ofrecer la cámara.
    4 dibujos (uno de cada color, el pedido entre ellos). Acertar: ✓ verde, award(1) y la palabra; fallar: el dibujo en
    gris con ✗ (nunca rojo) y el bueno con ✓, sin monedas. Con las teclas 1-4 y Intro también. Sin cámara en el
    navegador o sin aparato, lo mismo con su aviso; y «Jugar tocando» desde el principio no pide la cámara."""
    probs = []
    page = _page()
    try:
        _open(page)
        page.evaluate("() => { window.__cam.deny = true; }")
        page.locator("#hn-start").click()
        page.wait_for_selector(".hn-opt", timeout=5000)
        page.wait_for_timeout(300)
        s = _st(page)
        ui = page.evaluate("""() => ({note: (document.getElementById('hn-note') || {}).textContent || '', cam: !!document.getElementById('hn-cam'),
          opts: [...document.querySelectorAll('.hn-opt')].map(b => b.dataset.c), keys: [...document.querySelectorAll('.hn-opt')].map(b => b.dataset.key),
          imgs: [...document.querySelectorAll('.hn-opt img')].every(i => i.alt === '' && i.getAttribute('src').startsWith('img/')),
          bg: getComputedStyle(document.getElementById('hn-note')).backgroundColor})""")
        if s["mode"] != "tap" or not s["cam"]["denied"] or "no tiene permiso" not in ui["note"] or ui["cam"]:
            probs.append(f"denegado: {s['mode']} {s['cam']} {ui}")
        if sorted(ui["opts"]) != sorted(HEX) or ui["keys"] != ["1", "2", "3", "4"] or not ui["imgs"]:
            probs.append(f"dibujos: {ui}")
        c = s["color"]
        i = ui["opts"].index(c)
        page.keyboard.press(str(i + 1))
        page.wait_for_timeout(500)
        r = page.evaluate("""() => { const b = document.querySelector('.hn-opt.is-ok'); return {ok: b && b.dataset.c, chk: !!(b && b.querySelector('svg.chk')),
          ring: b && getComputedStyle(b).boxShadow, got: (document.getElementById('hn-got') || {}).textContent || ''}; }""")
        if r["ok"] != c or not r["chk"] or "¡Muy bien!" not in r["got"]:
            probs.append(f"acertar: {r}")
        if page.evaluate("() => window.__aw") != [[1, "¡Muy bien!", False, True]]:
            probs.append(f"acertar paga 1: {page.evaluate('() => window.__aw')}")
        page.keyboard.press("Enter")
        page.wait_for_timeout(400)
        s = _st(page)
        if s["i"] != 1 or s["step"] != "ask":
            probs.append(f"Intro no pasa al siguiente: {s}")
        c = s["color"]
        wrong = page.evaluate("c => [...document.querySelectorAll('.hn-opt')].find(b => b.dataset.c !== c).dataset.c", c)
        page.locator(f'.hn-opt[data-c="{wrong}"]').click()
        page.wait_for_timeout(500)
        r = page.evaluate("""() => { const m = document.querySelector('.hn-opt.is-miss'), k = document.querySelector('.hn-opt.is-ok');
          const rgb = s => (s.match(/\\d+(\\.\\d+)?/g) || []).slice(0, 3).map(Number);
          return {miss: m && m.dataset.c, x: !!(m && m.querySelector('svg.xm')), ok: k && k.dataset.c, bg: rgb(getComputedStyle(m).backgroundColor),
            mk: rgb(getComputedStyle(m.querySelector('.hn-mk')).backgroundColor), got: document.getElementById('hn-got').textContent,
            anim: document.getAnimations().filter(a => a.effect && a.effect.target === m).length}; }""")
        gray = lambda v: max(v) - min(v) <= 12
        if r["miss"] != wrong or not r["x"] or r["ok"] != c or not gray(r["bg"]) or not gray(r["mk"]) or r["anim"]:
            probs.append(f"fallar: {r}")
        if ES[c] not in r["got"] or WORD["english"][c] not in r["got"]:
            probs.append(f"tras fallar no enseña el bueno: {r['got']!r}")
        if len(page.evaluate("() => window.__aw")) != 1 or _st(page)["res"].get(c) != "miss":
            probs.append("fallar pagó o no contó como fallo")
        probs += C.errors(page)
    finally:
        page.context.close()
    for cam, err, want in (("none", "", "Aquí no se puede usar la cámara"), ("canvas", "NotFoundError", "No encuentro ninguna cámara"),
                           ("canvas", "NotReadableError", "ocupada")):
        page = _page(cam=cam)
        try:
            _open(page)
            if cam == "none":
                ui = page.evaluate("""() => ({note: (document.getElementById('hn-note') || {}).textContent || '', start: !!document.getElementById('hn-start'),
                  pri: document.getElementById('hn-tap0').classList.contains('glass-btn--pri')})""")
                if want not in ui["note"] or ui["start"] or not ui["pri"]:
                    probs.append(f"sin cámara en el navegador: {ui}")
                page.locator("#hn-tap0").click()
            else:
                page.evaluate("e => { window.__cam.err = e; }", err)
                page.locator("#hn-start").click()
            page.wait_for_selector(".hn-opt", timeout=5000)
            note = page.evaluate("() => (document.getElementById('hn-note') || {}).textContent || ''")
            if cam != "none" and want not in note:
                probs.append(f"{err}: aviso {note!r}")
            probs += [f"{cam}/{err}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    page = _page()
    try:
        _open(page)
        page.locator("#hn-tap0").click()
        page.wait_for_selector(".hn-opt", timeout=5000)
        page.wait_for_timeout(500)
        if page.evaluate("() => window.__cam.calls") or not page.locator("#hn-cam").count():
            probs.append("«Jugar tocando» pidió la cámara o no deja volver a ella")
        page.locator("#hn-cam").click()
        page.wait_for_function("() => vocabHunter.state().cam.on", timeout=5000)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- apagar la cámara
def test_tracks_stop_on_leaving_hiding_tap_and_end():
    """Las pistas de la cámara se paran (readyState "ended") al salir con la ✕, con Atrás del navegador, al ocultar la
    pestaña (y entonces «La cámara está en pausa» con «Seguir», que la vuelve a encender), al pasar a «Jugar tocando» y
    al acabar la ronda. Si el permiso llega cuando ya se ha salido, la pista se para enseguida."""
    probs = []
    page = _page()
    try:
        _open(page, hash="#/juegos")
        page.wait_for_selector('.gm-card[data-g="cazador"]', timeout=5000)
        page.locator('.gm-card[data-g="cazador"]').click()
        page.wait_for_selector("#hn-start", timeout=8000)
        _start(page)
        page.locator("#fx-x").click()
        page.wait_for_function("() => location.hash === '#/juegos'", timeout=5000)
        page.wait_for_timeout(300)
        if page.evaluate(_TRACKS) != [["ended"]] or _st(page)["cam"]["on"]:
            probs.append(f"✕: {page.evaluate(_TRACKS)}")
        # Atrás del navegador
        page.locator('.gm-card[data-g="cazador"]').click()
        page.wait_for_selector("#hn-start", timeout=8000)
        _start(page)
        page.go_back()
        page.wait_for_function("() => location.hash === '#/juegos'", timeout=5000)
        page.wait_for_timeout(300)
        if page.evaluate(_LIVE):
            probs.append(f"Atrás: {page.evaluate(_TRACKS)}")
        # ocultar la pestaña
        page.go_forward()
        page.wait_for_selector("#hn-start", timeout=8000)
        _start(page)
        page.evaluate(_HIDE, True)
        page.wait_for_timeout(300)
        if page.evaluate(_LIVE) or not page.locator("#hn-pause").count() or not _st(page)["cam"]["paused"]:
            probs.append(f"pestaña oculta: {page.evaluate(_TRACKS)} {_st(page)['cam']}")
        page.evaluate(_HIDE, False)
        page.wait_for_timeout(300)
        if page.evaluate(_LIVE):
            probs.append("al volver a la pestaña la cámara se encendió sola")
        n = page.evaluate("() => window.__cam.calls")
        page.locator("#hn-resume").click()
        page.wait_for_function("n => window.__cam.calls === n + 1 && vocabHunter.state().cam.on", arg=n, timeout=5000)
        if page.evaluate(_LIVE) != 1 or page.locator("#hn-pause").count():
            probs.append("«Seguir» no vuelve a encender la cámara")
        # jugar tocando
        page.locator("#hn-tap").click()
        page.wait_for_selector(".hn-opt", timeout=4000)
        if page.evaluate(_LIVE):
            probs.append("al pasar a tocar la cámara sigue encendida")
        # una ronda entera con la cámara
        page.locator("#hn-cam").click()
        page.wait_for_function("() => vocabHunter.state().cam.on", timeout=5000)
        while _st(page)["view"] == "play":
            if not page.locator("#hn-next").count():
                _find(page)
            page.locator("#hn-next").click()
            page.wait_for_timeout(250)
        page.wait_for_selector(".hn-end", timeout=4000)
        if page.evaluate(_LIVE):
            probs.append(f"al acabar la ronda: {page.evaluate(_TRACKS)}")
        end = page.evaluate("() => window.__end")
        if not end or end[-1]["found"] < 3:
            probs.append(f"hunt-end: {end}")
        # el permiso llega cuando ya se salió
        page.locator("#hn-again").click()
        page.wait_for_timeout(300)
        page.locator("#hn-tap").click() if page.locator("#hn-tap").count() else None
        page.evaluate("() => { window.__cam.delay = 900; }")
        page.locator("#hn-cam").click()
        page.wait_for_timeout(100)
        page.locator("#fx-x").click()
        page.wait_for_timeout(1500)
        if page.evaluate(_LIVE):
            probs.append(f"el permiso llegó tarde y la cámara se quedó encendida: {page.evaluate(_TRACKS)}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la cámara falsa de Chromium
def _y4m(path, yuv, w=320, h=240, n=12):
    y, u, v = yuv
    with open(path, "wb") as f:
        f.write(f"YUV4MPEG2 W{w} H{h} F15:1 Ip A1:1 C420jpeg\n".encode())
        for _ in range(n):
            f.write(b"FRAME\n" + bytes([y]) * (w * h) + bytes([u]) * (w * h // 4) + bytes([v]) * (w * h // 4))


def test_chromium_fake_camera_device():
    """Con la cámara falsa de Chromium (un vídeo .y4m rojo liso) y el permiso ya dado: se salta la frase y la cámara se
    enciende sola, pide la de atrás (facingMode environment), mide rojo y, al pedir el rojo, lo encuentra y guarda el
    recorte de 192×192; al salir la pista se para."""
    probs = []
    tmp = Path(tempfile.mkdtemp(prefix="vocab-y4m-"))
    vid = tmp / "red.y4m"
    _y4m(vid, (81, 90, 240))
    C.browser()
    fb = C._PW.chromium.launch(executable_path=C.CHROME, args=["--autoplay-policy=no-user-gesture-required", "--mute-audio",
                               "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", f"--use-file-for-fake-video-capture={vid}"])
    orig = C.browser
    C.browser = lambda: fb
    try:
        ctx = C.new_context("phone", permissions=["camera"])
    finally:
        C.browser = orig
    try:
        ctx.add_init_script(f"{_TTS}({json.dumps({'voices': VOICES})})")
        ctx.add_init_script(_MEDIA)
        ctx.add_init_script("""(() => { window.__gum = []; const md = navigator.mediaDevices; if (!md) return; const g = md.getUserMedia.bind(md);
          md.getUserMedia = c => { window.__gum.push(JSON.parse(JSON.stringify(c))); return g(c).then(s => { (window.__tr = window.__tr || []).push(...s.getTracks()); return s; }); }; })()""")
        page = ctx.new_page()
        C._attach(page, ctx._vocab_base)
        C.seed(page, keys=_keys(), hash="#/cazador")
        page.wait_for_selector("#hn", timeout=10000)
        page.evaluate(_SPY)
        page.wait_for_function("() => { const s = vocabHunter.state(); return s.cam.on && s.reading && s.reading.top === 'red'; }", timeout=8000)
        s = _st(page)
        if s["cam"]["perm"] != "granted" or page.locator(".hn-intro").count():
            probs.append(f"con permiso no debería salir la frase: {s['cam']}")
        g = page.evaluate("() => window.__gum")
        if not g or g[0].get("video", {}).get("facingMode") != {"ideal": "environment"} or g[0].get("audio") is not False:
            probs.append(f"getUserMedia: {g}")
        if s["reading"]["frac"]["red"] < 0.9:
            probs.append(f"lectura del rojo: {s['reading']}")
        for _ in range(4):
            if _st(page)["color"] == "red":
                break
            page.locator("#hn-skip").click()
            page.wait_for_timeout(200)
        page.wait_for_function("() => vocabHunter.state().step === 'found'", timeout=6000)
        page.wait_for_function("() => window.__found.length === 1", timeout=5000)
        recs = [r for r in page.evaluate(_IDB) if r.get("src") == "hunt"]
        if len(recs) != 1 or (recs[0]["iw"], recs[0]["ih"], recs[0]["color"]) != (192, 192, "red"):
            probs.append(f"recorte con la cámara falsa: {recs}")
        page.locator("#fx-x").click()
        page.wait_for_timeout(500)
        if page.evaluate("() => (window.__tr || []).filter(t => t.readyState === 'live').length"):
            probs.append("la pista de la cámara falsa sigue encendida al salir")
        probs += C.errors(page)
    finally:
        ctx.close()
        fb.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- dibujos grandes en el móvil
def test_drawings_big_on_phones():
    """A 360 y a 390 px de ancho los dibujos se ven grandes: los del modo tocar ≥ 110 px, el de antes de la cámara
    ≥ 150 px, el cuadro de la cámara ≥ 150 px, las fotos de «Mi casa» ≥ 140 px y las del final ≥ 120 px; nada se sale
    por los lados."""
    probs = []
    for w, h in ((360, 780), (390, 844)):
        page = _page(viewport={"width": w, "height": h})
        try:
            _open(page)
            pic = _box(page, ".hn-in-pic")
            if not pic or min(pic[0]) < 150:
                probs.append(f"{w}: dibujo de antes de la cámara {pic}")
            _start(page)
            fr = _box(page, "#hn-frame")
            if not fr or min(fr[0]) < 150:
                probs.append(f"{w}: cuadro de la cámara {fr}")
            _find(page)
            page.locator("#hn-next").click()
            page.wait_for_timeout(200)
            page.locator("#hn-tap").click()
            page.wait_for_selector(".hn-opt img", timeout=4000)
            imgs = page.evaluate("""() => [...document.querySelectorAll('.hn-opt img')].map(i => { const r = i.getBoundingClientRect(),
              k = Math.min(r.width / (i.naturalWidth || 1), r.height / (i.naturalHeight || 1)); return Math.round(Math.min(i.naturalWidth * k, i.naturalHeight * k)); })""")
            if not imgs or min(imgs) < 110:
                probs.append(f"{w}: dibujos del modo tocar {imgs}")
            while _st(page)["view"] == "play":
                if page.locator("#hn-next").count():
                    page.locator("#hn-next").click()
                else:
                    page.locator(f'.hn-opt[data-c="{_st(page)["color"]}"]').click()
                page.wait_for_timeout(250)
            page.wait_for_selector(".hn-end", timeout=4000)
            end = _box(page, ".hn-end-pic")
            if not end or min(min(x) for x in end) < 120:
                probs.append(f"{w}: final {end}")
            C.goto(page, "#/album/casa")
            page.wait_for_selector("#hn-cg .hn-cc img", timeout=5000)
            ph = _box(page, ".hn-cc-pic img")
            if not ph or min(ph[0]) < 140:
                probs.append(f"{w}: foto de «Mi casa» {ph}")
            for hsh in ("#/album/casa", "#/cazador"):
                C.goto(page, hsh)
                page.wait_for_timeout(300)
                sw = page.evaluate("() => document.documentElement.scrollWidth - innerWidth")
                if sw > 0:
                    probs.append(f"{w} {hsh}: se sale {sw} px por el lado")
            probs += [f"{w}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- partida exportada
def test_export_matches_baseline():
    """Mirar el cazador, jugar tocando sin contestar, la portada del álbum y «Mi casa» no cambia la partida exportada
    (igual que la base, sin claves nuevas). Cazar colores solo cambia las monedas (game): "hunt:st" es solo de este
    aparato (DEVICE_ONLY) y las fotos están en IndexedDB, fuera de la exportación."""
    probs = []
    base = C.load_baseline()
    assert base, "falta tests/e2e/baseline/export.json"
    page = _page()
    try:
        _open(page, hash="#/juegos")
        C.goto(page, "#/cazador")
        page.wait_for_selector("#hn-tap0", timeout=6000)
        page.locator("#hn-tap0").click()
        page.wait_for_selector(".hn-opt", timeout=4000)
        C.goto(page, "#/album")
        C.goto(page, "#/album/casa")
        page.wait_for_selector("#hn-casa", timeout=5000)
        C.goto(page, "#/")
        snap = C.export(page)
        d = C.diff_exports(base, snap, allow_new=False)
        if d:
            probs.append("mirar cambió la partida:\n  " + "\n  ".join(d))
        C.goto(page, "#/cazador")
        page.wait_for_selector("#hn-start", timeout=6000)
        _start(page)
        _find(page)
        page.wait_for_function("() => window.__found.length === 1", timeout=5000)
        C.goto(page, "#/")
        snap2 = C.export(page)
        nk = C.new_keys(base, snap2)
        if nk:
            probs.append(f"claves nuevas en la exportación: {nk}")
        changed = sorted(k for k in snap2["keys"] if k in snap["keys"] and snap2["keys"][k] != snap["keys"][k])
        if not set(changed) <= {"game", "act"}:
            probs.append(f"cazar cambió más que game: {changed}")
        txt = json.dumps(snap2, ensure_ascii=False)
        if "hunt" in txt:
            probs.append("algo del cazador va en la exportación")
        inv = page.evaluate("() => ({t: vocabSave.typeOf('hunt:st'), dev: vocabSave.inventory.deviceOnly.includes('hunt:st'), st: !!localStorage.getItem('hunt:st')})")
        if inv != {"t": None, "dev": True, "st": True}:
            probs.append(f"inventario de save.js: {inv}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- capturas
def test_captures_audit_a11y_reduced_motion():
    """Capturas en /mnt/project-files/rediseno/capturas/F6/ (F6k-*): antes de la cámara, buscando, encontrado, jugar
    tocando (con un fallo), el final, «Mi casa» con fotos y vacía, y la fila de Para mayores; móvil y escritorio, claro
    y oscuro, con «Reducir movimiento». En todas: contraste suficiente, sin colores fuera de la paleta, sin fallos de
    accesibilidad (a11y.js), sin animaciones de más de 160 ms y sin errores en la consola."""
    probs = []
    for kind in ("phone", "desk"):
        for scheme in ("light", "dark"):
            tag = f"F6k-{kind}-{scheme}"
            page = _page(kind, color_scheme=scheme, reduced_motion="reduce")
            try:
                _open(page)

                def snap(name, scope=("hn-",)):
                    page.evaluate(_FINISH)
                    page.wait_for_timeout(250)
                    a = page.evaluate(_AUDIT, {"what": ["contrast", "palette", "backdrop"]})
                    for x in a["contrast"] + a["palette"]:
                        if any(s in str(x) for s in scope):
                            probs.append(f"{tag}-{name}: {x}")
                    probs.extend(f"{tag}-{name}: {x}" for x in _a11y(page))
                    long = page.evaluate("""() => document.getAnimations().map(a => { const t = a.effect && a.effect.getComputedTiming();
                      return t && isFinite(t.endTime) ? t.endTime : 0; }).filter(ms => ms > 160)""")
                    if long:
                        probs.append(f"{tag}-{name}: animaciones de más de 160 ms con «Reducir movimiento»: {long}")
                    C.shot(page, f"{tag}-{name}", OUT, full_page=False)
                snap("antes")
                _start(page, "#7F7F7F")
                page.wait_for_timeout(700)
                snap("buscando")
                _find(page)
                page.wait_for_timeout(500)
                snap("encontrado")
                page.locator("#hn-next").click()
                page.wait_for_timeout(200)
                page.locator("#hn-tap").click()
                page.wait_for_selector(".hn-opt", timeout=4000)
                page.wait_for_timeout(300)
                snap("tocar")
                c = _st(page)["color"]
                page.locator(f'.hn-opt:not([data-c="{c}"])').first.click()
                page.wait_for_timeout(400)
                snap("tocar-fallo")
                while _st(page)["view"] == "play":
                    if page.locator("#hn-next").count():
                        page.locator("#hn-next").click()
                    else:
                        page.locator(f'.hn-opt[data-c="{_st(page)["color"]}"]').click()
                    page.wait_for_timeout(250)
                page.wait_for_selector(".hn-end", timeout=4000)
                snap("final")
                C.goto(page, "#/album/casa")
                page.wait_for_selector("#hn-cg .hn-cc", timeout=5000)
                snap("micasa")
                C.goto(page, "#/album")
                page.wait_for_selector(".hn-casa-r", timeout=5000)
                snap("album", scope=("hn-casa",))
                page.evaluate("() => { openSettings('mayores'); }")
                _pass_gate(page)
                page.wait_for_selector("#aj-hn:not([hidden])", timeout=5000)
                page.evaluate("() => document.getElementById('aj-hn').scrollIntoView({block: 'center'})")
                snap("mayores", scope=("aj-hn",))
                page.evaluate("() => vocabSettings.close()")
                page.wait_for_function("() => !document.querySelector('dialog#ajustes[open]')", timeout=4000)
                page.evaluate("() => vocabHunter.wipe()")
                C.goto(page, "#/album")
                C.goto(page, "#/album/casa")
                page.wait_for_selector("#hn-casa .hn-ce", timeout=5000)
                snap("micasa-vacia")
                probs += [f"{tag}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)
