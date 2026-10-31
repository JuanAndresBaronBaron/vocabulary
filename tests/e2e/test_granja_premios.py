"""La granja, los premios y las metas largas (js/farm.js, js/shop.js, js/rewards.js, js/album.js, la mezcla de misiones
y la comida del cofre de js/buddy.js, streak()/achList de index.html).

Se comprueba: la vecina (lo que la app estuvo cerrada más de 24 h no cuenta como hambre: un viaje de 6 días no manda a
nadie al refugio y el globo dice «¡La vecina les dio de comer!»; el refugio sigue para el hambre mientras juega; también
con la granja abierta y el aparato dormido; mergeSeen de una copia de Google Drive); arrancar no escribe nada y «visto»
(farm:state.ls) no cambia el hash de la copia; 24 h jugando solo a la granja (con farmMount.debug.shift) ganan menos de lo
que cuesta la comida; la palabra dominada (bus "mastered") da +5 una vez con la palabra y su IPA, y su pegatina se pone
dorada; la racha amable (días de descanso con copo azul en Premios y en Hoy, «Empieza tu semana» tras parar, nunca un 0);
«Mi deseo» (botón, barra en la tienda, Mi zorro y Premios, aviso una sola vez, «Ganar monedas»); la IPA en las piezas,
los globos, la comida, el refugio y el regalo; la copa de la semana, la estantería, los niveles de las medallas y las
medallas nuevas; la meta del álbum; el «Visitante del día» (cabe a 360 px, acertar puntúa en el repaso y da 5 monedas,
fallar en gris); vocabFarm.giveFood; como mucho una misión de la granja al día; sin culpa en los textos. Capturas en
capturas/granja."""
from __future__ import annotations

import datetime as _dt
import glob
import json
import re
from pathlib import Path

import common as C

H = 3600 * 1000
DAY = 24 * H
T0 = int(C.FIXED_NOW.timestamp() * 1000)
OUT = C.CAPTURAS / "granja"
_GAMEJ = json.loads((C.REPO / "data" / "game.json").read_text(encoding="utf-8"))
_ITEM = {x["id"]: x for x in _GAMEJ}

_FARM = "() => JSON.parse(localStorage.getItem('farm:state'))"
_GAME = "() => JSON.parse(localStorage.getItem('game'))"
# avisos, monedas que entran, eventos, sonidos y vibraciones (se ponen en Hoy, antes de navegar)
_HOOKS = """() => {
  if (window.__gpHooks) return; window.__gpHooks = true;
  window.__toasts = []; window.__aw = []; window.__ev = []; window.__sfx = []; window.__hap = [];
  if (window.M && M.toast) { const t0 = M.toast.bind(M); M.toast = (t, o) => { __toasts.push(String(t)); return t0(t, o); }; }
  const a0 = window.award; window.award = (n, ...r) => { __aw.push([n, String(r[0] || '')]); return a0(n, ...r); };
  for (const n of ['farm-feed', 'farm-visitor', 'farm-food', 'mastered-paid', 'wish', 'farm-find'])
    bus.on(n, d => __ev.push([n, d && d.food ? d.food : d && 'ok' in d ? d.ok : d && d.n != null ? d.n : d && d.word ? d.word : null]));
  if (window.sfx) { const p0 = sfx.play.bind(sfx); sfx.play = n => { __sfx.push(n); return p0(n); }; }
  if (window.G) { const h0 = G.haptic.bind(G); G.haptic = t => { __hap.push(t); return h0(t); }; }
}"""
# texto visible sin los separadores invisibles de ipaHtml ni la etiqueta «IPA: » (solo para lectores de pantalla)
_IPA_TXT = "el => el ? el.textContent.replace(/\\u2060/g, '').replace(/^IPA: /, '').trim() : null"
_NO_HSCROLL = "() => ({sw: document.documentElement.scrollWidth, iw: innerWidth})"


def _keys(farm=None, game=None, act=None, **top):
    """La partida sembrada con cambios (dicts que se mezclan en farm:state y game; act se cambia entero)."""
    data = C.seed_data()
    if farm:
        data["farm:state"].update(farm)
    if game:
        data["game"].update(game)
    if act is not None:
        data["act"] = act
    data.update(top)
    return {k: json.dumps(v, ensure_ascii=False, separators=(",", ":")) for k, v in data.items()}


def _act(days_ago):
    """act con actividad los días indicados (días antes de FIXED_NOW)."""
    return {C.day_key(C.FIXED_NOW - _dt.timedelta(days=d)): 10 for d in sorted(days_ago, reverse=True)}


def _open(page, keys=None, hash=""):
    C.seed(page, keys)
    page.evaluate(_HOOKS)
    if hash:
        C.goto(page, hash)


def _farm(page):
    C.goto(page, "#/granja")
    page.wait_for_selector("#app .fm-stage .fm-it", timeout=8000)


def _hscroll(page, label, probs):
    m = page.evaluate(_NO_HSCROLL)
    if m["sw"] > m["iw"] + 1:
        probs.append(f"{label}: scroll horizontal ({m['sw']} > {m['iw']})")


# ---------------------------------------------------------------- la vecina
def test_vecina_da_de_comer_al_volver_de_viaje():
    """Un viaje de 6 días con la app cerrada (farm:state.ls de hace 144 h y las horas de comer de antes del viaje): al
    arrancar nadie se va al refugio (sin la vecina, los 4 se habrían ido), las horas de comer se adelantan lo que pasa de
    24 h, ls pasa a ahora y en la granja el globo dice «¡La vecina les dio de comer!» (y luego nb se borra). Con la app
    vista hace 1 h, el conejo que lleva 121 h sin comer sí se va al refugio (el refugio es para el hambre mientras juega).
    Con la granja abierta y el aparato dormido 3 días (debug.shift): la vecina también, sin refugio. mergeSeen: una copia
    que llega más vieja se adelanta igual; una más nueva no se toca."""
    probs = []
    trip = 144 * H
    d = C.seed_data()
    f = d["farm:state"]
    fed0 = dict(f["fed"])
    page = C.new_page("phone", reduced_motion="reduce")
    try:
        _open(page, _keys(farm={"ls": T0 - trip, "fed": {k: v - trip for k, v in fed0.items()}, "visit": f["visit"] - trip}))
        now = page.evaluate("Date.now()")
        st = page.evaluate(_FARM)
        shel = page.evaluate("() => farmMount.care.shelterList().map(x => x.id)")
        if shel:
            probs.append(f"tras el viaje se fueron al refugio: {shel}")
        for k, v in fed0.items():
            want = v - 24 * H   # lo que pasó del viaje más allá de 24 h no cuenta
            if abs(st["fed"][k] - want) > 90_000:
                probs.append(f"fed.{k}: {(T0 - st['fed'][k]) / H:.1f} h (se esperaban {(T0 - want) / H:.1f} h)")
        if abs(st.get("ls", 0) - now) > 90_000 or not st.get("nb"):
            probs.append(f"tras el viaje: ls={st.get('ls')} nb={st.get('nb')} (ahora {now})")
        _farm(page)
        try:
            page.wait_for_function("() => /La vecina les dio de comer/.test((document.querySelector('#app .fm-bub') || {}).textContent || '')", timeout=8000)
        except Exception:
            probs.append("no sale «¡La vecina les dio de comer!» en el globo de la bienvenida")
        txt = page.evaluate("() => document.querySelector('#app .fm-bub').textContent")
        if "echaban de menos" in txt or "Tienen hambre" in txt:
            probs.append(f"el globo de la bienvenida riñe: {txt!r}")
        C.shot(page, "vecina-390", OUT, full_page=False)
        if "nb" in page.evaluate(_FARM):
            probs.append("farm:state.nb sigue tras enseñarlo")
        # la granja abierta y el aparato dormido 3 días
        page.evaluate("() => { document.querySelector('#app .fm-bub').textContent = ''; farmMount.debug.shift = 3 * 864e5; farmMount.debug.tick(); }")
        page.wait_for_timeout(400)
        if page.evaluate("() => farmMount.care.shelterList().length"):
            probs.append("dormido 3 días con la granja abierta: alguien se fue al refugio")
        if not page.evaluate("() => /La vecina/.test(document.querySelector('#app .fm-bub').textContent)"):
            probs.append("dormido 3 días con la granja abierta: no sale la vecina")
        # mergeSeen (js/save.js al cargar una copia)
        m = page.evaluate("""T => {
          const H = 36e5, inc = {fed: {conejo: T - 50 * H, vaca: T - 30 * H}, ls: T - 30 * H, visit: T - 40 * H, shelter: {}};
          const here = {fed: {}, ls: T};
          const a = JSON.parse(vocabFarm.mergeSeen(JSON.stringify(inc), JSON.stringify(here)));
          const newer = JSON.stringify(Object.assign({}, inc, {ls: T + H}));
          const b = vocabFarm.mergeSeen(newer, JSON.stringify(here));
          const old = JSON.parse(vocabFarm.mergeSeen(JSON.stringify({fed: {conejo: T - 50 * H}, visit: T - 100 * H}), JSON.stringify(here)));
          return {a, same: b === newer, old};
        }""", T0)
        if m["a"]["ls"] != T0 or m["a"]["fed"]["conejo"] != T0 - 44 * H or m["a"]["fed"]["vaca"] != T0 - 24 * H:
            probs.append(f"mergeSeen con una copia más vieja: {m['a']}")
        if not m["same"]:
            probs.append("mergeSeen cambia una copia más nueva")
        if m["old"]["fed"]["conejo"] != T0 or m["old"]["ls"] != T0:   # sin ls: cuenta desde la visita (76 h de más)
            probs.append(f"mergeSeen sin ls: {m['old']}")
        probs += C.errors(page)
    finally:
        page.context.close()
    # el refugio sigue para el hambre mientras juega
    page = C.new_page("phone", reduced_motion="reduce")
    try:
        fed = dict(fed0, conejo=T0 - 121 * H)
        _open(page, _keys(farm={"ls": T0 - 1 * H, "fed": fed}))
        if page.evaluate("() => farmMount.care.shelterList().map(x => x.id)") != ["conejo"]:
            probs.append(f"jugando, 121 h sin comer no lleva al refugio: {page.evaluate('() => farmMount.care.shelterList()')}")
        if page.evaluate(_FARM).get("nb"):
            probs.append("con la app vista hace 1 h, la vecina dice que les dio de comer")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


def test_arrancar_no_escribe_y_visto_no_sube():
    """Arrancar (y esperar 1 s) no cambia farm:state ni game; con la app abierta 2,5 min, «visto» (farm:state.ls) se
    apunta, pero el hash de la copia de Google Drive (vocabSync.hash) es el mismo y no entra ninguna moneda (nada paga
    por abrir la app ni por el tiempo)."""
    probs = []
    page = C.new_page("phone")
    try:
        keys = _keys()
        _open(page, keys)
        page.wait_for_timeout(1000)
        for k in ("farm:state", "game", "act", "buddy:missions"):
            if page.evaluate(f"() => localStorage.getItem('{k}')") != keys[k]:
                probs.append(f"arrancar cambia {k}")
        h0 = page.evaluate("() => window.vocabSync && vocabSync.hash ? vocabSync.hash() : null")
        page.clock.fast_forward(150_000)
        page.wait_for_timeout(400)
        st = page.evaluate(_FARM)
        if not st.get("ls"):
            probs.append("con la app abierta 2,5 min no se apunta «visto» (farm:state.ls)")
        if h0 is not None and page.evaluate("() => vocabSync.hash()") != h0:
            probs.append("apuntar «visto» cambia el hash de la copia (subiría a Drive)")
        if page.evaluate(_GAME)["coins"] != 245 or page.evaluate("() => __aw.length"):
            probs.append(f"entran monedas por tener la app abierta: {page.evaluate('() => __aw')}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- la economía
_SESSION = r"""async ([first]) => {
  const W = ms => new Promise(r => setTimeout(r, ms));
  const until = async (f, ms = 6000) => { const t0 = Date.now(); for (;;) { const v = f(); if (v) return v; if (Date.now() - t0 > ms) return null; await W(40); } };
  const q = s => document.querySelector(s), log = [];
  const popX = async () => { const x = q('#app .fm-pop:not([hidden]) .fm-x'); if (x) { x.click(); await W(200); } };
  // el visitante del día (acertar)
  const vis = q('#app .fm-vis:not([disabled])');
  if (vis) {
    vis.click();
    const say = await until(() => q('#app .fm-pop:not([hidden]) .fm-vsay'), 3000);
    if (say) { const b = [...document.querySelectorAll('#app .fm-pop .fm-opt')].find(o => o.textContent.trim() === say.dataset.say);
      if (b) { b.click(); log.push('vis'); } await W(300); await popX(); }
  }
  // dar de comer a todos los que pueden comer y acertar «¿Cómo me llamo?» (regalo doble)
  for (const id of farmMount.care.animals()) {
    if (!farmMount.care.canEat(id)) continue;
    const food = farmMount.care.foodOf(id);
    q(`#app .fm-it[data-fid="${id}"] .fm-e`).click();
    const fb = await until(() => q(`#app .fm-pop:not([hidden])[data-kind="feed"] [data-food="${food}"]`), 3000);
    if (!fb) { log.push('no-feed:' + id); await popX(); continue; }
    fb.click();
    const ok = await until(() => q(`#app .fm-pop:not([hidden])[data-kind="quiz"] .fm-opt[data-fo="${id}"]`), 5000);
    if (ok) { ok.click(); await until(() => q('#app .fm-pop').hidden, 4000); }
    await W(900);
    log.push('fed:' + id);
  }
  // recoger todo lo del suelo (regalos y fruta)
  for (let i = 0; i < 40; i++) { const p = q('#app .fm-prod:not(.got)'); if (!p) break; p.click(); await W(140); }
  // plantas: cosechar lo maduro y regar todo lo que se pueda (gratis o con gotas)
  const pl = () => JSON.parse(localStorage.getItem('farm:state')).pl;
  const wb = () => q('#app .fm-dock [data-fm="water"]');
  const waterOn = () => wb().getAttribute('aria-pressed') === 'true';
  // (con «Regar» puesto, tocar una planta madura la cosecha)
  if (!waterOn()) { wb().click(); await W(620); }
  for (const id of Object.keys(pl()).filter(id => farmMount.kinds.plant.includes(id))) {
    const el = () => q(`#app .fm-it[data-fid="${id}"] .fm-e`);
    for (let k = 0; k < 5; k++) {
      const p0 = pl()[id], before = JSON.stringify(p0), ripe = p0.s >= 2, free = Date.now() + farmMount.debug.shift - (p0.w || 0) >= 8 * 36e5;
      el().click(); await W(ripe ? 600 : 950);
      if (JSON.stringify(pl()[id]) === before) break;
      log.push((ripe ? 'harv:' : free ? 'water-free:' : 'water-drop:') + id);
    }
  }
  if (waterOn()) { wb().click(); await W(620); }
  // «¿Dónde está…?»: una partida acertándolo todo
  q('#app .fm-hero').dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
  const pb = await until(() => q('#app .fm-bub [data-play-find]'), 3000);
  if (pb) {
    pb.click();
    for (let r = 0; r < 5; r++) {
      const b = await until(() => { const x = q('#app .fm-find:not([hidden]) .fm-ft b[lang]'); return x && !x.dataset.done ? x : null; }, 5000);
      if (!b) break;
      b.dataset.done = '1';
      const w = b.textContent.trim(), it = SHOP.find(x => x.t === 'farm' && itemWord(x) === w && q(`#app .fm-it[data-fid="${x.id}"]`));
      q(`#app .fm-it[data-fid="${it.id}"] .fm-e`).click();
      await W(150);
    }
    await until(() => q('#app .fm-find .fm-fa'), 6000);
    log.push('find');
    const x = q('#app .fm-find .fm-fq'); if (x) x.click();
    await W(300);
  }
  if (first && window.vocabBuddy) { if (vocabBuddy.claim('feed')) log.push('mission'); }
  return log;
}"""


def test_la_granja_no_se_paga_sola():
    """24 h jugando solo a la granja (3 visitas: ahora, a las 8 h y a las 16 h, con farmMount.debug.shift): dar de comer
    a todo el que puede (y acertar su nombre: regalo doble), recoger todo, cosechar y regar todo lo que se pueda, una
    partida de «¿Dónde está…?» en cada visita, el visitante del día y la misión de la granja. Lo que entra es menos que lo
    que cuesta la comida que se comieron. Cosechar y cada regalo pagan 1; «¿Dónde está?» paga 2 partidas al día; el agua
    gratis vuelve a las 8 h."""
    probs = []
    page = C.new_page("phone", reduced_motion="reduce")
    try:
        _open(page, _keys(farm={"pan": {"grano": 20, "zanahoria": 20, "heno": 20}}))
        _farm(page)
        page.wait_for_selector("#app .fm-vis", timeout=8000)
        page.wait_for_timeout(600)
        logs = []
        for i, sh in enumerate((0, 8, 16)):
            page.evaluate("h => { farmMount.debug.shift = h * 36e5; farmMount.debug.tick(); }", sh)
            page.wait_for_timeout(500)
            logs.append(page.evaluate(_SESSION, [i == 0]))
        aw = page.evaluate("() => __aw")
        foods = page.evaluate("() => farmMount.care.foods()")
        meals = [f for n, f in page.evaluate("() => __ev") if n == "farm-feed"]
        cost = sum(foods[f]["c"] for f in meals)
        income = sum(n for n, _ in aw if n > 0)
        finds = [n for n, w in aw if w in ("¿Dónde está?", "¡Lo encontraste todo!")]
        harv = [n for n, w in aw if w.startswith("¡") and any(x in w.lower() for x in ("flor", "girasol", "zanahoria"))]
        summary = f"comidas {len(meals)} (cuestan {cost}) · entra {income}: {aw} · visitas {logs}"
        if len(meals) < 10:
            probs.append(f"no se pudo dar de comer lo esperado: {summary}")
        if not income < cost:
            probs.append(f"la granja se paga sola: {summary}")
        if sum(finds) > 10 or len(finds) > 2:
            probs.append(f"«¿Dónde está?» paga más de 2 partidas al día: {finds}")
        if any(n != 1 for n in harv) or not harv:
            probs.append(f"cosechar no paga 1: {harv}")
        if sum(1 for lg in logs for x in lg if x == "find") != 3:
            probs.append(f"no se jugaron 3 partidas: {logs}")
        # cada planta bebe gratis como mucho una vez en cada visita (cada 8 h); lo demás gasta gotas (las de las
        # lecciones y las del abono del conejo)
        for i, lg in enumerate(logs):
            free = [x.split(":")[1] for x in lg if x.startswith("water-free:")]
            if len(free) != len(set(free)):
                probs.append(f"visita {i}: el agua gratis vuelve antes de 8 h: {free}")
        print(f"    economía: {summary[:400]}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- palabra dominada
_PICK = """async () => { const m = srsAll();
  for (const [k, x] of Object.entries(m)) { if ((x.b || 0) >= MASTER) continue;
    const doc = await getDoc(x.d), r = doc && doc.rows.find(r => r.es === x.e && r.l && r.l.english && r.l.english.ipa && r.img);
    if (r) return {k, doc: x.d, es: x.e, w: r.l.english.word, ipa: r.l.english.ipa}; }
  return null; }"""


def test_palabra_dominada_paga_5_con_ipa_y_dorada():
    """bus "mastered" {k, doc, es, lang} (lo emite el repaso la primera vez que una palabra queda dominada): +5 monedas
    una vez (el mismo aviso otra vez no paga), «¡Palabra dominada! <palabra> <IPA> +5» con la palabra en su idioma y la
    IPA, "mastered-paid"; su pegatina del álbum sale dorada. Sin el aviso no entra nada."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page)
        w = page.evaluate(_PICK)
        assert w, "no hay ninguna palabra sin dominar con IPA y dibujo en la partida sembrada"
        page.evaluate("""w => { const m = JSON.parse(localStorage.getItem('srs:english')); const x = m[w.k];
          x.b = MASTER; x.due = today() + 30; x.tm = 1; localStorage.setItem('srs:english', JSON.stringify(m));
          const o = window.srsMastered;
          window.srsMastered = y => !!(y && y.tm) || (typeof o === 'function' ? o(y) : (y.b || 0) >= MASTER); }""", w)
        page.evaluate("w => bus.emit('mastered', {k: w.k, doc: w.doc, es: w.es, lang: 'english'})", w)
        try:
            page.wait_for_selector("#m-toasts .m-tt[data-rich]", timeout=5000)
        except Exception:
            probs.append(f"no sale el aviso de la palabra dominada: {page.evaluate('() => __toasts')}")
        t = page.evaluate("""() => { const t = document.querySelector('#m-toasts .m-tt[data-rich]'); if (!t) return null;
          const b = t.querySelector('b[lang]'), i = t.querySelector('.ipa');
          return {txt: t.textContent, w: b && b.textContent, lang: b && b.getAttribute('lang'), ipa: i && i.textContent.replace(/\\u2060/g, '').replace(/^IPA: /, '')}; }""")
        if not t or "¡Palabra dominada!" not in t["txt"] or t["w"] != w["w"] or t["lang"] != "en-GB" or t["ipa"] != w["ipa"] or "+5" not in t["txt"]:
            probs.append(f"el aviso: {t} (se esperaba {w})")
        C.shot(page, "dominada-390", OUT, full_page=False)
        page.evaluate("w => bus.emit('mastered', {k: w.k, doc: w.doc, es: w.es, lang: 'english'})", w)
        page.wait_for_timeout(600)
        if page.evaluate(_GAME)["coins"] != 250:
            probs.append(f"monedas tras dominar (y repetir el aviso): {page.evaluate(_GAME)['coins']} (se esperaban 250)")
        if [e for e in page.evaluate("() => __ev") if e[0] == "mastered-paid"].__len__() != 1:
            probs.append(f"mastered-paid: {page.evaluate('() => __ev')}")
        C.goto(page, f"#/album/{w['doc']}")
        page.wait_for_selector("#app .al-st", timeout=8000)
        g = page.evaluate("k => { const s = [...document.querySelectorAll('#app .al-st')].find(x => x.dataset.k === k); return s ? s.className : null; }", w["k"])
        if not g or "gold" not in g.split():
            probs.append(f"la pegatina de {w['k']} no es dorada: {g}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- racha amable
def test_racha_amable_descansos_y_empieza_tu_semana():
    """De "act" sin clave nueva: 7 días seguidos guardan 1 día de descanso (2 como mucho) que se usa solo si falta un
    día. 7 días (del 2 al 8 de marzo), el lunes 9 sin practicar, el 10 y hoy: racha 9 y el lunes es un punto azul con
    un copo en Premios y en Hoy. 21 seguidos y 2 sin practicar: siguen (2 descansos); el tercero la corta. Tras parar
    de verdad: «Empieza tu semana» en Hoy (sin «0») y en Premios, y Hoy sin scroll a 360×740 y 390×844."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page, _keys(act=_act([9, 8, 7, 6, 5, 4, 3, 1, 0])))
        si = page.evaluate("() => streakInfo()")
        if si["n"] != 9 or si["used"] != ["2026-03-09"] or si["rest"] != 0 or page.evaluate("() => streak()") != 9:
            probs.append(f"7 días + descanso + 2: {si}")
        hw = page.evaluate("""() => { const w = document.getElementById('hm-week'); if (!w) return null;
          return {chip: w.querySelector('.hm-wf').textContent.trim(), rest: [...w.querySelectorAll('.hm-wd li.rest')].map(li => !!li.querySelector('svg')),
            label: w.getAttribute('aria-label')}; }""")
        if not hw or hw["chip"] != "9" or hw["rest"] != [True] or "descanso" not in (hw["label"] or ""):
            probs.append(f"Hoy con un día de descanso: {hw}")
        C.goto(page, "#/progreso")
        page.wait_for_selector("#rw .rw-days", timeout=6000)
        d = page.evaluate("""() => { const li = document.querySelector('#rw .rw-d[data-day="2026-03-09"]'), dot = li && li.querySelector('.rw-dot');
          return li && {cls: li.className, snow: !!li.querySelector('.rw-snow'), lab: li.getAttribute('aria-label'), bg: getComputedStyle(dot).backgroundColor,
            n: document.getElementById('rw-st').textContent}; }""")
        if not d or "rest" not in d["cls"] or not d["snow"] or "descanso" not in d["lab"] or d["n"] != "9":
            probs.append(f"Premios con un día de descanso: {d}")
        else:
            r, g, b = [int(x) for x in re.findall(r"\d+", d["bg"])[:3]]
            if not (b > r + 40 and b > 120):
                probs.append(f"el día de descanso no es azul: {d['bg']}")
        C.shot(page, "racha-descanso-390", OUT)
        # 21 seguidos (3 descansos ganados, se guardan 2) y luego 2 días sin practicar: sigue; 3: se corta
        r = page.evaluate("""() => { const mk = (n, gap) => { const a = {}, d = new Date(); d.setDate(d.getDate() - n - gap);
            for (let i = 0; i < n; i++) { a[dayKey(d)] = 5; d.setDate(d.getDate() + 1); } return a; };
          const out = []; for (const gap of [2, 3]) { localStorage.setItem('act', JSON.stringify(mk(21, gap))); out.push(streakInfo()); } return out; }""")
        if r[0]["n"] != 21 or len(r[0]["used"]) != 2 or r[1]["n"] != 0:
            probs.append(f"21 días y 2 o 3 sin practicar: {r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    # tras parar de verdad
    for vw, vh in ((360, 740), (390, 844)):
        page = C.new_page("phone", viewport={"width": vw, "height": vh})
        try:
            _open(page, _keys(act=_act([10, 9, 8, 7, 6, 5])))
            if page.evaluate("() => streak()") != 0:
                probs.append(f"{vw}: tras 4 días sin practicar la racha no es 0 por dentro: {page.evaluate('() => streakInfo()')}")
            chip = page.evaluate("""() => { const c = document.querySelector('#hm-week .hm-wf'); if (!c) return null; const r = c.getBoundingClientRect();
              return {t: c.textContent.trim(), fresh: c.classList.contains('hm-fresh'), right: r.right, w: r.width, iw: innerWidth,
                lab: document.getElementById('hm-week').getAttribute('aria-label')}; }""")
            # (a 360×740 la semana no cabe y Hoy la esconde; a 390×844 se ve)
            if not chip or chip["t"] != "Empieza tu semana" or not chip["fresh"] or re.search(r"\d", chip["t"]) or chip["right"] > chip["iw"] \
                    or (vw == 390 and not chip["w"]) or "Empieza tu semana" not in chip["lab"]:
                probs.append(f"{vw}: el chip de Hoy tras parar: {chip}")
            m = page.evaluate("() => ({sh: document.documentElement.scrollHeight, ih: innerHeight})")
            if m["sh"] > m["ih"] + 2:
                probs.append(f"{vw}×{vh}: Hoy necesita scroll con «Empieza tu semana» ({m})")
            if re.search(r"triste|sad", page.evaluate("() => document.getElementById('app').innerHTML")):
                probs.append(f"{vw}: Hoy tiene algo triste tras parar")
            C.shot(page, f"hoy-empieza-{vw}", OUT, full_page=False)
            if vw == 360:
                C.goto(page, "#/progreso")
                page.wait_for_selector("#rw .rw-days", timeout=6000)
                p = page.evaluate("() => ({t: document.getElementById('rw-st').textContent, off: !!document.querySelector('#rw .rw-flame.off')})")
                if p["t"] != "Empieza tu semana" or not p["off"]:
                    probs.append(f"Premios tras parar: {p}")
                _hscroll(page, "Premios 360 tras parar", probs)
                C.shot(page, "premios-empieza-360", OUT)
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- Mi deseo
def test_mi_deseo():
    """En Mi zorro › Personajes, el dinosaurio (300; tiene 245) lleva «Es mi deseo»: tocarlo lo guarda en game.wish,
    el botón pasa a «Tu deseo» (aria-pressed) y sale la barra «Dinosaurio · 245 de 300» con su dibujo y «Ganar monedas»
    (también en Premios y en la hoja de la tienda de la granja). «Ganar monedas» lleva a la siguiente lección o al repaso
    (nextAction). Llegar a 300 avisa «¡Ya puedes conseguir tu deseo!» una sola vez y la barra ofrece «Conseguir»; al
    comprarlo, el deseo se borra. «Te faltan N» (el dragón) trae el aviso con «Ganar monedas»."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page, hash="#/mizorro")
        page.locator('#mz-seg .seg-i[data-t="hero"]').click()
        page.wait_for_selector('#mz-shop .sc[data-id="dino"] [data-wish]', timeout=5000)
        b = page.locator('#mz-shop .sc[data-id="dino"] [data-wish]')
        if b.inner_text().strip() != "Es mi deseo" or b.get_attribute("aria-pressed") != "false":
            probs.append(f"el botón antes: {b.inner_text()!r} {b.get_attribute('aria-pressed')}")
        if page.evaluate("() => document.querySelectorAll('#mz-shop .sc[data-st^=\"buy\"] [data-wish], #mz-shop .sc[data-st=\"you\"] [data-wish]').length"):
            probs.append("«Es mi deseo» sale en piezas que ya le llegan o que ya tiene")
        b.click()
        page.wait_for_timeout(300)
        if page.evaluate(_GAME).get("wish") != "dino":
            probs.append(f"game.wish: {page.evaluate(_GAME).get('wish')}")
        b = page.locator('#mz-shop .sc[data-id="dino"] [data-wish]')
        if b.inner_text().strip() != "Tu deseo" or b.get_attribute("aria-pressed") != "true":
            probs.append(f"el botón después: {b.inner_text()!r} {b.get_attribute('aria-pressed')}")
        bar = page.evaluate("""() => { const s = document.querySelector('#app [data-wish-bar="dino"]'); if (!s) return null;
          return {t: s.querySelector('.shp-wt b').textContent.replace(/\\s+/g, ' ').trim(), img: !!s.querySelector('.shp-wi img, .shp-wi'), earn: !!s.querySelector('[data-earn]'),
            w: s.querySelector('[lang]') && s.querySelector('[lang]').textContent}; }""")
        if not bar or bar["t"] != "Dinosaurio · 245 de 300" or not bar["earn"] or bar["w"] != "dinosaur":
            probs.append(f"la barra en Mi zorro: {bar}")
        if not any("deseo" in t for t in page.evaluate("() => __toasts")):
            probs.append(f"elegir el deseo no avisa: {page.evaluate('() => __toasts')}")
        C.shot(page, "deseo-mizorro-390", OUT)
        # en Premios y en la tienda de la granja
        C.goto(page, "#/progreso")
        page.wait_for_selector('#rw [data-wish-bar="dino"]', timeout=6000)
        _hscroll(page, "Premios con el deseo", probs)
        C.shot(page, "deseo-premios-390", OUT)
        _farm(page)
        page.evaluate("() => vocabFarm.openShop()")
        try:
            page.wait_for_selector('#fm-shop[open] [data-wish-bar="dino"]', timeout=5000)
        except Exception:
            probs.append("la barra del deseo no sale en la tienda de la granja")
        page.evaluate("() => vocabFarm.closeShop()")
        # «Ganar monedas»
        C.goto(page, "#/progreso")
        page.wait_for_selector('#rw [data-wish-bar="dino"] [data-earn]', timeout=6000)
        want = page.evaluate("async () => { const a = await nextAction(); return a && (a.kind === 'leccion' || a.kind === 'repaso') ? a.href : '#/repaso'; }")
        page.locator('#rw [data-wish-bar="dino"] [data-earn]').click()
        page.wait_for_timeout(700)
        if page.evaluate("location.hash").split("?")[0] != want.split("?")[0]:
            probs.append(f"«Ganar monedas» lleva a {page.evaluate('location.hash')} (se esperaba {want})")
        C.goto(page, "#/progreso")
        page.wait_for_selector('#rw [data-wish-bar="dino"]', timeout=6000)
        page.evaluate("() => { award(55, 'prueba', true); }")
        page.wait_for_timeout(400)
        page.evaluate("() => { award(3, 'prueba', true); }")
        page.wait_for_timeout(400)
        told = [t for t in page.evaluate("() => __toasts") if t == "¡Ya puedes conseguir tu deseo!"]
        if len(told) != 1 or page.evaluate(_GAME).get("wishTold") != "dino":
            probs.append(f"«¡Ya puedes conseguir tu deseo!»: {told} wishTold={page.evaluate(_GAME).get('wishTold')}")
        buy = page.locator('#rw [data-wish-bar="dino"] [data-buy="dino"]')
        if not buy.count():
            probs.append("con 303 monedas la barra no ofrece «Conseguir»")
        else:
            buy.click()
            page.wait_for_timeout(500)
            g = page.evaluate(_GAME)
            if not g["owned"].get("dino") or "wish" in g or g["coins"] != 3:
                probs.append(f"comprar el deseo: owned={g['owned'].get('dino')} wish={g.get('wish')} coins={g['coins']}")
            if page.evaluate("() => !!document.querySelector('#app [data-wish-bar]:not([hidden])')"):
                probs.append("la barra sigue tras conseguir el deseo")
        # «Te faltan N» con «Ganar monedas»
        C.goto(page, "#/mizorro")
        page.locator('#mz-seg .seg-i[data-t="hero"]').click()
        page.wait_for_selector('#mz-shop .sc[data-id="dragon"] [data-buy]', timeout=5000)
        page.evaluate("() => document.querySelector('#mz-shop .sc[data-id=\"dragon\"] [data-buy]').click()")   # (aria-disabled, pero se toca)
        try:
            page.wait_for_selector("#m-toasts .m-ta", timeout=3000)
            a = page.evaluate("() => ({t: document.querySelector('#m-toasts .m-tt').textContent, b: document.querySelector('#m-toasts .m-ta').textContent})")
            if not a["t"].startswith("Te faltan") or a["b"] != "Ganar monedas":
                probs.append(f"«Te faltan N»: {a}")
        except Exception:
            probs.append(f"«Te faltan N» sin «Ganar monedas»: {page.evaluate('() => __toasts')}")
        if "bad" in page.evaluate("() => __sfx"):
            probs.append("suena 'bad' al no llegar")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- IPA
def _corpus_ipa():
    idx = {}
    for f in sorted(glob.glob(str(C.REPO / "data" / "*.json"))):
        try:
            d = json.loads(Path(f).read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(d, dict) or not isinstance(d.get("rows"), list):
            continue
        for r in d["rows"]:
            for L, x in ((r.get("l") or {}).items() if isinstance(r, dict) else []):
                if isinstance(x, dict) and x.get("word") and x.get("ipa"):
                    idx.setdefault(L, {}).setdefault(x["word"].strip().lower(), x["ipa"])
    return idx


def _bare(w):
    w = re.sub(r" \((m|f)\.\)$", "", w.lower())
    return [w, re.sub(r"^(le |la |les |l'|un |une |en |et |the |a |an )", "", w)]


def test_ipa_en_la_granja_tienda_y_regalo():
    """data/game.json: cada cosa tiene IPA en los 3 idiomas (entre barras) y, si la palabra está en data/*.json, es la
    misma. En la app (ipaHtml con el lang del idioma): piezas de Mi zorro y de la tienda de la granja, filas de comida,
    el globo de una palabra, el refugio y el regalo; también en francés."""
    probs = []
    idx = _corpus_ipa()
    for it in _GAMEJ:
        ipa = it.get("ipa") or {}
        for L in ("english", "français", "dansk"):
            v = ipa.get(L)
            if not v or not v.startswith("/") or not v.endswith("/"):
                probs.append(f"{it['id']}: sin IPA en {L}: {v!r}")
                continue
            w = (it.get("w") or {}).get(L) if isinstance(it.get("w"), dict) else None
            hit = next((idx.get(L, {})[c] for c in _bare(w or "") if c in idx.get(L, {})), None)
            if hit and hit != v:
                probs.append(f"{it['id']} ({L}): {v} ≠ {hit} del corpus")
    page = C.new_page("phone", reduced_motion="reduce")
    try:
        _open(page, _keys(farm={"shelter": {"conejo": {"t": T0 - H, "seen": True}}}), hash="#/mizorro")
        page.locator('#mz-seg .seg-i[data-t="hero"]').click()
        page.wait_for_selector('#mz-shop .sc[data-id="dino"] .shp-ipa', timeout=5000)
        r = page.evaluate(f"() => {{ const e = document.querySelector('#mz-shop .sc[data-id=\"dino\"] .shp-ipa .ipa'); return {{t: ({_IPA_TXT})(e), l: e && e.getAttribute('lang')}}; }}")
        if r["t"] != _ITEM["dino"]["ipa"]["english"] or r["l"] != "en-GB":
            probs.append(f"Mi zorro, dinosaurio: {r}")
        _farm(page)
        page.evaluate("() => vocabFarm.openShop()")
        page.wait_for_selector("#fm-shop[open] .sc[data-id] .shp-ipa", timeout=5000)
        r = page.evaluate(f"""() => {{ const T = {_IPA_TXT}, q = s => document.querySelector(s);
          return {{cow: T(q('#fm-shop .sc[data-id="vaca"] .shp-ipa .ipa')), grain: T(q('#fm-shop .fm-prow[data-pf="grano"] .fm-ipa')),
            gl: q('#fm-shop .fm-prow[data-pf="grano"] .fm-ipa').getAttribute('lang'), foods: farmMount.care.foods().grano.i.english}}; }}""")
        if r["cow"] != _ITEM["vaca"]["ipa"]["english"] or r["grain"] != r["foods"] or r["gl"] != "en-GB":
            probs.append(f"tienda de la granja: {r}")
        C.shot(page, "ipa-tienda-granja-390", OUT, full_page=False)
        page.evaluate("() => vocabFarm.closeShop()")
        page.wait_for_timeout(400)
        # el globo de una palabra: la gallina (comió hace 3 h: está llena)
        page.evaluate("() => document.querySelector('#app .fm-it[data-fid=\"gallina\"] .fm-e').click()")
        page.wait_for_timeout(500)
        r = page.evaluate(f"() => ({_IPA_TXT})(document.querySelector('#app .fm-bub .fm-ipa'))")
        if r != _ITEM["gallina"]["ipa"]["english"]:
            probs.append(f"el globo de la gallina: {r!r}")
        # el refugio
        page.evaluate("() => farmMount.care.openShelter()")
        page.wait_for_selector("dialog[open] .fm-pl .fm-ipa", timeout=5000)
        r = page.evaluate(f"() => ({_IPA_TXT})(document.querySelector('dialog[open] .fm-pl .fm-ipa'))")
        if r != _ITEM["conejo"]["ipa"]["english"]:
            probs.append(f"el refugio: {r!r}")
        C.shot(page, "ipa-refugio-390", OUT, full_page=False)
        page.keyboard.press("Escape")
        # el regalo
        C.goto(page, "")
        page.evaluate("() => showGift(itemById('cabra'))")
        page.locator("#gopen").click()
        page.wait_for_selector("#gift .gipa .ipa", timeout=4000)
        r = page.evaluate(f"() => ({{t: ({_IPA_TXT})(document.querySelector('#gift .gipa .ipa')), l: document.querySelector('#gift .gword [lang]').getAttribute('lang')}})")
        if r["t"] != _ITEM["cabra"]["ipa"]["english"] or r["l"] != "en-GB":
            probs.append(f"el regalo: {r}")
        C.shot(page, "ipa-regalo-390", OUT, full_page=False)
        page.evaluate("() => document.getElementById('gift').close()")
        probs += C.errors(page)
    finally:
        page.context.close()
    # en francés
    page = C.new_page("phone")
    try:
        _open(page, _keys(lang="français"), hash="#/mizorro")
        page.locator('#mz-seg .seg-i[data-t="hero"]').click()
        page.wait_for_selector('#mz-shop .sc[data-id="dino"] .shp-ipa', timeout=5000)
        r = page.evaluate(f"() => {{ const e = document.querySelector('#mz-shop .sc[data-id=\"dino\"] .shp-ipa .ipa'); return {{t: ({_IPA_TXT})(e), l: e.getAttribute('lang')}}; }}")
        if r["t"] != _ITEM["dino"]["ipa"]["français"] or r["l"] != "fr-FR":
            probs.append(f"en francés: {r}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- copas, medallas y álbum
def test_copas_medallas_y_meta_del_album():
    """Premios: «Copa de la semana: 3 días · la semana pasada 4» (bronce), la estantería «Tus copas» con las 2 de bronce
    de las semanas terminadas; cada medalla con su nivel (lv 1-3) y su aro en las ganadas («Medalla de bronce» en la
    hoja); las medallas nuevas (rachas de 14, 60, 100 y 365, 1000 palabras, 100 dominadas, páginas del álbum, los 11
    animales) existen y arrancar no gana ninguna. El álbum: «<página>: te faltan N» enlaza a la página empezada a la que
    menos le falta."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page)
        ach0 = page.evaluate(_GAME)["ach"]
        c = page.evaluate("() => vocabRewards.cups()")
        if c["cur"] != 3 or c["prev"] != 4 or c["lv"] != 1 or [x["lv"] for x in c["shelf"]] != [1, 1]:
            probs.append(f"cups(): {c}")
        L = page.evaluate("() => achList().map(a => ({id: a.id, lv: a.lv, ok: a.ok, v: a.v, goal: a.goal}))")
        ids = {a["id"] for a in L}
        for need in ("r14", "r60", "r100", "r365", "w1000", "m100", "p3", "p10", "p30", "a11"):
            if need not in ids:
                probs.append(f"falta la medalla {need}")
        if any(a["lv"] not in (1, 2, 3) for a in L):
            probs.append(f"medallas sin nivel: {[a['id'] for a in L if a['lv'] not in (1, 2, 3)]}")
        if any(a["ok"] and a["id"] not in ach0 for a in L):
            probs.append(f"arrancar gana medallas nuevas: {[a['id'] for a in L if a['ok'] and a['id'] not in ach0]}")
        if any(a["id"] in ach0 and not a["ok"] for a in L):
            probs.append(f"una medalla ganada se vuelve a cerrar: {[a['id'] for a in L if a['id'] in ach0 and not a['ok']]}")
        C.goto(page, "#/progreso")
        page.wait_for_selector("#rw .rw-wk", timeout=6000)
        r = page.evaluate("""() => ({wk: [...document.querySelectorAll('#rw .rw-wk-t > *')].map(e => e.textContent.replace(/\\s+/g, ' ').trim()).join(': '),
          cups: [...document.querySelectorAll('#rw .rw-cups li')].map(li => li.getAttribute('aria-label')),
          lv: [...document.querySelectorAll('#rw .rw-m.ok .rw-mc')].map(e => (e.className.match(/lv(\\d)/) || [])[1] || null)})""")
        if r["wk"] != "Copa de la semana: 3 días · la semana pasada 4":
            probs.append(f"la copa de la semana: {r['wk']!r}")
        if len(r["cups"]) != 2 or not all("bronce" in x for x in r["cups"]):
            probs.append(f"la estantería: {r['cups']}")
        if not r["lv"] or None in r["lv"]:
            probs.append(f"medallas ganadas sin aro de nivel: {r['lv']}")
        # la escalera: de cada familia, las ganadas y la siguiente; las demás tras «Ver todas»
        lad = page.evaluate("""() => { const vis = () => [...document.querySelectorAll('#rw .rw-meds .rw-m')].filter(b => !b.hidden).map(b => b.dataset.ach);
          const want = [], seen = new Set();
          for (const a of achList()) { const f = a.id.replace(/\\d+$/, ''); if (a.ok) want.push(a.id); else if (!seen.has(f)) { seen.add(f); want.push(a.id); } }
          const before = vis(), b = document.getElementById('rw-more'); b.click();
          return {before, want, after: vis().length, all: achList().length, exp: b.getAttribute('aria-expanded'), t: b.textContent}; }""")
        if lad["before"] != lad["want"] or lad["after"] != lad["all"] or lad["exp"] != "true" or lad["t"] != "Ver menos":
            probs.append(f"la escalera de medallas: {lad}")
        page.evaluate("() => document.getElementById('rw-more').click()")
        page.evaluate("() => vocabRewards.openMedal('r3')")
        page.wait_for_timeout(500)
        if "Medalla de bronce" not in page.evaluate("() => (document.querySelector('dialog[open]') || document.body).textContent"):
            probs.append("la hoja de la medalla no dice su nivel")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        _hscroll(page, "Premios", probs)
        C.shot(page, "premios-copas-390", OUT)
        C.goto(page, "#/album")
        page.wait_for_selector("#app .al-sum", timeout=8000)
        g = page.evaluate("""() => { const a = document.querySelector('#app .al-goal'); return a && {t: a.textContent.replace(/\\s+/g, ' ').trim(), href: a.getAttribute('href'), h: a.getBoundingClientRect().height}; }""")
        C.shot(page, "album-portada-390", OUT, full_page=False)
        if not g or not re.fullmatch(r".+: te faltan? \d+", g["t"]) or not g["href"].startswith("#/album/") or g["h"] < 44:
            probs.append(f"la meta del álbum: {g}")
        else:
            C.goto(page, g["href"])
            page.wait_for_selector("#app .al-st", timeout=8000)
            n = int(re.findall(r"\d+", g["t"])[-1])
            left = page.evaluate("() => document.querySelectorAll('#app .al-st:not(.got)').length")
            if left != n:
                probs.append(f"la meta dice que faltan {n} y en la página faltan {left}")
        C.shot(page, "album-meta-390", OUT, full_page=False)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- el visitante del día
def _visit(page):
    page.wait_for_selector("#app .fm-vis", timeout=9000)
    page.wait_for_timeout(300)
    page.evaluate("() => document.querySelector('#app .fm-vis').click()")
    page.wait_for_selector("#app .fm-pop:not([hidden]) .fm-vsay", timeout=4000)
    return page.evaluate("() => document.querySelector('#app .fm-pop .fm-vsay').dataset.say")


def test_visitante_del_dia():
    """A 360×740: una vez al día entra una palabra pendiente del repaso con dibujo (un botón de 44 px o más, dentro de la
    pantalla, encima del dock). Tocarla: suena la palabra («Escuchar otra vez») y «¿Qué has oído?» con 3 palabras con
    lang. Acertar puntúa esa palabra en el repaso (como srsGrade(…, 2): ya no toca hoy), da 5 monedas, guarda
    farm:state.vis y no vuelve hoy. Fallar: gris con ✗, sin monedas, sin sonido triste, la palabra a 0 («Era …»)."""
    probs = []
    page = C.new_page("phone", viewport={"width": 360, "height": 740})
    try:
        _open(page)
        srs0 = page.evaluate("() => (srsFlush(), JSON.parse(localStorage.getItem('srs:english')))")
        today = page.evaluate("() => today()")
        _farm(page)
        page.wait_for_selector("#app .fm-vis", timeout=9000)
        page.wait_for_timeout(4800)   # termina de entrar andando
        r = page.evaluate("""() => { const v = document.querySelector('#app .fm-vis'), b = v.getBoundingClientRect(), d = document.querySelector('#app .fm-dock').getBoundingClientRect();
          return {l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height, dock: d.top, iw: innerWidth, kind: v.dataset.vk, aria: v.getAttribute('aria-label'), tag: v.tagName}; }""")
        if r["l"] < 0 or r["r"] > r["iw"] or r["b"] > r["dock"] or r["w"] < 44 or r["h"] < 44 or r["tag"] != "BUTTON" or "Visitante" not in (r["aria"] or ""):
            probs.append(f"el visitante a 360: {r}")
        if r["kind"] != "word":
            probs.append(f"con palabras pendientes con dibujo, el visitante es {r['kind']}")
        C.shot(page, "visitante-360", OUT, full_page=False)
        w = _visit(page)
        pop = page.evaluate("""() => { const p = document.querySelector('#app .fm-pop'), b = p.getBoundingClientRect();
          return {t: p.querySelector('.fm-qt').textContent, opts: [...p.querySelectorAll('.fm-opt')].map(o => [o.textContent.trim(), o.getAttribute('lang')]), l: b.left, r: b.right, iw: innerWidth}; }""")
        if pop["t"] != "¿Qué has oído?" or len(pop["opts"]) != 3 or w not in [o[0] for o in pop["opts"]] or any(o[1] != "en-GB" for o in pop["opts"]):
            probs.append(f"la pregunta: {pop}")
        if pop["l"] < 0 or pop["r"] > pop["iw"]:
            probs.append(f"la pregunta no cabe a 360: {pop}")
        C.shot(page, "visitante-pregunta-360", OUT, full_page=False)
        page.evaluate("w => [...document.querySelectorAll('#app .fm-pop .fm-opt')].find(o => o.textContent.trim() === w).click()", w)
        page.wait_for_timeout(700)
        srs1 = page.evaluate("() => (srsFlush(), JSON.parse(localStorage.getItem('srs:english')))")
        ch = [k for k in set(srs0) | set(srs1) if srs0.get(k) != srs1.get(k)]
        if len(ch) != 1 or not (srs0[ch[0]]["due"] <= today < srs1[ch[0]]["due"]):
            probs.append(f"acertar no puntúa una palabra pendiente: {[(k, srs0.get(k), srs1.get(k)) for k in ch]}")
        g = page.evaluate(_GAME)
        if g["coins"] != 250:
            probs.append(f"acertar al visitante: {g['coins']} monedas (se esperaban 250)")
        st = page.evaluate(_FARM)
        if (st.get("vis") or {}).get("ok") != 1 or (st.get("vis") or {}).get("day") != C.day_key(C.FIXED_NOW):
            probs.append(f"farm:state.vis: {st.get('vis')}")
        msg = page.evaluate("() => document.querySelector('#app .fm-pop .fm-qm').textContent")
        if "¡Lo oíste bien!" not in msg:
            probs.append(f"el mensaje al acertar: {msg!r}")
        if any(h not in ("success", "selection") for h in page.evaluate("() => __hap")):
            probs.append(f"vibraciones: {page.evaluate('() => __hap')}")
        C.shot(page, "visitante-acierto-360", OUT, full_page=False)
        page.evaluate("() => document.querySelector('#app .fm-pop .fm-x').click()")
        C.goto(page, "")
        _farm(page)
        page.wait_for_timeout(4000)
        if page.evaluate("() => !!document.querySelector('#app .fm-vis')"):
            probs.append("el visitante vuelve el mismo día")
        probs += C.errors(page)
    finally:
        page.context.close()
    # fallar
    page = C.new_page("phone", reduced_motion="reduce", color_scheme="dark")
    try:
        _open(page)
        srs0 = page.evaluate("() => (srsFlush(), JSON.parse(localStorage.getItem('srs:english')))")
        _farm(page)
        w = _visit(page)
        page.evaluate("w => [...document.querySelectorAll('#app .fm-pop .fm-opt')].find(o => o.textContent.trim() !== w).click()", w)
        page.wait_for_timeout(500)
        r = page.evaluate("""() => { const b = document.querySelector('#app .fm-pop .fm-opt.bad'), cs = b && getComputedStyle(b);
          return b && {bg: cs.backgroundColor, x: !!b.querySelector('.fm-mk svg'), anim: b.getAnimations().length, msg: document.querySelector('#app .fm-pop .fm-qm').textContent}; }""")
        if not r or not r["x"] or r["anim"] or not r["msg"].startswith("Era "):
            probs.append(f"fallar: {r}")
        else:
            n = [int(x) for x in re.findall(r"\d+", r["bg"])[:3]]
            if len(n) == 3 and max(n) - min(n) > 24:
                probs.append(f"la mala no es gris: {r['bg']}")
        if page.evaluate(_GAME)["coins"] != 245 or "bad" in page.evaluate("() => __sfx"):
            probs.append(f"fallar da monedas o suena triste: {page.evaluate(_GAME)['coins']} {page.evaluate('() => __sfx')}")
        srs1 = page.evaluate("() => (srsFlush(), JSON.parse(localStorage.getItem('srs:english')))")
        ch = [k for k in set(srs0) | set(srs1) if srs0.get(k) != srs1.get(k)]
        if len(ch) != 1 or srs1[ch[0]]["b"] != 0:
            probs.append(f"fallar no pone la palabra a 0: {[(k, srs0.get(k), srs1.get(k)) for k in ch]}")
        if (page.evaluate(_FARM).get("vis") or {}).get("ok") != 0:
            probs.append(f"farm:state.vis al fallar: {page.evaluate(_FARM).get('vis')}")
        C.shot(page, "visitante-fallo-390-oscuro", OUT, full_page=False)
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- el cofre y las misiones
def test_cofre_da_comida_y_misiones_de_granja():
    """vocabFarm.giveFood(n) → {ok, n}: reparte n raciones entre las comidas de sus animales (fuera de la granja y con
    ella montada, y la bandeja se pone al día), nunca más de 30 de cada una; sin animales, {ok: false, n: 0}. Las
    misiones de cualquier día traen como mucho una de la granja, y «Cosecha» pide 1."""
    probs = []
    page = C.new_page("phone")
    try:
        _open(page)
        r = page.evaluate("() => vocabFarm.giveFood(3)")
        pan = page.evaluate(_FARM)["pan"]
        if r != {"ok": True, "n": 3} or pan != {"grano": 4, "zanahoria": 3, "heno": 2}:
            probs.append(f"giveFood(3) en Hoy: {r} {pan}")
        page.evaluate("() => { const s = JSON.parse(localStorage.getItem('farm:state')); s.pan = {grano: 30, zanahoria: 29, heno: 30}; localStorage.setItem('farm:state', JSON.stringify(s)); }")
        r = page.evaluate("() => vocabFarm.giveFood(5)")
        if r != {"ok": True, "n": 1} or page.evaluate(_FARM)["pan"]["zanahoria"] != 30:
            probs.append(f"giveFood con la despensa llena: {r} {page.evaluate(_FARM)['pan']}")
        page.evaluate("() => { const s = JSON.parse(localStorage.getItem('farm:state')); s.pan = {grano: 1}; localStorage.setItem('farm:state', JSON.stringify(s)); }")
        _farm(page)
        page.locator('#app .fm-dock [data-fm="food"]').click()
        page.wait_for_selector('#app .fm-tray [data-pfood="grano"]', timeout=4000)
        r = page.evaluate("() => vocabFarm.giveFood(2)")
        page.wait_for_timeout(200)
        n = page.evaluate("() => document.querySelector('#app .fm-tray [data-pfood=\"grano\"] .fn').textContent")
        if r != {"ok": True, "n": 2} or n != "2":
            probs.append(f"giveFood con la granja montada: {r}, bandeja grano {n}")
        if ["farm-food", 2] not in page.evaluate("() => __ev"):
            probs.append(f"giveFood no emite farm-food: {page.evaluate('() => __ev')}")
        mix = page.evaluate("""() => { const F = new Set(['feed', 'harv', 'coll', 'find']), out = {bad: [], harv: [], n: 0};
          const d = new Date(2026, 0, 1);
          for (let i = 0; i < 400; i++) { const k = dayKey(d), m = vocabBuddy.makeMissions(k);
            if (m.list.filter(x => F.has(x.k)).length > 1) out.bad.push(k);
            for (const x of m.list) if (x.k === 'harv') out.harv.push(x.goal);
            out.n += m.list.some(x => F.has(x.k)) ? 1 : 0; d.setDate(d.getDate() + 1); }
          return out; }""")
        if mix["bad"] or any(g != 1 for g in mix["harv"]) or not mix["n"]:
            probs.append(f"misiones: días con 2 de la granja {mix['bad'][:5]}, cosecha {set(mix['harv'])}, días con granja {mix['n']}")
        probs += C.errors(page)
    finally:
        page.context.close()
    page = C.new_page("phone")
    try:
        g = C.seed_data()["game"]
        owned = {k: v for k, v in g["owned"].items() if k not in ("gallina", "pato", "conejo", "vaca")}
        _open(page, _keys(game={"owned": owned}))
        if page.evaluate("() => vocabFarm.giveFood(3)") != {"ok": False, "n": 0}:
            probs.append(f"giveFood sin animales: {page.evaluate('() => vocabFarm.giveFood(3)')}")
        probs += C.errors(page)
    finally:
        page.context.close()
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- sin culpa
_GUILT = [r"malit[oa]", r"Tienen hambre", r"Dame de comer", r"echaban de menos", r"Hoy ya ganaste", r"[Pp]erdiste",
          r"[Rr]acha rota", r"has perdido", r"[Cc]ampe[oó]n", r"[Qq]ué list[oa]", r"Buen intento", r"[Tt]e has olvidado",
          r"¡[Vv]aya!", r"[Ll]ástima", r"abandon", r"se muri", r"[Nn]o has vuelto"]


def test_sin_culpa():
    """Los textos de js/farm.js, js/rewards.js, js/shop.js, js/album.js y de streak()/achList() de index.html (sin los
    comentarios) no riñen ni dan pena ni alaban a la persona: nada de «malito», «¡Te echaban de menos!», «Perdiste»,
    «Racha rota», «¡Eres un campeón!»…"""
    probs = []
    html = (C.REPO / "index.html").read_text(encoding="utf-8")
    fn = lambda n: html[html.index(f"function {n}("):html.index("\n}\n", html.index(f"function {n}("))]   # noqa: E731
    srcs = {name: (C.REPO / "js" / name).read_text(encoding="utf-8") for name in ("farm.js", "rewards.js", "shop.js", "album.js")}
    srcs["index.html: streakInfo"] = fn("streakInfo")
    srcs["index.html: achList"] = fn("achList")
    for name, src in srcs.items():
        code = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
        code = re.sub(r"(?m)^\s*//.*$", "", code)
        for pat in _GUILT:
            for m in re.finditer(pat, code):
                line = code[: m.start()].count("\n") + 1
                probs.append(f"{name}: «{m.group(0)}» (línea {line} sin comentarios)")
    assert not probs, "\n".join(probs)


# ---------------------------------------------------------------- capturas
def test_capturas_y_tamanos():
    """La granja con el visitante a 360×740 (claro), 390×844 (oscuro) y 1280×800; Premios con el deseo y las copas a 360,
    390 oscuro y 1280; Mi zorro con el deseo a 1280. Nada se sale de lado y sin errores de consola."""
    probs = []
    shots = [("phone", {"viewport": {"width": 360, "height": 740}}, "light", "360"),
             ("phone", {}, "dark", "390-oscuro"),
             ("desk", {}, "light", "1280")]
    for kind, kw, scheme, tag in shots:
        page = C.new_page(kind, color_scheme=scheme, **kw)
        try:
            _open(page, _keys(game={"wish": "dino"}, act=_act([12, 11, 10, 9, 8, 7, 6, 4, 3, 1, 0])))
            _farm(page)
            page.wait_for_selector("#app .fm-vis", timeout=9000)
            page.wait_for_timeout(4800)
            _hscroll(page, f"granja {tag}", probs)
            C.shot(page, f"granja-visitante-{tag}", OUT, full_page=False)
            C.goto(page, "#/progreso")
            page.wait_for_selector("#rw .rw-wk", timeout=6000)
            page.wait_for_timeout(300)
            _hscroll(page, f"Premios {tag}", probs)
            bar = page.evaluate("""() => { const s = document.querySelector('#rw [data-wish-bar]'); if (!s) return null; const b = s.getBoundingClientRect();
              const go = s.querySelector('.shp-wgo').getBoundingClientRect(); return {l: b.left, r: b.right, iw: innerWidth, goH: go.height}; }""")
            if not bar or bar["l"] < 0 or bar["r"] > bar["iw"] or bar["goH"] < 44:
                probs.append(f"la barra del deseo en Premios {tag}: {bar}")
            C.shot(page, f"premios-{tag}", OUT)
            if kind == "desk":
                C.goto(page, "#/mizorro")
                page.wait_for_timeout(500)
                C.shot(page, "mizorro-deseo-1280", OUT)
            probs += C.errors(page)
        finally:
            page.context.close()
    assert not probs, "\n".join(probs)
