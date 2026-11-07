"""Los audios que se recortaron de nuevo (otro nombre de archivo) se cambian solos en los aparatos (index.html:
clipAlt y audioRenew).

El nombre de un mp3 son los 10 primeros caracteres de sha1 del texto, solo o con «v2:» o «v3:» delante. Un aparato con
la versión de antes tiene guardados en vocab-media los mp3 viejos (de «Descargar todo» o de haberlos oído). Llega la
versión nueva (otro mapa):
- con el mapa de antes guardado, de un texto del que ya está guardado el mp3 de ahora, la app da ese;
- con la red de los mp3 caída, audioRenew se queda a medias (skipped = "audio") sin borrar ningún viejo, y la app da el
  viejo guardado de cada texto (clipAlt), también al abrirla después sin conexión con el mapa nuevo ya guardado;
- al volver la red, cada viejo se cambia por el de ahora del mismo texto (el mp3 de verdad), salvo aquel cuyo nuevo
  contesta 404, que se queda (y la app lo sigue dando); el mp3 que ya no es de ningún texto se borra, el que el mapa usa
  no se toca, el mapa nuevo queda guardado y la app (clipFor y vocabClipMap) da los de ahora.
"""
from __future__ import annotations

import hashlib
import json

import common as C


def _sha10(s):
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:10]


def _gen(t, i):
    return next((g for g in ("", "v2:", "v3:") if _sha10(g + t) == i), None)


MAP = json.loads((C.ROOT / "audio" / "en.json").read_text(encoding="utf-8"))


def _plan():
    """5 textos del inglés con otro nombre que el primero (sha1 del texto): 3 de la v3 y 2 de la v2 si los hay"""
    v3 = [(t, _sha10(t), i) for t, i in MAP.items() if _gen(t, i) == "v3:"][:3]
    v2 = [(t, _sha10(t), i) for t, i in MAP.items() if _gen(t, i) == "v2:"][:5 - len(v3)]
    plan = v3 + v2
    # un texto de la v3 del que el aparato ya tiene el mp3 nuevo mientras el mapa guardado aún es el de antes
    ahead = next(((t, _sha10(t), i) for t, i in MAP.items() if _gen(t, i) == "v3:" and t not in {x[0] for x in plan}), None)
    keep = next(i for t, i in MAP.items() if i not in {x[2] for x in plan} and (not ahead or t != ahead[0]))
    return plan, keep, bool(v3), bool(v2), ahead


class _Deploy(C._Quiet):
    """ST["old"]: sirve audio/en.json de antes (los textos del plan con su nombre viejo); ST["mp3down"]: corta la conexión
    de los mp3 de audio/ (sin red); ST["missing"]: rutas de mp3 que contestan 404; ST["down"]: todo cortado."""
    ST = {}

    def do_GET(self):
        st, p = self.ST, self.path.split("?")[0]
        if st.get("down") or (st.get("mp3down") and p.startswith("/audio/") and p.endswith(".mp3")):
            self.close_connection = True
            return
        if p in st.get("missing", ()):
            self.send_error(404)
            return
        if p == "/audio/en.json" and st.get("old"):
            m = dict(MAP)
            for t, o, _ in st["plan"] + [st["ahead"]]:
                m[t] = o
            body = json.dumps(m, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


_KEYS = "async () => (await (await caches.open('vocab-media')).keys()).map(r => new URL(r.url).pathname.replace(/^.*\\/audio\\//, 'audio/'))"
_STORED_MAP = "async () => { const r = await (await caches.open('vocab-media')).match('audio/en.json'); return r ? r.json() : null; }"
_CLIPS = "ts => ts.map(t => [clipFor(t), (vocabClipMap('en') || {})[t]])"


def _wait_alt(page, want):
    """espera a que clipFor dé estos nombres (clipAlt se calcula en un momento tranquilo)"""
    page.wait_for_function("([ts, ids]) => ts.every((t, k) => clipFor(t) === ids[k])", arg=[list(want), list(want.values())], timeout=15000)


def test_renamed_clips_are_swapped_on_devices():
    plan, keep, has3, has2, ahead = _plan()
    st = {"plan": plan, "old": True, "ahead": ahead}
    srv = C.Server(C.ROOT, "localhost", handler=type("H", (_Deploy,), {"ST": st}))
    ctx = C.new_context("phone", sw=True, server=srv)
    page = ctx.new_page()
    probs = []
    if not (has3 and has2 and len(plan) == 5 and ahead):
        probs.append(f"el mapa del inglés no tiene audios de la v2 y de la v3: {plan}")
    texts = [t for t, _, _ in plan]
    try:
        # la versión de antes: sus mp3 guardados (cuerpos de mentira), uno que ya no es de nadie y uno que el mapa usa
        C.seed(page)
        page.evaluate("() => localStorage.setItem('vocab:tts', JSON.stringify({told: Date.now()}))")
        page.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=30000)
        page.wait_for_function("() => vocabOffline.state.done !== '' && !vocabOffline.state.busy", timeout=60000)
        page.evaluate("""async ([olds, keep, ahead]) => {
          const m = await caches.open('vocab-media'), mp3 = b => new Response(b, {headers: {'Content-Type': 'audio/mpeg'}});
          for (const id of olds) await m.put(`audio/en/${id}.mp3`, mp3('VIEJO'));
          await m.put('audio/en/0000000000.mp3', mp3('NADIE'));
          await m.put(`audio/en/${keep}.mp3`, mp3('ESTE'));
          await m.put(`audio/en/${ahead}.mp3`, mp3('NUEVO'));
        }""", [[o for _, o, _ in plan], keep, ahead[2]])
        if page.evaluate(_CLIPS, texts) != [[o, o] for _, o, _ in plan]:
            probs.append(f"antes de la versión nueva la app no da los viejos: {page.evaluate(_CLIPS, texts)}")
        # el mapa guardado es el de antes, pero de este texto solo está el mp3 de ahora: la app da ese (clipAlt)
        page.evaluate("clipAltSoon('english')")
        try:
            _wait_alt(page, {ahead[0]: ahead[2]})
        except Exception:  # noqa: BLE001
            probs.append(f"con el mapa de antes, la app no da el mp3 más nuevo guardado de «{ahead[0]}»: {page.evaluate(_CLIPS, [ahead[0]])}")

        # llega la versión nueva y la red de los mp3 falla
        st["old"] = False
        st["mp3down"] = True
        C.reload(page)
        page.wait_for_function("() => { const s = vocabOffline.state; return !s.busy && s.last && s.last.skipped === 'audio'; }", timeout=60000)
        keys = set(page.evaluate(_KEYS))
        for t, o, n in plan:
            if f"audio/en/{o}.mp3" not in keys:
                probs.append(f"a medias se borró el viejo de «{t}»")
        if page.evaluate("vocabOffline.state.done") != "":
            probs.append("a medias, warmCache se da por hecho (no lo repetiría al volver la red)")
        if (page.evaluate(_STORED_MAP) or {}).get(texts[0]) != plan[0][2]:
            probs.append("el mapa nuevo no quedó guardado")
        _wait_alt(page, {t: o for t, o, _ in plan})
        if page.evaluate(_CLIPS, texts) != [[o, o] for _, o, _ in plan]:
            probs.append(f"con el mapa nuevo y sin los mp3 nuevos, la app no da los viejos guardados: {page.evaluate(_CLIPS, texts)}")

        # y se abre otra vez sin conexión, con el mapa nuevo guardado: sigue dando los viejos
        st["down"] = True
        ctx.set_offline(True)
        C.reload(page)
        try:
            _wait_alt(page, {t: o for t, o, _ in plan})
        except Exception:  # noqa: BLE001
            probs.append(f"sin conexión, con el mapa nuevo, la app no da los viejos guardados: {page.evaluate(_CLIPS, texts)}")
        st["down"] = False
        ctx.set_offline(False)

        # vuelve la red; el nuevo del primer texto contesta 404
        st["mp3down"] = False
        st["missing"] = {f"/audio/en/{plan[0][2]}.mp3"}
        C.reload(page)
        page.wait_for_function("() => { const s = vocabOffline.state; return !s.busy && s.done !== '' && s.last && !s.last.skipped; }", timeout=60000)
        last = page.evaluate("vocabOffline.state.last")
        keys = set(page.evaluate(_KEYS))
        t0, o0, n0 = plan[0]
        if f"audio/en/{o0}.mp3" not in keys:
            probs.append(f"«{t0}»: su nuevo dio 404 y se borró el viejo")
        for t, o, n in plan[1:]:
            if f"audio/en/{o}.mp3" in keys:
                probs.append(f"el viejo de «{t}» sigue guardado")
            if f"audio/en/{n}.mp3" not in keys:
                probs.append(f"el nuevo de «{t}» no se guardó")
        if "audio/en/0000000000.mp3" in keys:
            probs.append("el mp3 que ya no es de ningún texto no se borró")
        sizes = page.evaluate("""async ids => {
          const m = await caches.open('vocab-media'), out = {};
          for (const id of ids) { const r = await m.match(`audio/en/${id}.mp3`); out[id] = r ? (await r.arrayBuffer()).byteLength : -1; }
          return out; }""", [n for _, _, n in plan[1:]] + [keep, ahead[2]])
        for t, o, n in plan[1:]:
            real = (C.ROOT / "audio" / "en" / f"{n}.mp3").stat().st_size
            if sizes.get(n) != real:
                probs.append(f"el nuevo de «{t}» guardado no es el mp3 de verdad: {sizes.get(n)} bytes (debe {real})")
        if sizes.get(keep) != len("ESTE") or sizes.get(ahead[2]) != len("NUEVO"):
            probs.append(f"un mp3 que el mapa usa se tocó: {sizes.get(keep)}, {sizes.get(ahead[2])} bytes")
        if (last or {}).get("audioOld", 0) != 5 or (last or {}).get("audio", 0) != 4:
            probs.append(f"el estado no cuenta 4 nuevos y 5 viejos fuera: {last}")
        want = {t0: o0, **{t: n for t, _, n in plan[1:]}}
        try:
            _wait_alt(page, want)
        except Exception:  # noqa: BLE001
            probs.append(f"la app no da los de ahora (y el viejo del 404): {page.evaluate(_CLIPS, texts)}")
        if [x[1] for x in page.evaluate(_CLIPS, texts)] != list(want.values()):
            probs.append(f"vocabClipMap no da lo mismo que clipFor: {page.evaluate(_CLIPS, texts)}")
        probs += [f"error: {e}" for e in C.errors(page) if "ERR_" not in e and "404" not in e and ".mp3" not in e]
    finally:
        try:
            ctx.set_offline(False)
        except Exception:  # noqa: BLE001
            pass
        ctx.close()
        srv.stop()
    assert not probs, "\n".join(probs)
