"""Arreglos de la v24 (lo que vio el dueño en los aparatos de su sobrino):

1. La voz del navegador en Android (index.html: el envoltorio de speechSynthesis, ttsMark, ttsProbe y «¿No se oye la
   voz?» de Ajustes › Voz y velocidad). speechSynthesis de mentira que imita los fallos de Chrome en Android: las voces
   con lang «en_GB» (test_voces.ANDROID), el speak() que llega menos de 100 ms después de cancel() se pierde, en pausa no
   empieza hasta resume(), una u.voice que no acepta (ni start ni end) y un motor sin el idioma (nunca suena). Se
   comprueba: lo que se toca mientras otra cosa suena se oye, sin cancel() de más cuando no suena nada; la voz que no
   acepta se prueba otra vez solo con su lang a los ~2 s; si tampoco suena, "vocab:tts" lo apunta (solo este aparato,
   fuera de la exportación), un aviso suave una vez y en Voz y velocidad cómo arreglarlo con el enlace a «Servicios de
   voz de Google» (por la Puerta de mayores); «Probar voz» dice cuántas voces ve, con cuál suena, el aparato y si sonó;
   en cuanto vuelve a sonar, se olvida.
2. La granja (js/farm.js): tocar la nube blanca del hambre (.fm-ask, la grande y la pequeña) o el animal abre «¿Qué le
   das…?» para darle de comer.
3. El botón de Google de la barra de arriba (js/sync.js, #tb-google): sale sin Google, cabe a 360 px con texto grande y
   12345 monedas, pasa por la Puerta y pide el permiso de Google dentro del toque (GIS y Drive de mentira), abre Para
   mayores; conectado, no sale; con html[data-tech], tampoco.
4. El cazador (js/hunter.js): con la cámara falsa de Chromium (un .y4m que pasa por los 4 colores) tres rondas
   enteras seguidas, sin pausar el vídeo, una cámara por ronda; y con la cámara de lienzo y un vídeo «de iPhone» (tras
   pause(), play() no contesta y la imagen se queda quieta; al sonar algo, el vídeo se para) las cosas se siguen cazando.
Capturas en /mnt/project-files/rediseno/capturas/arreglos-v24/ (móvil 390 y 360)."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

import common as C
import test_f2_ajustes as A
import test_f2_fix as F2F
import test_f4_granja as GR
import test_f5_buzon as BZ
import test_f6_cazador as HZ
import test_update_v21 as U
import test_voces as V

OUT = C.CAPTURAS / "arreglos-v24"
S360 = {"viewport": {"width": 360, "height": 780}}
PLAY = "https://play.google.com/store/apps/details?id=com.google.android.tts"
_MSG = "La voz del aparato no suena. Un mayor puede arreglarlo en Ajustes › Voz y velocidad."

# ---------------------------------------------------------------- 1. la voz en Android
_ANDROID = r"""
(cfg => {
  const ss = window.speechSynthesis; if (!ss) return;
  const T = window.__tts = {mode: cfg.mode || 'ok', log: [], cut: -1e9, cur: null, paused: !!cfg.paused, ms: cfg.ms || 500};
  const list = cfg.voices.map(v => Object.freeze(Object.assign({}, v)));
  const def = (k, o) => Object.defineProperty(ss, k, Object.assign({configurable: true}, o));
  def('getVoices', {writable: true, value: () => list.slice()});
  def('speaking', {get: () => !!T.cur});
  def('pending', {get: () => false});
  def('paused', {get: () => T.paused});
  def('resume', {writable: true, value: () => { T.log.push({k: 'resume'}); T.paused = false; }});
  def('cancel', {writable: true, value: () => {
    T.log.push({k: 'cancel'}); T.cut = performance.now();
    const u = T.cur; T.cur = null;
    if (u) { clearTimeout(u.__t); setTimeout(() => { try { u.onerror && u.onerror({error: 'interrupted'}); } catch (e) {} }, 0); } }});
  def('speak', {writable: true, value: u => {
    const e = {k: 'speak', text: String(u.text), lang: String(u.lang || ''), voice: u.voice ? u.voice.name : null,
      dt: Math.round(performance.now() - T.cut), at: Math.round(performance.now())};
    T.log.push(e);
    if (!String(u.text).trim()) return;
    if (e.dt < 100) { e.drop = 'cancel'; return; }                    /* Chrome en Android: justo tras cancel() se pierde */
    if (T.paused) { e.drop = 'paused'; return; }                       /* en pausa: no empieza */
    if (T.mode === 'dead') { e.drop = 'dead'; return; }                 /* el motor no tiene ese idioma: ni start ni end */
    if (T.mode === 'novoice' && u.voice) { e.drop = 'voice'; return; }  /* no acepta esa u.voice */
    T.cur = u;
    setTimeout(() => { if (T.cur !== u) return; e.started = Math.round(performance.now()); u.onstart && u.onstart({}); }, 40);
    u.__t = setTimeout(() => { if (T.cur !== u) return; T.cur = null; e.ended = true; u.onend && u.onend({}); }, 40 + T.ms);
  }});
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t == null ? '' : String(t); this.lang = ''; this.rate = 1;
    this.pitch = 1; this.volume = 1; this.voice = null; this.onstart = this.onend = this.onerror = this.onboundary = null; } };
})
"""
_LOG = "() => window.__tts.log"
_TTSREC = "() => JSON.parse(localStorage.getItem('vocab:tts') || 'null')"
_TOASTS = """() => { if (window.__toasts) return; window.__toasts = []; const t0 = M.toast;
  M.toast = function (t, o) { window.__toasts.push(String(t)); return t0.apply(this, arguments); }; }"""


def _tts_page(mode="ok", ms=500, paused=False, kind="phone", **kw):
    page = C.new_page(kind, **kw)
    page.add_init_script(f"{_ANDROID}({json.dumps({'voices': V.ANDROID, 'mode': mode, 'ms': ms, 'paused': paused}, ensure_ascii=False)})")
    C.seed(page)
    C.goto(page, "#/")
    page.evaluate(_TOASTS)
    return page


def _said(page, text):
    return [e for e in page.evaluate(_LOG) if e.get("k") == "speak" and e["text"] == text]


def test_android_voice_after_cancel_paused_and_rejected_voice():
    """Lo que se toca mientras otra frase suena se oye (el speak va ≥ 100 ms después del cancel); sin nada sonando, say()
    no llama a cancel() del navegador y habla enseguida; el " " de desbloquear no llega al motor (su onend sí); en
    pausa, resume() antes; una voz que Android no acepta se
    prueba otra vez a los ~2 s solo con su lang (en-GB, sin voz) y suena; nada de eso apunta que la voz no funcione."""
    probs = []
    page = _tts_page("ok", ms=1500)
    try:
        page.evaluate("() => say('Good morning, how are you today?')")
        page.wait_for_function("() => __tts.log.some(e => e.started)", timeout=3000)
        page.wait_for_timeout(250)
        page.evaluate("() => say('See you later, my friend.')")
        page.wait_for_function("t => __tts.log.some(e => e.text === t && (e.started || e.drop))", arg="See you later, my friend.", timeout=3000)
        s = _said(page, "See you later, my friend.")
        if len(s) != 1 or s[0].get("drop") or s[0]["dt"] < 100 or s[0]["lang"] != "en-GB" or s[0]["voice"] != "inglés Reino Unido":
            probs.append(f"tocar mientras suena otra frase: {s}")
        page.wait_for_function("() => !__tts.cur", timeout=4000)
        n0 = len(page.evaluate(_LOG))
        page.evaluate("() => say('Thank you very much.')")
        page.wait_for_function("t => __tts.log.some(e => e.text === t && e.started)", arg="Thank you very much.", timeout=2000)
        new = [e for e in page.evaluate(_LOG)[n0:] if e["k"] != "resume"]   # en Android, resume() siempre antes (paused no siempre lo dice)
        if any(e["k"] == "cancel" for e in new) or new[0]["k"] != "speak" or new[0]["started"] - new[0]["at"] > 200:
            probs.append(f"sin nada sonando: {new}")
        # el de desbloquear (" ", de los juegos y el Buzón) no llega al motor de Android, pero su onend sí
        page.wait_for_function("() => !__tts.cur", timeout=4000)
        n0 = len(page.evaluate(_LOG))
        blank = page.evaluate("""() => new Promise(r => { const u = new SpeechSynthesisUtterance(' '); u.onend = () => r('end');
          speechSynthesis.speak(u); setTimeout(() => r('sin onend'), 300); })""")
        if blank != "end" or any(e["k"] == "speak" for e in page.evaluate(_LOG)[n0:]):
            probs.append(f"el de desbloquear en Android: {blank} {page.evaluate(_LOG)[n0:]}")
        # en pausa (Android al volver a la app): resume() y suena
        page.wait_for_function("() => !__tts.cur", timeout=4000)
        page.evaluate("() => { __tts.paused = true; __tts.ms = 300; }")
        n0 = len(page.evaluate(_LOG))
        page.evaluate("() => say('Good night.')")
        page.wait_for_function("() => __tts.log.some(e => e.text === 'Good night.' && e.started)", timeout=3000)
        ks = [e["k"] for e in page.evaluate(_LOG)[n0:]]
        if "resume" not in ks or ks.index("resume") > ks.index("speak"):
            probs.append(f"en pausa: {page.evaluate(_LOG)[n0:]}")
        # una voz que no acepta: otra vez solo con su lang
        page.wait_for_function("() => !__tts.cur", timeout=4000)
        page.evaluate("() => { __tts.mode = 'novoice'; }")
        page.evaluate("() => say('Nice to meet you.')")
        page.wait_for_function("() => __tts.log.some(e => e.text === 'Nice to meet you.' && e.started)", timeout=5000)
        s = _said(page, "Nice to meet you.")
        if len(s) != 2 or s[0]["voice"] != "inglés Reino Unido" or s[0].get("drop") != "voice" or s[1]["voice"] is not None \
                or s[1]["lang"] != "en-GB" or not 1800 <= s[1]["at"] - s[0]["at"] <= 3200:
            probs.append(f"la voz que Android no acepta: {s}")
        if page.evaluate(_TTSREC) or page.evaluate("() => __toasts.filter(t => /voz/i.test(t))"):
            probs.append(f"con la voz sonando se apunta o se avisa de que no funciona: {page.evaluate(_TTSREC)} {page.evaluate('() => __toasts')}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def _probe(page, want):
    page.locator("#ajustes #cfg-pv").click()
    page.wait_for_function("w => (document.querySelector('#ajustes #cfg-pr') || {}).textContent.includes(w)", arg=want, timeout=9000)
    page.wait_for_timeout(150)
    return page.evaluate("() => [...document.querySelectorAll('#ajustes #cfg-pr > *')].map(e => e.textContent)")


def test_dead_voice_tells_adults_once_and_probe_reports():
    """Un motor que nunca dice nada: a los ~4 s (la frase y su reintento sin voz) "vocab:tts" apunta {m: {en: "mute"}} y
    sale una vez el aviso suave (otra frase que falla no lo repite); vocab:tts va solo en este aparato (inventario
    deviceOnly, fuera de la exportación). Ajustes › Voz y velocidad › «¿No se oye la voz?»: «En este aparato la voz no
    suena» con los pasos de Android y el enlace a «Servicios de voz de Google» (por la Puerta de mayores); «Probar voz»
    dice «✗ No ha sonado», cuántas voces del inglés hay, con cuál suena y el aparato (Android 14 · Chrome). Arreglado el
    motor, «Probar voz» dice «✓ Ha sonado», el apunte se borra y los pasos se van."""
    probs = []
    page = _tts_page("dead")
    try:
        page.evaluate("() => say('Good morning, how are you today?')")
        try:
            page.wait_for_function("() => { const o = JSON.parse(localStorage.getItem('vocab:tts') || 'null'); return o && o.m && o.m.en === 'mute'; }", timeout=7000)
        except Exception:  # noqa: BLE001
            probs.append(f"la voz que nunca suena no se apunta: {page.evaluate(_TTSREC)} · {page.evaluate(_LOG)}")
        s = _said(page, "Good morning, how are you today?")
        if [x["voice"] for x in s] != ["inglés Reino Unido", None]:
            probs.append(f"el reintento sin voz: {s}")
        page.wait_for_timeout(300)
        if page.evaluate("() => __toasts") != [_MSG]:
            probs.append(f"el aviso: {page.evaluate('() => __toasts')}")
        C.shot(page, "voz-aviso-una-vez-390", OUT)
        page.evaluate("() => say('See you later.')")
        page.wait_for_function("() => __tts.log.filter(e => e.text === 'See you later.').length === 2", timeout=7000)
        page.wait_for_timeout(500)
        if len(page.evaluate("() => __toasts")) != 1:
            probs.append(f"el aviso sale más de una vez: {page.evaluate('() => __toasts')}")
        inv = page.evaluate("() => vocabSave.inventory.deviceOnly")
        if "vocab:tts" not in inv or "vocab:tts" in C.export(page).get("keys", {}):
            probs.append(f"vocab:tts no es solo de este aparato: {inv}")
        # Ajustes › Voz y velocidad
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
        page.locator("#aj-voz").click()
        page.wait_for_function("() => vocabSettings.page === 'voz'", timeout=3000)
        page.wait_for_timeout(450)
        fix = page.evaluate("""() => { const f = document.querySelector('#ajustes #cfg-fix'); if (!f) return null; const a = f.querySelector('a');
          return {t: f.querySelector('.st-l').firstChild.textContent, s: f.querySelector('small').textContent, href: a && a.href, a: a && a.textContent}; }""")
        if not fix or fix["t"] != "En este aparato la voz no suena" or fix["href"] != PLAY or fix["a"] != "Servicios de voz de Google" \
                or not fix["s"].startswith("1. En los Ajustes de Android › Salida de texto a voz") \
                or "Instalar datos de voz y descarga inglés (Reino Unido), francés y danés." not in fix["s"] or "Probar voz" not in fix["s"]:
            probs.append(f"cómo arreglarlo: {fix}")
        page.locator("#ajustes #cfg-diag").scroll_into_view_if_needed()
        C.shot(page, "voz-no-suena-ajustes-390", OUT)
        n = page.evaluate("() => langVoices('english').length")
        got = _probe(page, "No ha sonado")
        ua = page.evaluate("() => navigator.userAgent.match(/Chrome\\/(\\d+)/)[1]")
        want = ["✗ No ha sonado", f"Voces del inglés en este aparato: {n} voces" if n != 1 else "Voces del inglés en este aparato: 1 voz",
                "Ha probado con: Reino Unido y la que pone el aparato", f"Android 14 · Chrome {ua}"]
        if [g.split(" (de ")[0] for g in got] != want:
            probs.append(f"«Probar voz» sin voz: {got} (se esperaba {want})")
        page.locator("#ajustes #cfg-diag").scroll_into_view_if_needed()
        C.shot(page, "voz-probar-no-suena-390", OUT)
        # el enlace a la tienda pasa por la Puerta
        page.evaluate("() => adultGate.forget()")
        page.locator("#ajustes #cfg-fix a").click()
        try:
            page.wait_for_selector("dialog#gate[open]", timeout=3000)
            page.keyboard.press("Escape")
            page.wait_for_function("() => !document.getElementById('gate').open", timeout=3000)
        except Exception:  # noqa: BLE001
            probs.append("el enlace a «Servicios de voz de Google» no pasa por la Puerta de mayores")
        # arreglado: suena y se olvida
        page.evaluate("() => { __tts.mode = 'ok'; }")
        got = _probe(page, "Ha sonado")
        if got[0] != "✓ Ha sonado" or got[2] != "Suena con: Reino Unido":
            probs.append(f"«Probar voz» con voz: {got}")
        page.wait_for_timeout(200)
        rec = page.evaluate(_TTSREC)
        if not rec or rec.get("m") or page.locator("#ajustes #cfg-fix").count():
            probs.append(f"cuando vuelve a sonar no se olvida: {rec}, pasos {page.locator('#ajustes #cfg-fix').count()}")
        C.shot(page, "voz-probar-suena-390", OUT)
        probs += C.errors(page)
    finally:
        page.context.close()
    # a 360 px: los pasos y el resultado caben, sin scroll de lado
    page = _tts_page("dead", **S360)
    try:
        page.evaluate("() => say('Good morning.')")
        page.wait_for_function("() => { const o = JSON.parse(localStorage.getItem('vocab:tts') || 'null'); return o && o.m && o.m.en === 'mute'; }", timeout=7000)
        page.wait_for_timeout(6500)   # que se vaya el aviso
        page.locator(".topbar [data-open=ajustes]").click()
        page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
        page.locator("#aj-voz").click()
        page.wait_for_function("() => vocabSettings.page === 'voz'", timeout=3000)
        page.wait_for_timeout(450)
        _probe(page, "No ha sonado")
        r = page.evaluate("""() => { const d = document.querySelector('#ajustes #cfg-diag'), r = d.getBoundingClientRect();
          return {l: r.left, r: r.right, w: innerWidth, sw: document.querySelector('#ajustes').scrollWidth <= document.querySelector('#ajustes').clientWidth}; }""")
        if r["l"] < 0 or r["r"] > r["w"] or not r["sw"]:
            probs.append(f"a 360 px «¿No se oye la voz?» no cabe: {r}")
        page.locator("#ajustes #cfg-diag").scroll_into_view_if_needed()
        C.shot(page, "voz-probar-no-suena-360", OUT)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 2. la nube de la granja
_POP = """() => { const p = document.querySelector('#app .fm-pop:not([hidden])'); return p ? {kind: p.dataset.kind, fid: p.dataset.fid,
  q: (p.querySelector('.fm-qt') || {}).textContent || ''} : null; }"""
_HIT = """s => { const a = document.querySelector(s); if (!a) return null; const r = a.getBoundingClientRect();
  const e = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).find(x => !x.closest('.g-hint'));   /* una pista encima pasa el toque */
  return !!e && !!e.closest('.fm-ask') && e.closest('.fm-it') === a.closest('.fm-it') || (e ? (e.id || '') + '.' + e.className : 'nada'); }"""


def test_farm_cloud_and_animal_open_feeding():
    """La nube blanca del hambre se puede tocar (es la que está encima en su punto) y tocarla abre «¿Qué le das…?» de ese
    animal: la grande (el conejo, el que más prisa tiene) y la pequeña (la vaca); tocar el animal, lo mismo; y una pista
    de gestos que sale encima de la nube no se come el toque (pasa a la nube). A 390 y 360 px."""
    probs = []
    for kw, tag in (({}, "390"), (S360, "360")):
        page = GR._page("phone", reduced_motion="reduce", **kw)
        try:
            GR._open(page)
            page.wait_for_selector('#app .fm-it[data-fid="conejo"] .fm-ask', timeout=6000)
            page.wait_for_timeout(600)
            for sel, fid, what in (('#app .fm-it[data-fid="conejo"] .fm-ask', "conejo", "la nube grande"),
                                   ('#app .fm-it[data-fid="vaca"] .fm-ask', "vaca", "la nube pequeña"),
                                   (GR._it("conejo"), "conejo", "el animal")):
                hit = page.evaluate(_HIT, sel) if ".fm-ask" in sel else True
                if hit is not True:
                    probs.append(f"{tag}: {what} no recibe el toque (encima: {hit})")
                GR._tap(page, sel)
                try:
                    page.wait_for_function(f"() => ({_POP})() && ({_POP})().kind === 'feed'", timeout=3000)
                except Exception:  # noqa: BLE001
                    pass
                p = page.evaluate(_POP)
                if not p or p["kind"] != "feed" or p["fid"] != fid or "le das" not in p["q"]:
                    why = page.evaluate("""s => { const a = document.querySelector(s), r = a && a.getBoundingClientRect(),
                      e = r && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                      return {top: e ? (e.id || '') + '.' + e.className : null, html: Object.keys(document.documentElement.dataset).join(','),
                        pops: [...document.querySelectorAll('#app .fm-pop')].map(x => [x.dataset.kind, x.hidden]),
                        hint: (document.querySelector('.g-hint') || {}).textContent || '', dlg: [...document.querySelectorAll('dialog[open]')].map(d => d.id),
                        toast: [...document.querySelectorAll('#m-toasts .m-toast')].map(t => t.textContent)}; }""", sel)
                    probs.append(f"{tag}: tocar {what} no abre «Dar de comer»: {p} {why}")
                elif fid == "conejo" and what == "la nube grande":
                    C.shot(page, f"granja-nube-dar-de-comer-{tag}", OUT)
                if p:
                    page.locator("#app .fm-pop:not([hidden]) .fm-x").click()
                    page.wait_for_function("() => !document.querySelector('#app .fm-pop:not([hidden])')", timeout=3000)
                    page.wait_for_timeout(400)
            # una pista de gestos («Arrastra el agua…») que sale encima de la nube no se come el toque
            page.evaluate("""() => { const a = document.querySelector('#app .fm-it[data-fid="vaca"] .fm-ask').getBoundingClientRect();
              const h = document.createElement('div'); h.className = 'g-hint'; h.id = 'fake-hint';
              h.style.cssText = `position:fixed;z-index:25;left:${a.left - 20}px;top:${a.top - 6}px;width:${a.width + 40}px;height:${a.height + 12}px`;
              h.innerHTML = '<span class="g-hint-t">Arrastra el agua a una planta</span>'; document.body.appendChild(h); }""")
            GR._tap(page, '#app .fm-it[data-fid="vaca"] .fm-ask')
            try:
                page.wait_for_function(f"() => ({_POP})() && ({_POP})().kind === 'feed'", timeout=3000)
            except Exception:  # noqa: BLE001
                pass
            p = page.evaluate(_POP)
            if not p or p["kind"] != "feed" or p["fid"] != "vaca":
                probs.append(f"{tag}: con una pista encima, tocar la nube no abre «Dar de comer»: {p}")
            page.evaluate("() => document.getElementById('fake-hint').remove()")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 3. el botón de Google de arriba
_TOP = """() => { const b = document.getElementById('tb-google'), vis = e => !!e && !!e.getClientRects().length && !e.hidden;
  if (!vis(b)) return {shown: false};
  const r = b.getBoundingClientRect(), g = document.querySelector('.topbar .tb-group').getBoundingClientRect(), f = document.getElementById('lang-b').getBoundingClientRect();
  return {shown: true, w: Math.round(r.width), h: Math.round(r.height), first: b.parentElement.firstElementChild === b && b.parentElement.classList.contains('tb-right'),
    label: b.getAttribute('aria-label'), logo: !!b.querySelector('svg[data-brand=google]'), gap: Math.round(g.left - r.right), flag: r.left - f.right >= 8,
    inView: g.right <= innerWidth - 15.5 && r.left >= 0, oneRow: Math.abs((r.top + r.bottom) / 2 - (g.top + g.bottom) / 2) < 2,
    scroll: document.documentElement.scrollWidth <= innerWidth}; }"""


def test_google_button_in_topbar_until_connected():
    """Sin Google: el botón redondo con la G va primero en el grupo de la derecha (44×44, a 8 px de las monedas, en la
    fila de la bandera) y cabe a 390 y a 360 px con texto grande y 12345 monedas, sin scroll de lado. Tocarlo abre la
    Puerta de mayores; al pasarla se pide el permiso de Google en ese mismo toque, se abre Ajustes › Para mayores con el
    bloque de Google y, conectado, el botón se va. Con Google conectado no sale; con html[data-tech], tampoco."""
    probs = []
    for kw, tag in (({}, "390"), (S360, "360")):
        page = C.new_page("phone", **kw)
        try:
            page.add_init_script(A._GIS)
            page.add_init_script(U._DRIVE)
            C.seed(page)
            C.goto(page, "#/")
            r = page.evaluate(_TOP)
            want = {"shown": True, "w": 44, "h": 44, "first": True, "label": "Entrar con Google (para mayores)", "logo": True, "gap": 8,
                    "flag": True, "inView": True, "oneRow": True, "scroll": True}
            if r != want:
                probs.append(f"{tag}: el botón de Google: {r}")
            page.evaluate(F2F._COINS, 12345)
            page.evaluate("() => { document.documentElement.dataset.text = 'large'; }")
            page.wait_for_timeout(300)
            r = page.evaluate(_TOP)
            if not r.get("shown") or not r["inView"] or not r["flag"] or not r["oneRow"] or not r["scroll"]:
                probs.append(f"{tag}: con texto grande y 12345 monedas no cabe: {r}")
            C.shot(page, f"google-arriba-texto-grande-{tag}", OUT)
            page.evaluate("() => { delete document.documentElement.dataset.text; }")
            page.evaluate(F2F._COINS, 245)
            page.wait_for_timeout(200)
            C.shot(page, f"google-arriba-{tag}", OUT)
            if tag == "390":
                # Puerta → permiso dentro del toque → Para mayores → conectado y sin botón
                page.locator("#tb-google").click()
                page.wait_for_selector("dialog#gate[open]", timeout=3000)
                if page.evaluate("window.__gis.length"):
                    probs.append("se pide el permiso de Google antes de pasar la Puerta")
                C.shot(page, "google-arriba-puerta-390", OUT)
                BZ._pass_gate(page)
                page.wait_for_function("() => window.__gis.length > 0", timeout=4000)
                calls = page.evaluate("window.__gis")
                if len(calls) != 1 or not calls[0]["tap"] or not calls[0]["act"]:
                    probs.append(f"el permiso no se pide dentro del toque: {calls}")
                page.wait_for_selector("dialog#ajustes[open] [data-sync-block] #sv-box", timeout=5000)
                page.wait_for_function("() => !!vocabSync.state.meta.connectedAt", timeout=8000)
                page.wait_for_timeout(400)
                if page.evaluate(_TOP)["shown"]:
                    probs.append("conectado, el botón de Google sigue en la barra de arriba")
                if "Conectado" not in page.evaluate("() => document.getElementById('sv-box').textContent"):
                    probs.append(f"Para mayores no dice que está conectado: {page.evaluate('() => document.getElementById(`sv-box`).textContent')[:200]}")
                C.shot(page, "google-conectado-para-mayores-390", OUT)
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    # ya conectado: no sale · Tech Prep (html[data-tech]): no sale
    page = C.new_page("phone")
    try:
        page.add_init_script(A._GIS)
        C.seed(page, keys=A._sync_keys(A.NOW_MS + 30 * A.MIN, reconnect=False))
        C.goto(page, "#/")
        if page.evaluate(_TOP)["shown"]:
            probs.append("con Google conectado sale el botón de Google arriba")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = C.new_page("phone")
    try:
        page.add_init_script("document.addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-tech', ''))")
        C.seed(page)
        C.goto(page, "#/")
        if page.evaluate(_TOP)["shown"]:
            probs.append("con html[data-tech] sale el botón de Google arriba")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 4. el cazador, muchas cosas seguidas
def _rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _yuv(rgb):
    r, g, b = rgb
    y = .299 * r + .587 * g + .114 * b
    return tuple(max(0, min(255, round(x))) for x in (y, 128 - .168736 * r - .331264 * g + .5 * b, 128 + .5 * r - .418688 * g - .081312 * b))


def _y4m_cycle(path, colors, secs=1.5, fps=10, w=160, h=120):
    """Un vídeo .y4m que enseña cada color secs segundos, uno tras otro (la cámara falsa lo repite sin fin)."""
    with open(path, "wb") as f:
        f.write(f"YUV4MPEG2 W{w} H{h} F{fps}:1 Ip A1:1 C420jpeg\n".encode())
        for c in colors:
            y, u, v = _yuv(_rgb(c))
            fr = b"FRAME\n" + bytes([y]) * (w * h) + bytes([u]) * (w * h // 4) + bytes([v]) * (w * h // 4)
            for _ in range(round(secs * fps)):
                f.write(fr)


# el vídeo de la cámara: cuántas veces se pausó mientras se jugaba y los fotogramas que se ven
_VSPY = r"""(() => {
  window.__vp = 0; const p0 = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function () {   /* (apagar la cámara al acabar la ronda no cuenta: sus pistas ya se pararon) */
    const s = this instanceof HTMLVideoElement && this.srcObject;
    if (s && s.getTracks().some(t => t.readyState === 'live') && document.querySelector('#hn[data-v=play]')) window.__vp++;
    return p0.call(this); };
})();"""
_RUN = """() => { const v = document.getElementById('hn-v'), s = vocabHunter.state();
  return {step: s.step, color: s.color, i: s.i, view: s.view, paused: v ? v.paused : null, t: v ? v.currentTime : null, on: s.cam.on, cam: s.cam}; }"""


def _round(page, tag, k, probs, timeout=16000):
    """Una ronda entera con la cámara: cada color se encuentra (la cámara enseña el que pide la prueba o los va
    pasando), «Siguiente color» y, al final, «Otra vez»."""
    for j in range(4):
        st = page.evaluate(_RUN)
        if st["view"] != "play" or st["step"] != "ask":
            probs.append(f"{tag} ronda {k}: color {j + 1}: {st}")
            return False
        if k is not None and hasattr(page, "_show"):
            page._show(st["color"])
        t0 = page.evaluate("() => document.getElementById('hn-v').currentTime")
        try:
            page.wait_for_function("() => vocabHunter.state().step === 'found'", timeout=timeout)
        except Exception:  # noqa: BLE001
            probs.append(f"{tag} ronda {k}: el color {j + 1} ({st['color']}) no se encuentra: {page.evaluate(_RUN)}")
            return False
        page.wait_for_timeout(450)
        st = page.evaluate(_RUN)
        if st["paused"] or not st["on"] or st["t"] <= t0:
            probs.append(f"{tag} ronda {k}: tras encontrar el color {j + 1} el vídeo no sigue en marcha: {st}")
        page.locator("#hn-next").click()
        page.wait_for_timeout(250)
    page.wait_for_selector("#hn[data-v=end] #hn-again", timeout=5000)
    page.wait_for_timeout(300)
    page.locator("#hn-again").click()
    page.wait_for_function("() => { const s = vocabHunter.state(); return s.view === 'play' && s.step === 'ask' && s.cam.on; }", timeout=8000)
    return True


def test_hunter_many_finds_in_a_row_chromium_fake_camera():
    """La cámara falsa de Chromium con un vídeo que va pasando por rojo, amarillo, verde y azul (1,5 s cada uno), el permiso
    ya dado: tres rondas enteras seguidas (12 cosas), cada una con su «Siguiente color» y «Otra vez»; el vídeo nunca se
    pausa mientras se juega y sigue avanzando tras cada cosa; una cámara (getUserMedia) por ronda, nada de pistas vivas
    de rondas viejas; al salir, la cámara se apaga. Sin errores."""
    probs = []
    tmp = Path(tempfile.mkdtemp(prefix="vocab-y4m4-"))
    vid = tmp / "colores.y4m"
    _y4m_cycle(vid, [HZ.HEX[c] for c in ("red", "yellow", "green", "blue")])
    C.browser()
    fb = C._PW.chromium.launch(executable_path=C.CHROME, args=["--autoplay-policy=no-user-gesture-required", "--mute-audio",
                               "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", f"--use-file-for-fake-video-capture={vid}"])
    orig = C.browser
    C.browser = lambda: fb
    try:
        ctx = C.new_context("phone", permissions=["camera"])
    finally:
        C.browser = orig
    try:
        ctx.add_init_script(f"{HZ._TTS}({json.dumps({'voices': HZ.VOICES})})")
        ctx.add_init_script(HZ._MEDIA)
        ctx.add_init_script(_VSPY)
        ctx.add_init_script("""(() => { window.__gum = 0; const md = navigator.mediaDevices; if (!md) return; const g = md.getUserMedia.bind(md);
          md.getUserMedia = c => { window.__gum++; return g(c).then(s => { (window.__tr = window.__tr || []).push(...s.getTracks()); return s; }); }; })()""")
        page = ctx.new_page()
        C._attach(page, ctx._vocab_base)
        C.seed(page, keys=HZ._keys(), hash="#/cazador")
        page.wait_for_selector("#hn", timeout=10000)
        page.evaluate(HZ._SPY)
        page.wait_for_function("() => { const s = vocabHunter.state(); return s.cam.on && !!s.reading; }", timeout=8000)
        for k in range(1, 4):
            if not _round(page, "cámara falsa", k, probs, timeout=20000):
                break
            if page.evaluate("() => window.__gum") != k + 1:
                probs.append(f"ronda {k}: getUserMedia {page.evaluate('() => window.__gum')} veces (se esperaban {k + 1})")
            live = page.evaluate("() => (window.__tr || []).filter(t => t.readyState === 'live').length")
            if live != 1:
                probs.append(f"ronda {k}: {live} pistas vivas")
        if page.evaluate("() => window.__vp"):
            probs.append(f"el vídeo de la cámara se pausó {page.evaluate('() => window.__vp')} veces mientras se jugaba")
        found = page.evaluate("() => window.__found.filter(f => f.mode === 'cam').length")
        if found != 12:
            probs.append(f"colores cazados con la cámara: {found} (se esperaban 12)")
        C.shot(page, "cazador-tercera-ronda-390", OUT)
        page.locator("#fx-x").click()
        page.wait_for_timeout(500)
        if page.evaluate("() => (window.__tr || []).filter(t => t.readyState === 'live').length"):
            probs.append("la cámara sigue encendida al salir")
        probs += C.errors(page)
    finally:
        ctx.close()
        fb.close()
    assert not probs, "\n".join(probs)


# un vídeo «de iPhone»: tras pause(), play() no contesta y la imagen queda quieta hasta que se vuelve a poner su
# srcObject; y cuando suena un audio, el vídeo de la cámara se para (como Safari en iOS con otro sonido)
_IOS_VIDEO = r"""(() => {
  window.__stuck = 0;
  const P = HTMLMediaElement.prototype, play0 = P.play, pause0 = P.pause, d = Object.getOwnPropertyDescriptor(P, 'srcObject');
  Object.defineProperty(P, 'srcObject', {configurable: true, get() { return d.get.call(this); }, set(v) { this.__frozen = false; d.set.call(this, v); }});
  P.pause = function () { if (this instanceof HTMLVideoElement && d.get.call(this)) this.__frozen = true; return pause0.call(this); };
  P.play = function () {
    if (this instanceof HTMLVideoElement) { if (this.__frozen) { window.__stuck++; return new Promise(() => {}); } return play0.call(this); }
    document.querySelectorAll('video').forEach(v => { if (!v.paused) v.pause(); });   /* suena algo: iOS para la cámara */
    window.__played = window.__played || []; window.__played.push({src: this.src, t: Date.now()});
    setTimeout(() => this.dispatchEvent(new Event('ended')), 60);
    return Promise.resolve();
  };
})();"""


def test_hunter_keeps_going_with_ios_like_video():
    """Con la cámara de lienzo y un vídeo que se porta como el de Safari en iPhone (al sonar la palabra se para; después,
    play() no contesta hasta que se le vuelve a poner la pista): dos rondas enteras seguidas con la cámara, sin
    quedarse con la imagen quieta; a lo más una cámara nueva por color (stall) y nunca «La cámara está en pausa»."""
    probs = []
    page = C.new_page("phone")
    try:
        ctx = page.context
        ctx.add_init_script(f"{HZ._TTS}({json.dumps({'voices': HZ.VOICES})})")
        ctx.add_init_script(_IOS_VIDEO)
        ctx.add_init_script(f"{HZ._CAM}({json.dumps('canvas')})")
        HZ._open(page)
        HZ._start(page)
        page._show = lambda c: HZ._show(page, HZ.HEX[c])
        for k in (1, 2):
            if not _round(page, "vídeo de iPhone", k, probs, timeout=9000):
                break
        if page.locator("#hn-pause").count():
            probs.append("sale «La cámara está en pausa»")
        st = page.evaluate("() => vocabHunter.state().cam")
        calls = page.evaluate("() => window.__cam.calls")
        if calls > 2 + 8:
            probs.append(f"demasiadas cámaras pedidas: {calls}")
        if page.evaluate("() => window.__found.filter(f => f.mode === 'cam').length") != 8:
            probs.append(f"colores cazados: {page.evaluate('() => window.__found')}")
        C.shot(page, "cazador-video-iphone-390", OUT)
        probs += [f"estado {st}"] if probs else []
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


_IPHONE_UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) "
              "Version/18.0 Mobile/15E148 Safari/604.1")
_SILENT_MSG = "¿No oyes la voz? Quita el modo silencio y sube el volumen."


def test_silent_mode_tip_on_iphone_once():
    """Ninguna web puede saber si el aparato está en silencio: en iPhone y iPad, la primera vez que la voz del navegador
    empieza a hablar sale una vez «¿No oyes la voz? Quita el modo silencio y sube el volumen.» (vocab:tts.ios); la
    segunda, nada. En Voz y velocidad, «¿No se oye la voz?» lo explica (en iPhone, el modo silencio; en los demás,
    el volumen). En Android, el aviso del iPhone nunca sale."""
    probs = []
    page = _tts_page("ok", ms=300, user_agent=_IPHONE_UA)
    try:
        page.evaluate("() => say('a phrase without a recording', null)")
        page.wait_for_timeout(900)
        if page.evaluate("() => __toasts") != [_SILENT_MSG]:
            probs.append(f"iPhone, primera voz: {page.evaluate('() => __toasts')}")
        if not (page.evaluate(_TTSREC) or {}).get("ios"):
            probs.append(f"iPhone: vocab:tts sin ios: {page.evaluate(_TTSREC)}")
        page.evaluate("() => say('another phrase without a recording', null)")
        page.wait_for_timeout(900)
        if page.evaluate("() => __toasts").count(_SILENT_MSG) != 1:
            probs.append(f"iPhone, segunda voz: {page.evaluate('() => __toasts')}")
        page.evaluate("() => { const d = document.createElement('div'); d.innerHTML = diagHtml(); document.body.append(d); }")
        t = page.locator("#cfg-vol").inner_text()
        if "modo silencio" not in t:
            probs.append(f"iPhone, Voz y velocidad: {t!r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = _tts_page("ok", ms=300)
    try:
        page.evaluate("() => say('a phrase without a recording', null)")
        page.wait_for_timeout(900)
        if _SILENT_MSG in page.evaluate("() => __toasts"):
            probs.append("Android: sale el aviso del iPhone")
        page.evaluate("() => { const d = document.createElement('div'); d.innerHTML = diagHtml(); document.body.append(d); }")
        t = page.locator("#cfg-vol").inner_text()
        if "Sube el volumen" not in t or "silencio" in t:
            probs.append(f"Android, Voz y velocidad: {t!r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
