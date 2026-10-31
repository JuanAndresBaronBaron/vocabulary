"""F5d (SPEC §5-G, ideas-viabilidad fila 4): «Frases mágicas» y «La frase de la cena» (js/phrases.js, data/phrases.json).

data/phrases.json: 8-12 plantillas por idioma (inglés, francés y danés) con el texto de antes y de después del hueco, la
traducción con su hueco, qué campo de la palabra usa y de qué grupos salen las palabras; cada plantilla se rellena bien
con 5 palabras de verdad (a/an, la elisión del francés, en/et y min/mit del danés, sin formas definidas inventadas).
#/frases: el hueco como pieza vacía y 3-4 dibujos de palabras que ya sabe (con la partida sembrada, las del repaso con
buenas notas); tocar o arrastrar un dibujo lo pone en el hueco; suena la voz del navegador para lo de antes, el audio
grabado de la palabra y la voz otra vez para lo de detrás, en orden y sin pisarse (con la tortuga, todo despacio);
«Otra frase»; «Dilo» con el reconocedor (no entenderla no cuenta como fallo). La frase de la cena es la misma en dos
cargas del mismo día (y en otro aparato) y cambia otro día (reloj del arnés); el sello pide la Puerta de mayores y da 5
monedas una vez al día (también tras recargar o cambiar de idioma); "phrase:stamps" va en la partida exportada. En Hoy,
la fila de la frase de la cena con su altavoz, y Hoy sigue sin scroll. La tarjeta «Frases mágicas» en Jugar › Juegos.
Funciona en inglés, francés y danés, sin errores de consola, y la partida exportada es la de la base (salvo
"phrase:stamps").

Audio y voz simulados (window.__log: speak/spoken y play/ended, con su velocidad); reconocedor simulado con
window.__srAlts / window.__srErr."""
from __future__ import annotations

import datetime as _dt
import json
import re

import common as C

OUT = C.CAPTURAS / "F5"
_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
_PASS = "() => sessionStorage.setItem('vocab:gate', String(Date.now() + adultGate.MS))"
_DATA = json.loads((C.REPO / "data" / "phrases.json").read_text(encoding="utf-8"))
LANGS = {"english": "en-GB", "français": "fr-FR", "dansk": "da-DK"}
USES = {"word", "forms", "a", "le", "un", "poss", "bare"}

# audio grabado y voz del navegador de mentira: apuntan en orden lo que empieza y lo que acaba
_MOCK = r"""
(() => {
  window.__log = [];
  HTMLMediaElement.prototype.play = function () {
    window.__log.push({k: 'play', src: this.src, rate: this.playbackRate});
    setTimeout(() => { window.__log.push({k: 'ended', src: this.src}); this.dispatchEvent(new Event('ended')); }, 80);
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function () {};
  if (window.speechSynthesis) {
    speechSynthesis.speak = u => { window.__log.push({k: 'speak', t: u.text, rate: u.rate, lang: u.lang});
      setTimeout(() => { window.__log.push({k: 'spoken', t: u.text}); if (u.onend) u.onend({}); }, 50); };
    speechSynthesis.cancel = () => {};
  }
})();
"""
# reconocedor de voz de mentira: dice window.__srAlts, o falla con window.__srErr
_FAKE_SR = r"""
(() => {
  class FakeSR {
    constructor(){ this.lang = ""; this.onresult = this.onerror = this.onend = null; }
    start(){
      window.__srStarts = (window.__srStarts || 0) + 1; window.__srLang = this.lang;
      setTimeout(() => {
        if (this._ab) return;
        if (window.__srErr) { if (this.onerror) this.onerror({error: window.__srErr}); if (this.onend) this.onend(); return; }
        const alts = window.__srAlts || ["zzzz"];
        if (this.onresult) this.onresult({results: [alts.map(t => ({transcript: t, confidence: .7}))]});
        if (this.onend) this.onend();
      }, 60);
    }
    stop(){}
    abort(){ this._ab = true; setTimeout(() => { if (this.onerror) this.onerror({error: "aborted"}); if (this.onend) this.onend(); }, 0); }
  }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
})();
"""
_NO_SR = r"""
(() => {
  try { Object.defineProperty(window, "webkitSpeechRecognition", {value: undefined, configurable: true, writable: true}); } catch (e) {}
  try { Object.defineProperty(window, "SpeechRecognition", {value: undefined, configurable: true, writable: true}); } catch (e) {}
})();
"""
_ST = "() => vocabPhrases.state()"
_STAMPS = "() => JSON.parse(localStorage.getItem('phrase:stamps') || 'null')"
_COINS = "() => game().coins"
_FIT = "() => ({sh: document.documentElement.scrollHeight, ih: innerHeight})"
_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""
_SPY = """() => { if (window.__aw) return; window.__aw = [];
  const a0 = window.award; window.award = function(n, why, quiet, from){ window.__aw.push([n, why, !!quiet, !!from]); return a0.apply(this, arguments); }; }"""


def _page(kind="phone", init=(_MOCK, _FAKE_SR), **kw):
    page = C.new_page(kind, **kw)
    for s in init:
        page.context.add_init_script(s)
    return page


def _keys(lang=None, now=C.FIXED_NOW, **extra):
    k = C.seed_keys(now)
    if lang:
        k["lang"] = json.dumps(lang, ensure_ascii=False)
    for a, b in extra.items():
        k[a.replace("__", ":")] = b if isinstance(b, str) else json.dumps(b, ensure_ascii=False)
    return k


def _open(page, hash="#/frases", keys=None):
    C.seed(page, keys=keys, hash=hash)
    if hash.startswith("#/frases"):
        page.wait_for_selector("#ph-line", timeout=10000)
    page.wait_for_timeout(150)


def _wait_quiet(page, ms=3000):
    """Espera a que acabe la cadena de audio (la frase deja de estar iluminada)."""
    page.wait_for_function("() => !document.querySelector('#ph-line.is-lit')", timeout=ms)


def _day(dt) -> str:
    return C.day_key(dt)


# ---------------------------------------------------------------- datos
def test_json_templates_fill_with_real_words():
    """data/phrases.json es válido: 8-12 plantillas por idioma, ids únicos, un solo hueco en la frase y en la traducción,
    use conocido y grupos que existen con palabras de verdad (con dibujo). En el navegador, cada plantilla de cada
    idioma encaja con 5 palabras o más, y 5 de ellas (repartidas) salen bien: a/an según el sonido, l' delante de vocal
    (nunca «le a…»/«la é…»/«ma a…»), un/une y mon/ma según el género, en/et y min/mit del danés tal como vienen en el
    tema (sin formas definidas inventadas), y la traducción concuerda (un/una, el/la, al/a la) sin marcadores sueltos."""
    probs = []
    D = _DATA
    for L in LANGS:
        T = D.get(L)
        if not isinstance(T, list) or not 8 <= len(T) <= 12:
            probs.append(f"{L}: {len(T or [])} plantillas (8-12)")
            continue
        ids = [t["id"] for t in T]
        if len(set(ids)) != len(ids):
            probs.append(f"{L}: ids repetidos {ids}")
        for t in T:
            tag = f"{L}/{t.get('id')}"
            if t.get("t", "").count("_") != 1 or t.get("es", "").count("_") != 1:
                probs.append(f"{tag}: el hueco «_» tiene que salir una vez en t y en es")
            if t.get("use") not in USES:
                probs.append(f"{tag}: use {t.get('use')!r}")
            if "{a}" in t.get("t", "") and (L != "english" or "{a} _" not in t["t"]):
                probs.append(f"{tag}: {{a}} solo en inglés y justo delante del hueco")
            for p in t.get("pools", []):
                if p not in D["pools"]:
                    probs.append(f"{tag}: el grupo {p!r} no existe")
    docs = {}
    for name, p in D["pools"].items():
        for ref in p["refs"]:
            d, es = ref.split("|", 1)
            if d not in docs:
                docs[d] = json.loads((C.REPO / "data" / f"{d}.json").read_text(encoding="utf-8"))["rows"]
            r = next((r for r in docs[d] if r.get("es") == es), None)
            if not r or not r.get("img"):
                probs.append(f"grupo {name}: {ref} no existe o no tiene dibujo")
    page = _page()
    try:
        _open(page)
        res = page.evaluate("""async () => {
          const out = {};
          for (const L of ['english', 'français', 'dansk']) for (const t of vocabPhrases.templates(L)) {
            const all = await vocabPhrases.cands(L, t.id), n = all.length, pick = [];
            for (let i = 0; i < 5 && n; i++) pick.push(all[Math.round(i * (n - 1) / 4)]);
            out[L + '/' + t.id] = {n, use: t.use, a: t.t.includes('{a}'), pick: pick.map(f => {
              const i = f.ref.indexOf('|'), r = CACHE[f.ref.slice(0, i)].rows.find(r => r.es === f.ref.slice(i + 1));
              return Object.assign({}, f, {word: r.l[L].word, forms: r.l[L].forms}); })};
          }
          return out; }""")
        V = "aeiouyâàäéèêëîïôöûùüœæ"
        for tag, x in res.items():
            L = tag.split("/")[0]
            if x["n"] < 5:
                probs.append(f"{tag}: solo {x['n']} palabras encajan (hacen falta 5)")
            for f in x["pick"]:
                txt, core, art = f["text"], f["core"], f["art"]
                where = f"{tag} «{txt}» / «{f['es']}»"
                if "_" in txt or "{" in txt or "_" in f["es"] or "{" in f["es"] or "  " in txt or "  " in f["es"]:
                    probs.append(f"{where}: marcadores o espacios dobles")
                if f["pre"] + art + core + f["post"] != txt:
                    probs.append(f"{where}: el texto no es antes + pieza + después")
                if art and not art.endswith((" ", "'")):
                    probs.append(f"{where}: el artículo «{art}» va pegado a la palabra")
                if x["a"] and f" {art}{core}" not in txt:
                    probs.append(f"{where}: «{art}{core}» no va separado por un espacio")
                w = re.sub(r"\s*\([^)]*\)", "", f["word"].split(" / ")[0]).strip()
                if L == "english":
                    if x["a"]:
                        lw = core.lower()
                        want = "an" if (lw[0] in "aeiou" and not re.match(r"(uni|use|usu|ura|ure|uro|eu|ewe|one|once)", lw)) \
                            or re.match(r"(hour|honest|honou?r|heir)", lw) else "a"
                        if art.strip() != want:
                            probs.append(f"{where}: «{art} {core}» (tiene que ser «{want}»)")
                    if re.search(r"\b(a [aeiou]|an [bcdfgjklmnpqrstvwxyz])", txt.lower()) and not re.search(r"\ba (uni|use|usu|eu|one)", txt.lower()):
                        probs.append(f"{where}: a/an mal")
                if L == "français":
                    if re.search(rf"\b(le|la|ma|de) [{V}h]", txt.lower()) and not re.search(r"\b(le|la) h", txt.lower()):
                        probs.append(f"{where}: falta la elisión")
                    if x["use"] == "un" and not re.match(r"^(un|une) ", core):
                        probs.append(f"{where}: un/une")
                    if x["use"] == "un" and w.startswith("le ") and not core.startswith("un "):
                        probs.append(f"{where}: «{w}» es masculino")
                    if x["use"] == "un" and w.startswith("la ") and not core.startswith("une "):
                        probs.append(f"{where}: «{w}» es femenino")
                    if x["use"] == "poss" and (core.startswith("ma ") and core[3] in V):
                        probs.append(f"{where}: «ma» delante de vocal")
                    if x["use"] == "word" and core != w:
                        probs.append(f"{where}: la palabra no es la del tema ({w})")
                if L == "dansk":
                    m = re.match(r"^(en|et) (.+)$", w)
                    if x["use"] == "word" and core != w:
                        probs.append(f"{where}: la palabra no es la del tema ({w})")
                    if x["use"] == "poss" and (not m or core != ("min " if m.group(1) == "en" else "mit ") + m.group(2)):
                        probs.append(f"{where}: min/mit no sale de «{w}»")
                    if x["use"] == "bare" and (not m or core != m.group(2)):
                        probs.append(f"{where}: sin artículo no es «{w}» sin en/et")
                    if x["use"] not in ("word", "poss", "bare", "forms"):
                        probs.append(f"{where}: use {x['use']} en danés")
                tes = next(t["es"] for t in _DATA[L] if t["id"] == tag.split("/")[1])
                if "{" in tes and re.search(r"\b(un|el|al) \w+a\b", f["es"]) and not re.search(r"\b(un|el|al) (gorila|koala|panda|planeta|mapa|fantasma|pijama|día|águila|\w+ista)\b", f["es"]):
                    probs.append(f"{where}: ¿concuerda el género en español?")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_words_fit_a_child_at_the_dinner_table():
    """Las frases las dice un niño de 8 años (y la de la cena, en la mesa): en la familia no hay parejas, suegros,
    cuñados, hijos ni nietos; de los oficios no sale «soldado», y solo los que se dicen igual para un niño y una niña
    (en francés, «Je veux être dentiste» sí y «infirmier» no; en inglés, ni «waiter / waitress» ni «sportsman»).
    «Profesor/a» no sale en inglés («lecturer») ni en danés («professor»): ya está «Maestro/a» (teacher, lærer). En
    danés, «legetøj» (incontable) no va con «Det er / Jeg har / Jeg kan se / Må jeg få»."""
    probs = []
    fam = _DATA["pools"]["family"]["refs"]
    adult = {"Hijo", "Hija", "Esposo/Marido", "Esposa/Mujer", "Nieto", "Nieta", "Suegro", "Suegra", "Cuñado", "Cuñada", "Novio", "Novia"}
    if [r for r in fam if r.split("|", 1)[1] in adult]:
        probs.append(f"familia de adultos: {[r for r in fam if r.split('|', 1)[1] in adult]}")
    for keep in ("familia|Padre", "familia|Madre", "familia|Hermano", "familia|Abuela", "familia|Tío", "familia|Prima", "familia|Bebé", "w01|mamá"):
        if keep not in fam:
            probs.append(f"falta {keep} en la familia")
    if "profesiones|Soldado" in _DATA["pools"]["jobs"]["refs"]:
        probs.append("«Soldado» sigue en los oficios")
    page = _page()
    try:
        _open(page)
        res = page.evaluate("""async () => { const o = {};
          for (const [L, id] of [['english', 'job'], ['français', 'job'], ['dansk', 'job'], ['dansk', 'det'], ['dansk', 'see'], ['dansk', 'got'], ['dansk', 'have'],
                                 ['english', 'love'], ['français', 'voici'], ['dansk', 'mine']])
            o[L + '/' + id] = (await vocabPhrases.cands(L, id)).map(f => f.text);
          return o; }""")
        fr = res["français/job"]
        bad = [t for t in fr if re.search(r"infirmier|avocat|chanteur|serveur|professeur|boulanger|cuisinier|policier|pompier", t)]
        if bad or not any("dentiste" in t for t in fr) or len(fr) < 5:
            probs.append(f"francés/job: {fr}")
        en = res["english/job"]
        if [t for t in en if re.search(r"lecturer|waiter|sports(wo)?man|soldier", t)] or not any("teacher" in t for t in en):
            probs.append(f"inglés/job: {en}")
        if [t for t in res["dansk/job"] if "professor" in t] or not any("lærer" in t for t in res["dansk/job"]):
            probs.append(f"danés/job: {res['dansk/job']}")
        for tid in ("det", "see", "got", "have"):
            if [t for t in res["dansk/" + tid] if "legetøj" in t]:
                probs.append(f"danés/{tid} con «legetøj»")
        for tag in ("english/love", "français/voici", "dansk/mine"):
            if [t for t in res[tag] if re.search(r"girlfriend|boyfriend|wife|husband|-in-law|son\b|daughter|grand(son|daughter)|mari\b|femme|kone|svigermor|kæreste", t)]:
                probs.append(f"{tag}: {res[tag]}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- #/frases
def test_known_words_tap_and_drag_place_the_word():
    """Con la partida sembrada, los 3-4 dibujos son palabras que ya sabe (srs:english con b ≥ 1), con su dibujo cargado.
    El hueco empieza vacío y «Oír» no se ve. Tocar un dibujo lo pone en el hueco (la frase y la traducción se completan,
    el dibujo queda marcado); arrastrar otro y soltarlo encima del hueco lo cambia; soltarlo lejos no cambia nada. Las
    teclas 1-4 eligen. «Otra frase» trae otra plantilla, sin la palabra puesta."""
    probs = []
    page = _page()
    try:
        _open(page)
        st = page.evaluate(_ST)
        srs = page.evaluate("() => srsAll()")
        if st["mode"] != "play" or not 3 <= len(st["choices"]) <= 4:
            probs.append(f"al entrar: {st}")
        for c in st["choices"]:
            x = srs.get(c["ref"])
            if not x or x.get("b", 0) < 1:
                probs.append(f"{c['ref']} ({c['core']}) no es una palabra que sepa: {x}")
        look = page.evaluate("""() => ({gap: !!document.querySelector('#ph-gap.is-empty'), off: document.getElementById('ph-acts').hasAttribute('data-off'),
          imgs: [...document.querySelectorAll('.ph-tile img')].map(i => i.complete && i.naturalWidth > 0), es: document.getElementById('ph-es').textContent,
          tiles: document.querySelectorAll('.ph-tile').length, keys: [...document.querySelectorAll('.ph-tile')].map(b => b.dataset.key)})""")
        if not look["gap"] or not look["off"] or not all(look["imgs"]) or "___" not in look["es"]:
            probs.append(f"hueco vacío: {look}")
        if look["keys"] != [str(i + 1) for i in range(look["tiles"])]:
            probs.append(f"teclas de los dibujos: {look['keys']}")
        # tocar
        page.locator(".ph-tile").nth(1).click()
        page.wait_for_timeout(150)
        st1 = page.evaluate(_ST)
        want = st["choices"][1]
        line = page.evaluate("() => document.getElementById('ph-line').textContent")
        if st1["placed"] != 1 or st1["text"] != want["text"] or line != want["text"]:
            probs.append(f"tocar: {st1['placed']} «{line}» (quería «{want['text']}»)")
        if page.evaluate("() => document.querySelector('.ph-tile[data-i=\"1\"]').getAttribute('aria-pressed')") != "true":
            probs.append("tocar: el dibujo no queda marcado")
        if page.evaluate("() => document.getElementById('ph-acts').hasAttribute('data-off')"):
            probs.append("tocar: «Oír» no aparece")
        if "___" in page.evaluate("() => document.getElementById('ph-es').textContent") or not page.locator("#ph-es b").count():
            probs.append("tocar: la traducción no se completa")
        _wait_quiet(page)
        # arrastrar (ratón: el gesto de verdad de gestures.js) y soltar encima del hueco
        def drag(i, to):
            b = page.locator(".ph-tile").nth(i).bounding_box()
            x0, y0 = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
            page.mouse.move(x0, y0)
            page.mouse.down()
            page.mouse.move(x0 + 6, y0 - 6, steps=2)
            page.mouse.move(to[0], to[1], steps=10)
            page.wait_for_timeout(60)
            page.mouse.up()
            page.wait_for_timeout(250)
        g = page.locator("#ph-gap").bounding_box()
        drag(2, (g["x"] + g["width"] / 2, g["y"] + g["height"] / 2))
        st2 = page.evaluate(_ST)
        if st2["placed"] != 2 or st2["text"] != st["choices"][2]["text"]:
            probs.append(f"arrastrar al hueco: {st2['placed']} «{st2['text']}»")
        _wait_quiet(page)
        h = page.locator("#ph-hint").bounding_box()
        drag(0, (h["x"] + 20, h["y"] + h["height"] / 2))
        st3 = page.evaluate(_ST)
        if st3["placed"] != 2:
            probs.append(f"soltar lejos cambió la palabra: {st3['placed']}")
        # teclado: 4 (o 3) elige
        n = len(st["choices"])
        page.keyboard.press(str(n))
        page.wait_for_timeout(200)
        if page.evaluate(_ST)["placed"] != n - 1:
            probs.append(f"la tecla {n} no elige el dibujo {n}")
        _wait_quiet(page)
        # otra frase
        page.locator("#ph-next").click()
        page.wait_for_function(f"() => vocabPhrases.state().tpl !== {json.dumps(st['tpl'])}", timeout=4000)
        st4 = page.evaluate(_ST)
        if st4["placed"] != -1 or not page.locator("#ph-gap.is-empty").count():
            probs.append(f"otra frase: {st4}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_buttons_tray_placeholder_and_a11y():
    """En #/frases, «Otra frase» va gris con el hueco vacío (lo que toca es poner una pieza) y pasa a principal (azul,
    56 px) al ponerla. La pieza puesta deja en la bandeja su sitio (el dibujo atenuado, sin la palabra, con borde de
    puntos; el botón sigue diciendo la palabra); tocar la palabra del
    hueco la devuelve (hueco vacío, «Otra frase» gris otra vez). El hueco vacío se lee en español («espacio vacío»).
    En #/frases/cena, «Ya la dije en casa» es el principal (56 px, Enter) y «Jugar con frases» va gris; ya sellada,
    «Jugar con frases» pasa a principal. La Puerta dice qué frase tiene que haber dicho y su traducción. En oscuro, los
    dibujos van sobre su placa clara y «Tus sellos» no es dorado. La fila de Hoy no mezcla idiomas en una etiqueta."""
    probs = []
    BLUE = "rgb(30, 110, 244)"
    look = """() => { const n = document.getElementById('ph-next'), r = n.getBoundingClientRect();
      return {pri: n.classList.contains('glass-btn--pri'), h: Math.round(r.height), bg: getComputedStyle(n).backgroundColor, t: n.textContent.trim(), key: n.dataset.key}; }"""
    page = _page()
    try:
        _open(page)
        n0 = page.evaluate(look)
        if n0["pri"] or n0["bg"] == BLUE or n0["t"] != "Otra frase":
            probs.append(f"«Otra frase» con el hueco vacío: {n0}")
        gap = page.evaluate("() => { const g = document.getElementById('ph-gap'); return [g.getAttribute('lang'), g.getAttribute('aria-label'), g.getAttribute('role')]; }")
        if gap != ["es", "espacio vacío", "img"]:
            probs.append(f"el hueco: {gap}")
        page.locator(".ph-tile").nth(0).click()
        page.wait_for_timeout(200)
        n1 = page.evaluate(look)
        if not n1["pri"] or n1["h"] != 56 or n1["bg"] != BLUE:
            probs.append(f"«Otra frase» con la frase hecha: {n1}")
        tile = page.evaluate("""() => { const b = document.querySelector('.ph-tile[data-i="0"]'), cs = getComputedStyle(b);
          return {pressed: b.getAttribute('aria-pressed'), op: +getComputedStyle(b.querySelector('.ph-pic')).opacity, ol: cs.outlineStyle, bg: cs.backgroundColor,
            word: getComputedStyle(b.querySelector('.ph-tw')).visibility, label: b.getAttribute('aria-label')}; }""")
        if tile["pressed"] != "true" or tile["op"] > 0.4 or tile["ol"] != "dashed" or tile["word"] != "hidden" or not tile["label"]:
            probs.append(f"la pieza puesta en la bandeja: {tile}")
        _wait_quiet(page)
        page.locator("#ph-pc").click()
        page.wait_for_timeout(200)
        st = page.evaluate(_ST)
        back = page.evaluate("""() => ({empty: !!document.querySelector('#ph-gap.is-empty'), off: document.getElementById('ph-acts').hasAttribute('data-off'),
          pressed: [...document.querySelectorAll('.ph-tile')].map(b => b.getAttribute('aria-pressed')), es: document.getElementById('ph-es').textContent})""")
        if st["placed"] != -1 or not back["empty"] or not back["off"] or "true" in back["pressed"] or "___" not in back["es"] or page.evaluate(look)["pri"]:
            probs.append(f"tocar la palabra del hueco no la devuelve: {st} {back}")
        probs += C.errors(page)
    finally:
        page.context.close()
    # la frase de la cena: el sello es lo principal
    page = _page()
    try:
        _open(page, "#/frases/cena")
        b = page.evaluate("""() => { const s = document.getElementById('ph-stamp'), r = s.getBoundingClientRect();
          return {pri: s.classList.contains('glass-btn--pri'), h: Math.round(r.height), bg: getComputedStyle(s).backgroundColor, key: s.dataset.key}; }""")
        n = page.evaluate(look)
        if not b["pri"] or b["h"] != 56 or b["bg"] != BLUE or b["key"] != "enter":
            probs.append(f"«Ya la dije en casa» no es el principal: {b}")
        if n["pri"] or n["t"] != "Jugar con frases" or n["bg"] == BLUE or "enter" in n["key"].split():
            probs.append(f"«Jugar con frases» antes del sello: {n}")
        dn = page.evaluate(_ST)
        page.locator("#ph-stamp").click()
        page.wait_for_selector("dialog#gate[open]", timeout=4000)
        why = page.evaluate("() => document.getElementById('gt-why').textContent")
        want = f"¿Ha dicho «{dn['text']}» ({dn['es'].rstrip('.')}) en casa? Resuelve la cuenta para darle su sello."
        if why != want:
            probs.append(f"la Puerta dice «{why}» (quería «{want}»)")
        q = page.evaluate("() => document.querySelector('#gate #gt-q b').textContent")
        for ch in str(_sum_words(q)):
            page.locator(f'#gt-ks .gt-k[data-k="{ch}"]').click()
        page.locator('#gt-ks .gt-k[data-k="ok"]').click()
        page.wait_for_selector("#ph-done", timeout=4000)
        page.wait_for_timeout(200)
        n = page.evaluate(look)
        if not n["pri"] or n["h"] != 56 or n["t"] != "Jugar con frases" or "enter" not in n["key"].split():
            probs.append(f"«Jugar con frases» ya sellada: {n}")
        probs += C.errors(page)
    finally:
        page.context.close()
    # oscuro: placa clara en los dibujos y «Tus sellos» sin dorado; Hoy sin etiqueta mezclada
    page = _page(color_scheme="dark")
    try:
        _open(page)
        d = page.evaluate("""() => { const i = document.querySelector('.ph-tile .ph-pic'), s = document.getElementById('ph-sn');
          return {ibg: getComputedStyle(i).backgroundColor, sbg: getComputedStyle(s).backgroundColor, sc: getComputedStyle(s).color,
            fill2: getComputedStyle(document.documentElement).getPropertyValue('--fill2').trim()}; }""")
        if d["ibg"] != "rgb(242, 242, 247)":
            probs.append(f"oscuro: los dibujos no van sobre su placa ({d['ibg']})")
        if "255, 214, 0" in d["sbg"] or "255, 204, 0" in d["sbg"]:
            probs.append(f"oscuro: «Tus sellos» sigue dorado ({d})")
        C.goto(page, "")
        page.wait_for_selector("#ph-hrow", timeout=6000)
        if page.evaluate("() => document.querySelector('#ph-hrow .ph-hgo').hasAttribute('aria-label')"):
            probs.append("la fila de Hoy lleva una etiqueta que mezcla idiomas")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_audio_word_clip_then_voice_in_order():
    """Al poner la palabra: la voz dice lo de antes, después suena el audio grabado de la palabra y luego la voz dice lo
    de detrás (si tiene letras); nada empieza antes de que acabe lo anterior. Sin audio grabado, con l' o en inglés
    detrás de a/an/the («I can see a», «Look at the»), la voz dice la frase entera, para que la «a» suene /ə/ y no como
    la letra. Con la tortuga, la voz va a SLOW() y el audio a 0,7. El altavoz (redondo, 48 px, «Oír la frase») lo repite
    y se rellena mientras suena; la tortuga es un círculo gris de 44."""
    probs = []
    page = _page()
    try:
        _open(page)

        def chain(f, slow=False):
            page.evaluate("() => { window.__log = []; }")
            page.evaluate("([f, s]) => vocabPhrases.play(f, s)", [f, slow])
            page.wait_for_timeout(100)
            page.wait_for_function("() => { const l = window.__log; const o = l.filter(x => x.k === 'speak' || x.k === 'play').length; const c = l.filter(x => x.k === 'spoken' || x.k === 'ended').length; return o && o === c; }", timeout=5000)
            page.wait_for_timeout(150)
            return page.evaluate("() => window.__log")

        def overlaps(log):
            on = None
            for x in log:
                if x["k"] in ("speak", "play"):
                    if on:
                        return f"{x['k']} empieza mientras suena {on}"
                    on = x["k"]
                else:
                    on = None
            return ""
        # inglés con a/an/the delante del hueco: la frase entera con la voz, aunque la palabra tenga audio grabado
        for tid, refs in (("have", "['w03|botella', 'w04|cepillo', 'w03|taza']"), ("see", "['animales|Perro', 'animales|Gato', 'w03|manzana']"),
                          ("look", "['animales|Perro', 'animales|Gato', 'w04|cama']")):
            h = page.evaluate(f"async () => {{ for (const r of {refs}) {{ const f = await vocabPhrases.fill('english', '{tid}', r); if (f && clipFor(f.core)) return f; }} return null; }}")
            if not h:
                probs.append(f"no hay ninguna frase «{tid}» con audio grabado")
                continue
            log = chain(h)
            seq = [(x["k"], x.get("t")) for x in log if x["k"] in ("speak", "play")]
            if h["clip"] or seq != [("speak", h["text"])]:
                probs.append(f"«{h['text']}»: {seq} (la voz tiene que decirla entera)")
        # «My favourite colour is red.»: voz + audio (y la voz otra vez si detrás hay letras)
        f = page.evaluate("async () => (await vocabPhrases.cands('english', 'colour')).find(f => f.clip && clipFor(f.core)) || null")
        if not f:
            probs.append("no hay ninguna frase «colour» con audio grabado")
        else:
            clip = page.evaluate("c => clipFor(c)", f["core"])
            log = chain(f)
            seq = [(x["k"], x.get("t") or x.get("src", "").split("/")[-1]) for x in log if x["k"] in ("speak", "play")]
            want = [("speak", f["pre"] + f["art"]), ("play", f"{clip}.mp3")] + ([("speak", f["post"])] if re.search(r"[A-Za-z]", f["post"]) else [])
            want = [(k, v.strip()) for k, v in want]
            if [(k, v.strip()) for k, v in seq] != want:
                probs.append(f"orden: {seq} (quería {want})")
            if overlaps(log):
                probs.append("se pisan: " + overlaps(log))
            if not all(x["lang"] == "en-GB" for x in log if x["k"] == "speak"):
                probs.append("la voz no es en-GB")
            # despacio
            log = chain(f, True)
            slow = page.evaluate("() => SLOW()")
            rates = [x["rate"] for x in log if x["k"] == "speak"]
            prate = [x["rate"] for x in log if x["k"] == "play"]
            if not rates or any(abs(r - slow) > 1e-6 for r in rates) or prate != [0.7]:
                probs.append(f"tortuga: voz {rates} (SLOW {slow}), audio {prate}")
        # sin audio grabado: la frase entera con la voz
        g = page.evaluate("async () => { const all = await vocabPhrases.cands('english', 'like'); return all.find(f => !clipFor(f.core)) || null; }")
        if g:
            log = chain(g)
            seq = [(x["k"], x.get("t")) for x in log if x["k"] in ("speak", "play")]
            if seq != [("speak", g["text"])]:
                probs.append(f"sin audio grabado: {seq}")
        # en la pantalla: tocar un dibujo suena (voz → audio, en orden) y la frase se ilumina
        page.evaluate("() => { window.__log = []; }")
        page.locator(".ph-tile").first.click()
        page.wait_for_timeout(60)
        if not page.locator("#ph-line.is-lit").count():
            probs.append("la frase no se ilumina al sonar")
        _wait_quiet(page, 5000)
        log = page.evaluate("() => window.__log")
        st = page.evaluate(_ST)
        starts = [x["k"] for x in log if x["k"] in ("speak", "play")]
        cur = page.evaluate("() => { const s = vocabPhrases.state(); return s; }")
        if not starts or overlaps(log):
            probs.append(f"al tocar: {starts} {overlaps(log)} ({cur['text']})")
        if "play" in starts and starts.index("play") == 0:
            probs.append(f"al tocar, el audio va antes que la voz: {starts}")
        # el altavoz lo repite (y se rellena mientras suena)
        spk = page.evaluate("""() => { const b = document.getElementById('ph-say'), t = document.getElementById('ph-slow'), r = b.getBoundingClientRect(), q = t.getBoundingClientRect();
          return {w: r.width, h: r.height, tw: q.width, th: q.height, rad: getComputedStyle(b).borderRadius, trad: getComputedStyle(t).borderRadius,
            bg: getComputedStyle(b).backgroundColor, tbg: getComputedStyle(t).backgroundColor, label: b.getAttribute('aria-label'), text: b.textContent.trim()}; }""")
        if round(spk["w"]) != 48 or round(spk["h"]) != 48 or round(spk["tw"]) != 48 or round(spk["th"]) != 48 or spk["rad"] != "50%" or spk["trad"] != "50%":
            probs.append(f"el altavoz y la tortuga no son los de la lección (48 px, redondos): {spk}")
        if spk["label"] != "Oír la frase" or spk["text"]:
            probs.append(f"el altavoz: {spk['label']!r} {spk['text']!r}")
        page.evaluate("() => { window.__log = []; }")
        page.locator("#ph-say").click()
        page.wait_for_timeout(60)
        if not page.locator("#ph-say.playing").count():
            probs.append("el altavoz no se rellena mientras suena")
        _wait_quiet(page, 5000)
        if page.locator("#ph-say.playing").count():
            probs.append("el altavoz sigue relleno al acabar")
        page.wait_for_timeout(150)
        if [x["k"] for x in page.evaluate("() => window.__log") if x["k"] in ("speak", "play")] != starts:
            probs.append("«Oír» no repite la misma cadena")
        page.evaluate("() => { window.__log = []; }")
        page.locator("#ph-slow").click()
        _wait_quiet(page, 5000)
        page.wait_for_timeout(150)
        slow = page.evaluate("() => SLOW()")
        if any(abs(x["rate"] - slow) > 1e-6 for x in page.evaluate("() => window.__log") if x["k"] == "speak"):
            probs.append("el botón de la tortuga no va despacio")
        if st["text"] is None:
            probs.append("no quedó ninguna palabra puesta")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_dilo_is_tolerant_and_never_a_failure():
    """«Dilo» (con reconocedor): decir la frase (o solo la palabra, en mayúsculas y con signos) es «¡Muy bien!»; algo
    que no es la palabra es «No te he oído bien…» (gris, sin ✗ ni monedas ni cambios en el repaso); sin permiso, una
    frase para mayores. Sin reconocedor no hay «Dilo» y todo sigue funcionando tocando."""
    probs = []
    page = _page()
    try:
        _open(page)
        page.locator(".ph-tile").first.click()
        _wait_quiet(page)
        st = page.evaluate(_ST)
        before = page.evaluate("() => (srsFlush(), [localStorage.getItem('srs:english'), game().coins])")

        def say(alts=None, err=None):
            page.evaluate("([a, e]) => { window.__srAlts = a; window.__srErr = e; }", [alts, err])
            page.locator("#ph-mic").click()
            page.wait_for_function("() => document.getElementById('ph-msg').textContent.trim()", timeout=4000)
            return page.evaluate("() => ({t: document.getElementById('ph-msg').textContent.trim(), ok: document.getElementById('ph-msg').classList.contains('ok'), lang: window.__srLang})")
        r = say([st["text"]])
        if not r["ok"] or "Muy bien" not in r["t"] or r["lang"] != "en-GB":
            probs.append(f"la frase entera «{st['text']}»: {r}")
        core = st["choices"][0]["core"]
        page.evaluate("() => { document.getElementById('ph-msg').textContent = ''; }")
        r = say(["zzz", core.upper() + "!"])
        if not r["ok"]:
            probs.append(f"solo la palabra, en mayúsculas: {r}")
        page.evaluate("() => { document.getElementById('ph-msg').textContent = ''; }")
        r = say(["completely different"])
        if r["ok"] or "No te he oído bien" not in r["t"]:
            probs.append(f"otra cosa: {r}")
        page.evaluate("() => { document.getElementById('ph-msg').textContent = ''; }")
        r = say(None, "not-allowed")
        if r["ok"] or "micrófono" not in r["t"]:
            probs.append(f"sin permiso: {r}")
        if page.evaluate("() => (srsFlush(), [localStorage.getItem('srs:english'), game().coins])") != before:
            probs.append("«Dilo» cambió el repaso o las monedas")
        if page.evaluate("() => document.querySelector('#ph-card .miss, #ph-card [class*=nope]') !== null"):
            probs.append("sale un fallo")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = _page(init=(_MOCK, _NO_SR))
    try:
        _open(page)
        if page.locator("#ph-mic").count():
            probs.append("sin reconocedor sale «Dilo»")
        page.locator(".ph-tile").first.click()
        page.wait_for_timeout(200)
        if page.evaluate(_ST)["placed"] != 0:
            probs.append("sin reconocedor no se puede tocar")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la frase de la cena
def test_dinner_phrase_same_day_same_everywhere_and_changes_next_day():
    """La frase de la cena: la misma en dos cargas del mismo día, en Hoy y en #/frases/cena, y en otro aparato el mismo
    día (otra partida igual); no cambia ese día aunque aprenda palabras nuevas; otro día (reloj del arnés) es otra.
    Sale de palabras que sabe. "phrase:day" es solo de este aparato (no va en la partida)."""
    probs = []
    keys = _keys()
    nxt = C.FIXED_NOW + _dt.timedelta(days=1)

    def cena(page):
        page.wait_for_selector("#ph-line", timeout=10000)
        return page.evaluate(_ST)
    page = _page()
    try:
        _open(page, "#/frases/cena", keys)
        a = cena(page)
        srs = page.evaluate("() => srsAll()")
        ref = page.evaluate("async () => (await vocabPhrases.dinner()).ref")
        if a["mode"] != "cena" or not a["text"]:
            probs.append(f"#/frases/cena: {a}")
        if not srs.get(ref) or srs[ref].get("b", 0) < 1:
            probs.append(f"la frase de la cena no es de una palabra que sepa: {ref}")
        C.reload(page)
        b = cena(page)
        if b["text"] != a["text"]:
            probs.append(f"otra carga del mismo día: «{b['text']}» ≠ «{a['text']}»")
        C.goto(page, "")
        page.wait_for_selector("#ph-hrow", timeout=6000)
        hoy = page.evaluate("() => document.querySelector('#ph-hrow .hm-rt small').textContent")
        if hoy != a["text"]:
            probs.append(f"Hoy dice «{hoy}» y #/frases/cena «{a['text']}»")
        # aprende todas las palabras que encajan: ese día sigue la misma
        page.evaluate("""async () => { const m = srsAll(); const D = vocabPhrases.data();
          for (const p of Object.values(D.pools)) for (const r of p.refs) if (!m[r]) { const i = r.indexOf('|'); m[r] = {d: r.slice(0, i), e: r.slice(i + 1), b: 3, due: today() + 7, n: 3}; }
          localStorage.setItem('srs:english', JSON.stringify(m)); }""")
        C.reload(page)
        page.wait_for_selector("#ph-hrow", timeout=6000)
        if page.evaluate("() => document.querySelector('#ph-hrow .hm-rt small').textContent") != a["text"]:
            probs.append("la frase de la cena cambió el mismo día al aprender palabras")
        exp = C.export(page)["keys"]
        if "phrase:day" in exp or "phrase:day" not in C.storage(page):
            probs.append(f"phrase:day: en la partida {'phrase:day' in exp}, en el aparato {'phrase:day' in C.storage(page)}")
        # el mismo aparato al día siguiente
        page.clock.set_system_time(nxt.timestamp())
        C.goto(page, "#/frases/cena", reload=True)
        c0 = cena(page)
        if c0["text"] == a["text"]:
            probs.append(f"al día siguiente sigue «{a['text']}»")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = _page()
    try:
        _open(page, "#/frases/cena", keys)
        if cena(page)["text"] != a["text"]:
            probs.append(f"otro aparato el mismo día: «{cena(page)['text']}» ≠ «{a['text']}»")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = _page(now=nxt)
    try:
        _open(page, "#/frases/cena", keys)
        c = cena(page)
        if c["text"] == a["text"]:
            probs.append(f"otro día con la misma partida: sigue «{a['text']}»")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_stamp_needs_gate_pays_once_a_day_and_is_exported():
    """«Ya la dije en casa» abre la Puerta de mayores; cancelarla no sella ni paga. Con la Puerta: sello (con su
    animación), award(5, "Frase de la cena") una vez, "phrase:stamps" = {v: 1, days: [hoy], n: 1} y «Tus sellos: 1».
    Recargar o cambiar de idioma no deja sellar otra vez ni paga; en Hoy, la fila lleva el sello dorado. La clave va en
    la partida exportada y se puede volver a cargar. Al día siguiente se puede sellar otra vez (n: 2)."""
    probs = []
    page = _page()
    try:
        _open(page, "#/frases/cena")
        page.evaluate(_SPY)
        coins0 = page.evaluate(_COINS)
        page.locator("#ph-stamp").click()
        page.wait_for_selector("dialog#gate[open]", timeout=4000)
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.getElementById('gate').open", timeout=4000)
        page.wait_for_timeout(200)
        if page.evaluate(_STAMPS) is not None or page.evaluate(_COINS) != coins0 or not page.locator("#ph-stamp").count():
            probs.append("cancelar la Puerta selló o pagó")
        page.locator("#ph-stamp").click()
        page.wait_for_selector("dialog#gate[open]", timeout=4000)
        page.wait_for_timeout(300)
        q = page.evaluate("() => document.querySelector('#gate #gt-q b').textContent")
        n = _sum_words(q)
        for ch in str(n):
            page.locator(f'#gt-ks .gt-k[data-k="{ch}"]').click()
        page.locator('#gt-ks .gt-k[data-k="ok"]').click()
        page.wait_for_selector("#ph-done", timeout=4000)
        page.wait_for_timeout(300)
        today = _day(C.FIXED_NOW)
        s = page.evaluate(_STAMPS)
        if s != {"v": 1, "days": [today], "n": 1}:
            probs.append(f"phrase:stamps: {s}")
        aw = page.evaluate("() => window.__aw")
        if aw != [[5, "Frase de la cena", False, True]]:
            probs.append(f"award: {aw}")
        if page.evaluate(_COINS) != coins0 + 5:
            probs.append(f"monedas {coins0} → {page.evaluate(_COINS)} (quería +5)")
        sn = page.evaluate("() => document.getElementById('ph-sn').textContent.trim()")
        if sn != "Tus sellos: 1" or page.locator(".ph-seals li").count() != 1:
            probs.append(f"«{sn}», {page.locator('.ph-seals li').count()} sellos")
        # recargar
        C.reload(page)
        page.wait_for_selector("#ph-done", timeout=6000)
        if page.locator("#ph-stamp").count() or page.evaluate(_COINS) != coins0 + 5:
            probs.append("tras recargar se puede sellar otra vez")
        # otro idioma
        page.evaluate("() => setLang('français')")
        page.wait_for_function("() => vocabPhrases.state() && vocabPhrases.state().lang === 'français'", timeout=8000)
        page.wait_for_selector("#ph-done", timeout=6000)
        if page.locator("#ph-stamp").count():
            probs.append("en francés se puede sellar otra vez el mismo día")
        if page.evaluate(_COINS) != coins0 + 5 or page.evaluate(_STAMPS)["n"] != 1:
            probs.append("cambiar de idioma pagó o selló otra vez")
        page.evaluate("() => setLang('english')")
        C.goto(page, "")
        page.wait_for_selector("#ph-hrow", timeout=6000)
        if not page.locator("#ph-hrow .hm-ric.gold").count():
            probs.append("en Hoy la fila no lleva el sello")
        # en la partida exportada (y se vuelve a cargar)
        snap = C.export(page)
        k = snap["keys"].get("phrase:stamps")
        if not k or json.loads(k) != {"v": 1, "days": [today], "n": 1}:
            probs.append(f"la partida exportada no lleva phrase:stamps: {k}")
        ok = page.evaluate("t => { const p = vocabSave.parse(t); return p.ok && 'phrase:stamps' in p.data.keys; }", json.dumps(snap))
        if not ok:
            probs.append("vocabSave.parse() no acepta phrase:stamps")
        # el día siguiente
        page.clock.set_system_time((C.FIXED_NOW + _dt.timedelta(days=1)).timestamp())
        C.goto(page, "#/frases/cena", reload=True)
        page.wait_for_selector("#ph-stamp", timeout=6000)
        page.evaluate(_PASS)
        page.evaluate(_SPY)
        page.locator("#ph-stamp").click()
        page.wait_for_selector("#ph-done", timeout=4000)
        s = page.evaluate(_STAMPS)
        if s["n"] != 2 or s["days"] != [today, _day(C.FIXED_NOW + _dt.timedelta(days=1))]:
            probs.append(f"al día siguiente: {s}")
        if page.evaluate("() => window.__aw") != [[5, "Frase de la cena", False, True]]:
            probs.append(f"al día siguiente, award: {page.evaluate('() => window.__aw')}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def _sum_words(q):
    U = {"uno": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6, "siete": 7, "ocho": 8, "nueve": 9}
    V = {"veinte": 20, "veintiuno": 21, "veintidós": 22, "veintitrés": 23, "veinticuatro": 24, "veinticinco": 25, "veintiséis": 26,
         "veintisiete": 27, "veintiocho": 28, "veintinueve": 29}
    T = {"treinta": 30, "cuarenta": 40, "cincuenta": 50, "sesenta": 60, "setenta": 70, "ochenta": 80, "noventa": 90}

    def num(w):
        w = w.strip()
        if w in V:
            return V[w]
        p = w.split(" y ")
        return T[p[0]] + (U[p[1]] if len(p) > 1 else 0)
    a, b = q.split(" más ")
    return num(a) + num(b)


def test_stamps_keep_last_60_days():
    """phrase:stamps guarda como mucho los 60 últimos días (el total sigue contando) y una clave dañada no rompe nada."""
    probs = []
    page = _page()
    try:
        old = [_day(C.FIXED_NOW - _dt.timedelta(days=i)) for i in range(70, 0, -1)]
        _open(page, "#/frases/cena", _keys(phrase__stamps={"v": 1, "days": old, "n": 75}))
        page.evaluate(_PASS)
        page.locator("#ph-stamp").click()
        page.wait_for_selector("#ph-done", timeout=4000)
        s = page.evaluate(_STAMPS)
        if len(s["days"]) != 60 or s["days"][-1] != _day(C.FIXED_NOW) or s["n"] != 76:
            probs.append(f"60 días: {len(s['days'])}, último {s['days'][-1]}, n {s['n']}")
        if "Tus sellos: 76" not in page.evaluate("() => document.getElementById('ph-sn').textContent"):
            probs.append("«Tus sellos» no cuenta el total")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = _page()
    try:
        _open(page, "#/frases/cena", _keys(phrase__stamps={"days": "x", "n": "y"}))
        if not page.locator("#ph-stamp").count() or "Tus sellos: 0" not in page.evaluate("() => document.getElementById('ph-sn').textContent"):
            probs.append("una clave dañada rompe la tarjeta")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Hoy y Juegos
def test_hoy_row_speaker_and_no_scroll():
    """En Hoy, la fila «La frase de la cena» (HOME_SLOTS id "phrase") con la frase y su altavoz; el altavoz suena sin
    salir de Hoy; tocar la fila abre #/frases/cena con esa frase y la cápsula vuelve a «Hoy». Hoy sigue sin scroll a
    390×844 (claro y oscuro) y en escritorio. Sin palabras que sepa (primer día), no hay fila."""
    probs = []
    for kind, scheme in (("phone", "light"), ("phone", "dark"), ("desk", "light")):
        page = _page(kind, color_scheme=scheme)
        try:
            _open(page, "")
            page.wait_for_selector("[data-slot=phrase] #ph-hrow", timeout=6000)
            fit = page.evaluate(_FIT)
            if fit["sh"] > fit["ih"]:
                probs.append(f"{kind}-{scheme}: Hoy tiene scroll ({fit['sh']} > {fit['ih']})")
            row = page.evaluate("""() => { const r = document.getElementById('ph-hrow'), b = r.getBoundingClientRect(), s = document.getElementById('ph-hsay').getBoundingClientRect();
              return {t: r.querySelector('.hm-rt').firstChild.textContent, small: r.querySelector('small').textContent, lang: r.querySelector('small').lang,
                h: Math.round(b.height), sw: Math.round(s.width), sh: Math.round(s.height), inside: s.right <= b.right + 1 && s.left >= b.left,
                nested: !!r.querySelector('a button, a a')}; }""")
            if row["t"] != "La frase de la cena" or not row["small"] or row["lang"] != "en-GB" or row["nested"]:
                probs.append(f"{kind}-{scheme}: fila {row}")
            if row["h"] > 60 or row["sw"] < 44 or row["sh"] < 44 or not row["inside"]:
                probs.append(f"{kind}-{scheme}: tamaños de la fila {row}")
            if kind == "phone" and scheme == "light":
                page.evaluate("() => { window.__log = []; }")
                page.locator("#ph-hsay").click()
                page.wait_for_timeout(600)
                if C.current_hash(page) != "" or not [x for x in page.evaluate("() => window.__log") if x["k"] in ("speak", "play")]:
                    probs.append("el altavoz de Hoy no suena o sale de Hoy")
                page.wait_for_timeout(800)
                page.locator("#ph-hrow .ph-hgo").click()
                page.wait_for_selector("#ph-line", timeout=6000)
                st = page.evaluate(_ST)
                bk = page.evaluate("() => [document.documentElement.hasAttribute('data-back'), document.getElementById('dv-back').getAttribute('href'), document.getElementById('dv-back').textContent.trim()]")
                if C.current_hash(page) != "frases/cena" or st["text"] != row["small"] or bk != [True, "#/", "Hoy"]:
                    probs.append(f"tocar la fila: #{C.current_hash(page)} «{st['text']}» vuelta {bk}")
                if page.evaluate("() => document.querySelector('#tab-jugar').getAttribute('aria-selected')") != "true":
                    probs.append("en #/frases no se marca la pestaña Jugar")
                page.locator("#ph-next").click()
                page.wait_for_function("() => vocabPhrases.state() && vocabPhrases.state().mode === 'play'", timeout=6000)
                bk = page.evaluate("() => document.getElementById('dv-back').textContent.trim()")
                if bk != "Hoy":
                    probs.append(f"«Otra frase» desde la cena: la cápsula dice «{bk}»")
            probs += C.errors(page)
        finally:
            page.context.close()
    page = _page()
    try:
        _open(page, "", _keys(**{"srs__english": {}}))
        page.wait_for_timeout(400)
        if page.locator("#ph-hrow").count():
            probs.append("sin palabras que sepa sale la fila de la frase de la cena")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_juegos_card_opens_frases():
    """Jugar › Juegos tiene la tarjeta «Frases mágicas» (con su dibujo, sin estrellas ni récord, «La frase de la cena»
    o «Tus sellos: N» abajo); tocarla abre #/frases con la pestaña Jugar marcada, sin título grande, y la cápsula de
    volver dice «Juegos». #/juegos/frases lleva a #/frases."""
    probs = []
    page = _page()
    try:
        _open(page, "#/juegos", _keys(phrase__stamps={"v": 1, "days": [_day(C.FIXED_NOW - _dt.timedelta(days=1))], "n": 3}))
        page.wait_for_selector(".gm-card[data-g=frases]", timeout=6000)
        c = page.evaluate("""() => { const a = document.querySelector('.gm-card[data-g=frases]'), i = a.querySelector('img');
          return {href: a.getAttribute('href'), img: i.complete && i.naturalWidth > 0, src: i.getAttribute('src'), t: a.querySelector('.gm-ct').textContent,
            line: a.querySelector('.gm-rt').textContent, stars: a.querySelectorAll('.gm-st, .star').length}; }""")
        if c["href"] != "#/frases" or not c["img"] or c["t"] != "Frases mágicas" or c["line"] != "Tus sellos: 3":
            probs.append(f"tarjeta: {c}")
        page.locator(".gm-card[data-g=frases]").click()
        page.wait_for_selector("#ph-line", timeout=6000)
        bk = page.evaluate("() => [document.getElementById('dv-back').getAttribute('href'), document.getElementById('dv-back').textContent.trim(), document.getElementById('tabhead').hidden, document.querySelector('#tab-jugar').getAttribute('aria-selected')]")
        if C.current_hash(page) != "frases" or bk != ["#/juegos", "Juegos", True, "true"]:
            probs.append(f"#/frases desde Juegos: #{C.current_hash(page)} {bk}")
        C.goto(page, "#/juegos/frases")
        page.wait_for_timeout(300)
        if C.current_hash(page) != "frases":
            probs.append(f"#/juegos/frases va a #{C.current_hash(page)}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_works_in_english_french_and_danish():
    """En inglés, francés y danés: #/frases trae 3-4 dibujos (en danés, sin palabras sabidas, las fáciles: nunca vacío),
    la frase lleva lang del idioma, poner un dibujo completa la frase y la traducción, la voz habla en ese idioma,
    «Otra frase» cambia de plantilla y #/frases/cena funciona. En francés, si una plantilla tiene 4 palabras que sabe,
    los dibujos son de esas."""
    probs = []
    for L, code in LANGS.items():
        page = _page()
        try:
            _open(page, "#/frases", _keys(lang=L))
            st = page.evaluate(_ST)
            if st["lang"] != L or not 3 <= len(st["choices"]) <= 4:
                probs.append(f"{L}: {st}")
                continue
            if page.evaluate("() => document.getElementById('ph-line').lang") != code:
                probs.append(f"{L}: la frase no lleva lang={code}")
            info = page.evaluate("""async L => { const s = vocabPhrases.state(), m = srsAll();
              const all = await vocabPhrases.cands(L, s.tpl), known = new Set(all.filter(f => m[f.ref] && m[f.ref].b >= 1).map(f => f.core.toLowerCase()));
              return {known: known.size, chosenKnown: s.choices.filter(c => m[c.ref] && m[c.ref].b >= 1).length, any: Object.values(m).some(x => x.b >= 1)}; }""", L)
            if info["known"] >= 4 and info["chosenKnown"] != len(st["choices"]):
                probs.append(f"{L}: la plantilla tiene {info['known']} palabras sabidas y solo salen {info['chosenKnown']}")
            page.evaluate("() => { window.__log = []; }")
            page.locator(".ph-tile").first.click()
            page.wait_for_timeout(100)
            st1 = page.evaluate(_ST)
            if st1["text"] != st["choices"][0]["text"] or st["choices"][0]["core"] not in st1["text"] or "___" in page.evaluate("() => document.getElementById('ph-es').textContent"):
                probs.append(f"{L}: al poner «{st['choices'][0]['core']}»: «{st1['text']}» / «{st1['es']}»")
            _wait_quiet(page, 5000)
            langs = {x["lang"] for x in page.evaluate("() => window.__log") if x["k"] == "speak"}
            if langs and langs != {code}:
                probs.append(f"{L}: la voz habla en {langs}")
            page.locator("#ph-next").click()
            page.wait_for_function(f"() => vocabPhrases.state().tpl !== {json.dumps(st['tpl'])}", timeout=5000)
            C.goto(page, "#/frases/cena")
            page.wait_for_selector("#ph-line", timeout=6000)
            c = page.evaluate(_ST)
            if c["mode"] != "cena" or not c["text"]:
                probs.append(f"{L}: #/frases/cena {c}")
            probs += [f"{L}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_export_matches_baseline():
    """La partida sembrada, tras recorrer #/juegos, #/frases (poniendo una palabra y con «Otra frase»), #/frases/cena y
    Hoy sin sellar, se exporta igual que tests/e2e/baseline/export.json (sin claves nuevas); tras sellar, la única clave
    nueva es "phrase:stamps" (y game cambia solo por las 5 monedas)."""
    base = C.load_baseline()
    assert base, "falta tests/e2e/baseline/export.json"
    probs = []
    page = _page()
    try:
        _open(page, "#/juegos")
        C.goto(page, "#/frases")
        page.wait_for_selector(".ph-tile", timeout=6000)
        page.locator(".ph-tile").first.click()
        _wait_quiet(page, 5000)
        page.locator("#ph-next").click()
        page.wait_for_timeout(400)
        for h in ("#/frases/cena", "#/"):
            C.goto(page, h)
        snap = C.export(page)
        keys = dict(snap["keys"])
        k = "album:uniq:english"
        keys[k] = base["keys"].get(k, keys.get(k))
        probs += C.diff_exports(base, dict(snap, keys=keys), allow_new=False)
        C.goto(page, "#/frases/cena")
        page.evaluate(_PASS)
        page.locator("#ph-stamp").click()
        page.wait_for_selector("#ph-done", timeout=4000)
        snap2 = C.export(page)
        keys2 = dict(snap2["keys"])
        keys2[k] = base["keys"].get(k, keys2.get(k))
        g0, g1 = json.loads(base["keys"]["game"]), json.loads(keys2["game"])
        if g1.get("coins") != g0.get("coins") + 5 or g1.get("earned") != g0.get("earned") + 5:
            probs.append(f"game tras sellar: {g0.get('coins')} → {g1.get('coins')}")
        keys2["game"] = base["keys"]["game"]
        d = C.diff_exports(base, dict(snap2, keys=keys2), allow_new=["phrase:stamps"])
        probs += [f"tras sellar: {x}" for x in d]
        if "phrase:stamps" not in keys2:
            probs.append("tras sellar no está phrase:stamps")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "la partida cambió:\n  " + "\n  ".join(probs)


# ---------------------------------------------------------------- capturas
def test_captures_and_audit():
    """Capturas en /mnt/project-files/rediseno/capturas/F5/ (F5d-*): #/frases con el hueco, con la palabra puesta, la
    frase de la cena, la cena sellada, Hoy con la fila y Juegos con la tarjeta; móvil y escritorio, claro y oscuro. En
    todas: contraste suficiente, sin colores fuera de la paleta y sin vidrio en el contenido."""
    probs = []
    for kind in ("phone", "desk"):
        for scheme in ("light", "dark"):
            tag = f"F5d-{kind}-{scheme}"
            page = _page(kind, color_scheme=scheme, reduced_motion="reduce")
            try:
                _open(page, "#/frases")

                def snap(name, scroll_to=None):
                    page.evaluate(_FINISH)
                    page.wait_for_timeout(150)
                    if scroll_to:
                        page.evaluate("s => { const el = document.querySelector(s); if (el) el.scrollIntoView({block: 'center'}); }", scroll_to)
                        page.wait_for_timeout(100)
                    a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
                    for x in a["contrast"] + a["palette"]:
                        probs.append(f"{tag}-{name}: {x}")
                    C.shot(page, f"{tag}-{name}", OUT, full_page=False)
                snap("frases")
                page.locator(".ph-tile").first.click()
                _wait_quiet(page, 5000)
                snap("frases-puesta")
                C.goto(page, "#/frases/cena")
                page.wait_for_selector("#ph-stamp", timeout=6000)
                snap("cena")
                page.evaluate(_PASS)
                page.locator("#ph-stamp").click()
                page.wait_for_selector("#ph-done", timeout=4000)
                page.wait_for_timeout(2600)
                snap("cena-sellada", "#ph-cena")
                C.goto(page, "")
                page.wait_for_selector("#ph-hrow", timeout=6000)
                snap("hoy")
                C.goto(page, "#/juegos")
                page.wait_for_selector(".gm-card[data-g=frases]", timeout=6000)
                snap("juegos", ".gm-card[data-g=frases]")
                probs += [f"{tag}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)
