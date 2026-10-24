/* Módulo farm: la granja viva (#/granja). ROUTES.granja pinta la página y monta la escena con farmMount(host).
   - La escena ocupa toda la pantalla, también bajo la barra de estado (sin título ni ficha del personaje). Quedan la barra
     de arriba y la de pestañas, ligeras (sin desenfoque). Cielo según la hora (amanecer, día, atardecer, noche), nubes,
     sol o luna, estrellas y luciérnagas.
   - Abajo, en el sitio del accesorio «Seguir» (que en la granja no sale), un dock de vidrio ligero: Regar · Comida · Tienda.
     Comida abre una bandeja sólida con la comida comprada; Tienda abre una hoja (dos alturas en el móvil) con solo las cosas
     de la granja (piezas de js/shop.js: vocabShop.card(…, {mode: "farm"}) y vocabShop.bind) y la comida. Comprar no vuelve
     a montar la granja: lo nuevo aparece en la escena. La pastilla de monedas de arriba abre la misma hoja.
   - Gestos (siempre hay un toque que hace lo mismo):
       tocar un animal = acariciarlo (corazones, su nombre y su voz; no come) o, si tiene hambre, el globo para darle de comer;
       arrastrar una comida de la bandeja hasta un animal = darle de comer (lo mismo que tocar la comida y luego el animal);
       arrastrar la regadera del dock hasta una planta = regarla (lo mismo que «Regar» y tocar la planta);
       mantener pulsada 500 ms una cosa = levantarla (crece un poco, sombra y vibración); arrastrar = moverla (se guarda en
       farm:state.pos); soltar sin moverla = se queda donde está.
   - Hambre y tareas: un globo encima de cada animal con hambre enseña la comida que pide; el más urgente dice en el idioma
     «I'm hungry!» / «J'ai faim !» / «Jeg er sulten!» (con «¡Tengo hambre!» pequeño y en gris) y lo dice en voz alta una vez
     por animal y visita (al tocarlo, o al entrar si no suena nada). Tocar ese globo es tocar el animal (con hambre, sale
     «¿Qué le das…?» para darle de comer). Gotas sobre las plantas con sed y chispas en las que
     están listas. El globo de comer y «¿Cómo me llamo?» salen junto al animal (no tapan la granja).
   - Después de comer: «¿Cómo me llamo?» con 3 opciones para tocar y, si hay micrófono (canListen()), «Dilo»: lo que el
     reconocedor no entiende nunca cuenta como fallo (se puede tocar). Si la palabra está en el corpus del idioma (CORPUS,
     sacado de data/*.json), acertar la pone en el repaso con srsGrade(tema, {es}, 2), como una lección: solo si es nueva
     o ya le toca (así darle de comer cada día no la infla). También al acertar en «¿Dónde está…?».
   - La primera vez (farm:state.wpend) o con comida de regalo (cnew), una mano animada enseña a arrastrar la comida
     hasta el animal (3 veces; quieta con «Reducir movimiento»).
   - Animales que pasean y dan regalos; plantas que crecen con agua y se cosechan; árboles con fruta o nidos; edificios
     con sorpresa; «¿Dónde está…?» (tocando al personaje); refugio a mitad de precio a los 5 días sin comer (nunca mueren).
   - Fuera de la granja: un punto azul en la pestaña «Granja» si algún animal tiene hambre o si alguno se fue al refugio y
     aún no lo ha visto; ese aviso del refugio también sale en Hoy (HOME_SLOTS, id "granja").
   - Capa vacía <div class="fm-season"> (toda la pantalla, encima del suelo y debajo de los animales, sin recibir toques)
     para las temporadas (js/season.js); al montar: bus "farm-mounted" {stage, season, world, hz}.
   Estado: store "farm:state". Emite: farm-mounted, farm-feed {item, food}, farm-harvest {item}, farm-collect {product},
   farm-find {ok}, farm-buy {food, n, cost}, farm-rescue {item}, coins {n < 0} al gastar.
   Para otros módulos: farmMount.kinds (especies), farmMount.care (consultas de solo lectura) y window.vocabFarm:
   openShop({food, from}) (abre la hoja de la tienda; desde otra pestaña va antes a #/granja), closeShop(), stage. */
function farmMount(host){ return farmMount._mount ? farmMount._mount(host) : null; }
/* pruebas: phase "dawn" | "day" | "dusk" | "night" fuerza la hora del cielo;
   shift (ms) adelanta el reloj de la granja (simular días); tick() repasa la granja montada al momento */
farmMount.debug = {phase: null, shift: 0, tick(){}};

(() => {
"use strict";

/* ---------- comida y cuidado: precios y tiempos ----------
   Economía: una lección da ~10–25 monedas (y el primer premio del día +10). Cada animal come 1 ración al día (5–8) y deja
   1 regalo de 1 moneda (2 si acierta su nombre): mantener 5 animales cuesta ≈ 21–26 al día y los 11 ≈ 47–58, o sea
   1–2 lecciones. Los regalos de los animales valen poco a propósito: si valieran más que la comida, la granja se pagaría
   sola y no haría falta aprender. */
const HOUR = 36e5;
const CARE_V    = 1;              /* versión del cuidado guardada en el estado (migración de granjas antiguas) */
const FULL_H    = 8;              /* tras comer: «¡Está lleno!» durante 8 h (no se gasta comida) */
const HEART_H   = [24, 48, 72];   /* sin comer: 3 corazones → 2 a las 24 h → 1 (triste) a las 48 h → 0 (malito) a las 72 h */
const SHELTER_H = 120;            /* a las 120 h (5 días) sin comer se va al refugio */
const ARRIVE_H  = 24;             /* recién llegados (y todos al actualizar): comieron hace 24 h → 2 corazones */
const RESCUE_H  = 48;             /* rescatado del refugio: comió hace 48 h → 1 corazón */
const MISS_H    = 48;             /* sin venir a la granja 2 días: «¡Te echaban de menos!» */
const PAN_MAX   = 30;             /* raciones como mucho de cada comida */
const PROD_MAX  = 3;              /* regalos de un mismo animal esperando en el suelo */
const WELCOME_FOOD = {grano: 2};  /* el regalo de bienvenida trae comida para la gallina */
const rescuePrice = it => Math.max(1, Math.ceil(((it && it.p) || 2) / 2));   /* la mitad de su precio */
/* c: monedas por ración · a: artículo en español · w: francés con artículo, danés con en/et */
const FOOD = {
  grano:     {e: "🌾", n: "grano",     a: "el", c: 5, w: {english: "grain",  "français": "le grain",   dansk: "et korn"}},
  zanahoria: {e: "🥕", n: "zanahoria", a: "la", c: 6, w: {english: "carrot", "français": "la carotte", dansk: "en gulerod"}},
  heno:      {e: "🌿", n: "heno",      a: "el", c: 7, w: {english: "hay",    "français": "le foin",    dansk: "et hø"}},
  maiz:      {e: "🌽", n: "maíz",      a: "el", c: 8, w: {english: "maize",  "français": "le maïs",    dansk: "en majs"}},
  nectar:    {e: "🌼", n: "néctar",    a: "el", c: 7, w: {english: "nectar", "français": "le nectar",  dansk: "en nektar"}},
};
/* «La granja te habla»: lo que dice un animal con hambre (en el idioma que aprende, con la voz de ese idioma) */
const PHRASE = {english: "I'm hungry!", "français": "J'ai faim !", dansk: "Jeg er sulten!"};
const PHRASE_ES = "¡Tengo hambre!";
/* las cosas de la granja que están en el corpus de cada idioma: id → "tema|es" (la clave del repaso, srsK). Sacado de
   data/*.json: la palabra del idioma sin artículo es la misma y una de las partes del «es» de la fila es su nombre
   (así «maïs» no casa con «pero», ni «ko» con «cola»). Lo que no está aquí no toca el repaso. */
const CORPUS = (() => {
  const all = {gallina: "animales|Gallina", pato: "animales|Pato", conejo: "animales|Conejo", abeja: "animales|Abeja",
    cerdo: "animales|Cerdo", oveja: "animales|Oveja", cabra: "animales|Cabra", pavo: "animales|Pavo", vaca: "animales|Vaca",
    burro: "animales|Burro", caballo: "animales|Caballo", flor: "w09|flor", zanahoria: "w03|zanahoria", trigo: "a46|trigo",
    manzana: "w03|manzana", arbol: "w09|árbol", tienda: "w07|tienda de campaña", castillo: "w06|castillo", cohete: "w17|cohete"};
  return {english: Object.assign({}, all, {casa: "w04|casa"}),
    "français": Object.assign({}, all, {cabana: "a46|cabaña, camarote", casa: "w04|casa, hogar"}),
    dansk: Object.assign({}, all, {cabana: "a46|cabaña, camarote", casa: "w04|casa"})};
})();

/* ---------- datos ---------- */
const KEY = "farm:state";
const WATER = 2 * HOUR, TREE_T = 3 * HOUR, MAX_DROPS = 12, ROUNDS = 5, FIND_PAID = 5;
const GND = {x0: 5, x1: 95, y0: 58, y1: 95};   /* suelo, en % del mundo (punto de apoyo de cada cosa) */

/* p: producto · eats: su comida · f: femenino (para «a la vaca» / «al cerdo») · sp: velocidad (px/s) · r: radio de paseo (%) */
const ANIM = {
  gallina: {p: "huevo", eats: "grano",     f: 1, sp: 26, r: 10, idle: "peck"},
  pato:    {p: "huevo", eats: "grano",           sp: 24, r: 11, idle: "peck"},
  conejo:  {p: "abono", eats: "zanahoria",       sp: 34, r: 12, hop: true},
  abeja:   {p: "miel",  eats: "nectar",    f: 1, sp: 44, r: 18, fly: true},
  cerdo:   {p: "trufa", eats: "maiz",            sp: 20, r: 10},
  oveja:   {p: "lana",  eats: "heno",      f: 1, sp: 18, r: 9},
  cabra:   {p: "queso", eats: "heno",      f: 1, sp: 22, r: 11, idle: "hop"},
  pavo:    {p: "pluma", eats: "grano",           sp: 20, r: 9, idle: "peck"},
  vaca:    {p: "leche", eats: "heno",      f: 1, sp: 15, r: 8, moo: true},
  burro:   {p: "abono", eats: "zanahoria",       sp: 17, r: 9},
  caballo: {p: "abono", eats: "zanahoria",       sp: 30, r: 13},
};
/* monedas al cosechar (0 = árbol: no se cosecha, da productos) */
const PLANT = {flor: 3, girasol: 3, seta: 3, zanahoria: 4, fresa: 4, maiz: 4, calabaza: 5, trigo: 4, manzana: 4, arbol: 0, pino: 0};
const TREE = {arbol: "pera", pino: "nido"};
const BUILD = {tienda: "camp", cabana: "smoke", casa: "light", tractor: "drive", fuente: "spray", castillo: "fire", cohete: "launch"};
const BIG = new Set(["tienda", "cabana", "casa", "tractor", "fuente", "castillo", "cohete", "molino"]);
/* hacia dónde mira el emoji sin voltear: 1 = izquierda, -1 = derecha */
const FACE0 = {oveja: -1, caballo: -1, tractor: -1};
/* los dibujos de cuerpo entero (img/pj) miran todos a la izquierda */
const FACE = new Proxy(FACE0, {get: (o, k) => (typeof pjHas === "function" && pjHas(k)) ? 1 : o[k]});
/* el animal dibujado (o su emoji si no hay dibujo) */
const pj = (it, c) => typeof pjImg === "function" ? pjImg(it, c) : (it && it.e) || "";

/* productos: francés con artículo, danés con en/et · c: monedas al recogerlo (los de los animales, 1: ver «Economía») */
const PROD = {
  huevo: {e: "🥚", n: "un huevo",  c: 1, w: {english: "egg",     "français": "l'œuf (m.)", dansk: "et æg"}},
  pluma: {e: "🪶", n: "una pluma", c: 1, w: {english: "feather", "français": "la plume",   dansk: "en fjer"}},
  abono: {e: "💩", n: "abono",     c: 1, w: {english: "manure",  "français": "le fumier",  dansk: "en gødning"}},
  miel:  {e: "🍯", n: "miel",      c: 1, w: {english: "honey",   "français": "le miel",    dansk: "en honning"}},
  trufa: {e: "🍄", n: "una trufa", c: 1, w: {english: "truffle", "français": "la truffe",  dansk: "en trøffel"}},
  lana:  {e: "🧶", n: "lana",      c: 1, w: {english: "wool",    "français": "la laine",   dansk: "en uld"}},
  queso: {e: "🧀", n: "queso",     c: 1, w: {english: "cheese",  "français": "le fromage", dansk: "en ost"}},
  leche: {e: "🥛", n: "leche",     c: 1, w: {english: "milk",    "français": "le lait",    dansk: "en mælk"}},
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
/* la moneda (la misma que la de js/shop.js y la de arriba) */
const COIN = `<svg class="coin-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="11" fill="#FFCC00"/><circle cx="12" cy="12" r="10.5" fill="none" stroke="#C7A000" stroke-opacity=".8"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#B39000" stroke-opacity=".55" stroke-width="1.4"/><path d="M12 7.8 13.06 10.54 15.99 10.7 13.71 12.56 14.47 15.4 12 13.8 9.53 15.4 10.29 12.56 8.01 10.7 10.94 10.54Z" fill="#A88700" fill-opacity=".8"/></svg>`;
/* la mano que enseña a arrastrar (Phosphor hand-pointing fill, MIT) */
const HAND = `<svg viewBox="0 0 256 256" aria-hidden="true" focusable="false"><path fill="currentColor" d="M224,104v50.93c0,46.2-36.85,84.55-83,85.06A83.71,83.71,0,0,1,80.6,215.4C58.79,192.33,34.15,136,34.15,136a16,16,0,0,1,6.53-22.23c7.66-4,17.1-.84,21.4,6.62l21,36.44a6.09,6.09,0,0,0,6,3.09l.12,0A8.19,8.19,0,0,0,96,151.74V32a16,16,0,0,1,16.77-16c8.61.4,15.23,7.82,15.23,16.43V104a8,8,0,0,0,8.53,8,8.17,8.17,0,0,0,7.47-8.25V88a16,16,0,0,1,16.77-16c8.61.4,15.23,7.82,15.23,16.43V112a8,8,0,0,0,8.53,8,8.17,8.17,0,0,0,7.47-8.25v-7.28c0-8.61,6.62-16,15.23-16.43A16,16,0,0,1,224,104Z"/></svg>`;

/* ---------- utilidades ---------- */
const now = () => { const d = farmMount.debug, sh = d ? Number(d.shift) : 0; return Date.now() + (isFinite(sh) ? sh : 0); };
const RM = () => { try{ return window.M && typeof window.M.rm === "function" ? window.M.rm() : matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };   /* M.rm() de js/motion.js */
const GS = () => window.G && typeof window.G.drag === "function" ? window.G : null;   /* js/gestures.js */
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10;
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const pick = a => a[Math.floor(Math.random() * a.length)];
const play = n => { try{ if(typeof sfx !== "undefined") sfx.play(n); }catch(e){} };
const speak = t => { try{ if(t && "speechSynthesis" in window) say(t); }catch(e){} };
const emit = (e, d) => { try{ bus.emit(e, d); }catch(err){} };
const note = (t, icon) => { try{ if(window.M && typeof M.toast === "function") M.toast(t, icon ? {icon} : {}); }catch(e){} };
const okPos = p => !!p && typeof p === "object" && isFinite(p.x) && isFinite(p.y);
const kindOf = id => ANIM[id] ? "animal" : PLANT[id] !== undefined ? "plant" : BUILD[id] ? "build" : "deco";
const owned = () => { const g = game(); return SHOP.filter(x => x.t === "farm" && g.owned[x.id]); };
const iw = it => itemWord(it);
const pw = p => (p.w && p.w[lang]) || p.n;
const code = () => (LANGS[lang] && LANGS[lang].code) || "en-GB";
const icon = (n, st, z) => typeof ico === "function" ? ico(n, st || "bold", z || 24) : "";
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
/* ¿suena algo ahora? (la voz del navegador o un audio grabado de index.html) */
function sounding(){
  try{ if("speechSynthesis" in window && (speechSynthesis.speaking || speechSynthesis.pending)) return true; }catch(e){}
  try{ return typeof clipEl !== "undefined" && !!clipEl; }catch(e){ return false; }
}
/* lo que oyó el reconocedor: el comparador tolerante del repaso (js/review.js) o, si no está, uno sencillo */
function heard(alts, word){
  try{ if(window.vocabReview && typeof vocabReview.matches === "function") return !!vocabReview.matches(alts, word, lang); }catch(e){}
  const f = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim();
  const bare = s => s.replace(/^(the|a|an|le|la|les|un|une|en|et) /, "").replace(/^l'/, "");
  const w = bare(f(word));
  return !!w && (alts || []).some(a => { const t = f(a); return t === w || bare(t) === w || (" " + t + " ").includes(" " + w + " "); });
}
/* acierto con una palabra de la granja: al repaso con el mismo formato que una lección (clave «tema|es»), si está en el
   corpus del idioma. Solo si es nueva en el repaso o ya le toca: darle de comer cada día no la sube de caja sin repasar */
function srsWord(id){
  try{
    const ref = (CORPUS[lang] || {})[id];
    if(!ref || typeof srsGrade !== "function" || typeof srsAll !== "function") return false;
    const i = ref.indexOf("|"), doc = ref.slice(0, i), es = ref.slice(i + 1), x = srsAll()[doc + "|" + es];
    if(x && typeof today === "function" && x.due > today()) return false;
    srsGrade(doc, {es}, 2);
    return true;
  }catch(e){ console.error(e); return false; }
}

/* ---------- estado ---------- */
/* pan: despensa {comida: raciones} · shelter: {animal: {t: cuándo se fue, seen: si ya vio el aviso}}
   cv: versión del cuidado · visit: última visita a la granja */
const DEF = () => ({welcome: false, pos: {}, fed: {}, prod: {}, pl: {}, tree: {}, seen: {}, drops: 0, dn: 0, hero: null, light: true, fd: {day: "", n: 0},
                    pan: {}, shelter: {}, cv: 0, visit: 0});
function load(){
  let s = store.get(KEY, null); if(!s || typeof s !== "object" || Array.isArray(s)) s = {};
  const d = DEF();
  for(const k of Object.keys(d)){
    const dv = d[k], v = s[k];
    if(v === undefined || (dv && typeof dv === "object" && (!v || typeof v !== "object" || Array.isArray(v)))) s[k] = dv;
  }
  for(const k of ["drops", "dn", "cv", "visit"]) if(typeof s[k] !== "number" || !isFinite(s[k])) s[k] = 0;
  return s;
}
const save = s => store.set(KEY, s);

/* ---------- cuidado de los animales (se calcula sin montar la granja: portada, menú, misiones) ---------- */
const HMS = h => h * HOUR;
const ownedAnimals = () => { const o = (game() || {}).owned || {}; return Object.keys(ANIM).filter(id => o[id]); };
const inShelterS = (s, id) => !!(s.shelter && s.shelter[id]);
const onFarmS = s => ownedAnimals().filter(id => !inShelterS(s, id));
const sinceFed = (s, id) => Math.max(0, now() - (Number(s.fed[id]) || 0));
const okT = v => typeof v === "number" && isFinite(v) && Math.abs(v) <= 8.64e15;   /* una fecha que existe (si no, dato roto) */
/* corazones: 3, 2, 1, 0 (enfermo) en la granja · -1 en el refugio */
function heartsS(s, id){
  if(inShelterS(s, id)) return -1;
  const e = sinceFed(s, id);
  return e < HMS(HEART_H[0]) ? 3 : e < HMS(HEART_H[1]) ? 2 : e < HMS(HEART_H[2]) ? 1 : 0;
}
const canEatS = (s, id) => !inShelterS(s, id) && sinceFed(s, id) >= HMS(FULL_H);
/* los que necesitan comer ya (2 corazones o menos): portada, insignia del menú, globos de la escena */
const needyS = s => onFarmS(s).filter(id => heartsS(s, id) <= 2);
/* pone al día el estado: migración, despensa y refugio a salvo de datos raros, recién llegados, los que se van al refugio */
function careSync(s){
  const t = now(), out = {ch: false, gone: []}, own = (game() || {}).owned || {};
  for(const k of Object.keys(s.pan)){
    const v = Math.floor(Number(s.pan[k]));
    if(!FOOD[k] || !(v > 0)){ delete s.pan[k]; out.ch = true; }
    else if(v !== s.pan[k] || v > PAN_MAX){ s.pan[k] = Math.min(PAN_MAX, v); out.ch = true; }
  }
  for(const k of Object.keys(s.shelter)){
    const v = s.shelter[k];
    if(!ANIM[k] || !own[k] || !v || typeof v !== "object"){ delete s.shelter[k]; out.ch = true; }
    else if(typeof v.t !== "number" || !isFinite(v.t)){ v.t = t; out.ch = true; }
  }
  const ids = ownedAnimals();
  /* primera vez con esta versión: nadie pierde animales por actualizar. Empiezan con 2 corazones (o más si comieron hace
     poco) y, si la granja ya existía, llega un poco de comida de regalo para cada uno */
  if(s.cv !== CARE_V){
    const gift = {};
    for(const id of ids){
      if(inShelterS(s, id)) continue;
      const f = s.fed[id];
      s.fed[id] = okT(f) && f > t - HMS(ARRIVE_H) ? f : t - HMS(ARRIVE_H);
      const fd = ANIM[id].eats; gift[fd] = (gift[fd] || 0) + 1;
    }
    if(Object.keys(gift).length){
      for(const k of Object.keys(gift)) s.pan[k] = Math.min(PAN_MAX, (s.pan[k] || 0) + gift[k]);
      s.cnew = gift;
    }
    if(!(s.visit > 0)) s.visit = t;
    s.cv = CARE_V; out.ch = true;
  }
  for(const id of ids){
    if(inShelterS(s, id)) continue;
    let f = s.fed[id];
    if(!okT(f)){ f = s.fed[id] = t - HMS(ARRIVE_H); out.ch = true; }   /* recién llegado (o dato roto): 2 corazones */
    /* (una hora de comer «en el futuro» no se toca: es que el reloj va atrasado, y sinceFed la lee como «acaba de comer»;
       si se guardara, al arreglar el reloj perdería corazones o se iría al refugio sin motivo) */
    /* aún no ha visto la novedad de la comida: nadie baja de 2 corazones ni se va al refugio por actualizar */
    if(s.cnew && t - f > HMS(ARRIVE_H)){ f = s.fed[id] = t - HMS(ARRIVE_H); out.ch = true; }
    if(t - f >= HMS(SHELTER_H)){ s.shelter[id] = {t: Math.round(f + HMS(SHELTER_H)), seen: false}; out.gone.push(id); out.ch = true; }
  }
  return out;
}
/* estado al día: el de la granja montada (para no pisarlo) o el guardado */
function careState(){
  if(cur && cur.alive()) return cur.sync();
  const s = load(), r = careSync(s); if(r.ch) save(s);
  return s;
}
/* gastar monedas: nunca por debajo de 0 (las monedas solo entran con award()) */
function spend(n, why){
  const g = game(), have = Math.max(0, Math.floor(Number(g.coins) || 0));
  if(!(n > 0) || have < n) return false;
  g.coins = have - n; gameSet(g);
  emit("coins", {n: -n, why: why || "", quiet: true});
  return true;
}
const coinsNow = () => Math.max(0, Math.floor(Number(game().coins) || 0));
/* textos en español: «la vaca», «a la vaca», «el grano» */
const elA = id => { const it = itemById(id); return (ANIM[id] && ANIM[id].f ? "la " : "el ") + (it ? it.n : id); };
const alA = id => { const it = itemById(id); return (ANIM[id] && ANIM[id].f ? "a la " : "al ") + (it ? it.n : id); };
const elF = fid => FOOD[fid].a + " " + FOOD[fid].n;
const fw = fid => (FOOD[fid].w && FOOD[fid].w[lang]) || FOOD[fid].n;
const heartsHtml = h => h < 0 ? "🏚️" : "❤️".repeat(h) + "🤍".repeat(3 - h);
const joinY = a => a.length <= 1 ? (a[0] || "") : a.slice(0, -1).join(", ") + " y " + a[a.length - 1];

/* sitio libre para una cosa nueva */
function spot(id, pos, y0){
  const k = kindOf(id), big = BIG.has(id) || TREE[id];
  /* bandas pensadas para un suelo de 58 % a 95 %; con más suelo (granja llena) se estiran */
  const f = y => (y0 || GND.y0) + (y - GND.y0) * (GND.y1 - (y0 || GND.y0)) / (GND.y1 - GND.y0);
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

/* las piezas de la tienda ya pintadas se ponen al día (comprada, en el refugio, precios): js/shop.js */
const shopSync = () => { try{ if(window.vocabShop && typeof vocabShop.sync === "function") vocabShop.sync(); }catch(e){} };
/* «Ir al refugio» de una pieza (vocabShop.bind ya lo atiende y no deja que llegue aquí; esto queda para otras) */
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-shelter]"); if(b && cur && cur.alive()) cur.openShelter(); });

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
/* comprar fuera de la hoja (un regalo, otra pantalla): lo nuevo aparece en la escena montada */
bus.on("buy", d => { const it = d && d.item; if(!cur || !cur.alive()) return; if(it && it.t === "farm") cur.added(it.id); cur.coins(); });
/* las monedas cambian (comida, regalos, medallas): la hoja de la tienda pone al día sus botones */
bus.on("coins", () => { if(cur && cur.alive()) cur.coins(); });

/* punto azul en la pestaña «Granja» (tabBadge de index.html) cuando algún animal tiene hambre o se fue al refugio sin que
   el niño lo haya visto todavía (al entrar en la granja sale el aviso y el punto se va). Nunca rojo ni un número: la
   granja no es una obligación */
const shelNew = s => Object.keys(s.shelter).filter(id => !s.shelter[id].seen && itemById(id));
function navBadge(){
  try{
    const s = careState(), n = needyS(s).length, sh = Object.keys(s.shelter).length, nw = shelNew(s).length;
    const label = nw ? `${nw === 1 ? "1 animal está" : nw + " animales están"} en el refugio`
      : n ? `${n === 1 ? "1 animal tiene" : n + " animales tienen"} hambre` : sh ? `${sh} en el refugio` : "";
    if(typeof tabBadge === "function") tabBadge("granja", n > 0 || nw > 0, label);
    const a = document.getElementById("tab-granja");
    if(a) a.title = label ? `Granja · ${label}` : "Granja";
  }catch(e){ console.error(e); }
}
["boot", "route", "coins", "farm-feed", "farm-rescue", "buy", "gift-open"].forEach(ev => bus.on(ev, () => navBadge()));
setInterval(navBadge, 60000);   /* (navBadge también pone al día lo comprado o regalado: llega con 2 corazones aunque no se abra la granja) */

/* window.vocabFarm.openShop({food, from}): la pastilla de las monedas (y el dock) abren la hoja de la tienda de la granja.
   Desde otra pestaña, va antes a #/granja y la abre al llegar */
const onFarmHash = () => /^#\/granja(\/|$)/.test(location.hash);
let shopPend = null;
bus.on("route", d => {
  if(!shopPend) return;
  const o = shopPend; shopPend = null;
  if(String((d && d.h) || "").startsWith("granja")) setTimeout(() => { if(cur && cur.alive()) cur.openShop(o); }, 60);
});
{
  const VF = window.vocabFarm = window.vocabFarm || {};
  VF.openShop = o => {
    o = o && typeof o === "object" && !(o instanceof Event) ? o : {};
    if(onFarmHash() && cur && cur.alive()){ cur.openShop(o); return true; }
    shopPend = o;
    if(onFarmHash()){ if(typeof route === "function") route(); }
    else location.hash = "#/granja";
    return false;
  };
  VF.closeShop = () => { if(cur && cur.alive()) cur.closeShop(); };
  /* la escena montada ahora (o null fuera de la granja): un getter, no una copia */
  Object.defineProperty(VF, "stage", {configurable: true, enumerable: true, get: () => cur && cur.alive() ? cur.stage : null});
}

/* Hoy: una fila compacta cuando alguien se acaba de ir al refugio («La gallina está en el refugio · ¡Puedes traerla de
   vuelta!»). Lleva a la granja, que enseña el aviso con «Ver el refugio»; visto el aviso, la fila ya no sale */
const shelSlot = () => {
  const ids = shelNew(careState()); if(!ids.length) return null;
  const it = itemById(ids[0]) || {}, pl = ids.length > 1, lo = pl ? "los" : ANIM[ids[0]] && ANIM[ids[0]].f ? "la" : "lo";
  return {t: pl ? `${ids.length} animales están en el refugio` : `${cap(elA(ids[0]))} está en el refugio`, sub: `¡Puedes traer${lo} de vuelta!`,
    e: pl ? "" : it.e || "", icon: pl || !it.e ? "paw-print" : "", href: "#/granja", id: "fm-shel"};
};
shelSlot.id = "granja";
if(typeof HOME_SLOTS !== "undefined") HOME_SLOTS.push(shelSlot);

/* la página: #/granja (route() de index.html la llama con la tienda ya cargada) */
if(typeof ROUTES === "object" && ROUTES) ROUTES.granja = async () => {
  const app = document.getElementById("app"); if(!app) return;
  app.innerHTML = `<div id="farm-host" class="fm-host"></div>`;
  mount(app.firstElementChild);
};

/* ---------- montaje ---------- */
function mount(host){
  if(cur) cur.stop();
  if(!host) return null;
  css();

  /* temporizadores y gestos: todo se para al salir de la página */
  const T = new Set(), I = new Set(), OFF = [];
  let alive = true;
  const isOn = () => alive && host.isConnected;
  const later = (fn, ms) => { const t = setTimeout(() => { T.delete(t); if(isOn()) fn(); else stop(); }, ms); T.add(t); return t; };
  const cancel = t => { if(t){ clearTimeout(t); T.delete(t); } };
  const every = (fn, ms) => { const t = setInterval(() => { if(isOn()) fn(); else stop(); }, ms); I.add(t); return t; };
  /* el «Dilo» del quiz: si sigue escuchando al cerrar el globo, al acertar o al salir, se apaga el micrófono */
  let micLive = false;
  const micStop = () => { if(!micLive) return; micLive = false; try{ if(typeof stopListen === "function") stopListen(); }catch(e){} };
  function stop(){
    if(!alive) return; alive = false;
    micStop();
    /* solo la hora de la visita, sobre lo guardado (otra pestaña pudo cambiar la granja) */
    try{ const t = load(); t.visit = Math.max(Number(t.visit) || 0, now()); save(t); }catch(e){}
    T.forEach(clearTimeout); I.forEach(clearInterval); T.clear(); I.clear();
    OFF.splice(0).forEach(f => { try{ f(); }catch(e){} });
    window.removeEventListener("resize", onResize); window.removeEventListener("storage", onStorage);
    document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDocDown, true);
    try{ coachDone(); noHint(); }catch(e){}
    try{ host.querySelectorAll("dialog[open]").forEach(d => d.close()); }catch(e){}
    if(cur === api) cur = null;
  }
  /* estado + regalo de bienvenida */
  const s = load();
  const upd = f => { f(s); save(s); };
  careSync(s);   /* primero la migración: el regalo de bienvenida no cuenta como granja antigua */
  const first = !s.welcome; let gifted = false;
  if(first && !owned().length){
    const g = game(); g.owned.gallina = true; g.owned.flor = true; gameSet(g); gifted = true;
    for(const k of Object.keys(WELCOME_FOOD)) s.pan[k] = Math.min(PAN_MAX, (s.pan[k] || 0) + WELCOME_FOOD[k]);
    shopSync();
  }
  careSync(s);   /* recién llegados con 2 corazones y los que se van al refugio */
  const away = s.visit > 0 ? Math.max(0, now() - s.visit) : 0; s.visit = Math.max(s.visit, now());   /* reloj atrasado: no cuenta */
  const api = {host, stop, alive: isOn,
    addDrops: n => { const b = s.drops || 0; upd(st => st.drops = Math.min(MAX_DROPS, b + n)); bar(); },
    /* otros módulos leen el estado a través de la granja montada (así no se pisan los cambios) */
    sync: () => { const r = careSync(s); if(r.ch) save(s); if(r.gone.length) later(() => leave(r.gone), 0); return s; },
    openShelter: () => { if(!dlgOpen() && !finding()) openShelter(); },
    openShop: o => openShop(o || {}), closeShop: () => closeShop(),
    added: id => addLive(id), coins: () => shopCoins(),
    tick: () => tick()};
  cur = api;
  const items = owned().filter(it => !inShelterS(s, it.id)), fresh = [];
  const narrow = matchMedia("(max-width:560px)").matches;
  const crowd = items.length > (narrow ? 9 : 16);
  const HZ = crowd ? 40 : 50;                                       /* horizonte (% del mundo, desde arriba) */
  const GR = {x0: GND.x0, x1: GND.x1, y0: HZ + 8, y1: GND.y1};     /* suelo donde se apoyan las cosas */
  if(s.lay !== GR.y0){                                              /* cambia el suelo: se reparte lo que ya había */
    const o = typeof s.lay === "number" ? s.lay : GND.y0, m = y => r1(GR.y0 + (y - o) * (GR.y1 - GR.y0) / (GR.y1 - o));
    for(const k of Object.keys(s.pos)) if(okPos(s.pos[k])) s.pos[k].y = m(s.pos[k].y);
    if(okPos(s.hero)) s.hero.y = m(s.hero.y);
    for(const k of Object.keys(s.prod)) if(okPos(s.prod[k])) s.prod[k].y = m(s.prod[k].y);
    for(const k of Object.keys(live)) if(okPos(live[k])) live[k].y = m(live[k].y);
    s.lay = GR.y0;
  }
  /* la enseñanza de la primera vez queda pendiente hasta que se ve (si cambia de idioma o de página antes, sale al volver) */
  if(first) s.wpend = gifted ? "gift" : "live";
  s.welcome = true;
  for(const it of items){
    const id = it.id, k = kindOf(id);
    if(!s.seen[id]){ s.seen[id] = now(); fresh.push(id); }
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
  const stars = Array.from({length: 24}, () => `<i style="left:${rnd(2, 98).toFixed(1)}%;top:${rnd(10, 44).toFixed(1)}%;animation-delay:${rnd(0, 2.6).toFixed(2)}s;width:${rnd(2, 3.5).toFixed(1)}px;height:${rnd(2, 3.5).toFixed(1)}px"></i>`).join("");
  const flies = Array.from({length: 9}, () => `<i style="left:${rnd(4, 94).toFixed(1)}%;top:${rnd(10, 80).toFixed(1)}%;animation-delay:-${rnd(0, 6).toFixed(2)}s;animation-duration:${rnd(5, 9).toFixed(1)}s"></i>`).join("");
  const clouds = [[14, 12, 95, -20, 1], [24, 48, 120, -75, .8], [18, 78, 80, -50, .65]]
    .map(([t, cx, d, dl, sc]) => `<button type="button" class="fm-cloud" tabindex="-1" aria-hidden="true" style="top:${t}%;--cx:${cx}%;animation-duration:${d}s;animation-delay:${dl}s;scale:${sc}"></button>`).join("");
  host.innerHTML = `<div class="fm">
    <div class="fm-stage${crowd ? " crowd" : ""}" data-ph="${ph}" style="--hz:${HZ}%" role="group" aria-label="Tu granja">
      <div class="fm-world">
        <div class="fm-sky"></div><div class="fm-stars">${stars}</div>
        <button type="button" class="fm-sun" tabindex="-1" aria-hidden="true"></button><button type="button" class="fm-moon" tabindex="-1" aria-hidden="true"></button>
        ${clouds}
        <svg class="fm-hills" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
          <path class="h2" d="M0 58C90 22 190 18 300 44C390 64 470 26 590 30C700 34 760 60 860 40C920 28 970 30 1000 36L1000 100L0 100Z"/>
          <path class="h1" d="M0 84C120 56 230 60 330 78C430 94 520 64 640 66C760 68 820 88 1000 70L1000 100L0 100Z"/></svg>
        <div class="fm-ground"></div>
        <svg class="fm-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M38 101C42 70 58 46 64 22C66 12 67 5 68 -1L71 -1C71 6 71 14 70 24C68 50 63 74 63 101Z"/></svg>
        <div class="fm-fence"></div><div class="fm-fence r"></div>
        <button type="button" class="fm-shel glass lite" hidden>${icon("paw-print", "fill", 22)}<span class="fm-shl">Refugio</span><b class="fm-shb" hidden></b></button>
        <svg class="fm-blades" viewBox="0 0 400 16" preserveAspectRatio="none" aria-hidden="true"><path d="${blades}"/></svg>
        <div class="fm-flies" aria-hidden="true">${flies}</div>
        <div class="fm-layer"></div>
        <div class="fm-bub" hidden></div>
      </div>
      <div class="fm-below" aria-hidden="true"></div>
      <div class="fm-season" aria-hidden="true"></div>
      <div class="fm-find" hidden></div>
      <div class="fm-hint" hidden></div>
      <div class="fm-pop" hidden role="dialog" tabindex="-1"><div class="fm-pin"></div></div>
      <div class="fm-tray" id="fm-tray" hidden role="group" aria-label="Comida"></div>
      <div class="fm-dock glass lite" role="toolbar" aria-label="Herramientas de la granja">
        <button type="button" class="fm-db" data-fm="water" aria-pressed="false">${icon("drop")}<span class="lb">Regar</span><b class="fm-badge" hidden></b></button>
        <i class="fm-dsep" aria-hidden="true"></i>
        <button type="button" class="fm-db" data-fm="food" aria-expanded="false" aria-controls="fm-tray">${icon("bowl-food")}<span class="lb">Comida</span></button>
        <i class="fm-dsep" aria-hidden="true"></i>
        <button type="button" class="fm-db" data-fm="shop" aria-haspopup="dialog">${icon("storefront")}<span class="lb">Tienda</span></button>
      </div>
    </div>
  </div>`;
  const root = host.firstElementChild, stage = root.querySelector(".fm-stage"), world = stage.querySelector(".fm-world"), layer = root.querySelector(".fm-layer");
  const bub = root.querySelector(".fm-bub"), fb = root.querySelector(".fm-find"), hint = root.querySelector(".fm-hint");
  const sun = root.querySelector(".fm-sun"), moon = root.querySelector(".fm-moon"), seasonEl = root.querySelector(".fm-season");
  const dock = root.querySelector(".fm-dock"), bWater = dock.querySelector('[data-fm="water"]'), bFood = dock.querySelector('[data-fm="food"]'), bShop = dock.querySelector('[data-fm="shop"]');
  const popEl = root.querySelector(".fm-pop"), popIn = popEl.firstElementChild, tray = root.querySelector(".fm-tray"), shelB = root.querySelector(".fm-shel");
  api.stage = stage;

  const els = {}, wt = {}, busy = {}, awake = {}, spoke = new Set(), newPend = [];
  let waterMode = false, foodMode = null, F = null, lift = null, dragging = false, bubT = null, heroT = null, rzT = null;
  let leadId = null, shopDlg = null, coachEl = null, coachAnim = null, regHint = null, U = 56, WH = 600, TB = 10;
  /* la pista de la regadera (G.hint) se aparta en cuanto se abre otra cosa encima del dock (bandeja, hoja, globo) */
  const noHint = () => { if(regHint){ try{ regHint.close(); }catch(e){} regHint = null; } };

  /* ---------- medidas: el mundo va de arriba del todo hasta encima del dock; el tamaño de las cosas, de lo que se ve ---------- */
  function layout(){
    const W = innerWidth || 390, dt = dock.getBoundingClientRect().top, st = stage.getBoundingClientRect().top;
    WH = Math.max(260, Math.round((dt > 0 ? dt : innerHeight - 150) - st - 10));
    stage.style.setProperty("--fm-wh", WH + "px");
    U = clamp(Math.min(.082 * WH, .145 * W), 36, 70) * (crowd ? .86 : 1);
    stage.style.setProperty("--u", U.toFixed(1) + "px");
    const tb = document.getElementById("topbar"), tr = tb && tb.getClientRects().length ? tb.getBoundingClientRect() : null;
    TB = tr && tr.top < innerHeight / 2 ? clamp(tr.bottom / WH * 100, 0, 30) : 4;   /* lo que tapa la barra de arriba (%) */
  }
  layout();

  /* ---------- consultas ---------- */
  const hungry = id => canEatS(s, id);           /* puede comer: hace 8 h o más que comió */
  const hearts = id => heartsS(s, id);
  const needy = id => !inShelterS(s, id) && hearts(id) <= 2;   /* tiene hambre (2 corazones o menos): igual que la insignia */
  const plant = id => { let p = s.pl[id]; if(!p || typeof p !== "object") p = s.pl[id] = {s: 1, w: 0}; return p; };
  const canWater = id => now() - (plant(id).w || 0) >= WATER;
  const lit = () => (ph === "night" || ph === "dusk") && s.light !== false;
  const asleep = id => ph === "night" && !needy(id) && !((awake[id] || 0) > now());
  const finding = () => !!(F && !F.done);
  const posOf = id => (ANIM[id] && okPos(live[id])) ? live[id] : s.pos[id];
  const hasProd = src => Object.values(s.prod).some(P => P.a === src);
  const dlgOpen = () => !!root.querySelector("dialog[open]");
  const popOpen = () => !popEl.hidden;
  const trayOpen = () => !tray.hidden;

  /* ---------- pintar cosas ---------- */
  function put(el, x, y, ms){
    if(el._hw) x = clamp(x, el._hw, 100 - el._hw);   /* que no se corte por los lados */
    el.classList.toggle("er", x > 84);                 /* cerca del borde derecho: bocadillos al otro lado */
    el.classList.toggle("al", x < 24); el.classList.toggle("ar", x > 76);   /* el globo del hambre, hacia dentro */
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
    holdMove(el);
    if(fresh.includes(id)) cls(el, "new", 800);
  }
  function render(id, force){
    const el = els[id], it = itemById(id); if(!el || !it) return;
    if((el._busy || el._lift) && !force) return;
    const k = kindOf(id); let badge = "", c = "", g = k === "animal" ? pj(it) : it.e, lbl = it.n, lead = false;
    if(k === "animal"){
      /* con hambre: el globo con la comida que pide (el más urgente, también con la frase en el idioma) */
      const h = Math.max(0, hearts(id)), eat = needy(id);
      c = h === 0 ? "sick" : h === 1 ? "sad" : "";
      if(eat){ lead = id === leadId; badge = askHtml(id, lead); }
      else if(asleep(id)) badge = `<span class="fm-zz" aria-hidden="true">💤</span>`;
      lbl += `, ${h === 1 ? "1 corazón" : h + " corazones"}${h === 0 ? (ANIM[id].f ? ", está malita" : ", está malito") : ""}${eat ? `, tiene hambre: quiere ${FOOD[ANIM[id].eats].n}` : hungry(id) ? ", puede comer" : ""}`;
    } else if(k === "plant"){
      const p = plant(id);
      if(p.s <= 0){ g = "🌱"; c = "sd0"; } else if(p.s === 1){ g = "🌿"; c = "sd1"; }
      if(p.s >= 2){ if(!TREE[id]){ c = "ripe"; badge = `<span class="fm-spk" aria-hidden="true"><i>✨</i><i>✨</i></span>`; lbl += ", lista para cosechar"; } }
      else if(canWater(id)){ badge = `<span class="fm-need w" aria-hidden="true">💧</span>`; lbl += ", quiere agua"; }
    } else if(id === "casa" && lit()) c = "lit";
    el.classList.toggle("lead", lead);
    const sig = g + "|" + badge + "|" + c;
    if(!force && el._sig === sig) return;
    el._sig = sig;
    el.classList.remove("sd0", "sd1", "ripe", "lit", "sick", "sad"); if(c) el.classList.add(c);
    el.innerHTML = `<span class="fm-body"><span class="fm-sh"></span><span class="fm-e">${g}</span></span>${badge}`;
    el.setAttribute("aria-label", lbl);
  }
  /* el globo del hambre: la comida que pide; el del más urgente, además «I'm hungry!» y «¡Tengo hambre!» en gris */
  function askHtml(id, lead){
    const Fd = FOOD[ANIM[id].eats];
    if(!lead) return `<span class="fm-ask sm" aria-hidden="true"><span class="fm-ae">${Fd.e}</span></span>`;
    return `<span class="fm-ask" aria-hidden="true"><span class="fm-ae">${Fd.e}</span><span class="fm-at"><b lang="${code()}">${esc(PHRASE[lang] || PHRASE.english)}</b><small>${PHRASE_ES}</small></span></span>`;
  }
  /* el que más prisa tiene: menos corazones y, si empatan, el que lleva más sin comer */
  function pickLead(){
    const ids = Object.keys(els).filter(id => ANIM[id] && needy(id));
    ids.sort((a, b) => hearts(a) - hearts(b) || sinceFed(s, b) - sinceFed(s, a));
    const nl = ids[0] || null;
    if(nl === leadId) return;
    const old = leadId; leadId = nl;
    if(old && els[old]) render(old, true);
    if(nl) render(nl, true);
  }
  /* media anchura (en % del mundo) de una cosa ya crecida */
  const sizeK = id => id === "castillo" ? 1.65 : (BIG.has(id) || TREE[id]) ? 1.38 : 1;
  function halfW(id){
    const W = layer.clientWidth || innerWidth || 600;
    return Math.min(20, (U * sizeK(id) * .72 + 2) / W * 100);
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

  /* ---------- bocadillo ---------- */
  const msg = t => `<span class="fm-bm">${t}</span>`;
  const sayBtns = w => `<span class="fm-sg"><button type="button" class="say" data-say="${esc(w)}" aria-label="Escuchar" title="Escuchar">${icon("speaker-high", "fill", 22)}</button><button type="button" class="say" data-say="${esc(w)}" data-slow aria-label="Escuchar despacio" title="Escuchar despacio">${icon("turtle", "fill", 22)}</button></span>`;
  const wordBub = (e, w, es, extra) => `<span class="fm-be">${e}</span><span class="fm-bt"><b lang="${code()}">${esc(w)}</b><small>= ${esc(es)}</small>${extra ? `<i>${extra}</i>` : ""}</span>${sayBtns(w)}`;
  function bubble(html, anchor, ms){
    bub.innerHTML = html; bub.hidden = false;
    bub.classList.remove("in", "below"); void bub.offsetWidth; bub.classList.add("in");
    const L = layer.getBoundingClientRect(); let cx, top, bot;
    if(anchor && anchor.getBoundingClientRect){
      const t = (anchor.querySelector && anchor.querySelector(".fm-e, .fm-hb")) || anchor, r = t.getBoundingClientRect();
      cx = r.left + r.width / 2 - L.left; top = r.top - L.top; bot = r.bottom - L.top;
    } else { cx = anchor.x / 100 * L.width; top = bot = anchor.y / 100 * L.height; }
    const bw = bub.offsetWidth, bh = bub.offsetHeight, lim = TB / 100 * L.height + 6;   /* nunca debajo de la barra de arriba */
    const left = clamp(cx, bw / 2 + 8, L.width - bw / 2 - 8), below = top - bh - 14 < lim;
    bub.classList.toggle("below", below);
    bub.style.left = left + "px";
    bub.style.top = (below ? Math.min(bot + 12, L.height - bh - 4) : top - 10) + "px";
    bub.style.setProperty("--tail", clamp(cx - left + bw / 2, 18, bw - 18) + "px");
    cancel(bubT); bubT = later(hideBub, ms || 3800);
  }
  function hideBub(){ bub.hidden = true; }

  /* ---------- globo junto a un animal (comer y «¿Cómo me llamo?»): no tapa la granja ni es modal ----------
     Se cierra con «Ahora no», con Esc o tocando fuera (ese toque no hace nada más) */
  let popCtl = null;
  function pop(html, anchor, label, onClose){
    closePop(true); noHint();
    popIn.innerHTML = html; popEl.hidden = false;
    popEl.setAttribute("aria-label", label || "");
    popCtl = {anchor, onClose, back: document.activeElement};
    placePop();
    popEl.classList.remove("in"); void popEl.offsetWidth; popEl.classList.add("in");
    try{ popEl.focus({preventScroll: true}); }catch(e){}
    return popIn;
  }
  function placePop(){
    if(popEl.hidden || !popCtl) return;
    const a = popCtl.anchor, t = a && a.isConnected ? (a.querySelector(".fm-e") || a) : null;
    const r = t ? t.getBoundingClientRect() : {left: innerWidth / 2 - 20, right: innerWidth / 2 + 20, top: innerHeight / 2, bottom: innerHeight / 2, width: 40};
    const top0 = TB / 100 * WH + 8, bot0 = dock.getBoundingClientRect().top - 10, m = 12;
    popIn.style.maxHeight = Math.max(160, bot0 - top0) + "px";
    const pw = popEl.offsetWidth, ph = popEl.offsetHeight, cx = r.left + r.width / 2;
    const left = clamp(cx - pw / 2, m, Math.max(m, innerWidth - m - pw));
    let y, side;
    if(r.top - 14 - ph >= top0){ y = r.top - 14 - ph; side = "top"; }
    else if(r.bottom + 14 + ph <= bot0){ y = r.bottom + 14; side = "bottom"; }
    else { y = clamp(r.top - 14 - ph, top0, Math.max(top0, bot0 - ph)); side = "over"; }
    popEl.dataset.side = side;
    popEl.style.left = Math.round(left) + "px"; popEl.style.top = Math.round(y) + "px";
    popEl.style.setProperty("--tail", Math.round(clamp(cx - left, 26, pw - 26)) + "px");
  }
  function closePop(quiet){
    if(popEl.hidden) return;
    const c = popCtl; popCtl = null;
    if(popEl.dataset.kind === "quiz") micStop();
    const had = popEl.contains(document.activeElement);
    popEl.hidden = true; popIn.innerHTML = "";
    if(had && c && c.back && c.back.isConnected && !quiet) try{ c.back.focus({preventScroll: true}); }catch(e){}
    if(c && typeof c.onClose === "function") try{ c.onClose(); }catch(e){ console.error(e); }
  }
  /* tocar fuera: se cierra (y ese toque no hace nada en la escena); el dock y la bandeja siguen funcionando */
  function onDocDown(e){
    if(!isOn()) return;
    if(coachEl) coachDone();
    const t = e.target;
    if(popEl.hidden || popEl.contains(t) || (t.closest && t.closest("dialog[open]"))) return;
    const keep = t.closest && t.closest(".fm-dock, .fm-tray");
    closePop();
    if(!keep && stage.contains(t)){ const g = GS(); if(g && g.swallowClick) g.swallowClick(600, e.clientX, e.clientY); }
  }
  function onKey(e){
    if(e.key !== "Escape" || !isOn() || dlgOpen()) return;
    if(popOpen()){ e.preventDefault(); closePop(); return; }
    if(finding()){ e.preventDefault(); exitFind(); return; }
    if(waterMode || foodMode){ e.preventDefault(); setWater(false); setFood(null); return; }
    if(trayOpen()){ e.preventDefault(); closeTray(); bFood.focus({preventScroll: true}); }
  }

  /* ---------- hojas (refugio, se fue al refugio): las de M (js/motion.js) ---------- */
  function dlg(html, cl){
    /* nunca dos a la vez (toques rápidos, teclado…) */
    root.querySelectorAll("dialog.fm-dlg").forEach(x => { try{ x.close(); }catch(e){} x.remove(); });
    closePop(true);
    const d = document.createElement("dialog"); d.className = "m-sheet glass lite fm-dlg" + (cl ? " " + cl : ""); d.innerHTML = html;
    root.appendChild(d); d.addEventListener("close", () => { d.remove(); later(nextIntro, 350); });
    d.addEventListener("click", e => { if(e.target.closest("[data-x]")) shut(d); });
    if(window.M && typeof M.openSheet === "function") M.openSheet(d); else { try{ d.showModal(); }catch(e){ d.setAttribute("open", ""); } }
    d.scrollTop = 0;
    return d;
  }
  const shut = d => { if(!d || !d.open) return; if(window.M && typeof M.closeSheet === "function" && d.classList.contains("m-sheet")) M.closeSheet(d); else d.close(); };
  const head = (t, x, id) => `<div class="m-head"><h2${id ? ` id="${id}"` : ""}>${t}</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-x>${x || "Listo"}</button></div>`;
  /* avisos al entrar, uno detrás de otro: cada uno devuelve cuánto esperar (o nada si abre una hoja) */
  const intro = [];
  function nextIntro(){
    if(!isOn() || dlgOpen() || finding() || popOpen() || !intro.length) return;
    const w = intro.shift()();
    if(typeof w === "number") later(nextIntro, w);
  }

  /* ---------- el personaje ---------- */
  const hero = document.createElement("div");
  hero.className = "fm-hero"; hero.tabIndex = 0; hero.setAttribute("role", "button"); hero.setAttribute("aria-label", "Tu personaje: jugar a «¿Dónde está?»");
  const hsz = Math.round(U * 1.02);
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
  const playBtn = `<button type="button" class="fm-bplay" data-play-find>${icon("magnifying-glass", "bold", 20)}<span>¿Dónde está?</span></button>`;
  function tapHero(){
    hop(hero);
    if(finding()){ const it = itemById(F.target); if(it) speak(iw(it)); return; }
    const gr = GREET[ph] || GREET.day, w = gr[lang] || gr.english;
    bubble(`<span class="fm-be">👋</span><span class="fm-bt"><b lang="${code()}">${esc(w)}</b><small>= ${esc(gr.es)}</small></span>${sayBtns(w)}${findable().length >= 3 ? playBtn : ""}`, hero, 6000);
    speak(w); play("pop");
  }

  /* ---------- animales que pasean ---------- */
  function face(el, dx){ if(Math.abs(dx) < .3) return; const f = FACE[el.dataset.fid] || 1; el.style.setProperty("--fx", dx > 0 ? -f : f); }
  function wander(id){
    wt[id] = null;
    const A = ANIM[id], el = els[id]; if(!A || !el || RM()) return;
    /* malito (0 corazones): se queda tumbado · triste (1): pasea despacio y poco */
    if(finding() || busy[id] || (lift && lift.id === id) || asleep(id) || hearts(id) === 0 || (popCtl && popCtl.anchor === el)){ wt[id] = later(() => wander(id), 3000); return; }
    const slow = hearts(id) === 1 ? .45 : 1;
    const home = s.pos[id], c = posOf(id), r = A.r * (slow < 1 ? .6 : 1);
    const x = clamp(home.x + rnd(-r, r), GR.x0, GR.x1), y = clamp(home.y + rnd(-r * .55, r * .55), GR.y0, GR.y1);
    const W = layer.clientWidth || 600, H = layer.clientHeight || 340;
    const dist = Math.hypot((x - c.x) * W / 100, (y - c.y) * H / 100);
    const ms = Math.round(Math.max(400, dist / (A.sp * slow * (ph === "night" ? .6 : 1)) * 1000));
    face(el, x - c.x); el.classList.add("walk");
    put(el, x, y, ms); live[id] = {x, y};
    wt[id] = later(() => { el.classList.remove("walk"); if(slow === 1) idle(id); wt[id] = later(() => wander(id), rnd(2500, 7000) / slow); }, ms);
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

  /* ---------- «La granja te habla»: «I'm hungry!» una vez por animal y visita ---------- */
  function talk(id, entry){
    if(!ANIM[id] || spoke.has(id) || !needy(id) || !els[id]) return false;
    if(entry && (sounding() || dlgOpen())) return false;   /* al entrar, solo si no suena nada */
    spoke.add(id);
    const ph = PHRASE[lang] || PHRASE.english;
    if(typeof canHear !== "function" || canHear(ph)) speak(ph);   /* sin voz de ese idioma, basta el globo con el texto */
    cls(els[id], "talk", 900);
    return true;
  }

  /* ---------- levantar y mover: mantener pulsado 500 ms (G.hold) ---------- */
  function holdMove(el){
    const g = GS(); if(!g || typeof g.hold !== "function") return;
    const id = el.dataset.fid;
    OFF.push(g.hold(el, {ms: 500, touchAction: "none",
      onHold: ({x, y}) => {
        if(!isOn() || finding() || el._busy || dragging || !els[id]) return;
        if(ANIM[id]){ freeze(id); busy[id] = true; }
        const L = layer.getBoundingClientRect(), cs = getComputedStyle(el);
        lift = {id, el, L, ox: x - L.left - parseFloat(cs.left), oy: y - L.top - parseFloat(cs.top), x: NaN, y: NaN};
        el._lift = true; el.classList.add("lift"); hideBub(); closePop(true);
        try{ g.haptic("selection"); }catch(e){}
        play("tap");
        /* un animal: su menú (js/ctxmenu.js, sin desenfoque). Si el dedo lo arrastra, el menú se va y se mueve como siempre */
        if(kindOf(id) === "animal" && !foodMode && !waterMode && window.vocabMenu)
          lift.menu = window.vocabMenu.open(el, animalMenu(id), {x, y, lite: true, haptic: false}).then(r => {
            if(r === null && !(lift && lift.el === el) && isOn() && ANIM[id] && els[id]){ busy[id] = false; resume(id, 1500); }
          });
      },
      onMove: ({x, y, moved}) => {
        if(!lift || lift.el !== el) return;
        if(lift.menu && window.vocabMenu && window.vocabMenu.isOpen(el)){ if(!moved) return; window.vocabMenu.close(true); }
        const L = lift.L, hw = el._hw || 0;
        lift.x = clamp((x - L.left - lift.ox) / L.width * 100, Math.max(GR.x0, hw), Math.min(GR.x1, 100 - hw));
        lift.y = clamp((y - L.top - lift.oy) / L.height * 100, GR.y0, GR.y1);
        put(el, lift.x, lift.y, 0);
      },
      onRelease: ({moved}) => {
        if(!lift || lift.el !== el) return;
        const d = lift; lift = null; el._lift = false; el.classList.remove("lift");
        /* soltar sin moverla: se queda donde está (no se guarda nada) */
        if(moved && isFinite(d.x)){
          upd(st => st.pos[id] = {x: r1(d.x), y: r1(d.y)});
          if(ANIM[id]) live[id] = {x: d.x, y: d.y};
          const t = topOf(el, 1); puffs(t.x - 2, t.y, 1); puffs(t.x + 2, t.y, 1);
          cls(el, "land", 400); play("pop");
          try{ g.learned("fm-lift"); }catch(e){}
        }
        /* con su menú abierto (soltar sin moverlo), sigue quieto: lo que se elija (o cerrarlo) decide */
        if(!moved && d.menu && window.vocabMenu && window.vocabMenu.isOpen(el)){ render(id, true); return; }
        if(ANIM[id]){ busy[id] = false; resume(id, 3000); }
        render(id, true);
        if(!moved) tap(id);   /* mantener el dedo sin moverlo también acaricia (o riega, o da de comer): siempre responde */
      },
      onCancel: () => {
        if(!lift || lift.el !== el) return;
        const d = lift; lift = null; el._lift = false; el.classList.remove("lift");
        const p = posOf(id); if(p) put(el, p.x, p.y, 0);
        if(d.menu && window.vocabMenu && window.vocabMenu.isOpen(el)) return;   /* el menú sigue abierto: él decide */
        if(ANIM[d.id]){ busy[d.id] = false; resume(d.id, 2000); }
      }}));
  }
  /* el menú de un animal: Acariciar es tocarlo; Dar de comer, su globo de comida (lleno: «¡Está lleno!»); Oír su nombre, el
     altavoz de su globo. Con la IPA de su palabra en el tema «animales», si está */
  function animalMenu(id){
    const it = itemById(id), w = iw(it), lc = code();
    const go = f => () => { if(!isOn() || !els[id] || !ANIM[id]) return; busy[id] = false; resume(id, 3000); f(); };
    const ipa = Promise.resolve().then(() => getDoc("animales")).then(doc => {
      const lw = w.toLowerCase(), es = String(it.n || "").toLowerCase();
      const r = ((doc && doc.rows) || []).find(r => r && r.l && r.l[lang] && (String(r.l[lang].word).toLowerCase() === lw || String(r.es || "").toLowerCase() === es) && r.l[lang].ipa);
      return r ? ipaHtml(r.l[lang].ipa, lc) : "";
    }).catch(() => "");
    return {title: w, sub: it.n, lang: lc, ipa, items: [
      {id: "pet", t: "Acariciar", ic: "hand-heart", fn: go(() => tap(id))},
      {id: "feed", t: "Dar de comer", ic: "bowl-food", fn: go(() => { freeze(id); if(hungry(id)) openFeed(id); else giveFood(id, ANIM[id].eats); })},
      {id: "say", t: "Oír su nombre", ic: "speaker-high", st: "fill", say: w, fn: go(() => {})},
    ], tap: go(() => tap(id))};
  }

  /* tras la primera caricia o comida de la visita, la pista de que se puede mover (como mucho 3 veces en total) */
  let liftHinted = false;
  function liftHint(id){
    const g = GS(); if(liftHinted || !g || typeof g.hint !== "function") return;
    liftHinted = true;
    later(() => { const el = els[id]; if(el && !el._lift && !popOpen() && !dlgOpen() && !trayOpen() && !finding() && !coachEl && !dragging) g.hint(el, {id: "fm-lift", gesture: "hold", text: "Mantén para moverlo", max: 3, delay: 0, side: el.querySelector(".fm-ask") ? "bottom" : undefined}); }, 2800);   /* con hambre, debajo: la nube se sigue pudiendo tocar */
  }

  /* ---------- tocar cosas ---------- */
  function tap(id, ev){
    const it = itemById(id), el = els[id]; if(!it || !el || dlgOpen()) return;
    if(finding()) return findTap(id, ev);
    if(waterMode) return waterTap(id);
    const k = kindOf(id);
    if(foodMode){
      if(k === "animal") return giveFood(id, foodMode);
      hop(el); play("tap"); bubble(msg(`¡Eso no come!<br>Toca un animal para darle ${FOOD[foodMode].e}`), el, 2600); return;
    }
    if(k === "animal") return tapAnimal(id);
    if(k === "plant") return tapPlant(id);
    if(k === "build") return tapBuild(id);
    hop(el); play("tap"); bubble(wordBub(pj(it), iw(it), it.n), el); speak(iw(it));
  }
  /* acariciar: corazones, su nombre y su voz (no come: s.fed no cambia). Con hambre, el globo para darle de comer */
  function tapAnimal(id){
    const it = itemById(id), el = els[id], A = ANIM[id];
    freeze(id);
    if(hungry(id)){ play("tap"); hop(el); heart(el); walkNear(id); talk(id); openFeed(id); return; }
    const woke = asleep(id); awake[id] = now() + 30000;
    hop(el); heart(el); play(A.moo ? "moo" : "pop");
    bubble(wordBub(pj(it), iw(it), it.n, `<span class="fm-hl" aria-hidden="true">${heartsHtml(Math.max(0, hearts(id)))}</span> ${woke ? "¡Me has despertado! 🥱" : fullTxt(id)}`), el); speak(iw(it));
    render(id); resume(id, 2600); liftHint(id);
  }
  const fullTxt = id => `¡Está lleno! 😋 Podrá comer en ${fmtLeft(HMS(FULL_H) - sinceFed(s, id))}`;
  /* comida que no es la suya: nunca un fallo (no se gasta): le dice cuál le gusta */
  const puaj = (id, fid) => { const R = ANIM[id].eats; return `${cap(alA(id))} no le gusta ${elF(fid)}.<br>¡Le gusta ${elF(R)} ${FOOD[R].e}!`; };
  const poorTxt = need => `Te ${need === 1 ? "falta 1 moneda" : `faltan ${need} monedas`}.<br>¡Una lección te da más!`;

  /* comprar comida: resta monedas (nunca por debajo de 0) y la guarda en la despensa */
  function buyFood(k, n){
    const Fd = FOOD[k]; if(!Fd) return {ok: false};
    const room = PAN_MAX - (s.pan[k] || 0); if(room <= 0) return {ok: false, full: true};
    n = Math.max(1, Math.min(n || 1, room));
    const cost = Fd.c * n, have = coinsNow();
    if(have < cost || !spend(cost, `Comida: ${Fd.n}`)) return {ok: false, need: cost - have};
    upd(st => st.pan[k] = Math.min(PAN_MAX, (st.pan[k] || 0) + n));
    play("coin");
    emit("farm-buy", {food: k, n, cost});
    trayPaint(); shopFoods();
    return {ok: true, n};
  }

  /* tocar un animal con hambre: el globo para elegir su comida (de la despensa) */
  function openFeed(id){
    const it = itemById(id), A = ANIM[id], right = A.eats, R = FOOD[right], h = Math.max(0, hearts(id)), el = els[id];
    const tried = new Set();
    let done = false;
    const box = pop(`<div class="fm-ph"><p class="fm-qt">${h === 0 ? `¡${cap(elA(id))} está ${A.f ? "malita" : "malito"}! Dale su comida.` : `¿Qué le das ${alA(id)}?`}</p>
        <span class="fm-hpill" role="img" aria-label="${h} de 3 corazones">${heartsHtml(h)}</span></div>
      <div class="fm-fb"></div>
      <p class="fm-qm" aria-live="polite"></p>
      <div class="fm-pa"><button type="button" class="btn-fill btn-fill--neu fm-x">Ahora no</button></div>`, el, `Dar de comer ${alA(id)}`,
      () => { if(!done && isOn()) resume(id, 1200); });   /* «Ahora no»: vuelve a pasear */
    popEl.dataset.fid = id; popEl.dataset.kind = "feed";
    const fbx = box.querySelector(".fm-fb"), m = box.querySelector(".fm-qm");
    box.querySelector(".fm-x").onclick = () => closePop();
    function paint(){
      const have = Object.keys(FOOD).filter(k => (s.pan[k] || 0) > 0);
      fbx.innerHTML = `${have.length ? `<div class="fm-foods">${have.map(k => `<button type="button" class="fm-food${tried.has(k) ? " bad" : ""}" data-food="${k}" aria-label="${esc(fw(k))}, ${esc(FOOD[k].n)}, tienes ${s.pan[k]}"><span class="fe" aria-hidden="true">${FOOD[k].e}</span><span class="ft"><b lang="${code()}">${esc(fw(k))}</b><small>${esc(FOOD[k].n)} · ${s.pan[k]}</small></span>${tried.has(k) ? `<span class="fm-mk" aria-hidden="true">${icon("x", "bold", 16)}</span>` : ""}</button>`).join("")}</div>` : ""}
        ${(s.pan[right] || 0) > 0 ? "" : `<div class="fm-nofood"><p>${cap(elA(id))} come <b>${R.e} ${esc(R.n)}</b>. ¡Cómprale un poco!</p>
          <button type="button" class="btn-fill fm-buyq" data-qbuy="${right}">${icon("storefront", "bold", 20)}<span>Comprar ${R.e} ${esc(R.n)}</span></button></div>`}`;
      placePop();
    }
    paint();
    fbx.addEventListener("click", e => {
      if(done) return;
      if(inShelterS(s, id)) return closePop();   /* se fue al refugio con el globo abierto */
      if(e.target.closest("[data-qbuy]")){ closePop(true); resume(id, 1200); openShop({food: right, from: e.target.closest("button")}); return; }
      const b = e.target.closest("[data-food]"); if(!b) return;
      const k = b.dataset.food;
      if(k !== right){
        /* gris con ✗, sin temblar ni sonido triste: así aprende qué come cada uno */
        tried.add(k); paint(); m.className = "fm-qm info"; m.innerHTML = puaj(id, k); return;
      }
      if(!((s.pan[k] || 0) > 0)) return;
      done = true; closePop(true);
      giveFood(id, k);
    });
  }
  /* dar de comer (tocar la comida y luego el animal, arrastrar la comida o elegirla en su globo: siempre esto) */
  function giveFood(id, fid){
    const it = itemById(id), el = els[id], A = ANIM[id]; if(!el || !A || inShelterS(s, id)) return false;
    freeze(id); coachDone();
    if(!hungry(id)){ hop(el); play("tap"); bubble(wordBub(pj(it), iw(it), it.n, fullTxt(id)), el); speak(iw(it)); resume(id, 2600); return false; }
    if(fid !== A.eats){ cls(el, "no", 500); bubble(msg(puaj(id, fid)), el, 4500); resume(id, 2600); return false; }
    if(!((s.pan[fid] || 0) > 0)){ resume(id, 1200); openShop({food: fid}); return false; }
    walkNear(id);
    const res = eatNow(id);
    eatFx(id, fid);
    bubble(wordBub(FOOD[fid].e, fw(fid), FOOD[fid].n, "¡Ñam, ñam! 😋"), el, 1500); speak(fw(fid));
    later(() => { if(popOpen() || dlgOpen() || !els[id]) return gifts(id, res); nameQuiz(id, res); }, 1450);
    return true;
  }
  /* come: gasta 1 ración, corazones al máximo y regalo (si no estaba triste o malito) */
  function eatNow(id){
    const A = ANIM[id], fid = A.eats, h0 = Math.max(0, hearts(id));
    upd(st => { st.pan[fid] = Math.max(0, (st.pan[fid] || 0) - 1); if(!st.pan[fid]) delete st.pan[fid]; st.fed[id] = Math.max(now(), Number(st.fed[id]) || 0); });
    awake[id] = now() + 30000;
    const res = {fid, weak: h0 < 2, keys: []};
    if(!res.weak){ const k = addProd(id, A.p); if(k) res.keys.push(k); }
    emit("farm-feed", {item: itemById(id), food: fid});
    if(foodMode && !((s.pan[foodMode] || 0) > 0)) setFood(null);
    pickLead(); render(id, true); trayPaint(); shopFoods();
    return res;
  }
  /* después de comer: «¿Cómo me llamo?» (3 opciones con audio y, si hay micrófono, «Dilo»). Acierto = regalo doble */
  function nameQuiz(id, res){
    if(!isOn() || !els[id]) return;
    const it = itemById(id), right = iw(it), el = els[id];
    const words = new Set([right]), others = [];
    for(const x of shuffle(SHOP.filter(x => x.t === "farm" && ANIM[x.id] && x.id !== id)).concat(shuffle(SHOP.filter(x => x.t === "farm" && !ANIM[x.id])))){
      const w = iw(x); if(!words.has(w)){ words.add(w); others.push(x); } if(others.length === 2) break;
    }
    const opts = shuffle([it, ...others]);
    /* lo que se promete es lo que pasa: con muchos regalos suyos en el suelo (PROD_MAX) ya no caen más */
    const room = PROD_MAX - Object.values(s.prod).filter(P => P.a === id).length;
    const prize = room <= 0 ? "Primero recoge sus regalos 🥚" : res.keys.length ? "Si aciertas: ¡regalo doble! 🎁🎁" : "Si aciertas: ¡un regalo! 🎁";
    const mic = typeof canListen === "function" && canListen() && typeof listen === "function";
    let done = false, busyMic = false;
    const box = pop(`<div class="fm-ph"><span class="fm-qe" aria-hidden="true">${pj(it)}</span><p class="fm-qt">¿Cómo me llamo?</p></div>
      <p class="fm-qs">${prize}</p>
      ${mic ? `<button type="button" class="btn-fill fm-mic" data-mic aria-label="Dilo: di mi nombre en ${esc(LANGS[lang].name)}">${icon("microphone", "bold", 22)}<span>Dilo</span></button>` : ""}
      <div class="fm-opts">${opts.map(o => `<div class="fm-or"><button type="button" class="fm-opt" data-fo="${o.id}" lang="${code()}">${esc(iw(o))}</button><button type="button" class="say fm-ls" data-say="${esc(iw(o))}" aria-label="Escuchar ${esc(iw(o))}" title="Escuchar">${icon("speaker-high", "fill", 22)}</button></div>`).join("")}</div>
      <p class="fm-qm" aria-live="polite"></p>
      <div class="fm-pa"><button type="button" class="btn-fill btn-fill--neu fm-x">Ahora no</button></div>`, el, "¿Cómo me llamo?",
      () => { if(isOn()) gifts(id, res); });
    popEl.dataset.fid = id; popEl.dataset.kind = "quiz";
    closeTray();   /* un solo panel a la vez: el globo del quiz cierra la bandeja de la comida */
    const m = box.querySelector(".fm-qm"), x = box.querySelector(".fm-x"), micB = box.querySelector("[data-mic]");
    const micOff = () => { if(!busyMic) return; busyMic = false; micStop(); micB.classList.remove("on"); micB.removeAttribute("aria-pressed"); micB.querySelector("span").textContent = "Dilo"; };
    x.onclick = () => closePop();
    const okB = () => box.querySelector(`.fm-opt[data-fo="${id}"]`);
    function win(b){
      if(done) return; done = true;
      box.querySelectorAll(".fm-opt").forEach(o => { if(o !== b) o.disabled = true; });
      if(micB){ micOff(); micB.disabled = true; }
      if(b){ b.classList.add("ok"); b.insertAdjacentHTML("beforeend", `<span class="fm-mk" aria-hidden="true">${icon("check", "bold", 18)}</span>`); }
      play("ok"); speak(right); srsWord(id);
      const k = addProd(id, ANIM[id].p); if(k) res.keys.push(k);
      const n = res.keys.length;
      m.className = "fm-qm ok"; m.innerHTML = `¡Muy bien! <b lang="${code()}">${esc(right)}</b><br>${n >= 2 ? "¡Regalo doble! 🎁🎁" : n ? "¡Te dejo un regalo! 🎁" : "¡Recoge mis regalos! 🥚"}`;
      x.textContent = "¡Genial!";
      if(window.M && typeof M.ok === "function" && b) try{ M.ok(b); }catch(e){}
      later(() => { if(popEl.dataset.kind === "quiz" && popEl.dataset.fid === id) closePop(); }, 1700);
    }
    box.querySelectorAll(".fm-opt").forEach(b => b.onclick = () => {
      if(done) return;
      if(b.dataset.fo === id) return win(b);
      /* fallo: gris con ✗ (nunca rojo ni dorado), sin temblar ni sonido triste; la buena en verde con ✓ */
      done = true;
      box.querySelectorAll(".fm-opt").forEach(o => { if(o !== b) o.disabled = true; });
      if(micB){ micOff(); micB.disabled = true; }
      b.classList.add("bad"); b.insertAdjacentHTML("beforeend", `<span class="fm-mk" aria-hidden="true">${icon("x", "bold", 18)}</span>`);
      speak(right);
      const o = okB(); if(o){ o.disabled = false; o.classList.add("ok"); o.onclick = null; o.insertAdjacentHTML("beforeend", `<span class="fm-mk" aria-hidden="true">${icon("check", "bold", 18)}</span>`); }
      m.className = "fm-qm info"; m.innerHTML = `Me llamo <b lang="${code()}">«${esc(right)}»</b><br>${res.keys.length ? "¡Te dejo un regalo! 🎁" : res.weak ? "¡Dame de comer cada día! 💪" : "¡Recoge mis regalos! 🥚"}`;
      x.textContent = "Seguir"; x.classList.remove("btn-fill--neu");
    });
    /* «Dilo»: si no lo entiende, nunca es un fallo: se puede tocar */
    if(micB) micB.onclick = async () => {
      if(done || busyMic) return;
      busyMic = true; micB.classList.add("on"); micB.setAttribute("aria-pressed", "true"); micB.querySelector("span").textContent = "Te escucho…";
      try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch(e){}
      m.className = "fm-qm"; m.textContent = "";
      let r = null; micLive = true;
      try{ r = await listen({lang: code(), ms: 6000}); }catch(e){ r = {status: "error", alts: []}; }
      micLive = false;
      if(!busyMic || (r && r.status === "aborted")) return;   /* ya se apagó (acierto, toque o globo cerrado) */
      busyMic = false;
      if(!isOn() || done || popEl.dataset.kind !== "quiz" || popEl.dataset.fid !== id || !micB.isConnected) return;
      micB.classList.remove("on"); micB.removeAttribute("aria-pressed"); micB.querySelector("span").textContent = "Dilo";
      if(r && r.status === "ok" && heard(r.alts, right)) return win(okB());
      if(r && (r.status === "denied" || r.status === "unavailable" || r.status === "unsupported")){
        micB.hidden = true; m.className = "fm-qm info"; m.textContent = "Toca mi nombre."; placePop(); return;
      }
      m.className = "fm-qm info"; m.textContent = "No te he oído bien. Toca la respuesta.";
    };
  }
  /* animación de comer */
  function eatFx(id, fid){
    const el = els[id]; if(!el || !isOn()) return;
    liftHint(id);
    freeze(id); busy[id] = true;
    render(id, true);
    const t = topOf(el, .5);
    fx(FOOD[fid].e, t.x + (parseFloat(el.style.getPropertyValue("--fx")) > 0 ? -3 : 3), t.y + 4, "fm-drip", 900);
    cls(el, "eat", 1300); play("eat"); later(() => play("eat"), 500);
    later(() => { busy[id] = false; heart(el); }, 1300);
  }
  /* los regalos caen junto al animal */
  function gifts(id, res){
    const it = itemById(id), el = els[id]; if(!el || !isOn()) return;
    let n = 0;
    for(const key of res.keys) if(s.prod[key] && !layer.querySelector(`[data-pk="${key}"]`)){ const i = n++; later(() => { if(s.prod[key] && !layer.querySelector(`[data-pk="${key}"]`)){ makeProd(key, true); play("pop"); } }, i * 300); }
    if(ANIM[id].moo) play("moo");
    bubble(wordBub(pj(it), iw(it), it.n, n > 1 ? "¡Gracias! Te dejo 2 regalos 🎁🎁" : n ? "¡Gracias! Te dejo un regalo 🎁" : res.weak ? "¡Gracias! ¡Ya me siento mejor! 💪" : "¡Gracias! Recoge mis regalos 🥚"), el, 3400);
    resume(id, 3000);
  }
  /* guarda un producto junto a su animal o árbol */
  function addProd(src, pid){
    const p = posOf(src); if(!p || !PROD[pid]) return null;
    const have = Object.values(s.prod).filter(P => P.a === src).length;
    if(have >= (ANIM[src] ? PROD_MAX : 2)) return null;
    /* al lado, sin taparlo: así el animal se puede seguir tocando (el 2.º al otro lado, el 3.º más abajo) */
    const W = layer.clientWidth || 600, half = ((els[src] && els[src].offsetWidth) || 52) / 2;
    const off = Math.max(TREE[src] ? 7 : 5.5, (half + 22) / W * 100);
    let side = p.x > 50 ? -1 : 1; if(p.x + side * off > 91 || p.x + side * off < 9) side = -side;
    if(have % 2 === 1 && p.x - side * off >= 9 && p.x - side * off <= 91) side = -side;
    const x = clamp(p.x + side * off * (have >= 2 ? .45 : 1) + rnd(-1, 1), 9, 91), y = clamp(p.y + (TREE[src] ? 2.5 : 1.5) + (have >= 2 ? 6 : 0), GR.y0 + 4, GR.y1);
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
    bar();
  }

  /* plantas */
  function tapPlant(id){
    const it = itemById(id), el = els[id], p = plant(id), w = iw(it);
    if(p.s >= 2 && !TREE[id]) return harvest(id);
    hop(el); play("tap");
    if(p.s >= 2){   /* árbol grande */
      const t = topOf(el, .3); for(let i = 0; i < 3; i++) later(() => fx("🍃", t.x + rnd(-6, 6), t.y + rnd(0, 8), "fm-leaf", 1600), i * 160);
      bubble(wordBub(pj(it), w, it.n, hasProd(id) ? "Mira lo que hay en el suelo 👇" : "Pronto dará un regalo 🎁"), el); speak(w); return;
    }
    const can = canWater(id) || s.drops > 0;
    bubble(wordBub(`${p.s <= 0 ? "🌱" : "🌿"}<small>→</small>${it.e}`, w, it.n, can ? "¡Riégame! 💧" : `Crece… vuelve en ${fmtLeft(WATER - (now() - plant(id).w))}`), el); speak(w);
    if(can) cls(bWater, "nudge", 1300);
  }
  function waterTap(id){
    const it = itemById(id), el = els[id], k = kindOf(id);
    if(!el) return false;
    if(k !== "plant"){
      hop(el); play("whoosh");
      bubble(msg(id === "pato" ? "🦆💦 ¡Al pato le encanta el agua!" : k === "animal" ? "💦 ¡Ji, ji! ¡Eso no es una planta!" : "💦 Eso no es una planta. ¡Toca una planta!"), el, 2600); return false;
    }
    const p = plant(id);
    if(p.s >= 2){
      if(!TREE[id]){ harvest(id); return true; }   /* ya está lista: se cosecha aunque esté regando */
      hop(el); bubble(msg("🌳 ¡Ya es muy grande!<br>No necesita más agua."), el, 3000); return false;
    }
    const free = canWater(id);
    if(!free && s.drops <= 0){
      cls(el, "no", 500); play("tap");
      bubble(msg(`🌿 Ya bebió agua.<br>Vuelve en ${fmtLeft(WATER - (now() - p.w))}.<br>📚 ¡Una lección te da agua extra!`), el, 4200); return false;
    }
    upd(st => { if(!free) st.drops = Math.max(0, st.drops - 1); const q = st.pl[id]; q.s = Math.min(2, q.s + 1); q.w = now(); });
    walkNear(id); play("whoosh");
    const t = topOf(el);
    for(let i = 0; i < 6; i++) later(() => fx("💧", t.x + rnd(-4, 4), t.y + rnd(-2, 6), "fm-drip", 700), i * 110);
    bar();
    later(() => {
      render(id, true); cls(el, "grow", 750);
      const ripe = plant(id).s >= 2;
      if(ripe){ play("ok"); burst(el, "✨", 6); bubble(wordBub(pj(it), iw(it), it.n, TREE[id] ? "¡Ha crecido un montón! 🌳" : "✨ ¡Ya está lista! ¡Cosecha!"), el); speak(iw(it)); if(TREE[id]) checkTrees(); }
      else bubble(msg(`💧 ¡Glu, glu! ¡Está creciendo!${free ? "" : "<br>Usaste 1 💧 extra."}`), el, 2600);
    }, 800);
    return true;
  }
  function harvest(id){
    const it = itemById(id), el = els[id], w = iw(it);
    walkNear(id);
    upd(st => { st.pl[id].s = 0; });
    flyTo(el, it.e); burst(el, "✨", 6);
    bubble(wordBub(pj(it), w, it.n, "¡Cosechado! 🧺"), el); speak(w);
    award(PLANT[id] || 3, `¡${cap(artEs(it.n))}!`);
    el._busy = true; cls(el, "pluck", 460);
    later(() => { el._busy = false; render(id, true); cls(el, "grow", 750); }, 470);
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
      bubble(wordBub(pj(it), w, it.n, lit() ? "💡 ¡Luz encendida!" : "🌙 Luz apagada"), el); speak(w); return;
    }
    bubble(wordBub(pj(it), w, it.n), el); speak(w);
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
    for(let i = 0; i < 5; i++) later(() => { fx("", t.x + rnd(-14, 14), Math.max(TB + 4, t.y - rnd(4, 20)), "fm-fw", 1150, {"--c": pick(["#FFCC00", "#5aa2ff", "#45cf8b"])}); play("pop"); }, i * 320);
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
    const Wd = SKYW[key], w = pw(Wd);
    bubble(wordBub(Wd.e, w, Wd.n), el); speak(w); play("pop");
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
    if(withWord){ const Wd = SKYW.estrella, w = pw(Wd); bubble(wordBub(Wd.e, w, Wd.n), {x, y}); speak(w); play("pop"); }
  }
  function butterfly(x, y){
    if(!RM()) fx("🦋", x, y, "fm-bfly", 2700);
    const Wd = SKYW.mariposa, w = pw(Wd); bubble(wordBub(Wd.e, w, Wd.n), {x, y}); speak(w); play("pop");
  }

  /* ---------- juego «¿Dónde está…?» (se empieza tocando al personaje) ---------- */
  function dots(){ return `<span class="fm-dots">${Array.from({length: ROUNDS}, (_, i) => `<i class="${i < F.res.length ? (F.res[i] ? "ok" : "no") : i === F.res.length ? "now" : ""}"></i>`).join("")}</span>`; }
  /* solo cosas que se reconocen: las plantas cuentan cuando ya han crecido */
  const findable = () => owned().map(x => x.id).filter(id => els[id] && (kindOf(id) !== "plant" || plant(id).s >= 2));
  function startFind(){
    if(finding()) return;
    const ids = findable();
    if(ids.length < 3){
      play("tap");
      bubble(msg(owned().length >= 3 ? "🔍 Para jugar hacen falta 3 cosas que se vean.<br>¡Haz crecer tus plantas! 🌻" : "🔍 Para jugar hacen falta 3 cosas.<br>¡Mira la tienda! 🛒"), hero, 4500);
      return;
    }
    setWater(false); setFood(null); closeTray(); closePop(true); hideBub();
    F = {round: 0, ok: 0, res: [], prev: null, bag: shuffle(ids), lock: false, done: false, t0: now()};
    Object.keys(els).forEach(id => { if(ANIM[id]) freeze(id); });
    stage.classList.add("finding"); bar(); play("whoosh");
    later(nextRound, 250);
  }
  function nextRound(){
    if(!F || F.done) return;
    if(F.round >= ROUNDS) return endFind();
    const ids = findable();
    if(!ids.length) return exitFind();   /* se fueron todos al refugio */
    if(!F.bag.length) F.bag = shuffle(ids.filter(id => id !== F.prev));
    let id = F.bag.shift(); if(!ids.includes(id)) id = pick(ids);
    F.target = id; F.prev = id; F.lock = false;
    const it = itemById(id), w = iw(it);
    fb.hidden = false;
    fb.innerHTML = `<span class="fm-fh">${heroHtml(30)}</span><span class="fm-ft"><small>¿Dónde está…?</small><b lang="${code()}">${esc(w)}</b>${dots()}</span>
      <button type="button" class="say" data-say="${esc(w)}" aria-label="Escuchar" title="Escuchar">${icon("speaker-high", "fill", 22)}</button><button type="button" class="fm-fq" aria-label="Salir del juego" title="Salir">${icon("x", "bold", 18)}</button>`;
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
    if(ok) srsWord(F.target);
    const dd = fb.querySelector(".fm-dots"); if(dd) dd.outerHTML = dots();
    if(ok){ play("ok"); hop(el); burst(el, "⭐", 5); bubble(wordBub(pj(it), w, it.n, "¡Muy bien! ✅"), el, 1400); }
    else { cls(tEl, "hl", 2300); bubble(wordBub(pj(it), w, it.n, "¡Está aquí! 👇"), tEl || el, 2300); speak(w); }
    later(nextRound, ok ? 1300 : 2500);
  }
  function endFind(){
    F.done = true;
    const n = F.ok, all = n === ROUNDS, day = dayKey(new Date()); let paid = false;
    upd(st => { if(!st.fd || st.fd.day !== day) st.fd = {day, n: 0}; if(st.fd.n < FIND_PAID){ st.fd.n++; paid = true; } });
    const coins = paid ? n + (all ? 5 : 0) : 0;
    if(coins) award(coins, all ? "¡Lo encontraste todo!" : "¿Dónde está?");
    if(all){ play("fanfare"); try{ if(window.M && M.confetti) M.confetti({n: 40}); }catch(e){} } else if(n) play("ok");
    fb.innerHTML = `<span class="fm-fh">${heroHtml(30)}</span><span class="fm-ft"><small>${all ? "¡Perfecto! 🏆" : n >= 3 ? "¡Muy bien! 🎉" : "¡Buen intento! 💪"}</small><b>${n} de ${ROUNDS}</b>${coins ? `<em>+${coins} monedas</em>` : !paid ? `<em class="m">Hoy ya ganaste monedas aquí</em>` : ""}</span>
      <button type="button" class="btn-fill fm-fa">Otra vez</button><button type="button" class="fm-fq" aria-label="Cerrar" title="Cerrar">${icon("x", "bold", 18)}</button>`;
    stage.classList.remove("finding"); bar();
    Object.keys(els).forEach(id => { if(ANIM[id]) resume(id, rnd(800, 2500)); });
    later(nextIntro, 1800);   /* avisos pendientes (alguien se fue al refugio mientras jugaba) */
  }
  function exitFind(){
    const was = finding(); F = null; fb.hidden = true; stage.classList.remove("finding"); bar();
    if(was) Object.keys(els).forEach(id => { if(ANIM[id]) resume(id, rnd(500, 2000)); });
    later(nextIntro, 350);
  }

  /* ---------- refugio y avisos ---------- */
  /* comidas que hacen falta: las de sus animales (también los del refugio) y las que ya tiene */
  const neededFoods = () => Object.keys(FOOD).filter(k => ownedAnimals().some(id => ANIM[id].eats === k) || (s.pan[k] || 0) > 0);
  const eatersOf = k => ownedAnimals().filter(id => ANIM[id].eats === k).map(id => pj(itemById(id), "pj-sm")).join("");
  function openShelter(){
    if(dlgOpen()) return;
    play("tap");
    const d = dlg(`${head("El refugio")}
      <p class="fm-sub">Aquí cuidan a los animales que pasaron mucha hambre. ¡Puedes traerlos a casa!</p>
      <div class="fm-pl"></div><p class="fm-qm" aria-live="polite"></p>`, "fm-shd");
    const list = d.querySelector(".fm-pl"), m = d.querySelector(".fm-qm"), back = [];
    function paint(){
      const ids = Object.keys(s.shelter).filter(id => itemById(id));
      list.innerHTML = ids.length ? ids.map(id => {
        const it = itemById(id), w = iw(it), Fd = FOOD[ANIM[id].eats], p = rescuePrice(it), miss = p - coinsNow();
        return `<div class="fm-prow" data-sh="${id}"><span class="fm-pe2" aria-hidden="true">${pj(it)}</span>
          <span class="fm-pt"><span class="fm-pw"><b lang="${code()}">${esc(w)}</b><button type="button" class="say shp-spk" data-say="${esc(w)}" aria-label="Escuchar «${esc(w)}»">${icon("speaker-high", "fill", 22)}</button></span>
            <small>${esc(it.n)} · come ${Fd.e} ${esc(Fd.n)}</small></span>
          <span class="fm-pbs one"><button type="button" class="btn-fill fm-pb res${miss > 0 ? " no" : ""}" data-rescue="${id}">${miss > 0 ? `Te faltan <span class="t-num">${miss}</span>${COIN}` : `Traer a casa · ${COIN}<span class="t-num">${p}</span>`}</button></span></div>`;
      }).join("") + `<p class="fm-note2">Vuelve con 1 corazón: ¡dale de comer enseguida!</p>`
        : `<p class="fm-note">¡No hay nadie! 🥰<br>Todos tus animales están en casa.</p>`;
    }
    paint();
    list.addEventListener("click", e => {
      const b = e.target.closest("[data-rescue]"); if(!b) return;
      const id = b.dataset.rescue, it = itemById(id); if(!it || !s.shelter[id]) return;
      const p = rescuePrice(it), have = coinsNow();
      if(have < p || !spend(p, `Rescate: ${it.n}`)){ play("tap"); m.className = "fm-qm info"; m.innerHTML = poorTxt(p - have); if(m.scrollIntoView) m.scrollIntoView({block: "nearest"}); return; }
      upd(st => { delete st.shelter[id]; st.fed[id] = now() - HMS(RESCUE_H); });
      emit("farm-rescue", {item: it});
      play("gift"); speak(iw(it));
      m.className = "fm-qm ok"; m.innerHTML = `${pj(it, "pj-sm")} ¡${cap(elA(id))} vuelve a casa! 🏡`;
      comeBack(id); back.push(id); paint();
    });
    d.addEventListener("close", () => {
      if(!isOn() || !back.length) return;
      const id = back[back.length - 1], el = els[id], it = itemById(id), Fd = FOOD[ANIM[id].eats];
      if(!el) return;
      freeze(id); cls(el, "hl", 2500); resume(id, 2800);
      later(() => bubble(wordBub(pj(it), iw(it), it.n, `¡Gracias por rescatarme! Dame ${Fd.e} ${Fd.n}`), el, 4500), 300);
    });
  }
  /* vuelve del refugio: aparece en la granja */
  function comeBack(id){
    const it = itemById(id); if(!it || els[id]) return;
    if(!okPos(s.pos[id])) upd(st => st.pos[id] = spot(id, st.pos, GR.y0));
    makeItem(it); cls(els[id], "new", 800);
    wt[id] = later(() => wander(id), 2600);
    shopSync();
    pickLead(); trayPaint(); shelSign();
  }
  /* se va al refugio mientras mira la granja */
  function leave(ids){
    /* su globo de comer ya no sirve: se cierra (el aviso sale a continuación) */
    if(popOpen() && ids.includes(popEl.dataset.fid)) closePop(true);
    for(const id of ids){
      const el = els[id]; if(!el) continue;
      cancel(wt[id]); const t = topOf(el, .5); puffs(t.x, t.y, 3, 140);
      el.classList.add("bye"); later(() => el.remove(), 650);
      delete els[id]; delete live[id];
    }
    shopSync();
    pickLead(); trayPaint(); shelSign();
    /* «¿Dónde está?»: si se fue lo que había que buscar, otra ronda (o se acaba si ya no queda nada) */
    if(finding() && ids.includes(F.target) && !F.lock){ F.lock = true; later(nextRound, 700); }
    /* con una hoja abierta o jugando, el aviso espera su turno (sale al cerrar o al terminar el juego) */
    if(!dlgOpen() && !finding()) departed();
    else intro.push(() => departed() ? undefined : 0);
  }
  /* aviso triste pero amable: alguien se fue al refugio (solo una vez) */
  function departed(){
    const ids = Object.keys(s.shelter).filter(id => !s.shelter[id].seen && itemById(id)); if(!ids.length) return false;
    upd(st => ids.forEach(id => st.shelter[id].seen = true));
    const pl = ids.length > 1, lo = pl ? "los" : ANIM[ids[0]].f ? "la" : "lo";
    const d = dlg(`${head(pl ? "Se fueron al refugio" : `${cap(elA(ids[0]))} se fue al refugio`, "Vale")}
      <div class="fm-dep" aria-hidden="true">${ids.map(id => pj(itemById(id))).join(" ")}</div>
      <p class="fm-sub">${pl ? `${cap(joinY(ids.map(elA)))} tenían` : "Tenía"} mucha hambre. En el refugio ${lo} cuidan muy bien. ¡Puedes traer${lo} de vuelta!</p>
      <div class="fm-dbtns"><button type="button" class="btn-fill fm-go">${icon("house", "bold", 20)}<span>Ver el refugio</span></button></div>`, "fm-dpd");
    d.querySelector(".fm-go").onclick = () => { shut(d); later(openShelter, 380); };
    play("whoosh");
    return true;
  }
  /* vuelve tras 2 días o más sin venir: el personaje lo cuenta y los animales saltan */
  function missYou(){
    const an = Object.keys(els).filter(id => ANIM[id]); if(!an.length) return 0;
    const n = an.filter(id => needy(id)).length;
    bubble(msg(`🥰 ¡Te echaban de menos!${n ? "<br>¡Tienen hambre!" : ""}`), hero, 4200);
    play("pop");
    an.forEach((id, i) => later(() => { const el = els[id]; if(el && hearts(id) > 0){ hop(el); heart(el); } }, 300 + i * 140));
    return 4300;
  }
  function shelSign(){
    const n = Object.keys(s.shelter).length;
    shelB.hidden = !ownedAnimals().length;
    const b = shelB.querySelector(".fm-shb"); b.hidden = !n; b.textContent = n;
    shelB.classList.toggle("has", n > 0);
    shelB.setAttribute("aria-label", n ? `Refugio: ${n === 1 ? "1 animal" : n + " animales"}` : "Refugio");
  }

  /* ---------- la bandeja de comida (Comida): tocar = elegirla y luego un animal · arrastrarla hasta un animal ---------- */
  function trayPaint(){
    if(dragging){ tray._repaint = true; return; }
    if(tray.hidden) return;
    const ks = neededFoods();
    const html = `<div class="fm-tr">${ks.map(k => { const n = s.pan[k] || 0, Fd = FOOD[k];
        return `<button type="button" class="fm-fc${n ? "" : " zero"}${foodMode === k ? " on" : ""}" data-pfood="${k}" aria-pressed="${foodMode === k}" aria-label="${esc(fw(k))}, ${esc(Fd.n)}: ${n === 1 ? "1 ración" : n + " raciones"}${n ? "" : ". Toca para comprar"}"><span class="fe" aria-hidden="true">${Fd.e}</span><span class="fw" lang="${code()}">${esc(fw(k))}</span><b class="fn">${n}</b></button>`; }).join("")}
        <button type="button" class="fm-fc fm-fbuy" data-tray-shop aria-label="Comprar comida">${icon("plus", "bold", 26)}<span class="fw">Comprar</span></button></div>
      <p class="fm-tn">${ks.length ? (foodMode ? `Toca un animal para darle ${FOOD[foodMode].e}` : "Arrástrala hasta un animal") : "Aún no tienes animales 🐣"}</p>`;
    if(tray._h === html) return;
    tray._h = html; tray.innerHTML = html;
    tray.querySelectorAll("[data-pfood]").forEach(c => bindFoodDrag(c));
  }
  function openTray(){
    if(finding()) exitFind();
    setWater(false); closePop(true); noHint();
    tray.hidden = false; tray._h = ""; trayPaint();
    bFood.setAttribute("aria-expanded", "true");
    tray.classList.remove("in"); void tray.offsetWidth; tray.classList.add("in");
  }
  function closeTray(){
    if(tray.hidden) return;
    tray.hidden = true; tray._h = ""; bFood.setAttribute("aria-expanded", "false");
    if(foodMode) setFood(null);
  }
  function bindFoodDrag(c){
    const g = GS(); if(!g) return;
    const k = c.dataset.pfood;
    OFF.push(g.drag(c, {
      ghost: () => { const n = document.createElement("span"); n.className = "fm-dghost"; n.textContent = FOOD[k].e; return n; },
      onStart: i => {
        if(!isOn() || finding() || dlgOpen() || !((s.pan[k] || 0) > 0)) return false;
        dragging = true; hideBub(); closePop(true); coachDone(); play("tap");
        if(i.ghost) Object.assign(i.ghost.style, {left: (i.x - i.dx - 32) + "px", top: (i.y - i.dy - 52) + "px", width: "64px", height: "64px"});
      },
      onMove: i => { dropMark(animalAt(i.x, i.y)); },
      onDrop: i => {
        dragging = false; dropMark(null);
        const id = animalAt(i.x, i.y);
        const ok = id ? giveFood(id, k) : (bubble(msg(`${FOOD[k].e} Suéltala encima de un animal.`), hero, 2400), false);
        if(tray._repaint){ tray._repaint = false; trayPaint(); }
        return ok;
      },
      onCancel: () => { dragging = false; dropMark(null); if(tray._repaint){ tray._repaint = false; trayPaint(); } },
    }));
  }
  tray.addEventListener("click", e => {
    if(e.target.closest("[data-tray-shop]")) return openShop({from: e.target.closest("button")});
    const c = e.target.closest("[data-pfood]"); if(!c || finding()) return;
    const k = c.dataset.pfood;
    if(!((s.pan[k] || 0) > 0)) return openShop({food: k, from: c});
    setFood(foodMode === k ? null : k);
  });
  const dropMark = id => Object.keys(els).forEach(k => els[k].classList.toggle("drop", k === id));
  function animalAt(x, y){ return itemAt(x, y, id => !!ANIM[id]); }
  function plantAt(x, y){ return itemAt(x, y, id => kindOf(id) === "plant"); }
  function itemAt(x, y, ok){
    let best = null, bd = Infinity;
    for(const id of Object.keys(els)){
      if(!ok(id)) continue;
      const g = els[id].querySelector(".fm-e"); if(!g) continue;
      const r = g.getBoundingClientRect(), pad = 16;
      if(!r.width || x < r.left - pad || x > r.right + pad || y < r.top - pad || y > r.bottom + pad) continue;
      const dd = Math.hypot(x - r.left - r.width / 2, y - r.top - r.height / 2); if(dd < bd){ bd = dd; best = id; }
    }
    return best;
  }

  /* ---------- modos: regar y dar de comer (tocando) ---------- */
  function paintHint(){
    if(waterMode) hint.innerHTML = `<span>💧 Toca una planta para regarla</span><button type="button" class="fm-hx">Parar</button>`;
    else if(foodMode) hint.innerHTML = `<span>${FOOD[foodMode].e} Toca un animal para darle ${esc(FOOD[foodMode].n)}</span><button type="button" class="fm-hx">Parar</button>`;
    hint.hidden = !waterMode && !foodMode;
  }
  function setFood(fid){
    if(fid && (finding() || !FOOD[fid])) return;
    if(fid && waterMode){ waterMode = false; stage.classList.remove("watering"); }
    foodMode = fid || null;
    stage.classList.toggle("feeding", !!foodMode);
    paintHint();
    if(foodMode){ play("pop"); hideBub(); closePop(true); }
    bar(); trayPaint();
  }
  function setWater(on){
    if(on && finding()) return;
    if(on && !owned().some(x => kindOf(x.id) === "plant")){ play("tap"); bubble(msg("🌱 Aún no tienes plantas.<br>¡Mira la tienda! 🛒"), hero, 4000); return; }
    if(on){ if(foodMode){ foodMode = null; stage.classList.remove("feeding"); } closeTray(); closePop(true); }
    waterMode = !!on; stage.classList.toggle("watering", waterMode);
    paintHint();
    if(waterMode){ play("pop"); hideBub(); }
    bar();
  }
  function bar(){
    bWater.setAttribute("aria-pressed", String(waterMode));
    const b = bWater.querySelector(".fm-badge"); b.hidden = !(s.drops > 0); b.innerHTML = `${icon("drop", "bold", 12)}<span class="t-num">${s.drops}</span>`;
    bWater.setAttribute("aria-label", s.drops > 0 ? `Regar. Tienes ${s.drops} de agua extra` : "Regar");
    bWater.title = "Regar · o arrastra la regadera hasta una planta";
  }
  /* arrastrar la regadera hasta una planta = regarla (lo mismo que «Regar» y tocar la planta) */
  {
    const g = GS();
    if(g) OFF.push(g.drag(bWater, {
      ghost: () => { const n = document.createElement("span"); n.className = "fm-dghost"; n.textContent = "💧"; return n; },
      onStart: i => {
        if(!isOn() || finding() || dlgOpen() || !owned().some(x => kindOf(x.id) === "plant")) return false;
        dragging = true; hideBub(); closePop(true); closeTray(); play("tap");
        if(i.ghost) Object.assign(i.ghost.style, {left: (i.x - i.dx - 32) + "px", top: (i.y - i.dy - 52) + "px", width: "64px", height: "64px"});
      },
      onMove: i => { const id = plantAt(i.x, i.y); Object.keys(els).forEach(k => els[k].classList.toggle("drop", k === id)); },
      onDrop: i => {
        dragging = false; dropMark(null);
        const id = plantAt(i.x, i.y);
        if(!id){ bubble(msg("💧 Suéltala encima de una planta."), hero, 2400); return false; }
        return waterTap(id);
      },
      onCancel: () => { dragging = false; dropMark(null); },
    }));
  }

  /* ---------- la tienda de la granja: hoja de M con la comida y las piezas de js/shop.js ---------- */
  const shopFarm = () => (window.vocabShop ? vocabShop.items("farm") : SHOP.filter(x => x.t === "farm"));
  const card = x => window.vocabShop ? vocabShop.card(x, {mode: "farm"}) : "";
  function foodBtn(k, n){
    const Fd = FOOD[k], c = Fd.c * n, miss = c - coinsNow(), room = PAN_MAX - (s.pan[k] || 0);
    if(room <= 0) return `<button type="button" class="btn-fill fm-pb" data-fbuy="${k}" data-n="${n}" disabled>¡Ya tienes mucha!</button>`;
    if(miss > 0) return `<button type="button" class="btn-fill fm-pb no" data-fbuy="${k}" data-n="${n}" aria-disabled="true" aria-label="${n} de ${esc(Fd.n)}: cuesta ${c}, te ${miss === 1 ? "falta 1 moneda" : `faltan ${miss} monedas`}">Te faltan <span class="t-num">${miss}</span>${COIN}</button>`;
    return `<button type="button" class="btn-fill shp-tint fm-pb" data-fbuy="${k}" data-n="${n}" aria-label="Comprar ${n} de ${esc(Fd.n)}: ${c} monedas">+${n}<span class="shp-dot" aria-hidden="true">·</span>${COIN}<span class="t-num">${c}</span></button>`;
  }
  function foodRow(k){
    const Fd = FOOD[k], w = fw(k), who = eatersOf(k);
    return `<div class="fm-prow" data-pf="${k}">
      <span class="fm-pe2" aria-hidden="true">${Fd.e}</span>
      <span class="fm-pt"><span class="fm-pw"><b lang="${code()}">${esc(w)}</b><button type="button" class="say shp-spk" data-say="${esc(w)}" aria-label="Escuchar «${esc(w)}»">${icon("speaker-high", "fill", 22)}</button></span>
        <small>${esc(Fd.n)}${who ? ` · para ${who}` : ""}</small><small class="fm-have">Tienes <b class="t-num">${s.pan[k] || 0}</b></small></span>
      <span class="fm-pbs">${foodBtn(k, 1)}${foodBtn(k, 3)}</span><p class="fm-qm fm-rm" aria-live="polite"></p></div>`;
  }
  function shopHtml(){
    const farm = shopFarm(), an = farm.filter(x => ANIM[x.id]), pl = farm.filter(x => PLANT[x.id] !== undefined), th = farm.filter(x => !ANIM[x.id] && PLANT[x.id] === undefined);
    const ks = neededFoods();
    const sec = (t, k, list) => list.length ? `<section class="fm-ss" aria-labelledby="fm-sh-${k}"><h3 class="fm-sh3" id="fm-sh-${k}">${t}</h3><div class="shop">${list.map(card).join("")}</div></section>` : "";
    return `${head("Tienda", "Listo", "fm-shop-t")}
      <p class="fm-scoin">Tienes ${COIN}<b class="t-num" data-fm-coins data-coins-n>${coinsNow()}</b></p>
      <a class="fm-zrow" href="#/mizorro" data-zorro><span class="fm-zi" aria-hidden="true">${typeof heroHtml === "function" ? heroHtml(38) : "🦊"}</span>
        <span class="fm-zt"><b>Sombreros, gafas y juguetes</b><small>Para tu zorro, en Premios</small></span><span class="fm-zg">Mi zorro${icon("caret-right", "bold", 16)}</span></a>
      <section class="fm-ss" aria-labelledby="fm-sh-c"><h3 class="fm-sh3" id="fm-sh-c">Comida</h3>
        <div class="fm-pl" data-fm-foods>${ks.length ? ks.map(foodRow).join("") : `<p class="fm-note">Primero, un animal 🐣<br>¡Mira aquí abajo!</p>`}</div></section>
      ${sec("Animales", "a", an)}${sec("Plantas", "p", pl)}${sec("Cosas", "t", th)}`;
  }
  const PHONE = () => matchMedia("(max-width:819px)").matches;
  function openShop(o){
    o = o || {};
    if(finding()) exitFind();
    closePop(true); setWater(false); setFood(null); closeTray(); hideBub(); noHint();
    if(!shopDlg){
      const d = shopDlg = document.createElement("dialog");
      d.id = "fm-shop"; d.className = "m-sheet glass lite fm-sheet"; d.setAttribute("aria-labelledby", "fm-shop-t");
      root.appendChild(d);
      d.addEventListener("click", e => {
        if(e.target.closest("[data-x]")) return shut(d);
        /* los trajes del zorro están en Premios › Mi zorro: se cierra la hoja y se va allí */
        if(e.target.closest("[data-zorro]")){ e.preventDefault(); shut(d); location.hash = "#/mizorro"; return; }
        const b = e.target.closest("[data-fbuy]"); if(!b) return;
        const k = b.dataset.fbuy, r = buyFood(k, +b.dataset.n || 1);
        const row = d.querySelector(`.fm-prow[data-pf="${k}"]`), m = row && row.querySelector(".fm-rm");
        d.querySelectorAll(".fm-rm").forEach(x => { if(x !== m){ x.className = "fm-qm fm-rm"; x.innerHTML = ""; } });
        if(r.ok){ speak(fw(k)); if(row){ const e2 = row.querySelector(".fm-pe2"); if(e2) cls(e2, "pop", 520); } try{ if(window.G && G.haptic) G.haptic("success"); }catch(err){} }
        else play("tap");   /* le falta: aviso amable, sin sonido triste */
        if(!m) return;
        m.className = "fm-qm fm-rm " + (r.ok ? "ok" : "info");
        m.innerHTML = r.ok ? `¡Comprado! ${FOOD[k].e} <b lang="${code()}">${esc(fw(k))}</b> ×${r.n}` : r.full ? `¡Ya tienes mucha comida ${FOOD[k].e}!` : poorTxt(r.need);
        if(m.scrollIntoView) m.scrollIntoView({block: "nearest"});
      });
      /* dos alturas en el móvil: a media pantalla y, al bajar el contenido o subir el agarre, entera */
      d.addEventListener("scroll", () => { if(d.dataset.detent === "medium" && d.scrollTop > 2) detent("large"); });
      let gy = null;
      d.addEventListener("pointerdown", e => { gy = e.isPrimary && e.target.closest && e.target.closest(".m-grab, .m-head") ? {id: e.pointerId, y: e.clientY} : null; });
      d.addEventListener("pointermove", e => { if(gy && e.pointerId === gy.id && e.clientY - gy.y < -24 && d.dataset.detent === "medium") detent("large"); });
      d.addEventListener("pointerup", () => { gy = null; });
      d.addEventListener("close", () => {
        if(!isOn()) return;
        /* lo que se compró aparece con su «¡Nuevo!» al cerrar la hoja */
        const id = newPend.pop(); newPend.length = 0;
        if(id && els[id]){ const it = itemById(id), k = kindOf(id); later(() => { if(els[id]) bubble(wordBub(pj(it), iw(it), it.n, k === "animal" ? "¡Nuevo! Tiene hambre 🍽️" : k === "plant" ? "¡Nuevo! Riégalo 💧" : "¡Nuevo! Tócalo ✨"), els[id], 4500); }, 380); }
        later(nextIntro, 400);
      });
      if(window.vocabShop) OFF.push(vocabShop.bind(d, {onChange: e => { if(e && e.type === "buy") addLive(e.id); }}));
    }
    const d = shopDlg;
    d.innerHTML = shopHtml();
    d.dataset.detent = PHONE() && !o.food ? "medium" : "large";
    const from = o.from && o.from.nodeType === 1 ? o.from : document.querySelector("[data-coins-pill]");
    if(!d.open){ if(window.M && typeof M.openSheet === "function") M.openSheet(d, {from}); else { try{ d.showModal(); }catch(e){ d.setAttribute("open", ""); } } }
    d.scrollTop = 0;
    if(o.food && FOOD[o.food]) later(() => {
      const row = d.querySelector(`.fm-prow[data-pf="${o.food}"]`); if(!row) return;
      row.classList.add("focus"); later(() => row.classList.remove("focus"), 2600);
      if(row.scrollIntoView) row.scrollIntoView({block: "center", behavior: RM() ? "auto" : "smooth"});
    }, 120);
  }
  function detent(name){
    const d = shopDlg; if(!d || d.dataset.detent === name) return;
    const h0 = d.getBoundingClientRect().height; d.dataset.detent = name;
    const h1 = d.getBoundingClientRect().height;
    if(!RM() && d.animate && Math.abs(h1 - h0) > 2 && window.M && M.snappy) try{ d.animate([{height: h0 + "px"}, {height: h1 + "px"}], {duration: M.snappy.ms, easing: M.snappy.easing}); }catch(e){}
  }
  function closeShop(){ if(shopDlg && shopDlg.open) shut(shopDlg); }
  /* la comida de la hoja: «Tienes N» y los botones (precio que llega o «Te faltan»), sin repintar la hoja */
  function shopFoods(){
    const d = shopDlg; if(!d || !d.open) return;
    const box = d.querySelector("[data-fm-foods]"); if(!box) return;
    for(const row of box.querySelectorAll(".fm-prow[data-pf]")){
      const k = row.dataset.pf, h = row.querySelector(".fm-have b"); if(h) h.textContent = s.pan[k] || 0;
      const bs = row.querySelector(".fm-pbs"), fo = bs && bs.contains(document.activeElement) ? document.activeElement.dataset.n : null;
      const html = foodBtn(k, 1) + foodBtn(k, 3);
      if(bs && bs._h !== html){ bs._h = html; bs.innerHTML = html; if(fo){ const f = bs.querySelector(`[data-n="${fo}"]`); if(f) f.focus({preventScroll: true}); } }
    }
  }
  function shopCoins(){
    const d = shopDlg; if(!d || !d.open) return;
    const c = d.querySelector("[data-fm-coins]"); if(c) c.textContent = coinsNow();
    shopFoods();
  }
  /* comprado (en la hoja o fuera): aparece en la escena sin volver a montar la granja */
  function addLive(id){
    const it = itemById(id); if(!it || it.t !== "farm" || els[id] || !game().owned[id] || inShelterS(s, id)) return;
    careSync(s);   /* un animal nuevo llega con 2 corazones (y con hambre) */
    if(!s.seen[id]) s.seen[id] = now();
    if(kindOf(id) === "plant" && (!s.pl[id] || typeof s.pl[id] !== "object")) s.pl[id] = {s: 1, w: 0};
    if(!okPos(s.pos[id])) s.pos[id] = spot(id, s.pos, GR.y0);
    s.pos[id] = {x: clamp(s.pos[id].x, GR.x0, GR.x1), y: clamp(s.pos[id].y, GR.y0, GR.y1)};
    save(s);
    makeItem(it); cls(els[id], "new", 800);
    if(ANIM[id]) wt[id] = later(() => wander(id), 2600);
    pickLead(); trayPaint(); shelSign(); shopFoods();
    if(shopDlg && shopDlg.open){
      newPend.push(id);
      /* la comida del animal nuevo: su fila sale ya en la hoja */
      const box = shopDlg.querySelector("[data-fm-foods]");
      if(box && ANIM[id] && !box.querySelector(`[data-pf="${ANIM[id].eats}"]`)) box.innerHTML = neededFoods().map(foodRow).join("");
    } else later(() => { if(els[id]) bubble(wordBub(pj(it), iw(it), it.n, "¡Nuevo! ✨"), els[id], 4000); }, 300);
  }

  /* ---------- la primera vez: una mano enseña a arrastrar la comida hasta el animal ---------- */
  function coach(){
    const gift = s.wpend === "gift", wp = !!s.wpend, extra = s.cnew;
    upd(st => { delete st.wpend; delete st.cnew; });
    const ft = Object.keys(extra || {}).filter(k => FOOD[k]).map(k => `${FOOD[k].e}×${extra[k]}`).join(" ");
    if(gift) note("¡Un regalo! Una gallina, una flor y grano", "🎁");
    else if(ft) note(`¡Comida de regalo! ${ft}`, "🎁");
    else if(wp) note("¡Tu granja está viva!", "✨");
    if(gift) play("gift");
    /* a quién: uno con hambre cuya comida ya tiene (el más urgente si puede) */
    const cand = Object.keys(els).filter(id => ANIM[id] && needy(id) && hungry(id) && (s.pan[ANIM[id].eats] || 0) > 0);
    const id = cand.includes(leadId) ? leadId : cand[0];
    if(!id) return 1200;
    openTray();
    later(() => showCoach(id), 500);
    return 6500;
  }
  function showCoach(id){
    coachDone();
    const el = els[id], fid = ANIM[id] && ANIM[id].eats, chip = fid && tray.querySelector(`[data-pfood="${fid}"]`);
    if(!el || !chip || tray.hidden || dlgOpen() || popOpen()) return;
    freeze(id); busy[id] = true;
    const a = chip.getBoundingClientRect(), t = (el.querySelector(".fm-e") || el).getBoundingClientRect();
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = t.left + t.width / 2, y1 = t.top + t.height / 2;
    const c = coachEl = document.createElement("div");
    c.className = "fm-coach"; c.setAttribute("role", "status");
    c.innerHTML = `<span class="fm-cht">${FOOD[fid].a === "la" ? "Arrástrala" : "Arrástralo"} hasta ${esc(elA(id))}</span><span class="fm-chh" aria-hidden="true">${HAND}</span>`;
    c.style.left = x0 + "px"; c.style.top = y0 + "px";
    stage.appendChild(c);
    cls(chip, "coached", 4800);
    if(!RM() && c.animate){
      coachAnim = c.animate([
        {translate: "0 0", opacity: 0, offset: 0}, {translate: "0 0", opacity: 1, offset: .12},
        {translate: `${x1 - x0}px ${y1 - y0}px`, opacity: 1, offset: .7}, {translate: `${x1 - x0}px ${y1 - y0}px`, opacity: 0, offset: 1}],
        {duration: 1800, iterations: 3, easing: "ease-in-out"});
      coachAnim.onfinish = () => { if(coachEl === c){ c.style.translate = "0 0"; c.classList.add("still"); } };
    } else c.classList.add("still");
    later(() => { if(coachEl === c) coachDone(); }, 9000);
  }
  function coachDone(){
    if(!coachEl) return;
    const c = coachEl; coachEl = null;
    try{ if(coachAnim) coachAnim.cancel(); }catch(e){} coachAnim = null;
    c.remove();
    for(const id of Object.keys(busy)) if(busy[id] && ANIM[id] && !lift){ busy[id] = false; resume(id, 1500); }
  }

  /* ---------- un repaso cada 15 s ---------- */
  function tick(){
    if(!isOn()) return;
    const p = phase();
    if(p !== ph){ ph = p; stage.dataset.ph = p; }
    const cr = careSync(s); if(cr.ch) save(s); if(cr.gone.length) leave(cr.gone);
    skyPos(); checkTrees();
    pickLead();
    for(const id of Object.keys(els)) render(id);
    bar(); trayPaint(); shelSign(); shopFoods();
    if(ph === "night" && Math.random() < .25) shootingStar(rnd(30, 90), rnd(Math.max(6, TB + 4), 28), false);
  }
  function skyPos(){
    const h = hourNow(), top0 = Math.max(11, TB + 7);
    if(ph === "night"){ const p = clamp(((h - 21 + 24) % 24) / 9, 0, 1); moon.style.left = (10 + 80 * p) + "%"; moon.style.top = Math.max(top0, HZ * .68 - Math.sin(Math.PI * p) * (HZ * .68 - 12)) + "%"; }
    else { const p = clamp((h - 6) / 15, 0, 1); sun.style.left = (8 + 84 * p) + "%"; sun.style.top = Math.max(top0, HZ * .8 - Math.sin(Math.PI * p) * (HZ * .8 - 11)) + "%"; }
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
  /* una pista de gestos (G.hint, fuera de la escena) que sale encima de la nube del hambre no se come el toque: va a la nube */
  const onHintTap = e => {
    const t = e.target; if(!alive || !t || !t.closest || !t.closest(".g-hint") || t.closest(".g-hint-x")) return;
    let a = null; try{ a = document.elementsFromPoint(e.clientX, e.clientY).map(x => x.closest && x.closest(".fm-ask")).find(Boolean); }catch(err){}
    const ai = a && a.closest(".fm-it"); if(!ai || !stage.contains(ai) || !ai.dataset.fid) return;
    e.stopPropagation(); noHint(); tap(ai.dataset.fid, e);
  };
  document.addEventListener("click", onHintTap, true); OFF.push(() => document.removeEventListener("click", onHintTap, true));
  stage.addEventListener("click", e => {
    const t = e.target;
    /* (un botón del globo que ya se quitó al tocarlo, p. ej. la comida elegida, no es un toque en la escena) */
    if(!t.isConnected || t.closest(".fm-bub, .fm-find, .fm-hint, .fm-pop, .fm-tray, .fm-dock, .fm-coach")) return;
    if(t.closest(".fm-shel")){ if(!finding()) openShelter(); return; }
    /* el globo del hambre (la nube blanca que sale del animal) es del animal: tocarlo es tocarlo a él (con hambre, su comida) */
    const ask = t.closest(".fm-ask"), ai = ask && ask.closest(".fm-it");
    if(ai && ai.dataset.fid) return tap(ai.dataset.fid, e);
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
    if(y > 100) return;
    if(y >= HZ + 2){ fx("", x, y, "fm-ring", 650); play("tap"); walkTo(x, y); }
    else if(ph === "night") shootingStar(x, y, true);
    else butterfly(x, y);
  });
  hero.addEventListener("keydown", e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); tapHero(); } });
  bub.addEventListener("click", e => { if(e.target.closest("[data-play-find]")){ e.stopPropagation(); hideBub(); startFind(); } });
  fb.addEventListener("click", e => {
    if(e.target.closest(".fm-fq")) return exitFind();
    if(e.target.closest(".fm-fa")){ if(finding()) return; F = null; startFind(); }
  });
  /* «Parar»: el aviso se repinta al salir de un modo, así que el toque no debe llegar al escenario (mariposa, paseo…) */
  hint.addEventListener("click", e => { if(e.target.closest(".fm-hx")){ e.stopPropagation(); setWater(false); setFood(null); } });
  let wT = 0;
  bWater.onclick = () => { if(now() - wT < 500) return; wT = now(); if(finding()) exitFind(); setWater(!waterMode); };   /* doble toque = un toque */
  bFood.onclick = () => { if(finding()) exitFind(); if(trayOpen()) closeTray(); else openTray(); };
  bShop.onclick = () => openShop({from: bShop});

  /* girar el móvil o cambiar el tamaño de la ventana: se recoloca (o se vuelve a montar si cambia de móvil a escritorio) */
  function onResize(){
    if(!isOn()) return stop();
    cancel(rzT);
    rzT = later(() => {
      if(matchMedia("(max-width:560px)").matches !== narrow && !finding() && !dlgOpen() && !lift && !popOpen()) return mount(host);
      layout();
      for(const id of Object.keys(els)){ els[id]._hw = halfW(id); const p = posOf(id); if(p && !els[id].classList.contains("walk")) put(els[id], p.x, p.y, 0); }
      skyPos(); placePop();
    }, 250);
  }

  /* otra pestaña cambió la granja (compró comida, dio de comer…): se recarga el estado sin guardarlo
     (así esta pestaña no pisa lo de la otra) y se pone al día lo que se ve */
  function onStorage(e){
    if(e.key !== KEY || !isOn() || e.newValue === null) return;
    const n = load(); for(const k of Object.keys(s)) delete s[k]; Object.assign(s, n);
    careSync(s);
    const gone = Object.keys(els).filter(id => ANIM[id] && inShelterS(s, id));
    for(const it of owned()) if(!els[it.id] && !inShelterS(s, it.id)) comeBack(it.id);
    layer.querySelectorAll(".fm-prod").forEach(b => { if(!s.prod[b.dataset.pk] && !b._got) b.remove(); });
    for(const k of Object.keys(s.prod)) if(!layer.querySelector(`[data-pk="${k}"]`)) makeProd(k, false);
    pickLead();
    for(const id of Object.keys(els)) render(id);
    if(gone.length) leave(gone);
    bar(); trayPaint(); shelSign(); shopFoods();
  }

  /* ---------- arranque ---------- */
  for(const it of items) makeItem(it);
  for(const k of Object.keys(s.prod)) makeProd(k, false);
  layer.appendChild(hero);
  pickLead();
  skyPos(); checkTrees(); bar(); shelSign(); paintHint();
  for(const id of Object.keys(els)) if(ANIM[id]) wt[id] = later(() => wander(id), rnd(400, 2600));
  every(tick, 15000);
  window.addEventListener("resize", onResize); window.addEventListener("storage", onStorage);
  document.addEventListener("keydown", onKey); document.addEventListener("pointerdown", onDocDown, true);
  /* la primera vez (o comida de regalo): la mano · alguien se fue al refugio · «¡Te echaban de menos!» · lo nuevo ·
     agua extra · el más urgente dice que tiene hambre (si no suena nada) · nada que hacer: el zorro propone jugar */
  if(s.wpend || s.cnew) intro.push(() => coach());
  intro.push(() => departed() ? undefined : 0);
  if(!first && away >= HMS(MISS_H)) intro.push(() => missYou());
  if(fresh.length && !s.wpend){
    const id = fresh[fresh.length - 1], it = itemById(id), k = kindOf(id);
    intro.push(() => { if(!els[id]) return 0; bubble(wordBub(pj(it), iw(it), it.n, k === "animal" ? "¡Nuevo! Tiene hambre 🍽️" : k === "plant" ? "¡Nuevo! Riégalo 💧" : "¡Nuevo! Tócalo ✨"), els[id], 4500); return 4600; });
  } else if(news > 0) intro.push(() => { bubble(msg(`📚 ¡Ganaste ${news} 💧 de agua extra!<br>Pulsa «Regar» o arrastra la regadera.`), hero, 5000); return 5100; });
  later(() => { if(leadId) talk(leadId, true); }, 900);
  intro.push(() => {
    const care = Object.keys(els).some(id => (ANIM[id] && needy(id)) || (kindOf(id) === "plant" && ((plant(id).s < 2 && canWater(id)) || (plant(id).s >= 2 && !TREE[id]))));
    if(!care && !coachEl && findable().length >= 3){ bubble(msg("¿Jugamos?") + playBtn, hero, 6000); return 6100; }
    /* una planta con sed: la pista de arrastrar la regadera (G.hint: 3 veces como mucho) */
    const thirsty = Object.keys(els).some(id => kindOf(id) === "plant" && plant(id).s < 2 && canWater(id));
    const g = GS(); if(thirsty && !coachEl && !trayOpen() && !popOpen() && !dlgOpen() && g && typeof g.hint === "function") regHint = g.hint(bWater, {id: "fm-regadera", text: "Arrastra el agua a una planta", gesture: "drag", delay: 600});
    return 0;
  });
  later(nextIntro, 450);
  emit("farm-mounted", {stage, season: seasonEl, world, hz: HZ});
  return api;
}
farmMount._mount = mount;

/* para otros módulos (misiones del compañero, pruebas): especies y consultas de solo lectura */
farmMount.kinds = Object.freeze({
  animal: Object.freeze(Object.keys(ANIM)),
  plant: Object.freeze(Object.keys(PLANT).filter(id => !TREE[id])),
  tree: Object.freeze(Object.keys(TREE)),
  building: Object.freeze(Object.keys(BUILD)),
});
const animInfo = (s, id) => { const it = itemById(id) || {}, h = heartsS(s, id);
  return {id, e: it.e || "", n: it.n || id, hearts: h, sick: h === 0, hungry: canEatS(s, id), food: ANIM[id].eats, fedAgoH: Math.round(sinceFed(s, id) / HOUR * 10) / 10}; };
farmMount.care = Object.freeze({
  /* 3, 2, 1, 0 (malito) en la granja · -1 en el refugio · null si no lo tiene */
  hearts: id => ANIM[id] && game().owned[id] ? heartsS(careState(), id) : null,
  /* en la granja con 2 corazones o menos (o malitos): los que salen en la portada y en la insignia */
  hungryList: () => { const s = careState(); return needyS(s).map(id => animInfo(s, id)); },
  shelterList: () => { const s = careState(); return Object.keys(s.shelter).map(id => { const it = itemById(id) || {}; return {id, e: it.e || "", n: it.n || id, since: s.shelter[id].t, seen: !!s.shelter[id].seen, price: rescuePrice(it)}; }); },
  animals: () => onFarmS(careState()),
  inShelter: id => inShelterS(careState(), id),
  canEat: id => ANIM[id] && game().owned[id] ? canEatS(careState(), id) : false,
  pantry: () => Object.assign({}, careState().pan),
  foods: () => JSON.parse(JSON.stringify(FOOD)),
  foodOf: id => ANIM[id] ? ANIM[id].eats : null,
  rescuePrice: id => rescuePrice(itemById(id)),
  limits: Object.freeze({FULL_H, HEART_H: Object.freeze(HEART_H.slice()), SHELTER_H, ARRIVE_H, RESCUE_H, MISS_H, PAN_MAX, PROD_MAX}),
  openShelter: () => { if(cur && cur.alive()) cur.openShelter(); },
  /* «La granja te habla» y el repaso: la frase de cada idioma y la clave del repaso de cada cosa (o null) */
  phrase: l => PHRASE[l || lang] || PHRASE.english,
  srsKey: id => (CORPUS[lang] || {})[id] || null,
});
farmMount.debug.tick = () => { if(cur && cur.alive()) cur.tick(); navBadge(); };

/* ---------- estilos ---------- */
/* fuera de la granja: etiqueta «En el refugio» de la tienda */
function cssCare(){
  if(document.getElementById("css-farm-care")) return;
  const st = document.createElement("style"); st.id = "css-farm-care";
  st.textContent = `
.sc .own.shl{color:var(--gold-ink)}
.sc [data-shelter]{min-height:44px;padding:8px 14px}`;
  document.head.appendChild(st);
}
cssCare();
function css(){
  if(document.getElementById("css-farm")) return;
  const cur = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><text x='2' y='26' font-size='24'>💧</text></svg>")}") 10 26, pointer`;
  const st = document.createElement("style"); st.id = "css-farm";
  st.textContent = `
/* la granja ocupa la pantalla: la página no se desplaza y el accesorio «Seguir» deja su sitio al dock */
:root[data-sec=granja]{overflow:hidden;overscroll-behavior:none}
:root[data-sec=granja] body{overscroll-behavior:none}
:root[data-sec=granja] #acc{display:none!important}
/* en la granja, nada con desenfoque (vidrio lite): tampoco el fondo de la barra de arriba */
:root[data-sec=granja] .topbar::before{-webkit-backdrop-filter:none;backdrop-filter:none;background:var(--g-lite,rgba(255,255,255,.96))}
:root[data-sec=granja][data-theme=dark] .topbar::before{background:var(--g-lite-d,rgba(28,28,30,.96))}
.fm{position:relative}
.fm-stage{--hz:50%;--u:56px;--fm-wh:calc(100vh - 150px);position:fixed;inset:0;z-index:0;overflow:hidden;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;isolation:isolate;cursor:pointer;touch-action:none;
  --sky1:#2f86d9;--sky2:#7cc3f2;--sky3:#d2efff;--h1:#5aa84a;--h2:#7db86e;--g1:#66bd4c;--g2:#3c9431;--g3:#2f7d27;--path:#d9b67c;--path2:#c39a5c;--fence:#8a5a2b;--cloud:#fff;--cloudo:.95;background:var(--g2)}
.fm-stage[data-ph=dawn]{--sky1:#1d4a80;--sky2:#6b9cc8;--sky3:#FFE08A;--h1:#4b8e44;--h2:#6a9c68;--g1:#5aab48;--g2:#37862f;--g3:#2b6f25;--cloud:#fff1d6}
.fm-stage[data-ph=dusk]{--sky1:#0f2a52;--sky2:#3a6390;--sky3:#FFD866;--h1:#3c6f3c;--h2:#4f7660;--g1:#4d9640;--g2:#2f7429;--g3:#255f21;--path:#b8925c;--path2:#9c7a48;--fence:#6e4823;--cloud:#f0cf9c}
.fm-stage[data-ph=night]{--sky1:#040c1c;--sky2:#0a2040;--sky3:#173a5f;--h1:#16402a;--h2:#1b3a37;--g1:#1f4f2a;--g2:#163c1f;--g3:#102f17;--path:#5e5038;--path2:#4b3f2b;--fence:#3f2c1b;--cloud:#5d7192;--cloudo:.6}
/* el mundo: de arriba del todo hasta encima del dock (las cosas se colocan en % de él) */
.fm-world{position:absolute;left:0;right:0;top:0;height:var(--fm-wh)}
.fm-below{position:absolute;left:0;right:0;top:var(--fm-wh);bottom:0;z-index:3;pointer-events:none;
  background:radial-gradient(circle at 30% 40%,rgba(255,255,255,.07) 0 2px,transparent 3px) 0 0/23px 19px,linear-gradient(var(--g2),var(--g3))}
.fm-below::before{content:"";position:absolute;top:0;bottom:0;left:38%;width:25%;background:var(--path);box-shadow:inset 2px 0 0 var(--path2),inset -2px 0 0 var(--path2)}
/* capa de las temporadas (js/season.js): toda la pantalla, encima del suelo y debajo de los animales */
.fm-season{position:absolute;inset:0;z-index:4;pointer-events:none}
.fm-sky{position:absolute;inset:0;background:linear-gradient(var(--sky1) 0%,var(--sky2) calc(var(--hz) * .56),var(--sky3) var(--hz))}
.fm-stars{position:absolute;inset:0 0 calc(100% - var(--hz)) 0;opacity:0;transition:opacity 2s;pointer-events:none}
.fm-stage[data-ph=night] .fm-stars{opacity:1}.fm-stage[data-ph=dusk] .fm-stars,.fm-stage[data-ph=dawn] .fm-stars{opacity:.35}
.fm-stars i{position:absolute;border-radius:50%;background:#fff;box-shadow:0 0 6px 1px rgba(255,255,255,.8);animation:fmTw 2.6s ease-in-out infinite}
.fm-sun,.fm-moon{position:absolute;display:none;border:0;padding:0;border-radius:50%;transform:translate(-50%,-50%);z-index:1;cursor:pointer;-webkit-tap-highlight-color:transparent}
.fm-stage:not([data-ph=night]) .fm-sun,.fm-stage[data-ph=night] .fm-moon{display:block}
.fm-sun{width:56px;height:56px;background:radial-gradient(circle at 40% 38%,#fffbe0 0,#ffe066 45%,#f5b800 100%);box-shadow:0 0 0 9px rgba(255,214,80,.22),0 0 46px 16px rgba(255,204,0,.45)}
.fm-sun::before{content:"";position:absolute;inset:-20px;border-radius:50%;background:repeating-conic-gradient(rgba(255,215,90,.55) 0 7deg,transparent 7deg 22deg);-webkit-mask:radial-gradient(circle,transparent 48%,#000 50%,transparent 71%);mask:radial-gradient(circle,transparent 48%,#000 50%,transparent 71%);animation:fmSpin 40s linear 3;z-index:-1}
.fm-stage[data-ph=dawn] .fm-sun,.fm-stage[data-ph=dusk] .fm-sun{background:radial-gradient(circle at 40% 38%,#fff2c8 0,#FFD84D 45%,#F5B800 100%);box-shadow:0 0 0 9px rgba(255,204,0,.22),0 0 50px 20px rgba(255,196,0,.45)}
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
/* lo que no se ve no se mueve (batería): de día no hay estrellas ni luciérnagas, y al amanecer tampoco luciérnagas */
.fm-stage[data-ph=day] .fm-stars i,.fm-stage[data-ph=day] .fm-flies i,.fm-stage[data-ph=dawn] .fm-flies i{animation-play-state:paused}
.fm-layer{position:absolute;inset:0;z-index:5;pointer-events:none}
.fm-layer>*{pointer-events:auto}.fm-layer>.fm-fx{pointer-events:none}
/* las cosas: su tamaño sale de --u (lo calcula la granja según la pantalla) */
.fm-it{position:absolute;display:flex;align-items:flex-end;justify-content:center;border:0;background:none;padding:0;margin:0;color:inherit;font-size:var(--u);line-height:1;min-width:52px;min-height:52px;cursor:pointer;touch-action:none;-webkit-tap-highlight-color:transparent;
  transform:translate(-50%,-100%) scale(var(--d,1));transform-origin:50% 100%;transition:left var(--t,0ms) linear,top var(--t,0ms) linear,transform var(--t,0ms) linear}
.fm-it.bg{font-size:calc(var(--u) * 1.38)}.fm-it.xl{font-size:calc(var(--u) * 1.65)}
.fm-it.sd0{font-size:calc(var(--u) * .62)}.fm-it.sd1{font-size:calc(var(--u) * .76)}.fm-it.bg.sd0{font-size:calc(var(--u) * .66)}.fm-it.bg.sd1{font-size:calc(var(--u) * .9)}
.fm-it:focus-visible,.fm-prod:focus-visible{outline:3px solid #fff;outline-offset:3px;border-radius:12px}
.fm-stage.watering .fm-it.k-plant{cursor:${cur}}
.fm-stage.watering .fm-it:not(.k-plant),.fm-stage.watering .fm-prod{filter:saturate(.55) brightness(.92)}
.fm-body{position:relative;display:block;transform:scaleX(var(--fx,1));transition:transform .2s}
.fm-e{position:relative;display:block;line-height:1.05;transform-origin:50% 90%;filter:drop-shadow(0 2px 1px rgba(0,0,0,.18))}
.fm-e .pj{display:block;width:1.4em;height:1.15em}
.fm-pe2 .pj{display:block;margin:0 auto}
.fm-dep .pj{width:1.2em;height:1.05em}
.fm-qe .pj{display:block;width:1.35em;height:1.15em}
.fm-sh{position:absolute;left:50%;bottom:-.04em;width:.9em;height:.2em;border-radius:50%;background:rgba(0,0,0,.2);transform:translateX(-50%);pointer-events:none}
.fm-it.fly .fm-e{translate:0 -.45em;animation:fmHover 1.3s ease-in-out infinite}
.fm-it.fly .fm-sh{width:.5em;opacity:.6}
.fm-it.walk .fm-e{animation:fmWalk .42s ease-in-out infinite alternate}
.fm-it.hopper.walk .fm-e{animation:fmBunny .5s ease-out infinite}
.fm-it.ripe .fm-e{animation:fmRipe 1.6s ease-in-out 3;filter:drop-shadow(0 0 6px rgba(255,224,110,.95)) drop-shadow(0 2px 1px rgba(0,0,0,.18))}
.fm-it.lit::before{content:"";position:absolute;left:50%;top:40%;width:190%;height:160%;transform:translate(-50%,-50%);background:radial-gradient(closest-side,rgba(255,214,0,.65),rgba(255,214,0,0));pointer-events:none}
.fm-it.lit .fm-e{filter:drop-shadow(0 0 10px rgba(255,214,90,.95))!important}
.fm-stage[data-ph] .fm-it.ripe .fm-e{filter:drop-shadow(0 0 7px rgba(255,224,110,.95)) drop-shadow(0 2px 1px rgba(0,0,0,.18))}
.fm-stage[data-ph=night] .fm-it .fm-e,.fm-stage[data-ph=night] .fm-hb{filter:brightness(.8) saturate(.85) drop-shadow(0 2px 1px rgba(0,0,0,.25))}
.fm-stage[data-ph=dusk] .fm-it .fm-e,.fm-stage[data-ph=dusk] .fm-hb{filter:brightness(.93) drop-shadow(0 2px 1px rgba(0,0,0,.2))}
.fm-it.peck .fm-e{animation:fmPeck .7s ease}
.fm-it.wig .fm-e,.fm-it.talk .fm-e{animation:fmWig .7s ease}
.fm-it.eat .fm-e{animation:fmEat .32s ease-in-out 4}
.fm-it.hop .fm-e{animation:fmHop .55s ease}
.fm-it.no .fm-e{animation:fmNo .5s ease}
.fm-it.new .fm-e{animation:fmPop .75s cubic-bezier(.3,1.6,.5,1)}
.fm-it.grow .fm-e{animation:fmGrow .7s cubic-bezier(.3,1.6,.5,1)}
.fm-it.pluck .fm-e{animation:fmPluck .45s ease-in forwards}
.fm-it.land .fm-e{animation:fmLand .35s ease}
.fm-it.hl .fm-e{animation:fmHl .8s ease-in-out 3}
.fm-it.hl .fm-sh{background:radial-gradient(closest-side,rgba(242,201,76,.95),rgba(242,201,76,0));width:1.5em;height:.45em;bottom:-.2em}
.fm-it.fly2 .fm-sh{opacity:0}
/* levantada (mantener pulsado): crece un poco, con sombra, y se mueve con el dedo */
.fm-it.lift{transition:none!important;z-index:2000!important;cursor:grabbing}
.fm-it.lift .fm-body{scale:1.06;translate:0 -.08em}
.fm-it.lift .fm-e{animation:none;filter:drop-shadow(0 14px 10px rgba(0,0,0,.3)) drop-shadow(0 2px 1px rgba(0,0,0,.18))!important}
.fm-it.lift .fm-sh{width:1.1em;opacity:.45}
.fm-need{position:absolute;left:58%;bottom:80%;font-size:.42em;line-height:1;background:#fff;border-radius:50%;width:1.9em;height:1.9em;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.25);animation:fmBob 1.6s ease-in-out 3;pointer-events:none}
.fm-need::before,.fm-need::after{content:"";position:absolute;background:inherit;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.fm-need::before{width:.42em;height:.42em;left:-.12em;bottom:-.28em}.fm-need::after{width:.24em;height:.24em;left:-.42em;bottom:-.6em}
.fm-need.w{background:#e3f1ff}
.fm-it.bg .fm-need{font-size:.32em}
.fm-it.er .fm-need{left:auto;right:58%}.fm-it.er .fm-need::before{left:auto;right:-.12em}.fm-it.er .fm-need::after{left:auto;right:-.42em}
.fm-it.er .fm-zz{left:auto;right:60%}
.fm-stage.watering .fm-need.w{animation:fmPulse .9s ease-in-out 3}
.fm-stage.finding .fm-need,.fm-stage.finding .fm-zz,.fm-stage.finding .fm-spk,.fm-stage.finding .fm-ask,.fm-stage.finding .fm-shel{display:none}
/* el globo del hambre: la comida que pide (y, en el más urgente, la frase en el idioma con la traducción en gris) */
.fm-ask{position:absolute;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%) scale(calc(1 / var(--d,1)));transform-origin:50% 100%;display:flex;align-items:center;gap:8px;min-height:40px;padding:4px 14px 4px 8px;border-radius:20px;background:#fff;color:#000;
  font:600 15px/1.15 var(--f-text);white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,.2);pointer-events:auto;cursor:pointer;-webkit-tap-highlight-color:transparent;z-index:2;animation:fmBob 1.6s ease-in-out 3}
.fm-ask::after{content:"";position:absolute;top:calc(100% - 1px);left:var(--tl,50%);margin-left:-8px;border:8px solid transparent;border-top-color:#fff;border-bottom:0}
.fm-ae{flex:none;font-size:24px;line-height:1}
.fm-at{display:flex;flex-direction:column;text-align:left;min-width:0}
.fm-at b{font-weight:600;font-size:15px;line-height:1.2}
.fm-at small{color:#6C6C70;font-weight:400;font-size:12px;line-height:1.2}
.fm-ask.sm{padding:4px;min-height:36px;min-width:36px;justify-content:center}
.fm-ask.sm .fm-ae{font-size:22px}
.fm-it.al .fm-ask{left:-6px;transform:scale(calc(1 / var(--d,1)));transform-origin:0 100%;--tl:30px}
.fm-it.ar .fm-ask{left:auto;right:-6px;transform:scale(calc(1 / var(--d,1)));transform-origin:100% 100%;--tl:calc(100% - 30px)}
.fm-it.ar .fm-ask.sm,.fm-it.al .fm-ask.sm{--tl:50%}
.fm-it.lead{z-index:1500!important}
.fm-it.sick .fm-ask{bottom:calc(86% + 6px)}
.fm-stage.feeding .fm-ask{animation:fmPulse .9s ease-in-out 3}
.fm-it.sad .fm-e{filter:saturate(.55) drop-shadow(0 2px 1px rgba(0,0,0,.18))}
/* malito: descansa un poco agachado (sin volcarse: la cabeza siempre arriba) */
.fm-it.sick .fm-e{rotate:-10deg;scale:1.06 .84;filter:grayscale(.45) drop-shadow(0 2px 1px rgba(0,0,0,.18))}
.fm-it.k-animal .fm-zz{bottom:calc(100% + 4px)}
.fm-it.drop .fm-e{scale:1.15;filter:drop-shadow(0 0 8px rgba(242,201,76,1)) drop-shadow(0 2px 1px rgba(0,0,0,.18))}
.fm-it.bye{opacity:0;transition:opacity .6s ease,transform .6s ease!important;transform:translate(-50%,-100%) scale(.3)!important;pointer-events:none}
.fm-stage.feeding .fm-it:not(.k-animal),.fm-stage.feeding .fm-prod{filter:saturate(.55) brightness(.92)}
/* cartel del refugio */
/* el Refugio: cápsula de vidrio lite como el dock (sin marino: es algo que se toca) */
.fm-shel{--g-lite:rgba(255,255,255,.96);--g-lite-d:rgba(28,28,30,.96);position:absolute;left:max(12px,var(--safe-l));top:calc(var(--hz) - 56px);z-index:6;display:flex;align-items:center;gap:8px;min-height:44px;padding:0 16px 0 12px;border:0;border-radius:999px;color:var(--label);font:600 var(--fs-note)/1 var(--f-text);cursor:pointer;-webkit-tap-highlight-color:transparent}
.fm-shel[hidden]{display:none}
.fm-shel .ico{flex:none;width:22px;height:22px;color:var(--brand-tint)}
.fm-shb{position:absolute;top:-8px;right:-8px;min-width:24px;height:24px;padding:0 8px;border-radius:99px;background:var(--brand-fill);color:#fff;font:700 13px/24px var(--f-text);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--card)}
.fm-shb[hidden]{display:none}
.fm-shel.has{animation:fmNudge 2.6s ease-in-out 3}
.fm-shel:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.fm-zz{position:absolute;left:60%;bottom:76%;font-size:.38em;pointer-events:none;animation:fmZz 2.4s ease-in-out infinite}
.fm-spk{position:absolute;inset:-.15em;pointer-events:none}
.fm-spk i{position:absolute;font-style:normal;font-size:.36em;animation:fmTw 1.4s ease-in-out 3}
.fm-spk i:nth-child(1){left:-.15em;top:0}.fm-spk i:nth-child(2){right:-.2em;top:.55em;animation-delay:.7s}
.fm-layer>.fm-hero{position:absolute;pointer-events:none;transform:translate(-50%,-100%) scale(var(--d,1));transform-origin:50% 100%;transition:left var(--t,0ms) linear,top var(--t,0ms) linear,transform var(--t,0ms) linear;outline:none}
.fm-hero:focus-visible .fm-hb{outline:3px solid #fff;border-radius:12px}
.fm-hero .fm-sh{bottom:2px;width:.8em;height:.18em}
.fm-hf{transform:scaleX(var(--fx,1));transition:transform .2s}
.fm-hb{display:block;filter:drop-shadow(0 3px 2px rgba(0,0,0,.25))}
.fm-hero.walk .fm-hb{animation:fmWalk .3s ease-in-out infinite alternate}
.fm-hero.hop .fm-hb{animation:fmHop .55s ease}
.fm-prod{position:absolute;width:52px;height:52px;border:0;padding:0;border-radius:50%;font-size:1.85rem;line-height:1;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-100%);cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;
  background:radial-gradient(closest-side,rgba(255,255,255,.9) 0 55%,rgba(255,255,255,0));animation:fmGlow 1.8s ease-in-out 3}
.fm-prod.new{animation:fmDrop .7s cubic-bezier(.3,1.5,.5,1),fmGlow 1.8s ease-in-out .7s 3}
.fm-prod.got{animation:fmGot .45s ease-in forwards;pointer-events:none}
.fm-stage[data-ph=night] .fm-prod{background:radial-gradient(closest-side,rgba(255,240,180,.8) 0 55%,rgba(255,240,180,0))}
.fm-fx{position:absolute;transform:translate(-50%,-50%);pointer-events:none;z-index:2500;font-size:1.5rem;line-height:1}
.fm-heart{animation:fmUp 1.3s ease-out forwards}
.fm-ring{width:40px;height:16px;border-radius:50%;border:3px solid rgba(255,255,255,.9);z-index:4;animation:fmRing .6s ease-out forwards}
.fm-drip{font-size:1.1rem;animation:fmDrip .7s ease-in forwards}
.fm-sp{font-size:.9rem}
.fm-puff{width:16px;height:16px;border-radius:50%;background:rgba(235,240,245,.9);animation:fmPuff 1.4s ease-out forwards}
.fm-fire{transform:translate(-50%,-100%);font-size:1.8rem;transform-origin:50% 100%;animation:fmFire .35s ease-in-out infinite alternate;filter:drop-shadow(0 0 10px rgba(255,204,0,.9))}
.fm-fw{width:6px;height:6px;border-radius:50%;background:#fff;color:var(--c,#FFCC00);box-shadow:0 -28px 0 2px currentColor,20px -20px 0 2px #5aa2ff,28px 0 0 2px currentColor,20px 20px 0 2px #45cf8b,0 28px 0 2px currentColor,-20px 20px 0 2px #5aa2ff,-28px 0 0 2px currentColor,-20px -20px 0 2px #45cf8b;animation:fmFw 1.1s ease-out forwards}
.fm-leaf{font-size:1.1rem;animation:fmLeaf 1.6s ease-in forwards}
.fm-burst{font-size:1.2rem;animation:fmBurst .9s ease-out forwards}
.fm-bfly{font-size:1.6rem;animation:fmBfly 2.6s ease-in-out forwards,fmFlap .18s ease-in-out infinite alternate}
.fm-shoot{width:90px;height:3px;border-radius:3px;background:linear-gradient(90deg,#fff,rgba(255,255,255,0));transform:translate(-50%,-50%) rotate(-24deg);animation:fmShoot 1s ease-out forwards}
.fm-flame{position:absolute;left:50%;top:80%;font-size:.5em;transform:translateX(-50%) rotate(180deg);pointer-events:none;animation:fmFire .2s ease-in-out infinite alternate}
.fm-flyc{position:fixed;z-index:1000;font-size:2rem;line-height:1;pointer-events:none}
/* bocadillo de la escena (blanco en claro y en oscuro: es parte del dibujo) */
.fm-bub{position:absolute;z-index:3000;transform:translate(-50%,-100%);transform-origin:50% 100%;background:#fff;color:#000;border-radius:18px;padding:6px 6px 6px 12px;box-shadow:0 8px 22px rgba(0,0,0,.24);display:flex;align-items:center;gap:8px;white-space:nowrap;width:max-content;max-width:min(calc(100% - 16px),400px);box-sizing:border-box;pointer-events:none;cursor:default;font-family:var(--f-text)}
.fm-bub[hidden]{display:none}
.fm-bub.below{transform:translate(-50%,0);transform-origin:50% 0}
.fm-bub.in{animation:fmBubIn .22s ease-out}
.fm-bub::after{content:"";position:absolute;top:100%;left:var(--tail,50%);transform:translateX(-50%);border:9px solid transparent;border-top-color:#fff}
.fm-bub.below::after{top:auto;bottom:100%;border-top-color:transparent;border-bottom-color:#fff}
.fm-be{font-size:1.9rem;line-height:1;display:flex;align-items:center;gap:2px}.fm-be small{font-size:.9rem;color:#6C6C70}
.fm-be .pj{width:1.35em;height:1.15em}
.fm-bt{display:flex;flex-direction:column;line-height:1.15;min-width:0}
.fm-bt b{font-size:1.25rem;font-weight:600}.fm-bt small{color:#6C6C70;font-size:.9rem;font-weight:400}
.fm-bt i{font-style:normal;font-size:.9rem;color:#185CCF;font-weight:600;white-space:normal;line-height:1.25}
.fm-hl{letter-spacing:-1px}
.fm-pe{display:inline-block;line-height:1}.fm-pe-lana{filter:grayscale(1) brightness(1.32)}
.fm-sg{display:flex;gap:4px;flex:none}
.fm-bub .say,.fm-find .say{pointer-events:auto;display:grid;place-items:center;width:44px;height:44px;flex:none;padding:0;background:rgba(120,120,128,.12);border:0;border-radius:50%;color:#1E6EF4}
.fm-bm{white-space:normal;font-weight:600;font-size:1rem;line-height:1.3;padding:4px 6px 4px 0;max-width:260px}
.fm-bplay{pointer-events:auto;flex:none;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border:0;border-radius:22px;background:#1E6EF4;color:#fff;font:600 var(--fs-note)/1.1 var(--f-text);cursor:pointer}
/* arriba, bajo la barra: «¿Dónde está…?» y el aviso del modo (regar o dar de comer) */
.fm-find{position:absolute;left:50%;top:calc(var(--topbar-h) + 8px);transform:translateX(-50%);z-index:3100;background:var(--card);color:var(--label);border-radius:22px;padding:6px 8px;box-shadow:0 8px 24px rgba(0,0,0,.24);display:flex;align-items:center;gap:8px;max-width:calc(100% - 24px);width:max-content;cursor:default}
.fm-find[hidden]{display:none}
.fm-fh{flex:none;line-height:0;padding:0 2px 4px}
.fm-ft{display:flex;flex-direction:column;line-height:1.1;min-width:0;gap:2px}
.fm-ft small{color:var(--label2);font-weight:600;font-size:.82rem}
.fm-ft b{font-size:1.35rem;color:var(--label);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fm-ft em{font-style:normal;font-weight:700;color:var(--gold-ink)}.fm-ft em.m{color:var(--label2);font-size:.8rem;font-weight:600}
.fm-find .say{background:var(--brand-soft);color:var(--brand-tint)}
.fm-dots{display:flex;gap:4px;margin-top:2px}
.fm-dots i{width:10px;height:10px;border-radius:50%;background:var(--fill)}
.fm-dots i.ok{background:var(--ok)}.fm-dots i.no{background:var(--miss)}.fm-dots i.now{background:var(--card);box-shadow:0 0 0 2px var(--brand-tint)}
.fm-fq{flex:none;display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:22px;background:var(--fill);color:var(--label);padding:0}
.fm-fa{flex:none}
.fm-hint{position:absolute;left:50%;top:calc(var(--topbar-h) + 8px);transform:translateX(-50%);z-index:3050;background:var(--card);color:var(--label);border-radius:999px;padding:5px 6px 5px 16px;font-weight:600;display:flex;align-items:center;gap:10px;white-space:nowrap;width:max-content;max-width:calc(100% - 24px);box-sizing:border-box;line-height:1.2;cursor:default;box-shadow:0 6px 16px rgba(0,0,0,.22)}
.fm-hint[hidden]{display:none}
.fm-hint span{white-space:normal}
.fm-hx{flex:none;min-height:44px;border:0;border-radius:999px;background:var(--fill);color:var(--label);font-weight:600;padding:0 16px}
/* el dock: vidrio ligero (sin desenfoque) encima de la barra de pestañas, en el sitio del accesorio */
.fm-dock{--g-lite:rgba(255,255,255,.96);--g-lite-d:rgba(28,28,30,.96);position:absolute;z-index:3300;left:max(16px,var(--safe-l));right:max(16px,var(--safe-r));bottom:calc(var(--tabbar-b) + var(--tabbar-h) + 8px);
  max-width:520px;margin:0 auto;height:60px;border-radius:30px;display:flex;align-items:center;padding:4px;cursor:default;touch-action:manipulation;user-select:none;-webkit-user-select:none}
@media (min-width:820px){:root:not([data-bar=bottom]) .fm-dock{bottom:calc(16px + var(--safe-b))}}
.fm-db{position:relative;flex:1 1 0;min-width:0;height:52px;border:0;border-radius:26px;background:none;color:var(--label);display:flex;align-items:center;justify-content:center;gap:8px;padding:0 8px;
  font:600 var(--fs-sub)/1.1 var(--f-text);white-space:nowrap;-webkit-tap-highlight-color:transparent;touch-action:none}
.fm-db .ico{flex:none;width:24px;height:24px;color:var(--brand-tint)}
.fm-db .lb{min-width:0;overflow:hidden;text-overflow:ellipsis}
.fm-db[aria-pressed=true],.fm-db[aria-expanded=true]{background:var(--card);color:var(--brand-ink);box-shadow:0 1px 4px rgba(0,0,0,.14)}
.fm-db:focus-visible{outline:3px solid var(--brand-tint);outline-offset:-3px}
.fm-db.nudge{animation:fmNudge .6s ease 2}
.fm-dsep{flex:none;width:1px;height:28px;background:var(--sep)}
/* las gotas extra: una gotita y el número, encima del borde del botón (no tapa «Regar») */
.fm-badge{position:absolute;top:-8px;right:8px;display:inline-flex;align-items:center;gap:2px;min-width:24px;height:20px;padding:0 6px;border-radius:10px;background:var(--brand-fill);color:#fff;font:700 12px/20px var(--f-text);box-shadow:0 0 0 2px var(--card)}
.fm-db .fm-badge .ico{width:12px;height:12px;color:#fff}
.fm-badge[hidden]{display:none}
.fm-dghost{display:grid;place-items:center;font-size:44px;line-height:1;background:none!important;box-shadow:none!important;filter:drop-shadow(0 6px 6px rgba(0,0,0,.3))}
/* la bandeja de la comida: sólida, encima del dock, con su colita hacia «Comida» */
.fm-tray{position:absolute;z-index:3250;left:50%;bottom:calc(var(--tabbar-b) + var(--tabbar-h) + 8px + 72px);transform:translateX(-50%);width:max-content;max-width:calc(100% - 32px);box-sizing:border-box;
  background:var(--card);color:var(--label);border-radius:24px;padding:10px 10px 8px;box-shadow:0 10px 30px rgba(0,0,0,.2);cursor:default;touch-action:manipulation}
@media (min-width:820px){:root:not([data-bar=bottom]) .fm-tray{bottom:calc(16px + var(--safe-b) + 72px)}}
.fm-tray[hidden]{display:none}
.fm-tray.in{animation:fmBubIn .2s ease-out}
.fm-tray::after{content:"";position:absolute;top:calc(100% - 1px);left:50%;margin-left:-9px;border:9px solid transparent;border-top-color:var(--card);border-bottom:0}
.fm-tr{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;padding:2px}   /* cabe siempre (sin scroll: las fichas se arrastran) y «Comprar» va al final */
.fm-fc{position:relative;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:76px;min-height:76px;padding:8px 4px 6px;border:0;border-radius:18px;background:var(--fill2);color:var(--label);touch-action:none;cursor:grab;-webkit-tap-highlight-color:transparent}
.fm-fc .fe{font-size:40px;line-height:1}
.fm-fc .fw{max-width:100%;font:600 var(--fs-min)/1.15 var(--f-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fm-fc .fn{position:absolute;top:4px;right:4px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:var(--brand-fill);color:#fff;font:700 13px/22px var(--f-text);text-align:center}
.fm-fc.zero{cursor:pointer;touch-action:manipulation}
.fm-fc.zero .fe{opacity:.45}
.fm-fc.zero .fn{background:var(--miss-fill);color:var(--label)}
.fm-fc.on{background:var(--brand-soft);box-shadow:inset 0 0 0 2px var(--brand-tint)}
.fm-fc.g-dragging{opacity:.45}
.fm-fc.coached{box-shadow:inset 0 0 0 2px var(--brand-tint)}
.fm-fc.fm-fbuy{cursor:pointer;touch-action:manipulation;color:var(--brand-ink)}
.fm-fc.fm-fbuy .ico{color:var(--brand-tint)}
.fm-fc:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.fm-tn{margin:6px 4px 0;color:var(--label2);font:400 var(--fs-min)/1.3 var(--f-text);text-align:center}
/* el globo junto al animal: comer y «¿Cómo me llamo?» (sólido, no es modal) */
.fm-pop{position:absolute;z-index:3200;left:0;top:0;width:min(360px,calc(100vw - 24px));box-sizing:border-box;background:var(--card);color:var(--label);border-radius:24px;box-shadow:0 12px 36px rgba(0,0,0,.26);cursor:default;outline:none;touch-action:manipulation;user-select:text;-webkit-user-select:text}
.fm-pop[hidden]{display:none}
.fm-pop.in{animation:fmBubIn .2s ease-out}
.fm-pop[data-side=top]::after,.fm-pop[data-side=bottom]::after{content:"";position:absolute;left:var(--tail,50%);margin-left:-10px;border:10px solid transparent}
.fm-pop[data-side=top]::after{top:calc(100% - 1px);border-top-color:var(--card);border-bottom:0}
.fm-pop[data-side=bottom]::after{bottom:calc(100% - 1px);border-bottom-color:var(--card);border-top:0}
.fm-pin{overflow:auto;overscroll-behavior:contain;padding:14px 14px 12px;text-align:center;touch-action:pan-y}
.fm-ph{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin:0 0 10px}
.fm-qt{margin:0;font:600 var(--fs-head)/1.25 var(--f-text)}
.fm-qe{display:inline-block;font-size:52px;line-height:1}
.fm-hpill{display:inline-flex;gap:2px;font-size:.95rem;line-height:1;padding:5px 10px;border-radius:99px;background:var(--fill2);letter-spacing:-1px}
.fm-qs{margin:-4px 0 10px;color:var(--label2);font:400 var(--fs-note)/1.3 var(--f-text)}
.fm-foods{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:0 0 6px}
.fm-food{position:relative;display:flex;align-items:center;gap:10px;min-height:60px;border:0;background:var(--fill2);color:var(--label);border-radius:16px;padding:8px 12px;text-align:left;font:inherit;transition:transform .08s}
.fm-food .fe{font-size:2rem;line-height:1;flex:none}
.fm-food .ft{display:flex;flex-direction:column;min-width:0}
.fm-food b{font-size:1.05rem;font-weight:600;overflow-wrap:anywhere}
.fm-food small{color:var(--label2);font-size:.85rem}
.fm-food.bad{background:var(--miss-fill);color:var(--miss-on);border-color:var(--miss)}
.fm-food.bad .fe{opacity:.55}
.fm-food.bad small{color:var(--miss-on)}
.fm-mk{display:grid;place-items:center;flex:none;width:24px;height:24px;margin-left:auto;border-radius:50%}
.fm-food.bad .fm-mk,.fm-opt.bad .fm-mk{background:var(--miss);color:#fff}
.fm-opt.ok .fm-mk{background:var(--ok-fill);color:#fff}
.fm-nofood{background:var(--fill2);border-radius:16px;padding:10px 12px;margin:6px 0 0}
.fm-nofood p{margin:0 0 10px;line-height:1.35}
.fm-buyq{width:100%}
.fm-mic{width:100%;min-height:52px;margin:0 0 10px;gap:8px}
.fm-mic.on{background:var(--ok-fill)}
.fm-mic[hidden]{display:none}
.fm-opts{display:grid;gap:8px}
.fm-or{display:flex;gap:8px;align-items:stretch}
.fm-opt{position:relative;flex:1;display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;border:0;background:var(--fill2);color:var(--label);border-radius:16px;font:600 1.15rem/1.2 var(--f-text);padding:6px 12px;overflow-wrap:anywhere}
.fm-opt .fm-mk{position:absolute;right:10px;top:50%;margin-top:-12px}
.fm-opt.ok{background:var(--ok-soft);color:var(--label);box-shadow:inset 0 0 0 2px var(--ok)}
.fm-opt.bad{background:var(--miss-fill);color:var(--miss-on);cursor:default}
.fm-opt:disabled:not(.ok):not(.bad){opacity:.5}
.fm-or .say{display:grid;place-items:center;width:52px;min-height:52px;padding:0;border:0;border-radius:16px;background:var(--brand-soft);color:var(--brand-tint);flex:none}
.fm-qm{min-height:1.4em;font:600 var(--fs-sub)/1.35 var(--f-text);margin:10px 0 6px}
.fm-qm:empty{margin:4px 0}
.fm-qm.ok{color:var(--ok-ink)}.fm-qm.info{color:var(--label)}
.fm-pa{display:flex;justify-content:center}
.fm-pa .btn-fill{min-width:140px}
/* las hojas: tienda, refugio y «se fue al refugio». Llevan contenido: fondo opaco y sin desenfoque (vidrio lite, como
   las de Juegos), así no se transparenta la escena detrás */
dialog.fm-sheet,dialog.fm-dlg{color:var(--label)}
/* :root y .lite suben la especificidad por encima de la regla oscura de motion.js (DARKQ dialog.m-sheet.glass) */
:root dialog.fm-sheet.m-sheet.glass.lite,:root dialog.fm-dlg.m-sheet.glass.lite{background:var(--card,#fff);-webkit-backdrop-filter:none;backdrop-filter:none}
@media (max-width:819px){
  dialog#fm-shop.m-sheet{height:calc(100dvh - var(--safe-t,0px) - 24px)}
  dialog#fm-shop.m-sheet[data-detent=medium]{height:min(calc(100dvh - var(--safe-t,0px) - 24px),max(440px,64dvh))}
}
.fm-scoin{display:flex;align-items:center;justify-content:center;gap:4px;margin:-4px 0 8px;color:var(--label);font:400 var(--fs-note)/1.2 var(--f-text)}
.fm-scoin .coin-ico{width:18px;height:18px}
.fm-scoin b{color:var(--label);font-weight:700}
.fm-ss{margin:0 0 20px}
.fm-zrow{display:flex;align-items:center;gap:12px;min-height:60px;margin:0 0 20px;padding:8px 16px 8px 12px;border-radius:20px;background:var(--card-2);color:var(--label);text-decoration:none;-webkit-tap-highlight-color:transparent}
.fm-zi{flex:none;display:grid;place-items:center;width:48px;height:48px}
.fm-zt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.fm-zt b{font:600 var(--fs-sub)/1.2 var(--f-text)}
.fm-zt small{font:400 var(--fs-note)/1.2 var(--f-text);color:var(--label2)}
.fm-zg{flex:none;display:inline-flex;align-items:center;gap:2px;color:var(--brand-ink);font:600 var(--fs-note)/1 var(--f-text)}
.fm-zrow:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.fm-sh3{margin:0 4px 8px;font:600 var(--fs-head)/1.25 var(--f-text);color:var(--label)}
.fm-sub{color:var(--label2);margin:0 0 12px;font-size:var(--fs-sub);text-align:center}
.fm-pl{display:grid;gap:10px;margin:0 0 4px;text-align:left}
.fm-prow{display:grid;grid-template-columns:52px 1fr;gap:8px 12px;align-items:center;background:var(--card-2);border-radius:20px;padding:10px 12px;box-shadow:inset 0 0 0 2px transparent;transition:box-shadow .3s}
.fm-prow.focus{box-shadow:inset 0 0 0 2px var(--brand-tint)}
.fm-pe2{font-size:2.6rem;line-height:1;text-align:center}
.fm-pe2.pop{animation:fmPop .5s cubic-bezier(.3,1.6,.5,1)}
.fm-pt{display:flex;flex-direction:column;min-width:0;gap:2px}
.fm-pw{display:flex;align-items:center;gap:4px;min-width:0}
.fm-pw b{font:600 var(--fs-body)/1.2 var(--f-text);overflow-wrap:anywhere}
.fm-pt small{color:var(--label2);font-size:var(--fs-note)}
.fm-have b{color:var(--label);font-weight:700}
.fm-pbs{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.fm-pbs.one{grid-template-columns:1fr}
.fm-pb{width:100%;gap:4px;padding:0 10px}
.fm-pb .coin-ico{display:block;width:18px;height:18px;flex:none}
.fm-pb.no,.fm-pb.no[aria-disabled=true]{background:var(--fill);color:var(--label2);cursor:default}
.fm-pb.no .coin-ico{filter:grayscale(1);opacity:.55}
.fm-rm{grid-column:1/-1;margin:0;min-height:0;text-align:center}
/* hoja ancha (ordenador): los botones a la derecha de la comida, en la misma fila */
@media (min-width:820px){.fm-sheet .fm-prow{grid-template-columns:52px 1fr minmax(0,232px)}.fm-sheet .fm-pbs{grid-column:auto}}
.fm-rm:empty{display:none}
.fm-note{color:var(--label2);text-align:center;line-height:1.4;margin:8px 0}
.fm-note2{margin:2px 0 0;color:var(--label2);font-size:var(--fs-note);text-align:center}
.fm-dep{font-size:2.6rem;line-height:1.2;letter-spacing:4px;margin:2px 0 8px;text-align:center}
.fm-dbtns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:4px 0 8px}
.fm-dbtns .btn-fill{min-height:50px;padding:0 22px}
/* la mano de la primera vez */
.fm-coach{position:absolute;z-index:3400;left:0;top:0;width:0;height:0;pointer-events:none}
.fm-chh{position:absolute;left:-6px;top:-4px;display:block;width:48px;height:48px;color:#fff;filter:drop-shadow(0 3px 4px rgba(0,0,0,.45))}
.fm-chh svg{display:block;width:100%;height:100%}
.fm-cht{position:absolute;left:0;bottom:30px;transform:translateX(-50%);white-space:nowrap;background:#fff;color:#000;border-radius:16px;padding:8px 14px;font:600 15px/1.2 var(--f-text);box-shadow:0 6px 18px rgba(0,0,0,.22)}
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
@keyframes fmNo{0%,100%{opacity:1}40%{opacity:.6}}
@keyframes fmPop{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes fmGrow{from{transform:scale(.4)}to{transform:scale(1)}}
@keyframes fmPluck{to{transform:translateY(-70%) scale(.3);opacity:0}}
@keyframes fmLand{0%{transform:scale(1.12,.85)}100%{transform:scale(1)}}
@keyframes fmHl{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-14%) scale(1.15)}}
@keyframes fmBob{0%,100%{translate:0 0}50%{translate:0 -4px}}
@keyframes fmPulse{0%,100%{scale:1}50%{scale:1.18}}
@keyframes fmZz{0%{translate:0 0;opacity:0}30%{opacity:1}100%{translate:8px -16px;opacity:0}}
@keyframes fmGlow{0%,100%{filter:drop-shadow(0 0 2px rgba(255,214,90,.6))}50%{filter:drop-shadow(0 0 10px rgba(255,214,90,1))}}
@keyframes fmDrop{0%{translate:0 -50px;scale:.3;opacity:0}60%{translate:0 4px;scale:1.12;opacity:1}100%{translate:0 0;scale:1}}
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
@keyframes fmFade{from{opacity:0}to{opacity:1}}
@keyframes fmNudge{0%,100%{translate:0 0}25%{translate:0 -6px}50%{translate:0 0}75%{translate:0 -3px}}
@media (max-width:560px){
  .fm-sun{width:46px;height:46px}
  .fm-ft b{font-size:1.2rem}
  .fm-hint{font-size:.92rem;padding-left:12px}
  .fm-shel{top:calc(var(--hz) - 52px)}
  .fm-fc{width:68px;min-height:72px}
  .fm-db{gap:6px;font-size:var(--fs-note)}
}
@media (max-width:359px){.fm-foods{grid-template-columns:1fr}.fm-db .ico{width:22px;height:22px}}
/* «Reducir movimiento» (y html[data-motion=calm], que index.html copia de aquí): el escenario se queda quieto */
@media (prefers-reduced-motion: reduce){
  .fm-cloud{animation:none!important;left:var(--cx)!important}
  .fm-stars i,.fm-flies i,.fm-sun::before,.fm-need,.fm-zz,.fm-spk i,.fm-it.fly .fm-e,.fm-it.walk .fm-e,.fm-it.ripe .fm-e,.fm-prod,.fm-fire,.fm-flame,.fm-shel,.fm-ask,.fm-db.nudge,.fm-bfly{animation:none!important}
  .fm-it,.fm-hero{transition:none!important}
  .fm-tray.in,.fm-pop.in,.fm-bub.in{animation-name:fmFade!important}   /* aparecen sin crecer (lo de dentro no se mueve) */
}`;
  document.head.appendChild(st);
}
})();
