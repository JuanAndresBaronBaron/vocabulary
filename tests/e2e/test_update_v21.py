"""La actualización desde la versión publicada ahora (main 1f0b356, sw.js VERSION 21, cachés vocab-shell-v21 y
vocab-media) a esta (VERSION 22: la IPA a la vista de serie y la partida que se guarda sin botón) en el mismo origen.

Dos niños con la v21 y la partida sembrada (C.seed):
- Lucía, con un mayor conectado a Google (GIS y Drive de mentira, sin red): el permiso caducó y hay cambios sin subir,
  así que en la v21 se ve la pastilla «Guardar» junto a las monedas. Usa la v21: Hoy, un repaso de 3 tarjetas, la
  granja y Hoy otra vez (sin tocar nada que en la v21 renueve el permiso: la pastilla sigue ahí). Nunca tocó el
  interruptor de la IPA.
- Leo, sin Google y con 5 días de uso, así que en la v21 Hoy enseña la fila «Guarda tu partida»; un mayor encendió en
  la v21 «Mostrar pronunciación (IPA)» (vocab:ui {ipa: true}).
Se publica esta versión y los dos vuelven: sin caché HTTP (abren la app otra vez) o con la de GitHub Pages
(Cache-Control: max-age=600; recargan antes de 10 minutos). Se comprueba que el sw nuevo se instala y controla la
página (vocab-shell-v22 con todo SHELL, sin vocab-shell-v21, vocab-media sin perder nada); que la primera carga ya es
la app nueva entera (cada módulo de js/ que se ejecuta es el de esta versión, cada <script> lleva «?v=22», ipaOn()
existe, vocabSync es el nuevo, y no hay [data-sync-slot], ni pastilla, ni fila «Guarda tu partida»); que la partida
queda igual (cada clave de localStorage y la exportación como en la v21, sin claves nuevas); que la IPA se ve en la
hoja «Cómo suena» y en el reverso del repaso para Lucía (sin tocar el interruptor) y para Leo (ipa:true de la v21, con
el interruptor encendido); que Para mayores dice la verdad de Google (cambios sin subir) y que, sin pedir nada fuera de
un toque, el siguiente toque seguro (una pestaña) pide el permiso dentro del toque y sube la partida de la v21 tal
cual; y que sin conexión sale la app nueva. Sin errores de consola ni de página.

La versión publicada: la carpeta de VOCAB_BASE21 (una copia de 1f0b356, p. ej. un git worktree) o, si no, una copia
sacada del repo con git archive a una carpeta temporal (test_f5_int._published_dir)."""
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from urllib.parse import urlsplit

import common as C
import test_f2_ajustes as A
import test_f3_leccion as L
import test_f3_repaso as V
import test_f4_int as I4
import test_f5_buzon as BZ
import test_f5_int as F5
import test_ipa as IPA

OUT = C.CAPTURAS / "v22"
_BASE21_COMMIT = "1f0b356"
_OLD_SHELL = "vocab-shell-v21"
NOW_MS = A.NOW_MS
MIN = A.MIN
DAY = 864e5
# las pistas de gestos ya vistas (no tapan nada) y sin la clave ipa
_HINTS = dict(IPA._HINTS, **F5._HINTS["hints"])

# cada llamada a requestAccessToken (la apunta el GIS de mentira de test_f2_ajustes en window.__gis), también la de
# otros documentos de la pestaña (sessionStorage "__gis_all"), con la versión de la app que la hizo
_GISLOG = r"""(() => {
  const o = window.google && google.accounts && google.accounts.oauth2;
  if (!o || o.__log) return; o.__log = 1;
  const init = o.initTokenClient.bind(o);
  o.initTokenClient = cfg => { const c = init(cfg), req = c.requestAccessToken.bind(c);
    return {requestAccessToken(x) { const n = window.__gis.length; req(x);
      try { const l = JSON.parse(sessionStorage.getItem('__gis_all') || '[]');
        l.push(Object.assign({app: typeof ipaOn === 'function' ? 'v22' : 'v21'}, window.__gis[n] || {}));
        sessionStorage.setItem('__gis_all', JSON.stringify(l)); } catch (e) {} }}; };
})();"""
# Google Drive de mentira sin tocar la red (como _drive() de test_f2_ajustes, pero cambiando fetch: el enrutado de
# Playwright desactiva la caché HTTP y aquí hace falta la de GitHub Pages). Lo que se pide va a sessionStorage "__drive"
_DRIVE = r"""(() => {
  if (window.__driveFake) return; window.__driveFake = 1;
  const real = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = String((input && input.url) || input || '');
    if (!/^https:\/\/([a-z0-9-]+\.)?googleapis\.com\//.test(url)) return real(input, init);
    const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    try { const l = JSON.parse(sessionStorage.getItem('__drive') || '[]');
      l.push({method, url: url.split('?')[0], body: init && typeof init.body === 'string' ? init.body : ''});
      sessionStorage.setItem('__drive', JSON.stringify(l)); } catch (e) {}
    const body = url.includes('/upload/') ? {id: 'f1', modifiedTime: '2026-03-11T09:00:05.000Z', appProperties: {hash: 'y'}}
      : {id: 'f1', modifiedTime: '2026-03-11T08:00:00.000Z', appProperties: {hash: 'x'}};
    return Promise.resolve(new Response(JSON.stringify(body), {status: 200, headers: {'content-type': 'application/json'}}));
  };
})();"""
_GIS_ALL = "() => JSON.parse(sessionStorage.getItem('__gis_all') || '[]')"
_GIS_V22 = "() => JSON.parse(sessionStorage.getItem('__gis_all') || '[]').filter(c => c.app === 'v22')"
_DRIVE_LOG = "() => JSON.parse(sessionStorage.getItem('__drive') || '[]')"
# la v21 de verdad: sin ipaOn(), con la pastilla «Guardar» de sync.js y su hueco en la barra de arriba
_V21 = """() => ({old: typeof ipaOn === 'undefined', api: !!(window.vocabSync && 'chipWanted' in vocabSync),
  slot: !!document.querySelector('[data-sync-slot]')})"""
_CHIP = """() => { const c = document.querySelector('[data-sync-slot] #sv-chip'); return !!c && !!c.getClientRects().length && /Guardar/.test(c.textContent); }"""
# la app nueva entera: ipaOn() e ipaHtml() (index.html), OFF_SHELL, vocabSync nuevo (tapDue, sin chipWanted ni due), sin
# el hueco de la pastilla ni la pastilla ni la fila «Guarda tu partida» (ni su HOME_SLOT), y cada <script> del propio
# servidor (los del documento y los que se pidieron) con «?v=<VERSION>»
_NEW22 = r"""v => {
  const vis = e => !!e && !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
  const tag = '?v=' + v, mine = u => u.startsWith(location.origin + '/');
  const urls = [...document.scripts].map(s => s.src).filter(u => u && mine(u))
    .concat(performance.getEntriesByType('resource').filter(e => e.initiatorType === 'script' && mine(e.name)).map(e => e.name));
  const rows = [...document.querySelectorAll('#hm-slots .hm-slot, #app .hm-row, #app a, #app button')]
    .filter(e => vis(e) && /Guarda tu partida|Vuelve a conectar Google/.test(e.textContent)).length;
  return {
    ipa: typeof ipaOn === 'function' && typeof ipaHtml === 'function',
    off: typeof OFF_SHELL !== 'undefined' && OFF_SHELL === 'vocab-shell-v' + v,
    sync: !!(window.vocabSync && typeof vocabSync.tapDue === 'function' && !('chipWanted' in vocabSync) && !('due' in vocabSync)),
    noSlot: !document.querySelector('[data-sync-slot]'),
    noChip: !document.querySelector('#sv-chip, .sv-chip'),
    noRow: !document.getElementById('sv-rem') && !document.getElementById('sv-kid') && !rows && !HOME_SLOTS.some(f => f && f.id === 'sync'),
    scripts: urls.length > 0 && urls.every(u => u.endsWith(tag)),
    stale: [...new Set(urls.filter(u => !u.endsWith(tag)).map(u => u.slice(location.origin.length + 1)))],
  };
}"""
_MEDIA = "async () => (await (await caches.open('vocab-media')).keys()).map(r => new URL(r.url).pathname)"
_CTRL = """async () => { const r = await navigator.serviceWorker.getRegistration(), c = navigator.serviceWorker.controller;
  return {ctrl: !!c, active: !!(r && r.active) && r.active === c, state: c ? c.state : null, waiting: !!(r && r.waiting),
    installing: !!(r && r.installing)}; }"""


def _is_base21(d):
    return "data-sync-slot" in (Path(d) / "index.html").read_text(encoding="utf-8") and (Path(d) / "js" / "keys.js").exists()


def _base21_dir():
    return F5._published_dir(_BASE21_COMMIT, 21, "VOCAB_BASE21", _is_base21)


def _sw(root):
    """(VERSION, SHELL) del sw.js de esa carpeta."""
    sw = (Path(root) / "sw.js").read_text(encoding="utf-8")
    shell = re.findall(r'"([^"]+)"', re.search(r"const SHELL = \[(.*?)\];", sw, re.S).group(1))
    return int(re.search(r"const VERSION = (\d+);", sw).group(1)), shell


class _Scripts:
    """Lo que de verdad ejecuta la página: cada script que se analiza (Debugger.scriptParsed de CDP), para leer su
    texto y compararlo con el fichero de la versión nueva."""

    def __init__(self, page):
        self.cdp = page.context.new_cdp_session(page)
        self.seen = []
        self.cdp.on("Debugger.scriptParsed", lambda e: self.seen.append((e["scriptId"], e.get("url") or "")))
        self.cdp.send("Debugger.enable")

    def reset(self):
        self.seen.clear()

    def check(self, base, root, want):
        """(los módulos de want que no se ejecutaron desde reset(), los que se ejecutaron con otro texto que el de
        root). De cada módulo cuenta el último que se analizó (el del documento de ahora)."""
        last = {}
        for sid, url in list(self.seen):
            path = urlsplit(url).path.lstrip("/") if url.startswith(base + "/") else ""
            if path in want:
                last[path] = sid
        other = []
        for path, sid in sorted(last.items()):
            try:
                src = self.cdp.send("Debugger.getScriptSource", {"scriptId": sid})["scriptSource"]
            except Exception:  # noqa: BLE001
                src = None
            if src != (Path(root) / path).read_text(encoding="utf-8"):
                other.append(path)
        return sorted(set(want) - set(last)), other


def _keys(**top):
    """La partida sembrada con las pistas de gestos ya vistas (vocab:ui sin la clave ipa) y las claves de top."""
    k = C.seed_keys()
    k["vocab:ui"] = json.dumps({"hints": _HINTS})
    for n, v in top.items():
        k[n.replace("__", ":")] = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    return k


def _ctx(srv):
    """Móvil con service worker y GIS y Drive de mentira. Sin el enrutado de Playwright (block_external), que apaga la
    caché HTTP (y hace falta la de GitHub Pages). No hace falta red: lo que se pida fuera del servidor se apunta en
    page._outside (y es un problema). page._loaded: cuándo acabó de cargar el último documento (para _quiet)."""
    ctx = C.new_context("phone", sw=True, server=srv, block_external=False, reduced_motion="reduce")
    for s in (A._GIS, _GISLOG, _DRIVE):
        ctx.add_init_script(s)
    page = ctx.new_page()
    C._attach(page, srv.url)
    page._loaded = time.time()
    page.on("load", lambda _: setattr(page, "_loaded", time.time()))
    page._outside = []
    page.on("request", lambda r: None if r.url.startswith((srv.url + "/", "data:", "blob:")) else page._outside.append(r.url))
    return ctx, page


def _quiet(pages, secs=3.0):
    """Espera a que pasen secs segundos desde la última carga de cada página. Chromium mira si hay un sw nuevo un
    segundo o dos después de cada carga; si esa mirada cae ya publicada la versión nueva y a la vez que la carga
    siguiente, el sw nuevo se instala mientras el viejo atiende esa carga y se queda esperando («installed») para
    siempre con Playwright, y la recarga siguiente no acaba. El sw viejo no tiene entonces ningún fetch pendiente
    (probado con un sw.js de la v21 que los apunta), así que es del navegador de las pruebas y no de sw.js."""
    wait = max(secs - (time.time() - p._loaded) for p in pages)
    if wait > 0:
        pages[0].wait_for_timeout(int(wait * 1000))


def _start_v21(page, keys, tag, probs):
    """Abre la v21 con esa partida, espera a su service worker y recarga ya controlada."""
    C.seed(page, keys)
    page.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=20000)
    C.reload(page)
    v21 = page.evaluate(_V21)
    caches = page.evaluate("() => caches.keys()")
    if not all(v21.values()) or _OLD_SHELL not in caches:
        probs.append(f"{tag}: la versión publicada no es la v21 ({v21}, cachés {caches})")


def _how(page, probs, tag, code="en"):
    """La hoja «Cómo suena» de la palabra nueva en la lección de «lion»: su IPA (la de data/*.json) se ve."""
    C.goto(page, "#/leccion/" + IPA.LION)
    page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-learn')", timeout=8000)
    page.evaluate(L._HOOK)
    page.evaluate(L._FAKE_AUDIO)
    page.wait_for_timeout(350)
    want = page.evaluate("() => vocabLesson.state.steps[vocabLesson.state.i].w.r.l[lang].ipa")
    page.locator(f"{IPA._CUR} [data-how]").click()
    page.wait_for_selector("dialog#ls-how[open]", timeout=3000)
    page.wait_for_timeout(350)
    IPA._check(page, "«Cómo suena»", "#ls-how .ipa", [want], True, probs, tag, code)
    page.locator("#ls-how [data-close]").click()
    page.wait_for_function("() => !document.querySelector('dialog#ls-how[open]')", timeout=3000)


def _back_of_card(page, probs, tag, code="en"):
    """El repaso: en la cara de la pregunta no hay IPA (diría la respuesta); al girar la tarjeta, se ve."""
    C.goto(page, "#/repaso")
    page.wait_for_selector("#rv-card", timeout=10000)
    if page.evaluate(IPA._SEE, "#rv-card .rv-q .ipa"):
        probs.append(f"{tag} · repaso: la cara de la pregunta enseña la IPA")
    V._tap_card(page)
    page.wait_for_timeout(400)
    want = page.evaluate("() => rv.q[rv.i].r.l[lang].ipa")
    IPA._check(page, "reverso del repaso", "#rv-card .rv-a .ipa", [want], True, probs, tag, code)


def _adults(page):
    """Ajustes (abierta sin tocar nada): la fila «Para mayores»; y Para mayores (la Puerta ya pasada): el bloque de
    Google y el interruptor de la IPA. Cierra Ajustes con Escape (tampoco es un toque)."""
    page.evaluate("openSettings()")
    page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
    C.settle(page, 250)
    cfg = page.evaluate("document.querySelector('#aj-may [data-sync-cfg]').textContent")
    page.evaluate(A._PASS)
    page.evaluate("openSettings('google')")
    A._wait_page(page, "mayores")
    box = page.evaluate("""() => { const d = document.getElementById('sv-dyn'), f = document.querySelector('#sv-box .st-foot');
      return {t: d ? d.textContent.replace(/\\s+/g, ' ').trim() : '', now: !!document.getElementById('sv-now'),
        re: !!document.getElementById('sv-re'), foot: f ? f.textContent : ''}; }""")
    sw = IPA._switch(page)
    for _ in range(3):
        if not page.evaluate("document.getElementById('ajustes').open"):
            break
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
    page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=3000)
    page.wait_for_timeout(300)
    return cfg, box, sw


def _errors(page):
    """Los errores de la página, sin el /favicon.ico que Chromium pide a veces para /__blank de common.py (no tiene
    icono): solo se abre al sembrar la partida."""
    return [e for e in C.errors(page) if not re.search(r"404 .*@ \S+/favicon\.ico$", e)]


def _same_keys(old, new, tag, probs):
    """Cada clave de localStorage como en la v21, texto a texto (también las de este aparato: vocab:ui, save:sync…)."""
    for k in sorted(set(old) | set(new)):
        if old.get(k) == new.get(k):
            continue
        if k not in old:
            probs.append(f"{tag}: clave nueva {k} = {F5._short(new[k])}")
        elif k not in new:
            probs.append(f"{tag}: falta la clave {k}")
        else:
            probs.append(f"{tag}: cambia {k}: {F5._short(old[k])} → {F5._short(new[k])}")


def _multipart(body):
    """(metadatos, partida) de una subida multipart de js/sync.js."""
    parts = body.split("\r\n\r\n")
    return json.loads(parts[1].split("\r\n--")[0]), json.loads(parts[2].split("\r\n--")[0])


def _come_back(page, scripts, gh_cache, v, mods, tag, probs):
    """El niño vuelve tras publicar: la primera carga ya es la app nueva entera."""
    scripts.reset()
    C.clear_errors(page)
    if gh_cache:
        page.reload(wait_until="domcontentloaded")
    else:
        page.goto(C.base_url(page) + "/", wait_until="domcontentloaded")
    page.wait_for_function("() => (window.__vocabRouteN || 0) > 0", timeout=20000)
    page.wait_for_timeout(800)
    first = page.evaluate(_NEW22, v)
    stale = first.pop("stale")
    if not all(first.values()):
        probs.append(f"{tag}: la primera carga tras publicar no es la app nueva entera: {first} (sin ?v={v}: {stale})")
    missing, other = scripts.check(C.base_url(page), C.ROOT, mods)
    if missing or other:
        probs.append(f"{tag}: en la primera carga no se ejecutan {missing} y son de otra versión {other}")


def _new_sw(page, v, shell, old_media, tag, probs):
    """El sw nuevo se instala (vocab-shell-v<v> con todo SHELL, sin vocab-shell-v21, vocab-media sin perder nada) y,
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
    media = set(page.evaluate(_MEDIA))
    lost = [p for p in old_media if p not in media]
    if lost:
        probs.append(f"{tag}: se perdieron dibujos, audios o datos de vocab-media: {lost[:5]}")
    have = set(page.evaluate(f"async () => (await (await caches.open('vocab-shell-v{v}')).keys()).map(r => new URL(r.url).pathname)"))
    miss = [f for f in shell if ("/" if f == "./" else "/" + f) not in have]
    if miss:
        probs.append(f"{tag}: vocab-shell-v{v} no tiene {miss}")
    C.reload(page)
    again = page.evaluate(_NEW22, v)
    again.pop("stale")
    if not all(again.values()):
        probs.append(f"{tag}: tras recargar con el sw nuevo no está la app nueva entera: {again}")
    ctrl = page.evaluate(_CTRL)
    if ctrl != {"ctrl": True, "active": True, "state": "activated", "waiting": False, "installing": False}:
        probs.append(f"{tag}: la página no la controla el service worker nuevo: {ctrl}")


def _v21_then_new(gh_cache):
    """Lucía (Google conectado, permiso caducado, cambios sin subir: la pastilla «Guardar» en la v21) y Leo (sin
    Google, la fila «Guarda tu partida» en la v21 y la IPA encendida por un mayor) usan la v21; se publica esta versión
    y vuelven. Devuelve una lista de problemas."""
    probs = []
    base_dir = _base21_dir()
    assert base_dir, f"no se pudo sacar la versión publicada (commit {_BASE21_COMMIT}); VOCAB_BASE21=<copia de ese commit>"
    var = "gh" if gh_cache else "sin-cache"
    tag = "caché de GitHub Pages" if gh_cache else "sin caché HTTP"
    ta, tb = f"{tag} · Lucía", f"{tag} · Leo"
    v, shell = _sw(C.ROOT)
    mods = [s.split("?")[0] for s in I4._tags((C.ROOT / "index.html").read_text(encoding="utf-8"))
            if not s.startswith(("http:", "https:", "//"))]
    srv, roots = F5._switching_server(base_dir, gh_cache)
    ctx_a, pa = _ctx(srv)
    ctx_b, pb = _ctx(srv)
    sa, sb = _Scripts(pa), _Scripts(pb)
    stopped = False
    try:
        # ---- Lucía en la v21: Google conectado, el permiso caducó hace 30 min y hay cambios sin subir
        _start_v21(pa, A._sync_keys(NOW_MS - 30 * MIN, reconnect=True, base=_keys()), ta, probs)
        try:
            pa.wait_for_function(_CHIP, timeout=8000)
        except Exception:  # noqa: BLE001
            probs.append(f"{ta}: en la v21 no sale la pastilla «Guardar» (estado {pa.evaluate('vocabSync.state')})")
        # un repaso de 3 tarjetas («¡Sí!»), la granja y Hoy (por enlaces: en la v21 una pestaña renovaría el permiso)
        C.goto(pa, "#/repaso")
        pa.wait_for_selector("#rv-card", timeout=10000)
        for _ in range(3):
            st0 = pa.evaluate(V._ST)
            V._tap_card(pa)
            pa.locator(".rv-yes").click()
            V._wait_next(pa, st0["i"])
            pa.wait_for_selector("#rv-card:not(.is-flipped)", timeout=3000)
        C.goto(pa, "#/granja")
        pa.wait_for_selector("#app .fm-stage .fm-it", timeout=9000)
        pa.wait_for_timeout(400)
        C.goto(pa, "")
        pa.wait_for_timeout(600)
        if not pa.evaluate(_CHIP):
            probs.append(f"{ta}: tras usar la v21 ya no sale la pastilla «Guardar» (la prueba no vale): {pa.evaluate('vocabSync.state')}")
        C.shot(pa, f"v21-hoy-guardar-{var}", OUT)
        gis = pa.evaluate(_GIS_ALL)
        if any(c["tap"] for c in gis):
            probs.append(f"{ta}: en la v21 se renovó el permiso en un toque (la prueba no vale): {gis}")
        old_a, snap_a = C.storage(pa), C.export(pa)
        media_a = pa.evaluate(_MEDIA)
        if json.loads(old_a.get("vocab:ui") or "{}").get("ipa", "nada") != "nada":
            probs.append(f"{ta}: en la v21 vocab:ui tiene la clave ipa: {old_a.get('vocab:ui')}")
        probs += [f"{ta} · v21: {e}" for e in _errors(pa)]

        # ---- Leo en la v21: sin Google, 5 días de uso («Guarda tu partida» en Hoy); un mayor enciende la IPA
        _start_v21(pb, _keys(save__first=int(NOW_MS - 5 * DAY)), tb, probs)
        try:
            pb.wait_for_function("() => { const r = document.getElementById('sv-rem'); return !!r && /Guarda tu partida/.test(r.textContent); }", timeout=6000)
        except Exception:  # noqa: BLE001
            probs.append(f"{tb}: en la v21 Hoy no enseña «Guarda tu partida» (la prueba no vale)")
        C.shot(pb, f"v21-hoy-guarda-tu-partida-{var}", OUT)
        pb.evaluate("() => { openSettings('mayores'); }")
        BZ._pass_gate(pb)
        pb.wait_for_selector("#aj-ipa", state="attached", timeout=5000)
        pb.wait_for_timeout(500)
        if (IPA._switch(pb) or {}).get("on") is not False:
            probs.append(f"{tb}: en la v21 el interruptor de la IPA no salía apagado: {IPA._switch(pb)}")
        pb.locator("label[for=aj-ipa]").click()
        pb.wait_for_timeout(200)
        pb.evaluate("() => vocabSettings.close()")
        pb.wait_for_function("() => !document.querySelector('dialog#ajustes[open]')", timeout=4000)
        old_b, snap_b = C.storage(pb), C.export(pb)
        media_b = pb.evaluate(_MEDIA)
        if json.loads(old_b.get("vocab:ui") or "{}") != {"hints": _HINTS, "ipa": True}:
            probs.append(f"{tb}: en la v21 encender la IPA no guardó {{ipa: true}}: {old_b.get('vocab:ui')}")
        probs += [f"{tb} · v21: {e}" for e in _errors(pb)]

        # ---- se publica esta versión y vuelven
        _quiet((pa, pb))
        roots["cur"] = C.ROOT
        _come_back(pa, sa, gh_cache, v, mods, ta, probs)
        _come_back(pb, sb, gh_cache, v, mods, tb, probs)
        if pa.evaluate(_GIS_V22):
            probs.append(f"{ta}: al abrir la versión nueva se pide el permiso sin un toque: {pa.evaluate(_GIS_V22)}")
        C.shot(pa, f"v22-hoy-tras-actualizar-{var}", OUT)
        for page, t, old_media in ((pa, ta, media_a), (pb, tb, media_b)):
            _new_sw(page, v, shell, old_media, t, probs)
        # la partida igual: cada clave y la exportación (sin claves nuevas)
        for page, t, old, snap in ((pa, ta, old_a, snap_a), (pb, tb, old_b, snap_b)):
            _same_keys(old, C.storage(page), t, probs)
            d = C.diff_exports(snap, C.export(page), allow_new=False)
            if d:
                probs.append(f"{t}: la exportación tras actualizar no es la de la v21: {d}")

        # ---- Leo: la IPA que encendió un mayor en la v21 se sigue viendo y el interruptor sale encendido
        _how(pb, probs, tb)
        _back_of_card(pb, probs, tb)
        C.goto(pb, "")
        pb.evaluate(IPA._PASS)
        pb.evaluate("() => openSettings('mayores')")
        pb.wait_for_selector("#aj-ipa", state="attached", timeout=5000)
        pb.wait_for_timeout(500)
        sw = IPA._switch(pb)
        if not sw or not sw["on"] or sw["role"] != "switch":
            probs.append(f"{tb}: con el {{ipa: true}} de la v21, el interruptor no sale encendido: {sw}")
        pb.evaluate("() => vocabSettings.close()")
        pb.wait_for_function("() => !document.querySelector('dialog#ajustes[open]')", timeout=4000)
        if json.loads(pb.evaluate("() => localStorage.getItem('vocab:ui')")) != {"hints": _HINTS, "ipa": True}:
            probs.append(f"{tb}: tras actualizar cambia vocab:ui: {pb.evaluate('() => localStorage.getItem(`vocab:ui`)')}")
        probs += [f"{tb}: {e}" for e in C.errors(pb)]
        if pb._outside:
            probs.append(f"{tb}: se pidió algo fuera del servidor: {pb._outside[:5]}")
        ctx_b.close()

        # ---- Lucía: Para mayores dice la verdad y el siguiente toque seguro (una pestaña) sube la partida
        try:
            pa.wait_for_function("() => vocabSync.state.phase === 'reconnect'", timeout=5000)
        except Exception:  # noqa: BLE001
            probs.append(f"{ta}: tras actualizar, el estado de Google es {pa.evaluate('vocabSync.state')} (se esperaba reconnect)")
        if pa.evaluate("() => document.querySelector('#sv-chip, .sv-chip, [data-sync-slot]') !== null"):
            probs.append(f"{ta}: tras actualizar sale la pastilla «Guardar» o su hueco")
        cfg, box, sw = _adults(pa)
        if not re.fullmatch(r"Google: última copia hace \d+ h", cfg or ""):
            probs.append(f"{ta}: la fila Para mayores dice {cfg!r} (se esperaba «Google: última copia hace 2 h»)")
        if "Hay cambios sin subir a Google" not in box["t"] or not box["now"] or box["re"]:
            probs.append(f"{ta}: Para mayores no dice que hay cambios sin subir: {box}")
        if not sw or not sw["on"]:
            probs.append(f"{ta}: el interruptor de la IPA no sale encendido de serie: {sw}")
        if pa.evaluate(_GIS_V22) or pa.evaluate("window.__gis.length"):
            probs.append(f"{ta}: la versión nueva pidió el permiso sin un toque: {pa.evaluate(_GIS_V22)}")
        if any("/upload/" in x["url"] for x in pa.evaluate(_DRIVE_LOG)):
            probs.append(f"{ta}: se subió algo sin permiso: {pa.evaluate(_DRIVE_LOG)}")
        # (la pestaña Hoy, estando en Hoy: no cambia nada de la partida antes de subirla; la de Aprender lleva ahora al
        # repaso, que empieza algo, y no es un toque seguro)
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
        ups = [x for x in pa.evaluate(_DRIVE_LOG) if x["method"] == "PATCH" and "/upload/drive/v3/files/f1" in x["url"]]
        if len(ups) != 1:
            probs.append(f"{ta}: subidas a Drive tras el toque: {[(x['method'], x['url']) for x in pa.evaluate(_DRIVE_LOG)]}")
        else:
            md, data = _multipart(ups[0]["body"])
            d = C.diff_exports(snap_a, data, allow_new=False)
            if data.get("app") != "vocabulary" or d:
                probs.append(f"{ta}: lo que se sube a Google no es la partida de la v21: {d}")
            if md.get("appProperties", {}).get("hash") != pa.evaluate("vocabSync.hash()"):
                probs.append(f"{ta}: la huella de la subida no es la de la partida: {md}")
        if len(pa.evaluate(_GIS_V22)) != 1:
            probs.append(f"{ta}: llamadas al permiso en la versión nueva: {pa.evaluate(_GIS_V22)}")
        m = pa.evaluate("vocabSync.state.meta")
        if m["reconnect"] or m["localDirty"]:
            probs.append(f"{ta}: tras subir, el permiso o la copia no quedaron al día: {m}")
        C.goto(pa, "")
        cfg, box, sw = _adults(pa)
        if not cfg.startswith("Google: guardado") or "Copia al día" not in box["t"] or "Hay cambios sin subir" in box["t"]:
            probs.append(f"{ta}: tras subir, Para mayores dice {cfg!r} · {box['t']!r}")
        # la IPA de serie (nunca tocó el interruptor)
        _how(pa, probs, ta)
        _back_of_card(pa, probs, ta)
        C.shot(pa, f"v22-repaso-ipa-{var}", OUT)
        C.goto(pa, "")
        if "ipa" in json.loads(pa.evaluate("() => localStorage.getItem('vocab:ui')") or "{}"):
            probs.append(f"{ta}: tras actualizar vocab:ui tiene la clave ipa sin que nadie tocara el interruptor")
        probs += [f"{ta}: {e}" for e in C.errors(pa)]
        if pa._outside:
            probs.append(f"{ta}: se pidió algo fuera del servidor: {pa._outside[:5]}")

        # ---- sin conexión: el servidor parado, sale la app nueva desde vocab-shell-v22
        srv.stop()
        stopped = True
        ctx_a.set_offline(True)
        C.clear_errors(pa)
        sa.reset()
        C.reload(pa)
        off = pa.evaluate(_NEW22, v)
        off.pop("stale")
        if not all(off.values()):
            probs.append(f"{ta}: sin conexión no sale la app nueva entera: {off}")
        missing, other = sa.check(C.base_url(pa), C.ROOT, mods)
        if missing or other:
            probs.append(f"{ta}: sin conexión no se ejecutan {missing} y son de otra versión {other}")
        probs += [f"{ta} · sin conexión: {e}" for e in C.errors(pa)]
        # el repaso, también con la IPA (sin los dibujos y audios que nunca se bajaron: sin «Descargar todo» no están)
        C.clear_errors(pa)
        _back_of_card(pa, probs, f"{ta} · sin conexión")
        never = re.compile(r"^console: Failed to load resource: net::ERR_FAILED @ " + re.escape(C.base_url(pa)) + r"/(img|audio)/")
        probs += [f"{ta} · sin conexión, repaso: {e}" for e in C.errors(pa) if not never.match(e)]
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


def test_update_from_published_v21():
    """Dos niños con la versión publicada (main 1f0b356, sw vocab-shell-v21) y la partida sembrada: Lucía, con Google
    conectado, el permiso caducado y cambios sin subir (la pastilla «Guardar» en la v21), usa Hoy, un repaso y la
    granja; Leo, sin Google («Guarda tu partida» en su Hoy de la v21), tiene la IPA encendida por un mayor. Se publica
    esta versión y vuelven abriendo la app: la primera carga ya es la app nueva entera (cada módulo es el de esta
    versión, con «?v=22»; ipaOn(); sin [data-sync-slot], pastilla ni «Guarda tu partida»), el sw nuevo se instala y
    controla (vocab-shell-v22 con todo SHELL, sin vocab-shell-v21, vocab-media entera), la partida queda igual (cada
    clave y la exportación, sin claves nuevas), la IPA se ve en «Cómo suena» y en el reverso del repaso para los dos
    (y el interruptor sale encendido), Para mayores dice que hay cambios sin subir, nada pide el permiso fuera de un
    toque y el siguiente toque en una pestaña lo pide dentro del toque y sube la partida de la v21 tal cual; sin
    conexión sale la app nueva. Sin errores."""
    probs = _v21_then_new(gh_cache=False)
    assert not probs, "\n".join(probs)


def test_update_from_v21_with_github_pages_http_cache():
    """Lo mismo con las cabeceras de GitHub Pages (Cache-Control: max-age=600) y la caché HTTP del navegador: los dos
    tenían la app abierta al publicar y recargan antes de 10 minutos. Ningún módulo viejo sale de la caché HTTP: la
    primera carga ya ejecuta cada módulo de esta versión (con «?v=22»), sin pastilla ni «Guarda tu partida», y todo lo
    demás sigue igual. Sin errores."""
    probs = _v21_then_new(gh_cache=True)
    assert not probs, "\n".join(probs)
