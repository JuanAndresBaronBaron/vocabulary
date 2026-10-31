/* Módulo parrot (window.vocabParrot): el loro eco de la granja y la cápsula del tiempo (SPEC §5-H).

   Loro eco: #/loro es una pantalla de la pestaña Granja (‹ Granja vuelve). Se entra tocando el loro posado en la valla
   de la derecha de la granja, que este módulo pone en la escena con el bus "farm-mounted" (como js/season.js).
   · Desde Juegos: la tarjeta «Loro eco» (vocabGames.register con href, sección «mas») abre #/loro?t=<tema> con las
     palabras del tema elegido en Juegos que tienen dibujo y audio grabado (con «Mis palabras», o con menos de 3, las
     del repaso de siempre); ‹ Juegos vuelve (rootOf y backOf de index.html miran ?t=) y la pestaña marcada es Jugar
     (placeTab: "loro" pasa de las secs de Granja a las de Jugar antes de que la ruta se pinte).
   · Sale una palabra que el niño ya tiene en el repaso (srs:<lang>; las de caja < 4 salen el triple que las demás) con
     su dibujo, la palabra, su IPA (ipaHtml), el español y su audio grabado (audio/<ab>/<id>.mp3): sin dibujo o sin
     audio no sale. Con menos de 3, las 5 de la cápsula y los animales. Nunca una de las 4 últimas.
   · El botón grande graba: se toca para empezar y para parar (y se para solo tras 0,9 s de silencio, 5 s como mucho) o
     se mantiene pulsado y se suelta (8 s como mucho). MediaRecorder con los mismos tipos y el mismo trato del permiso
     que js/mailbox.js (audio/mp4 en Safari, webm en Chrome). Las pistas del micrófono se paran al acabar y al salir.
   · El loro lo repite con voz aguda (Web Audio: AudioBufferSourceNode con playbackRate ECHO_RATE sobre el trozo con
     voz) y luego suena el audio nativo. Dos ondas en <canvas>, «Tu voz» y «Así se dice», con la misma escala de tiempo;
     mientras graba, «Tu voz» pinta en vivo las barras que avanzan (drawLive, con esa escala) y, tras 1 s sin oír
     nada, sale en gris «Habla un poco más fuerte» (sin cortar la grabación).
   · De 1 a 3 estrellas comparando la duración y el volumen (y la forma de la onda) con el nativo, sin red y sin
     reconocimiento de voz; nunca menos de 1. Los textos lo dicen así («¡Te he oído! Suena muy parecido», «¡Casi
     igual!»): no corrigen la pronunciación. Monedas con award(): PAY por grabar cada palabra (una vez al día por
     palabra, no por estrellas), DAY_CAP al día como mucho, y solo si se le oyó (un silencio no paga).
   · Sin micrófono o sin permiso: el loro dice la palabra, el niño la repite en voz alta y sigue («¡Ya la dije!»).
   · Safari: el AudioContext se crea o se reanuda dentro del toque (pointerup, click, keydown, touchend); para decodificar
     sin él, OfflineAudioContext; los URL.createObjectURL se liberan siempre.
   Cápsula del tiempo: la primera vez que se entra al loro en un mes nuevo (por idioma) se propone grabar las 5 palabras
   fijas (CAP); #/loro/capsula la abre directamente. Cada palabra oída se guarda en IndexedDB con window.vocabMedia (de
   js/mailbox.js, base "vocab-media-user", sin tocar su versión) como {id: "cap-<ab>-<AAAA-MM>-<i>", kind: "capsule", t,
   type, dur, buf (ArrayBuffer), lang, month, i, ref, w} (grabar otra vez la misma la cambia) y al guardar se pide
   vocabMedia.persist() (no pregunta nada: si ya está guardado para siempre, o en Firefox, que lo pregunta con un aviso,
   no se pide). En Premios (js/rewards.js, hueco #rw-voz) la tarjeta «Tu voz en el tiempo» deja oír
   el mes más antiguo frente al más nuevo («Tú en octubre» · «Tú en enero») y cada palabra antes y ahora. «Borrar
   grabaciones y fotos» de Para mayores (js/mailbox.js) borra la base entera, con la cápsula.
   Guardado: localStorage "parrot:st", solo de este aparato (DEVICE_ONLY en js/save.js; nunca va en la partida):
     {v: 1, cap: {en|fr|da: "AAAA-MM" del último mes en que se propuso}, day: {d: "AAAA-MM-DD", c: monedas de hoy,
     w: {ref: estrellas de la vez que se pagó hoy (≥ 1 = ya pagada)}}, last: [refs de las últimas palabras]}. Lo que se graba para practicar se queda
     en memoria y se olvida al cambiar de palabra.
   API: window.vocabParrot = {state, CAP, KEY, DAY_CAP, PAY, ECHO_RATE, month(), analyze(AudioBuffer), stats(frames, paso),
     score(yo, nativo), capRecs(ab?), paintCapsule(el), offer(), next()}. */
(() => {
"use strict";
const W = window, D = document;
const KEY = "parrot:st", IMG = "img/pj/loro.png", KIND = "capsule";
const DAY_CAP = 10;                 /* monedas al día como mucho */
const ECHO_RATE = 1.6;              /* más rápido = más agudo: la voz del loro */
const TAP_MAX = 5000, HOLD_MAX = 8000, SIL_MS = 900, HOLD_MS = 350, MIN_MS = 250;
const FRAME = .02, FLOOR = .006, VOICE = .02, MIN_VOICED = .12;
/* las 5 palabras de la cápsula: las mismas cada mes (tienen dibujo y audio en los tres idiomas) */
const CAP = Object.freeze([["animales", "Perro"], ["animales", "Gato"], ["colores", "Rojo"], ["w03", "manzana"], ["animales", "Conejo"]]
  .map(([d, e]) => Object.freeze({d, e})));
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const isObj = x => !!x && typeof x === "object" && !Array.isArray(x);
const $id = id => D.getElementById(id);
const now = () => performance.now();
const rm = () => (W.M && typeof M.rm === "function") ? M.rm() : (() => { try{ return matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } })();
const IC = (n, s, z, c) => ico(n, s, z, c);
const ab = () => CLIP_AB[lang] || "en";
const code = () => (LANGS[lang] && LANGS[lang].code) || "en-GB";
const onLoro = () => secOf(hashPath()) === "loro";
const onPremios = () => secOf(hashPath()) === "progreso";
const Media = () => { try{ return W.vocabMedia && typeof vocabMedia.ok === "function" && vocabMedia.ok() ? vocabMedia : null; }catch(e){ return null; } };
const month = (d = new Date()) => dayKey(d).slice(0, 7);
const monthName = m => MESES[(parseInt(String(m).slice(5, 7), 10) || 1) - 1] || "";
const live = t => { const el = $id("lr-live"); if(el) el.textContent = t; };
const stopSpeech = () => { try{ if("speechSynthesis" in W) speechSynthesis.cancel(); else if(typeof stopClip === "function") stopClip(); }catch(e){} };
/* el reloj de arena (Phosphor, MIT): no está en el sprite */
const HG = (size = 22) => `<svg class="ico lr-hg" width="${size}" height="${size}" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><path fill="currentColor" d="M200,75.64V40a16,16,0,0,0-16-16H72A16,16,0,0,0,56,40V76a16.07,16.07,0,0,0,6.4,12.8L114.67,128,62.4,167.2A16.07,16.07,0,0,0,56,180v36a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V180.36a16.09,16.09,0,0,0-6.35-12.77L141.27,128l52.38-39.59A16.09,16.09,0,0,0,200,75.64ZM184,180.36V216H72V180l48-36v24a8,8,0,0,0,16,0V144.08Zm0-104.72L178.23,80H77.33L72,76V40H184Z"/></svg>`;

/* ---------- lo guardado (parrot:st) ---------- */
function load(){
  const o = store.get(KEY, null), s = isObj(o) ? o : {};
  const cap = {};
  if(isObj(s.cap)) for(const k of ["en", "fr", "da"]) if(typeof s.cap[k] === "string" && /^\d{4}-\d{2}$/.test(s.cap[k])) cap[k] = s.cap[k];
  const dy = isObj(s.day) && typeof s.day.d === "string" ? s.day : null, w = {};
  if(dy && isObj(dy.w)) for(const k of Object.keys(dy.w)){ const n = Math.floor(+dy.w[k] || 0); if(n > 0) w[k] = Math.min(3, n); }
  return {v: 1, cap, day: {d: dy ? dy.d : "", c: dy ? Math.max(0, Math.min(DAY_CAP, Math.floor(+dy.c || 0))) : 0, w},
    last: Array.isArray(s.last) ? s.last.filter(x => typeof x === "string").slice(-6) : []};
}
const save = s => store.set(KEY, s);

/* ---------- las palabras ---------- */
const MAPS = {};
function clipMap(a){
  if(!MAPS[a]) MAPS[a] = fetch(`audio/${a}.json`).then(r => r.ok ? r.json() : {}).catch(() => ({})).then(m => {
    if(!isObj(m) || !Object.keys(m).length){ delete MAPS[a]; return {}; }
    return m;
  });
  return MAPS[a];
}
async function docOf(id){ try{ return await getDoc(id); }catch(e){ return null; } }
function rowWord(id, doc, es){
  const r = doc && Array.isArray(doc.rows) ? doc.rows.find(x => x && x.es === es && isObj(x.l)) : null;
  const L = r && r.l[lang]; if(!L || !L.word) return null;
  return {ref: id + "|" + es, d: id, es: String(es), img: String(r.img || ""), word: String(L.word), ipa: String(L.ipa || ""), clip: "", wt: 1};
}
function shuffle(a){ for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
let POOL = null;   /* {ab, tp, list, t}: lo que pidió la carga de antes de pintar (ROUTES.loro.load) vale unos segundos */
/* el tema de #/loro?t=<tema> (desde Juegos); "" desde la granja o con «Mis palabras» */
const topicOf = (h = location.hash) => { try{ const t = new URLSearchParams(String(h).split("?")[1] || "").get("t") || ""; return /^[a-z0-9_-]{1,40}$/i.test(t) && t !== "mis" ? t : ""; }catch(e){ return ""; } };
async function pool(tp = topicOf()){
  const a = ab(); if(POOL && POOL.ab === a && POOL.tp === tp && POOL.list.length >= 3 && Date.now() - POOL.t < 15000) return POOL.list;
  const map = await clipMap(a), out = [], seen = new Set();
  const add = (w, wt) => { if(!w || !w.img || seen.has(w.ref)) return; const c = map[speakable(w.word)]; if(!c) return; w.clip = c; w.wt = wt; seen.add(w.ref); out.push(w); };
  /* las del tema de Juegos (con dibujo y audio); con menos de 3, las de siempre */
  if(tp){
    const doc = await docOf(tp);
    if(doc && Array.isArray(doc.rows)) for(const r of doc.rows) if(r && r.es) add(rowWord(tp, doc, r.es), 1);
    if(out.length >= 3){ POOL = {ab: a, tp, list: out, t: Date.now()}; return out; }
    out.length = 0; seen.clear();
  }
  const ents = shuffle(Object.values(srsAll() || {}).filter(x => x && typeof x.d === "string" && typeof x.e === "string"));
  const ids = []; for(const x of ents){ if(!ids.includes(x.d)) ids.push(x.d); if(ids.length >= 8) break; }
  const docs = {}; await Promise.all(ids.map(async id => { docs[id] = await docOf(id); }));
  for(const x of ents) if(docs[x.d]) add(rowWord(x.d, docs[x.d], x.e), (Math.floor(+x.b || 0)) < 4 ? 3 : 1);
  if(out.length < 3){
    for(const c of CAP) add(rowWord(c.d, await docOf(c.d), c.e), 1);
    const an = await docOf("animales");
    if(an) for(const r of an.rows || []) if(r && r.es) add(rowWord("animales", an, r.es), 1);
  }
  POOL = {ab: a, tp, list: out, t: Date.now()};
  return out;
}
/* la siguiente: al azar con peso, nunca una de las 4 últimas */
function pick(list){
  const s = load(), avoid = new Set(s.last.slice(-4));
  let c = list.filter(w => !avoid.has(w.ref)); if(!c.length) c = list.filter(w => w.ref !== s.last[s.last.length - 1]); if(!c.length) c = list;
  let r = Math.random() * c.reduce((n, w) => n + w.wt, 0), w = c[c.length - 1];
  for(const x of c){ r -= x.wt; if(r <= 0){ w = x; break; } }
  s.last = s.last.filter(x => x !== w.ref).concat(w.ref).slice(-6); save(s);
  return w;
}
async function capWords(){
  const map = await clipMap(ab()), out = [];
  for(const c of CAP){ const w = rowWord(c.d, await docOf(c.d), c.e); if(!w) return []; w.clip = map[speakable(w.word)] || ""; out.push(w); }
  return out;
}
function pic(src){
  let p = src; try{ if(W.vocabGames && typeof vocabGames.pic === "function") p = vocabGames.pic(src) || src; }catch(e){ p = src; }
  return `<img src="${esc(p)}"${p !== src ? ` data-f="${esc(src)}" onerror="if(this.dataset.f){this.src=this.dataset.f;delete this.dataset.f}"` : ""} alt="" width="160" height="160" draggable="false">`;
}

/* ---------- sonido: Web Audio ---------- */
let AC = null, GEST = -1e9;
/* se llama dentro de un toque: Safari solo deja empezar (o seguir tras una llamada) un AudioContext así */
function actx(){
  const C = W.AudioContext || W.webkitAudioContext; if(!C) return null;
  try{
    if(!AC || AC.state === "closed") AC = new C();
    if(AC.state !== "running"){ const p = AC.resume(); if(p && typeof p.catch === "function") p.catch(() => {}); }
  }catch(e){ AC = null; }
  return AC;
}
function unlock(){ GEST = now(); actx(); }
/* ¿sonará? (está en marcha, o se acaba de tocar y se está reanudando) */
const audible = () => !!AC && AC.state !== "closed" && (AC.state === "running" || now() - GEST < 1500);
function rest(){ try{ if(AC && AC.state === "running") AC.suspend().catch(() => {}); }catch(e){} }
/* iOS 17+: mientras se graba, sesión de grabar y oír; después, la de siempre (si no, el audio sale por el auricular) */
function session(t){ try{ if(navigator.audioSession && navigator.audioSession.type !== t) navigator.audioSession.type = t; }catch(e){} }
function decode(buf){
  return new Promise((res, rej) => {
    let c = AC && AC.state !== "closed" ? AC : null;
    if(!c){
      const O = W.OfflineAudioContext || W.webkitOfflineAudioContext;
      if(!O){ rej(new Error("Este navegador no tiene Web Audio")); return; }
      try{ c = new O(1, 44100, 44100); }catch(e){ rej(e); return; }
    }
    let done = false;
    const ok = b => { if(!done){ done = true; res(b); } }, ko = e => { if(!done){ done = true; rej(e || new Error("No se pudo leer el audio")); } };
    try{ const p = c.decodeAudioData(buf.slice(0), ok, ko); if(p && typeof p.then === "function") p.then(ok, ko); }catch(e){ ko(e); }
  });
}
function blobBuf(b){
  if(b && typeof b.arrayBuffer === "function") return b.arrayBuffer();
  return new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = () => rej(f.error); f.readAsArrayBuffer(b); });
}

/* ---------- medir: tramos de 20 ms, el trozo con voz, su duración, su volumen y su forma ---------- */
function analyze(b){
  const ch = b.getChannelData(0), n = Math.max(1, Math.round(b.sampleRate * FRAME)), fr = [];
  for(let i = 0; i < ch.length; i += n){
    const e = Math.min(ch.length, i + n); let s = 0;
    for(let j = i; j < e; j++) s += ch[j] * ch[j];
    fr.push(Math.sqrt(s / Math.max(1, e - i)));
  }
  return stats(fr, FRAME);
}
function stats(fr, step){
  let peak = 0; for(const v of fr) if(v > peak) peak = v;
  const th = Math.max(peak * .1, FLOOR);
  let a = -1, z = -1; for(let i = 0; i < fr.length; i++) if(fr[i] >= th){ if(a < 0) a = i; z = i; }
  const t0 = a < 0 ? 0 : a * step, t1 = a < 0 ? 0 : (z + 1) * step, dur = t1 - t0;
  let s = 0, k = 0; if(a >= 0) for(let i = a; i <= z; i++){ s += fr[i] * fr[i]; k++; }
  const rms = k ? Math.sqrt(s / k) : 0, db = rms > 0 ? 20 * Math.log10(rms) : -100, env = [];
  if(a >= 0){
    const L = z - a + 1;
    for(let i = 0; i < 32; i++){
      const i0 = a + Math.floor(i * L / 32), i1 = Math.max(i0 + 1, a + Math.floor((i + 1) * L / 32)); let m = 0;
      for(let j = i0; j < i1 && j <= z; j++) if(fr[j] > m) m = fr[j];
      env.push(peak ? m / peak : 0);
    }
  }
  return {fr, step, peak, t0, t1, dur, rms, db, env, total: fr.length * step, heard: a >= 0 && peak >= FLOOR && dur >= MIN_VOICED};
}
/* lo medido en directo mientras grababa ([ms, nivel]), si el navegador no deja leer lo grabado */
function liveStats(lv){
  if(!lv || lv.length < 2) return null;
  const T = lv[lv.length - 1][0] / 1000, n = Math.max(1, Math.ceil(T / FRAME)), fr = new Array(n).fill(0);
  for(const [t, v] of lv){ const i = Math.min(n - 1, Math.floor(t / 1000 / FRAME)); if(v > fr[i]) fr[i] = v; }
  for(let i = 1; i < n; i++) if(!fr[i]) fr[i] = fr[i - 1] * .5;
  return stats(fr, FRAME);
}
function corr(x, y){
  if(!x || !y || x.length !== y.length || x.length < 2) return 0;
  const n = x.length; let mx = 0, my = 0;
  for(let i = 0; i < n; i++){ mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for(let i = 0; i < n; i++){ const p = x[i] - mx, q = y[i] - my; sxy += p * q; sxx += p * p; syy += q * q; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}
/* las estrellas: duración parecida (1), volumen suficiente (1) y duración muy parecida o la misma forma (1); mínimo 1 */
const NAT0 = Object.freeze({dur: .7, db: -22, env: null, heard: true});
function score(me, nat){
  const n = nat && nat.heard ? nat : NAT0;
  if(!me || !me.heard) return {stars: 1, heard: false, r: 0, tip: ""};
  const r = me.dur / Math.max(.05, n.dur);
  const dOK = r >= .5 && r <= 2, dTight = r >= .7 && r <= 1.45;
  const vOK = me.db >= n.db - 20 && me.db > -48;
  const eOK = corr(me.env, n.env) >= .35;
  const pts = (dOK ? 1 : 0) + (vOK ? 1 : 0) + (dTight || eOK ? 1 : 0);
  const stars = pts >= 3 ? 3 : pts === 2 ? 2 : 1;
  const tip = stars === 3 ? "" : !vOK ? "Prueba un poco más fuerte." : r < .7 ? "Prueba un poco más despacio." : r > 1.45 ? "Prueba un poco más rápido." : "¡Otra vez y sale perfecto!";
  return {stars, heard: true, r: Math.round(r * 100) / 100, dOK, vOK, eOK, tip};
}

/* ---------- oír ---------- */
let PLAY = null;          /* lo que suena: {stop()} */
const PROG = {me: null, nat: null};
function stopPlay(){ const p = PLAY; if(p) p.stop(); }
/* un AudioBuffer (o su trozo con voz, seg) a rate; which: la onda que avanza mientras suena */
function playBuf(b, o){
  return new Promise(res => {
    stopPlay();
    const c = AC; if(!c || c.state === "closed" || !b){ res(false); return; }
    const rate = o.rate || 1, an = o.an, cut = !!(o.seg && an && an.heard);
    const off = cut ? Math.max(0, an.t0 - .04) : 0, len = Math.max(.05, cut ? Math.min(b.duration - off, an.dur + .12) : b.duration);
    let s;
    try{ s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; s.connect(c.destination); }catch(e){ res(false); return; }
    const p = {raf: 0, to: 0};
    const fin = ok => {
      if(PLAY !== p) return; PLAY = null;
      cancelAnimationFrame(p.raf); clearTimeout(p.to);
      s.onended = null; if(!ok) try{ s.stop(); }catch(e){}
      try{ s.disconnect(); }catch(e){}
      if(o.which){ PROG[o.which] = null; drawWaves(); }
      res(ok);
    };
    p.stop = () => fin(false);
    PLAY = p;
    s.onended = () => fin(true);
    const t0 = c.currentTime;
    try{ s.start(0, off, len); }catch(e){ fin(false); return; }
    /* si el AudioContext no llega a sonar (sin toque), se sigue igual */
    p.to = setTimeout(() => fin(true), len / rate * 1000 + 1500);
    if(o.which && an && an.heard){
      const step = () => {
        if(PLAY !== p) return;
        const t = Math.max(0, c.currentTime - t0) * rate + off;
        PROG[o.which] = Math.max(0, Math.min(1, (t - an.t0) / Math.max(.01, an.dur)));
        drawWaves();
        p.raf = requestAnimationFrame(step);
      };
      p.raf = requestAnimationFrame(step);
    }
  });
}
/* sin Web Audio que lea lo grabado: el <audio> sin conservar el tono (más rápido = más agudo) */
function playBlob(blob, rate){
  return new Promise(res => {
    stopPlay();
    let url; try{ url = URL.createObjectURL(blob); }catch(e){ res(false); return; }
    const a = new Audio(); a.preload = "auto";
    try{ a.preservesPitch = false; a.mozPreservesPitch = false; a.webkitPreservesPitch = false; }catch(e){}
    const p = {to: 0};
    const fin = ok => {
      if(PLAY !== p) return; PLAY = null; clearTimeout(p.to);
      a.onended = a.onerror = null; try{ a.pause(); }catch(e){}
      try{ URL.revokeObjectURL(url); }catch(e){}
      res(ok);
    };
    p.stop = () => fin(false);
    PLAY = p;
    a.onended = () => fin(true); a.onerror = () => fin(false);
    a.src = url;
    try{ a.defaultPlaybackRate = rate; a.playbackRate = rate; }catch(e){}
    p.to = setTimeout(() => fin(true), 9000);
    try{ const q = a.play(); if(q && typeof q.catch === "function") q.catch(() => fin(false)); }catch(e){ fin(false); }
  });
}
/* el audio nativo de una palabra, leído y medido (una vez; los 12 últimos) */
const NAT = new Map();
function native(w){
  if(!w || !w.clip) return Promise.resolve(null);
  const url = `audio/${ab()}/${w.clip}.mp3`;
  if(NAT.has(url)) return NAT.get(url);
  const p = fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error("HTTP " + r.status)))
    .then(decode).then(b => ({b, an: analyze(b)})).catch(() => { NAT.delete(url); return null; });
  NAT.set(url, p);
  while(NAT.size > 12) NAT.delete(NAT.keys().next().value);
  return p;
}
/* que suene el nativo: con Web Audio (avanza su onda) o, si no, con say (el mp3 o la voz del navegador) */
async function sayNative(w, tok){
  const n = await native(w);
  if(tok !== S.tok) return;
  if(n && audible()){ S.nat = n; await playBuf(n.b, {rate: 1, an: n.an, which: "nat"}); return; }
  if(typeof sayP === "function") await sayP(w.word);
}

/* ---------- el estado ---------- */
/* st: idle | ask (esperando al micrófono) | rec | wait (leyendo lo grabado) | echo | native | done
   mic: "" (se puede grabar) | none (el aparato no graba) | denied | nodev | fail */
const S = {st: "idle", mic: "", w: null, list: [], tok: 0, me: null, nat: null, res: null, mode: "free", capW: [], capI: 0, capM: "", capHave: new Set(), said: false, cheer: false};
const R = {tok: 0, mr: null, stream: null, chunks: [], type: "", t0: 0, dur: 0, timer: 0, guard: 0, raf: 0, hold: false, up: false, an: null, src: null, sink: null, buf: null, lv: [], voiced: false, lastV: 0, bars: [], bstep: 0, low: false};
let PERM = "";

/* ---------- grabar (como js/mailbox.js) ---------- */
const canRec = () => !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function" && typeof W.MediaRecorder === "function");
function mimePick(){
  const MR = W.MediaRecorder; if(!MR || typeof MR.isTypeSupported !== "function") return "";
  for(const t of ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"]){ try{ if(MR.isTypeSupported(t)) return t; }catch(e){} }
  return "";
}
const stopStream = s => { try{ if(s) s.getTracks().forEach(t => t.stop()); }catch(e){} };
function permCheck(){
  try{
    if(!navigator.permissions || typeof navigator.permissions.query !== "function") return;
    navigator.permissions.query({name: "microphone"}).then(p => {
      const set = () => {
        PERM = p.state;
        if(PERM === "denied" && !S.mic && (S.st === "idle" || S.st === "done")) S.mic = "denied";
        else if(PERM !== "denied" && S.mic === "denied" && canRec()) S.mic = "";
        if(onLoro()) paintAll();
      };
      set(); p.onchange = set;
    }, () => {});
  }catch(e){}
}
const busy = () => S.st === "ask" || S.st === "rec" || S.st === "wait" || S.st === "echo" || S.st === "native";
async function startRec(hold){
  if(busy() || S.mic) return;
  if(!canRec()){ S.mic = "none"; paintAll(); return; }
  stopPlay(); stopSpeech();
  const tok = ++R.tok; R.hold = !!hold; R.up = false;
  S.me = null; S.res = null; PROG.me = null; drawWaves(); set("ask");
  session("play-and-record");
  let stream;
  try{ stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true}}); }
  catch(e){
    if(tok !== R.tok) return;
    session("auto");
    const n = e && e.name;
    S.mic = n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError" ? "denied" : n === "NotFoundError" || n === "DevicesNotFoundError" || n === "OverconstrainedError" ? "nodev" : "fail";
    S.st = "idle"; paintAll(); sayWord();
    return;
  }
  if(tok !== R.tok || !onLoro()){ stopStream(stream); session("auto"); return; }
  PERM = "granted";
  const type = mimePick(); let mr = null;
  try{ mr = new MediaRecorder(stream, type ? {mimeType: type, audioBitsPerSecond: 64000} : undefined); }
  catch(e){ try{ mr = new MediaRecorder(stream); }catch(e2){ mr = null; } }
  if(!mr){ stopStream(stream); session("auto"); S.mic = "fail"; S.st = "idle"; paintAll(); return; }
  R.mr = mr; R.stream = stream; R.chunks = []; R.type = type; R.dur = 0;
  mr.ondataavailable = ev => { if(ev.data && ev.data.size) R.chunks.push(ev.data); };
  mr.onstop = () => finish(tok, mr);
  mr.onerror = () => { if(R.mr === mr) stopRec(); };
  try{ mr.start(250); }catch(e){ stopStream(stream); R.mr = null; R.stream = null; session("auto"); S.mic = "fail"; S.st = "idle"; paintAll(); return; }
  if(R.up) R.hold = false;   /* soltó mientras esperaba al micrófono: ahora se para tocando (o solo, al callar) */
  R.t0 = now(); R.lv = []; R.voiced = false; R.lastV = 0;
  set("rec"); live("Te escucho");
  meter(stream);   /* (después de "rec": tick() solo mide grabando) */
  R.timer = setTimeout(stopRec, R.hold ? HOLD_MAX : TAP_MAX);
}
/* el nivel del micrófono: el aro del botón y parar solo al callar */
function meter(stream){
  R.an = null; R.bars = []; R.low = false;
  /* las barras en vivo de «Tu voz», con la escala de tiempo del resultado (la del nativo; 0,4 s como mínimo, × 1,1) */
  const cv = $id("lr-cv-me");
  if(cv){ const {w, dpr} = fit(cv), nat = S.nat && S.nat.an && S.nat.an.heard ? S.nat.an : null;
    R.bstep = 5 * dpr / (w / (Math.max(nat ? nat.dur : 0, .4) * 1.1)); }   /* segundos por barra (3 px + 2 de hueco) */
  const c = AC || actx();
  if(c) try{
    const src = c.createMediaStreamSource(stream), an = c.createAnalyser(), g = c.createGain();
    an.fftSize = 1024; g.gain.value = 0;
    src.connect(an); an.connect(g); g.connect(c.destination);   /* sin oírse: solo para que el análisis corra */
    R.src = src; R.an = an; R.sink = g; R.buf = new Uint8Array(an.fftSize);
  }catch(e){ R.an = null; }
  tick();
}
function unmeter(){
  cancelAnimationFrame(R.raf);
  for(const n of [R.src, R.an, R.sink]) if(n) try{ n.disconnect(); }catch(e){}
  R.src = R.an = R.sink = null; R.bstep = 0; R.bars = []; R.low = false;
  const rb = $id("lr-rb"); if(rb) rb.style.removeProperty("--lv");
}
function tick(){
  cancelAnimationFrame(R.raf);
  if(S.st !== "rec") return;
  const t = now() - R.t0; let v = 0;
  if(R.an) try{
    R.an.getByteTimeDomainData(R.buf);   /* (el de bytes también lo tiene Safari antiguo) */
    let s = 0; for(let i = 0; i < R.buf.length; i++){ const x = (R.buf[i] - 128) / 128; s += x * x; }
    v = Math.sqrt(s / R.buf.length);
  }catch(e){ v = 0; }
  R.lv.push([t, v]);
  if(v >= VOICE){ R.voiced = true; R.lastV = t; }
  const rb = $id("lr-rb"); if(rb) rb.style.setProperty("--lv", Math.min(1, v * 6).toFixed(3));
  if(R.bstep > 0){ const i = Math.floor(t / 1000 / R.bstep); if(!(R.bars[i] >= v)) R.bars[i] = v; drawLive(); }
  /* 1 s sin oír nada: «Habla un poco más fuerte», en gris, sin cortar la grabación */
  const low = t - (R.voiced ? R.lastV : 0) > 1000;
  if(low !== R.low){ R.low = low; paintCtl(); if(low) live("Habla un poco más fuerte"); }
  if(!R.hold && R.voiced && t - R.lastV > SIL_MS && t > 600){ stopRec(); return; }
  R.raf = requestAnimationFrame(tick);
}
function stopRec(){
  if(S.st !== "rec" || !R.mr) return;
  clearTimeout(R.timer); cancelAnimationFrame(R.raf);
  R.dur = now() - R.t0;
  const mr = R.mr, tok = R.tok; set("wait"); live("Un momento");
  try{ if(mr.state !== "inactive") mr.stop(); else finish(tok, mr); }catch(e){ finish(tok, mr); }
  R.guard = setTimeout(() => finish(tok, mr), 2000);   /* por si el navegador no avisa al parar */
}
/* al parar: las pistas fuera, se lee y se mide; el loro lo repite, suena el nativo y salen las estrellas */
async function finish(tok, mr){
  if(mr.__lrDone) return; mr.__lrDone = true;
  clearTimeout(R.guard);
  stopStream(R.stream); R.stream = null; if(R.mr === mr) R.mr = null;
  unmeter(); session("auto");
  const chunks = R.chunks, lv = R.lv; R.chunks = []; R.lv = [];
  if(tok !== R.tok) return;
  const type = String(mr.mimeType || R.type || "audio/webm"), blob = new Blob(chunks, {type});
  let buf = null, b = null, an = null;
  if(blob.size) try{ buf = await blobBuf(blob); }catch(e){ buf = null; }
  if(buf) try{ b = await decode(buf); an = analyze(b); }catch(e){ b = null; an = null; }
  if(!an) an = liveStats(lv);
  if(tok !== R.tok || !onLoro()) return;
  const ft = ++S.tok;
  S.me = {blob, buf, type, b, an, dur: R.dur, short: R.dur < MIN_MS};
  drawWaves();
  const heard = !!(an && an.heard);
  if(heard && blob.size){
    set("echo"); live("El loro lo repite");
    talk(true);
    if(b && audible()) await playBuf(b, {rate: ECHO_RATE, an, which: "me", seg: true});
    else await playBlob(blob, ECHO_RATE);
    talk(false);
    if(ft !== S.tok) return;
  }
  set("native"); live("Así se dice");
  await sayNative(S.w, ft);
  if(ft !== S.tok) return;
  result();
}
function cancelRec(){
  R.tok++;
  clearTimeout(R.timer); clearTimeout(R.guard); cancelAnimationFrame(R.raf);
  if(R.mr){ const mr = R.mr; R.mr = null; mr.__lrDone = true; try{ if(mr.state !== "inactive") mr.stop(); }catch(e){} }
  unmeter(); stopStream(R.stream); R.stream = null; R.chunks = []; R.lv = [];
  session("auto");
}
/* todo en silencio: ni grabar, ni sonar, ni la voz */
function halt(){
  S.tok++; cancelRec(); stopPlay(); stopSpeech(); talk(false);
  if(busy()) S.st = "idle";
}

/* ---------- estrellas y monedas ---------- */
/* sinceros: las estrellas comparan duración, volumen y forma con el audio (no corrigen la pronunciación) */
const MSG = ["", "¡Bien hecho!", "¡Casi igual!", "¡Te he oído! Suena muy parecido"];
const PAY = 2;                      /* monedas por grabar una palabra (una vez al día por palabra) */
function pay(stars, from){
  const s = load(), d = dayKey(new Date()), ref = S.w.ref;
  if(s.day.d !== d) s.day = {d, c: 0, w: {}};
  /* paga por grabar (si se le oyó), no por las estrellas: una vez por palabra y día, con el tope de DAY_CAP al día */
  const had = s.day.w[ref] || 0, add = had ? 0 : Math.max(0, Math.min(PAY, DAY_CAP - s.day.c));
  if(!had) s.day.w[ref] = Math.max(1, Math.min(3, stars | 0));
  s.day.c += add; save(s);
  if(add > 0) award(add, "", false, from || null);
  return add;
}
async function result(){
  const sc = score(S.me && S.me.an, S.nat && S.nat.an);
  S.res = sc; S.st = "done";
  let paid = 0;
  if(sc.heard){
    try{ logAct(1); }catch(e){}
    if(S.mode === "cap") await saveCap();
  }
  if(!onLoro()) return;
  paintAll();
  showStars(sc.stars);
  if(sc.heard) paid = pay(sc.stars, $id("lr-stars"));
  S.res.paid = paid;
  live(`${sc.stars} ${sc.stars === 1 ? "estrella" : "estrellas"} de 3. ${sc.heard ? MSG[sc.stars] : "No te he oído bien."}`);
  if(sc.stars === 3) try{ if(W.G && typeof G.haptic === "function") G.haptic("success"); }catch(e){}
}
/* las estrellas, una detrás de otra, con su nota */
function showStars(n){
  const el = $id("lr-stars"); if(!el) return;
  const st = [...el.querySelectorAll(".lr-st")];
  st.forEach((x, i) => {
    if(i >= n) return;
    const on = () => { if(!x.isConnected) return; x.classList.add("on"); try{ if(typeof sfx !== "undefined" && sfx.note) sfx.note(i); }catch(e){} };
    if(rm()) on(); else setTimeout(on, 120 + i * 220);
  });
}

/* ---------- la cápsula ---------- */
const capId = (a, m, i) => `cap-${a}-${m}-${i}`;
async function capHave(a, m){
  const M0 = Media(); if(!M0) return null;
  const have = new Set();
  try{ const rs = await Promise.all([0, 1, 2, 3, 4].map(i => M0.get(capId(a, m, i)).catch(() => null))); rs.forEach((r, i) => { if(r && r.buf) have.add(i); }); }
  catch(e){ return null; }
  return have;
}
/* lo grabado de la cápsula de un idioma, del mes más antiguo al más nuevo */
async function capRecs(a){
  const M0 = Media(); if(!M0) return [];
  const L = a || ab();
  const all = await M0.list(KIND);
  return (all || []).filter(r => r && r.lang === L && typeof r.month === "string" && r.buf).sort((x, y) => x.month < y.month ? -1 : x.month > y.month ? 1 : (x.i | 0) - (y.i | 0));
}
async function saveCap(){
  const M0 = Media(), me = S.me, w = S.w;
  if(!M0 || !me || !me.buf || S.mode !== "cap" || !w) return false;
  const a = ab(), m = S.capM, i = S.capI;
  const rec = {id: capId(a, m, i), kind: KIND, t: Date.now(), type: me.type, dur: Math.round(me.dur), buf: me.buf, lang: a, month: m, i, ref: w.ref, w: w.word};
  try{ await M0.put(rec); }catch(e){ return false; }
  S.capHave.add(i);
  try{ M0.persist(); }catch(e){}
  return true;
}
/* la primera vez que entra en un mes nuevo (en este idioma): se le propone */
async function maybeOffer(my){
  if(S.mode === "cap" || S.mic || !canRec() || PERM === "denied" || !Media()) return;
  const s = load(), a = ab(), m = month();
  if(s.cap[a] === m) return;
  s.cap[a] = m; save(s);
  const have = await capHave(a, m);
  if(my !== NAV || !onLoro() || !have || have.size >= 5 || S.st !== "idle" || S.mode === "cap") return;
  offer();
}
let OFFER = null;
async function offer(){
  const list = await capWords(); if(!list.length || !onLoro()) return;
  css();
  if(!OFFER || !OFFER.isConnected){
    OFFER = D.createElement("dialog"); OFFER.id = "lr-offer"; OFFER.className = "lr-sh"; OFFER.setAttribute("aria-labelledby", "lr-of-t");
    OFFER.dataset.noRenew = ""; OFFER.dataset.noHint = "";
    D.body.appendChild(OFFER);
    OFFER.addEventListener("click", e => {
      if(e.target.closest("[data-close]")) shut(OFFER);
      else if(e.target.closest("#lr-of-go")){ unlock(); shut(OFFER, true); startCap(); }
    });
  }
  const c = code();
  OFFER.innerHTML = `<div class="m-head"><h2 id="lr-of-t">Cápsula del tiempo</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Luego</button></div>
    <p class="lr-of-s">Graba estas 5 palabras. Dentro de unos meses podrás oír cómo ha cambiado tu voz.</p>
    <ul class="lr-of-ws">${list.map(w => `<li><span class="lr-of-p">${pic(w.img)}</span><span class="lr-of-w" lang="${esc(c)}">${esc(w.word)}</span></li>`).join("")}</ul>
    <button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" id="lr-of-go" data-key="enter">${HG(22)}Grabar mi cápsula</button>`;
  try{ if(W.M && typeof M.openSheet === "function") M.openSheet(OFFER, {from: $id("lr-bird")}); else OFFER.showModal(); }
  catch(e){ try{ OFFER.showModal(); }catch(e2){ OFFER.setAttribute("open", ""); } }
  OFFER.classList.add("lite");
}
function shut(d, now){
  if(!d || !d.open) return;
  if(!now && W.M && typeof M.closeSheet === "function" && d.classList.contains("m-sheet")) M.closeSheet(d); else d.close();
}
async function startCap(){
  const list = await capWords(); if(!list.length || !onLoro()) return;
  halt();
  S.mode = "cap"; S.capW = list; S.capM = month();
  S.capHave = await capHave(ab(), S.capM) || new Set();
  const s = load(); s.cap[ab()] = S.capM; save(s);
  let i = 0; while(i < 5 && S.capHave.has(i)) i++;
  S.capI = i < 5 ? i : 0;
  show(S.capW[S.capI]);
}
function endCap(){
  halt(); S.mode = "free";
  show(pick(S.list));
}
function capDone(){
  halt();
  const n = S.capHave.size, m = S.capM; S.mode = "free";
  $("#app").innerHTML = `<div class="lr" id="lr" data-no-renew><h1 class="vh">Loro eco</h1>
    <section class="card lr-done" aria-labelledby="lr-dn-t">
      <img class="lr-done-i" src="${IMG}" alt="" width="256" height="217" draggable="false">
      <h2 class="lr-done-t" id="lr-dn-t">${n >= 5 ? `¡Cápsula de ${esc(monthName(m))} guardada!` : `Tienes ${n} de 5 en tu cápsula`}</h2>
      <p class="lr-done-s">${n >= 5 ? "Dentro de unos meses, graba otra y compara tu voz en Premios." : "Graba las que faltan cuando quieras."}</p>
      ${n ? `<a class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" id="lr-prem" href="#/progreso" data-key="enter">${IC("trophy", "fill", 22)}Ver en Premios</a>` : ""}
      <button type="button" class="glass-btn glass-btn--block${n ? "" : " glass-btn--pri glass-btn--lg"}" id="lr-more" data-key="${n ? "right" : "enter right"}">Seguir con el loro</button>
    </section>
    <p class="vh" id="lr-live" role="status" aria-live="polite" aria-atomic="true"></p></div>`;
  const root = $id("lr");
  wireUnlock(root);
  $id("lr-more").onclick = () => show(pick(S.list));
  live(n >= 5 ? "Cápsula guardada" : `${n} de 5 guardadas`);
  try{ if(n >= 5 && W.M && typeof M.burst === "function" && !rm()) M.burst(root.querySelector(".lr-done-i"), {n: 14}); }catch(e){}
}

/* ---------- la pantalla ---------- */
let NAV = 0;
function screenHtml(){
  const w = S.w, c = code(), cap = S.mode === "cap", ipa = w.ipa ? ipaHtml(w.ipa, c) : "";
  const len = w.word.length;
  return `<div class="lr${cap ? " is-cap" : ""}" id="lr" data-no-renew>
    <h1 class="vh">Loro eco</h1>
    ${cap ? `<div class="lr-cap" id="lr-cap">${HG(22)}<span class="lr-cap-t">Cápsula del tiempo · <b id="lr-cap-n" class="t-num"></b></span><button type="button" class="glass-btn glass-btn--sm" id="lr-cap-x">Luego</button></div>` : ""}
    <section class="card lr-card" aria-label="La palabra">
      <div class="lr-pic" id="lr-pic" aria-hidden="true">${pic(w.img)}</div>
      <div class="lr-wd">
        <p class="lr-w${len > 12 ? " is-long" : len > 8 ? " is-mid" : ""}" id="lr-w" lang="${esc(c)}">${esc(w.word)}</p>
        ${ipa ? `<p class="lr-ipa">${ipa}</p>` : ""}
        <p class="lr-es">${esc(w.es)}</p>
        <div class="lr-aud"><button type="button" class="lr-spk" id="lr-spk" data-key="space" aria-label="Oír la palabra" title="Oír la palabra">${IC("speaker-high", "fill", 24)}</button><button type="button" class="lr-slow" id="lr-slow" data-key="shift+space" aria-label="Oír despacio" title="Oír despacio">${IC("turtle", "fill", 26)}</button></div>
      </div>
    </section>
    <div class="lr-stage">
      <img class="lr-bird" id="lr-bird" src="${IMG}" alt="" width="256" height="217" draggable="false">
      <div class="lr-bub" id="lr-bub"><p class="lr-bt" id="lr-bt"></p>
        <p class="lr-stars" id="lr-stars" role="img" hidden>${[0, 1, 2].map(() => `<span class="lr-st">${IC("star", "fill", 30)}</span>`).join("")}</p></div>
    </div>
    <section class="card lr-waves" aria-label="Tu voz y la del audio">
      <span class="lr-wl me">Tu voz</span><canvas class="lr-cv me" id="lr-cv-me" aria-hidden="true"></canvas>
      <span class="lr-wl nat">Así se dice</span><canvas class="lr-cv nat" id="lr-cv-nat" aria-hidden="true"></canvas>
    </section>
    <div class="lr-ctl" id="lr-ctl">
      <button type="button" class="lr-rb" id="lr-rb" data-key="enter" aria-label="Grabar"><span class="lr-rb-in" id="lr-rb-in" aria-hidden="true"></span></button>
      <p class="lr-rl" id="lr-rl"></p>
      <p class="lr-info" id="lr-info" hidden>${IC("info", "bold", 22)}<span id="lr-info-t"></span></p>
      <button type="button" class="glass-btn glass-btn--sm" id="lr-retry" hidden>${IC("arrow-counter-clockwise", "bold", 20)}Probar otra vez</button>
      <p class="lr-note" id="lr-note" hidden>El loro necesita el micrófono para oírte. Tu voz se queda en este aparato.</p>
    </div>
    <button type="button" class="glass-btn glass-btn--block lr-next" id="lr-next" data-key="right"><span id="lr-next-t"></span>${IC("caret-right", "bold", 20)}</button>
    <p class="lr-foot" id="lr-foot" hidden></p>
    <p class="vh" id="lr-live" role="status" aria-live="polite" aria-atomic="true"></p>
  </div>`;
}
function set(st){ S.st = st; if(onLoro()) paintAll(); }
function talk(on){
  const b = $id("lr-bird"); if(!b) return;
  b.classList.remove("is-talk");
  if(on && !rm()){ void b.offsetWidth; b.classList.add("is-talk"); }
}
function paintAll(){ paintCtl(); paintBub(); paintCap(); }
function paintBub(){
  const t = $id("lr-bt"), sEl = $id("lr-stars"); if(!t || !S.w) return;
  const wd = `<span lang="${esc(code())}">${esc(S.w.word)}</span>`, st = S.st;
  let h;
  if(st === "done" && S.res){
    const r = S.res;
    h = r.heard ? `<b>${MSG[r.stars]}</b>${r.tip ? ` <span class="lr-tip">${esc(r.tip)}</span>` : ""}` : `<b>No te he oído bien.</b> <span class="lr-tip">Acércate al micrófono y prueba otra vez.</span>`;
  }
  else if(S.mic) h = S.cheer ? `<b>¡Bien hecho!</b> Ahora esta: escucha y dila en voz alta.` : `Escucha y dilo en voz alta.`;
  else if(st === "ask") h = "¿Me dejas oírte?";
  else if(st === "rec") h = "Te escucho…";
  else if(st === "wait") h = "Mmm…";
  else if(st === "echo") h = `<b class="lr-echo">¡${wd}!</b>`;
  else if(st === "native") h = `Así se dice: <b>${wd}</b>`;
  else h = S.cheer ? "¡Otra! Dila y te la repito." : "¡Dilo y te lo repito!";
  if(t.innerHTML !== h) t.innerHTML = h;
  if(sEl){
    const show = st === "done" && !!S.res;
    if(sEl.hidden === show){
      sEl.hidden = !show;
      sEl.querySelectorAll(".lr-st").forEach(x => x.classList.remove("on"));
    }
    if(show) sEl.setAttribute("aria-label", `${S.res.stars} de 3 estrellas`);
  }
}
const NOMIC = {
  none: "Este aparato no puede grabar. ¡Escucha al loro y dilo en voz alta!",
  denied: "El micrófono está apagado para esta web. Pide a un mayor que lo active. Mientras, escucha y dilo en voz alta.",
  nodev: "No encuentro ningún micrófono. ¡Escucha al loro y dilo en voz alta!",
  fail: "No se ha podido grabar. ¡Escucha y dilo en voz alta, o prueba otra vez!",
};
function paintCtl(){
  const rb = $id("lr-rb"); if(!rb || !S.w) return;
  const st = S.st, nm = !!S.mic, bz = busy(), done = st === "done";
  const rl = $id("lr-rl"), inf = $id("lr-info"), rt = $id("lr-retry"), note = $id("lr-note"), nx = $id("lr-next"), nt = $id("lr-next-t");
  rb.hidden = nm; rl.hidden = nm; inf.hidden = !nm; rt.hidden = !(nm && S.mic !== "none");
  if(nm) $id("lr-info-t").textContent = NOMIC[S.mic] || NOMIC.fail;
  rb.classList.toggle("is-rec", st === "rec");
  rb.classList.toggle("is-busy", bz && st !== "rec");
  rb.classList.toggle("is-quiet", done);
  rb.setAttribute("aria-label", st === "rec" ? "Parar" : done ? "Grabar otra vez" : "Grabar");
  if(bz && st !== "rec") rb.setAttribute("aria-disabled", "true"); else rb.removeAttribute("aria-disabled");
  const icon = st === "rec" ? IC("stop", "fill", 38) : st === "echo" || st === "native" ? IC("speaker-high", "fill", 38) : IC("microphone", "fill", 40);
  const inn = $id("lr-rb-in"); if(inn && inn.dataset.ic !== (st === "rec" ? "s" : st === "echo" || st === "native" ? "p" : "m")){ inn.innerHTML = icon; inn.dataset.ic = st === "rec" ? "s" : st === "echo" || st === "native" ? "p" : "m"; }
  rl.classList.toggle("is-low", st === "rec" && R.low);
  rl.textContent = st === "ask" ? "Esperando al micrófono…" : st === "rec" ? (R.low ? "Habla un poco más fuerte" : R.hold ? "Te escucho… suelta al acabar" : "Te escucho… toca para parar")
    : st === "wait" ? "Un momento…" : st === "echo" ? "El loro lo repite…" : st === "native" ? "Así se dice…" : done ? "Otra vez" : "Toca y dilo";
  note.hidden = nm || PERM === "granted" || !(st === "idle" || st === "ask");
  /* un solo botón principal: grabar; con el resultado (o sin micrófono), seguir */
  const last = S.mode === "cap" && nextCapI() < 0;
  nt.textContent = nm ? "¡Ya la dije!" : S.mode === "cap" ? (last ? "Terminar" : "Siguiente") : "Otra palabra";
  const pri = nm || done;
  nx.classList.toggle("glass-btn--pri", pri);
  nx.dataset.key = pri ? "enter right" : "right";
  if(pri) rb.removeAttribute("data-key"); else rb.dataset.key = "enter";
  for(const id of ["lr-spk", "lr-slow"]){ const b = $id(id); if(!b) continue; if(bz) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled"); }
}
function paintCap(){
  const n = $id("lr-cap-n"); if(n) n.textContent = `${S.capI + 1} de 5`;
  const f = $id("lr-foot"); if(!f) return;
  if(S.mode === "cap"){ f.hidden = true; return; }
}
/* el pie: la cápsula de este mes, si está a medias (o se dijo «Ahora no») */
async function paintFoot(my){
  const f = $id("lr-foot"); if(!f || S.mode === "cap" || S.mic || !canRec() || !Media()) return;
  const a = ab(), m = month(), have = await capHave(a, m);
  if(my !== NAV || !f.isConnected || S.mode === "cap" || !have || have.size >= 5) return;
  f.innerHTML = `<button type="button" class="lr-quiet" id="lr-cap-go">${HG(20)}${have.size ? `Seguir mi cápsula de ${esc(monthName(m))} · ${have.size} de 5` : `Grabar mi cápsula de ${esc(monthName(m))}`}</button>`;
  f.hidden = false;
}
function nextCapI(){ for(let i = S.capI + 1; i < 5; i++) if(!S.capHave.has(i)) return i; return -1; }

/* ---------- las dos ondas ---------- */
function fit(cv){
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, W.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if(cv.width !== w) cv.width = w;
  if(cv.height !== h) cv.height = h;
  return {w, h, dpr};
}
function drawWaves(){
  const a = $id("lr-cv-me"), b = $id("lr-cv-nat"); if(!a || !b) return;
  if(S.st === "rec" && R.bstep) return;   /* grabando: las barras en vivo (drawLive) */
  delete a.dataset.live;
  const me = S.me && S.me.an && S.me.an.heard ? S.me.an : null, nat = S.nat && S.nat.an && S.nat.an.heard ? S.nat.an : null;
  const T = Math.max(me ? me.dur : 0, nat ? nat.dur : 0, .4) * 1.1;   /* la misma escala para las dos */
  drawOne(a, me, T, PROG.me);
  drawOne(b, nat, T, PROG.nat);
}
function drawOne(cv, an, T, p){
  const {w, h, dpr} = fit(cv), g = cv.getContext("2d"); if(!g) return;
  g.clearRect(0, 0, w, h);
  const col = getComputedStyle(cv).color, mid = h / 2;
  g.fillStyle = col;
  if(!an){
    g.globalAlpha = .3; g.fillRect(0, Math.round(mid - dpr), w, Math.max(1, Math.round(2 * dpr))); g.globalAlpha = 1;
    cv.dataset.bars = "0";
    return;
  }
  const bw = 3 * dpr, gap = 2 * dpr, pps = w / T, i0 = Math.round(an.t0 / an.step), i1 = Math.round(an.t1 / an.step);
  let x = 0, k = 0;
  while(x + bw <= w){
    const ta = an.t0 + x / pps, tb = an.t0 + (x + bw + gap) / pps;
    if(ta >= an.t1) break;
    let v = 0;
    for(let i = Math.max(i0, Math.floor(ta / an.step)); i <= Math.min(i1 - 1, Math.floor(tb / an.step)); i++) if(an.fr[i] > v) v = an.fr[i];
    const hh = Math.max(2 * dpr, Math.pow(an.peak ? v / an.peak : 0, .7) * (h - 4 * dpr));
    const done = p == null || (x + bw / 2) / Math.max(1, (an.t1 - an.t0) * pps) <= p;
    g.globalAlpha = done ? 1 : .35;
    rr(g, x, mid - hh / 2, bw, hh, bw / 2);
    x += bw + gap; k++;
  }
  g.globalAlpha = 1;
  cv.dataset.bars = String(k);
}
/* mientras graba: las barras que avanzan (como Notas de voz); si no caben, se ven las últimas */
function drawLive(){
  const cv = $id("lr-cv-me"); if(!cv || !R.bstep) return;
  const {w, h, dpr} = fit(cv), g = cv.getContext("2d"); if(!g) return;
  g.clearRect(0, 0, w, h);
  g.fillStyle = getComputedStyle(cv).color;
  const bw = 3 * dpr, gap = 2 * dpr, mid = h / 2, n = R.bars.length, fitN = Math.max(1, Math.floor((w + gap) / (bw + gap))), first = Math.max(0, n - fitN);
  let k = 0;
  for(let i = first; i < n; i++){
    const v = R.bars[i] || 0, hh = Math.max(2 * dpr, Math.pow(Math.min(1, v * 5), .7) * (h - 4 * dpr));
    g.globalAlpha = v >= VOICE ? 1 : .35;
    rr(g, (i - first) * (bw + gap), mid - hh / 2, bw, hh, bw / 2); k++;
  }
  g.globalAlpha = 1;
  cv.dataset.bars = String(k); cv.dataset.live = "1";
}
function rr(g, x, y, w, h, r){
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y); g.closePath(); g.fill();
}

/* ---------- una palabra en pantalla ---------- */
function show(w){
  halt();
  const app = $("#app"); if(!app || !w) return;
  const ae = D.activeElement, had = ae && ae.id && $id("lr") && $id("lr").contains(ae) ? ae.id : "";
  S.w = w; S.me = null; S.nat = null; S.res = null; S.st = "idle"; S.said = false;
  if(S.mode === "cap") S.capI = Math.max(0, S.capW.indexOf(w));
  PROG.me = PROG.nat = null;
  app.innerHTML = screenHtml();
  const root = $id("lr");
  wire(root);
  paintAll();
  drawWaves();
  const my = NAV, tok = S.tok;
  if(S.mode !== "cap") paintFoot(my);
  native(w).then(n => {
    if(my !== NAV || tok !== S.tok || S.w !== w) return;
    if(n) S.nat = n;
    drawWaves();
    /* el loro la dice al salir (si ya se tocó la pantalla: un enlace directo no suena solo) */
    if(audible() && S.st === "idle") sayWord();
  });
  if(had && $id(had)) try{ $id(had).focus({preventScroll: true}); }catch(e){}
  if(!rm()) root.querySelector(".lr-card").classList.add("lr-in");
}
/* el loro dice la palabra (sin micrófono, o al salir una nueva) */
function sayWord(){
  if(!S.w || busy()) return;
  const tok = S.tok, w = S.w;
  sayNative(w, tok).then(() => { if(tok === S.tok && S.w === w) S.said = true; });
}
function next(){
  if(!S.w) return;
  const was = S.mic ? true : !!(S.res && S.res.heard);
  halt();
  if(S.mode === "cap"){
    const i = nextCapI();
    if(i < 0){ capDone(); return; }
    S.cheer = false;
    show(S.capW[i]);
    return;
  }
  S.cheer = was;
  show(pick(S.list));
}
function wireUnlock(root){
  for(const t of ["pointerup", "click", "keydown"]) root.addEventListener(t, unlock, true);
  root.addEventListener("touchend", unlock, {capture: true, passive: true});
}
let OFFS = [];
function wire(root){
  OFFS.splice(0).forEach(f => { try{ f(); }catch(e){} });
  wireUnlock(root);
  const rb = $id("lr-rb");
  root.addEventListener("click", e => {
    const t = e.target.closest("button, .lr-pic"); if(!t || !root.contains(t)) return;
    if(t.getAttribute("aria-disabled") === "true") return;
    switch(t.id){
      case "lr-rb": if(S.st === "rec") stopRec(); else if(S.st === "idle" || S.st === "done") startRec(false); break;
      case "lr-spk": case "lr-pic": stopPlay(); say(S.w.word, t.id === "lr-spk" ? t : $id("lr-spk")); break;
      case "lr-slow": stopPlay(); say(S.w.word, t, true); break;
      case "lr-next": next(); break;
      case "lr-retry": S.mic = ""; S.st = "idle"; paintAll(); startRec(false); break;
      case "lr-cap-x": endCap(); break;
      case "lr-cap-go": startCap(); break;
    }
  });
  /* mantener pulsado: graba mientras no suelta (tocar también vale: empieza y para) */
  if(rb && W.G && typeof G.hold === "function") OFFS.push(G.hold(rb, {ms: HOLD_MS,
    onHold: () => { if(S.mic || !(S.st === "idle" || S.st === "done")) return; unlock(); try{ G.haptic("selection"); }catch(e){} startRec(true); },
    onRelease: () => { if(S.st === "rec" && R.hold) stopRec(); else if(S.st === "ask") R.up = true; },
    onCancel: () => { if(S.st === "rec" && R.hold) stopRec(); else if(S.st === "ask") R.up = true; }}));
}

/* ---------- la ruta ---------- */
async function view(parts){
  css();
  const my = ++NAV;
  halt(); closeSheets();
  if(!S.mic && !canRec()) S.mic = "none";
  if(S.mic === "denied" || S.mic === "fail" || S.mic === "nodev") S.mic = "";   /* al volver a entrar se prueba otra vez */
  const list = await pool();
  if(my !== NAV || !onLoro()) return;
  S.list = list; S.cheer = false;
  if(!list.length){
    $("#app").innerHTML = `<div class="lr" id="lr"><h1 class="vh">Loro eco</h1><div class="card lr-done"><img class="lr-done-i" src="${IMG}" alt="" width="256" height="217" draggable="false">
      <p class="lr-done-s">El loro aún no tiene palabras en este idioma. ¡Aprende alguna y vuelve!</p><a class="glass-btn glass-btn--pri" href="#/mapa">Ir a Aprender</a></div></div>`;
    return;
  }
  permCheck();
  S.mode = "free";
  if(parts && parts[0] === "capsula" && canRec() && Media()){ await startCap(); if(my !== NAV || S.mode === "cap") return; }
  show(pick(list));
  maybeOffer(my);
}
ROUTES.loro = parts => { placeTab(); return view(parts); };
ROUTES.loro.load = () => pool();
/* la pestaña del loro: Granja (desde la valla) o Jugar (desde Juegos, con ?t=). Se decide antes de que route() marque la
   pestaña: al tocar un enlace al loro, con Atrás/Adelante (popstate llega antes que hashchange) y al cargar */
function placeTab(h = location.hash){
  try{
    const G0 = TABS.find(t => t.id === "granja"), J = TABS.find(t => t.id === "jugar"); if(!G0 || !J) return;
    const want = /^#\/?loro\b/.test(h) && topicOf(h) ? J : G0, other = want === J ? G0 : J;
    if(!want.secs.includes("loro")) want.secs.push("loro");
    const i = other.secs.indexOf("loro"); if(i >= 0) other.secs.splice(i, 1);
  }catch(e){}
}
placeTab();
D.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest('a[href^="#/loro"]'); if(!a) return;
  /* la tarjeta de Juegos lleva el tema elegido en ese momento */
  if(a.matches('.gm-card[data-g="loro"]')){ let t = "animales"; try{ t = store.get("games:topic", "animales") || "animales"; }catch(err){} a.setAttribute("href", "#/loro?t=" + encodeURIComponent(t)); }
  placeTab(a.getAttribute("href"));
}, true);
addEventListener("popstate", () => placeTab());
/* la memoria de la pestaña Jugar vuelve al loro con su tema (route() la guarda sin ?t=) */
bus.on("route", () => { try{ if(onLoro() && topicOf() && typeof TABMEM === "object" && TABMEM.jugar){ TABMEM.jugar.h = "#/" + location.hash.replace(/^#\/?/, ""); if(typeof memSave === "function") memSave(); } }catch(e){} });
try{
  if(W.vocabGames && typeof vocabGames.register === "function")
    vocabGames.register("loro", {t: "Loro eco", sub: "Repite palabras con el loro", img: IMG, href: "#/loro?t=animales", sec: "mas",
      line: () => "Con las palabras del tema"});
}catch(e){ console.error(e); }
function closeSheets(){ if(OFFER) shut(OFFER, true); }
function leave(){ halt(); closeSheets(); rest(); }
addEventListener("hashchange", () => { if(!onLoro()) leave(); if(!onPremios()) stopCap(); });
D.addEventListener("visibilitychange", () => {
  if(!D.hidden) return;
  if(onLoro() && (busy() || PLAY)){ halt(); paintAll(); }
  stopCap(); rest();
});
addEventListener("pagehide", () => { halt(); stopCap(); });

/* ---------- la granja: el loro en la valla ---------- */
bus.on("farm-mounted", d => { try{ perch(d && d.world); }catch(e){ console.error(e); } });
function perch(world){
  if(!world || world.querySelector(".lr-perch")) return;
  css();
  const b = D.createElement("button");
  b.type = "button"; b.className = "lr-perch"; b.dataset.noRenew = "";
  b.setAttribute("aria-label", "Loro eco: repite palabras conmigo");
  b.innerHTML = `<img src="${IMG}" alt="" width="256" height="217" draggable="false"><span class="lr-pl">Loro</span>`;
  /* el toque es del loro: no llega a la escena (pasear, mariposas…); y aquí empieza el sonido (Safari) */
  b.addEventListener("click", e => { e.stopPropagation(); unlock(); placeTab("#/loro"); location.hash = "#/loro"; });
  world.appendChild(b);
}

/* ---------- Premios: «Tu voz en el tiempo» ---------- */
let CAPN = 0, CP = null;
function stopCap(){
  const p = CP; CP = null; if(!p) return;
  clearTimeout(p.to);
  if(p.a){ p.a.onended = p.a.onerror = null; try{ p.a.pause(); }catch(e){} }
  if(p.url) try{ URL.revokeObjectURL(p.url); }catch(e){}
  const b = p.btn;
  if(b && b.isConnected){ b.classList.remove("playing"); b.setAttribute("aria-pressed", "false"); const i = b.querySelector(".lr-pi"); if(i) i.innerHTML = IC("play", "fill", 18); }
}
/* una lista de grabaciones, una detrás de otra (tocar otra vez la para) */
function capPlay(recs, btn){
  if(CP && CP.btn === btn){ stopCap(); return; }
  stopCap(); stopSpeech();
  const q = recs.filter(r => r && r.buf); if(!q.length) return;
  const p = {btn, q, i: 0, a: null, url: "", to: 0}; CP = p;
  if(btn){ btn.classList.add("playing"); btn.setAttribute("aria-pressed", "true"); const i = btn.querySelector(".lr-pi"); if(i) i.innerHTML = IC("pause", "bold", 18); }
  const step = () => {
    if(CP !== p) return;
    if(p.url){ try{ URL.revokeObjectURL(p.url); }catch(e){} p.url = ""; }
    if(p.i >= p.q.length){ stopCap(); return; }
    const r = p.q[p.i++];
    let url; try{ url = URL.createObjectURL(new Blob([r.buf], {type: String(r.type || "audio/webm")})); }catch(e){ step(); return; }
    const a = new Audio(); a.preload = "auto"; a.dataset.rec = r.id;
    p.a = a; p.url = url;
    const go = () => { if(CP !== p || p.a !== a) return; p.a = null; clearTimeout(p.to); a.onended = a.onerror = null; setTimeout(step, 250); };
    a.onended = go; a.onerror = go;
    a.src = url;
    p.to = setTimeout(go, Math.max(1500, (+r.dur || 3000) + 1500));
    try{ const pr = a.play(); if(pr && typeof pr.catch === "function") pr.catch(go); }catch(e){ go(); }
  };
  step();
}
const tuEn = (m, other) => `Tú en ${monthName(m)}${other && monthName(other) === monthName(m) ? ` de ${m.slice(0, 4)}` : ""}`;
async function paintCapsule(el){
  if(!el) return;
  css();
  const my = ++CAPN, a = ab(), c = code();
  let recs = [];
  if(Media()) try{ recs = await capRecs(a); }catch(e){ recs = []; }
  if(my !== CAPN || !el.isConnected) return;
  const by = {}; for(const r of recs){ const i = r.i | 0; if(i < 0 || i > 4) continue; (by[r.month] = by[r.month] || [null, null, null, null, null])[i] = r; }
  const ms = Object.keys(by).sort();
  if(!ms.length){ stopCap(); el.hidden = true; el.innerHTML = ""; return; }
  const A = ms[0], B = ms.length > 1 ? ms[ms.length - 1] : "";
  const words = [0, 1, 2, 3, 4].map(i => { const r = (B && by[B][i]) || by[A][i]; return r ? String(r.w || "") : ""; });
  el.innerHTML = `<section class="card lr-tc" aria-labelledby="lr-tc-h" data-no-renew>
    <div class="lr-tc-hd"><span class="lr-tc-i" aria-hidden="true">${HG(24)}</span>
      <div class="lr-tc-tt"><h2 class="rw-h2" id="lr-tc-h">Tu voz en el tiempo</h2><p class="lr-tc-s">${B ? "Oye cómo ha cambiado tu voz." : "El mes que viene graba otra vez con el loro y compárate."}</p></div></div>
    <div class="lr-tc-ab">
      <button type="button" class="lr-tb" data-m="${esc(A)}" aria-pressed="false"><span class="lr-pi">${IC("play", "fill", 18)}</span><span>${esc(tuEn(A, B))}</span></button>
      ${B ? `<button type="button" class="lr-tb is-b" data-m="${esc(B)}" aria-pressed="false"><span class="lr-pi">${IC("play", "fill", 18)}</span><span>${esc(tuEn(B, A))}</span></button>` : ""}
    </div>
    <div class="lr-tc-ws" role="group" aria-label="Las palabras">${words.map((w, i) => w ? `<button type="button" class="lr-tw" data-i="${i}" aria-pressed="false"><span class="lr-pi">${IC("play", "fill", 16)}</span><span lang="${esc(c)}">${esc(w)}</span>${B ? `<span class="vh"> (antes y ahora)</span>` : ""}</button>` : "").join("")}</div>
  </section>`;
  el.hidden = false;
  el.onclick = e => {
    const t = e.target.closest(".lr-tb, .lr-tw"); if(!t || !el.contains(t)) return;
    if(t.classList.contains("lr-tb")) capPlay(by[t.dataset.m] || [], t);
    else { const i = +t.dataset.i; capPlay([by[A][i], B ? by[B][i] : null], t); }
  };
}
/* tras borrar en Para mayores (o cualquier cambio en Ajustes): la tarjeta y el pie, otra vez */
bus.on("settings", d => {
  if(d && d.page) { stopCap(); return; }
  if(onPremios()){ const el = $id("rw-voz"); if(el) paintCapsule(el); }
  if(onLoro() && S.mode !== "cap"){ const f = $id("lr-foot"); if(f){ f.hidden = true; paintFoot(NAV); } }
});

/* ---------- estilos ---------- */
const DARK = (s, b) => `:root[data-theme=dark] ${s}{${b}}`;
const CSS = `
.lr{--lr-pic:min(36vw,150px);--lr-bird:min(30vw,118px);--lr-wf:clamp(1.75rem,8vw,2.25rem);max-width:600px;margin:0 auto;display:flex;flex-direction:column;gap:12px;padding:0 0 8px}
/* (en la granja la barra de arriba va sin el borde que funde; aquí, como en las demás pantallas) */
:root[data-sec=loro][data-tab=granja] .topbar::after{display:block}
.lr-cap{display:flex;align-items:center;gap:8px;min-height:var(--tap);padding:4px 4px 4px 14px;border-radius:var(--r-pill);background:var(--gold-soft);color:var(--label);font:600 var(--fs-note)/1.25 var(--f-text)}
.lr-cap .lr-hg{flex:none;color:var(--gold-ink)}
.lr-cap-t{flex:1;min-width:0}
.lr-card{display:flex;align-items:center;gap:14px;padding:14px}
.lr-pic{position:relative;flex:none;box-sizing:border-box;width:var(--lr-pic);height:var(--lr-pic);border-radius:var(--r-md);cursor:pointer;-webkit-tap-highlight-color:transparent}
.lr-pic img{position:absolute;top:0;left:0;display:block;width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply;pointer-events:none;-webkit-user-drag:none;user-select:none}
${DARK(".lr-pic", "background:#F2F2F7")}
${DARK(".lr-pic img", "top:6px;left:6px;width:calc(100% - 12px);height:calc(100% - 12px)")}
.lr-wd{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.lr-w{margin:0;max-width:100%;font:800 var(--lr-wf)/1.1 var(--f-round);color:var(--label);overflow-wrap:anywhere}
.lr-w.is-mid{font-size:calc(var(--lr-wf) * .82)}
.lr-w.is-long{font-size:calc(var(--lr-wf) * .68)}
.lr-ipa{margin:2px 0 0;font-size:var(--fs-sub);line-height:1.3}
.lr-es{margin:0;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2);overflow-wrap:anywhere}
.lr-aud{display:flex;gap:20px;margin-top:8px}
.lr-spk,.lr-slow{flex:none;display:grid;place-items:center;width:48px;height:48px;margin:0;padding:0;border:0;border-radius:50%;cursor:pointer;-webkit-tap-highlight-color:transparent;
  transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms),opacity var(--d-fast,160ms)}
.lr-spk{background:var(--brand-soft);color:var(--brand-tint)}
.lr-slow{background:var(--fill2);color:var(--label)}
.lr-spk.playing,.lr-slow.playing{background:var(--brand-fill);color:#fff}
.lr-spk[aria-disabled=true],.lr-slow[aria-disabled=true]{opacity:.4;pointer-events:none}
.lr-stage{display:flex;align-items:center;gap:8px;min-height:calc(var(--lr-bird) * .85)}
.lr-bird{flex:none;display:block;width:var(--lr-bird);height:auto;aspect-ratio:256/217;transform-origin:50% 90%;-webkit-user-drag:none;user-select:none}
.lr-bird.is-talk{animation:lr-bob .18s ease-in-out 4 alternate}
@keyframes lr-bob{to{transform:rotate(-7deg) translateY(-3px)}}
.lr-bub{position:relative;flex:1;min-width:0;padding:12px 16px;border-radius:20px;background:var(--card);color:var(--label);box-shadow:0 1px 2px rgba(0,0,0,.06)}
.lr-bub::before{content:"";position:absolute;left:-9px;top:50%;width:18px;height:18px;margin-top:-9px;border-radius:3px;background:inherit;transform:rotate(45deg)}
.lr-bt{position:relative;margin:0;font:400 var(--fs-sub)/1.35 var(--f-text);overflow-wrap:anywhere}
.lr-bt b{font-weight:700}
.lr-echo{font:800 var(--fs-t3)/1.2 var(--f-round);color:var(--brand-ink)}
${DARK(".lr-echo", "color:#7DBBFF")}
.lr-tip{color:var(--label2)}
.lr-stars{position:relative;display:flex;gap:4px;margin:6px 0 0}
.lr-stars[hidden]{display:none}
.lr-st{display:grid;place-items:center;color:var(--fill)}
.lr-st.on{color:var(--gold);animation:lr-pop .32s cubic-bezier(.2,1.6,.4,1) both}
.lr-st.on .ico{filter:drop-shadow(0 1px 0 var(--gold-deep))}
@keyframes lr-pop{from{transform:scale(.4);opacity:.3}}
.lr-waves{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px 12px;padding:12px 16px}
.lr-wl{font:600 var(--fs-note)/1.2 var(--f-text);white-space:nowrap}
.lr-wl.me{color:var(--brand-ink)}
.lr-wl.nat{color:var(--ok-ink)}
${DARK(".lr-wl.me", "color:#7DBBFF")}
.lr-cv{display:block;width:100%;height:40px}
.lr-cv.me{color:var(--brand-tint)}
.lr-cv.nat{color:var(--ok-ink)}
.lr-ctl{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
.lr-rb{position:relative;flex:none;width:92px;height:92px;margin:0;padding:0;border:0;border-radius:50%;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.lr-rb[hidden]{display:none}
.lr-rb::before{content:"";position:absolute;inset:0;border-radius:50%;background:var(--brand-soft);opacity:0;transform:scale(calc(1 + var(--lv,0) * .3))}
.lr-rb.is-rec::before{opacity:1}
.lr-rb-in{position:absolute;inset:6px;display:grid;place-items:center;border-radius:50%;background:var(--brand-fill);color:#fff;box-shadow:0 6px 16px -6px rgba(30,110,244,.6);transition:transform .15s ease,background-color var(--d-fast,160ms)}
.lr-rb:active .lr-rb-in{transform:scale(.95)}
.lr-rb.is-rec .lr-rb-in{background:var(--brand-ink)}
.lr-rb.is-busy{cursor:default}
.lr-rb.is-busy .lr-rb-in{background:var(--brand-soft);color:var(--brand-tint);box-shadow:none}
.lr-rb.is-quiet .lr-rb-in{background:var(--neu);color:var(--brand-tint);box-shadow:none}
.lr-rb:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.lr-rl{margin:0;min-height:1.3em;font:600 var(--fs-sub)/1.3 var(--f-text);color:var(--label)}
.lr-rl[hidden]{display:none}
.lr-rl.is-low{color:var(--label2)}
.lr-info{display:flex;align-items:flex-start;gap:8px;width:100%;box-sizing:border-box;margin:0;padding:12px 16px;border-radius:var(--r-md);background:var(--fill2);color:var(--label);font:400 var(--fs-sub)/1.4 var(--f-text);text-align:left}
.lr-info[hidden]{display:none}
.lr-info>.ico{flex:none;margin-top:2px;color:var(--label2)}
.lr-note{margin:0;max-width:30em;font:400 var(--fs-note)/1.4 var(--f-text);color:var(--label2)}
.lr-note[hidden]{display:none}
.lr-next .ico{margin-right:-4px}
.lr-foot{display:flex;justify-content:center;margin:0}
.lr-foot[hidden]{display:none}
.lr-quiet{display:inline-flex;align-items:center;gap:8px;min-height:var(--tap);padding:0 12px;border:0;border-radius:var(--r-pill);background:none;color:var(--brand-ink);font:600 var(--fs-sub)/1.2 var(--f-text);cursor:pointer;text-align:left}
${DARK(".lr-quiet", "color:#7DBBFF")}
.lr-in{animation:lr-in .22s ease-out both}
@keyframes lr-in{from{opacity:0;transform:translateY(8px)}}
.lr-done{display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px 20px;text-align:center}
.lr-done-i{width:min(44vw,180px);height:auto;aspect-ratio:256/217}
.lr-done-t{margin:0;font:800 var(--fs-t2)/1.2 var(--f-round);color:var(--label)}
.lr-done-s{margin:0;font:400 var(--fs-sub)/1.4 var(--f-text);color:var(--label2)}
@media (min-width:744px){.lr{--lr-pic:180px;--lr-bird:130px;--lr-wf:2.5rem;gap:16px}.lr-cv{height:48px}.lr-rb{width:104px;height:104px}}
/* un móvil bajo (360×740): todo un poco más junto para que grabar y seguir se vean sin bajar */
@media (max-width:743px) and (max-height:780px){.lr{--lr-pic:min(32vw,124px);--lr-bird:min(26vw,96px);gap:8px}.lr-card{padding:12px}.lr-aud{margin-top:4px}
  .lr-waves{padding:8px 16px;gap:4px 12px}.lr-cv{height:32px}.lr-rb{width:80px;height:80px}.lr-stage{min-height:0}.lr-bub{padding:10px 14px}}
/* en una pantalla ancha y baja (portátil), en dos columnas: la palabra y el loro a la izquierda; las ondas y grabar, a la derecha */
@media (min-width:960px){
  .lr{max-width:920px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-areas:"cap cap" "card waves" "stage ctl" "stage next" "foot foot";align-items:start;gap:16px 24px}
  .lr-cap{grid-area:cap}.lr-card{grid-area:card}.lr-stage{grid-area:stage}.lr-waves{grid-area:waves;align-self:stretch;align-content:center}
  .lr-ctl{grid-area:ctl}.lr-next{grid-area:next}.lr-foot{grid-area:foot}.lr-done{grid-column:1/-1}
}
/* la hoja de la cápsula */
dialog.lr-sh{max-width:560px}
dialog.lr-sh.m-sheet.glass{background:var(--bg);-webkit-backdrop-filter:none;backdrop-filter:none}
${DARK("dialog.lr-sh.m-sheet.glass", "background:var(--bg)")}
.lr-of-s{margin:0 0 12px;font:400 var(--fs-sub)/1.4 var(--f-text);color:var(--label2)}
.lr-of-ws{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 16px;padding:0;list-style:none}
.lr-of-ws li{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;padding:8px 4px;border-radius:var(--r-md);background:var(--card)}
.lr-of-p{position:relative;display:block;width:min(100%,96px);aspect-ratio:1;border-radius:var(--r-sm)}
.lr-of-p img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply}
${DARK(".lr-of-p", "background:#F2F2F7")}
${DARK(".lr-of-p img", "inset:4px;width:calc(100% - 8px);height:calc(100% - 8px)")}
.lr-of-w{max-width:100%;font:700 var(--fs-sub)/1.2 var(--f-round);color:var(--label);overflow-wrap:anywhere;text-align:center}
#lr-of-go .lr-hg{margin-right:2px}
/* el loro en la granja, sobre la valla de la derecha */
.lr-perch{--lr-pw:112px;position:absolute;z-index:6;right:max(10px,var(--safe-r));top:calc(var(--hz) - 10px - var(--lr-pw) * .848);display:flex;flex-direction:column;align-items:center;
  width:calc(var(--lr-pw) + 8px);margin:0;padding:0;border:0;background:none;color:var(--label);cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.lr-perch img{display:block;width:var(--lr-pw);height:calc(var(--lr-pw) * .848);filter:drop-shadow(0 3px 2px rgba(0,0,0,.22));pointer-events:none;-webkit-user-drag:none;user-select:none}
.lr-pl{margin-top:-6px;padding:4px 12px;border-radius:var(--r-pill);background:var(--g-lite,rgba(255,255,255,.96));font:700 var(--fs-note)/1.1 var(--f-text);box-shadow:0 1px 3px rgba(0,0,0,.18)}
${DARK(".lr-pl", "background:rgba(28,28,30,.96)")}
.lr-perch:active img{transform:scale(.96)}
.lr-perch:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px;border-radius:var(--r-md)}
.fm-stage.finding .lr-perch{display:none}
.fm-stage[data-ph=night] .lr-perch img{filter:brightness(.8) saturate(.85) drop-shadow(0 3px 2px rgba(0,0,0,.3))}
@media (min-width:744px){.lr-perch{--lr-pw:128px}}
/* Premios: «Tu voz en el tiempo» */
.lr-tc{padding:16px}
.lr-tc-hd{display:flex;align-items:flex-start;gap:12px;margin:0 0 12px}
.lr-tc-i{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--gold-soft);color:var(--gold-ink)}
.lr-tc-tt{flex:1;min-width:0}
.lr-tc-s{margin:4px 0 0;font:400 var(--fs-note)/1.35 var(--f-text);color:var(--label2)}
.lr-tc-ab{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.lr-tb{display:flex;align-items:center;gap:8px;min-height:52px;margin:0;padding:0 14px;border:0;border-radius:var(--r-md);background:var(--brand-soft);color:var(--brand-ink);font:700 var(--fs-sub)/1.2 var(--f-text);text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}
.lr-tb.is-b{background:var(--ok-soft);color:var(--ok-ink)}
${DARK(".lr-tb", "color:#7DBBFF")}
${DARK(".lr-tb.is-b", "color:var(--ok-ink)")}
.lr-tb.playing,.lr-tw.playing{box-shadow:inset 0 0 0 2px currentColor}
.lr-pi{flex:none;display:grid;place-items:center}
.lr-tc-ws{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0}
.lr-tw{display:inline-flex;align-items:center;gap:6px;min-height:var(--tap);margin:0;padding:0 14px;border:0;border-radius:var(--r-pill);background:var(--fill2);color:var(--label);font:600 var(--fs-sub)/1.2 var(--f-round);cursor:pointer;-webkit-tap-highlight-color:transparent}
.lr-tw .lr-pi{color:var(--brand-tint)}
.lr-tb:focus-visible,.lr-tw:focus-visible,.lr-quiet:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
@media (prefers-reduced-motion:reduce){.lr-bird.is-talk,.lr-st.on,.lr-in{animation:none}.lr-rb::before{transform:none;opacity:var(--lv,0)}.lr-rb.is-rec::before{opacity:calc(.35 + var(--lv,0) * .65)}.lr-spk,.lr-slow,.lr-rb-in{transition:none}}
:root[data-motion=calm] .lr-bird.is-talk,:root[data-motion=calm] .lr-st.on,:root[data-motion=calm] .lr-in{animation:none}
`;
function css(){
  if($id("css-parrot")) return;
  const s = D.createElement("style"); s.id = "css-parrot"; s.textContent = CSS; D.head.appendChild(s);
}

W.vocabParrot = Object.freeze({
  get state(){ return {st: S.st, mic: S.mic, mode: S.mode, word: S.w ? S.w.word : "", ref: S.w ? S.w.ref : "", stars: S.res ? S.res.stars : 0,
    heard: !!(S.res && S.res.heard), paid: S.res ? S.res.paid || 0 : 0, capI: S.capI, capM: S.capM, capHave: [...S.capHave].sort(), perm: PERM,
    me: S.me && S.me.an ? {dur: S.me.an.dur, db: S.me.an.db, heard: S.me.an.heard} : null, nat: S.nat && S.nat.an ? {dur: S.nat.an.dur, db: S.nat.an.db} : null}; },
  CAP, KEY, DAY_CAP, PAY, ECHO_RATE, month, analyze, stats, score, capRecs, paintCapsule, offer, next,
});
})();
