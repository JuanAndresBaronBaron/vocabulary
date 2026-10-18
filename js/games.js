/* módulo games: minijuegos para aprender jugando.
   Rutas: #/juegos (menú) · #/juegos/memoria · #/juegos/lluvia · #/juegos/globos · #/juegos/letras y los juegos que
          registran otros módulos con vocabGames.register (js/lince.js: #/juegos/lince, «Oído de lince»).
   Menú (plan-doc «Jugar › Juegos»): la pastilla «Tema: … ▾» abre una hoja con «Mis palabras» primero y luego los
     temas (se recuerda en "games:topic"); tarjetas sólidas con su dibujo y el récord en estrellas. Tocar = jugar;
     mantener pulsado (G.hold) = vistazo: hoja pequeña con cómo se juega, el récord y con qué palabras.
   Partida: la explicación (intro) sale solo la primera vez de cada juego; después empieza directo. Si se entra sin
     haber tocado nada (al recargar o con Atrás) sale una tarjeta corta «¡A jugar!» para que no empiece solo. El botón
     «?» de arriba vuelve a explicarlo con la partida en pausa. Modo foco, pausa con Esc y con la ✕ («¿Paramos aquí?»)
     y, al terminar, las monedas vuelan desde «+N» hasta el contador: finish() llama a award(n, "", false, desde),
     el único camino de monedas de los juegos.
   Enlace directo con tema: #/juegos/<juego>?t=<tema> juega con ese tema sin cambiar "games:topic" (atajos de Hoy).
   Emite: bus "game-done" {game, score, stars, tries?, tp? (el tema, en los juegos con tema)} · "answer" {ok, es, word, where: "game"}
   Guarda: store "games:best" {juego: {score, stars, tries?, plays}} · "games:topic" (tema elegido) · "games:day"
           (partidas de hoy) · "vocab:ui".gmIntro (juegos cuya explicación ya se vio; solo de este aparato)
   API: window.vocabGames = {pause(desde), paused, how(desde), openTopics(desde), peek(id, desde), list(), images(),
        register(id, def), meta(id) → {id, t, img, topic} | null, topic(id) → {id, name, img} | null}.
        register: def = {t, sub, how, img, words (texto en lugar del tema), rec(best) → texto del récord, fresh (chip
        «Nuevo» en su tarjeta hasta la primera partida), start(app, api, intro)}; start monta el juego con
        api = {mount, intro, later, keys, live, finish, answer, haptic, speak, snd, bump, autoFit, topHtml, starsHtml,
        dotsHtml, nav, here, nm, kbd (true si la última entrada fue una tecla)}.
        Tarjeta que solo lleva a otra pantalla (el Buzón, js/mailbox.js): def = {t, sub, img, href: "#/…", line() → el
        texto de abajo} sin start: sin estrellas, récord ni vistazo, y #/juegos/<id> va a su href. */
(() => {
"use strict";

const MIS = "mis";
const num = v => Number.isFinite(+v) ? +v : 0;
const GAMES = {
  memoria: {t: "Memoria",            sub: "Busca las parejas",       img: "img/games/memoria.png", need: 6, how: "Da la vuelta a dos cartas. Busca cada dibujo con su palabra.",
    rec: b => num(b.tries) ? `${num(b.tries)} intentos` : "Récord"},
  lluvia:  {t: "Lluvia de palabras", sub: "Atrapa la palabra buena", img: "img/games/lluvia.png",  need: 4, how: "Toca solo las burbujas de la palabra que te pido. ¡Cuidado con las otras!",
    rec: b => `${num(b.score)} atrapadas`},
  globos:  {t: "Globos",             sub: "Escucha y explota",       img: "img/games/globos.png",  need: 4, how: "Escucha la palabra y explota el globo de su dibujo.",
    rec: b => `${num(b.score)} de 10`},
  letras:  {t: "Letras locas",       sub: "Ordena las letras",       img: "img/games/letras.png",  need: 3, how: "Toca las letras en orden (o arrástralas) para escribir la palabra.",
    rec: b => `${num(b.score)} puntos`},
};
/* temas con muchas imágenes: [id, dibujo (OpenMoji ya guardado en img/om_<código>.png), nombre, para empezar].
   En la hoja de temas van agrupados como en Palabras: «Temas» y «Las 3000» (los documentos wNN); los de empezar, primero */
const TOPICS = [
  ["animales", "1F436", "Animales", 1], ["colores", "1F3A8", "Colores", 1], ["familia", "1F46A", "Familia", 1], ["w03", "1F34E", "Comida", 1],
  ["w02", "1F4AA", "El cuerpo", 1], ["w04", "1F3E0", "La casa", 1], ["w05", "1F455", "La ropa", 1], ["w07", "1F697", "Transporte", 1],
  ["w09", "1F333", "Naturaleza", 1], ["w13", "26BD", "Deporte y juegos", 1], ["profesiones", "1F477", "Profesiones", 1], ["paises", "1F30D", "Países", 1],
  ["w06", "1F3D9", "La ciudad", 0], ["w14", "1F3AA", "Ocio y fiestas", 0], ["w15", "1F4BB", "Tecnología", 0], ["w28", "1F373", "Cosas de cada día", 0],
  ["w25", "1F3C3", "Moverse", 0], ["w01", "1F9D1-200D-1F91D-200D-1F9D1", "Personas", 0], ["w32", "1F600", "Emociones", 0], ["w31", "1F440", "Cómo son las cosas", 0],
  ["w29", "1F504", "Cambios", 0], ["w16", "1F52C", "Ciencia", 0], ["w26", "1F4AC", "Hablar", 0], ["w08", "1F4C5", "Días y horas", 0],
  ["w20", "1F4AD", "Sentimientos", 0], ["w10", "1F3EB", "El colegio", 0], ["w11", "1F4BC", "Trabajos", 0], ["w12", "1F6D2", "Compras", 0],
  ["nacionalidades", "1F30E", "Nacionalidades", 0],
];
const W3000 = t => /^w\d+$/.test(t[0]);
const START = (a, b) => b[3] - a[3];   /* los de empezar, primero (sort estable: el resto, en su orden) */
const MIS_INFO = [MIS, "2B50", "Mis palabras", 1];
const MIS_MIN = 8;   /* «Mis palabras» necesita al menos 8 palabras con dibujo en el repaso de este idioma */
/* sin gris: un globo gris parecería uno fallado (el fallo va en gris con ✗) */
const BALLOONS = ["#1E6EF4", "#008198", "#34C759", "#FFCC00", "#30B0C7", "#d64545", "#22409a"];
const RM = () => { try{ return window.M && typeof window.M.rm === "function" ? window.M.rm() : matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };   /* M.rm() de js/motion.js */
const IC = (n, s = "bold", z = 22, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
/* la moneda de siempre (la misma que la del contador de arriba) */
const COIN = `<svg class="coin-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="11" fill="#FFCC00"/><circle cx="12" cy="12" r="10.5" fill="none" stroke="#C7A000" stroke-opacity=".8"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#B39000" stroke-opacity=".55" stroke-width="1.4"/><path d="M12 7.8 13.06 10.54 15.99 10.7 13.71 12.56 14.47 15.4 12 13.8 9.53 15.4 10.29 12.56 8.01 10.7 10.94 10.54Z" fill="#A88700" fill-opacity=".8"/></svg>`;

/* ---------- utilidades seguras ---------- */
const snd = n => { try{ if(typeof sfx !== "undefined") sfx.play(n); }catch(e){} };
const note = i => { try{ if(typeof sfx !== "undefined" && typeof sfx.note === "function") sfx.note(i); else snd("pop"); }catch(e){} };
/* chispas (M.burst de js/motion.js); nada con «Reducir movimiento» */
function sparks(el, n = 12){
  try{ if(el && el.isConnected && window.M && typeof M.burst === "function" && !RM()) M.burst(el, {n}); }catch(e){}
}
function speak(t, slow){
  if(!t) return;
  try{ say(t, null, slow); }catch(e){}
}
/* la primera voz tiene que nacer de un toque (iOS): se llama dentro del toque que lleva a la partida */
function unlockVoice(){ try{ if(!("speechSynthesis" in window)) return; const u = new SpeechSynthesisUtterance(" "); if(typeof useVoice === "function") useVoice(u, lang); speechSynthesis.speak(u); }catch(e){} }
/* cada respuesta cuenta para las misiones («Acierta 15 respuestas»); el sonido ya lo pone el propio juego */
const answer = (ok, it) => { try{ bus.emit("answer", {ok: !!ok, es: it && it.es, word: it && it.word, where: "game"}); }catch(e){} };
const pick = a => a[Math.floor(Math.random() * a.length)];
const nm = () => LANGS[lang].name;
const Nm = () => { const s = nm(); return s.charAt(0).toUpperCase() + s.slice(1); };
const fs = w => { const n = [...w].length; return n <= 5 ? "1.5rem" : n <= 8 ? "1.25rem" : n <= 12 ? "1.05rem" : ".92rem"; };
/* estrellas de oro (★★☆) dibujadas con el icono del sprite; las que faltan, en gris */
const starsHtml = (n, z = 18) => `<span class="gm-st" aria-hidden="true">${[0, 1, 2].map(i => `<i class="${i < n ? "on" : ""}">${IC("star", "fill", z)}</i>`).join("")}</span>`;
const dotsHtml = n => `<div class="gm-dots" id="gm-dots">${Array.from({length: n}, () => "<i></i>").join("")}</div>`;

/* ---------- ciclo de vida: un solo juego vivo, se limpia al salir ---------- */
let RUN = null, NAV = 0, CUR_TP = null;
function stop(){
  const r = RUN; if(!r) return;
  RUN = null; r.alive = false;
  r.timers.forEach(clearTimeout);
  if(r.raf) cancelAnimationFrame(r.raf);
  r.clean.forEach(f => { try{ f(); }catch(e){} });
  if(r.keys && document.onkeydown === r.keys) document.onkeydown = null;
  document.querySelectorAll(".gm-ghost").forEach(x => x.remove());
  playMark(null);
  pauseClose();
  howClose();
}
function begin(root){ stop(); RUN = {alive: true, timers: [], raf: 0, clean: [], root, keys: null, paused: false, held: [], g: hparts()[1] || ""}; playMark(hparts()[1] || "juego"); return RUN; }
const live = run => !!run && run.alive && RUN === run && run.root.isConnected;
/* con la partida en pausa, lo que tocaba hacer espera a que siga */
function later(run, fn, ms){ const id = setTimeout(() => { if(!live(run)) return; if(run.paused) run.held.push(fn); else fn(); }, ms); run.timers.push(id); return id; }
function keys(run, fn){ run.keys = e => { if(!live(run)){ document.onkeydown = null; return; } if(run.paused) return; fn(e); }; document.onkeydown = run.keys; }
const hparts = () => location.hash.replace(/^#\/?/, "").split("?")[0].split("/");   /* sin el ?query */
const here = (my, g) => { const h = hparts(); return my === NAV && h[0] === "juegos" && (g === undefined || (h[1] || "") === g); };
/* lectura segura del almacenamiento (por si alguna clave está estropeada) */
const obj = (k) => { const v = store.get(k, null); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; };
/* marca en <html> mientras se juega (otros módulos pueden apartarse: html[data-gm-play]) */
const playMark = g => { try{ if(g) document.documentElement.dataset.gmPlay = g; else delete document.documentElement.dataset.gmPlay; }catch(e){} };

/* el último toque de verdad en un enlace a un juego (su tarjeta, «Jugar» del vistazo, una misión…; Enter en el enlace
   también es un clic): si esa partida se abre justo después, empieza directa; si no (recargar, Atrás, un enlace
   escrito), sale la tarjeta corta «¡A jugar!» para que nada empiece solo */
let TAP = {g: "", t: 0};
addEventListener("click", e => {
  const a = e.isTrusted && e.target.closest && e.target.closest('a[href^="#/juegos/"]');
  if(a) TAP = {g: (a.getAttribute("href").split("/")[2] || "").split("?")[0], t: Date.now()};
}, true);
const tappedNow = g => TAP.g === g && Date.now() - TAP.t < 3000;
/* la explicación ya vista: jugó alguna vez (games:best, se sincroniza) o la vio en este aparato (vocab:ui) */
function uiSeen(){
  try{
    const o = window.vocabUI && typeof vocabUI.get === "function" ? vocabUI.get() : JSON.parse(localStorage.getItem("vocab:ui") || "{}");
    return o && Array.isArray(o.gmIntro) ? o.gmIntro.filter(x => typeof x === "string") : [];
  }catch(e){ return []; }
}
const introSeen = g => { const b = obj("games:best")[g]; return !!(b && typeof b === "object" && num(b.plays) > 0) || uiSeen().includes(g); };
function markSeen(g){
  const l = uiSeen(); if(!g || l.includes(g)) return;
  l.push(g);
  try{
    if(window.vocabUI && typeof vocabUI.set === "function") vocabUI.set("gmIntro", l);
    else { let o = {}; try{ o = JSON.parse(localStorage.getItem("vocab:ui") || "{}") || {}; }catch(e){} o.gmIntro = l; localStorage.setItem("vocab:ui", JSON.stringify(o)); }
  }catch(e){}
}

/* gestos del menú (G.hold de cada tarjeta): se quitan al repintar o al salir */
let GEST = [];
const clearGest = () => { GEST.forEach(off => { try{ off(); }catch(e){} }); GEST = []; };

addEventListener("hashchange", () => { if(!/^#\/?juegos/.test(location.hash)){ NAV++; stop(); clearGest(); closeSheets(); } });
bus.on("route", d => { if(!String((d && d.h) || "").startsWith("juegos")){ NAV++; stop(); clearGest(); closeSheets(); } });

/* ---------- hojas propias (tema, vistazo y «Cómo se juega») ---------- */
function sheetOpen(d, from){
  try{
    if(window.M && typeof M.openSheet === "function") M.openSheet(d, {from: from && from.nodeType === 1 ? from : null});
    else d.showModal();
  }catch(e){ try{ d.showModal(); }catch(e2){ d.setAttribute("open", ""); } }
  d.classList.add("lite");
}
function sheetClose(d, now){
  if(!d || !d.open) return;
  if(!now && window.M && typeof M.closeSheet === "function" && d.classList.contains("m-sheet")) M.closeSheet(d);
  else d.close();
}
function mkSheet(id, label){
  let d = document.getElementById(id);
  if(d) return d;
  d = document.createElement("dialog");
  d.id = id; d.className = "gm-sh"; d.setAttribute("aria-labelledby", label);
  d.dataset.noRenew = ""; d.dataset.noHint = "";
  document.body.appendChild(d);
  return d;
}
function closeSheets(){ ["gm-tp-s", "gm-peek"].forEach(id => sheetClose(document.getElementById(id), true)); }

/* ---------- pausa: Esc o la ✕ del modo foco mientras se juega (html[data-gm-play]) ----------
   Hoja «¿Paramos aquí?» con «Seguir» (destacado) y «Salir». Mientras está abierta la partida se para: la lluvia no
   cae, lo que tocaba hacer espera (later) y las teclas del juego no cuentan. Cerrarla de cualquier forma (Seguir, Esc,
   tocar fuera o bajarla) sigue la partida; «Salir» vuelve a los juegos. window.vocabGames.pause(desde) → true si la abrió. */
let PZ = null;   /* {d, run, exit} */
function pauseSheet(){
  if(PZ && PZ.d.isConnected) return PZ;
  const d = document.createElement("dialog");
  d.id = "gm-pause"; d.className = "gm-pz-d"; d.setAttribute("aria-labelledby", "gm-pz-t");
  d.dataset.noRenew = ""; d.dataset.noHint = "";
  d.innerHTML = `<div class="gm-pz">
    <span class="gm-pz-ic" aria-hidden="true">${typeof ico === "function" ? ico("pause", "bold", 28) : "Ⅱ"}</span>
    <h2 class="gm-pz-t" id="gm-pz-t">¿Paramos aquí?</h2>
    <div class="gm-pz-b">
      <button type="button" class="glass-btn glass-btn--lg" id="gm-pz-out">Salir</button>
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="gm-pz-go" data-key="enter" autofocus>Seguir</button></div></div>`;
  document.body.appendChild(d);
  PZ = {d, run: null, exit: false};
  d.addEventListener("click", e => {
    if(e.target.closest("#gm-pz-go")) pauseClose(true);
    else if(e.target.closest("#gm-pz-out")){ PZ.exit = true; location.hash = "#/juegos"; }
  });
  d.addEventListener("close", () => {
    const run = PZ.run; PZ.run = null;
    if(d.open || !run) return;
    if(PZ.exit || !live(run)){ PZ.exit = false; return; }
    resume(run);
  });
  return PZ;
}
function pause(from){
  const run = RUN;
  if(!live(run) || run.paused || !document.documentElement.hasAttribute("data-gm-play")) return false;
  css();
  const p = pauseSheet(), d = p.d;
  if(d.open) return true;
  run.paused = true; p.run = run; p.exit = false;
  try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch(e){}
  sheetOpen(d, from);   /* en los juegos, el vidrio sin desenfoque */
  return true;
}
function resume(run){
  if(!run.paused) return;
  run.paused = false;
  const held = run.held.splice(0);
  held.forEach(fn => { if(live(run) && !run.paused) fn(); else run.held.push(fn); });
}
/* cerrar la hoja: animada (Seguir) o al momento (al salir del juego) */
function pauseClose(animated){
  if(!PZ || !PZ.d.open) return;
  if(!animated) PZ.exit = true;
  sheetClose(PZ.d, !animated);
}
/* Esc durante una partida: la pausa (con una hoja ya abierta, Esc es de esa hoja) */
document.addEventListener("keydown", e => {
  if(e.key !== "Escape" || e.defaultPrevented || !live(RUN) || !document.documentElement.hasAttribute("data-gm-play")) return;
  if(document.querySelector("dialog[open]")) return;
  e.preventDefault(); e.stopPropagation();
  pause(null);
}, true);

/* ---------- «?»: cómo se juega, con la partida en pausa ----------
   En la tarjeta de inicio solo despliega la explicación; durante la partida abre una hoja pequeña y la partida espera
   (como en la pausa) hasta que se cierra. */
let HW = null;   /* {d, run} */
function how(from){
  const run = RUN; if(!live(run)) return false;
  const G0 = GAMES[run.g]; if(!G0) return false;
  const p = run.root.querySelector("#gm-in-p");
  if(p && p.isConnected){ p.hidden = false; const b = run.root.querySelector("#gm-in-how"); if(b) b.hidden = true; return true; }
  if(run.paused) return false;
  css();
  const d = mkSheet("gm-how", "gm-how-t");
  if(!HW || HW.d !== d){
    HW = {d, run: null};
    d.addEventListener("click", e => { if(e.target.closest("[data-close]")) sheetClose(d); });
    d.addEventListener("close", () => { const r = HW.run; HW.run = null; if(!d.open && r && live(r)) resume(r); });
  }
  d.innerHTML = `<div class="m-head"><h2 id="gm-how-t">Cómo se juega</h2></div>
    <div class="gm-how"><img class="gm-how-i" src="${esc(G0.img)}" alt="" width="72" height="72" draggable="false">
      <p class="gm-how-p">${esc(G0.how)}</p></div>
    <button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" data-close autofocus>Seguir</button>`;
  run.paused = true; HW.run = run;
  try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch(e){}
  sheetOpen(d, from);
  return true;
}
function howClose(){ if(HW && HW.d.open){ HW.run = null; sheetClose(HW.d, true); } }
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-gm-how]"); if(b){ e.preventDefault(); how(b); } });

/* ---------- palabras ---------- */
const ARTS = {
  english: /^(?:the|an?|to)\s+/i,
  "français": /^(?:les|le|la|une|un|des|du|se)\s+|^(?:l|s|d)['’]/i,
  dansk: /^(?:en|et|at)\s+/i,
};
function cleanW(w){
  let s = String(w || "").replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if(s.includes("/")){
    const p = s.split("/").map(x => x.trim());
    s = p[0];
    if(/^(le|la|l'|un|une|en|et|the)$/i.test(s) && p[1]) s = s + " " + p[1].replace(ARTS[lang] || /^$/, "");
  }
  return s.trim();
}
function esShort(es, doc){
  let s = String(es || "").split(/[\/,;]/)[0].replace(/\s*\([^)]*\)/g, "").trim();
  if(doc !== "paises" && s.length > 1 && s[1] === s[1].toLowerCase()) s = s[0].toLowerCase() + s.slice(1);
  return s;
}
function splitArt(w){
  const m = w.match(ARTS[lang]);
  return m ? {art: m[0].trim(), base: w.slice(m[0].length)} : {art: "", base: w};
}
/* palabra apta para Letras locas: solo letras, de 3 a 8, sin espacios */
function letrasOf(it){
  const {art, base} = splitArt(it.word), b = base.normalize("NFC");
  return /^\p{L}{3,8}$/u.test(b) ? {art, base: b} : null;
}
async function rowsFor(src){
  if(src === MIS){
    const by = {};
    for(const x of Object.values(srsAll())) if(x && x.d) (by[x.d] = by[x.d] || new Set()).add(x.e);
    const out = [];
    await Promise.all(Object.keys(by).map(id => getDoc(id).then(doc => {
      for(const r of doc.rows) if(r.es && by[id].has(r.es)) out.push({r, d: id});
    }).catch(() => {})));
    return out;
  }
  const doc = await getDoc(src);
  return doc.rows.map(r => ({r, d: src}));
}
async function pool(src){
  const L = lang, sw = new Set(), se = new Set(), si = new Set(), out = [];
  for(const {r, d} of await rowsFor(src)){
    const x = r && r.es && r.img && r.l && r.l[L];
    if(!x || !x.word) continue;
    const word = cleanW(x.word), es = esShort(r.es, d);
    if(!word || !es) continue;
    const kw = word.toLowerCase(), ke = es.toLowerCase();
    if(sw.has(kw) || se.has(ke) || si.has(r.img)) continue;
    sw.add(kw); se.add(ke); si.add(r.img);
    out.push({k: d + "|" + r.es, es, word, img: r.img, doc: d});
  }
  return out;
}
const topicId = () => { const t = store.get("games:topic", "animales"); return typeof t === "string" && (t === MIS || TOPICS.some(x => x[0] === t)) ? t : "animales"; };
const isTopic = t => typeof t === "string" && (t === MIS || TOPICS.some(x => x[0] === t));
/* #/juegos/<juego>?t=<tema> (los atajos de Hoy, js/shortcuts.js): juega con ese tema sin cambiar el elegido (games:topic) */
const hashTopic = () => { try{ const t = new URLSearchParams(location.hash.split("?")[1] || "").get("t"); return isTopic(t) ? t : null; }catch(e){ return null; } };
const topicInfo = id => id === MIS ? MIS_INFO : (TOPICS.find(x => x[0] === id) || TOPICS[0]);
const topicName = id => topicInfo(id)[2];
const topicImg = id => `img/om_${topicInfo(id)[1]}.png`;
/* con qué palabras se juega: el tema, o lo que diga el juego (Oído de lince usa sus propias parejas) */
const wordsLabel = g => (GAMES[g] && GAMES[g].words) || topicName(CUR_TP || topicId());
const usable = (g, P) => g === "letras" ? P.filter(letrasOf).length : P.length;
/* los árboles de familia, en los juegos, recortados a su contenido (img/fam2/, mismos nombres): el dibujo llena su
   recuadro, y novio/esposo y novia/esposa (el mismo árbol con otra etiqueta) llevan un corazón o unos anillos entre
   los dos. Si el recortado no carga (sin conexión antes de haberlo visto), vuelve al de siempre */
const picSrc = src => typeof src === "string" ? src.replace(/^img\/fam_/, "img/fam2/fam_") : src;
const FLAG_DOCS = new Set(["paises", "nacionalidades"]);
const preload = items => items.forEach(x => { if(x.img){ const im = new Image(); im.src = picSrc(x.img); } });
const imgTag = (it, cls = "") => {
  const src = picSrc(it.img), c = (cls + (FLAG_DOCS.has(it.doc) ? " gm-flag" : "")).trim();
  return `<img${c ? ` class="${c}"` : ""} src="${esc(src)}"${src !== it.img ? ` data-f="${esc(it.img)}" onerror="if(this.dataset.f){this.src=this.dataset.f;delete this.dataset.f}"` : ""} alt="" draggable="false">`;
};
/* «Mis palabras»: cuántas del repaso de este idioma tienen dibujo (se cuenta al abrir el menú) */
let MIS_N = null, MIS_LANG = null;
async function countMis(){
  if(MIS_LANG === lang && MIS_N !== null) return MIS_N;
  const L = lang;
  let n = 0;
  if(Object.keys(srsAll()).length >= MIS_MIN){ try{ n = (await pool(MIS)).length; }catch(e){ n = 0; } }
  if(L === lang){ MIS_N = n; MIS_LANG = L; }
  return n;
}
bus.on("lang", () => { MIS_N = null; MIS_LANG = null; });

/* ---------- estilos ---------- */
const CSS = `
.gm{--gm-tile:#fff;max-width:880px;margin:0 auto}
[data-theme=dark] .gm{--gm-tile:#e9eef5}
.gm img{-webkit-user-drag:none;user-select:none}
.gm button{-webkit-tap-highlight-color:transparent}
.gm-wait{margin:24px 0;text-align:center;font:400 var(--fs-sub)/1.4 var(--f-text);color:var(--label2)}
.gm-empty{display:flex;flex-direction:column;align-items:center;gap:16px;margin:32px auto;max-width:420px;text-align:center;font:400 var(--fs-body)/1.4 var(--f-text);color:var(--label2)}
.gm-top{display:flex;align-items:center;gap:8px;margin:0 0 12px}
.gm-x{flex:none;width:44px;height:44px;border-radius:50%;background:var(--fill);color:var(--label);display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
.gm-name{font:700 var(--fs-head)/1.2 var(--f-round);display:flex;align-items:center;gap:8px;min-width:0;color:var(--label)}
.gm-name img{flex:none;width:32px;height:32px}
.gm-name .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* «?»: el mismo vidrio ligero que la ✕ de la barra de arriba */
.gm-help{position:relative;flex:none;width:var(--tap);height:var(--tap);padding:0;border:0;border-radius:50%;display:grid;place-items:center;
  color:var(--label);margin-right:auto;cursor:pointer;-webkit-tap-highlight-color:transparent}
.gm-help:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
/* en el móvil, en modo foco la fila es la barra de arriba (entre la ✕ y las monedas): sin el dibujo del juego para que quepa */
@media (max-width:560px){:root[data-focus] .gm-name{display:none}}
.gm-stats{display:flex;gap:6px;flex:none}
.gm-pill{display:inline-flex;align-items:center;gap:4px;min-height:36px;padding:0 12px;border-radius:999px;background:var(--fill);color:var(--label);
  font:700 var(--fs-sub)/1 var(--f-round);font-variant-numeric:tabular-nums;white-space:nowrap}
.gm-pill b{font-size:1.1em}
.gm-pill>.ico{color:var(--label2)}
.gm-pill>.ico.gm-gold{color:var(--gold);filter:drop-shadow(0 1px 0 rgba(0,0,0,.14))}
.gm-pill.bump,.gm-bump{animation:gm-bump .4s}
@keyframes gm-bump{40%{transform:scale(1.2)}}
.gm-tip{color:var(--label2);text-align:center;margin:12px 0 0;font:400 var(--fs-note)/1.35 var(--f-text)}
/* menú: la pastilla del tema y las tarjetas (sólidas; el color solo en el dibujo y en las estrellas) */
.gm.gm-menu{max-width:none;margin:0}
.gm-bar{display:flex;align-items:center;gap:8px;margin:0 0 16px;min-width:0}
.gm-tpill{gap:6px;font-size:var(--fs-sub);font-weight:400;min-height:var(--tap);padding:0 14px 0 16px;max-width:100%}
.gm-tpill b{font-weight:600;overflow:hidden;text-overflow:ellipsis}
.gm-tpill .ico{flex:none;color:var(--label2)}
.gm-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(156px,1fr));gap:12px;margin:0 0 24px}
.gm-card{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:184px;padding:16px;border-radius:var(--r-card);
  background:var(--card);color:var(--label);text-decoration:none;box-shadow:0 1px 3px rgba(0,0,0,.06);-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;user-select:none}
.gm-ci{width:64px;height:64px;margin:0 0 8px;pointer-events:none}
.gm-ct{font:700 var(--fs-head)/1.2 var(--f-round);color:var(--label)}
.gm-cs{font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
/* el récord: siempre una sola línea del mismo alto (si no cabe, con «…») */
.gm-cr{box-sizing:border-box;margin-top:auto;padding-top:12px;height:36px;width:100%;min-width:0;display:flex;align-items:center;gap:8px;white-space:nowrap}
.gm-cr .gm-st{flex:none}
.gm-rt{min-width:0;overflow:hidden;text-overflow:ellipsis;font:600 var(--fs-min)/1.2 var(--f-text);color:var(--label2);font-variant-numeric:tabular-nums}
.gm-new{position:absolute;top:12px;right:12px;display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border-radius:999px;
  background:var(--gold-soft);color:var(--gold-ink);font:700 var(--fs-min)/1 var(--f-text)}
.gm-st{display:inline-flex;gap:1px;line-height:0}
.gm-st i{display:inline-grid;color:var(--fill2,rgba(120,120,128,.24))}
.gm-st i.on{color:var(--gold)}
.gm-st i.on .ico{filter:drop-shadow(0 1px 0 rgba(0,0,0,.14))}
/* hojas: tema, vistazo y «Cómo se juega» (opacas, sin desenfoque) */
dialog.gm-sh{max-width:560px}
dialog.gm-sh.m-sheet.glass{background:#F2F2F7;-webkit-backdrop-filter:none;backdrop-filter:none}
:root[data-theme=dark] dialog.gm-sh.m-sheet.glass{background:#1C1C1E}
dialog.gm-sh .st-g{background:var(--card)}
:root[data-theme=dark] dialog.gm-sh .st-g{background:var(--card-2,#2C2C2E)}
.gm-tp-sub{margin:0 8px 16px;text-align:center;font:400 var(--fs-note)/1.35 var(--f-text);color:var(--label2)}
.gm-tp-r{color:var(--label);font:400 var(--fs-sub)/1.25 var(--f-text);text-align:left}
.gm-tp-r .gm-tp-i{flex:none;width:30px;height:30px}
.gm-tp-r .gm-tp-ok{flex:none;color:var(--brand-tint)}
.gm-tp-r[aria-disabled=true]{cursor:default}
.gm-tp-r[aria-disabled=true] .gm-tp-n,.gm-tp-r[aria-disabled=true] .gm-tp-i{opacity:.55}
.gm-pk{display:flex;align-items:flex-start;gap:16px;margin:4px 4px 16px}
.gm-pk-i{flex:none;width:72px;height:72px}
.gm-pk-p{margin:0;font:400 var(--fs-body)/1.4 var(--f-text);color:var(--label)}
.gm-pk-g{margin:0 0 16px;padding:4px 0}
.gm-pk-r{display:flex;align-items:center;gap:12px;min-height:var(--row);padding:8px 16px;font:400 var(--fs-sub)/1.3 var(--f-text);color:var(--label)}
.gm-pk-r+.gm-pk-r{border-top:.5px solid var(--sep)}
.gm-pk-r>span:first-child{flex:1;color:var(--label2)}
.gm-pk-r b{font-weight:600}
.gm-how{display:flex;align-items:center;gap:16px;margin:4px 4px 20px}
.gm-how-i{flex:none;width:72px;height:72px}
.gm-how-p{margin:0;font:400 var(--fs-body)/1.4 var(--f-text);color:var(--label)}
/* explicación del juego (la primera vez) y tarjeta corta «¡A jugar!»: una tarjeta sólida bajo la ✕ del modo foco */
.gm-intro{position:fixed;inset:0;z-index:9;background:rgb(0 0 0/.2);display:flex;align-items:flex-start;justify-content:center;
  padding:calc(var(--bar-top,16px) + var(--tap,44px) + 16px) 16px calc(var(--safe-b,0px) + 16px);overflow:auto;animation:gm-fade .2s}
.gm-intro-c{margin:auto;background:var(--card);color:var(--label);border-radius:32px;padding:24px 20px 16px;text-align:center;max-width:400px;width:100%;
  box-shadow:0 20px 50px rgba(0,0,0,.25);display:flex;flex-direction:column;align-items:center;gap:8px;animation:gm-in .3s}
.gm-intro-i{width:96px;height:96px}
.gm-intro-t{margin:0;font:700 var(--fs-t2)/1.15 var(--f-round);color:var(--label)}
.gm-intro-p{margin:0 0 4px;font:400 var(--fs-body)/1.4 var(--f-text);color:var(--label)}
.gm-intro-tp{display:inline-block;margin:0 0 12px;padding:6px 12px;border-radius:999px;background:var(--fill);font:600 var(--fs-note)/1.2 var(--f-text);color:var(--label)}
.gm-intro-back,.gm-intro-how{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;margin-top:4px;padding:0 12px;border:0;background:none;
  color:var(--brand-ink);font:600 var(--fs-sub)/1.2 var(--f-text);text-decoration:none;border-radius:12px;cursor:pointer}
.gm-intro-how[hidden]{display:none}
@media (max-height:640px){.gm-intro-i{width:64px;height:64px}.gm-intro-c{padding:16px 16px 12px}}
@keyframes gm-fade{from{opacity:0}}
@keyframes gm-in{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
/* memoria */
.gm-board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;max-width:620px;margin:0 auto}
.gm-mc{position:relative;aspect-ratio:4/5;border:0;padding:0;background:none;border-radius:16px;touch-action:manipulation;cursor:pointer;perspective:900px}
.gm-mc-in{position:absolute;inset:0;transition:transform .5s cubic-bezier(.3,1.35,.5,1);transform-style:preserve-3d}
@media (hover:hover){.gm-mc:not(.up):hover .gm-mc-in{transform:translateY(-3px) rotate(-1deg)}}
.gm-mc.up .gm-mc-in{transform:rotateY(180deg)}
.gm-mc-f{position:absolute;inset:0;border-radius:16px;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:flex;align-items:center;justify-content:center;overflow:hidden}
.gm-mc-back{background-image:radial-gradient(rgba(255,255,255,.2) 2px,transparent 2.6px),linear-gradient(var(--brand-fill),var(--brand-fill));background-size:14px 14px,100% 100%;box-shadow:0 2px 6px rgba(0,0,0,.16)}
.gm-mc-back span{width:58%;aspect-ratio:1;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:2.2rem;font-weight:900;color:#fff}
.gm-mc-face{transform:rotateY(180deg);background:var(--gm-tile);border:3px solid var(--sep)}
.gm-mc-face img{width:92%;height:92%;object-fit:contain}
/* en oscuro, la cara del dibujo en blanco: los dibujos opacos (familia) no quedan como un rectángulo blanco sobre gris */
[data-theme=dark] .gm-mc-face.k-img{background:#fff}
.gm-mc-face.k-word{background:var(--card);padding:6px}
.gm-mw{font-weight:900;line-height:1.15;text-align:center;overflow-wrap:anywhere;color:var(--label)}
.gm-mc.ok .gm-mc-face{border-color:var(--ok);box-shadow:0 0 0 4px color-mix(in srgb,var(--ok) 30%,transparent)}
.gm-mc.ok{animation:gm-yay .55s}
.gm-mc.ok::after,.gm-mc.no::after{position:absolute;right:-6px;top:-6px;width:28px;height:28px;border-radius:50%;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.2);z-index:2}
.gm-mc.ok::after{content:"✓";background:var(--ok-fill);color:#fff}
.gm-mc.no::after{content:"✗";background:var(--miss-fill);color:var(--miss-on)}
.gm-mc.no .gm-mc-face{border-color:var(--miss)}
@keyframes gm-yay{40%{transform:scale(1.1) rotate(2deg)}}
/* lluvia */
.gm-catch{display:flex;align-items:center;justify-content:center;gap:12px;background:var(--card);border-radius:var(--r-card);padding:8px 10px 8px 16px;margin-bottom:10px;min-height:64px}
.gm-catch-l{color:var(--label2);font:600 var(--fs-sub)/1.2 var(--f-text)}
.gm-catch b{font:800 1.65rem/1.1 var(--f-round);color:var(--brand-ink)}
.gm-say{flex:none;width:52px;height:52px;border-radius:50%;border:0;background:var(--brand-fill);color:#fff;display:grid;place-items:center;cursor:pointer}
.gm-tbar{height:12px;border-radius:99px;background:var(--fill);overflow:hidden;margin:0 0 10px}
.gm-tbar i{display:block;height:100%;width:100%;background:var(--teal);border-radius:99px;transform-origin:left center}
.gm-tbar.low i{background:var(--gold)}
.gm-sky{position:relative;height:min(60vh,540px);min-height:280px;border-radius:22px;overflow:hidden;touch-action:manipulation;user-select:none;-webkit-user-select:none;
  background:linear-gradient(180deg,#0f3d75 0%,#1f6fd1 58%,#1a9e94 100%)}
[data-theme=dark] .gm-sky{background:linear-gradient(180deg,#081a30 0%,#0f3156 60%,#0f5a55 100%)}
.gm-cl{position:absolute;font-size:2.6rem;opacity:.9;pointer-events:none;top:-6px}
.gm-cl.c1{left:6%}.gm-cl.c2{left:44%;font-size:3.2rem;top:-14px}.gm-cl.c3{right:6%}
.gm-bub{position:absolute;left:0;top:0;border:0;padding:0;margin:0;background:none;display:flex;flex-direction:column;align-items:center;gap:4px;will-change:transform;cursor:pointer;touch-action:none;color:#fff;-webkit-touch-callout:none}
.gm-bub-i{width:var(--bs);height:var(--bs);border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff 0 58%,#e4eefa 100%);border:3px solid rgba(255,255,255,.9);box-shadow:0 0 0 5px rgba(255,255,255,.16),0 8px 18px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;position:relative}
.gm-bub-i::after{content:"";position:absolute;left:18%;top:12%;width:22%;height:14%;border-radius:50%;background:rgba(255,255,255,.9);transform:rotate(-30deg)}
/* multiply: el fondo blanco de los dibujos opacos (familia) se funde con la burbuja (sin un cuadrado blanco encima) */
.gm-bub-i img{width:70%;height:70%;object-fit:contain;pointer-events:none;mix-blend-mode:multiply}
.gm-bub-w{background:rgba(6,22,42,.8);color:#fff;font-weight:800;border-radius:999px;padding:3px 10px;font-size:.95rem;max-width:max(var(--bs) + 8px,108px);text-align:center;line-height:1.15;pointer-events:none;overflow-wrap:break-word}
.gm-bub.pop .gm-bub-i{animation:gm-burst .32s forwards}
.gm-bub.pop .gm-bub-w{opacity:0;transition:opacity .2s}
.gm-bub.bad .gm-bub-i{border-color:var(--miss);background:#d5dbe3}
.gm-bub.bad .gm-bub-i img{opacity:.55}
.gm-bub.gone{opacity:0;transition:opacity .35s}
@keyframes gm-burst{50%{transform:scale(1.3)}100%{transform:scale(1.6);opacity:0}}
.gm-float{position:absolute;z-index:5;font-weight:900;color:#fff;font-size:1.35rem;pointer-events:none;animation:gm-up 1s forwards;text-shadow:0 2px 0 rgba(0,0,0,.35);white-space:nowrap;transform:translateX(-50%)}
.gm-float.bad{background:#6C6C70;color:#fff;border-radius:999px;padding:2px 12px;font-size:1.05rem;text-shadow:none}
@keyframes gm-up{to{translate:0 -60px;opacity:0}}
.gm-over{position:absolute;inset:0;z-index:8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:rgba(5,15,30,.5);color:#fff;font-size:2rem;font-weight:900;text-align:center;animation:gm-fade .3s;padding:16px}
.gm-over span{font-size:4rem;line-height:1}
/* vidas: corazones dorados; el que se pierde queda en contorno gris (nunca rojo) */
.gm-lives{gap:2px}
.gm-lives i{font-style:normal;display:inline-flex;color:var(--gold);filter:drop-shadow(0 1px 0 rgba(0,0,0,.14))}
.gm-lives i .ico+.ico,.gm-lives i.lost .ico:first-child{display:none}
.gm-lives i.lost .ico+.ico{display:inline-block}
.gm-lives i.lost{color:var(--label2);filter:none}
.gm-lives i.hurt{animation:gm-hurt .6s}
@keyframes gm-hurt{30%{transform:scale(1.6)}100%{transform:scale(1)}}
/* banderas (4:3): la caja del dibujo mide lo mismo que la bandera y lleva un filete fino, para que el blanco de Japón,
   Polonia o Inglaterra no se funda con el recuadro blanco (nunca recortada: los escudos se ven enteros) */
:is(.gm-bal-i,.gm-mc-face,.gm-lt-pic,.gm-bub-i)>img.gm-flag{height:auto;max-height:94%;aspect-ratio:293/220;object-fit:fill;border-radius:4px;box-shadow:0 0 0 1px rgba(0,0,0,.2)}
/* globos */
.gm-listen{position:relative;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;background:var(--card);border-radius:var(--r-card);padding:12px;margin-bottom:12px;min-height:96px}
/* el altavoz grande, tintado como el de la lección (el único botón relleno de la pantalla es el de seguir) */
.gm-bigsay{position:relative;width:72px;height:72px;border-radius:50%;border:0;background:var(--brand-soft);color:var(--brand-tint);display:grid;place-items:center;flex:none;cursor:pointer;
  transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms)}
.gm-bigsay.playing{background:var(--brand-fill);color:#fff}
.gm-bigsay.playing::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:3px solid var(--brand-tint);opacity:0;animation:gm-wave .9s ease-out 3;pointer-events:none}
@keyframes gm-wave{0%{opacity:.55;scale:.9}100%{opacity:0;scale:1.28}}
.gm-bigsay.ring{animation:gm-ring 1.1s ease-out 2}
@keyframes gm-ring{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--brand-fill) 55%,transparent)}100%{box-shadow:0 0 0 22px transparent}}
/* la frase de la tarjeta de escuchar tiene sitio para 2 líneas: un fallo, la palabra escrita o el acierto no cambian el
   alto de la tarjeta (los globos no se mueven ni cambian de tamaño a mitad de ronda) */
.gm-ltxt{flex-basis:100%;text-align:center;color:var(--label2);font:600 var(--fs-sub)/1.3 var(--f-text);min-height:1.5em}
.gm-ltxt b{color:var(--brand-ink);font-size:1.45rem}
.gm-bal-g .gm-ltxt{min-height:2.8em}
.gm-bal-g .gm-ltxt b{line-height:1}
/* el acierto, en la misma frase (un solo mensaje): verde y en negrita */
.gm-ltxt .gm-reveal{color:var(--ok-ink);font-weight:800}
.gm-air{position:relative;display:grid;grid-template-columns:repeat(var(--cols,4),minmax(0,1fr));column-gap:16px;row-gap:8px;align-content:space-evenly;padding:12px 8px 0;
  min-height:var(--airh,300px);height:var(--airh,auto);border-radius:22px;overflow:hidden;
  background:radial-gradient(ellipse 120px 34px at 12% 100%,rgba(255,255,255,.95) 98%,transparent),radial-gradient(ellipse 160px 40px at 62% 102%,rgba(255,255,255,.9) 98%,transparent),radial-gradient(ellipse 110px 30px at 95% 100%,rgba(255,255,255,.95) 98%,transparent),linear-gradient(180deg,#bfe0ff 0%,#e6f3ff 100%)}
[data-theme=dark] .gm-air{background:radial-gradient(ellipse 120px 34px at 12% 100%,rgba(120,150,190,.35) 98%,transparent),radial-gradient(ellipse 160px 40px at 62% 102%,rgba(120,150,190,.3) 98%,transparent),radial-gradient(ellipse 110px 30px at 95% 100%,rgba(120,150,190,.35) 98%,transparent),linear-gradient(180deg,#0b1f3a 0%,#163a5f 100%)}
.gm-bal{position:relative;border:0;background:none;padding:0;display:flex;flex-direction:column;align-items:center;touch-action:manipulation;cursor:pointer;animation:gm-rise .9s cubic-bezier(.2,.9,.25,1) var(--d) both}
.gm-bal:disabled{cursor:default}
/* el ancho del globo (--bw) lo calcula fitBal() con el hueco que queda en la pantalla */
.gm-bal-b{position:relative;width:var(--bw,min(148px,100%));max-width:100%;aspect-ratio:9/11;border-radius:50% 50% 50% 50%/56% 56% 44% 44%;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(ellipse 13% 6% at 33% 10%,rgba(255,255,255,.62) 0 60%,transparent 100%),radial-gradient(circle at 50% 40%,rgba(255,255,255,.18),transparent 70%),var(--bc);
  box-shadow:inset -10px -14px 0 rgba(0,0,0,.13),0 10px 16px rgba(0,0,0,.18);animation:gm-sway 3.2s ease-in-out 3;animation-delay:calc(var(--d) * -3)}
.gm-bal-b::after{content:"";position:absolute;left:50%;bottom:-9px;transform:translateX(-50%);border:8px solid transparent;border-bottom:11px solid var(--bc);border-top:0}
/* el dibujo, en un cuadrado blanco de esquinas redondeadas (igual para todos los temas): cabe entero dentro del globo,
   no corta las esquinas de los dibujos opacos (familia) ni las banderas y deja el dibujo al ~77 % del ancho del globo,
   con globo de color alrededor. Un poco por debajo del centro, donde el globo es más ancho */
.gm-bal-i{width:80%;aspect-ratio:1;margin-top:4%;border-radius:26%;overflow:hidden;background:var(--gm-tile);display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.14)}
.gm-bal-i img{width:96%;height:96%;object-fit:contain;pointer-events:none;mix-blend-mode:multiply}
.gm-bal-s{display:block;width:2px;height:var(--sh,54px);background:rgba(60,60,67,.4);margin-top:8px;border-radius:2px;transform-origin:top;animation:gm-string 3.2s ease-in-out 3;animation-delay:calc(var(--d) * -3)}
[data-theme=dark] .gm-bal-s{background:rgba(235,235,245,.4)}
.gm-bal.pop .gm-bal-b{animation:gm-burst .3s forwards}
.gm-bal.pop .gm-bal-s{animation:gm-drop .6s forwards}
.gm-bal.no .gm-bal-b{filter:grayscale(1);opacity:.45;animation:none}
.gm-bal.no .gm-bal-s{opacity:.35;animation:none}
.gm-bal .gm-bx{display:none}
/* la ✗ del fallo, arriba del globo (fuera del dibujo: se ve lo que se tocó), gris sólido con la ✗ blanca */
.gm-bal.no .gm-bx{--xs:clamp(24px,calc(var(--bw,148px) * .17),36px);display:flex;position:absolute;left:50%;top:calc(var(--bw,148px) * .04);transform:translateX(-50%);z-index:2;
  width:var(--xs);height:var(--xs);border-radius:50%;align-items:center;justify-content:center;
  background:var(--miss);color:#fff;font-weight:900;font-size:calc(var(--xs) * .52);line-height:1;box-shadow:0 0 0 2px rgba(255,255,255,.85),0 2px 6px rgba(0,0,0,.2)}
.gm-bal.dim{opacity:.4;transition:opacity .3s}
.gm-bang{position:absolute;left:50%;top:36%;transform:translate(-50%,-50%);font-size:max(3rem,calc(var(--bw,116px) * .42));pointer-events:none;animation:gm-bang .55s forwards}
@keyframes gm-bang{0%{transform:translate(-50%,-50%) scale(.3)}50%{transform:translate(-50%,-50%) scale(1.3)}100%{transform:translate(-50%,-50%) scale(1.5);opacity:0}}
@keyframes gm-rise{from{transform:translateY(340px);opacity:.2}to{transform:none;opacity:1}}
/* balanceo corto (±2°) para que dos globos grandes juntos no se toquen; el vaivén de arriba abajo, como siempre */
@keyframes gm-sway{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-10px) rotate(2deg)}}
@keyframes gm-string{0%,100%{transform:rotate(2deg)}50%{transform:rotate(-2deg)}}
@keyframes gm-drop{to{transform:translateY(80px) rotate(30deg);opacity:0}}
.gm-dots{display:flex;gap:6px;justify-content:center;margin:12px 0 0;flex-wrap:wrap}
.gm-dots i{width:14px;height:14px;border-radius:50%;background:var(--fill)}
.gm-dots i.ok{background:var(--ok)}.gm-dots i.meh{background:var(--miss)}.gm-dots i.now{outline:3px solid var(--brand-tint);outline-offset:2px}
/* letras */
.gm-lt{background:var(--card);border-radius:var(--r-card);padding:18px 14px 20px;text-align:center;max-width:620px;margin:0 auto;position:relative}
/* el dibujo crece con el alto de la pantalla (cabe sin bajar: si no, .gm-short lo deja en 100 px) */
.gm-lt-pic{width:clamp(112px,24vh,200px);width:clamp(112px,24svh,200px);aspect-ratio:1;height:auto;margin:0 auto;border-radius:26px;background:var(--gm-tile);display:flex;align-items:center;justify-content:center;border:2px solid var(--sep);animation:gm-in .4s both}
.gm-lt-pic img{width:92%;height:92%;object-fit:contain;mix-blend-mode:multiply}
.gm-lt-es{font:800 1.5rem/1.2 var(--f-round);margin:10px 0 4px;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}
.gm-lt-n{margin:0;color:var(--label2);font:400 var(--fs-note)/1.3 var(--f-text)}
.gm-art{display:inline-flex;align-items:center;gap:6px;background:var(--fill);border:2px dashed var(--brand-tint);color:var(--brand-ink);border-radius:999px;padding:3px 12px;font-weight:800;font-size:1rem}
.gm-slots{--n:5;display:flex;justify-content:center;gap:6px;margin:16px auto 16px;max-width:460px}
.gm-slot{position:relative;flex:none;width:min(52px,calc((100% - (var(--n) - 1) * 6px) / var(--n)));aspect-ratio:1;border-radius:12px;border:3px dashed var(--sep);background:var(--fill);font-size:clamp(1.1rem,5vw,1.6rem);font-weight:900;display:flex;align-items:center;justify-content:center;color:var(--label);padding:0;transition:transform .15s}
.gm-slot.fill{border-style:solid;border-color:var(--brand-tint);background:var(--card)}
.gm-slot.next{border-color:var(--brand-tint);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand-tint) 20%,transparent)}
.gm-slot.good{border-style:solid;border-color:var(--ok);background:color-mix(in srgb,var(--ok) 16%,var(--card));color:var(--ok-ink)}
.gm-slot.hint{border-style:solid;border-color:#FFCC00;background:color-mix(in srgb,#FFCC00 22%,var(--card));color:var(--label)}
.gm-slot.wrong{border-style:solid;border-color:var(--miss);background:var(--miss-fill);color:var(--miss-on)}
.gm-slot.wrong::after{content:"✗";position:absolute;right:-7px;top:-7px;width:20px;height:20px;border-radius:50%;background:var(--miss);color:#fff;font-size:.75rem;display:grid;place-items:center}
.gm-slot.win{animation:gm-hop .5s calc(var(--i) * 70ms) both}
.gm-slot.drop{transform:scale(1.12);border-color:var(--brand-tint)}
@keyframes gm-hop{40%{transform:translateY(-12px)}}
.gm-tiles{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;min-height:58px;max-width:480px;margin:0 auto}
/* las letras se arrastran: touch-action:none para que el navegador no se quede el gesto (pointercancel en iOS) */
.gm-tile{width:54px;height:54px;border-radius:13px;border:0;background:linear-gradient(180deg,#FFE680,#FFCC00);color:#3D2B00;font-size:1.65rem;font-weight:900;box-shadow:0 4px 0 #B38F00;
  touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:grab;animation:gm-in .3s calc(var(--i) * 40ms) backwards}
.gm-tile.used{visibility:hidden}
.gm-tile.drag{opacity:.3;animation:none}
.gm-ghost{position:fixed;z-index:1000;pointer-events:none;width:58px;height:58px;border-radius:13px;background:linear-gradient(180deg,#FFE680,#FFCC00);color:#3D2B00;font-size:1.75rem;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 24px rgba(0,0,0,.3);transform:translate(-50%,-60%) rotate(-6deg) scale(1.12)}
.gm-lt-acts{display:flex;gap:8px;justify-content:center;margin-top:18px;flex-wrap:wrap}
.gm-lt-ok{margin-top:14px;background:color-mix(in srgb,var(--ok) 15%,var(--card));color:var(--ok-ink);border-radius:16px;padding:12px;font-weight:800;font-size:1.15rem;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;animation:gm-in .3s both}
.gm-lt-ok span{color:var(--label);font-weight:700}
.gm-lt-ok .gm-say{width:48px;height:48px}
.gm-lt.solved .gm-tiles,.gm-lt.solved .gm-lt-acts{display:none}
/* resultado: una tarjeta sólida; las monedas salen volando de «+N» (#gm-plus) hasta el contador */
.gm-end{position:relative;background:var(--card);border-radius:var(--r-card);padding:24px 16px 20px;text-align:center;max-width:560px;margin:0 auto;display:flex;flex-direction:column;align-items:center}
.gm-end-hero{display:inline-block;animation:gm-jump .9s ease-in-out 2}
@keyframes gm-jump{0%,100%{transform:translateY(0)}30%{transform:translateY(-18px) rotate(-5deg)}60%{transform:translateY(0) rotate(4deg)}}
.gm-end-t{margin:8px 0 0;font:700 var(--fs-t2)/1.15 var(--f-round);color:var(--label)}
.gm-end-st{display:flex;gap:6px;margin:8px 0 4px;line-height:0}
.gm-es{display:inline-grid;color:var(--fill2,rgba(120,120,128,.24))}
.gm-es.on{color:var(--gold);animation:gm-star .55s calc(var(--i) * .28s + .2s) both}
.gm-es.on .ico{filter:drop-shadow(0 2px 0 rgba(0,0,0,.14))}
@keyframes gm-star{0%{transform:scale(0) rotate(-90deg);opacity:0}70%{transform:scale(1.35) rotate(10deg);opacity:1}100%{transform:none}}
.gm-end-l{margin:4px 0 12px;font:400 var(--fs-body)/1.4 var(--f-text);color:var(--label)}
.gm-end-c{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 4px}
.gm-rec{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 14px;border-radius:999px;background:var(--gold-soft,rgba(255,204,0,.2));color:var(--gold-ink);font:700 var(--fs-sub)/1 var(--f-text)}
.gm-plus{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 14px 0 8px;border-radius:999px;background:var(--fill);color:var(--label);font:800 var(--fs-head)/1 var(--f-round);font-variant-numeric:tabular-nums}
.gm-plus .coin-ico{width:24px;height:24px;flex:none}
.gm-end-n{margin:4px 0 0;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.gm-wt{margin:16px 0 8px;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
/* las palabras del juego: rejilla de 2 columnas, cada palabra a lo ancho de su columna y alineada a la izquierda */
.gm-wl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%;max-width:440px;margin:0 auto}
.gm-wc{display:flex;width:100%;min-width:0;align-items:center;gap:8px;min-height:52px;border:0;background:var(--fill);color:var(--label);border-radius:14px;padding:4px 12px 4px 4px;text-align:left;font:inherit;cursor:pointer}
.gm-wc>span:not(.gm-wn){flex:1;min-width:0;overflow-wrap:anywhere}
@media (hover:hover){.gm-wc:hover{box-shadow:inset 0 0 0 2px var(--brand-tint)}}
.gm-wc img,.gm-wc .gm-wn{width:40px;height:40px;object-fit:contain;background:var(--gm-tile);border-radius:10px;padding:3px;flex:none}
.gm-wc .gm-wn{display:grid;place-items:center;color:var(--brand-tint);background:var(--card)}
.gm-wc b{display:block;line-height:1.15}
.gm-wc small{display:block;color:var(--label2);font-size:.8rem}
.gm-wc>.ico{color:var(--label2);flex:none}
.gm-wc.gm-miss{box-shadow:inset 0 0 0 2px var(--miss)}
.gm-end-b{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:24px;width:100%;max-width:440px}
.gm-end-b>*{flex:1}
@media (max-width:560px){
  .gm-name .t{display:none}
  .gm-pill{padding:0 12px}
  .gm-card{min-height:176px;padding:12px}
  .gm-ci{width:56px;height:56px}
  .gm-board{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  /* dos columnas en el móvil; si sobra una tarjeta, va a lo ancho (dibujo a la izquierda) */
  .gm-cards{grid-template-columns:repeat(2,minmax(0,1fr))}
  .gm-card:last-child:nth-child(odd){grid-column:1/-1;min-height:0;display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:16px;align-content:center;align-items:center}
  .gm-card:last-child:nth-child(odd) .gm-ci{grid-row:1/4;margin:0}
  .gm-card:last-child:nth-child(odd) .gm-cr{padding-top:4px}
  .gm-mc{aspect-ratio:1/1.08}
  .gm-catch{gap:8px;padding-left:12px}
  .gm-catch b{font-size:1.35rem}
  .gm-tile{width:50px;height:50px;font-size:1.5rem}
}
/* Memoria en el móvil (.gm-mfit): las 4 filas de 3 cartas llenan el alto que queda (--mrow, lo calcula fitMem());
   tumbado y bajito (.gm-mland): 2 filas de 6 a todo el ancho, sin bajar */
:root:is([data-gm-play=memoria],[data-gm-play=letras],[data-gm-play=lluvia]) main{padding-bottom:calc(var(--safe-b) + 12px)}
.gm-mfit .gm-board,.gm-mland .gm-board{grid-auto-rows:var(--mrow)}
.gm-mfit .gm-mc,.gm-mland .gm-mc{aspect-ratio:auto}
.gm-mfit .gm-tip,.gm-mland .gm-tip{display:none}
.gm-mland .gm-board{grid-template-columns:repeat(6,minmax(0,1fr));max-width:var(--mbw,none)}
/* Globos en pantallas bajas (.gm-cmp): la tarjeta de escuchar más compacta para que los globos crezcan.
   Móvil tumbado (.gm-land): la tarjeta de escuchar a la izquierda y los globos a la derecha, bajo la fila de arriba */
:root[data-gm-play=globos] main{padding-bottom:calc(var(--safe-b) + 12px)}
.gm-cmp .gm-listen{min-height:0;padding:8px;gap:8px;margin-bottom:8px}
.gm-cmp .gm-bigsay{width:56px;height:56px}
.gm-cmp .gm-ltxt{min-height:2.8em;font-size:.95rem}
.gm-cmp .gm-ltxt b{font-size:1.25rem}
/* tumbado: una columna estrecha para escuchar (altavoz arriba, tortuga y ojo debajo, la frase) y los globos, grandes */
.gm-land.gm-bal-g{display:grid;grid-template-columns:clamp(120px,17vw,200px) minmax(0,1fr);column-gap:12px;align-items:start}
.gm-land>.gm-top{grid-column:1/-1}
.gm-land>.gm-listen{grid-column:1;grid-row:2/span 2;align-self:stretch;display:grid;grid-template-columns:auto auto;justify-content:center;align-content:center;justify-items:center;
  margin:0;min-height:0;padding:12px 8px;gap:8px}
.gm-land .gm-bigsay,.gm-land .gm-ltxt{grid-column:1/-1}
.gm-land .gm-ltxt{min-height:0;font-size:.95rem;overflow-wrap:anywhere}
.gm-land .gm-ltxt b{font-size:1.2rem}
.gm-land>.gm-air{grid-column:2;grid-row:2}
.gm-land>.gm-dots{grid-column:2;grid-row:3}
/* móvil estrecho (320): la fila de arriba cabe entre la ✕ y las monedas (sin «?»: la explicación sale al empezar) */
@media (max-width:340px){
  :root[data-focus] .gm .gm-top{padding-right:80px}
  :root[data-focus] .gm-help{display:none}
  :root[data-focus] .gm-stats{margin-left:auto;gap:4px}
  :root[data-focus] .gm-pill{padding:0 8px;gap:3px}}
/* versión compacta cuando el juego no cabe en la pantalla (móviles bajitos) */
.gm-short .gm-top{margin-bottom:8px}
.gm-short .gm-tip{display:none}
.gm-short .gm-board{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.gm-short .gm-mc{aspect-ratio:4/5}
.gm-short .gm-mc-back span{font-size:1.6rem}
.gm-short .gm-listen{min-height:0;padding:8px 10px;gap:8px;margin-bottom:8px}
.gm-short .gm-bigsay{width:60px;height:60px}
.gm-short .gm-ltxt{min-height:0;font-size:.95rem}
.gm-short .gm-dots{margin-top:8px}
.gm-short .gm-lt{display:grid;grid-template-columns:auto 1fr;column-gap:12px;align-items:center;text-align:left;padding:12px 12px 14px}
.gm-short .gm-lt-pic{width:100px;height:100px;grid-row:span 2;border-radius:20px}
.gm-short .gm-lt-es{justify-content:flex-start;margin:0;font-size:1.3rem;align-self:end}
.gm-short .gm-lt-n{align-self:start}
.gm-short .gm-slots,.gm-short .gm-tiles,.gm-short .gm-lt-acts,.gm-short #gm-fb{grid-column:1/-1}
.gm-short .gm-slots{width:100%;margin:12px 0 10px}
.gm-short .gm-tiles{width:100%}
.gm-short .gm-lt-acts{margin-top:10px}
/* hoja de pausa (M.openSheet): sólida y sin desenfoque, como todo el vidrio de los juegos */
dialog#gm-pause{max-width:420px}
dialog#gm-pause.m-sheet.glass{background:var(--card,#fff);-webkit-backdrop-filter:none;backdrop-filter:none}
.gm-pz{display:flex;flex-direction:column;align-items:center;text-align:center;padding:4px 4px 8px}
.gm-pz-ic{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;margin:4px 0 12px;color:var(--brand-tint,#1E6EF4);background:var(--fill,rgba(120,120,128,.16))}
.gm-pz-t{margin:0 0 20px;font:700 var(--fs-t2,1.5rem)/1.2 var(--f-round,system-ui);color:var(--label,#000)}
.gm-pz-b{display:flex;gap:12px;width:100%;max-width:440px}
.gm-pz-b>*{flex:1}
@media (prefers-reduced-motion: reduce){
  .gm *,.gm-intro *{animation-duration:.01ms!important;animation-iteration-count:1!important;animation-delay:0s!important}
  .gm-mc-in{transition:none}
}`;
function css(){
  if(document.getElementById("css-games")) return;
  const s = document.createElement("style"); s.id = "css-games"; s.textContent = CSS; document.head.appendChild(s);
}

/* ---------- piezas comunes ---------- */
function topHtml(g, stats){
  const G0 = GAMES[g];
  return `<div class="gm-top"><a class="gm-x" href="#/juegos" aria-label="Salir del juego">${IC("x", "bold", 20)}</a>
    <div class="gm-name"><img src="${esc(G0.img)}" alt="" width="32" height="32" draggable="false"><span class="t">${esc(G0.t)}</span></div>
    <button type="button" class="glass lite gm-help" data-gm-how data-key="?" aria-label="Cómo se juega">${IC("question", "bold", 22)}</button>
    <div class="gm-stats">${stats}</div></div>`;
}
function bump(el){ if(!el) return; el.classList.remove("gm-bump"); void el.offsetWidth; el.classList.add("gm-bump"); }
/* vibración cortita (G.haptic de js/gestures.js: respeta el Sonido; en el iPhone tiene que ir dentro del toque).
   Solo al acertar ("success") o al elegir ("selection"); al fallar, nada. */
const haptic = k => { try{ if(window.G && typeof window.G.haptic === "function") window.G.haptic(k); }catch(e){} };
/* ¿se juega con el teclado? (la última entrada fue una tecla). Solo entonces se enfoca solo el botón principal: al
   cargar o al tocar, sin anillo de foco */
let KBD = false;
addEventListener("keydown", e => { if(e.key !== "Shift") KBD = true; }, {capture: true, passive: true});
addEventListener("pointerdown", () => { KBD = false; }, {capture: true, passive: true});
/* pantallas bajitas (móvil pequeño): si el juego no cabe, versión compacta .gm-short */
function autoFit(run, el, after, pad){
  const chk = keep => {
    if(!live(run)) return;
    if(!keep) run.root.classList.remove("gm-short");
    /* pad: cuenta el margen de abajo de la página (si no, cabe con 8 px de holgura) */
    const m = pad && el.closest("main"), pb = m ? parseFloat(getComputedStyle(m).paddingBottom) || 0 : 8;
    if(el.isConnected && el.getBoundingClientRect().bottom + scrollY + pb > innerHeight + .5) run.root.classList.add("gm-short");
    if(after) after();
  };
  const onR = () => chk(false);
  addEventListener("resize", onR); run.clean.push(() => removeEventListener("resize", onR));
  chk(false);
  /* otra vez antes de pintar: el modo foco (sin barras de arriba) entra justo después de montar la partida */
  requestAnimationFrame(() => chk(false));
  return chk;
}
/* que cada palabra quepa en su carta sin partirse por la mitad */
function fitWords(root){
  root.querySelectorAll(".gm-mw").forEach(el => {
    const face = el.parentNode, maxW = face.clientWidth - 12, maxH = face.clientHeight - 12;
    if(maxW <= 0) return;
    if(!el.dataset.fs) el.dataset.fs = parseFloat(getComputedStyle(el).fontSize);
    let f = +el.dataset.fs, k = 0;
    /* sin transición (con «Reducir movimiento» todo lleva una corta): se mide el tamaño de letra de verdad */
    el.style.transition = "none";
    el.style.overflowWrap = "normal"; el.style.hyphens = "manual"; el.style.fontSize = f + "px";
    while(k++ < 24 && f > 12 && (el.scrollWidth > maxW || el.offsetWidth > maxW || el.offsetHeight > maxH)){ f -= 1; el.style.fontSize = f + "px"; }
    if(el.scrollWidth > maxW || el.offsetWidth > maxW){ el.style.hyphens = "auto"; el.style.overflowWrap = "anywhere"; }
  });
}
/* la explicación del juego. run.intro: "full" = la primera vez (cómo se juega + «¡A jugar!»); "ready" = tarjeta corta
   (se entró sin tocar nada: al recargar o con Atrás; «Cómo se juega» la despliega); "" = empieza directo */
function intro(run, g, go){
  const mode = run.intro;
  if(!mode){ go(); return; }
  const G0 = GAMES[g], full = mode === "full";
  run.root.insertAdjacentHTML("beforeend", `<div class="gm-intro" role="dialog" aria-modal="true" aria-labelledby="gm-in-t">
    <div class="gm-intro-c"><img class="gm-intro-i" src="${esc(G0.img)}" alt="" width="96" height="96" draggable="false">
    <h2 class="gm-intro-t" id="gm-in-t">${esc(G0.t)}</h2>
    <p class="gm-intro-p" id="gm-in-p"${full ? "" : " hidden"}>${esc(G0.how)}</p>
    <div class="gm-intro-tp">${esc(wordsLabel(g))} · ${esc(Nm())}</div>
    <button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block gm-go" data-key="enter">${IC("play", "fill", 22)}¡A jugar!</button>
    ${full ? `<a class="gm-intro-back" href="#/juegos">Elegir otro juego</a>`
      : `<button type="button" class="gm-intro-how" id="gm-in-how">${IC("question", "bold", 18)}Cómo se juega</button>`}</div></div>`);
  const ov = run.root.querySelector(".gm-intro"), b = ov.querySelector(".gm-go"), hw = ov.querySelector("#gm-in-how");
  let went = false;
  const goNow = () => {
    if(went || !live(run)) return; went = true;
    if(full) markSeen(g);
    ov.remove();
    unlockVoice();
    if(run.keys && document.onkeydown === run.keys){ document.onkeydown = null; run.keys = null; }
    go();
  };
  b.onclick = goNow;
  if(hw) hw.onclick = () => how(hw);
  keys(run, e => {
    if(e.key === "Escape") return;   /* Esc es la pausa (el oyente de arriba), nunca salir de golpe */
    if((e.key === "Enter" || e.key === " ") && !(e.target.closest && e.target.closest("a,#gm-in-how"))){ e.preventDefault(); goNow(); }
  });
  if(KBD) try{ b.focus({preventScroll: true}); }catch(e){}
}

/* ---------- menú ---------- */
const recLine = (g, b) => b && typeof b === "object" && GAMES[g].rec ? GAMES[g].rec(b) : "Sin récord";
/* una frase con su punto final, salvo si ya acaba en «?», «!», «.» o «…» */
const sent = t => /[.?!…]$/.test(t) ? t : t + ".";
/* tarjeta que solo lleva a otra pantalla (register con href y sin start) */
const isLink = id => !!GAMES[id] && typeof GAMES[id].start !== "function" && typeof GAMES[id].href === "string";
function linkHtml(id){
  const G0 = GAMES[id]; let line = "";
  try{ line = typeof G0.line === "function" ? String(G0.line() || "") : ""; }catch(e){ console.error(e); }
  return `<a class="gm-card card gm-link" href="${esc(G0.href)}" data-g="${esc(id)}" draggable="false"
    aria-label="${esc(sent(G0.t))}${G0.sub ? " " + esc(sent(G0.sub)) : ""}${line ? " " + esc(sent(line)) : ""}">
    <img class="gm-ci" src="${esc(G0.img)}" alt="" width="64" height="64" draggable="false">
    <b class="gm-ct">${esc(G0.t)}</b><small class="gm-cs">${esc(G0.sub)}</small>
    <span class="gm-cr" aria-hidden="true"><span class="gm-rt">${esc(line)}</span></span></a>`;
}
function cardHtml(id, b){
  if(isLink(id)) return linkHtml(id);
  const G0 = GAMES[id], st = b && typeof b === "object" ? Math.max(0, Math.min(3, num(b.stars))) : 0, rec = recLine(id, b);
  const fresh = !!G0.fresh && !b;   /* un juego nuevo lleva «Nuevo» hasta su primera partida */
  return `<a class="gm-card card" href="#/juegos/${esc(id)}" data-g="${esc(id)}" draggable="false"
    aria-label="${fresh ? "Nuevo. " : ""}${esc(sent(G0.t))} ${G0.sub ? esc(sent(G0.sub)) + " " : ""}${b ? `Récord: ${esc(rec)}, ${st} de 3 estrellas` : "Sin récord todavía"}">
    ${fresh ? `<span class="gm-new" aria-hidden="true">Nuevo</span>` : ""}
    <img class="gm-ci" src="${esc(G0.img)}" alt="" width="64" height="64" draggable="false">
    <b class="gm-ct">${esc(G0.t)}</b><small class="gm-cs">${esc(G0.sub)}</small>
    <span class="gm-cr" aria-hidden="true">${starsHtml(st, 18)}<span class="gm-rt">${esc(rec)}</span></span></a>`;
}
const pillHtml = tp => `<span>Tema:</span> <b>${esc(topicName(tp))}</b>${IC("caret-down", "bold", 16)}`;
function paintPill(){ const p = document.getElementById("gm-tpill"); if(p) p.innerHTML = pillHtml(topicId()); }
async function menu(){
  const my = NAV, app = $("#app"), best = obj("games:best");
  clearGest();
  app.innerHTML = `<div class="gm gm-menu" id="gm-menu">
    <div class="gm-bar"><button type="button" class="glass-btn gm-tpill" id="gm-tpill" aria-haspopup="dialog" aria-controls="gm-tp-s">${pillHtml(topicId())}</button></div>
    <div class="gm-cards" id="gm-cards">${Object.keys(GAMES).map(id => cardHtml(id, best[id])).join("")}</div>
  </div>`;
  $("#gm-tpill").onclick = e => openTopics(e.currentTarget);
  const cards = [...app.querySelectorAll(".gm-card")];
  /* tocar = jugar (el enlace); dentro del toque se desbloquea la voz para que la partida pueda hablar (iOS) */
  $("#gm-cards").addEventListener("click", e => { if(e.target.closest(".gm-card")) unlockVoice(); });
  /* mantener pulsado = vistazo (cómo se juega y el récord) */
  if(window.G && typeof window.G.hold === "function") cards.filter(c => !isLink(c.dataset.g)).forEach(c => GEST.push(window.G.hold(c, {onHold: () => { haptic("selection"); peek(c.dataset.g, c); }})));
  /* la pista del vistazo (una por pantalla y sesión, 3 veces como mucho; nunca en partida). Sale debajo de la primera
     tarjeta, sobre la parte de arriba (el dibujo) de la fila siguiente: no tapa ni la pastilla del tema ni ningún récord */
  setTimeout(() => {
    const c = cards[0];
    if(!here(my) || !c || !c.isConnected || !window.G || typeof window.G.hint !== "function") return;
    try{ window.G.hint(c, {id: "gm-peek", gesture: "hold", text: "Mantén para ver", side: "bottom"}); }catch(e){}
  }, 900);
  /* «Mis palabras» elegido sin palabras suficientes (otro idioma, o un repaso pequeño): vuelve a Animales */
  if(topicId() === MIS){
    const n = await countMis();
    if(!here(my)) return;
    if(n < MIS_MIN){ store.set("games:topic", "animales"); paintPill(); }
  }
}
/* la hoja de temas: «Mis palabras» primero y luego los temas; tocar uno lo elige (✓), se guarda y la hoja se cierra */
function openTopics(from){
  css();
  const d = mkSheet("gm-tp-s", "gm-tp-t");
  if(!d.dataset.wired){
    d.dataset.wired = "1";
    d.addEventListener("click", e => {
      if(e.target.closest("[data-close]")){ sheetClose(d); return; }
      const r = e.target.closest("[data-tp]"); if(!r) return;
      if(r.getAttribute("aria-disabled") === "true"){ toast(`Aprende ${MIS_MIN} palabras con dibujo y podrás jugar con ellas`, IC("star", "fill", 20)); return; }
      chooseTopic(r.dataset.tp, d);
    });
  }
  const tp = topicId();
  const row = (t, extra = "", off = false) => {
    const on = t[0] === tp;
    return `<button type="button" class="st-r gm-tp-r" role="radio" aria-checked="${on}" data-tp="${esc(t[0])}"${off ? ' aria-disabled="true"' : ""}>
      <img class="gm-tp-i" src="img/om_${esc(t[1])}.png" alt="" width="30" height="30" loading="lazy" draggable="false">
      <span class="st-l"><span class="gm-tp-n">${esc(t[2])}</span>${extra}</span>${on ? IC("check", "bold", 20, "gm-tp-ok") : ""}</button>`;
  };
  const misRow = n => n === null ? row(MIS_INFO, `<small>Las palabras que estás aprendiendo</small>`)
    : n >= MIS_MIN ? row(MIS_INFO, `<small>${n} palabras que estás aprendiendo</small>`)
    : row(MIS_INFO, `<small>Aprende ${MIS_MIN} palabras con dibujo para jugar con ellas</small>`, true);
  d.innerHTML = `<div class="m-head"><h2 id="gm-tp-t">Tema</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Listo</button></div>
    <p class="gm-tp-sub">Los juegos usan sus dibujos y sus palabras en ${esc(nm())}.</p>
    <div role="radiogroup" aria-labelledby="gm-tp-t">
      <section class="st-sec"><div class="st-g" id="gm-tp-mis">${misRow(MIS_LANG === lang ? MIS_N : null)}</div></section>
      <section class="st-sec" aria-labelledby="gm-tp-h1"><h3 class="st-h" id="gm-tp-h1">Temas</h3><div class="st-g">${TOPICS.filter(t => !W3000(t)).sort(START).map(t => row(t)).join("")}</div></section>
      <section class="st-sec" aria-labelledby="gm-tp-h2"><h3 class="st-h" id="gm-tp-h2">Las 3000</h3><div class="st-g">${TOPICS.filter(W3000).sort(START).map(t => row(t)).join("")}</div></section>
    </div>`;
  sheetOpen(d, from);
  if(MIS_LANG !== lang || MIS_N === null) countMis().then(n => { const box = d.querySelector("#gm-tp-mis"); if(box && d.open) box.innerHTML = misRow(n); });
  return d;
}
function chooseTopic(id, d){
  if(!(id === MIS || TOPICS.some(t => t[0] === id))) return false;
  if(id !== topicId()) store.set("games:topic", id);
  haptic("selection");
  d.querySelectorAll("[data-tp]").forEach(r => {
    const on = r.dataset.tp === id;
    r.setAttribute("aria-checked", on);
    const ok = r.querySelector(".gm-tp-ok");
    if(on && !ok) r.insertAdjacentHTML("beforeend", IC("check", "bold", 20, "gm-tp-ok"));
    else if(!on && ok) ok.remove();
  });
  paintPill();
  setTimeout(() => sheetClose(d), RM() ? 120 : 260);
  return true;
}
/* vistazo (mantener pulsada una tarjeta): cómo se juega, el récord y con qué palabras; «Jugar» abre la partida */
function peek(id, from){
  const G0 = GAMES[id]; if(!G0 || isLink(id)) return false;
  css();
  const b = obj("games:best")[id], st = b && typeof b === "object" ? Math.max(0, Math.min(3, num(b.stars))) : 0;
  const d = mkSheet("gm-peek", "gm-pk-t");
  if(!d.dataset.wired){
    d.dataset.wired = "1";
    d.addEventListener("click", e => {
      if(e.target.closest("[data-close]")){ sheetClose(d); return; }
      const go = e.target.closest("[data-go]");
      if(go){ e.preventDefault(); unlockVoice(); const to = go.getAttribute("href"); sheetClose(d, true); location.hash = to; }
    });
  }
  d.innerHTML = `<div class="m-head"><h2 id="gm-pk-t">${esc(G0.t)}</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Listo</button></div>
    <div class="gm-pk"><img class="gm-pk-i" src="${esc(G0.img)}" alt="" width="72" height="72" draggable="false"><p class="gm-pk-p">${esc(G0.how)}</p></div>
    <div class="st-g gm-pk-g">
      <div class="gm-pk-r"><span>Récord</span>${b ? `<span class="gm-st-l" role="img" aria-label="${st} de 3 estrellas">${starsHtml(st, 20)}</span><b>${esc(recLine(id, b))}</b>` : "<b>Aún sin récord</b>"}</div>
      <div class="gm-pk-r">${G0.words ? `<b>${esc(G0.words)}</b>` : `<span>Palabras</span><b>${esc(topicName(topicId()))}</b>`}</div>
      ${b && num(b.plays) ? `<div class="gm-pk-r"><span>Partidas</span><b>${num(b.plays)}</b></div>` : ""}
    </div>
    <a class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block" href="#/juegos/${esc(id)}" data-go>${IC("play", "fill", 22)}Jugar</a>`;
  sheetOpen(d, from);
  return true;
}

/* ---------- arranque de un juego ---------- */
async function play(g, withIntro){
  const my = NAV, app = $("#app"), G0 = GAMES[g];
  const mode = !withIntro ? "" : !introSeen(g) ? "full" : tappedNow(g) ? "" : "ready";
  app.innerHTML = `<div class="gm"><p class="gm-wait">Preparando el juego…</p></div>`;
  if(typeof G0.start === "function"){   /* un juego de otro módulo (vocabGames.register) */
    try{ await G0.start(app, API, mode); }
    catch(e){ console.error(e); if(here(my, g)) app.innerHTML = emptyHtml(); }
    return;
  }
  let tp = hashTopic() || topicId(), P = [];
  if(tp === MIS && (await countMis()) < MIS_MIN) tp = "animales";
  if(!here(my, g)) return;
  try{ P = await pool(tp); }catch(e){ P = []; }
  if(!here(my, g)) return;
  if(usable(g, P) < G0.need && tp !== "animales"){
    try{ P = await pool("animales"); }catch(e){ P = []; }
    if(!here(my, g)) return;
    toast(`${topicName(tp)} tiene pocas palabras para este juego. ¡Jugamos con Animales!`);
    tp = "animales";
  }
  if(usable(g, P) < G0.need){ app.innerHTML = emptyHtml(); return; }
  CUR_TP = tp;
  ({memoria, lluvia, globos, letras})[g](app, P, mode);
}
const emptyHtml = () => `<div class="gm"><div class="gm-empty"><p>No hay palabras para este juego todavía.</p>
  <a class="glass-btn" href="#/juegos">${IC("caret-left", "bold", 18)}Juegos</a></div></div>`;
function mount(app, html, mode){
  app.innerHTML = html;
  const run = begin(app.querySelector(".gm"));
  run.intro = typeof mode === "string" ? mode : mode ? "full" : "";
  return run;
}

/* ---------- resultado ---------- */
function finish(run, g, o){
  if(!live(run) || run.finished) return;
  run.finished = true;
  const B = obj("games:best"), prev = B[g] && typeof B[g] === "object" ? B[g] : null;
  const better = g === "memoria" ? (!prev || !(prev.tries > 0) || o.tries < prev.tries) : (!prev || !Number.isFinite(prev.score) || o.score > prev.score);
  B[g] = {score: better ? o.score : prev.score, stars: Math.max(prev ? +prev.stars || 0 : 0, o.stars), plays: (prev ? +prev.plays || 0 : 0) + 1};
  if(g === "memoria") B[g].tries = better ? o.tries : prev.tries;
  store.set("games:best", B);
  /* después de 8 partidas en un día, cada partida da lo mínimo */
  const day = dayKey(new Date()), D = obj("games:day");
  if(D.k !== day || !Number.isFinite(D.n)){ D.k = day; D.n = 0; }
  D.n++; store.set("games:day", D);
  const coins = D.n > 8 ? 5 : [5, 5, 10, 15][o.stars];
  try{ logAct(1); }catch(e){}
  markSeen(g);
  const title = o.stars === 3 ? "¡Increíble!" : o.stars === 2 ? "¡Muy bien!" : "¡Bien hecho!";
  const words = (o.words || []).slice(0, 10), code = LANGS[lang].code;
  run.root.innerHTML = `<div class="gm-end" id="gm-end">
    <div class="gm-end-hero">${heroHtml(84)}</div>
    <h1 class="gm-end-t">${title}</h1>
    <div class="gm-end-st" role="img" aria-label="${o.stars} de 3 estrellas">${[0, 1, 2].map(i => `<span class="gm-es${i < o.stars ? " on" : ""}" style="--i:${i}">${IC("star", "fill", 44)}</span>`).join("")}</div>
    <p class="gm-end-l">${esc(o.line)}</p>
    <div class="gm-end-c">${better && prev ? `<span class="gm-rec">${IC("trophy", "fill", 18)}¡Nuevo récord!</span>` : !prev ? `<span class="gm-rec">${IC("trophy", "fill", 18)}¡Tu primer récord!</span>` : ""}
      <span class="gm-plus" id="gm-plus" aria-label="${coins} monedas">${COIN}+${coins}</span></div>
    ${D.n > 8 ? `<p class="gm-end-n">¡Hoy ya jugaste mucho! Ahora cada partida da 5.</p>` : ""}
    ${words.length ? `<p class="gm-wt">Palabras del juego · toca para oírlas</p>
    <div class="gm-wl">${words.map(w => `<button type="button" class="gm-wc${w.miss ? " gm-miss" : ""}" data-say="${esc(w.word)}" aria-label="Escuchar ${esc(w.word)}">${w.img ? imgTag(w) : `<span class="gm-wn" aria-hidden="true">${IC("speaker-high", "fill", 20)}</span>`}<span><b lang="${esc(code)}">${esc(w.word)}</b><small>${esc(w.es)}</small></span>${IC("speaker-high", "bold", 18)}</button>`).join("")}</div>` : ""}
    <div class="gm-end-b"><a class="glass-btn glass-btn--lg" href="#/juegos" id="gm-menu-b">Juegos</a>
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="gm-again" data-key="enter">${IC("arrow-counter-clockwise", "bold", 20)}Otra vez</button></div></div>`;
  window.scrollTo(0, 0);
  /* el resultado es una fase nueva: limpia lo del juego y deja solo sus propios temporizadores */
  run.timers.forEach(clearTimeout); run.timers = [];
  if(run.raf){ cancelAnimationFrame(run.raf); run.raf = 0; }
  run.clean.forEach(f => { try{ f(); }catch(e){} }); run.clean = [];
  run.held = []; run.paused = false;
  document.querySelectorAll(".gm-ghost").forEach(x => x.remove());
  howClose();
  /* fuera del modo foco: vuelven las barras y las monedas vuelan desde «+N» hasta la pastilla de arriba */
  playMark(null);
  try{ if(typeof updFocus === "function") updFocus(); }catch(e){}
  award(coins, "", false, run.root.querySelector("#gm-plus"));
  bus.emit("game-done", Object.assign({game: g, score: o.score, stars: o.stars}, g === "memoria" ? {tries: o.tries} : {},
    GAMES[g] && !GAMES[g].start && !GAMES[g].words && CUR_TP ? {tp: CUR_TP} : {}));   /* tp: el tema de la partida */
  snd("fanfare");
  /* las estrellas salen de una en una, cada una con una nota más aguda */
  for(let i = 0; i < o.stars; i++) later(run, () => note(i + 2), RM() ? 120 : 200 + (i + 1) * 280);
  if(o.stars === 3) later(run, () => sparks(run.root.querySelector(".gm-end-st"), 14), 1100);
  /* dos toques rápidos no se saltan el resultado: 0,6 s sin hacer caso a los botones */
  const t0 = performance.now(), INERT = RM() ? 300 : 600;
  const inert = () => performance.now() - t0 < INERT;
  run.root.addEventListener("click", e => { if(inert() && e.target.closest("a,button")){ e.preventDefault(); e.stopPropagation(); } }, true);
  const again = () => { if(inert()) return; play(g, false); };
  run.root.querySelector("#gm-again").onclick = again;
  keys(run, e => { if(e.key === "Enter" && !(e.target.closest && e.target.closest("a,button:not(#gm-again)"))){ e.preventDefault(); again(); } });
}

/* =====================================================================
   1. MEMORIA — 6 parejas dibujo ↔ palabra
   ===================================================================== */
function memoria(app, P, mode){
  const items = shuffle(P).slice(0, 6), N = items.length;
  const cards = shuffle(items.flatMap((it, i) => [{i, kind: "img", it}, {i, kind: "word", it}]));
  preload(items);
  const run = mount(app, `<div class="gm gm-mem">
    ${topHtml("memoria", `<span class="gm-pill" title="Intentos">${IC("arrow-counter-clockwise", "bold", 18)}<b id="gm-tries">0</b></span><span class="gm-pill" title="Parejas">${IC("check-circle", "fill", 18)}<span><b id="gm-pairs">0</b>/${N}</span></span>`)}
    <div class="gm-board" id="gm-board">${cards.map((c, k) => `
      <button class="gm-mc" data-k="${k}" data-press="sink" aria-label="Carta tapada">
        <span class="gm-mc-in"><span class="gm-mc-f gm-mc-back" aria-hidden="true"><span>?</span></span>
        <span class="gm-mc-f gm-mc-face k-${c.kind}">${c.kind === "img" ? imgTag(c.it) : `<span class="gm-mw" lang="${LANGS[lang].code}" style="font-size:${fs(c.it.word)}">${esc(c.it.word)}</span>`}</span></span></button>`).join("")}</div>
    <p class="gm-tip">Busca cada dibujo con su palabra en ${esc(nm())}.</p></div>`, mode);
  let tries = 0, pairs = 0, open = [], lock = false, started = false;
  const misses = new Set();
  const board = run.root.querySelector("#gm-board");
  const upd = () => { const t = $("#gm-tries"), p = $("#gm-pairs"); if(t) t.textContent = tries; if(p) p.textContent = pairs; };
  function flip(b){
    if(!started || lock || !live(run) || b.classList.contains("up")) return;
    const c = cards[+b.dataset.k];
    b.classList.add("up"); b.setAttribute("aria-label", c.kind === "img" ? `Dibujo: ${c.it.es}` : c.it.word);
    snd("tap"); open.push(b);
    if(open.length === 1){ if(c.kind === "word") speak(c.it.word); return; }
    tries++; upd(); bump($("#gm-tries") && $("#gm-tries").parentNode);
    const a = open[0], ca = cards[+a.dataset.k]; open = [];
    if(ca.i === c.i){
      pairs++; upd(); answer(true, c.it); haptic("success");
      speak(c.it.word);
      later(run, () => { a.classList.add("ok"); b.classList.add("ok"); snd("ok"); sparks(b, 10); a.disabled = b.disabled = true; bump($("#gm-pairs") && $("#gm-pairs").parentNode); }, 380);
      if(pairs === N) later(run, () => {
        const stars = tries <= N + 3 ? 3 : tries <= N + 7 ? 2 : 1;
        finish(run, "memoria", {score: Math.max(10, 100 - (tries - N) * 6), tries, stars,
          line: `¡Encontraste las ${N} parejas en ${tries} intentos!`, words: items.map(it => Object.assign({miss: misses.has(it.k)}, it))});
      }, 1500);
    } else {
      /* fallo: las dos cartas se ponen grises con ✗ un momento y se vuelven a tapar (sin temblor ni sonido triste) */
      lock = true; misses.add(ca.it.k); misses.add(c.it.k); answer(false, c.it);
      if(c.kind === "word") speak(c.it.word);
      later(run, () => { a.classList.add("no"); b.classList.add("no"); }, 520);
      later(run, () => {
        a.classList.remove("up", "no"); b.classList.remove("up", "no");
        a.setAttribute("aria-label", "Carta tapada"); b.setAttribute("aria-label", "Carta tapada");
        snd("whoosh"); lock = false;
      }, 1250);
    }
  }
  board.onclick = e => { const b = e.target.closest(".gm-mc"); if(b) flip(b); };
  /* en el móvil las cartas crecen hasta llenar el alto (sin scroll): de pie, 4 filas de 3; tumbado, 2 filas de 6.
     En la tableta y el ordenador, como siempre (4 columnas; .gm-short si no cabe) */
  const fitMem = () => {
    if(!live(run) || !board.isConnected) return;
    const root = run.root, land = innerWidth > innerHeight && innerHeight < 540 && innerWidth >= 560;
    const phone = !land && innerWidth <= 560 && innerHeight > innerWidth;
    root.classList.toggle("gm-mland", land); root.classList.toggle("gm-mfit", phone);
    board.style.removeProperty("--mbw");
    if(!land && !phone){ board.style.removeProperty("--mrow"); return false; }
    root.classList.remove("gm-short");
    const cs = getComputedStyle(board), gap = parseFloat(cs.rowGap) || 8, cols = land ? 6 : 3, rows = Math.ceil(cards.length / cols);
    const br = board.getBoundingClientRect(), main = board.closest("main");
    const below = main ? Math.max(0, main.getBoundingClientRect().bottom - br.bottom) : 24;
    const H = innerHeight - (br.top + scrollY) - below;
    const colW = (board.clientWidth - gap * (cols - 1)) / cols;
    let rowH = Math.floor((H - gap * (rows - 1)) / rows);
    rowH = Math.max(Math.round(colW * (land ? .7 : .8)), Math.min(rowH, Math.round(colW * 1.6)));
    /* tumbado: si las filas salen más bajas que anchas las cartas, el tablero se estrecha (cartas cuadradas) */
    if(land && rowH < colW) board.style.setProperty("--mbw", Math.round(rowH * cols + gap * (cols - 1)) + "px");
    board.style.setProperty("--mrow", rowH + "px");
    return true;
  };
  autoFit(run, board, () => { fitMem(); fitWords(board); });
  let memT = 0;
  const refitMem = () => { clearTimeout(memT); memT = setTimeout(() => { if(fitMem()) fitWords(board); board.style.visibility = ""; }, 260); };
  addEventListener("resize", refitMem); run.clean.push(() => { removeEventListener("resize", refitMem); clearTimeout(memT); });
  /* con «Reducir movimiento» el modo foco entra con una transición corta: el tablero sale ya con su tamaño final */
  if(RM()) board.style.visibility = "hidden";
  refitMem();
  /* y cuando llega la letra redonda (las palabras se miden con ella) */
  try{ document.fonts.ready.then(() => { if(live(run)){ fitMem(); fitWords(board); } }); }catch(e){}
  intro(run, "memoria", () => { started = true; });
}

/* =====================================================================
   2. LLUVIA DE PALABRAS — atrapa las burbujas de la palabra pedida
   ===================================================================== */
function lluvia(app, P, mode){
  const DUR = 60, LIVES = 3;
  preload(P.slice(0, 40));
  const run = mount(app, `<div class="gm gm-rain">
    ${topHtml("lluvia", `<span class="gm-pill gm-lives" id="gm-lives" role="img" aria-label="${LIVES} vidas">${`<i>${IC("heart", "fill", 18)}${IC("heart", "bold", 18)}</i>`.repeat(LIVES)}</span><span class="gm-pill" title="Atrapadas">${IC("star", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`)}
    <div class="gm-catch"><span class="gm-catch-l">Atrapa:</span><b id="gm-tg">…</b><button type="button" class="gm-say" id="gm-say" aria-label="Escuchar la palabra">${IC("speaker-high", "fill", 26)}</button></div>
    <div class="gm-tbar" id="gm-tbar"><i id="gm-tb"></i></div>
    <div class="gm-sky" id="gm-sky"><span class="gm-cl c1">☁️</span><span class="gm-cl c2">☁️</span><span class="gm-cl c3">☁️</span></div>
    <p class="gm-tip">Toca la burbuja que dice lo mismo en ${esc(nm())}.</p></div>`, mode);
  const sky = run.root.querySelector("#gm-sky"), tb = run.root.querySelector("#gm-tb");
  let W = sky.clientWidth, H = sky.clientHeight;
  /* el cielo cabe entero en la pantalla (en móviles bajitos no se sale por abajo) */
  const tip = run.root.querySelector(".gm-tip");
  const fit = () => {
    const top = sky.getBoundingClientRect().top + scrollY;
    const ts = tip ? getComputedStyle(tip) : null;
    const main = sky.closest("main"), pb = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 14;
    const below = (tip && ts.display !== "none" ? tip.offsetHeight + (parseFloat(ts.marginTop) || 0) : 0) + pb;
    const avail = Math.floor(innerHeight - top - below);
    sky.style.height = Math.max(280, Math.min(540, avail)) + "px";
  };
  const onResize = () => { fit(); W = sky.clientWidth; H = sky.clientHeight; };
  addEventListener("resize", onResize); run.clean.push(() => removeEventListener("resize", onResize));
  onResize();
  /* otra vez cuando el modo foco (sin barras de arriba) ya está puesto: el cielo llega hasta abajo */
  requestAnimationFrame(onResize); later(run, onResize, 280);
  /* la burbuja llena su carril (al menos 3 carriles); la palabra va debajo, al ancho de la burbuja (nunca menos de
     108 px, como antes) */
  const LANES = () => Math.max(3, Math.floor(W / 130));
  const BS = () => Math.round(Math.max(80, Math.min(116, W / LANES() - 18)));
  const BW = () => Math.max(BS() + 8, 108);
  const sway = RM() ? 0 : 7;
  let score = 0, lives = LIVES, t = 0, target = null, bubbles = [], spawnIn = .3, lastT = -9, ended = false, running = false, last = 0, recent = [], streak = 0;
  const got = [], missed = new Set();

  function setTarget(){
    const prev = target;
    target = P.length > 1 ? pick(P.filter(x => x !== prev)) : P[0];
    for(const b of bubbles) if(prev && b.it === prev && !b.dead){ b.dead = true; b.el.classList.add("gone"); const el = b.el; later(run, () => el.remove(), 400); }
    const tg = $("#gm-tg"); if(tg){ tg.textContent = target.es; bump(tg); }
    later(run, () => speak(target.word), 260);
    lastT = t - 1.2;
  }
  function spawn(){
    const bs = BS(), bw = BW(), lanes = LANES(), laneW = W / lanes;
    let lane, k = 0; do{ lane = Math.floor(Math.random() * lanes); k++; }while(recent.includes(lane) && k < 12);
    recent.push(lane); if(recent.length > Math.min(2, lanes - 1)) recent.shift();
    const hasT = bubbles.some(b => !b.dead && b.it === target);
    const isT = (t - lastT > 3.2 && !hasT) || Math.random() < (hasT ? .18 : .5);
    const shown = new Set(bubbles.filter(b => !b.dead).map(b => b.it));
    let others = P.filter(x => x !== target && !shown.has(x));
    if(!others.length) others = P.filter(x => x !== target);
    const it = isT || !others.length ? target : pick(others);
    if(it === target) lastT = t;
    const el = document.createElement("button");
    el.className = "gm-bub"; el.style.setProperty("--bs", bs + "px"); el.style.width = bw + "px";
    el.setAttribute("aria-label", it.word);
    el.innerHTML = `<span class="gm-bub-i">${imgTag(it)}</span><span class="gm-bub-w" style="font-size:${[...it.word].length > 11 ? ".8rem" : ".95rem"}">${esc(it.word)}</span>`;
    const fall = Math.max(2.6, 7.4 - 4 * Math.min(1, t / DUR) - Math.min(1.2, score * .06));
    const b = {el, it, x: lane * laneW + (laneW - bw) / 2, y: -bs * 1.5, v: (H + bs * 1.6) / fall, ph: Math.random() * 6, dead: false};
    el.style.transform = `translate3d(${b.x}px,${b.y}px,0)`;
    el.addEventListener("pointerdown", e => { e.preventDefault(); try{ el.setPointerCapture(e.pointerId); }catch(err){} b.pid = e.pointerId; });
    el.addEventListener("pointerup", e => { if(b.pid !== e.pointerId) return; b.pid = null; hit(b); });
    el.addEventListener("pointercancel", () => { b.pid = null; });
    el.addEventListener("click", e => { if(e.detail === 0) hit(b); });
    sky.appendChild(el); bubbles.push(b);
  }
  function floatTxt(b, txt, bad){
    const f = document.createElement("div"); f.className = "gm-float" + (bad ? " bad" : "");
    f.textContent = txt; f.style.left = (b.x + BW() / 2) + "px"; f.style.top = Math.max(10, b.y) + "px";
    sky.appendChild(f); later(run, () => f.remove(), 1000);
  }
  function hit(b){
    if(b.dead || ended || !running || !live(run)) return;
    if(b.it === target){
      b.dead = true; b.el.classList.add("pop"); score++; streak++; haptic("success"); answer(true, b.it);
      got.push(b.it);
      snd("pop"); later(run, () => snd("ok"), 90);
      sparks(b.el.querySelector(".gm-bub-i"), 10);
      floatTxt(b, streak >= 3 ? `+1 · ¡racha ${streak}! 🔥` : `+1 ${b.it.word}`);
      const sc = $("#gm-sc"); if(sc){ sc.textContent = score; bump(sc.parentNode); }
      const el = b.el; later(run, () => el.remove(), 340);
      setTarget();
    } else {
      b.dead = true; b.el.classList.add("bad"); lives--; streak = 0; answer(false, target);
      missed.add(target.k);
      floatTxt(b, `✗ ${b.it.es}`, true);
      const L = $("#gm-lives");
      if(L){ const hs = L.querySelectorAll("i"); const h = hs[lives]; if(h){ h.classList.add("lost", "hurt"); } L.setAttribute("aria-label", lives === 1 ? "1 vida" : `${Math.max(0, lives)} vidas`); }
      const el = b.el; later(run, () => { el.classList.add("gone"); }, 380); later(run, () => el.remove(), 800);
      if(lives <= 0) end(false);
    }
  }
  function end(timeUp){
    if(ended) return; ended = true; running = false;
    if(run.raf){ cancelAnimationFrame(run.raf); run.raf = 0; }
    bubbles.forEach(b => { b.el.disabled = true; });
    sky.insertAdjacentHTML("beforeend", `<div class="gm-over"><span>${timeUp ? "⏰" : "☁️"}</span>${timeUp ? "¡Se acabó el tiempo!" : "¡Fin de la lluvia!"}</div>`);
    snd("whoosh");
    later(run, () => {
      const stars = score >= 12 ? 3 : score >= 6 ? 2 : 1;
      const uniq = []; const seen = new Set();
      for(const it of [...got, ...P.filter(x => missed.has(x.k))]) if(!seen.has(it.k)){ seen.add(it.k); uniq.push(Object.assign({miss: missed.has(it.k)}, it)); }
      finish(run, "lluvia", {score, stars, words: uniq,
        line: score ? `¡Atrapaste ${score} palabra${score === 1 ? "" : "s"}!` : "¡Casi! La próxima vez atraparás muchas."});
    }, 1500);
  }
  function frame(now){
    if(!live(run) || ended){ return; }
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    if(running && !document.hidden && !run.paused){
      t += dt;
      tb.style.transform = `scaleX(${Math.max(0, 1 - t / DUR)})`;
      if(DUR - t < 10) $("#gm-tbar") && $("#gm-tbar").classList.add("low");
      spawnIn -= dt;
      const alive = bubbles.filter(b => !b.dead).length;
      if(spawnIn <= 0 && alive < 7){ spawn(); spawnIn = Math.max(.62, 1.3 - .6 * (t / DUR)); }
      for(const b of bubbles){
        if(b.dead) continue;
        b.y += b.v * dt; b.ph += dt * 2.2;
        b.el.style.transform = `translate3d(${b.x + Math.sin(b.ph) * sway}px,${b.y}px,0)`;
        if(b.y > H + 8){
          b.dead = true; b.el.remove();
          if(b.it === target){ streak = 0; missed.add(target.k); floatTxt({x: b.x, y: H - 60}, "¡Se escapó! 💨", true); }
        }
      }
      bubbles = bubbles.filter(b => !b.dead || b.el.isConnected);
      if(t >= DUR){ end(true); return; }
    }
    run.raf = requestAnimationFrame(frame);
  }
  $("#gm-say").onclick = () => { if(target) speak(target.word); };
  const go = () => {
    onResize(); setTarget(); running = true; last = performance.now();
    run.raf = requestAnimationFrame(frame);
  };
  intro(run, "lluvia", go);
}

/* =====================================================================
   3. GLOBOS — escucha y explota el globo correcto (10 rondas)
   ===================================================================== */
function globos(app, P, mode){
  const R = 10;
  let order = [];
  while(order.length < R){ const s = shuffle(P); if(order.length && s[0] === order[order.length - 1]) s.push(s.shift()); order.push(...s); }
  order = order.slice(0, R);
  preload(P.slice(0, 40));
  const run = mount(app, `<div class="gm gm-bal-g">
    ${topHtml("globos", `<span class="gm-pill" title="Ronda">${IC("balloon", "fill", 18)}<span><b id="gm-rd">1</b>/${R}</span></span><span class="gm-pill" title="Aciertos">${IC("star", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`)}
    <div class="gm-listen" id="gm-listen">
      <button type="button" class="gm-bigsay" id="gm-play" aria-label="Escuchar la palabra">${IC("speaker-high", "fill", 34)}</button>
      <button type="button" class="glass-btn glass-btn--icon" id="gm-slow" aria-label="Escuchar despacio">${IC("turtle", "bold", 24)}</button>
      <button type="button" class="glass-btn glass-btn--icon" id="gm-peek" aria-label="Ver la palabra escrita">${IC("eye", "bold", 24)}</button>
      <div class="gm-ltxt" id="gm-ltxt">Escucha y toca el globo correcto</div>
    </div>
    <div class="gm-air" id="gm-air"></div>
    ${dotsHtml(R)}</div>`, mode);
  const air = run.root.querySelector("#gm-air");
  let r = 0, score = 0, first = true, busy = true, cur = null, opts = [];
  const res = [];
  const dots = () => { const ds = run.root.querySelectorAll("#gm-dots i"); ds.forEach((d, i) => { d.className = i < res.length ? (res[i] ? "ok" : "meh") : i === r ? "now" : ""; }); };
  function round(){
    cur = order[r]; first = true; busy = false;
    const others = shuffle(P.filter(x => x !== cur && x.img !== cur.img)).slice(0, 3);
    opts = shuffle([cur, ...others]);
    const cols = shuffle(BALLOONS);
    air.innerHTML = opts.map((o, k) => `<button class="gm-bal" data-k="${k}" style="--bc:${cols[k]};--d:${k * 110}ms" aria-label="Globo ${k + 1}: ${esc(o.es)}">
      <span class="gm-bal-b"><span class="gm-bal-i">${imgTag(o)}</span></span><span class="gm-bal-s"></span><span class="gm-bx" aria-hidden="true">✗</span></button>`).join("");
    const rd = $("#gm-rd"); if(rd) rd.textContent = r + 1;
    const lt = $("#gm-ltxt"); if(lt) lt.innerHTML = "Escucha y toca el globo correcto";
    fitBal();
    dots();
    const pl = $("#gm-play"); if(pl){ pl.classList.remove("ring"); void pl.offsetWidth; pl.classList.add("ring"); }
    later(run, () => speak(cur.word), 700);
  }
  air.onclick = e => {
    const b = e.target.closest(".gm-bal"); if(!b || busy || b.disabled || !live(run)) return;
    const o = opts[+b.dataset.k];
    if(o === cur){
      busy = true; if(first){ score++; answer(true, cur); } res.push(first); haptic("success");
      b.classList.add("pop"); b.insertAdjacentHTML("beforeend", `<span class="gm-bang" aria-hidden="true">💥</span>`);
      snd("pop"); later(run, () => snd("ok"), 120);
      sparks(b.querySelector(".gm-bal-b"), 14);
      air.querySelectorAll(".gm-bal").forEach(x => { if(x !== b){ x.disabled = true; x.classList.add("dim"); } });
      const lt = $("#gm-ltxt"); if(lt) lt.innerHTML = `<span class="gm-reveal">✓ ${first ? "¡Sí! " : ""}<span lang="${LANGS[lang].code}">${esc(cur.word)}</span> = ${esc(cur.es)}</span>`;
      const sc = $("#gm-sc"); if(sc){ sc.textContent = score; bump(sc.parentNode); }
      dots();
      later(run, () => speak(cur.word), 250);
      later(run, () => {
        r++;
        if(r < R) round();
        else {
          const stars = score >= 9 ? 3 : score >= 6 ? 2 : 1;
          const seen = new Set(), words = [];
          order.forEach((it, i) => { if(!seen.has(it.k)){ seen.add(it.k); words.push(Object.assign({miss: !res[i]}, it)); } });
          finish(run, "globos", {score, stars, words, line: `¡Acertaste ${score} de ${R} a la primera!`});
        }
      }, 1900);
    } else {
      /* fallo: el globo se apaga en gris con ✗ y suena otra vez la palabra (sin temblor ni sonido triste) */
      if(first) answer(false, cur);
      first = false; b.disabled = true; b.classList.add("no");
      const lt = $("#gm-ltxt"); if(lt) lt.innerHTML = `Ese es <b style="font-size:1.1rem;color:var(--label)">${esc(o.es)}</b>. ¡Escucha otra vez!`;
      later(run, () => speak(cur.word), 450);
    }
  };
  $("#gm-play").onclick = () => { if(cur) speak(cur.word); };
  $("#gm-slow").onclick = () => { if(cur) speak(cur.word, true); };
  $("#gm-peek").onclick = () => { if(!cur) return; const lt = $("#gm-ltxt"); if(lt) lt.innerHTML = `La palabra es: <b lang="${LANGS[lang].code}">${esc(cur.word)}</b>`; speak(cur.word); };
  /* el tamaño de los globos sale del hueco que queda en la pantalla (sin scroll en ningún aparato), no de topes fijos:
     prueba 2×2 y 1×4 y se queda con la que da el globo más grande; si sobra alto, cuerdas más largas */
  const BAL = 11 / 9, GX = 16, GY = 8, STR = 8, SH0 = 16, SHMAX = 40, BWMAX = 220;
  function fitBal(){
    if(!live(run) || !air.isConnected) return;
    const root = run.root, land = innerWidth > innerHeight && innerHeight < 540 && innerWidth >= 560;
    root.classList.toggle("gm-land", land);
    root.classList.toggle("gm-cmp", !land && innerHeight < 720);
    const cs = getComputedStyle(air), px = v => parseFloat(v) || 0;
    const padT = px(cs.paddingTop), padB = px(cs.paddingBottom);
    const wz = air.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
    const ar = air.getBoundingClientRect(), main = air.closest("main");
    const below = main ? Math.max(0, main.getBoundingClientRect().bottom - ar.bottom) : 40;
    const H = Math.max(160, Math.floor(innerHeight - (ar.top + scrollY) - below) - 1);
    let best = null;
    for(const [c, rows] of [[2, 2], [4, 1]]){
      const rowH = (H - padT - padB - GY * (rows - 1)) / rows;
      const bw = Math.floor(Math.min((wz - GX * (c - 1)) / c, (rowH - STR - SH0) / BAL, BWMAX));
      if(!best || bw > best.bw) best = {c, rows, bw, rowH};
    }
    const bw = Math.max(48, best.bw), colH = Math.ceil(bw * BAL) + STR;
    const sh = Math.round(SH0 + Math.max(0, Math.min(SHMAX - SH0, (best.rowH - colH - SH0) / 2)));
    const need = padT + padB + best.rows * (colH + sh) + GY * (best.rows - 1);
    air.style.setProperty("--cols", best.c);
    air.style.setProperty("--bw", bw + "px");
    air.style.setProperty("--sh", sh + "px");
    air.style.setProperty("--airh", Math.round(Math.max(need, Math.min(H, need + 120))) + "px");
  }
  /* y otra vez cuando acaba de colocarse todo: con «Reducir movimiento» los cambios de tamaño (entrar en el modo foco,
     girar el aparato) llevan una transición corta y lo medido al momento todavía no es lo final */
  let fitT = 0;
  const refit = () => { fitBal(); clearTimeout(fitT); fitT = setTimeout(fitBal, 260); };
  run.clean.push(() => clearTimeout(fitT));
  addEventListener("resize", refit); run.clean.push(() => removeEventListener("resize", refit));
  /* la tarjeta de escuchar solo cambia de alto con «Texto más grande» o el ancho (la frase tiene sitio para 2 líneas);
     los saltitos de un par de píxeles no recolocan los globos */
  if(typeof ResizeObserver === "function"){
    const lis = run.root.querySelector("#gm-listen");
    let lw = 0, lh = 0;
    const ro = new ResizeObserver(() => {
      const w = lis.offsetWidth, h = lis.offsetHeight;
      if(Math.abs(w - lw) < 2 && Math.abs(h - lh) < 6) return;
      lw = w; lh = h; requestAnimationFrame(fitBal);
    });
    ro.observe(lis); run.clean.push(() => ro.disconnect());
  }
  refit();
  /* otra vez antes de pintar: el modo foco (sin barras de arriba) entra justo después de montar la partida */
  requestAnimationFrame(refit);
  try{ document.fonts.ready.then(fitBal); }catch(e){}
  /* con «Reducir movimiento» el modo foco entra con una transición corta: la primera ronda espera a que acabe (si no,
     los globos salen con el tamaño de antes y crecen de golpe a los 260 ms) */
  const t0 = performance.now();
  intro(run, "globos", () => { const wait = RM() ? 300 - (performance.now() - t0) : 0; if(wait > 0) later(run, () => { fitBal(); round(); }, wait); else round(); });
}

/* =====================================================================
   4. LETRAS LOCAS — ordena las letras de la palabra (sin artículo)
   ===================================================================== */
function letras(app, P, mode){
  const cand = shuffle(P.map(it => ({it, x: letrasOf(it)})).filter(o => o.x));
  const list = cand.slice(0, 5).sort((a, b) => [...a.x.base].length - [...b.x.base].length);
  const NW = list.length;
  preload(list.map(o => o.it));
  const run = mount(app, `<div class="gm gm-let">
    ${topHtml("letras", `<span class="gm-pill" title="Palabra">${IC("text-aa", "bold", 18)}<span><b id="gm-wn">1</b>/${NW}</span></span><span class="gm-pill" title="Puntos">${IC("star", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`)}
    <div class="gm-lt" id="gm-lt"></div>
    ${dotsHtml(NW)}</div>`, mode);
  const box = run.root.querySelector("#gm-lt");
  let w = 0, total = 0, S = null, started = false, chkT = 0, fitL = null;
  const res = [];
  /* una sola comprobación pendiente (pista + última letra no cuentan dos fallos) */
  const queueCheck = ms => { clearTimeout(chkT); chkT = later(run, check, ms); };
  const paintDots = () => { const ds = run.root.querySelectorAll("#gm-dots i"); ds.forEach((d, i) => d.className = i < res.length ? (res[i] === 3 ? "ok" : "meh") : i === w ? "now" : ""); };
  const norm = c => c.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/gi, "o").replace(/æ/gi, "a").replace(/œ/gi, "o").toLowerCase();

  function word(){
    const {it, x} = list[w], ans = [...x.base];
    let order = shuffle(ans.map((ch, i) => i)), k = 0;
    while(ans.length > 1 && order.every((v, i) => ans[v] === ans[i]) && k++ < 12) order = shuffle(order);
    clearTimeout(chkT);
    S = {it, x, ans, tiles: order.map(i => ({ch: ans[i], at: -1})), slots: ans.map(() => -1), lock: ans.map(() => ""), hints: 0, errs: 0, done: false, busy: false};
    box.classList.remove("solved");
    box.innerHTML = `<div class="gm-lt-pic">${imgTag(it)}</div>
      <div class="gm-lt-es">${esc(it.es)}${x.art ? ` <span class="gm-art" title="Va con este artículo">${esc(x.art)} …</span>` : ""}</div>
      <p class="gm-lt-n">¿Cómo se escribe en ${esc(nm())}? ${ans.length} letras</p>
      <div class="gm-slots" id="gm-slots" style="--n:${ans.length}">${ans.map((_, i) => `<button class="gm-slot" data-s="${i}" aria-label="Hueco ${i + 1}"></button>`).join("")}</div>
      <div class="gm-tiles" id="gm-tiles">${S.tiles.map((t, i) => `<button class="gm-tile" data-t="${i}" style="--i:${i}" aria-label="Letra ${esc(t.ch)}">${esc(t.ch)}</button>`).join("")}</div>
      <div class="gm-lt-acts" id="gm-acts">
        <button type="button" class="glass-btn glass-btn--sm" id="gm-hint">${IC("lightbulb", "bold", 20)}Pista</button>
        <button type="button" class="glass-btn glass-btn--sm" id="gm-del">${IC("x", "bold", 20)}Borrar</button>
        <button type="button" class="glass-btn glass-btn--sm" id="gm-hear" aria-label="Escuchar la palabra">${IC("speaker-high", "bold", 20)}Oír</button></div>
      <div id="gm-fb"></div>`;
    const wn = $("#gm-wn"); if(wn) wn.textContent = w + 1;
    paintDots();
    wire(); paint();
    if(fitL) fitL(true);
  }
  function paint(){
    if(!S) return;
    const slots = box.querySelectorAll(".gm-slot"), tiles = box.querySelectorAll(".gm-tile");
    const nextFree = S.slots.indexOf(-1);
    slots.forEach((el, i) => {
      const ti = S.slots[i];
      el.textContent = ti >= 0 ? S.tiles[ti].ch : "";
      el.className = "gm-slot" + (ti >= 0 ? " fill" : "") + (S.lock[i] ? " " + S.lock[i] : "") + (!S.done && i === nextFree ? " next" : "");
    });
    tiles.forEach((el, i) => { el.classList.toggle("used", S.tiles[i].at >= 0); el.disabled = S.done; });
  }
  function place(ti, k){
    if(!S || S.done || S.busy || S.tiles[ti].at >= 0) return;
    if(k === undefined || k < 0) k = S.slots.indexOf(-1);
    if(k < 0 || S.lock[k]) { k = S.slots.indexOf(-1); if(k < 0) return; }
    if(S.slots[k] >= 0) S.tiles[S.slots[k]].at = -1;
    S.slots[k] = ti; S.tiles[ti].at = k;
    snd("tap"); paint();
    if(S.slots.every(v => v >= 0)) queueCheck(220);
  }
  function unplace(k){
    if(!S || S.done || S.busy || k < 0 || S.lock[k] || S.slots[k] < 0) return false;
    S.tiles[S.slots[k]].at = -1; S.slots[k] = -1; return true;
  }
  function erase(){
    if(!S) return;
    for(let k = S.slots.length - 1; k >= 0; k--) if(unplace(k)){ clearTimeout(chkT); snd("whoosh"); paint(); return; }
  }
  function hint(){
    if(!S || S.done || S.busy) return;
    const k = S.ans.findIndex((ch, i) => !S.lock[i] && (S.slots[i] < 0 || S.tiles[S.slots[i]].ch !== ch));
    if(k < 0) return;
    unplace(k);
    let ti = S.tiles.findIndex(t => t.at < 0 && t.ch === S.ans[k]);
    if(ti < 0){
      const j = S.slots.findIndex((v, i) => v >= 0 && !S.lock[i] && S.tiles[v].ch === S.ans[k] && S.tiles[v].ch !== S.ans[i]);
      if(j >= 0){ ti = S.slots[j]; unplace(j); }
    }
    if(ti < 0) return;
    S.slots[k] = ti; S.tiles[ti].at = k; S.lock[k] = "hint"; S.hints++;
    snd("pop"); paint();
    const el = box.querySelectorAll(".gm-slot")[k]; bump(el);
    if(S.slots.every(v => v >= 0)) queueCheck(260);
  }
  function check(){
    if(!S || S.done || S.busy || !S.slots.every(v => v >= 0)) return;
    const okAll = S.ans.every((ch, i) => S.tiles[S.slots[i]].ch === ch);
    const els = box.querySelectorAll(".gm-slot");
    if(okAll){
      S.done = true; if(!S.errs) answer(true, S.it);
      haptic("success");
      const pts = Math.max(1, 3 - Math.min(2, S.hints + S.errs));
      total += pts; res.push(pts);
      S.lock = S.lock.map(() => "good"); paint();
      els.forEach((el, i) => { el.style.setProperty("--i", i); el.classList.add("win"); });
      snd("ok"); sparks(box.querySelector("#gm-slots"), 14);
      speak(S.it.word);
      const sc = $("#gm-sc"); if(sc){ sc.textContent = total; bump(sc.parentNode); }
      paintDots();
      const last = w + 1 >= NW;
      box.classList.add("solved");
      $("#gm-fb").innerHTML = `<div class="gm-lt-ok">✓ ${pts === 3 ? "¡Perfecto!" : "¡Muy bien!"} <span lang="${LANGS[lang].code}">${esc(S.it.word)}</span><span>= ${esc(S.it.es)}</span>
        <button type="button" class="gm-say" id="gm-again-say" aria-label="Escuchar otra vez">${IC("speaker-high", "fill", 24)}</button>
        <button type="button" class="glass-btn glass-btn--pri" id="gm-next">${last ? "Ver el premio" : "Siguiente"}${IC("caret-right", "bold", 20)}</button></div>`;
      $("#gm-again-say").onclick = () => speak(S.it.word);
      const myW = w, nx = () => { if(!live(run) || w !== myW) return; next(); };
      $("#gm-next").onclick = nx;
      later(run, nx, 2600);
    } else {
      /* fallo: las letras mal puestas en gris con ✗ un momento y vuelven abajo (sin temblor ni sonido triste) */
      S.errs++; S.busy = true; if(S.errs === 1) answer(false, S.it);
      const wrong = [];
      S.ans.forEach((ch, i) => { if(S.tiles[S.slots[i]].ch !== ch) wrong.push(i); else if(!S.lock[i]) S.lock[i] = "good"; });
      paint(); wrong.forEach(i => els[i].classList.add("wrong"));
      const mine = S;
      later(run, () => { if(S !== mine) return; S.busy = false; wrong.forEach(i => unplace(i)); paint(); }, 700);
    }
  }
  function next(){
    if(!S || !S.done) return;
    w++;
    if(w < NW) word();
    else {
      const max = 3 * NW, ratio = total / max, stars = ratio >= .85 ? 3 : ratio >= .6 ? 2 : 1;
      finish(run, "letras", {score: total, stars, words: list.map((o, i) => Object.assign({miss: res[i] < 3}, o.it)),
        line: `¡Escribiste ${NW} palabras! Puntos: ${total} de ${max}.`});
    }
  }
  /* toques y arrastre */
  function wire(){
    box.querySelector("#gm-hint").onclick = hint;
    box.querySelector("#gm-del").onclick = erase;
    box.querySelector("#gm-hear").onclick = () => speak(S.it.word);
    box.querySelector("#gm-slots").onclick = e => { const s = e.target.closest(".gm-slot"); if(s && unplace(+s.dataset.s)){ clearTimeout(chkT); snd("whoosh"); paint(); } };
    box.querySelectorAll(".gm-tile").forEach(el => {
      const ti = +el.dataset.t;
      el.addEventListener("click", e => { if(e.detail === 0) place(ti); });
      el.addEventListener("contextmenu", e => e.preventDefault());
      el.addEventListener("pointerdown", e => {
        if(!started || S.done || S.busy || S.tiles[ti].at >= 0) return;
        if(e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        const x0 = e.clientX, y0 = e.clientY; let ghost = null, over = null;
        try{ el.setPointerCapture(e.pointerId); }catch(err){}
        const mv = ev => {
          if(!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10){
            ghost = document.createElement("div"); ghost.className = "gm-ghost"; ghost.textContent = S.tiles[ti].ch;
            document.body.appendChild(ghost); el.classList.add("drag");
            haptic("selection");
          }
          if(ghost){
            ghost.style.left = ev.clientX + "px"; ghost.style.top = ev.clientY + "px";
            const t = document.elementFromPoint(ev.clientX, ev.clientY), s = t && t.closest && t.closest(".gm-slot");
            if(over && over !== s) over.classList.remove("drop");
            over = s && box.contains(s) ? s : null; if(over) over.classList.add("drop");
          }
        };
        const up = ev => {
          el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); el.removeEventListener("lostpointercapture", up);
          if(over) over.classList.remove("drop");
          if(ghost){
            ghost.remove(); el.classList.remove("drag");
            if(ev.type === "pointerup" && over) place(ti, +over.dataset.s);
          } else if(ev.type === "pointerup") place(ti);
        };
        el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up); el.addEventListener("lostpointercapture", up);
      });
    });
  }
  const kb = e => {
    if(!started || !S) return;
    if(e.target.closest && e.target.closest("input,textarea,select")) return;
    if(e.key === "Backspace"){ e.preventDefault(); erase(); return; }
    if(e.key === "Enter" && S.done){ e.preventDefault(); next(); return; }
    if(e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey || S.done) return;
    const free = S.tiles.map((t, i) => ({t, i})).filter(o => o.t.at < 0);
    const hit = free.find(o => o.t.ch === e.key) || free.find(o => o.t.ch.toLowerCase() === e.key.toLowerCase()) || free.find(o => norm(o.t.ch) === norm(e.key));
    if(hit){ e.preventDefault(); place(hit.i); }
  };
  word();
  fitL = autoFit(run, run.root.querySelector("#gm-dots") || box, null, true);
  intro(run, "letras", () => { started = true; keys(run, kb); });
}

/* ---------- juegos de otros módulos ---------- */
const API = Object.freeze({mount, intro, later, keys, live, finish, answer, haptic, speak, snd, bump, autoFit, topHtml, starsHtml, dotsHtml, nm,
  nav: () => NAV, here: (my, g) => here(my, g), kbd: () => KBD});
function register(id, def){
  if(typeof id !== "string" || !/^[a-z][a-z0-9-]*$/.test(id) || GAMES[id] || !def || !def.t || !def.img) return false;
  /* sin start, solo una tarjeta que lleva a otra pantalla de la app (href "#/…") */
  if(typeof def.start !== "function" && !(typeof def.href === "string" && /^#\/[a-z]/.test(def.href))) return false;
  GAMES[id] = Object.assign({sub: "", how: "", need: 0}, def);
  return true;
}

/* ---------- conexión con la app ---------- */
Object.assign(window.vocabGames = window.vocabGames || {}, {
  pause, how, openTopics, peek, register,
  list: () => Object.keys(GAMES),
  /* los dibujos que usa el menú (para «Descargar todo»): los de cada juego y los de los temas */
  images: () => [...new Set([...Object.values(GAMES).map(x => x.img), ...[MIS_INFO, ...TOPICS].map(t => `img/om_${t[1]}.png`)])],
  /* para los atajos de Hoy (js/shortcuts.js): un juego (topic: si se juega con un tema) y un tema */
  meta: id => GAMES[id] ? {id, t: GAMES[id].t, img: GAMES[id].img, topic: !GAMES[id].start && !GAMES[id].words} : null,
  topic: id => isTopic(id) ? {id, name: topicName(id), img: topicImg(id)} : null,
});
Object.defineProperty(window.vocabGames, "paused", {configurable: true, enumerable: true, get: () => !!(RUN && RUN.paused)});
ROUTES["juegos"] = async parts => {
  NAV++; stop(); css();
  const g = parts[0];
  if(isLink(g)){ location.replace(GAMES[g].href); return; }
  if(GAMES[g]) await play(g, true);
  else await menu();
};
HOME_ACTS.push({href: "#/juegos", e: "🎮", t: "Juegos", sub: "Aprende jugando", color: "#22409a"});
})();
