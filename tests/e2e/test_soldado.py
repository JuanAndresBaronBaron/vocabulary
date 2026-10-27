"""El soldado con rangos y el juego «Misión por radio» (js/army.js, data/army/{en,fr,da}.json).

- Personaje: "soldado" es un personaje "hero" de la tienda (data/game.json, data/sprites.json) que se compra y se
  elige como los demás en Premios › Mi zorro › Personajes. Su dibujo sale del idioma elegido (US Army, Légion étrangère
  con képi blanc, Hæren) y de su rango: 13 rangos, el primero al empezar A1 y uno más por cada mitad de nivel MCER hecha
  en el camino de ese idioma, hasta General con todo C2.
- Mi zorro, con el soldado puesto: el rango en el idioma con su IPA a la vista, su altavoz y su significado; «Ver
  rangos» abre la escalera. Al subir: «¡Ascendido a …!» una vez por rango y por idioma ("army:<lang>" en js/save.js).
- Juego: tarjeta en Jugar, 8 órdenes por radio, 4 tarjetas con dibujo grande; monedas con award() desde «+N».
Capturas en capturas/soldado (móvil 390 y 360)."""
from __future__ import annotations

import json
import re

import common as C

OUT = C.CAPTURAS / "soldado"
AB = {"english": "en", "français": "fr", "dansk": "da"}
ARMY = {"english": "us", "français": "fr", "dansk": "dk"}
DATA = {L: json.loads((C.ROOT / "data" / "army" / f"{ab}.json").read_text(encoding="utf-8")) for L, ab in AB.items()}
IPA_RE = re.compile(r"^/[^/\s][^/]*/$")
BAD = re.compile(r"\b(gun|rifle|weapon|kill|shoot|bomb|grenade|war|fusil|arme|tuer|guerre|bombe|våben|gevær|dræb|krig|bombe|"
                 r"pistol|bullet|balle|kugle|attack|attaque|angreb|stupid|idiot|damn|merde|pis)\b", re.I)

# ganchos: lo que se dice, award, el bus de monedas y los sonidos; audio grabado que acaba enseguida
_HOOKS = """() => {
  if (window.__ar) return; window.__ar = true;
  window.__said = []; window.__aw = []; window.__coins = []; window.__sfx = [];
  HTMLMediaElement.prototype.play = function () { const a = this; setTimeout(() => a.dispatchEvent(new Event('ended')), 30); return Promise.resolve(); };
  const s0 = window.say; window.say = (t, b, slow) => { __said.push(t); return s0(t, b, slow); };
  const a0 = window.award;
  window.award = (...x) => { __aw.push({n: x[0], why: x[1], from: (x[3] && x[3].id) || null}); return a0(...x); };
  bus.on('coins', d => __coins.push({n: d.n, fly: !!d.fly}));
  if (typeof sfx !== 'undefined') { const p0 = sfx.play.bind(sfx); sfx.play = (n, ...x) => { __sfx.push(n); return p0(n, ...x); }; }
}"""
_NO_HINT = """() => { let o = {}; try { o = JSON.parse(localStorage.getItem('vocab:ui') || '{}') || {}; } catch (e) {}
  o.hints = Object.assign({}, o.hints, {'gm-peek': 1000}); localStorage.setItem('vocab:ui', JSON.stringify(o)); }"""
# las lecciones de cada nivel del idioma actual (con la gramática intercalada), como las cuenta el camino
_LESSONS = """async () => { await getMap(); return Object.fromEntries(Object.keys(LVS).map(lv => [lv, lvLessons(lv).map(l => l.id)])); }"""


def _keys(lang="english", own=True, wear=True, seen=None, maps=None, coins=None):
    """La partida sembrada con el soldado (comprado y puesto si se pide), el idioma, el rango visto y el camino."""
    k = C.seed_data()
    g = k["game"]
    if own:
        g["owned"]["soldado"] = True
    if wear:
        g["wear"]["hero"] = "soldado"
    if coins is not None:
        g["coins"] = coins
    k["lang"] = lang
    k["games:topic"] = "militar"   # «Misión por radio» solo sale en Juegos con el tema «Soldados»
    for L, v in (seen or {}).items():
        k["army:" + L] = v
    for L, v in (maps or {}).items():
        k["map:" + L] = v
    return {kk: json.dumps(vv, ensure_ascii=False) for kk, vv in k.items()}


def _map_for(lessons, steps):
    """El camino con `steps` mitades de nivel hechas (0 = nada, 12 = todo C2)."""
    out = {}
    for i, lv in enumerate(["A1", "A2", "B1", "B2", "C1", "C2"]):
        ls = lessons[lv]
        k = max(0, min(2, steps - 2 * i))
        n = len(ls) if k == 2 else (len(ls) + 1) // 2 if k == 1 else 0
        for lid in ls[:n]:
            out[lid] = 3
    return out


def _lessons(page):
    return page.evaluate(_LESSONS)


def _hero_src(page, sel="#mz-fox img.pj"):
    return page.evaluate(f"() => {{ const i = document.querySelector('{sel}'); return i ? i.getAttribute('src') : null; }}")


def _army_of(src):
    m = re.search(r"data-army%3D%22([a-z]{2})-(\d+)%22", src or "") or re.search(r'data-army="([a-z]{2})-(\d+)"', src or "")
    return (m.group(1), int(m.group(2))) if m else None


def _rank_now(page):
    return page.evaluate("async () => { await vocabArmy.refresh(); return vocabArmy.rank(); }")


# ---------------------------------------------------------------- datos
def test_data_ranks_terms_and_wiring():
    """data/army/<ab>.json: 13 rangos con palabra, IPA entre barras, plural, significado, insignia y ejemplo con
    traducción (francés y danés con su género); términos de radio, órdenes (5), campamento (≥10) y el alfabeto OTAN
    entero y en orden; cada dibujo existe; ninguna palabra de armas, violencia o grosera; cada fuente citada existe.
    El soldado está en la tienda y en sprites.json; js/army.js, los datos y la tarjeta van en SHELL y OFF_APP;
    "army:" está en PER_LANG de js/save.js; img/pj/soldado.png existe para «Descargar todo»."""
    probs = []
    nato = ["Alfa", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliett", "Kilo", "Lima", "Mike",
            "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey", "X-ray", "Yankee", "Zulu"]
    for L, d in DATA.items():
        if d.get("lang") != L:
            probs.append(f"{L}: lang {d.get('lang')!r}")
        src = d.get("sources") or {}
        rs = d.get("ranks") or []
        if len(rs) != 13:
            probs.append(f"{L}: {len(rs)} rangos")
        for i, r in enumerate(rs):
            for f in ("w", "ipa", "pl", "es", "ins", "ex", "exEs", "src"):
                if not r.get(f):
                    probs.append(f"{L} rango {i}: falta {f}")
            if r.get("ipa") and not IPA_RE.match(r["ipa"]):
                probs.append(f"{L} rango {i}: IPA {r['ipa']!r}")
            if L != "english" and not r.get("g"):
                probs.append(f"{L} rango {i}: sin género")
            if r.get("src") not in src:
                probs.append(f"{L} rango {i}: fuente {r.get('src')!r} sin citar")
        if not re.search(r"g[eé]n[eé]ral", rs[-1]["w"].lower()):
            probs.append(f"{L}: el último rango no es general: {rs[-1]['w']}")
        ts = d.get("terms") or []
        cats = {}
        for t in ts:
            cats.setdefault(t["cat"], []).append(t)
            for f in ("w", "ipa", "es", "ex", "exEs", "src"):
                if not t.get(f):
                    probs.append(f"{L} {t.get('id')}: falta {f}")
            if t.get("ipa") and not IPA_RE.match(t["ipa"]):
                probs.append(f"{L} {t['id']}: IPA {t['ipa']!r}")
            if t.get("src") not in src:
                probs.append(f"{L} {t['id']}: fuente {t.get('src')!r} sin citar")
            if t["cat"] == "alfabeto":
                if not re.fullmatch(r"[A-Z]", t.get("letter") or ""):
                    probs.append(f"{L} {t['id']}: letra {t.get('letter')!r}")
            elif not t.get("img") or not (C.ROOT / t["img"]).is_file():
                probs.append(f"{L} {t['id']}: dibujo {t.get('img')!r} no existe")
            if L == "français" and t["cat"] == "campamento" and t.get("g") not in ("m", "f"):
                probs.append(f"{L} {t['id']}: género {t.get('g')!r}")
            if L == "dansk" and t["cat"] == "campamento" and t.get("g") not in ("en", "et"):
                probs.append(f"{L} {t['id']}: género {t.get('g')!r}")
            for f in ("w", "es", "ex", "exEs"):
                if BAD.search(t.get(f) or ""):
                    probs.append(f"{L} {t['id']}: palabra no apta en {f}: {t[f]!r}")
        if len(cats.get("radio", [])) < 5 or len(cats.get("ordenes", [])) != 5 or len(cats.get("campamento", [])) < 10:
            probs.append(f"{L}: categorías {[(k, len(v)) for k, v in cats.items()]}")
        if [t["w"] for t in cats.get("alfabeto", [])] != nato:
            probs.append(f"{L}: alfabeto OTAN {[t['w'] for t in cats.get('alfabeto', [])]}")
        ids = {t["id"] for t in cats.get("ordenes", [])}
        if ids != {"att", "ease", "salute", "march", "halt"}:
            probs.append(f"{L}: órdenes {ids}")
        for r in rs:
            for f in ("w", "es", "ex", "exEs"):
                if BAD.search(r.get(f) or ""):
                    probs.append(f"{L} rango {r['w']}: palabra no apta en {f}")
    en = DATA["english"]
    for i in (7, 8):
        if "luːˈtenənt" not in (en["ranks"][i].get("note") or ""):
            probs.append(f"lieutenant sin la nota de EE. UU.: {en['ranks'][i]}")
    if "lefˈtenənt" not in en["ranks"][7]["ipa"]:
        probs.append(f"IPA británica de lieutenant: {en['ranks'][7]['ipa']}")
    shop = {x["id"]: x for x in json.loads((C.ROOT / "data" / "game.json").read_text(encoding="utf-8"))}
    s = shop.get("soldado")
    if not s or s["t"] != "hero" or not all(s["w"].get(L) for L in AB):
        probs.append(f"tienda: {s}")
    spr = json.loads((C.ROOT / "data" / "sprites.json").read_text(encoding="utf-8")).get("soldado")
    if not spr or not spr.get("head") or spr.get("w") != 200 or spr.get("h") != 260:
        probs.append(f"sprites.json: {spr}")
    for f in ("img/pj/soldado.png", "img/games/soldados.png", "img/army/at-ease.svg", "img/army/binoculars.svg", "img/army/canteen.svg"):
        if not (C.ROOT / f).is_file():
            probs.append(f"falta {f}")
    html = (C.ROOT / "index.html").read_text(encoding="utf-8")
    sw = (C.ROOT / "sw.js").read_text(encoding="utf-8")
    off = re.search(r"const OFF_APP = \[(.*?)\];", html, re.S).group(1)
    shell = re.search(r"const SHELL = \[(.*?)\];", sw, re.S).group(1)
    for f in ("js/army.js", "data/army/en.json", "data/army/fr.json", "data/army/da.json", "img/games/soldados.png"):
        if f'"{f}"' not in off:
            probs.append(f"OFF_APP no lleva {f}")
        if f'"{f}"' not in shell:
            probs.append(f"SHELL no lleva {f}")
    if not re.search(r'<script src="js/army\.js\?v=\d+"></script>', html):
        probs.append("index.html no carga js/army.js")
    if '"army:": "*"' not in (C.ROOT / "js" / "save.js").read_text(encoding="utf-8"):
        probs.append("save.js: falta army: en PER_LANG")
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- rango
def test_rank_follows_lessons_two_per_level():
    """El rango sale del camino del idioma: 0 al empezar, +1 con la mitad de cada nivel y +1 al acabarlo; 12 (General)
    con todo C2. La partida sembrada (10 lecciones de A1) es el rango 0 y «Te faltan N lecciones de A1». Cada idioma
    cuenta su propio camino. Con un rango puesto, el dibujo y la insignia cambian (data-army)."""
    probs = []
    page = C.new_page("desk")
    try:
        C.seed(page, _keys("english", seen={"english": 0}), "#/mizorro")
        les = _lessons(page)
        if _rank_now(page) != 0:
            probs.append(f"partida sembrada: rango {_rank_now(page)}")
        nx = page.evaluate("() => vocabArmy.info().next")
        a1 = len(les["A1"])
        done = page.evaluate("() => Object.keys(JSON.parse(localStorage.getItem('map:english'))).filter(k => k.startsWith('A1-') || k.startsWith('G-A1-')).length")
        if not nx or nx["lv"] != "A1" or nx["need"] != (a1 + 1) // 2 - done:
            probs.append(f"siguiente: {nx} (A1 {a1}, hechas {done})")
        got = []
        for steps in range(13):
            page.evaluate("m => localStorage.setItem('map:english', JSON.stringify(m))", _map_for(les, steps))
            got.append(_rank_now(page))
        if got != list(range(13)):
            probs.append(f"rangos por mitades de nivel: {got}")
        # una lección menos que la mitad de A1 no asciende
        m = _map_for(les, 1)
        m.pop(sorted(m, key=lambda x: les["A1"].index(x))[-1])
        page.evaluate("m => localStorage.setItem('map:english', JSON.stringify(m))", m)
        if _rank_now(page) != 0:
            probs.append("una lección menos que la mitad de A1 ya asciende")
        if page.evaluate("() => vocabArmy.info().next.need") != 1:
            probs.append(f"falta 1: {page.evaluate('() => vocabArmy.info().next')}")
        # el francés cuenta su camino (el sembrado es poco), no el del inglés
        page.evaluate("m => localStorage.setItem('map:english', JSON.stringify(m))", _map_for(les, 12))
        page.evaluate("() => setLang('français')")
        page.wait_for_timeout(600)
        if _rank_now(page) != 0:
            probs.append(f"francés con el camino del inglés: {_rank_now(page)}")
        page.evaluate("() => setLang('english')")
        page.wait_for_timeout(600)
        if _rank_now(page) != 12 or page.evaluate("() => vocabArmy.info().next") is not None:
            probs.append(f"inglés con todo: {_rank_now(page)}")
        a = _army_of(_hero_src(page))
        if a != ("us", 12):
            probs.append(f"el dibujo no es el del general: {a}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- personaje
def test_uniform_by_language_and_big_on_phone():
    """Con el soldado puesto, Mi zorro, Hoy y la pieza de Personajes lo pintan con el uniforme del idioma: us (inglés),
    fr (francés, képi blanc mientras es legionario o cabo) y dk (danés). En el móvil (390 y 360) el soldado de Mi zorro
    mide ≥ 120 px de alto. Sin el soldado, la pieza dice «Conseguir · 200» y se compra como los demás."""
    probs = []
    for w in (390, 360):
        page = C.new_page("phone", viewport={"width": w, "height": 780 if w == 360 else 844})
        try:
            C.seed(page, _keys("english", seen={"english": 0}), "#/mizorro")
            for L in ("english", "français", "dansk"):
                page.evaluate("L => setLang(L)", L)
                page.wait_for_timeout(500)
                C.goto(page, "#/mizorro")
                page.wait_for_timeout(400)
                a = _army_of(_hero_src(page))
                if not a or a[0] != ARMY[L]:
                    probs.append(f"{w} {L}: uniforme {a}")
                svg = page.evaluate("L => vocabArmy.svg(L, 0)", L)
                if L == "français" and "#FBFAF5" not in svg:
                    probs.append("francés: sin képi blanc")
                if L == "français" and "#FBFAF5" in page.evaluate("() => vocabArmy.svg('français', 4)"):
                    probs.append("francés: el sergent sigue con el képi blanc")
                h = page.evaluate("() => { const i = document.querySelector('#mz-fox img.pj'); return i ? i.getBoundingClientRect().height : 0; }")
                if h < 120:
                    probs.append(f"{w} {L}: el soldado mide {h:.0f} px")
                if w == 390 or L == "français":
                    C.shot(page, f"mizorro-{AB[L]}-{w}", OUT, full_page=False)
            page.evaluate("() => setLang('english')")
            C.goto(page, "#/")
            if not _army_of(_hero_src(page, "#hm-fox img.pj")):
                probs.append(f"{w}: Hoy no pinta al soldado")
            probs += C.errors(page)
        finally:
            page.context.close()
    # comprarlo en Personajes
    page = C.new_page("phone")
    try:
        C.seed(page, _keys("français", own=False, wear=False, coins=245), "#/mizorro")
        page.evaluate("() => sessionStorage.setItem('vocab:mz-tab', 'hero')")
        C.goto(page, "#/mizorro")
        card = page.locator('#mz-shop .sc[data-id="soldado"]')
        card.scroll_into_view_if_needed()
        info = page.evaluate("""() => { const c = document.querySelector('#mz-shop .sc[data-id="soldado"]'), i = c.querySelector('img.pj');
          return {buy: (c.querySelector('[data-buy]') || {}).textContent, src: i && i.getAttribute('src'), w: c.querySelector('.shp-w').textContent}; }""")
        if not info["buy"] or "200" not in info["buy"] or _army_of(info["src"]) != ("fr", 0) or info["w"] != "le légionnaire":
            probs.append(f"pieza del soldado: {info['buy']!r}, {_army_of(info['src'])}, {info['w']!r}")
        C.shot(page, "personajes-fr-390", OUT, full_page=False)
        card.locator("[data-buy]").click()
        page.wait_for_timeout(900)
        g = page.evaluate("() => JSON.parse(localStorage.getItem('game'))")
        if not g["owned"].get("soldado") or g["wear"].get("hero") != "soldado" or g["coins"] != 45:
            probs.append(f"compra: {g['owned'].get('soldado')}, {g['wear']}, {g['coins']}")
        # al comprarlo se apunta el rango de ahora, sin fiesta
        page.wait_for_timeout(500)
        if page.evaluate("() => localStorage.getItem('army:français')") != "0" or page.locator("dialog#ar-up[open]").count():
            probs.append(f"tras comprar: army:français {page.evaluate('() => localStorage.getItem(\"army:français\")')!r}")
        if not page.locator("#mz-hero .ar-box .ar-w, .mz-hero .ar-box .ar-w").count():
            probs.append("tras comprar no sale el rango en Mi zorro")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_rank_card_ipa_audio_meaning_and_ladder():
    """Mi zorro con el soldado: el rango en el idioma (b[lang]), su IPA visible, un altavoz de 44 px que lo dice y su
    significado en español; «Ver rangos» abre la escalera con los 13, el actual marcado (aria-current) y la IPA de cada
    uno; en inglés, los lieutenant llevan la nota de EE. UU. Con otro personaje, nada de esto."""
    probs = []
    page = C.new_page("phone")
    try:
        les = None
        C.seed(page, _keys("english", seen={"english": 3}), "#/mizorro")
        les = _lessons(page)
        page.evaluate("m => localStorage.setItem('map:english', JSON.stringify(m))", _map_for(les, 3))
        C.goto(page, "#/mizorro", reload=True)
        page.evaluate(_HOOKS)
        page.wait_for_selector(".mz-hero .ar-box .ar-w", timeout=5000)
        m = page.evaluate("""() => { const b = document.querySelector('.mz-hero .ar-box'), w = b.querySelector('.ar-w'), s = b.querySelector('.ar-spk'),
          ip = b.querySelector('.ipa'), r = s.getBoundingClientRect();
          return {w: w.textContent, lang: w.getAttribute('lang'), ipa: ip && ip.textContent, ipaVis: !!ip && getComputedStyle(ip).display !== 'none' && ip.getBoundingClientRect().height > 0,
            es: b.querySelector('.ar-es').textContent, say: s.dataset.say, sw: r.width, sh: r.height, next: (b.querySelector('.ar-next') || {}).textContent}; }""")
        rk = DATA["english"]["ranks"][3]
        if m["w"] != rk["w"] or m["lang"] != "en-GB" or rk["ipa"].strip("/") not in (m["ipa"] or "").replace("⁠", "") or not m["ipaVis"] or m["es"] != rk["es"]:
            probs.append(f"tarjeta del rango: {m}")
        if m["sw"] < 44 or m["sh"] < 44:
            probs.append(f"altavoz de {m['sw']}×{m['sh']}")
        if "A2" not in (m["next"] or ""):
            probs.append(f"lo que falta: {m['next']!r}")
        page.locator(".mz-hero .ar-box .ar-spk").click()
        page.wait_for_timeout(200)
        if "sergeant" not in page.evaluate("() => __said"):
            probs.append(f"el altavoz no dice el rango: {page.evaluate('() => __said')}")
        C.shot(page, "mizorro-rango-en-390", OUT, full_page=False)
        page.locator(".mz-hero [data-ar-ladder]").click()
        page.wait_for_selector("dialog#ar-sheet[open]", timeout=4000)
        page.wait_for_timeout(500)
        lad = page.evaluate("""() => { const d = document.getElementById('ar-sheet'), li = [...d.querySelectorAll('.ar-li')];
          return {n: li.length, cur: li.findIndex(x => x.getAttribute('aria-current') === 'step'), ipa: li.filter(x => x.querySelector('.ipa')).length,
            notes: li.filter(x => /luːˈtenənt/.test((x.querySelector('.ar-note') || {}).textContent || '')).length, top: li[0].querySelector('.ar-w').textContent}; }""")
        if lad["n"] != 13 or lad["cur"] != 12 - 3 or lad["ipa"] != 13 or lad["notes"] != 2 or lad["top"] != "general":
            probs.append(f"escalera: {lad}")
        C.shot(page, "escalera-en-390", OUT, full_page=False)
        page.locator("dialog#ar-sheet [data-close]").click()
        page.wait_for_timeout(600)
        # otro personaje: sin rango
        page.evaluate("() => { const g = JSON.parse(localStorage.getItem('game')); g.wear.hero = 'zorro'; localStorage.setItem('game', JSON.stringify(g)); }")
        C.goto(page, "#/mizorro", reload=True)
        page.wait_for_timeout(600)
        if page.locator(".mz-hero .ar-box").count():
            probs.append("con el zorro sigue saliendo el rango")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_promotion_once_per_rank_and_language():
    """«¡Ascendido a …!» sale una vez al subir (con el soldado y fuera del modo foco), dice el rango y guarda
    "army:<lang>"; al recargar ya no sale. En otro idioma la primera vez se apunta sin fiesta y luego asciende en ese
    idioma. Sin el soldado no sale ni se escribe nada. En una lección (modo foco) espera a la pantalla siguiente."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page, _keys("english", seen={"english": 2}), "#/")
        les = _lessons(page)
        page.evaluate("() => localStorage.setItem('map:english', '{}')")
        C.goto(page, "#/", reload=True)
        page.evaluate(_HOOKS)
        page.evaluate("m => localStorage.setItem('map:english', JSON.stringify(m))", _map_for(les, 3))
        page.evaluate("() => vocabArmy.refresh()")
        page.wait_for_selector("dialog#ar-up[open]", timeout=5000)
        page.wait_for_timeout(900)
        up = page.evaluate("""() => { const d = document.getElementById('ar-up'); return {t: d.querySelector('#ar-up-t').textContent,
          ipa: !!d.querySelector('.ipa'), img: (d.querySelector('.ar-up-pic img') || {}).src || '', es: d.querySelector('.ar-es').textContent}; }""")
        if up["t"] != "¡Ascendido a sergeant!" or not up["ipa"] or _army_of(up["img"]) != ("us", 3) or up["es"] != "sargento":
            probs.append(f"ascenso: {up['t']!r}, ipa {up['ipa']}, {_army_of(up['img'])}, {up['es']!r}")
        if page.evaluate("() => localStorage.getItem('army:english')") != "3":
            probs.append("no guarda army:english = 3")
        if "fanfare" not in page.evaluate("() => __sfx"):
            probs.append(f"sin fanfarria: {page.evaluate('() => __sfx')}")
        if "sergeant" not in page.evaluate("() => __said"):
            probs.append(f"no dice el rango: {page.evaluate('() => __said')}")
        C.shot(page, "ascenso-en-390", OUT, full_page=False)
        page.locator("dialog#ar-up [data-close]").click()
        page.wait_for_timeout(700)
        C.goto(page, "#/", reload=True)
        page.wait_for_timeout(1500)
        if page.locator("dialog#ar-up[open]").count():
            probs.append("el mismo ascenso sale otra vez")
        # francés: la primera vez se apunta sin fiesta; luego asciende
        page.evaluate("() => setLang('français')")
        page.wait_for_timeout(1200)
        fr0 = page.evaluate("() => localStorage.getItem('army:français')")
        if page.locator("dialog#ar-up[open]").count() or fr0 is None:
            probs.append(f"francés la primera vez: diálogo {page.locator('dialog#ar-up[open]').count()}, army:français {fr0!r}")
        les_fr = _lessons(page)
        page.evaluate("m => localStorage.setItem('map:français', JSON.stringify(m))", _map_for(les_fr, 4))
        C.goto(page, "#/mizorro", reload=True)
        page.wait_for_selector("dialog#ar-up[open]", timeout=5000)
        page.wait_for_timeout(700)
        t = page.locator("#ar-up-t").text_content()
        if t != "¡Ascendido a le sergent!":
            probs.append(f"ascenso en francés: {t!r}")
        C.shot(page, "ascenso-fr-390", OUT, full_page=False)
        page.locator("dialog#ar-up [data-close]").click()
        page.wait_for_timeout(700)
        if page.evaluate("() => localStorage.getItem('army:français')") != "4" or page.evaluate("() => localStorage.getItem('army:english')") != "3":
            probs.append("cada idioma guarda su rango")
        probs += C.errors(page)
    finally:
        page.context.close()
    # sin el soldado: nada
    page = C.new_page("phone")
    try:
        keys = _keys("english", own=False, wear=False)
        C.seed(page, keys, "#/")
        les = _lessons(page)
        page.evaluate("m => localStorage.setItem('map:english', JSON.stringify(m))", _map_for(les, 5))
        C.goto(page, "#/mizorro", reload=True)
        page.wait_for_timeout(1500)
        if page.locator("dialog#ar-up[open]").count() or any(k.startswith("army:") for k in C.storage(page)):
            probs.append(f"sin soldado: diálogo o clave army: {[k for k in C.storage(page) if k.startswith('army:')]}")
        probs += C.errors(page)
    finally:
        page.context.close()
    # en una lección (modo foco) espera
    page = C.new_page("phone")
    try:
        C.seed(page, _keys("english", seen={"english": 0}), "#/")
        les = _lessons(page)
        page.evaluate("m => localStorage.setItem('map:english', JSON.stringify(m))", _map_for(les, 1))
        page.evaluate("() => { location.hash = '#/repaso'; }")
        page.wait_for_timeout(300)
        page.evaluate("() => vocabArmy.refresh()")
        page.wait_for_timeout(800)
        foc = page.evaluate("() => document.documentElement.dataset.focus || ''")
        if foc and page.locator("dialog#ar-up[open]").count():
            probs.append("el ascenso sale en mitad del modo foco")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_seeded_game_unchanged_at_boot():
    """La partida sembrada (sin el soldado) no cambia al arrancar ni al pasar por Mi zorro y el juego: ninguna clave
    army: nueva y la exportación igual."""
    probs = []
    page = C.new_page("phone")
    try:
        keys = C.seed(page, None, "#/")
        for h in ("#/mizorro", "#/juegos", "#/progreso", "#/"):
            C.goto(page, h)
            page.wait_for_timeout(300)
        st = C.storage(page)
        diff = [k for k in keys if st.get(k) != keys[k]]
        new = [k for k in st if k.startswith("army:")]
        if diff or new:
            probs.append(f"cambia {diff}; nuevas {new}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- juego
def _answer_of(L, w):
    d = DATA[L]
    for t in d["terms"]:
        if t["w"] == w:
            return f"Letra {t['letter']}" if t["cat"] == "alfabeto" else t["es"]
    for r in d["ranks"]:
        if r["w"] == w:
            return r["es"]
    return None


def _play(page, L, miss_at=()):
    """Juega las 8 órdenes; en las rondas de miss_at toca una mala primero. Devuelve lo visto en cada ronda."""
    seen = []
    for i in range(8):
        page.wait_for_function("i => document.getElementById('gm-rd') && +document.getElementById('gm-rd').textContent === i + 1 && !document.querySelector('#ar-g.ar-done')", arg=i, timeout=8000)
        r = page.evaluate("""() => ({w: document.getElementById('ar-w').textContent, ipa: (document.querySelector('#ar-ipa .ipa') || {}).textContent || '',
          cards: [...document.querySelectorAll('#ar-cards .ar-c')].map(c => { const p = c.querySelector('.ar-pic, .ar-let');
            return {l: c.querySelector('.ar-cl').textContent, pw: p.offsetWidth, ph: p.offsetHeight}; })})""")
        want = _answer_of(L, r["w"])
        labels = [c["l"] for c in r["cards"]]
        r["want"] = want
        seen.append(r)
        if want not in labels:
            raise AssertionError(f"ronda {i + 1}: «{r['w']}» → {want!r} no está en {labels}")
        k = labels.index(want)
        if i in miss_at:
            bad = next(j for j in range(len(labels)) if j != k)
            page.locator("#ar-cards .ar-c").nth(bad).click()
            page.wait_for_timeout(300)
            r["miss"] = page.evaluate("""j => { const c = document.querySelectorAll('#ar-cards .ar-c')[j], ok = document.querySelector('#ar-cards .ar-c.is-right');
              return {cls: c.className, bg: getComputedStyle(c).backgroundColor, right: !!ok, next: !!document.getElementById('ar-go'), ex: !!document.querySelector('#ar-txt .ar-ex')}; }""", bad)
            if i == miss_at[0]:
                C.shot(page, f"juego-fallo-{AB[L]}-390", OUT, full_page=False)
            page.locator("#ar-go").click()
        else:
            page.locator("#ar-cards .ar-c").nth(k).click()
            if i == 0:
                page.wait_for_timeout(250)
                C.shot(page, f"juego-acierto-{AB[L]}-390", OUT, full_page=False)
    return seen


def test_game_card_rounds_and_reward():
    """La tarjeta «Misión por radio» sale en Jugar con img/games/soldados.png; la partida: 8 órdenes con la palabra, su
    IPA y 4 tarjetas con dibujo de ≥ 120 px (390 px); fallar pone la tarjeta en gris con ✗, marca la buena y deja
    «Seguir»; al final, 2 estrellas con 6 aciertos, award una vez desde «+N» (10 monedas) y el récord en games:best. Se
    juega igual en francés y danés (alfabeto, rangos y órdenes en su idioma)."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page, _keys("english", own=False, wear=False))
        page.evaluate(_NO_HINT)
        C.goto(page, "#/juegos")
        page.evaluate(_HOOKS)
        card = page.evaluate("""() => { const c = document.querySelector('.gm-card[data-g="soldados"]'); return c && {href: c.getAttribute('href'),
          img: (c.querySelector('img') || {}).getAttribute && c.querySelector('img').getAttribute('src'), t: c.textContent}; }""")
        if not card or card["href"] != "#/juegos/soldados" or card["img"] != "img/games/soldados.png" or "Misión por radio" not in card["t"]:
            probs.append(f"tarjeta: {card}")
        C.shot(page, "jugar-tarjeta-390", OUT, full_page=True)
        page.locator('.gm-card[data-g="soldados"]').click()
        page.wait_for_function("() => document.documentElement.dataset.gmPlay === 'soldados'", timeout=8000)
        page.wait_for_timeout(300)
        if page.locator(".gm-intro .gm-go").count():
            page.locator(".gm-intro .gm-go").click()
            page.wait_for_timeout(300)
        seen = _play(page, "english", miss_at=(2, 5))
        for i, r in enumerate(seen):
            if not r["ipa"] or len(r["cards"]) != 4:
                probs.append(f"ronda {i + 1}: ipa {r['ipa']!r}, {len(r['cards'])} tarjetas")
            small = [c for c in r["cards"] if min(c["pw"], c["ph"]) < 120 and not c["l"].startswith("Letra")]
            if small:
                probs.append(f"ronda {i + 1}: dibujos pequeños {small}")
            if "miss" in r:
                mm = r["miss"]
                if "is-miss" not in mm["cls"] or not mm["right"] or not mm["next"] or not mm["ex"]:
                    probs.append(f"fallo en la ronda {i + 1}: {mm}")
                rgb = [float(x) for x in re.findall(r"[\d.]+", mm["bg"])[:3]]
                if max(rgb) - min(rgb) > 24:
                    probs.append(f"el fallo no es gris: {mm['bg']}")
        page.wait_for_selector("#gm-end", timeout=8000)
        page.wait_for_timeout(500)
        end = page.evaluate("""() => ({stars: document.querySelectorAll('.gm-end-st .gm-es.on').length, aw: __aw.slice(), words: document.querySelectorAll('.gm-wl .gm-wc').length,
          best: JSON.parse(localStorage.getItem('games:best') || '{}').soldados})""")
        if end["stars"] != 2 or len(end["aw"]) != 1 or end["aw"][0]["n"] != 10 or end["aw"][0]["from"] != "gm-plus" or end["words"] != 8:
            probs.append(f"final: {end}")
        if not end["best"] or end["best"].get("score") != 6 or end["best"].get("plays") != 1:
            probs.append(f"récord: {end['best']}")
        C.shot(page, "juego-final-en-390", OUT, full_page=False)
        if page.evaluate("() => __sfx").count("bad"):
            probs.append("sonido de fallo")
        # francés y danés
        for L in ("français", "dansk"):
            page.evaluate("L => setLang(L)", L)
            page.wait_for_timeout(400)
            C.goto(page, "#/juegos/soldados")
            page.wait_for_timeout(400)
            if page.locator(".gm-intro .gm-go").count():
                page.locator(".gm-intro .gm-go").click()
            if page.locator(".gm-ready .gm-go, #gm-ready-go").count():
                page.locator(".gm-ready .gm-go, #gm-ready-go").first.click()
            page.wait_for_timeout(300)
            _play(page, L)
            page.wait_for_selector("#gm-end", timeout=8000)
            if page.locator(".gm-end-st .gm-es.on").count() != 3:
                probs.append(f"{L}: sin las 3 estrellas")
            page.wait_for_timeout(700)
        probs += C.errors(page)
    finally:
        page.context.close()
    # 360 px: la ronda cabe
    page = C.new_page("phone", viewport={"width": 360, "height": 740})
    try:
        C.seed(page, _keys("english", own=False, wear=False))
        page.evaluate(_NO_HINT)
        C.goto(page, "#/juegos")
        page.locator('.gm-card[data-g="soldados"]').click()
        page.wait_for_function("() => document.documentElement.dataset.gmPlay === 'soldados'", timeout=8000)
        page.wait_for_timeout(300)
        if page.locator(".gm-intro .gm-go").count():
            page.locator(".gm-intro .gm-go").click()
        page.wait_for_timeout(400)
        fit = page.evaluate("""() => ({wide: document.documentElement.scrollWidth > innerWidth + 1,
          pics: [...document.querySelectorAll('#ar-cards .ar-pic, #ar-cards .ar-let')].map(p => p.offsetWidth)})""")
        if fit["wide"] or (fit["pics"] and min(fit["pics"]) < 100):
            probs.append(f"360 px: {fit}")
        C.shot(page, "juego-ronda-en-360", OUT, full_page=False)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
