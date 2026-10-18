/* Módulo phrases (window.vocabPhrases): «Frases mágicas» (#/frases) y «La frase de la cena» (SPEC §5-G).
   · #/frases: una plantilla de data/phrases.json con el hueco como pieza vacía («I can see ⬚.») y su traducción con el
     hueco («Veo ___.»). Abajo, 3-4 dibujos de palabras que ya sabe: las del repaso con buenas notas (srs:<lang> con
     b ≥ 1); si sabe menos de 4, se completan con las de la última lección del camino, luego con otras del repaso y por
     fin con las fáciles del tema (las primeras del grupo): nunca sale vacío. Tocar un dibujo (o arrastrarlo, G.drag, y
     soltarlo cerca del hueco) lo pone en el hueco con un pequeño muelle; la frase entera se ilumina y suena: la voz del
     navegador dice lo de antes, después el audio grabado de la palabra (si lo tiene, el artículo no va pegado con
     apóstrofo y en inglés no va detrás de a/an/the) y luego lo de detrás, en orden y sin pisarse; si no, la voz dice la frase
     entera. El altavoz es el de la lección (círculo azul claro, 48 px) con la tortuga gris al lado: todo va despacio.
     En la bandeja, la pieza puesta deja su sitio atenuado; tocar otra las cambia y tocar la palabra del hueco la
     devuelve (no hay fallos). «Otra frase» (gris con el hueco vacío, principal con la frase hecha) trae otra plantilla.
     «Dilo» (solo con canListen()) escucha y compara con vocabReview.matches (tolerante, sin artículo, también dentro de
     una frase); si no la entiende, lo dice con calma y no cuenta como fallo.
   · #/frases/cena: la frase de la cena ya hecha, con 🔊, 🐢 y «Dilo». Debajo (también en #/frases), la tarjeta «La frase
     de la cena» con «Ya la dije en casa» (en #/frases/cena es el botón principal; Puerta de mayores con la frase y su
     traducción → sello animado con chispas → award(5, "Frase de la cena"), una vez al día, también tras recargar o
     cambiar de idioma) y «Tus sellos: N» con los últimos sellos. «Jugar con frases» lleva a #/frases.
   · Palabras: los grupos de data/phrases.json solo tienen familia que un niño nombra en la mesa, y de los oficios solo
     salen los que se dicen igual para un niño y una niña.
   · La frase de la cena: una por día local y por idioma, la misma en todos los aparatos ese día: de todas las parejas
     (plantilla, palabra que sabe) se queda con la de menor hash FNV-1a de «día|idioma|plantilla|palabra» (sin repetir la
     palabra de ayer si hay otra). En este aparato se guarda la del día (para que no cambie al aprender palabras nuevas).
   · Hoy: HOME_SLOTS con id "phrase": la fila «La frase de la cena» con la frase y un altavoz (solo si sabe alguna
     palabra que encaje); tocarla abre #/frases/cena. Con el sello de hoy, su icono es el sello dorado.
   · Jugar › Juegos: la tarjeta «Frases mágicas» (vocabGames.register con href, sin partida). «frases» es de la pestaña
     Jugar y de su segmento Juegos; la cápsula de volver lleva a Hoy si se entró desde Hoy y si no a Juegos (back()).
   Guardado:
     localStorage "phrase:stamps" (EXACT en js/save.js: va en la partida exportada y en Google Drive) = {v: 1, days:
       ["AAAA-MM-DD", … los días sellados, ordenados, 60 como mucho], n: sellos en total}. Solo se escribe al sellar.
     localStorage "phrase:day" (solo de este aparato: DEVICE_ONLY en js/save.js) = {d: "AAAA-MM-DD", <lang>: {t: id de la
       plantilla, r: "tema|es"}}: la frase de la cena elegida hoy en cada idioma.
   data/phrases.json = {v, about, pools: {nombre: {animate?, refs: ["tema|es", …]}}, es_g, es_pl, fr_g, en_an,
     english|français|dansk: [{id, t: frase con "_" (y "{a}" en inglés: a/an), es: traducción con "_" y {un} {el} {al}
     {los} {este}, use: word|forms|a|le|un|poss|bare, pools: [nombres], except?: [refs]}]}.
   window.vocabPhrases = {ready() → Promise, data() → el JSON, templates(lang?) → [plantillas], fill(lang, idPlantilla,
     ref) → Promise<frase | null>, cands(lang, idPlantilla) → Promise<[frases]> (todas las que encajan), dinner(lang?) →
     Promise<frase | null>, play(frase, slow) → Promise (la cadena de audio), stamps() → {days, n}, stamped(día?) →
     boolean, back() → {h, t}, state() → lo que se ve en #/frases}. Una frase = {ref, tpl, lang, text, pre, art, core,
     post, es, esPre, esWord, esPost, img, say, clip, known?, day?}.
   Usa de index.html: lang, LANGS, store, bus, ROUTES, HOME_SLOTS, TABS, esc, ico, getDoc, srsK, getMap, mapP, lvLessons,
   LVS, dayKey, award, canListen, listen, stopListen, noVoiceMsg, fitWord, playClip, clipFor, stopClip, speakable,
   useVoice, retryLocal, voiceFor, rate, SLOW, autoTok, ROUTE_FROM, ROUTE_RESTORE, secOf, navTo, shuffle; window.M,
   window.G, window.adultGate, window.vocabReview, window.vocabGames. Iconos: Phosphor. Dibujo de la tarjeta: OpenMoji (bocadillo y destellos). */
(() => {
"use strict";
const W = window, DOC = document;
const KEY = "phrase:stamps", DAYKEY = "phrase:day", MAXD = 60, COINS = 5, NCH = 4;
const IMG = "img/games/frases.png";
const SPARKS = ["#FFCC00", "#1E6EF4", "#008198", "#34C759"];   /* oro, azul, verde azulado y verde: los de la app */
const $ = s => DOC.querySelector(s);
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const wait = ms => new Promise(r => setTimeout(r, ms));
const code = () => LANGS[lang].code;
const rnd = n => Math.floor(Math.random() * n);

/* ---------- datos ---------- */
let DATA = null, dataP = null;
function ready(){
  if(DATA) return Promise.resolve(DATA);
  if(!dataP) dataP = fetch("data/phrases.json").then(r => { if(!r.ok) throw new Error("data/phrases.json " + r.status); return r.json(); })
    .then(d => { if(!isObj(d) || !isObj(d.pools)) throw new Error("data/phrases.json no es válido"); DATA = d; return d; })
    .catch(e => { dataP = null; throw e; });
  return dataP;
}
const tpls = (L = lang) => (DATA && Array.isArray(DATA[L]) ? DATA[L] : []);
const tplOf = (L, id) => tpls(L).find(t => t.id === id) || null;
const poolRefs = p => (DATA && DATA.pools[p] && Array.isArray(DATA.pools[p].refs) ? DATA.pools[p].refs : []);
const tplRefs = t => [...new Set((t.pools || []).flatMap(poolRefs))].filter(r => !(t.except || []).includes(r));
const allRefs = () => [...new Set(Object.keys(DATA.pools).flatMap(poolRefs))];
/* las filas de cada tema, por su «es» (la clave del repaso es «tema|es») */
const ROWS = {};
const docOf = ref => ref.slice(0, ref.indexOf("|"));
async function loadDoc(d){
  if(ROWS[d]) return ROWS[d];
  try{
    const doc = await getDoc(d), m = new Map();
    for(const r of (doc && Array.isArray(doc.rows) ? doc.rows : [])) if(r && r.es && !m.has(r.es)) m.set(r.es, r);
    ROWS[d] = m;
  }catch(e){ return null; }   /* sin internet y sin copia: ese tema no entra */
  return ROWS[d];
}
const loadDocs = refs => Promise.all([...new Set(refs.map(docOf))].map(loadDoc));
const rowOf = ref => { const m = ROWS[docOf(ref)]; return m ? m.get(ref.slice(ref.indexOf("|") + 1)) || null : null; };
const srsOf = L => { const m = store.get("srs:" + L, {}); return isObj(m) ? m : {}; };
const knows = x => !!x && typeof x === "object" && +x.b >= 1;

/* ---------- rellenar el hueco (las mismas reglas que se revisaron palabra por palabra) ---------- */
const VOW = "aeiouyâàäéèêëîïôöûùüœæ";
const first = s => String(s || "").split(/\s\/\s/)[0].trim();
const ann = s => { const m = /\((m|f)\.\)/.exec(s || ""); return m ? m[1] : null; };
const clean = s => first(s).replace(/\s*\([^)]*\)/g, "").trim();
const vowelStart = w => VOW.includes(String(w || "").charAt(0).toLowerCase());
/* inglés: a / an por cómo suena (an hour, a uniform, a one…) */
function an(w){
  if(DATA.en_an && DATA.en_an[w]) return DATA.en_an[w];
  const lw = w.toLowerCase();
  if(/^(hour|honest|honou?r|heir)/.test(lw)) return "an";
  if(/^(uni|use|usu|ura|ure|uro|eu|ewe|one|once)/.test(lw)) return "a";
  return "aeiou".includes(lw.charAt(0)) && lw ? "an" : "a";
}
/* lo que va en el hueco: {art, core} (art: el artículo que la plantilla pone delante; core: la palabra), o null si no
   encaja. Francés: le/la/l' de la palabra, un/une por su género, mon/ma (ma solo ante consonante), sin artículo;
   danés: en/et de la palabra, min/mit; nunca se inventan formas definidas. */
function slot(L, use, r, pool){
  const x = r.l && r.l[L]; if(!x || !x.word) return null;
  const raw = x.word, w = clean(raw);
  if(!w || w.includes("/")) return null;
  /* oficios: solo los que se dicen igual para un niño y para una niña («le dentiste / la dentiste» sí; «l'infirmier /
     l'infirmière» o «waiter / waitress» no, para no poner a nadie en masculino) */
  if(pool === "jobs" && new Set(String(raw).split(/\s\/\s/).map(a => a.replace(/\s*\([^)]*\)/g, "").trim().replace(/^(le |la |l'|en |et )/, ""))).size > 1) return null;
  const forms = () => { const f = clean(x.forms); return !f || f === "—" || f === "-" || f.includes("/") ? null : f; };
  if(L === "english"){
    if(use === "a") return {art: an(w) + " ", core: w};
    if(use === "word") return {art: "", core: w};
    if(use === "forms"){ const f = forms(); return f ? {art: "", core: f} : null; }
    return null;
  }
  if(L === "français"){
    if(use === "le") return {art: vowelStart(w) ? "l'" : "le ", core: w};
    const m = /^(le |la |l'|les )(.+)$/.exec(w);
    if(!m || m[1] === "les ") return null;
    const a = m[1], b = m[2];
    if(use === "word") return {art: "", core: w};
    if(use === "bare") return {art: "", core: b};
    if(use === "forms"){ const f = clean(x.forms); return f.startsWith("les ") && !f.includes("/") ? {art: "", core: f} : null; }
    if(use === "un"){
      const g = a === "le " ? "m" : a === "la " ? "f" : (ann(first(raw)) || (DATA.fr_g || {})[w]);
      return g === "m" || g === "f" ? {art: "", core: (g === "m" ? "un " : "une ") + b} : null;
    }
    if(use === "poss") return {art: "", core: (a === "la " && !vowelStart(b) ? "ma " : "mon ") + b};
    return null;
  }
  if(L === "dansk"){
    const m = /^(en|et) (.+)$/.exec(w);
    if(use === "word") return m || pool === "colours" ? {art: "", core: w} : null;
    if(use === "forms"){ const f = forms(); return f ? {art: "", core: f} : null; }
    if(!m) return null;
    if(use === "bare") return {art: "", core: m[2]};
    if(use === "poss") return {art: "", core: (m[1] === "en" ? "min " : "mit ") + m[2]};
  }
  return null;
}
/* español: la palabra limpia («llave, clave» → «llave»; «médico/a» se queda), su género y su plural */
function esClean(es){
  let s = String(es || "").replace(/\([^)]*\)/g, "").trim();
  s = s.split(/[;,]/)[0].trim();
  const i = s.indexOf("/");
  if(i >= 0 && !/^(a|as|es|o)$/.test(s.slice(i + 1).trim())) s = s.slice(0, i).trim();
  return s.charAt(0).toLowerCase() + s.slice(1);
}
const esG = s => (DATA.es_g || {})[s] || (/(ción|sión|xión|dad|tad|tud|umbre|a)$/.test(s.split(" ")[0]) ? "f" : "m");
const ACC = {"á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u"};
const nVow = w => (w.match(/[aeiouáéíóú]/g) || []).length;
function pl1(w){
  if(/[aeiouáéó]$/.test(w)) return w + "s";
  if(/[íú]$/.test(w)) return w + "es";
  if(w.endsWith("z")) return w.slice(0, -1) + "ces";
  if(/[^áéíóú]s$|x$/.test(w) && nVow(w) > 1) return w;
  if(/[áéíóú][nsl]$|[áéíóú]n$/.test(w) && nVow(w) > 1 && !/[áéíóú].*[aeiou].*[nsl]$/.test(w.slice(0, -2))){
    const m = /([áéíóú])([^aeiouáéíóú]*)$/.exec(w);
    if(m) return w.slice(0, m.index) + ACC[m[1]] + m[2] + "es";
  }
  return w + "es";
}
function esPl(s){
  if(DATA.es_pl && DATA.es_pl[s]) return DATA.es_pl[s];
  let stop = false;
  return s.split(" ").map(w => { if(w === "de" || w === "del") stop = true; return stop ? w : pl1(w); }).join(" ");
}
/* la traducción: los marcadores concuerdan con la palabra en español ({al}: «a» personal con personas y animales) */
function esParts(t, r, animate){
  const s = esClean(r.es), g = esG(s), plural = t.includes("{los}");
  const rep = {"{un}": {m: "un", f: "una", fa: "un"}[g], "{el}": {m: "el", f: "la", fa: "el"}[g],
    "{al}": (animate ? {m: "al", f: "a la", fa: "al"} : {m: "el", f: "la", fa: "el"})[g],
    "{los}": g === "m" ? "los" : "las", "{este}": g === "m" ? "Este" : "Esta"};
  for(const [k, v] of Object.entries(rep)) t = t.split(k).join(v);
  const i = t.indexOf("_");
  return {esPre: t.slice(0, i), esWord: plural ? esPl(s) : s, esPost: t.slice(i + 1)};
}
/* la traducción con el hueco vacío: sin marcadores («{este} es mi _.» → «Es mi ___.») */
function esFrame(t){
  let s = String(t || "").replace(/\{[a-z]+\}/g, "").replace(/\s{2,}/g, " ").trim().replace("_", "___");
  const m = /^([¿¡]?)(.)/.exec(s);
  return m ? m[1] + m[2].toUpperCase() + s.slice(m[0].length) : s;
}
/* el marco de la frase: lo de antes y lo de después del hueco (en inglés, {a} viaja con la palabra) */
function frame(t){
  const s = String(t.t || "").replace("{a} _", "_"), i = s.indexOf("_");
  return {pre: s.slice(0, i), post: s.slice(i + 1)};
}
/* la frase con esa palabra (el tema ya cargado), o null si no encaja */
function fillNow(L, tpl, ref){
  if(!tpl || (tpl.except || []).includes(ref)) return null;
  const r = rowOf(ref); if(!r || !r.img || !r.es) return null;
  const pool = (tpl.pools || []).find(p => poolRefs(p).includes(ref)); if(!pool) return null;
  const s = slot(L, tpl.use, r, pool); if(!s) return null;
  const {pre, post} = frame(tpl), x = r.l[L];
  const es = esParts(tpl.es, r, !!DATA.pools[pool].animate);
  return {ref, tpl: tpl.id, lang: L, pre, art: s.art, core: s.core, post, text: pre + s.art + s.core + post,
    es: es.esPre + es.esWord + es.esPost, ...es, img: r.img,
    say: tpl.use === "forms" ? s.core : clean(x.word),   /* lo que se compara en «Dilo» */
    /* ¿puede sonar el audio grabado de la palabra? No si el artículo va pegado con apóstrofo, ni en inglés cuando lo de
       antes acaba en a/an/the: la voz diría sola «I can see a» y muchas leen esa «a» como la letra (o «the» como /ðiː/);
       así la frase entera la dice la voz, con su forma débil */
    clip: !/'$/.test(s.art) && !(L === "english" && (s.art || /\bthe\s*$/i.test(pre)))};
}
async function fill(L, id, ref){ await ready(); await loadDoc(docOf(ref)); return fillNow(L, tplOf(L, id), ref); }
async function cands(L, id){
  await ready(); const t = tplOf(L, id); if(!t) return [];
  const refs = tplRefs(t); await loadDocs(refs);
  return refs.map(r => fillNow(L, t, r)).filter(Boolean);
}

/* ---------- qué palabras salen ---------- */
/* las de la última lección hecha del camino (por orden del camino) */
async function lessonRefs(){
  try{
    await getMap();
    const P = mapP(); let last = null;
    for(const lv of Object.keys(LVS)) for(const l of lvLessons(lv)) if(l && Array.isArray(l.w) && +P[l.id] > 0) last = l;
    if(!last) return [];
    const out = [];
    for(const [d, k] of last.w){ try{ const doc = await getDoc(d), r = doc && doc.rows && doc.rows[k]; if(r && r.es) out.push(d + "|" + r.es); }catch(e){} }
    return out;
  }catch(e){ return []; }
}
/* las fáciles: las primeras de cada grupo de la plantilla */
const easyRefs = t => (t.pools || []).flatMap(p => poolRefs(p).slice(0, 14)).filter(r => !(t.except || []).includes(r));
/* 3-4 dibujos para la plantilla: primero los que sabe; si no llegan, la última lección, el resto del repaso y las fáciles.
   Sin repetir palabra ni dibujo. */
async function pickChoices(L, t, n = NCH){
  const S = srsOf(L), inT = tplRefs(t), out = [], seen = new Set();
  const add = f => {
    if(!f || out.length >= n) return;
    const k = f.core.toLowerCase();
    if(seen.has(k) || seen.has(f.img)) return;
    seen.add(k); seen.add(f.img); out.push(f);
  };
  const from = async list => { for(const ref of list){ if(out.length >= n) return; await loadDoc(docOf(ref)); add(fillNow(L, t, ref)); } };
  await from(shuffle(inT.filter(r => knows(S[r]))));
  if(out.length < n){ const ls = await lessonRefs(); await from(shuffle(ls.filter(r => inT.includes(r)))); }
  if(out.length < n) await from(shuffle(inT.filter(r => S[r] && !knows(S[r]))));
  if(out.length < n) await from(shuffle(easyRefs(t)));
  if(out.length < 3) await from(inT);
  return shuffle(out);
}
/* cuántas palabras que sabe encajan en cada plantilla (distintas) */
async function knownCounts(L){
  const S = srsOf(L), refs = allRefs().filter(r => knows(S[r]));
  await loadDocs(refs);
  return tpls(L).map(t => new Set(refs.map(r => fillNow(L, t, r)).filter(Boolean).map(f => f.core.toLowerCase())).size);
}
/* una plantilla al azar entre las que tienen 4 palabras que sabe (o alguna, o todas), sin repetir la de ahora */
async function pickTemplate(L, avoid){
  const T = tpls(L); if(!T.length) return null;
  const c = await knownCounts(L), best = Math.max(0, ...c), min = best >= NCH ? NCH : best > 0 ? 1 : 0;
  let ok = T.filter((t, i) => c[i] >= min);
  if(ok.length > 1) ok = ok.filter(t => t.id !== avoid);
  return ok[rnd(ok.length)] || T[0];
}

/* ---------- la frase de la cena ---------- */
function hash(s){ let h = 0x811c9dc5; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
const dayStr = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return dayKey(d); };
/* la pareja (plantilla, palabra) de menor hash ese día; skip: una palabra que no debe salir (la de ayer) */
function rawPick(L, day, refs, skip){
  let best = null, bh = Infinity;
  for(const t of tpls(L)) for(const r of refs){
    if(skip && r === skip) continue;
    const h = hash(`${day}|${L}|${t.id}|${r}`);
    if(h >= bh) continue;
    const f = fillNow(L, t, r); if(f){ bh = h; best = f; }
  }
  return best;
}
function dayPick(L, day, refs){
  const y = rawPick(L, dayStr(-1), refs);
  return (y && rawPick(L, day, refs, y.ref)) || rawPick(L, day, refs);
}
/* la frase de hoy: con palabras que sabe (known: true); si no sabe ninguna que encaje y fallback, con las fáciles */
async function dinner(L = lang, o = {}){
  await ready();
  const day = dayStr(0), sv = store.get(DAYKEY, null), mine = isObj(sv) && sv.d === day && isObj(sv[L]) ? sv[L] : null;
  if(mine && typeof mine.t === "string" && typeof mine.r === "string"){
    await loadDoc(docOf(mine.r));
    const f = fillNow(L, tplOf(L, mine.t), mine.r);
    if(f) return Object.assign(f, {known: true, day});
  }
  const S = srsOf(L), refs = allRefs().filter(r => knows(S[r]));
  await loadDocs(refs);
  const f = dayPick(L, day, refs);
  if(f){
    const nv = isObj(sv) && sv.d === day ? sv : {d: day};
    nv[L] = {t: f.tpl, r: f.ref}; store.set(DAYKEY, nv);
    return Object.assign(f, {known: true, day});
  }
  if(o.fallback === false) return null;
  const easy = [...new Set(tpls(L).flatMap(t => easyRefs(t).slice(0, 8)))];
  await loadDocs(easy);
  const g = dayPick(L, day, easy);
  return g ? Object.assign(g, {known: false, day}) : null;
}

/* ---------- sellos ---------- */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
function stamps(){
  const v = store.get(KEY, null);
  const days = [...new Set(isObj(v) && Array.isArray(v.days) ? v.days.filter(d => typeof d === "string" && DAY_RE.test(d)) : [])].sort().slice(-MAXD);
  return {days, n: Math.max(days.length, Math.floor(+(isObj(v) && v.n) || 0))};
}
const stamped = (d = dayStr(0)) => stamps().days.includes(d);
function addStamp(){
  const s = stamps(), d = dayStr(0);
  if(s.days.includes(d)) return false;
  s.days.push(d); s.days.sort();
  store.set(KEY, {v: 1, days: s.days.slice(-MAXD), n: s.n + 1});
  return true;
}

/* ---------- audio: voz del navegador + audio grabado de la palabra, en orden ---------- */
let playTok = 0;
/* L: el idioma de la frase (el de la app si no se dice). La voz es la de ese idioma en este aparato (useVoice de index.html:
   la elegida en Ajustes › Voz y velocidad o «Automática»); si es de internet y falla, otra vez con una del aparato */
function ttsP(text, slow, L){
  return new Promise(res => {
    const t0 = speakable(text);
    if(!("speechSynthesis" in W) || !/\p{L}/u.test(t0)) return res();
    const u = new SpeechSynthesisUtterance(t0), vl = LANGS[L] ? L : lang;
    u.rate = slow ? SLOW() : rate;
    if(typeof useVoice === "function") useVoice(u, vl);
    else { u.lang = LANGS[vl].code; const v = voiceFor(LANGS[vl].code); if(v) u.voice = v; }
    let done = false, tm = 0;
    const fin = () => { if(done) return; done = true; clearTimeout(tm); res(); };
    /* por si el navegador no avisa al acabar: se corta (así lo siguiente nunca pisa a esto); otra vez al reintentar */
    const arm = () => { clearTimeout(tm); tm = setTimeout(() => { try{ if(speechSynthesis.speaking) speechSynthesis.cancel(); }catch(e){} fin(); }, 2500 + t0.length * 150 / u.rate); };
    arm();
    u.onend = fin;
    u.onerror = e => { if(!done && typeof retryLocal === "function" && retryLocal(u, e, fin)) arm(); else fin(); };
    try{ speechSynthesis.speak(u); }catch(e){ fin(); }
  });
}
function clipP(text, slow){
  return new Promise(res => {
    let done = false;
    const fin = ok => { if(done) return; done = true; clearTimeout(tm); res(ok); };
    const tm = setTimeout(() => { try{ stopClip(); }catch(e){} fin(true); }, 9000);
    if(!playClip(text, slow, fin)) fin(false);
  });
}
/* ui (opcional): {on(), off(), word(on)} para iluminar la frase y la pieza mientras suena */
async function play(f, slow, ui){
  if(!f) return;
  const tok = ++playTok, at = autoTok, alive = () => tok === playTok && at === autoTok;
  try{ if("speechSynthesis" in W) speechSynthesis.cancel(); else stopClip(); }catch(e){}
  if(ui && ui.on) ui.on();
  const rec = f.lang === lang && f.clip && !!clipFor(f.core);
  const segs = rec ? [{t: f.pre + f.art}, {c: f.core}, {t: f.post}] : [{t: f.text, all: true}];
  await wait(40);
  for(const s of segs){
    if(!alive()) break;
    if(s.c){
      if(ui && ui.word) ui.word(true);
      const ok = await clipP(s.c, slow);
      if(!ok && alive()) await ttsP(s.c, slow, f.lang);
      if(ui && ui.word) ui.word(false);
    } else {
      if(s.all && ui && ui.word) ui.word(true);
      await ttsP(s.t.trim(), slow, f.lang);
      if(s.all && ui && ui.word) ui.word(false);
    }
  }
  if(tok === playTok && ui && ui.off) ui.off();
}

/* ---------- estilos ---------- */
const DARK = (s, b) => `:root[data-theme=dark] ${s}{${b}}`;
const CSS = `
.ph{display:grid;gap:16px;max-width:640px;margin:0 auto}
.ph-card{padding:20px 16px 16px;text-align:center}
.ph-k{display:flex;align-items:center;justify-content:center;gap:8px;margin:0;color:var(--label2);font:700 var(--fs-note)/1.3 var(--f-text)}
.ph-k .ico{color:var(--gold-ink)}
.ph-line{margin:16px 0 8px;padding:4px 8px;border-radius:16px;color:var(--label);font:800 var(--fs-t2)/1.4 var(--f-round);
  overflow-wrap:normal;word-break:normal;hyphens:manual;transition:background-color var(--d-base,260ms),box-shadow var(--d-base,260ms)}
.ph-line.is-lit{background:var(--brand-soft);box-shadow:0 0 0 4px var(--brand-soft)}
.ph-gap{display:inline-block;vertical-align:baseline;border-radius:12px;transition:scale var(--d-fast,160ms),background-color var(--d-fast,160ms)}
.ph-gap.is-empty{width:3.4em;height:1.15em;vertical-align:-.2em;border:3px dashed var(--brand-tint);background:var(--brand-soft)}
.ph-gap.is-near{border-style:solid;scale:1.08}
.ph-pc{display:inline-block;padding:0 .22em;border-radius:12px;background:var(--brand-soft);color:var(--brand-ink);transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms)}
.ph-pc.is-say{background:var(--brand-fill);color:#fff}
.ph[data-mode=play] .ph-pc{cursor:pointer}
.ph-tile img{transition:opacity var(--d-fast,160ms)}
.ph-es{margin:0 0 16px;color:var(--label2);font:400 var(--fs-sub)/1.35 var(--f-text)}
.ph-es b{color:var(--label);font-weight:700}
.ph-acts{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px 20px}   /* 20: sitio para las etiquetas de las teclas */
/* el altavoz: el mismo que el de la lección (círculo azul claro que se rellena al sonar) y la tortuga gris al lado */
.ph-spk{flex:none;display:grid;place-items:center;width:48px;height:48px;margin:0;padding:0;border:0;border-radius:50%;background:var(--brand-soft);color:var(--brand-tint);cursor:pointer;
  -webkit-tap-highlight-color:transparent;transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms)}
.ph-slow{flex:none;display:grid;place-items:center;width:44px;height:44px;margin:0;padding:0;border:0;border-radius:50%;background:var(--fill2);color:var(--label);cursor:pointer;-webkit-tap-highlight-color:transparent}
.ph-spk.playing,.ph-slow.playing{background:var(--brand-fill);color:#fff}
.ph-spk:focus-visible,.ph-slow:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.ph-acts[data-off]{visibility:hidden}
.ph-mic.is-on{color:#fff;background:var(--brand-fill)}
.ph-msg{display:flex;align-items:center;justify-content:center;gap:8px;min-height:1.4em;margin:12px 0 0;color:var(--label2);font:600 var(--fs-note)/1.35 var(--f-text)}
.ph-msg:empty{margin:0;min-height:0}
.ph-msg.ok{color:var(--ok-ink)}
.ph-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0;padding:0}
.ph-tiles.n3{grid-template-columns:repeat(3,minmax(0,1fr))}
.ph-tile{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;min-height:var(--tap);margin:0;padding:8px 4px;border:0;border-radius:var(--r-md);
  color:var(--label);font:700 var(--fs-note)/1.2 var(--f-round);cursor:pointer;-webkit-tap-highlight-color:transparent}
.ph-tile img{box-sizing:border-box;width:56px;height:56px;object-fit:contain;pointer-events:none;-webkit-user-drag:none;user-select:none}
.ph-tile .ph-tw{display:block;max-width:100%;white-space:nowrap;overflow:hidden}
/* la pieza puesta deja su sitio en la bandeja: un hueco atenuado con borde de puntos (como mientras se arrastra) */
.ph-tile[aria-pressed=true]{background:transparent;box-shadow:none;outline:2px dashed var(--sep);outline-offset:-2px}
.ph-tile[aria-pressed=true] img{opacity:.35}
.ph-tile[aria-pressed=true] .ph-tw{visibility:hidden}   /* la palabra está en el hueco (el botón la sigue diciendo) */
.ph-tile:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.ph-hint{margin:-8px 0 0;text-align:center;color:var(--label2);font:400 var(--fs-note)/1.35 var(--f-text)}
.ph-cena{padding:16px}
.ph-ct{display:flex;align-items:center;gap:8px;margin:0;font:700 var(--fs-head)/1.25 var(--f-text);color:var(--label)}
.ph-ct .ico{color:var(--gold-ink)}
.ph-sn{flex:none;padding:4px 12px;border-radius:var(--r-pill);background:var(--fill2);color:var(--label);font:800 var(--fs-note)/1.3 var(--f-round);font-variant-numeric:tabular-nums}
.ph-cl{display:flex;align-items:center;gap:8px;margin:12px 0 0}
.ph-cl a{flex:1;min-width:0;color:var(--label);font:700 var(--fs-sub)/1.3 var(--f-round);text-decoration:none}
.ph-cl a small{display:block;color:var(--label2);font:400 var(--fs-note)/1.3 var(--f-text)}
.ph-say1{flex:none;width:var(--tap);height:var(--tap);border:0;border-radius:50%;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-tint);cursor:pointer;-webkit-tap-highlight-color:transparent}
.ph-say1.playing{background:var(--brand-fill);color:#fff}
.ph-stb{margin:12px 0 0}
.ph-stn{margin:8px 0 0;text-align:center;color:var(--label2);font:400 var(--fs-min)/1.35 var(--f-text)}
.ph-done{display:flex;align-items:center;gap:12px;margin:12px 0 0;padding:8px 12px;border-radius:var(--r-md);background:var(--fill2)}
.ph-done b{display:block;font:800 var(--fs-sub)/1.25 var(--f-round);color:var(--label)}
.ph-done small{display:block;color:var(--label2);font:400 var(--fs-note)/1.3 var(--f-text)}
.ph-seal{flex:none;display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:var(--gold);color:var(--gold-on);rotate:-8deg}
.ph-sr{display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px 12px;margin:16px 0 0}
.ph-sr .ph-sn{margin-top:4px}
.ph-seals{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}
.ph-seals li{display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--label2);font:600 var(--fs-min)/1.2 var(--f-text);font-variant-numeric:tabular-nums}
.ph-seals li .ico{color:var(--gold-deep)}
.ph-err{padding:20px;text-align:center}
/* la fila de Hoy: el enlace ocupa la fila y el altavoz va aparte (un botón nunca dentro de un enlace) */
.hm-row.ph-hrow{gap:4px;padding:0 8px 0 0;cursor:default}
.ph-hgo{flex:1;min-width:0;display:flex;align-items:center;gap:12px;align-self:stretch;padding:8px 0 8px 12px;border-radius:inherit;color:inherit;text-decoration:none;-webkit-tap-highlight-color:transparent}
.ph-hgo small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ph-hsay{margin:-4px 0}
/* en el móvil, el dibujo de cada ficha llena su ancho (antes 56 px; 73 en 390×844, 106 con 3 fichas): la bandeja sigue en una
   fila y la página no baja más que antes (huecos de 12 y 8 px en lugar de 16 y 12, y 6 px arriba y abajo en la ficha) */
@media (max-width:743px){.ph{gap:12px}.ph-tiles{gap:8px}.ph-tile{padding:6px 4px}.ph-tile img{width:min(100%,112px);height:auto;aspect-ratio:1}}
@media (min-width:744px){.ph-tile img{width:72px;height:72px}.ph-line{font-size:var(--fs-t1)}}
${DARK(".ph-seals li .ico", "color:var(--gold)")}
${DARK(".ph-tile img", "background:#F2F2F7;border-radius:var(--r-sm);padding:2px")}   /* la placa clara de los dibujos, como .img img */
${DARK(".ph-k .ico,.ph-ct .ico", "color:var(--gold)")}
@media (prefers-reduced-motion:reduce){.ph-line,.ph-gap,.ph-pc,.ph-spk,.ph-tile img{transition:none}}
`;
function css(){
  if(DOC.getElementById("css-phrases")) return;
  const s = DOC.createElement("style"); s.id = "css-phrases"; s.textContent = CSS; DOC.head.appendChild(s);
}

/* ---------- #/frases ---------- */
let NAV = 0, ORIGIN = null, LIS = false;
/* lo que se ve: mode "play" | "cena", tpl, choices, placed (índice o -1), f (la frase completa o null), lang */
let ST = null;
const lng = () => ` lang="${esc(code())}"`;
const gapHtml = f => f ? `<span class="ph-gap is-full" id="ph-gap"><span class="ph-pc" id="ph-pc">${esc(f.art + f.core)}</span></span>`
  : `<span class="ph-gap is-empty" id="ph-gap" role="img" lang="es" aria-label="espacio vacío"></span>`;
function lineHtml(){
  const t = tplOf(ST.lang, ST.tpl), fr = frame(t), f = ST.f;
  return `${esc(fr.pre)}${gapHtml(f)}${esc(fr.post)}`;
}
const esHtml = () => ST.f ? `${esc(ST.f.esPre)}<b>${esc(ST.f.esWord)}</b>${esc(ST.f.esPost)}` : esc(esFrame(tplOf(ST.lang, ST.tpl).es));
/* el dibujo como en los juegos (vocabGames.pic: los árboles de familia recortados de img/fam2/); si no carga (sin conexión
   antes de haberlo visto), el de siempre */
function picTag(src){
  let p = src; try{ if(W.vocabGames && typeof vocabGames.pic === "function") p = vocabGames.pic(src) || src; }catch(e){ p = src; }
  return `<img src="${esc(p)}"${p !== src ? ` data-f="${esc(src)}" onerror="if(this.dataset.f){this.src=this.dataset.f;delete this.dataset.f}"` : ""} alt="" width="56" height="56" draggable="false">`;
}
function tilesHtml(){
  return ST.choices.map((f, i) => `<button type="button" class="card ph-tile" data-i="${i}" data-key="${i + 1}" data-key-pos="in" aria-pressed="${ST.placed === i}" aria-label="${esc(f.core)}"${lng()}>
    ${picTag(f.img)}<span class="ph-tw">${esc(f.core)}</span></button>`).join("");
}
function dateShort(d){
  try{ const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd).toLocaleDateString("es-ES", {day: "numeric", month: "short"}).replace(".", ""); }catch(e){ return d; }
}
function cenaHtml(dn){
  const s = stamps(), today = s.days.includes(dayStr(0)), last = s.days.slice(-12).reverse();
  const phrase = ST.mode === "play" && dn ? `<p class="ph-cl"><a href="#/frases/cena" id="ph-cgo"><span${lng()}>${esc(dn.text)}</span><small>${esc(dn.es)}</small></a>
    <button type="button" class="ph-say1" id="ph-csay" aria-label="Escuchar la frase de la cena">${ico("speaker-high", "fill", 20)}</button></p>` : "";
  const act = today ? `<div class="ph-done" id="ph-done"><span class="ph-seal" aria-hidden="true">${ico("seal-check", "fill", 34)}</span><span><b>¡Sello de hoy!</b><small>Mañana hay otra frase.</small></span></div>`
    : `<button type="button" class="glass-btn${ST.mode === "cena" ? " glass-btn--pri glass-btn--lg" : ""} glass-btn--block ph-stb" id="ph-stamp"${ST.mode === "cena" ? ' data-key="enter"' : ""}>${ico("seal-check", "bold", 20)}Ya la dije en casa</button>
      <p class="ph-stn">Un mayor la sella después de decirla juntos.</p>`;
  return `<h2 class="ph-ct" id="ph-ct">${ico(ST.mode === "play" ? "sparkle" : "seal-check", "fill", 20)}${ST.mode === "play" ? "La frase de la cena" : "El sello de la cena"}</h2>
    ${phrase}${act}
    <div class="ph-sr"><span class="ph-sn" id="ph-sn">Tus sellos: <b>${s.n}</b></span>
    ${last.length ? `<ol class="ph-seals" aria-label="Tus últimos sellos">${last.map(d => `<li>${ico("seal-check", "fill", 28)}<span>${esc(dateShort(d))}</span></li>`).join("")}</ol>` : ""}</div>`;
}
function errHtml(){
  return `<div class="ph"><div class="card ph-err"><p>No se pudieron cargar las frases.</p><button type="button" class="glass-btn glass-btn--pri" id="ph-retry">${ico("arrow-counter-clockwise", "bold", 20)}Probar otra vez</button></div></div>`;
}
let DN = null;   /* la frase de la cena de ahora (para la tarjeta de abajo) */
/* el botón de abajo. En #/frases, «Otra frase»: gris mientras el hueco está vacío (lo que toca es poner una pieza) y
   principal en cuanto hay frase. En #/frases/cena, «Jugar con frases» (lleva a Frases mágicas): gris hasta que la frase
   tiene su sello de hoy, porque lo principal ahí es «Ya la dije en casa» (y va debajo de la tarjeta del sello). */
function nextHtml(){
  const cena = ST.mode === "cena", pri = cena ? stamped() : ST.placed >= 0;
  return `<button type="button" class="glass-btn${pri ? " glass-btn--pri glass-btn--lg" : ""} glass-btn--block ph-next" id="ph-next" data-key="${cena ? (pri ? "enter right" : "right") : "enter right"}">${ico(cena ? "sparkle" : "shuffle", "bold", 20)}${cena ? "Jugar con frases" : "Otra frase"}</button>`;
}
function repaintNext(){
  const n = $("#ph-next"); if(!n) return;
  const f = DOC.activeElement === n, t = DOC.createElement("div"); t.innerHTML = nextHtml();
  const b = t.firstElementChild;
  if(n.className === b.className && n.dataset.key === b.dataset.key) return;
  n.className = b.className; n.dataset.key = b.dataset.key;
  if(f) n.focus({preventScroll: true});
}
function paint(){
  const app = $("#app"), play1 = ST.mode === "play";
  const mic = canListen() ? `<button type="button" class="glass-btn ph-mic" id="ph-mic">${ico("microphone", "bold", 20)}<span>Dilo</span></button>` : "";
  app.innerHTML = `<div class="ph" id="ph" data-mode="${ST.mode}">
    <section class="card ph-card" id="ph-card" aria-labelledby="ph-k">
      <p class="ph-k" id="ph-k">${play1 ? `${ico("sparkle", "fill", 18)}Frases mágicas` : `${ico("sparkle", "fill", 18)}La frase de la cena`}</p>
      <p class="ph-line" id="ph-line"${lng()}>${lineHtml()}</p>
      <p class="ph-es" id="ph-es">${esHtml()}</p>
      <div class="ph-acts" id="ph-acts"${ST.f ? "" : " data-off"}>
        <button type="button" class="ph-spk" id="ph-say" data-key="space" aria-label="Oír la frase" title="Oír la frase">${ico("speaker-high", "fill", 24)}</button>
        <button type="button" class="ph-slow" id="ph-slow" data-key="shift+space" aria-label="Oír despacio" title="Oír despacio">${ico("turtle", "fill", 22)}</button>
        ${mic}
      </div>
      <p class="ph-msg" id="ph-msg" role="status" aria-live="polite"></p>
    </section>
    ${play1 ? `<div class="ph-tiles${ST.choices.length === 3 ? " n3" : ""}" id="ph-tiles" role="group" aria-label="Elige una palabra">${tilesHtml()}</div>
    <p class="ph-hint" id="ph-hint">Toca un dibujo o arrástralo al hueco.</p>` : ""}
    ${play1 ? nextHtml() : ""}
    <section class="card ph-cena" id="ph-cena" aria-labelledby="ph-ct">${cenaHtml(DN)}</section>
    ${play1 ? "" : nextHtml()}
  </div>`;
  wire();
}
/* b (opcional): el altavoz o la tortuga que se pulsó, que se rellena mientras suena */
const lineUI = b => ({
  on(){ const l = $("#ph-line"); if(l) l.classList.add("is-lit"); if(b) b.classList.add("playing"); },
  off(){ const l = $("#ph-line"); if(l) l.classList.remove("is-lit"); if(b) b.classList.remove("playing"); },
  word(on){ const p = $("#ph-pc"); if(p) p.classList.toggle("is-say", !!on); },
});
const btnUI = b => ({on(){ b.classList.add("playing"); }, off(){ b.classList.remove("playing"); }});
function msg(t, ok){
  const m = $("#ph-msg"); if(!m) return;
  m.classList.toggle("ok", !!ok);
  m.innerHTML = t ? `${ico(ok ? "check" : "info", "bold", 18)}<span>${esc(t)}</span>` : "";
}
/* pone la palabra i en el hueco; from: de dónde viene (punto del dedo o el dibujo), para el muelle */
function place(i, from){
  const f = ST && ST.choices[i]; if(!f) return;
  stopMic();
  ST.placed = i; ST.f = f;
  const line = $("#ph-line"), es = $("#ph-es"), acts = $("#ph-acts");
  if(!line) return;
  line.innerHTML = lineHtml(); es.innerHTML = esHtml(); acts.removeAttribute("data-off"); msg("");
  DOC.querySelectorAll(".ph-tile").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.i === i)));
  repaintNext();
  const pc = $("#ph-pc");
  if(pc && from && W.M && typeof M.springTo === "function"){
    const r = pc.getBoundingClientRect(), dx = from.x - (r.left + r.width / 2), dy = from.y - (r.top + r.height / 2);
    if(Math.hypot(dx, dy) > 4) M.springTo(pc, [{translate: `${dx}px ${dy}px`, scale: .8}, {translate: "0 0", scale: 1}], {damping: .72, response: .32, commit: false});
  }
  if(W.G && typeof G.haptic === "function") G.haptic("selection");
  play(f, false, lineUI());
}
/* tocar la palabra del hueco la devuelve a la bandeja (el hueco vuelve a estar vacío) */
function unplace(){
  if(!ST || ST.mode !== "play" || ST.placed < 0) return;
  stopMic(); playTok++;
  try{ if("speechSynthesis" in W) speechSynthesis.cancel(); else stopClip(); }catch(e){}
  ST.placed = -1; ST.f = null;
  const line = $("#ph-line"), es = $("#ph-es"), acts = $("#ph-acts");
  if(!line) return;
  line.classList.remove("is-lit"); DOC.querySelectorAll("#ph-acts .playing").forEach(b => b.classList.remove("playing"));
  line.innerHTML = lineHtml(); es.innerHTML = esHtml(); acts.setAttribute("data-off", ""); msg("");
  DOC.querySelectorAll(".ph-tile").forEach(b => b.setAttribute("aria-pressed", "false"));
  repaintNext();
  if(W.G && typeof G.haptic === "function") G.haptic("selection");
}
const center = el => { const r = el.getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; };
/* ¿se soltó cerca del hueco? (un poco de imán: 56 px alrededor, o encima de la frase) */
function nearGap(x, y){
  const g = $("#ph-gap"), l = $("#ph-line"); if(!g) return false;
  const r = g.getBoundingClientRect(), m = 56;
  if(x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m) return true;
  const rl = l && l.getBoundingClientRect();
  return !!rl && x >= rl.left && x <= rl.right && y >= rl.top && y <= rl.bottom;
}
let OFFS = [];
function wire(){
  OFFS.forEach(f => { try{ f(); }catch(e){} }); OFFS = [];
  const say = $("#ph-say"), slow = $("#ph-slow"), next = $("#ph-next"), mic = $("#ph-mic");
  say.addEventListener("click", () => play(ST.f, false, lineUI(say)));
  slow.addEventListener("click", () => play(ST.f, true, lineUI(slow)));
  next.addEventListener("click", () => { if(ST.mode === "cena") navTo("#/frases"); else another(); });
  $("#ph-line").addEventListener("click", e => { if(e.target.closest && e.target.closest("#ph-pc")) unplace(); });
  if(mic) mic.addEventListener("click", () => dilo(mic));
  DOC.querySelectorAll(".ph-tile").forEach(b => {
    const i = +b.dataset.i;
    b.addEventListener("click", () => place(i, center(b)));
    const tw = b.querySelector(".ph-tw"); if(tw && typeof fitWord === "function") fitWord(tw, 11);
    if(W.G && typeof G.drag === "function") OFFS.push(G.drag(b, {ghost: true,
      onMove: e => { const g = $("#ph-gap"); if(g) g.classList.toggle("is-near", nearGap(e.x, e.y)); },
      onDrop: e => { const g = $("#ph-gap"); if(g) g.classList.remove("is-near"); if(!nearGap(e.x, e.y)) return false; place(i, {x: e.x, y: e.y}); return true; },
      onCancel: () => { const g = $("#ph-gap"); if(g) g.classList.remove("is-near"); }}));
  });
  wireCena();
}
function wireCena(){
  const st = $("#ph-stamp"), cs = $("#ph-csay");
  if(st) st.addEventListener("click", () => stamp(st));
  if(cs) cs.addEventListener("click", () => play(DN, false, btnUI(cs)));
}
function repaintCena(){ const c = $("#ph-cena"); if(c){ c.innerHTML = cenaHtml(DN); wireCena(); } }
async function another(){
  const my = ++NAV, L = lang;
  stopMic(); playTok++;
  try{ if("speechSynthesis" in W) speechSynthesis.cancel(); }catch(e){}
  const t = await pickTemplate(L, ST && ST.tpl);
  const ch = t ? await pickChoices(L, t) : [];
  if(my !== NAV || L !== lang || !t || !ch.length) return;
  ST = {mode: "play", lang: L, tpl: t.id, choices: ch, placed: -1, f: null};
  paint();
  const n = $("#ph-next"); if(n && DOC.activeElement === DOC.body) n.focus({preventScroll: true});
}
/* «Dilo»: escucha y compara con la palabra (tolerante); no entenderla nunca cuenta como fallo */
function stopMic(){ if(LIS){ try{ stopListen(); }catch(e){} } }
function heard(alts, f){
  try{ if(W.vocabReview && typeof vocabReview.matches === "function") return vocabReview.matches(alts, f.say, f.lang); }catch(e){ console.error(e); }
  const n = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const w = n(f.say).replace(/^(the|a|an|le|la|l'|les|un|une|en|et) /, "");
  return (alts || []).some(a => n(a).includes(w));
}
async function dilo(btn){
  if(LIS){ stopMic(); return; }
  const f = ST && ST.f; if(!f) return;
  playTok++; try{ if("speechSynthesis" in W) speechSynthesis.cancel(); }catch(e){}
  LIS = true; btn.classList.add("is-on"); btn.setAttribute("aria-pressed", "true");
  btn.querySelector("span").textContent = "Te escucho…"; msg("");
  let res; try{ res = await listen({lang: LANGS[f.lang].code}); }catch(e){ res = {status: "error", alts: []}; }
  LIS = false;
  if(!btn.isConnected) return;
  btn.classList.remove("is-on"); btn.removeAttribute("aria-pressed"); btn.querySelector("span").textContent = "Dilo";
  if(res.status === "aborted" || ST.f !== f) return;
  if(res.status === "ok" && heard(res.alts, f)){
    msg("¡Muy bien! Lo has dicho genial.", true);
    const card = $("#ph-card"); if(W.M){ M.ok(card, {haptic: true}); M.burst(btn, {colors: SPARKS, n: 10}); }
    return;
  }
  msg(res.status === "denied" ? "Para hablar, un mayor tiene que dejar usar el micrófono."
    : res.status === "unavailable" ? "Ahora no te puedo oír. Escúchala y dila en voz alta."
    : res.status === "unsupported" ? noVoiceMsg()
    : res.status === "busy" ? "Un momento y prueba otra vez."
    : "No te he oído bien. ¿Probamos otra vez?");
}
/* «Ya la dije en casa»: Puerta de mayores → sello → 5 monedas (una vez al día) */
let stamping = false;
async function stamp(btn){
  if(stamping || stamped()) return repaintCena();
  stamping = true;
  let ok = false;
  try{ ok = typeof W.adultGate === "function" ? await adultGate({reason: DN ? `¿Ha dicho «${DN.text}» (${DN.es.replace(/\.$/, "")}) en casa? Resuelve la cuenta para darle su sello.` : "¿Ha dicho la frase de la cena en casa? Resuelve la cuenta para darle su sello.", from: btn}) : false; }catch(e){ console.error(e); }
  try{
    if(!ok || !addStamp()){ repaintCena(); return; }
    repaintCena(); refreshHoy(); repaintNext();
    const seal = $("#ph-done .ph-seal");
    if(seal){
      if(W.M && !M.rm() && seal.animate) seal.animate([{scale: 2.6, rotate: "-24deg", opacity: 0}, {scale: .9, rotate: "-6deg", opacity: 1, offset: .7}, {scale: 1, rotate: "-8deg", opacity: 1}],
        {duration: 520, easing: "cubic-bezier(.3,.8,.3,1)"});
      setTimeout(() => { if(W.M && seal.isConnected) M.burst(seal, {colors: SPARKS, n: 16}); }, W.M && M.rm() ? 0 : 360);
    }
    award(COINS, "Frase de la cena", false, seal || btn);
    const sn = $("#ph-sn"); if(sn && W.M) M.bump(sn);
  } finally { stamping = false; }
}
/* la cápsula de volver: a Hoy si se entró desde Hoy, si no a Juegos */
function back(){
  const f = typeof ROUTE_FROM === "string" ? ROUTE_FROM : null;
  if(f !== null && secOf(f) !== "frases") ORIGIN = f === "" ? "hoy" : "juegos";
  const o = ORIGIN || (secOf(hashPathNow()) === "frases" && hashPathNow().startsWith("frases/cena") ? "hoy" : "juegos");
  return o === "hoy" ? {h: "#/", t: "Hoy"} : {h: "#/juegos", t: "Juegos"};
}
const hashPathNow = () => location.hash.replace(/^#\/?/, "").split("?")[0];

ROUTES["frases"] = async parts => {
  css();
  const my = ++NAV, L = lang, cena = parts[0] === "cena";
  stopMic();
  try{ await ready(); }
  catch(e){ console.error(e); if(my === NAV){ $("#app").innerHTML = errHtml(); const r = $("#ph-retry"); if(r) r.addEventListener("click", () => navTo(location.hash || "#/frases")); } return; }
  if(cena){
    const dn = await dinner(L);
    if(my !== NAV) return;
    if(dn){
      DN = dn;
      ST = {mode: "cena", lang: L, tpl: dn.tpl, choices: [dn], placed: 0, f: dn};
      paint();
      return;
    }
  }
  /* al volver con Atrás, la misma frase de antes */
  const keep = ROUTE_RESTORE && ST && ST.mode === "play" && ST.lang === L && tplOf(L, ST.tpl);
  const [dn, t] = await Promise.all([dinner(L).catch(e => { console.error(e); return null; }), keep ? null : pickTemplate(L, ST && ST.tpl)]);
  if(my !== NAV) return;
  DN = dn;
  if(!keep){
    const ch = t ? await pickChoices(L, t) : [];
    if(my !== NAV) return;
    if(!t || !ch.length){ $("#app").innerHTML = errHtml(); const r = $("#ph-retry"); if(r) r.addEventListener("click", () => navTo("#/frases")); return; }
    ST = {mode: "play", lang: L, tpl: t.id, choices: ch, placed: -1, f: null};
  }
  paint();
};

/* ---------- Hoy: «La frase de la cena» ---------- */
let HOY = null;
function rowHtml(f){
  const done = stamped();
  return `<div class="card hm-row ph-hrow" id="ph-hrow">
    <a class="ph-hgo" href="#/frases/cena">
      <span class="hm-ric${done ? " gold" : ""}" aria-hidden="true">${ico(done ? "seal-check" : "chat-circle-text", done ? "fill" : "bold", 18)}</span>
      <span class="hm-rt">La frase de la cena${done ? '<span class="vh">. Ya tiene su sello.</span>' : ""}<small lang="${esc(LANGS[f.lang].code)}">${esc(f.text)}</small></span></a>
    <button type="button" class="ph-say1 ph-hsay" id="ph-hsay" aria-label="Escuchar la frase de la cena">${ico("speaker-high", "fill", 20)}</button></div>`;
}
async function homeSlot(){
  css();
  await ready();
  const f = await dinner(lang, {fallback: false});
  if(!f) return null;
  HOY = f;
  return rowHtml(f);
}
homeSlot.id = "phrase";
function refreshHoy(){
  const r = $("#ph-hrow"); if(!r || !HOY) return;
  r.outerHTML = rowHtml(HOY);
}
/* Hoy sin scroll: esta fila es la última en ceder. Si Hoy no cabe (en un móvil, con «Repasar N» y otra fila encima),
   se esconde en esa visita; al cambiar el tamaño de la ventana o al cargar la letra se vuelve a mirar. */
function fitHoy(){
  const r = $("#ph-hrow"), box = r && r.closest(".hm-slot"); if(!box || hashPathNow() !== "") return;
  box.hidden = false;
  if(DOC.documentElement.scrollHeight > innerHeight + 1) box.hidden = true;
}
let fitT = 0;
W.addEventListener("resize", () => { clearTimeout(fitT); fitT = setTimeout(fitHoy, 160); });
try{ if(DOC.fonts && DOC.fonts.ready) DOC.fonts.ready.then(fitHoy, () => {}); }catch(e){}
/* el altavoz de la fila (delegado: la fila se pinta de nuevo con cada visita a Hoy) */
DOC.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("#ph-hsay"); if(!b) return;
  e.preventDefault(); e.stopPropagation();
  if(HOY) play(HOY, false, btnUI(b));
});

/* ---------- conexión con la app ---------- */
try{ if(typeof HOME_SLOTS !== "undefined") HOME_SLOTS.push(homeSlot); }catch(e){ console.error(e); }
try{
  const T = TABS.find(t => t.id === "jugar");
  if(T){
    if(!T.secs.includes("frases")) T.secs.push("frases");
    const s = (T.segs || []).find(x => x.h === "#/juegos"); if(s && !s.secs.includes("frases")) s.secs.push("frases");
  }
}catch(e){ console.error(e); }
try{
  if(W.vocabGames && typeof vocabGames.register === "function")
    vocabGames.register("frases", {t: "Frases mágicas", sub: "Crea frases con tus palabras", img: IMG, href: "#/frases",
      line: () => { const n = stamps().n; return n ? `Tus sellos: ${n}` : "La frase de la cena"; }});
}catch(e){ console.error(e); }
bus.on("lang", () => { HOY = null; if(ST && ST.lang !== lang){ ST = null; DN = null; } });
bus.on("route", () => { if(secOf(hashPathNow()) !== "frases"){ stopMic(); playTok++; } if(hashPathNow() === "") fitHoy(); });
bus.on("acc", () => { if(hashPathNow() === "") fitHoy(); });   /* el accesorio «Seguir» sale o se va tras "route" */

W.vocabPhrases = {
  ready, data: () => DATA, templates: L => tpls(L || lang), fill, cands, dinner: (L, o) => dinner(L || lang, o || {}),
  play: (f, slow) => play(f, !!slow), stamps, stamped, back,
  state: () => ST ? {mode: ST.mode, lang: ST.lang, tpl: ST.tpl, placed: ST.placed, text: ST.f ? ST.f.text : null, es: ST.f ? ST.f.es : null,
    choices: ST.choices.map(f => ({ref: f.ref, core: f.core, text: f.text}))} : null,
};
})();
