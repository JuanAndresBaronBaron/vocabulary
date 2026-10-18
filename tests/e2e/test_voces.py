"""Voz de cada idioma (Ajustes › Voz y velocidad y su página por idioma; index.html pickVoice/autoVoice/langVoices).

speechSynthesis simulado con listas de voces sacadas de aparatos reales (iPhone con Safari, Windows con Edge, Windows con
Chrome, Android con Chrome, Firefox de Android con el motor de Samsung, Chromebook): getVoices() devuelve la lista (o []
hasta que «llegan» con voiceschanged), speak() apunta texto, lang y voz sin sonar, y SpeechSynthesisUtterance es una
clase propia (la de Chrome no acepta voces falsas en .voice).

Se comprueba: el orden de las filas (el idioma que aprende primero, con en, fr y da), que cada idioma lista solo sus voces
sin repetir y sin las de broma, la «Automática» de cada aparato (británica para inglés), elegir una voz (✓, suena con esa
voz y su lang, se guarda por idioma en "vocab:voice" y sigue tras recargar; volver a «Automática» la quita), que
"vocab:voice" no va en la partida (la exportación sigue igual a la base), la elección de antes "voice:<idioma>" de
respaldo (solo si es de ese idioma), sin voz de danés, voces que llegan tarde con la hoja abierta (se repinta sin perder
la página ni el foco), la hoja de voz propia (dialog#cfg), sin internet las del aparato, Chrome en Android (u.lang) y
sin errores de consola. Capturas en /mnt/project-files/rediseno/capturas/voces/ con VOCES_SHOTS=1."""
from __future__ import annotations

import json
import os

import common as C

OUT = C.CAPTURAS / "voces"


# ---------------------------------------------------------------- listas de voces de aparatos reales
def _v(name, lang, local=True, uri=None, default=False):
    return {"name": name, "lang": lang, "localService": local, "voiceURI": uri or name, "default": default}


_ELOQ = ["Eddy", "Flo", "Grandma", "Grandpa", "Reed", "Rocko", "Sandy", "Shelley"]
# iPhone con Safari (iOS 17-18): solo voces compactas; voiceURI = identificador de AVFoundation; todas local y default
IOS = ([_v("Daniel", "en-GB", uri="com.apple.voice.compact.en-GB.Daniel", default=True),
        _v("Daniel", "en-GB", uri="com.apple.voice.super-compact.en-GB.Daniel", default=True),   # la misma, dos veces
        _v("Martha", "en-GB", uri="com.apple.ttsbundle.siri_Martha_en-GB_compact", default=True),
        _v("Arthur", "en-GB", uri="com.apple.ttsbundle.siri_Arthur_en-GB_compact", default=True)]
       + [_v(n, "en-GB", uri=f"com.apple.eloquence.en-GB.{n}", default=True) for n in _ELOQ]
       + [_v("Samantha", "en-US", uri="com.apple.voice.compact.en-US.Samantha", default=True),
          _v("Nicky", "en-US", uri="com.apple.ttsbundle.siri_Nicky_en-US_compact", default=True),
          _v("Fred", "en-US", uri="com.apple.speech.synthesis.voice.Fred", default=True),
          _v("Albert", "en-US", uri="com.apple.speech.synthesis.voice.Albert", default=True),
          _v("Bad News", "en-US", uri="com.apple.speech.synthesis.voice.BadNews", default=True),
          _v("Zarvox", "en-US", uri="com.apple.speech.synthesis.voice.Zarvox", default=True),
          _v("Whisper", "en-US", uri="com.apple.speech.synthesis.voice.Whisper", default=True),
          _v("Superstar", "en-US", uri="com.apple.speech.synthesis.voice.Princess", default=True),
          _v("Karen", "en-AU", uri="com.apple.voice.compact.en-AU.Karen", default=True),
          _v("Moira", "en-IE", uri="com.apple.voice.compact.en-IE.Moira", default=True),
          _v("Rishi", "en-IN", uri="com.apple.voice.compact.en-IN.Rishi", default=True),
          _v("Tessa", "en-ZA", uri="com.apple.voice.compact.en-ZA.Tessa", default=True),
          _v("Thomas", "fr-FR", uri="com.apple.voice.compact.fr-FR.Thomas", default=True),
          _v("Marie", "fr-FR", uri="com.apple.ttsbundle.siri_Marie_fr-FR_compact", default=True),
          _v("Daniel", "fr-FR", uri="com.apple.ttsbundle.siri_Dan_fr-FR_compact", default=True),
          _v("Jacques", "fr-FR", uri="com.apple.eloquence.fr-FR.Jacques", default=True),
          _v("Grandma", "fr-FR", uri="com.apple.eloquence.fr-FR.Grandma", default=True),
          _v("Amélie", "fr-CA", uri="com.apple.voice.compact.fr-CA.Amelie", default=True),
          _v("Sara", "da-DK", uri="com.apple.voice.compact.da-DK.Sara", default=True),
          _v("Mónica", "es-ES", uri="com.apple.voice.compact.es-ES.Monica", default=True),
          _v("Anna", "de-DE", uri="com.apple.voice.compact.de-DE.Anna", default=True)])
JOKES = ["Albert", "Bad News", "Zarvox", "Whisper", "Superstar"]


def _ms(n, region, lang, online=True):
    return _v(f"Microsoft {n}{' Online (Natural)' if online else ''} - {region}", lang, local=not online)


# Windows con Edge: las «Online (Natural)» (de internet) y las del sistema (OneCore)
EDGE = ([_ms(n, "English (United Kingdom)", "en-GB") for n in ("Libby", "Maisie", "Ryan", "Sonia", "Thomas")]
        + [_ms(n, "English (United Kingdom)", "en-GB", online=False) for n in ("George", "Hazel", "Susan")]
        + [_ms(n, "English (United States)", "en-US") for n in ("Aria", "AvaMultilingual", "Ana", "Guy")]
        + [_ms(n, "English (United States)", "en-US", online=False) for n in ("David", "Mark", "Zira")]
        + [_ms("Natasha", "English (Australia)", "en-AU"), _ms("Emily", "English (Ireland)", "en-IE"), _ms("Neerja", "English (India)", "en-IN")]
        + [_ms(n, "French (France)", "fr-FR") for n in ("Eloise", "Henri", "RemyMultilingual", "VivienneMultilingual", "Denise")]
        + [_ms(n, "French (France)", "fr-FR", online=False) for n in ("Hortense", "Julie", "Paul")]
        + [_ms("Sylvie", "French (Canada)", "fr-CA"), _ms("Antoine", "French (Canada)", "fr-CA"), _ms("Charline", "French (Belgium)", "fr-BE"),
           _ms("Ariane", "French (Switzerland)", "fr-CH")]
        + [_ms("Christel", "Danish (Denmark)", "da-DK"), _ms("Jeppe", "Danish (Denmark)", "da-DK")]
        + [_ms("Elvira", "Spanish (Spain)", "es-ES"), _ms("Katja", "German (Germany)", "de-DE")])
# Windows con Chrome (la captura del dueño): OneCore del sistema + voces Google de internet; sin voz danesa
CHROME_WIN = ([_ms(n, "English (United States)", "en-US", online=False) for n in ("David", "Mark", "Zira")]
              + [_ms(n, "French (France)", "fr-FR", online=False) for n in ("Hortense", "Julie", "Paul")]
              + [_v(n, l, local=False) for n, l in (("Google Deutsch", "de-DE"), ("Google US English", "en-US"),
                 ("Google UK English Female", "en-GB"), ("Google UK English Male", "en-GB"), ("Google español", "es-ES"),
                 ("Google français", "fr-FR"), ("Google italiano", "it-IT"), ("Google 日本語", "ja-JP"))])
# Android con Chrome (sistema en español): una entrada por país, lang con guion bajo, voiceURI = name
ANDROID = [_v(n, l, default=(i == 0)) for i, (n, l) in enumerate((
    ("español España", "es_ES"), ("inglés Estados Unidos", "en_US"), ("inglés Reino Unido", "en_GB"), ("inglés Australia", "en_AU"),
    ("inglés India", "en_IN"), ("francés Francia", "fr_FR"), ("francés Canadá", "fr_CA"), ("danés Dinamarca", "da_DK"),
    ("alemán Alemania", "de_DE")))]
# Firefox de Android con el motor de Samsung: lang en ISO-639-2 («eng-GBR-f000»)
FF_SAMSUNG = [_v("English (United States)", "eng-USA-f000", uri="moz-tts:android:en_US"),
              _v("English (United Kingdom)", "eng-GBR-f000", uri="moz-tts:android:en_GB"),
              _v("French (France)", "fra-FRA-f000", uri="moz-tts:android:fr_FR"),
              _v("Danish (Denmark)", "dan-DNK-f000", uri="moz-tts:android:da_DK")]
# Chromebook: Natural (instaladas), Chrome OS, Android (-local/-network) y eSpeak (danés solo eSpeak, sin región)
CHROMEOS = ([_v(f"Google UK English {i} (Natural)", "en-GB") for i in (1, 2, 3)]
            + [_v("Chrome OS UK English 7", "en-GB"), _v("Chrome OS US English 1", "en-US"),
               _v("Android Speech Recognition and Synthesis from Google en-gb-x-gba-local", "en-GB"),
               _v("Android Speech Recognition and Synthesis from Google en-gb-x-gba-network", "en-GB", local=False),
               _v("Chrome OS français 1", "fr-FR"), _v("eSpeak Danish", "da"), _v("eSpeak English", "en")])

PLATFORMS = {
    "ios": (IOS, {"english": "Martha", "français": "Marie", "dansk": "Sara"}),
    "edge": (EDGE, {"english": "Microsoft Sonia Online (Natural) - English (United Kingdom)",
                    "français": "Microsoft Denise Online (Natural) - French (France)",
                    "dansk": "Microsoft Christel Online (Natural) - Danish (Denmark)"}),
    "chrome_win": (CHROME_WIN, {"english": "Google UK English Female", "français": "Google français", "dansk": None}),
    "android": (ANDROID, {"english": "inglés Reino Unido", "français": "francés Francia", "dansk": "danés Dinamarca"}),
    "ff_samsung": (FF_SAMSUNG, {"english": "English (United Kingdom)", "français": "French (France)", "dansk": "Danish (Denmark)"}),
    "chromeos": (CHROMEOS, {"english": "Google UK English 2 (Natural)", "français": "Chrome OS français 1", "dansk": None}),
}
LANG_ORDER = ["english", "français", "dansk"]
AB = {"english": "en", "français": "fr", "dansk": "da"}
SAMPLE = {"english": "Hello! This is how I sound.", "français": "Bonjour ! Voici ma voix.", "dansk": "Hej! Sådan lyder min stemme."}

_FAKE = r"""
(cfg => {
  const ss = window.speechSynthesis; if (!ss) return;
  const mk = a => a.map(v => Object.freeze(Object.assign({}, v)));
  let list = cfg.delay ? [] : mk(cfg.voices);
  window.__spoken = [];
  window.__voicesNow = (vs) => { list = mk(vs || cfg.voices); ss.dispatchEvent(new Event('voiceschanged')); };
  Object.defineProperty(ss, 'getVoices', {configurable: true, writable: true, value: () => list.slice()});
  Object.defineProperty(ss, 'speak', {configurable: true, writable: true, value: u => {
    window.__spoken.push({text: String(u.text || ''), lang: String(u.lang || ''), voice: u.voice ? u.voice.name : null, rate: u.rate});
    setTimeout(() => { try { if (u.onend) u.onend({}); } catch (e) {} }, 40);
  }});
  Object.defineProperty(ss, 'cancel', {configurable: true, writable: true, value: () => {}});
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t == null ? '' : String(t); this.lang = ''; this.rate = 1; this.pitch = 1;
    this.volume = 1; this.voice = null; this.onend = this.onerror = null; } };
  if (cfg.delay > 0) setTimeout(() => window.__voicesNow(), cfg.delay);
})
"""


def _page(voices, kind="phone", lang="english", keys=None, delay=0, **kw):
    page = C.new_page(kind, **kw)
    page.add_init_script(f"{_FAKE}({json.dumps({'voices': voices, 'delay': delay}, ensure_ascii=False)})")
    k = C.seed_keys()
    k["lang"] = json.dumps(lang, ensure_ascii=False)
    for a, b in (keys or {}).items():
        k[a] = b if isinstance(b, str) else json.dumps(b, ensure_ascii=False)
    C.seed(page, k)
    return page


def _open_voz(page):
    page.locator(".topbar [data-open=ajustes]").click()
    page.wait_for_selector("dialog#ajustes[open]", timeout=4000)
    page.locator("#aj-voz").click()
    page.wait_for_function("() => vocabSettings.page === 'voz'", timeout=3000)
    page.wait_for_timeout(450)


def _open_lang(page, lang):
    page.locator(f"#ajustes #cfg-l-{AB[lang]}").click()
    page.wait_for_function("p => vocabSettings.page === p", arg=f"voz-{AB[lang]}", timeout=3000)
    page.wait_for_timeout(450)


def _rows(page, root="#ajustes .aj-pg[data-pg=voz]"):
    return page.evaluate("""r => [...document.querySelectorAll(r + ' .cfg-l')].map(b => ({id: b.id, vl: b.dataset.vl,
      name: b.querySelector('.st-l').firstChild.textContent, small: (b.querySelector('.st-l small') || {}).textContent || '',
      val: (b.querySelector('.aj-val') || {}).textContent || '', head: (b.closest('.st-sec').querySelector('.st-h') || {}).textContent || ''}))""", root)


def _list(page, root):
    return page.evaluate("""r => { const el = document.querySelector(r); if (!el) return null;
      return {radios: [...el.querySelectorAll('.vl-pick')].map(b => ({v: b.dataset.v, on: b.getAttribute('aria-checked') === 'true',
          t: b.querySelector('.st-l').firstChild.textContent, sub: (b.querySelector('small') || {}).textContent || '',
          shown: b.offsetParent !== null, tab: b.tabIndex, h: Math.round(b.getBoundingClientRect().height)})),
        tries: [...el.querySelectorAll('.vl-try')].map(b => ({v: b.dataset.v, w: Math.round(b.getBoundingClientRect().width),
          h: Math.round(b.getBoundingClientRect().height), label: b.getAttribute('aria-label')})),
        heads: [...el.querySelectorAll('.st-h')].map(h => h.textContent), group: (el.querySelector('[role=radiogroup]') || {}).getAttribute ?
          el.querySelector('[role=radiogroup]').getAttribute('aria-label') : null,
        more: el.querySelector('.vl-more') ? el.querySelector('.vl-more').getAttribute('aria-expanded') : null,
        text: el.textContent}; }""", root)


def _choice(page):
    return page.evaluate("() => JSON.parse(localStorage.getItem('vocab:voice') || 'null')")


def _shot(page, name, full_page=False):
    if os.environ.get("VOCES_SHOTS"):
        OUT.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(OUT / f"{name}.png"), full_page=full_page, animations="disabled")


# ---------------------------------------------------------------- pruebas
def test_rows_order_current_language_first():
    """Voz y velocidad: una fila por idioma; primero el que aprende («El idioma que aprendes») y luego los otros dos en
    orden fijo («Otros idiomas»); cada fila con su bandera, el idioma, «Automática» debajo, la voz que sonará a la
    derecha y ›. Velocidad y «Probar la voz» siguen ahí (mismos ids) y sin tecnicismos. Con en, fr y da como idioma actual."""
    probs = []
    for cur in LANG_ORDER:
        page = _page(EDGE, lang=cur)
        try:
            _open_voz(page)
            rows = _rows(page)
            want = [cur] + [k for k in LANG_ORDER if k != cur]
            if [r["vl"] for r in rows] != want:
                probs.append(f"{cur}: orden {[r['vl'] for r in rows]}")
            if [r["head"] for r in rows] != ["El idioma que aprendes", "Otros idiomas", "Otros idiomas"]:
                probs.append(f"{cur}: cabeceras {[r['head'] for r in rows]}")
            short = {"english": "Sonia", "français": "Denise", "dansk": "Christel"}
            if [(r["small"], r["val"]) for r in rows] != [("Automática", short[k]) for k in want]:
                probs.append(f"{cur}: valores {[(r['small'], r['val']) for r in rows]}")
            r = page.evaluate("""() => { const p = document.querySelector('#ajustes .aj-pg[data-pg=voz]');
              return {h: [...p.querySelectorAll('.cfg-ls .st-h')].map(x => x.textContent).join('|'), flags: p.querySelectorAll('.cfg-l .st-ic .flag svg').length,
                chev: p.querySelectorAll('.cfg-l .aj-chev').length, r: !!p.querySelector('#cfg-r'), rv: (p.querySelector('#cfg-rv') || {}).textContent,
                t: !!p.querySelector('#cfg-t:not([disabled])'), sel: !!p.querySelector('select'), win: /Windows|Configuración/.test(p.textContent),
                hs: [...p.querySelectorAll('.cfg-l')].map(b => b.getBoundingClientRect().height)}; }""")
            if r["h"] != "El idioma que aprendes|Otros idiomas" or r["flags"] != 3 or r["chev"] != 3 or not r["r"] or r["rv"] != "Normal" or not r["t"] or r["sel"] or r["win"]:
                probs.append(f"{cur}: página {r}")
            if min(r["hs"]) < 44:
                probs.append(f"{cur}: filas de menos de 44 px {r['hs']}")
            page.locator("#ajustes #cfg-t").click()
            page.wait_for_timeout(150)
            sp = page.evaluate("() => __spoken.slice(-1)[0]")
            if not sp or sp["text"] != SAMPLE[cur] or sp["voice"] != PLATFORMS["edge"][1][cur]:
                probs.append(f"{cur}: «Probar la voz» dice {sp}")
            probs += [f"{cur}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_auto_voice_per_platform():
    """«Automática» elige la esperada en cada aparato (británica para inglés, de Francia para francés; nunca de broma ni
    muy robótica), cada idioma lista solo sus voces y sin repetir (Daniel compacta y super-compacta una vez; el Daniel
    francés no sale en inglés), las de broma no salen nunca, y say() habla con esa voz y su lang normalizado."""
    probs = []
    for plat, (vs, want) in PLATFORMS.items():
        page = _page(vs)
        try:
            r = page.evaluate("""() => Object.fromEntries(Object.keys(LANGS).map(l => [l, {auto: (voiceFor(LANGS[l].code, l) || {}).name || null,
              list: langVoices(l).map(v => [v.name, v.lang]), base: langVoices(l).every(v => vlang(v).b === LANGS[l].code.slice(0, 2))}]))""")
            for l in LANG_ORDER:
                if r[l]["auto"] != want[l]:
                    probs.append(f"{plat}/{l}: Automática {r[l]['auto']!r}, se esperaba {want[l]!r}")
                if not r[l]["base"]:
                    probs.append(f"{plat}/{l}: voces de otro idioma {r[l]['list']}")
                keys = [tuple(x) for x in r[l]["list"]]
                if len(keys) != len(set(keys)):
                    probs.append(f"{plat}/{l}: voces repetidas {keys}")
                if any(n in JOKES for n, _ in keys):
                    probs.append(f"{plat}/{l}: voces de broma {keys}")
            if plat == "ios":
                if [n for n, _ in r["english"]["list"]].count("Daniel") != 1 or any(lg.startswith("fr") for _, lg in r["english"]["list"]):
                    probs.append(f"ios: Daniel en inglés {r['english']['list']}")
            # say() con una palabra sin audio grabado: la voz automática del idioma actual y su lang
            page.evaluate("() => { __spoken.length = 0; say('zzq unrecorded phrase'); }")
            page.wait_for_timeout(200)
            sp = page.evaluate("() => __spoken.slice(-1)[0]")
            exp = want["english"]
            lang_want = {"android": "en-GB", "ff_samsung": "en-GB"}.get(plat, "en-GB")
            if not sp or sp["voice"] != exp or (exp and sp["lang"] != lang_want):
                probs.append(f"{plat}: say() → {sp}")
            probs += [f"{plat}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    # normalización del idioma de una voz
    page = _page([])
    try:
        got = page.evaluate("""() => ['en_GB', 'eng-GBR-f000', 'da', 'fra-FRA-f000', 'en-GB-SCOTLAND', 'en-gb-x-rp', 'pt-br', 'dan-DNK', '']
          .map(l => vlang({lang: l}).tag)""")
        if got != ["en-GB", "en-GB", "da", "fr-FR", "en-GB", "en-GB", "pt-BR", "da-DK", ""]:
            probs.append(f"vlang: {got}")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_pick_voice_saves_per_device_and_speaks():
    """Tocar una voz en la página del idioma: la página entra (título del idioma, «‹ Voz y velocidad»), «Automática»
    marcada al principio, al tocar Hortense el ✓ pasa a ella (aria-checked, tabindex), suena la muestra en francés con
    esa voz y fr-FR, se guarda en "vocab:voice" (no en voice:français), sigue tras recargar y say() en francés la usa;
    «‹ Voz y velocidad» vuelve con la fila diciendo «Hortense» y el foco en esa fila. Volver a «Automática» la quita.
    El ▶ de una fila solo la deja oír. "vocab:voice" no sale en la exportación (igual a la base)."""
    probs = []
    page = _page(EDGE)
    try:
        _open_voz(page)
        _open_lang(page, "français")
        bar = page.evaluate("""() => ({tt: document.getElementById('aj-tt').textContent, back: document.getElementById('aj-back-t').textContent,
          backVis: !document.getElementById('aj-back').hidden, detent: document.getElementById('ajustes').dataset.detent,
          bw: document.getElementById('aj-back-t').scrollWidth <= document.getElementById('aj-back-t').clientWidth + 1})""")
        if bar["tt"] != "Francés" or bar["back"] != "Voz y velocidad" or not bar["backVis"] or bar["detent"] != "large":
            probs.append(f"barra de la página de francés: {bar}")
        if not bar["bw"]:
            probs.append("«‹ Voz y velocidad» no cabe en la barra")
        L = _list(page, "#ajustes .aj-pg[data-pg=voz-fr]")
        if L["group"] != "Voz del francés" or L["heads"] != ["Francia", "Otros acentos"]:
            probs.append(f"cabeceras {L['heads']} / {L['group']}")
        if not L["radios"] or L["radios"][0]["t"] != "Automática" or not L["radios"][0]["on"] or L["radios"][0]["tab"] != 0:
            probs.append(f"Automática no está marcada: {L['radios'][:1]}")
        if L["radios"][0]["sub"] != "La mejor de este aparato: Denise · Natural":
            probs.append(f"subtítulo de Automática: {L['radios'][0]['sub']!r}")
        names = [x["t"] for x in L["radios"]]
        for want in ("Denise · Natural", "Hortense", "Julie", "Paul", "Sylvie · Natural", "Vivienne · Natural"):
            if want not in names:
                probs.append(f"falta {want!r} en {names}")
        if any("Microsoft" in n or "French" in n for n in names):
            probs.append(f"nombres sin limpiar {names}")
        subs = {x["t"]: x["sub"] for x in L["radios"]}
        if "Necesita internet" not in subs.get("Denise · Natural", "") or subs.get("Hortense", "x") != "" or "Canadá" not in subs.get("Sylvie · Natural", "") \
                or "Voz infantil" not in subs.get("Eloise · Natural", ""):
            probs.append(f"subtítulos {subs}")
        if any(x["h"] < 44 for x in L["radios"]) or any(x["w"] < 44 or x["h"] < 44 for x in L["tries"]):
            probs.append("zonas táctiles de menos de 44 px")
        if any(not x["label"].startswith("Escuchar ") for x in L["tries"]):
            probs.append(f"botones ▶ sin nombre: {L['tries'][:2]}")
        _shot(page, "lista-frances-edge-phone")
        # el ▶ de Paul solo lo deja oír
        page.evaluate("() => { __spoken.length = 0; }")
        page.locator('#ajustes .vl-try[data-v="Microsoft Paul - French (France)"]').click()
        page.wait_for_timeout(120)
        sp = page.evaluate("() => __spoken.slice()")
        if not sp or sp[-1] != {"text": SAMPLE["français"], "lang": "fr-FR", "voice": "Microsoft Paul - French (France)", "rate": 0.9}:
            probs.append(f"▶ de Paul: {sp}")
        if _choice(page):
            probs.append(f"el ▶ guardó una elección: {_choice(page)}")
        # elegir Hortense
        page.locator('#ajustes .vl-pick[data-v="Microsoft Hortense - French (France)"]').click()
        page.wait_for_timeout(120)
        L = _list(page, "#ajustes .aj-pg[data-pg=voz-fr]")
        on = [x["t"] for x in L["radios"] if x["on"]]
        tabs = [x["t"] for x in L["radios"] if x["tab"] == 0]
        if on != ["Hortense"] or tabs != ["Hortense"]:
            probs.append(f"✓ en {on}, tabindex 0 en {tabs}")
        sp = page.evaluate("() => __spoken.slice(-1)[0]")
        if sp != {"text": SAMPLE["français"], "lang": "fr-FR", "voice": "Microsoft Hortense - French (France)", "rate": 0.9}:
            probs.append(f"al elegir suena {sp}")
        if _choice(page) != {"français": "Microsoft Hortense - French (France)"}:
            probs.append(f"vocab:voice = {_choice(page)}")
        if page.evaluate("() => localStorage.getItem('voice:français')") is not None:
            probs.append("se escribió voice:français")
        if page.evaluate("() => vocabSettings.page") != "voz-fr":
            probs.append("elegir cerró la página")
        # volver
        page.locator("#aj-back").click()
        page.wait_for_function("() => vocabSettings.page === 'voz'", timeout=3000)
        page.wait_for_timeout(450)
        rows = {r["vl"]: r for r in _rows(page)}
        if (rows["français"]["val"], rows["français"]["small"]) != ("Hortense", ""):
            probs.append(f"la fila de francés dice {rows['français']}")
        if page.evaluate("() => document.activeElement && document.activeElement.id") != "cfg-l-fr":
            probs.append(f"foco al volver: {page.evaluate('() => document.activeElement && document.activeElement.id')}")
        if page.evaluate("() => (voiceFor('fr-FR') || {}).name") != "Microsoft Hortense - French (France)" \
                or page.evaluate("() => (voiceFor('da-DK') || {}).name") != PLATFORMS["edge"][1]["dansk"] \
                or page.evaluate("() => (voiceFor('en-GB') || {}).name") != PLATFORMS["edge"][1]["english"]:
            probs.append("voiceFor(code) no usa el idioma pedido")
        # la exportación no lleva vocab:voice y sigue igual a la base
        snap = C.export(page)
        if "vocab:voice" in snap["keys"]:
            probs.append("vocab:voice va en la exportación")
        base = C.load_baseline()
        d = C.diff_exports(base, snap, allow_new=False)
        if d:
            probs.append(f"la exportación cambia: {d[:5]}")
        bad = page.evaluate("""() => Object.keys(localStorage).filter(k => !vocabSave.typeOf(k) && !vocabSave.inventory.deviceOnly.includes(k)
            && !vocabSave.inventory.meta.includes(k))""")
        if bad:
            probs.append(f"claves que save.js no conoce: {bad}")
        page.keyboard.press("Escape")
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.getElementById('ajustes').open", timeout=3000)
        # tras recargar sigue, y say() en francés la usa
        C.reload(page)
        page.evaluate("() => { setLang('français'); }")
        page.wait_for_timeout(300)
        page.evaluate("() => { __spoken.length = 0; say('zzq phrase sans audio'); }")
        page.wait_for_timeout(200)
        sp = page.evaluate("() => __spoken.slice(-1)[0]")
        if not sp or sp["voice"] != "Microsoft Hortense - French (France)" or sp["lang"] != "fr-FR":
            probs.append(f"tras recargar, say() en francés: {sp}")
        # volver a «Automática» la quita
        _open_voz(page)
        _open_lang(page, "français")
        page.locator('#ajustes .vl-pick[data-v=""]').click()
        page.wait_for_timeout(120)
        if _choice(page) not in (None, {}):
            probs.append(f"«Automática» deja {_choice(page)}")
        sp = page.evaluate("() => __spoken.slice(-1)[0]")
        if not sp or sp["voice"] != PLATFORMS["edge"][1]["français"]:
            probs.append(f"«Automática» suena con {sp}")
        if page.evaluate("() => (voiceFor('fr-FR') || {}).name") != PLATFORMS["edge"][1]["français"]:
            probs.append("tras «Automática», voiceFor no da la automática")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_legacy_voice_key_is_a_fallback():
    """La elección de antes ("voice:<idioma>", de la partida) se respeta si este aparato no eligió nada, solo si es de
    ese idioma, y nunca se borra ni se cambia; «Automática» guarda "" para mandar sobre ella."""
    probs = []
    old_fr = json.dumps("Microsoft Julie - French (France)")
    old_en = json.dumps("Microsoft Hortense - French (France)")   # de otro idioma: no vale para inglés
    page = _page(EDGE, lang="français", keys={"voice:français": old_fr, "voice:english": old_en})
    try:
        r = page.evaluate("() => ({fr: (voiceFor('fr-FR') || {}).name, en: (voiceFor('en-GB', 'english') || {}).name})")
        if r != {"fr": "Microsoft Julie - French (France)", "en": PLATFORMS["edge"][1]["english"]}:
            probs.append(f"respaldo: {r}")
        _open_voz(page)
        rows = {x["vl"]: x for x in _rows(page)}
        if (rows["français"]["val"], rows["français"]["small"]) != ("Julie", "") or rows["english"]["small"] != "Automática":
            probs.append(f"filas con la elección de antes: {rows}")
        _open_lang(page, "français")
        L = _list(page, "#ajustes .aj-pg[data-pg=voz-fr]")
        if [x["t"] for x in L["radios"] if x["on"]] != ["Julie"]:
            probs.append(f"✓ con la elección de antes: {[x['t'] for x in L['radios'] if x['on']]}")
        page.locator('#ajustes .vl-pick[data-v=""]').click()
        page.wait_for_timeout(100)
        if _choice(page) != {"français": ""}:
            probs.append(f"«Automática» sobre la de antes: {_choice(page)}")
        st = C.storage(page)
        if st.get("voice:français") != old_fr or st.get("voice:english") != old_en:
            probs.append("se tocó voice:<idioma>")
        if page.evaluate("() => (voiceFor('fr-FR') || {}).name") != PLATFORMS["edge"][1]["français"]:
            probs.append("«Automática» no manda sobre la de antes")
        # una elección guardada que este aparato no tiene: «Automática» marcada, sin borrar la elección
        page.evaluate("() => localStorage.setItem('vocab:voice', JSON.stringify({'français': 'Thomas'}))")
        page.locator("#aj-back").click()
        page.wait_for_function("() => vocabSettings.page === 'voz'", timeout=3000)
        page.wait_for_timeout(450)
        _open_lang(page, "français")
        L = _list(page, "#ajustes .aj-pg[data-pg=voz-fr]")
        if [x["t"] for x in L["radios"] if x["on"]] != ["Automática"] or "«Thomas» no está en este aparato" not in L["radios"][0]["sub"]:
            probs.append(f"elección que no está: {L['radios'][:1]}")
        if _choice(page) != {"français": "Thomas"}:
            probs.append("se borró la elección que no está en este aparato")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_no_danish_voice():
    """Windows con Chrome (la captura del dueño, sin voz danesa): la fila de danés dice «No hay voz en este aparato» y su
    página lo explica con la ayuda para añadirla, sin lista; inglés y francés tienen la suya."""
    probs = []
    page = _page(CHROME_WIN, lang="dansk")
    try:
        _open_voz(page)
        rows = {x["vl"]: x for x in _rows(page)}
        if (rows["dansk"]["small"], rows["dansk"]["val"], rows["dansk"]["head"]) != ("No hay voz en este aparato", "", "El idioma que aprendes"):
            probs.append(f"fila de danés: {rows['dansk']}")
        if (rows["english"]["val"], rows["english"]["small"], rows["français"]["val"]) != ("Google · mujer", "Automática", "Google"):
            probs.append(f"filas: {rows}")
        if not page.evaluate("document.querySelector('#ajustes #cfg-t').disabled"):
            probs.append("«Probar la voz» activo sin voz danesa")
        _shot(page, "voz-y-velocidad-chrome-sin-danes-phone")
        _open_lang(page, "dansk")
        L = _list(page, "#ajustes .aj-pg[data-pg=voz-da]")
        if L["radios"] or "aún no tiene voz del danés" not in L["text"] or "Ajustes › Accesibilidad" not in L["text"]:
            probs.append(f"página de danés sin voz: {L['text'][:200]}")
        _shot(page, "lista-danes-sin-voz-phone")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_late_voices_repaint_in_place():
    """Las voces llegan tarde (lista vacía y voiceschanged a los pocos segundos) con la hoja abierta: Voz y velocidad se repinta
    sola (las filas dicen la automática y «Probar la voz» se activa) y, en la página de un idioma, aparece la lista sin
    cambiar de página ni perder el foco. Para mayores muestra la ayuda solo de lo que falta."""
    probs = []
    page = _page(EDGE, delay=4500)
    try:
        _open_voz(page)
        rows = _rows(page)
        if any((r["val"], r["small"]) != ("", "Automática") for r in rows) or not page.evaluate("document.querySelector('#ajustes #cfg-t').disabled"):
            probs.append(f"antes de llegar las voces: {rows}")
        page.wait_for_function("() => voices.length > 0", timeout=9000)
        page.wait_for_timeout(150)
        rows = _rows(page)
        if [r["val"] for r in rows] != ["Sonia", "Denise", "Christel"] or page.evaluate("document.querySelector('#ajustes #cfg-t').disabled"):
            probs.append(f"al llegar las voces: {[r['val'] for r in rows]}")
    finally:
        page.context.close()
    page = _page(EDGE, delay=6000)
    try:
        _open_voz(page)
        _open_lang(page, "english")
        L = _list(page, "#ajustes .aj-pg[data-pg=voz-en]")
        if len(L["radios"]) != 1 or L["radios"][0]["sub"] != "La voz del sistema":
            probs.append(f"sin voces todavía: {L['radios']}")
        page.locator('#ajustes .vl-pick[data-v=""]').focus()
        page.wait_for_function("() => voices.length > 0", timeout=9000)
        page.wait_for_timeout(150)
        L = _list(page, "#ajustes .aj-pg[data-pg=voz-en]")
        if page.evaluate("() => vocabSettings.page") != "voz-en":
            probs.append("cambió de página al llegar las voces")
        if len(L["radios"]) < 5 or L["heads"] != ["Británicas", "Otros acentos"] or L["radios"][1]["t"] != "Sonia · Natural":
            probs.append(f"lista al llegar las voces: {[x['t'] for x in L['radios']]} {L['heads']}")
        if page.evaluate("() => document.activeElement && document.activeElement.matches('.vl-pick[data-v=\"\"]')") is not True:
            probs.append("perdió el foco al repintar")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_cfg_sheet_fallback():
    """La hoja de voz propia (dialog#cfg, la de antes de «⚙️ Voz»; hoy queda por si js/settings.js no carga): las mismas
    filas, la página de un idioma entra dentro con «‹ Voz y velocidad», elegir guarda, Esc vuelve (no cierra) y «Listo»
    cierra."""
    probs = []
    page = _page(IOS, lang="français")
    try:
        page.evaluate("() => openCfg(null, null)")
        page.wait_for_selector("dialog#cfg[open]", timeout=3000)
        page.wait_for_timeout(400)
        rows = _rows(page, "#cfg")
        if [r["vl"] for r in rows] != ["français", "english", "dansk"] or (rows[0]["val"], rows[0]["small"]) != ("Marie", "Automática"):
            probs.append(f"filas en dialog#cfg: {rows}")
        page.locator("#cfg #cfg-l-en").click()
        page.wait_for_timeout(400)
        r = page.evaluate("""() => ({tt: document.getElementById('cfg-tt').textContent, back: !document.getElementById('cfg-back').hidden,
          voz: document.querySelector('#cfg .cfg-pg[data-pg=voz]').hidden})""")
        if r != {"tt": "Inglés", "back": True, "voz": True}:
            probs.append(f"página de inglés en dialog#cfg: {r}")
        L = _list(page, "#cfg .cfg-pg[data-vl]")
        names = [x["t"] for x in L["radios"]]
        if names[:4] != ["Automática", "Martha", "Daniel", "Arthur"] or L["heads"] != ["Británicas", "Otros acentos"] or L["more"] != "false":
            probs.append(f"lista iOS de inglés: {names} {L['heads']} {L['more']}")
        if any(n in JOKES for n in names) or "Eddy" in [x["t"] for x in L["radios"] if x["shown"]]:
            probs.append(f"voces de broma o robóticas a la vista: {names}")
        others = {x["t"]: x["sub"] for x in L["radios"]}
        if others.get("Moira") != "Irlanda" or others.get("Samantha") != "Estados Unidos":
            probs.append(f"acentos: {others}")
        _shot(page, "lista-ingles-ios-cfg-phone")
        page.locator("#cfg .vl-more").click()
        L = _list(page, "#cfg .cfg-pg[data-vl]")
        shown = [x["t"] for x in L["radios"] if x["shown"]]
        if L["more"] != "true" or "Eddy" not in shown or "Fred" not in shown:
            probs.append(f"«Más voces» no se abre: {shown}")
        page.locator('#cfg .vl-pick[data-v="Daniel"]').click()
        page.wait_for_timeout(100)
        if _choice(page) != {"english": "Daniel"}:
            probs.append(f"elegir en dialog#cfg: {_choice(page)}")
        sp = page.evaluate("() => __spoken.slice(-1)[0]")
        if sp != {"text": SAMPLE["english"], "lang": "en-GB", "voice": "Daniel", "rate": 0.9}:
            probs.append(f"suena {sp}")
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        if not page.evaluate("document.getElementById('cfg').open") or page.evaluate("document.getElementById('cfg-tt').textContent") != "Voz y velocidad":
            probs.append("Esc en la página de inglés no vuelve a Voz y velocidad")
        rows = {x["vl"]: x for x in _rows(page, "#cfg")}
        if rows["english"]["val"] != "Daniel" or page.evaluate("document.activeElement && document.activeElement.id") != "cfg-l-en":
            probs.append(f"al volver: {rows['english']} foco {page.evaluate('document.activeElement && document.activeElement.id')}")
        page.locator("#cfg-x").click()
        page.wait_for_function("() => !document.getElementById('cfg').open", timeout=3000)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_offline_android_and_keyboard():
    """Sin internet, «Automática» usa una voz del aparato (Hazel, Julie) y una elegida de internet espera a que vuelva
    (sin borrarse). Chrome en Android: u.lang es el de la voz elegida («inglés Estados Unidos» → en-US), que es lo
    único que mira. Teclado: las flechas mueven la elección dentro del grupo."""
    probs = []
    page = _page(EDGE)
    try:
        page.evaluate("() => localStorage.setItem('vocab:voice', JSON.stringify({english: 'Microsoft Libby Online (Natural) - English (United Kingdom)'}))")
        if page.evaluate("() => voiceFor('en-GB').name") != "Microsoft Libby Online (Natural) - English (United Kingdom)":
            probs.append("con internet no usa la elegida")
        page.context.set_offline(True)
        r = page.evaluate("() => ({online: navigator.onLine, en: voiceFor('en-GB').name, fr: voiceFor('fr-FR').name})")
        if r != {"online": False, "en": "Microsoft Hazel - English (United Kingdom)", "fr": "Microsoft Julie - French (France)"}:
            probs.append(f"sin internet: {r}")
        if _choice(page) != {"english": "Microsoft Libby Online (Natural) - English (United Kingdom)"}:
            probs.append("sin internet se borró la elección")
        page.context.set_offline(False)
        # una voz de internet que falla (wifi sin internet): una vez más con la mejor del aparato
        r = page.evaluate("""() => { __spoken.length = 0; const ss = speechSynthesis, sp = ss.speak; let n = 0;
          ss.speak = u => { n++; sp(u); if (n === 1) setTimeout(() => u.onerror && u.onerror({error: 'network'}), 10); };
          say('zzq network phrase'); return new Promise(r => setTimeout(() => { ss.speak = sp; r(__spoken.map(s => s.voice)); }, 300)); }""")
        if r != ["Microsoft Libby Online (Natural) - English (United Kingdom)", "Microsoft Hazel - English (United Kingdom)"]:
            probs.append(f"reintento con la voz del aparato: {r}")
        _open_voz(page)
        _open_lang(page, "english")
        page.locator('#ajustes .vl-pick[aria-checked="true"]').focus()
        page.keyboard.press("ArrowDown")
        page.wait_for_timeout(100)
        on = page.evaluate("() => [...document.querySelectorAll('#ajustes .vl-pick[aria-checked=true]')].map(b => b.dataset.v)")
        foc = page.evaluate("() => document.activeElement.dataset.v")
        if len(on) != 1 or on[0] == "Microsoft Libby Online (Natural) - English (United Kingdom)" or foc != on[0] or _choice(page)["english"] != on[0]:
            probs.append(f"flecha abajo: {on} foco {foc} {_choice(page)}")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = _page(ANDROID)
    try:
        page.evaluate("() => { __spoken.length = 0; say('zzq phrase one'); }")
        page.wait_for_timeout(150)
        a = page.evaluate("() => __spoken.slice(-1)[0]")
        page.evaluate("() => setVoiceChoice('english', 'inglés Estados Unidos')")
        page.evaluate("() => { __spoken.length = 0; say('zzq phrase two'); }")
        page.wait_for_timeout(150)
        b = page.evaluate("() => __spoken.slice(-1)[0]")
        if (a["voice"], a["lang"], b["voice"], b["lang"]) != ("inglés Reino Unido", "en-GB", "inglés Estados Unidos", "en-US"):
            probs.append(f"Android: {a} {b}")
        _open_voz(page)
        _open_lang(page, "english")
        L = _list(page, "#ajustes .aj-pg[data-pg=voz-en]")
        if [(x["t"], x["sub"]) for x in L["radios"][1:3]] != [("Voz del sistema", ""), ("Voz del sistema", "Australia")]:
            probs.append(f"Android, lista: {[(x['t'], x['sub']) for x in L['radios']]}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_voice_screens():
    """Capturas (con VOCES_SHOTS=1): Voz y velocidad con la lista de iOS y la de Edge en Windows, las listas de inglés y
    francés, danés sin voz, en móvil claro y oscuro, y escritorio; sin errores."""
    if not os.environ.get("VOCES_SHOTS"):
        return
    probs = []
    for scheme in ("light", "dark"):
        for plat, vs in (("ios", IOS), ("edge", EDGE)):
            page = _page(vs, color_scheme=scheme)
            try:
                _open_voz(page)
                _shot(page, f"voz-y-velocidad-{plat}-phone-{scheme}")
                _open_lang(page, "english")
                _shot(page, f"lista-ingles-{plat}-phone-{scheme}")
                page.locator("#aj-back").click()
                page.wait_for_function("() => vocabSettings.page === 'voz'", timeout=3000)
                _open_lang(page, "français")
                page.locator('#ajustes .vl-pick:not([data-v=""])').nth(1).click()
                page.wait_for_timeout(200)
                _shot(page, f"lista-frances-{plat}-phone-{scheme}")
                probs += C.errors(page)
            finally:
                page.context.close()
        page = _page(CHROME_WIN, color_scheme=scheme)
        try:
            _open_voz(page)
            _open_lang(page, "dansk")
            _shot(page, f"lista-danes-sin-voz-phone-{scheme}")
            probs += C.errors(page)
        finally:
            page.context.close()
        page = _page(EDGE, kind="desk", color_scheme=scheme)
        try:
            _open_voz(page)
            _shot(page, f"voz-y-velocidad-edge-desk-{scheme}")
            _open_lang(page, "english")
            _shot(page, f"lista-ingles-edge-desk-{scheme}")
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)
