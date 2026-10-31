"""«¿Qué oíste?» (js/oido.js): entrenamiento del oído con pares mínimos (identificación con 2 opciones y respuesta
después de cada palabra).
Datos: en cada idioma, 3 contrastes de nivel 1, 6 hasta el 2 y todos en el 3; cada palabra con su audio grabado
(audio/<ab>.json y el mp3), su IPA (la del corpus), su español y su dibujo si lo tiene; las dos palabras de cada par
suenan distinto. Ronda: 20 palabras; suena siempre el audio grabado de la palabra buena (nunca la voz del navegador);
acierto en verde azulado con ✓; fallo: la elegida en gris con ✗, la buena con ✓ y suenan las dos (la elegida y luego la
buena) y «Seguir»; el par fallado vuelve con la misma palabra 3 a 5 palabras después; solo contrastes del nivel; teclas 1/2,
Espacio, T (despacio) y Enter. Al final: estrellas por aciertos, récord «N de 20», IPA en la lista, nada al repaso y
★★★ abre el nivel 2 («Nivel 2» en la partida siguiente, con sus contrastes). Francés y danés con sus audios. La tarjeta:
dibujo de 220 px en «Juegos de palabras», sin tema («No usa el tema» en el vistazo y en la explicación), explicación de
15 palabras como mucho y las teclas solo con teclado. A 360 y 390 px (claro y oscuro), 1280 px y con «Reducir
movimiento»: nada se sale de lado, contraste ≥ 4,5:1 y colores permitidos. Capturas en capturas/juegos2."""
from __future__ import annotations

import json
import re

import common as C
import test_f4_juegos as J

OUT = C.CAPTURAS / "juegos2"
AB = {"english": "en", "français": "fr", "dansk": "da"}
T = int(C.FIXED_NOW.timestamp() * 1000)
CLIPS = {ab: json.loads((C.ROOT / "audio" / f"{ab}.json").read_text(encoding="utf-8")) for ab in AB.values()}
_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
# la voz del navegador: cada speak() con texto se apunta (el que desbloquea la voz en iOS dice " ")
_TTS = """() => { if (window.__ttsOn) return; window.__ttsOn = true; window.__tts = [];
  const sp = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = u => { if (u && u.text && u.text.trim()) __tts.push(u.text); return sp(u); }; }"""
_STATE = """() => { const r = document.getElementById('oi'); if (!r) return null;
  const cs = [...r.querySelectorAll('#oi-cards .oi-c')];
  return {t: r.oiTarget, done: r.classList.contains('oi-done'), txt: document.getElementById('oi-txt').textContent,
    cards: cs.map(c => { const s = getComputedStyle(c), mk = c.querySelector('.oi-mk');
      return {w: c.dataset.w, ok: !!c.oiOk, cls: c.className, bg: s.backgroundColor, mkbg: getComputedStyle(mk).backgroundColor,
        mk: (mk.querySelector('use') || {getAttribute: () => ''}).getAttribute('href'), lang: c.querySelector('.oi-w').lang,
        ipa: (() => { const e = c.querySelector('.ipa'); if (!e) return ''; const k = e.cloneNode(true);
          k.querySelectorAll('.vh').forEach(v => v.remove()); return k.textContent.replace(/\u2060/g, ''); })(), pic: !!c.querySelector('.oi-pic img'),
        name: (c.getAttribute('aria-labelledby') || '').split(' ').map(id => (document.getElementById(id) || {}).textContent || '').join(' ').trim()}; }),
    go: !!document.getElementById('oi-go'), dots: r.querySelectorAll('#gm-dots i').length,
    lv: (r.querySelector('.gm-stats') || {}).textContent || ''}; }"""
_CLIP = "w => 'audio/' + ({english: 'en', 'français': 'fr', dansk: 'da'})[lang] + '/' + clipFor(w) + '.mp3'"


def _keys(lang="english", lv=None):
    k = C.seed_data()
    k["lang"] = lang
    if lv:
        k["games:best"]["oido"] = {"score": 12, "stars": 1, "plays": 1, "at": T - 3600 * 1000, "lv": lv}
    return {kk: json.dumps(vv, ensure_ascii=False) for kk, vv in k.items()}   # un texto suelto se escribiría sin comillas


def _open(page, lang="english", lv=None):
    J._open(page, _keys(lang, lv))
    page.evaluate(_TTS)
    J._start(page, "oido")
    page.wait_for_selector("#oi-cards .oi-c", timeout=8000)


def _ready(page):
    page.wait_for_function("""() => { const r = document.getElementById('oi');
      return r && !r.classList.contains('oi-done') && r.querySelectorAll('#oi-cards .oi-c').length === 2 && r.oiTarget; }""", timeout=8000)


def _round(page, wrong=False, key=False):
    """Contesta la palabra que suena (bien o mal): {t, pick, st (después de contestar), played (lo que sonó al empezar)}."""
    _ready(page)
    page.wait_for_timeout(700)   # la palabra suena sola al empezar la ronda
    st0 = page.evaluate(_STATE)
    n0 = page.evaluate("() => __played.length")
    k = next(i for i, c in enumerate(st0["cards"]) if c["ok"] != wrong)
    if key:
        page.keyboard.press(str(k + 1))
    else:
        page.locator("#oi-cards .oi-c").nth(k).click()
    page.wait_for_timeout(150)
    return {"t": st0["t"], "pick": st0["cards"][k]["w"], "other": st0["cards"][1 - k]["w"], "st": page.evaluate(_STATE), "st0": st0, "n0": n0}


def _gray(c):
    return J._gray(c)


def _teal(c):
    r, g, b = J._rgb(c)[:3]
    return r < 40 and 100 < g < 150 and 120 < b < 170


def _words(pairs, lv):
    return {x[0] for l, ps in pairs if l <= lv for p in ps for x in p}


# ---------------------------------------------------------------- datos
def test_oido_pairs_have_recorded_audio_and_corpus_ipa():
    """Cada idioma: 3 contrastes de nivel 1, 6 hasta el 2 y más en el 3; cada palabra con audio grabado (en
    audio/<ab>.json y el mp3 existe), la IPA del corpus (data/*.json), español y, si tiene, un dibujo que existe; las dos
    palabras de cada par son distintas y su IPA también."""
    probs = []
    corpus = {}
    for f in (C.ROOT / "data").glob("*.json"):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(d, dict) or not isinstance(d.get("rows"), list):
            continue
        for r in d["rows"]:
            for L, x in ((r.get("l") or {}).items() if isinstance(r, dict) else []):
                if isinstance(x, dict) and x.get("word"):
                    corpus.setdefault(L, {}).setdefault(x["word"], set()).add(x.get("ipa") or "")
    page = C.new_page("desk")
    try:
        C.seed(page, None, "#/juegos")
        page.wait_for_selector('.gm-card[data-g="oido"]', timeout=8000)
        P = page.evaluate("() => vocabOido.pairs()")
    finally:
        page.context.close()
    for L, ab in AB.items():
        cs = P.get(L) or []
        lv = [c[0] for c in cs]
        if lv.count(1) != 3 or sum(1 for v in lv if v <= 2) != 6 or len(cs) <= 6 or lv != sorted(lv):
            probs.append(f"{L}: niveles de los contrastes {lv}")
        for l, ps in cs:
            for a, b in ps:
                if a[0] == b[0] or a[1] == b[1]:
                    probs.append(f"{L}: par igual {a} {b}")
                for w, ipa, img, es in (a, b):
                    clip = CLIPS[ab].get(w)
                    if not clip or not (C.ROOT / "audio" / ab / f"{clip}.mp3").exists():
                        probs.append(f"{L}: «{w}» sin audio grabado")
                    if not re.match(r"^/.+/$", ipa or "") or ipa not in corpus.get(L, {}).get(w, set()):
                        probs.append(f"{L}: «{w}» IPA {ipa!r} (corpus: {corpus.get(L, {}).get(w)})")
                    if not es.strip():
                        probs.append(f"{L}: «{w}» sin español")
                    if img and not (C.ROOT / img).exists():
                        probs.append(f"{L}: «{w}» dibujo que no existe {img}")
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- partida
def test_oido_round_feedback_audio_retry_and_level_up():
    """Una ronda de 20 en inglés, nivel 1 (dos fallos): suena siempre el audio grabado de la palabra buena y nunca la voz
    del navegador; acierto en verde azulado con ✓; fallo con la elegida gris ✗, la buena ✓, suenan la elegida y luego la
    buena y «Seguir»; el par fallado vuelve 3 a 5 palabras después con la misma palabra; solo palabras de nivel 1. Final:
    18 de 20 → ★★★, «¡Nivel 2!», récord «18 de 20», IPA en la lista, nada al repaso. La partida siguiente es de nivel 2 y
    trae sus contrastes."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page)
        P = page.evaluate("() => vocabOido.pairs().english")
        lv1, lv2 = _words(P, 1), _words(P, 2) - _words(P, 1)
        srs0 = page.evaluate("() => localStorage.getItem('srs:english')")
        st = page.evaluate(_STATE)
        if st["dots"] != 20 or "Nivel 1" not in st["lv"]:
            probs.append(f"inicio: {st['dots']} puntos, «{st['lv']}»")
        targets, misses = [], {}
        for r in range(20):
            wrong = r in (1, 7)
            info = _round(page, wrong=wrong)
            t = info["t"]
            targets.append(t)
            want = page.evaluate(_CLIP, t)
            first = page.evaluate("n => __played.slice(n).map(p => p.src)", info["n0"] - 1)
            played0 = page.evaluate("() => __played.map(p => p.src)")
            if want not in played0:
                probs.append(f"ronda {r + 1}: no sonó el audio de «{t}» ({want})")
            if t not in lv1:
                probs.append(f"ronda {r + 1}: «{t}» no es de nivel 1")
            s = info["st"]
            mine = next(c for c in s["cards"] if c["w"] == info["pick"])
            right = next(c for c in s["cards"] if c["ok"])
            if any(c["lang"] != "en-GB" or not c["ipa"].startswith("/") for c in s["cards"]):
                probs.append(f"ronda {r + 1}: tarjetas sin lang o sin IPA {s['cards']}")
            if not wrong:
                if "is-ok" not in mine["cls"] or not _teal(mine["bg"]) or mine["mk"] != "#i-check-bold":
                    probs.append(f"ronda {r + 1}: acierto {mine}")
                page.wait_for_timeout(1300)
                continue
            misses[r] = t
            if "is-miss" not in mine["cls"] or not _gray(mine["bg"]) or not _gray(mine["mkbg"]) or mine["mk"] != "#i-x-bold":
                probs.append(f"ronda {r + 1}: fallo {mine}")
            if "is-right" not in right["cls"] or not _teal(right["bg"]) or right["mk"] != "#i-check-bold":
                probs.append(f"ronda {r + 1}: la buena {right}")
            if not s["go"] or "Era" not in s["txt"]:
                probs.append(f"ronda {r + 1}: sin «Seguir» o sin texto: {s['txt']!r}")
            page.wait_for_timeout(1500)
            after = page.evaluate("n => __played.slice(n).map(p => p.src)", info["n0"])
            pa, pt = page.evaluate(_CLIP, info["pick"]), page.evaluate(_CLIP, t)
            if pa not in after or pt not in after or after.index(pa) > len(after) - 1 - after[::-1].index(pt):
                probs.append(f"ronda {r + 1}: tras el fallo sonó {after} (la elegida {pa} y luego la buena {pt})")
            if r == 7:
                page.keyboard.press("Enter")
            else:
                page.locator("#oi-go").click()
        for r, t in misses.items():
            back = [k for k in range(r + 3, min(20, r + 6)) if targets[k] == t]
            if not back:
                probs.append(f"«{t}» (fallada en la {r + 1}) no vuelve 3 a 5 después: {targets}")
        page.wait_for_selector("#gm-end", timeout=8000)
        page.wait_for_timeout(1800)
        end = page.evaluate("""() => ({stars: document.querySelectorAll('.gm-end-st .gm-es.on').length, lvup: (document.getElementById('gm-lvup') || {}).textContent || '',
          line: (document.querySelector('.gm-end-l') || {}).textContent || '', ipa: document.querySelectorAll('#gm-wl .ipa').length,
          words: document.querySelectorAll('#gm-wl .gm-wc').length, miss: document.querySelectorAll('#gm-wl .gm-miss').length,
          rv: !!document.getElementById('gm-rv'), best: JSON.parse(localStorage.getItem('games:best')).oido, tts: __tts.slice()})""")
        if end["stars"] != 3 or "Nivel 2" not in end["lvup"] or end["best"].get("lv") != 2 or end["best"].get("score") != 18:
            probs.append(f"final: {end}")
        if "18 de 20" not in end["line"] or not end["ipa"] or end["ipa"] < end["words"] or end["miss"] < 1 or end["rv"]:
            probs.append(f"resultado: {end}")
        if end["tts"]:
            probs.append(f"habló la voz del navegador: {end['tts']}")
        if page.evaluate("() => localStorage.getItem('srs:english')") != srs0:
            probs.append("las palabras fueron al repaso")
        rec = page.evaluate("() => vocabGames.level('oido')")
        if rec != 2:
            probs.append(f"vocabGames.level('oido') = {rec}")
        # la partida siguiente: nivel 2, con sus contrastes
        page.wait_for_timeout(700)
        page.locator("#gm-again").click()
        seen = set()
        for r in range(20):
            info = _round(page)
            seen.add(info["t"])
            if r == 0 and "Nivel 2" not in info["st0"]["lv"]:
                probs.append(f"la partida siguiente no es de nivel 2: {info['st0']['lv']!r}")
            page.wait_for_timeout(1300)
        if not seen & lv2 or seen - _words(P, 2):
            probs.append(f"nivel 2: palabras {sorted(seen)}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_oido_keys_slow_and_replay():
    """Con teclado: Espacio repite el audio, T lo dice despacio (velocidad 0,7), 2 elige, Enter sigue tras un fallo."""
    probs = []
    page = C.new_page("desk")
    try:
        _open(page)
        _ready(page)
        page.wait_for_timeout(700)
        t = page.evaluate("() => document.getElementById('oi').oiTarget")
        want = page.evaluate(_CLIP, t)
        n0 = page.evaluate("() => __played.length")
        page.keyboard.press("Space")
        page.wait_for_timeout(200)
        page.keyboard.press("t")
        page.wait_for_timeout(200)
        pl = page.evaluate("n => __played.slice(n)", n0)
        if [p["src"] for p in pl] != [want, want] or abs(pl[1]["rate"] - 0.7) > .01 or abs(pl[0]["rate"] - 0.7) < .01:
            probs.append(f"Espacio y T: {pl} (se esperaba {want} normal y despacio)")
        info = _round(page, wrong=True, key=True)
        if "is-miss" not in next(c for c in info["st"]["cards"] if c["w"] == info["pick"])["cls"]:
            probs.append(f"la tecla no eligió: {info['st']}")
        page.wait_for_timeout(300)
        page.keyboard.press("Enter")
        page.wait_for_timeout(300)
        if page.evaluate("() => document.getElementById('oi').classList.contains('oi-done')"):
            probs.append("Enter no siguió")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_oido_french_and_danish():
    """Francés (nivel 1) y danés (nivel 3, los 10 contrastes en 20 palabras): suena el audio grabado de su idioma, las
    tarjetas llevan su lang y su IPA y el dibujo solo si las dos lo tienen."""
    probs = []
    for L, lv, code in (("français", None, "fr-FR"), ("dansk", 3, "da-DK")):
        page = C.new_page("phone")
        try:
            _open(page, L, lv)
            P = page.evaluate("L => vocabOido.pairs()[L]", L)
            of = {x[0]: i for i, (l, ps) in enumerate(P) for p in ps for x in p}
            pics = {x[0]: bool(x[2]) for l, ps in P for p in ps for x in p}
            seen = set()
            for r in range(20 if lv == 3 else 4):
                info = _round(page)
                t = info["t"]
                seen.add(of[t])
                if page.evaluate(_CLIP, t) not in page.evaluate("() => __played.map(p => p.src)"):
                    probs.append(f"{L}: no sonó «{t}»")
                for c in info["st"]["cards"]:
                    if c["lang"] != code or not c["ipa"].startswith("/") or not c["name"].startswith(c["w"]):
                        probs.append(f"{L}: tarjeta {c}")   # el nombre lleva la palabra entera («en sol», no «ensol»)
                want_pic = all(pics[c["w"]] for c in info["st"]["cards"])
                if any(c["pic"] != want_pic for c in info["st"]["cards"]):
                    probs.append(f"{L}: dibujos {info['st']['cards']}")
                if L == "français" and P[of[t]][0] != 1:
                    probs.append(f"{L}: «{t}» no es de nivel 1")
                page.wait_for_timeout(1300)
            if lv == 3 and len(seen) != len(P):
                probs.append(f"{L}: nivel 3 con {len(seen)} de {len(P)} contrastes")
            if page.evaluate("() => __tts.slice()"):
                probs.append(f"{L}: habló la voz del navegador")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- tarjeta
def test_oido_card_peek_and_intro():
    """La tarjeta en «Juegos de palabras» con su dibujo de 220 px y «Nuevo»; no usa el tema (meta.topic false; «No usa el
    tema» en el vistazo y en la explicación); la explicación en 15 palabras como mucho; las teclas solo con teclado."""
    probs = []
    for kind in ("phone", "desk"):
        page = C.new_page(kind)
        try:
            J._open(page, _keys())
            m = page.evaluate("""() => { const c = document.querySelector('.gm-card[data-g="oido"]'), i = c.querySelector('img');
              return {sec: c.closest('.gm-grp').dataset.sec, nw: i.naturalWidth, src: i.getAttribute('src'), nuevo: !!c.querySelector('.gm-new'),
                meta: vocabGames.meta('oido')}; }""")
            if m["sec"] != "palabras" or m["src"] != "img/games/oido.png" or not m["nuevo"] or m["meta"]["topic"]:
                probs.append(f"{kind} tarjeta: {m}")
            nw = page.evaluate("""() => new Promise(r => { const i = document.querySelector('.gm-card[data-g="oido"] img');
              if (i.complete && i.naturalWidth) r(i.naturalWidth); else i.onload = () => r(i.naturalWidth); })""")
            if nw != 220:
                probs.append(f"{kind}: dibujo de {nw} px")
            page.evaluate("() => vocabGames.peek('oido')")
            page.wait_for_selector("dialog#gm-peek[open]", timeout=3000)
            pk = page.evaluate("() => document.getElementById('gm-peek').textContent")
            if "No usa el tema" not in pk:
                probs.append(f"{kind} vistazo: {pk!r}")
            page.evaluate("() => document.querySelectorAll('dialog[open]').forEach(d => d.close())")
            J._start(page, "oido", intro=None)
            page.wait_for_selector(".gm-intro .gm-go", timeout=5000)
            it = page.evaluate("""() => ({how: (document.getElementById('gm-in-p') || {}).textContent || '', keys: !!document.querySelector('.gm-intro .gm-keys'),
              txt: document.querySelector('.gm-intro').textContent})""")
            if not it["how"] or len(it["how"].split()) > 15:
                probs.append(f"{kind}: explicación de {len(it['how'].split())} palabras: {it['how']!r}")
            if it["keys"] != (kind == "desk"):
                probs.append(f"{kind}: teclas en la explicación = {it['keys']}")
            if "No usa el tema" not in it["txt"]:
                probs.append(f"{kind}: la explicación no dice que no usa el tema: {it['txt']!r}")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_oido_layout_contrast_and_captures():
    """360×740 y 390×844 (claro y oscuro), 1280 y «Reducir movimiento»: las dos tarjetas y «Seguir» se ven sin salirse de
    lado, contraste ≥ 4,5:1 y colores permitidos en la pregunta, el fallo y el resultado. Capturas en capturas/juegos2."""
    probs = []
    OUT.mkdir(parents=True, exist_ok=True)

    def audit(page, label):
        page.evaluate(J._FINISH)
        a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
        probs.extend(f"{label} contraste: {x}" for x in a["contrast"] if any(s in x for s in ("oi", "gm-")))
        probs.extend(f"{label} paleta: {x}" for x in a["palette"] if any(s in x for s in ("oi", "gm-")))

    for kind, w, h, scheme, rm in (("phone", 360, 740, "light", "no-preference"), ("phone", 390, 844, "dark", "no-preference"),
                                   ("phone", 360, 740, "dark", "no-preference"), ("desk", 1280, 800, "light", "no-preference"),
                                   ("phone", 390, 844, "light", "reduce")):
        tag = f"oido-{w}-{scheme}" + ("-rm" if rm == "reduce" else "")
        page = C.new_page(kind, color_scheme=scheme, reduced_motion=rm)
        try:
            page.set_viewport_size({"width": w, "height": h})
            _open(page, "dansk" if w == 360 and scheme == "dark" else "english")
            _ready(page)
            page.wait_for_timeout(700)
            audit(page, f"{tag} pregunta")
            C.shot(page, f"{tag}-pregunta", OUT, full_page=False)
            info = _round(page, wrong=True)
            page.wait_for_timeout(400)
            geo = page.evaluate("""() => { const cs = [...document.querySelectorAll('#oi-cards .oi-c')].map(c => c.getBoundingClientRect()), g = document.getElementById('oi-go').getBoundingClientRect();
              return {sw: document.documentElement.scrollWidth, iw: innerWidth, ih: innerHeight, cards: cs.map(r => [Math.round(r.left), Math.round(r.right), Math.round(r.width)]), go: [Math.round(g.top), Math.round(g.bottom), Math.round(g.height)]}; }""")
            if geo["sw"] > geo["iw"] + 1 or any(l < 0 or r > geo["iw"] for l, r, _ in geo["cards"]) or geo["go"][1] > geo["ih"] or geo["go"][2] < 44:
                probs.append(f"{tag}: medidas {geo}")
            if min(c[2] for c in geo["cards"]) < 140:
                probs.append(f"{tag}: tarjetas estrechas {geo['cards']}")
            audit(page, f"{tag} fallo")
            C.shot(page, f"{tag}-fallo", OUT, full_page=False)
            page.locator("#oi-go").click()
            if rm == "reduce" or kind == "desk":
                for r in range(19):
                    _round(page, wrong=(r % 5 == 2))
                    if r % 5 == 2:
                        page.wait_for_selector("#oi-go", timeout=5000)
                        page.locator("#oi-go").click()
                    else:
                        page.wait_for_timeout(1300)
                page.wait_for_selector("#gm-end", timeout=8000)
                page.wait_for_timeout(1800)
                audit(page, f"{tag} resultado")
                C.shot(page, f"{tag}-resultado", OUT, full_page=False)
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)
