"""F5b: el teclado en toda la app (js/keys.js) y los atajos de la app instalada (manifest «shortcuts»).

Una sola escucha de keydown en window (fase de burbuja: las pantallas que ya tienen sus teclas van antes) pulsa el
elemento visible y activo con data-key de la capa de arriba (la hoja abierta; si no, la pantalla). Espacio = oír,
Mayús+Espacio = despacio, Enter = el botón principal, ← → = anterior/siguiente (en el repaso «No» y «¡Sí!»), 1-4 =
opción, Esc = atrás o cerrar (en un juego, la pausa del juego), ? = la hoja «Teclas». Nada si se escribe en un campo, si
alguien ya se quedó la tecla (preventDefault) o si es la activación nativa (Enter en un botón enfocado). La primera
tecla pone html[data-kbd] y cada botón con data-key enseña su tecla en gris; el primer toque las quita.
El manifest trae 4 atajos (Repasar, Seguir el camino, Juegos, Mi granja) con iconos 96×96 que abren su pantalla."""
from __future__ import annotations

import json
import struct

import common as C
import routes as R

LESSON = R.LESSON

# espías: sonidos (audio grabado y voz del navegador, con su velocidad), clics en lo que tiene data-key (los de
# keys.js no son de confianza), avisos de respuesta y del repaso, y aperturas de hojas
_SPY = """() => {
  if (window.__k) return;
  const K = window.__k = {snd: [], clk: [], ans: [], cards: [], modal: []};
  const P = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { K.snd.push({kind: 'clip', rate: this.playbackRate}); return P.apply(this, arguments); };
  if (window.speechSynthesis) { const S = speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak = u => { K.snd.push({kind: 'tts', rate: u.rate}); return S(u); }; }
  document.addEventListener('click', e => { const el = e.target.closest ? e.target.closest('[data-key]') : null;
    K.clk.push({id: el ? (el.id || el.className) : (e.target.id || e.target.tagName), key: el ? el.dataset.key : null, trusted: e.isTrusted}); }, true);
  bus.on('answer', d => K.ans.push(!!d.ok));
  bus.on('review-card', d => K.cards.push(d.grade));
  const SM = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () { K.modal.push(this.id); return SM.apply(this, arguments); };
}"""
_RESET = "() => { const K = window.__k; K.snd.length = 0; K.clk.length = 0; K.ans.length = 0; K.cards.length = 0; K.modal.length = 0; }"
_K = "() => JSON.parse(JSON.stringify(window.__k))"
_LS = """() => { const s = window.vocabLesson && vocabLesson.state; if (!s) return null; const st = s.steps[s.i];
  return {i: s.i, ended: s.ended, saved: s.saved, t: st ? st.t : null, done: !!(st && st.done),
    right: st ? (st.right != null ? st.right : (st.q ? st.q.o[st.q.a] : null)) : null}; }"""
_OPTS = "() => [...document.querySelectorAll('.ls-stage > .ls-page:not(.ls-ghost) .ls-opt .ls-ot')].map(e => e.textContent)"
_TAGS = """() => [...document.querySelectorAll('.kb-tag')].filter(t => t.getClientRects().length)
  .map(t => ({k: t.dataset.k, host: t.parentElement.id || t.parentElement.className.split(' ')[0]}))"""
_KBD = "() => document.documentElement.hasAttribute('data-kbd')"
_BLUR = "() => { const a = document.activeElement; if (a && a !== document.body) a.blur(); }"


def _lesson(page):
    C.seed(page)
    C.goto(page, "#/mapa")
    C.goto(page, "#/leccion/" + LESSON)
    page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-page')", timeout=8000)
    page.evaluate(_SPY)
    page.wait_for_timeout(1200)          # deja sonar la palabra nueva de entrada


def _first(snd):
    return snd[0] if snd else None


# ---------------------------------------------------------------- la lección
def test_lesson_keys():
    """En la lección: Espacio suena (una vez), Mayús+Espacio suena más despacio, Enter pasa UNA sola vez (con el foco
    en la página y con el foco en «Continuar», donde va la activación nativa), 1-4 eligen la opción N (un solo aviso
    de respuesta), Enter sigue tras fallar y Esc abre «¿Paramos aquí?» (y Esc lo cierra sin salir). keys.js no pulsa
    nada por su cuenta: la lección se queda sus teclas (data-key-own)."""
    page = C.new_page("phone")
    probs = []
    try:
        _lesson(page)
        st = page.evaluate(_LS)
        assert st and st["t"] == "learn", f"la lección no empieza con una palabra nueva: {st}"
        page.evaluate(_BLUR)
        page.evaluate(_RESET)
        page.keyboard.press("Space")
        page.wait_for_timeout(400)
        k = page.evaluate(_K)
        n1 = _first(k["snd"])
        if not n1 or len([x for x in k["snd"] if x["kind"] == n1["kind"]]) != 1:
            probs.append(f"Espacio no suena una sola vez: {k['snd']}")
        page.wait_for_timeout(1500)
        page.evaluate(_RESET)
        page.keyboard.press("Shift+Space")
        page.wait_for_timeout(400)
        k = page.evaluate(_K)
        s1 = _first(k["snd"])
        if not s1 or not n1 or s1["kind"] != n1["kind"] or not s1["rate"] < n1["rate"]:
            probs.append(f"Mayús+Espacio no suena más despacio: normal {n1} · despacio {s1}")
        if [c for c in k["clk"] if not c["trusted"]]:
            probs.append(f"keys.js pulsa algo en la lección (las teclas son suyas): {k['clk']}")
        page.wait_for_timeout(1500)
        # Enter con el foco en «Continuar»: la activación nativa, una vez
        page.evaluate(_RESET)
        i0 = page.evaluate(_LS)["i"]
        page.focus("#ls-go")
        page.keyboard.press("Enter")
        page.wait_for_timeout(1500)
        k, st = page.evaluate(_K), page.evaluate(_LS)
        gos = [c for c in k["clk"] if c["id"] == "ls-go"]
        if st["i"] != i0 + 1 or len(gos) != 1:
            probs.append(f"Enter en «Continuar» enfocado: paso {i0} → {st['i']}, clics {gos}")
        # Enter con el foco en la página, en cada palabra nueva hasta la primera pregunta: una vez cada vez
        for _ in range(12):
            st = page.evaluate(_LS)
            if st["t"] != "learn":
                break
            page.evaluate(_BLUR)
            page.evaluate(_RESET)
            page.keyboard.press("Enter")
            page.wait_for_timeout(1500)
            k, st2 = page.evaluate(_K), page.evaluate(_LS)
            gos = [c for c in k["clk"] if c["id"] == "ls-go"]
            if st2["i"] != st["i"] + 1 or len(gos) != 1:
                probs.append(f"Enter avanza más de una vez (o ninguna): paso {st['i']} → {st2['i']}, clics {gos}")
                break
        st = page.evaluate(_LS)
        assert st["t"] != "learn" and not st["done"], f"no llega a una pregunta: {st}"
        page.wait_for_timeout(600)
        # 1-4: una opción mal, por su número
        opts = page.evaluate(_OPTS)
        wrong = next(i for i, o in enumerate(opts) if o != st["right"])
        page.evaluate(_RESET)
        page.keyboard.press(str(wrong + 1))
        page.wait_for_function("() => { const g = document.getElementById('ls-go'); return g && !g.hidden; }", timeout=4000)
        page.wait_for_timeout(300)
        k = page.evaluate(_K)
        picked = page.evaluate("""() => [...document.querySelectorAll('.ls-stage > .ls-page:not(.ls-ghost) .ls-opt')]
          .map((b, i) => b.classList.contains('is-miss') ? i : -1).filter(i => i >= 0)""")
        if k["ans"] != [False]:
            probs.append(f"la tecla {wrong + 1} no responde una sola vez (mal): avisos {k['ans']}")
        if picked != [wrong]:
            probs.append(f"la tecla {wrong + 1} elige las opciones {[i + 1 for i in picked]}")
        # Enter: «Seguir», una vez
        i0 = page.evaluate(_LS)["i"]
        page.evaluate(_BLUR)
        page.evaluate(_RESET)
        page.keyboard.press("Enter")
        page.wait_for_timeout(1500)
        k, st = page.evaluate(_K), page.evaluate(_LS)
        if st["i"] != i0 + 1 or len([c for c in k["clk"] if c["id"] == "ls-go"]) != 1:
            probs.append(f"Enter tras fallar: paso {i0} → {st['i']}, clics {k['clk']}")
        # la siguiente pregunta, bien, por su número
        for _ in range(8):
            st = page.evaluate(_LS)
            if st["t"] != "learn":
                break
            page.evaluate(_BLUR)
            page.keyboard.press("Enter")
            page.wait_for_timeout(1300)
        st = page.evaluate(_LS)
        if st["t"] != "learn" and not st["done"]:
            opts = page.evaluate(_OPTS)
            page.evaluate(_RESET)
            page.keyboard.press(str(opts.index(st["right"]) + 1))
            page.wait_for_timeout(400)
            if page.evaluate(_K)["ans"] != [True]:
                probs.append(f"la tecla de la buena no responde una sola vez: {page.evaluate(_K)['ans']}")
            page.wait_for_timeout(2500)
        # Esc: «¿Paramos aquí?»
        page.evaluate(_RESET)
        page.keyboard.press("Escape")
        try:
            page.wait_for_selector("dialog#ls-pause[open]", timeout=3000)
            t = page.evaluate("() => document.getElementById('ls-pz-t').textContent")
            if t != "¿Paramos aquí?":
                probs.append(f"Esc abre otra hoja: {t!r}")
        except Exception:  # noqa: BLE001
            probs.append(f"Esc no abre «¿Paramos aquí?» (hash {page.evaluate('location.hash')})")
        if page.evaluate(_K)["modal"].count("ls-pause") > 1:
            probs.append(f"Esc abre la pausa más de una vez: {page.evaluate(_K)['modal']}")
        page.keyboard.press("Escape")
        page.wait_for_timeout(600)
        if page.evaluate("() => document.getElementById('ls-pause').open") or C.current_hash(page) != "leccion/" + LESSON:
            probs.append(f"Esc con la pausa abierta no vuelve a la lección: #/{C.current_hash(page)}")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- el repaso
def test_review_arrows_are_no_and_yes():
    """En el repaso: Espacio gira la tarjeta, ← es «No» (nota 0) y → es «¡Sí!» (nota ≥ 1), una vez cada una: el repaso
    se queda sus teclas y keys.js no pulsa «No» ni «¡Sí!» además. Mayús+Espacio suena despacio."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/repaso")
        page.wait_for_selector("#rv-card", timeout=8000)
        page.evaluate(_SPY)
        page.wait_for_timeout(600)
        for key, want in (("ArrowLeft", "no"), ("ArrowRight", "yes")):
            st = page.wait_for_function("() => { const s = vocabReview.state; return s && !s.flip && !s.end ? s : null; }", timeout=6000).json_value()
            page.evaluate(_BLUR)
            page.evaluate(_RESET)
            page.keyboard.press("Space")
            try:
                page.wait_for_function("() => vocabReview.state.flip", timeout=3000)
            except Exception:  # noqa: BLE001
                probs.append(f"Espacio no gira la tarjeta {st['word']}")
                break
            page.wait_for_timeout(500)
            if want == "no":
                page.evaluate(_RESET)
                page.keyboard.press("Shift+Space")
                page.wait_for_timeout(300)
                k = page.evaluate(_K)
                if not k["snd"]:
                    probs.append("Mayús+Espacio no suena en el repaso")
                page.wait_for_timeout(600)
            page.evaluate(_RESET)
            page.keyboard.press(key)
            try:
                page.wait_for_function("i0 => { const s = vocabReview.state; return !!s && (s.i > i0 || s.end); }", arg=st["i"], timeout=6000)
            except Exception:  # noqa: BLE001
                probs.append(f"{key} no pasa la tarjeta {st['word']}")
                break
            page.wait_for_timeout(500)
            k = page.evaluate(_K)
            ok = k["cards"] == [0] if want == "no" else (len(k["cards"]) == 1 and k["cards"][0] >= 1)
            if not ok:
                probs.append(f"{key} (= «{'No' if want == 'no' else '¡Sí!'}») da las notas {k['cards']}")
            if [c for c in k["clk"] if not c["trusted"]]:
                probs.append(f"keys.js pulsa además en el repaso: {k['clk']}")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Hoy y la hoja «Teclas»
def test_hoy_enter_and_keys_sheet():
    """En Hoy, Enter es «Empezar» (lleva a su enlace, una vez). ? abre la hoja «Teclas» (modal, con sus 7 teclas y
    «Listo») y Esc la cierra sin moverse de Hoy; ? otra vez también la cierra. La partida exportada no cambia."""
    page = C.new_page("phone")
    probs = []
    base = C.load_baseline()
    try:
        C.seed(page)
        page.wait_for_selector("#hm-go", timeout=6000)
        page.evaluate(_SPY)
        page.keyboard.press("?")
        try:
            page.wait_for_selector("dialog#kb-help[open]", timeout=3000)
            page.wait_for_timeout(450)
            st = page.evaluate("""() => { const d = document.getElementById('kb-help');
              return {modal: d.matches(':modal'), title: document.getElementById(d.getAttribute('aria-labelledby')).textContent,
                rows: d.querySelectorAll('.kb-row').length, done: (d.querySelector('.m-head-x') || {}).textContent,
                keys: [...d.querySelectorAll('.kb-keys')].map(k => k.textContent.replace(/\\s+/g, ' ').trim())}; }""")
            if not st["modal"] or st["title"] != "Teclas" or st["rows"] != 7 or (st["done"] or "").strip() != "Listo":
                probs.append(f"hoja «Teclas»: {st}")
            if not any("Espacio" in k for k in st["keys"]) or not any("Esc" == k for k in st["keys"]):
                probs.append(f"la hoja no enseña las teclas: {st['keys']}")
        except Exception:  # noqa: BLE001
            probs.append("? no abre la hoja «Teclas»")
        page.keyboard.press("Escape")
        try:
            page.wait_for_function("() => !document.getElementById('kb-help').open", timeout=3000)
        except Exception:  # noqa: BLE001
            probs.append("Esc no cierra la hoja «Teclas»")
        page.wait_for_timeout(400)
        if C.current_hash(page) != "":
            probs.append(f"Esc con la hoja abierta sale de Hoy: #/{C.current_hash(page)}")
        page.keyboard.press("?")
        page.wait_for_selector("dialog#kb-help[open]", timeout=3000)
        page.wait_for_timeout(450)
        page.keyboard.press("?")
        try:
            page.wait_for_function("() => !document.getElementById('kb-help').open", timeout=3000)
        except Exception:  # noqa: BLE001
            probs.append("? con la hoja abierta no la cierra")
        page.wait_for_timeout(400)
        if base:
            d = [x for x in C.diff_exports(base, C.export(page), allow_new=True) if not x.startswith("cambia 'album:uniq:")]
            if d:
                probs.append("la partida cambia con las teclas:\n  " + "\n  ".join(d))
        # Enter = «Empezar»
        href = page.evaluate("() => document.getElementById('hm-go').getAttribute('href')")
        page.evaluate(_BLUR)
        page.evaluate(_RESET)
        n0 = page.evaluate("window.__vocabRouteN || 0")
        page.keyboard.press("Enter")
        try:
            page.wait_for_function("h => location.hash === h", arg=href, timeout=5000)
        except Exception:  # noqa: BLE001
            probs.append(f"Enter en Hoy no lleva a «Empezar» ({href}): {page.evaluate('location.hash')}")
        page.wait_for_timeout(800)
        k = page.evaluate(_K)
        hits = [c for c in k["clk"] if c["id"] == "hm-go"]
        if len(hits) != 1 or page.evaluate("window.__vocabRouteN || 0") - n0 != 1:
            probs.append(f"Enter en Hoy: clics {hits}, cambios de pantalla {page.evaluate('window.__vocabRouteN || 0') - n0}")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Tarjetas
def test_cards_space_flips_and_arrows_move_once():
    """En Tarjetas: Espacio gira la tarjeta (una vez: no vuelve a la cara de delante), Espacio con la tarjeta girada
    la oye (no la vuelve a girar), → pasa a la siguiente una vez y Enter («Siguiente») también una vez."""
    page = C.new_page("phone")
    probs = []
    n = "() => document.querySelector('.fcx-n').textContent"
    back = "() => document.getElementById('card').classList.contains('is-back')"
    # cada vez que se pinta la tarjeta (girarla la vuelve a pintar): cuántas caras de detrás salen
    count = """() => { window.__backs = 0; new MutationObserver(ms => { for (const m of ms) for (const el of m.addedNodes)
      if (el.nodeType === 1 && el.querySelector && (el.matches('#card.is-back') || el.querySelector('#card.is-back'))) window.__backs++; })
      .observe(document.getElementById('view'), {childList: true, subtree: true}); }"""
    try:
        C.seed(page)
        C.goto(page, f"#/doc/{R.TOPIC}")
        page.locator("#dv-tab-tarjetas").click()
        page.wait_for_selector("#card", timeout=4000)
        page.evaluate(_SPY)
        page.evaluate(count)
        page.wait_for_timeout(400)
        page.evaluate(_BLUR)
        page.evaluate(_RESET)
        page.keyboard.press("Space")
        page.wait_for_timeout(500)
        if not page.evaluate(back) or page.evaluate("window.__backs") != 1:
            probs.append(f"Espacio no gira la tarjeta una vez: detrás {page.evaluate(back)}, giros {page.evaluate('window.__backs')}")
        page.wait_for_timeout(900)
        page.evaluate(_RESET)
        page.keyboard.press("Space")
        page.wait_for_timeout(400)
        k = page.evaluate(_K)
        if not page.evaluate(back) or page.evaluate("window.__backs") != 1 or not k["snd"]:
            probs.append(f"Espacio con la tarjeta girada no la oye: detrás {page.evaluate(back)}, sonidos {k['snd']}")
        a = page.evaluate(n)
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(500)
        b = page.evaluate(n)
        if int(b.split("/")[0]) != int(a.split("/")[0]) + 1:
            probs.append(f"→ no pasa una sola tarjeta: {a} → {b}")
        page.evaluate(_BLUR)
        page.keyboard.press("Enter")
        page.wait_for_timeout(500)
        c = page.evaluate(n)
        if int(c.split("/")[0]) != int(b.split("/")[0]) + 1:
            probs.append(f"Enter no pasa una sola tarjeta: {b} → {c}")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- escribir en un campo
def test_typing_in_a_field_triggers_nothing():
    """Escribiendo en un campo (el buscador de un tema y el nombre en Ajustes) Espacio, Enter, 1-4, ?, flechas y Esc
    son del campo: no se abre la hoja «Teclas», no salen las etiquetas, keys.js no pulsa nada y no se cambia de
    pantalla."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, f"#/doc/{R.TOPIC}")
        page.locator("#dv-tab-lista").click()
        page.wait_for_selector("#q", timeout=4000)
        page.evaluate(_SPY)
        fields = [("buscador", "#q"), ("nombre", "#aj-name")]
        for name, sel in fields:
            if sel == "#aj-name":
                page.evaluate("() => openSettings()")
                page.wait_for_selector("#aj-name", state="visible", timeout=5000)
                page.wait_for_timeout(500)
            page.locator(sel).click()
            page.evaluate(_RESET)
            page.locator(sel).fill("")
            page.keyboard.type("ab 1?")
            for key in ("Space", "1", "4", "?", "ArrowLeft", "ArrowRight", "Shift+Space", "Enter"):
                page.keyboard.press(key)
            page.wait_for_timeout(400)
            k = page.evaluate(_K)
            st = page.evaluate("""() => ({help: !!document.querySelector('#kb-help[open]'), kbd: document.documentElement.hasAttribute('data-kbd'),
              tags: document.querySelectorAll('.kb-tag').length, hash: location.hash})""")
            if st["help"] or st["kbd"] or st["tags"]:
                probs.append(f"escribiendo en el {name}, keys.js actúa: {st}")
            if [c for c in k["clk"] if not c["trusted"]]:
                probs.append(f"escribiendo en el {name}, keys.js pulsa: {k['clk']}")
            if st["hash"] != f"#/doc/{R.TOPIC}":
                probs.append(f"escribiendo en el {name}, cambia la pantalla: {st['hash']}")
            if sel == "#q":
                v = page.locator(sel).input_value()
                if not v.startswith("ab 1?"):
                    probs.append(f"el buscador no recibe lo escrito: {v!r}")
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)
                if C.current_hash(page) != f"doc/{R.TOPIC}":
                    probs.append(f"Esc en el buscador sale del tema: #/{C.current_hash(page)}")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- en un juego
def test_game_keys_are_the_games_and_esc_pauses_once():
    """En un juego (Letras locas): Enter en la portada es «¡A jugar!»; jugando, las teclas son del juego (una letra
    pone su ficha) y keys.js no pulsa nada con Espacio, Enter, 1-4 ni flechas; Esc abre la pausa una sola vez y Esc la
    cierra y sigue la partida sin salir del juego."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/juegos/letras")
        page.wait_for_selector(".gm-go", timeout=6000)
        page.evaluate(_SPY)
        page.wait_for_timeout(400)
        page.evaluate(_BLUR)
        page.keyboard.press("Enter")
        try:
            page.wait_for_function("() => document.documentElement.hasAttribute('data-gm-play') && document.querySelector('.gm-tile:not(.used)')", timeout=5000)
        except Exception:  # noqa: BLE001
            probs.append("Enter en la portada no empieza la partida")
            raise AssertionError("\n".join(probs))
        page.wait_for_timeout(400)
        page.evaluate(_RESET)
        ch = page.evaluate("document.querySelector('.gm-tile:not(.used)').textContent")
        page.keyboard.type(ch)
        page.wait_for_timeout(250)
        if not page.locator(".gm-slot.fill").count():
            probs.append(f"la letra {ch!r} no pone su ficha (las teclas no son del juego)")
        for key in ("1", "2", "ArrowLeft", "ArrowRight", "Space", "Shift+Space"):
            page.keyboard.press(key)
        page.wait_for_timeout(300)
        k = page.evaluate(_K)
        if [c for c in k["clk"] if not c["trusted"]]:
            probs.append(f"jugando, keys.js pulsa: {k['clk']}")
        if page.evaluate("() => !!document.querySelector('#kb-help[open]')"):
            probs.append("jugando se abre la hoja «Teclas»")
        page.evaluate(_RESET)
        page.keyboard.press("Escape")
        try:
            page.wait_for_selector("dialog#gm-pause[open]", timeout=3000)
        except Exception:  # noqa: BLE001
            probs.append("Esc no abre la pausa del juego")
        page.wait_for_timeout(400)
        k = page.evaluate(_K)
        if k["modal"] != ["gm-pause"] or [c for c in k["clk"] if not c["trusted"]]:
            probs.append(f"Esc: hojas {k['modal']}, clics {k['clk']}")
        page.keyboard.press("Escape")
        try:
            page.wait_for_function("() => !document.getElementById('gm-pause').open && !vocabGames.paused", timeout=3000)
        except Exception:  # noqa: BLE001
            probs.append("Esc con la pausa abierta no sigue la partida")
        page.wait_for_timeout(500)
        k = page.evaluate(_K)
        if k["modal"] != ["gm-pause"] or C.current_hash(page) != "juegos/letras" or not page.evaluate(
                "() => document.documentElement.hasAttribute('data-gm-play')"):
            probs.append(f"tras seguir: hojas {k['modal']}, #/{C.current_hash(page)}")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- las etiquetas
def test_kbd_labels_appear_with_a_key_and_go_with_a_tap():
    """Sin teclado no hay etiquetas. La primera tecla pone html[data-kbd] y una etiqueta gris en cada botón con
    data-key visible («Enter» en «Empezar», «Esc» en la ✕ del modo foco…) sin cambiar el tamaño del botón; un toque
    (o un clic) las quita. aria-keyshortcuts dice la tecla."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        page.wait_for_selector("#hm-go", timeout=6000)
        page.wait_for_timeout(400)
        box0 = page.locator("#hm-go").bounding_box()
        if page.evaluate(_KBD) or page.evaluate(_TAGS):
            probs.append(f"etiquetas sin haber tocado una tecla: {page.evaluate(_TAGS)}")
        page.keyboard.press("ArrowLeft")
        page.wait_for_timeout(350)
        tags = page.evaluate(_TAGS)
        if not page.evaluate(_KBD) or {"k": "Enter", "host": "hm-go"} not in tags:
            probs.append(f"tras una tecla, sin etiqueta «Enter» en «Empezar»: {tags}")
        st = page.evaluate("""() => { const t = document.querySelector('#hm-go > .kb-tag'); if (!t) return null; const c = getComputedStyle(t);
          return {aria: t.getAttribute('aria-hidden'), k: t.dataset.k, before: getComputedStyle(t, '::before').content, bg: c.backgroundColor, pe: c.pointerEvents,
            ks: document.getElementById('hm-go').getAttribute('aria-keyshortcuts'), label: document.getElementById('hm-go').textContent.trim()}; }""")
        if not st or st["aria"] != "true" or st["k"] != "Enter" or st["before"] in ("none", "normal", "") or st["pe"] != "none" \
                or st["ks"] != "Enter" or "Enter" in st["label"]:
            probs.append(f"etiqueta de «Empezar»: {st}")
        box1 = page.locator("#hm-go").bounding_box()
        if any(abs(box0[k] - box1[k]) > 0.5 for k in ("width", "height")):
            probs.append(f"la etiqueta cambia el tamaño del botón: {box0} → {box1}")
        page.touchscreen.tap(195, 120)
        page.wait_for_timeout(300)
        if page.evaluate(_KBD) or page.evaluate(_TAGS):
            probs.append(f"un toque no quita las etiquetas: {page.evaluate(_TAGS)}")
        # en la lección: ✕, altavoz, tortuga y botón de abajo
        C.goto(page, "#/mapa")
        C.goto(page, "#/leccion/" + LESSON)
        page.wait_for_selector(".ls-stage .ls-page .ls-spk", timeout=8000)
        page.wait_for_timeout(600)
        page.keyboard.press("ArrowUp")          # no es de nadie: solo enseña las etiquetas
        page.wait_for_timeout(350)
        page.keyboard.press("Shift")
        hosts = {(t["k"], t["host"]) for t in page.evaluate(_TAGS)}
        want = {("Esc", "fx-x"), ("Espacio", "say"), ("⇧ Espacio", "say"), ("Enter", "ls-go")}
        if not page.evaluate(_KBD) or not want <= hosts:
            probs.append(f"etiquetas de la lección: {sorted(hosts)}")
        page.mouse.click(5, 420)
        page.wait_for_timeout(300)
        if page.evaluate(_KBD) or page.evaluate(_TAGS):
            probs.append(f"un clic no quita las etiquetas: {page.evaluate(_TAGS)}")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- manifest: los atajos de la app instalada
_SHORTCUTS = [("Repasar", "./#/repaso", "icons/sc-repasar.png"), ("Seguir el camino", "./#/mapa", "icons/sc-camino.png"),
              ("Juegos", "./#/juegos", "icons/sc-juegos.png"), ("Mi granja", "./#/granja", "icons/sc-granja.png")]
_SCREEN = {"repaso": "#rv-card", "mapa": "#cur-node", "juegos": "#gm-menu", "granja": "#farm-host .fm-stage, #app .fm-stage"}


def _png_size(body: bytes):
    if body[:8] != b"\x89PNG\r\n\x1a\n" or body[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", body[16:24])


def test_manifest_shortcuts():
    """manifest.webmanifest es JSON válido para Chrome (sin errores en Page.getAppManifest) con 4 atajos: nombre, nombre
    corto, descripción en español, URL dentro del alcance e icono PNG de 96×96 que responde 200. Los iconos y
    js/keys.js están en el SHELL de sw.js."""
    page = C.new_page("desk")
    probs = []
    try:
        C.goto(page, "#/")
        base = C.base_url(page)
        r = page.request.get(base + "/manifest.webmanifest")
        if r.status != 200:
            probs.append(f"manifest: {r.status}")
        man = json.loads(r.text())
        sc = man.get("shortcuts") or []
        got = [(s.get("name"), s.get("url"), (s.get("icons") or [{}])[0].get("src")) for s in sc]
        if got != _SHORTCUTS:
            probs.append(f"atajos: {got}")
        for s in sc:
            if not s.get("short_name") or len(s["short_name"]) > 12 or not s.get("description"):
                probs.append(f"atajo sin nombre corto o descripción: {s}")
            ic = (s.get("icons") or [{}])[0]
            if ic.get("sizes") != "96x96" or ic.get("type") != "image/png":
                probs.append(f"icono del atajo {s.get('name')}: {ic}")
            res = page.request.get(base + "/" + ic.get("src", ""))
            size = _png_size(res.body()) if res.status == 200 else None
            if res.status != 200 or size != (96, 96):
                probs.append(f"{ic.get('src')}: {res.status}, {size}")
        cdp = page.context.new_cdp_session(page)
        am = cdp.send("Page.getAppManifest")
        if am.get("errors"):
            probs.append(f"Chrome ve errores en el manifest: {am['errors']}")
        parsed = am.get("manifest")
        if parsed is not None:
            urls = [x.get("url", "") for x in parsed.get("shortcuts") or []]
            if urls != [base + "/" + x[1][2:] for x in _SHORTCUTS]:
                probs.append(f"Chrome no lee los 4 atajos: {urls}")
        sw = (C.ROOT / "sw.js").read_text(encoding="utf-8")
        for f in ["js/keys.js"] + [x[2] for x in _SHORTCUTS]:
            if f'"{f}"' not in sw:
                probs.append(f"{f} no está en el SHELL de sw.js")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def _check_screen(page, url, tag, probs):
    h = url.split("#/", 1)[1]
    try:
        page.wait_for_selector(_SCREEN[h], timeout=10000)
    except Exception:  # noqa: BLE001
        probs.append(f"{tag}: {url} no abre su pantalla (#/{C.current_hash(page)})")
        return
    if C.current_hash(page) != h:
        probs.append(f"{tag}: {url} acaba en #/{C.current_hash(page)}")


def test_shortcut_urls_open_their_screens():
    """Cada URL de atajo abre su pantalla: en frío (la app carga de cero en esa URL) y con el service worker (otra
    pestaña de la app ya instalada, controlada por sw.js)."""
    probs = []
    for _, url, _ in _SHORTCUTS:
        page = C.new_page("phone")
        try:
            C.seed(page, hash="#/" + url.split("#/", 1)[1])
            _check_screen(page, url, "en frío", probs)
            if C.errors(page):
                probs.append(f"en frío {url}: errores {C.errors(page)}")
        finally:
            page.context.close()
    ctx = C.new_context("phone", sw=True, host="localhost")
    try:
        page = ctx.new_page()
        C.seed(page)
        page.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=20000)
        base = C.base_url(page)
        for _, url, _ in _SHORTCUTS:
            p = ctx.new_page()
            p.goto(base + "/" + url[2:], wait_until="domcontentloaded")
            _check_screen(p, url, "con sw", probs)
            if not p.evaluate("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)"):
                probs.append(f"con sw: {url} no pasa por el service worker")
            if C.errors(p):
                probs.append(f"con sw {url}: errores {C.errors(p)}")
            p.close()
    finally:
        ctx.close()
    assert not probs, "\n".join(probs)
