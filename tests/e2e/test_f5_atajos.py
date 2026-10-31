"""F5a (plan-doc «Atajos que se registran solos»): la fila «Tus atajos» de Hoy (js/shortcuts.js).

Lo que se termina suma 1 punto a su atajo (un juego con su tema, un tema en un modo, una unidad de gramática); los puntos
valen la mitad cada 7 días y un atajo entra con 2 o más. Hasta 3 piezas en el móvil y 4 en tableta (≥ 744 px); cada una
conserva su sitio y una nueva solo entra si supera en un 20 % a la que saldría. El primer día no hay fila. Lo que se dejó a
medias sale primero con un anillo. Tocar = ir al enlace directo (#/juegos/<juego>?t=<tema>, #/doc/<tema>?m=<modo>,
#/leccion/G-…); mantener pulsado o «Editar» abre la hoja con «Fijar» / «Quitar de fijados» y «No sugerir» (30 días, con
«Deshacer» 5 s). Hoy sigue sin scroll a 390×844 (la fila manda: un solo HOME_SLOT). «vocab:sc» es solo del aparato (no se
exporta); «sc:prefs» (fijados, ocultos, interruptor y la pregunta de la tortuga) sí. Si se usa mucho la tortuga, el zorro
pregunta una sola vez «¿Lo pongo siempre despacio?». En Para mayores: «Atajos automáticos» y «Olvidar lo aprendido».
Sin errores de consola y la partida exportada como la base (salvo sc:prefs)."""
from __future__ import annotations

import datetime as _dt
import json

import common as C

OUT = C.CAPTURAS / "F5"
_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
D0 = C.day_num(C.FIXED_NOW)
GLOBOS = "en/juego:globos:animales"
MEMORIA = "en/juego:memoria:w03"
LETRAS = "en/juego:letras:colores"
LLUVIA = "en/juego:lluvia:familia"
GRAM = "en/gram:G-A1-01"
TEST = "en/tema:w02:test"

_ROW = """() => { const s = document.getElementById('hm-sc'); if (!s) return null;
  return {n: +(document.documentElement.dataset.sc || 0), title: (s.querySelector('#sc-h') || {}).textContent, ed: !!s.querySelector('#sc-ed'),
    role: s.querySelector('.sc-ps').getAttribute('role'), labelled: s.getAttribute('aria-labelledby'),
    items: [...s.querySelectorAll('.sc-p')].map(a => { const r = a.getBoundingClientRect();
      return {k: a.dataset.sc || null, half: a.hasAttribute('data-half'), href: a.getAttribute('href'), label: a.getAttribute('aria-label'),
        name: [...a.querySelectorAll('.sc-n > span')].map(x => x.textContent).join(' / '), pin: !!a.querySelector('.sc-pin'), key: a.dataset.key, h: r.height, w: r.width,
        img: !!a.querySelector('.sc-pic img, .sc-pic .sc-tile'), ring: (a.querySelector('.sc-rf') || {getAttribute: () => null}).getAttribute('stroke-dasharray')}; })}; }"""
_KEYS = "() => [...document.querySelectorAll('#hm-sc .sc-p')].map(a => a.dataset.sc || 'half')"
_SC = "() => JSON.parse(localStorage.getItem('vocab:sc') || 'null')"
_PREFS = "() => JSON.parse(localStorage.getItem('sc:prefs') || 'null')"
_FIT = "() => ({sh: document.documentElement.scrollHeight, ih: innerHeight, slots: document.querySelectorAll('#hm-slots > .hm-slot').length})"
_SHEET = """() => { const d = document.getElementById('sc-sheet'); if (!d || !d.open) return null;
  return {title: (d.querySelector('#sc-sh-t') || {}).textContent, rows: [...d.querySelectorAll('.sc-er')].map(r => ({k: r.dataset.k,
    pin: (r.querySelector('[data-pin]') || {}).textContent, hide: !!r.querySelector('[data-hide]'), unhide: !!r.querySelector('[data-unhide]')}))}; }"""
_TOAST = """() => { const t = document.querySelector('#m-toasts .m-toast'); if (!t) return null;
  const b = t.querySelector('.m-ta'); return {t: (t.querySelector('.m-tt') || {}).textContent, btn: b ? b.textContent : null,
    bh: b ? b.getBoundingClientRect().height : 0}; }"""
_ACC = "() => { const a = document.getElementById('acc'); return !!a && !a.hidden && !!a.getClientRects().length; }"
_PASS = "() => sessionStorage.setItem('vocab:gate', String(Date.now() + adultGate.MS))"
_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""
# deja 6 palabras pendientes de las 12 de la partida sembrada: la tarjeta pasa a la lección y sale la fila «Repasar 6»
_FEW = """() => { const k = 'srs:english', m = JSON.parse(localStorage.getItem(k)), t = today(); let n = 0;
  for (const x of Object.values(m)) if (x.due <= t && n < 6) { x.due = t + 3; n++; }
  localStorage.setItem(k, JSON.stringify(m)); }"""


def _sc(points, row=None, day=D0, o=None, sl=""):
    """vocab:sc con {clave: puntos} (todos del día day) y, si se da, el orden de la fila."""
    return {"v": 1, "k": {k: {"s": s, "t": day} for k, s in points.items()}, "row": {"en": row} if row else {}, "o": o or {}, "sl": sl}


def _keys(sc=None, prefs=None, now=C.FIXED_NOW, hints=True):
    keys = C.seed_keys(now)
    if sc is not None:
        keys["vocab:sc"] = json.dumps(sc)
    if prefs is not None:
        keys["sc:prefs"] = json.dumps(prefs)
    if hints:   # las pistas de gestos ya aprendidas (que no tapen nada)
        keys["vocab:ui"] = json.dumps({"hints": {"sc-hold": 1000, "gm-peek": 1000}})
    return keys


def _hoy(page, sc=None, prefs=None, hints=True):
    C.seed(page, _keys(sc, prefs, hints=hints))
    page.wait_for_timeout(300)
    return page.evaluate(_ROW)


def _reload(page):
    C.reload(page)
    page.wait_for_timeout(300)
    return page.evaluate(_ROW)


def _hold(page, sel):
    b = page.locator(sel).first.bounding_box()
    page.mouse.move(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2)
    page.mouse.down()
    page.wait_for_timeout(900)
    page.mouse.up()
    page.wait_for_timeout(600)


def _close_sheet(page):
    page.locator("#sc-sheet [data-close]").click()
    page.wait_for_function("() => !document.querySelector('#sc-sheet[open]')", timeout=3000)
    page.wait_for_timeout(200)


def _adult(page):
    page.evaluate(_PASS)
    page.evaluate("() => openSettings('mayores')")
    page.wait_for_selector("#aj-sc-on", timeout=5000)
    page.wait_for_timeout(500)


def _close_settings(page):
    page.evaluate("() => vocabSettings.close()")
    page.wait_for_function("() => !document.querySelector('dialog#ajustes[open]')", timeout=4000)
    C.settle(page, 400)


def _play_globos(page):
    """Una partida de Globos de verdad, hasta el resultado."""
    for _ in range(10):
        page.wait_for_function("() => document.querySelectorAll('#gm-air .gm-bal:not(:disabled)').length === 4 && !document.querySelector('.gm-reveal')", timeout=6000)
        for k in range(4):
            r = page.evaluate("""k => { if (document.querySelector('.gm-reveal')) return 'done';
              const b = document.querySelector(`#gm-air .gm-bal[data-k="${k}"]`); if (!b || b.disabled) return 'skip';
              b.click(); return 'clicked'; }""", k)
            if r == "done" or page.locator(".gm-reveal").count():
                break
        page.clock.fast_forward(2000)
        page.wait_for_timeout(30)
        if page.locator("#gm-end").count():
            break
    page.wait_for_selector("#gm-end", timeout=5000)


def _play_memoria(page):
    """Una partida de Memoria de verdad: prueba parejas hasta acabar."""
    kinds = page.evaluate("() => [...document.querySelectorAll('#gm-board .gm-mc')].map(b => b.querySelector('.gm-mc-face img') ? 'i' : 'w')")
    imgs = [k for k, v in enumerate(kinds) if v == "i"]
    words = [k for k, v in enumerate(kinds) if v == "w"]
    for a in imgs:
        for b in list(words):
            page.evaluate("([a, b]) => { const q = k => document.querySelector(`#gm-board .gm-mc[data-k=\"${k}\"]`); q(a).click(); q(b).click(); }", [a, b])
            page.clock.fast_forward(1400)
            page.wait_for_timeout(30)
            if page.locator("#gm-end").count():
                return
            if page.evaluate("a => document.querySelector(`#gm-board .gm-mc[data-k=\"${a}\"]`).classList.contains('ok')", a):
                words.remove(b)
                break
    page.clock.fast_forward(1600)
    page.wait_for_selector("#gm-end", timeout=5000)


def _start_game(page):
    """En la partida recién abierta: si sale la explicación o «¡A jugar!», se pulsa."""
    page.wait_for_function("() => !!document.documentElement.dataset.gmPlay", timeout=8000)
    page.wait_for_timeout(300)
    if page.locator(".gm-intro .gm-go").count():
        page.locator(".gm-intro .gm-go").click()
        page.wait_for_timeout(200)


# ---------------------------------------------------------------- se registran solos
def test_three_games_make_a_shortcut_that_survives_reload():
    """Una partida de Globos de verdad con Animales suma 1 punto (aún no hay fila); con 2 más (simuladas por el bus, como
    las manda games.js con su tema) el atajo «Globos · Animales» sale en Hoy, con su enlace directo, y sigue al recargar.
    vocab:sc guarda puntos y días, nunca horas."""
    probs = []
    page = C.new_page("phone")
    try:
        row = _hoy(page)
        if row:
            probs.append(f"sin nada usado ya hay fila: {row}")
        C.goto(page, "#/juegos/globos")
        _start_game(page)
        _play_globos(page)
        sc = page.evaluate(_SC)
        e = (sc or {}).get("k", {}).get(GLOBOS)
        if not e or abs(e["s"] - 1) > 1e-6 or e["t"] != D0:
            probs.append(f"una partida de Globos (Animales) no suma 1 punto de hoy: {sc}")
        page.wait_for_timeout(700)
        C.goto(page, "#/")
        if page.evaluate(_ROW):
            probs.append("con 1 punto ya sale la fila (entra con 2)")
        page.evaluate("""() => { for (let i = 0; i < 2; i++) bus.emit('game-done', {game: 'globos', score: 7, stars: 2, tp: 'animales'}); }""")
        C.goto(page, "#/juegos")
        C.goto(page, "#/")
        page.wait_for_timeout(300)
        row = page.evaluate(_ROW)
        it = row and next((x for x in row["items"] if x["k"] == GLOBOS), None)
        if not it or it["href"] != "#/juegos/globos?t=animales" or it["label"] != "Globos · Animales" or it["name"] != "Globos / Animales" or not it["img"]:
            probs.append(f"tras 3 partidas no sale el atajo de Globos · Animales: {row}")
        if row and (row["title"] != "Tus atajos" or row["n"] != len(row["items"])):
            probs.append(f"la fila: {row}")
        row = _reload(page)
        if not row or GLOBOS not in [x["k"] for x in row["items"]]:
            probs.append(f"al recargar el atajo se va: {row}")
        sc = page.evaluate(_SC)
        if abs(sc["k"][GLOBOS]["s"] - 3) > 1e-6:
            probs.append(f"3 partidas no son 3 puntos: {sc['k']}")
        times = [v for e in sc["k"].values() for v in e.values() if isinstance(v, (int, float)) and v > 1e7]
        if times or set(sc) - {"v", "k", "row", "o", "sl"}:
            probs.append(f"vocab:sc guarda algo más que puntos y días: {sc}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_tap_opens_the_game_with_its_topic():
    """Tocar el atajo «Memoria · Comida» abre Memoria con Comida (#/juegos/memoria?t=w03) sin cambiar el tema elegido de
    los juegos; la partida cuenta para ese mismo atajo. Los otros enlaces directos: #/doc/<tema>?m=<modo> abre ese modo y
    la gramática va a #/leccion/G-…."""
    probs = []
    page = C.new_page("phone")
    try:
        row = _hoy(page, _sc({MEMORIA: 3, GRAM: 2.5, TEST: 2}))
        hrefs = {x["k"]: x["href"] for x in (row or {}).get("items", [])}
        want = {MEMORIA: "#/juegos/memoria?t=w03", GRAM: "#/leccion/G-A1-01", TEST: "#/doc/w02?m=test"}
        if hrefs != want:
            probs.append(f"enlaces de la fila: {hrefs}")
        topic0 = page.evaluate("() => store.get('games:topic')")
        page.evaluate("() => { window.__gd = []; bus.on('game-done', d => __gd.push(d)); }")
        page.locator(f'#hm-sc .sc-p[data-sc="{MEMORIA}"]').click()
        page.wait_for_function("() => location.hash.startsWith('#/juegos/memoria')", timeout=8000)
        if page.evaluate("location.hash") != "#/juegos/memoria?t=w03":
            probs.append(f"el atajo lleva a {page.evaluate('location.hash')}")
        _start_game(page)
        _play_memoria(page)
        gd = page.evaluate("() => __gd")
        if not gd or gd[-1].get("tp") != "w03":
            probs.append(f"la partida no se jugó con Comida (w03): {gd}")
        if page.evaluate("() => store.get('games:topic')") != topic0:
            probs.append("el atajo cambia el tema elegido de los juegos")
        if abs(page.evaluate(_SC)["k"][MEMORIA]["s"] - 4) > 1e-6:
            probs.append(f"la partida del atajo no suma a su clave: {page.evaluate(_SC)['k']}")
        page.wait_for_timeout(700)
        page.locator("#gm-again").click()
        page.wait_for_timeout(500)
        if page.evaluate("location.hash") != "#/juegos/memoria?t=w03":
            probs.append("«Otra vez» pierde el tema del atajo")
        # un tema en un modo
        C.goto(page, "#/doc/w02?m=test")
        if page.evaluate("() => (document.querySelector('#dv-tab-test') || {}).getAttribute && document.querySelector('#dv-tab-test').getAttribute('aria-selected')") != "true":
            probs.append("#/doc/w02?m=test no abre Preguntas")
        C.goto(page, "#/doc/w03?m=practica")
        if page.evaluate("() => document.querySelector('#dv-tab-practica').getAttribute('aria-selected')") != "true":
            probs.append("#/doc/w03?m=practica no abre Escribir")
        if not page.evaluate("() => knownRoute('leccion/G-A1-01')"):
            probs.append("#/leccion/G-A1-01 no es una ruta")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_topic_modes_and_grammar_count():
    """Tarjetas: 8 tarjetas distintas giradas en una visita suman 1 punto a «tema:modo tarjetas»; terminar Preguntas de
    verdad suma a «tema:test»; una unidad de gramática terminada (lesson-done con grammar) suma a «gram:G-…»."""
    probs = []
    page = C.new_page("phone")
    try:
        _hoy(page)
        C.goto(page, "#/doc/w03?m=tarjetas")
        for i in range(8):
            page.locator("#card").click()
            page.wait_for_timeout(120)
            if i == 6 and (page.evaluate(_SC) or {}).get("k", {}).get("en/tema:w03:tarjetas"):
                probs.append("con 7 tarjetas ya cuenta")
            page.locator("#next").click()
            page.wait_for_timeout(120)
        e = (page.evaluate(_SC) or {}).get("k", {}).get("en/tema:w03:tarjetas")
        if not e or abs(e["s"] - 1) > 1e-6:
            probs.append(f"8 tarjetas giradas no suman 1 punto: {page.evaluate(_SC)}")
        page.locator("#dv-tab-test").click()
        page.wait_for_timeout(300)
        for _ in range(12):
            if page.locator("#again").count():
                break
            page.locator(".qz-opt").first.click()
            page.wait_for_timeout(150)
            if page.locator("#nextq:not([hidden])").count():
                page.locator("#nextq").click()
            page.wait_for_timeout(250)
        page.wait_for_selector("#again", timeout=5000)
        e = page.evaluate(_SC)["k"].get("en/tema:w03:test")
        if not e or abs(e["s"] - 1) > 1e-6:
            probs.append(f"terminar Preguntas no suma a tema:test: {page.evaluate(_SC)['k']}")
        page.evaluate("() => { bus.emit('lesson-done', {id: 'G-A1-01', lv: 'A1', stars: 3, grammar: true}); bus.emit('lesson-done', {id: 'A1-001', lv: 'A1', stars: 3}); }")
        k = page.evaluate(_SC)["k"]
        if abs(k.get(GRAM, {}).get("s", 0) - 1) > 1e-6 or any("A1-001" in x for x in k):
            probs.append(f"la gramática (y solo la gramática) cuenta: {k}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_points_halve_and_the_shortcut_leaves_after_21_days():
    """Con el reloj 21 días más tarde, 3 puntos son 0,375 (la mitad cada 7 días) y el atajo ya no sale."""
    probs = []
    page = C.new_page("phone")
    try:
        row = _hoy(page, _sc({GLOBOS: 3}))
        if not row or [x["k"] for x in row["items"]] != [GLOBOS]:
            probs.append(f"con 3 puntos de hoy no sale: {row}")
        if abs(page.evaluate(f"() => vocabShortcuts.points({json.dumps(GLOBOS)})") - 3) > 1e-6:
            probs.append("los puntos de hoy no son 3")
    finally:
        page.context.close()
    later = C.FIXED_NOW + _dt.timedelta(days=21)
    page = C.new_page("phone", now=later)
    try:
        C.seed(page, _keys(_sc({GLOBOS: 3})))
        page.wait_for_timeout(300)
        p = page.evaluate(f"() => vocabShortcuts.points({json.dumps(GLOBOS)})")
        if abs(p - 0.375) > 1e-3:
            probs.append(f"21 días después los puntos son {p}, no 0,375")
        if page.evaluate(_ROW):
            probs.append(f"21 días después sigue el atajo: {page.evaluate(_ROW)}")
        if page.evaluate("() => today()") != D0 + 21:
            probs.append("el reloj de la prueba no avanzó 21 días")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_each_keeps_its_place_and_new_ones_need_20_percent_more():
    """En el móvil caben 3. Cada atajo conserva su sitio (aunque otro tenga más puntos); uno nuevo con 3,5 no echa al de
    3 (le falta el 20 %), con 3,7 sí, y entra en su mismo sitio. Sin hueco libre, el primer día no hay fila."""
    probs = []
    page = C.new_page("phone")
    try:
        row = _hoy(page, _sc({GLOBOS: 3, MEMORIA: 5, LETRAS: 4, LLUVIA: 3.5}, row=[GLOBOS, MEMORIA, LETRAS]))
        if page.evaluate(_KEYS) != [GLOBOS, MEMORIA, LETRAS]:
            probs.append(f"con 3,5 contra 3 cambia la fila: {page.evaluate(_KEYS)}")
        page.evaluate(f"() => {{ const o = JSON.parse(localStorage.getItem('vocab:sc')); o.k[{json.dumps(LLUVIA)}].s = 3.7; localStorage.setItem('vocab:sc', JSON.stringify(o)); }}")
        _reload(page)
        if page.evaluate(_KEYS) != [LLUVIA, MEMORIA, LETRAS]:
            probs.append(f"con 3,7 contra 3 no entra en el sitio del más flojo: {page.evaluate(_KEYS)}")
        row = page.evaluate(_SC)["row"]["en"]
        if row != [LLUVIA, MEMORIA, LETRAS]:
            probs.append(f"vocab:sc.row no guarda los sitios: {row}")
        # el que sale no vuelve si no supera al más flojo en un 20 %
        page.evaluate(f"() => {{ const o = JSON.parse(localStorage.getItem('vocab:sc')); o.k[{json.dumps(GLOBOS)}].s = 4.4; localStorage.setItem('vocab:sc', JSON.stringify(o)); }}")
        _reload(page)
        if page.evaluate(_KEYS) != [LLUVIA, MEMORIA, LETRAS]:
            probs.append(f"4,4 contra 3,7 (menos del 20 %) cambia la fila: {page.evaluate(_KEYS)}")
        # el primer día (ningún día de actividad antes de hoy) no hay fila
        page.evaluate(f"() => {{ localStorage.setItem('act', JSON.stringify({{[dayKey(new Date())]: 3}})); }}")
        if _reload(page):
            probs.append("el primer día hay fila")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Fijar · No sugerir
def test_pin_persists_and_syncs():
    """Mantener pulsada una pieza abre su hoja; «Fijar» es un conmutador (aria-pressed): pasa a «Fijado» con el foco en
    el mismo botón y la deja fija (chincheta, «fijado» en su nombre) aunque pierda los puntos, sigue al recargar y va en
    sc:prefs (en la exportación y al cargarla). «Editar › Fijado» la suelta. El botón cabe entero en su cápsula."""
    probs = []
    page = C.new_page("phone")
    try:
        _hoy(page, _sc({GLOBOS: 3, MEMORIA: 4}))
        _hold(page, f'#hm-sc .sc-p[data-sc="{GLOBOS}"]')
        sh = page.evaluate(_SHEET)
        if not sh or sh["title"] != "Globos · Animales" or [r["k"] for r in sh["rows"]] != [GLOBOS] or sh["rows"][0]["pin"].strip() != "Fijar":
            probs.append(f"mantener pulsado no abre la hoja de esa pieza: {sh}")
        page.evaluate(_FINISH)
        page.wait_for_timeout(100)
        geo = page.evaluate("() => ({sheet: document.getElementById('sc-sheet').getBoundingClientRect().top, row: document.querySelector('#hm-sc .sc-ps').getBoundingClientRect().bottom})")
        if geo["sheet"] < geo["row"] - 1:
            probs.append(f"la hoja de una pieza tapa la fila: {geo}")
        page.locator("#sc-sheet [data-pin]").focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(500)
        sh = page.evaluate(_SHEET)
        b = page.evaluate("""() => { const b = document.querySelector('#sc-sheet [data-pin]');
          return {p: b.getAttribute('aria-pressed'), focus: document.activeElement === b, sw: b.scrollWidth, w: b.clientWidth, name: b.getAttribute('aria-label')}; }""")
        if not sh or sh["rows"][0]["pin"].strip() != "Fijado" or b["p"] != "true" or not b["focus"] or b["sw"] > b["w"] + 1 or b["name"] != "Fijar «Globos · Animales»":
            probs.append(f"tras «Fijar» la hoja no dice «Fijado» (o pierde el foco, o no cabe): {sh} {b}")
        _close_sheet(page)
        if (page.evaluate(_PREFS) or {}).get("pinned") != [GLOBOS]:
            probs.append(f"sc:prefs tras fijar: {page.evaluate(_PREFS)}")
        it = next((x for x in page.evaluate(_ROW)["items"] if x["k"] == GLOBOS), None)
        if not it or not it["pin"] or not it["label"].endswith("fijado"):
            probs.append(f"la pieza fijada no lo enseña: {it}")
        page.evaluate(f"() => {{ const o = JSON.parse(localStorage.getItem('vocab:sc')); delete o.k[{json.dumps(GLOBOS)}]; localStorage.setItem('vocab:sc', JSON.stringify(o)); }}")
        row = _reload(page)
        if not row or GLOBOS not in [x["k"] for x in row["items"]]:
            probs.append(f"sin puntos, el fijado se va: {row}")
        snap = C.export(page)
        if "sc:prefs" not in snap["keys"] or json.loads(snap["keys"]["sc:prefs"]).get("pinned") != [GLOBOS]:
            probs.append(f"sc:prefs no va en la exportación: {sorted(snap['keys'])}")
        page.evaluate("() => localStorage.removeItem('sc:prefs')")
        res = C.import_export(page, snap)
        if not res.get("ok") or (page.evaluate(_PREFS) or {}).get("pinned") != [GLOBOS]:
            probs.append(f"al cargar la partida no vuelven los fijados: {res} {page.evaluate(_PREFS)}")
        page.wait_for_timeout(300)
        page.locator("#sc-ed").click()
        page.wait_for_timeout(600)
        page.locator(f'#sc-sheet .sc-er[data-k="{GLOBOS}"] [data-pin]').click()
        page.wait_for_timeout(500)
        if (page.evaluate(_PREFS) or {}).get("pinned") != []:
            probs.append(f"«Fijado» no lo suelta: {page.evaluate(_PREFS)}")
        _close_sheet(page)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_dont_suggest_hides_and_undo_brings_it_back():
    """«Editar › No sugerir» (con la nota «Sale de Hoy 30 días») cierra la hoja, quita la pieza 30 días y avisa «Ya no
    sale en Hoy» con «Deshacer» (botón de 44 px); tocar el texto del aviso no lo cierra; «Deshacer» la devuelve a su
    mismo sitio. El aviso dura 9 s y se para con el puntero encima; luego se va y sigue oculta; «Volver a sugerir» la
    trae."""
    probs = []
    page = C.new_page("phone")
    try:
        _hoy(page, _sc({GLOBOS: 3, MEMORIA: 4, LETRAS: 2.5}, row=[GLOBOS, MEMORIA, LETRAS]))
        page.locator("#sc-ed").click()
        page.wait_for_timeout(600)
        sh = page.evaluate(_SHEET)
        if not sh or [r["k"] for r in sh["rows"]] != [GLOBOS, MEMORIA, LETRAS] or not all(r["hide"] for r in sh["rows"]):
            probs.append(f"la hoja «Editar»: {sh}")
        notes = page.evaluate("() => [...document.querySelectorAll('#sc-sheet .sc-hn')].map(x => x.textContent)")
        if notes != ["Sale de Hoy 30 días"] * 3:
            probs.append(f"la nota de «No sugerir»: {notes}")
        page.locator(f'#sc-sheet .sc-er[data-k="{MEMORIA}"] [data-hide]').click()
        page.wait_for_function("() => !document.querySelector('#sc-sheet[open]')", timeout=3000)
        page.wait_for_timeout(500)
        if page.evaluate(_KEYS) != [GLOBOS, LETRAS]:
            probs.append(f"«No sugerir» no la quita: {page.evaluate(_KEYS)}")
        hid = (page.evaluate(_PREFS) or {}).get("hidden", {})
        if hid.get(MEMORIA) != D0 + 30:
            probs.append(f"oculta hasta el día {hid.get(MEMORIA)}, no {D0 + 30}")
        t = page.evaluate(_TOAST)
        if not t or t["t"] != "Ya no sale en Hoy" or t["btn"] != "Deshacer" or t["bh"] < 44:
            probs.append(f"el aviso con «Deshacer»: {t}")
        page.locator("#m-toasts .m-tt").click()
        page.wait_for_timeout(300)
        if not page.evaluate(_TOAST):
            probs.append("tocar el texto del aviso lo cierra (y se pierde «Deshacer»)")
        page.locator("#m-toasts .m-ta").click()
        page.wait_for_timeout(600)
        if page.evaluate(_KEYS) != [GLOBOS, MEMORIA, LETRAS]:
            probs.append(f"«Deshacer» no la devuelve a su sitio: {page.evaluate(_KEYS)}")
        if (page.evaluate(_PREFS) or {}).get("hidden"):
            probs.append(f"tras «Deshacer» sigue oculta: {page.evaluate(_PREFS)}")
        # otra vez, sin deshacer
        page.locator("#sc-ed").click()
        page.wait_for_timeout(600)
        page.locator(f'#sc-sheet .sc-er[data-k="{MEMORIA}"] [data-hide]').click()
        page.wait_for_timeout(800)
        page.clock.fast_forward(6000)
        page.wait_for_timeout(400)
        if not page.evaluate(_TOAST):
            probs.append("el aviso con «Deshacer» se va antes de 9 s")
        page.locator("#m-toasts .m-tt").hover()   # con el puntero encima, el tiempo se para
        page.clock.fast_forward(6000)
        page.wait_for_timeout(300)
        if not page.evaluate(_TOAST):
            probs.append("con el puntero encima el aviso se va igual")
        page.mouse.move(5, 400)
        page.clock.fast_forward(4500)
        page.wait_for_timeout(500)
        if page.evaluate(_TOAST):
            probs.append("el aviso no se va al terminar su tiempo")
        if MEMORIA in _reload(page)["items"].__repr__():
            probs.append("al recargar vuelve la oculta")
        page.locator("#sc-ed").click()
        page.wait_for_timeout(600)
        sh = page.evaluate(_SHEET)
        if not sh or not any(r["k"] == MEMORIA and r["unhide"] for r in sh["rows"]):
            probs.append(f"la hoja no lista los no sugeridos: {sh}")
        page.locator(f'#sc-sheet .sc-er[data-k="{MEMORIA}"] [data-unhide]').click()
        page.wait_for_timeout(600)
        _close_sheet(page)
        if MEMORIA not in page.evaluate(_KEYS):
            probs.append(f"«Volver a sugerir» no la trae: {page.evaluate(_KEYS)}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- lo guardado
def test_device_only_log_and_synced_prefs():
    """vocab:sc es solo del aparato (DEVICE_ONLY de js/save.js: ni se exporta ni se carga); sc:prefs es una clave exacta
    que se exporta. Cargar una partida no trae ni borra lo aprendido en el aparato."""
    probs = []
    page = C.new_page("phone")
    try:
        _hoy(page, _sc({GLOBOS: 3}), prefs={"pinned": [MEMORIA], "hidden": {LETRAS: D0 + 10}, "off": False, "slowAsked": False})
        inv = page.evaluate("() => vocabSave.inventory")
        if "vocab:sc" not in inv["deviceOnly"] or "sc:prefs" not in inv["exact"]:
            probs.append(f"inventario de save.js: deviceOnly {inv['deviceOnly']}, exact sin sc:prefs: {'sc:prefs' not in inv['exact']}")
        snap = C.export(page)
        if "vocab:sc" in snap["keys"]:
            probs.append("vocab:sc va en la exportación")
        if "sc:prefs" not in snap["keys"]:
            probs.append("sc:prefs no va en la exportación")
        bad = dict(snap)
        bad["keys"] = dict(snap["keys"], **{"vocab:sc": json.dumps(_sc({LLUVIA: 9}))})
        sc0 = page.evaluate("() => localStorage.getItem('vocab:sc')")
        res = C.import_export(page, bad)
        if not res.get("ok") or page.evaluate("() => localStorage.getItem('vocab:sc')") != sc0:
            probs.append(f"cargar una partida toca vocab:sc: {res}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_switch_off_and_forget_in_para_mayores():
    """Para mayores › Atajos: «Atajos automáticos» apagado (sc:prefs.off) quita la fila y deja de apuntar; encendido
    vuelve. «Olvidar lo aprendido» (con la nota de que las palabras y el progreso no se tocan) pide un segundo toque y
    borra vocab:sc; los fijados y ocultos se quedan."""
    probs = []
    page = C.new_page("phone")
    try:
        row = _hoy(page, _sc({GLOBOS: 3, MEMORIA: 4}), prefs={"pinned": [LETRAS], "hidden": {LLUVIA: D0 + 10}, "off": False, "slowAsked": False})
        if not row:
            probs.append("no hay fila de partida")
        _adult(page)
        sec = page.evaluate("""() => { const s = document.getElementById('aj-sc-h'); const on = document.getElementById('aj-sc-on');
          return {h: s && s.textContent, on: on && on.checked, role: on && on.getAttribute('role'),
            lab: (on && on.closest('label') || {}).textContent, forget: (document.getElementById('aj-sc-forget') || {}).textContent}; }""")
        if sec["h"] != "Atajos" or not sec["on"] or sec["role"] != "switch" or "Atajos automáticos" not in (sec["lab"] or "") or "Olvidar lo aprendido" not in (sec["forget"] or "") \
                or "Las palabras y el progreso no se tocan" not in (sec["forget"] or ""):
            probs.append(f"la sección Atajos: {sec}")
        page.locator("label[for=aj-sc-on]").click()
        page.wait_for_timeout(200)
        if (page.evaluate(_PREFS) or {}).get("off") is not True:
            probs.append(f"apagar no guarda off: {page.evaluate(_PREFS)}")
        _close_settings(page)
        if page.evaluate(_ROW) or page.evaluate("() => document.documentElement.hasAttribute('data-sc')"):
            probs.append("con los atajos apagados sigue la fila")
        sc0 = page.evaluate("() => localStorage.getItem('vocab:sc')")
        page.evaluate("() => { for (let i = 0; i < 3; i++) bus.emit('game-done', {game: 'lluvia', score: 3, stars: 1, tp: 'colores'}); }")
        if page.evaluate("() => localStorage.getItem('vocab:sc')") != sc0:
            probs.append("apagado sigue apuntando lo que se usa")
        if _reload(page):
            probs.append("apagado, al recargar sale la fila")
        _adult(page)
        page.locator("label[for=aj-sc-on]").click()
        page.wait_for_timeout(200)
        # olvidar: primer toque pregunta, el segundo borra
        page.locator("#aj-sc-forget").click()
        page.wait_for_timeout(500)
        if not page.evaluate("() => localStorage.getItem('vocab:sc')"):
            probs.append("un solo toque ya olvida")
        if "Seguro" not in page.locator("#aj-sc-fs").text_content():
            probs.append(f"no pide confirmación: {page.locator('#aj-sc-fs').text_content()!r}")
        page.locator("#aj-sc-forget").click()
        page.wait_for_timeout(300)
        if page.evaluate("() => localStorage.getItem('vocab:sc')") is not None:
            probs.append("«Olvidar lo aprendido» no borra vocab:sc")
        p = page.evaluate(_PREFS)
        if p.get("pinned") != [LETRAS] or LLUVIA not in p.get("hidden", {}) or p.get("off"):
            probs.append(f"olvidar toca los fijados u ocultos: {p}")
        _close_settings(page)
        row = page.evaluate(_ROW)
        if not row or [x["k"] for x in row["items"]] != [LETRAS]:
            probs.append(f"tras olvidar solo queda el fijado: {row}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la tortuga
def _listen(page, slow, fast):
    """En Tarjetas (cara de atrás): fast veces el altavoz y luego slow veces la tortuga."""
    C.goto(page, "#/doc/w03?m=tarjetas")
    page.locator("#card").click()
    page.wait_for_timeout(200)
    for _ in range(fast):
        page.locator("#card .ln-spk").first.click()
    for _ in range(slow):
        page.locator("#card .ln-slow").first.click()


def test_turtle_question_once_and_yes_sets_slow():
    """Con el 60 % o más de las últimas 20 escuchas con la tortuga, el zorro pregunta una vez en Hoy «¿Lo pongo siempre
    despacio?»; «Sí, despacio» pone la velocidad lenta del ajuste (store "rate" 0,7) y no vuelve a preguntar. Con menos
    del 60 % no pregunta; «No, así está bien» no cambia nada y tampoco vuelve."""
    probs = []
    page = C.new_page("phone")
    try:
        _hoy(page)
        _listen(page, 11, 9)   # 9 altavoces y 11 tortugas: 55 %
        C.goto(page, "#/")
        page.wait_for_timeout(1300)
        if page.locator("#sc-slow[open]").count():
            probs.append("pregunta con el 55 %")
        _listen(page, 3, 0)    # las últimas 20: 6 altavoces y 14 tortugas = 70 %
        sl = page.evaluate(_SC)["sl"]
        if len(sl) != 20 or sl.count("1") != 14:
            probs.append(f"las escuchas apuntadas: {sl!r}")
        C.goto(page, "#/")
        page.wait_for_selector("#sc-slow[open]", timeout=4000)
        page.wait_for_timeout(500)
        q = page.evaluate("""() => { const d = document.getElementById('sc-slow');
          return {t: d.querySelector('#sc-slow-t').textContent, yes: d.querySelector('[data-yes]').textContent.trim(), no: d.querySelector('[data-no]').textContent.trim(),
            fox: !!d.querySelector('.sc-slow-fox *'), modal: d.matches(':modal')}; }""")
        if q["t"] != "¿Lo pongo siempre despacio?" or q["yes"] != "Sí, despacio" or q["no"] != "No, así está bien" or not q["fox"] or not q["modal"]:
            probs.append(f"la pregunta: {q}")
        if page.evaluate("() => !!document.activeElement.closest('[data-yes]')"):
            probs.append("la pregunta abre con el foco en «Sí, despacio» (empuja la respuesta)")
        if page.evaluate("() => store.get('rate')") != 0.9:
            probs.append("cambia la velocidad antes de contestar")
        C.shot(page, "F5a-tortuga-phone", OUT, full_page=False)
        page.locator("#sc-slow [data-yes]").click()
        page.wait_for_function("() => !document.querySelector('#sc-slow[open]')", timeout=3000)
        if page.evaluate("() => [store.get('rate'), rate]") != [0.7, 0.7]:
            probs.append(f"«Sí» no pone la velocidad lenta: {page.evaluate('() => [store.get(`rate`), rate]')}")
        if page.evaluate("() => rateWord(rate)") != "Lenta":
            probs.append(f"el ajuste no dice «Lenta»: {page.evaluate('() => rateWord(rate)')}")
        if (page.evaluate(_PREFS) or {}).get("slowAsked") is not True:
            probs.append("no se apunta que ya preguntó")
        page.evaluate("() => store.set('rate', 0.9)")
        _reload(page)
        page.wait_for_timeout(1300)
        if page.locator("#sc-slow[open]").count():
            probs.append("pregunta otra vez")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = C.new_page("phone")
    try:
        _hoy(page, _sc({}, sl="1" * 20))
        page.wait_for_selector("#sc-slow[open]", timeout=4000)
        page.wait_for_timeout(400)
        page.locator("#sc-slow [data-no]").click()
        page.wait_for_function("() => !document.querySelector('#sc-slow[open]')", timeout=3000)
        if page.evaluate("() => store.get('rate')") != 0.9 or (page.evaluate(_PREFS) or {}).get("slowAsked") is not True:
            probs.append(f"«No» cambia algo o no se apunta: {page.evaluate(_PREFS)}")
        _reload(page)
        page.wait_for_timeout(1300)
        if page.locator("#sc-slow[open]").count():
            probs.append("tras «No» vuelve a preguntar")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_piece_rule_short_names_prune_and_listens():
    """Cada pieza sigue una regla: el dibujo grande es qué se hace (el del juego; el icono del modo con tinte; la
    gramática, su dibujo sobre una ficha gris, nunca un círculo azul relleno) y la insignia, el tema; debajo, dos
    líneas «Globos / Animales», «Preguntas / Cuerpo», «Gramática / To be», sin cortar. vocab:sc no pasa de 60 claves
    y la que se acaba de usar siempre se queda. Las escuchas cuentan el «Oír» de Frases y no las grabaciones propias."""
    probs = []
    page = C.new_page("phone")
    try:
        row = _hoy(page, _sc({GLOBOS: 3, TEST: 4, GRAM: 2.5}))
        P = page.evaluate("""() => [...document.querySelectorAll('#hm-sc .sc-p')].map(a => {
          const pic = a.querySelector('.sc-pic'), big = pic.querySelector(':scope > img, :scope > .sc-tile'), tile = pic.querySelector(':scope > .sc-tile');
          const bg = tile ? getComputedStyle(tile).backgroundColor : '', lines = [...a.querySelectorAll('.sc-n > span')];
          return {k: a.dataset.sc, big: big && big.tagName === 'IMG' ? big.getAttribute('src') : tile ? (tile.querySelector('img') ? 'tile-img:' + tile.querySelector('img').getAttribute('src') : 'tile-icon') : null,
            soft: !!(tile && tile.classList.contains('soft')), bg, badge: (pic.querySelector('.sc-bdg img') || {getAttribute: () => null}).getAttribute('src'),
            lines: lines.map(x => x.textContent), cut: lines.some(x => x.scrollWidth > x.clientWidth + 1)}; })""")
        want = {GLOBOS: ("img/games/globos.png", ["Globos", "Animales"]), TEST: ("tile-icon", ["Preguntas", "Cuerpo"]), GRAM: ("tile-img:img/om_1F4D6.png", ["Gramática", "To be"])}
        for x in P:
            w = want.get(x["k"])
            if not w or x["big"] != w[0] or x["lines"] != w[1] or x["cut"]:
                probs.append(f"pieza {x['k']}: {x}")
            if x["k"] == GLOBOS and (not x["badge"] or "om_1F436" not in x["badge"]):
                probs.append(f"la insignia de Globos no es el tema: {x}")
            if x["k"] == TEST and (not x["soft"] or not x["badge"]):
                probs.append(f"un modo: icono con tinte y el tema en la insignia: {x}")
            if x["bg"] in ("rgb(30, 110, 244)", "rgb(0, 145, 255)"):
                probs.append(f"pieza con un círculo azul relleno: {x}")
        # la poda: 60 claves con 3 puntos y luego 5 nuevas de 1 punto
        r = page.evaluate("""() => { const o = {v: 1, k: {}, row: {}, o: {}, sl: ''}, d = today();
          for (let i = 0; i < 60; i++) o.k['en/juego:memoria:t' + i] = {s: 3, t: d};
          localStorage.setItem('vocab:sc', JSON.stringify(o));
          const out = [];
          for (let i = 0; i < 5; i++) { const k = 'en/juego:globos:n' + i; vocabShortcuts.log(k); const s = JSON.parse(localStorage.getItem('vocab:sc'));
            out.push([Object.keys(s.k).length, !!s.k[k], i ? !!s.k['en/juego:globos:n' + (i - 1)] : true]); }
          return out; }""")
        if any(n > 60 or not here for n, here, _ in r):
            probs.append(f"la poda deja más de 60 claves o quita la recién usada: {r}")
        # escuchas: «Oír» de Frases cuenta; «Escuchar» de una grabación propia del Buzón, no
        sl = page.evaluate("""() => { const o = JSON.parse(localStorage.getItem('vocab:sc')); o.sl = ''; localStorage.setItem('vocab:sc', JSON.stringify(o));
          const mk = (html) => { const w = document.createElement('div'); w.innerHTML = html; document.body.append(w); const b = w.firstElementChild; b.click(); w.remove(); };
          mk('<button type="button" id="ph-say">Oír</button>'); mk('<button type="button" id="ph-slow" aria-label="Oír despacio"></button>');
          mk('<button type="button" class="mb-rp" aria-label="Escuchar la grabación"></button>');
          return JSON.parse(localStorage.getItem('vocab:sc')).sl; }""")
        if sl != "01":
            probs.append(f"las escuchas apuntadas: {sl!r} (se esperaba '01')")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Hoy sin scroll · tableta · a medias
def test_hoy_fits_at_390x844_with_the_row():
    """Con la partida sembrada (y su frase de la cena), 3 atajos y un HOME_SLOT de prueba más, Hoy cabe sin scroll a
    390×844: la fila manda y homeSlots() da un solo HOME_SLOT (y fit() aún puede quitarlo: desde el paquete «Inicio» la
    frase de la cena se va antes que la semana de Hoy). También con la tarjeta en la lección y la fila «Repasar 6», en
    oscuro y en un móvil bajo (375×667). Piezas de 44 px o más, con nombre, dibujo y su tecla 1-3."""
    probs = []
    sc = _sc({GLOBOS: 3, MEMORIA: 4, GRAM: 2.5})
    for label, kw, few in (("390×844", {}, False), ("390×844 oscuro, lección + Repasar", {"color_scheme": "dark"}, True),
                           ("375×667", {"viewport": {"width": 375, "height": 667}}, False)):
        page = C.new_page("phone", **kw)
        try:
            C.seed(page, _keys(sc))
            page.evaluate("() => { const f = async () => ({icon: 'star', t: 'Fila de prueba', sub: 'HOME_SLOT', href: '#/'}); f.id = 'prueba'; HOME_SLOTS.push(f); }")
            if few:
                page.evaluate(_FEW)
            C.goto(page, "#/juegos")
            C.goto(page, "#/")
            page.wait_for_timeout(500)
            m = page.evaluate(_FIT)
            row = page.evaluate(_ROW)
            if m["sh"] > m["ih"]:
                probs.append(f"{label}: Hoy necesita scroll ({m})")
            if not row or len(row["items"]) != 3:
                probs.append(f"{label}: la fila no tiene 3 piezas: {row}")
                continue
            if label == "390×844":
                n = page.evaluate("async () => (await homeSlots()).length")
                if n != 1 or m["slots"] > 1:
                    probs.append(f"{label}: con la fila homeSlots() debe dar 1 HOME_SLOT, da {n} (y se ven {m['slots']})")
            if few and not page.locator("#hm-rev").count():
                probs.append(f"{label}: no sale la fila «Repasar»")
            for i, it in enumerate(row["items"]):
                if it["h"] < 44 or it["w"] < 44 or not it["label"] or not it["name"] or not it["img"] or it["key"] != str(i + 1):
                    probs.append(f"{label}: pieza {i + 1}: {it}")
            if row["role"] != "list" or row["labelled"] != "sc-h" or not row["ed"]:
                probs.append(f"{label}: accesibilidad de la fila: {row}")
            # «Editar», al final de la cabecera «Tus atajos», con un toque de 44 px o más (su ::after) que no pisa las piezas
            ed = page.evaluate("""() => { const e = document.getElementById('sc-ed'), b = e.getBoundingClientRect(), a = getComputedStyle(e, '::after');
              const hd = document.querySelector('#hm-sc .sc-hd'), h2 = document.getElementById('sc-h').getBoundingClientRect(), ps = document.querySelector('#hm-sc .sc-ps').getBoundingClientRect();
              const top = b.top + parseFloat(a.top), bot = b.bottom - parseFloat(a.bottom), lft = b.left + parseFloat(a.left), rgt = b.right - parseFloat(a.right);
              const hit = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && !!t.closest('#sc-ed'); };
              return {w: rgt - lft, h: bot - top, t: e.textContent.trim(), name: e.getAttribute('aria-label'), inHead: e.parentElement === hd,
                mid: Math.abs((b.top + b.bottom) / 2 - (h2.top + h2.bottom) / 2) < 2, over: bot - ps.top,
                hit: hit((lft + rgt) / 2, top + 2) && hit((lft + rgt) / 2, bot - 2) && hit(lft + 2, (top + bot) / 2) && hit(rgt - 2, (top + bot) / 2)}; }""")
            if ed["w"] < 44 or ed["h"] < 44 or not ed["hit"] or ed["t"] != "Editar" or not ed["name"].startswith("Editar") or not ed["inHead"] or not ed["mid"] or ed["over"] > 4:
                probs.append(f"{label}: «Editar» no es un botón de 44 px o más al final de la cabecera: {ed}")
            if label == "390×844":
                C.shot(page, "F5a-hoy-phone-light", OUT, full_page=False)
            elif few:
                C.shot(page, "F5a-hoy-phone-dark", OUT, full_page=False)
            probs += [f"{label}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_tablet_shows_four():
    """Con 5 atajos posibles: 3 piezas en el móvil, 4 en tableta (744 y 820 de ancho) y en el escritorio."""
    probs = []
    sc = _sc({GLOBOS: 3, MEMORIA: 4, GRAM: 2.5, LETRAS: 2.2, TEST: 2.1})
    for label, kind, kw, n in (("móvil", "phone", {}, 3), ("tableta 744", "phone", {"viewport": {"width": 744, "height": 1133}}, 4),
                               ("tableta 820", "phone", {"viewport": {"width": 820, "height": 1180}}, 4), ("escritorio", "desk", {}, 4)):
        page = C.new_page(kind, **kw)
        try:
            C.seed(page, _keys(sc))
            page.wait_for_timeout(400)
            row = page.evaluate(_ROW)
            m = page.evaluate(_FIT)
            if not row or len(row["items"]) != n or row["n"] != n:
                probs.append(f"{label}: {len(row['items']) if row else 0} piezas, no {n}")
            if m["sh"] > m["ih"]:
                probs.append(f"{label}: Hoy necesita scroll ({m})")
            if row and len({round(x['h']) for x in row['items']}) != 1:
                probs.append(f"{label}: piezas de distinto alto: {[x['h'] for x in row['items']]}")
            if label == "tableta 820":
                C.shot(page, "F5a-hoy-tableta", OUT, full_page=False)
            if label == "escritorio":
                C.shot(page, "F5a-hoy-desk", OUT, full_page=False)
            probs += [f"{label}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_half_done_comes_first_with_a_ring():
    """Una lección a medias (no la que ofrece la tarjeta) sale primera en la fila con su anillo y el accesorio no la
    repite en Hoy (fuera de Hoy, sí); sola no hace fila (para eso está el accesorio). Una práctica de Escribir a medias
    tocada hace menos de 3 días sale primera aunque no haya más atajos, con su enlace al modo Escribir."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page, _keys(_sc({GLOBOS: 3})))
        page.evaluate("sessionStorage.setItem('vocab:ls', JSON.stringify({id: 'A1-004', i: 8, first: [], miss: []}))")
        row = _reload(page)
        page.wait_for_timeout(300)
        first = row and row["items"][0]
        if not first or not first["half"] or first["href"] != "#/leccion/A1-004" or first["name"] != "Seguir / Lección 4" or not first["ring"] or first["ring"].startswith("0.0"):
            probs.append(f"la lección a medias no sale primera con su anillo: {row}")
        if page.evaluate(_ACC):
            probs.append("en Hoy el accesorio repite la lección de la fila")
        C.goto(page, "#/palabras")
        page.wait_for_timeout(200)
        if not page.evaluate(_ACC):
            probs.append("fuera de Hoy no sale el accesorio")
        C.goto(page, "#/")
        page.evaluate("() => localStorage.removeItem('vocab:sc')")
        row = _reload(page)
        if row:
            probs.append(f"la lección a medias sola hace fila: {row}")
        if not page.evaluate(_ACC):
            probs.append("sin fila, el accesorio no sale en Hoy")
        page.evaluate("sessionStorage.removeItem('vocab:ls')")
        # práctica de Escribir a medias
        pr = {"words": [{"i": 0, "n": 3}, {"i": 1, "n": 1}, {"i": 2, "n": 0}], "reps": 3, "cur": 1, "running": True}
        page.evaluate("pr => { localStorage.setItem('pr:w03:english', JSON.stringify(pr)); }", pr)
        page.evaluate(f"() => localStorage.setItem('vocab:sc', JSON.stringify({json.dumps(_sc({}, o={'en/tema:w03:practica': D0 - 1}))}))")
        row = _reload(page)
        first = row and row["items"][0]
        if not first or not first["half"] or first["href"] != "#/doc/w03?m=practica" or not first["ring"] or not first["ring"].startswith("44.4") \
                or first["name"] != "Seguir / Comida":
            probs.append(f"la práctica a medias: {row}")
        page.evaluate(f"() => localStorage.setItem('vocab:sc', JSON.stringify({json.dumps(_sc({}, o={'en/tema:w03:practica': D0 - 4}))}))")
        if _reload(page):
            probs.append("una práctica tocada hace 4 días sigue en la fila")
        page.evaluate("() => localStorage.removeItem('pr:w03:english')")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_keys_open_the_shortcuts():
    """En Hoy, las teclas 1-3 (js/keys.js, data-key de cada pieza) abren el atajo de ese sitio."""
    probs = []
    page = C.new_page("desk")
    try:
        _hoy(page, _sc({GLOBOS: 3, MEMORIA: 4, TEST: 2}, row=[TEST, GLOBOS, MEMORIA]))
        page.locator("body").click(position={"x": 5, "y": 400})
        page.keyboard.press("1")
        page.wait_for_function("() => location.hash.startsWith('#/doc/')", timeout=5000)
        if page.evaluate("location.hash") != "#/doc/w02?m=test":
            probs.append(f"la tecla 1 lleva a {page.evaluate('location.hash')}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- capturas y partida
def test_captures_sheets_and_para_mayores():
    """Capturas (móvil y escritorio, claro y oscuro) de la hoja «Editar», la de una pieza, el aviso «Deshacer» y la
    sección Atajos de Para mayores, con contraste ≥ 4,5:1 y la paleta permitida en la fila, las hojas, el aviso y la
    pregunta de la tortuga. Sin errores de consola."""
    probs = []

    def audit(page, label):
        page.evaluate(_FINISH)
        a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
        probs.extend(f"{label}: {x}" for x in a["contrast"] + a["palette"] if any(s in x for s in ("sc-", "m-t", "aj-sc")))

    for kind, scheme in (("phone", "light"), ("phone", "dark"), ("desk", "light"), ("desk", "dark")):
        page = C.new_page(kind, color_scheme=scheme)
        tag = f"{kind}-{scheme}"
        try:
            _hoy(page, _sc({GLOBOS: 3, MEMORIA: 4, GRAM: 2.5}), prefs={"pinned": [GLOBOS], "hidden": {LLUVIA: D0 + 20}, "off": False, "slowAsked": True})
            audit(page, f"{tag} Hoy")
            page.locator("#sc-ed").click()
            page.wait_for_timeout(700)
            audit(page, f"{tag} Editar")
            C.shot(page, f"F5a-editar-{tag}", OUT, full_page=False)
            _close_sheet(page)
            _hold(page, f'#hm-sc .sc-p[data-sc="{MEMORIA}"]')
            page.evaluate(_FINISH)
            if not page.evaluate(_SHEET):
                probs.append(f"{tag}: mantener pulsado no abre la hoja")
            C.shot(page, f"F5a-pieza-{tag}", OUT, full_page=False)
            page.locator("#sc-sheet [data-hide]").click()
            page.wait_for_timeout(700)
            audit(page, f"{tag} Deshacer")
            C.shot(page, f"F5a-deshacer-{tag}", OUT, full_page=False)
            page.locator("#m-toasts .m-ta").click()
            page.wait_for_timeout(400)
            _adult(page)
            page.evaluate("() => document.getElementById('aj-sc-h').scrollIntoView({block: 'center'})")
            page.wait_for_timeout(300)
            audit(page, f"{tag} Para mayores")
            C.shot(page, f"F5a-mayores-{tag}", OUT, full_page=False)
            _close_settings(page)
            # la pregunta de la tortuga
            page.evaluate("() => { const p = JSON.parse(localStorage.getItem('sc:prefs')); p.slowAsked = false; localStorage.setItem('sc:prefs', JSON.stringify(p)); const o = JSON.parse(localStorage.getItem('vocab:sc')); o.sl = '1'.repeat(20); localStorage.setItem('vocab:sc', JSON.stringify(o)); }")
            _reload(page)
            page.wait_for_selector("#sc-slow[open]", timeout=4000)
            page.wait_for_timeout(500)
            audit(page, f"{tag} tortuga")
            if kind == "desk":
                C.shot(page, f"F5a-tortuga-{tag}", OUT, full_page=False)
            page.locator("#sc-slow [data-no]").click()
            page.wait_for_timeout(500)
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_export_matches_baseline():
    """Con los atajos en uso (puntos, fila, una pieza fijada y la hoja abierta y cerrada), la partida exportada es la de
    tests/e2e/baseline/export.json salvo sc:prefs; vocab:sc no está."""
    base = C.load_baseline()
    assert base, f"falta {C.BASELINE}"
    probs = []
    page = C.new_page("phone")
    try:
        _hoy(page)
        page.evaluate(f"() => {{ for (let i = 0; i < 3; i++) vocabShortcuts.log({json.dumps(GLOBOS)}); vocabShortcuts.log({json.dumps(MEMORIA)}, 2); }}")
        row = _reload(page)
        if not row or len(row["items"]) != 2:
            probs.append(f"la fila: {row}")
        page.locator("#sc-ed").click()
        page.wait_for_timeout(600)
        page.locator(f'#sc-sheet .sc-er[data-k="{GLOBOS}"] [data-pin]').click()
        page.wait_for_timeout(400)
        _close_sheet(page)
        snap = C.export(page)
        probs += C.diff_exports(base, snap, allow_new=["sc:prefs"])
        if "vocab:sc" in snap["keys"] or "sc:prefs" not in snap["keys"]:
            probs.append(f"claves de la exportación: {sorted(snap['keys'])}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
