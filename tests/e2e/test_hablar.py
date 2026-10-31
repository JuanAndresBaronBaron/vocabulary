"""«Hablar, escuchar y leer»: la voz de index.html (say/sayP), las llamadas (js/calls.js), los cuentos (js/stories.js),
el loro (js/parrot.js), el cazador (js/hunter.js) y dos juegos nuevos, «Rap del zorro» (js/chant.js) y «El zorro dice»
(js/simon.js).

- Llamadas: las respuestas salen barajadas cada vez (vocabCalls.mix: una copia; las mismas respuestas, con su «re», el
  mismo yes/no y la buena contada otra vez) y, tras cada respuesta, «Dilo conmigo» («Say it with me:» con la voz, la
  palabra con su mp3, la boca que late y «¡Dilo tú!»; si ya se usó el micrófono, escucha y dice «¡Te he oído!»), en los
  tres idiomas. «Llamar al zorro» en Juegos (sección «Más») abre #/llamadas: las nuevas arriba y las oídas abajo con ✓.
- Voz: una palabra sin audio grabado y sin voz de su idioma no se dice con otro acento (el altavoz en gris con
  data-novoice y un aviso una vez por sesión; la IPA sigue); el mapa de audios (audio/<ab>.json) que no llega se vuelve a
  pedir al volver la conexión o pasados 30 s, y entonces suena el mp3.
- Cuentos: «¿Te acuerdas?» antes del final (3 preguntas con 3 dibujos que dice la voz, sin texto hasta contestar; mal:
  gris con ✗, el bueno con ✓ y suena; las monedas, al acabar), las preguntas de los 12 cuentos y «Leer solo» (pasa sola
  de página; se para en la de elegir y en una pregunta sin contestar).
- Loro eco desde Juegos con el tema (#/loro?t=<tema>, pestaña Jugar), el cazador tocando que primero se escucha y los dos
  juegos nuevos (niveles, orden, colores por idioma, el ritmo en el reloj del AudioContext, tocar a tiempo y el
  micrófono de mentira), 360×740 y 390×844 sin scroll, y capturas en capturas/hablar (claro, oscuro con «Reducir
  movimiento» y escritorio) con contraste, paleta y accesibilidad."""
from __future__ import annotations

import json
import re

import common as C
import test_f6_cazador as HN
import test_f6_cuentos as CU
import test_f6_llamada as CL
import test_f6_loro as LO
import test_voces as V

OUT = C.CAPTURAS / "hablar"
_AUDIT = CU._AUDIT
AB = {"english": "en", "français": "fr", "dansk": "da"}
CLIPS = {ab: json.loads((C.REPO / "audio" / f"{ab}.json").read_text(encoding="utf-8")) for ab in AB.values()}
_COLROWS = {r["es"]: r for r in json.loads((C.REPO / "data" / "colores.json").read_text(encoding="utf-8"))["rows"] if r.get("es") and r.get("l")}
COLW = {L: {_COLROWS[es]["l"][L]["word"] for es in ("Rojo", "Azul", "Amarillo", "Verde")} for L in AB}
FRAME = {"english": "Touch the", "français": "Touche", "dansk": "Find"}
AND = {"english": "and the", "français": "et", "dansk": "og"}
ECHO = {"english": "Say it with me:", "français": "Répète avec moi :", "dansk": "Sig det med mig:"}
STORIES = [f"{ab}/{n}" for ab in ("en", "fr", "da") for n in ("cake", "colours", "night", "play")]
OLD4 = ("en-rain", "en-breakfast", "en-family", "en-birthday")
_FINISH = CU._FINISH

# el AudioContext de verdad, contado (y si nació dentro de un toque); el micrófono, un tono que se enciende con __micG
_AC = r"""(() => {
  const A = window.AudioContext; if (!A) return; window.__acs = [];
  window.AudioContext = class extends A { constructor(...a) { super(...a);
    /* solo los del rap (los sonidos de Juegos tienen el suyo) */
    if (!window.__micMaking && /chant\.js/.test(new Error().stack || '')) window.__acs.push({active: !!(navigator.userActivation && navigator.userActivation.isActive)}); } };
})();"""
_MIC = r"""(() => {
  if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', {configurable: true, value: {}});
  window.__micCalls = 0;
  navigator.mediaDevices.getUserMedia = async () => {
    window.__micCalls++;
    window.__micMaking = true; const ac = new AudioContext(); window.__micMaking = false;
    const o = ac.createOscillator(), g = ac.createGain(), d = ac.createMediaStreamDestination();
    o.frequency.value = 220; g.gain.value = 0; o.connect(g).connect(d); o.start(); try { await ac.resume(); } catch (e) {}
    window.__micG = g; window.__micAC = ac; window.__micStream = d.stream;
    return d.stream;
  };
})();"""
_ZD = "() => { const r = document.getElementById('zd'); return r && r.zdState ? r.zdState() : null; }"
_RP = "() => { const r = document.getElementById('rp'); return r && r.rap ? r.rap() : null; }"
# tocar el escenario del rap justo en el «¡Tú!» k (por el reloj del AudioContext, no por setTimeout)
_RP_TAP = """async k => { const r = document.getElementById('rp'), st = document.getElementById('rp-stage');
  const sl = r.rap().slots[k];
  for (let i = 0; i < 4000; i++) { const s = r.rap(); if (s.now - s.lat >= sl.t - .02) break; await new Promise(f => setTimeout(f, 4)); }
  st.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true, button: 0, pointerType: 'touch', isPrimary: true}));
  return r.rap().slots[k]; }"""
# cantar (el tono del micrófono de mentira) justo en el «¡Tú!» k
_RP_SING = """async k => { const r = document.getElementById('rp'), sl = r.rap().slots[k];
  for (let i = 0; i < 4000; i++) { const s = r.rap(); if (s.now - s.lat >= sl.t - .05) break; await new Promise(f => setTimeout(f, 4)); }
  window.__micG.gain.value = .5;
  for (let i = 0; i < 400; i++) { if (r.rap().slots[k].joined) break; await new Promise(f => setTimeout(f, 5)); }
  window.__micG.gain.value = 0;
  return r.rap().slots[k]; }"""
_BOX = """s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect();
  return {w: r.width, h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right}; }"""
_GRAY = lambda c: (lambda v: len(v) >= 3 and max(v[:3]) - min(v[:3]) <= 12)([int(float(x)) for x in re.findall(r"\d+(?:\.\d+)?", c or "")])  # noqa: E731


def _hscroll(page):
    return page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1")


def _a11y(page):
    return CL._a11y(page)


def _audit(page, tag, scope, probs, a11y=True):
    page.evaluate(_FINISH)
    page.wait_for_timeout(150)
    a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
    for x in a["contrast"] + a["palette"]:
        if any(s in str(x) for s in scope):
            probs.append(f"{tag}: {x}")
    if a11y:
        probs.extend(f"{tag}: {x}" for x in _a11y(page))


# ---------------------------------------------------------------- páginas
def _gpage(kind="phone", voices=None, mic=False, **kw):
    """Voz de mentira (Edge en Windows: las tres lenguas; __spoken) y mp3 espiados (__played, acaban a los 80 ms)."""
    page = C.new_page(kind, **kw)
    page.add_init_script(f"{V._FAKE}({json.dumps({'voices': V.EDGE if voices is None else voices, 'delay': 0}, ensure_ascii=False)})")
    page.add_init_script(CU._MEDIA)
    page.add_init_script(_AC)
    if mic:
        page.add_init_script(_MIC)
    return page


def _gkeys(lang="english", **extra):
    k = dict(C.seed_keys())
    k["lang"] = json.dumps(lang, ensure_ascii=False)
    for a, b in extra.items():
        k[a.replace("__", ":")] = b if isinstance(b, str) else json.dumps(b, ensure_ascii=False)
    return k


def _game(page, g, lang="english", topic="animales"):
    """Abre el juego g con ese tema (sin cambiar el de Juegos) y toca «¡A jugar!»."""
    C.seed(page, _gkeys(lang), f"#/juegos/{g}?t={topic}")
    page.wait_for_selector(".gm-intro .gm-go", timeout=15000)
    page.locator(".gm-intro .gm-go").click()
    page.wait_for_timeout(150)


def _heard(page, part, n0=(0, 0)):
    """¿Sonó part desde n0 = (dichos, mp3)? Con la voz (su texto) o con su mp3 (clipFor)."""
    return page.evaluate("""([p, n0]) => { const id = clipFor(p), ab = CLIP_AB[lang];
      return __spoken.slice(n0[0]).some(x => x.text === speakable(p)) || (!!id && __played.slice(n0[1]).some(x => x.src.endsWith(`/audio/${ab}/${id}.mp3`))); }""",
                         [part, list(n0)])


def _counts(page):
    return tuple(page.evaluate("() => [__spoken.length, __played.length]"))


# ---------------------------------------------------------------- 1. las llamadas: barajadas
def test_calls_answers_shuffled_with_their_reactions():
    """vocabCalls.mix(llamada) da una copia con las respuestas de cada pregunta en otro orden: las mismas respuestas (el
    mismo objeto, con su «re»), el mismo yes/no, la buena es la misma respuesta (ok contado otra vez) y la buena sale en
    más de un sitio; las frases sin respuestas son las mismas y vocabCalls.get() no cambia. En pantalla, la buena es la
    de vocabCalls.current.ok (el mismo dibujo) y tocarla la marca con ✓."""
    probs = []
    page = CL._page()
    try:
        CL._seed(page, CL._keys(calls={"v": 1, "h": {i: CL._day(C.FIXED_NOW, -9) for i in OLD4}}))
        out = page.evaluate("""async () => {
          const out = [], ids = (await vocabCalls.list('english')).map(m => m.id);
          if (ids.length < 5) out.push('pocas llamadas: ' + ids);
          for (const id of ids) {
            const c = await vocabCalls.get(id), key = () => JSON.stringify(c.lines.map(l => [l.say, l.ok, l.a ? l.a.map(a => a.w.ref) : null]));
            const k0 = key(), pos = {};
            for (let n = 0; n < 40; n++) {
              const m = vocabCalls.mix(c);
              if (m === c || m.lines === c.lines || m.lines.length !== c.lines.length) { out.push(id + ': mix no da una copia'); break; }
              m.lines.forEach((o, i) => {
                const l = c.lines[i];
                if (!l.a) { if (o !== l) out.push(`${id} ${i}: la frase sin respuestas cambia`); return; }
                if (o === l || o.a === l.a) out.push(`${id} ${i}: no es una copia`);
                if (o.a.length !== l.a.length || !l.a.every(a => o.a.includes(a))) out.push(`${id} ${i}: no son las mismas respuestas`);
                if (o.yes !== l.yes || o.no !== l.no || o.say !== l.say) out.push(`${id} ${i}: cambia yes/no o la frase`);
                if (typeof l.ok === 'number') { if (o.a[o.ok] !== l.a[l.ok]) out.push(`${id} ${i}: la buena no es la misma`); (pos[i] = pos[i] || new Set()).add(o.ok); }
                else if (o.ok !== l.ok || !o.a.every(a => a.re === l.a[l.a.indexOf(a)].re)) out.push(`${id} ${i}: la pregunta abierta pierde su «re»`);
              });
            }
            if (key() !== k0) out.push(id + ': get() cambió');
            for (const [i, s] of Object.entries(pos)) if (s.size < 2) out.push(`${id} ${i}: la buena siempre en ${[...s]}`);
          }
          return [...new Set(out)];
        }""")
        probs += out
        CL._ring(page)
        CL._answer(page)
        cur = CL._to_wait(page)
        ln = page.evaluate("async i => { const l = (await vocabCalls.get('en-zoo')).lines[i]; return {ok: l.ok, img: l.a[l.ok].w.img}; }", cur["i"])
        shown = page.evaluate("() => [...document.querySelectorAll('#cl-ans .cl-a img')].map(i => i.getAttribute('src'))")
        ok = CL._okj(cur)
        if not isinstance(cur.get("ok"), int) or shown[ok] != ln["img"]:
            probs.append(f"en pantalla la buena ({cur.get('ok')}) no es el dibujo bueno {ln['img']}: {shown}")
        CL._pick(page, ok)
        cls = page.evaluate("() => [...document.querySelectorAll('#cl-ans .cl-a')].map(b => b.className)")
        if "is-ok" not in cls[ok] or any("is-miss" in c for c in cls):
            probs.append(f"tocar la buena no la marca: {cls}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 2. «Dilo conmigo»
def _echo(page, steps=240):
    """Deja correr la llamada hasta «¡Dilo tú!» y devuelve lo que se ve."""
    for _ in range(steps):
        r = page.evaluate("""() => { const e = document.getElementById('cl-echo'), c = vocabCalls.current;
          return e ? {b: e.querySelector('b').textContent, mouth: !!e.querySelector('.cl-mouth svg'), heard: e.classList.contains('heard'),
            say: document.getElementById('cl-say').textContent, es: document.getElementById('cl-es').textContent, phase: c && c.phase,
            live: (document.querySelector('#cl-dlg [role=status], #cl-dlg [aria-live]') || {}).textContent || ''} : null; }""")
        if r:
            return r
        page.clock.run_for(150)
        page.wait_for_timeout(30)
    return None


def test_say_it_with_me_after_each_answer():
    """Tras contestar (y después de la reacción del zorro), «Dilo conmigo»: el subtítulo «Say it with me: elephant!» con la
    palabra iluminada, la voz elegida dice «Say it with me:» y la palabra suena con su mp3; luego la boca que late con
    «¡Dilo tú!» unos segundos (sin micrófono no escucha: no pide el permiso por sorpresa) y la llamada sigue. Si ya se
    contestó con «Dilo» (el micrófono tiene permiso), escucha y, si oye algo, «¡Te he oído!». En francés «Répète avec
    moi :» y en danés «Sig det med mig:»."""
    probs = []
    page = CL._page()
    try:
        CL._seed(page, CL._keys(calls={"v": 1, "h": {i: CL._day(C.FIXED_NOW, -9) for i in OLD4}}))
        CL._ring(page)
        CL._answer(page)
        lines = page.evaluate("""async () => (await vocabCalls.get('en-zoo')).lines.map(l => !l.a ? null :
          {ok: typeof l.ok === 'number' ? l.ok : -1, a: l.a.map(a => ({word: a.w.word, say: a.w.say}))})""")
        cur = CL._to_wait(page)
        ln = lines[cur["i"]]
        right = ln["a"][max(0, ln["ok"])]
        n0 = _counts(page)
        page.evaluate("() => { window.__listened = 0; const l0 = window.listen; window.listen = async o => { window.__listened++; return {status: 'nomatch', alts: []}; }; }")
        CL._pick(page, CL._okj(cur))
        e = _echo(page)
        want = f"Say it with me: {right['say']}!"
        if not e:
            probs.append(f"no sale «Dilo conmigo» tras contestar: {page.evaluate(CL._CUR)}")
        else:
            if e["say"] != want or e["b"] != "¡Dilo tú!" or not e["mouth"] or e["phase"] != "echo":
                probs.append(f"«Dilo conmigo»: {e} (se esperaba {want!r})")
            if "Dilo conmigo" not in e["es"]:
                probs.append(f"el español de «Dilo conmigo»: {e['es']!r}")
            sp = [x["text"] for x in page.evaluate("n => __spoken.slice(n)", n0[0])]
            if "Say it with me:" not in sp:
                probs.append(f"la voz no dice «Say it with me:»: {sp}")
            clip = page.evaluate("w => clipFor(w)", right["say"])
            pl = page.evaluate("n => __played.slice(n)", n0[1])
            if not clip or sum(1 for u in pl if u.endswith(f"/audio/en/{clip}.mp3")) < 2:
                probs.append(f"la palabra «{right['say']}» no suena con su mp3 en la reacción y en «Dilo conmigo» ({clip}): {pl}")
            k = page.locator("#cl-say .cl-k")
            if k.count() != 1 or k.first.text_content() != right["say"]:
                probs.append(f"la palabra de «Dilo conmigo» no va iluminada: {k.count()}")
            if page.evaluate("() => window.__listened"):
                probs.append("«Dilo conmigo» escuchó sin haber usado el micrófono")
        nxt = CL._to_wait(page)
        if not nxt or nxt["i"] <= cur["i"] or page.locator("#cl-echo").count():
            probs.append(f"tras «Dilo conmigo» la llamada no sigue: {nxt}")
        # con «Dilo» (micrófono ya usado): escucha y «¡Te he oído!»
        ln = lines[nxt["i"]]
        right = ln["a"][max(0, ln["ok"])]
        page.evaluate("w => { window.__listened = 0; window.listen = async o => { window.__listened++; return {status: 'ok', alts: [w]}; }; }", right["word"])
        if not page.locator("#cl-mic").is_visible():
            probs.append("no sale «Dilo»")
        else:
            page.locator("#cl-mic").click()
            for _ in range(240):
                h = page.evaluate("() => { const e = document.getElementById('cl-echo'); return e && e.classList.contains('heard') ? e.querySelector('b').textContent : null; }")
                if h:
                    break
                page.clock.run_for(100)
                page.wait_for_timeout(25)
            if h != "¡Te he oído!" or page.evaluate("() => window.__listened") < 2:
                probs.append(f"con el micrófono ya usado no dice «¡Te he oído!»: {h} ({page.evaluate('() => window.__listened')} escuchas)")
            if h:
                C.shot(page, "dilo-conmigo-oido", OUT, full_page=False)
        CL._finish(page)
        probs += C.errors(page)
    finally:
        page.context.close()
    for L, cid in (("français", "fr-tour"), ("dansk", "da-cykel")):
        page = CL._page()
        try:
            CL._seed(page, CL._keys(lang=L), armed=False)
            if not page.evaluate("id => vocabCalls.ring(id)", cid):
                probs.append(f"{L}: vocabCalls.ring({cid}) no suena")
                continue
            page.wait_for_selector("dialog#cl-dlg[open] .cl-ring", timeout=6000)
            CL._answer(page)
            cur = CL._to_wait(page)
            n0 = _counts(page)
            CL._pick(page, CL._okj(cur))
            e = _echo(page)
            sp = [x for x in page.evaluate("n => __spoken.slice(n)", n0[0])]
            if not e or not e["say"].startswith(ECHO[L] + " ") or e["b"] != "¡Dilo tú!":
                probs.append(f"{L}: «Dilo conmigo» {e}")
            if not any(x["text"] == ECHO[L] and x["lang"] == CL._CODE[L] for x in sp):
                probs.append(f"{L}: la voz no dice {ECHO[L]!r} en {CL._CODE[L]}: {sp}")
            probs += [f"{L}: {x}" for x in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 3. «Llamar al zorro»
def test_call_the_fox_from_games_list():
    """En Juegos, sección «Más», la tarjeta «Llamar al zorro» (con su dibujo de 220 × 220) lleva a #/llamadas, de la
    pestaña Jugar con ‹ Juegos: las llamadas del idioma, las que nunca se han oído arriba («Nueva») y las oídas abajo con
    ✓ «Oída». Tocar una llama ya (sin sonar): contesta el zorro; al colgar, la lista la marca como oída."""
    probs = []
    page = CL._page()
    try:
        old = CL._day(C.FIXED_NOW, -3)
        CL._seed(page, CL._keys(calls={"v": 1, "h": {"en-rain": old}, "heard": {"en-rain": old}}), hash="#/juegos", armed=False)
        page.wait_for_selector('.gm-card[data-g="llamar"]', timeout=8000)
        card = page.evaluate("""() => { const a = document.querySelector('.gm-card[data-g="llamar"]'), i = a.querySelector('img');
          return {sec: (a.closest('[data-sec]') || {}).dataset ? a.closest('[data-sec]').dataset.sec : null, href: a.getAttribute('href'),
            img: i ? [i.getAttribute('src'), i.naturalWidth, i.naturalHeight] : null, t: a.textContent.replace(/\\s+/g, ' ').trim()}; }""")
        if card["sec"] != "mas" or card["href"] != "#/llamadas" or "Llamar al zorro" not in card["t"]:
            probs.append(f"la tarjeta: {card}")
        page.wait_for_function("() => { const i = document.querySelector('.gm-card[data-g=\"llamar\"] img'); return i && i.complete && i.naturalWidth > 0; }", timeout=5000)
        nat = page.evaluate("() => { const i = document.querySelector('.gm-card[data-g=\"llamar\"] img'); return [i.getAttribute('src'), i.naturalWidth, i.naturalHeight]; }")
        if not nat[0].endswith("img/games/llamar.png") or nat[1:] != [220, 220]:
            probs.append(f"el dibujo de la tarjeta: {nat}")
        page.locator('.gm-card[data-g="llamar"]').click()
        page.wait_for_selector("#cl-list .cl-li", timeout=8000)
        page.wait_for_timeout(200)
        rows = page.evaluate("""() => [...document.querySelectorAll('#cl-list .cl-li')].map(b => ({id: b.dataset.id, heard: b.classList.contains('is-heard'),
          small: b.querySelector('small').textContent.trim(), label: b.getAttribute('aria-label'), dis: b.disabled}))""")
        ids = page.evaluate("async () => (await vocabCalls.list('english')).map(m => m.id)")
        if sorted(r["id"] for r in rows) != sorted(ids):
            probs.append(f"la lista no tiene todas las llamadas: {[r['id'] for r in rows]} / {ids}")
        if not rows or rows[-1]["id"] != "en-rain" or not rows[-1]["heard"] or "Oída" not in rows[-1]["small"]:
            probs.append(f"la oída no va abajo con ✓ Oída: {rows[-1:]}")
        if any(r["heard"] or r["small"] != "Nueva" for r in rows[:-1]) or any(r["dis"] for r in rows):
            probs.append(f"las nuevas: {rows}")
        if not page.locator("#cl-list .cl-li.is-heard .cl-li-ok svg").count():
            probs.append("la oída no lleva la ✓")
        nav = page.evaluate("() => ({tab: document.documentElement.dataset.tab, back: (document.getElementById('dv-back') || {getAttribute: () => null}).getAttribute('href'), h: location.hash})")
        if nav["tab"] != "jugar" or nav["back"] != "#/juegos" or nav["h"] != "#/llamadas":
            probs.append(f"#/llamadas no es de Jugar con ‹ Juegos: {nav}")
        if _hscroll(page):
            probs.append("#/llamadas se sale de lado")
        C.shot(page, "llamadas-390", OUT, full_page=False)
        first = rows[0]["id"]
        page.locator(f"#cl-list .cl-li[data-id='{first}']").click()
        page.wait_for_function("() => vocabCalls.current && vocabCalls.current.mode === 'talk'", timeout=4000)
        if not page.evaluate(CL._OPEN):
            probs.append("tocar una llamada no abre la llamada")
        line0 = page.evaluate("async id => (await vocabCalls.get(id)).lines[0].say", first)
        if not page.evaluate("t => __spoken.some(x => x.text === t)", line0):
            probs.append("el zorro no contesta al llamarle")
        if not CL._hang(page):
            probs.append("no se cuelga")
        page.wait_for_function("id => { const b = document.querySelector(`#cl-list .cl-li[data-id='${id}']`); return b && b.classList.contains('is-heard'); }", arg=first, timeout=5000)
        if first not in page.evaluate("() => vocabCalls.state().heard"):
            probs.append(f"«calls».heard no apunta {first}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 4. sin voz del idioma
_TOASTS = "() => { if (window.__toasts) return; window.__toasts = []; const t0 = M.toast; M.toast = function (t) { window.__toasts.push(String(t)); return t0.apply(this, arguments); }; }"
_BTN = "() => { let b = document.getElementById('t-say'); if (!b) { b = document.createElement('button'); b.id = 't-say'; b.className = 'say'; b.title = 'Escuchar'; b.textContent = '▶'; document.body.append(b); } return true; }"


def test_no_voice_no_clip_is_not_spoken():
    """Danés en Chrome de Windows (sin voz danesa): una palabra sin audio grabado no se dice con otra voz (nada en
    __spoken), el altavoz queda en gris (data-novoice) y sale un aviso para los mayores una sola vez por sesión (tampoco
    al recargar); sayP acaba igual. Una palabra danesa con mp3 sí suena (y el altavoz deja de estar gris). En inglés, la
    misma palabra sin audio la dice la voz. La IPA sigue a la vista (el globo de un cuento)."""
    probs = []
    page = _gpage(voices=V.CHROME_WIN)
    try:
        C.seed(page, _gkeys("dansk"))
        page.evaluate(_TOASTS)
        page.evaluate(_BTN)
        page.evaluate("() => say('xyzzyq', document.getElementById('t-say'))")
        page.wait_for_timeout(200)
        r = page.evaluate("""() => { const b = document.getElementById('t-say');
          return {spoken: __spoken.length, played: __played.length, nov: b.hasAttribute('data-novoice'), playing: b.classList.contains('playing'),
            filter: getComputedStyle(b).filter, toasts: __toasts.slice()}; }""")
        if r["spoken"] or r["played"] or not r["nov"] or r["playing"] or "grayscale(1)" not in r["filter"]:
            probs.append(f"sin voz ni audio: {r}")
        if len(r["toasts"]) != 1 or "Ajustes" not in r["toasts"][0] or "danés" not in r["toasts"][0]:
            probs.append(f"el aviso: {r['toasts']}")
        done = page.evaluate("async () => { await sayP('xyzzyq', document.getElementById('t-say')); return __spoken.length; }")
        page.evaluate("() => say('qwzzk', document.getElementById('t-say'))")
        page.wait_for_timeout(150)
        if done or page.evaluate("() => __toasts.length") != 1:
            probs.append(f"sayP habló o el aviso salió otra vez: {page.evaluate('() => __toasts')}")
        page.evaluate("() => say('en hund', document.getElementById('t-say'))")
        page.wait_for_timeout(200)
        r = page.evaluate("() => ({pl: __played.map(x => x.src), nov: document.getElementById('t-say').hasAttribute('data-novoice')})")
        if not any(u.endswith(f"/audio/da/{CLIPS['da']['en hund']}.mp3") for u in r["pl"]) or r["nov"]:
            probs.append(f"«en hund» (con mp3) no suena: {r}")
        C.reload(page)
        page.evaluate(_TOASTS)
        page.evaluate(_BTN)
        page.evaluate("() => say('xyzzyq', document.getElementById('t-say'))")
        page.wait_for_timeout(200)
        if page.evaluate("() => __toasts.length") or page.evaluate("() => __spoken.length"):
            probs.append("tras recargar (la misma sesión) el aviso sale otra vez o habla")
        # la IPA sigue: el globo de una palabra en el primer cuento danés
        sid = next(e["id"] for e in CU.IDX["dansk"] if e["n"] == 1)
        s, _ = CU._story(sid)
        C.goto(page, f"#/cuento/{sid}")
        page.wait_for_selector("#st-stage .st-page", timeout=10000)
        page.locator("#st-next").click()
        CU._wait_state(page, "s.p === 1")
        units = CU._state(page)["units"]
        iu = next((i for i, u in enumerate(units) if (s["gloss"].get(u.lower()) or {}).get("ipa")), None)
        if iu is not None:
            page.locator(f"#st-txt .st-u[data-u='{iu}']").click()
            page.wait_for_selector("#st-bub", timeout=3000)
            ipa = page.evaluate("() => (document.querySelector('#st-bub .ipa') || {}).textContent || ''")
            if not ipa.strip():
                probs.append("sin voz danesa el globo pierde la IPA")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = _gpage(voices=V.CHROME_WIN)
    try:
        C.seed(page, _gkeys("english"))
        page.evaluate(_BTN)
        page.evaluate("() => say('xyzzyq', document.getElementById('t-say'))")
        page.wait_for_timeout(200)
        r = page.evaluate("() => ({sp: __spoken.map(x => x.text), nov: document.getElementById('t-say').hasAttribute('data-novoice')})")
        if r["sp"] != ["xyzzyq"] or r["nov"]:
            probs.append(f"en inglés (con voz) no habla: {r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 5. el mapa de audios que no llega
def _blocked_once(page):
    hits = []

    def h(route):
        hits.append(route.request.url)
        if len(hits) == 1:
            route.abort()
        else:
            route.continue_()
    page.route("**/audio/en.json", h)
    return hits


def _errs(page):
    return [e for e in C.errors(page) if not ("Failed to load resource" in e and ("ERR_FAILED" in e or "audio/en.json" in e))]


def test_clip_map_retried_after_failure():
    """Si audio/en.json no llega al abrir la app (sin conexión o mala red), no se queda vacío: con el evento online se
    vuelve a pedir y luego «dog» suena con su mp3. Sin online, no se pide otra vez antes de 30 s (la voz habla mientras);
    pasados 30 s, el siguiente say() lo pide y desde entonces suena el mp3."""
    probs = []
    dog = f"/audio/en/{CLIPS['en']['dog']}.mp3"
    page = _gpage()
    try:
        hits = _blocked_once(page)
        C.seed(page, _gkeys("english"))
        page.wait_for_function("() => clipTry.english && clipTry.english.at > 0 && !clipTry.english.busy", timeout=8000)
        if page.evaluate("() => clipTry.english.ok || !!clipFor('dog')"):
            probs.append("el mapa que falló cuenta como cargado")
        page.evaluate("() => window.dispatchEvent(new Event('online'))")
        page.wait_for_function("() => clipTry.english.ok", timeout=8000)
        page.evaluate("() => say('dog')")
        page.wait_for_timeout(200)
        if not any(x["src"].endswith(dog) for x in page.evaluate("() => __played")) or len(hits) < 2:
            probs.append(f"tras online «dog» no suena con su mp3: {page.evaluate('() => __played')} ({len(hits)} peticiones)")
        probs += _errs(page)
    finally:
        page.context.close()
    page = _gpage()
    try:
        hits = _blocked_once(page)
        C.seed(page, _gkeys("english"))
        page.wait_for_function("() => clipTry.english && clipTry.english.at > 0 && !clipTry.english.busy", timeout=8000)
        n = len(hits)
        page.evaluate("() => say('dog')")
        page.wait_for_timeout(300)
        r = page.evaluate("() => ({ok: clipTry.english.ok, pl: __played.length, sp: __spoken.map(x => x.text)})")
        if len(hits) != n or r["ok"] or r["pl"] or r["sp"] != ["dog"]:
            probs.append(f"antes de 30 s: {len(hits) - n} peticiones más, {r} (debería hablar la voz)")
        page.clock.run_for(31000)
        page.evaluate("() => say('dog')")
        page.wait_for_function("() => clipTry.english.ok", timeout=8000)
        page.evaluate("() => say('dog')")
        page.wait_for_timeout(200)
        if len(hits) != n + 1 or not any(x["src"].endswith(dog) for x in page.evaluate("() => __played")):
            probs.append(f"pasados 30 s: {len(hits) - n} peticiones, mp3 {page.evaluate('() => __played')}")
        probs += _errs(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 6. «¿Te acuerdas?»
def test_story_quiz_files_and_picture_words():
    """Los 12 cuentos traen «¿Te acuerdas?»: 2 preguntas del cuento y 1 de cada final, cada una con la frase en el idioma
    y en español, 3 dibujos distintos que existen y el bueno; el dibujo bueno da su palabra con IPA
    (vocabStories.picWord), que se enseña y suena al contestar."""
    probs = []
    imgs = {}
    for f in STORIES:
        s = json.loads((C.REPO / "data" / "stories" / f"{f}.json").read_text(encoding="utf-8"))
        qs = [("quiz", q) for q in s.get("quiz") or []]
        if len(qs) != 2:
            probs.append(f"{f}: {len(qs)} preguntas del cuento")
        for o in s["choice"]["opts"]:
            oq = o.get("quiz") or []
            if len(oq) != 1:
                probs.append(f"{f}/{o['key']}: {len(oq)} preguntas del final")
            qs += [(o["key"], q) for q in oq]
        for where, q in qs:
            ok = (isinstance(q.get("t"), str) and q["t"].strip() and isinstance(q.get("es"), str) and q["es"].strip()
                  and isinstance(q.get("opts"), list) and len(q["opts"]) == 3 and len(set(q["opts"])) == 3
                  and isinstance(q.get("ok"), int) and 0 <= q["ok"] < 3)
            if not ok:
                probs.append(f"{f}/{where}: pregunta mal hecha {q}")
                continue
            for u in q["opts"]:
                if not (C.REPO / u).exists():
                    probs.append(f"{f}/{where}: no existe {u}")
            imgs.setdefault(s["id"], set()).add(q["opts"][q["ok"]])   # el bueno dice su palabra al contestar
    page = CU._page()
    try:
        CU._open(page, "#/cuentos")
        got = page.evaluate("""async m => { const out = {};
          for (const [id, us] of Object.entries(m)) { await vocabStories.story(id); out[id] = us.map(u => [u, vocabStories.picWord(id, u)]); }
          return out; }""", {k: sorted(v) for k, v in imgs.items()})
        for sid, rows in got.items():
            for u, w in rows:
                if not w or not w.get("w") or not re.match(r"^/[^/]+/$", w.get("ipa") or ""):
                    probs.append(f"{sid}: el dibujo {u} no da palabra con IPA: {w}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def _to_kind(page, kind, choose="duck", steps=40):
    for _ in range(steps):
        st = CU._state(page)
        if st["kind"] == kind or st["fin"]:
            return st
        if st["kind"] == "choice" and not st["ch"]:
            page.locator(f".st-opt[data-k='{choose}']").click()
            CU._wait_state(page, f"s.ch === {json.dumps(choose)}")
        p0 = st["p"]
        page.locator("#st-next").click()
        CU._wait_state(page, f"s.p > {p0} || s.fin", 4000)
    raise AssertionError(f"no llega a {kind}")


def test_story_quiz_listen_pick_and_award_after():
    """«The Fox Wants to Play»: tras el final elegido, «¿Te acuerdas?» con 3 preguntas (1 de 3, 2 de 3…) que dice la voz
    sin texto escrito, 3 dibujos (los del cuento, en otro orden) y sin «Siguiente» hasta contestar («Toca un dibujo»). Un
    malo: gris con ✗, el bueno con ✓ y su palabra con IPA, y suena; la pregunta se ve escrita. Las teclas 1-3 contestan.
    Las monedas (award(10)) llegan una vez, al acabar, no durante las preguntas."""
    probs = []
    s, _ = CU._story("en-play")
    want = s["quiz"] + next(o for o in s["choice"]["opts"] if o["key"] == "duck")["quiz"]
    oks = []
    page = CU._page()
    try:
        CU._open(page, "#/cuento/en-play")
        page.evaluate(CU._SPY)
        st = _to_kind(page, "quiz")
        for qi in range(3):
            st = CU._state(page)
            q = st["quiz"]
            if st["kind"] != "quiz" or not q or q["i"] != qi or q["n"] != 3 or q["pick"] is not None:
                probs.append(f"pregunta {qi + 1}: {st['kind']} {q}")
                break
            oks.append(q["ok"])
            if sorted(q["opts"]) != sorted(want[qi]["opts"]) or q["opts"][q["ok"]] != want[qi]["opts"][want[qi]["ok"]]:
                probs.append(f"pregunta {qi + 1}: dibujos {q['opts']} (en el cuento {want[qi]})")
            ui = page.evaluate("""() => ({next: !document.getElementById('st-next').hidden, pick: (document.getElementById('st-pick') || {}).hidden === false ? document.getElementById('st-pick').textContent : null,
              txt: !!document.getElementById('st-txt'), hint: (document.getElementById('st-qhint') || {}).textContent || '',
              kick: document.getElementById('st-qk').textContent, auto: !!document.getElementById('st-auto'),
              opts: [...document.querySelectorAll('#st-stage .st-qo:not(.st-ghost *)')].map(b => [b.dataset.key, b.querySelector('img').complete && b.querySelector('img').naturalWidth > 0]),
              names: [...document.querySelectorAll('#st-stage .st-qo:not(.st-ghost *)')].map(b => b.getAttribute('aria-label') || '')})""")
            if len(ui["names"]) != 3 or not all(re.match(r"^[1-3]: \S", n) for n in ui["names"]):
                probs.append(f"pregunta {qi + 1}: los dibujos sin nombre en español para el lector de pantalla {ui['names']}")
            if ui["next"] or ui["pick"] != "Toca un dibujo" or ui["txt"] or "Escucha la pregunta" not in ui["hint"]:
                probs.append(f"pregunta {qi + 1} sin contestar: {ui}")
            if f"{qi + 1} de 3" not in ui["kick"] or [k for k, _ in ui["opts"]] != ["1", "2", "3"] or not all(v for _, v in ui["opts"]):
                probs.append(f"pregunta {qi + 1}: {ui['kick']!r} {ui['opts']}")
            try:
                page.wait_for_function("t => __spoken.some(x => x.text === t)", arg=want[qi]["t"], timeout=4000)
            except Exception:
                probs.append(f"la voz no dice «{want[qi]['t']}»: {[x['text'] for x in page.evaluate('() => __spoken')][-3:]}")
            if page.evaluate("() => window.__aw.length"):
                probs.append(f"pregunta {qi + 1}: monedas antes de acabar {page.evaluate('() => window.__aw')}")
            w = page.evaluate("([id, u]) => vocabStories.picWord(id, u)", ["en-play", q["opts"][q["ok"]]])
            n0 = _counts(page)
            if qi == 0:   # una mala
                bad = next(i for i in range(3) if i != q["ok"])
                CU._quiz(page, st, right=False)
                r = page.evaluate("""() => { const m = document.querySelector('#st-stage .st-qo.is-miss:not(.st-ghost *)'), k = document.querySelector('#st-stage .st-qo.is-ok:not(.st-ghost *)');
                  return {miss: m ? +m.dataset.i : -1, ok: k ? +k.dataset.i : -1, x: !!(m && m.querySelector('.st-qo-mk svg')), v: !!(k && k.querySelector('.st-qo-mk svg')),
                    mk: m ? getComputedStyle(m.querySelector('.st-qo-mk')).backgroundColor : '', w: k ? (k.querySelector('.st-qo-w') || {}).textContent : '',
                    ipa: k ? (k.querySelector('.ipa') || {}).textContent || '' : '', live: document.getElementById('st-live').textContent,
                    lm: m ? m.getAttribute('aria-label') : '', lk: k ? k.getAttribute('aria-label') : ''}; }""")
                if not r["lm"].endswith(" (no es)") or not r["lk"].endswith(" (este era)"):
                    probs.append(f"tras una mala, los nombres para el lector de pantalla: {r['lm']!r} {r['lk']!r}")
                if r["miss"] != bad or r["ok"] != q["ok"] or not r["x"] or not r["v"] or not _GRAY(r["mk"]):
                    probs.append(f"tras una mala: {r}")
                if not w or r["w"] != w["w"] or not r["ipa"].strip() or w["w"] not in r["live"]:
                    probs.append(f"el bueno no enseña su palabra ({w}): {r}")
                C.shot(page, "cuento-pregunta-mal", OUT, full_page=False)
            elif qi == 1:   # con la tecla
                page.keyboard.press(str(q["ok"] + 1))
                CU._wait_state(page, "!!s.quiz && s.quiz.pick !== null")
            else:
                CU._quiz(page, st)
            st2 = CU._state(page)
            if st2["quiz"]["pick"] != (bad if qi == 0 else q["ok"]):
                probs.append(f"pregunta {qi + 1}: contestó {st2['quiz']['pick']}")
            try:
                page.wait_for_function("([w, n0]) => __spoken.slice(n0[0]).some(x => x.text.toLowerCase() === w) || __played.length > n0[1]",
                                       arg=[w["w"], list(n0)], timeout=3000)
            except Exception:
                probs.append(f"pregunta {qi + 1}: no suena la palabra del bueno «{w['w']}»")
            id_ = page.evaluate("w => clipFor(w)", w["w"])
            if id_ and not any(x["src"].endswith(f"/audio/en/{id_}.mp3") for x in page.evaluate("n => __played.slice(n)", n0[1])):
                probs.append(f"pregunta {qi + 1}: «{w['w']}» no suena con su mp3")
            ui = page.evaluate("() => ({next: !document.getElementById('st-next').hidden, txt: (document.getElementById('st-txt') || {}).textContent || ''})")
            if not ui["next"] or " ".join(ui["txt"].split()) != want[qi]["t"]:
                probs.append(f"pregunta {qi + 1} contestada: {ui}")
            p0 = st["p"]
            page.locator("#st-next").click()
            CU._wait_state(page, f"s.p > {p0} || s.fin", 4000)
        if not CU._state(page)["fin"]:
            probs.append(f"tras las 3 preguntas no acaba: {CU._state(page)['kind']}")
        try:
            page.wait_for_function("() => window.__aw.length > 0", timeout=4000)   # award() sale 450 ms después del final
        except Exception:
            pass
        page.wait_for_timeout(600)
        aw = page.evaluate("() => window.__aw")
        if len(aw) != 1 or aw[0][0] != 10:
            probs.append(f"las monedas al acabar: {aw}")
        probs += C.errors(page)
    finally:
        page.context.close()
    # «Leer solo» y sus 3 preguntas: los dibujos en otro orden (el bueno no siempre el primero)
    oks += _auto_read(probs)
    if len(oks) >= 6 and all(o == 0 for o in oks):
        probs.append(f"los dibujos de las preguntas no se barajan: el bueno siempre el primero {oks}")
    assert not probs, "\n".join(probs)


def _auto_read(probs):
    """«Leer solo»: pasa sola de página tras leerla, se para en la de elegir y en una pregunta sin contestar; al contestar,
    sigue. El interruptor se guarda en vocab:ui (talesAuto). Devuelve el bueno de cada pregunta."""
    oks = []
    page = C.new_page("phone")
    cfg = json.dumps({"voices": CU.VOICES, "boundary": False, "ms": 25}, ensure_ascii=False)
    page.context.add_init_script(f"{CU._TTS}({cfg})")
    page.context.add_init_script(CU._MEDIA)

    def run(ms, until=None):
        for _ in range(ms // 250):
            page.clock.run_for(250)
            page.wait_for_timeout(30)
            if until and page.evaluate(f"() => {{ const s = vocabStories.state(); return !!s && ({until}); }}"):
                return True
        return False
    try:
        CU._open(page, "#/cuento/en-play")
        page.locator("#st-auto").click()
        if page.locator("#st-auto").get_attribute("aria-pressed") != "true" or not page.evaluate("() => JSON.parse(localStorage.getItem('vocab:ui') || '{}').talesAuto === true"):
            probs.append("«Leer solo» no se enciende o no se guarda en vocab:ui")
        if not run(60000, "s.kind === 'choice'"):
            probs.append(f"«Leer solo» no llega sola a la de elegir: {CU._state(page)}")
        p = CU._state(page)["p"]
        run(5000)
        if CU._state(page)["p"] != p:
            probs.append("«Leer solo» pasa la página de elegir")
        page.locator(".st-opt[data-k='dog']").click()
        if not run(60000, "s.kind === 'quiz'"):
            probs.append(f"«Leer solo» no llega a las preguntas: {CU._state(page)}")
        for qi in range(3):
            st = CU._state(page)
            if st["kind"] != "quiz":
                probs.append(f"«Leer solo»: se esperaba la pregunta {qi + 1}, {st['kind']}")
                break
            oks.append(st["quiz"]["ok"])
            run(4000)
            if CU._state(page)["p"] != st["p"]:
                probs.append(f"«Leer solo» pasa una pregunta sin contestar ({qi + 1})")
            if qi == 0:
                C.shot(page, "cuento-pregunta-leer-solo", OUT, full_page=False)
            CU._quiz(page, st)
            if not run(6000, f"s.p > {st['p']} || s.fin"):
                probs.append(f"«Leer solo» no sigue tras contestar la pregunta {qi + 1}")
        if not CU._state(page)["fin"]:
            probs.append("«Leer solo» no acaba el cuento")
        probs += [f"leer solo: {x}" for x in C.errors(page)]
    finally:
        page.context.close()
    return oks


# ---------------------------------------------------------------- 7. el loro y el cazador
def test_parrot_card_opens_games_topic():
    """La tarjeta «Loro eco» de Juegos abre #/loro?t=<el tema de Juegos> (aquí Comida, w03): las palabras del loro son de
    ese tema, la pestaña es Jugar y ‹ vuelve a Juegos."""
    probs = []
    page = LO._page()
    try:
        k = dict(C.seed_keys())
        k["games:topic"] = json.dumps("w03")
        LO._seed(page, hash="#/juegos", keys=k)
        page.wait_for_selector('.gm-card[data-g="loro"]', timeout=8000)
        page.locator('.gm-card[data-g="loro"]').click()
        page.wait_for_function("() => vocabParrot.state.ref", timeout=10000)
        page.wait_for_timeout(300)
        r = page.evaluate("""() => ({h: location.hash, ref: vocabParrot.state.ref, tab: document.documentElement.dataset.tab,
          back: (document.getElementById('dv-back') || {getAttribute: () => null}).getAttribute('href')})""")
        if r["h"] != "#/loro?t=w03" or not r["ref"].startswith("w03|") or r["tab"] != "jugar" or r["back"] != "#/juegos":
            probs.append(f"el loro desde Juegos: {r}")
        C.shot(page, "loro-tema", OUT, full_page=False)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_hunter_tap_mode_listens_first():
    """«Jugar tocando» del cazador: primero se escucha (el altavoz grande, «Escucha y toca lo que es de ese color.», sin
    la palabra escrita ni la muestra) y suena el color; al acertar, la palabra con su IPA."""
    probs = []
    page = HN._page()
    try:
        HN._open(page)
        page.locator("#hn-tap0").click()
        page.wait_for_selector(".hn-opt", timeout=5000)
        page.wait_for_timeout(400)
        c = HN._st(page)["color"]
        w = HN.WORD["english"][c]
        r = page.evaluate("""() => { const a = document.getElementById('hn-ask');
          return {listen: !!a && a.classList.contains('is-listen'), t: a ? a.textContent.replace(/\\s+/g, ' ').trim() : '', q: !!document.getElementById('hn-q'),
            big: !!document.querySelector('#hn-ask .hn-big#hn-say'), sw: !!document.querySelector('#hn-ask .hn-sw')}; }""")
        if not r["listen"] or r["q"] or r["sw"] or not r["big"] or "Escucha y toca lo que es de ese color." not in r["t"]:
            probs.append(f"tocando, primero escuchar: {r}")
        if re.search(rf"\b{re.escape(w)}\b", r["t"], re.I):
            probs.append(f"la palabra «{w}» ya está escrita: {r['t']!r}")
        try:
            page.wait_for_function("w => __spoken.some(x => x.text.toLowerCase().includes(w)) || __played.length > 0", arg=w, timeout=4000)
        except Exception:
            probs.append("no suena el color")
        C.shot(page, "cazador-escucha", OUT, full_page=False)
        page.locator(f'.hn-opt[data-c="{c}"]').click()
        page.wait_for_timeout(500)
        r = page.evaluate("""() => ({w: (document.querySelector('#hn-ask .hn-wt b') || {}).textContent || '', ipa: (document.querySelector('#hn-ask .ipa') || {}).textContent || '',
          got: (document.getElementById('hn-got') || {}).textContent || ''})""")
        if r["w"] != w or not r["ipa"].strip() or "¡Muy bien!" not in r["got"]:
            probs.append(f"tras acertar: {r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 8. «El zorro dice»
def _zd(page):
    return page.evaluate(_ZD)


def _zd_round(page, ri, timeout=10000):
    page.wait_for_function(f"() => {{ const r = document.getElementById('zd'), s = r && r.zdState && r.zdState(); return !!s && s.ri === {ri} && !s.over; }}", timeout=timeout)
    return _zd(page)


def _zd_tap(page, k):
    page.locator(f"#zd-grid .zd-c[data-k='{k}']").click()


def _zd_hidden(page, s):
    """Antes de contestar: nada escrito en el idioma (ni la palabra ni su IPA)."""
    r = page.evaluate("""() => ({w: [...document.querySelectorAll('#zd-grid .zd-w')].map(e => e.textContent).join(''),
      lang: document.querySelectorAll('#zd-grid [lang], #zd-txt [lang]').length, txt: document.getElementById('zd-txt').textContent,
      ipa: document.querySelectorAll('#zd .ipa').length})""")
    words = [s["cards"][t]["word"] for t in s["targets"]]
    bad = [w for w in words if re.search(rf"(?<!\w){re.escape(w)}(?!\w)", r["txt"], re.I)]
    return [] if not (r["w"] or r["lang"] or r["ipa"] or bad) else [f"ronda {s['ri'] + 1}: se ve escrito antes de contestar {r} {bad}"]


def _zd_parts(L, s):
    """Lo que debe decir el zorro en esta ronda."""
    c = s["cards"]
    t = [c[i] for i in s["targets"]]
    p = s["parts"]
    out = []
    if s["lv"] == 1:
        if len(p) != 2 or p[1] != t[0]["word"] or p[0] not in (FRAME[L], "Touch"):
            out.append(f"nivel 1: {p} / {t}")
    elif s["lv"] == 2:
        if len(t) != 2 or len(p) != 4 or p[1] != t[0]["word"] or p[3] != t[1]["word"] or p[0] not in (FRAME[L], "Touch") or p[2] not in (AND[L], "and"):
            out.append(f"nivel 2: {p} / {t}")
    else:
        cols = {x["col"] for x in c}
        items = {x["word"] for x in c}
        if len(t) != 1 or len(cols) != 2 or len(items) != 2 or "" in cols:
            out.append(f"nivel 3: dibujos {c}")
        if L == "english":
            ok = len(p) == 3 and p[0] in (FRAME[L], "Touch") and p[1] in COLW[L] and p[2] == t[0]["word"]
        elif L == "français":
            ok = len(p) == 3 and p[0] == FRAME[L] and p[1] == t[0]["word"] and p[2] in COLW[L]
        else:
            ok = len(p) == 4 and p[0] == FRAME[L] and p[1] == t[0]["word"] and p[1].startswith("en ") and p[2] == "der er" and p[3] in COLW[L]
        if not ok:
            out.append(f"nivel 3 en {L}: {p} / {t}")
    return out


def _zd_play(page, L, probs, shots=None):
    """Juega las 9 rondas: en la primera, una mala; en la primera de dos, al revés; el resto bien. Devuelve el estado."""
    plan = None
    for ri in range(9):
        s = _zd_round(page, ri)
        plan = s["plan"]
        probs += [f"{L}: {x}" for x in _zd_parts(L, s)]
        probs += [f"{L}: {x}" for x in _zd_hidden(page, s)]
        if s["lv"] != plan[ri]:
            probs.append(f"{L}: ronda {ri + 1} es del nivel {s['lv']} (plan {plan})")
        t = s["targets"]
        if ri == 0:
            try:
                page.wait_for_function("p => !document.getElementById('zd-say').classList.contains('playing') && __spoken.length + __played.length >= p.length", arg=s["parts"], timeout=8000)
            except Exception:
                pass
            for part in s["parts"]:
                if not _heard(page, part):
                    probs.append(f"{L}: no suena «{part}» ({s['parts']})")
            if s["cards"][t[0]]["clip"] and not page.evaluate("() => __played.length"):
                probs.append(f"{L}: la palabra con audio no suena con su mp3")
            if shots:
                shots("zorro-dice-escucha")
            n0 = _counts(page)
            bad = next(k for k in range(4) if k not in t)
            _zd_tap(page, bad)
            page.wait_for_timeout(250)
            r = page.evaluate("""k => { const b = document.querySelector(`#zd-grid .zd-c[data-k='${k}']`), m = b.querySelector('.zd-mk');
              return {cls: b.className, mk: getComputedStyle(m).backgroundColor, x: getComputedStyle(m.querySelector('.x')).display, dis: b.disabled,
                hint: document.querySelectorAll('#zd-grid .zd-c.is-hint').length, hk: [...document.querySelectorAll('#zd-grid .zd-c')].findIndex(c => c.classList.contains('is-hint'))}; }""", bad)
            if "is-miss" not in r["cls"] or not _GRAY(r["mk"]) or r["x"] == "none" or not r["dis"] or r["hk"] != t[0]:
                probs.append(f"{L}: tras una mala {r} (buena {t[0]})")
            page.wait_for_timeout(300)
            if not _heard(page, s["parts"][1], n0):
                probs.append(f"{L}: tras una mala no suena la buena «{s['parts'][1]}»")
            if shots:
                shots("zorro-dice-mal")
            _zd_tap(page, t[0])
        elif s["lv"] == 2 and plan.index(2) == ri:
            _zd_tap(page, t[1])
            page.wait_for_timeout(150)
            r = page.evaluate("t => [...document.querySelectorAll('#zd-grid .zd-c')].map(c => [c.className, c.querySelector('.zd-n').textContent])", t)
            if "is-miss" not in r[t[1]][0] or "is-hint" not in r[t[0]][0]:
                probs.append(f"{L}: el segundo antes que el primero: {r}")
            page.clock.run_for(1200)
            page.wait_for_timeout(50)
            if "is-miss" in page.evaluate("k => document.querySelector(`#zd-grid .zd-c[data-k='${k}']`).className", t[1]):
                probs.append(f"{L}: el segundo sigue gris aunque hace falta después")
            _zd_tap(page, t[0])
            _zd_tap(page, t[1])
            r = page.evaluate("t => t.map(k => { const c = document.querySelector(`#zd-grid .zd-c[data-k='${k}']`); return [c.classList.contains('is-ok'), c.querySelector('.zd-n').textContent]; })", t)
            if r != [[True, "1"], [True, "2"]]:
                probs.append(f"{L}: el orden 1 y 2: {r}")
        else:
            for k in t:
                _zd_tap(page, k)
        page.wait_for_timeout(120)
        s2 = _zd(page)
        if not s2["over"]:
            probs.append(f"{L}: ronda {ri + 1} no se acaba al tocar los buenos: {s2}")
        r = page.evaluate("""t => ({w: t.map(k => { const e = document.querySelector(`#zd-grid .zd-c[data-k='${k}'] .zd-w`); return [e.textContent, !!e.querySelector('[lang]'), !!e.querySelector('.ipa')]; }),
          s: (document.querySelector('#zd-txt .zd-s') || {}).textContent || '', es: (document.querySelector('#zd-txt [lang=es]') || {}).textContent || ''})""", t)
        for k, (txt, has_lang, has_ipa) in zip(t, r["w"]):
            word = s["cards"][k]["word"]
            if word not in txt or not has_lang or (s["lv"] < 3 and not has_ipa):
                probs.append(f"{L}: ronda {ri + 1}, el bueno no enseña «{word}» con su IPA: {r['w']}")
        if not all(s["cards"][k]["word"] in r["s"] for k in t) or not r["es"]:
            probs.append(f"{L}: ronda {ri + 1}, el bocadillo: {r}")
        if shots and s["lv"] == 3 and ri == plan.index(3):
            shots("zorro-dice-color")
        page.clock.run_for(2700)
    page.wait_for_selector("#gm-end", timeout=10000)
    return plan


def test_fox_says_three_levels_three_languages():
    """«El zorro dice» (Juegos › Palabras, tema Animales): 9 rondas, 3 de cada nivel. El zorro dice «Touch the» / «Touche» /
    «Find» con la voz y la palabra con su mp3; nada escrito hasta contestar. Nivel 2: dos en orden («and the» / «et» /
    «og»; tocar primero el segundo: gris un momento, late el primero). Nivel 3: 2 cosas en 2 colores y «Touch the red
    dog», «Touche le chien rouge», «Find en hund, der er rød». Mal: gris con ✗ y suena el bueno; bien: ✓ y la palabra
    con IPA y el español. Al final, el resultado."""
    probs = []
    for L in ("english", "français", "dansk"):
        page = _gpage()
        try:
            _game(page, "zorrodice", L)
            plan = _zd_play(page, L, probs)
            if plan != [1, 1, 1, 2, 2, 2, 3, 3, 3]:
                probs.append(f"{L}: el plan de niveles es {plan}")
            end = page.evaluate("() => document.getElementById('gm-end').textContent.replace(/\\s+/g, ' ')")
            if "7 de 9" not in end:
                probs.append(f"{L}: el resultado (7 a la primera) {end[:200]!r}")
            probs += [f"{L}: {x}" for x in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_fox_says_fits_phones():
    """En 360×740 y 390×844 los 4 dibujos caben sin scroll, ≥ 120 px, y nada se sale de lado, también al contestar y en
    el nivel 3."""
    probs = []
    for w, h in ((360, 740), (390, 844)):
        page = _gpage(viewport={"width": w, "height": h})
        try:
            _game(page, "zorrodice", "english")
            for ri in (0, 6):
                s = _zd_round(page, ri)
                page.wait_for_timeout(350)
                g = page.evaluate("""() => { const cs = [...document.querySelectorAll('#zd-grid .zd-c')].map(c => c.getBoundingClientRect());
                  const d = document.getElementById('gm-dots').getBoundingClientRect();
                  return {min: Math.min(...cs.map(r => Math.min(r.width, r.height))), bottom: Math.max(...cs.map(r => r.bottom)), right: Math.max(...cs.map(r => r.right)),
                    left: Math.min(...cs.map(r => r.left)), dots: d.bottom, ih: innerHeight, iw: innerWidth, sy: scrollY, sh: document.documentElement.scrollHeight}; }""")
                if g["min"] < 120 or g["bottom"] > g["ih"] or g["right"] > g["iw"] or g["left"] < 0 or g["dots"] > g["ih"] + 1 or g["sh"] > g["ih"] + 1:
                    probs.append(f"{w}×{h} ronda {ri + 1}: {g}")
                if _hscroll(page):
                    probs.append(f"{w}×{h}: se sale de lado")
                if ri == 0:
                    for k in s["targets"]:
                        _zd_tap(page, k)
                    page.wait_for_timeout(150)
                    if page.evaluate("() => document.documentElement.scrollHeight") > h + 1:
                        probs.append(f"{w}×{h}: al contestar, la página baja")
                    page.clock.run_for(2700)
                    for r2 in range(1, 6):
                        s2 = _zd_round(page, r2)
                        for k in s2["targets"]:
                            _zd_tap(page, k)
                        page.clock.run_for(2700)
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 9. «Rap del zorro»
def _rap_open(page, L="english", rounds=None):
    _game(page, "rap", L)
    page.wait_for_function("() => { const r = document.getElementById('rp'); return r && r.rap && r.rap().ready; }", timeout=15000)
    if rounds:
        page.evaluate("n => { window.__rapRounds = n; }", rounds)
    return page.evaluate(_RP)


def _rap_order(L, rd):
    """Las palabras que suenan en los compases del zorro, en orden."""
    out = []
    for r in rd:
        a = r["a"]
        if r["lv"] == 1:
            out += [a[0], a[0]]
        elif r["lv"] == 2:
            out += [a[0], a[1]]
        else:
            x, y = (r["col"], a[0]) if L == "english" else (a[0], r["col"])
            out += [x, y, x, y]
    return out


def test_fox_rap_on_the_beat():
    """«Rap del zorro» (Juegos › Palabras, tema Animales): 8 palabras con dibujo y mp3 (descodificados antes de empezar);
    el AudioContext nace dentro del toque de «¡Empezar el rap!» y toda la canción se programa en su reloj: cada palabra
    justo en un pulso (84, 90 y 96 por minuto). Rondas: 4 de una palabra, 2 de dos alternas y 2 de color + palabra
    («red cat» en inglés, «le chat rouge» en francés); en danés, la tercera parte es otra vez de dos palabras."""
    probs = []
    for L in ("english", "français", "dansk"):
        page = _gpage()
        try:
            st = _rap_open(page, L)
            if len(st["words"]) != 8 or not all(page.evaluate("w => !!clipFor(w)", w) for w in st["words"]):
                probs.append(f"{L}: las palabras {st['words']} (8, todas con mp3)")
            if page.evaluate("() => window.__acs.length"):
                probs.append(f"{L}: el AudioContext nace antes del toque")
            if L != "dansk" and len(st["c3"]) != 2:
                probs.append(f"{L}: el nivel 3 no tiene dos parejas de color: {st['c3']}")
            if L == "english":
                C.shot(page, "rap-listo-390", OUT, full_page=False)
            page.locator("#rp-go").click()
            page.wait_for_function("() => document.getElementById('rp').rap().started", timeout=5000)
            st = page.evaluate(_RP)
            acs = page.evaluate("() => window.__acs")
            if len(acs) != 1 or not acs[0]["active"] or st["state"] not in ("running", "suspended"):
                probs.append(f"{L}: el AudioContext {acs} {st['state']}")
            rd = st["rounds"]
            if [r["st"] for r in rd] != [1, 1, 1, 1, 2, 2, 3, 3] or [r["lv"] for r in rd][:6] != [1, 1, 1, 1, 2, 2]:
                probs.append(f"{L}: las rondas {rd}")
            want3 = 2 if L == "dansk" else 3
            if [r["lv"] for r in rd][6:] != [want3, want3]:
                probs.append(f"{L}: la tercera parte es del nivel {[r['lv'] for r in rd][6:]} (se esperaba {want3})")
            beats = st["beats"]
            off = [e for e in st["ev"] if not any(abs(e["t"] - b) < 1e-6 for b in beats)]
            if off or len(st["ev"]) != len(_rap_order(L, rd)):
                probs.append(f"{L}: palabras fuera del pulso {off[:3]} ({len(st['ev'])} programadas)")
            got = [e["w"] for e in st["ev"]]
            if got != _rap_order(L, rd):
                probs.append(f"{L}: el orden de lo que suena {got} (se esperaba {_rap_order(L, rd)})")
            if any(e["rate"] > 1.25 or e["rate"] < 1 or e["lead"] < 0 for e in st["ev"]):
                probs.append(f"{L}: velocidad o silencio de delante raros {[(e['w'], e['rate'], e['lead']) for e in st['ev']]}")
            gaps = sorted({round(b2 - b1, 4) for b1, b2 in zip(beats, beats[1:])})
            if not gaps or abs(gaps[0] - 60 / 96) > 1e-3 or abs(gaps[-1] - 60 / 84) > 1e-3:
                probs.append(f"{L}: los pulsos {gaps}")
            if any(c not in COLW[L] for c in (r["col"] for r in rd if r["lv"] == 3)):
                probs.append(f"{L}: colores {[r['col'] for r in rd]}")
            page.wait_for_timeout(1800)
            if L == "english":
                C.shot(page, "rap-sonando-390", OUT, full_page=False)
            C.goto(page, "#/juegos")
            page.wait_for_timeout(200)
            probs += [f"{L}: {x}" for x in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_fox_rap_join_by_tap_and_by_mic():
    """Una ronda (window.__rapRounds = 1): tocar el escenario justo en el primer «¡Tú!» se une al rap («tap»); con el
    micrófono encendido (de mentira: un tono), cantar en el segundo «¡Tú!» también («mic»). Nunca se falla: al acabar,
    el resultado con estrellas y «¡Rapeaste con el zorro 2 de 2 veces!». 360×740 sin scroll."""
    probs = []
    page = _gpage(mic=True, viewport={"width": 360, "height": 740})
    try:
        _rap_open(page, "english", rounds=1)
        if not page.locator("#rp-mic").is_visible():
            probs.append("no sale el botón del micrófono")
        page.locator("#rp-mic").click()
        page.wait_for_function("() => document.getElementById('rp').rap().mic", timeout=5000)
        if page.locator("#rp-mic").get_attribute("aria-pressed") != "true" or not page.locator("#rp-meter").is_visible():
            probs.append("el micrófono no se enciende (aria-pressed y el medidor)")
        page.locator("#rp-go").click()
        page.wait_for_function("() => document.getElementById('rp').rap().started", timeout=5000)
        st = page.evaluate(_RP)
        if len(st["slots"]) != 2:
            probs.append(f"una ronda con {len(st['slots'])} «¡Tú!»")
        g = page.evaluate("""() => { const s = document.getElementById('rp-stage').getBoundingClientRect(), c = document.querySelector('.rp-ctl').getBoundingClientRect(),
          t = document.getElementById('rp-tip').getBoundingClientRect(); return {stage: [s.top, s.bottom], ctl: c.bottom, tip: t.bottom, ih: innerHeight, sh: document.documentElement.scrollHeight}; }""")
        if g["sh"] > g["ih"] + 1 or g["stage"][1] > g["ih"]:
            probs.append(f"360×740: el rap no cabe {g}")
        s0 = page.evaluate(_RP_TAP, 0)
        if not s0["joined"] or s0["how"] != "tap":
            probs.append(f"tocar a tiempo no se une: {s0}")
        C.shot(page, "rap-tu-360", OUT, full_page=False)
        s1 = page.evaluate(_RP_SING, 1)
        if not s1["joined"] or s1["how"] != "mic":
            probs.append(f"cantar con el micrófono no se une: {s1}")
        page.wait_for_selector("#gm-end", timeout=15000)
        end = page.evaluate("() => document.getElementById('gm-end').textContent.replace(/\\s+/g, ' ')")
        if "Rapeaste con el zorro 2 de 2 veces" not in end:
            probs.append(f"el final: {end[:200]!r}")
        if not page.evaluate("() => window.__micStream.getTracks().every(t => t.readyState === 'ended')"):
            probs.append("el micrófono sigue encendido al acabar")
        best = page.evaluate("() => (JSON.parse(localStorage.getItem('games:best') || '{}')).rap || null")
        if not best or best.get("stars") != 3:
            probs.append(f"el récord del rap: {best}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- 10. capturas
def test_captures_audit_three_configs():
    """Capturas en capturas/hablar: «El zorro dice», «Rap del zorro», una pregunta de «¿Te acuerdas?», #/llamadas, el
    loro con tema, el cazador escuchando y «Dilo conmigo», en 360 claro, 390 oscuro con «Reducir movimiento» y
    escritorio 1280; con contraste suficiente, sin colores fuera de la paleta (morado, rosa, naranja) y sin fallos de
    accesibilidad. Las tarjetas nuevas de Juegos con su dibujo de 220 × 220."""
    probs = []
    for kind, w, scheme in (("phone", 360, "light"), ("phone", 390, "dark"), ("desk", 1280, "light")):
        tag = f"{kind}-{w}-{scheme}"
        kw = {"color_scheme": scheme, "reduced_motion": "reduce" if scheme == "dark" else "no-preference"}
        if kind == "phone":
            kw["viewport"] = {"width": w, "height": 740 if w == 360 else 844}
        # los juegos
        page = _gpage(kind, **kw)
        try:
            C.seed(page, _gkeys("english"), "#/juegos")
            page.wait_for_selector('.gm-card[data-g="rap"]', timeout=8000)
            cards = page.evaluate("""async () => { const out = {};
              for (const g of ['rap', 'zorrodice', 'llamar', 'loro']) { const a = document.querySelector(`.gm-card[data-g="${g}"]`), i = a && a.querySelector('img');
                if (i && !i.complete) await new Promise(f => { i.onload = i.onerror = f; });
                out[g] = a ? {sec: a.closest('[data-sec]').dataset.sec, w: i ? i.naturalWidth : 0, h: i ? i.naturalHeight : 0} : null; }
              return out; }""")
            want = {"rap": "palabras", "zorrodice": "palabras", "llamar": "mas", "loro": "mas"}
            for g, sec in want.items():
                c = cards.get(g)
                if not c or c["sec"] != sec or (g != "loro" and (c["w"], c["h"]) != (220, 220)):
                    probs.append(f"{tag}: la tarjeta {g}: {c}")
            page.evaluate("() => document.querySelector('.gm-card[data-g=\"zorrodice\"]').scrollIntoView({block: 'center'})")
            _audit(page, f"{tag}-juegos", ("gm-card",), probs, a11y=False)
            C.shot(page, f"{tag}-juegos", OUT, full_page=False)
            _game(page, "zorrodice", "english")
            s = _zd_round(page, 0)
            page.wait_for_timeout(500)
            _audit(page, f"{tag}-zorro-dice", ("zd-",), probs)
            C.shot(page, f"{tag}-zorro-dice", OUT, full_page=False)
            for k in s["targets"]:
                _zd_tap(page, k)
            page.wait_for_timeout(300)
            _audit(page, f"{tag}-zorro-dice-bien", ("zd-",), probs)
            C.shot(page, f"{tag}-zorro-dice-bien", OUT, full_page=False)
            _rap_open(page, "english")
            _audit(page, f"{tag}-rap", ("rp-",), probs)
            C.shot(page, f"{tag}-rap", OUT, full_page=False)
            page.locator("#rp-go").click()
            page.wait_for_function("() => { const s = document.getElementById('rp').rap(); return s.started && s.slots.length > 0 && s.now - s.lat > s.slots[0].t + .05; }", timeout=20000)
            _audit(page, f"{tag}-rap-tu", ("rp-",), probs)
            C.shot(page, f"{tag}-rap-tu", OUT, full_page=False)
            C.goto(page, "#/juegos")
            probs += [f"{tag}: {x}" for x in C.errors(page)]
        finally:
            page.context.close()
        # la pregunta del cuento
        page = CU._page(kind, **kw)
        try:
            CU._open(page, "#/cuento/en-play")
            st = _to_kind(page, "quiz")
            page.wait_for_timeout(400)
            _audit(page, f"{tag}-pregunta", ("st-q", "st-auto", "st-pick"), probs)
            C.shot(page, f"{tag}-pregunta", OUT, full_page=False)
            CU._quiz(page, st, right=False)
            page.wait_for_timeout(300)
            _audit(page, f"{tag}-pregunta-mal", ("st-q",), probs)
            C.shot(page, f"{tag}-pregunta-mal", OUT, full_page=False)
            probs += [f"{tag}: {x}" for x in C.errors(page)]
        finally:
            page.context.close()
        # las llamadas
        page = CL._page(kind, **kw)
        try:
            old = CL._day(C.FIXED_NOW, -9)
            CL._seed(page, CL._keys(calls={"v": 1, "h": {i: old for i in OLD4}, "heard": {"en-rain": old}}), hash="#/llamadas", armed=False)
            page.wait_for_selector("#cl-list .cl-li", timeout=8000)
            _audit(page, f"{tag}-llamadas", ("cl-l",), probs)
            C.shot(page, f"{tag}-llamadas", OUT, full_page=False)
            page.locator("#cl-list .cl-li[data-id='en-zoo']").click()
            page.wait_for_function("() => vocabCalls.current && vocabCalls.current.mode === 'talk'", timeout=4000)
            cur = CL._to_wait(page)
            CL._pick(page, CL._okj(cur))
            if _echo(page):
                _audit(page, f"{tag}-dilo", ("cl-echo", "cl-mouth", "cl-say"), probs)
                C.shot(page, f"{tag}-dilo", OUT, full_page=False)
            else:
                probs.append(f"{tag}: no sale «Dilo conmigo»")
            probs += [f"{tag}: {x}" for x in C.errors(page)]
        finally:
            page.context.close()
        # el loro y el cazador
        page = LO._page(kind, **kw)
        try:
            k = dict(C.seed_keys())
            k["games:topic"] = json.dumps("w03")
            LO._seed(page, hash="#/loro?t=w03", keys=k)
            page.wait_for_function("() => vocabParrot.state.ref", timeout=10000)
            _audit(page, f"{tag}-loro", ("lr-",), probs)
            C.shot(page, f"{tag}-loro", OUT, full_page=False)
            probs += [f"{tag}: {x}" for x in C.errors(page)]
        finally:
            page.context.close()
        page = HN._page(kind, **kw)
        try:
            HN._open(page)
            page.locator("#hn-tap0").click()
            page.wait_for_selector("#hn-ask.is-listen", timeout=5000)
            page.wait_for_timeout(300)
            _audit(page, f"{tag}-cazador", ("hn-",), probs)
            C.shot(page, f"{tag}-cazador", OUT, full_page=False)
            probs += [f"{tag}: {x}" for x in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)
