"""F3 entero (integración): js/lesson.js, js/review.js y js/learn.js juntos sobre la app de F2.

Los tres módulos cargan detrás del script principal, de js/motion.js y de js/gestures.js (y antes del primer route(),
que va en DOMContentLoaded); sw.js sube de versión (17 o más, con OFF_SHELL igual) y los lleva en SHELL. Cada ruta de
F3 se pinta igual abierta por enlace directo, al recargar y navegando con las pestañas y los segmentos. Recorridos con
la partida sembrada: Hoy › Empezar (lección) › terminar › «Siguiente lección»; Hoy › Repasar › terminar › «Seguir» vuelve
a Hoy; Aprender › Palabras › ficha › Preguntas; Gramática › Practicar; «Salir» a media lección deja seguir con el
accesorio «Seguir · Lección N» (plan-doc §Lección); y el cambio de idioma (francés y danés) en cada pantalla de Aprender.
Sin errores de consola, y la partida exportada igual que la de la base tras recorrerlo todo sin jugar."""
from __future__ import annotations

import json
import re

import common as C
import routes as R
import test_f3_leccion as L

_PLAN = C.seed_plan()
_MODS = ["js/lesson.js", "js/review.js", "js/learn.js"]
_FOCUS = "() => document.documentElement.dataset.focus || ''"
_ROUTE_N = "() => window.__vocabRouteN || 0"
_FAKE_AUDIO = """() => { window.sayP = (t, b) => new Promise(r => setTimeout(r, 120)); }"""


def _keys_due(n):
    """La partida sembrada con solo n palabras pendientes hoy (las demás pendientes pasan a dentro de 3 días): así la
    tarjeta de Hoy es la lección siguiente y sale la fila «Repasar n»."""
    data = C.seed_data()
    today = C.day_num(C.FIXED_NOW)
    srs = data["srs:english"]
    due = sorted(k for k, v in srs.items() if v["due"] <= today)
    for k in due[n:]:
        srs[k]["due"] = today + 3
    keys = C.seed_keys()
    keys["srs:english"] = json.dumps(srs, ensure_ascii=False, separators=(",", ":"))
    return keys


def _wait_hash(page, h, timeout=8000):
    page.wait_for_function("h => location.hash.replace(/^#\\/?/, '') === h", arg=h, timeout=timeout)


def _wait_route(page, n0, timeout=8000):
    page.wait_for_function("n => (window.__vocabRouteN || 0) > n", arg=n0, timeout=timeout)
    C.settle(page, quiet_ms=200)


def _click_nav(page, sel):
    n0 = page.evaluate(_ROUTE_N)
    page.locator(sel).first.click()
    _wait_route(page, n0)


def _set_lang(page, k, via_menu=True):
    """Cambia el idioma con el menú de la bandera (o con setLang si la barra no se ve, como en el modo foco)."""
    n0 = page.evaluate(_ROUTE_N)
    if via_menu and page.locator("#lang-b").is_visible():
        page.locator("#lang-b").click()
        page.wait_for_selector(f'#lang-m:not([hidden]) .lm-i[data-lang="{k}"]', timeout=3000)
        page.locator(f'#lang-m .lm-i[data-lang="{k}"]').click()
    else:
        page.evaluate("k => setLang(k)", k)
    _wait_route(page, n0)
    page.wait_for_timeout(250)


# ---------------------------------------------------------------- carga y sw.js
def test_modules_load_order_and_sw():
    """index.html carga js/lesson.js, js/review.js y js/learn.js detrás del script principal, de motion.js y de
    gestures.js, antes del primer route() (DOMContentLoaded); sw.js va por la versión 17 o más, con OFF_SHELL igual y
    los tres módulos en SHELL y en OFF_APP. En el navegador, sus rutas y APIs están listas al primer route()."""
    probs = []
    html = (C.REPO / "index.html").read_text(encoding="utf-8")
    sw = (C.REPO / "sw.js").read_text(encoding="utf-8")
    tags = re.findall(r'<script src="([^"]+)"></script>', html)
    main_end = html.find("</script>", html.find("async function route("))
    for m in _MODS:
        if m not in tags:
            probs.append(f"index.html no carga {m}")
            continue
        pos = html.find(f'<script src="{m}">')
        if pos < main_end:
            probs.append(f"{m} carga antes que el script principal (route, ROUTES, store…)")
        for dep in ("js/motion.js", "js/gestures.js"):
            if dep in tags and tags.index(dep) > tags.index(m):
                probs.append(f"{m} carga antes que {dep}")
        if html.count(f'src="{m}"') != 1:
            probs.append(f"{m} se carga {html.count(f'src={chr(34)}{m}{chr(34)}')} veces")
    if "settings.js" in " ".join(tags) and "js/review.js" in tags and tags.index("js/review.js") < tags.index("js/settings.js"):
        probs.append("js/review.js carga antes que js/settings.js")
    if 'document.addEventListener("DOMContentLoaded"' not in html or "route(); });" not in html:
        probs.append("el primer route() ya no va en DOMContentLoaded")
    v = int(re.search(r"const VERSION = (\d+);", sw).group(1))
    if v < 17:
        probs.append(f"sw.js sigue en la versión {v} (F3 sube a 17 o más)")
    if f'OFF_SHELL = "vocab-shell-v{v}"' not in html:
        probs.append(f"OFF_SHELL de index.html no es vocab-shell-v{v}")
    shell = re.findall(r'"([^"]+)"', re.search(r"const SHELL = \[(.*?)\];", sw, re.S).group(1))
    off = re.findall(r'"([^"]+)"', re.search(r"const OFF_APP = \[(.*?)\];", html, re.S).group(1))
    for m in _MODS:
        if m not in shell:
            probs.append(f"falta {m} en SHELL de sw.js")
        if m not in off:
            probs.append(f"falta {m} en OFF_APP de index.html")
    page = C.new_page("phone")
    try:
        page.add_init_script("""document.addEventListener('DOMContentLoaded', () => { window.__atBoot = {
            leccion: typeof window.leccion, lesson: typeof window.vocabLesson, review: typeof window.vocabReview, learn: typeof window.vocabLearn,
            routes: typeof ROUTES === 'object' && ROUTES ? Object.keys(ROUTES).sort() : [], G: typeof window.G, M: typeof window.M}; }, {capture: true});""")
        C.seed(page, hash="#/leccion/" + R.LESSON)
        boot = page.evaluate("window.__atBoot")
        if not boot:
            probs.append("no se pudo ver el estado al arrancar")
        else:
            for k in ("leccion", "lesson", "review", "learn", "G", "M"):
                if boot[k] not in ("function", "object"):
                    probs.append(f"al primer route() falta {k}: {boot[k]}")
            for r in ("repaso", "mapa", "palabras", "doc", "gramatica"):
                if r not in boot["routes"]:
                    probs.append(f"al primer route() falta ROUTES.{r}: {boot['routes']}")
        for css in ("css-lesson", "css-review", "css-learn"):
            if page.locator(f"style#{css}").count() != 1:
                probs.append(f"<style id={css}> está {page.locator(f'style#{css}').count()} veces")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- rutas: enlace directo, recarga y navegación
_F3_ROUTES = [
    # (hash, lo que tiene que verse, modo foco, pestaña, segmento seleccionado)
    ("#/leccion/" + R.LESSON, ".ls .ls-learn", "leccion", None, None),
    ("#/leccion/" + R.GRAM_LESSON, ".ls .ls-theory", "leccion", None, None),
    ("#/repaso", "#rv-card", "repaso", None, None),
    ("#/mapa", "#app .lvp-b", "", "aprender", "Camino"),
    ("#/mapa/A2", "#app .lvp-b", "", "aprender", "Camino"),
    ("#/palabras", "#wl", "", "aprender", "Palabras"),
    ("#/doc/" + R.TOPIC, "#dv .dv-seg", "", "aprender", None),
    ("#/doc/" + R.TOPIC_3000, "#dv .dv-seg", "", "aprender", None),
    ("#/gramatica", "#gr", "", "aprender", "Gramática"),
    ("#/gramatica/A1", "#gr", "", "aprender", "Gramática"),
]
_LOOK = """() => { const t = document.querySelector('.tabbar [role=tab][aria-selected=true]'), s = document.querySelector('#tabhead .seg-i[aria-selected=true]');
  const vis = el => !!el && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  return {focus: document.documentElement.dataset.focus || '', tab: t && t.dataset.nav, seg: vis(s) ? s.textContent.replace(/\\d+/g, '').trim() : null,
    lvp: (document.querySelector('#app .lvp-b') || {}).textContent, fx: vis(document.getElementById('fx-x')), tabbar: vis(document.getElementById('tabbar')),
    title: document.title}; }"""


def _check_route(page, h, sel, focus, tab, seg, how, probs):
    try:
        page.wait_for_selector(sel, timeout=8000)
    except Exception:
        probs.append(f"{how} {h}: no se ve {sel} ({C.current_hash(page)})")
        return
    page.wait_for_timeout(200)
    st = page.evaluate(_LOOK)
    if st["focus"] != focus:
        probs.append(f"{how} {h}: modo foco «{st['focus']}» (se esperaba «{focus}»)")
    if focus and (not st["fx"] or st["tabbar"]):
        probs.append(f"{how} {h}: en modo foco tiene que verse la ✕ y no la barra de pestañas: {st}")
    if tab and st["tab"] != tab:
        probs.append(f"{how} {h}: pestaña {st['tab']} (se esperaba {tab})")
    if seg and st["seg"] != seg:
        probs.append(f"{how} {h}: segmento «{st['seg']}» (se esperaba «{seg}»)")
    if h.startswith("#/mapa/") and (st["lvp"] or "").strip() != h.split("/")[-1]:
        probs.append(f"{how} {h}: la pastilla de nivel dice «{st['lvp']}»")
    if C.current_hash(page) != h[2:]:
        probs.append(f"{how} {h}: acaba en #/{C.current_hash(page)}")


def test_f3_routes_direct_reload_and_navigation():
    """Cada ruta de F3 (lección, gramática, repaso, Camino con y sin nivel, Palabras, dos fichas y Gramática con y sin
    nivel) se pinta bien abierta desde cero (enlace directo), al recargar y entrando con la pestaña y los segmentos o
    desde la pantalla de antes; con el modo foco y la pestaña y el segmento que tocan. Sin errores."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        for h, sel, focus, tab, seg in _F3_ROUTES:
            C.goto(page, h, reload=True)
            _check_route(page, h, sel, focus, tab, seg, "enlace directo", probs)
            C.reload(page)
            _check_route(page, h, sel, focus, tab, seg, "recarga", probs)
        # navegando: Hoy › Aprender › cada segmento, una ficha, una lección del camino y la práctica de gramática
        C.goto(page, "", reload=True)
        _click_nav(page, "#tab-aprender")
        for name, h, sel in (("Camino", "#/mapa", "#app .lvp-b"), ("Palabras", "#/palabras", "#wl"),
                             ("Gramática", "#/gramatica", "#gr"), ("Repasar", "#/repaso", "#rv-card")):
            if C.current_hash(page) == h[2:]:
                continue
            if page.locator(f'#tabhead .seg-i[href="{h}"]').count():
                _click_nav(page, f'#tabhead .seg-i[href="{h}"]')
            else:
                probs.append(f"no hay segmento «{name}» ({h})")
                continue
            _check_route(page, h, sel, "repaso" if h == "#/repaso" else "", "aprender", None if h == "#/repaso" else name, "navegando", probs)
            if h == "#/repaso":
                # el repaso pregunta al salir con la ✕: «Salir» lo deja abierto y vuelve
                page.locator("#fx-x").click()
                page.wait_for_selector("dialog#rv-pause[open] #rv-pz-out", timeout=3000)
                n0 = page.evaluate(_ROUTE_N)
                page.locator("#rv-pz-out").click()
                _wait_route(page, n0)
        C.goto(page, "#/palabras")
        _click_nav(page, f'#wl a[href="#/doc/{R.TOPIC}"]')
        _check_route(page, "#/doc/" + R.TOPIC, "#dv .dv-seg", "", "aprender", None, "navegando", probs)
        C.goto(page, "#/mapa/A1")
        page.locator(f'.node[data-ls="{R.LESSON}"]').scroll_into_view_if_needed()
        _click_nav(page, f'.node[data-ls="{R.LESSON}"]')
        _check_route(page, "#/leccion/" + R.LESSON, ".ls .ls-learn", "leccion", None, None, "navegando", probs)
        C.goto(page, "#/gramatica/A1")
        page.locator('#gr details.gr-u[data-k="1"] > summary').click()
        _click_nav(page, f'#gr a[href="#/leccion/{R.GRAM_LESSON}"]')
        _check_route(page, "#/leccion/" + R.GRAM_LESSON, ".ls .ls-theory", "leccion", None, None, "navegando", probs)
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- recorridos con la partida sembrada
def test_hoy_lesson_end_and_next_lesson():
    """Hoy › «Empezar» (la lección siguiente) › contestar hasta el final › fin de lección (estrellas, «+N», monedas una
    vez, el camino guardado) › «Siguiente lección» abre la de después en modo foco, con la ✕ que vuelve a Hoy."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page, keys=_keys_due(6))
        st = page.evaluate("""() => ({kind: (document.getElementById('hm-go') || {}).dataset?.kind, href: document.getElementById('hm-go')?.getAttribute('href'),
            rev: !!document.getElementById('hm-rev')})""")
        if st["kind"] != "leccion" or st["href"] != "#/leccion/" + R.LESSON or not st["rev"]:
            probs.append(f"Hoy con 6 pendientes: la tarjeta no es la lección {R.LESSON} con la fila «Repasar»: {st}")
        coins0 = page.evaluate("JSON.parse(localStorage.getItem('game')).coins")
        _click_nav(page, "#hm-go")
        page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-page')", timeout=8000)
        page.evaluate(_FAKE_AUDIO)
        if page.evaluate(_FOCUS) != "leccion":
            probs.append("la lección no va en modo foco")
        L._play(page, auto=False)
        page.wait_for_selector(".ls-end #ls-next", timeout=6000)
        page.wait_for_timeout(900)
        end = page.evaluate("""() => ({stars: document.querySelectorAll('.ls-end .ls-star.got').length, on: document.querySelectorAll('.ls-end .ls-star.on').length,
            plus: document.querySelector('#ls-plus span').textContent, next: document.getElementById('ls-next').getAttribute('href'),
            rep: !!document.getElementById('ls-rep'), tmr: document.querySelector('.ls-end .ls-tmr').textContent,
            map: JSON.parse(localStorage.getItem('map:english')), coins: JSON.parse(localStorage.getItem('game')).coins,
            saved: sessionStorage.getItem('vocab:ls'), fx: document.getElementById('fx-x').getAttribute('href')})""")
        seq = [x["id"] for x in C.lesson_sequence()]
        nxt = seq[seq.index(R.LESSON) + 1]
        if end["stars"] != 3 or end["on"] != 3:
            probs.append(f"todo bien a la primera y no hay 3 estrellas encendidas: {end}")
        if end["plus"] != "+25" or end["coins"] != coins0 + 25:
            probs.append(f"monedas del final: «{end['plus']}», {coins0} → {end['coins']} (se esperaba +25)")
        if end["map"].get(R.LESSON) != 3:
            probs.append(f"el camino no guarda {R.LESSON} con 3 estrellas: {end['map'].get(R.LESSON)}")
        if end["next"] != "#/leccion/" + nxt or not end["rep"]:
            probs.append(f"«Siguiente lección» no va a {nxt} o falta «Repetir»: {end}")
        if not end["tmr"].startswith("Mañana repasas"):
            probs.append(f"falta «Mañana repasas N palabras»: «{end['tmr']}»")
        if end["saved"]:
            probs.append("al terminar sigue guardada la lección en vocab:ls")
        _click_nav(page, "#ls-next")
        page.wait_for_function("id => window.vocabLesson && vocabLesson.state && vocabLesson.state.id === id && document.querySelector('.ls .ls-stage .ls-page')",
                               arg=nxt, timeout=8000)
        if C.current_hash(page) != "leccion/" + nxt or page.evaluate(_FOCUS) != "leccion":
            probs.append(f"«Siguiente lección» acaba en #/{C.current_hash(page)} (foco «{page.evaluate(_FOCUS)}»)")
        if page.locator("#fx-x").get_attribute("href") != "#/":
            probs.append(f"la ✕ de la siguiente lección no vuelve a Hoy: {page.locator('#fx-x').get_attribute('href')}")
        coins1 = page.evaluate("JSON.parse(localStorage.getItem('game')).coins")
        if coins1 != end["coins"]:
            probs.append(f"las monedas cambian al abrir la siguiente lección: {end['coins']} → {coins1}")
        # la ✕ en la primera tarjeta (nada hecho) sale sin preguntar a Hoy, y Hoy ofrece ya la lección de después
        n0 = page.evaluate(_ROUTE_N)
        page.locator("#fx-x").click()
        _wait_route(page, n0)
        if C.current_hash(page) != "":
            probs.append(f"la ✕ sin nada hecho no vuelve a Hoy: #/{C.current_hash(page)}")
        href = page.locator("#hm-go").get_attribute("href")
        if href != "#/leccion/" + nxt:
            probs.append(f"Hoy no ofrece la lección siguiente ({nxt}) tras terminar {R.LESSON}: {href}")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_hoy_review_row_to_end_and_back_home():
    """Hoy › «Repasar 6» › girar y «¡Sí!» en cada tarjeta › final («¡Repasaste 6 palabras!», monedas pagadas una vez)
    › «Seguir» vuelve a Hoy, sin modo foco y sin la fila «Repasar». Con 12 pendientes (la partida sembrada), la tarjeta de
    Hoy es el repaso y su «Empezar» entra directo a la primera tarjeta."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        if page.locator("#hm-go").get_attribute("data-kind") != "repaso":
            probs.append(f"con 12 pendientes la tarjeta de Hoy no es el repaso: {page.locator('#hm-go').get_attribute('data-kind')}")
        else:
            _click_nav(page, "#hm-go")
            page.wait_for_selector("#rv-card", timeout=8000)
            if page.evaluate(_FOCUS) != "repaso":
                probs.append("«Empezar» del repaso no entra en modo foco")
        C.seed(page, keys=_keys_due(6))
        coins0 = page.evaluate("JSON.parse(localStorage.getItem('game')).coins")
        _click_nav(page, "#hm-rev")
        page.wait_for_selector("#rv-card", timeout=8000)
        page.evaluate("""() => { window.__aw = []; const a0 = window.award; window.award = function(n, why, q, from){ window.__aw.push([n, why || '', !!q]); return a0.apply(this, arguments); }; }""")
        for k in range(20):
            st = page.evaluate("() => vocabReview.state")
            if not st or st.get("end"):
                break
            page.locator("#rv-card").click()
            page.wait_for_function("() => { const c = document.getElementById('rv-card'); return c && c.classList.contains('is-flipped'); }", timeout=5000)
            page.wait_for_timeout(120)
            page.locator(".rv-yes").click()
            page.wait_for_function("i0 => { const s = vocabReview.state; return !s || s.end || s.i > i0; }", arg=st["i"], timeout=6000)
            page.wait_for_timeout(450)
        page.wait_for_selector("#rv-end #rv-end-go", timeout=6000)
        page.wait_for_timeout(900)
        end = page.evaluate("""() => ({t: document.getElementById('rv-end').textContent.replace(/\\s+/g, ' '), aw: window.__aw,
            coins: JSON.parse(localStorage.getItem('game')).coins, due: dueList().length})""")
        if "Repasaste 6 palabras" not in end["t"]:
            probs.append(f"el final no dice «¡Repasaste 6 palabras!»: {end['t'][:120]}")
        tens = [a for a in end["aw"] if a[0] == 10]
        if len(tens) != 1:
            probs.append(f"el premio del final no se paga una vez: {end['aw']}")
        if end["coins"] != coins0 + sum(a[0] for a in end["aw"]):
            probs.append(f"monedas: {coins0} → {end['coins']} con {end['aw']}")
        if end["due"] != 0:
            probs.append(f"quedan {end['due']} pendientes tras repasar todo")
        _click_nav(page, "#rv-end-go")
        if C.current_hash(page) != "" or page.evaluate(_FOCUS):
            probs.append(f"«Seguir» no vuelve a Hoy sin modo foco: #/{C.current_hash(page)} foco «{page.evaluate(_FOCUS)}»")
        if page.locator("#hm-rev").count():
            probs.append("Hoy sigue mostrando «Repasar» sin pendientes")
        if page.locator("#acc:not([hidden])").count() and page.locator("#acc").is_visible():
            probs.append("el accesorio «Seguir» sale tras terminar el repaso")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_words_topic_questions_and_grammar_practice():
    """Aprender › Palabras › «Animales» › Preguntas: se contesta una (srsGrade como siempre, fallo en gris o acierto en
    verde) y «Seguir»; después Aprender › Gramática › una unidad › «Practicar» abre la práctica G-… con la regla y,
    tras «Practicar», una frase con hueco y 4 opciones."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        _click_nav(page, "#tab-aprender")
        if C.current_hash(page) != "palabras":
            _click_nav(page, '#tabhead .seg-i[href="#/palabras"]')
        _click_nav(page, f'#wl a[href="#/doc/{R.TOPIC}"]')
        page.wait_for_selector("#dv-tab-test", timeout=6000)
        if page.locator("#dv-tab-tarjetas").get_attribute("aria-selected") != "true":
            probs.append("la ficha no abre en Tarjetas")
        page.locator("#dv-tab-test").click()
        page.wait_for_selector("#view .qz-opt", timeout=5000)
        srs0 = page.evaluate("localStorage.getItem('srs:english')")
        page.locator("#view .qz-opt").first.click()
        page.wait_for_selector("#nextq:not([hidden])", timeout=3000)
        q = page.evaluate("""() => ({ok: document.querySelectorAll('#view .qz-opt.is-ok').length, miss: document.querySelectorAll('#view .qz-opt.is-miss').length,
            fb: document.getElementById('qz-fb').textContent, srs: localStorage.getItem('srs:english'),
            missBg: (() => { const m = document.querySelector('#view .qz-opt.is-miss'); return m ? getComputedStyle(m).backgroundColor : null; })()})""")
        if q["ok"] != 1 or q["miss"] > 1 or not q["fb"]:
            probs.append(f"Preguntas: tras contestar no se ve la buena en verde (y la elegida en gris): {q}")
        if q["missBg"]:
            m = re.findall(r"\d+", q["missBg"])[:3]
            if m and max(map(int, m)) - min(map(int, m)) > 24:
                probs.append(f"el fallo de Preguntas no es gris: {q['missBg']}")
        if q["srs"] == srs0:
            probs.append("Preguntas no escribe en srs:english")
        page.locator("#nextq").click()
        page.wait_for_function("() => document.querySelector('#view .qz-n') && document.querySelector('#view .qz-n').textContent.startsWith('2/')", timeout=3000)
        # Gramática › Practicar
        _click_nav(page, "#tab-aprender")
        if C.current_hash(page) != "gramatica" and not C.current_hash(page).startswith("gramatica/"):
            _click_nav(page, '#tabhead .seg-i[href="#/gramatica"]')
        page.wait_for_selector("#gr details.gr-u", timeout=6000)
        k = page.evaluate("() => [...document.querySelectorAll('#gr details.gr-u')].findIndex(d => !d.classList.contains('is-done'))")
        page.locator(f'#gr details.gr-u[data-k="{k}"] > summary').click()
        page.wait_for_timeout(250)
        go = page.locator(f'#gr details.gr-u[data-k="{k}"] .gr-go a')
        href = go.get_attribute("href")
        if href != "#/leccion/" + R.GRAM_LESSON:
            probs.append(f"«Practicar» de la primera unidad sin hacer va a {href} (se esperaba #/leccion/{R.GRAM_LESSON})")
        n0 = page.evaluate(_ROUTE_N)
        go.click()
        _wait_route(page, n0)
        page.wait_for_selector(".ls .ls-theory", timeout=8000)
        if page.locator("#ls-go").inner_text().strip() != "Practicar":
            probs.append(f"la regla no tiene «Practicar»: «{page.locator('#ls-go').inner_text()}»")
        page.locator("#ls-go").click()
        page.wait_for_selector(".ls-stage > .ls-page:not(.ls-ghost) .ls-gq .ls-gap", timeout=5000)
        n_opts = page.locator(".ls-stage > .ls-page:not(.ls-ghost) .ls-opt").count()
        if n_opts < 2:
            probs.append(f"la práctica de gramática tiene {n_opts} opciones")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_salir_keeps_lesson_for_the_seguir_capsule():
    """plan-doc §Lección: «si sale puede seguir donde estaba con la cápsula Seguir». Empezar desde el Camino, hacer 3
    pasos, ✕ › «Salir» vuelve al Camino con «Seguir · Lección N» (con su anillo); tocarla abre la lección en el mismo
    paso; Hoy ofrece «Seguir» (¡Ya la empezaste!) sin repetir la cápsula. Terminar la lección la borra."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page, keys=_keys_due(6))
        C.goto(page, "#/mapa/A1")
        page.locator(f'.node[data-ls="{R.LESSON}"]').scroll_into_view_if_needed()
        _click_nav(page, f'.node[data-ls="{R.LESSON}"]')
        page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls .ls-learn')", timeout=8000)
        page.evaluate(_FAKE_AUDIO)
        for _ in range(3):
            L._go(page)
        i0 = page.evaluate(L._ST)["i"]
        page.locator("#fx-x").click()
        page.wait_for_selector("dialog#ls-pause[open] #ls-pz-out", timeout=3000)
        n0 = page.evaluate(_ROUTE_N)
        page.locator("#ls-pz-out").click()
        _wait_route(page, n0)
        if not C.current_hash(page).startswith("mapa"):
            probs.append(f"«Salir» no vuelve al Camino: #/{C.current_hash(page)}")
        sv = page.evaluate(L._SAVED)
        if not sv or sv.get("id") != R.LESSON or sv.get("i") != i0:
            probs.append(f"«Salir» no deja la lección guardada para seguir: {sv}")
        page.wait_for_timeout(300)
        acc = page.evaluate("""() => { const a = document.getElementById('acc'); return a ? {vis: !!a.getClientRects().length && !a.hidden,
            t: a.textContent.replace(/\\s+/g, ' ').trim(), href: a.getAttribute('href')} : null; }""")
        k = page.evaluate("async id => { await getMap(); return lvLessons(id.slice(0, 2)).findIndex(l => l.id === id) + 1; }", R.LESSON)
        if not acc or not acc["vis"] or f"Lección {k}" not in acc["t"] or acc["href"] != "#/leccion/" + R.LESSON:
            probs.append(f"no sale la cápsula «Seguir · Lección {k}» en el Camino: {acc}")
        _click_nav(page, "#acc")
        page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls .ls-stage .ls-page')", timeout=8000)
        st = page.evaluate(L._ST)
        if not st or st["i"] != i0:
            probs.append(f"la cápsula no sigue en el mismo paso: {st and st['i']} (se esperaba {i0})")
        # Hoy: la tarjeta ofrece «Seguir» y la cápsula no se repite
        page.locator("#fx-x").click()
        page.wait_for_selector("dialog#ls-pause[open] #ls-pz-out", timeout=3000)
        n0 = page.evaluate(_ROUTE_N)
        page.locator("#ls-pz-out").click()
        _wait_route(page, n0)
        C.goto(page, "")
        page.wait_for_timeout(300)
        hoy = page.evaluate("""() => ({btn: document.getElementById('hm-go').textContent.trim(), sub: (document.querySelector('.hm-sub') || {}).textContent,
            acc: (() => { const a = document.getElementById('acc'); return !!a && !a.hidden && !!a.getClientRects().length; })()})""")
        if "Seguir" not in hoy["btn"] or hoy["acc"]:
            probs.append(f"Hoy con la lección empezada: {hoy}")
        # terminarla la borra
        _click_nav(page, "#hm-go")
        page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls .ls-stage .ls-page')", timeout=8000)
        page.evaluate(_FAKE_AUDIO)
        L._play(page, auto=False)
        page.wait_for_selector(".ls-end", timeout=6000)
        if page.evaluate(L._SAVED):
            probs.append("terminar la lección no borra vocab:ls")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- respuestas enteras
# palabras de una respuesta partidas en dos líneas (o que se salen del botón)
_SPLIT = """sel => [...document.querySelectorAll(sel)].filter(t => t.getClientRects().length).map(t => {
  const r = document.createRange(); r.selectNodeContents(t);
  const tops = new Set([...r.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top)));
  return {t: t.textContent.trim(), lines: tops.size, words: t.textContent.trim().split(/[\\s-]+/).length, over: t.scrollWidth > t.clientWidth + 1,
    fs: getComputedStyle(t).fontSize}; }).filter(x => x.over || x.lines > x.words)"""


def test_answers_never_split_words():
    """Ninguna respuesta se parte a media palabra («grandmothe / r») ni se sale de su botón: en la lección de la familia
    (grandmother, granddaughter…) antes y después de contestar (la ✓ y la ✗ quitan sitio) y en Preguntas de la ficha, en
    el móvil con el texto normal y con «Texto más grande». Si una no cabe, las cuatro bajan de tamaño juntas; tras contestar,
    la ✓ o la ✗ van encima de la palabra (o sobre la esquina de la foto). Partir por un guion sí vale (mother-in-law)."""
    probs = []
    for big in (False, True):
        tag = "texto grande" if big else "texto normal"
        page = C.new_page("phone")
        try:
            keys = _keys_due(6)
            if big:
                keys["vocab:ui"] = json.dumps({"text": "large"})
            C.seed(page, keys=keys)
            C.goto(page, "#/leccion/" + R.LESSON)
            page.wait_for_selector(".ls .ls-learn", timeout=8000)
            page.evaluate(_FAKE_AUDIO)
            seen = 0
            for _ in range(60):
                st = page.evaluate(L._ST)
                if not st or st["ended"]:
                    break
                if st["t"] in (None, "learn"):
                    L._go(page)
                    continue
                bad = page.evaluate(_SPLIT, ".ls-stage > .ls-page:not(.ls-ghost) .ls-ot")
                if bad:
                    probs.append(f"{tag}, lección, antes de contestar: {bad}")
                L._pick(page, st["right"] if seen % 2 else L._wrong(page, st["right"]))
                page.wait_for_function("() => { const g = document.getElementById('ls-go'); return g && !g.hidden; }", timeout=3000)
                page.wait_for_timeout(120)
                bad = page.evaluate(_SPLIT, ".ls-stage > .ls-page:not(.ls-ghost) .ls-ot")
                if bad:
                    probs.append(f"{tag}, lección, tras contestar: {bad}")
                L._go(page)
                seen += 1
            if seen < 8:
                probs.append(f"{tag}: solo se vieron {seen} preguntas")
            # Preguntas de la ficha de la familia
            C.goto(page, "#/doc/familia")
            page.locator("#dv-tab-test").click()
            for _ in range(10):
                page.wait_for_selector("#view .qz-opt", timeout=4000)
                bad = page.evaluate(_SPLIT, "#view .qz-ot")
                if bad:
                    probs.append(f"{tag}, Preguntas: {bad}")
                page.locator("#view .qz-opt").first.click()
                page.wait_for_selector("#nextq:not([hidden])", timeout=3000)
                bad = page.evaluate(_SPLIT, "#view .qz-ot")
                if bad:
                    probs.append(f"{tag}, Preguntas tras contestar: {bad}")
                if page.locator("#nextq").inner_text().strip() != "Seguir":
                    break
                page.locator("#nextq").click()
            if C.errors(page):
                probs.append(f"{tag}: errores {C.errors(page)}")
        finally:
            page.context.close()
    assert not probs, "\n".join(probs[:20])


# ---------------------------------------------------------------- idiomas
_LANGS = [("français", "fr"), ("dansk", "da"), ("english", "en")]


def test_language_switch_on_learn_screens():
    """En Camino, Palabras, una ficha y Gramática, el menú de la bandera cambia a francés, a danés y vuelve a inglés:
    la pantalla se vuelve a pintar en ese idioma (el camino con su progreso, los temas que hay, la ficha o su «Pronto»,
    la gramática del idioma) sin errores. En el repaso (modo foco, sin bandera) un cambio de idioma cierra el repaso del
    idioma de antes y abre el del nuevo (o «Todo repasado»). En una lección, el cambio deja la lección (no se mezcla)."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        for h, sel in (("#/mapa", "#app .lvp-b"), ("#/palabras", "#wl"), ("#/doc/" + R.TOPIC, "#dv"), ("#/gramatica", "#gr")):
            C.goto(page, h)
            for k, code in _LANGS:
                _set_lang(page, k)
                try:
                    page.wait_for_selector(sel, timeout=6000)
                except Exception:
                    probs.append(f"{h} en {k}: no se ve {sel}")
                    continue
                st = page.evaluate("""() => ({lang, h: location.hash, txt: document.getElementById('app').textContent.replace(/\\s+/g, ' ').slice(0, 300),
                    chk: (document.querySelector('#lang-m .lm-i[aria-checked=true]') || {}).dataset?.lang,
                    langs: [...document.querySelectorAll('#app [lang]')].map(e => e.getAttribute('lang')).filter(l => l !== 'es')})""")
                if st["lang"] != k or st["chk"] != k:
                    probs.append(f"{h}: el idioma no cambia a {k}: {st['lang']} / menú {st['chk']}")
                if st["h"] != h:
                    probs.append(f"{h} en {k}: la ruta cambia a {st['h']}")
                wrong = [l for l in st["langs"] if not l.startswith(code)]
                if wrong:
                    probs.append(f"{h} en {k}: quedan textos en otro idioma (lang={sorted(set(wrong))})")
                if h == "#/mapa":
                    done = page.evaluate("() => document.querySelectorAll('.node.done').length")
                    want = {"fr": 2, "da": 0, "en": len([x for x in _PLAN['done'] if x.startswith('A1')]) + 1}[code]
                    if done != want:
                        probs.append(f"Camino en {k}: {done} nodos hechos (se esperaban {want})")
                if h == "#/gramatica" and code != "en":
                    if not page.locator("#gr details.gr-u").count() and "Pronto" not in st["txt"]:
                        probs.append(f"Gramática en {k}: ni unidades ni «Pronto»")
        # repaso en modo foco: setLang (la bandera no se ve)
        C.goto(page, "#/repaso")
        page.wait_for_selector("#rv-card", timeout=8000)
        for k, code in _LANGS:
            _set_lang(page, k, via_menu=False)
            page.wait_for_function("() => document.querySelector('#rv-card, #rv-empty, .rv-empty, #rv-end') || /Todo repasado/.test(document.getElementById('app').textContent)",
                                   timeout=6000)
            st = page.evaluate("""() => ({lang, st: window.vocabReview && vocabReview.state, card: !!document.getElementById('rv-card'),
                empty: /Todo repasado/.test(document.getElementById('app').textContent), focus: document.documentElement.dataset.focus || '',
                wl: [...document.querySelectorAll('#rv-card [lang]')].map(e => e.getAttribute('lang'))})""")
            if st["card"]:
                wrong = [l for l in st["wl"] if l != "es" and not l.startswith(code)]
                if wrong or not st["st"] or st["focus"] != "repaso":
                    probs.append(f"repaso en {k}: tarjeta de otro idioma o sin modo foco: {st}")
            elif not st["empty"]:
                probs.append(f"repaso en {k}: ni tarjeta ni «Todo repasado»: {st}")
        # lección: cambiar de idioma la deja
        C.goto(page, "#/leccion/" + R.LESSON)
        page.wait_for_selector(".ls .ls-learn", timeout=8000)
        page.evaluate(_FAKE_AUDIO)
        L._go(page)
        _set_lang(page, "français", via_menu=False)
        page.wait_for_timeout(400)
        st = page.evaluate("""() => ({h: location.hash, lang, ls: !!document.querySelector('.ls .ls-stage .ls-page'),
            words: [...document.querySelectorAll('.ls [lang]')].map(e => e.getAttribute('lang')), sv: sessionStorage.getItem('vocab:ls')})""")
        wrong = [l for l in st["words"] if l != "es" and not l.startswith("fr")]
        if wrong:
            probs.append(f"lección tras pasar a francés: quedan palabras en otro idioma: {st}")
        _set_lang(page, "english", via_menu=False)
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la partida
def test_f3_tour_keeps_export():
    """Una vuelta por todo F3 sin jugar (cada ruta, el menú de nivel abierto y cerrado, el vistazo de un nodo, las cuatro
    vistas de una ficha, una unidad de gramática desplegada, una lección y un repaso empezados y dejados con «Salir», y
    francés y danés de ida y vuelta) deja la exportación de la partida igual a tests/e2e/baseline/export.json."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        for h, sel, *_ in _F3_ROUTES:
            C.goto(page, h)
            page.wait_for_selector(sel, timeout=8000)
        C.goto(page, "#/mapa")
        page.locator("#app .lvp-b").click()
        page.wait_for_timeout(300)
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        page.evaluate("id => vocabLearn.peek(id)", R.DONE_LESSON)
        page.wait_for_timeout(500)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        C.goto(page, "#/doc/" + R.TOPIC)
        for m in ("lista", "tarjetas", "test", "practica", "tarjetas"):
            page.locator(f"#dv-tab-{m}").click()
            page.wait_for_timeout(250)
        C.goto(page, "#/gramatica/A1")
        page.locator('#gr details.gr-u[data-k="0"] > summary').click()
        page.wait_for_timeout(250)
        # lección empezada y dejada
        C.goto(page, "#/leccion/" + R.LESSON)
        page.wait_for_selector(".ls .ls-learn", timeout=8000)
        page.evaluate(_FAKE_AUDIO)
        L._go(page)
        page.locator("#fx-x").click()
        page.wait_for_selector("dialog#ls-pause[open] #ls-pz-out", timeout=3000)
        n0 = page.evaluate(_ROUTE_N)
        page.locator("#ls-pz-out").click()
        _wait_route(page, n0)
        # repaso abierto y dejado
        C.goto(page, "#/repaso")
        page.wait_for_selector("#rv-card", timeout=8000)
        page.locator("#rv-card").click()
        page.wait_for_timeout(500)
        page.locator("#fx-x").click()
        page.wait_for_selector("dialog#rv-pause[open] #rv-pz-out", timeout=3000)
        n0 = page.evaluate(_ROUTE_N)
        page.locator("#rv-pz-out").click()
        _wait_route(page, n0)
        C.goto(page, "#/palabras")
        for k, _ in _LANGS:
            _set_lang(page, k)
        # elegir un nivel en el Camino lo guarda en mapLv, como antes (#/mapa/A2 de la lista): se vuelve al de la partida
        C.goto(page, "#/mapa/A1")
        snap = C.export(page)
        diffs = C.diff_exports(C.load_baseline(), snap, allow_new=True)
        # el álbum guarda en su caché las pegatinas únicas al visitarlo (F2); el resto, igual
        diffs = [d for d in diffs if "album:uniq" not in d]
        if diffs:
            probs.append("la exportación cambia tras la vuelta por F3:\n  " + "\n  ".join(diffs[:12]))
        nk = C.new_keys(C.load_baseline(), snap)
        if nk:
            print("      claves nuevas:", nk)
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
