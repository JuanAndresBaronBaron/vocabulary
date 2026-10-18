/* Módulo review (window.vocabReview): Aprender › Repasar (#/repaso), el repaso espaciado con tarjetas y «Dilo primero».
   · #/repaso empieza directamente si hay palabras pendientes (dueList()), en modo foco (html[data-focus=repaso]): arriba
     la barra de progreso junto a la ✕ y el contador de monedas; la ✕ (y Esc) abre la hoja «¿Paramos aquí?» (Seguir ·
     Salir). Salir a medias deja el repaso abierto (rv, en index.html): el accesorio «Seguir · Repaso» lo retoma.
   · Pila de tarjetas (detrás asoman las 2 siguientes). Cara de la pregunta: el dibujo (o, si no hay, la palabra en
     español en grande), la palabra en español, «¿Cómo se dice en inglés?» y «Toca para ver» (sin micrófono, «Piénsala… y
     toca para ver»). Abajo, siempre, el botón principal «Ver» (como tocar la tarjeta, Espacio o Intro: la gira en 3D,
     350 ms, sin quitar puntos) y una fila con «Dilo en inglés» (solo con micrófono) y «Pista». Cara de la respuesta: la
     palabra en el idioma con su altavoz y la tortuga (y el IPA si un mayor lo activó, vocabUI.get().ipa); debajo «¿La
     sabías?» con «No» (gris) y «¡Sí!» (verde). Deslizar la tarjeta girada a la derecha = Sí, a la izquierda = No: sigue
     al dedo, se inclina hasta ±8°, se tiñe de verde o de gris con el sello en una esquina y sale volando; la siguiente
     sube de la pila. Teclas: Espacio (girar / oír; Mayús+Espacio despacio), ← No, → Sí, Esc «¿Paramos aquí?». La pista
     «Desliza: sí o no» (G.hint) sale la segunda vez que se gira una tarjeta para decidir.
   · Nota para srsGrade (el de siempre, mismo formato): «No» = 0; «¡Sí!» = 2 si no pidió pista y giró en 8 s como mucho
     (sin contar el rato escuchando, con la hoja abierta o con la app escondida); si no, 1. Una tarjeta con 0 vuelve al
     final de la cola, como antes; esa segunda vez (acaba de ver la respuesta) vale 1 como mucho. Cada nota > 0 da esas
     monedas (award(g, "", true)).
   · «Pista» por escalones (Dilo primero): 1) el artículo y la primera letra («le c…», «en h…», «l'o…»; sin artículo,
     «o…»), 2) la primera sílaba y huecos para lo que falta («le che _ _ _», «os _ _ _ _ _»), 3) «Ver». Cada escalón se
     queda en la tarjeta; con los dos, «Pista» se va (queda «Ver»).
   · Dilo primero, solo si canListen() y hay internet (no en la app instalada del iPhone): «Dilo en inglés» escucha con
     listen() (7 s como mucho) en el idioma de la palabra y compara sin mayúsculas, tildes, signos ni artículo, con todas
     las alternativas del reconocedor: exacta hasta 4 letras, una letra de diferencia de 5 a 7 y dos desde 8, empezando
     por la misma letra; nunca vale otra palabra de verdad de los temas cargados («bat» por «cat», «horse» por «house»).
     Si acierta: gira con ✓ verde, nota 2 (1 si pidió pista) y pasa sola tras el audio (nunca antes de 0,9 s); si se va
     del repaso mientras tanto, la nota se escribe igual. Si no coincide: «No te he oído bien», «Otra vez» y «No me
     sale»; a la segunda, se va el micrófono y «¡No pasa nada! Mírala y dime si la sabías.»; nunca pone 0 porque falle el
     reconocedor. Sin internet, sin micrófono o sin permiso, lo dice una vez («Sin internet no puedo oírte…») y el
     micrófono se va. «No me sale» gira, suena y dice «Así se dice. ¡La verás otra vez!» con un solo «Seguir» (nota 0).
   · Final en una tarjeta: «¡Repasaste N palabras!», las monedas (el chip lleva el total y de él vuelan las 10 del
     final: award(10, "", false, from), una sola vez y sin aviso), racha y «Seguir» (siempre a Hoy; no responde hasta
     0,6 s después de salir, para que un doble toque no se lo salte). bus "review-card" {grade, es, word} por tarjeta y
     "review-done" {n} al terminar, como antes.
   · Sin pendientes: el zorro, «Todo repasado», cuándo vuelven y «Aprender nuevas» (la siguiente lección del camino).
   window.vocabReview = {state, exit(from) → true si se encargó de la ✕, open() → hay un repaso a medias,
     hints(word, lang) → [paso 1, paso 2], matches(alts, word, lang) → boolean, grade(yes, card) → 0 | 1 | 2}
   Usa de index.html: rv (estado global), dueList, srsAll, srsK, srsGrade, getDoc, CACHE, shuffle, award, streak,
   heroHtml, say, sayP, autoTok, updFocus, navTo, canListen, listen, recNow, nextLesson, fitWord, lang, LANGS; de
   js/lesson.js, vocabLesson.syllables (las pistas). Iconos: Phosphor. */
(() => {
"use strict";
const W = window, DOC = document;
const THINK_MS = 8000;     /* girarla antes de 8 s y sin pista: «¡Sí!» vale 2 */
const AFTER_OK_MS = 900;   /* tras decirla bien, la tarjeta no se va antes de 0,9 s */
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
const newCard = it => ({flip: false, hint: 0, hinted: false, gaveUp: false, said: false, decided: false, mic: "idle", msg: "", miss: 0,
  again: !!(it && it.again), t0: clock(), paused: 0, pz: new Set(), pauseAt: 0, thinkMs: 0});
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
.rv-picw{display:flex;align-items:center;justify-content:center;flex:0 1 auto;min-height:0}
.rv-pic{display:block;width:auto;height:auto;max-width:min(168px,62%);max-height:min(168px,22svh);object-fit:contain;-webkit-user-drag:none}
${DARK(".rv-pic", "background:#F2F2F7;border-radius:var(--r-md);padding:6px")}
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
.rv-ipa{margin:2px 0 0;color:var(--label2);font:400 var(--fs-sub)/1.3 var(--f-text)}
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
@keyframes rv-in{from{opacity:0;scale:.9}to{opacity:1;scale:1}}
@keyframes rv-wave{0%{opacity:.55;scale:.9}100%{opacity:0;scale:1.28}}
@keyframes rv-hop{0%{translate:0 0}35%{translate:0 -14px}70%{translate:0 0}85%{translate:0 -4px}100%{translate:0 0}}
@media (prefers-reduced-motion:reduce){
  .rv-flip{transition:none;transform:none!important}
  .rv-a{transform:none}
  .rv-face{transition:opacity .15s ease}
  .rv-card:not(.is-flipped) .rv-a,.rv-card.is-flipped .rv-q{opacity:0}
  .rv-h,.rv-fox .hero,.rv-spk.playing::after{animation:none}
  .rv-prog i{transition:none}}
@media (prefers-contrast:more){.rv-face{border:2px solid var(--sep)}}
:root[data-contrast=more] .rv-face{border:2px solid var(--sep)}
@media (forced-colors:active){.rv-face{border:2px solid CanvasText}.rv-prog i{background:Highlight}.rv-tint{display:none}}
@media (max-height:700px){.rv-stage{padding-bottom:24px}.rv-face{padding:16px}.rv-pic{max-height:min(120px,18svh)}.rv-es{margin-top:8px}.rv-qq{margin-top:4px}
  .rv-tap{margin-top:12px}.rv-audio{margin-top:12px}.rv-hints{margin-top:8px}.rv-end-card{padding:16px}}
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
const uiPrefs = () => { try{ return (W.vocabUI && typeof W.vocabUI.get === "function" && W.vocabUI.get()) || {}; }catch(e){ return {}; } };
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
  const r = it.r, d = r.l[lang], ipa = uiPrefs().ipa && d.ipa;
  return `<div class="rv-face rv-a" role="group" aria-label="Respuesta">
    <span class="rv-said" hidden>${CHK}</span>
    ${r.img ? `<div class="rv-picw"><img class="rv-pic" src="${esc(r.img)}" alt="" draggable="false"></div>` : ""}
    <p class="rv-word" lang="${esc(code())}" tabindex="-1">${esc(d.word)}</p>
    <p class="rv-tr">${esc(r.es)}</p>
    ${ipa ? `<p class="rv-ipa">${esc(d.ipa)}</p>` : ""}
    <div class="rv-audio">
      <button type="button" class="rv-spk" data-rv="spk" aria-label="Escuchar">${ico("speaker-high", "fill", 32)}</button>
      <button type="button" class="rv-slow" data-rv="slow" aria-label="Escuchar despacio">${ico("turtle", "fill", 30)}</button></div></div>`;
}
function hintsHtml(it, c){
  if(!c || !c.hint) return "";
  return hints(it.r.l[lang].word, lang).slice(0, c.hint)
    .map((h, k) => `<p class="rv-h" data-step="${k + 1}" lang="${esc(code())}">${esc(h)}</p>`).join("");
}
function dockHtml(){
  const c = rv.c, name = LANGS[lang].name;
  if(c.flip){
    if(c.said) return `<p class="rv-good">${ico("check-circle", "fill", 30)}¡Muy bien!</p>`;
    /* «No me sale»: ya dijo que no la sabía, así que no se le pregunta; nota 0 y vuelve luego */
    if(c.gaveUp) return `<p class="rv-ask rv-ask--give">Así se dice. ¡La verás otra vez!</p>
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block rv-next" data-rv="next">Seguir</button>`;
    return `<p class="rv-ask" id="rv-ask">¿La sabías?</p>
      <div class="rv-yn" role="group" aria-labelledby="rv-ask">
        <button type="button" class="glass-btn glass-btn--lg rv-no" data-rv="no">${ico("x", "bold", 22)}No</button>
        <button type="button" class="glass-btn glass-btn--ok glass-btn--lg rv-yes" data-rv="yes">${ico("check", "bold", 22)}¡Sí!</button></div>`;
  }
  /* la pregunta: «Ver» siempre es lo principal (tocando todo se puede); el micrófono solo da extra */
  const msg = c.msg ? `<p class="rv-msg" role="status">${esc(c.msg)}</p>` : "";
  const look = `<button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block rv-look" data-rv="look">${ico("eye", "bold", 22)}Ver</button>`;
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
  return `<div class="rv" id="rv"${micOk() ? " data-mic" : ""}>
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
  const nx = rv.q[rv.i + 1]; if(nx && nx.r.img){ const im = new Image(); im.src = nx.r.img; }   /* el dibujo de la siguiente, ya cargado */
}
/* pinta la tarjeta actual (o el final); con rise la nueva sube de la pila */
function draw(o = {}){
  if(!rv) return;
  if(rv.i >= rv.q.length) return drawEnd();
  if(!rv.c) rv.c = newCard(cur());
  let root = DOC.getElementById("rv");
  const a = DOC.activeElement, lost = !a || a === DOC.body || !!(root && root.contains(a));
  if(!root || root.dataset.sid !== rv.sid){
    $("#app").innerHTML = shell();
    root = DOC.getElementById("rv"); root.dataset.sid = rv.sid; wire(root);
  }
  paintProg(); mountCard(!!o.rise); paintDock();
  /* una tarjeta nueva: el lector de pantalla la lee (el foco va a la tarjeta, no a un botón de abajo) */
  if(o.rise || o.first){
    const it = cur(), q = DOC.querySelector("#rv-card .rv-q");
    if(o.rise && lost && q) q.focus({preventScroll: true});
    else if(it) live(`${esc(it.r.es)}. ¿Cómo se dice en ${esc(LANGS[lang].name)}?`);
  }
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
    live(`¡Muy bien! ${inL(word)}`);
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
  if(!cur()) return;
  record(g);
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
/* la nota va a srsGrade (el de siempre); con 0 la tarjeta vuelve al final de la cola (y entonces vale 1 como mucho) */
function record(g){
  const it = cur(); if(!it) return null;
  srsGrade(it.id, it.r, g);
  if(g){ award(g, "", true); rv.coins += g; }
  bus.emit("review-card", {grade: g, es: it.r.es, word: it.r.l[lang].word});
  if(g === 0){ it.again = true; rv.q.push(it); } else rv.done++;
  rv.i++; rv.c = null;
  return it;
}
/* …y la tarjeta sale volando */
function commit(g, dir, v){
  if(!cur()) return;
  autoTok++; try{ if("speechSynthesis" in W) speechSynthesis.cancel(); }catch(e){}
  unbindSwipe(); closeHint();
  record(g);
  flyOut(dir, v);
  if(rv.i < rv.q.length){ draw({rise: true}); return; }
  paintProg();
  const r0 = rv;
  clearTimeout(ui.endT);
  ui.endT = setTimeout(() => { if(rv === r0 && onRepaso()) draw(); }, rm() ? 60 : 340);
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
  const n = rv.total, st = Math.max(1, streak()), earned = rv.coins + 10;
  if(!rv.endAt) rv.endAt = clock();
  $("#app").innerHTML = `<div class="rv-end pr-end" id="rv-end">
    <div class="rv-end-in"><section class="card rv-end-card" aria-labelledby="rv-end-t">
      <div class="rv-fox">${heroHtml(96)}</div>
      <h2 class="rv-end-t" id="rv-end-t" tabindex="-1">¡Repasaste ${nPals(n)}!</h2>
      <div class="rv-stats">
        <span class="rv-chip coin" id="rv-earn" aria-label="Ganaste ${earned} monedas">${COIN}+${earned}</span>
        <span class="rv-chip" aria-label="Racha: ${st === 1 ? "1 día seguido" : `${st} días seguidos`}">${ico("fire", "fill", 22)}${st === 1 ? "1 día seguido" : `${st} días seguidos`}</span></div>
      <div class="pr-row rv-more"></div></section></div>
    <button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block rv-end-go" id="rv-end-go">Seguir</button></div>`;
  updFocus(); scrollTo(0, 0);
  const go = $("#rv-end-go");
  go.addEventListener("click", goHome);
  /* un doble toque en «¡Sí!» (justo encima de donde sale «Seguir») no se salta el final */
  const left = (rm() ? 300 : 600) - (clock() - rv.endAt);
  if(left > 0){ go.inert = true; setTimeout(() => { go.inert = false; }, left); }
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
    <a class="glass-btn glass-btn--pri glass-btn--lg" id="rv-learn" href="${esc(href)}">${ico("sparkle", "bold", 20)}Aprender nuevas</a></section>`;
}
function drawCantLoad(){
  $("#app").innerHTML = `<section class="rv-empty" aria-labelledby="rv-empty-t">
    <div class="rv-fox">${heroHtml(110)}</div>
    <h2 class="rv-empty-t" id="rv-empty-t">Ahora no puedo abrir tus palabras</h2>
    <p class="rv-empty-p">Prueba otra vez con internet.</p>
    <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="rv-retry">${ico("arrow-counter-clockwise", "bold", 20)}Probar otra vez</button></section>`;
  $("#rv-retry").addEventListener("click", () => route());
}

/* ---------- entrar en #/repaso ---------- */
async function repaso(){
  /* un repaso a medias (se salió con la ✕, con «atrás» o por otra pestaña) sigue donde estaba */
  if(rv && rv.q && rv.i < rv.q.length && !rv.end){
    const c = rv.c;
    if(c && !c.flip){ c.t0 = clock(); c.paused = 0; c.pz.clear(); c.pauseAt = 0; c.mic = c.mic === "listening" ? "idle" : c.mic; }
    draw({first: true}); updFocus(); scrollTo(0, 0);
    /* una tarjeta dicha bien que se quedó sin nota (por si acaso): se da por decidida y pasa */
    if(c && c.said && !c.decided && rv.c === c){ c.decided = true; commit(grade(true, c), 1, 0); }
    return;
  }
  rv = null;
  if(dueList().length){ await rvStart(); if(rv || !onRepaso()) return; if(dueList().length) return drawCantLoad(); }
  await drawEmpty();
}
async function rvStart(){
  const due = dueList(), ids = [...new Set(due.map(x => x.d))];
  await Promise.all(ids.map(id => getDoc(id).catch(() => null)));
  if(!onRepaso()) return;
  const q = shuffle(due.map(x => { const doc = CACHE[x.d], r = doc && doc.rows.find(r => r.es === x.e && r.l && r.l[lang]); return r ? {id: x.d, r} : null; }).filter(Boolean));
  if(!q.length){ rv = null; return; }
  rv = {q, i: 0, done: 0, total: q.length, coins: 0, flips: 0, sid: clock().toString(36) + Math.random().toString(36).slice(2, 6), c: null};
  draw({first: true}); updFocus(); scrollTo(0, 0);
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
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg" id="rv-pz-go" autofocus>Seguir</button></div></div>`;
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
      return;
    }
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
const onNet = () => { if(rv && rv.c && !rv.c.flip && onRepaso()){ if(navigator.onLine === false) stopMic(); paintDock(); } };
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
      mic: c.mic || "", msg: c.msg || "", paid: !!rv.paid};
  },
  exit, open: () => rvOpen(), hints, matches, grade,
};
})();
