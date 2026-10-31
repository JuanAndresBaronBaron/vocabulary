/* módulo simon: «El zorro dice», un juego de Juegos registrado con vocabGames.register (como js/topos.js).
   Ruta: #/juegos/zorrodice. Cuatro dibujos del tema elegido en Juegos (api.topicPool) y, arriba, el zorro con su
     bocadillo. El zorro da una orden: la voz del aparato dice el principio en el idioma («Touch the» / «Touche» /
     «Find», con sayP de index.html, que nunca elige la voz por su cuenta) y luego suena la palabra grabada con su
     artículo (el mp3 de audio/<ab>/: «dog», «le chien», «en hund»). Nada escrito hasta contestar: solo se escucha (el
     lector de pantalla oye el dibujo en español, como en Globos).
   Tres niveles seguidos en cada partida (9 rondas, 3 de cada):
     1. un dibujo («Touch the dog»);
     2. dos dibujos en orden («Touch the dog and the cat»; «and the» / «et» / «og», también con la voz). Tocar primero
        el segundo: ✗ un momento (después hace falta) y suena el primero;
     3. color y dibujo: los 4 dibujos son 2 cosas en 2 colores (la silueta pintada del color, con su sombreado) y el
        zorro dice «Touch the red dog» (inglés: color + palabra), «Touche le chien rouge» (francés: palabra + color;
        solo colores que suenan igual con «la»: nada de «vert/verte») o «Find en hund, der er rød» (danés: solo
        palabras con «en», así el adjetivo no cambia). Si el tema no tiene cosas que pintar (Colores, Países,
        Nacionalidades, Soldados…), el nivel 3 es otra vez el 2.
   Bien: ✓ verde azulado y se ve lo que dijo (la frase con las palabras en negrita, su IPA y el español). Mal: el dibujo
     en gris con ✗ (sin sonido triste) y suena el bueno, que late. Nadie pierde: la ronda sigue hasta tocar el bueno.
     Estrellas: rondas a la primera (8 ★★★, 5 ★★, si no ★).
   Teclas: 1-4 los dibujos (de izquierda a derecha y de arriba abajo), Espacio repite la orden. La pausa (Esc, ✕ o «?»)
     corta la voz y, al seguir, la orden vuelve a empezar.
   Palabras: con dibujo, que sean cosas (sin «to …», «se …», «at …») y que se puedan oír; si hay 4 o más con audio
     grabado, solo esas. Sin 4, el aviso de siempre. */
(() => {
"use strict";

const ID = "zorrodice", PLAN = [1, 1, 1, 2, 2, 2, 3, 3, 3], R = PLAN.length, FOX = "img/pj/zorro.png";
const IC = (n, s = "bold", z = 22, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
const RM = () => { try{ return !!(window.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const pic = src => (window.vocabGames && typeof vocabGames.pic === "function") ? vocabGames.pic(src) : src;
const mix = a => { const b = a.slice(); for(let i = b.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const AB = {english: "en", "français": "fr", dansk: "da"};
/* el principio de la orden y el «y» del nivel 2 (la voz del aparato) */
const FRAME = {english: "Touch the", "français": "Touche", dansk: "Find"};
const AND = {english: "and the", "français": "et", dansk: "og"};
const DA_IS = "der er";
/* en inglés, sin «the» delante: los colores y los países («Touch red», «Touch France») */
const BARE = new Set(["colores", "paises", "nacionalidades"]);
const NOPAINT = new Set(["colores", "paises", "nacionalidades", "militar"]);
const VERB = {english: /^to\s/i, "français": /^(?:se\s|s['’])/i, dansk: /^at\s/i};
/* los colores del nivel 3 (los mismos que el Cazador de colores) y su fila de data/colores.json */
const COLS = [
  {id: "red", es: "Rojo", n: "rojo", hex: "#E53935"},
  {id: "blue", es: "Azul", n: "azul", hex: "#1E88E5"},
  {id: "yellow", es: "Amarillo", n: "amarillo", hex: "#FDD835"},
  {id: "green", es: "Verde", n: "verde", hex: "#43A047"},
];
const frArt = w => { const m = /^(le|la|les|un|une|des)\s|^(l)['’]/i.exec(w); return m ? (m[1] || "l'").toLowerCase() : ""; };
/* ¿se puede decir esta palabra con ese color? Francés: que el color suene igual (rouge, jaune y bleu/bleue sí; vert/verte
   no) y sin plurales; con «l'» no se sabe si es femenina: solo los que se escriben igual. Danés: solo «en …» */
function colOk(L, w, c){
  if(L === "français"){
    const a = frArt(w);
    if(!a || a === "les" || a === "des") return false;
    if(a === "l'") return c.id === "red" || c.id === "yellow";
    if(a === "la" || a === "une") return c.id !== "green";
    return true;
  }
  if(L === "dansk") return /^en\s/i.test(w);
  return true;
}
/* cómo se escribe el color con esa palabra (francés: «la balle bleue») */
const colText = (L, w, cw) => L === "français" && /^(la|une)\s/i.test(w) && cw === "bleu" ? "bleue" : cw;

/* qué palabras tienen audio grabado (audio/<ab>.json, como el loro) */
const MAPS = {};
async function clipMap(ab){
  if(MAPS[ab]) return MAPS[ab];
  try{ const r = await fetch(`audio/${ab}.json`); if(!r.ok) throw new Error(r.status); const m = await r.json(); if(m && typeof m === "object") return (MAPS[ab] = m); }catch(e){}
  return {};
}
const voiceOk = () => { try{ return "speechSynthesis" in window && (!voices.length || langVoices(lang).length > 0); }catch(e){ return false; } };

const CSS = `
.zd{max-width:760px}
.zd .gm-top{margin-bottom:8px}
/* el zorro y su bocadillo */
.zd-head{display:flex;align-items:center;gap:12px;max-width:640px;margin:0 auto 12px}
.zd-fox{flex:none;width:clamp(66px,19vw,104px);height:auto;transform-origin:50% 100%;user-select:none;-webkit-user-drag:none}
.zd-fox.talk{animation:zd-talk .32s ease-in-out infinite alternate}
@keyframes zd-talk{to{transform:translateY(-3px) rotate(-2.5deg)}}
.zd-bub{position:relative;flex:1;min-width:0;display:flex;align-items:center;gap:12px;min-height:108px;padding:10px 14px 10px 12px;border-radius:22px;
  background:var(--card);color:var(--label);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.zd-bub::before{content:"";position:absolute;left:-7px;top:50%;width:16px;height:16px;margin-top:-8px;background:inherit;transform:rotate(45deg);border-radius:3px}
.zd-say{width:58px;height:58px}
.zd-txt{flex:1;min-width:0;margin:0;font:600 var(--fs-sub)/1.3 var(--f-text);color:var(--label2);overflow-wrap:anywhere}
.zd-txt .zd-s{display:block;color:var(--label);font:700 var(--fs-head)/1.25 var(--f-round)}
.zd-txt .zd-s b{color:var(--brand-ink);font-weight:900}
.zd-txt .zd-i{display:block;margin-top:3px;font:500 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.zd-txt .zd-i small{font:inherit;color:inherit}
.zd-lv{display:block;font:700 var(--fs-min)/1.2 var(--f-text);color:var(--label2);margin-bottom:2px}
/* los cuatro dibujos: 2 × 2 (o 4 en fila si así salen más grandes) */
.zd-grid{display:grid;grid-template-columns:repeat(var(--cols,2),var(--s,150px));gap:12px;justify-content:center;margin:0 auto}
.zd-c{position:relative;width:var(--s,150px);height:var(--h,var(--s,150px));margin:0;padding:0;border:3px solid transparent;border-radius:24px;background:var(--gm-tile,#fff);
  color:#111;display:grid;place-items:center;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;
  box-shadow:0 2px 0 rgba(0,0,0,.08),0 1px 5px rgba(0,0,0,.08);transition:transform .12s ease,border-color .15s,background-color .15s}
.zd-c:active{transform:scale(.97)}
.zd-c:focus-visible{outline:3px solid var(--brand-tint);outline-offset:3px}
.zd-c:disabled{cursor:default}
.zd-p{width:76%;height:min(76%,calc(var(--s,150px) * .76));display:grid;place-items:center;pointer-events:none}
.zd-p img{width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply;user-select:none;-webkit-user-drag:none}
.zd-p img.gm-flag{border-radius:8px;mix-blend-mode:normal;box-shadow:0 0 0 1px rgba(0,0,0,.12)}
/* nivel 3: la silueta del dibujo pintada con el color y, encima, el dibujo en gris claro (multiplica: el sombreado y el trazo) */
.zd-tint{position:relative;width:100%;height:100%;isolation:isolate}
.zd-sil{position:absolute;inset:0;-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center}
.zd-tint img{position:relative;filter:grayscale(1) brightness(1.5) contrast(1.15)}
.zd-c.is-ok{border-color:var(--teal);box-shadow:0 0 0 4px color-mix(in srgb,var(--teal) 30%,transparent)}
.zd-c.is-miss{border-color:#8e8e93;background:#e5e5ea}
.zd-c.is-miss .zd-p{opacity:.4;filter:grayscale(1)}
.zd-mk{position:absolute;right:-8px;top:-8px;display:none;width:34px;height:34px;border-radius:50%;place-items:center;color:#fff;box-shadow:0 0 0 3px var(--card)}
.zd-c.is-ok .zd-mk{display:grid;background:var(--teal)}
.zd-c.is-miss .zd-mk{display:grid;background:#8e8e93}
.zd-c.is-ok .zd-mk .x,.zd-c.is-miss .zd-mk .v{display:none}
/* el orden del nivel 2 (1 y 2, en dorado) */
.zd-n{position:absolute;left:-8px;top:-8px;display:none;width:32px;height:32px;border-radius:50%;place-items:center;background:var(--gold);color:#3D2B00;
  font:900 1rem/1 var(--f-round);box-shadow:0 0 0 3px var(--card)}
.zd-c.has-n .zd-n{display:grid}
/* la palabra, al contestar */
.zd-w{position:absolute;left:6px;right:6px;bottom:6px;display:none;padding:3px 6px;border-radius:12px;background:rgba(255,255,255,.94);color:#111;
  font:800 var(--fs-note)/1.2 var(--f-round);text-align:center;overflow-wrap:anywhere;pointer-events:none}
.zd-w .ipa{display:block;font:500 .82em/1.2 var(--f-text);color:#3a3a3c}
.zd-c.shown .zd-w{display:block}
/* el bueno, cuando suena después de un fallo */
.zd-c.is-hint{animation:zd-hint .8s ease-in-out 2}
@keyframes zd-hint{50%{transform:scale(1.05);box-shadow:0 0 0 7px color-mix(in srgb,var(--brand-tint) 40%,transparent)}}
.zd-k{position:absolute;left:9px;top:7px;display:none;padding:3px 6px;border-radius:7px;background:rgba(0,0,0,.08);color:#3a3a3c;font:700 .74rem/1 var(--f-text)}
@media (hover:hover) and (pointer:fine){.zd-k{display:block}.zd-c.has-n .zd-k{display:none}}
.zd .gm-dots{margin-top:14px}
@media (prefers-reduced-motion:reduce){.zd-fox.talk{animation:none}.zd-c.is-hint{animation:none;box-shadow:0 0 0 5px var(--brand-tint)}}
html[data-calm] .zd-fox.talk{animation:none}
`;
function css(){
  if(document.getElementById("css-simon")) return;
  const s = document.createElement("style"); s.id = "css-simon"; s.textContent = CSS; document.head.appendChild(s);
}
const imgHtml = it => {
  const src = pic(it.img), flag = it.doc === "paises" || it.doc === "nacionalidades";
  return `<img${flag ? ' class="gm-flag"' : ""} src="${esc(src)}" alt="" draggable="false"${src !== it.img ? ` data-f="${esc(it.img)}" onerror="if(this.dataset.f){this.src=this.dataset.f;delete this.dataset.f}"` : ""}>`;
};
/* el dibujo pintado (nivel 3): la máscara es el propio dibujo (sus partes transparentes quedan fuera) */
const tintHtml = (it, c) => { const u = esc(pic(it.img)); return `<span class="zd-tint"><span class="zd-sil" style="background:${c.hex};-webkit-mask-image:url('${u}');mask-image:url('${u}')"></span><img src="${u}" alt="" draggable="false"></span>`; };

async function start(app, api, mode){
  const my = api.nav();
  css();
  const L = lang, ab = AB[L] || "en", code = LANGS[L].code;
  const map = await clipMap(ab);
  if(!api.here(my, ID) || lang !== L) return;
  const has = w => !!map[speakable(w)];
  const canV = voiceOk();
  const base = x => x && x.img && typeof x.word === "string" && x.word.trim() && [...x.word].length <= 26 && !(VERB[L] || /^$/).test(x.word.trim());
  let TP = {P: []};
  try{ TP = await api.topicPool(ID, 4, x => base(x) && (has(x.word) || canV)); }catch(e){}
  if(!api.here(my, ID) || lang !== L) return;
  let P = TP.P;
  const withClip = P.filter(x => has(x.word));
  if(withClip.length >= 4) P = withClip;
  if(P.length < 4){
    app.innerHTML = `<div class="gm"><div class="gm-empty"><p>Este juego todavía no tiene palabras para oír en ${esc(api.nm())}.</p>
      <a class="glass-btn" href="#/juegos">${IC("caret-left", "bold", 18)}Juegos</a></div></div>`;
    return;
  }
  /* los colores del nivel 3 con su palabra (y que se oigan) */
  let COL = [];
  try{
    const doc = await getDoc("colores");
    COL = COLS.map(c => { const r = (doc.rows || []).find(x => x && x.es === c.es), l = r && r.l && r.l[L]; return l && l.word ? Object.assign({w: l.word, ipa: l.ipa || ""}, c) : null; })
      .filter(c => c && (has(c.w) || canV));
  }catch(e){ COL = []; }
  if(!api.here(my, ID) || lang !== L) return;
  const PAINT = P.filter(x => !NOPAINT.has(x.doc) && !/^data:/.test(x.img));
  /* dos cosas para pintar con dos colores que valgan para las dos (null si el tema no deja) */
  function paintPair(){
    for(const a of mix(PAINT)) for(const b of mix(PAINT)){
      if(a === b || a.img === b.img) continue;
      const cs = COL.filter(c => colOk(L, a.word, c) && colOk(L, b.word, c));
      if(cs.length >= 2) return {a, b, cs: mix(cs).slice(0, 2)};
    }
    return null;
  }
  const can3 = COL.length >= 2 && !!paintPair();
  const plan = PLAN.map(lv => lv === 3 && !can3 ? 2 : lv);

  const run = api.mount(app, `<div class="gm zd" id="zd">
    ${api.topHtml(ID, `<span class="gm-pill" title="Ronda">${IC("ear", "bold", 18)}<span><b id="zd-rd">1</b>/${R}</span></span><span class="gm-pill" title="A la primera">${IC("star", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`)}
    <div class="zd-head">
      <img class="zd-fox" id="zd-fox" src="${FOX}" alt="" width="104" height="90" draggable="false">
      <div class="zd-bub">
        <button type="button" class="gm-bigsay zd-say" id="zd-say" data-key="space" aria-label="Escuchar otra vez al zorro">${IC("speaker-high", "fill", 30)}</button>
        <p class="zd-txt" id="zd-txt" role="status" aria-live="polite"></p></div></div>
    <div class="zd-grid" id="zd-grid" role="group" aria-label="Los dibujos"></div>
    ${api.dotsHtml(R)}</div>`, mode);
  const root = run.root, grid = root.querySelector("#zd-grid"), fox = root.querySelector("#zd-fox"), txt = root.querySelector("#zd-txt");
  const sayB = root.querySelector("#zd-say");
  let ri = -1, Q = null, score = 0, done = false, seq = 0;
  const res = [], seen = new Map(), queue = [];
  const note = (it, miss) => { const o = seen.get(it.k) || {word: it.word, es: it.es, img: it.img, ipa: it.ipa, miss: false}; if(miss) o.miss = true; seen.set(it.k, o); };
  /* las palabras van saliendo todas antes de repetir */
  const nextWord = (not = []) => {
    if(!queue.length) queue.push(...mix(P));
    let i = queue.findIndex(x => !not.includes(x));
    if(i < 0){ queue.push(...mix(P)); i = queue.findIndex(x => !not.includes(x)); }
    return queue.splice(i, 1)[0];
  };
  const others = (n, not) => mix(P.filter(x => !not.includes(x) && !not.some(y => y.img === x.img || y.word.toLowerCase() === x.word.toLowerCase()))).slice(0, n);

  /* ---------- la orden ---------- */
  const frameFor = it => L === "english" && (BARE.has(it.doc) || /^(the|an?)\s/i.test(it.word) || /^[A-Z]/.test(it.word)) ? "Touch" : FRAME[L];
  /* en trozos: lo que dice la voz del aparato y las palabras (que suenan grabadas si tienen audio) */
  function partsOf(q){
    const [a, b] = q.items;
    if(q.lv === 3){
      if(L === "english") return [frameFor(a), q.col.w, a.word];
      if(L === "français") return [FRAME[L], a.word, q.col.w];
      return [FRAME[L], a.word, DA_IS, q.col.w];
    }
    if(!b) return [frameFor(a), a.word];
    const and = L === "english" ? (frameFor(b) === "Touch" ? "and" : AND[L]) : AND[L];
    return [frameFor(a), a.word, and, b.word];
  }
  /* lo que se ve al contestar: la frase con las palabras en negrita, su IPA y el español */
  function sentHtml(q){
    const B = s => `<b>${esc(s)}</b>`, [a, b] = q.items;
    let s;
    if(q.lv === 3){
      const cw = colText(L, a.word, q.col.w);
      s = L === "english" ? `${esc(q.parts[0])} ${B(cw + " " + a.word)}` : L === "français" ? `${esc(q.parts[0])} ${B(a.word + " " + cw)}` : `${esc(q.parts[0])} ${B(a.word)}, ${DA_IS} ${B(cw)}`;
    } else s = b ? `${esc(q.parts[0])} ${B(a.word)} ${esc(q.parts[2])} ${B(b.word)}` : `${esc(q.parts[0])} ${B(a.word)}`;
    const ipas = (q.lv === 3 ? (L === "english" ? [q.col.ipa, a.ipa] : [a.ipa, q.col.ipa]) : q.items.map(x => x.ipa)).filter(Boolean);
    const ip = typeof ipaHtml === "function" ? ipas.map(x => ipaHtml(x, code)).filter(Boolean).join(" ") : "";
    const es = q.lv === 3 ? `${a.es}, ${q.col.n}` : q.items.map(x => x.es).join(" → ");
    return `<span class="zd-s" lang="${esc(code)}">${s}</span><span class="zd-i">${ip ? ip + " · " : ""}<small lang="es">${esc(es)}</small></span>`;
  }
  const ask = q => q.lv === 2 ? "Escucha y toca los dos, en orden." : q.lv === 3 ? "Escucha el color y toca." : "Escucha al zorro y toca.";
  const LV = ["", "Nivel 1 · Un dibujo", "Nivel 2 · Dos en orden", "Nivel 3 · Color y dibujo"];
  const gate = () => new Promise(r => api.later(run, r, 0));
  function stopSeq(){ seq++; fox.classList.remove("talk"); sayB.classList.remove("playing"); }
  /* dice los trozos uno detrás de otro; la pausa corta la voz y, al seguir, vuelve a empezar */
  async function speakSeq(parts){
    const me = ++seq;
    fox.classList.add("talk"); sayB.classList.add("playing");
    for(let i = 0; i < parts.length; i++){
      if(me !== seq || !api.live(run)) return false;
      if(run.paused){ await gate(); i = -1; continue; }
      try{ await sayP(parts[i]); }catch(e){}
      if(me === seq && run.paused){ await gate(); i = -1; }
    }
    if(me === seq){ fox.classList.remove("talk"); sayB.classList.remove("playing"); }
    return me === seq;
  }
  /* lo que suena del bueno (sin el principio de la orden) */
  const cardParts = c => !c.col ? [c.it.word] : L === "english" ? [c.col.w, c.it.word] : L === "français" ? [c.it.word, c.col.w] : [c.it.word, DA_IS, c.col.w];

  /* ---------- rondas ---------- */
  function build(lv){
    if(lv === 3){
      const pp = paintPair();
      if(pp){
        const cards = mix([pp.a, pp.b].flatMap(it => pp.cs.map(col => ({it, col}))));
        const t = cards[Math.floor(Math.random() * 4)];
        return {lv, items: [t.it], col: t.col, cards, targets: [t]};
      }
      lv = 2;
    }
    const a = nextWord(), b = lv === 2 ? nextWord([a].concat(P.filter(x => x.img === a.img))) : null;
    const items = b ? [a, b] : [a];
    const cards = mix(items.concat(others(4 - items.length, items)).map(it => ({it, col: null})));
    return {lv, items, col: null, cards, targets: items.map(it => cards.find(c => c.it === it))};
  }
  function round(){
    ri++;
    Q = build(plan[ri]);
    Q.parts = partsOf(Q); Q.step = 0; Q.first = true; Q.over = false;
    Q.items.forEach(it => note(it, false));
    grid.innerHTML = Q.cards.map((c, k) => `<button type="button" class="zd-c" data-k="${k}" aria-label="${esc(c.col ? `${c.it.es}, ${c.col.n}` : c.it.es)}">
      <span class="zd-p">${c.col ? tintHtml(c.it, c.col) : imgHtml(c.it)}</span><span class="zd-w" aria-hidden="true"></span>
      <span class="zd-mk" aria-hidden="true">${IC("check", "bold", 20, "v")}${IC("x", "bold", 20, "x")}</span><span class="zd-n" aria-hidden="true"></span>
      <span class="zd-k" aria-hidden="true">${k + 1}</span></button>`).join("");
    Q.cards.forEach((c, k) => { c.el = grid.children[k]; });
    txt.innerHTML = `<span class="zd-lv">${esc(LV[Q.lv])}</span>${esc(ask(Q))}`;
    const rd = root.querySelector("#zd-rd"); if(rd) rd.textContent = ri + 1;
    dots();
    /* los audios de la ronda siguiente, ya pedidos */
    try{ const nx = plan[ri + 1]; if(nx) queue.slice(0, 2).forEach(it => { const id = map[speakable(it.word)]; if(id){ const a = new Audio(); a.preload = "auto"; a.src = `audio/${ab}/${id}.mp3`; } }); }catch(e){}
    api.later(run, () => speakSeq(Q.parts), 450);
  }
  const dots = () => root.querySelectorAll("#gm-dots i").forEach((d, i) => { d.className = i < res.length ? (res[i] ? "ok" : "meh") : i === ri ? "now" : ""; });
  function reveal(){
    for(const c of Q.targets){
      const w = c.el.querySelector(".zd-w"), word = c.col ? (L === "english" ? `${c.col.w} ${c.it.word}` : L === "français" ? `${c.it.word} ${colText(L, c.it.word, c.col.w)}` : `${c.it.word}, ${DA_IS} ${c.col.w}`) : c.it.word;
      w.innerHTML = `<span lang="${esc(code)}">${esc(word)}</span>${typeof ipaHtml === "function" && !c.col && c.it.ipa ? ipaHtml(c.it.ipa, code) : ""}`;
      c.el.classList.add("shown");
    }
    txt.innerHTML = sentHtml(Q);
  }
  function hint(c){
    Q.cards.forEach(x => x.el.classList.remove("is-hint"));
    void c.el.offsetWidth; c.el.classList.add("is-hint");
    api.later(run, () => c.el.classList.remove("is-hint"), 1700);
    speakSeq(cardParts(c));
  }
  function tap(k){
    if(!Q || Q.over || done || !api.live(run) || run.paused) return;
    const c = Q.cards[k]; if(!c || c.el.disabled || c.el.classList.contains("is-ok")) return;
    const want = Q.targets[Q.step];
    if(c === want){
      stopSeq();
      c.el.classList.remove("is-miss", "is-hint"); c.el.classList.add("is-ok");
      if(Q.targets.length > 1){ c.el.querySelector(".zd-n").textContent = Q.step + 1; c.el.classList.add("has-n"); }
      api.haptic("success");
      Q.step++;
      if(Q.step < Q.targets.length){ api.snd("pop"); speakSeq(cardParts(c)); return; }
      /* la ronda, hecha */
      Q.over = true;
      if(Q.first){ score++; api.answer(true, {es: Q.items[0].es, word: Q.items[0].word}); }
      res.push(Q.first);
      const sc = root.querySelector("#gm-sc"); if(sc){ sc.textContent = score; api.bump(sc.parentNode); }
      api.snd("ok");
      Q.cards.forEach(x => { if(!x.el.classList.contains("is-ok")) x.el.disabled = true; });
      reveal(); dots();
      api.later(run, () => speakSeq(cardParts(c)), 220);
      api.later(run, () => { if(ri + 1 < R) round(); else end(); }, 2600);
      return;
    }
    /* fallo: gris con ✗ y suena el bueno */
    if(Q.first){ Q.first = false; api.answer(false, {es: want.it.es, word: want.it.word}); }
    Q.items.forEach(it => { if(it === want.it) note(it, true); });
    api.snd("tap");
    c.el.classList.add("is-miss");
    if(Q.targets.includes(c)) api.later(run, () => c.el.classList.remove("is-miss"), 1100);   /* lo necesitará después */
    else { c.el.disabled = true; c.el.setAttribute("aria-label", c.el.getAttribute("aria-label") + " (no)"); }
    stopSeq();
    hint(want);
  }
  function end(){
    if(done) return;
    done = true; stopSeq();
    const stars = score >= 8 ? 3 : score >= 5 ? 2 : 1;
    api.finish(run, ID, {score, stars, words: [...seen.values()].sort((a, b) => b.miss - a.miss),
      line: score === R ? `¡Las ${R} a la primera! El zorro está muy contento.` : `¡${score} de ${R} a la primera!`});
  }
  grid.addEventListener("click", e => { const b = e.target.closest(".zd-c"); if(b) tap(+b.dataset.k); });
  sayB.onclick = () => { if(Q && !run.paused) speakSeq(Q.over ? cardParts(Q.targets[Q.targets.length - 1]) : Q.parts); };
  /* para las pruebas */
  root.zdState = () => Q && {ri, lv: Q.lv, parts: Q.parts.slice(), targets: Q.targets.map(t => Q.cards.indexOf(t)), step: Q.step, first: Q.first, over: Q.over,
    cards: Q.cards.map(c => ({word: c.it.word, es: c.it.es, col: c.col ? c.col.id : "", clip: has(c.it.word)})), score, plan: plan.slice()};

  /* el tamaño de los dibujos sale del hueco que queda (sin scroll): 2 × 2 o 4 en fila, lo que dé más grande */
  function fit(){
    if(!api.live(run) || !grid.isConnected) return;
    const W = root.clientWidth, top = grid.getBoundingClientRect().top + scrollY;
    const main = grid.closest("main"), pb = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 12;
    const dt = root.querySelector("#gm-dots"), dh = dt ? dt.offsetHeight + 16 : 24;
    const H = Math.max(190, innerHeight - top - pb - dh - 6), g = 12;
    let best = null;
    for(const [c, r] of [[2, 2], [4, 1]]){ const s = Math.floor(Math.min((W - g * (c - 1)) / c, (H - g * (r - 1)) / r, 230)); if(!best || s > best.s) best = {c, r, s}; }
    /* si sobra alto (el móvil de pie), las tarjetas crecen hacia abajo hasta 1,3 veces su ancho */
    const s = Math.max(96, best.s), h = Math.max(s, Math.min(Math.round(s * 1.3), Math.floor((H - g * (best.r - 1)) / best.r)));
    grid.style.setProperty("--cols", best.c);
    grid.style.setProperty("--s", s + "px"); grid.style.setProperty("--h", h + "px");
  }
  let fitT = 0;
  const refit = () => { fit(); clearTimeout(fitT); fitT = setTimeout(fit, 260); };
  addEventListener("resize", refit); run.clean.push(() => { removeEventListener("resize", refit); clearTimeout(fitT); stopSeq(); });
  refit(); requestAnimationFrame(refit);
  try{ document.fonts.ready.then(fit); }catch(e){}
  txt.innerHTML = `<span class="zd-lv">${esc(LV[1])}</span>Escucha al zorro y toca.`;
  api.intro(run, ID, () => {
    fit();
    round();
    api.keys(run, e => {
      const d = /^[1-4]$/.test(e.key) ? +e.key - 1 : -1;
      if(d >= 0){ e.preventDefault(); tap(d); return; }
      if(e.key === " " && !(e.target.closest && e.target.closest("button,a"))){ e.preventDefault(); sayB.click(); }
    });
  });
}

const reg = window.vocabGames && typeof vocabGames.register === "function" && vocabGames.register(ID, {
  t: "El zorro dice", sub: "Escucha y toca", img: "img/games/zorrodice.png", sec: "palabras",
  how: "El zorro te pide dibujos. ¡Escucha bien y tócalos en orden!",
  keys: "Con el teclado: 1 a 4 tocan los dibujos y Espacio repite.",
  topic: true,
  fresh: "2026-10-31",
  rec: b => `${Number.isFinite(+b.score) ? +b.score : 0} de ${R} a la primera`,
  start,
});
if(!reg) console.warn("[simon] no se pudo añadir a Juegos");
})();
