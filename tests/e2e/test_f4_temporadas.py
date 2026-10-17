"""F4d: las temporadas (SPEC §5-E) en js/season.js con data/season.json y los dibujos de img/season/.

Se comprueba: en marzo no se ve nada (ni fila en Hoy, ni #/temporada, ni calabazas en la granja, ni clave guardada);
por fecha local, Halloween del 10 al 31 de octubre, Bonfire Night del 1 al 5 de noviembre solo en inglés y el
adviento del 1 al 24 de diciembre; ?season=… fuerza una y ?season=off las apaga (en esta sesión). La fila compacta
de Hoy (HOME_SLOTS, id "season") lleva a #/temporada y Hoy sigue sin scroll. «Truco o trato»: las 10 puertas; el
fallo deja la elegida en gris con ✗ y la buena en verde, vuelve a sonar la palabra, sin temblor ni vibración, y la
puerta se queda para otro intento; el acierto marca la puerta y suma a la bolsa; la bolsa llena da una pegatina y
award(10) una vez al día (otra vez al día siguiente). Bonfire Night: 5 cajas y fuegos con los colores de la app. La
granja en Halloween: 4 calabazas y 2 murciélagos debajo de los animales, quietos con «Reducir movimiento»; sin capa,
nada. Adviento: se abren la de hoy y las de antes, las de después solo avisan, y la de hoy da award(5) una vez al día.
Cada dibujo carga y cada audio grabado que se usa existe. La partida exportada es la de la base salvo la clave
"season" (registrada en js/save.js). Contraste y paleta; sin errores de consola. Capturas en capturas/F4 (F4d-*)."""
from __future__ import annotations

import datetime as dt
import json
import re
from zoneinfo import ZoneInfo

import common as C

_AUDIT = (C.HERE / "audit.js").read_text(encoding="utf-8")
_OUT = C.CAPTURAS / "F4"
_TZ = ZoneInfo(C.TZ)
_FIRE = ["#FFCC00", "#1E6EF4", "#008198", "#34C759", "#FFFFFF"]
_DATA = json.loads((C.ROOT / "data" / "season.json").read_text(encoding="utf-8"))


def _at(m, d, h=17):
    return dt.datetime(2026, m, d, h, 0, 0, tzinfo=_TZ)


OCT = _at(10, 17)
NOV = _at(11, 3)
DEC = _at(12, 5)

# azar repetible (el orden de las puertas y el modo de cada pregunta): así salen siempre los dos modos
_RANDOM = r"""
(() => { let a = 20261017;
  Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
"""
# ganchos: lo que se dice (sin sonar), las monedas, los temblores, las vibraciones, los sonidos y las chispas
_SPY = """() => {
  if (window.__ssSpy) return; window.__ssSpy = 1;
  window.__said = []; window.__aw = []; window.__nope = 0; window.__hap = []; window.__sfx = []; window.__bursts = [];
  window.say = (t, b, s) => { __said.push(String(t)); };
  window.sayP = (t, b) => { __said.push(String(t)); return new Promise(r => setTimeout(r, 30)); };
  const a0 = window.award; window.award = (n, w, q, f) => { __aw.push([n, w]); return a0(n, w, q, f); };
  const n0 = M.nope; M.nope = (...x) => { __nope++; return n0(...x); };
  const b0 = M.burst; M.burst = (a, b, c) => { const o = (typeof a === 'number' ? c : b) || {}; __bursts.push(o.colors || null); return b0(a, b, c); };
  if (window.G && G.haptic) { const h0 = G.haptic.bind(G); G.haptic = t => { __hap.push(t); return h0(t); }; }
  if (window.sfx) { const p0 = sfx.play.bind(sfx); sfx.play = n => { __sfx.push(n); return p0(n); }; }
}"""
_ST = "() => vocabSeason.state"
_SLOTS = "() => [...document.querySelectorAll('#hm-slots .hm-slot')].map(e => e.dataset.slot || '?')"
_ROW = """() => { const a = document.querySelector('[data-slot=season] .hm-row');
  return a ? {tag: a.tagName, href: a.getAttribute('href'), h: Math.round(a.getBoundingClientRect().height), t: a.textContent.replace(/\\s+/g, ' ').trim(),
    img: !!a.querySelector('img') && a.querySelector('img').naturalWidth > 0} : null; }"""
_FIT = "() => ({sh: document.documentElement.scrollHeight, ih: innerHeight})"
_FINISH = """() => { for (const a of document.getAnimations()) { try {
  const t = a.effect && a.effect.getComputedTiming();
  if (t && t.iterations !== Infinity && isFinite(t.endTime)) a.finish();
} catch (e) {} } }"""


def _page(kind="phone", now=OCT, reduced_motion="reduce", **kw):
    page = C.new_page(kind, now=now, reduced_motion=reduced_motion, **kw)
    page.add_init_script(_RANDOM)
    return page


def _keys(now, **top):
    k = C.seed_keys(now)
    for n, v in top.items():
        k[n] = json.dumps(v, ensure_ascii=False)
    return k


def _open(page, now, hash="#/temporada", **top):
    """Siembra la partida en Hoy, pone los ganchos y abre la ruta."""
    C.seed(page, _keys(now, **top), now=now)
    page.evaluate(_SPY)
    if hash:
        C.goto(page, hash)


def _saved(page):
    return page.evaluate(_ST)["saved"]


def _sheet(page):
    page.wait_for_selector("dialog#ss-q[open] .ss-q-b", timeout=6000)
    page.wait_for_function("() => vocabSeason.state.sheet && __said.length > 0", timeout=6000)
    return page.evaluate(_ST)["sheet"]


def _closed(page):
    page.wait_for_function("() => !document.querySelector('dialog#ss-q[open]') && !vocabSeason.state.sheet", timeout=10000)


def _door(page, i, right=True):
    """Toca la puerta i, contesta (bien o mal) y devuelve lo que preguntaba la hoja y lo que se vio en ella."""
    page.evaluate("() => { __said.length = 0; }")
    page.click(f"#app .ss-door[data-i='{i}']")
    sh = _sheet(page)
    look = page.evaluate("""t => { const d = document.querySelector('dialog#ss-q[open]'), o = [...d.querySelectorAll('.ss-o')];
      return {n: o.length, pic: !!d.querySelector('.ss-opts.is-pic'), word: !!d.querySelector('.ss-opts.is-word'),
        draw: !!d.querySelector('.ss-q-pic img'), right: o.filter(b => b.dataset.id === t).length,
        imgs: o.filter(b => b.querySelector('img')).length, texts: o.map(b => b.textContent.trim())}; }""", sh["target"])
    sel = f"dialog#ss-q .ss-o[data-id='{sh['target']}']" if right else f"dialog#ss-q .ss-o:not([data-id='{sh['target']}'])"
    page.locator(sel).first.click()
    if right:
        _closed(page)
        page.wait_for_function(f"() => {{ const s = vocabSeason.state.street; return s && s.run.ok.includes({i}) && !s.busy; }}", timeout=10000)
    return sh, look


def _all_doors(page, n):
    modes = set()
    for i in range(n):
        if i in page.evaluate(_ST)["street"]["run"]["ok"]:
            continue
        sh, _ = _door(page, i)
        modes.add(sh["mode"])
    page.wait_for_function("() => { const s = vocabSeason.state.street; return s && s.full; }", timeout=6000)
    page.wait_for_timeout(400)
    return modes


def _next_day(page, when):
    page.clock.set_system_time(when)
    C.reload(page)
    page.evaluate(_SPY)


def _rgb(css):
    return [int(float(x)) for x in re.findall(r"[\d.]+", css)[:3]]


def _audit(page, tag, probs):
    page.evaluate(_FINISH)
    a = page.evaluate(_AUDIT, {"what": ["contrast", "palette"]})
    probs += [f"{tag}: {x}" for x in a["contrast"] + a["palette"]]


# ---------------------------------------------------------------- fuera de fecha y fechas
def test_march_shows_nothing():
    """En marzo (FIXED_NOW): sin fila en Hoy, #/temporada vuelve a Hoy, la capa de la granja vacía, sin clave
    "season" y sin la hoja de estilos de la temporada."""
    probs = []
    page = _page(now=C.FIXED_NOW)
    try:
        _open(page, C.FIXED_NOW, hash="")
        if page.evaluate("() => vocabSeason.active()") is not None:
            probs.append(f"en marzo hay temporada: {page.evaluate('() => vocabSeason.active()')}")
        if "season" in page.evaluate(_SLOTS):
            probs.append(f"en marzo hay fila de temporada en Hoy: {page.evaluate(_SLOTS)}")
        C.goto(page, "#/temporada")
        if C.current_hash(page) not in ("", "#/", "#"):
            probs.append(f"#/temporada en marzo se queda en {C.current_hash(page)!r}")
        if page.evaluate("() => !!document.querySelector('#app .ss')"):
            probs.append("#/temporada en marzo pinta la calle")
        C.goto(page, "#/granja")
        page.wait_for_selector("#app .fm-stage .fm-season", timeout=6000)
        page.wait_for_timeout(300)
        n = page.evaluate("() => document.querySelector('#app .fm-season').children.length")
        if n:
            probs.append(f"en marzo la capa .fm-season tiene {n} cosas")
        if "season" in C.storage(page):
            probs.append("en marzo se guarda la clave season")
        if page.evaluate("() => !!document.getElementById('css-season')"):
            probs.append("en marzo se añaden los estilos de la temporada")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_dates_language_and_url_switch():
    """byDate: 10-31 oct Halloween, 1-5 nov Bonfire, 1-24 dic adviento, nada el 9 oct, el 6 nov ni el 25 dic.
    Bonfire solo en inglés (en francés y danés, ni fila ni #/temporada, tampoco forzado); Halloween y adviento en los
    tres idiomas. ?season=off apaga la fila (en esta sesión), ?season=auto vuelve a la fecha."""
    probs = []
    page = _page(now=C.FIXED_NOW)
    try:
        _open(page, C.FIXED_NOW, hash="")
        got = page.evaluate("""() => [[10, 9], [10, 10], [10, 31], [11, 1], [11, 5], [11, 6], [12, 1], [12, 24], [12, 25], [3, 11]]
          .map(([m, d]) => [m, d, vocabSeason.byDate(new Date(2026, m - 1, d, 12))])""")
        want = {(10, 9): None, (10, 10): "halloween", (10, 31): "halloween", (11, 1): "bonfire", (11, 5): "bonfire",
                (11, 6): None, (12, 1): "advent", (12, 24): "advent", (12, 25): None, (3, 11): None}
        for m, d, v in got:
            if want[(m, d)] != v:
                probs.append(f"byDate({d}/{m}) = {v!r}, se esperaba {want[(m, d)]!r}")
    finally:
        page.context.close()

    for when, lang, exp in ((OCT, "english", "halloween"), (OCT, "français", "halloween"), (OCT, "dansk", "halloween"),
                            (NOV, "english", "bonfire"), (NOV, "français", None), (NOV, "dansk", None),
                            (DEC, "français", "advent"), (DEC, "dansk", "advent"), (_at(10, 9), "english", None),
                            (_at(11, 6), "english", None), (_at(12, 26), "english", None)):
        page = _page(now=when)
        tag = f"{when:%d/%m} {lang}"
        try:
            _open(page, when, hash="", lang=lang)
            if page.evaluate("() => vocabSeason.active()") != exp:
                probs.append(f"{tag}: temporada {page.evaluate('() => vocabSeason.active()')!r}, se esperaba {exp!r}")
            has = "season" in page.evaluate(_SLOTS)
            if has != bool(exp):
                probs.append(f"{tag}: fila en Hoy {has}, se esperaba {bool(exp)} ({page.evaluate(_SLOTS)})")
            C.goto(page, "#/temporada")
            on = page.evaluate("() => !!document.querySelector('#app .ss')")
            if on != bool(exp):
                probs.append(f"{tag}: #/temporada se abre {on} (hash {C.current_hash(page)!r})")
            if when == NOV and lang != "english":
                C.goto(page, "#/?season=bonfire")
                if page.evaluate("() => vocabSeason.active()") is not None or "season" in page.evaluate(_SLOTS):
                    probs.append(f"{tag}: Bonfire forzado sale en {lang}")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()

    page = _page(now=OCT)
    try:
        _open(page, OCT, hash="")
        C.goto(page, "#/?season=off")
        if "season" in page.evaluate(_SLOTS) or page.evaluate("() => vocabSeason.forced()") != "off":
            probs.append("?season=off no apaga la fila")
        C.goto(page, "#/mapa")
        C.goto(page, "#/")
        if "season" in page.evaluate(_SLOTS):
            probs.append("?season=off no dura en la sesión")
        C.goto(page, "#/?season=advent")
        r = page.evaluate(_ROW)
        if not r or "Calendario" not in r["t"]:
            probs.append(f"?season=advent en octubre no pone el calendario: {r}")
        C.goto(page, "#/?season=auto")
        r = page.evaluate(_ROW)
        if not r or "Truco o trato" not in r["t"] or page.evaluate("() => vocabSeason.forced()") is not None:
            probs.append(f"?season=auto no vuelve a la fecha: {r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Hoy
def test_hoy_row_fits_without_scroll():
    """Con ?season=halloween (y bonfire y advent) Hoy tiene la fila compacta de la temporada (un enlace a #/temporada,
    ≤ 60 px, con su dibujo) y sigue sin scroll en el móvil y en el escritorio, claro y oscuro. La fila lleva a la
    pantalla, que es de Hoy: pestaña Hoy marcada, sin el título grande, y «‹ Hoy» vuelve."""
    probs = []
    for kind in ("phone", "desk"):
        for scheme in ("light", "dark"):
            page = _page(kind, now=C.FIXED_NOW, color_scheme=scheme)
            tag = f"{kind}-{scheme}"
            try:
                C.seed(page)
                for sid, t in (("halloween", "Truco o trato"), ("bonfire", "Bonfire Night"), ("advent", "Calendario")):
                    C.goto(page, f"#/?season={sid}")
                    page.wait_for_function("() => { const i = document.querySelector('[data-slot=season] img'); return i && i.complete; }", timeout=5000)
                    r = page.evaluate(_ROW)
                    if not r or r["tag"] != "A" or r["href"] != "#/temporada" or r["h"] > 60 or t not in r["t"] or not r["img"]:
                        probs.append(f"{tag} {sid}: la fila no es una fila compacta: {r}")
                    m = page.evaluate(_FIT)
                    if m["sh"] > m["ih"] + 2:
                        probs.append(f"{tag} {sid}: Hoy necesita scroll ({m['sh']} > {m['ih']})")
                    _audit(page, f"{tag} {sid} Hoy", probs)
                    if sid == "halloween":
                        C.shot(page, f"F4d-hoy-{tag}", _OUT, full_page=False)
                C.goto(page, "#/?season=halloween")
                page.click("[data-slot=season] .hm-row")
                page.wait_for_selector("#app .ss-street", timeout=6000)
                h = page.evaluate("""() => ({tab: document.documentElement.dataset.tab, head: document.getElementById('tabhead').hidden,
                  sel: document.querySelector('#tab-hoy') && document.querySelector('#tab-hoy').getAttribute('aria-selected')})""")
                if h != {"tab": "hoy", "head": True, "sel": "true"}:
                    probs.append(f"{tag}: #/temporada no es una pantalla de Hoy: {h}")
                page.click("#app .ss-back")
                page.wait_for_selector("#hm", timeout=6000)
                probs += [f"{tag}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Truco o trato
def test_trick_or_treat_doors_miss_and_hit():
    """Las 10 puertas con su palabra (cada palabra una vez). Un fallo: la elegida en gris con ✗, la buena en verde con
    ✓, vuelve a sonar la palabra, sin M.nope ni vibración ni sonido; «Seguir» cierra la hoja y la puerta se queda
    cerrada para otro intento. Cada acierto abre la puerta para siempre (✓), suma a la bolsa y dice la palabra; salen
    los dos modos (dibujo + 3 palabras y oír + 3 dibujos)."""
    probs = []
    page = _page(now=OCT)
    try:
        _open(page, OCT)
        st = page.evaluate(_ST)["street"]
        if not st or st["id"] != "halloween" or len(st["run"]["o"]) != 10 or len(set(st["run"]["o"])) != 10:
            probs.append(f"la calle no tiene 10 puertas distintas: {st}")
        if page.evaluate("() => document.querySelectorAll('#app .ss-door').length") != 10:
            probs.append("no se pintan 10 puertas")
        if set(st["run"]["o"]) != {w["id"] for w in _DATA["halloween"]}:
            probs.append(f"las puertas no son las 10 palabras de Halloween: {st['run']['o']}")
        hap0, sfx0 = page.evaluate("() => [__hap.length, __sfx.length]")
        sh, look = _door(page, 0, right=False)
        word = next(w["w"]["english"] for w in _DATA["halloween"] if w["id"] == sh["target"])
        page.wait_for_timeout(200)
        m = page.evaluate("""() => { const o = [...document.querySelectorAll('dialog#ss-q .ss-o')];
          const c = b => getComputedStyle(b).backgroundColor;
          return {miss: o.filter(b => b.classList.contains('is-miss')).map(b => [c(b), !!b.querySelector('.ss-mk svg')]),
            ok: o.filter(b => b.classList.contains('is-ok')).map(b => [c(b), !!b.querySelector('.ss-mk svg')]),
            go: !document.getElementById('ss-q-go').hidden, p: document.getElementById('ss-q-p').textContent.replace(/\\s+/g, ' ').trim(),
            anims: o.flatMap(b => b.getAnimations()).length}; }""")
        if len(m["miss"]) != 1 or not m["miss"][0][1] or len(m["ok"]) != 1 or not m["ok"][0][1]:
            probs.append(f"fallo: no hay una elegida en gris con ✗ y la buena con ✓: {m}")
        else:
            r, g, b = _rgb(m["miss"][0][0])
            if max(r, g, b) - min(r, g, b) > 12:
                probs.append(f"fallo: la elegida no es gris: {m['miss'][0][0]}")
            r, g, b = _rgb(m["ok"][0][0])
            if not (g > r + 60 and g > b + 40):
                probs.append(f"fallo: la buena no es verde: {m['ok'][0][0]}")
        if not m["go"] or "Casi" not in m["p"] or word not in m["p"]:
            probs.append(f"fallo: sin «Seguir» o sin la palabra buena: {m}")
        said = page.evaluate("() => __said")
        if said.count(word) < 2:
            probs.append(f"fallo: la palabra no vuelve a sonar: {said}")
        hap, sfx, nope = page.evaluate("() => [__hap.slice(%d), __sfx.slice(%d), __nope]" % (hap0, sfx0))
        if nope or hap or sfx:
            probs.append(f"fallo: temblor, vibración o sonido: nope={nope} hap={hap} sfx={sfx}")
        C.shot(page, "F4d-truco-fallo-phone-light", _OUT, full_page=False)
        page.click("#ss-q-go")
        _closed(page)
        page.wait_for_timeout(500)
        d = page.evaluate("""() => { const b = document.querySelector('#app .ss-door[data-i="0"]');
          return {cls: b.className, inner: b.querySelector('.ss-in').children.length, bag: document.getElementById('ss-bag-n').textContent,
            ok: vocabSeason.state.street.run.ok, busy: vocabSeason.state.street.busy}; }""")
        if "is-done" in d["cls"] or "is-open" in d["cls"] or d["ok"] or d["bag"] != "0" or d["busy"]:
            probs.append(f"tras el fallo la puerta no se queda para otro intento: {d}")
        if "season" in C.storage(page) and json.loads(C.storage(page)["season"]).get("2026", {}).get("halloween", {}).get("run", {}).get("ok"):
            probs.append("el fallo se guarda como acierto")
        # otro intento en la misma puerta: ahora bien
        sh2, _ = _door(page, 0)
        if sh2["target"] != sh["target"]:
            probs.append(f"la puerta 0 cambia de palabra al volver: {sh['target']} → {sh2['target']}")
        seen = {sh["mode"]: look}
        for i in range(1, 10):
            shi, lk = _door(page, i)
            seen.setdefault(shi["mode"], lk)
            n = page.evaluate("() => +document.getElementById('ss-bag-n').textContent")
            if n != i + 1:
                probs.append(f"puerta {i}: la bolsa dice {n} (se esperaba {i + 1})")
            b = page.evaluate(f"""() => {{ const b = document.querySelector('#app .ss-door[data-i="{i}"]');
              return [b.classList.contains('is-done'), !!b.querySelector('.ss-got'), !!b.querySelector('.ss-in img'), b.getAttribute('aria-label')]; }}""")
            if not (b[0] and b[1] and b[2]):
                probs.append(f"puerta {i}: acertada pero no queda abierta con ✓ y su dibujo: {b}")
        if set(seen) != {"word", "pic"}:
            probs.append(f"no salen los dos modos: {sorted(seen)}")
        w = seen.get("word")
        if w and not (w["n"] == 3 and w["word"] and w["draw"] and w["right"] == 1 and not w["imgs"]):
            probs.append(f"modo palabra: dibujo y 3 palabras escritas: {w}")
        p = seen.get("pic")
        if p and not (p["n"] == 3 and p["pic"] and not p["draw"] and p["right"] == 1 and p["imgs"] == 3):
            probs.append(f"modo dibujo: oír y 3 dibujos: {p}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_full_bag_sticker_and_award_once_a_day():
    """Con las 10: «¡Bolsa llena!», una pegatina nueva en «Mis cosas de Halloween» y award(10, "¡Truco o trato!")
    (las monedas suben 10). «Otra vez» y otra bolsa el mismo día: ni monedas ni pegatina. Al recargar, la tarjeta de
    antes sin cobrar. Al día siguiente, otra bolsa da otra pegatina y otra vez award(10). La fila de Hoy lo cuenta."""
    probs = []
    page = _page(now=OCT)
    try:
        _open(page, OCT)
        c0 = page.evaluate("() => store.get('game', {}).coins")
        _all_doors(page, 10)
        page.wait_for_timeout(500)
        f = page.evaluate("""() => ({shown: !document.getElementById('ss-full').hidden, t: document.querySelector('.ss-ft').textContent,
          m: document.querySelector('.ss-fm').textContent.replace(/\\s+/g, ' ').trim(), cosas: document.querySelector('#ss-cosas').getAttribute('href'),
          again: !!document.getElementById('ss-again')})""")
        if not f["shown"] or f["t"] != "¡Bolsa llena!" or "Pegatina nueva" not in f["m"] or f["cosas"] != "#/temporada/cosas" or not f["again"]:
            probs.append(f"bolsa llena: {f}")
        aw = page.evaluate("() => __aw")
        if aw != [[10, "¡Truco o trato!"]]:
            probs.append(f"bolsa llena: award {aw} (se esperaba una vez 10)")
        c1 = page.evaluate("() => store.get('game', {}).coins")
        if c1 - c0 != 10:
            probs.append(f"las monedas suben {c1 - c0} (se esperaban 10)")
        s = _saved(page)["2026"]["halloween"]
        if list(s.get("st", {})) != ["pumpkin"] or s.get("last") != "2026-10-17" or s.get("bags") != 1:
            probs.append(f"guardado tras la primera bolsa: {s}")
        C.shot(page, "F4d-truco-llena-phone-light", _OUT, full_page=False)
        # otra bolsa el mismo día
        page.click("#ss-again")
        page.wait_for_timeout(200)
        if page.evaluate(_ST)["street"]["run"]["ok"] or page.evaluate("() => document.querySelectorAll('#app .ss-door.is-done').length"):
            probs.append("«Otra vez» no cierra las puertas")
        _all_doors(page, 10)
        page.wait_for_timeout(900)
        if page.evaluate("() => __aw.length") != 1:
            probs.append(f"la segunda bolsa del día da monedas: {page.evaluate('() => __aw')}")
        s = _saved(page)["2026"]["halloween"]
        if list(s.get("st", {})) != ["pumpkin"] or s.get("bags") != 1:
            probs.append(f"la segunda bolsa del día da pegatina: {s}")
        if "Mañana" not in page.evaluate("() => document.querySelector('.ss-fm').textContent"):
            probs.append("la segunda bolsa no dice que mañana hay otra")
        C.reload(page)
        page.evaluate(_SPY)
        page.wait_for_timeout(900)
        if page.evaluate("() => document.getElementById('ss-full').hidden") or page.evaluate("() => __aw.length"):
            probs.append("al recargar con la bolsa llena no sale la tarjeta o se cobra otra vez")
        C.goto(page, "#/temporada/cosas")
        k = page.evaluate("""() => ({on: [...document.querySelectorAll('#app .ss-stk[data-w]')].map(b => b.dataset.w),
          off: document.querySelectorAll('#app .ss-stk.is-off').length, t: document.querySelector('#app .ss-ct').textContent,
          seg: document.querySelector('#app .ss-seg [aria-selected=true]').textContent})""")
        if k != {"on": ["pumpkin"], "off": 9, "t": "Mis cosas de Halloween", "seg": "Mis cosas"}:
            probs.append(f"Mis cosas: {k}")
        page.click("#app .ss-stk[data-w=pumpkin]")
        if "pumpkin" not in page.evaluate("() => __said"):
            probs.append("tocar la pegatina no dice su palabra")
        C.shot(page, "F4d-truco-cosas-phone-light", _OUT)
        C.goto(page, "#/")
        r = page.evaluate(_ROW)
        if not r or "Vuelve mañana" not in r["t"]:
            probs.append(f"la fila de Hoy no dice que la bolsa está llena: {r}")
        # al día siguiente
        _next_day(page, _at(10, 18, 10))
        C.goto(page, "#/temporada")
        if page.evaluate(_ST)["street"]["run"]["ok"]:
            probs.append("al día siguiente las puertas siguen abiertas")
        _all_doors(page, 10)
        page.wait_for_timeout(900)
        if page.evaluate("() => __aw") != [[10, "¡Truco o trato!"]]:
            probs.append(f"al día siguiente la bolsa no da award(10): {page.evaluate('() => __aw')}")
        s = _saved(page)["2026"]["halloween"]
        if list(s.get("st", {})) != ["pumpkin", "ghost"] or s.get("bags") != 2 or s.get("last") != "2026-10-18":
            probs.append(f"al día siguiente, otra pegatina: {s}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_leaving_before_the_card_still_pays_once():
    """Si se va a otra pantalla justo al acertar la última puerta, la bolsa se cobra igual y una sola vez."""
    probs = []
    page = _page(now=OCT)
    try:
        _open(page, OCT)
        for i in range(9):
            _door(page, i)
        page.click("#app .ss-door[data-i='9']")
        sh = _sheet(page)
        page.locator(f"dialog#ss-q .ss-o[data-id='{sh['target']}']").click()
        C.goto(page, "#/")
        page.wait_for_timeout(1500)
        C.goto(page, "#/temporada")
        page.wait_for_timeout(1200)
        aw = page.evaluate("() => __aw")
        s = (_saved(page).get("2026") or {}).get("halloween", {})
        if aw != [[10, "¡Truco o trato!"]] or len(s.get("st", {})) != 1:
            probs.append(f"irse antes de la tarjeta: award {aw}, guardado {s}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Bonfire Night
def test_bonfire_five_boxes_fireworks_english_only():
    """3 de noviembre en inglés: «Bonfire Night» con 5 cajas (sus 5 palabras); cada acierto lanza fuegos (M.burst con
    oro, azul, verde azulado, verde y blanco, nunca naranja ni morado) y las 5 dan una pegatina y award(10,
    "¡Bonfire Night!") una vez. En francés, ni la fila ni la pantalla."""
    probs = []
    page = _page(now=NOV, reduced_motion="no-preference")
    try:
        _open(page, NOV)
        st = page.evaluate(_ST)["street"]
        if not st or st["id"] != "bonfire" or set(st["run"]["o"]) != {w["id"] for w in _DATA["bonfire"]} or len(st["run"]["o"]) != 5:
            probs.append(f"Bonfire Night no tiene sus 5 cajas: {st}")
        t = page.evaluate("() => [document.querySelector('#app .ss-t').textContent, document.querySelectorAll('#app .ss-door').length]")
        if t != ["Bonfire Night", 5]:
            probs.append(f"pantalla de Bonfire Night: {t}")
        C.shot(page, "F4d-bonfire-phone-light", _OUT, full_page=False)
        page.evaluate("() => { __bursts.length = 0; }")
        _door(page, 0)
        page.wait_for_timeout(700)
        b = page.evaluate("() => __bursts")
        if len(b) < 3 or any(x != _FIRE for x in b):
            probs.append(f"los fuegos no usan los colores de la app: {b}")
        _all_doors(page, 5)
        page.wait_for_timeout(900)
        if page.evaluate("() => __aw") != [[10, "¡Bonfire Night!"]]:
            probs.append(f"Bonfire Night: award {page.evaluate('() => __aw')}")
        s = _saved(page)["2026"]["bonfire"]
        if len(s.get("st", {})) != 1 or s.get("last") != "2026-11-03":
            probs.append(f"Bonfire Night: guardado {s}")
        if page.evaluate("() => document.querySelector('.ss-ft').textContent") != "¡Qué fuegos tan bonitos!":
            probs.append("Bonfire Night: la tarjeta final no es la suya")
        C.shot(page, "F4d-bonfire-llena-phone-light", _OUT, full_page=False)
        page.click("#ss-again")
        _all_doors(page, 5)
        page.wait_for_timeout(900)
        if page.evaluate("() => __aw.length") != 1:
            probs.append("Bonfire Night: la segunda vez del día también da monedas")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la granja
_FARM = """() => { const l = document.querySelector('#app .fm-stage .fm-season'); if (!l) return null;
  const a = document.querySelector('#app .fm-stage .fm-it'), z = e => getComputedStyle(e).zIndex;
  return {n: l.querySelectorAll('.ss-fd').length, pump: l.querySelectorAll('.ss-fd[src$="pumpkin.png"]').length,
    bats: l.querySelectorAll('.ss-fd-bat').length, loaded: [...l.querySelectorAll('.ss-fd')].every(i => i.complete && i.naturalWidth > 0),
    pe: [...l.querySelectorAll('.ss-fd')].every(i => getComputedStyle(i).pointerEvents === 'none'),
    zl: z(l), za: a ? z(a.closest('.fm-world') || a) : null, anims: [...l.querySelectorAll('.ss-fd-bat')].flatMap(i => i.getAnimations()).length,
    still: [...l.querySelectorAll('.ss-fd-bat')].every(i => i.classList.contains('still')),
    inside: [...l.querySelectorAll('.ss-fd')].every(i => { const r = i.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.width > 8; })}; }"""


def test_farm_pumpkins_and_bats():
    """En Halloween la capa .fm-season tiene 4 calabazas y 2 murciélagos (cargados, sin toques, dentro de la
    pantalla) y queda debajo de los animales; los murciélagos vuelan un poco y con «Reducir movimiento» están quietos.
    ?season=off los quita al momento. Sin capa (farm-mounted sin ella), nada y sin errores."""
    probs = []
    for kind, rm in (("phone", "no-preference"), ("phone", "reduce"), ("desk", "reduce")):
        page = _page(kind, now=OCT, reduced_motion=rm)
        tag = f"{kind} {rm}"
        try:
            _open(page, OCT, hash="#/granja")
            page.wait_for_selector("#app .fm-stage .fm-season .ss-fd", timeout=6000)
            page.wait_for_function("() => [...document.querySelectorAll('.fm-season .ss-fd')].every(i => i.complete)", timeout=6000)
            f = page.evaluate(_FARM)
            if not f or f["n"] != 6 or f["pump"] != 4 or f["bats"] != 2 or not f["loaded"] or not f["pe"] or not f["inside"]:
                probs.append(f"{tag}: la granja en Halloween: {f}")
            if rm == "reduce" and (f["anims"] or not f["still"]):
                probs.append(f"{tag}: con «Reducir movimiento» los murciélagos se mueven: {f}")
            if rm != "reduce" and not f["anims"]:
                probs.append(f"{tag}: los murciélagos no vuelan: {f}")
            if kind == "phone" and rm == "reduce":
                C.shot(page, "F4d-granja-phone-light", _OUT, full_page=False)
            if kind == "desk":
                C.shot(page, "F4d-granja-desk-light", _OUT, full_page=False)
            C.goto(page, "#/granja?season=off")
            page.wait_for_timeout(300)
            if page.evaluate("() => document.querySelectorAll('.fm-season .ss-fd').length"):
                probs.append(f"{tag}: ?season=off no quita las calabazas")
            n = page.evaluate("""() => { bus.emit('farm-mounted', {}); bus.emit('farm-mounted', null);
              return [vocabSeason.decorate(null), vocabSeason.decorate(document.createElement('div'))]; }""")
            if n != [0, 0]:
                probs.append(f"{tag}: sin capa se decora algo: {n}")
            probs += [f"{tag}: {e}" for e in C.errors(page)]
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


def test_farm_layer_is_under_the_animals():
    """La capa con las calabazas sigue entre el suelo y los animales (z-index de .fm-season menor que el de las cosas
    de la granja) y no recibe toques: tocar un animal encima de una calabaza llega al animal."""
    probs = []
    page = _page(now=OCT)
    try:
        _open(page, OCT, hash="#/granja")
        page.wait_for_selector("#app .fm-stage .fm-season .ss-fd", timeout=6000)
        r = page.evaluate("""() => { const st = document.querySelector('#app .fm-stage'), z = s => +getComputedStyle(st.querySelector(s)).zIndex;
          const it = st.querySelector('.fm-layer .fm-it'), fd = st.querySelector('.fm-season .ss-fd');
          const c = it.getBoundingClientRect(), hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
          return {ground: z('.fm-ground'), season: z('.fm-season'), layer: z('.fm-layer'), pe: getComputedStyle(fd).pointerEvents,
            hit: !!hit && !!hit.closest('.fm-it')}; }""")
        if not (r["ground"] < r["season"] < r["layer"]) or r["pe"] != "none":
            probs.append(f"la capa no queda entre el suelo y los animales: {r}")
        # una calabaza debajo de un animal: el toque llega al animal
        page.evaluate("""() => { const st = document.querySelector('#app .fm-stage'), it = st.querySelector('.fm-layer .fm-it'), fd = st.querySelector('.fm-season .ss-fd');
          const s = st.getBoundingClientRect(), c = it.getBoundingClientRect();
          fd.style.left = (c.left + c.width / 2 - s.left) + 'px'; fd.style.top = (c.bottom - s.top) + 'px'; }""")
        hit = page.evaluate("""() => { const it = document.querySelector('#app .fm-stage .fm-layer .fm-it'), c = it.getBoundingClientRect();
          const h = document.elementFromPoint(c.left + c.width / 2, c.top + c.height * .7); return !!h && !!h.closest('.fm-it'); }""")
        if not hit:
            probs.append("una calabaza tapa el toque de un animal")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- adviento
def _win(page, n, right=True, close="go"):
    page.evaluate("() => { __said.length = 0; }")
    page.click(f"#app .ss-w[data-n='{n}']")
    sh = _sheet(page)
    if sh["mode"] == "quiz":
        sel = f"dialog#ss-q .ss-o[data-id='{sh['target']}']" if right else f"dialog#ss-q .ss-o:not([data-id='{sh['target']}'])"
        page.locator(sel).first.click()
        page.wait_for_selector("#ss-q-go:not([hidden])", timeout=4000)
    page.click("#ss-q-go" if close == "go" else "dialog#ss-q [data-close]")
    _closed(page)
    page.wait_for_function("() => vocabSeason.state.advent && !vocabSeason.state.advent.busy", timeout=6000)
    page.wait_for_timeout(300)
    return sh


def test_advent_windows_today_past_future_and_coins():
    """5 de diciembre: 24 ventanitas; la 1-4 se pueden abrir, la 5 es la de hoy y la 6-24 tienen candado. Una de
    después solo avisa con amabilidad (sin hoja ni guardar). Abrir una enseña su dibujo, suena su palabra y pregunta
    con 2 opciones; la de hoy da award(5) una vez (ni al volver a abrirla ni al recargar); una de antes no da monedas.
    Al día siguiente, la 6 da otra vez award(5). Con ?season=advent en marzo, la de hoy es la 11."""
    probs = []
    page = _page(now=DEC)
    try:
        _open(page, DEC)
        w = page.evaluate("() => [...document.querySelectorAll('#app .ss-w')].map(b => [+b.dataset.n, b.className.replace('ss-w ', '').replace(' ss-call', ''), b.getAttribute('aria-disabled')])")
        want = [[n, "is-past" if n < 5 else "is-today" if n == 5 else "is-future", "true" if n > 5 else None] for n in range(1, 25)]
        if w != want:
            probs.append(f"las ventanitas el 5 de diciembre: {w}")
        if page.evaluate(_ST)["advent"]["today"] != 5:
            probs.append(f"la de hoy no es la 5: {page.evaluate(_ST)['advent']}")
        C.shot(page, "F4d-adviento-phone-light", _OUT)
        page.click("#app .ss-w[data-n='9']", force=True)
        page.wait_for_timeout(500)
        t = page.evaluate("() => [...document.querySelectorAll('[role=status]')].map(e => e.textContent.trim()).join(' | ')")
        if "Paciencia" not in t or "9" not in t:
            probs.append(f"la ventanita 9 no avisa con amabilidad: {t!r}")
        if page.evaluate("() => !!document.querySelector('dialog#ss-q[open]')") or "season" in C.storage(page):
            probs.append("una ventanita de después abre la hoja o guarda algo")
        sh = _win(page, 5)
        if sh["mode"] != "quiz" or sh["target"] != _DATA["advent"][4]["id"]:
            probs.append(f"la ventanita 5: {sh}")
        if _DATA["advent"][4]["w"]["english"] not in page.evaluate("() => __said"):
            probs.append("la ventanita 5 no dice su palabra")
        aw = page.evaluate("() => __aw")
        if aw != [[5, "¡Ventanita del día!"]]:
            probs.append(f"abrir la de hoy: award {aw}")
        s = _saved(page)["2026"]["advent"]
        if s != {"open": [5], "paid": "2026-12-05"}:
            probs.append(f"guardado tras la 5: {s}")
        if "is-open" not in page.evaluate("() => document.querySelector('#app .ss-w[data-n=\"5\"]').className"):
            probs.append("la ventanita 5 no queda abierta")
        sh = _win(page, 5, close="x")
        if sh["mode"] != "show":
            probs.append(f"volver a abrir la 5 no enseña solo la palabra: {sh}")
        _win(page, 2, right=False)
        if page.evaluate("() => __aw.length") != 1:
            probs.append(f"volver a abrir la de hoy o abrir una de antes da monedas: {page.evaluate('() => __aw')}")
        if _saved(page)["2026"]["advent"]["open"] != [2, 5]:
            probs.append(f"las abiertas: {_saved(page)['2026']['advent']}")
        C.reload(page)
        page.evaluate(_SPY)
        page.wait_for_timeout(1000)
        if page.evaluate("() => __aw.length"):
            probs.append("al recargar se cobra otra vez")
        o = page.evaluate("() => [...document.querySelectorAll('#app .ss-w.is-open')].map(b => +b.dataset.n)")
        if o != [2, 5]:
            probs.append(f"al recargar, abiertas {o}")
        C.goto(page, "#/")
        r = page.evaluate(_ROW)
        if not r or "¡Ventanita 5 abierta!" not in r["t"]:
            probs.append(f"la fila de Hoy: {r}")
        _next_day(page, _at(12, 6, 10))
        C.goto(page, "#/temporada")
        if page.evaluate(_ST)["advent"]["today"] != 6:
            probs.append("al día siguiente la de hoy no es la 6")
        _win(page, 6)
        if page.evaluate("() => __aw") != [[5, "¡Ventanita del día!"]]:
            probs.append(f"al día siguiente: award {page.evaluate('() => __aw')}")
        probs += C.errors(page)
    finally:
        page.context.close()

    page = _page(now=C.FIXED_NOW)
    try:
        _open(page, C.FIXED_NOW, hash="#/temporada?season=advent")
        page.wait_for_selector("#app .ss-cal", timeout=6000)
        if page.evaluate(_ST)["advent"]["today"] != 11 or not page.evaluate("() => document.querySelector('#app .ss-w[data-n=\"11\"]').classList.contains('is-today')"):
            probs.append(f"?season=advent en marzo: {page.evaluate(_ST)['advent']}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- datos, dibujos y audios
def test_words_drawings_and_recorded_audio():
    """data/season.json: 10 palabras de Halloween y 24 de adviento en los tres idiomas, 5 de Bonfire en inglés. Cada
    dibujo responde 200 y se dibuja; los de img/season son PNG de 220×220. Cada palabra con audio grabado
    (audio/<ab>.json) tiene su mp3; las demás suenan con la voz del navegador."""
    probs = []
    D = _DATA
    if [len(D.get(k, [])) for k in ("halloween", "bonfire", "advent")] != [10, 5, 24]:
        probs.append(f"cuántas palabras: {[len(D.get(k, [])) for k in ('halloween', 'bonfire', 'advent')]}")
    for k, langs in (("halloween", ("english", "français", "dansk")), ("advent", ("english", "français", "dansk")), ("bonfire", ("english",))):
        for w in D.get(k, []):
            miss = [L for L in langs if not (w.get("w") or {}).get(L)]
            if miss or not w.get("es") or not w.get("img"):
                probs.append(f"{k}/{w.get('id')}: le falta {miss or 'es/img'}")
    page = _page(now=C.FIXED_NOW)
    try:
        _open(page, C.FIXED_NOW, hash="")
        imgs = sorted({w["img"] for k in ("halloween", "bonfire", "advent") for w in D[k]})
        res = page.evaluate("""async imgs => Promise.all(imgs.map(async u => {
          const r = await fetch(u); const i = new Image(); i.src = u;
          try { await i.decode(); } catch (e) {}
          return [u, r.status, i.naturalWidth, i.naturalHeight]; }))""", imgs)
        for u, st, w, h in res:
            if st != 200 or not w:
                probs.append(f"el dibujo {u} no carga ({st}, {w}×{h})")
            elif u.startswith("img/season/") and (w, h) != (220, 220):
                probs.append(f"{u} mide {w}×{h} (220×220)")
        for f in sorted((C.ROOT / "img" / "season").glob("*.png")):
            if f"img/season/{f.name}" not in imgs:
                probs.append(f"img/season/{f.name} no lo usa ninguna palabra")
        clips = page.evaluate("""async D => {
          const out = {};
          for (const L of ['english', 'français', 'dansk']) {
            loadClips(L);
            for (let i = 0; i < 100 && !Object.keys(clipMaps[L] || {}).length; i++) await new Promise(r => setTimeout(r, 50));
            const m = clipMaps[L] || {}, ws = [...D.halloween, ...D.advent, ...(L === 'english' ? D.bonfire : [])].map(w => w.w[L]);
            out[L] = await Promise.all(ws.map(async t => { const id = m[speakable(t)];
              if (!id) return [t, null, null];
              const r = await fetch(`audio/${CLIP_AB[L]}/${id}.mp3`, {method: 'HEAD'}); return [t, id, r.status]; }));
          }
          return out; }""", D)
        total = 0
        for L, rows in clips.items():
            rec = [r for r in rows if r[1]]
            total += len(rec)
            if not rec:
                probs.append(f"{L}: ninguna palabra de temporada tiene audio grabado")
            probs += [f"{L}: «{t}» usa audio/{id}.mp3 que responde {st}" for t, id, st in rec if st != 200]
        if total < 40:
            probs.append(f"solo {total} palabras con audio grabado (se esperaban unas 50)")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- partida
def test_export_baseline_except_season_key():
    """La partida al arrancar es la de la base. Mirar la temporada sin jugar no guarda nada; jugar solo añade la clave
    "season" (objeto, en el inventario de js/save.js con tipo "o"), que se exporta y se vuelve a leer bien."""
    probs = []
    base = C.load_baseline()
    assert base, "falta tests/e2e/baseline/export.json"
    page = _page(now=C.FIXED_NOW)
    try:
        C.seed(page)
        snap = C.export(page)
        d = C.diff_exports(base, snap)
        if d:
            probs.append("al arrancar la partida no es la de la base:\n  " + "\n  ".join(d))
        for sid in ("halloween", "advent", "bonfire"):
            C.goto(page, f"#/temporada?season={sid}")
            page.wait_for_selector("#app .ss", timeout=6000)
            if sid != "advent":
                page.click("#app .ss-seg a[href='#/temporada/cosas']")
            page.wait_for_timeout(300)
        C.goto(page, "#/?season=auto")
        d = C.diff_exports(snap, C.export(page), allow_new=False)
        if d:
            probs.append("mirar la temporada cambia la partida:\n  " + "\n  ".join(d))
        page.evaluate(_SPY)
        C.goto(page, "#/temporada?season=halloween")
        _door(page, 0)
        C.goto(page, "#/temporada?season=advent")
        _win(page, 11)
        after = C.export(page)
        # abrir la ventanita de hoy da award(5): solo cambia game (las monedas) además de la clave nueva
        keys = dict(after["keys"])
        g0, g1 = json.loads(snap["keys"]["game"]), json.loads(keys["game"])
        if g1.get("coins") - g0.get("coins") != 5 or {k: v for k, v in g1.items() if k not in ("coins", "earned")} != \
                {k: v for k, v in g0.items() if k not in ("coins", "earned")}:
            probs.append(f"game cambia más que las 5 monedas: {g0.get('coins')} → {g1.get('coins')}")
        keys["game"] = snap["keys"]["game"]
        d = C.diff_exports(base, dict(after, keys=keys), allow_new=["season"])
        if d:
            probs.append("jugar cambia otras claves:\n  " + "\n  ".join(d))
        if C.new_keys(base, after) != ["season"]:
            probs.append(f"claves nuevas: {C.new_keys(base, after)}")
        v = json.loads(after["keys"].get("season", "null"))
        if not isinstance(v, dict) or set(v) != {"2026"} or set(v["2026"]) != {"halloween", "advent"}:
            probs.append(f"la clave season: {v}")
        t = page.evaluate("""() => [vocabSave.typeOf('season'), vocabSave.inventory.exact.includes('season'),
          (() => { const p = vocabSave.parse(JSON.stringify(vocabSave.snapshot())); return p.ok && 'season' in p.data.keys; })()]""")
        if t != ["o", True, True]:
            probs.append(f"js/save.js y la clave season (tipo, inventario, se vuelve a leer): {t}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- aspecto
def test_looks_contrast_palette_and_captures():
    """Móvil y escritorio, claro y oscuro: la calle, la hoja (palabras y dibujos), la tarjeta final, «Mis cosas», las
    cajas de Bonfire Night y el calendario (y su hoja) pasan el contraste y la paleta (sin naranja ni morado), las
    puertas y ventanitas miden ≥ 44 px y nada se sale de lado. Capturas F4d-*."""
    probs = []
    for kind in ("phone", "desk"):
        for scheme in ("light", "dark"):
            tag = f"{kind}-{scheme}"
            page = _page(kind, now=OCT, color_scheme=scheme)
            try:
                _open(page, OCT)
                _audit(page, f"{tag} calle", probs)
                small = page.evaluate("""() => [...document.querySelectorAll('#app .ss-door, #app .ss-seg a, #app .ss-back')].filter(b => {
                  const r = b.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).map(b => b.className + ' ' + b.textContent.trim())""")
                if small:
                    probs.append(f"{tag}: pequeños: {small}")
                if page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1"):
                    probs.append(f"{tag}: la calle se sale de lado")
                C.shot(page, f"F4d-truco-{tag}", _OUT, full_page=False)
                modes = set()
                for i in range(10):
                    page.click(f"#app .ss-door[data-i='{i}']")
                    sh = _sheet(page)
                    if sh["mode"] not in modes:
                        modes.add(sh["mode"])
                        page.wait_for_timeout(250)
                        _audit(page, f"{tag} hoja {sh['mode']}", probs)
                        C.shot(page, f"F4d-truco-hoja-{sh['mode']}-{tag}", _OUT, full_page=False)
                    page.locator(f"dialog#ss-q .ss-o[data-id='{sh['target']}']").click()
                    _closed(page)
                    page.wait_for_function(f"() => vocabSeason.state.street.run.ok.includes({i}) && !vocabSeason.state.street.busy", timeout=10000)
                page.wait_for_timeout(600)
                _audit(page, f"{tag} bolsa llena", probs)
                if kind == "desk":
                    C.shot(page, f"F4d-truco-llena-{tag}", _OUT, full_page=False)
                C.goto(page, "#/temporada/cosas")
                _audit(page, f"{tag} mis cosas", probs)
                if scheme == "dark":
                    C.shot(page, f"F4d-truco-cosas-{tag}", _OUT, full_page=False)
                C.goto(page, "#/temporada?season=bonfire")
                page.wait_for_selector("#app .ss-bonfire .ss-door", timeout=6000)
                _audit(page, f"{tag} bonfire", probs)
                if scheme == "dark" or kind == "desk":
                    C.shot(page, f"F4d-bonfire-{tag}", _OUT, full_page=False)
                C.goto(page, "#/temporada?season=advent")
                page.wait_for_selector("#app .ss-cal", timeout=6000)
                _audit(page, f"{tag} calendario", probs)
                small = page.evaluate("""() => [...document.querySelectorAll('#app .ss-w')].filter(b => {
                  const r = b.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).length""")
                if small:
                    probs.append(f"{tag}: {small} ventanitas pequeñas")
                if page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1"):
                    probs.append(f"{tag}: el calendario se sale de lado")
                C.shot(page, f"F4d-adviento-{tag}", _OUT, full_page=kind == "phone")
                page.click("#app .ss-w[data-n='17']")
                sh = _sheet(page)
                page.wait_for_timeout(250)
                _audit(page, f"{tag} hoja ventanita", probs)
                page.locator(f"dialog#ss-q .ss-o[data-id='{sh['target']}']").click()
                page.wait_for_selector("#ss-q-go:not([hidden])", timeout=4000)
                page.wait_for_timeout(250)
                _audit(page, f"{tag} hoja ventanita contestada", probs)
                C.shot(page, f"F4d-adviento-hoja-{tag}", _OUT, full_page=False)
                page.click("#ss-q-go")
                _closed(page)
                probs += [f"{tag}: {e}" for e in C.errors(page)]
            finally:
                page.context.close()
    assert not probs, "\n".join(probs)
