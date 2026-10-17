"""Humo: ninguna ruta da errores (móvil y escritorio, claro y oscuro, reducir movimiento, primer día y enlaces
directos) y la partida guardada no cambia al recargar, coincide con la de la versión anterior y se puede cargar."""
from __future__ import annotations

import common as C
import routes as R


def _fmt(problems):
    lines = []
    for name, errs in problems.items():
        lines.append(f"{name}:")
        lines += [f"    {e.splitlines()[0][:300]}" for e in errs[:6]]
        if len(errs) > 6:
            lines.append(f"    … y {len(errs) - 6} más")
    return "\n".join(lines)


def _walk(kind, scheme="light", reduced="no-preference", seeded=True, deep=False, linger=400):
    """Recorre todas las rutas en una sola página (deep=True: cargando cada una desde cero, como un enlace directo).
    Devuelve {ruta: [errores]}; los errores al salir de una ruta cuentan en la siguiente."""
    page = C.new_page(kind, color_scheme=scheme, reduced_motion=reduced)
    problems = {}
    try:
        if seeded:
            C.seed(page)
        else:
            C.goto(page, "")
        if C.errors(page):
            problems["(arranque)"] = C.errors(page)
        for r in R.all_routes():
            C.clear_errors(page)
            try:
                C.goto(page, r["hash"], reload=deep)
                page.wait_for_timeout(linger)
            except Exception as e:  # noqa: BLE001
                problems[r["name"]] = [f"no termina de pintar: {e}"] + C.errors(page)
                continue
            if C.errors(page):
                problems[r["name"]] = C.errors(page)
        C.clear_errors(page)
        C.goto(page, "")
        if C.errors(page):
            problems["(vuelta a Hoy)"] = C.errors(page)
    finally:
        page.context.close()
    return problems


def test_routes_phone_light():
    """Todas las rutas en el móvil, modo claro, con la partida sembrada: sin errores de consola."""
    p = _walk("phone", "light")
    assert not p, "errores en móvil claro:\n" + _fmt(p)


def test_routes_phone_dark():
    """Todas las rutas en el móvil, modo oscuro: sin errores."""
    p = _walk("phone", "dark")
    assert not p, "errores en móvil oscuro:\n" + _fmt(p)


def test_routes_desk_light():
    """Todas las rutas en el escritorio, modo claro: sin errores."""
    p = _walk("desk", "light")
    assert not p, "errores en escritorio claro:\n" + _fmt(p)


def test_routes_desk_dark():
    """Todas las rutas en el escritorio, modo oscuro: sin errores."""
    p = _walk("desk", "dark")
    assert not p, "errores en escritorio oscuro:\n" + _fmt(p)


def test_routes_phone_reduced_motion():
    """Todas las rutas en el móvil con «Reducir movimiento»: sin errores."""
    p = _walk("phone", "light", reduced="reduce")
    assert not p, "errores con reducir movimiento:\n" + _fmt(p)


def test_routes_first_day():
    """Primer día (sin partida guardada), móvil claro: todas las rutas sin errores."""
    p = _walk("phone", "light", seeded=False)
    assert not p, "errores el primer día:\n" + _fmt(p)


def test_deep_links():
    """Cada ruta abierta desde cero (enlace directo o recarga), móvil oscuro: sin errores."""
    p = _walk("phone", "dark", deep=True, linger=250)
    assert not p, "errores al abrir rutas directamente:\n" + _fmt(p)


def test_export_reload_identical():
    """Partida sembrada: arrancar no cambia ninguna clave y exportar → recargar → exportar da lo mismo."""
    page = C.new_page("phone")
    try:
        keys = C.seed(page)
        a = C.export(page)
        assert a.get("app") == "vocabulary" and a.get("v") == 1, f"cabecera rara: { {k: a.get(k) for k in ('app', 'v')} }"
        d0 = C.diff_exports(keys, a["keys"])
        C.reload(page)
        b = C.export(page)
        d1 = C.diff_exports(a, b, allow_new=False)
        errs = C.errors(page)
    finally:
        page.context.close()
    msg = []
    if d0:
        msg.append("al arrancar cambia la partida sembrada:\n  " + "\n  ".join(d0))
    if d1:
        msg.append("al recargar cambia la exportación:\n  " + "\n  ".join(d1))
    if errs:
        msg.append("errores:\n  " + "\n  ".join(errs))
    assert not msg, "\n".join(msg)


def test_export_matches_baseline():
    """La exportación de la partida sembrada es la de la versión anterior (tests/e2e/baseline/export.json),
    salvo claves nuevas."""
    base = C.load_baseline()
    assert base, f"falta {C.BASELINE} (se crea con: python3 tests/e2e/shots.py --root <versión anterior> --export {C.BASELINE})"
    page = C.new_page("desk")
    try:
        C.seed(page)
        now = C.export(page)
    finally:
        page.context.close()
    d = C.diff_exports(base, now)
    extra = C.new_keys(base, now)
    if extra:
        print(f"      claves nuevas respecto a la base: {', '.join(extra)}")
    assert not d, "la partida exportada no es la de antes:\n  " + "\n  ".join(d)


def test_import_baseline():
    """La exportación de la versión anterior se carga entera (parse + apply) y, tras recargar, se exporta igual."""
    base = C.load_baseline()
    assert base, f"falta {C.BASELINE}"
    page = C.new_page("phone")
    try:
        C.goto(page, "")
        res = C.import_export(page, base)
        assert res.get("ok"), f"no se pudo cargar: {res.get('err')}"
        assert res.get("n") == len(base["keys"]) and not res.get("ignored") and not res.get("bad"), f"carga incompleta: {res}"
        after = C.export(page)
        C.goto(page, "#/granja")
        errs = C.errors(page)
    finally:
        page.context.close()
    d = C.diff_exports(base, after)
    assert not d, "tras cargar la partida de antes, la exportación cambia:\n  " + "\n  ".join(d)
    assert not errs, "errores tras cargar la partida:\n  " + "\n  ".join(errs)
