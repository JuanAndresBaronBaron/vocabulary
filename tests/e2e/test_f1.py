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


def _open_sticker(page):
    """Abre la tarjeta grande de una pegatina conseguida del álbum (un diálogo modal). Devuelve True si quedó abierta."""
    C.goto(page, f"#/album/{R.ALBUM_DONE}")
    st = page.locator(".al-st.got")
    if not st.count():
        return False
    st.first.click(force=True)
    try:
        page.wait_for_selector("dialog.al-dlg[open]", timeout=3000)
        page.wait_for_timeout(700)               # la tarjeta entra girando
        return True
    except Exception:  # noqa: BLE001
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
    """Todas las rutas (móvil y escritorio, claro y oscuro, con la partida sembrada), la hoja de Ajustes, la tarjeta grande
    de una pegatina (diálogo modal: también su ::backdrop) y Hoy el primer día. Se calcula una vez y la usan las tres
    pruebas de abajo."""
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
                if _open_sticker(page):
                    _audit_screen(page, res, f"{kind}-{scheme}-pegatina")
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
          const st = document.createElement("style"); st.textContent = "#t-dlg::backdrop{backdrop-filter:blur(3px)}";
          const dl = document.createElement("dialog"); dl.id = "t-dlg"; dl.textContent = "Hola";
          document.body.append(st, dl); dl.showModal();
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
    if not any("#t-dlg::backdrop" in x for x in b["backdrop"]):
        miss.append("no ve el backdrop-filter del ::backdrop de un diálogo abierto")
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
    """Con html[data-glass=off] ningún elemento (ni ::before/::after, ni el ::backdrop de un diálogo abierto) tiene
    backdrop-filter; con el vidrio puesto sí hay."""
    res = _audit_all()
    bad = {k: v["glass_off"] for k, v in res.items() if v["glass_off"]}
    on = sum(v["glass_on"] for v in res.values())
    assert not bad, "con data-glass=off sigue habiendo backdrop-filter:\n" + _fmt(bad)
    assert any(k.endswith("-pegatina") for k in res), "no se pudo abrir la tarjeta grande de una pegatina del álbum"
    assert on > 0, "con el vidrio puesto no hay ningún backdrop-filter: la prueba no estaría mirando nada"


# ---------------------------------------------------------------- service worker
def _sw():
    src = (C.ROOT / "sw.js").read_text(encoding="utf-8")
    m = re.search(r"const SHELL = \[(.*?)\];", src, re.S)
    assert m, "sw.js no tiene const SHELL = [...]"
    shell = json.loads("[" + re.sub(r",\s*$", "", m.group(1).strip()) + "]")
    v = re.search(r"const VERSION = (\d+);", src)
    return shell, int(v.group(1)) if v else None


def _lazy():
    """LAZY de sw.js: lo que no se baja al instalar (se guarda la primera vez que se usa)"""
    m = re.search(r"const LAZY = \[(.*?)\];", (C.ROOT / "sw.js").read_text(encoding="utf-8"), re.S)
    return json.loads("[" + re.sub(r",\s*$", "", m.group(1).strip()) + "]") if m else []


def test_sw_shell_entries_200():
    """Cada entrada de SHELL en sw.js responde 200, sin repetidas, y en SHELL están todos los scripts, el manifiesto, los
    iconos y las letras que usa index.html (también js/motion.js y js/gestures.js, que cargan antes que los módulos).
    Lo de LAZY (se guarda al usarlo) también responde 200 y no está en SHELL; «./» no hace falta en SHELL (el sw da su
    index.html)."""
    shell, version = _sw()
    lazy = _lazy()
    assert not set(shell) & set(lazy), f"en SHELL y en LAZY a la vez: {sorted(set(shell) & set(lazy))}"
    srv = C.serve()
    bad = []
    for u in shell + lazy:
        try:
            with urllib.request.urlopen(f"{srv.url}/{'' if u == './' else u}", timeout=10) as r:
                if r.status != 200:
                    bad.append(f"{u} → {r.status}")
        except Exception as e:  # noqa: BLE001
            bad.append(f"{u} → {e}")
    assert not bad, "entradas de SHELL que no responden 200:\n  " + "\n  ".join(bad)
    assert len(shell) == len(set(shell)), f"SHELL tiene repetidas: {[u for u in shell if shell.count(u) > 1]}"
    html = (C.ROOT / "index.html").read_text(encoding="utf-8")
    scripts = [u.split("?")[0] for u in re.findall(r'<script[^>]+src="([^"]+)"', html)]   # desde F4 llevan ?v=<VERSION>
    links = re.findall(r'<link[^>]+rel="(?:manifest|apple-touch-icon|icon)"[^>]*href="([^"]+)"', html)
    man = json.loads((C.ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
    fonts = re.findall(r'url\((fonts/[^)"\']+)\)', html)
    need = [u for u in scripts + links + fonts + [i["src"] for i in man.get("icons", [])] if not re.match(r"(data|https?):", u)]
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


_DATA_IN_CACHES = """async () => { const out = {};
  for (const n of await caches.keys()) { const c = await caches.open(n);
    for (const r of await c.keys()) { const p = new URL(r.url).pathname;
      if (/^\\/data\\/.+\\.json$/.test(p)) (out[n] = out[n] || []).push(p); } }
  return out; }"""


def test_offline_serves_new_version():
    """Con una caché vieja «vocab-v1» que tiene un index.html falso: el sw nuevo se instala, borra vocab-v1 (pasando sus
    dibujos a vocab-media); lo que el niño abrió con red (temas, gramática, lección) sigue guardado después de una
    versión nueva de la app (VERSION + 1, con su «?v=» y OFF_SHELL); y sin conexión de verdad (el servidor parado) la
    recarga sirve el index.html bueno, esas rutas pintan (sin la página «Sin conexión») aunque la caché vieja vuelva a
    aparecer, y un tema que nunca se abrió no sale de ninguna parte (control: la prueba de verdad está sin red)."""
    shell, version = _sw()
    img = "img/" + sorted(p.name for p in (C.ROOT / "img").glob("*.png"))[0]
    st = {"bump": False}

    class Handler(C._Quiet):
        """El servidor de siempre; con st["bump"] sirve una versión nueva como se publica: sw.js con VERSION + 1 e
        index.html con el «?v=» de sus <script> y OFF_SHELL subidos con ella."""

        def do_GET(self):
            p = self.path.split("?")[0]
            if st["bump"] and p in ("/sw.js", "/", "/index.html"):
                if p == "/sw.js":
                    src = (C.ROOT / "sw.js").read_text(encoding="utf-8")
                    body = src.replace(f"const VERSION = {version};", f"const VERSION = {version + 1};")
                else:
                    src = (C.ROOT / "index.html").read_text(encoding="utf-8")
                    body = src.replace(f'?v={version}"', f'?v={version + 1}"') \
                              .replace(f'"vocab-shell-v{version}"', f'"vocab-shell-v{version + 1}"')
                assert body != src, f"la versión nueva de {p} no cambió nada"
                body = body.encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/javascript; charset=utf-8" if p == "/sw.js" else "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            super().do_GET()

    srv = C.Server(C.ROOT, "localhost", handler=Handler)
    ctx = C.new_context("phone", sw=True, server=srv)
    page = ctx.new_page()
    stopped = False
    visit = ["#/mapa", f"#/doc/{R.TOPIC}", f"#/gramatica/{R.GRAM_LEVEL}", f"#/leccion/{R.LESSON}", "#/granja", "#/progreso", "#/"]
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
        for h in visit:                     # con red, para que sus datos y dibujos queden guardados
            C.goto(page, h)
        page.wait_for_timeout(300)
        before = page.evaluate(_DATA_IN_CACHES)
        shell_paths = {"/" + u for u in shell}
        opened = sorted(p for ps in before.values() for p in ps if p not in shell_paths)
        need = [f"/data/{R.TOPIC}.json", "/data/grammar_en.json"]
        assert all(p in opened for p in need), f"no se guardaron los datos abiertos con red {need}: {before}"
        in_shell = sorted(p for p in before.get(shell_name, []) if p not in shell_paths)
        assert not in_shell, f"datos que no son del shell guardados en {shell_name} (se borrarían al actualizar): {in_shell}"

        # versión nueva de la app: el shell nuevo sustituye al viejo y los datos abiertos siguen
        st["bump"] = True
        page.evaluate("() => navigator.serviceWorker.getRegistration().then(r => r.update())")
        new_shell = f"vocab-shell-v{version + 1}"
        t0 = time.time()
        while time.time() - t0 < 20:
            keys = page.evaluate("() => caches.keys()")
            if new_shell in keys and shell_name not in keys:
                break
            page.wait_for_timeout(250)
        assert new_shell in keys and shell_name not in keys, f"la versión nueva no se activó: {keys}"
        after = page.evaluate(_DATA_IN_CACHES)
        kept = {p for ps in after.values() for p in ps}
        lost = [p for p in opened if p not in kept]
        assert not lost, f"al actualizar la app se perdieron datos abiertos con red: {lost}"
        # un tema que nunca se abrió (control negativo: sin red no puede salir)
        never = next(f"data/{f.name}" for f in sorted((C.ROOT / "data").glob("*.json"), reverse=True)
                     if f"/data/{f.name}" not in kept and f"/data/{f.name}" not in shell_paths)
        media = set(page.evaluate("async () => (await (await caches.open('vocab-media')).keys()).map(r => new URL(r.url).pathname)"))

        # si volviera a haber una caché vieja con el index.html falso, el shell gana
        page.evaluate("""async fake => { const v1 = await caches.open("vocab-v1"), h = {headers: {"content-type": "text/html"}};
          await v1.put("index.html", new Response(fake, h)); await v1.put("./", new Response(fake, h)); }""", _FAKE_INDEX)
        # sin conexión de verdad: el servidor parado (set_offline no corta las peticiones del service worker)
        srv.stop()
        stopped = True
        ctx.set_offline(True)
        C.clear_errors(page)
        C.reload(page)
        assert page.locator("#version-vieja").count() == 0, "sin conexión sale el index.html viejo"
        assert page.locator("#app").count() == 1, f"sin conexión no sale la app: {page.title()!r}"
        shown = {}
        for h in visit:
            shown[h] = C.goto(page, h)
            txt = page.locator("#app").inner_text()
            assert "No se pudo cargar" not in txt and "Cargando" not in txt[:40] and txt.strip(), \
                f"sin conexión {h} no pinta: {txt[:120]!r}"
            assert page.locator("[data-route-fail]").count() == 0, f"sin conexión {h} (abierto con red) sale «Sin conexión»"
        # sin red, Chrome pide los dibujos perezosos desde más lejos: los de más abajo que no se vieron con red no están
        # (eso es lo esperado sin «Descargar todo»); cualquier otro fallo sí cuenta
        unseen = re.compile(r"^console: Failed to load resource: net::ERR_FAILED @ https?://[^/]+(/(?:img|audio)/\S+)$")
        errs = [e for e in C.errors(page) if not ((m := unseen.match(e)) and m.group(1) not in media)]
        miss = page.evaluate("u => fetch(u).then(r => 'ok ' + r.status, e => 'falla')", never)
    finally:
        try:
            ctx.set_offline(False)
        except Exception:  # noqa: BLE001
            pass
        ctx.close()
        if not stopped:
            srv.stop()
    assert shown == {h: C._norm(h) for h in visit}, f"rutas sin conexión: {shown}"
    assert miss == "falla", f"sin conexión, {never} (nunca abierto) responde «{miss}»: la prueba no estaría sin red"
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
    (G.haptic('success')). Al fallar cuenta, pero ni suena el sonido de fallo ni vibra (sonido solo cuando pasa algo
    bueno)."""
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
    assert bad[0] == [False] and "bad" not in bad[1] and bad[2] == [], \
        f"al soltar sobre una mala: respuestas={bad[0]} sonidos={bad[1]} vibración={bad[2]}"
    assert not errs, "errores:\n  " + "\n  ".join(errs)


# ---------------------------------------------------------------- arreglos de las revisiones de F1
def test_glass_lite_and_header_yield():
    """El vidrio ligero (.glass.lite) se vuelve opaco con data-glass=off, Aumentar contraste y Reducir transparencia, en
    claro y oscuro; y la cabecera va sin desenfoque en la granja y durante una partida."""
    probs = []
    for scheme, solid in (("light", "rgb(255, 255, 255)"), ("dark", "rgb(44, 44, 46)")):
        page = C.new_page("phone", color_scheme=scheme)
        try:
            C.seed(page)
            page.evaluate("""() => { const d = document.createElement("div"); d.className = "glass lite"; d.id = "t-lite";
              d.textContent = "Regar"; d.style.cssText = "position:fixed;left:20px;top:200px;padding:12px"; document.body.appendChild(d); }""")
            look = "() => { const cs = getComputedStyle(document.getElementById('t-lite')); return [cs.backgroundColor, cs.backdropFilter]; }"
            base = page.evaluate(look)
            if base[1] != "none" or base[0] == solid:
                probs.append(f"{scheme}: .glass.lite sin más tendría que ser translúcido y sin desenfoque: {base}")
            for attr in ("glass=off", "contrast=more"):
                k, v = attr.split("=")
                page.evaluate("([k, v]) => { document.documentElement.dataset[k] = v; }", [k, v])
                got = page.evaluate(look)
                page.evaluate("k => { delete document.documentElement.dataset[k]; }", k)
                if got[0] != solid or got[1] != "none":
                    probs.append(f"{scheme} + data-{attr}: .glass.lite = {got} (se esperaba {solid} sin desenfoque)")
            cdp = page.context.new_cdp_session(page)
            cdp.send("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-reduced-transparency", "value": "reduce"}]})
            got = page.evaluate(look)
            cdp.send("Emulation.setEmulatedMedia", {"features": []})
            if got[0] != solid or got[1] != "none":
                probs.append(f"{scheme} + Reducir transparencia: .glass.lite = {got} (se esperaba {solid})")
            # F2: la cabecera de dos filas pasó a barras flotantes de vidrio (barra de pestañas, bandera, monedas y
            # engranaje; en modo foco, la ✕). Se mira cada superficie que se ve: con desenfoque en el camino y sin él
            # en la granja y durante una partida. La bandera va siempre sin desenfoque (como mucho 3 superficies con
            # desenfoque a la vez, plan §Rendimiento: la barra de pestañas, el grupo de las monedas y el accesorio)
            hdr = """() => ['#tabbar', '#lang-b', '.tb-group', '#fx-x'].map(s => document.querySelector(s))
              .filter(el => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
              .map(el => [el.id || el.className, getComputedStyle(el).backdropFilter])"""
            C.goto(page, "#/mapa")
            got = page.evaluate(hdr)
            if len(got) < 3 or any(b == "none" for n, b in got if n != "lang-b"):
                probs.append(f"{scheme}: en el camino las barras deberían llevar vidrio con desenfoque: {got}")
            C.goto(page, "#/granja")
            got = page.evaluate(hdr)
            if not got or any(b != "none" for _, b in got):
                probs.append(f"{scheme}: en la granja las barras siguen con desenfoque: {got}")
            C.goto(page, "#/juegos/lluvia")
            page.locator(".gm-go").click(force=True)
            page.wait_for_function("() => !!document.documentElement.dataset.gmPlay", timeout=5000)
            got = page.evaluate(hdr)
            if not got or any(b != "none" for _, b in got):
                probs.append(f"{scheme}: durante la partida las barras siguen con desenfoque: {got}")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "vidrio ligero:\n  " + "\n  ".join(probs)


_GHOST_SETUP = """() => {
  const host = document.createElement("div"); host.id = "t-host";
  host.style.cssText = "position:fixed;left:40px;top:300px;width:300px;height:160px;background:#ddd;z-index:99";
  const btn = document.createElement("button"); btn.id = "t-btn"; btn.textContent = "Continuar";
  btn.style.cssText = "position:fixed;left:60px;top:520px;width:140px;height:48px;z-index:99";
  const cb = document.createElement("input"); cb.type = "checkbox"; cb.id = "t-cb"; cb.style.cssText = "position:fixed;left:60px;top:600px;z-index:99";
  document.body.append(host, btn, cb);
  window.__log = [];
  btn.addEventListener("click", () => __log.push("btn"));
  host.addEventListener("click", () => __log.push("host"));
  G.swipe(host, {onLeft: () => { __log.push("left"); btn.click(); cb.click(); __log.push("cb " + cb.checked); },
                 onRight: () => { __log.push("right"); setTimeout(() => btn.click(), 100); }});
  G.hold(host, {onHold: () => __log.push("hold"), onRelease: () => { __log.push("release"); btn.click(); }});
}"""


def test_ghost_click_only_real():
    """Tras deslizar o mantener, G se traga solo el clic fantasma que genera el navegador donde acabó el gesto: un
    el.click() del propio código (p. ej. «deslizar = Continuar», también un poco después) y un toque normal siempre llegan."""
    probs = []
    page = C.new_page("phone")
    try:
        C.goto(page, "")
        page.evaluate(_GHOST_SETUP)
        cdp = page.context.new_cdp_session(page)

        def touch(kind, pts):
            cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": pts})

        def swipe(x0, dx):
            touch("touchStart", [{"x": x0, "y": 380}])
            for i in range(1, 11):
                touch("touchMove", [{"x": x0 + i * dx / 10, "y": 380}])
                page.wait_for_timeout(16)
            touch("touchEnd", [])
            page.wait_for_timeout(450)

        def take():
            return page.evaluate("() => __log.splice(0)")

        swipe(300, -200)
        got = take()
        if got != ["left", "btn", "cb true"]:
            probs.append(f"dedo: deslizar a la izquierda con btn.click() y cb.click() dentro: {got}")
        swipe(80, 200)
        got = take()
        if got != ["right", "btn"]:
            probs.append(f"dedo: deslizar a la derecha con btn.click() 100 ms después: {got}")
        touch("touchStart", [{"x": 200, "y": 380}])
        page.wait_for_timeout(700)
        touch("touchEnd", [])
        page.wait_for_timeout(450)
        got = take()
        if got != ["hold", "release", "btn"]:
            probs.append(f"dedo: mantener con btn.click() al soltar (y sin clic en la superficie): {got}")
        page.locator("#t-btn").tap()
        page.wait_for_timeout(100)
        got = take()
        if got != ["btn"]:
            probs.append(f"dedo: un toque normal después: {got}")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = C.new_page("desk")
    try:
        C.goto(page, "")
        page.evaluate(_GHOST_SETUP)
        page.mouse.move(300, 380)
        page.mouse.down()
        for i in range(1, 11):
            page.mouse.move(300 - i * 20, 380)
            page.wait_for_timeout(16)
        page.mouse.up()
        page.wait_for_timeout(450)
        got = page.evaluate("() => __log.splice(0)")
        if got != ["left", "btn", "cb true"]:
            probs.append(f"ratón: deslizar (el clic del ratón al soltar se traga, los del código no): {got}")
        page.mouse.click(130, 544)
        page.wait_for_timeout(100)
        got = page.evaluate("() => __log.splice(0)")
        if got != ["btn"]:
            probs.append(f"ratón: un clic normal después: {got}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "clic fantasma:\n  " + "\n  ".join(probs)


def test_icons_in_sprite():
    """Cada ico("nombre", "estilo") del código tiene su <symbol id="i-nombre-estilo"> en el sprite; si se pide un estilo
    que no está, ico() usa el otro, y si falta el icono avisa en la consola (nunca un botón sin icono en silencio)."""
    html = (C.ROOT / "index.html").read_text(encoding="utf-8")
    ids = set(re.findall(r'<symbol id="i-([\w-]+)"', html))
    missing = []
    for f in [C.ROOT / "index.html", *sorted((C.ROOT / "js").glob("*.js"))]:
        for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            for m in re.finditer(r"""\bico\(\s*["']([\w-]+)["']\s*(?:,\s*["'](\w+)["'])?""", line):
                k = f"{m.group(1)}-{m.group(2) or 'bold'}"
                if k not in ids:
                    missing.append(f"{f.name}:{i}: i-{k}")
    assert not missing, "iconos que no están en el sprite:\n  " + "\n  ".join(missing)
    page = C.new_page("desk")
    warns = []
    page.on("console", lambda m: warns.append(m.text) if m.type == "warning" else None)
    try:
        C.goto(page, "")
        got = page.evaluate("""() => [ico("x", "fill"), ico("trophy", "bold"), ico("no-existe")]
          .map(s => /href="#([\\w-]+)"/.exec(s)[1])""")
        errs = C.errors(page)
    finally:
        page.context.close()
    assert got[:2] == ["i-x-bold", "i-trophy-bold"], f"ico() no cambia al estilo que hay: {got}"
    assert any("no-existe" in w for w in warns), f"ico() no avisa de un icono que falta: {warns}"
    assert not errs, "errores:\n  " + "\n  ".join(errs)


def test_failure_gray_and_silent():
    """Fallar es gris y callado: el bus «answer» con ok:false no suena; los puntos de fallo, la comida equivocada, el
    globo del zorro y la lista de falladas no son dorados; y no queda ningún sonido «bad» ni temblor de fallo en el código."""
    src = {f.name: f.read_text(encoding="utf-8") for f in [C.ROOT / "index.html", *sorted((C.ROOT / "js").glob("*.js"))]}
    calls = [f"{n}: {m.group(0)}" for n, t in src.items() for m in re.finditer(r"""\b(?:snd|play)\(\s*["']bad["']\s*\)""", t)]
    assert not calls, "sonidos de fallo que quedan:\n  " + "\n  ".join(calls)
    assert "gm-shake" not in src["games.js"], "games.js todavía hace temblar las opciones falladas (gm-shake)"
    page = C.new_page("phone")
    try:
        C.seed(page)
        C.goto(page, "#/juegos")
        C.goto(page, "#/granja")
        page.evaluate("""() => { window.__snd = []; const p = sfx.play; sfx.play = n => { __snd.push(n); return p.call(sfx, n); }; }""")
        page.evaluate("""() => { bus.emit("answer", {ok: false, where: "lesson"}); bus.emit("answer", {ok: true, where: "lesson"}); }""")
        snd = page.evaluate("() => __snd.slice()")
        cols = page.evaluate("""() => {
          const box = document.createElement("div"); box.style.cssText = "position:fixed;left:0;top:0;width:300px";
          box.innerHTML = `<div class="gm-dots"><i class="meh" id="t1"></i></div><button class="fm-food bad" id="t2">x</button>
            <div class="bd-say bad" id="t3">x</div><div class="gm-wc gm-miss" id="t4">x</div>`;
          document.body.appendChild(box);
          const cs = id => getComputedStyle(document.getElementById(id));
          return {"puntos": cs("t1").backgroundColor, "comida (borde)": cs("t2").borderTopColor,
                  "comida (fondo)": cs("t2").backgroundColor, "zorro": cs("t3").borderTopColor, "falladas": cs("t4").borderTopColor};
        }""")
        errs = C.errors(page)
    finally:
        page.context.close()
    assert snd == ["ok"], f"al fallar en una lección no debe sonar nada (y al acertar «ok»): {snd}"

    def golden(c):
        m = [float(x) for x in re.findall(r"[\d.]+", c)[:3]]
        mx, mn = max(m), min(m)
        sat = (mx - mn) / mx if mx else 0
        return sat > .35 and m[0] > m[2] + 40 and m[1] > m[2] + 30      # amarillo u oro
    gold = {k: v for k, v in cols.items() if golden(v)}
    assert not gold, f"estados de fallo en dorado (tienen que ser grises): {gold}"
    assert not errs, "errores:\n  " + "\n  ".join(errs)


def test_type_caps_and_capsules_fit():
    """Con el texto más grande de iOS (base 23 px) la palabra de la lección no se sale de su tarjeta y los títulos tienen
    tope; las cápsulas «Conseguir · 40» caben en una línea en una tarjeta estrecha."""
    page = C.new_page("phone")
    try:
        C.goto(page, "")
        r = page.evaluate("""() => {
          const root = document.documentElement; root.style.fontSize = "23px"; root.style.setProperty("--k", ".9412");
          const box = document.createElement("div"); box.style.cssText = "position:fixed;left:16px;top:80px;width:358px;z-index:99";
          box.innerHTML = `<div class="card" style="padding:16px"><div class="t-word" id="t-w" lang="en-GB">grandmother</div>
              <div class="t-lt" id="t-lt">Hoy</div></div>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(150px,1fr));gap:12px;margin-top:12px">
              <div class="card" style="padding:12px"><button class="btn-fill btn-fill--gold" id="t-b1">${ico("coin", "fill", 20)} Conseguir · 40</button></div>
              <div class="card" style="padding:12px"><button class="glass-btn glass-btn--sm" id="t-b2">Conseguir · 140</button></div></div>`;
          document.body.appendChild(box);
          const w = document.getElementById("t-w"), cs = id => getComputedStyle(document.getElementById(id));
          const out = {word: [w.scrollWidth, w.clientWidth, parseFloat(cs("t-w").fontSize)], lt: parseFloat(cs("t-lt").fontSize),
                       b1: document.getElementById("t-b1").getBoundingClientRect().height, b2: document.getElementById("t-b2").getBoundingClientRect().height};
          root.style.fontSize = ""; root.style.removeProperty("--k");
          return out;
        }""")
        errs = C.errors(page)
    finally:
        page.context.close()
    assert r["word"][0] <= r["word"][1], f"la palabra se sale de la tarjeta: {r['word']}"
    assert r["word"][2] <= 56 and r["lt"] <= 48, f"los títulos no tienen tope: palabra {r['word'][2]} px, título {r['lt']} px"
    assert r["b1"] <= 46 and r["b2"] <= 46, f"las cápsulas se parten en dos líneas: {r['b1']} px y {r['b2']} px de alto"
    assert not errs, "errores:\n  " + "\n  ".join(errs)
