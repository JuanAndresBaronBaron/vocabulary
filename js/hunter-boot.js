/* Módulo hunter-boot (window.vocabHunter): la puerta de entrada del «Cazador de cosas» (SPEC §5-K). Es lo único del
   cazador que se carga al abrir la app; js/hunter.js (la cámara, el juego y la página «Mi casa») se pide la primera
   vez que hace falta, con el mismo ?v= que este fichero:
   · ROUTES.cazador (#/cazador, de la pestaña Jugar; modo foco html[data-focus=cazador]) carga js/hunter.js y le pasa
     la ruta; ROUTES.cazador.load (lo que index.html pide antes de pintar con movimiento) también.
   · La tarjeta de Juegos (vocabGames.register: tarjeta que lleva a #/cazador, sin estrellas).
   · «Mi casa» del álbum (js/album.js): casaRow() es la fila de la portada del álbum que lleva a #/album/casa, y
     casa(vivo) pinta esa página (carga js/hunter.js; vivo() dice si se sigue en ella).
   · Para mayores (js/settings.js): adultHtml() es «Borrar las fotos de Mi casa» (solo si hay alguna; dos toques en 5 s)
     y borra de IndexedDB solo esas fotos (kind "photo", src "hunt"), sin tocar las grabaciones del Buzón ni del loro.
   · count(): cuántas fotos de «Mi casa» hay en este aparato (IndexedDB de window.vocabMedia, kind "photo", src "hunt");
     se cuenta al arrancar (solo si ya se jugó: hay "hunt:st"), al guardar una, al abrir Para mayores y al cerrar Ajustes.
   · SWATCH (el dibujo de cada color) y THINGS (los dibujos del modo tocar: [nombre, dibujo] de cosas de cada color) van
     aquí para que images() (lo que «Descargar todo» guarda para jugar sin conexión) y el juego usen la misma lista.
   API: window.vocabHunter = {loaded (false hasta que llega js/hunter.js, que añade lo demás), load() → Promise,
     count() → número | null, recount() → Promise<número>, casaRow() → HTML, casa(vivo) → Promise, adultHtml() → HTML,
     images() → [url], wipe() → Promise<número borradas>, SRC, KEY, IMG, HOUSE, SWATCH, THINGS}. */
(() => {
"use strict";
const W = window, D = document;
const SRC = "js/hunter.js", KEY = "hunt:st", IMG = "img/games/cazador.png", HOUSE = "img/om_1F3E1.png";
const SWATCH = {red: "img/746cbfda58.png", yellow: "img/f9ebe8fd08.png", green: "img/2368d85824.png", blue: "img/a39196ddae.png"};
const THINGS = {
  red: [["Manzana", "img/om_1F34E.png"], ["Tomate", "img/om_1F345.png"], ["Coche", "img/om_1F697.png"], ["Globo", "img/om_1F388.png"]],
  yellow: [["Plátano", "img/om_1F34C.png"], ["Limón", "img/om_1F34B.png"], ["Sol", "img/om_2600.png"], ["Estrella", "img/om_2B50.png"]],
  green: [["Hoja", "img/om_1F343.png"], ["Rana", "img/2c8ad30871.png"], ["Árbol", "img/om_1F333.png"], ["Cocodrilo", "img/a049197ac5.png"]],
  blue: [["Ballena", "img/e4b4360485.png"], ["Pez", "img/33c5decbaa.png"], ["Vaqueros", "img/om_1F456.png"], ["Camiseta", "img/om_1F455.png"]],
};
/* el ?v= de este <script> (la VERSION de sw.js): js/hunter.js sale de la misma versión */
const V = (() => { try{ const s = D.currentScript && D.currentScript.src, m = s && /[?&]v=([^&#]+)/.exec(s); return m ? `?v=${m[1]}` : ""; }catch(e){ return ""; } })();
let pend = null, N = null;
const H = W.vocabHunter = W.vocabHunter || {};

function load(){
  if(H.loaded) return Promise.resolve(H);
  if(!pend) pend = new Promise((res, rej) => {
    const s = D.createElement("script");
    s.src = SRC + V; s.async = true; s.dataset.hunter = "";
    s.onload = () => { if(H.loaded) res(H); else { pend = null; rej(new Error("El cazador no se ha podido abrir.")); } };
    s.onerror = () => { pend = null; s.remove(); rej(new Error("El cazador no se ha podido cargar. Comprueba la conexión.")); };
    D.head.appendChild(s);
  });
  return pend;
}

/* ---------- cuántas fotos hay en «Mi casa» ---------- */
const media = () => { try{ return W.vocabMedia && typeof vocabMedia.ok === "function" && vocabMedia.ok() ? vocabMedia : null; }catch(e){ return null; } };
const nFotos = n => n === 1 ? "1 foto" : `${n} fotos`;
const rowSub = () => N ? `${nFotos(N)} de lo que cazaste` : "Caza colores con la cámara";
function paintRow(){
  D.querySelectorAll(".hn-casa-r").forEach(a => {
    const s = a.querySelector("small"); if(s) s.textContent = rowSub();
    a.setAttribute("aria-label", `Mi casa: ${rowSub()}`);
  });
}
/* solo las fotos del cazador: en la misma base hay otras «photo» (y las grabaciones); se miran sin abrir las imágenes */
function ours(){
  const m = media(); if(!m) return Promise.resolve([]);
  return m.list("photo").then(a => (a || []).filter(x => x && x.src === "hunt"), () => []);
}
function recount(){
  if(!media()) return Promise.resolve(N || 0);
  return ours().then(a => { N = a.length; paintRow(); return N; });
}
/* borrar todas las fotos de «Mi casa» (Para mayores) */
function wipe(){
  const m = media(); if(!m) return Promise.resolve(0);
  return ours().then(async a => { for(const x of a) await m.del(x.id); N = 0; paintRow(); return a.length; });
}

/* ---------- la fila de la portada del álbum ---------- */
const CSS = `.hn-casa-s{margin:0}
.hn-casa-r{color:var(--label);text-decoration:none;font:400 var(--fs-sub)/1.25 var(--f-text);-webkit-tap-highlight-color:transparent}
.hn-casa-r .st-l{display:flex;flex-direction:column;gap:2px;font-weight:600}
.hn-casa-r small{font:400 var(--fs-note)/1.3 var(--f-text);color:var(--label2)}
.hn-casa-i{flex:none;width:48px;height:48px;object-fit:contain;border-radius:12px;background:var(--fill2);padding:4px;box-sizing:border-box}
.hn-casa-r .hn-chev{flex:none;color:var(--label3,var(--label2))}
.hn-casa-r:focus-visible{outline:3px solid var(--brand-tint);outline-offset:2px}
:root[data-theme=dark] .hn-casa-i{background:#E8E8ED}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .hn-casa-i{background:#E8E8ED}}`;
function css(){
  if(D.getElementById("css-hunter-boot") || !D.head) return;
  const s = D.createElement("style"); s.id = "css-hunter-boot"; s.textContent = CSS; D.head.appendChild(s);
}
function casaRow(){
  css();
  return `<section class="hn-casa-s"><div class="st-g"><a class="st-r hn-casa-r" href="#/album/casa" aria-label="Mi casa: ${esc(rowSub())}">
    <img class="hn-casa-i" src="${HOUSE}" alt="" width="48" height="48" draggable="false">
    <span class="st-l">Mi casa<small>${esc(rowSub())}</small></span>${ico("caret-right", "bold", 18, "hn-chev")}</a></div></section>`;
}

/* ---------- Para mayores: borrar las fotos ---------- */
const delText = () => N ? `${nFotos(N)} en este aparato: recortes pequeños de lo que se cazó.` : "No queda ninguna foto.";
function adultHtml(){
  return `<section class="st-sec" id="aj-hn" aria-labelledby="aj-hn-h"${N ? "" : " hidden"}><h3 class="st-h" id="aj-hn-h">Mi casa (Cazador de cosas)</h3><div class="st-g ics">
      <button type="button" class="st-r st-btn" id="aj-hn-del"><span class="st-ic gr" aria-hidden="true">${ico("trash", "bold", 18)}</span>
        <span class="st-l">Borrar las fotos de Mi casa<small id="aj-hn-ds">${esc(delText())}</small></span></button>
    </div></section>`;
}
bus.on("settings", d => {
  if(!d || d.page !== "mayores" || !d.el) return;
  const sec = d.el.querySelector("#aj-hn"), del = d.el.querySelector("#aj-hn-del"), ds = d.el.querySelector("#aj-hn-ds");
  if(!sec || !del) return;
  recount().then(() => { if(!del.isConnected) return; sec.hidden = !N; if(ds) ds.textContent = delText(); });
  let armed = 0;
  del.onclick = () => {
    const t = Date.now();
    if(!armed || t - armed > 5000){   /* confirmación: un segundo toque en 5 s */
      armed = t;
      if(ds) ds.textContent = "¿Seguro? Toca otra vez para borrarlas.";
      setTimeout(() => { if(armed === t && ds && ds.isConnected){ armed = 0; ds.textContent = delText(); } }, 5000);
      return;
    }
    if(t - armed < 400) return;   /* un doble toque sin querer no cuenta */
    armed = 0; del.disabled = true;
    wipe().then(() => {
      if(ds) ds.textContent = "Hecho: se han borrado.";
      try{ if(W.M && typeof M.toast === "function") M.toast("Listo: fotos de Mi casa borradas", {icon: ico("check-circle", "fill", 22)}); }catch(e){}
    }, () => { del.disabled = false; if(ds) ds.textContent = "No se han podido borrar. Prueba otra vez."; });
  };
});

Object.assign(H, {
  loaded: !!H.loaded, SRC, KEY, IMG, HOUSE, SWATCH, THINGS, load, recount, casaRow, adultHtml, wipe,
  images: () => [IMG, HOUSE, ...Object.values(SWATCH), ...Object.values(THINGS).flat().map(x => x[1])],
  count: () => N,
  casa: alive => load().then(h => h.casa(alive)),
  _set: n => { N = +n || 0; paintRow(); },
});

/* ---------- la ruta, en la pestaña Jugar ---------- */
ROUTES.cazador = async parts => {
  const h = await load();
  if(secOf(hashPath()) !== "cazador") return;   /* mientras llegaba el fichero se fue a otra pantalla */
  await h.route(parts || []);
};
ROUTES.cazador.load = () => Promise.all([load(), getDoc("colores").catch(() => null)]);
try{
  const t = TABS.find(x => x.id === "jugar");
  if(t && !t.secs.includes("cazador")){ t.secs.push("cazador"); if(t.segs && t.segs[0] && !t.segs[0].secs.includes("cazador")) t.segs[0].secs.push("cazador"); }
}catch(e){ console.error(e); }

/* ---------- la tarjeta de Juegos ---------- */
try{
  if(W.vocabGames && typeof vocabGames.register === "function")
    vocabGames.register("cazador", {t: "Cazador de cosas", sub: "Busca colores con la cámara", img: IMG, href: "#/cazador",
      line: () => N ? `${nFotos(N)} en Mi casa` : "Rojo, amarillo, verde y azul"});
}catch(e){ console.error(e); }

/* al arrancar, si ya se jugó alguna vez; al cerrar Ajustes (Para mayores puede borrar las fotos) */
bus.on("boot", () => { let used = false; try{ used = localStorage.getItem(KEY) !== null; }catch(e){} if(used) setTimeout(recount, 1200); });
bus.on("settings", d => { if(d && d.page === null && N) recount(); });
})();
