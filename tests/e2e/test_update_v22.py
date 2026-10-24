"""La actualización desde la versión publicada ahora (main 9bf09a9, sw.js VERSION 22, cachés vocab-shell-v22 y
vocab-media) a esta (VERSION 23: el menú de mantener pulsado, las transiciones, el loro eco, los cuentos, las llamadas
y el cazador) en el mismo origen.

Dos niños con la v22 y la partida sembrada (C.seed):
- Lucía, con un mayor conectado a Google (GIS y Drive de mentira, sin red): el permiso caducó y hay cambios sin subir.
  En la v22 usa Hoy, un repaso de 3 tarjetas y la granja por enlaces (nada que renueve el permiso), y tiene un mensaje
  del Buzón grabado (IndexedDB "vocab-media-user"). Nunca tocó el interruptor de la IPA.
- Leo, sin Google; un mayor apagó en la v22 «Mostrar pronunciación (IPA)» (vocab:ui {ipa: false}).
Se publica esta versión y los dos vuelven: sin caché HTTP (abren la app otra vez) o con la de GitHub Pages
(Cache-Control: max-age=600; recargan antes de 10 minutos). Se comprueba que la primera carga ya es la app nueva entera
(cada módulo de js/ que se ejecuta es el de esta versión con «?v=23», también los nuevos: vocabMenu, vocabNavMotion,
vocabParrot, vocabCalls, vocabStories y vocabHunter), que el sw nuevo se instala y controla (vocab-shell-v23 con todo
SHELL, sin vocab-shell-v22, vocab-media sin perder nada), que la partida queda igual (cada clave de localStorage y la
exportación como en la v22, sin claves nuevas), que la granja tiene los mismos animales con el mismo hambre, que el
mensaje grabado sigue en IndexedDB (la misma versión de la base), que la IPA se ve de serie en «Cómo suena» y en el
reverso del repaso para Lucía y que para Leo sigue apagada (y el interruptor también) hasta que un mayor la enciende,
que las pantallas nuevas abren con esa partida (los cuentos, el loro y el cazador) y que, sin pedir
nada fuera de un toque, el siguiente toque seguro (una pestaña) pide el permiso dentro del toque y sube la partida de la
v22 tal cual. Sin errores de consola ni de página.

La versión publicada: la carpeta de VOCAB_BASE22 (una copia de 9bf09a9, p. ej. un git worktree) o, si no, una copia
sacada del repo con git archive a una carpeta temporal (test_f5_int._published_dir)."""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

import common as C
import test_f2_ajustes as A
import test_f3_leccion as L
import test_f3_repaso as V
import test_f4_int as I4
import test_f5_buzon as BZ
import test_f5_int as F5
import test_ipa as IPA
import test_update_v21 as U

OUT = C.CAPTURAS / "v23"
_BASE22_COMMIT = "9bf09a9"
_OLD_SHELL = "vocab-shell-v22"
NOW_MS = A.NOW_MS
MIN = A.MIN
_HINTS = U._HINTS

# la v22 de verdad: ipaOn() y vocabSync.tapDue() (la partida se guarda sola), OFF_SHELL v22 y nada de F6
_V22 = """() => ({ipa: typeof ipaOn === 'function', sync: !!(window.vocabSync && typeof vocabSync.tapDue === 'function'),
  off: typeof OFF_SHELL !== 'undefined' && OFF_SHELL === 'vocab-shell-v22',
  noF6: !window.vocabCalls && !window.vocabStories && !window.vocabParrot && !window.vocabHunter && !window.vocabMenu})"""
_F6 = """() => ({menu: !!window.vocabMenu, nav: !!window.vocabNavMotion, parrot: !!window.vocabParrot, calls: !!window.vocabCalls,
  stories: !!window.vocabStories, hunter: !!window.vocabHunter, media: !!window.vocabMedia})"""
_GIS_NEW = "() => JSON.parse(sessionStorage.getItem('__gis_all') || '[]').filter(c => c.app === 'v22' && c.ver === 23)"
# la granja: cada animal y planta (data-fid, su tipo) y si tiene hambre (lo dice su nombre accesible)
_FARM = """() => [...document.querySelectorAll('#app .fm-stage .fm-it')].map(e => [e.dataset.fid,
  (e.className.match(/\\bk-(\\w+)/) || [])[1] || '', /tiene hambre/.test(e.getAttribute('aria-label') || '')]).sort()"""
# un mensaje del Buzón grabado en la v22 (IndexedDB "vocab-media-user", como lo guarda js/mailbox.js)
_PUT = """async () => { const b = new Uint8Array(2048); for (let i = 0; i < b.length; i++) b[i] = i % 251;
  await vocabMedia.put({id: 'mail-v22-prueba', kind: 'mail', t: Date.now(), type: 'audio/webm', dur: 1500, buf: b.buffer, tpl: 'hola', lang: 'english'});
  return vocabMedia.VER; }"""
_GET = """async () => { const x = await vocabMedia.get('mail-v22-prueba'); if (!x) return null;
  const b = new Uint8Array(x.buf); let ok = b.length === 2048; for (let i = 0; ok && i < b.length; i++) ok = b[i] === i % 251;
  return {kind: x.kind, dur: x.dur, ok, ver: vocabMedia.VER, n: (await vocabMedia.list('mail')).length}; }"""
# a qué versión de la app va cada petición del permiso (sessionStorage "__gis_all" de test_update_v21._GISLOG apunta
# "v22" a todo lo que tiene ipaOn(); aquí se le añade la VERSION de OFF_SHELL)
_GISVER = r"""(() => {
  const o = window.google && google.accounts && google.accounts.oauth2;
  if (!o || o.__ver) return; o.__ver = 1;
  const init = o.initTokenClient.bind(o);
  o.initTokenClient = cfg => { const c = init(cfg), req = c.requestAccessToken.bind(c);
    return {requestAccessToken(x) { req(x);
      try { const l = JSON.parse(sessionStorage.getItem('__gis_all') || '[]'); if (l.length) {
        l[l.length - 1].ver = typeof OFF_SHELL !== 'undefined' ? +String(OFF_SHELL).replace(/\D/g, '') : 0;
        sessionStorage.setItem('__gis_all', JSON.stringify(l)); } } catch (e) {} }}; };
})();"""


def _is_base22(d):
    d = Path(d)
    return (d / "js" / "keys.js").exists() and not (d / "js" / "calls.js").exists() and "tapDue" in (d / "js" / "sync.js").read_text(encoding="utf-8")


def _base22_dir():
    return F5._published_dir(_BASE22_COMMIT, 22, "VOCAB_BASE22", _is_base22)


def _ctx(srv):
    ctx, page = U._ctx(srv)
    ctx.add_init_script(_GISVER)
    return ctx, page


def _start_v22(page, keys, tag, probs):
    """Abre la v22 con esa partida, espera a su service worker y recarga ya controlada."""
    C.seed(page, keys)
    page.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=20000)
    C.reload(page)
    v22 = page.evaluate(_V22)
    caches = page.evaluate("() => caches.keys()")
    if not all(v22.values()) or _OLD_SHELL not in caches:
        probs.append(f"{tag}: la versión publicada no es la v22 ({v22}, cachés {caches})")


def _how(page, probs, tag, on, code="en"):
    """La hoja «Cómo suena» de la palabra nueva en la lección de «lion»: su IPA se ve (on) o no."""
    C.goto(page, "#/leccion/" + IPA.LION)
    page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-learn')", timeout=8000)
    page.evaluate(L._HOOK)
    page.evaluate(L._FAKE_AUDIO)
    page.wait_for_timeout(350)
    want = page.evaluate("() => vocabLesson.state.steps[vocabLesson.state.i].w.r.l[lang].ipa")
    page.locator(f"{IPA._CUR} [data-how]").click()
    page.wait_for_selector("dialog#ls-how[open]", timeout=3000)
    page.wait_for_timeout(350)
    IPA._check(page, "«Cómo suena»", "#ls-how .ipa", [want], on, probs, tag, code)
    page.locator("#ls-how [data-close]").click()
    page.wait_for_function("() => !document.querySelector('dialog#ls-how[open]')", timeout=3000)


def _farm(page):
    C.goto(page, "#/granja")
    page.wait_for_selector("#app .fm-stage .fm-it", timeout=9000)
    page.wait_for_timeout(400)
    return page.evaluate(_FARM)


def _new_sw(page, v, shell, old_media, tag, probs):
    """El sw nuevo se instala (vocab-shell-v<v> con todo SHELL, sin vocab-shell-v22, vocab-media sin perder nada) y,
    tras recargar, controla la página con la app nueva."""
    t0, keys = time.time(), []
    while time.time() - t0 < 25:
        keys = page.evaluate("() => caches.keys()")
        if f"vocab-shell-v{v}" in keys and _OLD_SHELL not in keys:
            break
        page.wait_for_timeout(250)
    if f"vocab-shell-v{v}" not in keys or "vocab-media" not in keys or _OLD_SHELL in keys \
            or any(re.match(r"^vocab-shell-v\d+$", k) and k != f"vocab-shell-v{v}" for k in keys):
        probs.append(f"{tag}: el service worker nuevo no se instaló o no borró {_OLD_SHELL}: {keys}")
    media = set(page.evaluate(U._MEDIA))
    lost = [p for p in old_media if p not in media]
    if lost:
        probs.append(f"{tag}: se perdieron dibujos, audios o datos de vocab-media: {lost[:5]}")
    have = set(page.evaluate(f"async () => (await (await caches.open('vocab-shell-v{v}')).keys()).map(r => new URL(r.url).pathname)"))
    miss = [f for f in shell if ("/" if f == "./" else "/" + f) not in have]
    if miss:
        probs.append(f"{tag}: vocab-shell-v{v} no tiene {miss}")
    C.reload(page)
    again = page.evaluate(U._NEW22, v)
    again.pop("stale")
    f6 = page.evaluate(_F6)
    if not all(again.values()) or not all(f6.values()):
        probs.append(f"{tag}: tras recargar con el sw nuevo no está la app nueva entera: {again} {f6}")
    ctrl = page.evaluate(U._CTRL)
    if ctrl != {"ctrl": True, "active": True, "state": "activated", "waiting": False, "installing": False}:
        probs.append(f"{tag}: la página no la controla el service worker nuevo: {ctrl}")


def _new_screens(page, tag, probs):
    """Las pantallas nuevas con la partida de la v22: la estantería de cuentos y el primero, el loro (sin "parrot:st":
    se propone la cápsula del mes, que se cierra con «Ahora no») y el cazador antes de la cámara."""
    C.goto(page, "#/cuentos")
    try:
        page.wait_for_selector("#st-grid .st-cv", timeout=10000)
        C.goto(page, "#/cuento/en-play")
        page.wait_for_selector("#st-stage .st-page", timeout=10000)
    except Exception:  # noqa: BLE001
        probs.append(f"{tag}: los cuentos no abren con la partida de la v22")
    C.goto(page, "#/loro")
    try:
        page.wait_for_selector("#lr-rb, #lr-info", timeout=10000)
        page.wait_for_timeout(600)
        if page.evaluate("() => !!document.querySelector('dialog#lr-offer[open]')"):
            page.keyboard.press("Escape")
            page.wait_for_function("() => !document.querySelector('dialog#lr-offer[open]')", timeout=4000)
        if not page.evaluate("() => !!document.querySelector('#app .ipa')"):
            probs.append(f"{tag}: el loro no enseña la IPA de la palabra")
    except Exception:  # noqa: BLE001
        probs.append(f"{tag}: el loro no abre con la partida de la v22")
    C.goto(page, "#/cazador")
    try:
        page.wait_for_selector("#hn #hn-start", timeout=10000)
    except Exception:  # noqa: BLE001
        probs.append(f"{tag}: el cazador no abre con la partida de la v22")
    C.goto(page, "")


def _v22_then_new(gh_cache):
    probs = []
    base_dir = _base22_dir()
    assert base_dir, f"no se pudo sacar la versión publicada (commit {_BASE22_COMMIT}); VOCAB_BASE22=<copia de ese commit>"
    var = "gh" if gh_cache else "sin-cache"
    tag = "caché de GitHub Pages" if gh_cache else "sin caché HTTP"
    ta, tb = f"{tag} · Lucía", f"{tag} · Leo"
    v, shell = U._sw(C.ROOT)
    mods = [s.split("?")[0] for s in I4._tags((C.ROOT / "index.html").read_text(encoding="utf-8"))
            if not s.startswith(("http:", "https:", "//"))]
    srv, roots = F5._switching_server(base_dir, gh_cache)
    ctx_a, pa = _ctx(srv)
    ctx_b, pb = _ctx(srv)
    sa, sb = U._Scripts(pa), U._Scripts(pb)
    stopped = False
    try:
        # ---- Lucía en la v22: Google conectado, el permiso caducó hace 30 min y hay cambios sin subir
        _start_v22(pa, A._sync_keys(NOW_MS - 30 * MIN, reconnect=True, base=U._keys()), ta, probs)
        C.goto(pa, "#/repaso")
        pa.wait_for_selector("#rv-card", timeout=10000)
        for _ in range(3):
            st0 = pa.evaluate(V._ST)
            V._tap_card(pa)
            pa.locator(".rv-yes").click()
            V._wait_next(pa, st0["i"])
            pa.wait_for_selector("#rv-card:not(.is-flipped)", timeout=3000)
        farm_a = _farm(pa)
        C.goto(pa, "")
        pa.wait_for_timeout(600)
        ver = pa.evaluate(_PUT)
        C.shot(pa, f"v22-hoy-{var}", OUT)
        gis = pa.evaluate(U._GIS_ALL)
        if any(c["tap"] for c in gis):
            probs.append(f"{ta}: en la v22 se renovó el permiso en un toque (la prueba no vale): {gis}")
        if pa.evaluate("vocabSync.state.phase") != "reconnect":
            probs.append(f"{ta}: en la v22 el estado de Google es {pa.evaluate('vocabSync.state')} (la prueba no vale)")
        old_a, snap_a = C.storage(pa), C.export(pa)
        media_a = pa.evaluate(U._MEDIA)
        probs += [f"{ta} · v22: {e}" for e in U._errors(pa)]

        # ---- Leo en la v22: sin Google; un mayor apaga la IPA
        _start_v22(pb, U._keys(), tb, probs)
        pb.evaluate("() => { openSettings('mayores'); }")
        BZ._pass_gate(pb)
        pb.wait_for_selector("#aj-ipa", state="attached", timeout=5000)
        pb.wait_for_timeout(500)
        if (IPA._switch(pb) or {}).get("on") is not True:
            probs.append(f"{tb}: en la v22 el interruptor de la IPA no salía encendido: {IPA._switch(pb)}")
        pb.locator("label[for=aj-ipa]").click()
        pb.wait_for_timeout(200)
        pb.evaluate("() => vocabSettings.close()")
        pb.wait_for_function("() => !document.querySelector('dialog#ajustes[open]')", timeout=4000)
        farm_b = _farm(pb)
        C.goto(pb, "")
        old_b, snap_b = C.storage(pb), C.export(pb)
        media_b = pb.evaluate(U._MEDIA)
        ui_b = json.loads(old_b.get("vocab:ui") or "{}")
        if ui_b != {"hints": _HINTS, "ipa": False}:
            probs.append(f"{tb}: en la v22 apagar la IPA guardó {old_b.get('vocab:ui')}")
        probs += [f"{tb} · v22: {e}" for e in U._errors(pb)]

        # ---- se publica esta versión y vuelven
        U._quiet((pa, pb))
        roots["cur"] = C.ROOT
        U._come_back(pa, sa, gh_cache, v, mods, ta, probs)
        U._come_back(pb, sb, gh_cache, v, mods, tb, probs)
        for page, t in ((pa, ta), (pb, tb)):
            f6 = page.evaluate(_F6)
            if not all(f6.values()):
                probs.append(f"{t}: en la primera carga faltan módulos nuevos: {f6}")
        if pa.evaluate(_GIS_NEW):
            probs.append(f"{ta}: al abrir la versión nueva se pide el permiso sin un toque: {pa.evaluate(_GIS_NEW)}")
        C.shot(pa, f"v23-hoy-tras-actualizar-{var}", OUT)
        for page, t, old_media in ((pa, ta, media_a), (pb, tb, media_b)):
            _new_sw(page, v, shell, old_media, t, probs)
        # la partida igual: cada clave y la exportación (sin claves nuevas)
        for page, t, old, snap in ((pa, ta, old_a, snap_a), (pb, tb, old_b, snap_b)):
            U._same_keys(old, C.storage(page), t, probs)
            d = C.diff_exports(snap, C.export(page), allow_new=False)
            if d:
                probs.append(f"{t}: la exportación tras actualizar no es la de la v22: {d}")
        # la granja: los mismos animales y plantas, con el mismo hambre (la de Lucía, después de subir su partida:
        # entrar en la granja apunta la visita en farm:state)
        after = _farm(pb)
        if after != farm_b or not farm_b:
            probs.append(f"{tb}: la granja cambia al actualizar: {farm_b} → {after}")
        C.goto(pb, "")
        # el mensaje grabado en la v22 sigue en IndexedDB, con la misma versión de la base
        got = pa.evaluate(_GET)
        if not got or not got["ok"] or got["kind"] != "mail" or got["ver"] != ver:
            probs.append(f"{ta}: el mensaje grabado en la v22 no sigue igual en IndexedDB: {got} (versión de antes {ver})")

        # ---- Leo: la IPA que apagó un mayor en la v22 sigue apagada (y el interruptor); al encenderla, se ve
        _how(pb, probs, tb, False)
        C.goto(pb, "")
        pb.evaluate(IPA._PASS)
        pb.evaluate("() => openSettings('mayores')")
        pb.wait_for_selector("#aj-ipa", state="attached", timeout=5000)
        pb.wait_for_timeout(500)
        sw = IPA._switch(pb)
        if not sw or sw["on"] or sw["role"] != "switch":
            probs.append(f"{tb}: con el {{ipa: false}} de la v22, el interruptor no sale apagado: {sw}")
        if json.loads(pb.evaluate("() => localStorage.getItem('vocab:ui')")) != ui_b:
            probs.append(f"{tb}: tras actualizar cambia vocab:ui: {pb.evaluate('() => localStorage.getItem(`vocab:ui`)')}")
        pb.locator("label[for=aj-ipa]").click()
        pb.wait_for_timeout(200)
        pb.evaluate("() => vocabSettings.close()")
        pb.wait_for_function("() => !document.querySelector('dialog#ajustes[open]')", timeout=4000)
        _how(pb, probs, tb, True)
        U._back_of_card(pb, probs, tb)
        C.goto(pb, "")
        _new_screens(pb, tb, probs)
        probs += [f"{tb}: {e}" for e in C.errors(pb)]
        if pb._outside:
            probs.append(f"{tb}: se pidió algo fuera del servidor: {pb._outside[:5]}")
        ctx_b.close()

        # ---- Lucía: sin pedir nada fuera de un toque; el siguiente toque seguro (una pestaña) sube la partida
        try:
            pa.wait_for_function("() => vocabSync.state.phase === 'reconnect'", timeout=5000)
        except Exception:  # noqa: BLE001
            probs.append(f"{ta}: tras actualizar, el estado de Google es {pa.evaluate('vocabSync.state')} (se esperaba reconnect)")
        cfg, box, sw = U._adults(pa)
        if not re.fullmatch(r"Google: última copia hace \d+ h", cfg or ""):
            probs.append(f"{ta}: la fila Para mayores dice {cfg!r} (se esperaba «Google: última copia hace 2 h»)")
        if "Hay cambios sin subir a Google" not in box["t"] or not box["now"] or box["re"]:
            probs.append(f"{ta}: Para mayores no dice que hay cambios sin subir: {box}")
        if not sw or not sw["on"]:
            probs.append(f"{ta}: el interruptor de la IPA no sale encendido de serie: {sw}")
        if pa.evaluate(_GIS_NEW) or pa.evaluate("window.__gis.length"):
            probs.append(f"{ta}: la versión nueva pidió el permiso sin un toque: {pa.evaluate(_GIS_NEW)}")
        if any("/upload/" in x["url"] for x in pa.evaluate(U._DRIVE_LOG)):
            probs.append(f"{ta}: se subió algo sin permiso: {pa.evaluate(U._DRIVE_LOG)}")
        tab = pa.locator(".tabbar [data-nav=hoy]")
        href = tab.get_attribute("href")
        tab.click()
        try:
            pa.wait_for_function("() => window.__gis.length > 0", timeout=3000)
            calls = pa.evaluate("window.__gis")
            if len(calls) != 1 or not (calls[0]["tap"] and calls[0]["act"]) or calls[0]["prompt"] != "":
                probs.append(f"{ta}: el toque en la pestaña no pidió el permiso una vez dentro del toque: {calls}")
            pa.wait_for_function("() => vocabSync.state.phase === 'ok' && vocabSync.state.tokOk", timeout=8000)
        except Exception:  # noqa: BLE001
            probs.append(f"{ta}: el toque en la pestaña Hoy ({href}) no renueva el permiso ni sube: {pa.evaluate('window.__gis')}, "
                         f"{pa.evaluate('vocabSync.state')}")
        ups = [x for x in pa.evaluate(U._DRIVE_LOG) if x["method"] == "PATCH" and "/upload/drive/v3/files/f1" in x["url"]]
        if len(ups) != 1:
            probs.append(f"{ta}: subidas a Drive tras el toque: {[(x['method'], x['url']) for x in pa.evaluate(U._DRIVE_LOG)]}")
        else:
            md, data = U._multipart(ups[0]["body"])
            d = C.diff_exports(snap_a, data, allow_new=False)
            if data.get("app") != "vocabulary" or d:
                probs.append(f"{ta}: lo que se sube a Google no es la partida de la v22: {d}")
            if md.get("appProperties", {}).get("hash") != pa.evaluate("vocabSync.hash()"):
                probs.append(f"{ta}: la huella de la subida no es la de la partida: {md}")
        if len(pa.evaluate(_GIS_NEW)) != 1:
            probs.append(f"{ta}: llamadas al permiso en la versión nueva: {pa.evaluate(_GIS_NEW)}")
        m = pa.evaluate("vocabSync.state.meta")
        if m["reconnect"] or m["localDirty"]:
            probs.append(f"{ta}: tras subir, el permiso o la copia no quedaron al día: {m}")
        after = _farm(pa)
        if after != farm_a or not farm_a:
            probs.append(f"{ta}: la granja cambia al actualizar: {farm_a} → {after}")
        C.goto(pa, "")
        # la IPA de serie (nunca tocó el interruptor) y las pantallas nuevas
        _how(pa, probs, ta, True)
        U._back_of_card(pa, probs, ta)
        C.shot(pa, f"v23-repaso-ipa-{var}", OUT)
        C.goto(pa, "")
        if "ipa" in json.loads(pa.evaluate("() => localStorage.getItem('vocab:ui')") or "{}"):
            probs.append(f"{ta}: tras actualizar vocab:ui tiene la clave ipa sin que nadie tocara el interruptor")
        _new_screens(pa, ta, probs)
        probs += [f"{ta}: {e}" for e in C.errors(pa)]
        if pa._outside:
            probs.append(f"{ta}: se pidió algo fuera del servidor: {pa._outside[:5]}")

        # ---- sin conexión: el servidor parado, sale la app nueva desde vocab-shell-v23
        srv.stop()
        stopped = True
        ctx_a.set_offline(True)
        C.clear_errors(pa)
        sa.reset()
        C.reload(pa)
        off = pa.evaluate(U._NEW22, v)
        off.pop("stale")
        if not all(off.values()) or not all(pa.evaluate(_F6).values()):
            probs.append(f"{ta}: sin conexión no sale la app nueva entera: {off} {pa.evaluate(_F6)}")
        missing, other = sa.check(C.base_url(pa), C.ROOT, mods)
        if missing or other:
            probs.append(f"{ta}: sin conexión no se ejecutan {missing} y son de otra versión {other}")
        probs += [f"{ta} · sin conexión: {e}" for e in C.errors(pa)]
    finally:
        try:
            ctx_a.set_offline(False)
        except Exception:  # noqa: BLE001
            pass
        for c in (ctx_a, ctx_b):
            try:
                c.close()
            except Exception:  # noqa: BLE001
                pass
        if not stopped:
            srv.stop()
    return probs


def test_update_from_published_v22():
    """Dos niños con la versión publicada (main 9bf09a9, sw vocab-shell-v22) y la partida sembrada: Lucía, con Google
    conectado, el permiso caducado y cambios sin subir, usa Hoy, un repaso y la granja, y tiene un mensaje del Buzón
    grabado; Leo, sin Google, tiene la IPA apagada por un mayor. Se publica esta versión y vuelven
    abriendo la app: la primera carga ya es la app nueva entera (cada módulo, también los de F6, es el de esta versión
    con «?v=23»), el sw nuevo se instala y controla (vocab-shell-v23 con todo SHELL, sin vocab-shell-v22, vocab-media
    entera), la partida queda igual (cada clave y la exportación, sin claves nuevas), la granja igual, el mensaje grabado
    sigue en IndexedDB, la IPA se ve de serie para Lucía y sigue apagada para Leo hasta que se enciende, los cuentos, el loro y el
    cazador abren, nada pide el permiso fuera de un toque y el siguiente toque en una pestaña lo pide dentro del toque y
    sube la partida de la v22 tal cual; sin conexión sale la app nueva. Sin errores."""
    probs = _v22_then_new(gh_cache=False)
    assert not probs, "\n".join(probs)


def test_update_from_v22_with_github_pages_http_cache():
    """Lo mismo con las cabeceras de GitHub Pages (Cache-Control: max-age=600) y la caché HTTP del navegador: los dos
    tenían la app abierta al publicar y recargan antes de 10 minutos. Ningún módulo viejo sale de la caché HTTP: la
    primera carga ya ejecuta cada módulo de esta versión (con «?v=23»), también js/calls.js, js/stories.js y los demás
    nuevos, y todo lo demás sigue igual. Sin errores."""
    probs = _v22_then_new(gh_cache=True)
    assert not probs, "\n".join(probs)
