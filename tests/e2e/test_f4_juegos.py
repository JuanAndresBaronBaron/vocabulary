"""F4a: Juegos (js/games.js) y el juego nuevo Oído de lince (js/lince.js, data/lince.json).

Juegos (plan-doc «Jugar › Juegos»): sin el zorro «¡A jugar!», «← Inicio», «✨ ¡Pruébalo!» ni #gm-tpanel; tarjetas sólidas
(radio 24, el color solo en el dibujo) con el récord en estrellas de oro; la pastilla «Tema: … ▾» abre una hoja con «Mis
palabras» primero y luego los temas, y lo elegido se recuerda ("games:topic"); la explicación solo la primera vez de cada
juego (y el «?» la vuelve a mostrar con la partida en pausa); al recargar sale la tarjeta corta «¡A jugar!»; mantener
pulsada una tarjeta abre el vistazo y tocar juega; cada juego termina y llama a award una sola vez con las monedas
volando desde «+N»; Esc y la ✕ abren la pausa; los fallos en gris con ✗ en los 4 juegos y en Lince.
Oído de lince: 8 rondas con aciertos (verde con ✓, vuelve a sonar) y fallos (la elegida gris con ✗, suenan las dos),
suena el audio grabado correcto (se intercepta HTMLMediaElement.play), altavoz y tortuga (despacio), teclas 1/2, la pausa
espera y el récord se guarda. data/lince.json válido (≥ 12 pares por idioma, palabras del corpus, todos los audios y
dibujos existen). Contraste y paleta, sin bucles infinitos, sin errores de consola y la partida exportada como la base."""
from __future__ import annotations

import json
import re

import common as C

_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""
OUT = C.CAPTURAS / "F4"
GAMES = ["memoria", "lluvia", "globos", "letras", "lince"]
# los juegos en grupo de js/party.js (El impostor y Ordenar por grupo) y el Pajarito volador (js/flyer.js), con su
# chip «Nuevo» como «Oído de lince»
CARDS = GAMES + ["impostor", "ordenar", "pajarito"]
FRESH = {"lince", "impostor", "ordenar", "pajarito"}
AB = {"english": "en", "français": "fr", "dansk": "da"}
_ARTS = {"english": re.compile(r"^(?:the|an?|to)\s+", re.I),   # los artículos de js/lince.js (ARTS)
         "français": re.compile(r"^(?:les|le|la|une|un|des|du|se)\s+|^(?:l|s|d)['’]", re.I),
         "dansk": re.compile(r"^(?:en|et|at)\s+", re.I)}

# ganchos: audio simulado (cada play() se apunta con su velocidad y acaba a los 40 ms), award, el bus de monedas,
# sonidos y lo que se dice
_HOOKS = """() => {
  if (window.__gm) return; window.__gm = true;
  window.__played = []; window.__aw = []; window.__coins = []; window.__sfx = []; window.__said = [];
  HTMLMediaElement.prototype.play = function () {
    /* r: la ronda de Oído de lince que sonaba (un número por cada juego de tarjetas pintado; 0 fuera de Lince) */
    const lc = document.querySelector('#ln-cards .ln-c'); if (lc && lc.__r == null) lc.__r = (window.__lnR = (window.__lnR || 0) + 1);
    __played.push({src: this.getAttribute('src') || '', rate: this.playbackRate, r: lc ? lc.__r : 0});
    const a = this; setTimeout(() => a.dispatchEvent(new Event('ended')), 40); return Promise.resolve(); };
  const a0 = window.award;
  window.award = (...x) => { __aw.push({n: x[0], why: x[1], quiet: !!x[2], from: (x[3] && x[3].id) || null, live: !!(x[3] && x[3].isConnected)}); return a0(...x); };
  bus.on('coins', d => __coins.push({n: d.n, fly: !!d.fly}));
  if (window.sfx) { const p0 = sfx.play.bind(sfx); sfx.play = n => { __sfx.push(n); return p0(n); }; }
  const s0 = window.say; window.say = (t, b, slow) => { __said.push(t); return s0(t, b, slow); };
}"""
# la pista «Mantén para ver» ya aprendida (para que no tape nada en las pruebas que no la miran)
_NO_HINT = """() => { let o = {}; try { o = JSON.parse(localStorage.getItem('vocab:ui') || '{}') || {}; } catch (e) {}
  o.hints = Object.assign({}, o.hints, {'gm-peek': 1000}); localStorage.setItem('vocab:ui', JSON.stringify(o)); }"""
_COINS = "() => JSON.parse(localStorage.getItem('game')).coins"
_BEST = "() => JSON.parse(localStorage.getItem('games:best') || '{}')"
_ENDLESS = """() => document.getAnimations().filter(a => { try { const t = a.effect.getComputedTiming();
  return t.iterations === Infinity && a.playState === 'running'; } catch (e) { return false; } })
  .map(a => (a.animationName || a.id || 'anim') + ' @ ' + ((a.effect.target && (a.effect.target.id || a.effect.target.className)) || '?'))"""


def _rgb(c):
    m = [float(x) for x in re.findall(r"[\d.]+", c or "")[:4]]
    return m if len(m) >= 3 else None


def _gray(c):
    m = _rgb(c)
    return bool(m) and max(m[:3]) - min(m[:3]) <= 24


def _green(c):
    m = _rgb(c)
    return bool(m) and m[1] > m[0] + 40 and m[1] > m[2] + 30


def _open(page, keys=None, hint=False, kind_hash="#/juegos"):
    C.seed(page, keys)
    if not hint:
        page.evaluate(_NO_HINT)
    C.goto(page, kind_hash)
    page.evaluate(_HOOKS)


def _start(page, g, intro="auto"):
    """Toca la tarjeta del juego en el menú; con intro="auto" pulsa «¡A jugar!» si sale la explicación."""
    page.locator(f'.gm-card[data-g="{g}"]').click()
    page.wait_for_function("g => document.documentElement.dataset.gmPlay === g", arg=g, timeout=8000)
    page.wait_for_timeout(250)
    shown = page.locator(".gm-intro .gm-go").count() > 0
    if intro == "auto" and shown:
        page.locator(".gm-intro .gm-go").click()
        page.wait_for_timeout(150)
    return shown


def _to_menu(page):
    page.wait_for_timeout(700)   # el resultado no hace caso a los botones los primeros 0,6 s
    if page.locator("#gm-menu-b").count():
        page.locator("#gm-menu-b").click()
    else:
        page.evaluate("() => { location.hash = '#/juegos'; }")
    page.wait_for_selector("#gm-cards", timeout=5000)
    page.wait_for_timeout(150)


# ---------------------------------------------------------------- jugar cada juego hasta el final
def _play_memoria(page):
    kinds = page.evaluate("() => [...document.querySelectorAll('#gm-board .gm-mc')].map(b => b.querySelector('.gm-mc-face img') ? 'i' : 'w')")
    imgs = [k for k, v in enumerate(kinds) if v == "i"]
    words = [k for k, v in enumerate(kinds) if v == "w"]
    seen_miss = None
    for a in imgs:
        for b in list(words):
            page.evaluate("([a, b]) => { const q = k => document.querySelector(`#gm-board .gm-mc[data-k=\"${k}\"]`); q(a).click(); q(b).click(); }", [a, b])
            page.clock.fast_forward(600)
            st = page.evaluate("""a => { const el = document.querySelector(`#gm-board .gm-mc[data-k="${a}"]`); if (!el) return null;
              const f = el.querySelector('.gm-mc-face'), af = getComputedStyle(el, '::after');
              return {ok: el.classList.contains('ok'), no: el.classList.contains('no'), border: getComputedStyle(f).borderTopColor, badge: af.backgroundColor, mark: af.content}; }""", a)
            if st and st["no"] and seen_miss is None:
                seen_miss = st
            page.clock.fast_forward(800)
            page.wait_for_timeout(30)
            if page.locator("#gm-end").count():
                return seen_miss
            if page.evaluate("a => document.querySelector(`#gm-board .gm-mc[data-k=\"${a}\"]`).classList.contains('ok')", a):
                words.remove(b)
                break
    page.clock.fast_forward(1600)
    page.wait_for_selector("#gm-end", timeout=5000)
    return seen_miss


def _play_lluvia(page):
    """Pierde las 3 vidas tocando burbujas que no son la pedida (la pedida es la última palabra dicha)."""
    page.wait_for_function("() => __said.length > 0", timeout=5000)
    miss = None
    for _ in range(120):
        if page.locator("#gm-end").count():
            break
        r = page.evaluate("""() => { const t = __said[__said.length - 1];
          const b = [...document.querySelectorAll('#gm-sky .gm-bub:not(.bad):not(.pop):not(.gone)')].find(x => x.getAttribute('aria-label') !== t && !x.disabled
            && x.getBoundingClientRect().top > document.getElementById('gm-sky').getBoundingClientRect().top);
          if (!b) return null; b.click();
          const f = document.querySelector('#gm-sky .gm-float.bad');
          return {border: getComputedStyle(b.querySelector('.gm-bub-i')).borderTopColor, float: f ? getComputedStyle(f).backgroundColor : null,
            text: f ? f.textContent : null}; }""")
        if r and miss is None:
            miss = r
        page.wait_for_timeout(250)
    page.wait_for_selector("#gm-end", timeout=8000)
    return miss


def _play_globos(page):
    miss = None
    for _ in range(10):
        page.wait_for_function("() => document.querySelectorAll('#gm-air .gm-bal:not(:disabled)').length === 4 && !document.querySelector('.gm-reveal')", timeout=6000)
        for k in range(4):
            r = page.evaluate("""k => { if (document.querySelector('.gm-reveal')) return 'done';
              const b = document.querySelector(`#gm-air .gm-bal[data-k="${k}"]`); if (!b || b.disabled) return 'skip';
              b.click();
              if (b.classList.contains('no')) { const x = b.querySelector('.gm-bx'), cs = getComputedStyle(x);
                return {bg: cs.backgroundColor, color: cs.color, mark: x.textContent, shown: cs.display !== 'none'}; }
              return 'clicked'; }""", k)
            if isinstance(r, dict) and miss is None:
                miss = r
            if r == "done" or page.locator(".gm-reveal").count():
                break
        page.clock.fast_forward(2000)
        page.wait_for_timeout(30)
        if page.locator("#gm-end").count():
            break
    page.wait_for_selector("#gm-end", timeout=5000)
    return miss


def _play_letras(page):
    miss = None
    for w in range(5):
        page.wait_for_selector("#gm-hint", timeout=5000)
        if w == 0:
            # las letras en el orden en que salen (nunca es el bueno): fallo en gris con ✗
            page.evaluate("() => document.querySelectorAll('#gm-tiles .gm-tile').forEach(t => t.click())")
            page.wait_for_selector(".gm-slot.wrong", timeout=3000)
            miss = page.evaluate("""() => { const s = document.querySelector('.gm-slot.wrong'), cs = getComputedStyle(s), af = getComputedStyle(s, '::after');
              return {bg: cs.backgroundColor, border: cs.borderTopColor, badge: af.backgroundColor, mark: af.content}; }""")
            page.wait_for_function("() => !document.querySelector('.gm-slot.wrong')", timeout=3000)
        for _ in range(12):
            if page.locator("#gm-next").count():
                break
            page.evaluate("() => document.querySelector('#gm-hint') && document.querySelector('#gm-hint').click()")
            page.wait_for_timeout(330)
        page.wait_for_selector("#gm-next", timeout=3000)
        page.evaluate("() => document.querySelector('#gm-next').click()")
    page.wait_for_selector("#gm-end", timeout=5000)
    return miss


# la tarjeta buena de la ronda de Lince: la del último audio que sonó en ESTA ronda (-1 hasta que suene). Lo último de la
# ronda anterior es su palabra buena otra vez: si esa palabra vuelve en el par nuevo, se tocaba antes de oír la nueva
_LN_TARGET = """() => { const p = __played[__played.length - 1] || {}, c0 = document.querySelector('#ln-cards .ln-c');
  if (!c0 || c0.__r == null || p.r !== c0.__r) return -1;
  const last = p.src || '';
  return [...document.querySelectorAll('#ln-cards .ln-c')].findIndex(c => { const id = clipFor(c.dataset.w); return id && last.endsWith('/' + id + '.mp3'); }); }"""
_LN_READY = "() => document.querySelectorAll('#ln-cards .ln-c').length === 2 && !document.getElementById('ln').classList.contains('ln-done') && __played.length > 0"
_LN_STATE = """() => [...document.querySelectorAll('#ln-cards .ln-c')].map(c => { const mk = c.querySelector('.ln-mk'), cs = getComputedStyle(c);
  return {cls: c.className, w: c.dataset.w, bg: cs.backgroundColor, color: cs.color, shadow: cs.boxShadow, anim: cs.animationName,
    mk: getComputedStyle(mk).display !== 'none' ? (mk.querySelector('use') || {getAttribute: () => ''}).getAttribute('href') : null,
    mkbg: getComputedStyle(mk).backgroundColor, es: getComputedStyle(c.querySelector('.ln-es')).visibility}; })"""


def _lince_round(page, wrong=False, key=False):
    page.wait_for_function(_LN_READY, timeout=8000)
    page.wait_for_function(f"() => ({_LN_TARGET})() >= 0", timeout=5000)
    t = page.evaluate(_LN_TARGET)
    n0 = page.evaluate("() => __played.length")
    s0 = page.evaluate("() => __sfx.length")
    pick = 1 - t if wrong else t
    if key:
        page.keyboard.press(str(pick + 1))
    else:
        page.locator(f'#ln-cards .ln-c[data-i="{pick}"]').click()
    page.wait_for_timeout(120)
    st = page.evaluate(_LN_STATE)
    words = [c["w"] for c in st]
    return {"t": t, "pick": pick, "n0": n0, "s0": s0, "st": st, "words": words}


def _clip(page, w):
    return page.evaluate("w => 'audio/' + ({english: 'en', 'français': 'fr', dansk: 'da'})[lang] + '/' + clipFor(w) + '.mp3'", w)


def _play_lince(page, wrong=(0, 3)):
    res = []
    for r in range(8):
        info = _lince_round(page, wrong=r in wrong)
        res.append(info)
        if r in wrong:
            page.wait_for_selector("#ln-go", timeout=6000)
            info["after"] = page.evaluate("n => __played.slice(n).map(p => p.src)", info["n0"])
            page.locator("#ln-go").click()
        else:
            page.wait_for_timeout(250)
            info["after"] = page.evaluate("n => __played.slice(n).map(p => p.src)", info["n0"])
    page.wait_for_selector("#gm-end", timeout=8000)
    return res


DRIVERS = {"memoria": _play_memoria, "lluvia": _play_lluvia, "globos": _play_globos, "letras": _play_letras, "lince": _play_lince}


# ---------------------------------------------------------------- pruebas
def test_menu_cards_and_topic_sheet():
    """El menú: sin zorro, «← Inicio», «¡Pruébalo!» ni #gm-tpanel; 5 tarjetas sólidas con radio 24, el récord en estrellas
    de oro (las que faltan en gris) y «Sin récord» si no se ha jugado, en una sola línea de 36 px; «Nuevo» en Lince hasta
    su primera partida; el nombre accesible sin «?.». La pastilla «Tema: Animales ▾» abre la hoja con «Mis palabras»
    primero y luego «Temas» y «Las 3000» (radio, el elegido marcado); tocar «Colores» lo guarda en "games:topic",
    cambia la pastilla y cierra la hoja; al volver, la pastilla sigue en Colores y los juegos usan sus palabras."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page)
        m = page.evaluate("""() => { const app = document.getElementById('app'), t = app.textContent;
          const cards = [...app.querySelectorAll('.gm-card:not(.gm-link)')].map(c => { const cs = getComputedStyle(c);   /* las de juego (sin las que solo llevan a otra pantalla, F5) */
            return {g: c.dataset.g, r: cs.borderTopLeftRadius, bg: cs.backgroundColor, on: c.querySelectorAll('.gm-st i.on').length,
              onColor: (c.querySelector('.gm-st i.on') ? getComputedStyle(c.querySelector('.gm-st i.on')).color : null),
              offColor: (c.querySelector('.gm-st i:not(.on)') ? getComputedStyle(c.querySelector('.gm-st i:not(.on)')).color : null),
              rec: c.querySelector('.gm-rt').textContent, href: c.getAttribute('href'), aria: c.getAttribute('aria-label'),
              nuevo: !!c.querySelector('.gm-new'), recH: Math.round(c.querySelector('.gm-cr').getBoundingClientRect().height),
              recLines: Math.round(c.querySelector('.gm-rt').getBoundingClientRect().height / parseFloat(getComputedStyle(c.querySelector('.gm-rt')).lineHeight))}; });
          return {cards, fox: /¡A jugar!/.test(t), inicio: /← Inicio/.test(t), prueba: /Pruébalo/.test(t), tpanel: !!document.getElementById('gm-tpanel'),
            pill: document.getElementById('gm-tpill').textContent.replace(/\\s+/g, ' ').trim()}; }""")
        if m["fox"] or m["inicio"] or m["prueba"] or m["tpanel"]:
            probs.append(f"quedan piezas viejas en el menú: {m}")
        if [c["g"] for c in m["cards"] if c["g"] != "soldados"] != CARDS:   # soldados (js/army.js) va aparte
            probs.append(f"tarjetas: {[c['g'] for c in m['cards']]}")
        best = page.evaluate(_BEST)
        for c in m["cards"]:
            if c["r"] != "24px" or not c["bg"].startswith("rgb(") or c["href"] != f"#/juegos/{c['g']}":
                probs.append(f"tarjeta {c['g']}: radio {c['r']}, fondo {c['bg']}, enlace {c['href']}")
            b = best.get(c["g"])
            want = b["stars"] if b else 0
            if c["on"] != want:
                probs.append(f"{c['g']}: {c['on']} estrellas (récord {want})")
            if c["onColor"] and not (_rgb(c["onColor"])[0] > 200 and _rgb(c["onColor"])[1] > 150 and _rgb(c["onColor"])[2] < 80):
                probs.append(f"{c['g']}: las estrellas no son de oro: {c['onColor']}")
            if c["offColor"] and not _gray(c["offColor"]):
                probs.append(f"{c['g']}: las estrellas que faltan no son grises: {c['offColor']}")
            if not b and c["rec"] != "Sin récord":
                probs.append(f"{c['g']}: sin jugar dice {c['rec']!r}")
            if c["nuevo"] != (c["g"] in FRESH and not b):
                probs.append(f"{c['g']}: chip «Nuevo» {c['nuevo']} (récord {b})")
            if re.search(r"[?!.]\.", c["aria"] or "") or c["recH"] != 36 or c["recLines"] != 1:
                probs.append(f"{c['g']}: nombre {c['aria']!r} o fila del récord de {c['recH']} px y {c['recLines']} líneas")
        if m["pill"] != "Tema: Animales":
            probs.append(f"pastilla: {m['pill']!r}")
        page.locator("#gm-tpill").click()
        page.wait_for_selector("dialog#gm-tp-s[open]", timeout=3000)
        page.wait_for_timeout(400)
        sh = page.evaluate("""() => { const d = document.getElementById('gm-tp-s'), rows = [...d.querySelectorAll('[data-tp]')];
          return {modal: d.matches(':modal'), first: rows[0].dataset.tp, n: rows.length, radio: rows.every(r => r.getAttribute('role') === 'radio'),
            checked: rows.filter(r => r.getAttribute('aria-checked') === 'true').map(r => r.dataset.tp), title: d.querySelector('h2').textContent,
            heads: [...d.querySelectorAll('.st-h')].map(h => h.textContent), blur: getComputedStyle(d).backdropFilter}; }""")
        if not sh["modal"] or sh["first"] != "mis" or not sh["radio"] or sh["checked"] != ["animales"] or sh["n"] < 20 or sh["blur"] not in ("none", "") \
                or sh["heads"] != ["Temas", "Las 3000"]:
            probs.append(f"hoja de temas: {sh}")
        page.locator('#gm-tp-s [data-tp="colores"]').click()
        page.wait_for_function("() => !document.getElementById('gm-tp-s').open", timeout=3000)
        st = page.evaluate("() => [JSON.parse(localStorage.getItem('games:topic')), document.getElementById('gm-tpill').textContent.replace(/\\s+/g, ' ').trim()]")
        if st != ["colores", "Tema: Colores"]:
            probs.append(f"elegir Colores: {st}")
        C.goto(page, "#/", settle_ms=100)
        C.goto(page, "#/juegos")
        pill = page.evaluate("() => document.getElementById('gm-tpill').textContent.replace(/\\s+/g, ' ').trim()")
        if pill != "Tema: Colores":
            probs.append(f"al volver la pastilla dice {pill!r}")
        page.evaluate(_HOOKS)
        _start(page, "globos")
        chip = page.evaluate("() => (document.querySelector('.gm-intro-tp') || {}).textContent || ''")
        if chip and "Colores" not in chip:
            probs.append(f"la partida no usa el tema elegido: {chip!r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_intro_only_first_time_and_help():
    """Letras locas nunca jugado: tocar su tarjeta enseña la explicación entera (bajo la ✕ del modo foco, sin medir la
    cabecera vieja); «¡A jugar!» la da por vista (vocab:ui, solo de este aparato). El «?» abre «Cómo se juega» con la
    partida en pausa y al cerrarlo sigue. La segunda vez empieza directa; al recargar sale la tarjeta corta con
    «Cómo se juega» que despliega el texto. Memoria (ya jugado) empieza directa la primera vez que se toca."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page)
        shown = _start(page, "letras", intro=None)
        st = page.evaluate("""() => { const ov = document.querySelector('.gm-intro'), c = ov && ov.querySelector('.gm-intro-c'), p = document.getElementById('gm-in-p');
          const x = document.getElementById('fx-x').getBoundingClientRect();
          return ov ? {p: p && !p.hidden ? p.textContent : null, top: Math.round(c.getBoundingClientRect().top), xb: Math.round(x.bottom),
            back: !!ov.querySelector('.gm-intro-back'), go: ov.querySelector('.gm-go').textContent.trim()} : null; }""")
        if not shown or not st or not st["p"] or "letras" not in st["p"] or not st["back"] or st["go"] != "¡A jugar!":
            probs.append(f"la primera vez no sale la explicación entera: {st}")
        elif st["top"] < st["xb"]:
            probs.append(f"la explicación queda debajo de la ✕ del modo foco: {st}")
        seen0 = page.evaluate("() => (vocabUI.get().gmIntro || []).includes('letras')")
        page.locator(".gm-intro .gm-go").click()
        page.wait_for_timeout(200)
        seen1 = page.evaluate("() => (vocabUI.get().gmIntro || []).includes('letras')")
        if seen0 or not seen1 or page.locator(".gm-intro").count():
            probs.append(f"«¡A jugar!» no da la explicación por vista: antes {seen0}, después {seen1}")
        # «?»: cómo se juega, con la partida en pausa
        page.locator(".gm-top [data-gm-how]").click()
        page.wait_for_selector("dialog#gm-how[open]", timeout=3000)
        hw = page.evaluate("() => ({paused: vocabGames.paused, p: document.querySelector('#gm-how .gm-how-p').textContent})")
        if not hw["paused"] or "letras" not in hw["p"]:
            probs.append(f"el «?» no explica con la partida en pausa: {hw}")
        page.locator("#gm-how [data-close]").click()
        page.wait_for_function("() => !document.getElementById('gm-how').open && !vocabGames.paused", timeout=3000)
        # la segunda vez, directa
        page.evaluate("() => { location.hash = '#/juegos'; }")
        page.wait_for_selector("#gm-cards", timeout=5000)
        page.evaluate(_HOOKS)
        shown2 = _start(page, "letras", intro=None)
        page.wait_for_timeout(500)
        if shown2 or page.locator(".gm-intro").count():
            probs.append("la segunda vez vuelve a salir la explicación")
        if page.locator("#gm-tiles .gm-tile").count() < 3:
            probs.append("la segunda vez no empieza la partida")
        # al recargar: tarjeta corta, «Cómo se juega» la despliega
        C.reload(page)
        page.wait_for_selector(".gm-intro .gm-go", timeout=5000)
        rd = page.evaluate("() => ({p: document.getElementById('gm-in-p').hidden, how: !!document.getElementById('gm-in-how')})")
        page.locator("#gm-in-how").click()
        rd2 = page.evaluate("() => !document.getElementById('gm-in-p').hidden")
        if rd != {"p": True, "how": True} or not rd2:
            probs.append(f"al recargar la tarjeta corta: {rd}, despliega {rd2}")
        page.locator(".gm-intro .gm-go").click()
        # Memoria ya jugado: directa
        page.evaluate("() => { location.hash = '#/juegos'; }")
        page.wait_for_selector("#gm-cards", timeout=5000)
        if _start(page, "memoria", intro=None):
            probs.append("Memoria (ya jugado) enseña la explicación")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_hold_card_peek_and_tap_plays():
    """Mantener pulsada la tarjeta de Memoria abre el vistazo (cómo se juega, el récord con sus estrellas, las palabras y
    las partidas) sin entrar en el juego; «Jugar» abre la partida directa. Tocar una tarjeta juega. La pista «Mantén
    para ver» sale una vez y no tapa ni la pastilla del tema ni el récord de ninguna tarjeta."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page, hint=True)
        page.wait_for_selector(".g-hint", timeout=4000)
        hb = page.evaluate("""() => { const h = document.querySelector('.g-hint').getBoundingClientRect(), p = document.getElementById('gm-tpill').getBoundingClientRect();
          const hit = r => !(h.bottom <= r.top || h.top >= r.bottom || h.right <= r.left || h.left >= r.right);
          return {over: hit(p), recs: [...document.querySelectorAll('.gm-card .gm-cr')].filter(e => hit(e.getBoundingClientRect())).map(e => e.closest('.gm-card').dataset.g),
            card: document.querySelector('[data-g-hint]').dataset.g}; }""")
        if hb["over"]:
            probs.append(f"la pista tapa la pastilla del tema: {hb}")
        if hb["recs"]:
            probs.append(f"la pista tapa el récord de {hb['recs']}")
        card = page.locator('.gm-card[data-g="memoria"]')
        bb = card.bounding_box()
        page.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
        page.mouse.down()
        page.wait_for_timeout(750)
        page.mouse.up()
        page.wait_for_selector("dialog#gm-peek[open]", timeout=3000)
        page.wait_for_timeout(400)
        pk = page.evaluate("""() => { const d = document.getElementById('gm-peek'), a = d.querySelector('[data-go]');
          return {h: d.querySelector('h2').textContent, how: d.querySelector('.gm-pk-p').textContent, on: d.querySelectorAll('.gm-st i.on').length,
            rows: [...d.querySelectorAll('.gm-pk-r')].map(r => r.textContent.replace(/\\s+/g, ' ').trim()), go: a && a.textContent.trim(),
            href: a && a.getAttribute('href'), modal: d.matches(':modal'), hash: location.hash}; }""")
        want_on = page.evaluate(_BEST)["memoria"]["stars"]
        if pk["h"] != "Memoria" or "dos cartas" not in pk["how"] or pk["on"] != want_on or pk["go"] != "Jugar" or pk["href"] != "#/juegos/memoria" \
                or not pk["modal"] or pk["hash"] != "#/juegos" or not any(r.startswith("Récord") for r in pk["rows"]) \
                or not any(r.startswith("Partidas") for r in pk["rows"]):
            probs.append(f"vistazo: {pk}")
        page.locator("#gm-peek [data-go]").click()
        page.wait_for_function("() => document.documentElement.dataset.gmPlay === 'memoria'", timeout=5000)
        page.wait_for_timeout(300)
        if page.locator(".gm-intro").count() or page.locator("#gm-board .gm-mc").count() != 12:
            probs.append("«Jugar» del vistazo no abre la partida directa")
        if page.evaluate("() => !!document.querySelector('dialog#gm-peek[open]')"):
            probs.append("el vistazo sigue abierto en la partida")
        page.evaluate("() => { location.hash = '#/juegos'; }")
        page.wait_for_selector("#gm-cards", timeout=5000)
        page.locator('.gm-card[data-g="globos"]').click()
        page.wait_for_function("() => document.documentElement.dataset.gmPlay === 'globos'", timeout=5000)
        page.wait_for_timeout(300)
        if page.locator(".gm-intro").count() or not page.locator("#gm-air").count():
            probs.append("tocar la tarjeta de Globos no juega directo")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_every_game_ends_with_flying_coins():
    """Los 5 juegos se juegan hasta el resultado: award se llama una sola vez, sin texto repetido, desde «+N» (#gm-plus)
    que está en pantalla, y las monedas vuelan (bus "coins" con fly); suman lo de siempre ([5, 5, 10, 15] por
    estrellas); el récord cuenta una partida más; al terminar se sale del modo foco. Los fallos de cada juego, grises
    con ✗ (nunca dorados ni rojos)."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page)
        for g in GAMES:
            plays0 = (page.evaluate(_BEST).get(g) or {}).get("plays", 0)
            c0 = page.evaluate(_COINS)
            page.evaluate("() => { __aw.length = 0; __coins.length = 0; __played.length = 0; __said.length = 0; }")
            _start(page, g)
            miss = DRIVERS[g](page)
            page.wait_for_timeout(400)
            end = page.evaluate("""() => ({stars: document.querySelectorAll('.gm-end-st .gm-es.on').length, plus: (document.getElementById('gm-plus') || {}).textContent,
              play: document.documentElement.dataset.gmPlay || '', focus: document.documentElement.dataset.focus || '',
              aw: __aw.slice(), coins: __coins.slice(), pill: !!document.querySelector('[data-coin-target]')})""")
            page.wait_for_timeout(2600)
            c1 = page.evaluate(_COINS)
            want = [5, 5, 10, 15][end["stars"]]
            aw = end["aw"]
            if len(aw) != 1 or aw[0]["n"] != want or aw[0]["why"] != "" or aw[0]["from"] != "gm-plus" or not aw[0]["live"] or aw[0]["quiet"]:
                probs.append(f"{g}: award {aw} (se esperaba una vez {want} desde #gm-plus)")
            if [c for c in end["coins"] if c["fly"]] != [{"n": want, "fly": True}]:
                probs.append(f"{g}: monedas del bus {end['coins']}")
            if c1 - c0 not in (want, want + 10):
                probs.append(f"{g}: las monedas pasan de {c0} a {c1} (+{want})")
            if end["plus"] is None or f"+{want}" not in end["plus"]:
                probs.append(f"{g}: «+N» dice {end['plus']!r}")
            if end["play"] or end["focus"]:
                probs.append(f"{g}: el resultado sigue en modo foco: {end}")
            plays1 = (page.evaluate(_BEST).get(g) or {}).get("plays", 0)
            if plays1 != plays0 + 1:
                probs.append(f"{g}: partidas {plays0} → {plays1}")
            # el fallo de cada juego
            if g == "memoria":
                if not miss or not _gray(miss["border"]) or not _gray(miss["badge"]) or "✗" not in miss["mark"]:
                    probs.append(f"memoria: fallo {miss}")
            elif g == "lluvia":
                if not miss or not _gray(miss["border"]) or not miss["float"] or not _gray(miss["float"]) or "✗" not in (miss["text"] or ""):
                    probs.append(f"lluvia: fallo {miss}")
            elif g == "globos":
                if miss is not None and (not _gray(miss["bg"]) or miss["mark"] != "✗" or not miss["shown"]):
                    probs.append(f"globos: fallo {miss}")
            elif g == "letras":
                if not miss or not _gray(miss["bg"]) or not _gray(miss["border"]) or not _gray(miss["badge"]) or "✗" not in miss["mark"]:
                    probs.append(f"letras: fallo {miss}")
            elif g == "lince":
                for info in (miss[0], miss[3]):
                    c = info["st"][info["pick"]]
                    if "is-miss" not in c["cls"] or not _gray(c["bg"]) or c["mk"] != "#i-x-bold" or not _gray(c["mkbg"]):
                        probs.append(f"lince: fallo {c}")
            bad = [s for s in page.evaluate("() => __sfx") if s in ("bad", "no", "wrong", "fail", "error", "buzz")]
            if bad:
                probs.append(f"{g}: sonidos de fallo {bad}")
            _to_menu(page)
            page.evaluate("() => document.querySelectorAll('dialog[open]').forEach(d => d.close())")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_pause_with_escape_and_x():
    """En cada juego (también Lince), Esc y la ✕ del modo foco abren «¿Paramos aquí?» con la partida parada; «Seguir»
    sigue. En Lince la pausa espera: un acierto no pasa de ronda hasta cerrar la hoja."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page)
        for g in ["memoria", "lluvia", "globos", "letras", "lince"]:
            _start(page, g)
            page.wait_for_timeout(500)
            for how in ("Escape", "x"):
                if how == "Escape":
                    page.keyboard.press("Escape")
                else:
                    page.locator("#fx-x").click()
                try:
                    page.wait_for_selector("dialog#gm-pause[open]", timeout=3000)
                except Exception:  # noqa: BLE001
                    probs.append(f"{g}: {how} no abre la pausa")
                    continue
                st = page.evaluate("() => ({paused: vocabGames.paused, hash: location.hash})")
                if st != {"paused": True, "hash": f"#/juegos/{g}"}:
                    probs.append(f"{g} ({how}): {st}")
                page.locator("#gm-pz-go").click()
                page.wait_for_function("() => !document.getElementById('gm-pause').open && !vocabGames.paused", timeout=3000)
            if g == "lince":
                rd0 = page.evaluate("() => document.getElementById('gm-rd').textContent")
                _lince_round(page)
                page.keyboard.press("Escape")
                page.wait_for_selector("dialog#gm-pause[open]", timeout=3000)
                page.wait_for_timeout(2500)
                rd1 = page.evaluate("() => document.getElementById('gm-rd').textContent")
                page.locator("#gm-pz-go").click()
                page.wait_for_function("r => document.getElementById('gm-rd').textContent !== r", arg=rd0, timeout=5000)
                if rd1 != rd0:
                    probs.append(f"lince: con la pausa abierta pasó de ronda ({rd0} → {rd1})")
            page.evaluate("() => { location.hash = '#/juegos'; }")
            page.wait_for_selector("#gm-cards", timeout=5000)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_lince_rounds_audio_and_record():
    """Oído de lince: 8 rondas con 2 tarjetas. Suena el audio grabado de la palabra buena (audio/<ab>/<id>.mp3 de
    clipFor). Acierto: verde con ✓, vuelve a sonar la misma palabra y pasa solo. Fallo: la elegida gris con ✗ (sin temblor
    ni sonido), la buena con ✓ y suenan las dos (primero la elegida, luego la buena); «Seguir». El significado sale al
    responder. El altavoz repite y la tortuga va a 0,7. Las teclas 1/2 eligen. Puntos verdes y grises. El récord queda
    en "games:best".lince y la tarjeta del menú lo enseña. En francés y danés también suena su audio."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page)
        _start(page, "lince")
        if page.evaluate("() => document.querySelectorAll('#gm-dots i').length") != 8:
            probs.append("Lince no tiene 8 puntos de ronda")
        page.wait_for_function(_LN_READY, timeout=8000)
        first = page.evaluate("() => __played.map(p => p.src)")
        t = page.evaluate(_LN_TARGET)
        words = page.evaluate("() => [...document.querySelectorAll('#ln-cards .ln-c')].map(c => c.dataset.w)")
        if len(words) != 2 or t < 0 or first[-1] != _clip(page, words[t]):
            probs.append(f"no suena el audio de la palabra buena: {first} ({words})")
        es0 = page.evaluate("() => [...document.querySelectorAll('#ln-cards .ln-es')].map(e => getComputedStyle(e).visibility)")
        if es0 != ["hidden", "hidden"]:
            probs.append(f"el significado se ve antes de responder: {es0}")
        # altavoz y tortuga
        n = page.evaluate("() => __played.length")
        page.locator("#ln-play").click()
        page.wait_for_timeout(150)
        page.locator("#ln-slow").click()
        page.wait_for_timeout(150)
        pl = page.evaluate("n => __played.slice(n)", n)
        if len(pl) != 2 or pl[0]["src"] != first[-1] or pl[1]["src"] != first[-1] or abs(pl[1]["rate"] - 0.7) > .01 or pl[0]["rate"] < .74:
            probs.append(f"altavoz y tortuga: {pl}")
        res = []
        for r in range(8):
            wrong = r in (0, 3, 6)
            info = _lince_round(page, wrong=wrong, key=(r == 2))
            res.append(not wrong)
            c, o = info["st"][info["pick"]], info["st"][1 - info["pick"]]
            if wrong:
                # «Seguir» sale enseguida (en el dock de abajo), sin esperar a que suenen las dos
                go = page.evaluate("""() => { const b = document.getElementById('ln-go'), d = b && b.closest('.ln-dock');
                  return b ? {dock: !!d, pos: d ? getComputedStyle(d).position : null, txt: document.getElementById('ln-txt').textContent} : null; }""")
                if not go or not go["dock"] or go["pos"] != "fixed" or not go["txt"].startswith("¡Casi! Es «"):
                    probs.append(f"ronda {r + 1}: tras fallar, «Seguir» no sale enseguida en el dock: {go}")
                page.wait_for_function("n => __played.length >= n + 2", arg=info["n0"], timeout=6000)
                page.wait_for_timeout(100)
                after = page.evaluate("n => __played.slice(n).map(p => p.src)", info["n0"])
                want = [_clip(page, c["w"]), _clip(page, o["w"])]
                if after[-2:] != want:
                    probs.append(f"ronda {r + 1}: tras fallar suena {after} (se esperaba {want})")
                if "is-miss" not in c["cls"] or not _gray(c["bg"]) or c["mk"] != "#i-x-bold" or c["anim"] not in ("none", "gm-in"):
                    probs.append(f"ronda {r + 1}: la elegida no queda gris con ✗: {c}")
                if "is-right" not in o["cls"] or o["mk"] != "#i-check-bold" or not _green(o["bg"]):
                    probs.append(f"ronda {r + 1}: la buena no se pone verde con ✓: {o}")
                snd = page.evaluate("n => __sfx.slice(n)", info["s0"])
                if snd:
                    probs.append(f"ronda {r + 1}: al fallar suena {snd}")
                page.locator("#ln-go").click()
            else:
                if "is-ok" not in c["cls"] or not _green(c["bg"]) or c["mk"] != "#i-check-bold":
                    probs.append(f"ronda {r + 1}: el acierto no queda verde con ✓: {c}")
                page.wait_for_timeout(300)
                after = page.evaluate("n => __played.slice(n).map(p => p.src)", info["n0"])
                if not after or after[0] != _clip(page, c["w"]):
                    probs.append(f"ronda {r + 1}: tras acertar no vuelve a sonar la palabra: {after}")
            if info["st"][0]["es"] != "visible":
                probs.append(f"ronda {r + 1}: no sale el significado al responder")
            dots = page.evaluate("() => [...document.querySelectorAll('#gm-dots i')].slice(0, %d).map(d => [d.className, getComputedStyle(d).backgroundColor])" % (r + 1))
            cls, col = dots[-1]
            if (wrong and (cls != "meh" or not _gray(col))) or (not wrong and (cls != "ok" or not _green(col))):
                probs.append(f"ronda {r + 1}: punto {dots[-1]}")
        page.wait_for_selector("#gm-end", timeout=8000)
        score = sum(res)
        best = page.evaluate(_BEST).get("lince")
        if best != {"score": score, "stars": 2, "plays": 1}:
            probs.append(f"récord de Lince: {best} (aciertos {score})")
        line = page.evaluate("() => document.querySelector('.gm-end-l').textContent")
        if f"{score} de 8" not in line:
            probs.append(f"resultado: {line!r}")
        _to_menu(page)
        card = page.evaluate("""() => { const c = document.querySelector('.gm-card[data-g="lince"]'); return {rec: c.querySelector('.gm-rt').textContent, on: c.querySelectorAll('.gm-st i.on').length}; }""")
        if card != {"rec": f"{score} de 8", "on": 2}:
            probs.append(f"tarjeta de Lince en el menú: {card}")
        # francés y danés: suena su audio
        for lg in ("français", "dansk"):
            page.evaluate("l => { localStorage.setItem('lang', JSON.stringify(l)); }", lg)
            C.goto(page, "#/juegos")
            C.reload(page)
            page.evaluate(_HOOKS)
            _start(page, "lince")
            page.wait_for_function(_LN_READY, timeout=8000)
            src = page.evaluate("() => __played[__played.length - 1].src")
            t = page.evaluate(_LN_TARGET)
            if t < 0 or not src.startswith(f"audio/{AB[lg]}/"):
                probs.append(f"{lg}: no suena el audio de la palabra buena ({src})")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_lince_data_valid():
    """data/lince.json: {v, about, english, français, dansk}; al menos 12 pares por idioma; cada palabra es de su tema
    del corpus (data/<d>.json, con su artículo), tiene significado, su dibujo existe (o null) y su audio grabado existe
    (audio/<ab>.json → audio/<ab>/<id>.mp3); las dos palabras de un par son distintas, llevan el mismo artículo (o
    ninguno: solo las distingue el sonido) y no hay pares repetidos.
    js/lince.js carga detrás de games.js y está en SHELL de sw.js y en OFF_APP de index.html (con data/lince.json)."""
    probs = []
    d = json.loads((C.ROOT / "data" / "lince.json").read_text(encoding="utf-8"))
    if d.get("v") != 1 or not isinstance(d.get("about"), str):
        probs.append("faltan v o about")
    docs = {}

    def doc(i):
        if i not in docs:
            docs[i] = json.loads((C.ROOT / "data" / f"{i}.json").read_text(encoding="utf-8"))
        return docs[i]

    def speakable(t):
        t = re.sub(r"\((m|f|m\./f\.|pl)\.?\)", "", t)
        t = re.sub(r"\(.*?\)", "", t)
        return t.replace(" / ", ", ").replace("—", "").strip()

    for lg, ab in AB.items():
        pairs = d.get(lg)
        clips = json.loads((C.ROOT / "audio" / f"{ab}.json").read_text(encoding="utf-8"))
        if not isinstance(pairs, list) or len(pairs) < 12:
            probs.append(f"{lg}: {len(pairs or [])} pares (mínimo 12)")
            continue
        seen = set()
        for p in pairs:
            if not (isinstance(p, list) and len(p) == 2):
                probs.append(f"{lg}: par mal formado {p}")
                continue
            key = tuple(sorted(x.get("w", "") for x in p))
            if key in seen or key[0] == key[1]:
                probs.append(f"{lg}: par repetido o con la misma palabra {key}")
            seen.add(key)
            arts = {(_ARTS[lg].match(x.get("w", "")) or [""])[0].strip().lower() for x in p}
            if len(arts) != 1:
                probs.append(f"{lg}: el par {key} se distingue por el artículo")
            for x in p:
                w, es, img, di = x.get("w"), x.get("es"), x.get("img", "missing"), x.get("d")
                if not w or not es or img == "missing" or not di:
                    probs.append(f"{lg}: palabra incompleta {x}")
                    continue
                if img is not None and not (C.ROOT / img).is_file():
                    probs.append(f"{lg}: falta el dibujo {img} ({w})")
                cid = clips.get(speakable(w))
                if not cid or not (C.ROOT / "audio" / ab / f"{cid}.mp3").is_file():
                    probs.append(f"{lg}: «{w}» no tiene audio grabado")
                rows = doc(di).get("rows", [])
                if not any(((r.get("l") or {}).get(lg) or {}).get("word") == w for r in rows):
                    probs.append(f"{lg}: «{w}» no está en data/{di}.json")
    html = (C.ROOT / "index.html").read_text(encoding="utf-8")
    html = re.sub(r'(<script src="[^"?]+)\?v=\d+"', r'\1"', html)   # desde F4: los scripts llevan ?v=<VERSION> de sw.js
    sw = (C.ROOT / "sw.js").read_text(encoding="utf-8")
    if not re.search(r'<script src="js/games\.js"></script>\s*<script src="js/lince\.js"></script>', html):
        probs.append("index.html no carga js/lince.js justo detrás de games.js")
    off = re.search(r"const OFF_APP = \[(.*?)\];", html, re.S)
    shell = re.search(r"const SHELL = \[(.*?)\];", sw, re.S)
    for f in ("js/lince.js", "data/lince.json"):
        if not off or f'"{f}"' not in off.group(1):
            probs.append(f"OFF_APP no lleva {f}")
        if not shell or f'"{f}"' not in shell.group(1):
            probs.append(f"SHELL de sw.js no lleva {f}")
    for g in GAMES:
        if not (C.ROOT / "img" / "games" / f"{g}.png").is_file():
            probs.append(f"falta img/games/{g}.png")
    assert not probs, "\n".join(probs)


def test_no_endless_loops_and_top_row_fits():
    """En el menú no queda ningún bucle infinito (tras unos segundos) y en cada juego tampoco; en el móvil la fila de
    arriba del juego (en modo foco, entre la ✕ y las monedas) cabe: el «?» y las pastillas no se tapan ni se salen."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page)
        page.wait_for_timeout(3000)
        loops = page.evaluate(_ENDLESS)
        if loops:
            probs.append(f"menú: bucles infinitos {loops}")
        for g in GAMES:
            _start(page, g)
            page.wait_for_timeout(800)
            loops = page.evaluate(_ENDLESS)
            if loops:
                probs.append(f"{g}: bucles infinitos {loops}")
            fit = page.evaluate("""() => { const r = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
              const x = r('#fx-x'), h = r('.gm-top .gm-help'), s = r('.gm-top .gm-stats'), c = r('[data-coin-target]');
              const kids = [...document.querySelectorAll('.gm-top > *')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect());
              let over = false; for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) { const a = kids[i], b = kids[j];
                if (a.right > b.left + .5 && b.right > a.left + .5 && a.bottom > b.top + .5 && b.bottom > a.top + .5) over = true; }
              return {over, xr: x && Math.round(x.right), hl: Math.round(h.left), sr: Math.round(s.right), cl: c ? Math.round(c.left) : null,
                wide: document.documentElement.scrollWidth > innerWidth + 1}; }""")
            if fit["over"] or fit["wide"] or (fit["xr"] and fit["hl"] < fit["xr"]) or (fit["cl"] and fit["sr"] > fit["cl"]):
                probs.append(f"{g}: la fila de arriba no cabe: {fit}")
            page.evaluate("() => { location.hash = '#/juegos'; }")
            page.wait_for_selector("#gm-cards", timeout=5000)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_audit_and_captures():
    """Contraste ≥ 4,5:1 y paleta permitida en el menú, la hoja de temas, el vistazo, la explicación de Lince, una ronda
    con fallo y otra con acierto y el resultado; en móvil y escritorio, claro y oscuro (y con «Reducir movimiento» en el
    móvil). Capturas F4a-juegos-* y F4a-lince-* en capturas/F4."""
    probs = []
    OUT.mkdir(parents=True, exist_ok=True)

    def audit(page, label, scope=(".gm", "gm-", "ln-", "ln")):
        page.evaluate(_FINISH)
        a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
        probs.extend(f"{label} contraste: {x}" for x in a["contrast"] if any(s in x for s in scope))
        probs.extend(f"{label} paleta: {x}" for x in a["palette"] if any(s in x for s in scope))

    for kind, scheme, rm in (("phone", "light", "no-preference"), ("phone", "dark", "no-preference"), ("desk", "light", "no-preference"),
                             ("desk", "dark", "no-preference"), ("phone", "light", "reduce")):
        tag = f"{kind}-{scheme}" + ("-rm" if rm == "reduce" else "")
        page = C.new_page(kind, color_scheme=scheme, reduced_motion=rm)
        try:
            _open(page)
            page.wait_for_timeout(300)
            audit(page, f"{tag} menú")
            if rm != "reduce":
                C.shot(page, f"F4a-juegos-menu-{tag}", OUT, full_page=False)
            page.locator("#gm-tpill").click()
            page.wait_for_selector("dialog#gm-tp-s[open]", timeout=3000)
            page.wait_for_timeout(500)
            audit(page, f"{tag} temas", scope=("gm-", "st-"))
            if rm != "reduce":
                C.shot(page, f"F4a-juegos-temas-{tag}", OUT, full_page=False)
            page.locator("#gm-tp-s [data-close]").click()
            page.wait_for_function("() => !document.getElementById('gm-tp-s').open", timeout=3000)
            card = page.locator('.gm-card[data-g="lluvia"]')
            bb = card.bounding_box()
            page.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
            page.mouse.down()
            page.wait_for_timeout(750)
            page.mouse.up()
            page.wait_for_selector("dialog#gm-peek[open]", timeout=3000)
            page.wait_for_timeout(500)
            audit(page, f"{tag} vistazo", scope=("gm-",))
            if rm != "reduce":
                C.shot(page, f"F4a-juegos-vistazo-{tag}", OUT, full_page=False)
            page.locator("#gm-peek [data-close]").click()
            page.wait_for_function("() => !document.getElementById('gm-peek').open", timeout=3000)
            _start(page, "lince", intro=None)
            page.wait_for_selector(".gm-intro .gm-go", timeout=5000)
            page.wait_for_timeout(400)
            audit(page, f"{tag} explicación")
            if rm != "reduce":
                C.shot(page, f"F4a-lince-explicacion-{tag}", OUT, full_page=False)
            page.locator(".gm-intro .gm-go").click()
            _lince_round(page, wrong=True)
            page.wait_for_selector("#ln-go", timeout=6000)
            page.wait_for_timeout(300)
            audit(page, f"{tag} fallo")
            if rm != "reduce":
                C.shot(page, f"F4a-lince-fallo-{tag}", OUT, full_page=False)
            page.locator("#ln-go").click()
            _lince_round(page)
            page.wait_for_timeout(250)
            audit(page, f"{tag} acierto")
            if rm != "reduce":
                C.shot(page, f"F4a-lince-acierto-{tag}", OUT, full_page=False)
            for r in range(6):
                _lince_round(page, wrong=(r == 2))
                if r == 2:
                    page.wait_for_selector("#ln-go", timeout=6000)
                    page.locator("#ln-go").click()
            page.wait_for_selector("#gm-end", timeout=8000)
            page.wait_for_timeout(1800)
            audit(page, f"{tag} resultado")
            if rm != "reduce":
                C.shot(page, f"F4a-lince-resultado-{tag}", OUT, full_page=False)
            if page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1"):
                probs.append(f"{tag}: la página se sale de lado")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_export_matches_baseline():
    """Mirar los juegos (la hoja de temas sin elegir, el vistazo, la explicación de Letras y empezar la partida, que
    guarda «vista» en vocab:ui, solo de este aparato) no cambia la partida exportada: es la de la base."""
    base = C.load_baseline()
    assert base, "falta tests/e2e/baseline/export.json"
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        d = C.diff_exports(base, C.export(page))
        if d:
            probs.append("al arrancar la partida no es la de la base:\n  " + "\n  ".join(d))
        C.goto(page, "#/juegos")
        page.locator("#gm-tpill").click()
        page.wait_for_selector("dialog#gm-tp-s[open]", timeout=3000)
        page.locator("#gm-tp-s [data-close]").click()
        page.wait_for_timeout(400)
        page.evaluate("() => vocabGames.peek('globos', null)")
        page.wait_for_timeout(300)
        page.locator("#gm-peek [data-close]").click()
        page.wait_for_timeout(400)
        _start(page, "letras")
        page.wait_for_timeout(300)
        C.goto(page, "")
        d = C.diff_exports(base, C.export(page), allow_new=False)
        if d:
            probs.append("mirar los juegos cambia la partida:\n  " + "\n  ".join(d))
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
