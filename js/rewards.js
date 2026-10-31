/* Módulo rewards: la pestaña Premios, con sus dos segmentos «Medallas · Mi zorro».
   - #/progreso → premios() (Medallas). Cabe en menos de dos pantallas del móvil:
     · «¡Medalla nueva!» arriba, solo la primera vez que se ve una medalla recién ganada: gira una vez (con chispas de oro)
       y se apunta como vista en este aparato (vocab:ui.medals, fuera de la partida). Las ganadas antes de hoy cuentan ya
       como vistas la primera vez (así una partida de antes no hace girar todas).
     · «Mi deseo» (vocabShop.wishSlot): la barra de lo que quiere conseguir, con «Ganar monedas».
     · La racha amable (streakInfo() de index.html, de "act", sin clave nueva): una llama grande con los días seguidos y
       los 7 días de esta semana (lunes a domingo): punto lleno el día que practicó; hoy, un aro vacío si aún no ha
       practicado (sin latir); los que faltan, en gris. Cada 7 días seguidos se guarda un día de descanso (2 como mucho)
       que se usa solo si falta un día: punto azul con un copo. Tras parar de verdad: «Empieza tu semana» (nunca un 0).
       Debajo, la «Copa de la semana» (bronce 3 días, plata 5, oro 7) comparada solo con él mismo: «4 días · la semana
       pasada 3», y a su lado la estantería de madera con las copas de las semanas ya terminadas (las 8 últimas).
     · «120 palabras · 30 ya no las olvidas» con una barra de dos tonos (verde: ya no las olvida; verde claro: aprendiendo).
     · Los 6 niveles (A1…C2) en una fila de anillos con su progreso del camino; tocar uno abre su camino.
     · «Tu próxima medalla»: la que más cerca está (mayor v/goal sin conseguir), con su barra.
     · Las medallas en 4 columnas, como una escalera: de cada familia, las ganadas (con el aro de su nivel: bronce,
       plata u oro, achList().lv) y la siguiente, en silueta gris; las de más arriba, tras «Ver todas». Tocar una (o mantenerla pulsada) abre una hoja con su detalle: cómo se gana, el
       progreso o el día que se ganó, «Medalla de bronce/plata/oro» y sus 20 monedas.
   - Palabra dominada (bus "mastered" {k, doc, es, lang} del repaso): +5 monedas y «¡Palabra dominada! <palabra> <IPA>».
     Se quitaron las casillas de monedas y medallas, el calendario de 14 días, los textos de ayuda y «Para mayores»
     (instalar y descargar están en Ajustes › Para mayores).
   - #/mizorro → miZorro() (Mi zorro): arriba el personaje grande con lo que lleva puesto (heroHtml); debajo un control
     segmentado por tipos (Personajes · Sombreros · Gafas · Juguetes · Mascotas, los de js/shop.js que no son de la
     granja) con sus piezas: vocabShop.card(x, {mode: "zorro"}) atadas con vocabShop.bind (comprar «Conseguir · N»,
     «Ponérmelo» / «Quitármelo», «Elegir» / «Eres tú»). Al cambiar algo, el personaje de arriba se repinta con un
     saltito (y si no se ve, sale un aviso con su miniatura). El tipo elegido se recuerda en la sesión
     (sessionStorage "vocab:mz-tab"). Misma economía y mismas claves que la tienda (js/shop.js).
   API: window.vocabRewards = {premios, miZorro, week(), words(), levels(), next(), fresh(), openMedal(id, from),
     closeMedal(), spin(el, delay), cups() → {cur, prev, lv, shelf: [{mon, n, lv}]}, snow(tamaño) (el copo, SVG)}.
   Usa de index.html (globales): $, esc, ico, store, bus, ROUTES, lang, LVS, getMap, getShop, mapP, lvLessons,
   srsAll, MASTER, streak, dayKey, achList, game, heroHtml, itemById, rovingKeys, toast; window.M, window.G,
   window.vocabUI (js/settings.js) y window.vocabShop (js/shop.js). */
(() => {
"use strict";
const W = window, D = document;
const rm = () => !!(W.M && typeof M.rm === "function" && M.rm());
const ui = () => { try{ return (W.vocabUI && vocabUI.get()) || {}; }catch(e){ return {}; } };
const plural = (n, one, many) => n === 1 ? one : many;
const fmt = n => Number(n || 0).toLocaleString("es");
const cap = s => { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); };
const COIN = `<svg class="coin-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="11" fill="#FFCC00"/><circle cx="12" cy="12" r="10.5" fill="none" stroke="#C7A000" stroke-opacity=".8"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#B39000" stroke-opacity=".55" stroke-width="1.4"/><path d="M12 7.8 13.06 10.54 15.99 10.7 13.71 12.56 14.47 15.4 12 13.8 9.53 15.4 10.29 12.56 8.01 10.7 10.94 10.54Z" fill="#A88700" fill-opacity=".8"/></svg>`;
const REWARD = 20;   /* monedas de cada medalla (checkAch de index.html) */
let NAV = 0, GEST = [];
const clearGest = () => { GEST.forEach(off => { try{ off(); }catch(e){} }); GEST = []; };
const onRoute = sec => (typeof hashPath === "function" ? hashPath() : location.hash.replace(/^#\/?/, "")).split("/")[0] === sec;

/* ---------- datos ---------- */
const WD = [["L", "lunes"], ["M", "martes"], ["X", "miércoles"], ["J", "jueves"], ["V", "viernes"], ["S", "sábado"], ["D", "domingo"]];
/* los 7 días de esta semana, de lunes a domingo */
/* rest: ese día se usó un «día de descanso» (streakInfo() de index.html) */
function week(){
  const a = store.get("act", {}) || {}, now = new Date(), dow = (now.getDay() + 6) % 7, used = new Set(sInfo().used);
  return WD.map(([l, name], i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + i), k = dayKey(d);
    return {k, l, name, done: !!a[k], rest: !a[k] && used.has(k), today: i === dow, future: i > dow};
  });
}
const sInfo = () => { try{ return typeof streakInfo === "function" ? streakInfo() : {n: streak(), rest: 0, used: [], broke: false}; }catch(e){ return {n: 0, rest: 0, used: [], broke: false}; } };
const mastOf = x => { try{ return typeof isMast === "function" ? isMast(x) : !!x && (x.b || 0) >= MASTER; }catch(e){ return false; } };
function words(){
  const m = Object.values(srsAll() || {});
  return {total: m.length, mast: m.filter(mastOf).length};
}
/* ---------- «Copa de la semana» (de "act", sin clave nueva): bronce 3 días, plata 5, oro 7 (de lunes a domingo).
   Solo se compara con él mismo: «4 días · la semana pasada 3». Las de las semanas ya terminadas, en la estantería ---------- */
const CUP = [0, 0, 0, 1, 1, 2, 2, 3];   /* días practicados → 0 nada · 1 bronce · 2 plata · 3 oro */
const CUPN = ["", "bronce", "plata", "oro"];
const monday = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
function weekDays(mon, a){ let n = 0; for(let i = 0; i < 7; i++){ const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i); if(a[dayKey(d)]) n++; } return n; }
function cups(){
  const a = store.get("act", {}) || {}, ks = Object.keys(a).filter(k => a[k] && /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  const m0 = monday(new Date()), cur = weekDays(m0, a), prev = weekDays(new Date(m0.getFullYear(), m0.getMonth(), m0.getDate() - 7), a);
  const shelf = [];
  if(ks.length){
    for(let m = monday(new Date(ks[0] + "T12:00:00")), i = 0; m < m0 && i < 1200; m = new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7), i++){
      const n = weekDays(m, a), lv = CUP[n] || 0;
      if(lv) shelf.push({mon: dayKey(m), n, lv});
    }
  }
  return {cur, prev, lv: CUP[cur] || 0, shelf: shelf.reverse()};
}
/* el copo de nieve del día de descanso (dibujo propio, plano) */
const snow = (z = 16) => `<svg class="rw-snow" width="${z}" height="${z}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M9.2 4.4 12 6.6l2.8-2.2M9.2 19.6 12 17.4l2.8 2.2M4.1 10.9l3.4-.6-1.3-3.3M19.9 13.1l-3.4.6 1.3 3.3M4.1 13.1l3.4.6-1.3 3.3M19.9 10.9l-3.4-.6 1.3-3.3"/></g></svg>`;
const cupIco = (lv, z = 28) => `<span class="rw-cup l${lv}" aria-hidden="true">${ico("trophy", "fill", z)}</span>`;
/* progreso de cada nivel en el camino del idioma (necesita getMap) */
function levels(){
  const P = mapP();
  return Object.entries(LVS).map(([k, v]) => {
    let ls = []; try{ ls = lvLessons(k) || []; }catch(e){}
    const done = ls.filter(l => P[l.id]).length, total = ls.length;
    return {k, n: v.n, c: v.c, done, total, p: total ? done / total : 0};
  });
}
/* la próxima medalla: la que tiene más progreso (v / goal) sin conseguir; a igualdad, la primera de la lista */
function next(list = achList()){
  let best = null;
  for(const a of list){ if(a.ok) continue; const p = a.goal ? a.v / a.goal : 0; if(!best || p > best.p) best = {a, p}; }
  return best ? best.a : null;
}
/* medallas ganadas que este aparato aún no ha enseñado girando (vocab:ui.medals = ids ya vistos) */
function seenList(){ const v = ui().medals; return Array.isArray(v) ? v.filter(x => typeof x === "string") : null; }
function saveSeen(list){ try{ if(W.vocabUI && typeof vocabUI.set === "function") vocabUI.set("medals", list); }catch(e){} }
function fresh(list = achList()){
  const g = game(), got = list.filter(a => a.ok && g.ach && g.ach[a.id]);
  let seen = seenList();
  if(!seen){
    /* la primera vez en este aparato: lo ganado antes de hoy ya está visto (solo gira lo de hoy) */
    const t = dayKey(new Date());
    seen = got.filter(a => String(g.ach[a.id]) < t).map(a => a.id);
    saveSeen(seen);
  }
  return got.filter(a => !seen.includes(a.id));
}
function markSeen(ids){
  const seen = seenList() || [];
  const add = ids.filter(id => !seen.includes(id));
  if(add.length) saveSeen(seen.concat(add));
}
const achDate = id => {
  const s = String((game().ach || {})[id] || ""), m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if(!m) return "";
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("es", {day: "numeric", month: "long"});
};

/* ---------- piezas ---------- */
const ring = (p, cls = "") => `<svg class="rw-rs ${cls}" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><circle class="rw-rb" cx="18" cy="18" r="15.5" pathLength="100"/>${p > 0 ? `<circle class="rw-rf" cx="18" cy="18" r="15.5" pathLength="100" stroke-dasharray="${(Math.min(1, p) * 100).toFixed(1)} 100"/>` : ""}</svg>`;   /* al 0 % no hay arco (ni el puntito del extremo redondo) */
/* la cara de la medalla: con su nivel (lv 1 bronce, 2 plata, 3 oro) en el aro cuando ya es suya */
const LVN = ["", "bronce", "plata", "oro"];
const medalFace = (a, big) => `<span class="rw-mc${a.ok ? " ok" : " lock"}${a.lv ? " lv" + a.lv : ""}${big ? " big" : ""}" aria-hidden="true"><span class="rw-me">${esc(a.e)}</span></span>`;
const barHtml = (a, cls = "") => `<div class="rw-pb ${cls}" aria-hidden="true"><i style="width:${(100 * Math.min(1, a.v / a.goal)).toFixed(1)}%"></i></div>`;
function medalBtn(a, more){
  const st = a.ok ? `conseguida${a.lv ? ", de " + LVN[a.lv] : ""}` : `${a.v} de ${a.goal}`;
  return `<button type="button" class="rw-m${a.ok ? " ok" : " lock"}${more ? " more" : ""}" data-ach="${esc(a.id)}" aria-label="${esc(a.t)}: ${st}"${more ? " hidden" : ""}>
    ${medalFace(a)}<span class="rw-mt">${esc(a.t)}</span></button>`;
}
/* las medallas como una escalera: de cada familia (l, g, s, r, w, m, p, c, f, a, t, k: el id sin el número) se ven las
   ganadas y la siguiente; las de más arriba esperan detrás de «Ver todas» (así no hay un muro de siluetas) */
function ladder(list){
  const next = new Set();
  return list.map(a => { if(a.ok) return false; const f = a.id.replace(/\d+$/, ""); if(next.has(f)) return true; next.add(f); return false; });
}
/* la racha amable: la llama con los días seguidos (sin racha: «Empieza tu semana», nunca un 0), los descansos
   guardados, los 7 días de la semana (un descanso usado = punto azul con un copo) y la copa de esta semana comparada
   solo con la semana pasada */
function weekHtml(st){
  const days = week(), si = sInfo(), C = cups(), n = [0, 0, 0, 0]; C.shelf.forEach(c => n[c.lv]++);
  const sum = [3, 2, 1].filter(l => n[l]).map(l => `${n[l]} de ${CUPN[l]}`).join(", ");
  const fmtW = k => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k); return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("es", {day: "numeric", month: "long"}) : k; };
  const restTxt = si.rest ? `<span class="rw-rest">${snow(14)}${si.rest === 1 ? "1 día de descanso guardado" : `${si.rest} días de descanso guardados`}</span>` : "";
  return `<section class="card rw-week" aria-labelledby="rw-st">
    <div class="rw-fl"><span class="rw-flame${st ? "" : " off"}" aria-hidden="true">${ico("fire", "fill", 56)}</span>
      <div class="rw-fl-t">${st ? `<b class="rw-n t-num" id="rw-st">${st}</b><span>${plural(st, "día seguido", "días seguidos")}</span>${restTxt}`
        : `<b class="rw-n rw-fresh" id="rw-st">Empieza tu semana</b><span>Aprende hoy y se enciende la llama</span>`}</div></div>
    <ol class="rw-days" aria-label="Esta semana">${days.map(d => {
      const lbl = `${d.name}${d.today ? ", hoy" : ""}: ${d.done ? "practicaste" : d.rest ? "día de descanso" : d.future ? "aún no ha llegado" : d.today ? "aún no has practicado" : "sin practicar"}`;
      return `<li class="rw-d${d.done ? " on" : ""}${d.rest ? " rest" : ""}${d.today ? " today" : ""}${d.future ? " fut" : ""}" aria-label="${lbl}" data-day="${d.k}">
        <span class="rw-dot" aria-hidden="true">${d.done ? ico("check", "bold", 16) : d.rest ? snow(16) : ""}</span><small aria-hidden="true">${d.l}</small></li>`;
    }).join("")}</ol>
    <div class="rw-wk" title="Copa de bronce: 3 días en una semana · plata: 5 · oro: 7">
      <span class="rw-wk-c" role="img" aria-label="Copa de la semana: ${C.cur} ${C.cur === 1 ? "día" : "días"}${C.lv ? ", copa de " + CUPN[C.lv] : ""}. La semana pasada: ${C.prev}. Copa de bronce con 3 días, de plata con 5 y de oro con 7">
      ${cupIco(C.lv, 26)}<span class="rw-wk-t" aria-hidden="true"><b>Copa de la semana</b><span><span class="t-num">${C.cur}</span> ${C.cur === 1 ? "día" : "días"} · la semana pasada <span class="t-num">${C.prev}</span></span></span></span>
      ${C.shelf.length ? `<ol class="rw-cups" aria-label="Tus copas: ${esc(sum)}">${C.shelf.slice(0, 8).map(c => `<li aria-label="Semana del ${esc(fmtW(c.mon))}: copa de ${CUPN[c.lv]}, ${c.n} días">${cupIco(c.lv, 20)}</li>`).join("")}</ol>` : ""}</div>
  </section>`;
}
function wordsHtml(){
  const w = words(), pm = w.total ? 100 * w.mast / w.total : 0;
  const txt = w.total ? `<b class="t-num">${fmt(w.total)}</b> ${plural(w.total, "palabra", "palabras")} · <b class="t-num">${fmt(w.mast)}</b> ya no ${plural(w.mast, "la olvidas", "las olvidas")}`
    : "Aún no hay palabras. ¡A por la primera!";
  return `<section class="card rw-words" aria-label="Tus palabras">
    <p class="rw-wl">${txt}</p>
    <div class="rw-bar" role="img" aria-label="${w.mast} de ${w.total} palabras ya no las olvidas"><i class="rw-bm" style="width:${pm.toFixed(1)}%"></i><i class="rw-bl" style="width:${w.total ? (100 - pm).toFixed(1) : 0}%"></i></div>
  </section>`;
}
function levelsHtml(){
  return `<nav class="rw-lvs" aria-label="Tus niveles">${levels().map(l => {
    const pc = Math.round(100 * l.p), full = l.total && l.done >= l.total;
    return `<a class="rw-lv${full ? " full" : ""}" href="#/mapa/${l.k}" style="--lc:${l.c}" aria-label="Nivel ${l.k}, ${esc(l.n)}: ${l.done} de ${l.total} lecciones">
      <span class="rw-ring">${ring(l.p)}<b>${full ? ico("check", "bold", 18) : l.k}</b></span><small class="t-num">${pc}%</small></a>`;
  }).join("")}</nav>`;
}
function nextHtml(list){
  const a = next(list);
  if(!a) return `<section class="card rw-next all" aria-label="Medallas"><span class="rw-all-ic" aria-hidden="true">${ico("trophy", "fill", 32)}</span><p>¡Tienes todas las medallas!</p></section>`;
  return `<section class="card rw-next" aria-labelledby="rw-nx-h"><h2 class="rw-h2" id="rw-nx-h">Tu próxima medalla</h2>
    <button type="button" class="rw-nx" data-ach="${esc(a.id)}" aria-label="${esc(a.t)}: ${esc(a.d)}. ${a.v} de ${a.goal}">
      ${medalFace(a)}<span class="rw-nx-t"><b>${esc(a.t)}</b><span>${esc(a.d)}</span>${barHtml(a)}<small class="t-num">${fmt(a.v)} de ${fmt(a.goal)}</small></span>${ico("caret-right", "bold", 18, "rw-chev")}</button></section>`;
}
function newHtml(list){
  if(!list.length) return "";
  return `<section class="card rw-new" aria-labelledby="rw-new-h"><h2 class="rw-h2" id="rw-new-h">${list.length === 1 ? "¡Medalla nueva!" : "¡Medallas nuevas!"}</h2>
    <div class="rw-new-l">${list.slice(0, 3).map(a => `<button type="button" class="rw-nm" data-ach="${esc(a.id)}" aria-label="${esc(a.t)}: conseguida">${medalFace(a)}
      <span class="rw-nm-t"><b>${esc(a.t)}</b><small>${COIN}<span class="t-num">+${REWARD}</span></small></span></button>`).join("")}</div></section>`;
}

/* ---------- Medallas (#/progreso) ---------- */
async function premios(){
  css(); clearGest(); closeMedal(true);
  const nav = ++NAV;
  await Promise.all([getMap().catch(() => null), getShop()]);
  if(nav !== NAV || !onRoute("progreso")) return;
  D.onkeydown = null;
  const list = achList(), got = list.filter(a => a.ok).length, nw = fresh(list), st = streak(), lad = ladder(list);
  $("#app").innerHTML = `<div class="rw" id="rw">
    ${newHtml(nw)}
    ${W.vocabShop && typeof vocabShop.wishSlot === "function" ? vocabShop.wishSlot() : ""}
    ${weekHtml(st)}
    ${wordsHtml()}
    ${levelsHtml()}
    ${nextHtml(list)}
    <div id="rw-voz" hidden></div>
    <section class="rw-all" aria-labelledby="rw-m-h"><div class="rw-mhd"><h2 class="rw-h2 rw-mh" id="rw-m-h">Medallas <small class="t-num">${got} de ${list.length}</small></h2>
      ${lad.some(Boolean) ? `<button type="button" class="rw-more" id="rw-more" aria-expanded="false" aria-controls="rw-meds">Ver todas</button>` : ""}</div>
      <div class="rw-meds" id="rw-meds">${list.map((a, i) => medalBtn(a, lad[i])).join("")}</div></section>
  </div>`;
  const app = $("#rw");
  { const ws = app.querySelector("[data-wish-slot]"); if(ws && W.vocabShop) vocabShop.bind(ws); }   /* «Mi deseo»: «Conseguir» o «Ganar monedas» */
  /* «Tu voz en el tiempo» (la cápsula del loro, js/parrot.js): se pinta sola en su hueco si hay algo grabado */
  if(W.vocabParrot && typeof vocabParrot.paintCapsule === "function") vocabParrot.paintCapsule($("#rw-voz"));
  app.addEventListener("click", e => {
    const mo = e.target.closest("#rw-more");
    if(mo){
      const all = mo.getAttribute("aria-expanded") !== "true";
      app.querySelectorAll(".rw-m.more").forEach(m => { m.hidden = !all; });
      mo.setAttribute("aria-expanded", String(all)); mo.textContent = all ? "Ver menos" : "Ver todas";
      try{ if(W.G && G.haptic) G.haptic("selection"); }catch(err){}
      return;
    }
    const b = e.target.closest("[data-ach]"); if(!b || !app.contains(b)) return;
    openMedal(b.dataset.ach, b);
  });
  /* mantener pulsada una medalla: el mismo detalle (vistazo), como en el camino y los juegos */
  if(W.G && typeof G.hold === "function") app.querySelectorAll(".rw-m").forEach(b => {
    GEST.push(G.hold(b, {onHold: () => { try{ G.haptic("selection"); }catch(e){} openMedal(b.dataset.ach, b); }}));
  });
  if(nw.length){
    markSeen(nw.map(a => a.id));
    app.querySelectorAll(".rw-new .rw-mc").forEach((el, i) => spin(el, 250 + i * 320));
  }
}
/* el giro especial de una medalla nueva: una vuelta y media sobre sí misma con un saltito y chispas de oro (una vez) */
function spin(el, delay = 0){
  if(!el || typeof el.animate !== "function") return null;
  if(rm()) return el.animate([{opacity: .3}, {opacity: 1}], {duration: 150, delay, fill: "backwards"});
  const a = el.animate([
    {transform: "perspective(500px) rotateY(0deg) scale(.55)", opacity: .2},
    {transform: "perspective(500px) rotateY(400deg) scale(1.12)", opacity: 1, offset: .65},
    {transform: "perspective(500px) rotateY(540deg) scale(.96)", offset: .85},
    {transform: "perspective(500px) rotateY(720deg) scale(1)"}], {duration: 1300, delay, easing: "cubic-bezier(.22,.8,.3,1)", fill: "backwards"});
  el.classList.add("is-spin");
  const done = () => { el.classList.remove("is-spin"); };
  a.finished.then(done, done);
  setTimeout(() => { try{ if(el.isConnected && W.M && typeof M.burst === "function") M.burst(el, {n: 14}); }catch(e){} }, delay + 850);
  return a;
}

/* ---------- hoja con el detalle de una medalla ---------- */
let SH = null;
function sheet(){
  if(SH && SH.isConnected) return SH;
  SH = D.createElement("dialog"); SH.id = "rw-sheet"; SH.className = "rw-sh-d"; SH.setAttribute("aria-labelledby", "rw-sh-t");
  SH.dataset.noRenew = "";
  D.body.appendChild(SH);
  SH.addEventListener("click", e => { if(e.target.closest("[data-close]")) closeMedal(); });
  return SH;
}
function openMedal(id, from){
  const a = achList().find(x => x.id === id); if(!a) return false;
  css();
  const d = sheet(), left = Math.max(0, a.goal - a.v), when = a.ok ? achDate(a.id) : "";
  d.innerHTML = `<div class="m-head"><h2 id="rw-sh-t">${esc(a.t)}</h2><button type="button" class="glass-btn glass-btn--sm m-head-x" data-close>Listo</button></div>
    <div class="rw-sh">
      ${medalFace(a, true)}
      ${a.lv ? `<p class="rw-sh-lv l${a.lv}">Medalla de ${LVN[a.lv]}</p>` : ""}
      <p class="rw-sh-st${a.ok ? " ok" : ""}">${a.ok ? `${ico("check-circle", "fill", 22)}<span>${when ? `¡Conseguida el ${esc(when)}!` : "¡Conseguida!"}</span>` : `<span>¡A por ella!</span>`}</p>
      <div class="rw-sh-g">
        <h3 class="st-h">Cómo se gana</h3>
        <p class="rw-sh-how">${esc(a.d)}</p>
        ${a.ok ? "" : `${barHtml(a, "big")}<p class="rw-sh-v"><span class="t-num">${fmt(a.v)} de ${fmt(a.goal)}</span> · ${left === 1 ? "te falta 1" : `te faltan ${fmt(left)}`}</p>`}
      </div>
      <p class="rw-sh-c">${COIN}<span>${a.ok ? `Te dio ${REWARD} monedas` : `Al ganarla: ${REWARD} monedas`}</span></p>
    </div>`;
  try{
    if(W.M && typeof M.openSheet === "function") M.openSheet(d, {from: from && from.nodeType === 1 ? from : null});
    else d.showModal();
  }catch(e){ try{ d.showModal(); }catch(e2){ d.setAttribute("open", ""); } }
  return true;
}
function closeMedal(now){
  if(!SH || !SH.open) return;
  if(!now && W.M && typeof M.closeSheet === "function" && SH.classList.contains("m-sheet")) M.closeSheet(SH);
  else SH.close();
}

/* ---------- Mi zorro (#/mizorro) ---------- */
const MZ_KEY = "vocab:mz-tab";
const zTypes = () => ((W.vocabShop && vocabShop.types) || []).filter(t => t.t !== "farm");
function mzTab(){
  let t = null; try{ t = sessionStorage.getItem(MZ_KEY); }catch(e){}
  return zTypes().some(x => x.t === t) ? t : (zTypes()[0] || {}).t || "hero";
}
const heroSize = () => matchMedia("(min-width:820px)").matches ? 168 : 132;
function wornHtml(){
  const g = game(), parts = ["hat", "face", "hand", "pet"].map(t => g.wear && g.wear[t] ? itemById(g.wear[t]) : null).filter(Boolean);
  if(!parts.length) return `<span class="mz-none">¡Elige algo para ponerte!</span>`;
  return parts.map(it => `<span class="mz-chip"><span class="mz-ci" aria-hidden="true">${W.vocabShop ? vocabShop.img(it.id) : esc(it.e || "")}</span>${esc(it.n)}</span>`).join("");   /* el mismo dibujo que la pieza */
}
function heroName(){
  const id = W.vocabShop ? vocabShop.worn("hero") : "zorro", it = itemById(id) || itemById("zorro");
  return cap(it ? it.n : "zorro");
}
function wornLabel(){
  const g = game(), parts = ["hat", "face", "hand", "pet"].map(t => g.wear && g.wear[t] ? itemById(g.wear[t]) : null).filter(Boolean).map(it => it.n);
  return `${heroName()}${parts.length ? ", con " + (parts.length > 1 ? parts.slice(0, -1).join(", ") + " y " + parts[parts.length - 1] : parts[0]) : ""}`;
}
function paintHero(jumpIt){
  const f = $("#mz-fox"); if(!f) return;
  f.innerHTML = heroHtml(heroSize());
  f.setAttribute("aria-label", wornLabel());
  const n = $("#mz-name"); if(n) n.textContent = heroName();
  const w = $("#mz-worn"); if(w) w.innerHTML = wornHtml();
  if(W.vocabArmy) try{ vocabArmy.decorate(f.closest(".mz-hero")); }catch(e){}   /* el soldado: su rango (js/army.js) */
  if(!jumpIt) return;
  jump(f);
  /* si el personaje no se ve (se bajó hasta las piezas), un aviso con su miniatura */
  const r = f.getBoundingClientRect(), top = ($("#topbar") || {getBoundingClientRect: () => ({bottom: 0})}).getBoundingClientRect().bottom;
  if(r.bottom < top + 40 || r.top > innerHeight - 80){
    try{
      const ic = D.createElement("span"); ic.className = "mz-tic"; ic.innerHTML = heroHtml(26);
      if(W.M && typeof M.toast === "function") M.toast("¡Te queda genial!", {icon: ic, ms: 2200});
    }catch(e){}
  }
}
/* el saltito del personaje al ponerse algo */
function jump(el){
  if(!el || typeof el.animate !== "function") return;
  if(rm()){ el.animate([{opacity: .5}, {opacity: 1}], {duration: 150}); return; }
  el.animate([{transform: "translateY(0) scale(1)"}, {transform: "translateY(-16px) scale(1.06)", offset: .35},
    {transform: "translateY(0) scale(.98)", offset: .7}, {transform: "translateY(0) scale(1)"}], {duration: 520, easing: "cubic-bezier(.3,.7,.4,1)"});
}
function shopHtml(t){
  return W.vocabShop ? vocabShop.items(t).map(x => vocabShop.card(x, {mode: "zorro"})).join("") : "";
}
function setTab(t, focus){
  if(!zTypes().some(x => x.t === t)) return;
  try{ sessionStorage.setItem(MZ_KEY, t); }catch(e){}
  const seg = $("#mz-seg"), host = $("#mz-shop"); if(!seg || !host) return;
  seg.querySelectorAll(".seg-i").forEach(b => { const on = b.dataset.t === t; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if(on && focus) b.focus(); });
  host.setAttribute("aria-labelledby", "mz-t-" + t);
  host.innerHTML = shopHtml(t);
  const on = seg.querySelector(`.seg-i[data-t="${t}"]`);
  if(on && seg.scrollWidth > seg.clientWidth + 1){
    const L = on.offsetLeft - 8, R = on.offsetLeft + on.offsetWidth + 8;
    if(L < seg.scrollLeft || R > seg.scrollLeft + seg.clientWidth) seg.scrollTo({left: Math.max(0, L - (seg.clientWidth - on.offsetWidth) / 2), behavior: rm() ? "auto" : "smooth"});
  }
}
async function miZorro(){
  css(); clearGest(); closeMedal(true);
  const nav = ++NAV;
  await getShop();
  if(nav !== NAV || !onRoute("mizorro")) return;
  D.onkeydown = null;
  if(!W.vocabShop){ $("#app").innerHTML = `<p class="empty">No se pudo abrir la tienda. Vuelve a intentarlo.</p>`; return; }
  const types = zTypes(), tab = mzTab();
  $("#app").innerHTML = `<div class="mz" id="mz">
    <section class="card mz-hero" aria-labelledby="mz-name">
      <div class="mz-fox" id="mz-fox" role="img"></div>
      <h2 class="mz-name" id="mz-name"></h2>
      <div class="mz-worn" id="mz-worn" aria-live="polite"></div>
    </section>
    <div class="mz-side">
      ${typeof vocabShop.wishSlot === "function" ? vocabShop.wishSlot() : ""}
      <div class="seg mz-seg" id="mz-seg" role="tablist" aria-label="Qué quieres ponerte">${types.map(t => `<button type="button" class="seg-i" role="tab" id="mz-t-${t.t}" data-t="${t.t}" aria-controls="mz-shop" aria-selected="false" tabindex="-1">${esc(t.n)}</button>`).join("")}</div>
      <div class="shop mz-shop" id="mz-shop" role="tabpanel"></div>
    </div>
  </div>`;
  paintHero(false);
  setTab(tab, false);
  const seg = $("#mz-seg");
  seg.addEventListener("click", e => { const b = e.target.closest(".seg-i[data-t]"); if(b) setTab(b.dataset.t, false); });
  seg.addEventListener("keydown", e => {
    const items = [...seg.querySelectorAll(".seg-i")];
    if(["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)){
      try{ rovingKeys(e, items); }catch(_){}
      const f = D.activeElement; if(f && f.dataset && f.dataset.t) setTab(f.dataset.t, false);
    }
  });
  vocabShop.bind($("#mz-shop"), {onChange: e => { if(e.type === "buy" || e.type === "wear") paintHero(true); }});
  { const ws = $("#mz [data-wish-slot]"); if(ws) vocabShop.bind(ws, {onChange: e => { if(e.type === "buy") paintHero(true); }}); }
}
/* otra pestaña del navegador cambió la partida: el personaje y las piezas se ponen al día */
addEventListener("storage", e => {
  if(e.key !== "game" || !onRoute("mizorro")) return;
  try{ paintHero(false); if(W.vocabShop) vocabShop.sync($("#mz-shop")); }catch(err){}
});

/* ---------- estilos ---------- */
const CSS = `
.rw{display:flex;flex-direction:column;gap:12px;max-width:680px}
.rw .card{padding:16px}
.rw-h2{margin:0;font:600 var(--fs-head)/1.25 var(--f-text);color:var(--label)}
.rw-h2 small{margin-left:6px;font:400 var(--fs-note)/1 var(--f-text);color:var(--label2)}
/* racha */
.rw-fl{display:flex;align-items:center;gap:12px}
.rw-flame{flex:none;display:grid;place-items:center;width:64px;height:64px;color:var(--gold)}
.rw-flame.off{color:var(--fill)}
.rw-fl-t{display:flex;flex-direction:column;min-width:0}
.rw-n{font:700 calc(2.75rem*var(--k))/1 var(--f-round);color:var(--label)}
.rw-fl-t span{font:400 var(--fs-sub)/1.25 var(--f-text);color:var(--label2)}
.rw-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin:16px 0 0;padding:0;list-style:none}
.rw-d{display:flex;flex-direction:column;align-items:center;gap:4px}
.rw-dot{display:grid;place-items:center;width:min(36px,100%);aspect-ratio:1;border-radius:50%;background:var(--fill);color:var(--gold-on)}
.rw-d.on .rw-dot{background:var(--gold)}
.rw-d.today:not(.on) .rw-dot{background:none;box-shadow:inset 0 0 0 2.5px var(--gold-deep)}
.rw-d.fut .rw-dot{opacity:.55}
.rw-d small{font:600 var(--fs-min)/1.2 var(--f-text);color:var(--label2)}
.rw-d.today small{color:var(--label);font-weight:800}
.rw-d.rest .rw-dot{background:var(--brand-fill);color:#fff}
.rw-fresh{font:700 var(--fs-t3,1.5rem)/1.15 var(--f-round)}
.rw-rest{display:inline-flex;align-items:center;gap:4px;margin-top:4px;font:600 var(--fs-note)/1.25 var(--f-text);color:var(--brand-ink)}
:root[data-theme=dark] .rw-rest{color:#7DBBFF}
/* copa de la semana y estantería: bronce (madera), plata (pizarra) y oro */
.rw-cup{display:inline-grid;place-items:center;flex:none;color:var(--fill)}
.rw-cup.l1{color:#A86B3C}.rw-cup.l2{color:#7F8C9B}.rw-cup.l3{color:var(--gold-deep)}
:root[data-theme=dark] .rw-cup.l1{color:#D0935F}:root[data-theme=dark] .rw-cup.l2{color:#B4C0CC}:root[data-theme=dark] .rw-cup.l3{color:var(--gold)}
.rw-cup.l0{color:var(--label3,#C7C7CC)}
.rw-wk{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;margin:14px 0 0;padding:10px 12px;border-radius:var(--r-md);background:var(--fill2)}
.rw-wk-c{display:flex;align-items:center;gap:10px;min-width:0}
.rw-wk-t{display:flex;flex-direction:column;gap:1px;min-width:0}
.rw-wk-t b{font:600 var(--fs-note)/1.2 var(--f-text);color:var(--label)}
.rw-wk-t>span{font:400 var(--fs-note)/1.25 var(--f-text);color:var(--label2)}
/* la estantería: las copas de las semanas terminadas sobre una balda de madera */
.rw-cups{display:flex;gap:2px;margin:0 0 0 auto;padding:0 4px 1px;list-style:none;border-bottom:3px solid #B98A5E;border-radius:2px}
.rw-cups li{display:grid;place-items:center;width:24px;height:26px}
/* medallas por niveles: aro de bronce, plata u oro */
.rw-mc.ok.lv1{background:rgba(168,107,60,.16);box-shadow:inset 0 0 0 3px #A86B3C}
.rw-mc.ok.lv2{background:rgba(127,140,155,.18);box-shadow:inset 0 0 0 3px #7F8C9B}
.rw-mc.ok.lv3{background:var(--gold-soft);box-shadow:inset 0 0 0 3px var(--gold)}
.rw-mc.big.ok.lv1{box-shadow:inset 0 0 0 4px #A86B3C}.rw-mc.big.ok.lv2{box-shadow:inset 0 0 0 4px #7F8C9B}.rw-mc.big.ok.lv3{box-shadow:inset 0 0 0 4px var(--gold)}
.rw-sh-lv{margin:2px 0 0;font:700 var(--fs-note)/1.2 var(--f-text);color:var(--label2)}
.rw-sh-lv.l1{color:#7A4A28}.rw-sh-lv.l2{color:#4A5563}.rw-sh-lv.l3{color:var(--gold-ink)}
:root[data-theme=dark] .rw-sh-lv.l1{color:#E6B080}:root[data-theme=dark] .rw-sh-lv.l2{color:#B4C0CC}
/* palabras */
.rw-wl{margin:0 0 10px;font:400 var(--fs-sub)/1.35 var(--f-text);color:var(--label)}
.rw-wl b{font:700 var(--fs-head)/1 var(--f-round)}
.rw-bar{display:flex;height:12px;border-radius:999px;background:var(--fill);overflow:hidden}
.rw-bar i{display:block;height:100%}
.rw-bm{background:var(--ok-fill)}
.rw-bl{background:color-mix(in srgb,var(--ok) 34%,var(--card))}
:root[data-theme=dark] .rw-bm{background:var(--ok)}
:root[data-theme=dark] .rw-bl{background:color-mix(in srgb,var(--ok) 40%,#1C1C1E)}
/* niveles */
.rw-lvs{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;padding:12px 8px;border-radius:var(--r-card);background:var(--card)}
.rw-lv{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;min-height:var(--tap);padding:2px 0;border-radius:var(--r-md);color:var(--label);text-decoration:none}
.rw-ring{position:relative;display:grid;place-items:center;width:min(52px,100%);aspect-ratio:1}
.rw-rs{position:absolute;inset:0;width:100%;height:100%;rotate:-90deg}
.rw-rs circle{fill:none;stroke-width:4;stroke-linecap:round}
.rw-rb{stroke:var(--fill)}
.rw-rf{stroke:var(--lc)}
:root[data-theme=dark] .rw-rf{stroke:color-mix(in srgb,var(--lc) 60%,#fff)}
.rw-lv.full .rw-rf{stroke:var(--gold)}
.rw-ring b{position:relative;display:grid;place-items:center;font:700 var(--fs-note)/1 var(--f-round);color:var(--label)}
.rw-lv.full .rw-ring b{color:var(--gold-ink)}
.rw-lv small{font:600 var(--fs-min)/1.2 var(--f-text);color:var(--label2)}
/* próxima medalla */
.rw-next .rw-h2{margin-bottom:10px}
.rw-nx{display:flex;align-items:center;gap:12px;width:100%;margin:0;padding:0;border:0;background:none;color:var(--label);text-align:left;cursor:pointer}
.rw-nx-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.rw-nx-t b{font:600 var(--fs-sub)/1.25 var(--f-text)}
.rw-nx-t>span{font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.rw-nx-t small{font:600 var(--fs-min)/1.2 var(--f-text);color:var(--label2)}
.rw-chev{flex:none;color:var(--label3,var(--label2))}
.rw-pb{height:8px;margin:4px 0 0;border-radius:999px;background:var(--fill);overflow:hidden}
.rw-pb i{display:block;height:100%;border-radius:inherit;background:var(--gold)}
.rw-pb.big{height:12px;margin:10px 0 6px}
.rw-next.all{display:flex;align-items:center;gap:12px}
.rw-next.all p{margin:0;font:600 var(--fs-sub)/1.3 var(--f-text)}
.rw-all-ic{color:var(--gold)}
/* medalla nueva */
.rw-new{box-shadow:inset 0 0 0 2px var(--gold)}
.rw-new .rw-h2{margin-bottom:10px;color:var(--gold-ink)}
.rw-new-l{display:flex;flex-wrap:wrap;gap:12px}
.rw-nm{display:flex;align-items:center;gap:12px;flex:1 1 220px;min-width:0;margin:0;padding:0;border:0;background:none;color:var(--label);text-align:left;cursor:pointer}
.rw-nm-t{display:flex;flex-direction:column;gap:2px;min-width:0}
.rw-nm-t b{font:600 var(--fs-sub)/1.25 var(--f-text)}
.rw-nm-t small{display:inline-flex;align-items:center;gap:4px;font:700 var(--fs-note)/1 var(--f-round);color:var(--gold-ink)}
.rw-nm-t .coin-ico,.rw-sh-c .coin-ico{width:18px;height:18px;flex:none}
/* medallas */
.rw-mhd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 4px}
.rw-mh{margin:8px 0 6px 4px}
.rw-more{min-height:44px;padding:0 12px;border:0;border-radius:999px;background:none;color:var(--brand-ink);font:600 var(--fs-note)/1 var(--f-text);cursor:pointer}
:root[data-theme=dark] .rw-more{color:#7DBBFF}
.rw-more:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
.rw-m[hidden]{display:none}
.rw-meds{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 8px}
.rw-m{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0;margin:0;padding:4px;border:0;border-radius:var(--r-md);background:none;color:var(--label);cursor:pointer}
.rw-mc{position:relative;flex:none;display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:var(--gold-soft);box-shadow:inset 0 0 0 3px var(--gold);backface-visibility:visible}
.rw-mc.lock{background:var(--fill);box-shadow:none}
.rw-me{font-size:34px;line-height:1}
.rw-mc.lock .rw-me{filter:grayscale(1) brightness(0);opacity:.28}
:root[data-theme=dark] .rw-mc.lock .rw-me{filter:grayscale(1) brightness(0) invert(1);opacity:.32}
.rw-mc.big{width:112px;height:112px;box-shadow:inset 0 0 0 4px var(--gold)}
.rw-mc.big.lock{box-shadow:none}
.rw-mc.big .rw-me{font-size:60px}
.rw-mt{max-width:100%;font:600 var(--fs-min)/1.2 var(--f-text);text-align:center;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rw-m.lock .rw-mt{color:var(--label2)}
/* a 360 px, 4 columnas: el título usa todo el ancho de la columna y parte las palabras largas con guion */
@media (max-width:400px){.rw-m{padding-left:0;padding-right:0}.rw-mt{hyphens:auto}}
.rw-m:focus-visible,.rw-nx:focus-visible,.rw-nm:focus-visible,.rw-lv:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
/* hoja de una medalla */
dialog.rw-sh-d{max-width:520px}
.rw-sh{display:flex;flex-direction:column;align-items:center;gap:10px;padding:4px 0 8px;text-align:center}
.rw-sh-st{display:inline-flex;align-items:center;gap:6px;margin:4px 0 0;font:600 var(--fs-sub)/1.3 var(--f-text);color:var(--label)}
.rw-sh-st.ok .ico{color:var(--ok-fill)}
:root[data-theme=dark] .rw-sh-st.ok .ico{color:var(--ok)}
.rw-sh-g{align-self:stretch;margin:6px 0 0;padding:14px 16px;border-radius:var(--r-card);background:var(--fill2);text-align:left}
.rw-sh-g .st-h{margin:0 0 4px}
.rw-sh-how{margin:0;font:600 var(--fs-body)/1.3 var(--f-text);color:var(--label)}
.rw-sh-v{margin:0;font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label)}
/* (texto en el color normal: la hoja de vidrio claro sobre el fondo oscurecido queda gris y el oro no llega a 4,5:1) */
.rw-sh-c{display:inline-flex;align-items:center;gap:6px;margin:6px 0 0;font:600 var(--fs-note)/1.3 var(--f-text);color:var(--label)}
/* Mi zorro */
.mz{display:flex;flex-direction:column;gap:16px;max-width:960px}
.mz-hero{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 16px 18px;text-align:center}
.mz-fox{display:grid;place-items:center;min-height:calc(132px * 1.25 + 8px);padding-top:8px}
.mz-name{margin:0;font:700 var(--fs-t3)/1.2 var(--f-round);color:var(--label)}
.mz-worn{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;min-height:32px}
.mz-chip{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;border-radius:999px;background:var(--fill2);font:600 var(--fs-note)/1.2 var(--f-text);color:var(--label)}
.mz-none{display:inline-flex;align-items:center;min-height:32px;font:400 var(--fs-note)/1.2 var(--f-text);color:var(--label2)}
.mz-seg{overflow-x:auto;scrollbar-width:none;margin:0 0 12px;max-width:none}
.mz-seg::-webkit-scrollbar{display:none}
.mz-seg .seg-i{flex:1 0 auto;padding:0 12px}
/* en el móvil los 5 tipos no caben en un segmentado: fichas que pasan a otra fila (todas a la vista, sin scroll oculto) */
@media (max-width:819px){
  .mz-seg{flex-wrap:wrap;gap:8px;min-height:0;padding:0;border-radius:0;background:none;overflow:visible}
  .mz-seg .seg-i{flex:0 0 auto;padding:0 16px;background:var(--fill2)}
  .mz-seg .seg-i[aria-selected=true]{background:var(--brand-soft);color:var(--brand-ink);box-shadow:inset 0 0 0 2px var(--brand-tint)}
  :root[data-theme=dark] .mz-seg .seg-i[aria-selected=true]{background:var(--brand-soft);color:var(--brand-ink)}
}
.mz-ci{display:grid;place-items:center;width:24px;height:24px}
.mz-ci .pj{display:block;width:24px;height:24px;object-fit:contain}
.mz-ci .pj-fb{font-size:18px;line-height:1}
.mz-tic{display:grid;place-items:center;width:30px;height:30px}
.mz-tic .hero{font-size:24px}
@media (min-width:820px){
  .mz{display:grid;grid-template-columns:300px minmax(0,1fr);align-items:start;gap:24px}
  .mz-hero{position:sticky;top:calc(var(--topbar-h,80px) + 16px)}
  .mz-fox{min-height:calc(168px * 1.25 + 8px)}
}
@media (forced-colors:active){.rw-mc{border:2px solid CanvasText}.rw-dot{border:1px solid CanvasText}}
@media (prefers-reduced-motion:reduce){.rw-mc.is-spin{animation:none}}`;
function css(){
  if(D.getElementById("css-rewards") || !D.head) return;
  const s = D.createElement("style"); s.id = "css-rewards"; s.textContent = CSS; D.head.appendChild(s);
}
try{ css(); }catch(e){}

/* ---------- conexión con la app ---------- */
ROUTES.progreso = () => premios();
ROUTES.mizorro = () => miZorro();
/* una medalla ganada mientras se miran las medallas: se vuelve a pintar (sale «¡Medalla nueva!» y gira) */
let medT = 0;
bus.on("medal", () => { clearTimeout(medT); medT = setTimeout(() => { if(onRoute("progreso")) premios().catch(e => console.error(e)); }, 120); });
bus.on("route", d => {
  const h = String((d && d.h) || "").split("/")[0];
  if(h !== "progreso" && h !== "mizorro"){ NAV++; clearGest(); }
  if(h !== "progreso") closeMedal(true);
});
addEventListener("hashchange", () => closeMedal(true));

/* ---------- palabra dominada (bus "mastered" {k, doc, es, lang} del repaso, la primera vez que una palabra queda
   dominada: un acierto comprobado por la app a 30 días o más): una sorpresa pequeña, +5 monedas y un aviso con la
   palabra y su IPA. Nunca por abrir la app ni por el tiempo: solo por lo que ya no se le olvida ---------- */
const MASTER_COINS = 5;
/* un aviso de M.toast con la palabra en su idioma (M.toast solo pinta texto: al salir, se cambia por el HTML) */
function richToast(text, html, icon){
  try{
    if(!W.M || typeof M.toast !== "function"){ if(typeof toast === "function") toast(text); return; }
    M.toast(text, {icon, ms: 4200});
    const fix = () => { const t = [...D.querySelectorAll("#m-toasts .m-tt")].find(x => x.textContent === text && !x.dataset.rich); if(!t) return false; t.dataset.rich = "1"; t.innerHTML = html; return true; };
    if(fix()) return;
    const mo = new MutationObserver(() => { if(fix()) mo.disconnect(); });
    mo.observe(D.body, {childList: true, subtree: true});
    setTimeout(() => mo.disconnect(), 30000);
  }catch(e){ console.error(e); }
}
const PAID = new Set();   /* (el repaso avisa una sola vez por palabra; esto solo evita pagar dos veces el mismo aviso) */
async function onMastered(d){
  if(!d || typeof d.doc !== "string" || typeof d.es !== "string") return;
  const pk = (d.lang || lang) + "|" + (d.k || d.doc + "|" + d.es); if(PAID.has(pk)) return; PAID.add(pk);
  const L = d.lang && LANGS[d.lang] ? d.lang : lang, code = LANGS[L].code;
  let w = "", ipa = "";
  try{ const doc = await getDoc(d.doc), r = ((doc && doc.rows) || []).find(x => x && x.es === d.es && x.l && x.l[L]); if(r){ w = r.l[L].word || ""; ipa = r.l[L].ipa || ""; } }catch(e){}
  award(MASTER_COINS, "", true);
  const ip = typeof ipaHtml === "function" ? ipaHtml(ipa, code) : "";
  const text = `¡Palabra dominada!${w ? " " + w : ""}${ip ? " " + ipa : ""} +${MASTER_COINS}`;
  richToast(text, `¡Palabra dominada!${w ? ` <b lang="${esc(code)}">${esc(w)}</b>` : ""}${ip ? " " + ip : ""} +${MASTER_COINS}`, "coin");
  bus.emit("mastered-paid", {k: d.k, word: w, coins: MASTER_COINS});
}
bus.on("mastered", d => { onMastered(d).catch(e => console.error(e)); });

W.vocabRewards = {premios, miZorro, week, words, levels, next, fresh, openMedal, closeMedal, spin, cups, snow};
})();
