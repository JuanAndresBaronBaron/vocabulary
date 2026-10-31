/* Módulo shop: la tienda común (window.vocabShop). Las cosas de la granja (t === "farm") se venden en la hoja de la
   Granja y el personaje, los sombreros, las gafas, los juguetes y las mascotas (los demás tipos) en Premios › Mi zorro:
   las dos pantallas pintan sus piezas con card() y las atan con bind(). La lógica de comprar y de ponerse es la de
   siempre (la que tenía granja() en index.html): mismos precios, mismas claves guardadas ("game": coins, owned, wear) y
   el mismo bus "buy" {item}. Las monedas solo se gastan aquí (y en la comida/rescate de la granja); nunca entran.
   · Pieza (card): sólida, radio 24. Dibujo (img/pj si hay personaje de cuerpo entero; si no, img/shop/<id>.png de
     OpenMoji; si no carga, el emoji), el nombre en español, la palabra en el idioma con su altavoz, su IPA (it.ipa de
     data/game.json, con ipaHtml) y abajo un botón:
     - no la tiene: cápsula tintada «Conseguir · 🪙 N» (fondo azul suave, como en App Store) si le llega; si no, cápsula gris «Te faltan N» (sigue
       siendo tocable: explica con un aviso amable lo que falta, con «Ganar monedas» que lleva a la siguiente lección o
       al repaso, sin sonido triste) y encima «Cuesta 🪙 N»; debajo, «Es mi deseo» (una sola cosa: game.wish);
     - granja: «✓ En tu granja», o «En el refugio» con «Ir al refugio» si el animal se fue al refugio;
     - zorro: «Ponérmelo» / «Quitármelo» (con el género: «Ponérmela», «Quitármelas»…); el personaje: «✓ Eres tú» (no se
       quita) o «Elegir». Lo que lleva puesto tiene un anillo azul y una ✓ en la esquina.
     Sin hoja de confirmación: un toque compra. Tras comprar o ponerse, la pieza no responde 0,6 s (un doble toque no
     compra y se lo quita a la vez).
   · Conserva lo que usa js/farm.js (patchShop, patchShopShelter): .shop .sc[data-id] con .se, .sn, [data-sb] (la
     cápsula de comprar), span.own, [data-shelter], [data-buy] y [data-wear].
   window.vocabShop:
     ready() → Promise<SHOP>                 carga data/game.json (getShop) y devuelve la lista entera
     items(filter?) → Item[]                 síncrono (route() ya cargó la tienda; fuera de una ruta, await ready()):
                                             sin filtro o "all": todo; "farm": la granja; "zorro": todo lo demás;
                                             un tipo ("hero", "hat", "face", "hand", "pet"); una lista de tipos; o una
                                             función (item) → boolean. Copia en el orden de data/game.json.
     byId(id) → Item | undefined · word(itemOrId) → la palabra en el idioma actual · img(itemOrId) → HTML del dibujo
     owned(id) → boolean · worn(type) → id | null ("hero" nunca es null: el zorro por defecto) · coins() → number
     state(itemOrId) → "buy" | "short:N" | "own" | "shel" | "you" | "pick" | "worn" | "wear"
     buy(id, fromEl?) → {ok, reason?, item?, need?}
        ok: resta it.p una vez, owned, si no es de la granja se lo pone, gameSet, bus "buy" {item}, aviso «¡Nuevo! …»
        con su dibujo, say(palabra) y checkAch a los 800 ms. reason: "unknown" | "owned" | "coins" (need = lo que falta;
        sale el aviso amable). fromEl (opcional): de dónde salen las chispas.
     wear(id) → {ok, reason?, item?, worn?}  alterna (el personaje "hero" no se quita: tocar el puesto lo deja puesto).
        reason: "unknown" | "farm" | "not-owned". Emite bus "wear" {item, worn}.
     gift(id) → {ok, reason?, item?}       la cosa pasa a ser suya sin pagar (los regalos de las cartas, js/mailbox.js):
        owned, gameSet y checkAch a los 800 ms; no toca las monedas ni se la pone, y no emite "buy" (quien regala avisa).
        reason: "unknown" | "owned".
     card(itemOrId, {mode?: "farm" | "zorro"}) → HTML de la pieza (mode por defecto: el del tipo de la cosa; solo cambia
        data-mode, para el estilo de cada pantalla).
     bind(host, {onChange?}) → off()         delegación de clics en host: [data-buy] compra, [data-wear] se lo pone o se
        lo quita, [data-shelter] va al refugio (cierra antes la hoja en la que esté). La pieza se repinta sola (también
        las demás de la página que cambien: precios, la que se quitó). onChange({type: "buy" | "wear" | "shelter", id,
        item, worn?}) solo cuando algo cambió: la pantalla pone al día lo suyo (la escena, el zorro de muestra…).
     refreshPrices(root?) / sync(root?)      pone al día todas las piezas pintadas (precio que llega o no, comprada,
        puesta, en el refugio). Escucha bus "coins" y la llama paintCoins() de index.html (también tras una medalla).
     paint(el) → boolean                     repinta una pieza si su estado cambió (conserva el foco).
     goShelter()                             abre el refugio de la granja (si hace falta, va a #/granja antes).
     images() → string[]                     los dibujos de img/shop que existen (los guarda «Descargar todo»).
     types                                   [{t, n, one}] de los tipos, en el orden de las pestañas de antes.
     wish() → id | null · setWish(id) → boolean (alterna; bus "wish" {item, on}) · wishHtml() → la barra del deseo
        («Dinosaurio · 245 de 300» con su dibujo y «Ganar monedas», o «Conseguir» cuando ya llega) · wishSlot() → un
        hueco [data-wish-slot] que se pone al día solo (syncWish(root?)) · goEarn(desde?) → la siguiente lección o el
        repaso (nextAction()). Al llegar a su precio, «¡Ya puedes conseguir tu deseo!» una vez (game.wishTold).
   Usa de index.html (globales): SHOP, getShop, itemById, itemWord, game, gameSet, pjHas, pjImg, checkAch, toast, say,
   bus, esc, ico, lang, LANGS, FEM, hashPath; window.M (motion.js), window.G (gestures.js) y farmMount.care (farm.js). */
(() => {
"use strict";
const W = window, D = document;
const COIN = `<svg class="coin-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="11" fill="#FFCC00"/><circle cx="12" cy="12" r="10.5" fill="none" stroke="#C7A000" stroke-opacity=".8"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#B39000" stroke-opacity=".55" stroke-width="1.4"/><path d="M12 7.8 13.06 10.54 15.99 10.7 13.71 12.56 14.47 15.4 12 13.8 9.53 15.4 10.29 12.56 8.01 10.7 10.94 10.54Z" fill="#A88700" fill-opacity=".8"/></svg>`;
/* ✓ que se dibuja (M.ok la anima con stroke-dashoffset) */
const CHK = (z = 18) => `<svg class="chk" viewBox="0 0 256 256" width="${z}" height="${z}" aria-hidden="true" focusable="false"><polyline points="40 144 96 200 224 72" fill="none" stroke="currentColor" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const BUSY_MS = 600;
/* dibujos de OpenMoji (CC BY-SA 4.0) renderizados a 220×220 para lo que no tiene personaje de cuerpo entero (img/pj) */
const IMG = new Set(["gorra", "sombrero", "casco", "birrete", "mago", "corona", "gafas", "gafassol", "buceo", "balon", "basket",
  "guitarra", "cometa", "monopatin", "telescopio", "consola", "varita", "copa", "flor", "girasol", "seta", "zanahoria", "fresa",
  "maiz", "calabaza", "trigo", "manzana", "arbol", "pino", "tienda", "cabana", "casa", "tractor", "fuente", "castillo", "cohete"]);
const TYPES = Object.freeze([
  {t: "hero", n: "Personajes", one: "personaje"}, {t: "hat", n: "Sombreros", one: "sombrero"}, {t: "face", n: "Gafas", one: "gafas"},
  {t: "hand", n: "Juguetes", one: "juguete"}, {t: "pet", n: "Mascotas", one: "mascota"}, {t: "farm", n: "Granja", one: "cosa de la granja"},
].map(Object.freeze));

/* ---------- datos ---------- */
const list = () => (Array.isArray(SHOP) ? SHOP : []);
const byId = id => (id && typeof id === "object") ? id : itemById(id);
const word = x => { const it = byId(x); return it ? itemWord(it) : ""; };
const coins = () => game().coins;
const owned = id => !!game().owned[id];
const heroOf = g => (itemById(g.wear.hero) ? g.wear.hero : "zorro");   /* el de heroHtml(): uno que no existe es el zorro */
function worn(type){
  const g = game();
  if(type === "hero") return heroOf(g);
  return g.wear[type] || null;
}
function items(filter){
  const L = list();
  if(filter == null || filter === "all") return L.slice();
  if(typeof filter === "function") return L.filter(it => { try{ return !!filter(it); }catch(e){ return false; } });
  if(filter === "zorro") return L.filter(it => it.t !== "farm");
  const ts = Array.isArray(filter) ? filter : [filter];
  return L.filter(it => ts.includes(it.t));
}
const ready = () => Promise.resolve(typeof getShop === "function" ? getShop() : list());
const lc = () => (LANGS[lang] && LANGS[lang].code) || "en-GB";
/* «lo / la / las» para «Ponérmelo», «Quitármela», «Ponérmelas» */
const pron = it => /^gafas/.test(it.n) ? "las" : (typeof FEM !== "undefined" && FEM.has(it.n)) ? "la" : "lo";
function inShelter(id){
  try{ const c = W.farmMount && farmMount.care; return !!(c && typeof c.inShelter === "function" && c.inShelter(id)); }catch(e){ return false; }
}
function state(x, g = game()){
  const it = byId(x); if(!it) return "";
  if(!g.owned[it.id]) return g.coins >= it.p ? "buy" : "short:" + (it.p - g.coins);
  if(it.t === "farm") return inShelter(it.id) ? "shel" : "own";
  if(it.t === "hero") return heroOf(g) === it.id ? "you" : "pick";
  return g.wear[it.t] === it.id ? "worn" : "wear";
}

/* ---------- dibujo ---------- */
function img(x){
  const it = byId(x); if(!it) return "";
  if(typeof pjHas === "function" && pjHas(it.id)) return pjImg(it);
  if(IMG.has(it.id)) return `<img class="pj shp-im" src="img/shop/${it.id}.png" alt="" draggable="false" decoding="async" data-e="${esc(it.e || "")}">`;
  return `<span class="pj-fb">${esc(it.e || "")}</span>`;
}
/* su IPA en el idioma actual (data/game.json: ipa) con ipaHtml() de index.html (se ve salvo que un mayor la apague) */
const ipaOf = it => { try{ const v = it && it.ipa && it.ipa[lang]; return v && typeof ipaHtml === "function" ? `<div class="shp-ipa">${ipaHtml(v, lc())}</div>` : ""; }catch(e){ return ""; } };
const imgSrc = it => (typeof pjHas === "function" && pjHas(it.id)) ? (typeof pjSrc === "function" ? pjSrc(it) : `img/pj/${it.id}.png`) : IMG.has(it.id) ? `img/shop/${it.id}.png` : "";
const images = () => list().filter(it => IMG.has(it.id) && !(typeof pjHas === "function" && pjHas(it.id))).map(it => `img/shop/${it.id}.png`);

/* ---------- «Mi deseo» ----------
   Una sola cosa deseada (game.wish = id; game.wishTold = el id del que ya se dijo «¡Ya puedes conseguir tu deseo!»):
   «Es mi deseo» en la pieza de lo que aún no le llega; la barra «Dinosaurio · 245 de 300» con su dibujo arriba de la
   tienda de la granja, de Mi zorro y de Premios (wishHtml); «Ganar monedas» lleva a la siguiente lección o al repaso. */
const wishId = (g = game()) => { const id = g.wish; return id && itemById(id) && !g.owned[id] ? id : null; };
function setWish(id){
  const g = game(), it = itemById(id); if(!it || g.owned[id]) return false;
  if(g.wish === id){ delete g.wish; delete g.wishTold; } else { g.wish = id; delete g.wishTold; }
  gameSet(g);
  try{ bus.emit("wish", {item: it, on: g.wish === id}); }catch(e){}
  return g.wish === id;
}
/* la barra del deseo: dibujo, «Dinosaurio · 245 de 300», la barra dorada y «Ganar monedas» (o «Conseguir» si ya llega).
   "" si no hay deseo */
function wishHtml(){
  const g = game(), id = wishId(g); if(!id) return "";
  const it = itemById(id), have = Math.max(0, Math.floor(+g.coins || 0)), p = it.p, ok = have >= p, w = itemWord(it), pc = Math.min(100, p ? 100 * have / p : 100);
  return `<section class="shp-wish${ok ? " ready" : ""}" data-wish-bar="${esc(id)}" aria-label="Tu deseo: ${esc(it.n)}, ${Math.min(have, p)} de ${p} monedas">
    <span class="shp-wi" aria-hidden="true">${img(it)}</span>
    <span class="shp-wt"><small>${ico("star", "fill", 14)}Mi deseo</small><b><span class="shp-wn">${esc(cap1(it.n))}</span> · <span class="t-num">${fmtN(Math.min(have, p))}</span> de <span class="t-num">${fmtN(p)}</span></b>
      <span class="shp-wbar" aria-hidden="true"><i style="width:${pc.toFixed(1)}%"></i></span>
      <span class="shp-ww" lang="${lc()}">${esc(w)}</span></span>
    ${ok ? `<button type="button" class="btn-fill shp-b shp-tint shp-wgo" data-buy="${esc(id)}" aria-label="Conseguir tu deseo: ${esc(it.n)}, ${p} monedas">Conseguir</button>`
      : `<button type="button" class="btn-fill shp-b shp-tint shp-wgo" data-earn aria-label="Ganar monedas: te ${p - have === 1 ? "falta 1" : `faltan ${p - have}`}">Ganar monedas</button>`}</section>`;
}
const cap1 = s => { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); };
const fmtN = n => Number(n || 0).toLocaleString("es");
/* «Ganar monedas»: la siguiente lección o el repaso (nextAction() de index.html); si no, el camino */
async function goEarn(from){
  let h = "#/mapa";
  try{
    const a = typeof nextAction === "function" ? await nextAction() : null;
    if(a && (a.kind === "leccion" || a.kind === "repaso")) h = a.href;
    else if(typeof dueList === "function" && dueList().length) h = "#/repaso";
  }catch(e){ console.error(e); }
  if(from && from.closest) await closeHostSheet(from);
  location.hash = h;
  return h;
}
/* ya le llega para su deseo: un aviso, una sola vez por deseo */
function wishCheck(){
  const g = game(), id = wishId(g); if(!id || g.wishTold === id) return;
  const it = itemById(id); if((+g.coins || 0) < it.p) return;
  g.wishTold = id; gameSet(g);
  notice("¡Ya puedes conseguir tu deseo!", toastIcon(it));
}

/* ---------- la pieza ---------- */
function actionHtml(it, st){
  const id = esc(it.id), n = esc(it.n), p = it.p, k = st.split(":")[0];
  if(k === "buy") return `<span class="sb" data-sb="${id}"><button type="button" class="btn-fill shp-b shp-tint buy" data-buy="${id}" aria-label="Conseguir: ${n}, ${p} ${p === 1 ? "moneda" : "monedas"}"><span>Conseguir</span><span class="shp-dot" aria-hidden="true">·</span>${COIN}<span class="t-num">${p}</span></button></span>`;
  if(k === "short"){
    const need = +st.split(":")[1] || 0, mine = wishId() === it.id;
    return `<span class="sb" data-sb="${id}"><small class="shp-cost" aria-hidden="true">Cuesta ${COIN}<span class="t-num">${p}</span></small><button type="button" class="btn-fill shp-b shp-short buy no" data-buy="${id}" aria-disabled="true" aria-label="${n}: cuesta ${p}, te ${need === 1 ? "falta 1 moneda" : `faltan ${need} monedas`}"><span>Te ${need === 1 ? "falta" : "faltan"}</span><span class="t-num">${need}</span>${COIN}</button>
      <button type="button" class="shp-wb${mine ? " on" : ""}" data-wish="${id}" aria-pressed="${mine}">${ico("star", mine ? "fill" : "bold", 16)}<span>${mine ? "Tu deseo" : "Es mi deseo"}</span></button></span>`;
  }
  if(k === "own") return `<span class="own">${CHK()}<span>En tu granja</span></span>`;
  if(k === "shel") return `<span class="own shl">En el refugio</span><button type="button" class="btn-fill shp-b shp-tint" data-shelter="${id}" aria-label="Ir al refugio a por ${n}">Ir al refugio</button>`;
  if(k === "you") return `<span class="own">${CHK()}<span>Eres tú</span></span>`;
  if(k === "pick") return `<button type="button" class="btn-fill shp-b shp-tint" data-wear="${id}" aria-label="Elegir: ${n}">Elegir</button>`;
  const pr = pron(it);
  if(k === "worn") return `<button type="button" class="btn-fill btn-fill--neu shp-b on" data-wear="${id}" aria-label="Quitarme: ${n}">Quitárme${pr}</button>`;
  return `<button type="button" class="btn-fill shp-b shp-tint" data-wear="${id}" aria-label="Ponerme: ${n}">Ponérme${pr}</button>`;
}
const stCls = st => { const k = st.split(":")[0]; return (k !== "buy" && k !== "short" ? " own" : "") + (k === "shel" ? " shel" : "") + (k === "worn" || k === "you" ? " worn" : ""); };
const groupLabel = (it, st) => {
  const k = st.split(":")[0];
  const extra = k === "worn" ? (pron(it) === "las" ? ", las llevas puestas" : pron(it) === "la" ? ", la llevas puesta" : ", lo llevas puesto")
    : k === "you" ? ", eres tú" : k === "own" ? ", en tu granja" : k === "shel" ? ", en el refugio" : "";
  return `${it.n}${extra}`;
};
function card(x, o = {}){
  const it = byId(x); if(!it) return "";
  const mode = o.mode === "farm" || o.mode === "zorro" ? o.mode : (it.t === "farm" ? "farm" : "zorro");
  const st = state(it), w = itemWord(it);
  return `<div class="sc shp-c${stCls(st)}" data-id="${esc(it.id)}" data-t="${esc(it.t)}" data-mode="${mode}" data-st="${esc(st)}" data-wish="${wishId() === it.id ? 1 : 0}" role="group" aria-label="${esc(groupLabel(it, st))}">
    <span class="shp-on" aria-hidden="true">${CHK(16)}</span>
    <div class="se" aria-hidden="true">${img(it)}</div>
    <div class="sn">${esc(it.n)}</div>
    <div class="sw"><span class="shp-w" lang="${lc()}">${esc(w)}</span><button type="button" class="say shp-spk" data-say="${esc(w)}" aria-label="Escuchar «${esc(w)}»">${ico("speaker-high", "fill", 22)}</button></div>${ipaOf(it)}
    <div class="sx">${actionHtml(it, st)}</div></div>`;
}
/* repinta una pieza si su estado cambió; si el foco estaba en su botón, pasa al botón nuevo (o a la pieza) */
function paint(el, g = game()){
  if(!el || !el.classList || !el.classList.contains("shp-c")) return false;
  const it = itemById(el.dataset.id); if(!it) return false;
  const st = state(it, g), wi = wishId(g) === it.id ? "1" : "0"; if(el.dataset.st === st && el.dataset.wish === wi) return false;
  const sx = el.querySelector(".sx"); if(!sx) return false;
  const had = sx.contains(D.activeElement), hadWish = had && D.activeElement.hasAttribute("data-wish");
  el.dataset.st = st; el.dataset.wish = wi;
  el.classList.remove("own", "shel", "worn");
  stCls(st).trim().split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
  el.setAttribute("aria-label", groupLabel(it, st));
  sx.innerHTML = actionHtml(it, st);
  if(had){
    const f = (hadWish && sx.querySelector("[data-wish]")) || sx.querySelector("button");
    if(f) f.focus({preventScroll: true});
    else { el.tabIndex = -1; el.focus({preventScroll: true}); }
  }
  return true;
}
function sync(root){
  const g = game(); let n = 0;
  (root && root.querySelectorAll ? root : D).querySelectorAll(".sc.shp-c[data-id]").forEach(el => { if(paint(el, g)) n++; });
  return n;
}
const refreshPrices = root => sync(root);
/* las barras del deseo pintadas (tienda de la granja, Mi zorro, Premios) se ponen al día */
function syncWish(root){
  (root && root.querySelectorAll ? root : D).querySelectorAll("[data-wish-slot]").forEach(h => {
    const html = wishHtml(); if(h._h === html) return;
    const had = h.contains(D.activeElement); h._h = html; h.innerHTML = html; h.hidden = !html;
    if(had){ const b = h.querySelector("button"); if(b) b.focus({preventScroll: true}); }
  });
}
/* el hueco de la barra del deseo (se pinta y se pone al día solo) */
const wishSlot = () => { const html = wishHtml(); return `<div class="shp-wslot" data-wish-slot${html ? "" : " hidden"}>${html}</div>`; };

/* ---------- comprar y ponerse ---------- */
function toastIcon(it){
  const src = imgSrc(it); if(!src) return it.e || "coin";
  const im = D.createElement("img"); im.src = src; im.alt = ""; im.style.cssText = "display:block;width:24px;height:24px;object-fit:contain"; return im;
}
const notice = (text, icon) => { try{ if(W.M && typeof M.toast === "function") M.toast(text, {icon}); else if(typeof toast === "function") toast(text); }catch(e){} };
function buy(id, fromEl){
  const it = itemById(id), g = game();
  if(!it) return {ok: false, reason: "unknown"};
  if(g.owned[it.id]) return {ok: false, reason: "owned", item: it};
  if(g.coins < it.p){
    const need = it.p - g.coins;
    try{ if(W.M && typeof M.toast === "function") M.toast(need === 1 ? "Te falta 1 moneda." : `Te faltan ${need} monedas.`, {icon: "coin", action: {t: "Ganar monedas", fn: () => goEarn(fromEl)}}); else notice(`Te faltan ${need} monedas.`, "coin"); }catch(e){}
    sync();
    return {ok: false, reason: "coins", need, item: it};
  }
  g.coins -= it.p; g.owned[it.id] = true; if(it.t !== "farm") g.wear[it.t] = it.id;
  if(g.wish === it.id){ delete g.wish; delete g.wishTold; }   /* ¡deseo cumplido! */
  gameSet(g); bus.emit("buy", {item: it});
  notice(`¡Nuevo! ${it.n} = ${itemWord(it)}`, toastIcon(it)); say(itemWord(it)); setTimeout(checkAch, 800);
  sync();
  try{
    const c = fromEl && fromEl.isConnected ? fromEl : D.querySelector(`.sc.shp-c[data-id="${CSS.escape(it.id)}"]`);
    if(c && W.M){ if(typeof M.burst === "function") M.burst(c, {n: 12}); }
  }catch(e){}
  return {ok: true, item: it};
}
function wear(id){
  const it = itemById(id), g = game();
  if(!it) return {ok: false, reason: "unknown"};
  if(it.t === "farm") return {ok: false, reason: "farm", item: it};
  if(!g.owned[it.id]) return {ok: false, reason: "not-owned", item: it};
  g.wear[it.t] = (g.wear[it.t] === it.id && it.t !== "hero") ? null : it.id; gameSet(g);
  const on = g.wear[it.t] === it.id;
  try{ bus.emit("wear", {item: it, worn: on}); }catch(e){}
  sync();
  return {ok: true, item: it, worn: on};
}
/* regalo: suya sin pagar (sin tocar las monedas) */
function gift(id){
  const it = itemById(id), g = game();
  if(!it) return {ok: false, reason: "unknown"};
  if(g.owned[it.id]) return {ok: false, reason: "owned", item: it};
  g.owned[it.id] = true; gameSet(g); setTimeout(checkAch, 800);
  sync();
  return {ok: true, item: it};
}

/* ---------- refugio ---------- */
let shelPend = false;
const onFarm = () => typeof hashPath === "function" ? hashPath().split("/")[0] === "granja" : /^#\/granja(\/|$)/.test(location.hash);
function goShelter(){
  const c = W.farmMount && farmMount.care;
  if(onFarm() && c && typeof c.openShelter === "function"){ c.openShelter(); return true; }
  shelPend = true;
  if(onFarm()){ if(typeof route === "function") route(); }
  else location.hash = "#/granja";
  return false;
}
bus.on("route", d => {
  if(!shelPend) return;
  shelPend = false;
  if(!String((d && d.h) || "").startsWith("granja")) return;
  setTimeout(() => { try{ const c = W.farmMount && farmMount.care; if(c && onFarm()) c.openShelter(); }catch(e){} }, 350);
});

/* ---------- delegación ---------- */
const BOUND = new WeakMap();
function closeHostSheet(el){
  const d = el.closest("dialog[open]"); if(!d) return Promise.resolve();
  try{ if(W.M && typeof M.closeSheet === "function" && d.classList.contains("m-sheet")) return Promise.resolve(M.closeSheet(d)).catch(() => {}); }catch(e){}
  d.close(); return Promise.resolve();
}
function bind(host, o = {}){
  if(!host || !host.addEventListener) return () => {};
  if(BOUND.has(host)) BOUND.get(host)();
  const tell = e => { if(typeof o.onChange === "function"){ try{ o.onChange(e); }catch(err){ console.error(err); } } };
  const onClick = e => {
    const b = e.target && e.target.closest ? e.target.closest("[data-buy],[data-wear],[data-shelter],[data-wish],[data-earn]") : null;
    if(!b || !host.contains(b)) return;
    if(b.hasAttribute("data-earn")){ e.preventDefault(); goEarn(b); tell({type: "earn"}); return; }
    if(b.hasAttribute("data-wish")){
      const id = b.dataset.wish, on = setWish(id);
      try{ if(W.G && typeof G.haptic === "function") G.haptic("selection"); }catch(err){}
      const it = itemById(id);
      if(on && it){ const need = Math.max(0, it.p - (+game().coins || 0)); notice(`¡Tu deseo: ${it.n}! Te ${need === 1 ? "falta 1 moneda" : `faltan ${need} monedas`}`, toastIcon(it)); }
      sync(); syncWish();
      tell({type: "wish", id, item: it, on});
      return;
    }
    const c = b.closest(".sc[data-id]");
    if(c && +c.dataset.busy > Date.now()){ e.preventDefault(); e.stopPropagation(); return; }
    const hold = () => { if(c) c.dataset.busy = String(Date.now() + BUSY_MS); };
    if(b.hasAttribute("data-shelter")){
      e.stopPropagation();   /* farm.js también escucha [data-shelter] en el documento: así se abre una sola vez */
      const id = b.dataset.shelter; hold();
      closeHostSheet(b).then(() => { goShelter(); tell({type: "shelter", id, item: itemById(id)}); });
      return;
    }
    if(b.hasAttribute("data-buy")){
      const r = buy(b.dataset.buy, c || b);
      if(!r.ok) return;
      hold();
      try{ if(W.G && typeof G.haptic === "function") G.haptic("success"); }catch(err){}
      if(c && W.M && typeof M.ok === "function") M.ok(c);
      tell({type: "buy", id: r.item.id, item: r.item});
      return;
    }
    const r = wear(b.dataset.wear);
    if(!r.ok) return;
    hold();
    try{ if(W.G && typeof G.haptic === "function") G.haptic("selection"); }catch(err){}
    if(c && r.worn && W.M && typeof M.ok === "function") M.ok(c);
    tell({type: "wear", id: r.item.id, item: r.item, worn: r.worn});
  };
  host.addEventListener("click", onClick);
  const off = () => { host.removeEventListener("click", onClick); if(BOUND.get(host) === off) BOUND.delete(host); };
  BOUND.set(host, off);
  return off;
}

/* las monedas cambian sin repintar la página (comida de la granja, regalos, medallas): los precios se ponen al día */
bus.on("coins", () => { sync(); syncWish(); wishCheck(); });
bus.on("buy", () => syncWish());

/* ---------- estilos ---------- */
const STYLE = `
.shop{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,156px),1fr));gap:12px}
.sc.shp-c{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;padding:12px;border:0;
  border-radius:var(--r-card,24px);background:var(--card);color:var(--label);text-align:center;box-shadow:none}
.sc.shp-c.worn{box-shadow:inset 0 0 0 2px var(--brand-tint)}
.sc.shp-c.shel{box-shadow:inset 0 0 0 2px var(--gold)}
.shp-c .shp-on{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;display:none;place-items:center;
  background:var(--brand-fill);color:#fff}
.shp-c.worn .shp-on{display:grid}
.shp-c .se{display:flex;align-items:flex-end;justify-content:center;width:100%;height:96px;padding:4px 0;font-size:64px;line-height:1}
.shp-c .se .pj{display:block;width:88px;height:88px;max-width:100%;object-fit:contain;object-position:50% 100%;vertical-align:0}
.shp-c .se .pj-fb{display:block;font-size:64px;line-height:88px}
:root[data-theme=dark] .shp-c .se{background:#F2F2F7;border-radius:var(--r-md,16px)}
.shp-c .sn{margin-top:4px;max-width:100%;font:600 var(--fs-sub)/1.2 var(--f-text);overflow-wrap:anywhere}
.shp-c .sn::first-letter{text-transform:uppercase}
.shp-c .sw{display:flex;align-items:center;justify-content:center;max-width:100%;min-height:44px;color:var(--label2);
  font:400 var(--fs-note)/1.2 var(--f-text);min-width:0}
.shp-c .shp-w{min-width:0;overflow-wrap:anywhere}
.say.shp-spk{flex:none;width:44px;height:44px;margin:0 -8px 0 0;border:0;border-radius:50%;background:none;color:var(--brand-tint);font-size:inherit}
@media (hover:hover){.say.shp-spk:hover{border:0;background:var(--brand-soft)}}
.say.shp-spk.playing{background:var(--brand-soft);color:var(--brand-tint)}
.shp-c .sx{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;width:100%;min-height:44px;margin-top:auto;padding-top:4px}
.shp-c .sb{display:flex;flex-direction:column;align-items:center;gap:4px;width:100%}
.shp-b{width:100%;gap:4px;padding:0 10px;font-size:var(--fs-note)}
.shp-b .coin-ico{display:block;width:18px;height:18px;flex:none}
.shp-b .shp-dot{opacity:.8}
.btn-fill.shp-tint{background:var(--brand-soft);color:var(--brand-ink)}
:root[data-theme=dark] .btn-fill.shp-tint{color:#7DBBFF}   /* sobre el tinte oscuro, --brand-ink no llega a 4,5:1 */
.btn-fill.shp-short,.btn-fill.shp-short[aria-disabled=true]{background:var(--fill);color:var(--label2);cursor:default}
.shp-short .coin-ico{filter:grayscale(1);opacity:.55}
.shp-c .shp-cost{display:inline-flex;align-items:center;gap:3px;color:var(--label2);font:400 var(--fs-min)/1.2 var(--f-text)}
.shp-c .shp-cost .coin-ico{width:14px;height:14px}
.shp-c .own{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:44px;color:var(--ok-ink);font:600 var(--fs-note)/1.2 var(--f-text)}
.shp-c .own.shl{min-height:0;color:var(--gold-ink)}
.shp-c .own .chk{flex:none}
.shp-c .shp-ipa{margin-top:-6px;max-width:100%;color:var(--label2);font:400 var(--fs-min)/1.25 var(--f-text);overflow-wrap:anywhere}
/* «Es mi deseo» (debajo de «Te faltan N») */
.shp-wb{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:44px;padding:0 10px;border:0;border-radius:999px;background:none;
  color:var(--brand-ink);font:600 var(--fs-min)/1.2 var(--f-text);cursor:pointer}
.shp-wb .ico{color:var(--gold-deep)}
.shp-wb.on{color:var(--gold-ink)}
.shp-wb:focus-visible,.shp-wgo:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
:root[data-theme=dark] .shp-wb{color:#7DBBFF}
:root[data-theme=dark] .shp-wb.on,:root[data-theme=dark] .shp-wb .ico{color:var(--gold)}
/* la barra del deseo: dibujo, «Dinosaurio · 245 de 300», barra dorada y «Ganar monedas» */
.shp-wslot[hidden]{display:none}
.shp-wish{display:grid;grid-template-columns:56px minmax(0,1fr);grid-template-areas:"i t" "b b";align-items:center;gap:8px 12px;margin:0 0 12px;padding:12px;border-radius:var(--r-card,24px);
  background:var(--card);box-shadow:inset 0 0 0 2px var(--gold-soft,#FFF1B8);color:var(--label)}
.shp-wish.ready{box-shadow:inset 0 0 0 2px var(--gold)}
.shp-wi{grid-area:i;display:grid;place-items:center;width:56px;height:56px;border-radius:16px;background:#F2F2F7;font-size:40px;line-height:1}
.shp-wi .pj{display:block;width:48px;height:48px;object-fit:contain}
.shp-wt{grid-area:t;display:flex;flex-direction:column;gap:3px;min-width:0}
.shp-wt small{display:inline-flex;align-items:center;gap:4px;color:var(--gold-ink);font:700 var(--fs-min)/1.2 var(--f-text)}
.shp-wt small .ico{color:var(--gold-deep)}
.shp-wt b{font:600 var(--fs-sub)/1.25 var(--f-text);overflow-wrap:anywhere}
.shp-ww{color:var(--label2);font:400 var(--fs-min)/1.2 var(--f-text)}
.shp-wbar{display:block;height:10px;border-radius:999px;background:var(--fill);overflow:hidden}
.shp-wbar i{display:block;height:100%;border-radius:inherit;background:var(--gold)}
.shp-wgo{grid-area:b;width:100%}
:root[data-theme=dark] .shp-wt small,:root[data-theme=dark] .shp-wt small .ico{color:var(--gold)}
@media (min-width:560px){.shp-wish{grid-template-columns:56px minmax(0,1fr) auto;grid-template-areas:"i t b"}.shp-wgo{width:auto;min-width:150px}}
@media (forced-colors:active){.sc.shp-c{border:1px solid CanvasText}.shp-c .shp-on{border:1px solid CanvasText}}`;
function css(){
  if(D.getElementById("css-shop")) return;
  const st = D.createElement("style"); st.id = "css-shop"; st.textContent = STYLE; D.head.appendChild(st);
}
css();

W.vocabShop = {ready, items, byId, word, img, owned, worn, coins, state, buy, wear, gift, card, bind, paint, sync, refreshPrices,
  goShelter, images, types: TYPES, wish: () => wishId(), setWish, wishHtml, wishSlot, syncWish, goEarn};
})();
