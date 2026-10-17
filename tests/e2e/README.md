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
  naranja), sin `backdrop-filter` con `html[data-glass=off]` (también el `::backdrop` de la tarjeta de pegatina), todas
  las entradas de `SHELL` de `sw.js` con 200, sin conexión con una caché vieja `vocab-v1` se sirve la versión nueva y lo
  abierto con red sigue tras una versión nueva (sin red de verdad: el servidor parado, con control negativo), tema
  automático, `listen()` que nunca se cuelga, «Descargar todo» con los mp3 del idioma, sin bucles infinitos de atención,
  `M.rm()` en todos los módulos, la lluvia de palabras que reacciona al soltar el dedo (sonido y `G.haptic` solo al
  acertar), el vidrio ligero que cede a los modos de accesibilidad, el clic fantasma (solo el del navegador), los iconos
  del sprite, fallar en gris y sin sonido, y títulos y cápsulas que caben con el texto más grande.
- `test_f2a.py` (armazón de navegación): barra de 5 pestañas, insignias, memoria de cada pestaña, segmentos y título
  grande, barra de arriba (idioma, monedas, Ajustes), modo foco, monedas que vuelan y suenan una vez, movimiento
  tranquilo y lo que se quita (cabecera, pie, estrella y zorro flotantes).
- `test_f2_ajustes.py` (F2b): la Puerta de mayores, los enlaces externos, la hoja de Ajustes y sus páginas,
  Accesibilidad en `vocab:ui` (fuera de la partida), el bloque de Google en Para mayores y la pastilla «Guardar».
- `test_f2_hoy.py` (F2c): Hoy sin scroll, la tarjeta de `nextAction()`, «Repasar N», Misiones y Palabra del día,
  Privacidad y el accesorio «Seguir».
- `test_f2_nav.py` (F2 entero): `aria-selected` en cada ruta, tocar la pestaña activa, la memoria de cada pestaña,
  los segmentos, las insignias con partidas sembradas a propósito (pendientes, un animal con hambre, pegatinas nuevas),
  la barra arriba a 1280 px y abajo a 390 px, el modo foco, el menú de idioma, la tienda desde las monedas, Ajustes,
  lo que se quitó (fab.js, zorro flotante, `<footer>`), la pausa de las partidas (Esc y la ✕: «¿Paramos aquí?» con
  Seguir · Salir, y el juego parado), `sw.js` y una vuelta por todo que deja la partida igual que la de la base.
- `audit.js`: la auditoría de pantalla de `test_f1.py` (contraste, paleta y `backdrop-filter`), reutilizable:
  `page.evaluate(AUDIT, {"what": ["contrast", "palette", "backdrop"]})`. Los logotipos de otras marcas van dentro de
  `[data-brand]` y la paleta no los mira.
- `shots.py`: capturas `<phone|desk>-<light|dark>-<ruta>.png` (móvil a página completa) y `--export` para guardar la
  exportación de la partida sembrada.
- `baseline/export.json`: exportación de la partida sembrada en la versión anterior al rediseño (commit 1721796).

## Sin conexión

`context.set_offline(True)` no corta las peticiones que hace el service worker después de recargar: para probar sin red
de verdad, crea un servidor propio y páralo (`srv = C.Server(C.ROOT, "localhost", handler=...)`,
`C.new_context("phone", sw=True, server=srv)`, luego `srv.stop()`). `handler` puede ser una subclase de `C._Quiet` (por
ejemplo, para servir `sw.js` con otra `VERSION`).

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
