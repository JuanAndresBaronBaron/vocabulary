"""F6j (SPEC §5-J): «El zorro te llama» (js/calls.js y data/calls/).

A veces, al abrir la app, el zorro llama por «teléfono» desde Londres, París o Copenhague (como mucho una vez al día,
nunca el primer día de uso, nunca durante una lección, un repaso, una partida o un cuento ni con una hoja o un diálogo
abiertos, y solo si el navegador tiene una voz de ese idioma). La llamada entrante es una pantalla entera, oscura y en
silencio, como la del iPhone: la foto del zorro grande, «Zorro · Londres», «Contestar» (deslizar o tocar) y «Ahora no».
Al contestar habla con la voz elegida (useVoice), con subtítulos en el idioma y sus palabras clave iluminadas (tocar una
abre un globo con su IPA y su audio grabado) y hace 3 o 4 preguntas con 2 o 3 dibujos (tocar, teclas 1-3 o «Dilo» con el
micrófono). Al acabar, award() una vez por llamada y día. Si no se contesta, Hoy enseña «1 llamada perdida» (HOME_SLOTS
"call") y al tocarla se le devuelve la llamada. «Llamadas del zorro» en Para mayores (encendido de serie) las apaga.

En el navegador de las pruebas (navigator.webdriver) nunca suena sola: aquí se quita esa marca con un guion de inicio y
la sesión de la pestaña («vocab:call-s» en sessionStorage) se deja «con llamada» (p: 1) o «sin llamada» (p: 0) en vez de
tirar el dado. Las voces son las de Edge en Windows (test_voces.EDGE): speechSynthesis.speak se espía en __spoken y
HTMLMediaElement.play en __played; las monedas, con bus "coins" en __coins. El reloj es el del arnés (page.clock)."""
from __future__ import annotations

import datetime as dt
import json
import re

import common as C
import test_f5_int as I5
import test_voces as V

OUT = C.CAPTURAS / "F6"
_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
_A11Y_P = C.HERE / "a11y.js"
_PASS = "() => sessionStorage.setItem('vocab:gate', String(Date.now() + adultGate.MS))"
_AB = {"english": "en", "français": "fr", "dansk": "da"}
_CITY = {"english": "Londres", "français": "París", "dansk": "Copenhague"}
_CODE = {"english": "en-GB", "français": "fr-FR", "dansk": "da-DK"}
_WD = "Object.defineProperty(Navigator.prototype, 'webdriver', {get: () => false, configurable: true});"
_SPY = r"""(() => {
  window.__played = []; window.__coins = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { try { window.__played.push(String(this.src || '')); } catch (e) {} return play.apply(this, arguments); };
  document.addEventListener('DOMContentLoaded', () => { try { bus.on('coins', e => window.__coins.push(e)); } catch (e) {} });
})();"""
_CUR = "() => vocabCalls.current"
_ST = "() => vocabCalls.state()"
_ARM = "on => sessionStorage.setItem('vocab:call-s', JSON.stringify({t: Date.now(), done: true, p: on ? 1 : 0}))"
_OPEN = "() => !!document.querySelector('dialog#cl-dlg[open]')"
_PAID = "() => window.__coins.filter(e => e.why === '¡Llamada del zorro!')"
_SLOTS = I5._SLOTS
_FINISH = I5._FINISH
_BOX = """s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect();
  return {w: r.width, h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right}; }"""
_ROW = "() => { const r = document.querySelector('[data-slot=call] #cl-row'); return r && r.offsetParent ? r.textContent.replace(/\\s+/g, ' ').trim() : null; }"


def _day(now, n):
    return C.day_key(now + dt.timedelta(days=n))


def _page(kind="phone", voices=None, **kw):
    page = C.new_page(kind, **kw)
    page.add_init_script(f"{V._FAKE}({json.dumps({'voices': V.EDGE if voices is None else voices, 'delay': 0}, ensure_ascii=False)})")
    page.add_init_script(_WD)
    page.add_init_script(_SPY)
    return page


def _keys(now=C.FIXED_NOW, lang=None, calls=None, **top):
    k = dict(C.seed_keys(now))
    if lang:
        k["lang"] = json.dumps(lang, ensure_ascii=False)
    if calls is not None:
        k["calls"] = json.dumps(calls, ensure_ascii=False)
    for n, v in top.items():
        k[n.replace("__", ":")] = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    return k


def _seed(page, keys=None, hash="", armed=True, now=C.FIXED_NOW):
    """Como C.seed, y la sesión de esta pestaña ya decidida antes de arrancar: armed=True suena en cuanto pueda."""
    keys = _keys(now) if keys is None else dict(keys)
    keys = {k: (v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)) for k, v in keys.items()}
    page.goto(C.base_url(page) + "/__blank", wait_until="domcontentloaded")
    page.evaluate("""([keys, on]) => { localStorage.clear(); sessionStorage.clear();
      for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v);
      sessionStorage.setItem('vocab:call-s', JSON.stringify({t: Date.now(), done: true, p: on ? 1 : 0})); }""", [keys, armed])
    C.goto(page, hash)


def _again(page, hash=""):
    """Otra sesión con llamada (otra vez la app abierta) en la misma pestaña."""
    page.evaluate(_ARM, True)
    if hash:
        C.goto(page, hash, reload=True)
    else:
        C.reload(page)


def _ring(page, ms=3500):
    page.clock.run_for(ms)
    page.wait_for_selector("dialog#cl-dlg[open] .cl-ring", timeout=6000)
    page.wait_for_timeout(150)


def _rings(page, ms=9000):
    """¿Suena en los próximos ms (del reloj de la página)?"""
    for _ in range(ms // 1500):
        page.clock.run_for(1500)
        page.wait_for_timeout(40)
        if page.evaluate(_OPEN):
            return True
    return page.evaluate(_OPEN)


def _answer(page):
    page.locator("#cl-yes").click()
    page.wait_for_function("() => vocabCalls.current && vocabCalls.current.mode === 'talk'", timeout=4000)


def _slide(page):
    """Contesta deslizando el botón verde hacia la derecha (como en el iPhone)."""
    b = page.evaluate(_BOX, ".cl-knob")
    x, y = b["left"] + b["w"] / 2, b["top"] + b["h"] / 2
    page.mouse.move(x, y)
    page.mouse.down()
    for i in range(1, 11):
        page.mouse.move(x + 28 * i, y)
        page.wait_for_timeout(16)
    page.mouse.up()
    page.wait_for_function("() => vocabCalls.current && vocabCalls.current.mode === 'talk'", timeout=4000)


def _to_wait(page, steps=160):
    """Deja correr la llamada hasta la siguiente pregunta (o hasta que cuelga: None)."""
    cur = None
    for _ in range(steps):
        cur = page.evaluate(_CUR)
        if not cur or cur["phase"] == "wait":
            return cur
        page.clock.run_for(500)
        page.wait_for_timeout(25)
    raise AssertionError(f"la llamada no llega a una pregunta: {cur}")


def _oks(page, cid):
    return page.evaluate("async id => (await vocabCalls.get(id)).lines.map(l => !l.a ? null : typeof l.ok === 'number' ? l.ok : -1)", cid)


def _pick(page, j):
    i = page.evaluate(_CUR)["i"]
    page.locator("#cl-ans .cl-a").nth(j).click()
    page.wait_for_function("i => { const c = vocabCalls.current; return !c || c.i !== i || c.phase !== 'wait'; }", arg=i, timeout=4000)


def _finish(page, wrong=False):
    """Contesta las preguntas que quedan (la buena, o una mala con wrong) y espera a que cuelgue. Devuelve cuántas."""
    cur = page.evaluate(_CUR)
    oks = _oks(page, cur["id"])
    n = 0
    while True:
        cur = _to_wait(page)
        if not cur:
            break
        ok = oks[cur["i"]]
        j = max(0, ok)
        if wrong and ok >= 0:
            j = 1 if ok == 0 else 0
        _pick(page, j)
        n += 1
    page.wait_for_timeout(200)
    return n


def _hang(page):
    page.locator("#cl-hang").click()
    for _ in range(12):
        page.clock.run_for(500)
        page.wait_for_timeout(30)
        if not page.evaluate(_OPEN):
            return True
    return False


def _a11y(page):
    a = page.evaluate(_A11Y_P.read_text(encoding="utf-8"), {})
    return [f"{k}: {x}" for k in ("names", "roles", "images", "targets", "ids", "dialogs", "focusable") for x in a.get(k, [])]


def _hoy(page):
    C.goto(page, "#/juegos")
    C.goto(page, "")
    page.wait_for_timeout(500)
    page.evaluate(_FINISH)


# ---------------------------------------------------------------- los guiones
def _row(docs, ref):
    p = ref.split("|")
    d = docs.setdefault(p[0], json.loads((C.ROOT / "data" / f"{p[0]}.json").read_text(encoding="utf-8")))
    n = int(p[2]) if len(p) > 2 else 0
    rs = [r for r in d["rows"] if r.get("es") == p[1] and r.get("l")]
    return rs[n] if len(rs) > n else None


def _whole(say, t):
    for m in re.finditer(re.escape(t), say):
        a, b = m.start(), m.end()
        if (a == 0 or not say[a - 1].isalpha()) and (b == len(say) or not say[b].isalpha()):
            return True
    return False


def test_scripts_valid_and_drawings_load():
    """Los 15 guiones (5 por idioma, data/calls/index.json con su ciudad) validan: v 1, id y idioma como en el índice,
    de 3 a 4 preguntas con 2 o 3 respuestas (cada una con su palabra del corpus, su IPA y su dibujo), ok con yes y no o
    una contestación por respuesta, la última línea no es pregunta, cada frase con su español, las palabras clave
    enteras dentro de la frase, sin respuestas repetidas; en francés, el espacio fino delante de ! ? : ; » y detrás de «.
    Cada uno dura entre 1 y 2 minutos (cuenta aproximada de palabras y pausas). En el navegador, vocabCalls.get() de
    los 15 resuelve y cada dibujo (y la foto del zorro) da 200 y es una imagen. Los 16 ficheros están en SHELL (sw.js)
    y en OFF_APP (index.html), y los dibujos propios (img/calls) en vocabCalls.images() para «Descargar todo»."""
    probs = []
    idx = json.loads((C.ROOT / "data/calls/index.json").read_text(encoding="utf-8"))
    if idx.get("v") != 1:
        probs.append("data/calls/index.json sin v 1")
    docs, ids = {}, []
    for lang, ab in _AB.items():
        L = idx.get(lang) or {}
        if L.get("city") != _CITY[lang]:
            probs.append(f"{lang}: la ciudad es {L.get('city')!r}")
        cs = L.get("calls") or []
        if len(cs) != 5:
            probs.append(f"{lang}: {len(cs)} llamadas (se esperaban 5)")
        for c in cs:
            ids.append(c["id"])
            if not c["f"].startswith(ab + "/") or not c.get("t"):
                probs.append(f"{c['id']}: fichero o título raros {c}")
            d = json.loads((C.ROOT / "data/calls" / c["f"]).read_text(encoding="utf-8"))
            if (d.get("v"), d.get("id"), d.get("lang"), d.get("city")) != (1, c["id"], lang, _CITY[lang]):
                probs.append(f"{c['id']}: cabecera {d.get('v'), d.get('id'), d.get('lang'), d.get('city')}")
            lines = d["lines"]
            qs = [ln for ln in lines if "a" in ln]
            if not 3 <= len(qs) <= 4:
                probs.append(f"{c['id']}: {len(qs)} preguntas")
            if "a" in lines[-1]:
                probs.append(f"{c['id']}: acaba con una pregunta")
            secs = 0.0
            for ln in lines:
                parts = [ln] + [ln.get("yes") or {}, ln.get("no") or {}] + [a.get("re") or {} for a in ln.get("a", [])]
                for p in parts:
                    if p and (not str(p.get("say", "")).strip() or not str(p.get("es", "")).strip()):
                        probs.append(f"{c['id']}: frase sin say o es {p}")
                    if p and lang == "français" and re.search(r"[ \w][!?:;»]|«[ \w]", p["say"]):
                        probs.append(f"{c['id']}: falta el espacio fino de ! ? : ; « » en «{p['say']}»")
                n = len(ln["say"].split())
                secs += n / 2.25 + .3
                for k in ln.get("k", []):
                    r = _row(docs, k["r"])
                    if not r or lang not in r["l"] or not r["l"][lang].get("ipa"):
                        probs.append(f"{c['id']}: palabra clave sin fila o sin IPA {k['r']}")
                    if not _whole(ln["say"], k["t"]):
                        probs.append(f"{c['id']}: «{k['t']}» no está entera en «{ln['say']}»")
                if "a" not in ln:
                    secs += max(1.8, min(3.8, 1.4 + len(ln["es"]) * .028))
                    continue
                A = ln["a"]
                if not 2 <= len(A) <= 3:
                    probs.append(f"{c['id']}: {len(A)} respuestas")
                if "ok" in ln:
                    if not (isinstance(ln["ok"], int) and 0 <= ln["ok"] < len(A)) or not ln.get("yes") or not ln.get("no"):
                        probs.append(f"{c['id']}: ok/yes/no mal en «{ln['say']}»")
                    re_ = ln["yes"]
                elif not all(a.get("re") for a in A):
                    probs.append(f"{c['id']}: pregunta de gustos sin contestación en cada respuesta")
                    re_ = {"say": ""}
                else:
                    re_ = A[0]["re"]
                secs += 4 + 1 + len(re_["say"].split()) / 2.25 + 1.5
                words = []
                for a in A:
                    r = _row(docs, a["r"])
                    if not r or lang not in r["l"] or not r["l"][lang].get("word") or not r["l"][lang].get("ipa"):
                        probs.append(f"{c['id']}: respuesta sin fila, palabra o IPA {a['r']}")
                        continue
                    words.append(r["l"][lang]["word"])
                    img = a.get("img") or r.get("img")
                    if not img or not (C.ROOT / img).is_file():
                        probs.append(f"{c['id']}: sin dibujo {a['r']} ({img})")
                if len(set(words)) != len(words):
                    probs.append(f"{c['id']}: respuestas repetidas {words}")
            if not 60 <= secs <= 120:
                probs.append(f"{c['id']}: dura unos {secs:.0f} s (entre 1 y 2 minutos)")
    if len(ids) != 15 or len(set(ids)) != 15:
        probs.append(f"ids: {ids}")
    sw = (C.ROOT / "sw.js").read_text(encoding="utf-8")
    html = (C.ROOT / "index.html").read_text(encoding="utf-8")
    shell = sw[sw.index("const SHELL"):sw.index("];", sw.index("const SHELL"))]
    off = html[html.index("const OFF_APP"):html.index("];", html.index("const OFF_APP"))]
    page = _page()
    try:
        _seed(page, armed=False)
        files = page.evaluate("() => vocabCalls.files()")
        if len(files) != 16:
            probs.append(f"vocabCalls.files() da {len(files)} ficheros")
        for f in ["js/calls.js"] + files:
            if f'"{f}"' not in shell:
                probs.append(f"{f} no está en SHELL de sw.js")
            if f'"{f}"' not in off:
                probs.append(f"{f} no está en OFF_APP de index.html")
        res = page.evaluate("""async ids => { const out = {bad: [], imgs: [], ipa: []};
          for (const id of ids) { try { const c = await vocabCalls.get(id);
              if (c.qs < 3 || c.qs > 4) out.bad.push(id + ': ' + c.qs + ' preguntas');
              c.lines.forEach(l => { (l.a || []).forEach(a => { out.imgs.push(a.w.img); if (!a.w.ipa) out.ipa.push(id + ' ' + a.w.word); });
                (l.keys || []).forEach(k => { if (!k.w.ipa) out.ipa.push(id + ' ' + k.w.word); }); });
            } catch (e) { out.bad.push(id + ': ' + e.message); } }
          return out; }""", ids)
        probs += [f"no carga {x}" for x in res["bad"]]
        probs += [f"sin IPA: {x}" for x in res["ipa"]]
        imgs = sorted(set(res["imgs"]) | {"img/pj/zorro.png"})
        got = page.evaluate("""async us => { const out = [];
          for (const u of us) { try { const r = await fetch(u, {cache: 'no-store'}); const b = await r.blob();
              out.push([u, r.status, (r.headers.get('content-type') || ''), b.size]); } catch (e) { out.push([u, 0, String(e), 0]); } }
          return out; }""", imgs)
        for u, st, ct, size in got:
            if st != 200 or not ct.startswith("image/") or size < 200:
                probs.append(f"dibujo {u}: {st} {ct} {size} B")
        mine = page.evaluate("() => vocabCalls.images()")
        for u in ("img/pj/zorro.png", "img/calls/abuela.png", "img/calls/abuelo.png"):
            if u not in mine:
                probs.append(f"vocabCalls.images() sin {u}")
        if len(imgs) < 60:
            probs.append(f"solo {len(imgs)} dibujos distintos en las 15 llamadas")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- cuándo suena
def test_no_call_first_day_nor_in_lesson():
    """El primer día de uso no suena (blocked() = "first" y no se escribe nada en "calls"); al día siguiente, sí. Con una
    sesión «con llamada», tampoco suena en una lección, en el repaso, en una partida, en un cuento, con Ajustes abierto
    ni con el menú de idioma; y si ya iba a sonar en Hoy y se entra en una lección, espera. Al volver a Hoy, suena."""
    probs = []
    page = _page()
    try:
        t = C.day_key(C.FIXED_NOW)
        _seed(page, _keys(act={t: 3}))
        if page.evaluate("() => vocabCalls.blocked()") != "first":
            probs.append(f"el primer día blocked() es {page.evaluate('() => vocabCalls.blocked()')!r}")
        if _rings(page):
            probs.append("suena el primer día")
        if page.evaluate("() => localStorage.getItem('calls')") is not None:
            probs.append("el primer día se escribe «calls»")
        # al día siguiente (la misma partida: save:first ya es de ayer)
        page.clock.set_system_time(C.FIXED_NOW + dt.timedelta(days=1))
        _again(page)
        if page.evaluate("() => vocabCalls.blocked()") != "":
            probs.append(f"al día siguiente blocked() es {page.evaluate('() => vocabCalls.blocked()')!r}")
        if not _rings(page):
            probs.append("al día siguiente no suena")
        probs += C.errors(page)
    finally:
        page.context.close()

    for tag, hash, prep in (("lección", "#/leccion/A1-001", None), ("repaso", "#/repaso", None), ("partida", "#/juegos/lince", None),
                            ("cuento", "#/cuento/en-play", None), ("Ajustes", "", "() => openSettings()"),
                            ("menú de idioma", "", "() => document.getElementById('lang-b').click()")):
        page = _page()
        try:
            _seed(page, hash=hash)
            if prep:
                page.evaluate(prep)
                page.wait_for_timeout(500)
                if tag == "menú de idioma" and not page.evaluate("() => document.documentElement.hasAttribute('data-menu')"):
                    probs.append("no se abre el menú de idioma")
            if page.evaluate("() => vocabCalls.blocked()") != "":
                probs.append(f"{tag}: blocked() es {page.evaluate('() => vocabCalls.blocked()')!r}")
            if page.evaluate("() => vocabCalls.calm()"):
                probs.append(f"{tag}: la pantalla cuenta como tranquila")
            if _rings(page):
                probs.append(f"suena en {tag}")
            if tag == "lección":
                C.goto(page, "")
                if not _rings(page):
                    probs.append("al volver a Hoy desde la lección no suena")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()

    # ya iba a sonar en Hoy (RING_DELAY) y se entra en una lección: espera a la siguiente pantalla tranquila
    page = _page()
    try:
        _seed(page)
        page.clock.run_for(1200)
        C.goto(page, "#/leccion/A1-001")
        if _rings(page, 6000):
            probs.append("suena al entrar en la lección justo antes de sonar")
        C.goto(page, "")
        if not _rings(page):
            probs.append("tras la lección no suena en Hoy")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_at_most_once_a_day():
    """Una llamada al día como mucho: tras sonar (aunque sea «Ahora no»), otra sesión ese día no suena (blocked() =
    "today") y la misma sesión tampoco; al día siguiente tampoco (GAP = 2 días entre una y otra: "gap"); dos días
    después vuelve a sonar, y es otra llamada (la que hace más que no sonaba)."""
    probs = []
    page = _page()
    try:
        _seed(page)
        _ring(page)
        first = page.evaluate(_CUR)["id"]
        page.locator("#cl-no").click()
        page.wait_for_function("() => !document.querySelector('dialog#cl-dlg[open]')", timeout=3000)
        st = page.evaluate(_ST)
        if st.get("d") != C.day_key(C.FIXED_NOW) or (st.get("h") or {}).get(first) != C.day_key(C.FIXED_NOW):
            probs.append(f"no se apunta el día en que sonó: {st}")
        if _rings(page, 12000):
            probs.append("suena otra vez en la misma sesión")
        _again(page)
        if page.evaluate("() => vocabCalls.blocked()") != "today":
            probs.append(f"otra sesión el mismo día: blocked() = {page.evaluate('() => vocabCalls.blocked()')!r}")
        if _rings(page):
            probs.append("suena dos veces el mismo día")
        page.clock.set_system_time(C.FIXED_NOW + dt.timedelta(days=1))
        _again(page)
        if page.evaluate("() => vocabCalls.blocked()") != "gap":
            probs.append(f"al día siguiente: blocked() = {page.evaluate('() => vocabCalls.blocked()')!r}")
        if _rings(page):
            probs.append("suena dos días seguidos")
        page.clock.set_system_time(C.FIXED_NOW + dt.timedelta(days=2))
        _again(page)
        if not _rings(page):
            probs.append("dos días después no suena")
        else:
            nxt = page.evaluate(_CUR)["id"]
            if nxt == first:
                probs.append(f"vuelve a sonar la misma llamada ({first})")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_only_with_a_voice_for_the_language():
    """Solo suena si el navegador tiene una voz de ese idioma: en Chrome de Windows no hay voz danesa (dansk: blocked()
    = "voices", no suena y no sale la fila perdida); en inglés, con las mismas voces, sí suena."""
    probs = []
    page = _page(voices=V.CHROME_WIN)
    try:
        _seed(page, _keys(lang="dansk", calls={"v": 1, "d": _day(C.FIXED_NOW, -3), "miss": {"id": "da-havn", "d": _day(C.FIXED_NOW, -1)}}))
        if page.evaluate("() => vocabCalls.blocked()") != "voices":
            probs.append(f"sin voz danesa: blocked() = {page.evaluate('() => vocabCalls.blocked()')!r}")
        if _rings(page):
            probs.append("suena sin voz danesa")
        _hoy(page)
        if page.evaluate(_ROW):
            probs.append("sale la llamada perdida sin voz danesa")
        if page.evaluate("() => localStorage.getItem('calls')") != json.dumps({"v": 1, "d": _day(C.FIXED_NOW, -3), "miss": {"id": "da-havn", "d": _day(C.FIXED_NOW, -1)}}):
            probs.append(f"sin voz se reescribe «calls»: {page.evaluate('() => localStorage.getItem(`calls`)')}")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = _page(voices=V.CHROME_WIN)
    try:
        _seed(page)
        if not _rings(page):
            probs.append(f"en inglés con las voces de Chrome no suena ({page.evaluate('() => vocabCalls.blocked()')!r})")
        elif page.evaluate("() => vocabCalls.current.id.slice(0, 3)") != "en-":
            probs.append("suena una llamada de otro idioma")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la llamada
def test_answer_speaks_with_voice_and_tap_moves_on():
    """La llamada entrante, en silencio (nada en __spoken ni en __played), ocupa la pantalla entera: la foto del zorro
    grande, «Zorro · Londres», «Ahora no» y «Contestar». Al contestar, la primera frase suena ya (dentro del toque) con
    la voz elegida para inglés (useVoice: pickVoice('english'), en-GB, a la velocidad de la partida) y sale como
    subtítulo con sus palabras clave; tocar una abre un globo con la palabra, su IPA y su español y suena su mp3; al
    cerrarlo, el zorro sigue. En una pregunta: tocar una mala la deja gris con ✗ (sin rojo), marca la buena en verde con
    ✓, el zorro dice cuál era y la llamada avanza; la tecla 1 contesta la siguiente; «Dilo» (listen()) contesta la
    otra con la voz. Los toques de la llamada no piden el permiso de Google (data-no-renew)."""
    probs = []
    page = _page()
    try:
        old = _day(C.FIXED_NOW, -9)
        _seed(page, _keys(calls={"v": 1, "h": {i: old for i in ("en-rain", "en-breakfast", "en-family", "en-birthday")}}))
        _ring(page)
        cur = page.evaluate(_CUR)
        if cur["id"] != "en-zoo" or cur["mode"] != "ring":
            probs.append(f"suena {cur} (se esperaba en-zoo, la que hace más que no sonaba)")
        if page.evaluate("() => [__spoken.length, __played.length]") != [0, 0]:
            probs.append("la llamada entrante no está en silencio")
        page.evaluate(_FINISH)
        d = page.evaluate(_BOX, "#cl-dlg")
        if not d or abs(d["w"] - 390) > 1 or abs(d["h"] - 844) > 1 or abs(d["top"]) > 1:
            probs.append(f"la llamada no ocupa la pantalla: {d}")
        pic = page.evaluate(_BOX, ".cl-pic img")
        if not pic or pic["w"] < 200:
            probs.append(f"la foto del zorro es pequeña: {pic}")
        if page.evaluate("() => document.querySelector('.cl-pic img').getAttribute('src')") != "img/pj/zorro.png":
            probs.append("la foto no es img/pj/zorro.png")
        if page.locator("#cl-name").text_content().strip() != "Zorro · Londres":
            probs.append(f"el nombre es {page.locator('#cl-name').text_content()!r}")
        if page.locator("#cl-no").text_content().strip() != "Ahora no" or page.locator("#cl-yes").get_attribute("aria-label") != "Contestar":
            probs.append("faltan «Ahora no» o «Contestar»")
        yes = page.evaluate(_BOX, "#cl-yes")
        if not yes or yes["h"] < 64 or yes["w"] < 300:
            probs.append(f"«Contestar» no es grande: {yes}")
        if page.evaluate("() => document.getElementById('cl-dlg').hasAttribute('data-no-renew')") is not True:
            probs.append("la llamada no lleva data-no-renew")
        _answer(page)
        sp = page.evaluate("() => __spoken.slice()")
        want = page.evaluate("() => pickVoice('english').name")
        line0 = page.evaluate("async () => (await vocabCalls.get('en-zoo')).lines[0].say")
        if not sp or sp[0]["text"] != line0 or sp[0]["lang"] != "en-GB" or sp[0]["voice"] != want or sp[0]["rate"] != 0.9:
            probs.append(f"la primera frase no suena con la voz elegida ({want}): {sp[:1]}")
        if want != "Microsoft Sonia Online (Natural) - English (United Kingdom)":
            probs.append(f"pickVoice('english') es {want}")
        if page.locator("#cl-say").text_content() != line0:
            probs.append(f"el subtítulo es {page.locator('#cl-say').text_content()!r}")
        ks = page.locator("#cl-say .cl-k")
        if ks.count() < 1 or ks.first.text_content() != "Hello":
            probs.append(f"la palabra clave no está iluminada: {ks.count()}")
        page.clock.run_for(400)
        if page.locator("#cl-es").get_attribute("data-hide") is not None:
            probs.append("el español no sale al acabar la frase")
        # el globo de la palabra clave
        n0 = page.evaluate("() => __played.length")
        ks.first.click()
        page.wait_for_selector("#cl-pop", timeout=3000)
        pop = page.locator("#cl-pop").text_content()
        ipa = page.locator("#cl-pop .ipa").text_content() if page.locator("#cl-pop .ipa").count() else ""
        if "hello" not in pop.lower() or "hola" not in pop or not re.search(r"[ˈəɛʊ]", ipa):
            probs.append(f"el globo: {pop!r} (IPA {ipa!r})")
        pl = page.evaluate("n => __played.slice(n)", n0)
        clip = page.evaluate("() => clipFor('hello')")
        if clip and not any(f"/audio/en/{clip}.mp3" in u for u in pl):
            probs.append(f"la palabra clave no suena con su mp3 ({clip}): {pl}")
        pb, sb = page.evaluate(_BOX, "#cl-pop"), page.evaluate(_BOX, ".cl-sub")
        if pb and sb and pb["top"] < sb["bottom"] - 1:
            probs.append("el globo tapa el subtítulo")
        if page.evaluate(_CUR)["i"] != 0:
            probs.append("con el globo abierto la llamada sigue")
        s0 = page.evaluate("() => __spoken.length")
        page.locator("#cl-pop-x").click()
        page.wait_for_timeout(200)
        if page.locator("#cl-pop").count() or page.evaluate("() => __spoken.length") <= s0:
            probs.append("al cerrar el globo el zorro no sigue")
        # la primera pregunta: una mala
        cur = _to_wait(page)
        oks = _oks(page, "en-zoo")
        if not cur or oks[cur["i"]] != 0 or page.locator("#cl-ans .cl-a").count() != 3:
            probs.append(f"la primera pregunta: {cur}")
        imgs = page.evaluate("() => [...document.querySelectorAll('#cl-ans .cl-a img')].map(i => i.complete && i.naturalWidth > 0)")
        if imgs != [True, True, True]:
            probs.append(f"los dibujos de la pregunta no cargan: {imgs}")
        if page.locator("#cl-ans .cl-a .ipa").count() != 3:
            probs.append("las respuestas no llevan su IPA")
        s0 = page.evaluate("() => __spoken.length")
        _pick(page, 1)
        cls = page.evaluate("() => [...document.querySelectorAll('#cl-ans .cl-a')].map(b => b.className)")
        if "is-ok" not in cls[0] or "is-miss" not in cls[1]:
            probs.append(f"marcas tras una mala: {cls}")
        miss = page.evaluate("""() => { const b = document.querySelector('#cl-ans .is-miss'), m = b.querySelector('.cl-mk');
          return {bg: getComputedStyle(b).backgroundColor, mk: getComputedStyle(m).backgroundColor, x: !!m.querySelector('svg use[href="#i-x-bold"], svg use[href="#i-x-fill"]')}; }""")
        for k in ("bg", "mk"):
            r, g, b = [int(x) for x in re.findall(r"\d+", miss[k])[:3]]
            if max(r, g, b) - min(r, g, b) > 12:
                probs.append(f"la mala no es gris ({k} {miss[k]})")
        if not miss["x"]:
            probs.append("la mala no lleva ✗")
        page.clock.run_for(300)
        page.wait_for_timeout(100)
        said = [s["text"] for s in page.evaluate("n => __spoken.slice(n)", s0)]
        if "Good try! It's an elephant." not in said:
            probs.append(f"el zorro no dice cuál era: {said}")
        nxt = _to_wait(page)
        if not nxt or nxt["i"] <= cur["i"] or nxt["answered"] != 1:
            probs.append(f"tras contestar no avanza: {nxt}")
        # la siguiente con la tecla 1
        page.keyboard.press("1")
        page.wait_for_timeout(150)
        cls = page.evaluate("() => [...document.querySelectorAll('#cl-ans .cl-a')].map(b => b.className)")
        if not cls or "is-ok" not in cls[0]:
            probs.append(f"la tecla 1 no contesta: {cls}")
        # «Dilo»: listen() de mentira que oye «banana»
        page.evaluate("() => { window.listen = async () => ({status: 'ok', alts: ['a banana', 'banana']}); }")
        nxt = _to_wait(page)
        if not page.locator("#cl-mic").is_visible():
            probs.append("no sale «Dilo» con canListen()")
        else:
            page.locator("#cl-mic").click()
            page.wait_for_timeout(300)
            cls = page.evaluate("() => [...document.querySelectorAll('#cl-ans .cl-a')].map(b => b.className)")
            if not cls or "is-ok" not in cls[0]:
                probs.append(f"«Dilo» no contesta con la voz: {cls}")
        if page.locator("#cl-ans .cl-a").first.is_visible() and page.locator("#cl-ans .cl-a").count() < 2:
            probs.append("con el micrófono no queda la opción de tocar")
        _finish(page)
        if page.evaluate(_OPEN):
            probs.append("la llamada no cuelga al acabar")
        voices = {(s["lang"], s["voice"]) for s in page.evaluate("() => __spoken")}
        if voices != {("en-GB", want)}:
            probs.append(f"no todo suena con la voz elegida: {voices}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_award_once_per_call_and_day():
    """Contestar todas las preguntas paga award(5) una vez (con su vuelo de monedas): la misma llamada otra vez ese día
    no paga; colgar a medias no paga (y no deja llamada perdida); como mucho 2 llamadas pagadas al día. Al día
    siguiente, la misma llamada vuelve a pagar. Contestar mal también cuenta (no hay castigo)."""
    probs = []
    page = _page()
    try:
        _seed(page)
        c0 = page.evaluate("() => game().coins")
        _ring(page)
        cid = page.evaluate(_CUR)["id"]
        _answer(page)
        _finish(page, wrong=True)
        paid = page.evaluate(_PAID)
        if len(paid) != 1 or paid[0]["n"] != 5 or not paid[0]["fly"]:
            probs.append(f"al acabar paga {paid}")
        if page.evaluate("() => game().coins") != c0 + 5:
            probs.append(f"monedas {c0} → {page.evaluate('() => game().coins')}")
        if (page.evaluate(_ST).get("paid") or {}).get(cid) != C.day_key(C.FIXED_NOW):
            probs.append(f"no se apunta la pagada: {page.evaluate(_ST)}")
        # la misma otra vez
        page.evaluate("id => vocabCalls.ring(id)", cid)
        page.wait_for_selector("dialog#cl-dlg[open] .cl-ring", timeout=4000)
        _answer(page)
        _finish(page)
        if len(page.evaluate(_PAID)) != 1:
            probs.append("la misma llamada paga dos veces el mismo día")
        # colgar a medias
        other = [i for i in ("en-zoo", "en-rain", "en-breakfast", "en-family", "en-birthday") if i != cid]
        page.evaluate("id => vocabCalls.ring(id)", other[0])
        page.wait_for_selector("dialog#cl-dlg[open] .cl-ring", timeout=4000)
        _answer(page)
        _to_wait(page)
        _pick(page, 0)
        if not _hang(page):
            probs.append("«Colgar» no cuelga")
        if len(page.evaluate(_PAID)) != 1:
            probs.append("colgar a medias paga")
        if page.evaluate(_ST).get("miss"):
            probs.append("colgar deja una llamada perdida")
        # la segunda pagada y el tope
        for i, k in enumerate(other[1:3]):
            page.evaluate("id => vocabCalls.ring(id)", k)
            page.wait_for_selector("dialog#cl-dlg[open] .cl-ring", timeout=4000)
            _answer(page)
            _finish(page)
            if len(page.evaluate(_PAID)) != 2:
                probs.append(f"{'la segunda' if i == 0 else 'la tercera'} llamada del día: {len(page.evaluate(_PAID))} pagadas")
        # al día siguiente, la primera vuelve a pagar (con el regalo del día de award)
        page.clock.set_system_time(C.FIXED_NOW + dt.timedelta(days=1))
        page.evaluate(_ARM, False)
        C.reload(page)
        page.evaluate("id => vocabCalls.ring(id)", cid)
        page.wait_for_selector("dialog#cl-dlg[open] .cl-ring", timeout=4000)
        _answer(page)
        _finish(page)
        if len(page.evaluate(_PAID)) != 1:
            probs.append("al día siguiente no paga")
        if list((page.evaluate(_ST).get("paid") or {}).values()) != [C.day_key(C.FIXED_NOW + dt.timedelta(days=1))]:
            probs.append(f"«paid» guarda días de antes: {page.evaluate(_ST)}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_not_now_leaves_missed_call_and_call_back():
    """«Ahora no» deja «1 llamada perdida · Zorro · Londres» en Hoy (sin scroll), también tras recargar; tocarla le
    devuelve la llamada (habla ya, sin pantalla de llamada entrante) y, al colgar, la fila se va. Esc es «Ahora no».
    Sin contestar en 30 s también queda perdida. Una perdida de hace más de 3 días o de otro idioma no sale."""
    probs = []
    page = _page()
    try:
        _seed(page)
        _ring(page)
        page.locator("#cl-no").click()
        page.wait_for_function("() => !document.querySelector('dialog#cl-dlg[open]')", timeout=3000)
        page.wait_for_selector("[data-slot=call] #cl-row", timeout=5000)
        page.evaluate(_FINISH)
        row = page.evaluate(_ROW)
        if row != "1 llamada perdidaZorro · Londres" and row != "1 llamada perdida Zorro · Londres":
            probs.append(f"la fila dice {row!r}")
        if page.locator("#cl-row").get_attribute("data-no-renew") is None:
            probs.append("la fila no lleva data-no-renew")
        I5._fits(page, "con la llamada perdida", probs)
        C.reload(page)
        page.wait_for_timeout(400)
        if not page.evaluate(_ROW):
            probs.append("tras recargar no está la llamada perdida")
        page.locator("#cl-row").click()
        page.wait_for_selector("dialog#cl-dlg[open] .cl-talk", timeout=3000)
        cur = page.evaluate(_CUR)
        if not cur or cur["mode"] != "talk" or page.evaluate("() => __spoken.length") < 1:
            probs.append(f"devolver la llamada no empieza a hablar: {cur}")
        if page.evaluate(_ST).get("miss"):
            probs.append("al devolverla sigue perdida")
        if not _hang(page):
            probs.append("no cuelga")
        page.wait_for_timeout(500)
        if page.evaluate(_ROW):
            probs.append("tras devolverla sigue la fila")
        probs += C.errors(page)
    finally:
        page.context.close()
    # Esc y sin contestar en 30 s
    for tag in ("Esc", "30 s"):
        page = _page()
        try:
            _seed(page)
            _ring(page)
            if tag == "Esc":
                page.keyboard.press("Escape")
                page.wait_for_timeout(200)
            else:
                page.clock.run_for(31000)
                page.wait_for_timeout(200)
            if page.evaluate(_OPEN):
                probs.append(f"{tag}: sigue sonando")
            page.wait_for_timeout(400)
            if not page.evaluate(_ROW):
                probs.append(f"{tag}: no sale la llamada perdida")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    # vieja y de otro idioma
    for tag, keys in (("de hace 4 días", _keys(calls={"v": 1, "d": _day(C.FIXED_NOW, -4), "miss": {"id": "en-zoo", "d": _day(C.FIXED_NOW, -4)}})),
                      ("de otro idioma", _keys(lang="français", calls={"v": 1, "d": _day(C.FIXED_NOW, -1), "miss": {"id": "en-zoo", "d": _day(C.FIXED_NOW, -1)}})),
                      ("de hace 3 días", _keys(calls={"v": 1, "d": _day(C.FIXED_NOW, -3), "miss": {"id": "en-zoo", "d": _day(C.FIXED_NOW, -3)}}))):
        page = _page()
        try:
            _seed(page, keys, armed=False)
            page.wait_for_timeout(400)
            row = page.evaluate(_ROW)
            if (row is None) != (tag != "de hace 3 días"):
                probs.append(f"una perdida {tag}: fila {row!r}")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_switch_off_no_call():
    """Para mayores › Llamadas › «Llamadas del zorro» viene encendido. Apagarlo guarda calls.off, quita la llamada
    perdida de Hoy y ya no suena (blocked() = "off"); encenderlo otra vez vuelve a dejar que suene."""
    probs = []
    page = _page()
    try:
        _seed(page, _keys(calls={"v": 1, "d": _day(C.FIXED_NOW, -2), "miss": {"id": "en-zoo", "d": _day(C.FIXED_NOW, -2)}}), armed=False)
        page.wait_for_timeout(400)
        if not page.evaluate(_ROW):
            probs.append("no sale la llamada perdida sembrada")
        page.evaluate(_PASS)
        page.evaluate("() => openSettings('mayores')")
        page.wait_for_selector("#aj-cl-on", timeout=5000)
        page.locator("#aj-cl-on").scroll_into_view_if_needed()
        if not page.locator("#aj-cl-on").is_checked():
            probs.append("«Llamadas del zorro» no viene encendido")
        lab = page.locator("label[for=aj-cl-on]").text_content()
        if "Llamadas del zorro" not in lab:
            probs.append(f"la etiqueta es {lab!r}")
        if page.locator("#aj-cl-on").get_attribute("role") != "switch":
            probs.append("no es un interruptor")
        page.locator("label[for=aj-cl-on]").click()
        page.wait_for_timeout(200)
        st = page.evaluate(_ST)
        if not st.get("off") or st.get("miss"):
            probs.append(f"apagado: {st}")
        page.evaluate("() => vocabSettings.close()")
        page.wait_for_function("() => !document.querySelector('dialog#ajustes[open]')", timeout=4000)
        page.wait_for_timeout(600)
        if page.evaluate(_ROW):
            probs.append("apagado sigue la llamada perdida")
        _again(page)
        if page.evaluate("() => vocabCalls.blocked()") != "off":
            probs.append(f"apagado: blocked() = {page.evaluate('() => vocabCalls.blocked()')!r}")
        if _rings(page):
            probs.append("suena apagado")
        page.evaluate(_PASS)
        page.evaluate("() => openSettings('mayores')")
        page.wait_for_selector("#aj-cl-on", timeout=5000)
        if page.locator("#aj-cl-on").is_checked():
            probs.append("el interruptor no recuerda que está apagado")
        page.locator("#aj-cl-on").scroll_into_view_if_needed()
        page.locator("label[for=aj-cl-on]").click()
        page.wait_for_timeout(200)
        if page.evaluate(_ST).get("off"):
            probs.append("encenderlo no quita calls.off")
        page.evaluate("() => vocabSettings.close()")
        page.wait_for_function("() => !document.querySelector('dialog#ajustes[open]')", timeout=4000)
        _again(page)
        if not _rings(page):
            probs.append(f"encendido otra vez no suena ({page.evaluate('() => vocabCalls.blocked()')!r})")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Hoy con todo a la vez
def test_hoy_everything_at_once_with_missed_call():
    """En pleno Halloween, con atajos, una carta sin abrir, la gallina en el refugio, la temporada, la frase de la cena
    y una llamada perdida a la vez: el orden es carta > refugio > llamada perdida > temporada > frase de la cena. En el
    móvil (390×844, claro y oscuro; con la fila de atajos, un HOME_SLOT) sale la carta; en tableta y escritorio, carta y
    refugio. Al irse cada uno sale el siguiente; al devolver la llamada, se va. Sin scroll en ninguno de los pasos, ni
    en un móvil bajo (375×667)."""
    probs = []
    H = I5.HALLOWEEN
    t = C.day_key(H)
    calls = {"v": 1, "d": t, "miss": {"id": "en-zoo", "d": t}}
    for tag, kind, kw, want in (("móvil claro", "phone", {}, ["mail"]), ("móvil oscuro", "phone", {"color_scheme": "dark"}, ["mail"]),
                                ("tableta 820", "phone", {"viewport": {"width": 820, "height": 1180}}, ["mail", "granja"]),
                                ("escritorio", "desk", {}, ["mail", "granja"])):
        page = _page(kind, now=H, **kw)
        try:
            k = I5._keys(H, shelter=True)
            k["calls"] = json.dumps(calls)
            _seed(page, k, armed=False, now=H)
            page.evaluate("o => vocabMailbox.receive(o)", I5.LET)
            _hoy(page)
            got = page.evaluate(_SLOTS)
            if got != want:
                probs.append(f"{tag}: los HOME_SLOTS son {got} (se esperaba {want})")
            I5._fits(page, tag, probs)
            steps = [["granja"], ["call"], ["season"]] if len(want) == 1 else [["granja", "call"], ["call", "season"], ["season", "phrase"]]
            seq = []
            C.goto(page, "#/carta/" + I5.LET["id"])
            page.locator("#mb-open").click()
            page.wait_for_selector("#mb-gift:not([hidden])", timeout=9000)
            _hoy(page)
            seq.append(page.evaluate(_SLOTS))
            I5._fits(page, f"{tag} sin la carta", probs)
            page.evaluate("() => { const s = store.get('farm:state', {}); s.shelter.gallina.seen = true; store.set('farm:state', s); }")
            _hoy(page)
            seq.append(page.evaluate(_SLOTS))
            I5._fits(page, f"{tag} con la llamada perdida", probs)
            if page.evaluate(_ROW) is None:
                probs.append(f"{tag}: no se ve la fila «1 llamada perdida»")
            else:
                r = page.evaluate(_BOX, "#cl-row")
                if r["h"] < 44:
                    probs.append(f"{tag}: la fila es baja ({r['h']} px)")
                page.locator("#cl-row").click()
                page.wait_for_selector("dialog#cl-dlg[open] .cl-talk", timeout=3000)
                _hang(page)
                page.wait_for_timeout(600)
                page.evaluate(_FINISH)
            seq.append(page.evaluate(_SLOTS))
            I5._fits(page, f"{tag} tras devolver la llamada", probs)
            if seq != steps:
                probs.append(f"{tag}: al irse uno tras otro salen {seq} (se esperaba {steps})")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    page = _page("phone", now=H, viewport={"width": 375, "height": 667})
    try:
        k = I5._keys(H, shelter=True)
        k["calls"] = json.dumps(calls)
        _seed(page, k, armed=False, now=H)
        page.evaluate("o => vocabMailbox.receive(o)", I5.LET)
        _hoy(page)
        I5._fits(page, "móvil bajo", probs)
        if page.evaluate(_SLOTS) not in ([], ["mail"]):
            probs.append(f"móvil bajo: los HOME_SLOTS son {page.evaluate(_SLOTS)} (la carta o nada)")
        probs += C.errors(page)
    finally:
        page.context.close()
    # en el móvil bajo, sin carta y con el refugio ya visto, la llamada perdida cabe
    page = _page("phone", now=H, viewport={"width": 375, "height": 667})
    try:
        k = I5._keys(H, shelter=True)
        k["calls"] = json.dumps(calls)
        _seed(page, k, armed=False, now=H)
        page.evaluate("() => { const s = store.get('farm:state', {}); s.shelter.gallina.seen = true; store.set('farm:state', s); }")
        _hoy(page)
        if page.evaluate(_SLOTS) not in ([], ["call"]):
            probs.append(f"móvil bajo sin carta: los HOME_SLOTS son {page.evaluate(_SLOTS)}")
        I5._fits(page, "móvil bajo sin carta", probs)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- dibujos grandes
def test_drawings_big_on_phones():
    """En el móvil (360 y 390 px de ancho) la foto del zorro al sonar mide 200 px o más, los dibujos de una pregunta de
    3 respuestas 90 px o más (100 a 390) y los de 2 respuestas 150 o más; la pantalla de la llamada cabe sin scroll
    (subtítulos, dibujos y botones a la vista) a 360×740 y 390×844."""
    probs = []
    for w, h in ((360, 740), (390, 844)):
        page = _page(viewport={"width": w, "height": h})
        try:
            old = _day(C.FIXED_NOW, -9)
            _seed(page, _keys(calls={"v": 1, "h": {i: old for i in ("en-rain", "en-breakfast", "en-family", "en-birthday")}}))
            _ring(page)
            pic = page.evaluate(_BOX, ".cl-pic")
            if not pic or pic["w"] < 200:
                probs.append(f"{w}: la foto del zorro mide {pic and round(pic['w'])} px")
            acts = page.evaluate(_BOX, ".cl-acts")
            if not acts or acts["bottom"] > h:
                probs.append(f"{w}: «Contestar» no cabe ({acts})")
            _answer(page)
            sizes = {}
            for _ in range(4):
                cur = _to_wait(page)
                if not cur:
                    break
                n = page.locator("#cl-ans .cl-a").count()
                ws = page.evaluate("() => [...document.querySelectorAll('#cl-ans .cl-a img')].map(i => i.getBoundingClientRect().width)")
                sizes.setdefault(n, []).append(min(ws))
                m = page.evaluate("() => { const t = document.querySelector('.cl-talk'); const b = document.getElementById('cl-hang').getBoundingClientRect(); return {sh: t.scrollHeight, ch: t.clientHeight, hang: b.bottom}; }")
                if m["sh"] > m["ch"] + 1 or m["hang"] > h:
                    probs.append(f"{w}: la pregunta {cur['i']} necesita scroll ({m})")
                _pick(page, max(0, _oks(page, cur["id"])[cur["i"]]))
            lim3 = 100 if w >= 390 else 90
            if min(sizes.get(3, [999])) < lim3:
                probs.append(f"{w}: dibujos de 3 respuestas de {min(sizes[3]):.0f} px (mínimo {lim3})")
            if min(sizes.get(2, [999])) < 150:
                probs.append(f"{w}: dibujos de 2 respuestas de {min(sizes[2]):.0f} px")
            if not sizes:
                probs.append(f"{w}: sin preguntas")
            probs += [f"{w}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- guardado y exportación
def test_export_equal_to_baseline_except_new_keys():
    """Arrancar no escribe nada de las llamadas: la exportación es igual que la base (sin claves nuevas). Tras una
    llamada contestada solo cambian game (las monedas) y la clave nueva «calls», que está en la partida (EXACT "o" en
    js/save.js) y guarda solo lo suyo; la sesión ("vocab:call-s") está en sessionStorage, fuera."""
    probs = []
    base = C.load_baseline()
    assert base, "falta tests/e2e/baseline/export.json"
    page = _page()
    try:
        _seed(page, armed=False)
        C.goto(page, "#/juegos")
        C.goto(page, "")
        snap = C.export(page)
        keys = dict(snap["keys"])
        for k in ("album:uniq:english",):
            keys[k] = base["keys"].get(k, keys.get(k))
        d = C.diff_exports(base, dict(snap, keys=keys), allow_new=False)
        if d:
            probs.append("arrancar cambió la partida:\n  " + "\n  ".join(d))
        if "calls" in snap["keys"]:
            probs.append("al arrancar se escribe «calls»")
        page.evaluate(_ARM, True)
        page.evaluate("() => vocabCalls.check()")
        _ring(page)
        _answer(page)
        _finish(page)
        snap2 = C.export(page)
        nk = C.new_keys(base, snap2)
        if nk != ["calls"]:
            probs.append(f"claves nuevas en la exportación: {nk}")
        changed = sorted(k for k in snap2["keys"] if k in snap["keys"] and snap2["keys"][k] != snap["keys"][k])
        if not set(changed) <= {"game"}:
            probs.append(f"una llamada cambió más que game: {changed}")
        st = json.loads(snap2["keys"]["calls"]) if isinstance(snap2["keys"].get("calls"), str) else snap2["keys"].get("calls")
        if not isinstance(st, dict) or set(st) - {"v", "d", "h", "paid"} or st.get("v") != 1:
            probs.append(f"«calls» guarda {st}")
        inv = page.evaluate("() => ({t: vocabSave.typeOf('calls'), dev: vocabSave.inventory.deviceOnly.includes('calls'), s: vocabSave.typeOf('vocab:call-s')})")
        if inv != {"t": "o", "dev": False, "s": None}:
            probs.append(f"inventario de save.js: {inv}")
        if "vocab:call-s" in json.dumps(snap2):
            probs.append("la sesión va en la exportación")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- los tres idiomas
def test_three_languages_no_console_errors():
    """En inglés, francés y danés (con «Reducir movimiento»): suena desde su ciudad, se contesta tocando «Contestar» o
    deslizando el botón verde (en danés), habla con su voz (en-GB, fr-FR, da-DK, la de pickVoice), se contesta entera
    tocando y cuelga sola, sin errores de consola. Con «Reducir movimiento» ninguna animación de la llamada dura más
    de 160 ms."""
    probs = []
    for lang in ("english", "français", "dansk"):
        page = _page(reduced_motion="reduce")
        try:
            _seed(page, _keys(lang=lang))
            _ring(page)
            anims = page.evaluate("""() => document.getAnimations().map(a => { const t = a.effect && a.effect.getComputedTiming();
              return {n: a.animationName || a.transitionProperty || '?', d: t ? (t.iterations === Infinity ? Infinity : t.activeDuration) : 0}; })
              .filter(a => !(a.d <= 160))""")
            if anims:
                probs.append(f"{lang}: con «Reducir movimiento» hay animaciones largas {anims}")
            name = page.locator("#cl-name").text_content().strip()
            if name != f"Zorro · {_CITY[lang]}":
                probs.append(f"{lang}: «{name}»")
            cur = page.evaluate(_CUR)
            if cur["id"][:2] != _AB[lang]:
                probs.append(f"{lang}: suena {cur['id']}")
            if lang == "dansk":
                _slide(page)
            else:
                _answer(page)
            n = _finish(page)
            if n != cur["qs"] or page.evaluate(_OPEN):
                probs.append(f"{lang}: contestadas {n} de {cur['qs']}")
            want = page.evaluate("l => pickVoice(l).name", lang)
            got = {(s["lang"], s["voice"]) for s in page.evaluate("() => __spoken")}
            if got != {(_CODE[lang], want)}:
                probs.append(f"{lang}: voces {got} (se esperaba {_CODE[lang]} {want})")
            if not any(f"/audio/{_AB[lang]}/" in u for u in page.evaluate("() => __played")):
                probs.append(f"{lang}: ninguna respuesta suena con su mp3")
            if len(page.evaluate(_PAID)) != 1:
                probs.append(f"{lang}: no paga")
            probs += [f"{lang}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- capturas
def test_captures_and_audit():
    """Capturas en /mnt/project-files/rediseno/capturas/F6/ (F6j-*): la llamada entrante, hablando con una palabra
    clave, el globo con la IPA, una pregunta, la respuesta marcada, «Llamada terminada», la fila «1 llamada perdida»
    en Hoy y el interruptor de Para mayores; móvil y escritorio, claro y oscuro (con «Reducir movimiento»). En todas:
    contraste suficiente, sin colores fuera de la paleta y sin fallos de accesibilidad (a11y.js)."""
    probs = []
    for kind in ("phone", "desk"):
        for scheme in ("light", "dark"):
            tag = f"F6j-{kind}-{scheme}"
            page = _page(kind, color_scheme=scheme, reduced_motion="reduce")
            try:
                old = _day(C.FIXED_NOW, -9)
                _seed(page, _keys(calls={"v": 1, "h": {i: old for i in ("en-rain", "en-breakfast", "en-family", "en-birthday")}}))

                def snap(name, scope=("cl-",), a11y=True):
                    page.evaluate(_FINISH)
                    page.wait_for_timeout(150)
                    a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
                    for x in a["contrast"] + a["palette"]:
                        if any(s in str(x) for s in scope):
                            probs.append(f"{tag}-{name}: {x}")
                    if a11y:
                        probs.extend(f"{tag}-{name}: {x}" for x in _a11y(page))
                    C.shot(page, f"{tag}-{name}", OUT, full_page=False)
                _ring(page)
                snap("suena")
                _answer(page)
                page.clock.run_for(60)
                page.evaluate("() => document.querySelector('#cl-say .cl-k') && document.querySelector('#cl-say .cl-k').classList.add('now')")
                snap("habla")
                page.locator("#cl-say .cl-k").first.click()
                page.wait_for_selector("#cl-pop", timeout=3000)
                snap("globo")
                page.locator("#cl-pop-x").click()
                cur = _to_wait(page)
                snap("pregunta")
                _pick(page, 1)
                page.wait_for_timeout(200)
                snap("respuesta")
                _to_wait(page)
                _pick(page, 0)
                for _ in range(300):
                    c2 = page.evaluate(_CUR)
                    if page.locator(".cl-endv").count() or not c2:
                        break
                    if c2 and c2["phase"] == "wait":
                        _pick(page, max(0, _oks(page, c2["id"])[c2["i"]]))
                    page.clock.run_for(400)
                    page.wait_for_timeout(20)
                if page.locator(".cl-endv").count():
                    snap("terminada")
                else:
                    probs.append(f"{tag}: no sale «Llamada terminada» ({page.evaluate(_CUR)})")
                page.clock.run_for(2000)
                page.wait_for_timeout(300)
                # la fila perdida en Hoy
                page.evaluate("t => { const s = vocabCalls.state(); s.miss = {id: 'en-zoo', d: t}; localStorage.setItem('calls', JSON.stringify(s)); }",
                              C.day_key(C.FIXED_NOW))
                _hoy(page)
                if page.evaluate(_ROW) is None:
                    probs.append(f"{tag}: no sale la fila perdida")
                snap("hoy-perdida", scope=("cl-", "hm-"))
                page.evaluate(_PASS)
                page.evaluate("() => openSettings('mayores')")
                page.wait_for_selector("#aj-cl-on", timeout=5000)
                page.wait_for_timeout(450)
                page.evaluate("() => document.getElementById('aj-cl-h').scrollIntoView({block: 'center'})")
                snap("ajustes", scope=("aj-cl", "st-"))
                probs += [f"{tag}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)
