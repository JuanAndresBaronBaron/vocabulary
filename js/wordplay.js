/* módulo wordplay: tres juegos de palabras de Jugar › Juegos registrados con vocabGames.register (como js/party.js),
   los tres con las palabras del tema elegido (api.topicPool, como Topos) y sec "palabras".
   Rutas: #/juegos/adivina · #/juegos/sopa · #/juegos/crucigrama.
   Adivina la palabra (un ahorcado amable): salen el dibujo y la palabra en español; la palabra en el idioma está
     escondida en cajitas (el artículo se ve tal cual; espacios, guiones y apóstrofos también). Teclado de letras en
     pantalla (en danés con Æ Ø Å; en francés sin tildes: la E destapa é è ê) y el teclado de verdad. En lugar del
     ahorcado, una cesta de globo aerostático con el dibujo, sujeta por 6 globos: cada letra que no está pincha uno (se
     queda gris con ✗) y la cesta baja un poco; sin globos, la cesta aterriza despacio en la hierba y se ve la palabra.
     Al destaparla (o al aterrizar) suena con su IPA. 8 palabras, de la más corta a la más larga. Estrellas por
     palabras adivinadas: 7 u 8 ★★★, 5 o 6 ★★, si no ★.
   Sopa de letras: una rejilla de 8 × 8 en el celular y de 10 × 10 en el ordenador con 6 palabras del tema (solo
     letras, sin artículo, de 3 a 8; en mayúsculas y sin tildes, Æ Ø Å sí), de izquierda a derecha y de arriba abajo
     (en el ordenador también en diagonal). Debajo (al lado en el ordenador), la lista con el dibujo de cada palabra
     (tocar = oírla). Se marca arrastrando sobre las letras o tocando la primera y la última (o con las flechas y
     Enter). Encontrada: una banda de color, suena con su IPA y se tacha en la lista. Mal: la banda en gris con ✗ un
     momento, sin sonido triste. Pista sola: 40 s sin encontrar nada → brilla la primera letra de una que falta (y si
     sigue sin salir, también la última). Estrellas por tiempo y pistas (cada pista cuenta 30 s).
   Crucigrama: de 5 a 7 palabras del tema (solo letras, hasta 9) cruzadas de verdad: se prueban muchas colocaciones y
     se queda la más pequeña; las que no caben se quedan fuera. Pistas numeradas con el dibujo y la palabra en español.
     Se toca una casilla o una pista para elegir palabra (otra vez la misma casilla = la otra dirección) y se escribe
     con el teclado en pantalla o el de verdad (flechas, Borrar, Enter = siguiente palabra). Palabra bien → turquesa,
     suena con su IPA; mal → las letras equivocadas en gris con ✗ un momento y se borran. «Pista» pone una letra
     (cuenta en las estrellas). En 360 px las casillas miden ≥ 30 px; si no cabe de alto, la rejilla se desplaza hacia
     abajo (nunca de lado).
   Los tres usan de games.js lo de los demás juegos: tarjeta del menú, récord, explicación la primera vez, «?», pausa
     (el reloj y lo que tocaba hacer se paran) y finish() (récord en "games:best".<juego>, monedas con award desde «+N»).
   Para las pruebas: #wp-ad.wpAd = {word, keys} (las letras que faltan), #wp-sp.wpWords = [{s, cells}],
     #wp-cw.wpWords = [{n, dir, r, c, sol}], window.__wpHint = segundos hasta la pista de la sopa, window.__wpPrefer =
     un texto: en Adivina, la primera palabra lo lleva (p. ej. "é"). */
(() => {
"use strict";

const AD = "adivina", SP = "sopa", CW = "crucigrama";
const IC = (n, s = "bold", z = 22, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
const RM = () => { try{ return !!(window.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const pic = src => (window.vocabGames && typeof vocabGames.pic === "function") ? vocabGames.pic(src) : src;
const num = v => Number.isFinite(+v) ? +v : 0;
const pick = a => a[Math.floor(Math.random() * a.length)];
const mix = a => { const b = [...a]; for(let i = b.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const codeOf = () => (LANGS[lang] || {}).code || "";
const ipaOf = it => typeof ipaHtml === "function" && it && it.ipa ? ipaHtml(it.ipa, codeOf()) : "";
const sparks = (el, n = 12) => { try{ if(el && el.isConnected && window.M && typeof M.burst === "function" && !RM()) M.burst(el, {n}); }catch(e){} };
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
/* el dibujo de una palabra (los árboles de familia recortados, como en los demás juegos; si no cargan, el de siempre) */
function imgHtml(it){
  if(!it || !it.img) return "";
  const s = pic(it.img);
  return `<img src="${esc(s)}" alt="" draggable="false"${s !== it.img ? ` data-f="${esc(it.img)}" onerror="if(this.dataset.f){this.src=this.dataset.f;delete this.dataset.f}"` : ""}>`;
}
const preload = items => items.forEach(x => { if(x && x.img){ const im = new Image(); im.src = pic(x.img); } });

/* ---------- palabras ---------- */
const ARTS = {
  english: /^(?:the|an?|to)\s+/i,
  "français": /^(?:les|le|la|une|un|des|du|se)\s+|^(?:l|s|d)['’]/i,
  dansk: /^(?:en|et|at)\s+/i,
};
function splitArt(w){
  const s = String(w || "").normalize("NFC"), m = s.match(ARTS[lang] || /^$/);
  return m && m[0] ? {art: m[0], base: s.slice(m[0].length)} : {art: "", base: s};
}
const isL = ch => /\p{L}/u.test(ch);
/* las letras del teclado: el abecedario y, en danés, Æ Ø Å */
const ABC = () => "abcdefghijklmnopqrstuvwxyz" + (lang === "dansk" ? "æøå" : "");
/* una letra como la del teclado: sin tildes (en francés É = E, Ç = C); en danés Æ Ø Å son letras propias */
function key1(ch){
  let s = String(ch).toLowerCase();
  const da = lang === "dansk";
  if(da) s = s.replace(/å/g, "\u0001");
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  if(da) s = s.replace(/\u0001/g, "å");
  else s = s.replace(/æ/g, "a").replace(/ø/g, "o");
  return s.replace(/œ/g, "o").replace(/ß/g, "s");
}
/* una palabra para las rejillas (sopa y crucigrama): letras en mayúsculas sin tildes (œ = OE), o null si no vale */
function gridOf(base, min, max){
  let s = String(base || "").normalize("NFC").toLowerCase().replace(/œ/g, "oe").replace(/ß/g, "ss");
  if(lang !== "dansk") s = s.replace(/æ/g, "ae");
  const g = [...s].map(key1), abc = ABC();
  if(g.length < min || g.length > max || !g.every(ch => ch.length === 1 && abc.includes(ch))) return null;
  return g.map(ch => ch.toUpperCase());
}
/* la pista en español no puede ser ya la respuesta (Portugal, radio, robot…) */
const fold = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const sameEs = it => fold(splitArt(it.word).base) === fold(it.es);
const okItem = it => !!(it && typeof it.word === "string" && it.word.trim() && typeof it.es === "string" && it.es.trim() && it.img);
/* las palabras del tema que caben en una rejilla, sin repetir */
function gridCands(P, min, max){
  const seen = new Set(), out = [];
  for(const it of P){
    if(!okItem(it)) continue;
    const base = splitArt(it.word).base, g = gridOf(base, min, max);
    if(!g) continue;
    const s = g.join("");
    if(seen.has(s)) continue;
    seen.add(s); out.push({it, base, g, s});
  }
  return out;
}

/* ---------- piezas comunes ---------- */
function kbHtml(extra = ""){
  return `<div class="wp-kb" id="wp-kb" role="group" aria-label="Teclado">${[...ABC()].map(l => `<button type="button" class="wp-key" data-l="${l}" aria-label="${l.toUpperCase()}">${l.toUpperCase()}</button>`).join("")}${extra}</div>`;
}
/* el tamaño de las teclas según el ancho: filas parejas (7 + 7 + 7 + 5 en el celular), teclas de 36 a 56 px */
function kbFit(kb){
  if(!kb || !kb.isConnected) return;
  const keys = [...kb.querySelectorAll(".wp-key")], W = kb.clientWidth, G = 5;
  if(!W || !keys.length) return;
  const n = keys.reduce((a, k) => a + (k.classList.contains("wp-del") ? 2 : 1), 0);
  const maxC = Math.max(5, Math.floor((W + G) / (36 + G)));
  const rows = Math.ceil(n / maxC), kc = Math.ceil(n / rows);
  kb.style.setProperty("--kw", Math.min(56, Math.floor((W - (kc - 1) * G) / kc)) + "px");
}
const LIVE = `<p class="vh gm-live" role="status" aria-live="polite" aria-atomic="true"></p>`;
function tellLive(run, txt){
  const el = run && run.root && run.root.querySelector(".gm-live"); if(!el) return;
  el.textContent = "";
  setTimeout(() => { if(el.isConnected) el.textContent = txt; }, 40);
}
/* el alto que queda desde el elemento hasta el final de la pantalla (sin el margen de abajo de la página) */
function availH(el){
  const main = el.closest("main"), pb = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 12;
  return innerHeight - (el.getBoundingClientRect().top + scrollY) - pb - 6;
}
const emptyHtml = api => `<div class="gm"><div class="gm-empty"><p>Este juego todavía no tiene palabras en ${esc(api.nm())}.</p>
  <a class="glass-btn" href="#/juegos">${IC("caret-left", "bold", 18)}Juegos</a></div></div>`;
/* el ancho del juego antes de montarlo (la tarjeta «Preparando el juego…» de games.js ya ocupa su sitio) */
const widthOf = app => { const g = app.querySelector(".gm"); return (g && g.clientWidth) || app.clientWidth || innerWidth; };
const isWide = () => matchMedia("(min-width: 700px)").matches;

const CSS = `
.wp{--wp-teal:#008198;max-width:820px}
:root:is([data-gm-play=adivina],[data-gm-play=sopa],[data-gm-play=crucigrama]) main{padding-bottom:calc(var(--safe-b) + 12px)}
.wp .gm-top{margin-bottom:8px}
/* el teclado de letras */
.wp-kb{--kw:40px;display:flex;flex-wrap:wrap;justify-content:center;gap:5px;width:100%;max-width:720px;margin:0 auto;user-select:none;-webkit-user-select:none}
.wp-key{position:relative;flex:none;width:var(--kw);height:var(--kh,46px);margin:0;padding:0;border:0;border-radius:11px;background:var(--card);color:var(--label);
  font:800 1.2rem/1 var(--f-round);box-shadow:inset 0 0 0 1.5px var(--sep),0 2px 0 var(--sep);cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.wp-key:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
@media (hover:hover){.wp-key:not(.ok):not(.no):hover{box-shadow:inset 0 0 0 2px var(--brand-tint),0 2px 0 var(--sep)}}
.wp-key:active{transform:translateY(1px)}
.wp-key.ok{background:var(--wp-teal);color:#fff;box-shadow:none}
.wp-key.no{background:var(--miss-fill);color:var(--miss-ink);box-shadow:none;cursor:default}
.wp-key.no::after{content:"✗";position:absolute;right:3px;top:2px;font:900 .62rem/1 system-ui;color:var(--miss-ink)}
.wp-key.wp-del{width:calc(var(--kw) * 2 + 5px)}
.wp-key .ico{vertical-align:middle}

/* ===== Adivina la palabra ===== */
.wp-ad-main{display:flex;flex-direction:column;gap:10px}
.wp-ad.wide .wp-ad-main{display:grid;grid-template-columns:minmax(280px,1fr) minmax(0,1.2fr);gap:20px;align-items:center}
.wp-ad-side{display:flex;flex-direction:column;gap:10px;min-width:0}
/* el cielo con la cesta y los globos */
.wp-sky{position:relative;height:300px;border-radius:22px;overflow:hidden;isolation:isolate;user-select:none;-webkit-user-select:none;
  background:linear-gradient(180deg,#8cc6f0 0%,#c4e3f8 62%,#e3f2fc 100%)}
[data-theme=dark] .wp-sky{background:linear-gradient(180deg,#0b2545 0%,#15375c 70%,#1d4a70 100%)}
.wp-cloud{position:absolute;width:84px;height:26px;border-radius:999px;background:#fff;opacity:.9}
.wp-cloud::before,.wp-cloud::after{content:"";position:absolute;background:inherit;border-radius:50%}
.wp-cloud::before{width:38px;height:38px;left:12px;top:-18px}
.wp-cloud::after{width:28px;height:28px;left:44px;top:-11px}
.wp-cloud.c1{left:5%;top:14%}
.wp-cloud.c2{right:4%;top:44%;transform:scale(.8)}
[data-theme=dark] .wp-cloud{opacity:.16}
.wp-grass{position:absolute;left:0;right:0;bottom:0;height:var(--gh,40px);background:linear-gradient(180deg,#6cb85d,#4e9a45);border-top:3px solid #3f7f39}
[data-theme=dark] .wp-grass{background:linear-gradient(180deg,#2f6a37,#235229);border-top-color:#1b4220}
.wp-shadow{position:absolute;left:50%;bottom:calc(var(--gh,40px) * .32);width:var(--sw,120px);height:14px;margin-left:calc(var(--sw,120px) / -2);border-radius:50%;
  background:rgba(0,0,0,.3);transform:scale(var(--ss,.55));opacity:var(--so,.12);transition:transform .7s,opacity .7s}
.wp-rig{position:absolute;left:50%;top:0;z-index:2;width:var(--rw,200px);aspect-ratio:200/266;transform:translate(-50%,var(--ry,6px));
  transition:transform .7s cubic-bezier(.3,.7,.4,1)}
.wp-rig.land{transition:transform 1.25s cubic-bezier(.22,.75,.3,1)}
.wp-rig-in{position:absolute;inset:0;animation:wp-bob 3.4s ease-in-out infinite;transform-origin:50% 100%}
.wp-rig.land .wp-rig-in{animation:wp-thud .55s 1.1s ease-out both}
.wp-rig.won .wp-rig-in{animation:wp-hop .7s ease-out 2}
@keyframes wp-bob{50%{transform:translateY(-5px)}}
@keyframes wp-thud{0%{transform:none}35%{transform:scale(1.05,.94)}70%{transform:scale(.98,1.02)}100%{transform:none}}
@keyframes wp-hop{40%{transform:translateY(-14px)}}
.wp-rig svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.wp-card{position:absolute;left:25%;top:42.1%;width:50%;aspect-ratio:1;box-sizing:border-box;border-radius:14px;background:#fff;border:3px solid #1b1b1b;
  display:grid;place-items:center;overflow:hidden}
.wp-card img{width:88%;height:88%;object-fit:contain;mix-blend-mode:multiply}
.wp-bl .wp-bb{transform-box:fill-box;transform-origin:50% 100%}
.wp-bl .wp-bf{transition:fill .3s}
.wp-bl.pop .wp-bb{transform:scale(.42);animation:wp-pop .4s ease-out}
.wp-bl.pop .wp-bf{fill:#8E8E93}
.wp-bl.pop .wp-hl{opacity:0}
.wp-bl .wp-bx{opacity:0;transition:opacity .2s .25s}
.wp-bl.pop .wp-bx{opacity:1}
.wp-st.pop{stroke:#8E8E93;stroke-dasharray:3 3}
[data-theme=dark] .wp-st:not(.pop){stroke:#c9d3e0}
@keyframes wp-pop{0%{transform:scale(1)}35%{transform:scale(1.16)}100%{transform:scale(.42)}}
/* la palabra en español y las cajitas */
.wp-ad-es{display:flex;flex-direction:column;align-items:center;text-align:center}
.wp-ad-q{font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.wp-ad-es b{font:800 1.55rem/1.15 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.wp-word{--bs:40px;display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:10px 14px;min-height:calc(var(--bs) * 1.15)}
.wp-art{align-self:center;margin-right:6px;font:800 calc(var(--bs) * .6)/1 var(--f-round);color:var(--label2)}
.wp-tok{display:inline-flex;gap:4px;align-items:flex-end}
.wp-box{display:grid;place-items:center;width:var(--bs);height:calc(var(--bs) * 1.15);box-sizing:border-box;border-radius:8px 8px 3px 3px;background:var(--fill);
  border-bottom:4px solid var(--label2);font:900 calc(var(--bs) * .64)/1 var(--f-round);color:var(--label)}
.wp-box.on{border-bottom-color:var(--wp-teal);animation:wp-in .3s}
.wp-box.gave{color:var(--miss-ink);border-bottom-color:var(--miss);background:var(--miss-fill)}
.wp-ad.won .wp-box{animation:wp-hop2 .5s calc(var(--i) * 60ms) both}
.wp-sym{font:900 calc(var(--bs) * .64)/1 var(--f-round);color:var(--label);padding-bottom:6px}
@keyframes wp-in{from{transform:scale(.4);opacity:0}}
@keyframes wp-hop2{40%{transform:translateY(-10px)}}
/* abajo: el teclado o, al acabar la palabra, cómo era */
.wp-low{position:relative;min-height:176px;display:flex;align-items:center}
.wp-low.done .wp-kb{visibility:hidden}
.wp-res{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:8px;border-radius:18px;
  background:var(--card);text-align:center;animation:gm-in .3s both}
.wp-res-h{font:800 1.1rem/1.2 var(--f-round);color:var(--label2)}
.wp-res.ok .wp-res-h{color:var(--ok-ink)}
.wp-res-w{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:center;gap:2px 10px;font:800 1.6rem/1.2 var(--f-round);color:var(--label)}
.wp-res-w .ipa{font:500 1.05rem/1.2 var(--f-text);color:var(--label2)}
.wp-res-es{font:600 1rem/1.25 var(--f-text);color:var(--label2)}
.wp-res-b{display:flex;gap:12px;align-items:center;margin-top:4px}
.wp-res .gm-say{width:48px;height:48px}

/* ===== Sopa de letras ===== */
.wp-sp-main{display:flex;flex-direction:column;align-items:center;gap:10px}
.wp-sp.wide .wp-sp-main{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:20px}
.wp-board{--cs:40px;position:relative;flex:none;width:320px;height:320px;border-radius:18px;background:var(--card);box-shadow:0 1px 3px rgba(0,0,0,.08);
  touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.wp-bands,.wp-cells{position:absolute;inset:4px;width:calc(100% - 8px);height:calc(100% - 8px)}
.wp-bands{pointer-events:none;overflow:visible}
.wp-band{stroke-linecap:round;stroke-width:.78;stroke-opacity:.34}
[data-theme=dark] .wp-band{stroke-opacity:.5}
.wp-selb{stroke:var(--brand-tint);stroke-linecap:round;stroke-width:.78;stroke-opacity:.3;fill:none}
.wp-selb.no{stroke:#8E8E93;stroke-opacity:.5}
.wp-cells{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));grid-template-rows:repeat(var(--n),minmax(0,1fr))}
.wp-c{position:relative;display:grid;place-items:center;margin:0;padding:0;border:0;border-radius:50%;background:none;color:var(--label);
  font:800 calc(var(--cs) * .52)/1 var(--f-round);cursor:pointer;touch-action:none;-webkit-tap-highlight-color:transparent}
.wp-c:focus-visible{outline:3px solid var(--brand-tint);outline-offset:-3px}
.wp-c.start{box-shadow:inset 0 0 0 3px var(--brand-tint)}
.wp-c.hint{background:var(--gold-soft);box-shadow:inset 0 0 0 3px var(--gold-deep);animation:wp-pulse 1.1s ease-in-out infinite}
@keyframes wp-pulse{50%{transform:scale(1.2)}}
.wp-board .gm-float{z-index:5}
.wp-sp-side{display:flex;flex-direction:column;gap:8px;width:100%;min-width:0}
.wp-sp-st{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:center;gap:2px 8px;min-height:2.6em;margin:0;text-align:center;
  font:700 1.05rem/1.3 var(--f-round);color:var(--label2)}
.wp-sp-st.ok{color:var(--ok-ink)}
.wp-sp-st b{color:var(--label);font-size:1.15em}
.wp-sp-st .ipa{font:500 .95rem/1.2 var(--f-text);color:var(--label2)}
.wp-sp-st small{font:600 .95rem/1.2 var(--f-text);color:var(--label2)}
.wp-sp-st.hint{color:var(--gold-ink)}
.wp-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.wp-sp.wide .wp-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.wp-li{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;margin:0;padding:6px 4px 8px;border:0;border-radius:14px;
  background:var(--card);color:var(--label);font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.wp-li:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.wp-li-p{display:grid;place-items:center;width:var(--lp,58px);height:var(--lp,58px);border-radius:12px;background:var(--gm-tile,#fff);overflow:hidden}
.wp-sp.wide .wp-li-p{width:76px;height:76px}
.wp-li-p img{width:90%;height:90%;object-fit:contain;mix-blend-mode:multiply}
.wp-li-w{max-width:100%;font:800 1rem/1.15 var(--f-round);text-align:center;overflow-wrap:anywhere}
.wp-li.done{background:color-mix(in srgb,var(--wp-teal) 14%,var(--card))}
.wp-li.done .wp-li-w{color:var(--label2);text-decoration:line-through;text-decoration-thickness:2px}
.wp-li-ok{position:absolute;right:5px;top:5px;display:none;width:22px;height:22px;border-radius:50%;background:var(--wp-teal);color:#fff;place-items:center}
.wp-li.done .wp-li-ok{display:grid}

/* ===== Crucigrama ===== */
.wp-cw-main{display:flex;flex-direction:column;gap:8px}
.wp-cw.wide .wp-cw-main{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,270px);grid-template-areas:"b c" "q c" "k c";grid-template-rows:auto auto 1fr;
  column-gap:20px;row-gap:10px;align-items:start}
.wp-cw.wide .wp-cw-board{grid-area:b}
.wp-cw.wide .wp-clues{grid-area:c}
.wp-cw.wide .wp-cbar{grid-area:q}
.wp-cw.wide .wp-kb{grid-area:k}
.wp-cw-board{--cs:32px;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;border-radius:12px;padding:2px 0}
.wp-cw-grid{display:grid;grid-template-columns:repeat(var(--cols),var(--cs));grid-auto-rows:var(--cs);width:max-content;margin:0 auto;padding:1px}
.wp-cc{position:relative;display:grid;place-items:center;margin:0;padding:0;border:0;border-radius:0;background:#fff;color:#111;outline:2px solid #1b1b1b;outline-offset:-1px;
  font:900 calc(var(--cs) * .56)/1 var(--f-round);cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.wp-cc small{position:absolute;left:2px;top:1px;font:800 max(9px,calc(var(--cs) * .27))/1 var(--f-text);color:#3a3a3c}
.wp-cc:focus-visible{box-shadow:inset 0 0 0 3px var(--brand-tint)}
.wp-cc.sel{background:#d8e7ff}
.wp-cc.cur{background:#a9cbff;box-shadow:inset 0 0 0 3px #1E6EF4}
.wp-cc.hint{background:#ffe7a0}
.wp-cc.ok{background:#008198;color:#fff}
.wp-cc.ok small{color:#dff7fb}
.wp-cc.ok.cur{box-shadow:inset 0 0 0 3px #0b2545}
.wp-cc.no{background:#d1d1d6;color:#55555a}
.wp-cc.no::after{content:"✗";position:absolute;right:2px;bottom:1px;font:900 max(9px,calc(var(--cs) * .28))/1 system-ui;color:#48484a}
.wp-cc.win{animation:wp-hop2 .5s calc(var(--i) * 50ms) both}
/* las pistas: en el celular, los dibujos numerados en una fila; en el ordenador, una lista con el español */
.wp-clues{display:flex;flex-wrap:wrap;justify-content:center;gap:7px;margin:0;padding:3px 0 0;list-style:none}
.wp-clue{position:relative;display:flex;align-items:center;gap:10px;margin:0;padding:0;border:0;border-radius:12px;background:var(--card);color:var(--label);
  font:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}
.wp-clue:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.wp-clue .n{position:absolute;left:-4px;top:-4px;z-index:1;min-width:19px;height:19px;padding:0 4px;box-sizing:border-box;border-radius:10px;background:#1b1b1b;color:#fff;
  font:800 .72rem/19px var(--f-text);text-align:center}
.wp-clue .cp{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:11px;background:#fff;overflow:hidden;box-shadow:inset 0 0 0 1.5px var(--sep)}
.wp-clue .cp img{width:88%;height:88%;object-fit:contain;mix-blend-mode:multiply}
.wp-clue .ct{display:none;min-width:0;flex:1}
.wp-clue .ce{display:block;font:700 1rem/1.2 var(--f-round);overflow-wrap:anywhere}
.wp-clue .cd{display:block;font:600 var(--fs-min)/1.2 var(--f-text);color:var(--label2)}
.wp-clue .ck{position:absolute;right:-4px;bottom:-4px;display:none;width:18px;height:18px;border-radius:50%;background:var(--wp-teal);color:#fff;place-items:center}
.wp-clue.on{box-shadow:0 0 0 3px var(--brand-tint)}
.wp-clue.done .cp{box-shadow:inset 0 0 0 3px var(--wp-teal)}
.wp-clue.done .ck{display:grid}
.wp-cw.wide .wp-clues{flex-direction:column;flex-wrap:nowrap;align-items:stretch;gap:8px}
.wp-cw.wide .wp-clue{padding:6px 10px 6px 6px}
.wp-cw.wide .wp-clue .n{position:static;flex:none}
.wp-cw.wide .wp-clue .cp{width:52px;height:52px}
.wp-cw.wide .wp-clue .ct{display:block}
.wp-cw.wide .wp-clue .ck{position:static;flex:none}
.wp-cw.wide .wp-clue.done .ce{color:var(--label2)}
/* la pista elegida, grande */
.wp-cbar{display:flex;align-items:center;gap:10px;padding:8px;border-radius:18px;background:var(--card)}
.wp-cbar-p{flex:none;display:grid;place-items:center;width:var(--bp,78px);height:var(--bp,78px);border-radius:14px;background:#fff;overflow:hidden;box-shadow:inset 0 0 0 2px var(--sep)}
.wp-cbar-p img{width:88%;height:88%;object-fit:contain;mix-blend-mode:multiply}
.wp-cbar-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.wp-cbar-n{font:700 var(--fs-min)/1.2 var(--f-text);color:var(--label2)}
.wp-cbar-t>b{font:800 1.3rem/1.15 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.wp-cbar-s{min-height:1.3em;font:700 .92rem/1.3 var(--f-round);color:var(--ok-ink);overflow-wrap:anywhere}
.wp-cbar-s .ipa{font:500 .9rem/1.2 var(--f-text);color:var(--label2)}
.wp-hint{flex:none;flex-direction:column;gap:2px;min-height:62px;padding:6px 10px}
.wp-cw .wp-kb{max-width:600px}
@media (prefers-reduced-motion:reduce){
  .wp-rig,.wp-rig.land,.wp-shadow{transition-duration:.01s}
  .wp-rig-in,.wp-rig.land .wp-rig-in,.wp-rig.won .wp-rig-in,.wp-bl.pop .wp-bb,.wp-box.on,.wp-ad.won .wp-box,.wp-cc.win{animation:none}
  .wp-c.hint{animation:none;transform:scale(1.08)}
}`;
function css(){
  if(document.getElementById("css-wordplay")) return;
  const s = document.createElement("style"); s.id = "css-wordplay"; s.textContent = CSS; document.head.appendChild(s);
}

/* =====================================================================
   1. ADIVINA LA PALABRA — la cesta del globo con el dibujo y 6 globos
   ===================================================================== */
const AD_N = 8, LIVES = 6;
/* los globos (sobrios: azul marino, azul, turquesa, verde, oro y madera): [x, y] del centro en el dibujo de 200 × 266;
   primero los de atrás. Se pinchan de fuera hacia dentro */
const BCOL = ["#22409a", "#1E6EF4", "#008198", "#2f9e44", "#e0a614", "#b8743c"];
const BPOS = [[62, 36], [100, 28], [138, 36], [42, 80], [100, 74], [158, 80]];
const POP = [5, 3, 2, 0, 4, 1];
const BALLOON = "M0,-31 C17,-31 26,-18 26,-4 C26,12 12,25 0,29 C-12,25 -26,12 -26,-4 C-26,-18 -17,-31 0,-31Z";
function rigBack(){
  const strings = BPOS.map(([x, y], i) => {
    const tx = x < 100 || (x === 100 && i === 4) ? 30 : 170, ky = y + 33;
    return `<path class="wp-st" data-s="${i}" d="M${x},${ky} Q${(x + tx) / 2},${(ky + 210) / 2 + 6} ${tx},210" fill="none" stroke="#1b1b1b" stroke-width="2"/>`;
  }).join("");
  const balloons = BPOS.map(([x, y], i) => `<g class="wp-bl" data-b="${i}" transform="translate(${x},${y})">
    <g class="wp-bb"><path class="wp-bf" d="${BALLOON}" fill="${BCOL[i]}" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
      <ellipse class="wp-hl" cx="-9" cy="-14" rx="5" ry="8.5" fill="#fff" opacity=".5"/>
      <path d="M-5,33 L5,33 L0,28Z" fill="${BCOL[i]}" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/></g>
    <g class="wp-bx"><circle cx="0" cy="14" r="8.5" fill="#6C6C70" stroke="#fff" stroke-width="2"/><path d="M-3.4,10.6 L3.4,17.4 M3.4,10.6 L-3.4,17.4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></g></g>`).join("");
  return `<svg class="wp-rig-b" viewBox="0 0 200 266" aria-hidden="true" focusable="false">${strings}${balloons}</svg>`;
}
const RIG_FRONT = `<svg class="wp-rig-f" viewBox="0 0 200 266" aria-hidden="true" focusable="false">
  <path d="M30,221 L170,221 L159,262 Q158,265 154,265 L46,265 Q42,265 41,262Z" fill="#c08a52" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M35,235 H165 M38,249 H162 M70,222 L74,264 M100,222 V264 M130,222 L126,264" stroke="#8a5a33" stroke-width="2.5" fill="none"/>
  <rect x="22" y="208" width="156" height="15" rx="6" fill="#8a5a33" stroke="#000" stroke-width="3.5"/>
  <path d="M30,203 V212 M170,203 V212" stroke="#1b1b1b" stroke-width="3" stroke-linecap="round"/></svg>`;

const adFit = it => {
  if(!okItem(it) || sameEs(it)) return false;
  const {base} = splitArt(it.word), ch = [...base], abc = ABC();
  const hid = ch.filter(c => isL(c) && abc.includes(key1(c)));
  if(hid.length < 3 || ch.length > 16 || !ch.every(c => !isL(c) || abc.includes(key1(c)))) return false;
  return base.split(/[\s-]+/).every(t => [...t].length <= 11);
};
const hidN = it => [...splitArt(it.word).base].filter(isL).length;
/* los trozos de la palabra que no se parten: se corta en los espacios y después de los guiones */
function toksOf(chars){
  const out = [[]];
  chars.forEach((c, j) => {
    if(c.ch === " "){ out.push([]); return; }
    out[out.length - 1].push(j);
    if(c.ch === "-") out.push([]);
  });
  return out.filter(t => t.length);
}

async function adivina(app, api, mode){
  const my = api.nav();
  css();
  const L = lang;
  let TP = {P: []};
  try{ TP = await api.topicPool(AD, AD_N, adFit); }catch(e){}
  if(!api.here(my, AD) || lang !== L) return;
  /* 8 palabras, de la más corta a la más larga */
  let list = mix(TP.P).slice(0, AD_N).sort((a, b) => hidN(a) - hidN(b));
  /* window.__wpPrefer (solo las pruebas): la primera, una palabra que lleve ese texto */
  const pre = typeof window.__wpPrefer === "string" && window.__wpPrefer ? TP.P.find(it => it.word.includes(window.__wpPrefer)) : null;
  if(pre) list = [pre, ...list.filter(x => x !== pre)].slice(0, AD_N);
  if(list.length < 3){ app.innerHTML = emptyHtml(api); return; }
  const N = list.length, code = codeOf();
  preload(list.slice(0, 2));
  const run = api.mount(app, `<div class="gm wp wp-ad" id="wp-ad">
    ${api.topHtml(AD, `<span class="gm-pill" title="Palabra">${IC("text-aa", "bold", 18)}<span><b id="wp-wn">1</b>/${N}</span></span><span class="gm-pill" title="Adivinadas">${IC("star", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`)}
    <div class="wp-ad-main" id="wp-main">
      <div class="wp-sky" id="wp-sky"><span class="wp-cloud c1"></span><span class="wp-cloud c2"></span><div class="wp-grass"></div><span class="wp-shadow"></span>
        <div class="wp-rig" id="wp-rig"><div class="wp-rig-in">${rigBack()}<div class="wp-card" id="wp-card"></div>${RIG_FRONT}</div></div></div>
      <div class="wp-ad-side" id="wp-side">
        <div class="wp-ad-es"><span class="wp-ad-q">¿Cómo se dice en ${esc(api.nm())}?</span><b id="wp-es"></b></div>
        <div class="wp-word" id="wp-word" lang="${esc(code)}" aria-label=""></div>
        <div class="wp-low" id="wp-low">${kbHtml()}</div>
      </div></div>${LIVE}</div>`, mode);
  const root = run.root, sky = root.querySelector("#wp-sky"), rig = root.querySelector("#wp-rig"), card = root.querySelector("#wp-card");
  const side = root.querySelector("#wp-side"), main = root.querySelector("#wp-main"), wordEl = root.querySelector("#wp-word");
  const low = root.querySelector("#wp-low"), kb = root.querySelector("#wp-kb"), esEl = root.querySelector("#wp-es"), sc = root.querySelector("#gm-sc");
  const bls = [...root.querySelectorAll(".wp-bl")], sts = [...root.querySelectorAll(".wp-st")];
  let w = 0, got = 0, S = null, started = false, Y = {y0: 6, y1: 100};
  const res = [];

  /* el sitio de la cesta: baja un poco con cada globo pinchado y aterriza con el último */
  function place(){
    const k = S ? S.miss : 0, y = k >= LIVES ? Y.y1 : Y.y0 + (Y.y1 - Y.y0) * .75 * k / (LIVES - 1), p = k / LIVES;
    rig.style.setProperty("--ry", Math.round(y) + "px");
    sky.style.setProperty("--ss", (.55 + .45 * p).toFixed(2));
    sky.style.setProperty("--so", (.12 + .2 * p).toFixed(2));
  }
  function wordFit(){
    const W = wordEl.clientWidth; if(!W || !S) return;
    const toks = toksOf(S.chars).map(t => t.length);
    if(S.art.trim()) toks[0] += Math.ceil([...S.art.trim()].length * .6) + 1;
    const n = Math.max(...toks), wide = root.classList.contains("wide");
    wordEl.style.setProperty("--bs", Math.max(18, Math.min(wide ? 48 : 42, Math.floor((W - (n - 1) * 4) / n))) + "px");
  }
  /* el cielo llena lo que queda de pantalla (en el ordenador, a la izquierda del teclado) */
  function fit(){
    if(!api.live(run)) return;
    const wide = root.clientWidth >= 700;
    root.classList.toggle("wide", wide);
    kbFit(kb); wordFit();
    const av = availH(main);
    const H = Math.round(wide ? Math.max(300, Math.min(560, av)) : Math.max(210, Math.min(430, av - side.offsetHeight - 10)));
    sky.style.height = H + "px";
    const SW = sky.clientWidth, gh = Math.round(H * .12);
    let rh = (H - gh) * .8, rw = rh * 200 / 266;
    if(rw > SW * .78){ rw = SW * .78; rh = rw * 266 / 200; }
    rig.style.setProperty("--rw", Math.round(rw) + "px");
    sky.style.setProperty("--gh", gh + "px");
    sky.style.setProperty("--sw", Math.round(rw * .7) + "px");
    Y = {y0: Math.max(4, Math.round((H - gh - rh) * .12)), y1: Math.round(H - gh * .5 - rh)};
    place();
  }
  const onR = () => fit();
  addEventListener("resize", onR); run.clean.push(() => removeEventListener("resize", onR));

  function word(){
    const it = list[w], {art, base} = splitArt(it.word), abc = ABC();
    const chars = [...base].map(ch => { const k = key1(ch), hid = isL(ch) && abc.includes(k); return {ch, k, hid, on: !hid}; });
    S = {it, art, chars, used: new Set(), miss: 0, done: false};
    root.wpAd = {word: it.word, ipa: it.ipa || "", keys: [...new Set(chars.filter(c => c.hid).map(c => c.k))]};   /* para las pruebas */
    root.classList.remove("won");
    rig.classList.remove("land", "won");
    bls.forEach(b => b.classList.remove("pop")); sts.forEach(s => s.classList.remove("pop"));
    card.innerHTML = imgHtml(it);
    esEl.textContent = it.es;
    let i = 0;
    const toks = toksOf(chars).map(t => t.map(j => { const c = chars[j]; return c.hid ? `<span class="wp-box" data-i="${j}" style="--i:${i++}"></span>` : `<span class="wp-sym">${esc(c.ch)}</span>`; }).join(""));
    /* el artículo va pegado a la primera palabra (no se queda solo en una línea) */
    if(art.trim()) toks[0] = `<span class="wp-art">${esc(art.trim())}</span>` + toks[0];
    wordEl.innerHTML = toks.map(t => `<span class="wp-tok">${t}</span>`).join("");
    paintLabel();
    low.classList.remove("done");
    const old = low.querySelector(".wp-res"); if(old) old.remove();
    kb.querySelectorAll(".wp-key").forEach(k => { k.classList.remove("ok", "no"); k.removeAttribute("aria-disabled"); k.setAttribute("aria-label", k.dataset.l.toUpperCase()); });
    const wn = root.querySelector("#wp-wn"); if(wn) wn.textContent = w + 1;
    if(list[w + 1]) preload([list[w + 1]]);
    fit();
  }
  function paintLabel(){
    const t = S.chars.map(c => c.ch === " " ? " · " : c.on ? c.ch : "_").join(" ");
    wordEl.setAttribute("aria-label", `${S.art.trim() ? S.art.trim() + " " : ""}${t}`);
  }
  function press(l){
    if(!started || !S || S.done || run.paused || !l) return;
    const btn = kb.querySelector(`.wp-key[data-l="${l}"]`);
    if(!btn || S.used.has(l)) return;
    S.used.add(l);
    btn.setAttribute("aria-disabled", "true");
    const hits = S.chars.filter(c => c.hid && !c.on && c.k === l);
    if(hits.length){
      hits.forEach(c => {
        c.on = true;
        const b = wordEl.querySelector(`.wp-box[data-i="${S.chars.indexOf(c)}"]`);
        if(b){ b.textContent = c.ch; b.classList.add("on"); }
      });
      btn.classList.add("ok"); btn.setAttribute("aria-label", `${l.toUpperCase()}, está`);
      paintLabel();
      api.snd("pop"); api.haptic("selection");
      if(S.chars.every(c => c.on)) win();
      else tellLive(run, `Sí, la ${l.toUpperCase()} está`);
    } else {
      btn.classList.add("no"); btn.setAttribute("aria-label", `${l.toUpperCase()}, no está`);
      S.miss++;
      const b = POP[S.miss - 1];
      if(bls[b]){ bls[b].classList.add("pop"); sts[b].classList.add("pop"); }
      api.snd("tap");
      if(S.miss >= LIVES) lose();
      else { place(); tellLive(run, `La ${l.toUpperCase()} no está. ${LIVES - S.miss === 1 ? "Queda" : "Quedan"} ${plural(LIVES - S.miss, "globo", "globos")}`); }
    }
  }
  function win(){
    S.done = true; got++; res[w] = true;
    api.answer(true, S.it);
    api.haptic("success"); api.snd("ok");
    root.classList.add("won");
    if(!RM()) rig.classList.add("won");
    sparks(card, 14);
    sc.textContent = got; api.bump(sc.parentNode);
    api.speak(S.it.word);
    showRes(true, 3400);
  }
  function lose(){
    S.done = true; res[w] = false;
    api.answer(false, S.it);
    rig.classList.add("land");
    place();
    api.snd("whoosh");
    tellLive(run, "Se pincharon todos los globos y la cesta aterrizó");
    const mine = S;
    api.later(run, () => {
      if(S !== mine) return;
      S.chars.forEach((c, j) => {
        if(c.on) return;
        c.on = true;
        const b = wordEl.querySelector(`.wp-box[data-i="${j}"]`);
        if(b){ b.textContent = c.ch; b.classList.add("gave"); }
      });
      paintLabel();
      api.speak(S.it.word);
      showRes(false, 5000);
    }, RM() ? 200 : 1350);
  }
  /* cómo era la palabra (con su IPA), en el sitio del teclado; sigue sola al rato o con «Siguiente» */
  function showRes(ok, ms){
    const it = S.it, last = w + 1 >= N, myW = w;
    low.classList.add("done");
    low.insertAdjacentHTML("beforeend", `<div class="wp-res${ok ? " ok" : ""}" id="wp-res">
      <div class="wp-res-h">${ok ? "✓ ¡Muy bien!" : "¡La cesta aterrizó! La palabra era:"}</div>
      <div class="wp-res-w"><b lang="${esc(code)}">${esc(it.word)}</b>${ipaOf(it)}</div>
      <div class="wp-res-es">= ${esc(it.es)}</div>
      <div class="wp-res-b"><button type="button" class="gm-say" id="wp-say" aria-label="Escuchar otra vez">${IC("speaker-high", "fill", 24)}</button>
        <button type="button" class="glass-btn glass-btn--pri" id="wp-next">${last ? "Ver el premio" : "Siguiente"}${IC("caret-right", "bold", 20)}</button></div></div>`);
    tellLive(run, `${ok ? "¡Muy bien! " : "La palabra era "}${it.word}, ${it.es}`);
    low.querySelector("#wp-say").onclick = () => api.speak(it.word);
    const nx = low.querySelector("#wp-next");
    nx.onclick = () => { if(w === myW) next(); };
    if(api.kbd()) try{ nx.focus({preventScroll: true}); }catch(e){}
    api.later(run, () => { if(w === myW && S && S.done) next(); }, ms);
  }
  function next(){
    if(!S || !S.done || !api.live(run)) return;
    w++;
    if(w < N){ word(); return; }
    S = null;
    const stars = got >= N - 1 ? 3 : got >= Math.ceil(N * .6) ? 2 : 1;
    api.finish(run, AD, {score: got, stars, words: list.map((it, i) => ({word: it.word, es: it.es, img: it.img, miss: !res[i]})),
      line: got ? `¡Adivinaste ${got} de ${N} palabras!` : "¡Casi! La próxima vez adivinarás más palabras."});
  }
  kb.addEventListener("click", e => { const b = e.target.closest(".wp-key"); if(b) press(b.dataset.l); });
  word();
  requestAnimationFrame(fit); api.later(run, fit, 280);
  api.intro(run, AD, () => {
    started = true; fit();
    api.keys(run, e => {
      if(e.ctrlKey || e.metaKey || e.altKey) return;
      if(e.key === "Enter" && S && S.done && !(e.target.closest && e.target.closest("button,a"))){ e.preventDefault(); next(); return; }
      if(e.key.length !== 1 || !S || S.done) return;
      const l = key1(e.key);
      if(l.length === 1 && ABC().includes(l)){ e.preventDefault(); press(l); }
    });
  });
}

/* =====================================================================
   2. SOPA DE LETRAS
   ===================================================================== */
const SP_N = 6, HINT_S = 40;
const BANDS = ["#008198", "#1E6EF4", "#2f9e44", "#d4a017", "#22409a", "#b8743c"];
const spFit = it => okItem(it) && !!gridOf(splitArt(it.word).base, 3, 8);
/* 6 palabras que no estén una dentro de otra (en 8 × 8, que no pasen de 38 letras entre todas) */
function spChoose(C, N){
  const out = [], rnd = mix(C);
  /* al azar y, si no llegan a 6 (palabras largas), se completa con las más cortas */
  for(const c of rnd.concat([...rnd].sort((a, b) => a.g.length - b.g.length))){
    if(out.length >= SP_N) break;
    if(out.includes(c) || out.some(o => o.s.includes(c.s) || c.s.includes(o.s))) continue;
    if(N <= 8 && out.reduce((a, o) => a + o.g.length, 0) + c.g.length > 38) continue;
    out.push(c);
  }
  return out;
}
/* coloca las palabras (las largas primero): una dirección al azar entre las que tienen sitio y un sitio al azar; se
   pueden cruzar si la letra es la misma */
function spPlace(list, N, dirs){
  if(list.length < 3) return null;
  const ord = [...list].sort((a, b) => b.g.length - a.g.length);
  for(let a = 0; a < 30; a++){
    const G = Array(N * N).fill(""), out = [], used = dirs.map(() => 0);
    let ok = true;
    for(const w of ord){
      const n = w.g.length, by = dirs.map(() => []);
      dirs.forEach(([dr, dc], di) => {
        for(let r = 0; r < N; r++) for(let c = 0; c < N; c++){
          const r1 = r + dr * (n - 1), c1 = c + dc * (n - 1);
          if(r1 < 0 || r1 >= N || c1 < 0 || c1 >= N) continue;
          let x = 0, bad = false;
          for(let k = 0; k < n && !bad; k++){ const v = G[(r + dr * k) * N + c + dc * k]; if(v){ if(v !== w.g[k]) bad = true; else x++; } }
          if(!bad && x < n) by[di].push({r, c, dr, dc});
        }
      });
      const ds = dirs.map((d, i) => i).filter(i => by[i].length);
      if(!ds.length){ ok = false; break; }
      const low = Math.min(...ds.map(i => used[i])), di = pick(ds.filter(i => used[i] === low || Math.random() < .25));
      used[di]++;
      const o = pick(by[di]), cells = [];
      for(let k = 0; k < n; k++){ const i = (o.r + o.dr * k) * N + o.c + o.dc * k; G[i] = w.g[k]; cells.push(i); }
      out.push(Object.assign({}, w, {cells}));
    }
    if(ok) return {G, words: list.map(w => out.find(o => o.s === w.s))};
  }
  return null;
}

async function sopa(app, api, mode){
  const my = api.nav();
  css();
  const L = lang;
  let TP = {P: []};
  try{ TP = await api.topicPool(SP, SP_N, spFit); }catch(e){}
  if(!api.here(my, SP) || lang !== L) return;
  const big = isWide(), N = big ? 10 : 8;
  const DIRS = big ? [[0, 1], [1, 0], [1, 1], [-1, 1]] : [[0, 1], [1, 0]];
  const C = gridCands(TP.P, 3, 8);
  let lay = null;
  for(let t = 0; t < 14 && !lay; t++) lay = spPlace(spChoose(C, N), N, DIRS);
  if(!lay){ app.innerHTML = emptyHtml(api); return; }
  /* el resto, con letras de las palabras del tema (así las de las palabras no destacan) */
  const fillers = (C.map(c => c.s).join("") + ABC().toUpperCase()).split("");
  lay.G = lay.G.map(ch => ch || pick(fillers));
  const words = lay.words.map(w => Object.assign(w, {found: false, hs: 0}));
  const code = codeOf(), W = words.length;
  preload(words.map(w => w.it));
  const cells = lay.G.map((ch, i) => `<button type="button" class="wp-c" data-i="${i}" tabindex="${i ? -1 : 0}" aria-label="${esc(ch)}, fila ${Math.floor(i / N) + 1}, columna ${i % N + 1}">${esc(ch)}</button>`).join("");
  const items = words.map((w, i) => `<button type="button" class="wp-li" data-w="${i}" aria-label="${esc(w.base)}. Toca para oírla">
      <span class="wp-li-p">${imgHtml(w.it)}</span><span class="wp-li-w" lang="${esc(code)}">${esc(w.base)}</span><span class="wp-li-ok" aria-hidden="true">${IC("check", "bold", 14)}</span></button>`).join("");
  const run = api.mount(app, `<div class="gm wp wp-sp" id="wp-sp">
    ${api.topHtml(SP, `<span class="gm-pill" title="Tiempo">${IC("timer", "bold", 18)}<b id="wp-clock">0:00</b></span><span class="gm-pill" title="Encontradas">${IC("magnifying-glass", "bold", 18)}<span><b id="gm-sc">0</b>/${W}</span></span>`)}
    <div class="wp-sp-main" id="wp-main">
      <div class="wp-board" id="wp-board" style="--n:${N}" role="group" aria-label="Sopa de letras de ${N} por ${N}">
        <svg class="wp-bands" viewBox="0 0 ${N} ${N}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g id="wp-found"></g><line class="wp-selb" id="wp-selb" x1="0" y1="0" x2="0" y2="0" visibility="hidden"/></svg>
        <div class="wp-cells" id="wp-cells">${cells}</div></div>
      <div class="wp-sp-side" id="wp-side">
        <p class="wp-sp-st" id="wp-st">Busca las ${W} palabras</p>
        <div class="wp-list" id="wp-list">${items}</div></div></div>${LIVE}</div>`, mode);
  const root = run.root, board = root.querySelector("#wp-board"), cellsEl = root.querySelector("#wp-cells"), main = root.querySelector("#wp-main");
  const side = root.querySelector("#wp-side"), st = root.querySelector("#wp-st"), listEl = root.querySelector("#wp-list"), selb = root.querySelector("#wp-selb");
  const foundG = root.querySelector("#wp-found"), clk = root.querySelector("#wp-clock"), sc = root.querySelector("#gm-sc");
  const cellEls = [...cellsEl.querySelectorAll(".wp-c")], liEls = [...listEl.querySelectorAll(".wp-li")];
  root.wpWords = words.map(w => ({s: w.s, cells: w.cells}));   /* para las pruebas */
  root.wpN = N;
  const HS = Number(window.__wpHint) > 0 ? +window.__wpHint : HINT_S;
  let started = false, ended = false, t = 0, last = 0, shown = -1, lastFind = 0, hints = 0, nFound = 0, hinted = null, tapStart = -1, drag = null, cur = 0, flash = 0;

  const rc = i => [Math.floor(i / N), i % N];
  /* las casillas de la línea de a a b (recta, de lado, de arriba abajo o en diagonal) o null */
  function line(a, b){
    const [r0, c0] = rc(a), [r1, c1] = rc(b), dr = r1 - r0, dc = c1 - c0;
    if(dr && dc && Math.abs(dr) !== Math.abs(dc)) return null;
    const n = Math.max(Math.abs(dr), Math.abs(dc)), sr = Math.sign(dr), sc0 = Math.sign(dc), out = [];
    for(let k = 0; k <= n; k++) out.push((r0 + sr * k) * N + c0 + sc0 * k);
    return out;
  }
  /* al arrastrar torcido: la dirección buena más cercana (de 45 en 45 grados), sin salirse */
  function snap(a, b){
    const [r0, c0] = rc(a), [r1, c1] = rc(b), dr = r1 - r0, dc = c1 - c0;
    if(!dr || !dc || Math.abs(dr) === Math.abs(dc)) return b;
    const k = Math.round(Math.atan2(dr, dc) / (Math.PI / 4)), sr = Math.round(Math.sin(k * Math.PI / 4)), s2 = Math.round(Math.cos(k * Math.PI / 4));
    let n = Math.max(Math.abs(dr), Math.abs(dc));
    while(n > 0 && (r0 + sr * n < 0 || r0 + sr * n >= N || c0 + s2 * n < 0 || c0 + s2 * n >= N)) n--;
    return (r0 + sr * n) * N + c0 + s2 * n;
  }
  const lineAttrs = (a, b) => { const [r0, c0] = rc(a), [r1, c1] = rc(b); return {x1: c0 + .5, y1: r0 + .5, x2: c1 + .5, y2: r1 + .5}; };
  function paintSel(a, b, no){
    if(a < 0){ selb.setAttribute("visibility", "hidden"); return; }
    const p = lineAttrs(a, b);
    Object.keys(p).forEach(k => selb.setAttribute(k, p[k]));
    selb.classList.toggle("no", !!no);
    selb.setAttribute("visibility", "visible");
  }
  const markStart = i => cellEls.forEach((el, j) => el.classList.toggle("start", j === i));
  function cellAt(x, y){
    const r = cellsEl.getBoundingClientRect(), s = r.width / N;
    const c = Math.min(N - 1, Math.max(0, Math.floor((x - r.left) / s))), rr = Math.min(N - 1, Math.max(0, Math.floor((y - r.top) / s)));
    return rr * N + c;
  }
  function check(a, b){
    const cs = line(a, b);
    if(!cs || cs.length < 2) return;
    const s = cs.map(i => lay.G[i]).join(""), rs = [...s].reverse().join("");
    const w = words.find(x => !x.found && (x.s === s || x.s === rs));
    if(w){ found(w, cs); return; }
    if(words.some(x => x.found && (x.s === s || x.s === rs))){ paintSel(-1); return; }
    /* mal: la banda en gris con ✗ un momento (sin sonido triste) */
    paintSel(a, b, true);
    const f = document.createElement("div"), br = board.getBoundingClientRect(), er = cellEls[b].getBoundingClientRect();
    f.className = "gm-float bad"; f.textContent = "✗";
    f.style.left = (er.left - br.left + er.width / 2) + "px"; f.style.top = Math.max(0, er.top - br.top - 10) + "px";
    board.appendChild(f);
    const my = ++flash;
    api.later(run, () => { f.remove(); if(flash === my && !drag) paintSel(-1); }, 650);
    tellLive(run, "Esa no es. Prueba otra vez");
  }
  function found(w, cs){
    w.found = true; nFound++;
    const p = lineAttrs(cs[0], cs[cs.length - 1]);
    foundG.insertAdjacentHTML("beforeend", `<line class="wp-band" x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${BANDS[(nFound - 1) % BANDS.length]}"/>`);
    paintSel(-1);
    w.cells.concat(cs).forEach(i => cellEls[i].classList.remove("hint"));
    if(hinted === w) hinted = null;
    const li = liEls[words.indexOf(w)];
    li.classList.add("done"); li.setAttribute("aria-label", `${w.base}: encontrada. Toca para oírla`);
    st.className = "wp-sp-st ok";
    st.innerHTML = `✓ <b lang="${esc(code)}">${esc(w.it.word)}</b>${ipaOf(w.it)}<small>= ${esc(w.it.es)}</small>`;
    api.speak(w.it.word); api.answer(true, w.it);
    api.haptic("success"); api.snd("ok");
    sparks(li, 10);
    sc.textContent = nFound; api.bump(sc.parentNode);
    lastFind = t;
    if(nFound >= W) end();
  }
  /* la pista: brilla la primera letra de una palabra que falta (si sigue sin salir, también la última) */
  function hint(){
    const miss = words.filter(x => !x.found);
    const w = hinted && !hinted.found && hinted.hs < 2 ? hinted : miss.find(x => !x.hs);
    if(!w) return;
    w.hs++; hints++; hinted = w;
    cellEls[w.hs === 1 ? w.cells[0] : w.cells[w.cells.length - 1]].classList.add("hint");
    st.className = "wp-sp-st hint";
    st.textContent = w.hs === 1 ? "Pista: una palabra empieza en la letra que brilla" : "Pista: y termina en la otra letra que brilla";
    tellLive(run, st.textContent);
    api.snd("pop");
  }
  /* tocar: la primera letra y luego la última */
  function tap(i){
    if(!started || ended || run.paused) return;
    if(tapStart < 0 || tapStart === i){
      tapStart = tapStart === i ? -1 : i;
      markStart(tapStart); paintSel(-1);
      if(tapStart >= 0){ api.haptic("selection"); api.snd("tap"); }
      return;
    }
    const a = tapStart;
    if(!line(a, i)){ tapStart = i; markStart(i); api.snd("tap"); return; }
    tapStart = -1; markStart(-1);
    paintSel(a, i);
    check(a, i);
  }
  cellsEl.addEventListener("pointerdown", e => {
    if(!started || ended || run.paused || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    const i = cellAt(e.clientX, e.clientY);
    drag = {a: i, b: i, id: e.pointerId, moved: false};
    try{ cellsEl.setPointerCapture(e.pointerId); }catch(err){}
    if(tapStart < 0) paintSel(i, i);
  });
  cellsEl.addEventListener("pointermove", e => {
    if(!drag || e.pointerId !== drag.id) return;
    const i = snap(drag.a, cellAt(e.clientX, e.clientY));
    if(i === drag.b) return;
    drag.b = i; drag.moved = true;
    if(tapStart >= 0){ tapStart = -1; markStart(-1); }
    paintSel(drag.a, i);
    api.haptic("selection");
  });
  const up = e => {
    if(!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if(e.type !== "pointerup" || run.paused){ paintSel(-1); return; }
    if(d.moved && d.b !== d.a) check(d.a, d.b);
    else { paintSel(-1); tap(d.a); }
  };
  cellsEl.addEventListener("pointerup", up); cellsEl.addEventListener("pointercancel", up);
  cellsEl.addEventListener("contextmenu", e => e.preventDefault());
  /* con el teclado: flechas para moverse, Enter o Espacio para marcar la primera y la última letra */
  cellsEl.addEventListener("click", e => { if(e.detail !== 0) return; const b = e.target.closest(".wp-c"); if(b){ setCur(+b.dataset.i, false); tap(+b.dataset.i); } });
  function setCur(i, focus = true){
    cellEls[cur].tabIndex = -1; cur = i; cellEls[i].tabIndex = 0;
    if(focus) try{ cellEls[i].focus({preventScroll: true}); }catch(e){}
  }
  listEl.addEventListener("click", e => {
    const b = e.target.closest(".wp-li"); if(!b) return;
    const it = words[+b.dataset.w].it;
    api.speak(it.word);
    st.className = "wp-sp-st";
    st.innerHTML = `<b lang="${esc(code)}">${esc(it.word)}</b>${ipaOf(it)}<small>= ${esc(it.es)}</small>`;
  });

  function end(){
    if(ended) return;
    ended = true;
    const secs = Math.round(t), pen = secs + 30 * hints, [g3, g2] = N >= 10 ? [180, 360] : [150, 300];
    const stars = pen <= g3 ? 3 : pen <= g2 ? 2 : 1;
    api.later(run, () => api.finish(run, SP, {score: Math.max(10, 1000 - pen), stars,
      words: words.map(w => ({word: w.it.word, es: w.it.es, img: w.it.img, miss: w.hs > 0})),
      line: `¡Encontraste las ${W} palabras en ${clock(secs)}!${hints ? ` Usaste ${plural(hints, "pista", "pistas")}.` : ""}`}), 1600);
  }
  function frame(now){
    if(!api.live(run) || ended) return;
    const dt = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now;
    if(started && !run.paused && !document.hidden){
      t += dt;
      const s = Math.floor(t);
      if(s !== shown){ shown = s; clk.textContent = clock(s); }
      if(t - lastFind >= HS){ lastFind = t; hint(); }
    }
    run.raf = requestAnimationFrame(frame);
  }
  /* la rejilla, cuadrada y lo más grande que quepa (en el ordenador, la lista a la derecha) */
  function fit(){
    if(!api.live(run)) return;
    const wide = root.clientWidth >= 700;
    root.classList.toggle("wide", wide);
    root.style.removeProperty("--lp");
    const av = availH(main), MW = main.clientWidth, sh = side.offsetHeight;
    let size = wide ? Math.min(av, MW - 300, 620) : Math.min(MW, av - sh - 10);
    size = Math.floor(Math.max(N * 30, size));
    board.style.width = board.style.height = size + "px";
    board.style.setProperty("--cs", ((size - 8) / N).toFixed(1) + "px");
    /* en el celular, lo que sobra de alto para los dibujos de la lista */
    const left = av - size - sh - 10;
    if(!wide && left > 8) root.style.setProperty("--lp", Math.min(96, 58 + Math.floor(left / Math.ceil(W / 3))) + "px");
  }
  const onR = () => fit();
  addEventListener("resize", onR); run.clean.push(() => removeEventListener("resize", onR));
  fit(); requestAnimationFrame(fit); api.later(run, fit, 280);
  api.intro(run, SP, () => {
    fit();
    started = true; last = performance.now();
    run.raf = requestAnimationFrame(frame);
    api.keys(run, e => {
      const mv = {ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]}[e.key];
      if(!mv || ended) return;
      e.preventDefault();
      const [r, c] = rc(cur), r1 = r + mv[0], c1 = c + mv[1];
      setCur(r1 >= 0 && r1 < N && c1 >= 0 && c1 < N ? r1 * N + c1 : cur);
    });
  });
}

/* =====================================================================
   3. CRUCIGRAMA — de 5 a 7 palabras cruzadas de verdad
   ===================================================================== */
const CW_MAX = 7;
/* la tecla de borrar (el sprite de iconos no la tiene) */
const BACK = `<svg class="ico" width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8.5 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8.5L2.5 12Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M11.5 9.5l5 5M16.5 9.5l-5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const cwFit = it => okItem(it) && !sameEs(it) && !!gridOf(splitArt(it.word).base, 3, 9);
/* una colocación: la primera palabra de lado y cada otra cruzando alguna ya puesta (la mejor de todas sus posiciones:
   más cruces y menos sitio); las que no caben se quedan fuera */
function cwTry(pool, maxC, maxR){
  const G = new Map(), words = [], K = (r, c) => r + "," + c;
  let r0 = 0, r1 = 0, c0 = 0, c1 = 0, X = 0;
  function put(w, r, c, dir){
    const dr = dir === "d" ? 1 : 0, dc = dir === "a" ? 1 : 0, wi = words.length, n = w.g.length;
    for(let k = 0; k < n; k++){
      const key = K(r + dr * k, c + dc * k), cell = G.get(key) || {ch: w.g[k], a: -1, d: -1};
      cell[dir] = wi; G.set(key, cell);
    }
    words.push({w, r, c, dir});
    r0 = Math.min(r0, r); c0 = Math.min(c0, c); r1 = Math.max(r1, r + dr * (n - 1)); c1 = Math.max(c1, c + dc * (n - 1));
  }
  function fits(g, r, c, dir){
    const dr = dir === "d" ? 1 : 0, dc = dir === "a" ? 1 : 0, n = g.length;
    if(G.has(K(r - dr, c - dc)) || G.has(K(r + dr * n, c + dc * n))) return null;
    let x = 0;
    for(let k = 0; k < n; k++){
      const rr = r + dr * k, cc = c + dc * k, cell = G.get(K(rr, cc));
      if(cell){ if(cell.ch !== g[k] || cell[dir] >= 0) return null; x++; }
      else if(G.has(K(rr + dc, cc + dr)) || G.has(K(rr - dc, cc - dr))) return null;
    }
    if(!x) return null;
    const H = Math.max(r1, r + dr * (n - 1)) - Math.min(r0, r) + 1, W = Math.max(c1, c + dc * (n - 1)) - Math.min(c0, c) + 1;
    if(W > maxC || H > maxR) return null;
    return {r, c, dir, x, s: x * 4 - H * W * .15 - Math.abs(H - W) * .4 + Math.random() * 1.5};
  }
  if(!pool.length || pool[0].g.length > maxC) return {words: [], n: 0};
  put(pool[0], 0, 0, "a");
  for(const w of pool.slice(1)){
    if(words.length >= CW_MAX) break;
    let best = null;
    for(let i = 0; i < w.g.length; i++) for(const [key, cell] of G){
      if(cell.ch !== w.g[i]) continue;
      const [r, c] = key.split(",").map(Number);
      for(const dir of ["a", "d"]){
        if(cell[dir] >= 0) continue;
        const o = fits(w.g, dir === "d" ? r - i : r, dir === "a" ? c - i : c, dir);
        if(o && (!best || o.s > best.s)) best = o;
      }
    }
    if(best){ put(w, best.r, best.c, best.dir); X += best.x; }
  }
  return {words, n: words.length, r0, c0, H: r1 - r0 + 1, W: c1 - c0 + 1, x: X};
}
/* muchas colocaciones con órdenes distintos; se queda la de más palabras (hasta 7) y, entre ellas, la más pequeña */
function cwBuild(C, maxC, maxR){
  let best = null;
  const t0 = performance.now();
  for(let a = 0; a < 120 && (a < 20 || performance.now() - t0 < 300); a++){
    const pool = mix(C).slice(0, 18), longs = pool.filter(w => w.g.length >= 5 && w.g.length <= maxC);
    if(longs.length){ const f = pick(longs); pool.splice(pool.indexOf(f), 1); pool.unshift(f); }
    const L = cwTry(pool, maxC, maxR);
    if(L.n < 2) continue;
    L.score = Math.min(L.n, CW_MAX) * 40 - L.H * L.W * .6 + L.x * 4 - Math.abs(L.H - L.W);
    if(!best || L.score > best.score) best = L;
  }
  return best;
}

async function crucigrama(app, api, mode){
  const my = api.nav();
  css();
  const L = lang;
  let TP = {P: []};
  try{ TP = await api.topicPool(CW, 8, cwFit); }catch(e){}
  if(!api.here(my, CW) || lang !== L) return;
  const wide0 = isWide();
  /* en el celular, tantas columnas como quepan de 32 px (10 en 360 px) */
  const maxC = wide0 ? 12 : Math.max(7, Math.min(12, Math.floor(widthOf(app) / 32))), maxR = wide0 ? 10 : 11;
  const lay = cwBuild(gridCands(TP.P, 3, 9), maxC, maxR);
  if(!lay || lay.n < 3){ app.innerHTML = emptyHtml(api); return; }
  const code = codeOf(), H = lay.H, Wd = lay.W;
  /* las casillas y la numeración de siempre (de izquierda a derecha y de arriba abajo) */
  const cmap = new Map(), K = (r, c) => r + "," + c;
  const raw = lay.words.map(o => ({it: o.w.it, base: o.w.base, g: o.w.g, r: o.r - lay.r0, c: o.c - lay.c0, dir: o.dir}));
  const starts = [...new Set(raw.map(w => w.r * 100 + w.c))].sort((a, b) => a - b);
  raw.forEach(w => { w.n = starts.indexOf(w.r * 100 + w.c) + 1; });
  const words = raw.sort((a, b) => a.n - b.n || (a.dir === "a" ? -1 : 1));
  words.forEach((w, wi) => {
    const dr = w.dir === "d" ? 1 : 0, dc = w.dir === "a" ? 1 : 0;
    w.cells = w.g.map((ch, k) => {
      const key = K(w.r + dr * k, w.c + dc * k);
      let c = cmap.get(key);
      if(!c){ c = {r: w.r + dr * k, c: w.c + dc * k, sol: ch, val: "", lock: "", no: false, words: [], n: 0}; cmap.set(key, c); }
      c.words.push(wi);
      return c;
    });
    if(!w.cells[0].n) w.cells[0].n = w.n;
    Object.assign(w, {done: false, hints: 0, errs: 0});
  });
  const NW = words.length;
  preload(words.map(w => w.it));
  let grid = "";
  for(let r = 0; r < H; r++) for(let c = 0; c < Wd; c++){
    const x = cmap.get(K(r, c));
    grid += x ? `<button type="button" class="wp-cc" data-k="${r},${c}" tabindex="-1" aria-label="Casilla">${x.n ? `<small aria-hidden="true">${x.n}</small>` : ""}<span></span></button>` : `<span aria-hidden="true"></span>`;
  }
  const dirTxt = w => w.dir === "a" ? "De lado →" : "Hacia abajo ↓";
  const clues = words.map((w, i) => `<button type="button" class="wp-clue" data-w="${i}" aria-label="${w.n} ${w.dir === "a" ? "de lado" : "hacia abajo"}: ${esc(w.it.es)}">
    <b class="n" aria-hidden="true">${w.n}</b><span class="cp">${imgHtml(w.it)}</span><span class="ct" aria-hidden="true"><span class="ce">${esc(w.it.es)}</span><span class="cd">${dirTxt(w)} · ${w.g.length} letras</span></span>
    <span class="ck" aria-hidden="true">${IC("check", "bold", 12)}</span></button>`).join("");
  const run = api.mount(app, `<div class="gm wp wp-cw" id="wp-cw">
    ${api.topHtml(CW, `<span class="gm-pill" title="Palabras">${IC("check-circle", "fill", 18)}<span><b id="gm-sc">0</b>/${NW}</span></span><span class="gm-pill" title="Pistas">${IC("lightbulb", "bold", 18)}<b id="wp-hn">0</b></span>`)}
    <div class="wp-cw-main" id="wp-main">
      <div class="wp-cw-board" id="wp-board"><div class="wp-cw-grid" id="wp-grid" style="--cols:${Wd}" role="group" aria-label="Crucigrama">${grid}</div></div>
      <div class="wp-clues" id="wp-clues" role="group" aria-label="Pistas">${clues}</div>
      <div class="wp-cbar" id="wp-cbar">
        <span class="wp-cbar-p" id="wp-cp"></span>
        <div class="wp-cbar-t"><span class="wp-cbar-n" id="wp-cn"></span><b id="wp-ce"></b><span class="wp-cbar-s" id="wp-cs" lang="${esc(code)}"></span></div>
        <button type="button" class="glass-btn glass-btn--sm wp-hint" id="wp-hint" aria-label="Pista: pon una letra">${IC("lightbulb", "bold", 20)}Pista</button></div>
      ${kbHtml(`<button type="button" class="wp-key wp-del" data-l="del" aria-label="Borrar">${BACK}</button>`)}
    </div>${LIVE}</div>`, mode);
  const root = run.root, boardW = root.querySelector("#wp-board"), gridEl = root.querySelector("#wp-grid"), cluesEl = root.querySelector("#wp-clues");
  const bar = root.querySelector("#wp-cbar"), kb = root.querySelector("#wp-kb"), cp = root.querySelector("#wp-cp"), cn = root.querySelector("#wp-cn");
  const ce = root.querySelector("#wp-ce"), cs = root.querySelector("#wp-cs"), sc = root.querySelector("#gm-sc"), hn = root.querySelector("#wp-hn");
  cmap.forEach((c, key) => { c.el = gridEl.querySelector(`[data-k="${key}"]`); });
  const clueEls = [...cluesEl.querySelectorAll(".wp-clue")];
  root.wpWords = words.map(w => ({n: w.n, dir: w.dir, r: w.r, c: w.c, sol: w.g.join("")}));   /* para las pruebas */
  let sel = {w: 0, k: 0}, started = false, ended = false, busy = false, hints = 0, solved = 0, pts = 0;

  const full = w => w.cells.every(c => c.val);
  const right = w => w.cells.every(c => c.val === c.sol);
  const firstFree = w => { const k = w.cells.findIndex(c => !c.lock && !c.val); return k >= 0 ? k : Math.max(0, w.cells.findIndex(c => !c.lock)); };
  function nextOpen(from){ for(let j = 1; j <= NW; j++){ const i = (from + j) % NW; if(!words[i].done) return i; } return -1; }
  function paint(){
    const w = words[sel.w], on = new Set(w.cells), curC = w.cells[sel.k];
    cmap.forEach(c => {
      c.el.lastChild.textContent = c.val;
      c.el.className = "wp-cc" + (c.lock === "ok" ? " ok" : c.lock === "hint" ? " hint" : "") + (c.no ? " no" : "") + (on.has(c) ? " sel" : "") + (c === curC && !ended ? " cur" : "") + (c.el.classList.contains("win") ? " win" : "");
      c.el.setAttribute("aria-label", `${c.n ? c.n + ". " : ""}${c.val || "vacía"}`);
    });
    clueEls.forEach((el, i) => { el.classList.toggle("on", i === sel.w); el.classList.toggle("done", words[i].done); });
  }
  function showClue(){
    const w = words[sel.w];
    cp.innerHTML = imgHtml(w.it);
    cn.textContent = `${w.n} ${w.dir === "a" ? "→" : "↓"} · ${w.g.length} letras`;
    ce.textContent = w.it.es;
  }
  function select(wi, k){
    if(wi < 0 || !words[wi]) return;
    sel = {w: wi, k: k === undefined ? firstFree(words[wi]) : k};
    paint(); showClue();
    const c = words[wi].cells[sel.k];
    /* que la casilla se vea (la rejilla puede desplazarse hacia abajo) */
    if(c && c.el && boardW.scrollHeight > boardW.clientHeight + 2){
      const top = c.el.offsetTop - boardW.offsetTop, h = c.el.offsetHeight;
      if(top < boardW.scrollTop || top + h > boardW.scrollTop + boardW.clientHeight) boardW.scrollTop = Math.max(0, top - boardW.clientHeight / 2);
    }
  }
  const ready = () => started && !ended && !busy && !run.paused;
  function typeL(l){
    if(!ready()) return;
    let w = words[sel.w];
    if(w.done){ const j = nextOpen(sel.w); if(j < 0) return; select(j); w = words[j]; }
    let k = sel.k;
    if(w.cells[k].lock){
      k = w.cells.findIndex((c, i) => i >= k && !c.lock);
      if(k < 0) k = w.cells.findIndex(c => !c.lock);
      if(k < 0) return;
    }
    w.cells[k].val = l.toUpperCase();
    api.snd("tap");
    let nk = -1;
    for(let i = k + 1; i < w.cells.length && nk < 0; i++) if(!w.cells[i].lock && !w.cells[i].val) nk = i;
    for(let i = 0; i < k && nk < 0; i++) if(!w.cells[i].lock && !w.cells[i].val) nk = i;
    if(nk < 0){ nk = k; for(let i = k + 1; i < w.cells.length; i++) if(!w.cells[i].lock){ nk = i; break; } }
    sel.k = nk;
    paint();
    after(w);
  }
  /* después de escribir: la palabra elegida, si está llena, se mira; las que se cruzan, solo si ya están bien */
  function after(w){
    const others = new Set();
    w.cells.forEach(c => c.words.forEach(i => { if(words[i] !== w && !words[i].done && full(words[i]) && right(words[i])) others.add(words[i]); }));
    if(full(w)) check(w, [...others]);
    else if(others.size) solve([...others]);
  }
  function erase(){
    if(!ready()) return;
    const w = words[sel.w]; if(w.done) return;
    let k = sel.k;
    if(w.cells[k].lock || !w.cells[k].val){
      for(let i = k - 1; i >= 0; i--) if(!w.cells[i].lock){ k = i; break; }
    }
    if(!w.cells[k].lock) w.cells[k].val = "";
    sel.k = k;
    api.snd("tap");
    paint();
  }
  function check(w, others = []){
    if(right(w)){ solve([w, ...others]); return; }
    /* mal: las letras equivocadas en gris con ✗ un momento y se borran (sin sonido triste) */
    busy = true; w.errs++;
    if(w.errs === 1) api.answer(false, w.it);
    const bad = w.cells.filter(c => !c.lock && c.val !== c.sol);
    bad.forEach(c => { c.no = true; });
    paint();
    tellLive(run, `Casi. ${bad.length === 1 ? "Una letra no está bien" : `${bad.length} letras no están bien`}`);
    if(others.length) solve(others);
    api.later(run, () => {
      bad.forEach(c => { c.no = false; c.val = ""; });
      busy = false;
      const k = w.cells.indexOf(bad[0]);
      if(words[sel.w] === w && k >= 0) sel.k = k;
      paint();
    }, 950);
  }
  /* palabras bien: en turquesa y fijas; suena la primera con su IPA (y las que se completan con sus letras, también
     cuentan) */
  function solve(list){
    const fresh = list.filter(w => !w.done);
    if(!fresh.length) return;
    const mark = w => {
      w.done = true; solved++;
      w.cells.forEach((c, i) => { c.lock = "ok"; c.val = c.sol; c.no = false; c.el.style.setProperty("--i", i); });
      pts += Math.max(1, 3 - w.hints - (w.errs ? 1 : 0));
      if(!w.errs) api.answer(true, w.it);
    };
    fresh.forEach(mark);
    for(let more = words.filter(o => !o.done && right(o)); more.length; more = words.filter(o => !o.done && right(o))) more.forEach(mark);
    const first = fresh[0];
    cs.innerHTML = `✓ ${esc(first.it.word)} ${ipaOf(first.it)}`;
    tellLive(run, `¡Bien! ${first.it.word}, ${first.it.es}`);
    api.speak(first.it.word);
    api.haptic("success"); api.snd("ok");
    sc.textContent = solved; api.bump(sc.parentNode);
    paint();
    if(!RM()) first.cells.forEach(c => { c.el.classList.remove("win"); void c.el.offsetWidth; c.el.classList.add("win"); });
    sparks(clueEls[words.indexOf(first)], 10);
    if(solved >= NW){ end(); return; }
    if(words[sel.w].done) select(nextOpen(sel.w));
  }
  function hint(){
    if(!ready()) return;
    let w = words[sel.w];
    if(w.done){ const j = nextOpen(sel.w); if(j < 0) return; select(j); w = words[j]; }
    let c = w.cells[sel.k];
    if(!c || c.lock || c.val === c.sol){ c = w.cells.find(x => !x.lock && x.val !== x.sol); }
    if(!c){ after(w); return; }
    c.val = c.sol; c.lock = "hint"; w.hints++; hints++;
    hn.textContent = hints; api.bump(hn.parentNode);
    api.snd("pop"); api.haptic("selection");
    const k = w.cells.findIndex(x => !x.lock && !x.val);
    if(k >= 0) sel.k = k;
    paint();
    after(w);
  }
  /* las flechas: a la casilla de al lado (saltando huecos) y en esa dirección */
  function move(dr, dc){
    if(!ready()) return;
    const cur = words[sel.w].cells[sel.k];
    let r = cur.r, c = cur.c, x = null;
    for(let s = 0; s < Math.max(H, Wd) && !x; s++){ r += dr; c += dc; if(r < 0 || c < 0 || r >= H || c >= Wd) break; x = cmap.get(K(r, c)); }
    const dir = dc ? "a" : "d", tgt = x || cur;
    const wi = tgt.words.find(i => words[i].dir === dir) ?? (tgt.words.includes(sel.w) ? sel.w : tgt.words[0]);
    select(wi, words[wi].cells.indexOf(tgt));
  }
  function tapCell(c){
    if(!c || !started || ended || run.paused) return;
    const cur = words[sel.w].cells[sel.k];
    let wi;
    if(c === cur && c.words.length > 1) wi = c.words.find(i => i !== sel.w);
    else if(c.words.includes(sel.w)) wi = sel.w;
    else wi = c.words.find(i => words[i].dir === words[sel.w].dir) ?? c.words[0];
    api.haptic("selection");
    select(wi, words[wi].cells.indexOf(c));
  }
  gridEl.addEventListener("click", e => { const b = e.target.closest(".wp-cc"); if(b) tapCell(cmap.get(b.dataset.k)); });
  cluesEl.addEventListener("click", e => { const b = e.target.closest(".wp-clue"); if(b && started && !ended){ api.haptic("selection"); select(+b.dataset.w); } });
  kb.addEventListener("click", e => { const b = e.target.closest(".wp-key"); if(!b) return; if(b.dataset.l === "del") erase(); else typeL(b.dataset.l); });
  root.querySelector("#wp-hint").onclick = hint;

  function end(){
    if(ended) return;
    ended = true;
    paint();
    const max = 3 * NW, ratio = pts / max, stars = ratio >= .85 ? 3 : ratio >= .6 ? 2 : 1;
    api.later(run, () => api.finish(run, CW, {score: pts, stars,
      words: words.map(w => ({word: w.it.word, es: w.it.es, img: w.it.img, miss: w.hints > 0 || w.errs > 0})),
      line: `¡Completaste el crucigrama de ${NW} palabras${hints ? ` con ${plural(hints, "pista", "pistas")}` : " sin pistas"}! Puntos: ${pts} de ${max}.`}), 1800);
  }
  /* las casillas de 30 px como mínimo; si la rejilla no cabe de alto, se desplaza hacia abajo (nunca de lado) */
  function fit(){
    if(!api.live(run)) return;
    const wide = root.clientWidth >= 700;
    root.classList.toggle("wide", wide);
    root.style.removeProperty("--bp"); root.style.removeProperty("--kh");
    kbFit(kb);
    const bw = boardW.clientWidth - 2;
    let csz = Math.max(30, Math.min(wide ? 44 : 46, Math.floor(bw / Wd)));
    const below = () => wide ? bar.offsetHeight + kb.offsetHeight + 24 : cluesEl.offsetHeight + bar.offsetHeight + kb.offsetHeight + 30;
    const top = availH(boardW);
    let ah = Math.floor(top - below());
    if(csz * H + 6 > ah) csz = Math.max(30, Math.floor((ah - 6) / H));
    else if(!wide){
      /* sobra alto: el dibujo de la pista y las teclas, más grandes */
      const extra = ah - csz * H - 6, bp = Math.min(112, 78 + Math.floor(extra * .6)), kh = Math.min(54, 46 + Math.floor((extra - (bp - 78)) / 4));
      root.style.setProperty("--bp", bp + "px"); root.style.setProperty("--kh", kh + "px");
      ah = Math.floor(top - below());
    }
    boardW.style.setProperty("--cs", csz + "px");
    boardW.style.maxHeight = Math.max(csz * 3 + 6, ah) + "px";
  }
  const onR = () => fit();
  addEventListener("resize", onR); run.clean.push(() => removeEventListener("resize", onR));
  select(0, 0);
  cs.textContent = "";
  fit(); requestAnimationFrame(fit); api.later(run, fit, 280);
  /* con el ratón, las casillas, las teclas y «Pista» no se quedan el foco: así Enter sigue siendo «siguiente palabra» */
  root.addEventListener("mousedown", e => { if(e.target.closest && e.target.closest(".wp-cc,.wp-key,#wp-hint,.wp-clue")) e.preventDefault(); });
  api.intro(run, CW, () => {
    started = true; fit();
    api.keys(run, e => {
      if(e.ctrlKey || e.metaKey || e.altKey || ended) return;
      const onBtn = e.target.closest && e.target.closest("button,a");
      const mv = {ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]}[e.key];
      if(mv){ e.preventDefault(); move(mv[0], mv[1]); return; }
      if(e.key === "Backspace" || e.key === "Delete"){ e.preventDefault(); erase(); return; }
      if(e.key === "Enter" && !onBtn){ e.preventDefault(); if(ready()){ const j = nextOpen(sel.w); if(j >= 0) select(j); } return; }
      if(e.key === " " && !onBtn){ e.preventDefault(); const c = words[sel.w].cells[sel.k]; if(c) tapCell(c); return; }
      if(e.key.length !== 1) return;
      const l = key1(e.key);
      if(l.length === 1 && ABC().includes(l)){ e.preventDefault(); typeL(l); }
    });
  });
}

/* ---------- a Juegos ---------- */
const reg = (id, def) => window.vocabGames && typeof vocabGames.register === "function" && vocabGames.register(id, Object.assign({topic: true, sec: "palabras", fresh: true}, def));
if(!reg(AD, {
  t: "Adivina la palabra", sub: "Salva los globos", img: "img/games/adivina.png",
  how: "Mira el dibujo y piensa cómo se dice. Toca una letra: si está, aparece en su sitio. Si no está, se pincha un globo. ¡Adivina la palabra antes de que la cesta llegue a la hierba!",
  rec: b => `${num(b.score)} de ${AD_N}`,
  start: adivina,
})) console.warn("[wordplay] no se pudo añadir «Adivina la palabra» a Juegos");
if(!reg(SP, {
  t: "Sopa de letras", sub: "Busca las palabras escondidas", img: "img/games/sopa.png",
  how: "Busca las palabras de la lista en las letras. Arrastra el dedo de la primera letra a la última, o toca la primera y luego la última. Van de lado y hacia abajo (en el ordenador, también en diagonal).",
  rec: b => `${num(b.score)} puntos`,
  start: sopa,
})) console.warn("[wordplay] no se pudo añadir «Sopa de letras» a Juegos");
if(!reg(CW, {
  t: "Crucigrama", sub: "Escribe las palabras cruzadas", img: "img/games/crucigrama.png",
  how: "Cada número tiene un dibujo. Toca una casilla o un dibujo y escribe la palabra con las letras de abajo. Si te atascas, «Pista» pone una letra.",
  rec: b => `${num(b.score)} puntos`,
  start: crucigrama,
})) console.warn("[wordplay] no se pudo añadir «Crucigrama» a Juegos");
})();
