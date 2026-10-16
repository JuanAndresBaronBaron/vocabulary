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
.fab-fly{position:fixed;left:0;top:0;z-index:32;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:var(--head);border:3px solid #fff;
  color:#fff;font-size:1.3rem;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px rgba(5,20,40,.35);pointer-events:none}
.fab-say{position:absolute;right:72px;bottom:8px;width:max-content;max-width:min(240px,calc(100vw - 110px));background:#fff;color:#0b2545;border:3px solid #1f5fbf;
  border-radius:16px;padding:7px 12px;font-weight:800;font-size:.98rem;line-height:1.25;box-shadow:0 8px 22px rgba(5,20,40,.25);pointer-events:none;
  transform-origin:100% 80%;animation:fab-say-in .45s cubic-bezier(.3,1.6,.5,1)}
.fab-say::after{content:"";position:absolute;right:-9px;bottom:14px;width:12px;height:12px;background:#fff;border-right:3px solid #1f5fbf;border-top:3px solid #1f5fbf;transform:rotate(45deg)}
.fab-say.out{animation:fab-say-out .3s ease-in forwards}
@keyframes fab-say-in{0%{transform:scale(0) rotate(-8deg);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes fab-say-out{to{transform:scale(0);opacity:0}}
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
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
// de dónde sale la estrella: el centro de la fila de arriba (ajustes e idiomas), aunque ya esté por encima de la pantalla
function home(){
  const r = ($("#langs") || $(".htools") || $(".logo"))?.getBoundingClientRect();
  return r ? {x: r.left + r.width / 2, y: Math.max(26, r.top + r.height / 2)} : {x: innerWidth - 60, y: 26};
}
function spot(){ const r = main.getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; }
let flying = null;
function fly(from, to, done){   // estrella que viaja en curva dejando estrellitas
  flying?.cancel(); document.querySelectorAll(".fab-fly").forEach(e => e.remove());
  if(calm()){ done(); return; }
  const f = document.createElement("div"); f.className = "fab-fly"; f.textContent = "⭐"; document.body.appendChild(f);
  const mx = (from.x + to.x) / 2 - 80, my = Math.min(from.y, to.y) + Math.abs(to.y - from.y) * .25;
  const pt = t => ({x: (1-t)*(1-t)*from.x + 2*(1-t)*t*mx + t*t*to.x, y: (1-t)*(1-t)*from.y + 2*(1-t)*t*my + t*t*to.y});
  const frames = [];
  for(let i = 0; i <= 12; i++){ const t = i / 12, p = pt(t);
    frames.push({transform: `translate(${p.x}px,${p.y}px) rotate(${t * 540}deg) scale(${1 + Math.sin(t * Math.PI) * .5})`}); }
  const a = f.animate(frames, {duration: 850, easing: "cubic-bezier(.45,.05,.35,1)"}); flying = a;
  const trail = setInterval(() => {
    const t = Math.min(1, (a.currentTime || 0) / 850), p = pt(t), sp = document.createElement("span");
    sp.className = "fab-spark"; sp.textContent = SPARK[Math.floor(t * 12) % SPARK.length];
    sp.style.left = (p.x - 9) + "px"; sp.style.top = (p.y - 9) + "px";
    sp.style.setProperty("--dx", (Math.random() * 30 - 15) + "px"); sp.style.setProperty("--dy", (10 + Math.random() * 25) + "px");
    document.body.appendChild(sp); setTimeout(() => sp.remove(), 750);
  }, 60);
  a.onfinish = a.oncancel = () => { clearInterval(trail); f.remove(); if(flying === a){ flying = null; done(); } };
}
// globito que explica para qué sirve (las primeras veces que aparece)
const SAYS = ["¡Aquí guardé el idioma y los ajustes! ⭐", "Toca la estrella para cambiar de idioma 🇬🇧🇫🇷🇩🇰", "¡Tus ajustes viven aquí! ⭐"];
let sayT = 0;
function say(){
  let n = 0; try{ n = +localStorage.getItem("fab:says") || 0; }catch(e){}
  if(n >= 4 || root.classList.contains("open")) return;
  try{ localStorage.setItem("fab:says", n + 1); }catch(e){}
  root.querySelector(".fab-say")?.remove();
  const b = document.createElement("div"); b.className = "fab-say"; b.textContent = SAYS[n % SAYS.length]; root.appendChild(b);
  clearTimeout(sayT); sayT = setTimeout(hush, 3200);
}
function hush(){ const b = root.querySelector(".fab-say"); if(!b) return; b.classList.add("out"); setTimeout(() => b.remove(), 320); }
let shown = false, first = true;
function check(){
  const s = top(); if(s === shown) return; shown = s;
  if(s){
    const quick = first && scrollY > 400;   // si la página abre ya abajo (p. ej. el camino), sin viaje
    first = false;
    const land = () => { if(!shown) return; root.classList.remove("hid"); root.classList.add("pop"); snd("pop"); sparks(main, 8);
      setTimeout(() => root.classList.remove("pop"), 600); say(); };
    if(quick) land(); else { snd("whoosh"); fly(home(), spotTarget(), land); }
  } else {
    first = false; close(); hush();
    const from = spot(), was = !root.classList.contains("hid");
    root.classList.add("hid");
    if(was) fly(from, home(), () => {});
  }
}
// dónde va a quedar (aunque el botón aún esté oculto con escala 0)
function spotTarget(){
  const cs = getComputedStyle(root), r = parseFloat(cs.right) || 14, b = parseFloat(cs.bottom) || 14;
  return {x: innerWidth - r - 30, y: innerHeight - b - 30};
}
main.title = "Idioma y ajustes";
addEventListener("scroll", check, {passive:true}); addEventListener("resize", check); check();
})();
