"""F3a (plan-doc §Lección): la lección del camino en js/lesson.js y su final.

Acertar pasa sola al acabar el audio (nunca antes de 0,9 s); fallar deja la elegida en gris con ✗ y la buena en verde
con ✓, sin temblor, sin vibración y sin sonido triste, y el botón dice «Seguir». Deslizar la tarjeta de palabra nueva
es lo mismo que «Continuar». Lo hecho se guarda en sessionStorage 'vocab:ls' y se recupera al recargar; Atrás del
navegador a mitad pregunta «¿Paramos aquí?» (guarda de salida de route()) y «Salir» lo deja para seguir luego con la
cápsula «Seguir» (plan-doc §Lección); terminarla lo borra. El final: estrellas de una
en una, monedas una sola vez, «Mañana repasas N palabras», confeti, «Siguiente lección» y «Repetir». El camino y el
repaso se guardan igual que en la versión anterior (BASE_REV) para la misma secuencia de respuestas."""
from __future__ import annotations

import json
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path

import common as C
import routes as R

LESSON = R.LESSON                 # A1-010 en la partida sembrada (8 palabras)
GRAM = R.GRAM_LESSON              # G-A1-02
BASE_REV = "3396fc7"              # la versión de antes de F3 (lección en index.html)

# estado de la lección en marcha (vocabulario o gramática)
_ST = """() => { const s = window.vocabLesson && vocabLesson.state; if (!s) return null; const st = s.steps[s.i];
  return {id: s.id, i: s.i, n: s.steps.length, ended: s.ended, saved: s.saved, t: st ? st.t : null, done: !!(st && st.done),
    right: st ? (st.right != null ? st.right : (st.q ? st.q.o[st.q.a] : null)) : null}; }"""
_OPTS = """() => [...document.querySelectorAll('.ls-stage > .ls-page:not(.ls-ghost) .ls-opt .ls-ot')].map(e => e.textContent)"""
_SAVED = "() => JSON.parse(sessionStorage.getItem('vocab:ls'))"
_CHANGED = "i0 => { const s = window.vocabLesson && vocabLesson.state; return !s || s.ended || s.i !== i0; }"
# espías: cambios de paso, respuestas, audio, monedas, sonidos, vibración, temblor, confeti y notas
_HOOK = """() => {
  if (window.__t) return;
  const T = window.__t = {chg: [], ans: [], audio: [], aw: [], snd: [], hap: [], nope: 0, conf: 0, done: 0, notes: [], starOn: []};
  let last = null;
  setInterval(() => { const s = window.vocabLesson && vocabLesson.state, i = s ? (s.ended ? 'end' : s.i) : null;
    if (i !== last) { last = i; T.chg.push({i, t: performance.now()}); } }, 8);
  bus.on('answer', d => T.ans.push({ok: !!d.ok, t: performance.now()}));
  bus.on('lesson-done', d => { T.done++; T.stars = d.stars; });
  const A = window.award; window.award = function (...a) { T.aw.push({n: a[0], from: a[3] && a[3].id || null}); return A.apply(this, a); };
  const P = sfx.play; sfx.play = function (n, ...r) { T.snd.push(n); return P.call(this, n, ...r); };
  const N0 = sfx.note; if (typeof N0 === 'function') sfx.note = function (i, ...r) { T.notes.push(i); return N0.call(this, i, ...r); };
  const H = G.haptic; G.haptic = function (k, ...r) { T.hap.push(k); return H.call(this, k, ...r); };
  const NO = M.nope; M.nope = function (...a) { T.nope++; return NO.apply(this, a); };
  const CF = M.confetti; M.confetti = function (...a) { T.conf++; return CF.apply(this, a); };
  new MutationObserver(ms => { for (const m of ms) { const el = m.target;
    if (el.classList && el.classList.contains('ls-star') && el.classList.contains('on') && !el.__on) { el.__on = 1; T.starOn.push(performance.now()); } } })
    .observe(document.body, {subtree: true, attributes: true, attributeFilter: ['class']});
}"""
# audio de mentira que dura window.__audioD ms (el de verdad está mudo en las pruebas)
_FAKE_AUDIO = """() => { window.__audioD = 600;
  window.sayP = (t, b) => new Promise(r => { const a = {t, s: performance.now()}; __t.audio.push(a);
    setTimeout(() => { a.e = performance.now(); r(); }, window.__audioD); }); }"""


def _open(page, hash_=LESSON, via="#/mapa"):
    C.seed(page)
    if via:
        C.goto(page, via)
    C.goto(page, "#/leccion/" + hash_)
    page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-page')", timeout=8000)


def _wait_change(page, i0, timeout=8000):
    page.wait_for_function(_CHANGED, arg=i0, timeout=timeout)


def _go(page):
    """Toca el botón de abajo y espera al paso siguiente."""
    st = page.evaluate(_ST)
    page.locator("#ls-go").click()
    _wait_change(page, st["i"])
    page.wait_for_timeout(240)


def _pick(page, text):
    opts = page.evaluate(_OPTS)
    page.locator(".ls-stage > .ls-page:not(.ls-ghost) .ls-opt").nth(opts.index(text)).click()


def _wrong(page, right):
    return next(o for o in page.evaluate(_OPTS) if o != right)


def _play(page, miss=(), auto=True, max_steps=80):
    """Juega la lección abierta hasta el final: las palabras nuevas con «Continuar» (la teoría con «Practicar») y las
    preguntas bien, salvo las de miss (0 = la primera pregunta), que se fallan y siguen con «Seguir». Devuelve cuántas
    preguntas contestó."""
    q = 0
    for _ in range(max_steps):
        st = page.evaluate(_ST)
        if not st or st["ended"]:
            return q
        if st["t"] in (None, "learn"):
            _go(page)
            continue
        if q in miss:
            _pick(page, _wrong(page, st["right"]))
            page.wait_for_function("() => { const g = document.getElementById('ls-go'); return g && !g.hidden; }", timeout=3000)
            _go(page)
        else:
            _pick(page, st["right"])
            if auto:
                _wait_change(page, st["i"], 9000)
                page.wait_for_timeout(240)
            else:
                _go(page)
        q += 1
    raise AssertionError(f"la lección no termina en {max_steps} pasos: {page.evaluate(_ST)}")


# ---------------------------------------------------------------- acertar todo: pasa sola y termina una vez
def test_right_answers_advance_alone_and_lesson_ends_once():
    """Toda la lección bien: cada acierto pasa solo ≤ 1,2 s después de acabar el audio y nunca antes de 0,9 s (audio de
    0 y de 1 s), con ✓ verde, sonido «ok» y vibración de éxito. Racha: chip con la llama a los 3 seguidos. Al final, 3
    estrellas de una en una (≈150 ms, notas que suben), «+25» y las monedas sumadas una sola vez, «Mañana repasas N
    palabras» con la cuenta real, confeti una vez (solo aquí), «Siguiente lección» y «Repetir»; 'vocab:ls' borrado."""
    page = C.new_page("phone")
    probs = []
    try:
        _open(page)
        page.evaluate(_HOOK)
        page.evaluate(_FAKE_AUDIO)
        coins0 = page.evaluate("game().coins")
        q = 0
        streak_seen = {}
        for _ in range(60):
            st = page.evaluate(_ST)
            if st["ended"]:
                break
            if st["t"] == "learn":
                _go(page)
                continue
            d = 0 if q % 2 else 1000
            page.evaluate("d => { window.__audioD = d; }", d)
            n_ans, n_aud = page.evaluate("[__t.ans.length, __t.audio.length]")
            _pick(page, st["right"])
            page.wait_for_timeout(120)
            look = page.evaluate("""() => { const p = document.querySelector('.ls-stage > .ls-page:not(.ls-ghost)'), ok = p.querySelector('.ls-opt.is-ok');
              const k = p.querySelector('.ls-streak b');
              return {ok: !!ok && !!ok.querySelector('svg.chk'), miss: !!p.querySelector('.is-miss'), streak: k ? +k.textContent : 0}; }""")
            if not look["ok"] or look["miss"]:
                probs.append(f"pregunta {q}: al acertar {look}")
            streak_seen[q + 1] = look["streak"]
            _wait_change(page, st["i"], 9000)
            t = page.evaluate("""([na, nu, i0]) => { const a = __t.ans[na], au = __t.audio.slice(nu).find(x => x.s >= a.t),
              c = __t.chg.find(x => x.t > a.t && x.i !== i0); return {a: a.t, s: au && au.s, e: au && au.e, c: c && c.t}; }""", [n_ans, n_aud, st["i"]])
            if t["e"] is None or t["c"] is None:
                probs.append(f"pregunta {q}: sin audio o sin cambio de paso {t}")
            else:
                if t["c"] - t["a"] < 880:
                    probs.append(f"pregunta {q} (audio {d} ms): pasó a los {t['c'] - t['a']:.0f} ms de contestar (< 0,9 s)")
                if t["c"] - t["e"] > 1200:
                    probs.append(f"pregunta {q} (audio {d} ms): pasó {t['c'] - t['e']:.0f} ms después del audio (> 1,2 s)")
                if t["c"] < t["e"] - 5:
                    probs.append(f"pregunta {q} (audio {d} ms): pasó antes de acabar el audio")
            page.wait_for_timeout(240)
            q += 1
        if q != 8:
            probs.append(f"se contestaron {q} preguntas (se esperaban 8)")
        if streak_seen.get(2) or streak_seen.get(3) != 3 or streak_seen.get(5) != 5:
            probs.append(f"chip de racha por acierto: {streak_seen}")
        page.wait_for_selector(".ls-end", timeout=5000)
        page.wait_for_timeout(3200)            # estrellas y monedas en vuelo
        T = page.evaluate("__t")
        end = page.evaluate("""() => ({t: document.querySelector('.ls-end-t').textContent, plus: document.getElementById('ls-plus').textContent.trim(),
          tmr: document.querySelector('.ls-tmr').textContent, next: document.getElementById('ls-next') && document.getElementById('ls-next').textContent.trim(),
          nextCls: document.getElementById('ls-next') && document.getElementById('ls-next').className, rep: document.getElementById('ls-rep').textContent.trim(),
          repPri: document.getElementById('ls-rep').classList.contains('glass-btn--pri'), stars: document.querySelectorAll('.ls-star.got.on').length,
          fox: !!document.querySelector('.ls-fox .hero'), x: document.getElementById('fx-x').getAttribute('href'),
          old: /Volver al mapa|Acertaste a la primera/.test(document.getElementById('app').textContent),
          due1: Object.values(srsAll()).filter(x => x && x.due === today() + 1).length, saved: sessionStorage.getItem('vocab:ls'),
          coins: game().coins})""")
        if end["t"] != "¡Lección completada!" or end["plus"] != "+25" or end["stars"] != 3 or not end["fox"]:
            probs.append(f"final: {end}")
        if end["tmr"] != f"Mañana repasas {end['due1']} palabras":
            probs.append(f"«Mañana repasas…»: {end['tmr']!r} (vencen mañana {end['due1']})")
        if end["next"] != "Siguiente lección" or "glass-btn--pri" not in (end["nextCls"] or "") or end["rep"] != "Repetir" or end["repPri"]:
            probs.append(f"botones del final: {end}")
        if end["old"]:
            probs.append("el final aún tiene «Volver al mapa» o la frase larga")
        if end["x"] != "#/mapa/A1":
            probs.append(f"la ✕ del final lleva a {end['x']}")
        if end["saved"] is not None:
            probs.append(f"al terminar sigue 'vocab:ls': {end['saved']}")
        mine = [a for a in T["aw"] if a["from"] == "ls-plus"]
        if len(mine) != 1 or mine[0]["n"] != 25 or end["coins"] - coins0 != 25:
            probs.append(f"monedas: award {T['aw']}, {coins0} → {end['coins']}")
        if T["done"] != 1 or T.get("stars") != 3 or T["conf"] != 1:
            probs.append(f"lesson-done {T['done']} (estrellas {T.get('stars')}), confeti {T['conf']}")
        on = T["starOn"]
        gaps = [round(b - a) for a, b in zip(on, on[1:])]
        if len(on) != 3 or any(not 100 <= g <= 230 for g in gaps):
            probs.append(f"las estrellas no salen de una en una cada ≈150 ms: {gaps}")
        if T["notes"][:3] != sorted(T["notes"][:3]) or len(set(T["notes"][:3])) != 3:
            probs.append(f"las notas de las estrellas no suben: {T['notes'][:6]}")
        if T["snd"].count("ok") != 8 or "bad" in T["snd"]:
            probs.append(f"sonidos: {T['snd']}")
        if T["hap"].count("success") != 8:
            probs.append(f"vibraciones de éxito: {T['hap']}")
        if T["nope"]:
            probs.append(f"M.nope se llamó {T['nope']} veces")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- fallar: gris, verde y «Seguir»
def test_miss_is_gray_green_and_quiet():
    """Fallar: la elegida en gris con ✗, la buena en verde con ✓ (y suena la palabra), sin temblor (ni clase ni M.nope),
    sin vibración y sin el sonido 'bad'; el botón pasa a «Seguir» y no avanza solo. «Seguir» va al paso siguiente y la
    fallada vuelve a salir más tarde."""
    for scheme in ("light", "dark"):
        page = C.new_page("phone", color_scheme=scheme)
        probs = []
        try:
            _open(page)
            page.evaluate(_HOOK)
            while page.evaluate(_ST)["t"] == "learn":
                _go(page)
            st = page.evaluate(_ST)
            bad = _wrong(page, st["right"])
            said0 = page.evaluate("__t.snd.length")
            _pick(page, bad)
            page.wait_for_timeout(1800)          # más que lo que tardaría en pasar sola
            look = page.evaluate("""([bad, right]) => { const p = document.querySelector('.ls-stage > .ls-page:not(.ls-ghost)'), os = [...p.querySelectorAll('.ls-opt')];
              const by = t => os.find(o => o.querySelector('.ls-ot').textContent === t), b = by(bad), r = by(right), g = document.getElementById('ls-go');
              const cs = el => getComputedStyle(el), lum = c => { const m = c.match(/[\\d.]+/g).map(Number); return [m[0], m[1], m[2]]; };
              return {bMiss: b.classList.contains('is-miss'), bX: !!b.querySelector('svg.xm'), bBg: lum(cs(b).backgroundColor),
                rOk: r.classList.contains('is-ok'), rChk: !!r.querySelector('svg.chk'), rBg: lum(cs(r).backgroundColor),
                others: os.filter(o => o !== b && o !== r).every(o => o.classList.contains('is-dim')), disabled: os.every(o => o.disabled),
                shake: !!document.querySelector('.shake, .nope, .m-nope, .is-shake'), go: g && !g.hidden ? g.textContent.trim() : null,
                fb: p.querySelector('.ls-fb').textContent.trim()}; }""", [bad, st["right"]])
            T = page.evaluate("__t")
            if not (look["bMiss"] and look["bX"] and look["rOk"] and look["rChk"] and look["others"] and look["disabled"]):
                probs.append(f"{scheme}: al fallar {look}")
            r, g, b = look["bBg"]
            if max(r, g, b) - min(r, g, b) > 24:
                probs.append(f"{scheme}: la elegida no es gris: rgb{tuple(look['bBg'])}")
            r, g, b = look["rBg"]
            if not (g > r + 40 and g > b + 20):
                probs.append(f"{scheme}: la buena no es verde: rgb{tuple(look['rBg'])}")
            if look["shake"] or T["nope"]:
                probs.append(f"{scheme}: hay temblor (clase {look['shake']}, M.nope {T['nope']})")
            if T["hap"]:
                probs.append(f"{scheme}: vibra al fallar: {T['hap']}")
            if "bad" in T["snd"][said0:]:
                probs.append(f"{scheme}: suena 'bad' al fallar: {T['snd']}")
            if look["go"] != "Seguir":
                probs.append(f"{scheme}: el botón dice {look['go']!r}")
            if not look["fb"].startswith("¡Casi! Es «") or st["right"] not in look["fb"]:
                probs.append(f"{scheme}: el aviso dice {look['fb']!r}")
            st2 = page.evaluate(_ST)
            if st2["i"] != st["i"]:
                probs.append(f"{scheme}: al fallar pasó solo al paso {st2['i']}")
            sv = page.evaluate(_SAVED)
            if not sv or sv.get("miss") != [page.evaluate("() => { const s = vocabLesson.state; return s.steps[s.i].w.r.es; }")]:
                probs.append(f"{scheme}: 'vocab:ls' tras fallar: {sv}")
            _go(page)
            st3 = page.evaluate(_ST)
            if st3["i"] != st["i"] + 1 or st3["n"] != st["n"] + 1:
                probs.append(f"{scheme}: «Seguir» → paso {st3['i']} de {st3['n']} (antes {st['i']} de {st['n']})")
            probs += [f"{scheme}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
        assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- deslizar = Continuar
def test_swipe_on_new_word_equals_continue():
    """Un deslizamiento a la izquierda con PointerEvents sintéticos en la tarjeta de palabra nueva hace lo mismo que
    «Continuar» (paso y 'vocab:ls'); a la derecha vuelve a la anterior. Un toque corto no pasa. La pista «Desliza para
    seguir» sale en la segunda tarjeta y nunca en la primera."""
    page = C.new_page("phone")
    probs = []
    swipe = """dx => { const c = document.querySelector('.ls-stage > .ls-page:not(.ls-ghost) .ls-learn'), r = c.getBoundingClientRect();
      const x0 = r.left + r.width / 2, y0 = r.top + r.height * .55;
      const ev = (type, x, t) => (type === 'pointerdown' ? c : document).dispatchEvent(new PointerEvent(type, {pointerId: 7, pointerType: 'touch',
        isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y0, button: 0, buttons: type === 'pointerup' ? 0 : 1}));
      ev('pointerdown', x0); const n = 8; for (let k = 1; k <= n; k++) ev('pointermove', x0 + dx * k / n); ev('pointerup', x0 + dx); }"""
    try:
        _open(page)
        page.wait_for_timeout(2200)
        if page.evaluate("!!document.querySelector('.g-hint')"):
            probs.append("la pista de deslizar sale en la primera tarjeta")
        st0 = page.evaluate(_ST)
        page.evaluate(swipe, 6)                       # casi nada: no pasa
        page.wait_for_timeout(400)
        if page.evaluate(_ST)["i"] != st0["i"]:
            probs.append("un toque corto pasa de tarjeta")
        page.evaluate(swipe, -150)
        _wait_change(page, st0["i"], 3000)
        page.wait_for_timeout(300)
        st1, sv1 = page.evaluate(_ST), page.evaluate(_SAVED)
        if st1["i"] != 1 or st1["t"] != "learn" or not sv1 or sv1["i"] != 1:
            probs.append(f"deslizar a la izquierda: paso {st1}, guardado {sv1}")
        page.wait_for_timeout(1700)
        hint = page.evaluate("() => { const h = document.querySelector('.g-hint'); return h ? h.textContent.trim() : null; }")
        if hint != "Desliza para seguir":
            probs.append(f"en la segunda tarjeta la pista es {hint!r}")
        page.evaluate(swipe, 150)
        _wait_change(page, 1, 3000)
        page.wait_for_timeout(300)
        if page.evaluate(_ST)["i"] != 0:
            probs.append(f"deslizar a la derecha: paso {page.evaluate(_ST)}")
        # lo mismo con «Continuar»: el mismo paso y lo mismo guardado
        _go(page)
        st2, sv2 = page.evaluate(_ST), page.evaluate(_SAVED)
        if st2["i"] != st1["i"] or sv2 != sv1:
            probs.append(f"«Continuar» no hace lo mismo que deslizar: {st2}/{sv2} frente a {st1}/{sv1}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- recargar, Atrás y «Salir»
def test_reload_resumes_and_back_asks():
    """Recargar a mitad sigue donde estaba (mismo paso, lo hecho y lo fallado). Atrás del navegador a mitad saca
    «¿Paramos aquí?» sin salir de la lección; «Seguir» no pierde nada. Con la hoja abierta, un acierto no pasa solo
    hasta cerrarla. «Salir» desde Atrás deja ir adonde iba con lo hecho en 'vocab:ls' (para la cápsula «Seguir»)."""
    page = C.new_page("phone")
    probs = []
    try:
        _open(page)
        while page.evaluate(_ST)["t"] == "learn":
            _go(page)
        st = page.evaluate(_ST)
        _pick(page, _wrong(page, st["right"]))
        page.wait_for_timeout(300)
        _go(page)
        st = page.evaluate(_ST)
        _pick(page, st["right"])
        _wait_change(page, st["i"], 9000)
        page.wait_for_timeout(300)
        before, sv = page.evaluate(_ST), page.evaluate(_SAVED)
        C.reload(page)
        page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-page')", timeout=8000)
        after = page.evaluate(_ST)
        if (after["i"], after["n"]) != (before["i"], before["n"]) or page.evaluate(_SAVED) != sv:
            probs.append(f"tras recargar: {after} (antes {before}), guardado {page.evaluate(_SAVED)} (antes {sv})")
        if page.evaluate("[...vocabLesson.state.first].length") != 1 or page.evaluate("[...vocabLesson.state.miss].length") != 1:
            probs.append("tras recargar se pierden los aciertos o los fallos")
        # Atrás: la hoja, y Seguir no pierde nada
        st = page.evaluate(_ST)
        page.go_back()
        page.wait_for_selector("dialog#ls-pause[open]", timeout=4000)
        sheet = page.evaluate("""() => { const d = document.getElementById('ls-pause'), go = d.querySelector('#ls-pz-go'), out = d.querySelector('#ls-pz-out');
          return {t: d.querySelector('h2').textContent, go: go.textContent.trim(), pri: go.classList.contains('glass-btn--pri'), out: out.textContent.trim(),
            outPri: out.classList.contains('glass-btn--pri'), hash: location.hash}; }""")
        if sheet["t"] != "¿Paramos aquí?" or sheet["go"] != "Seguir" or not sheet["pri"] or sheet["out"] != "Salir" or sheet["outPri"]:
            probs.append(f"la hoja de Atrás: {sheet}")
        if sheet["hash"] != "#/leccion/" + LESSON:
            probs.append(f"con la hoja abierta el hash es {sheet['hash']}")
        if page.evaluate(_ST)["i"] != st["i"]:
            probs.append("Atrás cambió de paso")
        page.locator("#ls-pz-go").click()
        page.wait_for_function("() => !document.getElementById('ls-pause').open", timeout=3000)
        page.wait_for_timeout(300)
        if page.evaluate(_ST)["i"] != st["i"] or page.evaluate(_SAVED) != sv or C.current_hash(page) != "leccion/" + LESSON:
            probs.append(f"«Seguir» perdió algo: {page.evaluate(_ST)}, {page.evaluate(_SAVED)}, #/{C.current_hash(page)}")
        # un acierto con la hoja abierta espera a que se cierre
        st = page.evaluate(_ST)
        _pick(page, st["right"])
        page.wait_for_timeout(150)
        page.keyboard.press("Escape")
        page.wait_for_selector("dialog#ls-pause[open]", timeout=3000)
        page.wait_for_timeout(2600)
        if page.evaluate(_ST)["i"] != st["i"]:
            probs.append("con «¿Paramos aquí?» abierta pasó de tarjeta")
        page.locator("#ls-pz-go").click()
        _wait_change(page, st["i"], 4000)
        page.wait_for_timeout(300)
        # Atrás y «Salir»: va adonde iba (el camino) y lo hecho se queda para seguir luego
        sv = page.evaluate(_SAVED)
        page.go_back()
        page.wait_for_selector("dialog#ls-pause[open]", timeout=4000)
        page.locator("#ls-pz-out").click()
        page.wait_for_function("() => location.hash.startsWith('#/mapa') && !document.documentElement.dataset.focus", timeout=6000)
        C.settle(page, 300)
        if page.evaluate(_SAVED) != sv or page.evaluate("!!(window.vocabLesson && vocabLesson.state)"):
            probs.append(f"«Salir» no deja lo hecho en 'vocab:ls' ({page.evaluate(_SAVED)}, antes {sv}) o la lección sigue en marcha")
        if page.evaluate("!!document.querySelector('dialog[open]')"):
            probs.append("tras «Salir» queda una hoja abierta")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_x_and_esc_ask_and_salir_goes_back():
    """La ✕ con algo hecho abre «¿Paramos aquí?» (en la primera tarjeta, sin nada hecho, sale sin preguntar); «Salir»
    vuelve a donde estaba el niño (el camino) con lo hecho en 'vocab:ls' y la cápsula «Seguir · Lección N» a la vista. En
    el escritorio Esc hace lo mismo que la ✕. La partida exportada no cambia por empezar y dejar una lección."""
    probs = []
    for kind in ("phone", "desk"):
        page = C.new_page(kind)
        try:
            _open(page)
            base = C.export(page)
            # sin nada hecho: la ✕ sale directamente
            page.locator("#fx-x").click()
            page.wait_for_function("() => location.hash.startsWith('#/mapa') && !document.documentElement.dataset.focus", timeout=6000)
            if page.evaluate("!!document.querySelector('dialog#ls-pause[open]')"):
                probs.append(f"{kind}: la ✕ pregunta sin nada hecho")
            C.goto(page, "#/leccion/" + LESSON)
            page.wait_for_function("() => window.vocabLesson && vocabLesson.state", timeout=8000)
            _go(page)
            _go(page)
            if kind == "desk":
                page.keyboard.press("Escape")
            else:
                page.locator("#fx-x").click()
            page.wait_for_selector("dialog#ls-pause[open]", timeout=4000)
            sub = page.evaluate("document.querySelector('#ls-pause .ls-pz-s').textContent")
            if not sub.startswith("Te quedan "):
                probs.append(f"{kind}: el subtítulo de la hoja es {sub!r}")
            if kind == "desk":                         # Esc con la hoja abierta la cierra (Seguir)
                page.keyboard.press("Escape")
                page.wait_for_function("() => !document.getElementById('ls-pause').open", timeout=3000)
                if C.current_hash(page) != "leccion/" + LESSON or page.evaluate(_ST)["i"] != 2:
                    probs.append(f"{kind}: Esc en la hoja no vuelve a la lección: #/{C.current_hash(page)} {page.evaluate(_ST)}")
                page.keyboard.press("Escape")
                page.wait_for_selector("dialog#ls-pause[open]", timeout=4000)
            page.locator("#ls-pz-out").click()
            page.wait_for_function("() => location.hash.startsWith('#/mapa') && !document.documentElement.dataset.focus", timeout=6000)
            C.settle(page, 300)
            sv = page.evaluate(_SAVED)
            if not sv or sv.get("id") != LESSON or sv.get("i") != 2:
                probs.append(f"{kind}: «Salir» no deja lo hecho en 'vocab:ls': {sv}")
            acc = page.evaluate("() => { const a = document.getElementById('acc'); return a && !a.hidden && a.getClientRects().length ? a.textContent.replace(/\\s+/g, ' ').trim() : null; }")
            if not acc or not acc.startswith("Seguir · Lección"):
                probs.append(f"{kind}: tras «Salir» no sale la cápsula «Seguir · Lección N»: {acc}")
            if C.current_hash(page) != "mapa":
                probs.append(f"{kind}: «Salir» deja en #/{C.current_hash(page)}")
            d = C.diff_exports(base, C.export(page), allow_new=False)
            if d:
                probs.append(f"{kind}: la partida cambió al empezar y dejar la lección:\n  " + "\n  ".join(d))
            probs += [f"{kind}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- el accesorio «Seguir»
def test_accessory_outside_when_started():
    """Una lección empezada y dejada a medias (la app se cierra y se vuelve a abrir en la misma sesión) saca fuera de
    ella la cápsula «Seguir · Lección N»; al tocarla sigue en el mismo paso. Al terminarla, la cápsula se va."""
    page = C.new_page("phone")
    probs = []
    acc = """() => { const a = document.getElementById('acc'); return a && !a.hidden && a.getClientRects().length ? {t: a.textContent.replace(/\\s+/g, ' ').trim(), href: a.getAttribute('href')} : null; }"""
    try:
        _open(page)
        n_label = page.evaluate("async id => { await getMap(); return lvLessons(id.slice(0, 2)).findIndex(l => l.id === id) + 1; }", LESSON)
        if page.evaluate(acc):
            probs.append("en la lección se ve el accesorio")
        _go(page)
        _go(page)
        _go(page)
        sv = page.evaluate(_SAVED)
        page.goto(C.base_url(page) + "/__blank", wait_until="domcontentloaded")
        C.goto(page, "#/palabras")
        a = page.evaluate(acc)
        if not a or a["href"] != "#/leccion/" + LESSON or not a["t"].startswith("Seguir · Lección"):
            probs.append(f"fuera de la lección el accesorio es {a}")
        elif a["t"] != f"Seguir · Lección {n_label}":
            probs.append(f"el accesorio dice {a['t']!r} (se esperaba Lección {n_label})")
        n0 = page.evaluate("window.__vocabRouteN || 0")
        page.locator("#acc").click()
        page.wait_for_function("n => (window.__vocabRouteN || 0) > n", arg=n0, timeout=8000)
        page.wait_for_function("() => window.vocabLesson && vocabLesson.state && document.querySelector('.ls-stage .ls-page')", timeout=8000)
        if page.evaluate(_ST)["i"] != sv["i"]:
            probs.append(f"el accesorio no sigue en el mismo paso: {page.evaluate(_ST)} (guardado {sv})")
        _play(page, auto=False)
        C.goto(page, "#/palabras")
        if page.evaluate(acc):
            probs.append(f"terminada la lección sigue el accesorio: {page.evaluate(acc)}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- lo guardado, igual que antes
def _play_base(page, miss=()):
    """La misma secuencia en la versión anterior (lección en index.html: LS global, .opt[data-o] y #ls-go)."""
    q = 0
    for _ in range(80):
        st = page.evaluate("""() => { if (document.querySelector('.ls-end')) return {end: true}; const st = LS.steps[LS.i];
          return st ? {i: LS.i, t: st.t, right: st.right || null, done: !!st.done} : {end: true}; }""")
        if st.get("end"):
            return q
        if st["t"] == "learn":
            page.locator("#ls-go").click()
        else:
            opts = page.evaluate("() => [...document.querySelectorAll('.ls-card .opt')].map(o => o.dataset.o)")
            pick = next(o for o in opts if o != st["right"]) if q in miss else st["right"]
            page.locator(".ls-card .opt").nth(opts.index(pick)).click()
            page.locator("#ls-go").click()
            q += 1
        page.wait_for_function("i0 => !!document.querySelector('.ls-end') || LS.i !== i0", arg=st["i"], timeout=5000)
    raise AssertionError("la lección de la versión anterior no termina")


def _base_tree():
    """Copia de BASE_REV en una carpeta temporal (None si no hay git o no está ese commit)."""
    try:
        subprocess.run(["git", "-C", str(C.REPO), "cat-file", "-e", BASE_REV + "^{commit}"], check=True, capture_output=True, timeout=20)
        tmp = Path(tempfile.mkdtemp(prefix="vocab-base-"))
        arc = subprocess.run(["git", "-C", str(C.REPO), "archive", "--format=tar", BASE_REV], check=True, capture_output=True, timeout=120).stdout
        tar = tmp / "base.tar"
        tar.write_bytes(arc)
        with tarfile.open(tar) as t:
            t.extractall(tmp / "web", filter="data")
        tar.unlink()
        return tmp
    except Exception:
        return None


_KEYS = ("map:english", "srs:english", "act")


def test_progress_saved_like_before():
    """Para la misma secuencia (todo bien, y fallando la primera pregunta) el camino (map:<idioma>), el repaso
    (srs:<idioma>), la actividad y las monedas quedan exactamente igual que con la versión anterior (BASE_REV); y, sin
    ella, como dicta el formato: la lección con sus estrellas y cada palabra en la caja 1 para mañana."""
    probs = []
    tmp = _base_tree()
    try:
        for miss, stars, coins in (((), 3, 25), ((0,), 2, 20)):
            label = "todo bien" if not miss else "fallando la primera"
            res = {}
            for impl in ("new", "base") if tmp else ("new",):
                page = C.new_page("phone", root=(tmp / "web") if impl == "base" else None)
                try:
                    C.seed(page)
                    before = C.export(page)
                    C.goto(page, "#/mapa")
                    C.goto(page, "#/leccion/" + LESSON)
                    if impl == "new":
                        page.wait_for_function("() => window.vocabLesson && vocabLesson.state", timeout=8000)
                        _play(page, miss=miss, auto=False)
                    else:
                        page.wait_for_function("() => typeof LS !== 'undefined' && LS && LS.steps", timeout=8000)
                        _play_base(page, miss=miss)
                    page.wait_for_timeout(2800)
                    after = C.export(page)
                    words = page.evaluate("""async id => { await getMap(); const lv = id.slice(0, 2), l = MAP[lv].flatMap(u => u.ls).find(l => l.id === id);
                      const out = []; for (const [d, i] of l.w) { const doc = await getDoc(d), r = doc.rows[i]; if (r && r.l && r.l[lang]) out.push(srsK(d, r)); } return {keys: out, t: today()}; }""", LESSON)
                    res[impl] = {"before": before, "after": after, "words": words}
                    if impl == "new":
                        probs += [f"{label}: {e}" for e in C.errors(page)]
                finally:
                    page.context.close()
            new = res["new"]
            kb, ka = new["before"]["keys"], new["after"]["keys"]
            mb, ma = json.loads(kb["map:english"]), json.loads(ka["map:english"])
            exp_map = dict(mb, **{LESSON: max(mb.get(LESSON, 0), stars)})
            if ma != exp_map:
                probs.append(f"{label}: map:english {ma} (se esperaba {exp_map})")
            sb, sa = json.loads(kb["srs:english"]), json.loads(ka["srs:english"])
            t1 = new["words"]["t"] + 1
            for k in new["words"]["keys"]:
                x = sa.get(k)
                if k not in sb:
                    if not x or x.get("b") != 1 or x.get("due") != t1 or x.get("n") != 0 or set(x) != {"d", "e", "b", "due", "n"}:
                        probs.append(f"{label}: srs {k} = {x}")
                elif sb[k].get("b", 0) < 1 and (x.get("b") != 1 or x.get("due") != t1):
                    probs.append(f"{label}: srs {k} {sb[k]} → {x}")
            others = {k: v for k, v in sa.items() if k not in new["words"]["keys"]}
            if others != {k: v for k, v in sb.items() if k not in new["words"]["keys"]}:
                probs.append(f"{label}: cambian otras palabras del repaso")
            gb, ga = json.loads(kb["game"]), json.loads(ka["game"])
            if ga["coins"] - gb["coins"] != coins:
                probs.append(f"{label}: monedas {gb['coins']} → {ga['coins']} (se esperaban +{coins})")
            if "base" in res:
                old = res["base"]["after"]["keys"]
                for k in _KEYS:
                    if old.get(k) != ka.get(k):
                        probs.append(f"{label}: {k} distinto de la versión anterior:\n    antes {C._short(old.get(k), 400)}\n    ahora {C._short(ka.get(k), 400)}")
                go, gn = json.loads(old["game"]), ga
                if (go["coins"], go["earned"]) != (gn["coins"], gn["earned"]):
                    probs.append(f"{label}: monedas {go['coins']}/{go['earned']} antes, {gn['coins']}/{gn['earned']} ahora")
            elif tmp is None and miss == ():
                print(f"  (sin {BASE_REV}: solo se comprueba el formato)")
    finally:
        if tmp:
            shutil.rmtree(tmp, ignore_errors=True)
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- gramática
def test_grammar_lesson_same_style():
    """La práctica de gramática (#/leccion/G-…) va igual: la regla con «Practicar», frases con hueco y opciones
    sólidas, acertar pasa sola, fallar enseña la buena y el porqué, y termina con estrellas, monedas y 'vocab:ls'
    borrado."""
    page = C.new_page("phone", color_scheme="dark")
    probs = []
    try:
        _open(page, GRAM)
        page.wait_for_timeout(300)
        th = page.evaluate("""() => ({t: !!document.querySelector('.ls-theory .ls-gt'), go: document.getElementById('ls-go').textContent.trim(),
          rules: document.querySelectorAll('.ls-theory .ls-rule').length})""")
        if not th["t"] or th["go"] != "Practicar" or not th["rules"]:
            probs.append(f"la regla: {th}")
        _go(page)
        st = page.evaluate(_ST)
        if st["t"] != "gq" or not page.evaluate("!!document.querySelector('.ls-stage > .ls-page:not(.ls-ghost) .ls-gap')"):
            probs.append(f"tras «Practicar»: {st}")
        _pick(page, _wrong(page, st["right"]))
        page.wait_for_timeout(400)
        fb = page.evaluate("""() => { const p = document.querySelector('.ls-stage > .ls-page:not(.ls-ghost)');
          return {gap: p.querySelector('.ls-gap').textContent, fb: p.querySelector('.ls-fb').textContent, miss: !!p.querySelector('.ls-opt.is-miss'), ok: !!p.querySelector('.ls-opt.is-ok')}; }""")
        if fb["gap"] != st["right"] or not fb["miss"] or not fb["ok"] or "¡Casi!" not in fb["fb"]:
            probs.append(f"fallar en gramática: {fb}")
        _go(page)
        _play(page)
        page.wait_for_selector(".ls-end", timeout=5000)
        page.wait_for_timeout(1200)
        end = page.evaluate("""() => ({stars: document.querySelectorAll('.ls-star.got').length, saved: sessionStorage.getItem('vocab:ls'),
          map: store.get('map:english', {})['%s']})""" % GRAM)
        if not end["stars"] or end["saved"] is not None or not end["map"]:
            probs.append(f"final de gramática: {end}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- aspecto: móvil y escritorio, claro y oscuro
def test_layout_phone_desk_light_dark():
    """Palabra nueva: la palabra a 44 px en la letra redonda, la traducción en gris, altavoz de 64 px y una sola
    tortuga, sin «PALABRA NUEVA» ni IPA a la vista (sí con vocabUI ipa). Preguntas: 2×2 opciones de 64 px; los números
    solo con teclado o ratón (escritorio sí, móvil no). Botón de abajo de 56 px. Nada se sale de lado. Cambio de
    tarjeta lateral de 220 ms (con «Reducir movimiento», solo un fundido). Sin errores en ninguna combinación."""
    probs = []
    learn = """() => { const p = document.querySelector('.ls-stage > .ls-page:not(.ls-ghost)'), w = p.querySelector('.ls-word'), tr = p.querySelector('.ls-tr');
      const spk = p.querySelector('.ls-spk'), go = document.getElementById('ls-go'), cs = getComputedStyle(w);
      return {fs: parseFloat(cs.fontSize), round: /nunito|rounded/i.test(cs.fontFamily), trc: getComputedStyle(tr).color, wc: cs.color,
        spk: Math.round(spk.getBoundingClientRect().width), turtles: p.querySelectorAll('.ls-slow').length,
        tag: /PALABRA NUEVA/i.test(p.textContent), ipa: !!p.querySelector('.ls-ipa'), go: Math.round(go.getBoundingClientRect().height),
        pic: (() => { const i = p.querySelector('.ls-pic img'); return i ? [Math.round(i.getBoundingClientRect().height), Math.round(i.getBoundingClientRect().bottom - w.getBoundingClientRect().top)] : null; })(),
        sw: document.documentElement.scrollWidth, iw: innerWidth}; }"""
    quest = """() => { const p = document.querySelector('.ls-stage > .ls-page:not(.ls-ghost)'), os = [...p.querySelectorAll('.ls-opt')];
      const r = os.map(o => o.getBoundingClientRect()), k = p.querySelector('.ls-k');
      return {n: os.length, h: r.map(x => Math.round(x.height)), cols: new Set(r.map(x => Math.round(x.left))).size,
        kbd: !!k && getComputedStyle(k).display !== 'none', sw: document.documentElement.scrollWidth, iw: innerWidth}; }"""
    for kind in ("phone", "desk"):
        for scheme in ("light", "dark"):
            label = f"{kind}/{scheme}"
            page = C.new_page(kind, color_scheme=scheme)
            try:
                _open(page)
                page.wait_for_timeout(300)
                L = page.evaluate(learn)
                if abs(L["fs"] - 44) > 1 or not L["round"]:
                    probs.append(f"{label}: la palabra a {L['fs']} px ({L['round']})")
                if L["trc"] == L["wc"]:
                    probs.append(f"{label}: la traducción no va en gris")
                if L["spk"] != 64 or L["turtles"] != 1 or L["tag"] or L["ipa"]:
                    probs.append(f"{label}: palabra nueva {L}")
                if L["pic"] and (L["pic"][0] < 100 or L["pic"][1] > 0):
                    probs.append(f"{label}: el dibujo (alto {L['pic'][0]} px) se monta sobre la palabra ({L['pic'][1]} px)")
                if L["go"] != 56:
                    probs.append(f"{label}: el botón de abajo mide {L['go']} px")
                if L["sw"] > L["iw"]:
                    probs.append(f"{label}: se sale de lado ({L['sw']} > {L['iw']})")
                # la transición entre tarjetas
                page.locator("#ls-go").click()
                page.wait_for_timeout(40)
                an = page.evaluate("""() => { const p = document.querySelector('.ls-stage > .ls-page:not(.ls-ghost)'), a = p.getAnimations()[0];
                  return a ? {d: a.effect.getTiming().duration, tf: a.effect.getKeyframes().some(k => k.transform && k.transform !== 'none')} : null; }""")
                if not an or an["d"] != 220 or not an["tf"]:
                    probs.append(f"{label}: transición {an}")
                page.wait_for_timeout(300)
                if kind == "phone" and scheme == "light":
                    page.evaluate("() => vocabUI.set('ipa', true)")
                    page.evaluate("() => { vocabLesson.state.i = 0; lsStep(-1); }")
                    page.wait_for_timeout(300)
                    has = page.evaluate("() => { const p = document.querySelector('.ls-stage > .ls-page:not(.ls-ghost)'); return !!p.querySelector('.ls-ipa') || !document.querySelector('.ls-word'); }")
                    want = page.evaluate("() => !!vocabLesson.state.steps[0].w.r.l[lang].ipa")
                    if want and not has:
                        probs.append(f"{label}: con IPA activado no sale")
                    page.evaluate("() => vocabUI.set('ipa', false)")
                while page.evaluate(_ST)["t"] == "learn":
                    _go(page)
                Q = page.evaluate(quest)
                if Q["n"] != 4 or any(h < 64 for h in Q["h"]) or Q["cols"] != 2:
                    probs.append(f"{label}: opciones {Q}")
                if Q["kbd"] != (kind == "desk"):
                    probs.append(f"{label}: números de teclado a la vista = {Q['kbd']}")
                if Q["sw"] > Q["iw"]:
                    probs.append(f"{label}: la pregunta se sale de lado ({Q['sw']} > {Q['iw']})")
                if kind == "phone":                    # con una tecla salen los números
                    page.keyboard.press("Shift")
                    page.keyboard.press("ArrowDown")
                    if not page.evaluate("() => { const k = document.querySelector('.ls-stage > .ls-page:not(.ls-ghost) .ls-k'); return !!k && getComputedStyle(k).display !== 'none'; }"):
                        probs.append(f"{label}: con el teclado no salen los números")
                probs += [f"{label}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    # con «Reducir movimiento»: solo un fundido
    page = C.new_page("phone", reduced_motion="reduce")
    try:
        _open(page)
        page.locator("#ls-go").click()
        page.wait_for_timeout(30)
        an = page.evaluate("""() => { const p = document.querySelector('.ls-stage > .ls-page:not(.ls-ghost)'), a = p.getAnimations()[0];
          return a ? {d: a.effect.getTiming().duration, tf: a.effect.getKeyframes().some(k => k.transform && k.transform !== 'none'),
            op: a.effect.getKeyframes().some(k => k.opacity !== undefined)} : null; }""")
        if not an or an["tf"] or not an["op"] or an["d"] > 160:
            probs.append(f"reducir movimiento: transición {an}")
        _play(page, auto=False)
        if not page.evaluate("!!document.querySelector('.ls-end .ls-star.got')"):
            probs.append("reducir movimiento: no termina")
        probs += [f"reducir movimiento: {e}" for e in C.errors(page)]
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- «Cómo suena»
def test_how_it_sounds_sheet():
    """Mantener la palabra (o el botón «Cómo suena») abre una hoja con las sílabas y el audio lento; «Listo» la cierra.
    Las sílabas siguen reglas sencillas por idioma."""
    page = C.new_page("phone")
    probs = []
    try:
        _open(page)
        page.wait_for_timeout(400)
        page.evaluate("() => { window.__slow = []; const S = window.say; window.say = function (t, b, slow) { __slow.push([t, !!slow]); return S.apply(this, arguments); }; }")
        w = page.locator(".ls-stage > .ls-page:not(.ls-ghost) .ls-word")
        box = w.bounding_box()
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        page.mouse.down()
        page.wait_for_timeout(750)
        page.mouse.up()
        page.wait_for_selector("dialog#ls-how[open]", timeout=3000)
        page.wait_for_timeout(500)
        how = page.evaluate("""() => { const d = document.getElementById('ls-how'); return {sy: [...d.querySelectorAll('.ls-syl .sy')].map(e => e.textContent),
          word: vocabLesson.state.steps[vocabLesson.state.i].w.r.l[lang].word, slow: __slow.slice()}; }""")
        if "".join(how["sy"]).replace(" ", "") != how["word"].replace(" ", "") or len(how["sy"]) < 2:
            probs.append(f"sílabas de {how['word']!r}: {how['sy']}")
        if not any(s for _, s in how["slow"]):
            probs.append(f"la hoja no suena despacio: {how['slow']}")
        if page.evaluate("vocabLesson.state.i") != 0:
            probs.append("mantener la palabra pasó de tarjeta")
        page.locator("#ls-how [data-close]").click()
        page.wait_for_function("() => !document.getElementById('ls-how').open", timeout=3000)
        page.locator(".ls-stage > .ls-page:not(.ls-ghost) [data-how]").click()
        page.wait_for_selector("dialog#ls-how[open]", timeout=3000)
        page.locator("#ls-how [data-close]").click()
        cases = {("grandmother", "en"): [["grand", "mo", "ther"]], ("table", "en"): [["ta", "ble"]], ("cake", "en"): [["cake"]],
                 ("éléphant", "fr"): [["é", "lé", "phant"]], ("le chien", "fr"): [["le"], ["chien"]], ("bedstemor", "da"): [["bed", "ste", "mor"]],
                 ("en hund", "da"): [["en"], ["hund"]]}
        for (t, l), want in cases.items():
            got = page.evaluate("([t, l]) => vocabLesson.syllables(t, l)", [t, l])
            if got != want:
                probs.append(f"syllables({t!r}, {l!r}) = {got} (se esperaba {want})")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)
