/* módulo games: minijuegos para aprender jugando.
   Rutas: #/juegos (menú) · #/juegos/memoria · #/juegos/lluvia · #/juegos/globos · #/juegos/letras
   Emite: bus "game-done" {game, score, stars, tries?}
   Guarda: store "games:best" {juego: {score, stars, tries?, plays}} · "games:topic" (tema elegido) · "games:day" (partidas de hoy) */
(() => {
"use strict";

const MIS = "mis";
const GAMES = {
  memoria: {e: "🧩", t: "Memoria",            sub: "Busca las parejas",       c: "#1E6EF4", how: "Da la vuelta a dos cartas. Busca cada dibujo con su palabra."},
  lluvia:  {e: "🌧️", t: "Lluvia de palabras", sub: "Atrapa la palabra buena", c: "#008198", how: "Toca solo las burbujas de la palabra que te pido. ¡Cuidado con las otras!"},
  globos:  {e: "🎈", t: "Globos",             sub: "Escucha y explota",       c: "#008932", how: "Escucha la palabra y explota el globo de su dibujo."},
  letras:  {e: "🔤", t: "Letras locas",       sub: "Ordena las letras",       c: "#A16A00", how: "Toca las letras en orden (o arrástralas) para escribir la palabra."},
};
/* temas con muchas imágenes: [id, emoji, nombre, principal] */
const TOPICS = [
  ["animales", "🐶", "Animales", 1], ["colores", "🎨", "Colores", 1], ["familia", "👨‍👩‍👦", "Familia", 1], ["w03", "🍎", "Comida", 1],
  ["w02", "🖐️", "El cuerpo", 1], ["w04", "🏠", "La casa", 1], ["w05", "👕", "La ropa", 1], ["w07", "🚗", "Transporte", 1],
  ["w09", "🌳", "Naturaleza", 1], ["w13", "⚽", "Deporte y juegos", 1], ["profesiones", "👷", "Profesiones", 1], ["paises", "🌍", "Países", 1],
  ["w06", "🏙️", "La ciudad", 0], ["w14", "🎪", "Ocio y fiestas", 0], ["w15", "💻", "Tecnología", 0], ["w28", "🍳", "Cosas de cada día", 0],
  ["w25", "🤸", "Moverse", 0], ["w01", "🧑‍🤝‍🧑", "Personas", 0], ["w32", "😀", "Emociones", 0], ["w31", "👀", "Cómo son las cosas", 0],
  ["w29", "🔄", "Cambios", 0], ["w16", "🔬", "Ciencia", 0], ["w26", "💬", "Hablar", 0], ["w08", "📅", "Días y horas", 0],
  ["w20", "💭", "Sentimientos", 0], ["w10", "🏫", "El colegio", 0], ["w11", "💼", "Trabajos", 0], ["w12", "🛒", "Compras", 0],
  ["nacionalidades", "🏳️", "Nacionalidades", 0],
];
const BALLOONS = ["#1E6EF4", "#008198", "#34C759", "#FFCC00", "#30B0C7", "#d64545", "#22409a", "#4b5563"];
const RM = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- utilidades seguras ---------- */
const snd = n => { try{ if(typeof sfx !== "undefined") sfx.play(n); }catch(e){} };
const boom = o => { try{ if(typeof confetti === "function") confetti(o); }catch(e){} };
function boomAt(el, n = 18, emoji){
  if(!el || !el.getBoundingClientRect) return;
  const r = el.getBoundingClientRect();
  boom({n, x: r.left + r.width / 2, y: r.top + r.height / 2, emoji});
}
function speak(t, slow){
  if(!t || !("speechSynthesis" in window)) return;
  try{ say(t, null, slow); }catch(e){}
}
/* cada respuesta cuenta para las misiones («Acierta 15 respuestas»); el sonido ya lo pone el propio juego */
const answer = (ok, it) => { try{ bus.emit("answer", {ok: !!ok, es: it && it.es, word: it && it.word, where: "game"}); }catch(e){} };
const pick = a => a[Math.floor(Math.random() * a.length)];
const nm = () => LANGS[lang].name;
const fs = w => { const n = [...w].length; return n <= 5 ? "1.5rem" : n <= 8 ? "1.25rem" : n <= 12 ? "1.05rem" : ".92rem"; };
const starsTxt = n => "★".repeat(n) + "☆".repeat(3 - n);

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
}
function begin(root){ stop(); RUN = {alive: true, timers: [], raf: 0, clean: [], root, keys: null}; playMark(hparts()[1] || "juego"); return RUN; }
const live = run => !!run && run.alive && RUN === run && run.root.isConnected;
function later(run, fn, ms){ const id = setTimeout(() => { if(live(run)) fn(); }, ms); run.timers.push(id); return id; }
function keys(run, fn){ run.keys = e => { if(!live(run)){ document.onkeydown = null; return; } fn(e); }; document.onkeydown = run.keys; }
const hparts = () => location.hash.replace(/^#\/?/, "").split("/");
const here = (my, g) => { const h = hparts(); return my === NAV && h[0] === "juegos" && (g === undefined || (h[1] || "") === g); };
/* lectura segura del almacenamiento (por si alguna clave está estropeada) */
const obj = (k) => { const v = store.get(k, null); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; };
/* marca en <html> mientras se juega (otros módulos pueden apartarse: html[data-gm-play]) */
const playMark = g => { try{ if(g) document.documentElement.dataset.gmPlay = g; else delete document.documentElement.dataset.gmPlay; }catch(e){} };

addEventListener("hashchange", () => { if(!/^#\/?juegos/.test(location.hash)){ NAV++; stop(); } });
bus.on("route", d => { if(!String((d && d.h) || "").startsWith("juegos")){ NAV++; stop(); } });

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
const topicInfo = id => id === MIS ? [MIS, "⭐", "Mis palabras", 1] : (TOPICS.find(x => x[0] === id) || TOPICS[0]);
const topicLabel = id => { const t = topicInfo(id); return `${t[1]} ${t[2]}`; };
const NEED = {memoria: 6, lluvia: 4, globos: 4, letras: 3};
const usable = (g, P) => g === "letras" ? P.filter(letrasOf).length : P.length;
const preload = items => items.forEach(x => { const im = new Image(); im.src = x.img; });
const imgTag = (it, cls = "") => `<img class="${cls}" src="${esc(it.img)}" alt="" draggable="false">`;

/* ---------- estilos ---------- */
const CSS = `
.gm{--gm-tile:#fff;max-width:880px;margin:0 auto}
[data-theme=dark] .gm{--gm-tile:#e9eef5}
.gm img{-webkit-user-drag:none;user-select:none}
.gm button{-webkit-tap-highlight-color:transparent}
.gm .back{font-weight:700;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px 0 4px;margin-bottom:4px;border-radius:12px}
.gm .back:hover{color:var(--brand)}
.gm-top{display:flex;align-items:center;gap:10px;margin:0 0 12px}
.gm-x{flex:none;width:48px;height:48px;border-radius:14px;border:2px solid var(--line);background:var(--card);color:var(--muted);font-size:1.25rem;font-weight:800;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:var(--shadow)}
@media (hover:hover){.gm-x:hover{border-color:var(--brand);color:var(--brand)}}
.gm-name{font-weight:800;font-size:1.15rem;margin-right:auto;display:flex;align-items:center;gap:6px;min-width:0}
.gm-name .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gm-stats{display:flex;gap:8px;flex:none}
.gm-pill{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:6px 14px;border-radius:999px;background:var(--card);border:2px solid var(--line);font-weight:800;font-size:1.02rem;box-shadow:var(--shadow);white-space:nowrap}
.gm-pill b{font-size:1.2rem}
.gm-pill.bump,.gm-bump{animation:gm-bump .4s}
@keyframes gm-bump{40%{transform:scale(1.2)}}
.gm-tip{color:var(--muted);text-align:center;margin:12px 0 0;font-size:.95rem}
/* menú */
.gm-menu .hello{margin-bottom:10px}
.gm-now{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:2px 0 12px;font-weight:700;color:var(--muted)}
.gm-now b{color:var(--ink)}
.gm-chg{border:0;background:none;color:var(--brand);font-weight:700;padding:10px 6px;min-height:44px}
.gm-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:0 0 20px}
.gm-card{position:relative;isolation:isolate;overflow:hidden;display:flex;flex-direction:column;align-items:flex-start;gap:1px;min-height:178px;padding:16px 16px 14px;border-radius:22px;color:#fff;text-decoration:none;
  background-color:var(--gc);background-image:radial-gradient(rgba(255,255,255,.13) 2px,transparent 2.6px);background-size:18px 18px;
  box-shadow:0 6px 0 color-mix(in srgb,var(--gc) 55%,#000);transition:transform .12s,box-shadow .12s}
@media (hover:hover){.gm-card:hover{transform:translateY(-3px);box-shadow:0 9px 0 color-mix(in srgb,var(--gc) 55%,#000)}}
.gm-card:active{transform:translateY(4px);box-shadow:0 2px 0 color-mix(in srgb,var(--gc) 55%,#000)}
.gm-card:focus-visible{outline:4px solid var(--brand);outline-offset:3px}
.gm-card .ge{font-size:3rem;line-height:1.1;filter:drop-shadow(0 3px 2px rgba(0,0,0,.25));animation:gm-bob 2.6s ease-in-out infinite}
.gm-card:nth-child(2) .ge{animation-delay:-.7s}.gm-card:nth-child(3) .ge{animation-delay:-1.4s}.gm-card:nth-child(4) .ge{animation-delay:-2s}
.gm-card b{font-size:1.3rem;line-height:1.15;margin-top:6px;text-shadow:0 2px 0 rgba(0,0,0,.15)}
.gm-card small{font-size:.92rem;opacity:.95}
.gm-card .gb{margin-top:auto;padding-top:10px;display:flex;flex-wrap:wrap;gap:5px}
.gm-card .gb>span{display:inline-block;background:rgba(0,0,0,.22);border-radius:10px;padding:5px 10px;font-size:.86rem;font-weight:700}
.gm-card .gb>.gc{background:rgba(0,0,0,.24)}
.gm-card .gb .st{color:#FFD600;letter-spacing:1px}
.gm-card .gd{position:absolute;right:-12px;bottom:-26px;font-size:6.6rem;opacity:.17;transform:rotate(-14deg);z-index:-1;pointer-events:none}
.gm-card .play{position:absolute;right:12px;top:12px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-size:1.1rem}
@keyframes gm-bob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-6px) rotate(-4deg)}}
.gm-tpanel h2{margin-bottom:4px}
.gm-tps{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.gm-tp{min-height:48px;display:inline-flex;align-items:center;gap:8px;border:2px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:5px 16px 5px 6px;font-weight:700;font-size:1rem;transition:transform .1s}
.gm-tp:active{transform:scale(.96)}
.gm-tp .ti{width:36px;height:36px;border-radius:50%;background:var(--soft);display:inline-flex;align-items:center;justify-content:center;font-size:1.2rem}
.gm-tp.on{border-color:var(--brand);background:var(--soft);color:var(--brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 22%,transparent)}
.gm-tp.on .ti{background:var(--card)}
.gm-tp.mis{border-color:#FFCC00}
.gm-tp.more{color:var(--muted);border-style:dashed;padding-left:16px}
.gm-tp small{color:var(--muted);font-weight:600}
.gm-prev{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;min-height:60px;align-items:center}
.gm-prev .pi{width:56px;height:56px;border-radius:14px;background:var(--gm-tile);border:2px solid var(--line);display:flex;align-items:center;justify-content:center;animation:gm-in .35s both}
.gm-prev .pi img{width:42px;height:42px;object-fit:contain}
.gm-prev .pn{color:var(--muted);font-size:.9rem;font-weight:600;margin-left:4px}
@keyframes gm-in{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
/* intro */
.gm-intro{position:fixed;inset:0;z-index:9;background:rgba(5,15,30,.55);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto;animation:gm-fade .2s}
@media (max-height:700px){.gm-intro-e{font-size:3rem!important}.gm-intro-c{padding:16px 16px!important}.gm-intro-c p{font-size:1rem!important}}
.gm-intro-c{margin:auto;background:var(--card);color:var(--ink);border-radius:24px;padding:24px 20px;text-align:center;max-width:380px;width:100%;box-shadow:0 20px 50px rgba(0,0,0,.35);border-top:8px solid var(--gc);animation:gm-in .35s}
.gm-intro-e{font-size:4rem;line-height:1.1;animation:gm-bob 2.4s ease-in-out infinite}
.gm-intro-c b{display:block;font-size:1.5rem;margin:6px 0 4px}
.gm-intro-c p{margin:0 0 10px;font-size:1.08rem;line-height:1.4}
.gm-intro-t{display:inline-block;background:var(--soft);border-radius:999px;padding:5px 12px;font-weight:700;color:var(--brand);margin-bottom:16px}
.gm-go{font-size:1.25rem!important;padding:14px 34px!important;min-height:54px}
.gm-intro-back{display:inline-flex;align-items:center;min-height:44px;margin-top:8px;padding:0 12px;color:var(--muted);font-weight:700;text-decoration:none;border-radius:12px}
.gm-intro-back:hover{color:var(--brand)}
@keyframes gm-fade{from{opacity:0}}
/* memoria */
.gm-board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;max-width:620px;margin:0 auto}
.gm-mc{position:relative;aspect-ratio:4/5;border:0;padding:0;background:none;border-radius:16px;touch-action:manipulation;cursor:pointer;perspective:900px}
.gm-mc-in{position:absolute;inset:0;transition:transform .5s cubic-bezier(.3,1.35,.5,1);transform-style:preserve-3d}
@media (hover:hover){.gm-mc:not(.up):hover .gm-mc-in{transform:translateY(-3px) rotate(-1deg)}}
.gm-mc:not(.up):active .gm-mc-in{transform:scale(.95)}
.gm-mc.up .gm-mc-in{transform:rotateY(180deg)}
.gm-mc-f{position:absolute;inset:0;border-radius:16px;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:flex;align-items:center;justify-content:center;overflow:hidden}
.gm-mc-back{background-image:radial-gradient(rgba(255,255,255,.2) 2px,transparent 2.6px),linear-gradient(var(--brand-fill),var(--brand-fill));background-size:14px 14px,100% 100%;border:3px solid rgba(255,255,255,.35);box-shadow:0 5px 0 color-mix(in srgb,var(--brand) 45%,#000)}
.gm-mc-back span{width:58%;aspect-ratio:1;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:2.2rem;font-weight:900;color:#fff;text-shadow:0 3px 0 rgba(0,0,0,.2)}
.gm-mc-face{transform:rotateY(180deg);background:var(--gm-tile);border:3px solid var(--line);box-shadow:0 5px 0 var(--line)}
.gm-mc-face img{width:80%;height:80%;object-fit:contain}
.gm-mc-face.k-word{background:var(--soft);border-color:color-mix(in srgb,var(--brand) 45%,var(--line));padding:6px}
.gm-mw{font-weight:900;line-height:1.15;text-align:center;overflow-wrap:anywhere;color:var(--ink)}
.gm-mc.ok .gm-mc-face{border-color:var(--ok);box-shadow:0 0 0 4px color-mix(in srgb,var(--ok) 30%,transparent),0 5px 0 var(--ok)}
.gm-mc.ok{animation:gm-yay .55s}
.gm-mc.ok::after{content:"✓";position:absolute;right:-6px;top:-6px;width:28px;height:28px;border-radius:50%;background:var(--ok-fill);color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.25);z-index:2}
.gm-mc.no .gm-mc-face{border-color:var(--bad)}
.gm-mc.no{animation:gm-shake .4s}
@keyframes gm-yay{40%{transform:scale(1.1) rotate(2deg)}}
@keyframes gm-shake{20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
/* lluvia */
.gm-catch{display:flex;align-items:center;justify-content:center;gap:12px;background:var(--card);border:2px solid var(--line);border-radius:18px;padding:8px 10px 8px 16px;box-shadow:var(--shadow);margin-bottom:10px;min-height:64px}
.gm-catch-l{color:var(--muted);font-weight:800;font-size:1.05rem}
.gm-catch b{font-size:1.65rem;font-weight:900;color:var(--brand);line-height:1.1}
.gm-say{flex:none;width:52px;height:52px;border-radius:50%;border:0;background:var(--brand-fill);color:#fff;font-size:1.35rem;box-shadow:0 4px 0 color-mix(in srgb,var(--brand) 45%,#000)}
.gm-say:active{transform:translateY(3px);box-shadow:0 1px 0 color-mix(in srgb,var(--brand) 45%,#000)}
.gm-tbar{height:12px;border-radius:99px;background:var(--line);overflow:hidden;margin:0 0 10px}
.gm-tbar i{display:block;height:100%;width:100%;background:var(--teal);border-radius:99px;transform-origin:left center}
.gm-tbar.low i{background:var(--gold)}
.gm-sky{position:relative;height:min(60vh,540px);min-height:280px;border-radius:22px;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;
  background:linear-gradient(180deg,#0f3d75 0%,#1f6fd1 58%,#1a9e94 100%);box-shadow:var(--shadow)}
[data-theme=dark] .gm-sky{background:linear-gradient(180deg,#081a30 0%,#0f3156 60%,#0f5a55 100%)}
.gm-cl{position:absolute;font-size:2.6rem;opacity:.9;pointer-events:none;top:-6px}
.gm-cl.c1{left:6%}.gm-cl.c2{left:44%;font-size:3.2rem;top:-14px}.gm-cl.c3{right:6%}
.gm-bub{position:absolute;left:0;top:0;border:0;padding:0;margin:0;background:none;display:flex;flex-direction:column;align-items:center;gap:4px;will-change:transform;cursor:pointer;touch-action:none;color:#fff}
.gm-bub-i{width:var(--bs);height:var(--bs);border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff 0 58%,#e4eefa 100%);border:3px solid rgba(255,255,255,.9);box-shadow:0 0 0 5px rgba(255,255,255,.16),0 8px 18px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;position:relative}
.gm-bub-i::after{content:"";position:absolute;left:18%;top:12%;width:22%;height:14%;border-radius:50%;background:rgba(255,255,255,.9);transform:rotate(-30deg)}
.gm-bub-i img{width:66%;height:66%;object-fit:contain;pointer-events:none}
.gm-bub-w{background:rgba(6,22,42,.8);color:#fff;font-weight:800;border-radius:999px;padding:3px 10px;font-size:.95rem;max-width:calc(var(--bs) + 28px);text-align:center;line-height:1.15;pointer-events:none}
.gm-bub.pop .gm-bub-i{animation:gm-burst .32s forwards}
.gm-bub.pop .gm-bub-w{opacity:0;transition:opacity .2s}
.gm-bub.bad .gm-bub-i{border-color:var(--bad);background:#d5dbe3;animation:gm-shake .4s}
.gm-bub.bad .gm-bub-i img{opacity:.55}
.gm-bub.gone{opacity:0;transition:opacity .35s}
@keyframes gm-burst{50%{transform:scale(1.3)}100%{transform:scale(1.6);opacity:0}}
.gm-float{position:absolute;z-index:5;font-weight:900;color:#fff;font-size:1.35rem;pointer-events:none;animation:gm-up 1s forwards;text-shadow:0 2px 0 rgba(0,0,0,.35);white-space:nowrap;transform:translateX(-50%)}
.gm-float.bad{background:#6C6C70;color:#fff;border-radius:999px;padding:2px 12px;font-size:1.05rem;text-shadow:none}
@keyframes gm-up{to{translate:0 -60px;opacity:0}}
.gm-over{position:absolute;inset:0;z-index:8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:rgba(5,15,30,.5);color:#fff;font-size:2rem;font-weight:900;text-align:center;animation:gm-fade .3s;padding:16px}
.gm-over span{font-size:4rem;line-height:1}
.gm-lives{letter-spacing:2px}
.gm-lives i{font-style:normal;display:inline-block}
.gm-lives i.lost{filter:grayscale(1);opacity:.35}
.gm-lives i.hurt{animation:gm-hurt .6s}
@keyframes gm-hurt{30%{transform:scale(1.6)}100%{transform:scale(1)}}
/* globos */
.gm-listen{position:relative;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;background:var(--card);border:2px solid var(--line);border-radius:18px;padding:12px;box-shadow:var(--shadow);margin-bottom:12px;min-height:96px}
.gm-bigsay{width:72px;height:72px;border-radius:50%;border:0;background:var(--brand-fill);color:#fff;font-size:2rem;box-shadow:0 5px 0 color-mix(in srgb,var(--brand) 45%,#000);flex:none}
.gm-bigsay:active{transform:translateY(3px);box-shadow:0 2px 0 color-mix(in srgb,var(--brand) 45%,#000)}
.gm-bigsay.ring{animation:gm-ring 1.1s ease-out 2}
@keyframes gm-ring{0%{box-shadow:0 5px 0 color-mix(in srgb,var(--brand) 45%,#000),0 0 0 0 color-mix(in srgb,var(--brand) 55%,transparent)}100%{box-shadow:0 5px 0 color-mix(in srgb,var(--brand) 45%,#000),0 0 0 22px transparent}}
.gm-rbtn{min-width:52px;height:52px;border-radius:16px;border:2px solid var(--line);background:var(--soft);font-size:1.4rem;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 12px;font-weight:700;color:var(--ink)}
@media (hover:hover){.gm-rbtn:hover{border-color:var(--brand)}}
.gm-rbtn:active{transform:translateY(2px)}
.gm-ltxt{flex-basis:100%;text-align:center;color:var(--muted);font-weight:700;min-height:1.5em}
.gm-ltxt b{color:var(--brand);font-size:1.45rem}
.gm-air{position:relative;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:30px 10px 0;min-height:300px;border-radius:22px;overflow:hidden;box-shadow:var(--shadow);
  background:radial-gradient(ellipse 120px 34px at 12% 100%,rgba(255,255,255,.95) 98%,transparent),radial-gradient(ellipse 160px 40px at 62% 102%,rgba(255,255,255,.9) 98%,transparent),radial-gradient(ellipse 110px 30px at 95% 100%,rgba(255,255,255,.95) 98%,transparent),linear-gradient(180deg,#bfe0ff 0%,#e6f3ff 100%)}
[data-theme=dark] .gm-air{background:radial-gradient(ellipse 120px 34px at 12% 100%,rgba(120,150,190,.35) 98%,transparent),radial-gradient(ellipse 160px 40px at 62% 102%,rgba(120,150,190,.3) 98%,transparent),radial-gradient(ellipse 110px 30px at 95% 100%,rgba(120,150,190,.35) 98%,transparent),linear-gradient(180deg,#0b1f3a 0%,#163a5f 100%)}
.gm-bal{position:relative;border:0;background:none;padding:0;display:flex;flex-direction:column;align-items:center;touch-action:manipulation;cursor:pointer;animation:gm-rise .9s cubic-bezier(.2,.9,.25,1) var(--d) both}
.gm-bal:disabled{cursor:default}
.gm-bal-b{position:relative;width:min(148px,100%);aspect-ratio:9/11;border-radius:50% 50% 50% 50%/56% 56% 44% 44%;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(circle at 30% 26%,rgba(255,255,255,.6) 0 9%,transparent 10%),radial-gradient(circle at 50% 40%,color-mix(in srgb,var(--bc) 82%,#fff),var(--bc) 70%);
  box-shadow:inset -10px -14px 0 rgba(0,0,0,.13),0 10px 16px rgba(0,0,0,.18);animation:gm-sway 3.2s ease-in-out infinite;animation-delay:calc(var(--d) * -3)}
.gm-bal-b::after{content:"";position:absolute;left:50%;bottom:-9px;transform:translateX(-50%);border:8px solid transparent;border-bottom:11px solid var(--bc);border-top:0}
.gm-bal-i{width:66%;aspect-ratio:1;border-radius:50%;background:var(--gm-tile);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.18)}
.gm-bal-i img{width:78%;height:78%;object-fit:contain;pointer-events:none}
.gm-bal-s{display:block;width:2px;height:54px;background:color-mix(in srgb,var(--ink) 40%,transparent);margin-top:8px;border-radius:2px;transform-origin:top;animation:gm-string 3.2s ease-in-out infinite;animation-delay:calc(var(--d) * -3)}
.gm-bal.pop .gm-bal-b{animation:gm-burst .3s forwards}
.gm-bal.pop .gm-bal-s{animation:gm-drop .6s forwards}
.gm-bal.no .gm-bal-b{animation:gm-shake .4s;filter:grayscale(.85);opacity:.45}
.gm-bal.no .gm-bal-s{opacity:.35}
.gm-bal.dim{opacity:.4;transition:opacity .3s}
.gm-bang{position:absolute;left:50%;top:36%;transform:translate(-50%,-50%);font-size:3rem;pointer-events:none;animation:gm-bang .55s forwards}
@keyframes gm-bang{0%{transform:translate(-50%,-50%) scale(.3)}50%{transform:translate(-50%,-50%) scale(1.3)}100%{transform:translate(-50%,-50%) scale(1.5);opacity:0}}
@keyframes gm-rise{from{transform:translateY(340px);opacity:.2}to{transform:none;opacity:1}}
@keyframes gm-sway{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-10px) rotate(3deg)}}
@keyframes gm-string{0%,100%{transform:rotate(3deg)}50%{transform:rotate(-3deg)}}
@keyframes gm-drop{to{transform:translateY(80px) rotate(30deg);opacity:0}}
.gm-reveal{position:absolute;left:10px;right:10px;top:10px;margin:0 auto;width:fit-content;max-width:calc(100% - 20px);text-align:center;z-index:4;background:#1f8a57;color:#fff;font-weight:900;font-size:1.15rem;line-height:1.2;border-radius:999px;padding:8px 18px;box-shadow:0 6px 16px rgba(0,0,0,.25);animation:gm-in .3s both;pointer-events:none}
.gm-dots{display:flex;gap:6px;justify-content:center;margin:12px 0 0;flex-wrap:wrap}
.gm-dots i{width:14px;height:14px;border-radius:50%;background:var(--line)}
.gm-dots i.ok{background:var(--ok)}.gm-dots i.meh{background:#FFCC00}.gm-dots i.now{outline:3px solid var(--brand);outline-offset:2px}
/* letras */
.gm-lt{background:var(--card);border:2px solid var(--line);border-radius:22px;box-shadow:var(--shadow);padding:18px 14px 20px;text-align:center;max-width:620px;margin:0 auto;position:relative}
.gm-lt-pic{width:132px;height:132px;margin:0 auto;border-radius:26px;background:var(--gm-tile);display:flex;align-items:center;justify-content:center;border:3px solid var(--line);box-shadow:0 5px 0 var(--line);animation:gm-in .4s both}
.gm-lt-pic img{width:80%;height:80%;object-fit:contain}
.gm-lt-es{font-size:1.5rem;font-weight:900;margin:10px 0 4px;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}
.gm-lt-es small{font-size:.95rem;color:var(--muted);font-weight:700}
.gm-art{display:inline-flex;align-items:center;gap:6px;background:var(--soft);border:2px dashed var(--brand);color:var(--brand);border-radius:999px;padding:3px 12px;font-weight:800;font-size:1rem}
.gm-slots{--n:5;display:flex;justify-content:center;gap:6px;margin:16px auto 16px;max-width:460px}
.gm-slot{flex:none;width:min(52px,calc((100% - (var(--n) - 1) * 6px) / var(--n)));aspect-ratio:1;border-radius:12px;border:3px dashed color-mix(in srgb,var(--muted) 45%,var(--line));background:var(--soft);font-size:clamp(1.1rem,5vw,1.6rem);font-weight:900;display:flex;align-items:center;justify-content:center;color:var(--ink);padding:0;transition:transform .15s}
.gm-slot.fill{border-style:solid;border-color:var(--brand);background:var(--card)}
.gm-slot.next{border-color:var(--brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 20%,transparent)}
.gm-slot.good{border-style:solid;border-color:var(--ok);background:color-mix(in srgb,var(--ok) 16%,var(--card));color:var(--ok-ink)}
.gm-slot.hint{border-style:solid;border-color:#FFCC00;background:color-mix(in srgb,#FFCC00 22%,var(--card));color:color-mix(in srgb,#A16A00 70%,var(--ink))}
.gm-slot.wrong{border-style:solid;border-color:var(--bad);color:var(--bad);animation:gm-shake .4s}
.gm-slot.win{animation:gm-hop .5s calc(var(--i) * 70ms) both}
.gm-slot.drop{transform:scale(1.12);border-color:var(--brand)}
@keyframes gm-hop{40%{transform:translateY(-12px)}}
.gm-tiles{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;min-height:58px;max-width:480px;margin:0 auto}
.gm-tile{width:54px;height:54px;border-radius:13px;border:0;background:linear-gradient(180deg,#FFE680,#FFCC00);color:#3D2B00;font-size:1.65rem;font-weight:900;box-shadow:0 5px 0 #B38F00,0 7px 10px rgba(0,0,0,.15);touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;transition:transform .1s;animation:gm-in .3s calc(var(--i) * 40ms) backwards}
.gm-tile:active{transform:translateY(3px);box-shadow:0 2px 0 #B38F00}
.gm-tile.used{visibility:hidden}
.gm-tile.drag{opacity:.3;animation:none}
.gm-ghost{position:fixed;z-index:1000;pointer-events:none;width:58px;height:58px;border-radius:13px;background:linear-gradient(180deg,#FFE680,#FFCC00);color:#3D2B00;font-size:1.75rem;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 24px rgba(0,0,0,.3);transform:translate(-50%,-60%) rotate(-6deg) scale(1.12)}
.gm-lt-acts{display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap}
.gm-lt-acts .btn{min-height:50px;font-weight:800;font-size:1.02rem;display:inline-flex;align-items:center;gap:6px;border-width:2px}
.gm-lt-ok{margin-top:14px;background:color-mix(in srgb,var(--ok) 15%,var(--card));color:var(--ok-ink);border-radius:16px;padding:12px;font-weight:800;font-size:1.15rem;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;animation:gm-in .3s both}
.gm-lt-ok span{color:var(--ink);font-weight:700}
.gm-lt-ok .gm-say{width:48px;height:48px;font-size:1.2rem}
.gm-lt.solved .gm-tiles,.gm-lt.solved .gm-lt-acts{display:none}
/* resultado */
.gm-end{position:relative;overflow:hidden;background:var(--card);border:2px solid var(--line);border-radius:26px;box-shadow:var(--shadow);padding:20px 16px 22px;text-align:center;max-width:580px;margin:0 auto}
.gm-end::before{content:"";position:absolute;left:0;right:0;top:0;height:132px;background-color:var(--gc);background-image:radial-gradient(rgba(255,255,255,.16) 2px,transparent 2.6px);background-size:18px 18px;z-index:0}
.gm-end>*{position:relative;z-index:1}
.gm-end-hero{display:inline-block;background:var(--card);border-radius:50%;padding:12px 18px 14px 14px;box-shadow:0 6px 18px rgba(0,0,0,.18);margin-top:20px;animation:gm-jump .9s ease-in-out 2}
@keyframes gm-jump{0%,100%{transform:translateY(0)}30%{transform:translateY(-18px) rotate(-5deg)}60%{transform:translateY(0) rotate(4deg)}}
.gm-end h1{margin:12px 0 0;font-size:1.9rem}
.gm-stars{font-size:3.1rem;letter-spacing:6px;line-height:1.2;margin:2px 0}
.gm-stars span{display:inline-block;color:color-mix(in srgb,var(--muted) 35%,var(--line))}
.gm-stars .on{color:#FFCC00;text-shadow:0 3px 0 #B38F00;-webkit-text-stroke:1px #B38F00;animation:gm-star .55s calc(var(--i) * .28s + .2s) both}
@keyframes gm-star{0%{transform:scale(0) rotate(-90deg);opacity:0}70%{transform:scale(1.35) rotate(10deg);opacity:1}100%{transform:none}}
.gm-end-l{font-size:1.15rem;font-weight:700;margin:4px 0 8px}
.gm-rec{display:inline-block;background:color-mix(in srgb,#FFCC00 24%,var(--card));border:2px solid #FFCC00;color:var(--ink);font-weight:800;border-radius:999px;padding:5px 14px;margin:0 4px 8px;animation:gm-bump .6s .8s both}
.gm-coins{display:inline-block;background:#FFCC00;color:#3D2B00;font-weight:900;font-size:1.45rem;padding:6px 20px;border-radius:999px;box-shadow:0 4px 0 #B38F00;margin:4px 0 6px;animation:gm-in .4s .9s both}
.gm-coins small{display:block;font-size:.75rem;font-weight:700}
.gm-wt{font-weight:800;color:var(--muted);margin:14px 0 8px;font-size:.95rem}
.gm-wl{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.gm-wc{display:inline-flex;align-items:center;gap:8px;min-height:50px;border:2px solid var(--line);background:var(--card);color:var(--ink);border-radius:14px;padding:4px 10px 4px 4px;text-align:left;font:inherit}
@media (hover:hover){.gm-wc:hover{border-color:var(--brand)}}
.gm-wc:active{transform:scale(.97)}
.gm-wc img{width:40px;height:40px;object-fit:contain;background:var(--gm-tile);border-radius:10px;padding:3px;flex:none}
.gm-wc b{display:block;line-height:1.15}
.gm-wc small{display:block;color:var(--muted);font-size:.8rem}
.gm-wc i{font-style:normal;font-size:.95rem;opacity:.8}
.gm-wc.gm-miss{border-color:color-mix(in srgb,#FFCC00 60%,var(--line))}
.gm-end-b{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px}
.gm-big{min-height:54px;font-size:1.12rem!important;padding:12px 24px!important;text-decoration:none;display:inline-flex;align-items:center;gap:8px;font-weight:800;border-width:2px}
@media (max-width:560px){
  .gm-name .t{display:none}
  .gm-name{font-size:1.6rem}
  .gm-pill{padding:5px 11px;font-size:.98rem}
  .gm-cards{gap:10px}
  .gm-card{min-height:166px;padding:14px 12px 12px}
  .gm-card .ge{font-size:2.6rem}
  .gm-card b{font-size:1.12rem}
  .gm-card small{font-size:.84rem}
  .gm-card .play{display:none}
  .gm-board{grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
  .gm-mc{aspect-ratio:1/1.08}
  .gm-catch{gap:8px;padding-left:12px}
  .gm-catch b{font-size:1.35rem}
  .gm-air{grid-template-columns:repeat(2,minmax(0,1fr));row-gap:2px;padding-top:22px}
  .gm-bal-b{width:min(116px,100%)}
  .gm-bal-s{height:30px}
  .gm-lt-pic{width:112px;height:112px}
  .gm-tile{width:50px;height:50px;font-size:1.5rem}
  .gm-end h1{font-size:1.6rem}
}
/* versión compacta cuando el juego no cabe en la pantalla (móviles bajitos) */
.gm-short .gm-top{margin-bottom:8px}
.gm-short .gm-tip{display:none}
.gm-short .gm-board{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.gm-short .gm-mc{aspect-ratio:4/5}
.gm-short .gm-mc-back span{font-size:1.6rem}
.gm-short .gm-listen{min-height:0;padding:8px 10px;gap:8px;margin-bottom:8px}
.gm-short .gm-bigsay{width:60px;height:60px;font-size:1.6rem}
.gm-short .gm-rbtn{height:48px;min-width:48px}
.gm-short .gm-ltxt{min-height:0;font-size:.95rem}
.gm-short .gm-air{grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;row-gap:0;padding:16px 4px 0;min-height:0}
.gm-short .gm-bal-b{width:min(92px,100%)}
.gm-short .gm-bal-s{height:20px;margin-top:6px}
.gm-short .gm-dots{margin-top:8px}
.gm-short .gm-lt{display:grid;grid-template-columns:auto 1fr;column-gap:12px;align-items:center;text-align:left;padding:12px 12px 14px}
.gm-short .gm-lt-pic{width:84px;height:84px;grid-row:span 2;border-radius:20px;box-shadow:0 4px 0 var(--line)}
.gm-short .gm-lt-es{justify-content:flex-start;margin:0;font-size:1.3rem;align-self:end}
.gm-short .gm-lt .count{align-self:start}
.gm-short .gm-slots,.gm-short .gm-tiles,.gm-short .gm-lt-acts,.gm-short #gm-fb{grid-column:1/-1}
.gm-short .gm-slots{width:100%;margin:12px 0 10px}
.gm-short .gm-tiles{width:100%}
.gm-short .gm-lt-acts{margin-top:10px}
.gm-short .gm-lt-acts .btn{min-height:46px}
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
  return `<div class="gm-top"><a class="gm-x" href="#/juegos" aria-label="Salir del juego" title="Salir">✕</a>
    <div class="gm-name" style="--gc:${GAMES[g].c}">${GAMES[g].e}<span class="t">${GAMES[g].t}</span></div>
    <div class="gm-stats">${stats}</div></div>`;
}
function bump(el){ if(!el) return; el.classList.remove("gm-bump"); void el.offsetWidth; el.classList.add("gm-bump"); }
/* vibración cortita en el móvil (si el aparato la tiene) */
function buzz(pat){ try{ if(navigator.vibrate) navigator.vibrate(pat); }catch(e){} }
/* pantallas bajitas (móvil pequeño, cabecera alta): si el juego no cabe, versión compacta .gm-short */
function autoFit(run, el, after){
  const chk = keep => {
    if(!live(run)) return;
    if(!keep) run.root.classList.remove("gm-short");
    if(el.isConnected && el.getBoundingClientRect().bottom + scrollY > innerHeight - 8) run.root.classList.add("gm-short");
    if(after) after();
  };
  const onR = () => chk(false);
  addEventListener("resize", onR); run.clean.push(() => removeEventListener("resize", onR));
  chk(false);
  return chk;
}
/* que cada palabra quepa en su carta sin partirse por la mitad */
function fitWords(root){
  root.querySelectorAll(".gm-mw").forEach(el => {
    const face = el.parentNode, maxW = face.clientWidth - 12, maxH = face.clientHeight - 12;
    if(maxW <= 0) return;
    if(!el.dataset.fs) el.dataset.fs = parseFloat(getComputedStyle(el).fontSize);
    let f = +el.dataset.fs, k = 0;
    el.style.overflowWrap = "normal"; el.style.hyphens = "manual"; el.style.fontSize = f + "px";
    while(k++ < 24 && f > 12 && (el.scrollWidth > maxW || el.offsetWidth > maxW || el.offsetHeight > maxH)){ f -= 1; el.style.fontSize = f + "px"; }
    if(el.scrollWidth > maxW || el.offsetWidth > maxW){ el.style.hyphens = "auto"; el.style.overflowWrap = "anywhere"; }
  });
}
function intro(run, g, go){
  if(!run.intro){ go(); return; }
  const tp = CUR_TP || topicId();
  run.root.insertAdjacentHTML("beforeend", `<div class="gm-intro" role="dialog" aria-modal="true" aria-label="${esc(GAMES[g].t)}">
    <div class="gm-intro-c" style="--gc:${GAMES[g].c}"><div class="gm-intro-e">${GAMES[g].e}</div><b>${esc(GAMES[g].t)}</b>
    <p>${esc(GAMES[g].how)}</p><div class="gm-intro-t">${esc(topicLabel(tp))} · ${esc(LANGS[lang].label)}</div><br>
    <button class="btn lc gm-go" style="--lc:${GAMES[g].c}">▶ ¡A jugar!</button>
    <a class="gm-intro-back" href="#/juegos">← Elegir otro juego</a></div></div>`);
  const ov = run.root.querySelector(".gm-intro"), b = ov.querySelector(".gm-go");
  /* la cabecera sigue visible y usable (idioma, inicio): la tarjeta se centra debajo de ella */
  try{ const hd = document.querySelector("header"); if(hd) ov.style.paddingTop = Math.max(16, Math.round(hd.getBoundingClientRect().bottom + 12)) + "px"; }catch(e){}
  let went = false;
  const goNow = () => {
    if(went || !live(run)) return; went = true;
    ov.remove(); snd("tap");
    /* iOS: la primera voz tiene que nacer de un toque */
    try{ if("speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance(" ")); }catch(e){}
    if(run.keys && document.onkeydown === run.keys){ document.onkeydown = null; run.keys = null; }
    go();
  };
  b.onclick = goNow;
  keys(run, e => {
    if(e.key === "Escape"){ e.preventDefault(); location.hash = "#/juegos"; return; }
    if((e.key === "Enter" || e.key === " ") && !(e.target.closest && e.target.closest("a"))){ e.preventDefault(); goNow(); }
  });
  try{ b.focus({preventScroll: true}); }catch(e){}
}

/* ---------- menú ---------- */
function bestTxt(g, b){
  if(!b || typeof b !== "object") return `<span>✨ ¡Pruébalo!</span>`;
  const n = v => Number.isFinite(+v) ? +v : 0;
  const rec = g === "memoria" ? (n(b.tries) ? `${n(b.tries)} intentos` : "récord") : g === "lluvia" ? `${n(b.score)} atrapadas` : g === "globos" ? `${n(b.score)} de 10` : `${n(b.score)} puntos`;
  return `<span>🏆 ${rec} <span class="st">${starsTxt(b.stars || 0)}</span></span>`;
}
async function menu(){
  const my = NAV, app = $("#app"), best = obj("games:best");
  const srsN = Object.keys(srsAll()).length;
  let tp = topicId(); if(tp === MIS && srsN < 8) tp = "animales";
  let showMore = !topicInfo(tp)[3];
  app.innerHTML = `<div class="gm gm-menu">
    <a class="back" href="#/">← Inicio</a>
    <div class="hello">${heroHtml(88)}<div class="speech"><b>¡A jugar! 🎮</b>Elige un juego. Cada partida te da 🪙 monedas.</div></div>
    <div class="gm-now" id="gm-now"></div>
    <div class="gm-cards">${Object.entries(GAMES).map(([id, g]) => `
      <a class="gm-card" href="#/juegos/${id}" style="--gc:${g.c}" aria-label="${esc(g.t)}: ${esc(g.sub)}">
        <span class="ge" aria-hidden="true">${g.e}</span><b>${esc(g.t)}</b><small>${esc(g.sub)}</small>
        <span class="gb">${bestTxt(id, best[id])}<span class="gc">🪙 hasta 15</span></span><span class="gd" aria-hidden="true">${g.e}</span><span class="play" aria-hidden="true">▶</span></a>`).join("")}</div>
    <div class="panel gm-tpanel" id="gm-tpanel"><h2>🧺 ¿Con qué palabras juegas?</h2>
      <div class="count">Elige un tema. Los juegos usarán sus dibujos y palabras en ${esc(nm())}.</div>
      <div class="gm-tps" id="gm-tps"></div>
      <div class="gm-prev" id="gm-prev"></div></div>
  </div>`;
  let misN = 0;
  const paintNow = () => { const n = $("#gm-now"); if(n) n.innerHTML = `Palabras: <b>${esc(topicLabel(tp))}</b> <button class="gm-chg" id="gm-chg">cambiar ↓</button>`;
    const c = $("#gm-chg"); if(c) c.onclick = e => { e.preventDefault(); $("#gm-tpanel").scrollIntoView({behavior: RM() ? "auto" : "smooth", block: "start"}); }; };
  const paintTps = () => {
    const box = $("#gm-tps"); if(!box) return;
    const chip = ([id, e, n]) => `<button class="gm-tp ${id === tp ? "on" : ""} ${id === MIS ? "mis" : ""}" data-tp="${id}" aria-pressed="${id === tp}"><span class="ti">${e}</span>${esc(n)}${id === MIS ? ` <small>(${misN})</small>` : ""}</button>`;
    const list = [...(misN >= 8 ? [[MIS, "⭐", "Mis palabras", 1]] : []), ...TOPICS.filter(t => t[3] || showMore || t[0] === tp)];
    box.innerHTML = list.map(chip).join("") + (showMore ? "" : `<button class="gm-tp more" id="gm-more">➕ Más temas</button>`);
  };
  const paintPrev = async () => {
    const want = tp, box = $("#gm-prev"); if(!box) return;
    let P = []; try{ P = await pool(want); }catch(e){}
    if(!here(my) || want !== tp || !box.isConnected) return;
    const s = shuffle(P).slice(0, 8);
    box.innerHTML = s.map((x, i) => `<span class="pi" style="animation-delay:${i * 40}ms" title="${esc(x.es)}">${imgTag(x)}</span>`).join("")
      + `<span class="pn">${P.length} palabras</span>`;
  };
  paintNow(); paintTps(); paintPrev();
  $("#gm-tps").onclick = e => {
    const b = e.target.closest("button"); if(!b) return;
    if(b.id === "gm-more"){ showMore = true; paintTps(); snd("tap"); return; }
    if(!b.dataset.tp || b.dataset.tp === tp) return;
    tp = b.dataset.tp; store.set("games:topic", tp); snd("pop");
    paintNow(); paintTps(); paintPrev();
  };
  /* «Mis palabras»: solo si hay al menos 8 con imagen en el repaso de este idioma */
  if(srsN >= 8){
    try{
      const P = await pool(MIS);
      if(!here(my)) return;
      misN = P.length;
      if(tp === MIS && misN < 8){ tp = "animales"; paintNow(); paintPrev(); }
      paintTps();
    }catch(e){}
  }
}

/* ---------- arranque de un juego ---------- */
async function play(g, withIntro){
  const my = NAV, app = $("#app");
  app.innerHTML = `<div class="gm"><p class="empty">Preparando el juego…</p></div>`;
  let tp = topicId(), P = [];
  if(tp === MIS && Object.keys(srsAll()).length < 8) tp = "animales";
  try{ P = await pool(tp); }catch(e){ P = []; }
  if(!here(my, g)) return;
  if(usable(g, P) < NEED[g] && tp !== "animales"){
    try{ P = await pool("animales"); }catch(e){ P = []; }
    if(!here(my, g)) return;
    toast(`${topicLabel(tp)} tiene pocas palabras para este juego. ¡Jugamos con 🐶 Animales!`);
    tp = "animales";
  }
  if(usable(g, P) < NEED[g]){
    app.innerHTML = `<div class="gm"><a class="back" href="#/juegos">← Juegos</a><p class="empty">No hay palabras para este juego todavía.</p></div>`;
    return;
  }
  CUR_TP = tp;
  ({memoria, lluvia, globos, letras})[g](app, P, withIntro);
}
function mount(app, html, withIntro){
  app.innerHTML = html;
  const run = begin(app.querySelector(".gm"));
  run.intro = !!withIntro;
  return run;
}

/* ---------- resultado ---------- */
function finish(run, g, o){
  if(!live(run)) return;
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
  award(coins, `¡${GAMES[g].t}!`);
  try{ logAct(1); }catch(e){}
  bus.emit("game-done", Object.assign({game: g, score: o.score, stars: o.stars}, g === "memoria" ? {tries: o.tries} : {}));
  const title = o.stars === 3 ? "¡Increíble!" : o.stars === 2 ? "¡Muy bien!" : "¡Bien hecho!";
  const words = (o.words || []).slice(0, 10);
  run.root.innerHTML = `<div class="gm-end" style="--gc:${GAMES[g].c}">
    <div class="gm-end-hero">${heroHtml(92)}</div>
    <h1>${title}</h1>
    <div class="gm-stars" aria-label="${o.stars} estrellas de 3">${[1, 2, 3].map(i => `<span class="${i <= o.stars ? "on" : ""}" style="--i:${i}">★</span>`).join("")}</div>
    <p class="gm-end-l">${o.line}</p>
    ${better && prev ? `<div class="gm-rec">🏆 ¡Nuevo récord!</div>` : !prev ? `<div class="gm-rec">🏆 ¡Tu primer récord!</div>` : ""}
    <div><div class="gm-coins">+${coins} 🪙${D.n > 8 ? `<small>¡Hoy ya jugaste mucho!</small>` : ""}</div></div>
    ${words.length ? `<div class="gm-wt">Palabras del juego · toca para oírlas</div>
    <div class="gm-wl">${words.map(w => `<button class="gm-wc ${w.miss ? "gm-miss" : ""}" data-say="${esc(w.word)}" aria-label="Escuchar ${esc(w.word)}">${imgTag(w)}<span><b>${esc(w.word)}</b><small>${esc(w.es)}</small></span><i>🔊</i></button>`).join("")}</div>` : ""}
    <div class="gm-end-b"><button class="btn lc gm-big" id="gm-again" style="--lc:${GAMES[g].c}">🔁 Otra vez</button>
      <a class="btn gm-big" href="#/juegos">🎮 Menú</a></div></div>`;
  window.scrollTo(0, 0);
  /* el resultado es una fase nueva: limpia lo del juego y deja solo sus propios temporizadores */
  run.timers.forEach(clearTimeout); run.timers = [];
  if(run.raf){ cancelAnimationFrame(run.raf); run.raf = 0; }
  run.clean.forEach(f => { try{ f(); }catch(e){} }); run.clean = [];
  document.querySelectorAll(".gm-ghost").forEach(x => x.remove());
  playMark(null);
  snd("fanfare");
  later(run, () => boom(o.stars === 3 ? {emoji: "⭐", n: 46} : {n: 90}), 250);
  if(!RM()) for(let i = 1; i <= o.stars; i++) later(run, () => snd("pop"), 200 + i * 280);
  const again = () => { snd("tap"); play(g, false); };
  $("#gm-again").onclick = again;
  keys(run, e => { if(e.key === "Enter" && !(e.target.closest && e.target.closest("a,button:not(#gm-again)"))){ e.preventDefault(); again(); } });
}

/* =====================================================================
   1. MEMORIA — 6 parejas dibujo ↔ palabra
   ===================================================================== */
function memoria(app, P, withIntro){
  const items = shuffle(P).slice(0, 6), N = items.length;
  const cards = shuffle(items.flatMap((it, i) => [{i, kind: "img", it}, {i, kind: "word", it}]));
  preload(items);
  const run = mount(app, `<div class="gm gm-mem" style="--gc:${GAMES.memoria.c}">
    ${topHtml("memoria", `<span class="gm-pill" title="Intentos">🔁 <b id="gm-tries">0</b></span><span class="gm-pill" title="Parejas">✅ <span><b id="gm-pairs">0</b>/${N}</span></span>`)}
    <div class="gm-board" id="gm-board">${cards.map((c, k) => `
      <button class="gm-mc" data-k="${k}" aria-label="Carta tapada">
        <span class="gm-mc-in"><span class="gm-mc-f gm-mc-back" aria-hidden="true"><span>?</span></span>
        <span class="gm-mc-f gm-mc-face k-${c.kind}">${c.kind === "img" ? imgTag(c.it) : `<span class="gm-mw" lang="${LANGS[lang].code}" style="font-size:${fs(c.it.word)}">${esc(c.it.word)}</span>`}</span></span></button>`).join("")}</div>
    <p class="gm-tip">Busca cada dibujo con su palabra en ${esc(nm())}.</p></div>`, withIntro);
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
      pairs++; upd(); answer(true, c.it);
      speak(c.it.word);
      later(run, () => { a.classList.add("ok"); b.classList.add("ok"); snd("ok"); boomAt(b, 16); a.disabled = b.disabled = true; bump($("#gm-pairs") && $("#gm-pairs").parentNode); }, 380);
      if(pairs === N) later(run, () => {
        const stars = tries <= N + 3 ? 3 : tries <= N + 7 ? 2 : 1;
        finish(run, "memoria", {score: Math.max(10, 100 - (tries - N) * 6), tries, stars,
          line: `¡Encontraste las ${N} parejas en ${tries} intentos!`, words: items.map(it => Object.assign({miss: misses.has(it.k)}, it))});
      }, 1500);
    } else {
      lock = true; misses.add(ca.it.k); misses.add(c.it.k); answer(false, c.it);
      later(run, () => buzz(40), 520);
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
  autoFit(run, board, () => fitWords(board));
  intro(run, "memoria", () => { started = true; });
}

/* =====================================================================
   2. LLUVIA DE PALABRAS — atrapa las burbujas de la palabra pedida
   ===================================================================== */
function lluvia(app, P, withIntro){
  const DUR = 60, LIVES = 3;
  preload(P.slice(0, 40));
  const run = mount(app, `<div class="gm gm-rain" style="--gc:${GAMES.lluvia.c}">
    ${topHtml("lluvia", `<span class="gm-pill gm-lives" id="gm-lives" aria-label="Vidas">${"<i>❤️</i>".repeat(LIVES)}</span><span class="gm-pill" title="Atrapadas">⭐ <b id="gm-sc">0</b></span>`)}
    <div class="gm-catch"><span class="gm-catch-l">Atrapa:</span><b id="gm-tg">…</b><button class="gm-say" id="gm-say" aria-label="Escuchar la palabra" title="Escuchar">🔊</button></div>
    <div class="gm-tbar" id="gm-tbar"><i id="gm-tb"></i></div>
    <div class="gm-sky" id="gm-sky"><span class="gm-cl c1">☁️</span><span class="gm-cl c2">☁️</span><span class="gm-cl c3">☁️</span></div>
    <p class="gm-tip">Toca la burbuja que dice lo mismo en ${esc(nm())}.</p></div>`, withIntro);
  const sky = run.root.querySelector("#gm-sky"), tb = run.root.querySelector("#gm-tb");
  let W = sky.clientWidth, H = sky.clientHeight;
  /* el cielo cabe entero en la pantalla (en móviles bajitos no se sale por abajo) */
  const fit = () => {
    const top = sky.getBoundingClientRect().top + scrollY;
    const avail = Math.round(innerHeight - top - 14);
    sky.style.height = Math.max(280, Math.min(540, avail)) + "px";
  };
  const onResize = () => { fit(); W = sky.clientWidth; H = sky.clientHeight; };
  addEventListener("resize", onResize); run.clean.push(() => removeEventListener("resize", onResize));
  onResize();
  const BS = () => W < 480 ? 80 : 100;
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
    const bs = BS(), bw = bs + 28, lanes = Math.max(3, Math.floor(W / (bw + 6))), laneW = W / lanes;
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
    el.addEventListener("pointerdown", e => { e.preventDefault(); hit(b); });
    el.addEventListener("click", e => { if(e.detail === 0) hit(b); });
    sky.appendChild(el); bubbles.push(b);
  }
  function floatTxt(b, txt, bad){
    const f = document.createElement("div"); f.className = "gm-float" + (bad ? " bad" : "");
    f.textContent = txt; f.style.left = (b.x + (BS() + 28) / 2) + "px"; f.style.top = Math.max(10, b.y) + "px";
    sky.appendChild(f); later(run, () => f.remove(), 1000);
  }
  function hit(b){
    if(b.dead || ended || !running || !live(run)) return;
    if(b.it === target){
      b.dead = true; b.el.classList.add("pop"); score++; streak++; buzz(15); answer(true, b.it);
      got.push(b.it);
      snd("pop"); later(run, () => snd("ok"), 90);
      const r = b.el.getBoundingClientRect(); boom({n: 16, x: r.left + r.width / 2, y: r.top + BS() / 2});
      floatTxt(b, streak >= 3 ? `+1 · ¡racha ${streak}! 🔥` : `+1 ${b.it.word}`);
      const sc = $("#gm-sc"); if(sc){ sc.textContent = score; bump(sc.parentNode); }
      const el = b.el; later(run, () => el.remove(), 340);
      setTarget();
    } else {
      b.dead = true; b.el.classList.add("bad"); lives--; streak = 0; answer(false, target);
      missed.add(target.k); snd("bad"); buzz([50, 40, 50]);
      floatTxt(b, `✗ ${b.it.es}`, true);
      const L = $("#gm-lives");
      if(L){ const hs = L.querySelectorAll("i"); const h = hs[lives]; if(h){ h.classList.add("lost", "hurt"); } }
      const el = b.el; later(run, () => { el.classList.add("gone"); }, 380); later(run, () => el.remove(), 800);
      if(lives <= 0) end(false);
    }
  }
  function end(timeUp){
    if(ended) return; ended = true; running = false;
    if(run.raf){ cancelAnimationFrame(run.raf); run.raf = 0; }
    bubbles.forEach(b => { b.el.disabled = true; });
    sky.insertAdjacentHTML("beforeend", `<div class="gm-over"><span>${timeUp ? "⏰" : "💔"}</span>${timeUp ? "¡Se acabó el tiempo!" : "¡Sin vidas!"}</div>`);
    snd(timeUp ? "whoosh" : "bad");
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
    if(running && !document.hidden){
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
function globos(app, P, withIntro){
  const R = 10;
  let order = [];
  while(order.length < R){ const s = shuffle(P); if(order.length && s[0] === order[order.length - 1]) s.push(s.shift()); order.push(...s); }
  order = order.slice(0, R);
  preload(P.slice(0, 40));
  const run = mount(app, `<div class="gm gm-bal-g" style="--gc:${GAMES.globos.c}">
    ${topHtml("globos", `<span class="gm-pill" title="Ronda">🎈 <span><b id="gm-rd">1</b>/${R}</span></span><span class="gm-pill" title="Aciertos">⭐ <b id="gm-sc">0</b></span>`)}
    <div class="gm-listen" id="gm-listen">
      <button class="gm-bigsay" id="gm-play" aria-label="Escuchar la palabra" title="Escuchar">🔊</button>
      <button class="gm-rbtn" id="gm-slow" aria-label="Escuchar despacio" title="Despacio">🐢</button>
      <button class="gm-rbtn" id="gm-peek" aria-label="Ver la palabra escrita" title="Ver la palabra">👀</button>
      <div class="gm-ltxt" id="gm-ltxt">Escucha y toca el globo correcto</div>
    </div>
    <div class="gm-air" id="gm-air"></div>
    <div class="gm-dots" id="gm-dots">${order.map(() => "<i></i>").join("")}</div></div>`, withIntro);
  const air = run.root.querySelector("#gm-air");
  let r = 0, score = 0, first = true, busy = true, cur = null, opts = [], fitG = null;
  const res = [];
  const dots = () => { const ds = run.root.querySelectorAll("#gm-dots i"); ds.forEach((d, i) => { d.className = i < res.length ? (res[i] ? "ok" : "meh") : i === r ? "now" : ""; }); };
  function round(){
    cur = order[r]; first = true; busy = false;
    const others = shuffle(P.filter(x => x !== cur && x.img !== cur.img)).slice(0, 3);
    opts = shuffle([cur, ...others]);
    const cols = shuffle(BALLOONS);
    air.innerHTML = opts.map((o, k) => `<button class="gm-bal" data-k="${k}" style="--bc:${cols[k]};--d:${k * 110}ms" aria-label="Globo ${k + 1}: ${esc(o.es)}">
      <span class="gm-bal-b"><span class="gm-bal-i">${imgTag(o)}</span></span><span class="gm-bal-s"></span></button>`).join("");
    const rd = $("#gm-rd"); if(rd) rd.textContent = r + 1;
    const lt = $("#gm-ltxt"); if(lt) lt.innerHTML = "Escucha y toca el globo correcto";
    if(fitG) fitG(true);
    dots();
    const pl = $("#gm-play"); if(pl){ pl.classList.remove("ring"); void pl.offsetWidth; pl.classList.add("ring"); }
    later(run, () => speak(cur.word), 700);
  }
  air.onclick = e => {
    const b = e.target.closest(".gm-bal"); if(!b || busy || b.disabled || !live(run)) return;
    const o = opts[+b.dataset.k];
    if(o === cur){
      busy = true; if(first){ score++; answer(true, cur); } res.push(first); buzz(20);
      b.classList.add("pop"); b.insertAdjacentHTML("beforeend", `<span class="gm-bang" aria-hidden="true">💥</span>`);
      snd("pop"); later(run, () => snd("ok"), 120);
      boomAt(b.querySelector(".gm-bal-b"), 22);
      air.querySelectorAll(".gm-bal").forEach(x => { if(x !== b){ x.disabled = true; x.classList.add("dim"); } });
      air.insertAdjacentHTML("beforeend", `<div class="gm-reveal">${first ? "¡Sí! " : ""}${esc(cur.word)} = ${esc(cur.es)}</div>`);
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
      if(first) answer(false, cur);
      first = false; b.disabled = true; b.classList.add("no"); snd("bad"); buzz([50, 40, 50]);
      const lt = $("#gm-ltxt"); if(lt) lt.innerHTML = `Ese es <b style="font-size:1.1rem;color:var(--ink)">${esc(o.es)}</b>. ¡Escucha otra vez!`;
      later(run, () => speak(cur.word), 450);
    }
  };
  $("#gm-play").onclick = () => { if(cur) speak(cur.word); };
  $("#gm-slow").onclick = () => { if(cur) speak(cur.word, true); };
  $("#gm-peek").onclick = () => { if(!cur) return; const lt = $("#gm-ltxt"); if(lt) lt.innerHTML = `La palabra es: <b>${esc(cur.word)}</b>`; speak(cur.word); };
  fitG = autoFit(run, run.root.querySelector("#gm-dots"));
  intro(run, "globos", round);
}

/* =====================================================================
   4. LETRAS LOCAS — ordena las letras de la palabra (sin artículo)
   ===================================================================== */
function letras(app, P, withIntro){
  const cand = shuffle(P.map(it => ({it, x: letrasOf(it)})).filter(o => o.x));
  const list = cand.slice(0, 5).sort((a, b) => [...a.x.base].length - [...b.x.base].length);
  const NW = list.length;
  preload(list.map(o => o.it));
  const run = mount(app, `<div class="gm gm-let" style="--gc:${GAMES.letras.c}">
    ${topHtml("letras", `<span class="gm-pill" title="Palabra">🔤 <span><b id="gm-wn">1</b>/${NW}</span></span><span class="gm-pill" title="Puntos">⭐ <b id="gm-sc">0</b></span>`)}
    <div class="gm-lt" id="gm-lt"></div>
    <div class="gm-dots" id="gm-dots">${list.map(() => "<i></i>").join("")}</div></div>`, withIntro);
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
      <div class="count">¿Cómo se escribe en ${esc(nm())}? ${ans.length} letras</div>
      <div class="gm-slots" id="gm-slots" style="--n:${ans.length}">${ans.map((_, i) => `<button class="gm-slot" data-s="${i}" aria-label="Hueco ${i + 1}"></button>`).join("")}</div>
      <div class="gm-tiles" id="gm-tiles">${S.tiles.map((t, i) => `<button class="gm-tile" data-t="${i}" style="--i:${i}" aria-label="Letra ${esc(t.ch)}">${esc(t.ch)}</button>`).join("")}</div>
      <div class="gm-lt-acts" id="gm-acts">
        <button class="btn" id="gm-hint">💡 Pista</button>
        <button class="btn" id="gm-del">⌫ Borrar</button>
        <button class="btn" id="gm-hear" aria-label="Escuchar la palabra">🔊 Oír</button></div>
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
      const pts = Math.max(1, 3 - Math.min(2, S.hints + S.errs));
      total += pts; res.push(pts);
      S.lock = S.lock.map(() => "good"); paint();
      els.forEach((el, i) => { el.style.setProperty("--i", i); el.classList.add("win"); });
      snd("ok"); boomAt(box.querySelector("#gm-slots"), 30);
      speak(S.it.word);
      const sc = $("#gm-sc"); if(sc){ sc.textContent = total; bump(sc.parentNode); }
      paintDots();
      const last = w + 1 >= NW;
      box.classList.add("solved");
      $("#gm-fb").innerHTML = `<div class="gm-lt-ok">${pts === 3 ? "¡Perfecto! 🎉" : "¡Muy bien! 👍"} <span>${esc(S.it.word)} = ${esc(S.it.es)}</span>
        <button class="gm-say" id="gm-again-say" aria-label="Escuchar otra vez">🔊</button>
        <button class="btn lc" id="gm-next" style="--lc:${GAMES.letras.c};min-height:48px">${last ? "Ver premio 🏆" : "Siguiente →"}</button></div>`;
      $("#gm-again-say").onclick = () => speak(S.it.word);
      const myW = w, nx = () => { if(!live(run) || w !== myW) return; next(); };
      $("#gm-next").onclick = nx;
      later(run, nx, 2600);
    } else {
      S.errs++; snd("bad"); S.busy = true; buzz([50, 40, 50]); if(S.errs === 1) answer(false, S.it);
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
      el.addEventListener("pointerdown", e => {
        if(!started || S.done || S.busy || S.tiles[ti].at >= 0) return;
        e.preventDefault();
        const x0 = e.clientX, y0 = e.clientY; let ghost = null, over = null;
        try{ el.setPointerCapture(e.pointerId); }catch(err){}
        const mv = ev => {
          if(!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10){
            ghost = document.createElement("div"); ghost.className = "gm-ghost"; ghost.textContent = S.tiles[ti].ch;
            document.body.appendChild(ghost); el.classList.add("drag");
          }
          if(ghost){
            ghost.style.left = ev.clientX + "px"; ghost.style.top = ev.clientY + "px";
            const t = document.elementFromPoint(ev.clientX, ev.clientY), s = t && t.closest && t.closest(".gm-slot");
            if(over && over !== s) over.classList.remove("drop");
            over = s && box.contains(s) ? s : null; if(over) over.classList.add("drop");
          }
        };
        const up = ev => {
          el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
          if(over) over.classList.remove("drop");
          if(ghost){
            ghost.remove(); el.classList.remove("drag");
            if(ev.type === "pointerup" && over) place(ti, +over.dataset.s);
          } else if(ev.type === "pointerup") place(ti);
        };
        el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
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
  fitL = autoFit(run, box);
  intro(run, "letras", () => { started = true; keys(run, kb); });
}

/* ---------- conexión con la app ---------- */
ROUTES["juegos"] = async parts => {
  NAV++; stop(); css();
  const g = parts[0];
  if(GAMES[g]) await play(g, true);
  else await menu();
};
HOME_ACTS.push({href: "#/juegos", e: "🎮", t: "Juegos", sub: "Aprende jugando", color: "#22409a"});
})();
