"""El centro de juegos (#/juegos, js/games.js): el menú, el «Reto de hoy», el resultado y los niveles.

Menú: «Reto de hoy» primero, luego «Seguir jugando» (los 3 últimos por "games:best".<juego>.at) y una fila por sección
que se desliza de lado (scroll-snap, la primera tarjeta en el margen de 16 px, sin el subtítulo: va en el vistazo); las
tarjetas que solo llevan a otra pantalla en la última fila; cabe en 2 pantallas a 390×844 y nada se sale de lado a 360
ni a 390; con ratón, rejilla. Con «Soldados» su sección va primero; con otro tema sus juegos salen en oscuro con candado.
«Nuevo» con fresh: "AAAA-MM-DD" los 14 días siguientes (y sin jugar).
Reto de hoy: elegido con la fecha entre los juegos que salen con el tema y no se jugaron los 3 días antes; la tarjeta
no anuncia monedas; solo cuenta desde su tarjeta; ★★ o más da una vez una sorpresa de 10 a 20 monedas, sale ✓ y el
punto del día en la semana (L…D); "games:reto".
Resultado: las falladas primero con ✗ gris, cada palabra con su IPA, a 360 px una columna y ninguna palabra partida;
las falladas van solas al repaso (las que ya están, para hoy; las nuevas, 3 como mucho, con caja 0) con «✓ N palabras
irán a tu repaso» y «Jugar con estas» (Globos con esas palabras). Sin ningún acierto: «¡Vamos otra vez!» sin estrellas,
monedas, récord ni "game-done" (def.played o finish({played: true}) lo saltan).
Niveles 1-3 en los 4 juegos clásicos (Memoria 6/8/10 parejas, Globos 4/6 globos y sin el ojo en el 3, Letras 3-5 /
4-7 / 6-8 letras): ★★★ abre el siguiente («¡Nivel 2!» y «Nivel 2» en la tarjeta), api.level y vocabGames.level.
IPA en Memoria, Lluvia, Globos y Letras (y nada con la IPA apagada). Las teclas (def.keys) solo con teclado; las
explicaciones de los 4 clásicos en 15 palabras como mucho; "games:reto" y "gram:lv" en EXACT de js/save.js.
Capturas en capturas/juegos."""
from __future__ import annotations

import json
import re

import common as C
import test_f4_juegos as J

OUT = C.CAPTURAS / "juegos"
T = int(C.FIXED_NOW.timestamp() * 1000)
H = 3600 * 1000
TODAY = C.day_num(C.FIXED_NOW)
DK = C.day_key(C.FIXED_NOW)
CLASSIC = ["memoria", "lluvia", "globos", "letras"]
SECS = ["palabras", "concursos", "gramatica", "grupo", "soldados", "mas"]
_ART = re.compile(r"^(?:the|an?|to)\s+", re.I)
_GD = "() => { if (window.__gdOn) return; window.__gdOn = true; window.__gd = []; bus.on('game-done', d => __gd.push(d)); }"
_SRS = "() => JSON.parse(localStorage.getItem('srs:english') || '{}')"


def _es_short(es):
    """esShort() de js/games.js (lo que dicen los globos)."""
    s = re.sub(r"\s*\([^)]*\)", "", re.split(r"[/,;]", es)[0]).strip()
    if len(s) > 1 and s[1] == s[1].lower():
        s = s[0].lower() + s[1:]
    return s


_ROWS = [r for r in json.loads((C.ROOT / "data" / "animales.json").read_text(encoding="utf-8"))["rows"]
         if r.get("es") and r.get("img") and ((r.get("l") or {}).get("english") or {}).get("word")]
# palabra → {es (la corta, la del globo), k (la clave del repaso), img}
WORDS = {r["l"]["english"]["word"].strip().lower(): {"es": _es_short(r["es"]), "k": f"animales|{r['es']}", "img": r["img"]} for r in _ROWS}
GATO = next(r for r in _ROWS if r["es"] == "Gato")


def _keys(**best):
    """La partida de ejemplo con "games:best" cambiado ({juego: {campos}}; None lo quita)."""
    k = C.seed_data()
    for g, v in best.items():
        if v is None:
            k["games:best"].pop(g, None)
        else:
            k["games:best"][g] = dict(k["games:best"].get(g) or {}, **v)
    return k


def _open(page, keys=None, hash="#/juegos"):
    J._open(page, keys, kind_hash=hash)
    page.evaluate(_GD)


def _menu(page):
    page.evaluate("() => { location.hash = '#/'; }")
    page.wait_for_function("() => !document.getElementById('gm-cards')", timeout=5000)
    page.evaluate("() => { location.hash = '#/juegos'; }")
    page.wait_for_selector("#gm-cards", timeout=5000)
    page.wait_for_timeout(200)


def _shot_tall(page, name):
    """Captura del menú entero sin el modo de captura de página completa (que cambia la emulación del móvil)."""
    vp = page.viewport_size
    h = page.evaluate("() => document.documentElement.scrollHeight")
    page.set_viewport_size({"width": vp["width"], "height": h})
    page.wait_for_timeout(300)
    C.shot(page, name, OUT, full_page=False)
    page.set_viewport_size(vp)
    page.wait_for_timeout(200)


def _gray(c):
    return J._gray(c)


_MENU = """() => { const r = e => e.getBoundingClientRect(), top = document.getElementById('gm-top');
  const rows = [...document.querySelectorAll('#gm-cards .gm-row')].map(x => { const cs = getComputedStyle(x), a = r(x), c = r(x.querySelector('.gm-card'));
    return {sec: x.closest('.gm-grp').dataset.sec, snap: cs.scrollSnapType, ox: cs.overflowX, disp: cs.display, l: Math.round(a.left), rt: Math.round(a.right),
      c0: Math.round(c.left), over: x.scrollWidth > x.clientWidth + 1, lnk: x.classList.contains('gm-row-l'),
      align: getComputedStyle(x.querySelector('.gm-card')).scrollSnapAlign}; });
  const reto = document.getElementById('gm-reto');
  return {H: document.documentElement.scrollHeight, ih: innerHeight, iw: innerWidth, sw: document.documentElement.scrollWidth,
    top: [...top.children].map(e => e.id), secs: [...document.querySelectorAll('#gm-cards > .gm-grp')].map(g => g.dataset.sec), rows,
    cont: [...document.querySelectorAll('#gm-cont .gm-cg')].map(a => a.dataset.cg),
    contImg: [...document.querySelectorAll('#gm-cont .gm-cg img')].map(i => Math.round(i.getBoundingClientRect().width)),
    reto: reto && {g: reto.dataset.rg, href: reto.getAttribute('href'), t: reto.querySelector('.gm-reto-t').textContent, ok: reto.classList.contains('gm-reto-ok'),
      v: !!reto.querySelector('.gm-reto-v'), aria: reto.getAttribute('aria-label'),
      wk: [...reto.querySelectorAll('.gm-wk > span')].map(s => s.textContent + (s.classList.contains('on') ? '+' : '') + (s.classList.contains('now') ? '*' : ''))},
    subs: [...document.querySelectorAll('#gm-cards .gm-card')].filter(c => /Busca las parejas|Escucha y explota|Ordena las letras/.test(c.textContent)).map(c => c.dataset.g),
    off: [...document.querySelectorAll('#gm-cards .gm-card.gm-off')].map(c => ({g: c.dataset.g, sec: c.closest('.gm-grp').dataset.sec,
      bg: getComputedStyle(c).backgroundColor, lock: c.querySelector('.gm-clk') ? getComputedStyle(c.querySelector('.gm-clk')).display : 'none',
      msg: c.querySelector('.gm-lockb') && getComputedStyle(c.querySelector('.gm-lockb')).display !== 'none' ? c.querySelector('.gm-lockb').textContent : '',
      stars: [...c.querySelectorAll('.gm-cside .gm-st')].some(s => getComputedStyle(s).display !== 'none'), dis: c.getAttribute('aria-disabled')})),
    lv: Object.fromEntries([...document.querySelectorAll('#gm-cards .gm-card .gm-lvb')].map(b => [b.closest('.gm-card').dataset.g, b.textContent])),
    nuevo: [...document.querySelectorAll('#gm-cards .gm-card')].filter(c => c.querySelector('.gm-new')).map(c => c.dataset.g)}; }"""


# ---------------------------------------------------------------- menú
def test_menu_order_rows_and_fit():
    """A 390×844 (con «Seguir jugando»): el reto, «Seguir jugando» (memoria, globos, lluvia: del más reciente) y las
    secciones en su orden con «mas» al final en la fila compacta; cada fila se desliza con scroll-snap (llega a los dos
    bordes y la primera tarjeta queda a 16 px); sin el subtítulo en las tarjetas (sale en el vistazo); el menú cabe en
    2 pantallas y nada se sale de lado (tampoco a 360). Los juegos de soldados en oscuro con candado y su aviso (sin
    estrellas). Con «Soldados», su sección primero y encendida. Con ratón, rejilla sin scroll-snap. «Nuevo» con fresh
    "AAAA-MM-DD": 14 días y sin jugar."""
    probs = []
    keys = _keys(memoria={"at": T - 1 * H}, globos={"at": T - 2 * H}, lluvia={"at": T - 3 * H})
    for w, h in ((390, 844), (360, 740)):
        page = C.new_page("phone", viewport={"width": w, "height": h})
        try:
            _open(page, keys)
            page.wait_for_timeout(400)
            m = page.evaluate(_MENU)
            tag = f"{w}"
            if m["top"] != ["gm-reto", "gm-cont"]:
                probs.append(f"{tag}: arriba {m['top']} (se esperaba el reto y «Seguir jugando»)")
            if m["secs"] != SECS:
                probs.append(f"{tag}: secciones {m['secs']}")
            if m["cont"] != ["memoria", "globos", "lluvia"] or any(x != 40 for x in m["contImg"]):
                probs.append(f"{tag}: «Seguir jugando» {m['cont']} {m['contImg']}")
            if w == 390 and m["H"] > 2 * m["ih"]:
                probs.append(f"{tag}: el menú mide {m['H']} px (más de 2 pantallas de {m['ih']})")
            if m["sw"] > m["iw"]:
                probs.append(f"{tag}: la página se sale de lado ({m['sw']} > {m['iw']})")
            for r in m["rows"]:
                if "x" not in r["snap"] or "mandatory" not in r["snap"] or r["ox"] != "auto" or r["disp"] != "flex" or r["align"] != "start" \
                        or r["l"] > 0 or r["rt"] < m["iw"] - 1 or abs(r["c0"] - 16) > 1:
                    probs.append(f"{tag}: fila {r}")
            if not any(r["over"] for r in m["rows"] if r["sec"] == "palabras"):
                probs.append(f"{tag}: la fila de palabras no se desliza")
            if [r["sec"] for r in m["rows"] if r["lnk"]] != ["mas"]:
                probs.append(f"{tag}: fila compacta {[r['sec'] for r in m['rows'] if r['lnk']]}")
            if m["subs"]:
                probs.append(f"{tag}: el subtítulo sigue en las tarjetas {m['subs']}")
            r = m["reto"]
            if not r or not r["href"].startswith(f"#/juegos/{r['g']}") or [x.rstrip("+*") for x in r["wk"]] != list("LMXJVSD") \
                    or r["wk"][2] != "X*" or r["ok"] or "Reto de hoy" not in r["aria"]:
                probs.append(f"{tag}: reto {r}")
            sold = [o for o in m["off"] if o["sec"] == "soldados"]
            if not sold or any(o["lock"] == "none" or o["bg"] not in ("rgba(0, 0, 0, 0)", "transparent") or not o["msg"] or o["stars"] or o["dis"] != "true"
                               for o in sold):
                probs.append(f"{tag}: soldados apagados {sold}")
            if w == 390:
                C.shot(page, "hub-menu-390", OUT, full_page=False)
                _shot_tall(page, "hub-menu-390-entero")
                page.evaluate("() => vocabGames.peek('memoria', null)")
                page.wait_for_selector("dialog#gm-peek[open]", timeout=3000)
                sub = page.evaluate("() => (document.querySelector('#gm-peek .gm-pk-s') || {}).textContent")
                if sub != "Busca las parejas":
                    probs.append(f"el subtítulo no sale en el vistazo: {sub!r}")
                page.evaluate("() => document.querySelectorAll('dialog[open]').forEach(d => d.close())")
                # «Nuevo» con fecha: 14 días y sin jugar
                page.evaluate("""() => { const b = JSON.parse(localStorage.getItem('games:best')); b['prueba-jugada'] = {score: 1, stars: 1, plays: 1, at: Date.now() - 864e5};
                  localStorage.setItem('games:best', JSON.stringify(b));
                  const st = (app, api) => { app.innerHTML = '<div class="gm"></div>'; };
                  for (const [id, f] of [['prueba-nueva', '2026-03-01'], ['prueba-vieja', '2026-02-20'], ['prueba-jugada', '2026-03-05']])
                    vocabGames.register(id, {t: id, img: 'img/games/globos.png', words: 'Prueba', fresh: f, start: st}); }""")
                _menu(page)
                nv = page.evaluate(_MENU)["nuevo"]
                if "prueba-nueva" not in nv or "prueba-vieja" in nv or "prueba-jugada" in nv:
                    probs.append(f"«Nuevo» con fecha: {[x for x in nv if x.startswith('prueba')]}")
            else:
                C.shot(page, "hub-menu-360", OUT, full_page=False)
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    # «Soldados»: su sección primero y encendida
    page = C.new_page("phone", color_scheme="dark")
    try:
        k = dict(keys)
        k["games:topic"] = json.dumps("militar")   # C.seed deja tal cual los textos (ya en JSON)
        _open(page, k)
        page.wait_for_timeout(400)
        m = page.evaluate(_MENU)
        if m["secs"][0] != "soldados" or any(o["sec"] == "soldados" for o in m["off"]):
            probs.append(f"con «Soldados»: secciones {m['secs']}, apagadas {m['off']}")
        _shot_tall(page, "hub-menu-soldados-oscuro")
        probs += C.errors(page)
    finally:
        page.context.close()
    # con ratón: rejilla, sin deslizar
    for scheme in ("light", "dark"):
        page = C.new_page("desk", color_scheme=scheme)
        try:
            _open(page, keys)
            page.wait_for_timeout(400)
            m = page.evaluate(_MENU)
            if m["secs"] != SECS or any(r["disp"] != "grid" or r["snap"] != "none" for r in m["rows"]) or m["sw"] > m["iw"] or m["top"] != ["gm-reto", "gm-cont"]:
                probs.append(f"escritorio {scheme}: {m['secs']} {[(r['sec'], r['disp'], r['snap']) for r in m['rows']]} {m['sw']}")
            _shot_tall(page, f"hub-menu-escritorio-{scheme}")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- reto de hoy
def _hear_word(page):
    n0 = page.evaluate("() => __said.length")
    page.locator("#gm-hear").click()
    page.wait_for_function("n => __said.length > n", arg=n0, timeout=3000)
    return page.evaluate("() => __said[__said.length - 1]")


def _solve_letras(page):
    """Letras locas a la primera: escribe con el teclado la palabra que dice «Oír» (★★★)."""
    for _ in range(12):
        page.wait_for_function("() => document.getElementById('gm-end') || document.querySelector('#gm-tiles .gm-tile:not(:disabled)')", timeout=6000)
        if page.locator("#gm-end").count():
            return
        base = _ART.sub("", _hear_word(page))
        page.keyboard.type(base, delay=15)
        page.wait_for_selector("#gm-next", timeout=4000)
        page.locator("#gm-next").click()
        page.wait_for_function("() => document.getElementById('gm-end') || !document.getElementById('gm-next')", timeout=5000)
    page.wait_for_selector("#gm-end", timeout=5000)


def _end_info(page):
    page.wait_for_selector("#gm-end", timeout=8000)
    page.wait_for_timeout(500)
    return page.evaluate("""() => ({stars: document.querySelectorAll('.gm-end-st .gm-es.on').length, rok: (document.getElementById('gm-rok') || {}).textContent || '',
      lvup: (document.getElementById('gm-lvup') || {}).textContent || '', plus: (document.getElementById('gm-plus') || {}).textContent || '', aw: __aw.slice()})""")


def test_reto_of_the_day_pays_once_from_its_card():
    """Con todos los demás juegos jugados ayer, el reto de hoy es Letras locas (con su tema en el enlace); la tarjeta no
    anuncia monedas. Jugarlo desde su tarjeta normal no cuenta (+15 de las ★★★, sin el chip del reto, y abre el nivel 2).
    Desde la tarjeta del reto, ★★★ paga 15 y una sorpresa de 10 a 20 una vez («¡Reto conseguido! Sorpresa: +N»,
    «¡Nivel 3!»); al volver la tarjeta lleva ✓, «¡Conseguido!» y el punto de hoy (X) en la semana, "games:reto" lo
    guarda y la tarjeta de Letras dice «Nivel 3». Otra vez desde el reto ya no paga más."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        ids = page.evaluate("() => vocabGames.list()")
        k = C.seed_data()
        for g in ids:
            if g != "letras":
                k["games:best"][g] = dict(k["games:best"].get(g) or {"score": 1, "stars": 1, "plays": 1}, at=T - 24 * H)
        _open(page, k)
        r0 = page.evaluate(_MENU)["reto"]
        if not r0 or r0["g"] != "letras" or r0["href"] != "#/juegos/letras?t=animales" or r0["t"] != "Letras locas · Animales":
            probs.append(f"el reto no es Letras locas: {r0}")
        # la tarjeta no anuncia monedas (el premio es una sorpresa)
        card = page.evaluate("() => { const a = document.getElementById('gm-reto'); return {t: a.textContent.replace(/\\s+/g, ' '), coin: !!a.querySelector('.coin-ico, [class*=coin]')}; }")
        if re.search(r"\+\d|moneda", card["t"] + (r0 or {}).get("aria", ""), re.I) or card["coin"]:
            probs.append(f"la tarjeta del reto anuncia monedas: {card} {(r0 or {}).get('aria')}")
        C.reload(page)
        page.evaluate(J._HOOKS)
        if page.evaluate(_MENU)["reto"] != r0:
            probs.append("el reto cambia al recargar")
        coins = page.evaluate(J._COINS)
        # 1) desde su tarjeta normal: no cuenta como reto
        J._start(page, "letras")
        _solve_letras(page)
        e = _end_info(page)
        if e["stars"] != 3 or e["rok"] or "¡Nivel 2!" not in e["lvup"] or [a["n"] for a in e["aw"]] != [15]:
            probs.append(f"Letras desde su tarjeta: {e}")
        page.wait_for_timeout(2400)
        c1 = page.evaluate(J._COINS)
        if c1 - coins not in (15, 25):
            probs.append(f"monedas {coins} → {c1} (+15)")
        C.shot(page, "hub-nivel-2", OUT, full_page=False)
        J._to_menu(page)
        m = page.evaluate(_MENU)
        if m["reto"]["ok"] or page.evaluate("() => localStorage.getItem('games:reto')") is not None or m["lv"].get("letras") != "Nivel 2":
            probs.append(f"tras jugar desde la tarjeta normal: reto {m['reto']}, nivel {m['lv']}")
        # 2) desde el reto: paga +15 una vez
        page.evaluate("() => { __aw.length = 0; }")
        page.locator("#gm-reto").click()
        page.wait_for_function("() => document.documentElement.dataset.gmPlay === 'letras'", timeout=8000)
        if page.evaluate("() => location.hash") != "#/juegos/letras?t=animales":
            probs.append(f"el reto abre {page.evaluate('() => location.hash')}")
        page.wait_for_timeout(250)
        if page.locator(".gm-intro .gm-go").count():
            page.locator(".gm-intro .gm-go").click()
        _solve_letras(page)
        e = _end_info(page)
        sp = re.search(r"¡Reto conseguido! Sorpresa: \+(\d+)$", e["rok"].strip())
        bonus = int(sp.group(1)) if sp else -1
        if e["stars"] != 3 or not 10 <= bonus <= 20 or "¡Nivel 3!" not in e["lvup"] or [a["n"] for a in e["aw"]] != [15 + bonus] or f"+{15 + bonus}" not in e["plus"]:
            probs.append(f"Letras desde el reto: {e}")
        page.wait_for_timeout(2400)
        c2 = page.evaluate(J._COINS)
        if c2 - c1 not in (15 + bonus, 25 + bonus):
            probs.append(f"monedas del reto {c1} → {c2} (+15 y la sorpresa {bonus})")
        C.shot(page, "hub-reto-resultado", OUT, full_page=False)
        J._to_menu(page)
        m = page.evaluate(_MENU)
        st = page.evaluate("() => JSON.parse(localStorage.getItem('games:reto'))")
        if st != {"d": DK, "g": "letras", "tp": "animales", "days": [DK]}:
            probs.append(f"games:reto {st}")
        r = m["reto"]
        if not r["ok"] or not r["v"] or r["wk"][2] != "X+*" or any("+" in x for i, x in enumerate(r["wk"]) if i != 2) or "conseguido" not in r["aria"] \
                or "¡Conseguido!" not in page.locator("#gm-reto").text_content() or m["lv"].get("letras") != "Nivel 3":
            probs.append(f"la tarjeta del reto conseguido: {r}, nivel {m['lv'].get('letras')}")
        page.evaluate("() => scrollTo(0, 0)")
        C.shot(page, "hub-reto-conseguido", OUT, full_page=False)
        # 3) otra vez desde el reto: ya no paga
        page.evaluate("() => { __aw.length = 0; }")
        page.locator("#gm-reto").click()
        page.wait_for_function("() => document.documentElement.dataset.gmPlay === 'letras'", timeout=8000)
        page.wait_for_timeout(250)
        if page.locator(".gm-intro .gm-go").count():
            page.locator(".gm-intro .gm-go").click()
        _solve_letras(page)
        e = _end_info(page)
        if e["rok"] or [a["n"] for a in e["aw"]] != [15] or e["lvup"]:
            probs.append(f"el reto paga dos veces: {e}")
        if page.evaluate("() => JSON.parse(localStorage.getItem('games:reto'))") != st:
            probs.append("games:reto cambia al jugarlo otra vez")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- resultado
def _globos_round(page, r, miss):
    """Una ronda de Globos: el ojo dice la palabra; con miss, primero un globo que no es. Devuelve la palabra."""
    page.wait_for_function("r => (document.getElementById('gm-rd') || {}).textContent === String(r + 1) && !document.querySelector('.gm-reveal')"
                           " && document.querySelectorAll('#gm-air .gm-bal:not(:disabled)').length >= 4", arg=r, timeout=8000)
    page.evaluate("() => document.querySelector('#gm-listen #gm-peek').click()")
    w = page.evaluate("() => document.querySelector('#gm-ltxt b').textContent")
    es = WORDS[w.lower()]["es"]
    labels = page.evaluate("() => [...document.querySelectorAll('#gm-air .gm-bal')].map(b => b.getAttribute('aria-label').replace(/^Globo \\d+: /, ''))")
    k = labels.index(es)
    if miss:
        wrong = next(i for i in range(len(labels)) if i != k)
        page.evaluate("k => document.querySelector(`#gm-air .gm-bal[data-k=\"${k}\"]`).click()", wrong)
    return w, k


def _globos_hit(page, k):
    page.evaluate("k => document.querySelector(`#gm-air .gm-bal[data-k=\"${k}\"]`).click()", k)
    page.wait_for_selector(".gm-reveal", timeout=3000)


# split: alguna palabra (entre espacios) ocupa más de una línea, es decir, se parte por la mitad
_LIST = """() => { const wl = document.getElementById('gm-wl'), items = [...wl.querySelectorAll('.gm-wc')];
  const split = el => { const t = el.firstChild; if (!t || t.nodeType !== 3) return true; let i = 0, bad = false;
    for (const p of t.textContent.split(' ')) { if (p) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + p.length);
      if ([...r.getClientRects()].filter(x => x.width > 0).length > 1) bad = true; } i += p.length + 1; }
    return bad; };
  return {cols: getComputedStyle(wl).gridTemplateColumns.split(' ').filter(Boolean).length, wide: document.documentElement.scrollWidth > innerWidth,
    items: items.map(b => { const w = b.querySelector('.gm-wtx b'), x = b.querySelector('.gm-wx'), ip = b.querySelector('.gm-wtx .ipa');
      return {w: w.textContent, lang: w.lang, miss: b.classList.contains('gm-miss'), x: x ? x.textContent : null, xbg: x ? getComputedStyle(x).backgroundColor : null,
        ipa: ip ? ip.textContent : null, ipaFit: ip ? ip.scrollWidth <= ip.clientWidth + 1 : true, fit: w.scrollWidth <= w.clientWidth + 1,
        split: split(w), say: b.dataset.say}; }),
    rv: (document.getElementById('gm-rv') || {}).textContent || null, these: !!document.getElementById('gm-these'),
    lvup: !!document.getElementById('gm-lvup')}; }"""


def test_result_misses_first_review_and_play_these():
    """Globos a 360 px: 2 rondas a la primera y 8 con un fallo antes. Resultado: las 8 falladas primero con ✗ gris,
    las 10 con su IPA, en una columna y sin partirse; ★ (sin subir de nivel). Al repaso: de las falladas, las 2 que ya
    estaban quedan para hoy y de las 6 nuevas entran 3 (caja 0, para hoy); las acertadas no cambian; «✓ 5 palabras irán
    a tu repaso». «Jugar con estas» abre Globos (con el tema en el enlace) con las falladas."""
    probs = []
    page = C.new_page("phone", viewport={"width": 360, "height": 740})
    try:
        _open(page)
        J._start(page, "globos")
        words, missed = [], []
        for r in range(10):
            miss = r >= 2
            w, k = _globos_round(page, r, miss)
            words.append(w)
            if miss:
                missed.append(w)
            if r == 9:
                # antes de la última: 2 de las falladas ya en el repaso (para dentro de 10 días) y las otras 6 fuera
                srs = page.evaluate(_SRS)
                for i, x in enumerate(missed):
                    kk = WORDS[x.lower()]["k"]
                    if i < 2:
                        srs[kk] = {"d": "animales", "e": kk.split("|", 1)[1], "b": 3, "due": TODAY + 10, "n": 3}
                    else:
                        srs.pop(kk, None)
                page.evaluate("v => localStorage.setItem('srs:english', JSON.stringify(v))", srs)
                before = srs
            _globos_hit(page, k)
            page.clock.fast_forward(2000)
            page.wait_for_timeout(40)
        page.wait_for_selector("#gm-end", timeout=6000)
        page.wait_for_timeout(600)
        if len(set(words)) != 10:
            probs.append(f"palabras repetidas en las rondas: {words}")
        L = page.evaluate(_LIST)
        flags = [x["miss"] for x in L["items"]]
        if flags != [True] * 8 + [False] * 2 or {x["w"] for x in L["items"] if x["miss"]} != set(missed):
            probs.append(f"las falladas no van primero: {[(x['w'], x['miss']) for x in L['items']]} (falladas {missed})")
        for x in L["items"]:
            if x["miss"] and (x["x"] != "✗" or not _gray(x["xbg"])):
                probs.append(f"{x['w']}: la marca de fallo {x['x']!r} {x['xbg']}")
            if not x["ipa"] or not x["ipa"].strip("/ ") or not x["fit"] or not x["ipaFit"] or x["split"] or x["lang"] != "en-GB":
                probs.append(f"{x['w']}: IPA {x['ipa']!r}, cabe {x['fit']}/{x['ipaFit']}, partida {x['split']}, lang {x['lang']}")
        if L["cols"] != 1 or L["wide"]:
            probs.append(f"a 360 px: {L['cols']} columnas, se sale {L['wide']}")
        if L["lvup"] or page.evaluate(J._BEST)["globos"].get("lv", 1) != 1:
            probs.append("Globos sube de nivel sin ★★★")
        after = page.evaluate(_SRS)
        ks = [WORDS[x.lower()]["k"] for x in missed]
        for kk in ks[:2]:
            if after[kk]["due"] != TODAY or after[kk]["b"] != 3:
                probs.append(f"{kk} (ya en el repaso) no queda para hoy: {after[kk]}")
        new = [kk for kk in ks[2:] if kk in after]
        if len(new) != 3 or any(after[kk]["b"] != 0 or after[kk]["due"] != TODAY for kk in new):
            probs.append(f"nuevas en el repaso: {[(kk, after.get(kk)) for kk in ks[2:]]}")
        for w in words[:2]:
            kk = WORDS[w.lower()]["k"]
            if after.get(kk) != before.get(kk):
                probs.append(f"{kk} (acertada) cambia en el repaso: {before.get(kk)} → {after.get(kk)}")
        if set(after) - set(before) != set(new):
            probs.append(f"entran en el repaso otras: {set(after) - set(before)}")
        if not L["rv"] or "5 palabras irán a tu repaso" not in L["rv"] or not L["these"]:
            probs.append(f"«irán a tu repaso» / «Jugar con estas»: {L['rv']!r} {L['these']}")
        C.shot(page, "hub-resultado-360", OUT, full_page=False)
        page.locator("#gm-wl").scroll_into_view_if_needed()
        C.shot(page, "hub-resultado-360-lista", OUT, full_page=False)
        page.locator("#gm-rv").scroll_into_view_if_needed()
        C.shot(page, "hub-resultado-360-repaso", OUT, full_page=False)
        # «Jugar con estas»: Globos con las falladas
        page.wait_for_timeout(300)
        page.locator("#gm-these").click()
        page.wait_for_function("() => document.documentElement.dataset.gmPlay === 'globos' && document.querySelector('#gm-air .gm-bal')", timeout=8000)
        if page.evaluate("() => location.hash") != "#/juegos/globos?t=animales":
            probs.append(f"«Jugar con estas» abre {page.evaluate('() => location.hash')}")
        targets = []
        for r in range(3):
            w, k = _globos_round(page, r, False)
            targets.append(w)
            _globos_hit(page, k)
            page.clock.fast_forward(2000)
            page.wait_for_timeout(40)
        if any(w not in missed for w in targets):
            probs.append(f"«Jugar con estas» pregunta {targets} (falladas {missed})")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


_REG = """([id, mode, img]) => vocabGames.register(id, {t: 'Prueba ' + mode, img: 'img/games/globos.png', words: 'Prueba', played: mode === 'def',
  start(app, api) { const run = api.mount(app, '<div class="gm"><p class="gm-tip">Prueba</p></div>', '');
    window.__lv = {memoria: api.level('memoria'), lince: api.level('lince'), kbd: api.kbd()};
    api.answer(mode === 'right', {es: 'gato', word: 'cat'});
    api.later(run, () => api.finish(run, id, {score: 3, stars: 2, line: 'Prueba terminada', played: mode === 'fin',
      words: [{k: 'animales|Gato', es: 'gato', word: 'cat', img, ipa: '/kæt/', miss: true}]}), 80); }})"""


def test_zero_right_is_lets_go_again():
    """Una partida sin ningún acierto: «¡Vamos otra vez!» sin estrellas, monedas, récord, "game-done", partidas de hoy
    ni repaso (las palabras sin ✗), con «Otra vez». Con def.played, finish({played: true}) o un acierto: el resultado de
    siempre (★★, +10, récord con at, "game-done" y la fallada al repaso)."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page)
        for mode in ("zero", "def", "fin", "right"):
            gid = f"prueba-{mode}"
            page.evaluate(_REG, [gid, mode, GATO["img"]])
            s0 = page.evaluate("() => ({coins: JSON.parse(localStorage.getItem('game')).coins, day: localStorage.getItem('games:day'), srs: localStorage.getItem('srs:english')})")
            page.evaluate("() => { __aw.length = 0; __gd.length = 0; }")
            page.evaluate("id => { location.hash = '#/juegos/' + id; }", gid)
            page.wait_for_selector("#gm-end", timeout=8000)
            page.wait_for_timeout(2600)
            e = page.evaluate("""() => ({t: document.querySelector('.gm-end-t').textContent, st: !!document.querySelector('.gm-end-st'), plus: !!document.getElementById('gm-plus'),
              aw: __aw.length, gd: __gd.length, again: !!document.getElementById('gm-again'), these: !!document.getElementById('gm-these'),
              rv: (document.getElementById('gm-rv') || {}).textContent || '', miss: document.querySelectorAll('.gm-wc.gm-miss').length,
              stars: document.querySelectorAll('.gm-end-st .gm-es.on').length, wl: document.querySelectorAll('.gm-wc').length})""")
            s1 = page.evaluate("() => ({coins: JSON.parse(localStorage.getItem('game')).coins, day: localStorage.getItem('games:day'), srs: localStorage.getItem('srs:english')})")
            best = page.evaluate(J._BEST).get(gid)
            if mode == "zero":
                if e["t"] != "¡Vamos otra vez!" or e["st"] or e["plus"] or e["aw"] or e["gd"] or not e["again"] or e["these"] or e["rv"] or e["miss"] or e["wl"] != 1:
                    probs.append(f"sin aciertos: {e}")
                if best is not None or s1 != s0:
                    probs.append(f"sin aciertos guarda algo: récord {best}, {s0} → {s1}")
                C.shot(page, "hub-vamos-otra-vez", OUT, full_page=False)
            else:
                if e["t"] == "¡Vamos otra vez!" or e["stars"] != 2 or not e["plus"] or e["aw"] != 1 or e["gd"] != 1 or "1 palabra irá a tu repaso" not in e["rv"] or e["miss"] != 1:
                    probs.append(f"{mode}: {e}")
                if not best or best.get("plays") != 1 or best.get("stars") != 2 or not best.get("at"):
                    probs.append(f"{mode}: récord {best}")
                if s1["coins"] - s0["coins"] not in (10, 20):
                    probs.append(f"{mode}: monedas {s0['coins']} → {s1['coins']}")
            page.evaluate("() => { location.hash = '#/juegos'; }")
            page.wait_for_selector("#gm-cards", timeout=5000)
        lv = page.evaluate("() => window.__lv")
        if lv != {"memoria": 1, "lince": 1, "kbd": False}:
            probs.append(f"api.level / api.kbd: {lv}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- niveles
def _letras_len(page):
    page.wait_for_selector("#gm-slots .gm-slot", timeout=6000)
    return page.evaluate("() => document.querySelectorAll('#gm-slots .gm-slot').length")


def _set_lv(page, g, lv):
    page.evaluate("([g, lv]) => { const b = JSON.parse(localStorage.getItem('games:best') || '{}'); b[g] = Object.assign({score: 1, stars: 1, plays: 1}, b[g]);"
                  " if (lv > 1) b[g].lv = lv; else delete b[g].lv; localStorage.setItem('games:best', JSON.stringify(b)); }", [g, lv])


def test_levels_cards_and_games():
    """Con "games:best" lv: «Nivel N» en la tarjeta (y en su nombre accesible) y en el vistazo («2 de 3»);
    vocabGames.level y api.level. Memoria nivel 2: 16 cartas; Globos nivel 3: 6 globos sin el ojo; nivel 2: 6 con el
    ojo; Letras: la primera palabra de 3-5 letras en el nivel 1, 4-7 en el 2 y 6-8 en el 3."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page, _keys(memoria={"lv": 2}, globos={"lv": 3}, lluvia={"lv": 2}, letras={"score": 9, "stars": 2, "plays": 1, "lv": 3}))
        m = page.evaluate(_MENU)
        if m["lv"] != {"memoria": "Nivel 2", "lluvia": "Nivel 2", "globos": "Nivel 3", "letras": "Nivel 3"}:
            probs.append(f"insignias de nivel: {m['lv']}")
        aria = page.evaluate("() => document.querySelector('.gm-card[data-g=\"memoria\"]').getAttribute('aria-label')")
        if "Nivel 2." not in aria:
            probs.append(f"nombre accesible de Memoria: {aria!r}")
        lv = page.evaluate("() => ['memoria', 'lluvia', 'globos', 'letras', 'lince'].map(g => vocabGames.level(g))")
        if lv != [2, 2, 3, 3, 1]:
            probs.append(f"vocabGames.level: {lv}")
        page.evaluate("() => vocabGames.peek('memoria', null)")
        page.wait_for_selector("dialog#gm-peek[open]", timeout=3000)
        rows = page.evaluate("() => [...document.querySelectorAll('#gm-peek .gm-pk-r')].map(r => [...r.children].map(c => c.textContent.trim()).join(' '))")
        if "Nivel 2 de 3" not in rows:
            probs.append(f"vistazo: {rows}")
        page.evaluate("() => document.querySelectorAll('dialog[open]').forEach(d => d.close())")
        page.evaluate(_REG, ["prueba-nivel", "right", GATO["img"]])
        page.evaluate("() => { location.hash = '#/juegos/prueba-nivel'; }")
        page.wait_for_selector("#gm-end", timeout=8000)
        if page.evaluate("() => window.__lv.memoria") != 2:
            probs.append(f"api.level('memoria'): {page.evaluate('() => window.__lv')}")
        _menu(page)
        J._start(page, "memoria")
        n = page.evaluate("() => [document.querySelectorAll('#gm-board .gm-mc').length, document.querySelectorAll('#gm-board .k-word .ipa').length]")
        if n != [16, 8]:
            probs.append(f"Memoria nivel 2: {n[0]} cartas, {n[1]} con IPA")
        C.shot(page, "hub-memoria-nivel-2", OUT, full_page=False)
        for glv, want_eye in ((3, False), (2, True)):
            _set_lv(page, "globos", glv)
            _menu(page)
            J._start(page, "globos")
            page.wait_for_function("() => document.querySelectorAll('#gm-air .gm-bal').length > 0", timeout=6000)
            g = page.evaluate("() => [document.querySelectorAll('#gm-air .gm-bal').length, !!document.querySelector('#gm-listen #gm-peek')]")
            if g != [6, want_eye]:
                probs.append(f"Globos nivel {glv}: {g[0]} globos, ojo {g[1]}")
            if glv == 3:
                page.wait_for_timeout(500)
                C.shot(page, "hub-globos-nivel-3", OUT, full_page=False)
        for llv, lo, hi in ((3, 6, 8), (2, 4, 7), (1, 3, 5)):
            _set_lv(page, "letras", llv)
            _menu(page)
            J._start(page, "letras")
            n = _letras_len(page)
            if not lo <= n <= hi:
                probs.append(f"Letras nivel {llv}: {n} letras (de {lo} a {hi})")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- IPA, teclas y explicaciones
def test_ipa_in_the_four_games():
    """La IPA sale en Memoria (las cartas de palabra), Lluvia (lo que sube al atrapar), Globos (al acertar) y Letras
    (al escribirla); con la IPA apagada (Para mayores) no sale en Memoria."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page)
        J._start(page, "memoria")
        n = page.evaluate("() => [...document.querySelectorAll('#gm-board .k-word')].map(f => (f.querySelector('.ipa') || {}).textContent || '')")
        if len(n) != 6 or not all(x.strip("/ ") for x in n):
            probs.append(f"Memoria: IPA {n}")
        # Globos: al acertar
        _menu(page)
        J._start(page, "globos")
        w, k = _globos_round(page, 0, False)
        _globos_hit(page, k)
        rv = page.evaluate("() => { const r = document.querySelector('.gm-reveal'); return {t: r.textContent, ipa: (r.querySelector('.ipa') || {}).textContent || ''}; }")
        if not rv["ipa"].strip("/ ") or w not in rv["t"]:
            probs.append(f"Globos: {rv}")
        # Letras: al escribirla
        _menu(page)
        J._start(page, "letras")
        page.keyboard.type(_ART.sub("", _hear_word(page)), delay=15)
        page.wait_for_selector("#gm-next", timeout=4000)
        ok = page.evaluate("() => (document.querySelector('.gm-lt-ok .ipa') || {}).textContent || ''")
        if not ok.strip("/ "):
            probs.append("Letras: sin IPA al escribirla")
        # Lluvia: lo que sube al atrapar
        _menu(page)
        page.evaluate("() => { __said.length = 0; }")
        J._start(page, "lluvia")
        page.wait_for_function("() => __said.length > 0", timeout=5000)
        fl = None
        page.wait_for_function("""() => { const t = __said[__said.length - 1], sky = document.getElementById('gm-sky');
          const b = [...document.querySelectorAll('#gm-sky .gm-bub:not(.bad):not(.pop):not(.gone)')].find(x => x.getAttribute('aria-label') === t && !x.disabled
            && x.getBoundingClientRect().top > sky.getBoundingClientRect().top);
          if (!b) return false; b.click(); const f = document.querySelector('#gm-sky .gm-float:not(.bad)');
          window.__fl = f ? {t: f.textContent, ipa: (f.querySelector('.ipa') || {}).textContent || '', w: (f.querySelector('.gm-fw') || {}).textContent || ''} : null; return true; }""", timeout=15000)
        fl = page.evaluate("() => window.__fl")
        if not fl or not fl["ipa"].strip("/ ") or not fl["w"]:
            probs.append(f"Lluvia: {fl}")
        C.shot(page, "hub-lluvia-ipa", OUT, full_page=False)
        # con la IPA apagada
        page.evaluate("() => { const o = JSON.parse(localStorage.getItem('vocab:ui') || '{}'); o.ipa = false; localStorage.setItem('vocab:ui', JSON.stringify(o)); }")
        C.goto(page, "#/juegos")
        C.reload(page)
        page.evaluate(J._HOOKS)
        J._start(page, "memoria")
        if page.evaluate("() => document.querySelectorAll('#gm-board .ipa').length"):
            probs.append("Memoria enseña la IPA apagada")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_keys_only_with_a_keyboard_and_short_hows():
    """Las teclas de Letras («Con el teclado…», def.keys) salen en la explicación y en el «?» con ratón (escritorio) y no
    en el móvil, salvo si se acaba de usar una tecla (api.kbd). Las explicaciones de los 4 clásicos tienen 15 palabras
    como mucho. "games:reto" y "gram:lv" van en EXACT de js/save.js (se guardan y se copian)."""
    probs = []
    for kind in ("desk", "phone"):
        page = C.new_page(kind)
        try:
            _open(page)
            hows = {}
            for g in CLASSIC:
                page.evaluate("g => vocabGames.peek(g, null)", g)
                page.wait_for_selector("dialog#gm-peek[open]", timeout=3000)
                hows[g] = page.evaluate("() => document.querySelector('#gm-peek .gm-pk-p').textContent")
                keys = page.evaluate("() => (document.querySelector('#gm-peek .gm-keys') || {}).textContent || ''")
                if (g == "letras" and kind == "desk") != bool(keys):
                    probs.append(f"{kind} vistazo de {g}: teclas {keys!r}")
                page.evaluate("() => document.querySelectorAll('dialog[open]').forEach(d => d.close())")
            for g, t in hows.items():
                if len(t.split()) > 15:
                    probs.append(f"{g}: la explicación tiene {len(t.split())} palabras: {t!r}")
            shown = J._start(page, "letras", intro=None)
            k = page.evaluate("() => { const k = document.getElementById('gm-in-k'); return k && !k.hidden && getComputedStyle(k).display !== 'none' ? k.textContent : ''; }")
            if not shown or (kind == "desk") != ("teclado" in k):
                probs.append(f"{kind}: la explicación de Letras {'sin' if kind == 'desk' else 'con'} las teclas: {k!r}")
            if kind == "desk":
                C.shot(page, "hub-letras-teclas-escritorio", OUT, full_page=False)
            page.locator(".gm-intro .gm-go").click()
            page.wait_for_timeout(200)
            page.locator(".gm-top [data-gm-how]").click()
            page.wait_for_selector("dialog#gm-how[open]", timeout=3000)
            hk = page.evaluate("() => (document.querySelector('#gm-how .gm-keys') || {}).textContent || ''")
            if (kind == "desk") != bool(hk):
                probs.append(f"{kind}: el «?» {'sin' if kind == 'desk' else 'con'} las teclas: {hk!r}")
            page.locator("#gm-how [data-close]").click()
            page.wait_for_function("() => !document.getElementById('gm-how').open && !vocabGames.paused", timeout=3000)
            if kind == "phone":
                # con un teclado conectado al móvil: tras una tecla, el «?» sí las enseña
                page.keyboard.press("Backspace")
                page.evaluate("() => vocabGames.how(document.querySelector('.gm-top [data-gm-how]'))")
                page.wait_for_selector("dialog#gm-how[open]", timeout=3000)
                if "teclado" not in page.evaluate("() => (document.querySelector('#gm-how .gm-keys') || {}).textContent || ''"):
                    probs.append("móvil con teclado: el «?» no enseña las teclas")
            probs += [f"{kind}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    src = (C.ROOT / "js" / "save.js").read_text(encoding="utf-8")
    exact = re.search(r"const EXACT = \{(.*?)\};", src, re.S)
    for key in ("games:reto", "gram:lv"):
        if not exact or f'"{key}"' not in exact.group(1):
            probs.append(f"{key} no está en EXACT de js/save.js")
    assert not probs, "\n".join(probs)
