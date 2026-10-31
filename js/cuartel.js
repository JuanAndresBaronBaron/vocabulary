/* módulo cuartel: «Defensa del cuartel», un juego de Juegos registrado con vocabGames.register (como js/topos.js).
   Ruta: #/juegos/cuartel. Solo con el tema «Soldados» de Juegos ("militar"; con los demás sale en oscuro, como «Misión
     por radio» de js/army.js).
   El campo: abajo, el soldado (de espaldas, con su casco) delante de los sacos terreros del cuartel; desde el horizonte
     llegan por 3 caminos robots, drones y tanquecitos de dibujos animados (sin personas). Se dispara tocando un
     enemigo (o su camino, o al soldado: al que esté más cerca) o con las teclas 1-3 (← ↑ →); sale un trazo de luz del
     fusil hasta él. Al caer: una nube de humo con estrellas y «¡Neutralizado!». El tanque aguanta 2 disparos.
   El cargador: 6 balas (dibujadas abajo a la izquierda). Vacío, o al tocar «Recargar» (tecla R), sale el panel de
     recarga y los enemigos se paran: una pregunta de la jerga de los soldados, de nivel 1 a 3 según avanza la
     partida, una y otra clase:
     · «¿Cómo se dice?»: el dibujo y la palabra en español; se elige la palabra en el idioma entre 3.
     · «Escucha»: suena la palabra; se elige su dibujo entre 3 (con su español debajo).
     Bien: el cargador lleno (y 2 balas extra cada 3 bien seguidas), suena la palabra y se ve con su IPA.
     Mal: ✗ gris, la buena se ilumina y suena, y solo entran 2 balas (sin sonido triste); esa palabra vuelve más tarde.
   El cuartel tiene 3 vidas (corazones dorados, los perdidos en gris): cada enemigo que llega a los sacos quita una.
     5 oleadas, cada una con más enemigos y más rápidos, con un letrero entre una y otra. La radio habla con la jerga
     del ejército del idioma (data/army/<en|fr|da>.json, como el avión de Pajarito volador): «Roger», «Copy»,
     «Forward, march!», «Mayday»… con su español y su IPA.
   Acaba al superar las 5 oleadas o sin vidas. Puntos = enemigos neutralizados; estrellas por enemigos y recargas bien
     (★★★: casi todos y 3 de cada 4 bien; ★★: la mitad y la mitad bien). Palabras del resultado: las de las preguntas
     (en gris las falladas).
   Usa de games.js lo de los demás juegos: tarjeta del menú, récord, explicación la primera vez, «?», pausa (todo se
     para: los enemigos, la radio y el panel) y finish() (récord en "games:best".cuartel, monedas desde «+N»).
   Pruebas: window.__cuartel = {per: n, speed: k} (n enemigos por oleada, k veces más rápido); run.root.cuState() → el
     estado; cada opción del panel lleva .cuOk. */
(() => {
"use strict";

const ID = "cuartel", LIVES = 3, MAG = 6, BONUS = 2, MAX_LEN = 34;
/* las oleadas: enemigos (de ellos, tanques y drones), segundos que tarda un robot desde el horizonte hasta los sacos,
   segundos entre uno y otro y cuántos a la vez como mucho */
const WAVES = [
  {n: 5, tank: 0, drone: 1, T: 14, gap: 2.8, max: 3},
  {n: 6, tank: 1, drone: 1, T: 12.5, gap: 2.5, max: 3},
  {n: 7, tank: 1, drone: 2, T: 11.5, gap: 2.2, max: 4},
  {n: 8, tank: 2, drone: 2, T: 10.5, gap: 2, max: 4},
  {n: 9, tank: 2, drone: 3, T: 9.5, gap: 1.8, max: 4},
];
/* el nivel de las preguntas: según la oleada (de LO a HI) y cuántas van (1 + una cada 3) */
const LO = [1, 1, 1, 2, 2], HI = [1, 2, 2, 3, 3];
const LVN = {1: "Básico", 2: "Intermedio", 3: "Avanzado"};
/* k: tamaño, ar: alto/ancho del dibujo, hp: disparos que aguanta, sp: velocidad */
const KIND = {robot: {k: 1, ar: 1.12, hp: 1, sp: 1, name: "Robot"}, drone: {k: 1.04, ar: .667, hp: 1, sp: 1.2, name: "Dron"}, tank: {k: 1.14, ar: .833, hp: 2, sp: .8, name: "Tanque"}};
const AB = {english: "en", "français": "fr", dansk: "da"};
const IC = (n, s = "bold", z = 22, c = "") => typeof ico === "function" ? ico(n, s, z, c) : "";
const RM = () => { try{ return !!(window.M && typeof M.rm === "function" && M.rm()); }catch(e){ return false; } };
const pic = src => (window.vocabGames && typeof vocabGames.pic === "function") ? vocabGames.pic(src) : src;
const pick = a => a[Math.floor(Math.random() * a.length)];
const mix = a => { const b = a.slice(); for(let i = b.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const fits = x => x && typeof x.word === "string" && x.word.trim() && [...x.word].length <= MAX_LEN && typeof x.es === "string" && x.es.trim()
  && typeof x.img === "string" && x.img;
const lvOf = x => x && x.lvl >= 1 && x.lvl <= 3 ? Math.round(x.lvl) : 1;
const imgHtml = it => { const s = pic(it.img); return `<img src="${esc(s)}" alt="" draggable="false"${s !== it.img ? ` data-f="${esc(it.img)}" onerror="if(this.dataset.f){this.src=this.dataset.f;delete this.dataset.f}"` : ""}>`; };
const ipa = (w, code) => typeof ipaHtml === "function" && w ? ipaHtml(w, code) : "";

/* la jerga del ejército (para la radio): {id: {w, es, ipa}}; si no carga, el juego sigue sin radio */
const ARMY = {};
function loadArmy(ab){
  if(!ARMY[ab]) ARMY[ab] = fetch(`data/army/${ab}.json`).then(r => { if(!r.ok) throw new Error(`data/army/${ab}.json ${r.status}`); return r.json(); })
    .catch(e => { delete ARMY[ab]; throw e; });
  return ARMY[ab];
}
function termsOf(A){
  const out = {};
  for(const t of (A && Array.isArray(A.terms) ? A.terms : [])) if(t && typeof t.id === "string" && typeof t.w === "string" && t.w.trim())
    out[t.id] = {w: t.w.trim(), es: String(t.es || ""), ipa: String(t.ipa || "")};
  return out;
}

/* ---------- dibujos propios (trazo negro y colores planos, como los demás dibujos de Juegos) ---------- */
/* el soldado, de espaldas: casco, mochila y el fusil apuntando al horizonte (la boca del fusil en 84.5, 1) */
const SOLDIER = `<svg class="cu-svg" viewBox="0 0 120 130" aria-hidden="true" focusable="false">
  <g stroke="#000" stroke-linejoin="round">
  <rect x="80" y="6" width="9" height="66" rx="3" fill="#3b4652" stroke-width="3"/>
  <rect x="82.5" y="0" width="4" height="9" rx="1.5" fill="#26303a" stroke-width="2"/>
  <rect x="75.5" y="38" width="18" height="24" rx="4" fill="#4d5966" stroke-width="3"/>
  <path d="M8 130 C8 102 18 86 40 81 L80 81 C102 86 112 102 112 130Z" fill="#5b6e43" stroke-width="3.5"/>
  <path d="M24 102 L24 130 M96 102 L96 130" stroke="#46562f" stroke-width="3"/>
  <rect x="33" y="88" width="54" height="44" rx="11" fill="#a58c5c" stroke-width="3"/>
  <path d="M33 102 Q60 111 87 102" fill="none" stroke-width="2.5"/>
  <rect x="54" y="105" width="12" height="9" rx="2" fill="#7d6a44" stroke-width="2"/>
  <path d="M40 83 L37 92 M80 83 L83 92" stroke-width="3.5"/>
  <rect x="50" y="66" width="20" height="17" fill="#e2aa7d" stroke-width="3"/>
  <ellipse cx="38" cy="58" rx="6" ry="8" fill="#eab68a" stroke-width="3"/><ellipse cx="82" cy="58" rx="6" ry="8" fill="#eab68a" stroke-width="3"/>
  <circle cx="60" cy="53" r="22" fill="#eab68a" stroke-width="3"/>
  <path d="M40 56 Q60 72 80 56 L80 50 L40 50Z" fill="#6b4a2f" stroke="none"/>
  <path d="M32 52 C32 16 88 16 88 52Z" fill="#6f8152" stroke-width="3.5"/>
  <path d="M27 52 Q60 61 93 52 Q96 61 88 62 Q60 69 32 62 Q24 61 27 52Z" fill="#55663f" stroke-width="3"/>
  <path d="M39 33 Q60 25 81 33 M36 43 Q60 36 84 43" fill="none" stroke="#3f4d2e" stroke-width="2.6"/>
  <path d="M99 96 Q98 80 87 71" fill="none" stroke-width="17" stroke-linecap="round"/>
  <path d="M99 96 Q98 80 87 71" fill="none" stroke="#5b6e43" stroke-width="11" stroke-linecap="round"/>
  <circle cx="85" cy="68" r="7.5" fill="#eab68a" stroke-width="3"/></g></svg>`;
const MUZZLE = {x: 84.5, y: 1, w: 120, h: 130};
/* un robot que camina (de frente), un dron y un tanquecito con cara: grises de acero con luces amarillas */
const ROBOT = `<svg class="cu-fsvg" viewBox="0 0 100 112" aria-hidden="true" focusable="false"><g stroke="#000" stroke-width="3.5" stroke-linejoin="round">
  <path d="M50 16 V6" stroke-width="3"/><circle cx="50" cy="6" r="5" fill="#FCD34D" stroke-width="2.5"/>
  <rect x="25" y="15" width="50" height="34" rx="11" fill="#93a4b8"/>
  <rect x="32" y="23" width="36" height="17" rx="8.5" fill="#1f2d3d" stroke-width="2.5"/>
  <rect x="44" y="48" width="12" height="7" fill="#4b5a6b" stroke-width="2.5"/>
  <rect x="8" y="58" width="13" height="27" rx="6.5" fill="#93a4b8"/><rect x="79" y="58" width="13" height="27" rx="6.5" fill="#93a4b8"/>
  <rect x="19" y="54" width="62" height="38" rx="11" fill="#6b7d93"/>
  <rect x="35" y="61" width="30" height="17" rx="4" fill="#d3dbe5" stroke-width="2.5"/>
  <g class="cu-legs"><rect x="29" y="90" width="15" height="13" rx="3" fill="#4b5a6b"/><rect x="56" y="90" width="15" height="13" rx="3" fill="#4b5a6b"/>
  <rect x="24" y="100" width="22" height="9" rx="4.5" fill="#334155"/><rect x="54" y="100" width="22" height="9" rx="4.5" fill="#334155"/></g></g>
  <circle cx="42" cy="31.5" r="4.6" fill="#FCD34D"/><circle cx="58" cy="31.5" r="4.6" fill="#FCD34D"/>
  <circle cx="43.4" cy="30.2" r="1.5" fill="#fff"/><circle cx="59.4" cy="30.2" r="1.5" fill="#fff"/>
  <circle cx="43" cy="69.5" r="3.6" fill="#0e9aa7" stroke="#000" stroke-width="1.6"/><circle cx="57" cy="69.5" r="3.6" fill="#FCD34D" stroke="#000" stroke-width="1.6"/></svg>`;
const DRONE = `<svg class="cu-fsvg" viewBox="0 0 120 80" aria-hidden="true" focusable="false"><g stroke="#000" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
  <path d="M22 32 H98" stroke-width="6"/><path d="M22 32 H98" stroke="#64748b" stroke-width="2.5"/>
  <path d="M22 32 V20 M98 32 V20" stroke-width="4"/>
  <g class="cu-rot"><ellipse cx="22" cy="18" rx="19" ry="4.5" fill="#d3dbe5" stroke-width="2.6"/></g>
  <g class="cu-rot r2"><ellipse cx="98" cy="18" rx="19" ry="4.5" fill="#d3dbe5" stroke-width="2.6"/></g>
  <path d="M47 54 L40 68 M73 54 L80 68" stroke-width="3.5"/>
  <rect x="36" y="22" width="48" height="34" rx="14" fill="#5b6b80"/>
  <circle cx="60" cy="39" r="10" fill="#FCD34D" stroke-width="3"/></g>
  <circle cx="60" cy="39" r="4.2" fill="#1f2d3d"/><circle cx="61.6" cy="37.4" r="1.4" fill="#fff"/></svg>`;
const TANK = `<svg class="cu-fsvg" viewBox="0 0 120 100" aria-hidden="true" focusable="false"><g stroke="#000" stroke-width="3.5" stroke-linejoin="round">
  <rect x="5" y="48" width="28" height="47" rx="11" fill="#3a4350"/><rect x="87" y="48" width="28" height="47" rx="11" fill="#3a4350"/>
  <path d="M10 60 H28 M10 71 H28 M10 82 H28 M92 60 H110 M92 71 H110 M92 82 H110" stroke="#8a96a3" stroke-width="2.5"/>
  <path d="M27 54 H93 L99 92 H21Z" fill="#74879a"/>
  <path d="M36 55 C36 24 84 24 84 55Z" fill="#8fa1b3"/>
  <rect x="52" y="21" width="16" height="8" rx="3" fill="#74879a" stroke-width="2.6"/>
  <circle cx="60" cy="44" r="9" fill="#3a4350" stroke-width="3"/><circle cx="60" cy="44" r="4" fill="#000" stroke="none"/>
  <rect x="36" y="64" width="14" height="10" rx="3.5" fill="#FCD34D" stroke-width="2.6"/><rect x="70" y="64" width="14" height="10" rx="3.5" fill="#FCD34D" stroke-width="2.6"/>
  <path d="M46 82 Q60 88 74 82" fill="none" stroke-width="3"/></g></svg>`;
const FOE_SVG = {robot: ROBOT, drone: DRONE, tank: TANK};
/* la nube del humo (con estrellas doradas alrededor) */
const CLOUD = `<svg viewBox="0 0 100 80" aria-hidden="true" focusable="false"><path d="M22 70 C6 70 4 50 18 46 C14 30 34 22 44 32 C48 14 76 14 78 34 C94 32 98 54 84 60 C88 72 70 76 62 70 C54 78 34 78 22 70Z"
  fill="#eef2f6" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/><path d="M30 56 C40 62 58 62 70 54" fill="none" stroke="#b8c3cf" stroke-width="4" stroke-linecap="round"/></svg>`;
const STAR = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2 L14.8 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.2 8.6Z" fill="#FFD34D" stroke="#000" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
/* una bala del cargador (latón y punta de cobre); gastada: solo el contorno */
const BULLET = `<svg viewBox="0 0 14 32" aria-hidden="true" focusable="false"><path d="M3 13 C3 6 7 1 7 1 C7 1 11 6 11 13Z" class="cu-tip"/><rect x="2.5" y="13" width="9" height="17" rx="1.5" class="cu-case"/>
  <path d="M2.5 25.5 H11.5" class="cu-ring"/></svg>`;
/* los sacos terreros (un trozo que se repite) */
const BAGS = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 48" width="80" height="48"><g stroke="#000" stroke-width="2.6" stroke-linejoin="round">
  <rect x="2" y="2" width="36" height="21" rx="10" fill="#cfb27c"/><rect x="42" y="2" width="36" height="21" rx="10" fill="#c4a56c"/>
  <rect x="-18" y="25" width="36" height="21" rx="10" fill="#c4a56c"/><rect x="22" y="25" width="36" height="21" rx="10" fill="#cfb27c"/><rect x="62" y="25" width="36" height="21" rx="10" fill="#c4a56c"/></g>
  <g stroke="#8a6f43" stroke-width="2" stroke-linecap="round"><path d="M12 8 V17 M52 8 V17 M32 31 V40 M72 31 V40 M-8 31 V40"/></g></svg>`);
const ICO_RELOAD = `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false"><path d="M19.5 12 A7.5 7.5 0 1 1 16.8 6.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M14.5 3.2 L19.6 5.4 L17.4 10.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const CSS = `
.cu{max-width:760px}
.cu .gm-top{margin-bottom:8px}
/* el campo: el cielo hasta el horizonte (--hz) y el prado hasta los sacos */
.cu-stage{position:relative;overflow:hidden;height:520px;border-radius:22px;isolation:isolate;touch-action:manipulation;user-select:none;-webkit-user-select:none;
  -webkit-tap-highlight-color:transparent;cursor:crosshair;
  background:linear-gradient(180deg,#8fc6ea 0%,#d5ebf6 var(--hz,17%),#a3c06f var(--hz,17%),#7d9f52 100%)}
[data-theme=dark] .cu-stage{background:linear-gradient(180deg,#0d2240 0%,#2a4d72 var(--hz,17%),#456a38 var(--hz,17%),#2d4a26 100%)}
.cu-stage:focus{outline:none}
.cu-land{position:absolute;inset:0;z-index:1;pointer-events:none}
.cu-land svg{display:block}
.cu-hill{fill:#7e9fb7}.cu-hill2{fill:#94b07e}
.cu-ln{fill:#d3b886;stroke:#b39563;stroke-width:2}
.cu-dash{stroke:rgba(255,255,255,.55);stroke-width:3;stroke-dasharray:10 14;fill:none}
.cu-bush{fill:#5f8a45;stroke:#000;stroke-width:2.5}
.cu-rock{fill:#a7aeb5;stroke:#000;stroke-width:2.2}
.cu-tuft{stroke:#5d7f3c;stroke-width:2.5;fill:none;stroke-linecap:round}
[data-theme=dark] .cu-hill{fill:#2f4a66}[data-theme=dark] .cu-hill2{fill:#3c5a35}
[data-theme=dark] .cu-ln{fill:#7a6544;stroke:#5e4d33}
[data-theme=dark] .cu-dash{stroke:rgba(255,255,255,.28)}
[data-theme=dark] .cu-bush{fill:#3d6230}
[data-theme=dark] .cu-rock{fill:#6b737b}
[data-theme=dark] .cu-tuft{stroke:#2c4723}
/* los enemigos: la caja (≥ 60 px para tocar) y el dibujo abajo, centrado */
.cu-foe{position:absolute;left:0;top:0;z-index:10;display:block;padding:0;margin:0;border:0;background:none;cursor:crosshair}
.cu-fv{position:absolute;left:50%;bottom:0;display:block;transform:translateX(-50%)}
.cu-fv .cu-fsvg{display:block;width:100%;height:auto;overflow:visible}
.cu-sh{position:absolute;left:50%;bottom:-4px;width:70%;height:12%;min-height:6px;transform:translateX(-50%);border-radius:50%;background:rgba(0,0,0,.22)}
.cu-foe.robot .cu-fsvg{animation:cu-walk .5s ease-in-out infinite alternate;transform-origin:50% 100%}
.cu-foe.robot .cu-legs{animation:cu-step .25s steps(2) infinite}
.cu-foe.drone .cu-fsvg{animation:cu-hover .7s ease-in-out infinite alternate}
.cu-foe.tank .cu-fsvg{animation:cu-rumble .18s linear infinite alternate}
.cu-rot{transform-box:fill-box;transform-origin:50% 50%;animation:cu-spin .12s linear infinite alternate}
.cu-rot.r2{animation-delay:-.06s}
@keyframes cu-walk{from{transform:rotate(-3deg)}to{transform:rotate(3deg) translateY(-3%)}}
@keyframes cu-step{50%{transform:translateY(-2px)}}
@keyframes cu-hover{to{transform:translateY(-6%)}}
@keyframes cu-rumble{to{transform:translateY(1.5%)}}
@keyframes cu-spin{to{transform:scaleX(.25)}}
/* el tanque: 2 puntos de vida encima; tocado, se pone gris un momento */
.cu-hp{position:absolute;left:50%;top:-14px;transform:translateX(-50%);display:flex;gap:4px}
.cu-hp i{width:12px;height:12px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 2px #000}
.cu-hp i.off{background:#aeb6bf}
.cu-foe.hurt .cu-fv{animation:cu-hurt .35s}
@keyframes cu-hurt{30%{filter:brightness(1.8);transform:translateX(-50%) scale(.92)}}
.cu-foe.gone{opacity:0;transition:opacity .25s}
/* el soldado (delante de los sacos) y los sacos */
.cu-wall{position:absolute;left:0;right:0;bottom:0;z-index:46;height:var(--base,110px);background:url("${BAGS}") 50% 0/calc(var(--base,110px) * .92) calc(var(--base,110px) * .55) repeat;
  box-shadow:0 -2px 0 rgba(0,0,0,.18)}
[data-theme=dark] .cu-wall{filter:brightness(.72) saturate(.9)}
.cu-sold{position:absolute;left:50%;bottom:0;z-index:48;padding:0;margin:0;border:0;background:none;cursor:pointer;transform-origin:50% 100%;
  transform:translateX(-50%) rotate(var(--aim,0rad));transition:transform .5s ease-out}
.cu-sold.aim{transition:transform .07s ease-out}
.cu-sold .cu-svg{display:block;width:100%;height:auto}
.cu-sold:focus-visible{outline:3px solid #fff;outline-offset:-4px;border-radius:16px}
/* los disparos: un trazo de luz y un destello en la boca del fusil */
.cu-tr{position:absolute;z-index:49;height:5px;margin-top:-2.5px;transform-origin:0 50%;border-radius:3px;pointer-events:none;
  background:linear-gradient(90deg,rgba(255,236,160,.2),#ffe27a 45%,#fffbe8);box-shadow:0 0 8px #ffd34d;animation:cu-tr .26s ease-out forwards}
@keyframes cu-tr{0%{clip-path:inset(0 100% 0 0)}40%{clip-path:inset(0 0 0 0);opacity:1}100%{clip-path:inset(0 0 0 70%);opacity:0}}
.cu-fl{position:absolute;z-index:49;width:30px;height:30px;margin:-15px 0 0 -15px;pointer-events:none;animation:cu-fl .2s ease-out forwards}
.cu-fl svg{display:block;width:100%;height:100%}
@keyframes cu-fl{from{transform:scale(.4)}to{transform:scale(1.3);opacity:0}}
/* neutralizado: la nube, las estrellas y el letrero */
.cu-puff{position:absolute;z-index:47;width:var(--z,90px);height:var(--z,90px);margin:calc(var(--z,90px) / -2) 0 0 calc(var(--z,90px) / -2);pointer-events:none}
.cu-puff>svg{position:absolute;inset:8% 0 auto;width:100%;height:auto;animation:cu-puff .7s ease-out forwards}
.cu-puff i{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px;animation:cu-star .7s ease-out forwards}
.cu-puff i svg{display:block;width:100%;height:100%}
@keyframes cu-puff{0%{transform:scale(.3);opacity:1}55%{transform:scale(1.05);opacity:1}100%{transform:scale(1.2);opacity:0}}
@keyframes cu-star{0%{transform:translate(0,0) scale(.4)}70%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(1) rotate(160deg);opacity:0}}
.cu-puff.dust>svg path:first-child{fill:#d9c7a1}
.cu-neu{position:absolute;z-index:58;padding:4px 12px;border-radius:999px;background:#0b2545;color:#ffd34d;font:800 1rem/1.2 var(--f-round);white-space:nowrap;
  pointer-events:none;transform:translate(-50%,-100%);box-shadow:0 0 0 2px #fff;animation:cu-neu 1s ease-out forwards}
.cu-neu.gray{background:#6c6c70;color:#fff}
@keyframes cu-neu{0%{opacity:0;translate:0 8px}15%{opacity:1;translate:0 0}75%{opacity:1}100%{opacity:0;translate:0 -36px}}
.cu-stage.shake{animation:cu-shake .4s}
@keyframes cu-shake{20%{transform:translateX(-6px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}
/* lo de abajo: el cargador (izquierda) y «Recargar» (derecha), encima de los sacos */
.cu-mag{position:absolute;z-index:52;left:10px;bottom:calc(10px + var(--safe-b,0px));display:grid;grid-template-columns:repeat(var(--cols,6),14px);gap:4px;
  padding:8px;border-radius:16px;background:rgba(11,37,69,.84);box-shadow:0 0 0 2px rgba(255,255,255,.7)}
.cu-mag i{display:block;width:14px;height:32px}
.cu-mag svg{display:block;width:100%;height:100%}
.cu-mag .cu-tip{fill:#c8793e;stroke:#000;stroke-width:1.6}
.cu-mag .cu-case{fill:#e7b73c;stroke:#000;stroke-width:1.6}
.cu-mag .cu-ring{stroke:#a87a1a;stroke-width:1.6}
.cu-mag i.off .cu-tip,.cu-mag i.off .cu-case{fill:none;stroke:#8e8e93}
.cu-mag i.off .cu-ring{stroke:none}
.cu-mag i.bonus{filter:drop-shadow(0 0 4px #ffd34d)}
.cu-mag i.new{animation:cu-load .35s both}
@keyframes cu-load{from{transform:translateY(-10px);opacity:0}}
.cu-mag.low{box-shadow:0 0 0 3px var(--gold)}
.cu-rb{position:absolute;z-index:52;right:10px;bottom:calc(10px + var(--safe-b,0px));min-width:76px;min-height:68px;padding:6px 10px;border:0;border-radius:18px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:#0b2545;color:#fff;font:800 .82rem/1 var(--f-round);
  cursor:pointer;box-shadow:0 0 0 2px rgba(255,255,255,.75),0 4px 0 rgba(0,0,0,.25);touch-action:manipulation}
.cu-rb svg{color:#ffd34d}
.cu-rb:active{transform:translateY(2px)}
.cu-rb[aria-disabled=true]{opacity:.82}.cu-rb[aria-disabled=true] svg{color:#9fb0c4}
.cu-rb.go{animation:cu-pulse 1s ease-in-out infinite}
@keyframes cu-pulse{50%{box-shadow:0 0 0 5px var(--gold),0 4px 0 rgba(0,0,0,.25)}}
.cu-rb:focus-visible{outline:3px solid #fff;outline-offset:3px}
.cu-kk{display:none;position:absolute;top:-8px;right:-6px;min-width:20px;padding:3px 5px;border-radius:7px;background:#fff;color:#0b2545;font:800 .72rem/1 var(--f-text);
  box-shadow:0 0 0 1.5px #0b2545}
.cu-lk{position:absolute;z-index:3;display:none;transform:translate(-50%,-100%);padding:3px 7px;border-radius:7px;background:rgba(11,37,69,.7);color:#fff;
  font:800 .74rem/1 var(--f-text);pointer-events:none}
@media (hover:hover) and (pointer:fine){.cu-kk,.cu-lk{display:block}}
/* arriba: la oleada y la radio */
.cu-wv{position:absolute;z-index:52;left:10px;top:10px;display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:999px;
  background:rgba(11,37,69,.78);color:#fff;font:800 .9rem/1 var(--f-round);pointer-events:none;box-shadow:0 0 0 1.5px rgba(255,255,255,.55)}
.cu-wv .ico{color:#ffd34d}
.cu-radio{position:absolute;z-index:60;left:50%;top:48px;transform:translate(-50%,-8px);width:max-content;max-width:calc(100% - 20px);opacity:0;display:flex;align-items:center;
  gap:8px;padding:8px 12px;border-radius:14px;background:rgba(18,26,14,.9);color:#e5f0d8;font:700 .95rem/1.25 var(--f-text);pointer-events:none;
  box-shadow:0 0 0 2px #6f8152;transition:opacity .25s,transform .25s}
.cu-radio.on{opacity:1;transform:translate(-50%,0)}
.cu-radio .ico{flex:none;color:#FCD34D}
.cu-radio b{color:#fff;font-family:var(--f-round);font-weight:800}
.cu-radio small{display:block;color:#c5d4b2;font-weight:600}
.cu-radio .ipa{color:#c5d4b2;font-weight:500;margin-left:.3em}
.cu-ban{position:absolute;z-index:62;left:50%;top:38%;transform:translate(-50%,-50%) scale(.6);opacity:0;padding:14px 26px;border-radius:999px;text-align:center;
  background:#0b2545;color:#ffd34d;font:800 1.7rem/1.1 var(--f-round);box-shadow:0 0 0 4px #fff,0 10px 24px rgba(0,0,0,.3);pointer-events:none;
  transition:transform .3s cubic-bezier(.3,1.5,.5,1),opacity .3s;white-space:nowrap}
.cu-ban small{display:block;margin-top:4px;color:#fff;font:700 .95rem/1.2 var(--f-text)}
.cu-ban.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
.cu-stage .gm-over{z-index:90}
.cu-stage .gm-over .ico{color:var(--gold)}
/* el panel de recarga (los enemigos esperan) */
.cu-rl{position:absolute;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:10px;background:rgba(11,37,69,.5);cursor:default}
.cu-rl[hidden]{display:none}
.cu-rl-c{width:100%;max-width:460px;max-height:100%;overflow:auto;padding:14px 14px 16px;border-radius:22px;background:var(--card,#fff);color:var(--label,#0b2545);
  box-shadow:0 12px 30px rgba(0,0,0,.35),inset 0 0 0 2px var(--sep);animation:cu-rl-in .3s cubic-bezier(.2,.9,.3,1.2)}
@keyframes cu-rl-in{from{transform:translateY(24px);opacity:.3}}
.cu-rl-h{display:flex;align-items:center;gap:8px;margin:0 0 10px}
.cu-rl-h>svg{flex:none;color:#b8860b}
.cu-rl-h b{font:800 1.25rem/1.15 var(--f-round)}
.cu-rl-h small{display:block;font:600 .85rem/1.25 var(--f-text);color:var(--label2)}
.cu-rl-lv{margin-left:auto;flex:none;padding:5px 9px;border-radius:999px;background:var(--fill);font:800 .74rem/1 var(--f-round);white-space:nowrap}
.cu-ask{display:flex;align-items:center;gap:12px;margin:0 0 12px}
.cu-ask-p{flex:none;width:clamp(84px,24vw,110px);aspect-ratio:1;border-radius:16px;background:var(--gm-tile,#fff);display:grid;place-items:center;box-shadow:0 0 0 2px var(--sep)}
.cu-ask-p img{width:86%;height:86%;object-fit:contain}
.cu-ask-t{min-width:0;display:flex;flex-direction:column;gap:3px}
.cu-ask-t span{font:700 .95rem/1.25 var(--f-text);color:var(--label2)}
.cu-ask-t b{font:800 clamp(1.4rem,6vw,1.8rem)/1.1 var(--f-round);overflow-wrap:anywhere}
.cu-say{flex:none;width:64px;height:64px;border:0;border-radius:50%;display:grid;place-items:center;background:var(--brand-fill,#1E6EF4);color:#fff;cursor:pointer;
  box-shadow:0 4px 0 rgba(0,0,0,.2)}
.cu-say:focus-visible{outline:3px solid var(--brand-tint);outline-offset:3px}
.cu-ops{display:grid;gap:8px}
.cu-ops.pics{grid-template-columns:repeat(3,minmax(0,1fr))}
.cu-op{position:relative;display:flex;align-items:center;gap:10px;min-height:58px;padding:8px 14px;border:0;border-radius:16px;background:var(--fill);color:var(--label);
  font:800 1.2rem/1.2 var(--f-round);text-align:left;cursor:pointer;box-shadow:inset 0 0 0 2px var(--sep);overflow-wrap:anywhere;touch-action:manipulation}
.cu-op:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.cu-op .cu-n{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#0b2545;color:#fff;font:800 .85rem/1 var(--f-text)}
.cu-op .cu-m{display:none;margin-left:auto;flex:none;width:30px;height:30px;border-radius:50%;place-items:center;color:#fff}
.cu-ops.pics .cu-op{flex-direction:column;justify-content:flex-start;gap:6px;padding:8px 6px 10px;text-align:center;font:700 .9rem/1.2 var(--f-text)}
.cu-ops.pics .cu-op .cu-im{width:100%;aspect-ratio:1;border-radius:12px;background:var(--gm-tile,#fff);display:grid;place-items:center}
.cu-ops.pics .cu-op .cu-im img{width:84%;height:84%;object-fit:contain}
.cu-ops.pics .cu-op .cu-n{position:absolute;left:6px;top:6px;width:24px;height:24px}
.cu-ops.pics .cu-op .cu-m{position:absolute;right:6px;top:6px;margin:0}
.cu-op.ok{background:#d8f1f4;color:#063a40;box-shadow:inset 0 0 0 3px var(--teal)}
.cu-op.ok .cu-m{display:grid;background:var(--teal)}
.cu-op.no{background:#e5e5ea;color:#3a3a3c;box-shadow:inset 0 0 0 3px #8e8e93}
.cu-op.no .cu-m{display:grid;background:#8e8e93}
.cu-op.ok .cu-m .x,.cu-op.no .cu-m .v{display:none}
.cu-op:disabled{cursor:default;opacity:1}
.cu-op:disabled:not(.ok):not(.no){opacity:.55}
[data-theme=dark] .cu-op.ok{background:#0f3d44;color:#e6fbff}
[data-theme=dark] .cu-op.no{background:#3a3a3c;color:#e5e5ea}
.cu-fb{min-height:1.4em;margin:12px 0 0;font:700 1rem/1.35 var(--f-text);overflow-wrap:anywhere}
.cu-fb b{font-family:var(--f-round);font-weight:800;font-size:1.15em}
.cu-fb .ipa{font-weight:500;margin-left:.3em}
.cu-fb small{display:block;color:var(--label2);font-weight:600}
.cu-go{margin-top:12px}
.cu-go[hidden]{display:none}
@media (max-width:420px){.cu-ban{font-size:1.4rem;padding:12px 20px}.cu-radio{font-size:.88rem}}
.cu-frozen .cu-foe *,.cu-frozen .cu-tr,.cu-frozen .cu-fl,.cu-frozen .cu-puff *,.cu-frozen .cu-neu{animation-play-state:paused!important}
.cu-paused .cu-rl *{animation-play-state:paused!important}
@media (prefers-reduced-motion:reduce){.cu-foe .cu-fsvg,.cu-foe .cu-legs,.cu-rot,.cu-stage.shake,.cu-rl-c,.cu-rb.go,.cu-mag i.new{animation:none!important}
  .cu-sold,.cu-ban,.cu-radio{transition:none}.cu-tr,.cu-fl,.cu-puff>svg,.cu-puff i,.cu-neu{animation-duration:.01s!important}}
`;
function css(){
  if(document.getElementById("css-cuartel")) return;
  const s = document.createElement("style"); s.id = "css-cuartel"; s.textContent = CSS; document.head.appendChild(s);
}

async function start(app, api, mode){
  const my = api.nav();
  css();
  const L = lang, ab = AB[L] || "en";
  let TP = {P: [], mil: false}, A = null;
  try{ TP = await api.topicPool(ID, 8, fits); }catch(e){}
  try{ A = await loadArmy(ab); }catch(e){ A = null; }
  if(!api.here(my, ID) || lang !== L) return;
  const P = TP.P, T = termsOf(A);
  if(P.length < 8){
    app.innerHTML = `<div class="gm"><div class="gm-empty"><p>Este juego todavía no tiene palabras en ${esc(api.nm())}.</p>
      <a class="glass-btn" href="#/juegos">${IC("caret-left", "bold", 18)}Juegos</a></div></div>`;
    return;
  }
  const code = LANGS[L].code, MIL = !!TP.mil;
  /* para las pruebas: menos enemigos por oleada y más deprisa */
  const TST = window.__cuartel && typeof window.__cuartel === "object" ? window.__cuartel : {};
  const PER = Number(TST.per) > 0 ? Math.round(+TST.per) : 0, SPD = Number(TST.speed) > 0 ? +TST.speed : 1;
  const waves = WAVES.map(w => {
    if(!PER) return w;
    const tank = Math.min(w.tank, 1, PER - 1), drone = Math.min(w.drone, PER - 1 - tank);
    return Object.assign({}, w, {n: PER, tank, drone: Math.max(0, drone)});
  });
  const TOTAL = waves.reduce((s, w) => s + w.n, 0);
  /* las preguntas: por nivel, barajadas; las falladas vuelven 2 preguntas después */
  const byL = {1: [], 2: [], 3: []};
  mix(P).forEach(x => byL[lvOf(x)].push(x));
  const canHear = "speechSynthesis" in window;
  mix(P).slice(0, 4).forEach(t => { const im = new Image(); im.src = pic(t.img); });

  const run = api.mount(app, `<div class="gm cu" id="cu">
    ${api.topHtml(ID, `<span class="gm-pill gm-lives" id="gm-lives" role="img" aria-label="${LIVES} vidas">${`<i>${IC("heart", "fill", 18)}${IC("heart", "bold", 18)}</i>`.repeat(LIVES)}</span><span class="gm-pill" title="Enemigos neutralizados">${IC("target", "fill", 18, "gm-gold")}<b id="gm-sc">0</b></span>`)}
    <div class="cu-stage" id="cu-stage" role="group" aria-label="El campo: los enemigos llegan por 3 caminos. Tócalos o usa las teclas 1, 2 y 3 para disparar">
      <div class="cu-land" id="cu-land" aria-hidden="true"></div>
      <div class="cu-field" id="cu-field"></div>
      <span class="cu-lk" aria-hidden="true">1</span><span class="cu-lk" aria-hidden="true">2</span><span class="cu-lk" aria-hidden="true">3</span>
      <div class="cu-wall" aria-hidden="true"></div>
      <button type="button" class="cu-sold" id="cu-sold" aria-label="Tu soldado: dispara al enemigo más cerca (Espacio)">${SOLDIER}</button>
      <div class="cu-mag" id="cu-mag" role="img" aria-label="${MAG} balas"></div>
      <button type="button" class="cu-rb" id="cu-rb" aria-label="Recargar (tecla R)">${ICO_RELOAD}Recargar<span class="cu-kk" aria-hidden="true">R</span></button>
      <span class="cu-wv" id="cu-wv">${IC("shield-check", "bold", 16)}<span>Oleada <b id="cu-wn">1</b>/${waves.length}</span></span>
      <div class="cu-radio" id="cu-radio" role="status" aria-live="polite"></div>
      <div class="cu-ban" id="cu-ban" aria-hidden="true"></div>
      <div class="cu-rl" id="cu-rl" role="dialog" aria-modal="false" aria-labelledby="cu-rl-t" hidden><div class="cu-rl-c" id="cu-rl-c"></div></div>
    </div></div>`, mode);
  const root = run.root, stage = root.querySelector("#cu-stage"), land = root.querySelector("#cu-land"), field = root.querySelector("#cu-field");
  const sold = root.querySelector("#cu-sold"), magEl = root.querySelector("#cu-mag"), rb = root.querySelector("#cu-rb"), radioEl = root.querySelector("#cu-radio");
  const ban = root.querySelector("#cu-ban"), rl = root.querySelector("#cu-rl"), rlc = root.querySelector("#cu-rl-c"), lks = [...root.querySelectorAll(".cu-lk")];
  /* medidas: ancho y alto, horizonte (HY), línea de los sacos (WY), los caminos (VX, G) y el tamaño de los enemigos (E) */
  let W = 0, H = 0, HY = 0, WY = 0, BASE = 110, VX = 0, G = 0, E = 96, SW = 120;
  /* la partida */
  let t = 0, last = 0, running = false, ended = false, phase = "wait", phaseAt = 0, wi = -1, queue = [], nextSpawn = 0, lastLane = -1;
  let mag = MAG, lives = LIVES, score = 0, right = 0, streak = 0, qn = 0, reloading = false, Q = null, qTok = 0, radioT = 0, radioAt = -9, aimBack = 0, bonusMsg = false;
  const foes = [], retry = [], asked = new Map(), radioQ = [];
  const live = () => api.live(run);
  const spread = e => .2 + .8 * e;
  const laneX = (i, e) => VX + (i - 1) * G * spread(e);
  const yAt = e => HY + 6 + (WY - HY - 6) * e;

  function fit(){
    const top = stage.getBoundingClientRect().top + scrollY;
    const main = stage.closest("main"), pb = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 12;
    stage.style.height = Math.round(Math.max(400, Math.min(860, innerHeight - top - pb - 4))) + "px";
    W = stage.clientWidth; H = stage.clientHeight;
    BASE = Math.round(Math.max(100, Math.min(150, H * .19)));
    HY = Math.round(Math.max(56, H * .17));
    WY = H - BASE + 8;
    VX = W / 2;
    G = Math.min(W * .31, 240);
    E = Math.round(Math.max(96, Math.min(150, W * .27, H * .2)));
    SW = Math.round(Math.max(110, Math.min(170, W * .4, (BASE + 40) * MUZZLE.w / MUZZLE.h)));
    stage.style.setProperty("--hz", (HY / H * 100).toFixed(2) + "%");
    stage.style.setProperty("--base", BASE + "px");
    sold.style.width = SW + "px";
    magEl.style.setProperty("--cols", W < 480 ? 4 : Math.max(MAG, mag));
    lks.forEach((k, i) => { k.style.left = laneX(i, 0) + "px"; k.style.top = (HY - 4) + "px"; });
    drawLand();
    foes.forEach(place);
  }
  /* el paisaje: colinas en el horizonte, los 3 caminos de tierra hacia los sacos y unos arbustos */
  function drawLand(){
    const ys = WY + 30, lanes = [0, 1, 2].map(i => {
      const x0 = laneX(i, 0), x1 = laneX(i, 1), h0 = G * .42 * spread(0), k = (ys - HY) / (WY - HY), x2 = laneX(i, k), h2 = G * .42 * spread(k);
      return `<path class="cu-ln" d="M${(x0 - h0).toFixed(1)} ${HY} L${(x0 + h0).toFixed(1)} ${HY} L${(x2 + h2).toFixed(1)} ${ys.toFixed(1)} L${(x2 - h2).toFixed(1)} ${ys.toFixed(1)}Z"/>
        <path class="cu-dash" d="M${x0.toFixed(1)} ${HY + 4} L${x1.toFixed(1)} ${WY.toFixed(1)}"/>`;
    }).join("");
    const hills = `<path class="cu-hill" d="M0 ${HY + 1} L0 ${HY - 16} Q${W * .12} ${HY - 34} ${W * .26} ${HY - 14} Q${W * .4} ${HY - 40} ${W * .56} ${HY - 12} Q${W * .72} ${HY - 30} ${W * .86} ${HY - 10} Q${W * .94} ${HY - 22} ${W} ${HY - 12} L${W} ${HY + 1}Z"/>
      <path class="cu-hill2" d="M0 ${HY + 1} L0 ${HY - 6} Q${W * .2} ${HY - 18} ${W * .38} ${HY - 4} Q${W * .62} ${HY - 16} ${W * .8} ${HY - 3} Q${W * .9} ${HY - 9} ${W} ${HY - 4} L${W} ${HY + 1}Z"/>`;
    const bush = (x, y, r) => `<path class="cu-bush" d="M${x - r} ${y} a${r * .6} ${r * .6} 0 0 1 ${r * .5} ${-r * .7} a${r * .7} ${r * .7} 0 0 1 ${r} ${-r * .2} a${r * .6} ${r * .6} 0 0 1 ${r * .5} ${r * .9}Z"/>`;
    const e1 = .45, e2 = .78;
    const bushes = bush(laneX(0, e1) - G * .62 * spread(e1), yAt(e1), 10 + 16 * e1) + bush(laneX(2, e2) + G * .6 * spread(e2), yAt(e2), 10 + 16 * e2)
      + bush(laneX(2, .15) + G * .55 * spread(.15), yAt(.15), 8);
    /* piedras y matas de hierba entre los caminos y a los lados (siempre en los mismos sitios) */
    const rock = (x, y, r) => `<path class="cu-rock" d="M${x - r} ${y} Q${x - r * .8} ${y - r * .9} ${x - r * .1} ${y - r} Q${x + r * .9} ${y - r * .8} ${x + r} ${y}Z"/>`;
    const tuft = (x, y, r) => `<path class="cu-tuft" d="M${x - r} ${y - r * 1.1} L${x - r * .3} ${y} L${x} ${y - r * 1.4} L${x + r * .3} ${y} L${x + r} ${y - r * 1.1}"/>`;
    const side = (e, k) => VX + k * G * spread(e);
    const deco = [[.3, -1.62, "r"], [.62, 1.68, "r"], [.88, -1.6, "t"], [.2, 1.5, "t"], [.5, -.5, "t"], [.72, .52, "t"], [.95, 1.62, "t"], [.4, 2.1, "r"], [.1, -1.3, "t"]]
      .map(([e, k, c]) => { const x = side(e, k); if(x < 8 || x > W - 8) return ""; const r = (c === "r" ? 5 : 3.5) + 9 * e; return c === "r" ? rock(x, yAt(e), r) : tuft(x, yAt(e), r); }).join("");
    land.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${hills}${lanes}${deco}${bushes}</svg>`;
  }
  const onR = () => fit();
  addEventListener("resize", onR); run.clean.push(() => removeEventListener("resize", onR));

  /* ---------- el cargador ---------- */
  function paintMag(fresh){
    const slots = Math.max(MAG, mag), was = magEl.children.length;
    let h = "";
    for(let i = 0; i < slots; i++) h += `<i class="${i < mag ? "" : "off"}${i >= MAG ? " bonus" : ""}${fresh && i < mag ? " new" : ""}"${fresh && i < mag ? ` style="animation-delay:${i * 45}ms"` : ""}>${BULLET}</i>`;
    magEl.style.setProperty("--cols", W < 480 ? 4 : slots);
    if(fresh || was !== slots) magEl.innerHTML = h;
    else [...magEl.children].forEach((el, i) => el.classList.toggle("off", i >= mag));
    magEl.setAttribute("aria-label", mag === 1 ? "1 bala" : `${mag} balas`);
    magEl.classList.toggle("low", mag <= 1);
    rb.setAttribute("aria-disabled", String(mag >= MAG));
    rb.classList.toggle("go", mag === 0);
  }

  /* ---------- la radio (cada mensaje se ve al menos 1,6 s: los que llegan antes esperan su turno) ---------- */
  function radio(id, extra, speak, now){
    if(!now && radioT && t - radioAt < 1.6){ radioQ.push([id, extra, speak]); if(radioQ.length > 2) radioQ.shift(); return; }
    const tt = T[id];
    if(!tt && !extra) return;
    radioAt = t;
    radioEl.innerHTML = `${IC("chat-circle-text", "bold", 22)}<span>${tt ? `<b lang="${esc(code)}">${esc(tt.w)}</b>${ipa(tt.ipa, code)}<small>${esc(tt.es)}${extra ? " · " + esc(extra) : ""}</small>` : `<b>${esc(extra)}</b>`}</span>`;
    radioEl.classList.add("on");
    radioT = t + 3.2;
    if(speak && tt) api.speak(tt.w);
  }

  /* ---------- los enemigos ---------- */
  function place(f){
    const K = KIND[f.kind], e = Math.min(1, f.p), s = .42 + .58 * e, v = E * s * K.k, bw = Math.max(60, v), bh = Math.max(60, v * K.ar);
    const lift = f.kind === "drone" ? v * .5 : 0, x = laneX(f.lane, e), y = yAt(e);
    f.bx = x - bw / 2; f.by = y - lift - bh; f.bw = bw; f.bh = bh;
    f.el.style.width = bw.toFixed(1) + "px"; f.el.style.height = bh.toFixed(1) + "px";
    f.el.style.transform = `translate(${f.bx.toFixed(1)}px,${f.by.toFixed(1)}px)`;
    f.el.style.zIndex = 10 + Math.round(e * 30);
    f.fv.style.width = v.toFixed(1) + "px";
    if(f.sh) f.sh.style.bottom = (-lift - 4).toFixed(1) + "px";
  }
  function spawn(kind){
    /* un camino al azar: no el mismo dos veces seguidas ni uno con un enemigo recién salido */
    let ok = [0, 1, 2].filter(i => i !== lastLane && !foes.some(f => !f.dead && f.lane === i && f.p < .22));
    if(!ok.length) ok = [0, 1, 2].filter(i => !foes.some(f => !f.dead && f.lane === i && f.p < .12));
    if(!ok.length) return false;
    const lane = pick(ok), K = KIND[kind], w = waves[wi];
    const el = document.createElement("span");
    el.className = "cu-foe " + kind;
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", `${K.name} en el camino ${lane + 1}`);
    el.innerHTML = `<span class="cu-sh"></span><span class="cu-fv">${FOE_SVG[kind]}${K.hp > 1 ? `<span class="cu-hp">${"<i></i>".repeat(K.hp)}</span>` : ""}</span>`;
    const f = {el, fv: el.querySelector(".cu-fv"), sh: el.querySelector(".cu-sh"), kind, lane, p: 0, hp: K.hp, dur: w.T / K.sp, dead: false};
    el.cuLane = lane; el.cuKind = kind;   /* para las pruebas */
    field.appendChild(el);
    foes.push(f); lastLane = lane;
    place(f);
    return true;
  }
  const alive = () => foes.filter(f => !f.dead);
  const nearest = list => list.reduce((a, f) => !a || f.p > a.p ? f : a, null);
  function drop(f, ms){
    f.dead = true;
    f.el.classList.add("gone");
    api.later(run, () => { f.el.remove(); const i = foes.indexOf(f); if(i >= 0) foes.splice(i, 1); }, ms);
  }
  function puff(x, y, z, dust){
    const p = document.createElement("span");
    p.className = "cu-puff" + (dust ? " dust" : "");
    p.style.left = x + "px"; p.style.top = y + "px"; p.style.setProperty("--z", Math.round(z) + "px");
    const st = dust ? "" : [0, 1, 2, 3, 4].map(i => { const a = -Math.PI / 2 + (i - 2) * .62, r = z * .62; return `<i style="--dx:${(Math.cos(a) * r).toFixed(0)}px;--dy:${(Math.sin(a) * r).toFixed(0)}px">${STAR}</i>`; }).join("");
    p.innerHTML = CLOUD + st;
    field.appendChild(p);
    api.later(run, () => p.remove(), 760);
  }
  function label(x, y, txt, gray){
    const n = document.createElement("span");
    n.className = "cu-neu" + (gray ? " gray" : "");
    n.textContent = txt;
    n.style.top = Math.max(34, y) + "px";
    field.appendChild(n);
    const hw = n.offsetWidth / 2 + 6;   /* el letrero entero dentro del campo (offsetWidth no cuenta el translate) */
    n.style.left = Math.max(hw, Math.min(W - hw, x)) + "px";
    api.later(run, () => n.remove(), 1000);
  }

  /* ---------- disparar ---------- */
  function muzzle(a){
    const k = SW / MUZZLE.w, vx = (MUZZLE.x - MUZZLE.w / 2) * k, vy = (MUZZLE.y - MUZZLE.h) * k;
    return {x: VX + vx * Math.cos(a) - vy * Math.sin(a), y: H + vx * Math.sin(a) + vy * Math.cos(a)};
  }
  function shoot(f){
    if(!running || ended || reloading || run.paused || !f || f.dead) return;
    if(mag <= 0){ openReload(); return; }
    mag--; paintMag(false);
    const tx = f.bx + f.bw / 2, ty = f.by + f.bh * .55;
    const a = Math.max(-.6, Math.min(.6, Math.atan2(tx - VX, H - ty)));
    sold.classList.add("aim"); sold.style.setProperty("--aim", a.toFixed(3) + "rad");
    const m = muzzle(a), d = Math.hypot(tx - m.x, ty - m.y), ang = Math.atan2(ty - m.y, tx - m.x);
    const tr = document.createElement("i");
    tr.className = "cu-tr";
    tr.style.left = m.x + "px"; tr.style.top = m.y + "px"; tr.style.width = d + "px"; tr.style.transform = `rotate(${ang}rad)`;
    const fl = document.createElement("i");
    fl.className = "cu-fl"; fl.innerHTML = STAR; fl.style.left = m.x + "px"; fl.style.top = m.y + "px";
    stage.appendChild(tr); stage.appendChild(fl);
    api.later(run, () => { tr.remove(); fl.remove(); }, 300);
    aimBack = t + .9;
    api.snd("tap");
    f.hp--;
    if(f.hp <= 0){
      score++;
      const sc = root.querySelector("#gm-sc"); if(sc){ sc.textContent = score; api.bump(sc.parentNode); }
      api.haptic("success");
      api.later(run, () => api.snd("coin"), 90);
      drop(f, 300);
      puff(tx, f.by + f.bh - (f.fv.offsetHeight || f.bh) * .5, Math.max(70, f.fv.offsetWidth * 1.15), false);
      label(tx, f.by - 4, "¡Neutralizado!");
    } else {
      api.snd("pop");
      f.el.classList.remove("hurt"); void f.el.offsetWidth; f.el.classList.add("hurt");
      const pips = f.el.querySelectorAll(".cu-hp i"); if(pips[f.hp]) pips[f.hp].classList.add("off");
      label(tx, f.by - 4, "¡Uno más!", true);
    }
    if(mag <= 0) api.later(run, () => { if(!ended && !reloading && mag <= 0 && running) openReload(); }, 420);
  }
  function shootLane(i){
    const f = nearest(alive().filter(x => x.lane === i));
    if(f) shoot(f);
  }
  /* un toque en el campo: el enemigo tocado (el más cercano si hay dos), el soldado (el enemigo más cerca de los sacos)
     o el camino (el enemigo más cerca de ese camino) */
  function tapAt(x, y){
    const hit = alive().filter(f => x >= f.bx - 4 && x <= f.bx + f.bw + 4 && y >= f.by - 4 && y <= f.by + f.bh + 4).sort((a, b) => b.p - a.p)[0];
    if(hit) return shoot(hit);
    const sb = sold.getBoundingClientRect(), b = stage.getBoundingClientRect();
    if(x >= sb.left - b.left && x <= sb.right - b.left && y >= sb.top - b.top) return shoot(nearest(alive()));
    if(y < WY && y > HY - 20){
      const e = Math.max(0, Math.min(1, (y - HY) / (WY - HY)));
      let best = 0;
      [0, 1, 2].forEach(i => { if(Math.abs(x - laneX(i, e)) < Math.abs(x - laneX(best, e))) best = i; });
      shootLane(best);
    }
  }

  /* ---------- los enemigos llegan a los sacos ---------- */
  function reach(f){
    drop(f, 260);
    const x = laneX(f.lane, 1);
    puff(x, WY - 16, 96, true);
    lives--;
    const Lh = root.querySelector("#gm-lives");
    if(Lh){ const hs = Lh.querySelectorAll("i"), h = hs[Math.max(0, lives)]; if(h) h.classList.add("lost", "hurt"); Lh.setAttribute("aria-label", lives === 1 ? "1 vida" : `${Math.max(0, lives)} vidas`); }
    if(!RM()){ stage.classList.remove("shake"); void stage.offsetWidth; stage.classList.add("shake"); }
    api.snd("whoosh");
    label(x, WY - 60, "¡Llegó a los sacos!", true);
    if(lives <= 0){ end(false); return; }
    radio("mayday", "¡un enemigo llegó a los sacos!", true);
  }

  /* ---------- las oleadas ---------- */
  function banner(txt, sub){
    ban.innerHTML = `${esc(txt)}${sub ? `<small>${esc(sub)}</small>` : ""}`;
    ban.classList.add("on");
  }
  function nextWave(){
    wi++;
    const w = waves[wi];
    root.querySelector("#cu-wn").textContent = wi + 1;
    const kinds = mix([...Array(w.tank).fill("tank"), ...Array(w.drone).fill("drone"), ...Array(Math.max(0, w.n - w.tank - w.drone)).fill("robot")]);
    if(wi === 0){ const r = kinds.indexOf("robot"); if(r > 0) [kinds[0], kinds[r]] = [kinds[r], kinds[0]]; }
    queue = kinds;
    banner(`¡Oleada ${wi + 1} de ${waves.length}!`, wi === 0 ? "¡Defiende el cuartel!" : wi === waves.length - 1 ? "¡La última!" : "Más enemigos y más rápidos");
    api.snd("whoosh");
    phase = "banner"; phaseAt = t + 2;
  }
  function waveDone(){
    if(wi >= waves.length - 1){ end(true); return; }
    phase = "clear"; phaseAt = t + 1.4;
    radio("roger", `oleada ${wi + 1} superada`, true);
  }
  function end(win){
    if(ended) return;
    ended = true; running = false;
    if(reloading) closeReload(true);
    alive().forEach(f => f.el.classList.add("gone"));
    ban.classList.remove("on");
    stage.insertAdjacentHTML("beforeend", `<div class="gm-over">${win ? IC("medal", "fill", 72) : IC("star", "fill", 72)}${win ? "¡Cuartel a salvo!" : "¡Se acabó la defensa!"}</div>`);
    radioQ.length = 0;
    radio(win ? "ceasefire" : "out", win ? "¡cuartel a salvo!" : "fin de la misión", true, true);
    api.later(run, () => {
      const n = qn, acc = n ? right / n : 1;
      const stars = (score >= TOTAL * .9 || win) && acc >= .75 ? 3 : score >= TOTAL * .5 && acc >= .5 ? 2 : 1;
      const words = [...asked.values()].sort((a, b) => b.miss - a.miss);
      const en = `${score} enemigo${score === 1 ? "" : "s"} neutralizado${score === 1 ? "" : "s"}`;
      api.finish(run, ID, {score, stars, words,
        line: n ? `¡${en} y ${right} de ${n} recarga${n === 1 ? "" : "s"} bien!` : `¡${en}!`});
    }, 1900);
  }

  /* ---------- el panel de recarga ---------- */
  function nextWord(lv){
    const r = retry.findIndex(x => qn >= x.at);
    if(r >= 0) return retry.splice(r, 1)[0].it;
    for(const d of [0, -1, 1, -2, 2]){ const q = byL[lv + d]; if(q && q.length) return q.shift(); }
    return pick(P);
  }
  const core = s => String(s || "").toLowerCase().replace(/\s*\([^)]*\)/g, "").replace(/[!?¡¿.,]/g, "")
    .replace(/^(?:the|an?|le|la|les|une?|l['’]|en|et)\s*/, "").trim();
  function distract(it, n){
    const lw = it.word.toLowerCase(), le = it.es.toLowerCase(), cw = core(it.word);
    /* nada que contenga la otra (Reçu / Bien reçu, sergeant / staff sergeant): las dos serían «bien» */
    const near = (a, b) => { const ta = a.split(/[\s-]+/).filter(Boolean), tb = b.split(/[\s-]+/).filter(Boolean);
      return ta.length > 0 && tb.length > 0 && (ta.every(t => tb.includes(t)) || tb.every(t => ta.includes(t))); };
    const ok = x => x !== it && x.word.toLowerCase() !== lw && x.es.toLowerCase() !== le && x.img !== it.img && !near(core(x.word), cw);
    const out = [];
    for(const x of [...mix(P.filter(x => ok(x) && lvOf(x) === lvOf(it))), ...mix(P.filter(x => ok(x) && lvOf(x) !== lvOf(it)))]){
      if(out.length >= n) break;
      if(out.some(o => o.img === x.img || o.word.toLowerCase() === x.word.toLowerCase() || o.es.toLowerCase() === x.es.toLowerCase() || near(core(o.word), core(x.word)))) continue;
      out.push(x);
    }
    return out;
  }
  function openReload(){
    if(reloading || ended || !running || run.paused) return;
    reloading = true;
    const lv = Math.max(LO[Math.max(0, wi)], Math.min(HI[Math.max(0, wi)], 1 + Math.floor(qn / 3)));
    const it = nextWord(lv);
    qn++;
    const type = canHear && qn % 2 === 0 ? "hear" : "say";
    const opts = mix([it, ...distract(it, 2)]), empty = mag === 0;
    Q = {it, type, opts, done: false};
    const ilv = lvOf(it);
    const head = `<div class="cu-rl-h">${ICO_RELOAD}<span><b id="cu-rl-t">${empty ? "¡Sin balas!" : "¡A recargar!"}</b><small>Contesta bien y el cargador se llena.</small></span>
      ${MIL ? `<span class="cu-rl-lv">Nivel ${ilv} · ${LVN[ilv]}</span>` : ""}</div>`;
    const mk = `<span class="cu-m" aria-hidden="true">${IC("check", "bold", 18, "v")}${IC("x", "bold", 18, "x")}</span>`;
    const ask = type === "say"
      ? `<div class="cu-ask"><span class="cu-ask-p">${imgHtml(it)}</span><span class="cu-ask-t"><span>¿Cómo se dice en ${esc(api.nm())}?</span><b>${esc(it.es)}</b></span></div>
        <div class="cu-ops" id="cu-ops" role="group" aria-label="Elige la palabra">${opts.map((o, i) => `<button type="button" class="cu-op" data-i="${i}" lang="${esc(code)}"><span class="cu-n" aria-hidden="true">${i + 1}</span><span>${esc(o.word)}</span>${mk}</button>`).join("")}</div>`
      : `<div class="cu-ask"><button type="button" class="cu-say" id="cu-say" aria-label="Escuchar otra vez">${IC("speaker-high", "fill", 30)}</button><span class="cu-ask-t"><span>Escucha la palabra</span><b>Toca su dibujo</b></span></div>
        <div class="cu-ops pics" id="cu-ops" role="group" aria-label="Elige el dibujo">${opts.map((o, i) => `<button type="button" class="cu-op" data-i="${i}" aria-label="${esc(o.es)}"><span class="cu-im">${imgHtml(o)}</span><span>${esc(o.es)}</span><span class="cu-n" aria-hidden="true">${i + 1}</span>${mk}</button>`).join("")}</div>`;
    rlc.innerHTML = `${head}${ask}<p class="cu-fb" id="cu-fb" role="status" aria-live="polite"></p>
      <button type="button" class="glass-btn glass-btn--pri glass-btn--lg glass-btn--block cu-go" id="cu-go" hidden>${IC("target", "fill", 22)}¡A disparar!</button>`;
    const btns = [...rlc.querySelectorAll(".cu-op")];
    btns.forEach((b, i) => { b.cuOk = opts[i] === it; b.onclick = () => choose(i); });   /* cuOk: para las pruebas */
    const say = rlc.querySelector("#cu-say"); if(say) say.onclick = () => api.speak(it.word);
    rlc.querySelector("#cu-go").onclick = () => closeReload();
    rl.hidden = false;
    rlc.scrollTop = 0;
    api.snd("pop");
    if(type === "hear") api.later(run, () => { if(Q && Q.it === it && !Q.done) api.speak(it.word); }, 350);
    /* con el teclado: el foco en el altavoz (Espacio lo repite) o en la primera opción */
    if(api.kbd()) try{ (say || btns[0]).focus({preventScroll: true}); }catch(e){}
  }
  function choose(i){
    if(!Q || Q.done || run.paused || !live()) return;
    Q.done = true;
    const it = Q.it, ok = Q.opts[i] === it, btns = [...rlc.querySelectorAll(".cu-op")];
    btns.forEach((b, j) => { b.disabled = true; if(Q.opts[j] === it) b.classList.add("ok"); });
    if(!ok) btns[i].classList.add("no");
    const o = asked.get(it.k) || {word: it.word, es: it.es, img: it.img, ipa: it.ipa, miss: false};
    if(!ok) o.miss = true;
    asked.set(it.k, o);
    api.answer(ok, {es: it.es, word: it.word});
    const fb = rlc.querySelector("#cu-fb"), wl = `<b lang="${esc(code)}">${esc(it.word)}</b>${ipa(it.ipa, code)}`;
    let bonus = false, add = 0;
    if(ok){
      right++; streak++;
      bonus = streak % 3 === 0;
      mag = Math.min(MAG + BONUS, Math.max(mag, MAG) + (bonus ? BONUS : 0));
      api.snd("ok"); api.haptic("success");
      fb.innerHTML = `${wl}<small>¡Bien! ${bonus ? "Cargador lleno y 2 balas extra por 3 seguidas." : "Cargador lleno."}</small>`;
    } else {
      streak = 0;
      add = Math.max(0, Math.min(2, MAG - mag)); mag += add;
      retry.push({it, at: qn + 2});
      fb.innerHTML = `Era esta: ${wl}<small>${esc(it.es)} · ${add === 1 ? "Solo entra 1 bala." : `Solo entran ${add} balas.`}</small>`;
    }
    bonusMsg = ok ? (bonus ? "bonus" : "ok") : add === 1 ? "no1" : "no";
    paintMag(true);
    api.speak(it.word);
    const go = rlc.querySelector("#cu-go"); go.hidden = false;
    if(api.kbd()) try{ go.focus({preventScroll: true}); }catch(e){}
    const tok = ++qTok;
    api.later(run, () => { if(tok === qTok && reloading) closeReload(); }, ok ? 2300 : 3300);
  }
  function closeReload(quiet){
    if(!reloading) return;
    reloading = false; qTok++; Q = null;
    rl.hidden = true; rlc.innerHTML = "";
    last = performance.now();
    if(quiet || ended) return;
    if(bonusMsg === "bonus") radio("supplies", "+2 balas extra", false);
    else if(bonusMsg === "ok") radio("copy", "cargador lleno", false);
    else if(bonusMsg === "no" || bonusMsg === "no1") radio("again", bonusMsg === "no1" ? "solo 1 bala" : "solo 2 balas", false);
    bonusMsg = false;
    if(api.kbd()) try{ stage.focus({preventScroll: true}); }catch(e){}
  }
  function reloadBtn(){
    if(!running || ended || reloading || run.paused) return;
    if(mag >= MAG){
      api.haptic("selection");
      label(W - 60, H - BASE - 20, "¡Ya está lleno!", true);
      return;
    }
    openReload();
  }

  /* ---------- el bucle ---------- */
  function frame(now){
    if(!live() || ended) return;
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    const frozen = run.paused || document.hidden;
    stage.classList.toggle("cu-frozen", frozen || reloading);
    stage.classList.toggle("cu-paused", frozen);
    if(running && !frozen && !reloading){
      t += dt;
      if(phase === "banner" && t >= phaseAt){
        ban.classList.remove("on");
        phase = "wave"; nextSpawn = t + .5;
        if(wi > 0) radio("march", `¡llega la oleada ${wi + 1}!`, false);
      } else if(phase === "clear" && t >= phaseAt) nextWave();
      if(phase === "wave"){
        const w = waves[wi], n = alive().length;
        if(queue.length && t >= nextSpawn && n < w.max){
          if(spawn(queue[0])) queue.shift();
          nextSpawn = t + w.gap * (.8 + Math.random() * .4) / SPD;
        }
        for(const f of foes){
          if(f.dead) continue;
          f.p += dt * SPD / f.dur;
          if(f.p >= 1){ reach(f); if(ended) return; } else place(f);
        }
        if(!queue.length && !alive().length) waveDone();
      }
      if(radioQ.length && t - radioAt >= 1.6) radio(...radioQ.shift(), true);
      else if(radioT && t > radioT){ radioEl.classList.remove("on"); radioT = 0; }
      if(aimBack && t > aimBack){ sold.classList.remove("aim"); sold.style.setProperty("--aim", "0rad"); aimBack = 0; }
    }
    if(!ended) run.raf = requestAnimationFrame(frame);
  }

  /* ---------- toques y teclas ---------- */
  stage.addEventListener("pointerdown", e => {
    if(e.button > 0 || e.target.closest(".cu-rl,.cu-rb,.gm-over")) return;
    if(!running || ended || reloading) return;
    e.preventDefault();
    const b = stage.getBoundingClientRect();
    tapAt(e.clientX - b.left, e.clientY - b.top);
  });
  sold.addEventListener("click", e => { if(e.detail === 0) shoot(nearest(alive())); });   /* Enter o Espacio con el soldado enfocado */
  rb.addEventListener("click", () => reloadBtn());
  stage.tabIndex = -1;
  paintMag(false);
  fit();
  requestAnimationFrame(fit); api.later(run, fit, 300);
  /* para las pruebas: el estado y poner balas en el cargador */
  root.cuState = () => ({mag, lives, score, wave: wi + 1, phase, reloading, t, right, asked: qn, total: TOTAL, type: Q ? Q.type : "", E, SW,
    foes: alive().map(f => ({lane: f.lane, kind: f.kind, hp: f.hp, p: f.p, x: f.bx + f.bw / 2, y: f.by + f.bh * .45, w: f.bw, h: f.bh}))});
  root.cuMag = n => { mag = Math.max(0, Math.min(MAG + BONUS, n | 0)); paintMag(false); };
  api.intro(run, ID, () => {
    fit();
    running = true; last = performance.now();
    radio("att", "¡defiende el cuartel!", true);
    nextWave();
    run.raf = requestAnimationFrame(frame);
    api.keys(run, e => {
      if(e.ctrlKey || e.metaKey || e.altKey) return;
      const inBtn = e.target && e.target.closest && e.target.closest("button,a");
      if(reloading){
        if(Q && !Q.done && /^[1-3]$/.test(e.key)){ e.preventDefault(); choose(+e.key - 1); }
        else if(Q && Q.done && (e.key === "Enter" || e.key === " ") && !inBtn){ e.preventDefault(); closeReload(); }
        else if(Q && !Q.done && Q.type === "hear" && e.key === " " && !inBtn){ e.preventDefault(); api.speak(Q.it.word); }
        return;
      }
      const lane = {"1": 0, "2": 1, "3": 2, ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2}[e.key];
      if(lane !== undefined){ e.preventDefault(); shootLane(lane); }
      else if(e.key === "r" || e.key === "R"){ e.preventDefault(); reloadBtn(); }
      else if(e.key === " " && !inBtn){ e.preventDefault(); shoot(nearest(alive())); }
    });
  });
}

const reg = window.vocabGames && typeof vocabGames.register === "function" && vocabGames.register(ID, {
  t: "Defensa del cuartel", sub: "Dispara y recarga contestando", img: "img/games/cuartel.png",
  how: "Toca los robots para disparar. Sin balas, contesta una pregunta para recargar. ¡Aguanta 5 oleadas!",
  keys: "Con el teclado: 1, 2 y 3 disparan a cada carril y R recarga.",
  topic: true,
  sec: "soldados",
  fresh: true,
  show: tp => tp === "militar",   /* solo con el tema «Soldados» de Juegos (con los demás, en oscuro y con este aviso) */
  off: "Se activa con el tema Soldados",
  rec: b => `${Number.isFinite(+b.score) ? +b.score : 0} neutralizados`,
  start,
});
if(!reg) console.warn("[cuartel] no se pudo añadir a Juegos");
})();
