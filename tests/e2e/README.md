# Pruebas e2e

Python + Playwright (síncrono) con el Chromium de `/opt/pw-browsers/chromium-1194`. No necesitan red: la web se
sirve en `127.0.0.1` desde una carpeta y las peticiones a otros dominios se cortan.

```sh
python3 tests/e2e/run.py                     # todas
python3 tests/e2e/run.py --only smoke        # por módulo, función o patrón (se puede repetir)
python3 tests/e2e/run.py --root ../otra-copia --only export
python3 tests/e2e/run.py --list
python3 tests/e2e/shots.py --out /mnt/project-files/rediseno/capturas/F1        # capturas de todas las rutas
```

`run.py` ejecuta cada función `test_*` de cada `test_*.py`, imprime PASS/FAIL y sale con código 1 si algo falla.
Una prueba falla lanzando una excepción (normalmente `assert`).

## Ficheros

- `common.py`: servidor, navegador, contextos `phone` (390×844 táctil ×2) y `desk` (1280×800), errores de consola,
  `goto()`, la partida sembrada (`seed()`), la exportación de `js/save.js` (`export()`) y capturas (`shot()`).
- `routes.py`: las rutas que se recorren (`all_routes()`); cada fase añade las suyas con `add(name, hash, what)`.
- `test_smoke.py`: ninguna ruta da errores (móvil/escritorio, claro/oscuro, reducir movimiento, primer día y
  enlaces directos); la partida sembrada no cambia al arrancar ni al recargar, es igual a la de la versión anterior
  y la exportación de antes se carga entera.
- `test_f1.py` (cimientos): contraste ≥ 4,5:1 de los textos de cada ruta, ningún color prohibido (tono 260-340° o
  naranja), sin `backdrop-filter` con `html[data-glass=off]`, todas las entradas de `SHELL` de `sw.js` con 200, sin
  conexión con una caché vieja `vocab-v1` se sirve la versión nueva, tema automático, `listen()` que nunca se cuelga,
  «Descargar todo» con los mp3 del idioma, sin bucles infinitos de atención, `M.rm()` en todos los módulos y la lluvia
  de palabras que reacciona al soltar el dedo (sonido y `G.haptic` solo al acertar).
- `audit.js`: la auditoría de pantalla de `test_f1.py` (contraste, paleta y `backdrop-filter`), reutilizable:
  `page.evaluate(AUDIT, {"what": ["contrast", "palette", "backdrop"]})`. Los logotipos de otras marcas van dentro de
  `[data-brand]` y la paleta no los mira.
- `shots.py`: capturas `<phone|desk>-<light|dark>-<ruta>.png` (móvil a página completa) y `--export` para guardar la
  exportación de la partida sembrada.
- `baseline/export.json`: exportación de la partida sembrada en la versión anterior al rediseño (commit 1721796).

## Reloj y partida sembrada

Cada contexto arranca con el reloj en `FIXED_NOW` (11-3-2026, 10:00, Europe/Madrid; el tiempo corre normal desde
ahí) para que la partida sembrada y su exportación salgan siempre iguales. `new_context(now=None)` usa la hora real;
`now=datetime(...)` otra fecha (por ejemplo, para probar Halloween).

## Escribir una prueba

```python
import common as C, routes as R

def test_algo():
    page = C.new_page("phone", color_scheme="dark")
    try:
        C.seed(page)                       # partida de ejemplo y abre Hoy
        C.goto(page, "#/granja")
        assert not C.errors(page), C.errors(page)
    finally:
        page.context.close()
```
