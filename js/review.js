/* Módulo review (window.vocabReview): Aprender › Repasar (#/repaso), el repaso espaciado con tarjetas y «Dilo primero».
   · #/repaso empieza directamente si hay palabras pendientes (dueList()), en modo foco (html[data-focus=repaso]): arriba
     la barra de progreso junto a la ✕ y el contador de monedas; la ✕ (y Esc) abre la hoja «¿Paramos aquí?» (Seguir ·
     Salir). Salir a medias deja el repaso abierto (rv, en index.html): el accesorio «Seguir · Repaso» lo retoma.
   · Repasos cortos: 20 tarjetas como mucho, primero las que llevan más tiempo esperando y, entre ellas, las de caja más
     baja (las del mismo día y caja, mezcladas). El final ofrece «Otra tanda (N más)» si quedan pendientes.
   · La app corrige, no el niño (los niños creen saber más de lo que saben): la tarjeta depende de la caja.
     - Caja 0: «Escucha y elige» (suena la palabra; 4 dibujos). Caja 1 (o sin dibujos ni voz): «¿Cuál es en inglés?»
       (el dibujo y el español; 4 palabras del idioma, con el mismo artículo si puede ser y nunca dos buenas).
     - Cajas 2 y 3: las letras («Escríbela en inglés»: el artículo ya puesto, huecos y fichas con sus letras, acentos y
       æøå incluidos, más 1 o 2 de sobra; se toca la que sigue). «Pista» pone la siguiente (2 como mucho).
     - Caja 4 o más: la tarjeta de siempre (abajo), con «Dilo» si hay micrófono. Si la última nota de esa palabra la puso
       el niño (x.s), esta vez la corrige la app con las letras (o «¿Cuál es…?»).
     Nota de lo que corrige la app: 2 a la primera, 1 con pista o a la segunda (una letra mal), 0 mal (la elegida o la
     segunda letra mal, en gris con ✗): entonces, a la vez, el dibujo, la palabra, su IPA y su audio, y «Seguir». Bien:
     verde con ✓, suena, la IPA y pasa sola tras el audio (nunca antes de 0,9 s). Monedas = la nota.
     Como la tarjeta: la palabra nunca se parte (las opciones bajan de tamaño juntas, fitOpts) y nada hace bajar la
     página, tampoco la respuesta al contestar (ceden los márgenes y, ya contestada, lo que ya no se toca; solo luego
     encoge el dibujo, que nunca se va; fitRoom). Teclas: 1-4 eligen (su número, dentro de cada opción), las letras
     ponen fichas, Espacio y Mayús+Espacio la oyen (sin contestar, solo en «Escucha y elige»), Intro «Seguir».
   · Una fallada (de cualquier tipo) vuelve 3 a 5 tarjetas después, una sola vez; esa vuelta vale 1 como mucho y, si se
     vuelve a fallar, ya no baja más de caja (srsGrade con again) y vuelve mañana.
   · Pila de tarjetas (detrás asoman las 2 siguientes). Cara de la pregunta: el dibujo (o, si no hay, la palabra en
     español en grande), la palabra en español, «¿Cómo se dice en inglés?» y «Toca para ver» (sin micrófono, «Piénsala… y
     toca para ver»). Abajo, siempre, el botón principal «Ver» (como tocar la tarjeta, Espacio o Intro: la gira en 3D,
     350 ms, sin quitar puntos) y una fila con «Dilo en inglés» (solo con micrófono) y «Pista». Cara de la respuesta: la
     palabra en el idioma, su IPA justo debajo (ipaHtml() de index.html: se ve salvo que un mayor la apague; en la cara
     de la pregunta y en las pistas no, que diría la respuesta), su traducción y el altavoz con la tortuga; debajo «¿La
     sabías?» con «No» (gris) y «¡Sí!» (verde). Deslizar la tarjeta girada a la derecha = Sí, a la izquierda = No: sigue
     al dedo, se inclina hasta ±8°, se tiñe de verde o de gris con el sello en una esquina y sale volando; la siguiente
     sube de la pila. Teclas: Espacio (girar / oír; Mayús+Espacio despacio), ← No, → Sí, Esc «¿Paramos aquí?». La pista
     «Desliza: sí o no» (G.hint) sale la segunda vez que se gira una tarjeta para decidir.
   · Nota de la tarjeta (srsGrade con self: la puso él): «No» = 0; «¡Sí!» = 2 si no pidió pista y giró en 8 s como mucho
     (sin contar el rato escuchando, con la hoja abierta o con la app escondida); si no, 1. Una tarjeta con 0 vuelve 3 a 5
     tarjetas después; esa segunda vez (acaba de ver la respuesta) vale 1 como mucho. Lo que puntúa él da 1 moneda por
     terminar la tarjeta, diga «No» o «¡Sí!» (award(1, "", true)); dicha bien con el micrófono la corrige la app (nota y
     monedas 2 o 1).
   · «Pista» por escalones (Dilo primero): 1) el artículo y la primera letra («le c…», «en h…», «l'o…»; sin artículo,
     «o…»), 2) la primera sílaba y huecos para lo que falta («le che _ _ _», «os _ _ _ _ _»), 3) «Ver». Cada escalón se
     queda en la tarjeta; con los dos, «Pista» se va (queda «Ver»).
   · Dilo primero, solo si canListen() y hay internet (no en la app instalada del iPhone): «Dilo en inglés» escucha con
     listen() (7 s como mucho) en el idioma de la palabra y compara sin mayúsculas, tildes, signos ni artículo, con todas
     las alternativas del reconocedor: exacta hasta 4 letras, una letra de diferencia de 5 a 7 y dos desde 8, empezando
     por la misma letra; nunca vale otra palabra de verdad de los temas cargados («bat» por «cat», «horse» por «house»).
     Si acierta: gira con ✓ verde, «La dijiste bien», nota 2 (1 si pidió pista) y pasa sola tras el audio (nunca antes de 0,9 s); si se va
     del repaso mientras tanto, la nota se escribe igual. Si no coincide: «No te he oído bien», «Otra vez» y «No me
     sale»; a la segunda, se va el micrófono y «¡No pasa nada! Mírala y dime si la sabías.»; nunca pone 0 porque falle el
     reconocedor. Sin internet, sin micrófono o sin permiso, lo dice una vez («Sin internet no puedo oírte…») y el
     micrófono se va. «No me sale» gira, suena y dice «Así se dice. ¡La verás otra vez!» con un solo «Seguir» (nota 0).
   · Final en una tarjeta: «¡Repasaste N palabras!», las monedas (el chip lleva el total y de él vuelan las 10 del
     final: award(10, "", false, from), una sola vez y sin aviso), racha, «Seguir» (siempre a Hoy; no responde hasta
     0,6 s después de salir, para que un doble toque no se lo salte) y, si quedan pendientes, «Otra tanda (N más)» (otro
     repaso de 20 como mucho; es opcional: «Seguir» es lo principal). bus "review-card" {grade, es, word, self} por
     tarjeta y "review-done" {n} al terminar, como antes.
   · Al abrir el repaso: las pendientes cuyo tema se abrió pero ya no tiene su palabra (o cuyo tema ya no existe) se
     quitan del repaso (srsDrop). Las de temas que no se pueden abrir sin conexión no cuentan (SRS_OFF de index.html,
     también en la insignia) y, si no queda ninguna, «Sin conexión» con «Probar otra vez».
   · Sin pendientes: el zorro, «Todo repasado», cuándo vuelven y «Aprender nuevas» (la siguiente lección del camino).
   window.vocabReview = {state, exit(from) → true si se encargó de la ✕, open() → hay un repaso a medias,
     hints(word, lang) → [paso 1, paso 2], matches(alts, word, lang) → boolean, grade(yes, card) → 0 | 1 | 2,
     kindOf(fila, entrada) → "listen" | "pick" | "spell" | "card", spellOf(word, lang), CAP}
   Usa de index.html: rv (estado global), dueList, srsAll, srsK, srsGrade, srsDrop, SRS_OFF, getDoc, getIndex, CACHE,
   shuffle, award, streak, heroHtml, say, sayP, autoTok, updFocus, navTo, canListen, listen, recNow, nextLesson,
   fitWord, ttsMute, ipaHtml, lang, LANGS; de js/lesson.js, vocabLesson.syllables (las pistas). Iconos: Phosphor. */
(() => {
"use strict";
const W = window, DOC = document;
const THINK_MS = 8000;     /* girarla antes de 8 s y sin pista: «¡Sí!» vale 2 */
const AFTER_OK_MS = 900;   /* tras decirla bien, la tarjeta no se va antes de 0,9 s */
const CAP = 20;            /* un repaso: 20 tarjetas como mucho */
const BACK = [3, 5];       /* una fallada vuelve tras 3 a 5 tarjetas, una vez */
const SPELL = [2, 12];     /* las letras: palabras de 2 a 12 letras */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rm = () => !!(W.M && typeof W.M.rm === "function" && W.M.rm());
const clock = () => Date.now();
const wait = ms => new Promise(r => setTimeout(r, ms));
const onRepaso = () => hashPath().split("/")[0] === "repaso";
const code = () => LANGS[lang].code;
const nPals = n => n === 1 ? "1 palabra" : `${n} palabras`;
const COIN = `<svg class="coin-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="11" fill="#FFCC00"/><circle cx="12" cy="12" r="10.5" fill="none" stroke="#C7A000" stroke-opacity=".8"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#B39000" stroke-opacity=".55" stroke-width="1.4"/><path d="M12 7.8 13.06 10.54 15.99 10.7 13.71 12.56 14.47 15.4 12 13.8 9.53 15.4 10.29 12.56 8.01 10.7 10.94 10.54Z" fill="#A88700" fill-opacity=".8"/></svg>`;
const CHK = `<svg class="chk" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ---------- pistas (Dilo primero) ---------- */
const ARTS = {english: ["the", "a", "an", "to"], "français": ["le", "la", "les", "un", "une", "des"], dansk: ["en", "et", "at"]};
/* la forma que se pista: la primera de «a / b», sin «(m.)» ni otros paréntesis */
const mainForm = w => String(w || "").split(/\s\/\s/)[0].replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
const isL = ch => /\p{L}/u.test(ch);
function splitArt(w, l){
  const m = /^(l['’])(.+)$/i.exec(w);
  if(l === "français" && m) return {art: m[1], rest: m[2].trim(), elided: true};
  const sp = w.indexOf(" ");
  if(sp > 0 && (ARTS[l] || []).includes(w.slice(0, sp).toLowerCase())) return {art: w.slice(0, sp), rest: w.slice(sp + 1).trim(), elided: false};
  return {art: "", rest: w, elided: false};
}
/* el principio de una palabra para el paso 2: su primera sílaba (vocabLesson.syllables) y huecos para el resto
   («che _ _ _», «os _ _ _ _ _»). Siempre quedan 2 letras ocultas como poco: si la sílaba es casi toda la palabra
   («dog», «horse»), solo las 1-3 primeras letras («d _ _», «hor _ _»). */
function lead(wd, l){
  const L = [...wd].filter(isL).length, cap = Math.max(1, L - 2);
  let n = 0;
  try{
    const sy = W.vocabLesson && typeof W.vocabLesson.syllables === "function" ? W.vocabLesson.syllables(wd, (LANGS[l] || LANGS[lang]).code) : null;
    n = [...((sy && sy[0] && sy[0][0]) || "")].filter(isL).length;
  }catch(e){ n = 0; }
  if(!n || n > cap) n = Math.max(1, Math.min(3, cap));
  let shown = 0, head = "";
  const tail = [];
  for(const ch of wd){
    if(shown < n){ head += ch; if(isL(ch)) shown++; }
    else tail.push(isL(ch) ? "_" : ch);
  }
  return tail.length ? head + " " + tail.join(" ") : head;
}
/* [paso 1, paso 2]: «le c…» y «le che _ _ _»; sin artículo «o…» y «os _ _ _ _ _»; con l' «l'o…» y «l'oi _ _ _ _» */
function hints(word, l = lang){
  const w = mainForm(word);
  if(!w) return ["…", "…"];
  let {art, rest, elided} = splitArt(w, l);
  if(!rest){ rest = art; art = ""; elided = false; }
  const chars = [...rest], k = chars.findIndex(isL), sep = art && !elided ? " " : "";
  const h1 = art + sep + chars.slice(0, k + 1).join("") + "…";
  const pat = rest.split(" ").filter(Boolean).map((wd, i) => {
    if(i === 0) return lead(wd, l);
    let shown = false; return [...wd].map(ch => !isL(ch) ? ch : shown ? "_" : (shown = true, ch)).join(" ");
  }).join("   ");
  return [h1, art + sep + pat];
}

/* ---------- comparar lo que oyó el reconocedor ---------- */
const fold = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/ø/g, "o").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/ß/g, "ss").replace(/[’`´]/g, "'")
  .replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim();
function dropArt(s, l){
  let t = l === "français" ? s.replace(/^l' ?/, "") : s;
  const w = t.split(" ");
  if(w.length > 1 && (ARTS[l] || []).includes(w[0])) t = w.slice(1).join(" ");
  return t;
}
const compact = s => s.replace(/['\s]/g, "");
function lev(a, b){
  if(a === b) return 0;
  if(!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({length: b.length + 1}, (_, j) => j);
  for(let i = 1; i <= a.length; i++){
    const cur = [i];
    for(let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
/* cuánto se perdona según el largo (el más corto de los dos): hasta 4 letras, nada; de 5 a 7, una letra; desde 8, dos */
const maxD = n => n <= 4 ? 0 : n <= 7 ? 1 : 2;
/* las formas de una palabra («a / b», «x, y», sin paréntesis), plegadas y con y sin artículo */
function forms(word, l){
  const out = [];
  for(const t0 of String(word || "").replace(/\([^)]*\)/g, "").split(/\s\/\s|,\s*/)){
    const f = fold(t0); if(f) out.push({f, bare: dropArt(f, l)});
  }
  return out;
}
/* las palabras de verdad del idioma en los temas ya cargados (CACHE): si lo que oyó es una de ellas y no es la que se
   pregunta, es otra palabra («bat» por «cat», «horse» por «house»), no una forma de decirla */
let KNOWN = {k: "", set: null};
function knownWords(l){
  const docs = typeof CACHE === "object" && CACHE ? Object.values(CACHE) : [];
  const k = l + "|" + docs.length;
  if(KNOWN.k === k && KNOWN.set) return KNOWN.set;
  const set = new Set();
  for(const d of docs) for(const r of (d && Array.isArray(d.rows) ? d.rows : [])){
    const x = r && r.l && r.l[l]; if(!x || !x.word) continue;
    for(const {f, bare} of forms(x.word, l)){ set.add(compact(f)); set.add(compact(bare)); }
  }
  KNOWN = {k, set};
  return set;
}
/* casi igual: con alguna letra de diferencia solo si empiezan igual y no es corta (dig no es dog) */
function near(c, t){
  if(c === t) return true;
  const d = maxD(Math.min(c.length, t.length));
  return d > 0 && c[0] === t[0] && lev(c, t) <= d;
}
/* ¿alguna de las alternativas del reconocedor es la palabra? (también dentro de una frase: «it's a dog») */
function matches(alts, word, l = lang){
  const targets = forms(word, l).map(({f, bare}) => ({full: compact(f), bare: compact(bare), n: Math.max(1, bare.split(" ").length)}));
  if(!targets.length) return false;
  const own = new Set(targets.flatMap(t => [t.full, t.bare])), known = knownWords(l);
  for(const a of alts || []){
    const A = fold(a); if(!A) continue;
    const ws = A.split(" "), cands = new Set([compact(A), compact(dropArt(A, l))]);
    for(const t of targets)
      for(let k = t.n; k <= t.n + 2; k++)
        for(let i = 0; i + k <= ws.length; i++) cands.add(compact(ws.slice(i, i + k).join(" ")));
    for(const c of cands){
      if(!c) continue;
      if(own.has(c)) return true;
      if(known.has(c)) continue;
      for(const t of targets) for(const x of [t.bare, t.full])
        if(x && c.length >= Math.min(3, x.length) && near(c, x)) return true;
    }
  }
  return false;
}

/* ---------- la nota ---------- */
/* again: la tarjeta vuelve tras un «No» en este mismo repaso (acaba de ver la respuesta): 1 como mucho */
function grade(yes, c){
  if(!yes) return 0;
  if(c && c.again) return 1;
  if(c && c.said) return c.hinted ? 1 : 2;
  return !c || c.hinted || c.thinkMs > THINK_MS ? 1 : 2;
}
/* una tarjeta en pantalla; las que corrige la app llevan además: pick (la opción elegida), put (letras puestas), bad
   (letras mal), used (fichas usadas), graded y g (su nota, ya escrita) */
const newCard = it => ({flip: false, hint: 0, hinted: false, gaveUp: false, said: false, decided: false, mic: "idle", msg: "", miss: 0,
  again: !!(it && it.again), t0: clock(), paused: 0, pz: new Set(), pauseAt: 0, thinkMs: 0,
  kind: (it && it.kind) || "card", pick: -1, put: 0, bad: 0, used: new Set(), graded: false, g: null});
/* el tiempo pensando no cuenta mientras escucha el micrófono, con la hoja abierta o con la app escondida */
function pauseT(c, why, on){
  if(!c || c.flip) return;
  const was = c.pz.size > 0;
  if(on) c.pz.add(why); else c.pz.delete(why);
  const now = c.pz.size > 0;
  if(now && !was) c.pauseAt = clock();
  else if(!now && was){ c.paused += clock() - c.pauseAt; c.pauseAt = 0; }
}
const thinkMs = c => clock() - c.t0 - c.paused - (c.pauseAt ? clock() - c.pauseAt : 0);

/* ---------- las tarjetas que corrige la app ---------- */
/* el español sin lo de entre paréntesis y solo lo primero («mañana (el día siguiente)» → «mañana», «español, española»
   → «español»): dos opciones con el mismo serían dos buenas */
const esBase = s => fold(String(s || "").replace(/\([^)]*\)/g, "").split(/[,;/]/)[0]);
const wBase = w => fold(mainForm(w));
/* las letras: {art, sep, chars} (el artículo va puesto; espacios, guiones y apóstrofos ya en su sitio) o null */
function spellOf(word, l = lang){
  const w = mainForm(word); if(!w) return null;
  const {art, rest, elided} = splitArt(w, l), chars = [...rest.normalize("NFC")], n = chars.filter(isL).length;
  if(n < SPELL[0] || n > SPELL[1] || chars.some(ch => !isL(ch) && !/[\s'’-]/.test(ch))) return null;
  return {art, sep: art && !elided ? " " : "", chars};
}
const canHear = () => !(typeof ttsMute === "function" && ttsMute(lang)) && ("speechSynthesis" in W || typeof say === "function");
/* qué tarjeta toca según la caja (x: su entrada del repaso) */
function kindOf(r, x){
  const b = +(x && x.b) || 0, d = r && r.l && r.l[lang];
  if(!d || !d.word) return "card";
  if(b >= 4 && !(x && x.s)) return "card";
  if(b >= 2) return spellOf(d.word) ? "spell" : "pick";
  return b === 0 && r.img && canHear() ? "listen" : "pick";
}
const ALPHA = {english: "abcdefghijklmnopqrstuvwxyz", "français": "abcdefghijklmnopqrstuvwxyzéèàç", dansk: "abcdefghijklmnopqrstuvwxyzæøå"};
const VOWELS = "aeiouyéèàæøå";
/* las fichas: las letras de la palabra y 1 o 2 de sobra (una vocal y una consonante que no están), nunca en orden */
function tilesFor(sp){
  const L = sp.chars.filter(isL), have = new Set(L.map(c => c.toLowerCase()));
  const free = [...(ALPHA[lang] || ALPHA.english)].filter(c => !have.has(c));
  const vw = shuffle(free.filter(c => VOWELS.includes(c))), cs = shuffle(free.filter(c => !VOWELS.includes(c)));
  const extra = (L.length <= 5 ? [vw[0], cs[0]] : [shuffle([vw[0], cs[0]].filter(Boolean))[0]]).filter(Boolean);
  const all = [...L.map(c => ({c})), ...extra.map(c => ({c, x: true}))];
  for(let k = 0; k < 8; k++){ const t = shuffle(all.slice()); if(t.slice(0, L.length).map(x => x.c).join("") !== L.join("")) return t; }
  return all.reverse();
}
/* el artículo de una palabra (para que las otras opciones lleven el mismo en francés y danés) */
const artOf = w => { const s = splitArt(mainForm(w), lang); return s.art ? s.art.toLowerCase() : ""; };
/* 4 opciones (la buena y 3 de su tema; si faltan, de los otros temas del repaso): ninguna dice lo mismo en el idioma ni
   en español; con dibujo (y dibujos distintos) para «Escucha y elige». null si no hay 3 */
function optsFor(it, kind, docs){
  const R = it.r, me = R.l[lang], W0 = wBase(me.word), E0 = esBase(R.es), A0 = artOf(me.word), pic = kind === "listen";
  const sw = new Set([W0]), se = new Set([E0]), si = new Set([R.img]), out = [];
  const take = rows => {
    const ok = shuffle(rows.filter(r => r && r !== R && r.es && r.l && r.l[lang] && r.l[lang].word && (!pic || r.img)));
    /* primero las del mismo artículo (en francés y danés no se adivina por «la» o «et») */
    if(lang !== "english" && A0) ok.sort((a, b) => (artOf(b.l[lang].word) === A0) - (artOf(a.l[lang].word) === A0));
    for(const r of ok){
      if(out.length >= 3) return;
      const w = wBase(r.l[lang].word), e = esBase(r.es);
      if(!w || !e || sw.has(w) || se.has(e) || (pic && si.has(r.img))) continue;
      sw.add(w); se.add(e); if(r.img) si.add(r.img); out.push(r);
    }
  };
  take((CACHE[it.id] && CACHE[it.id].rows) || []);
  for(const d of docs || []) if(out.length < 3 && d !== it.id && CACHE[d]) take(CACHE[d].rows || []);
  return out.length < 3 ? null : shuffle([R, ...out]);
}
/* la tarjeta que toca, con lo que necesita (opciones o fichas); si no se puede, la siguiente que sí */
function prep(it, docs){
  let k = it.kind || kindOf(it.r, it.x);
  if(k === "listen" && !(it.opts = optsFor(it, "listen", docs))) k = "pick";
  if(k === "pick" && !(it.opts = optsFor(it, "pick", docs))){
    const sp = spellOf(it.r.l[lang].word);
    k = sp ? "spell" : "card";
  }
  if(k === "spell"){ it.sp = spellOf(it.r.l[lang].word); if(!it.sp) k = "card"; else it.tiles = tilesFor(it.sp); }
  it.kind = k;
  return it;
}

/* ---------- estilos ---------- */
const DARK = (s, b) => `:root[data-theme=dark] ${s}{${b}}`;
const STYLE = `
html[data-focus=repaso] #app{overflow-x:hidden;overflow-x:clip}   /* la tarjeta que se arrastra no ensancha la página */
.rv{position:relative;display:flex;flex-direction:column;width:min(100%,560px);margin:0 auto;
  min-height:calc(100vh - var(--bar-top) - var(--tap) - 12px - var(--safe-b) - 32px);min-height:calc(100svh - var(--bar-top) - var(--tap) - 12px - var(--safe-b) - 32px)}
/* la barra va entre la ✕ y las monedas, en la misma columna que la tarjeta (como en la lección) */
.rv-top{position:fixed;z-index:var(--z-bar);top:var(--bar-top);left:calc(max(16px,var(--safe-l),calc(50% - 280px)) + 56px);right:calc(max(16px,var(--safe-r),calc(50% - 280px)) + 92px);
  height:var(--tap);display:flex;align-items:center;pointer-events:none}
.rv-prog{flex:1;height:12px;border-radius:6px;background:var(--fill);overflow:hidden}
.rv-prog i{display:block;height:100%;width:0;border-radius:6px;background:var(--teal);transition:width var(--d-slow,420ms) var(--sp-snappy,cubic-bezier(.2,.9,.25,1))}
.rv-stage{flex:1 1 auto;display:flex;flex-direction:column;justify-content:center;min-height:0;padding:4px 0 32px}
/* la tarjeta crece hasta 470 px y encoge hasta 220 px: en un móvil bajo (375×667) el dock cabe sin hacer scroll */
.rv-stack{position:relative;flex:1 1 auto;max-height:470px;min-height:220px;display:flex}
/* detrás asoman las siguientes tarjetas (blancas, con su sombra), no rectángulos grises */
.rv-back{position:absolute;top:0;border-radius:var(--r-card);pointer-events:none;background:var(--card);box-shadow:0 1px 2px rgba(0,0,0,.05),0 6px 16px rgba(0,0,0,.06)}
.rv-back.b1{left:12px;right:12px;bottom:-8px}
.rv-back.b2{left:24px;right:24px;bottom:-16px;opacity:.6}
${DARK(".rv-back", "box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)")}
.rv-card{position:relative;flex:1;display:flex;perspective:1400px;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:pan-y}
.rv-flip{position:relative;flex:1;display:grid;transform-style:preserve-3d;transition:transform 350ms cubic-bezier(.3,.7,.2,1)}
.rv-card.is-flipped .rv-flip{transform:rotateY(180deg)}
.rv-face{grid-area:1/1;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;padding:24px 20px;
  text-align:center;color:var(--label);background:var(--card);border-radius:var(--r-card);box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 28px rgba(0,0,0,.07);
  -webkit-backface-visibility:hidden;backface-visibility:hidden;overflow:hidden}
${DARK(".rv-face", "box-shadow:none")}
.rv-q{cursor:pointer;-webkit-tap-highlight-color:transparent}
.rv-q:focus-visible{outline:3px solid var(--brand-tint);outline-offset:3px}
.rv-a{transform:rotateY(180deg)}
.rv-picw{display:flex;align-items:center;justify-content:center;flex:0 1 auto;min-height:0;align-self:stretch}
/* el dibujo, un cuadrado que crece con la tarjeta y con el alto de la pantalla (el 70 % se cuenta sobre la tarjeta:
   .rv-picw va a lo ancho); en oscuro, el fondo claro con un margen corto */
.rv-pic{display:block;width:min(200px,70%,24vh);width:min(200px,70%,24svh);aspect-ratio:1;height:auto;object-fit:contain;-webkit-user-drag:none}
${DARK(".rv-pic", "background:#F2F2F7;border-radius:var(--r-md);padding:4px")}
.rv-es{margin:12px 0 0;font:700 var(--fs-t1)/1.2 var(--f-round);overflow-wrap:anywhere;text-wrap:balance}
.rv-es.big{margin:0;font-size:var(--fs-word);line-height:1.15}
.rv-qq{margin:8px 0 0;color:var(--label2);font:600 var(--fs-body)/1.25 var(--f-text);text-wrap:balance}
.rv-hints{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:12px}
.rv-hints:empty{display:none}
/* las pistas se leen, no se tocan: gris claro con el color del texto (no el azul de «se puede tocar») */
.rv-h{margin:0;max-width:100%;padding:4px 12px;border-radius:var(--r-sm);background:var(--fill2);color:var(--label);
  font:700 var(--fs-t3)/1.25 var(--f-round);letter-spacing:.02em;white-space:pre-wrap;overflow-wrap:anywhere;animation:rv-in .32s var(--sp-snappy,ease-out) 1 both}
.rv-tap{display:flex;align-items:center;gap:8px;margin:16px 0 0;color:var(--label2);font:400 var(--fs-sub)/1.2 var(--f-text);white-space:nowrap}
.rv-tap .ico{color:var(--brand-tint)}
.rv-word{margin:12px 0 0;max-width:100%;font:700 var(--fs-word)/1.15 var(--f-round);overflow-wrap:anywhere;-webkit-hyphens:auto;hyphens:auto;text-wrap:balance;outline:none}
.rv-tr{margin:2px 0 0;color:var(--label2);font:400 var(--fs-body)/1.3 var(--f-text)}
.rv-ipa{margin:2px 0 0;max-width:100%;font-size:var(--fs-sub);line-height:1.3;overflow-wrap:anywhere}
.rv-audio{display:flex;align-items:center;gap:16px;margin-top:20px}
.rv-spk,.rv-slow{position:relative;display:grid;place-items:center;padding:0;border:0;border-radius:50%;cursor:pointer;-webkit-tap-highlight-color:transparent;
  transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms)}
.rv-spk{width:64px;height:64px;background:var(--brand-soft);color:var(--brand-tint)}
.rv-slow{width:48px;height:48px;background:var(--fill2);color:var(--label)}
/* sonando: como en la lección (azul relleno y una onda que sale) */
.rv-spk.playing,.rv-slow.playing{background:var(--brand-fill);color:#fff}
.rv-spk.playing::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:3px solid var(--brand-tint);opacity:0;animation:rv-wave .9s ease-out 3;pointer-events:none}
.rv-said{position:absolute;top:16px;right:16px;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--ok-fill);color:#fff}
.rv-said[hidden]{display:none}
.rv-tint{position:absolute;inset:0;z-index:2;border-radius:var(--r-card);pointer-events:none;opacity:var(--lean-a,0)}
.rv-card:not(.is-drag) .rv-tint{transition:opacity var(--d-fast,160ms) ease}
.rv-card[data-lean=yes] .rv-tint{background:rgba(52,199,89,.26)}
.rv-card[data-lean=no] .rv-tint{background:rgba(142,142,147,.30)}
/* el sello, en una esquina de arriba (no tapa la palabra): ✓ a la izquierda al ir a la derecha, ✕ a la derecha */
.rv-tint-ic{position:absolute;top:16px;display:none;width:56px;height:56px;border-radius:50%;place-items:center;color:#fff}
.rv-tint-ic.y{left:16px}
.rv-tint-ic.n{right:16px}
.rv-card[data-lean=yes] .rv-tint-ic.y{display:grid;background:var(--ok-fill)}
.rv-card[data-lean=no] .rv-tint-ic.n{display:grid;background:#8E8E93}
.rv-dock{flex:none;min-height:112px;display:flex;flex-direction:column;align-items:center;gap:12px;padding:0 0 4px}
.rv[data-mic] .rv-dock{min-height:150px}
.rv-ask{margin:0;font:700 var(--fs-t2)/1.2 var(--f-round);text-align:center}
.rv-yn{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%}
.rv-yn .glass-btn{width:100%}
.rv-row{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 8px}
.rv-txt{display:inline-flex;align-items:center;gap:8px;min-height:var(--tap);padding:0 12px;border:0;background:none;border-radius:var(--r-pill);
  color:var(--brand-ink);font:600 var(--fs-sub)/1.15 var(--f-text);cursor:pointer;-webkit-tap-highlight-color:transparent}
.rv-txt .ico{color:var(--brand-tint)}
@media (hover:hover){.rv-txt:hover{background:var(--fill2)}}
.rv-msg{margin:0;color:var(--label2);font:600 var(--fs-sub)/1.3 var(--f-text);text-align:center;text-wrap:balance}
.rv-mic .ico{color:var(--brand-tint)}
.rv-mic.is-on{box-shadow:inset 0 1px 0 rgba(255,255,255,.38),0 0 0 6px rgba(30,110,244,.2),0 0 0 12px rgba(30,110,244,.08)}
.rv-good{display:flex;align-items:center;gap:8px;margin:8px 0 0;color:var(--ok-ink);font:700 var(--fs-t2)/1.2 var(--f-round)}
.rv-good .ico{color:var(--ok)}
.rv-good[hidden]{display:none}
.rv-empty{display:flex;flex-direction:column;align-items:center;text-align:center;max-width:440px;margin:0 auto;padding:28px 8px 24px}
.rv-empty-t{margin:16px 0 8px;font:700 var(--fs-t2)/1.2 var(--f-round)}
.rv-empty-p{margin:0 0 24px;color:var(--label2);font:400 var(--fs-sub)/1.35 var(--f-text)}
.rv-end{display:flex;flex-direction:column;align-items:center;text-align:center;width:min(100%,460px);margin:0 auto;padding:16px 0 0;
  min-height:calc(100vh - var(--bar-top) - var(--tap) - 12px - var(--safe-b) - 32px);min-height:calc(100svh - var(--bar-top) - var(--tap) - 12px - var(--safe-b) - 32px)}
.rv-end.pr-end{padding:16px 0 0}
.rv-end-in{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%}
/* el final va en una tarjeta, como el de la lección */
.rv-end-card{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;padding:24px 20px}
.rv-end-t{margin:4px 0;font:700 var(--fs-t1)/1.2 var(--f-round);text-wrap:balance;outline:none}
.rv-stats{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
.rv-chip{display:inline-flex;align-items:center;gap:8px;min-height:var(--tap);padding:0 16px;border-radius:var(--r-pill);background:var(--fill);
  font:800 var(--fs-head)/1 var(--f-round);font-variant-numeric:tabular-nums;color:var(--label)}
.rv-chip.coin{color:var(--gold-ink)}
.rv-chip .ico{color:var(--gold-deep)}
.rv-more:empty{display:none}
.rv-more{justify-content:center}
.rv-more .btn.al-ls{display:inline-flex;align-items:center;gap:8px;min-height:var(--tap);padding:0 16px;border:0;border-radius:var(--r-pill);background:var(--fill);
  color:var(--brand-ink);box-shadow:none;font:600 var(--fs-sub)/1.2 var(--f-text);text-decoration:none}
.rv-more .btn.al-ls .ico{color:var(--gold-deep)}
.rv-end-go{margin-top:24px;max-width:460px}
.rv-fox .hero{animation:rv-hop .7s var(--sp-bouncy,ease-out) .1s 1 both}
dialog#rv-pause{max-width:420px}
dialog#rv-pause.m-sheet.glass{background:var(--card,#fff);-webkit-backdrop-filter:none;backdrop-filter:none}
.rv-pz{display:flex;flex-direction:column;align-items:center;text-align:center;padding:4px 4px 8px}
.rv-pz-ic{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;margin:4px 0 12px;color:var(--brand-tint);background:var(--fill)}
.rv-pz-t{margin:0 0 8px;font:700 var(--fs-t2)/1.2 var(--f-round);color:var(--label)}
.rv-pz-p{margin:0 0 20px;color:var(--label2);font:400 var(--fs-sub)/1.3 var(--f-text)}
.rv-pz-b{display:flex;gap:12px;width:100%;max-width:440px}
.rv-pz-b>*{flex:1}
/* las tarjetas que corrige la app: no giran; la pregunta arriba (en la tarjeta) y lo que se toca abajo */
.rv-tc>.rv-face{flex:1}
.rv-t{cursor:default;outline:none}
.rv-t .rv-word{margin-top:8px}
.rv-t .rv-audio{margin-top:12px}
.rv-ans{display:flex;flex-direction:column;align-items:center;min-width:0;max-width:100%;animation:rv-in .28s var(--sp-snappy,ease-out) 1 both}
.rv[data-kind=listen] .rv-stack{flex:none;min-height:0}
.rv[data-kind=listen] .rv-stage{flex:none;padding-bottom:16px}
.rv[data-kind=listen] .rv-dock{flex:1 1 auto;justify-content:center}
.rv-lis{margin-top:12px}
.rv-opts{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%}
.rv-opts.pics{width:min(100%,46vh);width:min(100%,46svh)}
.rv-opt{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;min-width:0;min-height:64px;padding:8px 12px;border:0;
  border-radius:20px;background:var(--card);color:var(--label);font:700 var(--fs-t2)/1.15 var(--f-round);text-align:center;overflow-wrap:anywhere;
  -webkit-hyphens:auto;hyphens:auto;cursor:pointer;-webkit-tap-highlight-color:transparent;box-shadow:0 1px 2px rgba(0,0,0,.05),0 4px 14px rgba(0,0,0,.07);
  transition:background-color var(--d-fast,160ms),color var(--d-fast,160ms),box-shadow var(--d-fast,160ms)}
${DARK(".rv-opt", "box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)")}
.rv-opt:focus-visible,.rv-tile:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.rv-opt:disabled{cursor:default}
.rv-opt.is-dim{color:var(--label2)}
.rv-opt.is-ok{background:var(--ok-fill);color:#fff;box-shadow:none}
.rv-opt.is-miss{background:var(--miss-fill);color:var(--miss-on);box-shadow:none}
.rv-opt .chk{flex:none;width:24px;height:24px}
.rv-opt .xm{flex:none;color:var(--miss)}
/* una palabra nunca se parte (como en la lección, fitOpts): si no cabe, la marca va encima y las 4 bajan de tamaño
   juntas; solo si ni así cabe, se parte */
.rv-opt>span{display:block;min-width:0;max-width:100%;overflow-wrap:normal;word-break:normal;-webkit-hyphens:manual;hyphens:manual}
.rv-opts.is-long .rv-opt{font-size:var(--fs-head)}
.rv-opts.is-xlong .rv-opt{font-size:var(--fs-sub)}
.rv-opts.is-break .rv-opt>span{overflow-wrap:anywhere;-webkit-hyphens:auto;hyphens:auto}
.rv-opt.is-stack{flex-direction:column;gap:2px;padding-top:6px;padding-bottom:6px}
.rv-opt.is-stack .chk,.rv-opt.is-stack .xm{width:20px;height:20px}
/* con el teclado, si una palabra llegaría al número de su esquina (fitOpts), las 4 la llevan debajo de él: centrada, sin
   encoger ni partirse más (el número: 8 px arriba y 1,6 em de --fs-min de alto; luego 4 px de aire y lo que la letra
   sube por encima de su línea) */
.rv-opts.is-kbv .rv-opt:not(:disabled){padding-top:calc(12px + 1.6 * var(--fs-min,.8125rem) + .25em)}
/* «Escucha y elige»: cuatro dibujos grandes, cuadrados; la marca en una esquina */
.rv-opt.pic{aspect-ratio:1;min-height:0;padding:10px}
.rv-opt.pic img{display:block;width:100%;height:100%;object-fit:contain;-webkit-user-drag:none;pointer-events:none}
${DARK(".rv-opt.pic img", "background:#F2F2F7;border-radius:12px")}
.rv-opt.pic.is-ok{background:var(--card);box-shadow:inset 0 0 0 4px var(--ok-fill)}
.rv-opt.pic.is-miss{background:var(--card);box-shadow:inset 0 0 0 4px var(--miss)}
.rv-opt.pic.is-miss img,.rv-opt.pic.is-dim img{opacity:.55}
.rv-opt.pic .chk,.rv-opt.pic .xm{position:absolute;top:8px;right:8px;width:32px;height:32px;padding:6px;box-sizing:border-box;border-radius:50%}
.rv-opt.pic .chk{background:var(--ok-fill);color:#fff}
.rv-opt.pic .xm{background:var(--miss);color:#fff}
/* las letras: el artículo puesto, los huecos y las fichas */
.rv-sp{display:flex;justify-content:center;align-items:flex-end;gap:6px;width:100%;margin:16px 0 0}
.rv-sp-a{flex:none;align-self:center;margin-right:4px;font:700 var(--fs-t2)/1 var(--f-round);color:var(--label2)}
.rv-slot{flex:0 1 40px;min-width:0;display:grid;place-items:center;height:50px;border-radius:12px 12px 6px 6px;background:var(--fill2);
  border-bottom:3px solid var(--sep);font:800 var(--fs-t2)/1 var(--f-round);color:var(--label);transition:background-color .16s,border-color .16s,color .16s}
.rv-slot.fix{flex:0 0 10px;background:none;border-color:transparent}
.rv-slot.is-next{border-color:var(--brand-tint);background:var(--brand-soft)}
.rv-sp.is-many{gap:3px}
.rv-sp.is-many .rv-slot{height:44px;font-size:var(--fs-head)}
.rv-sp.is-ok .rv-slot:not(.fix){background:var(--ok-fill);border-color:var(--ok-fill);color:#fff}
.rv-slot.rev{background:var(--miss-fill);border-color:var(--miss);color:var(--label)}
.rv-tiles{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;width:100%;max-width:420px;margin:0 auto}
.rv-tile{position:relative;flex:none;width:52px;height:56px;padding:0;border:0;border-radius:16px;background:var(--card);color:var(--label);
  font:800 1.6rem/1 var(--f-round);box-shadow:0 3px 0 var(--sep);cursor:pointer;-webkit-tap-highlight-color:transparent;
  transition:background-color .16s,color .16s,box-shadow .16s}
${DARK(".rv-tile", "box-shadow:0 3px 0 rgba(255,255,255,.12)")}
.rv-tile.is-used{visibility:hidden}
.rv-tile.is-miss{background:var(--miss-fill);color:var(--miss-on);box-shadow:none}
.rv-tile .xm{position:absolute;top:3px;right:3px;width:16px;height:16px;color:var(--miss)}
.rv-tiles.is-many{gap:8px}
.rv-tiles.is-many .rv-tile{width:46px}
.rv[data-kind] .rv-dock{gap:12px}
.rv-praise{margin:0;display:flex;align-items:center;gap:8px;color:var(--ok-ink);font:700 var(--fs-t3)/1.2 var(--f-round);text-align:center;text-wrap:balance}
.rv-praise .ico{flex:none;color:var(--ok)}
.rv-end-more{margin-top:12px;max-width:460px}
/* contestada: el dibujo encoge para que la respuesta y «Seguir» quepan sin bajar */
.rv[data-graded] .rv-pic{width:min(120px,50%,14vh);width:min(120px,50%,14svh)}
.rv[data-graded] .rv-stage{padding-bottom:16px}
.rv[data-graded] .rv-t .rv-audio{margin-top:8px}
.rv[data-kind] .rv-ask--give{font-size:var(--fs-t3)}
/* sin bajar (fitRoom), por pasos y antes de que el dibujo encoja: 1) los márgenes justos (is-tight; ya contestada, la
   pregunta se va: la respuesta ocupa su sitio); 2) ya contestada (is-snug), las opciones que ya no se tocan más bajas y
   la IPA con el altavoz y la tortuga en una línea, bajo la palabra; 3) solo entonces el dibujo, hasta su mínimo; 4) si
   ni así, las tarjetas de detrás (is-bare; vacías) y «Así se dice…» más pequeño (en una línea), y el dibujo vuelve a
   medirse. El dibujo de la tarjeta nunca se va:
   tras un fallo se ven a la vez el dibujo, la palabra, su IPA y su audio */
.rv.is-tight .rv-stage{padding-bottom:16px}
.rv.is-tight .rv-t{padding:12px 16px}
.rv.is-tight .rv-t .rv-es{margin-top:4px}
.rv.is-tight .rv-t .rv-qq{margin-top:2px}
.rv.is-tight[data-graded] .rv-t .rv-qq{display:none}
.rv.is-tight .rv-t .rv-word{margin-top:4px}
.rv.is-tight .rv-t .rv-audio{margin-top:6px;gap:12px}
.rv.is-tight .rv-t .rv-spk{width:52px;height:52px}
.rv.is-tight .rv-t .rv-slow{width:44px;height:44px}
.rv.is-tight .rv-sp{margin-top:8px}
.rv.is-tight .rv-slot{height:44px}
.rv.is-tight .rv-dock,.rv.is-tight .rv-opts,.rv.is-tight .rv-tiles{gap:8px}
.rv.is-tight .rv-opt:not(.pic){min-height:52px}
.rv.is-tight .rv-tile{height:50px}
.rv.is-snug .rv-stack{min-height:0}
.rv.is-snug .rv-opt:not(.pic){min-height:44px;padding-top:4px;padding-bottom:4px}
.rv.is-snug .rv-t{flex-flow:row wrap;align-content:center;column-gap:12px}
.rv.is-snug .rv-ans{display:contents}
.rv.is-snug .rv-t>*,.rv.is-snug .rv-ans>*{flex:0 0 100%}
.rv.is-snug .rv-t .rv-ipa{flex:0 1 auto;order:1;margin-top:4px}
.rv.is-snug .rv-t .rv-audio{flex:none;order:2;margin-top:4px}
.rv.is-bare .rv-back{display:none}
.rv.is-bare .rv-stage{padding-bottom:8px}
.rv.is-bare .rv-ask--give{font-size:var(--fs-sub)}
@keyframes rv-in{from{opacity:0;scale:.9}to{opacity:1;scale:1}}
@keyframes rv-wave{0%{opacity:.55;scale:.9}100%{opacity:0;scale:1.28}}
@keyframes rv-hop{0%{translate:0 0}35%{translate:0 -14px}70%{translate:0 0}85%{translate:0 -4px}100%{translate:0 0}}
@media (prefers-reduced-motion:reduce){
  .rv-flip{transition:none;transform:none!important}
  .rv-a{transform:none}
  .rv-face{transition:opacity .15s ease}
  .rv-card:not(.is-flipped) .rv-a,.rv-card.is-flipped .rv-q{opacity:0}
  .rv-h,.rv-fox .hero,.rv-spk.playing::after,.rv-ans{animation:none}
  .rv-opt,.rv-tile,.rv-slot{transition:none}
  .rv-prog i{transition:none}}
@media (prefers-contrast:more){.rv-face{border:2px solid var(--sep)}}
:root[data-contrast=more] .rv-face{border:2px solid var(--sep)}
@media (forced-colors:active){.rv-face{border:2px solid CanvasText}.rv-prog i{background:Highlight}.rv-tint{display:none}}
@media (max-height:700px){.rv-stage{padding-bottom:24px}.rv-face{padding:16px}.rv-pic{width:min(140px,70%,20vh);width:min(140px,70%,20svh)}.rv-es{margin-top:8px}.rv-qq{margin-top:4px}
  .rv-tap{margin-top:12px}.rv-audio{margin-top:12px}.rv-hints{margin-top:8px}.rv-end-card{padding:16px}}
/* aún más bajo (móvil pequeño, tumbado): el dibujo más pequeño, para que las pistas y el botón quepan sin bajar */
@media (max-height:600px){.rv-pic,.rv[data-graded] .rv-pic{width:min(72px,70%,13vh);width:min(72px,70%,13svh)}}
/* tumbado (unos 390 px de alto): el dibujo como antes, para no bajar más el botón «Ver» */
@media (max-height:440px){.rv-pic,.rv[data-graded] .rv-pic{width:min(44px,70%,11vh);width:min(44px,70%,11svh)}}
`;
function css(){
  if(DOC.getElementById("css-review")) return;
  const s = DOC.createElement("style"); s.id = "css-review"; s.textContent = STYLE;
  DOC.head.appendChild(s);
}
css();

/* ---------- estado de la pantalla (lo que no es del repaso: el gesto, la pista, el micrófono) ---------- */
const ui = {offSwipe: null, hint: null, micTok: 0, micOff: false, endT: 0};
const cur = () => (rv && rv.q && rv.q[rv.i]) || null;
/* el micrófono: si hay reconocimiento, hay internet (Chrome y Safari lo necesitan) y no ha fallado en este repaso */
const micOk = () => !ui.micOff && navigator.onLine !== false && typeof canListen === "function" && canListen();
const tapText = () => micOk() ? "Toca para ver" : "Piénsala… y toca para ver";
/* la palabra del idioma dentro de un aviso para el lector de pantalla, con su idioma */
const inL = t => `<span lang="${esc(code())}">${esc(t)}</span>`;
/* html: el texto (ya escapado) con las palabras del idioma en su <span lang> */
function live(html){ const el = DOC.getElementById("rv-live"); if(!el) return; el.textContent = ""; setTimeout(() => { if(el.isConnected) el.innerHTML = html; }, 40); }
function unbindSwipe(){ if(ui.offSwipe){ try{ ui.offSwipe(); }catch(e){} ui.offSwipe = null; } }
function closeHint(){ if(ui.hint){ try{ ui.hint.close(); }catch(e){} ui.hint = null; } }
function stopMic(){
  const c = rv && rv.c;
  if(c && c.mic === "listening"){ c.stop = true; try{ if(typeof recNow !== "undefined" && recNow) recNow.abort(); }catch(e){} }
}

/* ---------- la pantalla del repaso ---------- */
function qFace(it, c){
  const r = it.r, name = esc(LANGS[lang].name), pic = r.img ? `<div class="rv-picw"><img class="rv-pic" src="${esc(r.img)}" alt="" draggable="false"></div>` : "";
  return `<div class="rv-face rv-q" role="button" tabindex="0" data-press="sink" aria-label="${esc(r.es)}. ¿Cómo se dice en ${name}? Toca para ver.">
    ${pic ? `${pic}<p class="rv-es">${esc(r.es)}</p>` : `<p class="rv-es big">${esc(r.es)}</p>`}
    <p class="rv-qq">¿Cómo se dice en ${name}?</p>
    <div class="rv-hints" id="rv-hints">${hintsHtml(it, c)}</div>
    <p class="rv-tap">${ico("hand-pointing", "bold", 20)}<span class="rv-tap-t">${tapText()}</span></p></div>`;
}
function aFace(it){
  const r = it.r, d = r.l[lang], ipa = ipaHtml(d.ipa, code());
  return `<div class="rv-face rv-a" role="group" aria-label="Respuesta">
    <span class="rv-said" hidden>${CHK}</span>
    ${r.img ? `<div class="rv-picw"><img class="rv-pic" src="${esc(r.img)}" alt="" draggable="false"></div>` : ""}
    <p class="rv-word" lang="${esc(code())}" tabindex="-1">${esc(d.word)}</p>
    ${ipa ? `<p class="rv-ipa">${ipa}</p>` : ""}
    <p class="rv-tr">${esc(r.es)}</p>
    <div class="rv-audio">
      <button type="button" class="rv-spk" data-rv="spk" data-key="space" aria-label="Escuchar">${ico("speaker-high", "fill", 32)}</button>
      <button type="button" class="rv-slow" data-rv="slow" data-key="shift+space" aria-label="Escuchar despacio">${ico("turtle", "fill", 30)}</button></div></div>`;
}
function hintsHtml(it, c){
  if(!c || !c.hint) return "";
  return hints(it.r.l[lang].word, lang).slice(0, c.hint)
    .map((h, k) => `<p class="rv-h" data-step="${k + 1}" lang="${esc(code())}">${esc(h)}</p>`).join("");
}
function dockHtml(){
  const c = rv.c, name = LANGS[lang].name;
  if(c.flip){
    if(c.said) return `<p class="rv-good">${ico("check-circle", "fill", 30)}La dijiste bien.</p>`;
    /* «No me sale»: ya dijo que no la sabía, así que no se le pregunta; nota 0 y vuelve luego */
    if(c.gaveUp) return `<p class="rv-ask rv-ask--give">Así se dice. ¡La verás otra vez!</p>
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block rv-next" data-rv="next" data-key="enter">Seguir</button>`;
    return `<p class="rv-ask" id="rv-ask">¿La sabías?</p>
      <div class="rv-yn" role="group" aria-labelledby="rv-ask">
        <button type="button" class="glass-btn glass-btn--lg rv-no" data-rv="no" data-key="left">${ico("x", "bold", 22)}No</button>
        <button type="button" class="glass-btn glass-btn--ok glass-btn--lg rv-yes" data-rv="yes" data-key="right">${ico("check", "bold", 22)}¡Sí!</button></div>`;
  }
  /* la pregunta: «Ver» siempre es lo principal (tocando todo se puede); el micrófono solo da extra */
  const msg = c.msg ? `<p class="rv-msg" role="status">${esc(c.msg)}</p>` : "";
  const look = `<button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block rv-look" data-rv="look" data-key="space enter">${ico("eye", "bold", 22)}Ver</button>`;
  const on = c.mic === "listening";
  const mic = micOk() && c.miss < 2 ? `<button type="button" class="glass-btn glass-btn--sm rv-mic${on ? " is-on" : ""}" id="rv-mic" data-rv="mic" aria-pressed="${on}"
      aria-label="${on ? "Te escucho. Toca para parar" : c.miss ? `Otra vez: dilo en ${esc(name)}` : `Dilo en ${esc(name)}`}">${ico("microphone", "bold", 20)}${on ? "Te escucho…" : c.miss ? "Otra vez" : `Dilo en ${esc(name)}`}</button>` : "";
  const pista = c.hint < 2 ? `<button type="button" class="rv-txt rv-hint" data-rv="hint">${ico("lightbulb", "bold", 20)}${c.hint ? "Otra pista" : "Pista"}</button>` : "";
  /* «No me sale» solo tras intentar decirla */
  const give = c.miss ? `<button type="button" class="rv-txt rv-giveup" data-rv="giveup">No me sale</button>` : "";
  const row = mic + pista + give;
  return `${msg}${look}${row ? `<div class="rv-row">${row}</div>` : ""}`;
}
function paintDock(){
  const dock = DOC.getElementById("rv-dock"); if(!dock || !rv || !rv.c) return;
  const a = DOC.activeElement, had = a && dock.contains(a) ? a.dataset.rv || "" : null;
  dock.innerHTML = dockHtml();
  const root = DOC.getElementById("rv"); if(root) root.toggleAttribute("data-mic", micOk());
  const tap = DOC.querySelector("#rv-card .rv-tap-t"); if(tap) tap.textContent = tapText();
  if(had !== null){ const b = dock.querySelector(`[data-rv="${had}"]`) || dock.querySelector("button"); if(b) b.focus({preventScroll: true}); }
}
function paintProg(){
  const p = DOC.getElementById("rv-prog"); if(!p || !rv) return;
  const pct = 100 * rv.done / Math.max(1, rv.total);
  p.setAttribute("aria-valuemax", rv.total); p.setAttribute("aria-valuenow", rv.done);
  p.setAttribute("aria-valuetext", `${rv.done} de ${rv.total}`);
  p.firstElementChild.style.width = pct.toFixed(2) + "%";
}
function setInert(card){
  const c = rv.c, q = card.querySelector(".rv-q"), a = card.querySelector(".rv-a");
  if(q){ q.inert = c.flip; q.setAttribute("aria-hidden", String(c.flip)); }
  if(a){ a.inert = !c.flip; a.setAttribute("aria-hidden", String(!c.flip)); }
}
function shell(){
  return `<div class="rv" id="rv"${micOk() ? " data-mic" : ""} data-key-own>
    <div class="rv-top"><div class="rv-prog" id="rv-prog" role="progressbar" aria-label="Progreso del repaso" aria-valuemin="0"><i></i></div></div>
    <div class="rv-stage"><div class="rv-stack" id="rv-stack"></div></div>
    <div class="rv-dock" id="rv-dock"></div>
    <p class="vh" id="rv-live" role="status" aria-live="polite" aria-atomic="true"></p></div>`;
}
function mountCard(rise){
  const it = cur(), c = rv.c, stack = DOC.getElementById("rv-stack"); if(!it || !stack) return;
  const backs = Math.min(2, rv.q.length - rv.i - 1);
  stack.innerHTML = `${backs > 1 ? '<div class="rv-back b2" aria-hidden="true"></div>' : ""}${backs > 0 ? '<div class="rv-back b1" aria-hidden="true"></div>' : ""}
    <div class="rv-card${c.flip ? " is-flipped" : ""}" id="rv-card"><div class="rv-flip">${qFace(it, c)}${aFace(it)}</div>
      <div class="rv-tint" aria-hidden="true"><span class="rv-tint-ic y">${ico("check", "bold", 32)}</span><span class="rv-tint-ic n">${ico("x", "bold", 32)}</span></div></div>`;
  const card = DOC.getElementById("rv-card");
  setInert(card);
  /* la palabra nunca se parte: si no cabe, baja de tamaño */
  fitWord(card.querySelector(".rv-word"), 28);
  const es = card.querySelector(".rv-es"); if(es) fitWord(es, es.classList.contains("big") ? 28 : 20);
  if(c.said){ const b = card.querySelector(".rv-said"); if(b) b.hidden = false; }
  if(c.flip && !c.said && !c.decided && !c.gaveUp) bindSwipe();
  if(rise && W.M){
    if(rm()) card.animate([{opacity: 0}, {opacity: 1}], {duration: 120, easing: "ease-out"});
    else W.M.springTo(card, [{translate: "0px 14px", scale: .94}, {translate: "0px 0px", scale: 1}], {commit: false});
  }
  preload();
}
/* los dibujos de la siguiente, ya cargados */
function preload(){
  const nx = rv.q[rv.i + 1]; if(!nx) return;
  for(const r of [nx.r, ...(nx.opts || [])]) if(r && r.img){ const im = new Image(); im.src = r.img; }
}
/* pinta la tarjeta actual (o el final); con rise la nueva sube de la pila */
function draw(o = {}){
  if(!rv) return;
  if(rv.i >= rv.q.length) return drawEnd();
  const it = cur();
  if(!it.ready){ prep(it, rv.docs); it.ready = true; }
  if(!rv.c) rv.c = newCard(it);
  let root = DOC.getElementById("rv");
  const a = DOC.activeElement, lost = !a || a === DOC.body || !!(root && root.contains(a));
  if(!root || root.dataset.sid !== rv.sid){
    $("#app").innerHTML = shell();
    root = DOC.getElementById("rv"); root.dataset.sid = rv.sid; wire(root);
  }
  const task = rv.c.kind !== "card";
  if(task){ root.dataset.kind = rv.c.kind; root.removeAttribute("data-mic"); root.toggleAttribute("data-graded", !!rv.c.graded); }
  else { delete root.dataset.kind; root.removeAttribute("data-graded"); clearRoom(root); }
  paintProg();
  if(task){ mountTask(!!o.rise); paintTask(); } else { mountCard(!!o.rise); paintDock(); }
  /* una tarjeta nueva: el lector de pantalla la lee (el foco va a la tarjeta, no a un botón de abajo) */
  if(o.rise || o.first){
    const q = DOC.querySelector(task ? "#rv-card .rv-t" : "#rv-card .rv-q");
    if(o.rise && lost && q) q.focus({preventScroll: true});
    else live(task ? taskAsk(it) : `${esc(it.r.es)}. ¿Cómo se dice en ${esc(LANGS[lang].name)}?`);
    if(task && rv.c.kind === "listen" && !rv.c.graded && !rv.c.played){ rv.c.played = true; hearIt(400); }
  }
}

/* ---------- las tarjetas que corrige la app: pantalla y respuestas ---------- */
const lname = () => esc(LANGS[lang].name);
const qText = k => k === "listen" ? "Escucha y elige" : k === "spell" ? `Escríbela en ${lname()}` : `¿Cuál es en ${lname()}?`;
/* lo que oye el lector de pantalla al llegar a la tarjeta */
function taskAsk(it){
  const k = it.kind;
  if(k === "listen") return "Escucha la palabra y elige su dibujo.";
  if(k === "spell") return `${esc(it.r.es)}. Escríbela en ${lname()}: ${it.sp.chars.filter(isL).length} letras.`;
  return `${esc(it.r.es)}. ¿Cuál es en ${lname()}?`;
}
/* el altavoz y la tortuga, con sus teclas (Espacio y Mayús+Espacio, que trata el repaso: keys.js solo pone la etiqueta) */
const spkHtml = () => `<div class="rv-audio">
  <button type="button" class="rv-spk" data-rv="spk" data-key="space" aria-label="Escuchar">${ico("speaker-high", "fill", 32)}</button>
  <button type="button" class="rv-slow" data-rv="slow" data-key="shift+space" aria-label="Escuchar despacio">${ico("turtle", "fill", 30)}</button></div>`;
/* la respuesta, al contestar: la palabra (en las letras ya está en los huecos, salvo si se falló), su IPA y el audio */
function ansHtml(it, c){
  const d = it.r.l[lang], ipa = ipaHtml(d.ipa, code()), word = !(c.kind === "spell" && c.g > 0);
  return `<div class="rv-ans" id="rv-ans">
    ${word ? `<p class="rv-word" lang="${esc(code())}" tabindex="-1">${esc(d.word)}</p>` : ""}
    ${ipa ? `<p class="rv-ipa">${ipa}</p>` : ""}${c.kind === "listen" ? "" : spkHtml()}</div>`;
}
function slotsHtml(it, c){
  const sp = it.sp, L = sp.chars.filter(isL), lost = c.graded && c.g === 0;
  let k = 0;
  const cells = sp.chars.map(ch => {
    if(!isL(ch)) return `<span class="rv-slot fix">${ch === " " ? "" : esc(ch)}</span>`;
    const i = k++, on = i < c.put, show = on || lost;
    return `<span class="rv-slot${!c.graded && i === c.put ? " is-next" : ""}${!on && lost ? " rev" : ""}">${show ? esc(ch) : ""}</span>`;
  }).join("");
  const st = c.graded ? (c.g > 0 ? " is-ok" : " is-miss") : "";
  return `<div class="rv-sp${st}${L.length > 8 ? " is-many" : ""}" id="rv-sp" lang="${esc(code())}" role="img"
    aria-label="${c.graded ? esc(it.r.l[lang].word) : `Llevas ${c.put} de ${L.length} letras`}">${sp.art ? `<span class="rv-sp-a">${esc(sp.art)}</span>` : ""}${cells}</div>`;
}
function taskFace(it, c){
  const r = it.r, k = c.kind, pic = r.img ? `<div class="rv-picw"><img class="rv-pic" src="${esc(r.img)}" alt="" draggable="false"></div>` : "";
  const head = k === "listen" ? `<p class="rv-qq">${qText(k)}</p>${spkHtml().replace('class="rv-audio"', 'class="rv-audio rv-lis"')}`
    : `${pic ? `${pic}<p class="rv-es">${esc(r.es)}</p>` : `<p class="rv-es big">${esc(r.es)}</p>`}<p class="rv-qq">${qText(k)}</p>${k === "spell" ? slotsHtml(it, c) : ""}`;
  return `<div class="rv-face rv-t" tabindex="-1" role="group" aria-label="${k === "listen" ? "Escucha y elige" : `${esc(r.es)}. ${qText(k)}`}">
    ${head}${c.graded ? ansHtml(it, c) : ""}</div>`;
}
/* en lo que se toca: la buena en verde con ✓, la elegida mala en gris con ✗, las demás apagadas. Con el teclado, cada
   opción lleva su número (1-4) dentro, arriba a la derecha (keys.js solo pone la etiqueta: #rv se queda sus teclas);
   ya contestada, sin número (deshabilitada, keys.js no la etiqueta) */
function optHtml(it, c, r, i){
  const ok = r === it.r, done = c.graded, st = !done ? "" : ok ? " is-ok" : i === c.pick ? " is-miss" : " is-dim";
  const mark = done && ok ? CHK : done && i === c.pick ? ico("x", "bold", 22, "xm") : "";
  if(c.kind === "listen")
    return `<button type="button" class="rv-opt pic${st}" data-rv="opt" data-i="${i}" data-key="${i + 1}" data-key-pos="in" aria-label="${esc(r.es)}"${done ? " disabled" : ""}>
      <img src="${esc(r.img)}" alt="" draggable="false">${mark}</button>`;
  return `<button type="button" class="rv-opt${st}" data-rv="opt" data-i="${i}" data-key="${i + 1}" data-key-pos="in" lang="${esc(code())}"${done ? " disabled" : ""}>${mark}<span>${esc(r.l[lang].word)}</span></button>`;
}
const tipsLeft = (it, c) => !c.graded && c.hint < 2 && it.sp.chars.filter(isL).length - c.put > 1;
/* lo de abajo: las opciones o las fichas y, ya contestada, «La dijiste…» o «Así se dice» con «Seguir» */
function taskDock(it, c){
  const k = c.kind;
  let h = "";
  if(k === "spell"){
    if(!c.graded){
      h = `<div class="rv-tiles${it.tiles.length > 10 ? " is-many" : ""}" role="group" aria-label="Letras">${it.tiles.map((t, i) =>
        `<button type="button" class="rv-tile${c.used.has(i) ? " is-used" : ""}${c.flash === i ? " is-miss" : ""}" data-rv="tile" data-i="${i}" lang="${esc(code())}"${c.used.has(i) ? ' tabindex="-1" aria-hidden="true"' : ""}>${esc(t.c)}${c.flash === i ? ico("x", "bold", 16, "xm") : ""}</button>`).join("")}</div>`;
      if(tipsLeft(it, c)) h += `<div class="rv-row"><button type="button" class="rv-txt rv-hint" data-rv="tip">${ico("lightbulb", "bold", 20)}${c.hint ? "Otra pista" : "Pista"}</button></div>`;
    }
  } else {
    h = `<div class="rv-opts${k === "listen" ? " pics" : ""}" role="group" aria-label="${k === "listen" ? "Elige el dibujo" : "Elige la palabra"}">${it.opts.map((r, i) => optHtml(it, c, r, i)).join("")}</div>`;
  }
  if(c.graded){
    h += c.g > 0 ? `<p class="rv-praise" role="status">${ico("check-circle", "fill", 28)}${praise(c)}</p>`
      : `<p class="rv-ask rv-ask--give">${it.again ? "Así se dice." : "Así se dice. ¡La verás otra vez!"}</p>
        <button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block rv-next" data-rv="tnext" data-key="enter">Seguir</button>`;
  }
  return h;
}
/* el elogio va a lo que hizo, no a él */
function praise(c){
  if(c.kind === "listen") return c.again ? "Esta vez la reconociste al oírla." : "Escuchaste con atención.";
  if(c.kind === "spell") return c.hint ? "Con una pista, la escribiste." : c.bad ? "A la segunda, la escribiste bien." : "La escribiste letra a letra.";
  return c.again ? "Esta vez la reconociste." : "La leíste con cuidado.";
}
function mountTask(rise){
  const it = cur(), c = rv.c, stack = DOC.getElementById("rv-stack"); if(!it || !stack) return;
  const backs = Math.min(2, rv.q.length - rv.i - 1);
  stack.innerHTML = `${backs > 1 ? '<div class="rv-back b2" aria-hidden="true"></div>' : ""}${backs > 0 ? '<div class="rv-back b1" aria-hidden="true"></div>' : ""}
    <div class="rv-card rv-tc" id="rv-card">${taskFace(it, c)}</div>`;
  const card = DOC.getElementById("rv-card");
  fitTask(card);
  if(rise && W.M){
    if(rm()) card.animate([{opacity: 0}, {opacity: 1}], {duration: 120, easing: "ease-out"});
    else W.M.springTo(card, [{translate: "0px 14px", scale: .94}, {translate: "0px 0px", scale: 1}], {commit: false});
  }
  preload();
}
function fitTask(card){
  if(!card) return;
  const es = card.querySelector(".rv-es"); if(es) fitWord(es, es.classList.contains("big") ? 28 : 20);
  const w = card.querySelector(".rv-word"); if(w) fitWord(w, 28);
}
/* vuelve a pintar la tarjeta y lo de abajo sin moverla (tras cada toque); el foco se queda donde estaba */
function paintTask(){
  const it = cur(), c = rv && rv.c, dock = DOC.getElementById("rv-dock"); if(!it || !c || !dock) return;
  const a = DOC.activeElement, had = a && dock.contains(a) ? {rv: a.dataset.rv || "", i: a.dataset.i} : null;
  const root = DOC.getElementById("rv"); if(root) root.toggleAttribute("data-graded", !!c.graded);
  dock.innerHTML = taskDock(it, c);
  if(had){
    const b = dock.querySelector(`[data-rv="${had.rv}"]${had.i != null ? `[data-i="${had.i}"]` : ""}:not(:disabled):not(.is-used)`)
      || dock.querySelector(".rv-next") || dock.querySelector("button:not(:disabled):not(.is-used)");
    if(b) b.focus({preventScroll: true});
  }
  fitOpts(); fitRoom();
}
/* «¿Cuál es…?»: ninguna palabra se parte («hippo-pot-amus»), como en la lección: con la ✓ o la ✗ al lado que no cabe, la
   marca va encima; si aun así alguna no cabe, las 4 bajan de tamaño juntas (titular y luego 17 px); solo si ni así, se
   parte. Con el teclado, sin contestar, cada opción lleva su número (1-4) arriba a la derecha: si una palabra llegaría a
   él (con 4 px de aire), las 4 bajan la palabra por debajo del número (is-kbv), sin quitarle ancho */
function fitOpts(){
  const box = DOC.querySelector("#rv-dock .rv-opts:not(.pics)"); if(!box) return;
  box.classList.remove("is-long", "is-xlong", "is-break", "is-kbv");
  box.querySelectorAll(".rv-opt.is-stack").forEach(o => o.classList.remove("is-stack"));
  const ts = [...box.querySelectorAll(".rv-opt > span")], over = t => t.scrollWidth > t.clientWidth + 1;
  box.querySelectorAll(".rv-opt").forEach(o => { const t = o.querySelector(":scope > span"); if(t && o.querySelector(".chk,.xm") && over(t)) o.classList.add("is-stack"); });
  for(const k of ["is-long", "is-xlong", "is-break"]){ if(!ts.some(over)) break; box.classList.add(k); }
  if(DOC.documentElement.hasAttribute("data-kbd") && [...box.querySelectorAll(".rv-opt:not(:disabled)")].some(kbHits)) box.classList.add("is-kbv");
}
/* ¿la palabra de la opción llega a su número (con 4 px de aire)? El número lo pone keys.js en su vuelta: si aún no está,
   se mide uno igual, escondido, en su sitio */
function kbHits(o){
  const t = o.querySelector(":scope > span"); if(!t) return false;
  let k = o.querySelector(":scope > kbd.kb-tag"), tmp = null;
  if(!k){ tmp = k = DOC.createElement("kbd"); k.className = "kb-tag"; k.dataset.k = o.dataset.key || "1"; k.style.visibility = "hidden"; o.appendChild(k); }
  const q = k.getBoundingClientRect(), g = DOC.createRange();
  if(tmp) tmp.remove();
  g.selectNodeContents(t);
  return [...g.getClientRects()].some(r => r.width && r.left < q.right + 4 && r.right > q.left - 4 && r.top < q.bottom + 4 && r.bottom > q.top - 4);
}
/* sin bajar, como la tarjeta de siempre y la lección: si la tarjeta y lo de abajo no caben en la pantalla (un móvil bajo,
   «Texto más grande», la respuesta que sale al contestar), ceden primero los márgenes (is-tight), luego, ya contestada,
   lo que ya no se toca (is-snug: las opciones más bajas y la IPA con su audio en una línea) y solo entonces el dibujo:
   el de la tarjeta, nunca por debajo de 72 px (48 ya contestada; nunca se va); en «Escucha y elige», los 4 dibujos,
   nunca por debajo de 64 px cada uno. Los dos, medidos en el dibujo: sin el margen de su botón ni el blanco que lleva
   la tarjeta en oscuro. Si ya contestada ni así cabe, se van las tarjetas de detrás y «Así se dice…» baja de tamaño
   (is-bare), y el dibujo se vuelve a medir. Cuenta lo que baja la página y lo que la tarjeta
   recorta. Lo de una tarjeta no pasa a la siguiente: se quita antes de nada (y en draw, para la de siempre) */
const PIC_MIN = 72, PIC_ANS = 48, OPT_IMG = 64;
/* lo que la cara de la tarjeta recorta: lo que ocupa su contenido (en el sitio que le da la maqueta, sin las
   animaciones de entrada) menos lo que cabe dentro de su relleno */
function faceOver(){
  const f = DOC.querySelector("#rv-card .rv-t"); if(!f) return 0;
  let top = Infinity, bot = -Infinity;
  const add = box => {
    for(const e of box.children){
      const s = getComputedStyle(e);
      if(s.display === "contents"){ add(e); continue; }
      if(s.display === "none" || s.position === "absolute" || s.position === "fixed" || e.offsetParent !== f) continue;
      top = Math.min(top, e.offsetTop - (parseFloat(s.marginTop) || 0));
      bot = Math.max(bot, e.offsetTop + e.offsetHeight + (parseFloat(s.marginBottom) || 0));
    }
  };
  add(f);
  if(top === Infinity) return 0;
  const cs = getComputedStyle(f);
  return Math.ceil(bot - top - (f.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0)));
}
const roomOver = () => Math.max(DOC.documentElement.scrollHeight - innerHeight, faceOver());
function clearRoom(root){ if(root) root.classList.remove("is-tight", "is-snug", "is-bare"); }
function fitRoom(){
  const root = DOC.getElementById("rv"); if(!root) return;
  clearRoom(root);
  const c = rv && rv.c;
  if(!c || c.kind === "card" || !onRepaso()) return;
  const listen = c.kind === "listen", el = root.querySelector(listen ? "#rv-dock .rv-opts.pics" : "#rv-card .rv-pic");
  if(el) el.style.width = "";
  if(roomOver() <= 0) return;
  root.classList.add("is-tight");
  if(roomOver() <= 0) return;
  if(c.graded){ root.classList.add("is-snug"); if(roomOver() <= 0) return; }
  /* el dibujo, lo justo: en «Escucha y elige» se encoge la rejilla de los 4 (dos por fila, con su hueco y el relleno de
     cada botón) */
  let min = c.graded ? PIC_ANS : PIC_MIN;
  if(listen && el){
    const b = el.querySelector(".rv-opt"), bs = b ? getComputedStyle(b) : null;
    min = 2 * (OPT_IMG + (bs ? (parseFloat(bs.paddingLeft) || 0) + (parseFloat(bs.paddingRight) || 0) : 0)) + (parseFloat(getComputedStyle(el).columnGap) || 0);
  } else if(el){
    /* el de la tarjeta lleva en oscuro un margen blanco (padding): el mínimo es del dibujo, no de su caja */
    const ps = getComputedStyle(el);
    min += (parseFloat(ps.paddingLeft) || 0) + (parseFloat(ps.paddingRight) || 0);
  }
  const shrink = () => {
    if(el) for(let k = 0, o = roomOver(); k < 3 && o > 0; k++){
      const w = el.offsetWidth, was = el.style.width; if(w <= min) break;
      el.style.width = Math.max(min, Math.floor(w - o)) + "px";
      const o2 = roomOver(); if(o2 >= o){ el.style.width = was; break; }   /* no gana nada: se queda como estaba */
      o = o2;
    }
    return roomOver();
  };
  if(shrink() <= 0 || !c.graded) return;
  root.classList.add("is-bare");
  if(el) el.style.width = "";
  shrink();
}
/* al girar el móvil o cuando llega la letra redonda, se vuelve a medir */
let refitRaf = 0;
function refitTask(){
  if(refitRaf) return;
  refitRaf = requestAnimationFrame(() => { refitRaf = 0; if(rv && rv.c && rv.c.kind !== "card" && !rv.end && DOC.getElementById("rv-card")){ fitOpts(); fitRoom(); } });
}
W.addEventListener("resize", refitTask);
/* y al salir o irse las etiquetas de las teclas (html[data-kbd]): el número de cada opción pide su sitio (fitOpts) */
if(typeof MutationObserver === "function") new MutationObserver(refitTask).observe(DOC.documentElement, {attributes: true, attributeFilter: ["data-kbd"]});
if(DOC.fonts && DOC.fonts.ready) DOC.fonts.ready.then(refitTask, () => {});
if(DOC.fonts && typeof DOC.fonts.addEventListener === "function") DOC.fonts.addEventListener("loadingdone", refitTask);
function repaintTask(){
  const it = cur(), c = rv && rv.c, card = DOC.getElementById("rv-card"); if(!it || !c || !card) return;
  const had = card.contains(DOC.activeElement) ? DOC.activeElement.dataset.rv || "face" : null;
  card.innerHTML = taskFace(it, c);
  fitTask(card);
  if(had){ const b = had === "face" ? card.querySelector(".rv-t") : card.querySelector(`[data-rv="${had}"]`); if(b) b.focus({preventScroll: true}); }
  paintTask();
}
/* «Escucha y elige»: suena la palabra (al llegar, con un respiro, y con el altavoz) */
function hearIt(delay){
  const it = cur(); if(!it) return;
  const tok = ++autoTok, r0 = rv, c0 = rv.c;
  setTimeout(() => {
    if(tok !== autoTok || rv !== r0 || !rv || rv.c !== c0 || !onRepaso()) return;
    const card = DOC.getElementById("rv-card");
    sayP(it.r.l[lang].word, card && card.querySelector(".rv-spk"));
  }, delay || 0);
}
function choose(i){
  const c = rv && rv.c, it = cur(); if(!c || c.graded || !it || !it.opts || !it.opts[i]) return;
  c.pick = i;
  answered(it.opts[i] === it.r ? (it.again ? 1 : 2) : 0);
}
/* una ficha: la buena va a su hueco; otra se pone gris con ✗ un momento; a la segunda mal, se falla */
function tileTap(i){
  const c = rv && rv.c, it = cur(); if(!c || c.graded || c.kind !== "spell" || !it || c.used.has(i) || !it.tiles[i]) return;
  const L = it.sp.chars.filter(isL), want = L[c.put];
  if(it.tiles[i].c.toLowerCase() === want.toLowerCase()){
    c.used.add(i); c.put++; c.flash = -1;
    if(W.G && typeof W.G.haptic === "function") W.G.haptic("selection");
    if(c.put >= L.length) return answered(c.bad || c.hint || it.again ? 1 : 2);
    repaintTask();
    return;
  }
  c.bad++;
  if(c.bad >= 2) return answered(0);
  c.flash = i; paintTask();
  live(`Esa no. Prueba otra letra.`);
  const c0 = c; setTimeout(() => { if(rv && rv.c === c0 && c0.flash === i && !c0.graded){ c0.flash = -1; paintTask(); } }, 650);
}
/* «Pista» en las letras: pone la siguiente (2 como mucho, nunca la última) */
function tip(){
  const c = rv && rv.c, it = cur(); if(!c || c.graded || c.kind !== "spell" || !it || !tipsLeft(it, c)) return;
  const want = it.sp.chars.filter(isL)[c.put], j = it.tiles.findIndex((t, k) => !c.used.has(k) && t.c.toLowerCase() === want.toLowerCase());
  if(j < 0) return;
  c.hint++; c.hinted = true; c.used.add(j); c.put++; c.flash = -1;
  repaintTask();
  live(`Pista: la siguiente es «${inL(want)}».`);
}
/* con teclado: la letra que se teclea es una ficha (la que toca si coincide, aunque sea sin tilde: «e» por «é») */
function typeTile(key){
  const c = rv && rv.c, it = cur(); if(!c || c.graded || c.kind !== "spell" || !it || !it.tiles) return false;
  const k = key.toLowerCase(), want = (it.sp.chars.filter(isL)[c.put] || "").toLowerCase();
  const free = it.tiles.map((t, i) => ({c: t.c.toLowerCase(), i})).filter(t => !c.used.has(t.i));
  const t = (k === want || fold(k) === fold(want) ? free.find(t => t.c === want) : null)
    || free.find(t => t.c === k) || free.find(t => fold(t.c) === fold(k));
  if(!t) return false;
  tileTap(t.i);
  return true;
}
/* contestada: la nota se escribe ya (aunque se salga antes de «Seguir»), se ve la respuesta y suena */
function answered(g){
  const c = rv && rv.c, it = cur(); if(!c || c.graded || !it) return;
  score(g, {self: false});
  const word = it.r.l[lang].word, r0 = rv, t0 = clock();
  if(g > 0){
    try{ if(typeof sfx !== "undefined") sfx.play("ok"); }catch(e){}
    if(W.G && typeof W.G.haptic === "function") W.G.haptic("success");
  }
  repaintTask();
  const card = DOC.getElementById("rv-card");
  live(g > 0 ? `${esc(praise(c))} ${inL(word)}` : `Así se dice: ${inL(word)}.${it.again ? "" : " ¡La verás otra vez!"}`);
  if(g === 0){ const b = DOC.querySelector('#rv-dock [data-rv="tnext"]'); if(b && (DOC.activeElement === DOC.body || !DOC.getElementById("rv").contains(DOC.activeElement))) b.focus({preventScroll: true}); }
  const tok = ++autoTok, spk = card && (card.querySelector(".rv-ans .rv-spk") || card.querySelector(".rv-spk"));
  (async () => {
    if(c.kind !== "listen") await wait(150);
    if(tok === autoTok) await Promise.race([sayP(word, spk), wait(7000)]);
    if(g === 0) return;
    const left = AFTER_OK_MS - (clock() - t0); if(left > 0) await wait(left);
    await wait(rm() ? 0 : 250);
    if(rv === r0 && rv && rv.c === c && onRepaso()) taskNext();
  })();
}
/* a la siguiente (con «Seguir» tras un fallo, o sola tras acertar) */
function taskNext(){
  const c = rv && rv.c; if(!c || !c.graded || c.kind === "card" || c.left) return;
  c.left = true;
  autoTok++; try{ if("speechSynthesis" in W) speechSynthesis.cancel(); }catch(e){}
  advance(c.g > 0 ? 1 : -1, 0);
}

/* ---------- girar, oír, pistas ---------- */
function flip(how){
  const c = rv && rv.c, card = DOC.getElementById("rv-card"), it = cur();
  if(!c || c.flip || !card || !it) return Promise.resolve();
  if(c.mic === "listening") stopMic();
  const root = DOC.getElementById("rv"), inside = !!(root && root.contains(DOC.activeElement) && DOC.activeElement !== DOC.body);
  c.thinkMs = thinkMs(c); c.flip = true; c.how = how;
  card.classList.add("is-flipped"); setInert(card);
  const decides = !c.said && !c.gaveUp;   /* girada para decidir Sí / No (no al decirla bien ni con «No me sale») */
  if(decides) rv.flips = (rv.flips || 0) + 1;
  paintDock();
  const word = it.r.l[lang].word;
  if(c.said){
    const b = card.querySelector(".rv-said"); if(b){ b.hidden = false; if(W.M && W.M.ok) W.M.ok(b); }
    live(`La dijiste bien. ${inL(word)}`);
  } else if(c.gaveUp) live(`Así se dice: ${inL(word)}. ¡La verás otra vez!`);
  else { live(`${inL(word)}. ¿La sabías?`); bindSwipe(); }
  if(inside){ const w = card.querySelector(".rv-word"); if(w) w.focus({preventScroll: true}); }
  /* la pista del gesto: la segunda vez que gira una tarjeta para decidir (nunca la primera) */
  if(decides && rv.flips === 2 && W.G && typeof W.G.hint === "function"){
    try{ ui.hint = W.G.hint(card, {id: "rv-swipe", text: "Desliza: sí o no", gesture: "swipe", delay: 450}); }catch(e){ console.error(e); }
  }
  const tok = ++autoTok, spk = card.querySelector(".rv-spk");
  return (async () => {
    if(how === "said") await wait(300);
    if(tok !== autoTok) return;
    await Promise.race([sayP(word, spk), wait(7000)]);
  })();
}
function replay(slow){
  const it = cur(), card = DOC.getElementById("rv-card"); if(!it || !card) return;
  say(it.r.l[lang].word, card.querySelector(slow ? ".rv-slow" : ".rv-spk"), !!slow);
}
function hintStep(){
  const c = rv && rv.c, it = cur(); if(!c || c.flip || !it) return;
  if(c.mic === "listening") stopMic();
  if(c.hint >= 2){ flip("hint"); return; }
  c.hint++; c.hinted = true;
  const box = DOC.getElementById("rv-hints"); if(box) box.innerHTML = hintsHtml(it, c);
  paintDock();
  if(c.hint >= 2){ const b = DOC.querySelector('#rv-dock [data-rv="look"]'); if(b && DOC.activeElement === DOC.body) b.focus({preventScroll: true}); }
  const w = it.r.l[lang].word, n = [...splitArt(mainForm(w), lang).rest].filter(isL).length, [h1, h2] = hints(w, lang);
  live(c.hint === 1 ? `Pista: empieza por «${inL(h1.replace(/…$/, ""))}»` : `Pista: empieza por «${inL(h2.split(" _")[0])}» y tiene ${n} letras`);
}

/* ---------- Dilo primero (micrófono) ---------- */
async function speak(){
  const c = rv && rv.c, it = cur(); if(!c || c.flip || c.decided || !it) return;
  if(c.mic === "listening"){ stopMic(); return; }
  if(!micOk()) return;
  const tok = ++ui.micTok;
  c.mic = "listening"; c.msg = ""; c.stop = false; paintDock(); pauseT(c, "mic", true);
  autoTok++; try{ if("speechSynthesis" in W) speechSynthesis.cancel(); }catch(e){}
  let res;
  try{ res = await listen({lang: code()}); }catch(e){ res = {status: "error", alts: []}; }
  pauseT(c, "mic", false);
  if(tok !== ui.micTok || !rv || rv.c !== c) return;
  if(c.mic === "listening") c.mic = "idle";
  if(!onRepaso() || c.flip || c.decided) return;
  if(c.stop){ c.stop = false; paintDock(); return; }
  if(res && res.status === "ok" && matches(res.alts, it.r.l[lang].word, lang)) return saidIt(c);
  /* sin permiso, sin internet, sin micrófono o sin ese idioma: no es culpa suya y no sirve repetir. Se dice una vez,
     claro, y el micrófono se va en este repaso */
  if(res && (res.status === "denied" || res.status === "unsupported" || res.status === "unavailable")){
    ui.micOff = true; c.mic = "idle"; c.msg = micMsg(res); paintDock(); live(esc(c.msg)); return;
  }
  if(res && res.status === "busy"){ c.mic = "idle"; paintDock(); return; }
  /* no le entiende o no coincide: nunca un 0. A la segunda, el micrófono se va y que mire y decida él */
  c.miss++; c.mic = "miss";
  c.msg = c.miss >= 2 ? "¡No pasa nada! Mírala y dime si la sabías." : "No te he oído bien";
  paintDock();
  live(c.miss >= 2 ? esc(c.msg) : "No te he oído bien. Puedes decirlo otra vez o tocar «Ver».");
}
function micMsg(res){
  if(res.status === "unavailable" && (res.error === "network" || navigator.onLine === false)) return "Sin internet no puedo oírte. Toca «Ver».";
  if(res.status === "unavailable" && res.error === "audio-capture") return "No encuentro el micrófono. Toca «Ver».";
  if(res.status === "unavailable") return "Ahora no puedo oírte. Toca «Ver».";
  return "No puedo usar el micrófono. Toca «Ver».";
}
function saidIt(c){
  c.said = true; c.mic = "ok";
  const g = grade(true, c), r0 = rv, t0 = clock();
  try{ if(typeof sfx !== "undefined") sfx.play("ok"); }catch(e){}
  flip("said").then(async () => {
    const left = AFTER_OK_MS - (clock() - t0); if(left > 0) await wait(left);
    if(!rv || rv !== r0 || rv.c !== c || c.decided) return;
    c.decided = true;
    /* si se fue del repaso mientras sonaba, la nota se escribe igual (si no, la tarjeta se quedaría sin decidir) */
    if(onRepaso()) commit(g, 1, 0); else gradeAway(g);
  });
}
/* la nota de una tarjeta dicha bien con el repaso ya cerrado: lo mismo que commit, sin pintar; si era la última, el
   repaso termina (las 10 monedas del final y review-done) */
function gradeAway(g){
  const c = rv && rv.c; if(!c || !cur()) return;
  score(g, {self: !c.said});
  rv.i++; rv.c = null;
  if(rv.i >= rv.q.length){ pay(null); rv = null; }
}

/* ---------- decidir: botones, flechas o deslizar ---------- */
function lean(card, dir, a){
  if(!card) return;
  if(dir) card.dataset.lean = dir;
  card.style.setProperty("--lean-a", String(+a.toFixed(3)));
}
function bindSwipe(){
  unbindSwipe();
  const card = DOC.getElementById("rv-card"); if(!card || !W.G || typeof W.G.swipe !== "function") return;
  const ok = () => !!(rv && rv.c && rv.c.flip && !rv.c.decided && !rv.c.said && !rv.c.gaveUp && card.isConnected);
  const back = info => {
    card.classList.remove("is-drag"); lean(card, null, 0);
    if(W.M && W.M.springTo) W.M.springTo(card, {translate: "0px 0px", rotate: "0deg"}, {velocity: info && info.v || 0});
    else { card.style.translate = ""; card.style.rotate = ""; }
  };
  ui.offSwipe = W.G.swipe(card, {
    onMove: ({dx, p}) => {
      if(!ok()) return;
      const w = card.offsetWidth || 320;
      card.classList.add("is-drag");
      card.style.translate = `${dx.toFixed(1)}px 0px`;
      card.style.rotate = `${clamp(dx / w * 16, -8, 8).toFixed(2)}deg`;
      lean(card, dx >= 0 ? "yes" : "no", Math.min(1, Math.abs(p)));
    },
    onRight: info => { if(ok()) decide(true, {v: info.v}); else back(info); },
    onLeft: info => { if(ok()) decide(false, {v: info.v}); else back(info); },
    onCancel: back,
  });
}
function decide(yes, o = {}){
  const c = rv && rv.c; if(!c || !c.flip || c.decided || c.said || c.gaveUp) return;
  c.decided = true;
  if(yes && W.G && typeof W.G.haptic === "function") W.G.haptic("success");   /* dentro del toque; al decir No, nada */
  commit(grade(yes, c), yes ? 1 : -1, o.v || 0);
}
/* «Seguir» tras «No me sale»: nota 0, como «No» */
function next(){
  const c = rv && rv.c; if(!c || !c.flip || c.decided || !c.gaveUp) return;
  c.decided = true; commit(0, -1, 0);
}
/* la nota, una sola vez por tarjeta: a srsGrade (self: la puso el niño; again: la vuelta de una fallada), las monedas
   (la nota si la corrige la app; 1 por terminarla si la puso él) y, con 0, la tarjeta vuelve 3 a 5 tarjetas después
   (con 3 como poco en medio), una sola vez */
function score(g, o = {}){
  const c = rv && rv.c, it = cur(); if(!c || !it || c.graded) return;
  const self = !!o.self, coins = self ? 1 : g;
  c.graded = true; c.g = g;
  srsGrade(it.id, it.r, g, {self, again: !!it.again});
  if(coins){ award(coins, "", true); rv.coins += coins; }
  bus.emit("review-card", {grade: g, es: it.r.es, word: it.r.l[lang].word, self});
  if(g === 0 && !it.again){
    const n = BACK[0] + Math.floor(Math.random() * (BACK[1] - BACK[0] + 1));
    rv.q.splice(Math.min(rv.q.length, rv.i + 1 + n), 0, {id: it.id, r: it.r, x: it.x, kind: it.kind, again: true});
  } else rv.done++;
}
/* a la siguiente: la tarjeta sale volando (dir 1 a la derecha, -1 a la izquierda) y sube la siguiente, o el final */
function advance(dir, v){
  if(!cur()) return;
  autoTok++; try{ if("speechSynthesis" in W) speechSynthesis.cancel(); }catch(e){}
  unbindSwipe(); closeHint();
  rv.i++; rv.c = null;
  flyOut(dir, v);
  if(rv.i < rv.q.length){ draw({rise: true}); return; }
  paintProg();
  const r0 = rv;
  clearTimeout(ui.endT);
  ui.endT = setTimeout(() => { if(rv === r0 && onRepaso()) draw(); }, rm() ? 60 : 340);
}
/* la tarjeta de siempre: la nota la pone él («¡Sí!» / «No»), salvo si la dijo bien con el micrófono */
function commit(g, dir, v){
  const c = rv && rv.c; if(!c || !cur()) return;
  score(g, {self: !c.said});
  advance(dir, v);
}
function flyOut(dir, v){
  const card = DOC.getElementById("rv-card"), stack = DOC.getElementById("rv-stack"), root = DOC.getElementById("rv");
  if(!card || !stack || !root) return;
  const sr = stack.getBoundingClientRect(), L = card.offsetLeft, T = card.offsetTop, Wd = card.offsetWidth, H = card.offsetHeight;
  const x0 = parseFloat(card.style.translate) || 0, r0 = parseFloat(card.style.rotate) || 0;
  card.removeAttribute("id"); card.querySelectorAll("[id]").forEach(e => e.removeAttribute("id"));
  card.inert = true; card.setAttribute("aria-hidden", "true");
  card.classList.remove("is-drag"); lean(card, dir > 0 ? "yes" : "no", 1);
  Object.assign(card.style, {position: "fixed", left: sr.left + L + "px", top: sr.top + T + "px", width: Wd + "px", height: H + "px",
    margin: "0", zIndex: "3", pointerEvents: "none"});
  root.appendChild(card);
  const gone = () => card.remove();
  setTimeout(gone, 700);
  try{
    const a = rm()
      ? card.animate([{opacity: 1}, {opacity: 0}], {duration: 120, easing: "ease-out", fill: "forwards"})
      : card.animate([{translate: `${x0}px 0px`, rotate: `${r0}deg`}, {translate: `${dir * (innerWidth + Wd)}px -24px`, rotate: `${dir * 16}deg`}],
          {duration: clamp(Math.round((innerWidth + Wd - Math.abs(x0)) / Math.max(1.6, Math.abs(v || 0))), 200, 320), easing: "cubic-bezier(.3,.5,.4,1)", fill: "forwards"});
    a.finished.then(gone, gone);
  }catch(e){ gone(); }
}

/* ---------- final y pantalla vacía ---------- */
function drawEnd(){
  rv.end = true; rv.c = null;
  unbindSwipe(); closeHint();
  const n = rv.total, st = Math.max(1, streak()), earned = rv.coins + 10, more = Math.min(CAP, dueList().length);
  if(!rv.endAt) rv.endAt = clock();
  $("#app").innerHTML = `<div class="rv-end pr-end" id="rv-end">
    <div class="rv-end-in"><section class="card rv-end-card" aria-labelledby="rv-end-t">
      <div class="rv-fox">${heroHtml(96)}</div>
      <h2 class="rv-end-t" id="rv-end-t" tabindex="-1">¡Repasaste ${nPals(n)}!</h2>
      <div class="rv-stats">
        <span class="rv-chip coin" id="rv-earn" aria-label="Ganaste ${earned} monedas">${COIN}+${earned}</span>
        <span class="rv-chip" aria-label="Racha: ${st === 1 ? "1 día seguido" : `${st} días seguidos`}">${ico("fire", "fill", 22)}${st === 1 ? "1 día seguido" : `${st} días seguidos`}</span></div>
      <div class="pr-row rv-more"></div></section></div>
    <button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block rv-end-go" id="rv-end-go" data-key="enter">Seguir</button>
    ${more ? `<button type="button" class="glass-btn glass-btn--lg glass-btn--block rv-end-more" id="rv-more-go">${ico("arrow-counter-clockwise", "bold", 20)}Otra tanda (${more} más)</button>` : ""}</div>`;
  updFocus(); scrollTo(0, 0);
  const go = $("#rv-end-go"), again = $("#rv-more-go");
  go.addEventListener("click", goHome);
  /* otro repaso corto con las que quedan (es opcional: «Seguir» es lo principal) */
  if(again) again.addEventListener("click", () => { if(rv && rv.end){ pay(null); rv = null; } repaso(); });
  /* un doble toque en «¡Sí!» (justo encima de donde sale «Seguir») no se salta el final */
  const left = (rm() ? 300 : 600) - (clock() - rv.endAt);
  if(left > 0){ for(const b of [go, again]) if(b){ b.inert = true; setTimeout(() => { b.inert = false; }, left); } }
  const t = $("#rv-end-t"); if(t) t.focus({preventScroll: true});
  pay($("#rv-earn"));
}
/* las monedas del final, una sola vez por repaso (aunque la pantalla se vuelva a pintar o se salga antes de verla) */
function pay(from){
  if(!rv || rv.paid) return;
  rv.paid = true;
  /* con from, las monedas vuelan desde el chip (que ya lleva el total) y no sale aviso: una sola cifra en pantalla */
  award(10, from ? "" : "¡Repaso terminado!", false, from || null);
  bus.emit("review-done", {n: rv.total});
}
const goHome = () => navTo("#/");
function nextDue(m){
  const t = today(), fut = m.filter(x => x && x.due > t);
  if(!fut.length) return "";
  const d = Math.min(...fut.map(x => x.due)), n = fut.filter(x => x.due === d).length, k = d - t;
  return k === 1 ? `¡Bien hecho! Mañana vuelven ${nPals(n)}.` : `¡Bien hecho! En ${k} días vuelven ${nPals(n)}.`;
}
async function drawEmpty(){
  const m = Object.values(srsAll());
  let href = "#/mapa";
  try{ const L = await nextLesson(); if(L && !L.done && L.l && L.l.id) href = "#/leccion/" + L.l.id; }catch(e){}
  if(!onRepaso()) return;
  const txt = m.length ? nextDue(m) || "¡Bien hecho! Tus palabras volverán pronto." : "Aprende palabras y aquí las repasarás.";
  $("#app").innerHTML = `<section class="rv-empty" aria-labelledby="rv-empty-t">
    <div class="rv-fox">${heroHtml(110)}</div>
    <h2 class="rv-empty-t" id="rv-empty-t">Todo repasado</h2>
    <p class="rv-empty-p">${esc(txt)}</p>
    <a class="glass-btn glass-btn--pri glass-btn--lg" id="rv-learn" href="${esc(href)}" data-key="enter">${ico("sparkle", "bold", 20)}Aprender nuevas</a></section>`;
}
/* las palabras que tocan son de temas que no se pueden abrir (sin conexión y sin descargar): no cuentan hasta que
   vuelva la red o se pruebe otra vez */
function drawCantLoad(){
  const off = navigator.onLine === false;
  $("#app").innerHTML = `<section class="rv-empty" id="rv-off" aria-labelledby="rv-empty-t">
    <div class="rv-fox">${heroHtml(110)}</div>
    <h2 class="rv-empty-t" id="rv-empty-t">${off ? "Sin conexión" : "Ahora no puedo abrir tus palabras"}</h2>
    <p class="rv-empty-p">${off ? "Tus palabras te esperan. Prueba otra vez con internet." : "Prueba otra vez en un rato."}</p>
    <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="rv-retry" data-key="enter">${ico("arrow-counter-clockwise", "bold", 20)}Probar otra vez</button></section>`;
  $("#rv-retry").addEventListener("click", () => { SRS_OFF.clear(); updBadge(); route(); });
}

/* ---------- entrar en #/repaso ---------- */
async function repaso(){
  /* un repaso a medias (se salió con la ✕, con «atrás» o por otra pestaña) sigue donde estaba */
  if(rv && rv.q && rv.i < rv.q.length && !rv.end){
    const c = rv.c;
    if(c && !c.flip){ c.t0 = clock(); c.paused = 0; c.pz.clear(); c.pauseAt = 0; c.mic = c.mic === "listening" ? "idle" : c.mic; }
    /* una tarjeta que corrige la app, ya bien contestada (se salió antes de que pasara sola): ya tiene su nota, pasa */
    if(c && c.graded && c.kind !== "card" && c.g > 0){ rv.i++; rv.c = null; }
    draw({first: true}); updFocus(); scrollTo(0, 0); refitTask();   /* medida ya en modo foco */
    /* una tarjeta dicha bien que se quedó sin nota (por si acaso): se da por decidida y pasa */
    if(c && rv && rv.c === c && c.said && !c.decided){ c.decided = true; commit(grade(true, c), 1, 0); }
    return;
  }
  rv = null;
  if(dueList().length){
    const res = await rvStart();
    if(rv || !onRepaso()) return;
    if((res && res.off) || dueList().length) return drawCantLoad();
  }
  await drawEmpty();
}
/* ¿el tema ya no existe? (no está en el índice y el servidor dice 404; sin red nunca se sabe: no se quita nada) */
async function docGone(id, idx){
  if(!Array.isArray(idx) || idx.some(d => d && d.id === id) || navigator.onLine === false) return false;
  try{ const r = await fetch(`data/${id}.json`, {cache: "no-store"}); return r.status === 404; }catch(e){ return false; }
}
/* un repaso nuevo: {n: tarjetas, off: temas que no se pudieron abrir} */
async function rvStart(){
  const t = today(), due = Object.entries(srsAll()).filter(([, x]) => x && x.due <= t && !SRS_OFF.has(x.d));
  const ids = [...new Set(due.map(([, x]) => x.d))];
  const [idx, ok] = await Promise.all([getIndex().catch(() => null), Promise.all(ids.map(id => getDoc(id).then(() => true, () => false)))]);
  const gone = await Promise.all(ids.map((id, i) => ok[i] ? false : docGone(id, idx)));
  if(!onRepaso()) return {n: 0, off: 0};
  const off = ids.filter((id, i) => !ok[i] && !gone[i]), dead = [], q = [];
  const rowOf = x => { const d = CACHE[x.d]; return d && Array.isArray(d.rows) ? d.rows.find(r => r && r.es === x.e && r.l && r.l[lang] && r.l[lang].word) : null; };
  /* lo que ya no existe se quita del repaso: su tema ya no está, o está (abierto) y no tiene esa palabra; en los temas
     ya abiertos se mira también lo que aún no toca */
  for(const [k, x] of Object.entries(srsAll())){
    if(!x || !x.d) continue;
    const i = ids.indexOf(x.d);
    if(i >= 0 && gone[i]){ dead.push(k); continue; }
    if(CACHE[x.d] && !rowOf(x)) dead.push(k);
  }
  for(const [k, x] of due){
    if(off.includes(x.d) || dead.includes(k)) continue;
    const r = rowOf(x); if(r) q.push({id: x.d, r, x, w: Math.random()});
  }
  if(dead.length) srsDrop(dead);
  if(off.length){ for(const id of off) SRS_OFF.add(id); updBadge(); }
  /* primero las que más esperan y, entre ellas, las de caja más baja; 20 como mucho */
  q.sort((a, b) => (a.x.due - b.x.due) || ((+a.x.b || 0) - (+b.x.b || 0)) || (a.w - b.w));
  const take = q.slice(0, CAP).map(({id, r, x}) => ({id, r, x}));
  if(!take.length){ rv = null; return {n: 0, off: off.length}; }
  rv = {q: take, i: 0, done: 0, total: take.length, coins: 0, flips: 0, sid: clock().toString(36) + Math.random().toString(36).slice(2, 6), c: null,
    docs: [...new Set(take.map(it => it.id))]};
  for(const it of take){ prep(it, rv.docs); it.ready = true; }
  draw({first: true}); updFocus(); scrollTo(0, 0); refitTask();   /* medida ya en modo foco */
  return {n: take.length, off: off.length};
}

/* ---------- la ✕ y «¿Paramos aquí?» ---------- */
let PZ = null;
function pauseSheet(){
  if(PZ && PZ.isConnected) return PZ;
  const d = DOC.createElement("dialog");
  d.id = "rv-pause"; d.className = "rv-pz-d"; d.setAttribute("aria-labelledby", "rv-pz-t");
  d.dataset.noRenew = ""; d.dataset.noHint = "";
  d.innerHTML = `<div class="rv-pz">
    <span class="rv-pz-ic" aria-hidden="true">${ico("pause", "bold", 28)}</span>
    <h2 class="rv-pz-t" id="rv-pz-t">¿Paramos aquí?</h2>
    <p class="rv-pz-p">Luego sigues donde lo dejaste.</p>
    <div class="rv-pz-b">
      <button type="button" class="glass-btn glass-btn--lg" id="rv-pz-out">Salir</button>
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="rv-pz-go" data-key="enter" autofocus>Seguir</button></div></div>`;
  DOC.body.appendChild(d);
  d.addEventListener("click", e => {
    if(e.target.closest("#rv-pz-go")){ if(W.M && W.M.closeSheet) W.M.closeSheet(d); else d.close(); }
    else if(e.target.closest("#rv-pz-out")){ try{ d.close(); }catch(_){} leave(); }
  });
  d.addEventListener("close", () => { if(rv && rv.c) pauseT(rv.c, "sheet", false); });
  PZ = d;
  return d;
}
/* sale a donde estaba antes de entrar (la ✕ ya lo sabe); si era el propio repaso, a Hoy. El repaso queda abierto. */
function leave(){
  const x = DOC.getElementById("fx-x");
  let to = x ? x.getAttribute("href") : "#/";
  if(!to || /^#\/?repaso/.test(to)) to = "#/";
  const y = HASHY[to]; if(to !== location.hash && y > 0) tabRestore = y;
  navTo(to);
}
function exit(from){
  if(!rv || !onRepaso()) return false;
  if(rv.end || rv.i >= rv.q.length){ leave(); return true; }
  stopMic();
  const d = pauseSheet();
  if(d.open) return true;
  if(rv.c) pauseT(rv.c, "sheet", true);
  try{
    if(W.M && typeof W.M.openSheet === "function") W.M.openSheet(d, {from: from && from.nodeType === 1 ? from : null});
    else d.showModal();
  }catch(e){ try{ d.showModal(); }catch(_){ d.setAttribute("open", ""); } }
  return true;
}

/* ---------- toques y teclas ---------- */
function wire(root){
  root.addEventListener("click", e => {
    if(!rv || !rv.c) return;
    const b = e.target.closest("[data-rv]");
    if(b && root.contains(b)){
      const c = rv.c, k = b.dataset.rv;
      if(k === "yes") decide(true);
      else if(k === "no") decide(false);
      else if(k === "hint") hintStep();
      else if(k === "giveup"){ c.hinted = true; c.gaveUp = true; flip("giveup"); }
      else if(k === "next") next();
      else if(k === "look") flip("look");
      else if(k === "mic") speak();
      else if(k === "spk") replay(false);
      else if(k === "slow") replay(true);
      else if(k === "opt") choose(+b.dataset.i);
      else if(k === "tile") tileTap(+b.dataset.i);
      else if(k === "tip") tip();
      else if(k === "tnext") taskNext();
      return;
    }
    if(rv.c.kind !== "card") return;
    if(e.target.closest("#rv-card")){ if(!rv.c.flip) flip("tap"); else if(!rv.c.said) replay(false); }
  });
  root.addEventListener("keydown", e => {
    if((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("rv-q") && rv && rv.c && !rv.c.flip){
      e.preventDefault(); e.stopPropagation(); flip("tap");
    }
  });
}
DOC.addEventListener("keydown", e => {
  if(!rv || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || !onRepaso()) return;
  if(DOC.querySelector("dialog[open]")) return;
  const t = e.target && e.target.closest ? e.target : null;
  if(t && t.closest("input,textarea,select,[contenteditable='true'],[contenteditable='']")) return;
  const onCtl = !!(t && t.closest("button,a[href],[role=button]:not(.rv-q)"));
  if(rv.end){ if(e.key === "Enter" && !onCtl && clock() - (rv.endAt || 0) >= (rm() ? 300 : 600)){ e.preventDefault(); goHome(); } return; }
  const c = rv.c; if(!c) return;
  if(e.key === "Escape"){ e.preventDefault(); exit(DOC.getElementById("fx-x")); return; }
  /* las que corrige la app: 1-4 eligen, las letras ponen fichas, Espacio la oye (antes de contestar, solo en «Escucha y
     elige»), Intro sigue tras un fallo. Fallada, el foco va a «Seguir»: ahí Intro es su clic, pero Espacio (y Mayús+Espacio)
     la vuelve a decir, como dicen sus etiquetas en el altavoz y la tortuga, y no la salta (preventDefault quita el clic
     de Espacio del botón) */
  if(c.kind !== "card"){
    if(e.key === " " || e.key === "Enter"){
      if(onCtl && !(e.key === " " && c.graded && t.closest(".rv-next"))) return;
      e.preventDefault();
      if(c.graded && c.g === 0 && e.key === "Enter") taskNext();
      /* sin contestar solo suena «Escucha y elige»: en «¿Cuál es…?» y en las letras, oírla sería decir la respuesta (con el
         dedo tampoco se puede: no hay altavoz hasta contestar) */
      else if(e.key === " " && c.graded) replay(e.shiftKey);
      else if(e.key === " " && c.kind === "listen") e.shiftKey ? replay(true) : hearIt(0);
      return;
    }
    if(c.graded) return;
    if(c.kind === "spell"){ if(e.key.length === 1 && isL(e.key) && typeTile(e.key)) e.preventDefault(); return; }
    if(/^[1-4]$/.test(e.key)){ e.preventDefault(); choose(+e.key - 1); }
    return;
  }
  if(e.key === " " || e.key === "Enter"){
    if(onCtl) return;
    e.preventDefault();
    if(!c.flip) flip("tap");
    else if(e.key === "Enter" && c.gaveUp) next();
    else if(e.key === " " && !c.said) replay(e.shiftKey);
    return;
  }
  if(!c.flip || c.decided || c.said) return;
  if(c.gaveUp){ if(e.key === "ArrowRight" || e.key === "ArrowLeft"){ e.preventDefault(); next(); } return; }
  if(e.key === "ArrowRight"){ e.preventDefault(); decide(true); }
  else if(e.key === "ArrowLeft"){ e.preventDefault(); decide(false); }
});
DOC.addEventListener("visibilitychange", () => { if(rv && rv.c) pauseT(rv.c, "hidden", DOC.hidden); });
/* sin internet el micrófono se va (y vuelve con la red) */
const onNet = () => { if(rv && rv.c && rv.c.kind === "card" && !rv.c.flip && onRepaso()){ if(navigator.onLine === false) stopMic(); paintDock(); } };
W.addEventListener("online", onNet); W.addEventListener("offline", onNet);
/* al irse a otra pantalla: se para el micrófono, se cierra la hoja y, si ya había terminado, se olvida el repaso */
bus.on("route", d => {
  if(String((d && d.h) || "").startsWith("repaso")) return;
  stopMic(); unbindSwipe(); closeHint(); clearTimeout(ui.endT);
  if(PZ && PZ.open) try{ PZ.close(); }catch(e){}
  if(rv && (rv.end || rv.i >= rv.q.length)){ pay(null); rv = null; }
});

ROUTES.repaso = () => repaso();
W.repaso = repaso; W.rvStart = rvStart; W.rvDraw = draw;
W.vocabReview = {
  get state(){
    if(!rv) return null;
    const it = cur(), c = rv.c || {};
    return {open: rvOpen(), end: !!rv.end, i: rv.i, left: Math.max(0, rv.q.length - rv.i), total: rv.total, done: rv.done, coins: rv.coins,
      id: it ? it.id : null, es: it ? it.r.es : null, key: it ? srsK(it.id, it.r) : null, word: it ? it.r.l[lang].word : null,
      flip: !!c.flip, hint: c.hint || 0, hinted: !!c.hinted, said: !!c.said, gaveUp: !!c.gaveUp, again: !!c.again, miss: c.miss || 0,
      mic: c.mic || "", msg: c.msg || "", paid: !!rv.paid,
      kind: c.kind || (it && it.kind) || null, box: it && it.x ? +it.x.b || 0 : null, graded: !!c.graded, g: c.g == null ? null : c.g,
      put: c.put || 0, bad: c.bad || 0, opts: it && it.opts ? it.opts.map(r => r.es) : null, right: it && it.opts ? it.opts.indexOf(it.r) : -1,
      letters: it && it.sp ? it.sp.chars.filter(isL).join("") : null, tiles: it && it.tiles ? it.tiles.map(t => t.c) : null,
      queue: rv.q.map(x => x.r.es)};
  },
  exit, open: () => rvOpen(), hints, matches, grade, kindOf, spellOf, CAP,
};
})();
