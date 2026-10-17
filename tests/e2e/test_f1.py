"""F1 (cimientos, SPEC §6): contraste 4,5:1 en los textos, ningún color prohibido, sin backdrop-filter con
data-glass=off, todas las entradas de SHELL de sw.js con 200, sin conexión se sirve la versión nueva aunque haya una
caché vieja (vocab-v1), tema automático, listen() que nunca se cuelga y «Descargar todo» con los audios del idioma.

La auditoría de pantalla está en audit.js (se puede usar en otras fases: page.evaluate(AUDIT, {"what": [...]}))."""
from __future__ import annotations

import json
import re
import time
import urllib.request
from urllib.parse import urlsplit

import common as C
import routes as R

AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")

# termina las animaciones y transiciones finitas (entradas, saltitos de 3 ciclos): se audita cómo queda la pantalla
_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""


def _fmt(found, limit=40):
    """{pantalla: [fallos]} → texto: cada fallo distinto una vez, con las pantallas donde sale."""
    where = {}
    for scr, items in found.items():
        for it in items:
            where.setdefault(it, []).append(scr)
    lines = []
    for it, scrs in list(where.items())[:limit]:
        more = f" (+{len(scrs) - 3})" if len(scrs) > 3 else ""
        lines.append(f"  {it}\n      en {', '.join(scrs[:3])}{more}")
    if len(where) > limit:
        lines.append(f"  … y {len(where) - limit} más")
    return "\n".join(lines)


# ---------------------------------------------------------------- auditoría de todas las pantallas
def _open_settings(page):
    """Abre la hoja de Ajustes (engranaje) si la hay. Devuelve True si quedó abierta."""
    for sel in ("[data-open=ajustes]", "#cfg-b", "button[aria-label='Ajustes']"):
        loc = page.locator(sel)
        if loc.count() and loc.first.is_visible():
            loc.first.click(force=True)
            try:
                page.wait_for_selector("dialog[open]", timeout=3000)
                C.settle(page, 200)
                return True
            except Exception:  # noqa: BLE001
                return False
    return False


def _audit_screen(page, res, key):
    page.evaluate(_FINISH)
    page.wait_for_timeout(60)
    a = page.evaluate(AUDIT, {"what": ["contrast", "palette", "backdrop"]})
    page.evaluate("() => { document.documentElement.dataset.glass = 'off'; }")
    try:
        page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
        b = page.evaluate(AUDIT, {"what": ["backdrop"]})
    finally:
        page.evaluate("() => { delete document.documentElement.dataset.glass; }")
    res[key] = {"contrast": a["contrast"], "palette": a["palette"], "glass_on": len(a["backdrop"]),
                "glass_off": b["backdrop"], "texts": a["n"]["texts"]}


_AUDIT = None


def _audit_all():
    """Todas las rutas (móvil y escritorio, claro y oscuro, con la partida sembrada), la hoja de Ajustes y Hoy el primer
    día. Se calcula una vez y la usan las tres pruebas de abajo."""
    global _AUDIT
    if _AUDIT is not None:
        return _AUDIT
    res = {}
    for kind in ("phone", "desk"):
        for scheme in ("light", "dark"):
            page = C.new_page(kind, color_scheme=scheme)
            try:
                C.seed(page)
                for r in R.all_routes():
                    C.goto(page, r["hash"])
                    _audit_screen(page, res, f"{kind}-{scheme}-{r['name']}")
                C.goto(page, "")
                if _open_settings(page):
                    _audit_screen(page, res, f"{kind}-{scheme}-ajustes")
                    page.keyboard.press("Escape")
            finally:
                page.context.close()
    for scheme in ("light", "dark"):
        page = C.new_page("phone", color_scheme=scheme)
        try:
            C.goto(page, "")
            _audit_screen(page, res, f"phone-{scheme}-primer-dia-hoy")
        finally:
            page.context.close()
    _AUDIT = res
    return res


def test_audit_detects_problems():
    """La auditoría ve lo que tiene que ver: texto flojo, texto con opacidad, morado, naranja y backdrop-filter; y deja
    pasar el texto grande a 3:1 y los emojis."""
    page = C.new_page("desk")
    try:
        C.goto(page, "")
        page.evaluate("""() => {
          const d = document.createElement("div"); d.id = "t-audit";
          d.style.cssText = "position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;width:300px";
          d.innerHTML = `<p id="t-low" style="color:#aaaaaa;font-size:15px;margin:0">Texto flojo</p>
            <p id="t-big" style="color:#8f8f8f;font-size:30px;margin:0">Grande</p>
            <p id="t-op" style="color:#000;opacity:.3;margin:0">Medio</p>
            <p id="t-emoji" style="color:#dddddd;margin:0">🦊🐶</p>
            <p id="t-pur" style="color:#8e44ad;margin:0">Morado</p>
            <p id="t-org" style="background:#e67e22;color:#000;margin:0">Naranja</p>
            <div id="t-bf" style="-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);width:20px;height:20px"></div>`;
          document.body.appendChild(d);
        }""")
        a = page.evaluate(AUDIT, {"what": ["contrast", "palette", "backdrop"]})
        page.evaluate("() => { document.documentElement.dataset.glass = 'off'; }")
        b = page.evaluate(AUDIT, {"what": ["backdrop"]})
    finally:
        page.context.close()
    has = lambda lst, ident: any(f"#{ident}" in x for x in lst)
    miss = []
    if not has(a["contrast"], "t-low"):
        miss.append("no ve el texto gris claro")
    if not has(a["contrast"], "t-op"):
        miss.append("no ve el texto con opacidad .3")
    if has(a["contrast"], "t-big"):
        miss.append("pide 4,5:1 a un texto de 30 px (basta 3:1)")
    if has(a["contrast"], "t-emoji"):
        miss.append("mide un texto que solo tiene emojis")
    if not has(a["palette"], "t-pur"):
        miss.append("no ve el morado #8e44ad")
    if not has(a["palette"], "t-org"):
        miss.append("no ve el naranja #e67e22")
    if not has(b["backdrop"], "t-bf"):
        miss.append("no ve el backdrop-filter")
    assert not miss, "la auditoría falla: " + "; ".join(miss) + f"\n{json.dumps(a, ensure_ascii=False)[:1500]}"


def test_contrast_texts():
    """Todo texto visible de cada pantalla tiene contraste ≥ 4,5:1 con su fondo (≥ 3:1 si es grande), en móvil y
    escritorio, claro y oscuro."""
    res = _audit_all()
    bad = {k: v["contrast"] for k, v in res.items() if v["contrast"]}
    n = sum(v["texts"] for v in res.values())
    print(f"      {n} textos medidos en {len(res)} pantallas")
    assert n > 1000, f"se midieron muy pocos textos ({n}): ¿la auditoría no ve la página?"
    assert not bad, "textos con poco contraste:\n" + _fmt(bad)


def test_palette_no_banned_colors():
    """Ningún color calculado con tono 260-340° y saturación > 25 % (índigo, morado, rosa), ni naranjas (15-45°,
    saturación > 60 %, luz 40-70 %), en ninguna pantalla."""
    res = _audit_all()
    bad = {k: v["palette"] for k, v in res.items() if v["palette"]}
    assert not bad, "colores fuera de la paleta:\n" + _fmt(bad)


def test_glass_off_no_backdrop_filter():
    """Con html[data-glass=off] ningún elemento (ni ::before/::after) tiene backdrop-filter; con el vidrio puesto sí hay."""
    res = _audit_all()
    bad = {k: v["glass_off"] for k, v in res.items() if v["glass_off"]}
    on = sum(v["glass_on"] for v in res.values())
    assert not bad, "con data-glass=off sigue habiendo backdrop-filter:\n" + _fmt(bad)
    assert on > 0, "con el vidrio puesto no hay ningún backdrop-filter: la prueba no estaría mirando nada"


# ---------------------------------------------------------------- service worker
def _sw():
    src = (C.ROOT / "sw.js").read_text(encoding="utf-8")
    m = re.search(r"const SHELL = \[(.*?)\];", src, re.S)
    assert m, "sw.js no tiene const SHELL = [...]"
    shell = json.loads("[" + re.sub(r",\s*$", "", m.group(1).strip()) + "]")
    v = re.search(r"const VERSION = (\d+);", src)
    return shell, int(v.group(1)) if v else None


def test_sw_shell_entries_200():
    """Cada entrada de SHELL en sw.js responde 200, sin repetidas, y en SHELL están todos los scripts, el manifiesto y
    los iconos que usa index.html (también js/motion.js y js/gestures.js, que cargan antes que los módulos)."""
    shell, version = _sw()
    srv = C.serve()
    bad = []
    for u in shell:
        try:
            with urllib.request.urlopen(f"{srv.url}/{'' if u == './' else u}", timeout=10) as r:
                if r.status != 200:
                    bad.append(f"{u} → {r.status}")
        except Exception as e:  # noqa: BLE001
            bad.append(f"{u} → {e}")
    assert not bad, "entradas de SHELL que no responden 200:\n  " + "\n  ".join(bad)
    assert len(shell) == len(set(shell)), f"SHELL tiene repetidas: {[u for u in shell if shell.count(u) > 1]}"
    html = (C.ROOT / "index.html").read_text(encoding="utf-8")
    scripts = re.findall(r'<script[^>]+src="([^"]+)"', html)
    links = re.findall(r'<link[^>]+rel="(?:manifest|apple-touch-icon|icon)"[^>]*href="([^"]+)"', html)
    man = json.loads((C.ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
    need = [u for u in scripts + links + [i["src"] for i in man.get("icons", [])] if not re.match(r"(data|https?):", u)]
    missing = [u for u in need if u not in shell]
    assert not missing, f"index.html o el manifiesto usan ficheros que no están en SHELL: {missing}"
    order = [s for s in scripts if s.startswith("js/")]
    assert order[:2] == ["js/motion.js", "js/gestures.js"], f"motion.js y gestures.js tienen que cargar antes que los módulos: {order}"
    off = re.search(r'const OFF_SHELL = "([^"]+)"', html)
    if off and version is not None:
        assert off.group(1) == f"vocab-shell-v{version}", \
            f"index.html OFF_SHELL={off.group(1)!r} no es la caché de sw.js (vocab-shell-v{version}): súbelo con VERSION"


_FAKE_INDEX = ("<!doctype html><meta charset=utf-8><title>Version vieja</title>"
               "<h1 id=version-vieja>VERSION VIEJA</h1>")


def test_offline_serves_new_version():
    """Con una caché vieja «vocab-v1» que tiene un index.html falso: el sw nuevo se instala, borra vocab-v1 (pasando sus
    dibujos a vocab-media) y, sin conexión, la recarga sirve el index.html bueno y las rutas pintan, aunque la caché
    vieja vuelva a aparecer."""
    shell, version = _sw()
    img = "img/" + sorted(p.name for p in (C.ROOT / "img").glob("*.png"))[0]
    ctx = C.new_context("phone", sw=True, host="localhost")
    page = ctx.new_page()
    try:
        base = C.base_url(page)
        page.goto(base + "/__blank", wait_until="domcontentloaded")
        page.evaluate("""async ([fake, img]) => {
          const v1 = await caches.open("vocab-v1"), h = {headers: {"content-type": "text/html; charset=utf-8"}};
          await v1.put("index.html", new Response(fake, h));
          await v1.put("./", new Response(fake, h));
          await v1.put(img, await fetch(img));
        }""", [_FAKE_INDEX, img])
        C.seed(page)
        page.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=20000)
        C.reload(page)                      # ya pasa por el sw nuevo
        sw_url = page.evaluate("() => navigator.serviceWorker.controller.scriptURL")
        assert sw_url.endswith("/sw.js"), f"controla la página otro sw: {sw_url}"
        t0 = time.time()
        while time.time() - t0 < 15 and "vocab-v1" in page.evaluate("() => caches.keys()"):
            page.wait_for_timeout(250)
        keys = page.evaluate("() => caches.keys()")
        shell_name = f"vocab-shell-v{version}"
        assert shell_name in keys and "vocab-media" in keys, f"faltan cachés: {keys}"
        assert "vocab-v1" not in keys, f"la caché vieja vocab-v1 no se borró: {keys}"
        assert page.evaluate("async img => !!(await (await caches.open('vocab-media')).match(img))", img), \
            "el dibujo de vocab-v1 no pasó a vocab-media"
        good = page.evaluate("""async n => { const r = await (await caches.open(n)).match("index.html");
                                return r ? await r.text() : ""; }""", shell_name)
        assert "version-vieja" not in good and 'id="app"' in good, "el index.html del shell no es el bueno"
        for h in ("#/mapa", "#/granja", "#/progreso", "#/"):   # con red, para que sus dibujos queden guardados
            C.goto(page, h)
        # si volviera a haber una caché vieja con el index.html falso, el shell gana
        page.evaluate("""async fake => { const v1 = await caches.open("vocab-v1"), h = {headers: {"content-type": "text/html"}};
          await v1.put("index.html", new Response(fake, h)); await v1.put("./", new Response(fake, h)); }""", _FAKE_INDEX)
        C.clear_errors(page)
        ctx.set_offline(True)
        C.reload(page)
        assert page.locator("#version-vieja").count() == 0, "sin conexión sale el index.html viejo"
        assert page.locator("#app").count() == 1, f"sin conexión no sale la app: {page.title()!r}"
        shown = {}
        for h in ("#/mapa", "#/granja", "#/progreso", "#/"):
            shown[h] = C.goto(page, h)
            txt = page.locator("#app").inner_text()
            assert "No se pudo cargar" not in txt and "Cargando" not in txt[:40], f"sin conexión {h} no pinta: {txt[:120]!r}"
        errs = C.errors(page)
    finally:
        try:
            ctx.set_offline(False)
        except Exception:  # noqa: BLE001
            pass
        ctx.close()
    assert shown == {"#/mapa": "mapa", "#/granja": "granja", "#/progreso": "progreso", "#/": ""}, f"rutas sin conexión: {shown}"
    assert not errs, "errores sin conexión:\n  " + "\n  ".join(errs)


# ---------------------------------------------------------------- tema
def _theme(page):
    return page.evaluate("""() => {
      const c = getComputedStyle(document.body).backgroundColor, m = c.match(/[\\d.]+/g).map(Number);
      const lum = (m[0] * .2126 + m[1] * .7152 + m[2] * .0722) / 255;
      return {t: document.documentElement.dataset.theme, key: localStorage.getItem("theme"), dark: lum < .2,
              auto: Object.keys(localStorage).filter(k => /^"?auto"?$/.test(localStorage.getItem(k) || ""))};
    }""")


def test_theme_auto_follows_system():
    """Sin clave «theme» la app sigue al sistema (también si cambia con la app abierta) y no escribe nada; con «dark»
    guardada sale oscura aunque el sistema sea claro; elegir Automático borra la clave; nunca se guarda «auto»."""
    probs = []
    for scheme, other in (("light", "dark"), ("dark", "light")):
        page = C.new_page("phone", color_scheme=scheme)
        try:
            C.seed(page)
            s = _theme(page)
            if s["t"] != scheme or s["dark"] != (scheme == "dark") or s["key"] is not None:
                probs.append(f"sin clave y sistema {scheme}: {s}")
            page.emulate_media(color_scheme=other)
            page.wait_for_timeout(150)
            s = _theme(page)
            if s["t"] != other or s["dark"] != (other == "dark") or s["key"] is not None:
                probs.append(f"sin clave, el sistema pasa a {other} con la app abierta: {s}")
            errs = C.errors(page)
            if errs:
                probs += errs
        finally:
            page.context.close()

    page = C.new_page("phone", color_scheme="light")
    try:
        C.seed(page, keys={**C.seed_keys(), "theme": '"dark"'})
        s = _theme(page)
        if s["t"] != "dark" or not s["dark"]:
            probs.append(f"con 'dark' guardado y el sistema claro: {s}")
        C.reload(page)
        if _theme(page)["t"] != "dark":
            probs.append("con 'dark' guardado, al recargar no sale oscuro")
        page.emulate_media(color_scheme="dark")
        page.emulate_media(color_scheme="light")
        page.wait_for_timeout(100)
        if _theme(page)["t"] != "dark":
            probs.append("con 'dark' guardado, un cambio del sistema lo pisa")
        # Automático: desde la hoja de Ajustes si está, si no con setTheme()
        if _open_settings(page) and page.locator("[data-th=auto]").count():
            for m in ("light", "auto", "dark", "auto"):
                page.locator(f"[data-th={m}]").first.click(force=True)
                page.wait_for_timeout(60)
                s = _theme(page)
                want = None if m == "auto" else json.dumps(m)
                if s["key"] != want or s["auto"]:
                    probs.append(f"Ajustes › Apariencia › {m}: {s}")
                if m == "auto" and s["t"] != "light":
                    probs.append(f"Automático con el sistema claro no sale claro: {s}")
            page.keyboard.press("Escape")
        else:
            page.evaluate("() => setTheme('auto')")
            s = _theme(page)
            if s["key"] is not None or s["t"] != "light" or s["auto"]:
                probs.append(f"setTheme('auto'): {s}")
        snap = C.export(page)
        if "theme" in snap["keys"]:
            probs.append(f"en Automático la exportación lleva theme={snap['keys']['theme']}")
        if any(v.strip('"') == "auto" for v in snap["keys"].values()):
            probs.append("la exportación lleva un valor 'auto'")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "tema:\n  " + "\n  ".join(probs)


# ---------------------------------------------------------------- voz
_FAKE_SR = """(() => {
  window.__sr = [];
  class FakeSR {                       // un reconocedor que nunca contesta: ni resultado, ni error, ni fin
    constructor(){ this.started = false; this.aborted = false; this.stopped = false; window.__sr.push(this); }
    start(){ this.started = true; }
    stop(){ this.stopped = true; }
    abort(){ this.aborted = true; }
    addEventListener(){} removeEventListener(){}
  }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
})();"""


def test_listen_never_hangs():
    """listen() con un SpeechRecognition que nunca responde termina en ≤ 8 s con un estado claro, suelta el micrófono
    (abort) y el siguiente listen() vuelve a funcionar."""
    page = C.new_page("phone", now=None)
    try:
        page.context.add_init_script(_FAKE_SR)
        C.seed(page)
        assert page.evaluate("() => typeof listen === 'function' && canListen()"), "canListen() es falso con reconocedor"
        t0 = time.time()
        r = page.evaluate("""async () => { const t = performance.now(); const r = await listen(); r.ms = performance.now() - t; return r; }""")
        wall = time.time() - t0
        sr = page.evaluate("() => window.__sr.map(x => ({started: x.started, aborted: x.aborted, stopped: x.stopped}))")
        r2 = page.evaluate("() => listen({ms: 400})")
        errs = C.errors(page)
    finally:
        page.context.close()
    assert r["ms"] <= 8000 and wall <= 9, f"listen() tardó {r['ms'] / 1000:.1f} s ({wall:.1f} s reales)"
    assert r.get("status") == "timeout" and r.get("alts") == [], f"listen() sin respuesta tiene que acabar en timeout: {r}"
    assert sr and sr[0]["started"] and (sr[0]["aborted"] or sr[0]["stopped"]), f"no se paró el reconocedor: {sr}"
    assert r2.get("status") == "timeout", f"después de un timeout, listen() no vuelve a funcionar: {r2}"
    assert not errs, "errores:\n  " + "\n  ".join(errs)


# ---------------------------------------------------------------- descargar todo
def test_download_saves_current_language_audio():
    """«Descargar todo» guarda en vocab-media los mp3 del idioma actual (inglés en la partida sembrada) enteros y con
    200, y ninguno de los otros idiomas. Para que sean pocas peticiones, el mapa de audios se recorta a 3 y los temas, salvo
    uno, se sirven vacíos mientras descarga."""
    amap = json.loads((C.ROOT / "audio" / "en.json").read_text(encoding="utf-8"))
    ids = sorted({v for v in amap.values() if re.fullmatch(r"[\w-]+", str(v))})[:3]
    small = {w: i for w, i in amap.items() if i in ids}
    keep = {"index", "map", "game", "sprites", "grammar_en", "grammar_fr", "grammar_da", R.TOPIC}
    st = {"on": False, "n": 0, "stub": 0}

    def route(rt):
        path = urlsplit(rt.request.url).path
        if st["on"]:
            st["n"] += 1
        if path == "/audio/en.json":
            return rt.fulfill(status=200, content_type="application/json", body=json.dumps(small))
        m = re.fullmatch(r"/data/([\w-]+)\.json", path)
        if st["on"] and m and m.group(1) not in keep:
            st["stub"] += 1
            return rt.fulfill(status=200, content_type="application/json", body='{"rows":[]}')
        return rt.fallback()

    page = C.new_page("phone")
    try:
        page.route("**/*", route)
        C.seed(page)
        assert page.evaluate("() => lang") == "english"
        st["on"] = True
        page.evaluate("() => downloadAll()")
        st["on"] = False
        info = page.evaluate("""async () => {
          const media = await caches.open("vocab-media"), out = {mp3: {}, other: [], img: 0, doc: false};
          for (const req of await media.keys()) {
            const p = new URL(req.url).pathname;
            const m = /^\\/audio\\/(\\w+)\\/([\\w-]+)\\.mp3$/.exec(p);
            if (m && m[1] === "en") { const r = await media.match(req); out.mp3[m[2]] = [r.status, (await r.arrayBuffer()).byteLength]; }
            else if (m) out.other.push(p);
            else if (p.startsWith("/img/")) out.img++;
          }
          out.offline = localStorage.getItem("offline");
          return out;
        }""")
        doc = page.evaluate("async t => !!(await (await caches.open('vocab-media')).match(`data/${t}.json`))", R.TOPIC)
        errs = C.errors(page)
    finally:
        page.context.close()
    assert info["mp3"], f"no se guardó ningún mp3 del inglés en vocab-media: {info}"
    wrong = {i: v for i, v in info["mp3"].items()
             if v[0] != 200 or v[1] != (C.ROOT / "audio" / "en" / f"{i}.mp3").stat().st_size}
    assert not wrong, f"mp3 guardados a medias o con otro estado: {wrong}"
    assert sorted(info["mp3"]) == ids, f"se esperaban los mp3 {ids}, se guardaron {sorted(info['mp3'])}"
    assert not info["other"], f"se guardaron audios de otros idiomas: {info['other'][:5]}"
    assert doc and info["img"] > 0, f"no se guardaron el tema {R.TOPIC} ni sus dibujos: doc={doc}, dibujos={info['img']}"
    assert info["offline"] == "true", f"sin fallos tiene que marcar 'offline': {info['offline']!r}"
    assert st["n"] < 600, f"demasiadas peticiones para la prueba: {st['n']}"
    assert not errs, "errores:\n  " + "\n  ".join(errs)


# ---------------------------------------------------------------- movimiento, vibración y sonido (F1, integración)
_ENDLESS = """() => { const out = []; for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming(); if (!t || t.iterations !== Infinity || a.playState !== "running") continue;
  const el = a.effect.target;
  if (el && el.closest && el.closest(".fm")) continue;                      // el escenario de la granja (nubes, sol, animales)
  if (document.documentElement.dataset.gmPlay && el && el.closest && el.closest(".gm")) continue;   // la partida en marcha
  const k = typeof el?.className === "string" ? el.className.trim().split(/\\s+/).slice(0, 2).join(".") : "";
  out.push(`${a.animationName || a.id || "(js)"} en ${el ? el.tagName.toLowerCase() + (k ? "." + k : "") : "?"}`);
} catch (e) {} } return [...new Set(out)]; }"""


def test_no_endless_attention_loops():
    """Ningún bucle infinito para llamar la atención (zorro que flota, caja que tiembla, brillo del álbum, estrella,
    pulsos): paran a los 3 ciclos. Solo siguen el escenario de la granja y lo que se mueve durante una partida."""
    page = C.new_page("phone")
    found = {}
    try:
        C.seed(page)
        for r in R.all_routes():
            C.goto(page, r["hash"])
            page.wait_for_timeout(250)
            loops = page.evaluate(_ENDLESS)
            if loops:
                found[r["name"]] = loops
    finally:
        page.context.close()
    assert not found, "animaciones infinitas fuera de la granja:\n" + _fmt(found)


def test_reduced_motion_goes_through_M():
    """Las comprobaciones de «Reducir movimiento» de los módulos pasan por M.rm() (que también mira data-motion=calm):
    en el código no queda ninguna copia propia, y con html[data-motion=calm] el álbum no anima la página."""
    own = []
    for f in [C.ROOT / "index.html", *sorted((C.ROOT / "js").glob("*.js"))]:
        if f.name in ("motion.js", "gestures.js"):
            continue
        for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            if re.search(r"""matchMedia\(\s*["']\(prefers-reduced-motion""", line) and "M.rm" not in line:
                own.append(f"{f.name}:{i}: {line.strip()[:120]}")
    assert not own, "comprobaciones de movimiento que no usan M.rm():\n  " + "\n  ".join(own)
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, f"#/album/{R.ALBUM_DONE}")
        normal = page.evaluate("() => document.querySelector('#al-page')?.classList.contains('turn')")
        page.evaluate("() => { document.documentElement.dataset.motion = 'calm'; }")
        C.goto(page, "#/album/familia")
        calm = page.evaluate("() => [M.rm(), document.querySelector('#al-page')?.classList.contains('turn')]")
        errs = C.errors(page)
    finally:
        page.context.close()
    assert normal is True, "sin reducir movimiento la página del álbum debería entrar animada (.turn)"
    assert calm == [True, False], f"con data-motion=calm: M.rm()={calm[0]}, página animada={calm[1]}"
    assert not errs, "errores:\n  " + "\n  ".join(errs)


def test_rain_reacts_on_release():
    """La lluvia de palabras: apoyar el dedo en una burbuja no hace nada (ni sonido); al soltarlo cuenta, suena y vibra
    (G.haptic('success')). Al fallar suena, pero no vibra."""
    doc = json.loads((C.ROOT / "data" / f"{R.TOPIC}.json").read_text(encoding="utf-8"))
    es2w = {}
    for row in doc["rows"]:
        w = (row.get("l") or {}).get("english", {}).get("word")
        if row.get("es") and w:
            es2w.setdefault(row["es"].strip().lower(), set()).add(w)
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, "#/juegos/lluvia")
        page.evaluate("""() => {
          window.__ans = []; window.__snd = []; window.__hap = [];
          bus.on("answer", d => window.__ans.push(d.ok));
          const p = sfx.play; sfx.play = n => { window.__snd.push(n); return p.call(sfx, n); };
          const h = window.G.haptic; window.G.haptic = k => { window.__hap.push(k); return h(k); };
        }""")
        page.locator(".gm-go").click(force=True)
        cdp = page.context.new_cdp_session(page)

        def bubble(good):
            """Centro de una burbuja (la buena o una mala) que se vea entera dentro del cielo."""
            t0 = time.time()
            while time.time() - t0 < 15:
                tg = page.locator("#gm-tg").inner_text().strip().lower()
                words = sorted(es2w.get(tg, ()))
                pt = page.evaluate("""([words, good]) => {
                  const sky = document.querySelector("#gm-sky").getBoundingClientRect();
                  for (const b of document.querySelectorAll(".gm-bub:not(.pop):not(.bad):not(.gone)")) {
                    const r = b.getBoundingClientRect(), ok = words.includes(b.getAttribute("aria-label"));
                    if (ok === good && r.top > sky.top + 10 && r.bottom < sky.bottom - 60 && r.left >= 0 && r.right <= innerWidth)
                      return {x: r.left + r.width / 2, y: r.top + r.height * .4, w: b.getAttribute("aria-label")};
                  }
                  return null; }""", [words, good])
                if words and pt:
                    return pt
                page.wait_for_timeout(100)
            raise AssertionError(f"no apareció ninguna burbuja {'buena' if good else 'mala'} en 15 s")

        def touch(pt, hold_ms=90):
            cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": pt["x"], "y": pt["y"]}]})
            page.wait_for_timeout(hold_ms)
            mid = page.evaluate("() => [window.__ans.length, window.__snd.slice()]")
            cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
            page.wait_for_timeout(200)
            return mid

        page.evaluate("() => { window.__snd.length = 0; }")
        mid = touch(bubble(True))
        good = page.evaluate("() => [window.__ans.slice(), window.__snd.slice(), window.__hap.slice(), document.querySelector('#gm-sc').textContent]")
        page.evaluate("() => { window.__ans.length = 0; window.__snd.length = 0; window.__hap.length = 0; }")
        touch(bubble(False))
        bad = page.evaluate("() => [window.__ans.slice(), window.__snd.slice(), window.__hap.slice()]")
        play = page.evaluate("() => document.documentElement.dataset.gmPlay || ''")
        errs = C.errors(page)
    finally:
        page.context.close()
    assert play == "lluvia", f"durante la partida falta html[data-gm-play=lluvia]: {play!r}"
    assert mid == [0, []], f"al apoyar el dedo ya pasó algo (respuestas, sonidos): {mid}"
    assert good[0] == [True] and "pop" in good[1] and good[2] == ["success"] and good[3] == "1", \
        f"al soltar sobre la buena: respuestas={good[0]} sonidos={good[1]} vibración={good[2]} puntos={good[3]}"
    assert bad[0] == [False] and "bad" in bad[1] and bad[2] == [], \
        f"al soltar sobre una mala: respuestas={bad[0]} sonidos={bad[1]} vibración={bad[2]}"
    assert not errs, "errores:\n  " + "\n  ".join(errs)
