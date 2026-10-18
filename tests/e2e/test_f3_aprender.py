"""F3c: Aprender › Camino (#/mapa), Palabras (#/palabras), la ficha de un tema (#/doc/<id>) y Gramática (#/gramatica)
en js/learn.js.
La pastilla de nivel (levelPicker) cambia de nivel en el Camino y en Gramática y guarda "mapLv" como antes (el Camino
lo escribe, Gramática no); «Mi lección» sale cuando la lección actual no se ve y lleva hasta ella; mantener pulsado un
nodo hecho abre el vistazo con sus estrellas y «Repetir» (sin abrir la lección al soltar) y tocarlo abre la lección;
#/palabras tiene tres grupos (Temas, Las 3000 y Avanzado plegado) con anillos que cuentan las palabras de srs:<idioma>;
la ficha abre en Tarjetas, el control segmentado cambia de modo (y se recuerda en la sesión), la fila se despliega y
deslizarla a la izquierda la manda al repaso con el mismo formato que srsAdd(id, [fila], 0) (el «➕ Al repaso» de
antes); Preguntas puntúa con srsGrade como antes, falla en gris y paga una vez; Escribir guarda prPrefs, prAuto, prEx y
pr:<tema>:<idioma> con la forma de siempre; Gramática despliega la teoría y «Practicar» abre su lección; cada ruta carga
bien con la URL directa. Sin errores de consola y la partida igual que la de la base."""
from __future__ import annotations

import json
import re

import common as C
import routes as R

_PLAN = C.seed_plan()
_GRAM = json.loads((C.REPO / "data" / "grammar_en.json").read_text(encoding="utf-8"))
_INDEX = json.loads((C.REPO / "data" / "index.json").read_text(encoding="utf-8"))
_LVS = ["A1", "A2", "B1", "B2", "C1", "C2"]


def _keys(**extra):
    """La partida sembrada con las pistas de gestos ya aprendidas (vocab:ui no va en la partida): así ninguna pista
    tapa lo que se toca en la prueba."""
    k = C.seed_keys()
    k["vocab:ui"] = {"hints": {"map-peek": 1000, "doc-swipe": 1000}}
    k.update(extra)
    return k


def _ls(page, k):
    return page.evaluate("k => { const v = localStorage.getItem(k); return v === null ? null : JSON.parse(v); }", k)


def _wait_hash(page, h, timeout=6000):
    page.wait_for_function("h => location.hash === h", arg=h, timeout=timeout)
    C.settle(page, 250)


_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""

# award(n, por qué, quiet, from), toast(texto, icono) y los «answer» del bus
_SPY = """() => { if (window.__spy) return; window.__spy = 1; window.__aw = []; window.__toasts = []; window.__ans = [];
  const a0 = window.award; window.award = function(n, why, quiet, from){ window.__aw.push([n, why, !!quiet, from && from.id || null]); return a0.apply(this, arguments); };
  const t0 = window.toast; window.toast = function(t, ic){ window.__toasts.push([String(t), ic || null]); return t0.apply(this, arguments); };
  bus.on('answer', d => window.__ans.push(d)); }"""

# deslizar con PointerEvents sintéticos (como un dedo) sobre un elemento: baja a 60 % del ancho, se mueve y suelta
_SWIPE = """async ([sel, dxs]) => {
  const el = document.querySelector(sel); el.scrollIntoView({block: 'center'});
  const pause = ms => new Promise(f => setTimeout(f, ms));
  await pause(60);
  const r = el.getBoundingClientRect(), x0 = r.left + r.width * .6, y0 = r.top + r.height / 2;
  const ev = (type, x, b) => new PointerEvent(type, {pointerId: 41, pointerType: 'touch', isPrimary: true, button: 0, buttons: b,
    clientX: x, clientY: y0, bubbles: true, cancelable: true, composed: true});
  el.dispatchEvent(ev('pointerdown', x0, 1));
  const tr = [];
  for (const dx of dxs) { await pause(16); el.dispatchEvent(ev('pointermove', x0 + dx, 1)); tr.push(el.style.translate || ''); }
  el.dispatchEvent(ev('pointerup', x0 + dxs[dxs.length - 1], 0));
  await pause(60);
  return {tr, wide: document.documentElement.scrollWidth > innerWidth}; }"""

# lo que habría escrito la función de siempre: se vuelve a srs:<idioma> de antes, se llama a fn(id, fila, arg) y se
# compara; después se deja lo que había escrito la pantalla
_EXPECT = """([fn, id, es, arg, before]) => {
  const K = 'srs:' + lang, put = v => v === null ? localStorage.removeItem(K) : localStorage.setItem(K, v);
  const after = localStorage.getItem(K), actA = localStorage.getItem('act');
  put(before.srs); if (before.act === null) localStorage.removeItem('act'); else localStorage.setItem('act', before.act);
  const r = CACHE[id].rows.find(r => r.es === es && r.l && r.l[lang]);
  if (fn === 'add') srsAdd(id, [r], arg); else srsGrade(id, r, arg);
  const exp = localStorage.getItem(K), actE = localStorage.getItem('act');
  put(after); if (actA === null) localStorage.removeItem('act'); else localStorage.setItem('act', actA);
  updBadge();
  const k = id + '|' + es;
  return {same: after === exp && actA === actE, entry: JSON.parse(after || '{}')[k] || null, want: JSON.parse(exp || '{}')[k] || null,
    was: JSON.parse(before.srs || '{}')[k] || null}; }"""
_SNAP = "() => ({srs: localStorage.getItem('srs:' + lang), act: localStorage.getItem('act')})"


def _rgb(s):
    m = re.findall(r"[\d.]+", s or "")
    return [float(x) for x in m[:3]] if len(m) >= 3 else None


# ---------------------------------------------------------------------------------------------------- pastilla de nivel
def test_level_picker_camino_and_gramatica():
    """La pastilla «A1 ▾» abre un menú (role=menu) con los 6 niveles, su nombre, su progreso y la ✓ en el actual;
    elegir uno navega a #/mapa/<nivel> y guarda mapLv (como antes); #/mapa sin nivel abre el guardado. En Gramática la
    misma pastilla lleva a #/gramatica/<nivel> sin tocar mapLv (como antes). Esc cierra y devuelve el foco; las flechas
    recorren el menú; con el menú abierto, html[data-menu]."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page, keys=_keys())
        C.goto(page, "#/mapa")
        st = page.evaluate("""() => { const b = document.querySelector('#app .lvp-b'), m = document.querySelector('#app .lvp-m');
          return {b: b && b.textContent.trim(), exp: b && b.getAttribute('aria-expanded'), hidden: m && m.hidden, role: m && m.getAttribute('role'),
            gift: (document.querySelector('.cm-gift') || {}).textContent || '', dots: document.querySelectorAll('.cm-gift .cm-dots i').length,
            old: !!document.querySelector('.lv-head, .lv-tabs, .lv-links'), sum: (document.querySelector('.cm-sum') || {}).textContent || ''}; }""")
        if st["b"] != "A1" or st["exp"] != "false" or not st["hidden"] or st["role"] != "menu":
            probs.append(f"pastilla de nivel al entrar: {st}")
        if "Regalo" not in st["gift"] or st["dots"] != 5:
            probs.append(f"fila del regalo: «{st['gift']}» con {st['dots']} puntos")
        if st["old"]:
            probs.append("siguen la tarjeta verde, las pestañas de nivel o «Ver toda la gramática»")
        done = len([x for x in _PLAN["done"] if x.startswith("A1-") or x.startswith("G-A1")])
        if f"{done} de " not in st["sum"]:
            probs.append(f"el resumen del nivel no dice «{done} de …»: «{st['sum']}»")
        page.locator("#app .lvp-b").click()
        page.wait_for_timeout(350)
        m = page.evaluate("""() => { const m = document.querySelector('#app .lvp-m');
          return {hidden: m.hidden, exp: document.querySelector('#app .lvp-b').getAttribute('aria-expanded'), menu: document.documentElement.hasAttribute('data-menu'),
            focus: document.activeElement && document.activeElement.textContent.trim().slice(0, 2),
            items: [...m.querySelectorAll('.lvp-i')].map(a => ({k: a.querySelector('b').textContent, t: a.querySelector('.lvp-t').textContent,
              n: a.querySelector('.lvp-n').textContent, on: a.getAttribute('aria-checked'), href: a.getAttribute('href'), role: a.getAttribute('role'),
              chk: getComputedStyle(a.querySelector('.lvp-chk')).visibility !== 'hidden' && getComputedStyle(a.querySelector('.lvp-chk')).opacity !== '0'}))}; }""")
        if m["hidden"] or m["exp"] != "true" or not m["menu"]:
            probs.append(f"el menú no se abre bien: {m}")
        ks = [x["k"] for x in m["items"]]
        if ks != _LVS:
            probs.append(f"niveles del menú: {ks}")
        a1 = next((x for x in m["items"] if x["k"] == "A1"), {})
        if a1.get("on") != "true" or a1.get("n", "").split("/")[0] != str(done) or "Principiante" not in a1.get("t", ""):
            probs.append(f"A1 en el menú: {a1}")
        if any(x["href"] != f"#/mapa/{x['k']}" or x["role"] != "menuitemradio" for x in m["items"]):
            probs.append(f"enlaces del menú: {[x['href'] for x in m['items']]}")
        if [x["k"] for x in m["items"] if x["chk"]] != ["A1"]:
            probs.append(f"la ✓ no está solo en A1: {[x['k'] for x in m['items'] if x['chk']]}")
        if m["focus"] != "A1":
            probs.append(f"al abrir, el foco no va al nivel actual: {m['focus']!r}")
        page.keyboard.press("ArrowDown")
        f2 = page.evaluate("() => document.activeElement && document.activeElement.querySelector('b') && document.activeElement.querySelector('b').textContent")
        if f2 != "A2":
            probs.append(f"↓ no lleva a A2: {f2!r}")
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
        esc = page.evaluate("() => ({hidden: document.querySelector('#app .lvp-m').hidden, menu: document.documentElement.hasAttribute('data-menu'), "
                            "focus: document.activeElement && document.activeElement.classList.contains('lvp-b')})")
        if not esc["hidden"] or esc["menu"] or not esc["focus"]:
            probs.append(f"Esc no cierra el menú o no devuelve el foco: {esc}")
        # elegir A2
        page.locator("#app .lvp-b").click()
        page.wait_for_timeout(300)
        page.locator("#app .lvp-i", has_text="Elemental").click()
        _wait_hash(page, "#/mapa/A2")
        if _ls(page, "mapLv") != "A2":
            probs.append(f"elegir A2 no guarda mapLv: {_ls(page, 'mapLv')!r}")
        b2 = page.evaluate("() => ({b: document.querySelector('#app .lvp-b').textContent.trim(), m: document.querySelector('#app .lvp-m').hidden, menu: document.documentElement.hasAttribute('data-menu')})")
        if b2["b"] != "A2" or not b2["m"] or b2["menu"]:
            probs.append(f"tras elegir A2: {b2}")
        C.goto(page, "#/")
        C.goto(page, "#/mapa")
        if page.evaluate("() => document.querySelector('#app .lvp-b').textContent.trim()") != "A2":
            probs.append("#/mapa sin nivel no abre el guardado (A2)")
        # Gramática: lee mapLv y no lo cambia
        C.goto(page, "#/gramatica")
        g = page.evaluate("""() => ({b: document.querySelector('#app .lvp-b').textContent.trim(), rows: document.querySelectorAll('#app .gr-u').length,
          back: !!document.querySelector('#app .back'), sub: !!document.querySelector('#app p.sub')})""")
        if g["b"] != "A2" or g["rows"] != len(_GRAM.get("A2", [])):
            probs.append(f"Gramática sin nivel: {g} (se esperaba A2 con {len(_GRAM.get('A2', []))} temas)")
        if g["back"] or g["sub"]:
            probs.append("en Gramática siguen «← Mapa» o el texto de ayuda")
        page.locator("#app .lvp-b").click()
        page.wait_for_timeout(300)
        n = page.evaluate("() => [...document.querySelectorAll('#app .lvp-i')].map(a => [a.querySelector('b').textContent, a.getAttribute('href'), a.querySelector('.lvp-n').textContent])")
        want = [[k, f"#/gramatica/{k}", f"{len([1 for i, _ in enumerate(_GRAM.get(k, [])) if f'G-{k}-{i + 1:02d}' in _PLAN['done']])}/{len(_GRAM.get(k, []))}"] for k in _LVS]
        if n != want:
            probs.append(f"menú de Gramática: {n} (se esperaba {want})")
        page.locator("#app .lvp-i", has_text="Intermedio").first.click()
        _wait_hash(page, "#/gramatica/B1")
        if _ls(page, "mapLv") != "A2":
            probs.append(f"elegir nivel en Gramática cambia mapLv: {_ls(page, 'mapLv')!r}")
        if page.evaluate("() => document.querySelector('#app .lvp-b').textContent.trim()") != "B1":
            probs.append("Gramática no pasa a B1")
        # tocar fuera cierra
        page.locator("#app .lvp-b").click()
        page.wait_for_timeout(250)
        page.mouse.click(370, 700)
        page.wait_for_timeout(200)
        if not page.evaluate("() => document.querySelector('#app .lvp-m').hidden"):
            probs.append("tocar fuera no cierra el menú")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------------------------------------------- Camino
def test_my_lesson_pill():
    """Al entrar por la pestaña el Camino no se mueve (F2); la lección actual queda abajo y sale «Mi lección» (↓) en
    vidrio ligero; tocarla baja con scroll hasta la lección actual (que queda a la vista y con el foco) y la pastilla
    se va; muy abajo vuelve con ↑. Con el nivel en la ruta (#/mapa/A1) baja solo. Como mucho 3 superficies con
    desenfoque."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page, keys=_keys())
        C.goto(page, "#/mapa")
        page.wait_for_timeout(400)
        if page.evaluate("scrollY") != 0:
            probs.append(f"al entrar por la pestaña el Camino se mueve (scrollY {page.evaluate('scrollY')})")
        page.wait_for_function("() => { const b = document.getElementById('cm-jump'); return b && !b.hidden; }", timeout=3000)
        st = page.evaluate("""() => { const b = document.getElementById('cm-jump'), cs = getComputedStyle(b), r = b.getBoundingClientRect();
          const blur = [...document.querySelectorAll('body *')].filter(el => { const s = getComputedStyle(el); const f = s.backdropFilter || s.webkitBackdropFilter;
            return f && f !== 'none' && el.getClientRects().length && s.visibility !== 'hidden'; }).length;
          return {txt: b.textContent.trim(), up: b.classList.contains('up'), label: b.getAttribute('aria-label'), pos: cs.position,
            bf: cs.backdropFilter || cs.webkitBackdropFilter || 'none', inView: r.top >= 0 && r.bottom <= innerHeight, blur,
            tab: (() => { const t = document.getElementById('tabbar'); return t ? t.getBoundingClientRect().top : innerHeight; })(), bottom: r.bottom}; }""")
        if st["txt"] != "Mi lección" or st["up"] or st["label"] != "Bajar a mi lección" or st["pos"] != "fixed" or not st["inView"]:
            probs.append(f"«Mi lección» al entrar: {st}")
        if st["bf"] != "none":
            probs.append(f"«Mi lección» lleva desenfoque ({st['bf']}): debe ser vidrio ligero")
        if st["blur"] > 3:
            probs.append(f"{st['blur']} superficies con desenfoque (máximo 3)")
        if st["bottom"] > st["tab"] + 1:
            probs.append(f"«Mi lección» queda bajo la barra de pestañas ({st['bottom']} > {st['tab']})")
        page.locator("#cm-jump").click()
        page.wait_for_function("""() => { const c = document.getElementById('cur-node'); if (!c) return false; const r = c.getBoundingClientRect();
          return r.top >= 60 && r.bottom <= innerHeight - 100 && document.getElementById('cm-jump').hidden; }""", timeout=4000)
        page.wait_for_timeout(600)
        f = page.evaluate("() => ({focus: document.activeElement && document.activeElement.id, ls: document.activeElement && document.activeElement.dataset.ls})")
        if f["focus"] != "cur-node" or f["ls"] != _PLAN["next_lesson"]:
            probs.append(f"tras «Mi lección», el foco no está en la lección actual: {f}")
        page.evaluate("scrollTo(0, document.documentElement.scrollHeight)")
        page.wait_for_function("() => { const b = document.getElementById('cm-jump'); return b && !b.hidden && b.classList.contains('up'); }", timeout=3000)
        if page.evaluate("document.getElementById('cm-jump').getAttribute('aria-label')") != "Subir a mi lección":
            probs.append("muy abajo, la pastilla no dice «Subir a mi lección»")
        page.locator("#cm-jump").click()
        page.wait_for_function("() => document.getElementById('cm-jump').hidden", timeout=4000)
        # con el nivel en la ruta baja solo
        C.goto(page, "#/")
        C.goto(page, "#/mapa/A1")
        page.wait_for_timeout(500)
        r = page.evaluate("() => { const c = document.getElementById('cur-node').getBoundingClientRect(); return {y: scrollY, top: c.top, bottom: c.bottom, h: innerHeight}; }")
        if r["y"] <= 0 or r["top"] < 0 or r["bottom"] > r["h"]:
            probs.append(f"#/mapa/A1 no baja hasta la lección actual: {r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_hold_done_node_peek_and_tap():
    """Mantener pulsado un nodo hecho abre el vistazo (hoja con «Lección N», sus estrellas, sus palabras y «Repetir»)
    y al soltar no se abre la lección; «Repetir» abre la lección. Tocar un nodo bloqueado da un aviso amable y no
    navega; tocar uno hecho o el actual abre su lección. Nodos limpios: hecho en verde con ✓, el actual en azul,
    bloqueado en gris, sin sombra gruesa."""
    probs = []
    done = R.DONE_LESSON
    page = C.new_page("phone")
    try:
        C.seed(page, keys=_keys())
        C.goto(page, "#/mapa")
        page.evaluate(_SPY)
        look = page.evaluate("""([d, c]) => { const q = s => document.querySelector(s), bg = el => getComputedStyle(el).backgroundColor, sh = el => getComputedStyle(el).boxShadow;
          const dn = q(`.node[data-ls="${d}"]`), cur = q(`.node[data-ls="${c}"]`), lock = q('.node.lock[data-ls]');
          return {done: dn && dn.classList.contains('done'), dbg: bg(dn), cbg: bg(cur), lbg: bg(lock), dsh: sh(dn), chk: !!dn.querySelector('svg use[href="#i-check-bold"]'),
            stars: dn.parentElement.querySelectorAll('.stars .ln-star.on').length, curId: cur && cur.id, lockLabel: lock.getAttribute('aria-label'), lockId: lock.dataset.ls}; }""",
                             [done, _PLAN["next_lesson"]])
        g = _rgb(look["dbg"]); b = _rgb(look["cbg"]); l = _rgb(look["lbg"])
        if not look["done"] or not look["chk"] or not g or not (g[1] > g[0] and g[1] > g[2]):
            probs.append(f"el nodo hecho no es verde con ✓: {look}")
        if not b or not (b[2] > b[0] and b[2] > b[1]) or look["curId"] != "cur-node":
            probs.append(f"el nodo actual no es azul: {look}")
        if not l or max(l) - min(l) > 24:
            probs.append(f"el nodo bloqueado no es gris: {look['lbg']}")
        if re.search(r"0px [4-9]px 0px|0px \d\dpx 0px", look["dsh"] or ""):
            probs.append(f"el nodo hecho lleva la sombra gruesa 3D: {look['dsh']}")
        stars_done = (_ls(page, "map:english") or {}).get(done, 0)
        if look["stars"] != stars_done:
            probs.append(f"estrellas del nodo hecho: {look['stars']} (se esperaba {stars_done})")
        # bloqueado: aviso y nada más
        page.locator(f'.node[data-ls="{look["lockId"]}"]').click()
        page.wait_for_timeout(300)
        if C.current_hash(page) != "mapa":
            probs.append(f"tocar un nodo bloqueado navega a #/{C.current_hash(page)}")
        ts = page.evaluate("window.__toasts")
        if not ts or "Primero" not in ts[-1][0]:
            probs.append(f"tocar un nodo bloqueado no da el aviso amable: {ts}")
        # mantener pulsado el hecho
        node = page.locator(f'.node[data-ls="{done}"]')
        node.scroll_into_view_if_needed()
        page.wait_for_timeout(200)
        bb = node.bounding_box()
        page.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
        page.mouse.down()
        page.wait_for_timeout(750)
        page.mouse.up()
        page.wait_for_selector("dialog#cm-pk[open]", timeout=3000)
        page.wait_for_timeout(500)
        pk = page.evaluate("""() => { const d = document.getElementById('cm-pk'), a = d.querySelector('[data-go]');
          return {h: d.querySelector('h2').textContent, on: d.querySelectorAll('.cm-pk-st .ln-star.on').length, words: d.querySelectorAll('.cm-pk-w span').length,
            go: a && a.textContent.trim(), href: a && a.getAttribute('href'), modal: d.matches(':modal'), hash: location.hash}; }""")
        if pk["hash"] != "#/mapa":
            probs.append(f"al soltar tras mantener se abre la lección ({pk['hash']})")
        if not pk["modal"] or pk["go"] != "Repetir" or pk["href"] != f"#/leccion/{done}" or pk["on"] != stars_done:
            probs.append(f"vistazo: {pk}")
        if not pk["h"].startswith("Lección") or pk["words"] < 3:
            probs.append(f"el vistazo no dice la lección o sus palabras: {pk}")
        page.locator("#cm-pk [data-go]").click()
        _wait_hash(page, f"#/leccion/{done}")
        if page.evaluate("document.getElementById('cm-pk') && document.getElementById('cm-pk').open"):
            probs.append("el vistazo sigue abierto en la lección")
        probs += C.errors(page)
    finally:
        page.context.close()
    # tocar abre la lección
    page = C.new_page("phone")
    try:
        C.seed(page, keys=_keys())
        C.goto(page, "#/mapa/A1")
        page.locator(f'.node[data-ls="{done}"]').click()
        _wait_hash(page, f"#/leccion/{done}")
        if not page.locator("#app .ls, #app [class*=ls-]").count():
            probs.append("tocar un nodo hecho no pinta la lección")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = C.new_page("desk")
    try:
        C.seed(page, keys=_keys())
        C.goto(page, "#/mapa/A1")
        page.locator("#cur-node").click()
        _wait_hash(page, f"#/leccion/{_PLAN['next_lesson']}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------------------------------------------- Palabras
def test_palabras_groups_and_rings():
    """#/palabras: tres grupos como Ajustes del iPhone (Temas, Las 3000 y Avanzado, este plegado); cada fila con su
    dibujo, el nombre, el número de palabras, el anillo (las del tema en srs:<idioma> / las del tema) y la flecha.
    Abrir Avanzado se recuerda en la sesión."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page, keys=_keys())
        C.goto(page, "#/palabras")
        st = page.evaluate("""() => {
          const secs = [...document.querySelectorAll('#app .wl > .st-sec')].map(s => ({tag: s.tagName, h: (s.querySelector('.st-h') || {}).textContent || '',
            open: s.tagName === 'DETAILS' ? s.open : true, rows: s.querySelectorAll('.wl-r').length}));
          const rows = [...document.querySelectorAll('#app .wl-r')].map(a => ({id: a.getAttribute('href').replace('#/doc/', ''), off: a.classList.contains('off'),
            img: (a.querySelector('.wl-ic img') || {}).getAttribute ? a.querySelector('.wl-ic img').getAttribute('src') : null,
            t: (a.querySelector('.wl-t') || {}).textContent, small: (a.querySelector('small') || {}).textContent,
            ring: a.querySelector('.wl-ring') ? a.querySelector('.wl-ring').getAttribute('aria-label') : null, chev: !!a.querySelector('.wl-chev')}));
          const srs = JSON.parse(localStorage.getItem('srs:' + lang) || '{}'), by = {};
          for (const x of Object.values(srs)) if (x && x.d) by[x.d] = (by[x.d] || 0) + 1;
          return {secs, rows, by, sub: document.querySelectorAll('#app p.sub').length, grid: !!document.querySelector('#app .grid')}; }""")
        hs = [re.sub(r"\s*·.*", "", s["h"]).strip() for s in st["secs"]]
        if hs != ["Temas", "Las 3000", "Avanzado"]:
            probs.append(f"grupos: {hs}")
        elif st["secs"][2]["tag"] != "DETAILS" or st["secs"][2]["open"]:
            probs.append(f"Avanzado no está plegado: {st['secs'][2]}")
        want = {g: [d for d in _INDEX if d.get("group") == g] for g in ("temas", "3000", "avanzado")}
        if [s["rows"] for s in st["secs"]] != [len(want["temas"]), len(want["3000"]), len(want["avanzado"])]:
            probs.append(f"filas por grupo: {[s['rows'] for s in st['secs']]}")
        if st["sub"] or st["grid"]:
            probs.append("siguen los textos de ayuda o la cuadrícula de tarjetas")
        idx = {d["id"]: d for d in _INDEX}
        for r in st["rows"]:
            d = idx.get(r["id"])
            if not d:
                probs.append(f"fila de un tema que no existe: {r['id']}")
                continue
            ok = "english" in d.get("langs", [])
            if r["t"] != d["title"] or not r["img"] or not r["chev"] or r["off"] == ok:
                probs.append(f"fila {r['id']}: {r}")
            if ok:
                have = min(d["count"], st["by"].get(r["id"], 0))
                if r["ring"] != f"{have} de {d['count']} aprendidas":
                    probs.append(f"anillo de {r['id']}: «{r['ring']}» (se esperaba «{have} de {d['count']} aprendidas»)")
                if str(d["count"]) not in (r["small"] or ""):
                    probs.append(f"{r['id']} no dice sus {d['count']} palabras: {r['small']!r}")
        if not any(st["by"].get(r["id"]) for r in st["rows"]):
            probs.append("la partida sembrada no tiene ningún tema empezado (la prueba de los anillos no prueba nada)")
        bad = page.evaluate("""async () => { const srcs = [...new Set([...document.querySelectorAll('#app .wl-ic img')].map(i => i.getAttribute('src')))], bad = [];
          for (const s of srcs) { try { const r = await fetch(s); if (!r.ok) bad.push(s); } catch (e) { bad.push(s); } } return bad; }""")
        if bad:
            probs.append(f"dibujos de tema que no cargan: {bad[:5]}")
        # abrir Avanzado: se recuerda en la sesión
        page.locator("#wl-adv > summary").click()
        page.wait_for_timeout(200)
        if page.evaluate("sessionStorage.getItem('vocab:wl-adv')") != "1":
            probs.append("abrir Avanzado no se recuerda en la sesión")
        C.goto(page, "#/mapa")
        C.goto(page, "#/palabras")
        if not page.evaluate("document.getElementById('wl-adv').open"):
            probs.append("al volver, Avanzado vuelve a estar plegado")
        page.locator(f"#app .wl-r[href='#/doc/{R.TOPIC}']").click()
        _wait_hash(page, f"#/doc/{R.TOPIC}")
        page.locator("#dv-back").click()
        _wait_hash(page, "#/palabras")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------------------------------------------- ficha del tema
def test_doc_modes_list_and_swipe():
    """#/doc/<tema>: «‹ Palabras», el título y el control segmentado Lista · Tarjetas · Preguntas · Escribir, con
    Tarjetas por defecto; cambiar de segmento cambia de modo y se recuerda en la sesión para ese tema (otro tema abre
    en Tarjetas). Sin chips de nivel, sin el control de velocidad, sin «➕ Al repaso» suelto ni textos de ayuda. En la
    Lista, tocar una fila despliega el detalle (con la IPA, salvo que un mayor la apague en Ajustes); deslizar a la izquierda manda la
    palabra al repaso con lo mismo que escribe srsAdd(id, [fila], 0), sin scroll horizontal."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page, keys=_keys())
        C.goto(page, f"#/doc/{R.TOPIC}")
        page.evaluate(_SPY)
        st = page.evaluate("""() => ({tabs: [...document.querySelectorAll('#app .dv-seg [role=tab]')].map(b => b.textContent.trim()),
          sel: [...document.querySelectorAll('#app .dv-seg [aria-selected=true]')].map(b => b.textContent.trim()),
          card: !!document.getElementById('card'), back: (document.getElementById('dv-back') || {}).textContent, title: (document.querySelector('.dv-t') || {}).textContent,
          old: ['#rate', '#to-srs', '[data-l]', '#modes', '.toolbar', '#app p.sub'].filter(s => document.querySelector(s))})""")
        if st["tabs"] != ["Lista", "Tarjetas", "Preguntas", "Escribir"] or st["sel"] != ["Tarjetas"] or not st["card"]:
            probs.append(f"la ficha no abre en Tarjetas con los 4 segmentos: {st}")
        if (st["back"] or "").strip() != "Palabras" or not st["title"]:
            probs.append(f"cabecera de la ficha: {st['back']!r} · {st['title']!r}")
        if st["old"]:
            probs.append(f"siguen cosas quitadas: {st['old']}")
        # tarjeta: girar
        page.locator("#card").click()
        page.wait_for_timeout(500)
        if not page.evaluate("vocabLearn.state.fc.flip"):
            probs.append("tocar la tarjeta no la gira")
        # Lista
        page.locator("#dv-tab-lista").click()
        page.wait_for_timeout(250)
        n_rows = page.evaluate("() => document.querySelectorAll('#app .dl-r').length")
        n_want = page.evaluate("id => CACHE[id].rows.filter(r => r.es && r.l && r.l[lang]).length", R.TOPIC)
        if n_rows != n_want:
            probs.append(f"la Lista tiene {n_rows} filas (se esperaban {n_want})")
        mem = json.loads(page.evaluate("sessionStorage.getItem('vocab:docmode')") or "{}")
        if mem.get(R.TOPIC) != "lista":
            probs.append(f"el modo elegido no se recuerda en la sesión: {mem}")
        row = page.evaluate("""() => { const r = document.querySelectorAll('#app .dl-r')[1], s = r.querySelector('.ln-spk').getBoundingClientRect();
          return {es: r.querySelector('.dl-es').textContent, w: r.querySelector('.dl-w').textContent, spk: [s.width, s.height]}; }""")
        if min(row["spk"]) < 44:
            probs.append(f"el altavoz de la fila mide {row['spk']} (mínimo 44)")
        page.locator("#app .dl-r >> nth=1 >> .dl-open").click()
        page.wait_for_timeout(300)
        d = page.evaluate("""() => { const r = document.querySelectorAll('#app .dl-r')[1], d = r.querySelector('.dl-d');
          return {exp: r.querySelector('.dl-open').getAttribute('aria-expanded'), vis: !d.hidden && !!d.getClientRects().length, add: !!d.querySelector('[data-add]'),
            ipa: /\\bIPA\\b/.test(d.textContent), big: !!d.querySelector('.ln-spk.lg')}; }""")
        if d["exp"] != "true" or not d["vis"] or not d["add"] or not d["big"]:
            probs.append(f"tocar la fila no despliega el detalle: {d}")
        has_ipa = page.evaluate("id => !!CACHE[id].rows.filter(r => r.es && r.l && r.l[lang])[1].l[lang].ipa", R.TOPIC)
        if has_ipa and not d["ipa"]:
            probs.append("el detalle no enseña la IPA (sale de serie)")
        page.evaluate("vocabUI.set('ipa', false)")
        page.locator("#dv-tab-tarjetas").click()
        page.locator("#dv-tab-lista").click()
        page.wait_for_timeout(200)
        page.locator("#app .dl-r >> nth=1 >> .dl-open").click()
        page.wait_for_timeout(200)
        if page.evaluate("() => /\\bIPA\\b/.test(document.querySelectorAll('#app .dl-r')[1].querySelector('.dl-d').textContent)"):
            probs.append("con la IPA apagada en Ajustes, el detalle la sigue enseñando")
        page.evaluate("vocabUI.set('ipa', null)")
        # se recuerda el modo de este tema; otro tema abre en Tarjetas
        C.goto(page, "#/palabras")
        C.goto(page, f"#/doc/{R.TOPIC}")
        if page.evaluate("() => [...document.querySelectorAll('#app .dv-seg [aria-selected=true]')].map(b => b.textContent.trim())") != ["Lista"]:
            probs.append("al volver al tema no abre en el modo elegido (Lista)")
        C.goto(page, f"#/doc/{R.TOPIC_3000}")
        if page.evaluate("() => [...document.querySelectorAll('#app .dv-seg [aria-selected=true]')].map(b => b.textContent.trim())") != ["Tarjetas"]:
            probs.append(f"otro tema ({R.TOPIC_3000}) no abre en Tarjetas")
        # deslizar a la izquierda una palabra que no está en el repaso (en un tema de las 3000, sin empezar)
        page.locator("#dv-tab-lista").click()
        page.wait_for_timeout(250)
        TOP = R.TOPIC_3000
        pick = page.evaluate("""id => { const m = JSON.parse(localStorage.getItem('srs:' + lang) || '{}');
          const rows = [...document.querySelectorAll('#app .dl-r')]; const i = rows.findIndex(r => !m[id + '|' + CACHE[id].rows[+r.dataset.i].es]);
          if (i >= 0) rows[i].setAttribute('data-swipe', '1');
          return i < 0 ? null : {n: i, es: CACHE[id].rows[+rows[i].dataset.i].es}; }""", TOP)
        if not pick:
            probs.append("todas las palabras del tema ya están en el repaso (no se puede probar deslizar)")
        else:
            before = page.evaluate(_SNAP)
            sw = page.evaluate(_SWIPE, ["#app .dl-r[data-swipe] .dl-fg", [-20, -60, -120, -180, -200]])
            page.wait_for_timeout(700)
            if sw["wide"]:
                probs.append("deslizar la fila da scroll horizontal")
            if not any(t.startswith("-") for t in sw["tr"]):
                probs.append(f"la fila no sigue al dedo: {sw['tr']}")
            r = page.evaluate(_EXPECT, ["add", TOP, pick["es"], 0, before])
            if not r["entry"]:
                probs.append(f"deslizar «{pick['es']}» a la izquierda no la manda al repaso")
            elif not r["same"]:
                probs.append(f"deslizar escribe distinto que srsAdd(id, [fila], 0): {r['entry']} ≠ {r['want']}")
            ts = page.evaluate("window.__toasts")
            if not ts or "repaso" not in ts[-1][0]:
                probs.append(f"deslizar no avisa: {ts}")
            if not page.evaluate("es => [...document.querySelectorAll('#app .dl-r')].some(r => r.classList.contains('in-srs') && r.querySelector('.dl-es').textContent === es)", pick["es"]):
                probs.append("la fila deslizada no se marca como «en el repaso»")
            # el botón «Al repaso» del detalle hace lo mismo
            pick2 = page.evaluate("""id => { const m = JSON.parse(localStorage.getItem('srs:' + lang) || '{}');
              const rows = [...document.querySelectorAll('#app .dl-r')]; const i = rows.findIndex(r => !m[id + '|' + CACHE[id].rows[+r.dataset.i].es]);
              return i < 0 ? null : {n: i, es: CACHE[id].rows[+rows[i].dataset.i].es}; }""", TOP)
            if pick2:
                before = page.evaluate(_SNAP)
                page.locator(f"#app .dl-r >> nth={pick2['n']} >> .dl-open").click()
                page.locator(f"#app .dl-r >> nth={pick2['n']} >> [data-add]").click()
                page.wait_for_timeout(200)
                r = page.evaluate(_EXPECT, ["add", TOP, pick2["es"], 0, before])
                if not r["entry"] or not r["same"]:
                    probs.append(f"«Al repaso» del detalle: {r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_preguntas_grades_and_pays_once():
    """Preguntas (antes «Test»): 10 preguntas con 4 opciones; acertar marca la buena en verde con ✓; fallar marca la
    elegida en gris con ✗ (nunca rojo) y la buena en verde; cada respuesta escribe en srs:<idioma> lo mismo que
    srsGrade(id, fila, 2|0) y emite «answer» {where: "test"}; al final, award(aciertos) una sola vez."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page, keys=_keys())
        C.goto(page, f"#/doc/{R.TOPIC}")
        page.evaluate(_SPY)
        page.locator("#dv-tab-test").click()
        page.wait_for_timeout(250)
        n = page.evaluate("vocabLearn.state.test.qs.length")
        ok = 0
        for i in range(n):
            q = page.evaluate("""() => { const t = vocabLearn.state.test, r = t.qs[t.i];
              const bs = [...document.querySelectorAll('#app .qz-opt')], w = r.l[lang].word;
              return {es: r.es, right: bs.findIndex(b => b.querySelector('span').textContent === w), n: bs.length,
                ask: document.querySelector('.qz-ask').textContent}; }""")
            # la misma pregunta que en la lección, con la palabra en minúscula: «¿Cuál es «perro»?» (las comillas las pone <q>)
            low = "/".join(p if any(ch.isupper() for ch in p[1:]) else p[:1].lower() + p[1:] for p in q["es"].split("/"))
            if q["n"] != 4 or q["right"] < 0 or q["ask"] != f"¿Cuál es {low}?":
                probs.append(f"pregunta {i + 1}: {q}")
                break
            good = i % 2 == 0
            k = q["right"] if good else (q["right"] + 1) % 4
            before = page.evaluate(_SNAP)
            page.locator("#app .qz-opt").nth(k).click()
            page.wait_for_timeout(120)
            ok += 1 if good else 0
            r = page.evaluate(_EXPECT, ["grade", R.TOPIC, q["es"], 2 if good else 0, before])
            if not r["same"]:
                probs.append(f"pregunta {i + 1}: escribe distinto que srsGrade: {r['entry']} ≠ {r['want']}")
            look = page.evaluate("""k => { const bs = [...document.querySelectorAll('#app .qz-opt')], cs = el => getComputedStyle(el).backgroundColor;
              const ok = bs.find(b => b.classList.contains('is-ok')), miss = bs.find(b => b.classList.contains('is-miss'));
              return {ok: ok ? cs(ok) : null, okChk: ok ? !!ok.querySelector('.chk') : false, miss: miss ? cs(miss) : null, missX: miss ? !!miss.querySelector('.xm') : false,
                missI: miss ? bs.indexOf(miss) : -1, next: !document.getElementById('nextq').hidden,
                shake: !!document.querySelector('#app .shake, #app .nope, #app .is-shake') || (miss ? miss.getAnimations().filter(a => !(a instanceof CSSTransition))
                  .map(a => a.effect && a.effect.getKeyframes ? a.effect.getKeyframes() : []).filter(kf => kf.length > 2 && kf.some(f => /translate/i.test(String(f.transform || '') + ' ' + String(f.translate || '')))).length : 0)}; }""", k)
            g = _rgb(look["ok"])
            if not g or not (g[1] > g[0] + 40 and g[1] > g[2] + 20) or not look["okChk"]:
                probs.append(f"pregunta {i + 1}: la buena no está en verde con ✓: {look}")
            if not good:
                m = _rgb(look["miss"])
                if not m or max(m) - min(m) > 24 or not look["missX"] or look["missI"] != k:
                    probs.append(f"pregunta {i + 1}: el fallo no está en gris con ✗: {look}")
                if look["shake"]:
                    probs.append(f"pregunta {i + 1}: el fallo tiembla")
            if not look["next"]:
                probs.append(f"pregunta {i + 1}: no sale «Seguir»")
            elif i + 1 < n and page.evaluate("() => document.getElementById('nextq').textContent.trim()") != "Seguir":
                probs.append(f"pregunta {i + 1}: tras contestar el botón no dice «Seguir»")
            page.locator("#nextq").click()
            page.wait_for_timeout(120)
        page.evaluate(_FINISH)
        page.wait_for_timeout(300)
        end = page.evaluate("() => ({score: (document.getElementById('qz-score') || {}).textContent, aw: window.__aw, ans: window.__ans.map(a => [a.ok, a.where])})")
        if (end["score"] or "").replace(" ", "") != f"{ok}/{n}":
            probs.append(f"resultado: {end['score']!r} (se esperaba {ok} / {n})")
        if [a[:2] for a in end["aw"]] != [[ok, "¡Preguntas terminadas!"]]:
            probs.append(f"award al terminar: {end['aw']}")
        if len(end["ans"]) != n or any(w != "test" for _, w in end["ans"]) or sum(1 for o, _ in end["ans"] if o) != ok:
            probs.append(f"avisos «answer»: {end['ans']}")
        # otra visita a la pantalla final no vuelve a pagar
        page.locator("#dv-tab-lista").click()
        page.locator("#dv-tab-test").click()
        page.wait_for_timeout(300)
        if len(page.evaluate("window.__aw")) != 1:
            probs.append(f"volver a la pantalla final paga otra vez: {page.evaluate('window.__aw')}")
        page.locator("#again").click()
        page.wait_for_timeout(200)
        if page.evaluate("vocabLearn.state.test.i") != 0:
            probs.append("«Otra ronda» no empieza de nuevo")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_escribir_saves_as_before():
    """Escribir (antes «Práctica 21»): arriba, a la vista, «Empezar» y «N palabras» (sin «210 repeticiones»); los
    ajustes van en la hoja de «Opciones ›», que lee prPrefs (actividades y repeticiones) y prAuto/prEx; «Empezar»
    guarda prPrefs {acts, reps}, prAuto, prEx y pr:<tema>:<idioma> = {running, acts, reps, words: [{i, n}], cur, step}
    como antes; cada tarjeta suma una repetición; «Pausar» deja la práctica a medias y el ajuste ofrece «Seguir».
    «Hablar» sigue en la lista (con micrófono o tocando)."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page, keys=_keys())
        C.goto(page, f"#/doc/{R.TOPIC}")
        page.locator("#dv-tab-practica").click()
        page.wait_for_timeout(300)
        st = page.evaluate("""() => ({acts: [...document.querySelectorAll('#view input[name=act]')].map(i => [i.value, i.checked]),
          reps: [...document.querySelectorAll('#view [data-r]')].map(b => [+b.dataset.r, b.getAttribute('aria-checked')]),
          auto: (document.getElementById('pr-o-auto') || {}).checked, ex: (document.getElementById('pr-o-ex') || {}).checked,
          hablar: [...document.querySelectorAll('#view label')].some(l => /Hablar/.test(l.textContent)), go: !!document.getElementById('pr-go')})""")
        prefs = _ls(page, "prPrefs")
        if [a for a, c in st["acts"] if c] != prefs["acts"] or [r for r, c in st["reps"] if c == "true"] != [prefs["reps"]]:
            probs.append(f"el ajuste no lee prPrefs {prefs}: {st}")
        if st["auto"] is not True or st["ex"] is not True or not st["hablar"] or not st["go"]:
            probs.append(f"el ajuste: {st}")
        top = page.evaluate("""() => { const b = document.getElementById('pr-go').getBoundingClientRect();
          return {y: b.bottom, ih: innerHeight, total: document.getElementById('pr-total').textContent, sum: document.getElementById('pr-sum').textContent,
            pri: document.getElementById('pr-go').classList.contains('glass-btn--pri'), sheet: document.getElementById('pr-sheet').open}; }""")
        if top["y"] > top["ih"] * .6 or not top["pri"] or top["sheet"] or not top["total"].endswith(" palabras") or "repeticiones" in top["total"]:
            probs.append(f"«Empezar» no está arriba a la vista con «N palabras»: {top}")
        if top["sum"] != "Escuchar, Leer y Escribir · 21 veces cada una":
            probs.append(f"resumen de «Opciones»: {top['sum']!r}")
        page.locator("#pr-opt").click()
        page.wait_for_selector("#pr-sheet[open]", timeout=3000)
        page.wait_for_timeout(400)
        page.locator("#view [data-r='7']").click()
        page.locator("#view [data-pick='5']").click()
        page.locator("label:has(#pr-o-auto)").click()
        page.locator("#pr-sheet [data-close]").click()
        page.wait_for_selector("#pr-sheet:not([open])", state="attached", timeout=3000)
        page.wait_for_timeout(300)
        t = page.evaluate("() => [document.getElementById('pr-total').textContent, document.getElementById('pr-sum').textContent, document.documentElement.hasAttribute('data-sheet')]")
        if t != ["5 palabras", "Escuchar, Leer y Escribir · 7 veces cada una", False]:
            probs.append(f"tras cerrar «Opciones»: {t}")
        page.locator("#pr-go").click()
        page.wait_for_timeout(700)
        prefs = _ls(page, "prPrefs")
        if prefs != {"acts": ["escuchar", "leer", "escribir"], "reps": 7}:
            probs.append(f"prPrefs tras empezar: {prefs}")
        if _ls(page, "prAuto") is not False or _ls(page, "prEx") is not True:
            probs.append(f"prAuto/prEx tras empezar: {_ls(page, 'prAuto')!r} / {_ls(page, 'prEx')!r}")
        key = f"pr:{R.TOPIC}:english"
        s = _ls(page, key)
        if not s or sorted(s) != ["acts", "cur", "reps", "running", "step", "words"] or s["running"] is not True or s["reps"] != 7 \
                or len(s["words"]) != 5 or any(sorted(w) != ["i", "n"] or w["n"] != 0 for w in s["words"]) or s["cur"] != 0:
            probs.append(f"{key} al empezar: {s}")
        n_all = page.evaluate("id => CACHE[id].rows.filter(r => r.es && r.l && r.l[lang]).length", R.TOPIC)
        if s and any(not (0 <= w["i"] < n_all) for w in s["words"]):
            probs.append(f"índices de palabras fuera de rango: {s['words']}")
        # una tarjeta (la primera actividad es escuchar): «Escuchado» suma una repetición
        page.locator("#view .pr-card.cur .pr-next").click()
        page.wait_for_timeout(800)
        s2 = _ls(page, key)
        if not s2 or sum(w["n"] for w in s2["words"]) != 1:
            probs.append(f"tras una tarjeta: {s2}")
        page.locator("#pr-stop").click()
        page.wait_for_timeout(300)
        s3 = _ls(page, key)
        if not s3 or s3["running"] is not False or sum(w["n"] for w in s3["words"]) != 1:
            probs.append(f"«Pausar» no deja la práctica a medias: {s3}")
        if not page.locator("#pr-cont").count():
            probs.append("tras «Pausar», el ajuste no ofrece seguir")
        page.locator("#pr-cont").click()
        page.wait_for_timeout(500)
        if (_ls(page, key) or {}).get("running") is not True or not page.locator("#view .pr-card.cur").count():
            probs.append("«Seguir» no vuelve a la práctica")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------------------------------------------- Gramática
def test_gramatica_expands_and_practices():
    """#/gramatica/<nivel>: filas con número (✓ si está hecha) y título; tocar una despliega su teoría (una abierta a
    la vez) con «Practicar», que abre #/leccion/G-<nivel>-<nn>."""
    probs = []
    lv = R.GRAM_LEVEL
    page = C.new_page("phone")
    try:
        C.seed(page, keys=_keys())
        C.goto(page, f"#/gramatica/{lv}")
        st = page.evaluate("""() => [...document.querySelectorAll('#app .gr-u')].map(d => ({open: d.open, n: d.querySelector('.gr-n').textContent.trim(),
          done: d.classList.contains('is-done'), t: d.querySelector('.gr-tl').textContent.trim()}))""")
        g = _GRAM.get(lv, [])
        if [x["t"] for x in st] != [x["t"] for x in g]:
            probs.append(f"títulos: {[x['t'] for x in st]}")
        if any(x["open"] for x in st):
            probs.append("hay temas abiertos al entrar")
        for k, x in enumerate(st):
            hecho = f"G-{lv}-{k + 1:02d}" in _PLAN["done"]
            if x["done"] != hecho or (not hecho and x["n"] != str(k + 1)):
                probs.append(f"tema {k + 1}: {x}")
        page.locator("#app .gr-u >> nth=1 >> summary").click()
        page.wait_for_timeout(300)
        o = page.evaluate("""() => { const d = document.querySelectorAll('#app .gr-u')[1], a = d.querySelector('.gr-go a');
          return {open: d.open, rules: d.querySelectorAll('.gr-rule').length, ex: d.querySelectorAll('.gr-ex p').length, go: a && a.textContent.trim(), href: a && a.getAttribute('href')}; }""")
        if not o["open"] or o["rules"] < 1 or o["go"] != "Practicar" or o["href"] != f"#/leccion/G-{lv}-02":
            probs.append(f"tema 2 abierto: {o}")
        page.locator("#app .gr-u >> nth=2 >> summary").click()
        page.wait_for_timeout(300)
        if page.evaluate("() => [...document.querySelectorAll('#app .gr-u')].filter(d => d.open).length") != 1:
            probs.append("se quedan abiertos dos temas a la vez")
        page.locator("#app .gr-u >> nth=1 >> summary").click()
        page.wait_for_timeout(300)
        page.locator("#app .gr-u >> nth=1 >> .gr-go a").click()
        _wait_hash(page, f"#/leccion/G-{lv}-02")
        if not page.locator("#app [class*=ls-]").count():
            probs.append("«Practicar» no pinta la lección de gramática")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------------------------------------------- URL directa
def test_direct_urls_and_unknown_topics():
    """Cada ruta de js/learn.js carga bien con la URL directa (móvil y escritorio, claro y oscuro); #/doc sin tema o
    con uno que no existe se cambia por #/palabras."""
    probs = []
    cases = [("#/mapa", "#cm .node"), ("#/mapa/B1", "#cm .node"), ("#/palabras", "#wl .wl-r"), (f"#/doc/{R.TOPIC}", "#dv .dv-seg"),
             (f"#/doc/{R.TOPIC_3000}", "#dv #card"), ("#/gramatica", "#gr .gr-u"), ("#/gramatica/A2", "#gr .gr-u")]
    for kind, cs in (("phone", "light"), ("desk", "dark")):
        page = C.new_page(kind, color_scheme=cs)
        try:
            C.seed(page, keys=_keys())
            for h, sel in cases:
                C.goto(page, h, reload=True)
                if not page.locator(sel).count():
                    probs.append(f"{kind}: {h} cargada directamente no pinta {sel}")
                if page.evaluate("document.documentElement.scrollWidth > innerWidth"):
                    probs.append(f"{kind}: {h} tiene scroll horizontal")
            for h in ("#/doc", "#/doc/no-existe"):
                C.goto(page, h, reload=True)
                page.wait_for_timeout(300)
                if C.current_hash(page) != "palabras":
                    probs.append(f"{kind}: {h} lleva a #/{C.current_hash(page)} (se esperaba #/palabras)")
            probs += [f"{kind}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_export_unchanged_by_browsing():
    """Recorrer Camino, Palabras, la ficha (Tarjetas, Lista y su detalle) y Gramática no cambia la partida: la
    exportación es la de la base (tests/e2e/baseline/export.json) y no aparece ninguna clave nueva."""
    base = C.load_baseline()
    assert base, f"falta {C.BASELINE}"
    probs = []
    page = C.new_page("desk")
    try:
        C.seed(page, keys=_keys())
        s0 = C.export(page)
        C.goto(page, "#/mapa")
        page.locator("#app .lvp-b").click()
        page.keyboard.press("Escape")
        C.goto(page, "#/palabras")
        C.goto(page, f"#/doc/{R.TOPIC}")
        page.locator("#card").click()
        page.locator("#dv-tab-lista").click()
        page.locator("#app .dl-r >> nth=0 >> .dl-open").click()
        C.goto(page, f"#/gramatica/{R.GRAM_LEVEL}")
        page.locator("#app .gr-u >> nth=0 >> summary").click()
        page.wait_for_timeout(300)
        s1 = C.export(page)
        d = C.diff_exports(base, s1)
        if d:
            probs.append("la partida no es la de la base:\n  " + "\n  ".join(d))
        d = C.diff_exports(s0, s1, allow_new=False)
        if d:
            probs.append("recorrer las pantallas cambia la partida:\n  " + "\n  ".join(d))
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
