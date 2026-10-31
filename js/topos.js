/* módulo topos: «Topos», un juego de Juegos registrado con vocabGames.register (como js/flyer.js).
   Ruta: #/juegos/topos. Un prado con agujeros (3 × 3; en el celular 2 × 3 para que los topos se vean grandes); los
     topos asoman con una palabra del tema en un bocadillo y hay que golpear solo los buenos, como dice el letrero de
     arriba («Golpea los topos que…»). Dos clases de letrero, una y otra:
     · «dicen»: el dibujo y la palabra en español (y suena en el idioma); los buenos dicen esa palabra en el idioma.
     · «están bien escritos»: palabras del tema bien escritas o con una falta (una vocal cambiada, una letra doble o
       de menos o un error típico del idioma, como «mercredy»); los buenos, las bien escritas.
     Cada 3 topos buenos cambia el letrero. Golpe bueno: el topo se marea, +1 y suena la palabra (con su IPA en el
     letrero); 3 seguidos sin fallar hacen racha. De vez en cuando un topo bueno sale dorado: se esconde antes y vale 3. Golpe malo: ✗ en gris y se ve lo que era (la palabra en español o cómo se escribe bien), sin sonido
     triste; resta al final. Se toca el topo (o su agujero) o con las teclas 1-9 (de izquierda a derecha y de arriba
     abajo). 60 s; cada vez salen más deprisa y se esconden antes.
     Niveles (api.level, def.levels: ★★★ abre el siguiente): en el 2 y el 3 los topos salen y se esconden más deprisa
     y hay más topos malos (LV).
     Puntos = topos buenos (el dorado, 3) − malos. Estrellas: 15 ★★★, 8 ★★, si no ★.
   Las palabras son las del tema elegido en Juegos (api.topicPool, como Pajarito volador).
   Usa de games.js lo de los demás juegos: tarjeta del menú, récord, explicación la primera vez, «?», pausa (el reloj se
     para) y finish() (récord en "games:best".topos, monedas con award desde «+N»). */
(() => {
"use strict";

const ID = "topos", DUR0 = 60, NEED = 3, MAX_LEN = 18;
/* por nivel: sp, cuánto dura todo (asomar y esconderse; menos = más deprisa); ok, la probabilidad de un topo bueno */
const LV = {1: {sp: 1, ok: .42}, 2: {sp: .86, ok: .35}, 3: {sp: .74, ok: .29}};
const IC = (n, s = "bold", z = 22, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
const RM = () => { try{ return !!(window.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const pic = src => (window.vocabGames && typeof vocabGames.pic === "function") ? vocabGames.pic(src) : src;
const pick = a => a[Math.floor(Math.random() * a.length)];
const fits = x => x && typeof x.word === "string" && x.word.trim() && [...x.word].length <= MAX_LEN && typeof x.es === "string" && x.es.trim();

/* ---------- las faltas de ortografía ---------- */
const ARTS = {
  english: /^(?:the|an?|to)\s+/i,
  "français": /^(?:les|le|la|une|un|des|du|se)\s+|^(?:l|s|d)['’]/i,
  dansk: /^(?:en|et|at)\s+/i,
};
const VOW = "aeiouyéèêàâîôûæøå";
const VSW = {a: "e", e: "a", i: "e", o: "u", u: "o", y: "i", "é": "e", "è": "e", "ê": "e", "à": "a", "â": "a", "î": "i", "ô": "o", "û": "u", "æ": "e", "ø": "o", "å": "a"};
/* los errores típicos de cada idioma: [lo que se escribe, cómo se equivoca uno] */
const RULES = {
  english: [["ph", "f"], ["ck", "k"], ["ee", "ea"], ["ea", "ee"], ["oo", "u"], ["igh", "i"], ["ou", "ow"], ["wh", "w"], ["kn", "n"], ["c", "k"], ["s", "z"]],
  "français": [["é", "e"], ["è", "é"], ["ê", "è"], ["à", "a"], ["ç", "s"], ["eau", "o"], ["au", "o"], ["ai", "é"], ["qu", "k"], ["ph", "f"], ["ou", "u"], ["gn", "ni"], ["an", "en"], ["en", "an"], ["ss", "s"], ["i", "y"]],
  dansk: [["å", "aa"], ["æ", "e"], ["ø", "o"], ["ej", "aj"], ["sk", "sc"], ["j", "i"], ["v", "w"], ["k", "c"], ["d", "t"], ["g", "k"]],
};
/* las faltas posibles de una palabra suelta (sin tocar la primera letra si es mayúscula), con su peso. Sin cambiar
   dos letras de sitio: así salía a veces otra palabra de verdad («chien» → «chine») */
function variants(tok, L){
  const low = tok.toLowerCase(), n = tok.length, cap = tok[0] !== low[0], out = [];
  const isV = c => VOW.includes(c);
  for(const [x, y] of RULES[L] || []){
    const k = low.indexOf(x, cap ? 1 : 0);
    if(k >= 0) out.push({s: tok.slice(0, k) + y + tok.slice(k + x.length), w: 3});
  }
  for(let k = 1; k < n; k++){
    const c = low[k];
    if(VSW[c]) out.push({s: tok.slice(0, k) + VSW[c] + tok.slice(k + 1), w: 2});
    if(k + 1 < n && low[k + 1] === c) out.push({s: tok.slice(0, k) + tok.slice(k + 1), w: 3});
    else if(!isV(c) && low[k - 1] !== c && k < n - 1) out.push({s: tok.slice(0, k + 1) + tok[k] + tok.slice(k + 1), w: 1});
    if(n >= 5 && k < n - 1) out.push({s: tok.slice(0, k) + tok.slice(k + 1), w: 1});
  }
  return out;
}
/* hasta 4 faltas distintas de la palabra (en su palabra más larga, de 4 letras o más; el artículo se queda igual);
   nunca otra palabra del tema */
function misspell(word, L, known){
  const w = word.normalize("NFC"), m = w.match(ARTS[L] || /^$/), art = m && m[0] ? m[0] : "", base = w.slice(art.length);
  const parts = base.split(/([^\p{L}]+)/u);
  let ti = -1;
  parts.forEach((p, i) => { if(i % 2 === 0 && p.length >= 4 && (ti < 0 || p.length > parts[ti].length)) ti = i; });
  if(ti < 0) return [];
  const seen = new Set([w.toLowerCase()]), out = [];
  const cands = variants(parts[ti], L).map(v => ({s: art + parts.map((p, i) => i === ti ? v.s : p).join(""), r: Math.random() * v.w}))
    .sort((a, b) => b.r - a.r);
  for(const c of cands){
    const k = c.s.toLowerCase();
    if(seen.has(k) || known.has(k)) continue;
    seen.add(k); out.push(c.s);
    if(out.length >= 4) break;
  }
  return out;
}

/* ---------- dibujos (con el trazo negro de los demás dibujos de Juegos) ---------- */
const MOLE = `<svg class="tp-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
  <path d="M14 104 C10 62 22 22 50 20 C78 22 90 62 86 104Z" fill="#7a5a43" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M30 104 C28 78 38 62 50 62 C62 62 72 78 70 104Z" fill="#b8987a"/>
  <path d="M24 30 C26 8 74 8 76 30Z" fill="#F1B70E" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
  <path d="M18 31 H82" stroke="#000" stroke-width="5" stroke-linecap="round"/><path d="M19 31 H81" stroke="#F1B70E" stroke-width="2" stroke-linecap="round"/>
  <circle cx="50" cy="17" r="5" fill="#fff" stroke="#000" stroke-width="2.5"/>
  <g class="tp-eyes"><circle cx="38" cy="44" r="5" fill="#000"/><circle cx="62" cy="44" r="5" fill="#000"/>
    <circle cx="39.6" cy="42.4" r="1.7" fill="#fff"/><circle cx="63.6" cy="42.4" r="1.7" fill="#fff"/></g>
  <g class="tp-dizzy" stroke="#000" stroke-width="3" stroke-linecap="round"><path d="M33 39 l10 10 M43 39 l-10 10 M57 39 l10 10 M67 39 l-10 10"/></g>
  <ellipse cx="50" cy="56" rx="9.5" ry="6.5" fill="#2b1d14" stroke="#000" stroke-width="2"/>
  <path d="M45 65 H55 V72 H45Z" fill="#fff" stroke="#000" stroke-width="2" stroke-linejoin="round"/><path d="M50 65 V72" stroke="#000" stroke-width="1.6"/>
  <g fill="#b8987a" stroke="#000" stroke-width="2.5"><ellipse cx="31" cy="90" rx="10" ry="7"/><ellipse cx="69" cy="90" rx="10" ry="7"/></g>
  <path d="M25 86 v5 M30 85 v6 M35 86 v5 M65 86 v5 M70 85 v6 M75 86 v5" stroke="#000" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const MALLET = `<svg viewBox="0 0 60 60" aria-hidden="true" focusable="false"><rect x="26" y="24" width="7" height="33" rx="3.5" fill="#c08a52" stroke="#000" stroke-width="2.5"/>
  <rect x="6" y="6" width="48" height="21" rx="6" fill="#8a5a33" stroke="#000" stroke-width="3"/><rect x="9" y="9" width="8" height="15" rx="3" fill="#a8734a"/></svg>`;

const CSS = `
.tp{max-width:760px}
.tp .gm-top{margin-bottom:8px}
.tp .gm-tbar{margin-bottom:8px}
/* el letrero de madera: «Golpea los topos que…» y lo que se busca */
.tp-sign{position:relative;display:flex;align-items:center;gap:12px;min-height:80px;margin:0 auto 10px;max-width:600px;padding:8px 12px 8px 14px;
  border-radius:14px;background:linear-gradient(180deg,#d2a46c,#b9874f);border:3px solid #6e4b2a;color:#2a1a0c;
  box-shadow:0 4px 0 rgba(0,0,0,.2),inset 0 2px 0 rgba(255,255,255,.3)}
.tp-sign::before,.tp-sign::after{content:"";position:absolute;top:7px;width:7px;height:7px;border-radius:50%;background:#5b3d22;box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}
.tp-sign::before{left:7px}.tp-sign::after{right:7px}
.tp-sign.in{animation:tp-in .42s cubic-bezier(.2,.9,.3,1.3)}
@keyframes tp-in{0%{transform:translateY(-10px) rotate(-2.5deg);opacity:.3}100%{transform:none;opacity:1}}
.tp-pic{flex:none;width:clamp(58px,16vw,76px);aspect-ratio:1;border-radius:12px;background:var(--gm-tile,#fff);display:grid;place-items:center;overflow:hidden;
  box-shadow:0 0 0 2px #6e4b2a}
.tp-pic img{width:88%;height:88%;object-fit:contain;mix-blend-mode:multiply}
.tp-pic.okic{background:var(--teal);color:#fff}
.tp-pic:empty{display:none}
.tp-st{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.tp-lab{font:700 .9rem/1.2 var(--f-text)}   /* sin transparencia: con ella no llegaba a 4,5:1 en oscuro */
.tp-tg{font:900 clamp(1.45rem,6.4vw,2rem)/1.1 var(--f-round);overflow-wrap:anywhere}
.tp-ans{min-height:1.3em;font:700 1rem/1.3 var(--f-text);color:#123b16;overflow-wrap:anywhere;visibility:hidden}
.tp-ans.on{visibility:visible}
.tp-ans .ipa{font-weight:500;margin-left:.35em}
.tp-say{width:48px;height:48px;background:#6e4b2a}
.tp-say[hidden]{display:none}
[data-theme=dark] .tp-sign{background:linear-gradient(180deg,#8f6a42,#775432);border-color:#3f2a16;color:#fff6e8}
[data-theme=dark] .tp-ans{color:#c9f5cf}
[data-theme=dark] .tp-pic{box-shadow:0 0 0 2px #3f2a16}
/* el prado: 3 × 3 agujeros (2 × 3 en el celular) */
.tp-field{position:relative;display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:1fr;height:480px;border-radius:22px;overflow:hidden;
  touch-action:manipulation;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;isolation:isolate;
  background:radial-gradient(60% 18% at 22% 20%,rgba(255,255,255,.14),transparent 70%),radial-gradient(50% 16% at 78% 64%,rgba(255,255,255,.1),transparent 70%),
    linear-gradient(180deg,#93d27f 0%,#6cb85d 50%,#56a04c 100%)}
[data-theme=dark] .tp-field{background:linear-gradient(180deg,#336a3c 0%,#28562f 55%,#1f4526 100%)}
.tp-field.two{grid-template-columns:repeat(2,1fr)}
.tp-field.two .tp-cell:nth-child(n+7){display:none}
.tp-cell{position:relative;min-width:0;min-height:0;margin:0;padding:0;border:0;background:none;color:inherit;font:inherit;cursor:pointer;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;border-radius:18px}
.tp-cell:focus-visible{outline:3px solid #fff;outline-offset:-5px}
.tp-hole{position:absolute;left:50%;bottom:9%;width:calc(var(--mw) * 1.34);height:calc(var(--mw) * .44);transform:translateX(-50%);border-radius:50%;
  background:radial-gradient(ellipse at 50% 38%,#120c08 0 52%,#3b2a1c 100%);box-shadow:0 -2px 0 rgba(0,0,0,.18)}
/* el hueco por el que sube el topo: llega hasta el centro del agujero (por debajo, el topo no se ve) */
.tp-pit{position:absolute;left:0;right:0;top:0;bottom:calc(9% + var(--mw) * .22);overflow:hidden;pointer-events:none}
.tp-mole{position:absolute;left:0;right:0;bottom:calc(var(--mw) * -.06);display:flex;flex-direction:column;align-items:center;
  transform:translateY(calc(100% + 12px));transition:transform .2s cubic-bezier(.4,0,1,1)}
.tp-cell.up .tp-mole{transform:none;transition:transform .17s cubic-bezier(.2,.9,.3,1.2)}
.tp-svg{width:var(--mw);height:auto;display:block;flex:none;transform-origin:50% 100%}
.tp-dizzy{display:none}
/* el topo dorado */
.tp-cell.gold .tp-svg>path:first-child{fill:#d9a514}
.tp-cell.gold .tp-svg{filter:drop-shadow(0 0 8px rgba(255,214,0,.85))}
.tp-cell.gold .tp-bub{border-color:#946200;box-shadow:0 0 0 3px var(--gold)}
.tp-cell.hit .tp-eyes{display:none}
.tp-cell.hit .tp-dizzy{display:inline}
.tp-cell.hit .tp-svg{animation:tp-squash .3s ease-out}
@keyframes tp-squash{35%{transform:scale(1.12,.82)}100%{transform:none}}
/* el bocadillo con la palabra */
.tp-bub{position:relative;max-width:calc(100% - 8px);margin-bottom:9px;padding:4px 10px;border-radius:14px;background:#fff;color:#111;border:2.5px solid #1b1b1b;
  font:800 var(--bf,1.15rem)/1.15 var(--f-round);text-align:center;overflow-wrap:anywhere;box-shadow:0 3px 0 rgba(0,0,0,.18)}
.tp-bub::after{content:"";position:absolute;left:calc(50% - 7px);bottom:-9px;width:12px;height:12px;background:inherit;border:2.5px solid #1b1b1b;border-top:0;border-left:0;
  transform:rotate(45deg);border-radius:0 0 3px 0}
.tp-bub s{color:#6c6c70;text-decoration-thickness:2px;margin-right:.3em}
.tp-bub small{display:block;font:700 .78em/1.2 var(--f-text);color:#3a3a3c}
.tp-cell.good .tp-bub{border-color:var(--teal);background:#e3f6f8;box-shadow:0 0 0 3px var(--teal)}
.tp-cell.good .tp-bub::after{border-color:var(--teal)}
.tp-cell.bad .tp-bub{border-color:#8e8e93;background:#e5e5ea;color:#3a3a3c}
.tp-cell.bad .tp-bub::after{border-color:#8e8e93}
/* el montón de tierra delante del agujero */
.tp-rim{position:absolute;left:50%;bottom:calc(9% - var(--mw) * .07);width:calc(var(--mw) * 1.5);height:calc(var(--mw) * .29);transform:translateX(-50%);
  border-radius:0 0 50% 50% / 0 0 100% 100%;background:linear-gradient(180deg,#a47c54,#7a5a3c);box-shadow:inset 0 3px 0 rgba(255,255,255,.2);pointer-events:none}
[data-theme=dark] .tp-rim{background:linear-gradient(180deg,#7e5f40,#5c432c)}
/* la marca del golpe: ✓ turquesa o ✗ gris junto al topo (mientras el topo sigue arriba) */
.tp-mk{position:absolute;left:calc(50% + var(--mw) * .42);bottom:calc(9% + var(--mw) * .55);z-index:3;display:none;width:30px;height:30px;border-radius:50%;
  place-items:center;color:#fff;box-shadow:0 0 0 2.5px #fff}
.tp-cell.up.good .tp-mk{display:grid;background:var(--teal)}
.tp-cell.up.bad .tp-mk{display:grid;background:#8e8e93}
.tp-cell.good .tp-mk .x,.tp-cell.bad .tp-mk .v{display:none}
/* el mazo */
.tp-mallet{position:absolute;z-index:4;left:calc(50% + var(--mw) * .02);bottom:calc(9% + var(--mw) * .62);width:calc(var(--mw) * .78);pointer-events:none;
  transform-origin:72% 92%;animation:tp-whack .26s ease-out forwards}
.tp-mallet svg{display:block;width:100%;height:auto}
@keyframes tp-whack{0%{transform:rotate(50deg);opacity:0}25%{opacity:1}55%{transform:rotate(-28deg)}100%{transform:rotate(-18deg);opacity:0}}
.tp-k{position:absolute;left:6px;top:6px;display:none;padding:3px 6px;border-radius:7px;background:rgba(0,0,0,.26);color:#fff;font:700 .74rem/1 var(--f-text)}
@media (hover:hover) and (pointer:fine){.tp-k{display:block}}
.tp-field .gm-float{z-index:6}
@media (prefers-reduced-motion:reduce){.tp-cell .tp-mole,.tp-cell.up .tp-mole{transition-duration:.01s}.tp-mallet,.tp-cell.hit .tp-svg,.tp-sign.in{animation:none}}
`;
function css(){
  if(document.getElementById("css-topos")) return;
  const s = document.createElement("style"); s.id = "css-topos"; s.textContent = CSS; document.head.appendChild(s);
}
const bubFs = (w, narrow) => { const n = [...w].length, f = n <= 6 ? 1.25 : n <= 9 ? 1.12 : n <= 13 ? 1 : .9; return (narrow ? f * .94 : f).toFixed(2) + "rem"; };
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

async function start(app, api, mode){
  const my = api.nav();
  css();
  const L = lang;
  let TP = {P: []};
  try{ TP = await api.topicPool(ID, 6, fits); }catch(e){}
  if(!api.here(my, ID) || lang !== L) return;
  const P = TP.P;
  if(P.length < 6){
    app.innerHTML = `<div class="gm"><div class="gm-empty"><p>Este juego todavía no tiene palabras en ${esc(api.nm())}.</p>
      <a class="glass-btn" href="#/juegos">${IC("caret-left", "bold", 18)}Juegos</a></div></div>`;
    return;
  }
  const code = LANGS[L].code, DUR = Number(window.__toposDur) > 0 ? +window.__toposDur : DUR0;   /* __toposDur: solo para las pruebas */
  const lv = api.level(ID), K = LV[lv] || LV[1];
  /* las palabras para «bien escritos» (con al menos 2 faltas posibles); con menos de 4, solo hay letreros de «dicen» */
  const known = new Set(P.map(x => x.word.normalize("NFC").toLowerCase()));
  const SP = P.map(it => ({it, bad: misspell(it.word, L, known)})).filter(x => x.bad.length >= 2);
  const SPELL = SP.length >= 4;
  const MEAN = shuffle(P);
  MEAN.slice(0, 4).forEach(t => { const im = new Image(); im.src = pic(t.img); });
  /* el nombre del agujero: «Agujero N»; con un topo, «Topo:» (en español) y su palabra (con su idioma), por aria-labelledby */
  const cells = Array.from({length: 9}, (_, i) => `<button type="button" class="tp-cell" data-i="${i}" aria-label="Agujero ${i + 1}">
      <span class="vh" id="tp-c${i}" lang="es">Topo:</span>
      <span class="tp-hole"></span><span class="tp-pit"><span class="tp-mole"><span class="tp-bub" lang="${esc(code)}"><b id="tp-w${i}"></b></span>${MOLE}</span></span>
      <span class="tp-rim"></span><span class="tp-mk" aria-hidden="true">${IC("check", "bold", 18, "v")}${IC("x", "bold", 18, "x")}</span><span class="tp-k" aria-hidden="true">${i + 1}</span></button>`).join("");
  const run = api.mount(app, `<div class="gm tp" id="tp">
    ${api.topHtml(ID, `<span class="gm-pill" title="Tiempo">${IC("timer", "bold", 18)}<b id="tp-clock">${clock(DUR)}</b></span><span class="gm-pill" title="Puntos">${IC("star", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`)}
    <div class="gm-tbar" id="gm-tbar"><i id="gm-tb"></i></div>
    <div class="tp-sign" id="tp-sign" role="status">
      <span class="tp-pic" id="tp-pic"></span>
      <div class="tp-st"><span class="tp-lab" id="tp-lab">Golpea los topos que…</span><b class="tp-tg" id="tp-tg">¡Prepárate!</b><span class="tp-ans" id="tp-ans" lang="${esc(code)}"></span></div>
      <button type="button" class="gm-say tp-say" id="tp-say" aria-label="Escuchar la palabra" hidden>${IC("speaker-high", "fill", 24)}</button></div>
    <div class="tp-field" id="tp-field">${cells}</div></div>`, mode);
  const root = run.root, field = root.querySelector("#tp-field"), sign = root.querySelector("#tp-sign");
  root.tpWords = P.map(x => x.word); root.tpK = K;   /* para las pruebas */
  const picEl = root.querySelector("#tp-pic"), lab = root.querySelector("#tp-lab"), tg = root.querySelector("#tp-tg"), ans = root.querySelector("#tp-ans");
  const sayB = root.querySelector("#tp-say"), sc = root.querySelector("#gm-sc"), clk = root.querySelector("#tp-clock"), tb = root.querySelector("#gm-tb");
  const holes = [...field.querySelectorAll(".tp-cell")].map((el, i) => ({el, i, st: "down", it: null, ok: false, txt: "", until: 0, free: 0, bub: el.querySelector(".tp-bub b")}));
  let t = 0, last = 0, running = false, ended = false, spawnIn = .6, score = 0, good = 0, wrong = 0, streak = 0, R = null, ri = 0, mi = 0, lastT = 0, lastHole = -1, two = false, shownS = -1, lastGold = 0;
  const seen = new Map();   /* las palabras de la partida (para el resultado), con miss si hubo un golpe malo */
  const note = (it, miss) => { const o = seen.get(it.k) || {word: it.word, es: it.es, img: it.img, ipa: it.ipa, miss: false}; if(miss) o.miss = true; seen.set(it.k, o); };

  /* el prado llena lo que queda de pantalla; en pantallas estrechas, 2 columnas para que los topos se vean grandes */
  function fit(){
    const top = field.getBoundingClientRect().top + scrollY;
    const main = field.closest("main"), pb = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 12;
    field.style.height = Math.round(Math.max(270, Math.min(680, innerHeight - top - pb - 4))) + "px";
    const W = field.clientWidth, H = field.clientHeight;
    two = W < 560 && H > W * .9;
    field.classList.toggle("two", two);
    const cols = two ? 2 : 3, cw = W / cols, ch = H / 3;
    field.style.setProperty("--mw", Math.round(Math.max(48, Math.min(132, cw * .7, ch * .56))) + "px");
    holes.forEach(h => { if(h.i >= count() && h.st !== "down") down(h); });
    holes.forEach(h => { if(h.st !== "down") h.bub.parentNode.style.setProperty("--bf", bubFs(h.txt, cw < 140)); });
  }
  const count = () => two ? 6 : 9;
  const onR = () => fit();
  addEventListener("resize", onR); run.clean.push(() => removeEventListener("resize", onR));

  function setSign(){
    sign.classList.remove("in"); void sign.offsetWidth; if(!RM()) sign.classList.add("in");
    ans.classList.remove("on"); ans.innerHTML = "";
    if(R.type === "mean"){
      lab.textContent = "Golpea los topos que dicen:";
      tg.textContent = R.T.es;
      picEl.className = "tp-pic";
      picEl.innerHTML = R.T.img ? `<img src="${esc(pic(R.T.img))}" alt="" draggable="false"${pic(R.T.img) !== R.T.img ? ` data-f="${esc(R.T.img)}" onerror="if(this.dataset.f){this.src=this.dataset.f;delete this.dataset.f}"` : ""}>` : "";
      sayB.hidden = false;
    } else {
      lab.textContent = "Golpea los topos que están:";
      tg.textContent = "Bien escritos";
      picEl.className = "tp-pic okic";
      picEl.innerHTML = IC("check", "bold", 38);
      sayB.hidden = true;
    }
  }
  /* un letrero nuevo: «dicen» y «bien escritos», uno y otro (si el tema tiene palabras para los dos) */
  function nextRound(){
    ri++;
    const type = SPELL && ri % 2 === 0 ? "spell" : "mean";
    R = {type, T: type === "mean" ? MEAN[mi++ % MEAN.length] : null, got: 0, done: false, at: 0};
    if(R.T){ note(R.T, false); const nx = MEAN[mi % MEAN.length]; if(nx && nx.img){ const im = new Image(); im.src = pic(nx.img); } }
    holes.forEach(h => { if(h.st !== "down") down(h); });
    setSign();
    if(R.T) api.later(run, () => { if(R && R.T && !ended) api.speak(R.T.word); }, 260);
    lastT = t; spawnIn = .7;
  }
  function down(h){
    h.st = "down"; h.el.classList.remove("up");
    h.free = t + .4;
    h.el.removeAttribute("aria-labelledby");
  }
  /* asoma un topo: con la palabra buena (al menos uno cada 2,4 s) o con otra */
  function spawn(){
    const n = count(), free = holes.filter(h => h.i < n && h.st === "down" && t >= h.free);
    if(!free.length) return;
    const h = pick(free.length > 1 ? free.filter(x => x.i !== lastHole) : free);
    const ups = holes.filter(x => x.st !== "down"), okUp = ups.some(x => x.st === "up" && x.ok);
    const ok = (!okUp && t - lastT > 2.4) || Math.random() < (okUp ? .2 : K.ok);
    let it, txt;
    if(R.type === "mean"){
      const on = new Set(ups.map(x => x.it)), lw = R.T.word.toLowerCase();
      let o = P.filter(x => x !== R.T && !on.has(x) && x.word.toLowerCase() !== lw);
      if(!o.length) o = P.filter(x => x !== R.T);
      it = ok ? R.T : pick(o); txt = it.word;
    } else {
      const on = new Set(ups.map(x => x.it));
      let o = SP.filter(x => !on.has(x.it) && SP.indexOf(x) !== shownS);
      if(!o.length) o = SP;
      const s = pick(o); shownS = SP.indexOf(s);
      it = s.it; txt = ok ? it.word : pick(s.bad);
    }
    if(ok) lastT = t;
    /* el topo dorado: un bueno, como mucho uno cada 12 s, y más rápido */
    const gold = ok && t > 6 && t - lastGold > 12 && Math.random() < .35;
    if(gold) lastGold = t;
    Object.assign(h, {it, ok, txt, gold, st: "up", until: t + K.sp * (gold ? 1.15 : Math.max(1.2, 2.1 - .85 * t / DUR))});
    h.bub.textContent = txt;
    h.bub.parentNode.style.setProperty("--bf", bubFs(txt, field.clientWidth / (two ? 2 : 3) < 140));
    h.el.classList.remove("hit", "good", "bad");
    h.el.classList.toggle("gold", gold);
    h.el.tpOk = ok;   /* para las pruebas */
    h.el.classList.add("up");
    h.el.setAttribute("aria-labelledby", `tp-c${h.i} tp-w${h.i}`);
    lastHole = h.i;
  }
  function floatTxt(h, txt, bad){
    const f = document.createElement("div"), b = h.el.getBoundingClientRect(), fb = field.getBoundingClientRect();
    f.className = "gm-float" + (bad ? " bad" : "");
    f.textContent = txt; f.style.left = (b.left - fb.left + b.width / 2) + "px"; f.style.top = Math.max(6, b.top - fb.top + b.height * .12) + "px";
    field.appendChild(f); api.later(run, () => f.remove(), 1000);
  }
  function mallet(h){
    if(RM()) return;
    const m = document.createElement("span"); m.className = "tp-mallet"; m.innerHTML = MALLET;
    h.el.appendChild(m); setTimeout(() => m.remove(), 320);
  }
  function hit(h){
    if(!running || ended || !api.live(run) || run.paused || h.st !== "up") return;
    h.st = "hit"; h.until = t + .6;
    mallet(h);
    h.el.classList.add("hit", h.ok ? "good" : "bad");
    if(h.ok){
      const pts = h.gold ? 3 : 1;
      score += pts; good++; streak++; R.got++;
      api.answer(true, {es: h.it.es, word: h.it.word});
      api.snd("coin"); api.haptic("success");
      if(h.gold) api.later(run, () => api.snd("ok"), 120);
      sc.textContent = score; api.bump(sc.parentNode);
      floatTxt(h, h.gold ? "+3 ¡dorado!" : streak >= 3 ? `+1 · ¡racha ${streak}!` : "+1");
      if(h.gold) try{ if(window.M && typeof M.burst === "function" && !RM()) M.burst(h.el.querySelector(".tp-svg"), {n: 14}); }catch(e){}
      note(h.it, false);
      ans.innerHTML = `${esc(h.it.word)}${typeof ipaHtml === "function" && h.it.ipa ? ipaHtml(h.it.ipa, code) : ""}`;
      ans.classList.add("on");
      api.speak(h.it.word);
      if(R.got >= NEED){ R.done = true; R.at = t + .9; }
    } else {
      wrong++; streak = 0;
      api.answer(false, R.type === "mean" ? {es: R.T.es, word: R.T.word} : {es: h.it.es, word: h.it.word});
      api.snd("tap");
      if(R.type === "mean"){
        h.bub.innerHTML = `${esc(h.txt)}<small lang="es">${esc(h.it.es)}</small>`;
        floatTxt(h, "✗", true);
        note(R.T, true);
      } else {
        h.bub.innerHTML = `<s>${esc(h.txt)}</s>${esc(h.it.word)}`;
        h.until = t + 1.3;   /* un poco más, para leer cómo se escribe */
        floatTxt(h, "✗", true);
        note(h.it, true);
      }
    }
  }
  function end(){
    if(ended) return;
    ended = true; running = false;
    holes.forEach(h => { if(h.st !== "down") down(h); h.el.disabled = true; });
    field.insertAdjacentHTML("beforeend", `<div class="gm-over"><span>⏰</span>¡Se acabó el tiempo!</div>`);
    api.snd("whoosh");
    api.later(run, () => {
      const pts = Math.max(0, score - wrong), stars = pts >= 15 ? 3 : pts >= 8 ? 2 : 1;
      const words = [...seen.values()].sort((a, b) => b.miss - a.miss);
      api.finish(run, ID, {score: pts, stars, lv, words,
        line: !good ? "¡Casi! La próxima vez golpearás muchos topos buenos."
          : `¡${good} topo${good === 1 ? "" : "s"} bueno${good === 1 ? "" : "s"}${wrong ? ` y ${wrong} equivocado${wrong === 1 ? "" : "s"}` : ""}: ${pts} punto${pts === 1 ? "" : "s"}!`});
    }, 1500);
  }
  function frame(now){
    if(!api.live(run) || ended) return;
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    if(running && !document.hidden && !run.paused){
      t += dt;
      for(const h of holes) if(h.st !== "down" && t >= h.until) down(h);
      if(R.done){ if(t >= R.at) nextRound(); }
      else {
        spawnIn -= dt;
        const ups = holes.filter(h => h.st === "up").length;
        if(spawnIn <= 0 && ups < (t < (lv >= 3 ? 6 : 15) ? 2 : 3)){ spawn(); spawnIn = K.sp * Math.max(.55, 1.05 - .45 * t / DUR); }
      }
      const rem = Math.max(0, Math.ceil(DUR - t));
      if(clk.textContent !== clock(rem)) clk.textContent = clock(rem);
      tb.style.transform = `scaleX(${Math.max(0, 1 - t / DUR)})`;
      if(DUR - t < 10){ const b = root.querySelector("#gm-tbar"); if(b) b.classList.add("low"); }
      if(t >= DUR){ end(); return; }
    }
    run.raf = requestAnimationFrame(frame);
  }
  holes.forEach(h => {
    h.el.addEventListener("pointerdown", e => { if(e.button > 0) return; e.preventDefault(); hit(h); });
    h.el.addEventListener("click", e => { if(e.detail === 0) hit(h); });   /* Enter o Espacio con el agujero enfocado */
  });
  sayB.onclick = () => { if(R && R.T) api.speak(R.T.word); };
  fit();
  requestAnimationFrame(fit); api.later(run, fit, 280);
  api.intro(run, ID, () => {
    fit();
    nextRound();
    running = true; last = performance.now();
    run.raf = requestAnimationFrame(frame);
    api.keys(run, e => {
      const d = /^[1-9]$/.test(e.key) ? +e.key - 1 : -1;
      if(d >= 0 && d < count()){ e.preventDefault(); hit(holes[d]); }
    });
  });
}

const reg = window.vocabGames && typeof vocabGames.register === "function" && vocabGames.register(ID, {
  t: "Topos", sub: "Golpea los topos buenos", img: "img/games/topos.png",
  how: "Lee el letrero y golpea solo los topos buenos. ¡Cuidado con los otros!",
  keys: "Con el teclado: las teclas 1 a 9 golpean cada agujero.",
  topic: true,
  levels: true,
  fresh: true,
  rec: b => `${Number.isFinite(+b.score) ? +b.score : 0} puntos`,
  start,
});
if(!reg) console.warn("[topos] no se pudo añadir a Juegos");
})();
