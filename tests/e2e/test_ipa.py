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
caben sin scroll en 390×844 y 360×740, también con «Texto más grande». La exportación sigue igual a la base y no hay
errores de consola. Capturas en capturas/ipa."""
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
# lo que se ve de cada .ipa dentro de sel: el texto (sin el «IPA:» oculto), si se ve, el idioma y el color
_SEE = """sel => [...document.querySelectorAll(sel)].map(e => { const cs = getComputedStyle(e), vh = e.querySelector('.vh');
  return {t: [...e.childNodes].filter(n => n !== vh).map(n => n.textContent).join('').trim(), vh: vh ? vh.textContent.trim() : '',
    vis: !!e.getClientRects().length && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0,
    lang: e.getAttribute('lang') || '', color: cs.color, ff: cs.fontFamily, fs: parseFloat(cs.fontSize)}; })"""
_ROW = "id => CACHE[id].rows.filter(r => r.es && r.l && r.l[lang])"


def _keys(lang="english", ui=None, text=""):
    """La partida sembrada en ese idioma (el repaso, el álbum y la Palabra del día con las palabras del inglés) y
    vocab:ui = ui (sin la clave ipa si ui es None) con las pistas de gestos ya vistas."""
    k = C.seed_keys()
    k["lang"] = json.dumps(lang)
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
    C.seed(page, keys=_keys(lang, on), hash="#/repaso")
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
    want = page.evaluate("() => { const el = document.getElementById('bd-wotd'); return CACHE[el.dataset.doc].rows.find(r => r.es === el.dataset.es && r.l && r.l[lang]).l[lang].ipa; }")
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
    """En la palabra nueva, «Cómo suena», el reverso del repaso y el detalle de Palabras, la IPA va en gris secundario
    (--label2, el mismo color que la traducción) y en tamaño subtítulo (17 px) donde no había hueco, y se dibuja con una
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
                page.locator(f"{_CUR} [data-how]").click()
                page.wait_for_selector("dialog#ls-how[open] .ipa", timeout=3000)
                page.wait_for_timeout(400)
                st = look("«Cómo suena»", "#ls-how .ipa", "#ls-how .ls-how-p")
                if st and abs(st["fs"] - 17) > .6:
                    probs.append(f"{tag} · «Cómo suena»: la IPA a {st['fs']} px (subtítulo, 17)")
                C.seed(page, keys=_keys(lang), hash="#/repaso")
                page.wait_for_selector("#rv-card", timeout=10000)
                V._tap_card(page)
                page.wait_for_timeout(450)
                st = look("reverso del repaso", "#rv-card .rv-a .ipa", "#rv-card .rv-a .rv-tr")
                if st and abs(st["fs"] - 17) > .6:
                    probs.append(f"{tag} · reverso del repaso: la IPA a {st['fs']} px (subtítulo, 17)")
                C.seed(page, keys=_keys(lang), hash=f"#/doc/{R.TOPIC}")
                page.wait_for_selector("#card", timeout=8000)
                page.locator("#dv-tab-lista").click()
                page.wait_for_timeout(250)
                page.locator("#app .dl-r >> nth=1 >> .dl-open").click()
                page.wait_for_timeout(300)
                look("detalle de Palabras", "#app .dl-d:not([hidden]) .ipa", "#app .dl-d:not([hidden]) .dl-k")
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
                C.seed(page, keys=_keys("english", None, text), hash="#/repaso")
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
    girada, la ficha del álbum, Oído de lince al contestar, la Palabra del día girada y Para mayores con el interruptor.
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
            C.seed(page, keys=_keys(), hash="#/repaso")
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
