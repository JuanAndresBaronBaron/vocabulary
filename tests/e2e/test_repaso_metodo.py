"""Repaso con método (metodo.md): js/review.js y el repaso espaciado de index.html.
· Datos: ningún tema repite su español en un idioma (el repaso guarda «tema|español»); nacionalidades dice la
  nacionalidad («español, española»), no el país; lo guardado con el español de antes pasa al nuevo al arrancar, una vez.
· El calendario: cajas IV = [0, 1, 3, 7, 14, 30, 60, 120]; 2 sube una caja, 1 se queda con su intervalo y dos «1»
  seguidos suben una, 0 baja dos; lo que puntúa el niño solo no pasa de la caja 3 si lo anterior también fue suyo; dominada
  (caja 6) solo con un recuerdo bien, comprobado por la app, a los 30 días o más, con bus "mastered" una sola vez; el
  ajuste por niño (rv:stat: ×1,3 con más del 95 % bien, ×0,7 con menos del 75 %).
· En memoria: srsAll(), store.get y la copia de la partida leen el mismo mapa; se escribe una vez 250 ms después y al
  esconder o cerrar la app.
· Repasos de 20 como mucho, primero los que más esperan y de caja más baja, con «Otra tanda (N más)» al final.
· La app corrige: caja 0 «Escucha y elige», caja 1 «¿Cuál es en inglés?», cajas 2-3 las letras, caja 4 o más la
  tarjeta; 2 a la primera, 1 con pista o a la segunda, 0 mal (gris con ✗, la respuesta entera a la vez y «Seguir»; vuelve
  3 a 5 tarjetas después, una vez). Monedas = la nota.
· Lo que ya no existe se quita del repaso; sin conexión, «Sin conexión» y lo que no se puede abrir no cuenta.
Capturas en <VOCAB_CAPTURAS>/repaso (360, 390 y 1280 px, oscuro y reducir movimiento)."""
from __future__ import annotations

import collections
import json
import re

import common as C

CAPS = C.CAPTURAS / "repaso"
_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""
T = C.day_num(C.FIXED_NOW)
_ST = "() => window.vocabReview ? vocabReview.state : undefined"
_SRS = "() => { srsFlush(); return JSON.parse(localStorage.getItem('srs:' + lang) || '{}'); }"
# apunta las monedas, los sonidos, las vibraciones, lo que se dice y los avisos del bus
_SPY = """() => { if (window.__spy) return; window.__spy = 1;
  window.__aw = []; window.__sfx = []; window.__hap = []; window.__said = []; window.__cards = []; window.__mast = [];
  const a0 = window.award; window.award = function(n, why, quiet){ window.__aw.push([n, why, !!quiet]); return a0.apply(this, arguments); };
  const p0 = sfx.play; sfx.play = function(n){ window.__sfx.push(n); return p0.apply(this, arguments); };
  if (window.G && G.haptic) { const h0 = G.haptic; G.haptic = function(k){ window.__hap.push(k); return h0.apply(this, arguments); }; }
  const s0 = window.sayP; window.sayP = function(t){ window.__said.push(t); return s0.apply(this, arguments); };
  bus.on('review-card', d => window.__cards.push(d)); bus.on('mastered', d => window.__mast.push(d)); }"""
_ROWS = [r for r in json.loads((C.REPO / "data" / "animales.json").read_text(encoding="utf-8"))["rows"] if r.get("es")]
_WORD = {r["es"]: r["l"]["english"]["word"] for r in _ROWS}


def _ent(es, b, due, doc="animales", **kw):
    return {f"{doc}|{es}": dict(d=doc, e=es, b=b, due=due, n=3, **kw)}


def _keys(*parts, lang="english"):
    """La partida de ejemplo con srs:<lang> hecho de las entradas dadas (y nada más pendiente)."""
    keys, m = C.seed_keys(), {}
    for p in parts:
        m.update(p)
    keys["srs:" + lang] = C._dumps(m)
    return keys


def _fillers(n, skip=(), b=4, due=T):
    out, k = {}, 0
    for r in _ROWS:
        if k >= n:
            break
        if r["es"] in skip or not r.get("img"):
            continue
        out.update(_ent(r["es"], b, due))
        k += 1
    return out


def _open(page, keys):
    C.seed(page, keys=keys, hash="#/repaso")
    page.wait_for_selector("#rv-card", timeout=10000)
    page.evaluate(_SPY)


def _wait_i(page, i, timeout=6000):
    page.wait_for_function("i => { const s = window.vocabReview && vocabReview.state; return !!s && (s.i >= i || s.end); }", arg=i, timeout=timeout)


def _wait_graded(page):
    page.wait_for_function("() => { const s = vocabReview.state; return !!s && s.graded; }", timeout=4000)


def _type(page, letters):
    for ch in letters:
        page.keyboard.press(ch)
        page.wait_for_timeout(40)


def _flip_yes(page):
    """La tarjeta de siempre: Espacio la gira y → es «¡Sí!»."""
    page.evaluate("() => document.activeElement && document.activeElement.blur()")
    page.keyboard.press("Space")
    page.wait_for_selector("#rv-card.is-flipped", timeout=4000)
    page.keyboard.press("ArrowRight")


def _right_pick(page):
    st = page.evaluate(_ST)
    page.keyboard.press(str(st["right"] + 1))


def _answer_right(page):
    """Contesta bien la tarjeta que haya, sea del tipo que sea."""
    st = page.evaluate(_ST)
    if st["kind"] == "card":
        _flip_yes(page)
    elif st["kind"] == "spell":
        _type(page, st["letters"])
    else:
        _right_pick(page)
    return st


def _errors(page, *allow):
    return [e for e in C.errors(page) if not any(a in e for a in allow)]


def _grey(rgb):
    v = [float(x) for x in re.findall(r"[\d.]+", rgb)[:3]]
    return len(v) == 3 and max(v) - min(v) <= 24


# ---------------------------------------------------------------- datos
def test_data_unique_spanish_per_topic():
    """En cada tema y cada idioma, el español de cada fila es único (el repaso, el álbum y las frases guardan
    «tema|español»: dos filas iguales serían una sola). Nacionalidades dice la nacionalidad, no el país."""
    probs = []
    for p in sorted((C.REPO / "data").glob("*.json")):
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            continue
        if not isinstance(d, dict) or not isinstance(d.get("rows"), list):
            continue
        for L in ("english", "français", "dansk"):
            c = collections.Counter(r["es"] for r in d["rows"] if isinstance(r, dict) and r.get("es") and (r.get("l") or {}).get(L))
            probs += [f"{p.name} {L}: «{k}» ×{v}" for k, v in c.items() if v > 1]
    rows = lambda n: [r for r in json.loads((C.REPO / "data" / f"{n}.json").read_text(encoding="utf-8"))["rows"] if r.get("es")]  # noqa: E731
    nac, pais = rows("nacionalidades"), {r["es"] for r in rows("paises")}
    same = [r["es"] for r in nac if r["es"] in pais]
    if same or len(nac) != 56:
        probs.append(f"nacionalidades: {len(nac)} filas; dicen el país: {same[:6]}")
    want = {"español, española": "Spanish", "francés, francesa": "French", "estadounidense": "American", "danés, danesa": "Danish"}
    got = {r["es"]: r["l"]["english"]["word"] for r in nac if r["es"] in want}
    if got != want:
        probs.append(f"nacionalidades: {got} (se esperaba {want})")
    w = {n: [r.get("es") for r in json.loads((C.REPO / "data" / f"{n}.json").read_text(encoding="utf-8"))["rows"]] for n in ("w07", "w08")}
    if w["w08"][34] != "mañana" or w["w08"][43] != "mañana (el día siguiente)" or w["w07"][29] != "camión" or w["w07"][43] != "camión (de carga)":
        probs.append(f"w08 34/43: {w['w08'][34]!r} / {w['w08'][43]!r}; w07 29/43: {w['w07'][29]!r} / {w['w07'][43]!r}")
    assert not probs, "\n".join(probs)


def test_migrates_nationalities_once():
    """Lo guardado con el país («nacionalidades|España», en el repaso de cada idioma y en el álbum) pasa a la
    nacionalidad al arrancar; si dos acaban en la misma, se queda la de caja más alta. Se apunta en "mig" {nac: 1}
    (que va en la partida) y no se repite; sin nada que cambiar no se escribe nada. La palabra se repasa con su nuevo
    español."""
    probs = []
    page = C.new_page("desk")
    try:
        C.seed(page)
        if "mig" in C.storage(page):
            probs.append("sin nacionalidades guardadas, el arranque escribe «mig»")
        keys = C.seed_keys()
        en = json.loads(keys["srs:english"])
        en.update(_ent("España", 4, T - 1, doc="nacionalidades"))
        en.update(_ent("Francia", 1, T + 1, doc="nacionalidades"))
        en.update(_ent("francés, francesa", 3, T + 5, doc="nacionalidades"))
        for x in en.values():
            if x["d"] != "nacionalidades" and x["due"] <= T:
                x["due"] = T + 1
        keys["srs:english"] = C._dumps(en)
        fr = json.loads(keys["srs:français"])
        fr.update(_ent("Alemania", 2, T + 3, doc="nacionalidades"))
        keys["srs:français"] = C._dumps(fr)
        seen = json.loads(keys["album:seen:english"])
        seen["nacionalidades|España"] = 2
        keys["album:seen:english"] = C._dumps(seen)
        C.seed(page, keys=keys, hash="")
        s = C.storage(page)
        en2, fr2, seen2 = json.loads(s["srs:english"]), json.loads(s["srs:français"]), json.loads(s["album:seen:english"])
        old = [k for k in list(en2) + list(fr2) + list(seen2) if k in ("nacionalidades|España", "nacionalidades|Francia", "nacionalidades|Alemania")]
        if old:
            probs.append(f"quedan claves con el país: {old}")
        es = en2.get("nacionalidades|español, española")
        if not es or es["e"] != "español, española" or es["b"] != 4:
            probs.append(f"«España» no pasa a «español, española»: {es}")
        f = en2.get("nacionalidades|francés, francesa")
        if not f or f["b"] != 3 or f["e"] != "francés, francesa":
            probs.append(f"«Francia» y «francés, francesa» juntas: se esperaba la de caja 3, {f}")
        if (fr2.get("nacionalidades|alemán, alemana") or {}).get("e") != "alemán, alemana":
            probs.append(f"en francés no pasa: {fr2.get('nacionalidades|alemán, alemana')}")
        if seen2.get("nacionalidades|español, española") != 2:
            probs.append("en el álbum no pasa")
        if json.loads(s.get("mig") or "null") != {"nac": 1} or not page.evaluate("() => vocabSave.typeOf('mig') && vocabSave.typeOf('rv:stat')"):
            probs.append(f"«mig»: {s.get('mig')!r}; en la partida: {page.evaluate('() => [vocabSave.typeOf(\"mig\"), vocabSave.typeOf(\"rv:stat\")]')}")
        C.goto(page, "", reload=True)
        if C.storage(page) != s:
            probs.append("al volver a arrancar cambia algo otra vez")
        C.goto(page, "#/repaso")
        page.wait_for_selector("#rv-card", timeout=8000)
        st = page.evaluate(_ST)
        if st["es"] != "español, española" or st["word"] != "Spanish":
            probs.append(f"se repasa como {st['es']!r} / {st['word']!r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- el calendario
def test_scheduler_rules():
    """srsStep/srsGrade: las cajas, el tope de lo que puntúa él, la dominada a los 30 días con "mastered" una vez, el
    ajuste por niño y rv:stat (solo lo que corrige la app)."""
    probs = []
    page = C.new_page("desk")
    try:
        C.seed(page)
        r = page.evaluate("""() => { localStorage.removeItem('rv:stat');
          const S = (x, g, o) => { const s = srsStep(x, g, o); return [s.b, s.h, s.days]; };
          return {IV, MASTER, two: S({b: 2}, 2), one: S({b: 3}, 1), oneone: S({b: 3, h: 1}, 1), zero: S({b: 3}, 0), zero1: S({b: 1}, 0),
            again: S({b: 3}, 0, {again: true}), top: S({b: 7}, 2), selfUp: S({b: 3}, 2, {self: true}), selfCap: S({b: 3, s: 1}, 2, {self: true}),
            selfLow: S({b: 2, s: 1}, 2, {self: true}), self5: S({b: 4}, 2, {self: true}), self55: S({b: 5}, 2, {self: true}), app5: S({b: 5}, 2),
            selfOne: S({b: 3, s: 1, h: 1}, 1, {self: true})}; }""")
        want = {"IV": [0, 1, 3, 7, 14, 30, 60, 120], "MASTER": 6, "two": [3, 0, 7], "one": [3, 1, 7], "oneone": [4, 0, 14], "zero": [1, 0, 0],
                "zero1": [0, 0, 0], "again": [3, 0, 1], "top": [7, 0, 120], "selfUp": [4, 0, 14], "selfCap": [3, 0, 7], "selfLow": [3, 0, 7],
                "self5": [5, 0, 30], "self55": [5, 0, 30], "app5": [6, 0, 60], "selfOne": [3, 0, 7]}
        for k, v in want.items():
            if r[k] != v:
                probs.append(f"srsStep {k}: {r[k]} (se esperaba {v})")
        f = page.evaluate("""() => { const set = s => store.set('rv:stat', {v: 1, r: s}), out = {};
          set('1'.repeat(50)); out.hi = [srsFactor(), srsStep({b: 2}, 2).days];
          set('1'.repeat(30) + '0'.repeat(20)); out.lo = [srsFactor(), srsStep({b: 2}, 2).days, srsStep({b: 4}, 2).days];
          set('1'.repeat(19)); out.few = srsFactor();
          set('1'.repeat(40) + '0'.repeat(5) + '1'.repeat(5)); out.mid = srsFactor();
          localStorage.removeItem('rv:stat'); return out; }""")
        if f != {"hi": [1.3, 9], "lo": [0.7, 5, 30], "few": 1, "mid": 1}:
            probs.append(f"ajuste por niño: {f} (×1,3 → 9 días; ×0,7 → 5 días y nunca menos de 30 desde la caja 5)")
        g = page.evaluate("""async () => { const d = await getDoc('animales'), r = d.rows.find(x => x.es === 'Perro'), K = 'animales|Perro';
          localStorage.removeItem('rv:stat'); const ev = []; bus.on('mastered', e => ev.push(e));
          const m = srsAll(); m[K] = {d: 'animales', e: 'Perro', b: 5, due: today(), n: 4}; srsPut(m);
          const snap = () => Object.assign({}, srsAll()[K]), out = {};
          srsGrade('animales', r, 2, {self: true}); out.self = snap(); out.ev0 = ev.length;
          srsGrade('animales', r, 2); out.app = snap(); out.ev1 = ev.slice();
          srsGrade('animales', r, 0); out.miss = snap();
          srsGrade('animales', r, 2); srsGrade('animales', r, 2); out.back = snap(); out.ev2 = ev.length;
          out.stat = store.get('rv:stat', null); out.t = today(); return out; }""")
        if g["self"]["b"] != 5 or g["self"].get("s") != 1 or g["ev0"]:
            probs.append(f"«¡Sí!» en la caja 5 sin comprobar: {g['self']} (se queda en la 5, sin dominar), avisos {g['ev0']}")
        if g["app"]["b"] != 6 or g["app"].get("m") != 1 or "s" in g["app"] or g["app"]["due"] != g["t"] + 60:
            probs.append(f"bien, comprobado, en la caja 5: {g['app']} (se esperaba caja 6, m: 1, dentro de 60 días)")
        if g["ev1"] != [{"k": "animales|Perro", "doc": "animales", "es": "Perro", "lang": "english"}]:
            probs.append(f"bus mastered: {g['ev1']}")
        if g["miss"]["b"] != 4 or g["back"]["b"] != 6 or g["ev2"] != 1:
            probs.append(f"fallada y vuelta a dominar: {g['miss']} → {g['back']}, avisos {g['ev2']} (solo uno por palabra)")
        if (g["stat"] or {}).get("r") != "1011":
            probs.append(f"rv:stat apunta {g['stat']} (solo lo comprobado: 1011)")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_in_memory_map_writes_late():
    """El repaso vive en memoria: 10 notas seguidas no escriben nada; se escribe una vez a los 250 ms, y enseguida al
    esconder la app o al cerrarla; srsAll(), store.get y la copia de la partida ven lo mismo; si otro cambia
    localStorage, se nota al leer."""
    page = C.new_page("desk")
    try:
        C.seed(page)
        r = page.evaluate("""async () => { await getDoc('animales'); srsFlush();
          const rows = CACHE.animales.rows.filter(r => r.es).slice(1, 11), pause = ms => new Promise(f => setTimeout(f, ms));
          let n = 0; const s0 = Storage.prototype.setItem;
          Storage.prototype.setItem = function(k){ if (String(k).startsWith('srs:')) n++; return s0.apply(this, arguments); };
          const out = {};
          try {
            const t0 = performance.now();
            for (const r of rows) srsGrade('animales', r, 2);
            out.ms = performance.now() - t0; out.now = n;
            out.same = srsAll() === store.get('srs:english') && srsAll() === srsMem('english').m;
            await pause(100); out.mid = n;
            await pause(350); out.after = n;
            out.eq = localStorage.getItem('srs:english') === JSON.stringify(srsAll());
            srsGrade('animales', rows[0], 1); out.pend = n;
            Object.defineProperty(document, 'hidden', {value: true, configurable: true});
            document.dispatchEvent(new Event('visibilitychange'));
            delete document.hidden; out.hid = n;
            srsGrade('animales', rows[1], 1); dispatchEvent(new Event('pagehide')); out.ph = n;
            srsGrade('animales', rows[2], 1);
            const k = 'animales|' + rows[2].es, snap = vocabSave.snapshot();
            out.snap = JSON.parse(snap.keys['srs:english'])[k].n === srsAll()[k].n;
          } finally { Storage.prototype.setItem = s0; }
          const m = JSON.parse(localStorage.getItem('srs:english')); m['animales|Perro'].b = 7; localStorage.setItem('srs:english', JSON.stringify(m));
          out.other = srsAll()['animales|Perro'].b;
          return out; }""")
        want = {"now": 0, "mid": 0, "after": 1, "eq": True, "pend": 1, "hid": 2, "ph": 3, "snap": True, "other": 7, "same": True}
        bad = {k: r[k] for k in want if r[k] != want[k]}
        assert not bad and r["ms"] < 200 and not C.errors(page), f"{bad} ({r}) {C.errors(page)}"
    finally:
        page.context.close()


# ---------------------------------------------------------------- sesiones cortas
def test_sessions_of_twenty_in_order_and_another_batch():
    """Con 30 pendientes, el repaso trae 20: primero las que más esperan y, entre ellas, las de caja más baja. Hoy y la
    insignia siguen contando las 30. Con 23 pendientes, al terminar 20 sale «Otra tanda (3 más)» (secundario, «Seguir»
    es lo principal), que abre otro repaso con las 3."""
    probs = []
    page = C.new_page()
    try:
        names = [r["es"] for r in _ROWS if r.get("img")]
        b0, b2, b4 = names[:8], names[8:16], names[16:30]
        keys = _keys(*[_ent(e, 2, T - 5) for e in b2], *[_ent(e, 0, T - 5) for e in b0], *[_ent(e, 4, T) for e in b4])
        _open(page, keys)
        st = page.evaluate(_ST)
        if st["total"] != 20 or len(st["queue"]) != 20:
            probs.append(f"un repaso con 30 pendientes trae {st['total']} ({len(st['queue'])} en la cola)")
        q = st["queue"]
        if set(q[:8]) != set(b0) or set(q[8:16]) != set(b2) or not set(q[16:]) <= set(b4):
            probs.append(f"orden: {q} (primero las 8 de caja 0 de hace 5 días, luego las 8 de caja 2, luego 4 de hoy)")
        if page.evaluate("() => dueList().length") != 30:
            probs.append(f"pendientes: {page.evaluate('() => dueList().length')} (30)")
        page.context.close()
        page = C.new_page()
        keys = _keys(*[_ent(e, 4, T - 1) for e in names[:23]])
        _open(page, keys)
        for k in range(20):
            _flip_yes(page)
            if k < 19:
                _wait_i(page, k + 1)
        page.wait_for_selector("#rv-end", timeout=6000)
        page.wait_for_timeout(700)
        more = page.evaluate("""() => { const b = document.getElementById('rv-more-go'), go = document.getElementById('rv-end-go');
          return b && {t: b.textContent.trim(), pri: b.classList.contains('glass-btn--pri'), goPri: go.classList.contains('glass-btn--pri'),
            earn: document.getElementById('rv-earn').textContent.trim(), below: b.getBoundingClientRect().top >= go.getBoundingClientRect().bottom - 1}; }""")
        if not more or more["t"] != "Otra tanda (3 más)" or more["pri"] or not more["goPri"] or not more["below"]:
            probs.append(f"«Otra tanda»: {more}")
        if more and more["earn"] != "+30":
            probs.append(f"monedas del final: {more['earn']} (20 tarjetas × 1 + 10)")
        C.shot(page, "fin-otra-tanda-390", CAPS, full_page=False)
        page.locator("#rv-more-go").click()
        page.wait_for_selector("#rv-card", timeout=6000)
        st = page.evaluate(_ST)
        if st["total"] != 3 or st["i"] != 0 or st["end"]:
            probs.append(f"la otra tanda: {st}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la app corrige
def test_card_kind_by_box():
    """vocabReview.kindOf: caja 0 «Escucha y elige» (con dibujo y voz; si no, «¿Cuál es…?»), caja 1 «¿Cuál es…?», cajas 2
    y 3 las letras, caja 4 o más la tarjeta (salvo si la última nota la puso él: entonces corrige la app).
    vocabReview.spellOf: el artículo va puesto; tildes y æøå son fichas; de 2 a 12 letras."""
    page = C.new_page("desk")
    try:
        C.seed(page)
        r = page.evaluate("""async () => { const d = await getDoc('animales'), R = es => d.rows.find(r => r.es === es), K = vocabReview.kindOf, S = vocabReview.spellOf;
          const j = s => s && {art: s.art, sep: s.sep, chars: s.chars.join('')};
          return {k: [K(R('Perro'), {b: 0}), K(R('Perro'), {b: 1}), K(R('Perro'), {b: 2}), K(R('Perro'), {b: 3}), K(R('Perro'), {b: 4}),
              K(R('Perro'), {b: 4, s: 1}), K(R('Perro'), {b: 7}), K(Object.assign({}, R('Perro'), {img: ''}), {b: 0})],
            s: [j(S('le chien', 'français')), j(S("l'éléphant", 'français')), j(S('et æble', 'dansk')), j(S('ice cream', 'english')),
              S('hippopotamuses', 'english'), S('a', 'english'), j(S('shark / sharks', 'english'))], cap: vocabReview.CAP}; }""")
        want_k = ["listen", "pick", "spell", "spell", "card", "spell", "card", "pick"]
        want_s = [{"art": "le", "sep": " ", "chars": "chien"}, {"art": "l'", "sep": "", "chars": "éléphant"}, {"art": "et", "sep": " ", "chars": "æble"},
                  {"art": "", "sep": "", "chars": "ice cream"}, None, None, {"art": "", "sep": "", "chars": "shark"}]
        assert r["k"] == want_k and r["s"] == want_s and r["cap"] == 20 and not C.errors(page), f"{r} {C.errors(page)}"
    finally:
        page.context.close()


def test_listen_and_pick_graded_by_app():
    """Caja 0: suena la palabra y se elige entre 4 dibujos; bien a la primera = 2 (verde con ✓, suena «ok», vibra
    success, la palabra con su IPA, elogio del esfuerzo, pasa sola). Caja 1: el dibujo y el español, 4 palabras; mal =
    0: la elegida en gris con ✗ (sin sonido de fallo), la buena en verde, a la vez la palabra, su IPA y su audio, y
    «Seguir»; baja dos cajas y vuelve 3 a 5 tarjetas después, donde bien vale 1 como mucho. Monedas = la nota."""
    probs = []
    page = C.new_page()
    try:
        keys = _keys(_ent("Perro", 0, T - 6), _ent("Gato", 1, T - 5), _fillers(6, skip=("Perro", "Gato")))
        _open(page, keys)
        st = page.evaluate(_ST)
        if st["kind"] != "listen" or st["es"] != "Perro" or len(st["opts"] or []) != 4 or len(set(st["opts"])) != 4:
            probs.append(f"caja 0: {st['kind']} {st['es']} {st['opts']}")
        # suena sola al llegar (hearIt) y con Espacio otra vez
        page.wait_for_function("() => rv.c && rv.c.played", timeout=4000)
        page.evaluate("() => document.activeElement && document.activeElement.blur()")
        page.keyboard.press("Space")
        page.wait_for_function("() => window.__said && window.__said.includes('dog')", timeout=4000)
        face = page.evaluate("""() => ({txt: document.getElementById('rv-card').textContent, pics: document.querySelectorAll('#rv-dock .rv-opt.pic img').length,
          ask: document.querySelector('#rv-card .rv-qq').textContent})""")
        if "dog" in face["txt"] or "Perro" in face["txt"] or face["pics"] != 4 or face["ask"] != "Escucha y elige":
            probs.append(f"«Escucha y elige»: {face}")
        C.shot(page, "escucha-390", CAPS, full_page=False)
        _right_pick(page)
        _wait_graded(page)
        page.wait_for_timeout(150)
        ok = page.evaluate("""() => ({ok: document.querySelectorAll('#rv-dock .rv-opt.is-ok .chk').length, praise: (document.querySelector('.rv-praise') || {}).textContent,
          word: (document.querySelector('.rv-ans .rv-word') || {}).textContent, lang: (document.querySelector('.rv-ans .rv-word') || {lang: ''}).lang,
          ipa: !!document.querySelector('.rv-ans .rv-ipa')})""")
        if ok != {"ok": 1, "praise": "Escuchaste con atención.", "word": "dog", "lang": "en-GB", "ipa": True}:
            probs.append(f"bien a la primera: {ok}")
        sx = page.evaluate("() => [window.__sfx.slice(), window.__hap.slice(), window.__aw.slice()]")
        if "ok" not in sx[0] or "bad" in sx[0] or "success" not in sx[1] or set(sx[1]) - {"success", "selection"} or sx[2] != [[2, "", True]]:
            probs.append(f"sonido, vibración y monedas: {sx}")
        _wait_i(page, 1, timeout=8000)
        srs = page.evaluate(_SRS)
        if srs["animales|Perro"]["b"] != 1 or "s" in srs["animales|Perro"]:
            probs.append(f"Perro tras 2: {srs['animales|Perro']}")
        # caja 1: ¿Cuál es en inglés? y mal
        page.wait_for_function("() => vocabReview.state.kind === 'pick' && !vocabReview.state.graded", timeout=4000)
        st = page.evaluate(_ST)
        lk = page.evaluate("""() => ({es: document.querySelector('#rv-card .rv-es').textContent, pic: !!document.querySelector('#rv-card .rv-pic'),
          ask: document.querySelector('#rv-card .rv-qq').textContent, langs: [...document.querySelectorAll('#rv-dock .rv-opt')].map(b => b.lang)})""")
        if st["es"] != "Gato" or lk != {"es": "Gato", "pic": True, "ask": "¿Cuál es en inglés?", "langs": ["en-GB"] * 4}:
            probs.append(f"caja 1: {st['es']} {lk}")
        wrong = next(i for i in range(4) if i != st["right"])
        page.keyboard.press(str(wrong + 1))
        _wait_graded(page)
        page.wait_for_timeout(150)
        miss = page.evaluate("""i => { const b = document.querySelectorAll('#rv-dock .rv-opt')[i], s = getComputedStyle(b);
          return {miss: b.classList.contains('is-miss'), x: !!b.querySelector('.xm'), bg: s.backgroundColor, ok: document.querySelectorAll('#rv-dock .rv-opt.is-ok').length,
            word: (document.querySelector('.rv-ans .rv-word') || {}).textContent, ipa: !!document.querySelector('.rv-ans .rv-ipa'), spk: !!document.querySelector('.rv-ans .rv-spk'),
            pic: !!document.querySelector('#rv-card .rv-pic'), next: (document.querySelector('#rv-dock [data-rv=tnext]') || {}).textContent}; }""", wrong)
        if not miss["miss"] or not miss["x"] or not _grey(miss["bg"]) or miss["ok"] != 1 or miss["word"] != "cat" or not miss["ipa"] or not miss["spk"] or not miss["pic"] or miss["next"] != "Seguir":
            probs.append(f"mal: {miss}")
        if page.evaluate("() => window.__said.filter(w => w === 'cat').length") < 1:
            probs.append("tras fallar no suena la palabra")
        C.shot(page, "elige-mal-390", CAPS, full_page=False)
        sx2 = page.evaluate("() => [window.__sfx.slice(), window.__hap.slice(), window.__aw.slice()]")
        if sx2[0] != sx[0] or set(sx2[1]) - {"success", "selection"} or sx2[2] != sx[2]:
            probs.append(f"al fallar: sonidos {sx2[0]}, vibración {sx2[1]}, monedas {sx2[2]} (antes {sx})")
        back = page.evaluate("""() => { const k = rv.q.findIndex((x, j) => j > rv.i && x.again && x.r.es === 'Gato'); return k - rv.i - 1; }""")
        if not 3 <= back <= 5:
            probs.append(f"la fallada vuelve con {back} tarjetas en medio (3 a 5)")
        srs = page.evaluate(_SRS)
        if srs["animales|Gato"]["b"] != 0 or srs["animales|Gato"]["due"] != T or not page.evaluate("() => store.get('rv:stat').r.endsWith('10')"):
            probs.append(f"Gato tras 0: {srs['animales|Gato']}, rv:stat {page.evaluate('() => store.get(`rv:stat`)')}")
        page.keyboard.press("Enter")
        _wait_i(page, 2)
        # las de la caja 4 y, a los 3-5, la vuelta: bien vale 1
        for _ in range(8):
            st = page.evaluate(_ST)
            if st["end"]:
                break
            if st["again"]:
                if st["kind"] != "pick" or st["es"] != "Gato":
                    probs.append(f"la vuelta: {st['kind']} {st['es']}")
                n_aw = len(page.evaluate("() => window.__aw"))
                _right_pick(page)
                _wait_graded(page)
                if page.evaluate("() => vocabReview.state.g") != 1 or page.evaluate("() => window.__aw")[n_aw:] != [[1, "", True]]:
                    probs.append(f"la vuelta bien: nota {page.evaluate('() => vocabReview.state.g')}, monedas {page.evaluate('() => window.__aw')[n_aw:]}")
                if page.evaluate("() => document.querySelector('.rv-praise').textContent") != "Esta vez la reconociste.":
                    probs.append(f"elogio en la vuelta: {page.evaluate('() => document.querySelector(`.rv-praise`).textContent')}")
                _wait_i(page, st["i"] + 1, timeout=8000)
                srs = page.evaluate(_SRS)
                if srs["animales|Gato"]["b"] != 0 or srs["animales|Gato"]["due"] != T + 1:
                    probs.append(f"Gato tras la vuelta: {srs['animales|Gato']} (caja 0, mañana)")
                break
            _answer_right(page)
            _wait_i(page, st["i"] + 1, timeout=8000)
        else:
            probs.append("la fallada no vuelve")
        cards = page.evaluate("() => window.__cards.map(c => [c.es, c.grade, c.self])")
        if cards[:2] != [["Perro", 2, False], ["Gato", 0, False]] or ["Gato", 1, False] not in cards:
            probs.append(f"review-card: {cards}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_spelling_tiles():
    """Cajas 2 y 3: los huecos y las fichas (sus letras y 1 o 2 de sobra, nunca en orden; también con teclado). Una ficha
    mala se pone gris con ✗ un momento; bien con una mala = 1. «Pista» pone la siguiente (2 como mucho, nunca la última):
    1. Dos malas = 0: la palabra aparece en los huecos, con su IPA y su audio, y «Seguir»; baja dos cajas. Una de la caja
    4 cuya última nota la puso él va con las letras."""
    probs = []
    page = C.new_page()
    try:
        keys = _keys(_ent("Conejo", 2, T - 6), _ent("Caballo", 3, T - 5), _ent("Toro", 4, T - 4, s=1), _fillers(6, skip=("Conejo", "Caballo", "Toro")))
        _open(page, keys)
        st = page.evaluate(_ST)
        tiles = sorted(t.lower() for t in st["tiles"])
        if st["kind"] != "spell" or st["letters"] != "rabbit" or not 7 <= len(tiles) <= 8 or any(tiles.count(c) < "rabbit".count(c) for c in "rabbit") or "".join(st["tiles"][:6]) == "rabbit":
            probs.append(f"las letras de «rabbit»: {st['kind']} {st['letters']} {st['tiles']}")
        slots = page.evaluate("() => document.querySelectorAll('#rv-sp .rv-slot:not(.fix)').length")
        if slots != 6:
            probs.append(f"{slots} huecos (6)")
        _type(page, "rab")
        extra = next(t for t in st["tiles"] if t.lower() not in "rabbit")
        page.keyboard.press(extra)
        page.wait_for_timeout(80)
        fl = page.evaluate("""() => { const b = document.querySelector('#rv-dock .rv-tile.is-miss'); return b && {x: !!b.querySelector('.xm'), bg: getComputedStyle(b).backgroundColor}; }""")
        if not fl or not fl["x"] or not _grey(fl["bg"]) or page.evaluate("() => vocabReview.state.bad") != 1:
            probs.append(f"ficha mala: {fl}")
        C.shot(page, "letras-390", CAPS, full_page=False)
        _type(page, "bit")
        _wait_graded(page)
        st = page.evaluate(_ST)
        praise = page.evaluate("() => (document.querySelector('.rv-praise') || {}).textContent")
        if st["g"] != 1 or praise != "A la segunda, la escribiste bien." or page.evaluate("() => window.__aw") != [[1, "", True]]:
            probs.append(f"con una mala: nota {st['g']}, {praise!r}, monedas {page.evaluate('() => window.__aw')}")
        C.shot(page, "letras-bien-390", CAPS, full_page=False)
        _wait_i(page, 1, timeout=8000)
        srs = page.evaluate(_SRS)
        if srs["animales|Conejo"]["b"] != 2 or srs["animales|Conejo"].get("h") != 1:
            probs.append(f"Conejo tras un 1: {srs['animales|Conejo']} (se queda en la caja 2 con h: 1)")
        # Caballo (horse) con pista
        page.wait_for_function("() => vocabReview.state.es === 'Caballo' && vocabReview.state.kind === 'spell'", timeout=4000)
        page.locator("#rv-dock [data-rv=tip]").click()
        page.locator("#rv-dock [data-rv=tip]").click()
        st = page.evaluate(_ST)
        tip_left = page.locator("#rv-dock [data-rv=tip]").count()
        if st["put"] != 2 or st["hint"] != 2 or tip_left:
            probs.append(f"dos pistas: puestas {st['put']}, pistas {st['hint']}, botón {tip_left}")
        _type(page, "rse")
        _wait_graded(page)
        praise = page.evaluate("() => (document.querySelector('.rv-praise') || {}).textContent")
        if page.evaluate("() => vocabReview.state.g") != 1 or praise != "Con una pista, la escribiste.":
            probs.append(f"con pista: nota {page.evaluate('() => vocabReview.state.g')}, {praise!r}")
        _wait_i(page, 2, timeout=8000)
        # Toro (bull): caja 4 con la última nota suya → las letras; dos malas = 0
        page.wait_for_function("() => vocabReview.state.es === 'Toro'", timeout=4000)
        st = page.evaluate(_ST)
        if st["kind"] != "spell":
            probs.append(f"caja 4 con la última nota suya: {st['kind']} (las letras)")
        wrong = [t for t in st["tiles"] if t.lower() != "b"][:2]
        for t in wrong:
            page.keyboard.press(t)
            page.wait_for_timeout(80)
        _wait_graded(page)
        page.wait_for_timeout(150)
        lost = page.evaluate("""() => ({g: vocabReview.state.g, rev: [...document.querySelectorAll('#rv-sp .rv-slot:not(.fix)')].map(s => s.textContent).join(''),
          ipa: !!document.querySelector('.rv-ans .rv-ipa'), spk: !!document.querySelector('.rv-ans .rv-spk'), next: (document.querySelector('#rv-dock [data-rv=tnext]') || {}).textContent})""")
        if lost != {"g": 0, "rev": "bull", "ipa": True, "spk": True, "next": "Seguir"}:
            probs.append(f"dos malas: {lost}")
        C.shot(page, "letras-mal-390", CAPS, full_page=False)
        srs = page.evaluate(_SRS)
        if srs["animales|Toro"]["b"] != 2 or "s" in srs["animales|Toro"]:
            probs.append(f"Toro tras 0: {srs['animales|Toro']} (caja 2, corregida por la app)")
        if any(h not in ("success", "selection") for h in page.evaluate("() => window.__hap")) or set(page.evaluate("() => window.__sfx")) - {"ok"}:
            probs.append(f"vibraciones {page.evaluate('() => window.__hap')} y sonidos {page.evaluate('() => window.__sfx')}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- lo que ya no está
def test_dead_entries_dropped():
    """Al abrir el repaso, lo que ya no existe se quita: una palabra que su tema (abierto) ya no tiene, pendiente o no, y
    un tema que ya no existe (no está en el índice y da 404). Lo demás no cambia y el repaso no las cuenta."""
    probs = []
    page = C.new_page()
    try:
        keys = C.seed_keys()
        m = json.loads(keys["srs:english"])
        m.update(_ent("Dragón", 2, T - 1))
        m.update(_ent("Unicornio", 3, T + 4))
        m.update(_ent("algo", 1, T - 1, doc="zzz-gone"))
        keys["srs:english"] = C._dumps(m)
        _open(page, keys)
        st = page.evaluate(_ST)
        page.wait_for_timeout(300)
        srs = page.evaluate(_SRS)
        left = [k for k in ("animales|Dragón", "animales|Unicornio", "zzz-gone|algo") if k in srs]
        if left or len(srs) != len(m) - 3 or st["total"] != 12:
            probs.append(f"quedan {left}; {len(srs)} entradas (se esperaban {len(m) - 3}); el repaso trae {st['total']} (12)")
        probs += _errors(page, "zzz-gone", "404")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_offline_shows_sin_conexion():
    """Sin conexión y con el tema sin descargar: «Sin conexión» con «Probar otra vez»; esas palabras no se borran pero no
    cuentan como pendientes (ni en la insignia) hasta que vuelve la red; entonces el repaso se abre."""
    probs = []
    page = C.new_page()
    try:
        keys = _keys(_ent("Francia", 4, T - 1, doc="paises"))
        page.route("**/data/paises.json", lambda r: r.abort())
        C.seed(page, keys=keys, hash="")
        if page.evaluate("() => dueList().length") != 1:
            probs.append("antes de probar, la pendiente no cuenta")
        page.context.set_offline(True)
        page.wait_for_function("() => navigator.onLine === false", timeout=3000)
        C.goto(page, "#/repaso")
        page.wait_for_selector("#rv-off", timeout=8000)
        r = page.evaluate("""() => ({t: document.getElementById('rv-empty-t').textContent, btn: document.getElementById('rv-retry').textContent.trim(),
          due: dueList().length, off: [...SRS_OFF], kept: !!srsAll()['paises|Francia'], card: !!document.getElementById('rv-card')})""")
        if r != {"t": "Sin conexión", "btn": "Probar otra vez", "due": 0, "off": ["paises"], "kept": True, "card": False}:
            probs.append(f"sin conexión: {r}")
        C.shot(page, "sin-conexion-390", CAPS, full_page=False)
        page.unroute("**/data/paises.json")
        page.context.set_offline(False)
        page.wait_for_function("() => navigator.onLine !== false && dueList().length === 1", timeout=4000)
        page.locator("#rv-retry").click()
        page.wait_for_selector("#rv-card", timeout=8000)
        if page.evaluate(_ST)["es"] != "Francia":
            probs.append(f"con red: {page.evaluate(_ST)}")
        probs += _errors(page, "paises.json", "ERR_INTERNET_DISCONNECTED", "ERR_FAILED", "Failed to load resource")
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- capturas y auditoría
def test_task_screens_fit_and_audit():
    """«Escucha y elige», «¿Cuál es…?» fallada y las letras a 360×740, 390×844 y 1280×800, en claro, en oscuro y con
    reducir movimiento: sin scroll horizontal, lo que se toca cabe en la pantalla sin bajar, contraste ≥ 4,5:1 y sin
    colores prohibidos."""
    probs = []
    runs = [("360", dict(kind="phone", viewport={"width": 360, "height": 740})), ("390", dict(kind="phone")),
            ("1280", dict(kind="desk")), ("390-oscuro", dict(kind="phone", color_scheme="dark")),
            ("390-sin-mov", dict(kind="phone", reduced_motion="reduce"))]
    for label, kw in runs:
        page = C.new_page(kw.pop("kind"), **kw)
        try:
            keys = _keys(_ent("Perro", 0, T - 6), _ent("Gato", 1, T - 5), _ent("Conejo", 2, T - 4), _fillers(4, skip=("Perro", "Gato", "Conejo")))
            _open(page, keys)

            def check(what, ms=450):
                page.wait_for_timeout(ms)
                page.evaluate(_FINISH)
                fit = page.evaluate("""() => { const els = [...document.querySelectorAll('#rv-dock button, #rv-card .rv-spk')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
                  return {wide: document.documentElement.scrollWidth > innerWidth, low: els.filter(e => e.getBoundingClientRect().bottom > innerHeight + 1).map(e => e.dataset.rv + ':' + e.textContent.trim()),
                    scroll: document.scrollingElement.scrollHeight > innerHeight + 1}; }""")
                if fit["wide"] or fit["low"]:
                    probs.append(f"{label} {what}: scroll horizontal {fit['wide']}, fuera de la pantalla {fit['low']}")
                a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
                probs.extend(f"{label} {what}: {x}" for x in a["contrast"] + a["palette"])
                C.shot(page, f"{what}-{label}", CAPS, full_page=False)

            page.wait_for_function("() => vocabReview.state.kind === 'listen'", timeout=4000)
            check("escucha")
            _right_pick(page)
            _wait_graded(page)
            check("escucha-bien", 60)   # pasa sola tras el audio: se mira enseguida
            _wait_i(page, 1, timeout=8000)
            page.wait_for_function("() => vocabReview.state.kind === 'pick' && !vocabReview.state.graded", timeout=4000)
            st = page.evaluate(_ST)
            page.keyboard.press(str((st["right"] + 1) % 4 + 1))
            _wait_graded(page)
            check("elige-mal")
            page.keyboard.press("Enter")
            page.wait_for_function("() => vocabReview.state.kind === 'spell' && !vocabReview.state.graded", timeout=4000)
            _type(page, page.evaluate(_ST)["letters"][:2])
            check("letras")
            if label == "390-sin-mov":
                tr = page.evaluate("() => getComputedStyle(document.querySelector('#rv-dock .rv-tile')).transitionProperty")
                if tr != "none":
                    probs.append(f"con reducir movimiento las fichas se animan: {tr}")
            probs.extend(f"{label}: {e}" for e in C.errors(page))
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)
