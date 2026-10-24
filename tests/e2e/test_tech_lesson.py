"""Tech Prep, el motor (T2, S1-SPEC §8-§9 y §13): js/tech-lesson.js.

Los 11 tipos de ítem bien y mal, con el dedo y con el teclado (card, pick, tf, scenario, match, order, code, diagram,
explain, say y story), arrastrar y tocar, los puntos clave por palabras completas, el dictado largo con un
SpeechRecognition de mentira (seguido, vuelve a arrancar, Stop, sin permiso, sin reconocimiento → solo texto), la nota
de «Explain it» al repaso, los límites del repaso (20 por sesión, 5 «Explain it» al día), seguir tras recargar, «Stop
here?», la entrevista de práctica de principio a fin, practicar un caso (con las preguntas de js/tech-pages.js, si ya
están), las pantallas a 390×844 y 360×740 en claro y oscuro y en escritorio, y que nada del niño cambia.
"""
from __future__ import annotations

import json

import common as C
import tech_common as TC

AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
A11Y = (C.HERE / "a11y.js").read_text(encoding="utf-8")
T = TC.TODAY
NARROW = {"width": 360, "height": 740}

# lo que no debe pasar al fallar (ni temblor, ni sonido, ni vibración) y lo que sí al acertar (G.haptic("success"))
SPY = """() => {
  if (window.__spy) return; window.__spy = {hap: [], vib: [], snd: [], nope: 0};
  const S = window.__spy;
  try { const h = G.haptic; G.haptic = k => { S.hap.push(k); try { return h(k); } catch (e) {} }; } catch (e) {}
  try { const n = M.nope; M.nope = el => { S.nope++; return n(el); }; } catch (e) {}
  try { const p = sfx.play; sfx.play = k => { S.snd.push(k); return p(k); }; } catch (e) {}
  try { Object.defineProperty(navigator, 'vibrate', {configurable: true, value: p => { S.vib.push(p); return true; }}); } catch (e) {}
}"""

# SpeechRecognition de mentira: cada instancia queda en window.__sr (la última en __sr.at(-1)); __srSay(texto, final)
# manda un resultado, __srCut() la corta como el navegador (onend sin stop), __srErr(código) da un error.
FAKE_SR = r"""
(() => {
  window.__sr = []; window.__srLog = [];
  class FakeSR {
    constructor() { this.lang = ''; this.continuous = false; this.interimResults = false; this.onresult = this.onerror = this.onend = null;
      this.results = []; this.on = false; window.__sr.push(this); }
    start() { if (this.on) throw new Error('already started'); this.on = true; window.__srLog.push(['start', this.lang, this.continuous, this.interimResults]); }
    stop() { window.__srLog.push(['stop']); const was = this.on; this.on = false; if (was) setTimeout(() => this.onend && this.onend({}), 20); }
    abort() { window.__srLog.push(['abort']); const was = this.on; this.on = false; if (was) setTimeout(() => this.onend && this.onend({}), 5); }
  }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
  const cur = () => [...window.__sr].reverse().find(r => r.on);
  window.__srSay = (text, final) => { const r = cur(); if (!r) return false;
    const last = r.results[r.results.length - 1];
    const res = Object.assign([{transcript: text, confidence: .9}], {isFinal: !!final});
    if (last && !last.isFinal) r.results[r.results.length - 1] = res; else r.results.push(res);
    r.onresult && r.onresult({resultIndex: r.results.length - 1, results: r.results}); return true; };
  window.__srCut = () => { const r = cur(); if (!r) return false; r.on = false; r.onend && r.onend({}); return true; };
  window.__srErr = code => { const r = cur(); if (!r) return false; r.onerror && r.onerror({error: code}); r.on = false; r.onend && r.onend({}); return true; };
})();
"""

_TEXT_SIZES = """sel => { const out = [];
  for (const el of document.querySelectorAll(sel + ' *')) {
    if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own || el.closest('.vh, [aria-hidden=true], svg, kbd')) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 15) out.push(`${el.className || el.tagName}: ${fs}px «${el.textContent.trim().slice(0, 30)}»`);
  } return out; }"""
_PRI = """() => [...document.querySelectorAll('#app .glass-btn--pri, #app .btn-fill')].filter(e => e.getClientRects().length
  && getComputedStyle(e).visibility !== 'hidden').length"""
# un diagrama se lee: nada se sale de su figura, las etiquetas no pisan cajas ni otras etiquetas, ni la página se
# ensancha
_DIAGRAM = """() => { const out = [];
  const box = e => e.getBoundingClientRect(), hit = (a, b, m = 1) => a.left < b.right - m && b.left < a.right - m && a.top < b.bottom - m && b.top < a.bottom - m;
  for (const f of document.querySelectorAll('#app .tp-ldg')) {
    const F = box(f); const ns = [...f.querySelectorAll('.tp-ldg-n')], ls = [...f.querySelectorAll('.tp-ldg-lb:not([hidden])')];
    for (const e of [...ns, ...ls]) { const r = box(e); if (r.left < F.left - 1 || r.right > F.right + 1) out.push(`se sale: «${e.textContent.trim()}» ${Math.round(r.left)}-${Math.round(r.right)} de ${Math.round(F.left)}-${Math.round(F.right)}`);
      if (e.scrollWidth > e.clientWidth + 2) out.push(`texto cortado: «${e.textContent.trim()}»`); }
    ls.forEach((a, i) => { ns.forEach(n => { if (hit(box(a), box(n))) out.push(`la etiqueta «${a.textContent}» pisa «${n.textContent.trim()}»`); });
      ls.slice(i + 1).forEach(b => { if (hit(box(a), box(b))) out.push(`«${a.textContent}» pisa «${b.textContent}»`); }); });
  } return out; }"""


# un botón no corta su texto; en escritorio, las líneas de texto no pasan de ~70 caracteres
_CLIPPED = """() => [...document.querySelectorAll('#app .glass-btn, #app .seg-i, dialog[open] .glass-btn')].filter(b => b.getClientRects().length
  && b.scrollWidth > b.clientWidth + 1).map(b => `«${b.textContent.trim()}» ${b.scrollWidth}>${b.clientWidth}`)"""
_MEASURE = """() => { const out = [], c = document.createElement('canvas').getContext('2d');
  for (const el of document.querySelectorAll('#app p, #app .tp-lq, #app li, #app dd, #app h2')) {
    if (!el.getClientRects().length || el.closest('.vh')) continue;
    const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim(); if (t.length < 75) continue;
    const cs = getComputedStyle(el); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const ch = c.measureText('0').width, w = el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (w / ch > 72) out.push(`${el.className || el.tagName}: ${Math.round(w / ch)} ch «${t.slice(0, 30)}»`);
  } return out; }"""


# ---------------------------------------------------------------- ayudas
def _open(hash, data=None, kind="phone", session=None, extra=None, **kw):
    page = TC.tech_page(kind, hash=hash, data=data, session=session, extra=extra, **kw)
    page.evaluate(SPY)
    return page


def _run(page):
    return page.evaluate("() => vocabTech.lesson.running")


def _step(page):
    r = _run(page)
    return r and r["step"]


def _wait_next(page, k0, timeout=6000):
    """Espera a que la sesión pase del paso k0 (o termine)."""
    page.wait_for_function("""k0 => { const r = vocabTech.lesson.running; return !r || r.ended || !r.step || r.step.k !== k0; }""",
                           arg=k0, timeout=timeout, polling=50)
    page.wait_for_timeout(120)


def _dock(page):
    return page.evaluate("""() => [...document.querySelectorAll('#tp-ldock > *')].filter(e => e.getClientRects().length)
      .map(e => ({t: e.textContent.trim(), id: e.id, pri: e.classList.contains('glass-btn--pri'), key: e.getAttribute('data-key') || '',
        dis: e.getAttribute('aria-disabled') === 'true'}))""")


def _press(page, el_or_key, how):
    """how = "touch" (tap), "click" (ratón) o "key" (con el teclado: Enter si es un selector, o la tecla dada)."""
    if how == "key":
        if el_or_key.startswith(("#", ".", "[")):
            loc = page.locator(el_or_key).first
            loc.focus()
            page.keyboard.press("Enter")
        else:
            page.keyboard.press(el_or_key)
    elif how == "touch":
        page.locator(el_or_key).first.tap()
    else:
        page.locator(el_or_key).first.click()


def _go_on(page, how="touch"):
    """El botón principal del dock (Continue / Next / Check…) con el dedo o con Enter."""
    d = [b for b in _dock(page) if b["pri"]]
    assert d, f"sin botón principal: {_dock(page)}"
    if how == "key":
        page.keyboard.press("Enter")
    else:
        sel = f"#tp-ldock > *:nth-child({[x['t'] for x in _dock(page)].index(d[0]['t']) + 1})"
        page.locator(sel).tap() if how == "touch" else page.locator(sel).click()


def _fb(page):
    """Lo que dice .tp-lfb (el veredicto) del ítem de ahora."""
    return page.evaluate("""() => { const f = document.querySelector('#tp-lstage .tp-lfb'); if (!f || f.hidden) return null;
      const v = f.querySelector('.tp-lv');
      return {ok: !!(v && v.classList.contains('ok')), miss: !!(v && v.classList.contains('miss')), text: f.innerText.trim(),
        why: (f.querySelector('.tp-lwhy') || {}).textContent || '', src: !!f.querySelector('a.tp-src[data-no-gate][target=_blank]'),
        color: v ? getComputedStyle(v).color : ''}; }""")


def _spy(page):
    return page.evaluate("() => JSON.parse(JSON.stringify(window.__spy || {}))")


def _spy_reset(page):
    page.evaluate("() => { const S = window.__spy; if (S) { S.hap = []; S.vib = []; S.snd = []; S.nope = 0; } }")


def _right_index(it):
    if it["type"] == "pick":
        return it["answer"]
    if it["type"] == "tf":
        return 1 if it["answer"] else 0
    return next(i for i, o in enumerate(it["options"]) if o["ok"])


def _miss_bg(page):
    return page.evaluate("() => getComputedStyle(document.documentElement).getPropertyValue('--miss-fill').trim()")


def _is_grey(rgb):
    """rgb(a) gris (sin tono): nunca rojo."""
    import re
    n = [float(x) for x in re.findall(r"[\d.]+", rgb)[:3]]
    return max(n) - min(n) <= 12


def _fill_slots(page, answers, wrong=False, how="touch"):
    """code y diagram: en cada hueco, la ficha con su texto (wrong: una ficha que no va en el primero)."""
    chips = page.evaluate("() => [...document.querySelectorAll('#tp-lstage [data-chip]')].map(c => c.textContent)")
    used = set()
    for i, a in enumerate(answers):
        want = a
        if wrong and i == 0:
            want = next(c for c in chips if c not in answers)
        c = next(j for j, t in enumerate(chips) if t == want and j not in used)
        used.add(c)
        _press(page, f"#tp-lstage [data-slot='{i}']", how)
        _press(page, f"#tp-lstage [data-chip='{c}']", how)


def _answer(page, ok=True, how="touch", text=None, grade=None):
    """Contesta el ítem de ahora (bien o mal) y devuelve {type, fb, item}. No pasa al siguiente."""
    st = _step(page)
    t, it = st["type"], st["it"]
    out = {"type": t, "item": it, "k": st["k"]}
    if t in ("card", "say", "story"):
        return out
    if t == "flip":
        _go_on(page, how)
        page.wait_for_selector("#tp-lyes", timeout=3000)
        _press(page, "#tp-lyes" if ok else "#tp-lno", how if how != "key" else "key")
        return out
    if t in ("pick", "tf", "scenario"):
        r = _right_index(it)
        n = 2 if t == "tf" else len(it["options"])
        ch = r if ok else next(i for i in range(n) if i != r)
        sel = f"#tp-lstage .tp-lopt[data-i='{ch}']"
        if how == "key":
            page.keyboard.press(page.get_attribute(sel, "data-key"))
        else:
            _press(page, sel, how)
        page.wait_for_selector("#tp-lstage .tp-lfb:not([hidden])", timeout=3000)
        page.wait_for_timeout(220)   # (los colores, tras su transición)
        out["fb"] = _fb(page)
        out["chosen"], out["right"] = ch, r
        return out
    if t == "match":
        pairs = it["pairs"]
        if not ok:
            for a, b in [(0, 1), (1, 2), (2, 0)]:
                _press(page, f"#tp-lstage .tp-lmi[data-side=l][data-p='{a}']", how)
                _press(page, f"#tp-lstage .tp-lmi[data-side=r][data-p='{b}']", how)
                page.wait_for_timeout(950)
        for i in range(len(pairs)):
            _press(page, f"#tp-lstage .tp-lmi[data-side=l][data-p='{i}']", how)
            _press(page, f"#tp-lstage .tp-lmi[data-side=r][data-p='{i}']", how)
        page.wait_for_selector("#tp-lstage .tp-lfb:not([hidden]) .tp-lv", timeout=3000)
        page.wait_for_timeout(100)
        out["fb"] = _fb(page)
        return out
    if t == "order":
        n = len(it["steps"])
        seq = list(range(n)) if ok else list(reversed(range(n)))
        for k in seq:
            _press(page, f"#tp-lstage .tp-lpool .tp-lsr[data-k='{k}'] .tp-lsb", how)
        _check(page, how)
        if not ok:
            out["first"] = _fb(page)
            _check_again_or_reveal(page, how)
        out["fb"] = _fb(page)
        return out
    if t in ("code", "diagram"):
        answers = ([str(g["answer"]) for g in sorted(it["gaps"], key=lambda g: g["n"])] if t == "code"
                   else [str(n["label"]) for n in it["nodes"] if n.get("slot")])
        _fill_slots(page, answers, wrong=not ok, how=how)
        _check(page, how)
        if not ok:
            out["first"] = _fb(page)
            _check_again_or_reveal(page, how)
        out["fb"] = _fb(page)
        return out
    if t == "explain":
        page.wait_for_selector("#tp-lstage .tp-lta", timeout=3000)
        page.locator("#tp-lstage .tp-lta").fill(text if text is not None else ("" if not ok else it.get("model", "")[:400]))
        if how == "key":
            page.locator("#tp-lstage .tp-lta").press("Control+Enter")
        else:
            _press(page, "#tp-ldone", how)
        page.wait_for_selector("#tp-lstage [data-ph=review]", timeout=3000)
        g = grade or ("nailed" if ok else "notyet")
        out["review"] = page.evaluate("""() => ({found: [...document.querySelectorAll('#tp-lstage .tp-lkp.is-on')].length,
          kps: [...document.querySelectorAll('#tp-lstage .tp-lkp')].length, model: !!document.querySelector('#tp-lstage .tp-lsec [data-say]'),
          text: document.getElementById('tp-lstage').innerText})""")
        if how == "key":
            page.keyboard.press({"notyet": "1", "partly": "2", "nailed": "3"}[g])
        else:
            _press(page, f"#tp-lg-{g}", how)
        out["grade"] = g
        return out
    raise AssertionError(f"tipo sin contestar: {t}")


def _check(page, how):
    page.wait_for_function("() => { const b = document.getElementById('tp-lcheck'); return b && b.getAttribute('aria-disabled') !== 'true'; }", timeout=3000)
    if how == "key":
        page.keyboard.press("Enter")
    else:
        _press(page, "#tp-lcheck", how)
    page.wait_for_selector("#tp-lstage .tp-lfb:not([hidden])", timeout=3000)
    page.wait_for_timeout(80)


def _check_again_or_reveal(page, how):
    """Tras el primer «Check» mal: «Show answer» (la respuesta, nota 0)."""
    assert page.locator("#tp-lshow").count(), f"sin «Show answer»: {_dock(page)}"
    _press(page, "#tp-lshow", how if how != "key" else "click")
    page.wait_for_function("() => !document.getElementById('tp-lshow')", timeout=3000)
    page.wait_for_timeout(80)


def _walk(page, plan=None, how="touch", shots=None, grade="nailed", text=None):
    """Recorre la sesión de ahora hasta el final. plan(i, step) → True (bien) / False (mal). Devuelve los pasos."""
    seen = []
    for _ in range(80):
        r = _run(page)
        if not r or r["ended"] or not r["step"]:
            break
        st = r["step"]
        ok = True if plan is None else plan(len(seen), st)
        res = _answer(page, ok=ok, how=how, grade=grade if ok else ("notyet" if grade == "nailed" else grade), text=text)
        if shots is not None:
            shots(res, st)
        seen.append(res)
        if res["type"] in ("explain", "flip"):
            _wait_next(page, st["k"])
            continue
        _go_on(page, how)
        _wait_next(page, st["k"])
    return seen


def _screen_audit(page, label, scope="#app"):
    probs = []
    a = page.evaluate(AUDIT, {"what": ["contrast", "palette"]})
    probs += [f"{label} contraste: {x}" for x in a["contrast"]] + [f"{label} paleta: {x}" for x in a["palette"]]
    y = page.evaluate(A11Y, {"what": ["names", "roles", "images", "targets", "ids", "focusable"]})
    for k in ("names", "roles", "images", "targets", "ids", "focusable"):
        probs += [f"{label} {k}: {x}" for x in y[k]]
    probs += [f"{label} letra pequeña: {x}" for x in page.evaluate(_TEXT_SIZES, scope)]
    w = page.evaluate("[document.documentElement.scrollWidth, innerWidth]")
    if w[0] > w[1]:
        probs.append(f"{label} scroll horizontal: {w}")
    probs += [f"{label} botón cortado: {x}" for x in page.evaluate(_CLIPPED)]
    return probs


def _studied(uids, best=8):
    """tech:data con las lecciones de esas unidades hechas."""
    return {f"ls/{l['id']}": TC.rec(best=best, total=len(l["items"]), done=TC.NOW_MS - 864e5) for u in uids for _, l in TC.lessons(u)}


def _plan_by_type():
    """Cada tipo, la primera vez bien y la segunda mal (y así); lo que vuelve a salir al final, bien."""
    seen = {}

    def plan(i, st):
        if st["re"]:
            return True
        n = seen.get(st["type"], 0)
        seen[st["type"]] = n + 1
        return n % 2 == 0
    return plan


def _check_answer(page, res, ok, label):
    """Lo que se ve y lo que pasa al contestar bien o mal (§9): verde con ✓ y G.haptic("success") / gris con ✗, la
    buena en verde, sin temblor, sin sonido y sin vibración; el why y el enlace Source; «Continue» o «Next»."""
    probs = []
    t, it, fb = res["type"], res["item"], res.get("fb")
    spy = _spy(page)
    if t in ("pick", "tf", "scenario", "match", "order", "code", "diagram"):
        if not fb:
            return [f"{label}: sin veredicto"]
        if ok and not fb["ok"]:
            probs.append(f"{label}: bien y no dice Correct: {fb}")
        if not ok and not fb["miss"]:
            probs.append(f"{label}: mal y no dice Not quite: {fb}")
        if it.get("src") and not fb["src"]:
            probs.append(f"{label}: sin «Source» (data-no-gate, target=_blank)")
        if not _is_grey(fb["color"]) and not ok:
            probs.append(f"{label}: el veredicto de fallo no es gris: {fb['color']}")
        dock = [b["t"] for b in _dock(page) if b["pri"]]
        if dock != (["Continue"] if ok else ["Next"]):
            probs.append(f"{label}: botón principal {dock}")
    if ok and t in ("pick", "tf", "scenario", "order", "code", "diagram") and "success" not in spy["hap"]:
        probs.append(f"{label}: bien sin G.haptic('success'): {spy['hap']}")
    if not ok:
        if spy["hap"] and t not in ("match", "order", "code", "diagram") or spy["vib"] and t not in ("match", "order", "code", "diagram"):
            probs.append(f"{label}: fallo con vibración: {spy}")
        if "success" in spy["hap"] and t not in ("match",):
            probs.append(f"{label}: fallo con haptic de acierto: {spy}")
        if spy["snd"] or spy["nope"]:
            probs.append(f"{label}: fallo con sonido o temblor: {spy}")
    if t in ("pick", "tf"):
        if fb and fb["why"].strip() != it["why"].strip():
            probs.append(f"{label}: why {fb['why']!r}")
    if t in ("pick", "tf", "scenario"):
        st = page.evaluate("""([ch, r]) => { const q = i => document.querySelector(`#tp-lstage .tp-lopt[data-i='${i}']`);
          const c = q(ch), g = q(r);
          return {c: c.className, cmk: !!c.querySelector('.tp-lmk-ok, .tp-lmk-no'), cno: !!c.querySelector('.tp-lmk-no'), g: g.className,
            gok: !!g.querySelector('.tp-lmk-ok'), cbg: getComputedStyle(c).backgroundColor, gbg: getComputedStyle(g).backgroundColor,
            whys: [...document.querySelectorAll('#tp-lstage .tp-lowhy')].map(w => ({t: w.textContent, shown: !!w.getClientRects().length}))}; }""",
                           [res["chosen"], res["right"]])
        if "is-ok" not in st["g"] or not st["gok"]:
            probs.append(f"{label}: la buena no está en verde con ✓: {st}")
        if st["gbg"] != "rgb(0, 137, 50)":
            probs.append(f"{label}: el verde de la buena no es --ok-fill: {st['gbg']}")
        if not ok:
            if "is-miss" not in st["c"] or not st["cno"]:
                probs.append(f"{label}: la elegida no está en gris con ✗: {st}")
            if not _is_grey(st["cbg"]):
                probs.append(f"{label}: la elegida mal no es gris: {st['cbg']}")
        if t == "scenario":
            want = [o["why"] for o in it["options"]]
            got = [w["t"] for w in st["whys"] if w["shown"]]
            if sorted(got) != sorted(want):
                probs.append(f"{label}: no salen los why de todas las opciones: {got}")
    if t in ("order", "code", "diagram") and not ok:
        first = res.get("first") or {}
        if not first.get("miss") or "Show answer" in (first.get("text") or ""):
            pass
        if not first.get("miss"):
            probs.append(f"{label}: el primer «Check» mal no dice cuántos: {first}")
        marks = page.evaluate("() => document.querySelectorAll('#tp-lstage .is-ok').length")
        if marks:
            probs.append(f"{label}: la respuesta enseñada sale en verde ({marks})")
    if t in ("order", "code", "diagram") and ok:
        n = page.evaluate("() => document.querySelectorAll('#tp-lstage .is-ok .tp-lmk-ok, #tp-lstage [data-slot].is-ok .tp-lmk-ok').length")
        if not n:
            probs.append(f"{label}: bien sin ✓ en sus piezas")
    if t == "match":
        rows = page.evaluate("() => [...document.querySelectorAll('#tp-lstage .tp-lmd')].map(r => r.innerText)")
        if len(rows) != len(it["pairs"]):
            probs.append(f"{label}: las parejas al final: {rows}")
    return probs


def _check_static(page, t, it, label):
    """Lo que se ve antes de contestar (card, say, story y el resto: §9)."""
    probs = []
    if t in ("card", "flip"):
        x = page.evaluate("""() => { const a = document.querySelector('#tp-lstage .tp-lcard');
          return {term: (a.querySelector('.tp-term-t') || {}).textContent || '', ipa: (a.querySelector('.tp-ipa') || {}).textContent || '',
            say: a.querySelectorAll('[data-say]:not([data-slow])').length, slow: a.querySelectorAll('[data-say][data-slow]').length,
            def: (a.querySelector('.tp-def') || {}).textContent || '', quote: !!a.querySelector('.tp-quote'), dg: !!a.querySelector('.tp-ldg'),
            fs: parseFloat(getComputedStyle(a.querySelector('.tp-term-t')).fontSize)}; }""")
        u = TC.unit(it["id"][:3])
        term = next(z for z in u["terms"] if z["id"] == it["term"])
        if x["term"] != term["term"] or not x["say"] or not x["slow"]:
            probs.append(f"{label}: término o altavoces: {x}")
        if term.get("ipa") and term["ipa"] not in x["ipa"].replace("⁠", ""):
            probs.append(f"{label}: sin IPA visible: {x['ipa']!r}")
        if t == "card" and (x["def"] != term["def"] or not x["quote"] or bool(it.get("diagram")) != x["dg"]):
            probs.append(f"{label}: definición, ejemplo o diagrama: {x}")
        if t == "card" and x["fs"] < 24:
            probs.append(f"{label}: el término no es grande: {x['fs']}")
    if t == "say":
        x = page.evaluate("""() => ({s: document.querySelector('#tp-lstage .tp-lsent').textContent, say: !!document.querySelector('#tp-lstage .tp-llisten[data-say]'),
          slow: !!document.querySelector('#tp-lstage [data-say][data-slow]'), t: document.getElementById('tp-lstage').innerText})""")
        if x["s"] != it["text"] or not x["say"] or not x["slow"] or "Say it aloud, then continue" not in x["t"]:
            probs.append(f"{label}: {x}")
    if t == "story":
        x = page.evaluate("""() => ({steps: [...document.querySelectorAll('#tp-lstage .tp-lstar-s b')].map(b => b.textContent),
          dt: [...document.querySelectorAll('#tp-lstage .tp-lstory dt')].map(b => b.textContent), w: !!document.querySelector('#tp-lstage .tp-lwr'),
          say: !!document.querySelector('#tp-lstage .tp-lsec [data-say]')})""")
        if x["steps"] != it["template"] or x["dt"] != it["template"] or not x["w"] or not x["say"]:
            probs.append(f"{label}: {x}")
    if t in ("pick", "scenario"):
        n = page.evaluate("() => document.querySelectorAll('#tp-lstage .tp-lopt').length")
        if n != len(it["options"]):
            probs.append(f"{label}: {n} opciones")
    if t == "tf":
        x = page.evaluate("() => [...document.querySelectorAll('#tp-lstage .tp-lopt .tp-lot')].map(o => o.textContent)")
        if x != ["False", "True"]:
            probs.append(f"{label}: {x}")
    return probs


def _type_tour(page, lessons, how, capture=None):
    """Recorre lecciones con _plan_by_type, comprobando cada respuesta. Devuelve (problemas, tipos vistos {tipo: [bien, mal]})."""
    probs, seen = [], {}
    plan = _plan_by_type()
    for lid in lessons:
        TC.goto(page, f"#/techl/lesson/{lid}")
        page.evaluate(SPY)
        for _ in range(40):
            r = _run(page)
            if not r or r["ended"] or not r["step"]:
                break
            st = r["step"]
            t, it = st["type"], st["it"]
            ok = plan(0, st)
            label = f"{how} {st['k']} {t} {'bien' if ok else 'mal'}"
            probs += _check_static(page, t, it, label)
            if capture and not st["re"] and (t, ok) not in capture["done"]:
                TC.shot(page, f"{capture['pre']}-{t}", full_page=False) if ok and (t, True) not in capture["done"] and (t, False) not in capture["done"] else None
            _spy_reset(page)
            res = _answer(page, ok=ok, how=how)
            page.wait_for_timeout(60)
            probs += _check_answer(page, res, ok, label)
            if capture and not st["re"] and (t, ok) not in capture["done"] and t not in ("card", "say", "story", "explain"):
                TC.shot(page, f"{capture['pre']}-{t}-{'bien' if ok else 'mal'}", full_page=False)
            if capture:
                capture["done"].add((t, ok))
            if not st["re"]:
                seen.setdefault(t, [0, 0])[0 if ok else 1] += 1
            if t in ("explain", "flip"):
                _wait_next(page, st["k"])
                continue
            _go_on(page, how)
            _wait_next(page, st["k"])
        end = page.evaluate("() => (document.getElementById('tp-lend-t') || {}).textContent || ''")
        if end != "Lesson complete":
            probs.append(f"{how} {lid}: sin «Lesson complete» ({end!r})")
    return probs, seen


# con estas lecciones salen los 11 tipos, y cada uno al menos dos veces (bien y mal)
TOUR = ["u01-l1", "u01-l2", "u01-l3", "u07-l2", "u02-l2", "u05-l1"]
ALL11 = {"card", "pick", "tf", "scenario", "match", "order", "code", "diagram", "explain", "say", "story"}


# ---------------------------------------------------------------- los 11 tipos
def test_every_type_right_and_wrong_by_touch():
    """Con el dedo (390×844), cada tipo bien y mal: verde ✓ y G.haptic("success") / la elegida gris con ✗ y la buena en
    verde, sin temblor, sonido ni vibración; los why (en scenario, el de cada opción), «Source», «Continue»/«Next»; lo
    mal vuelve al final («Again ·»); las notas al repaso (say y story no entran; las tarjetas sí); sin errores."""
    page = _open("#/tech")
    try:
        before = TC.kid_snapshot(page)
        TC.bus_log(page)
        cap = {"pre": "leccion", "done": set()}
        probs, seen = _type_tour(page, TOUR, "touch", capture=cap)
        missing = sorted(t for t in ALL11 if t not in seen)
        assert not missing, f"tipos sin probar: {missing}"
        scored = {"pick", "tf", "scenario", "match", "order", "code", "diagram", "explain"}
        for t in scored:
            if not (seen[t][0] and seen[t][1]):
                probs.append(f"{t}: no salió bien y mal ({seen[t]})")
        srs = TC.recs(page, "srs")
        for lid in TOUR:
            for it in next(l for _, l in TC.lessons(lid[:3]) if l["id"] == lid)["items"]:
                has = f"srs/{it['id']}" in srs
                if TC.REVIEWABLE(it["type"]) != has:
                    probs.append(f"{it['id']} ({it['type']}): en el repaso {has}")
        cards = [v for k, v in srs.items() if v.get("t") == "card"]
        if any(v["g"] != 2 for v in cards):
            probs.append(f"tarjetas sin nota 2: {cards}")
        ls = TC.recs(page, "ls")
        if sorted(k[3:] for k in ls) != sorted(TOUR):
            probs.append(f"ls: {sorted(ls)}")
        assert not TC.kid_changes(page, before), TC.kid_changes(page, before)
        assert not TC.bus_seen(page), TC.bus_seen(page)
        assert not C.errors(page), C.errors(page)
        assert not probs, "\n".join(probs[:30])
    finally:
        page.context.close()


def test_every_type_right_and_wrong_by_keyboard():
    """En escritorio y solo con el teclado: 1-4 eligen, Enter es el botón principal (Continue, Check, Next, Done),
    Tab + Enter en parejas, pasos, huecos y fichas, Ctrl+Enter termina «Explain it» y 1/2/3 lo califican; en el
    repaso, Enter enseña la tarjeta y ← / → (o 1 / 2) son No / Yes. Las teclas se ven en los botones, sin repetirse."""
    page = _open("#/tech", kind="desk")
    try:
        page.keyboard.press("Shift")
        probs, seen = _type_tour(page, TOUR, "key")
        missing = sorted(t for t in ALL11 if t not in seen)
        assert not missing, f"tipos sin probar: {missing}"
        # las etiquetas de las teclas: las opciones traen su <kbd> y no llevan otra
        TC.goto(page, "#/techl/lesson/u01-l2")
        page.keyboard.press("Tab")
        page.wait_for_timeout(300)
        r = _step(page)
        while r and r["type"] not in ("scenario",):
            _answer(page, ok=True, how="key")
            if r["type"] not in ("explain", "flip"):
                page.keyboard.press("Enter")
            _wait_next(page, r["k"])
            r = _step(page)
        page.keyboard.press("Shift")
        page.wait_for_timeout(400)
        tags = page.evaluate("""() => ({kbd: document.documentElement.hasAttribute('data-kbd'),
          opts: [...document.querySelectorAll('#tp-lstage .tp-lopt')].map(o => ({own: !!o.querySelector('kbd.tp-lk'), shown: o.querySelector('kbd.tp-lk') ? getComputedStyle(o.querySelector('kbd.tp-lk')).display !== 'none' : false,
            extra: o.querySelectorAll('kbd.kb-tag').length}))})""")
        assert tags["kbd"], tags
        assert all(o["own"] and o["shown"] and not o["extra"] for o in tags["opts"]), tags
        # el repaso con el teclado: Enter enseña, → es Yes y ← es No
        recs = {f"srs/{it['id']}": TC.srs(b=1, due=T, d=T - 1, t="card") for _, _, it in TC.items("card", "u01")[:2]}
        page.context.close()
        page = _open("#/techl/review", kind="desk", data=TC.data(recs))
        st = _step(page)
        assert st and st["type"] == "flip", st
        page.keyboard.press("Enter")
        page.wait_for_selector("#tp-lyes", timeout=3000)
        assert [b["t"] for b in _dock(page)] == ["No", "Yes"], _dock(page)
        page.keyboard.press("ArrowRight")
        _wait_next(page, st["k"])
        st2 = _step(page)
        page.keyboard.press("Enter")
        page.wait_for_selector("#tp-lno", timeout=3000)
        page.keyboard.press("ArrowLeft")
        _wait_next(page, st2["k"])
        srs = TC.recs(page, "srs")
        assert srs[f"srs/{st['id']}"]["g"] == 2 and srs[f"srs/{st2['id']}"]["g"] == 0, srs
        assert not C.errors(page), C.errors(page)
        assert not probs, "\n".join(probs[:30])
    finally:
        page.context.close()


def _all_diagrams():
    """[(nombre, diagrama, con huecos)] de todas las unidades: los ítems diagram y los mini diagramas de las tarjetas."""
    out = []
    for _, _, it in TC.items():
        if it["type"] == "diagram":
            out.append((it["id"], it, True))
        elif it.get("diagram"):
            out.append((it["id"], it["diagram"], False))
    return out


def test_diagrams_readable_at_360_and_desktop():
    """Todos los diagramas (ítems diagram con sus huecos y los mini diagramas de las tarjetas) a 360 px y en escritorio:
    nada se sale de la figura, ningún texto se corta, las etiquetas no pisan cajas ni otras etiquetas, letra ≥ 15 px
    (nunca menos de 13), de arriba abajo en el móvil y de izquierda a derecha si cabe (flow), y una descripción para
    lectores de pantalla."""
    dgs = _all_diagrams()
    assert len(dgs) >= 7, len(dgs)
    probs = []
    for kind, vp in (("phone", NARROW), ("desk", None)):
        page = _open("#/techl/lesson/u01-l1", kind=kind, **({"viewport": vp} if vp else {}))
        try:
            for name, d, slots in dgs:
                r = page.evaluate("""([d, slots]) => { const a = document.getElementById('tp-lstage');
                  a.innerHTML = '<div class="card tp-card tp-ldgc" id="dgt">' + vocabTech.lesson.diagram.html(d, {slots}) + '</div>';
                  const f = a.querySelector('.tp-ldg'); vocabTech.lesson.diagram.fit(f);
                  const fs = [...f.querySelectorAll('.tp-ldg-n, .tp-ldg-lb:not([hidden]), .tp-ldg-mt, .tp-ldg-more li')].map(e => parseFloat(getComputedStyle(e).fontSize));
                  return {dir: f.dataset.dir || 'seq', cap: (f.querySelector('figcaption.vh') || {}).textContent || '', min: Math.min(...fs),
                    w: [document.documentElement.scrollWidth, innerWidth]}; }""", [d, slots])
                page.wait_for_timeout(30)
                label = f"{kind} {name}"
                probs += [f"{label}: {x}" for x in page.evaluate(_DIAGRAM)]
                if r["min"] < 15:
                    probs.append(f"{label}: letra de {r['min']} px")
                if r["w"][0] > r["w"][1]:
                    probs.append(f"{label}: scroll horizontal {r['w']}")
                if len(r["cap"]) < 20:
                    probs.append(f"{label}: sin descripción ({r['cap']!r})")
                if d.get("layout") != "sequence" and kind == "phone" and r["dir"] != "ttb":
                    probs.append(f"{label}: en el móvil no va de arriba abajo ({r['dir']})")
                if name in ("u02-l2-i5", "u07-l1-i10", "u06-l1-i2", "u04-l2-i7", "u02-l1-i7"):
                    page.locator("#dgt").screenshot(path=str(TC.CAPTURAS / f"diagrama-{name}-{'360' if kind == 'phone' else 'escritorio'}.png"))
            assert not C.errors(page), C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs[:40])


# ---------------------------------------------------------------- arrastrar y tocar
def _skip_to(page, item_id, how="touch"):
    """Contesta bien hasta llegar al ítem item_id de la lección abierta."""
    for _ in range(30):
        st = _step(page)
        assert st, f"la lección terminó sin llegar a {item_id}"
        if st["id"] == item_id and not st["re"]:
            return st
        _answer(page, ok=True, how=how)
        if st["type"] not in ("explain", "flip"):
            _go_on(page, how)
        _wait_next(page, st["k"])
    raise AssertionError(f"sin llegar a {item_id}")


def _center(page, sel):
    loc = page.locator(sel).first
    loc.scroll_into_view_if_needed()
    b = loc.bounding_box()
    return b["x"] + b["width"] / 2, b["y"] + b["height"] / 2, b


def _mouse_drag(page, src, dst, dy=0.0, steps=14):
    x0, y0, _ = _center(page, src)
    x1, y1, b = _center(page, dst)
    x0, y0, _ = _center(page, src)
    y1 += dy * b["height"]
    page.mouse.move(x0, y0)
    page.mouse.down()
    for i in range(1, steps + 1):
        page.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps)
        page.wait_for_timeout(12)
    page.mouse.up()
    page.wait_for_timeout(150)


def _touch_drag(page, src, to_xy, steps=14):
    """Arrastre con el dedo (eventos táctiles de verdad por CDP: pointerType touch)."""
    x0, y0, _ = _center(page, src)
    x1, y1 = to_xy
    cdp = page.context.new_cdp_session(page)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x0, "y": y0}]})
    for i in range(1, steps + 1):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x0 + (x1 - x0) * i / steps, "y": y0 + (y1 - y0) * i / steps}]})
        page.wait_for_timeout(16)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    cdp.detach()
    page.wait_for_timeout(200)


def _order_now(page):
    return page.evaluate("() => [...document.querySelectorAll('#tp-lstage ol.tp-lord .tp-lsr')].map(r => +r.dataset.k)")


def test_drag_and_tap():
    """Lo mismo arrastrando: order con el dedo por su asa (de la lista de pasos a «Your order» y para recolocar), y con el
    ratón las fichas de code y diagram sobre sus huecos y las parejas de match de una columna a la otra; tocar sigue
    valiendo (un paso puesto se quita tocándolo). Todo bien a la primera = nota 2."""
    page = _open("#/techl/lesson/u01-l2", viewport={"width": 390, "height": 1400})
    try:
        st = _skip_to(page, "u01-l2-i8")
        n = len(st["it"]["steps"])
        # tocar un paso lo pone; tocarlo otra vez lo quita
        _press(page, "#tp-lstage .tp-lpool .tp-lsr[data-k='2'] .tp-lsb", "touch")
        assert _order_now(page) == [2], _order_now(page)
        _press(page, "#tp-lstage ol.tp-lord .tp-lsr[data-k='2'] .tp-lsb", "touch")
        assert _order_now(page) == [], _order_now(page)
        # con el dedo, por el asa: cada paso al final de «Your order»
        for k in range(n):
            x, y, b = _center(page, "#tp-lstage ol.tp-lord > li:last-child")
            _touch_drag(page, f"#tp-lstage .tp-lpool .tp-lsr[data-k='{k}'] .tp-lgrip", (x, b["y"] + b["height"] - 4))
            assert _order_now(page) == list(range(k + 1)), (k, _order_now(page))
        # recolocar: el primero al final y otra vez al principio
        x, y, b = _center(page, "#tp-lstage ol.tp-lord .tp-lsr:last-child")
        _touch_drag(page, "#tp-lstage ol.tp-lord .tp-lsr[data-k='0'] .tp-lgrip", (x, b["y"] + b["height"] - 4))
        assert _order_now(page) == list(range(1, n)) + [0], _order_now(page)
        x, y, b = _center(page, "#tp-lstage ol.tp-lord .tp-lsr:first-child")
        _touch_drag(page, "#tp-lstage ol.tp-lord .tp-lsr[data-k='0'] .tp-lgrip", (x, b["y"] + 4))
        assert _order_now(page) == list(range(n)), _order_now(page)
        # arrastrar desde el texto (no el asa) no mueve el paso: el dedo desplaza la página
        x, y, b = _center(page, "#tp-lstage ol.tp-lord .tp-lsr:last-child")
        _touch_drag(page, "#tp-lstage ol.tp-lord .tp-lsr[data-k='0'] .tp-lst-t", (x, b["y"] + b["height"] - 4))
        assert _order_now(page) == list(range(n)), _order_now(page)
        _check(page, "touch")
        assert _fb(page)["ok"], _fb(page)
        assert TC.recs(page, "srs")["srs/u01-l2-i8"]["g"] == 2
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
    page = _open("#/techl/lesson/u01-l2", kind="desk", viewport={"width": 1280, "height": 1500})
    try:
        # diagram: cada ficha a su hueco
        st = _skip_to(page, "u01-l2-i3", how="click")
        labels = [n["label"] for n in st["it"]["nodes"] if n.get("slot")]
        chips = page.evaluate("() => [...document.querySelectorAll('#tp-lstage [data-chip]')].map(c => c.textContent)")
        for i, lab in enumerate(labels):
            _mouse_drag(page, f"#tp-lstage [data-chip='{chips.index(lab)}']", f"#tp-lstage [data-slot='{i}']")
        filled = page.evaluate("() => [...document.querySelectorAll('#tp-lstage [data-slot]')].map(s => s.querySelector('.tp-lsl-t').textContent)")
        assert filled == labels, filled
        _check(page, "click")
        assert _fb(page)["ok"], _fb(page)
        _go_on(page, "click")
        # code: cada ficha a su hueco (arrastrar una ficha a un hueco lleno la cambia)
        st = _skip_to(page, "u01-l2-i7", how="click")
        answers = [g["answer"] for g in sorted(st["it"]["gaps"], key=lambda g: g["n"])]
        chips = page.evaluate("() => [...document.querySelectorAll('#tp-lstage [data-chip]')].map(c => c.textContent)")
        wrong = next(c for c in chips if c not in answers)
        _mouse_drag(page, f"#tp-lstage [data-chip='{chips.index(wrong)}']", "#tp-lstage [data-slot='0']")
        for i, a in enumerate(answers):
            _mouse_drag(page, f"#tp-lstage [data-chip='{chips.index(a)}']", f"#tp-lstage [data-slot='{i}']")
        filled = page.evaluate("() => [...document.querySelectorAll('#tp-lstage [data-slot]')].map(s => s.querySelector('.tp-lsl-t').textContent)")
        assert filled == answers, filled
        used = page.evaluate("() => [...document.querySelectorAll('#tp-lstage [data-chip].is-used')].map(c => c.textContent)")
        assert sorted(used) == sorted(answers), used
        _check(page, "click")
        assert _fb(page)["ok"], _fb(page)
        srs = TC.recs(page, "srs")
        assert srs["srs/u01-l2-i3"]["g"] == 2 and srs["srs/u01-l2-i7"]["g"] == 2, srs
        # match: arrastrar de la izquierda a su pareja de la derecha (la lección empezada pregunta «Stop here?»)
        _nav_stop(page, "#/techl/lesson/u01-l1")
        st = _skip_to(page, "u01-l1-i10", how="click")
        for i in range(len(st["it"]["pairs"])):
            _mouse_drag(page, f"#tp-lstage .tp-lmi[data-side=l][data-p='{i}']", f"#tp-lstage .tp-lmi[data-side=r][data-p='{i}']")
        page.wait_for_selector("#tp-lstage .tp-lmdone", timeout=3000)
        assert _fb(page)["ok"] and "no mistakes" in _fb(page)["text"], _fb(page)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- puntos clave
KP_CASES = [
    # (palabras clave, texto, ¿se encuentra?)
    (["retry"], "We kept retrying the call.", False),
    (["retry"], "I would retry later.", True),
    (["retry", "retrying"], "We kept retrying the call.", True),
    (["retry"], "RETRY with backoff", True),
    (["retry"], "Retry.", True),
    (["retry"], "a retry-after header", True),
    (["Idempotency key"], "send an idempotency   key with each request", True),
    (["idempotency key"], "idempotency of the key", False),
    (["eventual consistency"], "It's Eventual consistency, really.", True),
    (["dead-letter"], "a dead letter topic", True),
    (["dead letter"], "the dead-letter topic", True),
    (["don't"], "I don’t block the caller", True),
    (["99.9"], "an SLO of 99.9% per month", True),
    (["429"], "it returned 4290 rows", False),
    (["429"], "a 429, then Retry-After", True),
    (["pub/sub"], "Pub/Sub keeps them", True),
    (["oauth"], "OAuth2 client credentials", False),
    (["cache"], "the caches are warm", False),
    (["", "  "], "anything at all", False),
]


def test_keypoints_whole_words_case_insensitive_multiword():
    """Los puntos clave de «Explain it»: palabras completas («retry» no encuentra «retrying» si no está en la lista), sin
    mayúsculas, con guiones, barras, apóstrofos y signos normalizados, y palabras clave de varias palabras. En pantalla:
    los encontrados en verde con ✓ y «You said “…”», los que faltan en gris (nunca rojo), y cuántos de cuántos."""
    page = _open("#/techl/lesson/u01-l3")
    try:
        got = page.evaluate("""cases => cases.map(([kw, text]) => vocabTech.lesson.keypoints(text, [{text: 'p', kw}])[0].found)""",
                            [[k, t] for k, t, _ in KP_CASES])
        bad = [(k, t, want) for (k, t, want), g in zip(KP_CASES, got) if g != want]
        assert not bad, f"mal: {bad}"
        r = page.evaluate("() => vocabTech.lesson.keypoints('I retry, and it is eventual consistency.', [{text: 'A', kw: ['backoff', 'retry']}, {text: 'B', kw: ['eventual consistency']}, {text: 'C', kw: ['circuit breaker']}])")
        assert [(x["found"], x["kw"]) for x in r] == [(True, "retry"), (True, "eventual consistency"), (False, None)], r
        # en pantalla, con un ítem de verdad
        st = _skip_to(page, "u01-l3-i4")
        kps = st["it"]["keypoints"]
        text = "The recruiter is WAITING on screen, so a synchronous call. Otherwise I publish events, and handle duplicates."
        page.locator("#tp-lstage .tp-lta").fill(text)
        _press(page, "#tp-ldone", "touch")
        page.wait_for_selector("#tp-lstage [data-ph=review]", timeout=3000)
        page.wait_for_timeout(200)
        ui = page.evaluate("""() => ({okInk: (() => { const i = document.createElement('i'); i.style.color = 'var(--ok-ink)'; document.body.appendChild(i);
            const c = getComputedStyle(i).color; i.remove(); return c; })(),
          head: [...document.querySelectorAll('#tp-lstage .tp-lh3')].map(h => h.textContent),
          kps: [...document.querySelectorAll('#tp-lstage .tp-lkp')].map(li => ({on: li.classList.contains('is-on'), t: li.innerText,
            color: getComputedStyle(li.querySelector('.tp-lkp-i')).color, vh: li.querySelector('.vh').textContent}))})""")
        want = [any(k in ("waiting", "publish", "events", "duplicates") for k in kp["kw"]) for kp in kps]
        assert [k["on"] for k in ui["kps"]] == want, (ui, want)
        found = sum(want)
        assert any(h.startswith("Key points") and f"{found} of {len(kps)}" in h for h in ui["head"]), ui["head"]
        on = next(k for k in ui["kps"] if k["on"])
        assert "You said “waiting”" in on["t"] and on["vh"].startswith("In your answer"), on
        assert on["color"] == ui["okInk"], (on, ui["okInk"])
        for k in ui["kps"]:
            if not k["on"]:
                assert _is_grey(k["color"]), f"un punto que falta no es gris: {k}"
                assert k["vh"].startswith("Not in your answer"), k
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- dictado largo
def _open_sr(hash, sr=FAKE_SR, kind="phone", **kw):
    page = C.new_page(kind, **kw)
    page.add_init_script(TC.SPEECH)
    if sr:
        page.add_init_script(sr)
    TC.open_tech(page, hash)
    page.evaluate(SPY)
    return page


def _ta(page):
    return page.evaluate("() => document.querySelector('#tp-lstage .tp-lta').value")


def _status(page):
    return page.evaluate("() => { const s = document.querySelector('#tp-lstage .tp-lstat'); return s && !s.hidden ? s.textContent : ''; }")


def _mic(page):
    return page.evaluate("""() => { const b = document.querySelector('#tp-lstage .tp-lmic'); return b ? {t: b.textContent.trim(), pressed: b.getAttribute('aria-pressed'),
      mic: b.hasAttribute('data-mic')} : null; }""")


def test_dictation_with_fake_speech_recognition():
    """«Answer aloud» con un SpeechRecognition de mentira: en-GB, continuous e interimResults; lo oído (también lo
    provisional) va al cuadro de texto, que se puede corregir; si el navegador lo corta, vuelve a arrancar solo; «Stop»
    lo para; seconds + 60 lo para con una línea tranquila; sin permiso o sin red, una línea tranquila y el cuadro; nunca
    a la vez que listen() (recNow); sin reconocimiento (o con canListen() falso, la app del iPhone), solo el cuadro."""
    page = _open_sr("#/techl/lesson/u01-l3")
    try:
        st = _skip_to(page, "u01-l3-i4")
        assert page.evaluate("() => vocabTech.lesson.dictation.can()") is True
        m = _mic(page)
        assert m and m["t"] == "Answer aloud" and m["pressed"] == "false" and m["mic"], m
        _press(page, "#tp-lstage .tp-lmic", "touch")
        log = page.evaluate("() => window.__srLog")
        assert log[0] == ["start", "en-GB", True, True], log
        assert _mic(page)["t"] == "Stop" and _mic(page)["pressed"] == "true", _mic(page)
        assert _status(page).startswith("Listening"), _status(page)
        assert page.evaluate("() => !!recNow && recNow._tech === true"), "el dictado no ocupa recNow"
        # mientras se dicta, listen() de la app dice «busy»
        assert page.evaluate("async () => (await listen({ms: 300})).status") == "busy"
        page.evaluate("() => __srSay('I would use', false)")
        assert _ta(page) == "I would use", _ta(page)
        page.evaluate("() => __srSay('I would use synchronous calls', true)")
        assert _ta(page) == "I would use synchronous calls", _ta(page)
        # el navegador lo corta: vuelve a arrancar solo y lo de antes sigue
        page.evaluate("() => __srCut()")
        page.wait_for_function("() => window.__srLog.filter(x => x[0] === 'start').length === 2", timeout=3000)
        page.evaluate("() => __srSay('when the caller waits', true)")
        assert _ta(page) == "I would use synchronous calls when the caller waits", _ta(page)
        # se puede corregir mientras se escucha: lo nuevo va detrás de lo corregido
        page.locator("#tp-lstage .tp-lta").fill("Synchronous when someone waits.")
        page.evaluate("() => __srSay('Otherwise events', true)")
        assert _ta(page) == "Synchronous when someone waits. Otherwise events", _ta(page)
        # Stop
        _press(page, "#tp-lstage .tp-lmic", "touch")
        page.wait_for_function("() => document.querySelector('#tp-lstage .tp-lmic').getAttribute('aria-pressed') === 'false'", timeout=3000)
        assert ["stop"] in page.evaluate("() => window.__srLog"), page.evaluate("() => window.__srLog")
        assert page.evaluate("() => recNow === null"), "recNow sigue ocupado tras Stop"
        assert _ta(page) == "Synchronous when someone waits. Otherwise events"
        # recNow ocupado por otra escucha: no empieza
        page.evaluate("() => { recNow = {_stop() {}}; }")
        n0 = len(page.evaluate("() => window.__sr"))
        _press(page, "#tp-lstage .tp-lmic", "touch")
        assert "busy" in _status(page), _status(page)
        assert len(page.evaluate("() => window.__sr")) == n0
        page.evaluate("() => { recNow = null; }")
        # sin permiso: una línea tranquila, el cuadro con el foco
        _press(page, "#tp-lstage .tp-lmic", "touch")
        page.evaluate("() => __srErr('not-allowed')")
        page.wait_for_function("() => document.querySelector('#tp-lstage .tp-lmic').getAttribute('aria-pressed') === 'false'", timeout=3000)
        assert _status(page) == "The microphone isn't allowed here. You can type your answer instead.", _status(page)
        assert page.evaluate("() => document.activeElement.classList.contains('tp-lta')")
        # sin red
        _press(page, "#tp-lstage .tp-lmic", "touch")
        page.evaluate("() => __srErr('network')")
        page.wait_for_function("() => document.querySelector('#tp-lstage .tp-lmic').getAttribute('aria-pressed') === 'false'", timeout=3000)
        assert _status(page).startswith("Speech recognition isn't available right now"), _status(page)
        # seconds + 60: para solo
        _press(page, "#tp-lstage .tp-lmic", "touch")
        secs = st["it"].get("seconds", 120)
        page.clock.fast_forward((secs + 61) * 1000)
        page.wait_for_function("() => document.querySelector('#tp-lstage .tp-lmic').getAttribute('aria-pressed') === 'false'", timeout=4000)
        assert _status(page) == f"Stopped listening after {round((secs + 60) / 60)} min. You can keep typing.", _status(page)
        assert page.evaluate("() => recNow === null")
        # el reloj siguió contando pasado el tiempo y «Done» sigue funcionando
        tm = page.evaluate("() => ({t: document.querySelector('#tp-lstage .tp-ltm').innerText, over: document.querySelector('#tp-lstage .tp-ltm').classList.contains('is-over')})")
        assert tm["over"] and "over" in tm["t"], tm
        _press(page, "#tp-ldone", "touch")
        page.wait_for_selector("#tp-lstage [data-ph=review]", timeout=3000)
        assert "Synchronous when someone waits. Otherwise events" in page.inner_text("#tp-lstage .tp-lyours")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
    # sin SpeechRecognition: no hay «Answer aloud», solo el cuadro
    no_sr = "(() => { for (const k of ['SpeechRecognition', 'webkitSpeechRecognition']) try { Object.defineProperty(window, k, {configurable: true, value: undefined}); } catch (e) {} })();"
    page = _open_sr("#/techl/lesson/u01-l3", sr=no_sr)
    try:
        _skip_to(page, "u01-l3-i4")
        assert _mic(page) is None, _mic(page)
        assert page.evaluate("() => vocabTech.lesson.dictation.can()") is False
        ph = page.get_attribute("#tp-lstage .tp-lta", "placeholder")
        assert "Answer aloud" not in ph, ph
        assert page.inner_text("#tp-lstage .tp-llab") == "Type your answer"
        # la API también lo dice: start() acaba en «unsupported»
        r = page.evaluate("() => new Promise(res => vocabTech.lesson.dictation.start({seconds: 30, onEnd: res}))")
        assert r["status"] == "unsupported", r
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
    # la app instalada del iPhone (canListen() falso): tampoco
    page = _open_sr("#/techl/lesson/u01-l3")
    try:
        page.evaluate("() => { window.canListen = () => false; }")
        _skip_to(page, "u01-l3-i4")
        assert _mic(page) is None, _mic(page)
        assert page.locator("#tp-lstage .tp-lta").count() == 1
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- «Explain it» → repaso
def test_explain_self_grade_feeds_srs():
    """«Explain it»: el reloj cuenta (y sigue pasado el tiempo), lo escrito se guarda mientras se escribe, «Done» enseña
    tu respuesta, la respuesta modelo con altavoz, los puntos clave y «How did it go?» (sin botón destacado: Not yet ·
    Partly · Nailed it, teclas 1-3). Nailed it = nota 2 (sube de caja), Partly = vuelve en 2 días (misma caja), Not yet =
    mañana (caja 0) y otra vez al final de la lección, sin volver a calificar. En el repaso cuenta como repaso (r)."""
    page = _open("#/techl/lesson/u01-l3")
    try:
        st = _skip_to(page, "u01-l3-i4")
        t0 = page.inner_text("#tp-lstage .tp-ltm-t")
        page.wait_for_timeout(1300)
        t1 = page.inner_text("#tp-lstage .tp-ltm-t")
        assert t0 == "0:00" and t1 in ("0:01", "0:02"), (t0, t1)
        page.locator("#tp-lstage .tp-lta").fill("I use a synchronous call when the caller waits.")
        page.wait_for_timeout(600)
        ls = page.evaluate("() => JSON.parse(sessionStorage.getItem('tech:ls'))")
        assert ls["lesson"]["cur"]["text"] == "I use a synchronous call when the caller waits.", ls
        assert ls["lesson"]["cur"]["k"] == "u01-l3-i4" and ls["lesson"]["started"], ls
        _press(page, "#tp-ldone", "touch")
        page.wait_for_selector("#tp-lstage [data-ph=review]", timeout=3000)
        rv = page.evaluate("""() => ({h: [...document.querySelectorAll('#tp-lstage .tp-lh3')].map(h => h.textContent.trim()),
          yours: document.querySelector('#tp-lstage .tp-lyours').textContent, meta: document.querySelector('#tp-lstage .tp-lmeta').textContent,
          modelSay: !!document.querySelector('#tp-lstage .tp-lsec .tp-say[data-say]'), dock: [...document.querySelectorAll('#tp-ldock button')].map(b => [b.textContent.trim(), b.getAttribute('data-key')])})""")
        assert rv["h"][:2] == ["Your answer", "Model answer"] and rv["h"][-1] == "How did it go?", rv
        assert any(h.startswith("Key points") for h in rv["h"]), rv
        assert rv["modelSay"] and "9 words" in rv["meta"], rv
        assert rv["dock"] == [["Not yet", "1"], ["Partly", "2"], ["Nailed it", "3"]], rv
        assert page.evaluate(_PRI) == 0, "la pantalla de calificar tiene un botón destacado"
        # el altavoz de la respuesta modelo habla en inglés
        n0 = len(TC.spoken(page))
        page.locator("#tp-lstage .tp-lsec .tp-say[data-say]:not([data-slow])").first.tap()
        page.wait_for_timeout(200)
        said = TC.spoken(page)[n0:]   # speak() lo parte en trozos: juntos son la respuesta modelo
        joined = " ".join(" ".join(x["text"].split()) for x in said)
        assert said and joined == " ".join(st["it"]["model"].split()), said
        assert all(x["lang"].startswith("en") for x in said), said
        _press(page, "#tp-lg-nailed", "touch")
        _wait_next(page, "u01-l3-i4")
        # i6 Partly, i8 Not yet, i9 y i10 Nailed it
        grades = {"u01-l3-i6": "partly", "u01-l3-i8": "notyet", "u01-l3-i9": "nailed", "u01-l3-i10": "nailed"}
        again = []
        for _ in range(20):
            s = _step(page)
            if not s:
                break
            if s["type"] == "explain":
                g = "nailed" if s["re"] else grades[s["id"]]
                if s["re"]:
                    again.append((s["k"], page.inner_text("#tp-lstage .tp-eyebrow")))
                    before = dict(TC.recs(page, "srs")[f"srs/{s['id']}"])
                _answer(page, ok=True, grade=g)
                _wait_next(page, s["k"])
                if s["re"]:
                    after = TC.recs(page, "srs")[f"srs/{s['id']}"]
                    assert after == before, f"volver a contestar cambió el repaso: {before} → {after}"
                continue
            _answer(page, ok=True)
            _go_on(page)
            _wait_next(page, s["k"])
        srs = TC.recs(page, "srs")
        e = lambda i: srs[f"srs/u01-l3-i{i}"]  # noqa: E731
        assert (e(4)["b"], e(4)["due"], e(4)["g"]) == (1, T + 1, 2), e(4)
        assert (e(6)["b"], e(6)["due"], e(6)["g"]) == (0, T + 2, 1), e(6)
        assert (e(8)["b"], e(8)["due"], e(8)["g"]) == (0, T + 1, 0), e(8)
        assert all(e(i)["t"] == "explain" and "r" not in e(i) for i in (4, 6, 8, 9, 10)), srs
        assert again == [("u01-l3-i8#2", "Again · Explain it · about 2 min")], again
        end = page.inner_text("#tp-lend")
        assert "Including 3 of 5 explanations you nailed" in end, end
        # en el repaso: Partly → 2 días y cuenta como repaso de hoy
        page.context.close()
        page = _open("#/techl/review", data=TC.data({"srs/u01-l3-i6": TC.srs(b=2, due=T, d=T - 3, g=2, t="explain")}))
        s = _step(page)
        assert s and s["type"] == "explain", s
        _answer(page, ok=True, text="Something short.", grade="partly")
        page.wait_for_selector("#tp-lrvend", timeout=4000)
        r = TC.recs(page, "srs")["srs/u01-l3-i6"]
        assert (r["b"], r["due"], r["g"], r.get("r")) == (2, T + 2, 1, T), r
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- límites del repaso
def test_review_limits_20_per_session_5_explain_per_day():
    """El repaso: como mucho 20 por sesión y 5 «Explain it» al día; las tarjetas como tarjetas que giran; al final
    «Review done», lo que vuelve y cuándo, y «Keep going · N more» trae las siguientes (sin más «Explain it» hoy).
    Vacío: «All caught up» y «Learn something new»."""
    other = [it for _, _, it in TC.items() if it["type"] not in ("say", "story", "explain")][:26]
    expl = [it for _, _, it in TC.items("explain")][:8]
    recs = {f"srs/{it['id']}": TC.srs(b=1, due=T - (1 if i % 3 == 0 else 0), d=T - 2, t=it["type"]) for i, it in enumerate(other + expl)}
    page = _open("#/techl/review", data=TC.data(recs))
    try:
        r = _run(page)
        assert r["kind"] == "review" and r["n"] == 20, r
        types = page.evaluate("() => vocabTech.srs.queue({limit: 99}).map(id => vocabTech.item(id).item.type)")
        ids = page.evaluate("() => JSON.parse(sessionStorage.getItem('tech:ls')).review.steps.map(s => s.id)")
        n_ex = sum(1 for i in ids if i in {it["id"] for it in expl})
        assert len(ids) == 20 and n_ex <= 5, (len(ids), n_ex)
        assert types.count("explain") <= 5, types
        TC.shot(page, "repaso", full_page=False)
        seen = _walk(page, text="A short answer.")
        assert len(seen) == 20, len(seen)
        assert any(x["type"] == "flip" for x in seen), [x["type"] for x in seen]
        page.wait_for_selector("#tp-lrvend", timeout=4000)
        end = page.evaluate("""() => ({t: document.getElementById('tp-lrvend').innerText, more: (document.getElementById('tp-lmore') || {}).textContent || '',
          rows: [...document.querySelectorAll('#tp-lrvend .tp-lwhen .tp-row')].map(r => r.innerText.replace(/\\s+/g, ' '))})""")
        assert "Review done" in end["t"] and "20 items reviewed · 20 right first time" in end["t"], end
        assert end["rows"] and "What comes back when" in end["t"], end
        due = page.evaluate("() => vocabTech.srs.dueCount()")
        # lo que queda: las demás y, de «Explain it», solo hasta 5 hoy contando las ya repasadas
        assert due == len(other) - (20 - n_ex) + min(len(expl) - n_ex, 5 - n_ex), (due, n_ex)
        assert end["more"] == f"Keep going · {min(20, due)} more", end
        TC.shot(page, "repaso-final", full_page=False)
        page.locator("#tp-lmore").tap()
        page.wait_for_function("() => { const r = vocabTech.lesson.running; return r && r.kind === 'review' && r.i === 0; }", timeout=4000)
        r2 = _run(page)
        assert r2["n"] == min(20, due), r2
        ids2 = page.evaluate("() => JSON.parse(sessionStorage.getItem('tech:ls')).review.steps.map(s => s.id)")
        assert not set(ids2) & set(ids), "se repiten fichas"
        n_ex2 = len([i for i in ids2 if i in {it["id"] for it in expl}])
        assert n_ex + n_ex2 <= 5, ("más de 5 «Explain it» hoy", n_ex, n_ex2)
        rv = [k for k, v in TC.recs(page, "srs").items() if v.get("r") == T]
        assert len(rv) == 20, len(rv)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
    page = _open("#/techl/review")
    try:
        t = page.inner_text("#app")
        assert "All caught up" in t and "Learn something new" in t, t
        assert page.get_attribute("#tp-llearn", "href") == "#/techl/lesson/u01-l1"
        TC.shot(page, "repaso-vacio", full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- seguir tras recargar
def _nav_stop(page, hash):
    """Ir a otra ruta con una sesión empezada: pregunta «Stop here?» y «Stop» lleva a donde se iba."""
    page.evaluate("h => { location.hash = h; }", hash)
    page.wait_for_function("""h => { const d = document.getElementById('tp-stop'); return (d && d.open) || location.hash === h; }""", arg=hash, timeout=4000)
    if _stop_open(page):
        page.locator("#tp-stop-out").click()
    page.wait_for_function("h => location.hash === h", arg=hash, timeout=4000)
    TC.wait_tech(page)
    C.settle(page, 200)


def test_resume_after_reload():
    """Lo empezado sobrevive a recargar (sessionStorage tech:ls) y a cerrar la pestaña (localStorage tech:lsdraft, 72 h):
    la misma pregunta, lo ya contestado, y el texto de «Explain it» con su reloj. Today dice «Continue». Terminada la
    lección, no queda nada a medias. Un borrador de hace más de 72 h no cuenta."""
    page = _open("#/techl/lesson/u01-l2", data=TC.data(_studied([]) | {"ls/u01-l1": TC.rec(best=4, total=4, done=TC.NOW_MS - 864e5)}))
    try:
        for _ in range(3):
            s = _step(page)
            _answer(page, ok=True)
            _go_on(page)
            _wait_next(page, s["k"])
        s3 = _step(page)
        keys = TC.tech_keys(page)
        assert "tech:ls" in keys["session"] and "tech:lsdraft" in keys["local"], keys
        page.reload()
        TC.wait_tech(page)
        r = _run(page)
        assert r["i"] == 3 and r["step"]["k"] == s3["k"], (r, s3)
        assert page.inner_text(".tp-lcount") == "4 of 10"
        assert page.get_attribute(".tp-lrun .tp-pbar", "aria-valuenow") == "3"
        # Today: «Continue»
        _nav_stop(page, "#/tech")
        assert page.inner_text("#tp-go").strip() == "Continue", page.inner_text(".tp-hero")
        # sin la pestaña (sessionStorage), con la copia del aparato
        page.evaluate("() => sessionStorage.removeItem('tech:ls')")
        TC.goto(page, "#/techl/lesson/u01-l2")
        assert _run(page)["step"]["k"] == s3["k"], _run(page)
        # «Explain it» a medias: el texto y el reloj vuelven
        _nav_stop(page, "#/techl/lesson/u01-l3")
        _skip_to(page, "u01-l3-i4")
        page.locator("#tp-lstage .tp-lta").fill("Half an answer")
        page.wait_for_timeout(2300)
        page.reload()
        TC.wait_tech(page)
        assert _step(page)["k"] == "u01-l3-i4"
        assert _ta(page) == "Half an answer", _ta(page)
        el = page.inner_text("#tp-lstage .tp-ltm-t")
        assert el != "0:00", el
        # u01-l2 sigue a medias en su copia (una lección por vez: la última)
        st = page.evaluate("() => vocabTech.lesson.state()")
        assert st["id"] == "u01-l3" and st["lesson"]["id"] == "u01-l3", st
        # terminar: ya no queda nada a medias
        _walk(page)
        assert page.inner_text("#tp-lend-t") == "Lesson complete"
        st = page.evaluate("() => vocabTech.lesson.state()")
        assert "lesson" not in st and "id" not in st, st
        # un borrador de hace más de 72 h no cuenta
        TC.goto(page, "#/techl/lesson/u01-l2")
        s = _step(page)
        _answer(page, ok=True)
        page.wait_for_timeout(100)
        # (al recargar se guarda otra vez al ocultarse la página: la copia se envejece al cargar, antes que la app;
        # sin sessionStorage, como una pestaña nueva tres días después)
        page.add_init_script("""(() => { try{ const d = JSON.parse(localStorage.getItem('tech:lsdraft')); if(d){ d.t -= 73 * 36e5; localStorage.setItem('tech:lsdraft', JSON.stringify(d)); }
          sessionStorage.removeItem('tech:ls'); }catch(e){} })()""")
        page.reload()
        TC.wait_tech(page)
        assert _run(page)["i"] == 0, _run(page)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- «Stop here?»
def _stop_open(page):
    return page.evaluate("() => { const d = document.getElementById('tp-stop'); return !!(d && d.open); }")


def test_exit_guard():
    """La ✕ (y Esc) sin haber contestado nada sale sin preguntar; con algo hecho pregunta «Stop here?» («Keep going»
    destacado · «Stop»): Keep going sigue en la misma pregunta; Atrás del navegador pregunta igual; Stop sale y lo
    hecho queda para seguir luego."""
    page = _open("#/tech")
    try:
        TC.goto(page, "#/techl/lesson/u01-l1")
        # sin contestar (las tarjetas solo se ven): sale sin preguntar
        s = _step(page)
        _go_on(page)
        _wait_next(page, s["k"])
        page.locator("#fx-x").click()
        page.wait_for_timeout(500)
        assert not _stop_open(page) and C.current_hash(page) == "tech", C.current_hash(page)
        # con algo hecho
        TC.goto(page, "#/techl/lesson/u01-l1")
        st = _skip_to(page, "u01-l1-i3")
        _answer(page, ok=False)
        page.locator("#fx-x").click()
        page.wait_for_function("() => { const d = document.getElementById('tp-stop'); return d && d.open; }", timeout=3000)
        sheet = page.evaluate("""() => { const d = document.getElementById('tp-stop'); return {t: d.querySelector('h2').textContent,
          b: [...d.querySelectorAll('button')].map(b => [b.textContent.trim(), b.classList.contains('glass-btn--pri')])}; }""")
        assert sheet == {"t": "Stop here?", "b": [["Stop", False], ["Keep going", True]]}, sheet
        TC.shot(page, "leccion-parar", full_page=False)
        page.locator("#tp-stop-go").click()
        page.wait_for_function("() => !document.getElementById('tp-stop').open", timeout=3000)
        assert C.current_hash(page) == "techl/lesson/u01-l1" and _step(page)["k"] == st["k"], _step(page)
        # Esc también pregunta
        page.keyboard.press("Escape")
        page.wait_for_function("() => document.getElementById('tp-stop').open", timeout=3000)
        page.locator("#tp-stop-go").click()
        page.wait_for_function("() => !document.getElementById('tp-stop').open", timeout=3000)
        # Atrás del navegador
        page.go_back()
        page.wait_for_function("() => document.getElementById('tp-stop').open", timeout=3000)
        assert C.current_hash(page) == "techl/lesson/u01-l1", C.current_hash(page)
        page.locator("#tp-stop-go").click()
        page.wait_for_function("() => !document.getElementById('tp-stop').open", timeout=3000)
        assert C.current_hash(page) == "techl/lesson/u01-l1" and _step(page)["k"] == st["k"]
        # Stop: sale, y lo hecho queda
        page.locator("#fx-x").click()
        page.wait_for_function("() => document.getElementById('tp-stop').open", timeout=3000)
        page.locator("#tp-stop-out").click()
        page.wait_for_function("() => !location.hash.startsWith('#/techl')", timeout=4000)
        C.settle(page, 300)
        assert _run(page) is None, _run(page)
        st2 = page.evaluate("() => vocabTech.lesson.state()")
        assert st2["id"] == "u01-l1" and st2["lesson"]["res"].get("u01-l1-i3"), st2
        # al volver sigue en la primera sin contestar (la fallada vuelve al final de la lección)
        left = [x["k"] for x in st2["lesson"]["steps"] if x["k"] not in st2["lesson"]["res"]]
        assert "u01-l1-i3#2" in left, left
        TC.goto(page, "#/techl/lesson/u01-l1")
        assert _step(page)["k"] == left[0], (_step(page), left)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- la entrevista de práctica
_SEG = """() => [...document.querySelectorAll('#tp-mk [role=radio]')].map(b => [b.textContent.trim(), b.getAttribute('aria-checked')])"""


def _ui(page):
    return json.loads(TC.tech_keys(page)["local"].get("tech:ui") or "{}")


def _mock_answer(page, grade="nailed", ok=True, write=False, how="touch"):
    """Contesta la pregunta de ahora de la entrevista y pasa a la siguiente. Devuelve el paso."""
    st = _step(page)
    it = st["it"]
    if st["type"] == "explain":
        page.wait_for_selector("#tp-lstage .tp-lta", timeout=3000)
        page.locator("#tp-lstage .tp-lta").fill((it.get("model") or "An answer in my own words.")[:300])
        _press(page, "#tp-ldone", how)
        page.wait_for_selector("#tp-lstage [data-ph=review]", timeout=3000)
        if write:
            page.locator("#tp-lstage .tp-lwr").tap()
            page.wait_for_selector("#tp-lstage .tp-lwr[aria-pressed=true]", timeout=2000)
        _press(page, f"#tp-lg-{grade}", how)
    else:
        _answer(page, ok=ok, how=how)
        _go_on(page, how)
    _wait_next(page, st["k"])
    return st


def test_mock_interview_end_to_end():
    """Interview (#/techmock): Length 15/30 minutes y Questions from (las unidades estudiadas o todas), que se guardan en
    tech:ui y se mueven con las flechas; Start abre la entrevista en modo foco con «Question n of N · Unit k · tipo», el
    reloj y la respuesta modelo al terminar cada una. Se sigue tras recargar y desde «In progress · Continue». Al final,
    «Interview complete»: cada pregunta con su tiempo y su nota, un registro mock/<id> {when, n, grades, secs, items, len,
    scope, total}, las historias por escribir, y «Practise the weak ones» con solo las flojas. En Past interviews cada
    fila abre su hoja."""
    page = _open("#/techmock", data=TC.data(_studied(["u01", "u07"])))
    try:
        n_units = len(TC.units())
        assert page.evaluate(_SEG) == [["15 minutes", "true"], ["30 minutes", "false"], ["Units I've studied", "true"], ["All available units", "false"]]
        assert page.inner_text("#tp-mk-ls") == "About 5 questions" and page.inner_text("#tp-mk-ss") == "Unit 1, Unit 7"
        assert "Your mock interviews will appear here." in page.inner_text("#tp-mk")
        assert page.evaluate(_PRI) == 1
        probs = _screen_audit(page, "preparar")
        assert not probs, "\n".join(probs)
        TC.shot(page, "entrevista-preparar", full_page=False)
        page.locator("#tp-mk [data-len='30']").tap()
        page.locator("#tp-mk [data-scope='all']").tap()
        assert page.inner_text("#tp-mk-ls") == "About 9 questions"
        assert page.inner_text("#tp-mk-ss") == f"All {n_units} available units", page.inner_text("#tp-mk-ss")
        assert (_ui(page).get("mockLen"), _ui(page).get("mockScope")) == (30, "all"), _ui(page)
        # las flechas (radio)
        page.locator("#tp-mk [data-len='30']").focus()
        page.keyboard.press("ArrowLeft")
        page.locator("#tp-mk [data-scope='all']").focus()
        page.keyboard.press("ArrowRight")
        assert (_ui(page).get("mockLen"), _ui(page).get("mockScope")) == (15, "studied"), _ui(page)
        assert page.evaluate("() => document.activeElement.dataset.scope") == "studied"
        page.locator("#tp-mk [data-len='30']").tap()
        page.reload()
        TC.wait_tech(page)
        assert page.evaluate(_SEG)[1] == ["30 minutes", "true"], page.evaluate(_SEG)
        page.locator("#tp-mk [data-len='15']").tap()
        page.locator("#tp-mk-start").tap()
        page.wait_for_function("() => { const r = vocabTech.lesson.running; return r && r.kind === 'mock'; }", timeout=6000)
        assert C.current_hash(page) == "techl/mock"
        r = _run(page)
        assert r["n"] == 5, r
        ids = [s["id"] for s in page.evaluate("() => vocabTech.lesson.state().mock.steps")]
        assert all(i[:3] in ("u01", "u07") for i in ids), ids
        types = [TC.item(i)["type"] for i in ids]
        assert sorted(types) == ["explain", "explain", "explain", "scenario", "story"], types
        assert page.inner_text(".tp-lrun .tp-lrt") == "Mock interview"
        # cada pregunta: explain Nailed it · Partly · Not yet, la historia Partly (y «Write yours»), el escenario mal
        ex = iter(["nailed", "partly", "notyet"])
        want = {}
        for n in range(5):
            st = _step(page)
            kind = {"explain": "Explain it", "story": "Story", "scenario": "Scenario"}[st["it"]["type"]]
            eye = page.inner_text("#tp-lstage .tp-eyebrow")
            assert eye.startswith(f"Question {n + 1} of 5 · Unit {int(st['id'][1:3])} · {kind}"), eye
            if st["it"]["type"] != "scenario":
                assert page.locator("#tp-lstage .tp-ltm").count() == 1, "sin reloj"
            if n == 0:
                TC.shot(page, "entrevista", full_page=False)
            if st["it"]["type"] == "scenario":
                _mock_answer(page, ok=False)
                want[st["id"]] = "wrong"
            elif st["it"]["type"] == "story":
                _mock_answer(page, grade="partly", write=True)
                want[st["id"]] = "partly"
            else:
                g = next(ex)
                _mock_answer(page, grade=g)
                want[st["id"]] = g
            if n == 1:
                # recargar: sigue en la misma
                k = _step(page)["k"]
                page.reload()
                TC.wait_tech(page)
                assert _run(page)["kind"] == "mock" and _step(page)["k"] == k and _run(page)["i"] == 2, _run(page)
                # «In progress · Continue» en Interview
                _nav_stop(page, "#/techmock")
                t = page.inner_text("#tp-mk")
                assert "In progress" in t and "2 of 5 questions answered" in t and "Start a new one" in t, t
                assert page.evaluate(_PRI) == 1 and page.get_attribute("#tp-mk-cont", "class").count("glass-btn--pri") == 1
                assert "glass-btn--pri" not in page.get_attribute("#tp-mk-start", "class")
                TC.shot(page, "entrevista-en-marcha", full_page=False)
                page.locator("#tp-mk-cont").tap()
                page.wait_for_function("() => { const r = vocabTech.lesson.running; return r && r.kind === 'mock'; }", timeout=6000)
                assert _step(page)["k"] == k
        page.wait_for_selector("#tp-lmkend", timeout=4000)
        end = page.inner_text("#tp-lmkend")
        assert "Interview complete" in end and "5 questions" in end, end
        rows = page.evaluate("() => [...document.querySelectorAll('#tp-lmkend .tp-lsum-r')].map(r => r.innerText.replace(/\\s+/g, ' '))")
        assert len(rows) == 5, rows
        assert "Your stories to write" in end, end
        story_row = page.get_attribute("#tp-lmkend .tp-list a.tp-row", "href")
        assert story_row.startswith("#/techstory/"), story_row
        assert _dock(page) == [{"t": "Done", "id": "tp-ldone", "pri": False, "key": "", "dis": False},
                               {"t": "Practise the weak ones", "id": "tp-lweak", "pri": True, "key": "enter", "dis": False}], _dock(page)
        assert page.evaluate(_PRI) == 1
        mocks = TC.recs(page, "mock")
        assert len(mocks) == 1, mocks
        (mk, m), = mocks.items()
        mid = mk.split("/", 1)[1]
        assert {"when", "n", "grades", "secs", "items", "len", "scope", "total"} <= set(m), m
        assert m["n"] == 5 and m["items"] == ids and m["len"] == 15 and m["scope"] == "studied", m
        assert m["grades"] == want, (m["grades"], want)
        assert all(isinstance(v, int) and v >= 0 for v in m["secs"].values()) and m["total"] == sum(m["secs"].values()), m
        srs = TC.recs(page, "srs")
        for i in ids:
            t = TC.item(i)["type"]
            if t == "story":
                assert f"srs/{i}" not in srs, "una historia entró en el repaso"
            else:
                assert srs[f"srs/{i}"]["t"] == t, srs.get(f"srs/{i}")
        # como el repaso: lo nuevo y la historia suman actividad aquí (5); lo que ya estaba en el repaso, js/tech.js
        act = TC.recs(page, "act")[f"act/{TC.day_str(T)}"]
        assert act["n"] == 5, act
        stories = TC.recs(page, "story")
        sid = story_row.split("/")[-1]
        assert f"story/{sid}" in stories and stories[f"story/{sid}"]["from"] in ids, stories
        TC.shot(page, "entrevista-final", full_page=False)
        # solo las flojas
        page.locator("#tp-lweak").tap()
        page.wait_for_function("() => { const r = vocabTech.lesson.running; return r && r.kind === 'mock' && r.i === 0; }", timeout=6000)
        weak = [i for i in ids if want[i] != "nailed"]
        r = _run(page)
        assert r["n"] == len(weak) == 4, (r, weak)
        for _ in range(4):
            _mock_answer(page, grade="nailed", ok=True)
        page.wait_for_selector("#tp-lmkend", timeout=4000)
        assert _dock(page) == [{"t": "Done", "id": "tp-ldone", "pri": True, "key": "enter", "dis": False}], _dock(page)
        srs2 = TC.recs(page, "srs")
        assert all(srs2[f"srs/{i}"].get("r") == T for i in weak if TC.item(i)["type"] != "story"), {i: srs2.get(f"srs/{i}") for i in weak}
        assert TC.recs(page, "act")[f"act/{TC.day_str(T)}"]["n"] == 9, TC.recs(page, "act")
        page.locator("#tp-ldone").tap()
        page.wait_for_function("() => location.hash === '#/techmock'", timeout=4000)
        TC.wait_tech(page)
        hist = page.evaluate("() => [...document.querySelectorAll('#tp-mk [data-mk]')].map(r => [r.dataset.mk, r.innerText.replace(/\\s+/g, ' ')])")
        assert len(hist) == 2 and hist[1][0] == mid, hist
        assert "4 questions" in hist[0][1] and "3 nailed it · 1 right" in hist[0][1], hist
        assert "5 questions" in hist[1][1] and "1 nailed it · 2 partly · 1 not yet · 1 wrong" in hist[1][1], hist
        # la fila abre su hoja; la de las flojas no propone repetir
        page.locator(f"#tp-mk [data-mk='{hist[1][0]}']").tap()
        page.wait_for_function("() => { const d = document.getElementById('tp-lmks'); return d && d.open; }", timeout=3000)
        sh = page.inner_text("#tp-lmks")
        assert "Practise the weak ones" in sh and len(page.query_selector_all("#tp-lmks .tp-lsum-r")) == 5, sh
        TC.shot(page, "entrevista-historial", full_page=False)
        page.locator("#tp-lmks .tp-sdone").tap()
        page.wait_for_function("() => !document.getElementById('tp-lmks').open", timeout=3000)
        page.locator(f"#tp-mk [data-mk='{hist[0][0]}']").tap()
        page.wait_for_function("() => { const d = document.getElementById('tp-lmks'); return d && d.open; }", timeout=3000)
        assert "Practise the weak ones" not in page.inner_text("#tp-lmks")
        page.locator("#tp-lmks .tp-sdone").tap()
        page.wait_for_function("() => !document.getElementById('tp-lmks').open", timeout=3000)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- practicar un caso
def _cases():
    p = C.REPO / "data" / "tech" / "cases.json"
    try:
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None
    except Exception:
        return None


def test_case_practice():
    """Practise this case (#/techl/case/<id>, con vocabTech.cases.questions de js/tech-pages.js): las preguntas del
    entrevistador una a una, como «Explain it» con su respuesta modelo y sus puntos clave; «Case notes» abre el caso en
    una hoja. Al final, «Case practice complete» y un registro cp/<id>; no entra en el repaso. Un caso propio recibe las
    preguntas generales con «A strong answer covers». Un caso que no existe lo dice. Sin las preguntas (sin
    js/tech-pages.js), un aviso tranquilo."""
    cases = _cases()
    page = _open("#/tech")
    try:
        has = page.evaluate("() => !!(vocabTech.cases && typeof vocabTech.cases.questions === 'function')")
        if not has or not cases or not cases.get("cases"):
            TC.goto(page, "#/techl/case/anything")
            t = page.inner_text("#app")
            assert "Case practice isn't here yet" in t, t
            print("      SKIP: sin vocabTech.cases.questions o sin data/tech/cases.json (js/tech-pages.js de T3): solo el aviso tranquilo")
            return
        case = cases["cases"][0]
        cid, qs = case["id"], case["questions"]
        TC.goto(page, f"#/techl/case/{cid}")
        page.wait_for_function("() => { const r = vocabTech.lesson.running; return r && r.kind === 'case'; }", timeout=6000)
        r = _run(page)
        assert r["n"] == len(qs) and r["id"] == cid, r
        assert page.inner_text(".tp-lrun .tp-lrt") == "Case practice"
        eye = page.inner_text("#tp-lstage .tp-eyebrow")
        assert eye.startswith(f"Question 1 of {len(qs)}"), eye
        assert page.inner_text("#tp-lstage .tp-lq") == qs[0]["q"]
        # «Case notes»
        page.locator("#tp-lcaseb").tap()
        page.wait_for_function("() => { const d = document.getElementById('tp-lcase'); return d && d.open && !d.innerText.includes('Loading'); }", timeout=4000)
        notes = page.inner_text("#tp-lcase")
        assert case["title"] in notes and "Context and problem" in notes and case["fields"]["context"][:40] in notes, notes
        TC.shot(page, "caso-notas", full_page=False)
        page.locator("#tp-lcase .tp-sdone").tap()
        page.wait_for_function("() => !document.getElementById('tp-lcase').open", timeout=3000)
        # la primera, con la respuesta modelo: los puntos clave se marcan
        res = _answer(page, ok=True, grade="nailed")
        assert res["review"]["kps"] == len(qs[0]["keypoints"]) and res["review"]["found"] >= 1, res["review"]
        _wait_next(page, res["k"])
        # la segunda, corta: Not yet (no vuelve a salir: no es una lección)
        res = _answer(page, ok=True, text="It depends on the volume.", grade="notyet")
        _wait_next(page, res["k"])
        TC.shot(page, "caso-practica", full_page=False)
        page.reload()
        TC.wait_tech(page)
        assert _run(page)["kind"] == "case" and _run(page)["i"] == 2, _run(page)
        assert page.locator("#tp-lcaseb").count() == 1
        _walk(page, grade="partly", text="A short answer about the case.")
        page.wait_for_selector("#tp-lcsend", timeout=4000)
        t = page.inner_text("#tp-lcsend")
        assert "Case practice complete" in t and f"{len(qs)} questions" in t, t
        assert page.get_attribute("#tp-ldone", "href") == f"#/techcase/{cid}"
        cp = TC.recs(page, "cp")[f"cp/{cid}"]
        assert cp["n"] == len(qs) and cp["grades"][qs[0]["id"]] == "nailed" and cp["grades"][qs[1]["id"]] == "notyet", cp
        assert not [k for k in TC.recs(page, "srs") if any(q["id"] in k for q in qs)], "las preguntas del caso entraron en el repaso"
        assert page.evaluate(_PRI) == 1
        TC.shot(page, "caso-final", full_page=False)
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
    # un caso propio: las preguntas generales, sin respuesta modelo, con «A strong answer covers»
    own = {"case/my-own1": TC.rec(title="Payroll export", fields={"context": "A payroll file goes to the bank every night.", "decision": "We moved to an API."})}
    page = _open("#/techl/case/my-own1", data=TC.data(own))
    try:
        page.wait_for_function("() => { const r = vocabTech.lesson.running; return r && r.kind === 'case'; }", timeout=6000)
        assert _run(page)["n"] == len(cases["generic"]), _run(page)
        res = _answer(page, ok=True, text="We send the file at night because the bank only reads it in the morning.", grade="partly")
        t = res["review"]["text"]
        assert "A strong answer covers" in t and "Model answer" not in t and res["review"]["kps"] == 0, t
        page.locator("#tp-lcaseb").tap()
        page.wait_for_function("() => { const d = document.getElementById('tp-lcase'); return d && d.open && !d.innerText.includes('Loading'); }", timeout=4000)
        notes = page.inner_text("#tp-lcase")
        assert "Payroll export" in notes and "A payroll file goes to the bank every night." in notes and "Options considered" not in notes, notes
        page.locator("#tp-lcase .tp-sdone").tap()
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
    # un caso que no existe
    page = _open("#/techl/case/no-such-case")
    try:
        page.wait_for_selector(".tp-lcalm", timeout=6000)
        t = page.inner_text("#app")
        assert "This case isn't here" in t and _run(page) is None, t
        assert page.get_attribute(".tp-lcalm .glass-btn--pri", "href") == "#/techcases"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- nada del niño
def test_no_kid_keys_and_no_kid_events():
    """Una lección entera, el repaso, una entrevista y un caso: la partida del niño sigue igual (vocabSave.snapshot y la
    exportación de tests/e2e/baseline/export.json), solo cambian claves tech:* que vocabSave.typeOf() no reconoce, y no
    se emite coins, lesson-done, review-done, game-done, medal, gift-open ni answer."""
    due = [it for _, _, it in TC.items("pick", "u02")][:2]
    page = _open("", data=TC.data({f"srs/{it['id']}": TC.srs(b=1, due=T, d=T - 1, t="pick") for it in due}))
    try:
        before = TC.kid_snapshot(page)
        ls0 = {k: v for k, v in C.storage(page).items() if not k.startswith("tech:")}
        # (sessionStorage: sin vocab:posy, la posición de scroll de cada pantalla que index.html recuerda al navegar)
        ss0 = page.evaluate("() => Object.fromEntries(Object.keys(sessionStorage).filter(k => !k.startsWith('tech:') && k !== 'vocab:posy').map(k => [k, sessionStorage.getItem(k)]))")
        TC.bus_log(page)
        TC.goto(page, "#/techl/lesson/u01-l1")
        _walk(page, plan=lambda i, st: i % 3 != 1)
        assert page.inner_text("#tp-lend-t") == "Lesson complete"
        TC.goto(page, "#/techl/review")
        _walk(page)
        page.wait_for_selector("#tp-lrvend", timeout=4000)
        TC.goto(page, "#/techmock")
        page.locator("#tp-mk-start").tap()
        page.wait_for_function("() => { const r = vocabTech.lesson.running; return r && r.kind === 'mock'; }", timeout=6000)
        for _ in range(_run(page)["n"]):
            _mock_answer(page, grade="partly", ok=False)
        page.wait_for_selector("#tp-lmkend", timeout=4000)
        has_cases = page.evaluate("() => !!(vocabTech.cases && typeof vocabTech.cases.questions === 'function')") and _cases()
        if has_cases:
            TC.goto(page, f"#/techl/case/{_cases()['cases'][0]['id']}")
            page.wait_for_function("() => { const r = vocabTech.lesson.running; return r && r.kind === 'case'; }", timeout=6000)
            _walk(page, grade="nailed", text="Short.")
            page.wait_for_selector("#tp-lcsend", timeout=4000)
        TC.goto(page, "#/tech")
        page.locator("#tp-back").click()
        page.wait_for_function("() => location.hash === '' || location.hash === '#/'", timeout=4000)
        C.settle(page, 300)
        d = C.diff_exports(before, TC.kid_snapshot(page), allow_new=False)
        assert not d, "Tech Prep cambió la partida del niño:\n  " + "\n  ".join(d)
        d2 = C.diff_exports(C.load_baseline(), C.export(page))
        assert not d2, "la exportación ya no es la de la base:\n  " + "\n  ".join(d2)
        ls1 = {k: v for k, v in C.storage(page).items() if not k.startswith("tech:")}
        changed = sorted(k for k in set(ls0) | set(ls1) if ls0.get(k) != ls1.get(k))
        assert not changed, f"claves que no son de Tech Prep cambiaron: {changed}"
        ss1 = page.evaluate("() => Object.fromEntries(Object.keys(sessionStorage).filter(k => !k.startsWith('tech:') && k !== 'vocab:posy').map(k => [k, sessionStorage.getItem(k)]))")
        assert ss1 == ss0, (ss0, ss1)
        tk = TC.tech_keys(page)
        known = page.evaluate("ks => ks.filter(k => { try { return !!vocabSave.typeOf(k); } catch (e) { return false; } })", list(tk["local"]) + list(tk["session"]))
        assert not known, f"vocabSave.typeOf() reconoce claves de Tech Prep: {known}"
        assert TC.bus_seen(page) == [], TC.bus_seen(page)
        assert TC.recs(page, "mock") and TC.recs(page, "ls").get("ls/u01-l1"), "no se guardó lo de Tech Prep"
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()


# ---------------------------------------------------------------- las pantallas: 390×844, 360×740, escritorio; claro y oscuro
_SCREEN_LESSONS = ["u01-l1", "u01-l2", "u01-l3", "u07-l2", "u02-l2"]


def _screen(page, label, probs, desk=False, shot=None):
    probs += _screen_audit(page, label)
    n = page.evaluate(_PRI)
    if n > 1:
        probs.append(f"{label}: {n} botones destacados")
    if desk:
        probs += [f"{label} línea larga: {x}" for x in page.evaluate(_MEASURE)]
    if shot:
        TC.shot(page, shot, full_page=False)


def _screens_session(page, label, probs, desk=False, shots=None):
    """Recorre la sesión de ahora; la primera vez de cada tipo mira la pantalla antes y después de contestar (mal, si se
    puede), y «Explain it» con la respuesta modelo (los puntos clave marcados) antes de calificar. shots: {tipo: nombre}."""
    shots = shots or {}
    how = "click" if desk else "touch"
    seen = set()
    for _ in range(80):
        r = _run(page)
        if not r or r["ended"] or not r["step"]:
            break
        st = r["step"]
        t = st["type"]
        new = t not in seen and not st["re"]
        seen.add(t)
        if new:
            _screen(page, f"{label} {st['k']} {t}", probs, desk, shots.get(t))
        if t == "explain":
            page.wait_for_selector("#tp-lstage .tp-lta", timeout=3000)
            model = st["it"].get("model") or "My answer in a few words."
            page.locator("#tp-lstage .tp-lta").fill(model if len(model) <= 400 else model[:400].rsplit(". ", 1)[0] + ".")
            _press(page, "#tp-ldone", how)
            page.wait_for_selector("#tp-lstage [data-ph=review]", timeout=3000)
            if new:
                page.wait_for_timeout(200)
                _screen(page, f"{label} {st['k']} explain revisión", probs, desk)
                if shots.get("explain-revision"):   # la captura, con los puntos clave a la vista
                    page.evaluate("() => { const k = document.querySelector('#tp-lstage .tp-lkps, #tp-lstage .tp-lcov, #tp-lstage .tp-lstar'); if (k) k.closest('section').scrollIntoView({block: 'center'}); }")
                    page.wait_for_timeout(150)
                    TC.shot(page, shots["explain-revision"], full_page=False)
                    page.evaluate("() => scrollTo(0, 0)")
            _press(page, "#tp-lg-nailed", how)
            _wait_next(page, st["k"])
            continue
        ok = not new or t in ("card", "say", "story", "flip")
        _answer(page, ok=ok, how=how)
        if t == "flip":
            _wait_next(page, st["k"])
            continue
        if new and t not in ("card", "say", "story"):
            page.wait_for_timeout(220)
            _screen(page, f"{label} {st['k']} {t} mal", probs, desk, shots.get(t + "-mal"))
        _go_on(page, how)
        _wait_next(page, st["k"])
    return seen


def _screens(kind, scheme, tag, shots=None, **ctx):
    """Las pantallas del motor en un tamaño y un tema: lecciones (los 11 tipos), el final, el repaso y su final, la
    entrevista (preparar, una pregunta, el final) y un caso. Devuelve los problemas."""
    shots = shots or {}
    desk = kind == "desk"
    probs = []
    due = [it for _, _, it in TC.items("pick", "u03")][:2] + [it for _, _, it in TC.items("card", "u03")][:1] + [it for _, _, it in TC.items("explain", "u03")][:1]
    recs = {f"srs/{it['id']}": TC.srs(b=1, due=T, d=T - 2, t=it["type"]) for it in due}
    page = _open("#/tech", kind=kind, color_scheme=scheme, data=TC.data(recs), **ctx)
    try:
        seen = set()
        for lid in _SCREEN_LESSONS:
            TC.goto(page, f"#/techl/lesson/{lid}")
            seen |= _screens_session(page, f"{tag} {lid}", probs, desk, shots.get("lesson"))
            page.wait_for_selector("#tp-lend", timeout=4000)
            page.wait_for_timeout(400)
            _screen(page, f"{tag} {lid} final", probs, desk, shots.get("end") if lid == _SCREEN_LESSONS[-1] else None)
        missing = ALL11 - seen
        if missing:
            probs.append(f"{tag}: tipos sin ver {sorted(missing)}")
        TC.goto(page, "#/techl/review")
        _screens_session(page, f"{tag} repaso", probs, desk, shots.get("review"))
        page.wait_for_selector("#tp-lrvend", timeout=4000)
        _screen(page, f"{tag} repaso final", probs, desk, shots.get("review-end"))
        TC.goto(page, "#/techmock")
        _screen(page, f"{tag} entrevista preparar", probs, desk, shots.get("mock-setup"))
        page.locator("#tp-mk-start").tap() if kind == "phone" else page.locator("#tp-mk-start").click()
        page.wait_for_function("() => { const r = vocabTech.lesson.running; return r && r.kind === 'mock'; }", timeout=6000)
        _screens_session(page, f"{tag} entrevista", probs, desk, shots.get("mock"))
        page.wait_for_selector("#tp-lmkend", timeout=4000)
        _screen(page, f"{tag} entrevista final", probs, desk, shots.get("mock-end"))
        if page.evaluate("() => !!(vocabTech.cases && typeof vocabTech.cases.questions === 'function')") and _cases():
            TC.goto(page, f"#/techl/case/{_cases()['cases'][0]['id']}")
            page.wait_for_function("() => { const r = vocabTech.lesson.running; return r && r.kind === 'case'; }", timeout=6000)
            _screen(page, f"{tag} caso", probs, desk)
            page.locator("#tp-lcaseb").click()
            page.wait_for_function("() => { const d = document.getElementById('tp-lcase'); return d && d.open && !d.innerText.includes('Loading'); }", timeout=4000)
            page.wait_for_timeout(300)
            probs += [f"{tag} notas del caso: {x}" for x in page.evaluate(AUDIT, {"what": ["contrast"]})["contrast"]]
            page.locator("#tp-lcase .tp-sdone").click()
        probs += [f"{tag} consola: {x}" for x in C.errors(page)]
    finally:
        page.context.close()
    return probs


def test_screens_phone_390_light_and_dark():
    """390×844 en claro y en oscuro: cada tipo antes y después de contestar, «Explain it» con los puntos clave, los
    finales, el repaso, la entrevista y un caso pasan contraste ≥ 4.5:1, la paleta (sin morado, rosa, índigo ni naranja),
    nombres y roles, objetivos ≥ 44 px, letra ≥ 15 px, sin scroll horizontal, sin botones cortados y con un solo botón
    destacado."""
    probs = _screens("phone", "light", "390", shots={"lesson": {"explain-revision": "leccion-explain-revision"}, "end": "leccion-final",
                                                     "review": {"flip": "repaso-tarjeta"}})
    probs += _screens("phone", "dark", "390 oscuro", shots={
        "lesson": {"pick-mal": "oscuro-leccion-pick-mal", "order": "oscuro-leccion-order", "code-mal": "oscuro-leccion-code-mal",
                   "diagram": "oscuro-leccion-diagram", "match-mal": "oscuro-leccion-match-mal", "explain-revision": "oscuro-leccion-explain-revision",
                   "card": "oscuro-leccion-card", "story": "oscuro-leccion-story"},
        "end": "oscuro-leccion-final", "review": {"pick": "oscuro-repaso"}, "review-end": "oscuro-repaso-final",
        "mock-setup": "oscuro-entrevista-preparar", "mock": {"explain-revision": "oscuro-entrevista-revision"}, "mock-end": "oscuro-entrevista-final"})
    assert not probs, "\n".join(probs[:40])


def test_screens_phone_360_light_and_dark():
    """Lo mismo a 360×740 (el móvil estrecho), en claro y en oscuro."""
    probs = _screens("phone", "light", "360", viewport=NARROW, shots={"lesson": {"order": "360-leccion-order", "code-mal": "360-leccion-code-mal"},
                                                                       "mock-end": "360-entrevista-final", "review-end": "360-repaso-final"})
    probs += _screens("phone", "dark", "360 oscuro", viewport=NARROW, shots={"lesson": {"diagram-mal": "360-oscuro-leccion-diagram-mal"}})
    assert not probs, "\n".join(probs[:40])


def test_screens_desktop_light_and_dark():
    """En escritorio (1280×800), en claro y en oscuro: lo mismo y además las líneas de texto de no más de ~70 caracteres."""
    probs = _screens("desk", "light", "escritorio", shots={"lesson": {"code": "escritorio-leccion-code", "explain-revision": "escritorio-leccion-explain-revision",
                                                                       "match-mal": "escritorio-leccion-match-mal"},
                                                            "mock-setup": "escritorio-entrevista-preparar", "mock-end": "escritorio-entrevista-final"})
    probs += _screens("desk", "dark", "escritorio oscuro", shots={"lesson": {"diagram": "escritorio-oscuro-leccion-diagram"}})
    assert not probs, "\n".join(probs[:40])


# ---------------------------------------------------------------- Reducir movimiento
_RM_HOOK = """(() => {
  window.__long = [];
  const orig = Element.prototype.animate;
  Element.prototype.animate = function (kf, op) {
    const a = orig.call(this, kf, op);
    try { const t = a.effect.getComputedTiming(); const d = (t.duration || 0) * (t.iterations === Infinity ? 1e6 : (t.iterations || 1)) + (t.delay || 0);
      if (d > 160) window.__long.push((this.className || this.tagName) + ' ' + Math.round(t.duration) + ' ms · ' + location.hash); } catch (e) {}
    return a;
  };
})();"""
_RM_RUNNING = """() => { const out = []; for (const a of document.getAnimations()) { try { const t = a.effect.getComputedTiming();
  const d = (t.duration || 0) * (t.iterations === Infinity ? 1e6 : (t.iterations || 1)) + (t.delay || 0);
  if (d > 160) { const el = a.effect.target; out.push((a.animationName || a.transitionProperty || 'js') + ' ' + (el ? el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className.trim().split(/\\s+/)[0] : '') : '') + ' ' + Math.round(t.duration) + ' ms'); } } catch (e) {} } return out; }"""


def test_reduced_motion_160ms():
    """Con Reducir movimiento: contestar bien y mal, pasar de pregunta, el final con su medalla, girar una tarjeta del
    repaso, «Stop here?» y la hoja de una entrevista: nada se anima más de 160 ms."""
    due = [it for _, _, it in TC.items("card", "u02")][:1]
    page = TC.tech_page("phone", hash="#/tech", data=TC.data({f"srs/{it['id']}": TC.srs(b=1, due=T, d=T - 2, t="card") for it in due}), reduced_motion="reduce")
    probs = []
    try:
        page.context.add_init_script(_RM_HOOK)
        page.reload()
        TC.wait_tech(page)

        def look(tag, n=3):
            for _ in range(n):
                page.wait_for_timeout(60)
                probs.extend(f"{tag}: {x}" for x in page.evaluate(_RM_RUNNING))
        for lid in ("u01-l1", "u01-l2"):
            TC.goto(page, f"#/techl/lesson/{lid}")
            for i in range(40):
                r = _run(page)
                if not r or r["ended"] or not r["step"]:
                    break
                st = r["step"]
                look(f"{st['k']} {st['type']}", 1)
                _answer(page, ok=i % 2 == 0)
                look(f"{st['k']} contestada")
                if st["type"] not in ("explain", "flip"):
                    _go_on(page)
                _wait_next(page, st["k"])
            look(f"{lid} final", 4)
        TC.goto(page, "#/techl/review")
        page.wait_for_function("() => { const r = vocabTech.lesson.running; return r && r.kind === 'review' && r.step; }", timeout=4000)
        assert _step(page)["type"] == "flip", _step(page)
        _go_on(page)
        page.wait_for_selector("#tp-lyes", timeout=3000)
        look("tarjeta girada")
        _nav_stop(page, "#/techl/lesson/u01-l3")   # (el repaso ya empezado pregunta «Stop here?»)
        _skip_to(page, "u01-l3-i4")
        page.locator("#tp-lstage .tp-lta").fill("Half an answer")
        page.locator("#fx-x").click()
        look("Stop here?")
        page.locator("#tp-stop-out").click()
        page.wait_for_function("() => !location.hash.startsWith('#/techl')", timeout=4000)
        TC.goto(page, "#/techmock")
        page.evaluate("""() => vocabTech.put('mock', 'mrm', {when: Date.now() - 864e5, n: 1, grades: {'u01-l3-i4': 'partly'}, secs: {'u01-l3-i4': 60},
          items: ['u01-l3-i4'], len: 15, scope: 'studied', total: 60})""")
        TC.goto(page, "#/techpath")
        TC.goto(page, "#/techmock")
        page.locator("#tp-mk [data-mk]").first.tap()
        look("hoja de la entrevista")
        probs += page.evaluate("() => window.__long")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs[:30])


# ---------------------------------------------------------------- la medalla al terminar un bloque
def test_lesson_done_with_medal_toast():
    """Terminar la última lección de un bloque (Integration: unidades 1-6): vocabTech.progress.lessonDone da la medalla,
    sale el aviso «Medal earned: Integration!» y el final de la lección lo dice; sin monedas ni nada del niño. Volver a
    hacer la lección no la da otra vez."""
    blk = [u["id"] for u in TC.index()["units"] if u.get("block") == "integration" and u["available"]]
    last = TC.lessons(blk[-1])[-1][1]["id"]
    done = {k: v for k, v in _studied(blk).items() if k != f"ls/{last}"}
    page = _open(f"#/techl/lesson/{last}", data=TC.data(done))
    try:
        before = TC.kid_snapshot(page)
        TC.bus_log(page)
        _walk(page, text="A short answer.")
        page.wait_for_selector("#tp-lend", timeout=4000)
        page.wait_for_function("() => [...document.querySelectorAll('#m-toasts .m-toast')].some(t => t.textContent.includes('Medal earned'))", timeout=4000)
        toast = page.evaluate("() => [...document.querySelectorAll('#m-toasts .m-toast')].map(t => t.textContent.trim())")
        assert any("Medal earned: Integration!" in t for t in toast), toast
        assert page.inner_text("#tp-lend .tp-lmedal") == "Medal earned: Integration", page.inner_text("#tp-lend")
        assert "success" in _spy(page)["hap"], _spy(page)
        assert TC.recs(page, "ls").get(f"ls/{last}"), TC.recs(page, "ls")
        TC.shot(page, "leccion-final-medalla", full_page=False)
        assert not TC.kid_changes(page, before), TC.kid_changes(page, before)
        assert TC.bus_seen(page) == [], TC.bus_seen(page)
        # otra vez: sin medalla nueva
        page.locator("#tp-lpath").tap()
        page.wait_for_function("() => location.hash === '#/techpath'", timeout=4000)
        TC.goto(page, f"#/techl/lesson/{last}")
        _walk(page, text="A short answer.")
        page.wait_for_selector("#tp-lend", timeout=4000)
        assert page.locator("#tp-lend .tp-lmedal").count() == 0
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
