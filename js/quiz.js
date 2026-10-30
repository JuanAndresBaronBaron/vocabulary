/* módulo quiz: cuatro juegos de Jugar › Juegos con el tema elegido, registrados con vocabGames.register (como
   js/party.js, que registra dos desde un módulo). Sección del menú: «concursos».
   Rutas: #/juegos/concurso · #/juegos/verdadero · #/juegos/cajas · #/juegos/flechas.
   «Concurso»: un concurso de la tele. 10 preguntas de cuatro clases, mezcladas: dibujo → palabra, español → palabra,
     escuchar → dibujo y palabra → dibujo; 4 respuestas (dibujos grandes cuando las respuestas son dibujos). Cada
     pregunta tiene 15 s (barra de tiempo); acertar da 100 puntos + hasta 100 por rapidez, por la racha (×2 desde 3
     seguidas, ×3 desde 5). Tres comodines, uno de cada en la partida: «50:50» (quita dos), «+10 s» y una pista que
     depende de la pregunta: «Escuchar» (dice la respuesta; luego «Escuchar otra vez»), «Otra vez» (en las de escuchar:
     despacio y escrita) o «Ver dibujo» (en palabra → dibujo: el dibujo, borroso). Escenario con focos y marcador en
     colores sobrios; al final, un podio con los puntos. Al contestar suena la palabra y se ve con su IPA.
   «Verdadero o falso»: un dibujo con una palabra en el idioma: ¿es la suya? Botones grandes ✓ y ✗, deslizar la
     tarjeta (derecha = sí, izquierda = no) o las teclas ← → y V / F. 60 s con barra; cada tarjeta tiene menos tiempo
     a medida que avanza la partida. Más o menos la mitad son verdad. Fallo: ✗ gris y la palabra buena con su IPA.
     Puntos = aciertos; se ve la racha.
   «Abre la caja»: 12 cajas de regalo numeradas (colores sobrios). Se toca una (o se escribe su número): se abre con
     una animación corta y trae casi siempre una pregunta (dibujo → cuál de 3 palabras, o palabra → cuál de 3 dibujos)
     y a veces una sorpresa: «¡Doble!» (la pregunta siguiente vale el doble) o «Estrella extra» (+1 punto). Se abren
     todas una vez y sale el resultado. Al acertar suena la palabra con su IPA.
   «Une con flechas»: 5 dibujos a la izquierda y sus 5 palabras a la derecha (barajadas). Se une con una línea
     arrastrando de un lado al otro, tocando uno y luego el otro, o con las flechas y Enter. «Comprobar» pinta las
     líneas buenas de verde azulado y las malas en gris con ✗; las malas se pueden rehacer una vez. 3 rondas de 5. En el
     celular, dos columnas de fichas grandes y las líneas en un SVG encima.
   Los cuatro usan de games.js lo de los demás juegos (api): tarjeta, récord, explicación la primera vez, «?», pausa
     (api.later y run.paused paran el reloj) y finish() (récord en "games:best".<id> y monedas).
   Ganchos para las pruebas (tests/e2e/test_quiz.py): window.__concursoT (segundos por pregunta) y
     window.__verdaderoDur (segundos de partida); root.cqAns (la respuesta buena), la tarjeta .vfOk, root.bxCur (la
     caja abierta) y root.bxAns, y en Flechas el data-i de cada ficha (dibujo y palabra iguales = pareja). */
(() => {
"use strict";

const SEC = "concursos", QZ = "concurso", VF = "verdadero", BOX = "cajas", ARW = "flechas";
const IC = (n, s = "bold", z = 22, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
const RM = () => { try{ return !!(window.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const pic = src => (window.vocabGames && typeof vocabGames.pic === "function") ? vocabGames.pic(src) : src;
const pick = a => a[Math.floor(Math.random() * a.length)];
const num = v => Number.isFinite(+v) ? +v : 0;
const code = () => (LANGS[lang] || LANGS.english).code;
const MAX_LEN = 22;
const fits = x => x && typeof x.word === "string" && x.word.trim() && [...x.word].length <= MAX_LEN && typeof x.es === "string" && x.es.trim()
  && typeof x.img === "string" && x.img;
const FLAGS = new Set(["paises", "nacionalidades"]);
const kb = k => `<kbd class="qz-k" aria-hidden="true">${esc(String(k))}</kbd>`;
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
/* el tamaño de letra de una palabra en un botón, según lo larga que es (que no se parta por la mitad) */
const wfs = w => { const n = [...w].length; return n <= 7 ? 1.22 : n <= 10 ? 1.08 : n <= 13 ? .98 : .88; };

/* ---------- piezas comunes ---------- */
function imgHtml(it){
  const s = pic(it.img), fl = FLAGS.has(it.doc);
  return `<img${fl ? ' class="qz-flag"' : ""} src="${esc(s)}"${s !== it.img ? ` data-f="${esc(it.img)}" onerror="if(this.dataset.f){this.src=this.dataset.f;delete this.dataset.f}"` : ""} alt="" draggable="false">`;
}
const ipa = it => typeof ipaHtml === "function" && it && it.ipa ? ipaHtml(it.ipa, code()) : "";
/* la palabra en el idioma (con su lang) y su IPA */
const wordIpa = it => `<b class="qz-wd" lang="${esc(code())}">${esc(it.word)}</b>${ipa(it)}`;
const preload = a => a.forEach(x => { if(x && x.img){ const im = new Image(); im.src = pic(x.img); } });
/* n palabras al azar distintas de it y entre sí (otra palabra, otro español y otro dibujo) */
function others(P, it, n){
  const out = [], W = new Set([it.word.toLowerCase()]), E = new Set([it.es.toLowerCase()]), I = new Set([it.img]);
  for(const x of shuffle(P)){
    if(out.length >= n) break;
    const w = x.word.toLowerCase(), e = x.es.toLowerCase();
    if(W.has(w) || E.has(e) || I.has(x.img)) continue;
    W.add(w); E.add(e); I.add(x.img); out.push(x);
  }
  return out;
}
/* n palabras para la partida: distintas si el tema tiene bastantes; si no, se repiten (barajadas otra vez) */
function deal(P, n){
  let out = [];
  while(out.length < n){ let s = shuffle(P); if(out.length && s[0] === out[out.length - 1] && s.length > 1) s = s.slice(1).concat(s[0]); out = out.concat(s); }
  return out.slice(0, n);
}
/* las palabras de la partida, para el resultado (las falladas primero) */
function tracker(){
  const m = new Map();
  return {
    add(it, miss){ const o = m.get(it.k) || {word: it.word, es: it.es, img: it.img, doc: it.doc, miss: false}; if(miss) o.miss = true; m.set(it.k, o); },
    list(){ return [...m.values()].sort((a, b) => b.miss - a.miss); },
  };
}
function noWords(app, api){
  app.innerHTML = `<div class="gm"><div class="gm-empty"><p>Este juego todavía no tiene palabras en ${esc(api.nm())}.</p>
    <a class="glass-btn" href="#/juegos">${IC("caret-left", "bold", 18)}Juegos</a></div></div>`;
}
/* las palabras del tema elegido (null si mientras tanto se salió del juego) */
async function words(api, id, need){
  const my = api.nav(), L = lang;
  let TP = {P: []};
  try{ TP = await api.topicPool(id, need, fits); }catch(e){}
  if(!api.here(my, id) || lang !== L) return null;
  return TP.P || [];
}
/* el juego llena lo que queda de pantalla: el alto de el, desde donde empieza hasta abajo (sin el margen de main) */
function filler(api, run, el, min, max, after){
  const f = () => {
    if(!api.live(run) || !el.isConnected) return;
    const top = el.getBoundingClientRect().top + scrollY;
    const main = el.closest("main"), pb = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 12;
    el.style.height = Math.round(Math.max(min, Math.min(max, innerHeight - top - pb - 4))) + "px";
    if(after) after();
  };
  addEventListener("resize", f); run.clean.push(() => removeEventListener("resize", f));
  f(); requestAnimationFrame(f); api.later(run, f, 320);
  return f;
}
/* «+120» que sube desde un elemento (dentro de box, que tiene position:relative) */
function floatUp(api, run, box, el, txt, bad){
  if(!box || !el || !el.isConnected) return;
  const f = document.createElement("div"), b = el.getBoundingClientRect(), fb = box.getBoundingClientRect();
  f.className = "gm-float qz-fl" + (bad ? " bad" : "");
  f.textContent = txt;
  f.style.left = (b.left - fb.left + b.width / 2) + "px"; f.style.top = Math.max(4, b.top - fb.top + b.height * .25) + "px";
  box.appendChild(f); api.later(run, () => f.remove(), 1000);
}
function sparks(el, n = 12){
  try{ if(el && el.isConnected && window.M && typeof M.burst === "function" && !RM()) M.burst(el, {n}); }catch(e){}
}
/* flechas en una rejilla de botones: salta los desactivados; devuelve true si la tecla era una flecha */
function gridNav(e, list, cols){
  const d = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols}[e.key];
  if(!d || !list.length) return false;
  e.preventDefault();
  const i = list.indexOf(document.activeElement);
  if(i < 0){ const f = list.find(b => !b.disabled); if(f) f.focus(); return true; }
  for(let j = i + d; j >= 0 && j < list.length; j += d) if(!list[j].disabled){ list[j].focus(); return true; }
  return true;
}
const focusEl = el => { try{ if(el) el.focus({preventScroll: true}); }catch(e){} };
const MK = `<span class="qz-mk" aria-hidden="true">${IC("check", "bold", 18, "v")}${IC("x", "bold", 18, "x")}</span>`;

/* ---------- estilos (una vez) ---------- */
const CSS = `
:root:is([data-gm-play=concurso],[data-gm-play=verdadero],[data-gm-play=cajas],[data-gm-play=flechas]) main{padding-bottom:calc(var(--safe-b) + 12px)}
.qz .gm-top{margin-bottom:8px}
:where(.qz) button{font:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.qz button:focus-visible{outline:3px solid var(--brand-tint);outline-offset:3px}
.qz .ipa{margin-left:.35em;font-weight:400}
.qz-wd{font-weight:800}
.qz-k{display:none;position:absolute;right:6px;top:6px;z-index:2;min-width:20px;padding:2px 5px;border-radius:6px;background:rgba(120,120,128,.2);color:var(--label2);
  font:700 .72rem/1.2 var(--f-text);text-align:center;pointer-events:none}
@media (hover:hover) and (pointer:fine){.qz-k{display:block}}
.qz-flag{height:auto!important;max-height:94%;aspect-ratio:293/220;object-fit:fill!important;border-radius:4px;box-shadow:0 0 0 1px rgba(0,0,0,.2)}
.qz .gm-float.qz-fl{z-index:9;background:var(--gold);color:#3D2B00;text-shadow:none;border-radius:999px;padding:2px 12px;font-size:1.1rem;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.qz .gm-float.qz-fl.bad{background:#6C6C70;color:#fff}
/* la marca ✓ / ✗ de una respuesta (arriba a la derecha) */
.qz-mk{position:absolute;right:-7px;top:-7px;z-index:3;display:none;width:30px;height:30px;border-radius:50%;place-items:center;color:#fff;box-shadow:0 0 0 2.5px var(--card)}
.ok>.qz-mk{display:grid;background:var(--teal)}
.no>.qz-mk{display:grid;background:var(--miss)}
.ok>.qz-mk .x,.no>.qz-mk .v{display:none}

/* ===== Concurso ===== */
.cq{max-width:720px}
.cq-main{position:relative;display:flex;flex-direction:column;gap:10px;height:var(--h,640px)}
.cq-stage{position:relative;flex:none;display:flex;flex-direction:column;gap:8px;padding:16px 12px 12px;border-radius:22px;overflow:hidden;isolation:isolate;color:#fff;
  background:radial-gradient(90% 60% at 50% 115%,rgba(0,129,152,.38),transparent 70%),linear-gradient(180deg,#14406f 0%,#0B2545 72%);
  box-shadow:inset 0 0 0 2px rgba(241,183,14,.4),0 3px 10px rgba(11,37,69,.25)}
[data-theme=dark] .cq-stage{background:radial-gradient(90% 60% at 50% 115%,rgba(0,129,152,.3),transparent 70%),linear-gradient(180deg,#0f2f57 0%,#071a33 72%)}
.cq.wo .cq-stage{flex:1 1 0;min-height:0}
/* los focos: dos haces de luz que bajan desde arriba y una fila de bombillas */
.cq-beam{position:absolute;top:-24px;z-index:-1;width:55%;height:140%;pointer-events:none;opacity:.2;transform-origin:50% 0;
  background:linear-gradient(180deg,rgba(255,232,160,.95),rgba(255,232,160,0) 78%);clip-path:polygon(44% 0,56% 0,100% 100%,0 100%)}
.cq-beam.l{left:-12%;transform:rotate(-22deg)}
.cq-beam.r{right:-12%;transform:rotate(22deg)}
.cq-bulbs{position:absolute;left:14px;right:14px;top:5px;display:flex;justify-content:space-between;pointer-events:none}
.cq-bulbs i{width:6px;height:6px;border-radius:50%;background:#F1B70E;box-shadow:0 0 6px rgba(241,183,14,.9);animation:cq-tw 1.8s ease-in-out infinite}
.cq-bulbs i:nth-child(even){animation-delay:-.9s}
@keyframes cq-tw{50%{opacity:.35;box-shadow:none}}
/* el marcador */
.cq-board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.cq-cell{min-width:0;padding:3px 4px 4px;border-radius:10px;background:rgba(0,0,0,.32);box-shadow:inset 0 0 0 1.5px rgba(241,183,14,.5);text-align:center}
.cq-cell small{display:block;font:700 .66rem/1.2 var(--f-text);letter-spacing:.06em;text-transform:uppercase;color:#cfe0f5}
.cq-cell b{display:block;font:900 1.2rem/1.15 var(--f-round);color:#F1B70E;font-variant-numeric:tabular-nums}
.cq-tbar{margin:0;height:10px;background:rgba(255,255,255,.18)}
.cq-tbar i{transition:none}
/* la pregunta */
.cq-q{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center}
.cq-q.in{animation:cq-in .35s cubic-bezier(.2,.9,.3,1.2)}
@keyframes cq-in{from{opacity:0;transform:scale(.92)}}
.cq-ask{margin:0;font:700 1.02rem/1.25 var(--f-text);color:#e3edf9}
.cq-pic{flex:none;width:var(--pp,120px);height:var(--pp,120px);display:grid;place-items:center;border-radius:20px;background:var(--gm-tile);box-shadow:0 0 0 3px #F1B70E,0 6px 18px rgba(0,0,0,.35);overflow:hidden}
.cq-pic img{width:90%;height:90%;object-fit:contain;mix-blend-mode:multiply}
.cq-es{font:900 clamp(1.7rem,7.5vw,2.3rem)/1.1 var(--f-round);color:#fff;overflow-wrap:anywhere}
.cq-word{font:900 clamp(1.8rem,8vw,2.5rem)/1.1 var(--f-round);color:#F1B70E;overflow-wrap:anywhere}
.cq-say{width:72px;height:72px;border:0;border-radius:50%;display:grid;place-items:center;background:#F1B70E;color:#0B2545;cursor:pointer;box-shadow:0 0 0 4px rgba(241,183,14,.3)}
.cq-say:focus-visible,.cq-mini:focus-visible{outline-color:#fff}
.cq-help{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;min-height:0;font:700 1.15rem/1.2 var(--f-text);color:#fff}
.cq-help:empty{display:none}
.cq-help .ipa{color:#cfe0f5}
.cq-wr{padding:4px 12px;border-radius:12px;background:rgba(0,0,0,.3)}
.cq-mini{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border:0;border-radius:999px;background:rgba(255,255,255,.16);color:#fff;font:700 .95rem/1 var(--f-text);cursor:pointer}
.cq-blur{width:88px;height:88px;border-radius:16px;background:var(--gm-tile);display:grid;place-items:center;overflow:hidden}
.cq-blur img{width:86%;height:86%;object-fit:contain;filter:blur(5px);mix-blend-mode:multiply}
/* las respuestas */
.cq-opts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.cq-o{position:relative;min-width:0;display:flex;align-items:center;gap:10px;min-height:64px;margin:0;padding:8px 12px 8px 8px;border:2.5px solid var(--sep);border-radius:16px;
  background:var(--card);color:var(--label);font:800 1.22rem/1.15 var(--f-round);text-align:left;cursor:pointer;box-shadow:0 2px 0 rgba(0,0,0,.08)}
.cq-l{flex:none;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#0B2545;color:#F1B70E;font:900 .95rem/1 var(--f-round);box-shadow:0 0 0 2px rgba(241,183,14,.65)}
.cq-w{flex:1;min-width:0;overflow-wrap:anywhere}
.cq-opts.pics{flex:1 1 0;min-height:212px;grid-template-rows:repeat(2,minmax(0,1fr))}
.cq-opts.pics .cq-o{min-height:0;padding:0;justify-content:center;background:var(--gm-tile);border-color:rgba(60,60,67,.25)}
.cq-opts.pics .cq-l{position:absolute;left:7px;top:7px;z-index:1}
/* el dibujo, fijado a su ficha (con height:100% dentro de un botón, un dibujo grande se salía de una ficha pequeña) */
.cq-im{position:absolute;inset:8px;display:grid;place-items:center;pointer-events:none}
.cq-im img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply}
.cq-im img.qz-flag{inset:0;margin:auto;height:auto!important;max-height:100%}
@media (hover:hover){.cq-o:not(:disabled):hover{border-color:var(--brand-tint)}}
.cq-o:disabled{cursor:default}
.cq-o.ok{border-color:var(--teal);background:color-mix(in srgb,var(--teal) 14%,var(--card));box-shadow:0 0 0 3px color-mix(in srgb,var(--teal) 35%,transparent)}
.cq-opts.pics .cq-o.ok{background:#dff3f6}
.cq-o.no{border-color:var(--miss);background:var(--miss-fill);color:var(--miss-on)}
.cq-opts.pics .cq-o.no{background:#d5dbe3}
.cq-opts.pics .cq-o.no img{opacity:.55}
.cq-o.dim{opacity:.42}
.cq-o.cut{visibility:hidden}
.cq-o.ok{animation:cq-yay .5s}
@keyframes cq-yay{40%{transform:scale(1.05)}}
/* los comodines */
.cq-life{flex:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.cq-lf{position:relative;min-width:0;display:flex;align-items:center;justify-content:center;gap:6px;min-height:48px;margin:0;padding:4px 8px;border:2px solid #b38f00;border-radius:999px;
  background:linear-gradient(180deg,#14406f,#0B2545);color:#fff;font:800 .98rem/1.1 var(--f-round);cursor:pointer;overflow:hidden}
.cq-lf b{white-space:nowrap}
.cq-lf .ico{flex:none;color:#F1B70E}
.cq-lf:disabled{opacity:.55;cursor:default}
.cq-lf.used{opacity:1;background:var(--fill);color:var(--label2);border-color:var(--sep)}
.cq-lf.used .ico{color:var(--label2)}
.cq-lf.used::after{content:"";position:absolute;inset:0;background:linear-gradient(to top right,transparent calc(50% - 1.5px),var(--miss) calc(50% - 1.5px) calc(50% + 1.5px),transparent calc(50% + 1.5px))}
.cq-lf .qz-k{position:static;background:rgba(255,255,255,.2);color:#fff}
@media (max-width:400px){.cq-lf .ico{display:none}.cq-lf{padding:4px 6px}}
.cq-fb{flex:none;margin:0;min-height:2.7em;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px 8px;text-align:center;font:600 1.05rem/1.3 var(--f-text);color:var(--label)}
.cq-fb .cq-ok,.cq-fb .cq-no{display:inline-flex;align-items:center;gap:4px;font-weight:800}
.cq-fb .cq-ok{color:var(--teal)}
.cq-fb .cq-no{color:var(--miss-ink)}
.cq-fb small{color:var(--label2);font-weight:600}
/* el podio */
.cq-pod{position:absolute;inset:0;z-index:7;display:flex;align-items:center;justify-content:center;padding:16px 12px;border-radius:22px;overflow:hidden;isolation:isolate;color:#fff;
  background:radial-gradient(70% 45% at 50% 0%,rgba(255,232,160,.28),transparent 70%),linear-gradient(180deg,#14406f,#0B2545 70%);animation:gm-fade .3s}
[data-theme=dark] .cq-pod{background:radial-gradient(70% 45% at 50% 0%,rgba(255,232,160,.2),transparent 70%),linear-gradient(180deg,#0f2f57,#071a33 70%)}
.cq-pod-c{display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;max-width:420px;text-align:center}
.cq-pod-t{margin:0;font:900 1.9rem/1.15 var(--f-round);color:#F1B70E}
.cq-pod-p{margin:0;font:700 1.1rem/1.2 var(--f-text);color:#e3edf9}
.cq-pod-p b{display:block;font:900 3rem/1.05 var(--f-round);color:#fff;font-variant-numeric:tabular-nums}
.cq-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:6px;width:100%;margin:64px 0 0}
.cq-step{position:relative;display:flex;justify-content:center;padding-top:10px;border:3px solid #000;border-bottom:0;border-radius:12px 12px 0 0;color:#1b1b1b;font:900 2rem/1 var(--f-round)}
.cq-step.s1{height:128px;background:linear-gradient(180deg,#f6cf4b,#d9a514)}
.cq-step.s2{height:96px;background:linear-gradient(180deg,#d3dae2,#a9b4c0)}
.cq-step.s3{height:70px;background:linear-gradient(180deg,#c39a6c,#9a7148)}
.cq-me{position:absolute;bottom:100%;left:50%;display:flex;flex-direction:column;align-items:center;gap:2px;margin-bottom:6px;transform:translateX(-50%);color:#F1B70E;animation:cq-hop .7s cubic-bezier(.3,1.4,.5,1) both}
.cq-me small{padding:1px 10px;border-radius:999px;background:#F1B70E;color:#3D2B00;font:800 .85rem/1.3 var(--f-text)}
@keyframes cq-hop{from{transform:translate(-50%,30px);opacity:0}}
.cq-floor{height:10px;width:100%;margin-top:-6px;border-radius:0 0 8px 8px;background:#06172c}
.cq-pod-l{margin:6px 0 4px;font:600 1rem/1.3 var(--f-text);color:#e3edf9}
.cq-pod .glass-btn{min-width:220px}
.cq.end .cq-main>:not(.cq-pod){visibility:hidden}

/* ===== Verdadero o falso ===== */
.vf{max-width:560px}
.vf-main{position:relative;display:flex;flex-direction:column;gap:10px;height:var(--h,640px)}
.vf-tbar{flex:none;margin:0}
.vf-deck{position:relative;flex:1 1 0;min-height:0;display:flex}
.vf-card{position:relative;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 12px 14px;border:3px solid var(--sep);border-radius:26px;
  background:var(--card);box-shadow:0 4px 14px rgba(0,0,0,.1);user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:grab}
.vf-card.in{animation:vf-in .3s cubic-bezier(.2,.9,.3,1.15)}
@keyframes vf-in{from{opacity:0;transform:translateY(16px) scale(.96)}}
.vf-pic{position:relative;flex:1 1 0;min-height:110px;width:100%;border-radius:20px;background:var(--gm-tile);overflow:hidden}
.vf-pic img{position:absolute;inset:4%;width:92%;height:92%;object-fit:contain;mix-blend-mode:multiply;pointer-events:none}
.vf-pic img.qz-flag{inset:0;margin:auto;height:auto!important;max-height:80%;width:80%}
.vf-w{display:block;max-width:100%;margin-top:4px;font:900 clamp(1.8rem,8.4vw,2.5rem)/1.1 var(--f-round);text-align:center;overflow-wrap:anywhere;color:var(--label)}
.vf-w.strike{text-decoration:line-through;text-decoration-thickness:3px;color:var(--miss-ink)}
.vf-ans{margin:0;min-height:2.7em;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:2px 6px;text-align:center;font:600 1.05rem/1.3 var(--f-text);color:var(--label)}
.vf-ans .ok{color:var(--teal);font-weight:800}
.vf-card.good{border-color:var(--teal);box-shadow:0 0 0 4px color-mix(in srgb,var(--teal) 28%,transparent)}
.vf-card.bad{border-color:var(--miss)}
.vf-card.bad .vf-pic img{opacity:.75}
.vf-stamp{position:absolute;top:18px;right:18px;z-index:2;display:none;width:60px;height:60px;border-radius:50%;place-items:center;color:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.95),0 4px 10px rgba(0,0,0,.2)}
.vf-card.good .vf-stamp{display:grid;background:var(--teal)}
.vf-card.bad .vf-stamp{display:grid;background:var(--miss)}
.vf-card.good .vf-stamp .x,.vf-card.bad .vf-stamp .v{display:none}
.vf-card.good .vf-stamp{animation:vf-pop .35s cubic-bezier(.3,1.5,.5,1)}
@keyframes vf-pop{from{transform:scale(.3)}}
/* al deslizar: el letrero del lado al que va */
.vf-sw{position:absolute;top:22px;z-index:2;padding:4px 14px;border-radius:12px;border:3px solid currentColor;font:900 1.3rem/1.2 var(--f-round);opacity:0;pointer-events:none;background:var(--card)}
.vf-sw.r{left:18px;color:var(--teal);transform:rotate(-10deg)}
.vf-sw.l{right:18px;color:#4b5563;transform:rotate(10deg)}
[data-theme=dark] .vf-sw.l{color:#aeb7c2}
.vf-lim{position:absolute;left:22px;right:22px;bottom:5px;height:4px;border-radius:2px;background:var(--fill);overflow:hidden}
.vf-lim i{display:block;height:100%;background:var(--brand-tint);transform-origin:left center}
.vf-row{flex:none;display:flex;align-items:center;justify-content:center;gap:8px;min-height:30px;margin:0;font:600 var(--fs-sub)/1.25 var(--f-text);color:var(--label2);text-align:center}
.vf-streak{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;background:var(--gold-soft);color:var(--gold-ink);font:800 .95rem/1.2 var(--f-round)}
.vf-streak[hidden]{display:none}
.vf-btns{flex:none;display:grid;grid-template-columns:1fr 1fr;gap:12px}
.vf-b{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;min-height:76px;margin:0;border:0;border-radius:22px;color:#fff;font:800 1.15rem/1.1 var(--f-round);
  cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.28)}
.vf-b:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(0,0,0,.28)}
.vf-b.yes{background:#00707f}
.vf-b.no{background:#4b5563}
.vf-b .qz-k{background:rgba(255,255,255,.25);color:#fff}
@media (max-width:400px){.vf-b span{font-size:1rem}}

/* ===== Abre la caja ===== */
.bx{max-width:760px}
.bx-main{position:relative;display:flex;flex-direction:column;gap:8px;height:var(--h,640px)}
.bx-tip{flex:none;margin:0;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;min-height:34px;text-align:center;font:600 var(--fs-sub)/1.25 var(--f-text);color:var(--label2)}
.bx-x2{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:999px;background:var(--gold);color:#3D2B00;font:900 .95rem/1.3 var(--f-round)}
.bx-x2[hidden]{display:none}
.bx-grid{flex:1 1 0;min-height:0;display:grid;grid-template-columns:repeat(var(--cols,3),minmax(0,1fr));grid-template-rows:repeat(var(--rows,4),minmax(0,1fr));gap:8px}
.bx-b{position:relative;min-width:0;min-height:0;margin:0;padding:3px;border:0;border-radius:18px;background:var(--fill2);cursor:pointer;display:grid;place-items:center}
@media (hover:hover){.bx-b:not(:disabled):hover .bx-svg{transform:translateY(-3px) rotate(-2deg)}}
.bx-b:disabled{cursor:default;background:transparent;box-shadow:inset 0 0 0 1.5px var(--sep)}
.bx-svg{width:100%;height:100%;display:block;overflow:visible;transition:transform .2s}
.bx-svg g{transform-box:fill-box;transform-origin:50% 100%}
.bx-n{font:900 19px/1 var(--f-round);fill:#0B2545}
.bx-b.opening .bx-lid{animation:bx-lid .5s cubic-bezier(.3,.7,.4,1) forwards}
.bx-b.opening .bx-body{animation:bx-shake .32s}
@keyframes bx-lid{30%{transform:translateY(-4px) rotate(-5deg)}100%{transform:translateY(-36px) rotate(-26deg);opacity:0}}
@keyframes bx-shake{25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
.bx-b.open .bx-lid{display:none}
.bx-b.open .bx-body{opacity:.5}
.bx-b.open .bx-res{animation:bx-up .4s cubic-bezier(.3,1.5,.5,1) both}
@keyframes bx-up{from{transform:translateY(16px) scale(.5);opacity:0}}
.bx-b .qz-k{display:none}
/* la caja abierta: la pregunta o la sorpresa, encima de las cajas */
.bx-pop{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px;border-radius:24px;background:var(--card);
  box-shadow:0 10px 30px rgba(0,0,0,.2),inset 0 0 0 2px var(--sep);overflow:auto;animation:gm-in .26s}
.bx-pop[hidden]{display:none}
.bx-head{flex:none;display:flex;align-items:center;justify-content:center;gap:8px;font:800 1rem/1.2 var(--f-round);color:var(--label2)}
.bx-pic{position:relative;flex:1 1 0;min-height:110px;max-height:300px;width:100%}
.bx-pic img{position:absolute;inset:0;margin:auto;height:100%;max-width:100%;aspect-ratio:1;object-fit:contain;padding:8px;box-sizing:border-box;border-radius:22px;
  background:var(--gm-tile);box-shadow:0 0 0 2px var(--sep)}
.bx-pic img.qz-flag{height:auto!important;max-height:100%;padding:0}
.bx-ask{flex:none;margin:0;font:700 1.05rem/1.25 var(--f-text);color:var(--label);text-align:center}
.bx-wq{flex:none;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:4px}
.bx-wq b{font:900 clamp(1.8rem,8vw,2.5rem)/1.1 var(--f-round);color:var(--label);overflow-wrap:anywhere;text-align:center}
.bx-say{flex:none;width:52px;height:52px;border:0;border-radius:50%;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-tint);cursor:pointer}
.bx-opts{flex:none;width:100%;max-width:460px;display:grid;gap:8px}
.bx-opts.words{grid-template-columns:1fr}
.bx-o{position:relative;min-width:0;display:flex;align-items:center;justify-content:center;gap:8px;min-height:56px;margin:0;padding:6px 12px;border:2.5px solid var(--sep);border-radius:16px;
  background:var(--card);color:var(--label);font:800 1.25rem/1.15 var(--f-round);cursor:pointer;box-shadow:0 2px 0 rgba(0,0,0,.08)}
.bx-o .qz-k{left:8px;right:auto;top:50%;transform:translateY(-50%)}
.bx-opts.pics{flex:1 1 0;min-height:0;max-width:none;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:minmax(0,1fr)}
.bx-opts.pics .bx-o{min-height:0;padding:0;background:var(--gm-tile);border-color:rgba(60,60,67,.25)}
.bx-opts.pics .bx-o img{position:absolute;inset:6px;width:calc(100% - 12px);height:calc(100% - 12px);object-fit:contain;mix-blend-mode:multiply;pointer-events:none}
.bx-opts.pics .bx-o img.qz-flag{inset:0;margin:auto;height:auto!important;max-height:calc(100% - 12px)}
.bx-opts.pics .bx-o .qz-k{left:6px;top:6px;transform:none}
@media (max-width:560px){
  .bx-opts.pics{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))}
  .bx-opts.pics .bx-o:nth-child(3){grid-column:1/-1;justify-self:center;width:calc(50% - 4px)}}
@media (hover:hover){.bx-o:not(:disabled):hover{border-color:var(--brand-tint)}}
.bx-o:disabled{cursor:default}
.bx-o.ok{border-color:var(--teal);background:color-mix(in srgb,var(--teal) 14%,var(--card));box-shadow:0 0 0 3px color-mix(in srgb,var(--teal) 35%,transparent)}
.bx-opts.pics .bx-o.ok{background:#dff3f6}
.bx-o.no{border-color:var(--miss);background:var(--miss-fill);color:var(--miss-on)}
.bx-opts.pics .bx-o.no{background:#d5dbe3}
.bx-opts.pics .bx-o.no img{opacity:.55}
.bx-o.dim{opacity:.42}
.bx-fb{flex:none;margin:0;min-height:2.7em;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:2px 8px;text-align:center;font:600 1.05rem/1.3 var(--f-text);color:var(--label)}
.bx-fb .ok{color:var(--teal);font-weight:800}
.bx-fb .no{color:var(--miss-ink);font-weight:800}
.bx-go{flex:none;min-width:200px}
.bx-go[hidden]{display:none}
.bx-sur{flex:1 1 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center}
.bx-big{display:grid;place-items:center;width:132px;height:132px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffe27a,#F1B70E 60%,#c99400);color:#3D2B00;
  border:4px solid #000;font:900 3.2rem/1 var(--f-round);box-shadow:0 8px 20px rgba(0,0,0,.2);animation:bx-up .5s cubic-bezier(.3,1.5,.5,1) both}
.bx-big .ico{width:72px;height:72px}
.bx-sur h3{margin:6px 0 0;font:900 1.9rem/1.15 var(--f-round);color:var(--label)}
.bx-sur p{margin:0;font:600 1.1rem/1.35 var(--f-text);color:var(--label2)}

/* ===== Une con flechas ===== */
.ar{max-width:760px}
.ar-main{position:relative;display:flex;flex-direction:column;gap:8px;height:var(--h,640px)}
.ar-tip{flex:none;margin:0;min-height:30px;display:flex;align-items:center;justify-content:center;text-align:center;font:600 var(--fs-sub)/1.25 var(--f-text);color:var(--label2)}
.ar-board{position:relative;flex:1 1 0;min-height:0;display:grid;grid-template-columns:var(--ts,104px) minmax(44px,1fr) minmax(0,1.75fr);touch-action:none}
.ar-col{position:relative;z-index:1;min-height:0;display:grid;grid-template-rows:repeat(5,minmax(0,1fr));gap:8px}
.ar-l{grid-column:1}
.ar-r{grid-column:3}
.ar-svg{position:absolute;left:0;top:0;width:100%;height:100%;z-index:2;pointer-events:none;overflow:visible}
.ar-t{position:relative;min-width:0;min-height:0;margin:0;padding:6px;border:3px solid var(--sep);border-radius:16px;background:var(--card);color:var(--label);cursor:pointer;
  touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;transition:border-color .15s,box-shadow .15s}
.ar-p{padding:4px;background:var(--gm-tile);border-color:rgba(60,60,67,.28)}
.ar-p img{position:absolute;inset:5px;width:calc(100% - 10px);height:calc(100% - 10px);object-fit:contain;mix-blend-mode:multiply;pointer-events:none}
.ar-p img.qz-flag{inset:0;margin:auto;height:auto!important;max-height:calc(100% - 10px)}
.ar-w{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px 10px 4px 14px;text-align:center}
.ar-wt{font:800 var(--wf,1.2rem)/1.12 var(--f-round);overflow-wrap:anywhere;max-width:100%}
.ar-w .ipa{display:none;margin:0;font-size:.85rem;line-height:1.2}
.ar-w.good .ipa{display:block}
.ar-dot{position:absolute;top:50%;width:16px;height:16px;margin-top:-8px;border-radius:50%;background:var(--card);border:3px solid var(--brand-tint);pointer-events:none}
.ar-p .ar-dot{right:-10px}
.ar-w .ar-dot{left:-10px}
@media (hover:hover){.ar-t:not(.lock):hover{border-color:var(--brand-tint)}}
.ar-t.on{border-color:var(--brand-tint)}
.ar-t.on .ar-dot{background:var(--brand-tint)}
.ar-t.sel{border-color:var(--brand-tint);box-shadow:0 0 0 4px color-mix(in srgb,var(--brand-tint) 32%,transparent)}
.ar-t.over{border-color:var(--brand-tint);box-shadow:0 0 0 4px color-mix(in srgb,var(--brand-tint) 32%,transparent);transform:scale(1.03)}
.ar-t.good{border-color:var(--teal);cursor:default}
.ar-t.good .ar-dot{border-color:var(--teal);background:var(--teal)}
.ar-t.bad{border-color:var(--miss)}
.ar-t.bad .ar-dot{border-color:var(--miss);background:var(--miss)}
.ar-w.good{background:color-mix(in srgb,var(--teal) 12%,var(--card))}
.ar-svg line{stroke-width:5;stroke-linecap:round}
.ar-svg .ln{stroke:var(--brand-tint)}
.ar-svg .ln.good{stroke:var(--teal)}
.ar-svg .ln.bad{stroke:var(--miss);stroke-dasharray:9 8}
.ar-svg .ln.show{stroke:var(--teal);stroke-dasharray:3 9;opacity:.85}
.ar-svg .ln.tmp{stroke:var(--brand-tint);stroke-dasharray:10 8;opacity:.8}
.ar-svg .bx-x circle{fill:var(--miss);stroke:var(--card);stroke-width:2.5}
.ar-svg .bx-x path{stroke:#fff;stroke-width:3;stroke-linecap:round}
.ar-acts{flex:none;display:flex;justify-content:center}
.ar-acts .glass-btn{min-width:min(260px,100%)}
@media (prefers-reduced-motion:reduce){.cq-bulbs i,.cq-q.in,.vf-card.in,.bx-b.opening .bx-lid,.bx-b.opening .bx-body,.cq-me,.bx-big,.bx-res{animation:none!important}}
`;
function css(){
  if(document.getElementById("css-quiz")) return;
  const s = document.createElement("style"); s.id = "css-quiz"; s.textContent = CSS; document.head.appendChild(s);
}

/* =====================================================================
   1. CONCURSO — 10 preguntas, 4 respuestas, comodines y podio
   ===================================================================== */
const CQ_KINDS = ["pic", "pic", "pic", "es", "es", "listen", "listen", "listen", "word", "word"];
const PO = new Set(["listen", "word"]);   /* las preguntas cuyas respuestas son dibujos */
const HINT = {
  pic: {t: "Escuchar", ic: "speaker-high", al: "Comodín: escuchar la respuesta"},
  es: {t: "Escuchar", ic: "speaker-high", al: "Comodín: escuchar la respuesta"},
  listen: {t: "Otra vez", ic: "ear", al: "Comodín: escuchar otra vez, despacio y escrita"},
  word: {t: "Ver dibujo", ic: "eye", al: "Comodín: ver el dibujo un poco borroso"},
};
/* las clases de pregunta, barajadas sin dos iguales seguidas (si se puede) */
function mixKinds(){
  let best = shuffle(CQ_KINDS), bad = Infinity;
  for(let t = 0; t < 80 && bad; t++){
    const k = shuffle(CQ_KINDS), b = k.filter((x, i) => i && x === k[i - 1]).length;
    if(b < bad){ best = k; bad = b; }
  }
  return best;
}
async function concurso(app, api, mode){
  css();
  const P = await words(api, QZ, 6);
  if(!P) return;
  if(P.length < 4){ noWords(app, api); return; }
  const C = code(), T0 = num(window.__concursoT) > 0 ? num(window.__concursoT) : 15, N = 10, AB = ["A", "B", "C", "D"];
  const kinds = mixKinds();
  const Q = deal(P, N).map((it, i) => { const opts = shuffle([it, ...others(P, it, 3)]); return {kind: kinds[i], it, opts, ans: opts.indexOf(it)}; });
  preload(Q.slice(0, 2).flatMap(q => q.opts));
  const run = api.mount(app, `<div class="gm qz cq po" id="cq">
    ${api.topHtml(QZ, `<span class="gm-pill" title="Puntos">${IC("star", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`)}
    <div class="cq-main" id="cq-main">
      <div class="cq-stage" id="cq-stage">
        <span class="cq-beam l" aria-hidden="true"></span><span class="cq-beam r" aria-hidden="true"></span>
        <span class="cq-bulbs" aria-hidden="true">${"<i></i>".repeat(11)}</span>
        <div class="cq-board" role="group" aria-label="Marcador">
          <div class="cq-cell"><small>Pregunta</small><b id="cq-n">1/${N}</b></div>
          <div class="cq-cell"><small>Tiempo</small><b id="cq-s">${T0}</b></div>
          <div class="cq-cell"><small>Racha</small><b id="cq-x">×1</b></div></div>
        <div class="gm-tbar cq-tbar" id="cq-tbar"><i id="cq-tb"></i></div>
        <div class="cq-q" id="cq-q"><span class="cq-say" aria-hidden="true">${IC("microphone-stage", "fill", 36)}</span><p class="cq-ask">¡Bienvenido al concurso!</p></div>
      </div>
      <div class="cq-opts pics" id="cq-opts" role="group" aria-label="Respuestas"></div>
      <div class="cq-life" id="cq-life" role="group" aria-label="Comodines: uno de cada en toda la partida">
        <button type="button" class="cq-lf" data-l="half" aria-label="Comodín 50:50: quita dos respuestas" disabled><b>50:50</b>${kb("7")}</button>
        <button type="button" class="cq-lf" data-l="time" aria-label="Comodín: 10 segundos más" disabled>${IC("timer", "bold", 20)}<b>+10 s</b>${kb("8")}</button>
        <button type="button" class="cq-lf" data-l="hint" id="cq-lh" aria-label="Comodín: pista" disabled><span id="cq-lh-i">${IC("lightbulb", "bold", 20)}</span><b id="cq-lh-t">Pista</b>${kb("9")}</button></div>
      <p class="cq-fb" id="cq-fb" role="status" aria-live="polite"></p>
    </div></div>`, mode);
  const root = run.root, main = root.querySelector("#cq-main"), qEl = root.querySelector("#cq-q"), oEl = root.querySelector("#cq-opts");
  const fb = root.querySelector("#cq-fb"), sc = root.querySelector("#gm-sc"), nEl = root.querySelector("#cq-n"), sEl = root.querySelector("#cq-s");
  const xEl = root.querySelector("#cq-x"), tb = root.querySelector("#cq-tb"), tbar = root.querySelector("#cq-tbar");
  const LF = {}; root.querySelectorAll(".cq-lf").forEach(b => { LF[b.dataset.l] = b; });
  const used = {half: false, time: false, hint: false};
  let qi = -1, S = null, score = 0, rights = 0, streak = 0, best = 0, last = 0, ended = false;
  const seen = tracker();
  const mult = () => streak >= 5 ? 3 : streak >= 3 ? 2 : 1;
  const opts = () => [...oEl.querySelectorAll(".cq-o")];

  /* la foto de la pregunta crece con el hueco que deja el escenario (en las preguntas de respuestas escritas) */
  function layout(){
    const pp = qEl.querySelector(".cq-pic");
    if(!pp) return;
    pp.style.setProperty("--pp", "96px");
    const kids = [...qEl.children].filter(k => k.offsetParent !== null);
    const gap = parseFloat(getComputedStyle(qEl).rowGap) || 0;
    const usedH = kids.reduce((s, k) => s + k.offsetHeight, 0) + gap * Math.max(0, kids.length - 1);
    const spare = qEl.clientHeight - usedH;
    pp.style.setProperty("--pp", Math.round(Math.max(96, Math.min(250, qEl.clientWidth - 8, 96 + spare))) + "px");
  }
  const fit = filler(api, run, main, 520, 900, layout);

  function paintLife(){
    const on = !!S && !S.done && S.on;
    for(const k of Object.keys(LF)){
      const b = LF[k];
      b.disabled = used[k] || !on;
      b.classList.toggle("used", used[k]);
    }
    if(S){
      const H = HINT[S.q.kind];
      root.querySelector("#cq-lh-i").innerHTML = IC(H.ic, "bold", 20);
      root.querySelector("#cq-lh-t").textContent = H.t;
      LF.hint.setAttribute("aria-label", used.hint ? "Comodín de pista: ya usado" : H.al);
    }
    LF.half.setAttribute("aria-label", used.half ? "Comodín 50:50: ya usado" : "Comodín 50:50: quita dos respuestas");
    LF.time.setAttribute("aria-label", used.time ? "Comodín de 10 segundos: ya usado" : "Comodín: 10 segundos más");
  }
  function show(){
    qi++;
    const q = Q[qi], po = PO.has(q.kind), nmL = api.nm();
    S = {q, t: 0, T: T0, done: false, on: true, cut: new Set()};
    root.cqAns = q.ans;   /* para las pruebas */
    root.classList.toggle("po", po); root.classList.toggle("wo", !po);
    nEl.textContent = `${qi + 1}/${N}`;
    const help = `<div class="cq-help" id="cq-help"></div>`;
    qEl.innerHTML = q.kind === "pic" ? `<div class="cq-pic">${imgHtml(q.it)}</div><p class="cq-ask">¿Cómo se dice en ${esc(nmL)}?</p>${help}`
      : q.kind === "es" ? `<p class="cq-ask">¿Cómo se dice en ${esc(nmL)}?</p><b class="cq-es" lang="es">${esc(q.it.es)}</b>${help}`
      : q.kind === "listen" ? `<button type="button" class="cq-say" id="cq-say" aria-label="Escuchar la palabra">${IC("speaker-high", "fill", 36)}</button><p class="cq-ask">Escucha. ¿Qué dibujo es?</p>${help}`
      : `<b class="cq-word" lang="${esc(C)}">${esc(q.it.word)}</b><p class="cq-ask">¿Qué dibujo es?</p>${help}`;
    qEl.classList.remove("in"); void qEl.offsetWidth; if(!RM()) qEl.classList.add("in");
    oEl.className = "cq-opts " + (po ? "pics" : "words");
    oEl.innerHTML = q.opts.map((o, i) => po
      ? `<button type="button" class="cq-o" data-i="${i}" aria-label="${AB[i]}: ${esc(o.es)}"><span class="cq-l" aria-hidden="true">${AB[i]}</span><span class="cq-im">${imgHtml(o)}</span>${MK}${kb(i + 1)}</button>`
      : `<button type="button" class="cq-o" data-i="${i}"><span class="cq-l" aria-hidden="true">${AB[i]}</span><span class="cq-w" lang="${esc(C)}" style="font-size:${wfs(o.word)}rem">${esc(o.word)}</span>${MK}${kb(i + 1)}</button>`).join("");
    fb.innerHTML = "";
    tbar.classList.remove("low"); tb.style.transform = "scaleX(1)"; sEl.textContent = T0;
    paintLife();
    fit();
    const nx = Q[qi + 1]; if(nx) preload(nx.opts);
    if(q.kind === "listen") api.later(run, () => { if(S && S.q === q && !S.done) api.speak(q.it.word); }, 380);
    if(api.kbd()) focusEl(oEl.querySelector(".cq-o"));
  }
  function reveal(i){
    const q = S.q;
    opts().forEach((b, k) => { b.disabled = true; b.classList.add(k === q.ans ? "ok" : k === i ? "no" : "dim"); });
  }
  function choose(i){
    if(!S || S.done || !S.on || run.paused || !api.live(run) || S.cut.has(i) || !(i >= 0 && i < 4)) return;
    const q = S.q, ok = i === q.ans, rem = Math.max(0, S.T - S.t), b = opts()[i];
    S.done = true;
    reveal(i);
    if(ok){
      rights++; streak++; best = Math.max(best, streak);
      const m = mult(), pts = (100 + Math.round(100 * rem / S.T)) * m;
      score += pts; sc.textContent = score; api.bump(sc.parentNode);
      xEl.textContent = "×" + m; if(m > 1) api.bump(xEl);
      api.snd("coin"); api.haptic("success");
      floatUp(api, run, main, b, `+${pts}${m > 1 ? ` · ×${m}` : ""}`);
      sparks(b, 10);
      fb.innerHTML = `<span class="cq-ok">${IC("check-circle", "fill", 22)}¡Bien!</span><span>${wordIpa(q.it)}</span>`;
      seen.add(q.it, false);
    } else {
      streak = 0; xEl.textContent = "×1";
      api.snd("tap");
      fb.innerHTML = `<span class="cq-no">${IC("x-circle", "fill", 22)}Era</span><span>${wordIpa(q.it)} <small>(${esc(q.it.es)})</small></span>`;
      seen.add(q.it, true);
    }
    api.answer(ok, q.it);
    api.speak(q.it.word);
    paintLife();
    api.later(run, next, ok ? 1900 : 2900);
  }
  function timeout(){
    if(!S || S.done) return;
    const q = S.q;
    S.done = true; streak = 0; xEl.textContent = "×1";
    tb.style.transform = "scaleX(0)"; sEl.textContent = "0";
    reveal(-1);
    fb.innerHTML = `<span class="cq-no">${IC("timer", "bold", 22)}¡Tiempo! Era</span><span>${wordIpa(q.it)} <small>(${esc(q.it.es)})</small></span>`;
    api.answer(false, q.it); seen.add(q.it, true); api.speak(q.it.word);
    paintLife();
    api.later(run, next, 2900);
  }
  function next(){ if(ended || !api.live(run)) return; if(qi + 1 >= N) podium(); else show(); }
  /* los comodines (uno de cada en la partida) */
  function life(k){
    if(!S || S.done || !S.on || used[k] || run.paused || !api.live(run)) return;
    const q = S.q;
    used[k] = true;
    api.haptic("selection"); api.snd("pop");
    if(k === "half"){
      shuffle([0, 1, 2, 3].filter(i => i !== q.ans)).slice(0, 2).forEach(i => {
        S.cut.add(i); const b = opts()[i]; b.classList.add("cut"); b.disabled = true;
      });
      fb.textContent = "50:50: quedan dos respuestas.";
    } else if(k === "time"){
      S.T += 10;
      floatUp(api, run, main, tbar, "+10 s");
      fb.textContent = "¡10 segundos más!";
    } else {
      const help = qEl.querySelector("#cq-help");
      if(q.kind === "listen"){
        api.speak(q.it.word, true);
        help.innerHTML = `<span class="cq-wr">${wordIpa(q.it)}</span>`;
        fb.textContent = "Despacio y escrita.";
      } else if(q.kind === "word"){
        help.innerHTML = `<span class="cq-blur">${imgHtml(q.it)}</span>`;
        fb.textContent = "El dibujo, un poco borroso.";
      } else {
        api.speak(q.it.word);
        help.innerHTML = `<button type="button" class="cq-mini" id="cq-again">${IC("speaker-high", "fill", 20)}Escuchar otra vez</button>`;
        fb.textContent = "Escucha la respuesta buena.";
      }
      layout();
    }
    paintLife();
    const a = document.activeElement;
    if(api.kbd() && a && (a.disabled || (a.closest && a.closest(".cq-life")))) focusEl(opts().find(b => !b.disabled));
  }
  function frame(now){
    if(!api.live(run) || ended) return;
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    if(S && S.on && !S.done && !run.paused && !document.hidden){
      S.t += dt;
      const rem = Math.max(0, S.T - S.t), s = String(Math.ceil(rem));
      tb.style.transform = `scaleX(${rem / S.T})`;
      if(sEl.textContent !== s) sEl.textContent = s;
      tbar.classList.toggle("low", rem < 5);
      if(rem <= 0) timeout();
    }
    run.raf = requestAnimationFrame(frame);
  }
  /* el podio: el puesto según los aciertos (★★★ = 1.º) y los puntos que suben */
  function podium(){
    ended = true; S = null;
    root.classList.add("end");
    const stars = rights >= 9 ? 3 : rights >= 6 ? 2 : 1, place = 4 - stars, words = seen.list();
    let done = false;
    const fin = () => {
      if(done || !api.live(run)) return; done = true;
      api.finish(run, QZ, {score, stars, words,
        line: `¡${rights} de ${N} bien y ${score} puntos!${best >= 3 ? ` Tu mejor racha: ${best} seguidas.` : ""}`});
    };
    main.insertAdjacentHTML("beforeend", `<div class="cq-pod" id="cq-pod" role="dialog" aria-labelledby="cq-pod-t">
      <span class="cq-beam l" aria-hidden="true"></span><span class="cq-beam r" aria-hidden="true"></span>
      <div class="cq-pod-c">
        <h2 class="cq-pod-t" id="cq-pod-t">${["", "¡Primer puesto!", "¡Segundo puesto!", "¡Tercer puesto!"][place]}</h2>
        <p class="cq-pod-p"><b id="cq-pod-n">${RM() ? score : 0}</b>puntos</p>
        <div class="cq-steps" aria-hidden="true">${[2, 1, 3].map(p => `<div class="cq-step s${p}">${p === place ? `<span class="cq-me">${IC("trophy", "fill", 40)}<small>Tú</small></span>` : ""}${p}</div>`).join("")}</div>
        <div class="cq-floor" aria-hidden="true"></div>
        <p class="cq-pod-l">${rights} de ${N} bien${best >= 3 ? ` · racha de ${best}` : ""}</p>
        <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="cq-pod-go">${IC("star", "fill", 20)}Ver el premio</button></div></div>`);
    const pod = main.querySelector("#cq-pod"), nn = pod.querySelector("#cq-pod-n");
    root.cqScore = score;   /* para las pruebas */
    api.snd("ok");
    if(!RM()){
      const t0 = performance.now();
      const step = now => {
        if(!api.live(run) || !nn.isConnected) return;
        const p = Math.min(1, (now - t0) / 1100);
        nn.textContent = Math.round(score * (1 - Math.pow(1 - p, 3)));
        if(p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    pod.querySelector("#cq-pod-go").onclick = fin;
    api.keys(run, e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); fin(); } });
    if(api.kbd()) focusEl(pod.querySelector("#cq-pod-go"));
    api.later(run, fin, 6000);
  }
  function onKey(e){
    if(e.ctrlKey || e.metaKey || e.altKey || !S) return;
    const k = e.key;
    if(/^[1-4]$/.test(k)){ e.preventDefault(); choose(+k - 1); return; }
    if(/^[abcd]$/i.test(k)){ e.preventDefault(); choose("abcd".indexOf(k.toLowerCase())); return; }
    if(k === "7"){ e.preventDefault(); life("half"); return; }
    if(k === "8"){ e.preventDefault(); life("time"); return; }
    if(k === "9"){ e.preventDefault(); life("hint"); return; }
    if(k === " " && !(e.target.closest && e.target.closest("button"))){
      if(S.q.kind === "listen" || (used.hint && qEl.querySelector("#cq-again"))){ e.preventDefault(); api.speak(S.q.it.word); }
      return;
    }
    gridNav(e, opts(), 2);
  }
  oEl.addEventListener("click", e => { const b = e.target.closest(".cq-o"); if(b && !b.disabled) choose(+b.dataset.i); });
  root.querySelector("#cq-life").addEventListener("click", e => { const b = e.target.closest(".cq-lf"); if(b && !b.disabled) life(b.dataset.l); });
  qEl.addEventListener("click", e => { if(S && e.target.closest("#cq-say,#cq-again")) api.speak(S.q.it.word); });
  api.intro(run, QZ, () => {
    last = performance.now();
    show();
    run.raf = requestAnimationFrame(frame);
    api.keys(run, onKey);
  });
}

/* =====================================================================
   2. VERDADERO O FALSO — ¿es la palabra de este dibujo?
   ===================================================================== */
async function verdadero(app, api, mode){
  css();
  const P = await words(api, VF, 6);
  if(!P) return;
  if(P.length < 4){ noWords(app, api); return; }
  const C = code(), DUR = num(window.__verdaderoDur) > 0 ? num(window.__verdaderoDur) : 60;
  const run = api.mount(app, `<div class="gm qz vf" id="vf">
    ${api.topHtml(VF, `<span class="gm-pill" title="Tiempo">${IC("timer", "bold", 18)}<b id="vf-clock">${clock(DUR)}</b></span><span class="gm-pill" title="Aciertos">${IC("check-circle", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`)}
    <div class="vf-main" id="vf-main">
      <div class="gm-tbar vf-tbar" id="vf-tbar"><i id="vf-tb"></i></div>
      <div class="vf-deck" id="vf-deck">
        <div class="vf-card" id="vf-card" aria-describedby="vf-ask">
          <div class="vf-pic" id="vf-pic"></div>
          <b class="vf-w" id="vf-w" lang="${esc(C)}">¿Preparado?</b>
          <p class="vf-ans" id="vf-ans" role="status" aria-live="polite"></p>
          <span class="vf-stamp" aria-hidden="true">${IC("check", "bold", 34, "v")}${IC("x", "bold", 34, "x")}</span>
          <span class="vf-sw r" aria-hidden="true">SÍ</span><span class="vf-sw l" aria-hidden="true">NO</span>
          <span class="vf-lim" aria-hidden="true"><i id="vf-lim"></i></span></div></div>
      <p class="vf-row"><span id="vf-ask">¿Es la palabra de este dibujo?</span><span class="vf-streak" id="vf-streak" hidden></span></p>
      <div class="vf-btns">
        <button type="button" class="vf-b no" id="vf-no" aria-label="Falso: no es su palabra">${IC("x", "bold", 36)}<span>Falso</span>${kb("←")}</button>
        <button type="button" class="vf-b yes" id="vf-yes" aria-label="Verdadero: es su palabra">${IC("check", "bold", 36)}<span>Verdadero</span>${kb("→")}</button></div>
    </div></div>`, mode);
  const root = run.root, main = root.querySelector("#vf-main"), card = root.querySelector("#vf-card"), picEl = root.querySelector("#vf-pic");
  const wEl = root.querySelector("#vf-w"), ans = root.querySelector("#vf-ans"), lim = root.querySelector("#vf-lim"), sc = root.querySelector("#gm-sc");
  const clk = root.querySelector("#vf-clock"), tb = root.querySelector("#vf-tb"), tbar = root.querySelector("#vf-tbar"), stk = root.querySelector("#vf-streak");
  const swR = card.querySelector(".vf-sw.r"), swL = card.querySelector(".vf-sw.l");
  let t = 0, last = 0, running = false, ended = false, cur = null, score = 0, streak = 0, best = 0, cards = 0, bag = [], lastTruth = [];
  const seen = tracker();
  filler(api, run, main, 480, 820);

  const nextItem = () => { if(!bag.length) bag = shuffle(P); return bag.pop(); };
  /* una tarjeta nueva: la mitad más o menos con su palabra (nunca 3 seguidas iguales) */
  function dealCard(){
    if(!running || ended) return;
    const it = nextItem();
    let truth = Math.random() < .5;
    if(lastTruth.length >= 2 && lastTruth.slice(-2).every(x => x === truth)) truth = !truth;
    const o = truth ? null : others(P, it, 1)[0];
    if(!o) truth = true;
    lastTruth.push(truth); if(lastTruth.length > 4) lastTruth.shift();
    cards++;
    cur = {it, shown: truth ? it : o, ok: truth, at: t, lim: Math.max(3.2, 6.5 - 3.3 * t / DUR), done: false};
    card.vfOk = truth;   /* para las pruebas */
    card.classList.remove("good", "bad", "in"); void card.offsetWidth; if(!RM()) card.classList.add("in");
    picEl.innerHTML = imgHtml(it);
    wEl.textContent = cur.shown.word; wEl.classList.remove("strike");
    ans.innerHTML = "";
    card.setAttribute("aria-label", `Dibujo de ${it.es}. Palabra: ${cur.shown.word}`);
    lim.style.transform = "scaleX(1)";
    const nx = bag[bag.length - 1]; if(nx) preload([nx]);
  }
  function paintStreak(){
    stk.hidden = streak < 2;
    stk.innerHTML = `${IC("lightning", "bold", 16)}Racha ${streak}`;
  }
  function answer(yes){
    if(!running || !cur || cur.done || run.paused || !api.live(run)) return;
    cur.done = true;
    const right = yes === cur.ok, it = cur.it;
    card.classList.add(right ? "good" : "bad");
    if(right){
      score++; streak++; best = Math.max(best, streak);
      sc.textContent = score; api.bump(sc.parentNode);
      api.snd("coin"); api.haptic("success");
      if(streak >= 3 && streak % 5 === 0) floatUp(api, run, main, stk.hidden ? sc : stk, `¡Racha ${streak}!`);
      ans.innerHTML = cur.ok ? `<span class="ok">¡Sí!</span><span>${wordIpa(it)}</span>` : `<span class="ok">¡Bien! Es</span><span>${wordIpa(it)}</span>`;
      seen.add(it, false);
    } else {
      streak = 0;
      api.snd("tap");
      if(!cur.ok) wEl.classList.add("strike");
      ans.innerHTML = cur.ok ? `<span>Sí era</span><span>${wordIpa(it)}</span>` : `<span>Era</span><span>${wordIpa(it)}</span>`;
      seen.add(it, true);
    }
    paintStreak();
    api.answer(right, it);
    api.speak(it.word);
    api.later(run, dealCard, right ? Math.max(650, 1100 - 450 * t / DUR) : 1800);
  }
  /* se acabó el tiempo de la tarjeta: cuenta como fallo (sin ✗ en la palabra) y se ve la buena */
  function late(){
    if(!cur || cur.done) return;
    cur.done = true; streak = 0; paintStreak();
    card.classList.add("bad");
    ans.innerHTML = `<span>${cur.ok ? "¡Tiempo! Sí era" : "¡Tiempo! Era"}</span><span>${wordIpa(cur.it)}</span>`;
    api.answer(false, cur.it); seen.add(cur.it, true); api.speak(cur.it.word);
    api.later(run, dealCard, 1700);
  }
  function end(){
    if(ended) return;
    ended = true; running = false;
    root.querySelectorAll(".vf-b").forEach(b => { b.disabled = true; });
    main.insertAdjacentHTML("beforeend", `<div class="gm-over"><span>⏰</span>¡Se acabó el tiempo!</div>`);
    api.snd("whoosh");
    api.later(run, () => {
      const stars = score >= 16 ? 3 : score >= 9 ? 2 : 1;
      api.finish(run, VF, {score, stars, words: seen.list(),
        line: !score ? "¡Casi! La próxima vez acertarás muchas." : `¡${plural(score, "acierto", "aciertos")} en ${DUR} segundos!${best >= 3 ? ` Tu mejor racha: ${best}.` : ""}`});
    }, 1500);
  }
  function frame(now){
    if(!api.live(run) || ended) return;
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    if(running && !run.paused && !document.hidden){
      t += dt;
      if(cur && !cur.done){
        const p = (t - cur.at) / cur.lim;
        lim.style.transform = `scaleX(${Math.max(0, 1 - p)})`;
        if(p >= 1) late();
      }
      const rem = Math.max(0, Math.ceil(DUR - t));
      if(clk.textContent !== clock(rem)) clk.textContent = clock(rem);
      tb.style.transform = `scaleX(${Math.max(0, 1 - t / DUR)})`;
      tbar.classList.toggle("low", DUR - t < 10);
      if(t >= DUR){ end(); return; }
    }
    run.raf = requestAnimationFrame(frame);
  }
  /* deslizar la tarjeta: a la derecha, verdadero; a la izquierda, falso (G.swipe de js/gestures.js) */
  const swOff = (() => {
    if(!window.G || typeof G.swipe !== "function") return null;
    const reset = () => { card.style.translate = ""; card.style.rotate = ""; swR.style.opacity = swL.style.opacity = 0; };
    return G.swipe(card, {
      onMove: ({dx, p}) => {
        if(!running || !cur || cur.done || run.paused){ reset(); return; }
        card.style.translate = `${dx}px 0`; card.style.rotate = `${dx / 24}deg`;
        swR.style.opacity = Math.max(0, Math.min(1, p)); swL.style.opacity = Math.max(0, Math.min(1, -p));
      },
      onRight: () => { reset(); answer(true); },
      onLeft: () => { reset(); answer(false); },
      onCancel: reset,
    });
  })();
  if(swOff) run.clean.push(swOff);
  root.querySelector("#vf-yes").onclick = () => answer(true);
  root.querySelector("#vf-no").onclick = () => answer(false);
  api.intro(run, VF, () => {
    running = true; last = performance.now();
    dealCard();
    run.raf = requestAnimationFrame(frame);
    api.keys(run, e => {
      if(e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if(k === "ArrowRight" || k === "v" || k === "V"){ e.preventDefault(); answer(true); }
      else if(k === "ArrowLeft" || k === "f" || k === "F"){ e.preventDefault(); answer(false); }
      else if(k === " " && cur && !(e.target.closest && e.target.closest("button"))){ e.preventDefault(); if(cur.done) api.speak(cur.it.word); }
    });
  });
}

/* =====================================================================
   3. ABRE LA CAJA — 12 cajas: preguntas y sorpresas
   ===================================================================== */
const BOX_COLS = ["#0f2f57", "#1f5fbf", "#13787f", "#4b5563", "#2b7a4b", "#8a5a33"];
function boxSvg(n, col){
  return `<svg class="bx-svg" viewBox="3 7 94 94" aria-hidden="true" focusable="false">
    <g class="bx-body"><rect x="15" y="45" width="70" height="50" rx="6" fill="${col}" stroke="#000" stroke-width="3.5"/>
      <rect x="44" y="45" width="12" height="50" fill="#F1B70E" stroke="#000" stroke-width="3"/>
      <circle cx="50" cy="71" r="15" fill="#fff" stroke="#000" stroke-width="3"/>
      <text class="bx-n" x="50" y="72" text-anchor="middle" dominant-baseline="central"${n > 9 ? ' style="font-size:16px"' : ""}>${n}</text></g>
    <g class="bx-res"></g>
    <g class="bx-lid"><path d="M50 31 C41 12 24 15 31 27 C35 32 44 32 50 31Z M50 31 C59 12 76 15 69 27 C65 32 56 32 50 31Z" fill="#F1B70E" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
      <rect x="9" y="30" width="82" height="18" rx="5" fill="${col}" stroke="#000" stroke-width="3.5"/>
      <rect x="44" y="30" width="12" height="18" fill="#F1B70E" stroke="#000" stroke-width="3"/></g></svg>`;
}
/* lo que sale de la caja abierta: ✓, ✗, ★ o ×2 */
const BOX_RES = {
  ok: `<circle cx="50" cy="30" r="16" fill="#008198" stroke="#000" stroke-width="3"/><path d="M42 30.5 l5.5 5.5 l10.5 -11" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  no: `<circle cx="50" cy="30" r="16" fill="#8e8e93" stroke="#000" stroke-width="3"/><path d="M44 24 l12 12 M56 24 l-12 12" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>`,
  star: `<path d="M50 11 l5.6 11.4 12.6 1.8 -9.1 8.9 2.2 12.5 -11.3 -5.9 -11.3 5.9 2.2 -12.5 -9.1 -8.9 12.6 -1.8Z" fill="#F1B70E" stroke="#000" stroke-width="3" stroke-linejoin="round"/>`,
  x2: `<circle cx="50" cy="29" r="17" fill="#F1B70E" stroke="#000" stroke-width="3"/><text x="50" y="30" text-anchor="middle" dominant-baseline="central" style="font:900 17px var(--f-round);fill:#3D2B00">×2</text>`,
};
async function cajas(app, api, mode){
  css();
  const P = await words(api, BOX, 6);
  if(!P) return;
  if(P.length < 3){ noWords(app, api); return; }
  const C = code(), NB = 12, NQ = 9;
  const qs = deal(P, NQ).map((it, i) => ({type: "q", it, as: i % 2 ? "pic" : "word"}));
  const sur = shuffle(["doble", "estrella", Math.random() < .5 ? "doble" : "estrella"]).map(type => ({type}));
  const B = shuffle([...qs, ...sur]).map((c, i) => Object.assign(c, {n: i + 1, open: false}));
  const run = api.mount(app, `<div class="gm qz bx" id="bx">
    ${api.topHtml(BOX, `<span class="gm-pill" title="Cajas por abrir">${IC("gift", "bold", 18)}<b id="bx-left">${NB}</b></span><span class="gm-pill" title="Puntos">${IC("star", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`)}
    <div class="bx-main" id="bx-main">
      <p class="bx-tip" id="bx-tip"><span id="bx-tt">Abre una caja: tócala o escribe su número.</span><span class="bx-x2" id="bx-x2" hidden>${IC("lightning", "bold", 16)}×2</span></p>
      <div class="bx-grid" id="bx-grid" role="group" aria-label="Cajas de regalo">${B.map((b, i) => `<button type="button" class="bx-b" data-n="${b.n}" aria-label="Caja ${b.n}">${boxSvg(b.n, BOX_COLS[i % BOX_COLS.length])}</button>`).join("")}</div>
      <div class="bx-pop" id="bx-pop" role="dialog" aria-labelledby="bx-ph" hidden></div>
      <p class="vh" id="bx-live" role="status" aria-live="polite"></p>
    </div></div>`, mode);
  const root = run.root, main = root.querySelector("#bx-main"), grid = root.querySelector("#bx-grid"), pop = root.querySelector("#bx-pop");
  const sc = root.querySelector("#gm-sc"), leftEl = root.querySelector("#bx-left"), tt = root.querySelector("#bx-tt"), x2 = root.querySelector("#bx-x2"), liveEl = root.querySelector("#bx-live");
  const btns = [...grid.querySelectorAll(".bx-b")];
  let started = false, busy = false, cur = null, score = 0, rights = 0, asked = 0, dbl = false, left = NB, cols = 3, buf = "", bufT = 0, closeT = 0;
  const seen = tracker();
  const say = txt => { liveEl.textContent = ""; setTimeout(() => { if(liveEl.isConnected) liveEl.textContent = txt; }, 40); };

  /* la rejilla que deja las cajas más grandes: 3 × 4, 4 × 3 o 6 × 2 */
  function layout(){
    const W = grid.clientWidth, H = grid.clientHeight;
    if(!W || !H) return;
    let bestC = 3, bestS = 0;
    for(const c of [3, 4, 6]){ const r = NB / c, s = Math.min((W - 8 * (c - 1)) / c, (H - 8 * (r - 1)) / r); if(s > bestS + 4){ bestS = s; bestC = c; } }
    cols = bestC;
    grid.style.setProperty("--cols", cols); grid.style.setProperty("--rows", NB / cols);
  }
  filler(api, run, main, 480, 860, layout);
  const remainingQ = () => B.filter(b => !b.open && b.type === "q").length;

  function openBox(b){
    if(!started || busy || !b || b.open || run.paused || !api.live(run)) return;
    busy = true; cur = b; b.open = true;
    root.bxCur = b.n;   /* para las pruebas */
    const el = btns[b.n - 1];
    el.classList.add("opening"); el.disabled = true;
    api.snd("pop"); api.haptic("selection");
    api.later(run, () => showPop(b), RM() ? 60 : 540);
  }
  function showPop(b){
    const el = btns[b.n - 1];
    el.classList.remove("opening"); el.classList.add("open");
    let h = `<div class="bx-head" id="bx-ph">${IC("gift", "bold", 20)}Caja ${b.n}${dbl && b.type === "q" ? ` <span class="bx-x2">${IC("lightning", "bold", 16)}×2</span>` : ""}</div>`;
    if(b.type === "q"){
      asked++;
      const opts = shuffle([b.it, ...others(P, b.it, 2)]);
      b.opts = opts; b.ans = opts.indexOf(b.it);
      root.bxAns = b.ans;   /* para las pruebas */
      if(b.as === "pic"){
        h += `<div class="bx-pic">${imgHtml(b.it)}</div><p class="bx-ask">¿Cuál es la palabra?</p>
          <div class="bx-opts words" role="group" aria-label="Respuestas">${opts.map((o, i) => `<button type="button" class="bx-o" data-i="${i}"><span lang="${esc(C)}">${esc(o.word)}</span>${MK}${kb(i + 1)}</button>`).join("")}</div>`;
      } else {
        h += `<div class="bx-wq"><b lang="${esc(C)}">${esc(b.it.word)}</b><button type="button" class="bx-say" id="bx-say" aria-label="Escuchar la palabra">${IC("speaker-high", "fill", 26)}</button></div>
          <p class="bx-ask">¿Qué dibujo es?</p>
          <div class="bx-opts pics" role="group" aria-label="Respuestas">${opts.map((o, i) => `<button type="button" class="bx-o" data-i="${i}" aria-label="${i + 1}: ${esc(o.es)}">${imgHtml(o)}${MK}${kb(i + 1)}</button>`).join("")}</div>`;
      }
      h += `<p class="bx-fb" id="bx-fb" role="status" aria-live="polite"></p><button type="button" class="glass-btn glass-btn--pri glass-btn--lg bx-go" id="bx-go" hidden>Seguir${IC("arrow-right", "bold", 20)}</button>`;
    } else {
      let big, title, txt;
      if(b.type === "estrella"){ score += 1; big = IC("star", "fill", 72); title = "Estrella extra"; txt = "¡Un punto más para ti!"; b.res = "star"; }
      else if(!dbl && remainingQ() > 0){ dbl = true; big = "×2"; title = "¡Doble!"; txt = "La próxima pregunta vale el doble."; b.res = "x2"; }
      else { score += 1; big = "×2"; title = "¡Doble!"; txt = dbl ? "Ya tenías el doble: te llevas un punto." : "No quedan preguntas: te llevas un punto."; b.res = "x2"; }
      h += `<div class="bx-sur"><span class="bx-big" aria-hidden="true">${big}</span><h3>${title}</h3><p>${txt}</p></div>
        <button type="button" class="glass-btn glass-btn--pri glass-btn--lg bx-go" id="bx-go">¡Bien!</button>`;
      sc.textContent = score; api.bump(sc.parentNode);
      api.snd("gift"); api.haptic("success");
      x2.hidden = !dbl;
      say(`${title} ${txt}`);
    }
    pop.innerHTML = h; pop.hidden = false;
    pop.querySelectorAll(".bx-o").forEach(o => { o.onclick = () => choose(+o.dataset.i); });
    const go = pop.querySelector("#bx-go"); go.onclick = closePop;
    const sy = pop.querySelector("#bx-say"); if(sy) sy.onclick = () => api.speak(b.it.word);
    if(b.type === "q"){ say(b.as === "pic" ? "¿Cuál es la palabra de este dibujo?" : `¿Qué dibujo es ${b.it.word}?`); if(b.as === "word") api.later(run, () => { if(cur === b && !b.done) api.speak(b.it.word); }, 300); }
    else closeT = api.later(run, closePop, 2600);
    if(api.kbd()) focusEl(pop.querySelector(".bx-o") || go);
  }
  function choose(i){
    const b = cur;
    if(!b || b.type !== "q" || !b.opts || b.done || run.paused || !(i >= 0 && i < b.opts.length)) return;
    b.done = true;
    const ok = i === b.ans, f = pop.querySelector("#bx-fb"), os = [...pop.querySelectorAll(".bx-o")];
    os.forEach((o, k) => { o.disabled = true; o.classList.add(k === b.ans ? "ok" : k === i ? "no" : "dim"); });
    const m = dbl ? 2 : 1;
    if(ok){
      rights++; score += m; sc.textContent = score; api.bump(sc.parentNode);
      api.snd("coin"); api.haptic("success"); sparks(os[i], 10);
      floatUp(api, run, main, os[i], m > 1 ? "+2 · ¡doble!" : "+1");
      f.innerHTML = `<span class="ok">¡Bien!</span><span>${wordIpa(b.it)}</span>`;
      b.res = "ok";
    } else {
      api.snd("tap");
      f.innerHTML = `<span class="no">Era</span><span>${wordIpa(b.it)} <small>(${esc(b.it.es)})</small></span>`;
      b.res = "no";
    }
    dbl = false; x2.hidden = true;
    seen.add(b.it, !ok);
    api.answer(ok, b.it);
    api.speak(b.it.word);
    const go = pop.querySelector("#bx-go"); go.hidden = false;
    if(api.kbd()) focusEl(go);
    closeT = api.later(run, closePop, ok ? 2300 : 3300);
  }
  function closePop(){
    const b = cur;
    if(!b || !busy || pop.hidden) return;
    if(b.type === "q" && !b.done) return;
    clearTimeout(closeT);
    pop.hidden = true; pop.innerHTML = "";
    const el = btns[b.n - 1];
    el.querySelector(".bx-res").innerHTML = BOX_RES[b.res] || "";
    el.setAttribute("aria-label", `Caja ${b.n}, abierta: ${{ok: "acertaste", no: "fallaste", star: "estrella extra", x2: "doble"}[b.res] || ""}`);
    left--; leftEl.textContent = left; api.bump(leftEl.parentNode);
    busy = false; cur = null;
    if(!left){ end(); return; }
    tt.textContent = left === 1 ? "¡Queda una caja!" : `Quedan ${left} cajas.`;
    if(api.kbd()) focusEl(btns.find(x => !x.disabled));
  }
  function end(){
    started = false;
    tt.textContent = "¡Todas abiertas!";
    api.snd("whoosh");
    api.later(run, () => {
      const stars = rights >= NQ - 1 ? 3 : rights >= 5 ? 2 : 1;
      api.finish(run, BOX, {score, stars, words: seen.list(),
        line: `¡${rights} de ${asked} preguntas bien y ${plural(score, "punto", "puntos")}!`});
    }, 900);
  }
  /* escribir el número: 2-9 abren al momento; 1 espera un poco por si viene 10, 11 o 12 */
  function typed(d){
    clearTimeout(bufT);
    buf += d;
    if(buf === "1"){ tt.textContent = "Caja 1…"; bufT = api.later(run, () => {
      const n = +buf, b = B[n - 1]; buf = "";
      if(b && !b.open) openBox(b); else if(!busy) tt.textContent = left === 1 ? "¡Queda una caja!" : `Quedan ${left} cajas.`;
    }, 700); return; }
    let n = +buf; buf = "";
    if(n > NB || n < 1){ if(d === "0" || d === "1") return; n = +d; }
    openBox(B[n - 1]);
  }
  grid.addEventListener("click", e => { const b = e.target.closest(".bx-b"); if(b && !b.disabled) openBox(B[+b.dataset.n - 1]); });
  api.intro(run, BOX, () => {
    started = true;
    api.keys(run, e => {
      if(e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if(busy){
        if(cur && cur.type === "q" && !cur.done && /^[1-3]$/.test(k)){ e.preventDefault(); choose(+k - 1); }
        else if(cur && cur.type === "q" && !cur.done && cur.as === "word" && k === " " && !(e.target.closest && e.target.closest("button"))){ e.preventDefault(); api.speak(cur.it.word); }
        else if(k === "Enter" && !(e.target.closest && e.target.closest("button"))){ e.preventDefault(); closePop(); }
        else if(/^Arrow/.test(k)) gridNav(e, [...pop.querySelectorAll(".bx-o")], cur && cur.as === "pic" ? 1 : 3);
        return;
      }
      if(/^[0-9]$/.test(k)){ e.preventDefault(); typed(k); return; }
      gridNav(e, btns, cols);
    });
  });
}

/* =====================================================================
   4. UNE CON FLECHAS — 3 rondas de 5 parejas dibujo ↔ palabra
   ===================================================================== */
async function flechas(app, api, mode){
  css();
  const P = await words(api, ARW, 5);
  if(!P) return;
  if(P.length < 5){ noWords(app, api); return; }
  const C = code(), R = 3, K = 5;
  /* las rondas: 15 palabras distintas si el tema tiene bastantes; si no, 5 distintas en cada ronda */
  const S0 = shuffle(P), rounds = P.length >= R * K ? [0, 1, 2].map(r => S0.slice(r * K, r * K + K)) : [0, 1, 2].map(() => shuffle(P).slice(0, K));
  const run = api.mount(app, `<div class="gm qz ar" id="ar">
    ${api.topHtml(ARW, `<span class="gm-pill" title="Ronda">${IC("squares-four", "bold", 18)}<b id="ar-rd">1/${R}</b></span><span class="gm-pill" title="Puntos">${IC("star", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`)}
    <div class="ar-main" id="ar-main">
      <p class="ar-tip" id="ar-tip">Une cada dibujo con su palabra.</p>
      <div class="ar-board" id="ar-board">
        <svg class="ar-svg" id="ar-svg" aria-hidden="true" focusable="false"></svg>
        <div class="ar-col ar-l" id="ar-l" role="group" aria-label="Dibujos"></div>
        <div class="ar-col ar-r" id="ar-r" role="group" aria-label="Palabras"></div></div>
      <div class="ar-acts"><button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="ar-chk" disabled>${IC("check", "bold", 20)}Comprobar</button></div>
      <p class="vh" id="ar-live" role="status" aria-live="polite"></p>
    </div></div>`, mode);
  const root = run.root, main = root.querySelector("#ar-main"), board = root.querySelector("#ar-board"), svg = root.querySelector("#ar-svg");
  const colL = root.querySelector("#ar-l"), colR = root.querySelector("#ar-r"), chk = root.querySelector("#ar-chk"), tip = root.querySelector("#ar-tip");
  const sc = root.querySelector("#gm-sc"), rdEl = root.querySelector("#ar-rd"), liveEl = root.querySelector("#ar-live");
  let ri = -1, items = [], links = new Map(), good = new Set(), bad = new Set(), shown = new Set(), tries = 0, sel = null, busy = true, started = false;
  let first = 0, second = 0, score = 0, D = null;
  const seen = tracker();
  const say = txt => { liveEl.textContent = ""; setTimeout(() => { if(liveEl.isConnected) liveEl.textContent = txt; }, 40); };
  const tile = (side, i) => (side === "p" ? colL : colR).querySelector(`.ar-t[data-i="${i}"]`);
  const locked = (side, i) => good.has(i);   /* una pareja buena (el dibujo i con la palabra i) ya no se toca */

  /* las fichas: cuadradas a la izquierda (dibujos), del mismo alto a la derecha (palabras) */
  function layout(){
    const H = board.clientHeight, W = board.clientWidth;
    if(!H || !W) return;
    const h = Math.floor((H - 8 * (K - 1)) / K);
    const ts = Math.max(64, Math.min(h, 150, Math.round(W * .36)));
    board.style.setProperty("--ts", ts + "px");
    const ww = colR.clientWidth || W * .4;
    colR.querySelectorAll(".ar-wt").forEach(el => {
      const n = [...el.textContent].length, f = n <= 6 ? 1.35 : n <= 9 ? 1.2 : n <= 13 ? 1.06 : .95;
      el.style.setProperty("--wf", (ww < 150 ? f * .92 : f).toFixed(2) + "rem");
    });
    draw();
  }
  filler(api, run, main, 460, 860, layout);

  function anchor(side, i){
    const t = tile(side, i), r = t.getBoundingClientRect(), b = board.getBoundingClientRect();
    return {x: (side === "p" ? r.right : r.left) - b.left, y: r.top + r.height / 2 - b.top};
  }
  const ln = (a, b, cls) => `<line class="ln ${cls}" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`;
  function draw(tmp){
    if(!items.length) return;
    let h = "";
    for(const [p, w] of links){
      const a = anchor("p", p), b = anchor("w", w);
      const cls = good.has(p) && p === w ? "good" : bad.has(p) ? "bad" : "";
      h += ln(a, b, cls);
      if(cls === "bad"){ const mx = a.x + (b.x - a.x) * .32, my = a.y + (b.y - a.y) * .32;   /* cerca del dibujo: dos líneas cruzadas no juntan sus ✗ */ h += `<g class="bx-x"><circle cx="${mx}" cy="${my}" r="12"/><path d="M${mx - 4.5} ${my - 4.5} l9 9 M${mx + 4.5} ${my - 4.5} l-9 9"/></g>`; }
    }
    for(const p of shown) h += ln(anchor("p", p), anchor("w", p), "show");
    if(tmp) h += ln(tmp.a, tmp.b, "tmp");
    svg.innerHTML = h;
  }
  function paint(){
    const linkedW = new Set(links.values());
    colL.querySelectorAll(".ar-t").forEach(t => {
      const i = +t.dataset.i;
      t.classList.toggle("on", links.has(i)); t.classList.toggle("sel", !!sel && sel.side === "p" && sel.i === i);
      t.classList.toggle("good", good.has(i)); t.classList.toggle("bad", bad.has(i));
      t.classList.toggle("ok", good.has(i)); t.classList.toggle("no", bad.has(i));
      t.classList.toggle("lock", good.has(i));
    });
    colR.querySelectorAll(".ar-t").forEach(t => {
      const i = +t.dataset.i, by = [...links].find(([, w]) => w === i);
      t.classList.toggle("on", linkedW.has(i)); t.classList.toggle("sel", !!sel && sel.side === "w" && sel.i === i);
      t.classList.toggle("good", good.has(i)); t.classList.toggle("bad", !!by && bad.has(by[0]));
      t.classList.toggle("lock", good.has(i));
    });
    chk.disabled = busy || links.size < K;
    draw();
  }
  function round(){
    ri++;
    items = rounds[ri]; links = new Map(); good = new Set(); bad = new Set(); shown = new Set(); tries = 0; sel = null; busy = false;
    rdEl.textContent = `${ri + 1}/${R}`;
    tip.textContent = "Une cada dibujo con su palabra.";
    const order = shuffle(items.map((_, i) => i));
    colL.innerHTML = items.map((it, i) => `<button type="button" class="ar-t ar-p" data-i="${i}" aria-label="Dibujo ${i + 1}: ${esc(it.es)}">${imgHtml(it)}<span class="ar-dot"></span>${MK}</button>`).join("");
    colR.innerHTML = order.map(i => `<button type="button" class="ar-t ar-w" data-i="${i}" lang="${esc(C)}"><span class="ar-wt">${esc(items[i].word)}</span>${ipa(items[i])}<span class="ar-dot"></span></button>`).join("");
    const nx = rounds[ri + 1]; if(nx) preload(nx);
    layout(); paint();
    if(api.kbd()) focusEl(colL.querySelector(".ar-t"));
  }
  function tap(side, i){
    if(!started || busy || run.paused || locked(side, i)) return;
    if(!sel || sel.side === side){
      sel = sel && sel.side === side && sel.i === i ? null : {side, i};
      if(sel && side === "w") api.speak(items[i].word);
      api.haptic("selection"); paint();
      return;
    }
    const p = side === "p" ? i : sel.i, w = side === "w" ? i : sel.i;
    sel = null;
    link(p, w);
  }
  function link(p, w){
    if(locked("p", p) || locked("w", w)) return;
    for(const [a, b] of [...links]) if(a === p || b === w) links.delete(a);
    links.set(p, w);
    bad.delete(p);
    api.speak(items[w].word); api.haptic("selection"); api.snd("pop");
    say(`Dibujo ${p + 1} con ${items[w].word}`);
    paint();
    if(links.size === K && api.kbd()) focusEl(chk);
  }
  function check(){
    if(!started || busy || links.size < K || run.paused) return;
    busy = true; tries++;
    const wrong = [];
    for(const [p, w] of links){
      if(good.has(p)) continue;
      if(p === w){
        good.add(p);
        if(tries === 1) first++; else second++;
        seen.add(items[p], tries > 1);
        api.answer(true, items[p]);
      } else { wrong.push(p); bad.add(p); api.answer(false, items[p]); }
    }
    score = first * 2 + second; sc.textContent = score; api.bump(sc.parentNode);
    sel = null; paint();
    if(!wrong.length){
      api.snd("ok"); api.haptic("success");
      sparks(board, 14);
      tip.textContent = tries === 1 ? "¡Todas bien a la primera!" : "¡Ahora sí, todas bien!";
      say(tip.textContent);
      api.later(run, nextRound, 2000);
    } else if(tries === 1){
      api.snd("tap");
      tip.textContent = wrong.length === 1 ? "Una línea gris no va ahí. ¡Arréglala!" : `${wrong.length} líneas grises no van ahí. ¡Arréglalas!`;
      say(tip.textContent);
      api.later(run, () => {
        wrong.forEach(p => { links.delete(p); bad.delete(p); });
        busy = false; paint();
        if(api.kbd()) focusEl(colL.querySelector(".ar-t:not(.lock)"));
      }, 1500);
    } else {
      api.snd("tap");
      wrong.forEach(p => seen.add(items[p], true));
      tip.textContent = "Las grises no iban ahí. Así eran:";
      say(`${tip.textContent} ${wrong.map(p => `${items[p].es}, ${items[p].word}`).join("; ")}`);
      api.later(run, () => {
        wrong.forEach(p => { links.delete(p); shown.add(p); const t = tile("w", p); if(t) t.classList.add("good"); });
        paint();
        wrong.forEach(p => { const t = tile("w", p); if(t) t.classList.add("good"); });
        api.later(run, nextRound, 2500);   /* encadenado: con la pausa en medio, la corrección se ve igual */
      }, 1300);
    }
  }
  function nextRound(){
    if(!api.live(run)) return;
    if(ri + 1 < R){ round(); return; }
    started = false;
    const stars = first >= 13 ? 3 : first >= 9 ? 2 : 1;
    api.finish(run, ARW, {score, stars, words: seen.list(),
      line: `¡${first} de ${R * K} a la primera${second ? ` y ${second} a la segunda` : ""}: ${plural(score, "punto", "puntos")}!`});
  }
  /* arrastrar una línea (de un dibujo a una palabra o al revés) o tocar uno y luego el otro */
  const tileAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest(".ar-t") : null; };
  const sideOf = t => t.classList.contains("ar-p") ? "p" : "w";
  board.addEventListener("pointerdown", e => {
    const t = e.target.closest(".ar-t");
    if(!t || !started || busy || run.paused || e.button > 0 || D) return;
    const side = sideOf(t), i = +t.dataset.i;
    if(locked(side, i)) return;
    e.preventDefault();
    try{ t.setPointerCapture(e.pointerId); }catch(err){}
    D = {t, side, i, id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, over: null};
  });
  board.addEventListener("pointermove", e => {
    if(!D || e.pointerId !== D.id) return;
    if(!D.on){
      if(Math.hypot(e.clientX - D.x0, e.clientY - D.y0) < 9) return;
      D.on = true; sel = {side: D.side, i: D.i}; paint(); api.haptic("selection");
      if(D.side === "w") api.speak(items[D.i].word);
    }
    const b = board.getBoundingClientRect(), o = tileAt(e.clientX, e.clientY);
    const ok = o && board.contains(o) && sideOf(o) !== D.side && !locked(sideOf(o), +o.dataset.i) ? o : null;
    if(D.over !== ok){ if(D.over) D.over.classList.remove("over"); D.over = ok; if(ok) ok.classList.add("over"); }
    draw({a: anchor(D.side, D.i), b: {x: e.clientX - b.left, y: e.clientY - b.top}});
  });
  const up = e => {
    if(!D || e.pointerId !== D.id) return;
    const d = D; D = null;
    if(d.over) d.over.classList.remove("over");
    if(e.type !== "pointerup"){ sel = null; paint(); return; }
    if(!d.on){ tap(d.side, d.i); return; }
    sel = null;
    if(d.over){ const j = +d.over.dataset.i; if(d.side === "p") link(d.i, j); else link(j, d.i); }
    else {
      /* soltar fuera: si la ficha estaba unida, se suelta su línea */
      if(d.side === "p" && links.has(d.i)) links.delete(d.i);
      else if(d.side === "w") for(const [a, w] of [...links]) if(w === d.i) links.delete(a);
      paint();
    }
  };
  board.addEventListener("pointerup", up);
  board.addEventListener("pointercancel", up);
  board.addEventListener("lostpointercapture", e => { if(D && e.pointerId === D.id) up({pointerId: e.pointerId, type: "pointercancel"}); });
  /* con el teclado (Enter o Espacio en una ficha) el navegador hace click sin puntero */
  board.addEventListener("click", e => { if(e.detail !== 0) return; const t = e.target.closest(".ar-t"); if(t) tap(sideOf(t), +t.dataset.i); });
  chk.onclick = check;
  api.intro(run, ARW, () => {
    started = true;
    round();
    api.keys(run, e => {
      if(e.ctrlKey || e.metaKey || e.altKey) return;
      const a = document.activeElement, t = a && a.closest && a.closest(".ar-t");
      if(e.key === "Enter" && !(a && a.closest && a.closest("button"))){ if(!chk.disabled){ e.preventDefault(); check(); } return; }
      if(!/^Arrow/.test(e.key)) return;
      e.preventDefault();
      if(!t){ focusEl(colL.querySelector(".ar-t")); return; }
      const side = sideOf(t), list = [...(side === "p" ? colL : colR).querySelectorAll(".ar-t")], k = list.indexOf(t);
      if(e.key === "ArrowUp") focusEl(list[Math.max(0, k - 1)]);
      else if(e.key === "ArrowDown") focusEl(list[Math.min(list.length - 1, k + 1)]);
      else if(e.key === (side === "p" ? "ArrowRight" : "ArrowLeft")) focusEl([...(side === "p" ? colR : colL).querySelectorAll(".ar-t")][k]);
    });
  });
}

/* ---------- a Juegos ---------- */
const reg = (id, def) => window.vocabGames && typeof vocabGames.register === "function" && vocabGames.register(id, Object.assign({topic: true, fresh: true, sec: SEC}, def));
const pts = b => plural(num(b.score), "punto", "puntos");
if(!reg(QZ, {
  t: "Concurso", sub: "Preguntas con comodines", img: "img/games/concurso.png",
  how: "¡Un concurso de la tele! Son 10 preguntas con 4 respuestas. Si contestas rápido, ganas más puntos, y con una racha de aciertos, el doble o el triple. Tienes tres comodines, uno de cada: 50:50, +10 segundos y una pista. Toca la respuesta (o pulsa 1, 2, 3 o 4).",
  rec: pts, start: concurso,
})) console.warn("[quiz] no se pudo añadir «Concurso» a Juegos");
if(!reg(VF, {
  t: "Verdadero o falso", sub: "¿Es su palabra?", img: "img/games/verdadero.png",
  how: "Mira el dibujo y la palabra. ¿Es su palabra? Toca ✓ si es verdad y ✗ si no. También puedes deslizar la tarjeta: a la derecha es sí y a la izquierda, no (o usa las flechas ← →). ¡Tienes 60 segundos!",
  rec: b => `${num(b.score)} bien`, start: verdadero,
})) console.warn("[quiz] no se pudo añadir «Verdadero o falso» a Juegos");
if(!reg(BOX, {
  t: "Abre la caja", sub: "Sorpresas y preguntas", img: "img/games/cajas.png",
  how: "Hay 12 cajas de regalo. Toca una (o escribe su número) para abrirla. Casi todas traen una pregunta y algunas, una sorpresa: ¡Doble! o una estrella extra. ¡Ábrelas todas!",
  rec: pts, start: cajas,
})) console.warn("[quiz] no se pudo añadir «Abre la caja» a Juegos");
if(!reg(ARW, {
  t: "Une con flechas", sub: "Cada dibujo con su palabra", img: "img/games/flechas.png",
  how: "Une cada dibujo con su palabra: arrastra una línea de uno a otro, o toca el dibujo y luego la palabra. Después toca «Comprobar». Las líneas grises están mal: puedes arreglarlas una vez.",
  rec: pts, start: flechas,
})) console.warn("[quiz] no se pudo añadir «Une con flechas» a Juegos");
})();
