/* Módulo fab: botón redondo flotante (abajo a la derecha) que aparece al bajar, cuando la fila de arriba de la
   cabecera (inicio, sonidos, tema, ajustes, instalar e idioma) ya no se ve. Al tocarlo se abre una rueda en dos anillos:
   dentro las herramientas y fuera los idiomas y «arriba». Cada botón pulsa el botón real de la cabecera, así la lógica
   sigue en un solo sitio. */
(() => {
const STYLE = `
.fab{position:fixed;right:calc(14px + env(safe-area-inset-right,0px));bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:30;width:0;height:0}
.fab-main{position:absolute;right:0;bottom:0;width:60px;height:60px;border-radius:50%;border:3px solid #fff;background:var(--head);color:#fff;font-size:1.6rem;
  box-shadow:0 8px 22px rgba(5,20,40,.35);display:flex;align-items:center;justify-content:center;transition:transform .3s cubic-bezier(.3,1.4,.5,1),opacity .25s}
.fab-main span{display:inline-block;transition:transform .45s cubic-bezier(.3,1.6,.5,1)}
.fab:not(.open):not(.hid) .fab-main{animation:fab-bob 2.6s ease-in-out infinite}
.fab:not(.open):not(.hid) .fab-main span{animation:fab-wig 6s ease-in-out infinite}
.fab-main:active{transform:scale(.88)}
.fab.pop .fab-main{animation:fab-in .55s cubic-bezier(.3,1.7,.5,1)}
@keyframes fab-bob{0%,100%{translate:0 0}50%{translate:0 -5px}}
@keyframes fab-wig{0%,86%,100%{rotate:0deg}89%{rotate:-18deg}92%{rotate:16deg}95%{rotate:-10deg}98%{rotate:6deg}}
@keyframes fab-in{0%{transform:scale(0) rotate(-180deg)}100%{transform:scale(1) rotate(0)}}
.fab.hid .fab-main{transform:scale(0);opacity:0;pointer-events:none}
.fab.open .fab-main span{transform:rotate(225deg) scale(.9)}
.fab-ring{position:absolute;right:30px;bottom:30px;width:0;height:0;pointer-events:none}
.fab-arc{position:absolute;border-radius:50%;border:3px solid rgba(255,255,255,.85);transform:scale(0);transition:transform .3s cubic-bezier(.3,1.2,.5,1)}
.fab-arc.a1{width:300px;height:300px;right:-150px;bottom:-150px;background:#13406e;box-shadow:0 6px 20px rgba(5,20,40,.3)}
.fab-arc.a2{width:460px;height:460px;right:-230px;bottom:-230px;background:#1a9e94;box-shadow:0 6px 20px rgba(5,20,40,.3)}
.fab.open .fab-arc{transform:scale(1)}
.fab.open .fab-arc.a2{transition-delay:.04s}
.fab-it{position:absolute;width:46px;height:46px;right:-23px;bottom:-23px;border-radius:50%;border:0;background:rgba(255,255,255,.16);color:#fff;
  font-size:1.35rem;display:flex;align-items:center;justify-content:center;translate:0 0;transform:scale(.2);opacity:0;pointer-events:none;
  transition:translate .34s cubic-bezier(.3,1.4,.5,1),transform .34s cubic-bezier(.3,1.4,.5,1),opacity .2s}
.fab-it:hover,.fab-it:focus-visible{animation:fab-jig .5s;background:rgba(255,255,255,.3);outline:none}
.fab-it:active{scale:.8}
.fab-it.boom{animation:fab-boom .4s ease-out}
@keyframes fab-jig{0%,100%{rotate:0deg}25%{rotate:-14deg}50%{rotate:12deg}75%{rotate:-6deg}}
@keyframes fab-boom{0%{scale:1}40%{scale:1.45;rotate:20deg}100%{scale:1;rotate:0deg}}
.fab-it .tip{position:absolute;right:52px;top:50%;translate:0 -50%;white-space:nowrap;background:#fff;color:#0b2545;font-size:.85rem;font-weight:800;padding:3px 9px;border-radius:10px;box-shadow:0 3px 10px rgba(5,20,40,.3);opacity:0;scale:.6;transition:opacity .15s,scale .2s cubic-bezier(.3,1.6,.5,1);pointer-events:none}
.fab-it:hover .tip,.fab-it:focus-visible .tip{opacity:1;scale:1}
.fab-spark{position:fixed;z-index:31;font-size:1.1rem;pointer-events:none;animation:fab-spark .7s ease-out forwards}
@keyframes fab-spark{0%{transform:translate(0,0) scale(.4);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(1.1) rotate(160deg);opacity:0}}
.fab-it.on{background:#fff;color:#0b2545;box-shadow:0 2px 0 rgba(0,0,0,.2)}
.fab-it small{position:absolute;bottom:-3px;right:-3px;font-size:.6rem;font-weight:800;background:#0b2545;color:#fff;border-radius:6px;padding:0 3px;line-height:1.3}
.fab.open .fab-it{opacity:1;pointer-events:auto}
.fab-back{position:fixed;inset:0;z-index:29;background:rgba(5,20,40,.25);opacity:0;pointer-events:none;transition:opacity .25s}
.fab-back.on{opacity:1;pointer-events:auto}
@media (prefers-reduced-motion:reduce){.fab *{transition:none!important}}
`;
const $ = s => document.querySelector(s);
const st = document.createElement("style"); st.id = "css-fab"; st.textContent = STYLE; document.head.appendChild(st);

const root = document.createElement("div"); root.className = "fab hid";
root.innerHTML = `<div class="fab-ring"><div class="fab-arc a2"></div><div class="fab-arc a1"></div></div>
  <button class="fab-main" aria-expanded="false" aria-label="Menú: idioma y ajustes" title="Menú"><span>⭐</span></button>`;
const back = document.createElement("div"); back.className = "fab-back";
document.body.append(back, root);
const ring = root.querySelector(".fab-ring"), main = root.querySelector(".fab-main");

const snd = n => { try{ if(typeof sfx !== "undefined") sfx.play(n); }catch(e){} };
const SPARK = ["✨","⭐","🌟","💫"];
function sparks(el, n){   // estrellitas que salen volando del botón
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width/2, cy = r.top + r.height/2;
  for(let i = 0; i < n; i++){
    const s = document.createElement("span"); s.className = "fab-spark"; s.textContent = SPARK[i % SPARK.length];
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 50;
    s.style.left = (cx - 9) + "px"; s.style.top = (cy - 9) + "px";
    s.style.setProperty("--dx", Math.cos(a) * d + "px"); s.style.setProperty("--dy", Math.sin(a) * d + "px");
    document.body.appendChild(s); setTimeout(() => s.remove(), 750);
  }
}
// [icono, título, acción, ¿encendido?, etiqueta pequeña]
function items(){
  const inner = [
    ["🏠", "Inicio", () => { location.hash = "#/"; }],
    [$("#snd-b")?.textContent || "🔔", "Sonidos", () => $("#snd-b")?.click()],
    [$("#theme-b")?.textContent || "🌙", "Modo claro / oscuro", () => $("#theme-b")?.click()],
    ["⚙️", "Voz y velocidad", () => $("#cfg-b")?.click()],
  ];
  const outer = [...document.querySelectorAll("#langs [data-lang]")].map(b =>
    [b.querySelector(".fl")?.textContent || "🌐", b.title, () => b.click(), b.classList.contains("on"), (b.title || "").slice(0, 2).toUpperCase()]);
  const inst = $("#inst"); if(inst && !inst.hidden) outer.push(["📲", "Instalar", () => inst.click()]);
  outer.push(["⬆️", "Volver arriba", () => scrollTo({top:0, behavior:"smooth"})]);
  return [inner, outer];
}
function place(list, r, delay){
  const n = list.length, a0 = 8, a1 = 82;   // de casi vertical a casi horizontal (cuarto de círculo hacia arriba-izquierda)
  return list.map(([ic, t, fn, on, tag], i) => {
    const a = (a0 + (n === 1 ? 0 : (a1 - a0) * i / (n - 1))) * Math.PI / 180;
    const x = -Math.sin(a) * r, y = -Math.cos(a) * r;
    const b = document.createElement("button");
    b.className = "fab-it" + (on ? " on" : ""); b.title = t; b.setAttribute("aria-label", t);
    b.innerHTML = `<span aria-hidden="true">${ic}</span>` + (tag ? `<small aria-hidden="true">${tag}</small>` : "") + `<span class="tip" aria-hidden="true">${t}</span>`;
    b.dataset.x = x; b.dataset.y = y; b.style.transitionDelay = (delay + i * .03) + "s";
    b.addEventListener("click", e => { e.stopPropagation(); b.classList.add("boom"); snd("tap"); sparks(b, 6); setTimeout(() => { fn(); close(); }, 260); });
    return b;
  });
}
function open(){
  ring.querySelectorAll(".fab-it").forEach(b => b.remove());
  const [inner, outer] = items();
  const bs = [...place(inner, 98, 0), ...place(outer, 177, .05)];
  ring.append(...bs);
  root.classList.add("open"); back.classList.add("on"); main.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => bs.forEach(b => { b.style.translate = `${b.dataset.x}px ${b.dataset.y}px`; b.style.transform = "scale(1)"; }));
  snd("whoosh"); sparks(main, 10);
}
function close(){
  if(!root.classList.contains("open")) return;
  snd("pop");
  root.classList.remove("open"); back.classList.remove("on"); main.setAttribute("aria-expanded", "false");
  ring.querySelectorAll(".fab-it").forEach(b => { b.style.transitionDelay = "0s"; b.style.translate = "0 0"; b.style.transform = "scale(.2)"; });
}
main.addEventListener("click", () => root.classList.contains("open") ? close() : open());
back.addEventListener("click", close);
addEventListener("keydown", e => { if(e.key === "Escape") close(); });
addEventListener("hashchange", close);

// visible solo cuando la fila de arriba de la cabecera ya no se ve
const top = () => { const l = $(".logo"); return l ? l.getBoundingClientRect().bottom < 4 : scrollY > 60; };
let shown = false;
function check(){
  const s = top(); if(s === shown) return; shown = s;
  root.classList.toggle("hid", !s); if(!s) close();
  if(s){ root.classList.add("pop"); setTimeout(() => root.classList.remove("pop"), 600); }
}
addEventListener("scroll", check, {passive:true}); addEventListener("resize", check); check();
})();
