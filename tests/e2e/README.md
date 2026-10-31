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
Una prueba falla lanzando una excepción (normalmente `assert`). Las capturas de las pruebas van a
`/mnt/project-files/rediseno/capturas/<fase>`; `VOCAB_CAPTURAS=<carpeta>` las manda a otra (p. ej. si la carpeta
compartida no responde).

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
  Accesibilidad en `vocab:ui` (fuera de la partida), el bloque de Google en Para mayores y Google sin botón de guardar
  (con un GIS de mentira: el permiso caducado se renueva en el siguiente toque normal, nunca en mitad de una partida,
  una lección, la Puerta o un campo de texto, ni en el toque que empieza algo, en una pregunta de la granja, la
  temporada o Palabras, o en lo que suena, como girar una tarjeta de Palabras › Tarjetas o su «Automático»; tras un fallo, otra vez pasados 3 min; tras dos, a los 50 min y cada vez más
  espaciado (hasta una vez al día), también tras recargar; un permiso que llega tarde vale; dos pestañas no se lo
  quitan; Para mayores dice de un vistazo si la copia está al día y «Volver a conectar» sale solo si «Guardar ahora» no
  pudo; capturas en `capturas/guardado-puerta`).
- `test_f2_hoy.py` (F2c): Hoy sin scroll, la tarjeta de `nextAction()`, «Repasar N», Misiones y Palabra del día,
  Privacidad y el accesorio «Seguir».
- `test_inicio.py` (Hoy, la primera vez y el día a día; `js/welcome.js`, `home()`/`nextAction()` de index.html y las
  Misiones de `js/buddy.js`): la bienvenida de un aparato nuevo con `?hello=on` (a pantalla completa; el primer toque lee
  la pregunta en español; las 3 banderas eligen el idioma y suenan con `say()`; el nombre; «¡Vamos!» a la primera
  lección; «Saltar»; los avisos esperan; no sale con partida, con Google, con `?hello=off` ni sin `?hello=on` en un
  navegador automático; 360 con letra grande, oscuro y 1280); el zorro lee Hoy y cada misión con la voz española
  (`speechSynthesis` de mentira; sin voz española, sin altavoces); el anillo de Misiones, la semana con la llama,
  «¡Lo de hoy, hecho!» con confeti una vez; el cofre (sorpresa por día, media ≈ 25, sin anunciar, no caduca); las 10
  monedas del día como sorpresa visible de la primera práctica (nunca por abrir la app); la temporada alcanzable desde
  la esquina de la tarjeta a 360×740 con letra grande; cada misión a su actividad y «Acierta…» con estrella; sin «G»
  arriba; los 3 dibujos de lo que toca y Hoy sin scroll a 360×740 y 390×844 (también con letra grande). Capturas en
  `capturas/inicio`.
- `test_f2_nav.py` (F2 entero): `aria-selected` en cada ruta, tocar la pestaña activa, la memoria de cada pestaña,
  los segmentos, las insignias con partidas sembradas a propósito (pendientes, un animal con hambre, pegatinas nuevas),
  la barra arriba a 1280 px y abajo a 390 px, el modo foco, el menú de idioma, la tienda desde las monedas, Ajustes,
  lo que se quitó (fab.js, zorro flotante, `<footer>`), la pausa de las partidas (Esc y la ✕: «¿Paramos aquí?» con
  Seguir · Salir, y el juego parado), `sw.js` y una vuelta por todo que deja la partida igual que la de la base.
- `test_f2_fix.py` (arreglos de las revisiones de F2): la barra de arriba desde 820 px (cabe con 5 cifras de monedas y
  texto grande, se aprieta o baja), la barra de arriba sin pastilla «Guardar» ni su hueco, 3 superficies con
  desenfoque como mucho, la Puerta (200 aperturas tocando al azar, teclado físico, un minuto de espera; desde F4c
  Premios ya no tiene «Para mayores»), rutas y lecciones que no existen, la ✕ del modo foco, el scroll al volver atrás, los avisos en los
  segmentos y del refugio, hojas opacas a toda altura y centradas en el ordenador, «Reducir movimiento» en el fondo de
  las hojas, Hoy sin aviso de Google, Voz y velocidad sin tecnicismos, el título de cada pantalla, créditos
  y privacidad en español, Hoy en móviles bajos, el borde de la granja y el accesorio a lo ancho.
- `test_f3_leccion.py` (F3a, `js/lesson.js`): acertar pasa solo ≤ 1,2 s tras el audio y nunca antes de 0,9 s (audio
  simulado), fallar en gris con ✗ y la buena en verde sin temblor, vibración ni sonido triste, deslizar con
  PointerEvents sintéticos igual que «Continuar», recargar a mitad sigue donde estaba, Atrás a mitad pregunta
  «¿Paramos aquí?» (guarda de salida) y «Salir» deja lo hecho en `vocab:ls` para la cápsula «Seguir · Lección N»
  (plan-doc), el accesorio «Seguir · Lección N», el final (estrellas
  de una en una, monedas una vez, «Mañana repasas N palabras», confeti), la gramática, «Cómo suena» y el camino y las
  monedas guardados igual que en la versión anterior (commit 3396fc7) para la misma secuencia; el repaso, como dicta el
  formato de ahora (la fallada a la caja 0, las demás a la 1, las de repaso con `srsGrade`).
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
  segmentos (modo recordado por tema), la fila que se despliega (con la IPA, salvo que un mayor la apague:
  `vocab:ui.ipa = false`) y que al deslizarla con PointerEvents sintéticos escribe lo mismo que `srsAdd(id, [fila], 0)`,
  Preguntas igual que `srsGrade` (fallo gris, sin temblor, paga una vez), Escribir con `prPrefs`, `prAuto`, `prEx` y
  `pr:<tema>:<idioma>` de siempre, Gramática que despliega y «Practicar», URL directas (y `#/doc` sin tema →
  `#/palabras`) y la partida igual tras recorrerlo todo.
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
  IPA, salvo que un mayor la apague (`vocab:ui.ipa = false`); sin bucles infinitos; contraste/paleta (capturas `F4c-*`
  en `capturas/F4`) y la partida exportada como la base.
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
- `test_f5_teclado.py` (F5b, `js/keys.js` y los `shortcuts` del manifest): en la lección Espacio suena una vez,
  Mayús+Espacio más despacio, 1-4 eligen, Enter pasa una sola vez (con el foco en la página y en el botón) y Esc abre
  «¿Paramos aquí?»; en el repaso ← es «No» y → «¡Sí!» (una nota cada una); en Hoy Enter es «Empezar»; ? abre la hoja
  «Teclas» y Esc la cierra; Tarjetas (Espacio gira y luego oye, → y Enter pasan una); escribiendo en un campo no pasa
  nada; en un juego las teclas son del juego y Esc pausa una vez; las etiquetas grises salen con la primera tecla y se
  van con un toque; el manifest sin errores en Chrome con 4 atajos e iconos PNG 96×96, y cada URL de atajo abre su
  pantalla en frío y con el service worker; la partida exportada como la base.
- `test_f5_atajos.py` (F5a, `js/shortcuts.js`, `window.vocabShortcuts`): una partida de Globos de verdad y dos por el bus
  hacen el atajo «Globos · Animales» en Hoy (y sigue al recargar); tocarlo abre el juego con ese tema
  (`#/juegos/<juego>?t=<tema>`) sin cambiar `games:topic`; Tarjetas (8 giradas), Preguntas y la gramática cuentan;
  21 días después los puntos bajan (la mitad cada 7) y el atajo se va; la regla del 20 % y los sitios fijos; Fijar
  (también manteniendo pulsado) persiste y va en `sc:prefs`; «No sugerir» con «Deshacer»; `vocab:sc` solo del aparato;
  el interruptor y «Olvidar lo aprendido» de Para mayores; la pregunta de la tortuga una sola vez; Hoy sin scroll a
  390×844 con la fila; 4 piezas en tableta; lo que quedó a medias primero con anillo; las teclas 1-3; capturas en
  `capturas/F5/F5a-*`; la partida exportada como la base salvo `sc:prefs`.
- `test_f5_buzon.py` (F5c, `js/mailbox.js`, `window.vocabMailbox` y `window.vocabMedia`; MediaRecorder, getUserMedia,
  `navigator.share` y la voz del navegador simulados): la frase del micrófono antes de pedirlo, grabar para solo a los
  20 s, «Escucharme», «Otra vez», «Muy cortito» y las 5 últimas en IndexedDB; sin micrófono o sin permiso, una frase
  amable; «Mandar» comparte el archivo con el enlace de respuesta (o lo descarga); la Puerta antes de contestar y el
  enlace `#/carta?d=`; el enlace en una pestaña limpia da las monedas o el adorno una sola vez (recargar, reabrir y otro
  aparato con la partida copiada, nada); enlaces rotos o con `<script>` no dan nada; los 3 candados se abren; el sobre
  en Hoy (tiembla 3 veces, quieto con movimiento reducido, sin scroll); la tarjeta de Juegos; IndexedDB fuera de la
  partida y «Borrar grabaciones y fotos»; capturas en `capturas/F5/F5c-*`; la partida exportada como la base.
- `test_f5_frases.py` (F5d, `js/phrases.js` y `data/phrases.json`; audio y voz simulados): las plantillas de los tres
  idiomas se rellenan bien con palabras de verdad (a/an, la elisión del francés, en/et y min/mit del danés); #/frases con
  el hueco y 3-4 dibujos de palabras que sabe (tocar o arrastrar los pone), la voz y el audio grabado en orden, «Otra
  frase» y «Dilo» (no entender no es fallo); la frase de la cena igual todo el día y en otro aparato; el sello con la
  Puerta (+5 una vez al día, en la partida como `phrase:stamps`); la fila de Hoy con su altavoz y sin scroll; la tarjeta
  de Juegos; inglés, francés y danés; capturas `F5d-*`; la partida exportada como la base.
- `test_f6_cuentos.py` (F6i, `js/stories.js` y `data/stories/`; voz con onstart/onboundary y audio simulados): los 12
  cuentos con su formato, palabras del corpus con id, glosa e IPA de cada palabra y dibujos que dan 200; la estantería
  (el primero libre, los demás con candado según el repaso sembrado, la hoja de las palabras que faltan y el saltito al
  abrirse); leer entero deslizando y con botones, con dibujos grandes a 360 y 390 px; la voz elegida de cada idioma y la
  palabra que se ilumina (por tiempo y con onboundary); tocar una palabra (mp3 o voz despacio, globo con la IPA); la
  elección cambia el final; award una vez por cuento, 3 al día y la medalla; sin conexión con el servidor parado; la
  tarjeta de Juegos y el atajo de Hoy; la partida exportada como la base salvo `cuentos`; capturas `capturas/F6/F6i-*`.
- `test_ipa.py` (la IPA a la vista, «recuerda no quitar la IPA»): sale de serie en inglés, francés y danés en la palabra
  nueva, «Cómo suena», la respuesta de «¿Cuál es…?», el reverso del repaso (en la pregunta no), Palabras (detalle,
  Tarjetas, Preguntas y Escribir), la ficha del álbum, Oído de lince al contestar y la Palabra del día girada; con
  `vocab:ui.ipa = false` en ninguno y con un `ipa: true` de antes en todos; el interruptor de Para mayores (encendido de
  serie, apagado = `ipa: false`, encendido quita la clave) y que al cerrar Ajustes se repinta lo de debajo sin empezar
  de nuevo lo que había a medias (la ronda de Preguntas, el orden de «Barajar» de Tarjetas, el final de un juego); gris
  secundario, una sola letra con todos los símbolos (CDP, nunca Nunito), justo debajo de la palabra en la lección y el
  repaso; solo se parte por los espacios y en Tarjetas y Escribir va en su línea bajo «Se dice» (plural nombrado); Hoy,
  la lección (también palabras largas: A1-022, B1-024) y el repaso sin scroll en 390×844 y 360×740 (también con «Texto
  más grande»), la Palabra del día con la IPA en una línea, la tarjeta de Escribir dentro de su hueco, Oído de lince en
  320×568 y, ahí, la lección y la ficha del álbum que no bajan más que sin la IPA; la exportación igual a la base;
  capturas en `capturas/ipa`.
- `test_f5_int.py` (F5 entero): orden de carga de `js/keys.js` (justo detrás de `gestures.js`), `js/shortcuts.js`,
  `js/mailbox.js` y `js/phrases.js` y lo que registran antes del primer `route()`; `sw.js` en la versión 21 o más con
  `OFF_SHELL` igual, cada `<script>` con `?v=<VERSION>` y `SHELL` = `OFF_APP` con los ficheros nuevos (módulos,
  `data/phrases.json`, iconos de los atajos y dibujos de Juegos); las claves nuevas en `js/save.js`; el manifest; cada
  ruta de F5 (y las URL de los atajos del manifest) por enlace directo, al recargar, el primer día y navegando; una
  vuelta sin hacer nada que deja la partida como la base; Hoy con todo a la vez (atajos, carta, refugio, temporada y
  frase de la cena; Google no tiene fila) en el orden de prioridad de `HOME_SLOTS` y sin scroll (móvil claro y oscuro, móvil bajo,
  tableta, escritorio); Hoy con el accesorio «Seguir» (lección a medias) llegando desde Juegos o desde la lección, con y
  sin atajos y con y sin «Reducir movimiento» (la carta sigue, sin scroll, y la fila vuelve cuando el accesorio se va);
  Hoy en un móvil bajo (360×740 claro, oscuro y en Halloween; 375×667) con atajos y una carta sin abrir (la carta se
  queda, la fila se compacta o, si no cabe, se va; «Palabra del día» en una línea y a la izquierda);
  el teclado en el Buzón, Frases, la carta y las teclas 1-4 de los atajos sin nada repetido; un
  recorrido en inglés, francés y danés (lección con teclado, 3 partidas que hacen un atajo, Frases con sello, grabar y
  mandar, contestar como mayor y abrir la carta en otra pestaña); la actualización desde main 2e7dc3f (sw
  `vocab-shell-v19`, con `VOCAB_BASE19=<copia de ese commit>` o sacada con `git archive`), también con la caché HTTP de
  GitHub Pages y sin conexión, en la que la voz de inglés elegida en v19 (`voice:english`) se sigue usando, una elegida
  después en este aparato va en `vocab:voice` (no en la exportación) y `sc:prefs`, `mail:box` y `phrase:stamps` se crean
  al usarse y van en la exportación; con las voces de Edge simuladas (unión con fix-voces), Frases, la frase de la cena,
  el Buzón, las cartas (en inglés, francés y español) y el toque que desbloquea la voz usan `useVoice` (la voz de su
  idioma) y una voz de internet que falla se repite con una del aparato (`retryLocal`; en una carta que falla tarde, la
  del aparato la lee entera y el regalo sale al acabar); y las capturas
  `capturas/F5/F5-*.png` con su auditoría. Para cualquier versión publicada sirven `_published_dir(commit, version,
  env)` (la copia de esa variable de entorno o una sacada con `git archive` a una carpeta temporal) y
  `_switching_server(carpeta, gh_cache)` (el servidor cuya carpeta cambia de la versión publicada a `C.ROOT` al
  «publicar», sin cabeceras condicionales y, con `gh_cache`, con `Cache-Control: max-age=600` de GitHub Pages).
- `test_update_v21.py` (la actualización desde lo publicado ahora, main 1f0b356 con sw `vocab-shell-v21`, a esta versión
  en el mismo origen; `VOCAB_BASE21=<copia de ese commit>` o sacada con `git archive`): sin caché HTTP y con la de GitHub
  Pages. Dos niños con la partida sembrada usan la v21: Lucía, con Google conectado (GIS y Drive de mentira; Drive
  cambiando `fetch`, porque el enrutado de Playwright apaga la caché HTTP), el permiso caducado y cambios sin subir (en
  la v21 se ve la pastilla «Guardar»), hace Hoy, un repaso de 3 tarjetas y la granja y nunca toca el interruptor de la
  IPA; Leo, sin Google y con 5 días de uso («Guarda tu partida» en su Hoy de la v21), tiene la IPA encendida por un
  mayor en la v21 (`vocab:ui {ipa: true}`). Tras publicar: la primera carga ya es la app nueva entera (cada módulo de
  `js/` que se ejecuta tiene el texto de esta versión, leído con CDP `Debugger.getScriptSource`; cada `<script>` con
  `?v=<VERSION>`; `ipaOn()`, `vocabSync.tapDue` y nada de `[data-sync-slot]`, pastilla ni «Guarda tu partida»), el sw
  nuevo se instala y controla (`vocab-shell-v22` con todo `SHELL`, sin `vocab-shell-v21`, `vocab-media` sin perder
  nada), cada clave de `localStorage` y la exportación quedan como en la v21 (sin claves nuevas), la IPA se ve en «Cómo
  suena» y en el reverso del repaso para los dos y el interruptor sale encendido, Para mayores dice «Hay cambios sin
  subir a Google», nada pide el permiso fuera de un toque y el siguiente toque seguro (la pestaña Hoy) lo pide dentro del
  toque y sube a Drive la partida de la v21 tal cual (Para mayores pasa a «Copia al día»); sin conexión, la app nueva
  (con sus módulos) y el repaso con la IPA. Sin errores. Capturas en `capturas/v22`.
- `test_f6_int.py` (F6 entero; voz de los cuentos, micrófono del loro y cámara de lienzo del cazador simulados a la vez):
  `sw.js` VERSION 23 = `OFF_SHELL` = el `?v=` de cada `<script>` de `index.html` y `privacy.html`; cada `js/*.js`, cada
  guion de llamada y cada cuento en `SHELL` y en `OFF_APP`; el orden de carga (`window.vocabMedia` de `js/mailbox.js`
  antes que el loro y el cazador, `js/navmotion.js` el último, `js/hunter.js` solo al entrar y con `?v=23`); los dibujos
  de llamadas, cuentos y cazador en «Descargar todo»; `cuentos` y `calls` en la partida y `parrot:st` y `hunt:st` solo
  del aparato. `#/loro`, `#/loro/capsula`, `#/cuentos`, `#/cuento/<id>`, `#/cazador` y `#/album/casa` por enlace directo
  y al recargar en los tres idiomas. Hoy con todo a la vez en marzo con `?season=halloween` (llamada perdida, carta,
  hambre y refugio, frase de la cena y atajos) en 390×844 claro y oscuro y en tableta, en el orden de `HOME_SLOTS` y sin
  scroll al irse uno tras otro. La llamada no suena encima de la Puerta, de Ajustes ni de un menú de mantener pulsado (y
  suena al cerrarlos). Ningún toque a mitad de un cuento, una llamada, el loro grabando o el cazador con cámara pide el
  permiso de Google (y luego una pestaña sí). Un recorrido en inglés, francés y danés (Hoy, una transición dentro de la
  pestaña, el título que se pliega, el menú de una palabra con su IPA, el loro, un cuento entero, una llamada contestada
  y otra perdida, el cazador con la cámara de mentira) con la IPA a la vista y la partida exportada como la base más lo
  nuevo; y las capturas `capturas/F6/F6-*.png` (móvil 390×844).
- `test_update_v22.py` (la actualización desde lo publicado ahora, main 9bf09a9 con sw `vocab-shell-v22`, a esta versión
  en el mismo origen; `VOCAB_BASE22=<copia de ese commit>` o sacada con `git archive`): sin caché HTTP y con la de GitHub
  Pages. Lucía (Google conectado, permiso caducado, cambios sin subir, un mensaje del Buzón grabado en IndexedDB) usa la
  v22 por enlaces; Leo (sin Google) tiene la IPA apagada por un mayor. Tras publicar: la primera carga ya es la app nueva
  entera (cada módulo, también los de F6, con el texto de esta versión y `?v=23`), el sw nuevo se instala y controla
  (`vocab-shell-v23` con todo `SHELL`, sin `vocab-shell-v22`, `vocab-media` entera), cada clave de `localStorage` y la
  exportación como en la v22, la granja con los mismos animales y el mismo hambre, el mensaje grabado sigue en IndexedDB
  con la misma versión de la base, la IPA de serie para Lucía y apagada para Leo hasta que se enciende, los cuentos, el
  loro y el cazador abren, y el siguiente toque en una pestaña pide el permiso dentro del toque y sube la partida de la
  v22 tal cual; sin conexión, la app nueva. Capturas en `capturas/v23`.
- `test_tech_int.py` (Tech Prep S1 entero, la sección de mayores; `js/tech-boot.js` siempre y, solo al entrar,
  `js/tech.js`, `js/tech-lesson.js` y `js/tech-pages.js` con `?v=<VERSION>`): apagado o encendido sin entrar solo se pide
  `js/tech-boot.js` (nada de `data/tech`); cada ruta de S1-SPEC §3 por enlace directo y al recargar (pestaña, cápsula de
  volver, modo foco, título, `lang=en-GB`); las dos barras de pestañas de ida y vuelta con su memoria y la Puerta al
  entrar (y en una sesión nueva); los botones de las páginas abren sus sesiones (Start/Continue, «Next lesson», la
  práctica de un caso con sus preguntas, «Write yours» crea la historia). Y el recorrido de un mayor en 390×844 claro y
  oscuro y en escritorio, en dos días (interruptor en Para mayores, menú y Puerta, Today, lecciones técnica y de
  liderazgo, repaso, entrevista corta, Path, unidad, chuleta, glosario, Pairs, Beat the clock, casos propio y modelo con
  práctica, una historia, ajustes con fecha, «Download for offline» y uso sin red, borrar el progreso, volver a los
  idiomas y apagar), sin español en Tech Prep, sin scroll lateral, contraste y paleta, y la partida del niño intacta;
  capturas `S1-*.png` en `/mnt/project-files/tech-prep/capturas/S1` (`VOCAB_TECH_CAPTURAS` cambia la carpeta). Con
  `VOCAB_TECH=1`, `routes.py` añade las rutas de Tech Prep (con `"tech": True`) a las pruebas que recorren todas las rutas
  y a `shots.py`.
- `test_tech_lesson.py::test_why_items_right_and_wrong` (bloque «Live coding», u34-u38, 2026-10-28): el ítem «Why?»
  (el código tal cual con su lenguaje, «What happened», 4 causas; el why, el arreglo y «Source»; entra en el repaso),
  bien y mal con el dedo a 390 en claro y con el teclado a 360 en oscuro, sin scroll lateral, con contraste y paleta.
- `test_update_v23_tech.py` (la actualización desde main 4185280 con sw `vocab-shell-v23` a esta versión en el mismo origen, mirando Tech Prep;
  como `test_update_v22.py`; `VOCAB_BASE23=<copia de ese commit>` o sacada con `git archive`): lo de siempre (primera
  carga ya nueva, sw nuevo con todo `SHELL`, partida y granja iguales, mensaje del Buzón en IndexedDB, IPA, el toque que
  sube a Google) y además Tech Prep sale apagado (sin entrada en el menú, `#/tech…` a `#/`, solo `js/tech-boot.js`); un
  mayor lo enciende en el aparato de Leo, lo usa, pide «Download for offline» y, con el servidor parado, Today, una unidad,
  el glosario, una lección y un caso siguen; luego lo apaga. Capturas en `capturas/v24`.
- `test_update_v23.py` (la actualización desde main 4185280 con sw `vocab-shell-v23` a esta, la v24; `VOCAB_BASE23=<copia
  de ese commit>` o `git archive`): lo mismo que `test_update_v22.py` un paso después (`?v=24`, `vocab-shell-v24`, sin
  claves nuevas) y, además, el botón de Google de la barra de arriba sale para Leo (sin Google) y no para Lucía.
  Capturas en `capturas/arreglos-v24/actualizar`.
- `test_arreglos_v24.py` (lo que vio el dueño en los aparatos de su sobrino): la voz del navegador en Android con un
  `speechSynthesis` de mentira que imita sus fallos (lang «en_GB», el speak justo tras cancel() que se pierde, en pausa,
  una voz que no acepta, un motor que nunca suena): se oye lo que se toca mientras otra cosa suena, sin cancel() de más,
  el « » de desbloquear no llega al motor de Android, resume() en pausa, el reintento sin voz a los ~2 s, `vocab:tts` (solo del aparato) con un aviso una vez, «¿No se oye la
  voz?» en Voz y velocidad con los pasos de Android y el enlace a «Servicios de voz de Google» por la Puerta, y «Probar
  voz» con lo que ve el aparato; la nube del hambre de la granja (grande y pequeña) y el animal abren «¿Qué le das…?»,
  también con una pista de gestos encima de la nube;
  la barra de arriba sin la «G» de Google (ya no sale nunca; cabe a 360 px con texto grande y 12345 monedas); y el cazador: tres rondas seguidas con la cámara falsa de Chromium (un `.y4m` con los 4
  colores) y dos con un vídeo «de iPhone» (al sonar algo se para y `play()` no contesta tras `pause()`). Capturas en
  `capturas/arreglos-v24`.
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
  Desde la unión con F5, también las pantallas nuevas con dibujos (`MIN_F5`): la bandeja de Frases mágicas (72 px en
  390×844, con los árboles recortados de `img/fam2/`, sin un rectángulo blanco sobre la placa en oscuro), las plantillas
  del Buzón (60), las tarjetas de Juegos del Buzón y
  de Frases (como las demás) y «Tus atajos» de Hoy (24; 32 en un móvil de 900 px de alto) en 360×740, 390×844 (también
  oscuro) y 430×932, sin scroll donde no lo había y sin perder la frase de la cena; en el iPad y el ordenador, no más
  pequeños; e `img/fam2/` fuera de `SHELL`, guardado por «Descargar todo» y servido sin conexión una vez visto.
- `test_voces.py` (voz de cada idioma): `speechSynthesis` simulado con listas de voces de aparatos reales (iPhone con
  Safari, Windows con Edge y con Chrome, Android con Chrome, Firefox de Android con el motor de Samsung, Chromebook) y
  lista vacía que llega tarde. Ajustes › Voz y velocidad con el grupo «Voces» de una fila por idioma (el que aprende
  primero, con en, fr y da; a la derecha y en una línea «Automática · Sonia», o solo «Automática» si no cabe, o la
  elegida), la «Automática» de cada aparato (británica para inglés, nunca de broma ni muy robótica), cada idioma con solo
  sus voces y sin repetir, la página del idioma por países (nombre solo, nube en las de internet, «Más voces»
  desplegable), elegir (✓, suena con esa voz y su `lang`, `"vocab:voice"` por idioma y solo de este aparato, sigue tras
  recargar, «Automática» guarda `""`; dos voces con el mismo nombre se guardan como `"nombre|en-US"`), fuera de la
  partida (exportación igual a la base), `voice:<idioma>` de respaldo, sin voz danesa (y Para mayores con la ayuda solo de
  lo que falta), repintar al llegar las voces (y al volver a la app) sin perder la página ni el foco, la barra con el
  título en el centro (a 320 px, con letra grande y en escritorio), la altura de la hoja al entrar y volver, la hoja
  propia `dialog#cfg`, sin internet las del aparato y el reintento (también del ▶), códigos de otros idiomas (`es-ES`),
  Chrome en Android (`u.lang`, un acento por fila) y el teclado. Con `VOCES_SHOTS=1` guarda capturas en
  `/mnt/project-files/rediseno/capturas/voces/`.
- `test_juegos_grupo.py` (`js/party.js` y `data/party.json`; `say`/`sayP` espiados): los datos sacados del vocabulario
  (misma palabra e IPA que en `data/<d>.json`, dibujos, temas de Juegos), las dos tarjetas tras «Oído de lince»; El
  impostor en grupo (nombres que se guardan solos en `"party:st"`, fuera de la exportación; un impostor; el papel no suena
  solo; «Tapar y pasar»; 3 rondas sin que empiece el impostor; votar; última oportunidad entre 4 dibujos; ★★★ o ★★ y
  monedas), solo (el zorro y sus amigos con palabras e IPA, una opción buena de 3, el impostor de la app con palabras
  de otra cosa de su familia; con `Math.random` fijo, también el niño de impostor que adivina la palabra) y Ordenar
  (cestas con nombre, IPA, dibujo y altavoz; tocar y arrastrar; gris con ✗ y la buena iluminada al segundo fallo;
  estrellas, récord «N a la primera» y monedas), en francés y danés, y capturas en `capturas/juegos-grupo`.
- `test_juegos_hub.py` (`js/games.js`, el centro de juegos): el menú (reto, «Seguir jugando» por `at`, una fila por
  sección que se desliza con scroll-snap y la de enlaces al final; ≤ 2 pantallas a 390×844, nada de lado a 360/390,
  rejilla con ratón, «Soldados» primero con su tema y en oscuro con candado sin él, «Nuevo» con fecha); el «Reto de
  hoy» (sin monedas anunciadas, solo desde su tarjeta, sorpresa de 10-20 una vez, ✓ y el punto de la semana en
  `"games:reto"`); el resultado de Globos a 360 px (falladas primero con ✗, IPA, una columna, nada partido; al repaso
  las que ya estaban para hoy y 3 nuevas como mucho; «Jugar con estas»); «¡Vamos otra vez!» sin aciertos (con juegos
  de prueba registrados y `played`); los niveles 1-3 (Memoria 16 cartas, Globos 6 sin ojo, largos de Letras,
  `api.level`); la IPA en los 4 clásicos; las teclas solo con teclado y las explicaciones ≤ 15 palabras. Capturas en
  `capturas/juegos`.
- `test_pajarito.py` (`js/flyer.js`, «Pajarito volador»): la tarjeta en Juegos, la ciudad de cada idioma (Londres,
  París, Copenhague), 3 puertas con palabras, el pajarito ≥ 96 px y la calle hasta abajo en 360 y 390 px, mover con
  toque, flechas y teclas, acertar (+1) y fallar (−1 corazón) hasta el resultado con récord, la pausa que para las
  puertas, el avión de combate con el tema «Soldados» (disparar, ayuda, bomba, radio), y fuera de ese tema el avión y
  «Misión por radio» en oscuro con candado y su aviso (tocarlos solo avisa), y la sección «Jergas de oficios» de la hoja
  de temas (Soldados y Programadores, `data/programadores.json`) y la de «Deportes de combate» (gimnasio, muay thai,
  kickboxing, lucha y jiu-jitsu, `data/<id>.json`: datos completos, sin repetidos, y el pajarito con Muay Thai);
  capturas en `capturas/pajarito`.
- `test_topos.py` (`js/topos.js`, «Topos»): la tarjeta en Juegos, el prado de 2 × 3 en el celular (360 y 390 px,
  topo ≥ 96 px, hasta abajo, el bocadillo nunca más ancho que su agujero) y de 3 × 3 en el ordenador; golpear un topo
  bueno (+1, ✓, suena) y uno malo (✗ y su español); el letrero «bien escritos» con faltas que nunca son palabras del
  tema; la pausa que para el reloj; el final con récord; francés y danés con otro tema. Capturas en `capturas/topos`.
- `test_wordplay.py` (`js/wordplay.js`): «Adivina la palabra» (la cesta con 6 globos; cada letra que falta revienta
  uno), «Sopa de letras» (arrastrar, tocar la primera y la última o flechas; la pista que parpadea) y «Crucigrama»
  (palabras que se cruzan, «Pista», casillas ≥ 30 px en 360 px); finales con récord, francés y danés. Capturas en
  `capturas/wordplay`.
- `test_quiz.py` (`js/quiz.js`): «Concurso», «Verdadero o falso», «Abre la caja» y «Une con flechas»; aciertos,
  fallos en gris con ✗, finales con récord, celular y ordenador, otros idiomas. Capturas en `capturas/quiz`.
- `test_grammargames.py` (`js/grammargames.js`): «Ordena la frase», «Completa la frase» (el tren) y «Detective de
  errores»; el nivel A1-C2 por idioma ("gram:lv"), aciertos y fallos con el porqué, la pausa, francés y danés, y la fila
  «Juega con la gramática» de la página Gramática que abre el juego en ese nivel. Capturas en `capturas/gramatica`.
- `test_cuartel.py` (`js/cuartel.js`, «Defensa del cuartel»): solo con el tema «Soldados»; robots, drones y tanques por
  3 carriles, el cargador de 6 balas, recargar respondiendo (bien: lleno; mal: 2 balas), los corazones, las oleadas y
  el final con récord. Capturas en `capturas/cuartel`.
- `test_lecciones.py` (`js/lesson.js` y el «¿Ya lo sabes?» de `js/learn.js`): cada palabra por su sitio (tema:fila) y
  nunca dos respuestas buenas (Primo/Prima, phone/telephone; «la maison» se enseña una vez); el plan aprende 3 →
  pregunta esas 3 → … (trozos de 3 como mucho, cada palabra 2 veces con 3 pasos o más entre medias y la segunda
  recordando) con 2-3 palabras del repaso calificadas con `srsGrade`; la fallada vuelve 3-5 pasos después y va a la
  caja 0; «Repasa tus fallos»; recargar sigue el mismo plan; «Ordena las letras» (artículo puesto, æøå, teclado),
  «Completa la frase», «Empareja»; los números enteros sin dibujo; «¿Ya lo sabes?» (10 de 12: 1 estrella y caja 2;
  menos: nada cambia); todo cabe a 360×740 y 390×844, claro y oscuro. Capturas en `capturas/lecciones`.
- `test_hablar.py` (hablar, escuchar y leer: `say`/`sayP` de `index.html`, `js/calls.js`, `js/stories.js`,
  `js/parrot.js`, `js/hunter.js`, `js/chant.js` y `js/simon.js`): las respuestas de las llamadas barajadas cada vez
  (`vocabCalls.mix`: las mismas respuestas con su «re», el mismo yes/no, la buena contada otra vez; `get()` no cambia) y
  la buena en pantalla; «Dilo conmigo» tras cada respuesta («Say it with me:» con la voz, la palabra con su mp3, la boca
  y «¡Dilo tú!»; sin micrófono no escucha; con «Dilo» ya usado, «¡Te he oído!»; en francés y danés su frase);
  «Llamar al zorro» (tarjeta de Juegos › Más, `#/llamadas` de la pestaña Jugar con ‹ Juegos, nuevas arriba y oídas abajo
  con ✓, llamar y colgar la marca); una palabra sin audio y sin voz de su idioma no se dice (danés en Chrome de Windows:
  `data-novoice` gris y un aviso por sesión; con mp3 sí suena; la IPA sigue); el mapa `audio/en.json` que no llega se
  vuelve a pedir con `online` o pasados 30 s (bloqueado una vez con `page.route`, luego suena el mp3); «¿Te acuerdas?»
  de los 12 cuentos (datos, `vocabStories.picWord` con IPA) y en «The Fox Wants to Play» (3 preguntas que dice la voz sin
  texto, gris con ✗ y el bueno con ✓ que suena, teclas 1-3, monedas solo al acabar) y «Leer solo» (pasa sola, se para en
  la de elegir y en una pregunta sin contestar); el Loro eco desde Juegos con el tema (`#/loro?t=w03`); el cazador
  tocando que primero se escucha; «El zorro dice» (9 rondas en tres idiomas: la orden con la voz y el mp3, nada escrito
  hasta contestar, dos en orden, color + dibujo según el idioma, 360×740 y 390×844 sin scroll) y «Rap del zorro» (8
  palabras con mp3, el AudioContext dentro del toque, cada palabra en un pulso del reloj de audio a 84/90/96, color +
  palabra en inglés y francés y otra vez dos palabras en danés, unirse tocando a tiempo y con un micrófono de mentira,
  `window.__rapRounds`); capturas en `capturas/hablar` (360 claro, 390 oscuro con «Reducir movimiento» y 1280) con
  contraste, paleta y `a11y.js`.
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
ejemplo, para servir `sw.js` con otra `VERSION`). Para una actualización desde una versión publicada,
`test_f5_int._switching_server()` ya trae ese servidor (y su variante con la caché HTTP de GitHub Pages); mira la
carpeta en cada petición y no al abrir la conexión, porque Chromium abre conexiones de antemano. Antes de «publicar»,
deja pasar unos segundos desde la última carga de cada página (`test_update_v21._quiet()`): Chromium mira si hay un sw
nuevo un segundo o dos después de cada carga y, si eso cae ya publicado y a la vez que la carga siguiente, el sw nuevo
se queda esperando («installed») y la recarga siguiente no acaba.

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

<!-- package: study (IELTS Prep, js/ielts-study.js) -->
## IELTS Prep: el motor de estudio (`test_ielts_study.py`)

- `test_ielts_study.py` (`js/ielts-study.js` y su sección `package: study` de `ielts.css`; corre con `--only test_ielts`):
  el mazo de repaso en `ielts:study` (una lección *learn* terminada da una tarjeta por pregunta suelta: fallada a la
  caja 0 para mañana, acertada a la 1 para dentro de 3 días; una pregunta fallada de un test de Reading o Listening da
  una tarjeta «envuelta» con su texto o su transcripción `**Nombre:** línea`); `#/lesson/review` en el reproductor de
  verdad, la nota que sube una caja al acertar y baja dos al fallar (nunca por debajo de 0), el tope por fecha de examen
  (ningún intervalo mayor que el 20 % de los días que faltan, mínimo 1), la tarjeta segura que se retira (acierto en la
  caja 4 o más con 3 aciertos) y vuelve si se falla en una lección; como mucho 20 tarjetas por sesión y 5 envueltas,
  las más antiguas primero; las opciones se barajan solo si ni la pregunta ni la explicación las nombran por su letra
  («(B)», «B is», «option C»; las letras de párrafo no cuentan) y la respuesta sigue a su opción; recargar devuelve la
  misma sesión (y la respuesta guardada); una sesión nueva borra `ielts:run:review`; la primera carga crea el mazo con
  las lecciones terminadas de antes, una sola vez; el cuaderno de errores (etiquetas *spelling*, *word limit*,
  *number format*, *singular/plural*, *T↔NG*… con un registro sembrado, «Where my marks go» de 30 días, la tabla de
  confusión TRUE/FALSE/NOT GIVEN y el acierto por tipo con los tres más flojos enlazados a su unidad); `IE.assess`
  montado en un `div` (bandas 6-9 por criterio con la lista de descriptores, la estimación con las listas completas, el
  aviso con una diferencia de 1 o más, cada toque guardado, los objetos viejos `{0..3}` igual que antes, la calibración
  con ejemplos y su error medio, grupos de radio con nombre, flechas del teclado y botones de 44 px); la tarjeta
  «Review · N due» antes de `.ie-scores`, el plan de examen (semanas, consejos, la línea de Elder & O'Loughlin) y
  «Rewrite from memory»; `#/unit/review`; los iconos copiados tal cual de `index.html`; solo se escribe `ielts:study`
  dentro de `ielts:*` y «Erase» la borra; los envoltorios se instalan una vez. Capturas en `capturas/ielts-study`
  (`#/review`, el inicio y la autoevaluación a 360 y 1280 px, claro y oscuro, sin scroll lateral ni morado o rosa).
