/* Módulo lesson: la lección del camino (#/leccion/<id>), de vocabulario o de gramática (G-<nivel>-<nn>), y su final.
   Va en modo foco (html[data-focus=leccion]: la ✕, el contador de monedas y la barra de progreso arriba) con el botón
   principal de vidrio fijo abajo, que cambia según el paso: «Continuar» (palabra nueva), «Practicar» (la regla de
   gramática) o «Seguir» (después de contestar). Antes de contestar no hay botón: se toca una respuesta.
   - Palabra nueva: dibujo, la palabra (44 px; si no cabe entera, más pequeña, nunca partida: fitWord), la traducción en gris, el altavoz grande y la tortuga (despacio), «Cómo
     suena» (hoja con las sílabas, «Se dice «…»», la IPA y el audio lento; también manteniendo la palabra) y «Ejemplo» (se
     abre al tocarlo). La IPA, justo debajo de la palabra y antes de la traducción, como en un diccionario (ipaHtml() de
     index.html: se ve salvo que un mayor la apague en Ajustes › Para mayores; si con ella la página bajaría, el dibujo
     cede lo que ocupa: fitIpa). Deslizar a la izquierda = Continuar; a la derecha = la anterior
     (también con ← →, y con el botón ‹ de abajo). La pista «Desliza para seguir» nunca sale en la primera tarjeta.
   - El orden (plan()): se aprende y se pregunta a trozos de 3 como mucho (un trozo de 1 no: 3+1 → 2+2). Aprende 3 →
     pregunta esas 3 (reconocer: «¿Cuál es…?» o «Escucha y elige») → aprende 3 → 6 preguntas mezcladas (las 3 nuevas y
     las 3 de antes otra vez, ahora recordando: «Ordena las letras» o «Completa la frase», el que toque para mezclar; si
     ninguno se puede, la otra de reconocer) … y al final lo de recordar de las últimas y «Empareja» (4 dibujos con su
     palabra, de las de antes). Así cada palabra se contesta 2 veces, con 3 pasos o más entre una y otra (se ordena cada
     tanda para que sea así, primero las que vuelven en la tanda siguiente). Entre medias, 2 o 3 palabras viejas del
     repaso (srsAll() del idioma, caja ≤ 2, las que tocan antes, con dibujo si puede ser; chip «Repaso»), que se puntúan
     con srsGrade (2 o 0) como en el repaso y no se repiten en la lección (fallada: caja 0, vuelve hoy en el repaso).
     Una fallada de la lección enseña la respuesta enseguida y vuelve 3 a 5 pasos después (nunca entre las palabras
     nuevas de un trozo); si se vuelve a fallar, vuelve otra vez, y basta con acertarla una vez.
     Cada palabra se cuenta por su sitio (tema:fila, w.k), no por su español: «teléfono» (phone y telephone) son dos.
     Una palabra cuya palabra del idioma ya salió antes en la lección no se enseña dos veces («la maison»).
   - «Ordena las letras»: el dibujo, el español y fichas grandes con las letras (acentos y æøå incluidos, mezcladas, más
     1 o 2 de sobra); el artículo viene puesto y solo se ordena la palabra. Se toca la letra que sigue: la buena va a su
     hueco; otra se pone gris con ✗ un momento (sin temblor) y a los 2 fallos se marca la que sigue. Con 2 o más fallos
     cuenta como fallada. Con teclado físico, la tecla de la letra.
   - «Completa la frase»: la frase de ejemplo con un hueco donde va la palabra (solo si sale de verdad en ella: la palabra,
     sin artículo o una de sus formas) y 3 opciones; al contestar se lee la frase entera y sale en español.
   - «Empareja»: 4 dibujos y 4 palabras (solo palabras con dibujos distintos); se toca uno y luego su pareja. La pareja
     buena, en verde con ✓, suena y enseña la IPA; la mala, gris un momento. Termina al casar las 4.
   - Preguntas: 2×2 opciones sólidas de 64 px (dibujo o texto; con 3, en fila), sin gestos. En francés y danés las otras
     opciones llevan, si puede ser, el mismo artículo (no se adivina por «la» o «et»). Nunca hay dos buenas: fuera las
     que dicen lo mismo en el idioma («Primo» y «Prima»: cousin) o en español. El altavoz de la pregunta sale al
     contestar (el dibujo se encoge lo mismo, así las opciones no se mueven). Acertar: rebote, verde con ✓, suena la
     palabra, vibración suave y pasa sola al acabar el audio (nunca antes de 0,9 s; con tope por si no acaba). Fallar: la
     elegida en gris con ✗, la correcta en verde con ✓ y suena; el botón pasa a «Seguir». Sin temblor, sin vibración, sin
     sonido triste. En «¿Cuál es…?» (se contesta con la palabra) la respuesta lleva la IPA de la palabra al lado si cabe,
     si no debajo (y entonces, si la página bajaría, el dibujo cede esa línea). Racha: a los 3, 5 y 8 aciertos seguidos salta un chip con la llama y el número.
   - La ✕ y Esc abren «¿Paramos aquí?» (Seguir destacado · Salir, que vuelve a donde estaba el niño, como la ✕). En la
     primera tarjeta, sin nada hecho, no preguntan: salen.
   - Fin: el zorro con su traje, las estrellas de una en una con notas que suben (por las palabras nuevas sin ningún
     fallo), «+N» con las monedas volando al contador (award con from), «Mañana repasas estas N palabras» (las de esta
     lección que vuelven mañana), confeti (sfx.js, con "lesson-done"), «Siguiente lección» y «Repetir». Al repaso: las
     acertadas a la caja 1 (mañana) y las falladas a la caja 0 (hoy). Con fallos, «Repasa tus fallos»: solo esas
     palabras otra vez, como preguntas (sin estrellas ni monedas; termina en «¡Fallos repasados!»). Los botones de abajo
     no responden los primeros 0,7 s (un doble toque en «Seguir» no se salta el final). La ✕ y Esc vuelven al camino.
   - «¿Ya lo sabes?» (#/leccion/<nivel>-U<nn>, el enlace sale en el camino al empezar una unidad: js/learn.js): 12
     preguntas «dibujo → palabra» con 4 opciones de las palabras de la unidad. Con 10 o más, las lecciones de vocabulario
     de la unidad pasan a tener 1 estrella (no 3; si ya tenían más, se quedan) y sus palabras van al repaso en la caja 2;
     con menos, no cambia nada. No bloquea nada ni se guarda a medias.
   Números: una tarjeta sin dibujo enseña la primera letra del español; si es un número o tiene 3 letras o menos, entero.
   Guardado mientras se hace: sessionStorage "vocab:ls" = {v: 2, id, i, first, miss, n, lang, left, ws, plan, rv,
     rvMiss} (i: pasos hechos; first: las que lleva sin fallar; miss: las falladas; n: pasos en total; left: las
     repeticiones de falladas que aún faltan; ws: las palabras de la lección (w.k), plan: los pasos ("pick:3", "match:0,1,
     2,4", "listen:r1!" = de repaso y repetida), rv: las palabras de repaso [tema, español], rvMiss: las de repaso
     falladas). Lo de antes (sin v) empieza de cero. Se escribe en cada paso desde el primero hecho y se borra al
     terminar. Una copia va a localStorage
     "vocab:lsdraft" = {t, v} (solo de este aparato: DEVICE_ONLY en save.js; vale 72 horas) por si el iPhone cierra la app
     o se cierra la pestaña. «Salir» lo deja: el niño sigue donde estaba con la cápsula «Seguir · Lección N» o con
     «Seguir» en Hoy (plan-doc §Lección). leccion(id) lo recupera si es la misma lección y el mismo idioma (con valores
     raros o fuera de rango empieza de cero). Avisa al accesorio (window.vocabAccessory.refresh()). No es de la partida.
   Guarda de salida: route() (index.html) llama antes de nada a vocabLesson.blocks(hashPath()). Con una lección empezada,
     salir de su ruta sin la ✕ (Atrás del navegador, el gesto de Safari, un enlace) vuelve a la lección con
     history.pushState y pregunta «¿Paramos aquí?»: Seguir no pierde nada; Salir deja ir adonde iba (history.back(), que
     es la entrada a la que quería ir), con lo hecho guardado para seguir luego.
   API (global, la usa route()): leccion(id) · lsStep() · lsEnd() · gramLesson(id) · gStep()
     window.vocabLesson = {state (la lección en marcha o null), saved(), blocks(hp), ask(from), syllables(text, lang),
     spellOf(w), fillOf(w), unitTestable(lv, ui)} */
(() => {
"use strict";
const KEY = "vocab:ls", DRAFT = "vocab:lsdraft", DRAFT_MS = 72 * 36e5;
const ROOT = document.documentElement;
const MIN_WAIT = 900, AFTER_AUDIO = 350;   /* acertar: pasa sola 350 ms después del audio, nunca antes de 0,9 s */
let LS = null;          /* la lección en marcha */
let PASS = false;       /* la ✕ de verdad, después de «Salir» */
let offs = [];          /* gestos de la tarjeta que se ve */

const rm = () => !!(window.M && typeof M.rm === "function" && M.rm());
const langCode = () => (LANGS[lang] && LANGS[lang].code) || "en-GB";
const lang2 = () => langCode().slice(0, 2);
const pathOf = s => "leccion/" + s.id;
const alive = s => !!s && LS === s && !s.ended && hashPath() === pathOf(s);
const sheetOpen = () => !!document.querySelector("dialog[open]");
const refreshAcc = () => { try{ if(window.vocabAccessory && typeof vocabAccessory.refresh === "function") vocabAccessory.refresh(); }catch(e){} };
const mix = a => { a = [...a]; for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const bold = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const stage = () => document.querySelector(".ls .ls-stage");
const page = () => document.querySelector(".ls .ls-stage > .ls-page:not(.ls-ghost)");
const kbdMode = () => ROOT.hasAttribute("data-kbd");
const quiet = () => { try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch(e){} };
const say1 = (text, btn, slow) => { try{ say(text, btn, !!slow); }catch(e){ console.error(e); } };
const note = i => { try{ if(typeof sfx !== "undefined" && sfx && typeof sfx.note === "function") sfx.note(i); }catch(e){} };
const PRAISE = ["¡Muy bien!", "¡Genial!", "¡Eso es!", "¡Perfecto!"];
/* ✓ que se dibuja (M.ok la anima con stroke-dashoffset): el check de Phosphor, en trazo */
const CHK = `<svg class="chk" viewBox="0 0 256 256" width="24" height="24" aria-hidden="true" focusable="false"><polyline points="40 144 96 200 224 72" fill="none" stroke="currentColor" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const COIN = `<svg class="ls-coin" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="11" fill="#FFCC00"/><circle cx="12" cy="12" r="10.5" fill="none" stroke="#C7A000" stroke-opacity=".8"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#B39000" stroke-opacity=".55" stroke-width="1.4"/><path d="M12 7.8 13.06 10.54 15.99 10.7 13.71 12.56 14.47 15.4 12 13.8 9.53 15.4 10.29 12.56 8.01 10.7 10.94 10.54Z" fill="#A88700" fill-opacity=".8"/><path d="M6.4 8.2a7 7 0 0 1 4.4-3.4" stroke="#fff" stroke-opacity=".85" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>`;

/* ---------- estilos ---------- */
const CSS = `
.ls{position:relative;width:min(100%,560px);margin:0 auto;padding-bottom:calc(var(--btn-main) + 40px)}
:root[data-focus=leccion] main{overflow-x:hidden;overflow-x:clip}
.ls .ls-top{display:flex;align-items:center;gap:12px;min-height:var(--tap);margin:4px 0 16px}
:root[data-focus] .ls .ls-top{margin-top:calc(-1 * (var(--tap) + 12px));padding:0 92px 0 56px}
.ls-bar{flex:1;height:12px;border-radius:999px;background:var(--fill);overflow:hidden}
.ls-bar>i{display:block;width:0;height:100%;border-radius:inherit;background:var(--teal)}
.ls-stage{position:relative}
.ls-page{display:flex;flex-direction:column;gap:12px}
.ls-page.ls-ghost{position:absolute;left:0;right:0;top:0;pointer-events:none}
.ls .ls-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px 20px 24px;text-align:center;
  background:var(--card);color:var(--label);border-radius:var(--r-card);outline-offset:-3px}
.ls-card:focus:not(:focus-visible){outline:none}
.ls-pic{display:flex;align-items:center;justify-content:center;width:100%;height:clamp(120px,24vh,220px)}
.ls-pic img{display:block;box-sizing:border-box;min-width:0;min-height:0;max-width:min(220px,80%);max-height:100%;object-fit:contain;-webkit-user-drag:none}
:root[data-theme=dark] .ls-pic img{background:#F2F2F7;border-radius:var(--r-md);padding:4px}
.ls-ph{display:grid;place-items:center;height:100%;aspect-ratio:1;max-height:140px;border-radius:28px;background:var(--fill2);
  color:var(--label2);font:800 3rem/1 var(--f-round)}
.ls-ph.is-long{font-size:2.25rem}   /* un número o un español corto, entero («71», «té») */
.ls-learn{touch-action:pan-y;will-change:translate}
.ls-word{max-width:100%;margin:4px 0 0;padding:0 4px;border-radius:12px;cursor:default;-webkit-user-select:none;user-select:none}
.ls-tr{font:400 var(--fs-body)/1.3 var(--f-text);color:var(--label2)}
.ls-ipa{display:block;max-width:100%;margin-top:-4px;font-size:var(--fs-sub);line-height:1.2;overflow-wrap:anywhere}   /* bajo la palabra */
/* con la IPA (una línea más), en un móvil algo bajo (360×740) el dibujo cede lo que ella ocupa: cabe sin bajar también
   con «Texto más grande» */
@media (min-height:701px) and (max-height:760px){.ls-learn.has-ipa .ls-pic{height:clamp(120px,calc(24vh - 1.25rem),220px)}}
.ls-ask{margin:4px 0 0;font:700 var(--fs-t2)/1.2 var(--f-round);color:var(--label);text-wrap:balance}
.ls-ask q{quotes:"«" "»"}
.ls-tag{margin:0;font:600 var(--fs-note)/1.2 var(--f-text);color:var(--label2);display:inline-flex;align-items:center;gap:6px}
.ls-audio{position:relative;display:flex;align-items:center;justify-content:center;gap:16px;margin-top:8px}
.ls-audio.is-later{display:none}
.ls .ls-spk.say{position:relative;width:64px;height:64px;border:0;border-radius:50%;display:grid;place-items:center;font-size:inherit;
  background:var(--brand-soft);color:var(--brand-tint);transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms)}
.ls .ls-spk.say.xl{width:88px;height:88px}
.ls .ls-spk.say.playing{background:var(--brand-fill);color:#fff}
.ls .ls-spk.say.playing::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:3px solid var(--brand-tint);opacity:0;
  animation:ls-wave .9s ease-out 3;pointer-events:none}
@keyframes ls-wave{0%{opacity:.55;scale:.9}100%{opacity:0;scale:1.28}}
.ls .ls-slow.say{width:48px;height:48px;border:0;border-radius:50%;display:grid;place-items:center;font-size:inherit;background:var(--fill2);color:var(--label)}
.ls .ls-slow.say.playing{background:var(--brand-fill);color:#fff}
.ls-audio--c .ls-slow.say{position:absolute;left:calc(50% + 60px)}
.ls-more{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:4px}
.ls-chip{display:inline-flex;align-items:center;gap:6px;min-height:var(--tap);padding:0 16px;border:0;border-radius:999px;
  background:var(--fill2);color:var(--brand-ink);font:600 var(--fs-sub)/1 var(--f-text)}
.ls-chip[aria-expanded=true] .ico{rotate:180deg}
.ls-ex{width:100%;padding:12px 16px;border-radius:var(--r-md);background:var(--fill2);text-align:left}
.ls-ex p{margin:0;font:400 var(--fs-body)/1.35 var(--f-text)}
.ls-ex .ls-ex-tr{margin-top:4px;font-size:var(--fs-note);color:var(--label2)}
.ls .ls-exs.say{width:44px;height:44px;margin:-8px 0 -8px 2px;border:0;background:none;color:var(--brand-tint);vertical-align:middle}
.ls .ls-exs.say.playing{background:var(--brand-fill);color:#fff}
.ls-streak{position:absolute;top:16px;left:16px;z-index:1;display:flex;align-items:center;gap:4px;height:32px;padding:0 12px 0 8px;border-radius:16px;
  background:var(--gold-soft);color:var(--gold-ink);font:800 var(--fs-sub)/1 var(--f-round);font-variant-numeric:tabular-nums}
.ls-opts{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ls-opts.is-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.ls-opts.is-col{grid-template-columns:minmax(0,1fr)}
.ls .ls-opt{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;min-width:0;min-height:64px;padding:8px 12px;
  border:0;border-radius:20px;background:var(--card);color:var(--label);font:700 var(--fs-t2)/1.15 var(--f-round);text-align:center;
  overflow-wrap:anywhere;-webkit-hyphens:auto;hyphens:auto;transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms)}
.ls-opts.is-long .ls-opt{font-size:var(--fs-head)}
/* «Escucha y elige» con dibujos: el dibujo arriba, grande, y la palabra debajo. El dibujo (--lpw) crece con el alto de la
   pantalla, descontado lo que ocupa el resto (la respuesta «¡Casi! Es …» y el botón «Seguir» tras un fallo, también con
   «Texto más grande»: 34,5rem × --k), así que la lección sigue sin bajar */
.ls .ls-opt.has-pic{--lpw:clamp(48px,calc((100vh - 34.5rem * var(--k,1)) / 2),104px);flex-direction:column;justify-content:flex-start;gap:4px;padding:12px 8px;text-align:center;font-size:var(--fs-t3)}
@supports (height:100svh){.ls .ls-opt.has-pic{--lpw:clamp(48px,calc((100svh - 34.5rem * var(--k,1)) / 2),104px)}}
.ls .ls-opts.is-long .ls-opt.has-pic{font-size:var(--fs-head)}
.ls .ls-opts.is-xlong .ls-opt,.ls .ls-opts.is-xlong .ls-opt.has-pic{font-size:var(--fs-sub)}
.ls-ot{display:block;min-width:0;max-width:100%;overflow-wrap:normal;word-break:normal;-webkit-hyphens:manual;hyphens:manual}
.ls-opts.is-break .ls-ot{overflow-wrap:anywhere;-webkit-hyphens:auto;hyphens:auto}   /* sin guion a media palabra hasta que no quede otra */
.ls-opt img{flex:none;box-sizing:border-box;width:var(--lpw,48px);aspect-ratio:1;height:auto;
  padding:3px;border-radius:12px;background:#fff;object-fit:contain;-webkit-user-drag:none}
:root[data-theme=dark] .ls-opt img{background:#F2F2F7}
.ls-opt .ls-k{display:none;position:absolute;left:8px;top:8px}
:root[data-kbd] .ls-opt .ls-k{display:inline-flex}
@media (hover:hover) and (pointer:fine){.ls-opt .ls-k{display:inline-flex}}
.ls-opt:disabled{cursor:default}
.ls .ls-opt.is-dim{color:var(--label2)}
.ls .ls-opt.is-ok{background:var(--ok-fill);color:#fff;box-shadow:0 8px 20px -8px rgba(0,137,50,.7)}
.ls .ls-opt.is-miss{background:var(--miss-fill);color:var(--miss-on)}
.ls-opt.is-ok .ls-k,.ls-opt.is-miss .ls-k,.ls-opt.is-dim .ls-k{visibility:hidden}
.ls-opt .chk{flex:none;width:24px;height:24px}
.ls-opt .xm{flex:none;color:var(--miss)}
.ls .ls-opt.is-stack{flex-direction:column;gap:2px;padding-top:6px;padding-bottom:6px}
.ls-opt.is-stack .chk,.ls-opt.is-stack .xm{width:20px;height:20px}
.ls-opt.has-pic .chk,.ls-opt.has-pic .xm{position:absolute;left:38px;top:calc(50% + 4px);z-index:1;box-sizing:border-box;width:26px;height:26px;padding:5px;
  border-radius:50%;box-shadow:0 0 0 2px #fff}
/* en la columna (dibujo arriba), la ✓ o la ✗ va sobre la esquina de abajo a la izquierda del dibujo */
.ls .ls-opt.has-pic .chk,.ls .ls-opt.has-pic .xm{left:calc(50% - var(--lpw,48px) / 2 - 6px);top:calc(12px + var(--lpw,48px) - 24px)}
/* si el dibujo de arriba saldría tan pequeño como el de la fila (fitOpts: pantalla baja, «Texto más grande»), en fila:
   el dibujo pequeño a la izquierda, que es lo que cabe */
.ls .ls-opts.is-row .ls-opt.has-pic{--lpw:48px;flex-direction:row;justify-content:flex-start;padding:8px 12px 8px 8px;text-align:left}
.ls .ls-opts.is-row .ls-opt.has-pic .chk,.ls .ls-opts.is-row .ls-opt.has-pic .xm{left:38px;top:calc(50% + 4px)}
.ls-opt.has-pic .chk{background:var(--ok-fill);color:#fff}
.ls-opt.has-pic .xm{background:var(--miss-fill)}
.ls-fb{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px 8px;margin:4px 0 0;text-align:center;
  font:700 var(--fs-t3)/1.25 var(--f-round);color:var(--ok-ink)}
.ls-fb:empty{display:none}
.ls-fb.miss{color:var(--label)}
.ls-fb.miss b{font-weight:800;color:var(--ok-ink)}
.ls-fb small{flex-basis:100%;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label2)}
.ls-fb small.ls-fb-ipa{flex-basis:auto;min-width:0}   /* la IPA de la respuesta, al lado de «¡Casi! Es «…»» si cabe */
.ls-fb .ls-fb-w b{color:var(--label);font-weight:700}   /* «Escucha y elige» fallada: la palabra que sonó */
.ls-fb .ls-why{display:flex;gap:8px;align-items:flex-start;margin-top:8px;padding:8px 12px;border-radius:var(--r-md);background:var(--fill2);color:var(--label);text-align:left}
.ls-fb .ls-why .ico{flex:none;margin-top:1px;color:var(--gold-ink)}
.ls-sent{margin:8px 0 0;font:600 var(--fs-t3)/1.5 var(--f-text);color:var(--label)}
.ls-gap{display:inline-block;min-width:72px;padding:0 4px;border-bottom:3px solid var(--sep);color:var(--label2)}
.ls-gap.ok{color:var(--ok-ink);border-color:var(--ok)}
.ls .ls-theory{align-items:stretch;text-align:left}
.ls-theory .ls-tag,.ls-theory .ls-gt,.ls-theory>.ls-tr{align-self:center;text-align:center}
.ls-gt{margin:0;font:700 var(--fs-t2)/1.2 var(--f-round)}
.ls-rule{margin:12px 0 0}
.ls-rule h3,.ls-exs-t{margin:0 0 4px;font:600 var(--fs-head)/1.25 var(--f-text);color:var(--label)}
.ls-rule p{margin:0;font:400 var(--fs-body)/1.4 var(--f-text)}
.ls-tab{border-collapse:collapse;margin:8px 0 0;font-size:var(--fs-sub)}
.ls-tab td{border:1px solid var(--sep);padding:4px 10px}
.ls-tab tr:first-child td{background:var(--fill2)}
.ls-gex{margin:16px 0 0}
.ls-gex p{margin:6px 0 0;font:400 var(--fs-body)/1.35 var(--f-text)}
.ls-gex small{display:block;color:var(--label2);font-size:var(--fs-note)}
.ls-dock{position:fixed;z-index:5;left:max(16px,var(--safe-l),calc(50% - 280px));right:max(16px,var(--safe-r),calc(50% - 280px));
  bottom:calc(var(--safe-b) + 16px);display:flex;gap:12px;pointer-events:none}
.ls-dock>*{pointer-events:auto}
.ls-dock::before{content:"";position:absolute;z-index:-1;left:-16px;right:-16px;top:-20px;bottom:calc(-1 * (var(--safe-b) + 16px));
  background:linear-gradient(to bottom,transparent,var(--bg) 45%);pointer-events:none}
.ls-dock .ls-go{flex:1}
.ls .ls-prev{flex:none;width:var(--btn-main);min-height:var(--btn-main);padding:0;border-radius:50%}
.ls .ls-prev.is-off{visibility:hidden}   /* el hueco se queda: «Continuar» y «Seguir» siempre del mismo ancho y en el mismo sitio */
.ls-end .ls-card{gap:12px;padding:24px 20px}
.ls-fox{height:120px;display:grid;place-items:end center}
.ls-fox .hero{animation:ls-hop .62s cubic-bezier(.3,.7,.4,1) .15s 2 both}
@keyframes ls-hop{0%,100%{translate:0 0;rotate:0deg}40%{translate:0 -18px;rotate:-4deg}70%{translate:0 0;rotate:3deg}}
.ls-end-t{margin:4px 0 0;font:700 var(--fs-t1)/1.2 var(--f-round);text-wrap:balance}
.ls-stars{display:flex;gap:8px;justify-content:center}
.ls-star{display:grid;color:var(--fill);opacity:0;scale:.3}
.ls-star.got{color:var(--gold)}
.ls-star.on{opacity:1;scale:1;transition:opacity .2s ease-out,scale .5s cubic-bezier(.34,1.56,.64,1)}
.ls-star .ico{filter:drop-shadow(0 2px 0 rgba(0,0,0,.08))}
.ls-earn{display:inline-flex;align-items:center;gap:8px;padding:6px 16px 6px 10px;border-radius:999px;background:var(--gold-soft);
  color:var(--gold-ink);font:800 var(--fs-t2)/1 var(--f-round);font-variant-numeric:tabular-nums}
.ls-coin{width:30px;height:30px}
.ls-tmr{margin:0;font:400 var(--fs-body)/1.3 var(--f-text);color:var(--label2)}
.ls-tmr:empty{display:none}
.ls-extra:empty{display:none}
.ls-extra{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.ls-extra .btn.al-ls{display:inline-flex;align-items:center;gap:8px;min-height:var(--tap);margin:0;padding:0 16px;border:0;border-radius:var(--r-pill);
  background:var(--fill2);color:var(--brand-ink);box-shadow:none;font:600 var(--fs-sub)/1.2 var(--f-text);text-decoration:none}
.ls-extra .btn.al-ls .ico{color:var(--gold-deep)}
.ls-end .ls-rep{flex:none;padding:0 20px}
.ls-end .ls-rep:only-child{flex:1}
.ls-pz,.ls-how{display:flex;flex-direction:column;align-items:center;text-align:center;padding:4px 4px 8px}
.ls-pz-ic{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;margin:4px 0 12px;color:var(--brand-tint);background:var(--fill)}
.ls-pz-t,.ls-how-t{margin:0 0 6px;font:700 var(--fs-t2)/1.2 var(--f-round);color:var(--label)}
.ls-pz-s{margin:0 0 20px;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label2)}
.ls-pz-b,.ls-how-b{display:flex;gap:12px;width:100%;max-width:440px}
.ls-pz-b>*,.ls-how-b>*{flex:1}
.ls-how-t{font-size:var(--fs-head);color:var(--label2);margin-top:4px}
.ls-syl{display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:0 .45em;margin:4px 0 8px;font:700 var(--fs-word)/1.2 var(--f-round);font-size:min(var(--fs-word),9vw);color:var(--label)}
.ls-syl .w{display:inline-flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:0 .12em}
.ls-syl .sy{padding:0 .08em;border-radius:12px;transition:background-color .2s,color .2s}
.ls-syl .sy.on{background:var(--brand-soft);color:var(--brand-ink)}
.ls-syl .dot{color:var(--label3)}
.ls-how-p{margin:0 0 6px;font:400 var(--fs-body)/1.35 var(--f-text);color:var(--label2)}
.ls-how-p b{color:var(--label)}
.ls-how-ipa{margin:-2px 0 6px;font-size:var(--fs-sub);line-height:1.3;overflow-wrap:anywhere}
.ls-how-b{margin-top:16px}
/* «Repaso»: la palabra vieja que vuelve (arriba a la derecha, como la racha a la izquierda) */
.ls-rvt{position:absolute;top:14px;right:14px;z-index:1;display:flex;align-items:center;gap:4px;height:28px;padding:0 10px 0 8px;border-radius:14px;
  background:var(--fill2);color:var(--label2);font:600 var(--fs-min)/1 var(--f-text)}
.ls-rvt .ico{color:var(--teal)}
/* «Ordena las letras»: los huecos (con el artículo ya puesto) y las fichas grandes */
.ls-spell .ls-pic,.ls-fill .ls-pic{height:clamp(84px,16vh,150px)}
.ls-sp{display:flex;justify-content:center;align-items:flex-end;gap:6px;width:100%;margin:4px 0 0}
.ls-sp-a{flex:none;align-self:center;margin-right:4px;font:700 var(--fs-t2)/1 var(--f-round);color:var(--label2)}
.ls-slot{flex:0 1 44px;min-width:0;display:grid;place-items:center;height:52px;border-radius:12px 12px 6px 6px;background:var(--fill2);
  border-bottom:3px solid var(--sep);font:800 var(--fs-t2)/1 var(--f-round);color:var(--label);transition:background-color .16s,border-color .16s,color .16s}
.ls-slot.is-next{border-color:var(--brand-tint);background:var(--brand-soft)}
.ls-sp.is-many{gap:4px}
.ls-sp.is-many .ls-slot{height:46px;font-size:var(--fs-head)}
.ls-sp.is-done .ls-slot{background:var(--ok-fill);border-color:var(--ok-fill);color:#fff}
.ls-tiles{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin:0 auto;max-width:400px}
.ls .ls-tile{position:relative;flex:none;width:56px;height:60px;padding:0;border:0;border-radius:18px;background:var(--card);color:var(--label);
  font:800 1.75rem/1 var(--f-round);box-shadow:0 3px 0 var(--sep);transition:background-color .16s,color .16s,box-shadow .16s}
.ls .ls-tile.is-used{visibility:hidden}
.ls .ls-tile.is-miss{background:var(--miss-fill);color:var(--miss-on);box-shadow:none}
.ls .ls-tile .xm{position:absolute;top:4px;right:4px;width:16px;height:16px;color:var(--miss)}
.ls .ls-tile.is-hint{box-shadow:0 0 0 3px var(--teal),0 3px 0 var(--sep)}
.ls .ls-tiles.is-11{gap:8px}
.ls .ls-tiles.is-11 .ls-tile{width:46px}   /* 11 fichas: 6 por fila, así son 2 filas */
.ls-tiles[hidden]{display:none}
.ls-spq{display:flex;align-items:center;justify-content:center;gap:12px;max-width:100%}
.ls-spq .ls-ask{margin:0;min-width:0}
.ls-spq .ls-audio{flex:none;margin:0}
.ls .ls-spq .ls-spk.say{width:52px;height:52px}
/* «Completa la frase»: la frase con su hueco (como en la gramática) */
.ls-fill .ls-sent{margin:4px 0 0;text-wrap:pretty}
.ls-hint{margin:0;font-size:var(--fs-sub)}   /* sin dibujo, el español de la palabra */
.ls-hint q{quotes:"«" "»"}
/* «Empareja»: dibujos a la izquierda y palabras a la derecha, grandes */
.ls .ls-mhead{gap:4px;padding-top:14px;padding-bottom:14px}
.ls-mhead .ls-ask{margin:0;font-size:var(--fs-head)}
.ls-mt{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
.ls-mt-c{display:flex;flex-direction:column;gap:12px;min-width:0}
.ls .ls-mc{--mh:clamp(64px,calc((100vh - 26rem * var(--k,1)) / 4),104px);position:relative;display:flex;align-items:center;justify-content:center;
  min-width:0;min-height:var(--mh);padding:6px 10px;border:0;border-radius:20px;background:var(--card);color:var(--label);
  font:700 var(--fs-t3)/1.15 var(--f-round);text-align:center;transition:background-color .16s,color .16s,box-shadow .16s}
@supports (height:100svh){.ls .ls-mc{--mh:clamp(64px,calc((100svh - 26rem * var(--k,1)) / 4),104px)}}
.ls .ls-mc img{display:block;box-sizing:border-box;height:calc(var(--mh) - 14px);max-width:100%;aspect-ratio:1;object-fit:contain;padding:3px;
  border-radius:14px;background:#fff;-webkit-user-drag:none}
:root[data-theme=dark] .ls .ls-mc img{background:#F2F2F7}
.ls-mc-w{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;overflow-wrap:anywhere}
.ls-mc-w .ipa{font:400 var(--fs-note)/1.2 var(--f-text);color:inherit;overflow-wrap:anywhere}
.ls .ls-mt.is-long .ls-mc{font-size:var(--fs-head)}
.ls .ls-mc.is-sel{box-shadow:0 0 0 3px var(--brand-tint);background:var(--brand-soft)}
.ls .ls-mc.is-ok{background:var(--ok-fill);color:#fff;box-shadow:none}
.ls .ls-mc.is-miss{background:var(--miss-fill);color:var(--miss-on);box-shadow:none}
.ls-mc .chk,.ls-mc .xm{position:absolute;top:6px;left:6px;width:22px;height:22px}
.ls-mc.has-img .chk{box-sizing:border-box;padding:4px;border-radius:50%;background:var(--ok-fill);color:#fff;box-shadow:0 0 0 2px #fff}
.ls-mc .xm{color:var(--miss)}
/* el final: «Repasa tus fallos» */
.ls .ls-fixb{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 20px;border:0;border-radius:var(--r-pill);
  background:var(--brand-soft);color:var(--brand-ink);font:700 var(--fs-sub)/1.2 var(--f-text)}
.ls-end-s{margin:0;font:400 var(--fs-body)/1.35 var(--f-text);color:var(--label2);text-wrap:balance}
/* móvil bajo (iPhone SE/8): todo cabe sin bajar, y la respuesta queda por encima del botón */
@media (max-height:700px){
  .ls-pic{height:clamp(110px,22vh,160px)}
  .ls-spell .ls-pic,.ls-fill .ls-pic{height:clamp(72px,13vh,110px)}
  .ls .ls-card{gap:4px;padding:16px 16px 20px}
  .ls .ls-top{margin-bottom:12px}
  .ls-opts{gap:8px}
  .ls-end .ls-card{padding:16px}
  .ls-fox{height:96px}}
/* aún más bajo (móvil pequeño, tumbado): el dibujo como antes y las opciones con dibujo en una fila (dibujo pequeño a la
   izquierda), que es lo que cabe */
@media (max-height:600px){
  .ls-pic{height:clamp(96px,18vh,140px)}
  .ls .ls-opt.has-pic{--lpw:48px;flex-direction:row;justify-content:flex-start;padding:8px 12px 8px 8px;text-align:left}
  .ls .ls-opt.has-pic .chk,.ls .ls-opt.has-pic .xm{left:38px;top:calc(50% + 4px)}}
@media (prefers-reduced-motion:reduce){
  .ls .ls-spk.say.playing::after{animation:none;opacity:0}
  .ls-fox .hero{animation:none}
  .ls-star,.ls-star.on{scale:1;transition:opacity .15s ease-out}
  .ls-chip .ico,.ls-syl .sy,.ls .ls-tile,.ls-slot,.ls .ls-mc{transition:none}}
`;
function css(){
  if(document.getElementById("css-lesson")) return;
  const st = document.createElement("style"); st.id = "css-lesson"; st.textContent = CSS;
  document.head.appendChild(st);
}

/* ---------- guardado (sessionStorage "vocab:ls" y su copia localStorage "vocab:lsdraft") ---------- */
const okSaved = v => v && typeof v === "object" && !Array.isArray(v) && typeof v.id === "string" && v.id && (!v.lang || v.lang === lang) ? v : null;
function saved(){
  try{ const v = okSaved(JSON.parse(sessionStorage.getItem(KEY))); if(v) return v; }catch(e){}
  /* la pestaña se cerró (o el iPhone cerró la app): la copia de este aparato, si es de las últimas 72 horas */
  try{
    const d = JSON.parse(localStorage.getItem(DRAFT)), now = Date.now();
    return d && typeof d === "object" && typeof d.t === "number" && now - d.t < DRAFT_MS && now >= d.t - 6e4 ? okSaved(d.v) : null;
  }catch(e){ return null; }
}
const stepKey = (s, st) => s.g ? st.q.s : st.w.k;
/* un paso como texto, para guardarlo: "pick:3" (la 4.ª palabra), "listen:r1!" (la 2.ª de repaso, repetida),
   "match:0,1,2,4" */
const wIx = (s, w) => w.rv ? "r" + s.rvw.indexOf(w) : String(s.words.indexOf(w));
const enc = (s, st) => st.t + ":" + (st.t === "match" ? st.ws.map(w => wIx(s, w)).join(",") : wIx(s, st.w)) + (st.re ? "!" : "");
function dec(s, x){
  const m = /^(learn|pick|listen|spell|fill|match):(r?\d{1,3}(?:,r?\d{1,3}){0,3})(!?)$/.exec(String(x));
  if(!m) return null;
  const ws = m[2].split(",").map(j => j[0] === "r" ? s.rvw[+j.slice(1)] : s.words[+j]);
  if(ws.some(w => !w)) return null;
  if(m[1] === "match") return ws.length === 4 && new Set(ws).size === 4 ? {t: "match", ws} : null;
  const w = ws[0];
  if(ws.length !== 1 || (m[1] === "learn" && w.rv) || (m[1] === "spell" && !spellOf(w)) || (m[1] === "fill" && !fillOf(w, s))) return null;
  return Object.assign({t: m[1], w}, m[3] ? {re: true} : {});
}
/* done: pasos hechos. No se guarda nada hasta el primer paso hecho (antes no hay nada que perder). La repetición de
   fallos y «¿Ya lo sabes?» no se guardan (son cortas). */
function lsSave(done){
  const s = LS; if(!s || s.ended || s.fix || s.ut) return;
  done = Math.max(0, Math.min(done, s.steps.length));
  if(!s.saved && done < 1) return;
  s.saved = true;
  const left = s.steps.slice(done).filter(st => st.re).map(st => stepKey(s, st));
  const v = s.g ? {id: s.id, i: done, first: [...s.first], miss: [...s.miss], n: s.steps.length, lang, left}
    : {v: 2, id: s.id, i: done, first: [...s.first], miss: [...s.miss], n: s.steps.length, lang, left,
       ws: s.words.map(w => w.k), plan: s.steps.map(st => enc(s, st)), rv: s.rvw.map(w => [w.doc, w.r.es]), rvMiss: [...s.rvMiss]};
  try{ sessionStorage.setItem(KEY, JSON.stringify(v)); }catch(e){}
  try{ localStorage.setItem(DRAFT, JSON.stringify({t: Date.now(), v})); }catch(e){}
  refreshAcc();
}
function clearSaved(){
  try{ sessionStorage.removeItem(KEY); }catch(e){}
  try{ localStorage.removeItem(DRAFT); }catch(e){}
  refreshAcc();
}
/* gramática: rehace los pasos de una práctica guardada: delante los ya hechos y detrás lo que falta (las que no ha
   contestado aún y las repeticiones de las falladas que quedaban, sv.left; en lo guardado antes de left, las últimas
   falladas hasta el total de antes). El orden de lo que falta se vuelve a mezclar. Con valores raros o fuera de rango
   devuelve false (y empieza de cero). */
function rebuild(s, sv){
  const items = s.x.q, key = q => q.s, maxN = items.length * 4;
  const i0 = Math.floor(+sv.i), n0 = sv.n == null ? 0 : Math.floor(+sv.n);
  if(!Number.isFinite(i0) || i0 < 0 || i0 > maxN || !Number.isFinite(n0) || n0 < 0 || n0 > maxN || (n0 && i0 > n0)) return false;
  const keys = new Set(items.map(key));
  const first = (Array.isArray(sv.first) ? sv.first : []).filter(k => keys.has(k));
  const miss = (Array.isArray(sv.miss) ? sv.miss : []).filter(k => keys.has(k) && !first.includes(k));
  s.first = new Set(first); s.miss = new Set(miss); s.saved = true;
  const done = new Set([...first, ...miss]);
  const mk = it => ({t: "gq", q: it});
  const byKey = k => items.find(it => key(it) === k);
  const todo = mix(items.filter(it => !done.has(key(it))));
  let again;
  if(Array.isArray(sv.left)) again = sv.left.filter(k => miss.includes(k)).slice(0, items.length * 3).map(byKey).filter(Boolean);
  else {
    const left = Math.max(todo.length, n0 - i0), missed = miss.map(byKey).filter(Boolean);
    again = [];
    for(let r = left - todo.length, k = missed.length - 1; r > 0 && missed.length; r--, k--) again.unshift(missed[(k % missed.length + missed.length) % missed.length]);
  }
  const past = []; for(let k = 0; k < i0; k++) past.push(Object.assign(mk(items[k % items.length]), {done: true}));
  s.steps = [...past, ...todo.map(mk), ...again.map(it => Object.assign(mk(it), {re: true}))];
  s.i = i0;
  return true;
}
/* vocabulario: lo guardado lleva los pasos tal cual (plan). Vale si es de estas mismas palabras y todo está en su
   rango; si no, false (y la lección empieza de cero). Lo de antes (sin v: 2) tampoco vale. */
function restore(s, sv){
  if(!sv || sv.v !== 2 || !Array.isArray(sv.plan) || !Array.isArray(sv.ws) || sv.ws.join("|") !== s.words.map(w => w.k).join("|")) return false;
  const maxN = s.words.length * 8 + 24, i = Math.floor(+sv.i);
  if(!sv.plan.length || sv.plan.length > maxN || !Number.isFinite(i) || i < 0 || i > sv.plan.length) return false;
  if(sv.n != null && Math.floor(+sv.n) !== sv.plan.length) return false;
  const steps = sv.plan.map(x => dec(s, x));
  if(steps.some(st => !st)) return false;
  const keys = new Set(s.words.map(w => w.k)), rks = new Set(s.rvw.map(w => w.k));
  const miss = (Array.isArray(sv.miss) ? sv.miss : []).filter(k => keys.has(k));
  s.first = new Set((Array.isArray(sv.first) ? sv.first : []).filter(k => keys.has(k) && !miss.includes(k)));
  s.miss = new Set(miss);
  s.rvMiss = new Set((Array.isArray(sv.rvMiss) ? sv.rvMiss : []).filter(k => rks.has(k)));
  steps.slice(0, i).forEach(st => { st.done = true; });
  s.steps = steps; s.i = i; s.saved = true;
  return true;
}
function fresh(o){
  return Object.assign({i: 0, first: new Set(), miss: new Set(), rvMiss: new Set(), rvw: [], tok: ++autoTok, streak: 0, saved: false, ended: false,
    hs: history.state, lang, pend: null}, o);
}

/* ---------- las palabras: cada una por su sitio (tema:fila), no por su español ---------- */
const NRM = t => String(t || "").normalize("NFC").toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, " ").trim();
const tw = x => NRM(x && x.r && x.r.l && x.r.l[lang] ? x.r.l[lang].word : "");   /* la palabra del idioma */
const tes = x => NRM(x && x.r ? x.r.es : "");                                     /* su español */
/* la palabra sin notas ni variantes: «l'enfant (m./f.)» → «l'enfant», «le voisin / la voisine» → «le voisin»,
   «le / la ministre» → «le ministre» */
const clean = w => String(w || "").replace(/\s*\([^)]*\)/g, "").replace(/^(le|la|les|un|une|en|et)\s*\/\s*(?:le|la|les|un|une|en|et)\s+/i, "$1 ")
  .split(/\s*\/\s*/)[0].trim().normalize("NFC");
/* [artículo tal cual, el resto]: «le chien» → ["le", "chien"], «l'oiseau» → ["l'", "oiseau"]; sin artículo, ["", w] */
const artSplit = w => { const re = ARTS[lang2()], m = re && re.exec(w); return m ? [m[1].trim(), w.slice(m[1].length)] : ["", w]; };
/* las palabras de repaso: 2 o 3 del repaso del idioma (caja ≤ 2) que no son de la lección; primero las que tocan hoy,
   luego las más flojas; con dibujo si se puede. Cada una lleva sus distractores (pool) de su propio tema. */
async function pickReview(words){
  try{
    const m = srsAll(), t = today(), mine = new Set(words.map(w => w.doc + "|" + w.r.es)), tws = new Set(words.map(tw));
    const pri = x => (x.due || 0) <= t ? 0 : (x.b || 0) <= 1 && (x.n || 0) > 0 ? 1 : 2;
    const cand = mix(Object.entries(m).filter(([k, x]) => x && typeof x === "object" && typeof x.d === "string" && typeof x.e === "string" && (x.b || 0) <= 2 && !mine.has(k)))
      .sort((a, b) => pri(a[1]) - pri(b[1]) || (a[1].b || 0) - (b[1].b || 0) || (a[1].due || 0) - (b[1].due || 0)).slice(0, 14);
    const want = words.length >= 10 ? 2 : 3, got = [];
    for(const [, x] of cand){
      let doc; try{ doc = await getDoc(x.d); }catch(e){ continue; }
      const i = (doc && doc.rows || []).findIndex(r => r && r.es === x.e && r.l && r.l[lang]);
      if(i < 0) continue;
      const w = rvWord(x.d, i, doc);
      if(tws.has(tw(w))) continue;
      got.push({w, p: pri(x), img: !!w.r.img});
    }
    /* con dibujo antes, sin pasar por delante de las que tocan antes */
    got.sort((a, b) => a.p - b.p || (b.img - a.img));
    const out = [], seen = new Set();
    for(const g of got){ const k = tw(g.w); if(out.length < want && !seen.has(k)){ seen.add(k); out.push(g.w); } }
    return out;
  }catch(e){ console.error(e); return []; }
}
function rvWord(d, i, doc){
  const r = doc.rows[i], pool = [{doc: d, r}];
  for(const x of mix(doc.rows)) if(pool.length < 12 && x && x !== r && x.es && x.l && x.l[lang]) pool.push({doc: d, r: x});
  return {doc: d, i, r, k: "rv:" + d + "|" + r.es, rv: true, pool};
}
/* las de repaso de una lección guardada (null si alguna ya no está) */
async function loadRv(list){
  try{
    if(!Array.isArray(list) || list.length > 4) return null;
    const out = [];
    for(const it of list){
      if(!Array.isArray(it) || typeof it[0] !== "string" || typeof it[1] !== "string") return null;
      const doc = await getDoc(it[0]), i = (doc && doc.rows || []).findIndex(r => r && r.es === it[1] && r.l && r.l[lang]);
      if(i < 0) return null;
      out.push(rvWord(it[0], i, doc));
    }
    return out;
  }catch(e){ return null; }
}
/* «Ordena las letras»: {art, base, L} si la palabra (sin el artículo) son solo letras, de 3 a 10 */
function spellOf(w){
  const d = w && w.r && w.r.l && w.r.l[lang]; if(!d) return null;
  const [art, base] = artSplit(clean(d.word)), L = [...base];
  return L.length >= 3 && L.length <= 10 && /^\p{L}+$/u.test(base) ? {art, base, L} : null;
}
const ABC = {en: "abcdefghijklmnopqrstuvwxyz", fr: "abcdefghijklmnopqrstuvwxyzéèàç", da: "abcdefghijklmnopqrstuvwxyzæøå"};
const VOWS = "aeiouyéèàæøå";
/* las fichas: las letras de la palabra mezcladas y 1 o 2 de sobra (2 en las cortas, 1 en las largas) que no están en
   ella, una vocal y una consonante; nunca en el orden bueno */
function tilesOf(sp){
  const have = new Set(sp.L.map(c => NRM(c)));
  const free = [...(ABC[lang2()] || ABC.en)].filter(c => !have.has(c));
  const vw = mix(free.filter(c => VOWS.includes(c))), cs = mix(free.filter(c => !VOWS.includes(c)));
  const extra = (sp.L.length <= 5 ? [vw[0], cs[0]] : [mix([vw[0], cs[0]])[0]]).filter(Boolean);
  const all = [...sp.L.map(c => ({c})), ...extra.map(c => ({c, x: true}))];
  for(let k = 0; k < 8; k++){ const t = mix(all); if(t.slice(0, sp.L.length).map(x => x.c).join("") !== sp.base) return t; }
  return all.reverse();
}
/* «Completa la frase»: dónde sale la palabra en su ejemplo. Se busca la palabra entera, sin artículo y sus formas
   («dogs», «les chiens» → «chiens»), como palabra suelta. Las otras opciones son lo mismo (j) de otras palabras de la
   lección o del tema. null si no sale, si sale dos veces o si no hay 2 opciones más. */
const gapCands = d => { const f = clean(d.word); return [f, artSplit(f)[1], ...String(d.forms || "").split(/[,;]/).map(x => artSplit(clean(x))[1])].map(x => x.trim()); };
function findIn(ex, t){
  if(!t || [...t].length < 2) return null;
  const E = String(ex).normalize("NFC").replace(/’/g, "'"), T = t.replace(/’/g, "'").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let re; try{ re = new RegExp(`(^|[^\\p{L}\\p{N}])(${T})(?![\\p{L}\\p{N}])`, "iu"); }catch(e){ return null; }
  const m = re.exec(E); if(!m) return null;
  const at = m.index + m[1].length, len = m[2].length;
  return re.test(E.slice(at + len)) ? null : {at, len};
}
function fillOf(w, s = LS){
  const d = w && w.r && w.r.l && w.r.l[lang]; if(!d || !d.ex || !s) return null;
  const c = gapCands(d), W0 = tw(w), E0 = tes(w);
  for(let j = 0; j < c.length; j++){
    const hit = findIn(d.ex, c[j]); if(!hit) continue;
    const right = c[j], a = artOf(right), seen = new Set([NRM(right)]), alt = [];
    for(const x of [...(s.pool || []), ...(s.more || [])]){
      if(!x || !x.r || !x.r.l || !x.r.l[lang] || tw(x) === W0 || tes(x) === E0) continue;
      const v = gapCands(x.r.l[lang])[j];
      if(!v || seen.has(NRM(v)) || !/^[\p{L}\s'’-]+$/u.test(v)) continue;
      seen.add(NRM(v)); alt.push({v, same: !a || artOf(v) === a});
    }
    if(alt.length >= 2) return {ex: String(d.ex).normalize("NFC"), at: hit.at, len: hit.len, right, alt};
  }
  return null;
}
/* «Empareja»: 4 palabras de la lección con dibujos distintos (primero las del último trozo); null si no hay 4 */
function matchSet(W, prefer){
  const out = [], imgs = new Set(), ws = new Set(), es = new Set();
  const add = x => {
    if(out.length >= 4 || !x.r.img || /(^|\/)fam_/.test(x.r.img) || imgs.has(x.r.img) || ws.has(tw(x)) || es.has(tes(x))) return;
    out.push(x); imgs.add(x.r.img); ws.add(tw(x)); es.add(tes(x));
  };
  mix(prefer).forEach(add); mix(W).forEach(add);
  return out.length === 4 ? out : null;
}
/* el orden de la lección: aprende 3 → pregunta esas 3 → aprende 3 → 6 mezcladas (las 3 nuevas para reconocer y las 3
   de antes para recordar) … y al final lo de recordar de las últimas y «Empareja» (con las de antes). Las de repaso,
   repartidas desde la segunda vuelta. Trozos de 3 como mucho: el de 1 que sobra se junta con uno del anterior (2+2).
   Cada tanda se ordena para que entre dos preguntas de la misma palabra haya 3 pasos o más (las palabras nuevas
   cuentan; «Empareja» es de propina y no cuenta): primero, al azar, las que lo cumplen y vuelven en la tanda siguiente. */
const GAP = 3;
function plan(s){
  const W = s.words, B = [];
  for(let k = 0; k < W.length; k += 3) B.push(W.slice(k, k + 3));
  if(B.length > 1 && B[B.length - 1].length === 1) B[B.length - 1].unshift(B[B.length - 2].pop());
  let flip = 0; const cnt = {spell: 0, fill: 0};
  const easy = w => ({t: flip++ % 2 ? "listen" : "pick", w});
  const hard = w => {
    const can = ["spell", "fill"].filter(t => t === "spell" ? spellOf(w) : fillOf(w, s));
    if(!can.length) return easy(w);
    const t = mix(can).sort((a, b) => cnt[a] - cnt[b])[0]; cnt[t]++;
    return {t, w};
  };
  const R = B.map((b, k) => ({learn: b, ask: [...b.map(easy), ...(k ? B[k - 1].map(hard) : [])]}));
  const last = B[B.length - 1], m = matchSet(W, W.filter(w => !last.includes(w)));
  R.push({learn: [], ask: [...last.map(hard), ...(m ? [{t: "match", ws: m}] : [])]});
  const tg = R.slice(1);
  (s.rvw || []).forEach((w, j) => tg[j % tg.length].ask.push({t: "pick", w}));
  const out = [], at = new Map(), key = st => st.w ? st.w.k : null;
  const gap = st => { const k = key(st); return st.t === "match" || !at.has(k) ? 99 : out.length - 1 - at.get(k); };
  const put = st => { out.push(st); if(st.t !== "learn" && st.t !== "match") at.set(key(st), out.length - 1); };
  R.forEach((r, j) => {
    r.learn.forEach(w => put({t: "learn", w}));
    const soon = new Set(((R[j + 1] || {}).ask || []).map(key)), rest = mix(r.ask);
    while(rest.length){
      const fit = rest.map((st, i) => i).filter(i => gap(rest[i]) >= GAP);
      const i = fit.length ? (fit.find(i => soon.has(key(rest[i]))) ?? fit[0]) : rest.reduce((b, st, i) => gap(st) > gap(rest[b]) ? i : b, 0);
      put(rest.splice(i, 1)[0]);
    }
  });
  return out;
}
/* una fallada vuelve 3 a 5 pasos después (al azar), nunca entre dos palabras nuevas de un trozo; si no hay tantos, al
   final */
function reinsert(s, st){
  const S = s.steps, inLearn = j => j > 0 && j < S.length && S[j - 1].t === "learn" && S[j].t === "learn";
  let j = s.i + 1 + GAP + Math.floor(Math.random() * 3);
  while(inLearn(j)) j++;
  S.splice(Math.min(j, S.length), 0, st);
}

/* ---------- entrar ---------- */
async function leccion(id){
  css();
  id = String(id || "");
  await getMap(); document.onkeydown = null;
  if(id.startsWith("G-")) return gramLesson(id);
  if(/^[A-C][12]-U\d{2}$/.test(id)) return unitTest(id);
  /* una lección que no existe (enlace viejo, id cambiado u otro idioma sin ella): al camino, por el router, así no se
     queda en modo foco y el historial queda bien */
  const toMap = l => { location.replace("#/mapa" + (l && MAP[l] ? "/" + l : "")); };
  const lv = id.slice(0, 2); if(!MAP[lv]) return toMap();
  const ui = MAP[lv].findIndex(u => u.ls.some(l => l.id === id)); if(ui < 0) return toMap(lv);
  const unit = MAP[lv][ui], l = unit.ls.find(l => l.id === id);
  const docs = {}; for(const [d] of l.w) docs[d] = await getDoc(d);
  if(hashPath() !== "leccion/" + id) return;   /* mientras cargaba se fue a otra pantalla */
  /* cada palabra por su sitio (tema:fila); la que repite la palabra del idioma de otra anterior no se enseña dos veces */
  const words = [], tws = new Set();
  for(const [d, i] of l.w){
    const r = docs[d].rows[i]; if(!r || !r.l || !r.l[lang] || !r.l[lang].word) continue;
    const x = {doc: d, i, r, k: d + ":" + i}, t = tw(x);
    if(tws.has(t)) continue;
    tws.add(t); words.push(x);
  }
  if(!words.length) return toMap(lv);
  const {pool, more} = pools(words, docs, unit.doc);
  const sv = saved(), mine = sv && sv.id === id ? sv : null;
  const rvw = mine && mine.v === 2 ? await loadRv(mine.rv) : await pickReview(words);
  if(hashPath() !== "leccion/" + id) return;
  const mk = rv => { const s = fresh({id, lv, unit, words, pool, more, rvw: rv || [], nq: words.length}); s.steps = plan(s); return s; };
  LS = mk(rvw);
  if(mine && !(rvw && restore(LS, mine))){
    clearSaved();
    const rv2 = rvw && mine.v !== 2 ? rvw : await pickReview(words);
    if(hashPath() !== "leccion/" + id) return;
    LS = mk(rv2);
  }
  mount(); lsStep(0);
}
/* distractores: las otras palabras de la lección y, si faltan, del mismo documento (pool); y más palabras del tema,
   para buscar otras opciones con el mismo artículo (francés y danés) o para «Completa la frase» (more) */
function pools(words, docs, d0){
  const pool = [...words], seen = new Set(words.map(tes)), seenW = new Set(words.map(tw));
  const ok = r => r && r.es && r.l && r.l[lang] && r.l[lang].word && !seen.has(NRM(r.es)) && !seenW.has(NRM(r.l[lang].word));
  const take = (r, d, to) => { seen.add(NRM(r.es)); seenW.add(NRM(r.l[lang].word)); to.push({doc: d, r}); };
  for(const r of (docs[d0] || {rows: []}).rows) if(pool.length < 12 && ok(r)) take(r, d0, pool);
  const more = []; for(const [d, doc] of Object.entries(docs)) for(const r of doc.rows) if(ok(r)) take(r, d, more);
  return {pool, more};
}
async function gramLesson(id){
  css();
  const lv = id.slice(2, 4), k = parseInt(id.slice(5), 10) - 1;
  const G = await getGram(), x = ((G || {})[lv] || [])[k];
  if(hashPath() !== "leccion/" + id) return;
  if(!x || !Array.isArray(x.q) || !x.q.length){ location.replace("#/mapa" + (LVS[lv] ? "/" + lv : "")); return; }
  const plan = () => mix(x.q.map((q, i) => i)).map(i => ({t: "gq", q: x.q[i]}));
  LS = fresh({id, lv, g: true, x, words: [], steps: plan(), i: -1, nq: x.q.length});
  const sv = saved();
  if(sv && sv.id === id && !rebuild(LS, sv)){ clearSaved(); LS = fresh({id, lv, g: true, x, words: [], steps: plan(), i: -1, nq: x.q.length}); }
  mount(); gStep(0);
}

/* el armazón: arriba la barra de progreso (en la fila de la ✕), en medio la tarjeta y abajo el botón principal */
function mount(){
  const s = LS, lc = LVS[s.lv] ? LVS[s.lv].c : "";
  offs.splice(0).forEach(f => { try{ f(); }catch(e){} });
  $("#app").innerHTML = `<div class="ls${s.g ? " ls-g" : ""}" style="--lc:${lc}" data-key-own>
    <div class="ls-top"><div class="ls-bar" role="progressbar" aria-label="Tu progreso" aria-valuemin="0" aria-valuemax="${s.steps.length}" aria-valuenow="0"><i></i></div></div>
    <div class="ls-stage"></div>
    <p class="vh" id="ls-say" aria-live="polite" aria-atomic="true"></p>
    <div class="ls-dock">
      <button type="button" class="glass-btn glass-btn--lg ls-prev${s.g ? "" : " is-off"}" aria-label="Anterior" data-key="left"${s.g ? " hidden" : ' aria-hidden="true" tabindex="-1" disabled'}>${ico("caret-left", "bold", 22)}</button>
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg ls-go" id="ls-go" data-key="enter" hidden>Continuar</button>
    </div></div>`;
  const go = $("#ls-go"), prev = $(".ls .ls-prev");
  go.addEventListener("click", () => { const f = go._fn; if(typeof f === "function") f(); });
  prev.addEventListener("click", () => back());
  document.onkeydown = onKey;
}
/* el botón de abajo: texto y qué hace (sin fn, se esconde) */
function setGo(text, fn){
  const go = $("#ls-go"); if(!go) return;
  go._fn = fn || null; go.textContent = text || ""; go.hidden = !fn;
}
/* «‹» (la palabra nueva anterior): en las de vocabulario su hueco se queda aunque no se vea */
function setPrev(on){
  const b = $(".ls .ls-prev"); if(!b) return;
  if(LS && LS.g){ b.hidden = !on; return; }
  b.classList.toggle("is-off", !on); b.disabled = !on;
  if(on){ b.removeAttribute("aria-hidden"); b.removeAttribute("tabindex"); } else { b.setAttribute("aria-hidden", "true"); b.tabIndex = -1; }
}
/* para el lector de pantalla (html: las palabras del idioma van en su <span lang>) */
function announce(html){ const el = $("#ls-say"); if(!el) return; el.textContent = ""; setTimeout(() => { if(el.isConnected) el.innerHTML = html; }, 40); }
const inLang = t => `<span lang="${langCode()}">${esc(t)}</span>`;
/* la palabra en español dentro de una frase, en minúscula («¿Cuál es «perro»?»), salvo nombres propios (los países, o
   si lleva más mayúsculas: «Reino Unido») */
const inQ = (es, doc) => String(es || "").split("/").map(p => doc === "paises" || /\p{Lu}/u.test(p.slice(1)) ? p : p.charAt(0).toLowerCase() + p.slice(1)).join("/");
/* barra de progreso (con muelle): done = pasos hechos. Sin contador «3/8»: al fallar sumaría una más */
function paintTop(done){
  const s = LS, n = s.steps.length, bar = $(".ls .ls-bar"); if(!bar) return;
  const fill = bar.firstElementChild, w = (n ? Math.min(100, 100 * done / n) : 0).toFixed(2) + "%";
  bar.setAttribute("aria-valuemax", n); bar.setAttribute("aria-valuenow", Math.min(done, n));
  bar.setAttribute("aria-valuetext", `${Math.min(done, n)} de ${n}`);
  if(fill.style.width && window.M && typeof M.springTo === "function") M.springTo(fill, [{width: w}]); else fill.style.width = w;
}

/* cambia la tarjeta empujándola de lado, como en iOS: la de antes sale entera por un lado y la nueva entra pegada a ella
   por el otro, con el mismo muelle (M.snappy; dir 1 = adelante, -1 = atrás). Nunca se montan una encima de otra. Con
   «Reducir movimiento», un fundido de 140 ms. Si el foco se quedaba en la de antes (o en ninguna parte), pasa a la
   tarjeta nueva, así el lector de pantalla la lee. */
function swap(html, dir){
  const st = stage(); if(!st) return null;
  offs.splice(0).forEach(f => { try{ f(); }catch(e){} });
  st.querySelectorAll(".ls-ghost").forEach(g => g.remove());
  const old = page(), ae = document.activeElement;
  /* el foco se pierde si estaba en la tarjeta vieja, en ningún sitio o en el botón de abajo (que cambia o se esconde) */
  const lost = !ae || ae === document.body || !!(old && old.contains(ae)) || !!(ae.closest && ae.closest(".ls-dock"));
  const tmp = document.createElement("div"); tmp.innerHTML = html.trim();
  const pg = tmp.firstElementChild; st.prepend(pg);
  if(old && dir){
    old.classList.add("ls-ghost"); old.setAttribute("aria-hidden", "true"); old.inert = true;
    old.querySelectorAll("[id]").forEach(n => n.removeAttribute("id"));
    const R = rm(), sp = window.M && M.snappy;
    const ms = R ? 140 : sp && sp.ms ? Math.max(260, Math.min(520, sp.ms)) : 320;
    const ease = !R && sp && sp.easing ? sp.easing : "cubic-bezier(.25,.8,.25,1)";
    const at = (k, gap) => `translateX(calc(${k * 100}% ${gap < 0 ? "-" : "+"} ${Math.abs(gap)}px))`;
    const out = R ? [{opacity: 1}, {opacity: 0}] : [{transform: "translateX(0)"}, {transform: at(-dir, -dir * 16)}];
    const inn = R ? [{opacity: 0}, {opacity: 1}] : [{transform: at(dir, dir * 16)}, {transform: "translateX(0)"}];
    const run = e => { const a = old.animate(out, {duration: ms, easing: e, fill: "forwards"}); a.finished.then(() => old.remove(), () => old.remove()); pg.animate(inn, {duration: ms, easing: e}); };
    try{ run(ease); }catch(e){ try{ run("cubic-bezier(.25,.8,.25,1)"); }catch(e2){ old.remove(); } }
  } else if(old) old.remove();
  if(scrollY > 0) scrollTo(0, 0);
  if(kbdMode() || lost){ const c = pg.querySelector(".ls-card"); if(c){ c.tabIndex = -1; c.focus({preventScroll: true}); } }
  return pg;
}

/* ---------- piezas ---------- */
/* sin dibujo, la primera letra del español; un número («71») o un español de 3 letras o menos va entero */
const phText = es => { es = String(es || "?").trim() || "?"; return /^[\d.,\s]+$/.test(es) || [...es].length <= 3 ? es : es.charAt(0).toUpperCase(); };
const pic = r => r && r.img ? `<img src="${esc(r.img)}" alt="" draggable="false" decoding="async">`
  : (t => `<span class="ls-ph${[...t].length > 1 ? " is-long" : ""}" aria-hidden="true">${esc(t)}</span>`)(phText(r && r.es));
const spkBtn = (t, xl) => `<button type="button" class="say ls-spk${xl ? " xl" : ""}" data-say="${esc(t)}" data-key="space" aria-label="Escuchar">${ico("speaker-high", "fill", xl ? 40 : 32)}</button>`;
const slowBtn = t => `<button type="button" class="say ls-slow" data-say="${esc(t)}" data-slow data-key="shift+space" aria-label="Escuchar despacio">${ico("turtle", "fill", 30)}</button>`;
const streakHtml = n => `<span class="ls-streak" role="img" aria-label="${n} seguidas">${ico("fire", "fill", 20)}<b>${n}</b></span>`;
const rvTag = w => w && w.rv ? `<span class="ls-rvt">${ico("arrows-clockwise", "bold", 14)}Repaso</span>` : "";
const chip = s => s.streak >= 3 ? streakHtml(s.streak) : "";
/* el artículo de una palabra en francés o danés («le», «la», «l'», «les», «un», «une», «des»; «en», «et», «at») */
const ARTS = {fr: /^(l['’]|les\s|le\s|la\s|une\s|un\s|des\s)/i, da: /^(en\s|et\s|at\s)/i};
const artOf = w => { const re = ARTS[lang2()], m = re && re.exec(String(w || "")); return m ? m[1].toLowerCase().replace("’", "'").trim() : ""; };
/* opciones: la buena y 3 distintas de la lección (o del tema; las de repaso, de su tema). Si la buena lleva artículo,
   las otras llevan el mismo cuando se puede (de la lección y, si faltan, del tema): así no se acierta solo por «la» o
   por «et». Nunca dos buenas: fuera las que dicen lo mismo que la buena en el idioma («Primo» y «Prima» son «cousin»)
   o en español («phone» y «telephone» son «teléfono»), y las de su mismo dibujo. */
function options(w, field){
  const val = x => field === "es" ? x.r.es : x.r.l[lang].word;
  const out = [w], used = new Set([NRM(val(w))]), imgs = new Set(w.r.img ? [w.r.img] : []), W0 = tw(w), E0 = tes(w);
  const add = x => {
    if(out.length >= 4 || !x || !x.r || !x.r.l || !x.r.l[lang] || !x.r.l[lang].word) return;
    const v = NRM(val(x));
    if(used.has(v) || tw(x) === W0 || tes(x) === E0 || (x.r.img && imgs.has(x.r.img))) return;
    used.add(v); if(x.r.img) imgs.add(x.r.img); out.push(x);
  };
  const pool = w.pool || LS.pool, more = w.pool ? [] : (LS.more || []);
  const a = field === "es" ? "" : artOf(val(w));
  if(a){ const same = x => x && x.r && x.r.l && x.r.l[lang] && artOf(val(x)) === a; mix(pool).filter(same).forEach(add); mix(more).filter(same).forEach(add); }
  mix(pool).forEach(add);
  if(out.length < 4) mix(more).forEach(add);
  return mix(out).map(x => ({v: val(x), r: x.r}));
}
const optsHtml = (list, o = {}) => `<div class="ls-opts${list.length === 3 ? " is-3" : ""}${list.some(x => String(x.v).length > 11) ? " is-long" : ""}" role="group" aria-label="Respuestas">${list.map((x, k) =>
  `<button type="button" class="ls-opt${o.pics ? " has-pic" : ""}" data-press="sink" data-k="${k}" data-key="${k + 1}"${x.lang ? ` lang="${x.lang}"` : ""}><kbd class="ls-k" aria-hidden="true">${k + 1}</kbd>${o.pics ? `<img src="${esc(x.r.img)}" alt="" draggable="false">` : ""}<span class="ls-ot">${esc(x.v)}</span></button>`).join("")}</div>`;

/* ninguna respuesta se parte a media palabra («grandmothe·r»): si una palabra no cabe en su botón, las 4 bajan de tamaño
   juntas (titular y luego 17 px); solo si ni así cabe, se parte */
function fitOpts(pg){
  const box = pg && pg.querySelector(".ls-opts"); if(!box) return;
  /* con dibujos: si el dibujo de arriba saldría tan pequeño como el de la fila (pantalla baja, texto grande), en fila */
  const im = box.querySelector(".ls-opt.has-pic img");
  if(im && !box.classList.contains("is-row") && im.offsetWidth <= 52) box.classList.add("is-row");
  const ots = [...box.querySelectorAll(".ls-ot")];
  const over = t => t.scrollWidth > t.clientWidth + 1;
  /* con la ✓ o la ✗ al lado no cabe: se pone encima (en las de foto va sobre la esquina de la foto) */
  box.querySelectorAll(".ls-opt:not(.has-pic)").forEach(o => {
    const t = o.querySelector(".ls-ot"); if(t && o.querySelector(".chk,.xm") && over(t)) o.classList.add("is-stack");
  });
  /* tres en fila: si alguna no cabe, en columna */
  if(box.classList.contains("is-3") && ots.some(over)){ box.classList.remove("is-3"); box.classList.add("is-col"); }
  for(const c of ["is-long", "is-xlong", "is-break"]){ if(!ots.some(over)) return; box.classList.add(c); }
}
/* al contestar sale el altavoz de la pregunta; el dibujo se encoge lo mismo, así las opciones no se mueven de su sitio */
function reveal(pg){
  const el = pg && pg.querySelector(".ls-audio.is-later"); if(!el) return;
  const pic = pg.querySelector(".ls-q .ls-pic"), h0 = pic ? pic.getBoundingClientRect().height : 0;
  el.classList.remove("is-later"); el.removeAttribute("aria-hidden");
  const cs = getComputedStyle(el), h = el.getBoundingClientRect().height, mt = parseFloat(cs.marginTop) || 0;
  const gap = parseFloat(getComputedStyle(el.parentElement).rowGap) || 0, grow = h + mt + gap;
  const more = pic && h0 ? fbIpaCost(pg, grow) : 0;
  const h1 = pic && h0 ? Math.max(72, more ? Math.floor(h0 - grow - more) : Math.round(h0 - grow)) : 0;
  if(h1) pic.style.height = h1 + "px";
  if(rm()){ try{ el.animate([{opacity: 0}, {opacity: 1}], {duration: 150, easing: "ease-out"}); }catch(e){} return; }
  const ease = "cubic-bezier(.25,.8,.25,1)";
  try{
    el.style.overflow = "hidden";
    el.animate([{height: "0px", marginTop: -gap + "px", opacity: 0}, {height: h + "px", marginTop: mt + "px", opacity: 1}], {duration: 220, easing: ease})
      .finished.then(() => { el.style.overflow = ""; }, () => { el.style.overflow = ""; });
    if(h1) pic.animate([{height: h0 + "px"}, {height: h1 + "px"}], {duration: 220, easing: ease});
  }catch(e){ el.style.overflow = ""; }
}
/* lo que la página se pasa del alto de la pantalla (sin la tarjeta vieja que se va de lado) */
function pageOver(){
  const gs = [...document.querySelectorAll(".ls-stage > .ls-ghost")];
  gs.forEach(g => { g.style.display = "none"; });
  const o = document.documentElement.scrollHeight - innerHeight;
  gs.forEach(g => { g.style.display = ""; });
  return o;
}
/* la IPA de la palabra nueva es una línea más: si con ella la página bajaría (una palabra de dos líneas, un móvil bajo),
   el dibujo cede lo que haga falta, como mucho lo que ocupa la IPA y nunca por debajo de 72 px */
function fitIpa(pg){
  const card = pg && pg.isConnected && pg.querySelector(".ls-learn.has-ipa"), pic = card && card.querySelector(".ls-pic"), x = card && card.querySelector(".ls-ipa");
  if(!pic || !x || card.querySelector(".ls-ex:not([hidden])")) return;   /* con el ejemplo abierto se baja: no se toca */
  pic.style.height = "";
  const over = pageOver(); if(over <= 0) return;
  const h0 = pic.getBoundingClientRect().height, cs = getComputedStyle(x);
  const cost = x.getBoundingClientRect().height + (parseFloat(cs.marginTop) || 0) + (parseFloat(getComputedStyle(card).rowGap) || 0);
  if(h0 > 72) pic.style.height = Math.max(72, Math.floor(h0 - Math.ceil(Math.min(over, cost)))) + "px";
}
/* se vuelve a medir cuando la palabra o la IPA cambian de tamaño (llega la letra redonda, gira el móvil) y al acabar de
   entrar en la ruta (la primera palabra se pinta antes del modo foco) */
let ipaRO = null;
function watchIpa(pg){
  try{
    if(ipaRO) ipaRO.disconnect(); ipaRO = null;
    const card = pg && pg.querySelector(".ls-learn.has-ipa"); if(!card || typeof ResizeObserver !== "function") return;
    const ro = ipaRO = new ResizeObserver(() => { if(pg.isConnected) fitIpa(pg); else ro.disconnect(); });
    card.querySelectorAll(".ls-word,.ls-ipa").forEach(e => ro.observe(e));
  }catch(e){}
}
/* al girar el móvil (cambia el ancho); no cuando solo cambia el alto (la barra de Safari que se esconde al bajar) */
let ipaW = innerWidth;
addEventListener("resize", () => { if(innerWidth === ipaW) return; ipaW = innerWidth; requestAnimationFrame(() => { if(LS && !LS.ended) fitIpa(page()); }); });
/* la IPA de la respuesta de «¿Cuál es…?»: al lado de «¡Casi! Es «…»» no ocupa nada; en su propia línea, si con ella la
   página bajaría (ya descontado lo que cede el dibujo por el altavoz), el dibujo cede también esa línea (nunca más) */
function fbIpaCost(pg, already){
  const x = pg.querySelector(".ls-fb-ipa"); if(!x) return 0;
  const prev = x.previousElementSibling, r = x.getBoundingClientRect();
  if(prev && r.top < prev.getBoundingClientRect().bottom - 1) return 0;
  const over = pageOver() - already; if(over <= 0) return 0;
  return Math.ceil(Math.min(over, r.height + (parseFloat(getComputedStyle(x.parentElement).rowGap) || 0)));
}
/* la respuesta («¡Casi! Es «uncle»») siempre a la vista, por encima del botón de abajo */
function showFb(pg){
  setTimeout(() => {
    const fb = pg && pg.querySelector(".ls-fb"), dock = document.querySelector(".ls .ls-dock");
    if(!fb || !fb.isConnected || !dock || !fb.textContent.trim()) return;
    const over = fb.getBoundingClientRect().bottom - (dock.getBoundingClientRect().top - 8);
    if(over > 0) scrollBy({top: over, behavior: rm() ? "auto" : "smooth"});
  }, rm() ? 20 : 240);
}

/* ---------- pasos de vocabulario ---------- */
function lsStep(dir = 1){
  const s = LS; if(!s || s.ended) return;
  if(s.g) return gStep(dir);
  if(s.i >= s.steps.length) return lsEnd();
  quiet(); s.tok = ++autoTok; s.pend = null;
  const st = s.steps[s.i], idx = s.i, tok = s.tok;
  st.done = false;
  if(st.t === "match") return matchStep(s, st, idx, dir);
  /* un ejercicio que con esta palabra ya no se puede (otro idioma, otros datos): una pregunta normal */
  if((st.t === "spell" && !spellOf(st.w)) || (st.t === "fill" && !fillOf(st.w, s))) st.t = "pick";
  if(st.t === "spell") return spellStep(s, st, idx, dir);
  if(st.t === "fill") return fillStep(s, st, idx, dir);
  const r = st.w.r, d = r.l[lang];
  if(st.t === "learn"){
    const lc = langCode(), ipa = ipaHtml(d.ipa, lc, "ls-ipa");
    const pg = swap(`<div class="ls-page">
      <section class="card ls-card ls-learn${ipa ? " has-ipa" : ""}"${idx === 0 ? " data-no-hint" : ""} aria-label="Palabra nueva">
        <div class="ls-pic">${pic(r)}</div>
        <div class="ls-word t-word" lang="${lc}" title="Mantén pulsado: cómo suena">${esc(d.word)}</div>
        ${ipa}
        <div class="ls-tr">${esc(r.es)}</div>
        <div class="ls-audio">${spkBtn(d.word)}${slowBtn(d.word)}</div>
        <div class="ls-more"><button type="button" class="ls-chip" data-how aria-haspopup="dialog">Cómo suena</button>${d.ex ? `<button type="button" class="ls-chip" data-ex aria-expanded="false" aria-controls="ls-ex">Ejemplo ${ico("caret-down", "bold", 16)}</button>` : ""}</div>
        ${d.ex ? `<div class="ls-ex" id="ls-ex" hidden><p lang="${lc}">${esc(d.ex)} <button type="button" class="say ls-exs" data-say="${esc(d.ex)}" aria-label="Escuchar la frase">${ico("speaker-high", "fill", 20)}</button></p>${d.ex_es ? `<p class="ls-ex-tr">${esc(d.ex_es)}</p>` : ""}</div>` : ""}
      </section></div>`, dir);
    if(typeof fitWord === "function") fitWord(pg.querySelector(".ls-word"));
    watchIpa(pg);
    announce(`Palabra nueva: ${inLang(d.word)}, ${esc(r.es)}`);
    paintTop(idx);
    const canPrev = idx > 0 && s.steps[idx - 1].t === "learn";
    setGo("Continuar", () => next(idx)); setPrev(canPrev);
    wireLearn(s, pg, d, idx, canPrev);
    setTimeout(() => { if(alive(s) && s.i === idx && autoTok === tok && !sheetOpen()) sayP(d.word, pg.querySelector(".ls-spk")); }, dir ? 260 : 250);
    return;
  }
  const listen = st.t === "listen", list = options(st.w, listen ? "es" : "word");
  st.right = listen ? r.es : d.word;
  if(!listen) list.forEach(x => { x.lang = langCode(); });
  /* con dibujos solo si se distinguen: los árboles de familia (fam_…) son casi iguales en pequeño */
  const pics = listen && list.every(x => x.r && x.r.img) && !list.every(x => /(^|\/)fam_/.test(x.r.img));
  const es = inQ(r.es, st.w.doc);
  const pg = swap(`<div class="ls-page">
    <section class="card ls-card ls-q${listen ? " ls-listen" : ""}">${chip(s)}${rvTag(st.w)}${s.ut ? `<p class="ls-tag ls-uttag">${ico("lightning", "bold", 16)}¿Ya lo sabes?</p>` : ""}
      ${listen ? `<h2 class="ls-ask">Escucha y elige</h2><div class="ls-audio ls-audio--c">${spkBtn(d.word, true)}${slowBtn(d.word)}</div>`
               : `<div class="ls-pic">${pic(r)}</div><h2 class="ls-ask">¿Cuál es <q>${esc(es)}</q>?</h2><div class="ls-audio is-later" aria-hidden="true">${spkBtn(d.word)}${slowBtn(d.word)}</div>`}
    </section>
    ${optsHtml(list, {pics})}
    <p class="ls-fb"></p></div>`, dir);
  announce((st.w.rv ? "Repaso. " : "") + (listen ? "Escucha y elige" : `¿Cuál es «${esc(es)}»?`));
  paintTop(idx); setGo(null); setPrev(false); fitOpts(pg);
  pg.querySelectorAll(".ls-opt").forEach(b => b.addEventListener("click", () => answer(b)));
  if(listen) setTimeout(() => { if(alive(s) && s.i === idx && autoTok === tok && !st.done && !sheetOpen()) sayP(d.word, pg.querySelector(".ls-spk")); }, dir ? 280 : 250);
}
function wireLearn(s, pg, d, idx, canPrev){
  const card = pg.querySelector(".ls-learn"), word = pg.querySelector(".ls-word"), spk = pg.querySelector(".ls-spk");
  const G = window.G;
  if(G && typeof G.swipe === "function"){
    offs.push(G.swipe(card, {
      onMove: ({dx}) => { card.style.translate = `${dx}px 0`; card.style.rotate = `${(dx / 36).toFixed(2)}deg`; },
      onLeft: () => next(idx),
      onRight: canPrev ? () => back() : undefined,
      onCancel: ({v}) => {
        if(window.M && typeof M.springTo === "function") M.springTo(card, [{translate: "0px 0px", rotate: "0deg"}], {velocity: {x: v || 0, y: 0}});
        else { card.style.translate = ""; card.style.rotate = ""; }
      },
    }));
    /* mantener la palabra = «Cómo suena»; mantener el altavoz = despacio */
    if(typeof G.hold === "function"){
      offs.push(G.hold(word, {onHold: () => openHow(word)}));
      offs.push(G.hold(spk, {onHold: () => say1(d.word, spk, true)}));
    }
    /* la pista de deslizar: nunca en la primera tarjeta */
    if(idx > 0 && typeof G.hint === "function") setTimeout(() => {
      if(alive(s) && s.i === idx && card.isConnected && !card.classList.contains("ls-ghost") && !sheetOpen()) G.hint(card, {id: "ls-swipe", gesture: "left", text: "Desliza para seguir"});
    }, 900);
  }
  pg.querySelector("[data-how]").addEventListener("click", e => openHow(e.currentTarget));
  const exb = pg.querySelector("[data-ex]");
  if(exb) exb.addEventListener("click", () => {
    const box = pg.querySelector(".ls-ex"), open = box.hidden;
    box.hidden = !open; exb.setAttribute("aria-expanded", String(open));
    if(open){ sayP(d.ex, box.querySelector(".ls-exs")); if(!rm()) box.animate([{opacity: 0, transform: "translateY(-6px)"}, {opacity: 1, transform: "none"}], {duration: 200, easing: "ease-out"}); }
    else quiet();
  });
}
function next(idx){
  const s = LS; if(!alive(s) || s.i !== idx) return;
  s.i++; lsSave(s.i);
  if(s.g) gStep(1); else lsStep(1);
}
function back(){
  const s = LS; if(!alive(s) || s.g || s.i < 1 || s.steps[s.i - 1].t !== "learn" || s.steps[s.i].t !== "learn") return;
  s.i--; lsSave(s.i); lsStep(-1);
}
/* lo que cuenta una respuesta: las palabras nuevas, en first (sin fallar nunca) o miss; las de repaso, con srsGrade
   (2 o 0, como en el repaso) y, si se fallan, en rvMiss para «Repasa tus fallos». Una fallada vuelve 3 a 5 pasos
   después (reinsert), salvo las de repaso y las de «¿Ya lo sabes?» */
function grade(s, st, ok){
  const w = st.w;
  if(s.ut){ if(ok) s.right++; }
  else if(w && w.rv && !s.fix){ try{ srsGrade(w.doc, w.r, ok ? 2 : 0); }catch(e){ console.error(e); } if(!ok) s.rvMiss.add(w.k); }
  else if(w){ if(ok){ if(!s.miss.has(w.k)) s.first.add(w.k); } else { s.miss.add(w.k); s.first.delete(w.k); } }
  if(!ok && w && !s.ut && (s.fix || !w.rv)) reinsert(s, {t: st.t === "pick" ? "listen" : "pick", w, re: true});
  if(ok) s.streak++; else s.streak = 0;
}
/* contestar (vocabulario): la buena en verde con ✓ y la elegida, si no lo era, en gris con ✗ */
function answer(b){
  const s = LS, st = s && s.steps[s.i];
  if(!alive(s) || !st || st.done || !["pick", "listen", "fill"].includes(st.t) || !b || b.disabled) return;
  st.done = true;
  const r = st.w.r, d = r.l[lang], idx = s.i, pg = b.closest(".ls-page");
  const opts = [...pg.querySelectorAll(".ls-opt")], v = b.querySelector(".ls-ot").textContent;
  const ok = v === st.right, right = opts.find(o => o.querySelector(".ls-ot").textContent === st.right) || b;
  grade(s, st, ok);
  marks(opts, right, b, ok);
  bus.emit("answer", {ok, es: r.es, word: d.word, where: "lesson"});
  lsSave(idx + 1); paintTop(idx + 1);
  const spk = pg.querySelector(".ls-spk");
  if(st.t === "fill") return fillAnswered(s, st, idx, pg, ok, spk);
  /* «Escucha y elige» se contesta en español; «¿Cuál es…?», en el idioma */
  const rl = st.t === "listen" ? "" : ` lang="${langCode()}"`;
  /* contestada con la palabra: su IPA (en «Escucha y elige» la respuesta es la traducción; al fallarla se enseña también
     la palabra que sonó, con su IPA). Antes que reveal(), que mira si la línea de la IPA hace bajar la página */
  const ipa = st.t === "listen" ? "" : ipaHtml(d.ipa, langCode());
  const heard = st.t === "listen" && !ok ? `<small class="ls-fb-ipa ls-fb-w"><b lang="${langCode()}">${esc(d.word)}</b> ${ipaHtml(d.ipa, langCode())}</small>` : "";
  feedback(pg, ok, ok ? "" : `¡Casi! Es <b${rl}>«${esc(st.right)}»</b>`, ipa ? `<small class="ls-fb-ipa">${ipa}</small>` : heard);
  reveal(pg);
  showFb(pg);
  streakUp(s, pg, ok);
  setGo("Seguir", () => next(idx));
  if(kbdMode()) $("#ls-go").focus({preventScroll: true});
  if(ok) autoNext(s, idx, () => sayP(d.word, spk), 4500);
  else setTimeout(() => { if(alive(s) && s.i === idx) sayP(d.word, spk); }, 150);
}
function marks(opts, right, b, ok){
  opts.forEach(o => { o.disabled = true; if(o !== right && o !== b) o.classList.add("is-dim"); });
  right.classList.add("is-ok"); right.insertAdjacentHTML("afterbegin", CHK);
  right.insertAdjacentHTML("beforeend", `<span class="vh" lang="es"> (correcta)</span>`);
  if(!ok){ b.classList.add("is-miss"); b.insertAdjacentHTML("afterbegin", ico("x", "bold", 22, "xm")); b.insertAdjacentHTML("beforeend", `<span class="vh" lang="es"> (tu respuesta)</span>`); }
  fitOpts(right.closest(".ls-page"));   /* la ✓ y la ✗ quitan sitio: que la palabra siga entera */
  if(window.M && typeof M.ok === "function"){
    if(ok) M.ok(right, {haptic: true});
    else { const c = right.querySelector("svg.chk"); if(c) M.ok(c); }   /* solo se dibuja la ✓: la buena no salta */
  } else if(ok && window.G && typeof G.haptic === "function") G.haptic("success");
}
function feedback(pg, ok, missHtml, extra = ""){
  const fb = pg.querySelector(".ls-fb"); if(!fb) return;
  const t = ok ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : "";
  fb.classList.toggle("miss", !ok);
  fb.innerHTML = (ok ? `${ico("check-circle", "fill", 28)}<span>${t}</span>` : `<span>${missHtml}</span>`) + extra;
  announce(ok ? esc(t) : missHtml);
}
/* racha: el chip sale a los 3 aciertos seguidos y salta a los 3, 5 y 8; al fallar se va */
function streakUp(s, pg, ok){
  const card = pg.querySelector(".ls-card"); if(!card || card.classList.contains("ls-mhead")) return;   /* «Empareja»: sin sitio para el chip */
  let c = card.querySelector(".ls-streak");
  if(!ok || s.streak < 3){ if(c) c.remove(); return; }
  if(!c){ card.insertAdjacentHTML("afterbegin", streakHtml(s.streak)); c = card.querySelector(".ls-streak"); }
  else { c.querySelector("b").textContent = s.streak; c.setAttribute("aria-label", `${s.streak} seguidas`); }
  if([3, 5, 8].includes(s.streak)){
    announce(`¡${s.streak} seguidas!`);
    if(rm()) c.animate([{opacity: 0}, {opacity: 1}], {duration: 150, easing: "ease-out"});
    else c.animate([{scale: .3, opacity: 0}, {scale: 1.15, opacity: 1, offset: .6}, {scale: 1}], {duration: 460, easing: "cubic-bezier(.3,.7,.4,1)"});
  }
}
/* acertar: pasa sola cuando acaba el audio (como pronto a los 0,9 s); cap = tope por si el audio no acaba. Con una hoja
   abierta («¿Paramos aquí?») espera a que se cierre. */
function autoNext(s, idx, play, cap){
  const t0 = performance.now(); let fired = false;
  const go = () => {
    if(fired) return;
    if(!alive(s) || s.i !== idx){ fired = true; return; }
    if(sheetOpen()){ s.pend = go; return; }
    fired = true; next(idx);
  };
  setTimeout(() => {
    if(!alive(s) || s.i !== idx) return;
    Promise.resolve().then(play).catch(() => {}).then(() => setTimeout(go, Math.max(AFTER_AUDIO, MIN_WAIT - (performance.now() - t0))));
  }, 280);
  setTimeout(go, cap);
}

/* ---------- «Ordena las letras» ---------- */
function spellStep(s, st, idx, dir){
  const r = st.w.r, d = r.l[lang], lc = langCode(), sp = st.sp = spellOf(st.w), tok = s.tok;
  st.pos = 0; st.wrong = 0; st.right = sp.base;
  const tiles = tilesOf(sp), n = sp.L.length + (sp.art ? 1 : 0), es = inQ(r.es, st.w.doc);
  const pg = swap(`<div class="ls-page">
    <section class="card ls-card ls-q ls-spell">${chip(s)}${rvTag(st.w)}
      <p class="ls-tag">Ordena las letras</p>
      <div class="ls-pic">${pic(r)}</div>
      <div class="ls-spq"><h2 class="ls-ask"><q>${esc(es)}</q></h2><div class="ls-audio">${spkBtn(d.word)}</div></div>
      <div class="ls-sp${n >= 8 ? " is-many" : ""}" lang="${lc}">${sp.art ? `<span class="ls-sp-a">${esc(sp.art)}</span>` : ""}${sp.L.map((c, k) => `<span class="ls-slot${k ? "" : " is-next"}" aria-hidden="true"></span>`).join("")}</div>
    </section>
    <div class="ls-tiles${tiles.length >= 11 ? " is-11" : ""}" role="group" aria-label="Letras">${tiles.map(x =>
      `<button type="button" class="ls-tile" data-press="sink" data-ch="${esc(x.c)}" lang="${lc}">${esc(x.c)}</button>`).join("")}</div>
    <p class="ls-fb"></p></div>`, dir);
  announce(`Ordena las letras: ${esc(es)}${sp.art ? `. Ya está puesto ${inLang(sp.art)}` : ""}`);
  paintTop(idx); setGo(null); setPrev(false);
  pg.querySelectorAll(".ls-tile").forEach(b => b.addEventListener("click", () => spellTap(b)));
  setTimeout(() => { if(alive(s) && s.i === idx && autoTok === tok && !st.done && !sheetOpen()) sayP(d.word, pg.querySelector(".ls-spk")); }, dir ? 280 : 250);
}
/* la letra que sigue va a su hueco; otra se pone gris con ✗ un momento (sin temblor ni sonido) */
function spellTap(b){
  const s = LS, st = s && s.steps[s.i];
  if(!alive(s) || !st || st.t !== "spell" || st.done || !b || b.disabled || b.dataset.wait || b.classList.contains("is-used")) return;
  const pg = b.closest(".ls-page"), want = st.sp.L[st.pos], had = document.activeElement === b;
  if(NRM(b.dataset.ch) === NRM(want)){
    b.classList.add("is-used"); b.classList.remove("is-hint"); b.disabled = true;
    const sl = pg.querySelectorAll(".ls-slot");
    sl[st.pos].textContent = want; sl[st.pos].classList.remove("is-next");
    st.pos++;
    if(st.pos >= st.sp.L.length) return spellDone(s, st, pg);
    sl[st.pos].classList.add("is-next");
    if(st.wrong >= 2) hintTile(pg, st);
    announce(inLang(st.sp.L.slice(0, st.pos).join("")));
    if(had){ const t = pg.querySelector(".ls-tile:not(.is-used)"); if(t) t.focus({preventScroll: true}); }
    return;
  }
  st.wrong++;
  b.dataset.wait = "1"; b.classList.add("is-miss"); b.insertAdjacentHTML("beforeend", ico("x", "bold", 16, "xm"));
  setTimeout(() => { if(!b.isConnected) return; delete b.dataset.wait; b.classList.remove("is-miss"); const x = b.querySelector(".xm"); if(x) x.remove(); }, 650);
  if(st.wrong >= 2) hintTile(pg, st);
  announce("Esa no. Prueba con otra");
}
/* a los 2 fallos, la ficha que sigue se marca */
function hintTile(pg, st){
  pg.querySelectorAll(".ls-tile.is-hint").forEach(t => t.classList.remove("is-hint"));
  const want = NRM(st.sp.L[st.pos]), t = [...pg.querySelectorAll(".ls-tile:not(.is-used)")].find(t => NRM(t.dataset.ch) === want);
  if(t) t.classList.add("is-hint");
}
/* escrita entera: con 0 o 1 fallos es un acierto (pasa sola al acabar el audio); con 2 o más cuenta como fallada */
function spellDone(s, st, pg){
  st.done = true;
  const idx = s.i, r = st.w.r, d = r.l[lang], ok = st.wrong < 2, lc = langCode();
  grade(s, st, ok);
  const row = pg.querySelector(".ls-sp"), tray = pg.querySelector(".ls-tiles");
  row.classList.add("is-done"); tray.hidden = true;
  pg.querySelectorAll(".ls-tile").forEach(t => { t.disabled = true; });
  if(window.M && typeof M.ok === "function") M.ok(row, {haptic: ok});
  else if(ok && window.G && typeof G.haptic === "function") G.haptic("success");
  bus.emit("answer", {ok, es: r.es, word: d.word, where: "lesson"});
  lsSave(idx + 1); paintTop(idx + 1);
  const ipa = ipaHtml(d.ipa, lc);
  feedback(pg, ok, `¡Casi! Se escribe <b lang="${lc}">«${esc(clean(d.word))}»</b>`, ipa ? `<small class="ls-fb-ipa">${ipa}</small>` : "");
  showFb(pg); streakUp(s, pg, ok);
  setGo("Seguir", () => next(idx));
  if(kbdMode() || !document.activeElement || document.activeElement === document.body || tray.contains(document.activeElement)) $("#ls-go").focus({preventScroll: true});
  const spk = pg.querySelector(".ls-spk");
  if(ok) autoNext(s, idx, () => sayP(d.word, spk), 4500);
  else setTimeout(() => { if(alive(s) && s.i === idx) sayP(d.word, spk); }, 150);
}

/* ---------- «Completa la frase» ---------- */
function fillStep(s, st, idx, dir){
  const r = st.w.r, lc = langCode(), f = st.f = fillOf(st.w, s);
  st.right = f.right;
  const alt = [...mix(f.alt.filter(a => a.same)), ...mix(f.alt.filter(a => !a.same))].slice(0, 2).map(a => a.v);
  const list = mix([f.right, ...alt]).map(v => ({v, lang: lc}));
  const pre = f.ex.slice(0, f.at), post = f.ex.slice(f.at + f.len);
  const pg = swap(`<div class="ls-page">
    <section class="card ls-card ls-q ls-fill">${chip(s)}${rvTag(st.w)}
      <p class="ls-tag">Completa la frase</p>
      ${r.img ? `<div class="ls-pic">${pic(r)}</div>` : ""}
      <p class="ls-sent" lang="${lc}">${esc(pre)}<span class="ls-gap">____</span>${esc(post)}</p>
      ${r.img ? "" : `<p class="ls-tr ls-hint">Pista: <q>${esc(inQ(r.es, st.w.doc))}</q></p>`}
      <div class="ls-audio is-later" aria-hidden="true">${spkBtn(f.ex)}</div>
    </section>
    ${optsHtml(list)}
    <p class="ls-fb"></p></div>`, dir);
  announce(`Completa la frase: ${inLang(pre + "…" + post)}`);
  paintTop(idx); setGo(null); setPrev(false); fitOpts(pg);
  pg.querySelectorAll(".ls-opt").forEach(b => b.addEventListener("click", () => answer(b)));
}
/* contestada: el hueco con la palabra, la frase entera en voz alta y en español debajo */
function fillAnswered(s, st, idx, pg, ok, spk){
  const d = st.w.r.l[lang], f = st.f, lc = langCode();
  const gap = pg.querySelector(".ls-gap"); if(gap){ gap.textContent = f.ex.slice(f.at, f.at + f.len); gap.classList.add("ok"); }
  /* la IPA si el hueco es la palabra misma (no una forma: «dogs») */
  const same = NRM(f.right) === NRM(clean(d.word)) || NRM(f.right) === NRM(artSplit(clean(d.word))[1]);
  const ipa = same ? ipaHtml(d.ipa, lc) : "";
  feedback(pg, ok, `¡Casi! Es <b lang="${lc}">«${esc(st.right)}»</b>`, `${ipa ? `<small class="ls-fb-ipa">${ipa}</small>` : ""}${d.ex_es ? `<small lang="es">${esc(d.ex_es)}</small>` : ""}`);
  reveal(pg); showFb(pg); streakUp(s, pg, ok);
  setGo("Seguir", () => next(idx));
  if(kbdMode()) $("#ls-go").focus({preventScroll: true});
  if(ok) autoNext(s, idx, () => sayP(f.ex, spk), Math.min(9000, 2500 + f.ex.length * 90));
  else setTimeout(() => { if(alive(s) && s.i === idx) sayP(f.ex, spk); }, 150);
}

/* ---------- «Empareja» ---------- */
function matchStep(s, st, idx, dir){
  const lc = langCode(), ws = st.ws, P = mix(ws.map((_, j) => j)), Q = mix(ws.map((_, j) => j));
  st.got = 0; st.sel = null; st.right = null;
  const long = ws.some(w => [...w.r.l[lang].word].length > 10);
  const pg = swap(`<div class="ls-page">
    <section class="card ls-card ls-q ls-mhead">
      <p class="ls-tag">Empareja</p>
      <h2 class="ls-ask">Toca un dibujo y su palabra</h2>
    </section>
    <div class="ls-mt${long ? " is-long" : ""}" role="group" aria-label="Parejas">
      <div class="ls-mt-c">${P.map(j => `<button type="button" class="ls-mc has-img" data-side="p" data-m="${j}" data-press="sink" aria-label="${esc(ws[j].r.es)}" aria-pressed="false"><img src="${esc(ws[j].r.img)}" alt="" draggable="false"></button>`).join("")}</div>
      <div class="ls-mt-c">${Q.map(j => `<button type="button" class="ls-mc" data-side="w" data-m="${j}" data-press="sink" lang="${lc}" aria-pressed="false"><span class="ls-mc-w"><span class="ls-mc-t">${esc(ws[j].r.l[lang].word)}</span></span></button>`).join("")}</div>
    </div>
    <p class="ls-fb"></p></div>`, dir);
  announce("Empareja: toca un dibujo y luego su palabra");
  paintTop(idx); setGo(null); setPrev(false);
  pg.querySelectorAll(".ls-mc").forEach(b => b.addEventListener("click", () => matchTap(b)));
}
function matchTap(b){
  const s = LS, st = s && s.steps[s.i];
  if(!alive(s) || !st || st.t !== "match" || st.done || !b || b.disabled || b.dataset.wait) return;
  const pg = b.closest(".ls-page"), a = st.sel;
  const pick = (x, on) => { x.classList.toggle("is-sel", on); x.setAttribute("aria-pressed", String(on)); };
  if(!a || a === b || a.dataset.side === b.dataset.side){
    if(a) pick(a, false);
    st.sel = a === b ? null : b;
    if(st.sel) pick(b, true);
    return;
  }
  st.sel = null; pick(a, false);
  const j = +a.dataset.m, ok = j === +b.dataset.m, pair = [a, b];
  if(!ok){
    st.wrong = (st.wrong || 0) + 1;
    pair.forEach(x => { x.dataset.wait = "1"; x.classList.add("is-miss"); x.insertAdjacentHTML("afterbegin", ico("x", "bold", 22, "xm")); });
    announce("Esos dos no van juntos. Prueba otra vez");
    setTimeout(() => pair.forEach(x => { if(!x.isConnected) return; delete x.dataset.wait; x.classList.remove("is-miss"); const m = x.querySelector(".xm"); if(m) m.remove(); }), 700);
    return;
  }
  const w = st.ws[j], d = w.r.l[lang], had = pair.includes(document.activeElement);
  pair.forEach(x => { x.classList.add("is-ok"); x.disabled = true; x.removeAttribute("aria-pressed"); x.insertAdjacentHTML("afterbegin", CHK); });
  const wb = pair.find(x => x.dataset.side === "w"), ipa = ipaHtml(d.ipa, langCode());
  if(ipa) wb.querySelector(".ls-mc-w").insertAdjacentHTML("beforeend", ipa);
  if(window.M && typeof M.ok === "function") pair.forEach(x => M.ok(x));
  st.got++;
  bus.emit("answer", {ok: true, es: w.r.es, word: d.word, where: "lesson"});
  announce(`${inLang(d.word)}, ${esc(w.r.es)}. ¡Bien!`);
  if(st.got < st.ws.length){
    say1(d.word, null);
    if(had){ const nx = pg.querySelector(".ls-mc:not(:disabled)"); if(nx) nx.focus({preventScroll: true}); }
    return;
  }
  st.done = true;
  const idx = s.i; s.streak++;
  lsSave(idx + 1); paintTop(idx + 1);
  if(window.G && typeof G.haptic === "function") G.haptic("success");
  feedback(pg, true, "");
  showFb(pg); streakUp(s, pg, true);
  setGo("Seguir", () => next(idx));
  if(kbdMode() || had) $("#ls-go").focus({preventScroll: true});
  autoNext(s, idx, () => sayP(d.word, null), 4500);
}

/* ---------- gramática ---------- */
function theoryHtml(x){
  const lc = langCode();
  return `${(x.rules || []).map(r => `<div class="ls-rule"><h3>${esc(r.h)}</h3><p>${bold(r.p)}</p>
      ${r.tab ? `<table class="ls-tab">${r.tab.map(row => `<tr>${row.map(c => `<td>${bold(c)}</td>`).join("")}</tr>`).join("")}</table>` : ""}</div>`).join("")}
    ${(x.ex || []).length ? `<div class="ls-gex"><h3 class="ls-exs-t">Ejemplos</h3>${x.ex.map(e => `<p lang="${lc}">${esc(e.t)} <button type="button" class="say ls-exs" data-say="${esc(e.t)}" aria-label="Escuchar">${ico("speaker-high", "fill", 20)}</button><small lang="es">${esc(e.es)}</small></p>`).join("")}</div>` : ""}`;
}
function gStep(dir = 1){
  const s = LS; if(!s || s.ended || !s.g) return;
  const x = s.x;
  quiet(); s.tok = ++autoTok; s.pend = null;
  if(s.i < 0){
    swap(`<div class="ls-page"><section class="card ls-card ls-theory" aria-labelledby="ls-gt">
      <p class="ls-tag">${ico("book-open-text", "bold", 18)}Gramática · ${esc(s.lv)}</p>
      <h1 class="ls-gt" id="ls-gt">${esc(x.t)}</h1>${x.sum ? `<p class="ls-tr">${esc(x.sum)}</p>` : ""}
      <div class="ls-gbody">${theoryHtml(x)}</div></section></div>`, dir);
    paintTop(0); setPrev(false);
    setGo("Practicar", () => { if(LS === s && s.i < 0){ s.i = 0; gStep(1); } });
    return;
  }
  if(s.i >= s.steps.length) return lsEnd();
  const st = s.steps[s.i], q = st.q, idx = s.i;
  st.done = false;
  const [pre, post] = String(q.s).split("___"), full = String(q.s).replace("___", q.o[q.a]);
  const pg = swap(`<div class="ls-page">
    <section class="card ls-card ls-q ls-gq">${chip(s)}
      <p class="ls-tag">Completa la frase</p>
      <p class="ls-sent" lang="${langCode()}">${esc(pre)}<span class="ls-gap">____</span>${esc(post ?? "")}</p>
      <div class="ls-audio is-later" aria-hidden="true">${spkBtn(full)}</div>
    </section>
    ${optsHtml(q.o.map(o => ({v: o, lang: langCode()})))}
    <p class="ls-fb"></p></div>`, dir);
  announce(`Completa la frase: ${inLang(String(q.s).replace("___", "…"))}`);
  paintTop(idx); setGo(null); setPrev(false); fitOpts(pg);
  pg.querySelectorAll(".ls-opt").forEach(b => b.addEventListener("click", () => gAnswer(b)));
}
function gAnswer(b){
  const s = LS, st = s && s.steps[s.i];
  if(!alive(s) || !s.g || !st || st.done || !b || b.disabled) return;
  st.done = true;
  const q = st.q, idx = s.i, pg = b.closest(".ls-page"), opts = [...pg.querySelectorAll(".ls-opt")];
  const ok = +b.dataset.k === q.a, right = opts[q.a] || b, key = q.s, rw = q.o[q.a];
  if(ok){ if(!s.miss.has(key)) s.first.add(key); s.streak++; }
  else { s.miss.add(key); s.steps.push({t: "gq", q, re: true}); s.streak = 0; }
  marks(opts, right, b, ok);
  bus.emit("answer", {ok, where: "grammar"});
  lsSave(idx + 1); paintTop(idx + 1);
  const gap = pg.querySelector(".ls-gap"); if(gap){ gap.textContent = rw; gap.classList.add("ok"); }
  reveal(pg);
  const extra = `${q.es ? `<small lang="es">${esc(q.es)}</small>` : ""}${!ok && q.why ? `<small class="ls-why">${ico("lightbulb", "bold", 18)}<span>${bold(q.why)}</span></small>` : ""}`;
  feedback(pg, ok, `¡Casi! Es <b lang="${langCode()}">«${esc(rw)}»</b>`, extra);
  showFb(pg);
  streakUp(s, pg, ok);
  setGo("Seguir", () => next(idx));
  if(kbdMode()) $("#ls-go").focus({preventScroll: true});
  const full = String(q.s).replace("___", rw), spk = pg.querySelector(".ls-spk");
  if(ok) autoNext(s, idx, () => sayP(full, spk), Math.min(9000, 2500 + full.length * 90));
  else setTimeout(() => { if(alive(s) && s.i === idx) sayP(full, spk); }, 150);
}

/* ---------- fin de lección ---------- */
/* la siguiente: la de después en el nivel o, al acabar el nivel, la primera del siguiente */
function nextOf(lv, k){
  const ls = lvLessons(lv); if(ls[k + 1]) return ls[k + 1];
  const keys = Object.keys(LVS), j = keys.indexOf(lv);
  for(const nl of keys.slice(j + 1)) if(MAP && MAP[nl]){ const l2 = lvLessons(nl); if(l2.length) return l2[0]; }
  return null;
}
function lsEnd(){
  const s = LS; if(!s || s.ended) return;
  if(s.ut) return utEnd(s);
  if(s.fix) return fixEnd(s);
  s.ended = true; s.pend = null; quiet();
  offs.splice(0).forEach(f => { try{ f(); }catch(e){} });
  clearSaved();
  const acc = s.nq ? s.first.size / s.nq : 1, stars = acc >= .9 ? 3 : acc >= .6 ? 2 : 1;
  const P = mapP(); const prev = P[s.id] || 0; P[s.id] = Math.max(prev, stars); store.set("map:" + lang, P);
  const coins = prev ? 5 : 10 + 5 * stars;
  const ls = lvLessons(s.lv), k = ls.findIndex(l => l.id === s.id), nxt = nextOf(s.lv, k);
  const lvDone = ls.every(l => P[l.id]);
  $("#app").innerHTML = `<div class="ls ls-end" style="--lc:${LVS[s.lv] ? LVS[s.lv].c : ""}" data-key-own>
    <section class="card ls-card" aria-labelledby="ls-end-t">
      <div class="ls-fox">${heroHtml(96)}</div>
      <h1 class="ls-end-t" id="ls-end-t">${lvDone && !prev ? `¡Nivel ${esc(s.lv)} completado!` : "¡Lección completada!"}</h1>
      <div class="ls-stars" role="img" aria-label="${stars} de 3 estrellas">${[0, 1, 2].map(i => `<span class="ls-star${i < stars ? " got" : ""}">${ico("star", "fill", 48)}</span>`).join("")}</div>
      <div class="ls-earn" id="ls-plus" aria-label="${coins} monedas">${COIN}<span>+${coins}</span></div>
      <p class="ls-tmr"></p>
      ${fixable(s) ? `<button type="button" class="ls-fixb" id="ls-fix">${ico("arrows-clockwise", "bold", 20)}Repasa tus fallos</button>` : ""}
      <div class="ctrl ls-extra"></div>
    </section>
    <div class="ls-dock">
      <button type="button" class="glass-btn glass-btn--lg ls-rep" id="ls-rep">${ico("arrow-counter-clockwise", "bold", 20)}Repetir</button>
      ${nxt ? `<a class="glass-btn glass-btn--pri glass-btn--lg ls-go" id="ls-next" href="#/leccion/${esc(nxt.id)}" data-key="enter">Siguiente lección</a>` : ""}
    </div></div>`;
  const fx = $("#fx-x"); if(fx) fx.setAttribute("href", "#/mapa/" + s.lv);
  if(scrollY > 0) scrollTo(0, 0);
  /* lo de siempre: camino, monedas, repaso y actividad. Al repaso: las falladas a la caja 0 (hoy) y las demás a la 1
     (mañana); si dos de la lección comparten su clave del repaso (tema|español), manda la fallada */
  award(coins, "", false, $("#ls-plus"));   /* sin aviso: el «+N» ya está en la tarjeta */
  if(!s.g){
    const bad = {}, good = {};
    for(const w of s.words) ((s.miss.has(w.k) ? bad : good)[w.doc] = (s.miss.has(w.k) ? bad : good)[w.doc] || []).push(w.r);
    for(const [d, rows] of Object.entries(bad)) srsAdd(d, rows, 0);
    for(const [d, rows] of Object.entries(good)){
      const out = new Set((bad[d] || []).map(r => r.es)), rest = rows.filter(r => !out.has(r.es));
      if(rest.length) srsAdd(d, rest, 1);
    }
  }
  logAct(s.words.length || s.nq); updBadge();
  /* «Mañana repasas estas 8 palabras»: solo las de esta lección que vuelven mañana (no todo el repaso) */
  const t1 = today() + 1, all = srsAll(), W = s.words.length;
  const due1 = s.words.filter(w => { const x = all[srsK(w.doc, w.r)]; return x && x.due === t1; }).length;
  if(due1) $(".ls-end .ls-tmr").textContent = due1 === W ? (W === 1 ? "Mañana repasas esta palabra" : `Mañana repasas estas ${W} palabras`)
    : `Mañana repasas ${due1 === 1 ? "1 de estas palabras" : due1 + " de estas palabras"}`;
  bus.emit("lesson-done", {id: s.id, lv: s.lv, stars, first: !prev, grammar: !!s.g, words: s.words.map(w => ({doc: w.doc, es: w.r.es, word: w.r.l[lang].word}))});
  announce(`¡Lección completada! ${stars} de 3 estrellas y ${coins} monedas.`);
  /* las estrellas, de una en una cada 150 ms, cada una con una nota más aguda */
  const els = [...document.querySelectorAll(".ls-end .ls-star")];
  els.forEach((el, i) => setTimeout(() => {
    if(!el.isConnected) return;
    el.classList.add("on");
    if(i < stars) note(i * 2 + 1);
  }, 180 + 150 * i));
  $("#ls-rep").addEventListener("click", () => { if(LS === s){ LS = null; if(typeof updFocus === "function") updFocus(); leccion(s.id); } });
  const fb = $("#ls-fix"); if(fb) fb.addEventListener("click", () => { if(LS === s) startFix(s); });
  /* un doble toque en «Seguir» (justo en el sitio de «Siguiente lección») no se salta el final: los botones no responden
     hasta que salen las estrellas */
  const dock = $(".ls-end .ls-dock");
  if(dock){ dock.inert = true; setTimeout(() => { if(dock.isConnected) dock.inert = false; }, rm() ? 300 : 700); }
  if(fb){ fb.inert = true; setTimeout(() => { if(fb.isConnected) fb.inert = false; }, rm() ? 300 : 700); }
  document.onkeydown = onKey;
  setTimeout(giftCheck, 1500);
}

/* ---------- «Repasa tus fallos»: solo las falladas (las nuevas y las de repaso), otra vez como preguntas ---------- */
const fixWords = s => s.g ? [] : [...s.words.filter(w => s.miss.has(w.k)), ...s.rvw.filter(w => s.rvMiss.has(w.k))];
const fixable = s => !s.fix && !s.ut && fixWords(s).length > 0;
function startFix(s){
  const ws = fixWords(s); if(!ws.length) return;
  quiet();
  LS = fresh({id: s.id, lv: s.lv, unit: s.unit, words: ws, pool: s.pool, more: s.more, nq: ws.length, fix: true});
  LS.steps = mix(ws).map((w, j) => ({t: j % 2 ? "listen" : "pick", w}));
  mount(); lsStep(0);
}
/* sin estrellas ni monedas: el zorro, «¡Fallos repasados!» y lo de abajo como en el final de la lección */
function fixEnd(s){
  s.ended = true; s.pend = null; quiet();
  offs.splice(0).forEach(f => { try{ f(); }catch(e){} });
  const n = s.words.length, ls = lvLessons(s.lv), k = ls.findIndex(l => l.id === s.id), nxt = nextOf(s.lv, k);
  $("#app").innerHTML = `<div class="ls ls-end ls-fixend" style="--lc:${LVS[s.lv] ? LVS[s.lv].c : ""}" data-key-own>
    <section class="card ls-card" aria-labelledby="ls-end-t">
      <div class="ls-fox">${heroHtml(96)}</div>
      <h1 class="ls-end-t" id="ls-end-t">¡Fallos repasados!</h1>
      <p class="ls-end-s">${n === 1 ? "Ya sabes la palabra que fallaste" : `Ya sabes las ${n} palabras que fallaste`}</p>
    </section>
    <div class="ls-dock">
      <button type="button" class="glass-btn glass-btn--lg ls-rep" id="ls-rep">${ico("arrow-counter-clockwise", "bold", 20)}Repetir</button>
      ${nxt ? `<a class="glass-btn glass-btn--pri glass-btn--lg ls-go" id="ls-next" href="#/leccion/${esc(nxt.id)}" data-key="enter">Siguiente lección</a>` : ""}
    </div></div>`;
  const fx = $("#fx-x"); if(fx) fx.setAttribute("href", "#/mapa/" + s.lv);
  if(scrollY > 0) scrollTo(0, 0);
  announce("¡Fallos repasados!");
  [0, 2, 4].forEach((n, i) => setTimeout(() => note(n), 150 * i));
  if(window.G && typeof G.haptic === "function") G.haptic("success");
  $("#ls-rep").addEventListener("click", () => { if(LS === s){ LS = null; if(typeof updFocus === "function") updFocus(); leccion(s.id); } });
  const dock = $(".ls-end .ls-dock");
  if(dock){ dock.inert = true; setTimeout(() => { if(dock.isConnected) dock.inert = false; }, rm() ? 300 : 700); }
  document.onkeydown = onKey;
}

/* ---------- «¿Ya lo sabes?» de una unidad (#/leccion/<nivel>-U<nn>) ---------- */
const UT_N = 12, UT_OK = 10;
/* la unidad (1 = la primera) y sus lecciones de vocabulario, o null */
function utUnit(lv, ui){
  if(!MAP || !MAP[lv]) return null;
  const u = lvUnits(lv)[ui - 1]; if(!u) return null;
  const ls = u.ls.filter(l => Array.isArray(l.w) && l.w.length);
  return ls.length ? {u, ls} : null;
}
/* se ofrece (js/learn.js) al empezar una unidad con vocabulario: ninguna de sus lecciones hecha */
function unitTestable(lv, ui){ const x = utUnit(lv, ui), P = mapP(); return !!x && !x.u.ls.some(l => P[l.id]); }
async function unitTest(id){
  const lv = id.slice(0, 2), ui = parseInt(id.slice(4), 10), x = utUnit(lv, ui);
  if(!x){ location.replace("#/mapa" + (MAP && MAP[lv] ? "/" + lv : "")); return; }
  const docs = {}; for(const l of x.ls) for(const [d] of l.w) if(!docs[d]) docs[d] = await getDoc(d);
  if(hashPath() !== "leccion/" + id) return;
  /* las palabras de la unidad, sin repetir; 12 repartidas entre sus lecciones, con dibujo si puede ser */
  const all = [], tws = new Set();
  for(const l of x.ls){
    const ws = [];
    for(const [d, i] of l.w){
      const r = docs[d].rows[i]; if(!r || !r.l || !r.l[lang] || !r.l[lang].word) continue;
      const w = {doc: d, i, r, k: d + ":" + i}, t = tw(w); if(tws.has(t)) continue;
      tws.add(t); ws.push(w);
    }
    all.push(ws);
  }
  const flat = all.flat(); if(flat.length < 4){ location.replace("#/mapa/" + lv); return; }
  const lanes = all.map(ws => [...mix(ws.filter(w => w.r.img)), ...mix(ws.filter(w => !w.r.img))]), pick = [];
  for(let k = 0; pick.length < Math.min(UT_N, flat.length); k++) for(const ln of lanes) if(ln[k] && pick.length < UT_N) pick.push(ln[k]);
  const {pool, more} = pools(flat, docs, x.u.doc);
  LS = fresh({id, lv, unit: x.u, words: pick, pool, more, nq: pick.length,
    ut: {ui, ls: x.ls.map(l => l.id), rows: flat}, right: 0});
  LS.steps = mix(pick).map(w => ({t: "pick", w}));
  mount(); lsStep(0);
}
/* el final: con 10 o más, 1 estrella en cada lección de vocabulario de la unidad (si no tenía más) y sus palabras al
   repaso en la caja 2; con menos, no cambia nada */
function utEnd(s){
  s.ended = true; s.pend = null; quiet();
  offs.splice(0).forEach(f => { try{ f(); }catch(e){} });
  const n = s.nq, need = Math.min(UT_OK, Math.ceil(n * UT_OK / UT_N)), pass = s.right >= need;
  let coins = 0, fresh1 = 0;
  if(pass){
    const P = mapP();
    for(const id of s.ut.ls) if(!P[id]){ P[id] = 1; fresh1++; }
    store.set("map:" + lang, P);
    const by = {}; for(const w of s.ut.rows) (by[w.doc] = by[w.doc] || []).push(w.r);
    for(const [d, rows] of Object.entries(by)) srsAdd(d, rows, 2);
    coins = Math.min(15, 5 * fresh1);   /* un poco, como al repetir una lección: las monedas, sobre todo aprendiendo */
    logAct(n); updBadge();
  }
  const ls = lvLessons(s.lv), P2 = mapP(), cur = ls[lvCur(s.lv, P2)], first = ls.find(l => l.id === s.ut.ls[0]);
  const go = pass ? cur : first, nl = s.ut.ls.length;
  $("#app").innerHTML = `<div class="ls ls-end ls-utend" style="--lc:${LVS[s.lv] ? LVS[s.lv].c : ""}" data-key-own>
    <section class="card ls-card" aria-labelledby="ls-end-t">
      <div class="ls-fox">${heroHtml(96)}</div>
      <h1 class="ls-end-t" id="ls-end-t">${pass ? "¡Ya lo sabes!" : "¡Buen intento!"}</h1>
      <p class="ls-end-s">Acertaste ${s.right} de ${n}.</p>
      ${pass ? `<div class="ls-stars" role="img" aria-label="1 estrella">${`<span class="ls-star got on">${ico("star", "fill", 48)}</span>`}</div>
        <p class="ls-end-s">${nl === 1 ? "La lección de esta unidad ya tiene su estrella" : `Las ${nl} lecciones de esta unidad ya tienen su estrella`}</p>
        ${coins ? `<div class="ls-earn" id="ls-plus" aria-label="${coins} monedas">${COIN}<span>+${coins}</span></div>` : ""}`
      : `<p class="ls-end-s">Empieza por la primera lección: ¡vas a ir muy rápido!</p>`}
    </section>
    <div class="ls-dock">
      ${go ? `<a class="glass-btn glass-btn--pri glass-btn--lg ls-go" id="ls-next" href="#/leccion/${esc(go.id)}" data-key="enter">${pass ? "Siguiente lección" : "Empezar la lección"}</a>`
        : `<a class="glass-btn glass-btn--pri glass-btn--lg ls-go" id="ls-next" href="#/mapa/${esc(s.lv)}" data-key="enter">Al camino</a>`}
    </div></div>`;
  const fx = $("#fx-x"); if(fx) fx.setAttribute("href", "#/mapa/" + s.lv);
  if(scrollY > 0) scrollTo(0, 0);
  if(coins) award(coins, "", false, $("#ls-plus"));
  if(pass){ [0, 2, 4].forEach((k, i) => setTimeout(() => note(k), 150 * i)); if(window.G && typeof G.haptic === "function") G.haptic("success"); }
  announce(pass ? `¡Ya lo sabes! Acertaste ${s.right} de ${n}.` : `¡Buen intento! Acertaste ${s.right} de ${n}.`);
  const dock = $(".ls-end .ls-dock");
  if(dock){ dock.inert = true; setTimeout(() => { if(dock.isConnected) dock.inert = false; }, rm() ? 300 : 700); }
  document.onkeydown = onKey;
}

/* ---------- «¿Paramos aquí?» ---------- */
const PZ = {d: null, back: false, exit: false};
function pauseSheet(){
  if(PZ.d && PZ.d.isConnected) return PZ.d;
  const d = document.createElement("dialog");
  d.id = "ls-pause"; d.className = "ls-pz-d"; d.setAttribute("aria-labelledby", "ls-pz-t");
  d.dataset.noRenew = ""; d.dataset.noHint = "";
  document.body.appendChild(d);
  d.addEventListener("click", e => {
    if(e.target.closest("#ls-pz-go")) closePause();
    else if(e.target.closest("#ls-pz-out")){ PZ.exit = true; const viaBack = PZ.back; try{ d.close(); }catch(_){} exit(viaBack); }
  });
  d.addEventListener("close", () => {
    const s = LS, wasExit = PZ.exit; PZ.exit = false; PZ.back = false;
    if(wasExit || !s || d.open) return;
    if(s.pend){ const f = s.pend; s.pend = null; setTimeout(f, 250); }
  });
  PZ.d = d;
  return d;
}
function closePause(){
  const d = PZ.d; if(!d || !d.open) return;
  if(window.M && typeof M.closeSheet === "function" && d.classList.contains("m-sheet")) M.closeSheet(d); else d.close();
}
/* abre la hoja (from: el botón desde el que sube; viaBack: viene de Atrás del navegador, y «Salir» vuelve allí) */
function ask(from, viaBack){
  const s = LS; if(!s || s.ended) return false;
  const d = pauseSheet();
  PZ.back = PZ.back || !!viaBack;
  if(d.open) return true;
  const how = document.getElementById("ls-how"); if(how && how.open){ try{ how.close(); }catch(e){} }   /* una hoja cada vez */
  const left = Math.max(0, s.steps.length - Math.max(0, s.i) - (s.steps[s.i] && s.steps[s.i].done ? 1 : 0));
  d.innerHTML = `<div class="ls-pz">
    <span class="ls-pz-ic" aria-hidden="true">${ico("pause", "bold", 28)}</span>
    <h2 class="ls-pz-t" id="ls-pz-t">¿Paramos aquí?</h2>
    <p class="ls-pz-s">${left <= 3 && s.i > 0 ? "¡Ya casi la terminas!" : `Te ${left === 1 ? "queda 1 tarjeta" : `quedan ${left} tarjetas`}`}</p>
    <div class="ls-pz-b">
      <button type="button" class="glass-btn glass-btn--lg" id="ls-pz-out">Salir</button>
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="ls-pz-go" data-key="enter" autofocus>Seguir</button>
    </div></div>`;
  quiet();
  try{
    if(window.M && typeof M.openSheet === "function") M.openSheet(d, {from: from && from.nodeType === 1 ? from : null});
    else d.showModal();
  }catch(e){ try{ d.showModal(); }catch(e2){ d.setAttribute("open", ""); } }
  return true;
}
/* «Salir»: se va a donde estaba el niño (la ✕ de verdad) o adonde iba (Atrás). Lo hecho se queda en "vocab:ls" para
   seguir luego con la cápsula «Seguir · Lección N» o con «Seguir» en Hoy (plan-doc §Lección); se borra al terminarla. */
function exit(viaBack){
  const s = LS; LS = null; document.onkeydown = null;
  offs.splice(0).forEach(f => { try{ f(); }catch(e){} });
  refreshAcc();
  if(viaBack){ try{ history.back(); }catch(e){} return; }
  const x = document.getElementById("fx-x");
  if(x && x.isConnected){ PASS = true; try{ x.click(); }finally{ PASS = false; } }
  else navTo("#/mapa" + (s ? "/" + s.lv : ""));
}
/* guarda de salida: route() pregunta antes de pintar. true = se queda en la lección (y pregunta) */
function blocks(hp){
  const s = LS;
  if(!s || s.ended || !s.saved || hp === pathOf(s) || !document.querySelector("#app .ls")) return false;
  try{ history.pushState(s.hs && typeof s.hs === "object" ? s.hs : history.state, "", "#/" + pathOf(s)); }catch(e){ return false; }
  ask(null, true);
  return true;
}

/* la ✕ del modo foco: con algo hecho abre «¿Paramos aquí?»; en el final, vuelve al camino; en la primera tarjeta, sin
   nada que perder, sale sin preguntar (el manejador de index.html: a donde estaba el niño) */
document.addEventListener("click", e => {
  if(PASS) return;
  const x = e.target && e.target.closest ? e.target.closest("#fx-x") : null; if(!x) return;
  const s = LS; if(!s || ROOT.dataset.focus !== "leccion" || hashPath() !== pathOf(s)) return;
  if(!s.ended && !s.saved){ quiet(); return; }
  e.preventDefault(); e.stopImmediatePropagation();
  if(s.ended) navTo("#/mapa/" + s.lv); else ask(x);
}, true);

/* teclado: Enter = el botón de abajo · Espacio = oír (Mayús, despacio) · 1-4 = responder · ← → = anterior y siguiente
   palabra nueva · Esc = «¿Paramos aquí?» (en el final, al camino). Las etiquetas de las teclas (html[data-kbd], que lee
   kbdMode()) las pone js/keys.js con la primera tecla y las quita al tocar la pantalla; .ls lleva data-key-own: estas
   teclas son de la lección y keys.js solo enseña las etiquetas de sus data-key. */
function onKey(e){
  const s = LS; if(!s || hashPath() !== pathOf(s)) return;
  if(e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || sheetOpen()) return;
  const t = e.target, tag = t && t.tagName;
  if(tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
  const onCtl = !!(t && t !== document.body && t.closest && t.closest("button,a[href],summary,input"));
  if(e.key === "Escape"){
    e.preventDefault();
    if(s.ended) navTo("#/mapa/" + s.lv);
    else if(s.saved) ask($("#fx-x"));   /* «¿Paramos aquí?» nace de la ✕, como al tocarla */
    else { const x = $("#fx-x"); if(x) x.click(); }   /* nada hecho aún: como la ✕ */
    return;
  }
  if(s.ended){
    if(e.key === "Enter" && !onCtl){ const n = $("#ls-next"); if(n){ e.preventDefault(); n.click(); } }
    return;
  }
  const st = s.steps[s.i], pg = page();
  if(e.key === "Enter"){
    if(onCtl) return;
    const go = $("#ls-go"); if(go && !go.hidden){ e.preventDefault(); go.click(); }
    return;
  }
  if(e.key === " " || e.code === "Space"){
    if(onCtl) return;
    const spk = pg && pg.querySelector(".ls-audio:not(.is-later) .ls-spk");
    if(spk){ e.preventDefault(); say1(spk.dataset.say, spk, e.shiftKey); }
    return;
  }
  /* «Ordena las letras»: la tecla de una letra toca su ficha */
  if(st && st.t === "spell" && !st.done && pg && e.key.length === 1 && /\p{L}/u.test(e.key)){
    const b = [...pg.querySelectorAll(".ls-tile:not(.is-used)")].find(t => !t.dataset.wait && NRM(t.dataset.ch) === NRM(e.key));
    if(b){ e.preventDefault(); b.click(); }
    return;
  }
  if(/^[1-4]$/.test(e.key) && st && st.t !== "learn" && !st.done && pg){
    const b = pg.querySelectorAll(".ls-opt")[+e.key - 1];
    if(b){ e.preventDefault(); b.click(); }
    return;
  }
  if(st && st.t === "learn"){
    if(e.key === "ArrowRight"){ e.preventDefault(); next(s.i); }
    else if(e.key === "ArrowLeft"){ e.preventDefault(); back(); }
  }
}

/* ---------- «Cómo suena»: la palabra en sílabas y el audio lento ---------- */
/* sílabas con reglas sencillas por idioma (en, fr, da): núcleos de vocales; entre dos, una consonante va con la
   siguiente y de un grupo se queda el arranque que se puede decir junto (bl, tr, ch…); la «e» muda del final (inglés y
   francés) no cuenta. Es una ayuda para oír, no una regla de ortografía. */
const VOW = {en: "aeiouyàâäéèêëîïôöùûü", fr: "aeiouyàâäéèêëîïôöùûüÿœæ", da: "aeiouyæøåéáóü"};
const ONSET = {
  en: new Set(["bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "sc", "sk", "sl", "sm", "sn", "sp", "st", "sw", "tr", "tw", "th", "sh", "ch", "ph", "wh", "wr", "kn", "qu"]),
  fr: new Set(["bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "vr", "ch", "ph", "th", "gn", "qu", "gu"]),
  da: new Set(["bl", "br", "dr", "fl", "fr", "gl", "gr", "kl", "kn", "kr", "pl", "pr", "sk", "sl", "sm", "sn", "sp", "st", "sv", "tr", "tv"]),
};
const CODA = {en: new Set(["ck", "ng", "gh", "tch", "dg"]), fr: new Set(), da: new Set(["ng"])};
function sylWord(w, l){
  const lw = w.toLowerCase(), V = VOW[l] || VOW.en, n = lw.length;
  const isV = i => {
    const c = lw[i]; if(!c || !V.includes(c)) return false;
    if(c === "u" && i > 0 && (lw[i - 1] === "q" || (lw[i - 1] === "g" && l !== "da" && "eiéèêy".includes(lw[i + 1] || "")))) return false;
    if(c === "y" && l !== "da" && (i === 0 || V.includes(lw[i + 1] || "") && lw[i + 1] !== "y")) return false;
    return true;
  };
  const nuc = []; for(let i = 0; i < n; i++) if(isV(i)){ const a = i; while(i + 1 < n && isV(i + 1)) i++; nuc.push([a, i + 1]); }
  if(nuc.length < 2) return [w];
  /* «e» muda al final: en inglés y francés (en inglés no en «-le» tras consonante: ta·ble) */
  const last = nuc[nuc.length - 1], tail = lw.slice(last[0]);
  const consBefore = last[0] > 0 && !isV(last[0] - 1);
  let mute = false;
  if((l === "en" || l === "fr") && consBefore && (tail === "e" || (l === "fr" && tail === "es") || (l === "en" && tail === "es" && !/(s|x|z|ch|sh|ge|ce)es$/.test(lw)) || (l === "en" && tail === "ed" && !/[td]ed$/.test(lw))))
    mute = !(l === "en" && tail === "e" && /[^aeiouyl]le$/.test(lw));
  if(mute) nuc.pop();
  if(nuc.length < 2) return [w];
  const cuts = [];
  for(let k = 0; k < nuc.length - 1; k++){
    const a = nuc[k][1], b = nuc[k + 1][0], cl = lw.slice(a, b);
    let at;
    if(cl.length <= 1) at = a;
    else if(CODA[l] && CODA[l].has(cl)) at = b;
    else if(ONSET[l] && ONSET[l].has(cl.slice(-2)) && !(cl.length === 2 && cl[0] === cl[1])) at = b - 2;
    else at = b - 1;
    if(cl.length >= 3 && ONSET[l] && ONSET[l].has(cl.slice(-2)) && CODA[l] && CODA[l].has(cl.slice(0, -2))) at = b - 2;
    cuts.push(at);
  }
  const out = []; let p = 0;
  for(const c of cuts){ if(c > p && c < n){ out.push(w.slice(p, c)); p = c; } }
  out.push(w.slice(p));
  return out.filter(Boolean);
}
/* el texto (puede llevar artículo: «le chien», «en hund») → [[sílabas de cada palabra]] */
function syllables(text, l){
  l = (l || lang2()).slice(0, 2);
  return String(text || "").trim().split(/\s+/).filter(Boolean).map(tok => {
    /* l'éléphant: el apóstrofo va con lo de delante */
    const m = /^(\p{L}+['’])(\p{L}.*)$/u.exec(tok);
    if(m) return [m[1], ...sylWord(m[2], l)].reduce((a, x, i) => i === 1 ? [a[0] + x] : [...a, x], [m[1]]).filter(Boolean);
    return tok.split(/(-)/).flatMap(part => part === "-" ? [] : sylWord(part, l)).filter(Boolean);
  });
}
function sylHtml(text){
  return syllables(text).map(ws => `<span class="w">${ws.map(sy => `<span class="sy">${esc(sy)}</span>`).join(`<span class="dot" aria-hidden="true">·</span>`)}</span>`).join("");
}
let howT = [];
function lightSyl(d){
  howT.forEach(clearTimeout); howT = [];
  const sy = [...d.querySelectorAll(".ls-syl .sy")];
  sy.forEach(x => x.classList.remove("on"));
  if(sy.length < 2) return;   /* con «Reducir movimiento» también: es una ayuda para leer, no una animación */
  const step = 420;
  sy.forEach((x, i) => {
    howT.push(setTimeout(() => { sy.forEach(y => y.classList.remove("on")); x.classList.add("on"); }, 120 + i * step));
  });
  howT.push(setTimeout(() => sy.forEach(y => y.classList.remove("on")), 120 + sy.length * step + 200));
}
function openHow(from){
  const s = LS, st = s && !s.g && s.steps[s.i]; if(!alive(s) || !st || st.t !== "learn") return;
  const d0 = st.w.r.l[lang], word = d0.word, lc = langCode();
  const nrm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zæøå]/g, "");
  const pron = d0.pron && nrm(d0.pron) !== nrm(word) ? d0.pron : "";
  let d = document.getElementById("ls-how");
  if(!d){
    d = document.createElement("dialog"); d.id = "ls-how"; d.className = "ls-how-d"; d.setAttribute("aria-labelledby", "ls-how-t");
    d.dataset.noHint = ""; d.dataset.noRenew = "";
    document.body.appendChild(d);
    d.addEventListener("click", e => {
      if(e.target.closest("[data-close]")){ if(window.M && typeof M.closeSheet === "function" && d.classList.contains("m-sheet")) M.closeSheet(d); else d.close(); }
      else if(e.target.closest(".ls-how-go")) lightSyl(d);
    });
    d.addEventListener("close", () => { howT.forEach(clearTimeout); howT = []; quiet(); });
  }
  d.innerHTML = `<div class="ls-how">
    <h2 class="ls-how-t" id="ls-how-t">Cómo suena</h2>
    <div class="ls-syl" lang="${lc}" aria-label="${esc(word)}">${sylHtml(word)}</div>
    ${pron ? `<p class="ls-how-p">Se dice «<b>${esc(pron)}</b>»</p>` : ""}
    ${ipaOn() && d0.ipa ? `<p class="ls-how-ipa">${ipaHtml(d0.ipa, lc)}</p>` : ""}
    <div class="ls-how-b">
      <button type="button" class="glass-btn glass-btn--lg" data-close>Listo</button>
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg ls-how-go" data-say="${esc(word)}" data-slow autofocus>${ico("turtle", "fill", 22)}Otra vez</button>
    </div></div>`;
  quiet();
  try{
    if(window.M && typeof M.openSheet === "function") M.openSheet(d, {from: from && from.nodeType === 1 ? from : null});
    else d.showModal();
  }catch(e){ try{ d.showModal(); }catch(e2){ d.setAttribute("open", ""); } }
  setTimeout(() => { if(d.open){ say1(word, d.querySelector(".ls-how-go"), true); lightSyl(d); } }, 220);
}

/* al salir de la ruta de la lección (sin estar empezada, o ya terminada), la lección deja de estar en marcha; las hojas
   («¿Paramos aquí?», «Cómo suena») se cierran y se calla */
bus.on("route", d => {
  const h = String((d && d.h) || "").split("?")[0];
  if(LS && h !== pathOf(LS)){ LS = null; offs.splice(0).forEach(f => { try{ f(); }catch(e){} }); }
  if(PZ.d && PZ.d.open && !LS){ PZ.exit = true; try{ PZ.d.close(); }catch(e){} }
  const how = document.getElementById("ls-how");
  if(how && how.open && !LS){ try{ how.close(); }catch(e){} quiet(); }
  /* la primera palabra se pinta antes del modo foco (sin la barra de pestañas ni la de arriba): se vuelve a medir */
  if(LS && !LS.ended) requestAnimationFrame(() => fitIpa(page()));
});

css();
window.leccion = leccion; window.lsStep = lsStep; window.lsEnd = lsEnd; window.gramLesson = gramLesson; window.gStep = gStep;
window.vocabLesson = {get state(){ return LS; }, saved, blocks, ask, syllables, spellOf, fillOf: w => fillOf(w), unitTestable};
})();
