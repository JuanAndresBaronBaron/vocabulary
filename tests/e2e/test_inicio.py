"""Hoy, la primera vez y el día a día (paquete «Inicio»):
- La bienvenida de un aparato nuevo (js/welcome.js): hoja a pantalla completa con «¿Qué quieres aprender?» (3 banderas
  que suenan con say()), «¿Cómo te llamas?» y «¡Vamos!» a la primera lección; «Saltar» siempre; no sale con la partida,
  con Google conectado, con ?hello=off ni (en un navegador automático) sin ?hello=on; los avisos esperan.
- El zorro lee Hoy en voz alta en español (un toque; sin voz española no hay altavoz) y cada fila de Misiones también.
- La meta del día: el anillo de 3 trozos de Misiones, la semana (L…D) con la llama, «¡Lo de hoy, hecho!» con confeti
  una vez, la Granja y los Juegos.
- La temporada se alcanza siempre desde Hoy (el dibujo de la esquina es un enlace), «Acierta…» lleva una estrella, cada
  misión lleva a su actividad y no hay «G» en la barra de arriba.
- Las 10 monedas del día son una sorpresa visible al terminar la primera práctica (nunca por abrir la app ni anunciadas
  en Hoy); el cofre es una sorpresa que no se anuncia ni caduca.
- Los dibujos de lo que toca en la tarjeta y Hoy sin scroll a 360×740 y 390×844, también con letra grande."""
from __future__ import annotations

import json
import time

import common as C
import test_voces as V

OUT = C.CAPTURAS / "inicio"
_FIT = "() => ({sh: document.documentElement.scrollHeight, ih: innerHeight})"
_FEW = """() => { const k = 'srs:english', m = JSON.parse(localStorage.getItem(k)), t = today(); let n = 0;
  for (const x of Object.values(m)) if (x.due <= t && n < 6) { x.due = t + 3; n++; }
  localStorage.setItem(k, JSON.stringify(m)); }"""
_ALL_DONE = """async () => { await getMap(); const P = {};
  for (const lv of Object.keys(LVS)) for (const l of lvLessons(lv)) P[l.id] = 3;
  store.set('map:' + lang, P); }"""
# las misiones de hoy (buddy:missions) a medida: [[k, goal, n, got], …] y el cofre
_MIS = """([list, chest]) => store.set('buddy:missions', {day: dayKey(new Date()), chest,
  list: list.map(([k, goal, n, got]) => ({k, goal, n, got, s: n}))})"""
# voz del navegador de mentira: apunta lo que se dice (texto, lang y voz) y acaba a los 60 ms
_TTS = r"""
(voices => {
  const ss = window.speechSynthesis; if (!ss) return;
  const T = window.__tts = {log: []};
  const list = voices.map(v => Object.freeze(Object.assign({}, v)));
  const def = (k, o) => Object.defineProperty(ss, k, Object.assign({configurable: true}, o));
  def('getVoices', {writable: true, value: () => list.slice()});
  def('speaking', {get: () => false}); def('pending', {get: () => false}); def('paused', {get: () => false});
  def('resume', {writable: true, value: () => {}});
  def('cancel', {writable: true, value: () => { T.log.push({k: 'cancel'}); }});
  def('speak', {writable: true, value: u => {
    T.log.push({k: 'speak', text: String(u.text), lang: String(u.lang || ''), voice: u.voice ? u.voice.name : null});
    setTimeout(() => { try { u.onend && u.onend({}); } catch (e) {} }, 60); }});
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t == null ? '' : String(t); this.lang = ''; this.rate = 1;
    this.pitch = 1; this.volume = 1; this.voice = null; this.onstart = this.onend = this.onerror = this.onboundary = null; } };
})
"""
_SPOKEN = "() => (window.__tts ? __tts.log : []).filter(e => e.k === 'speak' && e.text.trim())"
_SAY_SPY = """() => { if (window.__said) return; window.__said = []; const s0 = window.say;
  window.say = function (t) { __said.push(String(t)); return s0.apply(this, arguments); }; }"""
_TOAST_SPY = """() => { if (window.__toasts) return; window.__toasts = []; const t0 = M.toast;
  M.toast = function (t, o) { window.__toasts.push(String(t)); return t0.apply(this, arguments); }; }"""
_NO_ES = [v for v in V.ANDROID if not v["lang"].lower().startswith("es")]


def _page(w=390, h=844, voices=None, large=False, keys=None, hash="", **kw):
    page = C.new_page("phone" if w < 800 else "desk", viewport={"width": w, "height": h}, **kw)
    if voices is not None:
        page.add_init_script(f"{_TTS}({json.dumps(voices, ensure_ascii=False)})")
    k = C.seed_keys() if keys is None else dict(keys)
    if large:
        k["vocab:ui"] = json.dumps({"text": "large"})
    C.seed(page, keys=k, hash=hash)
    return page


def _fits(page, label, probs):
    m = page.evaluate(_FIT)
    if m["sh"] > m["ih"] + 2:
        probs.append(f"{label}: Hoy necesita scroll ({m['sh']} > {m['ih']})")


def _rect(page, sel):
    return page.evaluate("""s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null;
      const r = e.getBoundingClientRect(); return {x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom}; }""", sel)


def _wl_open(page):
    return page.evaluate("() => !!document.querySelector('dialog#wl[open]')")


# ---------------------------------------------------------------- la bienvenida
def test_welcome_first_run_picks_language_and_name():
    """Aparato nuevo con ?hello=on: la hoja sale sola en Hoy, sin hablar antes de un toque; el primer toque (en la
    pregunta) la lee en español; tocar Francés elige el idioma (setLang) y suena «bonjour» con say(), con su IPA y
    lang="fr-FR"; «Siguiente» lee «¿Cómo te llamas?»; «¡Vamos!» guarda el idioma y el nombre y abre la primera lección.
    Ya no vuelve a salir."""
    probs = []
    page = _page(voices=V.ANDROID, keys={}, hash="?hello=on")
    try:
        page.wait_for_selector("dialog#wl[open] .wl-flag", timeout=5000)
        page.wait_for_timeout(500)
        if page.evaluate(_SPOKEN):
            probs.append(f"el zorro habló antes de un toque: {page.evaluate(_SPOKEN)}")
        r = page.evaluate("""() => { const d = document.getElementById('wl'), b = d.getBoundingClientRect();
          return {full: [Math.round(b.width), Math.round(b.height)], vw: innerWidth, vh: innerHeight,
            flags: [...d.querySelectorAll('.wl-flag')].map(f => ({k: f.dataset.lang, h: Math.round(f.getBoundingClientRect().height),
              word: f.querySelector('[lang]').textContent, code: f.querySelector('[lang]').getAttribute('lang'), ipa: !!f.querySelector('.ipa')})),
            skip: (d.querySelector('[data-skip]') || {}).textContent, q: d.querySelector('#wl-q').textContent.trim()}; }""")
        if r["full"] != [r["vw"], r["vh"]]:
            probs.append(f"la hoja no ocupa toda la pantalla: {r['full']} en {r['vw']}×{r['vh']}")
        want = [("english", "hello", "en-GB"), ("français", "bonjour", "fr-FR"), ("dansk", "hej", "da-DK")]
        if [(f["k"], f["word"], f["code"]) for f in r["flags"]] != want or not all(f["ipa"] and f["h"] >= 64 for f in r["flags"]):
            probs.append(f"las banderas: {r['flags']}")
        if r["skip"] != "Saltar" or r["q"] != "¿Qué quieres aprender?":
            probs.append(f"la cabecera: {r['skip']!r}, {r['q']!r}")
        C.shot(page, "inicio-bienvenida-1-phone", OUT, full_page=False)

        page.click("#wl-q span")
        page.wait_for_timeout(200)
        s = page.evaluate(_SPOKEN)
        if not s or s[0]["text"] != "¿Qué quieres aprender?" or not s[0]["lang"].lower().startswith("es") or s[0]["voice"] != "español España":
            probs.append(f"el primer toque no leyó la pregunta en español: {s}")

        page.evaluate(_SAY_SPY)
        page.click(".wl-flag[data-lang='français']")
        page.wait_for_timeout(300)
        r = page.evaluate("() => ({lang, said: __said, pressed: [...document.querySelectorAll('.wl-flag')].map(b => b.getAttribute('aria-pressed'))})")
        if r["lang"] != "français" or r["said"] != ["bonjour"] or r["pressed"] != ["false", "true", "false"]:
            probs.append(f"tocar Francés: {r}")
        C.shot(page, "inicio-bienvenida-1b-frances-phone", OUT, full_page=False)

        n0 = len(page.evaluate(_SPOKEN))
        page.click("[data-next]")
        page.wait_for_selector("#wl-name", timeout=3000)
        page.wait_for_timeout(200)
        s = page.evaluate(_SPOKEN)[n0:]
        if not s or s[0]["text"] != "¿Cómo te llamas?" or not s[0]["lang"].lower().startswith("es"):
            probs.append(f"«Siguiente» no leyó «¿Cómo te llamas?»: {s}")
        r = page.evaluate("""() => { const i = document.getElementById('wl-name'), b = i.getBoundingClientRect();
          return {ph: i.placeholder, h: Math.round(b.height), label: !!document.querySelector('label[for=wl-name]'), go: document.querySelector('[data-go]').textContent.trim()}; }""")
        if r["ph"] != "Tu nombre" or r["h"] < 56 or not r["label"] or r["go"] != "¡Vamos!":
            probs.append(f"el paso del nombre: {r}")
        page.fill("#wl-name", "  Juan   Andrés  ")
        C.shot(page, "inicio-bienvenida-2-phone", OUT, full_page=False)
        page.click("[data-go]")
        page.wait_for_function("() => location.hash.startsWith('#/leccion/')", timeout=5000)
        page.wait_for_timeout(600)
        r = page.evaluate("""async () => { const ls = (await getMap(), lvLessons('A1'));
          return {hash: location.hash, first: '#/leccion/' + ls[0].id, lang: localStorage.getItem('lang'), name: game().name,
            hello: JSON.parse(localStorage.getItem('vocab:ui') || '{}').hello, open: !!document.querySelector('dialog#wl[open]')}; }""")
        if r["hash"] != r["first"] or r["lang"] != '"français"' or r["name"] != "Juan Andrés" or r["hello"] != 1 or r["open"]:
            probs.append(f"«¡Vamos!»: {r}")
        C.goto(page, "?hello=on", reload=True)
        page.wait_for_timeout(700)
        if _wl_open(page):
            probs.append("la bienvenida volvió a salir")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_welcome_skip_holds_toasts_and_when_it_stays_away():
    """«Saltar» la cierra y se queda en Hoy (y no vuelve); mientras está abierta un M.toast espera y sale al cerrarla.
    No sale: sin ?hello=on en un navegador automático, con ?hello=off, con la partida de siempre ni con Google conectado."""
    probs = []
    page = _page(keys={}, hash="?hello=on")
    try:
        page.wait_for_selector("dialog#wl[open]", timeout=5000)
        page.evaluate("() => M.toast('Aviso de prueba')")
        page.wait_for_timeout(500)
        if page.evaluate("() => [...document.querySelectorAll('#m-toasts .m-toast')].some(t => t.textContent.includes('Aviso de prueba'))"):
            probs.append("un aviso salió con la bienvenida abierta")
        page.click("[data-skip]")
        page.wait_for_function("() => !document.querySelector('dialog#wl[open]')", timeout=3000)
        page.wait_for_timeout(700)
        r = page.evaluate("""() => ({hp: hashPath(), hello: JSON.parse(localStorage.getItem('vocab:ui') || '{}').hello,
          toast: [...document.querySelectorAll('#m-toasts .m-toast')].some(t => t.textContent.includes('Aviso de prueba'))})""")
        if r != {"hp": "", "hello": 1, "toast": True}:
            probs.append(f"«Saltar»: {r}")
        C.goto(page, "?hello=on", reload=True)
        page.wait_for_timeout(600)
        if _wl_open(page):
            probs.append("tras «Saltar», volvió a salir")
    finally:
        page.context.close()
    for label, keys, hash in (("sin ?hello=on", {}, ""), ("?hello=off", {}, "?hello=off"), ("con partida", None, "?hello=on"),
                              ("con Google", {"save:sync": json.dumps({"connectedAt": int(time.time() * 1000), "fileId": "f1"})}, "?hello=on")):
        page = _page(keys=keys, hash=hash)
        try:
            page.wait_for_timeout(700)
            if _wl_open(page):
                probs.append(f"{label}: salió la bienvenida")
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_welcome_layout_small_large_dark_and_desktop():
    """A 360×740 con letra grande todo cabe sin scroll (y «Siguiente» se ve); en oscuro y a 1280 también, sin scroll
    de lado; los botones miden 44 px o más."""
    probs = []
    for label, w, h, large, scheme in (("360 grande", 360, 740, True, "light"), ("390 oscuro", 390, 844, False, "dark"), ("1280", 1280, 800, False, "light")):
        page = _page(w, h, large=large, keys={}, hash="?hello=on", color_scheme=scheme)
        try:
            page.wait_for_selector("dialog#wl[open] .wl-flag", timeout=5000)
            page.wait_for_timeout(400)
            r = page.evaluate("""() => { const d = document.getElementById('wl'), nx = d.querySelector('[data-next]').getBoundingClientRect();
              return {sh: d.scrollHeight, ch: d.clientHeight, sw: d.scrollWidth, cw: d.clientWidth, next: nx.bottom <= innerHeight + 1,
                small: [...d.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => b.getBoundingClientRect())
                  .filter(b => b.height < 43.5 || b.width < 43.5).length}; }""")
            if r["sh"] > r["ch"] + 1 or r["sw"] > r["cw"] + 1 or not r["next"] or r["small"]:
                probs.append(f"{label}: {r}")
            name = "inicio-bienvenida-" + label.replace(" ", "-")
            C.shot(page, name, OUT, full_page=False)
            page.click("[data-next]")
            page.wait_for_selector("#wl-name", timeout=3000)
            page.wait_for_timeout(300)
            r = page.evaluate("() => { const d = document.getElementById('wl'); return {sh: d.scrollHeight, ch: d.clientHeight}; }")
            if r["sh"] > r["ch"] + 1:
                probs.append(f"{label}, el nombre: necesita scroll {r}")
            C.shot(page, name + "-2", OUT, full_page=False)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- el zorro lee Hoy
def test_fox_reads_hoy_and_missions_aloud_in_spanish():
    """Con voz española: el altavoz sale en el bocadillo; nada suena hasta tocar; al tocar el zorro lee el bocadillo, el
    título y «Toca el botón azul.» con la voz española. Cada fila de Misiones (y el cofre) lleva su altavoz, que lee su
    misión. Sin voz española en el aparato no hay ningún altavoz del zorro."""
    probs = []
    page = _page(voices=V.ANDROID)
    try:
        page.wait_for_timeout(600)
        if page.evaluate(_SPOKEN):
            probs.append(f"Hoy habló sin un toque: {page.evaluate(_SPOKEN)}")
        r = page.evaluate("""() => ({es: document.documentElement.hasAttribute('data-es-voice'), spk: !!document.querySelector('.hm-spk').getClientRects().length,
          label: document.getElementById('hm-read').getAttribute('aria-label'), say: document.querySelector('.hm-st').textContent, t: document.getElementById('hm-t').textContent})""")
        if not r["es"] or not r["spk"] or not r["label"].startswith("Escuchar al zorro: "):
            probs.append(f"con voz española: {r}")
        page.click("#hm-read")
        page.wait_for_timeout(200)
        s = page.evaluate(_SPOKEN)
        dot = lambda t: t if t[-1] in ".!?…" else t + "."
        want = f"{dot(r['say'])} {dot(r['t'].replace(' · ', '. '))} Toca el botón azul."
        if len(s) != 1 or s[0]["text"] != want or s[0]["voice"] != "español España" or not s[0]["lang"].lower().startswith("es"):
            probs.append(f"tocar el zorro: {s} (esperaba {want!r})")
        C.shot(page, "inicio-hoy-zorro-lee-phone", OUT, full_page=False)
        page.click("#bd-mis")
        page.wait_for_selector("dialog#bd-mis-s[open] .bd-spk", timeout=3000)
        page.wait_for_timeout(400)
        r = page.evaluate("""() => [...document.querySelectorAll('#bd-mis-s .bd-row')].map(row => { const b = row.querySelector('.bd-spk');
          return {k: row.dataset.k || 'chest', spk: !!(b && b.getClientRects().length), w: b ? Math.round(b.getBoundingClientRect().width) : 0}; })""")
        if len(r) != 4 or not all(x["spk"] and x["w"] >= 44 for x in r):
            probs.append(f"altavoces de Misiones: {r}")
        n0 = len(page.evaluate(_SPOKEN))
        page.click("#bd-mis-s .bd-row[data-k] .bd-spk")
        page.wait_for_timeout(200)
        s = page.evaluate(_SPOKEN)[n0:]
        first = page.evaluate("() => document.querySelector('#bd-mis-s .bd-row[data-k] b').textContent")
        if len(s) != 1 or not s[0]["text"].startswith(first) or not s[0]["lang"].lower().startswith("es"):
            probs.append(f"el altavoz de la misión: {s}")
        C.shot(page, "inicio-misiones-altavoces-phone", OUT, full_page=False)
    finally:
        page.context.close()
    page = _page(voices=_NO_ES)
    try:
        page.wait_for_timeout(500)
        r = page.evaluate("() => ({es: document.documentElement.hasAttribute('data-es-voice'), spk: !!document.querySelector('.hm-spk').getClientRects().length})")
        page.click("#bd-mis")
        page.wait_for_selector("dialog#bd-mis-s[open]", timeout=3000)
        r["rows"] = page.evaluate("() => [...document.querySelectorAll('#bd-mis-s .bd-spk')].filter(b => b.getClientRects().length).length")
        if r != {"es": False, "spk": False, "rows": 0}:
            probs.append(f"sin voz española: {r}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la meta del día
def test_daily_goal_ring_week_and_done_card():
    """Misiones lleva un anillo de 3 trozos (uno verde azulado por misión cumplida) y no los 3 puntos; debajo de las
    piezas, la semana L…D con la llama y los días seguidos (no en un móvil bajo). Con las 3 recogidas y el cofre abierto,
    la tarjeta dice «¡Lo de hoy, hecho!» con la Granja y los Juegos y confeti una sola vez; Hoy sigue sin scroll."""
    probs = []
    page = _page()
    try:
        page.evaluate(_MIS, [[["les", 1, 1, True], ["ans", 15, 3, False], ["game", 1, 0, False]], False])
        C.goto(page, "#/mapa")
        C.goto(page, "")
        page.wait_for_timeout(400)
        r = page.evaluate("""() => ({c: [...document.querySelectorAll('#bd-mis .bd-ring circle')].map(c => c.classList.contains('on')),
          dots: !!document.querySelector('#bd-mis .bd-dots'), label: document.getElementById('bd-mis').getAttribute('aria-label'),
          week: [...document.querySelectorAll('#hm-week li')].map(l => l.textContent), fire: (document.querySelector('#hm-week .hm-wf') || {}).textContent,
          streak: streak(), wlabel: (document.getElementById('hm-week') || {getAttribute: () => ''}).getAttribute('aria-label')})""")
        if r["c"] != [True, False, False] or r["dots"] or "1 de 3 hechas" not in r["label"]:
            probs.append(f"el anillo: {r}")
        if r["week"] != list("LMXJVSD") or r["fire"] != str(r["streak"]) or (r["streak"] and "seguido" not in (r["wlabel"] or "")):
            probs.append(f"la semana: {r}")
        _fits(page, "390 con la semana", probs)
        C.shot(page, "inicio-hoy-anillo-semana-phone", OUT, full_page=False)

        page.evaluate("""() => { window.__cf = 0; const c0 = M.confetti; M.confetti = function () { __cf++; return c0.apply(this, arguments); }; }""")
        page.evaluate(_MIS, [[["les", 1, 1, True], ["ans", 15, 15, True], ["game", 1, 1, True]], True])
        C.goto(page, "#/mapa")
        C.goto(page, "")
        page.wait_for_timeout(700)
        r = page.evaluate("""() => ({t: document.getElementById('hm-t').textContent, go: document.getElementById('hm-go').getAttribute('href'),
          go2: (document.getElementById('hm-go2') || {getAttribute: () => null}).getAttribute('href'), cf: __cf, all: !!document.querySelector('#bd-mis .bd-ring.all')})""")
        if r != {"t": "¡Lo de hoy, hecho!", "go": "#/granja", "go2": "#/juegos", "cf": 1, "all": True}:
            probs.append(f"«¡Lo de hoy, hecho!»: {r}")
        _fits(page, "390 hecho", probs)
        C.shot(page, "inicio-hoy-hecho-phone", OUT, full_page=False)
        C.goto(page, "#/mapa")
        C.goto(page, "")
        page.wait_for_timeout(600)
        if page.evaluate("() => __cf") != 1:
            probs.append("el confeti de «hecho» salió otra vez")
    finally:
        page.context.close()
    page = _page(360, 740)
    try:
        page.wait_for_timeout(300)
        r = page.evaluate("() => { const w = document.getElementById('hm-week'); return w ? getComputedStyle(w).display : 'none'; }")
        if r != "none":
            probs.append(f"360×740: la semana se ve ({r})")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_chest_surprise_is_seeded_by_day_and_paid():
    """chestPrize(día): la misma todo el día; de media unas 25 monedas (15–40), el huevo de oro 1 vez de cada 10 y la
    comida solo en lugar de 25. Abrir el cofre paga la de hoy (sin granja que la reciba, en monedas) y, al cerrar la hoja,
    Hoy dice «¡Lo de hoy, hecho!»; nada habla de «mañana». El cofre de un día con las 3 cumplidas y sin abrir no caduca:
    al día siguiente sale «¡Un cofre sin abrir!» y paga la sorpresa de su día."""
    probs = []
    page = _page()
    try:
        r = page.evaluate("""() => { const B = vocabBuddy, P = [];
          for (let i = 0; i < 3000; i++) P.push(B.chestPrize(dayKey(new Date(2026, 0, 1 + i))));
          const d = dayKey(new Date());
          return {same: JSON.stringify(B.chestPrize(d)) === JSON.stringify(B.chestPrize(d)), avg: P.reduce((a, p) => a + p.c, 0) / P.length,
            cs: [...new Set(P.map(p => p.c))].sort((a, b) => a - b), egg: P.filter(p => p.egg).length / P.length,
            food: [...new Set(P.filter(p => p.food).map(p => p.c + ':' + p.food))]}; }""")
        if not r["same"] or not 22 <= r["avg"] <= 28 or r["cs"] != [15, 20, 25, 30, 40] or not .07 <= r["egg"] <= .13 or r["food"] != ["25:3"]:
            probs.append(f"chestPrize: {r}")
        page.evaluate(_MIS, [[["les", 1, 1, True], ["ans", 15, 15, True], ["game", 1, 1, True]], False])
        C.goto(page, "#/mapa")
        C.goto(page, "")
        c0 = page.evaluate("() => game().coins")
        p = page.evaluate("() => vocabBuddy.chestPrize(dayKey(new Date()))")
        page.click("#bd-mis")
        page.wait_for_selector("dialog#bd-mis-s[open] [data-chest]", timeout=3000)
        if page.evaluate("() => document.querySelector('[data-chest]').textContent.trim()") != "Abrir":
            probs.append("el botón del cofre no dice solo «Abrir»")
        page.click("[data-chest]")
        page.wait_for_timeout(1500)
        r = page.evaluate("() => ({coins: game().coins, M: JSON.parse(localStorage.getItem('buddy:missions'))})")
        if r["coins"] - c0 != p["c"] or not r["M"]["chest"] or r["M"]["prize"].get("c") != p["c"]:
            probs.append(f"abrir el cofre: {c0} → {r['coins']} (premio {p}), {r['M'].get('prize')}")
        C.shot(page, "inicio-cofre-abierto-phone", OUT, full_page=False)
        if "mañana" in page.evaluate("() => document.getElementById('bd-mis-s').textContent").lower():
            probs.append("la hoja de Misiones habla de mañana")
        page.click("#bd-mis-s [data-close]")
        page.wait_for_function("() => (document.getElementById('hm-t') || {}).textContent === '¡Lo de hoy, hecho!'", timeout=4000)
        if "mañana" in page.evaluate("() => document.getElementById('hm').textContent").lower():
            probs.append("Hoy habla de mañana")

        # un cofre ganado ayer y sin abrir no caduca: hoy sigue ahí, con la sorpresa de su día
        page.evaluate("""() => { const d = new Date(); d.setDate(d.getDate() - 1); store.set('buddy:missions', {day: dayKey(d), chest: false,
          list: [['les', 1], ['ans', 15], ['game', 1]].map(([k, g]) => ({k, goal: g, n: g, s: g, got: true}))}); }""")
        C.goto(page, "#/mapa")
        C.goto(page, "")
        page.wait_for_timeout(300)
        y = page.evaluate("() => { const d = new Date(); d.setDate(d.getDate() - 1); return vocabBuddy.chestPrize(dayKey(d)); }")
        mt = page.evaluate("() => document.querySelector('#bd-mis .bd-mt').textContent")
        if mt != "¡Tienes un cofre sin abrir!":
            probs.append(f"la pieza con un cofre de ayer: {mt!r}")
        page.click("#bd-mis")
        page.wait_for_selector("dialog#bd-mis-s[open] [data-owed]", timeout=3000)
        if page.evaluate("() => document.querySelector('[data-owed]').textContent.trim()") != "Abrir":
            probs.append("el cofre de ayer anuncia lo que da")
        C.shot(page, "inicio-cofre-de-ayer-phone", OUT, full_page=False)
        c0 = page.evaluate("() => game().coins")
        page.click("[data-owed]")
        page.wait_for_timeout(1500)
        r = page.evaluate("() => ({coins: game().coins, owed: JSON.parse(localStorage.getItem('buddy:missions')).owed || null})")
        if r["coins"] - c0 != y["c"] or r["owed"]:
            probs.append(f"abrir el cofre de ayer: {c0} → {r['coins']} (premio {y}), owed {r['owed']}")
    except Exception as e:  # noqa: BLE001
        probs.append(f"el cofre: {e}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_first_practice_of_the_day_is_a_visible_surprise():
    """award() ya no regala 10 monedas a escondidas y Hoy no anuncia ningún regalo: la primera lección o el primer
    repaso terminados del día dan 10 monedas más, al final, con «¡Sorpresa! +10 por tu primera práctica de hoy» (las
    monedas vuelan). Una vez al día; jugar no lo da."""
    probs = []
    page = _page()
    try:
        page.evaluate("() => { const g = game(); g.day = ''; gameSet(g); }")
        C.goto(page, "#/mapa")
        page.evaluate(_TOAST_SPY)
        page.evaluate("() => { window.__fly = 0; const c0 = M.coins; M.coins = function () { __fly++; return c0.apply(this, arguments); }; }")
        c0 = page.evaluate("() => game().coins")
        page.evaluate("() => award(5, 'prueba', true)")
        page.evaluate("() => bus.emit('game-done', {game: 'globos', tp: 'animales'})")
        page.wait_for_timeout(1800)
        r = page.evaluate("() => ({c: game().coins, day: game().day})")
        if r["c"] - c0 != 5 or r["day"] != "":
            probs.append(f"award(5) y una partida dieron {r['c'] - c0} y apuntaron el día {r['day']!r}")
        C.goto(page, "")
        page.wait_for_timeout(300)
        r = page.evaluate("() => ({gift: !!document.querySelector('#hm-gift, .hm-gift'), text: document.getElementById('hm').textContent})")
        if r["gift"] or "egalo" in r["text"]:
            probs.append("Hoy anuncia un regalo")
        _fits(page, "Hoy", probs)
        c1 = page.evaluate("() => game().coins")
        page.evaluate("() => bus.emit('review-done', {n: 10})")
        page.wait_for_timeout(2000)
        r = page.evaluate("() => ({c: game().coins, day: game().day === dayKey(new Date()), toasts: __toasts, fly: __fly})")
        if r["c"] - c1 != 10 or not r["day"] or "¡Sorpresa! +10 por tu primera práctica de hoy" not in r["toasts"] or r["fly"] < 1:
            probs.append(f"el primer repaso del día: {r} (antes {c1})")
        page.evaluate("() => bus.emit('lesson-done', {id: 'A1-001', lv: 'A1', stars: 3, first: false})")
        page.wait_for_timeout(2000)
        if page.evaluate("() => game().coins") != c1 + 10:
            probs.append("la sorpresa salió dos veces el mismo día")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- arreglos
def test_season_is_reachable_from_hoy_on_a_small_phone():
    """360×740, letra grande, Halloween: aunque la fila de la temporada no quepa, el dibujo de la esquina de la tarjeta
    es un enlace de 44 px a #/temporada con su nombre, sin tapar el bocadillo del zorro."""
    probs = []
    page = _page(360, 740, large=True, hash="#/?season=halloween")
    try:
        page.wait_for_selector("#ss-hd", timeout=4000)
        page.wait_for_timeout(300)
        r = page.evaluate("""() => { const a = document.getElementById('ss-hd'), b = a.getBoundingClientRect(), s = document.querySelector('#hm-read .hm-say').getBoundingClientRect();
          return {href: a.getAttribute('href'), label: a.getAttribute('aria-label'), w: Math.round(b.width), h: Math.round(b.height),
            inView: b.top >= 0 && b.right <= innerWidth, over: !(b.right <= s.left || b.left >= s.right || b.bottom <= s.top || b.top >= s.bottom)}; }""")
        if r != {"href": "#/temporada", "label": "Truco o trato", "w": 44, "h": 44, "inView": True, "over": False}:
            probs.append(f"el enlace de la temporada: {r}")
        _fits(page, "360 grande Halloween", probs)
        C.shot(page, "inicio-temporada-360-grande", OUT, full_page=False)
        page.click("#ss-hd")
        page.wait_for_function("() => location.hash.startsWith('#/temporada')", timeout=4000)
    except Exception as e:  # noqa: BLE001
        probs.append(f"la temporada: {e}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_missions_link_to_the_activity_and_answers_have_a_star():
    """«Termina…» y «Acierta…» llevan a la siguiente lección (#/leccion/<id>; con todo hecho, #/mapa); «Juega…» al último
    juego con su tema (sin ninguno, #/juegos). «Acierta…» lleva una estrella, no la ✓."""
    probs = []
    page = _page()
    try:
        page.evaluate(_MIS, [[["les", 1, 0, False], ["ans", 15, 2, False], ["game", 1, 0, False]], False])
        C.goto(page, "#/mapa")
        C.goto(page, "")
        page.click("#bd-mis")
        page.wait_for_selector("dialog#bd-mis-s[open] a.bd-go", timeout=3000)
        page.wait_for_timeout(400)
        r = page.evaluate("""async () => ({next: '#/leccion/' + (await nextLesson()).l.id, sc: vocabShortcuts.lastGame(),
          links: Object.fromEntries([...document.querySelectorAll('#bd-mis-s a.bd-go')].map(a => [a.dataset.go, a.getAttribute('href')])),
          star: !!document.querySelector('#bd-mis-s .bd-row[data-k=ans] use[href^="#i-star-"]'),
          check: !!document.querySelector('#bd-mis-s .bd-row[data-k=ans] use[href^="#i-check-"]')})""")
        game = r["sc"]["href"] if r["sc"] else "#/juegos"
        if r["links"] != {"les": r["next"], "ans": r["next"], "game": game} or not r["star"] or r["check"]:
            probs.append(f"las filas: {r}")
        page.click("#bd-mis-s [data-close]")
        page.wait_for_timeout(300)
        page.evaluate("() => bus.emit('game-done', {game: 'globos', tp: 'animales'})")
        r = page.evaluate("() => vocabBuddy.hrefOf('game')")
        if not r.startswith("#/juegos/globos?t=animales"):
            probs.append(f"«Juega…» tras una partida de Globos: {r}")
        page.evaluate(_ALL_DONE)
        C.goto(page, "#/mapa")
        C.goto(page, "")
        page.wait_for_timeout(400)
        r = page.evaluate("() => [vocabBuddy.hrefOf('les'), vocabBuddy.hrefOf('ans')]")
        if r != ["#/mapa", "#/mapa"]:
            probs.append(f"con todo el camino hecho: {r}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_no_google_button_in_the_top_bar():
    """La «G» de Google no está en la barra de arriba (ni sin Google ni conectado): solo en Ajustes › Para mayores."""
    probs = []
    for label, keys in (("aparato nuevo", {}), ("partida", None)):
        page = _page(keys=keys)
        try:
            page.wait_for_timeout(500)
            r = page.evaluate("() => { const b = document.getElementById('tb-google'); return !!(b && !b.hidden && b.getClientRects().length); }")
            if r:
                probs.append(f"{label}: la G está arriba")
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- los dibujos y Hoy sin scroll
def test_card_tiles_and_hoy_fits_without_scroll():
    """La tarjeta enseña 3 dibujos de 64 px de lo que toca (3 palabras pendientes en el repaso, los de la lección), 2 de
    48 px en un móvil bajo. Hoy no necesita scroll a 360×740 ni a 390×844, con letra normal o grande, con el repaso, la
    lección, «hecho» y Halloween."""
    probs = []
    for w, h in ((390, 844), (360, 740)):
        for large in (False, True):
            tag = f"{w}×{h}{' grande' if large else ''}"
            page = _page(w, h, large=large)
            try:
                page.wait_for_function("() => [...document.querySelectorAll('.hm-tile img')].every(i => i.complete)", timeout=5000)
                r = page.evaluate("""() => [...document.querySelectorAll('.hm-tile')].filter(t => t.getClientRects().length && getComputedStyle(t).display !== 'none')
                  .map(t => ({w: Math.round(t.getBoundingClientRect().width), ok: t.querySelector('img').complete && t.querySelector('img').naturalWidth > 0}))""")
                notiles = page.evaluate("() => document.getElementById('hm-hero').classList.contains('hm-notiles')")
                if not notiles:
                    want = [{"w": 64, "ok": True}] * 3 if h > 760 else [{"w": 48, "ok": True}] * 2
                    if r != want:
                        probs.append(f"{tag}, repaso: dibujos {r}")
                elif not large:
                    probs.append(f"{tag}: sin dibujos con letra normal")
                _fits(page, f"{tag} repaso", probs)
                if not large:
                    C.shot(page, f"inicio-hoy-{w}-repaso", OUT, full_page=False)
                page.evaluate(_FEW)
                C.goto(page, "#/mapa")
                C.goto(page, "")
                page.wait_for_timeout(400)
                r = page.evaluate("""async () => { const L = await nextLesson(), imgs = [...document.querySelectorAll('.hm-tile img')].map(i => i.getAttribute('src'));
                  await Promise.all([...new Set(L.l.w.map(([d]) => d))].map(d => getDoc(d)));
                  const mine = L.l.w.map(([d, k]) => (CACHE[d].rows || [])[k]).filter(r => r && r.img).map(r => r.img);
                  return {kind: document.getElementById('hm-go').dataset.kind, imgs, ok: imgs.every(s => mine.includes(s))}; }""")
                if r["kind"] != "leccion" or not r["ok"] or len(r["imgs"]) != 3:
                    probs.append(f"{tag}, lección: {r}")
                _fits(page, f"{tag} lección", probs)
                C.shot(page, f"inicio-hoy-{w}{'-grande' if large else ''}-leccion", OUT, full_page=False)
                page.evaluate(_MIS, [[["les", 1, 1, True], ["ans", 15, 15, True], ["game", 1, 1, True]], True])
                C.goto(page, "#/mapa")
                C.goto(page, "?season=halloween")
                page.wait_for_timeout(500)
                _fits(page, f"{tag} hecho con Halloween", probs)
                if large:
                    C.shot(page, f"inicio-hoy-{w}-grande-hecho-halloween", OUT, full_page=False)
                if C.errors(page):
                    probs.append(f"{tag}: errores {C.errors(page)}")
            finally:
                page.context.close()
    page = _page(1280, 800, color_scheme="dark")
    try:
        page.wait_for_timeout(400)
        C.shot(page, "inicio-hoy-1280-oscuro", OUT, full_page=False)
        r = page.evaluate("() => ({sw: document.documentElement.scrollWidth, vw: innerWidth, tiles: document.querySelectorAll('.hm-tile').length})")
        if r["sw"] > r["vw"] or r["tiles"] != 3:
            probs.append(f"1280: {r}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
