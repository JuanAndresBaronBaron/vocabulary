#!/usr/bin/env python3
"""Capturas de todas las rutas con la partida sembrada (y, si se pide, su exportación).

    python3 tests/e2e/shots.py --out /mnt/project-files/rediseno/capturas/F1                 # móvil y escritorio, claro y oscuro
    python3 tests/e2e/shots.py --root <otra copia> --out <carpeta> --schemes light --export tests/e2e/baseline/export.json
    python3 tests/e2e/shots.py --out <carpeta> --only hoy --only granja --kinds phone --fresh

Ficheros: <out>/<phone|desk>-<light|dark>-<ruta>.png (con --fresh: …-primer-dia-<ruta>.png).
El móvil se captura con la página completa; el escritorio, la ventana (--desk-full para la página completa).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=None, help="carpeta que se sirve (por defecto, el repo)")
    ap.add_argument("--out", required=True, help="carpeta de las capturas")
    ap.add_argument("--kinds", default="phone,desk", help="phone,desk")
    ap.add_argument("--schemes", default="light,dark", help="light,dark")
    ap.add_argument("--reduced", action="store_true", help="con «Reducir movimiento»")
    ap.add_argument("--only", action="append", default=[], help="nombre (o parte) de ruta; se puede repetir")
    ap.add_argument("--fresh", action="store_true", help="sin partida (primer día)")
    ap.add_argument("--desk-full", action="store_true", help="escritorio también con la página completa")
    ap.add_argument("--export", default=None, help="guarda aquí la exportación de la partida sembrada (JSON)")
    a = ap.parse_args(argv)

    if a.root:
        os.environ["VOCAB_ROOT"] = str(Path(a.root).resolve())
    sys.path.insert(0, str(HERE))
    import common as C
    import routes as R
    if a.root:
        C.set_root(a.root)

    out = Path(a.out)
    rs = R.all_routes(a.only or None)
    report = []
    try:
        if a.export:
            page = C.new_page("desk")
            C.seed(page)
            snap = C.export(page)
            snap["keys"] = dict(sorted(snap["keys"].items()))   # orden estable para ver diferencias en git
            C.save_json(snap, a.export)
            print(f"exportación ({len(snap['keys'])} claves) → {a.export}")
            page.context.close()
        for kind in [k for k in a.kinds.split(",") if k]:
            for scheme in [s for s in a.schemes.split(",") if s]:
                page = C.new_page(kind, color_scheme=scheme, reduced_motion="reduce" if a.reduced else "no-preference")
                if a.fresh:
                    C.goto(page, "")
                else:
                    C.seed(page)
                for r in rs:
                    C.clear_errors(page)
                    try:
                        C.goto(page, r["hash"])
                        page.wait_for_timeout(600)
                        name = f"{kind}-{scheme}-{'primer-dia-' if a.fresh else ''}{r['name']}"
                        full = True if kind == "phone" or a.desk_full else False
                        p = C.shot(page, name, out, full_page=full)
                        errs = C.errors(page)
                        print(f"{'ok ' if not errs else 'ERR'} {p}" + (f"  ({len(errs)} errores)" if errs else ""))
                        report += [(name, e) for e in errs]
                    except Exception as e:  # noqa: BLE001
                        print(f"ERR {kind}-{scheme}-{r['name']}: {e}")
                        report.append((f"{kind}-{scheme}-{r['name']}", str(e)))
                page.context.close()
    finally:
        C.close_all()
    if report:
        print("\nErrores durante las capturas:")
        for n, e in report:
            print(f"  {n}: {e.splitlines()[0][:300]}")
    return 1 if report else 0


if __name__ == "__main__":
    sys.exit(main())
