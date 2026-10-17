#!/usr/bin/env python3
"""Ejecuta las pruebas e2e: cada función test_* de cada tests/e2e/test_*.py.

    python3 tests/e2e/run.py                         # todas, sirviendo el repo
    python3 tests/e2e/run.py --only smoke            # las que contienen "smoke" (módulo, función o módulo::función)
    python3 tests/e2e/run.py --only 'test_smoke::test_routes_*' --only export
    python3 tests/e2e/run.py --root /otra/carpeta    # sirve otra copia de la web (p. ej. la versión anterior)
    python3 tests/e2e/run.py --list                  # solo lista las pruebas

Imprime PASS/FAIL por prueba y un resumen; sale con código 1 si alguna falla (2 si no hay ninguna que ejecutar).
"""
from __future__ import annotations

import argparse
import fnmatch
import importlib.util
import inspect
import os
import sys
import time
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent


def discover():
    out = []
    for f in sorted(HERE.glob("test_*.py")):
        spec = importlib.util.spec_from_file_location(f.stem, f)
        mod = importlib.util.module_from_spec(spec)
        sys.modules[f.stem] = mod
        spec.loader.exec_module(mod)
        fns = [(n, fn) for n, fn in vars(mod).items()
               if n.startswith("test_") and inspect.isfunction(fn) and fn.__module__ == mod.__name__]
        fns.sort(key=lambda x: x[1].__code__.co_firstlineno)
        out += [(f.stem, n, fn) for n, fn in fns]
    return out


def matches(mod, name, pats):
    if not pats:
        return True
    full = f"{mod}::{name}"
    for p in pats:
        if any(ch in p for ch in "*?[") and (fnmatch.fnmatch(full, p) or fnmatch.fnmatch(name, p) or fnmatch.fnmatch(mod, p)):
            return True
        if p in full:
            return True
    return False


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", action="append", default=[], help="patrón (subcadena o comodines) de módulo/función; se puede repetir")
    ap.add_argument("--root", default=None, help="carpeta que se sirve (por defecto, el repo)")
    ap.add_argument("--list", action="store_true", help="lista las pruebas sin ejecutarlas")
    ap.add_argument("-x", "--exitfirst", action="store_true", help="para en el primer fallo")
    a = ap.parse_args(argv)

    if a.root:
        root = Path(a.root).resolve()
        if not (root / "index.html").exists():
            ap.error(f"{root} no tiene index.html")
        os.environ["VOCAB_ROOT"] = str(root)
    sys.path.insert(0, str(HERE))
    import common as C
    if a.root:
        C.set_root(a.root)

    tests = [t for t in discover() if matches(t[0], t[1], a.only)]
    if a.list:
        for mod, name, fn in tests:
            doc = (fn.__doc__ or "").strip().splitlines()
            print(f"{mod}::{name}" + (f"  — {doc[0]}" if doc else ""))
        return 0
    if not tests:
        print("No hay pruebas que coincidan.")
        return 2

    print(f"Sirviendo {C.ROOT}  ·  {len(tests)} prueba(s)\n")
    results = []
    t_all = time.time()
    try:
        for mod, name, fn in tests:
            t0 = time.time()
            try:
                fn()
                ok, err = True, ""
            except Exception as e:  # noqa: BLE001
                ok = False
                tb = traceback.extract_tb(e.__traceback__)
                where = next((f"{Path(fr.filename).name}:{fr.lineno}" for fr in reversed(tb) if Path(fr.filename).parent == HERE), "")
                msg = str(e) or e.__class__.__name__
                if not isinstance(e, AssertionError):
                    msg = f"{e.__class__.__name__}: {msg}"
                err = (f"[{where}] " if where else "") + msg
            dt = time.time() - t0
            results.append((mod, name, ok, err, dt))
            print(f"{'PASS' if ok else 'FAIL'}  {mod}::{name}  ({dt:.1f} s)")
            if not ok:
                for line in err.splitlines():
                    print(f"      {line}")
            sys.stdout.flush()
            if not ok and a.exitfirst:
                break
    finally:
        C.close_all()

    fails = [r for r in results if not r[2]]
    print(f"\n{len(results) - len(fails)} PASS · {len(fails)} FAIL · {time.time() - t_all:.0f} s")
    for mod, name, _, err, _ in fails:
        print(f"  FAIL {mod}::{name}: {err.splitlines()[0] if err else ''}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
