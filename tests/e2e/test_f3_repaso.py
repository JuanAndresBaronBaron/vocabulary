"""F3b: Aprender › Repasar (#/repaso) en js/review.js, con «Dilo primero».
#/repaso con pendientes entra directo a la primera tarjeta en modo foco (sin pantalla intermedia), con «¿Cómo se dice en
inglés?» y el botón principal «Ver»; tocar la tarjeta (o «Ver») la gira y suena; «¡Sí!» rápido y sin pista es nota 2,
con pista (o tarde, > 8 s) nota 1 y «No» nota 0, escritas por el srsGrade de siempre (mismo formato en srs:<idioma>);
deslizar la tarjeta girada a la derecha es «¡Sí!» y a la izquierda «No»; la pista va por escalones (artículo y primera
letra, primera sílaba con huecos; luego «Ver»); con un reconocedor de voz simulado, «Dilo en inglés» puntúa solo si dice
la palabra (nunca otra palabra de verdad) y no oírla bien nunca pone un 0; «No me sale» (solo tras intentarlo) es un 0
con un solo «Seguir»; sin reconocedor no hay micrófono; el final paga las monedas una sola vez, sin aviso y volando
desde el chip, y «Seguir» va a Hoy; sin pendientes sale «Todo repasado». Sin errores de consola."""
from __future__ import annotations

import json
import re
import subprocess

import common as C

_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""

_ST = "() => window.vocabReview ? vocabReview.state : undefined"
_FOCUS = "() => document.documentElement.dataset.focus || ''"
_ROUTE_N = "() => window.__vocabRouteN || 0"
# lo que se ve de la tarjeta y de los botones de abajo
_LOOK = """() => { const q = s => document.querySelector(s), vis = el => !!el && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const card = q('#rv-card'), txt = el => el ? el.textContent.replace(/\\s+/g, ' ').trim() : null;
  return {card: !!card, flipped: !!card && card.classList.contains('is-flipped'), backs: document.querySelectorAll('#rv-stack .rv-back').length,
    es: txt(q('.rv-q .rv-es')), pic: !!q('.rv-q .rv-pic'), tap: txt(q('.rv-q .rv-tap')), qq: txt(q('.rv-q .rv-qq')), word: txt(q('.rv-a .rv-word')),
    next: txt(q('.rv-next')),
    spk: !!q('.rv-a .rv-spk'), slow: !!q('.rv-a .rv-slow'), ask: txt(q('#rv-ask')), no: txt(q('.rv-no')), yes: txt(q('.rv-yes')),
    hint: txt(q('.rv-hint')), giveup: txt(q('.rv-giveup')), mic: vis(q('#rv-mic')) ? txt(q('#rv-mic')) : null,
    micPressed: q('#rv-mic') && q('#rv-mic').getAttribute('aria-pressed'), look: txt(q('.rv-look')), msg: txt(q('.rv-msg')),
    good: txt(q('.rv-good')), said: vis(q('.rv-said')), steps: [...document.querySelectorAll('#rv-hints .rv-h')].map(h => h.textContent),
    prog: q('#rv-prog') ? [q('#rv-prog').getAttribute('role'), q('#rv-prog').getAttribute('aria-valuenow'), q('#rv-prog').getAttribute('aria-valuemax')] : null,
    tabbar: vis(q('#tabbar')), x: vis(q('#fx-x')), xhref: q('#fx-x') && q('#fx-x').getAttribute('href'), app: txt(q('#app'))}; }"""
# antes de puntuar: srs:<idioma> y act tal cual
_SNAP = "() => ({srs: localStorage.getItem('srs:' + lang), act: localStorage.getItem('act')})"
# lo que habría escrito el srsGrade de siempre con la misma nota: se vuelve a lo de antes, se llama a srsGrade(id, r, g)
# y se compara; después se deja lo que había escrito el repaso
_EXPECT = """([key, g, before]) => {
  const K = 'srs:' + lang, put = (k, v) => v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
  const after = {srs: localStorage.getItem(K), act: localStorage.getItem('act')};
  put(K, before.srs); put('act', before.act);
  const i = key.indexOf('|'), id = key.slice(0, i), es = key.slice(i + 1);
  const r = CACHE[id].rows.find(r => r.es === es && r.l && r.l[lang]);
  srsGrade(id, r, g);
  const exp = {srs: localStorage.getItem(K), act: localStorage.getItem('act')};
  put(K, after.srs); put('act', after.act); updBadge();
  return {same: after.srs === exp.srs && after.act === exp.act, entry: JSON.parse(after.srs)[key] || null,
    want: JSON.parse(exp.srs)[key] || null, was: JSON.parse(before.srs)[key] || null}; }"""
# apunta las llamadas a award(n, por qué, quiet, from), a M.coins, a sayP y los avisos del bus del repaso
_SPY = """() => { if (window.__spy) return; window.__spy = 1;
  window.__aw = []; window.__mc = []; window.__said = []; window.__done = []; window.__cards = [];
  const a0 = window.award; window.award = function(n, why, quiet, from){ window.__aw.push([n, why, !!quiet, from && from.id || null]); return a0.apply(this, arguments); };
  if (window.M && M.coins) { const c0 = M.coins; M.coins = function(n, from){ window.__mc.push([n, from && from.id || null]); return c0.apply(this, arguments); }; }
  const s0 = window.sayP; window.sayP = function(t){ window.__said.push(t); return s0.apply(this, arguments); };
  const y0 = window.say; window.say = function(t){ window.__said.push('say:' + t); return y0.apply(this, arguments); };
  bus.on('review-done', d => window.__done.push(d)); bus.on('review-card', d => window.__cards.push(d)); }"""
# deslizar con PointerEvents sintéticos (como un dedo): baja en el centro de la tarjeta, se mueve a cada dx y suelta
_SWIPE = """async ([dxs, up, rest]) => {
  const card = document.getElementById('rv-card'), r = card.getBoundingClientRect();
  const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2, pause = ms => new Promise(f => setTimeout(f, ms));
  const ev = (type, x, b) => new PointerEvent(type, {pointerId: 31, pointerType: 'touch', isPrimary: true, button: 0, buttons: b,
    clientX: x, clientY: y0, bubbles: true, cancelable: true, composed: true});
  card.dispatchEvent(ev('pointerdown', x0, 1));
  const seen = [];
  for (const dx of dxs) {
    await pause(16);
    card.dispatchEvent(ev('pointermove', x0 + dx, 1));
    seen.push({tr: card.style.translate, rot: parseFloat(card.style.rotate) || 0, lean: card.dataset.lean || '',
      a: parseFloat(card.style.getPropertyValue('--lean-a')) || 0, drag: card.classList.contains('is-drag'),
      wide: document.documentElement.scrollWidth > innerWidth});
  }
  if (rest) await pause(rest);
  if (up) card.dispatchEvent(ev('pointerup', x0 + dxs[dxs.length - 1], 0));
  await pause(30);
  return seen; }"""
# reconocedor de voz simulado (window.__srMode: right = dice la palabra, wrong = otra cosa, silent = no-speech,
# hang = no contesta nunca, denied = sin permiso, network = sin internet, audio-capture = sin micrófono)
_FAKE_SR = r"""
(() => {
  class FakeSR {
    constructor(){ this.lang = ""; this.maxAlternatives = 1; this.onresult = this.onerror = this.onend = null; }
    start(){
      window.__srStarts = (window.__srStarts || 0) + 1; window.__srLang = this.lang;
      const mode = window.__srMode || "right";
      if (mode === "hang") return;
      setTimeout(() => {
        if (this._ab) return;
        if (mode === "silent" || mode === "denied" || mode === "network" || mode === "audio-capture") {
          if (this.onerror) this.onerror({error: mode === "silent" ? "no-speech" : mode === "denied" ? "not-allowed" : mode});
          if (this.onend) this.onend();
          return;
        }
        const st = window.vocabReview && window.vocabReview.state, w = (st && st.word) || "";
        const alts = mode === "right" ? ["zzzz", w.toUpperCase() + "!"] : ["zzzz qqqq", "xxxxxx"];
        if (this.onresult) this.onresult({results: [alts.map(t => ({transcript: t, confidence: .7}))]});
        if (this.onend) this.onend();
      }, 120);
    }
    stop(){}
    abort(){ this._ab = true; setTimeout(() => { if (this.onerror) this.onerror({error: "aborted"}); if (this.onend) this.onend(); }, 0); }
  }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
})();
"""
_NO_SR = r"""
(() => {
  try { delete window.SpeechRecognition; } catch (e) {}
  try { delete window.webkitSpeechRecognition; } catch (e) {}
  try { Object.defineProperty(window, "webkitSpeechRecognition", {value: undefined, configurable: true, writable: true}); } catch (e) {}
  try { Object.defineProperty(window, "SpeechRecognition", {value: undefined, configurable: true, writable: true}); } catch (e) {}
})();
"""


def _page(init=None, **kw):
    page = C.new_page(kw.pop("kind", "phone"), **kw)
    if init:
        page.add_init_script(init)
    return page


def _open(page, keys=None, frm=None):
    """Partida sembrada y #/repaso (por defecto, cargando la URL directamente; con frm, entrando desde esa ruta)."""
    if frm is None:
        C.seed(page, keys=keys, hash="#/repaso")
    else:
        C.seed(page, keys=keys, hash=frm)
        C.goto(page, "#/repaso")
    page.wait_for_selector("#rv-card", timeout=10000)
    page.evaluate(_SPY)


def _wait_flip(page, on=True):
    page.wait_for_function("on => { const c = document.getElementById('rv-card'); return !!c && c.classList.contains('is-flipped') === on; }",
                           arg=on, timeout=5000)


def _tap_card(page):
    page.locator("#rv-card").click()
    _wait_flip(page)


def _wait_next(page, i0, timeout=6000):
    page.wait_for_function("i0 => { const s = window.vocabReview && vocabReview.state; return !!s && s.i > i0; }", arg=i0, timeout=timeout)


def _graded(page, st0, before, g, label, probs):
    """Comprueba que la tarjeta st0 quedó con la nota g, igual que con el srsGrade de siempre, y que pasó a la siguiente."""
    st = page.evaluate(_ST)
    if not st or st["i"] != st0["i"] + 1:
        probs.append(f"{label}: no pasa a la siguiente tarjeta ({st0['i']} → {st and st['i']})")
    r = page.evaluate(_EXPECT, [st0["key"], g, before])
    if not r["same"]:
        probs.append(f"{label}: srs:<idioma> no es el de srsGrade(…, {g}): {r['entry']} (se esperaba {r['want']}, antes {r['was']})")
    return r


def _awards(page):
    return page.evaluate("() => window.__aw || []")


# ---------------------------------------------------------------- entrar y girar
def test_starts_straight_in_focus_and_flips():
    """Con pendientes, #/repaso (también cargando la URL directa) es ya la primera tarjeta, en modo foco y sin pantalla
    intermedia: el dibujo, la palabra en español, «¿Cómo se dice en inglés?» y «Toca para ver», con «Ver» como botón
    principal. Tocarla la gira en 3D (350 ms) y suena la palabra; la respuesta trae la palabra, su altavoz, la tortuga y
    «¿La sabías?» con «No» y «¡Sí!» (verde #008932, texto blanco)."""
    probs = []
    page = _page()
    try:
        _open(page)
        st, lk = page.evaluate(_ST), page.evaluate(_LOOK)
        if page.evaluate(_FOCUS) != "repaso" or lk["tabbar"] or not lk["x"]:
            probs.append(f"#/repaso directo: modo foco {page.evaluate(_FOCUS)!r}, barra de pestañas {lk['tabbar']}, ✕ {lk['x']}")
        if page.locator("#rv-go").count() or re.search(r"Quedan|Para mayores|\d+ ?%", lk["app"] or ""):
            probs.append(f"queda la pantalla de antes de empezar: {lk['app'][:160]!r}")
        if not st or st["i"] != 0 or st["total"] != 12 or not st["open"]:
            probs.append(f"estado al entrar: {st}")
        if lk["prog"] != ["progressbar", "0", "12"]:
            probs.append(f"barra de progreso: {lk['prog']}")
        if lk["backs"] != 2:
            probs.append(f"detrás se ven {lk['backs']} tarjetas (2)")
        if not lk["pic"] or lk["es"] != st["es"] or lk["tap"] != "Toca para ver" or lk["qq"] != "¿Cómo se dice en inglés?" or lk["flipped"]:
            probs.append(f"cara de la pregunta: {lk}")
        main = page.evaluate("() => { const b = document.querySelector('#rv-dock .rv-look'); return b && [b.textContent.trim(), b.classList.contains('glass-btn--pri'), b.getBoundingClientRect().height]; }")
        if not main or main[0] != "Ver" or not main[1] or main[2] < 44:
            probs.append(f"«Ver» no es el botón principal de abajo: {main}")
        one_line = page.evaluate("""() => { const t = document.querySelector('.rv-tap'), lh = parseFloat(getComputedStyle(t).lineHeight) || 20;
          return t.getBoundingClientRect().height < lh * 1.6; }""")
        if not one_line:
            probs.append("«Toca para ver» no cabe en una línea")
        if lk["xhref"] != "#/":
            probs.append(f"cargando #/repaso directo la ✕ lleva a {lk['xhref']} (se esperaba #/)")
        tr = page.evaluate("getComputedStyle(document.querySelector('.rv-flip')).transition")
        if "transform 0.35s" not in tr:
            probs.append(f"el giro no es de 350 ms: {tr}")
        # sin girar, ← y → no deciden nada
        page.keyboard.press("ArrowRight")
        if page.evaluate(_ST)["i"] != 0:
            probs.append("→ sin girar la tarjeta ya puntúa")
        _tap_card(page)
        page.wait_for_timeout(400)
        lk = page.evaluate(_LOOK)
        if lk["word"] != st["word"] or not lk["spk"] or not lk["slow"]:
            probs.append(f"cara de la respuesta: palabra {lk['word']!r} ({st['word']!r}), altavoz {lk['spk']}, tortuga {lk['slow']}")
        if lk["ask"] != "¿La sabías?" or lk["no"] != "No" or lk["yes"] != "¡Sí!":
            probs.append(f"debajo: {lk['ask']!r} · {lk['no']!r} · {lk['yes']!r}")
        said = page.evaluate("() => window.__said")
        if st["word"] not in said:
            probs.append(f"al girar no suena la palabra: {said}")
        rot = page.evaluate("getComputedStyle(document.querySelector('.rv-flip')).transform")
        if rot in ("none", ""):
            probs.append("la tarjeta girada no está girada en 3D")
        yes = page.evaluate("""() => { const b = document.querySelector('.rv-yes'), n = document.querySelector('.rv-no'), s = getComputedStyle(b), t = getComputedStyle(n);
          return {bg: s.backgroundColor, fg: s.color, ico: !!b.querySelector('svg'), nbg: t.backgroundColor, h: b.getBoundingClientRect().height}; }""")
        if yes["bg"] != "rgb(0, 137, 50)" or yes["fg"] != "rgb(255, 255, 255)" or not yes["ico"] or yes["h"] < 44:
            probs.append(f"«¡Sí!» no es el botón verde sólido con ✓: {yes}")
        if yes["nbg"] in ("rgba(0, 0, 0, 0)", "transparent", yes["bg"]):
            probs.append(f"«No» no es un botón gris sólido: {yes['nbg']}")
        # tocar la tarjeta ya girada la vuelve a decir; Espacio también
        page.locator("#rv-card .rv-word").click()
        page.locator("#rv-card .rv-slow").click()
        page.wait_for_timeout(150)
        said = page.evaluate("() => window.__said")
        if said.count("say:" + st["word"]) < 2:
            probs.append(f"tocar la tarjeta girada o la tortuga no vuelve a decir la palabra: {said}")
        # entrando desde Hoy, igual de directo
        page.context.close()
        page = _page()
        _open(page, frm="")
        if page.evaluate(_FOCUS) != "repaso" or page.evaluate(_LOOK)["xhref"] != "#/":
            probs.append(f"desde Hoy: modo foco {page.evaluate(_FOCUS)!r}, ✕ {page.evaluate(_LOOK)['xhref']}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_reduced_motion_crossfades():
    """Con «Reducir movimiento» la tarjeta no gira: cambia de cara con un fundido."""
    probs = []
    page = _page(reduced_motion="reduce")
    try:
        _open(page)
        _tap_card(page)
        page.wait_for_timeout(250)
        r = page.evaluate("""() => ({t: getComputedStyle(document.querySelector('.rv-flip')).transform,
          q: getComputedStyle(document.querySelector('.rv-q')).opacity, a: getComputedStyle(document.querySelector('.rv-a')).opacity}) """)
        if r["t"] != "none" or r["q"] != "0" or r["a"] != "1":
            probs.append(f"con reducir movimiento: {r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- notas
def test_grades_match_base_srs():
    """«¡Sí!» rápido = 2, con pista = 1, girada después de 8 s = 1, «No» = 0 (y vuelve al final de la cola); → y ← hacen
    lo mismo. Lo escrito en srs:<idioma> es exactamente lo que escribe el srsGrade de siempre con esa nota, y cada nota
    da esas monedas (award(g, "", true)). srsGrade y srsNext son los de la versión anterior."""
    probs = []
    # el algoritmo no cambia: srsNext y srsGrade, letra por letra los de antes del rediseño
    try:
        old = subprocess.run(["git", "-C", str(C.REPO), "show", "1721796:index.html"], capture_output=True, text=True, timeout=30).stdout
    except Exception:  # noqa: BLE001
        old = ""
    if old:
        cut = lambda s: s[s.index("function srsNext("):s.index("function srsAdd(")]  # noqa: E731
        if cut(old) != cut((C.REPO / "index.html").read_text(encoding="utf-8")):
            probs.append("srsNext/srsGrade no son los de la versión anterior")
    page = _page()
    try:
        _open(page)
        cases = [("¡Sí! rápido", "yes", 2), ("con pista", "hint-yes", 1), ("No", "no", 0), ("tarde (> 8 s)", "slow-yes", 1),
                 ("→", "key-right", 2), ("←", "key-left", 0)]
        for label, how, g in cases:
            st0, before = page.evaluate(_ST), page.evaluate(_SNAP)
            n_aw, q_len = len(_awards(page)), page.evaluate("() => rv.q.length")
            if how == "slow-yes":
                page.clock.fast_forward(8600)
            if how == "hint-yes":
                page.locator(".rv-hint").click()
            if how.startswith("key"):
                page.evaluate("() => document.activeElement && document.activeElement.blur()")
                page.keyboard.press("Space")
                _wait_flip(page)
                page.keyboard.press("ArrowRight" if how == "key-right" else "ArrowLeft")
            else:
                _tap_card(page)
                page.locator(".rv-no" if how == "no" else ".rv-yes").click()
            _wait_next(page, st0["i"])
            _graded(page, st0, before, g, label, probs)
            aw = _awards(page)[n_aw:]
            if aw != ([[g, "", True, None]] if g else []):
                probs.append(f"{label}: monedas {aw} (se esperaba award({g}, '', true))")
            q = page.evaluate("() => ({n: rv.q.length, last: srsK(rv.q[rv.q.length - 1].id, rv.q[rv.q.length - 1].r)})")
            if g == 0 and (q["n"] != q_len + 1 or q["last"] != st0["key"]):
                probs.append(f"{label}: la tarjeta con 0 no vuelve al final de la cola: {q}")
            if g and q["n"] != q_len:
                probs.append(f"{label}: con nota {g} la cola cambia de {q_len} a {q['n']}")
            page.wait_for_selector("#rv-card:not(.is-flipped)", timeout=3000)
        st = page.evaluate(_ST)
        if st["done"] != 4 or st["coins"] != 6:
            probs.append(f"tras 4 aciertos y 2 fallos: hechas {st['done']}, monedas {st['coins']} (4 y 6)")
        if page.evaluate("() => document.getElementById('rv-prog').getAttribute('aria-valuenow')") != "4":
            probs.append("la barra de progreso no avanza con las tarjetas hechas")
        cards = page.evaluate("() => window.__cards.map(c => c.grade)")
        if cards != [2, 1, 0, 1, 2, 0]:
            probs.append(f"avisos review-card: {cards}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_swipe_matches_buttons():
    """Con la tarjeta girada, deslizar a la derecha (PointerEvents sintéticos) escribe lo mismo que «¡Sí!» y a la
    izquierda lo mismo que «No». Mientras se arrastra la tarjeta sigue al dedo, se inclina como mucho 8° y se tiñe;
    soltando a medio camino vuelve a su sitio sin puntuar. Sin girar, deslizar no decide nada."""
    probs = []
    page = _page()
    try:
        _open(page)
        st0, before = page.evaluate(_ST), page.evaluate(_SNAP)
        page.evaluate(_SWIPE, [[30, 60, 90, 120, 160, 180], True, 0])
        page.wait_for_timeout(200)
        if page.evaluate(_ST)["i"] != 0 or page.evaluate(_SNAP) != before:
            probs.append("deslizar la tarjeta sin girar ya puntúa")
        _tap_card(page)
        # a medio camino y parado: vuelve sin puntuar
        seen = page.evaluate(_SWIPE, [[10, 20, 30, 40], True, 180])
        if not seen or seen[-1]["lean"] != "yes" or seen[-1]["a"] <= 0 or not seen[-1]["tr"].startswith("40"):
            probs.append(f"la tarjeta no sigue al dedo ni se tiñe: {seen[-1:] }")
        page.wait_for_timeout(500)
        if page.evaluate(_ST)["i"] != 0 or page.evaluate(_SNAP) != before:
            probs.append("soltar a medio camino puntúa")
        # a la derecha = ¡Sí!
        seen = page.evaluate(_SWIPE, [[30, 60, 90, 120, 150, 180], True, 0])
        rots = [s["rot"] for s in seen]
        if max(rots) > 8.001 or abs(rots[-1] - 8) > .01 or not all(s["lean"] == "yes" and s["drag"] for s in seen):
            probs.append(f"inclinación y tinte al deslizar a la derecha: {seen}")
        if any(s["wide"] for s in seen):
            probs.append("al arrastrar la tarjeta la página se ensancha (scroll horizontal)")
        _wait_next(page, st0["i"])
        _graded(page, st0, before, 2, "deslizar a la derecha", probs)
        # a la izquierda = No
        page.wait_for_selector("#rv-card:not(.is-flipped)", timeout=3000)
        st0, before = page.evaluate(_ST), page.evaluate(_SNAP)
        _tap_card(page)
        seen = page.evaluate(_SWIPE, [[-30, -60, -90, -120, -150, -170], True, 0])
        if min(s["rot"] for s in seen) < -8.001 or not all(s["lean"] == "no" for s in seen):
            probs.append(f"inclinación y tinte al deslizar a la izquierda: {seen}")
        _wait_next(page, st0["i"])
        _graded(page, st0, before, 0, "deslizar a la izquierda", probs)
        # la que sale volando se va y la siguiente queda arriba, sin girar
        page.wait_for_timeout(800)
        n = page.evaluate("() => document.querySelectorAll('#rv .rv-card').length")
        if n != 1:
            probs.append(f"quedan {n} tarjetas en pantalla tras salir volando")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_swipe_hint_on_second_flip():
    """La pista «Desliza: sí o no» (G.hint) no sale la primera vez que se gira una tarjeta, sí la segunda."""
    probs = []
    page = _page()
    try:
        _open(page)
        _tap_card(page)
        page.wait_for_timeout(900)
        if page.locator(".g-hint").count():
            probs.append("la pista del gesto sale ya en la primera tarjeta")
        page.locator(".rv-yes").click()
        page.wait_for_selector("#rv-card:not(.is-flipped)", timeout=3000)
        _tap_card(page)
        try:
            page.wait_for_selector(".g-hint", timeout=3000)
            t = page.locator(".g-hint .g-hint-t").text_content()
            if t != "Desliza: sí o no":
                probs.append(f"la pista dice {t!r}")
        except Exception:  # noqa: BLE001
            probs.append("la segunda vez que gira no sale «Desliza: sí o no»")
        page.locator(".rv-no").click()
        page.wait_for_timeout(600)
        if page.locator(".g-hint").count():
            probs.append("la pista sigue en pantalla tras decidir")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- pistas
def test_hint_steps():
    """«Pista» por escalones, cada uno se queda en la tarjeta: 1) el artículo y la primera letra («le c…»), 2) la primera
    sílaba y huecos para el resto (respetando los espacios; siempre quedan 2 letras ocultas); con las dos, «Pista» se va y
    queda «Ver» (gira). El lector de pantalla oye la pista con la palabra en su idioma. Con pista, «¡Sí!» es nota 1."""
    probs = []
    page = _page()
    try:
        _open(page)
        h = page.evaluate("""() => [['le chien', 'français'], ['la tortue', 'français'], ["l'oiseau", 'français'], ['en hund', 'dansk'],
          ['dog', 'english'], ['the cat', 'english'], ['ice cream', 'english'], ['hippopotamus', 'english'], ['et æble', 'dansk'],
          ['ostrich', 'english'], ['le cheval', 'français'], ['at løbe', 'dansk'], ['horse', 'english']]
          .map(([w, l]) => vocabReview.hints(w, l))""")
        want = [["le c…", "le chi _ _"], ["la t…", "la tor _ _ _"], ["l'o…", "l'oi _ _ _ _"], ["en h…", "en hu _ _"], ["d…", "d _ _"],
                ["the c…", "the c _ _"], ["i…", "i _ _   c _ _ _ _"], ["h…", "hip" + " _" * 9], ["et æ…", "et æ _ _ _"],
                ["o…", "os _ _ _ _ _"], ["le c…", "le che _ _ _"], ["at l…", "at lø _ _"], ["h…", "hor _ _"]]
        if h != want:
            probs.append(f"vocabReview.hints: {h} (se esperaba {want})")
        st0, before = page.evaluate(_ST), page.evaluate(_SNAP)
        steps = page.evaluate("w => vocabReview.hints(w, lang)", st0["word"])
        lk = page.evaluate(_LOOK)
        if lk["hint"] != "Pista" or lk["steps"]:
            probs.append(f"antes de pedir pista: botón {lk['hint']!r}, escalones {lk['steps']}")
        page.locator(".rv-hint").click()
        lk = page.evaluate(_LOOK)
        if lk["steps"] != steps[:1] or lk["hint"] != "Otra pista" or lk["flipped"]:
            probs.append(f"escalón 1: {lk['steps']} (se esperaba {steps[:1]}), botón {lk['hint']!r}")
        page.wait_for_timeout(120)
        live = page.evaluate("() => document.getElementById('rv-live').innerHTML")
        if f'«<span lang="en-GB">{steps[0][:-1]}</span>»' not in live:
            probs.append(f"el lector de pantalla no oye la pista 1 con su idioma: {live!r}")
        page.locator(".rv-hint").click()
        lk = page.evaluate(_LOOK)
        if lk["steps"] != steps or lk["hint"] is not None or lk["look"] != "Ver" or lk["flipped"]:
            probs.append(f"escalón 2: {lk['steps']} (se esperaba {steps}), botón {lk['hint']!r}, «{lk['look']}»")
        if page.evaluate(_SNAP) != before:
            probs.append("pedir pista ya escribe en el repaso")
        page.locator(".rv-look").click()
        _wait_flip(page)
        st = page.evaluate(_ST)
        if not st["hinted"] or st["hint"] != 2:
            probs.append(f"escalón 3 (ver la respuesta): {st}")
        page.locator(".rv-yes").click()
        _wait_next(page, st0["i"])
        _graded(page, st0, before, 1, "¡Sí! con pista", probs)
        # la tarjeta siguiente empieza sin pistas
        if page.evaluate(_LOOK)["steps"] or page.evaluate(_LOOK)["hint"] != "Pista":
            probs.append("la tarjeta siguiente arrastra las pistas de la anterior")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Dilo primero
def test_matching_is_tolerant():
    """Comparar lo que oyó el reconocedor: sin mayúsculas, tildes, signos ni artículo y con todas las alternativas; exacta
    hasta 4 letras, una letra de diferencia de 5 a 7 y dos desde 8, empezando igual; vale también con su artículo. Nunca
    vale otra palabra de verdad (las parejas que un niño confunde: bat/cat, dig/dog, house/horse, tree/three…)."""
    page = _page()
    try:
        C.seed(page)
        r = page.evaluate("""async () => { await getDoc('familia'); await getDoc('animales'); const m = vocabReview.matches; return {
          yes: [m(['Dog'], 'dog', 'english'), m(['zzz', 'the dog!'], 'dog', 'english'),
                m(['hipopotamus'], 'hippopotamus', 'english'), m(['hippopotamuses'], 'hippopotamus', 'english'),
                m(["it's a whale"], 'whale', 'english'), m(['chien'], 'le chien', 'français'), m(['le chien'], 'le chien', 'français'),
                m(['Élephant'], "l'éléphant", 'français'), m(['l’éléphant'], "l'éléphant", 'français'), m(['hund'], 'en hund', 'dansk'),
                m(['aeble'], 'et æble', 'dansk'), m(['shark'], 'shark / sharks', 'english'), m(['ice cream'], 'ice cream', 'english'),
                m(['icecream'], 'ice cream', 'english'), m(['butterfli'], 'butterfly', 'english'), m(['chiens'], 'le chien', 'français')],
          no: [m(['cat'], 'dog', 'english'), m(['door'], 'dove', 'english'), m(['zzzz qqqq'], 'swan', 'english'), m([], 'dog', 'english'),
               m([''], 'dog', 'english'), m(['hipopotams'], 'cat', 'english'), m(['chat'], 'le chien', 'français'), m(['ox'], 'of', 'english'),
               m(['dug'], 'dog', 'english'), m(['kangaru'], 'kangaroo', 'english'), m(['bat'], 'cat', 'english'), m(['hat'], 'cat', 'english'),
               m(['a hat'], 'cat', 'english'), m(['at'], 'cat', 'english'), m(['dig'], 'dog', 'english'), m(['big'], 'pig', 'english'),
               m(['son'], 'sun', 'english'), m(['bear'], 'pear', 'english'), m(['house'], 'mouse', 'english'), m(['mother'], 'brother', 'english'),
               m(['tree'], 'three', 'english'), m(['three'], 'tree', 'english'), m(['pen'], 'pan', 'english'), m(['ten'], 'hen', 'english'),
               m(['horse'], 'house', 'english'), m(['father'], 'feather', 'english'), m(['grandfather'], 'grandmother', 'english'),
               m(['grand father'], 'grandmother', 'english'), m(['hun'], 'en hund', 'dansk')]}; }""")
        bad = [f"debería valer #{i}" for i, v in enumerate(r["yes"]) if not v] + [f"no debería valer #{i}" for i, v in enumerate(r["no"]) if v]
        assert not bad and not C.errors(page), f"{bad} {C.errors(page)}"
    finally:
        page.context.close()


def test_mic_right_word_grades_itself():
    """Con un reconocedor simulado que oye la palabra: «Dilo en inglés» (secundario: una cápsula, no el botón azul)
    escucha en el idioma de la palabra («Te escucho…»), la tarjeta gira con el ✓ verde y se puntúa sola (2 sin pista, 1
    con pista) y pasa tras el audio. Si no contesta, a los 7 s de listen() queda «No te he oído bien» sin nota (y ahora
    sí «No me sale»), y el rato escuchando no cuenta para los 8 s."""
    probs = []
    page = _page(init=_FAKE_SR)
    try:
        _open(page)
        lk = page.evaluate(_LOOK)
        if lk["mic"] != "Dilo en inglés" or lk["hint"] != "Pista" or lk["giveup"] is not None or lk["look"] != "Ver":
            probs.append(f"con micrófono: «{lk['mic']}» · «{lk['hint']}» · «{lk['giveup']}» · «{lk['look']}»")
        if page.evaluate("() => document.getElementById('rv-mic').classList.contains('glass-btn--pri')"):
            probs.append("«Dilo en inglés» es el botón principal (debería ser «Ver»)")
        # dice bien la palabra (en la segunda alternativa, en mayúsculas y con signos)
        for label, hint, g in (("dicha bien", False, 2), ("dicha bien con pista", True, 1)):
            st0, before = page.evaluate(_ST), page.evaluate(_SNAP)
            n_aw = len(_awards(page))
            if hint:
                page.locator(".rv-hint").click()
            page.locator("#rv-mic").click()
            page.wait_for_function("() => vocabReview.state && vocabReview.state.said", timeout=4000)
            _wait_flip(page)
            lk = page.evaluate(_LOOK)
            if not lk["said"] or lk["good"] != "¡Muy bien!" or lk["yes"] is not None:
                probs.append(f"{label}: tras acertar: ✓ {lk['said']}, «{lk['good']}», botones {lk['yes']!r}")
            if page.evaluate(_SNAP) != before:
                probs.append(f"{label}: puntúa antes de que suene la palabra")
            _wait_next(page, st0["i"], timeout=10000)
            _graded(page, st0, before, g, label, probs)
            if _awards(page)[n_aw:] != [[g, "", True, None]]:
                probs.append(f"{label}: monedas {_awards(page)[n_aw:]}")
            page.wait_for_selector("#rv-card:not(.is-flipped)", timeout=3000)
        if page.evaluate("() => window.__srLang") != page.evaluate("() => LANGS[lang].code"):
            probs.append(f"escucha en {page.evaluate('() => window.__srLang')!r}, no en el idioma de la palabra")
        # no contesta: «Te escucho…» y, a los 7 s, «No te he oído bien» (sin nota)
        page.evaluate("() => { window.__srMode = 'hang'; }")
        st0, before = page.evaluate(_ST), page.evaluate(_SNAP)
        page.locator("#rv-mic").click()
        page.wait_for_function("() => vocabReview.state.mic === 'listening'", timeout=3000)
        lk = page.evaluate(_LOOK)
        if lk["mic"] != "Te escucho…" or lk["micPressed"] != "true":
            probs.append(f"escuchando: «{lk['mic']}» aria-pressed={lk['micPressed']}")
        page.clock.fast_forward(7300)
        page.wait_for_function("() => vocabReview.state.mic === 'miss'", timeout=4000)
        lk = page.evaluate(_LOOK)
        if lk["msg"] != "No te he oído bien" or lk["look"] != "Ver" or lk["mic"] != "Otra vez" or lk["giveup"] != "No me sale" or lk["flipped"]:
            probs.append(f"tras 7 s sin respuesta: {lk['msg']!r} · {lk['look']!r} · {lk['mic']!r} · {lk['giveup']!r} · girada {lk['flipped']}")
        if page.evaluate(_SNAP) != before or page.evaluate(_ST)["i"] != st0["i"]:
            probs.append("si el reconocedor no contesta, ya hay nota")
        page.locator(".rv-look").click()
        _wait_flip(page)
        page.locator(".rv-yes").click()
        _wait_next(page, st0["i"])
        _graded(page, st0, before, 2, "¡Sí! tras 7 s escuchando", probs)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_mic_wrong_word_never_zero():
    """Si el reconocedor oye otra cosa (o nada) no hay nota: «No te he oído bien», «Otra vez» y «No me sale»; a la
    segunda, el micrófono se va («¡No pasa nada! Mírala y dime si la sabías.») y decide él con «Ver» y los botones.
    «No me sale» gira la tarjeta, suena y dice «Así se dice. ¡La verás otra vez!» con un solo «Seguir» (o → / Intro):
    nota 0 y vuelve al final de la cola; nunca «¿La sabías?». Sin permiso del micrófono se quita «Dilo»."""
    probs = []
    page = _page(init=_FAKE_SR)
    try:
        _open(page)
        page.evaluate("() => { window.__srMode = 'wrong'; }")
        st0, before = page.evaluate(_ST), page.evaluate(_SNAP)
        page.locator("#rv-mic").click()
        page.wait_for_function("() => vocabReview.state.mic === 'miss'", timeout=4000)
        lk = page.evaluate(_LOOK)
        if lk["msg"] != "No te he oído bien" or lk["look"] != "Ver" or lk["mic"] != "Otra vez" or lk["giveup"] != "No me sale" or lk["flipped"]:
            probs.append(f"otra palabra: {lk['msg']!r} · {lk['look']!r} · {lk['mic']!r} · {lk['giveup']!r} · girada {lk['flipped']}")
        page.evaluate("() => { window.__srMode = 'silent'; }")
        page.locator("#rv-mic").click()
        page.wait_for_function("() => vocabReview.state.miss === 2 && window.__srStarts >= 2", timeout=4000)
        page.wait_for_timeout(300)
        if page.evaluate(_SNAP) != before or page.evaluate(_ST)["i"] != st0["i"] or page.evaluate("() => window.__cards.length"):
            probs.append("el reconocedor que falla ya pone nota")
        lk = page.evaluate(_LOOK)
        if lk["msg"] != "¡No pasa nada! Mírala y dime si la sabías." or lk["mic"] is not None or lk["look"] != "Ver":
            probs.append(f"a la segunda: {lk['msg']!r}, micrófono {lk['mic']!r}, «{lk['look']}»")
        page.locator(".rv-look").click()
        _wait_flip(page)
        if page.evaluate(_LOOK)["yes"] != "¡Sí!":
            probs.append("tras «Ver» no puede decidir con los botones")
        page.locator(".rv-yes").click()
        _wait_next(page, st0["i"])
        _graded(page, st0, before, 2, "¡Sí! tras no oírle bien", probs)
        # «No me sale» (aparece tras intentarlo): nota 0 con un solo «Seguir»; con el ratón y con →
        page.evaluate("() => { window.__srMode = 'wrong'; }")
        for label, how in (("No me sale + Seguir", "click"), ("No me sale + →", "key")):
            page.wait_for_selector("#rv-card:not(.is-flipped)", timeout=3000)
            st0, before = page.evaluate(_ST), page.evaluate(_SNAP)
            q_len, n_said = page.evaluate("() => rv.q.length"), len(page.evaluate("() => window.__said"))
            page.locator("#rv-mic").click()
            page.wait_for_function("() => vocabReview.state.mic === 'miss'", timeout=4000)
            page.locator(".rv-giveup").click()
            _wait_flip(page)
            page.wait_for_timeout(150)
            lk = page.evaluate(_LOOK)
            if lk["ask"] or lk["yes"] or lk["no"] or lk["next"] != "Seguir" or "Así se dice. ¡La verás otra vez!" not in (page.locator("#rv-dock").text_content() or ""):
                probs.append(f"{label}: tras «No me sale»: «{lk['ask']}» {lk['yes']!r} {lk['no']!r} siguiente {lk['next']!r}")
            if st0["word"] not in page.evaluate("() => window.__said")[n_said:]:
                probs.append(f"{label}: no suena la palabra")
            if page.evaluate(_SNAP) != before:
                probs.append(f"{label}: «No me sale» ya puntúa")
            if how == "click":
                page.locator(".rv-next").click()
            else:
                page.evaluate("() => document.activeElement && document.activeElement.blur()")
                page.keyboard.press("ArrowRight")
            _wait_next(page, st0["i"])
            _graded(page, st0, before, 0, label, probs)
            q = page.evaluate("() => ({n: rv.q.length, last: srsK(rv.q[rv.q.length - 1].id, rv.q[rv.q.length - 1].r), again: !!rv.q[rv.q.length - 1].again})")
            if q["n"] != q_len + 1 or q["last"] != st0["key"] or not q["again"]:
                probs.append(f"{label}: no vuelve al final de la cola: {q}")
        # sin permiso: fuera el micrófono
        page.wait_for_selector("#rv-card:not(.is-flipped)", timeout=3000)
        page.evaluate("() => { window.__srMode = 'denied'; }")
        before = page.evaluate(_SNAP)
        page.locator("#rv-mic").click()
        page.wait_for_function("() => !document.getElementById('rv-mic')", timeout=4000)
        lk = page.evaluate(_LOOK)
        if lk["msg"] != "No puedo usar el micrófono. Toca «Ver»." or lk["giveup"] or lk["hint"] != "Pista" or lk["look"] != "Ver":
            probs.append(f"sin permiso: {lk['msg']!r}, «No me sale» {lk['giveup']!r}, pista {lk['hint']!r}, «{lk['look']}»")
        if page.evaluate(_SNAP) != before:
            probs.append("sin permiso del micrófono ya hay nota")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_no_mic_without_speech_recognition():
    """Sin SpeechRecognition (como en la app instalada del iPhone) no hay «Dilo» ni «No me sale»: «Ver», la pista y tocar
    la tarjeta siguen, y la tarjeta invita a pensarla antes («Piénsala… y toca para ver»)."""
    probs = []
    page = _page(init=_NO_SR)
    try:
        _open(page)
        lk = page.evaluate(_LOOK)
        if page.evaluate("() => canListen()") or lk["mic"] or lk["giveup"] or page.locator("#rv[data-mic]").count():
            probs.append(f"sin reconocedor: canListen {page.evaluate('() => canListen()')}, «{lk['mic']}», «{lk['giveup']}»")
        if lk["hint"] != "Pista" or lk["look"] != "Ver" or lk["tap"] != "Piénsala… y toca para ver" or lk["qq"] != "¿Cómo se dice en inglés?":
            probs.append(f"sin reconocedor: «{lk['hint']}» · «{lk['look']}» · {lk['tap']!r} · {lk['qq']!r}")
        st0, before = page.evaluate(_ST), page.evaluate(_SNAP)
        _tap_card(page)
        page.locator(".rv-yes").click()
        _wait_next(page, st0["i"])
        _graded(page, st0, before, 2, "sin micrófono", probs)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- final, vacío y salir
def test_end_pays_once_and_goes_home():
    """Al terminar, en una tarjeta: «¡Repasaste N palabras!», las monedas (award(10, "", false, from) una sola vez,
    volando desde el chip, que lleva el total, y sin aviso: una sola cifra), la racha y «Seguir», que va SIEMPRE a Hoy
    (aunque se entrara desde el Camino)."""
    probs = []
    page = _page()
    try:
        _open(page, frm="#/mapa")
        if page.evaluate(_LOOK)["xhref"] != "#/mapa":
            probs.append(f"desde el Camino la ✕ lleva a {page.evaluate(_LOOK)['xhref']}")
        page.evaluate("() => document.activeElement && document.activeElement.blur()")
        for k in range(12):
            page.keyboard.press("Space")
            _wait_flip(page)
            page.keyboard.press("ArrowRight")
            if k < 11:
                _wait_next(page, k)
        page.wait_for_selector("#rv-end", timeout=5000)
        page.wait_for_timeout(400)
        t = page.locator("#rv-end-t").text_content()
        earn = page.locator("#rv-earn").text_content().strip()
        if t != "¡Repasaste 12 palabras!" or earn != "+34":
            probs.append(f"final: {t!r}, monedas {earn!r} (12 × 2 + 10)")
        streak = page.evaluate("() => streak()")
        chip = page.locator(".rv-chip:not(.coin)").text_content().strip()
        if str(max(1, streak)) not in chip:
            probs.append(f"la racha dice {chip!r} (streak() = {streak})")
        fin = [a for a in _awards(page) if a[0] == 10]
        if fin != [[10, "", False, "rv-earn"]]:
            probs.append(f"monedas del final: {fin}")
        if not page.evaluate("() => !!document.querySelector('#rv-end .card.rv-end-card #rv-earn')"):
            probs.append("el final no va en una tarjeta")
        if page.evaluate("() => window.__mc.filter(c => c[0] === 10)") != [[10, "rv-earn"]]:
            probs.append(f"las monedas no vuelan desde el chip: {page.evaluate('() => window.__mc')}")
        if page.evaluate("() => window.__done") != [{"n": 12}]:
            probs.append(f"review-done: {page.evaluate('() => window.__done')}")
        if page.evaluate("() => dueList().length") != 0:
            probs.append("tras repasarlas todas siguen pendientes")
        # volver a pintar el final no paga otra vez
        page.evaluate("() => rvDraw()")
        page.wait_for_timeout(200)
        n0 = page.evaluate(_ROUTE_N)
        page.locator("#rv-end-go").click()
        page.wait_for_function("n => (window.__vocabRouteN || 0) > n", arg=n0, timeout=8000)
        C.settle(page, 200)
        if C.current_hash(page) != "" or page.evaluate(_FOCUS):
            probs.append(f"«Seguir» deja en #/{C.current_hash(page)} con modo foco {page.evaluate(_FOCUS)!r}")
        if len([a for a in _awards(page) if a[0] == 10]) != 1 or len(page.evaluate("() => window.__done")) != 1:
            probs.append(f"el final paga más de una vez: {_awards(page)[-3:]}")
        if page.evaluate(_ST) is not None or page.evaluate("() => vocabAccessory.state") is not None:
            probs.append("tras terminar sigue abierto el repaso")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def _no_due_keys():
    keys = C.seed_keys()
    m, t = json.loads(keys["srs:english"]), C.day_num(C.FIXED_NOW)
    for x in m.values():
        if x["due"] <= t:
            x["due"] = t + 1
    keys["srs:english"] = C._dumps(m)
    return keys


def test_empty_when_nothing_due():
    """Sin pendientes: el zorro, «Todo repasado», cuándo vuelven y «Aprender nuevas», que lleva a la siguiente lección
    del camino. No es modo foco."""
    probs = []
    page = _page()
    try:
        C.seed(page, keys=_no_due_keys(), hash="#/repaso")
        page.wait_for_selector(".rv-empty", timeout=8000)
        r = page.evaluate("""async () => { const L = await nextLesson(), a = document.getElementById('rv-learn');
          return {t: document.getElementById('rv-empty-t').textContent, p: document.querySelector('.rv-empty-p').textContent,
            fox: !!document.querySelector('.rv-empty .rv-fox .hero'), btn: a && a.textContent.trim(), href: a && a.getAttribute('href'),
            next: L && L.l && L.l.id, card: !!document.getElementById('rv-card')}; }""")
        if r["t"] != "Todo repasado" or not r["fox"] or r["card"]:
            probs.append(f"pantalla vacía: {r}")
        if not r["p"].startswith("¡Bien hecho! Mañana vuelven"):
            probs.append(f"no dice cuándo vuelven: {r['p']!r}")
        if r["btn"] != "Aprender nuevas" or r["href"] != f"#/leccion/{r['next']}" or r["next"] != "A1-010":
            probs.append(f"«Aprender nuevas»: {r['btn']!r} → {r['href']} (siguiente lección {r['next']})")
        if page.evaluate(_FOCUS) or not page.evaluate(_LOOK)["tabbar"]:
            probs.append("la pantalla vacía está en modo foco")
        if page.evaluate(_ST) is not None:
            probs.append("sin pendientes hay un repaso abierto")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_exit_sheet_keeps_review_open():
    """La ✕ (y Esc) abre «¿Paramos aquí?»: «Seguir» vuelve a la tarjeta (el rato con la hoja abierta no cuenta para los
    8 s) y «Salir» vuelve a donde estaba, con el repaso abierto: el accesorio «Seguir · Repaso» lo retoma en la misma
    tarjeta."""
    probs = []
    page = _page()
    try:
        _open(page, frm="")
        st0, before = page.evaluate(_ST), page.evaluate(_SNAP)
        page.locator("#fx-x").click()
        page.wait_for_selector("dialog#rv-pause[open]", timeout=3000)
        t = page.locator("#rv-pz-t").text_content()
        b = [page.locator("#rv-pz-go").text_content().strip(), page.locator("#rv-pz-out").text_content().strip()]
        if t != "¿Paramos aquí?" or b != ["Seguir", "Salir"]:
            probs.append(f"hoja de la ✕: {t!r} {b}")
        page.clock.fast_forward(9000)
        page.locator("#rv-pz-go").click()
        page.wait_for_selector("dialog#rv-pause:not([open])", state="attached", timeout=3000)
        if C.current_hash(page) != "repaso" or page.evaluate(_ST)["i"] != 0:
            probs.append("«Seguir» de la hoja no vuelve a la tarjeta")
        _tap_card(page)
        page.locator(".rv-yes").click()
        _wait_next(page, st0["i"])
        _graded(page, st0, before, 2, "¡Sí! tras 9 s con la hoja abierta", probs)
        st1 = page.evaluate(_ST)
        page.wait_for_selector("#rv-card:not(.is-flipped)", timeout=3000)
        page.keyboard.press("Escape")
        page.wait_for_selector("dialog#rv-pause[open]", timeout=3000)
        n0 = page.evaluate(_ROUTE_N)
        page.locator("#rv-pz-out").click()
        page.wait_for_function("n => (window.__vocabRouteN || 0) > n", arg=n0, timeout=8000)
        C.settle(page, 200)
        if C.current_hash(page) != "" or page.evaluate(_FOCUS):
            probs.append(f"«Salir» deja en #/{C.current_hash(page)} con modo foco {page.evaluate(_FOCUS)!r}")
        st = page.evaluate(_ST)
        if not st or not st["open"] or st["i"] != 1 or st["done"] != 1:
            probs.append(f"tras «Salir» el repaso no queda abierto: {st}")
        if page.evaluate("() => document.getElementById('hm-go') && document.getElementById('hm-go').textContent.trim()") != "Seguir":
            probs.append("en Hoy la tarjeta no ofrece seguir el repaso")
        C.goto(page, "#/mapa")
        a = page.evaluate("() => { const a = document.getElementById('acc'); return a && !a.hidden ? [a.textContent.replace(/\\s+/g, ' ').trim(), a.getAttribute('href')] : null; }")
        if a != ["Seguir · Repaso", "#/repaso"]:
            probs.append(f"accesorio fuera de Hoy: {a}")
        n0 = page.evaluate(_ROUTE_N)
        page.locator("#acc").click()
        page.wait_for_function("n => (window.__vocabRouteN || 0) > n", arg=n0, timeout=8000)
        page.wait_for_selector("#rv-card", timeout=5000)
        st = page.evaluate(_ST)
        if page.evaluate(_FOCUS) != "repaso" or st["i"] != 1 or st["key"] != st1["key"]:
            probs.append(f"el accesorio no retoma la misma tarjeta: {st} (era {st1['key']})")
        if page.evaluate("() => document.getElementById('rv-prog').getAttribute('aria-valuenow')") != "1":
            probs.append("al retomarlo la barra de progreso empieza de cero")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- módulo, partida y auditoría
def test_module_and_saved_game():
    """js/review.js va tras el script principal y en el shell sin conexión; index.html ya no pinta el repaso. Entrar en
    #/repaso sin tocar nada no cambia la partida exportada (sigue siendo la de tests/e2e/baseline/export.json)."""
    probs = []
    html = (C.REPO / "index.html").read_text(encoding="utf-8")
    sw = (C.REPO / "sw.js").read_text(encoding="utf-8")
    shell = re.search(r"const SHELL = \[(.*?)\];", sw, re.S).group(1)
    if '"js/review.js"' not in shell:
        probs.append("js/review.js no está en el SHELL de sw.js")
    main_end = html.rfind("</script>", 0, html.find('<script src="js/motion.js"'))
    if html.find('<script src="js/review.js"></script>') < main_end:
        probs.append("js/review.js no se carga después del script principal")
    for old in ("function repaso(", "function rvStart(", "function rvDraw(", 'id="rv-go"'):
        if old in html:
            probs.append(f"index.html aún tiene {old}")
    page = _page(kind="desk")
    try:
        C.seed(page)
        C.goto(page, "#/repaso")
        page.wait_for_selector("#rv-card", timeout=8000)
        if page.evaluate("() => typeof ROUTES.repaso === 'function' && typeof window.repaso === 'function' && typeof rvStart === 'function' && typeof rvDraw === 'function'") is not True:
            probs.append("faltan ROUTES.repaso / repaso / rvStart / rvDraw")
        base = C.load_baseline()
        if base:
            d = C.diff_exports(base, C.export(page))
            if d:
                probs.append("entrar en #/repaso cambia la partida: " + "; ".join(d))
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_review_screens_audit():
    """Pregunta con pistas, respuesta, «No te he oído bien», la hoja «¿Paramos aquí?», el final y la pantalla vacía, en
    claro y en oscuro: contraste ≥ 4,5:1, sin colores prohibidos y, con html[data-glass=off], sin desenfoque."""
    probs = []
    for scheme in ("light", "dark"):
        page = _page(init=_FAKE_SR, color_scheme=scheme)
        try:
            def audit(label):
                page.wait_for_timeout(450)
                page.evaluate(_FINISH)
                a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
                probs.extend(f"{scheme} {label}: {x}" for x in a["contrast"] + a["palette"])
                page.evaluate("document.documentElement.dataset.glass = 'off'")
                a = page.evaluate(_AUDIT, {"what": ["backdrop"]})
                probs.extend(f"{scheme} {label} (sin vidrio): {x}" for x in a["backdrop"])
                page.evaluate("delete document.documentElement.dataset.glass")

            _open(page)
            page.locator(".rv-hint").click()
            page.locator(".rv-hint").click()
            audit("pregunta con pistas")
            page.evaluate("() => { window.__srMode = 'wrong'; }")
            page.locator("#rv-mic").click()
            page.wait_for_function("() => vocabReview.state.mic === 'miss'", timeout=4000)
            audit("no te he oído bien")
            page.locator(".rv-look").click()
            _wait_flip(page)
            audit("respuesta")
            page.locator("#fx-x").click()
            page.wait_for_selector("dialog#rv-pause[open]", timeout=3000)
            audit("¿Paramos aquí?")
            page.locator("#rv-pz-go").click()
            page.wait_for_timeout(300)
            page.evaluate("() => { rv.i = rv.q.length; rvDraw(); }")
            page.wait_for_selector("#rv-end", timeout=3000)
            audit("final")
            C.seed(page, keys=_no_due_keys(), hash="#/repaso")
            page.wait_for_selector(".rv-empty", timeout=8000)
            audit("todo repasado")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)
