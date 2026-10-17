"""F2c (plan-doc §Hoy): la pestaña Hoy en una sola pantalla sin scroll. La tarjeta principal elige entre el repaso, la
siguiente lección del camino o una partida (nextAction()). Debajo van la fila «Repasar N», las dos piezas de buddy.js
(Misiones, con su hoja y el cofre, y la Palabra del día, que gira y suena), los HOME_SLOTS en filas compactas (2 como
mucho) y «Privacidad». Fuera de Hoy, el accesorio «Seguir» sale si hay algo empezado (window.vocabAccessory).
Hay un solo reclamo al entrar y nada se mueve con «Reducir movimiento». La partida exportada no cambia."""
from __future__ import annotations

import json

import common as C

# medidas de Hoy: alto de la página y lo que enseña la tarjeta principal
_FIT = "() => ({sh: document.documentElement.scrollHeight, ih: innerHeight})"
_CARD = """() => { const q = s => document.querySelector(s), go = q('#hm-go'), rv = q('#hm-rev');
  return {t: q('#hm-t') && q('#hm-t').textContent, sub: q('.hm-sub') && q('.hm-sub').textContent, say: q('.hm-say') && q('.hm-say').textContent,
    btn: go && go.textContent.trim(), href: go && go.getAttribute('href'), kind: go && go.dataset.kind, h: go && go.getBoundingClientRect().height,
    row: rv ? {t: rv.textContent.replace(/\\s+/g, ' ').trim(), href: rv.getAttribute('href')} : null,
    pieces: [...document.querySelectorAll('.hm-pair > *')].map(e => e.id), slots: [...document.querySelectorAll('#hm-slots .hm-slot')].map(e => e.dataset.slot || (e.querySelector('#sv-rem') ? 'sync' : '?')),
    title: (q('#tabhead') || {}).textContent || ''}; }"""
# deja 6 palabras pendientes de las 12 de la partida sembrada (menos de 10: la tarjeta pasa a la lección)
_FEW = """() => { const k = 'srs:english', m = JSON.parse(localStorage.getItem(k)), t = today(); let n = 0;
  for (const x of Object.values(m)) if (x.due <= t && n < 6) { x.due = t + 3; n++; }
  localStorage.setItem(k, JSON.stringify(m)); }"""
# todas las lecciones de todos los niveles hechas
_ALL_DONE = """async () => { await getMap(); const P = {};
  for (const lv of Object.keys(LVS)) for (const l of lvLessons(lv)) P[l.id] = 3;
  store.set('map:' + lang, P); }"""
_ACC = """() => { const a = document.getElementById('acc');
  return a ? {shown: !a.hidden && !!a.getClientRects().length, t: a.textContent.replace(/\\s+/g, ' ').trim(), href: a.getAttribute('href'),
    glass: a.classList.contains('glass'), dash: a.querySelector('.acc-fg').getAttribute('stroke-dasharray'),
    acc: document.documentElement.hasAttribute('data-acc')} : {shown: false}; }"""


def _fits(page, label, probs):
    m = page.evaluate(_FIT)
    if m["sh"] > m["ih"] + 2:
        probs.append(f"{label}: Hoy necesita scroll ({m['sh']} > {m['ih']})")


def _push_slot(page, sid, val):
    """Añade un HOME_SLOT de prueba (función con .id) que devuelve val."""
    page.evaluate("""([sid, val]) => { const f = async () => val; f.id = sid; HOME_SLOTS.push(f); }""", [sid, val])


# ---------------------------------------------------------------- una pantalla sin scroll
def test_hoy_fits_without_scroll():
    """A 390×844 con la barra de pestañas Hoy cabe sin scroll el primer día (solo la tarjeta y las dos piezas), con la
    partida sembrada (su aviso de Google incluido) y con un HOME_SLOT de prueba más. Los HOME_SLOTS salen como filas
    compactas, 2 como mucho, y los vacíos no ocupan sitio. Lo de antes ya no está (las 6 tarjetas, HOME_ACTS, el
    camino, el enlace a gramática)."""
    probs = []
    page = C.new_page("phone")
    try:
        C.goto(page, "")
        _fits(page, "primer día", probs)
        c = page.evaluate(_CARD)
        if c["row"] or c["slots"]:
            probs.append(f"primer día: sobra algo además de la tarjeta y las piezas: fila {c['row']}, slots {c['slots']}")
        if c["pieces"] != ["bd-mis", "bd-wotd"]:
            probs.append(f"primer día: las piezas son {c['pieces']}")
        if "Hoy" not in c["title"]:
            probs.append(f"el título grande dice {c['title']!r}")
        if not c["h"] or c["h"] < 55.5:
            probs.append(f"«Empezar» mide {c['h']} px de alto (56)")
        old = page.evaluate("""() => ['.big-acts', '.ba', '.map-cta', '.hello', '#app a[href="#/gramatica"]', '.home-priv', '.fm-home']
          .filter(s => document.querySelector('#app ' + s.replace('#app ', '')))""")
        if old:
            probs.append(f"en Hoy sigue lo de antes: {old}")
        probs += [f"primer día: {e}" for e in C.errors(page)]
    finally:
        page.context.close()

    page = C.new_page("phone")
    try:
        # un HOME_SLOT de prueba (objeto para homeRow) desde que arranca la app
        page.add_init_script("""document.addEventListener('DOMContentLoaded', () => { if (typeof HOME_SLOTS === 'undefined') return;
          const f = async () => ({t: 'Sobres nuevos', e: '✉️', badge: 2, href: '#/mapa'}); f.id = 'prueba'; HOME_SLOTS.push(f); })""")
        C.seed(page)
        c = page.evaluate(_CARD)
        if c["slots"] != ["sync", "prueba"]:
            probs.append(f"partida sembrada: los HOME_SLOTS pintados son {c['slots']} (el aviso de Google y el de prueba)")
        # el aviso de otro módulo se compacta: sin el párrafo y en una fila de menos de 100 px
        h = page.evaluate("""() => { const s = document.querySelector('#hm-slots .hm-slot:has(#sv-rem)'); const p = s && s.querySelector('p');
          return {h: s ? s.getBoundingClientRect().height : 0, p: p ? getComputedStyle(p).display : 'none'}; }""")
        if not h["h"] or h["h"] > 100 or h["p"] != "none":
            probs.append(f"el aviso de Google no se compacta: {h}")
        row = page.evaluate("""() => { const a = document.querySelector('[data-slot=prueba] .hm-row');
          return a ? {tag: a.tagName, href: a.getAttribute('href'), h: a.getBoundingClientRect().height, t: a.textContent} : null; }""")
        if not row or row["tag"] != "A" or row["href"] != "#/mapa" or row["h"] > 60 or "Sobres nuevos" not in row["t"]:
            probs.append(f"la fila del slot de prueba no es una fila compacta: {row}")
        _fits(page, "partida sembrada + slot de prueba", probs)
        # uno vacío no ocupa sitio y salen 2 como mucho (el aviso de Google sale una vez por visita)
        _push_slot(page, "vacio", "")
        _push_slot(page, "otro", {"t": "Halloween", "e": "🎃"})
        _push_slot(page, "tercero", "<p>no cabe</p>")
        C.goto(page, "#/mapa")
        C.goto(page, "#/")
        c = page.evaluate(_CARD)
        if c["slots"] != ["prueba", "otro"]:
            probs.append(f"con más slots se pintan {c['slots']} (prueba y otro: el vacío no ocupa sitio y el tercero no cabe)")
        if page.evaluate("document.querySelector('[data-slot=otro] .hm-row').tagName") != "BUTTON":
            probs.append("una fila sin enlace no es un botón")
        _fits(page, "partida sembrada + dos slots de prueba", probs)
        probs += [f"sembrada: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_hoy_desk_two_columns_and_dark():
    """Desde 820 px: dos columnas centradas (la tarjeta a la izquierda, las piezas a la derecha) y sin scroll. En oscuro
    las tarjetas son sólidas y oscuras, y las piezas se distinguen del fondo."""
    probs = []
    page = C.new_page("desk", color_scheme="dark")
    try:
        C.seed(page)
        m = page.evaluate("""() => { const r = s => document.querySelector(s).getBoundingClientRect(), a = r('#app'), h = r('.hm-hero'), s = r('.hm-side');
          const bg = s => getComputedStyle(document.querySelector(s)).backgroundColor;
          return {left: a.left, right: innerWidth - a.right, hr: h.right, sl: s.left, top: Math.abs(h.top - s.top), sh: document.documentElement.scrollHeight,
            ih: innerHeight, hero: bg('.hm-hero'), mis: bg('#bd-mis'), body: getComputedStyle(document.body).backgroundColor}; }""")
        if m["hr"] > m["sl"] or m["top"] > 2:
            probs.append(f"escritorio: la tarjeta y las piezas no van en dos columnas: {m}")
        if abs(m["left"] - m["right"]) > 2:
            probs.append(f"escritorio: Hoy no está centrado ({m['left']} / {m['right']})")
        if m["sh"] > m["ih"] + 2:
            probs.append(f"escritorio: Hoy necesita scroll ({m['sh']} > {m['ih']})")

        def lum(c):
            v = [int(float(x)) for x in c[c.index("(") + 1:c.index(")")].split(",")[:3]]
            return sum(v) / 3
        if lum(m["hero"]) > 80 or lum(m["mis"]) > 80 or lum(m["hero"]) <= lum(m["body"]):
            probs.append(f"oscuro: tarjetas {m['hero']} / {m['mis']} sobre {m['body']}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la tarjeta principal
def test_card_picks_review_lesson_or_game():
    """Con 10 o más pendientes la tarjeta es el repaso; con menos, la siguiente lección del camino (y la fila «Repasar
    N»); el primer día, la primera lección; con todo el camino hecho, «Juega una partida». nextAction() dice lo mismo."""
    probs = []
    page = C.new_page("phone")
    try:
        C.goto(page, "")
        c = page.evaluate(_CARD)
        if c["kind"] != "leccion" or not (c["t"] or "").startswith("Lección 1 ·") or c["href"] != "#/leccion/A1-001" or c["btn"] != "Empezar":
            probs.append(f"primer día: la tarjeta es {c}")
        C.seed(page)
        c = page.evaluate(_CARD)
        na = page.evaluate("nextAction().then(a => a.kind)")
        if c["kind"] != "repaso" or c["t"] != "Repaso" or c["href"] != "#/repaso" or "12 palabras" not in (c["sub"] or "") or na != "repaso":
            probs.append(f"12 pendientes: la tarjeta no es el repaso: {c} (nextAction: {na})")
        if c["row"]:
            probs.append(f"la tarjeta ya es el repaso y sale también la fila: {c['row']}")
        page.evaluate(_FEW)
        C.goto(page, "", reload=True)
        c = page.evaluate(_CARD)
        if c["kind"] != "leccion" or c["t"] != "Lección 11 · La familia" or c["href"] != "#/leccion/A1-010" or c["btn"] != "Empezar":
            probs.append(f"6 pendientes: la tarjeta no es la lección siguiente: {c}")
        if not c["row"] or c["row"]["href"] != "#/repaso" or "Repasar" not in c["row"]["t"] or "6" not in c["row"]["t"]:
            probs.append(f"6 pendientes: falta la fila «Repasar 6»: {c['row']}")
        page.evaluate(_ALL_DONE)
        C.goto(page, "", reload=True)
        c = page.evaluate(_CARD)
        if c["kind"] != "juego" or c["t"] != "Juega una partida" or c["href"] != "#/juegos":
            probs.append(f"con todo el camino hecho la tarjeta es {c}")
        _fits(page, "todo hecho", probs)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_review_row_starts_review():
    """«Repasar N» lleva a #/repaso y empieza el repaso directamente (modo foco). Volver a Hoy sin cerrarlo deja la
    tarjeta en «Seguir»; el ✕ del modo foco lo cierra."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        page.evaluate(_FEW)
        C.goto(page, "", reload=True)
        n0 = page.evaluate("window.__vocabRouteN || 0")
        page.locator("#hm-rev").click()
        page.wait_for_function("n => (window.__vocabRouteN || 0) > n", arg=n0, timeout=8000)
        page.wait_for_function("() => document.documentElement.dataset.focus === 'repaso'", timeout=5000)
        if C.current_hash(page) != "repaso":
            probs.append(f"«Repasar» lleva a #/{C.current_hash(page)}")
        # con la tarjeta del repaso (12 pendientes), «Empezar» también entra directo
        page.context.close()
        page = C.new_page("phone")
        C.seed(page)
        page.locator("#hm-go").click()
        page.wait_for_function("() => document.documentElement.dataset.focus === 'repaso'", timeout=8000)
        C.goto(page, "#/")
        c = page.evaluate(_CARD)
        if c["kind"] != "repaso" or c["btn"] != "Seguir" or "quedan" not in (c["sub"] or ""):
            probs.append(f"con el repaso abierto la tarjeta dice {c}")
        a = page.evaluate(_ACC)
        if a["shown"]:
            probs.append(f"en Hoy sale el accesorio aunque la tarjeta ya ofrece el repaso: {a}")
        C.goto(page, "#/mapa")
        a = page.evaluate(_ACC)
        if not a["shown"] or a["t"] != "Seguir · Repaso" or a["href"] != "#/repaso":
            probs.append(f"fuera de Hoy, con el repaso abierto, el accesorio es {a}")
        # el accesorio sigue el repaso donde estaba; la ✕ del modo foco lo cierra
        n0 = page.evaluate("window.__vocabRouteN || 0")
        page.locator("#acc").click()
        page.wait_for_function("n => (window.__vocabRouteN || 0) > n", arg=n0, timeout=8000)
        if page.evaluate("document.documentElement.dataset.focus || ''") != "repaso":
            probs.append("el accesorio no vuelve al repaso empezado")
        n0 = page.evaluate("window.__vocabRouteN || 0")
        page.locator("#fx-x").click()
        page.wait_for_function("n => (window.__vocabRouteN || 0) > n", arg=n0, timeout=8000)
        C.goto(page, "#/")
        c = page.evaluate(_CARD)
        if c["btn"] != "Empezar" or page.evaluate(_ACC)["shown"] or page.evaluate("vocabAccessory.state") is not None:
            probs.append(f"tras la ✕ el repaso sigue abierto: botón {c['btn']!r}, accesorio {page.evaluate(_ACC)}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- las dos piezas
def test_missions_sheet_opens_and_closes():
    """La pieza de Misiones dice la siguiente misión y tiene 3 puntos; al tocarla abre una hoja con las 3 misiones y el
    cofre, que se cierra con «Listo» y con Escape (y el foco vuelve a la pieza)."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        p = page.evaluate("""() => { const b = document.getElementById('bd-mis');
          return {t: b.textContent, dots: b.querySelectorAll('.bd-dots i').length, popup: b.getAttribute('aria-haspopup')}; }""")
        if "Misiones" not in p["t"] or p["dots"] != 3 or p["popup"] != "dialog":
            probs.append(f"la pieza de Misiones es {p}")
        for how in ("listo", "escape"):
            page.locator("#bd-mis").click()
            page.wait_for_selector("#bd-mis-s[open]", timeout=3000)
            s = page.evaluate("""() => { const d = document.getElementById('bd-mis-s');
              return {rows: d.querySelectorAll('.bd-row[data-k]').length, chest: d.querySelectorAll('.bd-chest').length, t: d.querySelector('h2').textContent,
                modal: d.matches(':modal')}; }""")
            if s["rows"] != 3 or s["chest"] != 1 or s["t"] != "Misiones de hoy" or not s["modal"]:
                probs.append(f"la hoja de misiones es {s}")
            page.wait_for_timeout(450)
            if how == "listo":
                page.locator("#bd-mis-s [data-close]").click()
            else:
                page.keyboard.press("Escape")
            try:
                page.wait_for_function("() => !document.getElementById('bd-mis-s').open", timeout=3000)
            except Exception:
                probs.append(f"la hoja no se cierra con {how}")
            page.wait_for_timeout(300)
            if page.evaluate("document.activeElement && document.activeElement.id") != "bd-mis":
                probs.append(f"tras cerrar con {how} el foco no vuelve a la pieza")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_word_of_day_flips_and_speaks():
    """La Palabra del día enseña el dibujo y la palabra; al tocarla gira (la cara de atrás con la palabra en español) y
    suena; al tocar otra vez vuelve. Con «Reducir movimiento» cambia sin girar."""
    probs = []
    for rm in ("no-preference", "reduce"):
        page = C.new_page("phone", reduced_motion=rm)
        try:
            C.seed(page)
            page.evaluate("() => { window.__said = []; window.say = t => { window.__said.push(t); }; }")
            f = page.evaluate("""() => { const w = document.getElementById('bd-wotd');
              return {img: !!w.querySelector('.bd-wfront img'), word: w.querySelector('.bd-ww').textContent, es: w.dataset.es}; }""")
            if not f["img"] or not f["word"]:
                probs.append(f"{rm}: la palabra del día no tiene dibujo y palabra: {f}")
            page.locator("#bd-wotd .bd-wfront").click()
            page.wait_for_timeout(600)
            st = page.evaluate("""() => { const w = document.getElementById('bd-wotd'), fl = w.querySelector('.bd-flip'), bk = w.querySelector('.bd-wback');
              return {back: fl.classList.contains('back'), inertFront: w.querySelector('.bd-wfront').inert, inertBack: bk.inert,
                es: w.querySelector('.bd-wes').textContent, tr: getComputedStyle(fl).transform, said: window.__said.slice()}; }""")
            if not st["back"] or not st["inertFront"] or st["inertBack"] or st["es"] != f["es"]:
                probs.append(f"{rm}: la palabra del día no gira: {st}")
            if st["said"] != [f["word"]]:
                probs.append(f"{rm}: al girar no suena la palabra: {st['said']}")
            if rm == "reduce" and st["tr"] not in ("none", "matrix(1, 0, 0, 1, 0, 0)"):
                probs.append(f"con «Reducir movimiento» la tarjeta gira: {st['tr']}")
            page.locator("#bd-wotd .bd-wtap").click()
            page.wait_for_timeout(600)
            back = page.evaluate("document.querySelector('#bd-wotd .bd-flip').classList.contains('back')")
            if back:
                probs.append(f"{rm}: al tocar otra vez no vuelve")
            probs += [f"{rm}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_privacy_link():
    """Al final de Hoy, «Privacidad» (13 px) lleva a privacy.html."""
    page = C.new_page("phone")
    try:
        C.seed(page)
        p = page.evaluate("""() => { const a = document.querySelector('.hm-priv a'); const r = a.getBoundingClientRect();
          return {href: a.getAttribute('href'), t: a.textContent, fs: getComputedStyle(a).fontSize, h: r.height, vis: r.bottom <= innerHeight}; }""")
        errs = C.errors(page)
    finally:
        page.context.close()
    assert p["href"] == "privacy.html" and p["t"] == "Privacidad" and p["fs"] == "13px" and p["h"] >= 44 and p["vis"], f"Privacidad: {p}"
    assert not errs, "\n".join(errs)


# ---------------------------------------------------------------- monedas y reclamos
def test_award_bumps_coin_pill():
    """En Hoy, award() hace volar las monedas a la pastilla de arriba: salta (.m-bump) y sube el número. Recoger una
    misión en la hoja paga 15 y el zorro da un saltito."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        page.evaluate("""() => { window.__bump = 0; const p = document.querySelector('[data-coins-pill]');
          new MutationObserver(() => { if (p.classList.contains('m-bump')) window.__bump++; }).observe(p, {attributes: true, attributeFilter: ['class']}); }""")
        c0 = page.evaluate("game().coins")
        page.evaluate("award(5, '¡Prueba!', false, document.getElementById('hm-go'))")
        page.wait_for_timeout(1800)
        st = page.evaluate("({coins: document.getElementById('coins').textContent, bump: window.__bump})")
        if st["coins"] != str(c0 + 5) or not st["bump"]:
            probs.append(f"award(5) en Hoy: {st} (antes {c0})")
        page.locator("#bd-mis").click()
        page.wait_for_selector("#bd-mis-s[open] [data-get]", timeout=3000)
        page.wait_for_timeout(450)
        page.locator("#bd-mis-s [data-get]").first.click()
        page.wait_for_timeout(1800)
        st = page.evaluate("({coins: +document.getElementById('coins').textContent, got: !!document.querySelector('#bd-mis-s .bd-row.got')})")
        if st["coins"] != c0 + 20 or not st["got"]:
            probs.append(f"recoger la misión: {st} (esperaba {c0 + 20} monedas y la fila conseguida)")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_single_attention_and_reduced_motion():
    """Al entrar, un solo reclamo: el zorro saluda una vez (animación de 1 vuelta). Si hay una misión cumplida que aún
    no ha visto, en su lugar salta la pieza de Misiones (una vez); y salta también si se cumple una estando en Hoy. Con
    «Reducir movimiento» no se mueve nada."""
    probs = []
    watch = """(() => { window.__bnc = 0; addEventListener('animationstart', e => {
      if (e.target.id === 'bd-mis' && e.animationName === 'bd-bounce') window.__bnc++; }, true); })()"""
    fox = """() => { const f = document.getElementById('hm-fox'), cs = getComputedStyle(f);
      return {wave: f.classList.contains('wave'), name: cs.animationName, it: cs.animationIterationCount, bnc: window.__bnc}; }"""
    for rm in ("no-preference", "reduce"):
        page = C.new_page("phone", reduced_motion=rm)
        try:
            page.add_init_script(watch)
            C.seed(page)
            st = page.evaluate(fox)
            if rm == "reduce":
                if st["wave"] or st["name"] != "none" or st["bnc"]:
                    probs.append(f"con «Reducir movimiento» algo se mueve al entrar: {st}")
            elif not st["wave"] or st["it"] != "1" or st["name"] == "none" or st["bnc"]:
                probs.append(f"al entrar, el zorro no saluda una sola vez (y nada más): {st}")
            # la misión del repaso a punto: se cumple estando en Hoy
            page.evaluate("""() => { const k = 'buddy:missions', M = JSON.parse(localStorage.getItem(k)), m = M.list.find(x => x.k === 'rev');
              m.n = m.goal - 1; localStorage.setItem(k, JSON.stringify(M)); window.__bnc = 0; }""")
            page.evaluate("bus.emit('review-card', {ok: true})")
            page.wait_for_timeout(300)
            b = page.evaluate("({n: window.__bnc, t: document.getElementById('bd-mis').textContent})")
            if b["n"] != (0 if rm == "reduce" else 1):
                probs.append(f"{rm}: al cumplir una misión en Hoy la pieza salta {b['n']} veces")
            if "Recoge" not in b["t"]:
                probs.append(f"{rm}: la pieza no avisa de recoger el premio: {b['t']!r}")
            probs += [f"{rm}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
        # entrar con una misión cumplida que aún no ha visto en la hoja: salta la pieza y el zorro no saluda
        page = C.new_page("phone", reduced_motion=rm)
        try:
            page.add_init_script(watch)
            keys = C.seed_keys()
            M = json.loads(keys["buddy:missions"])
            next(m for m in M["list"] if m["k"] == "feed")["s"] = 2
            keys["buddy:missions"] = json.dumps(M, separators=(",", ":"), ensure_ascii=False)
            C.seed(page, keys)
            page.wait_for_timeout(300)
            st = page.evaluate(fox)
            want = 0 if rm == "reduce" else 1
            if st["bnc"] != want or st["wave"]:
                probs.append(f"{rm}: al entrar con una misión recién cumplida: pieza {st['bnc']} saltos ({want}), zorro {st}")
            C.goto(page, "#/mapa")
            C.goto(page, "#/")
            if page.evaluate("window.__bnc") != want:
                probs.append(f"{rm}: la pieza vuelve a saltar al volver a Hoy")
            probs += [f"{rm}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- accesorio «Seguir»
def test_accessory_follow():
    """Con una lección guardada a medias (sessionStorage 'vocab:ls') sale «Seguir · Lección N» con su anillo, sobre la
    barra de pestañas; al tocarlo lleva a la lección. Sin nada empezado no sale. Si la tarjeta de Hoy ya ofrece esa
    lección, en Hoy no sale (y la tarjeta dice «Seguir»)."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        a = page.evaluate(_ACC)
        if a["shown"]:
            probs.append(f"sin nada empezado sale el accesorio: {a}")
        C.goto(page, "#/mapa")
        if page.evaluate(_ACC)["shown"]:
            probs.append("sin nada empezado sale el accesorio en el camino")
        page.evaluate("sessionStorage.setItem('vocab:ls', JSON.stringify({id: 'A1-004', i: 8, first: [], miss: []}))")
        page.evaluate("vocabAccessory.refresh()")
        page.wait_for_timeout(150)
        a = page.evaluate(_ACC)
        if not a["shown"] or a["t"] != "Seguir · Lección 4" or a["href"] != "#/leccion/A1-004" or not a["glass"] or not a["acc"]:
            probs.append(f"con 'vocab:ls' el accesorio es {a}")
        if a.get("dash", "").split(" ")[0] in ("", "0", "0.0"):
            probs.append(f"el anillo no enseña el avance: {a.get('dash')}")
        pos = page.evaluate("""() => ({a: document.getElementById('acc').getBoundingClientRect().bottom,
          bar: document.getElementById('tabbar').getBoundingClientRect().top})""")
        if pos["a"] > pos["bar"]:
            probs.append(f"el accesorio no queda sobre la barra de pestañas: {pos}")
        C.goto(page, "#/")
        if not page.evaluate(_ACC)["shown"]:
            probs.append("en Hoy no sale el accesorio de otra lección")
        n0 = page.evaluate("window.__vocabRouteN || 0")
        page.locator("#acc").click()
        page.wait_for_function("n => (window.__vocabRouteN || 0) > n", arg=n0, timeout=8000)
        if C.current_hash(page) != "leccion/A1-004":
            probs.append(f"el accesorio lleva a #/{C.current_hash(page)}")
        if page.evaluate(_ACC)["shown"]:
            probs.append("en la lección (modo foco) sigue el accesorio")
        # la misma lección que ofrece la tarjeta: en Hoy no se repite
        page.evaluate("sessionStorage.setItem('vocab:ls', JSON.stringify({id: 'A1-010', i: 3, first: [], miss: []}))")
        page.evaluate(_FEW)
        C.goto(page, "#/", reload=True)
        c = page.evaluate(_CARD)
        a = page.evaluate(_ACC)
        if c["btn"] != "Seguir" or a["shown"]:
            probs.append(f"la lección de la tarjeta empezada: botón {c['btn']!r}, accesorio {a}")
        C.goto(page, "#/palabras")
        a = page.evaluate(_ACC)
        if not a["shown"] or a["t"] != "Seguir · Lección 11":
            probs.append(f"fuera de Hoy, la lección de la tarjeta empezada: {a}")
        page.evaluate("sessionStorage.removeItem('vocab:ls'); vocabAccessory.refresh()")
        page.wait_for_timeout(150)
        if page.evaluate(_ACC)["shown"]:
            probs.append("al borrar 'vocab:ls' el accesorio no se va")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la partida no cambia
def test_hoy_export_matches_baseline():
    """Abrir Hoy, abrir y cerrar la hoja de Misiones y volver no cambia la partida exportada: es la de
    tests/e2e/baseline/export.json (salvo claves nuevas registradas)."""
    base = C.load_baseline()
    assert base, f"falta {C.BASELINE}"
    page = C.new_page("phone")
    try:
        C.seed(page)
        a = C.export(page)
        page.locator("#bd-mis").click()
        page.wait_for_selector("#bd-mis-s[open]", timeout=3000)
        page.wait_for_timeout(450)
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        C.goto(page, "#/mapa")
        C.goto(page, "#/")
        b = C.export(page)
        errs = C.errors(page)
    finally:
        page.context.close()
    d = C.diff_exports(base, a) + C.diff_exports(base, b)
    assert not d, "la partida exportada desde Hoy no es la de antes:\n  " + "\n  ".join(d)
    assert not errs, "\n".join(errs)
