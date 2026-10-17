"""F4b: la granja a pantalla completa (js/farm.js registra ROUTES.granja; granji() ya no está en index.html).

Se comprueba: la escena ocupa toda la pantalla (sin título, sin ficha del personaje, sin scroll) y el dock de vidrio
ligero tiene 3 botones (Regar · Comida · Tienda); la hoja de la tienda solo trae cosas de la granja y comida, comprar
resta una vez y no vuelve a montar la granja, y la pastilla de monedas abre la misma hoja (también desde otra pestaña);
arrastrar la comida hasta un animal deja la partida igual que tocar la comida y luego el animal (y que elegirla en su
globo); arrastrar la regadera hasta una planta, igual que «Regar» y tocarla; acariciar no cambia s.fed; mantener
pulsado y mover se guarda (sigue tras recargar) y soltar sin mover la deja donde estaba; ni bienvenida ni ayuda (la
primera vez, la mano que enseña a arrastrar); «¿Cómo me llamo?» con «Dilo»: el reconocedor que acierta pone la
palabra en el repaso como una lección y el que no entiende nunca cuenta como fallo; un animal con hambre dice la frase
en el idioma con su voz (speechSynthesis simulado); la capa .fm-season y el evento "farm-mounted"; contraste y
paleta; sin errores de consola; la partida exportada es la de la base. Capturas en capturas/F4 (F4b-granja-*)."""
from __future__ import annotations

import json
import re

import common as C

_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
_H = 3600 * 1000
_OUT = C.CAPTURAS / "F4"

# la voz del navegador, simulada: guarda lo que se diría (texto e idioma) sin sonar
_SPEECH = r"""
(() => {
  window.__spoken = [];
  try {
    const ss = window.speechSynthesis;
    if (ss) Object.defineProperty(ss, 'speak', {configurable: true, writable: true,
      value: u => { window.__spoken.push({text: String((u && u.text) || ''), lang: String((u && u.lang) || '')}); }});
  } catch (e) {}
})();
"""
# reconocedor de voz simulado: "right" dice el nombre del animal del globo (en mayúsculas y con signos), "wrong" otra
# cosa, "silent" nada (no-speech) y "denied" sin permiso
_FAKE_SR = r"""
(() => {
  class FakeSR {
    constructor(){ this.lang = ''; this.maxAlternatives = 1; this.onresult = this.onerror = this.onend = null; }
    start(){
      window.__srStarts = (window.__srStarts || 0) + 1; window.__srLang = this.lang;
      const mode = window.__srMode || 'right';
      setTimeout(() => {
        if (this._ab) return;
        if (mode === 'silent' || mode === 'denied') {
          if (this.onerror) this.onerror({error: mode === 'silent' ? 'no-speech' : 'not-allowed'});
          if (this.onend) this.onend();
          return;
        }
        const pop = document.querySelector('.fm-pop'), id = pop && pop.dataset.fid;
        const b = id && document.querySelector(`.fm-opt[data-fo="${id}"]`), w = b ? b.textContent.trim() : '';
        const alts = mode === 'right' ? ['zzzz', w.toUpperCase() + '!'] : ['zzzz qqqq', 'xxxxxx'];
        if (this.onresult) this.onresult({results: [alts.map(t => ({transcript: t, confidence: .7}))]});
        if (this.onend) this.onend();
      }, 120);
    }
    stop(){}
    abort(){ this._ab = true; setTimeout(() => { if (this.onerror) this.onerror({error: 'aborted'}); if (this.onend) this.onend(); }, 0); }
  }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
})();
"""
_NO_SR = r"""
(() => {
  try { Object.defineProperty(window, 'webkitSpeechRecognition', {value: undefined, configurable: true, writable: true}); } catch (e) {}
  try { Object.defineProperty(window, 'SpeechRecognition', {value: undefined, configurable: true, writable: true}); } catch (e) {}
})();
"""
# ganchos (en Hoy, antes de entrar en la granja): eventos del bus, vibraciones, sonidos y temblores
_HOOKS = """() => {
  if (window.__fmHooks) return; window.__fmHooks = true;
  window.__ev = []; window.__hap = []; window.__sfx = []; window.__nope = 0;
  for (const n of ['farm-mounted', 'farm-feed', 'buy', 'farm-buy']) bus.on(n, d => {
    if (n === 'farm-mounted') __ev.push([n, {stage: !!d && d.stage === document.querySelector('#app .fm-stage'),
      season: !!(d && d.season && d.season.matches('.fm-season')), world: !!(d && d.world && d.world.matches('.fm-world'))}]);
    else __ev.push([n, d && d.item ? d.item.id : (d && d.food) || null]);
  });
  if (window.G) { const h0 = G.haptic.bind(G); G.haptic = t => { __hap.push(t); return h0(t); }; }
  if (window.sfx) { const p0 = sfx.play.bind(sfx); sfx.play = n => { __sfx.push(n); return p0(n); }; }
  if (window.M && M.nope) { const n0 = M.nope.bind(M); M.nope = (...a) => { __nope++; return n0(...a); }; }
}"""
_FARM = "() => JSON.parse(localStorage.getItem('farm:state'))"
_GAME = "() => JSON.parse(localStorage.getItem('game'))"
_STORE = """() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; }"""
_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""


def _keys(farm=None, game=None, drop_srs=(), **top):
    """La partida sembrada con cambios: campos de "farm:state" o de "game" (dicts que se mezclan), palabras quitadas del
    repaso en inglés y claves de arriba (p. ej. lang="français")."""
    data = C.seed_data()
    if farm:
        data["farm:state"].update(farm)
    if game:
        data["game"].update(game)
    for k in drop_srs:
        data["srs:english"].pop(k, None)
    data.update(top)
    return {k: json.dumps(v, ensure_ascii=False, separators=(",", ":")) for k, v in data.items()}


def _page(kind="phone", sr=None, **kw):
    page = C.new_page(kind, **kw)
    page.add_init_script(_SPEECH)
    if sr:
        page.add_init_script(sr)
    return page


def _open(page, keys=None):
    """Siembra la partida (en Hoy), pone los ganchos y entra en la granja."""
    C.seed(page, keys)
    page.evaluate(_HOOKS)
    C.goto(page, "#/granja")
    page.wait_for_selector("#app .fm-stage .fm-it", timeout=6000)


def _center(page, sel):
    loc = page.locator(sel).first
    if sel.startswith("#fm-shop"):
        loc.scroll_into_view_if_needed()
    b = loc.bounding_box()
    assert b, f"no se ve {sel}"
    return b["x"] + b["width"] / 2, b["y"] + b["height"] / 2


def _tap(page, sel):
    """Toca el centro (como un dedo: sin esperar a que la cosa deje de moverse)."""
    x, y = _center(page, sel)
    page.mouse.click(x, y)


def _drag(page, src, dst, steps=14):
    """Arrastra desde el centro de src hasta el centro de dst (que se vuelve a medir al final)."""
    x0, y0 = _center(page, src)
    page.mouse.move(x0, y0)
    page.mouse.down()
    x1, y1 = _center(page, dst)
    for i in range(1, steps + 1):
        page.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps)
        page.wait_for_timeout(16)
    x1, y1 = _center(page, dst)
    page.mouse.move(x1, y1)
    page.wait_for_timeout(30)
    page.mouse.up()


def _it(fid):
    return f'#app .fm-it[data-fid="{fid}"] .fm-e'


def _norm(store, t0):
    """La partida para comparar dos caminos: sin la hora de la visita, con las horas de ahora como «ahora» y los
    regalos del suelo sin su clave ni su sitio (son al azar). vocab:ui (pistas de gestos) no es de la partida."""
    out = {}
    for k, v in store.items():
        if k == "vocab:ui":
            continue
        try:
            v = json.loads(v)
        except Exception:
            pass
        out[k] = v
    f = out.get("farm:state")
    if isinstance(f, dict):
        f = dict(f)
        f.pop("visit", None)
        f["fed"] = {k: ("ahora" if v >= t0 else v) for k, v in f.get("fed", {}).items()}
        f["prod"] = sorted([P["a"], P["p"]] for P in f.get("prod", {}).values())
        f["pl"] = {k: dict(p, w=("ahora" if (p.get("w") or 0) >= t0 else p.get("w"))) for k, p in f.get("pl", {}).items()}
        out["farm:state"] = f
    return out


def _diff(a, b, pre=""):
    out = []
    for k in sorted(set(a) | set(b)):
        if a.get(k) != b.get(k):
            if isinstance(a.get(k), dict) and isinstance(b.get(k), dict):
                out += _diff(a[k], b[k], pre + k + ".")
            else:
                out.append(f"{pre}{k}: {json.dumps(a.get(k), ensure_ascii=False)[:140]} ≠ {json.dumps(b.get(k), ensure_ascii=False)[:140]}")
    return out


# ---------------------------------------------------------------- la escena y el dock
_SCENE = """() => {
  const st = document.querySelector('#app .fm-stage'), r = st.getBoundingClientRect();
  const dock = st.querySelector('.fm-dock'), dr = dock.getBoundingClientRect(), dcs = getComputedStyle(dock);
  const tb = document.getElementById('tabbar'), tr = tb.getBoundingClientRect();
  const se = st.querySelector('.fm-season'), sr = se.getBoundingClientRect();
  const z = s => getComputedStyle(st.querySelector(s)).zIndex, w = getComputedStyle(st.querySelector('.fm-world'));
  const btn = [...document.querySelectorAll('#app button, #app [role=button]')].map(b => b.textContent.trim());
  return {
    rect: [r.x, r.y, r.width, r.height].map(Math.round), vw: innerWidth, vh: innerHeight, pos: getComputedStyle(st).position,
    scroll: [document.scrollingElement.scrollWidth, document.scrollingElement.scrollHeight],
    dock: {cls: dock.className, bf: dcs.backdropFilter + '|' + (dcs.webkitBackdropFilter || 'none'), rect: [dr.x, dr.y, dr.width, dr.height].map(Math.round),
      btns: [...dock.querySelectorAll('button')].map(b => ({t: b.querySelector('.lb') && b.querySelector('.lb').textContent, fm: b.dataset.fm,
        svg: !!b.querySelector('svg'), h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width)}))},
    tab: [tr.top, tr.bottom].map(Math.round), tabLite: tb.classList.contains('lite'), tabBf: getComputedStyle(tb).backdropFilter,
    season: {n: st.querySelectorAll('.fm-season').length, kids: se.childNodes.length, aria: se.getAttribute('aria-hidden'), pe: getComputedStyle(se).pointerEvents,
      rect: [sr.x, sr.y, sr.width, sr.height].map(Math.round), z: z('.fm-season'), ground: z('.fm-ground'), layer: z('.fm-layer'), world: w.zIndex + '|' + w.transform + '|' + w.isolation},
    old: {h2: document.querySelectorAll('#app h2').length, me: document.querySelectorAll('#app .me, #me-name').length, tasks: document.querySelectorAll('.fm-tasks').length,
      tabs: document.querySelectorAll('.shop-tabs').length, shop: document.querySelectorAll('#app > .shop, #app #shop').length, dlg: document.querySelectorAll('dialog[open]').length,
      help: btn.filter(t => /ayuda|cómo se juega|instrucciones/i.test(t)), welcome: /bienvenid/i.test(document.body.innerText)},
    api: !!window.vocabFarm && window.vocabFarm.stage === st && typeof vocabFarm.openShop === 'function' && typeof vocabFarm.closeShop === 'function',
    ev: window.__ev || []};
}"""


def test_scene_fills_screen_dock_and_season():
    """Móvil y escritorio: .fm-stage fija y del tamaño de la pantalla (también bajo la barra de estado), sin scroll; sin
    título, ficha del personaje, tareas, pestañas de tienda, bienvenida ni ayuda; el dock es de vidrio ligero sin
    desenfoque, encima de la barra de pestañas, con 3 botones (icono y texto, ≥ 44 px): Regar · Comida · Tienda. La capa
    .fm-season (vacía, aria-hidden, sin toques, toda la pantalla, encima del suelo y debajo de los animales) y
    "farm-mounted" {stage, season, world} una vez; window.vocabFarm.stage es la escena."""
    probs = []
    for kind in ("phone", "desk"):
        page = _page(kind)
        try:
            _open(page)
            page.wait_for_timeout(500)
            r = page.evaluate(_SCENE)
            if r["rect"] != [0, 0, r["vw"], r["vh"]] or r["pos"] != "fixed":
                probs.append(f"{kind}: la escena no ocupa la pantalla: {r['rect']} ({r['pos']}) en {r['vw']}×{r['vh']}")
            if r["scroll"][0] > r["vw"] + 1 or r["scroll"][1] > r["vh"] + 1:
                probs.append(f"{kind}: la página tiene scroll: {r['scroll']}")
            d = r["dock"]
            if [b["fm"] for b in d["btns"]] != ["water", "food", "shop"] or [b["t"] for b in d["btns"]] != ["Regar", "Comida", "Tienda"]:
                probs.append(f"{kind}: botones del dock: {d['btns']}")
            if not all(b["svg"] and b["h"] >= 44 and b["w"] >= 44 for b in d["btns"]):
                probs.append(f"{kind}: botones sin icono o pequeños: {d['btns']}")
            if "glass" not in d["cls"].split() or "lite" not in d["cls"].split() or d["bf"] != "none|none":
                probs.append(f"{kind}: el dock no es vidrio ligero sin desenfoque: {d['cls']} {d['bf']}")
            x, y, w, h = d["rect"]
            if kind == "phone" and y + h > r["tab"][0]:
                probs.append(f"{kind}: el dock no queda encima de la barra de pestañas: dock {d['rect']}, barra {r['tab']}")
            if y + h > r["vh"] or x < 0 or x + w > r["vw"] or abs(x + w / 2 - r["vw"] / 2) > 2:
                probs.append(f"{kind}: el dock se sale o no está centrado: {d['rect']}")
            if not r["tabLite"] or r["tabBf"] != "none":
                probs.append(f"{kind}: la barra de pestañas no es ligera: lite={r['tabLite']} {r['tabBf']}")
            s = r["season"]
            if s["n"] != 1 or s["kids"] or s["aria"] != "true" or s["pe"] != "none" or s["rect"] != [0, 0, r["vw"], r["vh"]]:
                probs.append(f"{kind}: .fm-season: {s}")
            if not (int(s["ground"]) < int(s["z"]) < int(s["layer"])) or not s["world"].startswith("auto|none|"):
                probs.append(f"{kind}: .fm-season no queda entre el suelo y los animales: {s}")
            if any(r["old"][k] for k in ("h2", "me", "tasks", "tabs", "shop", "dlg")) or r["old"]["help"] or r["old"]["welcome"]:
                probs.append(f"{kind}: quedan cosas de la granja de antes: {r['old']}")
            mounted = [e for e in r["ev"] if e[0] == "farm-mounted"]
            if mounted != [["farm-mounted", {"stage": True, "season": True, "world": True}]]:
                probs.append(f"{kind}: farm-mounted: {mounted}")
            if not r["api"]:
                probs.append(f"{kind}: window.vocabFarm no está completo o stage no es la escena")
            # salir y volver: se monta otra vez (y se vuelve a avisar)
            C.goto(page, "#/")
            if page.evaluate("() => window.vocabFarm.stage") is not None:
                probs.append(f"{kind}: vocabFarm.stage sigue fuera de la granja")
            C.goto(page, "#/granja")
            page.wait_for_timeout(200)
            n = page.evaluate("() => __ev.filter(e => e[0] === 'farm-mounted' && e[1].stage).length")
            if n != 2:
                probs.append(f"{kind}: al volver, farm-mounted {n} veces en total (se esperaban 2)")
            probs += [f"{kind}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la tienda
_SHOP = """() => {
  const d = document.getElementById('fm-shop'); if (!d) return null;
  const ids = [...d.querySelectorAll('.sc[data-id]')].map(c => c.dataset.id);
  return {open: d.open, cls: d.className, det: d.dataset.detent, title: d.querySelector('.m-head h2') && d.querySelector('.m-head h2').textContent,
    ids, farm: SHOP.filter(x => x.t === 'farm').map(x => x.id), modes: [...new Set([...d.querySelectorAll('.sc[data-id]')].map(c => c.dataset.mode))],
    foods: [...d.querySelectorAll('.fm-prow[data-pf]')].map(r => r.dataset.pf), wear: d.querySelectorAll('[data-wear]').length,
    coins: d.querySelector('[data-fm-coins]') && d.querySelector('[data-fm-coins]').textContent, n: document.querySelectorAll('dialog[open]').length};
}"""


def test_shop_sheet_only_farm_and_buys_once():
    """«Tienda» abre una hoja (a media altura en el móvil) con la comida y solo las cosas de la granja (modo 'farm', sin
    nada que ponerse). Comprar una cosa resta su precio una vez (bus "buy" una vez, también con doble toque) y aparece en
    la escena sin volver a montar la granja; comprar comida resta lo que dice el botón y suma raciones. La pastilla de
    monedas abre la misma hoja, en la granja y desde otra pestaña. Sin monedas, aviso amable sin temblor ni sonido triste."""
    probs = []
    page = _page("phone")
    try:
        _open(page)
        page.evaluate("() => { document.querySelector('#app .fm-stage').__keep = 1; }")
        _tap(page, '#app .fm-dock [data-fm="shop"]')
        page.wait_for_selector("#fm-shop[open] .sc[data-id]", timeout=4000)
        page.wait_for_timeout(400)
        s = page.evaluate(_SHOP)
        if sorted(s["ids"]) != sorted(s["farm"]) or s["modes"] != ["farm"] or s["wear"]:
            probs.append(f"la hoja no trae solo la granja: {len(s['ids'])}/{len(s['farm'])} piezas, modos {s['modes']}, [data-wear] {s['wear']}")
        if s["title"] != "Tienda" or s["det"] != "medium" or "m-sheet" not in s["cls"] or s["n"] != 1:
            probs.append(f"la hoja: {s}")
        if sorted(s["foods"]) != ["grano", "heno", "zanahoria"]:
            probs.append(f"comida de la hoja: {s['foods']} (se esperaba la de sus animales)")
        # dos alturas: al bajar el contenido crece a toda altura (y así las piezas ya no se mueven al tocarlas)
        h0 = page.evaluate("() => { const d = document.getElementById('fm-shop'), h = d.getBoundingClientRect().height; d.scrollTop = 60; return h; }")
        page.wait_for_timeout(500)
        h1 = page.evaluate("() => [document.getElementById('fm-shop').dataset.detent, document.getElementById('fm-shop').getBoundingClientRect().height]")
        if h1[0] != "large" or h1[1] <= h0 + 40:
            probs.append(f"la hoja no crece al bajar: {h0} → {h1}")
        # comprar el cerdo (35) con doble toque
        g0 = page.evaluate(_GAME)
        x, y = _center(page, '#fm-shop .sc[data-id="cerdo"] [data-buy]')
        page.mouse.click(x, y)
        page.wait_for_timeout(120)
        page.mouse.click(x, y)
        page.wait_for_selector('#app .fm-layer .fm-it[data-fid="cerdo"]', timeout=9000)
        page.wait_for_timeout(400)
        g1 = page.evaluate(_GAME)
        ev = page.evaluate("() => __ev")
        if g1["coins"] != g0["coins"] - 35 or not g1["owned"].get("cerdo"):
            probs.append(f"comprar el cerdo: monedas {g0['coins']} → {g1['coins']}, suyo {g1['owned'].get('cerdo')}")
        if [e for e in ev if e[0] == "buy"] != [["buy", "cerdo"]]:
            probs.append(f"bus 'buy': {[e for e in ev if e[0] == 'buy']}")
        keep = page.evaluate("() => !!document.querySelector('#app .fm-stage').__keep && document.getElementById('fm-shop').open")
        if not keep or [e for e in ev if e[0] == "farm-mounted"].__len__() != 1:
            probs.append("comprar volvió a montar la granja o cerró la hoja")
        card = page.evaluate("() => { const c = document.querySelector('#fm-shop .sc[data-id=cerdo]'); return c && {st: c.dataset.st, buy: !!c.querySelector('[data-buy]')}; }")
        if not card or card["st"] != "own" or card["buy"]:
            probs.append(f"la pieza del cerdo tras comprar: {card}")
        if page.evaluate("() => document.querySelector('#fm-shop [data-fm-coins]').textContent") != str(g1["coins"]):
            probs.append("las monedas de la hoja no bajan")
        # la comida del cerdo (ya la tenía en la hoja: grano) y comprar 1 de grano
        f0 = page.evaluate(_FARM)
        btn = page.locator('#fm-shop [data-fbuy="grano"][data-n="1"]')
        cost = int(re.sub(r"\D", "", btn.locator(".t-num").text_content()))
        c1 = page.evaluate(_GAME)["coins"]
        _tap(page, '#fm-shop [data-fbuy="grano"][data-n="1"]')
        page.wait_for_timeout(300)
        f1, c2 = page.evaluate(_FARM), page.evaluate(_GAME)["coins"]
        if f1["pan"].get("grano", 0) != f0["pan"].get("grano", 0) + 1 or c2 != c1 - cost:
            probs.append(f"comprar grano: raciones {f0['pan'].get('grano')} → {f1['pan'].get('grano')}, monedas {c1} → {c2} (cuesta {cost})")
        if [e for e in page.evaluate("() => __ev") if e[0] == "farm-buy"] != [["farm-buy", "grano"]]:
            probs.append(f"farm-buy: {page.evaluate('() => __ev')}")
        row = page.evaluate("() => document.querySelector('#fm-shop .fm-prow[data-pf=grano] .fm-have b').textContent")
        if row != str(f1["pan"]["grano"]):
            probs.append(f"«Tienes N» de la hoja no se pone al día: {row}")
        # cerrar con «Listo» y abrir con la pastilla de monedas
        page.locator("#fm-shop [data-x]").click()
        page.wait_for_function("() => !document.getElementById('fm-shop').open", timeout=3000)
        page.wait_for_timeout(300)
        page.locator("[data-coins-pill]").click()
        page.wait_for_function("() => document.getElementById('fm-shop') && document.getElementById('fm-shop').open", timeout=3000)
        page.locator("#fm-shop [data-x]").click()
        page.wait_for_function("() => !document.getElementById('fm-shop').open", timeout=3000)
        # desde otra pestaña: va a la granja y la abre
        C.goto(page, "#/progreso")
        page.locator("[data-coins-pill]").click()
        page.wait_for_function("() => location.hash === '#/granja' && document.getElementById('fm-shop') && document.getElementById('fm-shop').open", timeout=6000)
        if page.evaluate("() => document.querySelectorAll('dialog[open]').length") != 1:
            probs.append("desde otra pestaña se abre más de una hoja")
        if page.evaluate("() => __sfx.includes('bad') || __nope > 0"):
            probs.append("suena 'bad' o tiembla algo")
        probs += C.errors(page)
    finally:
        page.context.close()
    # sin monedas
    page = _page("phone")
    try:
        _open(page, _keys(game={"coins": 3}))
        page.evaluate("() => vocabFarm.openShop()")
        page.wait_for_selector("#fm-shop[open] .sc[data-id]", timeout=4000)
        g0, f0 = page.evaluate(_GAME), page.evaluate(_FARM)
        _tap(page, '#fm-shop [data-fbuy="heno"][data-n="3"]')
        _tap(page, '#fm-shop .sc[data-id="cerdo"] [data-buy]')
        page.wait_for_timeout(400)
        if page.evaluate(_GAME) != g0 or page.evaluate(_FARM)["pan"] != f0["pan"]:
            probs.append("sin monedas: la partida cambió")
        m = page.evaluate("() => document.querySelector('#fm-shop .fm-prow[data-pf=heno] .fm-rm').textContent")
        if "Te faltan" not in m:
            probs.append(f"sin monedas: falta el aviso amable en la fila: {m!r}")
        if page.evaluate("() => __sfx.includes('bad') || __nope > 0"):
            probs.append("sin monedas: suena 'bad' o tiembla algo")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- dar de comer y regar: arrastrar = tocar
def _feed(kind, how):
    """Da zanahoria al conejo (tiene hambre) de una de tres maneras y devuelve la partida normalizada y lo que pasó."""
    page = _page(kind, reduced_motion="reduce")
    try:
        _open(page)
        page.wait_for_timeout(300)
        t0 = page.evaluate("Date.now()")
        if how == "drag":
            _tap(page, '#app .fm-dock [data-fm="food"]')
            page.wait_for_selector('#app .fm-tray [data-pfood="zanahoria"]', timeout=3000)
            page.wait_for_timeout(300)   # (la bandeja termina de aparecer)
            _drag(page, '#app .fm-tray [data-pfood="zanahoria"]', _it("conejo"))
        elif how == "tap":
            _tap(page, '#app .fm-dock [data-fm="food"]')
            page.wait_for_selector('#app .fm-tray [data-pfood="zanahoria"]', timeout=3000)
            page.wait_for_timeout(300)   # (la bandeja termina de aparecer)
            _tap(page, '#app .fm-tray [data-pfood="zanahoria"]')
            page.wait_for_timeout(150)
            _tap(page, _it("conejo"))
        else:   # su globo
            _tap(page, _it("conejo"))
            page.wait_for_selector('#app .fm-pop[data-kind="feed"] [data-food="zanahoria"]', timeout=3000)
            page.wait_for_timeout(150)
            _tap(page, '#app .fm-pop [data-food="zanahoria"]')
        try:
            page.wait_for_selector('#app .fm-pop[data-kind="quiz"]:not([hidden])', timeout=9000)
        except Exception:
            info = page.evaluate("""() => ({ev: __ev, pan: JSON.parse(localStorage.getItem('farm:state')).pan, pop: document.querySelector('#app .fm-pop').dataset.kind,
              hidden: document.querySelector('#app .fm-pop').hidden, bub: document.querySelector('#app .fm-bub').textContent})""")
            raise AssertionError(f"{kind} «{how}»: no sale «¿Cómo me llamo?» tras dar de comer: {info}")
        page.wait_for_timeout(300)
        st = _norm(page.evaluate(_STORE), t0)
        ev = [e for e in page.evaluate("() => __ev") if e[0] == "farm-feed"]
        return st, ev, C.errors(page)
    finally:
        page.context.close()


def test_drag_food_equals_tap_food_then_animal():
    """Arrastrar la zanahoria de la bandeja hasta el conejo deja la partida exactamente igual que tocar la zanahoria y
    luego el conejo, y que tocar el conejo y elegirla en su globo: una ración menos, s.fed del conejo a ahora, el mismo
    regalo, "farm-feed" una vez y luego «¿Cómo me llamo?»."""
    probs = []
    st_t, ev_t, er_t = _feed("phone", "tap")
    probs += er_t
    f = st_t["farm:state"]
    if f["pan"].get("zanahoria") != 1 or f["fed"]["conejo"] != "ahora" or ev_t != [["farm-feed", "conejo"]]:
        probs.append(f"tocar: zanahoria {f['pan'].get('zanahoria')}, fed {f['fed']['conejo']}, eventos {ev_t}")
    for how in ("drag", "pop"):
        st, ev, er = _feed("phone", how)
        probs += [f"{how}: {e}" for e in er]
        d = _diff(st_t, st)
        if d or ev != ev_t:
            probs.append(f"«{how}» no deja lo mismo que tocar:\n  " + "\n  ".join(d + ([f"eventos {ev} ≠ {ev_t}"] if ev != ev_t else [])))
    st_d, ev_d, er_d = _feed("desk", "drag")
    probs += [f"desk: {e}" for e in er_d]
    if st_d["farm:state"]["fed"]["conejo"] != "ahora" or ev_d != [["farm-feed", "conejo"]]:
        probs.append(f"escritorio: arrastrar no da de comer: {ev_d}")
    assert not probs, "\n".join(probs)


def _water(how, plant):
    page = _page("phone", reduced_motion="reduce")
    try:
        _open(page)
        page.wait_for_timeout(300)
        t0 = page.evaluate("Date.now()")
        if how == "drag":
            _drag(page, '#app .fm-dock [data-fm="water"]', _it(plant))
        else:
            _tap(page, '#app .fm-dock [data-fm="water"]')
            page.wait_for_timeout(150)
            _tap(page, _it(plant))
        page.wait_for_timeout(1100)
        st = _norm(page.evaluate(_STORE), t0)
        pressed = page.evaluate("() => document.querySelector('#app .fm-dock [data-fm=water]').getAttribute('aria-pressed')")
        return st, pressed, C.errors(page)
    finally:
        page.context.close()


def test_drag_water_equals_tap_water():
    """Arrastrar la regadera del dock hasta la zanahoria (con sed) es lo mismo que «Regar» y tocarla (crece y guarda la
    hora); hasta el girasol (ya bebió hace 1 h) gasta 1 gota extra igual que tocando. Arrastrar no deja el modo Regar
    puesto."""
    probs = []
    for plant, want in (("zanahoria", {"s": 1, "w": "ahora", "drops": 2}), ("girasol", {"s": 2, "w": "ahora", "drops": 1})):
        st_t, pr_t, er_t = _water("tap", plant)
        st_d, pr_d, er_d = _water("drag", plant)
        probs += er_t + er_d
        p = st_t["farm:state"]["pl"][plant]
        got = {"s": p["s"], "w": p["w"], "drops": st_t["farm:state"]["drops"]}
        if got != want:
            probs.append(f"{plant}: regar tocando: {got} (se esperaba {want})")
        d = _diff(st_t, st_d)
        if d:
            probs.append(f"{plant}: arrastrar la regadera no deja lo mismo que tocar:\n  " + "\n  ".join(d))
        if pr_d != "false":
            probs.append(f"{plant}: tras arrastrar, Regar queda puesto ({pr_d})")
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- acariciar y mover
def test_pet_keeps_fed_and_hold_moves_and_persists():
    """Tocar la gallina (llena) la acaricia: corazones y su nombre, sin globo de comer y sin tocar s.fed ni la despensa;
    tocar el pato (puede comer) abre su globo junto a él, sin tocar s.fed. Mantener pulsada 500 ms la gallina la levanta
    (escala 1,06, sombra, G.haptic('selection')); al moverla y soltar se guarda en farm:state.pos y sigue ahí tras
    recargar; mantener y soltar sin mover la deja donde estaba (y ese toque no hace nada más)."""
    probs = []
    page = _page("phone", reduced_motion="reduce")
    try:
        _open(page)
        page.wait_for_timeout(300)
        f0 = page.evaluate(_FARM)
        _tap(page, _it("gallina"))
        page.wait_for_timeout(400)
        b = page.evaluate("() => { const b = document.querySelector('#app .fm-bub'); return {shown: !b.hidden, text: b.textContent, pop: !document.querySelector('#app .fm-pop').hidden}; }")
        if not b["shown"] or "hen" not in b["text"] or "lleno" not in b["text"] or b["pop"]:
            probs.append(f"acariciar la gallina: {b}")
        _tap(page, _it("pato"))
        page.wait_for_selector('#app .fm-pop[data-kind="feed"]:not([hidden])', timeout=3000)
        pop = page.evaluate("""() => { const p = document.querySelector('#app .fm-pop'), r = p.getBoundingClientRect(), a = document.querySelector('#app .fm-it[data-fid=pato] .fm-e').getBoundingClientRect();
          return {fid: p.dataset.fid, near: Math.abs((r.left + r.right) / 2 - (a.left + a.right) / 2) < 200 && (r.bottom <= a.top + 4 || r.top >= a.bottom - 4)}; }""")
        if pop["fid"] != "pato" or not pop["near"]:
            probs.append(f"el globo de comer del pato no sale junto a él: {pop}")
        page.locator("#app .fm-pop .fm-x").click()
        page.wait_for_timeout(200)
        f1 = page.evaluate(_FARM)
        if f1["fed"] != f0["fed"] or f1["pan"] != f0["pan"]:
            probs.append(f"acariciar cambió s.fed o la despensa: {f0['fed']} → {f1['fed']}")
        # mantener y soltar sin mover
        x, y = _center(page, _it("gallina"))
        page.evaluate("() => { document.querySelector('#app .fm-bub').hidden = true; }")
        page.mouse.move(x, y)
        page.mouse.down()
        page.wait_for_timeout(650)
        lift = page.evaluate("""() => { const el = document.querySelector('#app .fm-it[data-fid=gallina]'), b = getComputedStyle(el.querySelector('.fm-body'));
          return {lift: el.classList.contains('lift'), scale: b.scale, shadow: getComputedStyle(el.querySelector('.fm-e')).filter}; }""")
        if not lift["lift"] or lift["scale"] != "1.06" or "drop-shadow" not in lift["shadow"]:
            probs.append(f"al mantener pulsada no se levanta: {lift}")
        page.mouse.up()
        page.wait_for_timeout(300)
        f2 = page.evaluate(_FARM)
        st = page.evaluate("() => ({bub: !document.querySelector('#app .fm-bub').hidden, lift: !!document.querySelector('.fm-it.lift'), hap: __hap})")
        if f2["pos"]["gallina"] != f0["pos"]["gallina"] or st["bub"] or st["lift"]:
            probs.append(f"soltar sin mover: pos {f0['pos']['gallina']} → {f2['pos']['gallina']}, bocadillo {st['bub']}, levantada {st['lift']}")
        if "selection" not in st["hap"]:
            probs.append(f"al levantarla no vibra: {st['hap']}")
        # mantener, mover y soltar
        W = page.evaluate("() => document.querySelector('#app .fm-layer').getBoundingClientRect().width")
        page.mouse.move(x, y)
        page.mouse.down()
        page.wait_for_timeout(650)
        for i in range(1, 11):
            page.mouse.move(x + 8 * i, y - 3 * i)
            page.wait_for_timeout(16)
        page.mouse.up()
        page.wait_for_timeout(400)
        p3 = page.evaluate(_FARM)["pos"]["gallina"]
        want_x = f0["pos"]["gallina"]["x"] + 80 / W * 100
        if abs(p3["x"] - want_x) > 1.5 or p3["y"] >= f0["pos"]["gallina"]["y"]:
            probs.append(f"mover la gallina: {f0['pos']['gallina']} → {p3} (x esperado ≈ {want_x:.1f})")
        others = {k: v for k, v in page.evaluate(_FARM)["pos"].items() if k != "gallina"}
        if others != {k: v for k, v in f0["pos"].items() if k != "gallina"}:
            probs.append("mover la gallina movió otras cosas")
        C.reload(page)
        page.wait_for_selector(_it("gallina"), timeout=9000)
        left = page.evaluate("() => parseFloat(document.querySelector('#app .fm-it[data-fid=gallina]').style.left)")
        if page.evaluate(_FARM)["pos"]["gallina"] != p3 or abs(left - p3["x"]) > .2:
            probs.append(f"tras recargar la gallina no está donde se dejó: {page.evaluate(_FARM)['pos']['gallina']} / left {left} (guardado {p3})")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la primera vez
def test_first_time_no_welcome_or_help_coach_hand():
    """Primera vez (sin granja): ningún diálogo de bienvenida ni botón de ayuda; llega el regalo (gallina, flor, grano),
    se abre la bandeja y una mano enseña a arrastrar el grano hasta la gallina (3 vueltas; quieta con «Reducir
    movimiento»); wpend se borra. Con comida de regalo (cnew), lo mismo y el aviso «¡Comida de regalo!»."""
    probs = []
    for rm in ("no-preference", "reduce"):
        page = _page("phone", reduced_motion=rm)
        try:
            C.goto(page, "")
            page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
            page.evaluate(_HOOKS)
            C.goto(page, "#/granja", reload=True)
            page.wait_for_selector("#app .fm-coach .fm-chh", timeout=9000)
            c = page.evaluate("""() => { const c = document.querySelector('#app .fm-coach'), a = c.getAnimations();
              return {text: c.textContent.trim(), still: c.classList.contains('still'), it: a.map(x => x.effect.getComputedTiming().iterations),
                tray: !document.querySelector('#app .fm-tray').hidden, chip: !!document.querySelector('#app .fm-tray [data-pfood=grano]'),
                dlg: document.querySelectorAll('dialog[open]').length, help: [...document.querySelectorAll('#app button')].filter(b => /ayuda|cómo se juega/i.test(b.textContent)).length,
                welcome: /bienvenid/i.test(document.body.innerText)}; }""")
            if c["text"] != "Arrástralo hasta la gallina" or not c["tray"] or not c["chip"] or c["dlg"] or c["help"] or c["welcome"]:
                probs.append(f"{rm}: primera vez: {c}")
            if rm == "reduce" and (not c["still"] or c["it"]):
                probs.append(f"{rm}: la mano se mueve con «Reducir movimiento»: {c}")
            if rm != "reduce" and c["it"] != [3]:
                probs.append(f"{rm}: la mano no da 3 vueltas: {c['it']}")
            g, f = page.evaluate(_GAME), page.evaluate(_FARM)
            if not (g["owned"].get("gallina") and g["owned"].get("flor")) or f["pan"].get("grano") != 2 or "wpend" in f:
                probs.append(f"{rm}: regalo o wpend: owned {g['owned']}, pan {f['pan']}, wpend {f.get('wpend')}")
            # tocar en cualquier sitio quita la mano
            page.mouse.click(30, 300)
            page.wait_for_timeout(200)
            if page.locator("#app .fm-coach").count():
                probs.append(f"{rm}: la mano no se va al tocar")
            probs += [f"{rm}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    page = _page("phone")
    try:
        _open(page, _keys(farm={"cnew": {"heno": 2}}))
        page.wait_for_selector("#app .fm-coach .fm-chh", timeout=9000)
        t = page.evaluate("() => ({coach: document.querySelector('#app .fm-coach').textContent.trim(), toasts: document.getElementById('m-toasts') ? document.getElementById('m-toasts').textContent : ''})")
        if "hasta" not in t["coach"] or "Comida de regalo" not in t["toasts"]:
            probs.append(f"comida de regalo: {t}")
        if "cnew" in page.evaluate(_FARM):
            probs.append("cnew no se borra")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- «¿Cómo me llamo?»
def _to_quiz(page):
    _tap(page, '#app .fm-dock [data-fm="food"]')
    page.wait_for_selector('#app .fm-tray [data-pfood="zanahoria"]', timeout=3000)
    page.wait_for_timeout(300)   # (la bandeja termina de aparecer)
    _tap(page, '#app .fm-tray [data-pfood="zanahoria"]')
    page.wait_for_timeout(150)
    _tap(page, _it("conejo"))
    page.wait_for_selector('#app .fm-pop[data-kind="quiz"]:not([hidden])', timeout=9000)
    page.wait_for_timeout(250)


_QUIZ = """() => { const p = document.querySelector('#app .fm-pop'), m = p.querySelector('[data-mic]');
  return {mic: m ? {shown: !m.hidden, text: m.textContent.trim(), dis: m.disabled} : null, msg: (p.querySelector('.fm-qm') || {}).textContent || '',
    msgCls: (p.querySelector('.fm-qm') || {}).className || '', bad: p.querySelectorAll('.fm-opt.bad').length, ok: p.querySelectorAll('.fm-opt.ok').length,
    dis: [...p.querySelectorAll('.fm-opt')].filter(b => b.disabled).length, opts: [...p.querySelectorAll('.fm-opt')].map(b => b.textContent.trim()),
    title: (p.querySelector('.fm-qt') || {}).textContent}; }"""
_SRS = "() => JSON.parse(localStorage.getItem('srs:english'))"


def test_name_quiz_say_it_grades_srs_and_never_counts_a_miss():
    """Tras comer, «¿Cómo me llamo?» con 3 opciones y «Dilo» (hay reconocedor). Con uno que no entiende: «No te he oído
    bien. Toca la respuesta.», nada en gris, el repaso igual (nunca es un fallo) y se puede seguir; con uno que acierta:
    «¡Muy bien!» y la palabra (animales|Conejo, que no estaba) entra en el repaso como con srsGrade(…, 2) de una lección.
    Sin reconocedor no hay «Dilo» y se toca; tocar la mala: gris con ✗, la buena en verde con ✓, sin temblor ni sonido
    triste y sin tocar el repaso."""
    probs = []
    key = "animales|Conejo"
    page = _page("phone", sr=_FAKE_SR, reduced_motion="reduce")
    try:
        _open(page, _keys(drop_srs=[key]))
        today = page.evaluate("() => today()")
        srs0 = page.evaluate(_SRS)
        _to_quiz(page)
        q = page.evaluate(_QUIZ)
        if q["title"] != "¿Cómo me llamo?" or not q["mic"] or not q["mic"]["shown"] or q["mic"]["text"] != "Dilo" or len(q["opts"]) != 3 or "rabbit" not in q["opts"]:
            probs.append(f"el globo del nombre: {q}")
        page.evaluate("() => { window.__srMode = 'wrong'; }")
        page.locator("#app .fm-pop [data-mic]").click()
        page.wait_for_function("() => /No te he oído bien/.test(document.querySelector('#app .fm-pop .fm-qm').textContent)", timeout=4000)
        q = page.evaluate(_QUIZ)
        if q["bad"] or q["dis"] or q["msg"] != "No te he oído bien. Toca la respuesta." or page.evaluate(_SRS) != srs0:
            probs.append(f"reconocedor que no entiende: {q}, repaso cambiado {page.evaluate(_SRS) != srs0}")
        if page.evaluate("() => window.__srLang") != "en-GB":
            probs.append(f"el reconocedor no escucha en inglés: {page.evaluate('() => window.__srLang')}")
        page.evaluate("() => { window.__srMode = 'silent'; }")
        page.locator("#app .fm-pop [data-mic]").click()
        page.wait_for_function("() => window.__srStarts === 2 && !document.querySelector('#app .fm-pop [data-mic]').classList.contains('on')", timeout=4000)
        if page.evaluate(_QUIZ)["bad"] or page.evaluate(_SRS) != srs0:
            probs.append("sin oír nada cuenta como fallo")
        page.evaluate("() => { window.__srMode = 'right'; }")
        page.locator("#app .fm-pop [data-mic]").click()
        page.wait_for_function("() => document.querySelector('#app .fm-pop .fm-qm.ok')", timeout=4000)
        q = page.evaluate(_QUIZ)
        srs1 = page.evaluate(_SRS)
        want = {"d": "animales", "e": "Conejo", "b": 1, "due": today + 1, "n": 1}
        if srs1.get(key) != want:
            probs.append(f"acertar con «Dilo»: {key} = {srs1.get(key)} (se esperaba {want})")
        if {k: v for k, v in srs1.items() if k != key} != srs0:
            probs.append("acertar cambió otras palabras del repaso")
        if "Muy bien" not in q["msg"] or q["ok"] != 1 or q["bad"]:
            probs.append(f"tras acertar: {q}")
        probs += C.errors(page)
    finally:
        page.context.close()
    # sin reconocedor: no hay «Dilo»; tocar la mala
    page = _page("phone", sr=_NO_SR, reduced_motion="reduce")
    try:
        _open(page, _keys(drop_srs=[key]))
        srs0 = page.evaluate(_SRS)
        _to_quiz(page)
        q = page.evaluate(_QUIZ)
        if q["mic"] is not None:
            probs.append(f"sin reconocedor sale «Dilo»: {q['mic']}")
        wrong = page.evaluate("() => [...document.querySelectorAll('#app .fm-opt')].find(b => b.dataset.fo !== 'conejo').dataset.fo")
        _tap(page, f'#app .fm-opt[data-fo="{wrong}"]')
        page.wait_for_timeout(300)
        q = page.evaluate(_QUIZ)
        look = page.evaluate("""f => { const b = document.querySelector(`#app .fm-opt[data-fo="${f}"]`), cs = getComputedStyle(b);
          return {bg: cs.backgroundColor, col: cs.color, x: !!b.querySelector('.fm-mk svg'), anim: b.getAnimations().length}; }""", wrong)
        if q["bad"] != 1 or q["ok"] != 1 or "Me llamo" not in q["msg"] or not look["x"] or look["anim"]:
            probs.append(f"tocar la mala: {q} {look}")
        nums = [int(n) for n in re.findall(r"\d+", look["bg"])[:3]]
        if len(nums) == 3 and (max(nums) - min(nums) > 24):
            probs.append(f"la mala no es gris: {look['bg']}")
        if page.evaluate(_SRS) != srs0:
            probs.append("tocar la mala cambió el repaso")
        if page.evaluate("() => __sfx.includes('bad') || __nope > 0"):
            probs.append("suena 'bad' o tiembla algo")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la granja te habla
def test_hungry_animal_speaks_the_language():
    """El animal con más hambre lleva el globo con la frase del idioma y «¡Tengo hambre!» en gris, y al entrar (sin nada
    sonando) la dice con la voz del idioma, una vez; tocar otro con hambre la dice una vez más (una por animal y visita).
    En inglés «I'm hungry!» (en-GB), en francés «J'ai faim !» (fr-FR) y en danés «Jeg er sulten!» (da-DK)."""
    probs = []
    for lang, text, code in (("english", "I'm hungry!", "en-GB"), ("français", "J'ai faim !", "fr-FR"), ("dansk", "Jeg er sulten!", "da-DK")):
        page = _page("phone", reduced_motion="reduce")
        try:
            _open(page, _keys(lang=lang))
            page.wait_for_function("t => __spoken.some(s => s.text === t)", arg=text, timeout=8000)
            page.wait_for_timeout(300)
            sp = page.evaluate("() => __spoken")
            said = [s for s in sp if s["text"] == text]
            if said != [{"text": text, "lang": code}]:
                probs.append(f"{lang}: al entrar: {sp}")
            ask = page.evaluate("""() => { const a = document.querySelector('#app .fm-it.lead .fm-ask'); if (!a) return null;
              const b = a.querySelector('b'), s = a.querySelector('small');
              return {fid: a.closest('.fm-it').dataset.fid, b: b && b.textContent, lang: b && b.getAttribute('lang'), es: s && s.textContent, col: s && getComputedStyle(s).color,
                n: document.querySelectorAll('#app .fm-ask').length, food: a.querySelector('.fm-ae').textContent}; }""")
            if not ask or ask["fid"] != "conejo" or ask["b"] != text or ask["lang"] != code or ask["es"] != "¡Tengo hambre!" or ask["n"] != 2 or ask["food"] != "🥕":
                probs.append(f"{lang}: el globo del hambre: {ask}")
            # tocar el conejo (ya habló): no lo repite; la vaca (con hambre) sí, una vez
            _tap(page, _it("conejo"))
            page.wait_for_timeout(300)
            page.keyboard.press("Escape")
            page.wait_for_timeout(200)
            _tap(page, _it("vaca"))
            page.wait_for_timeout(300)
            page.keyboard.press("Escape")
            page.wait_for_timeout(200)
            _tap(page, _it("vaca"))
            page.wait_for_timeout(300)
            n = page.evaluate("t => __spoken.filter(s => s.text === t).length", text)
            if n != 2:
                probs.append(f"{lang}: la frase suena {n} veces (se esperaban 2: al entrar y la vaca)")
            if any(s["lang"] != code for s in page.evaluate("() => __spoken")):
                probs.append(f"{lang}: algo suena con otra voz: {page.evaluate('() => __spoken')}")
            probs += [f"{lang}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    # si ya suena algo al entrar, la granja se calla
    page = _page("phone", reduced_motion="reduce")
    try:
        C.seed(page)
        page.evaluate("() => { Object.defineProperty(speechSynthesis, 'speaking', {configurable: true, get: () => true}); }")
        C.goto(page, "#/granja")
        page.wait_for_timeout(1500)
        if any(s["text"] == "I'm hungry!" for s in page.evaluate("() => __spoken")):
            probs.append("habla al entrar aunque ya suena algo")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- cómo se ve
def test_looks_contrast_palette_and_captures():
    """Móvil y escritorio, claro y oscuro: los textos de la escena, del dock, de la bandeja, del globo de comer y de la
    hoja de la tienda pasan el contraste y la paleta; sin desenfoque en la granja. Capturas F4b-granja-*."""
    probs = []
    for kind in ("phone", "desk"):
        for scheme in ("light", "dark"):
            page = _page(kind, color_scheme=scheme, reduced_motion="reduce")
            tag = f"{kind}-{scheme}"
            try:
                _open(page)
                page.wait_for_timeout(1200)
                page.evaluate(_FINISH)
                a = page.evaluate(_AUDIT, {"what": ["contrast", "palette", "backdrop"]})
                probs += [f"{tag} escena: {x}" for x in a["contrast"] + a["palette"] + a["backdrop"]]
                C.shot(page, f"F4b-granja-{tag}", _OUT, full_page=False)
                _tap(page, '#app .fm-dock [data-fm="food"]')
                page.wait_for_timeout(400)
                page.evaluate(_FINISH)
                a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
                probs += [f"{tag} bandeja: {x}" for x in a["contrast"] + a["palette"]]
                if kind == "phone" and scheme == "light":
                    C.shot(page, f"F4b-granja-bandeja-{tag}", _OUT, full_page=False)
                _tap(page, '#app .fm-dock [data-fm="food"]')
                page.wait_for_timeout(200)
                _tap(page, _it("vaca"))
                page.wait_for_selector('#app .fm-pop[data-kind="feed"]:not([hidden])', timeout=3000)
                page.wait_for_timeout(300)
                page.evaluate(_FINISH)
                a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
                probs += [f"{tag} globo: {x}" for x in a["contrast"] + a["palette"]]
                if scheme == "light":
                    C.shot(page, f"F4b-granja-globo-{tag}", _OUT, full_page=False)
                page.keyboard.press("Escape")
                page.wait_for_timeout(200)
                page.evaluate("() => vocabFarm.openShop()")
                page.wait_for_selector("#fm-shop[open] .sc[data-id]", timeout=4000)
                page.wait_for_timeout(500)
                page.evaluate(_FINISH)
                bad = page.evaluate("""() => { const out = [];
                  for (const b of document.querySelectorAll('#fm-shop button')) { const r = b.getBoundingClientRect();
                    if (r.width && (r.height < 43.5 || r.width < 43.5)) out.push('pequeño: ' + (b.getAttribute('aria-label') || b.textContent.trim()) + ' ' + Math.round(r.width) + '×' + Math.round(r.height));
                    if (b.scrollWidth > b.clientWidth + 1) out.push('cortado: ' + b.textContent.trim()); }
                  const d = document.getElementById('fm-shop'); if (d.scrollWidth > d.clientWidth + 1) out.push('la hoja se sale de lado');
                  return out; }""")
                probs += [f"{tag} hoja: {b}" for b in bad]
                a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
                probs += [f"{tag} hoja: {x}" for x in a["contrast"] + a["palette"]]
                C.shot(page, f"F4b-granja-tienda-{tag}", _OUT, full_page=False)
                probs += [f"{tag}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- partida
def test_export_unchanged():
    """La partida exportada al arrancar es la de la base; entrar en la granja, abrir la bandeja y la hoja y salir sin
    hacer nada solo cambia la hora de la visita (ni claves nuevas)."""
    probs = []
    base = C.load_baseline()
    assert base, "falta tests/e2e/baseline/export.json"
    page = _page("phone")
    try:
        C.seed(page)
        snap = C.export(page)
        d = C.diff_exports(base, snap)
        if d:
            probs.append("al arrancar la partida no es la de la base:\n  " + "\n  ".join(d))
        C.goto(page, "#/granja")
        page.wait_for_timeout(1200)
        _tap(page, '#app .fm-dock [data-fm="food"]')
        page.wait_for_timeout(300)
        page.evaluate("() => vocabFarm.openShop()")
        page.wait_for_selector("#fm-shop[open]", timeout=4000)
        page.wait_for_timeout(300)
        page.evaluate("() => vocabFarm.closeShop()")
        page.wait_for_timeout(300)
        C.goto(page, "")
        after = C.export(page)
        old_f, new_f = json.loads(snap["keys"]["farm:state"]), json.loads(after["keys"]["farm:state"])
        old_f.pop("visit", None)
        new_f.pop("visit", None)
        if old_f != new_f:
            probs.append(f"farm:state cambia más que la visita: {_diff(old_f, new_f)}")
        keys = dict(after["keys"])
        keys["farm:state"] = snap["keys"]["farm:state"]
        d = C.diff_exports(snap, dict(after, keys=keys), allow_new=False)
        if d:
            probs.append("mirar la granja cambia la partida:\n  " + "\n  ".join(d))
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
