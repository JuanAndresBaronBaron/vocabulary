"""Utilidades de las pruebas de Tech Prep (S1-SPEC §13), para test_tech_core.py, test_tech_lesson.py y test_tech_pages.py.

Uso típico:

    import common as C
    import tech_common as TC
    page = TC.tech_page("phone", hash="#/techpath")            # partida del niño + Tech Prep encendido y la Puerta pasada
    page = TC.tech_page(data=TC.data({"ls/u01-l1": TC.rec(best=8, total=9, done=TC.NOW_MS)}))   # con estado de Tech Prep
    TC.goto(page, "#/techl/lesson/u01-l1")                      # C.goto y, además, espera a que vocabTech esté cargado
    st = TC.state(page)                                         # tech:data ya leído: {"v", "dev", "recs": {...}}
    assert not TC.kid_changes(page, before), "Tech Prep escribió claves del niño"
    assert not C.errors(page), C.errors(page)

Claves de Tech Prep (todas "tech:…", fuera de la partida del niño): localStorage tech:on ("true"), tech:data, tech:ui,
tech:sync, tech:lsdraft; sessionStorage tech:in ("1" = la Puerta ya se pasó en esta sesión), tech:ls.
El reloj empieza en C.FIXED_NOW (miércoles 11-3-2026, 10:00, Madrid); TC.TODAY es su número de día (today() de la app).
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import common as C

NOW_MS = int(C.FIXED_NOW.timestamp() * 1000)
TODAY = C.day_num(C.FIXED_NOW)
DAY_MS = 864e5
DATA = C.REPO / "data" / "tech"
# las capturas de Tech Prep S1 (VOCAB_CAPTURAS cambia la carpeta, como en common.py)
CAPTURAS = Path(os.environ.get("VOCAB_CAPTURAS") or "/mnt/project-files/tech-prep/capturas/S1")
SECS = ["tech", "techpath", "techunit", "techsheet", "techgloss", "techplay", "techcases", "techcase", "techstories",
        "techstory", "techmock", "techl"]
# la barra mientras se está en Tech Prep (index.html TECH_TABS): sus pestañas y la marcada en cada sección (en modo foco,
# #/techl/…, la barra no se ve y no hay una en particular)
TABS = [("tp-today", "Today"), ("tp-path", "Path"), ("tp-play", "Play"), ("tp-cases", "My cases"), ("tp-mock", "Interview")]
_TAB_OF = {"tech": "tp-today", "techpath": "tp-path", "techunit": "tp-path", "techsheet": "tp-path", "techgloss": "tp-path",
           "techplay": "tp-play", "techcases": "tp-cases", "techcase": "tp-cases", "techstories": "tp-cases",
           "techstory": "tp-cases", "techmock": "tp-mock"}


def tab_of(hash):
    """La pestaña marcada en esa ruta de Tech Prep ("#/techunit/u01" → "tp-path"); None en modo foco (#/techl/…)."""
    return _TAB_OF.get(hash.lstrip("#/").split("/")[0].split("?")[0])

# antes que la app, en cada documento del contexto: Tech Prep encendido y la Puerta pasada en esta sesión
ENABLE = """(() => { try { localStorage.setItem('tech:on', 'true'); sessionStorage.setItem('tech:in', '1'); } catch (e) {} })();"""

# speechSynthesis de mentira: lo que se dice queda en window.__spoken [{text, lang, voice, rate}] y onend llega a los 40 ms
SPEECH = r"""
(() => {
  const ss = window.speechSynthesis; if (!ss || window.__spoken) return;
  const V = [["Google UK English Female", "en-GB"], ["Google US English", "en-US"], ["Daniel", "en-GB"], ["Google español", "es-ES"]]
    .map(([name, lang]) => Object.freeze({name, lang, voiceURI: name, localService: true, default: false}));
  window.__spoken = [];
  Object.defineProperty(ss, 'getVoices', {configurable: true, writable: true, value: () => V.slice()});
  Object.defineProperty(ss, 'speak', {configurable: true, writable: true, value: u => {
    window.__spoken.push({text: String(u.text || ''), lang: String(u.lang || ''), voice: u.voice ? u.voice.name : null, rate: u.rate});
    setTimeout(() => { try { if (u.onend) u.onend({}); } catch (e) {} }, 40);
  }});
  Object.defineProperty(ss, 'cancel', {configurable: true, writable: true, value: () => {}});
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t == null ? '' : String(t); this.lang = ''; this.rate = 1;
    this.pitch = 1; this.volume = 1; this.voice = null; this.onend = this.onerror = null; } };
})();
"""

# Google Identity de mentira (como test_f2_ajustes.py): solo da permiso dentro de un toque
GIS = """(() => {
  window.__gis = [];
  window.google = {accounts: {oauth2: {
    initTokenClient(cfg) { return {requestAccessToken(o) {
      const ev = window.event, tap = !!(ev && ev.type === 'click');
      window.__gis.push({tap, at: location.hash});
      setTimeout(() => { if (tap) cfg.callback({access_token: 'nuevo-' + window.__gis.length, expires_in: 3600});
        else cfg.error_callback({type: 'popup_failed_to_open'}); }, 30);
    }}; },
    hasGrantedAllScopes() { return true; },
    revoke(t, cb) { if (cb) cb(); }}}};
})();"""


# ---------------------------------------------------------------- datos de Tech Prep (Python)
_UNITS: dict = {}


def index() -> dict:
    """data/tech/index.json."""
    return json.loads((DATA / "index.json").read_text(encoding="utf-8"))


def unit(uid) -> dict:
    """data/tech/uNN.json (memorizado)."""
    if uid not in _UNITS:
        _UNITS[uid] = json.loads((DATA / f"{uid}.json").read_text(encoding="utf-8"))
    return _UNITS[uid]


def units() -> list:
    """Las unidades disponibles (las que tienen fichero), en orden."""
    return [unit(u["id"]) for u in index()["units"] if u["available"]]


def lessons(uid=None) -> list:
    """[(unidad, lección)] de una unidad o de todas las disponibles."""
    us = [unit(uid)] if uid else units()
    return [(u, l) for u in us for l in u["lessons"]]


def items(type=None, uid=None) -> list:
    """[(unidad, lección, ítem)] (de un tipo, de una unidad) en el orden de los ficheros."""
    return [(u, l, it) for u, l in lessons(uid) for it in l["items"] if type is None or it["type"] == type]


def item(item_id) -> dict:
    return next(it for _, _, it in items() if it["id"] == item_id)


REVIEWABLE = lambda t: t not in ("say", "story")   # noqa: E731  (lo que entra en el repaso, §8)


# ---------------------------------------------------------------- estado tech:data
def rec(at=None, **fields) -> dict:
    """Un registro de tech:data con su at (ms; por defecto NOW_MS - 1 h)."""
    r = dict(fields)
    r["at"] = int(at if at is not None else NOW_MS - 3600_000)
    return r


def srs(b=1, due=None, n=1, g=2, d=None, iv=None, t="", r=None, at=None) -> dict:
    """Un registro srs/<itemId>: caja b, vence el día due (por defecto mañana), último repaso el día d (hoy)."""
    d = TODAY if d is None else d
    due = TODAY + 1 if due is None else due
    out = dict(b=b, due=due, n=n, g=g, d=d, iv=(due - d) if iv is None else iv, t=t)
    if r is not None:
        out["r"] = r
    return rec(at=at, **out)


def data(recs=None, dev="dtest", erased=None) -> dict:
    """tech:data = {v:1, dev, recs:{"<kind>/<id>": {..., at}}}, como lo guarda js/tech.js."""
    out = {"v": 1, "dev": dev, "recs": dict(recs or {})}
    if erased:
        out["erased"] = int(erased)
    return out


def day_str(n) -> str:
    """Número de día → "YYYY-MM-DD" (dayStr de js/tech.js)."""
    import datetime as _dt
    return (_dt.date(1970, 1, 1) + _dt.timedelta(days=int(n))).isoformat()


def keys(data_=None, kid=True, on=True, extra=None) -> dict:
    """Claves de localStorage para C.seed: la partida del niño (kid), tech:on y tech:data."""
    k = C.seed_keys() if kid else {}
    if on:
        k["tech:on"] = "true"
    if data_ is not None:
        k["tech:data"] = data_ if isinstance(data_, str) else C._dumps(data_)
    for a, b in (extra or {}).items():
        k[a] = b if isinstance(b, str) else C._dumps(b)
    return k


# ---------------------------------------------------------------- abrir Tech Prep
def enable(context):
    """Tech Prep encendido y la Puerta pasada en cada documento del contexto (routes.py con VOCAB_TECH=1)."""
    context.add_init_script(ENABLE)
    return context


def wait_tech(page, timeout=15000):
    """Espera a que los módulos de Tech Prep hayan llegado (vocabTech.ready) y a que la ruta haya pintado."""
    page.wait_for_function("() => !!(window.vocabTech && vocabTech.loaded === true && vocabTech.mods)", timeout=timeout, polling=50)
    C.settle(page, 200)


def goto(page, hash="#/tech", **kw):
    """C.goto y, si es una ruta de Tech Prep, wait_tech. Devuelve el hash final (sin '#/')."""
    h = C.goto(page, hash, **kw)
    if h.split("/")[0].split("?")[0] in SECS:
        wait_tech(page)
    return h


def open_tech(page, hash="#/tech", data_=None, kid=True, on=True, gate=True, extra=None, session=None, clear=True):
    """Borra el origen, siembra la partida del niño (kid) con tech:on (on) y tech:data (data_), deja la Puerta pasada
    en esta sesión (gate: sessionStorage tech:in) y abre hash. session = {clave: texto} más para sessionStorage
    (p. ej. tech:ls). Devuelve las claves sembradas."""
    k = keys(data_, kid=kid, on=on, extra=extra)
    ss = dict(session or {})
    if gate:
        ss["tech:in"] = "1"
    page.goto(C.base_url(page) + "/__blank", wait_until="domcontentloaded")
    page.evaluate("""([keys, ss, clear]) => {
      if (clear) { localStorage.clear(); sessionStorage.clear(); }
      for (const [a, b] of Object.entries(keys)) localStorage.setItem(a, b);
      for (const [a, b] of Object.entries(ss)) sessionStorage.setItem(a, typeof b === 'string' ? b : JSON.stringify(b));
    }""", [k, ss, clear])
    if on and gate:
        goto(page, hash)
    else:
        C.goto(page, hash)
    return k


def tech_page(kind="phone", hash="#/tech", data=None, kid=True, gate=True, speech=True, extra=None, session=None, **ctx_kw):
    """Página nueva (contexto nuevo, reloj en FIXED_NOW) con la partida del niño, Tech Prep encendido, la Puerta pasada
    y hash abierto. speech: speechSynthesis de mentira (TC.spoken). **ctx_kw va a C.new_context (color_scheme,
    reduced_motion, viewport…). Ciérrala con page.context.close()."""
    page = C.new_page(kind, **ctx_kw)
    if speech:
        page.add_init_script(SPEECH)
    open_tech(page, hash, data_=data, kid=kid, gate=gate, extra=extra, session=session)
    return page


# ---------------------------------------------------------------- la Puerta de mayores
_UNI = {"uno": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6, "siete": 7, "ocho": 8, "nueve": 9}
_TENS = {"treinta": 30, "cuarenta": 40, "cincuenta": 50, "sesenta": 60, "setenta": 70, "ochenta": 80, "noventa": 90}
_VEINTI = {w: 20 + i for i, w in enumerate(["veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco",
                                            "veintiséis", "veintisiete", "veintiocho", "veintinueve"])}


def _num(w):
    w = w.strip()
    if w in _VEINTI:
        return _VEINTI[w]
    if " y " in w:
        t, u = w.split(" y ")
        return _TENS[t] + _UNI[u]
    return _TENS[w]


def gate_open(page) -> bool:
    return bool(page.evaluate("() => { const d = document.getElementById('gate'); return !!(d && d.open); }"))


def gate_info(page) -> dict:
    """Lo que dice la Puerta abierta: {open, q (la suma en letras), why (la razón)}."""
    return page.evaluate("""() => { const d = document.getElementById('gate'); if (!d) return {open: false};
      const b = d.querySelector('#gt-q b'); return {open: d.open, q: b ? b.textContent : '', why: (d.querySelector('#gt-why') || {}).textContent || ''}; }""")


def answer_gate(page, right=True, timeout=4000):
    """Contesta la Puerta abierta con el teclado (bien o mal) y devuelve gate_info de antes."""
    page.wait_for_function("() => { const d = document.getElementById('gate'); return !!(d && d.open && d.querySelector('#gt-q b')); }",
                           timeout=timeout)
    g = gate_info(page)
    a, b = g["q"].split(" más ")
    n = _num(a) + _num(b) + (0 if right else 1)
    for ch in str(n):
        page.locator(f'#gt-ks .gt-k[data-k="{ch}"]').click()
    page.locator('#gt-ks .gt-k[data-k="ok"]').click()
    return g


def cancel_gate(page):
    """Cierra la Puerta sin contestar (Escape)."""
    page.keyboard.press("Escape")
    page.wait_for_function("() => !document.getElementById('gate').open", timeout=3000)


# ---------------------------------------------------------------- leer el estado
def state(page) -> dict:
    """tech:data de localStorage (dict; {} si no hay)."""
    return page.evaluate("() => { try { return JSON.parse(localStorage.getItem('tech:data')) || {}; } catch (e) { return {}; } }")


def recs(page, kind=None) -> dict:
    """Los registros vivos (sin lápidas) de tech:data, de un tipo si se pide: {"<kind>/<id>": rec}."""
    r = state(page).get("recs", {})
    return {k: v for k, v in r.items() if not v.get("del") and (kind is None or k.startswith(kind + "/"))}


def tech_keys(page) -> dict:
    """Todas las claves tech:* de localStorage y sessionStorage: {"local": {...}, "session": {...}}."""
    return page.evaluate("""() => ({
      local: Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('tech:')).map(k => [k, localStorage.getItem(k)])),
      session: Object.fromEntries(Object.keys(sessionStorage).filter(k => k.startsWith('tech:')).map(k => [k, sessionStorage.getItem(k)]))})""")


def kid_snapshot(page) -> dict:
    """Las claves de la partida del niño (vocabSave.snapshot().keys)."""
    return C.export(page)["keys"]


def kid_changes(page, before) -> list:
    """Diferencias entre la partida del niño de antes (kid_snapshot) y la de ahora, sin las que el niño escribe solo por
    abrir la app (ninguna en la partida sembrada). Vacío = Tech Prep no tocó nada del niño."""
    return C.diff_exports(before, kid_snapshot(page), allow_new=False)


def bus_log(page):
    """Empieza a apuntar los eventos del bus que Tech Prep nunca debe emitir (coins, lesson-done, review-done, game-done,
    medal, gift-open, answer); bus_seen(page) los devuelve."""
    page.evaluate("""() => { if (window.__techBus) return; window.__techBus = [];
      for (const e of ['coins', 'lesson-done', 'review-done', 'game-done', 'medal', 'gift-open', 'answer'])
        bus.on(e, () => window.__techBus.push(e)); }""")


def bus_seen(page) -> list:
    return page.evaluate("() => window.__techBus || []")


def spoken(page) -> list:
    """Lo dicho con la voz de mentira (SPEECH): [{text, lang, voice, rate}]."""
    return page.evaluate("() => window.__spoken || []")


def shot(page, name, folder=None, **kw):
    """C.shot en la carpeta de capturas de Tech Prep S1."""
    return C.shot(page, name, folder or CAPTURAS, **kw)


# ---------------------------------------------------------------- Google Drive de mentira
def google_keys(base=None, tok_valid=True, now_ms=NOW_MS) -> dict:
    """La partida del niño con Google conectado (save:sync) y un permiso vigente (o caducado) en save:tok."""
    k = dict(base) if base is not None else C.seed_keys()
    k["save:sync"] = json.dumps({"connectedAt": now_ms - 2 * 864e5, "fileId": None, "baseHash": "x", "lastPushedHash": "x",
                                 "lastSync": now_ms - 7200_000, "lastPull": now_ms - 7200_000, "localDirty": False,
                                 "reconnect": None, "hint": None, "choice": False, "tapAt": 0})
    k["save:tok"] = json.dumps({"t": "vigente", "exp": now_ms + (3000_000 if tok_valid else -60_000)})
    return k


class FakeDrive:
    """appDataFolder de mentira en https://www.googleapis.com (lista por nombre, meta, alt=media, subida multipart POST
    y PATCH). files = {id: {"name", "appProperties", "body" (texto), "modifiedTime"}}; log = [(método, ruta, nombre)];
    writes = [(id, nombre, metadatos, cuerpo)]."""

    CORS = {"access-control-allow-origin": "*", "access-control-allow-headers": "*",
            "access-control-allow-methods": "GET,POST,PATCH,OPTIONS"}

    def __init__(self, page):
        self.page = page
        self.files = {}
        self.log = []
        self.writes = []
        self.n = 0
        self.attach(page)

    def attach(self, page):
        """La misma carpeta para otra página (otro «aparato»): GIS de mentira y las peticiones a Google aquí."""
        page.context.add_init_script(GIS)
        page.route("https://www.googleapis.com/**", self._handle)
        return page

    def add(self, name, body, props=None, fid=None):
        self.n += 1
        fid = fid or f"f{self.n}"
        self.files[fid] = {"name": name, "appProperties": dict(props or {}), "modifiedTime": f"2026-03-11T08:00:{self.n:02d}.000Z",
                           "body": body if isinstance(body, str) else json.dumps(body, ensure_ascii=False)}
        return fid

    def by_name(self, name):
        return next(((i, f) for i, f in self.files.items() if f["name"] == name), (None, None))

    def body(self, name):
        _, f = self.by_name(name)
        return json.loads(f["body"]) if f else None

    def _meta(self, fid):
        f = self.files[fid]
        return {"id": fid, "modifiedTime": f["modifiedTime"], "appProperties": f["appProperties"]}

    def _reply(self, route, status=200, body=None, text=None):
        h = dict(self.CORS, **{"content-type": "application/json"})
        route.fulfill(status=status, headers=h, body=text if text is not None else json.dumps(body if body is not None else {}))

    def _handle(self, route):
        from urllib.parse import parse_qs, unquote, urlsplit
        req = route.request
        if req.method == "OPTIONS":
            return route.fulfill(status=204, headers=self.CORS)
        u = urlsplit(req.url)
        q = parse_qs(u.query)
        path = u.path
        if path.startswith("/drive/v3/about"):
            self.log.append((req.method, path, ""))
            return self._reply(route, body={"user": {"emailAddress": "adult@example.com"}})
        if req.method == "GET" and path == "/drive/v3/files":
            name = ""
            m = __import__("re").search(r"name='([^']+)'", unquote(q.get("q", [""])[0]))
            if m:
                name = m.group(1)
            self.log.append(("LIST", path, name))
            return self._reply(route, body={"files": [self._meta(i) for i, f in self.files.items() if f["name"] == name]})
        if req.method == "GET" and path.startswith("/drive/v3/files/"):
            fid = unquote(path.rsplit("/", 1)[1])
            if fid not in self.files:
                self.log.append(("GET", path, "?"))
                return self._reply(route, status=404, body={"error": {"code": 404}})
            if q.get("alt") == ["media"]:
                self.log.append(("DOWNLOAD", fid, self.files[fid]["name"]))
                return self._reply(route, text=self.files[fid]["body"])
            self.log.append(("META", fid, self.files[fid]["name"]))
            return self._reply(route, body=self._meta(fid))
        if req.method in ("POST", "PATCH") and path.startswith("/upload/drive/v3/files"):
            ct = req.headers.get("content-type", "")
            b = ct.split("boundary=")[-1]
            parts = [p for p in (req.post_data or "").split("--" + b) if p.strip() and p.strip() != "--"]
            md = json.loads(parts[0].split("\r\n\r\n", 1)[1].strip())
            content = parts[1].split("\r\n\r\n", 1)[1].rstrip("\r\n")
            if req.method == "POST":
                fid = self.add(md.get("name", ""), content, md.get("appProperties"))
            else:
                fid = unquote(path.rsplit("/", 1)[1])
                if fid not in self.files:
                    return self._reply(route, status=404, body={"error": {"code": 404}})
                f = self.files[fid]
                f["body"] = content
                f["appProperties"] = dict(md.get("appProperties") or {})
                self.n += 1
                f["modifiedTime"] = f"2026-03-11T09:00:{self.n:02d}.000Z"
            self.writes.append((fid, self.files[fid]["name"], md, content))
            self.log.append((req.method, fid, self.files[fid]["name"]))
            return self._reply(route, body=self._meta(fid))
        self.log.append((req.method, path, "?"))
        return self._reply(route, status=400, body={"error": {"code": 400}})
