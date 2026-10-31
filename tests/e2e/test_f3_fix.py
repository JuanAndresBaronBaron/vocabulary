"""F3 · lo que pidió la revisión: la palabra que se aprende nunca se parte; un doble toque no se salta los finales; «Dilo»
dicho bien y salir a la vez escribe la nota; la tarjeta que vuelve tras un «No» vale 1 como mucho; sin internet o sin
micrófono «Dilo» se va con un aviso claro; la lección guardada recuerda qué repeticiones faltaban, no se rompe con
valores raros y se recupera aunque se cierre la pestaña (vocab:lsdraft, solo de este aparato); «Cómo suena» se cierra
al salir; en la ficha, la vuelta «‹ Palabras» va en la barra de arriba; Camino y ficha con los detalles de la revisión
(vistazo con el número de unidad, nodos hechos con contraste, menú opaco, avisos con iconos, cabeceras «Mascotas»,
«En el repaso» con nombre); la lección sin contador «3/12», con el botón principal siempre en el mismo sitio, sin
dibujos de árbol familiar diminutos, con la pregunta en minúscula y lo que se lee con su idioma. Sin errores de consola
y con la partida exportada igual."""
from __future__ import annotations

import json

import common as C
import test_f3_leccion as L
import test_f3_repaso as V
import routes as R

_ONE_LINE = """sel => { const el = document.querySelector(sel); if (!el) return null; const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
  return {t: el.textContent, h: el.getBoundingClientRect().height, lh, fs: parseFloat(cs.fontSize), brk: el.classList.contains('is-break'),
    over: el.scrollWidth > el.clientWidth + 1, one: el.getBoundingClientRect().height < lh * 1.6}; }"""
_PAGE = ".ls-stage > .ls-page:not(.ls-ghost)"


def _ui_keys(text=""):
    keys = C.seed_keys()
    if text:
        keys["vocab:ui"] = json.dumps({"text": text})
    return keys


# ---------------------------------------------------------------- la palabra entera
def test_learning_word_never_splits():
    """La palabra nueva de la lección («granddaughter»), la del repaso («hippopotamus») y la de Tarjetas quedan en una
    sola línea, sin partir ni guiones: a 360×740, a 375×667 con «Texto más grande» y a 390×844 con texto grande. Si no
    caben, bajan de tamaño (nunca de 28 px)."""
    probs = []
    for w, h, text in ((360, 740, ""), (375, 667, "large"), (390, 844, "large")):
        tag = f"{w}×{h}{' texto grande' if text else ''}"
        page = C.new_page("phone", viewport={"width": w, "height": h})
        try:
            C.seed(page, keys=_ui_keys(text))
            C.goto(page, "#/leccion/" + R.LESSON)
            page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-page')", timeout=8000)
            seen = []
            # las palabras nuevas salen de 3 en 3 entre preguntas: se contestan bien hasta ver «granddaughter»
            for _ in range(60):
                st = page.evaluate(L._ST)
                if not st or st["ended"] or "granddaughter" in seen:
                    break
                if st["t"] != "learn":
                    L._pick(page, st["right"])
                    page.wait_for_function("() => { const g = document.getElementById('ls-go'); return g && !g.hidden; }", timeout=6000)
                    if page.evaluate(L._ST)["i"] == st["i"]:
                        L._go(page)
                    continue
                page.wait_for_timeout(120)
                m = page.evaluate(_ONE_LINE, f"{_PAGE} .ls-word")
                seen.append(m["t"])
                if not m["one"] or m["brk"] or m["over"] or m["fs"] < 28:
                    probs.append(f"{tag}: la palabra nueva se parte: {m}")
                L._go(page)
            if "granddaughter" not in seen:
                probs.append(f"{tag}: no salió «granddaughter» en las palabras nuevas: {seen}")
            # el repaso (con la partida recién sembrada: la lección a medias no cuenta): «hippopotamus» delante y girada
            C.seed(page, keys=_ui_keys(text), hash="#/repaso")
            page.wait_for_selector("#rv-card", timeout=8000)
            ok = page.evaluate("""() => { const k = rv.q.findIndex((x, j) => j >= rv.i && x.r.l[lang].word === 'hippopotamus'); if (k < 0) return false;
              const [it] = rv.q.splice(k, 1); rv.q.splice(rv.i, 0, it); rv.c = null; rvDraw(); return true; }""")
            if not ok:
                probs.append(f"{tag}: «hippopotamus» no está en el repaso sembrado")
            else:
                V._tap_card(page)
                page.wait_for_timeout(400)
                m = page.evaluate(_ONE_LINE, "#rv-card .rv-word")
                if not m["one"] or m["brk"] or m["over"] or m["fs"] < 28 or m["t"] != "hippopotamus":
                    probs.append(f"{tag}: en el repaso se parte: {m}")
            # Tarjetas de la familia: «granddaughter» girada
            C.goto(page, "#/doc/familia")
            page.locator("#dv-tab-tarjetas").click()
            page.wait_for_selector("#card", timeout=5000)
            page.evaluate("""() => { const s = vocabLearn.state.fc, list = CACHE.familia.rows.filter(r => r.es && r.l && r.l[lang]);
              s.order = list.map((_, i) => i); s.i = list.findIndex(r => r.l[lang].word === 'granddaughter'); s.flip = false; }""")
            page.locator("#dv-tab-lista").click()
            page.locator("#dv-tab-tarjetas").click()
            page.wait_for_selector("#card", timeout=5000)
            page.locator("#card").click()
            page.wait_for_timeout(450)
            m = page.evaluate(_ONE_LINE, "#card .fcx-w[lang]")
            if not m or not m["one"] or m["brk"] or m["over"] or m["t"] != "granddaughter":
                probs.append(f"{tag}: en Tarjetas se parte: {m}")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- dobles toques
def test_double_tap_never_skips_the_end():
    """Un doble toque (muy de niño) no se salta la pantalla final: tocar enseguida donde sale «Siguiente lección» (o
    «Seguir» del repaso) no hace nada hasta que salen las estrellas (≈0,7 s; 0,6 s en el repaso); después sí."""
    probs = []
    page = C.new_page("phone")
    try:
        L._open(page)
        page.evaluate(L._HOOK)
        page.evaluate(L._FAKE_AUDIO)
        page.evaluate("() => { window.__audioD = 0; }")
        for _ in range(80):
            st = page.evaluate(L._ST)
            if st["t"] in (None, "learn"):
                L._go(page)
                continue
            last = st["i"] == st["n"] - 1
            L._pick(page, st["right"])
            if not last:
                L._wait_change(page, st["i"], 9000)
                page.wait_for_timeout(240)
                continue
            # la última: «Seguir» y, enseguida, otro toque en el mismo sitio
            page.wait_for_function("() => { const g = document.getElementById('ls-go'); return g && !g.hidden; }", timeout=4000)
            b = page.locator("#ls-go").bounding_box()
            x, y = b["x"] + b["width"] * .75, b["y"] + b["height"] / 2
            page.mouse.click(x, y)
            page.wait_for_selector(".ls-end #ls-next", timeout=4000)
            page.wait_for_timeout(180)
            nb = page.locator("#ls-next").bounding_box()
            if not (nb["x"] <= x <= nb["x"] + nb["width"] and nb["y"] <= y <= nb["y"] + nb["height"]):
                probs.append(f"«Siguiente lección» no está donde estaba «Seguir» ({nb} vs {x},{y}): la prueba no sirve")
            page.mouse.click(x, y)
            page.wait_for_timeout(900)
            if C.current_hash(page) != "leccion/" + R.LESSON or not page.locator(".ls-end").count():
                probs.append(f"el doble toque se salta el final de la lección: #/{C.current_hash(page)}")
            break
        n0 = page.evaluate("window.__vocabRouteN || 0")
        page.locator("#ls-next").click()
        page.wait_for_function("n => (window.__vocabRouteN || 0) > n", arg=n0, timeout=8000)
        if not C.current_hash(page).startswith("leccion/") or C.current_hash(page) == "leccion/" + R.LESSON:
            probs.append(f"pasado el rato, «Siguiente lección» no va a la siguiente: #/{C.current_hash(page)}")
        probs += C.errors(page)
        # el repaso: la última tarjeta y un toque enseguida en «Seguir» del final
        page.context.close()
        page = V._page()
        V._open(page)
        page.evaluate("() => { rv.q = rv.q.slice(0, 1); rv.total = 1; rvDraw(); }")
        V._tap_card(page)
        page.locator(".rv-yes").click()
        page.wait_for_selector("#rv-end-go", state="attached", timeout=4000)
        b = page.locator("#rv-end-go").bounding_box()
        page.mouse.click(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2)
        page.wait_for_timeout(250)
        if C.current_hash(page) != "repaso" or not page.locator("#rv-end").count():
            probs.append(f"un toque enseguida en el final del repaso se lo salta: #/{C.current_hash(page)}")
        page.wait_for_timeout(700)
        n0 = page.evaluate("window.__vocabRouteN || 0")
        page.locator("#rv-end-go").click()
        page.wait_for_function("n => (window.__vocabRouteN || 0) > n", arg=n0, timeout=8000)
        if C.current_hash(page) != "":
            probs.append(f"pasado el rato, «Seguir» del repaso no va a Hoy: #/{C.current_hash(page)}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- repaso: decir y salir, la segunda vez, sin red
def test_spoken_word_then_leave_still_grades():
    """Decir bien la palabra y salir del repaso (atrás, o la ✕ › Salir) antes de que pase sola: la nota se escribe igual
    (la de srsGrade con 2), el repaso sigue abierto en la siguiente tarjeta y al volver se puede seguir con normalidad.
    Si era la última, el repaso termina (las 10 monedas del final y review-done una vez)."""
    probs = []
    page = V._page(init=V._FAKE_SR)
    try:
        V._open(page, frm="")
        st0, before = page.evaluate(V._ST), page.evaluate(V._SNAP)
        page.locator("#rv-mic").click()
        page.wait_for_function("() => vocabReview.state && vocabReview.state.said", timeout=4000)
        page.go_back()
        page.wait_for_timeout(2500)
        if C.current_hash(page) != "":
            probs.append(f"atrás no sale del repaso: #/{C.current_hash(page)}")
        st = page.evaluate(V._ST)
        if not st or st["i"] != 1 or st["done"] != 1 or not st["open"]:
            probs.append(f"tras decirla y salir, la tarjeta no queda puntuada: {st}")
        r = page.evaluate(V._EXPECT, [st0["key"], 2, before])
        if not r["same"]:
            probs.append(f"la nota no es la de srsGrade(…, 2): {r['entry']} (se esperaba {r['want']})")
        C.goto(page, "#/repaso")
        page.wait_for_selector("#rv-card", timeout=5000)
        lk = page.evaluate(V._LOOK)
        if lk["flipped"] or lk["look"] != "Ver" or page.evaluate(V._ST)["key"] == st0["key"]:
            probs.append(f"al volver al repaso: {lk}")
        V._tap_card(page)
        page.locator(".rv-yes").click()
        V._wait_next(page, 1)
        # la última tarjeta, dicha bien y salir: termina el repaso
        page.wait_for_selector("#rv-card:not(.is-flipped)", timeout=3000)
        page.evaluate("() => { rv.q = rv.q.slice(0, rv.i + 1); rv.total = rv.q.length; rvDraw(); }")
        page.locator("#rv-mic").click()
        page.wait_for_function("() => vocabReview.state && vocabReview.state.said", timeout=4000)
        page.evaluate("() => navTo('#/mapa')")
        page.wait_for_timeout(2500)
        if page.evaluate(V._ST) is not None:
            probs.append(f"tras decir bien la última y salir, el repaso sigue abierto: {page.evaluate(V._ST)}")
        if page.evaluate("() => window.__done") != [{"n": 3}] or len([a for a in V._awards(page) if a[0] == 10]) != 1:
            probs.append(f"el final no se paga una vez: done {page.evaluate('() => window.__done')}, monedas {V._awards(page)}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_requeued_card_counts_at_most_one():
    """Una tarjeta con «No» vuelve al final de la cola; esa segunda vez acaba de ver la respuesta, así que «¡Sí!» rápido
    vale 1 (lo que escribe srsGrade con 1), no 2. Las demás siguen valiendo 2."""
    probs = []
    page = V._page()
    try:
        V._open(page)
        st0 = page.evaluate(V._ST)
        V._tap_card(page)
        page.locator(".rv-no").click()
        V._wait_next(page, st0["i"])
        page.wait_for_selector("#rv-card:not(.is-flipped)", timeout=3000)
        page.evaluate("() => { const it = rv.q.pop(); rv.q.splice(rv.i, 0, it); rv.c = null; rvDraw(); }")
        st1, before = page.evaluate(V._ST), page.evaluate(V._SNAP)
        if st1["key"] != st0["key"] or not st1["again"]:
            probs.append(f"la tarjeta que vuelve no está marcada: {st1}")
        V._tap_card(page)
        page.locator(".rv-yes").click()
        V._wait_next(page, st1["i"])
        V._graded(page, st1, before, 1, "la segunda vez, ¡Sí! rápido", probs)
        page.wait_for_selector("#rv-card:not(.is-flipped)", timeout=3000)
        st2, before = page.evaluate(V._ST), page.evaluate(V._SNAP)
        V._tap_card(page)
        page.locator(".rv-yes").click()
        V._wait_next(page, st2["i"])
        V._graded(page, st2, before, 2, "otra tarjeta, ¡Sí! rápido", probs)
        if page.evaluate("() => vocabReview.grade(true, {again: true, thinkMs: 0})") != 1:
            probs.append("vocabReview.grade no limita a 1 la segunda vez")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_mic_unavailable_offline_or_missing():
    """Sin internet (error network), sin micrófono (audio-capture) o sin ese idioma: «Dilo» no se queda diciendo «No te
    he oído bien»; lo dice una vez, claro y sin culpa («Sin internet no puedo oírte. Toca «Ver».», «No encuentro el
    micrófono. Toca «Ver».»), y el micrófono se va del repaso. Sin red (navigator.onLine) «Dilo» no sale y la tarjeta
    invita a pensarla; con la red vuelve."""
    probs = []
    for mode, msg in (("network", "Sin internet no puedo oírte. Toca «Ver»."), ("audio-capture", "No encuentro el micrófono. Toca «Ver».")):
        page = V._page(init=V._FAKE_SR)
        try:
            V._open(page)
            page.evaluate(f"() => {{ window.__srMode = '{mode}'; }}")
            before = page.evaluate(V._SNAP)
            page.locator("#rv-mic").click()
            page.wait_for_function("() => !document.getElementById('rv-mic')", timeout=4000)
            lk = page.evaluate(V._LOOK)
            if lk["msg"] != msg or lk["look"] != "Ver" or lk["giveup"]:
                probs.append(f"{mode}: {lk['msg']!r} · «{lk['look']}» · «{lk['giveup']}»")
            if page.evaluate(V._SNAP) != before:
                probs.append(f"{mode}: ya hay nota")
            V._tap_card(page)
            page.locator(".rv-yes").click()
            page.wait_for_selector("#rv-card:not(.is-flipped)", timeout=3000)
            if page.evaluate(V._LOOK)["mic"]:
                probs.append(f"{mode}: en la tarjeta siguiente vuelve «Dilo»")
            probs += [f"{mode}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    page = V._page(init=V._FAKE_SR)
    try:
        V._open(page)
        page.context.set_offline(True)
        page.wait_for_function("() => !document.getElementById('rv-mic')", timeout=3000)
        lk = page.evaluate(V._LOOK)
        if lk["tap"] != "Piénsala… y toca para ver" or lk["look"] != "Ver":
            probs.append(f"sin red: {lk['tap']!r} · «{lk['look']}»")
        page.context.set_offline(False)
        page.wait_for_function("() => !!document.getElementById('rv-mic')", timeout=3000)
        if page.evaluate(V._LOOK)["mic"] != "Dilo en inglés":
            probs.append(f"con la red no vuelve «Dilo en inglés»: {page.evaluate(V._LOOK)['mic']!r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- lección guardada
# cada palabra por su clave (tema:fila); «Empareja» no tiene una sola palabra
_CUR = """() => { const s = vocabLesson.state, st = s.steps[s.i]; return {i: s.i, n: s.steps.length, t: st && st.t, re: !!(st && st.re),
  k: st && st.w && st.w.k, rest: s.steps.slice(s.i).map(x => x.w ? x.w.k : x.t), left: s.steps.slice(s.i).filter(x => x.re && !x.done).map(x => x.w.k)}; }"""


def test_saved_lesson_keeps_reasks_and_rejects_bad_values():
    """Recargar a mitad: las repeticiones que faltaban son las de verdad (una palabra fallada dos veces sigue pendiente;
    otra fallada y luego acertada, no), gracias a «left» y al plan en lo guardado. Un 'vocab:ls' raro (n: 5e7, i: 5000,
    i > n, negativo) no cuelga la pestaña ni hace una lección de 5008 pasos: la lección empieza de cero."""
    probs = []
    page = C.new_page("phone")
    try:
        L._open(page)
        page.evaluate(L._HOOK)
        page.evaluate(L._FAKE_AUDIO)
        page.evaluate("() => { window.__audioD = 0; }")
        # las dos primeras preguntas mal (x, y), que vuelven 3-5 pasos después: x mal otra vez (y vuelve otra vez), y
        # bien; se para en cuanto han salido las dos repeticiones
        x = y = None
        q = xre = 0
        yre = False
        for _ in range(140):
            st, cur = page.evaluate(L._ST), page.evaluate(_CUR)
            if st["ended"] or (xre and yre):
                break
            if st["t"] == "learn":
                L._go(page)
                continue
            if q == 0:
                x = cur["k"]
            if q == 1:
                y = cur["k"]
            wrong = q < 2 or (cur["re"] and cur["k"] == x and xre == 0)
            if cur["re"] and cur["k"] == x:
                xre += 1
            if cur["re"] and cur["k"] == y:
                yre = True
            if wrong:
                L._pick(page, L._wrong(page, st["right"]))
                page.wait_for_function("() => { const g = document.getElementById('ls-go'); return g && !g.hidden; }", timeout=3000)
                L._go(page)
            else:
                L._pick(page, st["right"])
                L._wait_change(page, st["i"], 9000)
                page.wait_for_timeout(250)
            q += 1
        # x sigue pendiente si su segunda repetición no ha salido aún (si salió, se acertó); y ya no
        exp = [x] if xre == 1 else []
        before = page.evaluate(_CUR)
        if not (xre and yre) or before["left"] != exp:
            probs.append(f"antes de recargar faltan las repeticiones {before['left']} (se esperaba {exp}; x salió {xre} veces, y {yre})")
        sv = page.evaluate(L._SAVED)
        if sv.get("left") != exp:
            probs.append(f"lo guardado no lleva las repeticiones pendientes: {sv}")
        C.reload(page)
        page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-page')", timeout=8000)
        after = page.evaluate(_CUR)
        if after["left"] != exp or after["rest"] != before["rest"] or after["i"] != before["i"] or after["n"] != before["n"]:
            probs.append(f"tras recargar: {after} (antes {before}; {y} ya estaba bien)")
        # valores raros: de cero, y enseguida
        es, k0 = page.evaluate("() => [vocabLesson.state.words[0].r.es, vocabLesson.state.words[0].k]")
        sv = page.evaluate(L._SAVED)
        for bad in ({"n": 50000000, "i": 9}, {"n": 5008, "i": 5000}, {"n": 12, "i": 14}, {"n": 12, "i": -3}):
            # como antes (sin v) y con el formato de ahora (v: 2, el plan de verdad) pero con los números raros
            for v in ({"id": R.LESSON, "first": [], "miss": [es], "lang": "english", **bad}, dict(sv, miss=[k0], **bad)):
                page.evaluate("v => { sessionStorage.setItem('vocab:ls', JSON.stringify(v)); localStorage.removeItem('vocab:lsdraft'); }", v)
                C.reload(page)
                try:
                    page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-page')", timeout=5000)
                    st = page.evaluate(L._ST)
                    if st["i"] != 0 or st["n"] > 40:
                        probs.append(f"con {bad} (v {v.get('v')}): la lección no empieza de cero: {st}")
                except Exception:  # noqa: BLE001
                    probs.append(f"con {bad} (v {v.get('v')}): la lección no se abre en 5 s")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_lesson_draft_survives_a_closed_tab():
    """La lección a medias también se guarda en localStorage 'vocab:lsdraft' ({t, v}, solo de este aparato): si se
    cierra la pestaña (o el iPhone cierra la app), al volver sale «Seguir · Lección N» y sigue en el mismo paso. Pasadas
    72 h ya no cuenta. Terminarla la borra. La partida exportada no la lleva (sigue igual que la de referencia)."""
    probs = []
    acc = """() => { const a = document.getElementById('acc'); return a && !a.hidden && a.getClientRects().length ? a.textContent.replace(/\\s+/g, ' ').trim() : null; }"""
    page = C.new_page("phone")
    try:
        L._open(page)
        for _ in range(3):
            L._go(page)
        sv = page.evaluate(L._SAVED)
        d = page.evaluate("() => JSON.parse(localStorage.getItem('vocab:lsdraft'))")
        if not d or d.get("v") != sv or not isinstance(d.get("t"), (int, float)):
            probs.append(f"vocab:lsdraft no copia lo guardado: {d} (sesión {sv})")
        base = C.load_baseline()
        if base:
            diff = C.diff_exports(base, C.export(page))
            if diff:
                probs.append("con una lección a medias la partida exportada cambia: " + "; ".join(diff))
        keys = page.evaluate("() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))")
        page.context.close()
        # otra pestaña (sessionStorage vacío) con lo mismo en localStorage
        page = C.new_page("phone")
        C.seed(page, keys=keys, hash="#/palabras")
        a = page.evaluate(acc)
        if not a or not a.startswith("Seguir · Lección"):
            probs.append(f"tras cerrar la pestaña no sale el accesorio: {a!r}")
        C.goto(page, "#/leccion/" + R.LESSON)
        page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-page')", timeout=8000)
        if page.evaluate(L._ST)["i"] != sv["i"]:
            probs.append(f"no sigue en el mismo paso: {page.evaluate(L._ST)} (guardado {sv})")
        # más de 72 h: no cuenta
        old = json.loads(keys["vocab:lsdraft"])
        old["t"] -= 73 * 3600 * 1000
        keys["vocab:lsdraft"] = json.dumps(old)
        page.context.close()
        page = C.new_page("phone")
        C.seed(page, keys=keys, hash="#/palabras")
        if page.evaluate(acc):
            probs.append(f"una lección de hace 73 h sigue ofreciéndose: {page.evaluate(acc)!r}")
        C.goto(page, "#/leccion/" + R.LESSON)
        page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-page')", timeout=8000)
        if page.evaluate(L._ST)["i"] != 0:
            probs.append("una lección de hace 73 h se retoma")
        L._play(page, auto=False)
        if page.evaluate("() => localStorage.getItem('vocab:lsdraft')") is not None:
            probs.append("terminar la lección no borra vocab:lsdraft")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_how_sheet_closes_when_leaving():
    """«Cómo suena» abierta en la primera tarjeta y atrás (escritorio, o el gesto de iOS): la hoja se cierra y Hoy queda
    usable (sin html[data-sheet]). Lo mismo con «Opciones» de Escribir, abierta o recién cerrada, al cambiar de
    pantalla en el mismo instante: sin errores y sin html[data-sheet] colgado."""
    probs = []
    page = C.new_page("desk")
    try:
        L._open(page, via="#/")
        page.locator(f"{_PAGE} [data-how]").click()
        page.wait_for_function("() => document.getElementById('ls-how') && document.getElementById('ls-how').open", timeout=3000)
        page.go_back()
        page.wait_for_timeout(900)
        r = page.evaluate("""() => ({h: location.hash, how: !!(document.getElementById('ls-how') || {}).open,
          sheet: document.documentElement.hasAttribute('data-sheet'), focus: document.documentElement.dataset.focus || ''})""")
        if r["how"] or r["sheet"] or r["focus"]:
            probs.append(f"al salir con atrás: {r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    # Escribir: la hoja «Opciones» abierta (o recién cerrada con «Listo») y a otra pantalla en el mismo instante
    page = C.new_page("phone")
    try:
        C.seed(page)
        for how in ("listo", "abierta"):
            C.goto(page, f"#/doc/{R.TOPIC}")
            page.locator("#dv-tab-practica").click()
            page.wait_for_selector("#pr-opt", timeout=4000)
            page.locator("#pr-opt").click()
            page.wait_for_selector("dialog#pr-sheet[open]", timeout=3000)
            page.wait_for_timeout(500)
            page.evaluate("""how => { if (how === 'listo') document.querySelector('#pr-sheet [data-close]').click();
              location.hash = '#/palabras'; }""", how)
            page.wait_for_timeout(900)
            r = page.evaluate("() => ({h: location.hash, sheet: document.documentElement.hasAttribute('data-sheet'), left: !!document.getElementById('pr-sheet')})")
            if r["h"] != "#/palabras" or r["sheet"] or r["left"]:
                probs.append(f"Escribir, «Opciones» ({how}) y a Palabras: {r}")
            probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la lección por dentro
def test_lesson_details_from_review():
    """En la lección: sin contador «3/12» (al fallar no «sube» el total), el botón principal siempre con el mismo ancho y
    en el mismo sitio (el hueco de «‹» se guarda), la pregunta con la palabra en minúscula («¿Cuál es «abuela»?»), sin
    los dibujos diminutos del árbol familiar en «Escucha y elige», la buena y la elegida con su nombre para el lector de
    pantalla («(correcta)», «(tu respuesta)»), lo que se anuncia con la palabra en su idioma y, tras pasar sola, el foco
    en la tarjeta nueva. A 375×667 con texto grande, «¡Casi!» queda entera por encima de «Seguir»."""
    probs = []
    page = C.new_page("phone", viewport={"width": 375, "height": 667})
    try:
        C.seed(page, keys=_ui_keys("large"))
        C.goto(page, "#/mapa")
        C.goto(page, "#/leccion/" + R.LESSON)
        page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-page')", timeout=8000)
        page.evaluate(L._HOOK)
        page.evaluate(L._FAKE_AUDIO)
        page.evaluate("() => { window.__audioD = 0; }")
        widths = []
        page.wait_for_timeout(200)
        while page.evaluate(L._ST)["t"] == "learn":
            widths.append(page.evaluate("() => { const b = document.getElementById('ls-go').getBoundingClientRect(); return [Math.round(b.left), Math.round(b.width)]; }"))
            say = page.evaluate("() => document.getElementById('ls-say').innerHTML")
            if 'lang="en-GB"' not in say:
                probs.append(f"la palabra nueva se anuncia sin su idioma: {say!r}")
                break
            L._go(page)
        if len(set(map(tuple, widths))) != 1:
            probs.append(f"el botón principal cambia de sitio o de ancho: {widths}")
        if page.locator(".ls-cnt").count() or page.evaluate("() => /\\d+\\s*\\/\\s*\\d+/.test(document.querySelector('.ls-top').textContent)"):
            probs.append("la barra de arriba aún tiene el contador «3/12»")
        missed = False
        for _ in range(12):
            st = page.evaluate(L._ST)
            if st["t"] not in ("pick", "listen"):
                break
            q = page.evaluate(f"""() => {{ const p = document.querySelector('{_PAGE}'), s = vocabLesson.state, st = s.steps[s.i];
              return {{ask: (p.querySelector('.ls-ask') || {{}}).textContent || '', es: st.w.r.es, imgs: p.querySelectorAll('.ls-opt img').length}}; }}""")
            low = "/".join(p if any(ch.isupper() for ch in p[1:]) else p[:1].lower() + p[1:] for p in q["es"].split("/"))
            if st["t"] == "pick" and q["ask"] != f"¿Cuál es {low}?":   # las comillas las pone <q>
                probs.append(f"la pregunta no va en minúscula: {q['ask']!r} ({q['es']})")
            if st["t"] == "listen" and q["imgs"]:
                probs.append(f"«Escucha y elige» de la familia con dibujos del árbol: {q['imgs']}")
            if not missed:
                missed = True
                L._pick(page, L._wrong(page, st["right"]))
                page.wait_for_function("() => { const g = document.getElementById('ls-go'); return g && !g.hidden; }", timeout=3000)
                page.wait_for_timeout(500)
                r = page.evaluate(f"""() => {{ const p = document.querySelector('{_PAGE}'), fb = p.querySelector('.ls-fb'), go = document.getElementById('ls-go');
                  const ok = p.querySelector('.ls-opt.is-ok'), miss = p.querySelector('.ls-opt.is-miss');
                  return {{fb: fb ? fb.getBoundingClientRect().bottom : null, go: go.getBoundingClientRect().top, ih: innerHeight,
                    ok: ok ? ok.textContent : '', miss: miss ? miss.textContent : '', say: document.getElementById('ls-say').innerHTML}}; }}""")
                if r["fb"] is None or r["fb"] > r["go"] - 4:
                    probs.append(f"«¡Casi!» queda bajo «Seguir»: {r}")
                if "(correcta)" not in r["ok"] or "(tu respuesta)" not in r["miss"]:
                    probs.append(f"los botones contestados sin nombre para el lector: {r['ok']!r} · {r['miss']!r}")
                if st["t"] == "pick" and "lang=" not in r["say"]:
                    probs.append(f"«¡Casi! Es…» se anuncia sin el idioma de la palabra: {r['say']!r}")
                L._go(page)
                continue
            L._pick(page, st["right"])
            L._wait_change(page, st["i"], 9000)
            page.wait_for_timeout(300)
            if page.evaluate(L._ST)["ended"]:
                break
            f = page.evaluate(f"() => {{ const a = document.activeElement; return !!a && a.classList.contains('ls-card') && !!a.closest('{_PAGE}'); }}")
            if not f:
                probs.append(f"tras pasar sola el foco no va a la tarjeta nueva: {page.evaluate('() => document.activeElement && document.activeElement.className')}")
                break
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- ficha, Camino y escritorio
def test_doc_back_in_top_bar_and_learn_details():
    """En #/doc/<tema> «‹ Palabras» es la cápsula de vidrio de la barra de arriba (en el sitio de la bandera), así que con
    scroll nunca queda debajo de la bandera; lleva a Palabras. En la Lista las cabeceras son «Mascotas» (no
    «MASCOTAS»), el punto «ya en el repaso» tiene nombre, con la fila abierta solo queda el altavoz grande, y «Se
    dice». Tarjetas dice «Ver primero en inglés» y «Toca para ver» con la mano. En el Camino: el vistazo dice «Unidad N
    · tema», los nodos hechos son verde oscuro (#008932), el menú de nivel casi opaco (en oscuro, el punto B2 claro) y
    el aviso de un nodo bloqueado lleva el candado del sprite, no un emoji."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, "#/palabras")
        C.goto(page, f"#/doc/{R.TOPIC}")
        page.locator("#dv-tab-lista").click()
        page.wait_for_timeout(300)
        page.evaluate("() => scrollTo(0, 400)")
        page.wait_for_timeout(400)
        r = page.evaluate("""() => { const b = document.getElementById('dv-back'), f = document.getElementById('lang-b'), vis = e => !!e && !!e.getClientRects().length;
          return {back: vis(b) && b.closest('#topbar') ? b.textContent.trim() : null, flag: vis(f), inApp: !!document.querySelector('#app .dv-back, #app #dv-back'),
            top: b ? b.getBoundingClientRect().top : null, scrolled: scrollY}; }""")
        if r["back"] != "Palabras" or r["flag"] or r["inApp"] or r["scrolled"] < 100:
            probs.append(f"la vuelta de la ficha: {r}")
        # Lista
        page.evaluate("() => scrollTo(0, 0)")
        page.wait_for_timeout(200)
        cats = page.evaluate("() => [...document.querySelectorAll('#app .dl-cat')].map(h => h.textContent)")
        if not cats or any(c == c.upper() for c in cats) or cats[0] != "Mascotas":
            probs.append(f"cabeceras de la lista: {cats}")
        srs = page.evaluate("() => { const r = document.querySelector('#app .dl-r.in-srs'); return r ? (r.querySelector('.dl-srs') || {}).textContent : 'sin filas'; }")
        if srs != "En el repaso":
            probs.append(f"el punto «ya en el repaso» sin nombre: {srs!r}")
        page.locator("#app .dl-r .dl-open").first.click()
        page.wait_for_timeout(300)
        o = page.evaluate("""() => { const r = document.querySelector('#app .dl-r.is-open'); if (!r) return null;
          return {row: getComputedStyle(r.querySelector('.dl-fg > .say')).visibility, big: !!r.querySelector('.dl-d .ln-spk.lg'),
            k: [...r.querySelectorAll('.dl-k')].map(k => k.textContent)}; }""")
        if not o or o["row"] != "hidden" or not o["big"] or "Suena" in o["k"]:
            probs.append(f"fila abierta: {o}")
        # Tarjetas
        page.locator("#dv-tab-tarjetas").click()
        page.wait_for_selector("#card", timeout=3000)
        t = page.evaluate("() => ({rev: document.getElementById('rev').textContent.trim(), hand: !!document.querySelector('#card .fcx-tap svg')})")
        if t["rev"] != "Ver primero en inglés" or not t["hand"]:
            probs.append(f"Tarjetas: {t}")
        # Camino
        C.goto(page, "#/mapa/A1")
        page.wait_for_selector("#app .node.done", timeout=5000)
        bg = page.evaluate("() => getComputedStyle(document.querySelector('#app .node.done')).backgroundColor")
        if bg != "rgb(0, 137, 50)":
            probs.append(f"nodo hecho: {bg}")
        done = page.evaluate("() => document.querySelector('#app .node.done[data-ls]').dataset.ls")
        page.evaluate("id => vocabLearn.peek(id)", done)
        page.wait_for_selector("#cm-pk[open]", timeout=3000)
        u = page.locator("#cm-pk .cm-pk-u").text_content()
        want = page.evaluate("id => { const us = lvUnits(id.slice(0, 2)); const k = us.findIndex(u => u.ls.some(l => l.id === id)); return `Unidad ${k + 1} · ${us[k].t}`; }", done)
        if u != want:
            probs.append(f"vistazo: {u!r} (se esperaba {want!r})")
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
        page.evaluate("() => document.querySelector('#app .lvp-b').click()")
        page.wait_for_timeout(300)
        tint = page.evaluate("() => getComputedStyle(document.querySelector('#app .lvp-m')).getPropertyValue('--g-tint').trim()")
        if ".94" not in tint:
            probs.append(f"menú de nivel: tinte {tint!r}")
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        page.evaluate("() => { const b = document.querySelector('#app .node.lock[data-ls]'); if (b) b.click(); }")
        page.wait_for_selector(".m-toast", timeout=3000)
        ts = page.evaluate("() => { const t = document.querySelector('.m-toast'); return {use: t.querySelector('use') && t.querySelector('use').getAttribute('href'), text: t.textContent}; }")
        if ts["use"] != "#i-lock-bold" or "🔒" in ts["text"]:
            probs.append(f"aviso del nodo bloqueado: {ts}")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = C.new_page("phone", color_scheme="dark")
    try:
        C.seed(page)
        C.goto(page, "#/mapa/A1")
        page.evaluate("() => document.querySelector('#app .lvp-b').click()")
        page.wait_for_timeout(300)
        dot = page.evaluate("() => getComputedStyle(document.querySelector('#app .lvp-m .lvp-dot[data-lv=B2]')).backgroundColor")
        if dot != "rgb(127, 156, 240)":
            probs.append(f"en oscuro, el punto B2: {dot}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_desk_columns_line_up():
    """En escritorio (1280 px) el título grande de Aprender empieza donde el Camino y Palabras, y en modo foco la ✕, la
    barra y las monedas van dentro de la columna de la tarjeta, igual en la lección y en el repaso."""
    probs = []
    page = C.new_page("desk")
    try:
        C.seed(page)
        for h, sel in (("#/mapa/A1", "#app .cm"), ("#/palabras", "#app .wl")):
            C.goto(page, h)
            page.wait_for_selector(sel, timeout=5000)
            r = page.evaluate("s => [Math.round(document.querySelector('#tabhead .th-t').getBoundingClientRect().left), Math.round(document.querySelector(s).getBoundingClientRect().left)]", sel)
            if abs(r[0] - r[1]) > 2:
                probs.append(f"{h}: el título empieza en x={r[0]} y la columna en x={r[1]}")
        cols = {}
        for h, wait, bar in (("#/leccion/" + R.LESSON, ".ls-stage .ls-card", ".ls .ls-bar"), ("#/repaso", "#rv-card", "#rv-prog")):
            C.goto(page, h)
            page.wait_for_selector(wait, timeout=8000)
            page.wait_for_timeout(300)
            cols[h] = page.evaluate("""([w, b]) => { const x = document.getElementById('fx-x').getBoundingClientRect(), c = document.querySelector('#focusbar .fx-coins').getBoundingClientRect();
              const card = document.querySelector(w).getBoundingClientRect(), bar = document.querySelector(b).getBoundingClientRect();
              return {x: Math.round(x.left), coins: Math.round(c.right), bar: [Math.round(bar.left), Math.round(bar.right)], card: [Math.round(card.left), Math.round(card.right)]}; }""", [wait, bar])
            c = cols[h]
            if c["x"] < c["card"][0] - 24 or c["coins"] > c["card"][1] + 24:
                probs.append(f"{h}: la ✕ ({c['x']}) o las monedas ({c['coins']}) se salen de la columna {c['card']}")
        a, b = cols.values()
        if abs(a["x"] - b["x"]) > 2 or abs(a["bar"][0] - b["bar"][0]) > 24 or abs(a["bar"][1] - b["bar"][1]) > 24:
            probs.append(f"la barra de la lección y la del repaso no coinciden: {cols}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
