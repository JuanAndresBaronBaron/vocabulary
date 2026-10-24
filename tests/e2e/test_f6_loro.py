"""F6h (SPEC §5-H): el loro eco y la cápsula del tiempo (js/parrot.js).

En la granja hay un loro posado en la valla de la derecha (grande en el móvil); tocarlo abre #/loro: una palabra del
repaso con su dibujo, la palabra, su IPA y su audio grabado. El botón grande graba (MediaRecorder); el loro lo repite con
voz aguda (Web Audio, playbackRate 1,6) y luego suena el audio nativo; se pintan dos ondas en <canvas>; salen de 1 a 3
estrellas (sin red ni reconocimiento de voz) y monedas por award(), una vez por palabra y con tope diario. La primera vez
que se entra en un mes nuevo se propone la cápsula del tiempo (5 palabras fijas, en IndexedDB "vocab-media-user" con
kind "capsule"); en Premios, «Tu voz en el tiempo» deja oír un mes frente a otro. «Borrar grabaciones y fotos» (Para
mayores, tras la Puerta) la vacía. Sin micrófono nada se bloquea. Nada de esto va en la exportación.

Micrófono y grabadora de mentira en Chromium, con el AudioContext de verdad: getUserMedia da un MediaStream real (un
oscilador que «habla» 0,7 s y luego calla, por createMediaStreamDestination) y MediaRecorder entrega un WAV hecho aquí
(sessionStorage "__wav": "voice" o "silent"); "__mic": "ok" | "deny" | "none" | "nomr" (sin MediaRecorder). Se espían
AudioBufferSourceNode.prototype.start (playbackRate) y HTMLMediaElement.prototype.play (data-rec de la cápsula)."""
from __future__ import annotations

import datetime as _dt
import json

import common as C

OUT = C.CAPTURAS / "F6"
_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
_A11Y_P = C.HERE / "a11y.js"
_PASS = "() => sessionStorage.setItem('vocab:gate', String(Date.now() + adultGate.MS))"

_MOCK = r"""
(() => {
  window.__gum = 0; window.__recs = 0; window.__stopped = 0; window.__starts = []; window.__played = []; window.__said = [];
  const ss = (k, d) => { try { return sessionStorage.getItem(k) || d; } catch (e) { return d; } };
  const mic = () => ss('__mic', 'ok'), wavMode = () => ss('__wav', 'voice');
  let FAC = null;
  /* un MediaStream de verdad: un oscilador que suena 0,7 s (o nada, con "silent") */
  function stream() {
    FAC = FAC || new AudioContext();
    try { FAC.resume(); } catch (e) {}
    const d = FAC.createMediaStreamDestination(), o = FAC.createOscillator(), g = FAC.createGain(), t = FAC.currentTime;
    o.frequency.value = 220;
    g.gain.setValueAtTime(wavMode() === 'silent' ? 0 : 0.6, t);
    g.gain.setValueAtTime(0, t + 0.7);
    o.connect(g); g.connect(d); o.start();
    const s = d.stream;
    s.getTracks().forEach(tr => { const st = tr.stop.bind(tr); tr.stop = () => { window.__stopped++; try { o.stop(); } catch (e) {} st(); }; });
    window.__stream = s;
    return s;
  }
  if (mic() === 'none') {
    Object.defineProperty(navigator, 'mediaDevices', {configurable: true, value: undefined});
  } else {
    Object.defineProperty(navigator, 'mediaDevices', {configurable: true, value: {getUserMedia() {
      window.__gum++;
      const m = mic();
      if (m === 'deny') return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
      if (m === 'nodev') return Promise.reject(new DOMException('Requested device not found', 'NotFoundError'));
      return Promise.resolve(stream());
    }}});
  }
  /* el WAV que «graba»: 0,15 s de silencio, 0,55 s de voz (220 Hz con envolvente) y 0,2 s de silencio */
  function wav(mode) {
    const sr = 16000, n = Math.round(sr * 0.9), pcm = new Int16Array(n);
    if (mode !== 'silent') for (let i = 0; i < n; i++) {
      const t = i / sr;
      if (t > 0.15 && t < 0.7) pcm[i] = Math.round(0.35 * Math.sin(Math.PI * (t - 0.15) / 0.55) * Math.sin(2 * Math.PI * 220 * t) * 32767);
    }
    const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, n * 2, true); new Int16Array(buf, 44).set(pcm);
    return new Blob([buf], {type: 'audio/wav'});
  }
  window.__wavBlob = wav;
  class FakeMR {
    constructor(s, o) { this.stream = s; this.mimeType = 'audio/wav'; this.asked = (o && o.mimeType) || ''; this.state = 'inactive'; window.__mr = this; window.__mrType = this.asked; }
    static isTypeSupported(t) { return /^audio\/(mp4|webm)/.test(t); }
    start() { this.state = 'recording'; window.__recs++; }
    stop() {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      const b = wav(wavMode());
      setTimeout(() => { if (this.ondataavailable) this.ondataavailable({data: b}); if (this.onstop) this.onstop(); }, 10);
    }
    requestData() {} pause() {} resume() {}
  }
  if (mic() === 'nomr') { try { delete window.MediaRecorder; } catch (e) {} window.MediaRecorder = undefined; }
  else window.MediaRecorder = FakeMR;
  const st0 = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) {
    window.__starts.push({rate: this.playbackRate.value, dur: this.buffer ? this.buffer.duration : 0, n: window.__starts.length});
    return st0.apply(this, a);
  };
  HTMLMediaElement.prototype.play = function () {
    window.__played.push({rec: this.dataset.rec || '', src: this.src, rate: this.playbackRate});
    setTimeout(() => this.dispatchEvent(new Event('ended')), 60);
    return Promise.resolve();
  };
  if (window.speechSynthesis) {
    speechSynthesis.speak = u => { window.__said.push({t: u.text, l: u.lang}); setTimeout(() => { if (u.onend) u.onend({}); }, 40); };
    speechSynthesis.cancel = () => {};
  }
})();
"""

_ST = "() => vocabParrot.state"
_COINS = "() => game().coins"
_CAPIDB = """async () => (await vocabMedia.list('capsule')).map(r => ({id: r.id, lang: r.lang, month: r.month, i: r.i, w: r.w,
  size: r.buf ? r.buf.byteLength : 0, type: r.type})).sort((a, b) => a.id < b.id ? -1 : 1)"""
_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""
_PAINT = """id => { const c = document.getElementById(id); if (!c || !c.width) return 0;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 200) n++; return n; }"""


def _page(kind="phone", mic="ok", wav="voice", **kw):
    page = C.new_page(kind, **kw)
    page.context.add_init_script(_MOCK)
    page._mic = mic
    page._wav = wav
    return page


def _seed(page, hash="#/granja", keys=None, parrot=None, now=C.FIXED_NOW):
    """La partida sembrada (con las fechas de now); parrot (dict) se escribe en parrot:st (por defecto, la cápsula de
    este mes ya propuesta, para que la hoja no salga en las pruebas que no son de la cápsula; False: nada)."""
    keys = dict(C.seed_keys(now)) if keys is None else dict(keys)
    if parrot is None:
        m = now.strftime("%Y-%m")
        parrot = {"v": 1, "cap": {"en": m, "fr": m, "da": m}}
    if parrot is not False:
        keys["parrot:st"] = json.dumps(parrot)
    keys = {k: (v if isinstance(v, str) else json.dumps(v, separators=(",", ":"), ensure_ascii=False)) for k, v in keys.items()}
    # como C.seed, y el micrófono de mentira elegido antes de que arranque la app (el guion de inicio lo lee al cargar)
    page.goto(C.base_url(page) + "/__blank", wait_until="domcontentloaded")
    page.evaluate("""([keys, m, w]) => { localStorage.clear(); sessionStorage.clear();
      for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v);
      sessionStorage.setItem('__mic', m); sessionStorage.setItem('__wav', w); }""", [keys, page._mic, page._wav])
    C.goto(page, hash)
    page.wait_for_timeout(200)


def _to_loro(page):
    """De la granja al loro tocando el loro de la valla."""
    if C.current_hash(page) != "granja":
        C.goto(page, "#/granja")
    page.wait_for_selector(".lr-perch", timeout=5000)
    page.locator(".lr-perch").click()
    page.wait_for_function("() => location.hash === '#/loro' && document.querySelector('#lr-rb, #lr-info')", timeout=8000)
    C.settle(page, 250)


def _record(page, timeout=12000):
    """Toca el botón grande y espera al resultado (el oscilador calla y para solo; el loro repite y suena el nativo)."""
    page.wait_for_function("() => ['idle', 'done'].includes(vocabParrot.state.st)", timeout=5000)
    page.locator("#lr-rb").click()
    page.wait_for_function("() => vocabParrot.state.st === 'rec'", timeout=5000)
    page.wait_for_function("() => vocabParrot.state.st === 'done'", timeout=timeout)
    page.evaluate(_FINISH)
    page.wait_for_timeout(700)
    return page.evaluate(_ST)


def _a11y(page):
    if not _A11Y_P.exists():
        return []
    a = page.evaluate(_A11Y_P.read_text(encoding="utf-8"), {})
    return [f"{k}: {x}" for k in ("names", "roles", "images", "targets", "ids", "dialogs", "focusable") for x in a.get(k, [])]


def _box(page, sel):
    return page.evaluate("""s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect();
      return {w: r.width, h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right}; }""", sel)


# ---------------------------------------------------------------- la granja y la pantalla
def test_parrot_on_farm_opens_screen():
    """En la granja, el loro está en la valla de la derecha, a la vista y grande (≥ 100 px en el móvil, a 360 y a 390),
    sin tapar la barra de herramientas. Tocarlo abre #/loro (pestaña Granja, «‹ Granja» para volver) con una palabra del
    repaso: su dibujo grande (≥ 110 px a 360 y 390), la palabra con su idioma, la IPA (ipaHtml), el español, el altavoz y la
    tortuga. Sin scroll horizontal y sin errores."""
    probs = []
    for kind, vp in (("phone", {"width": 390, "height": 844}), ("phone", {"width": 360, "height": 740}), ("desk", None)):
        tag = f"{kind}{vp['width'] if vp else ''}"
        page = _page(kind)
        if vp:
            page.set_viewport_size(vp)
        try:
            _seed(page)
            page.wait_for_selector(".lr-perch", timeout=5000)
            p, dock = _box(page, ".lr-perch img"), _box(page, ".fm-dock")
            W = page.evaluate("innerWidth")
            if not p or p["w"] < (100 if kind == "phone" else 120):
                probs.append(f"{tag}: el loro de la granja es pequeño: {p}")
            elif p["right"] > W or p["left"] < 0 or p["top"] < 0 or (dock and p["bottom"] > dock["top"]):
                probs.append(f"{tag}: el loro no se ve entero o tapa el dock: {p} dock {dock}")
            elif p["left"] < W / 2:
                probs.append(f"{tag}: el loro no está a la derecha: {p}")
            hit = page.evaluate("""() => { const b = document.querySelector('.lr-perch').getBoundingClientRect();
              const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 3); return !!(e && e.closest('.lr-perch')); }""")
            if not hit:
                probs.append(f"{tag}: algo tapa el loro de la granja")
            _to_loro(page)
            r = page.evaluate("""() => ({tab: (document.querySelector('.tab[aria-selected=true]') || {}).id || '', back: document.documentElement.hasAttribute('data-back'),
              backT: (document.querySelector('#dv-back > span') || {}).textContent || '', backH: (document.getElementById('dv-back') || {getAttribute: () => ''}).getAttribute('href'),
              word: (document.getElementById('lr-w') || {}).textContent || '', wl: (document.getElementById('lr-w') || {lang: ''}).lang,
              ipa: !!document.querySelector('.lr-ipa .ipa[lang]'), es: (document.querySelector('.lr-es') || {}).textContent || '',
              img: (document.querySelector('#lr-pic img') || {}).naturalWidth || 0, spk: !!document.getElementById('lr-spk'), slow: !!document.getElementById('lr-slow'),
              sw: document.documentElement.scrollWidth, iw: innerWidth, st: vocabParrot.state})""")
            if r["tab"] != "tab-granja" or not r["back"] or r["backT"] != "Granja" or r["backH"] != "#/granja":
                probs.append(f"{tag}: pestaña o «‹ Granja»: {r['tab']} {r['back']} {r['backT']!r} {r['backH']!r}")
            if not r["word"] or r["wl"] != "en-GB" or not r["ipa"] or not r["es"] or not r["img"] or not r["spk"] or not r["slow"]:
                probs.append(f"{tag}: a la palabra le falta algo: {r}")
            if r["sw"] > r["iw"]:
                probs.append(f"{tag}: scroll horizontal ({r['sw']} > {r['iw']})")
            pic = _box(page, "#lr-pic")
            if kind == "phone" and (not pic or pic["w"] < 110):
                probs.append(f"{tag}: el dibujo de la palabra es pequeño: {pic}")
            nx, tb = _box(page, "#lr-next"), _box(page, "#tabbar")
            if kind == "phone" and nx and tb and tb["top"] > 400 and nx["bottom"] > tb["top"]:
                probs.append(f"{tag}: «Otra palabra» queda bajo la barra de pestañas: {nx} {tb}")
            # el altavoz dice la palabra con su audio grabado
            n0 = len(page.evaluate("() => window.__played"))
            page.locator("#lr-spk").click()
            page.wait_for_timeout(300)
            pl = page.evaluate("() => window.__played")[n0:]
            if not any("/audio/en/" in x["src"] and x["src"].endswith(".mp3") for x in pl):
                probs.append(f"{tag}: el altavoz no suena con el mp3: {pl}")
            # «‹ Granja» vuelve a la granja
            page.locator("#dv-back").click()
            page.wait_for_function("() => location.hash === '#/granja'", timeout=5000)
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- grabar, eco, ondas y estrellas
def test_record_echo_native_waves_stars():
    """Tocar el botón grande graba (MediaRecorder con un tipo de la lista de js/mailbox.js, audio/mp4 primero); al callar
    para solo. Las pistas del micrófono se paran. El loro lo repite con Web Audio a playbackRate 1,6 (el eco) y después
    suena el nativo a 1 (su mp3, el mismo que al salir la palabra). Las dos ondas se pintan en sus canvas, con la misma
    escala (la más corta es más corta). Salen de 1 a 3 estrellas, con su texto y su etiqueta. Con Intro también graba."""
    probs = []
    page = _page()
    try:
        _seed(page)
        _to_loro(page)
        page.wait_for_function("() => window.__starts.length >= 1", timeout=5000)   # el loro dice la palabra al salir
        intro = page.evaluate("() => window.__starts.slice()")
        n0 = len(intro)
        st = _record(page)
        starts = page.evaluate("() => window.__starts")[n0:]
        rates = [round(x["rate"], 2) for x in starts]
        if rates[:2] != [1.6, 1.0]:
            probs.append(f"tras grabar no suena el eco a 1,6 y luego el nativo a 1: {starts}")
        elif abs(starts[1]["dur"] - intro[0]["dur"]) > .01:
            probs.append(f"el nativo no es el audio de la palabra: {starts[1]} vs {intro[0]}")
        if page.evaluate("() => window.__mrType") not in ("audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"):
            probs.append(f"tipo pedido a MediaRecorder: {page.evaluate('() => window.__mrType')!r}")
        tr = page.evaluate("() => ({stopped: window.__stopped, live: window.__stream ? window.__stream.getTracks().filter(t => t.readyState === 'live').length : -1})")
        if tr["stopped"] < 1 or tr["live"] != 0:
            probs.append(f"las pistas del micrófono siguen abiertas: {tr}")
        if not (1 <= st["stars"] <= 3) or not st["heard"]:
            probs.append(f"estrellas: {st}")
        bars = page.evaluate("() => [+document.getElementById('lr-cv-me').dataset.bars, +document.getElementById('lr-cv-nat').dataset.bars]")
        px = [page.evaluate(_PAINT, "lr-cv-me"), page.evaluate(_PAINT, "lr-cv-nat")]
        if min(bars) < 5 or min(px) < 50:
            probs.append(f"las dos ondas no se pintan: barras {bars}, píxeles {px}")
        me, nat = st["me"], st["nat"]
        # la misma escala: la más larga tiene más barras; si duran lo mismo, casi las mismas
        if me and nat and (abs(me["dur"] - nat["dur"]) > .06 and (me["dur"] < nat["dur"]) != (bars[0] < bars[1])
                           or abs(me["dur"] - nat["dur"]) < .02 and abs(bars[0] - bars[1]) > 2):
            probs.append(f"las ondas no tienen la misma escala: {me} {nat} {bars}")
        s = page.evaluate("""() => ({on: document.querySelectorAll('#lr-stars .lr-st.on').length, label: document.getElementById('lr-stars').getAttribute('aria-label'),
          hidden: document.getElementById('lr-stars').hidden, t: document.getElementById('lr-bt').textContent, pri: document.getElementById('lr-next').classList.contains('glass-btn--pri')})""")
        if s["hidden"] or s["on"] != st["stars"] or s["label"] != f"{st['stars']} de 3 estrellas" or not s["t"].strip() or not s["pri"]:
            probs.append(f"el resultado no se ve bien: {s} {st}")
        # «Otra vez» (el botón grande, con el resultado) graba la misma palabra
        w = st["word"]
        st2 = _record(page)
        if st2["word"] != w or not (1 <= st2["stars"] <= 3):
            probs.append(f"«Otra vez» cambió de palabra o sin estrellas: {st2}")
        # con el resultado, Intro (data-key del botón principal) pasa a otra palabra; sin él, Intro graba (sin foco en
        # un botón: con foco, Intro pulsa ese botón, como siempre)
        page.evaluate("() => document.activeElement && document.activeElement.blur()")
        page.keyboard.press("Enter")
        page.wait_for_function("""w => vocabParrot.state.st === 'idle' && vocabParrot.state.word !== w
          && document.getElementById('lr-rb').dataset.key === 'enter' && document.getElementById('lr-next').dataset.key === 'right'""", arg=w, timeout=3000)
        w2 = page.evaluate(_ST)["word"]
        page.wait_for_function("() => ['idle', 'done'].includes(vocabParrot.state.st)", timeout=5000)
        page.evaluate("() => document.activeElement && document.activeElement.blur()")
        page.keyboard.press("Enter")
        page.wait_for_function("() => vocabParrot.state.st === 'rec'", timeout=5000)
        page.wait_for_function("() => vocabParrot.state.st === 'done'", timeout=12000)
        if page.evaluate(_ST)["word"] != w2:
            probs.append("Intro sin resultado no grabó la palabra de la pantalla")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_hold_to_record_and_leave_stops_mic():
    """Mantener pulsado el botón graba hasta soltar (sin esperar al silencio). Irse a mitad de grabación para el
    micrófono (pistas paradas), no deja nada a medias y no da errores; cada URL.createObjectURL se libera."""
    probs = []
    page = _page("desk")
    page.context.add_init_script("""(() => { window.__urls = {c: 0, r: 0};
      const c = URL.createObjectURL.bind(URL), r = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = o => { window.__urls.c++; return c(o); }; URL.revokeObjectURL = u => { window.__urls.r++; return r(u); }; })();""")
    try:
        _seed(page, hash="#/loro")
        page.wait_for_selector("#lr-rb", timeout=5000)
        b = _box(page, "#lr-rb")
        page.mouse.move(b["left"] + b["w"] / 2, b["top"] + b["h"] / 2)
        page.mouse.down()
        page.wait_for_function("() => vocabParrot.state.st === 'rec'", timeout=5000)
        page.wait_for_timeout(1900)   # calla a los 0,7 s: manteniendo, sigue grabando
        if page.evaluate(_ST)["st"] != "rec":
            probs.append(f"manteniendo pulsado se paró solo: {page.evaluate(_ST)['st']}")
        page.mouse.up()
        page.wait_for_function("() => vocabParrot.state.st === 'done'", timeout=12000)
        if not page.evaluate(_ST)["heard"]:
            probs.append("lo grabado manteniendo pulsado no se oyó")
        # a mitad de grabación, a otra pantalla
        page.locator("#lr-rb").click()
        page.wait_for_function("() => vocabParrot.state.st === 'rec'", timeout=5000)
        C.goto(page, "#/granja")
        page.wait_for_timeout(400)
        tr = page.evaluate("() => ({stopped: window.__stopped, live: window.__stream.getTracks().filter(t => t.readyState === 'live').length, st: vocabParrot.state.st})")
        if tr["live"] or tr["st"] not in ("idle", "done"):
            probs.append(f"al irse, el micrófono sigue abierto o a medias: {tr}")
        # el eco por <audio> (sin Web Audio que lo lea) también libera su URL
        u = page.evaluate("() => window.__urls")
        if u["c"] != u["r"]:
            probs.append(f"URL.createObjectURL sin liberar: {u}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- monedas
def test_coins_once_per_word_with_daily_cap():
    """Las monedas llegan por award(): lo que suben las estrellas de esa palabra ese día (grabarla otra vez con las mismas
    no paga), con un tope de vocabParrot.DAY_CAP al día; un silencio da 1 estrella y nada de monedas (nunca castiga)."""
    probs = []
    page = _page()
    page.context.add_init_script("""document.addEventListener('DOMContentLoaded', () => { window.__aw = [];
      const a = window.award; window.award = function (n, ...r) { window.__aw.push(n); return a.call(this, n, ...r); }; });""")
    try:
        _seed(page)
        _to_loro(page)
        cap = page.evaluate("() => vocabParrot.DAY_CAP")
        if not (5 <= cap <= 20):
            probs.append(f"tope diario raro: {cap}")
        page.evaluate("() => { const g = game(); g.day = dayKey(new Date()); gameSet(g); }")   # sin el regalo del día por medio
        c0 = page.evaluate(_COINS)
        st = _record(page)
        c1 = page.evaluate(_COINS)
        if st["paid"] != st["stars"] or c1 - c0 != st["paid"]:
            probs.append(f"primera vez: pagó {st['paid']} por {st['stars']} estrellas, monedas {c0}→{c1}")
        st2 = _record(page)   # «Otra vez»: la misma palabra
        c2 = page.evaluate(_COINS)
        if st2["word"] != st["word"] or (st2["stars"] <= st["stars"] and (st2["paid"] or c2 != c1)):
            probs.append(f"la misma palabra pagó otra vez: {st2} monedas {c1}→{c2}")
        # cerca del tope: solo lo que falta
        page.evaluate("cap => { const s = JSON.parse(localStorage.getItem('parrot:st')); s.day.c = cap - 1; localStorage.setItem('parrot:st', JSON.stringify(s)); }", cap)
        page.locator("#lr-next").click()
        page.wait_for_timeout(300)
        st3 = _record(page)
        c3 = page.evaluate(_COINS)
        if st3["word"] == st["word"] or st3["paid"] != min(1, st3["stars"]) or c3 - c2 != st3["paid"]:
            probs.append(f"cerca del tope: {st3} monedas {c2}→{c3}")
        page.locator("#lr-next").click()
        page.wait_for_timeout(300)
        st4 = _record(page)
        if st4["paid"] or page.evaluate(_COINS) != c3:
            probs.append(f"con el tope lleno pagó: {st4}")
        day = page.evaluate("() => JSON.parse(localStorage.getItem('parrot:st')).day")
        if day["c"] != cap or day["d"] != "2026-03-11":
            probs.append(f"parrot:st.day: {day}")
        # silencio: 1 estrella, sin monedas, con un texto amable
        page.evaluate("() => sessionStorage.setItem('__wav', 'silent')")
        page.evaluate("() => { const s = JSON.parse(localStorage.getItem('parrot:st')); s.day.c = 0; localStorage.setItem('parrot:st', JSON.stringify(s)); }")
        page.locator("#lr-next").click()
        page.wait_for_timeout(300)
        c4 = page.evaluate(_COINS)
        s5 = _record(page)
        t = page.evaluate("() => document.getElementById('lr-bt').textContent")
        if s5["stars"] != 1 or s5["heard"] or s5["paid"] or page.evaluate(_COINS) != c4 or "No te he oído" not in t:
            probs.append(f"un silencio: {s5} {t!r}")
        if page.evaluate("() => document.querySelectorAll('#lr-stars .lr-st.on').length") != 1:
            probs.append("un silencio no enseña 1 estrella")
        aw = page.evaluate("() => window.__aw")
        if sum(aw) != c3 - c0 or any(n <= 0 for n in aw):
            probs.append(f"monedas fuera de award() o award(0): {aw} vs {c3 - c0}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la cápsula
APR1 = _dt.datetime(2026, 4, 1, 10, 0, tzinfo=C.FIXED_NOW.tzinfo)


def test_capsule_offered_on_new_month_once():
    """El primer día de un mes (abril), la primera vez que entra al loro, sale la hoja «Cápsula del tiempo» con las 5
    palabras (dibujos grandes); «Luego» la cierra y no vuelve ese mes (ni al volver ni al recargar). Desde el pie se
    graba: las 5 palabras, una tras otra, van a IndexedDB (kind "capsule", sin subir la versión de la base) y se pide
    navigator.storage.persist() al guardar la primera. Al acabar, «¡Cápsula de abril guardada!» y «Ver en Premios»."""
    probs = []
    page = _page(now=APR1)
    page.context.add_init_script("""(() => { window.__persist = 0; try { const s = navigator.storage;
      if (s) s.persist = () => { window.__persist++; return Promise.resolve(true); }; } catch (e) {} })();""")
    try:
        _seed(page, hash="#/loro", parrot={"v": 1, "cap": {"en": "2026-03"}}, now=APR1)
        page.wait_for_selector("dialog#lr-offer[open]", timeout=6000)
        page.wait_for_timeout(500)
        o = page.evaluate("""() => ({n: document.querySelectorAll('#lr-offer .lr-of-ws li').length, t: document.getElementById('lr-of-t').textContent,
          w: [...document.querySelectorAll('#lr-offer .lr-of-w')].map(e => e.textContent), px: Math.min(...[...document.querySelectorAll('#lr-offer .lr-of-p')].map(e => e.getBoundingClientRect().width)),
          noRenew: document.getElementById('lr-offer').hasAttribute('data-no-renew')})""")
        if o["n"] != 5 or o["t"] != "Cápsula del tiempo" or o["w"] != ["dog", "cat", "red", "apple", "rabbit"] or o["px"] < 80 or not o["noRenew"]:
            probs.append(f"la hoja de la cápsula: {o}")
        if page.evaluate("() => JSON.parse(localStorage.getItem('parrot:st')).cap.en") != "2026-04":
            probs.append("no se apunta que ya se propuso en abril")
        page.locator("#lr-offer [data-close]").click()
        page.wait_for_function("() => !document.getElementById('lr-offer').open", timeout=3000)
        C.goto(page, "#/granja")
        C.goto(page, "#/loro")
        page.wait_for_timeout(800)
        if page.evaluate("() => !!document.querySelector('dialog#lr-offer[open]')"):
            probs.append("la cápsula se propone otra vez el mismo mes")
        C.reload(page)
        page.wait_for_timeout(800)
        if page.evaluate("() => !!document.querySelector('dialog#lr-offer[open]')"):
            probs.append("la cápsula se propone otra vez al recargar")
        # grabarla desde el pie
        page.wait_for_selector("#lr-cap-go", timeout=5000)
        if "abril" not in page.locator("#lr-cap-go").text_content():
            probs.append(f"pie: {page.locator('#lr-cap-go').text_content()!r}")
        page.locator("#lr-cap-go").click()
        page.wait_for_function("() => vocabParrot.state.mode === 'cap'", timeout=5000)
        words = []
        for i in range(5):
            st = _record(page)
            words.append(st["word"])
            if i == 0 and page.evaluate("() => window.__persist") < 1:
                probs.append("no se pide navigator.storage.persist() al guardar la primera")
            nt = page.locator("#lr-next-t").text_content()
            if nt != ("Terminar" if i == 4 else "Siguiente"):
                probs.append(f"botón de seguir en la palabra {i + 1}: {nt!r}")
            page.locator("#lr-next").click()
            page.wait_for_timeout(300)
        if words != ["dog", "cat", "red", "apple", "rabbit"]:
            probs.append(f"palabras de la cápsula: {words}")
        page.wait_for_selector(".lr-done", timeout=4000)
        if "¡Cápsula de abril guardada!" not in page.locator(".lr-done-t").text_content() or not page.locator("#lr-prem").is_visible():
            probs.append(f"final de la cápsula: {page.locator('.lr-done').text_content()!r}")
        recs = page.evaluate(_CAPIDB)
        ids = [r["id"] for r in recs]
        if ids != [f"cap-en-2026-04-{i}" for i in range(5)] or any(r["size"] < 1000 or r["lang"] != "en" for r in recs):
            probs.append(f"en IndexedDB: {recs}")
        dbs = page.evaluate("async () => (await indexedDB.databases()).map(d => [d.name, d.version])")
        if ["vocab-media-user", 1] not in dbs:
            probs.append(f"bases de datos: {dbs}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


_PUT2 = """async () => {
  const mk = () => window.__wavBlob('voice').arrayBuffer();
  const W = {0: 'dog', 1: 'cat', 2: 'red', 3: 'apple', 4: 'rabbit'};
  for (const m of ['2025-10', '2026-01']) for (let i = 0; i < 5; i++)
    await vocabMedia.put({id: `cap-en-${m}-${i}`, kind: 'capsule', t: Date.parse(m + '-05T10:00:00'), type: 'audio/wav', dur: 900, buf: await mk(),
      lang: 'en', month: m, i, ref: '', w: W[i]});
}"""


def test_premios_hear_two_months():
    """Con la cápsula de octubre y la de enero, Premios enseña «Tu voz en el tiempo»: «Tú en octubre» suena las 5 de
    octubre, «Tú en enero» las 5 de enero, y cada palabra suena antes y ahora. Tocar otra vez lo para. Las URL de los
    audios se liberan. Sin cápsula, la tarjeta no está."""
    probs = []
    page = _page()
    page.context.add_init_script("""(() => { window.__urls = {c: 0, r: 0};
      const c = URL.createObjectURL.bind(URL), r = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = o => { window.__urls.c++; return c(o); }; URL.revokeObjectURL = u => { window.__urls.r++; return r(u); }; })();""")
    try:
        _seed(page, hash="#/progreso")
        page.wait_for_timeout(500)
        if page.locator("#rw-voz .lr-tc").count() or page.locator("#rw-voz").is_visible():
            probs.append("sin cápsula, la tarjeta sale en Premios")
        page.evaluate(_PUT2)
        C.goto(page, "#/granja")
        C.goto(page, "#/progreso")
        page.wait_for_selector("#rw-voz:not([hidden]) .lr-tc", timeout=5000)
        t = page.evaluate("() => [...document.querySelectorAll('#rw-voz .lr-tb')].map(b => b.textContent.trim())")
        if t != ["Tú en octubre", "Tú en enero"] or page.locator("#lr-tc-h").text_content() != "Tu voz en el tiempo":
            probs.append(f"botones de la tarjeta: {t}")
        n0 = len(page.evaluate("() => window.__played"))
        page.locator("#rw-voz .lr-tb").first.click()
        page.wait_for_function(f"() => window.__played.length >= {n0 + 5}", timeout=8000)
        page.wait_for_timeout(500)
        got = [x["rec"] for x in page.evaluate("() => window.__played")[n0:]]
        if got != [f"cap-en-2025-10-{i}" for i in range(5)]:
            probs.append(f"«Tú en octubre» suena: {got}")
        n1 = len(page.evaluate("() => window.__played"))
        page.locator("#rw-voz .lr-tb.is-b").click()
        page.wait_for_function(f"() => window.__played.length >= {n1 + 5}", timeout=8000)
        page.wait_for_timeout(500)
        got = [x["rec"] for x in page.evaluate("() => window.__played")[n1:]]
        if got != [f"cap-en-2026-01-{i}" for i in range(5)]:
            probs.append(f"«Tú en enero» suena: {got}")
        n2 = len(page.evaluate("() => window.__played"))
        page.locator("#rw-voz .lr-tw[data-i='3']").click()
        page.wait_for_function(f"() => window.__played.length >= {n2 + 2}", timeout=5000)
        page.wait_for_timeout(500)
        got = [x["rec"] for x in page.evaluate("() => window.__played")[n2:]]
        if got != ["cap-en-2025-10-3", "cap-en-2026-01-3"]:
            probs.append(f"«apple» antes y ahora: {got}")
        u = page.evaluate("() => window.__urls")
        if u["c"] < 12 or u["c"] != u["r"]:
            probs.append(f"URL de los audios sin liberar: {u}")
        probs += _a11y(page)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_delete_in_para_mayores_empties_capsule():
    """En Para mayores (tras resolver la Puerta), «Borrar grabaciones y fotos» cuenta también la cápsula y, con dos
    toques, la borra: Premios se queda sin la tarjeta y el loro vuelve a ofrecer grabarla (el pie)."""
    probs = []
    page = _page()
    try:
        from test_f5_buzon import _pass_gate
        _seed(page, hash="#/progreso")
        page.evaluate(_PUT2)
        C.goto(page, "#/granja")
        C.goto(page, "#/progreso")
        page.wait_for_selector("#rw-voz:not([hidden]) .lr-tc", timeout=5000)
        page.evaluate("() => { openSettings('mayores'); }")
        _pass_gate(page)
        page.wait_for_selector("#aj-mb-del:not([hidden])", timeout=5000)
        page.wait_for_timeout(400)
        if page.locator("#aj-mb-ds").text_content() != "10 grabaciones en este aparato.":
            probs.append(f"fila de borrar: {page.locator('#aj-mb-ds').text_content()!r}")
        page.locator("#aj-mb-del").click()
        page.wait_for_timeout(500)
        page.locator("#aj-mb-del").click()
        page.wait_for_function("() => /Hecho/.test(document.getElementById('aj-mb-ds').textContent)", timeout=5000)
        page.evaluate("() => vocabSettings.close()")
        page.wait_for_function("() => !document.querySelector('dialog#ajustes[open]')", timeout=4000)
        page.wait_for_timeout(500)
        if page.locator("#rw-voz .lr-tc").count() or page.evaluate(_CAPIDB):
            probs.append("tras borrar queda la cápsula")
        C.goto(page, "#/loro")
        page.wait_for_selector("#lr-cap-go", timeout=5000)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- sin micrófono
def test_without_microphone_nothing_blocks():
    """Sin micrófono (sin mediaDevices o sin MediaRecorder), con el permiso denegado o sin aparato: un aviso gris amable,
    el loro dice la palabra (su audio) y «¡Ya la dije!» (el botón principal) pasa a otra. Ni la hoja de la cápsula
    (aunque sea día 1) ni errores. Con el permiso denegado, «Probar otra vez» vuelve a pedirlo."""
    probs = []
    for mic in ("none", "nomr", "deny", "nodev"):
        page = _page(mic=mic, now=APR1)
        try:
            _seed(page, hash="#/loro", parrot={"v": 1, "cap": {"en": "2026-03"}}, now=APR1)
            page.wait_for_selector("#lr-rb:not([hidden]), #lr-info:not([hidden])", timeout=5000)
            page.wait_for_timeout(600)
            if mic in ("deny", "nodev"):
                if page.evaluate("() => !!document.querySelector('dialog#lr-offer[open]')"):
                    page.locator("#lr-offer [data-close]").click()
                    page.wait_for_timeout(400)
                page.locator("#lr-rb").click()
                page.wait_for_selector("#lr-info:not([hidden])", timeout=5000)
                page.wait_for_timeout(300)
            elif page.evaluate("() => !!document.querySelector('dialog#lr-offer[open]')"):
                probs.append(f"{mic}: sin micrófono se propone la cápsula")
            r = page.evaluate("""() => ({info: !document.getElementById('lr-info').hidden, rb: !document.getElementById('lr-rb').hidden,
              t: document.getElementById('lr-info-t').textContent, nx: document.getElementById('lr-next-t').textContent,
              pri: document.getElementById('lr-next').classList.contains('glass-btn--pri'), retry: !document.getElementById('lr-retry').hidden,
              bg: getComputedStyle(document.getElementById('lr-info')).backgroundColor, st: vocabParrot.state})""")
            if not r["info"] or r["rb"] or r["nx"] != "¡Ya la dije!" or not r["pri"] or not r["t"]:
                probs.append(f"{mic}: {r}")
            if r["retry"] != (mic in ("deny", "nodev")):
                probs.append(f"{mic}: «Probar otra vez» {'falta' if not r['retry'] else 'sobra'}")
            w0 = r["st"]["word"]
            s0, p0 = len(page.evaluate("() => window.__starts")), len(page.evaluate("() => window.__played"))
            page.locator("#lr-next").click()
            page.wait_for_timeout(1500)
            st = page.evaluate(_ST)
            spoke = len(page.evaluate("() => window.__starts")) > s0 or len(page.evaluate("() => window.__played")) > p0
            if st["word"] == w0 or not spoke:
                probs.append(f"{mic}: «¡Ya la dije!» no pasa a otra o el loro no la dice: {st} {spoke}")
            if "Bien hecho" not in page.locator("#lr-bt").text_content():
                probs.append(f"{mic}: sin ánimo tras decirla: {page.locator('#lr-bt').text_content()!r}")
            if mic == "deny":
                g0 = page.evaluate("() => window.__gum")
                page.locator("#lr-retry").click()
                page.wait_for_timeout(500)
                if page.evaluate("() => window.__gum") != g0 + 1:
                    probs.append("deny: «Probar otra vez» no vuelve a pedir el micrófono")
            probs += [f"{mic}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- guardado y exportación
def test_export_unchanged_and_nothing_recorded_in_it():
    """Mirar la granja, el loro y Premios no cambia la partida exportada (igual que la base, sin claves nuevas; de la
    granja solo cambia la hora de la visita). Grabar y guardar la cápsula solo cambia las monedas (game) y la actividad
    (act): parrot:st es solo de este aparato (DEVICE_ONLY, fuera de la exportación) y las grabaciones están en IndexedDB."""
    probs = []
    base = C.load_baseline()
    assert base, "falta tests/e2e/baseline/export.json"
    page = _page()
    try:
        _seed(page)
        _to_loro(page)
        C.goto(page, "#/progreso")
        C.goto(page, "#/")
        snap = C.export(page)
        keys = dict(snap["keys"])
        for k in ("album:uniq:english",):
            keys[k] = base["keys"].get(k, keys.get(k))
        f = json.loads(keys["farm:state"]); b = json.loads(base["keys"]["farm:state"])
        f.pop("visit", None); b.pop("visit", None)
        if f != b:
            probs.append("farm:state cambia más que la hora de la visita")
        keys["farm:state"] = base["keys"]["farm:state"]
        d = C.diff_exports(base, dict(snap, keys=keys), allow_new=False)
        if d:
            probs.append("mirar cambió la partida:\n  " + "\n  ".join(d))
        # grabar (con monedas) y la cápsula
        C.goto(page, "#/loro/capsula")
        page.wait_for_function("() => vocabParrot.state.mode === 'cap'", timeout=5000)
        _record(page)
        C.goto(page, "#/")
        snap2 = C.export(page)
        nk = C.new_keys(base, snap2)
        if nk:
            probs.append(f"claves nuevas en la exportación: {nk}")
        changed = sorted(k for k in snap2["keys"] if k in snap["keys"] and snap2["keys"][k] != snap["keys"][k])
        if not set(changed) <= {"game", "act"}:
            probs.append(f"grabar cambió más que game y act: {changed}")
        txt = json.dumps(snap2, ensure_ascii=False)
        if "parrot" in txt or "capsule" in txt or "cap-en-" in txt:
            probs.append("algo del loro va en la exportación")
        inv = page.evaluate("() => ({t: vocabSave.typeOf('parrot:st'), dev: vocabSave.inventory.deviceOnly.includes('parrot:st'), st: !!localStorage.getItem('parrot:st')})")
        if inv != {"t": None, "dev": True, "st": True}:
            probs.append(f"inventario de save.js: {inv}")
        if len(page.evaluate(_CAPIDB)) != 1:
            probs.append("la cápsula no está en IndexedDB")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- capturas
def test_captures_and_audit():
    """Capturas en /mnt/project-files/rediseno/capturas/F6/ (F6h-*): la granja con el loro, el loro, el resultado con
    estrellas, la hoja de la cápsula, grabando la cápsula, sin micrófono y «Tu voz en el tiempo» en Premios; móvil y
    escritorio, claro y oscuro (con «Reducir movimiento»). En todas: contraste suficiente, sin colores fuera de la paleta
    y sin fallos de accesibilidad (a11y.js)."""
    probs = []
    for kind in ("phone", "desk"):
        for scheme in ("light", "dark"):
            tag = f"F6h-{kind}-{scheme}"
            page = _page(kind, color_scheme=scheme, reduced_motion="reduce", now=APR1)
            try:
                _seed(page, parrot={"v": 1, "cap": {"en": "2026-03"}}, now=APR1)

                def snap(name, scope=("lr-",), a11y=True):
                    page.evaluate(_FINISH)
                    page.wait_for_timeout(200)
                    a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
                    for x in a["contrast"] + a["palette"]:
                        if any(s in str(x) for s in scope):
                            probs.append(f"{tag}-{name}: {x}")
                    if a11y:
                        probs.extend(f"{tag}-{name}: {x}" for x in _a11y(page))
                    C.shot(page, f"{tag}-{name}", OUT, full_page=False)
                page.wait_for_selector(".lr-perch", timeout=5000)
                snap("granja", scope=("lr-",), a11y=False)
                _to_loro(page)
                page.wait_for_selector("dialog#lr-offer[open]", timeout=6000)
                snap("capsula-hoja")
                page.locator("#lr-of-go").click()
                page.wait_for_function("() => vocabParrot.state.mode === 'cap'", timeout=5000)
                _record(page)
                page.evaluate("() => scrollTo(0, 0)")
                snap("capsula")
                page.locator("#lr-cap-x").click()
                page.wait_for_timeout(400)
                snap("loro")
                _record(page)
                page.evaluate("() => scrollTo(0, 0)")
                snap("estrellas")
                page.evaluate(_PUT2)
                C.goto(page, "#/progreso")
                page.wait_for_selector("#rw-voz:not([hidden]) .lr-tc", timeout=5000)
                page.evaluate("() => document.getElementById('rw-voz').scrollIntoView({block: 'center'})")
                snap("premios")
                probs += [f"{tag}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
            page = _page(kind, mic="none", color_scheme=scheme, reduced_motion="reduce")
            try:
                _seed(page, hash="#/loro")
                page.wait_for_selector("#lr-info:not([hidden])", timeout=5000)
                page.evaluate(_FINISH)
                page.wait_for_timeout(200)
                a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
                probs += [f"{tag}-sinmicro: {x}" for x in a["contrast"] + a["palette"]]
                C.shot(page, f"{tag}-sinmicro", OUT, full_page=False)
                probs += [f"{tag}-sinmicro: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)
