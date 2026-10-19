"""F4c: Premios (js/rewards.js: Medallas en #/progreso y Mi zorro en #/mizorro) y el Álbum nuevo (js/album.js).

Premios (plan-doc «Premios»): sin las casillas de monedas y medallas, el calendario de 14 días, los textos de ayuda ni el
apartado de mayores; cabe en 2 alturas de pantalla del móvil (390×844) con la partida sembrada; la llama con los 7 días
de esta semana (lunes a domingo; los practicados llenos, hoy vacío si aún no ha practicado, sin latir); «N palabras · M
ya no las olvidas» con la barra de dos tonos; 6 anillos de nivel; «Tu próxima medalla» = la de más progreso sin
conseguir; medallas en 4 columnas (las que faltan en silueta gris); tocar una abre su hoja de detalle; una medalla nueva
gira una sola vez (vocab:ui.medals, solo de este aparato).
Mi zorro: el personaje grande con lo que lleva; piezas por tipo (sin las de la granja) con vocabShop.card(…, {mode:
"zorro"}); comprar un sombrero resta una vez y se lo pone, quitárselo, elegir otro personaje; la vista cambia.
Álbum: portada con anillo y una línea, partes en un control segmentado (recordada en "album:tab"); en un tema, la
pastilla «Tema: … ▾» con su hoja y deslizar #al-page (> 60 px y más del doble que en vertical; nunca con un diálogo
abierto) pasan de tema; despegar sigue igual y completar un tema da 50 monedas una sola vez.
Sin errores de consola, sin bucles infinitos, contraste y paleta (capturas F4c-* en capturas/F4) y la partida exportada
como la base."""
from __future__ import annotations

import copy
import json
import re

import common as C

_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""
_ENDLESS = """() => document.getAnimations().filter(a => { try { const t = a.effect.getComputedTiming();
  return t.iterations === Infinity && a.playState === 'running'; } catch (e) { return false; } })
  .map(a => (a.animationName || a.id || 'anim') + ' @ ' + ((a.effect.target && (a.effect.target.id || a.effect.target.className)) || '?'))"""
_GAME = "() => JSON.parse(localStorage.getItem('game'))"
_HOOK_AWARD = """() => { if (window.__aw) return; window.__aw = [];
  const a0 = window.award; window.award = (...x) => { __aw.push({n: x[0], why: x[1]}); return a0(...x); }; }"""
# la pista del deslizamiento del álbum ya aprendida (para que no tape nada en las pruebas que no la miran)
_NO_HINT = """() => { let o = {}; try { o = JSON.parse(localStorage.getItem('vocab:ui') || '{}') || {}; } catch (e) {}
  o.hints = Object.assign({}, o.hints, {'al-swipe': 1000}); localStorage.setItem('vocab:ui', JSON.stringify(o)); }"""
OUT = C.CAPTURAS / "F4"
PHONE_H = 844
TODAY = C.day_key(C.FIXED_NOW)          # 2026-03-11, miércoles


def _keys(mut=None):
    """La partida sembrada (textos de localStorage), con un cambio opcional mut(data) sobre los objetos."""
    d = copy.deepcopy(C.seed_data())
    if mut:
        mut(d)
    return {k: C._dumps(v) for k, v in d.items()}


def _days_ago(n):
    import datetime as dt   # noqa: PLC0415
    return C.day_key(C.FIXED_NOW - dt.timedelta(days=n))


def _touch_swipe(page, x0, y0, dx, dy=0, steps=10):
    cdp = page.context.new_cdp_session(page)
    try:
        def t(kind, pts):
            cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": pts})
        t("touchStart", [{"x": x0, "y": y0}])
        for i in range(1, steps + 1):
            t("touchMove", [{"x": x0 + i * dx / steps, "y": y0 + i * dy / steps}])
            page.wait_for_timeout(16)
        t("touchEnd", [])
    finally:
        cdp.detach()
    page.wait_for_timeout(700)
    C.settle(page, 200)


def _page_point(page, dy=160):
    """Un punto dentro de #al-page visible en pantalla (lejos de los bordes, del gesto «atrás» del sistema)."""
    page.evaluate("() => { const p = document.getElementById('al-page'); scrollTo(0, p.getBoundingClientRect().top + scrollY - 120); }")
    page.wait_for_timeout(150)
    b = page.locator("#al-page").bounding_box()
    return b["x"] + b["width"] / 2, b["y"] + min(dy, b["height"] / 2)


# ---------------------------------------------------------------- módulo y rutas
def test_module_and_routes():
    """js/rewards.js registra ROUTES.progreso y ROUTES.mizorro y window.vocabRewards; premios() ya no está en index.html;
    Premios tiene los segmentos Medallas · Mi zorro; js/rewards.js va en SHELL de sw.js y en OFF_APP."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        r = page.evaluate("""() => ({routes: ['progreso', 'mizorro', 'album'].map(k => typeof ROUTES[k]),
          api: window.vocabRewards ? Object.keys(vocabRewards).sort() : null, premios: typeof window.premios,
          off: OFF_APP.includes('js/rewards.js'),
          segs: TABS.find(t => t.id === 'premios').segs.map(s => [s.t, s.h])})""")
        if r["routes"] != ["function"] * 3:
            probs.append(f"ROUTES: {r['routes']}")
        for k in ("premios", "miZorro", "week", "words", "levels", "next", "openMedal", "closeMedal", "spin"):
            if not r["api"] or k not in r["api"]:
                probs.append(f"window.vocabRewards sin {k}: {r['api']}")
        if r["premios"] != "undefined":
            probs.append("premios() sigue en index.html")
        if not r["off"]:
            probs.append("js/rewards.js no está en OFF_APP")
        if r["segs"] != [["Medallas", "#/progreso"], ["Mi zorro", "#/mizorro"]]:
            probs.append(f"segmentos de Premios: {r['segs']}")
        C.goto(page, "#/mizorro")
        sel = page.evaluate("() => [...document.querySelectorAll('#tabhead .seg-i')].map(a => [a.textContent.trim(), a.getAttribute('aria-selected')])")
        if sel != [["Medallas", "false"], ["Mi zorro", "true"]]:
            probs.append(f"#/mizorro: segmentos {sel}")
        if page.evaluate("() => document.getElementById('tab-premios').getAttribute('aria-selected')") != "true":
            probs.append("#/mizorro no marca la pestaña Premios")
        probs += C.errors(page)
    finally:
        page.context.close()
    sw = (C.REPO / "sw.js").read_text(encoding="utf-8")
    shell = sw[sw.index("const SHELL"):sw.index("];", sw.index("const SHELL"))]
    if '"js/rewards.js"' not in shell:
        probs.append("js/rewards.js no está en SHELL de sw.js")
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Medallas
def test_premios_fits_and_parts():
    """Con la partida sembrada, Premios cabe en 2 alturas de pantalla a 390×844 y tiene sus partes: semana, palabras,
    6 anillos, «Tu próxima medalla» y medallas en 4 columnas (las que faltan en silueta gris). Nada de lo que se quitó."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, "#/progreso")
        page.wait_for_timeout(400)
        h = page.evaluate("() => document.documentElement.scrollHeight")
        if h > 2 * PHONE_H:
            probs.append(f"Premios mide {h} px de alto (más de 2 pantallas: {2 * PHONE_H})")
        r = page.evaluate("""() => {
          const q = s => document.querySelectorAll('#app ' + s).length;
          const meds = document.querySelector('.rw-meds'), cols = meds ? getComputedStyle(meds).gridTemplateColumns.split(' ').length : 0;
          const lock = document.querySelector('.rw-m.lock .rw-me'), ok = document.querySelector('.rw-m.ok .rw-me');
          const m = Object.values(srsAll());
          return {week: q('.rw-week .rw-d'), lv: q('.rw-lv'), next: q('.rw-next'), meds: q('.rw-m'), cols,
            ok: q('.rw-m.ok'), list: achList().length, got: achList().filter(a => a.ok).length,
            lockF: lock ? getComputedStyle(lock).filter : '', okF: ok ? getComputedStyle(ok).filter : '',
            words: (document.querySelector('.rw-wl') || {}).textContent || '', total: m.length, mast: m.filter(x => x.b >= MASTER).length,
            old: q('.kid-stats, .ks, .cal, details.adult, #adult, .me-coins, .lvms, .achs'),
            help: /Cada día que aprendes|Completa todas las lecciones|Para mayores/.test(document.getElementById('app').textContent)};
        }""")
        if r["week"] != 7:
            probs.append(f"la semana tiene {r['week']} días")
        if r["lv"] != 6:
            probs.append(f"{r['lv']} anillos de nivel (se esperaban 6)")
        if r["next"] != 1:
            probs.append("falta «Tu próxima medalla»")
        if r["meds"] != r["list"] or r["ok"] != r["got"]:
            probs.append(f"medallas: {r['meds']} pintadas ({r['ok']} conseguidas) de {r['list']} ({r['got']})")
        if r["cols"] != 4:
            probs.append(f"las medallas van en {r['cols']} columnas (4)")
        if "grayscale" not in r["lockF"] or "grayscale" in r["okF"]:
            probs.append(f"silueta gris: bloqueada {r['lockF']!r}, conseguida {r['okF']!r}")
        want = f"{r['total']} palabras · {r['mast']} ya no las olvidas"
        if re.sub(r"\s+", " ", r["words"]).strip() != want:
            probs.append(f"línea de palabras {r['words']!r} (se esperaba {want!r})")
        if r["old"]:
            probs.append(f"quedan {r['old']} piezas de Premios viejo (casillas, calendario, adultos…)")
        if r["help"]:
            probs.append("quedan textos de ayuda o «Para mayores» en Premios")
        if page.locator(".rw-wbar, .rw-bar").count() and page.evaluate("() => document.querySelectorAll('.rw-bar i').length") != 2:
            probs.append("la barra de palabras no tiene dos tonos")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_week_marks_seeded_days():
    """La semana va de lunes a domingo: con la racha sembrada (sáb-mié) salen llenos L, M y X (hoy, practicado); J-D
    por venir. Sin práctica hoy (solo el lunes), L lleno, M vacío y X marcado como hoy pero vacío. Nada late."""
    probs = []
    week = """() => [...document.querySelectorAll('.rw-week .rw-d')].map(d => ({l: d.querySelector('small').textContent.trim(),
      on: d.classList.contains('on'), today: d.classList.contains('today'), fut: d.classList.contains('fut'),
      anim: d.querySelector('.rw-dot').getAnimations().length}))"""
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, "#/progreso")
        w = page.evaluate(week)
        if [x["l"] for x in w] != list("LMXJVSD"):
            probs.append(f"días de la semana {[x['l'] for x in w]}")
        if [x["on"] for x in w] != [True, True, True, False, False, False, False]:
            probs.append(f"sembrada: días llenos {[x['on'] for x in w]}")
        if [x["today"] for x in w] != [False, False, True, False, False, False, False]:
            probs.append(f"sembrada: hoy {[x['today'] for x in w]}")
        if [x["fut"] for x in w] != [False, False, False, True, True, True, True]:
            probs.append(f"sembrada: por venir {[x['fut'] for x in w]}")
        n = page.evaluate("() => (document.querySelector('.rw-n') || {}).textContent")
        if str(n).strip() != "5":
            probs.append(f"la racha sembrada dice {n!r} (5)")

        def only_monday(d):
            d["act"] = {_days_ago(2): 12}       # lunes 9; nada el martes ni hoy
        C.seed(page, _keys(only_monday))
        C.goto(page, "#/progreso")
        w = page.evaluate(week)
        if [x["on"] for x in w] != [True, False, False, False, False, False, False]:
            probs.append(f"solo el lunes: días llenos {[x['on'] for x in w]}")
        if not w[2]["today"] or w[2]["on"]:
            probs.append(f"solo el lunes: hoy debería estar marcado y vacío: {w[2]}")
        if any(x["anim"] for x in w):
            probs.append(f"un día de la semana se anima: {w}")
        if page.evaluate(_ENDLESS):
            probs.append(f"bucles infinitos en Premios: {page.evaluate(_ENDLESS)}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_next_medal_is_highest_progress():
    """«Tu próxima medalla» es la de más v/goal sin conseguir (con la sembrada y con una hecha a propósito: 990 de 1000
    monedas ganadas → «Banquero»), con su barra y «v de goal»; tocarla abre su detalle."""
    probs = []
    pick = """() => { let best = null; for (const a of achList()) { if (a.ok) continue; const p = a.v / a.goal;
      if (!best || p > best.p) best = {id: a.id, p, v: a.v, goal: a.goal}; } return best; }"""
    shown = """() => { const b = document.querySelector('.rw-next [data-ach]'), i = document.querySelector('.rw-next .rw-pb i');
      return b ? {id: b.dataset.ach, txt: b.textContent.replace(/\\s+/g, ' '), w: i ? parseFloat(i.style.width) : null} : null; }"""
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, "#/progreso")
        want, got = page.evaluate(pick), page.evaluate(shown)
        if not got or got["id"] != want["id"]:
            probs.append(f"sembrada: próxima {got and got['id']}, se esperaba {want['id']}")
        elif f"{want['v']} de {want['goal']}" not in got["txt"] or abs(got["w"] - 100 * want["p"]) > 1:
            probs.append(f"sembrada: la próxima no dice «{want['v']} de {want['goal']}» o su barra no es {100 * want['p']:.0f} %: {got}")

        def rich(d):
            d["game"]["earned"] = 990
        C.seed(page, _keys(rich))
        C.goto(page, "#/progreso")
        want, got = page.evaluate(pick), page.evaluate(shown)
        if want["id"] != "c1000" or not got or got["id"] != "c1000":
            probs.append(f"990 de 1000 monedas: próxima {got and got['id']} (se esperaba c1000; la de más progreso es {want['id']})")
        page.locator(".rw-next [data-ach]").click()
        page.wait_for_selector("dialog#rw-sheet[open]", timeout=3000)
        t = page.evaluate("() => document.getElementById('rw-sh-t').textContent")
        name = page.evaluate("() => achList().find(a => a.id === 'c1000').t")
        if t != name:
            probs.append(f"la hoja de la próxima medalla dice {t!r} (se esperaba {name!r})")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_medal_detail_sheet():
    """Tocar una medalla abre su hoja: el nombre, «Cómo se gana», y si falta, «v de goal · te faltan N»; si está
    conseguida, «¡Conseguida el …!». «Listo» la cierra; con el teclado (Intro) también se abre."""
    probs = []
    page = C.new_page("desk")
    try:
        C.seed(page)
        C.goto(page, "#/progreso")
        a = page.evaluate("() => { const a = achList().find(x => !x.ok); return {id: a.id, t: a.t, v: a.v, goal: a.goal, d: a.d}; }")
        page.locator(f'.rw-m[data-ach="{a["id"]}"]').click()
        page.wait_for_selector("dialog#rw-sheet[open]", timeout=3000)
        page.wait_for_timeout(400)
        txt = page.evaluate("() => document.getElementById('rw-sheet').textContent.replace(/\\s+/g, ' ')")
        if page.evaluate("() => document.getElementById('rw-sh-t').textContent") != a["t"]:
            probs.append("la hoja no lleva el nombre de la medalla")
        for s in ("Cómo se gana", a["d"], f"{a['v']} de {a['goal']}", "te falta"):
            if s not in txt:
                probs.append(f"a la hoja de una medalla que falta le falta {s!r}: {txt[:200]}")
        page.locator("#rw-sheet [data-close]").click()
        page.wait_for_function("() => !document.getElementById('rw-sheet').open", timeout=3000)
        ok = page.evaluate("() => achList().find(x => x.ok).id")
        page.locator(f'.rw-m[data-ach="{ok}"]').focus()
        page.keyboard.press("Enter")
        page.wait_for_selector("dialog#rw-sheet[open]", timeout=3000)
        txt = page.evaluate("() => document.getElementById('rw-sheet').textContent")
        if "¡Conseguida" not in txt:
            probs.append("la hoja de una medalla conseguida no dice «¡Conseguida…!»")
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.getElementById('rw-sheet').open", timeout=3000)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_new_medal_spins_once():
    """Una medalla ganada que este aparato no ha enseñado sale arriba («¡Medalla nueva!») y gira una vez; al volver ya no.
    Lo visto se guarda en vocab:ui (solo de este aparato), no en la partida."""
    probs = []
    page = C.new_page("phone")
    try:
        seen = ["l1", "l10", "g1", "s3", "r3", "w50", "m25", "c200", "f5"]      # todas menos t10

        def fresh(d):
            d["vocab:ui"] = {"medals": seen}
        C.seed(page, _keys(fresh))
        C.goto(page, "#/progreso", settle_ms=50)
        st = page.evaluate("""() => ({n: document.querySelectorAll('.rw-new [data-ach]').length,
          id: (document.querySelector('.rw-new [data-ach]') || {dataset: {}}).dataset.ach,
          spin: [...document.querySelectorAll('.rw-new .rw-mc')].map(e => e.getAnimations().length)})""")
        if st["n"] != 1 or st["id"] != "t10":
            probs.append(f"medalla nueva: {st}")
        if not st["spin"] or not st["spin"][0]:
            probs.append(f"la medalla nueva no gira: {st}")
        ui = page.evaluate("() => JSON.parse(localStorage.getItem('vocab:ui') || '{}').medals")
        if "t10" not in (ui or []):
            probs.append(f"no se apuntó como vista en vocab:ui: {ui}")
        page.wait_for_timeout(1800)
        C.goto(page, "#/mizorro")
        C.goto(page, "#/progreso")
        if page.locator(".rw-new").count():
            probs.append("al volver, la medalla sigue saliendo como nueva")
        if page.evaluate("() => document.querySelectorAll('.rw-mc.is-spin').length"):
            probs.append("al volver, una medalla gira otra vez")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Mi zorro
def test_mizorro_buy_wear_choose():
    """Mi zorro: comprar un sombrero resta su precio una vez (doble toque) y se lo pone; la vista cambia con un saltito;
    «Quitármelo» se lo quita; «Elegir» cambia de personaje (y su nombre). Sin piezas de la granja."""
    probs = []
    fox = "() => document.getElementById('mz-fox').innerHTML"
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, "#/mizorro")
        tabs = page.evaluate("() => [...document.querySelectorAll('#mz-seg [data-t]')].map(b => b.dataset.t)")
        if "farm" in tabs or "hero" not in tabs or "hat" not in tabs:
            probs.append(f"pestañas de Mi zorro: {tabs}")
        farm = 0
        for t in tabs:
            page.locator(f'#mz-seg [data-t="{t}"]').click()
            page.wait_for_timeout(120)
            farm += page.evaluate("() => document.querySelectorAll('#mz-shop .sc[data-t=\"farm\"]').length")
            if not page.evaluate("() => [...document.querySelectorAll('#mz-shop .sc')].every(c => c.dataset.mode === 'zorro')"):
                probs.append(f"{t}: piezas que no son de modo zorro")
        if farm:
            probs.append(f"Mi zorro enseña {farm} piezas de la granja")
        page.locator('#mz-seg [data-t="hat"]').click()
        page.wait_for_timeout(150)
        g0, v0 = page.evaluate(_GAME), page.evaluate(fox)
        price = page.evaluate("() => itemById('sombrero').p")
        page.locator('#mz-shop [data-buy="sombrero"]').dblclick()
        page.wait_for_timeout(120)
        jump = page.evaluate("() => document.getElementById('mz-fox').getAnimations().length")
        page.wait_for_timeout(700)
        g1, v1 = page.evaluate(_GAME), page.evaluate(fox)
        if g1["coins"] != g0["coins"] - price:
            probs.append(f"comprar el sombrero: {g0['coins']} → {g1['coins']} (precio {price})")
        if not g1["owned"].get("sombrero") or g1["wear"].get("hat") != "sombrero":
            probs.append(f"tras comprarlo no lo tiene puesto: wear={g1['wear']}")
        if v1 == v0 or "🎩" not in v1:
            probs.append("la vista del personaje no cambia al ponerse el sombrero")
        if not jump:
            probs.append("la vista no da un saltito al cambiar")
        if "sombrero" not in page.evaluate("() => document.getElementById('mz-worn').textContent"):
            probs.append("«lo que llevas» no dice sombrero")
        page.locator('#mz-shop [data-wear="sombrero"]').click()
        page.wait_for_timeout(500)
        g2 = page.evaluate(_GAME)
        if g2["wear"].get("hat") or g2["coins"] != g1["coins"]:
            probs.append(f"quitárselo: wear={g2['wear']}, monedas {g2['coins']}")
        if "🎩" in page.evaluate(fox):
            probs.append("la vista sigue con el sombrero puesto")
        page.locator('#mz-seg [data-t="hero"]').click()
        page.wait_for_timeout(150)
        v2 = page.evaluate(fox)
        page.locator('#mz-shop [data-wear="rana"]').click()
        page.wait_for_timeout(500)
        g3 = page.evaluate(_GAME)
        if g3["wear"].get("hero") != "rana" or g3["coins"] != g2["coins"]:
            probs.append(f"elegir la rana: wear={g3['wear']}, monedas {g3['coins']}")
        if page.evaluate("() => document.getElementById('mz-name').textContent.trim()") != "Rana":
            probs.append(f"el nombre no cambia a Rana: {page.evaluate('() => document.getElementById(`mz-name`).textContent')!r}")
        if page.evaluate(fox) == v2:
            probs.append("la vista no cambia al elegir la rana")
        if page.locator('#mz-shop .sc[data-id="rana"] .own').count() != 1:
            probs.append("la rana no dice «Eres tú»")
        C.reload(page)
        page.wait_for_timeout(300)
        if page.evaluate("() => document.querySelector('#mz-seg [aria-selected=true]').dataset.t") != "hero":
            probs.append("al recargar no sigue en la misma pestaña de Mi zorro")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Álbum
def test_album_cover_selector():
    """Portada: sin la portada con degradado, .al-deco, .al-hello ni los chips; anillo y una línea «N de M pegatinas»;
    las partes en un control segmentado (tablist) que cambia las miniaturas y se recuerda en "album:tab"; miniaturas
    sobre fondo neutro (la tarjeta)."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, "#/album")
        r = page.evaluate("""() => ({old: document.querySelectorAll('.al-cover, .al-deco, .al-hello, .al-chips, .al-chip, .al-tabs').length,
          ring: document.querySelectorAll('.al-sum .al-ring svg').length, line: (document.querySelector('.al-sum-t') || {}).textContent || '',
          role: (document.querySelector('.al-grps') || {getAttribute: () => null}).getAttribute('role'),
          tabs: [...document.querySelectorAll('.al-grps [data-tab]')].map(b => [b.dataset.tab, b.getAttribute('aria-selected')]),
          vis: [...document.querySelectorAll('.al-ths')].filter(s => !s.hidden).map(s => s.dataset.g),
          bg: [...document.querySelectorAll('.al-th')].slice(0, 3).map(a => getComputedStyle(a).backgroundColor),
          card: getComputedStyle(document.querySelector('.al-sum')).backgroundColor})""")
        if r["old"]:
            probs.append(f"quedan {r['old']} piezas de la portada vieja")
        if r["ring"] != 1 or not re.fullmatch(r"\s*\d+ de \d+ pegatinas\s*", r["line"]):
            probs.append(f"cabecera: anillo {r['ring']}, línea {r['line']!r}")
        if r["role"] != "tablist" or [t for t, _ in r["tabs"]] != ["temas", "3000", "avanzado"]:
            probs.append(f"selector de partes: {r['role']} {r['tabs']}")
        if r["vis"] != ["temas"]:
            probs.append(f"con album:tab=temas se ven {r['vis']}")
        if any(b != r["card"] for b in r["bg"]):
            probs.append(f"las miniaturas no tienen el fondo neutro de las tarjetas: {r['bg']} vs {r['card']}")
        page.locator('.al-grps [data-tab="3000"]').click()
        page.wait_for_timeout(150)
        vis = page.evaluate("() => [...document.querySelectorAll('.al-ths')].filter(s => !s.hidden).map(s => s.dataset.g)")
        if vis != ["3000"] or page.evaluate("() => JSON.parse(localStorage.getItem('album:tab'))") != "3000":
            probs.append(f"tocar «Las 3000»: se ven {vis}, album:tab={page.evaluate('() => localStorage.getItem(`album:tab`)')}")
        page.locator('.al-grps [data-tab="3000"]').focus()
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(150)
        if page.evaluate("() => JSON.parse(localStorage.getItem('album:tab'))") != "avanzado":
            probs.append("la flecha → no pasa a «Avanzado»")
        C.reload(page)
        if page.evaluate("() => [...document.querySelectorAll('.al-ths')].filter(s => !s.hidden).map(s => s.dataset.g)") != ["avanzado"]:
            probs.append("al recargar no sigue en la parte elegida")
        page.locator('.al-grps [data-tab="temas"]').click()
        page.locator('.al-ths[data-g="temas"] a[href="#/album/familia"]').click()
        page.wait_for_function("() => location.hash === '#/album/familia' && document.getElementById('al-page')", timeout=5000)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_album_swipe_and_topic_sheet():
    """En un tema, deslizar #al-page a la izquierda pasa al siguiente de su parte y a la derecha al anterior (con el
    dedo); menos de 60 px, en diagonal, sin tema a ese lado o con un diálogo abierto no pasa nada. La pastilla «Tema:
    … ▾» abre la hoja con las partes y sus temas (el actual marcado) y tocar uno lo abre."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        page.evaluate(_NO_HINT)
        C.goto(page, "#/album/familia")
        order = page.evaluate("async () => (await getIndex()).filter(d => d.group === 'temas' && d.langs.includes(lang)).map(d => d.id)")
        i = order.index("familia")
        x, y = _page_point(page)
        _touch_swipe(page, x + 40, y, -45)
        if C.current_hash(page) != "album/familia":
            probs.append(f"45 px a la izquierda ya cambia de tema: #/{C.current_hash(page)}")
        x, y = _page_point(page)
        _touch_swipe(page, x + 60, y, -110, 80)
        if C.current_hash(page) != "album/familia":
            probs.append(f"en diagonal (110 × 80) cambia de tema: #/{C.current_hash(page)}")
        if page.evaluate("() => document.getElementById('al-page').style.translate"):
            probs.append("tras un gesto que no pasa, la página no vuelve a su sitio")
        x, y = _page_point(page)
        _touch_swipe(page, x + 100, y, -200)
        if C.current_hash(page) != f"album/{order[i + 1]}":
            probs.append(f"a la izquierda: #/{C.current_hash(page)} (se esperaba #/album/{order[i + 1]})")
        if not page.evaluate("() => document.getElementById('al-page').classList.contains('in-next')"):
            probs.append("la página nueva no entra por la derecha (.in-next)")
        x, y = _page_point(page)
        _touch_swipe(page, x - 100, y, 200)
        if C.current_hash(page) != "album/familia":
            probs.append(f"a la derecha: #/{C.current_hash(page)} (se esperaba #/album/familia)")
        # con un diálogo abierto (aunque no tape la página) no se pasa de tema
        page.evaluate("() => { const d = document.createElement('dialog'); d.id = 'x-dlg'; document.body.appendChild(d); d.show(); }")
        x, y = _page_point(page)
        _touch_swipe(page, x + 100, y, -200)
        if C.current_hash(page) != "album/familia":
            probs.append(f"con un diálogo abierto deslizar cambia de tema: #/{C.current_hash(page)}")
        page.evaluate("() => document.getElementById('x-dlg').remove()")
        # el primero de su parte: a la derecha no hay nada
        C.goto(page, f"#/album/{order[0]}")
        x, y = _page_point(page)
        _touch_swipe(page, x - 100, y, 200)
        if C.current_hash(page) != f"album/{order[0]}":
            probs.append(f"el primero de la parte, a la derecha: #/{C.current_hash(page)}")
        # la pastilla y su hoja
        C.goto(page, "#/album/familia")
        if "La familia" not in page.locator("#al-tpill").text_content():
            probs.append(f"la pastilla dice {page.locator('#al-tpill').text_content()!r}")
        page.locator("#al-tpill").click()
        page.wait_for_selector("dialog#al-tp-s[open]", timeout=3000)
        page.wait_for_timeout(400)
        r = page.evaluate("""() => ({tg: [...document.querySelectorAll('#al-tp-s [data-tg]')].map(b => [b.dataset.tg, b.getAttribute('aria-selected')]),
          rows: [...document.querySelectorAll('#al-tp-s [data-tp]')].map(b => b.dataset.tp),
          on: [...document.querySelectorAll('#al-tp-s [data-tp][aria-checked=true]')].map(b => b.dataset.tp)})""")
        if r["tg"] != [["temas", "true"], ["3000", "false"], ["avanzado", "false"]] or r["rows"] != order or r["on"] != ["familia"]:
            probs.append(f"la hoja de temas: {r}")
        page.locator('#al-tp-s [data-tg="3000"]').click()
        page.wait_for_timeout(150)
        n3 = page.evaluate("() => document.querySelectorAll('#al-tp-s [data-tp]').length")
        want3 = page.evaluate("async () => (await getIndex()).filter(d => d.group === '3000' && d.langs.includes(lang)).length")
        if n3 != want3:
            probs.append(f"«Las 3000» en la hoja: {n3} temas (se esperaban {want3})")
        page.locator('#al-tp-s [data-tg="temas"]').click()
        page.locator('#al-tp-s [data-tp="paises"]').click()
        page.wait_for_function("() => location.hash === '#/album/paises'", timeout=4000)
        page.wait_for_timeout(500)
        if page.evaluate("() => document.getElementById('al-tp-s').open"):
            probs.append("la hoja sigue abierta tras elegir un tema")
        if "Países" not in page.locator("#al-ph-h").text_content():
            probs.append("tras elegir Países la página no es la de Países")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_album_peel_and_complete_once():
    """Despegar sigue igual: tocar un sobre lo despega (album:seen) y «Pegar las N nuevas» los despega todos; completar
    un tema (todas conseguidas y pegadas) da 50 monedas una sola vez (album:done), también al volver a entrar."""
    probs = []
    page = C.new_page("phone")
    try:
        def unpeeled(d):
            d["album:done:english"].pop("colores", None)
            ks = sorted(k for k, x in d["srs:english"].items() if x["d"] == "colores")[:2]
            for k in ks:
                d["album:seen:english"].pop(k, None)
            d["__keys"] = ks
        data = copy.deepcopy(C.seed_data())
        unpeeled(data)
        ks = data.pop("__keys")
        C.seed(page, {k: C._dumps(v) for k, v in data.items()})
        page.evaluate(_NO_HINT)
        page.evaluate(_HOOK_AWARD)
        C.goto(page, "#/album/colores")
        page.wait_for_timeout(300)
        news = page.locator(".al-st.new")
        if news.count() != 2:
            probs.append(f"colores con 2 sin pegar: {news.count()} sobres")
        pall = page.evaluate("() => { const b = document.getElementById('al-pall'); return b && !b.hidden ? b.textContent.trim() : null; }")
        if pall != "Pegar las 2 nuevas":
            probs.append(f"botón de pegar todas: {pall!r}")
        c0 = page.evaluate(_GAME)["coins"]
        news.first.click()
        page.wait_for_timeout(200)
        seen = page.evaluate("() => JSON.parse(localStorage.getItem('album:seen:english'))")
        if sum(1 for k in ks if k in seen) != 1:
            probs.append("tocar un sobre no lo apunta en album:seen")
        if page.evaluate("() => document.querySelectorAll('.al-st.peeling').length") != 1:
            probs.append("tocar un sobre no lo despega (.peeling)")
        if page.evaluate(_GAME)["coins"] != c0 or page.evaluate("() => __aw.length"):
            probs.append("con un sobre sin pegar ya da el premio")
        page.wait_for_timeout(300)
        page.locator(".al-st.new").first.click()
        page.wait_for_timeout(2900)
        g = page.evaluate(_GAME)
        done = page.evaluate("() => JSON.parse(localStorage.getItem('album:done:english'))")
        aw = page.evaluate("() => __aw")
        if g["coins"] != c0 + 50 or aw != [{"n": 50, "why": "¡Página completa!"}]:
            probs.append(f"completar colores: monedas {c0} → {g['coins']}, award {aw}")
        if done.get("colores") != TODAY:
            probs.append(f"album:done no apunta colores hoy: {done.get('colores')}")
        if not page.evaluate("() => document.getElementById('al-stamp').classList.contains('on')"):
            probs.append("no queda el sello «¡Página completa!»")
        C.goto(page, "#/album")
        C.goto(page, "#/album/colores")
        page.wait_for_timeout(800)
        if page.evaluate(_GAME)["coins"] != c0 + 50 or len(page.evaluate("() => __aw")) != 1:
            probs.append("al volver a entrar da el premio otra vez")
        # «Pegar las 9 nuevas» en la familia: todas a album:seen, sin premio (le faltan)
        C.goto(page, "#/album/familia")
        page.wait_for_timeout(300)
        n = page.locator(".al-st.new").count()
        page.locator("#al-pall").click()
        page.wait_for_timeout(2200)
        fam = page.evaluate("""() => { const s = JSON.parse(localStorage.getItem('album:seen:english')), m = srsAll();
          return Object.keys(m).filter(k => m[k].d === 'familia' && !s[k]).length; }""")
        if n != 9 or fam or page.locator(".al-st.new").count():
            probs.append(f"pegar todas en la familia: {n} sobres, {fam} sin apuntar, {page.locator('.al-st.new').count()} quedan")
        if len(page.evaluate("() => __aw")) != 1:
            probs.append("pegar la familia (incompleta) da premio")
        if page.evaluate("() => document.getElementById('al-pall').hidden") is not True:
            probs.append("el botón de pegar todas no se va")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_album_card_and_ipa():
    """La tarjeta grande sigue abriéndose al tocar una pegatina conseguida, con botones de icono (‹ ›, «Dar la vuelta»);
    la IPA sale de serie y no sale si un mayor la apagó (vocab:ui.ipa = false)."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, "#/album/colores")
        page.locator(".al-st.got").first.click()
        page.wait_for_selector("dialog.al-dlg[open]", timeout=3000)
        page.wait_for_timeout(700)
        r = page.evaluate("""() => { const d = document.querySelector('dialog.al-dlg');
          return {ipa: d.querySelectorAll('.al-front .ipa').length, nb: [...d.querySelectorAll('.al-nb')].map(b => !!b.querySelector('svg')),
            turn: (d.querySelector('.al-turn') || {}).textContent || '', glass: d.querySelectorAll('.glass-btn').length}; }""")
        if not r["ipa"]:
            probs.append("la IPA no sale en la tarjeta (sale de serie)")
        if r["nb"] != [True, True] or "Dar la vuelta" not in r["turn"] or r["glass"] < 3:
            probs.append(f"botones de la tarjeta: {r}")
        page.locator("dialog.al-dlg .al-turn").click()
        page.wait_for_timeout(800)
        if "Ver la pegatina" not in page.locator("dialog.al-dlg .al-turn").text_content():
            probs.append("girar la tarjeta no cambia el botón a «Ver la pegatina»")
        page.keyboard.press("Escape")
        page.evaluate("() => vocabUI.set('ipa', false)")
        page.wait_for_timeout(200)
        page.locator(".al-st.got").first.click()
        page.wait_for_selector("dialog.al-dlg[open]", timeout=3000)
        page.wait_for_timeout(700)
        if page.evaluate("() => document.querySelectorAll('dialog.al-dlg .al-front .ipa').length"):
            probs.append("con la IPA apagada sigue saliendo en la tarjeta")
        page.keyboard.press("Escape")
        page.evaluate("() => vocabUI.set('ipa', null)")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


_PROG = """async () => { const idx = await getIndex(), by = {}, act = store.get('act', {});
  for (const x of Object.values(srsAll())) { if (!x || !x.d) continue; const o = by[x.d] = by[x.d] || {l: 0, m: 0}; if (x.b >= MASTER) o.m++; else o.l++; }
  let total = 0; for (let k = 13; k >= 0; k--) { const d = new Date(); d.setDate(d.getDate() - k); total += +act[dayKey(d)] || 0; }
  const want = idx.filter(d => d.langs.includes(lang) && by[d.id]).map(d => `${d.title}|${Math.min(by[d.id].m, d.count)} de ${d.count} dominadas`);
  const pg = document.querySelector('#ajustes .aj-pg[data-pg="progreso"]');
  const got = pg ? [...pg.querySelectorAll('.aj-pr')].map(r => { const l = r.querySelector('.st-l');
    return `${l.firstChild.textContent.trim()}|${l.querySelector('small').textContent.split(' · ')[0]}`; }) : null;
  return {want, got, total, shown: pg ? +pg.querySelector('.aj-ds b').textContent : null, bars: pg ? pg.querySelectorAll('.aj-days i').length : 0,
    heads: pg ? [...pg.querySelectorAll('.st-h')].map(h => h.textContent) : [], title: document.getElementById('aj-tt').textContent,
    feet: pg ? [...pg.querySelectorAll('.st-foot')].map(f => f.textContent) : []}; }"""


def test_parents_progress_in_settings():
    """Ajustes › Para mayores (tras la Puerta) › «Progreso por tema»: el informe de antes para los padres. Las
    repeticiones de los últimos 14 días (14 barras y el total de store "act") y, por Temas · Las 3000 · Avanzado, cada
    tema empezado con «N de M dominadas» (caja ≥ MASTER) y su barra; los que faltan, contados al pie. Solo lee: la
    partida exportada no cambia. Captura F4c-ajustes-progreso-phone-light."""
    probs = []
    base = C.load_baseline()
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, "#/")
        page.evaluate("() => sessionStorage.setItem('vocab:gate', String(Date.now() + adultGate.MS))")
        page.evaluate("() => { openSettings('mayores'); }")
        page.wait_for_function("() => window.vocabSettings && vocabSettings.page === 'mayores'", timeout=4000)
        page.wait_for_timeout(450)
        row = page.evaluate("() => { const r = document.getElementById('aj-prog'); return r ? r.textContent.replace(/\\s+/g, ' ').trim() : null; }")
        if not row or not row.startswith("Progreso por tema"):
            probs.append(f"Para mayores no tiene la fila «Progreso por tema»: {row!r}")
        page.locator("#aj-prog").click()
        page.wait_for_function("() => vocabSettings.page === 'progreso' && !!document.querySelector('#ajustes .aj-pg[data-pg=\"progreso\"] .aj-days')", timeout=4000)
        page.wait_for_timeout(500)
        r = page.evaluate(_PROG)
        if r["title"] != "Progreso" or r["bars"] != 14 or r["shown"] != r["total"]:
            probs.append(f"progreso: título {r['title']!r}, {r['bars']} barras, total {r['shown']} (se esperaba {r['total']})")
        if not r["want"] or r["got"] != r["want"]:
            probs.append(f"temas: {r['got']} (se esperaba {r['want']})")
        if r["heads"][:1] != ["Últimos 14 días"] or not set(r["heads"][1:]) <= {"Temas", "Las 3000", "Avanzado"} or not r["feet"]:
            probs.append(f"partes: {r['heads']}, pie {r['feet']}")
        C.shot(page, "F4c-ajustes-progreso-phone-light", OUT, full_page=False)
        page.locator("#aj-back").click()
        page.wait_for_function("() => vocabSettings.page === 'mayores'", timeout=3000)
        d = C.diff_exports(base, C.export(page), allow_new=False)
        if d:
            probs.append("mirar el progreso cambia la partida:\n  " + "\n  ".join(d))
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_no_endless_loops():
    """Sin bucles infinitos de atención en Premios, Mi zorro, la portada del álbum y un tema con sobres."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        for h in ("#/progreso", "#/mizorro", "#/album", "#/album/familia"):
            C.goto(page, h)
            page.wait_for_timeout(600)
            e = page.evaluate(_ENDLESS)
            if e:
                probs.append(f"{h}: {e}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- auditoría y capturas
def test_audit_and_captures():
    """Contraste ≥ 4,5:1 y paleta permitida en Premios, la hoja de una medalla, una medalla nueva, Mi zorro, la portada
    del álbum, un tema y la hoja de temas; en móvil y escritorio, claro y oscuro. Capturas F4c-* en capturas/F4."""
    probs = []
    OUT.mkdir(parents=True, exist_ok=True)

    def audit(page, label, scope=("rw-", "mz-", "al-", "shp-", "st-")):
        page.evaluate(_FINISH)
        a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
        probs.extend(f"{label} contraste: {x}" for x in a["contrast"] if any(s in x for s in scope))
        probs.extend(f"{label} paleta: {x}" for x in a["palette"] if any(s in x for s in scope))

    def fresh(d):
        d["vocab:ui"] = {"medals": ["l1", "l10", "g1", "s3", "r3", "w50", "m25", "c200", "f5"], "hints": {"al-swipe": 1000}}

    for kind, scheme in (("phone", "light"), ("phone", "dark"), ("desk", "light"), ("desk", "dark")):
        tag = f"{kind}-{scheme}"
        page = C.new_page(kind, color_scheme=scheme)
        try:
            C.seed(page, _keys(fresh))
            C.goto(page, "#/progreso", settle_ms=50)
            page.wait_for_timeout(700)
            C.shot(page, f"F4c-medalla-nueva-{tag}", OUT, full_page=False)
            page.wait_for_timeout(1200)
            audit(page, f"{tag} premios (nueva)")
            C.goto(page, "#/mizorro")
            C.goto(page, "#/progreso")
            page.wait_for_timeout(300)
            audit(page, f"{tag} premios")
            C.shot(page, f"F4c-premios-{tag}", OUT, full_page=kind == "phone")
            page.locator(".rw-m.lock").first.click()
            page.wait_for_selector("dialog#rw-sheet[open]", timeout=3000)
            page.wait_for_timeout(600)
            audit(page, f"{tag} hoja de medalla")
            C.shot(page, f"F4c-medalla-hoja-{tag}", OUT, full_page=False)
            page.locator("#rw-sheet [data-close]").click()
            page.wait_for_function("() => !document.getElementById('rw-sheet').open", timeout=3000)
            C.goto(page, "#/mizorro")
            page.wait_for_timeout(400)
            audit(page, f"{tag} mi zorro")
            C.shot(page, f"F4c-mizorro-{tag}", OUT, full_page=False)
            page.locator('#mz-seg [data-t="hat"]').click()
            page.wait_for_timeout(300)
            audit(page, f"{tag} mi zorro sombreros")
            C.goto(page, "#/album")
            page.wait_for_timeout(400)
            audit(page, f"{tag} álbum")
            C.shot(page, f"F4c-album-{tag}", OUT, full_page=kind == "phone")
            C.goto(page, "#/album/familia")
            page.wait_for_timeout(600)
            audit(page, f"{tag} tema")
            C.shot(page, f"F4c-album-tema-{tag}", OUT, full_page=False)
            page.locator("#al-tpill").click()
            page.wait_for_selector("dialog#al-tp-s[open]", timeout=3000)
            page.wait_for_timeout(600)
            audit(page, f"{tag} hoja de temas")
            C.shot(page, f"F4c-album-temas-{tag}", OUT, full_page=False)
            page.keyboard.press("Escape")
            C.goto(page, f"#/album/colores")
            page.wait_for_timeout(500)
            audit(page, f"{tag} tema completo")
            if page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1"):
                probs.append(f"{tag}: la página se sale de lado")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- partida
def test_export_matches_baseline():
    """Mirar Premios (y la hoja de una medalla), Mi zorro (sus pestañas, sin comprar), la portada del álbum (cambiando de
    parte y volviendo), un tema, la hoja de temas y pasar de tema deslizando no cambia la partida exportada: es la de la
    base (album:uniq es una caché que el álbum completa al abrir un tema, como siempre)."""
    base = C.load_baseline()
    assert base, "falta tests/e2e/baseline/export.json"
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        d = C.diff_exports(base, C.export(page))
        if d:
            probs.append("al arrancar la partida no es la de la base:\n  " + "\n  ".join(d))
        C.goto(page, "#/progreso")
        page.locator(".rw-m").first.click()
        page.wait_for_selector("dialog#rw-sheet[open]", timeout=3000)
        page.keyboard.press("Escape")
        C.goto(page, "#/mizorro")
        for t in ("hat", "face", "hand", "pet", "hero"):
            page.locator(f'#mz-seg [data-t="{t}"]').click()
            page.wait_for_timeout(80)
        C.goto(page, "#/album")
        page.locator('.al-grps [data-tab="3000"]').click()
        page.locator('.al-grps [data-tab="temas"]').click()
        C.goto(page, f"#/album/colores")
        page.locator("#al-tpill").click()
        page.wait_for_selector("dialog#al-tp-s[open]", timeout=3000)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        x, y = _page_point(page)
        _touch_swipe(page, x - 100, y, 200)
        C.goto(page, "")
        d = [x for x in C.diff_exports(base, C.export(page), allow_new=False) if "album:uniq" not in x]
        if d:
            probs.append("mirar Premios, Mi zorro y el álbum cambia la partida:\n  " + "\n  ".join(d))
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
