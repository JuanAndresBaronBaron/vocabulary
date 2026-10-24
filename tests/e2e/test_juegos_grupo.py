"""Juegos en grupo (js/party.js): «El impostor» (#/juegos/impostor) y «Ordenar por grupo» (#/juegos/ordenar).

El impostor: en grupo (3-8 nombres que el aparato recuerda en "party:st"; cada uno ve su papel a solas: el civil la
palabra con dibujo, IPA, audio y su español; el impostor «¡Eres el impostor!» y una pista; «Tapar y pasar»; 3 rondas
con a quién le toca, el impostor nunca empieza; votar; si le pillan, adivina entre 4 dibujos) y solo (con el zorro y
sus amigos: dicen y enseñan palabras con IPA y audio; uno es el impostor y dice palabras de otra cosa de su familia; a
veces el impostor es el niño, que al final adivina la palabra). Ordenar: 8-12 palabras con dibujo en 2 o 3 cestas con
su nombre en el idioma (IPA, dibujo y altavoz), tocando la palabra y la cesta o arrastrando; cada palabra suena;
estrellas, récord y monedas con finish() de games.js. Datos: data/party.json, sacado del vocabulario.

La voz se espía: say() y sayP() de index.html se cambian por unas que apuntan lo que dirían (sayP resuelve enseguida)."""
from __future__ import annotations

import json
import re

import common as C

OUT = C.CAPTURAS / "juegos-grupo"
DATA = json.loads((C.REPO / "data" / "party.json").read_text(encoding="utf-8"))
LANGS = ("english", "français", "dansk")
CODE = {"english": "en-GB", "français": "fr-FR", "dansk": "da-DK"}

_SPY = """() => { window.__said = [];
  window.say = (t, b) => { window.__said.push(String(t)); };
  window.sayP = t => { window.__said.push(String(t)); return Promise.resolve(); }; }"""


def _page(w=390, h=844, **kw):
    return C.new_page("phone", viewport={"width": w, "height": h}, **kw)


def _seed(page, lang="english", hash="#/juegos"):
    keys = C.seed_keys()
    keys["lang"] = json.dumps(lang)
    try:
        ui = json.loads(keys.get("vocab:ui") or "{}")
    except ValueError:
        ui = {}
    ui["gmIntro"] = ["impostor", "ordenar"]   # la explicación ya vista: la tarjeta corta «¡A jugar!»
    keys["vocab:ui"] = json.dumps(ui)
    C.seed(page, keys, hash=hash)
    page.evaluate(_SPY)


def _go(page, hash):
    C.goto(page, hash)
    page.evaluate(_SPY)
    page.wait_for_selector("#pt, .gm-go", timeout=8000)
    if page.locator(".gm-go").count():
        page.locator(".gm-go").click()
    page.wait_for_selector("#pt-main > *", timeout=8000)


def _said(page):
    return page.evaluate("window.__said.slice()")


def _coins(page):
    return page.evaluate("JSON.parse(localStorage.getItem('game')).coins")


def _best(page, g):
    return page.evaluate(f"(JSON.parse(localStorage.getItem('games:best') || '{{}}'))[{json.dumps(g)}] || null")


def _word(wid, lang):
    return DATA["words"][wid][lang][0]


def _case_of(word, lang):
    for fam, F in DATA["impostor"].items():
        for c in F["cases"]:
            if _word(c["w"], lang) == word:
                return fam, c
    return None, None


def _box(page, sel):
    return page.evaluate("""s => { const e = document.querySelector(s); if(!e) return null; const b = e.getBoundingClientRect();
      return {w: b.width, h: b.height, top: b.top, bottom: b.bottom, left: b.left, right: b.right}; }""", sel)


def _hscroll(page):
    return page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")


# ------------------------------------------------------------------------------------------------ datos y tarjetas
def test_data_from_vocabulary_and_cards():
    """data/party.json sale del vocabulario: cada palabra existe en data/<d>.json con la misma palabra e IPA en los tres
    idiomas y sus dibujos existen; cada caso del impostor tiene palabra secreta con dibujo (de un tema de Juegos) y ≥ 9
    relacionadas; cada juego de Ordenar tiene 2 cestas con ≥ 5 palabras o 3 con ≥ 4 (8-12) y cada cesta su nombre con IPA
    en los tres idiomas. js/party.js, data/party.json y los dibujos de las tarjetas van en SHELL y OFF_APP; "party:st" es
    DEVICE_ONLY. En Jugar salen las dos tarjetas tras «Oído de lince», con su dibujo de 220 px."""
    probs = []
    games_js = (C.REPO / "js" / "games.js").read_text(encoding="utf-8")
    topics = set(re.findall(r'\["(\w+)", "[0-9A-F-]+", "[^"]+", [01]\]', games_js))
    docs = {}
    for wid, w in DATA["words"].items():
        d = w["d"]
        if d not in docs:
            docs[d] = json.loads((C.REPO / "data" / f"{d}.json").read_text(encoding="utf-8"))["rows"]
        rows = [r for r in docs[d] if r.get("l") and all((r["l"].get(L) or {}).get("ipa") == w[L][1] for L in LANGS)
                and all(w[L][0] in (r["l"][L].get("word") or "") for L in LANGS)]
        if not rows:
            probs.append(f"{wid}: no está igual en data/{d}.json")
        if w["img"] and not (C.REPO / w["img"]).exists():
            probs.append(f"{wid}: falta {w['img']}")
    for fam, F in DATA["impostor"].items():
        if F["hint"] not in DATA["words"]:
            probs.append(f"{fam}: la pista {F['hint']} no está")
        for c in F["cases"]:
            w = DATA["words"].get(c["w"])
            if not w or not w["img"] or w["d"] not in topics:
                probs.append(f"{fam}/{c['w']}: sin dibujo o fuera de los temas de Juegos")
            if len(set(c["rel"])) < 9 or c["w"] in c["rel"] or any(r not in DATA["words"] for r in c["rel"]):
                probs.append(f"{fam}/{c['w']}: relacionadas {c['rel']}")
    G = DATA["sort"]["groups"]
    for gid, g in G.items():
        if any(not g["n"].get(L) or not g["n"][L][0] or not re.match(r"^/.+/$", g["n"][L][1]) for L in LANGS):
            probs.append(f"cesta {gid}: nombre o IPA {g['n']}")
        if not DATA["words"][g["pic"]]["img"] or any(not DATA["words"][x]["img"] or DATA["words"][x]["d"] not in topics for x in g["w"]):
            probs.append(f"cesta {gid}: palabras sin dibujo o fuera de los temas")
    for s in DATA["sort"]["sets"]:
        per = 4 if len(s) == 3 else 5
        if len(s) not in (2, 3) or any(len(G[x]["w"]) < per for x in s) or not 8 <= per * len(s) <= 12:
            probs.append(f"juego {s}: pocas palabras")
    sw = (C.REPO / "sw.js").read_text(encoding="utf-8")
    html = (C.REPO / "index.html").read_text(encoding="utf-8")
    shell = sw[sw.index("const SHELL"):sw.index("];", sw.index("const SHELL"))]
    off = html[html.index("const OFF_APP"):html.index("];", html.index("const OFF_APP"))]
    for f in ("js/party.js", "data/party.json", "img/games/impostor.png", "img/games/ordenar.png"):
        if f'"{f}"' not in shell or f'"{f}"' not in off:
            probs.append(f"{f} no está en SHELL u OFF_APP")
    if not re.search(r'DEVICE_ONLY = \[[^\]]*"party:st"', (C.REPO / "js" / "save.js").read_text(encoding="utf-8")):
        probs.append('"party:st" no está en DEVICE_ONLY de js/save.js')
    page = _page()
    try:
        _seed(page)
        page.wait_for_selector(".gm-card[data-g=ordenar]", timeout=8000)
        r = page.evaluate("""() => { const ids = [...document.querySelectorAll('#gm-cards .gm-card')].map(c => c.dataset.g);
          const card = g => { const c = document.querySelector(`.gm-card[data-g="${g}"]`), i = c.querySelector('img');
            return {href: c.getAttribute('href'), t: c.querySelector('.gm-ct').textContent, img: i.getAttribute('src'), nw: i.naturalWidth, isNew: !!c.querySelector('.gm-new')}; };
          return {ids, imp: card('impostor'), sort: card('ordenar')}; }""")
        i = r["ids"].index("lince") if "lince" in r["ids"] else -9
        if r["ids"][i + 1:i + 3] != ["impostor", "ordenar"]:
            probs.append(f"orden de las tarjetas: {r['ids']}")
        for k, href, t, img in (("imp", "#/juegos/impostor", "El impostor", "img/games/impostor.png"), ("sort", "#/juegos/ordenar", "Ordenar por grupo", "img/games/ordenar.png")):
            c = r[k]
            if c["href"] != href or c["t"] != t or c["img"] != img or c["nw"] != 220 or not c["isNew"]:
                probs.append(f"tarjeta {k}: {c}")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ------------------------------------------------------------------------------------------------ impostor en grupo
def _names(page, names):
    for n in names:
        page.fill("#pt-in", n)
        page.press("#pt-in", "Enter")


def _deal(page, n):
    """Mira el papel de todos; devuelve (índice del impostor, palabra secreta, pista)."""
    imp, secret, hint, probs = None, None, None, []
    for i in range(n):
        page.locator(f'.pt-pl[data-i="{i}"]').click()
        page.wait_for_selector("#pt-see")
        if page.locator(".pt-role").count():
            probs.append("el papel se ve antes de «Ver mi papel»")
        page.evaluate("window.__said = []")
        page.locator("#pt-see").click()
        page.wait_for_selector(".pt-role")
        page.wait_for_timeout(450)
        if page.evaluate("window.__said.length"):
            probs.append(f"el papel suena solo (lo oirían todos): {page.evaluate('window.__said')}")
        page.locator("#pt-say").click()
        r = page.evaluate("""() => { const R = document.querySelector('.pt-role'), w = R.querySelector('.pt-w');
          return {imp: R.classList.contains('pt-imp'), tag: R.querySelector('.pt-tag').textContent, word: w.textContent, lang: w.lang,
            ipa: !!R.querySelector('.pt-say .ipa[lang]'), es: (R.querySelector('.pt-es b') || {}).textContent || '', img: !!R.querySelector('.pt-pic img')}; }""")
        if r["imp"]:
            if imp is not None:
                probs.append("hay dos impostores")
            imp, hint = i, r["word"]
            if "impostor" not in r["tag"].lower() or not r["ipa"] or not r["es"]:
                probs.append(f"papel del impostor: {r}")
        else:
            if secret not in (None, r["word"]):
                probs.append("los civiles no tienen la misma palabra")
            secret = r["word"]
            if r["tag"] != "Eres civil" or not r["img"] or not r["ipa"] or not r["es"] or r["lang"] != "en-GB":
                probs.append(f"papel del civil: {r}")
        if r["word"] not in page.evaluate("window.__said"):
            probs.append(f"el altavoz del papel no dice «{r['word']}»")
        page.locator("#pt-hide").click()
        page.wait_for_selector(".pt-grid")
        if page.locator(".pt-role").count():
            probs.append("«Tapar y pasar» no tapa el papel")
        if i < n - 1 and page.locator("#pt-go").count():
            probs.append("«Empezar las rondas» sale antes de que todos lo vean")
    return imp, secret, hint, probs


def test_impostor_group_names_roles_rounds_vote_and_last_chance():
    """En grupo: los nombres (Enter añade, vacío pone «Jugador N», repetidos no, ✕ quita, 8 como mucho, ≥ 3 para
    repartir) se guardan solos y vuelven al recargar. Un solo impostor; los civiles ven la misma palabra con dibujo, IPA y
    español (y suena); el impostor su pista. 3 rondas: el impostor nunca empieza y cada uno habla una vez por ronda. Votar
    al impostor da la última oportunidad entre 4 dibujos (uno es la palabra); si falla, «¡Ganan los civiles!», ★★★ y las
    monedas de los juegos (15). "party:st" no va en la exportación."""
    probs = []
    page = _page()
    try:
        _seed(page)
        _go(page, "#/juegos/impostor")
        page.locator(".pt-mode[data-m=grupo]").click()
        page.wait_for_selector("#pt-in")
        if not page.locator("#pt-go").is_disabled():
            probs.append("«Repartir papeles» con menos de 3")
        _names(page, ["Ana", "ana", "", "Leo", "Mía", "Bo", "Cy", "Di", "Eva"])
        names = page.evaluate("[...document.querySelectorAll('.pt-chip > span:not(.pt-av)')].map(s => s.textContent)")
        if names != ["Ana", "Jugador 2", "Leo", "Mía", "Bo", "Cy", "Di", "Eva"] or not page.locator("#pt-in").is_disabled():
            probs.append(f"nombres: {names}")
        for _ in range(5):
            page.locator(".pt-chip-x").last.click()
        if page.evaluate("JSON.parse(localStorage.getItem('party:st')).names") != ["Ana", "Jugador 2", "Leo"]:
            probs.append(f"party:st: {page.evaluate('localStorage.getItem(`party:st`)')}")
        snap = C.export(page)
        if "party:st" in snap["keys"]:
            probs.append("party:st va en la exportación")
        C.reload(page)
        page.wait_for_selector(".gm-go, #pt-main > *")
        if page.locator(".gm-go").count():
            page.locator(".gm-go").click()
        page.locator(".pt-mode[data-m=grupo]").click()
        page.wait_for_selector("#pt-in")
        page.evaluate(_SPY)
        if page.locator(".pt-chip").count() != 3 or page.locator("#pt-go").is_disabled():
            probs.append("los últimos nombres no vuelven al recargar")
        page.locator("#pt-go").click()
        page.wait_for_selector(".pt-grid")
        imp, secret, hint, p2 = _deal(page, 3)
        probs += p2
        if imp is None or not secret or not hint:
            probs.append(f"impostor {imp}, palabra {secret}, pista {hint}")
        fam, case = _case_of(secret, "english")
        if not case or _word(DATA["impostor"][fam]["hint"], "english") != hint:
            probs.append(f"la pista {hint} no es la de la familia de {secret}")
        page.locator("#pt-go").click()
        order = []
        for k in range(9):
            page.wait_for_selector("#pt-next")
            who = page.locator(".pt-who b").text_content()
            rd = page.locator(".pt-rd").text_content()
            if rd != f"Ronda {k // 3 + 1} de 3" or page.locator("#pt-rn").text_content() != str(k // 3 + 1):
                probs.append(f"ronda {k}: {rd}")
            order.append(who)
            page.locator("#pt-next").click()
        imp_name = ["Ana", "Jugador 2", "Leo"][imp]
        if order[0] == imp_name or order[:3] != order[3:6] or order[3:6] != order[6:] or sorted(order[:3]) != sorted(["Ana", "Jugador 2", "Leo"]):
            probs.append(f"orden de las rondas: {order} (impostor {imp_name})")
        page.wait_for_selector(".pt-grid .pt-pl")
        if not page.locator("#pt-go").is_disabled():
            probs.append("«Votar» sin elegir")
        page.locator(f'.pt-pl[data-i="{imp}"]').click()
        if f"Votar a {imp_name}" not in page.locator("#pt-go").text_content():
            probs.append(f"botón de votar: {page.locator('#pt-go').text_content()}")
        page.locator("#pt-go").click()
        page.wait_for_selector("#pt-opts .pt-op")
        opts = page.evaluate("[...document.querySelectorAll('#pt-opts .pt-op')].map(b => ({w: b.querySelector('.pt-w').textContent, img: !!b.querySelector('img'), ipa: !!b.querySelector('.ipa')}))")
        if len(opts) != 4 or [o["w"] for o in opts].count(secret) != 1 or not all(o["img"] and o["ipa"] for o in opts):
            probs.append(f"las 4 opciones: {opts}")
        c0 = _coins(page)
        wrong = next(i for i, o in enumerate(opts) if o["w"] != secret)
        page.locator(f'#pt-opts .pt-op[data-k="{wrong}"]').click()
        r = page.evaluate("""() => ({miss: document.querySelectorAll('.pt-op.is-miss').length, right: [...document.querySelectorAll('.pt-op.is-right')].map(b => b.querySelector('.pt-w').textContent),
          win: (document.querySelector('.pt-win') || {}).textContent || ''})""")
        if r["miss"] != 1 or r["right"] != [secret] or r["win"] != "¡Ganan los civiles!":
            probs.append(f"tras fallar la última oportunidad: {r}")
        page.locator("#pt-end").click()
        page.wait_for_selector("#gm-end")
        page.wait_for_timeout(700)
        b = _best(page, "impostor")
        if not b or b["stars"] != 3 or b["plays"] != 1 or page.locator(".gm-es.on").count() != 3:
            probs.append(f"récord: {b}")
        if _coins(page) - c0 not in (15, 25):
            probs.append(f"monedas: {c0} → {_coins(page)}")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_impostor_group_wrong_vote_and_caught_guess():
    """Votar a un civil: «¡Gana el impostor!», se ve la palabra secreta (dibujo, IPA, español) y suena; ★★. Otra partida:
    pillado y acierta la palabra: «¡Gana el impostor!» y ★★. «Votar ya» sale desde la segunda ronda."""
    probs = []
    page = _page(360, 740)
    try:
        _seed(page)
        for attempt in ("civil", "guess"):
            _go(page, "#/juegos/impostor?m=grupo")
            page.wait_for_selector("#pt-in")
            if page.locator(".pt-chip").count() < 3:
                _names(page, ["Ana", "Leo", "Mía"])
            page.locator("#pt-go").click()
            page.wait_for_selector(".pt-grid")
            imp, secret, hint, p2 = _deal(page, 3)
            probs += p2
            page.locator("#pt-go").click()
            page.wait_for_selector("#pt-next")
            if page.locator("#pt-vote").count():
                probs.append("«Votar ya» en la primera ronda")
            for _ in range(3):
                page.locator("#pt-next").click()
            page.wait_for_selector("#pt-vote")
            page.locator("#pt-vote").click()
            page.wait_for_selector(".pt-grid .pt-pl")
            if attempt == "civil":
                v = (imp + 1) % 3
                page.locator(f'.pt-pl[data-i="{v}"]').click()
                page.locator("#pt-go").click()
                page.wait_for_selector("#pt-end")
                r = page.evaluate("""() => ({win: document.querySelector('.pt-win').textContent, w: document.querySelector('.pt-res .pt-w').textContent,
                  img: !!document.querySelector('.pt-res .pt-pic img'), ipa: !!document.querySelector('.pt-res .ipa'), es: document.querySelector('.pt-res .pt-es b').textContent})""")
                page.wait_for_timeout(700)
                if r["win"] != "¡Gana el impostor!" or r["w"] != secret or not r["img"] or not r["ipa"] or not r["es"] or secret not in _said(page):
                    probs.append(f"voto a un civil: {r}")
            else:
                page.locator(f'.pt-pl[data-i="{imp}"]').click()
                page.locator("#pt-go").click()
                page.wait_for_selector("#pt-opts .pt-op")
                k = page.evaluate("s => [...document.querySelectorAll('#pt-opts .pt-op')].findIndex(b => b.querySelector('.pt-w').textContent === s)", secret)
                page.locator(f'#pt-opts .pt-op[data-k="{k}"]').click()
                if page.locator(".pt-op.is-ok").count() != 1 or page.locator(".pt-win").text_content() != "¡Gana el impostor!":
                    probs.append("acertar la última oportunidad no da «¡Gana el impostor!»")
            if _hscroll(page):
                probs.append(f"{attempt}: scroll horizontal a 360")
            page.locator("#pt-end").click()
            page.wait_for_selector("#gm-end")
            if page.locator(".gm-es.on").count() != 2:
                probs.append(f"{attempt}: estrellas {page.locator('.gm-es.on').count()}")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ------------------------------------------------------------------------------------------------ impostor solo
def _solo(page, r):
    """Modo solo con Math.random fijo (r < .34: el impostor eres tú) mientras se reparte."""
    C.goto(page, "#/juegos/impostor?m=solo")
    page.evaluate(_SPY)
    page.wait_for_selector(".gm-go", timeout=8000)
    page.evaluate(f"() => {{ window.__rnd = Math.random; Math.random = () => {r}; }}")
    page.locator(".gm-go").click()
    page.wait_for_selector(".pt-role")
    page.evaluate("() => { Math.random = window.__rnd; }")


def test_impostor_solo_find_the_impostor():
    """Solo, civil: el zorro y 2 amigos. Cada uno dice (suena) y enseña su palabra en el escenario con IPA; en la mesa se
    apuntan (3 por personaje). En mi turno hay 3 palabras y solo una es de las relacionadas; fallar la pone en gris con
    ✗ (sin desactivar las demás). El impostor no es el zorro y sus palabras no son de la palabra secreta, pero sí de su
    familia. Votarlo: «¡Lo pillaste!» y el premio."""
    probs = []
    page = _page(reduced_motion="reduce")
    try:
        _seed(page)
        _solo(page, 0.9)
        role = page.evaluate("() => ({civil: !!document.querySelector('.pt-civil'), w: document.querySelector('.pt-role .pt-w').textContent})")
        if not role["civil"]:
            probs.append("con Math.random 0,9 debería ser civil")
        fam, case = _case_of(role["w"], "english")
        rel = {_word(x, "english") for x in case["rel"]}
        fam_words = {_word(x, "english") for c in DATA["impostor"][fam]["cases"] for x in c["rel"]}
        page.locator("#pt-go").click()
        stage_seen = False
        for rr in range(3):
            if not stage_seen:
                page.wait_for_selector(".pt-bub .pt-say", timeout=10000)
                s = page.evaluate("() => ({w: document.querySelector('.pt-bub .pt-w').textContent, lang: document.querySelector('.pt-bub .pt-w').lang, ipa: !!document.querySelector('.pt-bub .ipa[lang]'), pj: document.querySelector('.pt-spk .pt-pj').getAttribute('src')})")
                if s["lang"] != "en-GB" or not s["ipa"] or s["pj"] != "img/pj/zorro.png":
                    probs.append(f"escenario: {s}")
                stage_seen = True
            page.wait_for_selector("#pt-opts .pt-op", timeout=15000)
            opts = page.evaluate("[...document.querySelectorAll('#pt-opts .pt-op')].map(b => b.querySelector('.pt-w').textContent)")
            fit = [o for o in opts if o in rel]
            if len(opts) != 3 or len(fit) != 1:
                probs.append(f"ronda {rr}: opciones {opts} (encajan {fit})")
                break
            if rr == 0:
                bad = next(i for i, o in enumerate(opts) if o not in rel)
                page.locator(f'#pt-opts .pt-op[data-k="{bad}"]').click()
                m = page.evaluate("() => ({miss: document.querySelectorAll('.pt-op.is-miss').length, dis: document.querySelectorAll('.pt-op[disabled]').length, x: getComputedStyle(document.querySelector('.pt-op.is-miss .pt-mk .ico:last-child')).display})")
                if m != {"miss": 1, "dis": 1, "x": "block"}:
                    probs.append(f"fallar: {m}")
            page.locator(f'#pt-opts .pt-op[data-k="{opts.index(fit[0])}"]').click()
            if page.locator(".pt-op.is-ok").count() != 1:
                probs.append("acertar no pone la palabra en verde")
            page.wait_for_selector("#pt-opts", state="detached", timeout=5000)
        page.wait_for_selector(".pt-row.is-vote", timeout=15000)
        t = page.evaluate("""() => [...document.querySelectorAll('.pt-row')].map(r => ({k: r.dataset.k, pj: (r.querySelector('.pt-pj') || {getAttribute: () => ''}).getAttribute('src'),
          words: [...r.querySelectorAll('.pt-cw span')].map(s => s.textContent)}))""")
        said = _said(page)
        chars = [r for r in t if r["k"] != "me"]
        if len(chars) != 3 or chars[0]["pj"] != "img/pj/zorro.png" or any(len(r["words"]) != 3 for r in t):
            probs.append(f"mesa: {t}")
        imps = [r for r in chars if not set(r["words"]) <= rel]
        if len(imps) != 1 or imps[0]["k"] == "0" or not set(imps[0]["words"]) <= fam_words or set(imps[0]["words"]) & rel:
            probs.append(f"el impostor de la app: {imps} (relacionadas {sorted(rel)})")
        if not all(w in said for r in chars for w in r["words"]):
            probs.append(f"no suenan todas las palabras: {said}")
        if imps:
            page.locator(f'.pt-row[data-k="{imps[0]["k"]}"]').click()
            page.wait_for_selector("#pt-end")
            if "Lo pillaste" not in page.locator("#pt-stage .pt-big").text_content() or page.locator(".pt-row.is-imp .pt-cw.is-miss").count() != 3:
                probs.append(f"al pillarlo: {page.locator('#pt-stage').inner_text()}")
            page.locator("#pt-end").click()
            page.wait_for_selector("#gm-end")
            b = _best(page, "impostor")
            if not b or (b["stars"], b["score"]) != (3, 5):   # pillado (3 puntos) + 2 a la primera (★★★)
                probs.append(f"récord del modo solo: {b}")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_impostor_solo_child_is_impostor():
    """Solo, el impostor eres tú: «¡Eres el impostor!» con la pista de la familia; el zorro y un amigo dicen palabras de
    la secreta; en tu turno eliges entre 3 (sin verde ni gris hasta el final); «Los demás votan…»; con 3 que encajan no te
    pillan; adivinar entre 4 dibujos; acertar: ★★★ y 6 puntos."""
    probs = []
    page = _page(360, 740, reduced_motion="reduce")
    try:
        _seed(page)
        _solo(page, 0.1)
        role = page.evaluate("() => ({imp: !!document.querySelector('.pt-imp'), w: document.querySelector('.pt-role .pt-w').textContent})")
        if not role["imp"]:
            probs.append("con Math.random 0,1 deberías ser el impostor")
        hints = {_word(F["hint"], "english"): fam for fam, F in DATA["impostor"].items()}
        if role["w"] not in hints:
            probs.append(f"la pista {role['w']} no es de una familia")
        # la palabra secreta: la última que apunta "party:st" (para no repetirla)
        secret = page.evaluate("JSON.parse(localStorage.getItem('party:st')).imp.slice(-1)[0]")
        fam, case = next(((f, c) for f, F in DATA["impostor"].items() for c in F["cases"] if c["w"] == secret), (None, None))
        rel = {_word(x, "english") for x in case["rel"]} if case else set()
        if hints.get(role["w"]) != fam:
            probs.append(f"la pista {role['w']} no es la de la familia de {secret}")
        page.locator("#pt-go").click()
        for rr in range(3):
            page.wait_for_selector("#pt-opts .pt-op", timeout=15000)
            spoken = page.evaluate("[...document.querySelectorAll('.pt-row:not([data-k=me]) .pt-cw span')].map(s => s.textContent)")
            opts = page.evaluate("[...document.querySelectorAll('#pt-opts .pt-op')].map(b => b.querySelector('.pt-w').textContent)")
            fit = [o for o in opts if o in rel]
            if not set(spoken) <= rel or len(spoken) != 2 * (rr + 1) or len(fit) != 1:
                probs.append(f"ronda {rr}: dichas {spoken}, opciones {opts}")
                break
            page.locator(f'#pt-opts .pt-op[data-k="{opts.index(fit[0])}"]').click()
            if page.locator(".pt-op.is-ok, .pt-op.is-miss").count() or page.locator(".pt-op.is-said").count() != 1:
                probs.append("el impostor ve si acierta antes del final")
            page.wait_for_selector("#pt-opts:not(.pt-4)", state="detached", timeout=5000)
        if len([r for r in page.evaluate("[...document.querySelectorAll('.pt-row')].map(r => r.dataset.k)")]) != 3:
            probs.append("con el niño de impostor tienen que ser el zorro, un amigo y tú")
        page.wait_for_selector("#pt-opts.pt-4 .pt-op", timeout=10000)
        r = page.evaluate("() => ({big: document.querySelector('#pt-stage .pt-big').textContent, ok: document.querySelectorAll('.pt-row[data-k=me] .pt-cw.is-ok').length})")
        if r != {"big": "¡No te pillaron!", "ok": 3}:
            probs.append(f"votación: {r}")
        opts = page.evaluate("[...document.querySelectorAll('#pt-opts .pt-op')].map(b => b.querySelector('.pt-w').textContent)")
        pics = page.evaluate("[...document.querySelectorAll('#pt-opts .pt-op .pt-opi img')].map(i => Math.round(i.parentNode.getBoundingClientRect().width))")
        if _word(secret, "english") not in opts or len(pics) != 4 or min(pics) < 120:
            probs.append(f"adivinar: {opts} {pics}")
        else:
            page.locator(f'#pt-opts .pt-op[data-k="{opts.index(_word(secret, "english"))}"]').click()
            page.locator("#pt-end").click()
            page.wait_for_selector("#gm-end")
            b = _best(page, "impostor")
            if not b or (b["stars"], b["score"]) != (3, 6):
                probs.append(f"récord: {b}")
        if _hscroll(page):
            probs.append("scroll horizontal a 360")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ------------------------------------------------------------------------------------------------ ordenar
def _sort_state(page, lang):
    """{baskets: [nombre], word, groupOf: índice de la cesta de la palabra}."""
    r = page.evaluate("""() => ({bk: [...document.querySelectorAll('.pt-bk .pt-w')].map(e => e.textContent), w: (document.querySelector('#pt-wc .pt-w') || {}).textContent || ''})""")
    gids = []
    for name in r["bk"]:
        g = next((gid for gid, g in DATA["sort"]["groups"].items() if g["n"][lang][0] == name), None)
        gids.append(g)
    gi = next((i for i, g in enumerate(gids) if g and any(_word(x, lang) == r["w"] for x in DATA["sort"]["groups"][g]["w"])), None)
    return r["bk"], gids, r["w"], gi


def test_sort_tap_drag_misses_and_prize():
    """Ordenar: 2 cestas con 5 o 3 con 4 (de los juegos de data/party.json), cada una con su dibujo, su nombre en inglés
    con IPA y su altavoz; los nombres suenan al empezar. La palabra (dibujo ≥ 120 px a 390 y 360, IPA) suena al salir y al
    tocarla. Tocar la palabra y luego la cesta buena la mete (punto verde, contador); la mala, en gris con ✗; al segundo
    fallo la buena se ilumina. También se arrastra. Al acabar, estrellas por fallos, récord «N a la primera» y monedas."""
    probs = []
    for w, h in ((390, 844), (360, 740)):
        page = _page(w, h)
        try:
            _seed(page)
            _go(page, "#/juegos/ordenar")
            page.wait_for_timeout(300)
            bk, gids, word, gi = _sort_state(page, "english")
            n = page.locator("#gm-dots i").count()
            if None in gids or gids not in DATA["sort"]["sets"] or n != (12 if len(bk) == 3 else 10) or gi is None:
                probs.append(f"{w}: cestas {bk} {gids}, {n} palabras, «{word}» en {gi}")
                continue
            b = page.evaluate("""() => [...document.querySelectorAll('.pt-bk')].map(b => ({img: !!b.querySelector('.pt-bkp img'), ipa: !!b.querySelector('.ipa[lang=en-GB]'),
              say: !!b.parentNode.querySelector('.pt-bk-say')}))""")
            if not all(x["img"] and x["ipa"] and x["say"] for x in b):
                probs.append(f"{w}: cestas sin dibujo, IPA o altavoz: {b}")
            pic = _box(page, "#pt-wc .pt-pic")
            if not pic or pic["w"] < 120:
                probs.append(f"{w}: el dibujo de la palabra mide {pic}")
            bkb = page.evaluate("[...document.querySelectorAll('.pt-bk')].map(b => b.getBoundingClientRect().bottom)")
            if max(bkb) > h or _hscroll(page):
                probs.append(f"{w}: las cestas no caben: {bkb} (alto {h})")
            said = _said(page)
            if not all(x in said for x in bk) or word not in said:
                probs.append(f"{w}: no suenan las cestas o la palabra: {said}")
            # tocar la palabra y una cesta mala dos veces: gris con ✗ y luego la buena iluminada
            page.locator("#pt-wc").click()
            if not page.locator("#pt-wc.is-sel").count():
                probs.append(f"{w}: tocar la palabra no la levanta")
            bad = (gi + 1) % len(bk)
            page.locator(f'.pt-bk[data-g="{bad}"]').click()
            m = page.evaluate("() => ({miss: document.querySelectorAll('.pt-bk.is-miss').length, n: document.getElementById('pt-n').textContent, x: getComputedStyle(document.querySelector('.pt-bk.is-miss .pt-mk .ico:last-child')).display})")
            if m != {"miss": 1, "n": "0", "x": "block"}:
                probs.append(f"{w}: fallar: {m}")
            page.locator(f'.pt-bk[data-g="{bad}"]').click()
            if page.locator(f'.pt-bk[data-g="{gi}"].is-hint').count() != 1:
                probs.append(f"{w}: al segundo fallo no se ilumina la buena")
            page.locator(f'.pt-bk[data-g="{gi}"]').click()
            page.wait_for_timeout(900)
            if page.locator("#pt-n").text_content() != "1" or page.locator("#gm-dots i.meh").count() != 1:
                probs.append(f"{w}: tras acertar: {page.locator('#pt-n').text_content()}")
            # arrastrar la siguiente
            bk, gids, word, gi = _sort_state(page, "english")
            c, t = _box(page, "#pt-wc"), _box(page, f'.pt-bk[data-g="{gi}"]')
            page.mouse.move(c["left"] + c["w"] / 2, c["top"] + c["h"] / 2)
            page.mouse.down()
            for k in range(1, 9):
                page.mouse.move(c["left"] + c["w"] / 2 + (t["left"] + t["w"] / 2 - c["left"] - c["w"] / 2) * k / 8,
                                c["top"] + c["h"] / 2 + (t["top"] + t["h"] / 2 - c["top"] - c["h"] / 2) * k / 8)
                page.wait_for_timeout(16)
            page.mouse.up()
            page.wait_for_timeout(900)
            if page.locator("#pt-n").text_content() != "2" or page.locator("#gm-dots i.ok").count() != 1:
                probs.append(f"{w}: arrastrar no la mete: {page.locator('#pt-n').text_content()}")
            if word not in _said(page):
                probs.append(f"{w}: «{word}» no sonó")
            c0 = _coins(page)
            for _ in range(n - 2):
                bk, gids, word, gi = _sort_state(page, "english")
                page.locator("#pt-wc").click()
                page.locator(f'.pt-bk[data-g="{gi}"]').click()
                page.wait_for_timeout(750)
            page.wait_for_selector("#gm-end", timeout=5000)
            page.wait_for_timeout(700)
            bb = _best(page, "ordenar")
            # 2 fallos → ★★; n - 1 a la primera
            if not bb or (bb["stars"], bb["score"]) != (2, n - 1) or page.locator(".gm-es.on").count() != 2:
                probs.append(f"{w}: récord {bb}")
            if _coins(page) - c0 not in (10, 20):
                probs.append(f"{w}: monedas {c0} → {_coins(page)}")
            if page.locator(".gm-wc").count() != min(n, 10):
                probs.append(f"{w}: palabras del final: {page.locator('.gm-wc').count()}")
            C.goto(page, "#/juegos")
            rec = page.locator('.gm-card[data-g="ordenar"] .gm-rt').text_content()
            if rec != f"{n - 1} a la primera":
                probs.append(f"{w}: récord en la tarjeta: {rec}")
            if C.errors(page):
                probs.append(f"{w}: errores: {C.errors(page)}")
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_both_games_in_french_and_danish():
    """En francés y en danés: las cestas, la palabra y el papel van en ese idioma (lang fr-FR / da-DK, con IPA), sin
    errores ni scroll horizontal; el modo solo también (el escenario con la palabra del personaje en ese idioma)."""
    probs = []
    page = _page(360, 740, reduced_motion="reduce")
    try:
        for lang in ("français", "dansk"):
            _seed(page, lang)
            _go(page, "#/juegos/ordenar")
            bk, gids, word, gi = _sort_state(page, lang)
            r = page.evaluate("() => ({wl: document.querySelector('#pt-wc .pt-w').lang, bl: [...document.querySelectorAll('.pt-bk .pt-w')].map(e => e.lang), ipa: document.querySelectorAll('.pt-bk .ipa, #pt-wc .ipa').length})")
            if None in gids or gi is None or r["wl"] != CODE[lang] or set(r["bl"]) != {CODE[lang]} or r["ipa"] != len(bk) + 1:
                probs.append(f"{lang}: ordenar {bk} {gids} «{word}» {r}")
            _solo(page, 0.9)
            r = page.evaluate("() => ({w: document.querySelector('.pt-role .pt-w').textContent, l: document.querySelector('.pt-role .pt-w').lang, es: document.querySelector('.pt-role .pt-es b').textContent})")
            fam, case = _case_of(r["w"], lang)
            if not case or r["l"] != CODE[lang] or r["es"] != DATA["words"][case["w"]]["es"]:
                probs.append(f"{lang}: papel {r}")
            page.locator("#pt-go").click()
            page.wait_for_selector(".pt-bub .pt-say", timeout=10000)
            s = page.evaluate("() => ({l: document.querySelector('.pt-bub .pt-w').lang, ipa: !!document.querySelector('.pt-bub .ipa')})")
            if s != {"l": CODE[lang], "ipa": True}:
                probs.append(f"{lang}: escenario {s}")
            if _hscroll(page):
                probs.append(f"{lang}: scroll horizontal")
        if C.errors(page):
            probs.append(f"errores: {C.errors(page)}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_captures():
    """Capturas en capturas/juegos-grupo (móvil a 390 y 360): las tarjetas en Jugar, los modos, el papel del civil y el del
    impostor, una ronda, el modo solo y Ordenar (y Ordenar en oscuro)."""
    for w, h in ((390, 844), (360, 740)):
        page = _page(w, h, reduced_motion="reduce")
        try:
            _seed(page)
            page.wait_for_selector(".gm-card[data-g=ordenar]")
            page.locator(".gm-card[data-g=impostor]").scroll_into_view_if_needed()
            C.shot(page, f"{w}-jugar-tarjetas", OUT, full_page=False)
            _go(page, "#/juegos/impostor")
            C.shot(page, f"{w}-impostor-modos", OUT, full_page=False)
            page.locator(".pt-mode[data-m=grupo]").click()
            _names(page, ["Ana", "Leo", "Mía", "Teo"])
            C.shot(page, f"{w}-impostor-nombres", OUT, full_page=False)
            page.locator("#pt-go").click()
            for i in range(4):
                page.locator(f'.pt-pl[data-i="{i}"]').click()
                page.locator("#pt-see").click()
                page.wait_for_selector(".pt-role")
                kind = "impostor" if page.locator(".pt-imp").count() else "civil"
                C.shot(page, f"{w}-impostor-papel-{kind}", OUT, full_page=False)
                page.locator("#pt-hide").click()
            page.locator("#pt-go").click()
            page.wait_for_selector("#pt-next")
            C.shot(page, f"{w}-impostor-ronda", OUT, full_page=False)
            _solo(page, 0.9)
            page.locator("#pt-go").click()
            page.wait_for_selector(".pt-bub .pt-say")
            C.shot(page, f"{w}-impostor-solo-habla", OUT, full_page=False)
            page.wait_for_selector("#pt-opts .pt-op", timeout=15000)
            C.shot(page, f"{w}-impostor-solo-turno", OUT, full_page=False)
            _go(page, "#/juegos/ordenar")
            page.wait_for_timeout(300)
            C.shot(page, f"{w}-ordenar", OUT, full_page=False)
            bk, gids, word, gi = _sort_state(page, "english")
            page.locator("#pt-wc").click()
            page.locator(f'.pt-bk[data-g="{(gi + 1) % len(bk)}"]').click()
            C.shot(page, f"{w}-ordenar-fallo", OUT, full_page=False)
        finally:
            page.context.close()
    page = _page(390, 844, color_scheme="dark", reduced_motion="reduce")
    try:
        _seed(page)
        _go(page, "#/juegos/ordenar")
        page.wait_for_timeout(300)
        C.shot(page, "390-ordenar-oscuro", OUT, full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
