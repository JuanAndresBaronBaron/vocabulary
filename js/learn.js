/* Módulo learn: Aprender › Camino, Palabras, la ficha de un tema y Gramática.
   Rutas (las registra en ROUTES; route() de index.html las llama con los trozos de la ruta, también al cargar la URL):
   - #/mapa y #/mapa/<nivel> → mapa(lv): el camino del nivel. Arriba la pastilla de nivel (levelPicker), el nombre del
     nivel con «N de M» y, si hay regalo cada 5 lecciones, una fila neutra «Regalo en 3 lecciones» con 5 puntos. Nodos
     limpios: hecho en --ok-fill con ✓ y sus estrellas en oro, el actual en --brand-fill (con el zorro de js/buddy.js al
     lado), bloqueado en gris; la gramática en cuadrado redondeado. Tocar un nodo abre la lección (bloqueado: aviso
     amable); mantener pulsado uno hecho (G.hold) abre el vistazo: hoja pequeña con «Unidad N · tema», sus estrellas,
     sus palabras y «Repetir». Si la lección actual no se ve, la pastilla flotante «Mi lección» (↓ o ↑) baja o sube hasta ella con
     scroll suave. Al entrar por la pestaña no se mueve (se ven el título y los segmentos); con un nivel en la ruta o al
     volver de una lección baja hasta la lección actual (como en F2). Guarda el nivel en store "mapLv", como antes.
   - #/palabras → palabras(): lista agrupada como Ajustes del iPhone: «Temas», «Las 3000» y «Avanzado» (plegado; si se
     abre, se recuerda en la sesión). Cada fila: dibujo, nombre, número de palabras, anillo de progreso (las del tema que
     ya están en srs:<idioma> / las del tema) y la flecha. Usa data/index.json.
   - #/doc/<id> → docView(id): el título y el control segmentado Lista · Tarjetas · Preguntas · Escribir; «‹ Palabras» es
     la cápsula de la barra de arriba (#dv-back de index.html, en el sitio de la bandera)
     (Tarjetas por defecto; el último elegido de cada tema se recuerda en la sesión, sessionStorage "vocab:docmode").
     #/doc/<id>?m=<lista|tarjetas|test|practica> abre en ese modo (los atajos de Hoy). Para js/shortcuts.js emite bus
     "doc-flip" {id, i, n} al girar una tarjeta y "doc-done" {id, mode: "test"|"practica"} al terminar Preguntas o Escribir.
     · Lista: filas con el español, la palabra y el altavoz (44 px; con la fila abierta, solo el grande del detalle) y
       el punto «En el repaso»; tocar la fila abre el detalle (dibujo, «Se dice», la IPA, plural o formas, ejemplo y «Al
       repaso»). La IPA (ipaHtml() de index.html) sale también en Tarjetas (girada, en su línea bajo «Se dice»), en
       Preguntas al contestar y en Escribir (Escuchar, Leer y Hablar), salvo que un mayor la apague en Ajustes; el plural o
       las formas van con su nombre delante («Plural: dogs»), así no se confunden con la IPA. Deslizar una fila a la izquierda (como en
       Mail) también la manda al repaso: srsAdd(id, [fila], 0), igual que el «➕ Al repaso» de antes.
     · Tarjetas: tarjeta sólida que gira al tocarla; «Siguiente» y ‹ (también deslizando y con ← →), «Automático»
       (secuencia que solo dice el idioma que se estudia), «Barajar» y «Ver primero en inglés / en español».
     · Preguntas (antes «Test»): 10 preguntas «¿Cuál es «perro»?» (como en la lección) con 4 opciones sólidas; acierto en verde con ✓, fallo en gris con ✗ y la
       correcta en verde (sin temblor ni sonido triste); srsGrade(id, fila, 2|0) y bus "answer" {where: "test"} como
       antes; tras contestar, «Seguir»; al final award(aciertos) una sola vez, con las monedas volando.
     · Escribir (antes «Práctica 21»): la práctica de repeticiones de siempre (escuchar, leer, escribir, hablar y
       dictado), con su guardado: store "pr:<id>:<idioma>" (la sesión), "prPrefs" {acts, reps}, "prAuto" y "prEx".
       Arriba solo «Empezar» (con lo elegido la última vez) y «N palabras»; lo demás (qué practicas, cuántas veces,
       qué palabras, pasar sola, oír el ejemplo) va en la fila «Opciones ›», que abre una hoja.
       «Hablar» sigue ahí: con micrófono si canListen(); si no, se dice en voz alta y se toca «Lo he dicho» (noVoiceMsg()).
   - #/gramatica y #/gramatica/<nivel> → gramatica(lv): la misma pastilla de nivel; filas con número y título de cada
     unidad; al tocar se despliega la teoría (una abierta a la vez) con «Practicar», que abre su lección
     (#/leccion/G-<nivel>-<nn>). Lee el nivel de "mapLv" si la ruta no lo trae (y no lo cambia, como antes).
   levelPicker(lv, href, o?) → HTML: pastilla «A1 ▾» (vidrio sobre contenido) que abre un menú de vidrio (radio 20,
     role=menu) con los 6 niveles, su nombre, su progreso y la ✓ en el actual. href: prefijo de la ruta ("#/mapa/") o
     función nivel → ruta. o.info(nivel) → {done, total} (por defecto, las lecciones del camino hechas de ese nivel);
     o.what: lo que cuenta, para el lector de pantalla ("lecciones" por defecto). El menú se maneja solo (delegado en el
     documento): flechas, Inicio y Fin, Esc o Tab lo cierran, tocar fuera también. Elegir un nivel navega a su ruta.
   API: window.levelPicker · window.vocabLearn = {levelPicker, mapa, palabras, docView, gramatica, state, topicPic,
     modes, peek(id) (abre el vistazo de una lección hecha), jump() (lleva a la lección actual), repaint() (la IPA
     cambió en Ajustes: repinta la ficha de un tema en su sitio; false si no es cosa suya)}.
   Usa de index.html (globales): lang, LANGS, store, $, esc, ico, bus, ROUTES, getIndex, getDoc, CACHE, srsAll, srsK,
   srsAdd, srsGrade, award, toast, say, sayP, sleep, autoTok, logAct, voiceNote, shuffle, canListen, noVoiceMsg,
   listen, LVS, getMap, MAP, mapP, lvLessons, lvCur, lvUnits, GRAM, gId, allMapP, heroHtml, nPal, hashPath, secOf,
   rovingKeys, ROUTE_RESTORE, ROUTE_FROM, mapScrolled, ipaOn, ipaHtml; y window.M (motion.js), window.G (gestures.js). */
(() => {
"use strict";
const W = window, D = document, ROOT = D.documentElement;
const rm = () => !!(W.M && typeof M.rm === "function" && M.rm());
const code = () => (LANGS[lang] && LANGS[lang].code) || "en-GB";
const lname = () => (LANGS[lang] && LANGS[lang].name) || "";
const Lname = () => { const n = lname(); return n.charAt(0).toUpperCase() + n.slice(1); };
const gestures = [];                       /* gestos de lo que se ve: se quitan al volver a pintar */
const clearGest = () => { while(gestures.length){ try{ gestures.pop()(); }catch(e){} } };
const gest = off => { if(typeof off === "function") gestures.push(off); };
const haveG = () => !!(W.G && typeof G.swipe === "function");
const hint = (el, o) => { try{ if(el && W.G && typeof G.hint === "function") return G.hint(el, o); }catch(e){} return null; };
const PRAISE = ["¡Muy bien!", "¡Genial!", "¡Eso es!", "¡Perfecto!"];
/* ✓ que se dibuja (M.ok la anima con stroke-dashoffset) */
const CHK = `<svg class="chk" viewBox="0 0 256 256" width="22" height="22" aria-hidden="true" focusable="false"><polyline points="40 144 96 200 224 72" fill="none" stroke="currentColor" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
/* key: la tecla de js/keys.js que lo pulsa (data-key), solo en el altavoz y la tortuga principales de cada pantalla */
const spk = (t, cls = "", key = "") => t ? `<button type="button" class="say ln-spk${cls ? " " + cls : ""}" data-say="${esc(t)}"${key ? ` data-key="${key}"` : ""} aria-label="Escuchar">${ico("speaker-high", "fill", cls.includes("lg") ? 30 : 22)}</button>` : "";
const slowB = (t, key = "") => t ? `<button type="button" class="say ln-slow" data-say="${esc(t)}" data-slow${key ? ` data-key="${key}"` : ""} aria-label="Escuchar despacio">${ico("turtle", "fill", 26)}</button>` : "";
const picHtml = (r, cls = "") => `<div class="ln-pic${cls ? " " + cls : ""}${r.img && r.img.includes("fam_") ? " wide" : ""}">${r.img
  ? `<img src="${esc(r.img)}" alt="" loading="lazy" decoding="async" draggable="false">` : `<span class="ln-ph" aria-hidden="true">${esc((r.es || "?").charAt(0).toUpperCase())}</span>`}</div>`;
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9æøåœ]/g, "");
const stars = (n, z = 16) => [0, 1, 2].map(i => `<span class="ln-star${i < n ? " on" : ""}">${ico("star", "fill", z)}</span>`).join("");
/* la palabra en español dentro de una frase, en minúscula («¿Cuál es «perro»?»), como en la lección; no los nombres
   propios (países, o con más mayúsculas) */
const inQ = (es, doc) => String(es || "").split("/").map(p => doc === "paises" || /\p{Lu}/u.test(p.slice(1)) ? p : p.charAt(0).toLowerCase() + p.slice(1)).join("/");
/* las cabeceras de grupo como el resto («Mascotas», no «MASCOTAS»): solo cambia lo que viene todo en mayúsculas. Lo
   que lleva cifras se queda («Nivel A1 · Principiante») y en los temas de lugares cada nombre va con mayúscula
   («Asia y Oceanía», «Medio Oriente») */
const GEO = new Set(["paises", "nacionalidades"]);
function catT(c, doc){
  c = String(c || ""); if(/\p{Ll}/u.test(c)) return c;
  const cap = w => w.charAt(0) + w.slice(1).toLowerCase();
  return c.split(/(\s*·\s*)/).map(part => /·/.test(part) ? part : part.split(" ").map((w, i) =>
    /\d/.test(w) ? w : i === 0 ? cap(w) : GEO.has(doc) && !/^(Y|DE|DEL|LA|EL)$/.test(w) ? cap(w) : w.toLowerCase()).join(" ")).join("");
}
/* el punto «ya está en el repaso» con su nombre para el lector de pantalla */
const IN_SRS = `<span class="vh dl-srs">En el repaso</span>`;

/* ---------- estilos ---------- */
const CSS = `
.ln-spk.say{position:relative;flex:none;width:var(--tap);height:var(--tap);margin:0;padding:0;border:0;border-radius:50%;display:grid;place-items:center;
  font-size:inherit;background:var(--brand-soft);color:var(--brand-tint);cursor:pointer;transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms)}
.ln-spk.say.lg{width:64px;height:64px}
.ln-spk.say.sm{background:none}
.ln-spk.say.playing{background:var(--brand-fill);color:#fff}
.ln-slow.say{flex:none;width:var(--tap-bar);height:var(--tap-bar);margin:0;padding:0;border:0;border-radius:50%;display:grid;place-items:center;
  font-size:inherit;background:var(--fill2);color:var(--label);cursor:pointer}
.ln-slow.say.playing{background:var(--brand-fill);color:#fff}
.ln-pic{display:flex;align-items:center;justify-content:center}
.ln-pic img{display:block;box-sizing:border-box;max-width:100%;max-height:100%;object-fit:contain;-webkit-user-drag:none}
:root[data-theme=dark] .ln-pic img{background:#F2F2F7;border-radius:var(--r-md);padding:6px}
.ln-ph{display:grid;place-items:center;height:100%;aspect-ratio:1;border-radius:24px;background:var(--fill2);color:var(--label2);font:800 2.4rem/1 var(--f-round)}
.ln-star{display:inline-grid;color:var(--fill)}
.ln-star.on{color:var(--gold)}
.ln-star .ico{filter:drop-shadow(0 1px 0 rgba(0,0,0,.14))}
.ln-empty{margin:24px 0;text-align:center;font:400 var(--fs-body)/1.35 var(--f-text);color:var(--label2)}
.ln-kbd{display:none;position:absolute;left:8px;top:8px}
:root[data-kbd] .ln-kbd{display:inline-flex}
@media (hover:hover) and (pointer:fine){.ln-kbd{display:inline-flex}}

/* pastilla de nivel y su menú */
.lvp{position:relative;flex:none}
.lvp-b{gap:6px;padding:0 12px 0 14px}
.lvp-b b{font:800 var(--fs-head)/1 var(--f-round);font-variant-numeric:tabular-nums}
.lvp-dot{flex:none;display:block;width:10px;height:10px;border-radius:50%;background:var(--lc,var(--brand-fill))}
.lvp-car{transition:rotate var(--d-fast,160ms) ease}
.lvp-b[aria-expanded=true] .lvp-car{rotate:180deg}
.lvp-m{position:absolute;z-index:8;top:calc(100% + 8px);left:0;width:min(320px,calc(100vw - 32px));padding:4px;border-radius:var(--r-menu)}
.lvp-m.glass{--g-tint:rgba(255,255,255,.94)}   /* casi opaco: detrás no se ven los nodos del camino */
:root[data-theme=dark] .lvp-m.glass{--g-tint:rgba(28,28,30,.94)}
/* en oscuro, los niveles de color oscuro con un punto más claro (del mismo tono) */
:root[data-theme=dark] .lvp-dot[data-lv=B2]{background:#7F9CF0}
:root[data-theme=dark] .lvp-dot[data-lv=C1]{background:#9CA3AF}
.lvp-m[hidden]{display:none}
.lvp-i{position:relative;display:flex;align-items:center;gap:12px;min-height:var(--row);padding:8px 12px;border-radius:16px;color:var(--label);
  text-decoration:none;font:400 var(--fs-body)/1.2 var(--f-text);-webkit-tap-highlight-color:transparent}
.lvp-i+.lvp-i::before{content:"";position:absolute;top:0;left:34px;right:12px;height:1px;background:var(--sep);transform:scaleY(.5);transform-origin:0 0;pointer-events:none}
.lvp-i:hover{background:var(--fill2)}
.lvp-i:hover::before,.lvp-i:hover+.lvp-i::before{visibility:hidden}
.lvp-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lvp-t b{margin-right:6px;font:800 var(--fs-head)/1.1 var(--f-round)}
.lvp-n{flex:none;font:400 var(--fs-note)/1 var(--f-text);color:var(--label2);font-variant-numeric:tabular-nums}
.lvp-chk{flex:none;color:var(--brand-ink);visibility:hidden}
.lvp-i[aria-checked=true] .lvp-chk{visibility:visible}

/* Camino */
.cm{position:relative;width:min(100%,640px);margin:0 auto}   /* el mismo ancho que el título, Palabras y Gramática */
.cm-top{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;margin:0 0 8px}
.cm-sum{margin:0;min-width:0;font:400 var(--fs-sub)/1.3 var(--f-text);color:var(--label2)}
.cm-sum b{font-weight:600;color:var(--label)}
.cm-gift{display:flex;align-items:center;gap:8px;min-height:32px;margin:0;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.cm-gift .ico{flex:none}
.cm-dots{display:inline-flex;gap:6px;margin-left:4px}
.cm-dots i{width:8px;height:8px;border-radius:50%;background:var(--fill)}
.cm-dots i.on{background:var(--teal)}
.cm .path{display:flex;flex-direction:column;align-items:center;padding:8px 0 40px}
.cm .unit{width:100%;display:flex;align-items:center;gap:10px;margin:24px 0 40px;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.cm .unit::before,.cm .unit::after{content:"";flex:1;min-width:16px;height:1px;background:var(--sep)}
.cm .unit span{display:inline-flex;align-items:center;flex-wrap:wrap;justify-content:center;gap:0 4px;max-width:80%;text-align:center}
.cm .unit a{display:inline-flex;align-items:center;min-height:var(--tap);color:var(--brand-ink);font-weight:600;text-decoration:none}
.cm .unit a:hover{text-decoration:underline}
.cm .nd{position:relative;margin:0 0 36px;transform:translateX(var(--x))}
.cm .nd.hb{margin-top:44px}
.cm .node{position:relative;width:68px;height:68px;margin:0;padding:0;border:0;border-radius:50%;display:grid;place-items:center;
  color:#fff;background:var(--brand-fill);box-shadow:0 2px 6px rgba(0,0,0,.16);font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.cm .node.done{background:var(--ok-fill)}   /* el ✓ blanco con contraste de sobra */
.cm .node.cur{background:var(--brand-fill);box-shadow:0 0 0 6px var(--brand-soft),0 4px 12px rgba(30,110,244,.32)}
.cm .node.lock{background:var(--fill);color:var(--label3);box-shadow:none}
.cm .node.gram{border-radius:22px}
.cm .node.trophy{width:80px;height:80px;background:var(--gold);color:var(--gold-on);box-shadow:0 2px 8px rgba(0,0,0,.16)}
.cm .node.trophy.lock{background:var(--fill);color:var(--label3);box-shadow:none}
:root[data-theme=dark] .cm .node{box-shadow:none}
:root[data-theme=dark] .cm .node.cur{box-shadow:0 0 0 6px var(--brand-soft)}
.cm .nd .stars{position:absolute;left:50%;bottom:-24px;transform:translateX(-50%);display:flex;gap:1px;white-space:nowrap;pointer-events:none}
.cm .bubble{position:absolute;left:50%;bottom:calc(100% + 12px);transform:translateX(-50%);margin:0;padding:5px 12px;border:0;border-radius:var(--r-pill);
  background:var(--card);color:var(--brand-ink);font:700 var(--fs-note)/1.2 var(--f-text);white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.12);
  animation:none;pointer-events:none}
.cm .bubble::after{content:"";position:absolute;left:50%;top:100%;border:7px solid transparent;border-top-color:var(--card);transform:translateX(-50%)}
:root[data-theme=dark] .cm .bubble{background:var(--card-2)}
:root[data-theme=dark] .cm .bubble::after{border-top-color:var(--card-2)}
.cm .nd .glbl{position:absolute;top:50%;transform:translateY(-50%);width:150px;font:600 var(--fs-note)/1.25 var(--f-text);color:var(--label)}
.cm .nd .glbl.r{left:calc(100% + 12px)}
.cm .nd .glbl.l{right:calc(100% + 12px);text-align:right}
.cm .nd .glbl small{display:block;font:600 var(--fs-min)/1.3 var(--f-text);color:var(--label2)}
.cm-next{margin:0 0 24px;text-align:center}
@media (max-width:560px){.cm .nd{transform:translateX(calc(var(--x) * .7))}.cm .nd .glbl{width:110px}}
.cm-jump{--g-lite:rgba(255,255,255,.95);--g-lite-d:rgba(44,44,46,.95);position:fixed;z-index:9;left:50%;bottom:calc(var(--tabbar-b) + var(--tabbar-h) + 12px);
  translate:-50% 0;display:inline-flex;align-items:center;gap:6px;min-height:var(--tap);margin:0;padding:0 18px 0 14px;border:0;border-radius:var(--r-pill);
  color:var(--brand-ink);font:600 var(--fs-sub)/1 var(--f-text);white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent}
.cm-jump[hidden]{display:none}
.cm-jump.up .ico{rotate:180deg}
:root[data-acc]:not([data-focus]) .cm-jump{bottom:calc(var(--tabbar-b) + var(--tabbar-h) + var(--tap-bar) + 20px)}
@media (min-width:820px){
  :root:not([data-bar=bottom]) .cm-jump{bottom:calc(16px + var(--safe-b))}
  :root[data-acc]:not([data-focus]):not([data-bar=bottom]) .cm-jump{bottom:calc(16px + var(--safe-b) + var(--tap-bar) + 12px)}
}
dialog.cm-pk{max-width:480px}
.cm-pk-u{margin:0 0 12px;text-align:center;font:400 var(--fs-sub)/1.3 var(--f-text);color:var(--label2)}
.cm-pk-st{display:flex;justify-content:center;gap:8px;margin:4px 0 6px}
.cm-pk-s{margin:0 0 16px;text-align:center;font:600 var(--fs-head)/1.3 var(--f-round);color:var(--label)}
.cm-pk-w{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:0 0 20px}
.cm-pk-w:empty{display:none}
.cm-pk-w span{padding:6px 12px;border-radius:var(--r-pill);background:var(--fill2);font:400 var(--fs-note)/1.25 var(--f-text);color:var(--label)}
.cm-pk-w b{font-weight:600}
.cm-pk .glass-btn--block{margin-bottom:8px}

/* Palabras */
.wl{width:min(100%,640px);margin:0 auto}
.wl .st-g{background:var(--card)}
:root[data-theme=dark] .wl .st-g{background:var(--card)}
.wl-r{min-height:60px;color:var(--label);text-decoration:none;-webkit-tap-highlight-color:transparent}
.wl-r.st-r+.wl-r.st-r::before{left:64px}
.wl-r:hover{background:var(--fill2)}
.wl-ic{flex:none;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:var(--fill2)}
:root[data-theme=dark] .wl-ic{background:#F2F2F7}
.wl-ic img{display:block;width:30px;height:30px;object-fit:contain;-webkit-user-drag:none}
.wl-t{display:block;font:400 var(--fs-body)/1.25 var(--f-text);overflow-wrap:anywhere}
.wl-r.off .wl-t,.wl-r.off small{color:var(--label2)}
.wl-r.off{pointer-events:none}
.wl-r.off .wl-ic{opacity:.5}
.wl-ring{position:relative;flex:none;width:30px;height:30px;display:grid;place-items:center;color:var(--ok-ink)}
.wl-ring svg:not(.ico){position:absolute;inset:0;width:100%;height:100%;rotate:-90deg}
.wl-ring .ico{position:relative}
.wl-ring circle{fill:none;stroke-width:4}
.wl-rb{stroke:var(--fill)}
.wl-rf{stroke:var(--teal);stroke-linecap:round}
.wl-rf.zero{stroke:none}
.wl-ring.full .wl-rf{stroke:var(--ok)}
.wl-chev{flex:none;color:var(--label3)}
.wl-adv>summary{list-style:none;cursor:pointer}
.wl-adv>summary::-webkit-details-marker{display:none}
.wl-sum{display:flex;align-items:center;gap:6px;min-height:var(--tap);-webkit-tap-highlight-color:transparent}
.wl-sum .wl-cnt{font-weight:400;color:var(--label2)}
.wl-car{transition:rotate var(--d-fast,160ms) ease}
.wl-adv[open] .wl-car{rotate:180deg}
.wl-adv:not([open]){margin-bottom:8px}

/* ficha de un tema */
.dv{width:min(100%,640px);margin:0 auto}
.dv-t{margin:0;font:700 var(--fs-t1)/1.15 var(--f-round);color:var(--label);text-wrap:balance}
.dv-sub{margin:4px 0 16px;font:400 var(--fs-sub)/1.3 var(--f-text);color:var(--label2)}
.dv-note{margin:0 0 16px}
.dv .dv-seg{max-width:none;margin:0 0 16px;scroll-margin-top:calc(var(--safe-t, 0px) + 88px)}
.dv .dv-seg .seg-i{flex:1 1 auto;min-width:0;padding:0 6px}
.dv-view{min-height:240px}
.dv-view:focus{outline:none}

/* Lista */
.dl-search{display:flex;align-items:center;gap:8px;min-height:var(--tap);margin:0 0 16px;padding:0 12px;border-radius:12px;background:var(--fill2);color:var(--label2)}
.dl-search input{flex:1;min-width:0;min-height:var(--tap);margin:0;padding:0;border:0;background:none;color:var(--label);font:400 var(--fs-body)/1.2 var(--f-text);outline:none}
.dl-search input::placeholder{color:var(--label2);opacity:1}
.dl-search:focus-within{box-shadow:0 0 0 3px var(--brand-soft)}
.dl-cat{margin:20px 16px 6px;font:600 var(--fs-note)/1.33 var(--f-text);color:var(--label2);letter-spacing:.01em}
.dl-cat:first-child{margin-top:0}
.dl-g{margin:0 0 4px}
.dl-r{position:relative;overflow:hidden;background:var(--card)}
:root[data-theme=dark] .dl-g.st-g{background:var(--card)}
.dl-r+.dl-r::after{content:"";position:absolute;z-index:2;top:0;left:16px;right:0;height:1px;background:var(--sep);transform:scaleY(.5);transform-origin:0 0;pointer-events:none}
.dl-act{position:absolute;inset:0 0 auto auto;height:var(--dl-h,60px);width:100%;display:flex;align-items:center;justify-content:flex-end;gap:6px;
  padding:0 20px;background:var(--brand-fill);color:#fff;font:600 var(--fs-sub)/1 var(--f-text);visibility:hidden}
.dl-r.is-swiping .dl-act{visibility:visible}
.dl-act.is-done{background:var(--ok-fill)}
.dl-fg{position:relative;z-index:1;display:flex;align-items:center;gap:8px;min-height:60px;padding:0 12px 0 0;background:var(--card)}
.dl-open{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:60px;margin:0;padding:8px 0 8px 16px;border:0;background:none;
  color:var(--label);text-align:left;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.dl-es{font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2);overflow-wrap:anywhere}
.dl-w{font:600 var(--fs-head)/1.25 var(--f-text);color:var(--label);overflow-wrap:anywhere}
.dl-r.in-srs .dl-es::after{content:"";display:inline-block;width:8px;height:8px;margin:0 0 1px 8px;border-radius:50%;background:var(--teal);vertical-align:middle}
.dl-r.is-open .dl-fg>.say{visibility:hidden}   /* abierta, el altavoz es el grande del detalle */
.dl-open[aria-expanded=true] .dl-w{color:var(--brand-ink)}
.dl-d{padding:0 16px 16px}
.dl-d[hidden]{display:none}
.dl-dd{display:flex;gap:16px;align-items:flex-start}
.dl-pic{flex:none;width:96px;height:96px}
.dl-pic.wide{width:140px}
.dl-info{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.dl-hear{display:flex;align-items:center;gap:12px}
.dl-ln{margin:0;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label)}
.dl-k{margin-right:6px;font:600 var(--fs-note)/1 var(--f-text);color:var(--label2)}
.dl-ln .ipa{color:inherit}   /* el valor de la fila «IPA», como «Se dice» y «Plural» (el gris es para la IPA de subtítulo) */
.dl-ex{width:100%;padding:10px 12px;border-radius:var(--r-md);background:var(--fill2)}
.dl-ex p{margin:0;font:400 var(--fs-sub)/1.35 var(--f-text)}
.dl-ex .ln-spk{display:inline-grid;vertical-align:middle;margin:-10px 0 -10px 0}
.dl-ex .dl-ex-tr{margin-top:2px;font-size:var(--fs-note);color:var(--label2)}
.dl-add .ico{flex:none}
@media (max-width:420px){.dl-dd{flex-direction:column;gap:8px}.dl-pic{width:100%;height:160px}.dl-pic.wide{width:100%}.dl-hear{align-self:center}}

/* Tarjetas */
.fcx{display:flex;flex-direction:column;align-items:center;gap:12px}
.fcx-n{margin:0;font:600 var(--fs-note)/1 var(--f-round);color:var(--label2);font-variant-numeric:tabular-nums}
.fcx-card{position:relative;width:min(100%,460px);min-height:340px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  padding:24px 20px;border-radius:var(--r-card);background:var(--card);color:var(--label);text-align:center;cursor:pointer;
  -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;touch-action:pan-y;outline-offset:-3px}
.fcx-card .ln-pic{width:100%;height:clamp(110px,22vh,190px)}
.fcx-card.is-back .ln-pic{height:clamp(72px,12vh,120px)}   /* de vuelta, el dibujo más pequeño: así cabe todo con «Siguiente» */
.fcx-card.is-back.say2 .ln-pic{height:clamp(56px,calc(12vh - 1.4rem),120px)}   /* con «Se dice» y la IPA debajo, cede esa línea */
.fcx-w{margin:4px 0 0;font:700 var(--fs-word)/1.15 var(--f-round);overflow-wrap:anywhere;-webkit-hyphens:auto;hyphens:auto;text-wrap:balance}
.fcx-es{margin:0;font:400 var(--fs-body)/1.3 var(--f-text);color:var(--label2)}
.fcx-hear{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:4px}
.fcx-tap{display:flex;align-items:center;gap:8px;margin:8px 0 0;font:600 var(--fs-note)/1.2 var(--f-text);color:var(--label2)}
.fcx-tap .ico{color:var(--brand-tint)}
.fcx-meta{margin:0;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label2)}
/* la IPA en su propia línea, bajo «Se dice «…»» (como en «Cómo suena»); el plural o las formas, con su nombre delante */
.fcx-meta .ipa,.pw .pw-line .ipa{display:block;overflow-wrap:anywhere}
.fcx-k,.pw .pw-k{font-weight:600}
.fcx-ex{width:100%;margin-top:4px;padding:10px 12px;border-radius:var(--r-md);background:var(--fill2);text-align:left}
.fcx-ex p{margin:0;font:400 var(--fs-sub)/1.35 var(--f-text)}
.fcx-ex .ln-spk{display:inline-grid;vertical-align:middle;margin:-10px 0}
.fcx-ex .fcx-tr{margin-top:2px;font-size:var(--fs-note);color:var(--label2)}
.fcx-nav{display:flex;gap:12px;width:min(100%,460px)}
.fcx-nav .fcx-next{flex:1}
.fcx-nav .fcx-prev{width:var(--btn-main);min-height:var(--btn-main);border-radius:50%}
.fcx-more{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}

/* Preguntas */
.qz{width:min(100%,560px);margin:0 auto;display:flex;flex-direction:column;gap:12px}
.qz-top{display:flex;align-items:center;gap:12px}
.qz-bar{flex:1;height:10px;border-radius:999px;background:var(--fill);overflow:hidden}
.qz-bar>i{display:block;height:100%;border-radius:inherit;background:var(--teal);transition:width var(--d-base,260ms) ease}
.qz-n{flex:none;font:700 var(--fs-note)/1 var(--f-round);color:var(--label2);font-variant-numeric:tabular-nums}
.qz-card{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px 20px 24px;border-radius:var(--r-card);background:var(--card);text-align:center}
.qz-card .ln-pic{width:100%;height:clamp(100px,20vh,170px)}
.qz-ask{margin:0;font:700 var(--fs-t2)/1.2 var(--f-round);color:var(--label);text-wrap:balance}
.qz-ask q{quotes:"«" "»"}
.qz-opts{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.qz-opt{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;min-width:0;min-height:64px;padding:8px 14px;border:0;border-radius:20px;
  background:var(--card);color:var(--label);font:700 var(--fs-t3)/1.15 var(--f-round);text-align:center;overflow-wrap:anywhere;-webkit-hyphens:auto;hyphens:auto;
  cursor:pointer;transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms);-webkit-tap-highlight-color:transparent}
.qz-opts.is-long .qz-opt{font-size:var(--fs-head)}
.qz-opts.is-xlong .qz-opt{font-size:var(--fs-sub)}
.qz-ot{display:block;min-width:0;max-width:100%;overflow-wrap:normal;word-break:normal}
.qz-opts.is-break .qz-ot{overflow-wrap:anywhere}
.qz-opt:disabled{cursor:default;opacity:1}
.qz-opt.is-dim{color:var(--label2)}
.qz-opt.is-ok{background:var(--ok-fill);color:#fff;box-shadow:0 8px 20px -8px rgba(0,137,50,.7)}
.qz-opt.is-miss{background:var(--miss-fill);color:var(--miss-on)}
.qz-opt .chk{flex:none}
.qz-opt .xm{flex:none;color:var(--miss)}
.qz-opt.is-stack{flex-direction:column;gap:2px;padding-top:6px;padding-bottom:6px}
.qz-opt.is-stack .chk,.qz-opt.is-stack .xm{width:20px;height:20px}
.qz-opt.is-ok .ln-kbd,.qz-opt.is-miss .ln-kbd,.qz-opt.is-dim .ln-kbd{visibility:hidden}
.qz-fb{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px 8px;min-height:var(--tap);margin:0;text-align:center;
  font:700 var(--fs-t3)/1.25 var(--f-round);color:var(--ok-ink)}
.qz-fb.miss{color:var(--label)}
.qz-fb.miss b{font-weight:800;color:var(--ok-ink)}
.qz-fb small{flex-basis:100%;font:400 var(--fs-sub)/1.3 var(--f-text);color:var(--label2)}
.qz-go[hidden],.qz-go .glass-btn[hidden]{display:none}
.qz-go .glass-btn{scroll-margin-bottom:calc(var(--tabbar-b, 0px) + var(--tabbar-h, 0px) + 20px)}
.qz-end .qz-card{gap:6px;padding:24px 20px 28px}
.qz-fox{height:96px;display:grid;place-items:end center}
.qz-score{margin:6px 0 0;font:700 var(--fs-t1)/1.1 var(--f-round);color:var(--label);font-variant-numeric:tabular-nums}
.qz-score b{font-weight:800}
.qz-msg{margin:0;font:400 var(--fs-body)/1.3 var(--f-text);color:var(--label2)}
@media (max-width:360px){.qz-opts{grid-template-columns:1fr}}

/* Escribir (práctica de repeticiones) */
.pw{display:flex;flex-direction:column;gap:20px}
.pw .st-sec{margin:0}
.pw .st-g{background:var(--card)}
:root[data-theme=dark] .pw .st-g{background:var(--card)}
.pw-chk{appearance:none;-webkit-appearance:none;flex:none;position:relative;width:26px;height:26px;margin:0;border:2px solid var(--label3);border-radius:50%;
  background:none;cursor:pointer;transition:background-color var(--d-fast,160ms),border-color var(--d-fast,160ms)}
.pw-chk:checked{background:var(--brand-fill);border-color:var(--brand-fill)}
.pw-chk:checked::after{content:"";position:absolute;left:6px;top:4px;width:9px;height:5px;border:solid #fff;border-width:0 0 3px 3px;rotate:-45deg}
.pw-chk:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
label.st-r{cursor:pointer}
.pw .pw-seg{max-width:none;margin:0}
.pw-picks{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}
.pw-words{max-height:320px;overflow:auto;overscroll-behavior:contain}
.pw-words .st-r{min-height:var(--tap);padding:6px 16px;font:400 var(--fs-sub)/1.3 var(--f-text)}
.pw-words .st-r small{display:inline;margin-left:6px;color:var(--label2);font-size:var(--fs-note)}
.pw-go{display:flex;flex-direction:column;align-items:stretch;gap:8px}
.pw-total{margin:0;text-align:center;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.pw-opt .st-l small{white-space:normal}
.pw-chev{flex:none;color:var(--label3)}
/* las opciones de Escribir, en una hoja (lo de un mayor, fuera del camino del niño) */
dialog.pw-sheet{max-width:560px}
dialog.pw-sheet.m-sheet,dialog.pw-sheet.m-sheet.glass{background:var(--bg);-webkit-backdrop-filter:none;backdrop-filter:none}
:root[data-theme=dark] dialog.pw-sheet.m-sheet{background:var(--card)}
:root[data-theme=dark] dialog.pw-sheet .st-g{background:var(--card-2)}
.pw-sheet .pw{padding:0 0 8px}
.pw-resume{padding:0 0 12px}
.pw-rb{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px}
.pw-rb>*{flex:1}
.pw-run{display:grid;gap:12px;grid-template-columns:minmax(0,1fr)}
@media (min-width:920px){.pw-run.has-panel{grid-template-columns:minmax(0,1fr) 300px;align-items:start}.pw-run.has-panel .pw-panel{grid-column:2;grid-row:1 / span 4}}
.pw-top{display:flex;align-items:center;gap:12px}
.pw-bar{flex:1;height:10px;border-radius:999px;background:var(--fill);overflow:hidden}
.pw-bar>i{display:block;height:100%;border-radius:inherit;background:var(--teal);transition:width .4s ease}
.pw-pct{flex:none;font:700 var(--fs-note)/1 var(--f-round);color:var(--label2);font-variant-numeric:tabular-nums}
.pw-meta{margin:0;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.pw-meta b{font-weight:600;color:var(--label)}
.pw-flow{position:relative;isolation:isolate;height:540px;overflow:hidden;border-radius:var(--r-card)}   /* crece con la tarjeta de ahora (fitFlow); isolation: el z-index de las tarjetas no pasa por encima de la barra de pestañas */
.pw .pr-card{position:absolute;left:50%;top:calc(50% - 12px);width:var(--cw,300px);min-height:440px;margin-left:calc(var(--cw,300px) / -2);display:flex;flex-direction:column;
  border-radius:var(--r-card);background:var(--card);color:var(--label);overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.08);
  transition:transform .5s cubic-bezier(.3,.8,.3,1),opacity .4s ease}
:root[data-theme=dark] .pw .pr-card{box-shadow:none;background:var(--card-2)}
.pw .pr-card.side{pointer-events:none}
.pw .pr-card.side .pr-body{opacity:.55}
.pw .pr-hero{position:relative;flex:0 0 150px;display:flex;align-items:center;justify-content:center;background:var(--fill2)}
.pw .pr-card.side .pr-hero{flex:0 0 190px}
.pw .pr-hero .ln-pic{width:70%;height:120px}
.pw .pr-tag{position:absolute;left:12px;bottom:10px;display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:var(--r-pill);
  background:var(--card);color:var(--label);font:600 var(--fs-min)/1.2 var(--f-text)}
.pw .pr-num{position:absolute;right:12px;top:10px;font:700 var(--fs-min)/1 var(--f-round);color:var(--label2);font-variant-numeric:tabular-nums}
.pw .pr-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:14px 18px 18px;text-align:center}
.pw .es2{margin:0;font:600 var(--fs-sub)/1.3 var(--f-text);color:var(--label2)}
.pw .pr-card.side .es2{font-size:var(--fs-head);color:var(--label)}
.pw .big{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px 8px;margin:0;font:700 var(--fs-t2)/1.15 var(--f-round);overflow-wrap:anywhere}
.pw .sayrow{display:flex;align-items:center;justify-content:center;gap:16px}
.pw .pw-line{margin:0;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.pw .pw-ex{width:100%;padding:8px 10px;border-radius:var(--r-md);background:var(--fill2);text-align:left;font:400 var(--fs-note)/1.35 var(--f-text)}
.pw .pw-ex p{margin:0}
.pw .pw-ex .ln-spk{display:inline-grid;vertical-align:middle;margin:-10px 0}
.pw .pw-ex .tr{color:var(--label2)}
.pw .pw-ex[hidden]{display:none}
.pw .ans{width:100%;box-sizing:border-box;min-height:var(--tap-bar);padding:10px 12px;border:2px solid var(--sep);border-radius:var(--r-sm);background:var(--card);
  color:var(--label);font:400 var(--fs-head)/1.3 var(--f-text);text-align:center}
.pw textarea.ans{min-height:84px;resize:vertical;text-align:left;font-size:var(--fs-sub)}
.pw .ans:focus{outline:none;border-color:var(--brand-tint)}
.pw .ans.ok{border-color:var(--ok)}
.pw .ans.bad{border-color:var(--miss)}
.pw .pr-msg{min-height:1.35em;margin:0;font:400 var(--fs-note)/1.35 var(--f-text);color:var(--label2)}
.pw .pr-msg.ok{color:var(--ok-ink);font-weight:600}
.pw .pr-msg.bad{color:var(--label)}
.pw .pr-msg.bad b{color:var(--ok-ink)}
.pw .pr-msg .xm{color:var(--miss);vertical-align:-3px;margin-right:2px}
.pw .diff{margin-top:4px;font-size:var(--fs-note)}
.pw .diff .x{color:var(--label);font-weight:700;text-decoration:underline wavy var(--miss)}
.pw .mic{position:relative;width:64px;height:64px;margin:0;padding:0;border:0;border-radius:50%;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-tint);cursor:pointer}
.pw .mic.on{background:var(--brand-fill);color:#fff;box-shadow:0 0 0 6px var(--brand-soft)}
.pw .mic[hidden]{display:none}
.pw .pr-next{min-width:160px}
.pw .pr-dots{position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:center;flex-wrap:wrap;gap:5px;padding:0 16px}
.pw .pr-dots i{width:8px;height:8px;border-radius:50%;background:var(--fill);transition:background-color .3s,transform .3s}
.pw .pr-dots i.on{background:var(--teal)}
.pw .pr-dots i.now{background:var(--teal);transform:scale(1.5)}
.pw-tools{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.pw-panel{padding:12px 0 0}
.pw-panel[hidden]{display:none}
.pw-ph{margin:0 16px 8px;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.pw .pr-steps{list-style:none;margin:0;padding:0 8px 8px;max-height:min(60vh,520px);overflow:auto}
.pw .pr-steps li{position:relative;display:grid;grid-template-columns:28px 1fr;gap:10px;padding:8px 8px 10px;border-radius:12px;cursor:pointer}
.pw .pr-steps li.cur{background:var(--fill2)}
.pw .pr-steps .dot{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 var(--fs-min)/1 var(--f-round);
  border:2px solid var(--sep);color:var(--label2)}
.pw .pr-steps li.done .dot{background:var(--ok);border-color:var(--ok);color:#fff}
.pw .pr-steps li.cur .dot{border-color:var(--brand-tint);color:var(--brand-ink)}
.pw .pr-steps .w{font:600 var(--fs-sub)/1.2 var(--f-text)}
.pw .pr-steps .s{font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.pw .pr-steps .acts{display:grid;gap:2px;margin-top:4px;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.pw .pr-steps .acts .ok{color:var(--ok-ink)}
.pw-opts{margin:8px 0 0}
.pw-end{display:flex;flex-direction:column;gap:16px;align-items:stretch}
.pw-end-c{display:flex;flex-direction:column;align-items:center;gap:6px;padding:24px 20px;text-align:center}
.pw-fox{height:100px;display:grid;place-items:end center}
.pw-end-t{margin:4px 0 0;font:700 var(--fs-t2)/1.2 var(--f-round)}
.pw-end-s{margin:0;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label2)}
.pw-end-b{display:flex;flex-wrap:wrap;gap:12px}
.pw-end-b>*{flex:1}

/* Gramática */
.gr:not(.st-ic){width:min(100%,640px);margin:0 auto}   /* (.st-ic.gr es el icono gris de una fila de Ajustes) */
.gr-list{margin:4px 0 0}
.gr .st-g{background:var(--card)}
:root[data-theme=dark] .gr .st-g{background:var(--card)}
.gr-u{position:relative}
.gr-u>summary{scroll-margin-top:calc(var(--safe-t, 0px) + 88px)}
.gr-u+.gr-u::before{content:"";position:absolute;z-index:1;top:0;left:60px;right:0;height:1px;background:var(--sep);transform:scaleY(.5);transform-origin:0 0}
.gr-s{list-style:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.gr-s::-webkit-details-marker{display:none}
.gr-s.st-r{min-height:60px}
.gr-n{flex:none;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--fill2);color:var(--label);font:700 var(--fs-sub)/1 var(--f-round)}
.gr-u.is-done .gr-n{background:var(--ok);color:#fff}
.gr-tl{font:400 var(--fs-body)/1.25 var(--f-text)}
.gr-sum{margin:0 0 4px;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label2)}
.gr-st{flex:none;display:flex}
.gr-car{flex:none;color:var(--label3);transition:rotate var(--d-fast,160ms) ease}
.gr-u[open] .gr-car{rotate:180deg}
.gr-b{padding:0 16px 16px 60px}
.gr-rule{margin:8px 0 0}
.gr-rule h3,.gr-ex h3{margin:0 0 4px;font:600 var(--fs-head)/1.25 var(--f-text);color:var(--label)}
.gr-rule p{margin:0;font:400 var(--fs-body)/1.4 var(--f-text)}
.gr-tw{max-width:100%;overflow-x:auto}
.gr-tab{border-collapse:collapse;margin:8px 0 0;font:400 var(--fs-sub)/1.3 var(--f-text)}
.gr-tab td{padding:6px 10px;border:1px solid var(--sep)}
.gr-tab tr:first-child td{background:var(--fill2)}
.gr-ex{margin:14px 0 0}
.gr-ex p{margin:6px 0 0;font:400 var(--fs-body)/1.35 var(--f-text)}
.gr-ex .ln-spk{display:inline-grid;vertical-align:middle;margin:-10px 0}
.gr-ex small{display:block;color:var(--label2);font-size:var(--fs-note)}
.gr-go{margin:16px 0 0}
.gr-play{margin:0 0 16px}
.gr-ph{margin:0 0 8px;font:600 var(--fs-head)/1.25 var(--f-text);color:var(--label)}
.gr-pl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.gr-pg{display:flex;flex-direction:column;align-items:center;gap:6px;min-height:var(--tap);padding:12px 6px;border-radius:18px;background:var(--card);
  color:var(--label);text-decoration:none;text-align:center;font:600 var(--fs-sub)/1.2 var(--f-text);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.gr-pg img{width:56px;height:56px}
.gr-pg:active{transform:scale(.97)}
.gr-pg:focus-visible{outline:3px solid var(--blue,#0A84FF);outline-offset:2px}
@media (max-width:420px){.gr-b{padding-left:16px}}

@media (prefers-reduced-motion:reduce){
  .lvp-car,.wl-car,.gr-car,.qz-bar>i,.pw-bar>i,.qz-opt,.pw-chk{transition:none}
  .pw .pr-card{transition:opacity .15s ease}}
`;
function css(){
  if(D.getElementById("css-learn")) return;
  const st = D.createElement("style"); st.id = "css-learn"; st.textContent = CSS;
  D.head.appendChild(st);
}
css();

/* ===================== pastilla de nivel ===================== */
const camInfo = k => { const P = mapP(), t = lvLessons(k); return {done: t.filter(l => P[l.id]).length, total: t.length}; };
function levelPicker(lv, href, o = {}){
  if(!LVS[lv]) lv = Object.keys(LVS)[0];
  const to = typeof href === "function" ? href : k => String(href || "#/mapa/") + k, info = typeof o.info === "function" ? o.info : camInfo;
  const what = o.what || "lecciones", id = "lvp-m-" + Math.random().toString(36).slice(2, 7);
  const items = Object.entries(LVS).map(([k, v]) => {
    let x = {done: 0, total: 0}; try{ x = info(k) || x; }catch(e){}
    return `<a class="lvp-i" role="menuitemradio" aria-checked="${k === lv}" tabindex="-1" href="${esc(to(k))}" aria-label="${k}, ${esc(v.n)}: ${x.done} de ${x.total} ${esc(what)}">
      <i class="lvp-dot" data-lv="${k}" style="--lc:${v.c}" aria-hidden="true"></i><span class="lvp-t"><b>${k}</b>${esc(v.n)}</span><span class="lvp-n" aria-hidden="true">${x.done}/${x.total}</span>${ico("check", "bold", 20, "lvp-chk")}</a>`;
  }).join("");
  return `<div class="lvp" data-lvp>
    <button type="button" class="glass-btn glass-btn--sm lvp-b" aria-haspopup="menu" aria-expanded="false" aria-controls="${id}" aria-label="Nivel ${lv}, ${esc(LVS[lv].n)}. Cambiar de nivel">
      <i class="lvp-dot" data-lv="${lv}" style="--lc:${LVS[lv].c}" aria-hidden="true"></i><b>${lv}</b>${ico("caret-down", "bold", 18, "lvp-car")}</button>
    <div class="lvp-m glass" id="${id}" role="menu" aria-label="Niveles" hidden>${items}</div></div>`;
}
let menuAt = null;     /* el .lvp abierto */
let mapHint = null;    /* la pista del vistazo en el Camino: se quita al abrir el menú */
function openMenu(p){
  if(menuAt && menuAt !== p) closeMenu(false);
  if(mapHint){ try{ mapHint.close(); }catch(e){} mapHint = null; }
  const m = p.querySelector(".lvp-m"), b = p.querySelector(".lvp-b"); if(!m || !b) return;
  menuAt = p; m.hidden = false; b.setAttribute("aria-expanded", "true");
  ROOT.toggleAttribute("data-menu", true);   /* (con un menú abierto, el accesorio va sin desenfoque) */
  if(W.M){
    m.style.transformOrigin = "24px 0";
    try{ m.animate(rm() ? [{opacity: 0}, {opacity: 1}] : [{opacity: 0, transform: "scale(.86)"}, {opacity: 1, transform: "none"}],
      {duration: rm() ? 150 : 260, easing: rm() ? "ease-out" : (M.snappy ? M.snappy.easing : "ease-out")}); }catch(e){}
  }
  const cur = m.querySelector('[aria-checked="true"]') || m.querySelector(".lvp-i"); if(cur) cur.focus({preventScroll: true});
}
function closeMenu(focusBtn){
  const p = menuAt; menuAt = null;
  if(!D.getElementById("lang-m") || D.getElementById("lang-m").hidden) ROOT.removeAttribute("data-menu");
  if(!p) return;
  const m = p.querySelector(".lvp-m"), b = p.querySelector(".lvp-b");
  if(m) m.hidden = true; if(b){ b.setAttribute("aria-expanded", "false"); if(focusBtn && b.isConnected) b.focus({preventScroll: true}); }
}
D.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest(".lvp-b");
  if(b){ e.preventDefault(); const p = b.closest(".lvp"); if(menuAt === p) closeMenu(true); else openMenu(p); return; }
  if(e.target.closest && e.target.closest(".lvp-i")){ closeMenu(false); return; }   /* el enlace lleva al nivel */
  if(menuAt && !menuAt.contains(e.target)) closeMenu(false);
});
D.addEventListener("pointerdown", e => { if(menuAt && !menuAt.contains(e.target)) closeMenu(false); }, true);
D.addEventListener("keydown", e => {
  const b = e.target.closest && e.target.closest(".lvp-b");
  if(!menuAt){ if(b && (e.key === "ArrowDown" || e.key === "ArrowUp")){ e.preventDefault(); openMenu(b.closest(".lvp")); } return; }
  const items = [...menuAt.querySelectorAll(".lvp-i")], i = items.indexOf(D.activeElement);
  if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); closeMenu(true); return; }
  if(e.key === "Tab"){ closeMenu(false); return; }
  const k = {ArrowDown: 1, ArrowUp: -1}[e.key];
  if(k){ e.preventDefault(); e.stopPropagation(); items[(i + k + items.length) % items.length].focus(); }
  else if(e.key === "Home" || e.key === "End"){ e.preventDefault(); items[e.key === "Home" ? 0 : items.length - 1].focus(); }
  else if(e.key === " " && i >= 0){ e.preventDefault(); items[i].click(); }
}, true);

/* ===================== Camino ===================== */
const X = [0, 52, 78, 52, 0, -52, -78, -52];
let jumpIO = null;
function jumpOff(){ if(jumpIO){ try{ jumpIO.disconnect(); }catch(e){} jumpIO = null; } }
async function mapa(lv){
  await getMap();
  if(secOf(hashPath()) !== "mapa") return;
  const P = mapP(), lvAsked = !!LVS[lv];
  if(!LVS[lv]){ const sv = store.get("mapLv", null); lv = LVS[sv] ? sv : Object.keys(LVS).find(l => lvCur(l, P) < lvLessons(l).length) || "A1"; }
  store.set("mapLv", lv);
  jumpOff(); clearGest();
  const ls = lvLessons(lv), cur = lvCur(lv, P), done = ls.filter(l => P[l.id]).length;
  let k = 0, html = "";
  for(const [ui, u] of lvUnits(lv).entries()){
    html += `<div class="unit"><span>Unidad ${ui + 1} · <a href="#/doc/${esc(u.doc)}">${esc(u.t)}</a></span></div>`;
    for(const l of u.ls){
      const st = P[l.id] || 0, isCur = k === cur, lock = k > cur, gram = !l.w, x = X[k % X.length];
      const name = gram ? `Gramática: ${l.t}` : `Lección ${k + 1}`;
      const label = `${name}${st ? `, ${st} ${st === 1 ? "estrella" : "estrellas"}` : ""}${isCur ? ", la siguiente" : ""}${lock ? " (bloqueada)" : ""}`;
      const icon = st && !lock ? ico("check", "bold", 30) : lock ? ico("lock", "bold", 26) : gram ? ico("book-open", "bold", 30) : ico("star", "fill", 30);
      html += `<div class="nd${isCur && k ? " hb" : ""}" style="--x:${x}px">
        ${isCur ? `<div class="bubble" aria-hidden="true">${k ? "Siguiente" : "Empezar"}</div>` : ""}
        <button type="button" class="node${gram ? " gram" : ""}${lock ? " lock" : ""}${isCur ? " cur" : ""}${st && !lock ? " done" : ""}" data-ls="${esc(l.id)}" data-k="${k}" data-press="sink"${isCur ? ' id="cur-node"' : ""} aria-label="${esc(label)}">${icon}</button>
        ${gram ? `<div class="glbl ${x > 0 ? "l" : "r"}"><small>Gramática</small>${esc(l.t)}</div>` : ""}
        ${st ? `<div class="stars" aria-hidden="true">${stars(st, 15)}</div>` : ""}</div>`;
      k++;
    }
  }
  const allDone = cur >= ls.length;
  html += `<div class="nd" style="--x:0px"><button type="button" class="node trophy${allDone ? "" : " lock"}" id="trophy" data-press="sink" aria-label="Trofeo del nivel${allDone ? "" : " (bloqueado)"}">${ico("trophy", "fill", 38)}</button></div>`;
  const next = Object.keys(LVS)[Object.keys(LVS).indexOf(lv) + 1];
  /* el regalo cada 5 lecciones (giftCheck() de index.html): fila neutra con 5 puntos */
  let n = 0; try{ n = Object.keys(allMapP()).length; }catch(e){}
  const left = 5 - (n % 5), have = 5 - left;
  $("#app").innerHTML = `<div class="cm" id="cm">
    <div class="cm-top">${levelPicker(lv, "#/mapa/")}<p class="cm-sum"><b>${esc(LVS[lv].n)}</b> · ${done} de ${ls.length}</p></div>
    <p class="cm-gift">${ico("gift", "bold", 20)}<span>${left === 1 ? "¡Regalo en la próxima lección!" : `Regalo en ${left} lecciones`}</span><span class="cm-dots" aria-hidden="true">${[0, 1, 2, 3, 4].map(i => `<i class="${i < have ? "on" : ""}"></i>`).join("")}</span></p>
    <div class="path">${html}</div>
    ${allDone && next ? `<p class="cm-next"><a class="glass-btn glass-btn--pri glass-btn--lg" href="#/mapa/${next}">Ir al nivel ${next}</a></p>` : ""}
    <button type="button" class="cm-jump glass lite" id="cm-jump" hidden>${ico("arrow-down", "bold", 18)}<span>Mi lección</span></button>
  </div>`;
  const app = $("#app"), nodes = [...app.querySelectorAll(".node[data-ls]")];
  app.querySelector(".path").addEventListener("click", e => {
    const b = e.target.closest(".node[data-ls]"); if(!b) return;
    if(b.classList.contains("lock")) return toast("Primero, la lección de antes. ¡Tú puedes!", ico("lock", "bold", 20));
    location.hash = "#/leccion/" + b.dataset.ls;
  });
  $("#trophy").onclick = () => toast(allDone ? `¡Nivel ${lv} completado!` : `Termina las ${ls.length} lecciones y el trofeo es tuyo`, ico("trophy", "bold", 20));
  /* mantener pulsado un nodo hecho: el vistazo */
  if(W.G && typeof G.hold === "function") nodes.filter(b => b.classList.contains("done")).forEach(b => gest(G.hold(b, {onHold: () => {
    if(W.G.haptic) try{ G.haptic("selection"); }catch(e){}
    openPeek(b.dataset.ls, b);
  }})));
  /* baja hasta la lección que toca solo si se pidió ese nivel (#/mapa/A1) o si vuelve de una lección: al entrar por la
     pestaña se ven el título y los segmentos (Repasar · Camino · Palabras · Gramática) */
  const c = $("#cur-node"), fromLesson = secOf(ROUTE_FROM || "") === "leccion";
  if(c && !ROUTE_RESTORE && (lvAsked || fromLesson)){ mapScrolled = true; setTimeout(() => { if(c.isConnected) c.scrollIntoView({block: "center"}); }, 30); }
  watchJump(c);
  /* la pista del vistazo: en un nodo hecho que se vea (una por pantalla y sesión, como mucho 3 veces) */
  setTimeout(() => {
    if(secOf(hashPath()) !== "mapa" || menuAt) return;
    const vis = el => { const r = el.getBoundingClientRect(); return r.top > 90 && r.bottom < innerHeight - 110; };
    const h = nodes.filter(b => b.classList.contains("done") && b.isConnected && vis(b)).pop();
    if(h) mapHint = hint(h, {id: "map-peek", gesture: "hold", text: "Mantén para ver"});
  }, 1200);
  return true;
}
/* «Mi lección»: sale cuando la lección actual no se ve; con ↓ si está más abajo y ↑ si está más arriba */
function watchJump(c){
  const btn = $("#cm-jump"); if(!btn) return;
  if(!c || typeof IntersectionObserver !== "function"){ btn.hidden = true; return; }
  btn.onclick = () => jump();
  jumpIO = new IntersectionObserver(es => {
    const e = es[es.length - 1]; if(!btn.isConnected) return jumpOff();
    const below = e.boundingClientRect.top > (e.rootBounds ? e.rootBounds.bottom : innerHeight);
    btn.classList.toggle("up", !below);
    btn.setAttribute("aria-label", below ? "Bajar a mi lección" : "Subir a mi lección");
    btn.hidden = e.isIntersecting;
  }, {rootMargin: "-80px 0px -120px 0px", threshold: 0});
  jumpIO.observe(c);
}
function jump(){
  const c = $("#cur-node"); if(!c) return false;
  c.scrollIntoView({block: "center", behavior: rm() ? "auto" : "smooth"});
  setTimeout(() => { if(c.isConnected) c.focus({preventScroll: true}); }, rm() ? 0 : 450);
  return true;
}
/* vistazo de una lección hecha: sus estrellas, sus palabras y «Repetir» */
let PK = null;
function peekSheet(){
  if(PK && PK.isConnected) return PK;
  PK = D.createElement("dialog"); PK.id = "cm-pk"; PK.className = "cm-pk";
  PK.setAttribute("aria-labelledby", "cm-pk-t"); PK.setAttribute("data-no-hint", "");
  PK.addEventListener("click", e => {
    if(e.target.closest("[data-close]")){ closePeek(); return; }
    const go = e.target.closest("[data-go]");
    if(go){ e.preventDefault(); const to = go.getAttribute("href"); try{ PK.close(); }catch(_){} location.hash = to; }
  });
  D.body.appendChild(PK);
  return PK;
}
function closePeek(){
  if(!PK || !PK.open) return;
  if(W.M && typeof M.closeSheet === "function") M.closeSheet(PK); else PK.close();
}
async function openPeek(id, from){
  await getMap();
  const lv = Object.keys(LVS).find(k => lvLessons(k).some(l => l.id === id)); if(!lv) return false;
  const ls = lvLessons(lv), k = ls.findIndex(l => l.id === id), l = ls[k], st = mapP()[id] || 0;
  const us = lvUnits(lv), un = us.findIndex(u => u.ls.some(x => x.id === id)), u = us[un] || {t: ""};
  const title = l.w ? `Lección ${k + 1}` : "Gramática";
  const d = peekSheet();
  d.innerHTML = `<div class="m-head"><h2 id="cm-pk-t">${esc(title)}</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Listo</button></div>
    <p class="cm-pk-u">${l.w ? `Unidad ${un + 1} · ${esc(u.t)}` : esc(l.t)}</p>
    <div class="cm-pk-st" role="img" aria-label="${st} de 3 estrellas">${stars(st, 40)}</div>
    <p class="cm-pk-s">${st >= 3 ? "¡Perfecta!" : st === 2 ? "¡Muy bien hecha!" : "¡Hecha! A por más estrellas"}</p>
    <div class="cm-pk-w" id="cm-pk-w"></div>
    <a class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" href="#/leccion/${esc(id)}" data-go>${ico("arrow-counter-clockwise", "bold", 20)}Repetir</a>`;
  try{ if(W.M && typeof M.openSheet === "function") M.openSheet(d, {from: from || null}); else d.showModal(); }catch(e){ console.error(e); try{ d.showModal(); }catch(_){} }
  /* las palabras de la lección (si es de vocabulario) */
  if(l.w) try{
    const docs = {}; for(const [dd] of l.w) docs[dd] = await getDoc(dd);
    const ws = l.w.map(([dd, i]) => docs[dd].rows[i]).filter(r => r && r.es && r.l && r.l[lang]);
    const box = D.getElementById("cm-pk-w");
    if(box && d.open) box.innerHTML = ws.slice(0, 12).map(r => `<span><b lang="${esc(code())}">${esc(r.l[lang].word)}</b> · ${esc(r.es)}</span>`).join("");
  }catch(e){}
  return true;
}

/* ===================== Palabras ===================== */
/* el dibujo de cada tema (OpenMoji ya guardados en img/): los mismos motivos que el álbum */
const PIC_ID = {animales: "1F436", colores: "1F3A8", familia: "1F46A", nacionalidades: "1F9D1-200D-1F91D-200D-1F9D1", paises: "1F30D", profesiones: "1F477", numeros: "1F522"};
const PIC_RX = [
  [/verbos esenciales/i, "26A1"], [/verbos de movimiento/i, "1F3C3"], [/verbos de comunicaci/i, "1F4AC"], [/verbos de pensamiento/i, "1F914"],
  [/verbos de la vida diaria/i, "1FAA5"], [/verbos de cambio/i, "1F504"], [/adjetivos: aspecto/i, "1F440"], [/adjetivos: personalidad/i, "1F600"],
  [/adjetivos: valoraci/i, "1F44D"], [/adjetivos/i, "1F9E9"], [/adverbios/i, "23ED"], [/preposiciones/i, "1F4E6"], [/pronombres/i, "1F464"],
  [/conjunciones/i, "1F517"], [/preguntas/i, "2753"], [/personas/i, "1F9D1-200D-1F91D-200D-1F9D1"], [/cuerpo/i, "1F4AA"], [/comida/i, "1F34E"],
  [/casa/i, "1F3E0"], [/ropa/i, "1F455"], [/ciudad/i, "1F3D9"], [/transporte|viajes/i, "1F697"], [/calendario/i, "1F4C5"], [/clima|naturaleza/i, "1F333"],
  [/educaci/i, "1F3EB"], [/trabajo/i, "1F4BC"], [/dinero/i, "1F4B0"], [/ocio|deporte/i, "26BD"], [/tecnolog/i, "1F4BB"], [/ciencia/i, "1F52C"],
  [/sociedad/i, "1F3DB"], [/mente|sentimientos/i, "1F4AD"], [/ideas/i, "1F4A1"],
];
const topicPic = d => `img/om_${PIC_ID[d.id] || (PIC_RX.find(([rx]) => rx.test(d.title || "")) || [0, "1F4D6"])[1]}.png`;
const ADV_KEY = "vocab:wl-adv";   /* sessionStorage: «Avanzado» abierto en esta sesión */
async function palabras(){
  const idx = await getIndex();
  if(hashPath() !== "palabras") return;
  clearGest();
  const by = {}; for(const x of Object.values(srsAll())) if(x && x.d) by[x.d] = (by[x.d] || 0) + 1;
  const ring = (have, total) => {
    const p = total ? Math.min(1, have / total) : 0;
    return `<span class="wl-ring${p >= 1 ? " full" : ""}" role="img" aria-label="${have} de ${total} aprendidas"><svg viewBox="0 0 36 36" aria-hidden="true" focusable="false"><circle class="wl-rb" cx="18" cy="18" r="15" pathLength="100"/><circle class="wl-rf${p > 0 ? "" : " zero"}" cx="18" cy="18" r="15" pathLength="100" stroke-dasharray="${(p * 100).toFixed(1)} 100"/></svg>${p >= 1 ? ico("check", "bold", 14) : ""}</span>`;
  };
  const row = d => {
    const ok = (d.langs || []).includes(lang), have = Math.min(d.count, by[d.id] || 0);
    return `<a class="st-r doc wl-r${ok ? "" : " off"}" href="#/doc/${esc(d.id)}"${ok ? "" : ' aria-disabled="true" tabindex="-1"'}>
      <span class="wl-ic" aria-hidden="true"><img src="${esc(topicPic(d))}" alt="" loading="lazy" decoding="async" draggable="false" width="30" height="30"></span>
      <span class="st-l"><span class="wl-t">${esc(d.title)}</span><small>${ok ? nPal(d.count) : `Pronto en ${esc(lname())}`}</small></span>
      ${ok ? ring(have, d.count) : ""}${ico("caret-right", "bold", 18, "wl-chev")}</a>`;
  };
  const temas = idx.filter(d => d.group === "temas"), w = idx.filter(d => d.group === "3000"), adv = idx.filter(d => d.group === "avanzado");
  let open = false; try{ open = sessionStorage.getItem(ADV_KEY) === "1"; }catch(e){}
  $("#app").innerHTML = `<div class="wl" id="wl">
    <section class="st-sec" aria-labelledby="wl-h1"><h2 class="st-h" id="wl-h1">Temas</h2><div class="st-g">${temas.map(row).join("")}</div></section>
    <section class="st-sec" aria-labelledby="wl-h2"><h2 class="st-h" id="wl-h2">Las 3000</h2><div class="st-g">${w.map(row).join("")}</div></section>
    ${adv.length ? `<details class="st-sec wl-adv" id="wl-adv"${open ? " open" : ""}><summary class="st-h wl-sum">Avanzado <span class="wl-cnt">· ${adv.length} temas</span>${ico("caret-down", "bold", 16, "wl-car")}</summary>
      <div class="st-g">${adv.map(row).join("")}</div></details>` : ""}
  </div>`;
  const a = $("#wl-adv");
  if(a) a.addEventListener("toggle", () => { try{ if(a.open) sessionStorage.setItem(ADV_KEY, "1"); else sessionStorage.removeItem(ADV_KEY); }catch(e){} });
}

/* ===================== ficha de un tema ===================== */
const MODES = [["lista", "Lista"], ["tarjetas", "Tarjetas"], ["test", "Preguntas"], ["practica", "Escribir"]];
const MODE_KEY = "vocab:docmode";   /* sessionStorage: el último modo de cada tema en esta sesión (fuera de la partida) */
const modeMem = (() => { try{ const m = JSON.parse(sessionStorage.getItem(MODE_KEY)); return m && typeof m === "object" ? m : {}; }catch(e){ return {}; } })();
const isMode = m => MODES.some(x => x[0] === m);
function modeFor(id){
  if(isMode(modeMem[id])) return modeMem[id];
  const s = store.get(prKey(id), null);
  return s && s.running ? "practica" : "tarjetas";   /* una práctica a medias: se abre ahí */
}
function rememberMode(id, m){ modeMem[id] = m; try{ sessionStorage.setItem(MODE_KEY, JSON.stringify(modeMem)); }catch(e){} }
const state = {doc: null, mode: "tarjetas", q: "", fc: {i: 0, flip: false, order: null, rev: false}, test: null};
let docFrom = null;
const entries = doc => doc.rows.filter(r => r.es && r.l && r.l[lang]);
async function openDoc(id){
  id = String(id || "");
  /* un tema que no existe (#/doc o un enlace viejo) se cambia por la lista de temas, como las rutas que no existen */
  if(!id){ location.replace("#/palabras"); return; }
  const idx = await getIndex();
  if(hashPath() !== "doc/" + id) return;
  if(!idx.some(d => d.id === id)){ location.replace("#/palabras"); return; }
  if(state.doc !== id){ state.doc = id; state.q = ""; state.fc = {i: 0, flip: false, order: null, rev: false}; state.test = null; state.mode = modeFor(id); }
  else { state.test = null; state.fc.order = null; }
  /* #/doc/<id>?m=<modo> (los atajos de Hoy, js/shortcuts.js): se abre en ese modo */
  const qm = new URLSearchParams(location.hash.split("?")[1] || "").get("m");
  if(isMode(qm)){ state.mode = qm; rememberMode(id, qm); }
  state.fc.auto = false;
  docFrom = ROUTE_FROM;
  return docView(id);
}
async function docView(id){
  const [doc, idx] = await Promise.all([getDoc(id), getIndex()]);
  if(hashPath() !== "doc/" + id) return;
  if(state.doc !== id){ state.doc = id; state.mode = modeFor(id); }
  clearGest();
  const meta = idx.find(d => d.id === id);
  if(!meta || !(meta.langs || []).includes(lang)){
    $("#app").innerHTML = `<div class="dv"><h1 class="dv-t">${esc(doc.title)}</h1>
      <div class="qz-card" style="margin-top:16px"><div class="qz-fox">${typeof heroHtml === "function" ? heroHtml(80) : ""}</div><p class="qz-msg">Este tema aún no está listo en ${esc(lname())}. ¡Pronto!</p></div></div>`;
    wireBack(); return;
  }
  const n = entries(doc).length;
  $("#app").innerHTML = `<div class="dv" id="dv">
    <h1 class="dv-t">${esc(doc.title)}</h1>
    <p class="dv-sub">${nPal(n)} en ${esc(lname())}</p>
    <div class="note dv-note" id="voicenote" hidden></div>
    <div class="seg dv-seg" role="tablist" aria-label="Cómo practicar">${MODES.map(([m, t]) =>
      `<button type="button" class="seg-i" role="tab" id="dv-tab-${m}" data-m="${m}" aria-controls="view" aria-selected="${m === state.mode}" tabindex="${m === state.mode ? 0 : -1}">${t}</button>`).join("")}</div>
    <div id="view" class="dv-view" role="tabpanel" tabindex="-1"></div></div>`;
  try{ voiceNote(); }catch(e){}
  wireBack();
  const seg = $("#dv .dv-seg");
  const paint = () => seg.querySelectorAll(".seg-i").forEach(b => { const on = b.dataset.m === state.mode; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; });
  seg.addEventListener("click", e => {
    const b = e.target.closest("[data-m]"); if(!b || b.dataset.m === state.mode) return;
    autoTok++; state.fc.auto = false; try{ if("speechSynthesis" in W) speechSynthesis.cancel(); }catch(_){}
    state.mode = b.dataset.m; rememberMode(id, state.mode); paint(); draw(doc);
  });
  seg.addEventListener("keydown", e => { try{ rovingKeys(e, [...seg.querySelectorAll(".seg-i")]); }catch(_){} });
  draw(doc);
}
/* «‹ Palabras» (la cápsula de la barra de arriba en #/doc/…, en el sitio de la bandera): si se vino de la lista, Atrás
   (vuelve a su scroll); si no, a la lista. Se engancha una vez. */
function wireBack(){
  const b = $("#dv-back"); if(!b || b.dataset.wired) return;
  b.dataset.wired = "1";
  b.addEventListener("click", e => {
    /* la misma cápsula sirve al álbum y a la temporada (index.html, backOf): aquí solo la de la ficha de un tema */
    if(secOf(hashPath()) === "doc" && secOf(docFrom || "") === "palabras" && history.length > 1 && !e.metaKey && !e.ctrlKey){ e.preventDefault(); history.back(); }
  });
}
function draw(doc){
  D.onkeydown = null; clearGest();
  const v = $("#view"); if(!v) return;
  v.setAttribute("aria-labelledby", "dv-tab-" + state.mode);
  if(state.mode === "lista") lista(doc); else if(state.mode === "tarjetas") tarjetas(doc); else if(state.mode === "practica") practica(doc); else test(doc);
}
/* la IPA se encendió o se apagó en Ajustes (js/settings.js, al cerrarla): Lista y Tarjetas se repintan en su sitio, sin
   empezar de nuevo como al volver a entrar en el tema (openDoc borra la ronda de Preguntas y el orden de «Barajar»).
   Preguntas no se toca: su IPA sale al contestar y se mira entonces. false: no es cosa suya (Escribir, que guarda su
   práctica, y las demás pantallas vuelven a su ruta) */
function repaint(){
  const id = state.doc, m = state.mode;
  if(!id || hashPath() !== "doc/" + id || !$("#view") || !["lista", "tarjetas", "test"].includes(m)) return false;
  if(m !== "test") getDoc(id).then(doc => { if(hashPath() === "doc/" + id && state.doc === id && state.mode === m && $("#view")) draw(doc); }).catch(() => {});
  return true;
}

/* ---------- Lista ---------- */
function lista(doc){
  const v = $("#view"), lc = code(), all = doc.rows, m = srsAll();
  let html = "", cat = null, open = false, n = 0;
  for(let i = 0; i < all.length; i++){
    const r = all[i];
    if(r.cat){ cat = r.cat; continue; }
    const d = r.l && r.l[lang]; if(!r.es || !d) continue;
    if(cat !== null || !open){ if(open) html += `</div>`; if(cat !== null) html += `<h3 class="dl-cat">${esc(catT(cat, doc.id))}</h3>`; html += `<div class="dl-g st-g">`; open = true; cat = null; }
    n++;
    const q = norm(r.es) + " " + norm(d.word) + " " + norm(d.ex);
    html += `<div class="dl-r${m[srsK(doc.id, r)] ? " in-srs" : ""}" data-i="${i}" data-q="${esc(q)}">
      <div class="dl-act" aria-hidden="true">${ico("plus", "bold", 22)}<span>Al repaso</span></div>
      <div class="dl-fg"><button type="button" class="dl-open" aria-expanded="false" aria-controls="dl-d${i}"><span class="dl-es">${esc(r.es)}</span><span class="dl-w" lang="${esc(lc)}">${esc(d.word)}</span>${m[srsK(doc.id, r)] ? IN_SRS : ""}</button>${spk(d.word)}</div>
      <div class="dl-d" id="dl-d${i}" hidden></div></div>`;
  }
  if(open) html += `</div>`;
  v.innerHTML = `${n > 24 ? `<label class="dl-search">${ico("magnifying-glass", "bold", 20)}<input type="search" id="q" placeholder="Buscar" aria-label="Buscar en español o en ${esc(lname())}" value="${esc(state.q)}" autocomplete="off" spellcheck="false"></label>` : ""}
    <div class="dl" id="dl">${html}</div><p class="ln-empty" id="dl-none" hidden>No hay palabras con eso.</p>`;
  const list = $("#dl");
  /* buscar: se esconden las filas que no coinciden y las secciones que se quedan vacías */
  const filter = () => {
    const q = norm(state.q); let any = 0;
    list.querySelectorAll(".dl-g").forEach(g => {
      let vis = 0;
      g.querySelectorAll(".dl-r").forEach(r => { const ok = !q || r.dataset.q.includes(q); r.hidden = !ok; if(ok) vis++; });
      g.hidden = !vis; const h = g.previousElementSibling; if(h && h.classList.contains("dl-cat")) h.hidden = !vis;
      any += vis;
    });
    $("#dl-none").hidden = !!any;
  };
  const qi = $("#q"); if(qi){ qi.addEventListener("input", () => { state.q = qi.value; filter(); }); if(state.q) filter(); }
  /* tocar la fila: el detalle */
  list.addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if(add){ const row = add.closest(".dl-r"); toReview(doc, row, add); return; }
    const o = e.target.closest(".dl-open"); if(!o) return;
    const row = o.closest(".dl-r"), d = row.querySelector(".dl-d"), on = o.getAttribute("aria-expanded") !== "true";
    if(on && !d.innerHTML) d.innerHTML = detailHtml(doc, all[+row.dataset.i]);
    o.setAttribute("aria-expanded", on); d.hidden = !on; row.classList.toggle("is-open", on);
    if(on){
      if(!rm()) try{ d.animate([{opacity: 0, transform: "translateY(-6px)"}, {opacity: 1, transform: "none"}], {duration: 200, easing: "ease-out"}); }catch(_){}
      const big = d.querySelector(".ln-spk.lg");
      if(big && W.G && typeof G.hold === "function") gest(G.hold(big, {onHold: () => say(big.dataset.say, big, true)}));
    }
  });
  /* deslizar a la izquierda (como en Mail): al repaso */
  if(haveG()) list.querySelectorAll(".dl-r").forEach(row => {
    const fg = row.querySelector(".dl-fg"), act = row.querySelector(".dl-act");
    gest(G.swipe(fg, {threshold: .3,
      onMove: ({dx}) => { const x = Math.min(0, dx); row.style.setProperty("--dl-h", fg.offsetHeight + "px"); row.classList.toggle("is-swiping", x < 0); fg.style.translate = `${x}px 0`;
        act.classList.toggle("is-armed", -x > fg.offsetWidth * .3); },
      onLeft: () => {
        const added = toReview(doc, row, null);
        act.classList.add("is-done"); act.innerHTML = `${ico("check", "bold", 22)}<span>${added ? "¡Al repaso!" : "Ya está"}</span>`;
        const back = () => { fg.style.transition = rm() ? "none" : "translate .28s cubic-bezier(.3,.8,.3,1)"; fg.style.translate = "0px 0";
          setTimeout(() => { fg.style.transition = ""; row.classList.remove("is-swiping"); act.classList.remove("is-done", "is-armed");
            act.innerHTML = `${ico("plus", "bold", 22)}<span>Al repaso</span>`; }, rm() ? 0 : 300); };
        fg.style.transition = rm() ? "none" : "translate .18s ease-out"; fg.style.translate = `${-Math.min(fg.offsetWidth * .45, 180)}px 0`;
        setTimeout(back, rm() ? 350 : 520);
      },
      onCancel: () => { fg.style.transition = rm() ? "none" : "translate .25s cubic-bezier(.3,.8,.3,1)"; fg.style.translate = "0px 0";
        setTimeout(() => { fg.style.transition = ""; row.classList.remove("is-swiping"); }, rm() ? 0 : 260); }}));
  });
  /* mantener pulsada una palabra: el menú de js/ctxmenu.js (Oír, Oír despacio, Al repaso), lo mismo que sus botones */
  if(W.vocabMenu) list.querySelectorAll(".dl-r").forEach(row => gest(vocabMenu.hold(row.querySelector(".dl-fg"), () => wordMenu(doc, row), {radius: 14})));
  const first = list.querySelector(".dl-r .dl-fg");
  if(first) setTimeout(() => { if(state.mode === "lista" && first.isConnected) hint(first, {id: "doc-swipe", gesture: "left", text: "Desliza para el repaso"}); }, 900);
}
/* el menú de una palabra de la lista: su altavoz, la tortuga y «Al repaso» del detalle (tocar la copia abre el detalle) */
function wordMenu(doc, row){
  const r = doc.rows[+row.dataset.i], d = r && r.l && r.l[lang]; if(!d) return null;
  const lc = code(), inSrs = !!srsAll()[srsK(doc.id, r)];
  return {title: d.word, sub: r.es, lang: lc, ipa: ipaHtml(d.ipa, lc), items: [
    {id: "say", t: "Oír", ic: "speaker-high", st: "fill", say: d.word},
    {id: "slow", t: "Oír despacio", ic: "turtle", st: "fill", say: d.word, slow: true},
    inSrs ? {id: "srs", t: "Ya está en el repaso", ic: "check", disabled: true} : {id: "srs", t: "Al repaso", ic: "plus", fn: () => toReview(doc, row, null)},
  ], tap: () => { const o = row.querySelector(".dl-open"); if(o) o.click(); }};
}
/* el nombre de la línea de las formas: «Plural» en los nombres, «Formas» en lo demás (verbos, adjetivos…) */
const formsK = r => !r.pos || r.pos === "noun" ? "Plural" : "Formas";
function detailHtml(doc, r){
  const d = r.l[lang], lc = code(), ipa = ipaHtml(d.ipa, lc, "", false), inSrs = !!srsAll()[srsK(doc.id, r)];
  const pron = d.pron && norm(d.pron) !== norm(d.word) ? d.pron : "";
  return `<div class="dl-dd">${r.img ? picHtml(r, "dl-pic") : ""}<div class="dl-info">
    <div class="dl-hear">${spk(d.word, "lg", "space")}${slowB(d.word, "shift+space")}</div>
    ${pron ? `<p class="dl-ln"><span class="dl-k">Se dice</span>«${esc(pron)}»</p>` : ""}
    ${ipa ? `<p class="dl-ln"><span class="dl-k">IPA</span>${ipa}</p>` : ""}
    ${d.forms ? `<p class="dl-ln"><span class="dl-k">${formsK(r)}</span><span lang="${esc(lc)}">${esc(d.forms)}</span></p>` : ""}
    ${d.ex ? `<div class="dl-ex"><p lang="${esc(lc)}">${esc(d.ex)} ${spk(d.ex, "sm")}</p>${d.ex_es ? `<p class="dl-ex-tr">${esc(d.ex_es)}</p>` : ""}</div>` : ""}
    <button type="button" class="glass-btn glass-btn--sm dl-add" data-add>${inSrs ? `${ico("check", "bold", 18)}En el repaso` : `${ico("plus", "bold", 18)}Al repaso`}</button>
  </div></div>`;
}
/* manda una palabra al repaso: la misma llamada que el «➕ Al repaso» de antes (srsAdd(id, filas, 0)) */
function toReview(doc, row, btn){
  const r = doc.rows[+row.dataset.i]; if(!r) return 0;
  const n = srsAdd(doc.id, [r], 0);
  toast(n ? `«${r.es}» va al repaso` : `«${r.es}» ya estaba en el repaso`, ico("check-circle", "fill", 20));
  row.classList.add("in-srs");
  const o = row.querySelector(".dl-open"); if(o && !o.querySelector(".dl-srs")) o.insertAdjacentHTML("beforeend", IN_SRS);
  const b = btn || row.querySelector("[data-add]");
  if(b) b.innerHTML = `${ico("check", "bold", 18)}En el repaso`;
  if(n){ if(btn && W.M) try{ M.ok(btn); }catch(_){} if(W.G && G.haptic) try{ G.haptic("success"); }catch(_){} }
  return n;
}

/* ---------- Tarjetas ---------- */
function tarjetas(doc, anim){
  clearGest();
  const v = $("#view"), list = entries(doc), s = state.fc, lc = code();
  if(!s.order || s.order.length !== list.length) s.order = list.map((_, i) => i);
  if(s.i >= list.length) s.i = 0;
  const r = list[s.order[s.i]]; if(!r){ v.innerHTML = `<p class="ln-empty">Aquí aún no hay palabras.</p>`; return; }
  const d = r.l[lang], ipa = ipaHtml(d.ipa, lc);
  const pron = d.pron && norm(d.pron) !== norm(d.word) ? d.pron : "";
  const front = s.rev
    ? `<p class="fcx-w" lang="${esc(lc)}">${esc(d.word)}</p><div class="fcx-hear">${spk(d.word, "lg", "space")}</div>`
    : `${picHtml(r)}<p class="fcx-w">${esc(r.es)}</p>`;
  const back = `${picHtml(r)}<p class="fcx-es">${esc(r.es)}</p><p class="fcx-w" lang="${esc(lc)}">${esc(d.word)}</p>
    <div class="fcx-hear">${spk(d.word, "lg", "space")}${slowB(d.word, "shift+space")}</div>
    ${pron || ipa ? `<p class="fcx-meta">${pron ? `Se dice «${esc(pron)}»` : ""}${ipa}</p>` : ""}
    ${d.forms ? `<p class="fcx-meta"><b class="fcx-k">${formsK(r)}:</b> <span lang="${esc(lc)}">${esc(d.forms)}</span></p>` : ""}
    ${d.ex ? `<div class="fcx-ex"><p lang="${esc(lc)}">${esc(d.ex)} ${spk(d.ex, "sm")}</p>${d.ex_es ? `<p class="fcx-tr">${esc(d.ex_es)}</p>` : ""}</div>` : ""}`;
  v.innerHTML = `<div class="fcx">
    <p class="fcx-n" aria-live="polite">${s.i + 1} / ${list.length}</p>
    <div class="fcx-card${s.flip ? " is-back" : ""}${s.flip && pron && ipa ? " say2" : ""}" id="card" role="button" tabindex="0"${!s.flip && !s.rev ? ' data-key="space" data-key-pos="in"' : ""} aria-label="${s.flip ? `${esc(r.es)}: ${esc(d.word)}. Toca para volver` : "Toca para ver la respuesta"}">${s.flip ? back : front}${s.flip ? "" : `<p class="fcx-tap">${ico("hand-pointing", "bold", 20)}Toca para ver</p>`}</div>
    <div class="fcx-nav"><button type="button" class="glass-btn glass-btn--icon fcx-prev" id="prev" aria-label="Anterior" data-key="left">${ico("caret-left", "bold", 26)}</button>
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg fcx-next" id="next" data-key="right enter">Siguiente</button></div>
    <div class="fcx-more">
      <button type="button" class="glass-btn glass-btn--sm" id="auto" aria-pressed="${!!s.auto}">${s.auto ? `${ico("pause", "bold", 18)}Parar` : `${ico("play", "bold", 18)}Automático`}</button>
      <button type="button" class="glass-btn glass-btn--sm" id="shuf">${ico("shuffle", "bold", 18)}Barajar</button>
      <button type="button" class="glass-btn glass-btn--sm" id="rev">${ico("swap", "bold", 18)}${s.rev ? "Ver primero en español" : `Ver primero en ${esc(lname())}`}</button>
    </div></div>`;
  const card = $("#card");
  card.querySelectorAll(".fcx-w").forEach(el => fitWord(el, 28));   /* la palabra entera, sin partir */
  if(anim && !rm()) try{
    if(anim === "flip") card.animate([{transform: "perspective(900px) rotateY(80deg)", opacity: .4}, {transform: "none", opacity: 1}], {duration: 260, easing: "cubic-bezier(.2,.8,.3,1)"});
    else card.animate([{transform: `translateX(${anim === "next" ? 48 : -48}px)`, opacity: 0}, {transform: "none", opacity: 1}], {duration: 240, easing: "cubic-bezier(.2,.8,.3,1)"});
  }catch(_){}
  else if(anim) try{ card.animate([{opacity: 0}, {opacity: 1}], {duration: 150, easing: "ease-out"}); }catch(_){}
  const stop = () => { if(s.auto){ s.auto = false; autoTok++; try{ speechSynthesis.cancel(); }catch(_){} } };
  const go = k => { stop(); s.i = (s.i + k + list.length) % list.length; s.flip = false; tarjetas(doc, k > 0 ? "next" : "prev"); };
  const flip = () => { stop(); s.flip = !s.flip; tarjetas(doc, "flip"); if(s.flip && !s.rev) say(d.word);
    if(s.flip) bus.emit("doc-flip", {id: doc.id, i: s.order[s.i], n: list.length});   /* tarjeta girada: js/shortcuts.js */
    const c = $("#card"); if(c) c.focus({preventScroll: true}); };
  card.addEventListener("click", e => { if(e.target.closest("[data-say]")) return; flip(); });
  /* con el foco en la tarjeta: Enter la gira; Espacio también mientras no hay altavoz (si lo hay, Espacio es oír: js/keys.js) */
  card.addEventListener("keydown", e => { if(e.target === card && (e.key === "Enter" || (e.key === " " && !s.flip && !s.rev))){ e.preventDefault(); flip(); } });
  $("#auto").onclick = () => { if(s.auto){ stop(); tarjetas(doc); } else fcAuto(doc); };
  $("#prev").onclick = () => go(-1); $("#next").onclick = () => go(1);
  $("#shuf").onclick = () => { stop(); s.order = shuffle(list.map((_, i) => i)); s.i = 0; s.flip = false; tarjetas(doc, "next"); };
  $("#rev").onclick = () => { stop(); s.rev = !s.rev; s.flip = false; tarjetas(doc, "flip"); };
  D.onkeydown = e => {
    if(state.mode !== "tarjetas" || !card.isConnected){ D.onkeydown = null; return; }
    if(e.target.closest && e.target.closest("input,textarea,select,[contenteditable]")) return;
    if(D.querySelector("dialog[open]")) return;
    if(e.key === "ArrowRight"){ e.preventDefault(); go(1); } else if(e.key === "ArrowLeft"){ e.preventDefault(); go(-1); }
  };
  /* deslizar la tarjeta: izquierda = siguiente, derecha = anterior (también con los botones y ← →) */
  if(haveG()) gest(G.swipe(card, {
    onMove: ({dx}) => { card.style.translate = `${dx}px 0`; card.style.rotate = `${(dx / 28).toFixed(2)}deg`; },
    onLeft: () => go(1), onRight: () => go(-1),
    onCancel: () => { card.style.transition = rm() ? "none" : "translate .25s ease,rotate .25s ease"; card.style.translate = "0px 0"; card.style.rotate = "0deg";
      setTimeout(() => { if(card.isConnected) card.style.transition = ""; }, 260); }}));
  const big = card.querySelector(".ln-spk.lg");
  if(big && W.G && typeof G.hold === "function") gest(G.hold(big, {onHold: () => say(big.dataset.say, big, true)}));
}
/* secuencia automática: solo suena el idioma que se estudia, nunca el español */
async function fcAuto(doc){
  const s = state.fc, tok = ++autoTok;
  const alive = () => tok === autoTok && s.auto && state.mode === "tarjetas" && D.getElementById("card");
  s.auto = true;
  while(true){
    const list = entries(doc); if(!list.length) break;
    if(s.i >= list.length) s.i = 0;
    const d = list[s.order ? s.order[s.i] : s.i].l[lang];
    s.flip = false; tarjetas(doc);
    if(s.rev){ await sleep(500); if(!alive()) return; await sayP(d.word); await sleep(1200); }
    else await sleep(2000);
    if(!alive()) return;
    s.flip = true; tarjetas(doc);
    if(!s.rev){ await sayP(d.word); if(!alive()) return; await sleep(700); }
    if(d.ex){ if(!alive()) return; await sayP(d.ex); }
    await sleep(1500);
    if(!alive()) return;
    s.i = (s.i + 1) % list.length;
  }
}

/* ---------- Preguntas (antes «Test») ---------- */
/* ninguna respuesta se parte a media palabra: si una no cabe, las 4 bajan de tamaño juntas; solo si ni así cabe, se parte */
function fitQz(v){
  const box = v && v.querySelector(".qz-opts"); if(!box) return;
  const ots = [...box.querySelectorAll(".qz-ot")];
  const over = t => t.scrollWidth > t.clientWidth + 1;
  /* con la ✓ o la ✗ al lado no cabe: se pone encima */
  box.querySelectorAll(".qz-opt").forEach(o => {
    const t = o.querySelector(".qz-ot"); if(t && o.querySelector(".chk,.xm") && over(t)) o.classList.add("is-stack");
  });
  for(const c of ["is-long", "is-xlong", "is-break"]){ if(!ots.some(over)) return; box.classList.add(c); }
}
function test(doc){
  clearGest();
  const v = $("#view"), list = entries(doc), lc = code();
  if(list.length < 4){ v.innerHTML = `<p class="ln-empty">Para las preguntas hacen falta 4 palabras.</p>`; return; }
  if(!state.test){ state.test = {qs: shuffle(list).slice(0, Math.min(10, list.length)), i: 0, ok: 0, done: false}; }
  const t = state.test;
  if(t.i >= t.qs.length){
    const N = t.qs.length;
    v.innerHTML = `<div class="qz qz-end"><div class="qz-card">
      <div class="qz-fox">${typeof heroHtml === "function" ? heroHtml(84) : ""}</div>
      <p class="qz-score" id="qz-score"><b>${t.ok}</b> / ${N}</p>
      <p class="qz-msg">${t.ok === N ? "¡Perfecto!" : t.ok >= N * 0.7 ? "¡Muy bien!" : "¡Sigue así! Las tarjetas te ayudan."}</p></div>
      <div class="qz-go"><button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" id="again" data-key="enter">${ico("arrow-counter-clockwise", "bold", 20)}Otra ronda</button></div></div>`;
    if(!t.paid){ t.paid = true; if(t.ok) award(t.ok, "¡Preguntas terminadas!", false, $("#qz-score")); bus.emit("doc-done", {id: doc.id, mode: "test", ok: t.ok, n: N}); }
    $("#again").onclick = () => { state.test = null; test(doc); };
    D.onkeydown = e => { if(state.mode !== "test" || !$("#again")){ D.onkeydown = null; return; } if(e.key === "Enter" && !(e.target.closest && e.target.closest("button,a,input"))){ e.preventDefault(); $("#again").click(); } };
    return;
  }
  const r = t.qs[t.i], d = r.l[lang];
  const pool = shuffle(list.filter(x => x !== r && x.l[lang].word !== d.word)).slice(0, 3);
  const opts = shuffle([r, ...pool]), long = opts.some(o => String(o.l[lang].word).length > 11);
  v.innerHTML = `<div class="qz">
    <div class="qz-top"><div class="qz-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${t.qs.length}" aria-valuenow="${t.i}" aria-label="Pregunta ${t.i + 1} de ${t.qs.length}"><i style="width:${(100 * t.i / t.qs.length).toFixed(1)}%"></i></div>
      <span class="qz-n">${t.i + 1}/${t.qs.length}</span></div>
    <div class="qz-card">${picHtml(r)}<h2 class="qz-ask">¿Cuál es <q>${esc(inQ(r.es, state.doc))}</q>?</h2></div>
    <div class="qz-opts${long ? " is-long" : ""}" role="group" aria-label="Respuestas">${opts.map((o, i) =>
      `<button type="button" class="qz-opt" data-i="${i}" data-press="sink" data-key="${i + 1}" lang="${esc(lc)}"><kbd class="ln-kbd" aria-hidden="true">${i + 1}</kbd><span class="qz-ot">${esc(o.l[lang].word)}</span></button>`).join("")}</div>
    <p class="qz-fb" id="qz-fb" role="status"></p>
    <div class="qz-go"><button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" id="nextq" data-key="enter" hidden>Seguir</button></div></div>`;
  const btns = [...v.querySelectorAll(".qz-opt")], fb = $("#qz-fb"), next = $("#nextq");
  fitQz(v);
  btns.forEach(b => b.onclick = () => {
    if(t.answered === t.i) return; t.answered = t.i;
    const pick = opts[+b.dataset.i], good = pick === r;
    if(good) t.ok++;
    bus.emit("answer", {ok: good, es: r.es, word: d.word, where: "test"});
    srsGrade(state.doc, r, good ? 2 : 0);
    let right = null;
    btns.forEach(x => {
      x.disabled = true;
      if(opts[+x.dataset.i] === r){ right = x; x.classList.add("is-ok"); x.insertAdjacentHTML("afterbegin", CHK); x.insertAdjacentHTML("beforeend", `<span class="vh" lang="es"> (correcta)</span>`); }
      else if(x === b){ x.classList.add("is-miss"); x.insertAdjacentHTML("afterbegin", ico("x", "bold", 22, "xm")); x.insertAdjacentHTML("beforeend", `<span class="vh" lang="es"> (tu respuesta)</span>`); }
      else x.classList.add("is-dim");
    });
    fitQz(v);   /* la ✓ y la ✗ quitan sitio: que la palabra siga entera */
    if(good && W.M) try{ M.ok(right, {haptic: true}); }catch(_){}
    const ipa = ipaOn() && d.ipa ? `<small>${ipaHtml(d.ipa, lc)}</small>` : "";
    fb.className = "qz-fb" + (good ? "" : " miss");
    fb.innerHTML = good ? `${PRAISE[Math.floor(Math.random() * PRAISE.length)]}${spk(d.word, "sm")}${ipa}`
      : `¡Casi! Es <b lang="${esc(lc)}">«${esc(d.word)}»</b>${spk(d.word, "sm")}${ipa}`;
    say(d.word);
    next.textContent = t.i + 1 >= t.qs.length ? "Ver resultado" : "Seguir";
    next.hidden = false; next.focus({preventScroll: true});
    /* en un móvil bajo, «Seguir» puede quedar bajo la barra de pestañas: se sube lo justo */
    try{ next.scrollIntoView({block: "nearest", behavior: rm() ? "auto" : "smooth"}); }catch(_){}
  });
  next.onclick = () => { t.i++; test(doc); };
  D.onkeydown = e => {
    if(state.mode !== "test" || !next.isConnected){ D.onkeydown = null; return; }
    if(D.querySelector("dialog[open]")) return;
    const k = +e.key;
    if(k >= 1 && k <= btns.length && t.answered !== t.i){ e.preventDefault(); btns[k - 1].click(); }
    else if(e.key === "Enter" && !next.hidden && D.activeElement !== next){ e.preventDefault(); next.click(); }
  };
}

/* ---------- Escribir (la práctica de repeticiones de antes: «Práctica 21») ---------- */
const ACTS = {
  escuchar: {ic: "speaker-high", name: "Escuchar", hint: "Oyes la palabra"},
  leer:     {ic: "eye",          name: "Leer",     hint: "Lees la palabra y su ejemplo"},
  escribir: {ic: "pencil-simple", name: "Escribir", hint: "La escribes de memoria"},
  hablar:   {ic: "microphone",   name: "Hablar",   hint: "La dices en voz alta"},
  dictado:  {ic: "keyboard",     name: "Dictado",  hint: "Escribes la frase que oyes"},
};
/* el dictado necesita una frase de ejemplo; sin ella se practica la escritura */
const effAct = (r, a) => a === "dictado" && !r.l[lang].ex ? "escribir" : a;
const prKey = id => `pr:${id}:${lang}`;
const prUI = {open: !matchMedia("(max-width:820px)").matches, hist: [], busy: false, auto: store.get("prAuto", true), ex: store.get("prEx", true)};
function practica(doc){
  const s = store.get(prKey(doc.id), null);
  if(s && s.running) return prRun(doc, s);
  prSetup(doc, s);
}
/* al empezar: sube hasta los segmentos para que se vea la barra de progreso */
function toSeg(){
  const sg = $("#dv .dv-seg"); if(!sg) return;
  const r = sg.getBoundingClientRect();
  if(r.top < 0 || r.top > innerHeight * .4) try{ sg.scrollIntoView({block: "start", behavior: rm() ? "auto" : "smooth"}); }catch(e){}
}
function prSetup(doc, saved){
  clearGest();
  const list = entries(doc), lc = code();
  const all = doc.rows.filter(r => r.es && r.l[lang]);
  const prev = store.get("prPrefs", {acts: ["escuchar", "leer", "escribir"], reps: 21});
  prev.acts = (prev.acts || []).filter(a => ACTS[a]);
  const resume = saved && !saved.running && saved.words && saved.words.some(w => w.n < saved.reps) ? saved : null;
  const pct = resume ? Math.round(100 * resume.words.reduce((a, w) => a + Math.min(w.n, resume.reps), 0) / (resume.words.length * resume.reps)) : 0;
  /* arriba, un solo botón destacado («Empezar», con lo de la última vez) y cuántas palabras; lo demás, en «Opciones ›» */
  $("#view").innerHTML = `<div class="pw">
    ${resume ? `<section class="st-g pw-resume" aria-label="Práctica a medias"><div class="st-r"><span class="st-ic">${ico("pencil-simple", "bold", 18)}</span><span class="st-l">Tienes una práctica a medias<small>${pct} % hecho</small></span></div>
      <div class="pw-rb"><button type="button" class="glass-btn glass-btn--pri" id="pr-cont">Seguir</button><button type="button" class="glass-btn" id="pr-drop">Empezar otra</button></div></section>` : ""}
    <div class="pw-go"><button type="button" class="glass-btn ${resume ? "" : "glass-btn--pri "}glass-btn--lg glass-btn--block" id="pr-go">${ico("play", "fill", 20)}Empezar</button><p class="pw-total" id="pr-total" aria-live="polite"></p></div>
    <div class="st-g"><button type="button" class="st-r pw-opt" id="pr-opt" aria-haspopup="dialog" aria-controls="pr-sheet"><span class="st-ic">${ico("gear-six", "bold", 18)}</span><span class="st-l">Opciones<small id="pr-sum"></small></span>${ico("caret-right", "bold", 16, "pw-chev")}</button></div>
    <dialog class="pw-sheet" id="pr-sheet" aria-labelledby="pr-sheet-t"><div class="m-head"><h2 id="pr-sheet-t">Opciones</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Listo</button></div><div class="pw">
    <section class="st-sec" aria-labelledby="pw-h1"><h3 class="st-h" id="pw-h1">¿Qué practicas?</h3><div class="st-g">${Object.entries(ACTS).map(([k, a]) => `
      <label class="st-r"><span class="st-ic${k === "hablar" && !canListen() ? " gr" : ""}">${ico(a.ic, "bold", 18)}</span><span class="st-l">${a.name}<small>${k === "hablar" && !canListen() ? esc(noVoiceMsg()) : a.hint}</small></span>
        <input type="checkbox" class="pw-chk" name="act" value="${k}"${prev.acts.includes(k) ? " checked" : ""}></label>`).join("")}</div></section>
    <section class="st-sec" aria-labelledby="pw-h2"><h3 class="st-h" id="pw-h2">¿Cuántas veces cada palabra?</h3>
      <div class="seg pw-seg" role="radiogroup" aria-labelledby="pw-h2" id="pr-reps">${[7, 14, 21, 30].map(n => `<button type="button" class="seg-i" role="radio" aria-checked="${n === prev.reps}" data-r="${n}">${n}</button>`).join("")}</div></section>
    <section class="st-sec" aria-labelledby="pw-h3"><h3 class="st-h" id="pw-h3">Palabras <span id="pr-n"></span></h3>
      <div class="pw-picks"><button type="button" class="glass-btn glass-btn--sm" data-pick="5">5 al azar</button><button type="button" class="glass-btn glass-btn--sm" data-pick="10">10 al azar</button>
        <button type="button" class="glass-btn glass-btn--sm" data-pick="first">Las 10 primeras</button><button type="button" class="glass-btn glass-btn--sm" data-pick="all">Todas</button><button type="button" class="glass-btn glass-btn--sm" data-pick="none">Ninguna</button></div>
      <div class="st-g pw-words">${list.map(r => `<label class="st-r"><span class="st-l">${esc(r.es)}<small lang="${esc(lc)}">${esc(r.l[lang].word)}</small></span><input type="checkbox" class="pw-chk" name="w" value="${all.indexOf(r)}"></label>`).join("")}</div></section>
    <section class="st-sec" aria-label="Opciones"><div class="st-g">
      <label class="st-r"><span class="st-l">Pasar sola<small>A la siguiente tarjeta</small></span><input type="checkbox" class="st-sw" role="switch" id="pr-o-auto"${prUI.auto ? " checked" : ""}></label>
      <label class="st-r"><span class="st-l">Oír el ejemplo<small>También suena la frase</small></span><input type="checkbox" class="st-sw" role="switch" id="pr-o-ex"${prUI.ex ? " checked" : ""}></label></div></section>
    </div></dialog>
  </div>`;
  let reps = [7, 14, 21, 30].includes(prev.reps) ? prev.reps : 21;
  const boxes = [...D.querySelectorAll("#view input[name=w]")];
  const upd = () => {
    const nw = boxes.filter(b => b.checked).length, acts = Object.keys(ACTS).filter(k => { const x = D.querySelector(`#view input[name=act][value=${k}]`); return !!x && x.checked; });
    $("#pr-n").textContent = `(${nw})`;
    $("#pr-total").textContent = nw && acts.length ? nPal(nw) : "Elige en «Opciones» qué practicas y alguna palabra";
    const names = acts.map(k => ACTS[k].name), list = names.length > 1 ? names.slice(0, -1).join(", ") + " y " + names[names.length - 1] : names[0] || "Nada elegido";
    $("#pr-sum").textContent = `${list} · ${reps} veces cada una`;
    $("#pr-go").disabled = !(nw && acts.length);
  };
  /* la hoja de opciones (dentro de #view: se va con la ficha) */
  const sheet = $("#pr-sheet"); prSheet = sheet;
  $("#pr-opt").onclick = e => { try{ if(W.M && typeof M.openSheet === "function") M.openSheet(sheet, {from: e.currentTarget}); else sheet.showModal(); }catch(_){ try{ sheet.showModal(); }catch(__){} } };
  sheet.addEventListener("click", e => { if(e.target.closest("[data-close]")){ if(W.M && typeof M.closeSheet === "function") M.closeSheet(sheet); else sheet.close(); } });
  sheet.addEventListener("close", () => { if(!sheet.isConnected || !$("#pr-go")) return; upd(); const o = $("#pr-opt"); if(o && D.activeElement === D.body) o.focus({preventScroll: true}); });
  const pick = mode => {
    boxes.forEach(b => b.checked = false);
    if(mode === "all") boxes.forEach(b => b.checked = true);
    else if(mode === "first") boxes.slice(0, 10).forEach(b => b.checked = true);
    else if(mode !== "none") shuffle(boxes).slice(0, +mode).forEach(b => b.checked = true);
    upd();
  };
  pick(list.length > 10 ? "first" : "all");
  D.querySelectorAll("#view [data-pick]").forEach(b => b.onclick = () => pick(b.dataset.pick));
  D.querySelectorAll("#view [data-r]").forEach(b => b.onclick = () => {
    reps = +b.dataset.r; D.querySelectorAll("#view [data-r]").forEach(x => x.setAttribute("aria-checked", x === b)); upd(); });
  D.querySelectorAll("#view input[name=act], #view input[name=w]").forEach(b => b.onchange = upd);
  $("#pr-go").onclick = () => {
    const acts = Object.keys(ACTS).filter(k => D.querySelector(`#view input[name=act][value=${k}]`).checked);
    const words = boxes.filter(b => b.checked).map(b => ({i: +b.value, n: 0}));
    if(!acts.length || !words.length) return;
    store.set("prPrefs", {acts, reps});
    prUI.auto = $("#pr-o-auto").checked; prUI.ex = $("#pr-o-ex").checked; store.set("prAuto", prUI.auto); store.set("prEx", prUI.ex);
    if(sheet.open) try{ sheet.close(); }catch(_){}
    const sess = {running: true, acts, reps, words, cur: 0, step: 0};
    store.set(prKey(doc.id), sess);
    prUI.hist = [];
    prRun(doc, sess); toSeg();
  };
  if(resume){
    $("#pr-cont").onclick = () => { resume.running = true; store.set(prKey(doc.id), resume); prRun(doc, resume); toSeg(); };
    $("#pr-drop").onclick = () => { store.set(prKey(doc.id), null); prSetup(doc, null); };
  }
}
/* qué actividad toca en la repetición n de una palabra */
const actFor = (s, n) => s.acts[n % s.acts.length];
const actCount = (s, n, j) => Math.floor(n / s.acts.length) + (j < n % s.acts.length ? 1 : 0);
const actTarget = (s, j) => Math.floor(s.reps / s.acts.length) + (j < s.reps % s.acts.length ? 1 : 0);
function nextIdx(s, from){
  const L = s.words.length;
  for(let k = 1; k <= L; k++){ const i = (from + k) % L; if(s.words[i].n < s.reps) return i; }
  return -1;
}
/* la tarjeta actual y las que vienen, simulando la cola */
function upcoming(s, k){
  const ns = s.words.map(w => w.n), L = ns.length, out = [];
  let cur = s.cur;
  for(let t = 0; t < k && cur >= 0 && ns[cur] < s.reps; t++){
    out.push({wi: cur, n: ns[cur]});
    ns[cur]++;
    let nx = -1;
    for(let q = 1; q <= L; q++){ const i = (cur + q) % L; if(ns[i] < s.reps){ nx = i; break; } }
    cur = nx;
  }
  return out;
}
function prRun(doc, s){
  clearGest();
  const all = doc.rows.filter(r => r.es && r.l[lang]);
  if(s.words[s.cur] && s.words[s.cur].n >= s.reps){ const n = nextIdx(s, s.cur); if(n >= 0) s.cur = n; }
  const doneReps = s.words.reduce((a, w) => a + Math.min(w.n, s.reps), 0), total = s.words.length * s.reps;
  if(doneReps >= total) return prEnd(doc, s, total);
  const wdone = s.words.filter(w => w.n >= s.reps).length;
  const pct = Math.round(100 * doneReps / total);
  const w = s.words[s.cur], r = all[w.i];
  const seq = upcoming(s, 4), hist = prUI.hist.slice(-3);
  const cards = [...hist.map((h, k) => ({...h, off: k - hist.length})), ...seq.map((q, k) => ({...q, off: k}))];
  $("#view").innerHTML = `<div class="pw"><div class="pr pw-run${prUI.open ? " has-panel" : ""}" id="pr-root">
    <div class="pw-top"><div class="pw-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Práctica hecha"><i style="width:${pct}%"></i></div><span class="pw-pct">${pct} %</span></div>
    <p class="pw-meta"><b>${esc(r.es)}</b> · vez ${w.n + 1} de ${s.reps}</p>
    <section class="pr-stage"><div class="pr-flow pw-flow" id="pr-flow">
      ${cards.map(c => { const rr = all[s.words[c.wi].i]; return prCard(rr, effAct(rr, actFor(s, c.n)), c.off === 0, c.n, s.reps, c.off); }).join("")}
      <div class="pr-dots" aria-hidden="true">${Array.from({length: s.reps}, (_, k) => `<i class="${k < w.n ? "on" : k === w.n ? "now" : ""}"></i>`).join("")}</div>
    </div></section>
    <div class="pw-tools"><button type="button" class="glass-btn glass-btn--sm" id="pr-stop">${ico("pause", "bold", 18)}Pausar</button>
      <button type="button" class="glass-btn glass-btn--sm" id="pr-skip">${ico("check", "bold", 18)}Ya me la sé</button>
      <button type="button" class="glass-btn glass-btn--sm" id="pr-tg" aria-expanded="${prUI.open}" aria-controls="pw-panel">${ico("list", "bold", 18)}Palabras</button></div>
    <aside class="st-g pw-panel" id="pw-panel"${prUI.open ? "" : " hidden"} aria-label="Palabras de la práctica">
      <p class="pw-ph">${wdone} de ${s.words.length} completas</p>
      <ol class="pr-steps">${s.words.map((x, k) => {
        const rr = all[x.i], done = x.n >= s.reps, cur = k === s.cur;
        return `<li class="${done ? "done" : ""} ${cur ? "cur" : ""}" data-k="${k}">
          <span class="dot">${done ? "✓" : k + 1}</span>
          <div><div class="w">${esc(rr.es)}</div>
          <div class="s">${done ? "Completada" : cur ? `Ahora · ${x.n} de ${s.reps}` : x.n ? `${x.n} de ${s.reps}` : "Pendiente"}</div>
          ${cur ? `<div class="acts">${s.acts.map((a, j) => { const c = actCount(s, x.n, j), t = actTarget(s, j);
            return `<span class="${c >= t ? "ok" : ""}">${c >= t ? "✓ " : ""}${ACTS[a].name} (${c}/${t})</span>`; }).join("")}</div>` : ""}
          </div></li>`; }).join("")}</ol>
      <div class="st-g pw-opts">
        <label class="st-r"><span class="st-l">Pasar sola</span><input type="checkbox" class="st-sw" role="switch" id="pr-auto"${prUI.auto ? " checked" : ""}></label>
        <label class="st-r"><span class="st-l">Oír el ejemplo</span><input type="checkbox" class="st-sw" role="switch" id="pr-ex"${prUI.ex ? " checked" : ""}></label></div>
    </aside></div></div>`;
  const flow = $("#pr-flow");
  const els = [...flow.querySelectorAll(".pr-card")];
  /* la tarjeta de ahora puede ser más alta que el hueco de 540 px (la IPA, «Texto más grande», Hablar con su micrófono):
     el hueco crece con ella (8 px arriba; abajo, los puntos), si no se cortaba arriba y abajo sin poder bajar */
  const fitFlow = () => { const c = els.find(el => +el.dataset.off === 0); flow.style.minHeight = c ? c.offsetHeight + 40 + "px" : ""; };
  const layout = () => {
    const W0 = flow.getBoundingClientRect().width, cw = Math.round(Math.min(340, W0 * (W0 < 560 ? 0.86 : 0.64)));
    els.forEach(el => {
      const o = +el.dataset.off, a = Math.abs(o), sg = Math.sign(o);
      const x = a ? sg * (cw * 0.68 + (a - 1) * cw * 0.40) : 0, sc = 1 - 0.13 * a;
      el.style.setProperty("--cw", cw + "px");
      el.style.transform = `translate(${x}px,-50%) scale(${sc})`;
      el.style.zIndex = 10 - a;
      el.style.opacity = a > 3 ? 0 : 1 - 0.1 * Math.max(0, a - 1);
    });
    fitFlow();
  };
  try{
    const c0 = flow.querySelector(".pr-card.cur");
    if(c0 && typeof ResizeObserver === "function"){ const ro = new ResizeObserver(() => { if(D.body.contains(flow) && c0.isConnected) fitFlow(); else ro.disconnect(); }); ro.observe(c0); }
  }catch(e){}
  els.forEach(el => el.style.transition = "none"); layout();
  requestAnimationFrame(() => els.forEach(el => el.style.transition = ""));
  const onResize = () => { if(D.body.contains(flow)) layout(); else removeEventListener("resize", onResize); };
  addEventListener("resize", onResize);

  const save = () => store.set(prKey(doc.id), s);
  const advance = () => {
    if(prUI.busy) return; prUI.busy = true;
    prUI.hist = [...prUI.hist, {wi: s.cur, n: w.n}].slice(-3);
    w.n++; logAct();
    if(w.n === s.reps){ toast(`¡«${r.es}» completada! Vuelve mañana en el repaso`, ico("sparkle", "fill", 20)); srsAdd(doc.id, [r], 1); }
    const n = nextIdx(s, s.cur); if(n >= 0) s.cur = n;
    save();
    els.forEach(el => { el.dataset.off = +el.dataset.off - 1; el.classList.toggle("side", +el.dataset.off !== 0); });
    layout();
    setTimeout(() => { prUI.busy = false; if(state.mode === "practica" && D.body.contains(flow)) prRun(doc, s); }, rm() ? 160 : 520);
  };

  const act = effAct(r, actFor(s, w.n)), card = flow.querySelector(".pr-card.cur");
  const btn = card.querySelector(".pr-next");
  const tok = ++autoTok, alive = () => tok === autoTok && state.mode === "practica" && D.body.contains(flow);
  /* solo suena el idioma que se estudia: la palabra y, si está marcado, el ejemplo */
  const play = async (wbtn) => {
    if(!alive()) return false;
    await sayP(r.l[lang].word, wbtn); if(!alive()) return false;
    if(prUI.ex && r.l[lang].ex){ await sleep(500); if(!alive()) return false; await sayP(r.l[lang].ex, card.querySelector(".pw-ex .say")); }
    return alive();
  };
  const autoNext = async () => { if(prUI.auto && alive()){ await sleep(1000); if(prUI.auto && alive()) advance(); } };
  const XM = ico("x", "bold", 18, "xm");
  let onEnter = () => btn.click();
  if(act === "escuchar" || act === "leer"){
    setTimeout(async () => { if(await play(card.querySelector(".ln-spk.lg") || card.querySelector(".ln-spk"))) autoNext(); }, 420);
    btn.onclick = advance;
  } else if(act === "hablar"){
    const mic = card.querySelector(".mic"), msg = card.querySelector(".pr-msg"), word = r.l[lang].word;
    let ok = false, listening = false;
    setTimeout(() => { if(alive()) sayP(word, card.querySelector(".ln-spk")); }, 420);
    btn.onclick = advance;
    /* sin reconocimiento de voz: la dice en voz alta y toca «Lo he dicho» */
    onEnter = () => ok || !canListen() ? advance() : mic.click();
    mic.onclick = async () => {
      if(listening || ok) return;
      if(!canListen()){ msg.className = "pr-msg"; msg.textContent = noVoiceMsg(); return; }
      autoTok++; const t2 = autoTok; if("speechSynthesis" in W) speechSynthesis.cancel();
      listening = true; mic.classList.add("on"); mic.setAttribute("aria-pressed", "true"); msg.className = "pr-msg"; msg.textContent = "Te escucho… di la palabra";
      const got = await listen();
      listening = false; mic.classList.remove("on"); mic.setAttribute("aria-pressed", "false");
      if(!D.body.contains(flow) || t2 !== autoTok) return;
      if(got.status !== "ok"){
        msg.className = "pr-msg";
        msg.textContent = got.status === "denied" ? "Pide a un mayor que deje usar el micrófono. También puedes tocar «Saltar»."
          : got.status === "timeout" || got.status === "no-speech" ? "No te he oído. Toca el micrófono y prueba otra vez."
          : got.status === "unsupported" ? noVoiceMsg()
          : got.status === "unavailable" && (got.error === "network" || navigator.onLine === false) ? "Sin internet no puedo oírte. Dila en voz alta y toca «Saltar»."
          : got.status === "unavailable" && got.error === "audio-capture" ? "No encuentro el micrófono. Dila en voz alta y toca «Saltar»."
          : got.status === "unavailable" ? "Ahora no puedo oírte. Dila en voz alta y toca «Saltar»." 
          : "El micrófono no ha funcionado. Prueba otra vez o toca «Saltar».";
        return;
      }
      const alts = got.alts;
      if(heard(alts, word)){
        ok = true; msg.className = "pr-msg ok"; msg.innerHTML = `¡Bien dicho! <span style="font-weight:400;color:var(--label2)">Oí «${esc(alts[0])}»</span>`;
        btn.textContent = "Seguir"; btn.classList.add("glass-btn--pri");
        const tok2 = ++autoTok, al2 = () => tok2 === autoTok && D.body.contains(flow);
        if(prUI.ex && r.l[lang].ex){ await sleep(300); if(!al2()) return; await sayP(r.l[lang].ex, card.querySelector(".pw-ex .say")); }
        if(prUI.auto && al2()){ await sleep(1000); if(prUI.auto && al2()) advance(); }
      } else {
        msg.className = "pr-msg";
        msg.innerHTML = alts.length ? `Oí «${esc(alts[0])}». Escúchala otra vez y repite.` : "No te he oído. Toca el micrófono y prueba otra vez.";
      }
    };
  } else if(act === "dictado"){
    const inp = card.querySelector("textarea.ans"), msg = card.querySelector(".pr-msg"), ex = r.l[lang].ex;
    let ok = false, fails = 0;
    setTimeout(() => { if(alive()){ sayP(ex, card.querySelector(".ln-spk.lg")); inp.focus({preventScroll: true}); } }, 520);
    inp.onkeydown = e => { if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); e.stopPropagation(); btn.click(); } };
    btn.onclick = () => {
      if(ok) return advance();
      const res = dictCheck(inp.value, ex);
      if(res.ok){
        ok = true; inp.classList.remove("bad"); inp.classList.add("ok"); inp.readOnly = true; bus.emit("answer", {ok: true, where: "practice"});
        msg.className = "pr-msg ok"; msg.innerHTML = res.perfect ? "¡Perfecto!" : `¡Casi perfecto! <div class="diff">${res.html}</div>`;
        btn.textContent = "Seguir"; btn.focus({preventScroll: true});
        card.querySelector(".tr").hidden = false;
        if(prUI.auto && res.perfect) (async () => { const t3 = ++autoTok; await sleep(1200); if(t3 === autoTok && prUI.auto && D.body.contains(flow)) advance(); })();
      } else {
        fails++; inp.classList.add("bad"); msg.className = "pr-msg bad"; bus.emit("answer", {ok: false, where: "practice"});
        msg.innerHTML = `${XM}${res.hits} de ${res.total} palabras bien. Lo subrayado falta o cambia:<div class="diff">${res.html}</div>`;
        if(fails >= 2){ btn.textContent = "Seguir"; ok = true; card.querySelector(".tr").hidden = false; }
        sayP(ex, card.querySelector(".ln-spk.lg"));
      }
    };
  } else {
    const inp = card.querySelector("input.ans"), msg = card.querySelector(".pr-msg");
    let ok = false, failed = false;
    setTimeout(() => inp.focus({preventScroll: true}), 520);
    btn.onclick = () => {
      if(ok) return advance();
      const res = checkAnswer(inp.value, r.l[lang].word);
      if(res === "ok" || res === "accents"){
        ok = true; inp.classList.remove("bad"); inp.classList.add("ok"); inp.disabled = true; bus.emit("answer", {ok: true, es: r.es, word: r.l[lang].word, where: "practice"});
        msg.className = "pr-msg ok";
        msg.innerHTML = res === "ok" ? (failed ? "¡Ahora sí!" : "¡Correcto!") : `¡Casi! Mira las tildes y letras especiales: <b>${esc(r.l[lang].word)}</b>`;
        btn.textContent = "Seguir"; btn.focus({preventScroll: true});
        const exEl = card.querySelector(".pw-ex"); if(exEl) exEl.hidden = false;
        play().then(ok2 => { if(ok2) autoNext(); });
      } else {
        failed = true; inp.classList.add("bad"); bus.emit("answer", {ok: false, es: r.es, word: r.l[lang].word, where: "practice"});
        msg.className = "pr-msg bad";
        msg.innerHTML = `${XM}Es <b lang="${esc(code())}">${esc(r.l[lang].word)}</b>. Escríbela para seguir.`;
        inp.select();
      }
    };
  }
  D.onkeydown = e => {
    if(state.mode !== "practica" || !D.body.contains(flow)){ D.onkeydown = null; return; }
    if(e.key === "Enter"){ if(e.target.tagName === "TEXTAREA" || (e.target.closest && e.target.closest("button,a,label"))) return; e.preventDefault(); onEnter(); }
  };
  $("#pr-tg").onclick = () => { prUI.open = !prUI.open; prRun(doc, s); };
  $("#pr-auto").onchange = e => { prUI.auto = e.target.checked; store.set("prAuto", prUI.auto); prRun(doc, s); };
  $("#pr-ex").onchange = e => { prUI.ex = e.target.checked; store.set("prEx", prUI.ex); prRun(doc, s); };
  $("#pr-stop").onclick = () => { autoTok++; s.running = false; save(); prUI.hist = []; D.onkeydown = null; prSetup(doc, s); };
  $("#pr-skip").onclick = () => { w.n = s.reps; srsAdd(doc.id, [r], 2); toast(`«${r.es}» ya te la sabes`, ico("check-circle", "fill", 20)); const n = nextIdx(s, s.cur); if(n >= 0) s.cur = n; prUI.hist = []; save(); prRun(doc, s); };
  D.querySelectorAll("#view .pr-steps li").forEach(li => li.onclick = () => {
    const k = +li.dataset.k; if(s.words[k].n >= s.reps || k === s.cur) return;
    s.cur = k; prUI.hist = []; save(); prRun(doc, s);
  });
}
function prCard(r, act, isCur, n, reps, off){
  const d = r.l[lang], a = ACTS[act], lc = esc(code()), ipa = ipaHtml(d.ipa, code());
  const hero = `<div class="pr-hero">${picHtml(r)}<span class="pr-tag">${ico(a.ic, "bold", 14)}${a.name}</span><span class="pr-num">${n + 1}/${reps}</span></div>`;
  if(!isCur) return `<div class="pr-card side" data-off="${off}" aria-hidden="true">${hero}<div class="pr-body"><p class="es2">${esc(r.es)}</p></div></div>`;
  const pron = d.pron && norm(d.pron) !== norm(d.word) ? d.pron : "";
  /* «Se dice «…»» y debajo, en su propia línea, la IPA */
  const meta = pron || ipa ? `<p class="pw-line">${pron ? `Se dice «${esc(pron)}»` : ""}${ipa}</p>` : "";
  const ex = (hidden) => d.ex ? `<div class="pw-ex"${hidden ? " hidden" : ""}><p lang="${lc}">${esc(d.ex)} ${spk(d.ex, "sm")}</p>${d.ex_es ? `<p class="tr">${esc(d.ex_es)}</p>` : ""}</div>` : "";
  const OK = ico("check", "bold", 20);
  let body;
  if(act === "escuchar") body = `
      <p class="es2">${esc(r.es)}</p>
      <div class="sayrow">${spk(d.word, "lg")}${slowB(d.word)}</div>
      <p class="big" lang="${lc}">${esc(d.word)}</p>${meta}
      ${d.ex ? ex(false) : `<p class="pw-line">Escúchala y repítela en voz alta</p>`}
      <button type="button" class="glass-btn glass-btn--pri pr-next">${OK}Escuchado</button>`;
  else if(act === "leer") body = `
      <p class="es2">${esc(r.es)}</p>
      <p class="big" lang="${lc}">${esc(d.word)} ${spk(d.word)}</p>
      ${meta}${d.forms ? `<p class="pw-line"><b class="pw-k">${formsK(r)}:</b> <span lang="${lc}">${esc(d.forms)}</span></p>` : ""}${ex(false)}
      <button type="button" class="glass-btn glass-btn--pri pr-next">${OK}Leído</button>`;
  else if(act === "hablar") body = `
      <p class="es2">${esc(r.es)}</p>
      <p class="big" lang="${lc}">${esc(d.word)} ${spk(d.word)}</p>${meta}
      ${canListen() ? `<button type="button" class="mic" aria-label="Hablar" aria-pressed="false">${ico("microphone", "bold", 30)}</button>
      <p class="pr-msg">Escúchala, toca el micrófono y dila</p>` : `<button type="button" class="mic" aria-label="Hablar" hidden>${ico("microphone", "bold", 30)}</button>
      <p class="pr-msg">Escúchala y dila en voz alta. Luego toca «Lo he dicho».</p>`}
      ${ex(false)}
      ${canListen() ? `<button type="button" class="glass-btn pr-next">Saltar</button>` : `<button type="button" class="glass-btn glass-btn--pri pr-next">${OK}Lo he dicho</button>`}`;
  else if(act === "dictado") body = `
      <p class="es2">${esc(r.es)} · <span lang="${lc}" style="color:var(--label)">${esc(d.word)}</span></p>
      <div class="sayrow">${spk(d.ex, "lg")}${slowB(d.ex)}</div>
      <p class="pw-line">Escucha la frase y escríbela</p>
      <textarea class="ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Escribe lo que oyes…" aria-label="La frase que oyes" lang="${lc}"></textarea>
      <div class="pr-msg" role="status"></div>
      <p class="tr pw-line" hidden lang="${lc}">${esc(d.ex)}<br><i lang="es">${esc(d.ex_es)}</i></p>
      <button type="button" class="glass-btn glass-btn--pri pr-next">Comprobar</button>`;
  else body = `
      <p class="es2">${esc(r.es)}</p>
      <p class="pw-line">¿Cómo se escribe en ${esc(lname())}? ${spk(d.word, "sm")}</p>
      <input class="ans" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Escribe la palabra…" aria-label="La palabra en ${esc(lname())}" lang="${lc}">
      <div class="pr-msg" role="status"></div>
      ${ex(true)}
      <button type="button" class="glass-btn glass-btn--pri pr-next">Comprobar</button>`;
  return `<div class="pr-card cur" data-off="0">${hero}<div class="pr-body">${body}</div></div>`;
}
/* validación superficial: sin mayúsculas, signos ni artículo obligatorio */
function checkAnswer(ans, target){
  const norm2 = x => x.toLowerCase().replace(/[’`´]/g, "'").replace(/[.,!?¿¡;:"()…]/g, " ").replace(/\s+/g, " ").trim();
  const bare = x => x.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/g, "o").replace(/æ/g, "ae").replace(/œ/g, "oe");
  const art = /^(le |la |les |l'|un |une |des |en |et |at |to |the |a |an )/;
  const cands = new Set();
  for(let t of String(target).split(/\s\/\s|,\s/)){
    t = norm2(t.replace(/\((m|f|pl|m\.\/f)\.?\)/g, "").replace(/\(.*?\)/g, ""));
    if(!t) continue;
    cands.add(t); cands.add(t.replace(art, "").trim());
  }
  const a = norm2(ans); if(!a) return "bad";
  const a2 = a.replace(art, "").trim();
  if(cands.has(a) || cands.has(a2)) return "ok";
  for(const c of cands) if(bare(c) === bare(a) || bare(c) === bare(a2)) return "accents";
  return "bad";
}
const nrm = x => String(x).toLowerCase().replace(/[’`´]/g, "'").replace(/[.,!?¿¡;:"()«»…—–-]/g, " ").replace(/\s+/g, " ").trim();
const bareS = x => x.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/g, "o").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/å/g, "a");
/* basta con que la palabra aparezca en lo que se oyó (sin artículo ni tildes) */
function heard(alts, target){
  const art = /^(le |la |les |l'|un |une |des |en |et |at |to |the |a |an )/;
  const cands = String(target).split(/\s\/\s|,\s/).map(t => bareS(nrm(t.replace(/\(.*?\)/g, ""))).replace(art, "").trim()).filter(Boolean);
  return alts.some(a => { const A = " " + bareS(nrm(a)) + " "; return checkAnswer(a, target) !== "bad" || cands.some(c => A.includes(" " + c + " ")); });
}
/* dictado: palabras en común en orden (LCS); se aceptan tildes olvidadas como "casi" */
function dictCheck(ans, ref){
  const R = nrm(ref).split(" ").filter(Boolean), A = nrm(ans).split(" ").filter(Boolean);
  const match = eq => {
    const dp = Array.from({length: R.length + 1}, () => new Array(A.length + 1).fill(0));
    for(let i = R.length - 1; i >= 0; i--) for(let j = A.length - 1; j >= 0; j--)
      dp[i][j] = eq(R[i], A[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const hit = new Array(R.length).fill(false); let i = 0, j = 0;
    while(i < R.length && j < A.length){ if(eq(R[i], A[j])){ hit[i] = true; i++; j++; } else if(dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
    return hit;
  };
  const exact = match((a, b) => a === b), loose = match((a, b) => bareS(a) === bareS(b));
  const hits = loose.filter(Boolean).length, extra = Math.max(0, A.length - hits);
  const words = String(ref).split(/\s+/);
  const html = words.length === R.length ? words.map((w, k) => exact[k] ? esc(w) : `<span class="x">${esc(w)}</span>`).join(" ") : esc(ref);
  return {ok: hits >= Math.ceil(R.length * 0.9) && extra <= 1, perfect: exact.every(Boolean) && extra === 0, hits, total: R.length, html};
}
function prEnd(doc, s, total){
  clearGest();
  const all = doc.rows.filter(r => r.es && r.l[lang]), n = s.words.length;
  $("#view").innerHTML = `<div class="pw pw-end"><div class="st-g pw-end-c">
    <div class="pw-fox" id="pw-fox">${typeof heroHtml === "function" ? heroHtml(90) : ""}</div><h2 class="pw-end-t">¡Práctica completada!</h2>
    <p class="pw-end-s">${total} repeticiones de ${n === 1 ? "1 palabra" : `${n} palabras`}: <span lang="${esc(code())}">${s.words.map(w => esc(all[w.i].l[lang].word)).join(", ")}</span>.</p></div>
    <div class="pw-end-b"><button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="pr-new">Otras palabras</button><button type="button" class="glass-btn glass-btn--lg" id="pr-again">${ico("arrow-counter-clockwise", "bold", 20)}Repetir estas</button></div></div>`;
  award(15, "¡Práctica completada!", false, $("#pw-fox"));
  store.set(prKey(doc.id), null);
  bus.emit("doc-done", {id: doc.id, mode: "practica"});   /* un tema terminado en un modo (js/shortcuts.js) */
  D.onkeydown = null; prUI.hist = [];
  $("#pr-new").onclick = () => prSetup(doc, null);
  $("#pr-again").onclick = () => { s.words.forEach(w => w.n = 0); s.cur = 0; s.running = true; store.set(prKey(doc.id), s); prRun(doc, s); };
}

/* ===================== Gramática ===================== */
const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
function theory(x){
  const lc = esc(code());
  return `${(x.rules || []).map(r => `<div class="gr-rule"><h3>${esc(r.h)}</h3><p>${md(r.p)}</p>
      ${r.tab ? `<div class="gr-tw"><table class="gr-tab">${r.tab.map(row => `<tr>${row.map(c => `<td>${md(c)}</td>`).join("")}</tr>`).join("")}</table></div>` : ""}</div>`).join("")}
    ${(x.ex || []).length ? `<div class="gr-ex"><h3>Ejemplos</h3>${x.ex.map(e => `<p><span lang="${lc}">${esc(e.t)}</span> ${spk(e.t, "sm")}<small>${esc(e.es)}</small></p>`).join("")}</div>` : ""}`;
}
/* los juegos de gramática (js/grammargames.js) abren en el nivel que se está mirando: store "gram:lv" es {idioma: nivel} */
const GR_GAMES = [["ordenafrase", "Ordena la frase"], ["completa", "Completa la frase"], ["detective", "Detective de errores"]];
async function gramatica(lv){
  await getMap();
  if(secOf(hashPath()) !== "gramatica") return;
  clearGest();
  const G0 = GRAM[lang] || {};
  if(!LVS[lv]){ const sv = store.get("mapLv", "A1"); lv = LVS[sv] ? sv : "A1"; }
  const P = mapP(), list = G0[lv] || [];
  const info = k => { const g = G0[k] || []; return {done: g.filter((_, i) => P[gId(k, i)]).length, total: g.length}; };
  $("#app").innerHTML = `<div class="gr" id="gr">
    <div class="cm-top">${levelPicker(lv, "#/gramatica/", {info, what: "temas"})}<p class="cm-sum"><b>${esc(LVS[lv].n)}</b> · ${list.length === 1 ? "1 tema" : `${list.length} temas`}</p></div>
    ${list.length ? `<nav class="gr-play" aria-label="Juega con la gramática"><h2 class="gr-ph">Juega con la gramática</h2><div class="gr-pl">${GR_GAMES.map(([id, t]) =>
      `<a class="gr-pg" href="#/juegos/${id}" data-g="${id}"><img src="img/games/${id}.png" alt="" width="56" height="56">${esc(t)}</a>`).join("")}</div></nav>` : ""}
    ${list.length ? `<div class="st-g gr-list">${list.map((x, k) => { const st = P[gId(lv, k)] || 0; return `<details class="gr-u${st ? " is-done" : ""}" data-k="${k}">
      <summary class="st-r gr-s"><span class="gr-n" aria-hidden="true">${st ? ico("check", "bold", 18) : k + 1}</span><span class="st-l gr-tl">${esc(x.t)}</span>
        ${st ? `<span class="gr-st" role="img" aria-label="${st} de 3 estrellas">${stars(st, 15)}</span>` : ""}${ico("caret-down", "bold", 18, "gr-car")}</summary>
      <div class="gr-b">${x.sum ? `<p class="gr-sum">${md(x.sum)}</p>` : ""}${theory(x)}<div class="gr-go"><a class="glass-btn glass-btn--pri" href="#/leccion/${esc(gId(lv, k))}">${ico("play", "fill", 18)}Practicar</a></div></div></details>`; }).join("")}</div>`
      : `<p class="ln-empty">Pronto habrá gramática de este nivel.</p>`}
  </div>`;
  $("#gr").querySelectorAll(".gr-pg").forEach(a => a.addEventListener("click", () => {
    const o = store.get("gram:lv", null), n = o && typeof o === "object" && !Array.isArray(o) ? o : {};
    n[lang] = lv; store.set("gram:lv", n);
  }));
  /* una abierta a la vez: así solo hay un «Practicar» destacado */
  const box = $("#gr .gr-list");
  if(box) box.addEventListener("toggle", e => {
    const d = e.target; if(!d.open) return;
    box.querySelectorAll("details[open]").forEach(o => { if(o !== d) o.open = false; });
    const s = d.querySelector("summary"), r = s.getBoundingClientRect();
    if(r.top < 90) s.scrollIntoView({block: "start", behavior: rm() ? "auto" : "smooth"});
  }, true);
}

/* ===================== rutas ===================== */
ROUTES.mapa = parts => mapa(parts[0]);
ROUTES.gramatica = parts => gramatica(parts[0]);
ROUTES.palabras = () => palabras();
ROUTES.doc = parts => openDoc(parts.join("/"));
bus.on("route", d => {
  const h = String((d && d.h) || "");
  if(!h.startsWith("doc/")) state.doc = null;
  if(!h.startsWith("mapa")) jumpOff();
  closePeek(); closeMenu(false);
});
/* la hoja «Opciones» de Escribir vive dentro de #view: si la pantalla ya se cambió con la hoja abierta, se cierra igual
   (así se avisa de que ya no hay hoja y la barra de pestañas vuelve a su vidrio) */
let prSheet = null;
addEventListener("hashchange", () => {
  if(PK && PK.open) PK.close(); closeMenu(false);
  const ps = D.getElementById("pr-sheet") || prSheet; if(ps && ps.open) try{ ps.close(); }catch(_){}
  if(prSheet && !prSheet.isConnected) prSheet = null;
});

W.levelPicker = levelPicker;
W.vocabLearn = {levelPicker, mapa, palabras, docView: openDoc, gramatica, state, topicPic, modes: MODES.map(m => m[0]), peek: id => openPeek(id), jump, repaint};
})();
