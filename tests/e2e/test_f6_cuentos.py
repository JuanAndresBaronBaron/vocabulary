"""F6i (SPEC §5-I): «Cuentos del zorro» (js/stories.js, data/stories/).

Cuatro cuentos por idioma (inglés, francés y danés) en data/stories/<en|fr|da>/*.json con su índice
data/stories/index.json: 8-12 páginas por camino, frases cortas, casi todas las palabras del corpus (con su id) y cada
página con dibujos que existen (img/ o img/pj/); a mitad, una elección con dos tarjetas con dibujo que lleva a dos
finales. #/cuentos es la estantería (el primero siempre abierto; los demás, con candado y «Aprende N palabras más de
este cuento» hasta saber el 90 % de sus palabras, mirado en srsAll() al pintar). #/cuento/<id> es el cuento en modo
foco: dibujo grande, texto grande, se pasa de página deslizando o con ‹ y «Siguiente»; cada página se lee sola con la
voz elegida del idioma (useVoice) y la palabra que suena se ilumina (por tiempo y, si el navegador da onboundary, por
su charIndex); tocar una palabra la dice despacio (su mp3 si lo tiene) y abre un globo con su IPA, su traducción y su
dibujo. Al acabar, award() una vez por cuento (3 cuentos pagados al día), la medalla «Ratón de biblioteca» con 4
cuentos y "story-done" para los atajos de Hoy. Se lee sin conexión (el servidor parado) y la partida exportada es la de
la base salvo la clave nueva "cuentos".

Voz del navegador de mentira (window.__spoken: lo que se dice, con su voz, lang y velocidad; window.__ev: empieza,
cada palabra con la palabra iluminada en ese momento, acaba), con onstart y, con boundary, onboundary por palabra; audio
grabado espiado (window.__played: src y velocidad)."""
from __future__ import annotations

import datetime as _dt
import json
import math
import re
import time
import urllib.request

import common as C

OUT = C.CAPTURAS / "F6"
_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
_A11Y = (C.HERE / "a11y.js").read_text(encoding="utf-8")
IDX = json.loads((C.REPO / "data" / "stories" / "index.json").read_text(encoding="utf-8"))
AB = {"english": "en", "français": "fr", "dansk": "da"}
CODE = {"english": "en-GB", "français": "fr-FR", "dansk": "da-DK"}
CHOSEN = {"english": "Daniel", "français": "Thomas", "dansk": "Sara"}
TINTS = {"green", "yellow", "blue", "teal"}
TOK = re.compile(r"[^\W_]+(?:['’\-][^\W_]+)*")
IPA_RE = re.compile(r"^/[^/]+/$")


def _v(name, lang, local=True):
    return {"name": name, "lang": lang, "localService": local, "default": False, "voiceURI": name}


# la del aparato y una mejor de internet por idioma: la elegida (CHOSEN) no es la que pondría «Automática»
VOICES = [_v("Google UK English Female", "en-GB", False), _v("Daniel", "en-GB"), _v("Samantha", "en-US"),
          _v("Google français", "fr-FR", False), _v("Thomas", "fr-FR"), _v("Sara", "da-DK")]

_TTS = r"""
(cfg => {
  const ss = window.speechSynthesis; if (!ss) return;
  const list = cfg.voices.map(v => Object.freeze(Object.assign({}, v)));
  window.__spoken = []; window.__ev = [];
  let cur = null, q = [], tm = [];
  const later = (ms, f) => { tm.push(setTimeout(f, ms)); };
  const litNow = () => { try { const s = window.vocabStories && vocabStories.state(); return s ? s.lit : null; } catch (e) { return null; } };
  function run() {
    if (cur || !q.length) return;
    const u = cur = q.shift();
    /* como una voz de verdad: cada palabra dura según sus letras (62 ms por letra a velocidad 1) y hay pausa tras la
       coma (200 ms) y el punto (330 ms) */
    const r = Math.max(.1, u.rate || 1), words = [...String(u.text).matchAll(/\S+/g)];
    const dur = words.map(m => ((m[0].length + 1) * (cfg.ms || 62) + (/[,;:]$/.test(m[0]) ? 200 : /[.!?…]$/.test(m[0]) ? 330 : 0)) / r);
    const at = dur.map((d, i) => dur.slice(0, i).reduce((a, b) => a + b, 0)), total = dur.reduce((a, b) => a + b, 0);
    later(30, () => {
      if (cur !== u) return;
      window.__ev.push({k: 'start', t: u.text});
      if (u.onstart) u.onstart({});
      words.forEach((m, i) => later(at[i], () => {
        if (cur !== u) return;
        if (cfg.boundary && u.onboundary) u.onboundary({name: 'word', charIndex: m.index, charLength: m[0].length});
        window.__ev.push({k: 'word', t: u.text, w: m[0], ci: m.index, lit: litNow()});
      }));
      later(total + 10, () => {
        if (cur !== u) return;
        cur = null; window.__ev.push({k: 'end', t: u.text});
        if (u.onend) u.onend({});
        run();
      });
    });
  }
  Object.defineProperty(ss, 'getVoices', {configurable: true, writable: true, value: () => list.slice()});
  Object.defineProperty(ss, 'speak', {configurable: true, writable: true, value: u => {
    window.__spoken.push({text: String(u.text || ''), lang: String(u.lang || ''), voice: u.voice ? u.voice.name : null, rate: u.rate});
    q.push(u); run();
  }});
  Object.defineProperty(ss, 'cancel', {configurable: true, writable: true, value: () => {
    tm.forEach(clearTimeout); tm = []; q = [];
    const u = cur; cur = null;
    if (u && u.onerror) setTimeout(() => { try { u.onerror({error: 'interrupted'}); } catch (e) {} }, 0);
  }});
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t == null ? '' : String(t); this.lang = ''; this.rate = 1;
    this.pitch = 1; this.volume = 1; this.voice = null; this.onstart = this.onend = this.onerror = this.onboundary = null; } };
})
"""
_MEDIA = r"""
(() => {
  window.__played = [];
  HTMLMediaElement.prototype.play = function () {
    window.__played.push({src: this.src, rate: this.playbackRate});
    setTimeout(() => this.dispatchEvent(new Event('ended')), 80);
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function () {};
})();
"""
_ST = "() => vocabStories.state()"
# el tamaño que se ve de cada dibujo de la página (object-fit: contain) y de sus pegatinas
_ART = """() => { const a = document.querySelector('#st-stage .st-art'); if (!a) return null;
  const vis = i => { const r = i.getBoundingClientRect(), k = Math.min(r.width / (i.naturalWidth || 1), r.height / (i.naturalHeight || 1));
    return [Math.round(i.naturalWidth * k), Math.round(i.naturalHeight * k)]; };
  return {n: +a.dataset.n, big: [...a.querySelectorAll('.st-big')].map(vis), stk: [...a.querySelectorAll('.st-stk')].map(vis)}; }"""
_SPY = """() => { if (window.__aw) return; window.__aw = [];
  const a0 = window.award; window.award = function(n, why, quiet, from){ window.__aw.push([n, why, !!quiet, !!from]); return a0.apply(this, arguments); };
  window.__done = []; bus.on('story-done', d => window.__done.push(d)); }"""
_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""
# deslizar con PointerEvents sintéticos (como un dedo) en el centro de la página del cuento
_SWIPE = """async dx => {
  const el = document.getElementById('st-stage'), r = el.getBoundingClientRect();
  const x0 = r.left + r.width / 2, y0 = r.top + Math.min(r.height / 2, innerHeight / 3), pause = ms => new Promise(f => setTimeout(f, ms));
  const ev = (type, x, b) => new PointerEvent(type, {pointerId: 41, pointerType: 'touch', isPrimary: true, button: 0, buttons: b,
    clientX: x, clientY: y0, bubbles: true, cancelable: true, composed: true});
  el.dispatchEvent(ev('pointerdown', x0, 1));
  for (let k = 1; k <= 8; k++) { await pause(16); el.dispatchEvent(ev('pointermove', x0 + dx * k / 8, 1)); }
  el.dispatchEvent(ev('pointerup', x0 + dx, 0));
  await pause(30); }"""
# lo que se ilumina, en orden (cada vez que una palabra recibe .is-say)
_LITLOG = """() => { window.__lit = [];
  new MutationObserver(ms => { for (const m of ms) { const t = m.target;
    if (m.type === 'attributes' && t.classList && t.classList.contains('st-u') && t.classList.contains('is-say') && !(m.oldValue || '').includes('is-say'))
      window.__lit.push({u: +t.dataset.u, w: t.textContent, p: vocabStories.state() ? vocabStories.state().p : -1}); } })
    .observe(document.getElementById('st-stage'), {subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true}); }"""


# ---------------------------------------------------------------- utilidades
def _page(kind="phone", boundary=False, voices=None, ctx=None, **kw):
    cfg = json.dumps({"voices": VOICES if voices is None else voices, "boundary": boundary, "ms": 62}, ensure_ascii=False)
    if ctx is None:
        page = C.new_page(kind, **kw)
        target = page.context
    else:
        target = ctx
    target.add_init_script(f"{_TTS}({cfg})")
    target.add_init_script(_MEDIA)
    return page if ctx is None else ctx.new_page()


def _keys(lang=None, now=C.FIXED_NOW, srs_extra=None, **extra):
    k = C.seed_keys(now)
    if lang:
        k["lang"] = json.dumps(lang, ensure_ascii=False)
    k["vocab:voice"] = json.dumps(CHOSEN, ensure_ascii=False)
    if srs_extra:
        L = lang or "english"
        srs = json.loads(k.get(f"srs:{L}") or "{}")
        tpl = next(iter(srs.values()), None) or next(iter(json.loads(k["srs:english"]).values()))
        for w in srs_extra:
            srs.setdefault(w, dict(tpl))
        k[f"srs:{L}"] = json.dumps(srs, ensure_ascii=False)
    for a, b in extra.items():
        k[a.replace("__", ":")] = b if isinstance(b, str) else json.dumps(b, ensure_ascii=False)
    return k


def _open(page, hash="#/cuentos", keys=None):
    C.seed(page, keys=keys if keys is not None else _keys(), hash=hash)
    if hash.startswith("#/cuentos"):
        page.wait_for_selector("#st-grid .st-cv", timeout=10000)
    elif hash.startswith("#/cuento/"):
        page.wait_for_selector("#st-stage .st-page", timeout=10000)
    page.wait_for_timeout(150)


def _state(page):
    return page.evaluate(_ST)


def _wait_state(page, cond_js, timeout=6000):
    page.wait_for_function(f"() => {{ const s = vocabStories.state(); return !!s && ({cond_js}); }}", timeout=timeout)


def _story(sid):
    L = next(L for L, ab in AB.items() if sid.startswith(ab + "-"))
    e = next(x for x in IDX[L] if x["id"] == sid)
    return json.loads((C.REPO / e["file"]).read_text(encoding="utf-8")), e


def _path_texts(s, key):
    o = next(x for x in s["choice"]["opts"] if x["key"] == key)
    return [p["t"] for p in s["pages"]] + [s["choice"]["t"]] + [p["t"] for p in o["pages"]]


def _units(text, gloss, pgl=None):
    gl = dict(gloss)
    gl.update(pgl or {})
    toks = [m.group(0) for m in TOK.finditer(text)]
    out, i = [], 0
    while i < len(toks):
        hit = None
        for n in (3, 2, 1):
            if i + n <= len(toks):
                k = " ".join(t.lower().replace("’", "'") for t in toks[i:i + n])
                if k in gl:
                    hit = (k, n)
                    break
        if not hit:
            out.append((toks[i], None))
            i += 1
        else:
            out.append((hit[0], gl[hit[0]]))
            i += hit[1]
    return out


_ROWS = {}


def _corpus(rid):
    doc, es = rid.split("|", 1)
    if doc not in _ROWS:
        p = C.REPO / "data" / f"{doc}.json"
        _ROWS[doc] = {r.get("es"): r for r in json.loads(p.read_text(encoding="utf-8")).get("rows", [])} if p.exists() else {}
    return _ROWS[doc].get(es)


def _seed_srs(L="english"):
    return set(json.loads(C.seed_keys()[f"srs:{L}"]).keys())


def _lock(e, known):
    ids = [w["id"] for w in e["words"]]
    need = math.ceil(0.9 * len(ids) - 1e-9)
    has = sum(1 for i in ids if i in known)
    free = e["n"] == 1
    return {"open": free or has >= need, "left": 0 if (free or has >= need) else need - has, "free": free,
            "miss": [i for i in ids if i not in known]}


def _quiz(page, st, right=True):
    """En una pregunta de «¿Te acuerdas?» sin contestar, toca el dibujo bueno (o el primero malo con right=False)."""
    q = st["quiz"]
    if q["pick"] is None:
        j = q["ok"] if right else next(i for i in range(len(q["opts"])) if i != q["ok"])
        page.locator(f"#st-stage .st-qo[data-i='{j}']:not(.st-ghost *)").click()   # no la de la página que se va
        _wait_state(page, f"s.p !== {st['p']} || s.fin || (!!s.quiz && s.quiz.pick !== null)")


def _read(page, key, how="buttons", wait_auto=False):
    """Lee el cuento abierto hasta «The End» eligiendo key: how = "buttons" (‹ y «Siguiente») o "swipe". Las preguntas
    de «¿Te acuerdas?» de antes del final se contestan con el dibujo bueno. Devuelve los textos de las páginas por las
    que pasó (sin la portada ni las preguntas)."""
    seen = []
    for _ in range(36):
        st = _state(page)
        if st["fin"]:
            return seen
        if st["kind"] == "quiz":
            _quiz(page, st)
        elif st["kind"] != "cover":
            seen.append(st["text"])
        if st["kind"] == "choice":
            if not st["ch"]:
                page.locator(f".st-opt[data-k='{key}']").click()
                _wait_state(page, f"s.ch === {json.dumps(key)}")
            if wait_auto:   # después de elegir pasa sola de página (≥ 0,9 s, tras decir la opción)
                _wait_state(page, f"s.p > {st['p']} || s.fin", 6000)
                continue
        p0 = st["p"]
        if how == "swipe":
            page.evaluate(_SWIPE, -0.6 * page.viewport_size["width"])
        else:
            page.locator("#st-next").click()
        _wait_state(page, f"s.p > {p0} || s.fin", 4000)
    raise AssertionError("el cuento no se acaba en 36 páginas")


# ---------------------------------------------------------------- 1. los datos
def test_stories_format_corpus_and_images():
    """Los 12 cuentos (4 por idioma, n = 1..4) tienen el formato de api: título y traducción, portada y tinte, palabras del
    cuento con su id del corpus (que existe y tiene ese idioma), glosa para cada palabra del texto (es, IPA /…/, id del
    corpus que existe, dibujo que existe), 8-12 páginas por camino, frases cortas (≤ 13 palabras, ≤ 3 frases por página),
    la elección con dos opciones distintas con dibujo, el ≥ 85 % de las palabras del texto del corpus, y cada dibujo
    (páginas, opciones, glosas, portadas) responde 200 en el servidor. El índice dice lo mismo que cada fichero."""
    probs, imgs = [], set()
    assert IDX.get("v") == 1, "data/stories/index.json sin v: 1"
    for L, ab in AB.items():
        lst = IDX.get(L) or []
        if [e["n"] for e in lst] != [1, 2, 3, 4]:
            probs.append(f"{L}: n de la estantería {[e.get('n') for e in lst]}")
        for e in lst:
            sid = e["id"]
            s, _ = _story(sid)
            where = f"{sid}"
            for k in ("v", "id", "lang", "n", "title", "es", "short", "cover", "tint", "words", "gloss", "pages", "choice"):
                if k not in s:
                    probs.append(f"{where}: falta {k}")
            if s.get("id") != sid or s.get("lang") != L or not sid.startswith(ab + "-"):
                probs.append(f"{where}: id/lang {s.get('id')}/{s.get('lang')}")
            for k in ("title", "es", "short", "cover", "tint", "n"):
                if e.get(k) != s.get(k):
                    probs.append(f"{where}: el índice dice {k}={e.get(k)!r} y el cuento {s.get(k)!r}")
            if e.get("words") != s.get("words"):
                probs.append(f"{where}: las palabras del índice no son las del cuento")
            if s.get("tint") not in TINTS:
                probs.append(f"{where}: tinte {s.get('tint')!r}")
            imgs.add(s["cover"])
            if not s["cover"].startswith("img/pj/"):
                probs.append(f"{where}: la portada no es un dibujo grande de img/pj/: {s['cover']}")
            # palabras del cuento (cuentan para abrirlo)
            for w in s["words"]:
                r = _corpus(w["id"])
                if not r or L not in (r.get("l") or {}):
                    probs.append(f"{where}: palabra del cuento {w['id']!r} no está en el corpus en {L}")
                if w.get("img"):
                    imgs.add(w["img"])
            gl = s["gloss"]
            for k, g in gl.items():
                if not isinstance(g, dict) or not g.get("es") or not IPA_RE.match(g.get("ipa") or ""):
                    probs.append(f"{where}: glosa mala {k!r}: {g}")
                    continue
                if g.get("id"):
                    r = _corpus(g["id"])
                    if not r or L not in (r.get("l") or {}):
                        probs.append(f"{where}: la glosa {k!r} apunta a {g['id']!r}, que no está en el corpus en {L}")
                if g.get("img"):
                    imgs.add(g["img"])
            used_ids = set()
            pages = list(s["pages"]) + [s["choice"]] + [p for o in s["choice"]["opts"] for p in o["pages"]]
            n_u = n_id = 0
            for i, p in enumerate(pages):
                for k in ("img", "t", "es"):
                    if not isinstance(p.get(k), str) or not p.get(k):
                        probs.append(f"{where} página {i}: falta {k}")
                imgs.add(p["img"])
                for a in p.get("also") or []:
                    imgs.add(a)
                if len(p.get("also") or []) > 2:
                    probs.append(f"{where} página {i}: más de 2 dibujos extra")
                pgl = p.get("gl") or {}
                for k, g in pgl.items():
                    if not IPA_RE.match(g.get("ipa") or "") or not g.get("es"):
                        probs.append(f"{where} página {i}: glosa de página mala {k!r}")
                for u, g in _units(p["t"], gl, pgl):
                    n_u += 1
                    if g is None:
                        probs.append(f"{where} página {i}: «{u}» sin glosa en «{p['t']}»")
                    elif g.get("id"):
                        n_id += 1
                        used_ids.add(g["id"])
                sents = [x for x in re.split(r"(?<=[.!?…])\s+", p["t"]) if x.strip()]
                if len(sents) > 3 or any(len(x.split()) > 13 for x in sents):
                    probs.append(f"{where} página {i}: frases largas para A1: «{p['t']}»")
            if n_u and n_id / n_u < 0.85:
                probs.append(f"{where}: solo el {n_id / n_u:.0%} de las palabras del texto son del corpus")
            miss = [w["id"] for w in s["words"] if w["id"] not in used_ids]
            if miss:
                probs.append(f"{where}: palabras del cuento que no salen en el texto: {miss}")
            for u, g in _units(s["title"], gl):
                if g is None:
                    probs.append(f"{where}: «{u}» del título sin glosa")
            opts = s["choice"]["opts"]
            if len(opts) != 2 or len({o["key"] for o in opts}) != 2:
                probs.append(f"{where}: la elección necesita 2 opciones distintas")
            for o in opts:
                imgs.add(o["img"])
                for u, g in _units(o["t"], gl):
                    if g is None:
                        probs.append(f"{where}: «{u}» de la opción {o['key']} sin glosa")
                n = len(s["pages"]) + 1 + len(o["pages"])
                if not 8 <= n <= 12:
                    probs.append(f"{where}: el camino de {o['key']} tiene {n} páginas (8-12)")
                if not o["pages"]:
                    probs.append(f"{where}: el final {o['key']} no tiene páginas")
            if [p["t"] for p in opts[0]["pages"]] == [p["t"] for p in opts[1]["pages"]]:
                probs.append(f"{where}: los dos finales son iguales")
    # todos los dibujos existen y el servidor los da
    srv = C.serve()
    for u in sorted(imgs):
        if not (u.startswith("img/") and (C.ROOT / u).is_file()):
            probs.append(f"dibujo que no existe: {u}")
            continue
        try:
            with urllib.request.urlopen(f"{srv.url}/{u}", timeout=10) as r:
                if r.status != 200:
                    probs.append(f"{u}: HTTP {r.status}")
        except Exception as err:  # noqa: BLE001
            probs.append(f"{u}: {err}")
    assert not probs, f"{len(probs)} problemas en los cuentos:\n  " + "\n  ".join(probs[:60])


# ---------------------------------------------------------------- 2. la estantería
def test_shelf_first_free_rest_locked_by_seeded_srs():
    """Con la partida sembrada (inglés): el primer cuento abierto sin candado y «¡Nuevo!»; cada uno de los demás abierto
    o cerrado según sepa el 90 % de sus palabras (el número de «Aprende N palabras más» sale de los datos y del repaso
    sembrado); hay alguno cerrado. Tocar uno cerrado abre la hoja con las palabras que faltan (dibujo, palabra, IPA y
    altavoz) e «Ir al camino»; un enlace directo a uno cerrado vuelve a la estantería con su hoja. Al aprender las que
    faltan (más palabras en el repaso), se abre y da un saltito. En francés, la estantería es la francesa. Portadas grandes
    a 360 y 390 px, la cápsula «Juegos» y la pestaña Jugar."""
    probs = []
    known = _seed_srs("english")
    exp = {e["id"]: _lock(e, known) for e in IDX["english"]}
    assert exp["en-play"]["free"] and any(not x["open"] for x in exp.values()), f"la siembra no cierra ninguno: {exp}"
    locked = [sid for sid, x in exp.items() if not x["open"]]
    page = _page()
    try:
        _open(page)
        got = page.evaluate("""() => [...document.querySelectorAll('#st-grid .st-cv')].map(a => ({id: a.dataset.id, lock: a.classList.contains('is-lock'),
          tag: a.tagName, href: a.getAttribute('href'), pad: !!a.querySelector('.st-lock'), need: (a.querySelector('.st-need') || {}).textContent || '',
          chip: (a.querySelector('.st-chip') || {}).textContent || ''}))""")
        if [g["id"] for g in got] != [e["id"] for e in IDX["english"]]:
            probs.append(f"estantería: {[g['id'] for g in got]}")
        for g in got:
            x = exp[g["id"]]
            if x["open"]:
                if g["lock"] or g["pad"] or g["tag"] != "A" or g["href"] != f"#/cuento/{g['id']}":
                    probs.append(f"{g['id']} debería estar abierto: {g}")
                if "Nuevo" not in g["chip"]:
                    probs.append(f"{g['id']} abierto sin leer sin «¡Nuevo!»: {g['chip']!r}")
            else:
                want = f"Aprende {x['left']} {'palabra' if x['left'] == 1 else 'palabras'} más de este cuento"
                if not (g["lock"] and g["pad"] and g["tag"] == "BUTTON") or g["need"] != want:
                    probs.append(f"{g['id']} debería estar cerrado con «{want}»: {g}")
        st = page.evaluate("() => ({tab: document.documentElement.dataset.tab, back: document.querySelector('#dv-back') ? document.querySelector('#dv-back').getAttribute('href') : null, focus: document.documentElement.dataset.focus || ''})")
        if st != {"tab": "jugar", "back": "#/juegos", "focus": ""}:
            probs.append(f"la estantería no cuelga de Jugar › Juegos: {st}")
        # la hoja de uno cerrado
        sid = locked[0]
        page.locator(f".st-cv[data-id='{sid}']").click()
        page.wait_for_selector("dialog#st-lock-s[open] .st-ls-l li", timeout=6000)
        page.wait_for_function("() => !document.querySelector('#st-ls-l[aria-busy]')", timeout=6000)
        sh = page.evaluate("""() => { const d = document.getElementById('st-lock-s');
          return {n: d.querySelectorAll('.st-ls-l li').length, ipa: [...d.querySelectorAll('.st-ls-l .ipa')].map(x => x.textContent.replace(/IPA: |\\u2060/g, '')),
            say: d.querySelectorAll('.st-ls-l [data-say]').length, map: !!d.querySelector('a[href="#/mapa"]'), nr: d.hasAttribute('data-no-renew'),
            pics: [...d.querySelectorAll('.st-ls-pic img')].map(i => Math.round(i.getBoundingClientRect().width))}; }""")
        nmiss = len(exp[sid]["miss"])
        if sh["n"] != nmiss or sh["say"] != nmiss or not sh["map"] or not sh["nr"]:
            probs.append(f"hoja de {sid}: {sh} (faltan {nmiss})")
        if len(sh["ipa"]) < nmiss or not all(IPA_RE.match(x) for x in sh["ipa"]):
            probs.append(f"hoja de {sid}: sin IPA en cada palabra: {sh['ipa']}")
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        # enlace directo a uno cerrado: a la estantería con su hoja
        C.goto(page, f"#/cuento/{sid}")
        page.wait_for_timeout(600)
        h = C.current_hash(page)
        if C._norm(h) != C._norm("#/cuentos") or not page.evaluate("() => !!document.querySelector('dialog#st-lock-s[open]')"):
            probs.append(f"enlace a {sid} cerrado: {h}, hoja abierta: {page.evaluate('() => !!document.querySelector(\"dialog#st-lock-s[open]\")')}")
        probs += C.errors(page)
    finally:
        page.context.close()
    # al saber las palabras que faltan, se abre (y da un saltito)
    page = _page()
    try:
        _open(page)
        k = _keys(srs_extra=exp[sid]["miss"])
        C.goto(page, "#/juegos")
        page.evaluate("v => localStorage.setItem('srs:english', v)", k["srs:english"])
        C.reload(page)
        page.evaluate("() => { window.__bumps = []; const b0 = M.bump; M.bump = function(el){ window.__bumps.push(el && el.dataset ? el.dataset.id || '' : ''); return b0.apply(this, arguments); }; }")
        C.goto(page, "#/cuentos")
        page.wait_for_timeout(900)
        g = page.evaluate("id => { const a = document.querySelector(`.st-cv[data-id='${id}']`); return {lock: a.classList.contains('is-lock'), href: a.getAttribute('href')}; }", sid)
        if g["lock"] or g["href"] != f"#/cuento/{sid}":
            probs.append(f"{sid} no se abre al saber sus palabras: {g}")
        if sid not in page.evaluate("() => window.__bumps"):
            probs.append(f"{sid} recién abierto no da el saltito: {page.evaluate('() => window.__bumps')}")
        lk = page.evaluate("id => vocabStories.lock(id)", sid)
        if not lk["open"]:
            probs.append(f"vocabStories.lock({sid}) sigue cerrado: {lk}")
        probs += C.errors(page)
    finally:
        page.context.close()
    # francés y tamaños a 360 / 390 px
    for w in (360, 390):
        page = _page(viewport={"width": w, "height": 780})
        try:
            _open(page, keys=_keys("français"))
            ids = page.evaluate("() => [...document.querySelectorAll('#st-grid .st-cv')].map(a => a.dataset.id)")
            if ids != [e["id"] for e in IDX["français"]]:
                probs.append(f"{w}px francés: {ids}")
            if page.evaluate("() => document.querySelector('.st-cv[data-id=\"fr-play\"]').classList.contains('is-lock')"):
                probs.append(f"{w}px: el primer cuento francés tiene candado")
            sz = page.evaluate("() => [...document.querySelectorAll('.st-cv-art img')].map(i => Math.round(i.getBoundingClientRect().width))")
            if min(sz) < 110:
                probs.append(f"{w}px: portadas pequeñas {sz}")
            if page.evaluate("() => document.documentElement.scrollWidth") > w:
                probs.append(f"{w}px: la estantería tiene scroll horizontal")
            probs += [f"{w}px: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 3. leer
def test_read_whole_story_by_swipe_and_by_buttons():
    """Un cuento entero deslizando (y en la página de elegir, deslizar sin elegir no pasa: las tarjetas brillan) y otro
    entero con «Siguiente» (después de elegir pasa sola de página); ‹ vuelve atrás y en la portada no hay ‹; ← y → del
    teclado también pasan. Modo foco (sin barras, con la ✕ que vuelve a la estantería), barra de progreso, el texto de
    cada página es el del cuento y los dibujos se ven grandes a 360 y 390 px (el lado mayor ≥ 200 px solo, ≥ 170 con
    pegatinas, ≥ 110 px con dos personajes; pegatinas ≥ 60 px)."""
    probs = []
    s, e = _story("en-play")
    for w, how in ((360, "swipe"), (390, "buttons")):
        page = _page(viewport={"width": w, "height": 800})
        try:
            _open(page, "#/cuento/en-play")
            f = page.evaluate("""() => ({focus: document.documentElement.dataset.focus || '', x: (document.querySelector('#fx-x') || {}).getAttribute ? document.querySelector('#fx-x').getAttribute('href') : null,
              tabbar: getComputedStyle(document.querySelector('.tabbar')).display, nr: document.getElementById('st').hasAttribute('data-no-renew'),
              prev: document.getElementById('st-prev').classList.contains('is-off'), title: document.title})""")
            if f["focus"] != "cuento" or f["tabbar"] != "none" or not f["nr"] or not f["prev"] or f["x"] not in ("#/cuentos", "#/"):
                probs.append(f"{w}px: modo foco del cuento: {f}")
            st = _state(page)
            if st["kind"] != "cover" or st["text"] != s["title"]:
                probs.append(f"{w}px: la portada: {st}")
            if how == "swipe":
                page.evaluate(_SWIPE, 0.6 * w)      # en la portada, hacia atrás no pasa nada
                page.wait_for_timeout(300)
                if _state(page)["p"] != 0:
                    probs.append(f"{w}px: deslizar a la derecha en la portada pasó de página")
                # hasta la página de elegir, deslizando
                for _ in range(len(s["pages"]) + 1):
                    p0 = _state(page)["p"]
                    page.evaluate(_SWIPE, -0.6 * w)
                    _wait_state(page, f"s.p > {p0}")
                if _state(page)["kind"] != "choice":
                    probs.append(f"{w}px: tras {len(s['pages']) + 1} deslizamientos no está la elección: {_state(page)}")
                page.evaluate(_SWIPE, -0.6 * w)     # sin elegir no pasa
                page.wait_for_timeout(200)
                nz = page.evaluate("() => document.querySelectorAll('.st-opt.is-nudge').length")
                if _state(page)["kind"] != "choice" or nz != 2:
                    probs.append(f"{w}px: deslizar sin elegir: {_state(page)['kind']}, tarjetas que brillan {nz}")
                arts = page.evaluate("() => [...document.querySelectorAll('.st-opt-pic img')].map(i => Math.round(i.getBoundingClientRect().width))")
                if min(arts) < 120:
                    probs.append(f"{w}px: dibujos de las opciones pequeños {arts}")
                page.evaluate(_SWIPE, 0.6 * w)      # atrás deslizando
                _wait_state(page, "s.kind === 'page'")
                page.evaluate(_SWIPE, -0.6 * w)
                _wait_state(page, "s.kind === 'choice'")
                seen = _read(page, "duck", "swipe")
                want = _path_texts(s, "duck")[len(s["pages"]):]
                if seen != want:
                    probs.append(f"{w}px: deslizando, páginas leídas {seen} ≠ {want}")
            else:
                C.goto(page, "#/cuento/en-play")
                seen = _read(page, "dog", "buttons", wait_auto=True)
                if seen != _path_texts(s, "dog"):
                    probs.append(f"{w}px: con botones, páginas leídas {seen} ≠ {_path_texts(s, 'dog')}")
            st = _state(page)
            if not st["fin"] or st["kind"] != "end":
                probs.append(f"{w}px: no llega a «The End»: {st}")
            bar = page.evaluate("() => document.getElementById('st-bar').getAttribute('aria-valuenow') + '/' + document.getElementById('st-bar').getAttribute('aria-valuemax')")
            if bar != f"{e['pages']}/{e['pages']}":
                probs.append(f"{w}px: barra al final {bar}")
            # ‹ y el teclado
            page.locator("#st-again").click()
            _wait_state(page, "!s.fin")
            p0 = _state(page)["p"]
            page.locator("#st-prev").click()
            _wait_state(page, f"s.p === {p0 - 1}")
            page.keyboard.press("ArrowRight")
            _wait_state(page, f"s.p === {p0}")
            page.keyboard.press("ArrowLeft")
            _wait_state(page, f"s.p === {p0 - 1}")
            small = []
            C.goto(page, "#/cuento/en-play")
            for _ in range(len(_path_texts(s, "dog")) + 1):
                page.wait_for_function("() => [...document.querySelectorAll('#st-stage img')].every(i => i.complete)", timeout=5000)
                a = page.evaluate(_ART)
                st = _state(page)
                if a and (min(max(x) for x in a["big"]) < (200 if a["n"] == 1 and not a["stk"] else 170 if a["n"] == 1 else 110) or any(min(x) < 60 for x in a["stk"])):
                    small.append((st["p"], a))
                if st["kind"] == "choice" and not st["ch"]:
                    page.locator(".st-opt[data-k='dog']").click()
                    _wait_state(page, "!!s.ch")
                if st["p"] >= len(_path_texts(s, "dog")):
                    break
                p1 = st["p"]
                page.locator("#st-next").click()
                _wait_state(page, f"s.p > {p1} || s.fin")
            if small:
                probs.append(f"{w}px: dibujos del cuento pequeños {small}")
            if page.evaluate("() => document.documentElement.scrollWidth") > w:
                probs.append(f"{w}px: el cuento tiene scroll horizontal")
            probs += [f"{w}px: {x}" for x in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 4. la voz
def test_voice_is_chosen_voice_and_words_light_up():
    """Cada página se lee sola, frase a frase, con la voz elegida del idioma (vocab:voice; no la que pondría
    «Automática»), su lang y la velocidad de la app; la tortuga, a SLOW(). Sin onboundary la palabra que suena se ilumina
    por tiempo, en orden, casi todas, y al acabar ninguna; con onboundary, en cada palabra que dice la voz se ilumina
    justo esa. En francés y danés, su voz. Sin voz del danés no se lee con otro acento: lo avisa."""
    probs = []
    s, _ = _story("en-play")
    for boundary in (False, True):
        page = _page(boundary=boundary)
        tag = "con onboundary" if boundary else "por tiempo"
        try:
            _open(page, "#/cuento/en-play")
            page.evaluate(_LITLOG)
            page.locator("#st-next").click()
            page.evaluate("() => { window.__spoken.length = 0; window.__ev.length = 0; window.__lit.length = 0; }")
            text = s["pages"][0]["t"]
            sents = [x for x in re.split(r"(?<=[.!?…])\s+", text) if x.strip()]
            page.wait_for_function("t => window.__ev.some(e => e.k === 'end' && e.t === t)", arg=sents[-1], timeout=8000)
            page.wait_for_timeout(150)
            sp = [x for x in page.evaluate("() => window.__spoken") if x["text"].strip()]
            r = page.evaluate("() => ({rate, slow: SLOW(), pick: pickVoice('english').name, auto: autoVoice('english') ? autoVoice('english').name : null})")
            if [x["text"] for x in sp] != sents:
                probs.append(f"{tag}: frases dichas {[x['text'] for x in sp]} ≠ {sents}")
            bad = [x for x in sp if x["voice"] != "Daniel" or not x["lang"].startswith("en-GB") or abs(x["rate"] - r["rate"]) > 1e-6]
            if bad or r["pick"] != "Daniel" or r["auto"] == "Daniel":
                probs.append(f"{tag}: voz {bad} (elegida {r})")
            st = _state(page)
            lit = page.evaluate("() => window.__lit")
            us = [x["u"] for x in lit if x["p"] == 1]
            if us != sorted(us) or len(set(us)) < 0.7 * len(st["units"]):
                probs.append(f"{tag}: lo iluminado {[(x['u'], x['w']) for x in lit]} de {st['units']}")
            if st["lit"] != -1:
                probs.append(f"{tag}: al acabar sigue iluminada la palabra {st['lit']}")
            if boundary:
                for ev in [x for x in page.evaluate("() => window.__ev") if x["k"] == "word" and x["t"] in sents]:
                    w = re.sub(r"[^\w']", "", ev["w"]).lower()
                    u = st["units"][ev["lit"]].lower() if isinstance(ev["lit"], int) and 0 <= ev["lit"] < len(st["units"]) else ""
                    if w not in u.split():
                        probs.append(f"{tag}: al decir «{ev['w']}» se ilumina «{u}»")
            # la tortuga: despacio
            page.evaluate("() => { window.__spoken.length = 0; window.__ev.length = 0; }")
            page.locator("#st-slow").click()
            page.wait_for_function("t => window.__ev.some(e => e.k === 'start' && e.t === t)", arg=sents[0], timeout=6000)
            sl = [x for x in page.evaluate("() => window.__spoken") if x["text"].strip()]
            if not sl or abs(sl[0]["rate"] - r["slow"]) > 1e-6 or sl[0]["voice"] != "Daniel":
                probs.append(f"{tag}: la tortuga dice {sl} (SLOW = {r['slow']})")
            if not page.evaluate("() => document.getElementById('st-slow').classList.contains('playing')"):
                probs.append(f"{tag}: la tortuga no se rellena mientras suena")
            probs += [f"{tag}: {x}" for x in C.errors(page)]
        finally:
            page.context.close()
    # francés y danés: su voz elegida
    for L, sid in (("français", "fr-play"), ("dansk", "da-play")):
        page = _page(boundary=True)
        try:
            _open(page, f"#/cuento/{sid}", keys=_keys(L))
            page.evaluate("() => { window.__spoken.length = 0; window.__ev.length = 0; }")
            page.locator("#st-next").click()
            page.wait_for_function("() => window.__ev.some(e => e.k === 'end')", timeout=8000)
            sp = [x for x in page.evaluate("() => window.__spoken") if x["text"].strip()]
            if not sp or any(x["voice"] != CHOSEN[L] or not x["lang"].startswith(CODE[L]) for x in sp):
                probs.append(f"{L}: voz {sp}")
            if page.evaluate("() => vocabStories.state().lit") != -1 and not page.evaluate("() => window.__ev.some(e => e.k === 'word' && e.lit >= 0)"):
                probs.append(f"{L}: no se ilumina ninguna palabra")
            probs += [f"{L}: {x}" for x in C.errors(page)]
        finally:
            page.context.close()
    # sin voz del danés
    page = _page(voices=[v for v in VOICES if not v["lang"].startswith("da")])
    try:
        _open(page, "#/cuento/da-play", keys=_keys("dansk"))
        page.evaluate("() => { window.__spoken.length = 0; }")
        page.locator("#st-next").click()
        page.wait_for_timeout(1200)
        note = page.evaluate("() => document.getElementById('st-note').textContent")
        sp = [x for x in page.evaluate("() => window.__spoken") if x["text"].strip()]
        if "danés" not in note or sp:
            probs.append(f"sin voz danesa: aviso {note!r}, dicho {sp}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_tap_word_says_it_slowly_with_ipa_bubble():
    """Tocar una palabra con audio grabado suena su mp3 despacio (0,7) y no la voz; una sin audio, la voz elegida a
    SLOW(). Las dos abren el globo con la palabra, su IPA (ipaHtml), su traducción y su dibujo si lo tiene (≥ 80 px), sin
    salirse de la pantalla; la tortuga del globo la repite; se cierra con la ✕, con Esc y tocando fuera. La palabra
    tocada no es un [data-say] (no cuenta como escucha lenta de los atajos) y el cuento lleva data-no-renew."""
    probs = []
    s, _ = _story("en-play")
    clips = json.loads((C.REPO / "audio" / "en.json").read_text(encoding="utf-8"))
    has = lambda t: t in clips or t.lower() in clips  # noqa: E731
    for w in (360, 390):
        page = _page(viewport={"width": w, "height": 800})
        try:
            _open(page, "#/cuento/en-play")
            page.locator("#st-next").click()
            _wait_state(page, "s.p === 1")
            page.wait_for_timeout(200)
            st = _state(page)
            gl = s["gloss"]
            iw = next(i for i, u in enumerate(st["units"]) if has(u) and gl.get(u.lower(), {}).get("img"))
            jw = None
            for p in range(1, 9):
                st = _state(page)
                jw = next((i for i, u in enumerate(st["units"]) if not has(u)), None)
                if jw is not None:
                    break
                page.locator("#st-next").click()
                _wait_state(page, f"s.p === {p + 1}")
            assert jw is not None, "ninguna palabra sin audio en el cuento"
            # con audio: su mp3 despacio (vuelve a la página de la palabra con audio si hizo falta)
            st = _state(page)
            iw2 = next((i for i, u in enumerate(st["units"]) if has(u)), None)
            for i, mp3 in ((iw2, True), (jw, False)):
                if i is None:
                    continue
                u = st["units"][i]
                page.wait_for_timeout(500)   # la página entra (≤ 300 ms) y empieza a leerse sola (360 ms): el toque la corta
                page.evaluate("() => { window.__spoken.length = 0; window.__played.length = 0; }")
                page.locator(f"#st-txt .st-u[data-u='{i}']").click()
                page.wait_for_selector("#st-bub", timeout=3000)
                page.wait_for_timeout(250)
                pl, sp = page.evaluate("() => window.__played"), [x for x in page.evaluate("() => window.__spoken") if x["text"].strip()]
                slow = page.evaluate("() => SLOW()")
                if mp3:
                    if not pl or "/audio/en/" not in pl[0]["src"] or abs(pl[0]["rate"] - 0.7) > 1e-6 or sp:
                        probs.append(f"{w}px «{u}»: con audio debería sonar el mp3 a 0,7: {pl} / voz {sp}")
                else:
                    if pl or not sp or sp[0]["text"] != u or abs(sp[0]["rate"] - slow) > 1e-6 or sp[0]["voice"] != "Daniel":
                        probs.append(f"{w}px «{u}»: sin audio debería decirla la voz elegida a SLOW(): {sp} / mp3 {pl}")
                g = gl.get(u.lower()) or {}
                b = page.evaluate("""() => { const b = document.getElementById('st-bub'), r = b.getBoundingClientRect(), im = b.querySelector('.st-bub-pic img');
                  return {w: b.querySelector('b').textContent, ipa: (b.querySelector('.ipa') || {}).textContent || '', es: b.querySelector('.st-bub-es').textContent,
                    img: im ? Math.round(im.getBoundingClientRect().width) : 0, l: r.left, r: r.right, t: r.top, bt: r.bottom, ih: innerHeight, iw: innerWidth,
                    inSt: !!b.closest('[data-no-renew]'), say: document.querySelector('#st-txt .st-u[data-say]') !== null}; }""")
                ipa = b["ipa"].replace("IPA: ", "").replace("⁠", "")
                if b["w"] != u.lower() or ipa != g.get("ipa") or b["es"] != g.get("es"):
                    probs.append(f"{w}px «{u}»: globo {b} (glosa {g})")
                if g.get("img") and b["img"] < 80:
                    probs.append(f"{w}px «{u}»: dibujo del globo pequeño ({b['img']} px)")
                if b["l"] < 0 or b["r"] > b["iw"] or b["t"] < 0 or b["bt"] > b["ih"]:
                    probs.append(f"{w}px «{u}»: el globo se sale de la pantalla {b}")
                if not b["inSt"] or b["say"]:
                    probs.append(f"{w}px: globo fuera del data-no-renew o palabras con data-say: {b}")
                # la tortuga del globo
                page.evaluate("() => { window.__spoken.length = 0; window.__played.length = 0; }")
                page.locator("#st-bub-slow").click()
                page.wait_for_timeout(200)
                n = len(page.evaluate("() => window.__played")) + len([x for x in page.evaluate("() => window.__spoken") if x["text"].strip()])
                if n != 1 or not page.evaluate("() => !!document.getElementById('st-bub')"):
                    probs.append(f"{w}px «{u}»: la tortuga del globo suena {n} veces o lo cierra")
            # cerrar: ✕, Esc y tocar fuera
            page.locator("#st-bub-x").click()
            ok1 = page.evaluate("() => !document.getElementById('st-bub')")
            page.locator(f"#st-txt .st-u[data-u='{jw}']").click()
            page.wait_for_selector("#st-bub", timeout=3000)
            page.keyboard.press("Escape")
            ok2 = page.evaluate("() => !document.getElementById('st-bub')")
            page.locator(f"#st-txt .st-u[data-u='{jw}']").click()
            page.wait_for_selector("#st-bub", timeout=3000)
            page.mouse.click(w / 2, 300)
            page.wait_for_timeout(100)
            ok3 = page.evaluate("() => !document.getElementById('st-bub')")
            if not (ok1 and ok2 and ok3):
                probs.append(f"{w}px: el globo no se cierra (✕ {ok1}, Esc {ok2}, fuera {ok3})")
            if page.evaluate("() => document.documentElement.dataset.focus") != "cuento":
                probs.append(f"{w}px: Esc en el globo sacó del cuento")
            probs += [f"{w}px: {x}" for x in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 5. la elección y las monedas
def test_choice_changes_the_ending():
    """Elegir una tarjeta da su final y la otra, el otro (las páginas tras elegir son las de esa opción); al acabar,
    «Otro final» lleva a la elección y «Has encontrado los 2 finales» al ver los dos; "cuentos" guarda los dos finales.
    Recargar a mitad sigue en la misma página con la misma elección. En francés y danés también."""
    probs = []
    for sid, L in (("en-cake", "english"), ("fr-night", "français"), ("da-colours", "dansk")):
        s, e = _story(sid)
        k = _keys(L, srs_extra=[w["id"] for w in e["words"]])
        page = _page()
        try:
            _open(page, f"#/cuento/{sid}", keys=k)
            a, b = [o["key"] for o in s["choice"]["opts"]]
            seen_a = _read(page, a)
            if seen_a != _path_texts(s, a):
                probs.append(f"{sid} {a}: {seen_a}")
            m1 = page.evaluate("() => ({ends: document.querySelectorAll('.st-endc.ok').length, t: document.querySelector('.st-ends-t').textContent, again: document.getElementById('st-again').textContent})")
            if m1["ends"] != 1 or "1 de 2" not in m1["t"] or "Otro final" not in m1["again"]:
                probs.append(f"{sid}: final 1: {m1}")
            page.locator("#st-again").click()
            _wait_state(page, "s.kind === 'choice' && !s.ch")
            # a mitad del otro final, recargar sigue ahí
            page.locator(f".st-opt[data-k='{b}']").click()
            _wait_state(page, f"s.ch === {json.dumps(b)}")
            page.locator("#st-next").click()
            _wait_state(page, "s.kind === 'page'")
            before = _state(page)
            C.reload(page)
            page.wait_for_selector("#st-stage .st-page", timeout=6000)
            after = _state(page)
            if (after["p"], after["ch"], after["text"]) != (before["p"], before["ch"], before["text"]):
                probs.append(f"{sid}: tras recargar {after['p']}/{after['ch']} ≠ {before['p']}/{before['ch']}")
            seen_b = _read(page, b)
            want_b = _path_texts(s, b)[len(s["pages"]) + 1:]
            if seen_b != want_b:
                probs.append(f"{sid} {b}: {seen_b} ≠ {want_b}")
            if seen_a[len(s["pages"]) + 1] == seen_b[0] or seen_a[len(s["pages"]) + 1:] == seen_b:
                probs.append(f"{sid}: los dos finales empiezan igual")
            m2 = page.evaluate("() => ({ends: document.querySelectorAll('.st-endc.ok').length, t: document.querySelector('.st-ends-t').textContent})")
            sv = page.evaluate("id => JSON.parse(localStorage.getItem('cuentos')).done[id]", sid)
            if m2["ends"] != 2 or "2 finales" not in m2["t"] or sorted(sv["e"]) != sorted([a, b]) or sv["n"] != 2:
                probs.append(f"{sid}: final 2: {m2}, guardado {sv}")
            probs += [f"{sid}: {x}" for x in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_award_once_per_story_daily_cap_and_medal():
    """award(10) una sola vez por cuento: al acabarlo la primera vez (con las monedas que vuelan desde el zorro), no al ver
    el otro final, ni al releerlo, ni tras recargar. "story-done" en cada final (first solo la primera vez). Con 3 cuentos
    pagados hoy no paga (lo dice: mañana más) y paga al terminarlo otro día. Con 4 cuentos leídos, la medalla «Ratón de
    biblioteca» (achList k4, +20 por checkAch). Las monedas solo cambian por award() y la medalla."""
    probs = []
    page = _page()
    try:
        _open(page, "#/cuento/en-play")
        page.evaluate(_SPY)
        c0 = page.evaluate("() => game().coins")
        _read(page, "duck")
        page.wait_for_timeout(700)
        aw = page.evaluate("() => window.__aw")
        if aw != [[10, "¡Cuento leído!", False, True]]:
            probs.append(f"primera vez: award {aw}")
        page.locator("#st-again").click()
        _wait_state(page, "s.kind === 'choice'")
        _read(page, "dog")
        page.locator("#st-again").click()          # «Otra vez»: desde la portada
        _wait_state(page, "s.p === 0 && !s.fin")
        _read(page, "duck")
        C.reload(page)                              # tras recargar, el cuento empieza por la portada
        page.wait_for_selector("#st-stage .st-cover", timeout=6000)
        page.evaluate(_SPY)
        _read(page, "dog")
        page.wait_for_timeout(1700)
        aw2, done = page.evaluate("() => window.__aw"), page.evaluate("() => window.__done")
        if aw2:
            probs.append(f"releer pagó otra vez: {aw2}")
        if [d["first"] for d in done] != [False]:
            probs.append(f"story-done tras recargar: {done}")
        sv = page.evaluate("() => JSON.parse(localStorage.getItem('cuentos'))")
        x = sv["done"]["en-play"]
        if x["p"] != 1 or x["n"] != 4 or sorted(x["e"]) != ["dog", "duck"] or sv["pay"]["n"] != 1:
            probs.append(f"guardado: {sv}")
        g = page.evaluate("() => game()")
        if g["coins"] - c0 not in (10, 20):        # 10 del cuento (+10 del regalo del día si la siembra no lo tenía)
            probs.append(f"monedas: {c0} → {g['coins']}")
        probs += C.errors(page)
    finally:
        page.context.close()
    # tope: 3 cuentos pagados hoy
    today = C.day_key(C.FIXED_NOW)
    k = _keys(cuentos={"v": 1, "done": {}, "pay": {"d": today, "n": 3}})
    page = _page()
    try:
        _open(page, "#/cuento/en-play", keys=k)
        page.evaluate(_SPY)
        _read(page, "duck")
        page.wait_for_timeout(700)
        msg = page.evaluate("() => document.querySelector('.st-end-m').textContent")
        aw = page.evaluate("() => window.__aw")
        sv = page.evaluate("() => JSON.parse(localStorage.getItem('cuentos'))")
        if aw or sv["done"]["en-play"]["p"] != 0 or "mañana" not in msg:
            probs.append(f"con 3 pagados hoy: award {aw}, guardado {sv}, mensaje {msg!r}")
        snap2 = C.storage(page)
        probs += C.errors(page)
    finally:
        page.context.close()
    nxt = C.FIXED_NOW + _dt.timedelta(days=1)
    page = _page(now=nxt)
    try:
        _open(page, "#/cuento/en-play", keys=snap2)
        page.evaluate(_SPY)
        _read(page, "dog")
        page.wait_for_timeout(700)
        aw = page.evaluate("() => window.__aw")
        sv = page.evaluate("() => JSON.parse(localStorage.getItem('cuentos'))")
        if aw != [[10, "¡Cuento leído!", False, True]] or sv["pay"] != {"d": C.day_key(nxt), "n": 1}:
            probs.append(f"otro día: award {aw}, guardado {sv}")
        probs += C.errors(page)
    finally:
        page.context.close()
    # la medalla con 4 cuentos
    others = {e["id"]: {"d": today, "e": [], "n": 1, "p": 1} for e in IDX["english"] if e["id"] != "en-play"}
    k = _keys(cuentos={"v": 1, "done": others, "pay": {"d": "2026-03-01", "n": 1}})
    page = _page()
    try:
        _open(page, "#/cuento/en-play", keys=k)
        a0 = page.evaluate("() => ({ok: achList().find(a => a.id === 'k4').ok, got: !!game().ach.k4, coins: game().coins})")
        _read(page, "duck")
        page.wait_for_function("() => !!game().ach.k4", timeout=6000)
        a1 = page.evaluate("() => ({a: achList().find(a => a.id === 'k4'), coins: game().coins})")
        if a0["ok"] or a0["got"] or not a1["a"]["ok"] or a1["a"]["t"] != "Ratón de biblioteca" or a1["a"]["goal"] != 4:
            probs.append(f"medalla: antes {a0}, después {a1}")
        if a1["coins"] - a0["coins"] not in (30, 40):
            probs.append(f"medalla: monedas {a0['coins']} → {a1['coins']} (10 del cuento + 20 de la medalla)")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 6. sin conexión
def test_story_reads_offline_through_service_worker():
    """Con el service worker: se abre la estantería y el cuento con red (sus dibujos se guardan al abrirlo); con el
    servidor parado, al recargar el cuento sale entero (texto y dibujos de cada página, la elección y el final), la
    estantería también, y otro cuento nunca abierto carga su texto del shell. Control: un dibujo nunca visto falla."""
    srv = C.Server(C.ROOT, "localhost")
    ctx = C.new_context("phone", sw=True, server=srv)
    page = _page(ctx=ctx)
    stopped = False
    probs = []
    try:
        C.seed(page, _keys(), "#/cuentos")
        page.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=20000)
        C.reload(page)
        page.wait_for_selector("#st-grid .st-cv", timeout=10000)
        page.wait_for_timeout(500)
        C.goto(page, "#/cuento/en-play")
        page.wait_for_selector("#st-stage .st-page", timeout=10000)
        s, _ = _story("en-play")
        hero = page.evaluate("() => [...heroHtml(120).matchAll(/\\ssrc=\"([^\"]+)\"/g)].map(m => m[1])")
        need = sorted({*hero, s["cover"], *[p["img"] for p in s["pages"]], s["choice"]["img"], *[o["img"] for o in s["choice"]["opts"]],
                       *[a for p in s["pages"] for a in p.get("also") or []], *[p["img"] for o in s["choice"]["opts"] for p in o["pages"]],
                       *[a for o in s["choice"]["opts"] for p in o["pages"] for a in p.get("also") or []]})
        t0 = time.time()
        missing = need
        while time.time() - t0 < 15:
            have = set(page.evaluate("async () => (await (await caches.open('vocab-media')).keys()).map(r => new URL(r.url).pathname.slice(1))"))
            missing = [u for u in need if u not in have]
            if not missing:
                break
            page.wait_for_timeout(250)
        if missing:
            probs.append(f"dibujos del cuento sin guardar tras abrirlo: {missing}")
        shell = page.evaluate("async () => (await caches.keys()).find(n => /^vocab-shell-v/.test(n))")
        sk = set(page.evaluate("async n => (await (await caches.open(n)).keys()).map(r => new URL(r.url).pathname.slice(1))", shell))
        want = {"js/stories.js", "data/stories/index.json", "img/games/cuentos.png"} | {e["file"] for L in AB for e in IDX[L]}
        if want - sk:
            probs.append(f"faltan en el shell: {sorted(want - sk)}")
        never = next(f"img/{p.name}" for p in sorted((C.ROOT / "img").glob("*.png"), reverse=True) if f"img/{p.name}" not in need)
        # sin conexión de verdad
        srv.stop()
        stopped = True
        ctx.set_offline(True)
        C.clear_errors(page)
        C.reload(page)
        page.wait_for_selector("#st-stage .st-page", timeout=10000)
        broken = []
        for _ in range(32):
            st = _state(page)
            if st["fin"]:
                break
            page.wait_for_function("() => [...document.querySelectorAll('#st-stage img')].every(i => i.complete)", timeout=5000)
            broken += page.evaluate("() => [...document.querySelectorAll('#st-stage img')].filter(i => !i.naturalWidth).map(i => i.getAttribute('src'))")
            if st["kind"] == "choice" and not st["ch"]:
                page.locator(".st-opt").first.click()
                _wait_state(page, "!!s.ch")
            if st["kind"] == "quiz":
                _quiz(page, st)
            p0 = st["p"]
            page.locator("#st-next").click()
            _wait_state(page, f"s.p > {p0} || s.fin", 4000)
        if not _state(page)["fin"] or broken:
            probs.append(f"sin conexión: final {_state(page)['fin']}, dibujos rotos {broken}")
        C.goto(page, "#/cuentos")
        page.wait_for_selector("#st-grid .st-cv", timeout=6000)
        n = page.evaluate("() => document.querySelectorAll('#st-grid .st-cv').length")
        js = page.evaluate("() => fetch('data/stories/en/colours.json').then(r => r.json()).then(d => d.id, () => 'falla')")
        miss = page.evaluate("u => fetch(u).then(r => 'ok ' + r.status, () => 'falla')", never)
        if n != 4 or js != "en-colours":
            probs.append(f"sin conexión: estantería {n} cuentos, otro cuento {js}")
        if miss != "falla":
            probs.append(f"sin conexión, {never} (nunca visto) responde {miss}: la prueba no estaría sin red")
        probs += [x for x in C.errors(page) if not x.endswith("/" + never)]   # (el fallo del control es el esperado)
    finally:
        try:
            ctx.set_offline(False)
        except Exception:  # noqa: BLE001
            pass
        ctx.close()
        if not stopped:
            srv.stop()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 7. Jugar, Hoy y la partida
def test_juegos_card_and_hoy_shortcut():
    """En Jugar › Juegos, la tarjeta «Cuentos del zorro» con su dibujo lleva a #/cuentos. Acabar un cuento suma un punto
    al atajo "en/cuento:en-play" (vocab:sc) y, con puntos, «Tus atajos» de Hoy lo enseña (dibujo de los cuentos, insignia
    de la portada, «Cuento» / «A jugar») y lleva al cuento; Hoy sigue sin scroll a 390×844."""
    probs = []
    page = _page()
    try:
        _open(page, "#/juegos")
        page.wait_for_selector(".gm-card[data-g=cuentos]", timeout=6000)
        c = page.evaluate("() => { const a = document.querySelector('.gm-card[data-g=cuentos]'); return {href: a.getAttribute('href'), img: (a.querySelector('img') || {}).getAttribute ? a.querySelector('img').getAttribute('src') : '', t: a.textContent}; }")
        if c["href"] != "#/cuentos" or c["img"] != "img/games/cuentos.png" or "Cuentos del zorro" not in c["t"]:
            probs.append(f"tarjeta de Juegos: {c}")
        page.locator(".gm-card[data-g=cuentos]").click()
        page.wait_for_selector("#st-grid", timeout=6000)
        C.goto(page, "#/cuento/en-play")
        _read(page, "duck")
        sc = page.evaluate("() => JSON.parse(localStorage.getItem('vocab:sc') || '{}')")
        if not (sc.get("k") or {}).get("en/cuento:en-play"):
            probs.append(f"acabar el cuento no suma al atajo: {sc}")
        it = page.evaluate("() => vocabStories.shortcut('en-play')")
        if not it or it.get("href") != "#/cuento/en-play" or it.get("img") != "img/games/cuentos.png" or (it.get("badge") or {}).get("img") != "img/pj/zorro.png":
            probs.append(f"vocabStories.shortcut: {it}")
        if page.evaluate("() => vocabStories.shortcut('en-night')") is not None:
            probs.append("un cuento cerrado da atajo")
        probs += C.errors(page)
    finally:
        page.context.close()
    d = C.day_num(C.FIXED_NOW)
    k = _keys(**{"vocab:sc": {"v": 1, "k": {"en/cuento:en-play": {"s": 4, "t": d}}, "row": {}, "o": {}, "sl": ""}})
    page = _page(viewport={"width": 390, "height": 844})
    try:
        _open(page, "", keys=k)
        page.wait_for_selector("#hm-sc", timeout=6000)
        p = page.evaluate("""() => { const a = document.querySelector('#hm-sc a[data-sc="en/cuento:en-play"]'); if (!a) return null;
          return {href: a.getAttribute('href'), label: a.getAttribute('aria-label'), act: a.querySelector('.sc-a').textContent, top: a.querySelector('.sc-tp').textContent,
            imgs: [...a.querySelectorAll('img')].map(i => i.getAttribute('src'))}; }""")
        if not p or p["href"] != "#/cuento/en-play" or p["act"] != "Cuento" or p["top"] != "A jugar" or "img/pj/zorro.png" not in p["imgs"]:
            probs.append(f"atajo en Hoy: {p}")
        fit = page.evaluate("() => ({sh: document.documentElement.scrollHeight, ih: innerHeight})")
        if fit["sh"] > fit["ih"] + 1:
            probs.append(f"Hoy con el atajo del cuento tiene scroll: {fit}")
        if p:
            page.locator('#hm-sc a[data-sc="en/cuento:en-play"]').click()
            page.wait_for_selector("#st-stage .st-page", timeout=6000)
            if page.evaluate("() => document.documentElement.dataset.focus") != "cuento":
                probs.append("el atajo no abre el cuento en modo foco")
            x = page.evaluate("() => document.querySelector('#fx-x').getAttribute('href')")
            if x != "#/":
                probs.append(f"la ✕ del cuento abierto desde Hoy lleva a {x}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_export_matches_baseline():
    """La partida sembrada, tras Juegos, la estantería y un cuento leído hasta la elección (sin acabar), se exporta igual
    que tests/e2e/baseline/export.json (sin claves nuevas); al acabarlo, la única clave nueva es "cuentos" (registrada en
    js/save.js como EXACT) y game cambia solo por las monedas de award()."""
    base = C.load_baseline()
    assert base, "falta tests/e2e/baseline/export.json"
    probs = []
    page = _page()
    try:
        _open(page, "#/juegos")
        C.goto(page, "#/cuentos")
        C.goto(page, "#/cuento/en-play")
        for _ in range(7):
            page.locator("#st-next").click()
            page.wait_for_timeout(120)
        k = "album:uniq:english"
        snap = C.export(page)
        keys = dict(snap["keys"])
        keys[k] = base["keys"].get(k, keys.get(k))
        probs += C.diff_exports(base, dict(snap, keys=keys), allow_new=False)
        _read(page, "duck")
        page.wait_for_timeout(1800)
        snap2 = C.export(page)
        keys2 = dict(snap2["keys"])
        keys2[k] = base["keys"].get(k, keys2.get(k))
        g0, g1 = json.loads(base["keys"]["game"]), json.loads(keys2["game"])
        gift = 10 if g0.get("day") != C.day_key(C.FIXED_NOW) else 0
        if g1.get("coins") != g0.get("coins") + 10 + gift or g1.get("earned") != g0.get("earned") + 10 + gift:
            probs.append(f"game tras el cuento: {g0.get('coins')} → {g1.get('coins')}")
        keys2["game"] = base["keys"]["game"]
        probs += [f"tras acabar: {x}" for x in C.diff_exports(base, dict(snap2, keys=keys2), allow_new=["cuentos"])]
        if "cuentos" not in keys2:
            probs.append("tras acabar no está la clave cuentos")
        inv = page.evaluate("() => vocabSave.inventory ? vocabSave.inventory().exact : null") if page.evaluate("() => typeof (window.vocabSave || {}).inventory === 'function'") else None
        if inv is not None and "cuentos" not in inv:
            probs.append(f"cuentos no está en EXACT de js/save.js: {inv}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "la partida cambió:\n  " + "\n  ".join(probs)


# ---------------------------------------------------------------- 8. capturas, consola y movimiento
def test_captures_no_console_errors_reduced_motion():
    """Capturas en /mnt/project-files/rediseno/capturas/F6/ (F6i-*): estantería, hoja de un cuento cerrado, portada, una
    página, el globo de una palabra, la elección, el final; a 360 y 390 px y en el ordenador, claro y oscuro. En todas:
    contraste suficiente, sin colores fuera de la paleta, a11y.js sin fallos (nombres, dibujos, cada palabra y botón de
    44 px o más, diálogos modales con nombre) y sin errores de consola. Con «Reducir movimiento», ninguna animación del
    cuento dura más de 160 ms."""
    probs = []
    runs = [("phone", 360, "light"), ("phone", 390, "light"), ("phone", 390, "dark"), ("desk", 1280, "light"), ("desk", 1280, "dark")]
    for kind, w, scheme in runs:
        tag = f"F6i-{w}-{scheme}"
        vp = {"width": w, "height": 800} if kind == "phone" else None
        kw = {"viewport": vp} if vp else {}
        page = _page(kind, color_scheme=scheme, reduced_motion="reduce", **kw)
        try:
            _open(page)

            def snap(name):
                page.evaluate(_FINISH)
                page.wait_for_timeout(150)
                a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
                for x in a["contrast"] + a["palette"]:
                    probs.append(f"{tag}-{name}: {x}")
                b = page.evaluate(_A11Y, {})
                for k in ("names", "roles", "images", "targets", "ids", "dialogs", "focusable"):
                    probs.extend(f"{tag}-{name} [{k}] {x}" for x in b.get(k, []))
                C.shot(page, f"{tag}-{name}", OUT, full_page=False)

            snap("estanteria")
            page.locator(".st-cv.is-lock").first.click()
            page.wait_for_selector("dialog#st-lock-s[open] .st-ls-l li", timeout=6000)
            page.wait_for_timeout(500)
            snap("cerrado")
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
            C.goto(page, "#/cuento/en-play")
            snap("portada")
            durs = []
            for i in range(4):
                page.locator("#st-next").click()
                page.wait_for_timeout(30)
                durs += page.evaluate("""() => document.getAnimations().filter(a => { const t = a.effect && a.effect.target; return t && t.closest && t.closest('#st'); })
                  .map(a => { const t = a.effect.getComputedTiming(); return t.activeDuration + (a.effect.getTiming().delay || 0); })""")
            snap("pagina")
            page.locator("#st-txt .st-u").nth(2).click()
            page.wait_for_selector("#st-bub", timeout=3000)
            snap("globo")
            page.keyboard.press("Escape")
            for i in range(3):
                page.locator("#st-next").click()
                page.wait_for_timeout(30)
            if _state(page)["kind"] != "choice":
                probs.append(f"{tag}: no llega a la elección")
            snap("eleccion")
            page.locator(".st-opt").first.click()
            page.wait_for_timeout(200)
            _read(page, "duck")
            page.wait_for_timeout(600)
            durs += page.evaluate("""() => document.getAnimations().filter(a => { const t = a.effect && a.effect.target; return t && t.closest && t.closest('#st'); })
              .map(a => { const t = a.effect.getComputedTiming(); return t.activeDuration + (a.effect.getTiming().delay || 0); })""")
            snap("fin")
            long = [d for d in durs if d > 160]
            if long:
                probs.append(f"{tag}: animaciones de más de 160 ms con «Reducir movimiento»: {long}")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)
