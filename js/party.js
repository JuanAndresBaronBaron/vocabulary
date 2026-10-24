/* módulo party: dos juegos de Jugar › Juegos registrados con vocabGames.register (como js/lince.js).
   Rutas: #/juegos/impostor («El impostor») · #/juegos/ordenar («Ordenar por grupo»). #/juegos/impostor?m=grupo|solo
     entra directo en un modo.
   El impostor
     En grupo (de 3 a 8, con un solo aparato que se pasan): se escriben los nombres (el aparato recuerda los últimos).
       Cada uno toca su nombre y ve su papel a solas: el civil ve la palabra secreta (dibujo, palabra, IPA, audio y su
       español); el impostor ve «¡Eres el impostor!» y una pista (la palabra de la familia: animal, food, …). «Tapar y
       pasar» lo tapa antes de pasar el aparato. Luego 3 rondas: la app dice a quién le toca decir en voz alta una
       palabra relacionada (el impostor nunca empieza). Se vota entre todos tocando un nombre. Si pillan al impostor,
       tiene una última oportunidad: adivinar la palabra entre 4 dibujos (así aprende la palabra aunque pierda).
     Solo: el niño juega con el zorro y sus amigos (img/pj). Cada personaje dice y enseña una palabra en el idioma (con
       su audio y su IPA) y en su turno el niño elige una de 3 palabras. Normalmente uno de los personajes es el
       impostor y dice palabras de otra cosa de la misma familia (se acercan pero no encajan): el niño vota quién es.
       Una de cada tres partidas (más o menos) el impostor es el niño: oye a los demás, elige palabras que encajen para
       que no le pillen y al final adivina la palabra entre 4 dibujos.
   Ordenar por grupo: 8-12 palabras con dibujo (2 cestas con 5 o 3 con 4). Cada cesta lleva el nombre del grupo en el
     idioma (con IPA y su altavoz) y un dibujo. Se toca la palabra y luego la cesta, o se arrastra (G.drag). Cada
     palabra suena al salir y al tocarla. Fallar: la cesta en gris con ✗, sin sonido triste; al segundo fallo con la
     misma palabra, su cesta se ilumina en verde.
   Los dos usan de games.js lo de los demás juegos: tarjeta del menú, récord, explicación la primera vez, «?», pausa y
     finish() (récord en "games:best", monedas con award desde «+N»: las mismas reglas que los otros juegos).
   Datos: data/party.json (sacado del vocabulario de los temas de Juegos): words {id: {es, d, img, english|français|
     dansk: [palabra, IPA]}}, impostor {familia: {hint, cases: [{w, rel}]}} y sort {groups, sets}.
   Guarda: "party:st" (solo de este aparato) {names: los últimos jugadores, imp: los últimos casos, sort: los últimos
     grupos}, para no repetir. Voz: say() y sayP() de index.html.
   Teclas: Enter (el botón principal), 1-4 (las opciones), Espacio (oír otra vez). */
(() => {
"use strict";

const IMP = "impostor", SORT = "ordenar", KEY = "party:st", ROUNDS = 3;
const num = v => Number.isFinite(+v) ? +v : 0;
const IC = (n, s = "bold", z = 22, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
const RM = () => { try{ return !!(window.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const code = () => (LANGS[lang] || LANGS.english).code;
const pick = a => a[Math.floor(Math.random() * a.length)];
/* los personajes del modo solo (no son palabras secretas: un «Perro» que dice «bone» liaría) */
const PJS = [["zorro", "Zorro"], ["buho", "Búho"], ["panda", "Panda"], ["oso", "Oso"], ["rana", "Rana"], ["tortuga", "Tortuga"]];
/* colores de los jugadores (blanco encima con contraste ≥ 4,5) */
const COLS = ["#1f5fbf", "#13787f", "#22409a", "#2b7a4b", "#4b5563", "#0f2f57", "#1c6a8a", "#3d5a80"];

/* ---------- datos ---------- */
let DATA = null;
function load(){
  if(!DATA) DATA = fetch("data/party.json").then(r => { if(!r.ok) throw new Error("data/party.json " + r.status); return r.json(); })
    .catch(e => { DATA = null; throw e; });
  return DATA;
}
const pic = src => (window.vocabGames && typeof vocabGames.pic === "function") ? vocabGames.pic(src) : src;
/* la palabra id en el idioma de ahora: {id, es, img, d, word, ipa} o null */
function W(D, id){
  const x = D && D.words && D.words[id], l = x && x[lang];
  if(!l || typeof l[0] !== "string" || !l[0].trim()) return null;
  return {id, es: String(x.es || ""), img: typeof x.img === "string" && /^img\/[\w.\-\/]+\.png$/.test(x.img) ? x.img : null, d: x.d || "", word: l[0].trim(), ipa: l[1] || ""};
}
function st(){ let v = null; try{ v = store.get(KEY, null); }catch(e){} return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
function stSet(patch){ try{ store.set(KEY, Object.assign(st(), patch)); }catch(e){} }
/* lo último que salió va al final de la cola (para no repetir) */
function remember(k, id, max){ const s = st(), a = (Array.isArray(s[k]) ? s[k] : []).filter(x => x !== id); a.push(id); stSet({[k]: a.slice(-max)}); }
const recent = k => { const a = st()[k]; return Array.isArray(a) ? a : []; };
function fresh(list, k, idOf){
  const r = recent(k), n = list.filter(x => !r.includes(idOf(x)));
  return n.length ? n : list.filter(x => idOf(x) !== r[r.length - 1]);
}

/* ---------- trocitos ---------- */
const imgHtml = (src, cls = "") => {
  if(!src) return "";
  const s = pic(src);
  return `<img${cls ? ` class="${cls}"` : ""} src="${esc(s)}"${s !== src ? ` data-f="${esc(src)}" onerror="if(this.dataset.f){this.src=this.dataset.f;delete this.dataset.f}"` : ""} alt="" draggable="false">`;
};
const wHtml = w => `<span class="pt-w" lang="${esc(code())}">${esc(w.word)}</span>${ipaHtml(w.ipa, code(), "pt-ipa")}`;
const talk = w => { try{ if(w && w.word) say(w.word); }catch(e){} };
const talkP = w => { try{ return w && w.word ? sayP(w.word) : Promise.resolve(); }catch(e){ return Promise.resolve(); } };
const stopTalk = () => { try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch(e){} };
const avHtml = (name, i, cls = "") => `<span class="pt-av${cls ? " " + cls : ""}" style="--c:${COLS[i % COLS.length]}" aria-hidden="true">${esc([...String(name).trim()][0] || "?").toUpperCase()}</span>`;
const pjImg = (p, cls = "pt-pj") => `<img class="${cls}" src="img/pj/${esc(p.id)}.png" alt="" draggable="false">`;
const meAv = (cls = "pt-me") => `<span class="${cls}" aria-hidden="true">${IC("user", "bold", 26)}</span>`;
const visible = el => !!el && !el.disabled && !el.closest("[hidden]") && el.getClientRects().length > 0;
/* teclas en la partida (keys.js solo atiende Esc y ? con html[data-gm-play]): pulsa el data-key que se vea */
function useKeys(api, run){
  api.keys(run, e => {
    if(e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const t = e.target;
    if(t && t.closest && t.closest("input,textarea,select")) return;
    const k = e.key === "Enter" ? "enter" : e.key === " " ? "space" : /^[1-4]$/.test(e.key) ? e.key : null;
    if(!k) return;
    if(t && t.closest && ((k === "enter" && t.closest("button,a")) || (k === "space" && t.closest("button")))) return;
    const el = [...run.root.querySelectorAll(`[data-key~="${k}"]`)].find(visible);
    if(el){ e.preventDefault(); el.click(); }
  });
}
function empty(app, msg){
  app.innerHTML = `<div class="gm"><div class="gm-empty"><p>${esc(msg)}</p>
    <a class="glass-btn" href="#/juegos">${IC("caret-left", "bold", 18)}Juegos</a></div></div>`;
}

/* ---------- estilos ---------- */
const CSS = `
.pt{--pt-gap:12px}
.pt .gm-pill[hidden]{display:none}
.pt-main{display:flex;flex-direction:column;gap:var(--pt-gap);max-width:560px;margin:0 auto}
.pt-h{margin:4px 0 0;text-align:center;font:700 var(--fs-t2)/1.15 var(--f-round);color:var(--label)}
.pt-h b{color:var(--brand-ink)}
.pt-p{margin:0;text-align:center;font:400 var(--fs-body)/1.4 var(--f-text);color:var(--label2)}
.pt-p b{color:var(--label);font-weight:700}
.pt button{font:inherit;-webkit-tap-highlight-color:transparent}
.pt button:focus-visible{outline:3px solid var(--brand-tint);outline-offset:3px}
.pt-card{background:var(--card);border-radius:var(--r-card);box-shadow:0 1px 3px rgba(0,0,0,.06)}
/* modos */
.pt-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.pt-mode{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 10px 18px;border:0;cursor:pointer;color:var(--label);text-align:center;
  background:var(--card);border-radius:var(--r-card);box-shadow:0 1px 3px rgba(0,0,0,.06),inset 0 0 0 2px var(--sep);touch-action:manipulation;animation:gm-in .3s calc(var(--i) * 80ms) backwards}
.pt-mode img{width:min(132px,34vw);height:min(132px,34vw);object-fit:contain;pointer-events:none}
.pt-mode b{font:800 1.3rem/1.15 var(--f-round)}
.pt-mode small{font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
@media (hover:hover){.pt-mode:hover{box-shadow:0 1px 3px rgba(0,0,0,.06),inset 0 0 0 2px var(--brand-tint)}}
/* nombres */
.pt-names{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;min-height:48px}
.pt-chip{display:inline-flex;align-items:center;gap:6px;min-height:48px;padding:0 2px 0 6px;border-radius:999px;background:var(--card);box-shadow:inset 0 0 0 1.5px var(--sep);
  font:700 var(--fs-body)/1.1 var(--f-round);color:var(--label);animation:gm-in .25s backwards}
.pt-chip .pt-av{width:36px;height:36px;font-size:1rem}
.pt-chip-x{width:44px;height:44px;border:0;border-radius:50%;background:none;color:var(--label2);display:grid;place-items:center;cursor:pointer}
.pt-add{display:flex;gap:8px}
.pt-add input{flex:1;min-width:0;min-height:52px;padding:0 16px;border:0;border-radius:16px;background:var(--card);color:var(--label);
  box-shadow:inset 0 0 0 1.5px var(--sep);font:600 17px/1.2 var(--f-text)}
.pt-add input:focus{outline:3px solid var(--brand-tint);outline-offset:1px}
.pt-add .glass-btn{flex:none;min-height:52px}
.pt-note{margin:0;text-align:center;font:400 var(--fs-note)/1.35 var(--f-text);color:var(--label2);min-height:1.35em}
/* jugadores (pasar el aparato y votar) */
.pt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.pt-pl{position:relative;display:flex;align-items:center;gap:10px;min-height:76px;padding:10px 12px;border:0;border-radius:20px;background:var(--card);color:var(--label);
  text-align:left;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.06),inset 0 0 0 2px var(--sep);touch-action:manipulation}
.pt-pl b{display:block;font:800 1.15rem/1.15 var(--f-round);overflow-wrap:anywhere}
.pt-pl small{display:block;font:600 var(--fs-note)/1.25 var(--f-text);color:var(--label2)}
.pt-pl.is-seen small{color:var(--ok-ink)}
.pt-pl.is-sel{box-shadow:inset 0 0 0 3px var(--brand-tint);background:var(--brand-soft)}
.pt-av{flex:none;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--c);color:#fff;font:800 1.3rem/1 var(--f-round)}
.pt-av.big{width:88px;height:88px;font-size:2.4rem}
/* tapado y papel */
.pt-cover{display:flex;flex-direction:column;align-items:center;gap:10px;padding:24px 16px;text-align:center}
.pt-cover .pt-eye{width:96px;height:96px;border-radius:50%;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-tint)}
.pt-role{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px 16px;text-align:center;animation:gm-in .3s}
.pt-tag{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 16px;border-radius:999px;font:800 var(--fs-body)/1 var(--f-round);background:var(--fill);color:var(--label)}
.pt-imp .pt-tag{background:#0f2f57;color:#fff}
.pt-civil .pt-tag{background:var(--ok-fill);color:#fff}
.pt-pic{width:min(190px,52vw);aspect-ratio:1;border-radius:26px;background:var(--gm-tile);display:grid;place-items:center;flex:none}
.pt-pic img{width:92%;height:92%;object-fit:contain;pointer-events:none}
.pt-mask{width:min(120px,32vw);height:auto}
.pt-say{display:inline-flex;flex-direction:column;align-items:center;gap:2px;min-height:48px;padding:6px 14px;border:0;border-radius:18px;background:none;color:var(--label);cursor:pointer}
.pt-say .pt-w{display:inline-flex;align-items:center;gap:8px;font:800 1.9rem/1.15 var(--f-round);overflow-wrap:anywhere}
.pt-say .pt-w::after{content:"";flex:none;width:28px;height:28px;background:var(--brand-tint);-webkit-mask:var(--pt-spk) center/contain no-repeat;mask:var(--pt-spk) center/contain no-repeat}
.pt-say.playing .pt-w::after{background:var(--ok-ink)}
.pt-say .pt-ipa{font-size:var(--fs-sub)}
.pt-es{margin:0;font:400 var(--fs-body)/1.35 var(--f-text);color:var(--label2)}
.pt-es b{color:var(--label);font-weight:700}
.pt-tip{margin:4px 0 0;font:400 var(--fs-note)/1.35 var(--f-text);color:var(--label2);max-width:34ch}
.pt-tip .ico{vertical-align:-3px;color:var(--brand-tint)}
/* rondas */
.pt-turn{display:flex;flex-direction:column;align-items:center;gap:10px;padding:22px 16px;text-align:center}
.pt-rd{margin:0;font:700 var(--fs-sub)/1.2 var(--f-text);color:var(--label2)}
.pt-who{margin:0;font:700 var(--fs-t2)/1.15 var(--f-round);color:var(--label)}
.pt-who b{color:var(--brand-ink)}
.pt-order{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.pt-order li{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px 0 4px;border-radius:999px;background:var(--fill);font:700 var(--fs-note)/1 var(--f-round);color:var(--label)}
.pt-order li .pt-av{width:28px;height:28px;font-size:.85rem}
.pt-order li.is-now{background:var(--brand-fill);color:#fff}
.pt-order li.is-done{color:var(--label2)}
/* resultado */
.pt-res{display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px 14px;text-align:center}
.pt-big{margin:0;font:800 var(--fs-t2)/1.15 var(--f-round);color:var(--label)}
.pt-big b{color:var(--brand-ink)}
.pt-win{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 16px;border-radius:999px;background:var(--brand-fill);color:#fff;font:800 var(--fs-body)/1 var(--f-round)}
/* opciones con dibujo (elegir palabra y adivinar) */
.pt-opts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:100%}
.pt-opts.pt-4{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.pt-op{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:132px;padding:8px 4px 10px;border:0;border-radius:20px;
  background:var(--card);color:var(--label);cursor:pointer;text-align:center;touch-action:manipulation;box-shadow:0 1px 3px rgba(0,0,0,.06),inset 0 0 0 2px var(--sep);
  transition:background-color .2s,box-shadow .2s;animation:gm-in .3s calc(var(--i) * 60ms) backwards}
.pt-op .pt-opi{width:min(96px,92%);aspect-ratio:1;border-radius:16px;background:var(--gm-tile);display:grid;place-items:center}
.pt-4 .pt-op .pt-opi{width:min(128px,88%)}
.pt-op .pt-opi img{width:92%;height:92%;object-fit:contain;pointer-events:none}
.pt-op .pt-opi.no-img{color:var(--brand-tint)}
.pt-op .pt-w{font:800 1.05rem/1.15 var(--f-round);overflow-wrap:anywhere;max-width:100%}
.pt-4 .pt-op .pt-w{font-size:1.2rem}
.pt-op .pt-ipa{font-size:var(--fs-min);line-height:1.2;max-width:100%;overflow-wrap:anywhere}
.pt-mk{position:absolute;right:-6px;top:-6px;width:32px;height:32px;border-radius:50%;display:none;place-items:center;color:#fff;box-shadow:0 0 0 3px var(--card),0 2px 6px rgba(0,0,0,.2);z-index:2}
.pt-mk .ico:last-child,.is-miss>.pt-mk .ico:first-child{display:none}
.is-miss>.pt-mk .ico:last-child{display:block}
.pt-op.is-ok,.pt-op.is-right{background:var(--ok-fill);color:#fff;box-shadow:none}
.pt-op.is-ok .ipa,.pt-op.is-right .ipa{color:#fff}
.pt-op.is-ok .pt-mk,.pt-op.is-right .pt-mk{display:grid;background:var(--ok-fill)}
.pt-op.is-miss{background:var(--miss-fill);color:var(--miss-on);box-shadow:none}
.pt-op.is-miss .ipa{color:var(--miss-on)}
.pt-op.is-miss .pt-opi{filter:grayscale(1);opacity:.6}
.pt-op.is-miss .pt-mk{display:grid;background:var(--miss)}
.pt-op.is-said{background:var(--brand-fill);color:#fff;box-shadow:none}
.pt-op.is-said .ipa{color:#fff}
.pt-op[disabled]{cursor:default}
/* modo solo: el escenario y la mesa */
.pt-stage{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:236px;padding:12px;text-align:center}
.pt-spk{display:flex;align-items:flex-end;justify-content:center;gap:10px;width:100%}
.pt-spk .pt-pj{width:76px;height:76px;object-fit:contain;flex:none}
.pt-bub{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;max-width:calc(100% - 86px);padding:10px 12px 8px;border-radius:22px;
  background:var(--gm-tile);color:#1c1c1e;box-shadow:inset 0 0 0 2px var(--sep);animation:gm-in .25s}
.pt-bub::before{content:"";position:absolute;left:-7px;bottom:16px;width:14px;height:14px;background:inherit;transform:rotate(45deg);box-shadow:-2px 2px 0 0 var(--sep)}
.pt-bub.pt-flat{max-width:100%}
.pt-bub.pt-flat::before{display:none}
.pt-bub .pt-bi{width:min(132px,36vw);aspect-ratio:1;display:grid;place-items:center}
.pt-bub .pt-bi img{width:100%;height:100%;object-fit:contain;pointer-events:none}
.pt-bub .pt-say{padding:2px 6px;color:#1c1c1e}
.pt-bub .pt-say .pt-w{font-size:1.5rem}
.pt-bub .ipa{color:#3a3a3c}
.pt-dots{display:inline-flex;gap:6px;padding:18px 8px}
.pt-dots i{width:10px;height:10px;border-radius:50%;background:#636366;animation:pt-dot 1s infinite;animation-delay:calc(var(--i) * .15s)}
@keyframes pt-dot{0%,60%,100%{opacity:.25}30%{opacity:1}}
.pt-q{margin:0;font:700 var(--fs-head)/1.2 var(--f-round);color:var(--label)}
.pt-table{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.pt-row{display:flex;align-items:center;gap:10px;min-height:64px;padding:6px 10px;border-radius:18px;background:var(--card);box-shadow:0 1px 3px rgba(0,0,0,.06);width:100%;
  border:0;color:var(--label);text-align:left;box-sizing:border-box}
.pt-row .pt-pj{width:48px;height:48px;object-fit:contain;flex:none}
.pt-who-n{flex:none;width:64px;font:700 var(--fs-note)/1.15 var(--f-round);overflow-wrap:anywhere}
.pt-me{flex:none;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--brand-fill);color:#fff}
.pt-chips{display:flex;flex-wrap:wrap;gap:6px;flex:1;min-width:0}
.pt-cw{display:inline-flex;align-items:center;gap:4px;min-height:40px;max-width:100%;padding:2px 10px 2px 3px;border:0;border-radius:12px;background:var(--fill);color:var(--label);
  font:700 .95rem/1.1 var(--f-round);cursor:pointer;animation:gm-in .25s backwards}
.pt-cw img{width:34px;height:34px;object-fit:contain;border-radius:8px;background:var(--gm-tile);flex:none}
.pt-cw span{overflow-wrap:anywhere}
.pt-cw.is-ok{background:var(--ok-soft,rgba(52,199,89,.16));box-shadow:inset 0 0 0 2px var(--ok-fill)}
.pt-cw.is-miss{background:var(--miss-fill);color:var(--miss-on)}
.pt-cw.is-miss img{filter:grayscale(1);opacity:.6}
.pt-row.is-now{box-shadow:inset 0 0 0 3px var(--brand-tint)}
.pt-row.is-vote{cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.06),inset 0 0 0 2px var(--brand-tint)}
.pt-row.is-imp{background:var(--brand-soft)}
.pt-row.is-wrong{background:var(--miss-fill);color:var(--miss-on)}
/* ordenar */
.pt-sort{gap:10px}
.pt-wc{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;width:min(260px,100%);margin:0 auto;padding:12px 12px 10px;border:0;border-radius:var(--r-card);
  background:var(--card);color:var(--label);cursor:grab;touch-action:none;box-shadow:0 2px 8px rgba(0,0,0,.08),inset 0 0 0 2px var(--sep);
  transition:transform .2s,box-shadow .2s}
.pt-wc.is-sel{transform:translateY(-4px) scale(1.03);box-shadow:0 10px 24px rgba(0,0,0,.16),inset 0 0 0 3px var(--brand-tint)}
.pt-wc.is-in{animation:gm-in .3s}
.pt-wc .pt-pic{width:min(164px,44vw,26vh);width:min(164px,44vw,26svh)}
.pt-wc .pt-w{font:800 1.6rem/1.15 var(--f-round);overflow-wrap:anywhere}
.pt-wc .pt-ipa{font-size:var(--fs-sub)}
.pt-wc .pt-spkr{position:absolute;right:10px;top:10px;color:var(--brand-tint)}
.pt-left{margin:0;text-align:center;font:600 var(--fs-note)/1.2 var(--f-text);color:var(--label2)}
.pt-bks{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:10px}
.pt-bkw{position:relative;display:flex}
.pt-bk{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0;min-height:176px;padding:14px 6px 10px;border:0;cursor:pointer;
  border-radius:16px 16px 30px 30px;background:var(--card);color:var(--label);touch-action:manipulation;
  box-shadow:0 1px 3px rgba(0,0,0,.06),inset 0 0 0 2px var(--sep),inset 0 7px 0 0 var(--c);transition:background-color .2s,box-shadow .2s,transform .2s}
.pt-bk .pt-bkp{width:min(76px,24vw);aspect-ratio:1;border-radius:16px;background:var(--gm-tile);display:grid;place-items:center;margin-top:4px}
.pt-bk .pt-bkp img{width:90%;height:90%;object-fit:contain;pointer-events:none}
.pt-bk .pt-w{font:800 1rem/1.1 var(--f-round);text-align:center;overflow-wrap:anywhere;max-width:100%}
.pt-bk .pt-ipa{font-size:var(--fs-min);line-height:1.2;text-align:center;max-width:100%;overflow-wrap:anywhere}
.pt-bk .pt-in{display:flex;flex-wrap:wrap;justify-content:center;gap:2px;margin-top:auto;min-height:26px}
.pt-bk .pt-in img{width:26px;height:26px;object-fit:contain;border-radius:6px;background:var(--gm-tile);animation:gm-in .3s}
.pt-bk-say{position:absolute;right:2px;top:10px;z-index:2;width:40px;height:40px;border:0;border-radius:50%;background:none;color:var(--brand-tint);display:grid;place-items:center;cursor:pointer}
.pt-bk-say.playing{color:var(--ok-ink)}
.pt-bk.is-over{transform:scale(1.04);box-shadow:0 6px 16px rgba(0,0,0,.14),inset 0 0 0 3px var(--brand-tint),inset 0 7px 0 0 var(--c)}
.pt-bk.is-ok{background:var(--ok-fill);color:#fff;box-shadow:none}
.pt-bk.is-ok .ipa{color:#fff}
.pt-bk.is-ok .pt-mk{display:grid;background:var(--ok-fill)}
.pt-bk.is-miss{background:var(--miss-fill);color:var(--miss-on);box-shadow:none}
.pt-bk.is-miss .ipa{color:var(--miss-on)}
.pt-bk.is-miss .pt-bkp{filter:grayscale(1);opacity:.6}
.pt-bk.is-miss .pt-mk{display:grid;background:var(--miss)}
.pt-bk.is-hint{box-shadow:inset 0 0 0 4px var(--ok-fill),inset 0 7px 0 0 var(--c)}
.pt-hint{margin:0;text-align:center;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label2);min-height:1.3em}
/* el botón de abajo: fijo, como el de la lección */
.pt-dock{position:fixed;z-index:5;left:max(16px,var(--safe-l),calc(50% - 280px));right:max(16px,var(--safe-r),calc(50% - 280px));
  bottom:calc(var(--safe-b) + 16px);display:flex;gap:10px;pointer-events:none}
.pt-dock:empty{display:none}
.pt-dock>*{pointer-events:auto;flex:1}
.pt-dock>.pt-sec{flex:0 1 auto}
.pt-dock::before{content:"";position:absolute;z-index:-1;left:-16px;right:-16px;top:-20px;bottom:calc(-1 * (var(--safe-b) + 16px));
  background:linear-gradient(to bottom,transparent,var(--bg) 45%);pointer-events:none}
.pt-sp{flex:none;height:calc(var(--btn-main) + 28px)}
/* pantallas bajitas */
.gm-short .pt-stage{min-height:200px}
.gm-short .pt-bub .pt-bi{width:min(100px,30vw)}
.gm-short .pt-pic{width:min(140px,40vw)}
.gm-short .pt-wc .pt-pic{width:min(124px,36vw)}
.gm-short .pt-bk{min-height:150px}
.gm-short .pt-bk .pt-bkp{width:min(60px,20vw)}
.gm-short .pt-op{min-height:116px}
@media (max-width:370px){.pt-bk .pt-w{font-size:.92rem}.pt-say .pt-w{font-size:1.6rem}.pt-who-n{width:52px}}
@media (prefers-reduced-motion: reduce){.pt-mode,.pt-op,.pt-chip,.pt-cw,.pt-role,.pt-bub,.pt-wc.is-in,.pt-bk .pt-in img{animation:none}.pt-wc,.pt-bk{transition:none}.pt-dots i{animation:none;opacity:.6}}`;
function css(){
  if(document.getElementById("css-party")) return;
  const s = document.createElement("style"); s.id = "css-party";
  /* el altavoz de las palabras (máscara: toma el color del tema) */
  const spk = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M155.51 24.81a8 8 0 0 0-8.42.88L77.25 80H32a16 16 0 0 0-16 16v64a16 16 0 0 0 16 16h45.25l69.84 54.31A8 8 0 0 0 160 224V32a8 8 0 0 0-4.49-7.19ZM192 96a8 8 0 0 1 8 8v48a8 8 0 0 1-16 0v-48a8 8 0 0 1 8-8Zm40-16v96a8 8 0 0 1-16 0V80a8 8 0 0 1 16 0Z"/></svg>');
  s.textContent = `.pt{--pt-spk:url("data:image/svg+xml,${spk}")}` + CSS;
  document.head.appendChild(s);
}

/* =====================================================================
   EL IMPOSTOR
   ===================================================================== */
/* todos los casos que se pueden jugar en este idioma: {id, fam, w, hint, rel: [palabras], sibs: [ids de su familia]} */
function casesOf(D){
  const out = [];
  for(const [fam, F] of Object.entries((D && D.impostor) || {})){
    const hint = W(D, F && F.hint);
    if(!hint || !Array.isArray(F.cases)) continue;
    for(const c of F.cases){
      const w = W(D, c && c.w);
      if(!w || !w.img) continue;
      const rel = (Array.isArray(c.rel) ? c.rel : []).map(id => W(D, id)).filter(x => x && x.id !== w.id);
      if(rel.length >= 9) out.push({id: w.id, fam, w, hint, rel});
    }
  }
  return out;
}
/* 4 dibujos para adivinar: la secreta y 3 de su familia (si faltan, de otras) */
function guessOpts(C, cs){
  const same = shuffle(C.filter(x => x.fam === cs.fam && x.id !== cs.id)), other = shuffle(C.filter(x => x.fam !== cs.fam));
  return shuffle([cs.w, ...[...same, ...other].slice(0, 3).map(x => x.w)]);
}
/* el impostor de la app: palabras de otra cosa de la misma familia (se acercan pero no encajan). Elige la cosa que
   menos palabras comparte con la secreta (sol y playa se parecen demasiado; sol y nieve, no) */
function impWordsOf(C, cs, n){
  const mine = new Set([cs.id, ...cs.rel.map(x => x.id)]);
  const cand = C.filter(x => x.fam === cs.fam && x.id !== cs.id).map(o => ({o, k: o.rel.filter(w => mine.has(w.id)).length + (mine.has(o.id) ? 2 : 0) + (o.rel.some(w => w.id === cs.id) ? 2 : 0)}));
  const min = Math.min(...cand.map(x => x.k)), best = shuffle(cand.filter(x => x.k === min));
  for(const {o} of best){
    const ws = shuffle(o.rel.filter(w => !mine.has(w.id)));
    if(ws.length >= n) return {from: o, ws: ws.slice(0, n)};
  }
  return null;
}
/* opciones que no encajan (para el niño): palabras de cosas de otras familias */
function farWords(C, cs, used){
  const bad = new Set([cs.id, ...cs.rel.map(x => x.id), ...used]), out = [];
  for(const o of shuffle(C.filter(x => x.fam !== cs.fam)))
    for(const w of shuffle(o.rel)) if(!bad.has(w.id) && !out.some(x => x.id === w.id)){ out.push(w); break; }
  return out;
}

async function impostor(app, api, mode){
  const my = api.nav();
  css();
  let D = null;
  try{ D = await load(); }catch(e){ D = null; }
  if(!api.here(my, IMP)) return;
  const C = casesOf(D);
  if(C.length < 4){ empty(app, `Este juego todavía no tiene palabras en ${api.nm()}.`); return; }
  const run = api.mount(app, `<div class="gm pt" id="pt">
    ${api.topHtml(IMP, `<span class="gm-pill" id="pt-rd" hidden title="Ronda">${IC("chat-circle-text", "bold", 18)}<span><b id="pt-rn">1</b>/${ROUNDS}</span></span>`)}
    <div class="pt-main" id="pt-main"></div><div class="pt-dock" id="pt-dock"></div></div>`, mode);
  const root = run.root, main = root.querySelector("#pt-main"), dock = root.querySelector("#pt-dock");
  const live = () => api.live(run);
  const wait = ms => new Promise(res => api.later(run, res, ms));
  const pill = r => { const p = root.querySelector("#pt-rd"); if(!p) return; p.hidden = r == null; if(r != null){ root.querySelector("#pt-rn").textContent = r; api.bump(p); } };
  const show = (html, dk = "") => { stopTalk(); main.innerHTML = html + `<div class="pt-sp" aria-hidden="true"></div>`; dock.innerHTML = dk; window.scrollTo(0, 0); };
  const btn = (id, label, icon, pri = true, key = "enter", extra = "") => `<button type="button" class="glass-btn${pri ? " glass-btn--pri" : " pt-sec"} glass-btn--lg" id="${id}"${key ? ` data-key="${key}"` : ""}${extra}>${icon ? IC(icon, "bold", 20) : ""}${label}</button>`;
  const on = (sel, fn) => { const el = root.querySelector(sel); if(el) el.onclick = fn; return el; };
  /* el caso de esta partida (sin repetir los últimos) */
  const cs = pick(fresh(C, "imp", x => x.id));
  remember("imp", cs.id, 24);
  const q = new URLSearchParams(location.hash.split("?")[1] || "").get("m");

  function choose(){
    pill(null);
    show(`<h2 class="pt-h">¿Cómo jugáis?</h2>
      <div class="pt-modes">
        <button type="button" class="pt-mode" data-m="grupo" data-key="1" style="--i:0"><img src="img/games/impostor.png" alt=""><b>En grupo</b><small>De 3 a 8, con un solo aparato</small></button>
        <button type="button" class="pt-mode" data-m="solo" data-key="2" style="--i:1"><img src="img/pj/zorro.png" alt=""><b>Solo</b><small>Con el zorro y sus amigos</small></button>
      </div>`);
    main.querySelectorAll(".pt-mode").forEach(b => b.onclick = () => { api.haptic("selection"); b.dataset.m === "grupo" ? names() : solo(); });
  }

  /* ---------- en grupo ---------- */
  let P = [];   /* nombres */
  function names(){
    pill(null);
    const saved = (Array.isArray(st().names) ? st().names : []).filter(n => typeof n === "string" && n.trim()).map(n => n.trim().slice(0, 14));
    if(!P.length) P = [...new Set(saved)].slice(0, 8);
    show(`<h2 class="pt-h">¿Quién juega?</h2>
      <p class="pt-p">De 3 a 8 jugadores.</p>
      <ul class="pt-names" id="pt-names" aria-label="Jugadores"></ul>
      <form class="pt-add" id="pt-add" autocomplete="off"><input id="pt-in" maxlength="14" placeholder="Nombre" aria-label="Nombre de un jugador" enterkeyhint="done" autocomplete="off" autocapitalize="words" spellcheck="false">
        <button type="submit" class="glass-btn">${IC("plus", "bold", 20)}Añadir</button></form>
      <p class="pt-note" id="pt-note" aria-live="polite"></p>`,
      btn("pt-go", "Repartir papeles", "play"));
    const ul = main.querySelector("#pt-names"), inp = main.querySelector("#pt-in"), note = main.querySelector("#pt-note"), go = dock.querySelector("#pt-go");
    const paint = () => {
      ul.innerHTML = P.map((n, i) => `<li class="pt-chip">${avHtml(n, i)}<span>${esc(n)}</span><button type="button" class="pt-chip-x" data-i="${i}" aria-label="Quitar a ${esc(n)}">${IC("x", "bold", 18)}</button></li>`).join("");
      go.disabled = P.length < 3;
      inp.disabled = P.length >= 8;
      inp.placeholder = P.length >= 8 ? "Ya sois 8" : `Nombre ${P.length + 1}`;
      note.textContent = P.length < 3 ? `Faltan ${3 - P.length} para empezar` : "";
      stSet({names: P});   /* se guarda solo */
    };
    ul.onclick = e => { const x = e.target.closest(".pt-chip-x"); if(!x) return; P.splice(+x.dataset.i, 1); paint(); };
    main.querySelector("#pt-add").onsubmit = e => {
      e.preventDefault();
      if(P.length >= 8) return;
      let n = inp.value.replace(/\s+/g, " ").trim().slice(0, 14);
      if(!n){ let k = P.length + 1; while(P.includes(`Jugador ${k}`)) k++; n = `Jugador ${k}`; }   /* sin escribir: «Jugador N» */
      if(P.some(x => x.toLowerCase() === n.toLowerCase())){ note.textContent = `${n} ya está`; return; }
      P.push(n); inp.value = ""; paint();
      api.haptic("selection");
    };
    go.onclick = () => { if(P.length >= 3) deal(); };
    paint();
  }
  let imp = 0, seen = new Set();
  function deal(){
    imp = Math.floor(Math.random() * P.length); seen = new Set();
    grid();
  }
  function grid(){
    pill(null);
    const all = seen.size === P.length;
    show(`<h2 class="pt-h">${all ? "¡Todos listos!" : "Mirad vuestro papel"}</h2>
      <p class="pt-p">${all ? "Ya podéis empezar las rondas." : "Pasa el aparato. Cada uno toca su nombre y lo mira a solas."}</p>
      <div class="pt-grid">${P.map((n, i) => `<button type="button" class="pt-pl${seen.has(i) ? " is-seen" : ""}" data-i="${i}">${avHtml(n, i)}<span><b>${esc(n)}</b><small>${seen.has(i) ? "Ya lo vio ✓" : "Toca para verlo"}</small></span></button>`).join("")}</div>`,
      all ? btn("pt-go", "Empezar las rondas", "play") : "");
    main.querySelectorAll(".pt-pl").forEach(b => b.onclick = () => cover(+b.dataset.i));
    on("#pt-go", () => rounds());
  }
  function cover(i){
    show(`<div class="pt-card pt-cover">
        ${avHtml(P[i], i, "big")}
        <h2 class="pt-h">¿Eres <b>${esc(P[i])}</b>?</h2>
        <p class="pt-p">Que nadie más mire la pantalla.</p>
      </div>`,
      btn("pt-back", "No soy yo", "caret-left", false, "") + btn("pt-see", "Ver mi papel", "eye"));
    on("#pt-back", grid);
    on("#pt-see", () => role(i));
  }
  function role(i){
    const isImp = i === imp, w = isImp ? cs.hint : cs.w;
    show(isImp ? `<div class="pt-card pt-role pt-imp">
        <img class="pt-mask" src="img/games/impostor.png" alt="">
        <span class="pt-tag">¡Eres el impostor!</span>
        <p class="pt-es">Tu pista:</p>
        <button type="button" class="pt-say" id="pt-say" data-key="space" aria-label="Escuchar ${esc(w.word)}">${wHtml(w)}</button>
        <p class="pt-es">En español: <b>${esc(w.es)}</b></p>
        <p class="pt-tip">Nadie sabe que eres tú. Di palabras que encajen con la pista y adivina la palabra secreta.</p>
        <p class="pt-tip">${IC("speaker-high", "fill", 16)} Si la escuchas, bajito: ¡que no la oigan!</p>
      </div>` : `<div class="pt-card pt-role pt-civil">
        <span class="pt-tag">Eres civil</span>
        <div class="pt-pic">${imgHtml(w.img)}</div>
        <button type="button" class="pt-say" id="pt-say" data-key="space" aria-label="Escuchar ${esc(w.word)}">${wHtml(w)}</button>
        <p class="pt-es">En español: <b>${esc(w.es)}</b></p>
        <p class="pt-tip">Es la palabra secreta. Di palabras que tengan que ver con ella, ¡sin decirla!</p>
        <p class="pt-tip">${IC("speaker-high", "fill", 16)} Si la escuchas, bajito: ¡que no la oigan!</p>
      </div>`,
      btn("pt-hide", "Tapar y pasar", "eye-slash"));
    /* no suena sola: en voz alta la oirían todos (y el impostor sabría la palabra) */
    const sb = on("#pt-say", () => { try{ say(w.word, sb); }catch(e){} });
    on("#pt-hide", () => { seen.add(i); api.haptic("selection"); grid(); });
  }
  let order = [], r = 0, t = 0;
  function rounds(){
    /* empieza uno al azar que no sea el impostor; cada ronda, en el mismo orden */
    let s = Math.floor(Math.random() * P.length); if(s === imp) s = (s + 1) % P.length;
    order = P.map((_, k) => (s + k) % P.length); r = 0; t = 0;
    turn();
  }
  function turn(){
    pill(r + 1);
    const i = order[t];
    show(`<div class="pt-card pt-turn">
        <p class="pt-rd">Ronda ${r + 1} de ${ROUNDS}</p>
        ${avHtml(P[i], i, "big")}
        <h2 class="pt-who">Le toca a <b>${esc(P[i])}</b></h2>
        <p class="pt-p">Di en voz alta una palabra que tenga que ver con la palabra secreta.</p>
      </div>
      <ol class="pt-order" aria-label="Orden">${order.map((k, j) => `<li class="${j === t ? "is-now" : j < t ? "is-done" : ""}">${avHtml(P[k], k)}${esc(P[k])}${j < t ? " ✓" : ""}</li>`).join("")}</ol>`,
      (r > 0 ? btn("pt-vote", "Votar ya", "", false, "") : "") + btn("pt-next", "Ya la dije", "check"));
    on("#pt-next", () => {
      api.haptic("selection");
      t++;
      if(t >= order.length){ t = 0; r++; }
      if(r >= ROUNDS) vote(); else turn();
    });
    on("#pt-vote", vote);
  }
  let pickV = -1;
  function vote(){
    pill(null); pickV = -1;
    show(`<h2 class="pt-h">¿Quién es el impostor?</h2>
      <p class="pt-p">Hablad entre todos y tocad un nombre.</p>
      <div class="pt-grid">${P.map((n, i) => `<button type="button" class="pt-pl" data-i="${i}" aria-pressed="false">${avHtml(n, i)}<span><b>${esc(n)}</b></span></button>`).join("")}</div>`,
      btn("pt-go", "Votar", "check", true, "enter", " disabled"));
    const go = dock.querySelector("#pt-go");
    main.querySelectorAll(".pt-pl").forEach(b => b.onclick = () => {
      pickV = +b.dataset.i;
      main.querySelectorAll(".pt-pl").forEach(x => { x.classList.toggle("is-sel", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      go.disabled = false;
      go.lastChild.textContent = `Votar a ${P[pickV]}`;
      api.haptic("selection");
    });
    go.onclick = () => { if(pickV >= 0) reveal(pickV); };
  }
  function reveal(v){
    if(v !== imp){
      show(`<div class="pt-card pt-res">
          ${avHtml(P[v], v, "big")}
          <p class="pt-big">¡Oh! <b>${esc(P[v])}</b> era civil</p>
          <p class="pt-p">El impostor era <b>${esc(P[imp])}</b>.</p>
          <span class="pt-win">¡Gana el impostor!</span>
          <p class="pt-es">La palabra secreta era:</p>
          <div class="pt-pic">${imgHtml(cs.w.img)}</div>
          <button type="button" class="pt-say" id="pt-say" data-key="space" aria-label="Escuchar ${esc(cs.w.word)}">${wHtml(cs.w)}</button>
          <p class="pt-es">En español: <b>${esc(cs.w.es)}</b></p>
        </div>`, btn("pt-end", "Ver el premio", "caret-right"));
      const sb = on("#pt-say", () => { try{ say(cs.w.word, sb); }catch(e){} });
      api.later(run, () => talk(cs.w), 500);
      on("#pt-end", () => end(2, 2, "¡El impostor os engañó! La próxima vez lo pilláis.", [cs.w, cs.hint]));
      return;
    }
    const opts = guessOpts(C, cs);
    show(`<div class="pt-card pt-res">
        <p class="pt-big">¡Pillado! <b>${esc(P[imp])}</b> era el impostor</p>
        <p class="pt-p" id="pt-gq"><b>${esc(P[imp])}</b>, última oportunidad: ¿cuál era la palabra?</p>
        <div class="pt-opts pt-4" id="pt-opts">${opts.map((w, k) => optHtml(w, k)).join("")}</div>
        <p class="pt-es" id="pt-gr" aria-live="polite"></p>
      </div>`);
    let done = false;
    main.querySelector("#pt-opts").onclick = e => {
      const b = e.target.closest(".pt-op"); if(!b) return;
      const w = opts[+b.dataset.k];
      if(done){ talk(w); return; }
      done = true;
      const ok = w.id === cs.w.id;
      api.answer(ok, {es: cs.w.es, word: cs.w.word});
      main.querySelectorAll(".pt-op").forEach(x => { const y = opts[+x.dataset.k]; x.classList.toggle("is-right", y.id === cs.w.id); });
      if(!ok){ b.classList.add("is-miss"); }
      else { b.classList.add("is-ok"); api.snd("ok"); api.haptic("success"); }
      main.querySelector("#pt-gq").innerHTML = ok ? `¡<b>${esc(P[imp])}</b> la adivinó!` : `Era <b lang="${esc(code())}">${esc(cs.w.word)}</b>.`;
      main.querySelector("#pt-gr").innerHTML = `<span class="pt-win">${ok ? "¡Gana el impostor!" : "¡Ganan los civiles!"}</span>`;
      api.later(run, () => talk(cs.w), 250);
      dock.innerHTML = btn("pt-end", "Ver el premio", "caret-right");
      on("#pt-end", () => end(ok ? 2 : 3, ok ? 2 : 3, ok ? "¡Pillasteis al impostor, pero adivinó la palabra!" : "¡Pillasteis al impostor!", [cs.w, cs.hint, ...opts]));
    };
  }

  /* ---------- solo: con el zorro y sus amigos ---------- */
  function solo(){
    const meImp = Math.random() < .34;
    /* el zorro siempre; 2 amigos (1 si el impostor eres tú) */
    const pjs = [PJS[0], ...shuffle(PJS.slice(1)).slice(0, meImp ? 1 : 2)].map(([id, n]) => ({id, n}));
    const used = new Set();
    const rel = shuffle(cs.rel);
    const take = () => { const w = rel.find(x => !used.has(x.id)); if(w) used.add(w.id); return w; };
    let impPj = -1, impWords = [], impFrom = null;
    const iw = meImp ? null : impWordsOf(C, cs, ROUNDS);
    if(!meImp){
      impPj = 1 + Math.floor(Math.random() * 2);   /* nunca el zorro, que «presenta» */
      if(iw){ impWords = iw.ws; impFrom = iw.from.w; } else impWords = farWords(C, cs, []).slice(0, ROUNDS);
    }
    const dec = farWords(C, cs, impWords.map(x => x.id));
    const decUsed = new Set(impWords.map(x => x.id));
    const said = pjs.map(() => []), mine = [];
    let firstTry = 0, fits = 0;
    function tableHtml(){
      return `<ul class="pt-table" id="pt-table">${pjs.map((p, k) => `<li><div class="pt-row" data-k="${k}">${pjImg(p)}<span class="pt-who-n">${esc(p.n)}</span><span class="pt-chips"></span></div></li>`).join("")}
        <li><div class="pt-row" data-k="me">${meAv()}<span class="pt-who-n">Tú</span><span class="pt-chips"></span></div></li></ul>`;
    }
    const rowOf = k => main.querySelector(`.pt-row[data-k="${k}"]`);
    const chip = (k, w, cls = "") => {
      const box = rowOf(k) && rowOf(k).querySelector(".pt-chips"); if(!box) return;
      box.insertAdjacentHTML("beforeend", `<button type="button" class="pt-cw${cls ? " " + cls : ""}" data-id="${esc(w.id)}" aria-label="Escuchar ${esc(w.word)}">${w.img ? imgHtml(w.img) : ""}<span lang="${esc(code())}">${esc(w.word)}</span></button>`);
    };
    const stage = html => { const s = main.querySelector("#pt-stage"); if(s) s.innerHTML = html; };
    const bubble = (p, w) => `<div class="pt-spk">${p ? pjImg(p) : meAv("pt-me")}<div class="pt-bub">${w ? `${w.img ? `<div class="pt-bi">${imgHtml(w.img)}</div>` : ""}<button type="button" class="pt-say" id="pt-say" data-key="space" aria-label="Escuchar ${esc(w.word)}">${wHtml(w)}</button>` : `<span class="pt-dots" aria-label="Pensando">${[0, 1, 2].map(i => `<i style="--i:${i}"></i>`).join("")}</span>`}</div></div>`;
    const allW = {};
    const keep = w => { if(w) allW[w.id] = w; return w; };
    keep(cs.w); keep(cs.hint);

    /* la tarjeta del papel */
    pill(null);
    const w0 = meImp ? cs.hint : cs.w;
    show(meImp ? `<div class="pt-card pt-role pt-imp">
        <img class="pt-mask" src="img/games/impostor.png" alt="">
        <span class="pt-tag">¡Eres el impostor!</span>
        <p class="pt-es">Tu pista:</p>
        <button type="button" class="pt-say" id="pt-say" data-key="space" aria-label="Escuchar ${esc(w0.word)}">${wHtml(w0)}</button>
        <p class="pt-es">En español: <b>${esc(w0.es)}</b></p>
        <p class="pt-tip">${pjs.map(p => esc(p.n)).join(" y ")} saben la palabra secreta. Escúchalos, elige palabras que encajen y adivínala.</p>
      </div>` : `<div class="pt-card pt-role pt-civil">
        <span class="pt-tag">Eres civil</span>
        <div class="pt-pic">${imgHtml(w0.img)}</div>
        <button type="button" class="pt-say" id="pt-say" data-key="space" aria-label="Escuchar ${esc(w0.word)}">${wHtml(w0)}</button>
        <p class="pt-es">En español: <b>${esc(w0.es)}</b></p>
        <p class="pt-tip">Uno de tus amigos es el impostor: no sabe la palabra. Escucha bien y descúbrelo.</p>
      </div>`, btn("pt-go", "¡Vamos!", "play"));
    const sb0 = on("#pt-say", () => { try{ say(w0.word, sb0); }catch(e){} });
    api.later(run, () => { try{ say(w0.word, sb0); }catch(e){} }, RM() ? 150 : 350);
    on("#pt-go", () => play());

    async function play(){
      show(`<div class="pt-card pt-stage" id="pt-stage" aria-live="polite"></div>${tableHtml()}`);
      main.querySelector("#pt-table").onclick = e => { const c = e.target.closest(".pt-cw"); if(c && allW[c.dataset.id]) talk(allW[c.dataset.id]); };
      for(let rr = 0; rr < ROUNDS; rr++){
        pill(rr + 1);
        for(let k = 0; k < pjs.length; k++){
          if(!live()) return;
          const row = rowOf(k);
          main.querySelectorAll(".pt-row").forEach(x => x.classList.toggle("is-now", x === row));
          stage(bubble(pjs[k], null));
          await wait(RM() ? 250 : 700);
          if(!live()) return;
          const w = keep(k === impPj ? impWords[rr] : take());
          if(!w) continue;
          said[k].push(w);
          stage(bubble(pjs[k], w));
          const sb = main.querySelector("#pt-say"); if(sb) sb.onclick = () => { try{ say(w.word, sb); }catch(e){} };
          chip(k, w);
          await talkP(w);
          if(!live()) return;
          await wait(RM() ? 300 : 650);
        }
        if(!live()) return;
        await myTurn(rr);
        if(!live()) return;
      }
      main.querySelectorAll(".pt-row").forEach(x => x.classList.remove("is-now"));
      if(meImp) caughtMe(); else voteSolo();
    }
    /* mi turno: 3 palabras, una encaja */
    function myTurn(rr){
      return new Promise(res => {
        const fit = keep(take());
        const bad = dec.filter(x => !decUsed.has(x.id)).slice(0, 2);
        bad.forEach(x => { decUsed.add(x.id); keep(x); });
        const opts = shuffle([fit, ...bad].filter(Boolean));
        main.querySelectorAll(".pt-row").forEach(x => x.classList.toggle("is-now", x.dataset.k === "me"));
        stage(`<p class="pt-q">${meImp ? "Tu turno: ¿qué palabra dices?" : "Tu turno: ¿cuál tiene que ver?"}</p>
          <div class="pt-opts" id="pt-opts">${opts.map((w, k) => optHtml(w, k)).join("")}</div>`);
        let miss = false, over = false;
        main.querySelector("#pt-opts").onclick = e => {
          const b = e.target.closest(".pt-op"); if(!b || over || b.disabled) return;
          const w = opts[+b.dataset.k], ok = w === fit;
          talk(w);
          if(meImp){
            /* el impostor no sabe si acierta: se ve al final */
            over = true; b.classList.add("is-said"); api.haptic("selection");
            if(ok) fits++;
            mine.push({w, ok}); chip("me", w);
            api.later(run, res, RM() ? 400 : 900);
            return;
          }
          api.answer(ok, {es: w.es, word: w.word});
          if(!ok){ miss = true; b.classList.add("is-miss"); b.disabled = true; return; }
          over = true; b.classList.add("is-ok"); api.snd("ok"); api.haptic("success");
          if(!miss) firstTry++;
          mine.push({w, ok: true, miss}); chip("me", w);
          api.later(run, res, RM() ? 400 : 900);
        };
      });
    }
    function voteSolo(){
      pill(null);
      stage(`<p class="pt-q">¿Quién es el impostor?</p><p class="pt-p">Toca a quien dijo palabras que no encajan.</p>`);
      main.querySelectorAll(".pt-row").forEach(x => {
        if(x.dataset.k === "me") return;
        x.classList.add("is-vote"); x.setAttribute("role", "button"); x.tabIndex = 0;
        x.setAttribute("aria-label", `Votar a ${pjs[+x.dataset.k].n}`);
        x.dataset.key = String(+x.dataset.k + 1);
      });
      let done = false;
      const tbl = main.querySelector("#pt-table");
      const choose = row => {
        if(done || !row || row.dataset.k === "me") return;
        done = true;
        const k = +row.dataset.k, ok = k === impPj;
        api.answer(ok, {es: cs.w.es, word: cs.w.word});
        main.querySelectorAll(".pt-row").forEach(x => { x.classList.remove("is-vote"); x.removeAttribute("role"); x.removeAttribute("tabindex"); x.removeAttribute("aria-label"); delete x.dataset.key; });
        rowOf(impPj).classList.add("is-imp");
        if(!ok) row.classList.add("is-wrong"); else { api.snd("ok"); api.haptic("success"); }
        /* las palabras del impostor no encajan */
        rowOf(impPj).querySelectorAll(".pt-cw").forEach(c => c.classList.add("is-miss"));
        const from = impFrom;
        stage(`<p class="pt-big">${ok ? `¡Lo pillaste! Era <b>${esc(pjs[impPj].n)}</b>` : `¡Uy! <b>${esc(pjs[k].n)}</b> no era`}</p>
          ${ok ? "" : `<p class="pt-p">El impostor era <b>${esc(pjs[impPj].n)}</b>.</p>`}
          <p class="pt-p">Solo sabía la pista: <b lang="${esc(code())}">${esc(cs.hint.word)}</b>${from ? `. Creía que era <b lang="${esc(code())}">${esc(from.word)}</b>` : ""}.</p>
          <div class="pt-spk"><div class="pt-bub pt-flat"><div class="pt-bi">${imgHtml(cs.w.img)}</div><button type="button" class="pt-say" id="pt-say" data-key="space" aria-label="Escuchar ${esc(cs.w.word)}">${wHtml(cs.w)}</button></div></div>`);
        const sb = main.querySelector("#pt-say"); if(sb) sb.onclick = () => { try{ say(cs.w.word, sb); }catch(e){} };
        api.later(run, () => talk(cs.w), 300);
        dock.innerHTML = btn("pt-end", "Ver el premio", "caret-right");
        const score = (ok ? 3 : 0) + firstTry;
        on("#pt-end", () => end(ok ? (firstTry >= 2 ? 3 : 2) : 1, score,
          ok ? `¡Descubriste a ${pjs[impPj].n}!` : `¡Casi! El impostor era ${pjs[impPj].n}.`, [cs.w, ...mine.map(m => m.w), cs.hint], mine.filter(m => m.miss).map(m => m.w.id)));
      };
      tbl.onclick = e => {
        if(!done){ choose(e.target.closest(".pt-row")); return; }
        const c = e.target.closest(".pt-cw"); if(c && allW[c.dataset.id]) talk(allW[c.dataset.id]);
      };
      tbl.onkeydown = e => { if((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("pt-row")){ e.preventDefault(); choose(e.target); } };
    }
    async function caughtMe(){
      pill(null);
      stage(`<p class="pt-q">Los demás votan…</p>${bubble(pjs[0], null)}`);
      await wait(RM() ? 300 : 1200);
      if(!live()) return;
      const caught = fits < 2;
      /* mis palabras: ✓ las que encajaban */
      const chips = rowOf("me").querySelectorAll(".pt-cw");
      mine.forEach((m, k) => { if(chips[k]) chips[k].classList.add(m.ok ? "is-ok" : "is-miss"); });
      if(caught) rowOf("me").classList.add("is-imp"); else { api.snd("ok"); api.haptic("success"); }
      const opts = guessOpts(C, cs);
      opts.forEach(keep);
      stage(`<p class="pt-big">${caught ? "¡Te pillaron!" : "¡No te pillaron!"}</p>
        <p class="pt-p" id="pt-gq">${caught ? "Última oportunidad" : "Ahora"}: ¿cuál era la palabra secreta?</p>
        <div class="pt-opts pt-4" id="pt-opts">${opts.map((w, k) => optHtml(w, k)).join("")}</div>`);
      let done = false;
      main.querySelector("#pt-opts").onclick = e => {
        const b = e.target.closest(".pt-op"); if(!b) return;
        const w = opts[+b.dataset.k];
        if(done){ talk(w); return; }
        done = true;
        const ok = w.id === cs.w.id;
        api.answer(ok, {es: cs.w.es, word: cs.w.word});
        main.querySelectorAll(".pt-op").forEach(x => x.classList.toggle("is-right", opts[+x.dataset.k].id === cs.w.id));
        if(ok){ b.classList.add("is-ok"); api.snd("ok"); api.haptic("success"); } else b.classList.add("is-miss");
        main.querySelector("#pt-gq").innerHTML = ok ? `¡Sí! Era <b lang="${esc(code())}">${esc(cs.w.word)}</b>.` : `Era <b lang="${esc(code())}">${esc(cs.w.word)}</b>.`;
        api.later(run, () => talk(cs.w), 250);
        dock.innerHTML = btn("pt-end", "Ver el premio", "caret-right");
        const stars = (caught ? 0 : 1) + (ok ? 1 : 0) + 1, score = (caught ? 0 : 3) + (ok ? 3 : 0);
        on("#pt-end", () => end(stars, score,
          !caught && ok ? "¡Impostor perfecto: no te pillaron y adivinaste la palabra!" : ok ? "¡Adivinaste la palabra!" : !caught ? "¡No te pillaron!" : "¡Buen intento, impostor!",
          [cs.w, ...mine.map(m => m.w), cs.hint, ...opts], ok ? [] : [cs.w.id]));
      };
    }
  }

  function optHtml(w, k){
    return `<button type="button" class="pt-op" data-k="${k}" data-key="${k + 1}" style="--i:${k}" aria-label="${esc(w.word)}">
      <span class="pt-opi${w.img ? "" : " no-img"}">${w.img ? imgHtml(w.img) : IC("chat-circle-text", "bold", 40)}</span>${wHtml(w)}
      <span class="pt-mk" aria-hidden="true">${IC("check", "bold", 18)}${IC("x", "bold", 18)}</span></button>`;
  }
  /* el premio: finish() de games.js (récord y monedas como los demás) */
  function end(stars, score, line, ws, misses = []){
    stopTalk();
    const seenW = new Set(), words = [];
    for(const w of ws) if(w && !seenW.has(w.id)){ seenW.add(w.id); words.push({word: w.word, es: w.es, img: w.img, miss: misses.includes(w.id)}); }
    api.finish(run, IMP, {score, stars: Math.max(1, Math.min(3, stars)), words, line});
  }

  /* la explicación (la primera vez) y luego el modo; con ?m= directo a ese modo */
  if(!q) choose();
  api.intro(run, IMP, () => { useKeys(api, run); if(q === "grupo") names(); else if(q === "solo") solo(); });
}

/* =====================================================================
   ORDENAR POR GRUPO
   ===================================================================== */
function sortSets(D){
  const G = (D && D.sort && D.sort.groups) || {}, out = [];
  ((D && D.sort && D.sort.sets) || []).forEach((ids, si) => {
    if(!Array.isArray(ids) || ids.length < 2 || ids.length > 3) return;
    const per = ids.length === 3 ? 4 : 5;
    const gs = ids.map(id => {
      const g = G[id], n = g && g.n && g.n[lang], p = g && W(D, g.pic);
      if(!g || !Array.isArray(n) || !n[0] || !p || !p.img) return null;
      const ws = (Array.isArray(g.w) ? g.w : []).map(x => W(D, x)).filter(x => x && x.img && x.id !== p.id);
      return ws.length >= per ? {id, es: g.es, name: {word: n[0], ipa: n[1] || ""}, pic: p, ws} : null;
    });
    if(gs.every(Boolean)) out.push({si, gs, per});
  });
  return out;
}

/* los nombres largos de una sola palabra (bondegårdsdyr) más pequeños, para que no se partan */
const nameFs = t => { const n = Math.max(...String(t).split(/\s+/).map(x => [...x].length)); return n > 12 ? ` style="font-size:.78rem"` : n > 9 ? ` style="font-size:.88rem"` : ""; };
async function ordenar(app, api, mode){
  const my = api.nav();
  css();
  let D = null;
  try{ D = await load(); }catch(e){ D = null; }
  if(!api.here(my, SORT)) return;
  const S = sortSets(D);
  if(!S.length){ empty(app, `Este juego todavía no tiene palabras en ${api.nm()}.`); return; }
  const set = pick(fresh(S, "sort", x => x.si));
  remember("sort", set.si, 8);
  /* las palabras: per de cada cesta, sin repetir dibujo ni palabra entre cestas */
  const seenK = new Set(), items = [];
  set.gs.forEach((g, gi) => {
    let n = 0;
    for(const w of shuffle(g.ws)){
      if(n >= set.per) break;
      const k = w.word.toLowerCase();
      if(seenK.has(k) || seenK.has(w.img)) continue;
      seenK.add(k); seenK.add(w.img); items.push(Object.assign({g: gi, miss: 0}, w)); n++;
    }
  });
  const Q = shuffle(items), N = Q.length;
  Q.forEach(w => { const im = new Image(); im.src = pic(w.img); });
  const nb = set.gs.length;
  const run = api.mount(app, `<div class="gm pt" id="pt">
    ${api.topHtml(SORT, `<span class="gm-pill" title="Ordenadas">${IC("basket", "bold", 18)}<span><b id="pt-n">0</b>/${N}</span></span>`)}
    <div class="pt-main pt-sort" id="pt-main">
      <button type="button" class="pt-wc" id="pt-wc" data-key="space" aria-describedby="pt-hint"></button>
      <p class="pt-hint" id="pt-hint" aria-live="polite">Toca la palabra y luego su cesta</p>
      <div class="pt-bks" id="pt-bks" style="--n:${nb}">${set.gs.map((g, gi) => `<div class="pt-bkw">
        <button type="button" class="pt-bk" data-g="${gi}" data-key="${gi + 1}" style="--c:${COLS[[0, 1, 3][gi]]}" aria-label="Cesta ${esc(g.name.word)}">
          <span class="pt-bkp">${imgHtml(g.pic.img)}</span>
          <span class="pt-w" lang="${esc(code())}"${nameFs(g.name.word)}>${esc(g.name.word)}</span>${ipaHtml(g.name.ipa, code(), "pt-ipa")}
          <span class="pt-in" aria-hidden="true"></span>
          <span class="pt-mk" aria-hidden="true">${IC("check", "bold", 18)}${IC("x", "bold", 18)}</span></button>
        <button type="button" class="pt-bk-say" data-g="${gi}" aria-label="Escuchar ${esc(g.name.word)}">${IC("speaker-high", "fill", 20)}</button></div>`).join("")}</div>
      ${api.dotsHtml(N)}
      <div class="pt-sp" id="pt-sp" aria-hidden="true" style="height:16px"></div>
    </div></div>`, mode);
  const root = run.root, card = root.querySelector("#pt-wc"), hint = root.querySelector("#pt-hint"), bks = [...root.querySelectorAll(".pt-bk")];
  const dots = [...root.querySelectorAll("#gm-dots i")];
  const live = () => api.live(run);
  let i = 0, sel = false, busy = false, misses = 0, firstOk = 0, started = false;
  const cur = () => Q[i];
  function paint(){
    const w = cur(); if(!w) return;
    sel = false;
    card.classList.remove("is-sel", "is-in"); void card.offsetWidth; card.classList.add("is-in");
    card.innerHTML = `<span class="pt-spkr" aria-hidden="true">${IC("speaker-high", "fill", 22)}</span><span class="pt-pic">${imgHtml(w.img)}</span>${wHtml(w)}`;
    card.setAttribute("aria-label", `${w.word}. Toca para oírla`);
    dots.forEach((d, k) => d.classList.toggle("now", k === i));
    bks.forEach(b => b.classList.remove("is-hint", "is-miss", "is-ok"));
    hint.textContent = "Toca la palabra y luego su cesta";
  }
  function select(){
    if(busy || !cur()) return;
    sel = true; card.classList.add("is-sel");
    talk(cur()); api.haptic("selection");
    hint.textContent = "Ahora toca su cesta";
  }
  /* dejar la palabra en la cesta gi; true si era la suya */
  function place(gi){
    const w = cur(); if(!w || busy || !live()) return false;
    const b = bks[gi];
    if(w.g !== gi){
      w.miss++; misses++;
      api.answer(false, {es: w.es, word: w.word});
      b.classList.remove("is-ok"); b.classList.add("is-miss");
      api.later(run, () => b.classList.remove("is-miss"), 900);
      if(w.miss >= 2){ bks[w.g].classList.add("is-hint"); hint.textContent = "Mira la cesta verde"; }
      else hint.textContent = "Esa no es. Prueba en otra cesta";
      return false;
    }
    busy = true;
    if(!w.miss) firstOk++;
    api.answer(true, {es: w.es, word: w.word});
    api.snd("ok"); api.haptic("success");
    bks.forEach(x => x.classList.remove("is-hint", "is-miss"));
    b.classList.add("is-ok");
    b.querySelector(".pt-in").insertAdjacentHTML("beforeend", imgHtml(w.img));
    if(dots[i]){ dots[i].classList.remove("now"); dots[i].classList.add(w.miss ? "meh" : "ok"); }
    const n = root.querySelector("#pt-n"); n.textContent = i + 1; api.bump(n.parentNode);
    card.classList.remove("is-sel");
    hint.textContent = "¡Muy bien!";
    api.later(run, () => {
      b.classList.remove("is-ok");
      i++; busy = false;
      if(i >= N){ done(); return; }
      paint();
      api.later(run, () => talk(cur()), RM() ? 100 : 250);
    }, RM() ? 350 : 650);
    return true;
  }
  function done(){
    const stars = misses <= 1 ? 3 : misses <= 4 ? 2 : 1;
    api.finish(run, SORT, {score: firstOk, stars,
      words: Q.map(w => ({word: w.word, es: w.es, img: w.img, miss: w.miss > 0})),
      line: misses === 0 ? `¡Las ${N} a la primera!` : `¡Ordenaste las ${N}! ${firstOk} a la primera.`});
  }
  card.onclick = () => { if(started) select(); };
  bks.forEach(b => b.onclick = () => {
    if(!started || busy) return;
    if(!sel){ select(); }   /* sin tocar antes la palabra: suena y entra igual */
    place(+b.dataset.g);
  });
  root.querySelectorAll(".pt-bk-say").forEach(b => b.onclick = () => { const g = set.gs[+b.dataset.g]; try{ say(g.name.word, b); }catch(e){} });
  /* arrastrar la palabra hasta una cesta */
  if(window.G && typeof G.drag === "function"){
    let over = null;
    const setOver = b => { if(over === b) return; if(over) over.classList.remove("is-over"); over = b; if(b) b.classList.add("is-over"); };
    const off = G.drag(card, {
      ghost: true,
      onStart: () => { if(!started || busy) return false; if(!sel) select(); },
      onMove: d => setOver(d.over && d.over.closest ? d.over.closest(".pt-bk") : null),
      onDrop: d => { const b = d.over && d.over.closest ? d.over.closest(".pt-bk") : null; setOver(null); return b ? place(+b.dataset.g) : false; },
      onCancel: () => setOver(null),
    });
    if(typeof off === "function") run.clean.push(off);
  }
  paint();
  api.autoFit(run, root.querySelector("#pt-sp"));
  useKeys(api, run);
  const go = () => {
    started = true; useKeys(api, run);
    /* los nombres de las cestas y luego la primera palabra */
    (async () => {
      for(const [gi, g] of set.gs.entries()){
        if(!live() || i > 0 || sel) return;
        const b = bks[gi]; b.classList.add("is-over");
        await sayP(g.name.word);
        b.classList.remove("is-over");
      }
      if(live() && i === 0 && !sel) talk(cur());
    })();
  };
  api.intro(run, SORT, go);
}

/* ---------- a Juegos ---------- */
const reg = (id, def) => window.vocabGames && typeof vocabGames.register === "function" && vocabGames.register(id, def);
if(!reg(IMP, {
  t: "El impostor", sub: "¿Quién no sabe la palabra?", img: "img/games/impostor.png",
  how: "Todos saben la palabra secreta menos el impostor, que solo tiene una pista. Por turnos, cada uno dice una palabra que tenga que ver. ¿Quién es el impostor? Se juega en grupo, pasando el aparato, o solo con el zorro y sus amigos.",
  words: "Palabras de muchos temas", fresh: true,
  rec: b => `${num(b.score)} ${num(b.score) === 1 ? "punto" : "puntos"}`,
  start: impostor,
})) console.warn("[party] no se pudo añadir «El impostor» a Juegos");
if(!reg(SORT, {
  t: "Ordenar por grupo", sub: "Cada cosa en su cesta", img: "img/games/ordenar.png",
  how: "Toca la palabra y luego su cesta, o arrástrala hasta ella. ¡Cada cosa en su grupo!",
  words: "Palabras de muchos temas", fresh: true,
  rec: b => `${num(b.score)} a la primera`,
  start: ordenar,
})) console.warn("[party] no se pudo añadir «Ordenar por grupo» a Juegos");
})();
