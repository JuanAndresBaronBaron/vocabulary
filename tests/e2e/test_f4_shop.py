"""F4-0: la tienda común (js/shop.js, window.vocabShop).

La compra, ponerse y quitarse salen de granja() de index.html a un módulo con una API estable para la hoja de la Granja
(cosas de la granja) y Premios › Mi zorro (personajes, sombreros, gafas, juguetes y mascotas). Se comprueba: comprar
resta el precio una sola vez y emite "buy" una sola vez (también con doble toque); sin monedas no compra, avisa amable
(sin sonido triste ni temblor); ponerse y quitarse alterna; el personaje no se quita; refreshPrices pone al día los
botones cuando cambian las monedas (bus "coins" y paintCoins) sin volver a pintar la granja; siguen los selectores que
usa js/farm.js (patchShop, patchShopShelter) y «Ir al refugio» abre el refugio una vez; bind() en otra pantalla (como
Mi zorro) con onChange y off(); las piezas caben y se leen (contraste) en móvil y escritorio, claro y oscuro; la partida
exportada es la de la base; sw.js y OFF_APP llevan js/shop.js; sin errores de consola."""
from __future__ import annotations

import json
import re

import common as C

_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""
_H = 3600 * 1000

# ganchos: compras del bus, palabras dichas (sin audio de verdad), avisos, sonidos y temblores
_HOOKS = """() => {
  if (window.__shopHooks) return; window.__shopHooks = true;
  window.__buys = []; window.__wears = []; window.__said = []; window.__toasts = []; window.__sfx = []; window.__nope = 0;
  bus.on('buy', d => __buys.push(d && d.item && d.item.id));
  bus.on('wear', d => __wears.push([d.item.id, d.worn]));
  window.say = (t) => { __said.push(t); };
  const t0 = M.toast.bind(M); M.toast = (t, o) => { __toasts.push(String(t)); return t0(t, o); };
  const n0 = M.nope.bind(M); M.nope = (...a) => { __nope++; return n0(...a); };
  if (window.sfx) { const p0 = sfx.play.bind(sfx); sfx.play = n => { __sfx.push(n); return p0(n); }; }
}"""
_GAME = "() => JSON.parse(localStorage.getItem('game'))"
# el sombrero del personaje tal como se pinta (heroHtml de index.html)
_HAT = "() => { const d = document.createElement('div'); d.innerHTML = heroHtml(60); const h = d.querySelector('.h-hat'); return h ? h.textContent : null; }"
_CARD = """id => { const c = document.querySelector(`#app .sc[data-id="${id}"], #tst-cards .sc[data-id="${id}"]`); if (!c) return null;
  const b = c.querySelector('.sx button'), own = c.querySelector('span.own');
  return {st: c.dataset.st, cls: c.className, btn: b ? b.textContent.replace(/\\s+/g, ' ').trim() : null,
    buy: b ? b.dataset.buy || null : null, wear: b ? b.dataset.wear || null : null, shelter: b ? b.dataset.shelter || null : null,
    dis: b ? b.getAttribute('aria-disabled') : null, own: own ? own.textContent.replace(/\\s+/g, ' ').trim() : null,
    sb: !!c.querySelector('[data-sb]')}; }"""


def _keys(coins=None, farm=None, game=None):
    """La partida sembrada con cambios: monedas, campos de "game" o de "farm:state" (dict que se mezcla)."""
    data = C.seed_data()
    if coins is not None:
        data["game"]["coins"] = coins
    if game:
        data["game"].update(game)
    if farm:
        data["farm:state"].update(farm)
    return {k: json.dumps(v, ensure_ascii=False, separators=(",", ":")) for k, v in data.items()}


# F4b: la granja ya no tiene la tienda entera con pestañas. Las cosas de la granja se compran en su hoja (dialog#fm-shop,
# dentro de #app: vocabFarm.openShop()); personajes, sombreros, gafas, juguetes y mascotas están en Premios › Mi zorro
# (F4c, #/mizorro: #mz-seg con un segmento por tipo y #mz-shop con las piezas). _ZORRO (una tienda de prueba con las
# mismas piezas) se queda para las pruebas de bind() en otra pantalla.
_ZORRO = """t => { const old = document.getElementById('tst-z'); if (old) old.remove();
  const h = document.createElement('div'); h.id = 'tst-z'; h.className = 'shop'; h.dataset.tab = t;
  h.innerHTML = vocabShop.items(t).map(x => vocabShop.card(x, {mode: 'zorro'})).join('');
  document.getElementById('app').prepend(h); vocabShop.bind(h); }"""


def _tab(page, tab):
    """Enseña las piezas de un tipo: "farm" en la hoja de la granja; otro tipo, en Premios › Mi zorro (su segmento)."""
    if tab == "farm":
        if C.current_hash(page) != "granja":
            C.goto(page, "#/granja")
            page.evaluate(_HOOKS)
        page.evaluate("() => vocabFarm.openShop()")
        page.wait_for_selector("#fm-shop[open] .shop .sc", timeout=6000)
        # a toda altura: en el móvil se abre a media pantalla y crece al bajar, y así las piezas no se mueven al tocarlas
        page.evaluate("() => { document.getElementById('fm-shop').dataset.detent = 'large'; }")
        page.wait_for_timeout(400)
    else:
        if C.current_hash(page) != "mizorro":
            C.goto(page, "#/mizorro")
            page.evaluate(_HOOKS)
        page.locator(f'#mz-seg .seg-i[data-t="{tab}"]').click()
        page.wait_for_function("t => { const c = [...document.querySelectorAll('#mz-shop .sc')]; return c.length && c.every(x => x.dataset.t === t); }",
                               arg=tab, timeout=4000)
    page.locator("#app .shop").first.scroll_into_view_if_needed()


def _open(page, keys=None, tab="farm"):
    """tab: "farm" (la hoja de la granja abierta), otro tipo (tienda de prueba) o None (solo la granja, sin hoja)."""
    C.seed(page, keys)
    if tab is None:
        C.goto(page, "#/granja")
        page.evaluate(_HOOKS)
        return
    _tab(page, tab)


def _tap(page, sel, times=1, gap=120):
    """Toca el centro del elemento (dedo de verdad, también dos veces seguidas: doble toque)."""
    el = page.locator(sel).first
    # en el centro: así no queda debajo de la barra de pestañas flotante (Mi zorro es una página larga)
    el.evaluate("e => e.scrollIntoView({block: 'center', behavior: 'instant'})")
    page.wait_for_timeout(60)
    b = el.bounding_box()
    x, y = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
    for i in range(times):
        page.mouse.click(x, y)
        if i < times - 1:
            page.wait_for_timeout(gap)


def _card(page, id_):
    return page.evaluate(_CARD, id_)


# ---------------------------------------------------------------- comprar
def test_buy_subtracts_once_and_emits_once():
    """Comprar una cosa de la granja: resta el precio una vez y emite "buy" una vez aunque se toque dos veces; la pieza
    pasa a «En tu granja» sin volver a pintar la página, la escena la enseña, suena la palabra, sale «¡Nuevo! …» y las
    monedas de arriba bajan. Una segunda compra por la API devuelve {ok:false, reason:'owned'} y no resta."""
    page = C.new_page("phone")
    probs = []
    try:
        _open(page)
        page.evaluate("() => { document.querySelector('#app .shop').__keep = 1; document.querySelector('#app .fm-stage').__keep = 1; }")
        c0 = page.evaluate(_GAME)["coins"]
        st = _card(page, "cerdo")
        if not st or st["buy"] != "cerdo" or "Conseguir" not in st["btn"] or "35" not in st["btn"] or st["dis"]:
            probs.append(f"pieza del cerdo antes de comprar: {st}")
        _tap(page, '#app .sc[data-id="cerdo"] [data-buy]', times=2)
        page.wait_for_function("() => document.querySelector('#farm-host [data-fid=cerdo]')", timeout=4000)
        page.wait_for_timeout(300)
        g = page.evaluate(_GAME)
        if g["coins"] != c0 - 35:
            probs.append(f"monedas {c0} → {g['coins']} (se esperaba {c0 - 35})")
        if not g["owned"].get("cerdo"):
            probs.append("el cerdo no es suyo tras comprarlo")
        if "cerdo" in g["wear"].values():
            probs.append(f"una cosa de la granja no se pone: wear = {g['wear']}")
        h = page.evaluate("() => ({buys: __buys, said: __said, toasts: __toasts, keep: !!document.querySelector('#app .shop').__keep && !!document.querySelector('#app .fm-stage').__keep, "
                          "pill: document.getElementById('coins').textContent, me: document.querySelector('#fm-shop [data-fm-coins]').textContent})")
        if h["buys"] != ["cerdo"]:
            probs.append(f"bus 'buy' emitido {h['buys']} (se esperaba una vez)")
        if "pig" not in h["said"]:
            probs.append(f"no suena la palabra: {h['said']}")
        if not any(t.startswith("¡Nuevo!") and "cerdo" in t and "pig" in t for t in h["toasts"]):
            probs.append(f"falta el aviso «¡Nuevo! cerdo = pig»: {h['toasts']}")
        if not h["keep"]:
            probs.append("la página se volvió a pintar al comprar")
        if h["pill"] != str(c0 - 35) or h["me"] != str(c0 - 35):
            probs.append(f"las monedas a la vista no bajan: pastilla {h['pill']}, hoja de la granja {h['me']}")
        st = _card(page, "cerdo")
        if not st or st["st"] != "own" or not st["own"] or "En tu granja" not in st["own"] or st["sb"] or st["buy"]:
            probs.append(f"pieza del cerdo tras comprar: {st}")
        r = page.evaluate("() => vocabShop.buy('cerdo')")
        g2 = page.evaluate(_GAME)
        if r.get("ok") or r.get("reason") != "owned" or g2["coins"] != c0 - 35 or page.evaluate("() => __buys.length") != 1:
            probs.append(f"comprar otra vez: {r}, monedas {g2['coins']}, buys {page.evaluate('() => __buys')}")
        if page.evaluate("() => __sfx.includes('bad') || __nope > 0"):
            probs.append("suena 'bad' o tiembla algo")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_buy_outfit_wears_it_and_double_tap_is_safe():
    """Comprar un sombrero se lo pone (y se quita el que llevaba); un doble toque no lo compra y se lo quita a la vez
    (la pieza no responde 0,6 s). El personaje de arriba y el de la granja llevan el sombrero nuevo."""
    page = C.new_page("phone")
    probs = []
    try:
        _open(page, tab="hat")
        c0 = page.evaluate(_GAME)["coins"]
        _tap(page, '#app .sc[data-id="sombrero"] [data-buy]', times=2, gap=150)
        page.wait_for_timeout(500)
        g = page.evaluate(_GAME)
        if g["coins"] != c0 - 40 or not g["owned"].get("sombrero"):
            probs.append(f"monedas {c0} → {g['coins']}, owned sombrero {g['owned'].get('sombrero')}")
        if g["wear"].get("hat") != "sombrero":
            probs.append(f"tras comprar (doble toque) no lleva el sombrero: wear = {g['wear']}")
        if page.evaluate("() => __buys") != ["sombrero"]:
            probs.append(f"bus 'buy': {page.evaluate('() => __buys')}")
        s, gorra = _card(page, "sombrero"), _card(page, "gorra")
        if not s or s["st"] != "worn" or s["btn"] != "Quitármelo" or "worn" not in s["cls"]:
            probs.append(f"pieza del sombrero: {s}")
        if not gorra or gorra["st"] != "wear" or gorra["btn"] != "Ponérmela" or "worn" in gorra["cls"]:
            probs.append(f"pieza de la gorra (ya no la lleva): {gorra}")
        # (F4b: ya no hay personaje encima de la tienda; se mira heroHtml() y el de la escena de la granja)
        me = page.evaluate(_HAT)
        C.goto(page, "#/granja")
        farm = page.evaluate("() => document.querySelector('#farm-host .fm-hero .h-hat')?.textContent")
        if me != "🎩" or farm != "🎩":
            probs.append(f"el personaje no lleva el sombrero nuevo: {me} / granja {farm}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_no_coins_no_buy():
    """Sin monedas: la cápsula es gris («Te faltan N», aria-disabled) con «Cuesta N» encima; al tocarla no compra,
    sale un aviso amable con lo que falta, sin sonido 'bad' ni temblor; la API dice {ok:false, reason:'coins', need}."""
    page = C.new_page("phone")
    probs = []
    try:
        _open(page, _keys(coins=10))
        st = _card(page, "castillo")
        if not st or st["st"] != "short:490" or st["dis"] != "true" or st["buy"] != "castillo" or "Te faltan" not in st["btn"] or "490" not in st["btn"]:
            probs.append(f"pieza del castillo sin monedas: {st}")
        cost = page.evaluate("() => document.querySelector('#app .sc[data-id=castillo] .shp-cost')?.textContent.replace(/\\s+/g, ' ').trim()")
        if cost != "Cuesta 500":
            probs.append(f"no se ve el precio: {cost!r}")
        g0 = page.evaluate(_GAME)
        _tap(page, '#app .sc[data-id="castillo"] [data-buy]')
        page.wait_for_timeout(400)
        g = page.evaluate(_GAME)
        if g != g0:
            probs.append(f"la partida cambió sin monedas: {g0} → {g}")
        h = page.evaluate("() => ({buys: __buys, toasts: __toasts, sfx: __sfx, nope: __nope, shown: document.getElementById('m-toasts')?.textContent || ''})")
        if h["buys"]:
            probs.append(f"emitió 'buy' sin monedas: {h['buys']}")
        if not any("Te faltan 490 monedas" in t for t in h["toasts"]) or "Te faltan 490" not in h["shown"]:
            probs.append(f"falta el aviso amable: {h['toasts']} / {h['shown']!r}")
        if "bad" in h["sfx"] or h["nope"]:
            probs.append(f"sonido triste o temblor: {h}")
        r = page.evaluate("() => vocabShop.buy('castillo')")
        if r.get("ok") or r.get("reason") != "coins" or r.get("need") != 490:
            probs.append(f"API sin monedas: {r}")
        if page.evaluate(_GAME) != g0:
            probs.append("la API compró sin monedas")
        r1 = page.evaluate("() => vocabShop.buy('flor')")    # ya es suya
        r2 = page.evaluate("() => vocabShop.buy('nada-de-esto')")
        if r1.get("reason") != "owned" or r2.get("reason") != "unknown":
            probs.append(f"API: ya suya {r1}, desconocida {r2}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- ponerse
def test_wear_toggles():
    """«Quitármela» quita la gorra (wear.hat = null, el personaje sin sombrero) y «Ponérmela» la vuelve a poner; un doble
    toque solo cambia una vez; la API alterna y emite "wear"."""
    page = C.new_page("phone")
    probs = []
    try:
        _open(page, tab="hat")
        st = _card(page, "gorra")
        if not st or st["st"] != "worn" or st["wear"] != "gorra" or st["btn"] != "Quitármela":
            probs.append(f"gorra puesta al empezar: {st}")
        _tap(page, '#app .sc[data-id="gorra"] [data-wear]', times=2, gap=150)
        page.wait_for_timeout(350)
        g = page.evaluate(_GAME)
        if g["wear"].get("hat") is not None:
            probs.append(f"tras «Quitármela» (doble toque) wear.hat = {g['wear'].get('hat')!r}")
        st = _card(page, "gorra")
        if not st or st["st"] != "wear" or st["btn"] != "Ponérmela" or "worn" in st["cls"]:
            probs.append(f"gorra quitada: {st}")
        if page.evaluate(_HAT):
            probs.append("el personaje sigue con sombrero")
        page.wait_for_timeout(700)
        _tap(page, '#app .sc[data-id="gorra"] [data-wear]')
        page.wait_for_timeout(350)
        if page.evaluate(_GAME)["wear"].get("hat") != "gorra":
            probs.append(f"«Ponérmela» no la pone: {page.evaluate(_GAME)['wear']}")
        if page.evaluate(_HAT) != "🧢":
            probs.append("el personaje no lleva la gorra otra vez")
        r1 = page.evaluate("() => vocabShop.wear('gorra')")
        r2 = page.evaluate("() => vocabShop.wear('gorra')")
        if not (r1.get("ok") and r1.get("worn") is False and r2.get("ok") and r2.get("worn") is True):
            probs.append(f"API alterna: {r1} {r2}")
        w = page.evaluate("() => __wears")
        if w != [["gorra", False], ["gorra", True], ["gorra", False], ["gorra", True]]:
            probs.append(f"bus 'wear': {w}")
        if page.evaluate("() => vocabShop.worn('hat')") != "gorra":
            probs.append("worn('hat') no es la gorra")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_hero_cannot_be_removed():
    """El personaje puesto dice «Eres tú» y no tiene botón; wear() sobre él lo deja puesto. Comprar el oso lo elige;
    entonces el zorro dice «Elegir» y al tocarlo vuelve a ser el zorro. wear() de una cosa de la granja o de algo que no
    es suyo no hace nada."""
    page = C.new_page("phone")
    probs = []
    try:
        _open(page, tab="hero")
        st = _card(page, "zorro")
        if not st or st["st"] != "you" or st["btn"] is not None or "Eres tú" not in (st["own"] or ""):
            probs.append(f"zorro puesto: {st}")
        r = page.evaluate("() => vocabShop.wear('zorro')")
        if not r.get("ok") or not r.get("worn") or page.evaluate(_GAME)["wear"].get("hero") != "zorro":
            probs.append(f"wear('zorro') lo quitó: {r} {page.evaluate(_GAME)['wear']}")
        _tap(page, '#app .sc[data-id="oso"] [data-buy]')
        page.wait_for_timeout(400)
        if page.evaluate(_GAME)["wear"].get("hero") != "oso":
            probs.append(f"el oso comprado no es el personaje: {page.evaluate(_GAME)['wear']}")
        z, ra = _card(page, "zorro"), _card(page, "oso")
        if not z or z["st"] != "pick" or z["btn"] != "Elegir" or z["wear"] != "zorro":
            probs.append(f"zorro sin elegir: {z}")
        if not ra or ra["st"] != "you" or "Eres tú" not in (ra["own"] or ""):
            probs.append(f"oso elegido: {ra}")
        page.wait_for_timeout(700)
        _tap(page, '#app .sc[data-id="zorro"] [data-wear]')
        page.wait_for_timeout(400)
        if page.evaluate(_GAME)["wear"].get("hero") != "zorro" or page.evaluate("() => vocabShop.worn('hero')") != "zorro":
            probs.append(f"«Elegir» no vuelve al zorro: {page.evaluate(_GAME)['wear']}")
        page.evaluate("() => vocabShop.wear('zorro')")
        if page.evaluate(_GAME)["wear"].get("hero") != "zorro":
            probs.append("el personaje se quitó")
        rf = page.evaluate("() => vocabShop.wear('gallina')")
        rn = page.evaluate("() => vocabShop.wear('dragon')")
        if rf.get("reason") != "farm" or rn.get("reason") != "not-owned":
            probs.append(f"wear de granja {rf} / no suyo {rn}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- precios
def test_refresh_prices_updates_buttons():
    """Cuando cambian las monedas, las cápsulas se ponen al día sin repintar la granja: award() (paintCoins), un gasto
    que solo emite bus "coins" (como la comida de la granja) y refreshPrices() llamado a mano."""
    page = C.new_page("phone")
    probs = []
    try:
        _open(page)
        page.evaluate("() => { document.querySelector('#farm-host .fm-stage').__keep = 1; }")
        if (_card(page, "castillo") or {}).get("st") != "short:255" or (_card(page, "cerdo") or {}).get("st") != "buy":
            probs.append(f"al empezar: castillo {_card(page, 'castillo')}, cerdo {_card(page, 'cerdo')}")
        page.evaluate("() => award(300, '', true)")
        page.wait_for_timeout(100)
        st = _card(page, "castillo")
        if not st or st["st"] != "buy" or st["dis"] or "Conseguir" not in st["btn"] or "500" not in st["btn"]:
            probs.append(f"tras ganar 300 el castillo sigue sin llegar: {st}")
        # gasto fuera de la tienda: solo se escribe la partida y se emite "coins" (nada de paintCoins)
        page.evaluate("() => { const g = JSON.parse(localStorage.getItem('game')); g.coins = 20; localStorage.setItem('game', JSON.stringify(g)); bus.emit('coins', {n: -525, quiet: true}); }")
        st, fl = _card(page, "cerdo"), _card(page, "abeja")
        if not st or st["st"] != "short:15" or st["dis"] != "true" or "15" not in st["btn"]:
            probs.append(f"con 20 monedas el cerdo (35) debería faltar 15: {st}")
        if not fl or fl["st"] != "buy":
            probs.append(f"con 20 monedas la abeja (15) llega: {fl}")
        page.evaluate("() => { const g = JSON.parse(localStorage.getItem('game')); g.coins = 40; localStorage.setItem('game', JSON.stringify(g)); }")
        n = page.evaluate("() => vocabShop.refreshPrices()")
        if (_card(page, "cerdo") or {}).get("st") != "buy" or not n:
            probs.append(f"refreshPrices() a mano: {n} piezas, cerdo {_card(page, 'cerdo')}")
        if page.evaluate("() => vocabShop.refreshPrices()") != 0:
            probs.append("refreshPrices() repinta piezas que no cambiaron")
        if not page.evaluate("() => !!document.querySelector('#farm-host .fm-stage').__keep"):
            probs.append("la granja se volvió a montar al cambiar las monedas")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- farm.js
def test_farm_selectors_and_shelter():
    """Los selectores que usa js/farm.js siguen: .shop .sc[data-id] con .se y .sn, [data-sb], span.own, [data-buy],
    [data-wear] y, con un animal en el refugio, [data-shelter] con span.own.shl. «Ir al refugio» abre el refugio una
    vez; al rescatarlo, la pieza vuelve a «En tu granja» (patchShopShelter → vocabShop.sync)."""
    T = C._ms(C.FIXED_NOW)
    keys = _keys(farm={"fed": {"gallina": T - 3 * _H, "pato": T - 10 * _H, "conejo": T - 130 * _H, "vaca": T - 30 * _H},
                       "shelter": {"conejo": {"t": T - 10 * _H, "seen": True}}})
    page = C.new_page("phone")
    probs = []
    try:
        _open(page, keys)
        s = page.evaluate("""() => { const q = s => document.querySelectorAll(s).length;
          return {sc: q('.shop .sc[data-id]'), se: q('.shop .sc[data-id] > .se'), sn: q('.shop .sc[data-id] > .sn'), sb: q('.shop .sc [data-sb]'),
            buy: q('.shop .sc [data-sb] [data-buy]'), own: q('.shop .sc span.own'), shelter: q('.shop .sc[data-id=conejo] [data-shelter=conejo]'),
            shl: q('.shop .sc.shel[data-id=conejo] span.own.shl'), farm: SHOP.filter(x => x.t === 'farm').length}; }""")
        if s["sc"] != s["farm"] or s["se"] != s["sc"] or s["sn"] != s["sc"] or not s["sb"] or s["buy"] != s["sb"] or not s["own"] or s["shelter"] != 1 or s["shl"] != 1:
            probs.append(f"selectores de la tienda (granja): {s}")
        if "data-wear=" not in page.evaluate("() => vocabShop.card('balon', {mode: 'zorro'})"):
            probs.append("no hay [data-wear] en Juguetes")
        _tap(page, '#app .sc[data-id="conejo"] [data-shelter]')
        page.wait_for_selector("dialog.fm-shd[open]", timeout=4000)
        page.wait_for_timeout(300)
        if page.evaluate("() => document.querySelectorAll('dialog[open]').length") != 1:
            probs.append("«Ir al refugio» abre más de un diálogo")
        page.locator("dialog.fm-shd [data-rescue=conejo]").click()
        page.wait_for_timeout(500)
        st = _card(page, "conejo")
        if not st or st["st"] != "own" or "shel" in st["cls"] or "En tu granja" not in (st["own"] or "") or st["shelter"]:
            probs.append(f"tras rescatarlo, la pieza del conejo: {st}")
        page.locator("dialog.fm-shd [data-x]").click()
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_shelter_from_a_sheet_and_from_elsewhere():
    """En una hoja (como la de la Granja), «Ir al refugio» cierra la hoja y abre el refugio; desde otra pantalla,
    vocabShop.goShelter() va a la granja y lo abre."""
    T = C._ms(C.FIXED_NOW)
    keys = _keys(farm={"fed": {"gallina": T - 3 * _H, "pato": T - 10 * _H, "conejo": T - 130 * _H, "vaca": T - 30 * _H},
                       "shelter": {"conejo": {"t": T - 10 * _H, "seen": True}}})
    page = C.new_page("phone")
    probs = []
    try:
        _open(page, keys, tab=None)
        page.evaluate("""() => { const d = document.createElement('dialog'); d.id = 'tst-sheet';
          d.innerHTML = '<div class="shop">' + vocabShop.items('farm').map(x => vocabShop.card(x, {mode: 'farm'})).join('') + '</div>';
          document.body.appendChild(d); window.__chg = []; vocabShop.bind(d.querySelector('.shop'), {onChange: e => __chg.push(e.type)}); M.openSheet(d); }""")
        page.wait_for_timeout(500)
        page.locator("#tst-sheet .sc[data-id=conejo] [data-shelter]").click()
        page.wait_for_selector("dialog.fm-shd[open]", timeout=4000)
        st = page.evaluate("() => ({sheet: document.getElementById('tst-sheet').open, chg: __chg, n: document.querySelectorAll('dialog[open]').length})")
        if st["sheet"] or st["chg"] != ["shelter"] or st["n"] != 1:
            probs.append(f"desde una hoja: {st}")
        page.locator("dialog.fm-shd [data-x]").click()
        page.wait_for_timeout(300)
        C.goto(page, "#/progreso")
        page.evaluate("() => vocabShop.goShelter()")
        page.wait_for_selector("dialog.fm-shd[open]", timeout=6000)
        if C.current_hash(page) != "granja":
            probs.append(f"goShelter() no fue a la granja: #/{C.current_hash(page)}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_welcome_gift_updates_cards():
    """Primer día: al abrir la granja llega el regalo de bienvenida (gallina y flor); sus piezas ya pintadas pasan a «En
    tu granja» sin volver a pintar la página (farm.js patchShop → vocabShop.sync) y el resto sigue a la venta."""
    page = C.new_page("phone")
    probs = []
    try:
        C.goto(page, "")
        page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
        C.goto(page, "", reload=True)
        # (F4b: la granja ya no pinta piezas en la página; estas se pintan antes de entrar, fuera de #app)
        page.evaluate("""() => { const h = document.createElement('div'); h.id = 'tst-cards'; h.className = 'shop';
          h.innerHTML = vocabShop.items('farm').map(x => vocabShop.card(x, {mode: 'farm'})).join(''); document.body.appendChild(h); }""")
        if (_card(page, "gallina") or {}).get("st") == "own":
            probs.append("la gallina ya era suya antes del regalo")
        C.goto(page, "#/granja")
        page.wait_for_timeout(400)
        g, gal, flo, pat = page.evaluate(_GAME), _card(page, "gallina"), _card(page, "flor"), _card(page, "pato")
        if not (g and g["owned"].get("gallina") and g["owned"].get("flor")):
            probs.append(f"no llegó el regalo de bienvenida: {g}")
        for nm, st in (("gallina", gal), ("flor", flo)):
            if not st or st["st"] != "own" or "En tu granja" not in (st["own"] or "") or st["sb"]:
                probs.append(f"pieza de {nm} tras el regalo: {st}")
        if not pat or not pat["st"].startswith("short") or not pat["sb"]:
            probs.append(f"el pato (sin monedas) sigue a la venta: {pat}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- API
def test_api_items_state_and_cards():
    """items(filter), byId, word, owned, worn, coins, state y card() para cada estado; images() existen (200)."""
    page = C.new_page("desk")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/granja")
        r = page.evaluate("""async () => { const S = vocabShop, all = await S.ready(), cnt = f => S.items(f).length;
          const st = {}; for (const id of ['cerdo', 'castillo', 'gallina', 'gorra', 'balon', 'sombrero', 'zorro', 'rana', 'oso']) st[id] = S.state(id);
          const html = {}; for (const id of ['cerdo', 'castillo', 'gallina', 'gorra', 'balon', 'zorro', 'rana', 'oso', 'gafas']) html[id] = S.card(id);
          return {all: all.length, n: cnt(), farm: cnt('farm'), farmOk: S.items('farm').every(x => x.t === 'farm'), zorro: cnt('zorro'),
            zorroOk: S.items('zorro').every(x => x.t !== 'farm'), hat: cnt('hat'), two: cnt(['hat', 'face']), fn: cnt(x => x.p >= 300),
            copy: S.items() !== SHOP, by: S.byId('vaca') && S.byId('vaca').p, word: S.word('gallina'), owned: [S.owned('zorro'), S.owned('cerdo')],
            worn: [S.worn('hero'), S.worn('hat'), S.worn('face')], coins: S.coins(), st, html, none: S.card('nada'),
            types: S.types.map(t => t.t), imgs: S.images(),
            modes: [S.card('gallina', {mode: 'farm'}).includes('data-mode="farm"'), S.card('gorra').includes('data-mode="zorro"')]}; }""")
        exp = {"all": 64, "n": 64, "farm": 29, "farmOk": True, "zorro": 35, "zorroOk": True, "hat": 6, "two": 9, "fn": 5, "copy": True,
               "by": 60, "word": "hen", "owned": [True, False], "worn": ["zorro", "gorra", None], "coins": 245,
               "types": ["hero", "hat", "face", "hand", "pet", "farm"], "modes": [True, True], "none": ""}
        for k, v in exp.items():
            if r[k] != v:
                probs.append(f"{k}: {r[k]!r} (se esperaba {v!r})")
        exp_st = {"cerdo": "buy", "castillo": "short:255", "gallina": "own", "gorra": "worn", "balon": "wear", "sombrero": "buy",
                  "zorro": "you", "rana": "pick", "oso": "buy"}
        if r["st"] != exp_st:
            probs.append(f"state(): {r['st']}")
        txt = {k: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", v)).strip() for k, v in r["html"].items()}
        want = {"cerdo": ["Conseguir", "· 35", 'data-buy="cerdo"'], "castillo": ["Cuesta 500", "Te faltan 255", 'aria-disabled="true"'],
                "gallina": ["En tu granja", "hen"], "gorra": ["Quitármela", 'data-wear="gorra"'], "balon": ["Ponérmelo"],
                "zorro": ["Eres tú", "fox"], "rana": ["Elegir", 'data-wear="rana"'], "oso": ["Conseguir", "· 60"], "gafas": ["Conseguir"]}
        for k, ws in want.items():
            for w in ws:
                if w not in txt[k] and w not in r["html"][k]:
                    probs.append(f"card('{k}') no tiene {w!r}: {txt[k]}")
        if 'data-say="hen"' not in r["html"]["gallina"] or 'lang="en-GB"' not in r["html"]["gallina"]:
            probs.append("la palabra no lleva su altavoz o su idioma")
        if len(r["imgs"]) != 36:
            probs.append(f"images(): {len(r['imgs'])} (se esperaban 36)")
        bad = page.evaluate("async us => { const out = []; for (const u of us) { const r = await fetch(u); if (r.status !== 200 || !(r.headers.get('content-type') || '').includes('png')) out.push(u + ' ' + r.status); } return out; }", r["imgs"])
        if bad:
            probs.append(f"dibujos que no cargan: {bad}")
        # otra lengua: la palabra cambia
        page.evaluate("() => setLang('français')")
        page.wait_for_timeout(500)
        if page.evaluate("() => vocabShop.word('gallina')") != "la poule":
            probs.append(f"en francés: {page.evaluate('() => vocabShop.word(\"gallina\")')!r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_bind_on_another_screen():
    """bind() en un contenedor cualquiera (como Premios › Mi zorro): ponerse avisa con onChange({type:'wear'}) y
    repinta la pieza; tras off() los toques ya no hacen nada; volver a atar el mismo contenedor no duplica."""
    page = C.new_page("phone")
    probs = []
    try:
        C.seed(page)
        C.goto(page, "#/progreso")
        page.evaluate(_HOOKS)
        page.evaluate("""() => { const h = document.createElement('div'); h.id = 'tst-z'; h.className = 'shop';
          h.innerHTML = vocabShop.items('zorro').map(x => vocabShop.card(x)).join(''); document.getElementById('app').prepend(h);
          window.__chg = []; window.__off = vocabShop.bind(h, {onChange: e => __chg.push([e.type, e.id, e.worn])});
          window.__off = vocabShop.bind(h, {onChange: e => __chg.push([e.type, e.id, e.worn])}); }""")
        page.locator("#tst-z .sc[data-id=balon] [data-wear]").click()
        page.wait_for_timeout(300)
        st = page.evaluate("() => ({chg: __chg, hand: JSON.parse(localStorage.getItem('game')).wear.hand, btn: document.querySelector('#tst-z .sc[data-id=balon] [data-wear]').textContent})")
        if st["chg"] != [["wear", "balon", True]] or st["hand"] != "balon" or st["btn"] != "Quitármelo":
            probs.append(f"ponerse en otra pantalla: {st}")
        page.evaluate("() => __off()")
        page.wait_for_timeout(700)
        page.locator("#tst-z .sc[data-id=balon] [data-wear]").click()
        page.wait_for_timeout(300)
        st = page.evaluate("() => ({chg: __chg.length, hand: JSON.parse(localStorage.getItem('game')).wear.hand})")
        if st["chg"] != 1 or st["hand"] != "balon":
            probs.append(f"tras off() sigue respondiendo: {st}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- cómo se ve
def test_cards_fit_and_read():
    """En móvil y escritorio, claro y oscuro, en cada pestaña de la tienda: las cápsulas no se cortan, los botones y
    altavoces miden 44 px o más, y los textos de las piezas pasan el contraste (también «Te faltan N», que se mide sin
    aria-disabled) y la paleta. Capturas en capturas/F4."""
    probs = []
    out = C.CAPTURAS / "F4"
    for kind in ("phone", "desk"):
        for scheme in ("light", "dark"):
            page = C.new_page(kind, color_scheme=scheme)
            try:
                _open(page, _keys(coins=45))
                for tab in ("farm", "hero", "hat", "face", "hand", "pet"):
                    _tab(page, tab)
                    C.settle(page, quiet_ms=150)
                    bad = page.evaluate("""() => { const out = [];
                      for (const b of document.querySelectorAll('#app .shop .shp-b')) { const r = b.getBoundingClientRect();
                        if (b.scrollWidth > b.clientWidth + 1) out.push('cortada: ' + b.closest('.sc').dataset.id + ' «' + b.textContent.trim() + '»');
                        if (r.height < 43.5) out.push('baja: ' + b.closest('.sc').dataset.id + ' ' + r.height); }
                      for (const s of document.querySelectorAll('#app .shop .shp-spk')) { const r = s.getBoundingClientRect();
                        if (r.width < 43.5 || r.height < 43.5) out.push('altavoz pequeño: ' + s.closest('.sc').dataset.id); }
                      for (const c of document.querySelectorAll('#app .shop .sc')) if (c.scrollWidth > c.clientWidth + 1) out.push('pieza ancha: ' + c.dataset.id);
                      if (document.documentElement.scrollWidth > innerWidth + 1) out.push('la página se sale de lado');
                      return out; }""")
                    probs += [f"{kind}-{scheme}-{tab}: {b}" for b in bad]
                    page.evaluate("() => document.querySelectorAll('#app .shop [aria-disabled]').forEach(b => { b.dataset.wasDis = 1; b.removeAttribute('aria-disabled'); })")
                    page.evaluate(_FINISH)
                    a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
                    page.evaluate("() => document.querySelectorAll('#app .shop [data-was-dis]').forEach(b => { b.setAttribute('aria-disabled', 'true'); delete b.dataset.wasDis; })")
                    probs += [f"{kind}-{scheme}-{tab} contraste: {x}" for x in a["contrast"] if "shop" in x or "sc" in x or "shp" in x]
                    probs += [f"{kind}-{scheme}-{tab} paleta: {x}" for x in a["palette"] if "shop" in x or "shp" in x]
                    if tab in ("farm", "hat"):
                        page.evaluate("() => document.querySelector('#app .shop').scrollIntoView({block: 'start'})")
                        if tab == "hat":
                            page.evaluate("() => scrollBy(0, -70)")
                        page.wait_for_timeout(150)
                        C.shot(page, f"F4-0-tienda-{tab}-{kind}-{scheme}", out, full_page=False)
                probs += C.errors(page)
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- partida, sw.js
def test_export_unchanged_and_sw():
    """La partida exportada al arrancar es la de la base; mirar la tienda (todas las pestañas, refreshPrices, sync) sin
    comprar no cambia "game" ni ninguna otra clave salvo la hora de la visita de la granja. js/shop.js carga detrás del
    script principal, está en SHELL de sw.js y en OFF_APP de index.html."""
    probs = []
    base = C.load_baseline()
    assert base, "falta tests/e2e/baseline/export.json"
    page = C.new_page("phone")
    try:
        C.seed(page)
        snap = C.export(page)
        d = C.diff_exports(base, snap)
        if d:
            probs.append("al arrancar la partida no es la de la base:\n  " + "\n  ".join(d))
        for tab in ("hero", "hat", "face", "hand", "pet", "farm"):
            _tab(page, tab)
            page.wait_for_timeout(200)
        page.evaluate("() => { vocabShop.refreshPrices(); vocabShop.sync(); vocabShop.items('zorro').map(x => vocabShop.card(x)); }")
        C.goto(page, "")
        after = C.export(page)
        old_f, new_f = json.loads(snap["keys"]["farm:state"]), json.loads(after["keys"]["farm:state"])
        old_f.pop("visit", None); new_f.pop("visit", None)
        if old_f != new_f:
            ch = sorted(k for k in set(old_f) | set(new_f) if old_f.get(k) != new_f.get(k))
            probs.append(f"farm:state cambia más que la visita: {ch}")
        keys = dict(after["keys"]); keys["farm:state"] = snap["keys"]["farm:state"]
        d = C.diff_exports(snap, dict(after, keys=keys), allow_new=False)
        if d:
            probs.append("mirar la tienda cambia la partida:\n  " + "\n  ".join(d))
        probs += C.errors(page)
    finally:
        page.context.close()
    html = (C.REPO / "index.html").read_text(encoding="utf-8")
    html = re.sub(r'(<script src="[^"?]+)\?v=\d+"', r'\1"', html)   # desde F4: los scripts llevan ?v=<VERSION> de sw.js
    sw = (C.REPO / "sw.js").read_text(encoding="utf-8")
    tags = re.findall(r'<script src="([^"]+)"></script>', html)
    if "js/shop.js" not in tags:
        probs.append("index.html no carga js/shop.js")
    main_end = html.find("</script>", html.find("async function route("))
    if html.find('<script src="js/shop.js">') < main_end:
        probs.append("js/shop.js carga antes del script principal")
    shell = re.search(r"const SHELL = \[(.*?)\];", sw, re.S)
    off = re.search(r"const OFF_APP = \[(.*?)\];", html, re.S)
    if not shell or "js/shop.js" not in re.findall(r'"([^"]+)"', shell.group(1)):
        probs.append("js/shop.js no está en SHELL de sw.js")
    if not off or "js/shop.js" not in re.findall(r'"([^"]+)"', off.group(1)):
        probs.append("js/shop.js no está en OFF_APP de index.html")
    assert not probs, "\n".join(probs)
