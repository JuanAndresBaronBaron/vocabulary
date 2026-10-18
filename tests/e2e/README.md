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
- `test_f2_ajustes.py` (F2b): la Puerta de mayores (suma de dos cifras y teclado), los enlaces externos, la hoja de Ajustes y sus páginas,
  Accesibilidad en `vocab:ui` (fuera de la partida), el bloque de Google en Para mayores y la pastilla «Guardar».
- `test_f2_hoy.py` (F2c): Hoy sin scroll, la tarjeta de `nextAction()`, «Repasar N», Misiones y Palabra del día,
  Privacidad y el accesorio «Seguir».
- `test_f2_nav.py` (F2 entero): `aria-selected` en cada ruta, tocar la pestaña activa, la memoria de cada pestaña,
  los segmentos, las insignias con partidas sembradas a propósito (pendientes, un animal con hambre, pegatinas nuevas),
  la barra arriba a 1280 px y abajo a 390 px, el modo foco, el menú de idioma, la tienda desde las monedas, Ajustes,
  lo que se quitó (fab.js, zorro flotante, `<footer>`), la pausa de las partidas (Esc y la ✕: «¿Paramos aquí?» con
  Seguir · Salir, y el juego parado), `sw.js` y una vuelta por todo que deja la partida igual que la de la base.
- `test_f2_fix.py` (arreglos de las revisiones de F2): la barra de arriba desde 820 px (cabe con la pastilla, 5 cifras
  de monedas y texto grande, se aprieta por pasos o baja), el borde de la pastilla «Guardar», 3 superficies con
  desenfoque como mucho, la Puerta (200 aperturas tocando al azar, teclado físico, un minuto de espera; desde F4c
  Premios ya no tiene «Para mayores»), rutas y lecciones que no existen, la ✕ del modo foco, el scroll al volver atrás, los avisos en los
  segmentos y del refugio, hojas opacas a toda altura y centradas en el ordenador, «Reducir movimiento» en el fondo de
  las hojas, la hoja corta del aviso de Google, Voz y velocidad sin tecnicismos, el título de cada pantalla, créditos
  y privacidad en español, Hoy en móviles bajos, el borde de la granja y el accesorio a lo ancho.
- `test_f3_leccion.py` (F3a, `js/lesson.js`): acertar pasa solo ≤ 1,2 s tras el audio y nunca antes de 0,9 s (audio
  simulado), fallar en gris con ✗ y la buena en verde sin temblor, vibración ni sonido triste, deslizar con
  PointerEvents sintéticos igual que «Continuar», recargar a mitad sigue donde estaba, Atrás a mitad pregunta
  «¿Paramos aquí?» (guarda de salida) y «Salir» deja lo hecho en `vocab:ls` para la cápsula «Seguir · Lección N»
  (plan-doc), el accesorio «Seguir · Lección N», el final (estrellas
  de una en una, monedas una vez, «Mañana repasas N palabras», confeti), la gramática, «Cómo suena» y el camino y el
  repaso guardados igual que en la versión anterior (commit 3396fc7) para la misma secuencia.
- `test_f3_repaso.py` (F3b, `js/review.js`): `#/repaso` directo a la primera tarjeta en modo foco, girar (350 ms, con
  «Reducir movimiento» un fundido), las notas 2 · 1 · 0 comparadas con lo que escribe el `srsGrade` de siempre (y
  `srsGrade`/`srsNext` iguales a los del commit 1721796), deslizar con PointerEvents sintéticos igual que los botones,
  la pista del gesto en el segundo giro, «Ver» como botón principal, las dos pistas (artículo y primera letra, luego
  la primera sílaba y las letras que faltan), «Dilo en …» con un `SpeechRecognition` simulado (acierto que puntúa solo,
  comparación estricta que no acepta otra palabra conocida, fallo que nunca pone 0, «No me sale» solo tras un fallo y
  que da 0 y la vuelve a preguntar, los 7 s de `listen()`, sin permiso, sin red, sin micrófono), sin reconocedor
  «Piénsala… y toca para ver», el final en su tarjeta que paga una vez y va a Hoy, «Todo repasado», «¿Paramos aquí?»
  con el accesorio y la auditoría.
- `test_f3_fix.py` (arreglos de la revisión de F3): la palabra nueva de la lección nunca se parte, dos toques rápidos
  no se saltan el final (lección y repaso), decir la palabra y salir antes de decidir sigue puntuando, una tarjeta
  que vuelve cuenta como mucho una vez, el micrófono sin red o sin aparato, la lección guardada conserva las
  repeticiones y rechaza valores malos (también tras cerrar la pestaña), la hoja «Cómo suena» se cierra al salir,
  detalles de la lección y del repaso (foco, avisos, textos), la flecha de la ficha en la barra de arriba con los
  detalles de Aprender (Lista, Tarjetas, Preguntas, Escribir con su hoja «Opciones») y las columnas del ordenador.
- `test_f3_aprender.py` (F3c, `js/learn.js`): la pastilla de nivel (menú con los 6 niveles, teclado, `mapLv` como
  antes: el Camino lo guarda y Gramática no), «Mi lección» (sale, baja con scroll y se va; ↑ muy abajo; vidrio
  ligero), mantener pulsado un nodo hecho (vistazo con estrellas, palabras y «Repetir», sin abrir la lección al
  soltar), tocar nodos (bloqueado con aviso, hecho y actual abren su lección), `#/palabras` con sus tres grupos,
  anillos contados en `srs:<idioma>` y Avanzado plegado (recordado en la sesión), la ficha en Tarjetas con sus
  segmentos (modo recordado por tema), la fila que se despliega (IPA solo con la opción) y que al deslizarla con
  PointerEvents sintéticos escribe lo mismo que `srsAdd(id, [fila], 0)`, Preguntas igual que `srsGrade` (fallo gris,
  sin temblor, paga una vez), Escribir con `prPrefs`, `prAuto`, `prEx` y `pr:<tema>:<idioma>` de siempre, Gramática que
  despliega y «Practicar», URL directas (y `#/doc` sin tema → `#/palabras`) y la partida igual tras recorrerlo todo.
- `test_f3_int.py` (F3 entero): orden de carga de `js/lesson.js`, `js/review.js` y `js/learn.js` (detrás del script
  principal, de `motion.js` y de `gestures.js`, listos al primer `route()`), `sw.js` en la versión 17 o más con los tres
  en `SHELL` y `OFF_APP`; cada ruta de F3 por enlace directo, al recargar y navegando (pestaña, segmentos, nodo del
  camino, «Practicar»); Hoy › Empezar › fin de lección › «Siguiente lección»; Hoy › Repasar › final › «Seguir» a Hoy;
  Palabras › ficha › Preguntas; Gramática › Practicar; «Salir» a media lección y seguir con la cápsula; respuestas de la lección y de Preguntas que
  no se parten a media palabra (texto normal y grande, antes y después de contestar); francés y danés
  en cada pantalla de Aprender (y en el repaso y la lección); y una vuelta por todo F3 que deja la partida como la base.
- `test_f4_granja.py` (F4b, `js/farm.js` con `ROUTES.granja`): la escena a pantalla completa sin scroll, título, ficha,
  tareas, bienvenida ni ayuda; el dock de vidrio ligero con Regar · Comida · Tienda; la hoja de la tienda (dos alturas)
  con solo cosas de la granja y comida, comprar una vez sin volver a montar la granja y la pastilla de monedas que la
  abre (también desde otra pestaña); arrastrar la comida = tocarla y tocar el animal = elegirla en su globo (la misma
  partida); arrastrar la regadera = «Regar» y tocar; acariciar sin tocar `s.fed`; mantener pulsado y mover (se guarda en
  `farm:state.pos` y sigue al recargar); la mano de la primera vez (3 vueltas, quieta con «Reducir movimiento»);
  «¿Cómo me llamo?» con «Dilo» (reconocedor simulado: acertar entra en el repaso como `srsGrade(…, 2)`, no entender
  nunca es fallo; sin reconocedor se toca; la mala en gris con ✗); la frase del hambre en inglés, francés y danés con
  su voz (`speechSynthesis` simulado; una vez por animal y visita, y callada si ya suena algo); `.fm-season` y
  `farm-mounted`; contraste y paleta (capturas `F4b-granja-*` en `capturas/F4`) y la partida exportada como la base.
  Desde F4b, `test_f4_shop.py` compra lo de la granja en esa hoja y los trajes en una tienda de prueba (como Mi zorro).
- `test_f4_shop.py` (F4-0, `js/shop.js`, `window.vocabShop`): comprar resta el precio una vez y emite `buy` una vez
  (también con doble toque; la pieza pasa a «En tu granja», sale en la escena, suena la palabra y «¡Nuevo! …», sin
  repintar la página); un traje comprado se pone; sin monedas no compra (cápsula gris «Te faltan N», aviso amable, sin
  `bad` ni temblor); ponerse/quitarse alterna (y emite `wear`); el personaje no se quita («Eres tú» / «Elegir»);
  `refreshPrices` con `award`, con un gasto que solo emite `coins` y a mano, sin volver a montar la granja; los selectores
  de `farm.js` (`.shop .sc[data-id]`, `.se`, `.sn`, `[data-sb]`, `span.own`, `[data-buy]`, `[data-wear]`, `[data-shelter]`)
  y «Ir al refugio» (una vez; desde una hoja la cierra; `goShelter()` desde otra pantalla); el regalo de bienvenida
  pone al día las piezas; la API (`items`, `state`, `card` en cada estado, `images()` con 200, otra lengua); `bind()` en
  otra pantalla con `onChange` y `off()`; piezas que caben, botones de 44 px y contraste/paleta en móvil y escritorio,
  claro y oscuro (capturas `F4-0-tienda-*` en `capturas/F4`); la partida exportada como la base y `js/shop.js` en
  `SHELL` y `OFF_APP`.
- `test_f4_juegos.py` (F4a, `js/games.js` y `js/lince.js`): el menú sin las piezas viejas, tarjetas sólidas con el
  récord en estrellas de oro, la pastilla «Tema: … ▾» con su hoja («Mis palabras» primero; se guarda en
  `games:topic`), la explicación solo la primera vez (en `vocab:ui`, fuera de la partida), el «?» con la partida en
  pausa y la tarjeta corta al recargar, mantener pulsada una tarjeta (vistazo) y tocar para jugar, los 5 juegos hasta
  el resultado con `award` una vez desde «+N» y las monedas volando, fallos grises con ✗ en todos, Esc y la ✕ abren la
  pausa (y en Lince la pausa espera), Oído de lince (8 rondas, audio grabado interceptando `HTMLMediaElement.play`,
  verde/gris, las dos palabras al fallar, altavoz y tortuga a 0,7, teclas 1/2, récord, francés y danés),
  `data/lince.json` válido (≥ 12 pares por idioma, palabras del corpus con audio y dibujo), sin bucles infinitos, la
  fila de arriba que cabe en el móvil, contraste/paleta (capturas `F4a-juegos-*` y `F4a-lince-*` en `capturas/F4`) y
  la partida exportada como la base.
- `test_f4_premios.py` (F4c, `js/rewards.js` y `js/album.js`): `ROUTES.progreso`/`ROUTES.mizorro`, `window.vocabRewards`,
  los segmentos Medallas · Mi zorro y `js/rewards.js` en `SHELL` y `OFF_APP`; Premios cabe en 2 alturas a 390×844 con la
  partida sembrada y sin lo que se quitó (casillas, calendario, ayuda, mayores); la semana de lunes a domingo (sembrada
  y sin práctica hoy: hoy vacío, nada late); «Tu próxima medalla» = la de más progreso (también con 990 de 1000 monedas);
  la hoja de detalle (falta / conseguida, ratón y teclado); una medalla nueva gira una vez (`vocab:ui.medals`); Mi zorro
  (comprar un sombrero resta una vez y se lo pone, saltito, quitárselo, elegir la rana, sin piezas de la granja); el
  álbum: portada con anillo y una línea y las partes en un control segmentado (`album:tab`, flechas, recargar),
  deslizar `#al-page` con el dedo (CDP: < 60 px, en diagonal, con un diálogo abierto o sin tema a ese lado no pasa) y
  la hoja «Tema», despegar (uno y todos) y completar un tema que da 50 una sola vez, la tarjeta con botones de icono y la
  IPA solo con la opción; sin bucles infinitos; contraste/paleta (capturas `F4c-*` en `capturas/F4`) y la partida
  exportada como la base.
- `test_f4_int.py` (F4 entero): orden de carga de `js/shop.js`, `js/lince.js`, `js/rewards.js` y `js/season.js` y lo
  que registran antes del primer `route()`; `sw.js` en la versión 19 o más con `OFF_SHELL` igual, `SHELL` = `OFF_APP` con
  los ficheros nuevos y cada `<script>` de la app con `?v=<VERSION>`; `"season"` en `js/save.js` y toda clave que la app
  escribe registrada; «Descargar todo» con los dibujos de `img/shop`, `img/games` e `img/season`; cada ruta de F4 por
  enlace directo, al recargar y navegando (en pleno Halloween por la fecha); la granja vende solo cosas de la granja
  (hoja opaca y sin desenfoque) y Mi zorro solo trajes, la pastilla de monedas abre la hoja desde cualquier pestaña y lo comprado
  en uno se ve en el otro; los 5 juegos seguidos; la granja (comer y regar arrastrando, mover, comprar, recargar);
  Medallas y Mi zorro; Halloween (Hoy › Truco o trato › calabazas en la granja, `?season=off`) y el adviento; francés y
  danés en juegos, lince, granja, tienda y Mi zorro; una vuelta sin jugar que deja la partida como la base; y la
  actualización desde la versión publicada (el commit 1721796 sacado con `git archive`, o la copia de `VOCAB_BASE`;
  sw `vocab-v13`) en el mismo origen: partida y granja intactas, la app nueva entera (también con las cabeceras de caché
  de GitHub Pages y recargando al momento) y sin conexión.
- `test_imagenes_movil.py` (dibujos grandes en el celular): el lado del dibujo (el cuadrado que cabe en su `<img>`) en
  Globos con el tema Familia, Memoria, Letras locas, Lluvia, Oído de lince, el repaso, «Escucha y elige» de la lección y
  «Elige el dibujo» de Truco o trato, en 360×740 y 390×844 (Globos también en 320, 375, 430 y 844×390) contra un mínimo;
  la zona de juego sin scroll en los celulares de la lista con 4 globos (que no se tocan ni se salen; un fallo, gris con
  ✗, sigue cabiendo); y en el iPad 820×1180 y el ordenador 1280×800 ningún dibujo más pequeño que antes (`BEFORE`).
  También: un fallo con un nombre largo (Países) no mueve ni encoge los globos, el acierto sale en la tarjeta de escuchar,
  la ✗ va arriba del globo, las banderas llevan su caja 4:3 con filete, ningún globo es gris, tumbado (844×390 con
  márgenes seguros de 47 px, 667×375 y 568×320) los globos son grandes y no se baja, con «Reducir movimiento» no saltan
  de tamaño; tras un fallo en «Escucha y elige» la lección no baja (también en 1280×720 y con «Texto más grande») y la
  ✓/✗ va en la esquina del dibujo; el repaso con dos pistas, Letras con texto grande y la cara blanca de Memoria oscuro.
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
