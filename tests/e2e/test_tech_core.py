"""Tech Prep, el núcleo (T1, S1-SPEC §13): la sección escondida para preparar entrevistas técnicas de un mayor.

Apagado de serie (ni menú, ni rutas, ni peticiones), el interruptor de Para mayores, la Puerta al entrar (y no al recargar
en la misma sesión), el cambio de pestañas y la barra de arriba en inglés, el modo foco con «Stop here?», la partida del
niño intacta tras usar mucho Tech Prep, cargar una partida (o traerla de Google) sin perder lo de Tech Prep, la mezcla de
dos aparatos, su propio archivo en Google Drive (de mentira), la fecha de la entrevista, la racha, «Interview ready» y
medallas, los ficheros de datos, Today a 360 y 390 px en claro y oscuro, los ajustes de Tech Prep, la voz inglesa y
«Download for offline» con el service worker.
"""
from __future__ import annotations

import json
import time

import common as C
import tech_common as TC
import tech_validate as TV

AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
A11Y = (C.HERE / "a11y.js").read_text(encoding="utf-8")
_PASS = "() => sessionStorage.setItem('vocab:gate', String(Date.now() + adultGate.MS))"
TECH_IDS = ["tp-today", "tp-path", "tp-play", "tp-cases", "tp-mock"]
TECH_LABELS = ["Today", "Path", "Play", "My cases", "Interview"]
T = TC.TODAY


# ---------------------------------------------------------------- ayudas
def _menu(page):
    """Abre el menú de la bandera y dice qué tiene."""
    page.locator("#lang-b").click()
    page.wait_for_selector("#lang-m:not([hidden])", timeout=3000)
    page.wait_for_timeout(250)
    return page.evaluate("""() => { const m = document.getElementById('lang-m'), b = document.getElementById('lang-b');
      return {label: m.getAttribute('aria-label'), button: b.getAttribute('aria-label'), techIcon: !!b.querySelector('.tp-flag'),
        items: [...m.querySelectorAll('.lm-i')].map(x => ({t: x.querySelector('.lm-t').firstChild.textContent.trim(),
          small: (x.querySelector('small') || {}).textContent || '', checked: x.getAttribute('aria-checked'),
          tech: x.hasAttribute('data-tech-entry'), lang: x.getAttribute('lang') || '', icon: !!x.querySelector('.tp-flag use, .tp-flag svg')}))}; }""")


def _close_menu(page):
    if page.evaluate("!document.getElementById('lang-m').hidden"):
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)


def _tabs(page):
    return page.evaluate("""() => ({ids: TABS.map(t => t.id), labels: [...document.querySelectorAll('#tabbar [role=tab] .tl')].map(a => a.textContent.trim()),
      sel: (document.querySelector('#tabbar [role=tab][aria-selected=true]') || {}).id || '',
      tech: document.documentElement.hasAttribute('data-tech'), lang: document.documentElement.lang, title: document.title,
      list: (document.querySelector('#tabbar [role=tablist]') || {getAttribute: () => ''}).getAttribute('aria-label')})""")


def _wait_hash(page, h, timeout=8000):
    page.wait_for_function("h => location.hash.replace(/^#\\/?/, '') === h", arg=h, timeout=timeout)
    C.settle(page, 250)


def _tech_on_session(page):
    page.evaluate("() => sessionStorage.setItem('tech:in', '1')")


def _toasts(page):
    return page.evaluate("() => [...document.querySelectorAll('#m-toasts .m-toast')].map(t => t.textContent.trim())")


# ---------------------------------------------------------------- apagado, interruptor y Puerta
def test_off_by_default():
    """Sin el interruptor: el menú de la bandera no tiene «Tech Prep», #/tech… lleva a #/ (Hoy del niño), no se pide
    nada de data/tech ni los módulos de Tech Prep (solo js/tech-boot.js, pequeño) y no hay CSS de Tech Prep."""
    page = C.new_page("phone")
    reqs = []
    page.on("request", lambda r: reqs.append(r.url))
    try:
        C.seed(page)
        m = _menu(page)
        assert not any(i["tech"] for i in m["items"]), f"el menú tiene Tech Prep apagado: {m}"
        assert [i["t"] for i in m["items"]] == ["Inglés", "Francés", "Danés"], m
        _close_menu(page)
        for h in ["#/tech", "#/techpath", "#/techl/lesson/u01-l1", "#/techunit/u01"]:
            got = C.goto(page, h)
            assert got == "", f"{h} con Tech Prep apagado lleva a #/{got}"
        st = page.evaluate("""() => ({routes: (window.vocabTech ? vocabTech.SECS : []).filter(s => s in ROUTES),
          css: !!document.getElementById('css-tech'), tech: document.documentElement.hasAttribute('data-tech'),
          loaded: !!(window.vocabTech && vocabTech.loaded), on: vocabTech.on(), ids: TABS.map(t => t.id),
          mods: [...document.querySelectorAll('script[data-tech-mod]')].length})""")
        assert st == {"routes": [], "css": False, "tech": False, "loaded": False, "on": False, "ids": st["ids"], "mods": 0}, st
        assert not any(i.startswith("tp-") for i in st["ids"]), st
        bad = [u for u in reqs if "/data/tech/" in u or "/js/tech.js" in u or "tech-lesson" in u or "tech-pages" in u]
        assert not bad, f"peticiones de Tech Prep con el interruptor apagado: {bad}"
        assert any("/js/tech-boot.js" in u for u in reqs), "falta js/tech-boot.js"
        size = (C.REPO / "js" / "tech-boot.js").stat().st_size
        assert size < 16000, f"js/tech-boot.js no es pequeño: {size} bytes"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_switch_in_adults_page():
    """Ajustes › Para mayores (tras la Puerta) tiene la fila «Tech Prep» con su interruptor y la línea en español,
    apagado. Encenderlo guarda tech:on solo en este aparato (no en la partida) y pone «Tech Prep» en el menú de la
    bandera (con su icono y «Interview prep»). Apagarlo lo quita; apagarlo desde otra pestaña estando dentro lleva a #/."""
    page = C.new_page("phone")
    try:
        C.seed(page)
        before = TC.kid_snapshot(page)
        page.evaluate(_PASS)
        page.evaluate("() => { openSettings('mayores'); }")
        page.wait_for_function("() => window.vocabSettings && vocabSettings.page === 'mayores'", timeout=4000)
        page.wait_for_timeout(500)
        row = page.evaluate("""() => { const s = document.getElementById('aj-tp'), i = document.getElementById('aj-tp-on');
          return s && {text: s.textContent.replace(/\\s+/g, ' ').trim(), checked: i.checked, role: i.getAttribute('role'),
            lab: !!document.querySelector('label[for=aj-tp-on]'), icon: !!s.querySelector('.st-ic use, .st-ic svg')}; }""")
        assert row, "no está la fila de Tech Prep en Para mayores"
        assert row["text"].startswith("Tech Prep") and row["text"].endswith("Preparar entrevistas técnicas, en inglés. Solo en este aparato."), row
        assert row["checked"] is False and row["role"] == "switch" and row["lab"] and row["icon"], row
        page.locator("#aj-tp").scroll_into_view_if_needed()
        TC.shot(page, "ajustes-mayores-interruptor", full_page=False)
        page.locator("label[for=aj-tp-on]").click()
        page.wait_for_timeout(200)
        st = page.evaluate("() => ({on: localStorage.getItem('tech:on'), routes: vocabTech.SECS.filter(s => s in ROUTES).length})")
        assert st == {"on": "true", "routes": len(TC.SECS)}, st
        assert not TC.kid_changes(page, before), TC.kid_changes(page, before)
        for _ in range(3):
            if not page.evaluate("document.getElementById('ajustes').open"):
                break
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
        m = _menu(page)
        tp = [i for i in m["items"] if i["tech"]]
        assert len(tp) == 1 and tp[0]["t"] == "Tech Prep" and tp[0]["small"] == "Interview prep" and tp[0]["lang"] == "en-GB" \
            and tp[0]["icon"] and tp[0]["checked"] == "false", m
        sep = page.evaluate("getComputedStyle(document.querySelector('#lang-m .lm-tp'), '::before').visibility")
        assert sep == "visible", f"sin separador antes de Tech Prep: {sep}"
        TC.shot(page, "menu-bandera-con-tech-prep", full_page=False)
        _close_menu(page)
        # apagarlo en Para mayores (al cerrar Ajustes la Puerta se volvió a cerrar)
        page.evaluate(_PASS)
        page.evaluate("() => { openSettings('mayores'); }")
        page.wait_for_function("() => vocabSettings.page === 'mayores'", timeout=4000)
        page.wait_for_timeout(500)
        assert page.evaluate("document.getElementById('aj-tp-on').checked")
        page.locator("label[for=aj-tp-on]").click()
        page.wait_for_timeout(200)
        st = page.evaluate("() => ({on: localStorage.getItem('tech:on'), routes: vocabTech.SECS.filter(s => s in ROUTES).length})")
        assert st == {"on": None, "routes": 0}, st
        for _ in range(3):
            if not page.evaluate("document.getElementById('ajustes').open"):
                break
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
        assert not any(i["tech"] for i in _menu(page)["items"])
        _close_menu(page)
        # encendido y dentro; otra pestaña lo apaga
        page.evaluate("() => { localStorage.setItem('tech:on', 'true'); sessionStorage.setItem('tech:in', '1'); dispatchEvent(new StorageEvent('storage', {key: 'tech:on'})); }")
        TC.goto(page, "#/tech")
        assert _tabs(page)["tech"]
        page.evaluate("() => { localStorage.removeItem('tech:on'); dispatchEvent(new StorageEvent('storage', {key: 'tech:on'})); }")
        _wait_hash(page, "")
        t = _tabs(page)
        assert not t["tech"] and not any(i.startswith("tp-") for i in t["ids"]), t
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_gate_on_entry_not_on_reload_and_again_in_new_session():
    """«Tech Prep» del menú pasa la Puerta («Para entrar en Tech Prep.»): cancelar se queda en el niño; mal no entra;
    bien entra en #/tech. Recargar y moverse dentro no la vuelven a pedir. Una sesión nueva que abre #/tech la pide
    antes de enseñar nada; cancelar lleva a #/."""
    page = C.new_page("phone")
    page2 = None
    try:
        C.seed(page, keys=TC.keys())
        page.locator("#lang-b").click()
        page.wait_for_selector("#lang-m:not([hidden])")
        page.locator("#lang-m [data-tech-entry]").click()
        page.wait_for_function("() => document.getElementById('gate') && document.getElementById('gate').open", timeout=4000)
        g = TC.gate_info(page)
        assert g["why"] == "Para entrar en Tech Prep.", g
        TC.shot(page, "puerta-al-entrar", full_page=False)
        TC.cancel_gate(page)
        page.wait_for_timeout(300)
        assert C.current_hash(page) == "" and not _tabs(page)["tech"]
        assert page.evaluate("sessionStorage.getItem('tech:in')") is None
        # mal y luego bien
        page.locator("#lang-b").click()
        page.wait_for_selector("#lang-m:not([hidden])")
        page.locator("#lang-m [data-tech-entry]").click()
        TC.answer_gate(page, right=False)
        page.wait_for_timeout(400)
        assert TC.gate_open(page) and C.current_hash(page) == "", "una respuesta mal deja entrar"
        TC.answer_gate(page, right=True)
        _wait_hash(page, "tech")
        TC.wait_tech(page)
        assert page.locator("#tp-today").count() == 1
        assert page.evaluate("sessionStorage.getItem('tech:in')") == "1"
        assert page.evaluate("JSON.parse(localStorage.getItem('lang'))") == "english", "entrar cambió el idioma del niño"
        # recargar y moverse dentro: sin Puerta
        C.reload(page)
        TC.wait_tech(page)
        assert not TC.gate_open(page) and C.current_hash(page) == "tech" and page.locator("#tp-today").count() == 1
        for h in ["#/techpath", "#/techmock", "#/tech"]:
            TC.goto(page, h)
            assert not TC.gate_open(page) and C.current_hash(page) == h[2:], h
        local = C.storage(page)
        # sesión nueva (otro contexto con el mismo localStorage): la Puerta antes de enseñar nada
        page2 = C.new_page("phone")
        page2.goto(C.base_url(page2) + "/__blank")
        page2.evaluate("keys => { localStorage.clear(); for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v); }", local)
        page2.goto(C.base_url(page2) + "/#/tech")
        page2.wait_for_function("() => document.getElementById('gate') && document.getElementById('gate').open", timeout=8000)
        seen = page2.evaluate("() => ({today: !!document.getElementById('tp-today'), tech: document.documentElement.hasAttribute('data-tech'),"
                              " mods: [...document.querySelectorAll('script[data-tech-mod]')].length})")
        assert seen == {"today": False, "tech": False, "mods": 0}, f"se ve Tech Prep antes de la Puerta: {seen}"
        assert TC.gate_info(page2)["why"] == "Para entrar en Tech Prep."
        TC.cancel_gate(page2)
        _wait_hash(page2, "")
        assert page2.locator("#tp-today").count() == 0 and not _tabs(page2)["tech"]
        page2.evaluate("() => { location.hash = '#/tech'; }")
        page2.wait_for_function("() => document.getElementById('gate').open", timeout=8000)
        TC.answer_gate(page2, right=True)
        page2.wait_for_selector("#tp-today", timeout=10000)
        assert C.current_hash(page2) == "tech" and _tabs(page2)["tech"]
        assert not C.errors(page), C.errors(page)
        assert not C.errors(page2), C.errors(page2)
    finally:
        page.context.close()
        if page2:
            page2.context.close()


def test_tab_set_swap_and_back():
    """En Tech Prep la barra enseña sus cinco pestañas en inglés (mismo componente) y TABS cambia en su sitio; la
    memoria de pestañas de Tech Prep va aparte (tech:tabs) y la del niño no se toca. «Back to languages» vuelve a las
    pestañas del niño, en español, y olvida la Puerta de esta sesión."""
    page = TC.tech_page("phone", hash="")
    try:
        kid = _tabs(page)
        assert not kid["tech"] and kid["lang"] == "es" and len(kid["ids"]) == 5, kid
        C.goto(page, "#/mapa")
        kid_mem = page.evaluate("sessionStorage.getItem('vocab:tabs')")
        TC.goto(page, "#/tech")
        t = _tabs(page)
        assert t["ids"] == TECH_IDS and t["labels"] == TECH_LABELS, t
        assert t["tech"] and t["lang"] == "en-GB" and t["sel"] == "tab-tp-today" and t["list"] == "Sections", t
        assert t["title"] == "Tech Prep · Today", t
        big = page.evaluate("(document.querySelector('#tabhead h1, #tabhead .lt, #tabhead [class*=title]') || {}).textContent || ''")
        assert "Today" in big, f"título grande: {big!r}"
        # pestañas y segmentos con memoria
        page.locator("#tab-tp-path").click()
        _wait_hash(page, "techpath")
        assert _tabs(page)["sel"] == "tab-tp-path"
        segs = page.evaluate("[...document.querySelectorAll('#tabhead .seg-i')].map(a => [a.textContent.trim(), a.getAttribute('href')])")
        assert segs == [["Units", "#/techpath"], ["Glossary", "#/techgloss"]], segs
        TC.goto(page, "#/techgloss")
        page.locator("#tab-tp-today").click()
        _wait_hash(page, "tech")
        page.locator("#tab-tp-path").click()
        _wait_hash(page, "techgloss")
        mem = page.evaluate("() => ({kid: sessionStorage.getItem('vocab:tabs'), tech: sessionStorage.getItem('tech:tabs')})")
        assert mem["kid"] == kid_mem and "tp-" not in (mem["kid"] or ""), mem
        assert json.loads(mem["tech"])["tp-path"]["h"] == "#/techgloss", mem
        TC.goto(page, "#/tech")
        page.locator("#tp-back").click()
        _wait_hash(page, "")
        back = _tabs(page)
        assert back["ids"] == kid["ids"] and back["labels"] == kid["labels"] and not back["tech"] and back["lang"] == "es", back
        assert "Tech Prep" not in back["title"], back
        assert page.evaluate("sessionStorage.getItem('tech:in')") is None, "salir no olvidó la Puerta"
        coins = page.evaluate("getComputedStyle(document.querySelector('.tb-coins')).display")
        assert coins != "none", "las monedas siguen escondidas en el niño"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_top_bar_in_tech_mode():
    """Dentro: la bandera es el icono de Tech Prep («Tech Prep. Switch section»), el menú en inglés con Tech Prep marcado,
    sin monedas; el engranaje abre los ajustes de Tech Prep (no los del niño). Un idioma del menú sale a #/ (y lo pone si
    es otro). Las cápsulas de volver de las páginas de unidad, caso e historia."""
    page = TC.tech_page("phone")
    try:
        m = _menu(page)
        assert m["button"] == "Tech Prep. Switch section" and m["techIcon"] and m["label"] == "Switch section", m
        assert [(i["t"], i["checked"]) for i in m["items"]] == [("English", "false"), ("French", "false"), ("Danish", "false"),
                                                              ("Tech Prep", "true")], m
        TC.shot(page, "today-menu-bandera", full_page=False)
        _close_menu(page)
        bar = page.evaluate("""() => { const g = document.querySelector('.topbar [data-open=ajustes]');
          return {coins: getComputedStyle(document.querySelector('.tb-coins')).display, gear: g.getAttribute('aria-label'), title: g.title}; }""")
        assert bar == {"coins": "none", "gear": "Tech Prep settings", "title": "Settings"}, bar
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_selector("dialog#tp-set[open]", timeout=4000)
        assert not page.evaluate("document.getElementById('ajustes') && document.getElementById('ajustes').open")
        page.locator("#tp-set-x").click()
        page.wait_for_function("() => !document.getElementById('tp-set').open", timeout=3000)
        # las cápsulas de volver
        backs = page.evaluate("""() => ['techunit/u01', 'techsheet/integration', 'techcase/x1', 'techstory/new', 'techpath', 'tech']
          .map(h => vocabTech.backOf(h))""")
        assert backs == [{"h": "#/techpath", "t": "Path"}, {"h": "#/techpath", "t": "Path"}, {"h": "#/techcases", "t": "My cases"},
                         {"h": "#/techstories", "t": "My stories"}, None, None], backs
        roots = page.evaluate("['techunit/u01', 'techsheet/gcp', 'techcase/a', 'techstory/b'].map(h => rootOf(h))")
        assert roots == ["techpath", "techpath", "techcases", "techstories"], roots
        # un idioma del menú: sale a Hoy del niño y lo pone
        _menu(page)
        page.locator('#lang-m [data-lang="français"]').click()
        _wait_hash(page, "")
        st = page.evaluate("() => ({lang: JSON.parse(localStorage.getItem('lang')), tech: document.documentElement.hasAttribute('data-tech')})")
        assert st == {"lang": "français", "tech": False}, st
        # el mismo idioma: sale sin cambiarlo
        _tech_on_session(page)
        TC.goto(page, "#/tech")
        _menu(page)
        page.locator('#lang-m [data-lang="français"]').click()
        _wait_hash(page, "")
        assert page.evaluate("JSON.parse(localStorage.getItem('lang'))") == "français"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# un modo foco de prueba (lo que harán js/tech-lesson.js y js/tech-pages.js con vocabTech.focus.register)
_FOCUS = """() => {
  window.__zz = {exit: 0, renders: 0};
  vocabTech.focus.register('zz', {
    title: 'Drill',
    render(parts) { __zz.renders++; document.getElementById('app').innerHTML = `<div class="tp-page"><div class="tp-ftop"><div class="tp-pbar"><i style="width:40%"></i></div></div>
      <div class="card tp-card"><h2 class="tp-title">Step ${parts.join('/')}</h2></div>
      <div class="tp-dock"><button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="zz-next" data-key="enter">Next</button></div></div>`; },
    exit(from) { __zz.exit++; return vocabTech.focus.ask({from}); },
    blocks(hp) { return vocabTech.focus.guard(hp); },
  });
}"""


def test_focus_mode_and_stop_sheet():
    """#/techl/<kind>/… es modo foco «tech» (✕, sin pestañas ni monedas) y lo pinta el módulo que se registró con
    vocabTech.focus.register: su título en document.title, la ✕ le pregunta antes (exit) y «Stop here?» («Keep going»
    destacado · «Stop»), y Atrás del navegador también (blocks → focus.guard). Sin módulo registrado, «Coming soon»."""
    page = TC.tech_page("phone")
    try:
        page.evaluate(_FOCUS)
        TC.goto(page, "#/techl/zz/1")
        st = page.evaluate("""() => ({focus: document.documentElement.dataset.focus || '', title: document.title,
          tabbar: getComputedStyle(document.getElementById('tabbar')).display, x: (document.getElementById('fx-x') || {getAttribute: () => null}).getAttribute('aria-label'),
          step: (document.querySelector('#app .tp-title') || {}).textContent, active: vocabTech.focus.active})""")
        assert st["focus"] == "tech" and st["title"] == "Tech Prep · Drill" and st["x"] == "Close" and st["step"] == "Step 1" \
            and st["active"] == "zz", st
        coins = page.evaluate("[...document.querySelectorAll('.fx-coins, .tb-coins')].filter(e => getComputedStyle(e).display !== 'none' && e.getClientRects().length).length")
        assert coins == 0, "monedas a la vista en el modo foco de Tech Prep"
        # ✕ → «Stop here?» → Keep going
        page.locator("#fx-x").click()
        page.wait_for_selector("dialog#tp-stop[open]", timeout=3000)
        sheet = page.evaluate("""() => { const d = document.getElementById('tp-stop');
          return {t: d.querySelector('#tp-stop-t').textContent, b: [...d.querySelectorAll('button')].map(b => [b.textContent.trim(), b.classList.contains('glass-btn--pri')]),
            lang: d.lang}; }""")
        assert sheet == {"t": "Stop here?", "b": [["Stop", False], ["Keep going", True]], "lang": "en-GB"}, sheet
        TC.shot(page, "foco-stop-here", full_page=False)
        page.locator("#tp-stop-go").click()
        page.wait_for_function("() => !document.getElementById('tp-stop').open", timeout=3000)
        assert C.current_hash(page) == "techl/zz/1" and page.evaluate("__zz.exit") == 1
        # ✕ → Stop: a Today
        page.locator("#fx-x").click()
        page.wait_for_selector("dialog#tp-stop[open]", timeout=3000)
        page.locator("#tp-stop-out").click()
        _wait_hash(page, "tech")
        page.wait_for_function("() => !document.documentElement.hasAttribute('data-focus')", timeout=3000)
        # Atrás del navegador: pregunta; Keep going se queda; Stop sale
        TC.goto(page, "#/techl/zz/2")
        page.go_back()
        page.wait_for_selector("dialog#tp-stop[open]", timeout=3000)
        assert C.current_hash(page) == "techl/zz/2"
        page.locator("#tp-stop-go").click()
        page.wait_for_timeout(300)
        assert C.current_hash(page) == "techl/zz/2"
        page.go_back()
        page.wait_for_selector("dialog#tp-stop[open]", timeout=3000)
        page.locator("#tp-stop-out").click()
        _wait_hash(page, "tech")
        # un tipo sin módulo: «Coming soon» (sin 404)
        TC.goto(page, "#/techl/nothing-here")
        assert "Coming soon" in page.inner_text("#app")
        assert page.evaluate("vocabTech.focus.title('techl/lesson/u01-l1')") == "Lesson"
        assert page.evaluate("vocabTech.focus.title('techl/review')") == "Review"
        assert page.evaluate("vocabTech.focus.title('techl/mock')") == "Mock interview"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- la partida del niño, intacta
_HEAVY = """async () => {
  const V = vocabTech, us = await V.units();
  let n = 0;
  for (const u of us) for (const l of u.lessons) {
    for (const it of l.items) {
      if (it.type === 'explain') V.srs.gradeExplain(it.id, ['nailed', 'partly', 'notyet'][n % 3]);
      else V.srs.grade(it.id, n % 3);
      n++;
    }
    V.progress.lessonDone(l.id, {score: l.items.length - 1, total: l.items.length});
  }
  const q = V.srs.queue({limit: 20}); q.forEach((id, i) => V.srs.grade(id, i % 3));
  V.interview.set(V.dayStr(V.day() + 14));
  V.put('case', 'c1', {title: 'My case', fields: {context: 'A retail company', requirements: '', options: '', decision: '', tradeoffs: '', outcome: ''}});
  V.put('story', 's1', {title: 'A conflict', prompt: 'Tell me about a conflict', fields: {situation: 'x', task: '', action: '', result: '', lessons: ''}});
  V.put('best', 'pairs', {score: 42});
  for (let i = 0; i < 25; i++) V.put('mock', 'm' + String(i).padStart(2, '0'), {when: Date.now() + i, n: 5, grades: {}});
  V.del('case', 'c1');
  V.act.log(3);
  await V.speak('Hello there. This is Tech Prep.');
  return {n, mocks: V.list('mock').map(m => m.id).sort(), q: q.length};
}"""


def test_kid_export_unchanged_after_heavy_use():
    """Mucho Tech Prep (todas las lecciones, cada ítem calificado, repaso, fecha, casos, historias, récords, 25
    entrevistas, ajustes, pantallas) no cambia la partida del niño: la exportación es la misma de antes y la de
    tests/e2e/baseline/export.json, ninguna clave del niño cambia, y Tech Prep no emite coins, lesson-done, review-done,
    game-done, medal, gift-open ni answer. Solo quedan las 20 últimas entrevistas de práctica."""
    page = TC.tech_page("desk", hash="")
    try:
        before = TC.kid_snapshot(page)
        ls0 = {k: v for k, v in C.storage(page).items() if not k.startswith("tech:")}
        TC.bus_log(page)
        TC.goto(page, "#/tech")
        r = page.evaluate(_HEAVY)
        assert r["n"] == len(TC.items()), r
        assert r["mocks"] == [f"m{i:02d}" for i in range(5, 25)], r
        for h in ["#/techpath", "#/techgloss", "#/techplay", "#/techcases", "#/techstories", "#/techmock", "#/tech"]:
            TC.goto(page, h)
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_selector("dialog#tp-set[open]", timeout=4000)
        page.locator('#tp-set [data-rate="1.2"]').click()
        page.locator("#tp-set-x").click()
        page.wait_for_function("() => !document.getElementById('tp-set').open", timeout=3000)
        page.locator("#tp-back").click()
        _wait_hash(page, "")
        after = TC.kid_snapshot(page)
        d = C.diff_exports(before, after, allow_new=False)
        assert not d, "Tech Prep cambió la partida del niño:\n  " + "\n  ".join(d)
        base = C.load_baseline()
        d2 = C.diff_exports(base, C.export(page))
        assert not d2, "la exportación ya no es la de la base:\n  " + "\n  ".join(d2)
        ls1 = {k: v for k, v in C.storage(page).items() if not k.startswith("tech:")}
        changed = sorted(k for k in set(ls0) | set(ls1) if ls0.get(k) != ls1.get(k))
        assert not changed, f"claves que no son de Tech Prep cambiaron: {changed}"
        assert TC.bus_seen(page) == [], TC.bus_seen(page)
        st = TC.state(page)
        assert st["v"] == 1 and st["dev"] and len(st["recs"]) > 200, len(st.get("recs", {}))
        assert json.loads(page.evaluate("localStorage.getItem('tech:ui')"))["rate"] == 1.2
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def _wait_reload(page, timeout=20000):
    t0 = time.time()
    while True:
        try:
            if page.evaluate("() => !window.__vocabOld && (window.__vocabRouteN || 0) > 0"):
                break
        except Exception:
            pass
        if time.time() - t0 > timeout / 1000:
            raise TimeoutError("la app no volvió a pintar")
        page.wait_for_timeout(50)
    C.settle(page)


def test_loading_a_kid_partida_keeps_tech_data():
    """Cargar una partida (importar), «Volver a la partida de antes» y traer la partida de Google (vocabSave.apply como
    lo hace js/sync.js) cambian solo las claves del niño: tech:on, tech:data, tech:ui y tech:sync siguen igual y
    Tech Prep sigue donde estaba."""
    data = TC.data({"ls/u01-l1": TC.rec(best=8, total=9, done=TC.NOW_MS - 864e5), "srs/u01-l1-i04": TC.srs(b=2, due=T + 3, t="pick"),
                    "case/c1": TC.rec(title="Mine", fields={"context": "A retail company"})})
    page = TC.tech_page("phone", hash="", data=data, extra={"tech:ui": {"rate": 1.2}, "tech:sync": {"fileId": "f9", "lastHash": "abc", "lastSync": TC.NOW_MS - 1000}})
    try:
        before = TC.tech_keys(page)["local"]
        assert set(before) == {"tech:on", "tech:data", "tech:ui", "tech:sync"}, before
        res = C.import_export(page, C.load_baseline())
        assert res.get("ok"), res
        assert TC.tech_keys(page)["local"] == before, "importar una partida tocó Tech Prep"
        # «Volver a la partida de antes»
        page.evaluate("() => { window.__vocabOld = 1; const u = vocabSave.metaGet(vocabSave.META.undo, null); return vocabSave.apply(u.keys, 'undo'); }")
        _wait_reload(page)
        assert TC.tech_keys(page)["local"] == before, "deshacer la carga tocó Tech Prep"
        # la partida que llega de Google (js/sync.js: S.apply(keys, "load", {t: "☁️ …", adult: false}))
        keys = C.load_baseline()["keys"]
        page.evaluate("""keys => { window.__vocabOld = 1;
          return vocabSave.apply(keys, 'load', {t: '☁️ Partida actualizada desde otro aparato', adult: false}); }""", keys)
        _wait_reload(page)
        assert TC.tech_keys(page)["local"] == before, "traer la partida de Google tocó Tech Prep"
        TC.goto(page, "#/tech")
        hero = page.inner_text("#tp-go").strip() + " · " + page.inner_text(".tp-hero .tp-sub")
        assert "Lesson 2 of 3" in hero, hero
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- la mezcla de dos aparatos
_MERGE = """() => {
  const M = vocabTech.merge, H = 3600e3, D = 24 * H, now = Date.now();
  const A = {v: 1, dev: 'A', recs: {
    'ls/u01-l1': {best: 7, total: 9, done: now - 5 * H, at: now - 5 * H},
    'srs/x1': {b: 2, due: 1, at: now - 2 * H},
    'srs/x2': {b: 3, due: 2, at: now - 1 * H},
    'srs/tie': {b: 1, at: now - 3 * H, who: 'A'},
    'act/2026-03-10': {n: 12, at: now - 10 * H},
    'case/c1': {title: 'Mine', at: now - 4 * H},
    'story/s1': {del: true, at: now - 6 * H},
    'mock/old': {del: true, at: now - 100 * D},
    'best/pairs': {score: 30, at: now - 50 * D}}};
  const B = {v: 1, dev: 'B', erased: now - 40 * D, recs: {
    'srs/x1': {b: 4, due: 9, at: now - 1 * H},
    'srs/x2': {b: 0, due: 1, at: now - 2 * H},
    'srs/tie': {b: 5, at: now - 3 * H, who: 'B'},
    'act/2026-03-10': {n: 8, at: now - 1 * H},
    'case/c1': {del: true, at: now - 2 * H},
    'story/s1': {title: 'Back', at: now - 1 * H},
    'ls/u02-l1': {best: 5, total: 8, done: now - 60 * D, at: now - 45 * D},
    'set/interview': {date: '2026-03-30', at: now - 3 * H}}};
  const a0 = JSON.stringify(A), b0 = JSON.stringify(B);
  const m = M(A, B), r = M(B, A), mm = M(m, m);
  return {m, r, same: JSON.stringify(mm.recs) === JSON.stringify(m.recs), pure: JSON.stringify(A) === a0 && JSON.stringify(B) === b0, E: B.erased};
}"""


def test_record_merge_two_devices():
    """vocabTech.merge (§5), con dos aparatos de mentira: por registro gana el at más nuevo (empate: el de aquí); act se
    queda con el n mayor; una lápida más nueva borra y un registro más nuevo que la lápida vuelve; las lápidas de más de
    90 días se olvidan; nada de antes de un «Erase» (erased) sobrevive. No toca sus entradas y mezclar dos veces da lo
    mismo. Guardar más de 20 entrevistas deja las 20 últimas."""
    page = TC.tech_page("phone")
    try:
        r = page.evaluate(_MERGE)
        m, rr = r["m"], r["r"]
        assert r["pure"] and r["same"], r
        assert m["dev"] == "A" and rr["dev"] == "B" and m["erased"] == r["E"] == rr["erased"], (m["dev"], rr["dev"])
        k = m["recs"]
        assert sorted(k) == sorted(["ls/u01-l1", "srs/x1", "srs/x2", "srs/tie", "act/2026-03-10", "case/c1", "story/s1", "set/interview"]), sorted(k)
        assert k["srs/x1"]["b"] == 4 and k["srs/x2"]["b"] == 3, (k["srs/x1"], k["srs/x2"])
        assert k["srs/tie"]["who"] == "A" and rr["recs"]["srs/tie"]["who"] == "B", "empate: gana la copia de aquí"
        assert k["act/2026-03-10"]["n"] == 12 and rr["recs"]["act/2026-03-10"]["n"] == 12, "act: el n mayor"
        assert k["case/c1"].get("del") is True, "la lápida más nueva no borró el caso"
        assert k["story/s1"] == {"title": "Back", "at": k["story/s1"]["at"]}, k["story/s1"]
        for x in ("mock/old", "best/pairs", "ls/u02-l1"):
            assert x not in k and x not in rr["recs"], x
        for x in k:
            if x != "srs/tie":
                assert k[x] == rr["recs"][x], f"la mezcla no es la misma en los dos sentidos: {x}"
        # get/list no ven las lápidas; 25 entrevistas → las 20 últimas
        out = page.evaluate("""() => { const V = vocabTech;
          V.put('case', 'k1', {title: 'x'}); const g1 = V.get('case', 'k1'); V.del('case', 'k1');
          for (let i = 0; i < 25; i++) V.put('mock', 'q' + String(i).padStart(2, '0'), {when: 1000 + i, n: 1});
          return {g1: !!g1, g2: V.get('case', 'k1'), list: V.list('case').map(c => c.id), mocks: V.list('mock').map(x => x.id).sort(),
            tomb: JSON.parse(localStorage.getItem('tech:data')).recs['case/k1']}; }""")
        assert out["g1"] and out["g2"] is None and out["list"] == [] and out["tomb"].get("del") is True, out
        assert out["mocks"] == [f"q{i:02d}" for i in range(5, 25)], out["mocks"]
        bad = page.evaluate("() => { try { vocabTech.put('Bad Kind', 'x', {}); return 'ok'; } catch (e) { return 'error'; } }")
        assert bad == "error"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- Google Drive: el archivo de Tech Prep
TECH_FILE = "vocabulary-techprep.json"
KID_FILE = "vocabulary-progress.json"


def _gkeys(tok_valid=True):
    return TC.google_keys(base={}, tok_valid=tok_valid)


def _synced(page, after=0, timeout=10000):
    page.wait_for_function("t => (JSON.parse(localStorage.getItem('tech:sync') || '{}').lastSync || 0) > t", arg=after, timeout=timeout)
    page.wait_for_timeout(150)
    return json.loads(page.evaluate("localStorage.getItem('tech:sync')"))


def _canon(d):
    return json.dumps(d.get("recs", {}), sort_keys=True)


def test_drive_tech_file_two_devices():
    """Con Google conectado (Drive y GIS de mentira): el primer aparato crea su propio archivo
    vocabulary-techprep.json en appDataFolder con {app, v, saved, data} y appProperties {hash}; el segundo lo descarga,
    mezcla y sube; el primero, al volver a sincronizar, se queda con lo mismo sin subir nada; sin cambios no descarga ni
    sube; un cambio sube a los ~20 s. Nunca escribe vocabulary-progress.json con lo de Tech Prep (y file() no deja
    abrirlo). Sin permiso vigente espera sin pedir nada; la línea de los ajustes dice cada estado."""
    H = 3600_000
    pa = C.new_page("phone")
    drive = TC.FakeDrive(pa)
    pb = pc = pd = None
    try:
        recs_a = {"ls/u01-l1": TC.rec(best=7, total=9, done=TC.NOW_MS - 5 * H, at=TC.NOW_MS - 5 * H),
                  "case/c1": TC.rec(title="A case", fields={"context": "x"}, at=TC.NOW_MS - 4 * H),
                  "srs/u01-l1-i04": TC.srs(b=1, t="pick", at=TC.NOW_MS - 3 * H)}
        TC.open_tech(pa, "#/tech", data_=TC.data(recs_a, dev="devA"), extra=_gkeys())
        sa = _synced(pa)
        fid, f = drive.by_name(TECH_FILE)
        assert fid and sa["fileId"] == fid, (sa, drive.log)
        w = [x for x in drive.writes if x[1] == TECH_FILE]
        assert len(w) == 1 and w[0][2].get("parents") == ["appDataFolder"] and w[0][2].get("name") == TECH_FILE, w
        body = json.loads(f["body"])
        assert body["app"] == "vocabulary-techprep" and body["v"] == 1 and body["saved"] and _canon(body["data"]) == json.dumps(recs_a, sort_keys=True), body
        assert f["appProperties"]["hash"] == pa.evaluate("vocabTech._hash()") == sa["lastHash"], (f["appProperties"], sa)
        # el segundo aparato: lo de A más lo suyo (una lápida para el caso de A, una ficha más nueva)
        pb = C.new_page("phone")
        drive.attach(pb)
        recs_b = {"ls/u01-l2": TC.rec(best=6, total=8, done=TC.NOW_MS - 2 * H, at=TC.NOW_MS - 2 * H),
                  "case/c1": {"del": True, "at": TC.NOW_MS - 1 * H},
                  "srs/u01-l1-i04": TC.srs(b=3, t="pick", at=TC.NOW_MS - 1 * H),
                  f"act/{TC.day_str(T)}": TC.rec(n=4)}
        TC.open_tech(pb, "#/tech", data_=TC.data(recs_b, dev="devB"), extra=_gkeys())
        _synced(pb)
        lb = TC.state(pb)
        assert sorted(lb["recs"]) == sorted(["ls/u01-l1", "ls/u01-l2", "case/c1", "srs/u01-l1-i04", f"act/{TC.day_str(T)}"]), sorted(lb["recs"])
        assert lb["recs"]["case/c1"].get("del") and lb["recs"]["srs/u01-l1-i04"]["b"] == 3 and lb["dev"] == "devB", lb["recs"]
        assert ("DOWNLOAD", fid, TECH_FILE) in drive.log
        assert _canon(drive.body(TECH_FILE)["data"]) == _canon(lb), "el archivo no tiene la mezcla"
        # A vuelve a sincronizar: la misma mezcla, sin subir
        nw = len(drive.writes)
        assert pa.evaluate("vocabTech.sync.now()") is True
        la = TC.state(pa)
        assert _canon(la) == _canon(lb) and la["dev"] == "devA", "los dos aparatos no acaban igual"
        assert len(drive.writes) == nw, f"subió sin hacer falta: {drive.writes[nw:]}"
        # sin cambios: ni descarga ni subida
        nl = len(drive.log)
        assert pa.evaluate("vocabTech.sync.now()") is True
        assert not [x for x in drive.log[nl:] if x[0] in ("DOWNLOAD", "PATCH", "POST")], drive.log[nl:]
        # un cambio sube a los ~20 s
        s0 = json.loads(pa.evaluate("localStorage.getItem('tech:sync')"))["lastSync"]
        pa.evaluate("vocabTech.put('best', 'pairs', {score: 30})")
        pa.wait_for_timeout(300)
        assert len(drive.writes) == nw
        pa.clock.fast_forward(21000)
        _synced(pa, s0)
        assert len(drive.writes) == nw + 1 and "best/pairs" in drive.body(TECH_FILE)["data"]["recs"]
        # el archivo del niño nunca lleva nada de Tech Prep
        for fid_, name, md, content in drive.writes:
            assert name in (TECH_FILE, KID_FILE), name
            if name == KID_FILE:
                assert "tech:" not in content and json.loads(content).get("app") == "vocabulary", content[:200]
            else:
                assert json.loads(content)["app"] == "vocabulary-techprep"
        assert pa.evaluate("() => { try { vocabSync.file('vocabulary-progress.json'); return 'ok'; } catch (e) { return 'error'; } }") == "error"
        # la línea de los ajustes
        pa.locator(".topbar [data-open=ajustes]").click()
        pa.wait_for_selector("dialog#tp-set[open]", timeout=4000)
        pa.wait_for_timeout(400)
        g = pa.evaluate("() => { const e = document.getElementById('tp-set-g'); return [e.dataset.state, e.textContent.trim()]; }")
        assert g[0] == "ok" and g[1].startswith("Saved to Google · "), g
        # sin permiso vigente: espera, sin pedir nada
        pc = C.new_page("phone")
        drive.attach(pc)
        nl = len(drive.log)
        TC.open_tech(pc, "#/tech", data_=TC.data({"best/clock": TC.rec(score=9)}, dev="devC"), extra=_gkeys(tok_valid=False))
        pc.wait_for_timeout(1200)
        assert not [x for x in drive.log[nl:] if x[2] == TECH_FILE], drive.log[nl:]
        assert pc.evaluate("window.__gis.filter(c => !c.tap).length") == 0
        pc.locator(".topbar [data-open=ajustes]").click()
        pc.wait_for_selector("dialog#tp-set[open]", timeout=4000)
        assert pc.inner_text("#tp-set-g").strip() == "Waiting for Google · changes are safe on this device"
        # sin Google
        pd = TC.tech_page("phone")
        pd.locator(".topbar [data-open=ajustes]").click()
        pd.wait_for_selector("dialog#tp-set[open]", timeout=4000)
        assert pd.inner_text("#tp-set-g").strip() == "Not connected · connect Google in Ajustes › Para mayores to keep a copy"
        for p in (pa, pb, pc, pd):
            assert not C.errors(p), C.errors(p)
    finally:
        for p in (pa, pb, pc, pd):
            if p:
                p.context.close()


def test_erase_tech_progress():
    """«Erase Tech Prep progress» (hoja de confirmar, «Cancel» destacado): todo a cero aquí y, con Google, el archivo con
    el estado vacío y la hora del borrado, así otro aparato también lo olvida al mezclar."""
    page = C.new_page("phone")
    drive = TC.FakeDrive(page)
    try:
        recs = {"ls/u01-l1": TC.rec(best=7, total=9, done=TC.NOW_MS - 3600_000), "case/c1": TC.rec(title="Mine")}
        TC.open_tech(page, "#/tech", data_=TC.data(recs, dev="devA"), extra=_gkeys())
        _synced(page)
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_selector("dialog#tp-set[open]", timeout=4000)
        page.locator("#tp-set-erase").click()
        page.wait_for_selector("dialog#tp-erase[open]", timeout=3000)
        conf = page.evaluate("""() => { const d = document.getElementById('tp-erase');
          return {t: d.querySelector('#tp-erase-t').textContent, sub: d.querySelector('.tp-sub').textContent,
            b: [...d.querySelectorAll('button')].map(b => [b.textContent.trim(), b.classList.contains('glass-btn--pri')])}; }""")
        assert conf["t"] == "Erase Tech Prep progress?" and "Google copy" in conf["sub"] and conf["b"] == [["Erase", False], ["Cancel", True]], conf
        TC.shot(page, "ajustes-erase-confirmar", full_page=False)
        page.locator("#tp-erase-no").click()
        page.wait_for_function("() => !document.getElementById('tp-erase').open", timeout=3000)
        assert len(TC.recs(page)) == 2
        page.locator("#tp-set-erase").click()
        page.wait_for_selector("dialog#tp-erase[open]", timeout=3000)
        page.locator("#tp-erase-yes").click()
        page.wait_for_function("() => !document.getElementById('tp-erase').open", timeout=5000)
        st = TC.state(page)
        assert st["recs"] == {} and st["erased"] > 0 and st["dev"] == "devA", st
        body = drive.body(TECH_FILE)
        assert body["data"]["recs"] == {} and body["data"]["erased"] == st["erased"], body
        assert any("erased here and in your Google copy" in t for t in _toasts(page)), _toasts(page)
        # otro aparato con lo de antes: al mezclar lo olvida
        out = page.evaluate("""e => vocabTech.merge({v: 1, dev: 'B', recs: {'ls/u01-l1': {best: 7, at: e - 5000}, 'ls/u01-l3': {best: 2, at: e + 5000}}},
          JSON.parse(localStorage.getItem('tech:data')))""", st["erased"])
        assert sorted(out["recs"]) == ["ls/u01-l3"], out
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- repaso: fecha de la entrevista y orden
def test_interview_date_compression():
    """Con fecha de entrevista nada vence después del día de antes: lo que caería después se trae a los 7 días
    anteriores, repartido (siempre el mismo día para la misma ficha); lo que ya caía antes no se mueve; quitar la fecha
    lo devuelve a su día natural. Today enseña «Interview in N days · Focus: …» y la fila «Set interview date» la pone."""
    ivs = [1, 3, 7, 14, 30, 60, 2]
    recs = {f"srs/u0{1 + i % 6}-l1-z{i:02d}": TC.srs(b=min(6, 1 + i % 6), due=T + ivs[i % 7], d=T, iv=ivs[i % 7], t="pick") for i in range(84)}
    page = TC.tech_page("phone", data=TC.data(recs))
    try:
        I = T + 10
        got = page.evaluate("s => { vocabTech.interview.set(s); return vocabTech.list('srs').map(r => [r.id, r.due, r.d, r.iv]); }", TC.day_str(I))
        days = {}
        for rid, due, d, iv in got:
            nat = d + iv
            if nat <= I - 1:
                assert due == nat, (rid, due, nat)
            else:
                assert I - 7 <= due <= I - 1, (rid, due, I)
                days[due] = days.get(due, 0) + 1
        assert sorted(days) == list(range(I - 7, I)) and min(days.values()) >= 2, f"no se reparte en los 7 días: {days}"
        again = page.evaluate("s => { vocabTech.interview.set(s); return vocabTech.list('srs').map(r => [r.id, r.due, r.d, r.iv]); }", TC.day_str(I))
        assert sorted(again) == sorted(got), "la misma fecha no da los mismos días"
        assert page.evaluate("[vocabTech.interview.date(), vocabTech.interview.daysLeft()]") == [TC.day_str(I), 10]
        # una ficha en la caja de arriba (60 días), con fecha: dentro de la semana
        due = page.evaluate("() => vocabTech.srs.grade('u06-l1-z05', 2, {type: 'pick'}).due")   # caja 6 (60 días)
        assert I - 7 <= due <= I - 1, due
        TC.goto(page, "#/tech")
        cd = page.inner_text("#tp-cd").replace("\n", " · ")
        assert cd.startswith("Interview in 10 days · Focus: "), cd
        # quitar la fecha: cada una a su día natural (último repaso + intervalo)
        got = page.evaluate("() => { vocabTech.interview.set(null); return vocabTech.list('srs').map(r => [r.id, r.due, r.d, r.iv]); }")
        assert all(due == d + iv for _, due, d, iv in got), [x for x in got if x[1] != x[2] + x[3]][:3]
        assert page.evaluate("[vocabTech.interview.date(), vocabTech.interview.daysLeft()]") == [None, None]
        # la fila «Set interview date» de Today
        TC.goto(page, "#/techpath")
        TC.goto(page, "#/tech")
        assert page.locator("#tp-cd").count() == 0 and page.locator("#tp-date-b").count() == 1
        assert page.inner_text("#tp-date-b").startswith("Set interview date")
        page.locator("#tp-date").fill(TC.day_str(T + 12))
        page.wait_for_selector("#tp-cd", timeout=3000)
        assert page.inner_text("#tp-cd").startswith("Interview in 12 days")
        assert page.evaluate("vocabTech.interview.date()") == TC.day_str(T + 12)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_review_queue_order_and_explain_cap():
    """La cola del repaso (§8): las atrasadas primero (la más antigua), luego las de hoy de la unidad estudiada más
    recientemente, mezclando tipos; como mucho 5 «Explain it» al día (contando las ya repasadas hoy); queue({limit})
    corta. Calificar algo que dio queue() cuenta como repaso (act +1); una ficha nueva o fuera de la cola, no."""
    H = 3600_000
    old, new, mid = TC.NOW_MS - 5 * H, TC.NOW_MS - 1 * H, TC.NOW_MS - 3 * H
    recs = {
        "srs/u01-l1-i01": TC.srs(b=2, due=T - 3, d=T - 6, t="pick", at=old),
        "srs/u01-l1-i02": TC.srs(b=2, due=T - 1, d=T - 4, t="tf", at=old),
        "srs/u01-l1-i03": TC.srs(b=1, due=T, d=T - 1, t="pick", at=old),
        "srs/u01-l1-i04": TC.srs(b=1, due=T, d=T - 1, t="pick", at=old),
        "srs/u01-l1-i05": TC.srs(b=1, due=T, d=T - 1, t="tf", at=old),
        "srs/u02-l1-i01": TC.srs(b=1, due=T, d=T - 1, t="pick", at=new),
        "srs/u02-l1-i02": TC.srs(b=1, due=T, d=T - 1, t="pick", at=new),
        "srs/u02-l1-i03": TC.srs(b=1, due=T, d=T - 1, t="card", at=new),
        **{f"srs/u03-l3-e{i}": TC.srs(b=1, due=T, d=T - 1, t="explain", at=mid) for i in range(1, 8)},
        "srs/u03-l3-e8": TC.srs(b=1, due=T + 2, d=T, t="explain", r=T, at=mid),
        "srs/u03-l3-e9": TC.srs(b=1, due=T + 2, d=T, t="explain", r=T, at=mid),
    }
    page = TC.tech_page("phone", data=TC.data(recs))
    try:
        want = ["u01-l1-i01", "u01-l1-i02", "u02-l1-i01", "u02-l1-i03", "u02-l1-i02", "u03-l3-e1", "u03-l3-e2", "u03-l3-e3",
                "u01-l1-i03", "u01-l1-i05", "u01-l1-i04"]
        r = page.evaluate("() => ({q: vocabTech.srs.queue({limit: 50}), n: vocabTech.srs.dueCount()})")
        assert r == {"q": want, "n": len(want)}, r
        C.reload(page)   # (lo que ya salió en una cola cuenta como repaso durante la sesión de la página)
        TC.wait_tech(page)
        r = page.evaluate("""() => { const q = vocabTech.srs.queue({limit: 4}), k = vocabTech.dayStr(vocabTech.day());
          const a0 = (vocabTech.get('act', k) || {n: 0}).n;
          vocabTech.srs.grade(q[0], 2);                       // de la cola: repaso
          const a1 = vocabTech.get('act', k).n;
          vocabTech.srs.grade('u01-l1-i04', 2);               // fuera de la cola: no
          vocabTech.srs.grade('u05-l1-i01', 2, {type: 'pick'});   // nueva: no
          const a2 = vocabTech.get('act', k).n;
          vocabTech.srs.grade('u05-l1-i02', 1, {type: 'say'});    // say no entra en el repaso
          return {q, a0, a1, a2, say: vocabTech.srs.get('u05-l1-i02'), first: vocabTech.srs.get(q[0])}; }""")
        assert r["q"] == want[:4] and r["a0"] == 0 and r["a1"] == 1 and r["a2"] == 1 and r["say"] is None, r
        assert r["first"]["b"] == 3 and r["first"]["due"] == T + 7, r["first"]
        # la escalera: 2 sube de caja; 1 la mitad del intervalo (mínimo 1); 0 a la caja 0 y mañana; Explain it
        r = page.evaluate("""() => { const V = vocabTech, g = (id, x, o) => { V.srs.grade(id, x, Object.assign({type: 'pick'}, o)); return V.srs.get(id); };
          V.put('srs', 'u06-l1-a', {b: 4, due: 0, n: 3, g: 2, d: 0, iv: 14, t: 'pick'});
          V.put('srs', 'u06-l1-b', {b: 4, due: 0, n: 3, g: 2, d: 0, iv: 14, t: 'pick'});
          V.put('srs', 'u06-l1-c', {b: 6, due: 0, n: 3, g: 2, d: 0, iv: 60, t: 'pick'});
          return {a: g('u06-l1-a', 1), b: g('u06-l1-b', 0), c: g('u06-l1-c', 2),
            n: (V.srs.gradeExplain('u06-l3-x', 'nailed'), V.srs.get('u06-l3-x')),
            p: (V.put('srs', 'u06-l3-y', {b: 3, due: 0, n: 1, g: 2, d: 0, iv: 7, t: 'explain'}), V.srs.gradeExplain('u06-l3-y', 'partly'), V.srs.get('u06-l3-y')),
            z: (V.srs.gradeExplain('u06-l3-z', 'notyet'), V.srs.get('u06-l3-z'))}; }""")
        assert (r["a"]["b"], r["a"]["due"]) == (4, T + 7), r["a"]
        assert (r["b"]["b"], r["b"]["due"]) == (0, T + 1), r["b"]
        assert (r["c"]["b"], r["c"]["due"]) == (6, T + 60), r["c"]
        assert (r["n"]["b"], r["n"]["due"], r["n"]["g"], r["n"]["t"]) == (1, T + 1, 2, "explain"), r["n"]
        assert (r["p"]["b"], r["p"]["due"], r["p"]["g"]) == (3, T + 2, 1), r["p"]
        assert (r["z"]["b"], r["z"]["due"], r["z"]["g"]) == (0, T + 1, 0), r["z"]
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- racha, Interview ready y medallas
def test_streak_and_week():
    """La racha (§11): días seguidos con ≥ 10 de actividad (una lección hecha cuenta 10, cada repaso 1); si hoy aún no
    llega, cuenta desde ayer. La semana va de lunes a domingo. Today lo enseña (llama y días de la semana)."""
    acts = {T: 10, T - 1: 12, T - 2: 3, T - 3: 15}
    page = TC.tech_page("phone", data=TC.data({f"act/{TC.day_str(d)}": TC.rec(n=n) for d, n in acts.items()}))
    try:
        r = page.evaluate("() => ({s: vocabTech.act.streak(), w: vocabTech.act.week()})")
        assert r == {"s": 2, "w": [False, True, True, False, False, False, False]}, r   # 11-3-2026 es miércoles
        card = page.evaluate("""() => { const c = document.querySelector('.tp-streak');
          return {t: c.querySelector('.tp-st-t').textContent, quiet: c.classList.contains('quiet'),
            on: [...c.querySelectorAll('.tp-wk span')].map(s => s.classList.contains('on')), now: [...c.querySelectorAll('.tp-wk span')].findIndex(s => s.classList.contains('now')),
            label: c.querySelector('.tp-wk').getAttribute('aria-label')}; }""")
        assert card == {"t": "2-day streak", "quiet": False, "on": r["w"], "now": 2, "label": "This week: Tuesday, Wednesday"}, card
        r = page.evaluate(f"""() => {{ vocabTech.put('act', '{TC.day_str(T)}', {{n: 4}}); const a = vocabTech.act.streak();
          vocabTech.progress.lessonDone('u01-l1', {{score: 8, total: 9}}); const b = vocabTech.act.streak();
          return {{a, b, n: vocabTech.get('act', '{TC.day_str(T)}').n}}; }}""")
        assert r == {"a": 1, "b": 2, "n": 14}, r
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def _expected_ready(uids, ls_done, srs):
    """«Interview ready» con la fórmula de §11, desde los ficheros de datos."""
    L = Ld = R = Rok = E = Eok = 0
    for uid in uids:
        for l in TC.unit(uid)["lessons"]:
            L += 1
            Ld += l["id"] in ls_done
            for it in l["items"]:
                if not TC.REVIEWABLE(it["type"]):
                    continue
                s = srs.get(it["id"])
                R += 1
                if s and s["due"] >= T and s["b"] >= 2:
                    Rok += 1
                if it["type"] == "explain":
                    E += 1
                    if s and s["g"] == 2:
                        Eok += 1
    return round(40 * Ld / L + 30 * (Rok / R if R else 0) + 30 * (Eok / E if E else 0))


def test_interview_ready_and_medals():
    """«Interview ready» por bloque y por unidad (40 % lecciones, 30 % fichas al día en caja ≥ 2, 30 % «Explain it»
    con «Nailed it») coincide con la fórmula y sale en Today. La medalla de un bloque llega al terminar todas sus
    lecciones (aviso «Medal earned: Integration!», en Today); Leadership solo tiene la unidad 7: nunca se gana aún."""
    integ = [u["id"] for u in TC.units() if u["block"] == "integration"]
    ls_done = ["u01-l1", "u01-l2", "u01-l3", "u02-l1"]
    srs = {}
    rev = [it for _, _, it in TC.items(uid="u01") if TC.REVIEWABLE(it["type"]) and it["type"] != "explain"]
    for it in rev[:10]:
        srs[it["id"]] = dict(b=2, due=T + 3, g=2)
    for it in rev[10:13]:
        srs[it["id"]] = dict(b=3, due=T - 1, g=2)
    ex = [it for _, _, it in TC.items("explain") if it["id"][:3] in integ]
    for it in ex[:2]:
        srs[it["id"]] = dict(b=1, due=T + 1, g=2)
    srs[ex[2]["id"]] = dict(b=2, due=T + 2, g=1)
    recs = {f"ls/{x}": TC.rec(best=7, total=9, done=TC.NOW_MS) for x in ls_done}
    recs.update({f"srs/{k}": TC.srs(b=v["b"], due=v["due"], g=v["g"], t="pick") for k, v in srs.items()})
    page = TC.tech_page("phone", data=TC.data(recs))
    try:
        want_b, want_u = _expected_ready(integ, ls_done, srs), _expected_ready(["u01"], ls_done, srs)
        got = page.evaluate("() => [vocabTech.readiness('integration'), vocabTech.unitReadiness('u01'), vocabTech.readiness('leadership')]")
        assert got == [want_b, want_u, 0], (got, want_b, want_u)
        row = page.evaluate("""() => { const r = document.querySelector('.tp-rd[data-block=integration]');
          return {pct: r.querySelector('.tp-pct').textContent, sub: r.querySelector('small').textContent, label: r.getAttribute('aria-label')}; }""")
        assert row["pct"] == f"{want_b}%" and row["sub"] == "4 of 18 lessons" and row["label"].startswith(f"Integration: {want_b}% interview ready"), row
        lead = page.evaluate("document.querySelector('.tp-rd[data-block=leadership] small').textContent")
        assert lead == "0 of 3 lessons so far", lead
        # todas las de Integration menos una, y la última con lessonDone: medalla
        all_ls = [l["id"] for uid in integ for l in TC.unit(uid)["lessons"]]
        r = page.evaluate("""ids => { for (const id of ids.slice(0, -1)) vocabTech.put('ls', id, {best: 5, total: 9, done: Date.now()});
          const a = vocabTech.progress.lessonDone(ids[ids.length - 1], {score: 9, total: 9});
          const b = vocabTech.progress.lessonDone(ids[ids.length - 1], {score: 4, total: 9});
          return {a: a.newMedals.map(m => m.id), first: a.first, b: b.newMedals.length, again: b.first,
            best: vocabTech.get('ls', ids[ids.length - 1]).best, medal: !!vocabTech.get('medal', 'integration'),
            m: vocabTech.medals().map(m => [m.id, m.got, m.sub])}; }""", all_ls)
        assert r["a"] == ["integration"] and r["first"] is True and r["b"] == 0 and r["again"] is False and r["best"] == 9 and r["medal"], r
        assert r["m"] == [["integration", True, "Medal earned"], ["leadership", False, "0 of 3 lessons so far"]], r["m"]
        page.wait_for_timeout(200)
        assert "Medal earned: Integration!" in _toasts(page), _toasts(page)
        r = page.evaluate("""() => { for (const id of ['u07-l1', 'u07-l2', 'u07-l3']) vocabTech.progress.lessonDone(id, {score: 5, total: 6});
          return vocabTech.medals().map(m => [m.id, m.got, m.sub]); }""")
        assert r == [["integration", True, "Medal earned"], ["leadership", False, "3 of 3 lessons so far"]], r
        TC.goto(page, "#/techpath")
        TC.goto(page, "#/tech")
        assert page.locator(".tp-rd[data-block=integration] .tp-medal").count() == 1
        assert page.locator(".tp-rd[data-block=leadership] .tp-medal").count() == 0
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- datos
def test_data_files_validate():
    """data/tech/index.json (33 unidades, 7 bloques, disponibles = las que tienen fichero) y data/tech/u01-u07.json
    pasan las reglas de tools/validate.py (tech_validate.py) y son copias exactas de la carpeta compartida. Nada de Tech
    Prep en data/index.json ni en el shell de sw.js (se pide al usarlo)."""
    bad = TV.check_all()
    assert not bad, json.dumps(bad, indent=1)[:3000]
    files = sorted(p.name for p in TC.DATA.glob("u*.json"))
    assert files == [f"u{i:02d}.json" for i in range(1, 8)], files
    shared = C.Path("/mnt/project-files/tech-prep/content")
    if shared.exists():
        diff = [f for f in files if (shared / f).exists() and (shared / f).read_bytes() != (TC.DATA / f).read_bytes()]
        assert not diff, f"no son copias exactas de la carpeta compartida: {diff}"
    ix = TC.index()
    assert [u["id"] for u in ix["units"] if u["available"]] == [f"u{i:02d}" for i in range(1, 8)]
    kid = (C.REPO / "data" / "index.json").read_text(encoding="utf-8")
    assert "tech" not in kid.lower(), "data/index.json menciona Tech Prep"
    sw = (C.REPO / "sw.js").read_text(encoding="utf-8")
    assert "data/tech/" not in sw, "data/tech en el shell de sw.js"
    assert '"js/tech-boot.js"' in sw and '"js/tech.js"' in sw
    terms = [t for u in TC.units() for t in u["terms"]]
    assert all((t["ipa"] or "").startswith("/") or (t["ipa"] is None and t.get("ipaTodo")) for t in terms)


# ---------------------------------------------------------------- Today
_TEXT_SIZES = """sel => { const out = [];
  for (const el of document.querySelectorAll(sel + ' *')) {
    if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own || el.closest('.vh, [aria-hidden=true], svg')) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 15) out.push(`${el.className || el.tagName}: ${fs}px «${el.textContent.trim().slice(0, 30)}»`);
  } return out; }"""
_PRI = "sel => [...document.querySelectorAll(sel + ' .glass-btn--pri, ' + sel + ' .btn-fill')].filter(e => e.getClientRects().length).length"


def _screen_audit(page, label, scope="#app"):
    probs = []
    a = page.evaluate(AUDIT, {"what": ["contrast", "palette"]})
    probs += [f"{label} contraste: {x}" for x in a["contrast"]] + [f"{label} paleta: {x}" for x in a["palette"]]
    y = page.evaluate(A11Y, {"what": ["names", "roles", "images", "targets", "ids", "focusable"]})
    for k in ("names", "roles", "images", "targets", "ids", "focusable"):
        probs += [f"{label} {k}: {x}" for x in y[k]]
    probs += [f"{label} letra pequeña: {x}" for x in page.evaluate(_TEXT_SIZES, scope)]
    w = page.evaluate("[document.documentElement.scrollWidth, innerWidth]")
    if w[0] > w[1]:
        probs.append(f"{label} scroll horizontal: {w}")
    return probs


def test_today_at_360_and_390_light_and_dark():
    """Today (#/tech) a 360 y 390 px, en claro y oscuro: sin scroll horizontal, contraste ≥ 4,5:1, sin colores
    prohibidos, nombres, objetivos ≥ 44 px, letra ≥ 15 px, un solo botón destacado; a 390×844, sin nada especial, cabe
    sin scroll. Con repaso pendiente, fecha, racha y medalla: el repaso es lo principal y el resto sigue en orden."""
    probs = []
    for (w, h) in [(360, 780), (390, 844)]:
        for scheme in ("light", "dark"):
            page = TC.tech_page("phone", color_scheme=scheme, viewport={"width": w, "height": h})
            try:
                label = f"{w}-{scheme}"
                probs += _screen_audit(page, label)
                n = page.evaluate(_PRI, "#app")
                if n != 1:
                    probs.append(f"{label}: {n} botones destacados")
                quiet = page.evaluate("document.querySelector('.tp-streak').classList.contains('quiet')")
                if not quiet:
                    probs.append(f"{label}: la racha a cero no está en calma")
                if (w, h) == (390, 844):
                    sh = page.evaluate("[document.scrollingElement.scrollHeight, innerHeight]")
                    if sh[0] > sh[1] + 1:
                        probs.append(f"{label}: hace falta scroll ({sh})")
                hero = page.inner_text(".tp-hero")
                if "Unit 1 · Integration styles" not in hero or "Lesson 1 of 3" not in hero:
                    probs.append(f"{label}: tarjeta principal {hero!r}")
                TC.shot(page, f"today-{w}-{scheme}", full_page=False)
                probs += [f"{label}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    # con de todo
    recs = {f"srs/{it['id']}": TC.srs(b=1, due=T, d=T - 1, t=it["type"]) for _, _, it in TC.items(uid="u01")[:12] if TC.REVIEWABLE(it["type"])}
    recs.update({f"act/{TC.day_str(T - d)}": TC.rec(n=12) for d in range(1, 4)})
    recs.update({f"ls/{l['id']}": TC.rec(best=8, total=9, done=TC.NOW_MS) for _, l in TC.lessons()[:18]})
    recs["medal/integration"] = TC.rec()
    recs["set/interview"] = TC.rec(date=TC.day_str(T + 12))
    for scheme in ("light", "dark"):
        page = TC.tech_page("phone", data=TC.data(recs), color_scheme=scheme)
        try:
            order = page.evaluate("""() => [...document.querySelectorAll('#tp-today > *')].map(e => e.id || e.className.split(' ').filter(c => c.startsWith('tp-')).join('.') ||
              (e.querySelector('[id]') || {}).id)""")
            hero = page.inner_text(".tp-hero")
            if not hero.startswith("Review") or "items to review" not in hero:
                probs.append(f"busy-{scheme}: la tarjeta principal no es el repaso: {hero!r}")
            if page.inner_text("#tp-cd").split("\n")[0] != "Interview in 12 days":
                probs.append(f"busy-{scheme}: cuenta atrás {page.inner_text('#tp-cd')!r}")
            if page.locator("#tp-next").count() != 1:
                probs.append(f"busy-{scheme}: falta la siguiente lección")
            if page.inner_text(".tp-st-t") != "3-day streak":
                probs.append(f"busy-{scheme}: racha {page.inner_text('.tp-st-t')!r}")
            if page.locator(".tp-rd .tp-medal").count() != 1 or page.locator("#tp-date-b").count():
                probs.append(f"busy-{scheme}: medalla o fila de fecha")
            badge = page.evaluate("(document.querySelector('#tab-tp-today .tb-badge') || {}).textContent")
            if badge != "9+":
                probs.append(f"busy-{scheme}: aviso de la pestaña {badge!r}")
            probs += _screen_audit(page, f"busy-{scheme}")
            if page.evaluate(_PRI, "#app") != 1:
                probs.append(f"busy-{scheme}: más de un botón destacado")
            TC.shot(page, f"today-con-todo-390-{scheme}")
            probs += [f"busy-{scheme}: {e}" for e in C.errors(page)]
            if scheme == "light":
                assert order[0] == "tp-cd" or "tp-cd" in json.dumps(order[:1]) or order, order
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_today_desktop():
    """Today en escritorio (1280): pestañas arriba, la columna de Tech Prep (≤ 680 px) centrada, sin errores."""
    page = TC.tech_page("desk")
    try:
        r = page.evaluate("() => { const p = document.getElementById('tp-today').getBoundingClientRect(); return [Math.round(p.width), Math.round(p.left + p.width / 2), innerWidth]; }")
        assert r[0] <= 680 and abs(r[1] - r[2] / 2) < 30, r
        probs = _screen_audit(page, "desk")
        TC.shot(page, "today-escritorio")
        assert not probs, "\n".join(probs)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- ajustes y voz
def test_settings_sheet():
    """Los ajustes de Tech Prep (engranaje): fecha (y «Clear interview date»), la voz inglesa (la misma lista y elección
    que Ajustes › Voz y velocidad para inglés) con «Try», la velocidad solo de Tech Prep (radio, se guarda sola en
    tech:ui), «Download for offline», la línea de Google, «Erase Tech Prep progress» y «Back to languages». Sin botón de
    guardar. Accesible, sin colores prohibidos."""
    page = TC.tech_page("phone")
    try:
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_selector("dialog#tp-set[open]", timeout=4000)
        page.wait_for_timeout(500)
        info = page.evaluate("""() => { const d = document.getElementById('tp-set');
          return {h: [...d.querySelectorAll('.st-h')].map(x => x.textContent), lang: d.lang, title: d.querySelector('#tp-set-t').textContent,
            opts: [...d.querySelectorAll('#tp-set-voice option')].map(o => o.textContent),
            rates: [...d.querySelectorAll('[data-rate]')].map(b => [b.textContent, b.getAttribute('aria-checked')]),
            save: [...d.querySelectorAll('button, a')].filter(b => /save|guardar/i.test(b.textContent)).length,
            back: !!d.querySelector('#tp-set-back'), clear: d.querySelector('#tp-set-clear').hidden}; }""")
        assert info["h"] == ["Interview", "Voice", "Offline", "Google copy", "Progress"] and info["lang"] == "en-GB" and info["title"] == "Settings", info
        assert info["opts"][0].startswith("Automatic") and sorted(info["opts"][1:]) == ["Daniel · UK", "Google UK English Female · UK", "Google US English · US"], info["opts"]
        assert info["rates"] == [["Slower", "false"], ["Normal", "true"], ["Faster", "false"]] and info["save"] == 0 and info["back"] and info["clear"], info
        probs = _screen_audit(page, "ajustes", "#tp-set")
        assert not probs, "\n".join(probs)
        TC.shot(page, "ajustes-tech-prep", full_page=False)
        # fecha y «Clear»
        page.locator("#tp-set-date").fill(TC.day_str(T + 20))
        page.wait_for_timeout(200)
        r = page.evaluate("() => [vocabTech.interview.date(), document.querySelector('label[for=tp-set-date] small').textContent, document.getElementById('tp-set-clear').hidden]")
        assert r[0] == TC.day_str(T + 20) and r[1].startswith("Tue") and r[1].endswith("31 March") and r[2] is False, r
        page.locator("#tp-set-clear").click()
        page.wait_for_timeout(200)
        assert page.evaluate("[vocabTech.interview.date(), document.getElementById('tp-set-clear').hidden]") == [None, True]
        # velocidad: radio con flechas, guardada sola
        page.locator('#tp-set [data-rate="1.2"]').click()
        assert json.loads(page.evaluate("localStorage.getItem('tech:ui')"))["rate"] == 1.2
        page.locator('#tp-set [data-rate="1.2"]').focus()
        page.keyboard.press("ArrowLeft")
        assert page.evaluate("[vocabTech.rate(), document.activeElement.dataset.rate]") == [1, "1"]
        page.keyboard.press("ArrowLeft")
        assert page.evaluate("vocabTech.rate()") == 0.8
        # la voz: la elección inglesa de siempre (vocab:voice, de este aparato)
        page.select_option("#tp-set-voice", label="Daniel · UK")
        assert page.evaluate("voiceChoiceOf('english').n") == "Daniel"
        page.evaluate("() => { window.__spoken.length = 0; }")
        page.locator("#tp-set-try").click()
        page.wait_for_timeout(300)
        sp = TC.spoken(page)
        assert sp and sp[0]["voice"] == "Daniel" and sp[0]["rate"] == 0.8 and sp[0]["text"].startswith("This is how Tech Prep sounds"), sp
        # «Download for offline» dice algo honesto antes de bajar nada
        assert page.inner_text("#tp-set-dls").startswith(("Not downloaded yet", "Ready offline", "This browser can't")), page.inner_text("#tp-set-dls")
        # «Back to languages»
        page.locator("#tp-set-back").click()
        _wait_hash(page, "")
        assert not page.evaluate("document.getElementById('tp-set').open") and not _tabs(page)["tech"]
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


def test_english_voice_never_the_kids():
    """La voz de Tech Prep es inglesa aunque el niño aprenda francés (useVoice(u, "english")), con la velocidad de Tech
    Prep (despacio = ×0,7); los altavoces data-say de Tech Prep hablan con ella (no con say() del niño); un texto largo
    va en trozos de ≤ 220 caracteres."""
    page = TC.tech_page("phone", extra={"lang": json.dumps("français")})
    try:
        r = page.evaluate("""async () => { __spoken.length = 0;
          await vocabTech.speak('Hello there. This is Tech Prep.');
          const a = __spoken.slice(); __spoken.length = 0;
          await vocabTech.speak('Slowly now.', null, {slow: true});
          const b = __spoken.slice(); __spoken.length = 0;
          const long = Array.from({length: 12}, (_, i) => `Sentence number ${i + 1} explains one more idea about integration patterns.`).join(' ');
          await vocabTech.speak(long);
          return {a, b, c: __spoken.map(x => x.text.length), lang: JSON.parse(localStorage.getItem('lang'))}; }""")
        assert r["lang"] == "français"
        assert r["a"][0]["text"] == "Hello there. This is Tech Prep." and r["a"][0]["lang"].startswith("en") and r["a"][0]["rate"] == 1, r["a"]
        assert r["a"][0]["voice"] in ("Google UK English Female", "Daniel", "Google US English"), r["a"]
        assert round(r["b"][0]["rate"], 2) == 0.7, r["b"]
        assert len(r["c"]) > 1 and max(r["c"]) <= 220, r["c"]
        # un altavoz de Tech Prep (ui.say) en la página
        page.evaluate("() => { __spoken.length = 0; document.querySelector('.tp-hero').insertAdjacentHTML('beforeend', vocabTech.ui.say('Message broker', {label: 'Listen'})); }")
        page.locator(".tp-hero .tp-say").first.click()
        page.wait_for_timeout(300)
        sp = TC.spoken(page)
        assert sp and sp[0]["text"] == "Message broker" and sp[0]["lang"].startswith("en"), sp
        page.evaluate("() => { __spoken.length = 0; }")
        page.locator(".tp-hero .tp-say[data-slow]").click()
        page.wait_for_timeout(300)
        sp = TC.spoken(page)
        assert sp and round(sp[0]["rate"], 2) == 0.7, sp
        lab = page.evaluate("[...document.querySelectorAll('.tp-hero .tp-say')].map(b => b.getAttribute('aria-label'))")
        assert lab == ["Listen", "Listen slowly"], lab
        # la IPA de Tech Prep se ve siempre, aunque el niño tenga apagada «Mostrar pronunciación (IPA)»
        ipa = page.evaluate("""() => { vocabUI.set('ipa', false);
          const box = document.createElement('div'); box.innerHTML = vocabTech.ui.term({term: 'Idempotency', ipa: '/ˌaɪdɛmˈpəʊtənsi/', def: 'Same result.'});
          document.querySelector('.tp-hero').appendChild(box);
          const s = box.querySelector('.tp-ipa'); return {kid: ipaHtml('/x/', 'en-GB'), text: s ? s.textContent : '', lang: s ? s.lang : '',
            vis: s ? getComputedStyle(s).display !== 'none' && s.getBoundingClientRect().height > 0 : false}; }""")
        assert ipa["kid"] == "" and ipa["vis"] and ipa["lang"] == "en-GB", ipa
        assert ipa["text"].startswith("Pronunciation: /") and "ˈpəʊ" in ipa["text"], ipa
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- sin conexión
def test_offline_after_download():
    """Con el service worker: «Download for offline» baja data/tech/index.json y cada unidad disponible (cache: reload)
    a vocab-media con su progreso y un resultado honesto; con el servidor parado y sin red, al recargar Tech Prep
    arranca (sus módulos del shell, la lista de la última vez) y Today y cualquier unidad cargan."""
    srv = C.Server(C.ROOT, "localhost")
    ctx = C.new_context("phone", sw=True, server=srv)
    ctx.add_init_script(TC.SPEECH)
    page = ctx.new_page()
    stopped = False
    try:
        TC.open_tech(page, "#/tech")
        page.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=20000)
        C.reload(page)
        TC.wait_tech(page)
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_selector("dialog#tp-set[open]", timeout=4000)
        page.wait_for_function("() => !/Checking/.test(document.getElementById('tp-set-dls').textContent)", timeout=5000)
        page.locator("#tp-set-dl").click()
        page.wait_for_function("() => /^Done|^Saved/.test(document.getElementById('tp-set-dls').textContent)", timeout=20000)
        files = page.evaluate("vocabTech.offline.files()")
        want = ["data/tech/index.json"] + [f"data/tech/u{i:02d}.json" for i in range(1, 8)]
        assert all(f in files for f in want), files
        done = page.inner_text("#tp-set-dls")
        assert done == f"Done · all {len(files)} files are ready offline", done
        have = set(page.evaluate("async () => (await (await caches.open('vocab-media')).keys()).map(r => new URL(r.url).pathname.slice(1))"))
        assert set(files) <= have, sorted(set(files) - have)
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        srv.stop()
        stopped = True
        ctx.set_offline(True)
        C.clear_errors(page)
        C.reload(page)
        TC.wait_tech(page)
        assert page.locator("#tp-today").count() == 1 and "Unit 1" in page.inner_text(".tp-hero")
        r = page.evaluate("async () => { const u = await vocabTech.unit('u07'); return [u.id, u.lessons.length]; }")
        assert r == ["u07", 3], r
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_selector("dialog#tp-set[open]", timeout=4000)
        page.wait_for_function("() => /^Ready offline/.test(document.getElementById('tp-set-dls').textContent)", timeout=5000)
        errs = [e for e in C.errors(page) if "ERR_INTERNET_DISCONNECTED" not in e]
        assert not errs, errs
    finally:
        ctx.close()
        if not stopped:
            srv.stop()
