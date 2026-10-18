/* Módulo lesson: la lección del camino (#/leccion/<id>), de vocabulario o de gramática (G-<nivel>-<nn>), y su final.
   Va en modo foco (html[data-focus=leccion]: la ✕, el contador de monedas y la barra de progreso arriba) con el botón
   principal de vidrio fijo abajo, que cambia según el paso: «Continuar» (palabra nueva), «Practicar» (la regla de
   gramática) o «Seguir» (después de contestar). Antes de contestar no hay botón: se toca una respuesta.
   - Palabra nueva: dibujo, la palabra (44 px; si no cabe entera, más pequeña, nunca partida: fitWord), la traducción en gris, el altavoz grande y la tortuga (despacio), «Cómo
     suena» (hoja con las sílabas y el audio lento; también manteniendo la palabra) y «Ejemplo» (se abre al tocarlo). El
     IPA solo si un mayor lo activó (vocabUI.get().ipa). Deslizar a la izquierda = Continuar; a la derecha = la anterior
     (también con ← →, y con el botón ‹ de abajo). La pista «Desliza para seguir» nunca sale en la primera tarjeta.
   - Preguntas: 2×2 opciones sólidas de 64 px (dibujo o texto; con 3, en fila), sin gestos. En francés y danés las otras
     opciones llevan, si puede ser, el mismo artículo (no se adivina por «la» o «et»). El altavoz de la pregunta sale al
     contestar (el dibujo se encoge lo mismo, así las opciones no se mueven). Acertar: rebote, verde con ✓, suena la
     palabra, vibración suave y pasa sola al acabar el audio (nunca antes de 0,9 s; con tope por si no acaba). Fallar: la
     elegida en gris con ✗, la correcta en verde con ✓ y suena; el botón pasa a «Seguir». Sin temblor, sin vibración, sin
     sonido triste. Racha: a los 3, 5 y 8 aciertos seguidos salta un chip con la llama y el número.
   - La ✕ y Esc abren «¿Paramos aquí?» (Seguir destacado · Salir, que vuelve a donde estaba el niño, como la ✕). En la
     primera tarjeta, sin nada hecho, no preguntan: salen.
   - Fin: el zorro con su traje, las estrellas de una en una con notas que suben, «+N» con las monedas volando al
     contador (award con from), «Mañana repasas estas N palabras» (las de esta lección que vuelven mañana), confeti
     (sfx.js, con "lesson-done"), «Siguiente lección» y «Repetir». Los botones de abajo no responden los primeros 0,7 s
     (un doble toque en «Seguir» no se salta el final). La ✕ y Esc vuelven al camino.
   Guardado mientras se hace: sessionStorage "vocab:ls" = {id, i, first, miss, n, lang, left} (i: pasos hechos; first:
     las que acertó a la primera; miss: las falladas; n: pasos en total; left: las repeticiones de falladas que aún
     faltan). Se escribe en cada paso desde el primero hecho y se borra al terminar. Una copia va a localStorage
     "vocab:lsdraft" = {t, v} (solo de este aparato: DEVICE_ONLY en save.js; vale 72 horas) por si el iPhone cierra la app
     o se cierra la pestaña. «Salir» lo deja: el niño sigue donde estaba con la cápsula «Seguir · Lección N» o con
     «Seguir» en Hoy (plan-doc §Lección). leccion(id) lo recupera si es la misma lección y el mismo idioma (con valores
     raros o fuera de rango empieza de cero). Avisa al accesorio (window.vocabAccessory.refresh()). No es de la partida.
   Guarda de salida: route() (index.html) llama antes de nada a vocabLesson.blocks(hashPath()). Con una lección empezada,
     salir de su ruta sin la ✕ (Atrás del navegador, el gesto de Safari, un enlace) vuelve a la lección con
     history.pushState y pregunta «¿Paramos aquí?»: Seguir no pierde nada; Salir deja ir adonde iba (history.back(), que
     es la entrada a la que quería ir), con lo hecho guardado para seguir luego.
   API (global, la usa route()): leccion(id) · lsStep() · lsEnd() · gramLesson(id) · gStep()
     window.vocabLesson = {state (la lección en marcha o null), saved(), blocks(hp), ask(from), syllables(text, lang)} */
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
const ui = () => { try{ return (window.vocabUI && vocabUI.get()) || {}; }catch(e){ return {}; } };
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
:root[data-theme=dark] .ls-pic img{background:#F2F2F7;border-radius:var(--r-md);padding:8px}
.ls-ph{display:grid;place-items:center;height:100%;aspect-ratio:1;max-height:140px;border-radius:28px;background:var(--fill2);
  color:var(--label2);font:800 3rem/1 var(--f-round)}
.ls-learn{touch-action:pan-y;will-change:translate}
.ls-word{max-width:100%;margin:4px 0 0;padding:0 4px;border-radius:12px;cursor:default;-webkit-user-select:none;user-select:none}
.ls-tr{font:400 var(--fs-body)/1.3 var(--f-text);color:var(--label2)}
.ls-ipa{font:400 var(--fs-sub)/1.3 var(--f-text);color:var(--label2)}
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
.ls .ls-opt.has-pic{justify-content:flex-start;padding-left:10px;text-align:left;font-size:var(--fs-t3)}
.ls .ls-opts.is-long .ls-opt.has-pic{font-size:var(--fs-head)}
.ls .ls-opts.is-xlong .ls-opt,.ls .ls-opts.is-xlong .ls-opt.has-pic{font-size:var(--fs-sub)}
.ls-ot{display:block;min-width:0;max-width:100%;overflow-wrap:normal;word-break:normal}
.ls-opts.is-break .ls-ot{overflow-wrap:anywhere}
.ls-opt img{flex:none;box-sizing:border-box;width:48px;height:48px;padding:3px;border-radius:10px;background:#fff;object-fit:contain;-webkit-user-drag:none}
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
.ls-opt.has-pic .chk{background:var(--ok-fill);color:#fff}
.ls-opt.has-pic .xm{background:var(--miss-fill)}
.ls-fb{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px 8px;margin:4px 0 0;text-align:center;
  font:700 var(--fs-t3)/1.25 var(--f-round);color:var(--ok-ink)}
.ls-fb:empty{display:none}
.ls-fb.miss{color:var(--label)}
.ls-fb.miss b{font-weight:800;color:var(--ok-ink)}
.ls-fb small{flex-basis:100%;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label2)}
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
.ls-how-ipa{margin:0 0 6px;font:400 var(--fs-sub)/1.3 var(--f-text);color:var(--label2)}
.ls-how-b{margin-top:16px}
/* móvil bajo (iPhone SE/8): todo cabe sin bajar, y la respuesta queda por encima del botón */
@media (max-height:700px){
  .ls-pic{height:clamp(96px,18vh,140px)}
  .ls .ls-card{gap:4px;padding:16px 16px 20px}
  .ls .ls-top{margin-bottom:12px}
  .ls-opts{gap:8px}
  .ls-end .ls-card{padding:16px}
  .ls-fox{height:96px}}
@media (prefers-reduced-motion:reduce){
  .ls .ls-spk.say.playing::after{animation:none;opacity:0}
  .ls-fox .hero{animation:none}
  .ls-star,.ls-star.on{scale:1;transition:opacity .15s ease-out}
  .ls-chip .ico,.ls-syl .sy{transition:none}}
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
const stepKey = (s, st) => s.g ? st.q.s : st.w.r.es;
/* done: pasos hechos. No se guarda nada hasta el primer paso hecho (antes no hay nada que perder). */
function lsSave(done){
  const s = LS; if(!s || s.ended) return;
  done = Math.max(0, Math.min(done, s.steps.length));
  if(!s.saved && done < 1) return;
  s.saved = true;
  const left = s.steps.slice(done).filter(st => st.re).map(st => stepKey(s, st));
  const v = {id: s.id, i: done, first: [...s.first], miss: [...s.miss], n: s.steps.length, lang, left};
  try{ sessionStorage.setItem(KEY, JSON.stringify(v)); }catch(e){}
  try{ localStorage.setItem(DRAFT, JSON.stringify({t: Date.now(), v})); }catch(e){}
  refreshAcc();
}
function clearSaved(){
  try{ sessionStorage.removeItem(KEY); }catch(e){}
  try{ localStorage.removeItem(DRAFT); }catch(e){}
  refreshAcc();
}
/* rehace los pasos de una lección guardada: delante los ya hechos y detrás lo que falta (las que no ha contestado aún y
   las repeticiones de las falladas que quedaban, sv.left; en lo guardado antes de left, las últimas falladas hasta el
   total de antes). El orden de lo que falta se vuelve a mezclar. Con valores raros o fuera de rango devuelve false (y
   la lección empieza de cero). */
function rebuild(s, sv){
  const items = s.g ? s.x.q : s.words, key = s.g ? (q => q.s) : (w => w.r.es);
  const W = s.g ? 0 : s.words.length, maxN = W + items.length * 4;
  const i0 = Math.floor(+sv.i), n0 = sv.n == null ? 0 : Math.floor(+sv.n);
  if(!Number.isFinite(i0) || i0 < 0 || i0 > maxN || !Number.isFinite(n0) || n0 < 0 || n0 > maxN || (n0 && i0 > n0)) return false;
  const keys = new Set(items.map(key));
  const first = (Array.isArray(sv.first) ? sv.first : []).filter(k => keys.has(k));
  const miss = (Array.isArray(sv.miss) ? sv.miss : []).filter(k => keys.has(k) && !first.includes(k));
  s.first = new Set(first); s.miss = new Set(miss); s.saved = true;
  const done = new Set([...first, ...miss]);
  let i = i0;
  if(i < W && !done.size){ s.i = i; return true; }   /* aún con las palabras nuevas: los pasos de siempre valen */
  i = Math.max(i, W);
  const mk = (it, j) => s.g ? {t: "gq", q: it} : {t: j % 2 ? "listen" : "pick", w: it};
  const byKey = k => items.find(it => key(it) === k);
  const todo = mix(items.filter(it => !done.has(key(it))));
  let again;
  if(Array.isArray(sv.left)) again = sv.left.filter(k => miss.includes(k)).slice(0, items.length * 3).map(byKey).filter(Boolean);
  else {
    const left = Math.max(todo.length, n0 - i), missed = miss.map(byKey).filter(Boolean);
    again = [];
    for(let r = left - todo.length, k = missed.length - 1; r > 0 && missed.length; r--, k--) again.unshift(missed[(k % missed.length + missed.length) % missed.length]);
  }
  const learn = s.g ? [] : s.words.map(w => ({t: "learn", w}));
  const past = []; for(let k = 0; k < i - W; k++) past.push(Object.assign(mk(items[k % items.length], k), {done: true}));
  s.steps = [...learn, ...past, ...todo.map(mk), ...again.map((it, j) => Object.assign(mk(it, todo.length + j + 1), {re: true}))];
  s.i = i;
  return true;
}
function fresh(o){
  return Object.assign({i: 0, first: new Set(), miss: new Set(), tok: ++autoTok, streak: 0, saved: false, ended: false,
    hs: history.state, lang, pend: null}, o);
}

/* ---------- entrar ---------- */
async function leccion(id){
  css();
  id = String(id || "");
  await getMap(); document.onkeydown = null;
  if(id.startsWith("G-")) return gramLesson(id);
  /* una lección que no existe (enlace viejo, id cambiado u otro idioma sin ella): al camino, por el router, así no se
     queda en modo foco y el historial queda bien */
  const toMap = l => { location.replace("#/mapa" + (l && MAP[l] ? "/" + l : "")); };
  const lv = id.slice(0, 2); if(!MAP[lv]) return toMap();
  const ui = MAP[lv].findIndex(u => u.ls.some(l => l.id === id)); if(ui < 0) return toMap(lv);
  const unit = MAP[lv][ui], l = unit.ls.find(l => l.id === id);
  const docs = {}; for(const [d] of l.w) docs[d] = await getDoc(d);
  if(hashPath() !== "leccion/" + id) return;   /* mientras cargaba se fue a otra pantalla */
  const words = l.w.map(([d, i]) => ({doc: d, r: docs[d].rows[i]})).filter(x => x.r && x.r.l && x.r.l[lang]);
  if(!words.length) return toMap(lv);
  /* distractores: las otras palabras de la lección y, si faltan, del mismo documento */
  const pool = [...words]; const seen = new Set(words.map(x => x.r.es));
  for(const r of docs[unit.doc].rows) if(pool.length < 12 && r.es && r.l && r.l[lang] && !seen.has(r.es)){ seen.add(r.es); pool.push({doc: unit.doc, r}); }
  /* más palabras del tema, para buscar otras opciones con el mismo artículo (francés y danés) */
  const more = []; for(const [d, doc] of Object.entries(docs)) for(const r of doc.rows) if(r.es && r.l && r.l[lang] && !seen.has(r.es)){ seen.add(r.es); more.push({doc: d, r}); }
  const plan = () => [...words.map(w => ({t: "learn", w})), ...mix(words).map((w, i) => ({t: i % 2 ? "listen" : "pick", w}))];
  LS = fresh({id, lv, unit, words, pool, more, steps: plan(), nq: words.length});
  const sv = saved();
  if(sv && sv.id === id && !rebuild(LS, sv)){ clearSaved(); LS = fresh({id, lv, unit, words, pool, more, steps: plan(), nq: words.length}); }
  mount(); lsStep(0);
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
const pic = r => r && r.img ? `<img src="${esc(r.img)}" alt="" draggable="false" decoding="async">`
  : `<span class="ls-ph" aria-hidden="true">${esc(((r && r.es) || "?").charAt(0).toUpperCase())}</span>`;
const spkBtn = (t, xl) => `<button type="button" class="say ls-spk${xl ? " xl" : ""}" data-say="${esc(t)}" data-key="space" aria-label="Escuchar">${ico("speaker-high", "fill", xl ? 40 : 32)}</button>`;
const slowBtn = t => `<button type="button" class="say ls-slow" data-say="${esc(t)}" data-slow data-key="shift+space" aria-label="Escuchar despacio">${ico("turtle", "fill", 30)}</button>`;
const streakHtml = n => `<span class="ls-streak" role="img" aria-label="${n} seguidas">${ico("fire", "fill", 20)}<b>${n}</b></span>`;
const chip = s => s.streak >= 3 ? streakHtml(s.streak) : "";
/* el artículo de una palabra en francés o danés («le», «la», «l'», «les», «un», «une», «des»; «en», «et», «at») */
const ARTS = {fr: /^(l['’]|les\s|le\s|la\s|une\s|un\s|des\s)/i, da: /^(en\s|et\s|at\s)/i};
const artOf = w => { const re = ARTS[lang2()], m = re && re.exec(String(w || "")); return m ? m[1].toLowerCase().replace("’", "'").trim() : ""; };
/* opciones: la buena y 3 distintas de la lección (o del tema). Si la buena lleva artículo, las otras llevan el mismo
   cuando se puede (de la lección y, si faltan, del tema): así no se acierta solo por «la» o por «et» */
function options(w, field){
  const val = x => field === "es" ? x.r.es : x.r.l[lang].word;
  const out = [w], used = new Set([val(w)]);
  const add = x => { if(out.length < 4 && x && x.r && x.r.l && x.r.l[lang] && !used.has(val(x))){ used.add(val(x)); out.push(x); } };
  const a = field === "es" ? "" : artOf(val(w));
  if(a){ const same = x => artOf(val(x)) === a; mix(LS.pool).filter(same).forEach(add); mix(LS.more || []).filter(same).forEach(add); }
  mix(LS.pool).forEach(add);
  return mix(out).map(x => ({v: val(x), r: x.r}));
}
const optsHtml = (list, o = {}) => `<div class="ls-opts${list.length === 3 ? " is-3" : ""}${list.some(x => String(x.v).length > 11) ? " is-long" : ""}" role="group" aria-label="Respuestas">${list.map((x, k) =>
  `<button type="button" class="ls-opt${o.pics ? " has-pic" : ""}" data-press="sink" data-k="${k}" data-key="${k + 1}"${x.lang ? ` lang="${x.lang}"` : ""}><kbd class="ls-k" aria-hidden="true">${k + 1}</kbd>${o.pics ? `<img src="${esc(x.r.img)}" alt="" draggable="false">` : ""}<span class="ls-ot">${esc(x.v)}</span></button>`).join("")}</div>`;

/* ninguna respuesta se parte a media palabra («grandmothe·r»): si una palabra no cabe en su botón, las 4 bajan de tamaño
   juntas (titular y luego 17 px); solo si ni así cabe, se parte */
function fitOpts(pg){
  const box = pg && pg.querySelector(".ls-opts"); if(!box) return;
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
  const h1 = pic && h0 ? Math.max(72, Math.round(h0 - grow)) : 0;
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
  const st = s.steps[s.i], r = st.w.r, d = r.l[lang], idx = s.i, tok = s.tok;
  st.done = false;
  if(st.t === "learn"){
    const ipa = !!(ui().ipa && d.ipa), lc = langCode();
    const pg = swap(`<div class="ls-page">
      <section class="card ls-card ls-learn"${idx === 0 ? " data-no-hint" : ""} aria-label="Palabra nueva">
        <div class="ls-pic">${pic(r)}</div>
        <div class="ls-word t-word" lang="${lc}" title="Mantén pulsado: cómo suena">${esc(d.word)}</div>
        <div class="ls-tr">${esc(r.es)}</div>
        ${ipa ? `<div class="ls-ipa" lang="${lc}">${esc(d.ipa)}</div>` : ""}
        <div class="ls-audio">${spkBtn(d.word)}${slowBtn(d.word)}</div>
        <div class="ls-more"><button type="button" class="ls-chip" data-how aria-haspopup="dialog">Cómo suena</button>${d.ex ? `<button type="button" class="ls-chip" data-ex aria-expanded="false" aria-controls="ls-ex">Ejemplo ${ico("caret-down", "bold", 16)}</button>` : ""}</div>
        ${d.ex ? `<div class="ls-ex" id="ls-ex" hidden><p lang="${lc}">${esc(d.ex)} <button type="button" class="say ls-exs" data-say="${esc(d.ex)}" aria-label="Escuchar la frase">${ico("speaker-high", "fill", 20)}</button></p>${d.ex_es ? `<p class="ls-ex-tr">${esc(d.ex_es)}</p>` : ""}</div>` : ""}
      </section></div>`, dir);
    if(typeof fitWord === "function") fitWord(pg.querySelector(".ls-word"));
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
    <section class="card ls-card ls-q${listen ? " ls-listen" : ""}">${chip(s)}
      ${listen ? `<h2 class="ls-ask">Escucha y elige</h2><div class="ls-audio ls-audio--c">${spkBtn(d.word, true)}${slowBtn(d.word)}</div>`
               : `<div class="ls-pic">${pic(r)}</div><h2 class="ls-ask">¿Cuál es <q>${esc(es)}</q>?</h2><div class="ls-audio is-later" aria-hidden="true">${spkBtn(d.word)}${slowBtn(d.word)}</div>`}
    </section>
    ${optsHtml(list, {pics})}
    <p class="ls-fb"></p></div>`, dir);
  announce(listen ? "Escucha y elige" : `¿Cuál es «${esc(es)}»?`);
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
/* contestar (vocabulario): la buena en verde con ✓ y la elegida, si no lo era, en gris con ✗ */
function answer(b){
  const s = LS, st = s && s.steps[s.i];
  if(!alive(s) || !st || st.done || st.t === "learn" || !b || b.disabled) return;
  st.done = true;
  const r = st.w.r, d = r.l[lang], idx = s.i, pg = b.closest(".ls-page");
  const opts = [...pg.querySelectorAll(".ls-opt")], v = b.querySelector(".ls-ot").textContent;
  const ok = v === st.right, right = opts.find(o => o.querySelector(".ls-ot").textContent === st.right) || b;
  const key = r.es;
  if(ok){ if(!s.miss.has(key)) s.first.add(key); s.streak++; }
  else { s.miss.add(key); s.steps.push({t: st.t === "pick" ? "listen" : "pick", w: st.w, re: true}); s.streak = 0; }
  marks(opts, right, b, ok);
  bus.emit("answer", {ok, es: r.es, word: d.word, where: "lesson"});
  lsSave(idx + 1); paintTop(idx + 1);
  reveal(pg);
  const spk = pg.querySelector(".ls-spk");
  /* «Escucha y elige» se contesta en español; «¿Cuál es…?», en el idioma */
  const rl = st.t === "listen" ? "" : ` lang="${langCode()}"`;
  feedback(pg, ok, ok ? "" : `¡Casi! Es <b${rl}>«${esc(st.right)}»</b>`);
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
  const card = pg.querySelector(".ls-card"); if(!card) return;
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
      <div class="ctrl ls-extra"></div>
    </section>
    <div class="ls-dock">
      <button type="button" class="glass-btn glass-btn--lg ls-rep" id="ls-rep">${ico("arrow-counter-clockwise", "bold", 20)}Repetir</button>
      ${nxt ? `<a class="glass-btn glass-btn--pri glass-btn--lg ls-go" id="ls-next" href="#/leccion/${esc(nxt.id)}" data-key="enter">Siguiente lección</a>` : ""}
    </div></div>`;
  const fx = $("#fx-x"); if(fx) fx.setAttribute("href", "#/mapa/" + s.lv);
  if(scrollY > 0) scrollTo(0, 0);
  /* lo de siempre: camino, monedas, repaso y actividad (el mismo orden y formato que antes) */
  award(coins, "", false, $("#ls-plus"));   /* sin aviso: el «+N» ya está en la tarjeta */
  const by = {}; for(const w of s.words) (by[w.doc] = by[w.doc] || []).push(w.r);
  for(const [d, rows] of Object.entries(by)) srsAdd(d, rows, 1);
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
  /* un doble toque en «Seguir» (justo en el sitio de «Siguiente lección») no se salta el final: los botones no responden
     hasta que salen las estrellas */
  const dock = $(".ls-end .ls-dock");
  if(dock){ dock.inert = true; setTimeout(() => { if(dock.isConnected) dock.inert = false; }, rm() ? 300 : 700); }
  document.onkeydown = onKey;
  setTimeout(giftCheck, 1500);
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
    else if(s.saved) ask(null);
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
    ${ui().ipa && d0.ipa ? `<p class="ls-how-ipa" lang="${lc}">${esc(d0.ipa)}</p>` : ""}
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
});

css();
window.leccion = leccion; window.lsStep = lsStep; window.lsEnd = lsEnd; window.gramLesson = gramLesson; window.gStep = gStep;
window.vocabLesson = {get state(){ return LS; }, saved, blocks, ask, syllables};
})();
