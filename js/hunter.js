/* Módulo hunter (segunda mitad de window.vocabHunter): «Cazador de cosas» (SPEC §5-K). Lo pide js/hunter-boot.js la
   primera vez que hace falta (al entrar en #/cazador o en «Mi casa»); antes no se carga nada de esto.
   · #/cazador (pestaña Jugar; modo foco html[data-focus=cazador]: sin barras, con la ✕ y las monedas). Una ronda con los
     4 colores fuertes (rojo, amarillo, verde y azul; naranja, morado, rosa, marrón, blanco, negro y gris no: con la luz
     de casa la cámara los confunde) en orden al azar. Cada color se pide en el idioma: la frase con la voz del
     navegador («Find something red!», «Trouve quelque chose de rouge !», «Find noget rødt!»; useVoice(u, idioma) y
     retryLocal en onerror; sin voz de ese idioma no se lee con otro acento) y después la palabra con su mp3 (say/sayP;
     sin mp3, la voz). La palabra se ve con su IPA (ipaHtml) y su traducción.
     - Antes de la cámara, una frase y un botón: «La app mira por la cámara y guarda un trocito pequeño de cada cosa en
       Mi casa. Todo se queda en este aparato.» (con «Guardar fotos al cazar» apagado: «Para jugar, la app mira por la
       cámara. Nada sale del aparato.»; si el navegador ya dio permiso, se salta). getUserMedia con la cámara de atrás (facingMode ideal "environment"; si no
       hay, la de delante, que se ve en espejo) y sin audio.
     - Un cuadro en el centro mide el color: cada 90 ms se copian los píxeles de ese cuadro (la mitad del lado corto de
       lo que se ve, con el mismo recorte que object-fit: cover) a un lienzo de 40×40 y cada píxel pasa a HSV (tono,
       saturación y luz). Cuenta como un color si su tono cae en la franja del color y llega a su saturación y su luz
       mínimas; si el 40 % del cuadro es del color pedido (y la luz media llega a 0,12), vale. Mantenerlo 1 s (el anillo
       del cuadro se llena; si se va, se vacía más deprisa) = encontrado: G.haptic, M.ok, M.burst, award() con tope
       diario, la palabra otra vez y una foto pequeña a «Mi casa». Con poca luz, o con otro color, lo dice.
     - Sin cámara, sin permiso, si está ocupada o si se prefiere («Jugar tocando»; abajo, «Tocar»): el modo tocar, con 4
       dibujos (uno del color pedido y uno de cada uno de los otros), cada uno con su palabra en el idioma (del corpus:
       «apple», «la pomme», «et æble»…), su IPA y el español pequeño; así nunca se queda atascado. Fallar: el dibujo en
       gris con ✗ y el bueno con ✓, sin sonido triste y sin vibrar. El resultado sale en la tarjeta de la pregunta y en
       el móvil todo cabe sin scroll (fitTap() encoge los dibujos lo justo, nunca por debajo de 118 px de alto).
     - Muchas cosas seguidas: al encontrar un color el vídeo sigue en marcha (en el iPhone, pause() y play() con la
       cámara la dejaban congelada desde la segunda cosa); attach() pone playsinline y muted y hace play() tras cada
       srcObject, y stall() vigila los fotogramas: si en 1,5 s no llega ninguno, vuelve a poner el vídeo; si sigue igual,
       pide la cámara otra vez (como mucho 2 veces por color) y, si tampoco, «La cámara está en pausa» con «Seguir».
     - La cámara se apaga (track.stop() de todas sus pistas) al salir de #/cazador (hashchange y bus "route"), al ocultar
       la pestaña (visibilitychange y pagehide; al volver, «La cámara está en pausa» y «Seguir»), al pasar a tocar y al
       acabar la ronda. Si el permiso llega cuando ya se salió, se apaga al momento.
     Toda la pantalla lleva data-no-renew (js/sync.js no pide el permiso de Google en mitad del juego).
   · «Mi casa» (#/album/casa, una página del álbum; js/album.js llama a vocabHunter.casa): los recortes guardados en este
     aparato, el más nuevo primero, cada uno con el color en el idioma de ahora, su IPA, el altavoz (data-say) y el día.
   Privacidad: la foto NUNCA es la imagen entera. No hay detector de caras, así que solo se guarda un recorte de 192×192
   px del centro del cuadro (el 80 % de dentro del cuadro: lo que el niño apuntó, nada de alrededor) y solo si ese
   recorte es casi todo del color pedido (PURE: el 72 % de sus píxeles, sin contar los de tono de piel), si casi no tiene
   piel (SKIN: menos del 12 %), si no es la cámara de delante (la de los selfis) y si «Guardar fotos al cazar» (Para
   mayores) está encendido; si no, el color cuenta igual, pero no se guarda foto. Va a IndexedDB
   (window.vocabMedia de js/mailbox.js, base "vocab-media-user") como {id: "hunt-<t36><4>", kind: "photo", src: "hunt",
   t (ms), type: "image/jpeg", w: 192, h: 192, buf (ArrayBuffer), color (red|yellow|green|blue), lang ("en"|"fr"|"da"),
   day ("AAAA-MM-DD")}; se quedan las 48 más nuevas. Nunca se exporta ni se sube. Se borran en Ajustes › Para mayores
   («Borrar las fotos de Mi casa», js/hunter-boot.js; o todo con «Borrar grabaciones y fotos» del Buzón). En «Mi casa»,
   mantener pulsada una foto (vocabMenu) da «Oír» y «Borrar esta foto» (con «Deshacer» unos segundos).
   Monedas (solo con award()): 2 por color encontrado con la cámara, 1 por acertar tocando; como mucho 10 al día.
   Guardado: localStorage "hunt:st" (DEVICE_ONLY en js/save.js: no va en la partida) = {v: 1, day: {d: "AAAA-MM-DD",
     c: monedas de ese día}, n: colores cazados en total}.
   Eventos: bus "hunt-found" {color, mode: "cam"|"tap", saved, coins} y "hunt-end" {found, coins}.
   API (se añade a window.vocabHunter): loaded: true, route(partes), casa(vivo) → Promise, state() → lo que se ve,
     measure(video, frac) → lectura | null, classify(rgba) → {frac: {red, yellow, green, blue}, v, top, n},
     hsv(r, g, b) → [h, s, v], purity(video, colorId) → {pure, skin} | null, keep(video, colorId) → ¿se guardaría la
     foto?, photos() → Promise<[registro]>, stop() (apaga la cámara), COLORS, DAY_CAP, CAM_PAY, TAP_PAY, HOLD, NEED, KEEP,
     CROP, PURE, SKIN.
   Usa de index.html: lang, LANGS, CLIP_AB, store, bus, ROUTES, ROUTE_FROM, esc, ico, getDoc, dayKey, award, heroHtml,
   say, sayP, useVoice, retryLocal, voices, langVoices, rate, ipaHtml, secOf, hashPath, shuffle; window.M, window.G,
   window.vocabMedia. Iconos: Phosphor. Dibujos: img/ (colores del corpus, OpenMoji). */
(() => {
"use strict";
const W = window, D = document, H = W.vocabHunter;
if(!H || H.loaded) return;
const DAY_CAP = 10, CAM_PAY = 2, TAP_PAY = 1, KEEP = 48;
const HOLD = 1000, STEP = 90, GRID = 40, FRAC = .5, INNER = .8, CROP = 192, NEED = .4, DIM = .12, PURE = .72, SKIN = .12;
const KEY = H.KEY || "hunt:st", IMG = H.IMG || "img/games/cazador.png", HOUSE = H.HOUSE || "img/om_1F3E1.png";
const $id = id => D.getElementById(id);
const haptic = t => { try{ if(W.G && typeof G.haptic === "function") G.haptic(t || "selection"); }catch(e){} };
const mo = (f, ...a) => { try{ if(W.M && typeof M[f] === "function") return M[f](...a); }catch(e){} return null; };
const code = (L = lang) => (LANGS[L] || LANGS.english).code;
const abOf = (L = lang) => CLIP_AB[L] || "en";
const today = () => dayKey(new Date());
const onRoute = () => secOf(hashPath()) === "cazador";
const media = () => { try{ return W.vocabMedia && typeof vocabMedia.ok === "function" && vocabMedia.ok() ? vocabMedia : null; }catch(e){ return null; } };
const hasVoice = L => { try{ return "speechSynthesis" in W && (!voices.length || langVoices(L).length > 0); }catch(e){ return false; } };
const camApi = () => { try{ return !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function"); }catch(e){ return false; } };
const CHK = (s = 28) => `<svg class="chk" viewBox="0 0 256 256" width="${s}" height="${s}" aria-hidden="true" focusable="false"><polyline points="40 144 96 200 224 72" fill="none" stroke="currentColor" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const XM = (s = 24) => `<svg class="xm" viewBox="0 0 256 256" width="${s}" height="${s}" aria-hidden="true" focusable="false"><path d="M68 68 188 188M188 68 68 188" fill="none" stroke="currentColor" stroke-width="28" stroke-linecap="round"/></svg>`;
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

/* ---------- los colores ----------
   hue: franjas de tono (grados), s y v: saturación y luz mínimas. Bien separadas: entre una y otra queda un hueco
   (naranja 15-41°, lima 71-74°, turquesa 166-184°, morado 256-344°) que no cuenta para ninguno. */
const SW = H.SWATCH || {};
const COLORS = [
  {id: "red", es: "Rojo", n: "rojo", hex: "#E53935", img: SW.red || "img/746cbfda58.png", hue: [[345, 360], [0, 14]], s: .45, v: .22,
    w: {english: ["red", "/red/"], "français": ["rouge", "/ʁuʒ/"], dansk: ["rød", "/ʁøðˀ/"]},
    ask: {english: "red", "français": "rouge", dansk: "rødt"}},
  {id: "yellow", es: "Amarillo", n: "amarillo", hex: "#FDD835", img: SW.yellow || "img/f9ebe8fd08.png", hue: [[42, 70]], s: .4, v: .35,
    w: {english: ["yellow", "/ˈjeləʊ/"], "français": ["jaune", "/ʒon/"], dansk: ["gul", "/ɡuˀl/"]},
    ask: {english: "yellow", "français": "jaune", dansk: "gult"}},
  {id: "green", es: "Verde", n: "verde", hex: "#43A047", img: SW.green || "img/2368d85824.png", hue: [[75, 165]], s: .3, v: .18,
    w: {english: ["green", "/ɡriːn/"], "français": ["vert", "/vɛʁ/"], dansk: ["grøn", "/ɡʁœnˀ/"]},
    ask: {english: "green", "français": "vert", dansk: "grønt"}},
  {id: "blue", es: "Azul", n: "azul", hex: "#1E88E5", img: SW.blue || "img/a39196ddae.png", hue: [[185, 255]], s: .35, v: .18,
    w: {english: ["blue", "/bluː/"], "français": ["bleu", "/blø/"], dansk: ["blå", "/blɔːˀ/"]},
    ask: {english: "blue", "français": "bleu", dansk: "blåt"}},
];
const colorOf = id => COLORS.find(c => c.id === id) || null;
/* la frase: el adjetivo concuerda con «something» / «quelque chose de» (masculino) / «noget» (neutro: rødt, gult…) */
const ASK = {english: ["Find something ", "!"], "français": ["Trouve quelque chose de ", " !"], dansk: ["Find noget ", "!"]};
function phrase(c, L = lang){
  const a = ASK[L] || ASK.english, w = c.ask[L] || c.ask.english;
  return {pre: a[0], w, post: a[1], text: a[0] + w + a[1]};
}
const word = (c, L = lang) => c.w[L] || c.w.english;
/* la palabra y su IPA salen del corpus (data/colores.json) si se puede; si no, las de aquí */
let WORDS = false;
async function words(){
  if(WORDS) return;
  try{
    const d = await getDoc("colores");
    for(const c of COLORS){
      const r = ((d && d.rows) || []).find(x => x && x.es === c.es && x.l);
      if(!r) continue;
      for(const L of Object.keys(LANGS)){
        const x = r.l[L];
        if(x && typeof x.word === "string" && x.word) c.w[L] = [x.word, typeof x.ipa === "string" && x.ipa ? x.ipa : (c.w[L] || [])[1] || ""];
      }
    }
    WORDS = true;
  }catch(e){ /* sin conexión y sin caché: valen las de aquí */ }
}
/* los dibujos del modo tocar (js/hunter-boot.js: también van en «Descargar todo»), con su palabra del corpus */
const THINGS = H.THINGS || {};
const TW = {};   /* "<tema>|<es>" → {fila del corpus} */
let TWP = null;
function thingWords(){
  if(!TWP) TWP = (async () => {
    const refs = Object.values(THINGS).flat().map(x => x[2]).filter(Boolean);
    await Promise.all([...new Set(refs.map(r => r.split("|")[0]))].map(async doc => {
      try{
        /* sin pasar por CACHE: así el álbum no cuenta estos temas como «vistos» (album:uniq) solo por mirar el cazador */
        const d = (typeof CACHE !== "undefined" && CACHE[doc]) || await (await fetch(`data/${doc}.json`)).json();
        refs.filter(r => r.startsWith(doc + "|")).forEach(r => { const es = r.slice(doc.length + 1), row = ((d && d.rows) || []).find(x => x && x.es === es && x.l); if(row) TW[r] = row; });
      }catch(e){ /* sin conexión y sin caché: el dibujo con su nombre en español */ }
    }));
  })().catch(() => { TWP = null; });
  return TWP;
}
/* la palabra de un dibujo en el idioma: [palabra, ipa] o null */
function thingWord(ref, L = lang){ const r = TW[ref], x = r && r.l && r.l[L]; return x && x.word ? [speakable(x.word), typeof x.ipa === "string" ? x.ipa : ""] : null; }

/* ---------- las monedas del día ---------- */
function stGet(){
  const s = store.get(KEY, null);
  return s && typeof s === "object" && s.v === 1 ? s : {v: 1, day: {d: "", c: 0}, n: 0};
}
function left(){ const s = stGet(); return s.day && s.day.d === today() ? Math.max(0, DAY_CAP - (+s.day.c || 0)) : DAY_CAP; }
/* un color cazado: cuenta y devuelve las monedas que tocan (n, o lo que quede hasta el tope del día) */
function pay(n){
  const s = stGet(), d = today();
  if(!s.day || s.day.d !== d) s.day = {d, c: 0};
  const p = Math.max(0, Math.min(n, DAY_CAP - (+s.day.c || 0)));
  s.day.c = (+s.day.c || 0) + p; s.n = (+s.n || 0) + 1;
  store.set(KEY, s);
  return p;
}

/* ---------- medir el color ---------- */
function hsv(r, g, b){
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if(d){
    h = mx === r ? (g - b) / d : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if(h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}
const inHue = (c, h) => c.hue.some(([a, b]) => h >= a && h <= b);
/* rgba: los bytes de getImageData → qué parte es de cada color, la luz media y el color que más hay */
function classify(rgba){
  const cnt = {}; COLORS.forEach(c => { cnt[c.id] = 0; });
  let vs = 0, n = 0;
  for(let i = 0; i + 3 < rgba.length; i += 4){
    const [h, s, v] = hsv(rgba[i], rgba[i + 1], rgba[i + 2]);
    vs += v; n++;
    for(const c of COLORS) if(s >= c.s && v >= c.v && inHue(c, h)){ cnt[c.id]++; break; }
  }
  const frac = {}; let top = null;
  COLORS.forEach(c => { frac[c.id] = n ? cnt[c.id] / n : 0; if(!top || frac[c.id] > frac[top]) top = c.id; });
  return {frac, v: n ? vs / n : 0, top, n};
}
/* el rectángulo del vídeo que se ve dentro del cuadro: el vídeo llena su caja con object-fit: cover (centrado), así que
   el centro de la caja es el centro del vídeo y sc = cuántos px de pantalla mide un px del vídeo */
function frameRect(v, frac){
  const vw = v.videoWidth, vh = v.videoHeight; if(!vw || !vh) return null;
  const r = v.getBoundingClientRect(); if(!r.width || !r.height) return null;
  const sc = Math.max(r.width / vw, r.height / vh), side = Math.min(Math.min(r.width, r.height) * frac / sc, vw, vh);
  return {sx: (vw - side) / 2, sy: (vh - side) / 2, side};
}
let CV = null, CX = null;
function grid(v, frac){
  const f = frameRect(v, frac); if(!f) return null;
  if(!CV){ CV = D.createElement("canvas"); CV.width = CV.height = GRID; CX = CV.getContext("2d", {willReadFrequently: true}); }
  CX.drawImage(v, f.sx, f.sy, f.side, f.side, 0, 0, GRID, GRID);
  return CX.getImageData(0, 0, GRID, GRID).data;
}
function measure(v, frac = FRAC){
  if(!v) return null;
  try{ const d = grid(v, frac); return d ? classify(d) : null; }catch(e){ return null; }
}
/* tono de piel (de la más clara a la más oscura): naranjas apagados. Nunca se guarda una foto con mucha piel */
const skinLike = (h, s, v) => h >= 5 && h <= 35 && s >= .18 && s < .62 && v >= .3;
/* lo que saldría en la foto (el 80 % de dentro del cuadro): qué parte es del color pedido sin ser piel y qué parte es piel */
function purity(v, id){
  const c = colorOf(id); if(!v || !c) return null;
  try{
    const d = grid(v, FRAC * INNER); if(!d) return null;
    let pure = 0, skin = 0, n = 0;
    for(let i = 0; i + 3 < d.length; i += 4){
      const [h, s, x] = hsv(d[i], d[i + 1], d[i + 2]); n++;
      const sk = skinLike(h, s, x);
      if(sk) skin++; else if(s >= c.s && x >= c.v && inHue(c, h)) pure++;
    }
    return n ? {pure: pure / n, skin: skin / n} : null;
  }catch(e){ return null; }
}
/* ¿se guarda la foto de este color? (interruptor de Para mayores, cámara de atrás, casi todo del color y sin piel) */
function keep(v, id){
  if(typeof H.saveOn === "function" && !H.saveOn()) return false;
  if(CAM.user) return false;
  const p = purity(v, id);
  return !!p && p.pure >= PURE && p.skin < SKIN;
}
/* la foto: solo el 80 % de dentro del cuadro, a 192×192 (como se ve: en espejo con la cámara de delante) */
function crop(v){
  const f = frameRect(v, FRAC * INNER); if(!f) return Promise.resolve(null);
  try{
    const cv = D.createElement("canvas"); cv.width = cv.height = CROP;
    const x = cv.getContext("2d");
    if(CAM.user){ x.translate(CROP, 0); x.scale(-1, 1); }
    x.drawImage(v, f.sx, f.sy, f.side, f.side, 0, 0, CROP, CROP);
    return new Promise(res => { try{ cv.toBlob(b => res(b || null), "image/jpeg", .82); }catch(e){ res(null); } });
  }catch(e){ return Promise.resolve(null); }
}

/* ---------- estado ---------- */
let V = "intro";      /* la pantalla: intro | play | end */
let S = null;         /* la ronda */
let SPK = 0, LOOP = 0, CAMTOK = 0, RO = null, LAST = null;
const CAM = {stream: null, user: false, denied: false, perm: "", busy: false, paused: false, frameAt: 0, ct: -1, fix: 0, restarts: 0};
const STALL = 1500;   /* ms sin fotogramas nuevos: la cámara se ha quedado parada (se arregla sola, ver stall()) */
let CASA = [];        /* las url de las fotos que enseña «Mi casa» */
function newRound(mode){
  revokeShots();
  S = {order: shuffle(COLORS.map(c => c.id)), i: 0, res: {}, shots: [], coins: 0, mode, step: "ask", hold: 0, tap: null, pick: -1,
    note: "", spoke: 0, tipK: "", tipP: null, last: null};
}
const cur = () => S && S.i < S.order.length ? colorOf(S.order[S.i]) : null;
const okRes = r => r === "cam" || r === "tap";
function revokeShots(){ if(S) S.shots.forEach(x => { try{ URL.revokeObjectURL(x.url); }catch(e){} }); }
function revokeCasa(){ CASA.forEach(u => { try{ URL.revokeObjectURL(u); }catch(e){} }); CASA = []; }

/* ---------- la voz ---------- */
/* la frase con la voz del idioma y después la palabra (su mp3); sin voz de ese idioma, solo la palabra */
function speakAsk(){
  const c = cur(); if(!c || V !== "play") return;
  const tok = ++SPK, L = lang, wd = word(c, L)[0], text = phrase(c, L).text, btn = $id("hn-say");
  S.spoke = Date.now();
  const then = () => { if(tok === SPK && onRoute() && V === "play") sayP(wd, $id("hn-say")); };
  if(!hasVoice(L)) return then();
  try{ speechSynthesis.cancel(); }catch(e){}
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate; useVoice(u, L);
  let done = false;
  const off = () => { const b = $id("hn-say"); if(b) b.classList.remove("playing"); };
  const fin = () => { if(done) return; done = true; off(); if(tok === SPK) setTimeout(then, 180); };
  u.onend = fin;
  u.onerror = e => {
    if(e && (e.error === "interrupted" || e.error === "canceled")){ done = true; off(); return; }   /* otro sonido la cortó */
    if(!retryLocal(u, e, fin)) fin();
  };
  if(btn) btn.classList.add("playing");
  setTimeout(fin, 1800 + text.length * 120 / Math.max(.3, rate));
  setTimeout(() => { if(tok === SPK && !done) try{ speechSynthesis.speak(u); }catch(e){ fin(); } }, 30);
}

/* ---------- la cámara ---------- */
async function getCam(){
  if(!camApi()){ const e = new Error("Sin cámara"); e.name = "NoApi"; throw e; }
  const md = navigator.mediaDevices;
  try{
    return await md.getUserMedia({video: {facingMode: {ideal: "environment"}, width: {ideal: 640}, height: {ideal: 480}}, audio: false});
  }catch(e){
    if(e && (e.name === "OverconstrainedError" || e.name === "ConstraintNotSatisfiedError")) return md.getUserMedia({video: true, audio: false});
    throw e;
  }
}
async function camOn(){
  const tok = ++CAMTOK;
  CAM.busy = true; CAM.paused = false;
  const w = $id("hn-wait"); if(w){ w.hidden = false; w.textContent = "Abriendo la cámara…"; }
  let s;
  try{ s = await getCam(); }
  catch(e){ if(tok === CAMTOK){ CAM.busy = false; camFail(e); } return; }
  if(tok !== CAMTOK || !onRoute() || D.hidden || V !== "play" || !S || S.mode !== "cam"){   /* se fue mientras pedía permiso */
    s.getTracks().forEach(t => { try{ t.stop(); }catch(e){} });
    if(tok === CAMTOK) CAM.busy = false;
    return;
  }
  CAM.busy = false; CAM.stream = s; CAM.denied = false;
  let fm = ""; try{ const t = s.getVideoTracks()[0]; fm = (t && t.getSettings && t.getSettings().facingMode) || ""; }catch(e){}
  CAM.user = fm === "user";
  s.getVideoTracks().forEach(t => {
    t.addEventListener("ended", () => {   /* se desenchufó o se quitó el permiso */
      if(CAM.stream !== s) return;
      stopCam();
      if(onRoute() && V === "play" && S && S.mode === "cam" && S.step === "ask"){ CAM.paused = true; showPause(); }
    });
    /* iPhone: la pista se calla un momento (otra app, una llamada, un sonido) y vuelve: el vídeo, otra vez en marcha */
    t.addEventListener("unmute", () => { if(CAM.stream === s) attach(); });
  });
  attach();
}
function camFail(e){
  const n = e && e.name;
  CAM.denied = n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError";
  toTap(CAM.denied ? "La cámara no tiene permiso. ¡Juega tocando! Un mayor puede permitirla en los ajustes del navegador."
    : n === "NotFoundError" || n === "DevicesNotFoundError" || n === "OverconstrainedError" ? "No encuentro ninguna cámara. ¡Juega tocando!"
    : n === "NotReadableError" || n === "TrackStartError" || n === "AbortError" ? "La cámara está ocupada con otra app. ¡Juega tocando!"
    : n === "NoApi" ? "Aquí no se puede usar la cámara. ¡Juega tocando!" : "No se ha podido abrir la cámara. ¡Juega tocando!");
}
/* el vídeo de la cámara en marcha. En el iPhone: playsinline y muted siempre (si no, no arranca o sale a pantalla
   completa), play() después de cada srcObject, y un play() que no contesta no deja la ronda parada (a los 1,5 s se sigue
   igual; stall() vigila que lleguen fotogramas) */
function attach(){
  const v = $id("hn-v"), vf = $id("hn-vf"); if(!v || !CAM.stream) return;
  v.muted = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("muted", "");
  /* parado con su pista (el iPhone lo para al sonar algo y luego play() no contesta): con la pista otra vez, arranca */
  if(v.paused && v.srcObject && v.srcObject === CAM.stream) try{ v.srcObject = null; }catch(e){}
  if(v.srcObject !== CAM.stream) v.srcObject = CAM.stream;
  if(vf) vf.classList.toggle("is-user", CAM.user);
  frames(v);
  CAM.frameAt = performance.now();
  let went = false;
  const go = () => {
    if(went) return; went = true;
    if(v !== $id("hn-v") || !CAM.stream) return;
    const w = $id("hn-wait"); if(w) w.hidden = true;
    if(S && S.step === "ask" && S.mode === "cam" && !CAM.paused) loopStart();
  };
  let p = null; try{ p = v.play(); }catch(e){}
  if(S && S.step !== "ask") return;
  if(p && typeof p.then === "function"){ p.then(go, go); setTimeout(go, STALL); } else go();
}
/* cuándo llegó el último fotograma (requestVideoFrameCallback; si no hay, currentTime que avanza) y, si el navegador
   para el vídeo por su cuenta (el iPhone lo hace al sonar algo), otra vez en marcha */
function frames(v){
  if(v._hnf) return; v._hnf = true;
  if(typeof v.requestVideoFrameCallback === "function"){
    const f = () => { if(!v.isConnected) return; CAM.frameAt = performance.now(); CAM.fix = 0; v.requestVideoFrameCallback(f); };
    v.requestVideoFrameCallback(f);
  }
  v.addEventListener("pause", () => setTimeout(() => {
    if(v === $id("hn-v") && v.paused && CAM.stream && v.srcObject === CAM.stream && V === "play" && S && S.mode === "cam" && !CAM.paused && !D.hidden) attach();
  }, 0));
}
/* la cámara se ha quedado parada (ningún fotograma en STALL ms, o la pista se acabó): 1.º otra vez el vídeo con su
   pista; 2.º la cámara de nuevo (un solo getUserMedia); 3.º «La cámara está en pausa» con «Seguir» (un toque) */
function stall(t){
  const v = $id("hn-v"); if(!v || !CAM.stream || !S || S.step !== "ask" || S.mode !== "cam" || CAM.paused || CAM.busy) return;
  if(typeof v.requestVideoFrameCallback !== "function" && v.currentTime !== CAM.ct){ CAM.ct = v.currentTime; CAM.frameAt = t; CAM.fix = 0; }
  const tr = CAM.stream.getVideoTracks()[0], gone = !tr || tr.readyState === "ended";
  if(!gone && t - CAM.frameAt < STALL) return;
  CAM.frameAt = t;
  if(!gone && CAM.fix === 0){ CAM.fix = 1; try{ v.srcObject = null; }catch(e){} attach(); return; }
  if(CAM.restarts < 2){ CAM.fix = 2; CAM.restarts++; stopCam(); camOn(); return; }
  stopCam(); CAM.paused = true; S.hold = 0; ring(0); showPause();
}
function stopCam(){
  CAMTOK++; loopStop(); CAM.busy = false;
  const s = CAM.stream; CAM.stream = null;
  if(s) s.getTracks().forEach(t => { try{ t.stop(); }catch(e){} });
  const v = $id("hn-v");
  if(v){ try{ v.pause(); }catch(e){} try{ v.srcObject = null; }catch(e){} }
}
function loopStart(){
  loopStop();
  let last = 0;
  const tick = t => {
    LOOP = requestAnimationFrame(tick);
    if(last && t - last < STEP) return;
    const dt = last ? Math.min(200, t - last) : STEP; last = t;
    sample(dt);
    stall(performance.now());
  };
  LOOP = requestAnimationFrame(tick);
}
function loopStop(){ if(LOOP) cancelAnimationFrame(LOOP); LOOP = 0; }
async function permState(){
  CAM.perm = "";
  try{
    if(!navigator.permissions || typeof navigator.permissions.query !== "function") return;
    const p = await Promise.race([navigator.permissions.query({name: "camera"}), new Promise(r => setTimeout(() => r(null), 400))]);
    CAM.perm = (p && p.state) || "";
  }catch(e){}
}

/* ---------- jugar con la cámara ---------- */
function sample(dt){
  const v = $id("hn-v"), c = cur();
  if(!v || !c || !S || S.step !== "ask" || S.mode !== "cam" || v.readyState < 2) return;
  const r = measure(v); if(!r) return;
  LAST = r;
  const ok = r.frac[c.id] >= NEED && r.v >= DIM;
  S.hold = Math.max(0, Math.min(HOLD, S.hold + (ok ? dt : -1.5 * dt)));
  ring(S.hold / HOLD);
  const other = !ok && r.top && r.top !== c.id && r.frac[r.top] >= NEED ? r.top : null;
  tip(ok ? "ok" : r.v < DIM ? "dark" : other ? "other:" + other : "aim", dt);
  if(ok && S.hold >= HOLD) found(v);
}
function tipHtml(k, c){
  if(k === "ok") return "¡Eso es! Quieto un momento…";
  if(k === "dark") return "Hay poca luz. Busca un sitio con más luz.";
  if(k.startsWith("other:")){
    const o = colorOf(k.slice(6));
    if(o) return `Eso es ${esc(o.n)} (<span lang="${code()}">${esc(word(o)[0])}</span>). Busca algo ${esc(c.n)}.`;
  }
  return `Pon algo ${esc(c.n)} dentro del cuadro.`;
}
/* el aviso de abajo: «¡Eso es!» al momento; los demás, si duran casi medio segundo (que no parpadee) */
function tip(k, dt){
  if(k === S.tipK){ S.tipP = null; return; }
  if(k !== "ok"){
    if(!S.tipP || S.tipP.k !== k){ S.tipP = {k, t: 0}; return; }
    S.tipP.t += dt; if(S.tipP.t < 450) return;
  }
  S.tipK = k; S.tipP = null;
  const el = $id("hn-tip"); if(!el) return;
  el.innerHTML = tipHtml(k, cur()); el.classList.toggle("is-ok", k === "ok");
}
function ring(p){
  const pr = $id("hn-pr"); if(pr) pr.style.strokeDashoffset = String(Math.round((1 - Math.max(0, Math.min(1, p))) * 1000) / 10);
  const fr = $id("hn-frame"); if(fr) fr.classList.toggle("is-hot", p > 0);
}
function found(v){
  const c = cur(); if(!c || !S || S.step !== "ask") return;
  S.step = "found"; S.res[c.id] = "cam"; loopStop();
  const ok = keep(v, c.id), shot = ok ? crop(v) : null;   /* sin foto (piel, otros colores, selfi o apagado): el color vale igual */
  /* el vídeo NO se pausa: en el iPhone, pause() y luego play() con la cámara deja la imagen congelada para siempre */
  const paid = pay(CAM_PAY); S.coins += paid;
  S.last = {paid, capped: paid < CAM_PAY, saved: ok ? null : "skip"};
  ring(1);
  const fr = $id("hn-frame"), okm = $id("hn-okm");
  if(okm){ okm.hidden = false; mo("ok", okm); }
  haptic("success");
  mo("burst", fr, {colors: [c.hex, "#FFCC00", "#008198"], n: 14});
  swapTip();
  paintTop(); paintDock();
  if(paid > 0) award(paid, "¡Color cazado!", false, fr || undefined);
  SPK++; sayP(word(c)[0], $id("hn-say"));
  if(!ok){ bus.emit("hunt-found", {color: c.id, mode: "cam", saved: false, coins: paid}); return; }
  save(shot, c).then(id => {
    if(S && S.last && S.order[S.i] === c.id) S.last.saved = !!id;
    paintSaved(!!id);
    /* el recorte guardado queda dentro del cuadro hasta el color siguiente */
    const fr2 = $id("hn-frame"), sh = id && S && S.step === "found" && S.order[S.i] === c.id && S.shots.find(x => x.id === id);
    if(fr2 && sh && !fr2.querySelector(".hn-still")) fr2.insertAdjacentHTML("afterbegin", `<img class="hn-still" src="${sh.url}" alt="">`);
    bus.emit("hunt-found", {color: c.id, mode: "cam", saved: !!id, coins: paid});
  });
}
async function save(shotP, c){
  const m = media(), b = await shotP;
  if(!m || !b) return null;
  try{
    const buf = await b.arrayBuffer(), t = Date.now();
    const rec = {id: `hunt-${t.toString(36)}${Math.random().toString(36).slice(2, 6)}`, kind: "photo", src: "hunt", t, type: "image/jpeg",
      w: CROP, h: CROP, buf, color: c.id, lang: abOf(), day: today()};
    await m.put(rec);
    if(S) S.shots.push({id: rec.id, color: c.id, url: URL.createObjectURL(b)});
    const all = await photos();
    for(const x of all.slice(KEEP)) await m.del(x.id);
    try{ m.persist(); }catch(e){}
    H._set(Math.min(all.length, KEEP));
    return rec.id;
  }catch(e){ console.warn("[cazador] no se ha podido guardar la foto:", e && e.message); return null; }
}
async function photos(){
  const m = media(); if(!m) return [];
  try{ return (await m.list("photo")).filter(x => x && x.src === "hunt"); }catch(e){ return []; }
}
function paintSaved(ok){
  const el = $id("hn-saved"); if(!el) return;
  el.classList.toggle("is-no", !ok);
  el.innerHTML = ok ? `${ico("house", "fill", 18)}<span>Guardado en Mi casa</span>` : `<span>No se ha podido guardar la foto.</span>`;
}

/* ---------- jugar tocando ---------- */
function tapOpts(c){
  const one = id => { const l = THINGS[id] || []; const x = l[Math.floor(Math.random() * l.length)] || ["", ""]; return {t: x[0], img: x[1], ref: x[2] || "", color: id}; };
  return shuffle([Object.assign(one(c.id), {ok: true}), ...COLORS.filter(x => x.id !== c.id).map(x => Object.assign(one(x.id), {ok: false}))]);
}
function preloadTap(){
  Object.values(THINGS).forEach(l => l.forEach(x => { const i = new Image(); i.decoding = "async"; i.src = x[1]; }));
}
function answer(i){
  if(!S || S.mode !== "tap" || S.step !== "ask" || !S.tap || !S.tap[i]) return;
  const c = cur(), o = S.tap[i];
  S.pick = i; S.step = o.ok ? "ok" : "miss"; S.res[c.id] = o.ok ? "tap" : "miss";
  const paid = o.ok ? pay(TAP_PAY) : 0; S.coins += paid;
  S.last = {paid, capped: o.ok && paid < TAP_PAY, saved: null};
  markOpts();
  const btn = D.querySelector(`.hn-opt[data-i="${i}"]`), right = D.querySelector(".hn-opt.is-ok");
  if(o.ok){
    haptic("success"); mo("ok", btn);
    mo("burst", btn, {colors: [c.hex, "#FFCC00", "#008198"], n: 12});
    if(paid > 0) award(paid, "¡Muy bien!", false, btn || undefined);
    bus.emit("hunt-found", {color: c.id, mode: "tap", saved: false, coins: paid});
  } else {
    const ck = right && right.querySelector("svg.chk"); if(ck) mo("ok", ck);   /* (al fallar no vibra) */
  }
  swapTip(); paintTop(); paintDock();
  SPK++; sayP(word(c)[0], $id("hn-say"));
}
function markOpts(){
  if(!S || !S.tap) return;
  D.querySelectorAll(".hn-opt").forEach(b => {
    const k = +b.dataset.i, o = S.tap[k]; if(!o) return;
    const mk = b.querySelector(".hn-mk");
    b.classList.remove("is-ok", "is-miss", "is-dim");
    b.setAttribute("aria-disabled", "true");
    let st = "";
    if(o.ok){ b.classList.add("is-ok"); if(mk) mk.innerHTML = CHK(22); st = k === S.pick ? "¡bien!" : "este era"; }
    else if(k === S.pick){ b.classList.add("is-miss"); if(mk) mk.innerHTML = XM(20); st = "no es"; }
    else b.classList.add("is-dim");
    const vh = b.querySelector(".vh"); if(vh) vh.textContent = st ? ` (${st})` : "";
  });
}

/* ---------- pintar ---------- */
function topHtml(){
  const k = S.i + 1, n = S.order.length;
  return `<div class="hn-top" id="hn-top"><div class="hn-dots" role="img" aria-label="Color ${Math.min(k, n)} de ${n}">${S.order.map((id, j) => {
    const c = colorOf(id), r = S.res[id], cls = okRes(r) ? "is-ok" : r ? "is-miss" : j === S.i ? "is-cur" : "";
    return `<span class="hn-dot ${cls}" data-c="${id}" style="--c:${c.hex}">${cls === "is-ok" ? CHK(16) : ""}</span>`;
  }).join("")}</div></div>`;
}
function askHtml(c){
  const L = lang, p = phrase(c, L), [w, ipa] = word(c, L), cd = code(L);
  /* jugando tocando, el resultado ocupa el sitio de la pregunta (así todo cabe sin scroll en el móvil) */
  const got = S.mode === "tap" && S.step !== "ask";
  return `<section class="hn-ask" id="hn-ask"${got ? "" : ` aria-labelledby="hn-q"`} style="--c:${c.hex}">
    ${got ? gotHtml() : `<p class="hn-q" id="hn-q" lang="${cd}">${esc(p.pre)}<mark class="hn-cw">${esc(p.w)}</mark>${esc(p.post)}</p>`}
    <div class="hn-wr"><img class="hn-sw" src="${esc(c.img)}" alt="" width="56" height="56" draggable="false">
      <p class="hn-wt"><b lang="${cd}">${esc(w)}</b>${ipaHtml(ipa, cd)}<span class="hn-es">${esc(c.n)}</span></p>
      <button type="button" class="hn-spk" id="hn-say" data-key="space" aria-label="Escuchar" title="Escuchar">${ico("speaker-high", "fill", 24)}</button>
      <button type="button" class="hn-slow" id="hn-slow" data-key="shift+space" aria-label="Escuchar despacio" title="Despacio">${ico("turtle", "fill", 26)}</button></div>
  </section>`;
}
function gotHtml(){
  const c = cur(), [w] = word(c), cd = code(), L = S.last || {};
  if(S.step === "miss") return `<section class="hn-got is-miss" id="hn-got" role="status"><p class="hn-got-t">Mira, esto es ${esc(c.n)}: <b lang="${cd}">${esc(w)}</b></p></section>`;
  const cam = S.mode === "cam";
  return `<section class="hn-got" id="hn-got" role="status"><p class="hn-got-t">${cam ? "¡Lo encontraste!" : "¡Muy bien!"} <b lang="${cd}">${esc(w)}</b></p>
    ${cam && L.saved !== "skip" ? `<p class="hn-got-s${L.saved === false ? " is-no" : ""}" id="hn-saved">${L.saved === false ? "<span>No se ha podido guardar la foto.</span>"
      : `${ico("house", "fill", 18)}<span>${L.saved ? "Guardado en Mi casa" : "Guardando en Mi casa…"}</span>`}</p>` : ""}
    ${L.capped ? `<p class="hn-got-n">Hoy ya ganaste todas las monedas del cazador. ¡Sigue jugando!</p>` : ""}</section>`;
}
const tipStart = c => S.mode === "cam" ? tipHtml(S.tipK || "aim", c) : `Toca lo que es ${esc(c.n)}.`;
function camHtml(c){
  const done = S.step !== "ask", shot = done && S.shots.find(x => x.color === c.id);
  return `<div class="hn-vf${CAM.user ? " is-user" : ""}" id="hn-vf" style="--c:${c.hex}">
    <video id="hn-v" playsinline muted autoplay disablepictureinpicture aria-label="Lo que ve la cámara"></video>
    <div class="hn-frame${done ? " is-hot" : ""}" id="hn-frame" aria-hidden="true">
      ${shot ? `<img class="hn-still" src="${shot.url}" alt="">` : ""}
      <svg class="hn-ring" viewBox="0 0 100 100" focusable="false"><rect class="tr" x="2" y="2" width="96" height="96" rx="14"/>
        <rect class="pr" id="hn-pr" x="2" y="2" width="96" height="96" rx="14" pathLength="100" style="stroke-dashoffset:${done ? 0 : 100}"/></svg>
      <span class="hn-okm" id="hn-okm"${done ? "" : " hidden"}>${CHK(40)}</span></div>
    <p class="hn-wait" id="hn-wait"${done ? " hidden" : ""}>Abriendo la cámara…</p>
  </div>
  ${done ? gotHtml() : `<p class="hn-tip${S.tipK === "ok" ? " is-ok" : ""}" id="hn-tip" role="status">${tipStart(c)}</p>`}`;
}
function tapHtml(c){
  if(!S.tap) S.tap = tapOpts(c);
  const cd = code();
  return `<div class="hn-opts" id="hn-opts" role="group" aria-label="Toca lo que es ${esc(c.n)}">${S.tap.map((o, i) => { const w = thingWord(o.ref);
    return `<button type="button" class="hn-opt" data-i="${i}" data-c="${o.color}" data-key="${i + 1}" data-key-pos="in">
      <span class="hn-opt-pic"><img src="${esc(o.img)}" alt="" width="160" height="160" draggable="false"></span>
      ${w ? `<span class="hn-opt-t" lang="${cd}">${esc(w[0])}</span>${ipaHtml(w[1], cd)}<small class="hn-opt-es">${esc(o.t)}<span class="vh"></span></small>`
        : `<span class="hn-opt-t">${esc(o.t)}<span class="vh"></span></span>`}<span class="hn-mk" aria-hidden="true"></span></button>`; }).join("")}</div>
  ${S.step !== "ask" ? "" : `<p class="vh" id="hn-tip" role="status">${tipStart(c)}</p>`}`;
}
function introHtml(){
  const api = camApi(), blocked = CAM.perm === "denied" || CAM.denied;
  const note = !api ? "Aquí no se puede usar la cámara. ¡Juega tocando!"
    : blocked ? "La cámara no tiene permiso. Un mayor puede permitirla en los ajustes del navegador. ¡También puedes jugar tocando!" : "";
  const cam = api ? `<button type="button" class="glass-btn${blocked ? "" : " glass-btn--pri"} glass-btn--lg glass-btn--block" id="hn-start"${blocked ? "" : ` data-key="enter"`}>${ico("camera", "bold", 22)}<span>${blocked ? "Probar la cámara" : "Usar la cámara"}</span></button>` : "";
  const tap = `<button type="button" class="glass-btn${!api || blocked ? " glass-btn--pri" : ""} glass-btn--lg glass-btn--block" id="hn-tap0"${!api || blocked ? ` data-key="enter"` : ""}>${ico("hand-pointing", "bold", 22)}<span>Jugar tocando</span></button>`;
  return `<section class="hn-intro" aria-labelledby="hn-in-t">
    <img class="hn-in-pic" src="${IMG}" alt="" width="220" height="220" draggable="false">
    <h1 class="hn-in-t" id="hn-in-t">Cazador de cosas</h1>
    <p class="hn-in-p">${typeof H.saveOn === "function" && !H.saveOn() ? "Para jugar, la app mira por la cámara. Nada sale del aparato."
      : "La app mira por la cámara y guarda un trocito pequeño de cada cosa en Mi casa. Todo se queda en este aparato."}</p>
    ${note ? `<p class="hn-note" id="hn-note">${note}</p>` : ""}
    <div class="hn-in-b">${!api || blocked ? tap + cam : cam + tap}</div>
  </section>`;
}
function endHtml(){
  const n = S.order.filter(id => okRes(S.res[id])).length, cd = code();
  const t = n === S.order.length ? `¡Cazaste los ${n} colores!` : n ? `¡Cazaste ${plural(n, "color", "colores")}!` : "¡Buen intento!";
  const items = S.order.map(id => {
    const c = colorOf(id), ok = okRes(S.res[id]), sh = S.shots.find(x => x.color === id), [w, ipa] = word(c);
    return `<li class="hn-end-c${ok ? " is-ok" : " is-miss"}" style="--c:${c.hex}"><span class="hn-end-pic${sh ? " is-photo" : ""}">${sh
      ? `<img src="${sh.url}" alt="Tu foto de algo ${esc(c.n)}" width="192" height="192">` : `<img src="${esc(c.img)}" alt="" width="220" height="220">`}${ok ? `<span class="hn-end-ok">${CHK(18)}</span>` : ""}</span>
      <b lang="${cd}">${esc(w)}</b>${ipaHtml(ipa, cd)}</li>`;
  }).join("");
  return `<section class="hn-end" aria-labelledby="hn-end-t"><div class="hn-fox">${heroHtml(120)}</div>
    <h1 class="hn-end-t" id="hn-end-t">${t}</h1>
    ${S.coins ? `<p class="hn-end-s">+${plural(S.coins, "moneda", "monedas")}</p>` : ""}
    <ul class="hn-end-l">${items}</ul>
    ${S.shots.length ? `<p class="hn-end-m">${ico("house", "fill", 18)}<span>Tus fotos están en Mi casa.</span></p>` : ""}
    ${left() === 0 ? `<p class="hn-note">Hoy ya ganaste todas las monedas del cazador. ¡Mañana hay más!</p>` : ""}
  </section>`;
}
function dockHtml(){
  if(V === "intro") return "";
  if(V === "end") return `${S.shots.length || H.count() ? `<a class="glass-btn glass-btn--lg" id="hn-casa" href="#/album/casa">${ico("house", "fill", 20)}<span>Ver Mi casa</span></a>` : ""}
    <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="hn-again" data-key="enter">${ico("arrows-clockwise", "bold", 20)}<span>Otra vez</span></button>`;
  if(S.step !== "ask"){
    const last = S.i >= S.order.length - 1;
    return `<button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="hn-next" data-key="enter"><span>${last ? "Terminar" : "Siguiente color"}</span>${ico("caret-right", "bold", 20)}</button>`;
  }
  if(S.mode === "cam") return `<button type="button" class="glass-btn glass-btn--lg" id="hn-tap" aria-label="Jugar tocando">${ico("hand-pointing", "bold", 22)}<span>Tocar</span></button>
    <button type="button" class="glass-btn glass-btn--lg" id="hn-skip">${ico("arrows-clockwise", "bold", 20)}<span>Otro color</span></button>`;
  return camApi() && !CAM.denied ? `<button type="button" class="glass-btn glass-btn--lg" id="hn-cam">${ico("camera", "bold", 22)}<span>Usar la cámara</span></button>` : "";
}
function paintDock(){ const d = $id("hn-dock"); if(d) d.innerHTML = dockHtml(); }
function paintTop(){ const t = $id("hn-top"); if(t && S) t.outerHTML = topHtml(); }
function swapTip(){
  const t = $id("hn-tip"), g = $id("hn-got"), html = gotHtml();
  if(S && S.mode === "tap"){
    /* tocando: el resultado va en la tarjeta de la pregunta, en lugar de «Find something red!» */
    const q = $id("hn-q"), a = $id("hn-ask");
    if(t) t.remove();
    if(q) q.outerHTML = html; else if(g) g.outerHTML = html;
    if(a) a.removeAttribute("aria-labelledby");
    fitTap(true);
    return;
  }
  if(t) t.outerHTML = html; else if(g) g.outerHTML = html;
}
function showPause(){
  const vf = $id("hn-vf"); if(!vf) return;
  const w = $id("hn-wait"); if(w) w.hidden = true;
  if(!$id("hn-pause")) vf.insertAdjacentHTML("beforeend", `<div class="hn-pause" id="hn-pause"><p>La cámara está en pausa.</p>
    <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="hn-resume" data-key="enter">${ico("play", "fill", 20)}<span>Seguir</span></button></div>`);
}
function fitFrame(){
  const vf = $id("hn-vf"); if(RO){ RO.disconnect(); RO = null; }
  if(!vf) return;
  const set = () => { const r = vf.getBoundingClientRect(); if(r.width && r.height) vf.style.setProperty("--hn-fs", Math.round(Math.min(r.width, r.height) * FRAC) + "px"); };
  set();
  if("ResizeObserver" in W){ RO = new ResizeObserver(set); RO.observe(vf); }
}
/* tocando: si la pantalla no cabe (una pregunta de dos líneas, un móvil bajo), los dibujos se encogen lo justo, sin
   bajar de 118 px de alto (el dibujo, ≥ 110) */
function fitTap(keep){
  const h = $id("hn"); if(!h || !S || S.mode !== "tap" || V !== "play") return;
  /* keep: tras contestar no crecen (nada salta); solo se encogen si ahora no cabe */
  if(!keep) h.style.removeProperty("--hn-pic");
  const ps = [...h.querySelectorAll(".hn-opt-pic")]; if(!ps.length) return;
  const over = (D.scrollingElement || D.documentElement).scrollHeight - innerHeight;
  if(over <= 0) return;
  const rows = new Set(ps.map(p => Math.round(p.getBoundingClientRect().top))).size || 1;
  h.style.setProperty("--hn-pic", Math.max(118, Math.floor(ps[0].getBoundingClientRect().height - over / rows)) + "px");
}
W.addEventListener("resize", () => { if(onRoute()) fitTap(); });
try{ D.fonts.ready.then(() => { if(onRoute()) fitTap(); }); }catch(e){}
function render(){
  const app = $("#app"); if(!app || !onRoute()) return;
  css();
  let body;
  if(V === "intro") body = introHtml();
  else if(V === "end") body = endHtml();
  else {
    const c = cur();
    body = topHtml() + askHtml(c) + (S.note ? `<p class="hn-note" id="hn-note">${esc(S.note)}</p>` : "") + (S.mode === "cam" ? camHtml(c) : tapHtml(c));
  }
  app.innerHTML = `<div class="hn" id="hn" data-v="${V}" data-mode="${S ? S.mode : ""}" data-no-renew data-no-hint>${body}<div class="hn-dock" id="hn-dock">${dockHtml()}</div></div>`;
  wire();
  if(V !== "play") return;
  if(S.mode === "tap"){ if(S.step !== "ask") markOpts(); fitTap(); return; }
  fitFrame();
  if(S.step !== "ask") return;
  if(CAM.paused) showPause(); else if(CAM.stream) attach(); else if(!CAM.busy) camOn();
}
function wire(){
  const root = $id("hn"); if(!root) return;
  root.addEventListener("click", e => {
    const b = e.target.closest("button"); if(!b || !root.contains(b)) return;
    if(b.classList.contains("hn-opt")) return answer(+b.dataset.i);
    const c = cur();
    switch(b.id){
      case "hn-say": speakAsk(); break;
      case "hn-slow": if(c){ SPK++; say(word(c)[0], b, true); } break;
      case "hn-start": case "hn-cam": toCam(); break;
      case "hn-tap0": case "hn-tap": toTap(""); break;
      case "hn-skip": next(true); break;
      case "hn-next": next(false); break;
      case "hn-again": again(); break;
      case "hn-resume": { const p = $id("hn-pause"); if(p) p.remove(); CAM.paused = false; CAM.fix = 0; CAM.restarts = 0; if(!CAM.busy) camOn(); break; }
    }
  });
}

/* ---------- pasos ---------- */
function toCam(){
  if(!camApi()) return toTap("Aquí no se puede usar la cámara. ¡Juega tocando!");
  if(!S) newRound("cam");
  else Object.assign(S, {mode: "cam", step: "ask", hold: 0, note: "", tap: null, pick: -1, tipK: "", tipP: null});
  V = "play"; CAM.paused = false; CAM.fix = 0; CAM.restarts = 0;
  render();
  if(Date.now() - S.spoke > 4000) speakAsk();
}
function toTap(note){
  stopCam(); CAM.paused = false;
  if(!S) newRound("tap");
  if(S.step === "found") return;
  Object.assign(S, {mode: "tap", step: "ask", hold: 0, note: note || "", tap: null, pick: -1, tipK: "", tipP: null});
  V = "play";
  preloadTap(); render();
  if(!Object.keys(TW).length) thingWords().then(() => { if(onRoute() && V === "play" && S && S.mode === "tap" && S.step === "ask" && Object.keys(TW).length) render(); });
  if(Date.now() - S.spoke > 4000) speakAsk();
}
function next(skip){
  if(!S || V !== "play") return;
  const c = cur(); if(skip && c && !S.res[c.id]) S.res[c.id] = "skip";
  Object.assign(S, {i: S.i + 1, step: "ask", hold: 0, tap: null, pick: -1, tipK: "", tipP: null, last: null, note: ""});
  CAM.fix = 0; CAM.restarts = 0;
  if(S.i >= S.order.length) return finish();
  const n = cur(), v = $id("hn-v");
  if(S.mode === "cam" && CAM.stream && v && $id("hn-ask")){
    /* la cámara sigue encendida: se cambia lo de alrededor sin tocar el vídeo */
    $id("hn-ask").outerHTML = askHtml(n);
    const nt = $id("hn-note"); if(nt) nt.remove();
    paintTop();
    const vf = $id("hn-vf"); if(vf) vf.style.setProperty("--c", n.hex);
    const okm = $id("hn-okm"); if(okm) okm.hidden = true;
    const st = D.querySelector("#hn-frame .hn-still"); if(st) st.remove();
    ring(0);
    const g = $id("hn-got"); if(g) g.outerHTML = `<p class="hn-tip" id="hn-tip" role="status">${tipHtml("aim", n)}</p>`;
    paintDock();
    attach();
  } else render();
  speakAsk();
}
function finish(){
  stopCam(); CAM.paused = false; SPK++;
  V = "end"; render();
  const n = S.order.filter(id => okRes(S.res[id])).length;
  if(n) haptic("success");
  bus.emit("hunt-end", {found: n, coins: S.coins});
}
function again(){
  const mode = S ? S.mode : "cam";
  newRound(mode === "cam" && camApi() && !CAM.denied ? "cam" : "tap");
  V = "play"; CAM.fix = 0; CAM.restarts = 0;
  if(S.mode === "tap") preloadTap();
  render(); speakAsk();
}
function leave(){
  stopCam(); CAM.paused = false; SPK++;
  if(RO){ RO.disconnect(); RO = null; }
  if(S){ revokeShots(); S = null; }
  V = "intro"; LAST = null;
}
/* ocultar la pestaña: la cámara se apaga; al volver, «Seguir» la enciende otra vez (nunca sola) */
function hide(){
  if(!CAM.stream && !CAM.busy) return;
  stopCam();
  if(onRoute() && V === "play" && S && S.mode === "cam" && S.step === "ask"){ CAM.paused = true; ring(0); S.hold = 0; showPause(); }
}

/* ---------- la ruta ---------- */
async function route(){
  css();
  await Promise.all([words(), thingWords()]);
  if(!onRoute()) return;
  /* la misma pantalla otra vez (cambio de idioma): se sigue donde estaba, con las palabras del idioma nuevo */
  const same = !!S && typeof ROUTE_FROM === "string" && secOf(ROUTE_FROM) === "cazador";
  if(!same){
    leave();
    await permState();
    if(!onRoute()) return;
    if(CAM.perm === "granted" && camApi()){ newRound("cam"); V = "play"; }
  }
  render();
  if(V === "play" && S.step === "ask") setTimeout(() => { if(onRoute()) speakAsk(); }, 350);
}

/* ---------- «Mi casa» (#/album/casa) ---------- */
const when = t => {
  const d = new Date(t), k = dayKey(d), y = new Date(); y.setDate(y.getDate() - 1);
  return k === today() ? "hoy" : k === dayKey(y) ? "ayer" : d.toLocaleDateString("es-ES", {day: "numeric", month: "long"});
};
async function casa(alive){
  css();
  await words();
  const list = await photos();
  if(typeof alive === "function" && !alive()) return;
  revokeCasa();
  H._set(list.length);
  const n = list.length, cd = code(), app = $("#app"); if(!app) return;
  const head = `<section class="hn-ch" aria-labelledby="hn-ch-h"><img class="hn-ch-i" src="${HOUSE}" alt="" width="72" height="72" draggable="false">
    <div class="hn-ch-tx"><h1 class="hn-ch-h" id="hn-ch-h">Mi casa</h1><p class="hn-ch-s">${n ? plural(n, "cosa cazada", "cosas cazadas") : "Aquí salen las cosas que caces"}</p></div>
    ${n ? `<a class="glass-btn glass-btn--pri glass-btn--sm hn-ch-go" href="#/cazador">${ico("camera", "bold", 18)}<span>Cazar</span></a>` : ""}</section>`;
  const note = `<p class="hn-cn">Las fotos son recortes pequeños del centro de la cámara y se quedan en este aparato.${n ? " Mantén pulsada una foto para borrarla." : ""} Un mayor puede borrarlas todas en Ajustes › Para mayores.</p>`;
  if(!n){
    app.innerHTML = `<div class="hn-casa" id="hn-casa" data-no-renew>${head}<section class="hn-ce" aria-label="Todavía no hay fotos">
      <div class="hn-ce-fox">${heroHtml(110)}</div><p class="hn-ce-t">Busca colores con la cámara y aquí guardamos un trocito de cada cosa.</p>
      <a class="glass-btn glass-btn--pri glass-btn--lg" href="#/cazador">${ico("camera", "bold", 22)}<span>Cazar colores</span></a></section>${note}</div>`;
    return;
  }
  const items = list.map(x => {
    const c = colorOf(x.color) || COLORS[0], [w, ipa] = word(c);
    let url = "";
    try{ url = URL.createObjectURL(new Blob([x.buf], {type: x.type || "image/jpeg"})); CASA.push(url); }catch(e){}
    return `<li class="hn-cc" style="--c:${c.hex}" data-id="${esc(x.id)}"><span class="hn-cc-pic">${url ? `<img src="${url}" alt="Foto de algo ${esc(c.n)}" width="192" height="192" decoding="async">` : ""}<span class="hn-cc-dot" aria-hidden="true"></span></span>
      <div class="hn-cc-r"><p class="hn-cc-w"><b lang="${cd}">${esc(w)}</b>${ipaHtml(ipa, cd)}<span class="hn-cc-d">${esc(when(x.t))}</span></p>
        <button type="button" class="hn-spk hn-cc-say" data-say="${esc(w)}" aria-label="Escuchar ${esc(c.n)}" title="Escuchar">${ico("speaker-high", "fill", 20)}</button></div></li>`;
  }).join("");
  app.innerHTML = `<div class="hn-casa" id="hn-casa" data-no-renew>${head}<ul class="hn-cg" id="hn-cg">${items}</ul>${note}</div>`;
  casaMenus(list, alive);
}
/* mantener pulsada una foto: «Oír» y «Borrar esta foto» (con «Deshacer»); también con el clic derecho o la tecla de menú */
function casaMenus(list, alive){
  if(!W.vocabMenu || typeof vocabMenu.hold !== "function") return;
  const cd = code();
  D.querySelectorAll("#hn-cg .hn-cc").forEach(li => {
    const x = list.find(r => r.id === li.dataset.id); if(!x) return;
    const c = colorOf(x.color) || COLORS[0], [w, ipa] = word(c);
    li.tabIndex = 0; li.setAttribute("aria-label", `Foto de algo ${c.n}, ${when(x.t)}. Mantén pulsado para borrarla`);
    vocabMenu.hold(li, {title: w, lang: cd, sub: `Foto de algo ${c.n}`, ipa: ipaHtml(ipa, cd), items: [
      {id: "say", t: "Oír", ic: "speaker-high", st: "fill", say: w},
      {id: "del", t: "Borrar esta foto", ic: "trash", gap: true, fn: () => delPhoto(x, alive)},
    ]}, {fallback: () => {}});
  });
}
async function delPhoto(rec, alive){
  const m = media(); if(!m) return;
  try{ await m.del(rec.id); }catch(e){ return; }
  await casa(alive);
  try{
    if(W.M && typeof M.toast === "function") M.toast("Foto borrada", {icon: ico("trash", "bold", 20),
      action: {t: "Deshacer", fn: async () => { try{ await m.put(rec); }catch(e){ return; } if(/^album\/casa(\/|$)/.test(hashPath())) casa(alive); else H.recount(); }}});
  }catch(e){}
}

/* ---------- estilos ---------- */
const DARK = (s, b) => `:root[data-theme=dark] :is(${s}){${b}}\n@media (prefers-color-scheme:dark){:root:not([data-theme=light]) :is(${s}){${b}}}`;
const STYLE = `
.hn{position:relative;display:flex;flex-direction:column;gap:12px;width:min(100%,640px);margin:0 auto;padding-bottom:calc(var(--btn-main) + 40px)}
.hn[data-v=intro]{padding-bottom:0}
:root[data-focus=cazador] main{overflow-x:hidden;overflow-x:clip}
.hn-top{display:flex;align-items:center;justify-content:center;min-height:var(--tap)}
:root[data-focus] .hn-top{margin-top:calc(-1 * (var(--tap) + 12px));padding:0 92px 0 56px}
.hn-dots{display:flex;align-items:center;gap:10px}
.hn-dot{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--fill);color:#fff;box-sizing:border-box}
.hn-dot.is-cur{background:transparent;border:4px solid var(--c)}
.hn-dot.is-ok{background:var(--c)}
.hn-dot.is-ok[data-c=yellow]{color:#3D2B00}
.hn-dot.is-miss{background:var(--miss-fill)}
/* el pedido */
.hn-ask{display:flex;flex-direction:column;gap:10px;margin:0;padding:14px 16px;border-radius:var(--r-card);background:var(--card);color:var(--label)}
.hn-q{margin:0;font:800 var(--fs-t2)/1.25 var(--f-round);text-wrap:balance;overflow-wrap:anywhere}
.hn-cw{background:none;color:inherit;text-decoration:underline;text-decoration-color:var(--c);text-decoration-thickness:.2em;text-underline-offset:.14em;text-decoration-skip-ink:none}
.hn-wr{display:flex;align-items:center;gap:10px}
.hn-sw{flex:none;width:56px;height:56px;box-sizing:border-box;padding:4px;border-radius:14px;background:var(--fill2);object-fit:contain}
.hn-wt{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:0 10px;margin:0}
.hn-wt b{font:800 var(--fs-t3)/1.2 var(--f-round)}
.hn-wt .ipa{font-size:var(--fs-sub)}
.hn-es{color:var(--label2);font:400 var(--fs-note)/1.3 var(--f-text)}
.hn-spk,.hn-slow{flex:none;display:grid;place-items:center;width:48px;height:48px;margin:0;padding:0;border:0;border-radius:50%;cursor:pointer;-webkit-tap-highlight-color:transparent;
  transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms)}
.hn-spk{background:var(--brand-soft);color:var(--brand-tint)}
.hn-slow{width:44px;height:44px;background:var(--fill2);color:var(--label)}
.hn-spk.playing,.hn-slow.playing{background:var(--brand-fill);color:#fff}
.hn-note{margin:0;padding:10px 14px;border-radius:var(--r-md);background:var(--fill2);color:var(--label);font:400 var(--fs-note)/1.4 var(--f-text)}
/* la cámara y el cuadro */
.hn-vf{position:relative;isolation:isolate;overflow:hidden;height:clamp(220px,calc(100vh - 430px),560px);height:clamp(220px,calc(100dvh - 430px),560px);
  border-radius:var(--r-card);background:#1C1C1E;color:#fff}
.hn-vf video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#1C1C1E}
.hn-vf.is-user video{transform:scaleX(-1)}
.hn-frame{position:absolute;z-index:1;left:50%;top:50%;width:var(--hn-fs,50%);aspect-ratio:1/1;translate:-50% -50%;border-radius:18px;
  box-shadow:0 0 0 100vmax rgb(0 0 0/.34);pointer-events:none}
.hn-still{position:absolute;inset:10%;width:80%;height:80%;border-radius:10px;object-fit:cover}
.hn-ring{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.hn-ring rect{fill:none;stroke-width:3.4}
.hn-ring .tr{stroke:rgb(255 255 255/.92)}
.hn-ring .pr{stroke:var(--c);stroke-width:5;stroke-dasharray:100;opacity:0;transition:stroke-dashoffset 90ms linear,opacity 90ms}
.hn-frame.is-hot .hn-ring .pr{opacity:1}
.hn-okm{position:absolute;inset:0;display:grid;place-items:center;width:76px;height:76px;margin:auto;border-radius:50%;background:var(--ok-fill);color:#fff;
  box-shadow:0 6px 20px rgb(0 0 0/.3)}
.hn-okm[hidden]{display:none}
.hn-wait{position:absolute;z-index:2;left:0;right:0;bottom:16px;margin:0;text-align:center;font:600 var(--fs-sub)/1.3 var(--f-text);color:#fff}
.hn-wait[hidden]{display:none}
.hn-pause{position:absolute;z-index:3;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px;background:#1C1C1E;text-align:center}
.hn-pause p{margin:0;font:700 var(--fs-body)/1.35 var(--f-text);color:#fff}
.hn-tip{margin:0;min-height:48px;padding:12px 14px;border-radius:var(--r-md);background:var(--card);color:var(--label);font:600 var(--fs-sub)/1.35 var(--f-text);
  transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms)}
.hn-tip.is-ok{background:var(--ok-soft);color:var(--label)}
.hn-got{display:flex;flex-direction:column;gap:4px;margin:0;padding:12px 16px;border-radius:var(--r-md);background:var(--ok-soft);color:var(--label)}
.hn-got.is-miss{background:var(--fill2)}
.hn-got-t{margin:0;font:800 var(--fs-head)/1.3 var(--f-round)}
.hn-got-t b{font-weight:800}
.hn-got-s{display:flex;align-items:center;gap:6px;margin:0;font:600 var(--fs-note)/1.35 var(--f-text);color:var(--label)}
.hn-got-s .ico{flex:none;color:var(--ok-ink)}
.hn-got-s.is-no{color:var(--label2)}
.hn-got-n{margin:0;font:400 var(--fs-note)/1.35 var(--f-text);color:var(--label)}
/* jugar tocando */
.hn-opts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
@media (min-width:744px){.hn-opts{grid-template-columns:repeat(4,minmax(0,1fr))}}
.hn-opt{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;margin:0;padding:10px 10px 12px;border:0;border-radius:var(--r-card);
  background:var(--card);color:var(--label);font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:box-shadow var(--d-fast,160ms),background-color var(--d-fast,160ms)}
.hn-opt-pic{display:grid;place-items:center;width:100%;aspect-ratio:1/1;border-radius:18px;background:var(--fill2)}
.hn-opt-pic img{display:block;width:88%;height:88%;object-fit:contain;pointer-events:none;-webkit-user-drag:none;user-select:none}
.hn-opt-t{font:800 var(--fs-sub)/1.2 var(--f-round);text-align:center;overflow-wrap:anywhere}
.hn-opt .ipa{display:block;max-width:100%;font-size:var(--fs-min);line-height:1.25;color:var(--label2);text-align:center}
.hn-opt-es{display:block;color:var(--label2);font:400 var(--fs-min)/1.25 var(--f-text);text-align:center}
.hn[data-mode=tap] .hn-opt{gap:2px;padding:6px 8px 8px}
/* en el móvil, los 4 dibujos caben con todo lo demás sin scroll (≥ 118 px de alto; a lo ancho, cuadrados) */
.hn[data-mode=tap]{padding-bottom:calc(var(--btn-main) + 8px)}
.hn[data-mode=tap] .hn-opt-pic{position:relative;display:block;margin-bottom:4px;min-height:118px;max-height:calc((100vh - 470px) / 2);max-height:var(--hn-pic,calc((100svh - 470px) / 2))}
.hn[data-mode=tap] .hn-opt-pic img{position:absolute;inset:3%;width:94%;height:94%}
.hn[data-mode=tap] .hn-sw{width:48px;height:48px}
.hn-ask .hn-got{margin:-4px -6px 0;padding:8px 12px}
.hn-mk{position:absolute;top:6px;right:6px;display:none;place-items:center;width:40px;height:40px;border-radius:50%;color:#fff}
.hn-opt.is-ok{box-shadow:0 0 0 4px var(--ok-fill)}
.hn-opt.is-ok .hn-mk{display:grid;background:var(--ok-fill)}
.hn-opt.is-miss{background:var(--miss-fill)}
.hn-opt.is-miss .hn-mk{display:grid;background:var(--miss)}
.hn-opt.is-miss img,.hn-opt.is-dim img{filter:grayscale(1);opacity:.5}
.hn-opt[aria-disabled=true]{cursor:default}
.hn-opt:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
/* antes de la cámara */
.hn-intro{display:flex;flex-direction:column;align-items:center;gap:14px;margin:0;padding:24px 20px;border-radius:var(--r-card);background:var(--card);color:var(--label);text-align:center}
.hn-in-pic{display:block;box-sizing:border-box;width:min(52vw,200px);height:auto;aspect-ratio:1/1;padding:10px;border-radius:32px;object-fit:contain}
.hn-in-t{margin:0;font:800 var(--fs-t1)/1.15 var(--f-round)}
.hn-in-p{margin:0;max-width:30ch;font:600 var(--fs-body)/1.4 var(--f-text);text-wrap:balance}
.hn-in-b{display:flex;flex-direction:column;gap:12px;align-self:stretch}
/* el final */
.hn-end{display:flex;flex-direction:column;align-items:center;gap:12px;margin:0;padding:20px 16px;border-radius:var(--r-card);background:var(--card);color:var(--label);text-align:center}
.hn-fox{height:136px;display:grid;place-items:end center}
.hn-fox .hero{animation:hn-hop .62s cubic-bezier(.3,.7,.4,1) .15s 2 both}
@keyframes hn-hop{0%,100%{translate:0 0;rotate:0deg}40%{translate:0 -18px;rotate:-4deg}70%{translate:0 0;rotate:3deg}}
@media (prefers-reduced-motion:reduce){.hn-fox .hero{animation:none}}
:root[data-motion=calm] .hn-fox .hero{animation:none}
.hn-end-t{margin:0;font:800 var(--fs-t1)/1.2 var(--f-round);text-wrap:balance}
.hn-end-s{margin:0;font:700 var(--fs-sub)/1.3 var(--f-text);color:var(--gold-ink)}
.hn-end-l{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-self:stretch;margin:0;padding:0;list-style:none}
@media (min-width:600px){.hn-end-l{grid-template-columns:repeat(4,minmax(0,1fr))}}
.hn-end-c{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0}
.hn-end-c b{font:800 var(--fs-sub)/1.2 var(--f-round)}
.hn-end-c .ipa{font-size:var(--fs-note)}
.hn-end-pic{position:relative;display:grid;place-items:center;width:100%;aspect-ratio:1/1;margin-bottom:4px;border-radius:18px;background:var(--fill2);overflow:hidden}
.hn-end-pic img{width:76%;height:76%;object-fit:contain}
.hn-end-pic.is-photo img{width:100%;height:100%;object-fit:cover}
.hn-end-c.is-miss .hn-end-pic img{filter:grayscale(1);opacity:.45}
.hn-end-ok{position:absolute;top:6px;right:6px;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--ok-fill);color:#fff}
.hn-end-m{display:flex;align-items:center;gap:6px;margin:0;font:600 var(--fs-note)/1.35 var(--f-text);color:var(--label)}
/* abajo, siempre a la vista */
.hn-dock{position:fixed;z-index:5;left:max(16px,var(--safe-l),calc(50% - 320px));right:max(16px,var(--safe-r),calc(50% - 320px));
  bottom:calc(var(--safe-b) + 16px);display:flex;align-items:center;gap:8px;pointer-events:none}
.hn-dock:empty{display:none}
.hn-dock>*{pointer-events:auto;flex:1 1 0;min-width:0}
.hn-dock .glass-btn{padding:0 12px;font-size:var(--fs-sub);white-space:normal;line-height:1.1}
.hn-dock::before{content:"";position:absolute;z-index:-1;left:-16px;right:-16px;top:-20px;bottom:calc(-1 * (var(--safe-b) + 16px));
  background:linear-gradient(to bottom,transparent,var(--bg) 45%);pointer-events:none}
/* «Mi casa» */
.hn-casa{display:flex;flex-direction:column;gap:12px;max-width:960px}
.hn-ch{display:flex;align-items:center;gap:14px;margin:0;padding:14px 16px;border-radius:var(--r-card);background:var(--card);color:var(--label)}
.hn-ch-i{flex:none;width:72px;height:72px;box-sizing:border-box;padding:6px;border-radius:18px;background:var(--fill2);object-fit:contain}
.hn-ch-tx{flex:1;min-width:0}
.hn-ch-h{margin:0;font:700 var(--fs-t2)/1.15 var(--f-round)}
.hn-ch-s{margin:4px 0 0;font:400 var(--fs-sub)/1.3 var(--f-text);color:var(--label2)}
.hn-ch-go{flex:none}
.hn-cg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0;padding:0;list-style:none}
@media (min-width:600px){.hn-cg{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (min-width:900px){.hn-cg{grid-template-columns:repeat(4,minmax(0,1fr))}}
.hn-cc{display:flex;flex-direction:column;gap:8px;min-width:0;padding:8px 8px 10px;border-radius:var(--r-card);background:var(--card);color:var(--label);
  -webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
.hn-cc:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.hn-cc-pic{position:relative;display:block;aspect-ratio:1/1;border-radius:16px;background:var(--fill2);overflow:hidden}
.hn-cc-pic img{display:block;width:100%;height:100%;object-fit:cover}
.hn-cc-dot{position:absolute;left:8px;bottom:8px;width:24px;height:24px;border-radius:50%;background:var(--c);box-shadow:0 0 0 3px #fff}
.hn-cc-r{display:flex;align-items:center;gap:6px;padding:0 2px}
.hn-cc-w{flex:1;min-width:0;display:flex;flex-direction:column;margin:0}
.hn-cc-w b{font:800 var(--fs-sub)/1.2 var(--f-round);overflow-wrap:anywhere}
.hn-cc-w .ipa{font-size:var(--fs-note)}
.hn-cc-d{color:var(--label2);font:400 var(--fs-min)/1.35 var(--f-text)}
.hn-cc .hn-spk{width:44px;height:44px}
.hn-ce{display:flex;flex-direction:column;align-items:center;gap:14px;margin:0;padding:24px 16px;border-radius:var(--r-card);background:var(--card);color:var(--label);text-align:center}
.hn-ce-fox{height:124px;display:grid;place-items:end center}
.hn-ce-t{margin:0;max-width:32ch;font:600 var(--fs-body)/1.4 var(--f-text);text-wrap:balance}
.hn-cn{margin:0;padding:0 4px;color:var(--label2);font:400 var(--fs-note)/1.4 var(--f-text)}
${DARK(".hn-sw,.hn-opt-pic,.hn-end-pic:not(.is-photo),.hn-ch-i,.hn-in-pic", "background:#E8E8ED")}
${DARK(".hn-opt.is-miss .hn-opt-pic,.hn-opt.is-dim .hn-opt-pic,.hn-end-c.is-miss .hn-end-pic", "background:var(--fill2)")}
`;
function css(){
  if($id("css-hunter")) return;
  const s = D.createElement("style"); s.id = "css-hunter"; s.textContent = STYLE; D.head.appendChild(s);
}

/* ---------- apagar la cámara: al salir, al ocultar la pestaña, al cerrar ---------- */
W.addEventListener("hashchange", () => {
  const hp = hashPath();
  if(secOf(hp) !== "cazador") leave();
  if(!/^album\/casa(\/|$)/.test(hp)) revokeCasa();
});
bus.on("route", () => { if(!onRoute()) leave(); });
D.addEventListener("visibilitychange", () => { if(D.hidden) hide(); });
W.addEventListener("pagehide", () => stopCam());

Object.assign(H, {
  loaded: true, route, casa, photos, measure, classify, hsv,
  stop: stopCam,
  COLORS, DAY_CAP, CAM_PAY, TAP_PAY, HOLD, NEED, KEEP, CROP,
  state: () => {
    const c = cur();
    return {view: V, mode: S ? S.mode : null, step: S ? S.step : null, color: c ? c.id : null, i: S ? S.i : 0, total: S ? S.order.length : 0,
      order: S ? S.order.slice() : [], res: S ? Object.assign({}, S.res) : {}, hold: S ? Math.round(S.hold) : 0, coins: S ? S.coins : 0,
      shots: S ? S.shots.map(x => ({id: x.id, color: x.color})) : [], tip: S ? S.tipK : "", left: left(),
      cam: {on: !!CAM.stream, user: CAM.user, denied: CAM.denied, paused: CAM.paused, busy: CAM.busy, perm: CAM.perm, fix: CAM.fix, restarts: CAM.restarts}, reading: LAST};
  },
});
})();
