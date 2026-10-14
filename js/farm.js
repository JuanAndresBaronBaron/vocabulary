/* Módulo farm: granja viva e interactiva (#/granja).
   index.html llama a farmMount(host) al pintar la página de la granja.
   - Escenario con cielo según la hora (amanecer, día, atardecer, noche), nubes, sol/luna, estrellas y luciérnagas.
   - Objetos comprados en la tienda: se arrastran (ratón o dedo) y la posición se guarda.
   - Animales que pasean, tienen hambre (reto de vocabulario para darles de comer) y dan productos.
   - Plantas que crecen con la regadera y se cosechan; árboles que dan fruta o nidos.
   - Edificios con sorpresa (cohete, tractor, fuente, castillo, casa, cabaña, tienda).
   - Juego «¿Dónde está…?».
   Estado: store "farm:state". Emite: farm-feed {item}, farm-harvest {item}, farm-collect {product}, farm-find {ok}. */
function farmMount(host){ return farmMount._mount ? farmMount._mount(host) : null; }
farmMount.debug = {phase: null};   /* pruebas: "dawn" | "day" | "dusk" | "night" fuerza la hora del cielo */

(() => {
"use strict";

/* ---------- datos ---------- */
const KEY = "farm:state", HOUR = 36e5;
const HUNGER = 3 * HOUR, WATER = 2 * HOUR, TREE_T = 3 * HOUR, MAX_DROPS = 12, ROUNDS = 5, FIND_PAID = 5;
const G = {x0: 5, x1: 95, y0: 58, y1: 95};   /* suelo, en % del escenario (punto de apoyo de cada cosa) */

/* p: producto · sp: velocidad (px/s) · r: radio de paseo (%) */
const ANIM = {
  gallina: {p: "huevo", sp: 26, r: 10, idle: "peck"},
  pato:    {p: "huevo", sp: 24, r: 11, idle: "peck"},
  conejo:  {p: "abono", sp: 34, r: 12, hop: true},
  abeja:   {p: "miel",  sp: 44, r: 18, fly: true},
  cerdo:   {p: "trufa", sp: 20, r: 10},
  oveja:   {p: "lana",  sp: 18, r: 9},
  cabra:   {p: "queso", sp: 22, r: 11, idle: "hop"},
  pavo:    {p: "pluma", sp: 20, r: 9, idle: "peck"},
  vaca:    {p: "leche", sp: 15, r: 8, moo: true},
  burro:   {p: "abono", sp: 17, r: 9},
  caballo: {p: "abono", sp: 30, r: 13},
};
/* monedas al cosechar (0 = árbol: no se cosecha, da productos) */
const PLANT = {flor: 3, girasol: 3, seta: 3, zanahoria: 4, fresa: 4, maiz: 4, calabaza: 5, trigo: 4, manzana: 4, arbol: 0, pino: 0};
const TREE = {arbol: "pera", pino: "nido"};
const BUILD = {tienda: "camp", cabana: "smoke", casa: "light", tractor: "drive", fuente: "spray", castillo: "fire", cohete: "launch"};
const BIG = new Set(["tienda", "cabana", "casa", "tractor", "fuente", "castillo", "cohete", "molino"]);
/* hacia dónde mira el emoji sin voltear: 1 = izquierda, -1 = derecha */
const FACE = {oveja: -1, caballo: -1, tractor: -1};

/* productos: francés con artículo, danés con en/et */
const PROD = {
  huevo: {e: "🥚", n: "un huevo",  c: 3, w: {english: "egg",     "français": "l'œuf (m.)", dansk: "et æg"}},
  pluma: {e: "🪶", n: "una pluma", c: 3, w: {english: "feather", "français": "la plume",   dansk: "en fjer"}},
  abono: {e: "💩", n: "abono",     c: 3, w: {english: "manure",  "français": "le fumier",  dansk: "en gødning"}},
  miel:  {e: "🍯", n: "miel",      c: 5, w: {english: "honey",   "français": "le miel",    dansk: "en honning"}},
  trufa: {e: "🍄", n: "una trufa", c: 6, w: {english: "truffle", "français": "la truffe",  dansk: "en trøffel"}},
  lana:  {e: "🧶", n: "lana",      c: 4, w: {english: "wool",    "français": "la laine",   dansk: "en uld"}},
  queso: {e: "🧀", n: "queso",     c: 5, w: {english: "cheese",  "français": "le fromage", dansk: "en ost"}},
  leche: {e: "🥛", n: "leche",     c: 4, w: {english: "milk",    "français": "le lait",    dansk: "en mælk"}},
  pera:  {e: "🍐", n: "una pera",  c: 4, w: {english: "pear",    "français": "la poire",   dansk: "en pære"}},
  nido:  {e: "🪺", n: "un nido",   c: 5, w: {english: "nest",    "français": "le nid",     dansk: "en rede"}},
};
/* palabras del cielo */
const SKYW = {
  sol:      {e: "☀️", n: "sol",      w: {english: "sun",       "français": "le soleil",    dansk: "en sol"}},
  luna:     {e: "🌙", n: "luna",     w: {english: "moon",      "français": "la lune",      dansk: "en måne"}},
  nube:     {e: "☁️", n: "nube",     w: {english: "cloud",     "français": "le nuage",     dansk: "en sky"}},
  estrella: {e: "⭐", n: "estrella", w: {english: "star",      "français": "l'étoile (f.)", dansk: "en stjerne"}},
  mariposa: {e: "🦋", n: "mariposa", w: {english: "butterfly", "français": "le papillon",  dansk: "en sommerfugl"}},
};
const GREET = {
  dawn:  {es: "¡Buenos días!",    english: "Good morning!", "français": "Bonjour !", dansk: "Godmorgen!"},
  day:   {es: "¡Hola!",           english: "Hello!",        "français": "Salut !",   dansk: "Hej!"},
  dusk:  {es: "¡Buenas tardes!",  english: "Good evening!", "français": "Bonsoir !", dansk: "God aften!"},
  night: {es: "¡Buenas noches!",  english: "Good night!",   "français": "Bonne nuit !", dansk: "Godnat!"},
};

/* ---------- utilidades ---------- */
const now = () => Date.now();
const RM = () => { try{ return matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10;
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const pick = a => a[Math.floor(Math.random() * a.length)];
const play = n => { try{ if(typeof sfx !== "undefined") sfx.play(n); }catch(e){} };
const speak = t => { try{ if(t && "speechSynthesis" in window) say(t); }catch(e){} };
const emit = (e, d) => { try{ bus.emit(e, d); }catch(err){} };
const okPos = p => !!p && typeof p === "object" && isFinite(p.x) && isFinite(p.y);
const kindOf = id => ANIM[id] ? "animal" : PLANT[id] !== undefined ? "plant" : BUILD[id] ? "build" : "deco";
const owned = () => { const g = game(); return SHOP.filter(x => x.t === "farm" && g.owned[x.id]); };
const iw = it => itemWord(it);
const pw = p => (p.w && p.w[lang]) || p.n;
/* emoji de un producto (🧶 sale magenta en algunas fuentes: lo pintamos como lana blanca) */
const pe = pid => `<span class="fm-pe fm-pe-${pid}">${PROD[pid].e}</span>`;
function fmtLeft(ms){
  const m = Math.max(1, Math.ceil(ms / 60000)); if(m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r} min` : `${h} h`;
}
function phase(){
  const f = farmMount.debug && farmMount.debug.phase;
  if(["dawn", "day", "dusk", "night"].includes(f)) return f;
  const h = hourNow();
  return h < 6 || h >= 21 ? "night" : h < 8.5 ? "dawn" : h < 18.5 ? "day" : "dusk";
}
function hourNow(){
  const f = farmMount.debug && farmMount.debug.phase;
  if(f) return {dawn: 7.2, day: 12.5, dusk: 19.6, night: 23.5}[f] || 12;
  const d = new Date(); return d.getHours() + d.getMinutes() / 60;
}

/* ---------- estado ---------- */
const DEF = () => ({welcome: false, pos: {}, fed: {}, prod: {}, pl: {}, tree: {}, seen: {}, drops: 0, dn: 0, hero: null, light: true, fd: {day: "", n: 0}});
function load(){
  let s = store.get(KEY, null); if(!s || typeof s !== "object" || Array.isArray(s)) s = {};
  const d = DEF();
  for(const k of Object.keys(d)){
    const dv = d[k], v = s[k];
    if(v === undefined || (dv && typeof dv === "object" && (!v || typeof v !== "object"))) s[k] = dv;
  }
  if(typeof s.drops !== "number" || !isFinite(s.drops)) s.drops = 0;
  if(typeof s.dn !== "number" || !isFinite(s.dn)) s.dn = 0;
  return s;
}
const save = s => store.set(KEY, s);

/* sitio libre para una cosa nueva */
function spot(id, pos, y0){
  const k = kindOf(id), big = BIG.has(id) || TREE[id];
  /* bandas pensadas para un suelo de 58 % a 95 %; con más suelo (granja llena) se estiran */
  const f = y => (y0 || G.y0) + (y - G.y0) * (G.y1 - (y0 || G.y0)) / (G.y1 - G.y0);
  const band = (big ? [60, 69] : k === "plant" ? [78, 93] : [68, 88]).map(f);
  /* se compara el centro de cada cosa (las grandes suben más desde su punto de apoyo) */
  const mid = (o, k) => ({x: o.x, y: o.y - (BIG.has(k) || TREE[k] ? 9 : 5)});
  const others = Object.entries(pos).filter(([, o]) => okPos(o)).map(([k, o]) => mid(o, k));
  let best = null, bd = -1;
  for(let i = 0; i < 80; i++){
    const c = {x: rnd(8, 92), y: rnd(band[0], band[1])}, m = mid(c, id);
    const d = others.length ? Math.min(...others.map(o => Math.hypot(o.x - m.x, (o.y - m.y) * 1.6))) : 99;
    if(d > bd){ bd = d; best = c; }
  }
  return {x: r1(best.x), y: r1(best.y)};
}

/* el regalo de bienvenida ya está en la granja: actualiza las tarjetas de la tienda ya pintadas */
function patchShop(ids){
  ids.forEach(id => {
    const it = itemById(id); if(!it) return;
    document.querySelectorAll(".shop .sc").forEach(sc => {
      const n = sc.querySelector(".sn"), e = sc.querySelector(".se");
      if(!n || !e || n.textContent !== it.n || e.textContent !== it.e) return;
      sc.classList.add("own");
      sc.querySelectorAll(".btn.buy, .miss").forEach(x => x.remove());
      if(!sc.querySelector(".own")){ const o = document.createElement("span"); o.className = "own"; o.textContent = "✓ En tu granja"; sc.appendChild(o); }
    });
  });
}

/* ---------- conexión con la app ---------- */
let cur = null;          /* granja montada ahora */
const live = {};         /* posición actual de cada animal (se conserva entre repintados) */
function addDrops(n){
  if(cur && cur.alive()) return cur.addDrops(n);
  const s = load(), before = s.drops || 0;
  s.drops = Math.min(MAX_DROPS, before + n); s.dn = Math.min(MAX_DROPS, (s.dn || 0) + (s.drops - before)); save(s);
}
bus.on("lesson-done", () => addDrops(3));
bus.on("review-done", () => addDrops(2));
bus.on("game-done", () => addDrops(1));
bus.on("route", d => { if(cur && !(cur.host.isConnected && String((d && d.h) || "").startsWith("granja"))) cur.stop(); });
/* el número de monedas de la cabecera de la página de la granja lo pinta index.html una vez: lo mantenemos al día */
bus.on("coins", () => { if(!cur || !cur.alive()) return; const b = document.querySelector(".me-coins b"); if(b) b.textContent = game().coins; });

/* ---------- montaje ---------- */
function mount(host){
  if(cur) cur.stop();
  if(!host) return null;
  css();

  /* temporizadores: todos se paran al salir de la página */
  const T = new Set(), I = new Set();
  let alive = true;
  const isOn = () => alive && host.isConnected;
  const later = (fn, ms) => { const t = setTimeout(() => { T.delete(t); if(isOn()) fn(); else stop(); }, ms); T.add(t); return t; };
  const cancel = t => { if(t){ clearTimeout(t); T.delete(t); } };
  const every = (fn, ms) => { const t = setInterval(() => { if(isOn()) fn(); else stop(); }, ms); I.add(t); return t; };
  function stop(){
    if(!alive) return; alive = false;
    T.forEach(clearTimeout); I.forEach(clearInterval); T.clear(); I.clear();
    window.removeEventListener("resize", onResize);
    try{ host.querySelectorAll("dialog[open]").forEach(d => d.close()); }catch(e){}
    if(cur === api) cur = null;
  }
  const api = {host, stop, alive: isOn, addDrops: n => { const b = s.drops || 0; upd(st => st.drops = Math.min(MAX_DROPS, b + n)); bar(); }};
  cur = api;

  /* estado + regalo de bienvenida */
  const s = load();
  const upd = f => { f(s); save(s); };
  const first = !s.welcome; let gifted = false;
  if(first && !owned().length){
    const g = game(); g.owned.gallina = true; g.owned.flor = true; gameSet(g); gifted = true;
    patchShop(["gallina", "flor"]);
  }
  const items = owned(), fresh = [];
  const narrow = matchMedia("(max-width:560px)").matches;
  const crowd = items.length > (narrow ? 9 : 16);
  const HZ = crowd ? 40 : 50;                                   /* horizonte (% desde arriba) */
  const GR = {x0: G.x0, x1: G.x1, y0: HZ + 8, y1: G.y1};       /* suelo donde se apoyan las cosas */
  if(s.lay !== GR.y0){                                          /* cambia el suelo: se reparte lo que ya había */
    const o = typeof s.lay === "number" ? s.lay : G.y0, m = y => r1(GR.y0 + (y - o) * (GR.y1 - GR.y0) / (GR.y1 - o));
    for(const k of Object.keys(s.pos)) if(okPos(s.pos[k])) s.pos[k].y = m(s.pos[k].y);
    if(okPos(s.hero)) s.hero.y = m(s.hero.y);
    for(const k of Object.keys(s.prod)) if(okPos(s.prod[k])) s.prod[k].y = m(s.prod[k].y);
    for(const k of Object.keys(live)) if(okPos(live[k])) live[k].y = m(live[k].y);
    s.lay = GR.y0;
  }
  /* la bienvenida queda pendiente hasta que se ve (si cambia de idioma o de página antes, sale al volver) */
  if(first) s.wpend = gifted ? "gift" : "live";
  s.welcome = true;
  for(const it of items){
    const id = it.id, k = kindOf(id);
    if(!s.seen[id]){ s.seen[id] = now(); fresh.push(id); }
    if(k === "animal" && typeof s.fed[id] !== "number") s.fed[id] = 0;                       /* recién llegado: con hambre */
    if(k === "plant" && (!s.pl[id] || typeof s.pl[id] !== "object")) s.pl[id] = {s: first && !gifted ? 2 : 1, w: 0};
    if(!okPos(s.pos[id])) s.pos[id] = spot(id, s.pos, GR.y0);
    s.pos[id] = {x: clamp(s.pos[id].x, GR.x0, GR.x1), y: clamp(s.pos[id].y, GR.y0, GR.y1)};
  }
  if(!okPos(s.hero)) s.hero = spot("", s.pos, GR.y0);
  for(const k of Object.keys(live)) if(!s.pos[k]) delete live[k];
  for(const k of Object.keys(s.prod)){ const P = s.prod[k]; if(!P || !PROD[P.p] || !okPos(P)) delete s.prod[k]; }
  const news = first ? 0 : s.dn; s.dn = 0;
  save(s);

  /* ---------- escenario ---------- */
  let ph = phase();
  let blades = ""; for(let i = 0; i < 400; i += 5){ const h = 5 + (i * 7) % 9; blades += `M${i} 16L${i + 2.5} ${16 - h}L${i + 5} 16Z`; }
  const stars = Array.from({length: 24}, () => `<i style="left:${rnd(2, 98).toFixed(1)}%;top:${rnd(3, 44).toFixed(1)}%;animation-delay:${rnd(0, 2.6).toFixed(2)}s;width:${rnd(2, 3.5).toFixed(1)}px;height:${rnd(2, 3.5).toFixed(1)}px"></i>`).join("");
  const flies = Array.from({length: 9}, () => `<i style="left:${rnd(4, 94).toFixed(1)}%;top:${rnd(10, 80).toFixed(1)}%;animation-delay:-${rnd(0, 6).toFixed(2)}s;animation-duration:${rnd(5, 9).toFixed(1)}s"></i>`).join("");
  const clouds = [[8, 12, 95, -20, 1], [20, 48, 120, -75, .8], [5, 78, 80, -50, .65]]
    .map(([t, cx, d, dl, sc]) => `<button type="button" class="fm-cloud" aria-label="Nube" style="top:${t}%;--cx:${cx}%;animation-duration:${d}s;animation-delay:${dl}s;scale:${sc}"></button>`).join("");
  host.innerHTML = `<div class="fm">
    <div class="fm-stage${crowd ? " crowd" : ""}" data-ph="${ph}" style="--hz:${HZ}%" role="group" aria-label="Tu granja">
      <div class="fm-sky"></div><div class="fm-stars">${stars}</div>
      <button type="button" class="fm-sun" aria-label="Sol"></button><button type="button" class="fm-moon" aria-label="Luna"></button>
      ${clouds}
      <svg class="fm-hills" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
        <path class="h2" d="M0 58C90 22 190 18 300 44C390 64 470 26 590 30C700 34 760 60 860 40C920 28 970 30 1000 36L1000 100L0 100Z"/>
        <path class="h1" d="M0 84C120 56 230 60 330 78C430 94 520 64 640 66C760 68 820 88 1000 70L1000 100L0 100Z"/></svg>
      <div class="fm-ground"></div>
      <svg class="fm-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M38 101C42 70 58 46 64 22C66 12 67 5 68 -1L71 -1C71 6 71 14 70 24C68 50 63 74 63 101Z"/></svg>
      <div class="fm-fence"></div><div class="fm-fence r"></div>
      <svg class="fm-blades" viewBox="0 0 400 16" preserveAspectRatio="none" aria-hidden="true"><path d="${blades}"/></svg>
      <div class="fm-flies" aria-hidden="true">${flies}</div>
      <div class="fm-layer"></div>
      <div class="fm-bub" hidden></div>
      <div class="fm-find" hidden></div>
      <div class="fm-hint" hidden></div>
    </div>
    <div class="fm-bar">
      <button type="button" class="btn lc fm-tb" data-fm="water" style="--lc:#1f6fd1"><span class="ic">💧</span><span class="lb">Regar</span><b class="fm-badge" hidden></b></button>
      <button type="button" class="btn lc fm-tb" data-fm="find" style="--lc:#2e9e4f"><span class="ic">🔍</span><span class="lb">¿Dónde está?</span></button>
      <button type="button" class="btn lc fm-tb fm-help" data-fm="help" style="--lc:#46566c" aria-label="Ayuda" title="Ayuda">?</button>
    </div>
    <div class="fm-tasks" aria-live="polite"></div>
  </div>`;
  const root = host.firstElementChild, stage = root.querySelector(".fm-stage"), layer = root.querySelector(".fm-layer");
  const bub = root.querySelector(".fm-bub"), fb = root.querySelector(".fm-find"), hint = root.querySelector(".fm-hint");
  const sun = root.querySelector(".fm-sun"), moon = root.querySelector(".fm-moon"), tasksEl = root.querySelector(".fm-tasks");
  const bWater = root.querySelector('[data-fm="water"]'), bFind = root.querySelector('[data-fm="find"]'), bHelp = root.querySelector('[data-fm="help"]');

  const els = {}, wt = {}, busy = {}, awake = {};
  let waterMode = false, F = null, drag = null, justDragged = 0, bubT = null, heroT = null, rzT = null;

  /* ---------- consultas ---------- */
  const hungry = id => now() - (s.fed[id] || 0) >= HUNGER;
  const plant = id => { let p = s.pl[id]; if(!p || typeof p !== "object") p = s.pl[id] = {s: 1, w: 0}; return p; };
  const canWater = id => now() - (plant(id).w || 0) >= WATER;
  const lit = () => (ph === "night" || ph === "dusk") && s.light !== false;
  const asleep = id => ph === "night" && !hungry(id) && !((awake[id] || 0) > now());
  const finding = () => !!(F && !F.done);
  const posOf = id => (ANIM[id] && okPos(live[id])) ? live[id] : s.pos[id];
  const hasProd = src => Object.values(s.prod).some(P => P.a === src);

  /* ---------- pintar cosas ---------- */
  function put(el, x, y, ms){
    if(el._hw) x = clamp(x, el._hw, 100 - el._hw);   /* que no se corte por los lados */
    el.classList.toggle("er", x > 84);                 /* cerca del borde derecho: bocadillos al otro lado */
    el.style.setProperty("--t", (ms || 0) + "ms");
    el.style.left = x + "%"; el.style.top = y + "%";
    el.style.zIndex = String(Math.round(y * 10));
    el.style.setProperty("--d", (0.86 + 0.24 * (y - GR.y0 + 2) / (GR.y1 - GR.y0 + 2)).toFixed(3));
  }
  function makeItem(it){
    const id = it.id, k = kindOf(id), el = document.createElement("button");
    el.type = "button"; el.className = "fm-it k-" + k; el.dataset.fid = id;
    if(BIG.has(id) || TREE[id]) el.classList.add("bg");
    if(id === "castillo") el.classList.add("xl");
    if(ANIM[id] && ANIM[id].fly) el.classList.add("fly");
    if(ANIM[id] && ANIM[id].hop) el.classList.add("hopper");
    if(ANIM[id]) el.style.setProperty("--fx", Math.random() < .5 ? 1 : -1);
    el._hw = halfW(id);
    const p = posOf(id);
    if(ANIM[id]) live[id] = {x: p.x, y: p.y};
    put(el, p.x, p.y, 0);
    layer.appendChild(el); els[id] = el;
    render(id, true);
    if(fresh.includes(id)) cls(el, "new", 800);
  }
  function render(id, force){
    const el = els[id], it = itemById(id); if(!el || !it) return;
    if(el._busy && !force) return;
    const k = kindOf(id); let badge = "", c = "", g = it.e, lbl = it.n;
    if(k === "animal"){
      if(hungry(id)){ badge = `<span class="fm-need" aria-hidden="true">🌾</span>`; lbl += ", tiene hambre"; }
      else if(asleep(id)) badge = `<span class="fm-zz" aria-hidden="true">💤</span>`;
    } else if(k === "plant"){
      const p = plant(id);
      if(p.s <= 0){ g = "🌱"; c = "sd0"; } else if(p.s === 1){ g = "🌿"; c = "sd1"; }
      if(p.s >= 2){ if(!TREE[id]){ c = "ripe"; badge = `<span class="fm-spk" aria-hidden="true"><i>✨</i><i>✨</i></span>`; lbl += ", lista para cosechar"; } }
      else if(canWater(id)){ badge = `<span class="fm-need w" aria-hidden="true">💧</span>`; lbl += ", quiere agua"; }
    } else if(id === "casa" && lit()) c = "lit";
    const sig = g + "|" + badge + "|" + c;
    if(!force && el._sig === sig) return;
    el._sig = sig;
    el.classList.remove("sd0", "sd1", "ripe", "lit"); if(c) el.classList.add(c);
    el.innerHTML = `<span class="fm-body"><span class="fm-sh"></span><span class="fm-e">${g}</span></span>${badge}`;
    el.setAttribute("aria-label", lbl);
  }
  /* media anchura (en % del escenario) de una cosa ya crecida */
  function halfW(id){
    const narrow = matchMedia("(max-width:560px)").matches, W = layer.clientWidth || 600;
    const rem = (id === "castillo" ? [4.3, 3.5] : (BIG.has(id) || TREE[id]) ? [3.6, 3] : [2.6, 2.2])[narrow ? 1 : 0];
    return Math.min(20, (rem * (crowd ? .86 : 1) * 16 * 1.2 * 1.1 / 2 + 2) / W * 100);
  }
  function makeProd(key, isNew){
    const P = s.prod[key], d = P && PROD[P.p]; if(!d) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "fm-prod" + (isNew ? " new" : ""); b.dataset.pk = key; b.innerHTML = pe(P.p);
    b.setAttribute("aria-label", "Recoger " + d.n);
    b.style.left = clamp(P.x, 9, 91) + "%"; b.style.top = P.y + "%"; b.style.zIndex = String(Math.round(P.y * 10) + 2);
    layer.appendChild(b);
  }

  /* ---------- efectos ---------- */
  function cls(el, c, ms){ if(!el) return; el.classList.remove(c); void el.offsetWidth; el.classList.add(c); later(() => el.classList.remove(c), ms); }
  const hop = el => cls(el, "hop", 600);
  function fx(e, x, y, c, ms, vars){
    const sp = document.createElement("span"); sp.className = "fm-fx " + c; sp.textContent = e || "";
    sp.style.left = x + "%"; sp.style.top = y + "%";
    if(vars) for(const k in vars) sp.style.setProperty(k, vars[k]);
    layer.appendChild(sp); later(() => sp.remove(), ms || 1200); return sp;
  }
  function topOf(el, fy){
    const L = layer.getBoundingClientRect(), t = (el.querySelector && el.querySelector(".fm-e, .fm-hb")) || el, r = t.getBoundingClientRect();
    return {x: (r.left + r.width / 2 - L.left) / L.width * 100, y: (r.top + r.height * (fy || 0) - L.top) / L.height * 100};
  }
  const heart = el => { const t = topOf(el); fx(pick(["❤️", "💛", "💙"]), t.x, t.y, "fm-heart", 1300); };
  function burst(el, e, n){
    const t = topOf(el, .4); n = n || 6;
    for(let i = 0; i < n; i++){ const a = Math.PI * 2 * i / n - Math.PI / 2; fx(e || "✨", t.x, t.y, "fm-burst", 950, {"--dx": (Math.cos(a) * 46).toFixed(0) + "px", "--dy": (Math.sin(a) * 40).toFixed(0) + "px"}); }
  }
  function puffs(x, y, n, gap){ for(let i = 0; i < (n || 3); i++) later(() => fx("", x + rnd(-1, 1), y, "fm-puff", 1500), i * (gap || 280)); }
  function flyTo(el, e, ec){
    if(RM() || !el.getBoundingClientRect) return;
    const c = document.getElementById("coins"), a = el.getBoundingClientRect();
    let b = c ? c.getBoundingClientRect() : null; if(!b || !b.width) b = {left: innerWidth - 50, top: 14, width: 20, height: 20};
    const sp = document.createElement("span"); sp.className = "fm-flyc" + (ec ? " " + ec : ""); sp.textContent = e;
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, dx = b.left + b.width / 2 - x0, dy = b.top + b.height / 2 - y0;
    sp.style.left = x0 + "px"; sp.style.top = y0 + "px"; document.body.appendChild(sp);
    setTimeout(() => sp.remove(), 1100);
    if(sp.animate) sp.animate([
      {transform: "translate(-50%,-50%) scale(1)", opacity: 1},
      {transform: `translate(calc(-50% + ${dx * .45}px), calc(-50% + ${dy * .45 - 50}px)) scale(1.25)`, opacity: 1, offset: .45},
      {transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.35)`, opacity: .2}], {duration: 900, easing: "ease-in", fill: "forwards"});
  }

  /* que el escenario se vea entero: la cabecera de la app está fija arriba y en móvil es alta */
  function showStage(){
    const hd = document.querySelector("header"), hb = hd && getComputedStyle(hd).position === "sticky" ? hd.getBoundingClientRect().bottom : 0;
    const r = stage.getBoundingClientRect(), room = innerHeight - hb;
    let dy = 0;
    if(r.top < hb + 6) dy = r.top - hb - 6;
    else if(r.bottom > innerHeight - 4) dy = Math.min(r.bottom - innerHeight + 4, r.top - hb - 6);
    if(r.height > room - 10 && r.top >= hb + 6) dy = r.top - hb - 6;
    if(Math.abs(dy) > 2) window.scrollBy({top: dy, behavior: RM() ? "auto" : "smooth"});
  }

  /* ---------- bocadillo ---------- */
  const msg = t => `<span class="fm-bm">${t}</span>`;
  const sayBtns = w => `<span class="fm-sg"><button type="button" class="say" data-say="${esc(w)}" aria-label="Escuchar" title="Escuchar">🔊</button><button type="button" class="say" data-say="${esc(w)}" data-slow aria-label="Escuchar despacio" title="Escuchar despacio">🐢</button></span>`;
  const wordBub = (e, w, es, extra) => `<span class="fm-be">${e}</span><span class="fm-bt"><b>${esc(w)}</b><small>= ${esc(es)}</small>${extra ? `<i>${extra}</i>` : ""}</span>${sayBtns(w)}`;
  function bubble(html, anchor, ms){
    bub.innerHTML = html; bub.hidden = false;
    bub.classList.remove("in", "below"); void bub.offsetWidth; bub.classList.add("in");
    const L = layer.getBoundingClientRect(); let cx, top, bot;
    if(anchor && anchor.getBoundingClientRect){
      const t = (anchor.querySelector && anchor.querySelector(".fm-e, .fm-hb")) || anchor, r = t.getBoundingClientRect();
      cx = r.left + r.width / 2 - L.left; top = r.top - L.top; bot = r.bottom - L.top;
    } else { cx = anchor.x / 100 * L.width; top = bot = anchor.y / 100 * L.height; }
    const bw = bub.offsetWidth, bh = bub.offsetHeight;
    const left = clamp(cx, bw / 2 + 6, L.width - bw / 2 - 6), below = top - bh - 14 < 2;
    bub.classList.toggle("below", below);
    bub.style.left = left + "px";
    bub.style.top = (below ? Math.min(bot + 12, L.height - bh - 4) : top - 10) + "px";
    bub.style.setProperty("--tail", clamp(cx - left + bw / 2, 18, bw - 18) + "px");
    cancel(bubT); bubT = later(hideBub, ms || 3800);
  }
  function hideBub(){ bub.hidden = true; }

  /* ---------- diálogos ---------- */
  const dlgOpen = () => !!root.querySelector("dialog.fm-dlg[open]");
  function dlg(html){
    /* nunca dos diálogos a la vez (toques rápidos, teclado…) */
    root.querySelectorAll("dialog.fm-dlg").forEach(x => { try{ x.close(); }catch(e){} x.remove(); });
    const d = document.createElement("dialog"); d.className = "fm-dlg"; d.innerHTML = html;
    root.appendChild(d); d.addEventListener("close", () => d.remove());
    try{ d.showModal(); }catch(e){ d.setAttribute("open", ""); }
    return d;
  }
  function openHelp(){
    play("tap");
    const he = (itemById(game().wear.hero) || {}).e || "🦊";
    const d = dlg(`<h2>¿Cómo se juega? 🏡</h2><ul class="fm-help-l">
      <li><span>👆</span>Toca una cosa: oirás cómo se dice en ${LANGS[lang].name}.</li>
      <li><span>🌾</span>¿Tiene hambre? Tócalo y elige la palabra buena.</li>
      <li><span>🥚</span>Recoge sus regalos y ganas 🪙.</li>
      <li><span>💧</span>Pulsa «Regar» y toca una planta. Cuando brilla ✨, ¡tócala y cosecha!</li>
      <li><span>🔍</span>«¿Dónde está?»: escucha la palabra y toca esa cosa.</li>
      <li><span>✋</span>Arrastra las cosas con el dedo. Toca el suelo y ${he} irá allí.</li>
      <li><span>📚</span>Las lecciones te dan agua extra 💧.</li></ul>
      <button type="button" class="btn lc fm-ok" style="--lc:#1f6fd1">¡Entendido!</button>`);
    d.querySelector(".fm-ok").onclick = () => d.close();
  }
  function welcome(gift){
    const d = dlg(`<div class="fm-wel">${gift ? "🎁" : "✨"}</div><h2>${gift ? "¡Un regalo para tu granja!" : "¡Tu granja está viva!"}</h2>
      <p class="fm-sub">${gift ? "Te regalo una gallina 🐔 y una flor 🌼." : "Ahora los animales comen, las plantas crecen… ¡y puedes jugar!"}</p>
      <ul class="fm-help-l">
        <li><span>🌾</span>${gift ? "La gallina tiene hambre. Tócala y elige la palabra buena." : "Si un animal tiene hambre, tócalo y elige la palabra buena."}</li>
        <li><span>💧</span>${gift ? "Pulsa «Regar» y toca la flor para que crezca." : "Pulsa «Regar» y toca una planta para que crezca."}</li>
        <li><span>🪙</span>Recoge huevos, leche y cosechas: ¡ganas monedas!</li>
        <li><span>✋</span>Arrastra las cosas para ordenar tu granja.</li></ul>
      <button type="button" class="btn lc fm-ok" style="--lc:#1f6fd1">¡A jugar!</button>`);
    d.querySelector(".fm-ok").onclick = () => d.close();
    play(gift ? "gift" : "pop");
    if(gift){ try{ confetti({n: 70}); }catch(e){} }
    d.addEventListener("close", () => { if(!isOn()) return; const id = gift ? "gallina" : Object.keys(els).find(i => ANIM[i] && hungry(i)); if(id && els[id]){ if(ANIM[id]) freeze(id); cls(els[id], "hl", 2500); if(ANIM[id]) resume(id, 2700); } });
  }

  /* ---------- el personaje ---------- */
  const hero = document.createElement("div");
  hero.className = "fm-hero"; hero.tabIndex = 0; hero.setAttribute("role", "button"); hero.setAttribute("aria-label", "Tu personaje");
  const hsz = layer.clientWidth < 480 ? 42 : 50;
  hero.innerHTML = `<span class="fm-sh" style="font-size:${hsz}px"></span><div class="fm-hf"><div class="fm-hb">${heroHtml(hsz)}</div></div>`;
  let hpos = {x: s.hero.x, y: s.hero.y};
  put(hero, hpos.x, hpos.y, 0);
  function walkTo(x, y, then){
    x = clamp(x, 4, 96); y = clamp(y, GR.y0, GR.y1);
    const W = layer.clientWidth || 600, H = layer.clientHeight || 340, cs = getComputedStyle(hero);
    const cx = parseFloat(cs.left) / W * 100, cy = parseFloat(cs.top) / H * 100;
    const from = isFinite(cx) && isFinite(cy) ? {x: cx, y: cy} : hpos;
    put(hero, from.x, from.y, 0); void hero.offsetWidth;
    const dist = Math.hypot((x - from.x) * W / 100, (y - from.y) * H / 100);
    const ms = RM() ? 0 : Math.round(clamp(dist / 170 * 1000, 150, 2600));
    if(Math.abs(x - from.x) > .6) hero.style.setProperty("--fx", x < from.x ? 1 : -1);
    if(ms) hero.classList.add("walk");
    put(hero, x, y, ms); hpos = {x, y};
    cancel(heroT);
    heroT = later(() => { hero.classList.remove("walk"); upd(st => st.hero = {x: r1(x), y: r1(y)}); if(then) then(); }, ms + 30);
  }
  function walkNear(id){
    const p = posOf(id), el = els[id]; if(!p || !el) return;
    /* se queda al lado (no encima): así la cosa se puede seguir tocando */
    const W = layer.clientWidth || 600, hw = hero.getBoundingClientRect().width || 50, ew = el.getBoundingClientRect().width || 40;
    const off = (hw / 2 + ew / 2 + 6) / W * 100;
    if(Math.abs(hpos.x - p.x) >= off - 1 && Math.abs(hpos.x - p.x) < off + 4 && Math.abs(hpos.y - p.y) < 4) return;
    const side = hpos.x <= p.x ? -1 : 1; let x = p.x + side * off;
    if(x < 4 || x > 96) x = p.x - side * off;
    walkTo(x, clamp(p.y - .5, GR.y0, GR.y1));
  }
  function tapHero(){
    hop(hero);
    if(finding()){ const it = itemById(F.target); if(it) speak(iw(it)); return; }
    const gr = GREET[ph] || GREET.day, w = gr[lang] || gr.english;
    bubble(`<span class="fm-be">👋</span><span class="fm-bt"><b>${esc(w)}</b><small>= ${esc(gr.es)}</small></span>${sayBtns(w)}`, hero);
    speak(w); play("pop");
  }

  /* ---------- animales que pasean ---------- */
  function face(el, dx){ if(Math.abs(dx) < .3) return; const f = FACE[el.dataset.fid] || 1; el.style.setProperty("--fx", dx > 0 ? -f : f); }
  function wander(id){
    wt[id] = null;
    const A = ANIM[id], el = els[id]; if(!A || !el || RM()) return;
    if(finding() || busy[id] || (drag && drag.id === id) || asleep(id)){ wt[id] = later(() => wander(id), 3000); return; }
    const home = s.pos[id], c = posOf(id), r = A.r;
    const x = clamp(home.x + rnd(-r, r), GR.x0, GR.x1), y = clamp(home.y + rnd(-r * .55, r * .55), GR.y0, GR.y1);
    const W = layer.clientWidth || 600, H = layer.clientHeight || 340;
    const dist = Math.hypot((x - c.x) * W / 100, (y - c.y) * H / 100);
    const ms = Math.round(Math.max(400, dist / (A.sp * (ph === "night" ? .6 : 1)) * 1000));
    face(el, x - c.x); el.classList.add("walk");
    put(el, x, y, ms); live[id] = {x, y};
    wt[id] = later(() => { el.classList.remove("walk"); idle(id); wt[id] = later(() => wander(id), rnd(2500, 7000)); }, ms);
  }
  function idle(id){
    const el = els[id], A = ANIM[id]; if(!el || Math.random() > .45) return;
    cls(el, A.idle === "peck" ? "peck" : (A.idle === "hop" || A.hop) ? "hop" : "wig", 750);
  }
  function freeze(id){
    const el = els[id]; if(!el) return;
    cancel(wt[id]); wt[id] = null; el.classList.remove("walk");
    const W = layer.clientWidth, H = layer.clientHeight, cs = getComputedStyle(el);
    const x = parseFloat(cs.left) / W * 100, y = parseFloat(cs.top) / H * 100;
    if(W && H && isFinite(x) && isFinite(y)){ put(el, x, y, 0); live[id] = {x, y}; }
  }
  function resume(id, ms){ if(!ANIM[id] || !els[id]) return; cancel(wt[id]); wt[id] = later(() => wander(id), ms); }

  /* ---------- tocar cosas ---------- */
  function tap(id, ev){
    const it = itemById(id), el = els[id]; if(!it || !el || dlgOpen()) return;
    if(finding()) return findTap(id, ev);
    if(waterMode) return waterTap(id);
    const k = kindOf(id);
    if(k === "animal") return tapAnimal(id);
    if(k === "plant") return tapPlant(id);
    if(k === "build") return tapBuild(id);
    hop(el); play("tap"); bubble(wordBub(it.e, iw(it), it.n), el); speak(iw(it));
  }
  function tapAnimal(id){
    const it = itemById(id), el = els[id], A = ANIM[id];
    freeze(id);
    if(hungry(id)){ play("tap"); cls(el, "wig", 700); walkNear(id); openFeed(id); return; }
    const woke = asleep(id); awake[id] = now() + 30000;
    hop(el); heart(el); play(A.moo ? "moo" : "pop");
    bubble(wordBub(it.e, iw(it), it.n, woke ? "¡Me has despertado! 🥱" : ""), el); speak(iw(it));
    render(id); resume(id, 2600);
  }

  /* reto para dar de comer */
  function openFeed(id){
    const it = itemById(id), right = iw(it);
    const words = new Set([right]), others = [];
    for(const x of shuffle(SHOP.filter(x => x.t === "farm" && ANIM[x.id] && x.id !== id)).concat(shuffle(SHOP.filter(x => x.t === "farm" && !ANIM[x.id])))){
      const w = iw(x); if(!words.has(w)){ words.add(w); others.push(x); } if(others.length === 2) break;
    }
    const opts = shuffle([it, ...others]);
    const d = dlg(`<div class="fm-qe" aria-hidden="true"><span>${it.e}</span><span class="fm-qb">💭🌾</span></div>
      <p class="fm-qt">Para darle de comer: ¿cómo se dice <b>"${esc(it.n)}"</b> en ${LANGS[lang].name}?</p>
      <div class="fm-opts">${opts.map(o => `<div class="fm-or"><button type="button" class="fm-opt" data-fo="${o.id}">${esc(iw(o))}</button><button type="button" class="say fm-ls" data-say="${esc(iw(o))}" aria-label="Escuchar ${esc(iw(o))}" title="Escuchar">🔊</button></div>`).join("")}</div>
      <p class="fm-qm" aria-live="polite"></p>
      <button type="button" class="btn fm-x">Ahora no</button>`);
    const m = d.querySelector(".fm-qm"); let done = false;
    d.querySelector(".fm-x").onclick = () => d.close();
    d.addEventListener("close", () => { if(!done && isOn()) resume(id, 1200); });   /* «Ahora no»: vuelve a pasear */
    d.querySelectorAll(".fm-opt").forEach(b => b.onclick = () => {
      if(done || b.disabled) return;
      if(b.dataset.fo === id){
        done = true; b.classList.add("ok"); play("ok");
        d.querySelectorAll(".fm-opt").forEach(x => { if(x !== b) x.disabled = true; });
        m.className = "fm-qm ok"; m.innerHTML = `¡Ñam, ñam! 😋 <b>${esc(right)}</b>`; speak(right);
        /* se guarda ya (comido + regalo): aunque cierre con Escape o salga de la página no se pierde ni se repite */
        const key = fedNow(id);
        d.addEventListener("close", () => feed(id, key), {once: true});
        later(() => { try{ d.close(); }catch(e){} }, 1300);
      } else {
        b.classList.add("bad"); b.disabled = true; play("bad");
        const okB = d.querySelector(`.fm-opt[data-fo="${id}"]`); if(okB) okB.classList.add("hint");
        m.className = "fm-qm bad"; m.innerHTML = `¡Casi! Era <b>"${esc(right)}"</b>. ¡Tócalo!`; speak(right);
      }
    });
  }
  function fedNow(id){
    upd(st => st.fed[id] = now()); awake[id] = now() + 30000;
    const key = addProd(id, ANIM[id].p);
    emit("farm-feed", {item: itemById(id)});
    return key;
  }
  function feed(id, key){
    const it = itemById(id), el = els[id], A = ANIM[id]; if(!el || !isOn()) return;
    freeze(id); busy[id] = true;
    render(id, true);
    const t = topOf(el, .5);
    fx("🌾", t.x + (parseFloat(el.style.getPropertyValue("--fx")) > 0 ? -3 : 3), t.y + 4, "fm-drip", 900);
    cls(el, "eat", 1300); play("eat"); later(() => play("eat"), 500);
    later(() => {
      heart(el); busy[id] = false;
      if(key && s.prod[key] && !layer.querySelector(`[data-pk="${key}"]`)){ makeProd(key, true); play("pop"); }
      if(A.moo) play("moo");
      bubble(wordBub(it.e, iw(it), it.n, key ? "¡Gracias! Te he dejado un regalo 🎁" : "¡Gracias! ¡Qué rico! 😋"), el, 3200);
      resume(id, 3000); tasks();
    }, 1300);
    tasks();
  }
  /* guarda un producto junto a su animal o árbol (como mucho 2 a la vez) */
  function addProd(src, pid){
    const p = posOf(src); if(!p || !PROD[pid]) return null;
    if(Object.values(s.prod).filter(P => P.a === src).length >= 2) return null;
    /* al lado, sin taparlo: así el animal se puede seguir tocando */
    const W = layer.clientWidth || 600, half = ((els[src] && els[src].offsetWidth) || 52) / 2;
    const off = Math.max(TREE[src] ? 7 : 5.5, (half + 22) / W * 100);
    let side = p.x > 50 ? -1 : 1; if(p.x + side * off > 91 || p.x + side * off < 9) side = -side;
    const x = clamp(p.x + side * off + rnd(-1, 1), 9, 91), y = clamp(p.y + (TREE[src] ? 2.5 : 1.5), GR.y0 + 4, GR.y1);
    const key = src + "-" + now().toString(36) + Math.floor(Math.random() * 99);
    upd(st => st.prod[key] = {a: src, p: pid, x: r1(x), y: r1(y)});
    return key;
  }
  function spawnProd(src, pid){
    const key = addProd(src, pid); if(!key) return;
    makeProd(key, true); play("pop");
  }
  function collect(key, b){
    const P = s.prod[key]; if(!P || b._got) return; b._got = true;
    const d = PROD[P.p], w = pw(d), extra = P.p === "abono";
    upd(st => { delete st.prod[key]; if(extra) st.drops = Math.min(MAX_DROPS, (st.drops || 0) + 1); });
    bubble(wordBub(pe(P.p), w, d.n, extra ? "+1 💧 para tus plantas" : ""), b);
    speak(w); flyTo(b, d.e, "fm-pe-" + P.p);
    b.classList.add("got"); later(() => b.remove(), 460);
    walkTo(P.x + (hpos.x < P.x ? -5 : 5), P.y + 1);
    award(d.c, `¡${cap(d.n)}!`);
    emit("farm-collect", {product: {id: P.p, e: d.e, n: d.n, word: w, from: P.a}});
    tasks(); bar();
  }

  /* plantas */
  function tapPlant(id){
    const it = itemById(id), el = els[id], p = plant(id), w = iw(it);
    if(p.s >= 2 && !TREE[id]) return harvest(id);
    hop(el); play("tap");
    if(p.s >= 2){   /* árbol grande */
      const t = topOf(el, .3); for(let i = 0; i < 3; i++) later(() => fx("🍃", t.x + rnd(-6, 6), t.y + rnd(0, 8), "fm-leaf", 1600), i * 160);
      bubble(wordBub(it.e, w, it.n, hasProd(id) ? "Mira lo que hay en el suelo 👇" : "Pronto dará un regalo 🎁"), el); speak(w); return;
    }
    const can = canWater(id) || s.drops > 0;
    bubble(wordBub(`${p.s <= 0 ? "🌱" : "🌿"}<small>→</small>${it.e}`, w, it.n, can ? "¡Riégame! 💧" : `Crece… vuelve en ${fmtLeft(WATER - (now() - plant(id).w))}`), el); speak(w);
    if(can) cls(bWater, "nudge", 1300);
  }
  function waterTap(id){
    const it = itemById(id), el = els[id], k = kindOf(id);
    if(k !== "plant"){
      hop(el); play("whoosh");
      bubble(msg(id === "pato" ? "🦆💦 ¡Al pato le encanta el agua!" : k === "animal" ? "💦 ¡Ji, ji! ¡Eso no es una planta!" : "💦 Eso no es una planta. ¡Toca una planta!"), el, 2600); return;
    }
    const p = plant(id);
    if(p.s >= 2){
      if(!TREE[id]) return harvest(id);   /* ya está lista: se cosecha aunque esté regando */
      hop(el); bubble(msg("🌳 ¡Ya es muy grande!<br>No necesita más agua."), el, 3000); return;
    }
    const free = canWater(id);
    if(!free && s.drops <= 0){
      cls(el, "no", 500); play("tap");
      bubble(msg(`🌿 Ya bebió agua.<br>Vuelve en ${fmtLeft(WATER - (now() - p.w))}.<br>📚 ¡Una lección te da agua extra!`), el, 4200); return;
    }
    upd(st => { if(!free) st.drops = Math.max(0, st.drops - 1); const q = st.pl[id]; q.s = Math.min(2, q.s + 1); q.w = now(); });
    walkNear(id); play("whoosh");
    const t = topOf(el);
    for(let i = 0; i < 6; i++) later(() => fx("💧", t.x + rnd(-4, 4), t.y + rnd(-2, 6), "fm-drip", 700), i * 110);
    bar();
    later(() => {
      render(id, true); cls(el, "grow", 750);
      const ripe = plant(id).s >= 2;
      if(ripe){ play("ok"); burst(el, "✨", 6); bubble(wordBub(it.e, iw(it), it.n, TREE[id] ? "¡Ha crecido un montón! 🌳" : "✨ ¡Ya está lista! ¡Cosecha!"), el); speak(iw(it)); if(TREE[id]) checkTrees(); }
      else bubble(msg(`💧 ¡Glu, glu! ¡Está creciendo!${free ? "" : "<br>Usaste 1 💧 extra."}`), el, 2600);
      tasks();
    }, 800);
  }
  function harvest(id){
    const it = itemById(id), el = els[id], w = iw(it);
    walkNear(id);
    upd(st => { st.pl[id].s = 0; });
    flyTo(el, it.e); burst(el, "✨", 6);
    bubble(wordBub(it.e, w, it.n, "¡Cosechado! 🧺"), el); speak(w);
    award(PLANT[id] || 3, `¡${cap(artEs(it.n))}!`);
    el._busy = true; cls(el, "pluck", 460);
    later(() => { el._busy = false; render(id, true); cls(el, "grow", 750); tasks(); }, 470);
    emit("farm-harvest", {item: it});
  }
  const artEs = n => { try{ return typeof art === "function" ? art(n) : n; }catch(e){ return n; } };
  function checkTrees(){
    for(const id of Object.keys(TREE)){
      if(!els[id] || plant(id).s < 2 || hasProd(id)) continue;
      if(now() - (s.tree[id] || 0) >= TREE_T){ upd(st => st.tree[id] = now()); spawnProd(id, TREE[id]); }
    }
  }

  /* edificios */
  function tapBuild(id){
    const it = itemById(id), el = els[id], w = iw(it), act = BUILD[id];
    if(el._busy) return;
    if(act === "light" && (ph === "night" || ph === "dusk")){
      upd(st => st.light = !lit()); render(id, true); hop(el); play(lit() ? "pop" : "tap");
      bubble(wordBub(it.e, w, it.n, lit() ? "💡 ¡Luz encendida!" : "🌙 Luz apagada"), el); speak(w); return;
    }
    bubble(wordBub(it.e, w, it.n), el); speak(w);
    if(act === "launch") return launch(el);
    if(act === "drive") return drive(el, id);
    hop(el);
    /* toques muy seguidos: dice la palabra, pero la sorpresa espera a terminar */
    if((el._cool || 0) > now()) return;
    el._cool = now() + (act === "fire" ? 1900 : act === "camp" ? 600 : 1300);
    if(act === "spray") spray(el);
    else if(act === "fire") fireworks(el);
    else if(act === "camp") campfire(id);
    else smoke(el);
  }
  function smoke(el){
    const L = layer.getBoundingClientRect(), r = el.querySelector(".fm-e").getBoundingClientRect();
    puffs((r.left + r.width * .66 - L.left) / L.width * 100, (r.top + r.height * .12 - L.top) / L.height * 100, 4, 300); play("whoosh");
  }
  function spray(el){
    const t = topOf(el, .15); play("whoosh");
    for(let i = 0; i < 14; i++) later(() => {
      const sp = fx("💧", t.x, t.y, "fm-sp", 1100), dx = rnd(-46, 46);
      if(sp.animate && !RM()) sp.animate([
        {transform: "translate(-50%,-50%) translate(0,0) scale(.5)", opacity: 1},
        {transform: `translate(-50%,-50%) translate(${dx * .55}px,-58px) scale(.8)`, opacity: 1, offset: .45},
        {transform: `translate(-50%,-50%) translate(${dx}px,34px) scale(.55)`, opacity: 0}], {duration: 1000, easing: "ease-out", fill: "forwards"});
    }, i * 110);
    later(() => play("whoosh"), 700);
  }
  function fireworks(el){
    const t = topOf(el); play("fanfare");
    for(let i = 0; i < 5; i++) later(() => { fx("", t.x + rnd(-14, 14), Math.max(6, t.y - rnd(4, 20)), "fm-fw", 1150, {"--c": pick(["#f2c94c", "#5aa2ff", "#45cf8b"])}); play("pop"); }, i * 320);
  }
  function campfire(id){
    if(layer.querySelector(".fm-fire")) return;
    const p = s.pos[id]; play("pop");
    fx("🔥", clamp(p.x + 7, GR.x0, GR.x1), clamp(p.y + 2, GR.y0, GR.y1), "fm-fire", 8000);
    [300, 900, 1500, 2400].forEach(ms => later(() => play("tap"), ms));
  }
  function launch(el){
    if(RM() || !el.animate){ hop(el); return; }
    el._busy = true;
    const body = el.querySelector(".fm-body"), e = el.querySelector(".fm-e"), d = parseFloat(el.style.getPropertyValue("--d")) || 1;
    const up = (el.offsetTop + 60) / d;
    const fl = document.createElement("span"); fl.className = "fm-flame"; fl.textContent = "🔥"; body.appendChild(fl);
    el.classList.add("fly2"); play("whoosh");
    const t = topOf(el, 1); puffs(t.x, t.y - 2, 4, 120);
    const a = body.animate([
      {transform: "translate(0,0)"}, {transform: "translate(-3px,0)", offset: .05}, {transform: "translate(3px,0)", offset: .1},
      {transform: "translate(0,0)", offset: .16, easing: "cubic-bezier(.5,0,.9,.5)"},
      {transform: `translate(0,${-up}px)`, offset: .45}, {transform: `translate(0,${-up}px)`, offset: .6, easing: "cubic-bezier(.1,.6,.4,1)"},
      {transform: "translate(0,0)", offset: .94}, {transform: "translate(0,0)"}], {duration: 4200});
    e.animate([{transform: "rotate(0deg)"}, {transform: "rotate(-45deg)", offset: .16}, {transform: "rotate(-45deg)", offset: .9}, {transform: "rotate(0deg)"}], {duration: 4200});
    later(() => play("whoosh"), 2500);
    later(() => { fl.remove(); el.classList.remove("fly2"); el._busy = false; play("pop"); const t2 = topOf(el, 1); puffs(t2.x, t2.y - 2, 3, 100); }, 4250);
    a.onfinish = () => { el._busy = false; };
  }
  function drive(el, id){
    if(RM() || !el.animate){ hop(el); return; }
    el._busy = true;
    const body = el.querySelector(".fm-body"), p = s.pos[id], W = layer.clientWidth, d = parseFloat(el.style.getPropertyValue("--d")) || 1;
    const left = p.x > 35, dist = (left ? p.x - 9 : 91 - p.x) * W / 100 / d, dx = left ? -dist : dist;
    const f = FACE[id] || 1, out = left ? f : -f, back = -out;
    el.classList.add("walk"); play("whoosh");
    body.animate([
      {transform: "translateX(0) scaleX(1)"}, {transform: `translateX(0) scaleX(${out})`, offset: .04, easing: "ease-in-out"},
      {transform: `translateX(${dx}px) scaleX(${out})`, offset: .46}, {transform: `translateX(${dx}px) scaleX(${back})`, offset: .52, easing: "ease-in-out"},
      {transform: `translateX(0) scaleX(${back})`, offset: .95}, {transform: "translateX(0) scaleX(1)"}], {duration: 5200});
    for(let i = 1; i < 12; i++) later(() => { const t = topOf(el, .5); puffs(t.x + (t.x > 50 ? 3 : -3), t.y, 1); }, i * 420);
    later(() => { el.classList.remove("walk"); el._busy = false; play("pop"); }, 5250);
  }

  /* cielo */
  function tapSky(key, el){
    const W = SKYW[key], w = pw(W);
    bubble(wordBub(W.e, w, W.n), el); speak(w); play("pop");
    if(el.animate && !RM()) el.animate([{scale: 1}, {scale: 1.25}, {scale: 1}], {duration: 600, easing: "ease-out"});
  }
  function tapCloud(cl){
    if(!cl.querySelector(".fm-rain")){
      const r = document.createElement("span"); r.className = "fm-rain";
      r.innerHTML = Array.from({length: 9}, (_, i) => `<i style="left:${4 + i * 11}%;animation-delay:${rnd(0, .6).toFixed(2)}s"></i>`).join("");
      cl.appendChild(r); later(() => r.remove(), 2600);
    }
    play("whoosh"); tapSky("nube", cl);
  }
  function shootingStar(x, y, withWord){
    if(!RM()) fx("", x, y, "fm-shoot", 1100);
    if(withWord){ const W = SKYW.estrella, w = pw(W); bubble(wordBub(W.e, w, W.n), {x, y}); speak(w); play("pop"); }
  }
  function butterfly(x, y){
    if(!RM()) fx("🦋", x, y, "fm-bfly", 2700);
    const W = SKYW.mariposa, w = pw(W); bubble(wordBub(W.e, w, W.n), {x, y}); speak(w); play("pop");
  }

  /* ---------- juego «¿Dónde está…?» ---------- */
  function dots(){ return `<span class="fm-dots">${Array.from({length: ROUNDS}, (_, i) => `<i class="${i < F.res.length ? (F.res[i] ? "ok" : "no") : i === F.res.length ? "now" : ""}"></i>`).join("")}</span>`; }
  /* solo cosas que se reconocen: las plantas cuentan cuando ya han crecido */
  const findable = () => owned().map(x => x.id).filter(id => els[id] && (kindOf(id) !== "plant" || plant(id).s >= 2));
  function startFind(){
    if(finding()){ if(now() - (F.t0 || 0) < 800) return; return exitFind(); }   /* doble toque: no sale sin querer */
    const ids = findable();
    if(ids.length < 3){
      play("tap");
      bubble(msg(owned().length >= 3 ? "🔍 Para jugar necesitas 3 cosas que se vean bien.<br>¡Haz crecer tus plantas 🌻 o compra más! 🛒" : "🔍 Para jugar necesitas 3 cosas en tu granja.<br>¡Compra más en la tienda! 🛒"), hero, 4500);
      return;
    }
    setWater(false); hideBub();
    F = {round: 0, ok: 0, res: [], prev: null, bag: shuffle(ids), lock: false, done: false, t0: now()};
    Object.keys(els).forEach(id => { if(ANIM[id]) freeze(id); });
    stage.classList.add("finding"); bar(); play("whoosh"); showStage();
    later(nextRound, 250);
  }
  function nextRound(){
    if(!F || F.done) return;
    if(F.round >= ROUNDS) return endFind();
    const ids = findable();
    if(!F.bag.length) F.bag = shuffle(ids.filter(id => id !== F.prev));
    let id = F.bag.shift(); if(!ids.includes(id)) id = pick(ids);
    F.target = id; F.prev = id; F.lock = false;
    const it = itemById(id), w = iw(it);
    fb.hidden = false;
    fb.innerHTML = `<span class="fm-fh">${heroHtml(30)}</span><span class="fm-ft"><small>¿Dónde está…?</small><b>${esc(w)}</b>${dots()}</span>
      <button type="button" class="say" data-say="${esc(w)}" aria-label="Escuchar" title="Escuchar">🔊</button><button type="button" class="fm-fq" aria-label="Salir del juego" title="Salir">✕</button>`;
    hop(hero); later(() => speak(w), 200);
  }
  function findTap(id, ev){
    if(!F || F.lock || F.done) return; F.lock = true;
    const tEl = els[F.target], it = itemById(F.target), w = iw(it);
    let ok = id === F.target, el = els[id];
    /* si la buena está justo detrás de lo que ha tocado, también vale */
    if(!ok && ev && ev.clientX && tEl){
      const r = (tEl.querySelector(".fm-e") || tEl).getBoundingClientRect();
      if(ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom){ ok = true; el = tEl; }
    }
    F.res.push(ok); if(ok) F.ok++; F.round++;
    emit("farm-find", {ok});
    const dd = fb.querySelector(".fm-dots"); if(dd) dd.outerHTML = dots();
    if(ok){ play("ok"); hop(el); burst(el, "⭐", 5); bubble(wordBub(it.e, w, it.n, "¡Muy bien! ✅"), el, 1400); }
    else { play("bad"); cls(el, "no", 500); cls(tEl, "hl", 2300); bubble(wordBub(it.e, w, it.n, "¡Casi! ¡Está aquí! 👇"), tEl || el, 2300); speak(w); }
    later(nextRound, ok ? 1300 : 2500);
  }
  function endFind(){
    F.done = true;
    const n = F.ok, all = n === ROUNDS, day = dayKey(new Date()); let paid = false;
    upd(st => { if(!st.fd || st.fd.day !== day) st.fd = {day, n: 0}; if(st.fd.n < FIND_PAID){ st.fd.n++; paid = true; } });
    const coins = paid ? n + (all ? 5 : 0) : 0;
    if(coins) award(coins, all ? "¡Lo encontraste todo!" : "¿Dónde está?");
    if(all){ play("fanfare"); try{ confetti({emoji: "⭐", n: 40}); }catch(e){} } else if(n) play("ok");
    fb.innerHTML = `<span class="fm-fh">${heroHtml(30)}</span><span class="fm-ft"><small>${all ? "¡Perfecto! 🏆" : n >= 3 ? "¡Muy bien! 🎉" : "¡Buen intento! 💪"}</small><b>${n} de ${ROUNDS}</b>${coins ? `<em>+${coins} 🪙</em>` : !paid ? `<em class="m">Hoy ya ganaste 🪙 aquí</em>` : ""}</span>
      <button type="button" class="fm-fa">🔁 Otra vez</button><button type="button" class="fm-fq" aria-label="Cerrar" title="Cerrar">✕</button>`;
    stage.classList.remove("finding"); bar();
    Object.keys(els).forEach(id => { if(ANIM[id]) resume(id, rnd(800, 2500)); });
  }
  function exitFind(){
    const was = finding(); F = null; fb.hidden = true; stage.classList.remove("finding"); bar();
    if(was) Object.keys(els).forEach(id => { if(ANIM[id]) resume(id, rnd(500, 2000)); });
  }

  /* ---------- barra y tareas ---------- */
  function setWater(on){
    if(on && finding()) return;
    if(on && !owned().some(x => kindOf(x.id) === "plant")){ play("tap"); bubble(msg("🌱 Aún no tienes plantas.<br>¡Compra una en la tienda! 🛒"), hero, 4000); return; }
    waterMode = !!on; stage.classList.toggle("watering", waterMode);
    hint.hidden = !waterMode;
    if(waterMode){ hint.innerHTML = `<span>💧 Toca una planta para regarla</span><button type="button" class="fm-hx">✋ Parar</button>`; play("pop"); hideBub(); showStage(); }
    bar();
  }
  function bar(){
    bWater.classList.toggle("on", waterMode);
    bWater.querySelector(".ic").textContent = waterMode ? "✋" : "💧";
    bWater.querySelector(".lb").textContent = waterMode ? "Parar" : "Regar";
    const b = bWater.querySelector(".fm-badge"); b.hidden = !(s.drops > 0); b.textContent = "+" + s.drops;
    bWater.title = s.drops > 0 ? `Regar · tienes ${s.drops} de agua extra` : "Regar las plantas";
    bFind.classList.toggle("on", finding());
    bFind.querySelector(".lb").textContent = finding() ? "Salir" : "¿Dónde está?";
    bFind.querySelector(".ic").textContent = finding() ? "✕" : "🔍";
  }
  function tasks(){
    const its = owned(); let h = 0, w = 0, r = 0, next = Infinity;
    for(const it of its){
      const id = it.id, k = kindOf(id);
      if(k === "animal"){ if(hungry(id)) h++; else next = Math.min(next, (s.fed[id] || 0) + HUNGER - now()); }
      else if(k === "plant"){
        const p = plant(id);
        if(p.s >= 2){ if(!TREE[id]) r++; else if(!hasProd(id)) next = Math.min(next, (s.tree[id] || 0) + TREE_T - now()); }
        else if(canWater(id)) w++; else next = Math.min(next, (p.w || 0) + WATER - now());
      }
    }
    const pr = Object.keys(s.prod).length, chips = [];
    if(h) chips.push(`<button type="button" class="fm-chip c-h" data-fk="h">🌾 <b>${h}</b> ${h === 1 ? "tiene" : "tienen"} hambre</button>`);
    if(pr) chips.push(`<button type="button" class="fm-chip c-p" data-fk="p">🧺 <b>${pr}</b> para recoger</button>`);
    if(w) chips.push(`<button type="button" class="fm-chip c-w" data-fk="w">💧 <b>${w}</b> ${w === 1 ? "quiere" : "quieren"} agua</button>`);
    if(r) chips.push(`<button type="button" class="fm-chip c-r" data-fk="r">✨ <b>${r}</b> para cosechar</button>`);
    let html = chips.join("");
    if(!its.length) html = `<span class="fm-note">🛒 ¡Compra animales y plantas en la tienda!</span>`;
    else if(!chips.length) html = `<span class="fm-note">😊 ¡Todo hecho!${isFinite(next) && next > 0 ? ` Vuelve en ${fmtLeft(next)}.` : ""}</span>`;
    if(tasksEl._h !== html){ tasksEl._h = html; tasksEl.innerHTML = html; }
  }
  function tick(){
    const p = phase();
    if(p !== ph){ ph = p; stage.dataset.ph = p; }
    skyPos(); checkTrees();
    for(const id of Object.keys(els)) render(id);
    tasks(); bar();
    if(ph === "night" && Math.random() < .25) shootingStar(rnd(30, 90), rnd(6, 28), false);
  }
  function skyPos(){
    const h = hourNow();
    if(ph === "night"){ const p = clamp(((h - 21 + 24) % 24) / 9, 0, 1); moon.style.left = (10 + 80 * p) + "%"; moon.style.top = (HZ * .68 - Math.sin(Math.PI * p) * (HZ * .68 - 12)) + "%"; }
    else { const p = clamp((h - 6) / 15, 0, 1); sun.style.left = (8 + 84 * p) + "%"; sun.style.top = (HZ * .8 - Math.sin(Math.PI * p) * (HZ * .8 - 11)) + "%"; }
  }

  /* ---------- eventos ---------- */
  /* si se tocan varias cosas a la vez (una delante de otra), gana aquella cuyo centro está más cerca del dedo */
  function pickIt(e, top){
    if(!top || !e.clientX && !e.clientY) return top;
    let best = top, bd = Infinity;
    for(const el of layer.querySelectorAll(".fm-it")){
      const g = el.querySelector(".fm-e"); if(!g) continue;
      const r = g.getBoundingClientRect(); if(!r.width) continue;
      if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;
      const d = Math.hypot((e.clientX - r.left - r.width / 2) / r.width, (e.clientY - r.top - r.height / 2) / r.height) - (el === top ? .08 : 0);
      if(d < bd){ bd = d; best = el; }
    }
    return best;
  }
  stage.addEventListener("pointerdown", e => {
    if(e.pointerType === "mouse" && e.button !== 0) return;
    const el = pickIt(e, e.target.closest(".fm-it")); if(!el || finding() || el._busy) return;
    const L = layer.getBoundingClientRect(), cs = getComputedStyle(el);
    drag = {id: el.dataset.fid, el, pid: e.pointerId, sx: e.clientX, sy: e.clientY, L,
            ox: e.clientX - L.left - parseFloat(cs.left), oy: e.clientY - L.top - parseFloat(cs.top), on: false};
  });
  stage.addEventListener("pointermove", e => {
    if(!drag || e.pointerId !== drag.pid) return;
    if(!drag.on){
      if(Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return;
      drag.on = true; try{ drag.el.setPointerCapture(e.pointerId); }catch(err){}
      if(ANIM[drag.id]){ freeze(drag.id); busy[drag.id] = true; }
      drag.el.classList.add("drag"); hideBub(); play("tap");
    }
    e.preventDefault();
    const L = drag.L;
    const hw = drag.el._hw || 0;
    drag.x = clamp((e.clientX - L.left - drag.ox) / L.width * 100, Math.max(GR.x0, hw), Math.min(GR.x1, 100 - hw));
    drag.y = clamp((e.clientY - L.top - drag.oy) / L.height * 100, GR.y0, GR.y1);
    put(drag.el, drag.x, drag.y, 0);
  });
  const endDrag = e => {
    if(!drag || e.pointerId !== drag.pid) return;
    const d = drag; drag = null; if(!d.on) return;
    d.el.classList.remove("drag"); justDragged = now();
    if(isFinite(d.x)){
      upd(st => st.pos[d.id] = {x: r1(d.x), y: r1(d.y)});
      if(ANIM[d.id]) live[d.id] = {x: d.x, y: d.y};
      const t = topOf(d.el, 1); puffs(t.x - 2, t.y, 1); puffs(t.x + 2, t.y, 1);
    }
    cls(d.el, "land", 400); play("pop");
    if(ANIM[d.id]){ busy[d.id] = false; resume(d.id, 3000); }
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("click", e => {
    if(now() - justDragged < 350) return;
    const t = e.target;
    if(t.closest(".fm-bub, .fm-find, .fm-hint")) return;
    const it = pickIt(e, t.closest(".fm-it")); if(it) return tap(it.dataset.fid, e);
    const pr = t.closest(".fm-prod"); if(pr){ if(!finding()) collect(pr.dataset.pk, pr); return; }
    /* el personaje no tapa nada: se le toca solo si debajo no hay otra cosa */
    const hr = hero.querySelector(".fm-hb").getBoundingClientRect();
    if(e.clientX >= hr.left && e.clientX <= hr.right && e.clientY >= hr.top && e.clientY <= hr.bottom) return tapHero();
    if(finding()) return;
    if(t.closest(".fm-sun")) return tapSky("sol", sun);
    if(t.closest(".fm-moon")) return tapSky("luna", moon);
    const cl = t.closest(".fm-cloud"); if(cl) return tapCloud(cl);
    const L = layer.getBoundingClientRect(), x = (e.clientX - L.left) / L.width * 100, y = (e.clientY - L.top) / L.height * 100;
    if(!isFinite(x) || !isFinite(y)) return;
    hideBub();
    if(y >= HZ + 2){ fx("", x, y, "fm-ring", 650); play("tap"); walkTo(x, y); }
    else if(ph === "night") shootingStar(x, y, true);
    else butterfly(x, y);
  });
  hero.addEventListener("keydown", e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); tapHero(); } });
  fb.addEventListener("click", e => {
    if(e.target.closest(".fm-fq")) return exitFind();
    if(e.target.closest(".fm-fa")){ if(finding()) return; F = null; startFind(); }
  });
  hint.addEventListener("click", e => { if(e.target.closest(".fm-hx")) setWater(false); });
  let wT = 0;
  bWater.onclick = () => { if(now() - wT < 500) return; wT = now(); setWater(!waterMode); };   /* doble toque = un toque */
  bFind.onclick = startFind;
  bHelp.onclick = openHelp;
  tasksEl.addEventListener("click", e => {
    const c = e.target.closest("[data-fk]"); if(!c) return;
    const k = c.dataset.fk; play("tap");
    if(k === "p") stage.querySelectorAll(".fm-prod").forEach(b => cls(b, "hl", 2500));
    for(const it of owned()){
      const id = it.id, kk = kindOf(id), el = els[id]; if(!el) continue;
      const hit = (k === "h" && kk === "animal" && hungry(id)) || (k === "w" && kk === "plant" && plant(id).s < 2 && canWater(id)) || (k === "r" && kk === "plant" && plant(id).s >= 2 && !TREE[id]);
      if(!hit) continue;
      if(ANIM[id]){ freeze(id); resume(id, 2700); }
      cls(el, "hl", 2500);
    }
    if(k === "w" && !waterMode) setWater(true);
    showStage();
  });

  /* girar el móvil o cambiar el tamaño de la ventana: se recoloca (o se vuelve a montar si cambia de móvil a escritorio) */
  function onResize(){
    if(!isOn()) return stop();
    cancel(rzT);
    rzT = later(() => {
      if(matchMedia("(max-width:560px)").matches !== narrow && !finding() && !dlgOpen() && !drag) return mount(host);
      for(const id of Object.keys(els)){ els[id]._hw = halfW(id); const p = posOf(id); if(p && !els[id].classList.contains("walk")) put(els[id], p.x, p.y, 0); }
    }, 350);
  }

  /* ---------- arranque ---------- */
  for(const it of items) makeItem(it);
  for(const k of Object.keys(s.prod)) makeProd(k, false);
  layer.appendChild(hero);
  skyPos(); checkTrees(); tasks(); bar();
  for(const id of Object.keys(els)) if(ANIM[id]) wt[id] = later(() => wander(id), rnd(400, 2600));
  every(tick, 15000);
  window.addEventListener("resize", onResize);
  if(s.wpend) later(() => { const g = s.wpend === "gift"; upd(st => delete st.wpend); welcome(g); }, 450);
  else if(fresh.length){
    const id = fresh[fresh.length - 1], it = itemById(id), k = kindOf(id);
    later(() => { if(els[id]) bubble(wordBub(it.e, iw(it), it.n, k === "animal" ? "¡Nuevo! Tiene hambre 🌾" : k === "plant" ? "¡Nuevo! Riégalo 💧" : "¡Nuevo! Tócalo ✨"), els[id], 4500); }, 600);
  } else if(news > 0) later(() => bubble(msg(`📚 ¡Ganaste ${news} 💧 de agua extra por aprender!<br>Pulsa «Regar» para usarla.`), hero, 5000), 600);
  return api;
}
farmMount._mount = mount;

/* ---------- estilos ---------- */
function css(){
  if(document.getElementById("css-farm")) return;
  const cur = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><text x='2' y='26' font-size='24'>💧</text></svg>")}") 10 26, pointer`;
  const st = document.createElement("style"); st.id = "css-farm";
  st.textContent = `
.fm{position:relative;margin:4px 0 6px}
.fm-stage{--hz:50%;position:relative;height:340px;border-radius:22px;overflow:hidden;box-shadow:var(--shadow);user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;isolation:isolate;cursor:pointer;touch-action:manipulation;
  --sky1:#2f86d9;--sky2:#7cc3f2;--sky3:#d2efff;--h1:#5aa84a;--h2:#7db86e;--g1:#66bd4c;--g2:#3c9431;--g3:#2f7d27;--path:#d9b67c;--path2:#c39a5c;--fence:#8a5a2b;--cloud:#fff;--cloudo:.95}
.fm-stage[data-ph=dawn]{--sky1:#1d4a80;--sky2:#6b9cc8;--sky3:#f2c46c;--h1:#4b8e44;--h2:#6a9c68;--g1:#5aab48;--g2:#37862f;--g3:#2b6f25;--cloud:#fff1d6}
.fm-stage[data-ph=dusk]{--sky1:#0f2a52;--sky2:#3a6390;--sky3:#e8963b;--h1:#3c6f3c;--h2:#4f7660;--g1:#4d9640;--g2:#2f7429;--g3:#255f21;--path:#b8925c;--path2:#9c7a48;--fence:#6e4823;--cloud:#f0cf9c}
.fm-stage[data-ph=night]{--sky1:#040c1c;--sky2:#0a2040;--sky3:#173a5f;--h1:#16402a;--h2:#1b3a37;--g1:#1f4f2a;--g2:#163c1f;--g3:#102f17;--path:#5e5038;--path2:#4b3f2b;--fence:#3f2c1b;--cloud:#5d7192;--cloudo:.6}
[data-theme=dark] .fm-stage{box-shadow:0 0 0 1px var(--line),var(--shadow)}
.fm-sky{position:absolute;inset:0;background:linear-gradient(var(--sky1) 0%,var(--sky2) calc(var(--hz) * .56),var(--sky3) var(--hz))}
.fm-stars{position:absolute;inset:0 0 calc(100% - var(--hz)) 0;opacity:0;transition:opacity 2s;pointer-events:none}
.fm-stage[data-ph=night] .fm-stars{opacity:1}.fm-stage[data-ph=dusk] .fm-stars,.fm-stage[data-ph=dawn] .fm-stars{opacity:.35}
.fm-stars i{position:absolute;border-radius:50%;background:#fff;box-shadow:0 0 6px 1px rgba(255,255,255,.8);animation:fmTw 2.6s ease-in-out infinite}
.fm-sun,.fm-moon{position:absolute;display:none;border:0;padding:0;border-radius:50%;transform:translate(-50%,-50%);z-index:1;cursor:pointer;-webkit-tap-highlight-color:transparent}
.fm-stage:not([data-ph=night]) .fm-sun,.fm-stage[data-ph=night] .fm-moon{display:block}
.fm-sun{width:56px;height:56px;background:radial-gradient(circle at 40% 38%,#fffbe0 0,#ffe066 45%,#f5b800 100%);box-shadow:0 0 0 9px rgba(255,214,80,.22),0 0 46px 16px rgba(255,200,60,.45)}
.fm-sun::before{content:"";position:absolute;inset:-20px;border-radius:50%;background:repeating-conic-gradient(rgba(255,215,90,.55) 0 7deg,transparent 7deg 22deg);-webkit-mask:radial-gradient(circle,transparent 48%,#000 50%,transparent 71%);mask:radial-gradient(circle,transparent 48%,#000 50%,transparent 71%);animation:fmSpin 40s linear infinite;z-index:-1}
.fm-stage[data-ph=dawn] .fm-sun,.fm-stage[data-ph=dusk] .fm-sun{background:radial-gradient(circle at 40% 38%,#fff2c8 0,#ffc24d 45%,#ee8a1c 100%);box-shadow:0 0 0 9px rgba(255,170,60,.22),0 0 50px 20px rgba(255,160,50,.45)}
.fm-moon{width:44px;height:44px;background:radial-gradient(circle at 62% 38%,rgba(0,0,0,.07) 0 5px,transparent 6px),radial-gradient(circle at 36% 64%,rgba(0,0,0,.06) 0 4px,transparent 5px),radial-gradient(circle at 35% 35%,#fffdf2,#ece4c2 62%,#d6cca2);box-shadow:0 0 26px 8px rgba(240,232,190,.35)}
.fm-cloud{position:absolute;left:-30%;width:96px;height:30px;border:0;padding:0;border-radius:30px;background:var(--cloud);opacity:var(--cloudo);animation:fmDrift 90s linear infinite;z-index:2;cursor:pointer;-webkit-tap-highlight-color:transparent}
.fm-cloud::before,.fm-cloud::after{content:"";position:absolute;background:var(--cloud);border-radius:50%}
.fm-cloud::before{width:44px;height:44px;left:14px;top:-22px}.fm-cloud::after{width:32px;height:32px;left:50px;top:-14px}
.fm-rain{position:absolute;left:4px;right:4px;top:100%;height:120px;pointer-events:none}
.fm-rain i{position:absolute;top:0;width:3px;height:12px;border-radius:3px;background:rgba(150,200,255,.95);animation:fmRain .6s linear infinite}
.fm-hills{position:absolute;left:0;top:calc(var(--hz) - 22%);width:100%;height:23%;z-index:3;pointer-events:none}
.fm-hills .h2{fill:var(--h2)}.fm-hills .h1{fill:var(--h1)}
.fm-ground{position:absolute;left:0;right:0;top:var(--hz);bottom:0;z-index:3;background:radial-gradient(circle at 30% 40%,rgba(255,255,255,.09) 0 2px,transparent 3px) 0 0/23px 19px,radial-gradient(circle at 70% 70%,rgba(0,0,0,.07) 0 2px,transparent 3px) 0 0/29px 23px,linear-gradient(var(--g1),var(--g2))}
.fm-path{position:absolute;left:0;top:var(--hz);width:100%;height:calc(100% - var(--hz));z-index:3;pointer-events:none}
.fm-path path{fill:var(--path);stroke:var(--path2);stroke-width:2;vector-effect:non-scaling-stroke}
.fm-fence{position:absolute;left:0;width:61%;top:calc(var(--hz) - 21px);height:24px;z-index:3;pointer-events:none;opacity:.85;
  background:linear-gradient(var(--fence),var(--fence)) 0 6px/100% 4px no-repeat,linear-gradient(var(--fence),var(--fence)) 0 15px/100% 4px no-repeat,repeating-linear-gradient(90deg,transparent 0 14px,var(--fence) 14px 20px,transparent 20px 44px)}
.fm-fence.r{left:76%;width:24%}
.fm-blades{position:absolute;left:0;bottom:0;width:100%;height:16px;z-index:3;pointer-events:none}
.fm-blades path{fill:var(--g3)}
.fm-flies{position:absolute;inset:var(--hz) 0 0 0;z-index:4;pointer-events:none;opacity:0;transition:opacity 2s}
.fm-stage[data-ph=night] .fm-flies{opacity:1}.fm-stage[data-ph=dusk] .fm-flies{opacity:.5}
.fm-flies i{position:absolute;width:5px;height:5px;border-radius:50%;background:#eaff8a;box-shadow:0 0 10px 4px rgba(214,255,110,.55);animation:fmFly 6s ease-in-out infinite alternate}
.fm-layer{position:absolute;inset:0;z-index:5;pointer-events:none}
.fm-layer>*{pointer-events:auto}.fm-layer>.fm-fx{pointer-events:none}
.fm-it{position:absolute;display:flex;align-items:flex-end;justify-content:center;border:0;background:none;padding:0;margin:0;color:inherit;font-size:2.6rem;line-height:1;min-width:52px;min-height:52px;cursor:pointer;touch-action:none;-webkit-tap-highlight-color:transparent;
  transform:translate(-50%,-100%) scale(var(--d,1));transform-origin:50% 100%;transition:left var(--t,0ms) linear,top var(--t,0ms) linear,transform var(--t,0ms) linear}
.fm-it.bg{font-size:3.6rem}.fm-it.xl{font-size:4.3rem}
.fm-it.sd0{font-size:1.8rem}.fm-it.sd1{font-size:2.2rem}.fm-it.bg.sd0{font-size:1.9rem}.fm-it.bg.sd1{font-size:2.5rem}
.fm-it:focus-visible,.fm-prod:focus-visible{outline:3px solid #fff;outline-offset:3px;border-radius:12px}
.fm-stage.watering .fm-it.k-plant{cursor:${cur}}
.fm-stage.watering .fm-it:not(.k-plant),.fm-stage.watering .fm-prod{filter:saturate(.55) brightness(.92)}
.fm-body{position:relative;display:block;transform:scaleX(var(--fx,1));transition:transform .2s}
.fm-e{position:relative;display:block;line-height:1.05;transform-origin:50% 90%;filter:drop-shadow(0 2px 1px rgba(0,0,0,.18))}
.fm-sh{position:absolute;left:50%;bottom:-.04em;width:.9em;height:.2em;border-radius:50%;background:rgba(0,0,0,.2);transform:translateX(-50%);pointer-events:none}
.fm-it.fly .fm-e{translate:0 -.45em;animation:fmHover 1.3s ease-in-out infinite}
.fm-it.fly .fm-sh{width:.5em;opacity:.6}
.fm-it.walk .fm-e{animation:fmWalk .42s ease-in-out infinite alternate}
.fm-it.hopper.walk .fm-e{animation:fmBunny .5s ease-out infinite}
.fm-it.ripe .fm-e{animation:fmRipe 1.6s ease-in-out infinite;filter:drop-shadow(0 0 6px rgba(255,224,110,.95)) drop-shadow(0 2px 1px rgba(0,0,0,.18))}
.fm-it.lit::before{content:"";position:absolute;left:50%;top:40%;width:190%;height:160%;transform:translate(-50%,-50%);background:radial-gradient(closest-side,rgba(255,213,92,.65),rgba(255,213,92,0));pointer-events:none}
.fm-it.lit .fm-e{filter:drop-shadow(0 0 10px rgba(255,214,90,.95))!important}
.fm-stage[data-ph] .fm-it.ripe .fm-e{filter:drop-shadow(0 0 7px rgba(255,224,110,.95)) drop-shadow(0 2px 1px rgba(0,0,0,.18))}
.fm-stage[data-ph=night] .fm-it .fm-e,.fm-stage[data-ph=night] .fm-hb{filter:brightness(.8) saturate(.85) drop-shadow(0 2px 1px rgba(0,0,0,.25))}
.fm-stage[data-ph=dusk] .fm-it .fm-e,.fm-stage[data-ph=dusk] .fm-hb{filter:brightness(.93) drop-shadow(0 2px 1px rgba(0,0,0,.2))}
.fm-it.peck .fm-e{animation:fmPeck .7s ease}
.fm-it.wig .fm-e{animation:fmWig .7s ease}
.fm-it.eat .fm-e{animation:fmEat .32s ease-in-out 4}
.fm-it.hop .fm-e{animation:fmHop .55s ease}
.fm-it.no .fm-e{animation:fmShake .45s ease}
.fm-it.new .fm-e{animation:fmPop .75s cubic-bezier(.3,1.6,.5,1)}
.fm-it.grow .fm-e{animation:fmGrow .7s cubic-bezier(.3,1.6,.5,1)}
.fm-it.pluck .fm-e{animation:fmPluck .45s ease-in forwards}
.fm-it.land .fm-e{animation:fmLand .35s ease}
.fm-it.hl .fm-e{animation:fmHl .8s ease-in-out 3}
.fm-it.hl .fm-sh{background:radial-gradient(closest-side,rgba(242,201,76,.95),rgba(242,201,76,0));width:1.5em;height:.45em;bottom:-.2em}
.fm-it.fly2 .fm-sh{opacity:0}
.fm-it.drag{transition:none!important;cursor:grabbing;z-index:2000!important}
.fm-it.drag .fm-e{translate:0 -.25em;scale:1.15;animation:none}
.fm-it.fly.drag .fm-e{translate:0 -.6em}
.fm-it.drag .fm-sh{width:1.1em;opacity:.6}
.fm-need{position:absolute;left:58%;bottom:80%;font-size:.42em;line-height:1;background:#fff;border-radius:50%;width:1.9em;height:1.9em;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.25);animation:fmBob 1.6s ease-in-out infinite;pointer-events:none}
.fm-need::before,.fm-need::after{content:"";position:absolute;background:inherit;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.fm-need::before{width:.42em;height:.42em;left:-.12em;bottom:-.28em}.fm-need::after{width:.24em;height:.24em;left:-.42em;bottom:-.6em}
.fm-need.w{background:#e3f1ff}
.fm-it.bg .fm-need{font-size:.32em}
.fm-it.er .fm-need{left:auto;right:58%}.fm-it.er .fm-need::before{left:auto;right:-.12em}.fm-it.er .fm-need::after{left:auto;right:-.42em}
.fm-it.er .fm-zz{left:auto;right:60%}
.fm-stage.watering .fm-need.w{animation:fmPulse .9s ease-in-out infinite}
.fm-stage.finding .fm-need,.fm-stage.finding .fm-zz,.fm-stage.finding .fm-spk{display:none}
.fm-zz{position:absolute;left:60%;bottom:76%;font-size:.38em;pointer-events:none;animation:fmZz 2.4s ease-in-out infinite}
.fm-spk{position:absolute;inset:-.15em;pointer-events:none}
.fm-spk i{position:absolute;font-style:normal;font-size:.36em;animation:fmTw 1.4s ease-in-out infinite}
.fm-spk i:nth-child(1){left:-.15em;top:0}.fm-spk i:nth-child(2){right:-.2em;top:.55em;animation-delay:.7s}
.fm-layer>.fm-hero{position:absolute;pointer-events:none;transform:translate(-50%,-100%) scale(var(--d,1));transform-origin:50% 100%;transition:left var(--t,0ms) linear,top var(--t,0ms) linear,transform var(--t,0ms) linear;outline:none}
.fm-hero:focus-visible .fm-hb{outline:3px solid #fff;border-radius:12px}
.fm-hero .fm-sh{bottom:2px;width:.8em;height:.18em}
.fm-hf{transform:scaleX(var(--fx,1));transition:transform .2s}
.fm-hb{display:block;filter:drop-shadow(0 3px 2px rgba(0,0,0,.25))}
.fm-hero.walk .fm-hb{animation:fmWalk .3s ease-in-out infinite alternate}
.fm-hero.hop .fm-hb{animation:fmHop .55s ease}
.fm-prod{position:absolute;width:52px;height:52px;border:0;padding:0;border-radius:50%;font-size:1.85rem;line-height:1;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-100%);cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;
  background:radial-gradient(closest-side,rgba(255,255,255,.9) 0 55%,rgba(255,255,255,0));animation:fmGlow 1.8s ease-in-out infinite}
.fm-prod.new{animation:fmDrop .7s cubic-bezier(.3,1.5,.5,1),fmGlow 1.8s ease-in-out .7s infinite}
.fm-prod.hl{animation:fmProdHl .5s ease 5}
.fm-prod.got{animation:fmGot .45s ease-in forwards;pointer-events:none}
.fm-stage[data-ph=night] .fm-prod{background:radial-gradient(closest-side,rgba(255,240,180,.8) 0 55%,rgba(255,240,180,0))}
.fm-fx{position:absolute;transform:translate(-50%,-50%);pointer-events:none;z-index:2500;font-size:1.5rem;line-height:1}
.fm-heart{animation:fmUp 1.3s ease-out forwards}
.fm-ring{width:40px;height:16px;border-radius:50%;border:3px solid rgba(255,255,255,.9);z-index:4;animation:fmRing .6s ease-out forwards}
.fm-drip{font-size:1.1rem;animation:fmDrip .7s ease-in forwards}
.fm-sp{font-size:.9rem}
.fm-puff{width:16px;height:16px;border-radius:50%;background:rgba(235,240,245,.9);animation:fmPuff 1.4s ease-out forwards}
.fm-fire{transform:translate(-50%,-100%);font-size:1.8rem;transform-origin:50% 100%;animation:fmFire .35s ease-in-out infinite alternate;filter:drop-shadow(0 0 10px rgba(255,170,40,.9))}
.fm-fw{width:6px;height:6px;border-radius:50%;background:#fff;color:var(--c,#f2c94c);box-shadow:0 -28px 0 2px currentColor,20px -20px 0 2px #5aa2ff,28px 0 0 2px currentColor,20px 20px 0 2px #45cf8b,0 28px 0 2px currentColor,-20px 20px 0 2px #5aa2ff,-28px 0 0 2px currentColor,-20px -20px 0 2px #45cf8b;animation:fmFw 1.1s ease-out forwards}
.fm-leaf{font-size:1.1rem;animation:fmLeaf 1.6s ease-in forwards}
.fm-burst{font-size:1.2rem;animation:fmBurst .9s ease-out forwards}
.fm-bfly{font-size:1.6rem;animation:fmBfly 2.6s ease-in-out forwards,fmFlap .18s ease-in-out infinite alternate}
.fm-shoot{width:90px;height:3px;border-radius:3px;background:linear-gradient(90deg,#fff,rgba(255,255,255,0));transform:translate(-50%,-50%) rotate(-24deg);animation:fmShoot 1s ease-out forwards}
.fm-flame{position:absolute;left:50%;top:80%;font-size:.5em;transform:translateX(-50%) rotate(180deg);pointer-events:none;animation:fmFire .2s ease-in-out infinite alternate}
.fm-flyc{position:fixed;z-index:1000;font-size:2rem;line-height:1;pointer-events:none}
.fm-bub{position:absolute;z-index:3000;transform:translate(-50%,-100%);transform-origin:50% 100%;background:#fff;color:#16202c;border-radius:16px;padding:6px 6px 6px 12px;box-shadow:0 8px 22px rgba(0,0,0,.28);display:flex;align-items:center;gap:8px;white-space:nowrap;width:max-content;max-width:min(calc(100% - 12px),380px);box-sizing:border-box;pointer-events:none;cursor:default}
.fm-bub[hidden]{display:none}
.fm-bub.below{transform:translate(-50%,0);transform-origin:50% 0}
.fm-bub.in{animation:fmBubIn .22s ease-out}
.fm-bub::after{content:"";position:absolute;top:100%;left:var(--tail,50%);transform:translateX(-50%);border:9px solid transparent;border-top-color:#fff}
.fm-bub.below::after{top:auto;bottom:100%;border-top-color:transparent;border-bottom-color:#fff}
.fm-be{font-size:1.9rem;line-height:1;display:flex;align-items:center;gap:2px}.fm-be small{font-size:.9rem;color:#5b6778}
.fm-bt{display:flex;flex-direction:column;line-height:1.15;min-width:0}
.fm-bt b{font-size:1.25rem}.fm-bt small{color:#5b6778;font-size:.9rem;font-weight:600}
.fm-bt i{font-style:normal;font-size:.85rem;color:#1a6fc4;font-weight:800;white-space:normal;line-height:1.2}
.fm-pe{display:inline-block;line-height:1}.fm-pe-lana{filter:grayscale(1) brightness(1.32)}
.fm-sg{display:flex;gap:4px;flex:none}
.fm-bub .say,.fm-find .say{pointer-events:auto;width:44px;height:44px;flex:none;background:#edf3fa;border:1px solid #cfd8e3;color:#16202c;font-size:1.15rem}
.fm-bm{white-space:normal;font-weight:700;font-size:1rem;line-height:1.3;padding:4px 6px 4px 0;max-width:260px}
.fm-find{position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:3100;background:#fff;color:#16202c;border-radius:18px;padding:6px 8px;box-shadow:0 8px 24px rgba(0,0,0,.3);display:flex;align-items:center;gap:8px;max-width:calc(100% - 16px);width:max-content;cursor:default}
.fm-find[hidden]{display:none}
.fm-fh{flex:none;line-height:0;padding:0 2px 4px}
.fm-ft{display:flex;flex-direction:column;line-height:1.1;min-width:0;gap:2px}
.fm-ft small{color:#5b6778;font-weight:700;font-size:.82rem}
.fm-ft b{font-size:1.35rem;color:#0f3d75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fm-ft em{font-style:normal;font-weight:800;color:#8a6516}.fm-ft em.m{color:#5b6778;font-size:.8rem;font-weight:700}
.fm-dots{display:flex;gap:4px;margin-top:2px}
.fm-dots i{width:10px;height:10px;border-radius:50%;background:#dfe4eb}
.fm-dots i.ok{background:#1f9d62}.fm-dots i.no{background:#d64545}.fm-dots i.now{background:#fff;box-shadow:0 0 0 2px #1f6fd1}
.fm-fq{flex:none;width:44px;height:44px;border:0;border-radius:12px;background:#edf3fa;color:#46566c;font-size:1.1rem;font-weight:800}
.fm-fa{flex:none;min-height:44px;border:0;border-radius:12px;background:#2e9e4f;color:#fff;font-weight:800;padding:0 12px;box-shadow:0 3px 0 #1e6e36}
.fm-hint{position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:3050;background:rgba(11,37,69,.9);color:#fff;border-radius:999px;padding:5px 6px 5px 16px;font-weight:700;display:flex;align-items:center;gap:10px;white-space:nowrap;width:max-content;max-width:calc(100% - 16px);box-sizing:border-box;line-height:1.2;cursor:default;box-shadow:0 6px 16px rgba(0,0,0,.3)}
.fm-hint[hidden]{display:none}
.fm-hint span{white-space:normal}
.fm-hx{flex:none;min-height:44px;border:0;border-radius:999px;background:#fff;color:#0b2545;font-weight:800;padding:0 14px}
.fm-bar{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;margin:12px 0 8px}
.fm-bar .fm-tb{min-height:56px;font-size:1.08rem;border-radius:16px;display:flex;align-items:center;justify-content:center;gap:8px;line-height:1.15;padding:8px 14px;text-align:center}
.fm-bar .fm-tb .ic{font-size:1.5rem;line-height:1}
.fm-bar .fm-help{width:58px;padding:0;font-size:1.6rem;font-weight:900}
.fm-bar .fm-tb.on{box-shadow:0 0 0 4px color-mix(in srgb,var(--lc) 35%,transparent),0 4px 0 color-mix(in srgb,var(--lc) 60%,#000)}
.fm-bar .fm-tb:active{transform:translateY(3px);box-shadow:0 1px 0 color-mix(in srgb,var(--lc) 60%,#000)}
.fm-bar .fm-tb.nudge{animation:fmNudge .6s ease 2}
.fm-badge{background:#fff;color:#0f3d75;border-radius:99px;padding:1px 8px;font-size:.85rem;font-weight:800}
.fm-badge[hidden]{display:none}
.fm-tasks{display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-height:44px}
.fm-chip{display:inline-flex;align-items:center;gap:6px;min-height:44px;border:2px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 14px;font-weight:700;font-size:.98rem}
.fm-chip b{font-size:1.1rem}
.fm-chip.c-h{border-color:#c9962b}.fm-chip.c-p{border-color:#13887f}.fm-chip.c-w{border-color:#1f6fd1}.fm-chip.c-r{border-color:#2e9e4f}
.fm-note{color:var(--muted);font-weight:700}
.fm-dlg{width:min(94vw,440px);text-align:center;padding:18px 16px}
.fm-dlg h2{margin:0 0 6px;color:var(--ink)}
.fm-wel{font-size:3.6rem;line-height:1.1;animation:fmPop .7s cubic-bezier(.3,1.6,.5,1)}
.fm-sub{color:var(--muted);margin:0 0 10px;font-size:1.05rem}
.fm-qe{position:relative;display:inline-block;font-size:4.2rem;line-height:1;margin:4px 0 6px}
.fm-qb{position:absolute;left:88%;top:-.25em;font-size:1.5rem;animation:fmBob 1.6s ease-in-out infinite}
.fm-qt{font-size:1.2rem;font-weight:700;margin:4px 0 14px;line-height:1.35}
.fm-qt b{color:var(--brand)}
.fm-opts{display:grid;gap:10px}
.fm-or{display:flex;gap:8px;align-items:stretch}
.fm-opt{flex:1;min-height:58px;border:3px solid var(--line);background:var(--card);color:var(--ink);border-radius:16px;font-size:1.25rem;font-weight:800;padding:8px 12px;box-shadow:0 4px 0 var(--line);transition:transform .08s}
.fm-opt:active{transform:translateY(3px);box-shadow:0 1px 0 var(--line)}
.fm-opt.ok{border-color:var(--ok);background:color-mix(in srgb,var(--ok) 16%,var(--card));box-shadow:0 4px 0 color-mix(in srgb,var(--ok) 60%,#000)}
.fm-opt.bad{border-color:var(--bad);background:color-mix(in srgb,var(--bad) 12%,var(--card));opacity:.75;cursor:not-allowed}
.fm-opt.hint{border-color:var(--ok);animation:fmHint .9s ease-in-out infinite}
.fm-or .say{width:58px;height:auto;min-height:58px;border-radius:16px;font-size:1.35rem;flex:none}
.fm-qm{min-height:1.6em;font-weight:700;font-size:1.12rem;margin:12px 0 8px}
.fm-qm.ok{color:var(--ok)}.fm-qm.bad{color:var(--bad)}
.fm-dlg .fm-x{min-height:44px}
.fm-dlg .btn.lc{min-height:50px;font-size:1.1rem}
.fm-help-l{list-style:none;padding:0;margin:8px 0 14px;text-align:left;display:grid;gap:7px}
.fm-help-l li{display:flex;gap:12px;align-items:center;background:var(--soft);border-radius:14px;padding:7px 12px;font-size:1rem;line-height:1.3}
.fm-help-l li span{font-size:1.6rem;flex:none;width:34px;text-align:center}
@keyframes fmTw{0%,100%{opacity:.3;scale:.7}50%{opacity:1;scale:1.1}}
@keyframes fmSpin{to{rotate:360deg}}
@keyframes fmDrift{from{left:-30%}to{left:110%}}
@keyframes fmRain{from{translate:0 0;opacity:1}to{translate:-6px 110px;opacity:0}}
@keyframes fmFly{0%{translate:0 0;opacity:.3}33%{translate:22px -14px;opacity:1}66%{translate:-12px -26px;opacity:.5}100%{translate:16px 8px;opacity:1}}
@keyframes fmHover{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes fmWalk{from{transform:translateY(0) rotate(-5deg)}to{transform:translateY(-3px) rotate(5deg)}}
@keyframes fmBunny{0%,100%{transform:translateY(0)}45%{transform:translateY(-12px) rotate(-6deg)}}
@keyframes fmRipe{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes fmPeck{0%,100%{transform:rotate(0)}30%,62%{transform:rotate(-20deg) translateY(3px)}46%{transform:rotate(-8deg)}}
@keyframes fmWig{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
@keyframes fmEat{0%,100%{transform:scale(1,1)}50%{transform:scale(1.08,.88) rotate(-5deg)}}
@keyframes fmHop{0%,100%{transform:translateY(0) scale(1)}40%{transform:translateY(-38%) scale(1.12)}72%{transform:translateY(0) scale(1.06,.92)}}
@keyframes fmShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}
@keyframes fmPop{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes fmGrow{from{transform:scale(.4)}to{transform:scale(1)}}
@keyframes fmPluck{to{transform:translateY(-70%) scale(.3);opacity:0}}
@keyframes fmLand{0%{transform:scale(1.12,.85)}100%{transform:scale(1)}}
@keyframes fmHl{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-14%) scale(1.15)}}
@keyframes fmBob{0%,100%{translate:0 0}50%{translate:0 -4px}}
@keyframes fmPulse{0%,100%{scale:1}50%{scale:1.3}}
@keyframes fmZz{0%{translate:0 0;opacity:0}30%{opacity:1}100%{translate:8px -16px;opacity:0}}
@keyframes fmGlow{0%,100%{filter:drop-shadow(0 0 2px rgba(255,214,90,.6))}50%{filter:drop-shadow(0 0 10px rgba(255,214,90,1))}}
@keyframes fmDrop{0%{translate:0 -50px;scale:.3;opacity:0}60%{translate:0 4px;scale:1.12;opacity:1}100%{translate:0 0;scale:1}}
@keyframes fmProdHl{0%,100%{scale:1}50%{scale:1.3}}
@keyframes fmGot{to{scale:1.7;opacity:0}}
@keyframes fmUp{0%{translate:0 0;opacity:0;scale:.5}20%{opacity:1;scale:1.15}100%{translate:0 -70px;opacity:0;scale:1}}
@keyframes fmRing{from{scale:.3;opacity:1}to{scale:1.6;opacity:0}}
@keyframes fmDrip{0%{translate:0 -36px;opacity:0}30%{opacity:1}100%{translate:0 6px;opacity:0}}
@keyframes fmPuff{0%{scale:.4;opacity:.95}100%{translate:14px -60px;scale:2;opacity:0}}
@keyframes fmFire{from{scale:1 1}to{scale:1.08 .86}}
@keyframes fmFw{0%{scale:.1;opacity:1}70%{opacity:1}100%{scale:1.7;opacity:0}}
@keyframes fmLeaf{0%{translate:0 0;rotate:0deg;opacity:1}100%{translate:18px 50px;rotate:120deg;opacity:0}}
@keyframes fmBurst{from{translate:0 0;scale:.4;opacity:1}to{translate:var(--dx) var(--dy);scale:1.1;opacity:0}}
@keyframes fmBfly{0%{translate:0 0;opacity:0}10%{opacity:1}30%{translate:34px -24px}55%{translate:66px 6px}80%{translate:104px -30px;opacity:1}100%{translate:140px -64px;opacity:0}}
@keyframes fmFlap{from{scale:1 1}to{scale:.55 1}}
@keyframes fmShoot{0%{translate:0 0;opacity:0}20%{opacity:1}100%{translate:-170px 76px;opacity:0}}
@keyframes fmBubIn{from{scale:.6;opacity:0}to{scale:1;opacity:1}}
@keyframes fmNudge{0%,100%{translate:0 0}25%{translate:0 -6px}50%{translate:0 0}75%{translate:0 -3px}}
@keyframes fmHint{0%,100%{box-shadow:0 4px 0 var(--line),0 0 0 0 rgba(31,157,98,.55)}50%{box-shadow:0 4px 0 var(--line),0 0 0 8px rgba(31,157,98,0)}}
.fm-stage.crowd{height:400px}
.fm-stage.crowd .fm-it{font-size:2.3rem}.fm-stage.crowd .fm-it.bg{font-size:3.1rem}.fm-stage.crowd .fm-it.xl{font-size:3.7rem}
.fm-stage.crowd .fm-it.sd0{font-size:1.6rem}.fm-stage.crowd .fm-it.sd1{font-size:1.95rem}.fm-stage.crowd .fm-it.bg.sd0{font-size:1.7rem}.fm-stage.crowd .fm-it.bg.sd1{font-size:2.2rem}
@media (max-width:560px){
  .fm-stage{height:300px;border-radius:18px}
  .fm-stage.crowd{height:390px}
  .fm-stage.crowd .fm-it{font-size:1.9rem}.fm-stage.crowd .fm-it.bg{font-size:2.6rem}.fm-stage.crowd .fm-it.xl{font-size:3rem}
  .fm-stage.crowd .fm-it.sd0{font-size:1.45rem}.fm-stage.crowd .fm-it.sd1{font-size:1.7rem}.fm-stage.crowd .fm-it.bg.sd0{font-size:1.5rem}.fm-stage.crowd .fm-it.bg.sd1{font-size:1.85rem}
  .fm-it{font-size:2.2rem}.fm-it.bg{font-size:3rem}.fm-it.xl{font-size:3.5rem}
  .fm-it.sd0{font-size:1.6rem}.fm-it.sd1{font-size:1.9rem}.fm-it.bg.sd0{font-size:1.7rem}.fm-it.bg.sd1{font-size:2.1rem}
  .fm-sun{width:46px;height:46px}
  .fm-bar{grid-template-columns:1fr 1fr 54px;gap:8px}
  .fm-bar .fm-tb{font-size:.98rem;padding:8px 8px;gap:6px}
  .fm-bar .fm-help{width:54px}
  .fm-chip{font-size:.92rem;padding:6px 12px}
  .fm-ft b{font-size:1.2rem}
  .fm-hint{font-size:.92rem;padding-left:12px}
}
@media (prefers-reduced-motion: reduce){
  .fm-cloud{animation:none!important;left:var(--cx)!important}
  .fm-stars i,.fm-flies i,.fm-sun::before,.fm-need,.fm-zz,.fm-spk i,.fm-it.fly .fm-e,.fm-it.walk .fm-e,.fm-it.ripe .fm-e,.fm-prod,.fm-fire,.fm-flame,.fm-qb{animation:none!important}
  .fm-it,.fm-hero{transition:none!important}
}`;
  document.head.appendChild(st);
}
})();
