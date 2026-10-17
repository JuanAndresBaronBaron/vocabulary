/* Módulo gate: la Puerta de mayores (window.adultGate), para lo que no debe hacer un niño solo.
   - adultGate({reason, from}) → Promise<boolean>: hoja de vidrio «Para mayores» con una suma de dos números entre 3 y
     9 escritos en letras («¿Cuánto es siete más cinco?») y 4 respuestas numéricas grandes (una buena). Cada intento trae
     una suma nueva; a los 3 fallos se cierra con un aviso amable y da false. Esc, «Cancelar» o tocar fuera: false.
     reason: una frase corta de para qué es («Para entrar con Google.»); from: el botón desde el que sale la hoja.
   - Acertar se recuerda 10 minutos en sessionStorage ("vocab:gate", fuera de la partida): en ese tiempo adultGate()
     da true sin preguntar. adultGate.passed() → boolean (lo mismo, sin esperar: sirve para abrir algo dentro del toque)
     · adultGate.forget() la vuelve a cerrar.
   - Si ya hay una abierta, devuelve la misma promesa. Sin «mantener 3 s» ni trucos escondidos.
   - Enlaces externos: un toque en un <a> a otra web pasa antes por la Puerta (con la Puerta abierta, se abre directo) y
     se abre siempre en otra pestaña, así la app no se cierra. [data-no-gate] lo evita.
   Protege (SPEC §3): Para mayores, entrar con Google, abrir enlaces externos, borrar datos, el sello de Frases mágicas y
   las cartas del Buzón. */
(() => {
"use strict";
const KEY = "vocab:gate", MS = 10 * 60e3, TRIES = 3;
const WORDS = {3: "tres", 4: "cuatro", 5: "cinco", 6: "seis", 7: "siete", 8: "ocho", 9: "nueve"};
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const rnd = n => { try{ const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }catch(e){ return Math.floor(Math.random() * n); } };
const shuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function passed(){
  try{ const t = +sessionStorage.getItem(KEY); return t > 0 && Date.now() < t && t - Date.now() <= MS; }catch(e){ return false; }
}
function remember(){ try{ sessionStorage.setItem(KEY, String(Date.now() + MS)); }catch(e){} }
function forget(){ try{ sessionStorage.removeItem(KEY); }catch(e){} }

/* una suma nueva: a + b con a, b entre 3 y 9, y tres respuestas cercanas que no son */
function question(prev){
  let a, b;
  do { a = 3 + rnd(7); b = 3 + rnd(7); } while(prev && prev.a === a && prev.b === b);
  const s = a + b, near = shuffle([-3, -2, -1, 1, 2, 3].map(d => s + d).filter(x => x >= 4 && x <= 20 && x !== s));
  return {a, b, s, opts: shuffle([s, ...near.slice(0, 3)])};
}

const CSS = `
#gate.m-sheet{max-width:480px}
.gt-in{display:flex;flex-direction:column;align-items:center;text-align:center;padding:4px 4px 8px}
.gt-ic{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;margin:4px 0 10px;color:#fff;background:var(--brand-fill,#1E6EF4)}
.gt-t{margin:0;font:700 var(--fs-t2,1.5rem)/1.2 var(--f-round,system-ui);color:var(--label,#000)}
.gt-why{margin:6px 0 0;max-width:34ch;font:400 var(--fs-sub,1.0625rem)/1.35 var(--f-text,system-ui);color:var(--label2,#3c3c43)}
.gt-q{margin:18px 0 16px;font:700 var(--fs-t3,1.375rem)/1.3 var(--f-round,system-ui);color:var(--label,#000);text-wrap:balance}
.gt-q b{color:var(--brand-ink,#185CCF);font-weight:800}
.gt-as{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;max-width:360px}
.gt-a{min-height:72px;border:0;border-radius:var(--r-card,24px);background:var(--fill,rgba(120,120,128,.16));color:var(--label,#000);
  font:800 min(calc(1.875rem*var(--k,1)),40px)/1 var(--f-round,system-ui);font-variant-numeric:tabular-nums;cursor:pointer;
  -webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.gt-a:disabled{cursor:default}
.gt-msg{min-height:1.4em;margin:14px 0 4px;font:600 var(--fs-sub,1.0625rem)/1.35 var(--f-text,system-ui);color:var(--label2,#3c3c43)}
.gt-x{margin-top:6px}
:root[data-contrast=more] .gt-a{box-shadow:inset 0 0 0 2px var(--sep)}
@media (prefers-contrast:more){.gt-a{box-shadow:inset 0 0 0 2px var(--sep,rgba(60,60,67,.6))}}
@media (forced-colors:active){.gt-a{border:2px solid ButtonText}}
`;
function css(){ if($("css-gate")) return; const s = document.createElement("style"); s.id = "css-gate"; s.textContent = CSS; document.head.appendChild(s); }

let cur = null;   /* la Puerta abierta: {p, res, q, fails, ok, d} */
function paint(msg){
  const g = cur; if(!g) return;
  const q = g.q, had = document.activeElement && document.activeElement.classList.contains("gt-a");
  $("gt-q").innerHTML = `¿Cuánto es <b>${WORDS[q.a]} más ${WORDS[q.b]}</b>?`;
  $("gt-as").innerHTML = q.opts.map(v => `<button type="button" class="gt-a" data-v="${v}">${v}</button>`).join("");
  $("gt-msg").textContent = msg || "";
  if(had){ const b = $("gt-as").firstElementChild; if(b) b.focus({preventScroll: true}); }
}
function pick(b){
  const g = cur; if(!g || g.ok !== null) return;
  if(+b.dataset.v === g.q.s){
    g.ok = true; remember();
    try{ if(window.G && typeof G.haptic === "function") G.haptic("success"); }catch(e){}
    g.d.querySelectorAll(".gt-a").forEach(x => { x.disabled = true; });
    g.res(true);   /* aquí mismo, dentro del toque: quien espera puede abrir una ventana (Google, un enlace) */
    close(g);
    return;
  }
  g.fails++;
  if(g.fails >= TRIES){
    g.ok = false; g.res(false); close(g);
    setTimeout(() => { try{ if(window.M) M.toast("Esto es para mayores. ¡Pide ayuda a uno!", {icon: ico("lock", "bold", 22)}); }catch(e){} }, 120);
    return;
  }
  g.q = question(g.q);
  paint(g.fails === 1 ? "Esa no es. Prueba con esta otra." : "Esa tampoco. Una más:");
}
function close(g){
  const d = g.d; if(!d.open) return;
  if(window.M && typeof M.closeSheet === "function" && d.classList.contains("m-sheet")) M.closeSheet(d); else d.close();
}
function build(){
  let d = $("gate"); if(d) return d;
  css();
  d = document.createElement("dialog");
  d.id = "gate"; d.className = "gt";
  d.setAttribute("aria-labelledby", "gt-t"); d.setAttribute("aria-describedby", "gt-why gt-q");
  d.dataset.noRenew = ""; d.dataset.noHint = "";
  d.innerHTML = `<div class="gt-in">
    <div class="gt-ic" aria-hidden="true">${ico("lock", "bold", 28)}</div>
    <h2 class="gt-t" id="gt-t">Para mayores</h2>
    <p class="gt-why" id="gt-why"></p>
    <p class="gt-q" id="gt-q"></p>
    <div class="gt-as" id="gt-as" role="group" aria-label="Respuestas"></div>
    <p class="gt-msg" id="gt-msg" role="status" aria-live="polite"></p>
    <button type="button" class="glass-btn glass-btn--sm gt-x" id="gt-x">Cancelar</button></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest(".gt-a"); if(b && !b.disabled) return pick(b);
    if(e.target.closest && e.target.closest("#gt-x") && cur){ cur.ok = false; cur.res(false); close(cur); }
  });
  d.addEventListener("close", () => {
    const g = cur; if(!g || g.d !== d || d.open) return;
    cur = null; g.res(false);   /* Esc, tocar fuera o bajar la hoja: no */
  });
  return d;
}

function adultGate(o = {}){
  if(passed()) return Promise.resolve(true);
  if(cur) return cur.p;
  const d = build();
  let res; const p = new Promise(r => { res = r; });
  const g = cur = {p, d, q: question(null), fails: 0, ok: null, res: v => { if(g.done) return; g.done = true; res(!!v); }};
  $("gt-why").textContent = (o && o.reason) || "Esta parte es para mayores.";
  paint("");
  const from = o && o.from && o.from.nodeType === 1 ? o.from : null;
  if(window.M && typeof M.openSheet === "function") M.openSheet(d, {from});
  else { try{ d.showModal(); }catch(e){ d.setAttribute("open", ""); } }
  return p;
}
adultGate.passed = passed;
adultGate.forget = forget;
adultGate.MS = MS;
window.adultGate = adultGate;

/* enlaces a otras webs: antes, la Puerta. Si ya está abierta, se abre directo (dentro del toque) */
document.addEventListener("click", e => {
  if(e.defaultPrevented || e.button > 0) return;
  const a = e.target.closest && e.target.closest("a[href]"); if(!a || a.closest("[data-no-gate]") || a.hasAttribute("download")) return;
  let u; try{ u = new URL(a.getAttribute("href"), location.href); }catch(_){ return; }
  if(!/^https?:$/.test(u.protocol) || u.origin === location.origin) return;
  e.preventDefault();
  /* siempre en otra pestaña: la app no se cierra */
  if(passed()){ window.open(u.href, "_blank", "noopener"); return; }
  /* la promesa se cumple dentro del toque en la respuesta buena: el navegador deja abrir la pestaña nueva */
  adultGate({reason: "Este enlace abre otra web.", from: a}).then(ok => { if(ok) window.open(u.href, "_blank", "noopener"); });
}, true);
})();
