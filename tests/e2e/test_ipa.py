"""La IPA a la vista (el dueño: «recuerda no quitar la IPA, si la quitaste agrégala»).

Antes del rediseño (commit 1721796) la IPA salía junto a la pronunciación en todas partes; el rediseño la dejó tras
«Mostrar pronunciación (IPA)» de Para mayores, apagado de serie. Ahora se ve siempre salvo que un mayor la apague:
ipaOn() e ipaHtml() de index.html, con vocab:ui {ipa: false} = apagada (sin clave, o con un {ipa: true} de antes, se ve).

Se comprueba, con la partida sembrada, en inglés, francés y danés: la IPA de la palabra (la de data/*.json) en la palabra
nueva de la lección, la hoja «Cómo suena», la respuesta de «¿Cuál es…?», el reverso del repaso (en la cara de la
pregunta no: diría la respuesta), Palabras (detalle de la Lista, Tarjetas girada, Preguntas al contestar, Escribir), la
ficha del álbum, Oído de lince al contestar (las dos tarjetas) y la Palabra del día girada en Hoy; con ipa:false en
ninguno; con ipa:true en todos. El interruptor sale encendido de serie y alterna (apagado = ipa:false; encendido quita
la marca). La IPA va en gris secundario, con el idioma de la palabra, «IPA» para el lector de pantalla y una sola letra
que tiene todos sus símbolos (nunca Nunito). Hoy, la lección (cada palabra nueva y tras un fallo) y el repaso girado
caben sin scroll en 390×844 y 360×740, también con «Texto más grande»; Oído de lince, en sus 8 rondas, también en
320×568. La exportación sigue igual a la base y no hay errores de consola. Capturas en capturas/ipa.

Tras la revisión: la IPA solo se parte por los espacios («word joiner» tras la «/» de apertura y antes del acento) y en
Tarjetas y Escribir va en su propia línea bajo «Se dice» (con el plural nombrado); va justo debajo de la palabra en la
lección y el repaso; en el detalle de Palabras, en el color de los otros valores; la Palabra del día la lleva en una
línea (la primera forma) y a 8 px de «¡Me la sé!»; la tarjeta de Escribir cabe en su hueco; las palabras largas
(A1-022, B1-024) no hacen bajar la lección; en 320×568 la lección y la ficha del álbum no bajan más que sin la IPA; y el
interruptor repinta lo de debajo al cerrar Ajustes, sin empezar de nuevo lo que había a medias (la ronda de Preguntas,
el orden de «Barajar», el final de un juego)."""
from __future__ import annotations

import json
from pathlib import Path

import common as C
import routes as R
import test_f3_leccion as L
import test_f3_repaso as V
import test_f4_juegos as J

OUT = C.CAPTURAS / "ipa"
LANGS = [("english", "en"), ("français", "fr"), ("dansk", "da")]
LION = "A1-003"   # la lección de «lion» (la de la captura del dueño): lion, tiger, elephant…
_PASS = "() => sessionStorage.setItem('vocab:gate', String(Date.now() + adultGate.MS))"
_UI = "() => { try { return JSON.parse(localStorage.getItem('vocab:ui')); } catch (e) { return 'roto'; } }"
_HINTS = {k: 1000 for k in ["ls-swipe", "rv-swipe", "doc-swipe", "gm-peek", "al-swipe", "fm-regadera", "fm-lift", "map-peek"]}
_FIT = "() => ({sh: document.documentElement.scrollHeight, ih: innerHeight})"
_CUR = ".ls-stage > .ls-page:not(.ls-ghost)"


def _right(page, st):
    """Contesta bien la pregunta de la lección (de cualquier tipo) y sigue con «Seguir» si no ha pasado sola."""
    L._pick(page, st["right"])
    page.wait_for_function("() => { const g = document.getElementById('ls-go'); return g && !g.hidden; }", timeout=6000)
    if page.evaluate(L._ST)["i"] == st["i"]:
        L._go(page)
# lo que se ve de cada .ipa dentro de sel: el texto (sin el «IPA:» oculto ni los «word joiner» U+2060 de ipaHtml()), si
# se ve, el idioma y el color
_SEE = """sel => [...document.querySelectorAll(sel)].map(e => { const cs = getComputedStyle(e), vh = e.querySelector('.vh');
  return {t: [...e.childNodes].filter(n => n !== vh).map(n => n.textContent).join('').replace(/\u2060/g, '').trim(), vh: vh ? vh.textContent.trim() : '',
    vis: !!e.getClientRects().length && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0,
    lang: e.getAttribute('lang') || '', color: cs.color, ff: cs.fontFamily, fs: parseFloat(cs.fontSize)}; })"""
_ROW = "id => CACHE[id].rows.filter(r => r.es && r.l && r.l[lang])"
# [palabra, IPA, traducción] de arriba abajo, sin montarse
_ORDER = """sels => { const r = sels.map(s => { const e = document.querySelector(s); return e && e.getBoundingClientRect(); });
  return r.every(Boolean) && r[0].bottom <= r[1].top + 1 && r[1].bottom <= r[2].top + 1; }"""
# las líneas que se ven de un elemento (sin lo oculto ni los «word joiner»), carácter a carácter con Range
_LINES = """sel => { const e = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!e) return null; const out = []; let top = null, cur = '';
  const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { if (n.parentElement.closest('.vh')) continue;
    for (let i = 0; i < n.length; i++) { if (n.data[i] === '\u2060') continue; const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1);
      const rc = r.getClientRects()[0]; if (!rc) continue; const t = Math.round(rc.top);
      if (top === null || Math.abs(t - top) > 6) { if (cur) out.push(cur); cur = ''; top = t; } cur += n.data[i]; } }
  if (cur) out.push(cur); return out; }"""


def _keys(lang="english", ui=None, text="", cards=False):
    """La partida sembrada en ese idioma (el repaso, el álbum y la Palabra del día con las palabras del inglés) y
    vocab:ui = ui (sin la clave ipa si ui es None) con las pistas de gestos ya vistas. cards: las pendientes, en la caja
    4, para que el repaso las enseñe con la tarjeta de siempre (que gira y tiene reverso)."""
    k = C.seed_keys()
    k["lang"] = json.dumps(lang)
    if cards:
        k["srs:english"] = V._card_keys()["srs:english"]
    if lang != "english":
        for base in ("srs", "album:seen", "album:done", "album:uniq"):
            k[f"{base}:{lang}"] = k[f"{base}:english"]
    o = {"hints": dict(_HINTS)}
    o.update(ui or {})
    if text:
        o["text"] = text
    k["vocab:ui"] = json.dumps(o)
    return k


def _lince_ipa():
    """{idioma: {palabra: ipa}} de las palabras de data/lince.json (de su tema en data/<d>.json)."""
    root = Path(C.ROOT)
    data = json.loads((root / "data" / "lince.json").read_text(encoding="utf-8"))
    out, docs = {}, {}
    for L_, _ in LANGS:
        m = out[L_] = {}
        for pair in data.get(L_, []):
            for x in pair:
                d = x.get("d")
                if not d:
                    continue
                if d not in docs:
                    docs[d] = json.loads((root / "data" / f"{d}.json").read_text(encoding="utf-8"))
                for r in docs[d].get("rows", []):
                    w = (r.get("l") or {}).get(L_) or {}
                    if w.get("word") == x["w"] and w.get("ipa"):
                        m[x["w"]] = w["ipa"]
                        break
    return out


def _check(page, site, sel, want, on, probs, tag, code=None):
    """La IPA de sel: con on, una sola visible por palabra esperada (want: lista de IPA), con su idioma y «IPA» oculto;
    sin on, ninguna. Devuelve lo visto."""
    seen = page.evaluate(_SEE, sel)
    vis = [s for s in seen if s["vis"]]
    if not on:
        if vis:
            probs.append(f"{tag} · {site}: con la IPA apagada se ve {[s['t'] for s in vis]}")
        return seen
    want = [w for w in want if w]
    if not want:
        probs.append(f"{tag} · {site}: la palabra no tiene IPA en los datos")
        return seen
    got = sorted(s["t"] for s in vis)
    if got != sorted(want):
        probs.append(f"{tag} · {site}: IPA {got} (se esperaba {sorted(want)})")
    for s in vis:
        if code and not s["lang"].startswith(code):
            probs.append(f"{tag} · {site}: la IPA va con lang={s['lang']!r}")
        if s["vh"] != "IPA:" and site != "detalle de Palabras":
            probs.append(f"{tag} · {site}: sin «IPA» para el lector de pantalla ({s['vh']!r})")
        if "nunito" in s["ff"].lower() or "rounded" in s["ff"].lower():
            probs.append(f"{tag} · {site}: la IPA va en la letra redonda ({s['ff']})")
    return seen


def _lesson_sites(page, lang, code, on, probs, tag):
    """Palabra nueva, «Cómo suena» y la respuesta de «¿Cuál es…?» (con un fallo) en la lección de «lion»."""
    C.seed(page, keys=_keys(lang, None if on is None else on), hash="#/leccion/" + LION)
    page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-learn')", timeout=8000)
    page.evaluate(L._HOOK)
    page.evaluate(L._FAKE_AUDIO)
    page.wait_for_timeout(350)
    vis = on is None or on.get("ipa") is not False
    want = page.evaluate("() => vocabLesson.state.steps[vocabLesson.state.i].w.r.l[lang].ipa")
    _check(page, "palabra nueva", f"{_CUR} .ls-learn .ipa", [want], vis, probs, tag, code)
    page.locator(f"{_CUR} [data-how]").click()
    page.wait_for_selector("dialog#ls-how[open]", timeout=3000)
    page.wait_for_timeout(350)
    _check(page, "«Cómo suena»", "#ls-how .ipa", [want], vis, probs, tag, code)
    page.locator("#ls-how [data-close]").click()
    page.wait_for_function("() => !document.querySelector('dialog#ls-how[open]')", timeout=3000)
    page.wait_for_timeout(250)
    for _ in range(40):
        st = page.evaluate(L._ST)
        if st["t"] == "learn":
            L._go(page)
            continue
        if st["t"] == "pick":
            break
        L._pick(page, st["right"])
        L._wait_change(page, st["i"], 9000)
        page.wait_for_timeout(250)
    else:
        probs.append(f"{tag}: la lección no llega a «¿Cuál es…?»")
        return
    want = page.evaluate("() => vocabLesson.state.steps[vocabLesson.state.i].w.r.l[lang].ipa")
    L._pick(page, L._wrong(page, st["right"]))
    page.wait_for_function("() => { const g = document.getElementById('ls-go'); return g && !g.hidden; }", timeout=3000)
    page.wait_for_timeout(200)
    _check(page, "respuesta de la lección", f"{_CUR} .ls-fb .ipa", [want], vis, probs, tag, code)


def _review_sites(page, lang, code, on, probs, tag):
    C.seed(page, keys=_keys(lang, on, cards=True), hash="#/repaso")
    page.wait_for_selector("#rv-card", timeout=10000)
    vis = on is None or on.get("ipa") is not False
    q = page.evaluate(_SEE, "#rv-card .rv-q .ipa")
    if q:
        probs.append(f"{tag} · repaso: la cara de la pregunta enseña la IPA (diría la respuesta)")
    V._tap_card(page)
    page.wait_for_timeout(400)
    want = page.evaluate("() => rv.q[rv.i].r.l[lang].ipa")
    _check(page, "reverso del repaso", "#rv-card .rv-a .ipa", [want], vis, probs, tag, code)


def _doc_sites(page, lang, code, on, probs, tag):
    """Palabras › animales: Tarjetas girada, el detalle de la Lista, Preguntas al contestar y Escribir."""
    C.seed(page, keys=_keys(lang, on), hash=f"#/doc/{R.TOPIC}")
    page.wait_for_selector("#card", timeout=8000)
    vis = on is None or on.get("ipa") is not False
    page.locator("#card").click()
    page.wait_for_timeout(500)
    want = page.evaluate(f"""id => {{ const s = vocabLearn.state.fc, list = ({_ROW})(id); return list[s.order[s.i]].l[lang].ipa; }}""", R.TOPIC)
    _check(page, "Tarjetas", "#card .ipa", [want], vis, probs, tag, code)
    page.locator("#dv-tab-lista").click()
    page.wait_for_timeout(250)
    page.locator("#app .dl-r >> nth=1 >> .dl-open").click()
    page.wait_for_timeout(300)
    want = page.evaluate(f"id => ({_ROW})(id)[1].l[lang].ipa", R.TOPIC)
    seen = page.evaluate(_SEE, "#app .dl-d:not([hidden]) .ipa")
    vis_t = sorted(s["t"] for s in seen if s["vis"])
    if vis and vis_t != [want]:
        probs.append(f"{tag} · detalle de Palabras: IPA {vis_t} (se esperaba {[want]})")
    if not vis and vis_t:
        probs.append(f"{tag} · detalle de Palabras: con la IPA apagada se ve {vis_t}")
    lbl = page.evaluate("() => { const d = document.querySelector('#app .dl-d:not([hidden])'); return d ? /\\bIPA\\b/.test(d.textContent) : null; }")
    if lbl is not vis:
        probs.append(f"{tag} · detalle de Palabras: la fila «IPA» {'no ' if vis else ''}sale")
    page.locator("#dv-tab-test").click()
    page.wait_for_timeout(300)
    want = page.evaluate("() => { const t = vocabLearn.state.test; return t.qs[t.i].l[lang].ipa; }")
    page.locator("#app .qz-opt").nth(0).click()
    page.wait_for_timeout(250)
    _check(page, "Preguntas", "#qz-fb .ipa", [want], vis, probs, tag, code)
    page.locator("#dv-tab-practica").click()
    page.wait_for_timeout(300)
    page.locator("#pr-go").click()
    page.wait_for_selector("#view .pr-card.cur", timeout=5000)
    page.wait_for_timeout(500)
    want = page.evaluate(f"""([id, L]) => {{ const s = JSON.parse(localStorage.getItem('pr:' + id + ':' + L)), list = ({_ROW})(id);
      return list[s.words[s.cur].i].l[lang].ipa; }}""", [R.TOPIC, lang])
    _check(page, "Escribir", "#view .pr-card.cur .ipa", [want], vis, probs, tag, code)


def _album_site(page, lang, code, on, probs, tag):
    C.seed(page, keys=_keys(lang, on), hash="#/album/colores")
    vis = on is None or on.get("ipa") is not False
    try:
        page.wait_for_selector(".al-st.got", timeout=8000)
    except Exception:
        probs.append(f"{tag} · álbum: no hay pegatinas conseguidas en colores")
        return
    page.locator(".al-st.got").first.click()
    page.wait_for_selector("dialog.al-dlg[open]", timeout=3000)
    page.wait_for_timeout(700)
    seen = page.evaluate(_SEE, "dialog.al-dlg .al-front .ipa")
    allipa = page.evaluate("() => CACHE.colores.rows.map(r => r.l && r.l[lang] && r.l[lang].ipa).filter(Boolean)")
    vis_t = [s["t"] for s in seen if s["vis"]]
    if vis and (len(vis_t) != 1 or vis_t[0] not in allipa):
        probs.append(f"{tag} · ficha del álbum: IPA {vis_t}")
    if not vis and vis_t:
        probs.append(f"{tag} · ficha del álbum: con la IPA apagada se ve {vis_t}")
    for s in seen:
        if vis and (not s["lang"].startswith(code) or s["vh"] != "IPA:"):
            probs.append(f"{tag} · ficha del álbum: lang={s['lang']!r}, oculto={s['vh']!r}")
    page.keyboard.press("Escape")


def _lince_site(page, lang, code, on, probs, tag, ipas):
    C.seed(page, keys=_keys(lang, on), hash="#/juegos")
    page.evaluate(J._HOOKS)
    vis = on is None or on.get("ipa") is not False
    J._start(page, "lince")
    page.wait_for_function(J._LN_READY, timeout=8000)
    before = page.evaluate(_SEE, "#ln-cards .ipa")
    if any(s["vis"] for s in before):
        probs.append(f"{tag} · Oído de lince: la IPA se ve antes de contestar")
    info = J._lince_round(page, wrong=True)
    page.wait_for_timeout(300)
    want = [ipas[lang].get(w) for w in info["words"]]
    _check(page, "Oído de lince", "#ln-cards .ipa", want, vis, probs, tag, code)
    # en la tarjeta verde, en blanco (se lee)
    if vis:
        col = page.evaluate("() => { const e = document.querySelector('#ln-cards .ln-c.is-right .ipa, #ln-cards .ln-c.is-ok .ipa'); return e ? getComputedStyle(e).color : null; }")
        if col and col.replace(" ", "") not in ("rgb(255,255,255)",):
            probs.append(f"{tag} · Oído de lince: en la tarjeta verde la IPA va en {col}")


def _wotd_site(page, lang, code, on, probs, tag):
    C.seed(page, keys=_keys(lang, on))
    vis = on is None or on.get("ipa") is not False
    if not page.locator("#bd-wotd").count():
        probs.append(f"{tag} · Hoy: no sale la Palabra del día")
        return
    h0 = page.evaluate("() => Math.round(document.getElementById('bd-wotd').getBoundingClientRect().height)")
    page.locator("#bd-wotd .bd-wfront").click()
    page.wait_for_timeout(700)
    # (con dos formas, solo la primera: «/fʁɛʁ/ · /sœʁ/» → «/fʁɛʁ/»)
    want = page.evaluate("() => { const el = document.getElementById('bd-wotd'); return (CACHE[el.dataset.doc].rows.find(r => r.es === el.dataset.es && r.l && r.l[lang]).l[lang].ipa || '').split(/ · |, /)[0]; }")
    _check(page, "Palabra del día", "#bd-wotd .bd-wback .ipa", [want], vis, probs, tag, code)
    if not page.evaluate("() => /Palabra del día/.test(document.querySelector('#bd-wotd .bd-wfront').textContent)"):
        probs.append(f"{tag} · Palabra del día: la cara de delante ya no dice «Palabra del día»")
    page.evaluate("() => document.querySelector('#bd-wotd .bd-flip').classList.remove('back')")
    page.wait_for_timeout(500)
    h1 = page.evaluate("() => Math.round(document.getElementById('bd-wotd').getBoundingClientRect().height)")
    if abs(h1 - h0) > 1:
        probs.append(f"{tag} · Palabra del día: la pieza cambia de alto ({h0} → {h1})")


def _all_sites(page, lang, code, on, probs, tag, ipas):
    _lesson_sites(page, lang, code, on, probs, tag)
    _review_sites(page, lang, code, on, probs, tag)
    _doc_sites(page, lang, code, on, probs, tag)
    _album_site(page, lang, code, on, probs, tag)
    _lince_site(page, lang, code, on, probs, tag, ipas)
    _wotd_site(page, lang, code, on, probs, tag)


# ---------------------------------------------------------------- se ve de serie
def test_ipa_visible_by_default_everywhere():
    """Con la partida sembrada y vocab:ui sin la clave ipa, la IPA de la palabra se ve en cada sitio (palabra nueva,
    «Cómo suena», respuesta de la lección, reverso del repaso, Tarjetas, detalle de Palabras, Preguntas, Escribir,
    ficha del álbum, Oído de lince al contestar y Palabra del día girada) en inglés, francés y danés, con el idioma de la
    palabra, «IPA» para el lector de pantalla y fuera de la letra redonda; en la cara de la pregunta del repaso no."""
    probs = []
    ipas = _lince_ipa()
    for lang, code in LANGS:
        page = C.new_page("phone")
        try:
            _all_sites(page, lang, code, None, probs, f"{lang} · de serie", ipas)
            probs += [f"{lang}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_ipa_off_hides_it_everywhere():
    """Con vocab:ui {ipa: false} (un mayor la apagó) la IPA no sale en ninguno de esos sitios, en los tres idiomas; con
    un {ipa: true} de antes sale en todos (inglés)."""
    probs = []
    ipas = _lince_ipa()
    for lang, code in LANGS:
        page = C.new_page("phone")
        try:
            _all_sites(page, lang, code, {"ipa": False}, probs, f"{lang} · ipa:false", ipas)
            probs += [f"{lang}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    page = C.new_page("phone", color_scheme="dark")
    try:
        _all_sites(page, "english", "en", {"ipa": True}, probs, "english · ipa:true", ipas)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- el interruptor
def _switch(page):
    return page.evaluate("() => { const s = document.getElementById('aj-ipa'); return s ? {on: s.checked, role: s.getAttribute('role')} : null; }")


def test_switch_on_by_default_and_toggles():
    """«Mostrar pronunciación (IPA)» de Para mayores sale encendido de serie; apagarlo guarda ipa:false (sin tocar las
    pistas) y la IPA deja de verse en la lección; encenderlo quita la marca y vuelve a verse. Con un {ipa: true} de antes
    sale encendido y al apagarlo guarda ipa:false. vocab:ui no va en la partida."""
    probs = []
    page = C.new_page("phone")
    try:
        for ui in (None, {"ipa": True}):
            tag = "sin clave" if ui is None else "ipa:true de antes"
            C.seed(page, keys=_keys("english", ui))
            page.evaluate(_PASS)
            page.evaluate("() => openSettings('mayores')")
            page.wait_for_selector("#aj-ipa", state="attached", timeout=5000)
            page.wait_for_timeout(500)
            sw = _switch(page)
            if not sw or not sw["on"] or sw["role"] != "switch":
                probs.append(f"{tag}: el interruptor no sale encendido: {sw}")
            page.locator("label[for=aj-ipa]").click()
            page.wait_for_timeout(150)
            u = page.evaluate(_UI)
            if u.get("ipa") is not False or u.get("hints") != _HINTS or _switch(page)["on"]:
                probs.append(f"{tag}: apagar guarda {u!r}")
            if page.evaluate("() => ipaOn()") is not False:
                probs.append(f"{tag}: apagada, ipaOn() sigue diciendo que sí")
            page.evaluate("() => vocabSettings.close()")
            page.wait_for_function("() => !document.querySelector('dialog#ajustes[open]')", timeout=4000)
            C.goto(page, "#/leccion/" + LION)
            page.wait_for_selector(".ls-stage .ls-learn", timeout=8000)
            page.wait_for_timeout(300)
            if page.evaluate(f"() => document.querySelectorAll('{_CUR} .ipa').length"):
                probs.append(f"{tag}: apagada, la lección sigue enseñando la IPA")
            # encender otra vez (desde una pantalla con la barra)
            C.goto(page, "#/", reload=True)
            page.evaluate(_PASS)
            page.evaluate("() => openSettings('mayores')")
            page.wait_for_selector("#aj-ipa", state="attached", timeout=5000)
            page.wait_for_timeout(500)
            if _switch(page)["on"]:
                probs.append(f"{tag}: tras recargar, el interruptor sale encendido estando apagada")
            page.locator("label[for=aj-ipa]").click()
            page.wait_for_timeout(150)
            u = page.evaluate(_UI)
            if "ipa" in u or u.get("hints") != _HINTS or not _switch(page)["on"]:
                probs.append(f"{tag}: encender guarda {u!r}")
            page.evaluate("() => vocabSettings.close()")
            page.wait_for_function("() => !document.querySelector('dialog#ajustes[open]')", timeout=4000)
            C.goto(page, "#/leccion/" + LION, reload=True)
            page.wait_for_selector(".ls-stage .ls-learn .ipa", timeout=8000)
            if "vocab:ui" in C.export(page)["keys"]:
                probs.append(f"{tag}: vocab:ui va en la partida")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- aspecto y letra
def test_ipa_style_and_font():
    """En la palabra nueva, «Cómo suena» y el reverso del repaso, la IPA va en gris secundario (--label2, el mismo color
    que la traducción) y en tamaño subtítulo (17 px); en el detalle de Palabras, en el color de los otros valores de su
    fila (es un valor, no un subtítulo). Se dibuja con una
    sola letra que tiene todos sus símbolos (ni cuadraditos ni símbolos de otra letra; nunca Nunito), en los tres
    idiomas y en claro y oscuro."""
    probs = []
    for scheme in ("light", "dark"):
        for lang, code in LANGS:
            tag = f"{lang}/{scheme}"
            page = C.new_page("phone", color_scheme=scheme)
            try:
                C.seed(page, keys=_keys(lang), hash="#/leccion/" + LION)
                page.wait_for_selector(f"{_CUR} .ls-learn .ipa", timeout=8000)
                page.wait_for_timeout(400)
                cdp = page.context.new_cdp_session(page)
                cdp.send("DOM.enable")
                cdp.send("CSS.enable")

                def fonts(sel):
                    root = cdp.send("DOM.getDocument", {"depth": -1})["root"]["nodeId"]
                    out = []
                    for nid in cdp.send("DOM.querySelectorAll", {"nodeId": root, "selector": sel})["nodeIds"]:
                        out.append([f["familyName"] for f in cdp.send("CSS.getPlatformFontsForNode", {"nodeId": nid})["fonts"]])
                    return out

                def look(where, sel, ref=None):
                    for f in fonts(sel):
                        if len(f) != 1 or any("nunito" in x.lower() for x in f):
                            probs.append(f"{tag} · {where}: la IPA se dibuja con {f} (una sola letra, sin Nunito)")
                    st = page.evaluate("""([sel, ref]) => { const e = document.querySelector(sel), r = ref && document.querySelector(ref);
                      if (!e) return null; const cs = getComputedStyle(e);
                      return {color: cs.color, fs: parseFloat(cs.fontSize), ref: r ? getComputedStyle(r).color : null,
                        label2: getComputedStyle(document.documentElement).getPropertyValue('--label2').trim()}; }""", [sel, ref])
                    if not st:
                        probs.append(f"{tag} · {where}: no hay IPA")
                        return
                    if st["ref"] and st["color"] != st["ref"]:
                        probs.append(f"{tag} · {where}: la IPA no va en el gris secundario ({st['color']} ≠ {st['ref']})")
                    return st

                st = look("palabra nueva", f"{_CUR} .ls-learn .ipa", f"{_CUR} .ls-tr")
                if st and abs(st["fs"] - 17) > .6:
                    probs.append(f"{tag} · palabra nueva: la IPA a {st['fs']} px (subtítulo, 17)")
                if not page.evaluate(_ORDER, [f"{_CUR} .ls-word", f"{_CUR} .ls-learn .ipa", f"{_CUR} .ls-tr"]):
                    probs.append(f"{tag} · palabra nueva: la IPA no va justo debajo de la palabra (antes de la traducción)")
                page.locator(f"{_CUR} [data-how]").click()
                page.wait_for_selector("dialog#ls-how[open] .ipa", timeout=3000)
                page.wait_for_timeout(400)
                st = look("«Cómo suena»", "#ls-how .ipa", "#ls-how .ls-how-p")
                if st and abs(st["fs"] - 17) > .6:
                    probs.append(f"{tag} · «Cómo suena»: la IPA a {st['fs']} px (subtítulo, 17)")
                C.seed(page, keys=_keys(lang, cards=True), hash="#/repaso")
                page.wait_for_selector("#rv-card", timeout=10000)
                V._tap_card(page)
                page.wait_for_timeout(450)
                st = look("reverso del repaso", "#rv-card .rv-a .ipa", "#rv-card .rv-a .rv-tr")
                if st and abs(st["fs"] - 17) > .6:
                    probs.append(f"{tag} · reverso del repaso: la IPA a {st['fs']} px (subtítulo, 17)")
                if not page.evaluate(_ORDER, ["#rv-card .rv-a .rv-word", "#rv-card .rv-a .ipa", "#rv-card .rv-a .rv-tr"]):
                    probs.append(f"{tag} · reverso del repaso: la IPA no va justo debajo de la palabra (antes de la traducción)")
                C.seed(page, keys=_keys(lang), hash=f"#/doc/{R.TOPIC}")
                page.wait_for_selector("#card", timeout=8000)
                page.locator("#dv-tab-lista").click()
                page.wait_for_timeout(250)
                page.locator("#app .dl-r >> nth=1 >> .dl-open").click()
                page.wait_for_timeout(300)
                # en el detalle, la IPA es el valor de su fila: en el color de los otros valores («Se dice», «Plural»)
                look("detalle de Palabras", "#app .dl-d:not([hidden]) .ipa", "#app .dl-d:not([hidden]) .dl-ln")
                probs += [f"{tag}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- sin scroll
def test_today_lesson_review_fit_without_scroll():
    """Con la IPA a la vista, Hoy (con la Palabra del día girada y sin perder filas frente a la IPA apagada), la lección
    (cada palabra nueva de la lección siguiente y de la de «lion», y «¿Cuál es…?» tras un fallo) y el repaso girado
    caben sin scroll en 390×844 y 360×740, con el texto normal y con «Texto más grande». El dibujo de la palabra nueva
    no baja de 120 px."""
    probs = []
    for w, h in ((390, 844), (360, 740)):
        for text in ("", "large"):
            tag = f"{w}×{h}{' texto grande' if text else ''}"
            page = C.new_page("phone", viewport={"width": w, "height": h})
            try:
                # Hoy: las mismas filas que con la IPA apagada
                rows = {}
                for ui in ({"ipa": False}, None):
                    C.seed(page, keys=_keys("english", ui, text))
                    page.wait_for_timeout(500)
                    rows[json.dumps(ui)] = page.evaluate("() => [...document.querySelectorAll('#hm-slots .hm-slot, .hm-pair > *, #hm-rev')].length")
                    f = page.evaluate(_FIT)
                    page.locator("#bd-wotd .bd-wfront").click()
                    page.wait_for_timeout(700)
                    f2 = page.evaluate(_FIT)
                    if ui is None and (f["sh"] > f["ih"] or f2["sh"] > f2["ih"]):
                        probs.append(f"{tag}: Hoy baja con la IPA ({f} · girada {f2})")
                if rows[json.dumps(None)] != rows[json.dumps({"ipa": False})]:
                    probs.append(f"{tag}: Hoy pierde filas con la IPA ({rows})")
                # la lección: cada palabra nueva
                for lesson in (R.LESSON, LION):
                    C.seed(page, keys=_keys("english", None, text), hash="#/leccion/" + lesson)
                    page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-learn')", timeout=8000)
                    page.evaluate(L._HOOK)
                    page.evaluate(L._FAKE_AUDIO)
                    while page.evaluate(L._ST)["t"] == "learn":
                        page.wait_for_timeout(450)
                        f = page.evaluate(_FIT)
                        m = page.evaluate(f"""() => {{ const p = document.querySelector('{_CUR}'), i = p.querySelector('.ls-pic img'), x = p.querySelector('.ipa');
                          return {{w: p.querySelector('.ls-word').textContent, pic: i ? Math.round(i.getBoundingClientRect().height) : null, ipa: !!x}}; }}""")
                        if f["sh"] > f["ih"]:
                            probs.append(f"{tag}: la palabra nueva «{m['w']}» baja ({f})")
                        if not m["ipa"]:
                            probs.append(f"{tag}: «{m['w']}» sin IPA")
                        if m["pic"] is not None and m["pic"] < 120 - 1:
                            probs.append(f"{tag}: el dibujo de «{m['w']}» mide {m['pic']} px")
                        L._go(page)
                    for _ in range(40):
                        st = page.evaluate(L._ST)
                        if st["t"] == "pick":
                            break
                        L._pick(page, st["right"])
                        L._wait_change(page, st["i"], 9000)
                        page.wait_for_timeout(250)
                    L._pick(page, L._wrong(page, st["right"]))
                    page.wait_for_timeout(900)
                    f = page.evaluate(_FIT)
                    y = page.evaluate("() => scrollY")
                    if f["sh"] > f["ih"] or y:
                        probs.append(f"{tag}: «¿Cuál es…?» tras un fallo baja ({f}, scrollY {y})")
                # el repaso girado: nada se corta dentro de la tarjeta
                C.seed(page, keys=_keys("english", None, text, cards=True), hash="#/repaso")
                page.wait_for_selector("#rv-card", timeout=10000)
                V._tap_card(page)
                page.wait_for_timeout(500)
                f = page.evaluate(_FIT)
                face = page.evaluate("""() => { const a = document.querySelector('#rv-card .rv-a'), b = a.getBoundingClientRect(), s = a.querySelector('.rv-audio').getBoundingClientRect();
                  const i = a.querySelector('.ipa').getBoundingClientRect();
                  return {over: a.scrollHeight > a.clientHeight + 1, audioIn: s.bottom <= b.bottom + .5, ipaIn: i.top >= b.top && i.bottom <= b.bottom}; }""")
                if f["sh"] > f["ih"] or face["over"] or not face["audioIn"] or not face["ipaIn"]:
                    probs.append(f"{tag}: el repaso girado no cabe ({f}, {face})")
                probs += [f"{tag}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)


def test_lince_fits_small_phones():
    """Oído de lince con la IPA (su hueco reservado en cada tarjeta) cabe sin scroll en las 8 rondas, antes y después
    de contestar, también en un móvil pequeño (320×568: salta la versión compacta), y la IPA queda dentro de su tarjeta."""
    probs = []
    for w, h in ((320, 568), (360, 740), (390, 844)):
        tag = f"{w}×{h}"
        page = C.new_page("phone", viewport={"width": w, "height": h})
        try:
            # con la explicación ya vista (sin ella, la primera vez, el juego sale más alto y ya va compacto)
            C.seed(page, keys=_keys(ui={"gmIntro": ["memoria", "lluvia", "globos", "letras", "lince"]}), hash="#/juegos")
            page.evaluate(J._HOOKS)
            J._start(page, "lince")
            for r in range(8):
                page.wait_for_function(J._LN_READY, timeout=8000)
                page.wait_for_timeout(250)
                f = page.evaluate(_FIT)
                if f["sh"] > f["ih"] + 1:
                    probs.append(f"{tag} · ronda {r + 1}: no cabe antes de contestar ({f})")
                J._lince_round(page, wrong=True)
                page.wait_for_selector("#ln-go", timeout=6000)
                page.wait_for_timeout(250)
                f = page.evaluate(_FIT)
                m = page.evaluate("""() => [...document.querySelectorAll('#ln-cards .ln-c')].map(c => { const i = c.querySelector('.ipa'), b = c.getBoundingClientRect();
                  if (!i) return null; const r = i.getBoundingClientRect(); return {w: c.dataset.w, inside: r.top >= b.top - .5 && r.bottom <= b.bottom + .5 && r.left >= b.left - .5 && r.right <= b.right + .5}; })""")
                if f["sh"] > f["ih"] + 1:
                    probs.append(f"{tag} · ronda {r + 1}: no cabe al contestar ({f})")
                for x in m:
                    if x and not x["inside"]:
                        probs.append(f"{tag} · ronda {r + 1}: la IPA de «{x['w']}» se sale de su tarjeta")
                page.locator("#ln-go").click()
            page.wait_for_selector("#gm-end", timeout=8000)
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- dónde se parte, cuánto ocupa
def _off_space(lines, src):
    """Los cortes de línea de lines (las líneas de la IPA src) que no caen en un espacio: «/» sola al final de una
    línea, una palabra partida antes de ˈ…"""
    import unicodedata
    S = src.replace("⁠", "")
    i, bad = 0, []
    for k, ln in enumerate(lines):
        for ch in ln:
            while i < len(S) and S[i] != ch and (S[i].isspace() or unicodedata.combining(S[i])):
                i += 1
            if i < len(S) and S[i] == ch:
                i += 1
        if k < len(lines) - 1 and not ln[-1:].isspace() and not (i < len(S) and S[i].isspace()):
            bad.append(f"{ln!r} | {lines[k + 1]!r}")
    return bad


def _tarjeta(page, topic, word):
    """Tarjetas de topic con la tarjeta de word ya girada."""
    page.wait_for_selector("#card", timeout=8000)
    i = page.evaluate(f"([id, w]) => ({_ROW})(id).findIndex(r => r.l[lang].word === w)", [topic, word])
    page.evaluate("i => { const s = vocabLearn.state.fc; s.order = null; s.i = i; s.flip = true; s.rev = false; }", i)
    page.locator("#dv-tab-lista").click()
    page.wait_for_timeout(150)
    page.locator("#dv-tab-tarjetas").click()
    page.wait_for_selector("#card.is-back", timeout=4000)
    page.wait_for_timeout(300)
    return i


def _escribir(page, topic, lang, i, act):
    """Escribir de topic con la palabra i y la actividad act delante (la sesión de siempre en pr:<tema>:<idioma>)."""
    n = page.evaluate(f"id => ({_ROW})(id).length", topic)
    sess = {"running": True, "acts": [act], "reps": 1, "words": [{"i": j, "n": 0} for j in range(n)], "cur": i, "step": 0}
    page.evaluate("([k, v]) => localStorage.setItem(k, v)", [f"pr:{topic}:{lang}", json.dumps(sess)])
    C.goto(page, "#/palabras", settle_ms=50)
    C.goto(page, f"#/doc/{topic}?m=practica", settle_ms=150)
    page.wait_for_selector("#pr-flow .pr-card.cur", timeout=8000)
    page.wait_for_timeout(250)


# la IPA de sel: en bloque y, si delante va texto («Se dice «…»»), en la línea de debajo; lead: ese texto
_OWN = """sel => { const x = document.querySelector(sel); if (!x) return null; const p = x.parentElement, first = p.firstChild;
  const lead = first && first !== x && first.nodeType === 3 ? first.data : '';
  return {block: getComputedStyle(x).display === 'block', below: !lead.trim() || x.getBoundingClientRect().top >= p.getBoundingClientRect().top + 4, lead}; }"""
_WORDS = [("français", "profesiones", "l'infirmier / l'infirmière"), ("english", "animales", "hamster"), ("english", "animales", "dog"),
          ("dansk", "animales", None)]


def test_ipa_breaks_only_at_spaces():
    """La IPA solo se parte por los espacios: ipaHtml() pone un «word joiner» (U+2060) tras la «/» de apertura y antes
    de ˈ ˌ pegados a una letra, y sin ellos el texto es el de los datos. En Tarjetas (girada) y en Escribir (Escuchar, Leer y
    Hablar) la IPA va en su propia línea bajo «Se dice «…»», sin « · » delante, y el plural o las formas llevan su nombre
    («Plural: …»); en 390×844 y 360×740 (y con «Texto más grande» en 360) ninguna línea termina en una «/» de apertura ni
    parte una palabra antes del acento (l'infirmier, hamster, dog y una danesa con ˀ). Las IPA más largas de los datos
    (danés, francés con dos formas, inglés con dos acentos) en una caja estrecha, igual."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page, keys=_keys())
        page.wait_for_timeout(300)
        for src in ("/ˈhæmstə/", "/ɛ̃fiʁmje/ · /ɛ̃fiʁmjɛʁ/", "/ˈweɪtə/, /ˈweɪtrəs/", "/dɛn dominiˈkæˀnskə ʁepuˈblik/", "/ˌhɪpəˈpɒtəməs/"):
            h = page.evaluate("s => { const d = document.createElement('div'); d.innerHTML = ipaHtml(s, 'en'); const x = d.querySelector('.ipa'); x.querySelector('.vh').remove(); return x.textContent; }", src)
            if h.replace("⁠", "") != src:
                probs.append(f"ipaHtml cambia el texto: {src!r} → {h!r}")
            for k, ch in enumerate(src):
                if ch == "/" and k + 1 < len(src) and not src[k + 1].isspace() and "/⁠" not in h:
                    probs.append(f"ipaHtml {src!r}: sin «word joiner» tras la «/» de apertura ({h!r})")
                    break
            for m in ("ˈ", "ˌ"):
                if m in src and h.count("⁠" + m) != len([1 for k, ch in enumerate(src) if ch == m and k and not src[k - 1].isspace()]):
                    probs.append(f"ipaHtml {src!r}: sin «word joiner» antes de {m} ({h!r})")
        # caja estrecha: las IPA más largas de los datos
        longest = page.evaluate("""async () => { const out = []; for (const [L, id] of [['dansk', 'paises'], ['français', 'profesiones'], ['english', 'animales'], ['english', 'profesiones']]) {
            const d = await getDoc(id); const rs = d.rows.filter(r => r.l && r.l[L] && r.l[L].ipa).sort((a, b) => b.l[L].ipa.length - a.l[L].ipa.length);
            out.push(...rs.slice(0, 3).map(r => r.l[L].ipa)); } return out; }""")
        for src in longest:
            for wpx in (150, 190):
                got = page.evaluate(f"""([s, w]) => {{ const d = document.createElement('div');
                  d.style.cssText = `position:absolute;left:0;top:0;width:${{w}}px;font-size:15px;line-height:1.3;overflow-wrap:anywhere`;
                  d.innerHTML = ipaHtml(s, 'en'); document.body.append(d);
                  const widest = Math.max(...s.split(/\\s+/).map(t => {{ const sp = document.createElement('span'); sp.className = 'ipa'; sp.style.whiteSpace = 'nowrap';
                    sp.textContent = t; d.append(sp); const r = sp.getBoundingClientRect().width; sp.remove(); return r; }}));
                  const lines = ({_LINES})(d.querySelector('.ipa')); d.remove(); return {{widest, lines}}; }}""", [src, wpx])
                if got["widest"] > wpx:
                    continue   # una palabra sola no cabe: ahí solo queda partirla (overflow-wrap), no es un corte malo
                bad = _off_space(got["lines"], src)
                if bad:
                    probs.append(f"caja de {wpx} px · {src}: se parte fuera de un espacio: {bad}")
        probs += C.errors(page)
    finally:
        page.context.close()
    for w, h, text in ((390, 844, ""), (360, 740, ""), (360, 740, "large")):
        tag = f"{w}×{h}{' texto grande' if text else ''}"
        page = C.new_page("phone", viewport={"width": w, "height": h})
        try:
            for lang, topic, word in _WORDS:
                C.seed(page, keys=_keys(lang, None, text), hash=f"#/doc/{topic}?m=tarjetas")
                page.wait_for_selector("#card", timeout=8000)
                if word is None:   # una danesa con «Se dice», ˀ y acento
                    word = page.evaluate(f"id => {{ const r = ({_ROW})(id).find(r => /ˀ/.test(r.l[lang].ipa || '') && /ˈ/.test(r.l[lang].ipa || '') && r.l[lang].pron && r.l[lang].pron !== r.l[lang].word); return r ? r.l[lang].word : null; }}", topic)
                    if not word:
                        probs.append(f"{tag} · {lang}: no hay palabra danesa con ˀ y ˈ en {topic}")
                        continue
                i = _tarjeta(page, topic, word)
                d = page.evaluate(f"([id, i]) => {{ const r = ({_ROW})(id)[i]; return {{ipa: r.l[lang].ipa, pron: r.l[lang].pron, w: r.l[lang].word, forms: r.l[lang].forms, pos: r.pos || ''}}; }}", [topic, i])
                o = page.evaluate(_OWN, "#card .fcx-meta .ipa")
                say = page.evaluate("([a, b]) => { const n = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9æøåœ]/g, ''); return !!a && n(a) !== n(b); }", [d["pron"], d["w"]])
                if not o or not o["block"] or not o["below"]:
                    probs.append(f"{tag} · Tarjetas «{word}»: la IPA no va en su propia línea ({o})")
                elif "·" in o["lead"] or (say and "Se dice" not in o["lead"]):
                    probs.append(f"{tag} · Tarjetas «{word}»: delante de la IPA va {o['lead']!r}")
                bad = _off_space(page.evaluate(_LINES, "#card .fcx-meta .ipa") or [], d["ipa"])
                if bad:
                    probs.append(f"{tag} · Tarjetas «{word}»: la IPA se parte fuera de un espacio: {bad}")
                if d["forms"]:
                    k = "Plural" if not d["pos"] or d["pos"] == "noun" else "Formas"
                    fl = page.evaluate("() => [...document.querySelectorAll('#card .fcx-meta')].map(e => e.textContent.trim())")
                    if not any(x.startswith(k + ":") for x in fl):
                        probs.append(f"{tag} · Tarjetas «{word}»: las formas sin «{k}:» delante ({fl})")
                for act in ("escuchar", "leer", "hablar"):
                    _escribir(page, topic, lang, i, act)
                    o = page.evaluate(_OWN, "#pr-flow .pr-card.cur .pw-line .ipa")
                    if not o or not o["block"] or not o["below"] or "·" in (o or {}).get("lead", ""):
                        probs.append(f"{tag} · Escribir/{act} «{word}»: la IPA no va en su propia línea ({o})")
                    bad = _off_space(page.evaluate(_LINES, "#pr-flow .pr-card.cur .pw-line .ipa") or [], d["ipa"])
                    if bad:
                        probs.append(f"{tag} · Escribir/{act} «{word}»: la IPA se parte fuera de un espacio: {bad}")
                    if act == "leer" and d["forms"]:
                        fl = page.evaluate("() => [...document.querySelectorAll('#pr-flow .pr-card.cur .pw-line')].map(e => e.textContent.trim())")
                        if not any(x.startswith(("Plural:", "Formas:")) for x in fl):
                            probs.append(f"{tag} · Escribir/leer «{word}»: las formas sin su nombre ({fl})")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_escribir_cards_fit_in_flow():
    """Escribir: la tarjeta de ahora (Escuchar, Leer y Hablar, con micrófono) cabe entera en su hueco con la IPA en su
    línea: el hueco crece con ella (antes era fijo, de 540 px, y la tarjeta se cortaba arriba y abajo sin poder bajar), con
    el contador y el botón de abajo a la vista; palabras con y sin «Se dice» y una francesa de dos formas, en 390×844 y
    360×740, con el texto normal y con «Texto más grande»."""
    probs = []
    meas = """() => { const f = document.getElementById('pr-flow').getBoundingClientRect(), c = document.querySelector('#pr-flow .pr-card.cur'), b = c.getBoundingClientRect();
      const n = c.querySelector('.pr-next').getBoundingClientRect(), k = c.querySelector('.pr-num').getBoundingClientRect(), d = document.querySelector('#pr-flow .pr-dots');
      return {top: Math.round(b.top - f.top), bot: Math.round(f.bottom - b.bottom), next: n.bottom <= f.bottom + .5 && n.top >= f.top - .5, num: k.top >= f.top - .5,
        dots: d ? d.getBoundingClientRect().top >= b.bottom - .5 : true, flow: Math.round(f.height), card: Math.round(b.height)}; }"""
    for w, h in ((390, 844), (360, 740)):
        for text in ("", "large"):
            tag = f"{w}×{h}{' texto grande' if text else ''}"
            page = C.new_page("phone", viewport={"width": w, "height": h})
            try:
                for lang, topic, words in (("english", "animales", ["dog", "cat", "rabbit", "tortoise"]), ("français", "profesiones", ["l'infirmier / l'infirmière"])):
                    C.seed(page, keys=_keys(lang, None, text), hash=f"#/doc/{topic}")
                    page.wait_for_selector("#card", timeout=8000)
                    for word in words:
                        i = page.evaluate(f"([id, w]) => ({_ROW})(id).findIndex(r => r.l[lang].word === w)", [topic, word])
                        for act in ("escuchar", "leer", "hablar"):
                            _escribir(page, topic, lang, i, act)
                            m = page.evaluate(meas)
                            if m["top"] < 0 or m["bot"] < 0 or not m["next"] or not m["num"] or not m["dots"]:
                                probs.append(f"{tag} · {act} «{word}»: la tarjeta no cabe en su hueco {m}")
                probs += [f"{tag}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)


def test_wotd_long_ipa_one_line():
    """La Palabra del día girada con IPA largas (danés «Den Dominikanske Republik»; francés y inglés con dos formas, de
    las que solo sale la primera): la IPA en una sola línea (con «…» si no cabe), la palabra en el color del texto (por
    encima de su IPA gris), al menos 8 px hasta «¡Me la sé!», la pieza no más alta que con la IPA apagada y Hoy sin
    scroll (o, si ya bajaba sin la IPA, no más), en 390×844 y 360×740."""
    probs = []
    cases = [("dansk", "paises", "República Dominicana"), ("français", "profesiones", "Electricista"), ("english", "profesiones", None)]
    meas = """() => { const el = document.getElementById('bd-wotd'), b = el.querySelector('.bd-wback'), t = b.querySelector('.bd-wtap'), k = b.querySelector('.bd-know, .bd-wok'), i = b.querySelector('.ipa'), w = b.querySelector('.bd-wsm');
      const lh = i ? parseFloat(getComputedStyle(i).lineHeight) : 0, vh = i && i.querySelector('.vh');
      return {ipa: i ? [...i.childNodes].filter(n => n !== vh).map(n => n.textContent).join('').replace(/\\u2060/g, '') : null, lines: i ? i.getBoundingClientRect().height / lh : 0,
        gap: k ? Math.round(k.getBoundingClientRect().top - t.getBoundingClientRect().bottom) : null, piece: Math.round(el.getBoundingClientRect().height),
        wc: w ? getComputedStyle(w).color : null, ic: i ? getComputedStyle(i).color : null, label: getComputedStyle(document.body).color,
        sh: document.documentElement.scrollHeight, ih: innerHeight}; }"""
    for w, h in ((390, 844), (360, 740)):
        page = C.new_page("phone", viewport={"width": w, "height": h})
        try:
            for lang, doc, es in cases:
                got = {}
                for ui in ({"ipa": False}, None):
                    C.seed(page, keys=_keys(lang, ui))
                    page.wait_for_selector("#bd-wotd", timeout=8000)
                    page.evaluate("id => getDoc(id)", doc)
                    if es is None:   # la de dos formas con la IPA más larga
                        es = page.evaluate("([id, L]) => { const rs = CACHE[id].rows.filter(r => r.es && r.l && r.l[L] && /, | · /.test(r.l[L].ipa || '')); rs.sort((a, b) => b.l[L].ipa.length - a.l[L].ipa.length); return rs.length ? rs[0].es : null; }", [doc, lang])
                    page.evaluate("([id, es]) => { const el = document.getElementById('bd-wotd'); el.dataset.doc = id; el.dataset.es = es; vocabBuddy.paintWotd(true); }", [doc, es])
                    page.wait_for_timeout(500)
                    got[json.dumps(ui)] = page.evaluate(meas)
                on, off = got["null"], got[json.dumps({"ipa": False})]
                tag = f"{w}×{h} · {lang} «{es}»"
                full = page.evaluate("([id, es]) => CACHE[id].rows.find(r => r.es === es).l[lang].ipa", [doc, es])
                if on["ipa"] != full.split(" · ")[0].split(", ")[0]:
                    probs.append(f"{tag}: la IPA es {on['ipa']!r} (la primera forma de {full!r})")
                if on["lines"] > 1.5:
                    probs.append(f"{tag}: la IPA ocupa {on['lines']:.1f} líneas")
                if on["gap"] is None or on["gap"] < 8:
                    probs.append(f"{tag}: {on['gap']} px hasta «¡Me la sé!»")
                if on["piece"] > off["piece"] + 1:
                    probs.append(f"{tag}: la pieza crece con la IPA ({off['piece']} → {on['piece']})")
                if on["wc"] != on["label"] or on["wc"] == on["ic"]:
                    probs.append(f"{tag}: la palabra en {on['wc']} y su IPA en {on['ic']} (texto {on['label']})")
                if on["sh"] > max(on["ih"], off["sh"]):   # (una palabra de dos líneas en los dos idiomas ya bajaba sin la IPA)
                    probs.append(f"{tag}: Hoy baja con la IPA ({on['sh']} > {on['ih']}; sin ella {off['sh']})")
                es = es if doc == "paises" or lang == "français" else None
            probs += [f"{w}×{h}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def _toggle(page):
    """Engranaje › Para mayores (con la Puerta ya pasada) › el interruptor de la IPA, y se cierra Ajustes."""
    page.evaluate(_PASS)
    page.evaluate("() => openSettings('mayores')")
    page.wait_for_selector("#aj-ipa", state="attached", timeout=5000)
    page.wait_for_timeout(400)
    page.locator("label[for=aj-ipa]").click()
    page.wait_for_timeout(150)
    page.evaluate("() => vocabSettings.close()")
    page.wait_for_function("() => !document.querySelector('dialog#ajustes[open]')", timeout=4000)
    page.wait_for_timeout(600)


def test_switch_repaints_without_navigating():
    """Apagar o encender la IPA desde el engranaje, sin cambiar de pantalla: al cerrar Ajustes, lo que había debajo se
    repinta (antes seguía con lo de antes hasta navegar): en Palabras › Lista, el detalle abierto; en Hoy, la Palabra del
    día al girarla (sin IPA vuelve la etiqueta «Palabra del día»). Y al revés, al encenderla vuelve a salir."""
    probs = []
    toggle = _toggle
    vis = "sel => [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').length"
    page = C.new_page("phone")
    try:
        C.seed(page, keys=_keys(), hash=f"#/doc/{R.TOPIC}?m=lista")
        page.wait_for_selector("#app .dl-r", timeout=8000)
        for want in (False, True):
            page.locator("#app .dl-r >> nth=1 >> .dl-open").click()
            page.wait_for_timeout(300)
            if page.evaluate(vis, "#app .dl-d .ipa") != (0 if want else 1):
                probs.append(f"Lista: antes de {'encender' if want else 'apagar'}, el detalle {'enseña' if want else 'no enseña'} la IPA")
            toggle(page)
            if page.evaluate("() => ipaOn()") is not want:
                probs.append(f"Lista: el interruptor no {'enciende' if want else 'apaga'} la IPA")
            if not page.evaluate("() => document.querySelector('#app .dl-r .dl-d:not([hidden])')"):
                page.locator("#app .dl-r >> nth=1 >> .dl-open").click()
                page.wait_for_timeout(300)
            if page.evaluate(vis, "#app .dl-d .ipa") != (1 if want else 0):
                probs.append(f"Lista: tras {'encender' if want else 'apagar'} la IPA sin navegar, el detalle sigue como antes")
            page.locator("#app .dl-r >> nth=1 >> .dl-open").click()
            page.wait_for_timeout(250)
        C.goto(page, "#/")
        page.wait_for_selector("#bd-wotd", timeout=8000)
        for want in (False, True):
            toggle(page)
            page.locator("#bd-wotd .bd-wfront").click()
            page.wait_for_timeout(700)
            n = page.evaluate(vis, "#bd-wotd .bd-wback .ipa")
            lbl = page.evaluate("() => !!document.querySelector('#bd-wotd .bd-wback .bd-pl')")
            if n != (1 if want else 0) or lbl is want:
                probs.append(f"Hoy: tras {'encender' if want else 'apagar'} la IPA sin navegar, la Palabra del día girada enseña IPA={n}, etiqueta={lbl}")
            page.locator("#bd-wotd .bd-wtap").click()
            page.wait_for_timeout(600)
        if page.evaluate(_UI).get("ipa", "sin clave") != "sin clave":
            probs.append(f"al final vocab:ui {page.evaluate(_UI)!r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_switch_keeps_what_was_half_done():
    """Apagar o encender la IPA con algo a medias fuera del modo foco no lo empieza de nuevo: en Palabras › Preguntas
    la ronda sigue (la pregunta, la cuenta y lo ya contestado, también con la respuesta a la vista y «Seguir») y la
    respuesta siguiente ya va con la IPA nueva; en Tarjetas siguen el orden de «Barajar», la tarjeta y su giro, y el
    reverso se repinta con o sin IPA; en la pantalla final de Oído de lince no empieza otra partida."""
    probs = []
    st = "() => { const t = vocabLearn.state.test; return t && {i: t.i, ok: t.ok, n: t.qs.length, answered: t.answered}; }"
    fb_ipa = "() => document.querySelectorAll('#qz-fb .ipa').length"
    page = C.new_page("phone")
    try:
        # Palabras › Preguntas: 3 contestadas, la 4.ª contestada sin «Seguir»
        C.seed(page, keys=_keys(), hash=f"#/doc/{R.TOPIC}?m=test")
        page.wait_for_selector("#view .qz-opt", timeout=8000)
        for k in range(4):
            page.locator("#view .qz-opt").nth(0).click()
            page.wait_for_selector("#nextq:not([hidden])", timeout=3000)
            if k < 3:
                page.locator("#nextq").click()
                page.wait_for_function("k => vocabLearn.state.test.i === k + 1 && !!document.querySelector('#view .qz-opt:not([disabled])')",
                                       arg=k, timeout=3000)
        before = page.evaluate(st)
        n_before = page.locator("#view .qz-n").text_content()
        ask = page.locator("#view .qz-ask").text_content()
        _toggle(page)
        if page.evaluate("() => ipaOn()") is not False:
            probs.append("Preguntas: el interruptor no apaga la IPA")
        after = page.evaluate(st)
        if after != before or page.locator("#view .qz-n").text_content() != n_before or page.locator("#view .qz-ask").text_content() != ask:
            probs.append(f"Preguntas: la ronda empieza de nuevo al apagar la IPA: {before} {n_before!r} → {after} "
                         f"{page.locator('#view .qz-n').text_content()!r}")
        if not page.locator("#nextq:not([hidden])").count():
            probs.append("Preguntas: tras apagar la IPA ya no está «Seguir» de la respuesta a la vista")
        else:
            page.locator("#nextq").click()
            page.wait_for_function("() => vocabLearn.state.test.i === 4 && !!document.querySelector('#view .qz-opt:not([disabled])')", timeout=3000)
            if page.locator("#view .qz-n").text_content() != "5/10":
                probs.append(f"Preguntas: tras «Seguir» la cuenta es {page.locator('#view .qz-n').text_content()!r} (no 5/10)")
            page.locator("#view .qz-opt").nth(0).click()
            page.wait_for_selector("#nextq:not([hidden])", timeout=3000)
            if page.evaluate(fb_ipa):
                probs.append("Preguntas: con la IPA apagada, la respuesta siguiente la enseña")
        mid = page.evaluate(st)
        _toggle(page)   # otra vez encendida
        if page.evaluate("() => ipaOn()") is not True:
            probs.append("Preguntas: el interruptor no enciende la IPA")
        if page.evaluate(st) != mid or mid["i"] != 4 or page.locator("#view .qz-n").text_content() != "5/10":
            probs.append(f"Preguntas: la ronda empieza de nuevo al encender la IPA: {mid} → {page.evaluate(st)}")

        # Tarjetas: «Barajar», dos «Siguiente» y girada
        page.locator("#dv-tab-tarjetas").click()
        page.wait_for_selector("#view #card", timeout=4000)
        page.locator("#view #shuf").click()
        page.wait_for_timeout(300)
        for _ in range(2):
            page.locator("#view #next").click()
            page.wait_for_timeout(300)
        page.locator("#view #card").click(position={"x": 24, "y": 24})
        page.wait_for_selector("#view #card.is-back", timeout=3000)
        page.wait_for_timeout(300)
        fc = "() => { const s = vocabLearn.state.fc; return {order: s.order, i: s.i, flip: s.flip, rev: s.rev}; }"
        word = "() => [...document.querySelectorAll('#card .fcx-w')].map(e => e.textContent).join('|')"
        n_ipa = "() => document.querySelectorAll('#card.is-back .ipa').length"
        f0, w0, ipa0 = page.evaluate(fc), page.evaluate(word), page.evaluate(n_ipa)
        if f0["i"] != 2 or not f0["flip"] or not f0["order"]:
            probs.append(f"Tarjetas: la preparación no vale: {f0}")
        for want in (False, True):
            _toggle(page)
            f1, w1 = page.evaluate(fc), page.evaluate(word)
            if f1 != f0 or w1 != w0 or not page.locator("#view #card.is-back").count():
                probs.append(f"Tarjetas: al {'encender' if want else 'apagar'} la IPA cambia la tarjeta o el orden: {f0} {w0!r} → {f1} {w1!r}")
            n = page.evaluate(n_ipa)
            if n != (ipa0 if want else 0):
                probs.append(f"Tarjetas: al {'encender' if want else 'apagar'} la IPA, el reverso enseña {n} IPA (antes {ipa0})")
        if not ipa0:
            probs.append("Tarjetas: la tarjeta girada no tiene IPA (la prueba no vale)")
        probs += C.errors(page)
    finally:
        page.context.close()

    # la pantalla final de Oído de lince (fuera del modo foco, con el engranaje a la vista)
    page = C.new_page("phone")
    try:
        J._open(page, keys=_keys())
        J._start(page, "lince")
        J._play_lince(page)
        page.wait_for_timeout(1500)
        end = "() => ({end: !!document.getElementById('gm-end'), play: document.documentElement.dataset.gmPlay || '', focus: document.documentElement.dataset.focus || '', intro: !!document.querySelector('.gm-intro'), hash: location.hash})"
        e0 = page.evaluate(end)
        if not e0["end"] or e0["play"] or e0["focus"]:
            probs.append(f"Oído de lince: la preparación no vale: {e0}")
        for want in (False, True):
            _toggle(page)
            page.wait_for_timeout(600)
            e1 = page.evaluate(end)
            if e1 != e0:
                probs.append(f"Oído de lince: al {'encender' if want else 'apagar'} la IPA en la pantalla final: {e0} → {e1}")
            if page.evaluate("() => ipaOn()") is not want:
                probs.append(f"Oído de lince: el interruptor no {'enciende' if want else 'apaga'} la IPA")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_long_words_fit_without_scroll():
    """Con la IPA, las palabras largas tampoco hacen bajar la lección: en A1-022 (los números «one hundred and …»), en
    390×844 y 360×740 con el texto normal, cada palabra nueva y «¿Cuál es…?» tras un fallo caben sin scroll (la IPA de la
    respuesta va al lado de «¡Casi! Es «…»» si cabe; si no, el dibujo cede su línea); en B1-024 (francés, «le
    téléspectateur / la téléspectatrice»), en 390×844, cada palabra nueva cabe (si la palabra ocupa dos líneas, el
    dibujo cede la de la IPA) con el dibujo de 120 px o más."""
    probs = []
    for lang, lesson, sizes in (("english", "A1-022", ((390, 844), (360, 740))), ("français", "B1-024", ((390, 844),))):
        for w, h in sizes:
            tag = f"{lesson} {w}×{h}"
            page = C.new_page("phone", viewport={"width": w, "height": h})
            try:
                C.seed(page, keys=_keys(lang), hash="#/leccion/" + lesson)
                page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-learn')", timeout=8000)
                page.evaluate(L._HOOK)
                page.evaluate(L._FAKE_AUDIO)
                # las palabras nuevas salen de 3 en 3 entre preguntas: se juega entera (los «¿Cuál es…?», mal; lo demás, bien)
                for _ in range(160):
                    st = page.evaluate(L._ST)
                    if not st or st["ended"]:
                        break
                    if st["t"] == "learn":
                        page.wait_for_timeout(450)
                        f = page.evaluate(_FIT)
                        m = page.evaluate(f"""() => {{ const p = document.querySelector('{_CUR}'), i = p.querySelector('.ls-pic img');
                          return {{w: p.querySelector('.ls-word').textContent, pic: i ? Math.round(i.getBoundingClientRect().height) : null, ipa: !!p.querySelector('.ipa')}}; }}""")
                        if f["sh"] > f["ih"]:
                            probs.append(f"{tag}: la palabra nueva «{m['w']}» baja ({f})")
                        if not m["ipa"]:
                            probs.append(f"{tag}: «{m['w']}» sin IPA")
                        if m["pic"] is not None and m["pic"] < 120 - 1:
                            probs.append(f"{tag}: el dibujo de «{m['w']}» mide {m['pic']} px")
                        L._go(page)
                        continue
                    if st["t"] == "pick":
                        L._pick(page, L._wrong(page, st["right"]))
                        page.wait_for_timeout(900)
                        f = page.evaluate(_FIT)
                        y = page.evaluate("() => scrollY")
                        if f["sh"] > f["ih"] or y:
                            probs.append(f"{tag}: «¿Cuál es…?» de «{st['right']}» tras un fallo baja ({f}, scrollY {y})")
                        if not page.evaluate(f"() => !!document.querySelector('{_CUR} .ls-fb .ipa')"):
                            probs.append(f"{tag}: la respuesta de «{st['right']}» sin IPA")
                        page.locator("#ls-go").click()
                        page.wait_for_timeout(500)
                        continue
                    _right(page, st)
                probs += [f"{tag}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)


def test_small_phone_no_worse_than_without_ipa():
    """En un móvil muy bajo (320×568, texto normal) la lección y la ficha del álbum ya bajaban sin la IPA; con ella no
    bajan más: en A1-003 cada palabra nueva y «¿Cuál es…?» tras un fallo (el dibujo cede la línea de la IPA, nunca por
    debajo de 72 px) y, en la ficha del álbum, «Dar la vuelta» acaba donde sin la IPA (el dibujo cede su línea)."""
    probs = []
    W, H = 320, 568
    got = {}
    for ui in ({"ipa": False}, None):
        k = "on" if ui is None else "off"
        got[k] = {"learn": {}, "miss": [], "turn": None}
        page = C.new_page("phone", viewport={"width": W, "height": H})
        try:
            C.seed(page, keys=_keys("english", ui), hash="#/leccion/A1-003")
            page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-learn')", timeout=8000)
            page.evaluate(L._HOOK)
            page.evaluate(L._FAKE_AUDIO)
            for _ in range(160):
                st = page.evaluate(L._ST)
                if not st or st["ended"]:
                    break
                if st["t"] == "learn":
                    page.wait_for_timeout(450)
                    m = page.evaluate(f"""() => {{ const p = document.querySelector('{_CUR}'), i = p.querySelector('.ls-pic img');
                      return {{w: p.querySelector('.ls-word').textContent, pic: i ? Math.round(i.getBoundingClientRect().height) : null,
                        sh: document.documentElement.scrollHeight, ipa: !!p.querySelector('.ipa')}}; }}""")
                    got[k]["learn"][m["w"]] = m
                    L._go(page)
                    continue
                if st["t"] == "pick":
                    L._pick(page, L._wrong(page, st["right"]))
                    page.wait_for_timeout(900)
                    got[k]["miss"].append(page.evaluate("() => document.documentElement.scrollHeight"))
                    page.locator("#ls-go").click()
                    page.wait_for_timeout(500)
                    continue
                _right(page, st)
            C.seed(page, keys=_keys("english", ui), hash="#/album/colores")
            page.wait_for_selector(".al-st.got", timeout=8000)
            page.locator(".al-st.got").first.click()
            page.wait_for_selector("dialog.al-dlg[open]", timeout=3000)
            page.wait_for_timeout(800)
            got[k]["turn"] = page.evaluate("() => { const b = document.querySelector('dialog.al-dlg .al-turn'), i = document.querySelector('dialog.al-dlg .al-front .ipa'); return {bot: Math.round(b.getBoundingClientRect().bottom), ipa: !!i}; }")
            probs += [f"{k}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    on, off = got["on"], got["off"]
    if not on["learn"] or set(on["learn"]) != set(off["learn"]):
        probs.append(f"palabras nuevas distintas: {sorted(on['learn'])} / {sorted(off['learn'])}")
    for w, m in on["learn"].items():
        o = off["learn"].get(w)
        if not m["ipa"]:
            probs.append(f"«{w}» sin IPA")
        if o and m["sh"] > max(H, o["sh"]) + 1:
            probs.append(f"palabra nueva «{w}»: baja {m['sh'] - H} px con la IPA y {o['sh'] - H} sin ella")
        if m["pic"] is not None and m["pic"] < 72 - 1:
            probs.append(f"palabra nueva «{w}»: el dibujo mide {m['pic']} px")
    if not on["miss"] or max(on["miss"]) > max([H] + off["miss"]) + 1:
        probs.append(f"«¿Cuál es…?» tras un fallo: alto {on['miss']} con la IPA, {off['miss']} sin ella")
    if not on["turn"]["ipa"] or on["turn"]["bot"] > off["turn"]["bot"] + 1:
        probs.append(f"ficha del álbum: «Dar la vuelta» acaba en {on['turn']} con la IPA y en {off['turn']} sin ella")
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la partida y capturas
def test_export_unchanged():
    """Recorrer todos los sitios con la IPA (y apagarla y encenderla en Para mayores) no cambia la partida: la
    exportación es la de tests/e2e/baseline/export.json (vocab:ui es solo de este aparato)."""
    probs = []
    page = C.new_page("phone")
    try:
        C.seed(page)
        for h, sel in ((f"#/doc/{R.TOPIC}", "#card"), ("#/album/colores", ".al-st"), ("#/palabras", "#wl"), ("#/", "#hm")):
            C.goto(page, h)
            page.wait_for_selector(sel, timeout=8000)
        page.evaluate(_PASS)
        page.evaluate("() => openSettings('mayores')")
        page.wait_for_selector("#aj-ipa", state="attached", timeout=5000)
        page.wait_for_timeout(500)
        page.locator("label[for=aj-ipa]").click()
        page.locator("label[for=aj-ipa]").click()
        page.evaluate("() => vocabSettings.close()")
        page.wait_for_timeout(400)
        snap = C.export(page)
        base = C.load_baseline()
        if base:
            d = C.diff_exports(base, snap, allow_new=False)
            if d:
                probs.append("la exportación cambia: " + "; ".join(d[:6]))
        else:
            probs.append("no está tests/e2e/baseline/export.json")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_captures():
    """Capturas del móvil (390×844) en claro y oscuro en capturas/ipa: la hoja «Cómo suena» de «lion» (la de la captura
    del dueño), la palabra nueva, la respuesta tras un fallo, el reverso del repaso, el detalle de Palabras, la tarjeta
    girada (también una francesa de dos formas), Escribir › Leer, la ficha del álbum, Oído de lince al contestar, la
    Palabra del día girada y Para mayores con el interruptor.
    Sin errores."""
    probs = []
    for scheme in ("light", "dark"):
        page = C.new_page("phone", color_scheme=scheme)
        sh = lambda n: C.shot(page, f"ipa-{n}-{scheme}", OUT, full_page=False)   # noqa: E731
        try:
            C.seed(page, keys=_keys(), hash="#/leccion/" + LION)
            page.wait_for_selector(f"{_CUR} .ls-learn .ipa", timeout=8000)
            page.evaluate(L._HOOK)
            page.evaluate(L._FAKE_AUDIO)
            page.wait_for_timeout(600)
            sh("leccion-palabra-nueva")
            page.locator(f"{_CUR} [data-how]").click()
            page.wait_for_selector("dialog#ls-how[open] .ipa", timeout=3000)
            page.wait_for_timeout(900)
            page.evaluate("() => document.querySelectorAll('#ls-how .sy.on').forEach(x => x.classList.remove('on'))")
            sh("como-suena")
            page.locator("#ls-how [data-close]").click()
            page.wait_for_function("() => !document.querySelector('dialog#ls-how[open]')", timeout=3000)
            page.wait_for_timeout(300)
            for _ in range(40):
                st = page.evaluate(L._ST)
                if st["t"] == "learn":
                    L._go(page)
                    continue
                if st["t"] == "pick":
                    break
                L._pick(page, st["right"])
                L._wait_change(page, st["i"], 9000)
                page.wait_for_timeout(250)
            L._pick(page, L._wrong(page, st["right"]))
            page.wait_for_timeout(900)
            sh("leccion-fallo")
            C.seed(page, keys=_keys(cards=True), hash="#/repaso")
            page.wait_for_selector("#rv-card", timeout=10000)
            V._tap_card(page)
            page.wait_for_timeout(700)
            sh("repaso-reverso")
            C.seed(page, keys=_keys(), hash=f"#/doc/{R.TOPIC}")
            page.wait_for_selector("#card", timeout=8000)
            page.locator("#card").click()
            page.wait_for_timeout(700)
            sh("tarjeta")
            page.locator("#dv-tab-lista").click()
            page.wait_for_timeout(250)
            page.locator("#app .dl-r >> nth=1 >> .dl-open").click()
            page.wait_for_timeout(400)
            page.evaluate("() => { const d = document.querySelector('#app .dl-d:not([hidden])'); if (d) d.closest('.dl-r').scrollIntoView({block: 'center'}); }")
            page.wait_for_timeout(300)
            sh("palabras-detalle")
            # Escribir › Leer con «Se dice», la IPA en su línea y «Plural: …»
            i = page.evaluate(f"id => ({_ROW})(id).findIndex(r => r.l[lang].word === 'rabbit')", R.TOPIC)
            _escribir(page, R.TOPIC, "english", max(i, 0), "leer")
            page.evaluate("() => document.getElementById('pr-flow').scrollIntoView({block: 'center'})")
            page.wait_for_timeout(500)
            sh("escribir-leer")
            # Tarjetas en francés: «Se dice» de dos formas y la IPA debajo, sin partir
            C.seed(page, keys=_keys("français"), hash="#/doc/profesiones?m=tarjetas")
            _tarjeta(page, "profesiones", "l'infirmier / l'infirmière")
            page.evaluate("() => document.getElementById('card').scrollIntoView({block: 'center'})")
            page.wait_for_timeout(400)
            sh("tarjeta-frances")
            C.seed(page, keys=_keys(), hash="#/album/colores")
            page.wait_for_selector(".al-st.got", timeout=8000)
            page.locator(".al-st.got").first.click()
            page.wait_for_selector("dialog.al-dlg[open]", timeout=3000)
            page.wait_for_timeout(900)
            sh("album-ficha")
            page.keyboard.press("Escape")
            C.seed(page, keys=_keys(), hash="#/juegos")
            page.evaluate(J._HOOKS)
            J._start(page, "lince")
            J._lince_round(page, wrong=True)
            page.wait_for_timeout(900)
            sh("lince")
            C.seed(page, keys=_keys())
            page.locator("#bd-wotd .bd-wfront").click()
            page.wait_for_timeout(900)
            sh("hoy-palabra-del-dia")
            page.evaluate(_PASS)
            page.evaluate("() => openSettings('mayores')")
            page.wait_for_selector("#aj-ipa", state="attached", timeout=5000)
            page.wait_for_timeout(600)
            page.evaluate("() => { const r = document.querySelector('label[for=aj-ipa]'); r.scrollIntoView({block: 'center'}); }")
            page.wait_for_timeout(400)
            sh("para-mayores")
            probs += [f"{scheme}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)
