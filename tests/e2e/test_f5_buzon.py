"""F5c (SPEC §5-F, ideas-viabilidad fila 6, plan A sin Drive): el «Buzón del tío» (js/mailbox.js).

#/buzon: 4 frases con dibujo y su voz, el botón grande de grabar (MediaRecorder, audio/mp4 si se puede; 20 s como mucho
con un anillo), «Escucharme», «Otra vez» y «Mandar» (Web Share con el archivo o descarga, y el texto con el enlace para
contestar). Antes de pedir el micrófono, una frase dice para qué; sin micrófono o con el permiso denegado, una frase
amable. Las grabaciones viven en IndexedDB "vocab-media-user" (las 5 últimas; nunca en la partida). #/buzon/responder
pide la Puerta de mayores y crea el enlace #/carta?d=<base64url del JSON> con un regalo (20 o 50 monedas, o un adorno de
la granja) o un candado. #/carta?d=… valida y limpia, guarda en "mail:box" y quita ?d=; al abrir, la voz lee el mensaje y
luego sale el regalo, una sola vez por carta (recargar, reabrir el enlace u otro aparato sincronizado no dan nada). Los
valores fuera de lista, el <script> y el base64 roto no rompen ni dan nada. El candado se abre al cumplirse. En Hoy, la
fila del sobre (tiembla 3 veces) y Hoy sigue sin scroll. En Para mayores, «Contestar una carta del Buzón» y «Borrar
grabaciones y fotos». Sin errores de consola y la partida exportada como la base (salvo mail:box).

Micrófono y grabadora simulados en Chromium (getUserMedia y MediaRecorder de mentira, con window.__mic = "ok" | "deny" |
"none"); la voz del navegador, también (window.__said)."""
from __future__ import annotations

import base64
import json
import re

import common as C
import routes as R

OUT = C.CAPTURAS / "F5"
_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
_PASS = "() => sessionStorage.setItem('vocab:gate', String(Date.now() + adultGate.MS))"

# micrófono, grabadora, voz y audio de mentira (antes de que arranque la app)
_MOCK = r"""
(() => {
  window.__gum = 0; window.__recs = 0; window.__said = []; window.__played = 0; window.__stopped = 0;
  const mode = () => { try { return sessionStorage.getItem('__mic') || 'ok'; } catch (e) { return 'ok'; } };
  const stream = () => { const tr = {kind: 'audio', stop() { window.__stopped++; }}; return {getTracks: () => [tr], getAudioTracks: () => [tr]}; };
  Object.defineProperty(navigator, 'mediaDevices', {configurable: true, value: {getUserMedia() {
    window.__gum++;
    const m = mode();
    if (m === 'deny') return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    if (m === 'none') return Promise.reject(new DOMException('Requested device not found', 'NotFoundError'));
    return Promise.resolve(stream());
  }}});
  class FakeMR {
    constructor(s, o) { this.stream = s; this.mimeType = (o && o.mimeType) || 'audio/webm'; this.state = 'inactive'; window.__mr = this; window.__mrType = this.mimeType; }
    static isTypeSupported(t) { return /^audio\/(mp4|webm)(;codecs=opus)?$/.test(t); }
    start() { this.state = 'recording'; window.__recs++; }
    stop() {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      const b = new Blob([new Uint8Array(3000).fill(7)], {type: this.mimeType});
      setTimeout(() => { if (this.ondataavailable) this.ondataavailable({data: b}); if (this.onstop) this.onstop(); }, 10);
    }
    requestData() {} pause() {} resume() {}
  }
  window.MediaRecorder = FakeMR;
  HTMLMediaElement.prototype.play = function () { window.__played++; window.__playSrc = this.src;
    setTimeout(() => this.dispatchEvent(new Event('ended')), 60); return Promise.resolve(); };
  if (window.speechSynthesis) {
    speechSynthesis.speak = u => { window.__said.push({t: u.text, l: u.lang}); setTimeout(() => { if (u.onend) u.onend({}); }, 40); };
    speechSynthesis.cancel = () => {};
  }
})();
"""
_SHARE = r"""
(() => {
  window.__shared = [];
  navigator.canShare = d => !!(d && d.files && d.files.length);
  navigator.share = d => { window.__shared.push({text: d.text, title: d.title, url: d.url,
    files: (d.files || []).map(f => ({name: f.name, type: f.type, size: f.size, file: f instanceof File}))}); return Promise.resolve(); };
})();
"""
_IDB = "async () => (await vocabMedia.list('mail')).map(r => ({id: r.id, dur: r.dur, type: r.type, size: r.buf.byteLength, kind: r.kind, sent: !!r.sent}))"
_BOX = "() => JSON.parse(localStorage.getItem('mail:box') || 'null')"
_COINS = "() => game().coins"
_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""


def _page(kind="phone", share=False, mic="ok", **kw):
    page = C.new_page(kind, **kw)
    page.context.add_init_script(_MOCK)
    if share:
        page.context.add_init_script(_SHARE)
    page._mic = mic
    return page


def _seed(page, hash="#/buzon", keys=None):
    C.seed(page, keys=keys, hash="")
    page.evaluate("m => sessionStorage.setItem('__mic', m)", page._mic)
    C.goto(page, hash)
    page.wait_for_timeout(200)


def _b64(o) -> str:
    s = json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    return base64.urlsafe_b64encode(s.encode()).rstrip(b"=").decode()


def _unb64(d) -> dict:
    return json.loads(base64.urlsafe_b64decode(d + "=" * (-len(d) % 4)).decode())


def _letter(**kw):
    o = {"v": 1, "id": kw.pop("id", "carta000001"), "from": "Tío Juan", "msg": "Well done! I am so proud of you. Keep going!", "lang": "en"}
    o.update(kw)
    if "gift" not in o and "lock" not in o:
        o["gift"] = 20
    return o


_SLOTS = "() => [...document.querySelectorAll('#hm-slots > .hm-slot')].filter(e => !e.hidden).map(e => e.dataset.slot || '?')"
_GIFT = "() => ({own: !!game().owned.casa, coins: game().coins, b: document.getElementById('mb-gift-b').textContent, s: document.getElementById('mb-gift-s').textContent})"


def _yesterday(page):
    """El regalo de hoy pasa a ser de ayer (como si fuera otro día)."""
    page.evaluate("""() => { const b = JSON.parse(localStorage.getItem('mail:box')); b.pd = '2026-03-10';
      localStorage.setItem('mail:box', JSON.stringify(b)); }""")


def _open_link(page, d):
    """Abre #/carta?d=… como un enlace que llega de fuera: una carga entera de la página, como en una pestaña limpia
    (con la app ya abierta, page.goto a otro hash sería una navegación dentro del mismo documento: se cambia la
    dirección sin avisar a la app y se recarga)."""
    url = f"{C.base_url(page)}/#/carta?d={d}"
    if page.url.startswith(C.base_url(page)):
        page.evaluate("u => history.replaceState(null, '', u)", url)
        page.reload(wait_until="domcontentloaded")
    else:
        page.goto(url, wait_until="domcontentloaded")
    page.wait_for_function("() => (window.__vocabRouteN || 0) > 0", timeout=20000)
    C.settle(page, 250)


def _record(page, ms=2500):
    """Graba ms (con el reloj adelantado) y para con el botón; espera a «¡Muy bien!»."""
    page.locator("#mb-rb").click()
    page.wait_for_function("() => document.querySelector('#mb-rb.is-rec')", timeout=4000)
    page.clock.fast_forward(ms)
    page.locator("#mb-rb").click()
    page.wait_for_selector("#mb-send", timeout=5000)


def _gate_sum(page):
    q = page.evaluate("() => document.querySelector('#gate #gt-q b').textContent")
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


def _pass_gate(page):
    page.wait_for_selector("dialog#gate[open]", timeout=4000)
    page.wait_for_timeout(300)
    for ch in str(_gate_sum(page)):
        page.locator(f'#gt-ks .gt-k[data-k="{ch}"]').click()
    page.locator('#gt-ks .gt-k[data-k="ok"]').click()
    page.wait_for_function("() => !document.getElementById('gate').open", timeout=4000)


# ---------------------------------------------------------------- grabar
def test_record_autostop_listen_and_keep_five():
    """Antes de pedir el micrófono, la frase que dice para qué. Las 4 frases (una por tecla 1-4) cambian la frase y la
    voz la lee. Grabar pide audio/mp4, el anillo se vacía y para solo a los 20 s; queda guardada (dur 20000, audio/mp4)
    con «Escucharme» (suena), «Otra vez» (la borra y graba otra) y «Mandar». Menos de 0,8 s es «Muy cortito» y no se
    guarda. Tras 7 grabaciones quedan las 5 últimas, en «Tus grabaciones»."""
    probs = []
    page = _page()
    try:
        _seed(page)
        s = page.evaluate("""() => ({note: (document.getElementById('mb-note') || {}).textContent || '', rl: document.getElementById('mb-rl').textContent,
          phr: document.getElementById('mb-phr').textContent, tpls: [...document.querySelectorAll('.mb-tpl')].map(b => [b.dataset.key, b.getAttribute('aria-checked'), b.textContent.trim()]),
          gum: window.__gum, recs: document.getElementById('mb-recs').hidden})""")
        if "micrófono" not in s["note"] or "este aparato" not in s["note"] or s["gum"] != 0:
            probs.append(f"antes de grabar falta la frase del micrófono o ya se pidió: {s}")
        if s["phr"] != "Hello! My name is…" or [t[0] for t in s["tpls"]] != ["1", "2", "3", "4"] or s["tpls"][0][1] != "true" or not s["recs"]:
            probs.append(f"frases para empezar: {s}")
        page.locator('.mb-tpl[data-tpl="color"]').click()
        page.wait_for_timeout(150)
        said = page.evaluate("() => window.__said.map(x => x.t)")
        if page.locator("#mb-phr").text_content() != "My favourite colour is…" or "My favourite colour is…" not in said:
            probs.append(f"elegir «Mi color» no cambia la frase o no la lee: {said}")
        page.locator("#mb-spk").click()
        page.locator("#mb-rb").click()
        # 3 · 2 · 1 antes de grabar (para que no se pierda el principio)
        page.wait_for_function("() => document.querySelector('#mb-rb.is-count')", timeout=3000)
        if page.evaluate("() => window.__recs") != 0 or page.locator("#mb-rb .mb-rb-in").text_content().strip() not in ("3", "2"):
            probs.append(f"la cuenta atrás: {page.locator('#mb-rb').text_content()!r}")
        page.wait_for_function("() => document.querySelector('#mb-rb.is-rec')", timeout=4000)
        r = page.evaluate("() => ({type: window.__mrType, gum: window.__gum, rl: document.getElementById('mb-rl').textContent, label: document.getElementById('mb-rb').getAttribute('aria-label')})")
        if r["type"] != "audio/mp4" or r["gum"] != 1 or "quedan 20 s" not in r["rl"] or r["label"] != "Parar la grabación":
            probs.append(f"al grabar: {r}")
        # grabando, las frases y su altavoz no se tocan (su voz se colaría en el mensaje)
        n0 = page.evaluate("() => window.__said.length")
        dis = page.evaluate("() => [...document.querySelectorAll('.mb-tpl, #mb-spk')].map(b => b.getAttribute('aria-disabled'))")
        page.locator('.mb-tpl[data-tpl="animal"]').click(force=True)
        page.locator("#mb-spk").click(force=True)
        page.keyboard.press("1")
        page.wait_for_timeout(150)
        if set(dis) != {"true"} or page.evaluate("() => window.__said.length") != n0 or page.locator("#mb-phr").text_content() != "My favourite colour is…" \
                or not page.locator("#mb-rb.is-rec").count():
            probs.append(f"grabando se puede cambiar o leer la frase: {dis}")
        page.clock.fast_forward(10000)
        page.wait_for_timeout(150)
        mid = page.evaluate("() => ({rl: document.getElementById('mb-rl').textContent, ring: +document.getElementById('mb-ring-fg').getAttribute('stroke-dasharray').split(' ')[0]})")
        if not re.search(r"quedan (9|10|11) s", mid["rl"]) or not 40 <= mid["ring"] <= 60:
            probs.append(f"a los 10 s: {mid}")
        page.clock.fast_forward(10500)   # pasa de los 20 s: para sola
        page.wait_for_selector("#mb-send", timeout=5000)
        if page.evaluate("async () => (await vocabMedia.list('mail'))[0].tpl") != "color":
            probs.append("la grabación no guarda la frase con la que empezó")
        if page.evaluate("() => [...document.querySelectorAll('.mb-tpl, #mb-spk')].some(b => b.hasAttribute('aria-disabled'))"):
            probs.append("tras grabar, las frases siguen sin poder tocarse")
        idb = page.evaluate(_IDB)
        if len(idb) != 1 or idb[0]["dur"] != 20000 or idb[0]["type"] != "audio/mp4" or idb[0]["size"] != 3000 or idb[0]["kind"] != "mail":
            probs.append(f"la grabación de 20 s no se guardó bien: {idb}")
        if page.evaluate("() => window.__mr.state") != "inactive" or page.evaluate("() => window.__stopped") < 1:
            probs.append("a los 20 s la grabadora o el micrófono siguen encendidos")
        ok = page.evaluate("() => document.querySelector('#mb-ctl .mb-ok').textContent")
        if "Muy bien" not in ok:
            probs.append(f"tras grabar: {ok!r}")
        page.locator("#mb-play").click()
        page.wait_for_function("() => window.__played === 1", timeout=3000)
        if not page.evaluate("() => window.__playSrc.startsWith('blob:')"):
            probs.append("«Escucharme» no suena la grabación")
        # «Otra vez»: la borra y vuelve a grabar
        page.locator("#mb-again").click()
        page.wait_for_function("() => document.querySelector('#mb-rb.is-rec')", timeout=4000)
        page.clock.fast_forward(3000)
        page.locator("#mb-rb").click()
        page.wait_for_selector("#mb-send", timeout=5000)
        idb2 = page.evaluate(_IDB)
        if len(idb2) != 1 or idb2[0]["id"] == idb[0]["id"] or not 3000 <= idb2[0]["dur"] <= 3800:
            probs.append(f"«Otra vez» no borra la anterior: {idb2}")
        # muy cortita: no se guarda
        page.locator("#mb-new").click() if page.locator("#mb-new").count() else None
        page.evaluate("() => { vocabMailbox; }")
        C.goto(page, "#/juegos")
        C.goto(page, "#/buzon")
        page.locator("#mb-rb").click()
        page.wait_for_function("() => document.querySelector('#mb-rb.is-rec')", timeout=4000)
        page.locator("#mb-rb").click()
        page.wait_for_function("() => /cortito/.test(document.getElementById('mb-rl').textContent)", timeout=4000)
        if len(page.evaluate(_IDB)) != 1:
            probs.append("una grabación de menos de 0,8 s se guardó")
        for _ in range(6):
            if page.locator("#mb-new").count():
                page.locator("#mb-new").click()
            if page.locator("#mb-again").count():
                C.goto(page, "#/juegos")
                C.goto(page, "#/buzon")
            _record(page, 1500)
        idb3 = page.evaluate(_IDB)
        rows = page.locator("#mb-recs-l .mb-rr").count()
        if len(idb3) != 5 or rows != 5 or page.locator("#mb-recs").is_hidden():
            probs.append(f"tras 7 grabaciones: {len(idb3)} en IndexedDB y {rows} filas (se esperaban 5)")
        if any(x["id"] == idb2[0]["id"] for x in idb3):
            probs.append("la más vieja no se borró")
        page.locator("#mb-recs-l .mb-rr [data-play]").first.click()
        page.wait_for_function("() => window.__played >= 2", timeout=3000)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_no_mic_and_denied_are_kind():
    """Sin micrófono o con el permiso denegado: una frase amable (sin rojo), «Probar otra vez», y nada se rompe. Sin
    MediaRecorder: «Este aparato no puede grabar» y las frases se siguen oyendo."""
    probs = []
    for mic, want in (("deny", "apagado para esta web"), ("none", "No encuentro ningún micrófono")):
        page = _page(mic=mic)
        try:
            _seed(page)
            page.locator("#mb-rb").click()
            page.wait_for_selector("#mb-ctl .mb-info", timeout=4000)
            t = page.evaluate("() => { const i = document.querySelector('#mb-ctl .mb-info'); return {t: i.textContent, c: getComputedStyle(i).color, retry: !!document.getElementById('mb-retry')}; }")
            if want not in t["t"] or not t["retry"]:
                probs.append(f"{mic}: {t}")
            r, g, b = (int(x) for x in re.findall(r"\d+", t["c"])[:3])
            if r > g + 40:
                probs.append(f"{mic}: el aviso es rojo: {t['c']}")
            page.locator("#mb-retry").click()
            page.wait_for_selector("#mb-ctl .mb-info", timeout=4000)
            if page.evaluate("() => window.__gum") != 2:
                probs.append(f"{mic}: «Probar otra vez» no vuelve a pedirlo")
            probs += [f"{mic}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    page = C.new_page("phone")
    try:
        page.context.add_init_script("() => {}")
        page.context.add_init_script("Object.defineProperty(window, 'MediaRecorder', {configurable: true, value: undefined});")
        C.seed(page, hash="#/buzon")
        t = page.locator("#mb-ctl").text_content()
        if "no puede grabar" not in t or page.locator("#mb-rb").count():
            probs.append(f"sin MediaRecorder: {t!r}")
        page.locator("#mb-spk").click()
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- mandar
def test_send_shares_file_with_reply_link_or_downloads():
    """«Mandar» abre otra app, así que antes pide la Puerta de mayores (se recuerda 5 minutos: la segunda vez manda al
    momento). Con Web Share de archivos: navigator.share con un File audio/mp4 (.m4a) y el texto «Un mensaje de <nombre>
    desde la app Vocabulary… #/buzon/responder?l=en&n=<nombre>»; queda «¡Mensaje listo!». Sin Web Share: se descarga el
    archivo y una hoja da el mismo texto con «Copiar el texto». Desde «Tus grabaciones», igual."""
    probs = []
    page = _page(share=True)
    try:
        keys = C.seed_keys()
        g = json.loads(keys["game"]); g["name"] = "Lucía"; keys["game"] = json.dumps(g)
        _seed(page, keys=keys)
        _record(page)
        page.locator("#mb-send").click()
        page.wait_for_selector("dialog#gate[open]", timeout=4000)
        if page.evaluate("() => window.__shared.length"):
            probs.append("comparte antes de la Puerta")
        _pass_gate(page)
        page.wait_for_function("() => window.__shared.length === 1", timeout=3000)
        s = page.evaluate("() => window.__shared[0]")
        f = (s.get("files") or [{}])[0]
        if not f.get("file") or f.get("type") != "audio/mp4" or not f.get("name", "").endswith(".m4a") or f.get("size") != 3000:
            probs.append(f"el archivo compartido: {s}")
        base = C.base_url(page)
        want = f"Un mensaje de Lucía desde la app Vocabulary. Para contestar con una carta, abre: {base}/#/buzon/responder?l=en&n=Luc%C3%ADa"
        if s.get("text") != want:
            probs.append(f"texto compartido: {s.get('text')!r} (se esperaba {want!r})")
        page.wait_for_function("() => /Mensaje listo/.test(document.getElementById('mb-ctl').textContent)", timeout=3000)
        if not page.evaluate(_IDB)[0]["sent"]:
            probs.append("la grabación mandada no queda marcada")
        page.locator("#mb-recs-l .mb-rr [data-send]").first.click()
        page.wait_for_function("() => window.__shared.length === 2", timeout=3000)
        if page.evaluate("() => !!(document.getElementById('gate') || {}).open"):
            probs.append("la segunda vez (antes de 5 minutos) vuelve a pedir la Puerta")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = _page()
    try:
        _seed(page)
        _record(page)
        with page.expect_download(timeout=8000) as dl:
            page.locator("#mb-send").click()
            _pass_gate(page)
        name = dl.value.suggested_filename
        if not re.match(r"mensaje-\d{4}-\d{2}-\d{2}-\d{4}\.m4a$", name):
            probs.append(f"descarga: {name!r}")
        page.wait_for_selector("dialog#mb-tx-s[open]", timeout=3000)
        t = page.evaluate("() => document.getElementById('mb-tx').value")
        if not t.startswith("Un mensaje desde la app Vocabulary.") or not t.endswith("#/buzon/responder?l=en"):
            probs.append(f"texto de la hoja: {t!r}")
        page.locator("#mb-tx-c").click()
        page.wait_for_function("() => document.getElementById('mb-tx-m').textContent.length > 0", timeout=3000)
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.getElementById('mb-tx-s').open", timeout=3000)
        with page.expect_download(timeout=5000):
            page.locator("#mb-recs-l .mb-rr [data-send]").first.click()
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- contestar
def _make_res(page):
    """«Crear el enlace» y espera la hoja «¡Carta lista!»; devuelve el JSON de la carta."""
    page.locator("#mb-make").click()
    page.wait_for_selector("dialog#mb-res[open]", timeout=4000)
    return _unb64(page.locator("#mb-link").input_value().split("?d=")[1])


def _pick(page, value):
    """La fila «Regalo ›» o «Candado ›» abre su hoja; tocar una opción la elige y la cierra."""
    page.locator("#mb-pick").click()
    page.wait_for_selector("dialog#mb-pick-s[open]", timeout=3000)
    page.locator(f'#mb-pick-s .mb-opt:has(input[value="{value}"])').click()
    page.wait_for_function("() => !document.getElementById('mb-pick-s').open", timeout=3000)


def _res_closed(page):
    return page.evaluate("() => !(document.getElementById('mb-res') || {}).open")


def test_reply_needs_the_gate_and_makes_the_link():
    """El enlace de «Mandar» (#/buzon/responder?l=fr&n=Lucía) enseña «Para mayores» con «Lucía te ha mandado un audio en
    francés…» y «Soy mayor» abre la Puerta, siempre con una cuenta nueva (aunque se recuerde de otra cosa); «Cancelar» la
    cierra y sigue sin formulario. Pasada la Puerta, el formulario trae «Para: Lucía» y el francés. Sin nombre o sin
    mensaje, aviso gris con ✗ y no hay enlace; en la hoja del regalo, tocar una opción (también la que ya estaba
    elegida) la cierra; con todo, «Crear el enlace» abre «¡Carta lista!» (lo que lleva, no el
    enlace) con <app>#/carta?d=<base64url> cuyo JSON es {v: 1, id (12), from, to, msg, lang, gift}. La Puerta de entrar
    vale para una carta con regalo: la siguiente con regalo la vuelve a pedir; con candado, no. Desde Para mayores entra
    sin preguntar, pero el regalo sí la pide. Salir con la Puerta abierta la cierra."""
    probs = []
    page = _page()
    try:
        _seed(page, "#/buzon/responder?l=fr&n=Luc%C3%ADa")
        page.wait_for_selector("#mb-gate-go", timeout=4000)
        who = page.locator("#mb-gate [data-t=who]").text_content()
        if who != "Lucía te ha mandado un audio en francés. Contéstale con una carta.":
            probs.append(f"para qué es: {who!r}")
        if page.locator("#mb-form").count() or page.evaluate("() => !!(document.getElementById('gate') || {}).open"):
            probs.append("el formulario o la Puerta se ven antes de tocar «Soy mayor»")
        page.evaluate(_PASS)   # la Puerta recordada de otra cosa no vale aquí
        page.locator("#mb-gate-go").click()
        page.wait_for_selector("dialog#gate[open]", timeout=4000)
        if page.locator("#mb-form").count():
            probs.append("el formulario se ve antes de la Puerta")
        page.locator("#gt-x").click()
        page.wait_for_function("() => !document.getElementById('gate').open", timeout=3000)
        if not page.locator("#mb-gate-go").count() or page.locator("#mb-f").count():
            probs.append("tras «Cancelar» no queda «Para mayores» (o se ve el formulario)")
        page.locator("#mb-gate-go").click()
        _pass_gate(page)
        page.wait_for_selector("#mb-f", timeout=4000)
        f0 = page.evaluate("""() => ({to: document.getElementById('mb-to').value,
          l: (document.querySelector('.seg-i[data-l][aria-checked=true]') || {}).dataset.l, pick: document.getElementById('mb-pv').textContent})""")
        if f0 != {"to": "Lucía", "l": "fr", "pick": "20 monedas"}:
            probs.append(f"el formulario no trae lo del enlace: {f0}")
        page.locator("#mb-make").click()
        e = page.evaluate("""() => { const e = document.getElementById('mb-e-from'); return {hidden: e.hidden, t: e.textContent, c: getComputedStyle(e).color}; }""")
        r, g, b = (int(x) for x in re.findall(r"\d+", e["c"])[:3])
        if e["hidden"] or "✗" not in e["t"] or not _res_closed(page) or abs(r - g) > 12 or abs(g - b) > 12:
            probs.append(f"sin nombre: {e}")
        page.locator("#mb-from").fill("Tío Juan")
        page.locator("#mb-make").click()
        if page.locator("#mb-e-msg").is_hidden() or not _res_closed(page):
            probs.append("sin mensaje se crea el enlace")
        page.locator("#mb-msg").fill("¡Qué bien hablas!\nUn abrazo.")
        if page.locator("#mb-cnt").text_content() != "28 / 280":
            probs.append(f"contador: {page.locator('#mb-cnt').text_content()!r}")
        _pick(page, "50")
        if page.locator("#mb-pv").text_content() != "50 monedas":
            probs.append(f"la fila del regalo: {page.locator('#mb-pv').text_content()!r}")
        try:
            _pick(page, "50")            # tocar la que ya estaba elegida también cierra la hoja
        except Exception:  # noqa: BLE001
            probs.append("tocar el regalo que ya estaba elegido no cierra la hoja")
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
        o = _make_res(page)
        if page.evaluate("() => !!(document.getElementById('gate') || {}).open"):
            probs.append("la primera carta con regalo vuelve a pedir la Puerta")
        u = page.locator("#mb-link").input_value()
        base = C.base_url(page)
        if not re.match(re.escape(base) + r"/#/carta\?d=([A-Za-z0-9_-]+)$", u):
            probs.append(f"enlace: {u!r}")
        if set(o) != {"v", "id", "from", "to", "msg", "lang", "gift"} or o["v"] != 1 or not re.match(r"^[A-Za-z0-9_-]{12}$", o["id"]) \
                or o["from"] != "Tío Juan" or o["to"] != "Lucía" or o["msg"] != "¡Qué bien hablas!\nUn abrazo." or o["lang"] != "fr" or o["gift"] != 50:
            probs.append(f"JSON del enlace: {o}")
        pre = page.evaluate("() => [...document.querySelectorAll('#mb-res .mb-pre [data-t]')].map(x => x.textContent)")
        if pre != ["Carta de Tío Juan", "Para Lucía · 50 monedas"]:
            probs.append(f"lo que lleva la carta: {pre}")
        if page.evaluate("() => document.getElementById('mb-link').getBoundingClientRect().height > 4"):
            probs.append("la hoja enseña el enlace entero")
        page.locator("#mb-copy").click()
        page.wait_for_function("() => document.getElementById('mb-cp').textContent.length > 0", timeout=3000)
        # otra con regalo: otra Puerta
        page.locator("#mb-another").click()
        page.wait_for_function("() => !document.getElementById('mb-res').open", timeout=3000)
        if page.locator("#mb-msg").input_value() != "":
            probs.append("«Escribir otra» no vacía el mensaje")
        page.locator("#mb-msg").fill("Bravo !")
        page.locator("#mb-make").click()
        _pass_gate(page)
        page.wait_for_selector("dialog#mb-res[open]", timeout=4000)
        o2 = _unb64(page.locator("#mb-link").input_value().split("?d=")[1])
        if o2.get("gift") != 50 or o2.get("id") == o.get("id"):
            probs.append(f"la segunda carta con regalo: {o2}")
        # con candado: sin Puerta
        page.locator("#mb-another").click()
        page.wait_for_function("() => !document.getElementById('mb-res').open", timeout=3000)
        page.locator('.seg-i[data-mode="lock"]').click()
        page.locator("#mb-pick").click()
        page.wait_for_selector("dialog#mb-pick-s[open]", timeout=3000)
        labels = page.evaluate("() => [...document.querySelectorAll('#mb-lock-l .mb-opt')].map(x => x.textContent.trim())")
        if labels != ["Al terminar 3 lecciones de francés", "Al repasar 30 palabras de francés", "Al practicar 3 días (no hace falta seguidos)"]:
            probs.append(f"candados: {labels}")
        page.locator('#mb-pick-s .mb-opt:has(input[value="rev30"])').click()
        page.wait_for_function("() => !document.getElementById('mb-pick-s').open", timeout=3000)
        page.locator("#mb-msg").fill("Bravo !")
        o3 = _make_res(page)
        if o3.get("lock") != "rev30" or o3.get("lang") != "fr" or "gift" in o3:
            probs.append(f"carta con candado: {o3}")
        # salir con la Puerta abierta la cierra
        C.goto(page, "#/buzon")
        C.goto(page, "#/buzon/responder")
        page.locator("#mb-gate-go").click()
        page.wait_for_selector("dialog#gate[open]", timeout=4000)
        C.goto(page, "#/juegos")
        page.wait_for_function("() => !document.getElementById('gate').open", timeout=3000)
        # desde Para mayores, sin otra pregunta (el regalo sí la pide)
        page.evaluate(_PASS)
        page.evaluate("() => openSettings('mayores')")
        page.wait_for_selector("#aj-mb-reply", timeout=5000)
        if page.locator("#aj-mb-del").is_visible():
            probs.append("sin grabaciones sale «Borrar grabaciones y fotos»")
        page.locator("#aj-mb-reply").click()
        page.wait_for_selector("#mb-f", timeout=5000)
        page.wait_for_timeout(400)
        if page.evaluate("() => document.getElementById('gate') && document.getElementById('gate').open"):
            probs.append("desde Para mayores vuelve a pedir la Puerta")
        page.locator('.seg-i[data-mode="gift"]').click()
        page.locator("#mb-msg").fill("¡Ánimo!")
        page.locator("#mb-make").click()
        _pass_gate(page)
        page.wait_for_selector("dialog#mb-res[open]", timeout=4000)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la carta
def test_link_opens_once_coins_and_decoration():
    """En una pestaña limpia, el enlace enseña el sobre cerrado y queda #/carta/<id> (sin ?d=). «Abrir la carta»: la voz
    lee el mensaje (en inglés si lo parece; si no, en español) y luego llegan las 20 monedas, una sola vez: recargar,
    volver a abrir el mismo enlace u otro aparato con la partida copiada no dan nada. Un adorno (casa) pasa a ser suyo sin
    gastar monedas, una vez; uno que ya tenía da 20 monedas a cambio. Un regalo al día: el de una carta que llega cuando
    ya se dio el de hoy espera («¡Tu regalo llega mañana!», sin fila en Hoy ese día); otro día, Hoy dice «¡Ya llegó tu
    regalo!» y al tocarla llega."""
    probs = []
    d = _b64(_letter(id="cartaMoneda1", to="Lucía"))
    page = _page()
    try:
        _seed(page, "#/")
        c0 = page.evaluate(_COINS)
        _open_link(page, d)
        v = page.evaluate("() => ({h: location.hash, t: (document.querySelector('#mb-cv .mb-t') || {}).textContent, from: (document.querySelector('#mb-cv [data-t=from]') || {}).textContent})")
        if v["h"] != "#/carta/cartaMoneda1" or v["t"] != "¡Tienes carta!" or v["from"] != "Tío Juan":
            probs.append(f"al llegar: {v}")
        box = page.evaluate(_BOX)
        if not box or [x["id"] for x in box["l"]] != ["cartaMoneda1"] or box["l"][0]["o"] or box["paid"]:
            probs.append(f"mail:box al llegar: {box}")
        if page.evaluate(_COINS) != c0:
            probs.append("dio monedas sin abrir la carta")
        page.locator("#mb-open").click()
        page.wait_for_selector("#mb-ov .mb-msg", timeout=4000)
        page.wait_for_selector("#mb-gift:not([hidden])", timeout=8000)
        page.wait_for_timeout(300)
        said = page.evaluate("() => window.__said")
        if not any(x["t"] == "Well done! I am so proud of you. Keep going!" and x["l"] == "en-GB" for x in said):
            probs.append(f"la voz no lee el mensaje en inglés: {said}")
        g = page.evaluate("() => ({b: document.getElementById('mb-gift-b').textContent, msg: document.querySelector('.mb-msg').textContent, to: document.querySelector('.mb-to').textContent})")
        if g["b"] != "¡20 monedas!" or g["to"] != "Para Lucía":
            probs.append(f"carta abierta: {g}")
        c1 = page.evaluate(_COINS)
        if c1 != c0 + 20:
            probs.append(f"monedas: {c0} → {c1} (se esperaban +20)")
        C.reload(page)
        page.wait_for_selector("#mb-ov .mb-msg", timeout=4000)
        _open_link(page, d)
        C.goto(page, "#/buzon")
        if page.evaluate(_COINS) != c1:
            probs.append(f"recargar o reabrir el enlace da más monedas: {page.evaluate(_COINS)}")
        box = page.evaluate(_BOX)
        if len(box["l"]) != 1 or box["paid"] != ["cartaMoneda1"] or not box["l"][0]["o"]:
            probs.append(f"mail:box tras abrir: {box}")
        lets = page.evaluate("() => [...document.querySelectorAll('#mb-lets-l .mb-lr')].map(a => a.textContent.replace(/\\s+/g, ' ').trim())")
        if len(lets) != 1 or "Tío Juan" not in lets[0] or "Abierta" not in lets[0]:
            probs.append(f"la lista de cartas: {lets}")
        snap = C.storage(page)
        # adorno el mismo día: llega con su mensaje y el regalo espera a otro día
        page.evaluate("() => window.__said.length = 0")
        casa = _b64(_letter(id="cartaAdorno1", gift="casa", msg="¡Una casa para tu granja!"))
        _open_link(page, casa)
        page.locator("#mb-open").click()
        page.wait_for_selector("#mb-gift:not([hidden])", timeout=8000)
        page.wait_for_timeout(300)
        said = page.evaluate("() => window.__said")
        if not any(x["t"] == "¡Una casa para tu granja!" and x["l"] == "es-ES" for x in said):
            probs.append(f"un mensaje en español no se lee en español: {said}")
        a = page.evaluate(_GIFT)
        if a["own"] or a["coins"] != c1 or a["b"] != "¡Tu regalo llega mañana!" or a["s"] != "Hoy ya te llegó un regalo. Mañana abre esta carta otra vez.":
            probs.append(f"segundo regalo el mismo día: {a}")
        C.goto(page, "#/", reload=True)
        if page.locator("#hm-slots [data-slot=mail]").count():
            probs.append("el regalo que espera sale en Hoy el mismo día")
        _yesterday(page)
        C.goto(page, "#/", reload=True)
        row = page.evaluate("() => (document.querySelector('#hm-slots [data-slot=mail] .hm-rt') || {}).textContent || ''")
        if "¡Ya llegó tu regalo!" not in row:
            probs.append(f"otro día, Hoy: {row!r}")
        else:
            page.locator("#hm-slots [data-slot=mail] a").click()
            page.wait_for_selector("#mb-gift:not([hidden])", timeout=8000)
            page.wait_for_timeout(300)
            a = page.evaluate(_GIFT)
            if not a["own"] or a["coins"] != c1 or a["b"] != "¡Es una casa para tu granja!" or a["s"] != "Ya está en tu granja.":
                probs.append(f"regalo casa otro día: {a}")
        C.reload(page)
        _open_link(page, casa)
        if page.evaluate("() => game().coins") != c1 or len(page.evaluate(_BOX)["paid"]) != 2:
            probs.append("reabrir la carta del adorno cambia algo")
        # un adorno que ya tenía: 20 monedas a cambio
        _yesterday(page)
        _open_link(page, _b64(_letter(id="cartaAdorno2", gift="flor")))
        page.locator("#mb-open").click()
        page.wait_for_selector("#mb-gift:not([hidden])", timeout=8000)
        page.wait_for_timeout(300)
        a = page.evaluate(_GIFT)
        if a["b"] != "¡Ya lo tenías! Te regala 20 monedas" or a["coins"] != c1 + 20:
            probs.append(f"adorno que ya tenía: {a}")
        probs += C.errors(page)
    finally:
        page.context.close()
    # otro aparato con la partida sincronizada (la copia de después de abrir la primera carta)
    page = _page()
    try:
        C.seed(page, keys=snap, hash="")
        c = page.evaluate(_COINS)
        _open_link(page, d)
        page.wait_for_selector("#mb-ov .mb-msg", timeout=4000)
        page.wait_for_timeout(1500)
        if page.evaluate(_COINS) != c or page.locator("#mb-open").count():
            probs.append("en otro aparato sincronizado la carta vuelve a dar monedas o sale cerrada")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


_BAD = {
    "gift 30": _letter(gift=30),
    "gift castillo (500)": _letter(gift="castillo"),
    "gift vaca (animal)": _letter(gift="vaca"),
    "gift inventado": _letter(gift="dragon"),
    "lock les10": _letter(lock="les10"),
    "gift y lock": _letter(gift=20, lock="les3"),
    "lang de": _letter(lang="de"),
    "v 2": dict(_letter(), v=2),
    "id corto": _letter(id="abc"),
    "id con <": _letter(id="abcdefgh<1"),
    "from vacío": _letter(**{"from": "   "}),
    "from de 25": _letter(**{"from": "x" * 25}),
    "to de 25": _letter(to="y" * 25),
    "msg de 281": _letter(msg="a" * 281),
    "msg vacío": _letter(msg=""),
    "msg número": _letter(msg=12),
    "gift texto 20": _letter(gift="20"),
    "__proto__": {"v": 1, "id": "carta000009", "from": "A", "msg": "m", "lang": "__proto__", "gift": 20},
}


def test_bad_links_break_nothing_and_give_nothing():
    """Valores fuera de lista, tamaños de más, base64 roto, JSON que no es una carta: «Esta carta no se puede abrir», sin
    guardar nada ni dar monedas. Un mensaje con <script> o <img onerror> se ve como texto y no ejecuta nada."""
    probs = []
    page = _page()
    try:
        _seed(page, "#/")
        c0 = page.evaluate(_COINS)
        cases = {k: _b64(v) for k, v in _BAD.items()}
        cases.update({"base64 roto": "!!!%%%", "base64 cortado": _b64(_letter())[:-7], "no es JSON": base64.urlsafe_b64encode(b"hola, no soy json").decode().rstrip("="),
                      "JSON lista": _b64([1, 2, 3]), "UTF-8 roto": base64.urlsafe_b64encode(b"\xff\xfe{\"v\":1}").decode().rstrip("="),
                      "demasiado largo": "A" * 3000, "vacío": ""})
        for name, d in cases.items():
            C.clear_errors(page)
            _open_link(page, d)
            t = page.evaluate("() => (document.querySelector('#app .mb-t') || {}).textContent || ''")
            if t != "Esta carta no se puede abrir":
                probs.append(f"{name}: {t!r}")
            if page.evaluate(_BOX) is not None or page.evaluate(_COINS) != c0:
                probs.append(f"{name}: guardó algo o dio monedas: {page.evaluate(_BOX)}")
            if "?d=" in page.evaluate("location.hash"):
                probs.append(f"{name}: ?d= sigue en la dirección")
            probs += [f"{name}: {e}" for e in C.errors(page)]
        evil = _letter(id="cartaScript1", **{"from": "<b>Tío</b>"}, to="<i>x</i>",
                       msg="<script>window.__x=1</script><img src=x onerror=\"window.__x=2\">‮olleh")
        _open_link(page, _b64(evil))
        page.locator("#mb-open").click()
        page.wait_for_selector("#mb-ov .mb-msg", timeout=4000)
        page.wait_for_timeout(1500)
        r = page.evaluate("""() => ({x: window.__x, msg: document.querySelector('.mb-msg').textContent, sig: document.querySelector('.mb-sig').textContent,
          imgs: document.querySelectorAll('#app img[src="x"], #app script, #app b:not([id]):not([data-t]), #app i:not([class])').length})""")
        if r["x"] is not None or r["imgs"] or r["msg"] != "<script>window.__x=1</script><img src=x onerror=\"window.__x=2\">olleh" or r["sig"] != "— <b>Tío</b>":
            probs.append(f"carta con <script>: {r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


_IPHONE = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 "
           "Mobile/15E148 Safari/604.1")
_WHERE = """() => ({wv: !!document.getElementById('mb-wv'), from: (document.querySelector('#mb-wv [data-t=from]') || {}).textContent,
  pri: (document.querySelector('#mb-wv .glass-btn--pri') || {}).id, box: localStorage.getItem('mail:box'), h: location.hash})"""


def test_where_to_open_on_iphone_or_new_game():
    """En Safari del iPhone (fuera de la app instalada, que no ve lo que se guarda en ella) o con una partida nueva, el
    enlace no da la carta a ciegas: «¡Tienes carta!» de quién, «¿Juegas con Vocabulary desde la pantalla de inicio?…» con
    «Copiar el enlace» y «Abrir aquí», sin guardar nada ni dar monedas. Con una partida nueva, «Copiar el enlace» va
    primero; con progreso, «Abrir aquí». «Abrir aquí» deja la carta en #/carta/<id>. «Pegar el enlace de una carta» la
    abre sin preguntar, y una carta que ya está en el buzón tampoco pregunta. Un id mal escrito (%E0%A4%A) no rompe."""
    probs = []
    d = _b64(_letter(id="cartaDonde1"))
    page = _page()
    try:
        C.seed(page, keys={}, hash="")
        _open_link(page, d)
        w = page.evaluate(_WHERE)
        if not w["wv"] or w["from"] != "Tío Juan" or w["pri"] != "mb-wv-copy" or w["box"] is not None:
            probs.append(f"partida nueva: {w}")
        page.locator("#mb-wv-copy").click()
        page.wait_for_function("() => document.getElementById('mb-wv-m').textContent.length > 0", timeout=3000)
        page.locator("#mb-wv-here").click()
        page.wait_for_selector("#mb-cv #mb-open", timeout=4000)
        page.wait_for_timeout(200)
        box = page.evaluate(_BOX)
        if page.evaluate("location.hash") != "#/carta/cartaDonde1" or not box or [x["id"] for x in box["l"]] != ["cartaDonde1"]:
            probs.append(f"«Abrir aquí»: {page.evaluate('location.hash')} · {box}")
        _open_link(page, d)   # ya está en el buzón: no pregunta
        if page.locator("#mb-wv").count() or not page.locator("#mb-cv").count():
            probs.append("una carta que ya está en el buzón vuelve a preguntar dónde abrirla")
        C.goto(page, "#/carta/%E0%A4%A")
        t = page.evaluate("() => (document.querySelector('#app .mb-t') || {}).textContent || ''")
        if t != "No encuentro esa carta":
            probs.append(f"id mal escrito: {t!r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = _page(user_agent=_IPHONE)
    try:
        _seed(page, "#/")
        c0 = page.evaluate(_COINS)
        _open_link(page, d)
        w = page.evaluate(_WHERE)
        if not w["wv"] or w["pri"] != "mb-wv-here" or w["box"] is not None or page.evaluate(_COINS) != c0:
            probs.append(f"Safari del iPhone con progreso: {w}")
        # «Pegar el enlace de una carta» no pregunta
        C.goto(page, "#/buzon")
        page.locator("#mb-paste").click()
        page.wait_for_selector("dialog#mb-paste-s[open]", timeout=3000)
        page.locator("#mb-ps-in").fill(f"{C.base_url(page)}/#/carta?d={d}")
        page.locator("#mb-ps-go").click()
        page.wait_for_selector("#mb-cv #mb-open", timeout=4000)
        if page.locator("#mb-wv").count():
            probs.append("el enlace pegado vuelve a preguntar dónde abrirla")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- candados
def test_locks_open_when_met():
    """«Al terminar 3 lecciones de inglés»: sobre con candado, la condición y 3 pasos sin hacer (cuenta desde que llegó);
    con 2 lecciones nuevas, 2 de 3 y, en Hoy, la fila del candado «Carta de Tío Juan · Con candado · 2 de 3 lecciones»
    (no la del sobre); con la 3.ª se abre: «¡Se abrió el candado!» en la carta y en Hoy, y al abrirla no da monedas.
    «30 palabras» cuenta los repasos con una barra y «3 días», los días distintos con actividad desde que llegó, aunque
    no sean seguidos."""
    probs = []
    page = _page()
    try:
        _seed(page, "#/")
        c0 = page.evaluate(_COINS)
        _open_link(page, _b64(_letter(id="cartaLecci1", lock="les3", msg="Sorpresa")))
        s = page.evaluate("""() => ({t: document.querySelector('#mb-lv .mb-lk-t').textContent, n: document.querySelector('.mb-lk-n').textContent,
          lock: !!document.querySelector('.mb-env.is-lock'), steps: document.querySelectorAll('.mb-steps li').length,
          done: document.querySelectorAll('.mb-steps li.is-done').length, go: document.querySelector('#mb-lv a.glass-btn').getAttribute('href')})""")
        if s != {"t": "Se abre al terminar 3 lecciones de inglés", "n": "0 de 3 lecciones", "lock": True, "steps": 3, "done": 0, "go": "#/mapa"}:
            probs.append(f"carta con candado: {s}")
        page.evaluate("() => { const m = JSON.parse(localStorage.getItem('map:english')); m['A1-050'] = 1; m['A1-051'] = 2; localStorage.setItem('map:english', JSON.stringify(m)); }")
        C.goto(page, "#/carta/cartaLecci1", reload=True)
        if page.locator(".mb-lk-n").text_content() != "2 de 3 lecciones":
            probs.append(f"con 2 lecciones: {page.locator('.mb-lk-n').text_content()!r}")
        if page.locator(".mb-steps li.is-done").count() != 2:
            probs.append("con 2 lecciones no hay 2 pasos hechos")
        C.goto(page, "#/")
        if page.locator("#hm-slots [data-slot=mail]").count():
            probs.append("con el candado cerrado sale el sobre en Hoy")
        lk = page.evaluate("() => { const f = HOME_SLOTS.find(f => f.id === 'mail-lock'); return f ? f() : null; }")
        if not lk or lk.get("t") != "Carta de Tío Juan" or lk.get("sub") != "Con candado · 2 de 3 lecciones" or lk.get("href") != "#/carta/cartaLecci1":
            probs.append(f"la fila del candado para Hoy: {lk}")
        row = page.evaluate("() => (document.querySelector('#hm-slots [data-slot=\"mail-lock\"]') || {}).textContent || ''")
        if "2 de 3 lecciones" not in row:
            probs.append(f"Hoy no enseña el candado pendiente: {row!r} · {page.evaluate(_SLOTS)}")
        page.evaluate("() => { const m = JSON.parse(localStorage.getItem('map:english')); m['A1-052'] = 3; localStorage.setItem('map:english', JSON.stringify(m)); }")
        C.goto(page, "#/juegos")
        C.goto(page, "#/")
        row = page.evaluate("() => (document.querySelector('#hm-slots [data-slot=mail] .hm-rt') || {}).textContent || ''")
        if "¡Se abrió el candado!" not in row:
            probs.append(f"Hoy con el candado abierto: {row!r}")
        C.goto(page, "#/carta/cartaLecci1")
        if page.locator("#mb-cv .mb-t").text_content() != "¡Se abrió el candado!":
            probs.append("la carta no se abre al cumplirse")
        page.locator("#mb-open").click()
        page.wait_for_selector("#mb-ov .mb-msg", timeout=4000)
        page.wait_for_timeout(1200)
        if page.evaluate(_COINS) != c0 or page.locator("#mb-gift").count():
            probs.append("la carta con candado da un regalo")
        # 30 palabras
        _open_link(page, _b64(_letter(id="cartaRepas1", lock="rev30")))
        if page.locator(".mb-lk-n").text_content() != "0 de 30 palabras" or page.locator(".mb-bar > i").count() != 1:
            probs.append(f"repasos al llegar: {page.locator('.mb-lk-n').text_content()!r}")
        page.evaluate("() => { const m = JSON.parse(localStorage.getItem('srs:english')); const k = Object.keys(m)[0]; m[k].n += 30; localStorage.setItem('srs:english', JSON.stringify(m)); }")
        C.goto(page, "#/carta/cartaRepas1", reload=True)
        if page.locator("#mb-open").count() != 1:
            probs.append("30 repasos no abren el candado")
        # 3 días: llegó hace 6 días y desde entonces practicó 3 días sueltos (no seguidos)
        _open_link(page, _b64(_letter(id="cartaDias01", lock="days3")))
        n0 = page.locator(".mb-lk-n").text_content()
        if n0 != "1 de 3 días" or page.locator("#mb-lv .mb-lk-t").text_content() != "Se abre cuando practiques 3 días":
            probs.append(f"días al llegar (hoy ya hay actividad): {n0!r}")
        page.evaluate("""() => { const b = JSON.parse(localStorage.getItem('mail:box')); b.l.find(x => x.id === 'cartaDias01').at = '2026-03-05';
          localStorage.setItem('mail:box', JSON.stringify(b));
          localStorage.setItem('act', JSON.stringify({'2026-03-01': 9, '2026-03-05': 4, '2026-03-08': 6, '2026-03-11': 8})); }""")
        C.goto(page, "#/carta/cartaDias01", reload=True)
        if page.locator("#mb-open").count() != 1:
            probs.append("3 días sueltos desde que llegó no abren el candado")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Hoy
def test_hoy_envelope_shakes_and_fits():
    """Con una carta sin abrir, la primera fila de Hoy es la del sobre («¡Tienes carta!», «De Tío Juan · Toca para
    abrirla»); el sobre tiembla 3 veces (con «Reducir movimiento», nada) y Hoy sigue sin scroll a 390×844. Tocarla abre la
    carta sin otro toque; luego la fila ya no sale. Sin cartas no hay fila."""
    probs = []
    for rmo in ("no-preference", "reduce"):
        page = _page(reduced_motion=rmo)
        try:
            _seed(page, "#/")
            if page.locator("#hm-slots [data-slot=mail]").count():
                probs.append(f"{rmo}: sin cartas sale la fila")
            _open_link(page, _b64(_letter(id="cartaHoy0001")))
            C.goto(page, "#/")
            page.wait_for_timeout(300)
            h = page.evaluate("""() => { const s = document.querySelector('#hm-slots > .hm-slot'), a = s && s.querySelector('a.mb-row'), img = a && a.querySelector('img');
              const an = img ? img.getAnimations().map(x => x.effect.getComputedTiming().iterations) : [];
              return {slot: s && s.dataset.slot, t: a && a.querySelector('[data-t=t]').textContent, s: a && a.querySelector('[data-t=s]').textContent, href: a && a.getAttribute('href'),
                an, sh: document.documentElement.scrollHeight, ih: innerHeight, h: a && Math.round(a.getBoundingClientRect().height)}; }""")
            want_an = [] if rmo == "reduce" else [3]
            if h["slot"] != "mail" or h["t"] != "¡Tienes carta!" or h["s"] != "De Tío Juan · Toca para abrirla" or h["href"] != "#/carta/cartaHoy0001":
                probs.append(f"{rmo}: fila del sobre: {h}")
            if h["an"] != want_an:
                probs.append(f"{rmo}: el sobre tiembla {h['an']} (se esperaba {want_an})")
            if h["sh"] > h["ih"]:
                probs.append(f"{rmo}: Hoy tiene scroll con el sobre: {h['sh']} > {h['ih']}")
            page.locator("#mb-row").click()
            page.wait_for_selector("#mb-ov .mb-msg", timeout=5000)
            page.wait_for_selector("#mb-gift:not([hidden])", timeout=8000)
            C.goto(page, "#/")
            if page.locator("#hm-slots [data-slot=mail]").count():
                probs.append(f"{rmo}: abierta la carta, sigue la fila")
            probs += [f"{rmo}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    # móvil bajo: la del sobre va antes que la de la temporada
    page = _page()
    try:
        page.set_viewport_size({"width": 390, "height": 700})
        _seed(page, "#/?season=halloween")
        _open_link(page, _b64(_letter(id="cartaHoy0002")))
        C.goto(page, "#/")
        sl = page.evaluate("() => [...document.querySelectorAll('#hm-slots > .hm-slot')].map(s => s.dataset.slot)")
        if sl[:1] != ["mail"]:
            probs.append(f"móvil bajo: filas {sl}")
        C.goto(page, "#/?season=auto")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_juegos_card_goes_to_the_mailbox():
    """En Jugar › Juegos, la tarjeta «Buzón del tío» (sin estrellas ni récord) lleva a #/buzon y dice si hay cartas
    nuevas; #/juegos/buzon también lleva allí. Las demás tarjetas siguen siendo partidas."""
    probs = []
    page = _page()
    try:
        _seed(page, "#/juegos")
        c = page.evaluate("""() => { const a = document.querySelector('.gm-card[data-g="buzon"]'); return a && {href: a.getAttribute('href'), t: a.querySelector('.gm-ct').textContent,
          rt: a.querySelector('.gm-rt').textContent, stars: a.querySelectorAll('.gm-st').length, img: a.querySelector('img').getAttribute('src'),
          others: [...document.querySelectorAll('.gm-card')].filter(x => x !== a && !x.classList.contains('gm-link')).every(x => x.getAttribute('href') === '#/juegos/' + x.dataset.g)}; }""")
        if not c or c["href"] != "#/buzon" or c["t"] != "Buzón del tío" or c["rt"] != "Graba tu voz" or c["stars"] or c["img"] != "img/games/buzon.png" or not c["others"]:
            probs.append(f"tarjeta: {c}")
        page.locator('.gm-card[data-g="buzon"]').click()
        page.wait_for_function("() => location.hash === '#/buzon' && document.getElementById('mb-home')", timeout=5000)
        if page.locator("#dv-back").text_content().strip() != "Juegos" or page.evaluate("() => document.getElementById('tab-jugar').getAttribute('aria-selected')") != "true":
            probs.append("en el Buzón la cápsula no dice «Juegos» o la pestaña Jugar no está marcada")
        _open_link(page, _b64(_letter(id="cartaJuego01")))
        if page.locator("#dv-back").text_content().strip() != "Buzón":
            probs.append(f"en la carta la cápsula dice {page.locator('#dv-back').text_content()!r}")
        C.goto(page, "#/juegos")
        if page.locator('.gm-card[data-g="buzon"] .gm-rt').text_content() != "¡1 carta nueva!":
            probs.append(f"con una carta nueva: {page.locator('.gm-card[data-g=buzon] .gm-rt').text_content()!r}")
        C.goto(page, "#/juegos/buzon")
        page.wait_for_timeout(300)
        if page.evaluate("location.hash") != "#/buzon":
            probs.append(f"#/juegos/buzon va a {page.evaluate('location.hash')}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- guardado, exportación y borrar
def test_export_idb_device_only_and_delete():
    """Mirar el Buzón, grabar, abrir la Puerta y volver a Hoy no cambia la partida exportada (igual que la base, sin
    claves nuevas): las grabaciones están en IndexedDB y no van en la exportación. Al llegar una carta, la única clave
    nueva es mail:box (tipo "o" en js/save.js). En Para mayores, «Borrar grabaciones y fotos» sale solo con grabaciones,
    pide un segundo toque y borra la base de datos entera."""
    probs = []
    base = C.load_baseline()
    assert base, "falta tests/e2e/baseline/export.json"
    page = _page()
    try:
        _seed(page)
        _record(page)
        page.locator("#mb-new").click() if page.locator("#mb-new").count() else None
        C.goto(page, "#/juegos")
        C.goto(page, "#/buzon")
        _record(page, 3000)
        C.goto(page, "#/buzon/responder")
        page.locator("#mb-gate-go").click()
        page.wait_for_selector("dialog#gate[open]", timeout=4000)
        page.keyboard.press("Escape")
        C.goto(page, "")
        snap = C.export(page)
        k = "album:uniq:english"
        keys = dict(snap["keys"]); keys[k] = base["keys"].get(k, keys.get(k))
        d = C.diff_exports(base, dict(snap, keys=keys), allow_new=False)
        if d:
            probs.append("mirar y grabar cambió la partida:\n  " + "\n  ".join(d))
        if len(page.evaluate(_IDB)) != 2:
            probs.append(f"en IndexedDB: {page.evaluate(_IDB)}")
        dbs = page.evaluate("async () => (await indexedDB.databases()).map(d => [d.name, d.version])")
        if ["vocab-media-user", 1] not in dbs:
            probs.append(f"bases de datos: {dbs}")
        if any("vocab-media" in k or "mb-" in v[:200] for k, v in snap["keys"].items()):
            probs.append("algo de las grabaciones va en la exportación")
        _open_link(page, _b64(_letter(id="cartaExport1")))
        snap2 = C.export(page)
        nk = C.new_keys(base, snap2)
        if nk != ["mail:box"] or page.evaluate("() => vocabSave.typeOf('mail:box')") != "o":
            probs.append(f"claves nuevas al llegar una carta: {nk}")
        # Para mayores › Borrar grabaciones y fotos
        page.evaluate(_PASS)
        page.evaluate("() => openSettings('mayores')")
        page.wait_for_selector("#aj-mb-del:not([hidden])", timeout=5000)
        page.wait_for_timeout(400)
        if page.locator("#aj-mb-ds").text_content() != "2 grabaciones en este aparato.":
            probs.append(f"fila de borrar: {page.locator('#aj-mb-ds').text_content()!r}")
        page.locator("#aj-mb-del").click()
        page.wait_for_timeout(500)
        if "Seguro" not in page.locator("#aj-mb-ds").text_content() or len(page.evaluate(_IDB)) != 2:
            probs.append("un solo toque ya borra (o no pide confirmación)")
        page.locator("#aj-mb-del").click()
        page.wait_for_function("() => /Hecho/.test(document.getElementById('aj-mb-ds').textContent)", timeout=5000)
        dbs = page.evaluate("async () => (await indexedDB.databases()).map(d => d.name)")
        if "vocab-media-user" in dbs:
            probs.append(f"la base de datos sigue ahí: {dbs}")
        page.evaluate("() => vocabSettings.close()")
        page.wait_for_function("() => !document.querySelector('dialog#ajustes[open]')", timeout=4000)
        C.goto(page, "#/buzon")
        page.wait_for_timeout(300)
        if page.locator("#mb-recs").is_visible() or page.evaluate(_IDB):
            probs.append("tras borrar quedan grabaciones")
        if page.evaluate(_BOX) is None:
            probs.append("borrar grabaciones borró las cartas")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_export_matches_baseline():
    """La partida sembrada, tras recorrer las pantallas del Buzón sin recibir cartas, se exporta igual que
    tests/e2e/baseline/export.json (sin claves nuevas)."""
    base = C.load_baseline()
    assert base, "falta tests/e2e/baseline/export.json"
    page = _page()
    try:
        _seed(page)
        for h in ("#/juegos", "#/buzon", "#/carta/noexiste01", "#/"):
            C.goto(page, h)
        snap = C.export(page)
        k = "album:uniq:english"
        keys = dict(snap["keys"]); keys[k] = base["keys"].get(k, keys.get(k))
        d = C.diff_exports(base, dict(snap, keys=keys), allow_new=False)
        errs = C.errors(page)
    finally:
        page.context.close()
    assert not d, "la partida cambió:\n  " + "\n  ".join(d)
    assert not errs, "errores:\n  " + "\n  ".join(errs)


# ---------------------------------------------------------------- capturas
def test_captures_and_audit():
    """Capturas en /mnt/project-files/rediseno/capturas/F5/ (F5c-*): el Buzón, grabando, grabado, «Para mayores» antes de
    la Puerta, Contestar, la carta
    cerrada, abierta con su regalo, con candado, la que no se abre y Hoy con el sobre; móvil y escritorio, claro y
    oscuro. En todas: contraste suficiente y sin colores fuera de la paleta."""
    probs = []
    for kind in ("phone", "desk"):
        for scheme in ("light", "dark"):
            tag = f"F5c-{kind}-{scheme}"
            page = _page(kind, color_scheme=scheme, reduced_motion="reduce")
            try:
                _seed(page)

                def snap(name):
                    page.evaluate(_FINISH)
                    page.wait_for_timeout(150)
                    a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
                    for x in a["contrast"] + a["palette"]:
                        probs.append(f"{tag}-{name}: {x}")
                    C.shot(page, f"{tag}-{name}", OUT, full_page=False)
                snap("buzon")
                page.locator("#mb-rb").click()
                page.wait_for_function("() => document.querySelector('#mb-rb.is-rec')", timeout=4000)
                page.clock.fast_forward(6000)
                page.wait_for_timeout(200)
                snap("grabando")
                page.locator("#mb-rb").click()
                page.wait_for_selector("#mb-send", timeout=5000)
                page.evaluate("() => scrollTo(0, 0)")
                snap("grabado")
                C.goto(page, "#/buzon/responder")
                page.wait_for_selector("#mb-gate-go", timeout=4000)
                snap("puerta")
                page.locator("#mb-gate-go").click()
                _pass_gate(page)
                page.wait_for_selector("#mb-f", timeout=4000)
                page.locator("#mb-from").fill("Tío Juan")
                page.locator("#mb-msg").fill("¡Qué bien hablas inglés! Un abrazo muy fuerte.")
                _pick(page, "casa")
                page.evaluate("() => scrollTo(0, 0)")
                snap("contestar")
                page.locator("#mb-pick").click()
                page.wait_for_selector("dialog#mb-pick-s[open]", timeout=3000)
                snap("regalos")
                page.keyboard.press("Escape")
                page.wait_for_function("() => !document.getElementById('mb-pick-s').open", timeout=3000)
                page.locator("#mb-make").click()
                page.wait_for_selector("dialog#mb-res[open]", timeout=4000)
                snap("enlace")
                _open_link(page, R.CARTA_D)
                snap("carta")
                C.goto(page, "#/")
                page.wait_for_timeout(300)
                snap("hoy")
                C.goto(page, f"#/carta/{R.CARTA['id']}")
                page.locator("#mb-open").click()
                page.wait_for_selector("#mb-gift:not([hidden])", timeout=8000)
                snap("abierta")
                page.wait_for_function("() => !document.querySelector('#m-toasts .m-toast')", timeout=10000)   # el aviso de las monedas se va
                _open_link(page, _b64(_letter(id="cartaCaptura", lock="les3", msg="Sorpresa")))
                snap("candado")
                _open_link(page, "roto")
                snap("rota")
                C.goto(page, "#/buzon")
                page.wait_for_timeout(300)
                page.evaluate("() => scrollTo(0, document.documentElement.scrollHeight)")
                snap("listas")
                probs += [f"{tag}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)
