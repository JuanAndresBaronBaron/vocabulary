/* módulo chant: «Rap del zorro», un juego de Juegos registrado con vocabGames.register (como js/topos.js).
   Ruta: #/juegos/rap. Un rap de llamada y respuesta con 8 palabras del tema elegido en Juegos (api.topicPool) que tienen
     dibujo y audio grabado (audio/<ab>.json): las que no tienen mp3, o no cargan, se saltan; con menos de 4, el aviso.
   El ritmo es Web Audio, sin archivos: bombo en 1 y 3, palmada en 2 y 4 y un charles suave en las corcheas. Los mp3 se
     piden y se descodifican antes de empezar (decodeAudioData en un OfflineAudioContext: un AudioBuffer vale para
     cualquier contexto) y se ponen justo en el pulso con start(t, silencio del principio), nunca con setTimeout. Toda la
     canción se programa de una vez sobre el reloj del AudioContext y los dibujos, el zorro y los puntos del pulso miran
     ese reloj (requestAnimationFrame): la pausa de los juegos (Esc, ✕, «?») o salir de la app solo suspenden el
     AudioContext y al volver todo sigue en su sitio. El AudioContext nace dentro del toque de «¡Empezar el rap!» (iOS).
   Cada ronda son 2 compases: el zorro dice la palabra en 1 y 3 («Cat! … Cat!») y luego el dibujo salta con «¡Tú!» en 1 y
     3 para que el niño la repita. Tres niveles seguidos, cada uno un poco más rápido (84, 90 y 96 pulsos por minuto):
     1. una palabra (4 rondas);
     2. dos palabras alternas («Cat! … Dog!», 2 rondas);
     3. color + palabra (2 rondas): «Red cat!» en inglés y «Le chat rouge!» en francés (solo colores que suenan igual con
        «la»), si el tema tiene cosas que pintar (no Colores, Países, Nacionalidades ni Soldados). En danés la palabra
        grabada ya lleva el artículo («en hund») y el color no cabe en medio: allí es otra vez el nivel 2, más rápido.
   Unirse al rap: con el micrófono (opcional, botón del micro; solo mide el volumen, no reconoce palabras) cuenta la voz
     después de cada «¡Tú!» y el zorro baila al oírla; sin micrófono, tocar el escenario (o Espacio) a tiempo con el
     «¡Tú!». Nunca se falla: lo que no se une, pasa. Estrellas por unirse (70 % ★★★, 35 % ★★, si no ★).
   Para las pruebas: root.rap() → el estado (palabras, rondas, lo programado y los «¡Tú!»); window.__rapRounds = N juega
     solo N rondas. */
(() => {
"use strict";

const ID = "rap", FOX = "img/pj/zorro.png", NW = 8, BPM = [0, 84, 90, 96];
const IC = (n, s = "bold", z = 22, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
const RM = () => { try{ return !!(window.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const pic = src => (window.vocabGames && typeof vocabGames.pic === "function") ? vocabGames.pic(src) : src;
const mix = a => { const b = a.slice(); for(let i = b.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const AB = {english: "en", "français": "fr", dansk: "da"};
const NOPAINT = new Set(["colores", "paises", "nacionalidades", "militar"]);
const COLS = [
  {id: "red", es: "Rojo", n: "rojo", hex: "#E53935"},
  {id: "blue", es: "Azul", n: "azul", hex: "#1E88E5"},
  {id: "yellow", es: "Amarillo", n: "amarillo", hex: "#FDD835"},
  {id: "green", es: "Verde", n: "verde", hex: "#43A047"},
];
/* francés: el color tiene que sonar igual con esa palabra (como en «El zorro dice», js/simon.js) */
const frArt = w => { const m = /^(le|la|les|un|une|des)\s|^(l)['’]/i.exec(w); return m ? (m[1] || "l'").toLowerCase() : ""; };
function colOk(L, w, c){
  if(L === "english") return true;
  if(L !== "français") return false;
  const a = frArt(w);
  if(!a || a === "les" || a === "des") return false;
  if(a === "l'") return c.id === "red" || c.id === "yellow";
  if(a === "la" || a === "une") return c.id !== "green";
  return true;
}
const colText = (L, w, cw) => L === "français" && /^(la|une)\s/i.test(w) && cw === "bleu" ? "bleue" : cw;
const MAPS = {};
async function clipMap(ab){
  if(MAPS[ab]) return MAPS[ab];
  try{ const r = await fetch(`audio/${ab}.json`); if(!r.ok) throw new Error(r.status); const m = await r.json(); if(m && typeof m === "object") return (MAPS[ab] = m); }catch(e){}
  return {};
}
const decodeP = (c, ab) => new Promise((res, rej) => { try{ const p = c.decodeAudioData(ab, res, rej); if(p && typeof p.then === "function") p.then(res, rej); }catch(e){ rej(e); } });
/* dónde empieza y acaba la voz de verdad en el mp3 (el silencio de delante se salta: la palabra cae justo en el pulso) */
function trim(buf){
  const d = buf.getChannelData(0), n = d.length, sr = buf.sampleRate;
  let pk = 0; for(let i = 0; i < n; i++){ const v = Math.abs(d[i]); if(v > pk) pk = v; }
  const th = Math.max(.02, pk * .06);   /* algunos mp3 traen más de 1 s de silencio delante */
  let a = 0; while(a < n && Math.abs(d[a]) < th) a++;
  if(a >= n) return null;
  let b = n - 1; while(b > a && Math.abs(d[b]) < th) b--;
  const lead = Math.max(0, a / sr - .012), end = Math.min(n / sr, b / sr + .06);
  return {lead, dur: Math.max(.15, end - lead)};
}

const CSS = `
.rp{max-width:760px}
.rp .gm-top{margin-bottom:8px}
/* el escenario: azul marino, el zorro arriba con los 4 puntos del pulso y los dibujos grandes */
.rp-stage{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;height:520px;padding:10px 12px 12px;border-radius:24px;overflow:hidden;
  background:#123050 linear-gradient(180deg,#1b4268 0%,#123050 60%,#0d243d 100%);color:#fff;
  touch-action:manipulation;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:pointer;isolation:isolate}
/* el brillo de arriba, aparte (el fondo sigue siendo azul marino macizo) */
.rp-stage::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(70% 40% at 50% 0%,rgba(255,255,255,.12),transparent 70%)}
[data-theme=dark] .rp-stage{background:#0d243b linear-gradient(180deg,#14324f 0%,#0d243b 60%,#091a2c 100%)}
[data-theme=dark] .rp-stage::before{opacity:.65}
.rp-stage:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
.rp-top{flex:none;display:flex;align-items:flex-end;justify-content:center;gap:16px;width:100%}
.rp-fox{width:var(--fx,104px);height:auto;transform-origin:50% 100%;pointer-events:none;-webkit-user-drag:none}
.rp-fox.hop{animation:rp-hop .22s ease-out}
@keyframes rp-hop{40%{transform:translateY(-8px) scale(1.04,.97)}}
.rp-fox.dance{animation:rp-dance .5s ease-in-out}
@keyframes rp-dance{25%{transform:rotate(-8deg) translateY(-4px)}75%{transform:rotate(8deg) translateY(-4px)}}
.rp-side{display:flex;flex-direction:column;align-items:center;gap:8px;padding-bottom:6px}
.rp-say{min-width:5.5em;margin:0;padding:4px 14px;border-radius:999px;background:rgba(255,255,255,.14);text-align:center;font:900 clamp(1.25rem,5.4vw,1.7rem)/1.15 var(--f-round);letter-spacing:.01em}
.rp-say.you{background:var(--gold);color:#3D2B00}
.rp-beat{display:flex;gap:9px}
.rp-beat i{width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,.22);transition:background-color .08s,transform .08s}
.rp-beat i.on{background:#fff;transform:scale(1.25)}
.rp-beat.you i.on{background:var(--gold)}
.rp-pics{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:16px;width:100%}
.rp-pic{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;width:var(--ps,220px);min-width:0;transform-origin:50% 90%}
.rp-im{position:relative;width:var(--ps,220px);height:var(--ps,220px);border-radius:24px;background:var(--gm-tile,#fff);display:grid;place-items:center;
  box-shadow:0 4px 0 rgba(0,0,0,.25);transition:box-shadow .12s}
.rp-im>img,.rp-tint{width:80%;height:80%;object-fit:contain;mix-blend-mode:multiply;pointer-events:none;-webkit-user-drag:none}
.rp-tint{position:relative;isolation:isolate;mix-blend-mode:normal}
.rp-sil{position:absolute;inset:0;-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center}
.rp-tint img{position:relative;width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply;filter:grayscale(1) brightness(1.5) contrast(1.15)}
.rp-w{max-width:100%;font:900 clamp(1.15rem,5vw,1.6rem)/1.15 var(--f-round);text-align:center;overflow-wrap:anywhere}
.rp-pic .ipa{display:block;margin-top:-4px;font:500 var(--fs-note)/1.2 var(--f-text);color:#cfe0f2;text-align:center}
.rp-pic.say .rp-im{box-shadow:0 4px 0 rgba(0,0,0,.25),0 0 0 6px rgba(255,255,255,.55)}
.rp-pic.go{animation:rp-go .34s cubic-bezier(.2,.9,.3,1.3)}
@keyframes rp-go{40%{transform:translateY(-14px) scale(1.06)}}
.rp-pic.go .rp-im,.rp-pic.you .rp-im{box-shadow:0 4px 0 rgba(0,0,0,.25),0 0 0 6px var(--gold)}
.rp-you{position:absolute;right:-8px;top:-10px;display:none;align-items:center;gap:4px;padding:5px 12px;border-radius:999px;background:var(--gold);color:#3D2B00;
  font:900 1.05rem/1 var(--f-round);box-shadow:0 2px 0 rgba(0,0,0,.25)}
.rp-pic.you .rp-you{display:inline-flex}
.rp-pic.joined .rp-you{background:var(--teal);color:#fff}
/* antes de empezar: las palabras del rap, pequeñas */
.rp-pre{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;width:min(100%,420px)}
.rp-pre span{aspect-ratio:1;border-radius:16px;background:var(--gm-tile,#fff);display:grid;place-items:center}
.rp-pre img{width:78%;height:78%;object-fit:contain;mix-blend-mode:multiply}
.rp-ctl{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin:12px auto 0}
.rp-go[hidden],.rp-mic[hidden],.rp-meter[hidden]{display:none}
.rp-mic[aria-pressed=true]{background:var(--teal);color:#fff}
.rp-meter{width:96px;height:12px;border-radius:999px;background:var(--fill);overflow:hidden}
.rp-meter i{display:block;width:100%;height:100%;background:var(--teal);transform-origin:0 50%;transform:scaleX(0)}
.rp-tip{margin:10px auto 0;max-width:560px;text-align:center;color:var(--label2);font:400 var(--fs-note)/1.35 var(--f-text)}
@media (prefers-reduced-motion:reduce){.rp-fox.hop,.rp-fox.dance,.rp-pic.go{animation:none}.rp-beat i{transition:none}.rp-beat i.on{transform:none}}
`;
function css(){
  if(document.getElementById("css-chant")) return;
  const s = document.createElement("style"); s.id = "css-chant"; s.textContent = CSS; document.head.appendChild(s);
}
const imgTag = it => { const src = pic(it.img); return `<img src="${esc(src)}" alt="" draggable="false"${src !== it.img ? ` data-f="${esc(it.img)}" onerror="if(this.dataset.f){this.src=this.dataset.f;delete this.dataset.f}"` : ""}>`; };
const tintTag = (it, c) => { const u = esc(pic(it.img)); return `<span class="rp-tint"><span class="rp-sil" style="background:${c.hex};-webkit-mask-image:url('${u}');mask-image:url('${u}')"></span><img src="${u}" alt="" draggable="false"></span>`; };

async function start(app, api, mode){
  const my = api.nav();
  css();
  const L = lang, ab = AB[L] || "en", code = LANGS[L].code;
  const map = await clipMap(ab);
  if(!api.here(my, ID) || lang !== L) return;
  const clipOf = w => map[speakable(w)];
  let TP = {P: []};
  try{ TP = await api.topicPool(ID, 4, x => x && x.img && typeof x.word === "string" && x.word.trim() && [...x.word].length <= 22 && !!clipOf(x.word)); }catch(e){}
  if(!api.here(my, ID) || lang !== L) return;
  const empty = () => { app.innerHTML = `<div class="gm"><div class="gm-empty"><p>Este tema todavía no tiene palabras grabadas para rapear en ${esc(api.nm())}.</p>
      <a class="glass-btn" href="#/juegos">${IC("caret-left", "bold", 18)}Juegos</a></div></div>`; };
  if(TP.P.length < 4) return empty();
  const cand = mix(TP.P).slice(0, NW + 4);   /* unas pocas de más, por si alguna no carga */
  /* los colores del nivel 3 (inglés y francés) */
  let COL = [];
  if(L === "english" || L === "français"){
    try{
      const doc = await getDoc("colores");
      COL = COLS.map(c => { const r = (doc.rows || []).find(x => x && x.es === c.es), l = r && r.l && r.l[L]; return l && l.word && clipOf(l.word) ? Object.assign({word: l.word, ipa: l.ipa || ""}, c) : null; }).filter(Boolean);
    }catch(e){ COL = []; }
  }
  if(!api.here(my, ID) || lang !== L) return;

  const run = api.mount(app, `<div class="gm rp" id="rp">
    ${api.topHtml(ID, `<span class="gm-pill" title="Nivel">${IC("microphone-stage", "fill", 18)}<span><b id="rp-lv">1</b>/3</span></span><span class="gm-pill" title="Al ritmo">${IC("star", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`)}
    <div class="rp-stage" id="rp-stage" tabindex="-1" role="group" aria-label="El escenario: toca al ritmo cuando salga «¡Tú!»">
      <div class="rp-top"><img class="rp-fox" id="rp-fox" src="${FOX}" alt="" width="120" height="104" draggable="false">
        <div class="rp-side"><p class="rp-say" id="rp-say" aria-hidden="true">¡Hola!</p><div class="rp-beat" id="rp-beat" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div></div>
      <div class="rp-pics" id="rp-pics"></div></div>
    <div class="rp-ctl">
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg rp-go" id="rp-go" data-key="enter" disabled>${IC("play", "fill", 22)}<span>Preparando el rap…</span></button>
      <button type="button" class="gm-sec rp-mic" id="rp-mic" aria-pressed="false" aria-label="Cantar con el micrófono" title="Cantar con el micrófono" hidden>${IC("microphone", "fill", 26)}</button>
      <span class="rp-meter" id="rp-meter" aria-hidden="true" hidden><i></i></span></div>
    <p class="rp-tip" id="rp-tip" role="status" aria-live="polite">Escucha al zorro y, cuando salga «¡Tú!», repite la palabra. Sin micrófono, toca el escenario al ritmo.</p></div>`, mode);
  const root = run.root, $r = s => root.querySelector(s);
  const stage = $r("#rp-stage"), pics = $r("#rp-pics"), fox = $r("#rp-fox"), sayEl = $r("#rp-say"), beatEl = $r("#rp-beat");
  const goB = $r("#rp-go"), micB = $r("#rp-mic"), meter = $r("#rp-meter"), tip = $r("#rp-tip");
  const dots = [...beatEl.children];
  pics.innerHTML = `<div class="rp-pre" aria-hidden="true">${cand.slice(0, NW).map(it => `<span>${imgTag(it)}</span>`).join("")}</div>`;
  if(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") micB.hidden = false;

  /* ---------- los mp3, descodificados antes de empezar ---------- */
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  let dec = null; try{ dec = OAC ? new OAC(1, 1, 44100) : null; }catch(e){ dec = null; }
  async function load(x){
    try{
      const r = await fetch(`audio/${ab}/${x.clip}.mp3`); if(!r.ok) throw new Error(r.status);
      const raw = await r.arrayBuffer();
      if(dec){ x.buf = await decodeP(dec, raw); const t = trim(x.buf); if(!t) return null; Object.assign(x, t); }
      else x.raw = raw;   /* sin OfflineAudioContext: se descodifica al empezar, con el AudioContext de verdad */
      return x;
    }catch(e){ return null; }
  }
  let W = [], C3 = [], ready = false;
  const prep = (async () => {
    const got = await Promise.all(cand.map(it => load({it, word: it.word, clip: clipOf(it.word)})));
    W = got.filter(Boolean).slice(0, NW);
    /* nivel 3: dos parejas de color + palabra (cosas que se pueden pintar y colores que valen) */
    const paint = W.filter(w => !NOPAINT.has(w.it.doc) && !/^data:/.test(w.it.img));
    const used = new Set(), pairs = [];
    for(const w of mix(paint)){
      const c = mix(COL).find(c => !used.has(c.id) && colOk(L, w.word, c));
      if(c){ used.add(c.id); pairs.push({w, c}); }
      if(pairs.length === 2) break;
    }
    if(pairs.length === 2){
      const cs = await Promise.all(pairs.map(p => load({word: p.c.word, clip: clipOf(p.c.word), col: p.c})));
      if(cs.every(Boolean)) C3 = pairs.map((p, i) => ({w: p.w, c: cs[i]}));
    }
  })();
  await prep;
  if(!api.live(run)) return;
  if(W.length < 4) return empty();
  ready = true;
  goB.disabled = false; goB.querySelector("span").textContent = "¡Empezar el rap!";

  /* ---------- las rondas ---------- */
  function rounds(){
    const R = W.slice(0, 4).map(w => ({st: 1, lv: 1, a: [w]}));
    const rest = W.slice(4), two = [];
    const pool = rest.length >= 2 ? rest : mix(W);
    for(let i = 0; i + 1 < pool.length && two.length < 2; i += 2) two.push({st: 2, lv: 2, a: [pool[i], pool[i + 1]]});
    while(two.length < 2){ const m = mix(W); two.push({st: 2, lv: 2, a: [m[0], m[1]]}); }
    let three = C3.map(p => ({st: 3, lv: 3, a: [p.w], col: p.c}));
    if(three.length < 2){ const m = mix(W); three = [{st: 3, lv: 2, a: [m[0], m[1]]}, {st: 3, lv: 2, a: [m[2], m[3]]}]; }
    let out = R.concat(two, three);
    const n = Math.round(+window.__rapRounds); if(n > 0) out = out.slice(0, n);   /* solo para las pruebas */
    return out;
  }
  let RD = [], BARS = [], EV = [], BEATS = [], SLOTS = [], VE = [], T_END = 0;
  let ctx = null, beatBus = null, voiceBus = null, NOISE = null, started = false, ended = false, held = false, score = 0, lvShown = 0, susp = 0;

  /* ---------- Web Audio ---------- */
  function ensureCtx(){
    if(ctx){ resumeCtx(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return null;
    try{ ctx = new AC({latencyHint: "interactive"}); }catch(e){ try{ ctx = new AC(); }catch(e2){ return null; } }
    const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
    beatBus = ctx.createGain(); beatBus.gain.value = .5; beatBus.connect(comp);
    voiceBus = ctx.createGain(); voiceBus.gain.value = 1; voiceBus.connect(comp);
    const n = Math.floor(ctx.sampleRate * .5); NOISE = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = NOISE.getChannelData(0); for(let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    /* iOS antiguo: un sonido vacío dentro del toque */
    try{ const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); }catch(e){}
    resumeCtx();
    run.clean.push(() => { try{ ctx.close(); }catch(e){} });
    return ctx;
  }
  const resumeCtx = () => { try{ const p = ctx && ctx.resume(); if(p && p.catch) p.catch(() => {}); }catch(e){} };
  const lat = () => ctx ? Math.max(0, +ctx.outputLatency || 0) : 0;
  const nowT = () => ctx ? ctx.currentTime - lat() : 0;
  function kick(t, v){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .12);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.9 * v, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .28);
    o.connect(g).connect(beatBus); o.start(t); o.stop(t + .3);
    EV.push({t, k: "kick"});
  }
  function clap(t){
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = NOISE; f.type = "bandpass"; f.frequency.value = 1500; f.Q.value = .9;
    g.gain.setValueAtTime(.0001, t);
    [0, .011, .022].forEach(d => { g.gain.setValueAtTime(.6, t + d); g.gain.exponentialRampToValueAtTime(.06, t + d + .009); });
    g.gain.setValueAtTime(.42, t + .032); g.gain.exponentialRampToValueAtTime(.0001, t + .2);
    s.connect(f).connect(g).connect(beatBus); s.start(t, Math.random() * .2); s.stop(t + .22);
    EV.push({t, k: "clap"});
  }
  function hat(t, v){
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = NOISE; f.type = "highpass"; f.frequency.value = 7000;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05);
    s.connect(f).connect(g).connect(beatBus); s.start(t, Math.random() * .3); s.stop(t + .06);
  }
  /* la palabra grabada en el pulso t: sin su silencio de delante y, si no cabe, un poco más deprisa y con un final suave */
  function clip(x, t, room){
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = x.buf;
    const rate = x.dur > room ? Math.min(1.25, x.dur / room) : 1, play = Math.min(x.dur / rate, room);
    s.playbackRate.value = rate;
    g.gain.setValueAtTime(1, t); g.gain.setValueAtTime(1, t + Math.max(0, play - .04)); g.gain.linearRampToValueAtTime(.0001, t + play);
    s.connect(g).connect(voiceBus);
    s.start(t, x.lead); s.stop(t + play + .02);
    EV.push({t, k: "clip", w: x.word, lead: x.lead, rate});
  }

  /* ---------- lo que se ve ---------- */
  const on = (t, f) => VE.push({t, f});
  const label = (x, col) => col ? (L === "english" ? `${col.word} ${x.word}` : `${x.word} ${colText(L, x.word, col.word)}`) : x.word;
  function picHtml(x, col, k){
    const ipas = col ? (L === "english" ? [col.col.ipa, x.it.ipa] : [x.it.ipa, col.col.ipa]) : [x.it.ipa];
    const ip = typeof ipaHtml === "function" ? ipas.filter(Boolean).map(i => ipaHtml(i, code)).join(" ") : "";
    return `<div class="rp-pic" data-k="${k}"><span class="rp-im">${col ? tintTag(x.it, col.col) : imgTag(x.it)}</span>
      <b class="rp-w" lang="${esc(code)}">${esc(label(x, col))}</b>${ip}<span class="rp-you" aria-hidden="true">¡Tú!</span></div>`;
  }
  function showRound(r){
    pics.innerHTML = r.a.map((x, k) => picHtml(x, r.col || null, k)).join("");
    pics.dataset.n = r.a.length;
    fit();
  }
  const picEl = k => pics.querySelector(`.rp-pic[data-k="${k}"]`);
  const flash = (el, c, ms) => { if(!el) return; el.classList.remove(c); void el.offsetWidth; el.classList.add(c); setTimeout(() => el.classList.remove(c), ms); };
  const LVT = ["", "Nivel 1: una palabra.", "Nivel 2: dos palabras, ¡más rápido!", "Nivel 3: color y palabra, ¡más rápido todavía!"];
  function beatUI(j, you){
    dots.forEach((d, i) => d.classList.toggle("on", i === j));
    beatEl.classList.toggle("you", !!you);
  }
  function setSay(t, you){ sayEl.textContent = t; sayEl.classList.toggle("you", !!you); }
  function dance(){ if(!RM()) flash(fox, "dance", 520); }

  /* ---------- la canción entera, programada de una vez ---------- */
  function build(t0){
    RD = rounds();
    const bt = st => 60 / BPM[st];
    let t = t0;
    BARS = [{k: "count", t, b: bt(1)}]; t += 4 * bt(1);
    RD.forEach((r, i) => { const b = bt(r.st); BARS.push({k: "call", t, b, r, i}); t += 4 * b; BARS.push({k: "resp", t, b, r, i}); t += 4 * b; });
    T_END = t;
    for(const B of BARS){
      const b = B.b;
      for(let j = 0; j < 4; j++){
        const tb = B.t + j * b;
        BEATS.push(tb);
        if(B.k === "count") kick(tb, .55); else if(j % 2 === 0) kick(tb, 1); else clap(tb);
        hat(tb, B.k === "count" ? .14 : .08); hat(tb + b / 2, .05);
        on(tb, () => { beatUI(j, B.k === "resp"); if(B.k === "count") setSay(String(j + 1)); });
      }
      if(B.k === "call"){
        const r = B.r;
        on(B.t - .05, () => {
          if(r.st !== lvShown){ lvShown = r.st; const p = $r("#rp-lv"); if(p){ p.textContent = r.st; api.bump(p.parentNode); } tip.textContent = LVT[r.st]; }
          showRound(r); setSay("¡Escucha!");
        });
        const at = (x, t1, room, k) => { clip(x, t1, room); on(t1, () => { if(!RM()) flash(fox, "hop", 240); flash(picEl(k), "say", Math.round(room * 900)); }); };
        if(r.lv === 1){ at(r.a[0], B.t, 2 * b - .03, 0); at(r.a[0], B.t + 2 * b, 2 * b - .03, 0); }
        else if(r.lv === 2){ at(r.a[0], B.t, 2 * b - .03, 0); at(r.a[1], B.t + 2 * b, 2 * b - .03, 1); }
        else {
          const [x, y] = L === "english" ? [r.col, r.a[0]] : [r.a[0], r.col];
          for(const j of [0, 2]){ at(x, B.t + j * b, b - .02, 0); at(y, B.t + (j + 1) * b, b - .02, 0); }
        }
      } else if(B.k === "resp"){
        on(B.t - B.b / 2, () => { setSay("¡Tú!", true); pics.querySelectorAll(".rp-pic").forEach(p => p.classList.remove("say")); });
        [0, 2].forEach((j, n) => {
          const k = B.r.lv === 2 ? n : 0, s = {t: B.t + j * b, b, k, round: B.i, joined: false, how: ""};
          SLOTS.push(s);
          on(s.t, () => { pics.querySelectorAll(".rp-pic").forEach(p => p.classList.remove("you")); const el = picEl(k); if(el){ el.classList.add("you"); el.classList.toggle("joined", s.joined); if(!RM()) flash(el, "go", 360); } });
        });
        on(B.t + 4 * b - .02, () => pics.querySelectorAll(".rp-pic").forEach(p => p.classList.remove("you", "joined")));
      }
    }
    on(T_END, end);
    VE.sort((a, c) => a.t - c.t);
  }
  function join(s, how){
    if(s.joined) return;
    s.joined = true; s.how = how; score++;
    const sc = $r("#gm-sc"); if(sc){ sc.textContent = score; api.bump(sc.parentNode); }
    const el = picEl(s.k); if(el){ el.classList.add("you", "joined"); }
    api.haptic("success");
    dance();
  }
  /* tocar a tiempo: un poco antes o después del «¡Tú!» */
  function hit(){
    if(!started || ended || run.paused) return;
    const now = nowT(), s = SLOTS.find(x => !x.joined && now >= x.t - .45 * x.b && now <= x.t + .6 * x.b);
    if(s) join(s, "tap"); else dance();
  }

  /* ---------- el micrófono (opcional): solo el volumen ---------- */
  let stream = null, an = null, mbuf = null, floor = .01;
  async function micOn(){
    if(!ensureCtx()) return;
    micB.disabled = true;
    try{ stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}}); }
    catch(e){
      micB.disabled = false; stream = null;
      try{ toast("No se pudo usar el micrófono. ¡Toca el escenario al ritmo!"); }catch(err){}
      return;
    }
    if(!api.live(run)){ stream.getTracks().forEach(t => t.stop()); stream = null; return; }
    const src = ctx.createMediaStreamSource(stream), mute = ctx.createGain();
    an = ctx.createAnalyser(); an.fftSize = 1024; mbuf = new Float32Array(an.fftSize); mute.gain.value = 0;
    src.connect(an); an.connect(mute); mute.connect(ctx.destination);   /* sin salida: solo para que el analizador trabaje */
    micB.disabled = false; micB.setAttribute("aria-pressed", "true"); micB.setAttribute("aria-label", "Apagar el micrófono"); meter.hidden = false;
    tip.textContent = "¡Micrófono encendido! Repite la palabra cuando salga «¡Tú!».";
    if(!started) loop();
  }
  function micOff(){
    if(stream) stream.getTracks().forEach(t => { try{ t.stop(); }catch(e){} });
    stream = null; an = null;
    micB.setAttribute("aria-pressed", "false"); micB.setAttribute("aria-label", "Cantar con el micrófono"); meter.hidden = true;
  }
  run.clean.push(micOff);
  function micTick(now){
    an.getFloatTimeDomainData(mbuf);
    let sum = 0; for(let i = 0; i < mbuf.length; i++) sum += mbuf[i] * mbuf[i];
    const rms = Math.sqrt(sum / mbuf.length);
    /* el ruido de fondo (el ritmo que se cuela por el micro, la sala): sigue a lo bajo deprisa y a lo alto muy despacio */
    const loud = rms > Math.max(.035, floor * 2.5);
    floor = Math.max(.004, floor + (Math.min(rms, floor * 2.5) - floor) * (loud ? .002 : .05));
    const mi = meter.firstElementChild; if(mi) mi.style.transform = `scaleX(${Math.min(1, rms / .2).toFixed(3)})`;
    if(loud){
      if(!fox.classList.contains("dance")) dance();
      if(started && !ended){ const s = SLOTS.find(x => !x.joined && now >= x.t - .2 && now <= x.t + 1.5 * x.b); if(s) join(s, "mic"); }
    }
  }

  /* ---------- el bucle: lo que se ve sigue al reloj del audio; la pausa suspende el AudioContext ---------- */
  function loop(){
    if(!api.live(run) || ended) return;
    if(ctx && started){
      const want = run.paused || document.hidden;
      if(want && !held){ held = true; try{ ctx.suspend(); }catch(e){} }
      else if(!want && held){ held = false; resumeCtx(); }
      /* suspendido sin querer (iOS lo para si llega una llamada): un toque lo sigue */
      if(!want && ctx.state !== "running"){ if(!susp) susp = performance.now(); else if(performance.now() - susp > 700 && goB.hidden){ goB.hidden = false; goB.querySelector("span").textContent = "Seguir el rap"; } }
      else susp = 0;
    }
    const now = nowT();
    while(VE.length && VE[0].t <= now){ const e = VE.shift(); try{ e.f(); }catch(err){ console.error(err); } if(ended) return; }
    if(an && !run.paused) micTick(now);
    run.raf = requestAnimationFrame(loop);
  }
  const onVis = () => { if(!ctx || !started || ended) return; if(document.hidden){ held = true; try{ ctx.suspend(); }catch(e){} } };
  document.addEventListener("visibilitychange", onVis); run.clean.push(() => document.removeEventListener("visibilitychange", onVis));
  /* «Seguir» de la pausa y de «Cómo se juega»: el AudioContext se reanuda dentro de ese toque (iOS) */
  const onTapResume = e => { if(ctx && started && !ended && e.target.closest && e.target.closest("#gm-pz-go,#gm-how [data-close]")) resumeCtx(); };
  document.addEventListener("click", onTapResume, true); run.clean.push(() => document.removeEventListener("click", onTapResume, true));

  async function go(){
    if(!ready || ended) return;
    if(started){ resumeCtx(); goB.hidden = true; return; }   /* «Seguir el rap» */
    if(!ensureCtx()){ tip.textContent = "Este aparato no puede tocar el ritmo."; return; }
    started = true;
    goB.hidden = true;
    api.haptic("selection");
    if(!dec) await Promise.all(W.concat(C3.map(p => p.c)).filter(x => x.raw).map(async x => { try{ x.buf = await decodeP(ctx, x.raw); Object.assign(x, trim(x.buf) || {lead: 0, dur: x.buf.duration}); }catch(e){} x.raw = null; }));
    W = W.filter(x => x.buf);
    build(ctx.currentTime + .35);
    try{ stage.focus({preventScroll: true}); }catch(e){}
    fit();
    cancelAnimationFrame(run.raf); loop();
  }
  function end(){
    if(ended) return;
    ended = true;
    beatUI(-1); setSay("¡Bravo!");
    micOff();
    const N = SLOTS.length, stars = score >= N * .7 ? 3 : score >= N * .35 ? 2 : 1;
    const seen = new Map(); RD.forEach(r => r.a.forEach(x => { if(!seen.has(x.it.k)) seen.set(x.it.k, {word: x.it.word, es: x.it.es, img: x.it.img, ipa: x.it.ipa, miss: false}); }));
    api.later(run, () => api.finish(run, ID, {score, stars, words: [...seen.values()],
      line: score ? `¡Rapeaste con el zorro ${score} de ${N} veces!` : "¡Buen ritmo! La próxima vez, repite con el zorro cuando salga «¡Tú!»."}), 900);
  }
  goB.onclick = () => go();
  micB.onclick = () => { if(stream) micOff(); else micOn(); };
  stage.addEventListener("pointerdown", e => { if(e.button > 0) return; hit(); });
  /* para las pruebas */
  root.rap = () => ({ready, started, ended, score, words: W.map(x => x.word), c3: C3.map(p => [p.c.word, p.w.word]),
    rounds: RD.map(r => ({st: r.st, lv: r.lv, a: r.a.map(x => x.word), col: r.col ? r.col.word : ""})),
    ev: EV.filter(e => e.k === "clip").map(e => Object.assign({}, e)), beats: BEATS.slice(), slots: SLOTS.map(s => ({t: s.t, b: s.b, k: s.k, joined: s.joined, how: s.how})),
    now: ctx ? ctx.currentTime : 0, lat: lat(), state: ctx ? ctx.state : "", end: T_END, mic: !!stream});

  /* el escenario llena lo que queda de pantalla (sin scroll); los dibujos, lo más grandes que quepan */
  function fit(){
    if(!api.live(run) || !stage.isConnected) return;
    const top = stage.getBoundingClientRect().top + scrollY, main = stage.closest("main");
    const pb = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 12;
    const below = $r(".rp-ctl").offsetHeight + tip.offsetHeight + 26;
    const H = Math.round(Math.max(300, Math.min(760, innerHeight - top - pb - below)));
    stage.style.height = H + "px";
    const W0 = stage.clientWidth - 24, fx = Math.round(Math.max(72, Math.min(124, H * .2)));
    stage.style.setProperty("--fx", fx + "px");
    const n = +pics.dataset.n || 1, room = H - fx - 24 - 30 - 64;   /* el zorro, los márgenes y la palabra con su IPA */
    const ps = n === 2 ? Math.min((W0 - 16) / 2, room, 230) : Math.min(W0 * .8, room, 270);
    stage.style.setProperty("--ps", Math.round(Math.max(90, ps)) + "px");
  }
  let fitT = 0;
  const refit = () => { fit(); clearTimeout(fitT); fitT = setTimeout(fit, 260); };
  addEventListener("resize", refit); run.clean.push(() => { removeEventListener("resize", refit); clearTimeout(fitT); });
  refit(); requestAnimationFrame(refit);
  try{ document.fonts.ready.then(fit); }catch(e){}
  api.intro(run, ID, () => {
    fit();
    if(api.kbd()) try{ goB.focus({preventScroll: true}); }catch(e){}
    api.keys(run, e => {
      if(e.key !== " " && e.key !== "Enter") return;
      if(e.target && e.target !== stage && e.target.closest && e.target.closest("button,a")) return;   /* el botón enfocado ya hace su clic */
      e.preventDefault();
      if(!started || !goB.hidden) go(); else hit();
    });
  });
}

const reg = window.vocabGames && typeof vocabGames.register === "function" && vocabGames.register(ID, {
  t: "Rap del zorro", sub: "Repite al ritmo", img: "img/games/rap.png", sec: "palabras",
  how: "El zorro rapea una palabra. Cuando salga «¡Tú!», repítela al ritmo.",
  keys: "Con el teclado: Espacio marca el ritmo.",
  topic: true,
  fresh: "2026-10-31",
  rec: b => `${Number.isFinite(+b.score) ? +b.score : 0} al ritmo`,
  start,
});
if(!reg) console.warn("[chant] no se pudo añadir a Juegos");
})();
