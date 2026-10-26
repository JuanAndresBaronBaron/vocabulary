/* módulo flyer: «Pajarito volador», un juego de Juegos registrado con vocabGames.register (como js/lince.js).
   Ruta: #/juegos/pajarito. El pajarito vuela por una calle de una ciudad del idioma (inglés: Londres, francés: París,
     danés: Copenhague, dibujos img/games/vuelo-<en|fr|da>.jpg). Arriba sale una palabra en español con su dibujo; por
     la calle llegan 3 puertas con palabras en el idioma y el niño lleva el pajarito a la buena: tocando la puerta o
     su carril, deslizando a los lados o con ← → (1 2 3). Al pasar suena la palabra y se ve con su IPA.
     Acierto: la puerta en verde, una moneda más y chispas. Fallo: se pierde un corazón (3), la buena se pone verde y
     suena (sin sonido triste). Cada 5 aciertos sube de nivel y las puertas llegan más deprisa.
     Acaba a las 15 palabras o sin corazones. Estrellas por aciertos (13+ ★★★, 9+ ★★, si no ★).
   Usa de games.js lo de los demás juegos: tarjeta del menú, récord, explicación la primera vez, «?», pausa (el
     reloj del juego se para) y finish() (récord en "games:best".pajarito, monedas con award desde «+N»).
   Datos: data/party.json (words {id: {es, img, english|français|dansk: [palabra, IPA]}}), el mismo de js/party.js.
   No guarda nada propio. */
(() => {
"use strict";

const ID = "pajarito", ROUNDS = 15, LIVES = 3, PER_LEVEL = 5, MAX_LEN = 16;
const Z_FAR = 5;                       /* la profundidad donde nacen las puertas (1 = a la altura del pajarito) */
const SPEED = [5.2, 4.4, 3.7, 3.2];    /* segundos que tarda una fila de puertas en llegar, por nivel */
const IC = (n, s = "bold", z = 22, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
const RM = () => { try{ return !!(window.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const SCENES = {
  english:   {img: "img/games/vuelo-en.jpg", city: "Londres", vy: .325},
  "français": {img: "img/games/vuelo-fr.jpg", city: "París", vy: .29},
  dansk:     {img: "img/games/vuelo-da.jpg", city: "Copenhague", vy: .31},
};
const IMG_AR = 768 / 1152;             /* ancho/alto de los dibujos de las ciudades */
/* el pajarito (dibujo propio, con el trazo negro de los demás dibujos de Juegos) */
const BIRD = `<svg viewBox="0 0 120 100" aria-hidden="true" focusable="false">
  <g class="fl-wl"><path d="M30 52 C10 40 2 46 4 56 C6 66 20 68 34 62Z" fill="#F1B70E" stroke="#000" stroke-width="3" stroke-linejoin="round"/></g>
  <g class="fl-wr"><path d="M90 52 C110 40 118 46 116 56 C114 66 100 68 86 62Z" fill="#F1B70E" stroke="#000" stroke-width="3" stroke-linejoin="round"/></g>
  <path d="M52 16 C54 6 62 4 60 14 C66 6 72 10 64 18Z" fill="#F1B70E" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
  <ellipse cx="60" cy="54" rx="32" ry="34" fill="#FCD34D" stroke="#000" stroke-width="3"/>
  <ellipse cx="60" cy="66" rx="18" ry="16" fill="#FDE68A"/>
  <circle cx="48" cy="46" r="5" fill="#000"/><circle cx="72" cy="46" r="5" fill="#000"/>
  <circle cx="49.6" cy="44.4" r="1.6" fill="#fff"/><circle cx="73.6" cy="44.4" r="1.6" fill="#fff"/>
  <path d="M53 56 L67 56 L60 66Z" fill="#F59E0B" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
  <path d="M50 88 l-4 8 M56 89 l0 8 M70 88 l4 8 M64 89 l0 8" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/></svg>`;

let DATA = null;
function load(){
  if(!DATA) DATA = fetch("data/party.json").then(r => { if(!r.ok) throw new Error("data/party.json " + r.status); return r.json(); })
    .catch(e => { DATA = null; throw e; });
  return DATA;
}
const pic = src => (window.vocabGames && typeof vocabGames.pic === "function") ? vocabGames.pic(src) : src;
/* las palabras del idioma: con dibujo y cortas (que quepan en una puerta) */
function wordsOf(D, L){
  const out = [], seen = new Set();
  for(const [id, x] of Object.entries((D && D.words) || {})){
    const l = x && x[L];
    if(!l || typeof l[0] !== "string" || typeof x.es !== "string") continue;
    const w = l[0].trim(), es = x.es.trim();
    if(!w || !es || [...w].length > MAX_LEN || seen.has(w.toLowerCase()) || seen.has("es:" + es.toLowerCase())) continue;
    seen.add(w.toLowerCase()); seen.add("es:" + es.toLowerCase());
    out.push({id, es, word: w, ipa: l[1] || "", img: typeof x.img === "string" && /^img\/[\w.\-\/]+\.png$/.test(x.img) ? x.img : null});
  }
  return out;
}
const gateFs = w => { const n = [...w].length; return n <= 6 ? 1.3 : n <= 9 ? 1.12 : n <= 12 ? .98 : .86; };

const CSS = `
.fl{max-width:720px}
.fl .gm-top{margin-bottom:8px}
.fl-stage{position:relative;overflow:hidden;border-radius:var(--r-card,22px);height:440px;
  background:#5b9bd5 linear-gradient(#3d7cc9,#8cc4ef 55%,#9fb6c9);background-size:cover;background-position:center top;
  touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:pointer;isolation:isolate}
.fl-stage::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:linear-gradient(rgba(11,37,69,.18),transparent 30%,transparent 70%,rgba(11,37,69,.22))}
/* la calle: un trapecio desde el punto de fuga hasta abajo */
.fl-road{position:absolute;inset:0;z-index:1;pointer-events:none;background:rgba(26,158,148,.30);
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.35)}
.fl-puff{position:absolute;left:0;top:0;z-index:2;width:40px;height:24px;margin:-12px 0 0 -20px;pointer-events:none;
  background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 24'%3E%3Cpath d='M8 22a7 7 0 0 1 0-14 9 9 0 0 1 17-3 7 7 0 0 1 8 6 6 6 0 0 1-1 11Z' fill='%23fff'/%3E%3C/svg%3E") center/contain no-repeat}
/* la palabra que hay que traducir */
.fl-card{display:flex;align-items:center;gap:12px;padding:10px 14px;margin:0 0 10px;border-radius:20px;
  background:var(--card,#fff);color:var(--label,#0b2545);box-shadow:0 1px 3px rgba(0,0,0,.06),inset 0 0 0 2px var(--sep,#e5e7eb)}
.fl-card .fl-pic{flex:none;width:clamp(64px,18vw,92px);aspect-ratio:1;border-radius:14px;background:var(--gm-tile,#fff);display:grid;place-items:center}
.fl-card .fl-pic img{width:90%;height:90%;object-fit:contain;mix-blend-mode:multiply}
.fl-card .fl-pic:empty{display:none}
.fl-txt{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.fl-lab{font:800 .78rem/1.2 var(--f-round);letter-spacing:.06em;text-transform:uppercase;color:var(--brand-tint,#1f5fbf)}
.fl-es{font:800 clamp(1.7rem,7.5vw,2.4rem)/1.1 var(--f-round);overflow-wrap:anywhere}
.fl-ans{min-height:1.4em;font:700 1.05rem/1.3 var(--f-text);color:var(--ok-ink,#1a7f4b);overflow-wrap:anywhere;visibility:hidden}
.fl-ans.on{visibility:visible}
.fl-ans .ipa{font-weight:500;margin-left:.35em}
/* las puertas: una pastilla con la palabra encima de dos postes */
.fl-gate{position:absolute;left:0;top:0;z-index:4;display:flex;flex-direction:column;align-items:center;transform-origin:50% 100%;will-change:transform,opacity;cursor:pointer}
.fl-gate b{display:block;padding:10px 16px;border-radius:999px;background:#0b2545;color:#fff;font:800 1.2rem/1.1 var(--f-round);white-space:nowrap;
  box-shadow:0 0 0 3px rgba(255,255,255,.9),0 6px 14px rgba(0,0,0,.3);transition:background-color .2s,color .2s}
.fl-gate i{display:block;width:calc(100% - 26px);height:46px;margin-top:-2px;border:6px solid rgba(255,255,255,.88);border-top:0;border-radius:0 0 8px 8px}
.fl-gate.ok b{background:#2b9a55}
.fl-gate.ok i{border-color:#7fe0a3}
.fl-gate.no b{background:#6b7280;color:#e5e7eb}
.fl-gate.no{opacity:.7}
/* el pajarito */
.fl-bird{position:absolute;left:0;top:0;z-index:5;width:clamp(96px,26vw,128px);margin-left:calc(clamp(96px,26vw,128px) / -2);pointer-events:none;
  transition:transform .2s cubic-bezier(.3,.7,.4,1);filter:drop-shadow(0 10px 8px rgba(0,0,0,.25))}
.fl-bird svg{display:block;width:100%;height:auto;animation:fl-bob 1.1s ease-in-out infinite}
.fl-wl,.fl-wr{transform-box:fill-box;animation:fl-flap .32s ease-in-out infinite alternate}
.fl-wl{transform-origin:100% 50%}.fl-wr{transform-origin:0 50%}
@keyframes fl-flap{to{transform:rotate(-22deg) scaleY(.8)}}
.fl-wr{animation-name:fl-flapr}@keyframes fl-flapr{to{transform:rotate(22deg) scaleY(.8)}}
@keyframes fl-bob{50%{transform:translateY(-5px)}}
.fl-paused .fl-bird svg,.fl-paused .fl-wl,.fl-paused .fl-wr{animation-play-state:paused}
.fl-arrow{position:absolute;z-index:3;bottom:calc(var(--safe-b,0px) + 10px);width:52px;height:52px;border:0;border-radius:50%;display:grid;place-items:center;
  background:rgba(11,37,69,.55);color:#fff;cursor:pointer}
.fl-arrow.l{left:12px}.fl-arrow.r{right:12px}
.fl-arrow:focus-visible{outline:3px solid #fff;outline-offset:2px}
.fl-lvl{position:absolute;z-index:7;left:50%;top:44%;transform:translate(-50%,-50%) scale(.6);opacity:0;padding:14px 26px;border-radius:999px;
  background:#0b2545;color:#ffd34d;font:800 1.8rem/1 var(--f-round);box-shadow:0 0 0 4px #fff,0 10px 24px rgba(0,0,0,.3);pointer-events:none;
  transition:transform .3s cubic-bezier(.3,1.5,.5,1),opacity .3s}
.fl-lvl.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
.fl-lvp{position:absolute;z-index:3;left:10px;top:10px;display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:999px;
  background:rgba(11,37,69,.72);color:#fff;font:800 .95rem/1 var(--f-round);pointer-events:none}
.fl-lvp .ico{color:#ffd34d}
.fl-plus{position:absolute;z-index:6;pointer-events:none;font:800 1.4rem/1 var(--f-round);color:#ffd34d;text-shadow:0 2px 4px rgba(0,0,0,.4);
  animation:fl-up .9s ease-out forwards}
@keyframes fl-up{to{transform:translateY(-70px);opacity:0}}
@media (prefers-reduced-motion: reduce){.fl-bird{transition:none}.fl-bird svg,.fl-wl,.fl-wr{animation:none}.fl-plus{animation-duration:.01s}.fl-lvl{transition:none}}`;
function css(){
  if(document.getElementById("css-flyer")) return;
  const s = document.createElement("style"); s.id = "css-flyer"; s.textContent = CSS; document.head.appendChild(s);
}

async function start(app, api, mode){
  const my = api.nav();
  css();
  let D = null;
  try{ D = await load(); }catch(e){ D = null; }
  if(!api.here(my, ID)) return;
  const L = lang, P = wordsOf(D, L);
  if(P.length < 12){
    app.innerHTML = `<div class="gm"><div class="gm-empty"><p>Este juego todavía no tiene palabras en ${esc(api.nm())}.</p>
      <a class="glass-btn" href="#/juegos">${IC("caret-left", "bold", 18)}Juegos</a></div></div>`;
    return;
  }
  const code = LANGS[L].code, scene = SCENES[L] || SCENES.english;
  /* las rondas: 15 palabras distintas (con dibujo primero) y 2 puertas falsas para cada una */
  const pool = shuffle(P.filter(x => x.img)).concat(shuffle(P.filter(x => !x.img)));
  const rounds = pool.slice(0, ROUNDS).map(t => {
    const others = shuffle(P.filter(x => x !== t && x.word.toLowerCase() !== t.word.toLowerCase())).slice(0, 2);
    const opts = shuffle([t, ...others]);
    return {t, opts, ok: opts.indexOf(t)};
  });
  rounds.slice(0, 4).forEach(r => { if(r.t.img){ const im = new Image(); im.src = pic(r.t.img); } });
  const run = api.mount(app, `<div class="gm fl" id="fl">
    ${api.topHtml(ID, `<span class="gm-pill gm-lives" id="gm-lives" role="img" aria-label="${LIVES} vidas">${`<i>${IC("heart", "fill", 18)}${IC("heart", "bold", 18)}</i>`.repeat(LIVES)}</span><span class="gm-pill" title="Monedas">${IC("coin", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`)}
    <div class="fl-card" aria-live="polite"><span class="fl-pic" id="fl-pic"></span>
      <div class="fl-txt"><span class="fl-lab">Vuela a la puerta de…</span><span class="fl-es" id="fl-es"></span><span class="fl-ans" id="fl-ans" lang="${esc(code)}"></span></div></div>
    <div class="fl-stage" id="fl-stage" style="background-image:url('${esc(scene.img)}')" aria-label="La calle de ${esc(scene.city)}">
      <div class="fl-road" id="fl-road"></div>
      <div class="fl-bird" id="fl-bird">${BIRD}</div>
      <button type="button" class="fl-arrow l" id="fl-l" aria-label="A la izquierda">${IC("caret-left", "bold", 28)}</button>
      <button type="button" class="fl-arrow r" id="fl-r" aria-label="A la derecha">${IC("caret-right", "bold", 28)}</button>
      <div class="fl-lvl" id="fl-lvlb" aria-hidden="true"></div>
      <span class="fl-lvp" title="Nivel">${IC("lightning", "fill", 16)}Nivel <b id="fl-lv">1</b></span>
    </div></div>`, mode);
  const root = run.root, stage = root.querySelector("#fl-stage"), road = root.querySelector("#fl-road"), bird = root.querySelector("#fl-bird");
  const esEl = root.querySelector("#fl-es"), picEl = root.querySelector("#fl-pic"), ans = root.querySelector("#fl-ans");
  let W = 0, H = 0, VY = 0, BY = 0, GAP = 0;
  let r = 0, lane = 1, z = Z_FAR, phase = "wait", score = 0, lives = LIVES, level = 1, hits = 0, started = false, last = 0, gates = [], ended = false;
  const res = [], puffs = [];
  const live = () => api.live(run);
  /* la proyección: profundidad z → escala, y la altura en la calle */
  const proj = zz => { const s = 1 / zz, f = (s - 1 / Z_FAR) / (1 - 1 / Z_FAR); return {s: .32 + .68 * s * (1 - .1 * (1 - f)), y: VY + (BY - VY) * f}; };
  const laneX = (i, s) => W / 2 + (i - 1) * GAP * s;
  function measure(){
    /* la calle llena lo que queda de pantalla (sin pasar de 900 px ni bajar de 380) */
    const t0 = stage.getBoundingClientRect().top, sb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-b")) || 0;
    stage.style.height = Math.round(Math.max(380, Math.min(900, innerHeight - t0 - 12 - sb))) + "px";
    const b = stage.getBoundingClientRect(); W = b.width; H = b.height;
    /* el horizonte del dibujo (background-size: cover, arriba y centrado) */
    const sc = Math.max(W / IMG_AR, H);
    VY = Math.max(40, sc * scene.vy);
    BY = H - Math.max(110, H * .16);
    GAP = Math.min(W * .32, 170);
    const top = GAP * .32 * 1.6, bot = GAP * 1.75, yb = H;
    road.style.clipPath = `polygon(${W / 2 - top}px ${VY - 10}px,${W / 2 + top}px ${VY - 10}px,${W / 2 + bot * 1.25}px ${yb}px,${W / 2 - bot * 1.25}px ${yb}px)`;
    placeBird(true);
    draw();
  }
  function placeBird(now){
    if(now) bird.style.transition = "none";
    bird.style.transform = `translate(${laneX(lane, 1)}px,${BY - bird.offsetHeight * .62}px)`;
    if(now){ void bird.offsetWidth; bird.style.transition = ""; }
  }
  function move(to){
    if(!started || ended || !live() || run.paused) return;
    to = Math.max(0, Math.min(2, to));
    if(to === lane) return;
    lane = to; placeBird(false); api.haptic("selection");
  }
  /* nubecitas a los lados que pasan de lejos a cerca: dan sensación de velocidad */
  for(let i = 0; i < 6; i++){
    const el = document.createElement("i"); el.className = "fl-puff"; stage.insertBefore(el, bird);
    puffs.push({el, side: i % 2 ? 1 : -1, z: 1 + (Z_FAR - 1) * (i / 6), k: 1.9 + (i % 3) * .25});
  }
  function draw(){
    const p = proj(Math.max(.55, z));
    gates.forEach((g, i) => {
      const x = laneX(i, p.s);
      const o = z < 1 ? Math.max(0, (z - .55) / .45) : Math.min(1, (Z_FAR - z) / .5 + .15);
      g.style.transform = `translate(${x}px,${p.y}px) translate(-50%,-100%) scale(${p.s})`;
      g.style.opacity = o;
      g.style.zIndex = 4;
    });
    for(const f of puffs){
      const q = proj(f.z);
      f.el.style.transform = `translate(${W / 2 + f.side * GAP * f.k * q.s}px,${q.y}px) scale(${q.s * 1.4})`;
      f.el.style.opacity = (f.z < 1.2 ? Math.max(0, (f.z - .7) / .5) : f.z > Z_FAR - .6 ? (Z_FAR - f.z) / .6 : 1) * .8;
    }
  }
  function round(){
    if(!live()) return;
    const R = rounds[r];
    phase = "fly"; z = Z_FAR;
    esEl.textContent = R.t.es;
    picEl.innerHTML = R.t.img ? `<img src="${esc(pic(R.t.img))}" alt="" draggable="false"${pic(R.t.img) !== R.t.img ? ` data-f="${esc(R.t.img)}" onerror="if(this.dataset.f){this.src=this.dataset.f;delete this.dataset.f}"` : ""}>` : "";
    ans.classList.remove("on"); ans.innerHTML = "";
    gates.forEach(g => g.remove());
    gates = R.opts.map((x, i) => {
      const g = document.createElement("div");
      g.className = "fl-gate"; g.dataset.i = i;
      g.innerHTML = `<b lang="${esc(code)}" style="font-size:${gateFs(x.word)}rem">${esc(x.word)}</b><i></i>`;
      stage.insertBefore(g, bird);
      return g;
    });
    const nx = rounds[r + 1]; if(nx && nx.t.img){ const im = new Image(); im.src = pic(nx.t.img); }
    draw();
  }
  function resolve(){
    phase = "pass";
    const R = rounds[r], ok = lane === R.ok;
    res.push(ok);
    try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch(e){}
    api.answer(ok, {es: R.t.es, word: R.t.word});
    gates[R.ok].classList.add("ok");
    gates.forEach((g, i) => { if(i !== R.ok) g.classList.add("no"); });
    ans.innerHTML = `${esc(R.t.word)}${ipaOn() && R.t.ipa ? ipaHtml(R.t.ipa, code) : ""}`;
    ans.classList.add("on");
    try{ say(R.t.word); }catch(e){}
    if(ok){
      score++; hits++;
      api.snd("coin"); api.haptic("success");
      const sc = root.querySelector("#gm-sc"); if(sc){ sc.textContent = score; api.bump(sc.parentNode); }
      const pl = document.createElement("span"); pl.className = "fl-plus"; pl.textContent = "+1";
      pl.style.left = (laneX(lane, 1) - 14) + "px"; pl.style.top = (BY - bird.offsetHeight) + "px";
      stage.appendChild(pl); setTimeout(() => pl.remove(), 1000);
      try{ if(window.M && typeof M.burst === "function" && !RM()) M.burst(bird, {n: 10}); }catch(e){}
    } else {
      lives--;
      const Lv = root.querySelector("#gm-lives");
      if(Lv){ const h = Lv.querySelectorAll("i")[lives]; if(h) h.classList.add("lost", "hurt"); Lv.setAttribute("aria-label", lives === 1 ? "1 vida" : `${Math.max(0, lives)} vidas`); }
    }
    api.later(run, after, ok ? 1100 : 1900);
  }
  function after(){
    if(!live() || ended) return;
    r++;
    if(lives <= 0 || r >= ROUNDS){ end(); return; }
    if(res[res.length - 1] && hits % PER_LEVEL === 0 && level < SPEED.length + 2){
      level++;
      const lv = root.querySelector("#fl-lv"); if(lv){ lv.textContent = level; api.bump(lv.parentNode); }
      const b = root.querySelector("#fl-lvlb"); b.textContent = `¡Nivel ${level}!`; b.classList.add("on");
      api.snd("whoosh");
      phase = "wait";
      api.later(run, () => { b.classList.remove("on"); round(); }, 1100);
      return;
    }
    round();
  }
  function end(){
    ended = true; phase = "wait";
    const stars = score >= 13 ? 3 : score >= 9 ? 2 : 1;
    const seen = new Set(), words = [];
    rounds.slice(0, res.length).forEach((o, i) => { if(!seen.has(o.t.word)){ seen.add(o.t.word); words.push({word: o.t.word, es: o.t.es, img: o.t.img, miss: !res[i]}); } });
    api.finish(run, ID, {score, stars, words: words.sort((a, b) => b.miss - a.miss),
      line: lives <= 0 ? `¡Pasaste ${score} puerta${score === 1 ? "" : "s"} por ${scene.city}! La próxima llegas más lejos.`
        : score === ROUNDS ? `¡Las ${ROUNDS} puertas! Eres el rey del cielo de ${scene.city}.` : `¡Pasaste ${score} de ${ROUNDS} puertas por ${scene.city}!`});
  }
  function frame(now){
    if(!live() || ended) return;
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    const on = started && !document.hidden && !run.paused;
    root.classList.toggle("fl-paused", !on);
    if(on){
      const sp = (Z_FAR - 1) / SPEED[Math.min(level, SPEED.length) - 1];
      for(const f of puffs){ f.z -= dt * sp * 1.1; if(f.z < .7) f.z += Z_FAR - .7; }
      if(phase === "fly"){ z -= dt * sp; if(z <= 1){ z = 1; resolve(); } }
      else if(phase === "pass" && z > .55) z -= dt * sp * .8;
      draw();
    }
    run.raf = requestAnimationFrame(frame);
  }
  /* tocar: la puerta o el carril (por la x del toque); deslizar a un lado mueve un carril */
  let sx = null, sy = 0, swiped = false;
  stage.addEventListener("pointerdown", e => { if(e.target.closest(".fl-arrow")) return; sx = e.clientX; sy = e.clientY; swiped = false; });
  stage.addEventListener("pointermove", e => {
    if(sx === null || swiped) return;
    const dx = e.clientX - sx;
    if(Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(e.clientY - sy)){ swiped = true; move(lane + (dx > 0 ? 1 : -1)); }
  });
  stage.addEventListener("pointerup", e => {
    if(sx === null) return;
    const was = swiped; sx = null;
    if(was || e.target.closest(".fl-arrow")) return;
    const g = e.target.closest(".fl-gate");
    if(g){ move(+g.dataset.i); return; }
    const x = e.clientX - stage.getBoundingClientRect().left;
    move(x < W / 2 - GAP / 2 ? 0 : x > W / 2 + GAP / 2 ? 2 : 1);
  });
  stage.addEventListener("pointercancel", () => { sx = null; });
  root.querySelector("#fl-l").onclick = () => move(lane - 1);
  root.querySelector("#fl-r").onclick = () => move(lane + 1);
  const kb = e => {
    if(e.ctrlKey || e.metaKey || e.altKey || (e.target.closest && e.target.closest("input,textarea,select"))) return;
    const k = e.key;
    if(k === "ArrowLeft" || k === "a" || k === "A"){ e.preventDefault(); move(lane - 1); }
    else if(k === "ArrowRight" || k === "d" || k === "D"){ e.preventDefault(); move(lane + 1); }
    else if(k === "1" || k === "2" || k === "3"){ e.preventDefault(); move(+k - 1); }
  };
  const onR = () => { if(live()) measure(); };
  addEventListener("resize", onR); run.clean.push(() => removeEventListener("resize", onR));
  measure();
  requestAnimationFrame(() => { if(live()) measure(); });
  round();
  last = performance.now();
  run.raf = requestAnimationFrame(frame);
  api.intro(run, ID, () => { started = true; last = performance.now(); measure(); api.keys(run, kb); });
}

const reg = window.vocabGames && typeof vocabGames.register === "function" && vocabGames.register(ID, {
  t: "Pajarito volador", sub: "Vuela por la puerta buena", img: "img/games/pajarito.png",
  how: "Arriba sale una palabra. Lleva al pajarito a la puerta que la dice en el idioma: toca la puerta, tu lado o desliza.",
  words: "Vuela por Londres, París o Copenhague",
  fresh: true,
  rec: b => `${Number.isFinite(+b.score) ? +b.score : 0} de ${ROUNDS} puertas`,
  start,
});
if(!reg) console.warn("[flyer] no se pudo añadir a Juegos");
})();
