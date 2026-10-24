"""F6, arreglos tras la revisión: lo que se cambió después de integrar F6.

· Cuentos: los candados de los cuentos 3 y 4 se abren pronto (sus palabras clave salen en las primeras lecciones del
  Camino); la hoja de un cuento cerrado dice «¡Casi lo abres!» solo si faltan 3 o menos y trae «Aprender estas
  palabras» (una tarjeta grande por palabra, con IPA y su sonido; cada una va al repaso y el cuento se abre al acabar).
  La página se va entera por el lado del gesto y la nueva entra por el otro (con Reducir movimiento, un fundido de
  ≤ 150 ms); solo vibra al pasar deslizando. En la portada no hay hueco del ‹; las tarjetas de elegir miden lo mismo y
  llevan IPA.
· Llamadas: la de la familia ya no pregunta quién hay en casa; no suena con el juego de buscar de la granja, con un menú
  ni con el dedo en la pantalla; solo vibra al deslizar para contestar; la primera llamada dice que es un juego.
· Menús: el menú de una pieza no pide el permiso de Google y cierra la pista que hubiera.
· Navegación: entrar al cazador sube como el resto de pantallas de foco; el título se pliega también en las pantallas
  empujadas (#/cuentos).
· Cazador: con «Guardar fotos al cazar» apagado (Para mayores) no se guarda nada; tocando, las palabras salen en el
  idioma con su IPA y todo cabe sin scroll en el móvil; en Mi casa, mantener pulsada una foto la borra (con Deshacer).
· Loro: mientras graba, «Tu voz» pinta barras en vivo y tras 1 s sin oír nada sale «Habla un poco más fuerte»;
  vocabMedia.persist() no pregunta nada (ni si ya está, ni en Firefox).
· Hoy: la fila de la llamada perdida lleva el botón teñido, no relleno."""
from __future__ import annotations

import json
import math
import re

import common as C
import test_f6_accesibilidad as A
import test_f6_cazador as HN
import test_f6_cuentos as ST
import test_f6_llamada as CL
import test_f6_loro as LR

OUT = C.CAPTURAS / "F6"
IPA_RE = re.compile(r"^/[^/]+/$")
_HAPTIC = """() => { if (window.__hap) return; window.__hap = []; const h0 = G.haptic;
  G.haptic = function (t) { window.__hap.push(String(t || '')); return h0.apply(this, arguments); }; }"""


def _map_pos():
    """La primera lección del Camino (1, 2, …) en la que sale cada palabra del corpus («tema|es»)."""
    m = json.loads((C.REPO / "data" / "map.json").read_text(encoding="utf-8"))
    docs, pos, n = {}, {}, 0
    for lv in ("A1", "A2", "B1", "B2", "C1", "C2"):
        for unit in m.get(lv, []):
            for ls in unit["ls"]:
                n += 1
                for d, i in ls["w"]:
                    if d not in docs:
                        docs[d] = json.loads((C.REPO / "data" / f"{d}.json").read_text(encoding="utf-8"))["rows"]
                    pos.setdefault(d + "|" + docs[d][i]["es"], n)
    return pos


# ---------------------------------------------------------------- cuentos
def test_story_locks_open_early_and_learn_these_words():
    """Datos: el 90 % de las palabras de cada cuento 3 y 4 sale como muy tarde en la lección 60 del Camino (antes: 92,
    123, 237 y 133). La hoja: «Para abrir este cuento» con más de 3 por aprender y «¡Casi lo abres!» con 3 o menos.
    «Aprender estas palabras» enseña una tarjeta por palabra (dibujo ≥ 160 px a 360, la palabra, su IPA, el español, su
    sonido al salir) con «1 de N»; al acabar, cada una está en el repaso (caja 1), la hoja se cierra con «¡Cuento
    abierto!», el cuento sale abierto en la estantería y no se ha ganado ninguna moneda. Cerrar a medias deja en el repaso
    las que se pasaron."""
    probs = []
    pos = _map_pos()
    for L, lst in ST.IDX.items():
        if L == "v":
            continue
        for e in lst:
            if e["n"] < 3:
                continue
            ps = sorted(pos.get(w["id"], 9999) for w in e["words"])
            need = math.ceil(0.9 * len(ps) - 1e-9)
            if ps[need - 1] > 60:
                probs.append(f"{e['id']}: se abre en la lección {ps[need - 1]} ({len(ps)} palabras)")
    known = ST._seed_srs()
    cake = next(e for e in ST.IDX["english"] if e["id"] == "en-cake")
    lk = ST._lock(cake, known)
    assert lk["left"] > 3, f"la partida sembrada ya casi abre en-cake: {lk}"
    page = ST._page(viewport={"width": 360, "height": 740})
    try:
        ST._open(page)
        c0 = page.evaluate("() => game().coins")
        page.locator(".st-cv[data-id='en-cake']").click()
        page.wait_for_selector("dialog#st-lock-s[open] #st-ls-go:not([disabled])", timeout=6000)
        t = page.locator("#st-ls-t").text_content()
        if t != "Para abrir este cuento":
            probs.append(f"con {lk['left']} por aprender el título es {t!r}")
        if not page.evaluate("() => !!document.querySelector('#st-lock-s a[href=\"#/mapa\"]')"):
            probs.append("la hoja ya no lleva «Ir al camino»")
        page.evaluate("() => { window.__spoken.length = 0; window.__played.length = 0; }")
        page.locator("#st-ls-go").click()
        n = len(lk["miss"])
        for i in range(n):
            page.wait_for_function(f"() => (document.querySelector('.st-lw-n') || {{}}).textContent === '{i + 1} de {n}'", timeout=4000)
            page.wait_for_timeout(450)
            card = page.evaluate("""() => { const c = document.getElementById('st-lw'), im = c.querySelector('.st-lw-pic img');
              return {w: c.querySelector('.st-lw-w').textContent, ipa: ((c.querySelector('.ipa') || {}).textContent || '').replace(/IPA: |\\u2060/g, ''),
                es: c.querySelector('.st-lw-es').textContent, img: im ? Math.round(im.getBoundingClientRect().width) : 0,
                said: window.__spoken.length + window.__played.length, nr: !!c.closest('[data-no-renew]')}; }""")
            if not card["w"] or not IPA_RE.match(card["ipa"]) or not card["es"] or card["img"] < 160 or not card["said"] or not card["nr"]:
                probs.append(f"tarjeta {i + 1}: {card}")
            page.evaluate("() => { window.__spoken.length = 0; window.__played.length = 0; }")
            page.locator("#st-lw-next").click()
        page.wait_for_function("() => !document.querySelector('dialog#st-lock-s[open]')", timeout=4000)
        page.wait_for_timeout(500)
        srs = page.evaluate("() => JSON.parse(localStorage.getItem('srs:english'))")
        bad = [m for m in lk["miss"] if not srs.get(m) or srs[m].get("b") != 1]
        if bad:
            probs.append(f"no fueron al repaso (caja 1): {bad}")
        toast = page.evaluate("() => [...document.querySelectorAll('.m-toast, [role=status]')].map(x => x.textContent).join(' | ')")
        if "¡Cuento abierto!" not in toast:
            probs.append(f"sin «¡Cuento abierto!»: {toast!r}")
        cv = page.evaluate("() => { const a = document.querySelector('.st-cv[data-id=\"en-cake\"]'); return a ? {tag: a.tagName, lock: a.classList.contains('is-lock')} : null; }")
        if cv != {"tag": "A", "lock": False}:
            probs.append(f"en-cake no se abrió en la estantería: {cv}")
        if page.evaluate("() => game().coins") != c0:
            probs.append("aprender las palabras dio monedas")
        # casi abierto (3 o menos) y cerrar a medias
        night = next(e for e in ST.IDX["english"] if e["id"] == "en-night")
        ln = ST._lock(night, set(srs))
        ln["has"] = len(night["words"]) - len(ln["miss"])
        page.locator(".st-cv[data-id='en-night']").click()
        page.wait_for_selector("dialog#st-lock-s[open] #st-ls-go:not([disabled])", timeout=6000)
        t2 = page.locator("#st-ls-t").text_content()
        want = "¡Casi lo abres!" if ln["left"] <= 3 else "Para abrir este cuento"
        if t2 != want:
            probs.append(f"en-night con {ln['left']} por aprender: {t2!r}")
        page.locator("#st-ls-go").click()
        page.wait_for_selector("#st-lw-next", timeout=4000)
        page.locator("#st-lw-next").click()
        page.wait_for_timeout(300)
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.querySelector('dialog#st-lock-s[open]')", timeout=4000)
        page.wait_for_timeout(400)
        has = page.evaluate("() => vocabStories.lock('en-night').has")
        if has != ln["has"] + 1:
            probs.append(f"cerrar a medias: tenía {ln['has']} y ahora {has}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_story_page_turn_follows_the_finger():
    """Con «Siguiente», la página de antes se va entera hacia la izquierda (una copia sin ids, que desaparece) y la nueva
    entra desde el borde derecho, en ≤ 300 ms; con ‹, al revés. Deslizar también pasa la página y es lo único que vibra
    (una vez, "selection"). Con Reducir movimiento es un fundido de ≤ 150 ms."""
    probs = []
    page = ST._page(viewport={"width": 360, "height": 740})
    try:
        ST._open(page, "#/cuento/en-play")
        page.evaluate(_HAPTIC)
        page.locator("#st-next").click()
        ST._wait_state(page, "s.p === 1")
        a = page.evaluate("""() => { const st = document.getElementById('st-stage'), el = st.firstElementChild, g = st.querySelector('.st-ghost');
          const kf = x => x ? x.getAnimations().map(a => ({k: a.effect.getKeyframes().map(f => f.translate || ''), d: a.effect.getTiming().duration})) : [];
          return {ghost: !!g, ids: g ? g.querySelectorAll('[id]').length : -1, inert: g ? g.inert : null, el: kf(el), g: kf(g), w: innerWidth}; }""")
        x = lambda s: float(str(s).split("px")[0] or 0)  # noqa: E731
        if not a["ghost"] or a["ids"] != 0 or not a["inert"]:
            probs.append(f"la página que se va: {a}")
        if not a["el"] or x(a["el"][0]["k"][0]) < a["w"] * 0.8 or a["el"][0]["d"] > 300:
            probs.append(f"la nueva no entra desde el borde derecho: {a['el']}")
        if not a["g"] or x(a["g"][0]["k"][-1]) > -a["w"] * 0.8:
            probs.append(f"la de antes no sale entera por la izquierda: {a['g']}")
        page.wait_for_timeout(450)
        if page.evaluate("() => document.querySelectorAll('#st-stage .st-ghost').length"):
            probs.append("la copia de la página de antes no se quita")
        if page.evaluate("() => window.__hap.length"):
            probs.append(f"vibra al pasar con el botón: {page.evaluate('() => window.__hap')}")
        page.locator("#st-prev").click()
        ST._wait_state(page, "s.p === 0")
        b = page.evaluate("""() => { const st = document.getElementById('st-stage'), el = st.firstElementChild;
          return el.getAnimations().map(a => a.effect.getKeyframes().map(f => f.translate || '')); }""")
        if not b or x(b[0][0]) > -a["w"] * 0.8:
            probs.append(f"con ‹ la nueva no entra por la izquierda: {b}")
        page.wait_for_timeout(450)
        page.locator("#st-next").click()
        ST._wait_state(page, "s.p === 1")
        page.wait_for_timeout(450)
        page.evaluate(ST._SWIPE, -0.6 * 360)
        ST._wait_state(page, "s.p === 2")
        page.wait_for_timeout(100)
        if page.evaluate("() => window.__hap") != ["selection"]:
            probs.append(f"deslizar no vibra una vez: {page.evaluate('() => window.__hap')}")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = ST._page(viewport={"width": 360, "height": 740}, reduced_motion="reduce")
    try:
        ST._open(page, "#/cuento/en-play")
        page.locator("#st-next").click()
        ST._wait_state(page, "s.p === 1")
        d = page.evaluate("() => document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#st-stage')).map(a => a.effect.getTiming().duration)")
        if not d or max(d) > 150:
            probs.append(f"con Reducir movimiento: {d}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_story_cover_and_choice_cards():
    """En la portada el ‹ no ocupa sitio («Empezar» usa todo el ancho del pie). En la de elegir, los dos dibujos miden lo
    mismo, los dos nombres quedan a la misma altura y cada tarjeta lleva la IPA de su frase."""
    probs = []
    for w in (360, 390):
        page = ST._page(viewport={"width": w, "height": 800})
        try:
            ST._open(page, "#/cuento/en-play")
            d = page.evaluate("""() => { const p = document.getElementById('st-prev'), n = document.getElementById('st-next'), k = document.getElementById('st-dock');
              return {disp: getComputedStyle(p).display, nw: n.getBoundingClientRect().width, dw: k.getBoundingClientRect().width}; }""")
            if d["disp"] != "none" or d["nw"] < d["dw"] - 2:
                probs.append(f"{w}px portada: {d}")
            for _ in range(20):
                if ST._state(page)["kind"] == "choice":
                    break
                p0 = ST._state(page)["p"]
                page.locator("#st-next").click()
                ST._wait_state(page, f"s.p > {p0}")
            page.wait_for_timeout(450)
            c = page.evaluate("""() => [...document.querySelectorAll('#st-stage > .st-choice .st-opt')].map(o => ({
              h: Math.round(o.querySelector('.st-opt-pic').getBoundingClientRect().height), t: Math.round(o.querySelector('.st-opt-t').getBoundingClientRect().top),
              ipa: ((o.querySelector('.ipa') || {}).textContent || '').replace(/IPA: |\\u2060/g, '')}))""")
            if len(c) != 2 or abs(c[0]["h"] - c[1]["h"]) > 1 or abs(c[0]["t"] - c[1]["t"]) > 1:
                probs.append(f"{w}px elegir: tarjetas distintas {c}")
            if not all(IPA_RE.match(o["ipa"]) for o in c):
                probs.append(f"{w}px elegir: sin IPA {c}")
            probs += [f"{w}px: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- llamadas
def test_calls_family_question_calm_and_haptics():
    """La llamada de la familia (en, fr, da) ya no pregunta quién hay en casa: pregunta con qué animal le gusta jugar
    (gato, perro o conejo, con su respuesta). calm() es falso con el juego de buscar de la granja, con un menú de pieza
    abierto y con el dedo en la pantalla. La primera llamada dice que es un juego de la app. Contestar con el botón y
    colgar no vibran; deslizar para contestar, sí (una vez)."""
    probs = []
    for ab, f in (("en", "family"), ("fr", "famille"), ("da", "familie")):
        s = json.loads((C.REPO / "data" / "calls" / ab / f"{f}.json").read_text(encoding="utf-8"))
        qs = [ln.get("say", "").lower() for ln in s.get("lines", []) if isinstance(ln, dict) and ln.get("a")]
        if any(k in q for q in qs for k in ("at home", "à la maison", "hjemme")):
            probs.append(f"{ab}/{f}: sigue preguntando por casa: {qs}")
        refs = {a.get("r") for ln in s.get("lines", s if isinstance(s, list) else []) if isinstance(ln, dict) for a in (ln.get("a") or []) if isinstance(a, dict)}
        if not {"animales|Gato", "animales|Perro", "animales|Conejo"} <= refs:
            probs.append(f"{ab}/{f}: respuestas {sorted(r for r in refs if r)}")
    page = CL._page()
    try:
        CL._seed(page, hash="#/granja", armed=False)
        page.wait_for_selector(".fm-stage .fm-it", timeout=9000)
        page.wait_for_timeout(400)
        base = page.evaluate("() => vocabCalls.calm()")
        if not base:
            probs.append("la granja quieta no cuenta como tranquila")
        st = page.evaluate("""() => { const s = document.querySelector('.fm-stage'), out = {};
          s.classList.add('finding'); out.find = vocabCalls.calm(); s.classList.remove('finding');
          document.documentElement.setAttribute('data-cmenu', ''); out.menu = vocabCalls.calm(); document.documentElement.removeAttribute('data-cmenu');
          const ev = (t, b) => new PointerEvent(t, {pointerId: 7, pointerType: 'touch', isPrimary: true, buttons: b, bubbles: true, clientX: 100, clientY: 300});
          s.dispatchEvent(ev('pointerdown', 1)); out.press = vocabCalls.calm(); s.dispatchEvent(ev('pointerup', 0)); out.after = vocabCalls.calm();
          return out; }""")
        if st["find"] or st["menu"] or st["press"] or not st["after"]:
            probs.append(f"calm() en la granja: {st}")
        probs += C.errors(page)
    finally:
        page.context.close()
    for how in ("button", "slide"):
        page = CL._page()
        try:
            CL._seed(page)
            CL._ring(page)
            page.evaluate(_HAPTIC)
            hi = page.evaluate("() => (document.querySelector('#cl-dlg .cl-hi') || {}).textContent || ''")
            if "juego de la app" not in hi:
                probs.append(f"la primera llamada no dice que es un juego: {hi!r}")
            if how == "button":
                CL._answer(page)
                page.wait_for_timeout(300)
                CL._hang(page)
                if page.evaluate("() => window.__hap.length"):
                    probs.append(f"contestar con el botón o colgar vibra: {page.evaluate('() => window.__hap')}")
            else:
                CL._slide(page)
                if len(page.evaluate("() => window.__hap")) != 1:
                    probs.append(f"deslizar para contestar: {page.evaluate('() => window.__hap')}")
            probs += [f"{how}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_missed_call_row_button_is_tinted():
    """En Hoy, el botón de devolver la llamada perdida es teñido (fondo verde suave, icono verde), no un círculo
    relleno."""
    probs = []
    page = CL._page()
    try:
        CL._seed(page)
        CL._ring(page)
        page.locator("#cl-no").click()
        page.wait_for_function("() => !document.querySelector('dialog#cl-dlg[open]')", timeout=4000)
        page.wait_for_selector("[data-slot=call] #cl-row .cl-cb", timeout=5000)
        b = page.evaluate("""() => { const b = document.querySelector('[data-slot=call] #cl-row .cl-cb'), cs = getComputedStyle(b);
          const tmp = document.createElement('i'); tmp.style.color = 'var(--ok-soft)'; document.body.appendChild(tmp); const soft = getComputedStyle(tmp).color; tmp.remove();
          return {bg: cs.backgroundColor, soft, color: cs.color}; }""")
        if b["bg"] != b["soft"]:
            probs.append(f"el botón de la llamada perdida no es teñido: {b}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- menús y navegación
def test_menu_no_google_prompt_and_hides_hint():
    """El menú de una pieza (un animal de la granja) lleva data-no-renew (sync.js no pide el permiso de Google al
    elegir una opción) y, al abrirse, cierra la pista (TipKit) que hubiera en pantalla."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page, hash="#/granja")
        page.wait_for_selector(".fm-it[data-fid=gallina]", timeout=9000)
        page.wait_for_timeout(1300)
        # una pista a la vista (la de la regadera de la granja, o una de prueba) y se abre un menú: la pista se va
        page.evaluate("""() => { if (document.querySelector('.g-hint')) return; const el = document.querySelector('.fm-it[data-fid=vaca]') || document.querySelector('.fm-it[data-fid]');
          window.__h = G.hint(el, {id: 'arreglos-' + Date.now(), text: 'Mantén pulsado', gesture: 'hold', max: 9, delay: 0}); }""")
        page.wait_for_timeout(400)
        if not page.evaluate("() => !!document.querySelector('.g-hint')"):
            probs.append("no se pudo enseñar una pista en la granja")
        page.evaluate("""() => { const el = document.querySelector('.fm-it[data-fid=gallina]');
          vocabMenu.open(el, {title: 'hen', items: [{id: 'a', t: 'Oír', ic: 'speaker-high', fn: () => {}}]}); }""")
        page.wait_for_timeout(500)
        if page.evaluate("() => !!document.querySelector('.g-hint')"):
            probs.append("la pista sigue a la vista con el menú abierto")
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
        A._hold(page, ".fm-it[data-fid=gallina]")
        m = page.evaluate("() => { const d = document.querySelector('dialog.vm'); return d ? {nr: d.hasAttribute('data-no-renew')} : null; }")
        if not m or not m["nr"]:
            probs.append(f"el menú de la granja sin data-no-renew: {m}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_navmotion_cazador_up_and_title_collapse_on_pushed():
    """Ir de Juegos al cazador es una transición «up» (como las demás pantallas de foco). En #/cuentos (pantalla empujada,
    con ‹), al bajar, el título grande se pliega en la barra de arriba (html[data-tcol])."""
    probs = []
    page = C.new_page("phone", viewport={"width": 360, "height": 600})
    try:
        C.seed(page, hash="#/juegos")
        page.wait_for_timeout(300)
        k = page.evaluate("() => vocabNavMotion.kind('juegos', 'cazador')")
        if k != "up":
            probs.append(f"Juegos → cazador: {k!r}")
        C.goto(page, "#/cuentos")
        page.wait_for_selector("#st-grid .st-cv", timeout=8000)
        page.wait_for_timeout(300)
        t0 = page.evaluate("() => document.documentElement.hasAttribute('data-tcol')")
        page.evaluate("() => window.scrollTo(0, document.scrollingElement.scrollHeight)")
        page.wait_for_timeout(300)
        t1 = page.evaluate("() => ({on: document.documentElement.hasAttribute('data-tcol'), back: document.documentElement.hasAttribute('data-back')})")
        if t0 or not t1["on"]:
            probs.append(f"#/cuentos: plegado arriba {t0}, al bajar {t1}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- cazador
def test_hunter_save_switch_tap_words_and_casa_delete():
    """Con «Guardar fotos al cazar» apagado, la frase de entrada lo dice y encontrar un color no guarda nada. Tocando,
    cada dibujo lleva la palabra en el idioma, su IPA y el español pequeño, y todo cabe sin scroll a 360×740 y 390×844
    (dibujos ≥ 110 px). En Mi casa, mantener pulsada una foto abre su menú; «Borrar esta foto» la borra y «Deshacer» la
    devuelve."""
    probs = []
    page = HN._page()
    try:
        HN._open(page)
        page.evaluate("() => vocabHunter.setSave(false)")
        C.goto(page, "#/juegos")
        C.goto(page, "#/cazador")
        page.wait_for_selector("#hn-start", timeout=6000)
        p = page.locator(".hn-in-p").text_content()
        if "Nada sale del aparato" not in p:
            probs.append(f"frase con el guardado apagado: {p!r}")
        HN._start(page)
        HN._find(page)
        page.wait_for_function("() => window.__found.length === 1", timeout=5000)
        page.wait_for_timeout(400)
        n = len([r for r in page.evaluate(HN._IDB) if r.get("src") == "hunt"])
        if n:
            probs.append(f"con el guardado apagado se guardaron {n} fotos")
        page.evaluate("() => vocabHunter.setSave(true)")
        probs += C.errors(page)
    finally:
        page.context.close()
    for w, h in ((360, 740), (390, 844)):
        page = HN._page(viewport={"width": w, "height": h})
        try:
            HN._open(page, hash="#/juegos")
            C.goto(page, "#/cazador")
            page.wait_for_selector("#hn-tap0", timeout=6000)
            page.locator("#hn-tap0").click()
            page.wait_for_selector(".hn-opt .hn-opt-es", timeout=5000)
            page.wait_for_function("() => [...document.querySelectorAll('.hn-opt img')].every(i => i.complete && i.naturalWidth > 0)", timeout=8000)
            page.wait_for_timeout(300)
            r = page.evaluate("""() => ({sh: document.scrollingElement.scrollHeight, ih: innerHeight,
              opts: [...document.querySelectorAll('.hn-opt')].map(o => { const i = o.querySelector('img'), b = i.getBoundingClientRect(), k = Math.min(b.width / (i.naturalWidth || 1), b.height / (i.naturalHeight || 1));
                return {t: (o.querySelector('.hn-opt-t') || {}).textContent || '', lang: (o.querySelector('.hn-opt-t') || {}).lang || '',
                  ipa: ((o.querySelector('.ipa') || {}).textContent || '').replace(/IPA: |\\u2060/g, ''), es: (o.querySelector('.hn-opt-es') || {}).textContent || '',
                  img: Math.round(Math.min(i.naturalWidth * k, i.naturalHeight * k))}; })})""")
            if r["sh"] > r["ih"]:
                probs.append(f"{w}×{h} tocando hace scroll: {r['sh']} > {r['ih']}")
            for o in r["opts"]:
                if o["lang"] != "en-GB" or not IPA_RE.match(o["ipa"]) or not o["es"] or o["img"] < 110:
                    probs.append(f"{w}×{h} dibujo: {o}")
            probs += [f"{w}×{h}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    page = HN._page()
    try:
        HN._open(page)
        page.evaluate("""async () => { const buf = new Uint8Array(10).buffer;
          for (let i = 0; i < 2; i++) await vocabMedia.put({id: 'hunt-t' + i, kind: 'photo', src: 'hunt', t: 1000 + i, type: 'image/jpeg', w: 192, h: 192, buf, color: 'red', lang: 'en', day: '2026-01-01'}); }""")
        C.goto(page, "#/album/casa")
        page.wait_for_selector("#hn-cg .hn-cc", timeout=6000)
        page.wait_for_timeout(300)
        A._hold(page, "#hn-cg .hn-cc")
        if not page.evaluate("() => !!document.querySelector('dialog.vm')"):
            probs.append("mantener pulsada una foto de Mi casa no abre su menú")
        else:
            A._pick(page, "Borrar esta foto")
            page.wait_for_function("() => document.querySelectorAll('#hn-cg .hn-cc').length === 1", timeout=4000)
            page.locator("button", has_text="Deshacer").first.click()
            page.wait_for_function("() => document.querySelectorAll('#hn-cg .hn-cc').length === 2", timeout=4000)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- loro
def test_parrot_live_waves_quiet_hint_and_persist():
    """Mientras graba, «Tu voz» pinta barras en vivo (data-live) en el lienzo; con el micrófono en silencio, tras 1 s
    sale en gris «Habla un poco más fuerte» y sigue grabando. vocabMedia.persist() no pide nada si ya está guardado para
    siempre (persisted() = true) ni en Firefox; si no, lo pide una vez."""
    probs = []
    page = LR._page()
    try:
        LR._seed(page)
        LR._to_loro(page)
        page.locator("#lr-rb").click()
        page.wait_for_function("() => vocabParrot.state.st === 'rec'", timeout=5000)
        page.wait_for_timeout(450)
        a = page.evaluate("() => { const c = document.getElementById('lr-cv-me'); return {live: c.dataset.live || '', bars: +c.dataset.bars || 0}; }")
        px = page.evaluate(LR._PAINT, "lr-cv-me")
        if a["live"] != "1" or a["bars"] < 3 or px < 30:
            probs.append(f"sin barras en vivo: {a}, píxeles {px}")
        page.wait_for_function("() => vocabParrot.state.st === 'done'", timeout=12000)
        if page.evaluate("() => document.getElementById('lr-cv-me').dataset.live"):
            probs.append("al acabar sigue el dibujo en vivo")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = LR._page(wav="silent")
    try:
        LR._seed(page)
        LR._to_loro(page)
        page.locator("#lr-rb").click()
        page.wait_for_function("() => vocabParrot.state.st === 'rec'", timeout=5000)
        page.wait_for_timeout(1400)
        q = page.evaluate("() => { const r = document.getElementById('lr-rl'); return {t: r.textContent, low: r.classList.contains('is-low'), st: vocabParrot.state.st, c: getComputedStyle(r).color}; }")
        if q["t"] != "Habla un poco más fuerte" or not q["low"] or q["st"] != "rec":
            probs.append(f"en silencio: {q}")
        page.locator("#lr-rb").click()
        page.wait_for_function("() => vocabParrot.state.st === 'done'", timeout=12000)
        probs += C.errors(page)
    finally:
        page.context.close()
    for tag, script, ua, want in (("ya guardado", "true", None, 0), ("sin guardar", "false", None, 1),
                                  ("Firefox", "false", "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0", 0)):
        kw = {"user_agent": ua} if ua else {}
        page = C.new_page("phone", **kw)
        try:
            page.context.add_init_script("(() => { window.__persist = 0; try { const s = navigator.storage;"
                                         " s.persist = () => { window.__persist++; return Promise.resolve(true); };"
                                         f" s.persisted = () => Promise.resolve({script}); }} catch (e) {{}} }})();")
            C.seed(page, hash="#/juegos")
            page.wait_for_timeout(300)
            page.evaluate("() => { window.__persist = 0; }")
            page.evaluate("() => vocabMedia.persist()")
            page.wait_for_timeout(100)
            n = page.evaluate("() => window.__persist")
            if n != want:
                probs.append(f"persist() {tag}: lo pidió {n} veces")
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)
